// The two walkers. Placeholder ink drawing until the real figures are drawn
// from Ju & Jit's photo; the map marker, the icon and the arrival screen
// all use this one component.
export default function Figures({ size = 34, color = '#1B2430' }: { size?: number; color?: string }) {
  const s = { stroke: color, strokeWidth: 2.2, strokeLinecap: 'round' as const, fill: 'none' }
  const walker = (dx: number, lead: boolean) => (
    <g transform={`translate(${dx} 0)`}>
      <circle cx="0" cy="-15" r="3.6" fill={color} />
      <path d="M0 -11 L-.6 0" {...s} />
      <path d={lead ? 'M-.6 0 L-5 9 M-.6 0 L4.5 8' : 'M-.6 0 L-4 9 M-.6 0 L3.5 9'} {...s} />
      <path d="M0 -8 L5.5 -2" {...s} />
      <path d="M5.5 -2 L7 10" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M-1.5 -12 q-5 3 -4 9 q3 2 5 0" fill={color} stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </g>
  )
  return (
    <svg className="fig-placeholder" viewBox="-20 -22 40 36" width={size} height={size} aria-hidden="true">
      {walker(-7, true)}
      {walker(7, false)}
    </svg>
  )
}

// Same drawing as a string, for map markers that live outside React.
export function figuresSvg(size = 34, color = '#1B2430'): string {
  const s = `stroke="${color}" stroke-width="2.2" stroke-linecap="round" fill="none"`
  const walker = (dx: number, lead: boolean) => `<g transform="translate(${dx} 0)">
    <circle cx="0" cy="-15" r="3.6" fill="${color}"/>
    <path d="M0 -11 L-.6 0" ${s}/>
    <path d="${lead ? 'M-.6 0 L-5 9 M-.6 0 L4.5 8' : 'M-.6 0 L-4 9 M-.6 0 L3.5 9'}" ${s}/>
    <path d="M0 -8 L5.5 -2" ${s}/>
    <path d="M5.5 -2 L7 10" stroke="${color}" stroke-width="1.5" stroke-linecap="round" fill="none"/>
    <path d="M-1.5 -12 q-5 3 -4 9 q3 2 5 0" fill="${color}" stroke="${color}" stroke-width="1.5" stroke-linejoin="round"/>
  </g>`
  return `<svg viewBox="-20 -22 40 36" width="${size}" height="${size}" aria-hidden="true">${walker(-7, true)}${walker(7, false)}</svg>`
}
