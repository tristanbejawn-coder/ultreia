-- Ultreia · 002 · the first walk. Edit names/dates, run once.
-- Walker tokens: replace with long random strings before running
-- (e.g. `openssl rand -hex 24`). They ARE the private posting links.

insert into walks (slug, name, camino, start_node, plan, walkers, starts_on, avatar_path)
values (
  'ju-and-jit',
  'Ju & Jit walk to Santiago',
  'portugues',
  'porto',
  -- Default plan: the full Coastal. Forks at Caminha and Pontevedra can
  -- change this as they go, from the posting screen.
  '["porto-vila-do-conde","vila-do-conde-esposende","esposende-viana","viana-caminha","caminha-boat-a-guarda","a-guarda-a-ramallosa","a-ramallosa-vigo","vigo-redondela","redondela-pontevedra","pontevedra-caldas","caldas-padron","padron-santiago"]',
  '[{"key":"ju","name":"Ju"},{"key":"jit","name":"Jit"}]',
  '2026-09-10',
  '/walks/ju-and-jit.jpg'
)
on conflict (slug) do nothing;

insert into walker_keys (token, walk_id, walker)
select 'REPLACE-WITH-RANDOM-TOKEN-JU',  id, 'ju'  from walks where slug = 'ju-and-jit'
on conflict do nothing;
insert into walker_keys (token, walk_id, walker)
select 'REPLACE-WITH-RANDOM-TOKEN-JIT', id, 'jit' from walks where slug = 'ju-and-jit'
on conflict do nothing;
