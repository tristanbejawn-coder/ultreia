// Filming in the page, instead of handing the job to the camera app.
//
// The camera app writes at whatever quality the phone is set to: Jit's
// twenty-eight second diary came to 46 MB, of the 48 the store will take, so
// a minute of it was impossible. Opening the camera here means the size and
// the bitrate are set before a single frame is written — 720p at 2 Mbit is
// about 15 MB a minute — and nothing has to be re-encoded afterwards, which
// on a phone would cost minutes and a good deal of battery.
//
// The catch is the codec. A film recorded as WebM will not play on the
// iPhones at home, so the in-page recorder is offered only where H.264 in
// MP4 can be recorded, and the result is checked before it is offered for
// posting. Everywhere else the camera app is still the way.

export const FILM_BITRATE = 2_000_000
export const FILM_AUDIO_BITRATE = 64_000
export const FILM_WIDTH = 1280, FILM_HEIGHT = 720
// What the store will take, less a little room: the recording stops itself
// rather than being refused after the fact.
export const FILM_MAX_BYTES = 44 * 1024 * 1024
export const FILM_CAP = { clip: 60, diary: 150 } as const

const MP4 = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a', 'video/mp4']

export function filmMime(): string | null {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return null
  return MP4.find(m => MediaRecorder.isTypeSupported(m)) ?? null
}

export function filmSupported(): boolean {
  return typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && !!filmMime()
}

// Will the family's phones play this film?
//
// The codec is named inside the file's `moov` box, and only there: scanning
// raw bytes for "VP9" finds it in the middle of the picture as often as in a
// codec name, which is how a good film came to be turned away. So the top
// level boxes are walked — a recorder writes moov at the front, a phone's
// camera app leaves it at the very end, both are found — and only what it
// says is believed.
//
// H.264 and HEVC both play on iPhones and on Android: Jit's own camera
// records HEVC. What is refused is the web's own codecs, VP8, VP9, AV1 and
// Opus, which Safari will not play — and which a Chromium without the
// licensed encoders quietly writes inside an MP4 container when asked for one.
async function moovOf(blob: Blob): Promise<string | null> {
  const dec = new TextDecoder('latin1')
  let off = 0
  for (let hops = 0; hops < 64 && off + 8 <= blob.size; hops++) {
    const head = new DataView(await blob.slice(off, off + 16).arrayBuffer())
    if (head.byteLength < 8) return null
    let size = head.getUint32(0)
    let headerLen = 8
    const type = dec.decode(new Uint8Array(head.buffer, 4, 4))
    if (size === 1) {
      if (head.byteLength < 16) return null
      size = Number(head.getBigUint64(8)); headerLen = 16
    } else if (size === 0) {
      size = blob.size - off
    }
    if (type === 'moov') {
      return dec.decode(await blob.slice(off + headerLen, Math.min(blob.size, off + size)).arrayBuffer())
    }
    if (size < 8) return null
    off += size
  }
  return null
}

export async function playsAnywhere(blob: Blob): Promise<boolean> {
  const moov = await moovOf(blob)
  if (!moov) return false
  if (/vp09|vp08|av01|Opus/.test(moov)) return false
  return /avc1|avc3|hvc1|hev1/.test(moov)
}

export type Film = { blob: Blob; mime: string; durationS: number; width: number; height: number; poster: Blob | null }
export type FilmSession = {
  stream: MediaStream
  mime: string
  facing: 'environment' | 'user'
  stop: (preview?: HTMLVideoElement | null) => Promise<Film>
  cancel: () => void
}

export async function startFilm(
  facing: 'environment' | 'user',
  onTick?: (t: { seconds: number; bytes: number }) => void,
  onFull?: () => void,
): Promise<FilmSession> {
  const mime = filmMime()
  if (!mime || !navigator.mediaDevices?.getUserMedia) throw new Error('This phone can’t film in the browser. Use the camera app instead.')
  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: facing, width: { ideal: FILM_WIDTH }, height: { ideal: FILM_HEIGHT }, frameRate: { ideal: 30, max: 30 } },
      audio: true,
    })
  } catch {
    throw new Error('The phone wouldn’t give the camera. Allow it for this site in Settings, then try again.')
  }
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: FILM_BITRATE, audioBitsPerSecond: FILM_AUDIO_BITRATE })
  const chunks: Blob[] = []
  let bytes = 0
  rec.ondataavailable = e => {
    if (!e.data || !e.data.size) return
    chunks.push(e.data); bytes += e.data.size
    if (bytes > FILM_MAX_BYTES) { try { rec.stop() } catch {} ; onFull?.() }
  }
  const started = Date.now()
  const seconds = () => Math.round((Date.now() - started) / 1000)
  const ended = new Promise<void>(res => { rec.onstop = () => res() })
  rec.start(1000)
  const tick = setInterval(() => onTick?.({ seconds: seconds(), bytes }), 500)
  const release = () => { clearInterval(tick); stream.getTracks().forEach(t => t.stop()) }
  const settings = stream.getVideoTracks()[0]?.getSettings?.() ?? {}
  return {
    stream, mime, facing,
    async stop(preview) {
      const durationS = seconds()
      // The poster comes off the preview while the camera is still live.
      let poster: Blob | null = null
      if (preview && preview.videoWidth) {
        try {
          const c = document.createElement('canvas')
          const scale = Math.min(1, 1200 / Math.max(preview.videoWidth, preview.videoHeight))
          c.width = Math.round(preview.videoWidth * scale); c.height = Math.round(preview.videoHeight * scale)
          c.getContext('2d')!.drawImage(preview, 0, 0, c.width, c.height)
          poster = await new Promise<Blob | null>(r => c.toBlob(b => r(b), 'image/jpeg', 0.82))
        } catch { poster = null }
      }
      if (rec.state !== 'inactive') rec.stop()
      await ended
      release()
      return {
        blob: new Blob(chunks, { type: (mime.split(';')[0] || 'video/mp4') }),
        mime: mime.split(';')[0] || 'video/mp4',
        durationS,
        width: Number(settings.width) || preview?.videoWidth || FILM_WIDTH,
        height: Number(settings.height) || preview?.videoHeight || FILM_HEIGHT,
        poster,
      }
    },
    cancel() {
      try { if (rec.state !== 'inactive') rec.stop() } catch {}
      release()
    },
  }
}

export const mb = (bytes: number) => `${(bytes / 1048576).toFixed(bytes < 10485760 ? 1 : 0)} MB`
