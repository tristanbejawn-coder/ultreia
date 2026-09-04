-- Ultreia · demo walk. A copy of Ju & Jit's road, three days in, so the app
-- can be shown with photographs on the trail before anyone has walked it.
-- Everything it makes is namespaced to slug 'demo'; scripts/wipe-demo.sql
-- removes it in one statement. Photographs are in public/demo, licensed
-- from Wikimedia Commons and credited in the captions.

delete from ultreia_walks where slug = 'demo';

insert into ultreia_walks (slug, code, name, camino, start_node, plan, walkers, starts_on, timezone, avatar_path, owner_email, paid, paid_at)
values (
  'demo', 'DEMO', 'Ju & Jit walk to Santiago', 'portugues', 'porto',
  '["porto-vila-do-conde","vila-do-conde-esposende","esposende-viana","viana-caminha","caminha-boat-a-guarda","a-guarda-a-ramallosa","a-ramallosa-vigo","vigo-redondela","redondela-pontevedra","pontevedra-caldas","caldas-padron","padron-santiago"]'::jsonb,
  '[{"key":"ju","name":"Ju"},{"key":"jit","name":"Jit"}]'::jsonb,
  (current_date - 2), 'Europe/Lisbon', '/walks/ju-and-jit.jpg',
  'tristan.bejawn@gmail.com', true, now()
);

-- Private posting links for the demo walkers (demo tokens; not the real ones).
insert into ultreia_walker_keys (token, walk_id, walker)
select 'demo-ju-' || encode(gen_random_bytes(16), 'hex'), id, 'ju' from ultreia_walks where slug = 'demo';
insert into ultreia_walker_keys (token, walk_id, walker)
select 'demo-jit-' || encode(gen_random_bytes(16), 'hex'), id, 'jit' from ultreia_walks where slug = 'demo';

-- Three days of walking. Day 1 Porto → Vila do Conde (28.5 km), day 2 on to
-- Esposende (52.2), day 3 in progress up the coast towards Viana.
with w as (select id, (current_date - 2)::timestamptz as d1 from ultreia_walks where slug = 'demo')
insert into ultreia_posts (walk_id, walker, kind, caption, taken_at, km, km_source, segment_id, media_path, width, height)
select w.id, v.walker, v.kind, v.caption, w.d1 + v.offset_h * interval '1 hour', v.km, v.src, v.seg, v.path, 1400, 1050
from w, (values
  ('ju',  'photo',  'Seven in the morning at the Sé. Stamp one in the credencial and off. · photo Thomas Dahlstrøm Nielsen, CC BY 4.0',  7.2::numeric,   0.4::numeric,  'exif',   'porto-vila-do-conde',     '/demo/01-porto-se.jpg'),
  ('jit', 'photo',  'Down to the river before the city woke up. · photo Jakub Hałun, CC BY 4.0',                                          7.9,             2.1,           'exif',   'porto-vila-do-conde',     '/demo/02-ribeira.jpg'),
  ('ju',  'photo',  'Out of the city and onto the sea. The lighthouse at Boa Nova, and the wind arrived with it. · photo Vitor Oliveira, CC BY-SA 2.0', 10.6, 11.5, 'exif', 'porto-vila-do-conde', '/demo/03-boa-nova.jpg'),
  ('jit', 'photo',  'Twenty-eight kilometres and this at the end of them. Nine hundred arches, apparently. · photo Nmmacedo, CC BY-SA 3.0', 17.1,          27.8,          'exif',   'porto-vila-do-conde',     '/demo/04-aqueduto.jpg'),
  ('ju',  'checkin','Vila do Conde. Feet up, sardines, bed.',                                                                             17.8,           28.5,          'checkin','porto-vila-do-conde',     null),
  ('jit', 'photo',  'Boardwalks the whole morning. You can hear it before you see it. · photo Francisco Restivo, CC BY 2.0',              33.4,           33.0,          'exif',   'vila-do-conde-esposende', '/demo/05-povoa.jpg'),
  ('ju',  'photo',  'Windmills above Apúlia. They used to gather seaweed off this beach with ox carts. · photo Pedro, public domain',      36.3,           41.5,          'exif',   'vila-do-conde-esposende', '/demo/06-apulia.jpg'),
  ('jit', 'photo',  'The Cávado at Esposende. Jit swam; Ju watched. · photo AJSL48, CC BY-SA 4.0',                                         40.7,           51.0,          'exif',   'vila-do-conde-esposende', '/demo/07-ofir.jpg'),
  ('ju',  'checkin','Esposende. Fifty-two kilometres in, and nothing has fallen off yet.',                                                 41.3,           52.2,          'checkin','vila-do-conde-esposende', null),
  ('jit', 'photo',  'Third morning. Viana somewhere up there past the mouth of the Lima. · photo Vitor Oliveira, CC BY-SA 2.0',            57.9,           61.0,          'exif',   'esposende-viana',         '/demo/08-coast.jpg'),
  ('ju',  'ping',   null,                                                                                                                 61.2,           66.4,          'device', 'esposende-viana',         null)
) as v(walker, kind, caption, offset_h, km, src, seg, path);

-- The family, writing in. Two days delivered, tonight's still waiting.
with w as (select id, (current_date - 2)::timestamptz as d1 from ultreia_walks where slug = 'demo')
insert into ultreia_messages (walk_id, from_name, body, written_at, delivered_at)
select w.id, v.from_name, v.body, w.d1 + v.offset_h * interval '1 hour',
       case when v.delivered then w.d1 + (floor(v.offset_h / 24) * 24 + 19) * interval '1 hour' else null end
from w, (values
  ('Mum',       'Off you go then. Ring when you get there, or don''t, but eat something.', 8.0::numeric,  true),
  ('Alex',      'Twenty-eight kilometres on day one is showing off.',                      18.4,          true),
  ('Nana Pat',  'I have looked at this map four times today.',                             20.1,          true),
  ('Sam & Ro',  'The aqueduct photo is unreal. More of those please.',                     34.0,          true),
  ('Alex',      'Jit swimming in September. Of course.',                                   43.0,          true),
  ('Mum',       'Weather says rain Thursday. Take the good socks.',                        58.2,          false),
  ('Tom',       'Following every step from a desk in Leeds. Buen Camino both.',            62.0,          false)
) as v(from_name, body, offset_h, delivered);

-- A few reactions, so the pictures page isn't silent.
insert into ultreia_reactions (post_id, from_name, emoji)
select p.id, n.who, n.emoji
from ultreia_posts p
join ultreia_walks w on w.id = p.walk_id and w.slug = 'demo'
join (values ('Mum','❤️'), ('Alex','👏'), ('Nana Pat','❤️')) as n(who, emoji) on true
where p.media_path is not null
on conflict do nothing;
