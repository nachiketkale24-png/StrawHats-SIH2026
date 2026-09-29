# StrawHats Mumbai Flood Susceptibility — React Native Expo Go Mobile App

A React Native mobile application built with **Expo Go** that mirrors the mobile-responsive web UI of the Mumbai Flood Susceptibility platform, connecting directly to the same FastAPI hydrological & ML backend.

---

## 📱 Features

- **Dark and light themes**: Both use readable surfaces, status messages, and controls; the chosen theme is saved on the phone.
- **Interactive Map**:
  - Center on Mumbai (`19.076° N, 72.878° E`) with custom Night HUD style.
  - Native gesture zooming and panning; the Routes panel can use the device location as a route endpoint.
  - Standard Night Map & Satellite Imagery layer toggle.
- **Flood-Aware Safe Routing**:
  - **Address Search**: Origin (A) & Destination (B) search powered by Nominatim with live autocomplete suggestions.
  - **Quick Presets**: Fast routing to BKC, Dadar, Andheri, Airport (BOM), Kurla, Colaba.
  - **Pick on Map**: Tap origin and destination coordinates directly on the map.
  - **Route Comparison**: Side-by-side comparison between Standard Shortest Route (gray dashed) vs Flood-Aware Safe Route (cyan glowing), displaying distance, flood risk exposure, and risk reduction percentage.
- **Historical Event & Window Selection**:
  - Browse past extreme precipitation events in Mumbai.
  - Switch between accumulation windows (15, 30, 60, 90, 120, 180 mins).
  - Summary stats cards (MIN, MEAN, MAX FSI index).
  - Download raw FSI GeoTIFF files.
- **FSI Coordinate Inspector**:
  - Tap any location on the map to query point-specific Flood Susceptibility Index (FSI) from the ML model with real-time risk ratings and vehicle safety advice.
- **Dynamic In-App Backend Settings**:
  - Configure and test the FastAPI backend URL (e.g. `http://192.168.1.x:8000`) from the Events panel.

---

## 🚀 Getting Started

### 1. Ensure the Backend is Running
From the repository root, start the prototype API in one PowerShell terminal:
```powershell
cd mumbai-flood-prototype
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
```
> **Note**: Binding to `0.0.0.0` allows your physical mobile device on the same local Wi-Fi to connect to the backend.

### 2. Start the Expo Go Development Server
In a second terminal, from `mobile/`:
```powershell
cd mobile
npx expo start
```

### 3. Open on Your Mobile Device
- Install the **Expo Go** app from the Google Play Store or Apple App Store.
- Open Expo Go and scan the QR code displayed in your terminal.
- Connect the phone and PC to the same Wi-Fi network. Open **Events → API server settings** and test `http://<your PC's current Wi-Fi IPv4>:8000`.
- Find the PC address with `ipconfig` (use the **Wi-Fi** adapter IPv4 value). The Expo host suggestion usually fills this automatically.
- The tested URL is saved on the phone. If your PC's Wi-Fi address changes, select the new Expo host suggestion and test again.
- If the phone still cannot reach `/flood/events`, open `http://<PC-IP>:8000/flood/events` in the phone's browser. Check Windows Firewall access for Python and verify the API is listening with `--host 0.0.0.0`.

---

## 📁 Architecture

```
mobile/
├── src/
│   ├── api/
│   │   ├── config.ts         # Base URL config with Expo debugger host auto-detection
│   │   └── floodApi.ts       # Unified API client (events, windows, summary, routes, geocoding)
│   ├── components/
│   │   ├── Header.tsx        # Top HUD header with active model badge & server settings
│   │   ├── BottomTabBar.tsx  # 4-tab mobile dock (Events, Routes, Legend, Inspect)
│   │   ├── EventsSheet.tsx   # Date picker, window selector, FSI stats, GeoTIFF link
│   │   ├── RoutesSheet.tsx   # Address search, presets, pick-on-map, route comparison cards
│   │   ├── LegendSheet.tsx   # FSI color scales and map layer toggles
│   │   ├── InspectSheet.tsx  # Point FSI query and safety guidance
│   │   ├── AddressInput.tsx  # Autocomplete address input with dropdown
│   │   ├── ModeGuide.tsx     # Floating HUD mode helper pill
│   │   ├── StatusToast.tsx   # Floating status, loading, and error toast
│   │   └── SettingsModal.tsx # Backend IP configuration and connection tester
│   ├── constants/
│   │   └── mapStyle.ts       # Custom Night HUD map style for Google Maps
│   ├── hooks/
│   │   └── useFloodData.ts   # Custom state management hook for all API endpoints
│   ├── theme/
│   │   ├── colors.ts         # Dark HUD design tokens and FSI color scales
│   │   └── typography.ts     # Font tokens and platform monospace fallbacks
│   ├── types/
│   │   └── flood.ts          # TypeScript type definitions
│   └── screens/
│       └── MapScreen.tsx     # Main full-screen map & bottom sheet coordinator
├── App.tsx                   # App root with SafeAreaProvider & Status bar
└── package.json
```
