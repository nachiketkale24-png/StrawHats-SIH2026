"""
Runs the full offline pipeline for one selected historical rainfall event:

  DEM (already clipped) -> slope
  + land cover (already processed)
  + rainfall (select event, interpolate)
  -> FSI and drainage-coupled integrated flood-risk rasters
  -> road graph (build once, or reuse if already built)
  -> attach flood risk -> save final routable graph pickle

This is meant to be run manually / on a schedule whenever you add a new
event or change the FSI weights — NOT invoked by the backend per request.

Usage:
    python -m pipeline.run_pipeline
"""

from . import config
from .dem_processing import load_and_clean_dem, compute_slope_degrees, get_dem_grid_coords
from .landcover_processing import load_landcover_features
from .rainfall_processing import (
    load_rainfall_and_stations,
    select_heavy_rainfall_events,
    get_event_totals,
    interpolate_rainfall_to_grid,
    compute_station_coverage_mask,
)
from .fsi_model import compute_vulnerability, compute_fsi, save_fsi_raster, save_raster, summarize_fsi
from .road_graph_builder import build_road_graph
from .road_risk_attribution import attach_flood_risk, save_graph
from .drainage_network import (
    build_drainage_graph, compute_hydraulic_capacity, compute_runoff_volume,
    couple_rainfall_to_drainage, compute_surcharge,
    compute_surface_flood_indicator, export_drainage_status,
)
import numpy as np
import pandas as pd


def run(event_index: int = 0, rebuild_road_graph: bool = True, event_date: str = None):
    print("=== 1. Loading + cleaning DEM ===")
    dem_clean, transform, crs, valid_mask = load_and_clean_dem()
    slope_deg = compute_slope_degrees(dem_clean, valid_mask, transform)
    grid_lon, grid_lat = get_dem_grid_coords(dem_clean.shape, transform)
    print(f"DEM grid shape: {dem_clean.shape}, valid cells: {int(valid_mask.sum())}")

    print("\n=== 2. Loading land-cover features ===")
    built_up, water_wetland_mangrove, lc_nodata = load_landcover_features()
    combined_valid = valid_mask & (built_up != lc_nodata)
    print(f"Valid cells for FSI: {int(combined_valid.sum())} / {combined_valid.size}")

    print("\n=== 3. Selecting rainfall event + interpolating ===")
    rainfall_df, station_map, station_cols = load_rainfall_and_stations()
    selected_dates = select_heavy_rainfall_events(rainfall_df, station_cols)
    print("Candidate heavy-rainfall dates:", [d.date() for d in selected_dates])

    selected_event = pd.Timestamp(event_date) if event_date else selected_dates[event_index]
    event_date_str = selected_event.strftime("%Y-%m-%d")
    print(f"Using event: {event_date_str}")

    event_totals = get_event_totals(rainfall_df, selected_event, station_cols)
    if event_totals.sum() <= 0:
        raise ValueError(f"No positive rainfall data for {event_date_str}")
    rainfall_grid = interpolate_rainfall_to_grid(
        event_totals, station_map, station_cols, grid_lon, grid_lat
    )

    coverage = compute_station_coverage_mask(station_map, station_cols, grid_lon, grid_lat)
    inside_pct = 100.0 * coverage[combined_valid].mean() if combined_valid.any() else 0.0
    print(f"Station network coverage (interpolated): {inside_pct:.1f}% of valid cells")
    save_raster(
        coverage.astype("float32"), combined_valid, transform, crs,
        config.COVERAGE_MASK_TIF, "station_coverage",
    )
    print(f"Saved: {config.COVERAGE_MASK_TIF}")

    print("\n=== 4. Computing vulnerability + FSI ===")
    vulnerability = compute_vulnerability(
        built_up, slope_deg, water_wetland_mangrove, combined_valid
    )
    save_raster(
        vulnerability, combined_valid, transform, crs,
        config.VULNERABILITY_TIF, "vulnerability",
    )
    print(f"Saved: {config.VULNERABILITY_TIF}")

    fsi, fsi_cat = compute_fsi(rainfall_grid, vulnerability, combined_valid)
    summary = summarize_fsi(fsi, fsi_cat, combined_valid)
    print(summary)

    fsi_path = save_fsi_raster(fsi, combined_valid, transform, crs, config.flood_risk_tif(event_date_str))
    print(f"Saved: {fsi_path}")

    print("\n=== 5. Building drainage graph and hydraulic capacity ===")
    G_drain, manholes, drains = build_drainage_graph()
    compute_hydraulic_capacity(G_drain, drains)

    print("\n=== 6. Coupling event runoff and computing surcharge ===")
    runoff_volume, m_per_deg_lat = compute_runoff_volume(
        rainfall_grid, built_up, combined_valid, transform
    )
    couple_rainfall_to_drainage(
        G_drain, rainfall_grid, runoff_volume, grid_lon, grid_lat, combined_valid
    )
    compute_surcharge(G_drain)
    surface_indicator = compute_surface_flood_indicator(
        G_drain, dem_clean.shape, grid_lon, grid_lat, combined_valid, m_per_deg_lat
    )
    # Notebook Section 16: additive surcharge contribution, clipped to [0, 1].
    integrated_risk = np.clip(fsi + config.W_DRAINAGE_IN_RISK * surface_indicator, 0, 1)
    integrated_path = config.integrated_flood_risk_tif(event_date_str)
    save_raster(integrated_risk, combined_valid, transform, crs, integrated_path,
                "integrated_flood_risk_fsi_plus_drainage")
    values = integrated_risk[combined_valid]
    print(f"Integrated flood risk -> min {values.min():.3f}, max {values.max():.3f}, "
          f"mean {values.mean():.3f}")
    print(f"Saved: {integrated_path}")
    manholes_path, drains_path, drainage_graph_path = export_drainage_status(
        G_drain, manholes, drains, event_date_str
    )

    print("\n=== 7. Building / loading road graph ===")
    G, roads_m = build_road_graph()
    print(f"Graph: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")

    print("\n=== 8. Attaching integrated flood risk to roads ===")
    G, edges_gdf = attach_flood_risk(G, roads_m.crs, integrated_path)

    graph_path = config.road_graph_pickle(event_date_str)
    save_graph(G, graph_path)
    print(f"Saved routable graph: {graph_path}")

    edges_gdf.to_crs(config.WGS84).to_file(config.road_risk_gpkg(event_date_str), driver="GPKG")
    print(f"Saved: {config.road_risk_gpkg(event_date_str)}")

    print("\n=== Pipeline complete for event", event_date_str, "===")
    return {
        "event_date": event_date_str,
        "fsi_raster": str(fsi_path),
        "integrated_flood_risk_raster": str(integrated_path),
        "drainage_graph": str(drainage_graph_path),
        "drainage_manholes_gpkg": str(manholes_path),
        "drainage_status_gpkg": str(drains_path),
        "road_graph": str(graph_path),
        "road_risk_gpkg": str(config.road_risk_gpkg(event_date_str)),
        "fsi_summary": summary,
    }


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--event-date", default="2017-08-29")
    args = parser.parse_args()
    run(event_date=args.event_date)
