// Put the sample walk into a real database, as a real walk on its own slug.
//
//   node scripts/seed-demo.mjs                     # create/refresh /w/demo-full
//   node scripts/seed-demo.mjs --slug sales-demo   # a second one, any slug
//   node scripts/seed-demo.mjs --starts-on 2026-09-10
//   node scripts/seed-demo.mjs --dry-run           # print a summary, write nothing
//   node scripts/seed-demo.mjs --sql               # print SQL for the editor
//   node scripts/seed-demo.mjs --delete            # remove it again
//
// Not to be confused with scripts/seed-demo.sql, which seeds a different,
// shorter demo walk at slug 'demo' from real licensed photographs. This one
// is the six-day version and lives at 'demo-full'; the two coexist.
//
// Why this exists: src/lib/demo.ts only renders when Supabase is absent, and
// that switch is site-wide. Once the env vars are set — as they are on
// Netlify — nothing can be shown without real rows. This writes them, next to
// the live walk rather than instead of it, so Ju & Jit's own walk is untouched.
//
// Re-running refreshes the dates, so the demo never goes stale: it always
// reads as a walk that set off `daysIn` days ago. Posts and messages are
// deleted and rewritten each time; reactions cascade with their posts.
//
// Content comes from src/data/sample-walk.json, the same file the no-database
// fallback reads. Pictures are served from public/demo/sample — media_path values
// beginning with "/" are passed through untouched by publicUrl() in
// src/lib/db.ts, so nothing needs uploading to Storage. They do have to be in
// the deployed build.

import { readFile } from 'node:fs/promises'
import { createHash, randomBytes } from 'node:crypto'
import path from 'node:path'

const ROOT = path.resolve(new URL('..', import.meta.url).pathname)

const args = process.argv.slice(2)
const flag = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback
}
const has = name => args.includes(`--${name}`)

const SLUG = flag('slug', 'demo-full')
const NAME = flag('name', 'Ju & Jit walk to Santiago (six-day sample)')
const CODE = flag('code', 'FULL')
const DRY = has('dry-run')
const SQL = has('sql')
const DELETE = has('delete')

// ---- environment ------------------------------------------------------

// .env.local is what `npm run dev` reads; take the same values so the script
// and the app can never point at different projects.
async function loadEnv() {
  for (const file of ['.env.local', '.env']) {
    try {
      const text = await readFile(path.join(ROOT, file), 'utf8')
      for (const line of text.split('\n')) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
      }
    } catch { /* no such file: fall back to the real environment */ }
  }
}
await loadEnv()

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// --dry-run needs no credentials, so it can be run anywhere to check the
// figures before anything touches a database.
function requireEnv() {
  if (URL_BASE && SERVICE_KEY) return
  console.error('Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (in .env.local or the environment).')
  process.exit(1)
}

const headers = (extra = {}) => ({ apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, ...extra })

async function rest(method, pathAndQuery, { body, prefer } = {}) {
  const res = await fetch(`${URL_BASE}/rest/v1/${pathAndQuery}`, {
    method,
    headers: headers({ ...(body ? { 'Content-Type': 'application/json' } : {}), ...(prefer ? { Prefer: prefer } : {}) }),
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`${method} ${pathAndQuery}: ${res.status} ${await res.text()}`)
  const text = await res.text()
  return text ? JSON.parse(text) : []
}

// ---- the walk's kilometres -------------------------------------------

// buildRoute scales OSM geometry to the catalogue's published km, so a
// segment's length on the map is exactly its `km:` in caminos.ts and the
// cumulative figures here match what the app draws. Read them with a regex
// rather than a TS loader, the same way scripts/build-route.mjs does.
const caminosSrc = await readFile(path.join(ROOT, 'src', 'data', 'caminos.ts'), 'utf8')
const SEGMENT_KM = {}
for (const m of caminosSrc.matchAll(/id:\s*'([a-z0-9-]+)',\s+from:\s*'[a-z0-9-]+',\s+to:\s*'[a-z0-9-]+',\s+km:\s*([\d.]+)/g)) {
  SEGMENT_KM[m[1]] = Number(m[2])
}

const sample = JSON.parse(await readFile(path.join(ROOT, 'src', 'data', 'sample-walk.json'), 'utf8'))

const missing = sample.plan.filter(id => SEGMENT_KM[id] === undefined)
if (missing.length) {
  console.error(`caminos.ts has no km for: ${missing.join(', ')}`)
  process.exit(1)
}

// Cumulative start km for every stage in the plan.
const STAGE = {}
let running = 0
for (const id of sample.plan) {
  STAGE[id] = { km: running, endKm: running + SEGMENT_KM[id] }
  running += SEGMENT_KM[id]
}
const TOTAL_KM = running

// ---- dates ------------------------------------------------------------

function plusDays(ymd, days) {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}
const todayLisbon = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(new Date())
const STARTS_ON = flag('starts-on', plusDays(todayLisbon, -sample.daysIn))
// Portugal and Galicia are both +01:00 through the walking season.
const stamp = (day, time) => `${plusDays(STARTS_ON, day)}T${time}:00+01:00`

// Stable ids, so a re-run rewrites the same rows rather than accumulating.
function uuidFor(kind, id) {
  const h = createHash('sha1').update(`ultreia:${SLUG}:${kind}:${id}`).digest('hex')
  // Shape the digest into a v5-looking uuid; uniqueness is all we need.
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`
}

// ---- rows -------------------------------------------------------------

const walkRow = {
  slug: SLUG,
  name: NAME,
  camino: sample.camino,
  start_node: sample.startNode,
  plan: sample.plan,
  walkers: sample.walkers,
  starts_on: STARTS_ON,
  timezone: 'Europe/Lisbon',
  digest_hour: 19,
  avatar_path: '/walks/ju-and-jit.jpg',
  // getWalk() returns null for an unpaid walk, so the page would 404 without this.
  paid: true,
}

function postRows(walkId) {
  return sample.posts.map(s => {
    const stage = STAGE[s.segment]
    return {
      id: uuidFor('post', s.id),
      walk_id: walkId,
      walker: s.walker,
      kind: s.kind,
      caption: s.caption ?? null,
      taken_at: stamp(s.day, s.time),
      km: +(stage.km + (stage.endKm - stage.km) * s.at).toFixed(2),
      km_source: s.kind === 'checkin' ? 'checkin' : 'exif',
      segment_id: s.segment,
      // A path starting with "/" is served from public/, not from Storage.
      media_path: s.file ? `${sample.mediaDir}/${s.file}` : null,
      width: s.w ?? null,
      height: s.h ?? null,
    }
  })
}

// The schema allows one reaction per person per post — primary key
// (post_id, from_name) — so a count of nine hearts is nine rows, and the
// names have to be unique across every emoji on that post, not just within
// one. Names are never rendered, only the totals are, so they are
// deliberately obvious and greppable if they ever need removing.
function reactionRows() {
  const rows = []
  for (const s of sample.posts) {
    let n = 0
    for (const [emoji, count] of Object.entries(s.reactions || {})) {
      for (let i = 0; i < count; i++) {
        rows.push({ post_id: uuidFor('post', s.id), from_name: `sample-${++n}`, emoji })
      }
    }
  }
  return rows
}

function messageRows(walkId) {
  return sample.messages.map(m => ({
    id: uuidFor('message', m.id),
    walk_id: walkId,
    from_name: m.from,
    body: m.body,
    written_at: stamp(m.day, m.time),
    delivered_at: m.delivered ? stamp(m.day, '19:00') : null,
  }))
}

// ---- SQL ---------------------------------------------------------------

// The same rows, as statements for the Supabase SQL editor — the way the
// migrations in this repo are run. Useful when the service key isn't to hand.
const q = v => v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`
const n = v => v === null || v === undefined ? 'null' : String(v)

function toSql() {
  const walkId = uuidFor('walk', SLUG)
  const L = []
  L.push(`-- Ultreia · ${SLUG}. Generated by scripts/seed-demo.mjs --sql on ${new Date().toISOString().slice(0, 10)}.`)
  L.push(`-- Idempotent: re-running replaces this walk and nothing else.`)
  L.push(`delete from ultreia_walks where slug = ${q(SLUG)};`)
  L.push('')
  L.push(`insert into ultreia_walks (id, slug, code, name, camino, start_node, plan, walkers, starts_on, timezone, digest_hour, avatar_path, paid, paid_at) values (`)
  L.push(`  ${q(walkId)}, ${q(SLUG)}, ${q(CODE)}, ${q(NAME)}, ${q(sample.camino)}, ${q(sample.startNode)},`)
  L.push(`  ${q(JSON.stringify(sample.plan))}::jsonb, ${q(JSON.stringify(sample.walkers))}::jsonb,`)
  L.push(`  ${q(STARTS_ON)}, 'Europe/Lisbon', 19, ${q(walkRow.avatar_path)}, true, now());`)
  L.push('')
  L.push('insert into ultreia_posts (id, walk_id, walker, kind, caption, taken_at, km, km_source, segment_id, media_path, width, height) values')
  L.push(postRows(walkId).map(r =>
    `  (${q(r.id)}, ${q(walkId)}, ${q(r.walker)}, ${q(r.kind)}, ${q(r.caption)}, ${q(r.taken_at)}, ${n(r.km)}, ${q(r.km_source)}, ${q(r.segment_id)}, ${q(r.media_path)}, ${n(r.width)}, ${n(r.height)})`
  ).join(',\n') + ';')
  L.push('')
  // One row per reaction would be ~200 lines of literals. Expand the counts
  // with generate_series instead, so the file stays pasteable.
  const groups = []
  for (const s2 of sample.posts) {
    let n = 0
    for (const [emoji, count] of Object.entries(s2.reactions || {})) {
      groups.push({ pid: uuidFor('post', s2.id), emoji, count, first: n + 1 })
      n += count
    }
  }
  L.push('insert into ultreia_reactions (post_id, from_name, emoji)')
  L.push(`select v.pid::uuid, 'sample-' || (v.first + g - 1), v.emoji`)
  L.push('from (values')
  L.push(groups.map(g2 => `  (${q(g2.pid)}, ${q(g2.emoji)}, ${g2.count}, ${g2.first})`).join(',\n'))
  L.push(') as v(pid, emoji, cnt, first), lateral generate_series(1, v.cnt) g;')
  L.push('')
  L.push('insert into ultreia_messages (id, walk_id, from_name, body, written_at, delivered_at) values')
  L.push(messageRows(walkId).map(r =>
    `  (${q(r.id)}, ${q(walkId)}, ${q(r.from_name)}, ${q(r.body)}, ${q(r.written_at)}, ${r.delivered_at ? q(r.delivered_at) : 'null'})`
  ).join(',\n') + ';')
  L.push('')
  L.push('-- Private posting links. Tokens are random per generation; keep the output.')
  for (const w of sample.walkers) {
    L.push(`insert into ultreia_walker_keys (token, walk_id, walker) values (${q(randomBytes(24).toString('hex'))}, ${q(walkId)}, ${q(w.key)});`)
  }
  return L.join('\n')
}

// ---- run --------------------------------------------------------------

if (DELETE) {
  if (DRY) { console.log(`would delete walk "${SLUG}" and everything hanging off it`); process.exit(0) }
  requireEnv()
  const existing = await rest('GET', `ultreia_walks?slug=eq.${encodeURIComponent(SLUG)}&select=id,slug,name`)
  if (!existing[0]) { console.log(`No walk "${SLUG}" to delete.`); process.exit(0) }
  // posts, messages, walker_keys and route_choices all cascade from walks.
  await rest('DELETE', `ultreia_walks?id=eq.${existing[0].id}`, { prefer: 'return=minimal' })
  console.log(`Deleted ${SLUG}.`)
  process.exit(0)
}

const position = (() => {
  let km = 0
  for (const s of sample.posts) {
    const stage = STAGE[s.segment]
    km = Math.max(km, stage.km + (stage.endKm - stage.km) * s.at)
  }
  return km
})()

console.log(`walk       ${SLUG} · "${NAME}" · code ${CODE}`)
console.log(`starts     ${STARTS_ON} (day ${sample.daysIn + 1} today)`)
console.log(`position   ${position.toFixed(1)} km of ${TOTAL_KM.toFixed(1)}`)
console.log(`rows       ${sample.posts.length} posts · ${reactionRows().length} reactions · ${sample.messages.length} messages`)
console.log(`pictures   ${sample.posts.filter(p => p.file).length} from public${sample.mediaDir}`)

if (SQL) { console.log('\n' + toSql()); process.exit(0) }

if (DRY) {
  console.log('\n--dry-run: nothing written.')
  process.exit(0)
}
requireEnv()

// The walk itself. on_conflict=slug so a re-run updates rather than duplicates.
await rest('POST', 'ultreia_walks?on_conflict=slug', {
  body: walkRow,
  prefer: 'resolution=merge-duplicates,return=minimal',
})
const [walk] = await rest('GET', `ultreia_walks?slug=eq.${encodeURIComponent(SLUG)}&select=id`)
if (!walk) throw new Error('walk did not come back after upsert')

// The code is a separate statement because the unique index is on upper(code)
// and a merge-duplicates upsert can collide with another walk's code.
try {
  await rest('PATCH', `ultreia_walks?id=eq.${walk.id}`, { body: { code: CODE }, prefer: 'return=minimal' })
} catch (e) {
  console.warn(`code ${CODE} not set (probably taken): ${e.message}`)
}

// Wipe and rewrite, so a re-run rolls the dates forward instead of stacking
// a second copy of the walk on top of the first.
await rest('DELETE', `ultreia_posts?walk_id=eq.${walk.id}`, { prefer: 'return=minimal' })
await rest('DELETE', `ultreia_messages?walk_id=eq.${walk.id}`, { prefer: 'return=minimal' })

await rest('POST', 'ultreia_posts', { body: postRows(walk.id), prefer: 'return=minimal' })
await rest('POST', 'ultreia_reactions?on_conflict=post_id,from_name', {
  body: reactionRows(),
  prefer: 'resolution=merge-duplicates,return=minimal',
})
await rest('POST', 'ultreia_messages', { body: messageRows(walk.id), prefer: 'return=minimal' })

// Private posting links, so the walkers' screen can be shown too. Existing
// ones are kept: re-running the seeder shouldn't invalidate a link already
// saved to somebody's home screen.
const keys = await rest('GET', `ultreia_walker_keys?walk_id=eq.${walk.id}&select=token,walker`)
const fresh = []
for (const w of sample.walkers) {
  if (keys.some(k => k.walker === w.key)) continue
  const token = randomBytes(24).toString('hex')
  await rest('POST', 'ultreia_walker_keys', { body: { token, walk_id: walk.id, walker: w.key }, prefer: 'return=minimal' })
  fresh.push({ walker: w.key, token })
}

const site = (process.env.URL || process.env.SITE_URL || 'http://localhost:3000').replace(/\/$/, '')
console.log(`\nSeeded.`)
console.log(`  public   ${site}/w/${SLUG}`)
console.log(`  pictures ${site}/w/${SLUG}/pictures`)
console.log(`  wall     ${site}/w/${SLUG}/post`)
for (const k of [...keys, ...fresh]) console.log(`  ${k.walker.padEnd(8)} ${site}/go/${k.token}`)
if (fresh.length) console.log(`\n  (those posting links are new; the existing ones were left alone)`)
