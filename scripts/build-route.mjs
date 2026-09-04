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
const COSTA = 6100606, CENTRAL = 7684546, ESPIRITUAL = 6259246
const SOURCES = {
  'porto-matosinhos':         { rel: [COSTA], bbox: [41.13, -8.72, 41.20, -8.58] },
  'matosinhos-vila-do-conde': { rel: [17600329, 18091699] },
  'vila-do-conde-esposende':  { rel: [18091819, 18165121], bbox: [41.34, -8.80, 41.55, -8.70] },
  'esposende-viana':          { rel: [18165121], bbox: [41.52, -8.85, 41.71, -8.70] },
  'viana-caminha':            { rel: [18168169], bbox: [41.68, -8.90, 41.89, -8.78] },
  'a-guarda-a-ramallosa':     { rel: [18173128] },
  'a-ramallosa-vigo':         { rel: [18173296] },
  'vigo-redondela':           { rel: [12786089], bbox: [42.22, -8.75, 42.30, -8.58] },
  'caminha-valenca':          { rel: [COSTA], bbox: [41.86, -8.86, 42.05, -8.62] },
  'valenca-tui':              { rel: [CENTRAL], bbox: [42.02, -8.66, 42.06, -8.62] },
  'tui-o-porrino':            { rel: [CENTRAL], bbox: [42.04, -8.66, 42.17, -8.60] },
  'o-porrino-redondela':      { rel: [CENTRAL], bbox: [42.15, -8.66, 42.29, -8.58] },
  'redondela-pontevedra':     { rel: [CENTRAL], bbox: [42.27, -8.68, 42.44, -8.58] },
  'pontevedra-caldas':        { rel: [CENTRAL], bbox: [42.42, -8.68, 42.61, -8.60] },
  'caldas-padron':            { rel: [CENTRAL], bbox: [42.60, -8.68, 42.75, -8.60] },
  'padron-santiago':          { rel: [CENTRAL], bbox: [42.73, -8.68, 42.89, -8.52] },
  'pontevedra-armenteira':    { rel: [ESPIRITUAL], bbox: [42.42, -8.76, 42.52, -8.62] },
  'armenteira-vilanova':      { rel: [ESPIRITUAL], bbox: [42.49, -8.85, 42.58, -8.70] },
  // Central from Porto
  'porto-vilarinho':          { rel: [CENTRAL], bbox: [41.13, -8.68, 41.34, -8.58] },
  'vilarinho-barcelos':       { rel: [CENTRAL], bbox: [41.32, -8.70, 41.54, -8.58] },
  'barcelos-ponte-de-lima':   { rel: [CENTRAL], bbox: [41.52, -8.66, 41.78, -8.56] },
  'ponte-de-lima-rubiaes':    { rel: [CENTRAL], bbox: [41.75, -8.66, 41.93, -8.56] },
  'rubiaes-valenca':          { rel: [CENTRAL], bbox: [41.91, -8.68, 42.04, -8.58] },
}

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

async function fetchWays(relId, bbox) {
  const key = `${relId}${bbox ? '_' + bbox.join('_') : ''}`
  const file = path.join(RAW, key + '.json')
  if (existsSync(file)) return JSON.parse(await readFile(file, 'utf8'))
  if (OFFLINE) throw new Error(`no cache for ${key}`)
  const clip = bbox ? `(${bbox.join(',')})` : ''
  const q = `[out:json][timeout:120];rel(${relId});way(r)${clip};out geom;`
  const data = await overpass(q)
  await mkdir(RAW, { recursive: true })
  await writeFile(file, JSON.stringify(data))
  await sleep(2500)
  return data
}

const keyOf = c => `${c[0].toFixed(6)},${c[1].toFixed(6)}`

// Greedy stitch: start from the way nearest `from`, keep appending the way
// whose endpoint is closest to the growing line's end, until we reach `to`.
function stitch(ways, from, to) {
  const lines = ways.filter(w => w.geometry && w.geometry.length > 1).map(w => w.geometry.map(p => [p.lon, p.lat]))
  if (!lines.length) return []
  const dist = (a, b) => Math.hypot((a[0] - b[0]) * Math.cos(a[1] * Math.PI / 180), a[1] - b[1])
  // seed: line with an endpoint nearest `from`
  let bestI = 0, bestD = Infinity, flip = false
  lines.forEach((l, i) => {
    const d0 = dist(l[0], from), d1 = dist(l[l.length - 1], from)
    if (d0 < bestD) { bestD = d0; bestI = i; flip = false }
    if (d1 < bestD) { bestD = d1; bestI = i; flip = true }
  })
  let out = flip ? [...lines[bestI]].reverse() : [...lines[bestI]]
  const used = new Set([bestI])
  const TOL = 0.0025 // ~250 m: OSM relations have gaps at ferries and bridges
  for (let guard = 0; guard < lines.length; guard++) {
    const end = out[out.length - 1]
    if (dist(end, to) < 0.004) break
    let ni = -1, nd = Infinity, nflip = false
    lines.forEach((l, i) => {
      if (used.has(i)) return
      const d0 = dist(l[0], end), d1 = dist(l[l.length - 1], end)
      if (d0 < nd) { nd = d0; ni = i; nflip = false }
      if (d1 < nd) { nd = d1; ni = i; nflip = true }
    })
    if (ni < 0 || nd > TOL * 8) break
    const l = nflip ? [...lines[ni]].reverse() : lines[ni]
    // Avoid heading away from the destination on branch/loop ways
    if (dist(l[l.length - 1], to) > dist(end, to) + 0.02) { used.add(ni); continue }
    out = out.concat(l.slice(nd < 1e-9 ? 1 : 0))
    used.add(ni)
  }
  return out
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
    for (const rel of spec.rel) {
      const data = await fetchWays(rel, spec.bbox)
      ways = ways.concat((data.elements || []).filter(e => e.type === 'way'))
    }
    let line = stitch(ways, from, to)
    line = trim(line, from, to)
    if (line.length < 2) { console.warn(`empty ${id}`); continue }
    const km = lengthKm(line)
    out[id] = { id, coords: simplify(line).map(c => [+c[0].toFixed(5), +c[1].toFixed(5)]), km: +km.toFixed(2) }
    console.log(`${id.padEnd(26)} ${String(out[id].coords.length).padStart(5)} pts  ${km.toFixed(1)} km`)
  } catch (e) {
    console.warn(`FAILED ${id}: ${e.message}`)
  }
}
await writeFile(OUT, JSON.stringify(out))
console.log(`wrote ${OUT} (${Object.keys(out).length} segments)`)
