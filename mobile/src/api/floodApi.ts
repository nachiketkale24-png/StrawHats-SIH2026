/**
 * Flood API client for the Mobile App.
 * Parity with web frontend lib/floodApi.ts + backend FastAPI routers.
 */
import { getApiBase } from './config'
import type {
  RoutePoint,
  RainfallSource,
  RiskTolerance,
  DrainageResponse,
} from '../types/flood'

export type { DrainageResponse }

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EventSummary {
  event_date: string
  fsi_min: number
  fsi_max: number
  fsi_mean: number
}

export interface EventWindow {
  minutes: number
  start_time: string
  end_time: string
}

export interface EventWindows {
  event_date: string
  time_basis?: string
  windows: EventWindow[]
}

export interface ApiRoute {
  length_m: number
  max_risk: number
  avg_risk: number
  coordinates: [number, number][] // [[lon, lat], ...]
}

export interface ApiRouteLine {
  type: 'LineString'
  coordinates: [number, number][] // [[lon, lat], ...]
}

export interface RouteComparison {
  event_date: string
  normal_route: ApiRoute
  normal_distance_km: number
  flood_aware_route?: ApiRoute
  flood_aware_distance_km?: number
  tolerance_route?: ApiRouteLine
  tolerance_distance_km?: number
  extra_distance_m: number
  extra_distance_pct: number
  detour_pct?: number
  risk_tolerance?: RiskTolerance
  max_risk_on_route: number
  high_severe_segment_count: number
  warning?: string | null
}

export interface GeocodeResult {
  lat: number
  lng: number
  displayName: string
}

// ─── Mumbai Landmark Knowledge Base ──────────────────────────────────────────

const MUMBAI_LANDMARKS: GeocodeResult[] = [
  { displayName: 'Bandra Kurla Complex (BKC), Mumbai', lat: 19.0688, lng: 72.8687 },
  { displayName: 'Chhatrapati Shivaji Maharaj International Airport (BOM), Mumbai', lat: 19.0896, lng: 72.8656 },
  { displayName: 'Dadar Railway Station, Mumbai', lat: 19.0178, lng: 72.8478 },
  { displayName: 'Andheri West, Mumbai', lat: 19.1136, lng: 72.8697 },
  { displayName: 'Andheri East / MIDC, Mumbai', lat: 19.1197, lng: 72.8790 },
  { displayName: 'Kurla West / LBS Marg, Mumbai', lat: 19.0726, lng: 72.8845 },
  { displayName: 'Colaba / Gateway of India, Mumbai', lat: 18.9220, lng: 72.8347 },
  { displayName: 'Marine Drive / Nariman Point, Mumbai', lat: 18.9269, lng: 72.8233 },
  { displayName: 'CSMT Railway Terminus, Mumbai', lat: 18.9401, lng: 72.8354 },
  { displayName: 'Churchgate Station, Mumbai', lat: 18.9352, lng: 72.8272 },
  { displayName: 'Lower Parel / High Street Phoenix, Mumbai', lat: 18.9953, lng: 72.8301 },
  { displayName: 'Worli Sea Face / Sea Link, Mumbai', lat: 19.0176, lng: 72.8150 },
  { displayName: 'Powai / IIT Bombay, Mumbai', lat: 19.1257, lng: 72.9158 },
  { displayName: 'Ghatkopar Station, Mumbai', lat: 19.0860, lng: 72.9090 },
  { displayName: 'Chembur / Diamond Garden, Mumbai', lat: 19.0622, lng: 72.8996 },
  { displayName: 'Sion Circle / GTB Nagar, Mumbai', lat: 19.0378, lng: 72.8631 },
  { displayName: 'Juhu Beach, Mumbai', lat: 19.0988, lng: 72.8267 },
  { displayName: 'Vile Parle East / West, Mumbai', lat: 19.0998, lng: 72.8438 },
  { displayName: 'Santacruz / Western Express Highway, Mumbai', lat: 19.0815, lng: 72.8415 },
  { displayName: 'Mahim / Shivaji Park, Mumbai', lat: 19.0354, lng: 72.8436 },
  { displayName: 'Goregaon East / Film City, Mumbai', lat: 19.1663, lng: 72.8526 },
  { displayName: 'Malad West / Inorbit Mall, Mumbai', lat: 19.1874, lng: 72.8484 },
  { displayName: 'Borivali Station / National Park, Mumbai', lat: 19.2288, lng: 72.8566 },
  { displayName: 'Kandivali West / East, Mumbai', lat: 19.2045, lng: 72.8522 },
  { displayName: 'Prabhadevi / Siddhivinayak Temple, Mumbai', lat: 19.0169, lng: 72.8304 },
  { displayName: 'Byculla / Mumbai Zoo, Mumbai', lat: 18.9750, lng: 72.8329 },
  { displayName: 'Parel / KEM Hospital, Mumbai', lat: 18.9932, lng: 72.8418 },
  { displayName: 'Wadala / Antop Hill, Mumbai', lat: 19.0153, lng: 72.8577 },
  { displayName: 'Dharavi, Mumbai', lat: 19.0402, lng: 72.8508 },
  { displayName: 'Thane Railway Station, Mumbai MMR', lat: 19.1860, lng: 72.9757 },
  { displayName: 'Vashi / Navi Mumbai, Mumbai MMR', lat: 19.0771, lng: 72.9986 },
  { displayName: 'Mulund West / East, Mumbai', lat: 19.1726, lng: 72.9565 },
  { displayName: 'Bhandup / LBS Road, Mumbai', lat: 19.1439, lng: 72.9366 },
  { displayName: 'Dahisar West, Mumbai', lat: 19.2494, lng: 72.8596 },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function windowQuery(minutes?: number, rainfallSource?: RainfallSource): string {
  const query = new URLSearchParams()
  if (minutes !== undefined) query.set('window_minutes', String(minutes))
  if (rainfallSource) query.set('rainfall_source', rainfallSource)
  const encoded = query.toString()
  return encoded ? `?${encoded}` : ''
}

export async function apiRequest(
  path: string,
  signal?: AbortSignal,
  body?: unknown
): Promise<Response> {
  const base = getApiBase()
  const response = await fetch(`${base}${path}`, {
    signal,
    ...(body === undefined
      ? {}
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => null)
    throw new Error(
      typeof error?.detail === 'string'
        ? error.detail
        : `API request failed (${response.status}).`
    )
  }
  return response
}

// ─── API Functions ───────────────────────────────────────────────────────────

export async function getEvents(
  signal?: AbortSignal,
  rainfallSource: RainfallSource = 'observed'
): Promise<string[]> {
  const events = await (
    await apiRequest(`/flood/events${windowQuery(undefined, rainfallSource)}`, signal)
  ).json()
  if (
    !Array.isArray(events) ||
    !events.every((event: unknown) => typeof event === 'string')
  ) {
    throw new Error('Unexpected event response. Check the API address.')
  }
  return events
}

export async function getWindows(
  event: string,
  signal?: AbortSignal,
  rainfallSource: RainfallSource = 'observed'
): Promise<EventWindows> {
  return (
    await apiRequest(
      `/flood/windows/${encodeURIComponent(event)}${windowQuery(undefined, rainfallSource)}`,
      signal
    )
  ).json()
}

export async function getSummary(
  event: string,
  signal?: AbortSignal,
  minutes?: number,
  rainfallSource: RainfallSource = 'observed'
): Promise<EventSummary> {
  return (
    await apiRequest(
      `/flood/summary/${encodeURIComponent(event)}${windowQuery(minutes, rainfallSource)}`,
      signal
    )
  ).json()
}

export async function getDrainage(
  event: string,
  signal?: AbortSignal,
  full = false
): Promise<DrainageResponse> {
  return (
    await apiRequest(
      `/drainage/${encodeURIComponent(event)}${full ? '?full=true' : ''}`,
      signal
    )
  ).json()
}

export async function getRoutes(
  event: string,
  start: RoutePoint,
  end: RoutePoint,
  riskTolerance: RiskTolerance = 'low',
  signal?: AbortSignal,
  minutes?: number,
  rainfallSource: RainfallSource = 'observed'
): Promise<RouteComparison> {
  const result = (await (
    await apiRequest('/route', signal, {
      event_date: event,
      origin_lat: start.lat,
      origin_lon: start.lng,
      dest_lat: end.lat,
      dest_lon: end.lng,
      risk_tolerance: riskTolerance,
      window_minutes: minutes,
      rainfall_source: rainfallSource,
    })
  ).json()) as Partial<RouteComparison> & {
    normal_route: ApiRoute
    flood_aware_route?: ApiRoute
    tolerance_route?: ApiRouteLine
  }

  if (!result.normal_route || !Number.isFinite(result.normal_route.length_m)) {
    throw new Error('Unexpected route response. Check API server.')
  }

  const fallbackRoute = result.flood_aware_route
  const toleranceRoute =
    result.tolerance_route?.type === 'LineString' &&
    Array.isArray(result.tolerance_route.coordinates)
      ? result.tolerance_route
      : fallbackRoute
      ? { type: 'LineString' as const, coordinates: fallbackRoute.coordinates }
      : undefined

  const normalDistanceKm =
    result.normal_distance_km ?? result.normal_route.length_m / 1000
  const toleranceDistanceKm =
    result.tolerance_distance_km ??
    (fallbackRoute ? fallbackRoute.length_m / 1000 : normalDistanceKm)

  return {
    event_date: result.event_date ?? event,
    normal_route: result.normal_route,
    normal_distance_km: Number(normalDistanceKm.toFixed(2)),
    flood_aware_route: fallbackRoute,
    flood_aware_distance_km: fallbackRoute
      ? Number((fallbackRoute.length_m / 1000).toFixed(2))
      : undefined,
    tolerance_route: toleranceRoute,
    tolerance_distance_km: Number(toleranceDistanceKm.toFixed(2)),
    extra_distance_m:
      result.extra_distance_m ??
      Math.max(0, (toleranceDistanceKm - normalDistanceKm) * 1000),
    extra_distance_pct:
      result.extra_distance_pct ??
      result.detour_pct ??
      (normalDistanceKm > 0
        ? ((toleranceDistanceKm - normalDistanceKm) / normalDistanceKm) * 100
        : 0),
    detour_pct: result.detour_pct,
    risk_tolerance: result.risk_tolerance ?? riskTolerance,
    max_risk_on_route:
      result.max_risk_on_route ?? fallbackRoute?.max_risk ?? result.normal_route.max_risk,
    high_severe_segment_count: result.high_severe_segment_count ?? 0,
    warning: result.warning ?? null,
  }
}

export async function getPointValue(
  event: string,
  lon: number,
  lat: number,
  signal?: AbortSignal,
  windowMinutes?: number,
  rainfallSource: RainfallSource = 'observed'
): Promise<{
  event_date: string
  lon: number
  lat: number
  fsi: number | null
  in_station_network?: boolean
}> {
  const query = new URLSearchParams({
    lon: String(lon),
    lat: String(lat),
    rainfall_source: rainfallSource,
  })
  if (windowMinutes !== undefined) query.set('window_minutes', String(windowMinutes))
  return (
    await apiRequest(
      `/flood/point/${encodeURIComponent(event)}?${query}`,
      signal
    )
  ).json()
}

// ─── Geocoding & Suggestions ─────────────────────────────────────────────────

export async function geocodeAddress(
  address: string,
  signal?: AbortSignal
): Promise<GeocodeResult | null> {
  const raw = address.trim()
  if (!raw) return null

  // Handle raw coordinates (e.g. "19.1501, 72.8564")
  const coordsMatch = raw.match(
    /^\s*(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)\s*$/
  )
  if (coordsMatch) {
    return {
      lat: parseFloat(coordsMatch[1]),
      lng: parseFloat(coordsMatch[3]),
      displayName: address,
    }
  }

  // Check local database first for instant matches
  const lower = raw.toLowerCase()
  const localMatch = MUMBAI_LANDMARKS.find(
    (l) =>
      l.displayName.toLowerCase().includes(lower) ||
      lower.includes(l.displayName.split(',')[0].toLowerCase())
  )
  if (localMatch) {
    return localMatch
  }

  // Query Nominatim with Mumbai bounds
  const query = encodeURIComponent(
    raw + (raw.toLowerCase().includes('mumbai') ? '' : ', Mumbai')
  )
  const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=in&viewbox=72.70,19.35,73.10,18.85`
  const response = await fetch(url, {
    signal,
    headers: {
      'Accept-Language': 'en-US,en;q=0.9',
      'User-Agent': 'StrawHats-Mumbai-Flood-App/1.0',
    },
  })
  if (!response.ok) throw new Error('Geocoding service unavailable.')
  const data = await response.json()
  if (!data || data.length === 0) return null
  return {
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon),
    displayName: data[0].display_name,
  }
}

export async function geocodeSuggest(
  queryText: string,
  signal?: AbortSignal
): Promise<GeocodeResult[]> {
  const raw = queryText.trim().toLowerCase()
  if (!raw || raw.length < 1) return []

  // 1. Instant local landmark matches (Super fast & reliable)
  const localMatches = MUMBAI_LANDMARKS.filter((l) =>
    l.displayName.toLowerCase().includes(raw)
  ).slice(0, 5)

  // 2. Fetch live Nominatim suggestions in parallel if query is longer
  try {
    const query = encodeURIComponent(
      queryText + (raw.includes('mumbai') ? '' : ', Mumbai')
    )
    const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=5&countrycodes=in&viewbox=72.70,19.35,73.10,18.85`
    const response = await fetch(url, {
      signal,
      headers: {
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent': 'StrawHats-Mumbai-Flood-App/1.0',
      },
    })
    if (response.ok) {
      const data = await response.json()
      if (Array.isArray(data) && data.length > 0) {
        const remoteMatches: GeocodeResult[] = data.map((d: any) => ({
          lat: parseFloat(d.lat),
          lng: parseFloat(d.lon),
          displayName: d.display_name,
        }))

        // Merge and deduplicate
        const combined = [...localMatches]
        for (const item of remoteMatches) {
          if (
            !combined.some(
              (c) =>
                Math.abs(c.lat - item.lat) < 0.001 &&
                Math.abs(c.lng - item.lng) < 0.001
            )
          ) {
            combined.push(item)
          }
        }
        return combined.slice(0, 6)
      }
    }
  } catch {}

  return localMatches
}
