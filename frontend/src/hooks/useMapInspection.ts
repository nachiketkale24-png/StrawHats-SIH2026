import { useEffect } from 'react'
import type { MutableRefObject, Dispatch, SetStateAction } from 'react'
import { apiRequest } from '../lib/floodApi'
import type { EventWindow, RainfallSource } from '../lib/floodApi'
import { drainageLayer } from '../lib/googleDrainage'
import type { MapMode, RoutePoint } from '../types/flood'

export function useMapInspection({ mapRef, ready, mode, event, intervalReady, selectedMinutes, activeWindow,
  rainfallSource, setPoints, clearRoutes }: {
  mapRef: MutableRefObject<google.maps.Map | null>; ready: boolean; mode: MapMode;
  event: string; intervalReady: boolean; selectedMinutes: number | undefined; activeWindow: EventWindow | undefined;
  rainfallSource: RainfallSource; setPoints: Dispatch<SetStateAction<RoutePoint[]>>; clearRoutes: () => void;
}) {
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map || !intervalReady) return
    let popup: google.maps.InfoWindow | null = null
    let request: AbortController | null = null
    map.setOptions({ draggableCursor: mode === 'route' ? 'crosshair' : null })
    const click = (position: google.maps.LatLng | null, feature?: google.maps.Data.Feature) => {
      if (!position) return
      request?.abort(); popup?.close()
      if (mode === 'route') {
        clearRoutes()
        setPoints(previous => previous.length === 1 ? [...previous, position.toJSON()] : [position.toJSON()])
        return
      }
      const content = document.createElement('div')
      content.className = 'inspection-content'
      popup = new google.maps.InfoWindow({ content, position, maxWidth: 280 })
      popup.open({ map, shouldFocus: false })
      if (feature) {
        const props: Record<string, unknown> = {}
        feature.forEachProperty((value, name) => { props[name] = value })
        const flow = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(3)} m³/s` : 'Unknown'
        const ratio = typeof props.surcharge_ratio === 'number' && Number.isFinite(props.surcharge_ratio) ? props.surcharge_ratio.toFixed(2) : 'Unknown'
        if (feature.getGeometry()?.getType() === 'Point') {
          const elevation = typeof props.ground_elev === 'number' && Number.isFinite(props.ground_elev) ? `${props.ground_elev.toFixed(2)} m` : 'Unknown'
          const status = props.surcharged ? 'surcharging' : typeof props.surcharge_ratio === 'number' && props.surcharge_ratio > 0.5 ? 'strained' : 'normal'
          content.textContent = `Manhole ${props.id}\nStatus: ${status}\nGround elevation: ${elevation}\nIncoming Q: ${flow(props.q_in_m3s)}\nConduit capacity: ${flow(props.capacity_m3s)}\nSurcharge ratio: ${ratio}`
        } else {
          const status = props.surcharged ? 'Surcharged' : typeof props.surcharge_ratio === 'number' && props.surcharge_ratio > 1 ? 'Export flag: not surcharged (ratio exceeds 1)' : 'Within capacity'
          content.textContent = `Drainage flow\n${props.fromNodeId} → ${props.toNodeId}\nIncoming Q: ${flow(props.q_in_m3s)}\nCapacity: ${flow(props.capacity_m3s)}\nSurcharge ratio: ${ratio}\n${status}`
        }
        return
      }
      const controller = new AbortController()
      request = controller
      content.textContent = 'Loading FSI…'
      const query = new URLSearchParams({ lon: String(position.lng()), lat: String(position.lat()), rainfall_source: rainfallSource })
      if (selectedMinutes !== undefined) query.set('window_minutes', String(selectedMinutes))
      apiRequest(`/flood/point/${encodeURIComponent(event)}?${query}`, controller.signal)
        .then(response => response.json()).then(data => {
          if (controller.signal.aborted) return
          const windowLabel = activeWindow ? ` · ${activeWindow.start_time.slice(11,16)}–${activeWindow.end_time.slice(11,16)}` : ' · Daily'
          const valid = typeof data.fsi === 'number' && Number.isFinite(data.fsi)
          const category = valid ? ['Low', 'Medium', 'High', 'Severe'][Math.min(3, Math.max(0, Math.floor(data.fsi * 4)))] : ''
          const fsiLabel = valid ? `FSI: ${data.fsi.toFixed(3)} (0–1)\nRisk: ${category}` : 'No flood data at this location.'
          const coverageLabel = data.in_station_network === false ? '\nLower confidence (extrapolated)' : data.in_station_network === true ? '\nStation Network Coverage' : ''
          content.textContent = `${event}${windowLabel}\n${fsiLabel}${coverageLabel}`
        }).catch(err => { if (!controller.signal.aborted) content.textContent = `Unable to inspect: ${err.message}` })
    }
    const mapClick = map.addListener('click', (e: google.maps.MapMouseEvent) => click(e.latLng))
    const dataClick = drainageLayer(map).addListener('click', (e: google.maps.Data.MouseEvent) => click(e.latLng, e.feature))
    return () => { request?.abort(); popup?.close(); mapClick.remove(); dataClick.remove(); map.setOptions({ draggableCursor: null }) }
  }, [mapRef, ready, mode, event, intervalReady, selectedMinutes, activeWindow, rainfallSource, setPoints, clearRoutes])
}
