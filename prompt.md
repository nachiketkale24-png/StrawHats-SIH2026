I have an existing SIH 2026 project called FloodSafe — an Urban Flood Susceptibility and Flood-Aware Routing system for Mumbai.

I want you to migrate the existing map frontend from MapLibre to Google Maps JavaScript API.

IMPORTANT:
- This is an EXISTING project. Do not create a new project.
- First inspect the repository and understand the existing frontend/backend architecture.
- Preserve all existing functionality unless a change is necessary for Google Maps integration.
- Do not rewrite the FSI engine, road-risk calculation, NetworkX/Dijkstra routing, or FastAPI backend unnecessarily.
- Remove MapLibre dependencies/code only after identifying what currently depends on them.
- I already have a Google Cloud project and Google Maps API key configured.
- Never hardcode the API key. Use the project's existing environment-variable setup.
- Work incrementally and verify the app after each major change.

CURRENT SYSTEM

Frontend:
- React
- Tailwind CSS
- Currently MapLibre

Backend:
- FastAPI
- PostgreSQL
- GeoPandas
- NetworkX
- momepy
- NumPy

Core pipeline:

Rainfall + DEM + Land Cover
        ↓
Weighted Flood Susceptibility Index (FSI)
        ↓
Spatial flood-risk layer
        ↓
Road-risk attribution
        ↓
OSM road graph
        ↓
NetworkX / Dijkstra
        ↓
Normal route + Flood-aware route
        ↓
Frontend dashboard

The backend already generates geospatial outputs including GeoJSON.

GOAL

Replace MapLibre with Google Maps as the map visualization/interface while keeping our own flood-risk calculation and flood-aware routing algorithms.

Google Maps must NOT replace our NetworkX/Dijkstra flood-aware routing logic.

Google Maps should primarily provide:
1. Base map
2. Map interaction
3. Flood-risk visualization
4. Road-risk visualization
5. Start/destination visualization
6. Normal and flood-safe route visualization
7. Traffic layer
8. Place search/autocomplete if appropriate

Our backend remains responsible for:
- FSI calculation
- Flood-risk classification
- Road-risk attribution
- OSM graph
- Dijkstra routing
- Flood-safe route generation


PHASE 1 — INSPECT EXISTING PROJECT

Before modifying anything:

1. Inspect the complete repository structure.
2. Identify:
   - frontend entry point
   - current MapLibre components
   - map initialization
   - GeoJSON loading
   - current route rendering
   - flood-risk rendering
   - backend API calls
   - environment variable setup
   - existing FSI/risk data format
   - existing routing API
3. Explain briefly which files need to change.
4. Reuse existing components/services wherever possible.
5. Do not change backend contracts unless necessary.


PHASE 2 — GOOGLE MAPS SETUP

Use the current recommended React integration for Google Maps.

Prefer:

@vis.gl/react-google-maps

Install only the dependencies actually required.

Read the API key from an environment variable appropriate for the existing build system.

For example, if this is Vite:

VITE_GOOGLE_MAPS_API_KEY=...

Do NOT expose any server-side secret.

Initialize Google Maps centered approximately on Mumbai.

Initial map requirements:
- responsive full dashboard map
- zoom suitable for Mumbai
- standard road map
- zoom controls
- fullscreen control
- map type control
- clean UI suitable for flood visualization

Do not add unnecessary Google APIs yet.


PHASE 3 — REMOVE MAPLIBRE

Migrate existing MapLibre functionality to Google Maps.

Map every existing MapLibre feature to its Google Maps equivalent.

After Google Maps functionality is confirmed:
- remove unused MapLibre imports
- remove MapLibre CSS
- remove MapLibre initialization
- remove obsolete MapLibre components
- remove MapLibre dependency if nothing else uses it

Do not remove any business logic merely because it currently exists inside a MapLibre component. Extract reusable logic where necessary.


PHASE 4 — FLOOD RISK LAYER

Use the existing backend flood-risk GeoJSON.

Do NOT fabricate flood data.

Render the existing flood-risk geometries on Google Maps.

Risk categories:

Low
Medium
High
Severe

Use clearly distinguishable map styling for these categories.

Read the risk/FSI property from the actual backend GeoJSON rather than assuming a property name. Inspect the data first.

Create a reusable component such as:

FloodRiskLayer.tsx

Responsibilities:
- fetch/use flood-risk GeoJSON
- add it to Google Maps
- style features according to FSI/risk
- efficiently update/clear the layer
- handle loading/error states

Add a map legend showing:

Low
Medium
High
Severe


PHASE 5 — INTERACTIVE FLOOD INFORMATION

Make flood-risk features clickable.

When a user clicks a feature, show an InfoWindow or side-panel containing whatever information actually exists in the backend data, such as:

FSI
Risk category
Rainfall
Elevation
Slope
Land-cover class

IMPORTANT:
Only show fields that actually exist.
Do not invent values.

Design the implementation so additional FSI components can easily be added later.


PHASE 6 — ROAD RISK

Inspect the existing road-risk output.

Render road segments according to their calculated flood risk.

Create something like:

RoadRiskLayer.tsx

Avoid rendering an unnecessarily large number of road features at low zoom levels if this causes performance issues.

If required, implement:
- zoom-dependent visibility
- viewport/bounding-box filtering
- simplified geometries

Do not prematurely optimize if current performance is acceptable.


PHASE 7 — START AND DESTINATION

Provide controls for:

FROM
TO

Support map-click selection first if that is easiest with the current architecture.

Represent start and destination clearly with markers.

Structure the code so Google Places Autocomplete can also be used.

If Places API is already enabled/configured, add autocomplete.

Otherwise keep autocomplete isolated so it can be enabled later without blocking the main migration.


PHASE 8 — EXISTING ROUTING BACKEND

Use the EXISTING FastAPI/NetworkX routing system.

Do NOT replace it with Google Routes API.

The frontend should send the selected start/destination coordinates to the existing routing endpoint.

Inspect the existing endpoint and request schema before changing anything.

Expected conceptual flow:

start + destination
        ↓
FastAPI
        ↓
nearest OSM graph nodes
        ↓
NetworkX
        ↓
normal shortest route
+
flood-aware route
        ↓
GeoJSON/coordinates
        ↓
Google Maps


PHASE 9 — ROUTE VISUALIZATION

Display BOTH:

1. Normal shortest route
2. FloodSafe route

They must be visually distinguishable.

Add a route comparison panel.

Use actual backend values where available:

NORMAL ROUTE
Distance
Maximum/average FSI
Number of high/severe-risk segments

FLOODSAFE ROUTE
Distance
Maximum/average FSI
Number of high/severe-risk segments

Also calculate/display useful comparison information only when supported by actual data, such as:

Additional distance: +X km
High-risk segments avoided: X

Do not fabricate missing metrics.


PHASE 10 — LAYER CONTROLS

Add clean map controls for:

[ ] Flood Risk
[ ] Road Risk
[ ] Traffic
[ ] Satellite

Flood Risk:
our FSI layer

Road Risk:
our road-segment risk layer

Traffic:
Google Maps TrafficLayer

Satellite:
switch Google Maps mapTypeId between roadmap and satellite/hybrid as appropriate.

Layer toggles should not unnecessarily reload the entire map.


PHASE 11 — TRAFFIC

Integrate Google Maps TrafficLayer for visualization.

IMPORTANT:
TrafficLayer should initially be DISPLAY ONLY.

Do not attempt to extract traffic values from the visual TrafficLayer and feed them into NetworkX.

Our flood-aware routing remains based on our existing road-risk algorithm.


PHASE 12 — UI

Preserve the project's existing design language where possible.

Suggested dashboard layout:

-----------------------------------------------------
| FloodSafe                                         |
-----------------------------------------------------
| Route Panel       |                               |
|                   |                               |
| From              |                               |
| To                |       GOOGLE MAP              |
|                   |                               |
| Find Safe Route   |                               |
|                   |                               |
| Normal Route      |                               |
| FloodSafe Route   |                               |
|                   |                               |
| Layer Controls    |                               |
|                   |                               |
-----------------------------------------------------

Do not redesign unrelated pages.

Prioritize:
- readable map
- clear flood-risk visualization
- clear route comparison
- responsive layout
- good loading/error states


PHASE 13 — CODE ORGANIZATION

Do not create one huge map component.

Prefer a structure similar to:

components/
  map/
    FloodMap.tsx
    FloodRiskLayer.tsx
    RoadRiskLayer.tsx
    RouteLayer.tsx
    TrafficLayer.tsx
    LocationMarkers.tsx
    MapLegend.tsx

  routing/
    RoutePanel.tsx
    RouteComparison.tsx

services/
    floodApi.ts
    routingApi.ts

Adapt this to the existing repository instead of blindly creating duplicate abstractions.


PHASE 14 — PERFORMANCE

Our road network contains roughly 70,000 road segments.

Therefore:
- avoid unnecessary React rerenders
- don't recreate the Google Map instance unnecessarily
- don't repeatedly reload unchanged GeoJSON
- clean up overlays/listeners
- consider zoom-dependent road-risk rendering if necessary
- preserve reasonable interaction performance

Do not implement complicated optimization until profiling shows it is necessary.


PHASE 15 — SECURITY

Ensure:
- API key comes from environment variables
- no API key is committed to Git
- .env is ignored
- frontend key is restricted through Google Cloud configuration
- no backend secrets are moved into frontend code


PHASE 16 — VERIFY

After implementation test:

1. Google Maps loads correctly.
2. Mumbai is displayed correctly.
3. Existing flood-risk GeoJSON loads.
4. Risk classes render correctly.
5. Clicking flood features displays correct information.
6. Road-risk segments render.
7. Start can be selected.
8. Destination can be selected.
9. Existing FastAPI routing endpoint is called.
10. Normal route renders.
11. FloodSafe route renders.
12. Route comparison displays actual values.
13. Flood layer toggle works.
14. Road-risk toggle works.
15. Traffic toggle works.
16. Satellite toggle works.
17. Existing backend still works.
18. No MapLibre code remains unless genuinely required.
19. Browser console has no major errors.
20. API key is not hardcoded.

IMPORTANT IMPLEMENTATION RULES

- Do not rewrite working code unnecessarily.
- Do not fabricate API responses.
- Inspect actual backend schemas.
- Preserve our existing FSI algorithm.
- Preserve our existing NetworkX/Dijkstra algorithm.
- Google Maps is the visualization interface, NOT our flood-routing algorithm.
- Make small, testable changes.
- Run/build the project after significant changes.
- Fix TypeScript/build/runtime errors before proceeding.
- If an existing implementation differs from the architecture described above, adapt to the repository rather than blindly forcing this structure.

START NOW WITH ONLY:

1. Inspect the repository.
2. Explain the current map/routing architecture.
3. Identify exactly which MapLibre files/dependencies need migration.
4. Give me the migration plan based on the ACTUAL repository.
5. Then implement Phase 2: get Google Maps rendering successfully.

Do not implement all phases at once.

Once Google Maps renders correctly, stop and report:
- files changed
- dependencies added/removed
- environment variables required
- what currently works
- next phase to implement


[Use the original 16-phase migration prompt as the base structure — inspect
first, phased with a hard stop after Phase 2, preserve backend/routing
untouched, no fabricated data, verify after each phase — with these
modifications:]

DECISIONS LOCKED IN (do not ask about these, just implement):
- NO custom dark map styling. Use Google's standard/default roadmap style.
  A light, minimal style array is fine if it declutters default POI icons
  (restaurants, shops, etc. — not needed for a data dashboard and would
  visually compete with the flood-risk overlays), but do not attempt to
  recreate the previous dark gold/cyan HUD theme on the map itself.
- NO 3D buildings. Do not attempt Photorealistic 3D Tiles or any 3D
  extrusion equivalent — this feature is being dropped, not migrated. Skip
  any phase or sub-step related to it entirely.
- HEATMAP: use google.maps.visualization.HeatmapLayer for the flood-risk
  heatmap (this has a direct built-in equivalent — do not rebuild it as a
  colored polygon grid or anything custom). Load the 'visualization' library
  alongside 'places' when initializing the Maps JS API.
- SURROUNDING UI PANELS (RoutePanel, Legend, drainage summary/toggle,
  forecast time-window slider, risk-tolerance selector): these are React
  components separate from the map renderer. Re-theme them from the current
  dark-glass style to a light-card style — white/near-white background,
  dark text, subtle box-shadow instead of a glow border — to match the
  standard Google Maps look. Do NOT rewrite their data-fetching or business
  logic; this is a CSS/theming pass on components that mostly already work.
  Reuse the same PanelLabel/PanelValue/PanelCaption typography component
  structure already in place, just swap the underlying color tokens.
- Verify text contrast explicitly on the new light theme — this project has
  twice previously shipped invisible/low-contrast text after a light/dark
  theme swap (input text defaulting to black-on-dark, or vice versa); check
  every input, dropdown, and label against the new light background before
  calling this done.

PHASE 2 SPECIFICS:
- Initialize the map with mapTypeControl, zoomControl, fullscreenControl,
  streetViewControl: false (not needed for this use case), and a minimal
  styles array only for POI decluttering as described above — otherwise
  default Google styling.
- Confirm the risk-overlay color scale (Low/Medium/High/Severe -
  blue/yellow/orange/red per the existing legend) still reads clearly
  against the lighter default basemap — this combination hasn't been tested
  before, since the project's only prior light-basemap attempt used CARTO
  Positron with a different color scale; check that low-risk blue in
  particular doesn't wash out.

[Then follow the original prompt's Phase 3 onward as written, applying
these decisions throughout rather than the dark-theme/3D-building
instructions implied by "preserve existing design language" in the original
Phase 12 — the design language being preserved is the layout structure and
information hierarchy, not the dark color scheme, which is intentionally
changing.]