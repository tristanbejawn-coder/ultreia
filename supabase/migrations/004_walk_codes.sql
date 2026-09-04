-- Ultreia · 004 · a short code a viewer can type on the front door instead
-- of a link. Letters and digits, case-insensitive, unique.
alter table ultreia_walks add column if not exists code text;
create unique index if not exists ultreia_walks_code on ultreia_walks(upper(code));
update ultreia_walks set code = 'JUJIT' where slug = 'ju-and-jit' and code is null;
