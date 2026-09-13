-- Their own scrapbook: a photo the walkers keep between themselves.
-- Everything posted before this was meant for the family, so false is the
-- only sensible default.
alter table ultreia_posts add column if not exists private boolean not null default false;

-- The family's page reads the public ones only, and that is the hot query.
create index if not exists posts_walk_public on ultreia_posts(walk_id, taken_at desc)
  where deleted_at is null and private = false;
