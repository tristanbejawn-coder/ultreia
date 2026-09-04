// Ju & Jit, drawn from their photo. Wayfinding-pictogram proportions:
// small heads, long stride, one stroke weight per figure, no faces.
// Jit leads: short crop, collared shirt, the strap across his chest.
// Ju a step behind: long hair with a fringe, the quilted jacket. Packs on
// both. `ink` is the figure colour; `bg` shows through the strap and the
// quilting, so pass the colour they stand on.

export function figuresSvg(size = 34, ink = '#1B2430', bg = '#F0B429'): string {
  const st = (n: number) => `stroke="${ink}" stroke-width="${n}" stroke-linecap="round" stroke-linejoin="round" fill="none"`
  const cut = (n: number) => `stroke="${bg}" stroke-width="${n}" stroke-linecap="round" fill="none"`
  return `<svg viewBox="0 0 46 40" width="${size}" height="${size * 40 / 46}" aria-hidden="true">
  <!-- Jit -->
  <rect x="8.2" y="10.6" width="3.9" height="8.6" rx="1.5" fill="${ink}"/>
  <path d="M13.8 10.2 L13.4 21.6" ${st(4.6)}/>
  <path d="M11.9 10.6 L15.5 20.6" ${cut(1)}/>
  <path d="M12.5 8.8 L13.8 10.9 L15.1 8.8" ${st(1.1)}/>
  <path d="M13.4 21.6 L10.2 28.2 L9.2 36.6 M9.2 36.6 L7.6 36.6" ${st(2.1)}/>
  <path d="M13.4 21.6 L16.8 27.4 L19.4 36.6 M19.4 36.6 L21 36.6" ${st(2.1)}/>
  <path d="M13.8 11.6 L10.8 16.4 L9.6 20.2" ${st(1.8)}/>
  <path d="M13.8 11.6 L17.2 15.4 L19.6 15.2" ${st(1.8)}/>
  <circle cx="13.8" cy="5.4" r="2.9" ${st(1.3)}/>
  <path d="M11.05 4.9 A2.9 2.9 0 0 1 16.55 4.9 Z" fill="${ink}"/>
  <!-- Ju -->
  <rect x="25.4" y="14.4" width="3.6" height="7.6" rx="1.4" fill="${ink}"/>
  <path d="M31 13.6 L30.6 24" ${st(5)}/>
  <path d="M28.9 16.6 H33.1 M28.8 19.2 H33 M28.7 21.7 H32.9" ${cut(0.85)}/>
  <path d="M30.6 24 L28.2 29.6 L27.4 36.6 M27.4 36.6 L26 36.6" ${st(1.9)}/>
  <path d="M30.6 24 L33.2 29 L35.2 36.6 M35.2 36.6 L36.6 36.6" ${st(1.9)}/>
  <path d="M31 15.2 L33.8 18.8 L36 18.4" ${st(1.7)}/>
  <circle cx="31" cy="9" r="2.7" ${st(1.3)}/>
  <path d="M28.35 8.5 A2.7 2.7 0 0 1 33.65 8.5 Z" fill="${ink}"/>
  <path d="M28.5 8.2 C27 10.8 26.6 14 27.2 17.6 L29.2 17.2 C28.9 14.2 29.2 11.8 30.1 10.2 Z" fill="${ink}"/>
  <path d="M33.5 8.2 C34.4 10.4 34.6 12.6 34.2 15 L32.9 15 C33.2 12.8 33 11.2 32.4 10 Z" fill="${ink}"/>
</svg>`
}

export default function Figures({ size = 34, ink = '#1B2430', bg = '#F0B429' }: { size?: number; ink?: string; bg?: string }) {
  return <span style={{ display: 'inline-block', lineHeight: 0 }} dangerouslySetInnerHTML={{ __html: figuresSvg(size, ink, bg) }} />
}
