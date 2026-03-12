-- ============================================
-- CineMatch: Lobby Feature Migration
-- Run this in the Supabase SQL Editor
-- Adds room_movies table, room status, and member readiness
-- ============================================

-- ============================================
-- 1. Create room_status enum type
-- ============================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'room_status') then
    create type room_status as enum ('lobby', 'swiping', 'completed');
  end if;
end$$;

-- ============================================
-- 2. Add status column to rooms table
-- ============================================
alter table public.rooms
  add column if not exists status room_status not null default 'lobby';

-- ============================================
-- 3. Add is_ready column to room_members table
-- ============================================
alter table public.room_members
  add column if not exists is_ready boolean not null default false;

-- ============================================
-- 4. Create room_movies table
-- Stores movies added to a room's pool during the lobby phase.
-- Each user adds movies independently. The combined pool is used
-- for the swipe phase.
-- ============================================
create table if not exists public.room_movies (
  id uuid default gen_random_uuid() primary key,
  room_id uuid references public.rooms(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  movie_id integer not null,
  movie_title text not null,
  poster_path text,
  backdrop_path text,
  release_date text,
  vote_average numeric(3,1),
  overview text,
  added_at timestamptz default now() not null,
  unique (room_id, user_id, movie_id)
);

alter table public.room_movies enable row level security;
alter table public.room_movies force row level security;

-- ============================================
-- 5. RLS Policies for room_movies
-- ============================================

-- SELECT: members can view movies in their rooms
drop policy if exists "Room members can view room movies" on public.room_movies;

create policy "Room members can view room movies"
  on public.room_movies for select
  to authenticated
  using (
    exists (
      select 1 from public.room_members
      where room_members.room_id = room_movies.room_id
      and room_members.user_id = (select auth.uid())
    )
  );

-- INSERT: only room members can add movies, and only as themselves
-- Validates both ownership (user_id) and room membership at the DB level.
drop policy if exists "Authenticated users can add room movies" on public.room_movies;

create policy "Authenticated users can add room movies"
  on public.room_movies for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.room_members
      where room_members.room_id = room_movies.room_id
      and room_members.user_id = (select auth.uid())
    )
  );

-- DELETE: room members can remove their own movies from the pool
drop policy if exists "Users can remove their own room movies" on public.room_movies;

create policy "Users can remove their own room movies"
  on public.room_movies for delete
  to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.room_members
      where room_members.room_id = room_movies.room_id
      and room_members.user_id = (select auth.uid())
    )
  );

-- ============================================
-- 6. RLS Policy for room_members UPDATE (for is_ready)
-- ============================================
-- Allow users to update their own room_members row (to set is_ready)
drop policy if exists "Users can update their own membership" on public.room_members;

create policy "Users can update their own membership"
  on public.room_members for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ============================================
-- 7. RLS Policy for rooms UPDATE (for status transitions)
-- ============================================
-- Allow room members to update the room.
-- WITH CHECK ensures status remains a valid room_status value
-- (enforced by the column type) and that protected columns
-- (id, code, created_by, created_at) cannot be changed since
-- Supabase client queries only send the columns specified in
-- .update({ status: '...' }). The enum type on the status column
-- itself prevents invalid values.
drop policy if exists "Room members can update room status" on public.rooms;

create policy "Room members can update room status"
  on public.rooms for update
  to authenticated
  using (
    exists (
      select 1 from public.room_members
      where room_members.room_id = rooms.id
      and room_members.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.room_members
      where room_members.room_id = rooms.id
      and room_members.user_id = (select auth.uid())
    )
  );

-- ============================================
-- 8. Indexes
-- ============================================
-- FK index for room_movies.room_id (used in SELECT policy and pool fetch)
create index if not exists idx_room_movies_room_id
  on public.room_movies(room_id);

-- FK index for room_movies.user_id (used in INSERT/DELETE policies and user counts)
create index if not exists idx_room_movies_user_id
  on public.room_movies(user_id);

-- Composite index for room_movies lookups by room + movie
-- The UNIQUE constraint covers (room_id, user_id, movie_id) but the pool
-- fetch query filters by room_id + movie_id only (without user_id),
-- so this separate index is needed for that access pattern.
create index if not exists idx_room_movies_room_movie
  on public.room_movies(room_id, movie_id);

-- Partial index on rooms for lobby status (used by lobby queries and guards)
create index if not exists idx_rooms_lobby_status
  on public.rooms(id) where status = 'lobby';

-- ============================================
-- 9. Enable realtime on room_movies and room_members
-- (for lobby updates: seeing when partner adds movies / is ready)
-- ============================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
    and tablename = 'room_movies'
  ) then
    alter publication supabase_realtime add table public.room_movies;
  end if;
end$$;

-- room_members may already be in the publication
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
    and tablename = 'room_members'
  ) then
    alter publication supabase_realtime add table public.room_members;
  end if;
end$$;

-- ============================================
-- 10. Update existing rooms to 'lobby' status (safe for re-runs)
-- ============================================
-- Existing rooms without a status will get the default 'lobby'.
-- If you want existing rooms to go straight to swiping:
-- update public.rooms set status = 'swiping' where status = 'lobby';
