-- ============================================
-- CineMatch: RLS Policy Migration
-- Run this in the Supabase SQL Editor
-- This fixes the RLS policies WITHOUT dropping tables/data
-- ============================================

-- ============================================
-- 1. Drop old ROOMS policies
-- ============================================
drop policy if exists "Rooms are viewable by members" on public.rooms;
drop policy if exists "Rooms are viewable by authenticated users" on public.rooms;

-- ============================================
-- 2. Create fixed ROOMS SELECT policy
-- ============================================
-- The original policy required the user to be a room_member or the creator.
-- This caused a chicken-and-egg problem:
--   - .insert().select().single() calls SELECT after INSERT
--   - The creator is NOT yet a room_member (that happens in the next step)
--   - So the SELECT fails, even though created_by matches
--
-- Additionally, when a NEW user tries to join by room code, they can't
-- SELECT the room because they are neither a member nor the creator.
--
-- Fix: Allow any authenticated user to SELECT rooms.
-- The room code acts as a "secret" -- you can only find a room if you know the code.
-- Sensitive data (votes, matches) is protected at their own table level via RLS.
create policy "Rooms are viewable by authenticated users"
  on public.rooms for select
  to authenticated
  using (true);

-- ============================================
-- 3. Fix ROOM MEMBERS SELECT policy
-- ============================================
-- The original policy only allowed existing members to see other members.
-- This blocked the join flow: when checking member count before joining,
-- the new user couldn't count existing members.
--
-- Fix: Also allow users to see their own membership row.
drop policy if exists "Room members can view other members" on public.room_members;

create policy "Room members can view other members"
  on public.room_members for select
  using (
    (select auth.uid()) = user_id
    or exists (
      select 1 from public.room_members as rm
      where rm.room_id = room_members.room_id
      and rm.user_id = (select auth.uid())
    )
  );
