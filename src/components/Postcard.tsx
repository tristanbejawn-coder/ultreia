// A message from home, as a postcard: the words on the left in a hand, the
// stamp and the postmark on the right, and an address that writes itself
// from wherever the walkers were when the post went out. The family's wall
// and the walkers' own screen draw the same card.

import type { MessageRow } from '@/lib/walk'
import { fmtDate } from '@/lib/fmt'

export function Stamp({ size = 44 }: { size?: number }) {
  return (
    <svg className="pc-stamp" viewBox="0 0 44 52" width={size} height={size * 52 / 44} aria-hidden="true">
      <rect x="2" y="2" width="40" height="48" fill="var(--arrow)" />
      {Array.from({ length: 8 }, (_, i) => <circle key={`t${i}`} cx={2 + i * 5.7} cy="2" r="1.6" fill="var(--surface)" />)}
      {Array.from({ length: 8 }, (_, i) => <circle key={`b${i}`} cx={2 + i * 5.7} cy="50" r="1.6" fill="var(--surface)" />)}
      {Array.from({ length: 9 }, (_, i) => <circle key={`l${i}`} cx="2" cy={2 + i * 6} r="1.6" fill="var(--surface)" />)}
      {Array.from({ length: 9 }, (_, i) => <circle key={`r${i}`} cx="42" cy={2 + i * 6} r="1.6" fill="var(--surface)" />)}
      <g fill="none" stroke="#1B2430" strokeWidth="1.6" strokeLinecap="round">
        <path d="M11 27a11 11 0 0 1 22 0" />
        {Array.from({ length: 7 }, (_, i) => { const a = Math.PI * (1.12 + 0.76 * i / 6); return <path key={i} d={`M22 33 L${(22 + Math.cos(a) * 11).toFixed(1)} ${(27 + Math.sin(a) * 11).toFixed(1)}`} /> })}
        <path d="M19 33h6" />
      </g>
      <text x="22" y="45" textAnchor="middle" fontFamily="DM Mono, monospace" fontSize="5.5" fill="#1B2430" letterSpacing=".8">ULTREIA</text>
    </svg>
  )
}

export default function Postcard({ m, walkers, tz, camino }: { m: MessageRow; walkers: string; tz: string; camino: string }) {
  const franked = !!m.delivered_at
  const when = fmtDate(m.delivered_at || m.written_at, tz)
  return (
    <article className={`pc${m.private ? ' sealed' : ''}`}>
      <div className="pc-msg">
        <p>{m.body}</p>
        <div className="pc-from">— {m.from_name}{m.from_place ? `, ${m.from_place}` : ''}</div>
      </div>
      <div className="pc-rule" aria-hidden="true" />
      <div className="pc-side">
        <div className="pc-top">
          <div className={`pc-mark${franked ? '' : ' waiting'}`}>
            {franked
              ? <>{(m.at_place || camino).toUpperCase()}<br />{when.toUpperCase()}{m.at_km != null ? <><br />KM {Math.round(m.at_km)}</> : null}</>
              : <>IN THE POST<br />GOES AT 19:00</>}
          </div>
          <Stamp />
        </div>
        <address className="pc-to">
          To {walkers}<br />
          {camino}<br />
          {franked ? (m.at_place ? `near ${m.at_place}${m.at_km != null ? ` · km ${Math.round(m.at_km)}` : ''}` : 'on the road') : 'wherever they are at 19:00'}
        </address>
        {m.private && <span className="pc-seal">Sealed · just for them</span>}
      </div>
    </article>
  )
}
