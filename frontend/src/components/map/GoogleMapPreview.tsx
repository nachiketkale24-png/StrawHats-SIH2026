import { useEffect, useState } from 'react'
import { APIProvider, Map } from '@vis.gl/react-google-maps'
import type { MapProps } from '@vis.gl/react-google-maps'
import Panel, { PanelCaption, PanelLabel } from '../ui/Panel'
import { MUMBAI_BOUNDS } from '../../config/mumbai'

const libraries = ['places', 'visualization']
const styles: MapProps['styles'] = [
  { featureType: 'poi', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
]
const [[west, south], [east, north]] = MUMBAI_BOUNDS
const restriction = { latLngBounds: { west, south, east, north }, strictBounds: false }
const riskColors = ['#38bdf8', '#facc15', '#fb923c', '#ef4444']

export default function GoogleMapPreview() {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim()
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!apiKey || ready || error) return
    const timeout = window.setTimeout(() => setError('Google Maps is taking longer than expected. Check your connection, key restrictions and Maps JavaScript API configuration, then reload.'), 30000)
    return () => window.clearTimeout(timeout)
  }, [apiKey, ready, error])

  return <section className="google-map-preview relative h-full w-full" aria-label="Google Maps preview">
    {apiKey && <APIProvider apiKey={apiKey} libraries={libraries}
      onError={() => setError('Google Maps could not load. Check your connection and Google Cloud API configuration, then reload.')}>
      <Map defaultCenter={{ lat: 19.076, lng: 72.8777 }} defaultZoom={11}
        mapTypeId="roadmap" styles={styles} restriction={restriction}
        mapTypeControl zoomControl fullscreenControl streetViewControl={false}
        clickableIcons={false} gestureHandling="greedy"
        style={{ width: '100%', height: '100%' }}
        onTilesLoaded={() => { setReady(true); setError('') }} />
    </APIProvider>}
    <aside className="absolute left-3 top-16 z-10 w-[min(20rem,calc(100%-1.5rem))] space-y-3">
      <Panel>
        <PanelLabel>Google Maps · Phase 2 preview</PanelLabel>
        <PanelCaption className="mt-2">Mumbai base map. Flood overlays, drainage and routing will be migrated in subsequent phases.</PanelCaption>
        <a className="hud-button mt-3 block px-3 py-2 text-center text-xs" href="/">Open flood dashboard</a>
      </Panel>
      <Panel>
        <PanelLabel>Flood risk color reference</PanelLabel>
        <ul className="mt-2 space-y-2 text-sm">
          {['Low', 'Medium', 'High', 'Severe'].map((label, i) => <li key={label} className="flex items-center gap-2">
            <span className="h-4 w-4 rounded border border-slate-600" style={{ background: riskColors[i] }} />{label}
          </li>)}
        </ul>
        <PanelCaption className="mt-2">Legend reference only; no flood data is displayed in this preview.</PanelCaption>
      </Panel>
      {(!apiKey || error || !ready) && <Panel>
        <p role={error || !apiKey ? 'alert' : 'status'} className="text-sm text-[var(--text-primary)]">
          {!apiKey ? 'Set VITE_GOOGLE_MAPS_API_KEY in frontend/.env.local and restart Vite to load Google Maps.' : error || 'Loading Google Maps…'}
        </p>
      </Panel>}
    </aside>
  </section>
}
