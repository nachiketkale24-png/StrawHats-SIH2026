"""
Land-cover feature loading.
Assumes landcover_features.tif already exists (already generated in Colab):
  Band 1 = built_up_fraction
  Band 2 = water_wetland_mangrove_fraction
Both bands are already aligned to the DEM's 30 m grid.
"""

import numpy as np
import rasterio
from rasterio.warp import reproject, Resampling

from . import config


def ensure_land_mask():
    """Display-only mask: WorldCover class 80 is open water, other classes land.

    Wetland/mangrove classes remain visible. Match the DEM grid exactly.
    """
    if config.LAND_MASK_TIF.exists():
        return config.LAND_MASK_TIF
    with rasterio.open(config.DEM_CLIPPED_TIF) as dem, rasterio.open(config.WORLDCOVER_TIF) as cover:
        classes = np.zeros(dem.shape, dtype=np.uint8)
        reproject(source=rasterio.band(cover, 1), destination=classes,
                  src_transform=cover.transform, src_crs=cover.crs,
                  dst_transform=dem.transform, dst_crs=dem.crs,
                  dst_nodata=0, resampling=Resampling.nearest)
        land = ((classes != 0) & (classes != 80)).astype(np.uint8)
        temporary = config.LAND_MASK_TIF.with_suffix('.tif.tmp')
        with rasterio.open(temporary, 'w', driver='GTiff', width=dem.width, height=dem.height,
                           count=1, dtype='uint8', crs=dem.crs, transform=dem.transform,
                           nodata=255, compress='deflate') as output:
            output.write(land, 1)
            output.set_band_description(1, 'land_only_display_mask')
        temporary.replace(config.LAND_MASK_TIF)
    return config.LAND_MASK_TIF


def load_landcover_features(path=config.LANDCOVER_FEATURES_TIF):
    """
    Returns
    -------
    built_up : np.ndarray
    water_wetland_mangrove : np.ndarray
    lc_nodata : nodata value used in this raster
    """
    ensure_land_mask()
    with rasterio.open(path) as lc:
        built_up = lc.read(1)
        water_wetland_mangrove = lc.read(2)
        lc_nodata = lc.nodata

    return built_up, water_wetland_mangrove, lc_nodata
