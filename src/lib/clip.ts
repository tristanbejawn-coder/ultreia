// Reading a video the walker just chose: how long it runs, and a still from
// the start of it for the map and the pictures page. Everything happens on
// the phone — the file itself goes straight to storage, never through our
// own API, which could not carry it.
//
// Safari is the phone that matters and it is particular: a video element
// that is not in the document may never fire loadedmetadata, a seek may
// never fire seeked, and a duration can come back Infinity. So the element
// goes into the page, load() is called, every wait has a timeout, and a
// clip we cannot read is still allowed through — a missing poster is a
// shame, not a reason to lose a diary entry.

export const CLIP_SECONDS = 30
// Storage refuses anything over its per-file ceiling (50 MB by default), and
// thirty seconds from a modern phone can run past it. Say so before trying.
export const CLIP_MAX_BYTES = 48 * 1024 * 1024

export type ClipRead = { durationS: number; width: number; height: number; poster: Blob | null; readable: boolean }

const wait = <T,>(p: Promise<T>, ms: number): Promise<T | null> =>
  Promise.race([p, new Promise<null>(r => setTimeout(() => r(null), ms))])

function mount(file: File): HTMLVideoElement {
  const v = document.createElement('video')
  v.preload = 'metadata'
  v.muted = true
  v.playsInline = true
  v.setAttribute('playsinline', '')
  Object.assign(v.style, { position: 'fixed', width: '1px', height: '1px', opacity: '0', pointerEvents: 'none', left: '-10px' })
  document.body.appendChild(v)
  v.src = URL.createObjectURL(file)
  v.load()
  return v
}

function metadata(v: HTMLVideoElement): Promise<void> {
  if (v.readyState >= 1) return Promise.resolve()
  return new Promise((res, rej) => {
    v.addEventListener('loadedmetadata', () => res(), { once: true })
    v.addEventListener('error', () => rej(new Error('unreadable')), { once: true })
  })
}

// A frame from just after the start: the very first frame is often black.
async function frame(v: HTMLVideoElement): Promise<Blob | null> {
  try {
    const seeked = new Promise<void>(res => v.addEventListener('seeked', () => res(), { once: true }))
    v.currentTime = Math.min(0.4, isFinite(v.duration) && v.duration > 0 ? v.duration / 4 : 0.4)
    if ((await wait(seeked, 4000)) === null) return null
    if (!v.videoWidth || !v.videoHeight) return null
    const scale = Math.min(1, 1200 / Math.max(v.videoWidth, v.videoHeight))
    const c = document.createElement('canvas')
    c.width = Math.round(v.videoWidth * scale)
    c.height = Math.round(v.videoHeight * scale)
    c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height)
    return await wait(new Promise<Blob | null>(r => c.toBlob(b => r(b), 'image/jpeg', 0.82)), 4000)
  } catch {
    return null
  }
}

export async function readClip(file: File): Promise<ClipRead> {
  const v = mount(file)
  try {
    const ok = (await wait(metadata(v).then(() => true).catch(() => false), 10000)) === true
    if (!ok) return { durationS: 0, width: 0, height: 0, poster: null, readable: false }
    const d = v.duration
    const durationS = isFinite(d) && d > 0 ? Math.round(d) : 0
    const poster = await frame(v)
    return { durationS, width: v.videoWidth, height: v.videoHeight, poster, readable: durationS > 0 }
  } finally {
    URL.revokeObjectURL(v.src)
    v.remove()
  }
}

// Straight to storage with a URL the server signed for this one upload.
export async function uploadDirect(token: string, file: Blob, contentType: string): Promise<string> {
  const ask = await fetch(`/api/go/${token}/upload`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contentType }),
  })
  if (!ask.ok) throw new Error((await ask.json().catch(() => ({}))).error || 'Couldn’t start the upload.')
  const { path, url } = await ask.json() as { path: string; url: string }
  const put = await fetch(url, { method: 'PUT', headers: { 'Content-Type': contentType, 'x-upsert': 'true' }, body: file })
  if (put.status === 413) throw new Error('Too big for the store. Record it shorter, or at a lower quality in Settings › Camera.')
  if (!put.ok) throw new Error('The upload didn’t finish. Try again with more signal.')
  return path
}
