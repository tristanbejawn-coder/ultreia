-- A picture can now be placed by when it was taken, from the walk's own
-- track, for the very common case of a phone that strips the location out
-- of a photograph before the browser ever sees it.
alter table ultreia_posts drop constraint if exists ultreia_posts_km_source_check;
alter table ultreia_posts add constraint ultreia_posts_km_source_check
  check (km_source in ('exif','device','checkin','manual','tracker','time'));
