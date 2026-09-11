// Reading a video the walker just chose: how long it runs, and a still from
// the start of it for the map and the pictures page. Everything happens on
// the phone — the file itself goes straight to storage, never through our
// own API, which could not carry it.

export const CLIP_SECONDS = 30
export const CLIP_MAX_BYTES = 120 * 1024 * 1024

export type ClipRead = { durationS: number; width: number; height: number; poster: Blob | null }

function loadVideo(file: File): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video')
    v.preload = 'metadata'
    v.muted = true
    v.playsInline = true
    v.src = URL.createObjectURL(file)
    v.onloadedmetadata = () => resolve(v)
    v.onerror = () => reject(new Error('That video couldn’t be read on this phone.'))
  })
}

// A frame from just after the start: the very first frame is often black.
async function frame(v: HTMLVideoElement): Promise<Blob | null> {
  try {
    await new Promise<void>((res, rej) => {
      v.onseeked = () => res()
      v.onerror = () => rej(new Error('seek failed'))
      v.currentTime = Math.min(0.4, (v.duration || 1) / 4)
    })
    const scale = Math.min(1, 1200 / Math.max(v.videoWidth, v.videoHeight))
    const c = document.createElement('canvas')
    c.width = Math.round(v.videoWidth * scale)
    c.height = Math.round(v.videoHeight * scale)
    c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height)
    return await new Promise<Blob | null>(r => c.toBlob(b => r(b), 'image/jpeg', 0.82))
  } catch {
    return null      // no poster is a shame, not a failure
  }
}

export async function readClip(file: File): Promise<ClipRead> {
  const v = await loadVideo(file)
  const durationS = Math.round(v.duration || 0)
  const read: ClipRead = { durationS, width: v.videoWidth, height: v.videoHeight, poster: await frame(v) }
  URL.revokeObjectURL(v.src)
  return read
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
  if (!put.ok) throw new Error('The upload didn’t finish.')
  return path
}
