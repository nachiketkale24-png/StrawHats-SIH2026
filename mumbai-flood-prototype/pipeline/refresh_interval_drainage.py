"""Refresh saved interval runoff for the corrected duration and integrated risk.

The previous model stored mean local and propagated flow over three hours.
Multiplying both by old_seconds / window_seconds is exactly equivalent to
recoupling the same runoff volumes with the corrected duration: propagation is
linear. This avoids re-interpolating unchanged rainfall and rerunning a nowcast.
Requires prior drainage graph and base FSI artifacts for every window, plus a
road graph with the study area's existing topology.
"""
import argparse
import json
import pickle

import numpy as np

from . import config
from .dem_processing import load_and_clean_dem, get_dem_grid_coords
from .drainage_network import (build_drainage_graph, compute_hydraulic_capacity,
                               compute_surcharge, compute_surface_flood_indicator,
                               export_drainage_status)
from .fsi_model import load_raster_band, integrate_flood_risk, save_raster
from .road_risk_attribution import load_graph, attach_flood_risk, save_graph


def update_nowcast_validation(event_date, report):
    path = config.DATA_PROCESSED_DIR / f'nowcast_validation_{event_date}.json'
    if not path.exists():
        return
    validation = json.loads(path.read_text())
    event = validation.get(event_date, validation)
    if 'base_fsi' not in event:
        event['base_fsi'] = event['fsi'].copy()
    for row in report:
        event['fsi'][str(row['minutes'])] = dict(min=row['minimum'], mean=row['mean'], max=row['maximum'])
    path.write_text(json.dumps(validation, indent=2), encoding='utf-8')


def run(event_date, source='observed', sampling_cache=None):
    prefix = 'nowcast_' if source == 'nowcast' else ''
    manifest_path = config.DATA_PROCESSED_DIR / f'{prefix}event_windows_{event_date}.json'
    manifest = json.loads(manifest_path.read_text())
    keys = [f'{prefix}{event_date}_{minutes}min' for minutes in config.AVAILABLE_WINDOWS_MIN]
    for key in keys:
        for path in (config.drainage_graph_pickle(key), config.flood_risk_tif(key)):
            if not path.exists():
                raise FileNotFoundError(f'Missing {path}; use the full interval runner instead')
    dem, transform, crs, _ = load_and_clean_dem()
    lon, lat = get_dem_grid_coords(dem.shape, transform)
    capacity_graph, manholes, drains = build_drainage_graph()
    compute_hydraulic_capacity(capacity_graph, drains)
    base_road_path = config.road_graph_pickle(keys[-1])
    if not base_road_path.exists() and source == 'nowcast':
        base_road_path = config.road_graph_pickle(f'{event_date}_180min')
    roads = load_graph(base_road_path)
    if sampling_cache is None:
        sampling_cache = {}
    report = []
    for minutes, key in zip(config.AVAILABLE_WINDOWS_MIN, keys):
        with config.drainage_graph_pickle(key).open('rb') as file:
            drainage = pickle.load(file)
        old_seconds = drainage.graph.get('runoff_duration_seconds', config.STORM_DURATION_HOURS * 3600)
        factor = old_seconds / (minutes * 60)
        for _, node in drainage.nodes(data=True):
            node['local_inflow_m3s'] *= factor
        for _, _, edge in drainage.edges(data=True):
            edge['q_in_m3s'] *= factor
        drainage.graph['runoff_duration_seconds'] = minutes * 60
        compute_surcharge(drainage)
        export_drainage_status(drainage, manholes, drains, key)
        fsi, nodata = load_raster_band(config.flood_risk_tif(key))
        valid = fsi != nodata
        surface = compute_surface_flood_indicator(drainage, dem.shape, lon, lat, valid, 111320.)
        integrated = integrate_flood_risk(fsi, surface)
        path = config.integrated_flood_risk_tif(key)
        save_raster(integrated, valid, transform, crs, path, 'integrated_flood_risk_fsi_plus_drainage')
        values = integrated[valid]
        edges = [(u, v) for u, v, edge in drainage.edges(data=True) if edge['surcharged']]
        row = dict(minutes=minutes, manholes=len({v for _, v in edges}), conduits=len(edges),
                   minimum=float(values.min()), mean=float(values.mean()), maximum=float(values.max()),
                   drainage_cells=int(np.count_nonzero(surface[valid])),
                   maximum_drainage_contribution=float((integrated[valid] - fsi[valid]).max()))
        print(f'{key}: {json.dumps(row)}', flush=True)
        weighted, _ = attach_flood_risk(roads.copy(), config.UTM_43N, path,
                                       raster_in_memory=True, sampling_cache=sampling_cache)
        graph_path = config.road_graph_pickle(key)
        temporary = graph_path.with_suffix('.gpickle.tmp')
        save_graph(weighted, temporary)
        temporary.replace(graph_path)
        report.append(row)
        for window in manifest['windows']:
            if window['minutes'] == minutes:
                window['drainage_model_version'] = 2
        manifest['drainage_model_version'] = 2
        manifest['drainage_flow_basis'] = 'mean runoff flow over selected window duration'
        temporary = manifest_path.with_suffix('.json.tmp')
        temporary.write_text(json.dumps(manifest, indent=2), encoding='utf-8')
        temporary.replace(manifest_path)
        print(f'Ready: {key}', flush=True)
    report_path = config.DATA_PROCESSED_DIR / f'drainage_duration_validation_{prefix}{event_date}.json'
    report_path.write_text(json.dumps(report, indent=2), encoding='utf-8')
    if source == 'nowcast':
        update_nowcast_validation(event_date, report)
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--event-date', required=True)
    parser.add_argument('--source', choices=['observed', 'nowcast', 'both'], default='observed')
    args = parser.parse_args()
    cache = {}
    for source in (('observed', 'nowcast') if args.source == 'both' else (args.source,)):
        run(args.event_date, source, cache)
