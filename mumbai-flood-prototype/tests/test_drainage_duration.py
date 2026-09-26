import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import networkx as nx
import numpy as np
from rasterio.transform import from_origin

from pipeline import config
from pipeline.drainage_network import couple_rainfall_to_drainage, compute_surcharge
from pipeline.fsi_model import integrate_flood_risk, save_raster
from backend.services.flood_service import FloodService
from pipeline.road_risk_attribution import attach_flood_risk
from shapely.geometry import LineString


class DrainageDurationTests(unittest.TestCase):
    def graph(self):
        graph = nx.DiGraph()
        graph.add_node('up', x=0., y=0.)
        graph.add_node('down', x=1., y=0.)
        graph.add_edge('up', 'down', capacity_m3s=0.5)
        return graph

    def couple(self, minutes):
        graph = self.graph()
        couple_rainfall_to_drainage(
            graph, np.array([[10.]]), np.array([[900.]]),
            np.array([[0.]]), np.array([[0.]]), np.array([[True]]),
            duration_minutes=minutes,
        )
        compute_surcharge(graph)
        return graph['up']['down']

    def test_duration_changes_flow_and_capacity_crossing(self):
        short, long = self.couple(15), self.couple(180)
        self.assertAlmostEqual(short['q_in_m3s'], 1.)
        self.assertAlmostEqual(long['q_in_m3s'], 1. / 12.)
        self.assertTrue(short['surcharged'])
        self.assertFalse(long['surcharged'])
        self.assertAlmostEqual(short['overflow_m3s'], 0.5)

    def test_invalid_durations_rejected(self):
        for minutes in (0, -15, float('nan'), float('inf')):
            with self.assertRaises(ValueError):
                self.couple(minutes)

    def test_api_uses_integrated_score_and_refreshes_cache(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(config, 'DATA_PROCESSED_DIR', Path(directory)):
                key = '2017-08-29_15min'
                valid = np.ones((1, 2), dtype=bool)
                base = np.array([[0.2, 0.9]])
                combined = integrate_flood_risk(base, np.array([[0.5, 1.]]))
                np.testing.assert_allclose(combined, [[0.4, 1.]])
                def save(array, path):
                    save_raster(array, valid, from_origin(0, 1, 1, 1),
                                'EPSG:4326', path, 'test')
                save(base, config.flood_risk_tif(key))
                service = FloodService()
                self.assertAlmostEqual(service.get_summary(key)['fsi_mean'], .55)
                save(combined, config.integrated_flood_risk_tif(key))
                self.assertEqual(service.get_raster_path(key), str(config.integrated_flood_risk_tif(key)))
                self.assertAlmostEqual(service.get_summary(key)['fsi_mean'], .7)
                self.assertAlmostEqual(service.sample_at_point(key, .5, .5), .4)

    def test_cached_road_masks_match_zonal_maxima_across_windows(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'risk.tif'
            graph = nx.Graph()
            for index, points in enumerate(([(0, 100), (100, 0)],
                                            [(20, 50), (80, 50)],
                                            [(-100, -100), (-50, -50)])):
                graph.add_edge(index * 2, index * 2 + 1,
                               geometry=LineString([(x / 1000, y / 1000) for x, y in points]), length_m=100.)
            cache = {}
            valid = np.ones((10, 10), dtype=bool)
            valid[:2, :2] = False
            for shift in (0, 0.3):
                raster = np.clip(np.arange(100).reshape(10, 10) / 100 + shift, 0, 1)
                save_raster(raster, valid, from_origin(0, .1, .01, .01),
                            'EPSG:4326', path, 'risk')
                plain, _ = attach_flood_risk(graph.copy(), 'EPSG:4326', path, buffer_m=.001,
                                            raster_in_memory=True)
                cached, _ = attach_flood_risk(graph.copy(), 'EPSG:4326', path, buffer_m=.001,
                                             raster_in_memory=True, sampling_cache=cache)
                for u, v in graph.edges:
                    self.assertEqual(plain[u][v]['flood_risk'], cached[u][v]['flood_risk'])
                    self.assertEqual(plain[u][v]['weight_flood_aware'], cached[u][v]['weight_flood_aware'])


if __name__ == '__main__':
    unittest.main()
