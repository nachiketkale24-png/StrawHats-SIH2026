import assert from 'node:assert/strict'
import { generateMockFlood, mockFlood, FORECAST_OFFSETS, GRID_SUBDIVISIONS } from '../src/data/mockFlood.ts'
import { findRoute } from '../src/lib/routing.ts'
import { MUMBAI_BOUNDS } from '../src/config/mumbai.ts'

assert.deepEqual(generateMockFlood(), mockFlood, 'Mock generation must be repeatable')
for (const offset of FORECAST_OFFSETS) {
  assert.equal(mockFlood.frames[offset].cells.length, GRID_SUBDIVISIONS ** 2)
  assert.equal(mockFlood.frames[offset].roads.features.length, 17)
  assert.ok(mockFlood.frames[offset].cells.every(cell => cell.timestampOffsetMin === offset))
  const [[west, south], [east, north]] = MUMBAI_BOUNDS
  for (const feature of mockFlood.frames[offset].grid.features) {
    assert.equal(feature.geometry.type, 'Point')
    const [lng, lat] = feature.geometry.coordinates
    assert.ok(lng >= west && lng <= east && lat >= south && lat <= north)
  }
  const lngs = mockFlood.frames[offset].cells.map(cell => cell.lng)
  const lats = mockFlood.frames[offset].cells.map(cell => cell.lat)
  assert.ok(Math.max(...lngs) - Math.min(...lngs) > (east - west) * 0.95)
  assert.ok(Math.max(...lats) - Math.min(...lats) > (north - south) * 0.95)
}
console.log('PASS: full-extent point sampling')
const a = { lat: 19.025, lng: 72.865 }
const b = { lat: 19.200, lng: 72.875 }
const roads = mockFlood.frames[90].roads
const weighted = findRoute(a, b, roads)
const shortest = findRoute(a, b, roads, 0)
assert.ok(weighted && shortest)
assert.ok(weighted.distanceKm > shortest.distanceKm, 'Flood penalty should cause a real detour')
assert.notDeepEqual(weighted.roadIds, shortest.roadIds)
assert.notEqual(findRoute(a, b, mockFlood.frames[0].roads).cost, weighted.cost, 'Forecast should change road costs even when the best path stays the same')
assert.deepEqual(findRoute(a, a, roads).points, [a])
assert.equal(findRoute(a, b, { type: 'FeatureCollection', features: [] }), null)
const disconnected = { ...roads, features: roads.features.filter(road => ['road-1', 'road-7'].includes(road.properties.id)) }
assert.equal(findRoute(a, b, disconnected), null)
console.log('PASS: deterministic frames, depth-weighted detour, forecast costs, same-junction, empty and disconnected graphs')
