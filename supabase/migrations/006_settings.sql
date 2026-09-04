-- Ultreia · 006 · server-side settings. Holds the Stripe webhook signing
-- secret when the endpoint is registered from the app rather than pasted
-- into the environment. Service role only; never read from a client.
create table if not exists ultreia_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table ultreia_settings enable row level security;
