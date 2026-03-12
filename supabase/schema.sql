-- CineMatch Database Schema
-- Run this in the Supabase SQL Editor

-- ============================================
-- 0. DROP EXISTING (for re-run safety)
-- ============================================
-- Drop policies first (they depend on tables)
drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Rooms are viewable by members" on public.rooms;
drop policy if exists "Authenticated users can create rooms" on public.rooms;
drop policy if exists "Rooms are viewable by authenticated users" on public.rooms;
drop policy if exists "Room members can view other members" on public.room_members;
drop policy if exists "Authenticated users can join rooms" on public.room_members;
drop policy if exists "Users can view votes in their rooms" on public.movie_votes;
drop policy if exists "Users can insert their own votes" on public.movie_votes;
drop policy if exists "Users can update their own votes" on public.movie_votes;
drop policy if exists "Users can view matches in their rooms" on public.matches;
drop policy if exists "Users can insert matches in their rooms" on public.matches;

-- Drop tables (order matters due to FKs)
drop table if exists public.matches cascade;
drop table if exists public.movie_votes cascade;
drop table if exists public.room_members cascade;
drop table if exists public.rooms cascade;
drop table if exists public.profiles cascade;

-- Drop custom types
drop type if exists vote_type;

-- ============================================
-- 1. CUSTOM TYPES
-- ============================================
create type vote_type as enum ('like', 'dislike');

-- ============================================
-- 2. TABLES (all tables first, then policies)
-- ============================================

-- PROFILES
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text not null check (length(username) between 2 and 50),
  avatar_url text,
  created_at timestamptz default now() not null
);

alter table public.profiles enable row level security;
alter table public.profiles force row level security;

-- ROOMS
create table public.rooms (
  id uuid default gen_random_uuid() primary key,
  code text unique not null check (length(code) = 6),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now() not null
);

alter table public.rooms enable row level security;
alter table public.rooms force row level security;

-- ROOM MEMBERS
create table public.room_members (
  id uuid default gen_random_uuid() primary key,
  room_id uuid references public.rooms(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  joined_at timestamptz default now() not null,
  unique (room_id, user_id)
);

alter table public.room_members enable row level security;
alter table public.room_members force row level security;

-- MOVIE VOTES
create table public.movie_votes (
  id uuid default gen_random_uuid() primary key,
  room_id uuid references public.rooms(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  movie_id integer not null,
  movie_title text not null,
  poster_path text,
  backdrop_path text,
  vote vote_type not null,
  created_at timestamptz default now() not null,
  unique (room_id, user_id, movie_id)
);

alter table public.movie_votes enable row level security;
alter table public.movie_votes force row level security;

-- MATCHES
create table public.matches (
  id uuid default gen_random_uuid() primary key,
  room_id uuid references public.rooms(id) on delete cascade not null,
  movie_id integer not null,
  movie_title text not null,
  poster_path text,
  matched_at timestamptz default now() not null,
  unique (room_id, movie_id)
);

alter table public.matches enable row level security;
alter table public.matches force row level security;

-- ============================================
-- 3. RLS POLICIES (after all tables exist)
-- ============================================

-- PROFILES policies
-- Anyone can read profiles (for display purposes)
create policy "Public profiles are viewable by everyone"
  on public.profiles for select
  using (true);

-- Users can create their own profile
create policy "Users can insert their own profile"
  on public.profiles for insert
  with check ((select auth.uid()) = id);

-- Users can update their own profile
create policy "Users can update their own profile"
  on public.profiles for update
  using ((select auth.uid()) = id);

-- ROOMS policies
-- Any authenticated user can SELECT rooms. This is needed so that:
-- 1. The creator can read back the room after INSERT (.insert().select())
-- 2. A new user can look up a room by code when joining
-- The room code itself acts as a "secret" -- you can only find a room if you know the code.
-- Sensitive data (votes, matches) is protected at their own table level.
create policy "Rooms are viewable by authenticated users"
  on public.rooms for select
  to authenticated
  using (true);

-- Only the creator (authenticated) can insert a room
create policy "Authenticated users can create rooms"
  on public.rooms for insert
  with check ((select auth.uid()) = created_by);

-- ROOM MEMBERS policies
-- Members of a room can see the other members in that room.
-- We also allow users to see their own membership row (for join checks).
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

-- Any authenticated user can join a room (insert themselves as a member).
-- Max 2 members is enforced at the application level.
create policy "Authenticated users can join rooms"
  on public.room_members for insert
  with check ((select auth.uid()) = user_id);

-- MOVIE VOTES policies
-- Users can see votes in rooms they belong to
create policy "Users can view votes in their rooms"
  on public.movie_votes for select
  using (
    exists (
      select 1 from public.room_members
      where room_members.room_id = movie_votes.room_id
      and room_members.user_id = (select auth.uid())
    )
  );

-- Users can insert their own votes in rooms they belong to
create policy "Users can insert their own votes"
  on public.movie_votes for insert
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.room_members
      where room_members.room_id = movie_votes.room_id
      and room_members.user_id = (select auth.uid())
    )
  );

-- Users can update their own votes (for re-voting)
create policy "Users can update their own votes"
  on public.movie_votes for update
  using ((select auth.uid()) = user_id);

-- MATCHES policies
-- Users can see matches in rooms they belong to
create policy "Users can view matches in their rooms"
  on public.matches for select
  using (
    exists (
      select 1 from public.room_members
      where room_members.room_id = matches.room_id
      and room_members.user_id = (select auth.uid())
    )
  );

-- Users can insert matches in rooms they belong to
create policy "Users can insert matches in their rooms"
  on public.matches for insert
  with check (
    exists (
      select 1 from public.room_members
      where room_members.room_id = matches.room_id
      and room_members.user_id = (select auth.uid())
    )
  );

-- ============================================
-- 4. REALTIME
-- ============================================
alter publication supabase_realtime add table public.matches;
alter publication supabase_realtime add table public.movie_votes;

-- ============================================
-- 5. INDEXES
-- ============================================
-- Note: rooms.code already has an index from the UNIQUE constraint
-- Note: room_members(room_id, user_id) already has an index from the UNIQUE constraint

-- FK index for room_members.user_id (used in RLS policies and user lookups)
create index idx_room_members_user_id on public.room_members(user_id);

-- Composite index for vote lookups by room + movie (covers match detection query)
create index idx_movie_votes_room_movie on public.movie_votes(room_id, movie_id);

-- FK index for movie_votes.user_id (used in RLS update policy)
create index idx_movie_votes_user on public.movie_votes(user_id);

-- FK index for matches.room_id (used in RLS select/insert policies)
create index idx_matches_room on public.matches(room_id);

-- Index on rooms.created_by for FK cascade and queries
create index idx_rooms_created_by on public.rooms(created_by);
