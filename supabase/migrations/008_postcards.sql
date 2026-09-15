-- Ultreia · 008 · the post becomes postcards.
--
-- A message from home is a postcard: written with a place it came from, and
-- franked when it goes out with where the walkers were at 19:00. A sealed
-- note is the same row with private = true: the walkers get it in the
-- evening's post and the family page never lists it.
alter table ultreia_messages add column if not exists private    boolean not null default false;
alter table ultreia_messages add column if not exists from_place text;
alter table ultreia_messages add column if not exists at_km      numeric;
alter table ultreia_messages add column if not exists at_place   text;

-- The family's wall reads the public ones, newest first.
create index if not exists messages_walk_public on ultreia_messages(walk_id, written_at desc)
  where deleted_at is null and private = false;
