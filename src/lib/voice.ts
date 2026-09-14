// A spoken diary entry, recorded in the page.
//
// Video was the only way to keep a diary here, and a minute of phone video
// is tens of megabytes: the store refuses it and the walker is told to trim
// it in Photos, which is not a diary. Speech is a hundredth of the size —
// ten minutes of it is a few megabytes — so it can be recorded here, kept on
// the phone until there is signal, and posted like anything else.
//
// Safari is the phone that matters: it records audio/mp4 and nothing else,
// Chrome records webm/opus, and MediaRecorder reports its own mime type
// which may carry codec parameters. All of that is settled here.

export const VOICE_SECONDS = 600          // ten minutes is more than anyone speaks
export const VOICE_MAX_BYTES = 40 * 1024 * 1024

const CANDIDATES = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mpeg']

export function voiceSupported(): boolean {
  return typeof window !== 'undefined'
    && typeof MediaRecorder !== 'undefined'
    && !!navigator.mediaDevices?.getUserMedia
}

function pickMime(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return undefined
  return CANDIDATES.find(m => MediaRecorder.isTypeSupported(m))
}

// The content type the store is asked for: no codec parameters.
export const baseMime = (m: string) => (m.split(';')[0] || 'audio/webm').trim().toLowerCase()

// What the signed-upload route will take. If a phone insists on recording
// something else, say so at the start rather than at the upload.
const ACCEPTED = ['audio/mp4', 'audio/aac', 'audio/x-m4a', 'audio/webm', 'audio/ogg', 'audio/mpeg']

export type Recording = { blob: Blob; mime: string; durationS: number }
export type VoiceSession = {
  mime: string
  stop: () => Promise<Recording>
  cancel: () => void
}

export async function startVoice(onTick?: (seconds: number) => void): Promise<VoiceSession> {
  if (!voiceSupported()) throw new Error('This phone won’t record in the browser. Use “Record a video” instead.')
  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  } catch {
    throw new Error('The phone wouldn’t give the microphone. Allow it for this site in Settings, then try again.')
  }
  const wanted = pickMime()
  const rec = new MediaRecorder(stream, wanted ? { mimeType: wanted, audioBitsPerSecond: 64000 } : undefined)
  const chunks: Blob[] = []
  rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data) }
  const mime = rec.mimeType || wanted || 'audio/webm'
  if (!ACCEPTED.includes(baseMime(mime))) {
    stream.getTracks().forEach(t => t.stop())
    throw new Error('This phone records speech in a format we can’t store. Use “Record a video” instead.')
  }
  const started = Date.now()
  const elapsed = () => Math.round((Date.now() - started) / 1000)
  const ended = new Promise<void>(res => { rec.onstop = () => res() })
  rec.start(1000)                                  // a chunk a second, so nothing is lost
  const tick = setInterval(() => onTick?.(elapsed()), 500)
  const release = () => { clearInterval(tick); stream.getTracks().forEach(t => t.stop()) }
  return {
    mime,
    async stop() {
      const durationS = elapsed()
      if (rec.state !== 'inactive') rec.stop()
      await ended
      release()
      return { blob: new Blob(chunks, { type: baseMime(mime) }), mime: baseMime(mime), durationS }
    },
    cancel() {
      try { if (rec.state !== 'inactive') rec.stop() } catch {}
      release()
    },
  }
}

// mm:ss, for the timer while it runs and the length afterwards.
export function clock(seconds: number): string {
  const m = Math.floor(seconds / 60), s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

// Whether a stored path holds speech rather than film.
const AUDIO_EXT = /\.(m4a|weba|webm-audio|ogg|oga|mp3)$/i
export const isVoice = (url: string | null | undefined) => !!url && AUDIO_EXT.test(new URL(url, 'https://x').pathname)
