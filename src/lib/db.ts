// Server-only PostgREST + Storage access with the service role key.
// Never import from client components. (Pattern carried over from Meridian.)

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'media'

export type Json = Record<string, unknown>

export function dbConfigured(): boolean {
  return Boolean(URL_BASE && SERVICE_KEY)
}

function headers(extra: Record<string, string> = {}) {
  return { apikey: SERVICE_KEY!, Authorization: `Bearer ${SERVICE_KEY}`, ...extra }
}

export async function dbSelect<T = Json>(path: string): Promise<T[]> {
  if (!dbConfigured()) return []
  const res = await fetch(`${URL_BASE}/rest/v1/${path}`, { headers: headers(), cache: 'no-store' })
  if (!res.ok) throw new Error(`db select ${path}: ${res.status}`)
  return res.json()
}

export async function dbInsert<T = Json>(table: string, rows: Json | Json[], returning = false): Promise<T[]> {
  if (!dbConfigured()) throw new Error('database not configured')
  const res = await fetch(`${URL_BASE}/rest/v1/${table}`, {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json', Prefer: returning ? 'return=representation' : 'return=minimal' }),
    body: JSON.stringify(rows),
  })
  if (!res.ok) throw new Error(`db insert ${table}: ${res.status} ${await res.text()}`)
  return returning ? res.json() : []
}

export async function dbUpsert(table: string, rows: Json | Json[], onConflict: string): Promise<void> {
  if (!dbConfigured()) throw new Error('database not configured')
  const res = await fetch(`${URL_BASE}/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify(rows),
  })
  if (!res.ok) throw new Error(`db upsert ${table}: ${res.status} ${await res.text()}`)
}

export async function dbUpdate(path: string, patch: Json): Promise<void> {
  if (!dbConfigured()) throw new Error('database not configured')
  const res = await fetch(`${URL_BASE}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: headers({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error(`db update ${path}: ${res.status} ${await res.text()}`)
}

// Storage: put bytes at a path in the public bucket; returns the public URL.
export async function storagePut(path: string, bytes: ArrayBuffer | Uint8Array, contentType: string): Promise<string> {
  if (!dbConfigured()) throw new Error('database not configured')
  const res = await fetch(`${URL_BASE}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: headers({ 'Content-Type': contentType, 'x-upsert': 'true' }),
    body: bytes as BodyInit,
  })
  if (!res.ok) throw new Error(`storage put ${path}: ${res.status} ${await res.text()}`)
  return publicUrl(path) as string
}

export function publicUrl(path: string | null | undefined): string | null {
  if (!path) return null
  if (/^https?:\/\//.test(path)) return path
  return `${URL_BASE}/storage/v1/object/public/${BUCKET}/${path}`
}
