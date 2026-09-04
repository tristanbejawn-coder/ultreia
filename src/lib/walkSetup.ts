// Creating a walk from the setup screens: a slug for the link, a short code
// for the front door, a name, the walkers and their private keys.
import { dbInsert, dbSelect } from '@/lib/db'
import { CAMINOS, nodeById } from '@/data/caminos'

export type SetupInput = { camino: string; route: string; walkers: string[]; startsOn: string | null }

function token(bytes = 24): string {
  const a = new Uint8Array(bytes); crypto.getRandomValues(a)
  return Array.from(a, b => b.toString(16).padStart(2, '0')).join('')
}
function slugify(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}
function letters(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z]/g, '')
}

export function cleanNames(raw: unknown): string[] {
  const arr = Array.isArray(raw) ? raw : []
  return arr.map(x => String(x ?? '').trim().replace(/\s+/g, ' ').slice(0, 24)).filter(Boolean).slice(0, 4)
}

async function freeSlug(base: string): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const s = i === 0 ? base : `${base}-${i + 1}`
    const rows = await dbSelect<{ id: string }>(`ultreia_walks?slug=eq.${encodeURIComponent(s)}&select=id&limit=1`)
    if (!rows.length) return s
  }
  return `${base}-${token(2)}`
}
async function freeCode(names: string[]): Promise<string> {
  const base = names.length >= 2
    ? letters(names[0]).slice(0, 3) + letters(names[1]).slice(0, 3)
    : letters(names[0]).slice(0, 5)
  const seed = (base || 'WALK').padEnd(4, 'X')
  for (let i = 0; i < 30; i++) {
    const c = i === 0 ? seed : seed.slice(0, Math.max(3, seed.length - 1)) + String(i)
    const rows = await dbSelect<{ id: string }>(`ultreia_walks?code=eq.${encodeURIComponent(c)}&select=id&limit=1`)
    if (!rows.length) return c
  }
  return seed + token(1).toUpperCase()
}

export async function createWalk(ownerEmail: string, input: SetupInput) {
  const camino = CAMINOS[input.camino]
  if (!camino) throw new Error('unknown camino')
  const route = camino.routes.find(r => r.id === input.route)
  if (!route) throw new Error('unknown route')
  const names = cleanNames(input.walkers)
  if (!names.length) throw new Error('no walkers')
  const startNode = nodeById(camino, route.from)
  const lastSeg = camino.segments.find(s => s.id === route.plan[route.plan.length - 1])
  const endName = lastSeg ? nodeById(camino, lastSeg.to).name.replace(' de Compostela', '') : 'Santiago'
  const who = names.length === 1 ? names[0] : names.length === 2 ? `${names[0]} & ${names[1]}` : `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`
  const name = `${who} walk${names.length === 1 ? 's' : ''} to ${endName}`
  const slug = await freeSlug(slugify(names.join(' and ')) || 'walk')
  const code = await freeCode(names)
  const walkers = names.map((n, i) => ({ key: slugify(n) || `walker-${i + 1}`, name: n }))
  const startsOn = input.startsOn && /^\d{4}-\d{2}-\d{2}$/.test(input.startsOn) ? input.startsOn : null

  const [walk] = await dbInsert<{ id: string; slug: string; code: string; name: string }>('ultreia_walks', {
    slug, code, name, camino: camino.id, start_node: startNode.id, plan: route.plan, walkers,
    starts_on: startsOn, timezone: 'Europe/Lisbon', owner_email: ownerEmail, paid: false,
  }, true)
  await dbInsert('ultreia_walker_keys', walkers.map(w => ({ token: token(), walk_id: walk.id, walker: w.key })))
  return walk
}
