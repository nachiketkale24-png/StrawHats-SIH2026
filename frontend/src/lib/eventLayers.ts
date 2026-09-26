import type { GeoJSONSource, Map } from 'maplibre-gl'
import { fromArrayBuffer } from 'geotiff'
import { apiRequest, type RainfallSource, windowQuery } from './floodApi'
import type { RouteComparison } from './floodApi'
import type { RoutePoint } from '../types/flood'
import { projectRaster, featherRasterMask } from './rasterProjection'
import type { RasterBounds } from './rasterProjection'
import { cachedDisplay } from './displayCache'

export const FSI_COLORS = ['#38bdf8', '#facc15', '#fb923c', '#ef4444']
export function addEventLayers(map: Map) {
  for (const id of ['normal-route', 'safe-route', 'route-points']) {
    map.addSource(id, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  }
  for (const [id, color, width] of [['normal-route', '#94a3b8', 7], ['safe-route', '#22d3ee', 4]] as const) {
    map.addLayer({ id, type: 'line', source: id, paint: { 'line-color': color, 'line-width': width }, layout: { 'line-cap': 'round', 'line-join': 'round' } })
  }
  map.addLayer({ id: 'route-points', type: 'circle', source: 'route-points', paint: { 'circle-radius': 10, 'circle-color': '#0f172a', 'circle-stroke-color': '#22d3ee', 'circle-stroke-width': 2 } })
  map.addLayer({ id: 'route-labels', type: 'symbol', source: 'route-points', layout: { 'text-field': ['get', 'label'], 'text-size': 12, 'text-allow-overlap': true }, paint: { 'text-color': '#ffffff' } })
}
export function updateEventRoutes(map: Map, points: RoutePoint[], routes: RouteComparison | null) {
  const preview = !routes?.tolerance_route && routes?.suggested_route
  map.setPaintProperty('safe-route', 'line-color', preview ? '#f59e0b' : '#22d3ee')
  map.setPaintProperty('safe-route', 'line-dasharray', preview ? [2, 1.5] : [1, 0])
  for (const [id, route] of [['normal-route', routes?.normal_route], ['safe-route', routes?.tolerance_route ?? routes?.suggested_route]] as const) {
    map.getSource<GeoJSONSource>(id)?.setData({ type: 'FeatureCollection', features: route && route.coordinates.length > 1 ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: route.coordinates } }] : [] })
  }
  map.getSource<GeoJSONSource>('route-points')?.setData({ type: 'FeatureCollection', features: points.map((point, index) => ({ type: 'Feature', properties: { label: index === 0 ? 'A' : 'B' }, geometry: { type: 'Point', coordinates: [point.lng, point.lat] } })) })
}
export function clearEventRaster(map: Map) {
  if (map.getLayer('event-fsi')) map.removeLayer('event-fsi')
  if (map.getSource('event-fsi')) map.removeSource('event-fsi')
}
export function clearCoverageOverlay(map: Map) {
  if (map.getLayer('station-coverage')) map.removeLayer('station-coverage')
  if (map.getSource('station-coverage')) map.removeSource('station-coverage')
}
async function readAlignedRaster(path: string, signal: AbortSignal) {
  const response = await apiRequest(path, signal)
  const tiff = await fromArrayBuffer(await response.arrayBuffer())
  const image = await tiff.getImage()
  const keys = image.getGeoKeys()
  if (keys?.GeographicTypeGeoKey !== 4326 || keys?.ProjectedCSTypeGeoKey) throw new Error('Map display requires a WGS84 flood raster. The original raster is available to download.')
  const resolution = image.getResolution()
  const matrix = image.getFileDirectory().getValue('ModelTransformation')
  if (resolution[0] <= 0 || resolution[1] >= 0 || (matrix && (matrix[1] !== 0 || matrix[4] !== 0))) throw new Error('This raster needs reprojection before display: unsupported grid orientation.')
  const sourceValues = await image.readRasters({ samples: [0], interleave: true, signal })
  signal.throwIfAborted()
  const bounds = image.getBoundingBox() as RasterBounds
  const projected = projectRaster(sourceValues as ArrayLike<number>, image.getWidth(), image.getHeight(), bounds)
  return { ...projected, bounds, nodata: image.getGDALNoData() }
}
function canvasFromPixels(width: number, height: number, paint: (pixels: ImageData) => void) {
  const canvas = document.createElement('canvas')
  canvas.width = width; canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not render the flood raster.')
  const pixels = context.createImageData(width, height)
  paint(pixels)
  context.putImageData(pixels, 0, 0)
  return canvas.toDataURL()
}
function imageCoordinates(bounds: RasterBounds) {
  const [west, south, east, north] = bounds
  return { url: '', coordinates: [[west, north], [east, north], [east, south], [west, south]] as [[number, number], [number, number], [number, number], [number, number]] }
}
export async function loadEventRaster(event: string, signal: AbortSignal, minutes: number | undefined, rainfallSource: RainfallSource) {
  const key = `raster:${rainfallSource}:${event}:${minutes ?? 'daily'}`
  return cachedDisplay(key, signal, () => renderEventRaster(event, new AbortController().signal, minutes, rainfallSource))
}
async function renderEventRaster(event: string, signal: AbortSignal, minutes: number | undefined, rainfallSource: RainfallSource) {
  const [raster, land] = await Promise.all([
    readAlignedRaster(`/flood/raster/${encodeURIComponent(event)}${windowQuery(minutes, rainfallSource)}`, signal),
    cachedDisplay('land-mask', signal, () => readAlignedRaster('/flood/land-mask', new AbortController().signal), Infinity),
  ])
  const { values, width, height, bounds, nodata } = raster
  if (land.width !== width || land.height !== height || land.bounds.some((value, i) => Math.abs(value - bounds[i]) > 1e-9)) {
    throw new Error('Land mask must match the flood raster grid')
  }
  const valid = Uint8Array.from(values, value => Number.isFinite(value) && value !== nodata && value >= 0 && value <= 1 ? 1 : 0)
  const opacity = featherRasterMask(valid, width, height)
  const url = canvasFromPixels(width, height, pixels => {
    for (let i = 0; i < width * height; i++) {
      const value = Number(values[i])
      if (!Number.isFinite(value) || value === nodata || value < 0 || value > 1 || land.values[i] !== 1) continue
      const color = FSI_COLORS[Math.min(3, Math.floor(value * 4))]
      pixels.data[i * 4] = parseInt(color.slice(1, 3), 16)
      pixels.data[i * 4 + 1] = parseInt(color.slice(3, 5), 16)
      pixels.data[i * 4 + 2] = parseInt(color.slice(5, 7), 16)
      pixels.data[i * 4 + 3] = Math.round((value < 0.25 ? 60 : 150) * opacity[i])
    }
  })
  return { url, coordinates: imageCoordinates(bounds).coordinates }
}
export async function loadCoverageOverlay(signal: AbortSignal) {
  const { values, width, height, bounds, nodata } = await readAlignedRaster('/flood/coverage-mask', signal)
  const valid = Uint8Array.from(values, value => Number.isFinite(value) && value !== nodata && value >= 0 && value <= 1 ? 1 : 0)
  const opacity = featherRasterMask(valid, width, height)
  const url = canvasFromPixels(width, height, pixels => {
    for (let i = 0; i < width * height; i++) {
      const value = Number(values[i])
      if (!Number.isFinite(value) || value === nodata || value >= 0.5) continue
      const x = i % width
      const y = Math.floor(i / width)
      const phase = (x + y) % 12
      const stripe = Math.max(0, 1 - Math.min(phase, 12 - phase) / 2)
      pixels.data[i * 4] = 203
      pixels.data[i * 4 + 1] = 213
      pixels.data[i * 4 + 2] = 225
      pixels.data[i * 4 + 3] = Math.round(55 * stripe * opacity[i])
    }
  })
  return { url, coordinates: imageCoordinates(bounds).coordinates }
}
