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
2. Netlify → environment: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
   `SUPABASE_STORAGE_BUCKET` (the bucket from migration 001). Ju & Jit's site is
   `jujitcamino` on Netlify, backed by the `ultreia_*` tables in the
   "We Out Here Photos" Supabase project.
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

## The walkers' links, and location

Walkers don't log in. Each has a private link, `/go/<token>`, saved to the
home screen. The tokens are the two rows in `walker_keys` (seeded by
migration 002; make them with `openssl rand -hex 24`). To rotate a leaked
link, insert a new row for that walker and delete the old one.

Where the tile sits on the map comes from, in order of effort:

1. **Photos** — placed from the picture's own location, or the phone's.
2. **"Where we are"** — one tap on the walkers' screen sends the phone's
   position; it becomes a `ping` and moves the tile.
3. **"We're here"** — marks the end of a stage.
4. **Always-on, optional** — the free OwnTracks app in HTTP mode, pointed at
   `https://<site>/api/track/<token>`. It posts in the background; the
   endpoint keeps a ping when they've moved ~300 m or 20 minutes have
   passed, and ignores anything more than 5 km off the route.

Browsers can't track in the background on iPhone; that is why 2 and 4 exist.

## Payments

One-off payment per walk through Stripe Checkout. `STRIPE_SECRET_KEY` should
be a **restricted key** (`rk_`) with only: Checkout Sessions — write,
Webhook Endpoints — write (if the endpoint is created programmatically).
Fulfilment happens in `/api/stripe/webhook` on `checkout.session.completed`
and `checkout.session.async_payment_succeeded`, gated on `payment_status`;
set `STRIPE_WEBHOOK_SECRET` from the endpoint's signing secret. Keys live in
Netlify's environment only; `.githooks/pre-commit` (enable with
`git config core.hooksPath .githooks`) refuses a commit containing one.
