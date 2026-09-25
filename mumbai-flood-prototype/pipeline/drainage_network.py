"""BMC drainage graph and prototype event runoff/surcharge coupling.

Nearest-manhole cells are proxy catchments, and full-flow Manning capacity is
an estimate. Neither is a calibrated BMC hydraulic model.
"""

import pickle
import warnings

import geopandas as gpd
import networkx as nx
import numpy as np
import pandas as pd
from scipy.spatial import cKDTree

from . import config


def build_drainage_graph(manholes_path=config.MANHOLES_GEOJSON,
                         drains_path=config.DRAINS_GEOJSON):
    manholes = gpd.read_file(manholes_path)
    drains = gpd.read_file(drains_path)
    print("MANHOLES -> shape:", manholes.shape, "| CRS:", manholes.crs)
    print("DRAINS   -> shape:", drains.shape, "| CRS:", drains.crs)
    print("VALIDATION: manholes/drains CRS matches EPSG:4326?",
          manholes.crs is None or manholes.crs.to_epsg() == 4326,
          drains.crs is None or drains.crs.to_epsg() == 4326)
    if manholes.crs is None:
        warnings.warn("Manhole CRS is missing; assuming EPSG:4326", stacklevel=2)
        manholes = manholes.set_crs(config.WGS84)
    else:
        manholes = manholes.to_crs(config.WGS84)
    if drains.crs is None:
        warnings.warn("Drain CRS is missing; assuming EPSG:4326", stacklevel=2)
        drains = drains.set_crs(config.WGS84)
    else:
        drains = drains.to_crs(config.WGS84)

    drains["length_m"] = pd.to_numeric(drains["CONDUIT_LE"], errors="coerce")
    drains["width_m"] = pd.to_numeric(drains["CONDUIT_WI"], errors="coerce") / 1000.0
    drains["height_m"] = pd.to_numeric(drains["CONDUIT_HE"], errors="coerce") / 1000.0
    drains["us_invert_m"] = pd.to_numeric(drains["US_INVERT"], errors="coerce")
    drains["ds_invert_m"] = pd.to_numeric(drains["DS_INVERT"], errors="coerce")
    drains["shape_clean"] = drains["SHAPE_1"].astype(str).str.upper()
    drains["elevation_drop_m"] = drains["us_invert_m"] - drains["ds_invert_m"]
    raw_slope = drains["elevation_drop_m"] / drains["length_m"]
    print(f"Conduit slope validation: {int((raw_slope < 0).sum())} negative-slope conduits "
          f"(possible reversed US/DS or survey noise), {int((raw_slope == 0).sum())} "
          f"zero-slope, {int((~np.isfinite(raw_slope)).sum())} missing/undefined.")
    # PROTOTYPE ASSUMPTION: flat/reversed slopes get a positive hydraulic floor;
    # raw slopes and flags remain available for inspection.
    drains["slope_raw"] = raw_slope
    drains["slope"] = raw_slope.clip(lower=config.MIN_SLOPE)
    drains["slope_flagged"] = (raw_slope < config.MIN_SLOPE) | ~np.isfinite(raw_slope)
    print("Drain length/width/height/slope summary:")
    print(drains[["length_m", "width_m", "height_m", "slope"]].describe())
    print("Conduit shapes:", drains["shape_clean"].value_counts().to_dict())

    manhole_ids = set(manholes["NODE_ID"].astype(str))
    upstream_ids = set(drains["US_NODE_ID"].astype(str))
    downstream_ids = set(drains["DS_NODE_ID"].astype(str))
    missing_upstream = upstream_ids - manhole_ids
    missing_downstream = downstream_ids - manhole_ids
    print(f"Manholes: {len(manhole_ids)} | unique US node IDs: {len(upstream_ids)} "
          f"| unique DS node IDs: {len(downstream_ids)}")
    print(f"Upstream IDs NOT found in manholes: {len(missing_upstream)}")
    print(f"Downstream IDs NOT found in manholes: {len(missing_downstream)}")
    if missing_upstream or missing_downstream:
        warnings.warn("Unmatched drain endpoints; those edges will be skipped", stacklevel=2)
        print("Examples (upstream):", sorted(missing_upstream)[:10])
        print("Examples (downstream):", sorted(missing_downstream)[:10])

    graph = nx.DiGraph()
    for _, row in manholes.iterrows():
        graph.add_node(str(row["NODE_ID"]),
                       ground_elev=float(row["GROUND_LEV"]) if pd.notna(row["GROUND_LEV"]) else np.nan,
                       x=row.geometry.x, y=row.geometry.y)
    skipped = 0
    for index, row in drains.iterrows():
        us, ds = str(row["US_NODE_ID"]), str(row["DS_NODE_ID"])
        if us not in graph or ds not in graph:
            skipped += 1
            continue
        graph.add_edge(us, ds, drain_index=index,
                       length_m=row["length_m"], width_m=row["width_m"],
                       height_m=row["height_m"], us_invert_m=row["us_invert_m"],
                       ds_invert_m=row["ds_invert_m"], slope=row["slope"],
                       slope_flagged=bool(row["slope_flagged"]), shape=row["shape_clean"])
    print("Drainage graph created.")
    print(f"Nodes: {graph.number_of_nodes()}, Edges added: {len(drains) - skipped}, "
          f"edges skipped (unmatched node): {skipped}; unique graph edges: {graph.number_of_edges()}")
    duplicate_count = len(drains) - skipped - graph.number_of_edges()
    if duplicate_count:
        warnings.warn(f"{duplicate_count} parallel US/DS conduits collapsed by DiGraph", stacklevel=2)
    self_loops = nx.number_of_selfloops(graph)
    print(f"Self-loops: {self_loops}")
    if self_loops:
        warnings.warn(f"Drainage graph has {self_loops} self-loops", stacklevel=2)
    is_dag = nx.is_directed_acyclic_graph(graph)
    print(f"Drainage graph is a DAG (no cycles): {is_dag}")
    if not is_dag:
        warnings.warn("Drainage graph contains cycles", stacklevel=2)
    return graph, manholes, drains


def hydraulic_geometry(row):
    """Full-flow area and hydraulic radius; OREC/ARCH use a rectangular proxy."""
    w, h = row["width_m"], row["height_m"]
    if pd.isna(w) or pd.isna(h) or w <= 0 or h <= 0:
        return np.nan, np.nan
    if row["shape_clean"] == "CIRC":
        area = np.pi * w ** 2 / 4.0
        perimeter = np.pi * w
    else:
        # PROTOTYPE ASSUMPTION: RECT / OREC / ARCH use rectangular geometry.
        area = w * h
        perimeter = 2 * (w + h)
    return area, area / perimeter


def compute_hydraulic_capacity(graph, drains_df):
    geometry = drains_df.apply(hydraulic_geometry, axis=1, result_type="expand")
    drains_df["area_m2"], drains_df["hydraulic_radius_m"] = geometry[0], geometry[1]
    drains_df["capacity_m3s"] = ((1.0 / config.MANNING_N) * drains_df["area_m2"]
                                 * drains_df["hydraulic_radius_m"] ** (2.0 / 3.0)
                                 * drains_df["slope"] ** 0.5)
    print("Hydraulic capacity summary (m^3/s):")
    print(drains_df["capacity_m3s"].describe())
    print("VALIDATION: any non-finite/negative capacities?",
          int((~np.isfinite(drains_df["capacity_m3s"])).sum()), "non-finite,",
          int((drains_df["capacity_m3s"] < 0).sum()), "negative")
    for _, _, edge in graph.edges(data=True):
        row = drains_df.loc[edge["drain_index"]]
        edge["capacity_m3s"] = row["capacity_m3s"]
        edge["area_m2"] = row["area_m2"]
    print("Capacity attached to graph edges. Example edge:",
          next(iter(graph.edges(data=True)), None))
    return graph


def compute_runoff_volume(rainfall_grid, built_up, combined_valid, transform):
    """Event runoff from the same rainfall grid used to calculate FSI."""
    mean_lat = transform.f + rainfall_grid.shape[0] * transform.e / 2
    m_per_deg_lat = 111320.0
    m_per_deg_lon = 111320.0 * np.cos(np.radians(mean_lat))
    cell_area_m2 = abs(transform.a * m_per_deg_lon * transform.e * m_per_deg_lat)
    built_up_fraction = np.clip(np.where(combined_valid, built_up, 0.0), 0, 1)
    coefficient = config.RUNOFF_C_MIN + (config.RUNOFF_C_MAX - config.RUNOFF_C_MIN) * built_up_fraction
    runoff_volume = (np.where(combined_valid, rainfall_grid, 0.0) / 1000.0
                     * coefficient * cell_area_m2)
    print(f"Runoff coefficient -> min {coefficient[combined_valid].min():.3f}, "
          f"max {coefficient[combined_valid].max():.3f}, "
          f"mean {coefficient[combined_valid].mean():.3f}")
    print(f"Total event runoff volume across study area: "
          f"{runoff_volume[combined_valid].sum():,.0f} m^3 (cell size ~{cell_area_m2:.0f} m^2)")
    return runoff_volume, m_per_deg_lat


def couple_rainfall_to_drainage(graph, rainfall_grid, runoff_volume_m3,
                                grid_lon, grid_lat, combined_valid):
    if rainfall_grid.shape != runoff_volume_m3.shape or rainfall_grid.shape != combined_valid.shape:
        raise ValueError("Rainfall, runoff and valid mask must share the DEM grid")
    node_ids = list(graph.nodes)
    node_xy = np.array([[graph.nodes[n]["x"], graph.nodes[n]["y"]] for n in node_ids])
    nearest = cKDTree(node_xy).query(np.column_stack(
        [grid_lon[combined_valid], grid_lat[combined_valid]]))[1]
    runoff_by_index = np.bincount(nearest, weights=runoff_volume_m3[combined_valid],
                                 minlength=len(node_ids))
    assigned = int(np.count_nonzero(runoff_by_index))
    print(f"Runoff assigned to {assigned} / {len(node_ids)} manholes "
          f"({100 * assigned / len(node_ids):.1f}% of nodes receive direct catchment runoff).")
    nx.set_node_attributes(graph, dict(zip(node_ids, runoff_by_index /
                                           (config.STORM_DURATION_HOURS * 3600.0))),
                           "local_inflow_m3s")
    is_dag = nx.is_directed_acyclic_graph(graph)
    print(f"G_drain is a DAG (no cycles): {is_dag}")
    cumulative = {n: graph.nodes[n]["local_inflow_m3s"] for n in node_ids}
    if is_dag:
        order = nx.topological_sort(graph)
    else:
        # PROTOTYPE FALLBACK: single pass, not a hydraulic loop solver.
        order = node_ids
        warnings.warn("Cycles detected -- using approximate single-pass propagation "
                      "instead of exact topological accumulation", stacklevel=2)
    for node in order:
        for _, downstream, edge in graph.out_edges(node, data=True):
            edge["q_in_m3s"] = cumulative[node]
            cumulative[downstream] += cumulative[node]
    values = np.array([edge["q_in_m3s"] for _, _, edge in graph.edges(data=True)])
    print(f"Q_in (cumulative inflow) across all conduits -> min {values.min():.4f}, "
          f"max {values.max():.4f}, mean {values.mean():.4f} m^3/s")
    return graph


def compute_surcharge(graph):
    for _, _, edge in graph.edges(data=True):
        capacity = edge.get("capacity_m3s", np.nan)
        q_in = edge.get("q_in_m3s", 0.0)
        if not np.isfinite(capacity) or capacity <= 0:
            edge.update(surcharge_ratio=np.nan, surcharged=False, overflow_m3s=0.0)
            continue
        ratio = q_in / capacity
        edge.update(surcharge_ratio=ratio,
                    surcharged=bool(ratio > config.SURCHARGE_RATIO_THRESHOLD),
                    overflow_m3s=max(0.0, q_in - capacity))
    rated = sum(np.isfinite(edge["surcharge_ratio"]) for _, _, edge in graph.edges(data=True))
    surcharged = sum(edge["surcharged"] for _, _, edge in graph.edges(data=True))
    nodes = {v for _, v, edge in graph.edges(data=True) if edge["surcharged"]}
    print(f"Conduits with a valid capacity/ratio: {rated} / {graph.number_of_edges()}")
    print(f"Surcharged conduits (Q_in/Q_capacity > {config.SURCHARGE_RATIO_THRESHOLD}): "
          f"{surcharged} ({100 * surcharged / max(1, rated):.1f}% of rated conduits)")
    print(f"Distinct manholes downstream of a surcharged conduit: {len(nodes)}")
    return graph


def compute_surface_flood_indicator(graph, dem_shape, grid_lon, grid_lat,
                                    combined_valid, m_per_deg_lat):
    indicator = np.zeros(dem_shape, dtype=np.float32)
    overflow_by_node = {}
    for _, downstream, edge in graph.edges(data=True):
        if edge.get("surcharged"):
            overflow_by_node[downstream] = (overflow_by_node.get(downstream, 0.0)
                                            + edge["overflow_m3s"])
    if overflow_by_node:
        nodes = list(overflow_by_node)
        xy = np.array([[graph.nodes[n]["x"], graph.nodes[n]["y"]] for n in nodes])
        distance_deg, nearest = cKDTree(xy).query(np.column_stack(
            [grid_lon[combined_valid], grid_lat[combined_valid]]))
        proximity = np.clip(1.0 - distance_deg * m_per_deg_lat /
                            config.INFLUENCE_RADIUS_M, 0, 1)
        overflow = np.array([overflow_by_node[n] for n in nodes])
        indicator[combined_valid] = proximity * overflow[nearest] / overflow.max()
    else:
        print("No surcharged conduits found under current assumptions -- "
              "surface_flood_indicator is all zeros.")
    values = indicator[combined_valid]
    print("Surface flood indicator (relative, 0-1, NOT a calibrated depth) -> "
          f"min {values.min():.3f}, max {values.max():.3f}, mean {values.mean():.3f}")
    print("LIMITATION: this indicator represents relative flood severity/likelihood near "
          "overloaded drainage, not a physically calibrated depth in centimetres.")
    return indicator


def export_drainage_status(graph, manholes, drains, event_date):
    surcharged_nodes = {v for _, v, edge in graph.edges(data=True) if edge["surcharged"]}
    manholes_out = manholes.copy()
    manholes_out["surcharged"] = manholes_out["NODE_ID"].astype(str).isin(surcharged_nodes)
    manholes_path = config.drainage_manholes_gpkg(event_date)
    manholes_out.to_file(manholes_path, layer="manholes", driver="GPKG")

    drains_out = drains.copy()
    edge_status = {(u, v): edge for u, v, edge in graph.edges(data=True)}
    status = [edge_status.get((str(row.US_NODE_ID), str(row.DS_NODE_ID)), {})
              for row in drains_out.itertuples()]
    drains_out["q_in_m3s"] = [edge.get("q_in_m3s", np.nan) for edge in status]
    drains_out["surcharged"] = [edge.get("surcharged", False) for edge in status]
    drains_path = config.drainage_status_gpkg(event_date)
    drains_out.to_file(drains_path, layer="drains", driver="GPKG")

    graph_path = config.drainage_graph_pickle(event_date)
    with open(graph_path, "wb") as file:
        pickle.dump(graph, file)
    for path in (manholes_path, drains_path, graph_path):
        print(f"Saved: {path}")
    return manholes_path, drains_path, graph_path
