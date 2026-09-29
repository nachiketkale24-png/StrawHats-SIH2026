import type { DrainageResponse } from './floodApi'

const layers = new WeakMap<google.maps.Map, google.maps.Data>()
const datasets = new WeakMap<google.maps.Map, DrainageResponse>()
const lineBounds = new WeakMap<object, [number, number, number, number]>()

function capacityColor(ratio: number) {
  const stops = [[21, 128, 61], [161, 98, 7], [220, 38, 38]]
  const segment = ratio < 0.7 ? 0 : 1
  const fraction = Math.max(0, Math.min(1, segment === 0 ? ratio / 0.7 : (ratio - 0.7) / 0.3))
  const rgb = stops[segment].map((value, i) => Math.round(value + (stops[segment + 1][i] - value) * fraction))
  return `rgb(${rgb.join(',')})`
}

export function refreshDrainageView(map: google.maps.Map) {
  const data = datasets.get(map)
  const bounds = map.getBounds()
  const layer = layers.get(map)
  if (!data || !bounds || !layer) return
  const sw = bounds.getSouthWest(), ne = bounds.getNorthEast()
  const west = sw.lng(), south = sw.lat(), east = ne.lng(), north = ne.lat()
  const visible = new Map<string, object>()
  data.manholes.features.forEach((feature, i) => {
    const { surcharged, surcharge_ratio: ratio } = feature.properties
    if ((map.getZoom() ?? 11) < 13 && !surcharged && (ratio === null || ratio <= 0.5)) return
    const [lng, lat] = feature.geometry.coordinates
    if (lng >= west && lng <= east && lat >= south && lat <= north) {
      visible.set(`node:${i}`, { ...feature, id: `node:${i}` })
    }
  })
  // Do not ask Google to process tens of thousands of invisible conduits.
  // Existing drainage lines are visible only from zoom 15 onward.
  if ((map.getZoom() ?? 11) >= 15) data.conduits.features.forEach((feature, i) => {
    let box = lineBounds.get(feature)
    if (!box) {
      box = [Infinity, Infinity, -Infinity, -Infinity]
      for (const [lng, lat] of feature.geometry.coordinates) {
        box[0] = Math.min(box[0], lng); box[1] = Math.min(box[1], lat)
        box[2] = Math.max(box[2], lng); box[3] = Math.max(box[3], lat)
      }
      lineBounds.set(feature, box)
    }
    if (box[0] <= east && box[2] >= west && box[1] <= north && box[3] >= south) {
      visible.set(`conduit:${i}`, { ...feature, id: `conduit:${i}` })
    }
  })
  layer.forEach(feature => {
    const key = String(feature.getId())
    if (visible.has(key)) visible.delete(key)
    else layer.remove(feature)
  })
  if (visible.size) layer.addGeoJson({ type: 'FeatureCollection', features: [...visible.values()] })
  layer.revertStyle()
}

export function drainageLayer(map: google.maps.Map) {
  let layer = layers.get(map)
  if (!layer) {
    layer = new google.maps.Data({ map })
    layers.set(map, layer)
    layer.setStyle(feature => {
      const node = feature.getGeometry()?.getType() === 'Point'
      const ratio = feature.getProperty('surcharge_ratio')
      const surcharged = feature.getProperty('surcharged') === true
      const strained = typeof ratio === 'number' && ratio > 0.5
      const color = node ? surcharged ? '#dc2626' : strained ? '#a16207' : '#15803d'
        : capacityColor(typeof ratio === 'number' ? ratio : 0)
      return {
        visible: node || (map.getZoom() ?? 11) >= 15,
        strokeColor: color, strokeWeight: 1.25, strokeOpacity: surcharged || strained ? 0.7 : 0.25,
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 4, fillColor: color,
          fillOpacity: surcharged || strained ? 1 : 0.4, strokeColor: '#ffffff', strokeWeight: 1 },
        zIndex: node ? 5 : 3,
      }
    })
  }
  return layer
}

export function clearDrainageLayers(map: google.maps.Map) {
  datasets.delete(map)
  const layer = layers.get(map)
  layer?.forEach(feature => layer.remove(feature))
}

export function updateDrainageLayers(map: google.maps.Map, data: DrainageResponse) {
  drainageLayer(map)
  clearDrainageLayers(map)
  datasets.set(map, data)
  refreshDrainageView(map)
}

export function removeDrainageLayer(map: google.maps.Map) {
  const layer = layers.get(map)
  if (layer) { clearDrainageLayers(map); layer.setMap(null); google.maps.event.clearInstanceListeners(layer) }
  layers.delete(map)
}
