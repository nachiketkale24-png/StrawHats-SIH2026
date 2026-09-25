"""
Routing service. Loads the risk-weighted road graph pickle ONCE (per event,
cached in memory) and serves Dijkstra route requests fast — no graph
rebuilding, no momepy, no zonal stats at request time.
"""

from pathlib import Path

import geopandas as gpd
import networkx as nx
from shapely.geometry import LineString, Point

from pipeline import config
from pipeline.road_risk_attribution import load_graph


TOLERANCE_THRESHOLDS = {
    "low": 0.25,
    "medium": 0.5,
    "high": 0.75,
    "severe": 1.01,
}


def tolerance_weight_fn(tolerance_threshold):
    """Create a request-specific route weight without mutating graph edges."""
    def weight(u, v, edge_data):
        risk = edge_data.get("flood_risk", 0.0)
        length = edge_data.get("length_m", edge_data.get("weight_normal", 1.0))
        if risk < tolerance_threshold:
            return length
        return length * config.risk_penalty_multiplier(risk)

    return weight


class RoutingService:
    def __init__(self):
        self._graph_cache = {}       # event_date -> networkx graph
        self._graph_crs = config.UTM_43N

    def _get_graph(self, event_date: str):
        if event_date not in self._graph_cache:
            path = config.road_graph_pickle(event_date)
            if not Path(path).exists():
                raise FileNotFoundError(f"No road graph found for event {event_date}")
            self._graph_cache[event_date] = load_graph(path)
        return self._graph_cache[event_date]

    def _nearest_node(self, G, lon, lat):
        pt = gpd.GeoSeries([Point(lon, lat)], crs=config.WGS84).to_crs(self._graph_crs).iloc[0]
        nodes = list(G.nodes)
        dists = gpd.GeoSeries([Point(n) for n in nodes], crs=self._graph_crs).distance(pt)
        return nodes[dists.idxmin()]

    def _route_stats(self, G, route):
        length = sum(G[route[i]][route[i + 1]]["length_m"] for i in range(len(route) - 1))
        risks = [G[route[i]][route[i + 1]]["flood_risk"] for i in range(len(route) - 1)]
        max_risk = max(risks) if risks else 0.0
        avg_risk = sum(risks) / len(risks) if risks else 0.0
        return length, max_risk, avg_risk

    def _route_to_coords(self, G, route):
        """Nodes are (x, y) tuples in the metric CRS — convert back to lon/lat for the API."""
        stitched = []
        for u, v in zip(route, route[1:]):
            geometry = G[u][v].get("geometry")
            segment = list(geometry.coords) if geometry is not None else [u, v]

            # Source-line direction may be opposite to Dijkstra traversal.
            if Point(segment[-1]).distance(Point(u)) < Point(segment[0]).distance(Point(u)):
                segment.reverse()

            if stitched and segment[0] == stitched[-1]:
                stitched.extend(segment[1:])
            else:
                stitched.extend(segment)

        if not stitched:
            stitched = list(route)

        line = gpd.GeoSeries([LineString(stitched)], crs=self._graph_crs).to_crs(config.WGS84).iloc[0]
        return [[lon, lat] for lon, lat in line.coords]

    def _route_to_geojson(self, G, route):
        """Return the existing WGS84 route coordinates as a GeoJSON LineString."""
        return {"type": "LineString", "coordinates": self._route_to_coords(G, route)}

    def _tolerance_route_details(self, G, route):
        """Summarize risk exposure for the dynamically weighted tolerance route."""
        _, max_risk, _ = self._route_stats(G, route)
        high_severe_segment_count = sum(
            G[route[i]][route[i + 1]].get("flood_risk", 0.0) >= 0.5
            for i in range(len(route) - 1)
        )
        warning = None
        if high_severe_segment_count:
            warning = (
                f"This route passes through {high_severe_segment_count} high-risk "
                f"segment(s) (max risk {max_risk:.2f}). Consider an alternate route "
                "if possible."
            )
        return max_risk, high_severe_segment_count, warning

    def compute_routes(
        self,
        event_date,
        origin_lat,
        origin_lon,
        dest_lat,
        dest_lon,
        risk_tolerance="low",
    ):
        G = self._get_graph(event_date)

        origin_node = self._nearest_node(G, origin_lon, origin_lat)
        dest_node = self._nearest_node(G, dest_lon, dest_lat)

        normal_route = nx.shortest_path(
            G, origin_node, dest_node, weight="weight_normal", method="dijkstra"
        )
        flood_aware_route = nx.shortest_path(
            G, origin_node, dest_node, weight="weight_flood_aware", method="dijkstra"
        )
        threshold = TOLERANCE_THRESHOLDS[risk_tolerance]
        tolerance_route = nx.shortest_path(
            G,
            origin_node,
            dest_node,
            weight=tolerance_weight_fn(threshold),
            method="dijkstra",
        )

        n_len, n_max, n_avg = self._route_stats(G, normal_route)
        f_len, f_max, f_avg = self._route_stats(G, flood_aware_route)
        t_len, _, _ = self._route_stats(G, tolerance_route)
        max_risk_on_route, high_severe_segment_count, warning = self._tolerance_route_details(
            G, tolerance_route
        )

        return {
            "event_date": event_date,
            "normal_route": {
                "length_m": n_len, "max_risk": n_max, "avg_risk": n_avg,
                "coordinates": self._route_to_coords(G, normal_route),
            },
            "normal_distance_km": n_len / 1000,
            "flood_aware_route": {
                "length_m": f_len, "max_risk": f_max, "avg_risk": f_avg,
                "coordinates": self._route_to_coords(G, flood_aware_route),
            },
            "flood_aware_distance_km": f_len / 1000,
            "extra_distance_m": f_len - n_len,
            "extra_distance_pct": round(100 * (f_len - n_len) / n_len, 2) if n_len else 0.0,
            "detour_pct": round(100 * (f_len - n_len) / n_len, 2) if n_len else 0.0,
            "tolerance_route": self._route_to_geojson(G, tolerance_route),
            "tolerance_distance_km": t_len / 1000,
            "risk_tolerance": risk_tolerance,
            "max_risk_on_route": max_risk_on_route,
            "high_severe_segment_count": high_severe_segment_count,
            "warning": warning,
        }


routing_service = RoutingService()
