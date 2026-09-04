# Ultreia · route film — brief for a Higgsfield render

A 60–90 second flyover of Ju & Jit's Camino in the register of a Tour de
France stage presentation: the camera rides the route over 3D terrain, a
gold line draws itself along the coast, and the facts of each stage land
as overlays. Ends on the Praza do Obradoiro.

Higgsfield is not connected to the build session, so this is the pack a
fork needs: shot list, overlay spec, per-stage facts, and the assets the
app can export. Two ways to make it:

- **Higgsfield image-to-video** from stills exported from the app's map
  (satellite + terrain + gold trail) — closest to the real route.
- **In-app flyover** — the same camera moves built into the Route page
  with MapLibre (terrain is already on). No render pipeline, always
  current, and it can play the *actual* walked line at any point during
  the walk. Recommended fallback if the render fights back.

## Tone

Broadcast graphics, not a travel vlog. Dark ground, one gold line, a
compressed display face for names and numbers, mono for facts, no music
stings on every overlay. Think the TdF "parcours" segment, slowed down
by a third. Nothing spins. Camera always moves along the route or
pushes in on a town; never orbits for its own sake.

## Overlay spec

- Type: Archivo (width 62, weight 900, uppercase) for stage names and
  the big kilometre number; DM Mono for labels and facts; Source Serif 4
  only for the one-line "character" of a stage.
- Colours: ground #0E1418; line #F0B429 with a soft glow; labels #E4E7E4;
  secondary #9BA5AD; stat accent #F0B429.
- Lower third: stage number and towns left; a mono fact stack right
  (distance · ascent · a surface note). Enters left-to-right on the line,
  holds 3 s, exits up.
- Stage profile: a small elevation card (like the TdF profile) slides up
  under the lower third for the two real climbs (stage 4's hill before
  Viana; the Galician hills around Redondela/Pontevedra).
- Their photo tile appears once, at the start, on Porto; the gold line
  begins from it.

## Shot list (the Coastal, 12 stages)

| # | Shot | Camera | Overlay | Secs |
|---|------|--------|---------|------|
| 0 | Title | Slow push on Porto cathedral from above, dawn | ULTREIA · Ju & Jit · Porto → Santiago · 274 km · 12 stages | 5 |
| 1 | Porto → Vila do Conde | Ride the Douro west to the sea, then north over the boardwalks | 28.5 km · flat · boardwalks and beaches | 7 |
| 2 | Vila do Conde → Esposende | Low pass over dunes and pine | 23.7 km · flat · dunes, pine | 5 |
| 3 | Esposende → Viana do Castelo | Rise inland over villages, one hill, drop to the Lima bridge | 26.3 km · 350 m ascent · the Lima bridge | 7 |
| 4 | Viana → Caminha | Cliff-path pass; the Minho estuary opens | 26.6 km · 300 m · cliffs, fishing villages | 6 |
| 5 | The Minho | Hold over the estuary; the tender crosses; title card FORK | Boat to A Guarda / river to Valença | 5 |
| 6 | A Guarda → A Ramallosa | Long Atlantic edge past Oia monastery | 32 km · 400 m · the Atlantic edge, often split at Oia | 7 |
| 7 | A Ramallosa → Vigo | Ría de Vigo, Baiona a beat off-route | 24 km · the ría | 5 |
| 8 | Vigo → Redondela | Senda da Auga above the water | 15 km · 250 m · green and short | 4 |
| 9 | Redondela → Pontevedra | Ponte Sampaio, stony climb, old town | 19.5 km · 300 m · Ponte Sampaio | 5 |
| 10 | The second fork | Hold over Pontevedra; two lines glow: Caldas or the Espiritual | Straight on 2 days / Variante Espiritual 3 days + boat | 5 |
| 11 | Pontevedra → Caldas → Padrón | Vineyards and river | 21 + 18.5 km · gentle | 6 |
| 12 | Padrón → Santiago | Eucalyptus, suburbs, then the towers | 24.5 km · 350 m · the bells | 7 |
| 13 | Arrival | Rise over the Obradoiro; the whole gold line completes | ULTREIA · 274 km · they made it | 8 |

Total ≈ 82 s. Stages 6–9 can compress to a single 10 s pass if it runs long.

## Stage facts (Coastal, as in the app's catalogue)

| Stage | From → To | km | Ascent | Character |
|---|---|---|---|---|
| 1 | Porto → Vila do Conde | 28.5 | — | Down the Douro to the sea, then boardwalks and beaches all the way; flat, long, exposed |
| 2 | Vila do Conde → Esposende | 23.7 | — | Beach, then dunes and pine; flat |
| 3 | Esposende → Viana do Castelo | 26.3 | 350 m | Inland through villages, one real hill, then the Lima bridge |
| 4 | Viana do Castelo → Caminha | 26.6 | 300 m | Cliff paths and fishing villages; the Minho appears |
| — | Caminha → A Guarda | boat | — | A small boat over the Minho; tide and weather decide |
| 5 | A Guarda → A Ramallosa | 32 | 400 m | Atlantic edge past Oia monastery; long, wild, often split at Oia |
| 6 | A Ramallosa → Vigo | 24 | — | Ría de Vigo; suburbs, then the city |
| 7 | Vigo → Redondela | 15 | 250 m | The Senda da Auga above the ría; short and green |
| 8 | Redondela → Pontevedra | 19.5 | 300 m | The Ponte Sampaio and a stony climb; the old town at the end |
| 9 | Pontevedra → Caldas de Reis | 21 | — | Vineyards and river; gentle |
| 10 | Caldas → Padrón | 18.5 | — | Forest tracks; Padrón peppers at the end |
| 11 | Padrón → Santiago | 24.5 | 350 m | Eucalyptus, then suburbs, then the bells |

Ascent figures are indicative guidebook values; the app can export exact
profiles per stage from the terrain tiles once that feature ships.

## Assets the app can hand over

- `src/data/segments/index.json` — the route as coordinates with
  cumulative km (© OpenStreetMap contributors, ODbL: credit it).
- Map stills: once deployed, the Route page at `?film=1` (to build) can
  freeze the camera at each shot's position for a clean 1920×1080
  export with imagery, terrain and the gold line. Until then, the
  Playwright screenshot script in the repo captures the current view.
- `public/walks/ju-and-jit-640.jpg` — their tile.
- `public/icons/icon.svg` — the scallop.
- Type: Archivo, DM Mono, Source Serif 4 (Google Fonts).

## Prompts (starting points for image-to-video)

Use one still per shot as the reference and keep the prompt about
motion, not content:

> Slow aerial flyover along a coastline at golden hour, camera gliding
> north following a glowing gold path over satellite terrain, subtle 3D
> relief, cinematic, steady, no camera shake, no people, no text.

> Gentle push-in from above onto a granite cathedral square at dawn,
> long shadows, soft haze, camera settles and holds.

Overlays are composited afterwards (After Effects or the in-app
renderer), not generated: generated text is never the right type.
