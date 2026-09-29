"""Read precomputed graph risks for display; never alter routing weights."""
from functools import lru_cache
import math

import geopandas as gpd
from shapely.geometry import box, mapping

from pipeline import config
from backend.services.routing_service import routing_service


@lru_cache(maxsize=2)
def _roads(event, stamp):
    graph = routing_service._get_graph(event)
    records = []
    for index, (_, _, edge) in enumerate(graph.edges(data=True)):
        geometry = edge.get('geometry')
        risk = edge.get('flood_risk')
        if geometry is None or risk is None or not math.isfinite(risk) or not 0 <= risk <= 1:
            continue
        records.append({'id': f'road:{index}', 'flood_risk': float(risk),
                        'length_m': float(edge['length_m']), 'geometry': geometry})
    return gpd.GeoDataFrame(records, columns=['id', 'flood_risk', 'length_m', 'geometry'],
                            crs=config.UTM_43N).to_crs(config.WGS84)


def get_road_risk(event, west, south, east, north):
    path = config.road_graph_pickle(event)
    if not path.exists():
        raise FileNotFoundError(f'No road graph found for event {event}')
    stat = path.stat()
    roads = _roads(event, (stat.st_mtime_ns, stat.st_size))
    indices = roads.sindex.query(box(west, south, east, north), predicate='intersects')
    visible = roads.iloc[indices].sort_values(['flood_risk', 'id'], ascending=[False, True])
    total = len(visible)
    features = []
    for row in visible.head(5000).itertuples():
        features.append({'type': 'Feature', 'id': row.id, 'geometry': mapping(row.geometry),
                         'properties': {'flood_risk': row.flood_risk, 'length_m': row.length_m}})
    return {'type': 'FeatureCollection', 'features': features, 'total_in_view': total,
            'truncated': total > 5000, 'event_key': event}
