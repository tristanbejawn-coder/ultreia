// Server-only PostgREST + Storage access with the service role key.
// Never import from client components. (Pattern carried over from Meridian.)

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'ultreia-media'

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

// Insert, unless a row with that primary key is already there. Used to make
// posting a photograph idempotent: the phone names the row, so an upload that
// succeeded but never got its reply through can be retried safely.
export async function dbInsertNew(table: string, row: Json): Promise<boolean> {
  if (!dbConfigured()) throw new Error('database not configured')
  const res = await fetch(`${URL_BASE}/rest/v1/${table}`, {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
    body: JSON.stringify(row),
  })
  if (res.ok) return true
  const text = await res.text()
  if (res.status === 409 || text.includes('23505')) return false   // already there
  throw new Error(`db insert ${table}: ${res.status} ${text}`)
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

export async function dbDelete(path: string): Promise<void> {
  if (!dbConfigured()) throw new Error('database not configured')
  const res = await fetch(`${URL_BASE}/rest/v1/${path}`, { method: 'DELETE', headers: headers({ Prefer: 'return=minimal' }) })
  if (!res.ok) throw new Error(`db delete ${path}: ${res.status} ${await res.text()}`)
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

// A one-off URL the phone can PUT a file to directly. Video cannot go
// through our own API: the platform caps a request body at a few megabytes
// and thirty seconds of phone video is many times that. The service key
// stays here; the phone gets a signed URL good for one upload.
export async function signedUploadUrl(path: string): Promise<{ path: string; url: string }> {
  if (!dbConfigured()) throw new Error('database not configured')
  const res = await fetch(`${URL_BASE}/storage/v1/object/upload/sign/${BUCKET}/${path}`, {
    method: 'POST', headers: headers({ 'Content-Type': 'application/json' }), body: '{}',
  })
  if (!res.ok) throw new Error(`sign upload ${path}: ${res.status} ${await res.text()}`)
  const json = await res.json() as { url?: string }
  if (!json.url) throw new Error('no signed url came back')
  return { path, url: `${URL_BASE}/storage/v1${json.url}` }
}

export function publicUrl(path: string | null | undefined): string | null {
  if (!path) return null
  if (/^https?:\/\//.test(path) || path.startsWith('/')) return path
  return `${URL_BASE}/storage/v1/object/public/${BUCKET}/${path}`
}
