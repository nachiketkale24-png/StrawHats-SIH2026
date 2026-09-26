# Google Maps migration: Phases 2 and 3

## Phase 3 implementation

The default dashboard now uses Google Maps. `?map=preview` keeps the isolated
base-map preview for diagnostics; `?map=legacy` also opens the migrated dashboard.
`FloodMapCanvas.tsx` owns Google map configuration, `FloodRiskLayer.tsx` positions
the existing raster preview using Google OverlayView, and `RouteLayer.tsx` draws
backend paths and start/destination markers. `useGoogleMumbaiMap.ts` manages the
map reference and cleanup; `useMapInspection.ts` handles native map/Data clicks
and existing point sampling. `googleDrainage.ts` renders existing drainage GeoJSON. Profiling the optional
full network showed a 37-second load and an unresponsive toggle when all 69,142
features were added to Google Data. Rendering now filters by the viewport,
shows normal manholes from zoom 13 and conduits from zoom 15, and updates only
feature differences on a debounced viewport change. Dataset loading and summary
counts remain unchanged; zoom/pan reuse the cached dataset.
`floodRaster.ts` retains the original decoding, reprojection, land masking,
NoData and cache logic extracted from the former layer helper. Low-blue display
opacity is increased from 60/255 to 110/255 for Google's light roadmap.

Event/source selection, time intervals, route tolerance, address geocoding,
API request schemas and all backend calculations are unchanged. Existing panels
use light-card tokens, with dark input/selector text and darker status text.
3D buildings are dropped. Places is loaded but existing Nominatim address search
is preserved; Google Places billing/enablement has not been assumed.

Road-risk rendering, traffic controls and Google Places autocomplete remain
subsequent phases. The backend still has no road-risk GeoJSON endpoint. The live
key added locally loads Google tiles; its value is never included in documentation.

## Original architecture (inspection before migration)

`src/main.tsx` mounts `App.tsx`, which previously rendered only
`components/MumbaiFloodMap.tsx`. That dashboard owns event, rainfall-source,
time-window, drainage, inspection and route-selection state. `hooks/useMumbaiMap.ts`
creates the MapLibre instance. The active helpers are `lib/eventLayers.ts`
(GeoTIFF preview and route lines), `lib/drainageLayers.ts` (GeoJSON) and
`components/MapControls.tsx` (map navigation).

`lib/floodApi.ts` centralizes HTTP calls, with `VITE_API_BASE_URL` or `/api`.
Vite proxies `/api` to port 8001. The active backend is
`../mumbai-flood-prototype/backend/main.py`; its services read offline raster,
drainage and graph outputs. This execution path does not require PostgreSQL.
`mobile/` is a separate React Native client and is outside this migration.

Flood display is **GeoTIFF**, not a flood polygon GeoJSON endpoint. The frontend
aligns the WGS84 raster with a land mask, projects a bounded preview to Mercator,
and colors FSI using bins 0–0.25, 0.25–0.5, 0.5–0.75 and 0.75–1.
`GET /flood/point/{event}` returns actual `fsi` and optional
`in_station_network`. Drainage returns Point and LineString FeatureCollections.
Road attribution stores `flood_risk_max` on segments and `flood_risk` on graph
edges; there is currently no road-risk GeoJSON HTTP endpoint.

`POST /route` accepts event_date, origin_lat/origin_lon, dest_lat/dest_lon,
risk_tolerance, window_minutes and rainfall_source. NetworkX Dijkstra computes
normal, flood-aware and tolerance routes from the existing graph. Coordinates
are [longitude, latitude]. Returned metrics include lengths, maximum/average
risk, tolerance distance, high/severe segment count, warnings and suggestions.
The frontend currently renders normal and tolerance/suggested paths.

## Original migration inventory and sequence (Phases 2/3 now implemented)

1. Phase 2 (this change): add `components/map/GoogleMapPreview.tsx`, selected
   by default, with the original dashboard available at `?map=legacy`.
   Add the vis.gl dependency, environment example, scoped light-card theme,
   and preview browser verification. Leave backend and original renderer intact.
2. Phase 3 onward: extract renderer-independent state/API logic from
   `MumbaiFloodMap.tsx`; replace `useMumbaiMap.ts` and `MapControls.tsx`.
   Adapt `eventLayers.ts` to Google overlays and polylines and
   `drainageLayers.ts` to Google Data/overlays. Drop 3D buildings.
3. Flood visualization/inspection: preserve actual raster coverage and FSI
   classes; use existing point sampling. A polygon GeoJSON endpoint must not be
   assumed. Verify blue/yellow/orange/red overlay contrast on actual Google tiles,
   especially low-blue raster opacity (then 60/255; now 110/255).
4. Road-risk rendering: investigate exposing existing segment output only when
   needed; avoid assuming an endpoint or loading all 70,000 segments at low zoom.
5. Preserve existing address/routing service and request schema; migrate start/end
   markers, normal/tolerance routes and comparison UI. Add display-only traffic
   and satellite controls. Re-theme existing panels and audit every input,
   dropdown and label when those panels become part of the Google dashboard.
6. Audit old prototype code (`lib/floodLayers.ts`, `lib/heatmapLayers.ts` and their
   mock-data callers) before removing it; it is not the active backend raster path.
   `lib/routing.ts` has no MapLibre import and does not need a renderer rewrite.
   Finally remove MapLibre from `main.tsx`, `index.css`, package manifests and
   obsolete renderer files; adapt the old dashboard/drainage verification scripts.

## Setup

Copy `.env.example` to `.env.local` and set `VITE_GOOGLE_MAPS_API_KEY` to the
existing browser key. Restart Vite or rebuild after changes. The key is public
browser configuration: restrict HTTP referrers and permitted APIs in Google
Cloud. Enable Maps JavaScript API and billing. No server secret belongs here.
`.env` and `.env.*` are ignored except `.env.example`.

The preview loads `places` and `visualization` as requested. Google documents
HeatmapLayer as unavailable in a Maps JS release from May 2026:
https://developers.google.com/maps/documentation/javascript/visualization
That future migration requirement needs a supported approach; this phase adds
no heatmap, synthetic data or replacement renderer.

## Verification and limits

Phases 2/3 add the runtime `@vis.gl/react-google-maps` dependency and direct
Google Maps/GeoJSON development typings. The `maplibre-gl` package and worker
are removed. Full drainage details now require zooming in to keep interaction
responsive; totals still come from the unmodified backend summary.

Run `npm run build`, then `node scripts/verify-google-dashboard.cjs` for the
actual-data dashboard or `node scripts/verify-google-preview.cjs` for the preview, with Vite
running. The browser script uses the existing workspace's Chrome/Playwright
installation convention. It checks desktop/mobile layout, missing-key handling
or tile readiness, label contrast and uncaught JavaScript errors; it writes two
screenshots for visual review. Live key authorization, billing, Google controls
and overlay contrast require a configured browser key and actual tiles.

Phase 2 initially had no frontend key; live tile loading is now verified with
the local environment supplied for Phase 3. Cloud restrictions cannot be inspected from this repository.
MapLibre and its obsolete renderer helpers/CSS have been removed. The unused
mock-dashboard/3D profiling and legacy drainage renderer scripts are retired;
the real-data Google dashboard check replaces them. `verify-map.cjs` now runs
that check. Existing renderer-independent routing/projection/API checks remain.
Risk swatches in the isolated preview remain a labeled reference, not flood data.

The live dashboard check verifies raster loading, FSI point sampling, real drainage
features, A/B mouse clicks, the unchanged POST /route schema, both backend paths,
actual distance display, satellite switching, map-instance reuse, full-network
viewport/zoom filtering, time-window raster replacement, light-theme
text contrast, desktop/mobile layout and browser errors. Phase 3 required no
backend file changes; Phase 6 adds the read-only road display endpoint below.

The frontend directly declares `@types/google.maps` and `@types/geojson`.
GeoJSON typings previously arrived transitively through MapLibre.

## Phase 6: road-risk visualization

The municipal crop was reverted at the user's request. Map bounds, unclipped
flood raster and location-selection behavior are restored. The Flood Risk
visibility toggle remains; no boundary masks or municipal data files remain.
The existing point inspector already provides Phase 5's real FSI information.

RoadRiskLayer displays actual `flood_risk` values from the same precomputed
graph used by NetworkX routing, for the selected observed/nowcast time window.
The new read-only `GET /flood/roads/{event_date}` endpoint accepts west/south/
east/north and the existing window/source parameters and returns WGS84 road
GeoJSON. Daily road-risk GeoPackages are not substituted for interval data.
Unavailable graph outputs return 404 and a visible error; risk is never invented.

Roads use the existing Low/Medium/High/Severe blue/yellow/orange/red scale.
The Road Risk checkbox enables viewport loading at zoom 14 or higher. Idle
updates are debounced, previous requests are cancelled, and old features and
listeners are cleaned up. The backend caches two projected graph datasets and
uses a spatial index to select intersecting road geometries. Responses cap at
5,000 features, favor higher risks, and disclose truncation so users can zoom in.
No routing weights, FSI calculation or existing API contracts were modified.

Verification: `npm run build`, `node scripts/verify-google-dashboard.cjs`, and
in the backend directory `.venv/Scripts/python.exe -m unittest tests.test_road_risk`.
The tests compare real graph risks, lengths and projected geometry with the
endpoint and rendered Google Data layer, check viewport selection, invalid
bounds/missing data, zoom gating, removal and existing routes.

## Phases 7–11: routing comparison and map controls

Existing A/B map selection, address inputs and POST /route already covered
Phases 7/8. From/To labels are now explicit and accessible. Coordinate pairs stay
intact after submission so repeat searches use the same point. The existing
geocoder/autocomplete is retained; Google Places activation is optional and
has not been assumed from Maps key availability. Google Routes is not used.

Phase 9 now shares one RouteComparison component across desktop and mobile.
It shows both distances, the normal route's maximum/average FSI and the
tolerance route's maximum FSI, high/severe segment count and distance difference
from actual API fields. Missing tolerance routes are explicitly marked and
existing warnings/suggestions remain. Unsupported tolerance-average FSI and
normal high-risk counts are omitted. The normal/slate and FloodSafe/blue line
swatches match the native route overlays; mobile white-on-white distances are fixed.

Phases 10/11 add a shared four-checkbox Map layers control: Flood Risk, Road
Risk, Traffic and Satellite. TrafficLayer uses Google's native traffic overlay,
retains its instance when toggled and detaches on cleanup. It is current traffic
where supported, even when the selected flood event is historical; the control
states that distinction. Traffic toggles never send routing requests, extract
traffic values or change graph weights. Satellite state stays synchronized with
the existing buttons and Google's map type control. No new packages, backend
changes or environment variables are needed for these phases.

The browser verification checks native traffic attachment, detachment, instance
reuse, zero traffic-triggered routing requests, both satellite controls, real
From/To submission and desktop/mobile comparison metrics and 4.5:1 text contrast,
alongside the existing flood, road-risk, drainage and route tests.

## Phases 12–16: final UI, performance and repository verification

The desktop layout now starts at 1024px. Phones and tablets use the sheet layout
so left/right desktop panels and centered controls do not overlap at narrow
widths. Mobile map-picking mode shows the selected coordinates; address fields
appear only in Address Search mode. Sheet hover text retains the light theme's
contrast. Desktop/mobile route metrics, labels, inputs and dropdowns are checked
at 4.5:1 or higher; desktop, 900px tablet and 390px phone layouts are verified.

Map canvas, flood raster, road risk, routes, traffic, layer controls and route
comparison have separate components. Existing data/state logic stays in the
dashboard; no unrelated application or mobile project was rewritten.

Road GeoJSON now shares the bounded 24-entry, five-minute display cache. Toggling
the same viewport off/on reuses decoded data without another network request.
Stale views are cancelled; shared cache requests may finish for reuse. Refresh,
event, rainfall source and interval changes select fresh data. Roads remain
viewport-filtered at zoom 14 and responses cap at 5,000. Drainage remains filtered
by zoom/viewport; the real full dataset rendered 664 nodes and 670 conduits at
the checked close viewport. Maps and traffic instances survive toggles. No
unmeasured frame-rate or low-end-device performance guarantee is claimed.

`node scripts/check-map-security.cjs` checks source/configuration for hardcoded
Maps keys, server-secret references, runtime MapLibre code and tracked env files.
It confirms local env files are ignored without printing values. Website/API key
restrictions, billing and production CORS require deployment/Cloud configuration;
those external settings were not changed or certified. No server secrets were
moved into Vite. The browser key is public client configuration by design.

Final checks: production build; actual-data dashboard and preview browser tests;
all 18 observed rasters/summaries/point samples and 15/180-minute routes across
three events; missing/invalid outputs and missing-key messaging; source security; raster projection against
2,224,128 Rasterio/GDAL pixels; backend road-risk and drainage-duration regression
tests (six passing tests). The old sampling-cache fixture now uses coordinate
nodes and explicitly represents already segmented input, matching the current
pipeline contract without changing production algorithms. The older interval verification script now accepts valid Low-risk pixels
and checks the current tolerance-route contract instead of retired response fields.

Remaining limits: the real flood output is TIFF, not polygon GeoJSON; southern
Mumbai outside DEM coverage remains unassessed. Google's retired HeatmapLayer
is not recreated with invented polygons. Google Places is optional and existing
address search remains available. Native traffic coverage and Cloud key settings
depend on Google services. The requested crop reversal remains intact.

