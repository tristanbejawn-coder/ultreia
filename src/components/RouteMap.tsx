'use client'
// The hero: satellite imagery, the walked trail in gold, the road ahead as a
// pale dashed line, photo prints and diary rings where they were taken, and
// the two figures at today's kilometre. On first load the camera shows the
// whole route, then dives to where they are.

import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { figuresSvg } from './Figures'
import { placeLore, type PlacedLore } from '@/lib/lore'
import type { ClientState } from '@/lib/walk'

type Props = {
  state: ClientState
  tileUrl: string
  attribution: string
  terrainUrl?: string | null
  onOpenPost?: (id: string) => void
  // Fired once the satellite imagery has landed, so anything that talks about
  // what's on the map can wait until there is a map to talk about.
  onReady?: () => void
  // While true the opening flight waits. The welcome sheet sits over the map,
  // and a flight behind it is a flight nobody sees. Released, it starts at
  // once rather than after the usual beat.
  holdFlight?: boolean
  // A fact chosen from the stage card in the sheet: fly to it and open it.
  focusLore?: { id: string; n: number } | null
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

export default function RouteMap({ state, tileUrl, attribution, terrainUrl, onOpenPost, onReady: onReadyProp, holdFlight, focusLore }: Props) {
  // Kept in a ref so a changing callback never re-runs the map's setup effect.
  const readyCb = useRef(onReadyProp)
  readyCb.current = onReadyProp
  const holdRef = useRef(holdFlight)
  holdRef.current = holdFlight
  // The flight the map wanted to run while something was over it.
  const heldFlight = useRef<(() => void) | null>(null)
  const flightRaf = useRef<number | null>(null)
  const el = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const showLoreRef = useRef<((id: string) => void) | null>(null)

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
          const under = l.el.getBoundingClientRect().top - map.getContainer().getBoundingClientRect().top < 120
          l.el.style.display = (l.always || z >= 9.2) && !under ? '' : 'none'
        }
      }
      map.on('zoom', showLabels); map.on('move', showLabels); showLabels()

      // Marker layering, bottom to top: facts, check-ins, photos, then them.
      // MapLibre puts markers straight into the canvas container with no
      // wrapper of their own, so this has to go on the element itself —
      // anything set on the parent lands on the map surface.
      const layer = (m: maplibregl.Marker, z: number) => { m.getElement().style.zIndex = String(z) }
      // The things a fact must not hide behind. Kept as elements, not
      // coordinates: with terrain on, a marker is drawn at its ground
      // elevation, tens of pixels from where the flat projection puts it, so
      // anything measuring where a marker really is has to read the DOM.
      // MapLibre's gesture handling cancels the browser's synthetic click on
      // a tap, so a marker that only listens for 'click' is dead to a thumb —
      // which is exactly what the photographs were. Listen for the touch
      // itself, and treat it as a tap only if the finger barely moved.
      const onTap = (el: HTMLElement, fn: () => void) => {
        let sx = 0, sy = 0, t0 = 0
        el.addEventListener('click', fn)
        el.addEventListener('touchstart', e => {
          const t = e.changedTouches[0]; sx = t.clientX; sy = t.clientY; t0 = Date.now()
        }, { passive: true })
        el.addEventListener('touchend', e => {
          const t = e.changedTouches[0]
          if (Date.now() - t0 > 600 || Math.hypot(t.clientX - sx, t.clientY - sy) > 12) return
          e.preventDefault()          // and no synthetic click after it
          e.stopPropagation()
          fn()
        })
      }

      const occupied: HTMLElement[] = []
      const centreOf = (e: HTMLElement, box: DOMRect) => {
        const r = e.getBoundingClientRect()
        return { x: r.x + r.width / 2 - box.x, y: r.y + r.height / 2 - box.y }
      }

      // Posts
      const located = state.posts.filter(p => p.km != null && (p.kind === 'photo' || p.kind === 'clip' || p.kind === 'diary' || p.kind === 'checkin' || p.kind === 'ping'))
      let i = 0
      const pictures: HTMLElement[] = []
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
        if (p.kind !== 'checkin' && p.kind !== 'ping' && onOpenPost) {
          onTap(m, () => onOpenPost(p.id))
          pictures.push(m)
        }
        layer(new maplibregl.Marker({ element: m, anchor: 'center' }).setLngLat(at).addTo(map), p.kind === 'checkin' || p.kind === 'ping' ? 2 : 4)
        occupied.push(m)
      }

      // A day's walking is a few pixels wide when the whole route is on
      // screen, so photographs land on top of one another: the pile looks
      // like a pile but only its top print can be tapped, and the ones
      // underneath are unreachable at any zoom. So a print that would cover
      // one already standing stands down and hands it its count instead —
      // the same rule the facts below follow. Whatever is showing is
      // tappable, and the lightbox pages through the rest.
      const PILE_PX = 30, THEM_PX = 34
      // Filled in when the figures go on, below; they sit above the prints
      // and are wider than one, so a print under them can't be tapped either.
      let them: HTMLElement | null = null
      const showPictures = () => {
        const box = map.getContainer().getBoundingClientRect()
        const themAt = them && them.isConnected ? centreOf(them, box) : null
        const standing: { x: number; y: number; el: HTMLElement; n: number }[] = []
        const underThem: { x: number; y: number; el: HTMLElement }[] = []

        // First the prints that are in the clear: the first one to claim a
        // patch keeps it, and anything landing on top of it stands down.
        for (const el of pictures) {
          el.style.display = ''
          const c = centreOf(el, box)
          if (themAt && Math.hypot(themAt.x - c.x, themAt.y - c.y) < THEM_PX) { underThem.push({ ...c, el }); continue }
          const over = standing.find(s => Math.hypot(s.x - c.x, s.y - c.y) < PILE_PX)
          if (over) { el.style.display = 'none'; over.n++ }
          else standing.push({ x: c.x, y: c.y, el, n: 1 })
        }

        // Then the ones the figures are covering, handed to whichever print
        // is nearest. Deferred rather than folded in above because the newest
        // photograph is always at the walkers' feet, so it would otherwise be
        // the one print left standing underneath them.
        for (const u of underThem) {
          if (!standing.length) { continue }   // nothing better to give it to
          u.el.style.display = 'none'
          standing.reduce((a, b) => Math.hypot(a.x - u.x, a.y - u.y) <= Math.hypot(b.x - u.x, b.y - u.y) ? a : b).n++
        }

        for (const s of standing) {
          const badge = s.el.querySelector('.n') as HTMLElement | null
          if (s.n > 1) {
            if (badge) badge.textContent = String(s.n)
            else { const b = document.createElement('span'); b.className = 'n'; b.textContent = String(s.n); s.el.appendChild(b) }
          } else if (badge) badge.remove()
        }
      }
      map.on('zoom', showPictures); map.on('move', showPictures); map.on('idle', showPictures)

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
      // closeOnClick would close the card on the very tap that opened it,
      // because the card is opened from inside the map's own click. A tap on
      // open ground closes it instead, just below.
      const pop = new maplibregl.Popup({ closeButton: true, closeOnClick: false, maxWidth: '272px', offset: 18, className: 'lore-pop' })
      // dot, not el: once a name is showing, the element is far wider than
      // the ring, and its centre is not where anyone aims.
      type LoreMarker = { l: PlacedLore; el: HTMLElement; dot: HTMLElement; shown: boolean }
      const loreMarks: LoreMarker[] = []
      for (const l of placeLore(state.route.points.map(p => ({ lng: p[0], lat: p[1], km: p[2] })))) {
        const m = document.createElement('div')
        m.className = `mk-lore k-${l.kind}`
        m.title = l.title
        const dot = document.createElement('i'); dot.className = 'dot'
        const tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = l.label
        m.append(dot, tag)
        layer(new maplibregl.Marker({ element: m, anchor: 'center' }).setLngLat(l.at).addTo(map), 1)
        loreMarks.push({ l, el: m, dot, shown: false })
      }

      const openLore = (f: LoreMarker) => {
        // Hang the card below the ring when the ring is high on the screen,
        // above it when it is low, so it never runs off the top.
        const y = centreOf(f.dot, map.getContainer().getBoundingClientRect()).y
        pop.options.anchor = y < map.getContainer().clientHeight * 0.45 ? 'top' : 'bottom'
        const card = document.createElement('div')
        card.className = 'lore-card'
        const h = document.createElement('h3'); h.textContent = f.l.title
        const t = document.createElement('p'); t.textContent = f.l.text
        card.append(h, t)
        pop.setLngLat(f.l.at).setDOMContent(card).addTo(map)
        for (const o of loreMarks) o.el.classList.toggle('open', o === f)
        pop.once('close', () => f.el.classList.remove('open'))
      }
      // Chosen from the sheet: bring the map to it, then open it.
      showLoreRef.current = (id: string) => {
        const f = loreMarks.find(x => x.l.id === id)
        if (!f) return
        const reduceM = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        map.flyTo({ center: f.l.at, zoom: Math.max(map.getZoom(), 13), pitch: 30, duration: reduceM ? 0 : 1600, essential: true })
        map.once('moveend', () => openLore(f))
      }

      // Which facts can be seen — and therefore tapped — right now. Names
      // appear once the map is close enough to have room for them.
      const placeMarks = () => {
        const z = map.getZoom()
        const on = z >= 9.4, named = z >= 11.6
        const box = map.getContainer().getBoundingClientRect()
        const taken = occupied.map(e => centreOf(e, box))
        for (const f of loreMarks) {
          let show = on
          if (show) {
            const at = centreOf(f.dot, box)
            for (const t of taken) if (Math.hypot(at.x - t.x, at.y - t.y) < CLEAR_PX) { show = false; break }
            if (show) taken.push(at)
          }
          f.shown = show
          f.el.classList.toggle('on', show)
          f.el.classList.toggle('named', show && named)
        }
      }
      // Measuring the DOM on every move frame would jank; once per frame is
      // plenty for deciding what is on screen.
      let queued = 0
      const placeSoon = () => {
        if (queued) return
        queued = requestAnimationFrame(() => { queued = 0; placeMarks() })
      }
      // A tap opens the nearest fact within a thumb's width of where it landed.
      const nearestLore = (pt: { x: number; y: number }): LoreMarker | null => {
        let best: LoreMarker | null = null, bestD = TAP_PX
        const box = map.getContainer().getBoundingClientRect()
        for (const f of loreMarks) {
          if (!f.shown) continue
          const at = centreOf(f.dot, box)
          const d = Math.hypot(at.x - pt.x, at.y - pt.y)
          if (d < bestD) { bestD = d; best = f }
        }
        return best
      }
      map.on('click', e => {
        // A tap that landed on a photograph belongs to the photograph.
        const t = e.originalEvent?.target as HTMLElement | null
        if (t && typeof t.closest === 'function' && t.closest('.mk-photo,.mk-diary,.mk-them')) return
        const f = nearestLore(e.point)
        if (f) openLore(f)
        else if (pop.isOpen()) pop.remove()
      })
      map.on('mousemove', e => {
        const f = nearestLore(e.point)
        map.getCanvas().style.cursor = f ? 'pointer' : ''
        for (const o of loreMarks) o.el.classList.toggle('near', o === f)
      })
      map.on('move', placeSoon); map.on('zoom', placeSoon); map.on('idle', placeSoon); placeMarks()

      // The figures
      const f = document.createElement('div')
      if (state.walk.avatarUrl) { f.className = 'mk-them'; f.style.backgroundImage = `url("${state.walk.avatarUrl}")` }
      else { f.className = 'mk-figs'; f.innerHTML = figuresSvg(34, '#1B2430') }
      f.title = state.position.segment ? `${state.walk.name} · ${state.position.segment.name}` : state.walk.name
      layer(new maplibregl.Marker({ element: f, anchor: 'center' }).setLngLat(cut).addTo(map), 6)
      them = f
      showPictures()

      // Camera: whole route first, then dive to them
      const bounds = pts.reduce((b, p) => b.extend([p[0], p[1]]), new maplibregl.LngLatBounds(pts[0].slice(0, 2) as [number, number], pts[0].slice(0, 2) as [number, number]))
      map.fitBounds(bounds, { padding: { top: 120, bottom: 110, left: 40, right: 40 }, duration: 0 })
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

      // Satellite tiles take a moment on a cold load, and the flyover used to
      // start on a timer regardless — so the whole cinematic could play out
      // over an empty dark rectangle, which reads as broken rather than as
      // loading. Wait for the imagery to land, then fly. The cap is there so a
      // sulking tile server can't hold the camera for ever: after it, the
      // flight happens anyway over whatever has arrived.
      const READY_CAP_MS = 5000
      let settled = false
      const onReady = (fn: () => void) => {
        const go = () => {
          if (settled) return
          settled = true
          // 'ready' fades the imagery up; see .map.ready in globals.css. The
          // map's own container is the reliable handle here; el.current is a
          // fallback for the case where the map has already been torn down.
          const container = (() => { try { return map.getContainer() } catch { return el.current } })()
          container?.classList.add('ready')
          try { window.clearTimeout(cap); map.off('idle', go) } catch { /* map already gone */ }
          readyCb.current?.()
          const fly = () => { if (mapRef.current) fn() }
          if (holdRef.current) heldFlight.current = fly
          else window.setTimeout(fly, reduce ? 0 : 700)
        }
        const cap = window.setTimeout(go, READY_CAP_MS)
        map.on('idle', go)
      }

      // The opening move retraces the walk rather than dropping onto the end
      // of it. The camera lands on where they set off, then runs the gold line
      // north — banking with every bend, closing in as it goes — and comes to
      // rest on them. The whole point of the thing is the line getting longer,
      // so the first thing it does is show the line.
      const START_Z = 11.0, END_Z = 12.9
      const START_P = terrainUrl ? 46 : 38, END_P = terrainUrl ? 58 : 48
      const total = state.route.totalKm

      // Which way the path is running at a given kilometre. 0 = north, so it
      // can be handed straight to the camera as a bearing.
      const headingAt = (atKm: number) => {
        const a = pointAt(pts, Math.max(0, atKm - 2.5))
        const b = pointAt(pts, Math.min(total, atKm + 2.5))
        const dx = (b[0] - a[0]) * Math.cos((b[1] * Math.PI) / 180), dy = b[1] - a[1]
        return !dx && !dy ? 0 : (Math.atan2(dx, dy) * 180) / Math.PI
      }

      // A hand on the map ends the flight; being flown somewhere you didn't
      // ask for, while you're trying to look at something, is maddening.
      const stopFlight = () => {
        if (flightRaf.current) { cancelAnimationFrame(flightRaf.current); flightRaf.current = null }
        map.stop()
      }
      for (const ev of ['mousedown', 'touchstart', 'wheel']) {
        map.getCanvas().addEventListener(ev, stopFlight, { passive: true })
      }

      const trackWalk = () => {
        // A long walk shouldn't take proportionally longer to fly over.
        const trackMs = Math.min(6000, 2400 + km * 26)
        map.flyTo({ center: pointAt(pts, 0), zoom: START_Z, pitch: START_P, bearing: headingAt(0), duration: 1300, essential: true })
        map.once('moveend', () => {
          if (!mapRef.current) return
          let bearing = headingAt(0)
          const t0 = performance.now()
          const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
          const step = (now: number) => {
            if (!mapRef.current) return
            const p = Math.min(1, (now - t0) / trackMs)
            const e = ease(p)
            const atKm = km * e
            // The bearing chases the path rather than snapping to it, so a
            // wiggly stretch of coast doesn't throw the camera about.
            const want = headingAt(atKm)
            bearing += (((want - bearing + 540) % 360) - 180) * 0.14
            map.jumpTo({
              center: pointAt(pts, atKm),
              bearing,
              zoom: START_Z + (END_Z - START_Z) * e,
              pitch: START_P + (END_P - START_P) * e,
            })
            if (p < 1) flightRaf.current = requestAnimationFrame(step)
            else flightRaf.current = null
          }
          flightRaf.current = requestAnimationFrame(step)
        })
      }

      const restOnThem = () => map.jumpTo({ center: cut, zoom: END_Z, pitch: END_P, bearing: headingAt(km) })

      if (state.started) {
        // Nothing to retrace on day one, and reduced motion gets the
        // destination without the journey.
        onReady(reduce || km < 2 ? restOnThem : trackWalk)
      } else {
        // Before day one there is no line to run, so: a slow push-in onto the
        // start, close enough to read the relief they're about to walk into.
        onReady(() => map.flyTo({ center: cut, zoom: 11.4, pitch: terrainUrl ? 52 : 38, bearing: headingAt(0), duration: reduce ? 0 : 4200, essential: true }))
      }
    })
    return () => {
      if (flightRaf.current) { cancelAnimationFrame(flightRaf.current); flightRaf.current = null }
      heldFlight.current = null
      map.remove(); mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Released: fly now, with no delay — the tap that closed the sheet is the
  // cue, and a pause after it just reads as lag.
  useEffect(() => {
    if (holdFlight) return
    const f = heldFlight.current
    if (!f) return
    heldFlight.current = null
    f()
  }, [holdFlight])

  useEffect(() => {
    if (focusLore && showLoreRef.current) showLoreRef.current(focusLore.id)
  }, [focusLore])

  return <div ref={el} className="map" role="region" aria-label="Route map" />
}
