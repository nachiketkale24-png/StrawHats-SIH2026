"""Train and evaluate the leakage-safe joint Mumbai station nowcaster.

Run from ``mumbai-flood-prototype``:
    python -m pipeline.train_nowcaster
"""

# Training workflow adapted from omkarnitsureiitb/Mumbai_RainFall_Forecasting
# (MIT License) — https://github.com/omkarnitsureiitb/Mumbai_RainFall_Forecasting

from __future__ import annotations

import argparse
import json
import random

import numpy as np
import pandas as pd
import torch
from torch import nn
from torch.utils.data import DataLoader, TensorDataset

from . import config
from .nowcasting import (
    FORECAST_STEPS, INTERVAL, LOOKBACK_STEPS, JointRainfallLSTM,
    RainfallMinMaxScaler,
)
from .rainfall_processing import load_rainfall_and_stations


def _split_by_time(rainfall: pd.DataFrame):
    train = rainfall.loc[rainfall.index < config.NOWCAST_TRAIN_END]
    validation = rainfall.loc[(rainfall.index >= config.NOWCAST_TRAIN_END) &
                              (rainfall.index < config.NOWCAST_VALIDATION_END)]
    test = rainfall.loc[rainfall.index >= config.NOWCAST_VALIDATION_END]
    return train, validation, test


def make_sequences(frame: pd.DataFrame, station_cols: list[str], scaler: RainfallMinMaxScaler):
    """Frame sequences only when all 24 source/target timestamps are contiguous."""
    data = frame[station_cols].to_numpy(dtype=np.float32)
    times = frame.index.to_numpy()
    normalized = scaler.transform(data)
    histories, targets = [], []
    width = LOOKBACK_STEPS + FORECAST_STEPS
    expected_delta = np.timedelta64(INTERVAL.value, "ns")
    for start in range(0, len(frame) - width + 1, config.NOWCAST_TRAIN_SEQUENCE_STRIDE):
        end = start + width
        if not np.all(times[start + 1:end] - times[start:end - 1] == expected_delta):
            continue
        block = normalized[start:end]
        if not np.isfinite(block).all():
            continue
        histories.append(block[:LOOKBACK_STEPS])
        targets.append(block[LOOKBACK_STEPS:])
    if not histories:
        raise ValueError("No contiguous, complete sequences available for this split")
    return np.stack(histories), np.stack(targets)


def metrics_by_lead(observed: np.ndarray, predicted: np.ndarray) -> list[dict]:
    rows = []
    for step in range(FORECAST_STEPS):
        error = predicted[:, step] - observed[:, step]
        rows.append({
            "lead_minutes": (step + 1) * 15,
            "rmse_mm": float(np.sqrt(np.mean(error ** 2))),
            "mae_mm": float(np.mean(np.abs(error))),
        })
    return rows


def _evaluate(model, x, y, scaler, batch_size=512):
    model.eval()
    outputs = []
    with torch.no_grad():
        for start in range(0, len(x), batch_size):
            outputs.append(model(torch.from_numpy(x[start:start + batch_size])).numpy())
    model_prediction = np.concatenate(outputs)
    observed = scaler.inverse_transform(y)
    prediction = np.maximum(scaler.inverse_transform(model_prediction), 0.0)
    persistence = scaler.inverse_transform(np.repeat(x[:, -1:, :], FORECAST_STEPS, axis=1))
    return metrics_by_lead(observed, persistence), metrics_by_lead(observed, prediction)


def run(epochs: int = config.NOWCAST_EPOCHS, batch_size: int = config.NOWCAST_BATCH_SIZE,
        seed: int = 42):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.set_num_threads(config.NOWCAST_TORCH_THREADS)

    rainfall, _, station_cols = load_rainfall_and_stations()
    train, validation, test = _split_by_time(rainfall)
    scaler = RainfallMinMaxScaler.fit(train[station_cols].dropna().to_numpy(dtype=np.float32))
    x_train, y_train = make_sequences(train, station_cols, scaler)
    x_validation, y_validation = make_sequences(validation, station_cols, scaler)
    x_test, y_test = make_sequences(test, station_cols, scaler)
    print(f"Sequences — train: {len(x_train)}, validation: {len(x_validation)}, test: {len(x_test)}")

    model = JointRainfallLSTM(len(station_cols), config.NOWCAST_HIDDEN_SIZE,
                              config.NOWCAST_NUM_LAYERS, config.NOWCAST_DROPOUT)
    optimizer = torch.optim.AdamW(model.parameters(), lr=config.NOWCAST_LEARNING_RATE,
                                  weight_decay=1e-5)
    loss_fn = nn.MSELoss()
    loader = DataLoader(TensorDataset(torch.from_numpy(x_train), torch.from_numpy(y_train)),
                        batch_size=batch_size, shuffle=True)
    best_state, best_validation = None, float("inf")
    stale_epochs = 0
    for epoch in range(1, epochs + 1):
        model.train()
        total_loss = 0.0
        for history, target in loader:
            optimizer.zero_grad()
            loss = loss_fn(model(history), target)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            total_loss += loss.item() * len(history)
        model.eval()
        with torch.no_grad():
            validation_loss = loss_fn(model(torch.from_numpy(x_validation)), torch.from_numpy(y_validation)).item()
        print(f"Epoch {epoch:02d}: train_mse={total_loss / len(x_train):.6f}, val_mse={validation_loss:.6f}")
        if validation_loss < best_validation - 1e-7:
            best_validation = validation_loss
            best_state = {name: value.detach().clone() for name, value in model.state_dict().items()}
            stale_epochs = 0
        else:
            stale_epochs += 1
            if stale_epochs >= config.NOWCAST_EARLY_STOPPING_PATIENCE:
                print("Early stopping: validation loss has not improved.")
                break
    model.load_state_dict(best_state)

    baseline, nowcaster = _evaluate(model, x_test, y_test, scaler)
    config.MODEL_DIR.mkdir(parents=True, exist_ok=True)
    torch.save({
        "model_state": model.state_dict(), "station_cols": station_cols,
        "hidden_size": config.NOWCAST_HIDDEN_SIZE, "num_layers": config.NOWCAST_NUM_LAYERS,
        "dropout": config.NOWCAST_DROPOUT,
    }, config.NOWCAST_MODEL_PATH)
    scaler.save(config.NOWCAST_SCALER_PATH, station_cols)
    report = {
        "model": "joint_lstm_residual_persistence", "features": "rainfall_only",
        "input_shape": [LOOKBACK_STEPS, len(station_cols)], "output_shape": [FORECAST_STEPS, len(station_cols)],
        "splits": {"train_before": str(config.NOWCAST_TRAIN_END),
                   "validation_before": str(config.NOWCAST_VALIDATION_END),
                   "test_from": str(config.NOWCAST_VALIDATION_END)},
        "sequence_counts": {"train": len(x_train), "validation": len(x_validation), "test": len(x_test)},
        "best_validation_mse_normalized": best_validation,
        "persistence_baseline": baseline, "joint_lstm": nowcaster,
    }
    config.NOWCAST_METRICS_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--epochs", type=int, default=config.NOWCAST_EPOCHS)
    parser.add_argument("--batch-size", type=int, default=config.NOWCAST_BATCH_SIZE)
    args = parser.parse_args()
    run(args.epochs, args.batch_size)
