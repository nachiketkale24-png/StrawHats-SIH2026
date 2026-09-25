"""Joint, rainfall-only 3-hour station nowcasting utilities.

The model forecasts only the 37 rain-gauge values.  City-wide coverage remains
the responsibility of :func:`rainfall_processing.interpolate_rainfall_to_grid`.
The observed-history argument is intentionally a DataFrame so replacing a
historical workbook replay with a live gauge-feed adapter changes only the
caller, not this forecasting code.
"""

# Model architecture adapted from omkarnitsureiitb/Mumbai_RainFall_Forecasting
# (MIT License) — https://github.com/omkarnitsureiitb/Mumbai_RainFall_Forecasting

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Sequence

import numpy as np
import pandas as pd
import torch
from torch import nn

from . import config


LOOKBACK_STEPS = 12
FORECAST_STEPS = 12
INTERVAL = pd.Timedelta(minutes=15)


class RainfallMinMaxScaler:
    """Per-station min-max scaler fitted exclusively on the training period."""

    def __init__(self, minimum: np.ndarray, maximum: np.ndarray):
        self.minimum = np.asarray(minimum, dtype=np.float32)
        self.maximum = np.asarray(maximum, dtype=np.float32)
        self.scale = np.maximum(self.maximum - self.minimum, 1e-6)

    @classmethod
    def fit(cls, values: np.ndarray) -> "RainfallMinMaxScaler":
        if not np.isfinite(values).all():
            raise ValueError("Training rainfall contains missing or non-finite readings")
        return cls(values.min(axis=0), values.max(axis=0))

    def transform(self, values: np.ndarray) -> np.ndarray:
        return (np.asarray(values, dtype=np.float32) - self.minimum) / self.scale

    def inverse_transform(self, values: np.ndarray) -> np.ndarray:
        return np.asarray(values, dtype=np.float32) * self.scale + self.minimum

    def save(self, path: Path, station_cols: Sequence[str]) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        np.savez_compressed(path, minimum=self.minimum, maximum=self.maximum,
                            station_cols=np.asarray(station_cols, dtype=str))

    @classmethod
    def load(cls, path: Path) -> tuple["RainfallMinMaxScaler", list[str]]:
        artifact = np.load(path, allow_pickle=False)
        return cls(artifact["minimum"], artifact["maximum"]), artifact["station_cols"].tolist()


class JointRainfallLSTM(nn.Module):
    """One shared encoder with a 12-by-37 direct multi-step forecast head."""

    def __init__(self, n_stations: int, hidden_size: int = 64, num_layers: int = 2,
                 dropout: float = 0.15):
        super().__init__()
        self.n_stations = n_stations
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        self.encoder = nn.LSTM(
            input_size=n_stations,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0.0,
        )
        self.head = nn.Sequential(
            nn.Linear(hidden_size, hidden_size), nn.ReLU(),
            nn.Linear(hidden_size, FORECAST_STEPS * n_stations),
        )

    def forward(self, history: torch.Tensor) -> torch.Tensor:
        encoded, _ = self.encoder(history)
        residual = self.head(encoded[:, -1]).view(-1, FORECAST_STEPS, self.n_stations)
        # Learning departures from persistence is substantially more stable for
        # sparse 15-minute rainfall than learning the level from zero.
        persistence = history[:, -1:, :].expand(-1, FORECAST_STEPS, -1)
        return persistence + residual


def make_model_from_checkpoint(checkpoint: dict) -> JointRainfallLSTM:
    model = JointRainfallLSTM(
        n_stations=len(checkpoint["station_cols"]),
        hidden_size=checkpoint["hidden_size"],
        num_layers=checkpoint["num_layers"],
        dropout=checkpoint.get("dropout", 0.15),
    )
    model.load_state_dict(checkpoint["model_state"])
    model.eval()
    return model


def recent_observed_history(
    rainfall_df: pd.DataFrame,
    reference_timestamp: pd.Timestamp | str,
    station_cols: Sequence[str],
) -> pd.DataFrame:
    """Return exactly 12 known readings in the 3 hours preceding ``reference``.

    The reference instant itself is deliberately excluded: it is the first
    forecast interval, so no future observed rainfall can enter the model.
    """
    reference = pd.Timestamp(reference_timestamp)
    expected = pd.date_range(reference - LOOKBACK_STEPS * INTERVAL,
                             periods=LOOKBACK_STEPS, freq=INTERVAL)
    history = rainfall_df.reindex(expected)[list(station_cols)]
    if history.isna().any().any():
        missing = history.index[history.isna().any(axis=1)].tolist()
        raise ValueError(
            "A nowcast needs 12 complete 15-minute observed station readings before "
            f"{reference.isoformat()}; missing timestamps include {missing[:3]}"
        )
    return history


@lru_cache(maxsize=2)
def _load_artifacts(model_path_str: str, scaler_path_str: str):
    model_path, scaler_path = Path(model_path_str), Path(scaler_path_str)
    if not model_path.exists() or not scaler_path.exists():
        raise FileNotFoundError(
            "Nowcast model artifacts are missing. Run `python -m pipeline.train_nowcaster` first."
        )
    # Small 12-step batches are slower with a large default OpenMP pool on
    # Windows; use the project cap for responsive API/demo inference.
    torch.set_num_threads(config.NOWCAST_TORCH_THREADS)
    checkpoint = torch.load(model_path, map_location="cpu", weights_only=False)
    model = make_model_from_checkpoint(checkpoint)
    scaler, scaler_cols = RainfallMinMaxScaler.load(scaler_path)
    station_cols = checkpoint["station_cols"]
    if station_cols != scaler_cols:
        raise ValueError("Nowcast model and scaler use different station-column orders")
    return model, scaler, station_cols


def predict_station_rainfall(
    rainfall_df: pd.DataFrame,
    reference_timestamp: pd.Timestamp | str,
    station_cols: Sequence[str],
    model_path: Path = config.NOWCAST_MODEL_PATH,
    scaler_path: Path = config.NOWCAST_SCALER_PATH,
) -> pd.DataFrame:
    """Forecast 12 future 15-minute station-rainfall records from known history."""
    model, scaler, trained_cols = _load_artifacts(str(model_path), str(scaler_path))
    if list(station_cols) != trained_cols:
        raise ValueError("Station columns must match the order used to train the nowcast model")
    history = recent_observed_history(rainfall_df, reference_timestamp, station_cols)
    features = scaler.transform(history.to_numpy())
    with torch.no_grad():
        predicted_normalized = model(torch.from_numpy(features).unsqueeze(0)).squeeze(0).numpy()
    # Rainfall cannot be negative. Do not cap large values: extrema in future
    # replay/live feeds may legitimately exceed the training maximum.
    predicted = np.maximum(scaler.inverse_transform(predicted_normalized), 0.0)
    reference = pd.Timestamp(reference_timestamp)
    forecast_index = pd.date_range(reference, periods=FORECAST_STEPS, freq=INTERVAL)
    return pd.DataFrame(predicted, index=forecast_index, columns=trained_cols)


def get_predicted_window_totals(
    rainfall_df: pd.DataFrame,
    reference_timestamp: pd.Timestamp | str,
    station_cols: Sequence[str],
    window_minutes: int,
    model_path: Path = config.NOWCAST_MODEL_PATH,
    scaler_path: Path = config.NOWCAST_SCALER_PATH,
) -> pd.Series:
    """Return forecast accumulation per station for a configured future window.

    This is a drop-in station-total source for the unchanged IDW interpolation
    function. Historical replay and a future live-gauge feed both supply the
    same ``rainfall_df`` observed-history interface.
    """
    if window_minutes not in config.AVAILABLE_WINDOWS_MIN:
        raise ValueError(f"Unsupported forecast window {window_minutes}; use {config.AVAILABLE_WINDOWS_MIN}")
    forecast = predict_station_rainfall(
        rainfall_df, reference_timestamp, station_cols, model_path, scaler_path
    )
    return forecast.iloc[:window_minutes // 15].sum(axis=0).reindex(station_cols)
