-- Run this file in Supabase Dashboard -> SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.playlists (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null default '',
  artwork_url text,
  source_provider text not null check (source_provider in ('spotify', 'youtube', 'manual')),
  source_url text,
  source_id text,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_provider, source_id)
);

create table if not exists public.tracks (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  position integer not null check (position >= 0),
  title text not null,
  artist text not null,
  album text not null default '',
  duration_ms integer,
  artwork_url text,
  source_provider text not null check (source_provider in ('spotify', 'youtube', 'manual')),
  source_url text,
  source_id text,
  audio_url text,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (playlist_id, position),
  unique (playlist_id, source_provider, source_id)
);

create unique index if not exists one_active_playlist
  on public.playlists (is_active)
  where is_active = true;

create index if not exists tracks_for_playlist
  on public.tracks (playlist_id, is_enabled, position);

alter table public.playlists enable row level security;
alter table public.tracks enable row level security;

revoke all on table public.playlists from anon, authenticated;
revoke all on table public.tracks from anon, authenticated;
grant select, insert, update, delete on table public.playlists to service_role;
grant select, insert, update, delete on table public.tracks to service_role;

create or replace function public.activate_playlist(target_playlist_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.playlists where id = target_playlist_id) then
    return false;
  end if;

  update public.playlists
    set is_active = (id = target_playlist_id), updated_at = now()
    where is_active = true or id = target_playlist_id;
  return true;
end;
$$;

create or replace function public.reorder_playlist(target_playlist_id uuid, ordered_track_ids uuid[])
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_count integer;
begin
  select count(*) into existing_count from public.tracks where playlist_id = target_playlist_id;
  if existing_count <> cardinality(ordered_track_ids)
    or cardinality(ordered_track_ids) <> (select count(distinct candidate.id) from unnest(ordered_track_ids) as candidate(id))
    or exists (
      select 1 from unnest(ordered_track_ids) as candidate(id)
      where not exists (
        select 1 from public.tracks
        where tracks.id = candidate.id and tracks.playlist_id = target_playlist_id
      )
    ) then
    return false;
  end if;

  update public.tracks set position = position + 1000000 where playlist_id = target_playlist_id;
  update public.tracks
    set position = ordered.position::integer - 1, updated_at = now()
    from unnest(ordered_track_ids) with ordinality as ordered(id, position)
    where tracks.id = ordered.id and tracks.playlist_id = target_playlist_id;
  return true;
end;
$$;

revoke all on function public.activate_playlist(uuid) from public, anon, authenticated;
revoke all on function public.reorder_playlist(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.activate_playlist(uuid) to service_role;
grant execute on function public.reorder_playlist(uuid, uuid[]) to service_role;
