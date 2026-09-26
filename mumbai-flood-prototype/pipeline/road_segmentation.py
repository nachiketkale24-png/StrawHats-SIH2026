"""Split roads at existing same-level junctions and into local risk sections."""
import math
import re

import networkx as nx
import numpy as np
from shapely.geometry import Point, LineString
from shapely.strtree import STRtree
from shapely.geometry import box
import geopandas as gpd
import rasterio
from . import config

VERSION = 1


def level(edge):
    tags = dict(re.findall(r'"([^"\n]+)"=>"([^"\n]*)"', str(edge.get('other_tags', ''))))
    return (tags.get('layer', '0'), tags.get('bridge', 'no'), tags.get('tunnel', 'no'))


def refine_road_graph(graph, max_length=60.0):
    if graph.graph.get('road_segmentation_version') == VERSION:
        return graph
    nodes = list(graph.nodes)
    points = [Point(node) for node in nodes]
    tree = STRtree(points)
    levels = {node: {level(edge) for edge in graph[node].values()} for node in nodes}
    refined = nx.Graph()
    refined.graph.update(graph.graph)
    refined.add_nodes_from(graph.nodes(data=True))
    # The source graph extends far beyond the modeled raster. Keep unassessed
    # roads intact; only subdivide roads inside the study extent.
    with rasterio.open(config.DEM_CLIPPED_TIF) as raster:
        extent = gpd.GeoSeries([box(*raster.bounds)], crs=raster.crs).to_crs(graph.graph['crs']).iloc[0]
    junctions = 0
    for edge_index, (u, v, edge) in enumerate(graph.edges(data=True), 1):
        line = edge['geometry']
        if not line.intersects(extent):
            refined.add_edge(u, v, **edge)
            continue
        if Point(line.coords[-1]).distance(Point(u)) < Point(line.coords[0]).distance(Point(u)):
            line = LineString(list(line.coords)[::-1])
        length = line.length
        cuts = {0.0: u, length: v}
        # Only connect existing endpoints on the actual line at the same level.
        # Crossing bridges and tunnels must not become invented intersections.
        for index in tree.query(line, predicate='dwithin', distance=0.01):
            node = nodes[index]
            if node in (u, v) or level(edge) not in levels[node]:
                continue
            distance = line.project(points[index])
            if 0.01 < distance < length - 0.01:
                cuts[distance] = node
                junctions += 1
        junction_cuts = sorted(cuts)
        for start, end in zip(junction_cuts, junction_cuts[1:]):
            count = max(1, math.ceil((end - start) / max_length))
            for index in range(1, count):
                distance = start + (end - start) * index / count
                cuts[distance] = tuple(line.interpolate(distance).coords[0])
        distances = sorted(cuts)
        vertices = np.asarray(line.coords)
        positions = np.concatenate(([0.0], np.cumsum(np.linalg.norm(np.diff(vertices[:, :2], axis=0), axis=1))))
        for start, end in zip(distances, distances[1:]):
            first = np.searchsorted(positions, start, side='right')
            last = np.searchsorted(positions, end, side='left')
            coordinates = [cuts[start], *map(tuple, vertices[first:last]), cuts[end]]
            geometry = LineString(coordinates)
            attributes = dict(edge, geometry=geometry, length_m=geometry.length, mm_len=geometry.length)
            for key in ('flood_risk', 'weight_normal', 'weight_flood_aware'):
                attributes.pop(key, None)
            refined.add_edge(cuts[start], cuts[end], **attributes)
        if edge_index % 10000 == 0:
            print(f'Segmented {edge_index}/{graph.number_of_edges()} source roads', flush=True)
    refined.graph.update(road_segmentation_version=VERSION, risk_section_max_length_m=max_length,
                         restored_junction_connections=junctions)
    return refined
