/**
 * Type definitions for the Mumbai Flood mobile app.
 * Direct parity with the web frontend types and backend schemas.
 */

export type RainfallSource = 'observed' | 'nowcast'

export type RiskTolerance = 'low' | 'medium' | 'high' | 'severe'

export interface RoutePoint {
  lat: number
  lng: number
}

export type MapMode = 'inspect' | 'route' | 'route-address'

export type MobileTab = 'events' | 'routes' | 'legend' | 'inspect' | null

export type ForecastOffset = 0 | 30 | 60 | 90 | 120 | 180

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

export interface DrainageFeature<G, P> {
  type: 'Feature'
  id: string
  geometry: G
  properties: P
}

export interface DrainageFeatureCollection<G, P> {
  type: 'FeatureCollection'
  features: DrainageFeature<G, P>[]
}

export interface DrainagePointGeometry {
  type: 'Point'
  coordinates: [number, number] // [lng, lat]
}

export interface DrainageLineGeometry {
  type: 'LineString'
  coordinates: [number, number][] // [[lng, lat], ...]
}

export interface DrainageResponse {
  manholes: DrainageFeatureCollection<DrainagePointGeometry, DrainageManhole>
  conduits: DrainageFeatureCollection<DrainageLineGeometry, DrainageConduit>
  summary: {
    total_manholes: number
    surcharged_manholes: number
    total_conduits: number
    surcharged_conduits: number
  }
}
