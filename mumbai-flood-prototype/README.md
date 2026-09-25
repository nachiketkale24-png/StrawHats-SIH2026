# Mumbai Flood Prototype

Mumbai Urban Flood Susceptibility Index (FSI) and flood-aware routing prototype for SIH.

Run all commands from this project directory (`mumbai-flood-prototype/`), because configuration paths are relative to the working directory.

Install dependencies:

```sh
pip install -r requirements.txt
```

Run the offline pipeline once to generate outputs for the selected historical rainfall event:

```sh
python -m pipeline.run_pipeline
```

The supplied intermediates `mumbai_dem_clipped.tif`, `landcover_features.tif`, and `mumbai_vehicle_roads.gpkg` must be present in `data/processed/`; raw inputs belong in `data/raw/`.

Start the API server:

```sh
uvicorn backend.main:app --reload --port 8001
```

Run the pipeline at least once before the backend has event data to serve. The backend reads precomputed `data/processed/flood_risk_<event_date>.tif` and `data/processed/mumbai_road_graph_<event_date>.gpickle` files. It never recomputes these outputs live; route requests compute paths using the precomputed graph.


## Historical 15-minute intervals

Generate all three selected heavy-rainfall dates and their 15, 30, 60, 90, 120,
and 180-minute outputs (this may take several minutes per event):

```sh
python -m pipeline.run_intervals
```

To generate one selected date, use `--event-date 2017-08-29` (also available:
`2015-06-19` and `2020-09-23`). Completed interval outputs are reused on subsequent
runs. Each date starts at its strongest complete three-hour window by mean station
rainfall. Duration totals include workbook samples with timestamps in
`[start_time, end_time)`. Missing readings are not fabricated: candidate windows
with any missing matched-station observations are rejected. Times retain the
workbook's unspecified timezone and are displayed as workbook time.

These are observed historical accumulation windows, not future forecasts. The
original FSI, spatial interpolation, slope, and routing weight formulas are reused
unchanged. Because rainfall is normalized spatially separately for each interval,
a longer duration does not necessarily increase FSI at every location.

Each interval writes `flood_risk_<date>_<minutes>min.tif` and
`mumbai_road_graph_<date>_<minutes>min.gpickle`. `event_windows_<date>.json` publishes
only intervals with both outputs ready. The API never computes these outputs live.
Use `GET /flood/windows/{event_date}` to discover intervals; pass
`?window_minutes=15` to the summary, raster and point endpoints, or include
`"window_minutes": 15` in a route request. Existing daily files and daily requests
remain supported. Dates generated only by the interval pipeline require a duration.
Restart the API after source changes.

## Leakage-safe rainfall nowcasting

`python -m pipeline.train_nowcaster` trains one joint, rainfall-only LSTM with
input/output shape `12 x 37`: 12 known 15-minute station readings (three hours)
produce the next 12 readings. The split is time-ordered (train through 2020,
validation 2021, held-out test 2022) and the per-station min/max scaler is fit
only on training readings. It writes the model, scaler and lead-time metrics to
`models/`.

`python -m pipeline.run_nowcast_intervals --event-date 2020-09-23` replays a
historical reference time but reads only the three preceding observed hours; it
then sends predicted station totals through the existing unchanged IDW
interpolation, FSI, coverage-mask, road-risk, and routing steps. The resulting
outputs are explicitly `nowcast` artifacts. Existing `observed` artifacts remain
an offline, perfect-knowledge comparison mode and must not be presented as a
forecast. The API accepts `rainfall_source=nowcast` on event/window/raster/point
requests, and `rainfall_source: "nowcast"` in route requests.

For a future live deployment, replace the historical workbook replay with a
live-gauge adapter that provides the same 12 timestamped station readings to
`get_predicted_window_totals`; the model and all spatial downstream logic stay
unchanged.

### Attribution

The joint LSTM workflow and architecture were adapted from
[omkarnitsureiitb/Mumbai_RainFall_Forecasting](https://github.com/omkarnitsureiitb/Mumbai_RainFall_Forecasting),
copyright 2024 Omkar Nitsure, under the MIT License. The unmodified license text
is retained in `THIRD_PARTY_LICENSES/Mumbai_RainFall_Forecasting_LICENSE`.
