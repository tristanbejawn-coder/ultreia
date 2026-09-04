// Build src/data/segments/index.json from OpenStreetMap.
//
//   node scripts/build-route.mjs            # fetch + build every segment in SOURCES
//   node scripts/build-route.mjs --offline  # rebuild from cached raw/*.json only
//
// For each catalogue segment we name the OSM hiking relation(s) that carry
// it and the two node coordinates it runs between; the script downloads
// the relation's ways (clipped to a bounding box so the big ones stay
// light), stitches them into one line, and trims it to the closest points
// to the segment's endpoints. Raw downloads are cached in scripts/raw/.
//
// Data © OpenStreetMap contributors, ODbL. https://www.openstreetmap.org/copyright

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(new URL('..', import.meta.url).pathname)
const RAW = path.join(ROOT, 'scripts', 'raw')
const OUT = path.join(ROOT, 'src', 'data', 'segments', 'index.json')
const NODES = JSON.parse(await readFile(path.join(ROOT, 'src', 'data', 'nodes.json'), 'utf8'))
const OFFLINE = process.argv.includes('--offline')
const MIRRORS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass-api.de/api/interpreter',
]
const UA = 'ultreia-route-builder/0.1 (camino walk tracker; contact via github tristanbejawn-coder/ultreia)'

// OSM relation ids (see catalogue notes). bbox = [south, west, north, east]
const COSTA = 6100606, CENTRAL = 12786090, ESPIRITUAL = 6259246   // CENTRAL: 'Caminho Português de Santiago', Coimbra → Santiago
const SOURCES = {
  // Coastal: whole relations (rel-<id>.json) or Costa ways clipped near Porto
  'porto-matosinhos':         { rel: [COSTA, 9044581, 17600329], bbox: [41.13, -8.72, 41.20, -8.58] },
  'matosinhos-vila-do-conde': { rel: [17600329, 18091699] },
  'vila-do-conde-esposende':  { rel: [18091819, 18165121] },
  'esposende-viana':          { rel: [18165121] },
  'viana-caminha':            { rel: [18168169] },
  'a-guarda-a-ramallosa':     { rel: [12786089, 18173128] },
  'a-ramallosa-vigo':         { rel: [12786089, 18173296] },
  'vigo-redondela':           { rel: [12786089] },
  'caminha-valenca':          { rel: [COSTA], bbox: [41.86, -8.86, 42.05, -8.62] },
  'pontevedra-armenteira':    { rel: [ESPIRITUAL] },
  'armenteira-vilanova':      { rel: [ESPIRITUAL] },
  // Central: ways fetched in chunks per country box (see scripts/raw/central-chunks-*)
  'valenca-tui':              { central: 'es' },
  'tui-o-porrino':            { central: 'es' },
  'o-porrino-redondela':      { central: 'es' },
  'redondela-pontevedra':     { central: 'es' },
  'pontevedra-caldas':        { central: 'es' },
  'caldas-padron':            { central: 'es' },
  'padron-santiago':          { central: 'es' },
  'porto-vilarinho':          { central: 'pt' },
  'vilarinho-rates':          { central: 'pt' },
  'rates-barcelos':           { central: 'pt' },
  'barcelos-ponte-de-lima':   { central: 'pt' },
  'ponte-de-lima-rubiaes':    { central: 'pt' },
  'rubiaes-valenca':          { central: 'pt' },
}
const CENTRAL_DIRS = { pt: 'central-chunks-41.10_-8.75_42.06_-8.50', es: 'central-chunks-42.02_-8.75_42.90_-8.40' }

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function overpass(query) {
  let lastErr
  for (let attempt = 0; attempt < 9; attempt++) {
    const url = MIRRORS[attempt % MIRRORS.length]
    try {
      const res = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(query), headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA } })
      const text = await res.text()
      if (text.trimStart().startsWith('{')) return JSON.parse(text)
      lastErr = new Error(`non-JSON from ${url}: ${text.slice(0, 120)}`)
    } catch (e) { lastErr = e }
    await sleep(4000 * (attempt + 1))
  }
  throw lastErr
}

// Members of a relation fetched with `out geom` look like ways with geometry.
function relationWays(data) {
  const out = []
  for (const e of data.elements || []) {
    if (e.type === 'way' && e.geometry) out.push(e)
    if (e.type === 'relation') for (const m of e.members || []) if (m.type === 'way' && m.geometry) out.push({ type: 'way', id: m.ref, geometry: m.geometry })
  }
  return out
}

async function fetchWays(relId, bbox) {
  // Preferred cache: whole relation geometry (small relations)
  const relFile = path.join(RAW, `rel-${relId}.json`)
  if (!bbox && existsSync(relFile)) return relationWays(JSON.parse(await readFile(relFile, 'utf8')))
  const key = `${relId}${bbox ? '_' + bbox.join('_') : ''}`
  const file = path.join(RAW, key + '.json')
  if (existsSync(file)) return relationWays(JSON.parse(await readFile(file, 'utf8')))
  if (OFFLINE) throw new Error(`no cache for ${key}`)
  const clip = bbox ? `(${bbox.join(',')})` : ''
  const q = bbox ? `[out:json][timeout:120];rel(${relId});way(r)${clip};out geom;` : `[out:json][timeout:120];rel(${relId});out geom;`
  const data = await overpass(q)
  await mkdir(RAW, { recursive: true })
  await writeFile(bbox ? file : relFile, JSON.stringify(data))
  await sleep(2500)
  return relationWays(data)
}

async function centralWays(country) {
  const dir = path.join(RAW, CENTRAL_DIRS[country])
  if (!existsSync(dir)) throw new Error(`no Central chunks for ${country} (run scripts/fetch-central.sh)`)
  const { readdir } = await import('node:fs/promises')
  let ways = []
  for (const f of (await readdir(dir)).filter(f => f.endsWith('.json')).sort()) {
    const text = await readFile(path.join(dir, f), 'utf8')
    if (!text.trimStart().startsWith('{')) continue   // a failed download parked here; the fetch script retries it
    ways = ways.concat(relationWays(JSON.parse(text)))
  }
  return ways
}

const keyOf = c => `${c[0].toFixed(6)},${c[1].toFixed(6)}`

// Route relations branch (Litoral and Costa variants share one relation,
// ways connect at interior nodes), so a greedy end-to-end stitch is not
// reliable. Instead: every consecutive coordinate pair in every way is an
// edge of a graph; the segment is the shortest path from the graph node
// nearest `from` to the one nearest `to`.
function stitchOnce(ways, from, to, bridge) {
  const key = c => c[0].toFixed(6) + ',' + c[1].toFixed(6)
  const nodes = new Map()      // key -> [lng,lat]
  const adj = new Map()        // key -> [{k, w}]
  const dist = (a, b) => Math.hypot((a[0] - b[0]) * Math.cos(a[1] * Math.PI / 180), a[1] - b[1])
  // Bridge edges are penalised so they only ever cross a real gap and
  // never undercut the road that is actually mapped.
  const link = (a, b, penalty = 1) => {
    const ka = key(a), kb = key(b)
    if (!nodes.has(ka)) { nodes.set(ka, a); adj.set(ka, []) }
    if (!nodes.has(kb)) { nodes.set(kb, b); adj.set(kb, []) }
    const w = dist(a, b) * penalty
    adj.get(ka).push({ k: kb, w }); adj.get(kb).push({ k: ka, w })
  }
  for (const w of ways) {
    if (!w.geometry || w.geometry.length < 2) continue
    const g = w.geometry.map(p => [p.lon, p.lat])
    for (let i = 1; i < g.length; i++) link(g[i - 1], g[i])
  }
  if (!nodes.size) return []
  // Bridge small gaps between way endpoints (bridges, ferries, a missing
  // way): anything under ~200 m becomes an edge.
  const ends = []
  for (const w of ways) {
    if (!w.geometry || w.geometry.length < 2) continue
    const g = w.geometry; ends.push([g[0].lon, g[0].lat], [g[g.length - 1].lon, g[g.length - 1].lat])
  }
  for (let i = 0; i < ends.length; i++) for (let j = i + 1; j < ends.length; j++) {
    const d = dist(ends[i], ends[j]); if (d > 0 && d < bridge) link(ends[i], ends[j], 8)
  }
  // Connected components; choose the one that comes closest to both towns.
  const comp = new Map(); let nComp = 0
  for (const k0 of nodes.keys()) {
    if (comp.has(k0)) continue
    const id = nComp++; const stack = [k0]; comp.set(k0, id)
    while (stack.length) { const k = stack.pop(); for (const e of adj.get(k)) if (!comp.has(e.k)) { comp.set(e.k, id); stack.push(e.k) } }
  }
  const bestIn = new Array(nComp).fill(null).map(() => ({ src: null, sd: Infinity, dst: null, dd: Infinity }))
  for (const [k, c] of nodes) {
    const b = bestIn[comp.get(k)]
    const df = dist(c, from), dt = dist(c, to)
    if (df < b.sd) { b.sd = df; b.src = k }
    if (dt < b.dd) { b.dd = dt; b.dst = k }
  }
  let pick = bestIn[0]
  for (const b of bestIn) if (b.sd + b.dd < pick.sd + pick.dd) pick = b
  const src = pick.src, dst = pick.dst
  // Dijkstra with a simple binary heap
  const best = new Map([[src, 0]]), prev = new Map()
  const heap = [[0, src]]
  const push = x => { heap.push(x); let i = heap.length - 1; while (i > 0) { const j = (i - 1) >> 1; if (heap[j][0] <= heap[i][0]) break; [heap[i], heap[j]] = [heap[j], heap[i]]; i = j } }
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[i], heap[m]] = [heap[m], heap[i]]; i = m } } return top }
  while (heap.length) {
    const [d, k] = pop()
    if (k === dst) break
    if (d > (best.get(k) ?? Infinity)) continue
    for (const e of adj.get(k)) {
      const nd = d + e.w
      if (nd < (best.get(e.k) ?? Infinity)) { best.set(e.k, nd); prev.set(e.k, k); push([nd, e.k]) }
    }
  }
  if (!best.has(dst)) return []
  const out = []
  for (let k = dst; k; k = prev.get(k)) { out.push(nodes.get(k)); if (k === src) break }
  return out.reverse()
}

// Try tight bridging first; widen only if the line stops well short of a town.
function stitch(ways, from, to) {
  const dist = (a, b) => Math.hypot((a[0] - b[0]) * Math.cos(a[1] * Math.PI / 180), a[1] - b[1])
  let best = [], bestScore = Infinity
  for (const bridge of [0.002, 0.008, 0.02, 0.04]) {
    const line = stitchOnce(ways, from, to, bridge)
    if (line.length < 2) continue
    const score = dist(line[0], from) + dist(line[line.length - 1], to)
    // A wider bridge must buy at least ~1 km of reach, or it is just a shortcut.
    if (score < bestScore - 0.01) { best = line; bestScore = score }
    if (bestScore < 0.02) break
  }
  return best
}

function trim(line, from, to) {
  const dist = (a, b) => Math.hypot((a[0] - b[0]) * Math.cos(a[1] * Math.PI / 180), a[1] - b[1])
  let s = 0, e = line.length - 1, sd = Infinity, ed = Infinity
  line.forEach((p, i) => { const d = dist(p, from); if (d < sd) { sd = d; s = i } })
  line.forEach((p, i) => { const d = dist(p, to); if (d < ed) { ed = d; e = i } })
  if (s > e) [s, e] = [e, s]
  return line.slice(s, e + 1)
}

function lengthKm(line) {
  const R = 6371, toR = d => d * Math.PI / 180
  let km = 0
  for (let i = 1; i < line.length; i++) {
    const [aLng, aLat] = line[i - 1], [bLng, bLat] = line[i]
    const dLat = toR(bLat - aLat), dLng = toR(bLng - aLng)
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(aLat)) * Math.cos(toR(bLat)) * Math.sin(dLng / 2) ** 2
    km += 2 * R * Math.asin(Math.sqrt(h))
  }
  return km
}

// Douglas–Peucker to keep the bundle small (≈10 m tolerance)
function simplify(line, tol = 0.0001) {
  if (line.length < 3) return line
  const sq = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2
  const segDist = (p, a, b) => {
    const l2 = sq(a, b); if (!l2) return sq(p, a)
    let t = ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / l2
    t = Math.max(0, Math.min(1, t))
    return sq(p, [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])])
  }
  const keep = new Array(line.length).fill(false); keep[0] = keep[line.length - 1] = true
  const stack = [[0, line.length - 1]]
  while (stack.length) {
    const [s, e] = stack.pop(); let idx = -1, max = 0
    for (let i = s + 1; i < e; i++) { const d = segDist(line[i], line[s], line[e]); if (d > max) { max = d; idx = i } }
    if (idx > 0 && max > tol * tol) { keep[idx] = true; stack.push([s, idx], [idx, e]) }
  }
  return line.filter((_, i) => keep[i])
}

const existing = existsSync(OUT) ? JSON.parse(await readFile(OUT, 'utf8')) : {}
const out = { ...existing }
// Segment endpoints come from the catalogue ids' from/to; we read them from
// caminos.ts via a tiny regex to avoid a TS loader in this script.
const src = await readFile(path.join(ROOT, 'src', 'data', 'caminos.ts'), 'utf8')
const ends = {}
for (const m of src.matchAll(/id:\s*'([a-z0-9-]+)',\s*from:\s*'([a-z0-9-]+)',\s*to:\s*'([a-z0-9-]+)'/g)) ends[m[1]] = [m[2], m[3]]

for (const [id, spec] of Object.entries(SOURCES)) {
  const [fromId, toId] = ends[id] || []
  const from = NODES[fromId], to = NODES[toId]
  if (!from || !to) { console.warn(`skip ${id}: unknown nodes`); continue }
  try {
    let ways = []
    if (spec.central) ways = await centralWays(spec.central)
    else for (const [i, rel] of spec.rel.entries()) ways = ways.concat(await fetchWays(rel, i === 0 ? spec.bbox : undefined))
    let line = stitch(ways, from, to)
    line = trim(line, from, to)
    if (line.length < 2) { console.warn(`empty ${id}`); continue }
    const km = lengthKm(line)
    const gap = (a, b) => (Math.hypot((a[0] - b[0]) * Math.cos(a[1] * Math.PI / 180), a[1] - b[1]) * 111).toFixed(1)
    const endNote = `ends ${gap(line[0], from)}/${gap(line[line.length - 1], to)} km from towns`
    out[id] = { id, coords: simplify(line).map(c => [+c[0].toFixed(5), +c[1].toFixed(5)]), km: +km.toFixed(2) }
    console.log(`${id.padEnd(26)} ${String(out[id].coords.length).padStart(5)} pts  ${km.toFixed(1).padStart(5)} km   ${endNote}`)
  } catch (e) {
    console.warn(`FAILED ${id}: ${e.message}`)
  }
}
await writeFile(OUT, JSON.stringify(out))
console.log(`wrote ${OUT} (${Object.keys(out).length} segments)`)
