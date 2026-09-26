import { useEffect, useRef } from 'react'
import { useMap } from '@vis.gl/react-google-maps'

export interface FloodRasterImage {
  url: string
  coordinates: [[number, number], [number, number], [number, number], [number, number]]
}

// The existing renderer produces a Mercator image. OverlayView positions its
// corners in that same projection rather than stretching it in latitude space.
export default function FloodRiskLayer({ image, visible }: { image: FloodRasterImage | null; visible: boolean }) {
  const map = useMap('flood-map')
  const visibility = useRef(visible)
  visibility.current = visible
  useEffect(() => {
    if (!map || !image) return
    class RasterOverlay extends google.maps.OverlayView {
      element = document.createElement('img')
      onAdd() {
        this.element.src = image!.url
        this.element.alt = ''
        this.element.dataset.floodRaster = 'true'
        Object.assign(this.element.style, { position: 'absolute', pointerEvents: 'none', imageRendering: 'pixelated', display: visibility.current ? '' : 'none' })
        this.getPanes()?.overlayLayer.append(this.element)
      }
      draw() {
        const projection = this.getProjection()
        const [west, north] = image!.coordinates[0]
        const [east, south] = image!.coordinates[2]
        const nw = projection.fromLatLngToDivPixel(new google.maps.LatLng(north, west))
        const se = projection.fromLatLngToDivPixel(new google.maps.LatLng(south, east))
        if (!nw || !se) return
        Object.assign(this.element.style, { left: `${nw.x}px`, top: `${nw.y}px`, width: `${se.x - nw.x}px`, height: `${se.y - nw.y}px` })
      }
      onRemove() { this.element.remove() }
    }
    const overlay = new RasterOverlay()
    overlay.setMap(map)
    return () => overlay.setMap(null)
  }, [map, image])

  // Visibility changes do not re-fetch the raster or re-create the map.
  useEffect(() => {
    map?.getDiv().querySelectorAll<HTMLElement>('[data-flood-raster]').forEach(element => {
      element.style.display = visible ? '' : 'none'
    })
  }, [map, image, visible])
  return null
}
