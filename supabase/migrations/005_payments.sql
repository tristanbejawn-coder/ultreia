-- Ultreia · 005 · payment. A walk is created as a draft and goes live when
-- Stripe says it's paid. Ju & Jit's walk was marked paid by hand.
alter table ultreia_walks add column if not exists stripe_session_id text;
alter table ultreia_walks add column if not exists paid_at timestamptz;
