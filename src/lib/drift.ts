// When a picture lands off the line.
//
// Ju and Jit turned inland at Vila do Conde and never tapped the fork card,
// so for two days every photograph they posted was more than three
// kilometres from the coast road the map was drawing. The app placed none of
// them, moved nothing, and said nothing: the family's page showed a pair
// stopped at Vila do Conde while they walked to Barcelos.
//
// Silence was the bug. A point that is far from the planned line but close
// to a way they could have taken is not a mystery — it is an unanswered
// question, and this works out which one to ask.

import { CAMINOS } from '@/data/caminos'
import { buildRoute, snapToRoute } from '@/lib/route'

export type Suggestion = {
  forkId: string
  optionId: string
  question: string
  label: string
  offKm: number          // how far off the planned line they are
  thenOffKm: number      // how far off the suggested way would be
}

export type Drift = {
  offKm: number
  suggestion: Suggestion | null
}

// Is this point off the plan, and is there a fork that explains it?
export function driftAt(
  caminoId: string,
  plan: string[],
  choices: Record<string, string>,
  at: [number, number],
  tolerance = 3,
): Drift | null {
  const camino = CAMINOS[caminoId]
  if (!camino) return null
  const planned = snapToRoute(buildRoute(caminoId, plan, choices), at)
  if (planned.offKm <= tolerance) return null              // on the line: nothing to say

  let best: Suggestion | null = null
  for (const fork of camino.forks) {
    if (choices[fork.id]) continue                          // already answered
    for (const opt of fork.options) {
      if (!opt.chain.length && !opt.then) continue          // "as planned" is what they are off
      const trial = snapToRoute(buildRoute(caminoId, plan, { ...choices, [fork.id]: opt.id }), at)
      if (trial.offKm > tolerance) continue                 // that way doesn't explain it either
      if (best && best.thenOffKm <= trial.offKm) continue
      best = {
        forkId: fork.id, optionId: opt.id, question: fork.question, label: opt.label,
        offKm: +planned.offKm.toFixed(1), thenOffKm: +trial.offKm.toFixed(2),
      }
    }
  }
  return { offKm: +planned.offKm.toFixed(1), suggestion: best }
}

// The same question, asked of a walk's recent located posts rather than of
// one point: what the walkers' screen shows when nothing is being placed.
export function driftOf(
  caminoId: string,
  plan: string[],
  choices: Record<string, string>,
  posts: { km: number | null; lat: number | null; lng: number | null; taken_at: string }[],
  tolerance = 3,
): { unplaced: number; suggestion: Suggestion | null } {
  // Newest first; stop at the first one that did find the line.
  const recent = [...posts].sort((a, b) => (a.taken_at < b.taken_at ? 1 : -1))
  const stray: [number, number][] = []
  for (const p of recent) {
    if (p.lat == null || p.lng == null) continue
    if (p.km != null) break
    stray.push([p.lng, p.lat])
    if (stray.length >= 8) break
  }
  if (!stray.length) return { unplaced: 0, suggestion: null }
  // The newest stray point decides which way to suggest; the older ones only
  // say how long this has been going on.
  const d = driftAt(caminoId, plan, choices, stray[0], tolerance)
  return { unplaced: stray.length, suggestion: d?.suggestion ?? null }
}
