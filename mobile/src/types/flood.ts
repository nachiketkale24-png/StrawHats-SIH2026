/**
 * Type definitions for the Mumbai Flood app.
 * Ported from the web frontend's types/flood.ts
 */

export interface RoutePoint {
  lat: number
  lng: number
}

export type MapMode = 'inspect' | 'route' | 'route-address'

export type MobileTab = 'events' | 'routes' | 'legend' | 'inspect' | null

export type ForecastOffset = 0 | 30 | 60 | 90 | 120 | 180
