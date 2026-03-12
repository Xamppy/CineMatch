-- CineMatch Database Schema
-- Run this in the Supabase SQL Editor

-- ============================================
-- PROFILES
-- ============================================
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text not null,
  avatar_url text,
  created_at timestamptz default now() not null
);

alter table public.profiles enable row level security;

create policy "Public profiles are viewable by everyone"
  on public.profiles for select
  using (true);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- ============================================
-- ROOMS
-- ============================================
create table public.rooms (
  id uuid default gen_random_uuid() primary key,
  code text unique not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now() not null
);

alter table public.rooms enable row level security;

create policy "Rooms are viewable by members"
  on public.rooms for select
  using (
    exists (
      select 1 from public.room_members
      where room_members.room_id = rooms.id
      and room_members.user_id = auth.uid()
    )
    or created_by = auth.uid()
  );

create policy "Authenticated users can create rooms"
  on public.rooms for insert
  with check (auth.uid() = created_by);

-- ============================================
-- ROOM MEMBERS
-- ============================================
create table public.room_members (
  id uuid default gen_random_uuid() primary key,
  room_id uuid references public.rooms(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  joined_at timestamptz default now() not null,
  unique (room_id, user_id)
);

alter table public.room_members enable row level security;

create policy "Room members can view other members"
  on public.room_members for select
  using (
    exists (
      select 1 from public.room_members as rm
      where rm.room_id = room_members.room_id
      and rm.user_id = auth.uid()
    )
  );

create policy "Authenticated users can join rooms"
  on public.room_members for insert
  with check (auth.uid() = user_id);

-- ============================================
-- MOVIE VOTES
-- ============================================
create table public.movie_votes (
  id uuid default gen_random_uuid() primary key,
  room_id uuid references public.rooms(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  movie_id integer not null,
  movie_title text not null,
  poster_path text,
  backdrop_path text,
  vote text check (vote in ('like', 'dislike')) not null,
  created_at timestamptz default now() not null,
  unique (room_id, user_id, movie_id)
);

alter table public.movie_votes enable row level security;

create policy "Users can view votes in their rooms"
  on public.movie_votes for select
  using (
    exists (
      select 1 from public.room_members
      where room_members.room_id = movie_votes.room_id
      and room_members.user_id = auth.uid()
    )
  );

create policy "Users can insert their own votes"
  on public.movie_votes for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own votes"
  on public.movie_votes for update
  using (auth.uid() = user_id);

-- ============================================
-- MATCHES
-- ============================================
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

create policy "Users can view matches in their rooms"
  on public.matches for select
  using (
    exists (
      select 1 from public.room_members
      where room_members.room_id = matches.room_id
      and room_members.user_id = auth.uid()
    )
  );

create policy "Users can insert matches in their rooms"
  on public.matches for insert
  with check (
    exists (
      select 1 from public.room_members
      where room_members.room_id = matches.room_id
      and room_members.user_id = auth.uid()
    )
  );

-- ============================================
-- REALTIME
-- ============================================
-- Enable realtime for matches and movie_votes tables
alter publication supabase_realtime add table public.matches;
alter publication supabase_realtime add table public.movie_votes;

-- ============================================
-- INDEXES
-- ============================================
create index idx_rooms_code on public.rooms(code);
create index idx_room_members_room_id on public.room_members(room_id);
create index idx_room_members_user_id on public.room_members(user_id);
create index idx_movie_votes_room_movie on public.movie_votes(room_id, movie_id);
create index idx_movie_votes_user on public.movie_votes(user_id);
create index idx_matches_room on public.matches(room_id);
