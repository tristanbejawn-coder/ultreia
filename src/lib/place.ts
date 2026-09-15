// Where a kilometre is, in the names the family knows. Used by the status
// line and by the stones that mark the end of each day.
type Leg = { from: string; to: string; km: number; endKm: number }

export function placeAtKm(legs: Leg[], km: number, near = 1.2): string {
  const leg = legs.find(x => km >= x.km - 0.05 && km <= x.endKm + 0.05) ?? legs[legs.length - 1]
  if (!leg) return ''
  if (km >= leg.endKm - near) return leg.to
  if (km <= leg.km + near) return leg.from
  return `${leg.from} → ${leg.to}`
}

// Which day of the walk it is where they are, counted on the calendar rather
// than by which stage they are on: a 35 km first stage takes two days, and
// the second of them is still day two.
export function dayOfWalk(startsOn: string | null, timezone: string, now = new Date()): number | null {
  if (!startsOn) return null
  const local = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  const days = Math.round((Date.parse(local) - Date.parse(startsOn)) / 86400000)
  return days < 0 ? null : days + 1
}
