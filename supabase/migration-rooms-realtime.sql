-- ============================================
-- CineMatch: Enable Realtime on rooms table
-- Run this in the Supabase SQL Editor
-- Fixes: lobby→swiping transition not detected by clients
-- because rooms table was missing from the realtime publication.
-- ============================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
    and tablename = 'rooms'
  ) then
    alter publication supabase_realtime add table public.rooms;
  end if;
end$$;
