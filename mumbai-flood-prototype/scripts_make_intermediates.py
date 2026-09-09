import numpy as np
import rasterio
from rasterio.warp import reproject, Resampling
from pathlib import Path

root = Path('data')
raw = root / 'raw'
out = root / 'processed'
out.mkdir(exist_ok=True)
dem_path = raw / 'P5_PAN_CD_N19_000_E072_000_DEM_30m.tif'
lc_path = raw / 'ESA_WorldCover_10m_2021_v200_N18E072_Map.tif'
dem_out = out / 'mumbai_dem_clipped.tif'
with rasterio.open(dem_path) as src:
    profile = src.profile.copy()
    profile.update(driver='GTiff', compress='deflate', tiled=True, blockxsize=256, blockysize=256)
    with rasterio.open(dem_out, 'w', **profile) as dst:
        dst.write(src.read(1), 1)
    dst_transform, dst_crs = src.transform, src.crs
    shape = (src.height, src.width)

built = np.zeros(shape, dtype='float32')
water = np.zeros(shape, dtype='float32')
with rasterio.open(lc_path) as src:
    src_arr = src.read(1)
    built_src = (src_arr == 50).astype('float32')
    water_src = np.isin(src_arr, [80, 90, 95]).astype('float32')
    for arr, out_arr in [(built_src, built), (water_src, water)]:
        reproject(arr, out_arr, src_transform=src.transform, src_crs=src.crs,
                  dst_transform=dst_transform, dst_crs=dst_crs,
                  resampling=Resampling.average)
profile.update(count=2, dtype='float32', nodata=-9999.0)
with rasterio.open(out / 'landcover_features.tif', 'w', **profile) as dst:
    dst.write(built, 1)
    dst.write(water, 2)
print('created', dem_out, out / 'landcover_features.tif')
