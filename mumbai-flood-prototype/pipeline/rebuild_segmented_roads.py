"""Rebuild interval road risk sections without rerunning rainfall or drainage."""
import argparse

from . import config
from .road_risk_attribution import attach_flood_risk, load_graph, save_graph
from .road_segmentation import refine_road_graph


def run(event, source='observed'):
    prefix = 'nowcast_' if source == 'nowcast' else ''
    keys = [f'{prefix}{event}_{minutes}min' for minutes in config.AVAILABLE_WINDOWS_MIN]
    for key in keys:
        if not config.integrated_flood_risk_tif(key).exists():
            raise FileNotFoundError(config.integrated_flood_risk_tif(key))
    graph = refine_road_graph(load_graph(config.road_graph_pickle(keys[-1])))
    print(f'Refined roads: {graph.number_of_nodes()} nodes, {graph.number_of_edges()} edges; '
          f'{graph.graph["restored_junction_connections"]} interior junction connections', flush=True)
    cache = {}
    for key in keys:
        weighted, _ = attach_flood_risk(graph.copy(), config.UTM_43N,
                                      config.integrated_flood_risk_tif(key),
                                      raster_in_memory=True, sampling_cache=cache)
        path = config.road_graph_pickle(key)
        temporary = path.with_suffix('.gpickle.tmp')
        save_graph(weighted, temporary)
        temporary.replace(path)
        print(f'Saved {path}', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--event', default='2017-08-29')
    parser.add_argument('--source', choices=['observed', 'nowcast'], default='observed')
    args = parser.parse_args()
    run(args.event, args.source)
