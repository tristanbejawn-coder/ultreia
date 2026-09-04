// Ju & Jit, drawn from their photo. Single-weight ink, no faces, walking
// right. Jit leads: short crop, collared shirt, the strap across his chest.
// Ju a step behind: long hair with a fringe, the quilted jacket. Both with
// packs, because they will have packs.
//
// One drawing, used at 34 px on the map marker and large on the arrival
// screen; `ink` is the figure colour, `bg` is what shows through the strap
// and the quilting (the colour they sit on).

export function figuresSvg(size = 34, ink = '#1B2430', bg = '#F0B429'): string {
  const w = (n: number) => `stroke="${ink}" stroke-width="${n}" stroke-linecap="round" stroke-linejoin="round" fill="none"`
  return `<svg viewBox="0 0 46 40" width="${size}" height="${size * 40 / 46}" aria-hidden="true">
  <!-- Jit -->
  <rect x="7.6" y="13.2" width="4.2" height="9.4" rx="1.6" fill="${ink}"/>
  <path d="M14 13.6 L13.6 23.2" ${w(5.2)}/>
  <path d="M11.6 13.6 L16.4 22.6" stroke="${bg}" stroke-width="1.1" stroke-linecap="round" fill="none"/>
  <path d="M12.4 12.2 L14 14.4 L15.6 12.2" ${w(1.2)}/>
  <path d="M13.6 23.2 L10.6 29.6 L9.2 36.4 M13.6 23.2 L17 29.2 L18.6 36.4" ${w(2.2)}/>
  <path d="M14 14.2 L10.4 20.6 M14 14.2 L18 19.8" ${w(2)}/>
  <circle cx="14" cy="8" r="3.6" ${w(1.4)}/>
  <path d="M10.6 7.4 A3.6 3.6 0 0 1 17.4 7.4 Z" fill="${ink}"/>
  <!-- Ju -->
  <rect x="23.4" y="17.2" width="3.6" height="7.8" rx="1.4" fill="${ink}"/>
  <path d="M30 16.2 L29.6 26" ${w(5.4)}/>
  <path d="M27.8 19.2 H32.2 M27.7 21.8 H32.1 M27.6 24.3 H32" stroke="${bg}" stroke-width="0.9" stroke-linecap="round" fill="none"/>
  <path d="M29.6 26 L27.2 31.6 L26.2 37 M29.6 26 L32.2 31.2 L33.4 37" ${w(2)}/>
  <path d="M30 18 L32.8 23.2" ${w(1.8)}/>
  <circle cx="30" cy="12" r="3.4" ${w(1.4)}/>
  <path d="M26.65 11.4 A3.4 3.4 0 0 1 33.35 11.4 Z" fill="${ink}"/>
  <path d="M26.7 11.2 C25.2 13.6 24.6 16.6 25.2 20.2 L27.3 20.2 C27 17 27.3 14.4 28.4 12.8 Z" fill="${ink}"/>
  <path d="M33.3 11.2 C34.3 13.4 34.5 15.8 34 18.4 L32.8 18.4 C33.1 16 32.9 14.2 32.2 12.8 Z" fill="${ink}"/>
</svg>`
}

export default function Figures({ size = 34, ink = '#1B2430', bg = '#F0B429' }: { size?: number; ink?: string; bg?: string }) {
  return <span style={{ display: 'inline-block', lineHeight: 0 }} dangerouslySetInnerHTML={{ __html: figuresSvg(size, ink, bg) }} />
}
