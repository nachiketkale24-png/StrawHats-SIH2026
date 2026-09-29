# Mumbai Flood Prototype

Mumbai Urban Flood Susceptibility Index (FSI) and flood-aware routing prototype for SIH.

Run all commands from this project directory (`mumbai-flood-prototype/`), because configuration paths are relative to the working directory.

Install dependencies:

```sh
pip install -r requirements.txt
```

Run the daily offline pipeline to generate daily outputs for the selected historical rainfall event:

```sh
python -m pipeline.run_pipeline
```

The time-window slider needs interval outputs instead. For example:

```sh
python -m pipeline.run_intervals --event-date 2020-09-23
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

These are observed historical accumulation windows, not future forecasts. Rainfall
uses one shared normalization range across all six windows of an event. Drainage
runoff and surcharge are recomputed for each window, and road risk uses the
integrated FSI-plus-drainage raster.

Drainage uses raw rainfall in millimetres, a built-up-dependent runoff coefficient,
and nearest-manhole catchments. Window flow is runoff volume divided by that
window's duration in seconds (15 minutes uses 900 seconds, 180 uses 10,800).
Conduits surcharge when flow exceeds their estimated Manning capacity. The
displayed score, download, point inspection, summary, and road attribution use
`clip(base_fsi + 0.40 * surface_flood_indicator, 0, 1)` when the integrated raster
exists. Plain FSI rasters remain available as diagnostic artifacts. Model version
2 in each manifest window causes older interval outputs to be regenerated on the
next run. This is a mean-flow proxy, not a peak-flow hydrograph or hydraulic loop
solver; cyclic network propagation remains approximate.

For complete existing intervals, `python -m pipeline.refresh_interval_drainage
--event-date 2020-09-23 --source both` updates saved runoff flow durations,
drainage statuses, integrated rasters, and road risk without rerunning unchanged
rainfall interpolation or the nowcast model. Omit `--source both` for observed
only. Incomplete prior outputs require the full interval runner.

Each interval writes `flood_risk_<date>_<minutes>min.tif`,
`integrated_flood_risk_<date>_<minutes>min.tif`,
`drainage_manholes_status_<date>_<minutes>min.gpkg`,
`drainage_status_<date>_<minutes>min.gpkg`, and
`mumbai_road_graph_<date>_<minutes>min.gpickle`. `event_windows_<date>.json` publishes
only intervals with both outputs ready. The API never computes these outputs live.
Use `GET /flood/windows/{event_date}` to discover intervals; pass
`?window_minutes=15` to the summary, raster, point, and drainage endpoints, or include
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
forecast. The nowcast runner also exports drainage status with the prefix
`drainage_manholes_status_nowcast_<date>_<minutes>min.gpkg` and its matching
`drainage_status_nowcast_<date>_<minutes>min.gpkg`. The API accepts
`rainfall_source=nowcast` on event/window/raster/point/drainage requests, and
`rainfall_source: "nowcast"` in route requests. Use `--without-routing` to backfill
forecast drainage and integrated rasters without rebuilding forecast road graphs.
Run with routing enabled afterward to update their risk weights too.

For a future live deployment, replace the historical workbook replay with a
live-gauge adapter that provides the same 12 timestamped station readings to
`get_predicted_window_totals`; the model and all spatial downstream logic stay
unchanged.

### Attribution

The joint LSTM workflow and architecture were adapted from
[omkarnitsureiitb/Mumbai_RainFall_Forecasting](https://github.com/omkarnitsureiitb/Mumbai_RainFall_Forecasting),
copyright 2024 Omkar Nitsure, under the MIT License. The unmodified license text
is retained in `THIRD_PARTY_LICENSES/Mumbai_RainFall_Forecasting_LICENSE`.
