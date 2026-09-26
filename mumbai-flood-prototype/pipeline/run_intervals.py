"""Precompute historical 15–180 minute FSI, drainage risk, and routing.

Run from the project root: python -m pipeline.run_intervals
The start is the strongest complete three-hour rainfall window on each selected day.
All durations accumulate observed 15-minute records from that same start.
"""
import json
import argparse
import pandas as pd

from . import config
from .dem_processing import load_and_clean_dem, compute_slope_degrees, get_dem_grid_coords
from .landcover_processing import load_landcover_features
from .rainfall_processing import (
    load_rainfall_and_stations,
    select_heavy_rainfall_events,
    interpolate_rainfall_to_grid,
    compute_station_coverage_mask,
)
from .fsi_model import (compute_vulnerability, compute_fsi, normalize,
                        integrate_flood_risk, save_fsi_raster, save_raster)
from .drainage_network import (
    build_drainage_graph, compute_hydraulic_capacity, compute_runoff_volume,
    couple_rainfall_to_drainage, compute_surcharge, compute_surface_flood_indicator,
    export_drainage_status,
)
from .road_graph_builder import build_road_graph
from .road_risk_attribution import attach_flood_risk, load_graph, save_graph

DURATIONS = tuple(config.AVAILABLE_WINDOWS_MIN)


def select_window(day, station_cols):
    """Select a complete, observed 3-hour block; never fill missing rainfall with zero."""
    candidates = []
    for start in day.index:
        expected = pd.date_range(start, periods=12, freq="15min")
        if expected[-1].date() != start.date():
            continue
        block = day.reindex(expected)[station_cols]
        if block.isna().any().any():
            continue
        candidates.append((float(block.sum().mean()), start))
    if not candidates:
        raise ValueError("No complete three-hour window across all matched stations")
    return max(candidates, key=lambda item: item[0])[1]


def run(event_date=None, force=False):
    config.DATA_PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    print('Loading historical rainfall and raster inputs...', flush=True)
    rainfall, stations, station_cols = load_rainfall_and_stations()
    dates = select_heavy_rainfall_events(rainfall, station_cols)
    if event_date is not None:
        dates = [date for date in dates if date.strftime('%Y-%m-%d') == event_date]
        if not dates:
            raise ValueError(f'{event_date} is not one of the selected historical events')
    dem, transform, crs, valid = load_and_clean_dem()
    slope = compute_slope_degrees(dem, valid, transform)
    lon, lat = get_dem_grid_coords(dem.shape, transform)
    built, water, lc_nodata = load_landcover_features()
    valid = valid & (built != lc_nodata)

    vulnerability = compute_vulnerability(built, slope, water, valid)
    save_raster(vulnerability, valid, transform, crs, config.VULNERABILITY_TIF, 'vulnerability')
    print(f'Saved static vulnerability: {config.VULNERABILITY_TIF}', flush=True)

    coverage = compute_station_coverage_mask(stations, station_cols, lon, lat)
    inside_pct = 100.0 * coverage[valid].mean() if valid.any() else 0.0
    print(f'Station network coverage (interpolated): {inside_pct:.1f}% of valid cells', flush=True)
    save_raster(coverage.astype('float32'), valid, transform, crs, config.COVERAGE_MASK_TIF, 'station_coverage')
    print(f'Saved coverage mask: {config.COVERAGE_MASK_TIF}', flush=True)

    graph, roads = None, None
    road_graph_attempted = False
    sampling_cache = {}
    for date in dates:
        event = date.strftime("%Y-%m-%d")
        day = rainfall.loc[rainfall.index.date == date.date()]
        start = select_window(day, station_cols)
        manifest_path = config.DATA_PROCESSED_DIR / f"event_windows_{event}.json"
        previous = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
        completed_versions = {w['minutes']: w.get('drainage_model_version')
                              for w in previous.get('windows', [])}
        manifest = {"event_date": event, "kind": "historical_observed", "start_time": start.isoformat(),
                    "drainage_model_version": 2,
                    "drainage_flow_basis": "mean runoff flow over selected window duration",
                    "time_basis": "Workbook timestamps (timezone unspecified)",
                    "selection": "Strongest complete three-hour window by mean station rainfall", "windows": []}
        rainfall_grids = {}
        for minutes in DURATIONS:
            end = start + pd.Timedelta(minutes=minutes)
            totals = day.loc[(day.index >= start) & (day.index < end), station_cols].sum()
            rainfall_grids[minutes] = interpolate_rainfall_to_grid(
                totals, stations, station_cols, lon, lat
            )
        rainfall_range = (
            min(float(grid[valid].min()) for grid in rainfall_grids.values()),
            max(float(grid[valid].max()) for grid in rainfall_grids.values()),
        )
        print(f'{event} shared rainfall range (mm): min {rainfall_range[0]:.3f}, '
              f'max {rainfall_range[1]:.3f}', flush=True)

        print(f'Building drainage graph for {event}...', flush=True)
        drainage_graph, manholes, drains = build_drainage_graph()
        compute_hydraulic_capacity(drainage_graph, drains)
        for minutes in DURATIONS:
            key = f"{event}_{minutes}min"
            refresh_model = completed_versions.get(minutes) != 2
            raster_path = config.flood_risk_tif(key)
            integrated_path = config.integrated_flood_risk_tif(key)
            graph_path = config.road_graph_pickle(key)
            manholes_path = config.drainage_manholes_gpkg(key)
            drains_path = config.drainage_status_gpkg(key)
            end = start + pd.Timedelta(minutes=minutes)
            grid = rainfall_grids[minutes]
            rainfall_factor = normalize(grid, valid, rainfall_range)
            rain_values = rainfall_factor[valid]
            print(f'{event} {minutes} min rainfall_factor -> min {rain_values.min():.3f}, '
                  f'mean {rain_values.mean():.3f}, max {rain_values.max():.3f}', flush=True)
            needs_risk = force or refresh_model or not raster_path.exists() or not integrated_path.exists()
            needs_drainage = force or refresh_model or not manholes_path.exists() or not drains_path.exists()
            needs_graph = (force or needs_risk or not graph_path.exists() or
                           graph_path.stat().st_mtime < integrated_path.stat().st_mtime)
            if needs_risk or needs_drainage:
                print(f'Computing {event}: {minutes} minutes...', flush=True)
                if needs_risk:
                    fsi, _ = compute_fsi(grid, vulnerability, valid, rainfall_range=rainfall_range)
                    save_fsi_raster(fsi, valid, transform, crs, raster_path)
                window_drainage = drainage_graph.copy()
                runoff_volume, m_per_deg_lat = compute_runoff_volume(
                    grid, built, valid, transform
                )
                couple_rainfall_to_drainage(
                    window_drainage, grid, runoff_volume, lon, lat, valid,
                    duration_minutes=minutes,
                )
                compute_surcharge(window_drainage)
                surcharged_edges = [(u, v) for u, v, edge in window_drainage.edges(data=True)
                                    if edge['surcharged']]
                surcharged_manholes = len({v for _, v in surcharged_edges})
                print(f'{event} {minutes} min surcharge -> '
                      f'{surcharged_manholes} manholes, {len(surcharged_edges)} conduits',
                      flush=True)
                if needs_drainage:
                    export_drainage_status(window_drainage, manholes, drains, key)
                if needs_risk:
                    surface_indicator = compute_surface_flood_indicator(
                        window_drainage, dem.shape, lon, lat, valid, m_per_deg_lat
                    )
                    integrated_risk = integrate_flood_risk(fsi, surface_indicator)
                    risk_values = integrated_risk[valid]
                    print(f'{event} {minutes} min integrated_flood_risk -> '
                          f'min {risk_values.min():.3f}, mean {risk_values.mean():.3f}, '
                          f'max {risk_values.max():.3f}', flush=True)
                    save_raster(integrated_risk, valid, transform, crs, integrated_path,
                                'integrated_flood_risk_fsi_plus_drainage')
            if needs_graph:
                if not road_graph_attempted:
                    print('Building road graph...', flush=True)
                    road_graph_attempted = True
                    try:
                        existing = config.road_graph_pickle(f'{event}_180min')
                        if existing.exists():
                            graph = load_graph(existing)
                            roads_crs = config.UTM_43N
                        else:
                            graph, roads = build_road_graph()
                            roads_crs = roads.crs
                    except Exception as exc:
                        print(f'Road graph unavailable; generating flood events without routing: {exc}', flush=True)
                if graph is not None:
                    weighted, _ = attach_flood_risk(
                        graph.copy(), roads_crs, integrated_path, raster_in_memory=True,
                        sampling_cache=sampling_cache,
                    )
                    temporary = graph_path.with_suffix('.gpickle.tmp')
                    save_graph(weighted, temporary)
                    temporary.replace(graph_path)
            manifest["windows"].append({"minutes": minutes, "start_time": start.isoformat(),
                                        "end_time": end.isoformat(), "drainage_model_version": 2})
            # Publish only intervals with both a finished raster and graph.
            manifest_path = config.DATA_PROCESSED_DIR / f"event_windows_{event}.json"
            temporary = manifest_path.with_suffix('.json.tmp')
            temporary.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
            temporary.replace(manifest_path)
            print(f"Ready: {event}, {minutes} min, {start.time()}–{end.time()}", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--event-date', help='Generate only this selected event (YYYY-MM-DD)')
    parser.add_argument('--force', action='store_true', help='Recompute rasters, drainage status, and graphs')
    args = parser.parse_args()
    run(args.event_date, force=args.force)
