"""
Central configuration for the Mumbai flood pipeline.
"""

from pathlib import Path

# ---------------------------------------------------------
# Directories
# ---------------------------------------------------------
DATA_RAW_DIR = Path("data/raw")
DATA_PROCESSED_DIR = Path("data/processed")
MODEL_DIR = Path("models")

# ---------------------------------------------------------
# Raw input files
# ---------------------------------------------------------
RAINFALL_XLSX = DATA_RAW_DIR / "Cleaned_Combined_Rainfall_2015_23.xlsx"
STATION_COORDS_XLSX = DATA_RAW_DIR / "Rainfall_Station_Coordinates.xlsx"
DEM_RAW_TIF = DATA_RAW_DIR / "P5_PAN_CD_N19_000_E072_000_DEM_30m.tif"
WORLDCOVER_TIF = DATA_RAW_DIR / "ESA_WorldCover_10m_2021_v200_N18E072_Map.tif"
ROADS_PBF = DATA_RAW_DIR / "western-zone-260904.osm.pbf"
MANHOLES_GEOJSON = DATA_RAW_DIR / "mumbai_storm_water_manholes.geojson"
DRAINS_GEOJSON = DATA_RAW_DIR / "mumbai_storm_water_drains.geojson"

# ---------------------------------------------------------
# Processed / intermediate files
# ---------------------------------------------------------
DEM_CLIPPED_TIF = DATA_PROCESSED_DIR / "mumbai_dem_clipped.tif"
LANDCOVER_FEATURES_TIF = DATA_PROCESSED_DIR / "landcover_features.tif"
ROADS_GPKG = DATA_PROCESSED_DIR / "mumbai_vehicle_roads.gpkg"

# Static vulnerability layer — terrain/surface only, reused across events.
VULNERABILITY_TIF = DATA_PROCESSED_DIR / "vulnerability.tif"
# True inside the rainfall-station convex hull (interpolated), False outside (extrapolated).
COVERAGE_MASK_TIF = DATA_PROCESSED_DIR / "coverage_mask.tif"

# Rainfall-only joint station nowcaster artifacts.  Model/scaler are never
# bundled with raw data and all paths remain relative to this project root.
NOWCAST_MODEL_PATH = MODEL_DIR / "mumbai_joint_rainfall_lstm.pt"
NOWCAST_SCALER_PATH = MODEL_DIR / "mumbai_joint_rainfall_scaler.npz"
NOWCAST_METRICS_PATH = MODEL_DIR / "mumbai_joint_rainfall_metrics.json"
NOWCAST_TRAIN_END = "2021-01-01"
NOWCAST_VALIDATION_END = "2022-01-01"
NOWCAST_HIDDEN_SIZE = 64
NOWCAST_NUM_LAYERS = 2
NOWCAST_DROPOUT = 0.15
NOWCAST_LEARNING_RATE = 1e-3
NOWCAST_EPOCHS = 12
NOWCAST_BATCH_SIZE = 2048
NOWCAST_TRAIN_SEQUENCE_STRIDE = 4  # one one-hour-spaced training origin; targets retain 15-min leads
NOWCAST_EARLY_STOPPING_PATIENCE = 5
NOWCAST_TORCH_THREADS = 4


def flood_risk_tif(event_date: str, window_minutes: int = None) -> Path:
    if window_minutes:
        return DATA_PROCESSED_DIR / f"flood_risk_{event_date}_{window_minutes}min.tif"
    return DATA_PROCESSED_DIR / f"flood_risk_{event_date}.tif"


def nowcast_flood_risk_tif(event_date: str, window_minutes: int) -> Path:
    """FSI created from a model forecast, never observed future rainfall."""
    return DATA_PROCESSED_DIR / f"flood_risk_nowcast_{event_date}_{window_minutes}min.tif"


def road_risk_gpkg(event_date: str) -> Path:
    return DATA_PROCESSED_DIR / f"road_risk_{event_date}.gpkg"


def road_graph_pickle(event_date: str) -> Path:
    return DATA_PROCESSED_DIR / f"mumbai_road_graph_{event_date}.gpickle"


def integrated_flood_risk_tif(event_date: str) -> Path:
    return DATA_PROCESSED_DIR / f"integrated_flood_risk_{event_date}.tif"


def drainage_graph_pickle(event_date: str) -> Path:
    return DATA_PROCESSED_DIR / f"mumbai_drainage_graph_{event_date}.pkl"


def drainage_manholes_gpkg(event_date: str) -> Path:
    return DATA_PROCESSED_DIR / f"drainage_manholes_status_{event_date}.gpkg"


def drainage_status_gpkg(event_date: str) -> Path:
    return DATA_PROCESSED_DIR / f"drainage_status_{event_date}.gpkg"


def nowcast_road_graph_pickle(event_date: str, window_minutes: int) -> Path:
    return DATA_PROCESSED_DIR / f"mumbai_road_graph_nowcast_{event_date}_{window_minutes}min.gpickle"


# ---------------------------------------------------------
# CRS
# ---------------------------------------------------------
WGS84 = "EPSG:4326"
UTM_43N = "EPSG:32643"

# ---------------------------------------------------------
# Raster / NoData
# ---------------------------------------------------------
NODATA_VAL = -9999.0
IMPLAUSIBLE_LOW_ELEVATION = -50.0

# ---------------------------------------------------------
# Rainfall event selection
# ---------------------------------------------------------
N_EVENTS_TO_SELECT = 3
MIN_EVENT_GAP_DAYS = 3

# IDW interpolation (replaces griddata linear+nearest)
IDW_POWER = 2
IDW_K_NEAREST = 8

# Windowed rainfall accumulation options offered by the frontend
AVAILABLE_WINDOWS_MIN = [15, 30, 60, 90, 120, 180]

# ---------------------------------------------------------
# FSI weights
# ---------------------------------------------------------
# Rainfall is applied multiplicatively against vulnerability, not summed with it.
VULNERABILITY_WEIGHTS = {
    "built_up": 0.55,
    "low_slope": 0.45,
    "water_buffer": 0.30,  # subtracted
}

FSI_RISK_BINS = [0, 0.25, 0.5, 0.75, 1.01]
FSI_RISK_LABELS = ["Low", "Medium", "High", "Severe"]

# PROTOTYPE ASSUMPTION: simple imperviousness-based runoff coefficient.
# C = C_MIN + (C_MAX - C_MIN) * built_up_fraction
RUNOFF_C_MIN = 0.15  # runoff coefficient over fully pervious land
RUNOFF_C_MAX = 0.80  # runoff coefficient over fully built-up/impervious land
# PROTOTYPE ASSUMPTION: the rainfall "event total" is treated as having fallen over
# this storm duration, purely to convert a rainfall depth (mm) into an average flow
# rate (m^3/s) for comparison against pipe capacity. Replace with the actual
# sub-event hyetograph if/when the live nowcast feed provides one.
STORM_DURATION_HOURS = 3.0

# PROTOTYPE ASSUMPTION: BMC does not supply a Manning roughness coefficient in this
# dataset. n = 0.013 is a generic value for smooth concrete/RCC storm-water conduits
# (a commonly cited textbook figure), NOT a calibrated or municipal number.
MANNING_N = 0.013
MIN_SLOPE = 1e-4  # floor applied to non-positive/near-zero conduit slopes
SURCHARGE_RATIO_THRESHOLD = 1.0  # Q_in / Q_capacity > this => surcharged
W_DRAINAGE_IN_RISK = 0.40  # weight of drainage-surcharge indicator in integrated risk
INFLUENCE_RADIUS_M = 150.0  # PROTOTYPE ASSUMPTION: how far surcharge "spreads" visually

# ---------------------------------------------------------
# Routing
# ---------------------------------------------------------
ROAD_BUFFER_METERS = 15

# Bounded, category-based penalty instead of unbounded length * (1 + 15*risk).
RISK_PENALTY_TABLE = [
    (0.25, 1.0),   # Low    -> no real penalty
    (0.50, 1.3),   # Medium -> mild preference against
    (0.75, 2.5),   # High   -> meaningful avoidance
    (1.01, 6.0),   # Severe -> strong avoidance, but bounded
]


def risk_penalty_multiplier(risk_value: float) -> float:
    for threshold, multiplier in RISK_PENALTY_TABLE:
        if risk_value < threshold:
            return multiplier
    return RISK_PENALTY_TABLE[-1][1]
