import { useEffect } from 'react'
import { useMap } from '@vis.gl/react-google-maps'
import type { RouteComparison } from '../../lib/floodApi'
import type { RoutePoint } from '../../types/flood'
import { ROUTE_COLORS } from '../../lib/routeStyle'

export default function RouteLayer({ points, routes }: { points: RoutePoint[]; routes: RouteComparison | null }) {
  const map = useMap('flood-map')
  useEffect(() => {
    if (!map) return
    const suggested = !routes?.tolerance_route && routes?.suggested_route
    const lines = [
      { route: routes?.normal_route, color: '#e2e8f0', weight: 8, zIndex: 2000, dashed: false },
      { route: routes?.normal_route, color: ROUTE_COLORS.fastest, weight: 5, zIndex: 2001, dashed: false },
      { route: routes?.tolerance_route ?? routes?.suggested_route, color: '#0f172a', weight: 8, zIndex: 2002, dashed: false },
      { route: routes?.tolerance_route ?? routes?.suggested_route, color: suggested ? ROUTE_COLORS.suggested : ROUTE_COLORS.floodSafe, weight: 6, zIndex: 2003, dashed: !!suggested },
    ].flatMap(({ route, color, weight, zIndex, dashed }) => route && route.coordinates.length > 1 ? [{ weight, dashed, color, line: new google.maps.Polyline({
      map, path: route.coordinates.map(([lng, lat]) => ({ lng, lat })),
      strokeColor: color, strokeWeight: weight, zIndex, clickable: false,
      ...(dashed ? { strokeOpacity: 0, icons: [{
        icon: { path: 'M 0,-2 0,2', strokeColor: color, strokeWeight: weight, strokeOpacity: 1, scale: 1 }, offset: '0', repeat: '12px',
      }] } : {}),
    }) }] : [])
    const resize = () => {
      const factor = Math.max(0.65, Math.min(1, 0.65 + ((map.getZoom() ?? 11) - 10) * 0.07))
      lines.forEach(({ line, weight, dashed, color }) => line.setOptions({
        strokeWeight: weight * factor,
        ...(dashed ? { icons: [{ icon: { path: 'M 0,-2 0,2', strokeColor: color,
          strokeWeight: weight * factor, strokeOpacity: 1, scale: factor }, offset: '0', repeat: `${12 * factor}px` }] } : {}),
      }))
    }
    resize()
    const zoomListener = map.addListener('zoom_changed', resize)
    return () => { zoomListener.remove(); lines.forEach(({ line }) => line.setMap(null)) }
  }, [map, routes])

  useEffect(() => {
    if (!map) return
    // DOM overlays keep A/B markers independent of a cloud map ID and its styling.
    class LocationMarker extends google.maps.OverlayView {
      element = document.createElement('div')
      readonly point: RoutePoint
      readonly label: string
      constructor(point: RoutePoint, label: string) { super(); this.point = point; this.label = label }
      onAdd() {
        this.element.textContent = this.label
        this.element.className = 'route-location-marker'
        this.element.setAttribute('aria-label', this.label === 'A' ? 'Route start' : 'Route destination')
        this.getPanes()?.floatPane.append(this.element)
      }
      draw() {
        const pixel = this.getProjection().fromLatLngToDivPixel(new google.maps.LatLng(this.point))
        if (pixel) Object.assign(this.element.style, { left: `${pixel.x}px`, top: `${pixel.y}px` })
      }
      onRemove() { this.element.remove() }
    }
    const markers = points.map((point, i) => {
      const marker = new LocationMarker(point, i === 0 ? 'A' : 'B')
      marker.setMap(map)
      return marker
    })
    return () => markers.forEach(marker => marker.setMap(null))
  }, [map, points])
  return null
}
