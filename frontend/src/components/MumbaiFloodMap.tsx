import { useCallback, useEffect, useRef, useState } from 'react'
import { APIProvider } from '@vis.gl/react-google-maps'
import FloodMapCanvas from './map/FloodMapCanvas'
import FloodRiskLayer from './map/FloodRiskLayer'
import RoadRiskLayer from './map/RoadRiskLayer'
import TrafficLayer from './map/TrafficLayer'
import LayerControls from './map/LayerControls'
import MapCard from './map/MapCard'
import RouteComparisonPanel from './RouteComparison'
import type { FloodRasterImage } from './map/FloodRiskLayer'
import RouteLayer from './map/RouteLayer'
import { useMapInspection } from '../hooks/useMapInspection'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertCircle,
  Briefcase,
  Calendar,
  Clock,
  Crosshair,
  Download,
  Layers,
  MapPin,
  Maximize2,
  Minimize2,
  Navigation2,
  RefreshCw,
  Route,
  Satellite,
  ShieldCheck,
  X
} from './icons'
import { useGoogleMumbaiMap } from '../hooks/useGoogleMumbaiMap'
import Panel, { PanelCaption, PanelLabel } from './ui/Panel'
import AddressRoutePanel from './AddressRoutePanel'
import CommuteMonitor from './CommuteMonitor'
import { RiskToleranceSelector } from './RoutePanel'
import type { RiskTolerance } from './RoutePanel'
import { API_BASE, getDrainage, getEvents, getRoutes, getSummary, getWindows, windowQuery } from '../lib/floodApi'
import type { DrainageResponse, EventSummary, RainfallSource, RouteComparison, EventWindows } from '../lib/floodApi'
import { FSI_COLORS, loadEventRaster } from '../lib/floodRaster'
import { clearDrainageLayers, updateDrainageLayers } from '../lib/googleDrainage'
import { clearDisplayCache } from '../lib/displayCache'
import type { MapMode, RoutePoint } from '../types/flood'

type MobileTab = 'events' | 'routes' | 'commute' | 'legend' | null

function RouteSuggestion({ route, onAccept }: {
  route: RouteComparison['suggested_route']
  onAccept: (tolerance: RiskTolerance) => void
}) {
  if (!route) return null
  const label = route.risk_tolerance[0].toUpperCase() + route.risk_tolerance.slice(1)
  return <div className="mt-3 space-y-2" role="status" aria-live="polite">
    <p className="text-xs text-[var(--text-primary)]">
      Alternative: {(route.length_m / 1000).toFixed(2)} km,
      maximum flood risk {route.max_risk.toFixed(3)}. This requires accepting {label.toLowerCase()} risk tolerance.
    </p>
    <button type="button" className="hud-button w-full px-3 py-2 text-xs"
      onClick={() => onAccept(route.risk_tolerance)}>
      Increase to {label} and use this route
    </button>
  </div>
}

function DrainageNetworkControl({ summary, full, affected, onToggle, onAffectedToggle }: {
  summary: DrainageResponse['summary'] | null
  full: boolean
  affected: boolean
  onToggle: (value: boolean) => void
  onAffectedToggle: (value: boolean) => void
}) {
  return (
    <div className="mt-3 border-t border-[var(--border-secondary)] pt-3 text-[11px] text-[var(--text-secondary)]">
      <PanelLabel>Drainage network</PanelLabel>
      {summary ? (
        <p className="mt-1.5 leading-relaxed">
          {summary.surcharged_manholes.toLocaleString()} of {summary.total_manholes.toLocaleString()} manholes surcharged<br />
          {summary.surcharged_conduits.toLocaleString()} of {summary.total_conduits.toLocaleString()} conduits surcharged
        </p>
      ) : <p className="mt-1.5">Drainage status unavailable for this event.</p>}
      <label className="mt-2 flex cursor-pointer items-start gap-2 text-[var(--text-primary)]">
        <input type="checkbox" className="mt-0.5 accent-[var(--gold-primary)]" checked={affected}
          disabled={!summary} onChange={event => onAffectedToggle(event.target.checked)} />
        <span>Show affected drainage (yellow/red)</span>
      </label>
      <label className="mt-2 flex cursor-pointer items-start gap-2 text-[var(--text-primary)]">
        <input type="checkbox" className="mt-0.5 accent-[var(--gold-primary)]" checked={full}
          disabled={!summary} onChange={event => onToggle(event.target.checked)} />
        <span>Show full drainage network (zoom in for details)</span>
      </label>
      {full && <p className="mt-1.5">Zoom in for normal manholes; conduits appear at close zoom.</p>}
    </div>
  )
}

const libraries = ['places', 'visualization']

export default function MumbaiFloodMap() {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim()
  const [loadError, setLoadError] = useState<string | null>(null)
  if (!apiKey) return <div role="alert" className="m-4 rounded-xl bg-white p-4 text-slate-800">Set VITE_GOOGLE_MAPS_API_KEY in frontend/.env.local and restart Vite.</div>
  return <APIProvider apiKey={apiKey} libraries={libraries} onError={() => setLoadError('Google Maps could not load. Check your connection and API key configuration.')}>
    <MumbaiFloodDashboard loadError={loadError} />
  </APIProvider>
}

function MumbaiFloodDashboard({ loadError }: { loadError: string | null }) {
  const mapRef = useRef<google.maps.Map | null>(null)
  const [ready, setReady] = useState(false)
  const [satellite, setSatellite] = useState(() => {
    try { return localStorage.getItem('mumbai-satellite') === 'true' } catch { return false }
  })
  const [mapTimeout, setMapTimeout] = useState(false)
  const error = loadError || (mapTimeout ? 'Google Maps is taking longer than expected. Check your connection and API configuration.' : null)
  const [floodImage, setFloodImage] = useState<FloodRasterImage | null>(null)
  const [showFloodRisk, setShowFloodRisk] = useState(true)
  const [showRoadRisk, setShowRoadRisk] = useState(false)
  const [showTraffic, setShowTraffic] = useState(false)
  const [roadRiskStatus, setRoadRiskStatus] = useState('')
  const [events, setEvents] = useState<string[]>([])
  const rainfallSource: RainfallSource = 'observed'
  const [event, setEvent] = useState('')
  const [windows, setWindows] = useState<EventWindows | null>(null)
  const [minutes, setMinutes] = useState(15)
  const intervalReady = !!event && windows?.event_date === event
  const selectedMinutes = windows?.windows.length ? minutes : undefined
  const activeWindow = windows?.windows.find(window => window.minutes === minutes)
  const [refresh, setRefresh] = useState(0)
  const [eventsLoading, setEventsLoading] = useState(true)
  const [apiError, setApiError] = useState('')
  const [summary, setSummary] = useState<EventSummary | null>(null)
  const [rasterStatus, setRasterStatus] = useState('')
  const [drainageStatus, setDrainageStatus] = useState('')
  const [showFullDrainage, setShowFullDrainage] = useState(false)
  const [showAffectedDrainage, setShowAffectedDrainage] = useState(false)
  const toggleFullDrainage = (value: boolean) => {
    setShowFullDrainage(value)
    if (value) setShowAffectedDrainage(false)
  }
  const toggleAffectedDrainage = (value: boolean) => {
    setShowAffectedDrainage(value)
    if (value) setShowFullDrainage(false)
  }
  const [drainageInfo, setDrainageInfo] = useState<{
    event: string; minutes: number | undefined; rainfallSource: RainfallSource;
    summary: DrainageResponse['summary']
  } | null>(null)
  const drainageSummary = drainageInfo?.event === event && drainageInfo.minutes === selectedMinutes
    && drainageInfo.rainfallSource === rainfallSource
    ? drainageInfo.summary : null
  const [mode, setMode] = useState<MapMode>('inspect')
  const [points, setPoints] = useState<RoutePoint[]>([])
  const [routes, setRoutes] = useState<RouteComparison | null>(null)
  const [dismissedSuggestion, setDismissedSuggestion] = useState<RouteComparison | null>(null)
  const [routeStatus, setRouteStatus] = useState('')
  const [riskTolerance, setRiskTolerance] = useState<RiskTolerance>('low')
  
  // Mobile sheet and HUD state
  const [mobileTab, setMobileTab] = useState<MobileTab>(null)
  const [desktopHudVisible, setDesktopHudVisible] = useState(true)

  useGoogleMumbaiMap(mapRef, setReady)
  useEffect(() => {
    if (ready) { setMapTimeout(false); return }
    const timeout = window.setTimeout(() => setMapTimeout(true), 30000)
    return () => window.clearTimeout(timeout)
  }, [ready])

  useEffect(() => { clearDisplayCache() }, [refresh])

  useEffect(() => {
    const controller = new AbortController()
    setEventsLoading(true); setApiError(''); setEvent(''); setSummary(null); setRoutes(null)
    getEvents(controller.signal, rainfallSource).then(dates => {
      setEvents(dates); setEvent(dates.at(-1) ?? '')
    }).catch(err => { if (!controller.signal.aborted) { setEvents([]); setApiError(`Cannot load events: ${err.message}. Check that the API server is running.`) } })
      .finally(() => { if (!controller.signal.aborted) setEventsLoading(false) })
    return () => controller.abort()
  }, [refresh, rainfallSource])

  useEffect(() => {
    const controller = new AbortController()
    setWindows(null); setMinutes(15)
    if (event) getWindows(event, controller.signal, rainfallSource).then(info => {
      if (!controller.signal.aborted) { setWindows(info); setMinutes(info.windows[0]?.minutes ?? 15) }
    }).catch(err => { if (!controller.signal.aborted) setApiError(`Cannot load time intervals: ${err.message}`) })
    return () => controller.abort()
  }, [event, refresh, rainfallSource])

  useEffect(() => {
    const controller = new AbortController()
    setSummary(null)
    if (intervalReady) getSummary(event, controller.signal, selectedMinutes, rainfallSource).then(value => { if (!controller.signal.aborted) setSummary(value) }).catch(err => {
      if (!controller.signal.aborted) setApiError(`Cannot load summary: ${err.message}`)
    })
    return () => controller.abort()
  }, [event, refresh, intervalReady, selectedMinutes, rainfallSource])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const controller = new AbortController()
    setFloodImage(null)
    if (!intervalReady) { setRasterStatus(''); return }
    setRasterStatus('Loading flood susceptibility map…')
    loadEventRaster(event, controller.signal, selectedMinutes, rainfallSource).then(image => {
      if (controller.signal.aborted) return
      setFloodImage(image)
      setRasterStatus('')
      // Warm only the next window once the selected map is visible.
      const next = windows?.windows.find(window => window.minutes > (selectedMinutes ?? 0))
      if (next) window.setTimeout(() => {
        if (!controller.signal.aborted) {
          void loadEventRaster(event, controller.signal, next.minutes, rainfallSource).catch(() => {})
          void getDrainage(event, controller.signal, false, next.minutes, rainfallSource, true).catch(() => {})
        }
      }, 800)
    }).catch(err => { if (!controller.signal.aborted) setRasterStatus(`Flood map unavailable: ${err.message}`) })
    return () => controller.abort()
  }, [ready, event, refresh, intervalReady, selectedMinutes, rainfallSource])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const controller = new AbortController()
    clearDrainageLayers(map)
    setDrainageStatus('')
    setDrainageInfo(null)
    if (intervalReady) {
      setDrainageStatus(showAffectedDrainage || showFullDrainage ? 'Loading drainage network…' : 'Loading drainage counts…')
      getDrainage(event, controller.signal, showFullDrainage, selectedMinutes, rainfallSource,
        !showAffectedDrainage && !showFullDrainage).then(data => {
        if (!controller.signal.aborted) {
          if (showAffectedDrainage || showFullDrainage) updateDrainageLayers(map, data)
          setDrainageInfo({ event, minutes: selectedMinutes, rainfallSource, summary: data.summary })
          setDrainageStatus('')
        }
      }).catch(err => {
        if (!controller.signal.aborted) setDrainageStatus(`Drainage unavailable: ${err.message}`)
      })
    }
    return () => controller.abort()
  }, [ready, event, refresh, intervalReady, selectedMinutes, rainfallSource, showFullDrainage, showAffectedDrainage])

  const start = points[0], end = points[1]
  useEffect(() => {
    const controller = new AbortController()
    setRoutes(null); setRouteStatus('')
    if (intervalReady && start && end) {
      setRouteStatus('Calculating tolerance route vs fastest route…')
      getRoutes(event, start, end, riskTolerance, controller.signal, selectedMinutes, rainfallSource).then(result => {
        if (!controller.signal.aborted) { setRoutes(result); setRouteStatus('') }
      }).catch(err => { if (!controller.signal.aborted) setRouteStatus(`Route unavailable: ${err.message}`) })
    }
    return () => controller.abort()
  }, [event, start, end, riskTolerance, refresh, intervalReady, selectedMinutes, rainfallSource])

  const clearRoutes = useCallback(() => { setRoutes(null); setRouteStatus('') }, [])
  useMapInspection({ mapRef, ready, mode, event, intervalReady, selectedMinutes, activeWindow, rainfallSource, setPoints, clearRoutes })
  useEffect(() => {
    try { localStorage.setItem('mumbai-satellite', String(satellite)) } catch { /* Storage may be disabled. */ }
  }, [satellite])


  const disabled = !ready || !intervalReady || eventsLoading
  const buttonClass = 'hud-button flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-xs'

  return (
    <section className="relative h-full w-full bg-[var(--bg-secondary)] overflow-hidden" aria-label="Mumbai flood susceptibility map">
      {/* Map Canvas */}
      <div className="absolute inset-0 h-full w-full">
        <FloodMapCanvas satellite={satellite} onSatelliteChange={setSatellite} />
        <FloodRiskLayer image={floodImage} visible={showFloodRisk} />
        <RoadRiskLayer visible={showRoadRisk && intervalReady} event={event} minutes={selectedMinutes} rainfallSource={rainfallSource} refresh={refresh} onStatus={setRoadRiskStatus} />
        <TrafficLayer visible={showTraffic} />
        <RouteLayer points={points} routes={routes} />
      </div>
      <div className="absolute bottom-20 left-4 z-20 lg:bottom-auto lg:top-4 lg:left-1/2 lg:-translate-x-1/2">
        <MapCard title="Map layers" hidden={!desktopHudVisible}>
        <LayerControls flood={showFloodRisk} roads={showRoadRisk} traffic={showTraffic} satellite={satellite}
          ready={ready} roadStatus={roadRiskStatus} onFlood={setShowFloodRisk} onRoads={setShowRoadRisk}
          onTraffic={setShowTraffic} onSatellite={setSatellite} />
        </MapCard>
      </div>

      {routes?.suggested_route && !routes.tolerance_route && dismissedSuggestion !== routes && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="route-alternative-title"
            className="w-full max-w-sm rounded-xl border border-amber-400/60 bg-[var(--bg-panel)] p-5 text-[var(--text-primary)] shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <h2 id="route-alternative-title" className="text-sm font-semibold">A route is available at higher tolerance</h2>
              <button type="button" aria-label="Dismiss route suggestion" autoFocus
                className="hud-button p-2" onClick={() => setDismissedSuggestion(routes)}><X size={16} /></button>
            </div>
            <p className="mt-3 text-xs leading-relaxed">{routes.warning}</p>
            <RouteSuggestion route={routes.suggested_route} onAccept={tolerance => {
              setDismissedSuggestion(routes)
              setRiskTolerance(tolerance)
            }} />
            <button type="button" className="mt-2 w-full py-2 text-xs text-[var(--text-secondary)]"
              onClick={() => setDismissedSuggestion(routes)}>Keep current tolerance</button>
          </div>
        </div>
      )}

      {/* Loading / Status Toast Banner */}
      {(!ready || error || rasterStatus || drainageStatus || apiError) && (
        <div className="pointer-events-none absolute inset-x-3 top-4 lg:top-24 z-50 flex justify-center transition-all">
          <div className="pointer-events-auto flex items-center gap-2.5 rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-panel)] px-4 py-2.5 text-xs text-[var(--text-primary)] shadow-2xl backdrop-blur-2xl">
            {error || apiError ? (
              <AlertCircle size={16} className="text-amber-500 shrink-0" />
            ) : (
              <div className="h-2 w-2 rounded-full bg-[var(--cyan-primary)] animate-ping shrink-0" />
            )}
            <span className="font-semibold">{error || apiError || rasterStatus || drainageStatus || 'Initializing Mumbai Map…'}</span>
          </div>
        </div>
      )}

      {/* Mobile Top Floating Mode Guide */}
      <div className="pointer-events-none absolute inset-x-3 top-3 z-20 flex justify-center lg:hidden">
        {mode === 'inspect' && (
          <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-[var(--border-secondary)] bg-[var(--bg-panel)] px-3.5 py-1.5 text-[11px] text-[var(--text-secondary)] shadow-lg backdrop-blur-md">
            <Crosshair size={13} className="text-[var(--cyan-primary)]" />
            <span>Tap map anywhere to inspect FSI</span>
          </div>
        )}
        {mode === 'route' && (
          <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-[var(--border-secondary)] bg-[var(--bg-panel)] px-3.5 py-1.5 text-[11px] text-[var(--gold-light)] shadow-lg backdrop-blur-md">
            <MapPin size={13} className="text-[var(--cyan-primary)]" />
            <span>{!start ? 'Tap point A (Start)' : !end ? 'Tap point B (Destination)' : 'Route plotted'}</span>
            {start && (
              <button
                type="button"
                className="ml-1 text-xs text-rose-400 hover:underline"
                onClick={() => { setPoints([]); setRoutes(null); setRouteStatus('') }}
              >
                Reset
              </button>
            )}
          </div>
        )}
      </div>

      {/* Floating View Toggles (Mobile Quick Buttons) */}
      <div className="pointer-events-none absolute right-3 top-12 z-20 flex flex-col gap-2 lg:hidden">
        <button
          disabled={!ready}
          aria-pressed={satellite}
          aria-label="Toggle Satellite view"
          className="pointer-events-auto hud-button flex h-9 w-9 items-center justify-center rounded-lg shadow-lg"
          onClick={() => setSatellite(v => !v)}
        >
          <Satellite size={16} className={satellite ? 'text-[var(--gold-primary)]' : 'text-[var(--text-secondary)]'} />
        </button>
      </div>

      {/* DESKTOP HUD FLOATING PANELS */}
      <div className="pointer-events-none absolute inset-x-4 top-4 z-10 hidden max-h-[calc(100%_-_8rem)] items-start justify-between gap-4 overflow-y-auto lg:flex">
        {/* Left Desktop Panel */}
        <AnimatePresence>
          {desktopHudVisible && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="pointer-events-auto flex w-72 flex-col gap-3"
            >
              <MapCard title="Rainfall"><Panel>
                <div className="flex items-center justify-between">
                  <PanelLabel className="flex items-center gap-1.5">
                    <Calendar size={13} className="text-[var(--gold-light)]" />
                    Observed Rainfall
                  </PanelLabel>
                  <button
                    type="button"
                    title="Refresh available events"
                    aria-label="Refresh events"
                    disabled={eventsLoading}
                    className="p-1 text-[var(--text-secondary)] hover:text-[var(--gold-light)] transition disabled:opacity-40"
                    onClick={() => setRefresh(v => v + 1)}
                  >
                    <RefreshCw size={13} className={eventsLoading ? 'animate-spin' : ''} />
                  </button>
                </div>

                <label className="mt-2.5 block text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  Rainfall Source
                  <div
                    aria-label="Rainfall source"
                    className="mt-1 w-full rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-primary)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] shadow-sm focus:outline-none focus:border-[var(--gold-primary)] transition"
                    defaultValue="observed"
                  >
                    <option value="observed">Model Nowcast</option>
                  </div>
                </label>

                <label className="mt-2.5 block text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  Event Date
                  <select
                    aria-label="Rainfall event selection"
                    className="mt-1 w-full rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-primary)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] shadow-sm focus:outline-none focus:border-[var(--gold-primary)] transition"
                    value={event}
                    disabled={eventsLoading || !events.length}
                    onChange={e => { setEvent(e.target.value); setRoutes(null); setSummary(null); setApiError('') }}
                  >
                    {!events.length && <option value="">{eventsLoading ? 'Loading events…' : 'No events found'}</option>}
                    {events.map(date => <option key={date} value={date}>{date}</option>)}
                  </select>
                </label>

                {summary && (
                  <div className="mt-3 rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-primary)] p-2.5 font-[family-name:var(--font-hud)] shadow-sm">
                    <div className="flex justify-between text-[11px] text-[var(--text-secondary)]">
                      <span>MIN: <b className="text-[var(--text-primary)]">{summary.fsi_min.toFixed(2)}</b></span>
                      <span>MEAN: <b className="text-[var(--cyan-primary)]">{summary.fsi_mean.toFixed(2)}</b></span>
                      <span>MAX: <b className="text-amber-400">{summary.fsi_max.toFixed(2)}</b></span>
                    </div>
                  </div>
                )}

                {intervalReady && (
                  <a
                    className="download-geotiff-btn mt-3 flex items-center justify-center gap-2 rounded-xl border-2 border-amber-500/80 bg-amber-400/20 py-2.5 text-xs font-bold text-black shadow-sm transition hover:bg-amber-400/30 hover:border-amber-600 dark:border-amber-400/70 dark:bg-amber-400/15 dark:text-white dark:hover:bg-amber-400/25"
                    href={`${API_BASE}/flood/raster/${encodeURIComponent(event)}${windowQuery(selectedMinutes, rainfallSource)}`}
                    download
                  >
                    <Download size={14} className="download-geotiff-btn stroke-[2.5]" />
                    <span className="download-geotiff-btn font-bold">Download GeoTIFF</span>
                  </a>
                )}
              </Panel></MapCard>

              {/* FSI Scale Legend */}
              <MapCard title="Flood susceptibility"><Panel>
                <PanelLabel className="flex items-center gap-1.5">
                  <ShieldCheck size={13} className="text-[var(--cyan-primary)]" />
                  Flood Susceptibility Index
                </PanelLabel>
                <div className="mt-2.5 space-y-1.5">
                  {[
                    { label: 'Low Risk', range: '0.00 – 0.25', color: FSI_COLORS[0] },
                    { label: 'Medium Risk', range: '0.25 – 0.50', color: FSI_COLORS[1] },
                    { label: 'High Risk', range: '0.50 – 0.75', color: FSI_COLORS[2] },
                    { label: 'Severe Risk', range: '0.75 – 1.00', color: FSI_COLORS[3] },
                  ].map(item => (
                    <div className="flex items-center justify-between text-xs" key={item.label}>
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded shadow-sm" style={{ background: item.color, border: item.color === 'transparent' ? '1px solid #94a3b8' : undefined }} />
                        <span className="text-[var(--text-primary)]">{item.label}</span>
                      </div>
                      <span className="font-[family-name:var(--font-hud)] text-[10px] text-[var(--text-secondary)]">{item.range}</span>
                    </div>
                  ))}
                </div>

                <p className="mt-2.5 border-t border-[var(--border-secondary)] pt-2 text-[11px] text-[var(--text-secondary)]">
                  Risk shading is shown over land. Open water is unshaded. Extrapolation details are available when inspecting a point.
                </p>
                <p className="mt-2 text-[10px] leading-relaxed text-[var(--text-secondary)]">
                  Overlay fades at data limits. Areas beyond coverage are unassessed.
                </p>
                <DrainageNetworkControl summary={drainageSummary} full={showFullDrainage} affected={showAffectedDrainage} onToggle={toggleFullDrainage} onAffectedToggle={toggleAffectedDrainage} />
              </Panel></MapCard>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Right Desktop Panel */}
        <AnimatePresence>
          {desktopHudVisible && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className={`pointer-events-auto flex flex-col gap-3 transition-all duration-300 ${mode === 'commute' ? 'w-96 lg:w-[440px] max-w-[calc(100vw-2rem)]' : 'w-80'}`}
            >
              {/* Map Layer Controls */}
              <div className="flex gap-2">
                <button
                  disabled={!ready}
                  aria-pressed={satellite}
                  aria-label="Satellite imagery"
                  className={buttonClass}
                  onClick={() => setSatellite(v => !v)}
                >
                  <Satellite size={14} />
                  Satellite
                </button>
              </div>

              {/* Mode & Routing Panel */}
              <MapCard title="Navigation and routes"><Panel>
                <PanelLabel className="flex items-center gap-1.5">
                  <Navigation2 size={13} className="text-[var(--cyan-primary)]" />
                  Navigation & Analysis
                </PanelLabel>

                <div className="my-2.5 flex gap-1 rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-primary)] p-1 backdrop-blur-md shadow-inner">
                  <button
                    disabled={disabled}
                    aria-pressed={mode === 'inspect'}
                    className={`flex-1 rounded-lg py-1.5 text-center text-[11px] font-bold transition ${mode === 'inspect' ? 'bg-sky-600 text-white dark:bg-amber-400 dark:text-slate-950 shadow-md' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    onClick={() => setMode('inspect')}
                  >
                    Inspect
                  </button>
                  <button
                    disabled={disabled}
                    aria-pressed={mode === 'route'}
                    className={`flex-1 rounded-lg py-1.5 text-center text-[11px] font-bold transition ${mode === 'route' ? 'bg-sky-600 text-white dark:bg-amber-400 dark:text-slate-950 shadow-md' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    onClick={() => setMode('route')}
                  >
                    Map Pin
                  </button>
                  <button
                    disabled={disabled}
                    aria-pressed={mode === 'route-address'}
                    className={`flex-1 rounded-lg py-1.5 text-center text-[11px] font-bold transition ${mode === 'route-address' ? 'bg-sky-600 text-white dark:bg-amber-400 dark:text-slate-950 shadow-md' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    onClick={() => setMode('route-address')}
                  >
                    Address
                  </button>
                  <button
                    disabled={disabled}
                    aria-pressed={mode === 'commute'}
                    className={`flex-1 rounded-lg py-1.5 text-center text-[11px] font-bold transition ${mode === 'commute' ? 'bg-sky-600 text-white dark:bg-amber-400 dark:text-slate-950 shadow-md' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    onClick={() => setMode('commute')}
                  >
                    Commute
                  </button>
                </div>

                {mode !== 'commute' && (
                  <PanelCaption>
                    {mode === 'inspect'
                      ? 'Click any point on the map for local flood index (FSI).'
                      : mode === 'route'
                      ? (!start ? '1. Click map for start point.' : !end ? '2. Click map for destination.' : 'Points connected via road network.')
                      : 'Search Mumbai locations to compute flood-aware route.'}
                  </PanelCaption>
                )}

                {mode === 'commute' && (
                  <CommuteMonitor
                    event={event}
                    selectedMinutes={selectedMinutes}
                    rainfallSource={rainfallSource}
                    intervalReady={intervalReady}
                    onApplyRouteToMap={(s, e, routeRes) => {
                      setPoints([s, e])
                      if (routeRes) setRoutes(routeRes)
                      setRouteStatus('')
                    }}
                    onClearMapRoute={() => {
                      setPoints([])
                      setRoutes(null)
                      setRouteStatus('')
                    }}
                  />
                )}

                {mode === 'route-address' && (
                  <AddressRoutePanel
                    onRouteFound={(s, e) => { setPoints([s, e]); setRoutes(null); setRouteStatus('') }}
                    onClear={() => { setPoints([]); setRoutes(null); setRouteStatus('') }}
                    disabled={disabled}
                    routeStatus={routeStatus}
                    hasRoute={!!routes}
                  />
                )}

                {mode === 'route' && points.map((p, i) => (
                  <div key={i} className="mt-2 flex items-center justify-between rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-primary)] px-2.5 py-1.5 font-[family-name:var(--font-hud)] text-xs">
                    <span className="font-bold text-sky-600 dark:text-amber-300">{i === 0 ? 'A (Start)' : 'B (Dest)'}</span>
                    <span className="text-[var(--text-secondary)]">{p.lat.toFixed(4)}, {p.lng.toFixed(4)}</span>
                  </div>
                ))}

                {mode === 'route' && start && (
                  <button
                    type="button"
                    className="hud-button mt-2.5 h-8 w-full text-xs text-rose-600 hover:text-rose-700 dark:text-rose-300 dark:hover:text-rose-200"
                    onClick={() => { setPoints([]); setRoutes(null); setRouteStatus('') }}
                  >
                    Clear Points
                  </button>
                )}

                <RiskToleranceSelector value={riskTolerance} onChange={setRiskTolerance} disabled={disabled} />

                {/* Route Comparison Output */}
                {routes && <div className="mt-3 space-y-2" aria-live="polite">
                  <RouteComparisonPanel routes={routes} tolerance={riskTolerance} />
                  {routes.warning && <Panel className="border-[color:var(--warning-color)]/70 bg-[color:var(--warning-color)]/15 p-3">
                    <div className="flex gap-2">
                      <AlertCircle size={16} className="mt-0.5 shrink-0 text-[var(--warning-color)]" />
                      <PanelCaption className="text-[var(--text-primary)]">{routes.warning}</PanelCaption>
                    </div>
                    <RouteSuggestion route={routes.suggested_route} onAccept={setRiskTolerance} />
                  </Panel>}
                </div>}
              </Panel></MapCard>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Desktop HUD Panel Toggle */}
      <button
        type="button"
        title={desktopHudVisible ? 'Hide all cards' : 'Show all cards'}
        aria-label={desktopHudVisible ? 'Hide all cards' : 'Show all cards'}
        className="pointer-events-auto absolute left-4 bottom-20 z-40 flex hud-button items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs shadow-lg"
        onClick={() => { if (desktopHudVisible) setMobileTab(null); setDesktopHudVisible(v => !v) }}
      >
        {desktopHudVisible ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        {desktopHudVisible ? 'Hide all cards' : 'Show all cards'}
      </button>

      {/* DESKTOP TIMELINE DOCK (Bottom center) */}
      <section aria-label="FSI time interval" className="pointer-events-none absolute bottom-5 left-1/2 z-20 hidden w-[min(90%,36rem)] -translate-x-1/2 lg:block">
        <MapCard title="Rainfall time window" hidden={!desktopHudVisible} className="pointer-events-auto">
          <div className="pointer-events-auto hud-panel p-3 shadow-xl backdrop-blur-2xl">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Clock size={13} className="text-[var(--cyan-primary)]" />
                <span className="font-[family-name:var(--font-hud)] text-[11px] font-bold uppercase tracking-wider text-[var(--text-heading)]">
                  Observed Window
                  {minutes ? ` (${minutes} min)` : ''}
                </span>
              </div>
              {activeWindow && (
                <div className="timeline-window-badge flex items-center gap-1.5 rounded-md px-2.5 py-0.5 text-[11px] font-mono font-bold shadow-xs">
                  <span>{activeWindow.start_time.slice(11, 16)}</span>
                  <span className="timeline-arrow">→</span>
                  <span>{activeWindow.end_time.slice(11, 16)}</span>
                </div>
              )}
            </div>

            <div role="group" aria-label="Rainfall duration intervals" className="grid grid-cols-6 gap-1.5">
              {[15, 30, 60, 90, 120, 180].map(val => {
                const active = !!activeWindow && val === minutes
                return (
                  <button
                    key={val}
                    className={`hud-button flex h-9 items-center justify-center rounded-lg text-xs font-bold transition-all ${
                      active
                        ? 'bg-sky-600 text-white dark:bg-amber-400 dark:text-slate-950 shadow-sm'
                        : ''
                    }`}
                    disabled={disabled || !windows?.windows.some(w => w.minutes === val)}
                    aria-pressed={active}
                    onClick={() => { setMinutes(val); setRoutes(null); setSummary(null); setRouteStatus('') }}
                  >
                    {val}m
                  </button>
                )
              })}
            </div>
          </div>
        </MapCard>
      </section>

      {/* MOBILE BOTTOM NAVIGATION DOCK (4 Tabs) */}
      <nav aria-label="Mobile Navigation" className="absolute bottom-0 inset-x-0 z-30 flex lg:hidden items-center justify-around border-t border-[var(--border-primary)] bg-[var(--bg-glass-nav)] px-2 py-2 backdrop-blur-2xl pb-[max(0.6rem,env(safe-area-inset-bottom))] shadow-2xl">
        <button
          type="button"
          aria-pressed={mobileTab === 'events'}
          className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl text-[10px] font-semibold transition ${mobileTab === 'events' ? 'text-[var(--gold-light)] bg-[var(--gold-primary)]/20 shadow-sm' : 'text-[var(--text-secondary)]'}`}
          onClick={() => setMobileTab(current => current === 'events' ? null : 'events')}
        >
          <Calendar size={18} />
          <span>Events</span>
        </button>

        <button
          type="button"
          aria-pressed={mobileTab === 'routes'}
          className={`flex flex-col items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-semibold transition ${mobileTab === 'routes' ? 'text-[var(--cyan-primary)] bg-[var(--cyan-primary)]/20 shadow-sm' : 'text-[var(--text-secondary)]'}`}
          onClick={() => {
            setMobileTab(current => current === 'routes' ? null : 'routes')
            if (mode === 'inspect') setMode('route-address')
          }}
        >
          <Route size={18} />
          <span>Routes</span>
        </button>

        <button
          type="button"
          aria-pressed={mobileTab === 'commute'}
          className={`flex flex-col items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-semibold transition ${mobileTab === 'commute' ? 'text-[var(--gold-light)] bg-[var(--gold-primary)]/20 shadow-sm' : 'text-[var(--text-secondary)]'}`}
          onClick={() => setMobileTab(current => current === 'commute' ? null : 'commute')}
        >
          <Briefcase size={18} />
          <span>Commute</span>
        </button>

        <button
          type="button"
          aria-pressed={mobileTab === 'legend'}
          className={`flex flex-col items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-semibold transition ${mobileTab === 'legend' ? 'text-[var(--gold-light)] bg-[var(--gold-primary)]/20 shadow-sm' : 'text-[var(--text-secondary)]'}`}
          onClick={() => setMobileTab(current => current === 'legend' ? null : 'legend')}
        >
          <Layers size={18} />
          <span>Legend</span>
        </button>

        <button
          type="button"
          aria-pressed={mode === 'inspect' && mobileTab === null}
          className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl text-[10px] font-semibold transition ${mode === 'inspect' && mobileTab === null ? 'text-emerald-400 bg-emerald-500/20 shadow-sm' : 'text-[var(--text-secondary)]'}`}
          onClick={() => {
            setMode('inspect')
            setMobileTab(null)
          }}
        >
          <Crosshair size={18} />
          <span>Inspect</span>
        </button>
      </nav>

      {/* MOBILE ANIMATED BOTTOM SHEET */}
      <AnimatePresence>
        {mobileTab !== null && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-30 bg-black/60 backdrop-blur-md lg:hidden"
              onClick={() => setMobileTab(null)}
            />

            {/* Sheet Container */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="absolute bottom-[58px] inset-x-0 z-40 max-h-[78vh] overflow-hidden rounded-t-3xl border-t border-[var(--border-primary)] bg-[var(--bg-sheet)] p-4 shadow-2xl backdrop-blur-2xl lg:hidden flex flex-col"
            >
              {/* Drag handle / Header */}
              <div className="flex items-center justify-between border-b border-[var(--border-secondary)] pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-8 rounded-full bg-slate-500/40 mr-2" />
                  <h3 className="font-[family-name:var(--font-hud)] text-xs font-bold uppercase tracking-wider text-[var(--text-heading)]">
                    {mobileTab === 'events' && '📅 Rainfall Events & Intervals'}
                    {mobileTab === 'routes' && '🧭 Safe Flood-Aware Routing'}
                    {mobileTab === 'commute' && '💼 Daily Commute Risk Monitor'}
                    {mobileTab === 'legend' && '📊 Layers & Susceptibility Scale'}
                  </h3>
                </div>
                <button
                  type="button"
                  aria-label="Close sheet"
                  className="rounded-full p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] transition"
                  onClick={() => setMobileTab(null)}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Sheet Body Content */}
              <div className="overflow-y-auto pt-3 pb-6 flex-1 space-y-4">
                {/* EVENTS TAB CONTENT */}
                {mobileTab === 'events' && (
                  <div className="space-y-3.5">
                    <div>
                      <PanelLabel className="mb-1.5">Rainfall Source &amp; Event</PanelLabel>
                      <select
                        aria-label="Rainfall source"
                        className="mb-2 w-full rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-primary)] px-3 py-2.5 text-xs font-semibold text-[var(--text-primary)] shadow-sm focus:outline-none focus:border-[var(--gold-primary)]"
                        defaultValue="observed"
                      >
                        <option value="observed">Observed rainfall</option>
                      </select>
                      <div className="flex gap-2">
                        <select
                          aria-label="Rainfall event selection"
                          className="w-full rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-primary)] px-3 py-2.5 text-xs font-semibold text-[var(--text-primary)] shadow-sm focus:outline-none focus:border-[var(--gold-primary)]"
                          value={event}
                          disabled={eventsLoading || !events.length}
                          onChange={e => { setEvent(e.target.value); setRoutes(null); setSummary(null); setApiError('') }}
                        >
                          {!events.length && <option value="">{eventsLoading ? 'Loading events…' : 'No events found'}</option>}
                          {events.map(date => <option key={date} value={date}>{date}</option>)}
                        </select>
                        <button
                          type="button"
                          aria-label="Refresh events"
                          disabled={eventsLoading}
                          className="hud-button flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                          onClick={() => setRefresh(v => v + 1)}
                        >
                          <RefreshCw size={15} className={eventsLoading ? 'animate-spin' : ''} />
                        </button>
                      </div>
                    </div>

                    {/* Time Intervals */}
                    <div>
                      <div className="mb-1.5 flex items-center justify-between">
                        <PanelLabel>Accumulation Window</PanelLabel>
                        {activeWindow && (
                          <div className="timeline-window-badge flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[11px] font-bold shadow-xs">
                            <span>{activeWindow.start_time.slice(11, 16)}</span>
                            <span className="timeline-arrow">→</span>
                            <span>{activeWindow.end_time.slice(11, 16)}</span>
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[15, 30, 60, 90, 120, 180].map(val => (
                          <button
                            key={val}
                            className="hud-button h-10 px-2 text-xs font-bold"
                            disabled={disabled || !windows?.windows.some(w => w.minutes === val)}
                            aria-pressed={!!activeWindow && val === minutes}
                            onClick={() => { setMinutes(val); setRoutes(null); setSummary(null); setRouteStatus('') }}
                          >
                            {val} minutes
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* FSI Stats */}
                    {summary && (
                      <div className="rounded-2xl border border-[var(--border-secondary)] bg-[var(--bg-primary)] p-3 font-[family-name:var(--font-hud)] shadow-sm">
                        <div className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-secondary)] mb-2">Event Summary Statistics</div>
                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                          <div className="rounded-xl bg-[var(--bg-secondary)] p-2">
                            <span className="text-[10px] text-[var(--text-secondary)] block font-medium">MIN</span>
                            <b className="text-[var(--text-primary)]">{summary.fsi_min.toFixed(2)}</b>
                          </div>
                          <div className="rounded-xl bg-[var(--bg-secondary)] p-2">
                            <span className="text-[10px] text-[var(--text-secondary)] block font-medium">MEAN</span>
                            <b className="text-[var(--cyan-primary)]">{summary.fsi_mean.toFixed(2)}</b>
                          </div>
                          <div className="rounded-xl bg-[var(--bg-secondary)] p-2">
                            <span className="text-[10px] text-[var(--text-secondary)] block font-medium">MAX</span>
                            <b className="text-amber-400">{summary.fsi_max.toFixed(2)}</b>
                          </div>
                        </div>
                      </div>
                    )}

                    {intervalReady && (
                      <a
                        className="download-geotiff-btn flex items-center justify-center gap-2 rounded-xl border-2 border-amber-500/80 bg-amber-400/20 py-3 text-xs font-bold text-black shadow-sm transition hover:bg-amber-400/30 hover:border-amber-600 dark:border-amber-400/70 dark:bg-amber-400/15 dark:text-white dark:hover:bg-amber-400/25"
                        href={`${API_BASE}/flood/raster/${encodeURIComponent(event)}${windowQuery(selectedMinutes, rainfallSource)}`}
                        download
                      >
                        <Download size={15} className="download-geotiff-btn stroke-[2.5]" />
                        <span className="download-geotiff-btn font-bold">Download FSI GeoTIFF</span>
                      </a>
                    )}
                  </div>
                )}

                {/* ROUTES TAB CONTENT */}
                {mobileTab === 'routes' && (
                  <div className="space-y-3">
                    <div className="flex gap-1 rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-primary)] p-1 shadow-inner backdrop-blur-md">
                      <button
                        type="button"
                        className={`flex-1 rounded-lg py-2 text-center text-xs font-bold transition ${mode === 'route-address' ? 'bg-sky-600 text-white dark:bg-amber-400 dark:text-slate-950 shadow-md' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                        onClick={() => setMode('route-address')}
                      >
                        Address Search
                      </button>
                      <button
                        type="button"
                        className={`flex-1 rounded-lg py-2 text-center text-xs font-bold transition ${mode === 'route' ? 'bg-sky-600 text-white dark:bg-amber-400 dark:text-slate-950 shadow-md' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                        onClick={() => {
                          setMode('route')
                          setMobileTab(null) // Dismiss sheet to let user tap points on map
                        }}
                      >
                        Pick on Map
                      </button>
                    </div>

                    {mode === 'route-address' ? (
                    <AddressRoutePanel
                      onRouteFound={(s, e) => { setPoints([s, e]); setRoutes(null); setRouteStatus('') }}
                      onClear={() => { setPoints([]); setRoutes(null); setRouteStatus('') }}
                      disabled={disabled}
                      routeStatus={routeStatus}
                      hasRoute={!!routes}
                    />
                    ) : <div className="space-y-2 text-xs text-[var(--text-secondary)]">
                      <p>{!start ? 'Pick your start point on the map.' : !end ? 'Pick your destination on the map.' : 'Start and destination are selected on the map.'}</p>
                      {points.map((point, index) => <p key={index}>{index === 0 ? 'From' : 'To'}: {point.lat.toFixed(4)}, {point.lng.toFixed(4)}</p>)}
                    </div>}

                    <RiskToleranceSelector value={riskTolerance} onChange={setRiskTolerance} disabled={disabled} />

                    {/* Route Results Card on Mobile */}
                    {routes && <div className="space-y-2" aria-live="polite">
                      <RouteComparisonPanel routes={routes} tolerance={riskTolerance} onView={() => setMobileTab(null)} />
                      {routes.warning && <Panel className="border-[color:var(--warning-color)]/70 bg-[color:var(--warning-color)]/15 p-3">
                        <div className="flex gap-2">
                          <AlertCircle size={16} className="mt-0.5 shrink-0 text-[var(--warning-color)]" />
                          <PanelCaption className="text-[var(--text-primary)]">{routes.warning}</PanelCaption>
                        </div>
                        <RouteSuggestion route={routes.suggested_route} onAccept={setRiskTolerance} />
                      </Panel>}
                    </div>}
                  </div>
                )}

                {/* COMMUTE TAB CONTENT ON MOBILE */}
                {mobileTab === 'commute' && (
                  <CommuteMonitor
                    event={event}
                    selectedMinutes={selectedMinutes}
                    rainfallSource={rainfallSource}
                    intervalReady={intervalReady}
                    onApplyRouteToMap={(s, e, routeRes) => {
                      setPoints([s, e])
                      if (routeRes) setRoutes(routeRes)
                      setRouteStatus('')
                    }}
                    onClearMapRoute={() => {
                      setPoints([])
                      setRoutes(null)
                      setRouteStatus('')
                    }}
                    onCloseSheet={() => setMobileTab(null)}
                  />
                )}

                {/* LEGEND TAB CONTENT */}
                {mobileTab === 'legend' && (
                  <div className="space-y-3.5">
                    {/* View Layer Toggles */}
                    <div className="flex gap-2">
                      <button
                        disabled={!ready}
                        aria-pressed={satellite}
                        className="hud-button flex h-10 flex-1 items-center justify-center gap-2 text-xs"
                        onClick={() => setSatellite(v => !v)}
                      >
                        <Satellite size={15} />
                        Satellite Imagery
                      </button>
                    </div>

                    {/* Scale */}
                    <div className="space-y-2">
                      <PanelLabel>Flood Susceptibility Index (0.0 – 1.0)</PanelLabel>
                      {[
                        { label: 'Low Susceptibility', range: '0.00 – 0.25', color: FSI_COLORS[0] },
                        { label: 'Medium Susceptibility', range: '0.25 – 0.50', color: FSI_COLORS[1] },
                        { label: 'High Susceptibility', range: '0.50 – 0.75', color: FSI_COLORS[2] },
                        { label: 'Severe Susceptibility', range: '0.75 – 1.00', color: FSI_COLORS[3] },
                      ].map(item => (
                        <div className="flex items-center justify-between rounded-lg border border-[var(--border-secondary)] bg-[var(--bg-primary)] px-3 py-2 text-xs" key={item.label}>
                          <div className="flex items-center gap-2.5">
                            <span className="h-3.5 w-3.5 rounded shadow" style={{ background: item.color, border: item.color === 'transparent' ? '1px solid #94a3b8' : undefined }} />
                            <span className="font-medium text-[var(--text-primary)]">{item.label}</span>
                          </div>
                          <span className="font-[family-name:var(--font-hud)] text-[11px] text-[var(--text-secondary)]">{item.range}</span>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-primary)] p-3 text-xs text-[var(--text-secondary)] space-y-2">
                      <p className="text-[11px] leading-relaxed">
                        Risk shading is shown over land. Open water is unshaded. Extrapolation details are available when inspecting a point.
                      </p>
                      <p className="text-[11px] leading-relaxed">
                        Overlay fades at data limits. Areas beyond coverage are unassessed.
                      </p>
                    </div>
                    <DrainageNetworkControl summary={drainageSummary} full={showFullDrainage} affected={showAffectedDrainage} onToggle={toggleFullDrainage} onAffectedToggle={toggleAffectedDrainage} />
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Map Pan & Zoom Controls */}
    </section>
  )
}
