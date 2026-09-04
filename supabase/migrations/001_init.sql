-- Ultreia · 001 · everything is per walk from the first migration.
-- Run in the Supabase SQL editor. Additive; safe to re-run pieces.

create extension if not exists pgcrypto;

-- One row per journey. Ju & Jit's walk is row one.
create table if not exists walks (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,            -- public URL: /w/{slug}; the first walk also answers at /
  name          text not null,                   -- "Ju & Jit walk to Santiago"
  camino        text not null,                   -- catalogue id, e.g. 'portugues'
  start_node    text not null,                   -- catalogue node id, e.g. 'porto'
  plan          jsonb not null default '[]',     -- ordered segment ids: the default route; forks override it
  walkers       jsonb not null default '[]',     -- [{ key: 'ju', name: 'Ju' }, ...]
  starts_on     date,
  timezone      text not null default 'Europe/Lisbon',
  digest_hour   int  not null default 19,        -- when the day's messages are bundled
  avatar_path   text,                            -- the walkers' picture: a storage path or a /public path
  owner_email   text,                            -- sign-in (magic link) for the product later
  paid          boolean not null default false,
  created_at    timestamptz not null default now()
);

-- A choice made at a fork, as they go. Latest per fork wins.
create table if not exists route_choices (
  id          uuid primary key default gen_random_uuid(),
  walk_id     uuid not null references walks(id) on delete cascade,
  fork_id     text not null,
  segment_id  text not null,
  chosen_by   text,
  chosen_at   timestamptz not null default now()
);
create index if not exists route_choices_walk on route_choices(walk_id, fork_id, chosen_at desc);

-- Private posting links: one long token per walker.
create table if not exists walker_keys (
  token       text primary key,
  walk_id     uuid not null references walks(id) on delete cascade,
  walker      text not null,                     -- matches walks.walkers[].key
  created_at  timestamptz not null default now()
);

-- Photo, clip, diary, note or check-in. Position is derived from these.
create table if not exists posts (
  id          uuid primary key default gen_random_uuid(),
  walk_id     uuid not null references walks(id) on delete cascade,
  walker      text not null,
  kind        text not null check (kind in ('photo','clip','diary','note','checkin','ping')),
  caption     text,
  taken_at    timestamptz not null default now(),
  lat         double precision,
  lng         double precision,
  km          double precision,                  -- snapped to the walk's route
  km_source   text check (km_source in ('exif','device','checkin','manual','tracker')),
  segment_id  text,
  media_path  text,                              -- storage object path (photos) or Stream uid (video)
  poster_path text,
  width       int,
  height      int,
  duration_s  int,
  transcript  text,
  deleted_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists posts_walk_time on posts(walk_id, taken_at desc) where deleted_at is null;

-- Followers' messages, bundled to the walkers once a day.
create table if not exists messages (
  id            uuid primary key default gen_random_uuid(),
  walk_id       uuid not null references walks(id) on delete cascade,
  from_name     text not null,
  body          text not null check (char_length(body) <= 600),
  written_at    timestamptz not null default now(),
  delivered_at  timestamptz,
  deleted_at    timestamptz
);
create index if not exists messages_walk on messages(walk_id, written_at desc);

-- One reaction per person per post.
create table if not exists reactions (
  post_id     uuid not null references posts(id) on delete cascade,
  from_name   text not null,
  emoji       text not null,
  created_at  timestamptz not null default now(),
  primary key (post_id, from_name)
);

-- Web push. role: 'follower' (stage completed) or 'walker' (evening bundle).
create table if not exists push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  walk_id     uuid not null references walks(id) on delete cascade,
  role        text not null check (role in ('follower','walker')),
  endpoint    text unique not null,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);

-- Nothing is readable with the anon key; the app talks to the DB with the
-- service role from server routes only. RLS on, no policies = locked.
alter table walks             enable row level security;
alter table route_choices     enable row level security;
alter table walker_keys       enable row level security;
alter table posts             enable row level security;
alter table messages          enable row level security;
alter table reactions         enable row level security;
alter table push_subscriptions enable row level security;

-- Public media bucket (photos, posters). Objects are unguessable uuid paths.
insert into storage.buckets (id, name, public)
  values ('media', 'media', true)
  on conflict (id) do nothing;
