// On-phone upload queue. Posts are written here first and drained whenever
// the network allows, so posting never depends on having signal right now.
// IndexedDB holds the resized JPEG blobs; nothing here needs a service worker.

const DB = 'ultreia-queue', STORE = 'posts'

export type QueuedPost = {
  id: string; token: string; kind: 'photo' | 'note'
  blob: Blob | null; caption: string; takenAt: string
  lat: number | null; lng: number | null; kmSource: string
  km: number | null            // set when the walker placed it by hand
  width: number | null; height: number | null; createdAt: number; tries: number
}

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1)
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' })
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error)
  })
}
function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(db => new Promise<T>((res, rej) => {
    const t = db.transaction(STORE, mode); const rq = fn(t.objectStore(STORE))
    rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error)
  }))
}
export const enqueue = (p: QueuedPost) => tx('readwrite', s => s.put(p))
export const remove = (id: string) => tx('readwrite', s => s.delete(id))
export const all = () => tx<QueuedPost[]>('readonly', s => s.getAll())

export async function drain(onChange?: (left: number) => void, onFailed?: (p: QueuedPost, why: string) => void): Promise<void> {
  const items = (await all()).sort((a, b) => a.createdAt - b.createdAt)
  onChange?.(items.length)
  for (const it of items) {
    const fd = new FormData()
    if (it.blob) fd.append('file', it.blob, 'photo.jpg')
    // The queue's own id travels with the post: on bad signal an upload can
    // succeed and the reply never arrive, and without this the next drain
    // would put the same photograph on the map twice.
    fd.append('postId', it.id)
    fd.append('kind', it.kind); fd.append('caption', it.caption); fd.append('takenAt', it.takenAt)
    if (it.lat != null && it.lng != null) { fd.append('lat', String(it.lat)); fd.append('lng', String(it.lng)) }
    fd.append('kmSource', it.kmSource)
    if (it.km != null) fd.append('km', String(it.km))
    if (it.width) fd.append('width', String(it.width)); if (it.height) fd.append('height', String(it.height))
    try {
      const res = await fetch(`/api/go/${it.token}/post`, { method: 'POST', body: fd })
      if (res.ok || res.status === 409) { await remove(it.id); continue }   // done, or already up there
      if (res.status === 400 || res.status === 413) {
        // Never going to work. Drop it, but say so rather than vanishing.
        await remove(it.id)
        onFailed?.(it, (await res.json().catch(() => ({}))).error || 'The server refused it.')
        continue
      }
      it.tries += 1
      await tx('readwrite', s => s.put(it))
      break
    } catch { break }
    onChange?.((await all()).length)
  }
}
