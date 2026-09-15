// A postcard of the walk so far, drawn on the phone and handed to WhatsApp.
//
// Pure: takes the client state and a photograph, returns a canvas. No React,
// so it can be rendered small for the design picker and full-size for the
// share without two code paths. Three designs, one set of figures.

import type { ClientState } from '@/lib/walk'
import { fmtDatePlus } from '@/lib/fmt'

export type Design = 'print' | 'postcard' | 'night'
export const DESIGNS: { id: Design; name: string; note: string }[] = [
  { id: 'print', name: 'Print', note: 'Photo, the numbers, the line' },
  { id: 'postcard', name: 'Postcard', note: 'Stamped and franked' },
  { id: 'night', name: 'Night', note: 'Gold on dark' },
]

// There is no pedometer in a web page. Flat walking runs 1,300–1,500 steps
// a kilometre and trail with a pack 1,500–1,700; the coast is boardwalk and
// beach, so this sits between and is always shown as an estimate.
const STEPS_PER_KM = 1400

export type Stats = {
  day: number | null          // day of the walk, 1-based; null before it starts
  date: string                // e.g. "Tue 15 Sep"
  place: string               // "towards Vila do Conde" / "Vila do Conde"
  stage: string               // "Porto → Vila do Conde"
  km: number; totalKm: number; toGo: number; pct: number; steps: number
  stagesDone: number; stages: number
  next: { name: string; km: number } | null
  eta: string | null          // "about Fri 25 Sep"
}

function localYmd(tz: string, d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

export function walkStats(state: ClientState, now = new Date()): Stats {
  const tz = state.walk.timezone
  const today = localYmd(tz, now)
  const km = state.position.km, totalKm = state.route.totalKm
  const day = state.started && state.walk.startsOn
    ? Math.round((Date.parse(today) - Date.parse(state.walk.startsOn)) / 86400000) + 1
    : null
  const segs = state.route.segments
  const stagesDone = segs.filter(s => km >= s.endKm - 0.05).length
  const cur = state.position.segment
  const curSeg = cur ? segs.find(s => s.id === cur.id) : null
  const atStart = curSeg ? km <= curSeg.km + 0.5 : true
  const place = state.finished ? 'Santiago de Compostela' : cur ? (atStart ? cur.from : `towards ${cur.to}`) : segs[0]?.from || ''
  const stage = cur ? `${cur.from} → ${cur.to}` : ''
  // Walking days left: every stage not yet finished, boats excepted (a boat
  // is a morning, not a day). The current stage ends today.
  const left = segs.filter(s => s.endKm > km + 0.05 && s.transport !== 'boat')
  const eta = state.finished ? null : left.length ? `about ${fmtDatePlus(today, Math.max(0, left.length - 1))}` : null
  const nextSeg = curSeg ? segs[segs.indexOf(curSeg) + 1] : null
  const next = nextSeg && !state.finished ? { name: nextSeg.to, km: +(nextSeg.endKm - nextSeg.km).toFixed(0) } : null
  return {
    day, date: fmtDatePlus(today, 0), place, stage,
    km, totalKm, toGo: Math.max(0, totalKm - km), pct: totalKm ? Math.min(100, km / totalKm * 100) : 0,
    steps: Math.round(km * STEPS_PER_KM / 1000) * 1000,
    stagesDone, stages: segs.length, next, eta,
  }
}

// The text that travels with the picture.
export function shareText(state: ClientState, s: Stats, url: string): string {
  const who = state.walk.walkers.map(w => w.name).join(' & ')
  const head = s.day ? `Day ${s.day} · ${s.place}` : s.place
  return `${who} on the Camino · ${head}\n${s.km.toFixed(0)} km walked, ${s.toGo.toFixed(0)} to go (${s.pct.toFixed(0)}%) · about ${s.steps.toLocaleString('en-GB')} steps\n${s.eta ? `Santiago ${s.eta}\n` : ''}Follow along: ${url}`
}

// ---- drawing ------------------------------------------------------------

const INK = '#1B2430', INK2 = '#59646F', INK3 = '#8A939B', GROUND = '#F5F6F3', LINE = '#CBD1CC', GOLD = '#E09B0B', GOLD_INK = '#8A6206', AZUL = '#2B5F8E'
const DISPLAY = 'Archivo, "Arial Narrow", "Helvetica Neue", Arial, sans-serif'
const MONO = '"DM Mono", ui-monospace, Menlo, monospace'
const SERIF = '"Source Serif 4", Georgia, serif'

type Ctx = CanvasRenderingContext2D & { fontStretch?: string; letterSpacing?: string }

let fontsReady: Promise<void> | null = null
export function loadFonts(): Promise<void> {
  if (fontsReady) return fontsReady
  const want = ['900 40px Archivo', 'extra-condensed 900 40px Archivo', '500 20px "DM Mono"', '400 20px "DM Mono"', '400 20px "Source Serif 4"', 'italic 400 20px "Source Serif 4"']
  fontsReady = Promise.all(want.map(f => document.fonts.load(f).catch(() => null))).then(() => undefined)
  return fontsReady
}

export function loadPhoto(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('That photo would not load'))
    img.src = url
  })
}

function display(ctx: Ctx, size: number, weight = 900) {
  ctx.font = `${weight} ${size}px ${DISPLAY}`
  ctx.fontStretch = 'extra-condensed'
  ctx.letterSpacing = '0px'
}
function mono(ctx: Ctx, size: number, weight = 500, spacing = 0.1) {
  ctx.font = `${weight} ${size}px ${MONO}`
  ctx.fontStretch = 'normal'
  ctx.letterSpacing = `${(size * spacing).toFixed(1)}px`
}
function serif(ctx: Ctx, size: number, italic = false) {
  ctx.font = `${italic ? 'italic ' : ''}400 ${size}px ${SERIF}`
  ctx.fontStretch = 'normal'
  ctx.letterSpacing = '0px'
}

function cover(ctx: Ctx, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight)
  const sw = w / s, sh = h / s
  ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h)
}

function rounded(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath()
}

// Break a line of text to fit, greedily.
function wrap(ctx: Ctx, text: string, maxW: number): string[] {
  const out: string[] = []; let line = ''
  for (const word of text.split(/\s+/)) {
    const t = line ? `${line} ${word}` : word
    if (ctx.measureText(t).width > maxW && line) { out.push(line); line = word } else line = t
  }
  if (line) out.push(line)
  return out
}

// The route as a small line: walked in gold, ahead dotted, a dot where they
// are. Equirectangular is fine at the size of a country.
function routeLine(ctx: Ctx, state: ClientState, x: number, y: number, w: number, h: number, colors: { walked: string; ahead: string; dot: string; label: string }) {
  const pts = state.route.points
  if (pts.length < 2) return
  const cos = Math.cos(pts[0][1] * Math.PI / 180)
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const p of pts) { const px = p[0] * cos, py = p[1]; minX = Math.min(minX, px); maxX = Math.max(maxX, px); minY = Math.min(minY, py); maxY = Math.max(maxY, py) }
  const pad = 14
  const s = Math.min((w - pad * 2) / (maxX - minX || 1), (h - pad * 2) / (maxY - minY || 1))
  const ox = x + (w - (maxX - minX) * s) / 2, oy = y + (h - (maxY - minY) * s) / 2
  const to = (p: [number, number, number]) => [ox + (p[0] * cos - minX) * s, oy + (maxY - p[1]) * s] as const
  const km = state.position.km
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  // ahead
  ctx.strokeStyle = colors.ahead; ctx.lineWidth = 3; ctx.setLineDash([2, 8])
  ctx.beginPath()
  let started = false
  for (const p of pts) { if (p[2] < km) continue; const [px, py] = to(p); if (!started) { ctx.moveTo(px, py); started = true } else ctx.lineTo(px, py) }
  ctx.stroke(); ctx.setLineDash([])
  // walked
  ctx.strokeStyle = colors.walked; ctx.lineWidth = 6
  ctx.beginPath(); started = false
  for (const p of pts) { if (p[2] > km) break; const [px, py] = to(p); if (!started) { ctx.moveTo(px, py); started = true } else ctx.lineTo(px, py) }
  ctx.stroke()
  // them
  const at = pts.reduce((a, p) => Math.abs(p[2] - km) < Math.abs(a[2] - km) ? p : a, pts[0])
  const [dx, dy] = to(at)
  ctx.fillStyle = colors.dot; ctx.beginPath(); ctx.arc(dx, dy, 9, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = colors.walked; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(dx, dy, 14, 0, Math.PI * 2); ctx.stroke()
  // ends
  mono(ctx, 16, 500, 0.12); ctx.fillStyle = colors.label; ctx.textBaseline = 'middle'
  const [sx, sy] = to(pts[0]), [ex, ey] = to(pts[pts.length - 1])
  ctx.textAlign = sx < ex ? 'right' : 'left'; ctx.fillText(state.route.segments[0]?.from.toUpperCase() || '', sx + (sx < ex ? -14 : 14), sy)
  ctx.textAlign = sx < ex ? 'left' : 'right'; ctx.fillText('SANTIAGO', ex + (sx < ex ? 14 : -14), ey)
  ctx.textAlign = 'left'
}

// A scallop shell, the pilgrim's badge: a fan of ribs under an arc.
function shell(ctx: Ctx, cx: number, cy: number, r: number, color: string) {
  ctx.strokeStyle = color; ctx.lineWidth = Math.max(2, r / 9); ctx.lineCap = 'round'
  ctx.beginPath(); ctx.arc(cx, cy + r * 0.35, r, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke()
  for (let i = 0; i <= 6; i++) {
    const a = Math.PI * (1.12 + 0.76 * i / 6)
    ctx.beginPath(); ctx.moveTo(cx, cy + r * 0.85); ctx.lineTo(cx + Math.cos(a) * r, cy + r * 0.35 + Math.sin(a) * r); ctx.stroke()
  }
  ctx.beginPath(); ctx.moveTo(cx - r * 0.28, cy + r * 0.85); ctx.lineTo(cx + r * 0.28, cy + r * 0.85); ctx.stroke()
}

function stat(ctx: Ctx, x: number, y: number, big: string, small: string, color: string, label: string, size = 64) {
  display(ctx, size); ctx.fillStyle = color; ctx.textBaseline = 'alphabetic'; ctx.fillText(big, x, y)
  mono(ctx, Math.round(size * 0.22), 500, 0.12); ctx.fillStyle = label; ctx.fillText(small.toUpperCase(), x, y + Math.round(size * 0.42))
}

function print(ctx: Ctx, state: ClientState, s: Stats, img: HTMLImageElement, url: string) {
  const W = 1080, H = 1350
  ctx.fillStyle = GROUND; ctx.fillRect(0, 0, W, H)
  // the photograph, a print with a white border
  ctx.fillStyle = '#fff'; ctx.fillRect(48, 48, 984, 824)
  cover(ctx, img, 64, 64, 952, 792)
  // day and place
  display(ctx, 132); ctx.fillStyle = INK; ctx.textBaseline = 'alphabetic'
  ctx.fillText(s.day ? `DAY ${s.day}` : 'SOON', 64, 1010)
  mono(ctx, 22, 500, 0.12); ctx.fillStyle = INK2
  ctx.fillText(`${s.place.toUpperCase()} · ${s.date.toUpperCase()}`, 64, 1052)
  routeLine(ctx, state, 720, 880, 296, 210, { walked: GOLD, ahead: LINE, dot: INK, label: INK3 })
  // the figures
  ctx.fillStyle = LINE; ctx.fillRect(64, 1100, 952, 2)
  const cols = [[`${s.km.toFixed(0)}`, 'km walked'], [`${s.pct.toFixed(0)}%`, `of ${s.totalKm.toFixed(0)} km`], [`≈${(s.steps / 1000).toFixed(0)}k`, 'steps'], [`${s.toGo.toFixed(0)}`, 'km to go']]
  cols.forEach((c, i) => stat(ctx, 64 + i * 238, 1210, c[0], c[1], INK, INK3, 96))
  ctx.fillStyle = GOLD; ctx.fillRect(64, 1252, Math.max(6, 952 * s.pct / 100), 8); ctx.fillStyle = LINE; ctx.fillRect(64 + 952 * s.pct / 100, 1252, 952 * (1 - s.pct / 100), 8)
  mono(ctx, 18, 400, 0.08); ctx.fillStyle = INK3
  const foot = [s.next ? `Next ${s.next.name}, ${s.next.km} km` : null, s.eta ? `Santiago ${s.eta}` : null, url.replace(/^https?:\/\//, '')].filter(Boolean).join('  ·  ')
  ctx.fillText(foot, 64, 1306)
}

function postcard(ctx: Ctx, state: ClientState, s: Stats, img: HTMLImageElement, url: string) {
  const W = 1500, H = 1000
  ctx.fillStyle = '#FBFBF8'; ctx.fillRect(0, 0, W, H)
  cover(ctx, img, 0, 0, 880, H)
  // the message side
  const L = 930
  ctx.fillStyle = LINE; ctx.fillRect(905, 60, 2, H - 120)
  // stamp, perforated
  const sx = 1330, sy = 60, sw = 120, sh = 144
  ctx.fillStyle = GOLD; ctx.fillRect(sx, sy, sw, sh)
  ctx.fillStyle = '#FBFBF8'
  for (let i = 0; i <= sw; i += 12) { ctx.beginPath(); ctx.arc(sx + i, sy, 4, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(sx + i, sy + sh, 4, 0, Math.PI * 2); ctx.fill() }
  for (let i = 0; i <= sh; i += 12) { ctx.beginPath(); ctx.arc(sx, sy + i, 4, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(sx + sw, sy + i, 4, 0, Math.PI * 2); ctx.fill() }
  shell(ctx, sx + sw / 2, sy + 52, 34, INK)
  mono(ctx, 13, 500, 0.14); ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'
  ctx.fillText('ULTREIA', sx + sw / 2, sy + sh - 18); ctx.textAlign = 'left'
  // postmark
  const px = 1215, py = 132
  ctx.strokeStyle = INK2; ctx.lineWidth = 3
  ctx.beginPath(); ctx.arc(px, py, 66, 0, Math.PI * 2); ctx.stroke()
  ctx.beginPath(); ctx.arc(px, py, 56, 0, Math.PI * 2); ctx.stroke()
  mono(ctx, 13, 500, 0.1); ctx.fillStyle = INK2; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(s.place.replace(/^towards /, '').toUpperCase().slice(0, 16), px, py - 22)
  ctx.fillText(s.date.toUpperCase(), px, py)
  ctx.fillText(`KM ${s.km.toFixed(0)}`, px, py + 22)
  ctx.textAlign = 'left'
  for (let k = 0; k < 4; k++) { ctx.beginPath(); for (let i = 0; i <= 80; i += 2) { const x = px + 74 + i, y = py - 30 + k * 20 + Math.sin(i / 6) * 4; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y) } ctx.stroke() }
  // the address, which writes itself
  const who = state.walk.walkers.map(w => w.name).join(' and ')
  serif(ctx, 34, true); ctx.fillStyle = INK; ctx.textBaseline = 'alphabetic'
  ctx.fillText(`Greetings from ${s.place.replace(/^towards /, 'the road to ')},`, L, 330)
  serif(ctx, 30); ctx.fillStyle = INK2
  const lines = [
    `${who}, ${s.day ? `day ${s.day}` : 'setting off'}.`,
    `${s.km.toFixed(0)} km walked, ${s.toGo.toFixed(0)} to go — ${s.pct.toFixed(0)}% of the way.`,
    `About ${s.steps.toLocaleString('en-GB')} steps so far.`,
    s.next ? `Tomorrow ${s.next.name}, ${s.next.km} km.` : '',
    s.eta ? `Santiago ${s.eta}.` : '',
  ].filter(Boolean)
  let y = 390
  for (const l of lines) for (const w of wrap(ctx, l, 500)) { ctx.fillText(w, L, y); y += 44 }
  // ruled address lines
  ctx.strokeStyle = LINE; ctx.lineWidth = 2
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(L, 760 + i * 52); ctx.lineTo(1440, 760 + i * 52); ctx.stroke() }
  serif(ctx, 28); ctx.fillStyle = INK
  ctx.fillText(`To everyone at home`, L, 752); ctx.fillText(`Follow along:`, L, 804)
  mono(ctx, 22, 500, 0.04); ctx.fillStyle = AZUL; ctx.fillText(url.replace(/^https?:\/\//, ''), L, 856)
  routeLine(ctx, state, 930, 880, 240, 100, { walked: GOLD, ahead: LINE, dot: INK, label: INK3 })
  // the photo's own caption, on the picture
  mono(ctx, 18, 500, 0.12); ctx.fillStyle = 'rgba(255,255,255,.92)'
  ctx.fillText(`${s.place.replace(/^towards /, '').toUpperCase()} · ${s.date.toUpperCase()}`, 40, H - 40)
}

function night(ctx: Ctx, state: ClientState, s: Stats, img: HTMLImageElement, url: string) {
  const W = 1080, H = 1350
  ctx.fillStyle = '#0E1418'; ctx.fillRect(0, 0, W, H)
  ctx.save(); rounded(ctx, 0, 0, W, 820, 0); ctx.clip(); cover(ctx, img, 0, 0, W, 820); ctx.restore()
  const g = ctx.createLinearGradient(0, 520, 0, 820); g.addColorStop(0, 'rgba(14,20,24,0)'); g.addColorStop(1, 'rgba(14,20,24,1)')
  ctx.fillStyle = g; ctx.fillRect(0, 520, W, 300)
  mono(ctx, 22, 500, 0.14); ctx.fillStyle = GOLD; ctx.textBaseline = 'alphabetic'
  ctx.fillText(`${s.day ? `DAY ${s.day}  ·  ` : ''}${s.place.toUpperCase()}`, 64, 700)
  display(ctx, 190); ctx.fillStyle = '#E4E7E4'
  ctx.fillText(`${s.km.toFixed(0)}`, 64, 852)
  const wKm = ctx.measureText(`${s.km.toFixed(0)}`).width
  display(ctx, 64); ctx.fillStyle = GOLD; ctx.fillText('KM', 64 + wKm + 18, 852)
  mono(ctx, 22, 400, 0.1); ctx.fillStyle = '#9BA5AD'
  ctx.fillText(`${s.toGo.toFixed(0)} TO GO`, 64, 900)
  // The coast runs north to south, so the line gets a tall column beside
  // the figures rather than a strip under them.
  routeLine(ctx, state, 720, 640, 296, 600, { walked: GOLD, ahead: '#2E363E', dot: '#E4E7E4', label: '#6E7982' })
  mono(ctx, 18, 400, 0.1); ctx.fillStyle = '#9BA5AD'
  const rows = [[`${s.pct.toFixed(0)}%`, `of ${s.totalKm.toFixed(0)} km`], [`≈${s.steps.toLocaleString('en-GB')}`, 'steps'], s.next ? [`${s.next.km} km`, `to ${s.next.name} tomorrow`] : null].filter(Boolean) as string[][]
  rows.forEach((r, i) => { display(ctx, 54); ctx.fillStyle = '#E4E7E4'; ctx.fillText(r[0], 64, 1010 + i * 92); mono(ctx, 17, 400, 0.1); ctx.fillStyle = '#6E7982'; ctx.fillText(r[1].toUpperCase(), 64, 1040 + i * 92) })
  ctx.fillStyle = '#2E363E'; ctx.fillRect(64, 1268, 952, 1)
  mono(ctx, 18, 400, 0.08); ctx.fillStyle = '#6E7982'
  const foot = [s.date, s.eta ? `Santiago ${s.eta}` : null, url.replace(/^https?:\/\//, '')].filter(Boolean).join('  ·  ')
  ctx.fillText(foot, 64, 1306)
  shell(ctx, W - 96, 1296, 22, GOLD)
}

export const SIZE: Record<Design, [number, number]> = { print: [1080, 1350], postcard: [1500, 1000], night: [1080, 1350] }

export function render(design: Design, state: ClientState, s: Stats, img: HTMLImageElement, url: string, scale = 1): HTMLCanvasElement {
  const [W, H] = SIZE[design]
  const c = document.createElement('canvas')
  c.width = Math.round(W * scale); c.height = Math.round(H * scale)
  const ctx = c.getContext('2d') as Ctx
  ctx.scale(scale, scale)
  ;({ print, postcard, night })[design](ctx, state, s, img, url)
  return c
}

export function toJpeg(c: HTMLCanvasElement): Promise<Blob> {
  return new Promise((r, j) => c.toBlob(b => b ? r(b) : j(new Error('could not make the picture')), 'image/jpeg', 0.9))
}
