"""Verify display output against real precomputed routing edges."""
import unittest
import json
from pyproj import Transformer
from shapely.geometry import shape, box
from fastapi import HTTPException

from backend.routers.flood import get_roads
from backend.services.event_windows import RainfallSource
from backend.services.routing_service import routing_service
from pipeline import config


class RoadRiskTests(unittest.TestCase):
    def test_viewport_preserves_graph_values_and_geometry(self):
        graph = routing_service._get_graph('2020-09-23_15min')
        viewport = box(72.87, 19.14, 72.89, 19.16)
        transform = Transformer.from_crs(config.UTM_43N, config.WGS84, always_xy=True)
        expected = {}
        for index, (_, _, edge) in enumerate(graph.edges(data=True)):
            geometry = edge.get('geometry')
            risk = edge.get('flood_risk')
            if geometry is None or risk is None:
                continue
            coordinates = [list(transform.transform(x, y)) for x, y in geometry.coords]
            if shape({'type': 'LineString', 'coordinates': coordinates}).intersects(viewport):
                expected[f'road:{index}'] = (risk, edge['length_m'], coordinates)
        data = json.loads(json.dumps(get_roads('2020-09-23', west=72.87, south=19.14,
            east=72.89, north=19.16, window_minutes=15, rainfall_source=RainfallSource.OBSERVED)))
        self.assertEqual(data['event_key'], '2020-09-23_15min')
        self.assertFalse(data['truncated'])
        self.assertGreater(len(expected), 0)
        self.assertEqual({f['id'] for f in data['features']}, set(expected))
        for feature in data['features']:
            risk, length, coordinates = expected[feature['id']]
            self.assertEqual(feature['properties'], {'flood_risk': risk, 'length_m': length})
            self.assertEqual(feature['geometry']['coordinates'], coordinates)

    def test_invalid_bounds_and_missing_outputs(self):
        with self.assertRaises(HTTPException) as invalid:
            get_roads('2020-09-23', west=73, east=72, south=19, north=20)
        self.assertEqual(invalid.exception.status_code, 422)
        with self.assertRaises(HTTPException) as missing:
            get_roads('1900-01-01', west=72, east=73, south=19, north=20,
                      rainfall_source=RainfallSource.NOWCAST, window_minutes=15)
        self.assertEqual(missing.exception.status_code, 404)


if __name__ == '__main__':
    unittest.main()
