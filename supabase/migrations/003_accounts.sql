-- Ultreia · 003 · accounts. A pilgrim signs in by email link; the walkers
-- on the road keep their private posting links, which need no account.

create table if not exists ultreia_login_tokens (
  token       text primary key,
  email       text not null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  used_at     timestamptz
);
create index if not exists ultreia_login_tokens_email on ultreia_login_tokens(email, created_at desc);

create table if not exists ultreia_sessions (
  token       text primary key,
  email       text not null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  last_seen   timestamptz not null default now()
);
create index if not exists ultreia_sessions_email on ultreia_sessions(email);

create index if not exists ultreia_walks_owner on ultreia_walks(lower(owner_email));

alter table ultreia_login_tokens enable row level security;
alter table ultreia_sessions     enable row level security;
