import { useEffect } from 'react'
import { useMap } from '@vis.gl/react-google-maps'
import { apiRequest, windowQuery } from '../../lib/floodApi'
import type { RainfallSource } from '../../lib/floodApi'
import { FSI_COLORS } from '../../lib/floodRaster'
import { cachedDisplay } from '../../lib/displayCache'

export default function RoadRiskLayer({ visible, event, minutes, rainfallSource, refresh, onStatus }: {
  visible: boolean; event: string; minutes: number | undefined; rainfallSource: RainfallSource;
  onStatus: (status: string) => void;
  refresh: number;
}) {
  const map = useMap('flood-map')
  useEffect(() => {
    if (!map || !visible || !event) { onStatus(''); return }
    const layer = new google.maps.Data({ map })
    layer.setStyle(feature => ({
      strokeColor: FSI_COLORS[Math.min(3, Math.floor(Number(feature.getProperty('flood_risk')) * 4))],
      strokeOpacity: 0.95, strokeWeight: 3, zIndex: 7, clickable: false,
    }))
    let controller: AbortController | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    let lastQuery = ''
    const clear = () => layer.forEach(feature => layer.remove(feature))
    const update = async () => {
      const bounds = map.getBounds()
      if (!bounds) return
      if ((map.getZoom() ?? 11) < 14) {
        controller?.abort(); clear(); lastQuery = ''; onStatus('Zoom in to level 14 to see road risk.'); return
      }
      const sw = bounds.getSouthWest(), ne = bounds.getNorthEast()
      const query = new URLSearchParams(windowQuery(minutes, rainfallSource).slice(1))
      query.set('west', String(sw.lng())); query.set('south', String(sw.lat()))
      query.set('east', String(ne.lng())); query.set('north', String(ne.lat()))
      const path = `/flood/roads/${encodeURIComponent(event)}?${query}`
      if (path === lastQuery) return
      controller?.abort(); controller = new AbortController()
      const request = controller
      clear(); onStatus('Loading road risk…')
      try {
        const data = await cachedDisplay<{ features: object[]; truncated: boolean }>(`roads:${refresh}:${path}`, request.signal,
          async () => (await apiRequest(path, new AbortController().signal)).json())
        if (request.signal.aborted) return
        layer.addGeoJson(data); lastQuery = path
        onStatus(data.truncated ? 'Showing 5,000 roads with highest risk; zoom in for all segments.' : `${data.features.length.toLocaleString()} road segments in view`)
      } catch (error) {
        if (!request.signal.aborted) onStatus(`Road risk unavailable: ${error instanceof Error ? error.message : 'Request failed'}`)
      }
    }
    const idle = map.addListener('idle', () => {
      clearTimeout(timer); timer = setTimeout(() => { void update() }, 200)
    })
    void update()
    return () => { clearTimeout(timer); controller?.abort(); idle.remove(); clear(); layer.setMap(null) }
  }, [map, visible, event, minutes, rainfallSource, refresh, onStatus])
  return null
}
