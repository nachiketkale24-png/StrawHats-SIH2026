import type { RoutePoint } from '../types/flood'
import type { RiskTolerance } from '../components/RoutePanel'
import type { FeatureCollection, LineString, Point } from 'geojson'

export const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
export type RainfallSource = 'nowcast' | 'observed'
export interface DrainageManhole {
  id: string
  ground_elev: number | null
  surcharged: boolean
  surcharge_ratio: number | null
  q_in_m3s: number | null
  capacity_m3s: number | null
}
export interface DrainageConduit {
  id: string
  fromNodeId: string
  toNodeId: string
  q_in_m3s: number | null
  capacity_m3s: number | null
  surcharged: boolean
  surcharge_ratio: number | null
}
export interface DrainageResponse {
  manholes: FeatureCollection<Point, DrainageManhole>
  conduits: FeatureCollection<LineString, DrainageConduit>
  summary: {
    total_manholes: number
    surcharged_manholes: number
    total_conduits: number
    surcharged_conduits: number
  }
}
export async function getDrainage(event: string, signal: AbortSignal, full = false,
  minutes?: number, rainfallSource: RainfallSource = 'observed'): Promise<DrainageResponse> {
  const query = new URLSearchParams()
  if (full) query.set('full', 'true')
  if (minutes !== undefined) query.set('window_minutes', String(minutes))
  if (rainfallSource === 'nowcast') query.set('rainfall_source', rainfallSource)
  const suffix = query.size ? `?${query}` : ''
  return (await apiRequest(`/drainage/${encodeURIComponent(event)}${suffix}`, signal)).json()
}
export interface EventSummary { event_date: string; fsi_min: number; fsi_max: number; fsi_mean: number }
export interface EventWindow { minutes: number; start_time: string; end_time: string }
export interface EventWindows { event_date: string; time_basis?: string; windows: EventWindow[] }
export function windowQuery(minutes?: number, rainfallSource?: RainfallSource) {
  const query = new URLSearchParams()
  if (minutes !== undefined) query.set('window_minutes', String(minutes))
  if (rainfallSource) query.set('rainfall_source', rainfallSource)
  const encoded = query.toString()
  return encoded ? `?${encoded}` : ''
}
export async function getWindows(event: string, signal: AbortSignal, rainfallSource: RainfallSource): Promise<EventWindows> {
  return (await apiRequest(`/flood/windows/${encodeURIComponent(event)}${windowQuery(undefined, rainfallSource)}`, signal)).json()
}
export interface ApiRoute { length_m: number; max_risk: number; avg_risk: number; coordinates: [number, number][] }
export interface ApiRouteLine { type: 'LineString'; coordinates: [number, number][] }
export interface RouteComparison {
  suggested_route: (ApiRoute & { risk_tolerance: RiskTolerance }) | null
  event_date: string
  normal_route: ApiRoute
  normal_distance_km: number
  tolerance_route: ApiRouteLine | null
  tolerance_distance_km: number | null
  max_risk_on_route: number | null
  high_severe_segment_count: number
  warning: string | null
}
export async function apiRequest(path: string, signal: AbortSignal, body?: unknown) {
  const response = await fetch(`${API_BASE}${path}`, {
    signal, ...(body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => null)
    throw new Error(typeof error?.detail === 'string' ? error.detail : `API request failed (${response.status}).`)
  }
  return response
}
export async function getEvents(signal: AbortSignal, rainfallSource: RainfallSource): Promise<string[]> {
  const events = await (await apiRequest(`/flood/events${windowQuery(undefined, rainfallSource)}`, signal)).json()
  if (!Array.isArray(events) || !events.every(event => typeof event === 'string')) throw new Error('Unexpected event response. Check the API address.')
  return events
}
export async function getSummary(event: string, signal: AbortSignal, minutes: number | undefined, rainfallSource: RainfallSource): Promise<EventSummary> {
  return (await apiRequest(`/flood/summary/${encodeURIComponent(event)}${windowQuery(minutes, rainfallSource)}`, signal)).json()
}
export async function getRoutes(event: string, start: RoutePoint, end: RoutePoint, riskTolerance: RiskTolerance, signal: AbortSignal, minutes: number | undefined, rainfallSource: RainfallSource): Promise<RouteComparison> {
  const result = await (await apiRequest('/route', signal, {
    event_date: event, origin_lat: start.lat, origin_lon: start.lng, dest_lat: end.lat, dest_lon: end.lng, risk_tolerance: riskTolerance, window_minutes: minutes, rainfall_source: rainfallSource,
  })).json() as Partial<RouteComparison> & { normal_route: ApiRoute; flood_aware_route?: ApiRoute }

  if (!result.normal_route || !Number.isFinite(result.normal_route.length_m)) {
    throw new Error('Unexpected route response. Check the API server version.')
  }

  const fallbackRoute = result.flood_aware_route
  const toleranceRoute = result.tolerance_route === null ? null : result.tolerance_route?.type === 'LineString' && Array.isArray(result.tolerance_route.coordinates)
    ? result.tolerance_route
    : fallbackRoute && { type: 'LineString' as const, coordinates: fallbackRoute.coordinates }
  if (toleranceRoute === undefined) {
    throw new Error('This API server does not provide a tolerance route. Restart the backend.')
  }
  const fallbackDistanceKm = fallbackRoute ? fallbackRoute.length_m / 1000 : undefined

  return {
    suggested_route: result.suggested_route ?? null,
    event_date: result.event_date ?? event,
    normal_route: result.normal_route,
    normal_distance_km: result.normal_distance_km ?? result.normal_route.length_m / 1000,
    tolerance_route: toleranceRoute ?? null,
    tolerance_distance_km: toleranceRoute ? result.tolerance_distance_km ?? fallbackDistanceKm ?? result.normal_route.length_m / 1000 : null,
    max_risk_on_route: toleranceRoute ? result.max_risk_on_route ?? fallbackRoute?.max_risk ?? result.normal_route.max_risk : null,
    high_severe_segment_count: result.high_severe_segment_count ?? 0,
    warning: result.warning ?? null,
  }
}

export interface GeocodeResult { lat: number; lng: number; displayName: string }
export async function geocodeAddress(address: string, signal: AbortSignal): Promise<GeocodeResult | null> {
  // If the user typed or pasted raw coordinates (e.g. "19.1501, 72.8564"), parse them directly
  const coordsMatch = address.match(/^\s*(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)\s*$/)
  if (coordsMatch) {
    return { lat: parseFloat(coordsMatch[1]), lng: parseFloat(coordsMatch[3]), displayName: address }
  }

  const query = encodeURIComponent(address + (address.toLowerCase().includes('mumbai') ? '' : ', Mumbai'))
  const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`
  // Add a unique user-agent or identifier in the headers/params if possible, but standard fetch works.
  const response = await fetch(url, { signal, headers: { 'Accept-Language': 'en-US,en;q=0.9' } })
  if (!response.ok) throw new Error('Geocoding service unavailable.')
  const data = await response.json()
  if (!data || data.length === 0) return null
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), displayName: data[0].display_name }
}


export async function geocodeSuggest(queryText: string, signal: AbortSignal): Promise<GeocodeResult[]> {
  if (!queryText.trim()) return []
  const query = encodeURIComponent(queryText + (queryText.toLowerCase().includes('mumbai') ? '' : ', Mumbai'))
  const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=5`
  const response = await fetch(url, { signal, headers: { 'Accept-Language': 'en-US,en;q=0.9' } })
  if (!response.ok) return []
  const data = await response.json()
  if (!data || !Array.isArray(data)) return []
  return data.map((d: any) => ({ lat: parseFloat(d.lat), lng: parseFloat(d.lon), displayName: d.display_name }))
}
