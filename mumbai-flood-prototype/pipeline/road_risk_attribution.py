"""
Attaches flood risk (from the integrated risk raster) to each road segment, and computes
the final edge weights the backend's routing service will load directly.

This is the critical handoff step: everything the backend needs for routing
must already be baked into the saved graph pickle, so the API never has to
import momepy or run zonal stats at request time.
"""

import pickle
import hashlib

import numpy as np

import rasterio
from rasterstats import zonal_stats
from shapely.geometry import box

from . import config
from .road_graph_builder import graph_to_edges_gdf
from .road_segmentation import refine_road_graph


def attach_flood_risk(G, roads_m_crs, integrated_flood_risk_tif_path,
                      buffer_m=config.ROAD_BUFFER_METERS, raster_in_memory=False,
                      sampling_cache=None):
    """
    Mutates G in place: adds `flood_risk`, `weight_normal`, and
    `weight_flood_aware` to every edge.
    """
    if sampling_cache is not None and not G.graph.get('road_segmentation_version'):
        # A pipeline event reuses topology across windows. Cache the refinement
        # independently of rainfall risk values, then copy before attribution.
        source_digest = hashlib.sha256()
        for u, v, edge in G.edges(data=True):
            source_digest.update(repr((u, v)).encode())
            source_digest.update(edge['geometry'].wkb)
            source_digest.update(str(edge.get('other_tags', '')).encode())
        source_signature = (str(roads_m_crs), source_digest.digest())
        if sampling_cache.get('segmentation_source') != source_signature:
            sampling_cache['segmented_base'] = refine_road_graph(G)
            sampling_cache['segmentation_source'] = source_signature
        G = sampling_cache['segmented_base'].copy()
    else:
        G = refine_road_graph(G)
    # Within an interval run the road buffers and valid grid are identical.
    # Reuse the exact pixel masks returned by rasterstats after the first window.
    if sampling_cache is not None:
        geometry_digest = hashlib.sha256()
        for u, v, edge in G.edges(data=True):
            geometry_digest.update(repr((u, v)).encode())
            geometry_digest.update(edge['geometry'].wkb)
        with rasterio.open(integrated_flood_risk_tif_path) as src:
            raster = src.read(1)
            signature = (raster.shape, tuple(src.transform), src.nodata,
                         str(roads_m_crs), buffer_m, geometry_digest.digest(),
                         hashlib.sha256((raster != src.nodata).tobytes()).digest())
            transform = src.transform
        if sampling_cache.get('signature') == signature:
            edges_gdf = sampling_cache['edges'].copy()
            flat = raster.ravel()
            maxima = [float(flat[cells].max()) if len(cells) else 0.0
                      for cells in sampling_cache['cells']]
            edges_gdf['flood_risk_max'] = maxima
            for row in edges_gdf.itertuples():
                edge = G[row.u][row.v]
                edge['flood_risk'] = row.flood_risk_max
                edge['weight_normal'] = edge['length_m']
                edge['weight_flood_aware'] = edge['length_m'] * config.risk_penalty_multiplier(row.flood_risk_max)
            return G, edges_gdf
    edges_gdf = graph_to_edges_gdf(G, roads_m_crs)

    edges_buffered = edges_gdf.copy()
    edges_buffered["geometry"] = edges_gdf.geometry.buffer(buffer_m)
    edges_buffered_wgs84 = edges_buffered.to_crs(config.WGS84)

    # Do not request enormous NoData cutouts for roads outside the raster.
    with rasterio.open(integrated_flood_risk_tif_path) as source:
        raster_extent = box(*source.bounds)
        raster_transform = source.transform
        raster_crs = source.crs
    sampling_geometries = edges_buffered_wgs84.to_crs(raster_crs)
    selected = np.flatnonzero(sampling_geometries.intersects(raster_extent).to_numpy())

    if raster_in_memory or sampling_cache is not None:
        # The interval runner samples the same raster against many road buffers.
        # Keep it in memory to avoid reopening the GeoTIFF for every edge.
        with rasterio.open(integrated_flood_risk_tif_path) as src:
            sampled = zonal_stats(
                sampling_geometries.iloc[selected], src.read(1), affine=src.transform,
                stats=["max"], nodata=config.NODATA_VAL,
                raster_out=sampling_cache is not None,
            )
    else:
        sampled = zonal_stats(
            sampling_geometries.iloc[selected], str(integrated_flood_risk_tif_path),
            stats=["max"], nodata=config.NODATA_VAL,
        )
    stats = [{"max": None, "mini_raster_array": np.ma.masked_all((0, 0)),
              "mini_raster_affine": raster_transform} for _ in range(len(edges_gdf))]
    for index, sample in zip(selected, sampled):
        stats[index] = sample
    edges_gdf["flood_risk_max"] = [s["max"] if s["max"] is not None else 0.0 for s in stats]
    if sampling_cache is not None:
        cells = []
        for stat in stats:
            mini = stat['mini_raster_array']
            rows, columns = np.nonzero(~np.ma.getmaskarray(mini))
            col0, row0 = ~transform * (stat['mini_raster_affine'].c, stat['mini_raster_affine'].f)
            cells.append((rows + round(row0)) * raster.shape[1] + columns + round(col0))
        sampling_cache.update(signature=signature, edges=edges_gdf.copy(), cells=cells)

    risk_lookup = {
        (row.u, row.v): row.flood_risk_max for row in edges_gdf.itertuples()
    }

    for u, v, d in G.edges(data=True):
        risk = risk_lookup.get((u, v), 0.0)
        d["flood_risk"] = risk
        d["weight_normal"] = d["length_m"]
        d["weight_flood_aware"] = d["length_m"] * config.risk_penalty_multiplier(risk)

    return G, edges_gdf


def save_graph(G, out_path):
    with open(out_path, "wb") as f:
        pickle.dump(G, f)
    return out_path


def load_graph(path):
    with open(path, "rb") as f:
        return pickle.load(f)
