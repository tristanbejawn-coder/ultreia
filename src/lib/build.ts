// The build the phone is actually running, for the stamp on the map.
// Inlined at build time by next.config.ts.
export const BUILD_SHA = process.env.NEXT_PUBLIC_BUILD_SHA || 'local'
export const BUILT_AT = process.env.NEXT_PUBLIC_BUILT_AT || ''

// "14 Sep 08:12" in the walk's own words — short enough for a corner.
export function buildLabel(): string {
  if (!BUILT_AT) return BUILD_SHA
  const d = new Date(BUILT_AT)
  if (isNaN(d.getTime())) return BUILD_SHA
  const day = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/Lisbon' })
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Lisbon' })
  return `${day} ${time}`
}
