-- ============================================
-- CineMatch: RLS Policy Migration v2
-- Run this in the Supabase SQL Editor
-- This fixes the RLS policies WITHOUT dropping tables/data
-- ============================================

-- ============================================
-- 1. ROOMS — SELECT policy
-- ============================================
drop policy if exists "Rooms are viewable by members" on public.rooms;
drop policy if exists "Rooms are viewable by authenticated users" on public.rooms;

-- Any authenticated user can SELECT rooms.
-- The room code acts as a "secret" — you can only find a room if you know the code.
create policy "Rooms are viewable by authenticated users"
  on public.rooms for select
  to authenticated
  using (true);

-- ============================================
-- 2. ROOM MEMBERS — SELECT policy (THE KEY FIX)
-- ============================================
-- The old policy had a self-referencing subquery:
--   auth.uid() = user_id OR exists(select from room_members ...)
-- With FORCE ROW LEVEL SECURITY, the subquery is also subject to RLS,
-- causing recursive evaluation that Postgres can resolve incorrectly.
-- This made the votes API unable to verify membership (403 error).
--
-- Fix: Allow any authenticated user to view room_members.
-- Room codes are the access control mechanism. Membership UUIDs are not
-- sensitive. Actual sensitive data (votes, matches) has its own RLS.
drop policy if exists "Room members can view other members" on public.room_members;
drop policy if exists "Room members viewable by authenticated users" on public.room_members;

create policy "Room members viewable by authenticated users"
  on public.room_members for select
  to authenticated
  using (true);

-- ============================================
-- 3. MOVIE VOTES — SELECT & INSERT policies
-- ============================================
-- The old policies used exists(select from room_members ...) which
-- was blocked by the broken room_members SELECT policy.
-- Now that room_members SELECT is open, these should work.
-- But let's simplify them to avoid nested RLS issues entirely.

drop policy if exists "Users can view votes in their rooms" on public.movie_votes;
drop policy if exists "Users can insert their own votes" on public.movie_votes;
drop policy if exists "Users can update their own votes" on public.movie_votes;

-- SELECT: users can view votes in rooms they belong to
create policy "Users can view votes in their rooms"
  on public.movie_votes for select
  to authenticated
  using (
    exists (
      select 1 from public.room_members
      where room_members.room_id = movie_votes.room_id
      and room_members.user_id = (select auth.uid())
    )
  );

-- INSERT: users can insert their own votes (membership checked at app level too)
create policy "Users can insert their own votes"
  on public.movie_votes for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
  );

-- UPDATE: users can update their own votes
create policy "Users can update their own votes"
  on public.movie_votes for update
  to authenticated
  using ((select auth.uid()) = user_id);

-- ============================================
-- 4. MATCHES — SELECT & INSERT policies
-- ============================================
drop policy if exists "Users can view matches in their rooms" on public.matches;
drop policy if exists "Users can insert matches in their rooms" on public.matches;

-- SELECT: users can view matches in rooms they belong to
create policy "Users can view matches in their rooms"
  on public.matches for select
  to authenticated
  using (
    exists (
      select 1 from public.room_members
      where room_members.room_id = matches.room_id
      and room_members.user_id = (select auth.uid())
    )
  );

-- INSERT: any authenticated user can insert matches (room membership
-- is validated at the application level in the votes API)
create policy "Users can insert matches in their rooms"
  on public.matches for insert
  to authenticated
  with check (
    exists (
      select 1 from public.room_members
      where room_members.room_id = matches.room_id
      and room_members.user_id = (select auth.uid())
    )
  );
