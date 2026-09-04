# Ultreia

Follow a Camino walk from home. A satellite route with the walked trail in gold,
geotagged photos and video diary posted from the road, and a message wall that
reaches the walkers once a day.

The first walk is Ju & Jit, Porto → Santiago on the Camino Portugués, from
10 September 2026. Lives at https://ultreia.bejawn.studio.

## Run

    npm install
    cp .env.example .env.local   # fill in Supabase; leave blank for a no-database preview
    npm run dev

Without a database the site renders the route and countdown with no posts.

## Set up

1. Supabase → new project → SQL editor → run `supabase/migrations/001_init.sql`,
   then edit and run `002_seed_ju_jit.sql` (replace the two tokens with
   `openssl rand -hex 24` output; those become the private posting links
   `/go/<token>`).
2. Netlify → environment: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
3. Route geometry: `npm run route:build` regenerates `src/data/segments/index.json`
   from OpenStreetMap (© OpenStreetMap contributors, ODbL). The committed file
   is what ships; the script only needs running when the catalogue changes.

## Shape

- `src/data/caminos.ts` — the catalogue: places, segments, forks, routes.
- `src/lib/route.ts` — plan → polyline with kilometres; snap a point onto it.
- `src/lib/walk.ts` — a walk's state (position, posts, messages) for the pages.
- `src/app/w/[slug]` — a walk's public pages (route, pictures, post). `/` is the default walk.
- `src/app/go/[token]` — the walkers' private screen: post, check in, choose a fork.
- `supabase/migrations` — schema; every table hangs off `walks`.
