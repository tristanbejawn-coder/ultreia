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

export const VOICE_SECONDS = 480          // eight minutes is more than anyone speaks
export const VOICE_MAX_BYTES = 40 * 1024 * 1024
// Speech at 16 kHz is a clear telephone; it is also a tenth of the bytes.
const WAV_RATE = 16000

// AAC in MP4 first: it is the one thing every phone both records and plays.
// Safari gives it; a Chrome without an AAC encoder falls back to Opus, which
// iOS will not play — so anything that is not AAC is turned into plain PCM
// below before it is stored, and the family hears it whatever they hold.
const CANDIDATES = ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm;codecs=opus', 'audio/webm']

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
const ACCEPTED = ['audio/mp4', 'audio/aac', 'audio/x-m4a', 'audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/wav']

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

// Is this recording AAC inside MP4 — the format every phone can play?
// The codec is named in a box in the header; Opus names itself too.
async function isAacMp4(blob: Blob): Promise<boolean> {
  const head = new Uint8Array(await blob.slice(0, 4096).arrayBuffer())
  const text = String.fromCharCode(...head)
  return text.includes('ftyp') && text.includes('mp4a') && !text.includes('Opus')
}

function wavOf(pcm: Float32Array, rate: number): Blob {
  const buf = new ArrayBuffer(44 + pcm.length * 2)
  const view = new DataView(buf)
  const str = (at: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(at + i, s.charCodeAt(i)) }
  str(0, 'RIFF'); view.setUint32(4, 36 + pcm.length * 2, true); str(8, 'WAVE')
  str(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true)
  view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true)
  str(36, 'data'); view.setUint32(40, pcm.length * 2, true)
  for (let i = 0; i < pcm.length; i++) {
    const v = Math.max(-1, Math.min(1, pcm[i]))
    view.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7FFF, true)
  }
  return new Blob([buf], { type: 'audio/wav' })
}

// Whatever was recorded, hand back something every phone plays: the AAC as
// it stands, or speech decoded and written out as plain PCM at 16 kHz.
export async function playableEverywhere(rec: Recording): Promise<Recording> {
  if (await isAacMp4(rec.blob)) return rec
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctx) return rec
  const bytes = await rec.blob.arrayBuffer()
  const ctx = new Ctx()
  try {
    const decoded = await ctx.decodeAudioData(bytes.slice(0))
    let mono: Float32Array, rate = decoded.sampleRate
    try {
      const offline = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * WAV_RATE)), WAV_RATE)
      const src = offline.createBufferSource()
      src.buffer = decoded; src.connect(offline.destination); src.start()
      const out = await offline.startRendering()
      mono = out.getChannelData(0); rate = WAV_RATE
    } catch {
      // A phone that will not resample: keep its own rate, bigger but sound.
      mono = decoded.getChannelData(0)
    }
    return { blob: wavOf(mono, rate), mime: 'audio/wav', durationS: Math.round(decoded.duration) || rec.durationS }
  } catch {
    return rec          // undecodable: store what we have rather than lose it
  } finally {
    ctx.close().catch(() => {})
  }
}

// mm:ss, for the timer while it runs and the length afterwards.
export function clock(seconds: number): string {
  const m = Math.floor(seconds / 60), s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

// Whether a stored path holds speech rather than film.
const AUDIO_EXT = /\.(m4a|weba|ogg|oga|mp3|wav)$/i
export const isVoice = (url: string | null | undefined) => !!url && AUDIO_EXT.test(new URL(url, 'https://x').pathname)
