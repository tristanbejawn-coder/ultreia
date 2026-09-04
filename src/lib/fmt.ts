// Dates and times formatted by hand, in the walk's timezone, so the server
// and the phone produce identical text (Node and browsers disagree on
// things like "Sep" vs "Sept").
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function parts(d: Date, tz: string) {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
  const p: Record<string, string> = {}
  for (const x of f.formatToParts(d)) p[x.type] = x.value
  return p
}
export function fmtDate(iso: string | Date, tz = 'Europe/Lisbon'): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  const p = parts(d, tz)
  const wd = DAYS.indexOf(p.weekday.slice(0, 3)) >= 0 ? p.weekday.slice(0, 3) : p.weekday
  return `${wd} ${Number(p.day)} ${MONTHS[Number(p.month) - 1]}`
}
export function fmtTime(iso: string | Date, tz = 'Europe/Lisbon'): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  const p = parts(d, tz)
  return `${p.hour === '24' ? '00' : p.hour}:${p.minute}`
}
// A calendar date (YYYY-MM-DD) plus n days, as "Thu 10 Sep"
export function fmtDatePlus(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + days, 12))
  return `${DAYS[t.getUTCDay()]} ${t.getUTCDate()} ${MONTHS[t.getUTCMonth()]}`
}
