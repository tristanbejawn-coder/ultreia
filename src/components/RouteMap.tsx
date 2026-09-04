'use client'
// The hero: satellite imagery, the walked trail in gold, the road ahead as a
// pale dashed line, photo prints and diary rings where they were taken, and
// the two figures at today's kilometre. On first load the camera shows the
// whole route, then dives to where they are.

import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { figuresSvg } from './Figures'
import { LORE } from '@/data/lore'
import type { ClientState } from '@/lib/walk'

type Props = {
  state: ClientState
  tileUrl: string
  attribution: string
  terrainUrl?: string | null
  onOpenPost?: (id: string) => void
}

// Rough metres between two lng/lat, good enough for "is this near the route".
function distKm(a: [number, number], b: [number, number]): number {
  const x = (a[0] - b[0]) * Math.cos((a[1] + b[1]) * Math.PI / 360), y = a[1] - b[1]
  return Math.hypot(x, y) * 111.32
}

function pointAt(points: [number, number, number][], km: number): [number, number] {
  if (!points.length) return [0, 0]
  if (km <= 0) return [points[0][0], points[0][1]]
  for (let i = 1; i < points.length; i++) {
    if (points[i][2] >= km) {
      const a = points[i - 1], b = points[i]
      const t = b[2] === a[2] ? 0 : (km - a[2]) / (b[2] - a[2])
      return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]
    }
  }
  const l = points[points.length - 1]
  return [l[0], l[1]]
}

export default function RouteMap({ state, tileUrl, attribution, terrainUrl, onOpenPost }: Props) {
  const el = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)

  useEffect(() => {
    if (!el.current || mapRef.current) return
    const pts = state.route.points
    const km = state.position.km
    const walked: [number, number][] = [], ahead: [number, number][] = []
    const cut = pointAt(pts, km)
    for (const p of pts) (p[2] <= km ? walked : ahead).push([p[0], p[1]])
    walked.push(cut); ahead.unshift(cut)

    const map = new maplibregl.Map({
      container: el.current,
      style: {
        version: 8,
        sources: {
          sat: { type: 'raster', tiles: [tileUrl], tileSize: 256, attribution, maxzoom: 18 },
          ...(terrainUrl ? { dem: { type: 'raster-dem', tiles: [terrainUrl], tileSize: 256, encoding: 'terrarium', maxzoom: 14 } } : {}),
        },
        layers: [
          { id: 'bg', type: 'background', paint: { 'background-color': '#0E1418' } },
          { id: 'sat', type: 'raster', source: 'sat', paint: { 'raster-saturation': -0.25, 'raster-brightness-max': 0.85, 'raster-contrast': 0.05 } },
          // A soft hillshade over the imagery gives the coast its cliffs and
          // Galicia its hills without turning the map into a game.
          ...(terrainUrl ? [{ id: 'shade', type: 'hillshade' as const, source: 'dem', paint: { 'hillshade-exaggeration': 0.18, 'hillshade-shadow-color': '#06090C', 'hillshade-highlight-color': '#E4E7E4', 'hillshade-accent-color': '#0E1418', 'hillshade-illumination-direction': 315 } }] : []),
        ],
        ...(terrainUrl ? { terrain: { source: 'dem', exaggeration: 1.35 } } : {}),
      },
      center: cut, zoom: 8, pitch: 0, attributionControl: false,
      cooperativeGestures: false,   // one finger moves the map, two fingers zoom
    })
    mapRef.current = map
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')

    map.once('style.load', () => {
      map.addSource('ahead', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: ahead } } })
      map.addSource('walked', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: walked } } })
      map.addLayer({ id: 'ahead-line', type: 'line', source: 'ahead', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#F0B429', 'line-width': 2.5, 'line-opacity': 0.8, 'line-dasharray': [1.6, 1.8] } })
      map.addLayer({ id: 'walked-glow', type: 'line', source: 'walked', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#F0B429', 'line-width': 16, 'line-opacity': 0.28, 'line-blur': 6 } })
      map.addLayer({ id: 'walked-line', type: 'line', source: 'walked', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#F0B429', 'line-width': 4 } })

      // Stage towns. Zoomed right out only the ends are named; the rest
      // appear once there's room for them.
      const labels: { el: HTMLElement; always: boolean }[] = []
      const addLabel = (at: [number, number], text: string, always: boolean) => {
        const d = document.createElement('div'); d.className = 'mk-node'; d.textContent = text
        new maplibregl.Marker({ element: d, anchor: 'top', offset: [0, 8] }).setLngLat(at).addTo(map)
        labels.push({ el: d, always })
      }
      state.route.segments.forEach((s, i) => addLabel(pointAt(pts, s.km), s.from, i === 0))
      addLabel(pointAt(pts, state.route.totalKm), 'Santiago', true)
      // Labels appear once there's room, and never under the header.
      const showLabels = () => {
        const z = map.getZoom()
        for (const l of labels) {
          const m = l.el.parentElement as HTMLElement | null   // the marker wrapper carries the transform
          const under = m ? m.getBoundingClientRect().top - map.getContainer().getBoundingClientRect().top < 120 : false
          l.el.style.display = (l.always || z >= 9.2) && !under ? '' : 'none'
        }
      }
      map.on('zoom', showLabels); map.on('move', showLabels); showLabels()

      // Marker layering, bottom to top: facts, check-ins, photos, then them.
      const layer = (m: maplibregl.Marker, z: number) => {
        const w = m.getElement().parentElement as HTMLElement | null
        if (w) w.style.zIndex = String(z)
      }
      // Where the things a fact must not hide behind are standing.
      const occupied: [number, number][] = []

      // Posts
      const located = state.posts.filter(p => p.km != null && (p.kind === 'photo' || p.kind === 'clip' || p.kind === 'diary' || p.kind === 'checkin' || p.kind === 'ping'))
      let i = 0
      for (const p of located) {
        const at = pointAt(pts, p.km as number)
        let m: HTMLElement
        if (p.kind === 'checkin' || p.kind === 'ping') { m = document.createElement('div'); m.className = 'mk-checkin' }
        else if (p.kind === 'diary') { m = document.createElement('button'); m.className = 'mk-diary'; m.setAttribute('aria-label', 'Diary entry') }
        else {
          m = document.createElement('button'); m.className = 'mk-photo'; m.setAttribute('aria-label', p.caption || 'Photo')
          const src = p.posterUrl || p.mediaUrl
          if (src) m.style.backgroundImage = `url("${src}")`
          m.style.transform = `rotate(${((i++ % 5) - 2) * 4}deg)`
        }
        if (p.kind !== 'checkin' && p.kind !== 'ping' && onOpenPost) m.addEventListener('click', () => onOpenPost(p.id))
        layer(new maplibregl.Marker({ element: m, anchor: 'center' }).setLngLat(at).addTo(map), p.kind === 'checkin' || p.kind === 'ping' ? 2 : 4)
        occupied.push(at)
      }

      // Facts standing on the ground they cross. Only the ones the chosen
      // route passes near, so the Espiritual's monastery appears only if they
      // take the boat.
      //
      // Touch is the whole problem here. A ring small enough to stay quieter
      // than a photograph is far smaller than a thumb, so the markers take no
      // pointer events at all: the map itself handles the tap and opens the
      // nearest fact within a finger's width. Nothing to hit exactly, and
      // nothing swallowing a drag when you meant to pan. Facts also stand
      // down when they'd collide with a photograph, with the walkers, or with
      // each other, so whatever is showing is always reachable.
      const TAP_PX = 34, CLEAR_PX = 32
      const pop = new maplibregl.Popup({ closeButton: true, maxWidth: '272px', offset: 18, className: 'lore-pop' })
      type LoreMarker = { l: (typeof LORE)[number]; el: HTMLElement; shown: boolean }
      const loreMarks: LoreMarker[] = []
      for (const l of LORE) {
        let off = Infinity
        for (const p of pts) { const d = distKm(l.at, [p[0], p[1]]); if (d < off) off = d; if (off < 0.4) break }
        if (off > 5) continue
        const m = document.createElement('div')
        m.className = `mk-lore k-${l.kind}`
        m.title = l.title
        layer(new maplibregl.Marker({ element: m, anchor: 'center' }).setLngLat(l.at).addTo(map), 1)
        loreMarks.push({ l, el: m, shown: false })
      }

      const openLore = (f: LoreMarker) => {
        const card = document.createElement('div')
        card.className = 'lore-card'
        const h = document.createElement('h3'); h.textContent = f.l.title
        const t = document.createElement('p'); t.textContent = f.l.text
        card.append(h, t)
        pop.setLngLat(f.l.at).setDOMContent(card).addTo(map)
        for (const o of loreMarks) o.el.classList.toggle('open', o === f)
        pop.once('close', () => f.el.classList.remove('open'))
      }

      // Which facts can be seen — and therefore tapped — right now.
      const placeLore = () => {
        const on = map.getZoom() >= 9.4
        const taken = occupied.map(c => map.project(c))
        for (const f of loreMarks) {
          let show = on
          if (show) {
            const at = map.project(f.l.at)
            for (const t of taken) {
              const near = Math.hypot(at.x - t.x, at.y - t.y)
              if (near < CLEAR_PX) { show = false; break }
            }
            if (show) { taken.push(at) }
          }
          f.shown = show
          f.el.classList.toggle('on', show)
        }
      }
      // A tap opens the nearest fact within a thumb's width of where it landed.
      const nearestLore = (pt: { x: number; y: number }): LoreMarker | null => {
        let best: LoreMarker | null = null, bestD = TAP_PX
        for (const f of loreMarks) {
          if (!f.shown) continue
          const at = map.project(f.l.at)
          const d = Math.hypot(at.x - pt.x, at.y - pt.y)
          if (d < bestD) { bestD = d; best = f }
        }
        return best
      }
      map.on('click', e => { const f = nearestLore(e.point); if (f) openLore(f) })
      map.on('mousemove', e => {
        const f = nearestLore(e.point)
        map.getCanvas().style.cursor = f ? 'pointer' : ''
        for (const o of loreMarks) o.el.classList.toggle('near', o === f)
      })
      map.on('move', placeLore); map.on('zoom', placeLore); placeLore()

      // The figures
      const f = document.createElement('div')
      if (state.walk.avatarUrl) { f.className = 'mk-them'; f.style.backgroundImage = `url("${state.walk.avatarUrl}")` }
      else { f.className = 'mk-figs'; f.innerHTML = figuresSvg(34, '#1B2430') }
      f.title = state.position.segment ? `${state.walk.name} · ${state.position.segment.name}` : state.walk.name
      layer(new maplibregl.Marker({ element: f, anchor: 'center' }).setLngLat(cut).addTo(map), 6)

      // Camera: whole route first, then dive to them
      const bounds = pts.reduce((b, p) => b.extend([p[0], p[1]]), new maplibregl.LngLatBounds(pts[0].slice(0, 2) as [number, number], pts[0].slice(0, 2) as [number, number]))
      map.fitBounds(bounds, { padding: { top: 120, bottom: 110, left: 40, right: 40 }, duration: 0 })
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (state.started && !state.finished) {
        // Land on the story, not on a hillside: sit behind them, looking the
        // way they are walking, with the last stretch of gold and the
        // photographs on it filling the frame. Fixed scale beats fitting a
        // bounding box, which a 50-degree pitch throws off badly.
        const behind = pointAt(pts, Math.max(0, km - 9))
        const from = pointAt(pts, Math.max(0, km - 26))
        const heading = (() => {
          const dx = (cut[0] - from[0]) * Math.cos(cut[1] * Math.PI / 180), dy = cut[1] - from[1]
          if (!dx && !dy) return -18
          return (Math.atan2(dx, dy) * 180) / Math.PI    // 0 = north, the way they're going
        })()
        // Early on there is little walked line, so sit closer in.
        const zoom = km < 6 ? 12.4 : km < 16 ? 11.6 : 11.0
        setTimeout(() => map.flyTo({ center: behind, zoom, pitch: terrainUrl ? 52 : 42, bearing: heading, duration: reduce ? 0 : 3400, essential: true }), reduce ? 0 : 2000)
      } else if (!state.started) {
        // Countdown: a slow push-in onto the start, so the relief shows
        setTimeout(() => map.flyTo({ center: cut, zoom: 10.4, pitch: terrainUrl ? 50 : 35, bearing: -12, duration: reduce ? 0 : 4200, essential: true }), reduce ? 0 : 1800)
      }
    })
    return () => { map.remove(); mapRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div ref={el} className="map" role="region" aria-label="Route map" />
}
