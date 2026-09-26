import type { FeatureCollection, LineString, Point } from 'geojson'
import type { GeoJSONSource, Map } from 'maplibre-gl'
import type { DrainageConduit, DrainageManhole, DrainageResponse } from './floodApi'

type NodeStatus = 'normal' | 'strained' | 'surcharging'
type DisplayNode = DrainageManhole & { status: NodeStatus }
type DisplayEdge = DrainageConduit & { capacityUtilization: number; bearing: number }
type ContextLayers = {
  nodes: FeatureCollection<Point, DisplayNode>
  edges: FeatureCollection<LineString, DisplayEdge>
  visible: boolean
}
const contextByMap = new WeakMap<Map, ContextLayers>()

const empty = () => ({ type: 'FeatureCollection' as const, features: [] })
const color = (token: string) => getComputedStyle(document.documentElement).getPropertyValue(token).trim()

function status(surcharged: boolean, ratio: number | null): NodeStatus {
  if (surcharged) return 'surcharging'
  if (ratio !== null && ratio > 0.5) return 'strained'
  return 'normal'
}

function updateNormalContext(map: Map) {
  const context = contextByMap.get(map)
  if (!context) return
  const visible = true
  if (context.visible === visible) return
  context.visible = visible
  map.getSource<GeoJSONSource>('drainage-nodes-normal')?.setData(visible ? context.nodes : empty())
  map.getSource<GeoJSONSource>('drainage-edges-normal')?.setData(visible ? context.edges : empty())
}

function bearing(start: [number, number], end: [number, number]) {
  const rad = Math.PI / 180
  const deltaLng = (end[0] - start[0]) * rad
  const y = Math.sin(deltaLng) * Math.cos(end[1] * rad)
  const x = Math.cos(start[1] * rad) * Math.sin(end[1] * rad)
    - Math.sin(start[1] * rad) * Math.cos(end[1] * rad) * Math.cos(deltaLng)
  return (Math.atan2(y, x) / rad + 360) % 360
}

export function addDrainageLayers(map: Map) {
  map.addSource('drainage-edges-normal', { type: 'geojson', promoteId: 'id', data: empty() })
  map.addLayer({
    id: 'drainage-edges-normal', type: 'line', source: 'drainage-edges-normal',
    minzoom: 15,
    paint: { 'line-color': color('--status-normal'), 'line-width': 1, 'line-opacity': 0.2 },
  })
  map.addSource('drainage-edges', { type: 'geojson', promoteId: 'id', data: empty() })
  map.addLayer({
    id: 'drainage-edges', type: 'line', source: 'drainage-edges', minzoom: 15,
    paint: {
      'line-color': ['interpolate', ['linear'], ['get', 'capacityUtilization'], 0, color('--status-normal'), 0.7, color('--capacity-amber'), 1, color('--capacity-red')],
      'line-width': 1.25,
      'line-opacity': 0.55,
      'line-dasharray': ['case', ['>', ['get', 'capacityUtilization'], 0.85], ['literal', [2, 1.5]], ['literal', [1, 0]]],
    },
  })
  if (!map.hasImage('drainage-flow-arrow')) {
    const canvas = document.createElement('canvas')
    canvas.width = 24; canvas.height = 24
    const context = canvas.getContext('2d')!
    context.beginPath()
    context.moveTo(12, 2); context.lineTo(21, 21); context.lineTo(12, 16); context.lineTo(3, 21); context.closePath()
    context.fillStyle = color('--text-primary'); context.fill()
    context.strokeStyle = color('--bg-primary'); context.lineWidth = 2; context.stroke()
    map.addImage('drainage-flow-arrow', context.getImageData(0, 0, 24, 24))
  }
  map.addSource('drainage-arrows', { type: 'geojson', promoteId: 'id', data: empty() })
  map.addLayer({
    id: 'drainage-arrows', type: 'symbol', source: 'drainage-arrows',
    layout: { visibility: 'none', 'icon-image': 'drainage-flow-arrow', 'icon-size': 0.75, 'icon-rotate': ['get', 'bearing'], 'icon-rotation-alignment': 'map', 'icon-allow-overlap': true },
  })
  map.addSource('drainage-nodes-normal', { type: 'geojson', promoteId: 'id', data: empty() })
  map.addLayer({ id: 'drainage-nodes-normal', type: 'circle', source: 'drainage-nodes-normal', paint: {
    'circle-color': color('--status-normal'), 'circle-radius': 4, 'circle-opacity': 0.35,
    'circle-stroke-width': 0.5, 'circle-stroke-color': color('--bg-primary'), 'circle-stroke-opacity': 0.35,
  } })
  map.addSource('drainage-nodes', { type: 'geojson', promoteId: 'id', data: empty() })
  map.addLayer({ id: 'drainage-nodes', type: 'circle', source: 'drainage-nodes', paint: {
    'circle-color': ['match', ['get', 'status'], 'normal', color('--status-normal'), 'strained', color('--capacity-amber'), color('--capacity-red')],
    'circle-radius': 4, 'circle-opacity': 1, 'circle-stroke-width': 1, 'circle-stroke-opacity': 0.85, 'circle-stroke-color': color('--bg-primary'),
  } })
  map.on('zoom', () => updateNormalContext(map))
}

export function clearDrainageLayers(map: Map) {
  contextByMap.delete(map)
  for (const id of ['drainage-nodes', 'drainage-edges', 'drainage-arrows',
    'drainage-nodes-normal', 'drainage-edges-normal']) {
    map.getSource<GeoJSONSource>(id)?.setData(empty())
  }
}

export function updateDrainageLayers(map: Map, data: DrainageResponse, fullNetwork = false) {
  const nodes: FeatureCollection<Point, DisplayNode> = { type: 'FeatureCollection', features: [] }
  const normalNodes: FeatureCollection<Point, DisplayNode> = { type: 'FeatureCollection', features: [] }
  const edges: FeatureCollection<LineString, DisplayEdge> = { type: 'FeatureCollection', features: [] }
  const normalEdges: FeatureCollection<LineString, DisplayEdge> = { type: 'FeatureCollection', features: [] }
  const arrows: FeatureCollection<Point, DisplayEdge> = { type: 'FeatureCollection', features: [] }
  for (const feature of data.manholes.features) {
    const display = { ...feature, properties: {
      ...feature.properties,
      status: status(feature.properties.surcharged, feature.properties.surcharge_ratio),
    } }
    if (fullNetwork && display.properties.status === 'normal') normalNodes.features.push(display)
    else nodes.features.push(display)
  }
  for (const feature of data.conduits.features) {
    const coordinates = feature.geometry.coordinates
    if (coordinates.length < 2) continue
    const start = coordinates[0] as [number, number]
    const end = coordinates[coordinates.length - 1] as [number, number]
    const properties = {
      ...feature.properties,
      capacityUtilization: feature.properties.surcharge_ratio ?? 0,
      bearing: bearing(start, end),
    }
    const display = { ...feature, properties }
    if (fullNetwork && !properties.surcharged &&
        (properties.surcharge_ratio === null || properties.surcharge_ratio <= 0.5)) {
      normalEdges.features.push(display)
    } else {
      edges.features.push(display)
      arrows.features.push({
        type: 'Feature', id: feature.id, properties,
        geometry: { type: 'Point', coordinates: [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2] },
      })
    }
  }
  map.getSource<GeoJSONSource>('drainage-edges')?.setData(edges)
  map.getSource<GeoJSONSource>('drainage-arrows')?.setData(arrows)
  map.getSource<GeoJSONSource>('drainage-nodes')?.setData(nodes)
  contextByMap.set(map, { nodes: normalNodes, edges: normalEdges, visible: false })
  updateNormalContext(map)
}
