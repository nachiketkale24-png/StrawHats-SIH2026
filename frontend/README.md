# Mumbai Flood Susceptibility Frontend

React, TypeScript and Google Maps frontend connected to `../mumbai-flood-prototype`.

The dashboard uses Google's standard roadmap with the existing flood raster,
drainage GeoJSON, point inspection, start/destination markers and FastAPI route
paths. Panels use a light-card theme. The isolated base-map preview remains at
`?map=preview`. Set `VITE_GOOGLE_MAPS_API_KEY` in `.env` or `.env.local` and restart
Vite. See [the migration plan](GOOGLE_MAPS_MIGRATION.md) for architecture, setup,
verification and implementation status.

## Run locally

Start the prototype API in a separate terminal, from its project directory:

```powershell
cd C:\Dev\StrawHats-SIH2026\mumbai-flood-prototype
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --reload --port 8001
```

Run the offline pipeline at least once if no event outputs exist:

```powershell
.\.venv\Scripts\python.exe -m pipeline.run_intervals
```

Then start this frontend:

```powershell
cd C:\Dev\StrawHats-SIH2026\frontend
npm install
npm run dev
```

Open the local URL printed by Vite. `/api` requests are proxied to `http://127.0.0.1:8001`.
Use the prototype backend above; the separate older `../backend` application has a different API contract.

## Check the connection

1. Select a historical rainfall event. The default is 15 minutes. Use the bottom controls to increase the observed rainfall accumulation to 30, 60, 90, 120 or 180 minutes. Refresh events after generating new outputs.
2. Check the event's FSI minimum, mean and maximum and the colored raster overlay.
3. In Inspect mode, click the map to fetch the FSI at that location.
4. Choose Pick route, then click a start and destination inside Mumbai road coverage.
   The API snaps coordinates to its real road graph. Blue shows the risk-tolerance path;
   slate shows the shortest path. An amber dashed line is a suggested higher-risk route. The panel compares distances and maximum/average FSI.
5. Download FSI raster retrieves the original event GeoTIFF.
6. Map layers controls Flood Risk, Road Risk, Traffic and Satellite. Road Risk
   shows actual precomputed graph risks from zoom 14. Traffic shows current
   Google traffic where available and never changes flood-aware routing.

The frontend calls `GET /flood/events`, `GET /flood/summary/{event_date}`,
`GET /flood/raster/{event_date}`, `GET /flood/point/{event_date}`, `GET /flood/windows/{event_date}`, `GET /flood/roads/{event_date}`, `GET /drainage/{event_date}`, and `POST /route`. The selected `window_minutes` and rainfall source are sent with flood, drainage, road-risk and routing requests.
Event changes and new selections cancel stale requests. API failures and missing outputs
are displayed without substituting synthetic results.

FSI is relative susceptibility from 0 to 1, not flood depth or a live forecast.
The drainage overlay and summary use the selected window's exported drainage status;
observed and model-nowcast rainfall use separate drainage files. The API returns
404 when those files have not been generated for an event. Run
`pipeline.run_intervals --event-date <date>` for observed slider data or
`pipeline.run_nowcast_intervals --event-date <date>` for forecast slider data;
`pipeline.run_pipeline` generates daily outputs only.
The browser displays WGS84 GeoTIFFs with transparent NoData
and a nearest-neighbor preview reprojected per pixel into Web Mercator, capped at 1536 pixels on its longest side. The projection is checked against Rasterio/GDAL. The supplied DEM covers only 19.0?19.2978?N; no flood coverage is invented for southern Mumbai. Point inspection
and summaries use the backend's original data. Unsupported raster projections show an
error and remain available to download. Display colors use the pipeline's four FSI bins.

## Configuration and build

`npm run build` checks TypeScript and produces `dist/`.
For a separately hosted API, copy `.env.example` to `.env.local`, set
`VITE_API_BASE_URL=https://your-api-host`, then restart Vite or rebuild.
This URL is public frontend configuration and must not contain secrets.
Production hosting must either proxy `/api` to the Python backend or set this URL;
Vite's development proxy does not apply to `npm run preview` or static hosting.
The API must permit the frontend origin through CORS.

Google Maps tiles require internet access and a restricted browser API key.
Satellite switches to Google hybrid imagery without replacing the map instance.
3D buildings are dropped. The offline Python calculations are unchanged.
Existing address search uses Nominatim. Google Places activation remains optional.
The removed Mumbai municipal crop stays removed; the map uses the original extent.
Local env files are ignored and untracked. Google Cloud restrictions must be
checked in the Cloud console: restrict the browser key to your website referrers
and required APIs ([Google setup guidance](https://developers.google.com/maps/documentation/javascript/get-api-key)).
Cloud settings cannot be audited from this checkout.


Historical dates available after preprocessing: 2015-06-19, 2017-08-29 and
2020-09-23. The displayed start/end times use workbook timestamps; the workbook
does not declare a timezone. These controls accumulate observed rainfall from the
same event start; they do not predict future rainfall. Interval FSI uses one
rainfall normalization range across all six windows of each event.

Integration checks (run from frontend with the prototype API and Vite running):

```sh
node --experimental-strip-types scripts/check-raster-projection.mjs
node scripts/check-event-intervals.mjs
node scripts/verify-google-dashboard.cjs
node scripts/verify-google-preview.cjs
node scripts/check-map-security.cjs
```

The first check compares every display pixel with Rasterio/GDAL EPSG:3857 output
using the prototype Python environment. The second checks all 18 interval rasters,
summaries, exact point samples, route endpoints, and invalid-duration responses.
