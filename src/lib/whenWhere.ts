// Placing a picture by when it was taken.
//
// Android's photo picker hands a browser a copy of the picture with the
// location stripped out and the timestamp left in. Jit spent Friday walking
// from Barcelos to Ponte de Lima with no signal, posted the day's six
// photographs from the albergue at seven in the evening, and every one of
// them landed on the map at the albergue: the app, finding no location in
// the file, had used where the phone was standing at the moment of upload.
//
// The phone's position answers "where am I now", which is only the same
// question when the picture is new. When it isn't, the walk's own track
// answers better: they were somewhere between the two places we do know
// about, in proportion to the clock.

export type Anchor = { km: number; at: number }          // at: epoch ms
export type Placed = { km: number; how: 'between' | 'nearest' }

const MINUTE = 60_000
// Interpolating across a longer gap than this is guesswork, not evidence.
const MAX_SPAN = 10 * 60 * MINUTE
// With only one side to go on, the picture has to be close to it in time.
const NEAR = 90 * MINUTE

export function placeByTime(anchors: Anchor[], at: number, now = Date.now()): Placed | null {
  if (!Number.isFinite(at) || at > now + 5 * MINUTE) return null      // a clock ahead of itself
  const known = anchors.filter(a => Number.isFinite(a.km) && Number.isFinite(a.at)).sort((x, y) => x.at - y.at)
  if (!known.length) return null

  let before: Anchor | null = null, after: Anchor | null = null
  for (const a of known) {
    if (a.at <= at) before = a
    else { after = a; break }
  }

  if (before && after && after.at - before.at <= MAX_SPAN) {
    const t = (at - before.at) / (after.at - before.at)
    const km = before.km + (after.km - before.km) * t
    return { km: +km.toFixed(2), how: 'between' }
  }

  // One side only: good enough if it is close in time, since a walker who
  // has not moved in an hour and a half is having lunch, not teleporting.
  const nearest = known.reduce((best, a) => (Math.abs(a.at - at) < Math.abs(best.at - at) ? a : best), known[0])
  if (Math.abs(nearest.at - at) <= NEAR) return { km: +nearest.km.toFixed(2), how: 'nearest' }
  return null
}

// Is this picture fresh enough that "where the phone is now" is a fair
// answer for where it was taken?
export const FRESH_MS = 20 * MINUTE
export function takenJustNow(takenAt: string | Date | null | undefined, now = Date.now()): boolean {
  if (!takenAt) return true                    // no time in the file: now is all we have
  const t = takenAt instanceof Date ? takenAt.getTime() : Date.parse(takenAt)
  if (!Number.isFinite(t)) return true
  return now - t <= FRESH_MS
}
