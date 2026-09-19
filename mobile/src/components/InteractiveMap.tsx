/**
 * Interactive Leaflet/CARTO Dark Map for Expo Go.
 * Features:
 * - Pixel-perfect pin targeting with teardrop pointer needles (A & B) and crosshairs
 * - Real-time GeoTIFF raster decoding using GeoTIFF.js with cache busting
 * - Dynamic color-coded FSI susceptibility heatmap overlay across historical events and accumulation windows
 * - Flood-aware vs Shortest path polyline routes
 * - Full bi-directional touch interaction
 */
import React, { useRef, useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import { WebView } from 'react-native-webview'
import type { RoutePoint } from '../types/flood'
import type { RouteComparison } from '../api/floodApi'
import { getApiBase } from '../api/config'
import { Colors } from '../theme'

interface InteractiveMapProps {
  mapType: 'standard' | 'satellite'
  event: string
  minutes?: number
  start: RoutePoint | null
  end: RoutePoint | null
  inspectCoord: RoutePoint | null
  routes: RouteComparison | null
  onMapPress: (coord: { latitude: number; longitude: number }) => void
}

export function InteractiveMap({
  mapType,
  event,
  minutes,
  start,
  end,
  inspectCoord,
  routes,
  onMapPress,
}: InteractiveMapProps) {
  const webViewRef = useRef<WebView>(null)
  const apiBase = getApiBase()

  const normalRouteCoords =
    routes?.normal_route.coordinates.map(([lon, lat]) => [lat, lon]) ?? []
  const floodRouteCoords =
    routes?.flood_aware_route.coordinates.map(([lon, lat]) => [lat, lon]) ?? []

  // Send update payload whenever state changes
  useEffect(() => {
    const updateData = {
      apiBase,
      event,
      minutes,
      mapType,
      start: start ? [start.lat, start.lng] : null,
      end: end ? [end.lat, end.lng] : null,
      inspectCoord: inspectCoord ? [inspectCoord.lat, inspectCoord.lng] : null,
      normalRoute: normalRouteCoords,
      floodRoute: floodRouteCoords,
      timestamp: Date.now(),
    }
    webViewRef.current?.postMessage(JSON.stringify({ type: 'UPDATE_DATA', payload: updateData }))
  }, [apiBase, event, minutes, mapType, start, end, inspectCoord, routes])

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/geotiff@2.0.7/dist-browser/geotiff.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; background: #04040a; }
    .leaflet-container { background: #04040a !important; }
    .leaflet-control-attribution { display: none !important; }
    
    /* Reset Leaflet's default div-icon background and borders */
    .leaflet-div-icon {
      background: transparent !important;
      border: none !important;
    }
    
    /* Pixel-Perfect Teardrop Pin Styles */
    .pin-wrap {
      position: relative;
      width: 30px;
      height: 38px;
      display: flex;
      flex-direction: column;
      align-items: center;
      filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.7));
    }
    .pin-head {
      width: 26px;
      height: 26px;
      border-radius: 13px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: monospace;
      font-size: 13px;
      font-weight: 900;
      color: #04040a;
      border: 2px solid #ffffff;
      z-index: 2;
    }
    .pin-a .pin-head { background: #10b981; }
    .pin-b .pin-head { background: #00e5ff; }
    .pin-point {
      width: 0;
      height: 0;
      border-left: 5px solid transparent;
      border-right: 5px solid transparent;
      margin-top: -3px;
      z-index: 1;
    }
    .pin-a .pin-point { border-top: 10px solid #10b981; }
    .pin-b .pin-point { border-top: 10px solid #00e5ff; }
    .pin-ground-dot {
      position: absolute;
      bottom: 0;
      width: 6px;
      height: 6px;
      border-radius: 3px;
      background: #ffffff;
      box-shadow: 0 0 6px rgba(255,255,255,0.9);
    }
    
    /* Inspect Crosshair Pin */
    .inspect-crosshair {
      position: relative;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .inspect-circle {
      width: 20px;
      height: 20px;
      border-radius: 10px;
      border: 2px solid #d4af37;
      background: rgba(212, 175, 55, 0.25);
      box-shadow: 0 0 10px #d4af37;
    }
    .inspect-center-dot {
      position: absolute;
      width: 4px;
      height: 4px;
      border-radius: 2px;
      background: #ffffff;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', {
      center: [19.0760, 72.8777],
      zoom: 12,
      zoomControl: false,
      attributionControl: false
    });

    var darkLayer = L.tileLayer('https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png', {
      maxZoom: 19,
      subdomains: 'abcd'
    }).addTo(map);

    var satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 18
    });

    var markerA = null;
    var markerB = null;
    var markerInspect = null;
    var normalPolyline = null;
    var floodPolyline = null;
    var floodRasterOverlay = null;

    var currentRasterKey = '';
    var FSI_COLORS = ['#38bdf8', '#facc15', '#fb923c', '#ef4444'];

    map.on('click', function(e) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'MAP_CLICK',
        lat: e.latlng.lat,
        lng: e.latlng.lng
      }));
    });

    async function ensureGeoTIFF() {
      if (window.GeoTIFF) return window.GeoTIFF;
      for (var i = 0; i < 25; i++) {
        await new Promise(function(resolve) { setTimeout(resolve, 200); });
        if (window.GeoTIFF) return window.GeoTIFF;
      }
      return null;
    }

    async function loadFloodRaster(apiBase, eventDate, minutes) {
      if (!apiBase || !eventDate) return;
      var key = apiBase + '_' + eventDate + '_' + (minutes !== undefined ? minutes : '15');
      if (key === currentRasterKey && floodRasterOverlay) return;

      var geotiffLib = await ensureGeoTIFF();
      if (!geotiffLib) return;

      var url = apiBase + '/flood/raster/' + encodeURIComponent(eventDate);
      if (minutes !== undefined) {
        url += '?window_minutes=' + encodeURIComponent(minutes);
      }
      url += (url.includes('?') ? '&' : '?') + '_cb=' + Date.now();

      try {
        var response = await fetch(url, { cache: 'no-cache' });
        if (!response.ok) return;
        var arrayBuffer = await response.arrayBuffer();
        var tiff = await geotiffLib.fromArrayBuffer(arrayBuffer);
        var image = await tiff.getImage();
        var width = image.getWidth();
        var height = image.getHeight();
        var rasters = await image.readRasters({ samples: [0], interleave: true });
        var values = rasters;
        var bbox = image.getBoundingBox(); // [west, south, east, north]
        var west = bbox[0], south = bbox[1], east = bbox[2], north = bbox[3];
        var nodata = image.getGDALNoData();

        var canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        var ctx = canvas.getContext('2d');
        var imgData = ctx.createImageData(width, height);

        for (var i = 0; i < width * height; i++) {
          var val = Number(values[i]);
          if (!Number.isFinite(val) || val === nodata || val < 0.02 || val > 1) {
            imgData.data[i * 4 + 3] = 0;
            continue;
          }
          var colorIdx = Math.min(3, Math.floor(val * 4));
          var color = FSI_COLORS[colorIdx];
          imgData.data[i * 4] = parseInt(color.slice(1, 3), 16);
          imgData.data[i * 4 + 1] = parseInt(color.slice(3, 5), 16);
          imgData.data[i * 4 + 2] = parseInt(color.slice(5, 7), 16);
          imgData.data[i * 4 + 3] = val < 0.25 ? 90 : val < 0.5 ? 140 : 190;
        }

        ctx.putImageData(imgData, 0, 0);
        var dataUrl = canvas.toDataURL();

        if (floodRasterOverlay) {
          map.removeLayer(floodRasterOverlay);
          floodRasterOverlay = null;
        }

        floodRasterOverlay = L.imageOverlay(dataUrl, [[south, west], [north, east]], {
          opacity: 0.85,
          zIndex: 10
        }).addTo(map);

        currentRasterKey = key;

      } catch (err) {
        console.error('Failed to render flood raster:', err);
      }
    }

    function handleData(data) {
      if (!data) return;

      // Load FSI raster heatmap
      if (data.apiBase && data.event) {
        loadFloodRaster(data.apiBase, data.event, data.minutes);
      }

      // Map style toggle
      if (data.mapType === 'satellite') {
        if (map.hasLayer(darkLayer)) map.removeLayer(darkLayer);
        if (!map.hasLayer(satelliteLayer)) map.addLayer(satelliteLayer);
      } else {
        if (map.hasLayer(satelliteLayer)) map.removeLayer(satelliteLayer);
        if (!map.hasLayer(darkLayer)) map.addLayer(darkLayer);
      }

      // Marker A (Teardrop needle pointing directly to bottom pixel [15, 34])
      if (markerA) map.removeLayer(markerA);
      if (data.start) {
        var iconA = L.divIcon({
          className: 'leaflet-div-icon',
          html: '<div class="pin-wrap pin-a"><div class="pin-head">A</div><div class="pin-point"></div><div class="pin-ground-dot"></div></div>',
          iconSize: [30, 38],
          iconAnchor: [15, 34]
        });
        markerA = L.marker(data.start, { icon: iconA, zIndexOffset: 200 }).addTo(map);
      }

      // Marker B (Teardrop needle pointing directly to bottom pixel [15, 34])
      if (markerB) map.removeLayer(markerB);
      if (data.end) {
        var iconB = L.divIcon({
          className: 'leaflet-div-icon',
          html: '<div class="pin-wrap pin-b"><div class="pin-head">B</div><div class="pin-point"></div><div class="pin-ground-dot"></div></div>',
          iconSize: [30, 38],
          iconAnchor: [15, 34]
        });
        markerB = L.marker(data.end, { icon: iconB, zIndexOffset: 200 }).addTo(map);
      }

      // Inspect Marker (Crosshair with exact center bullseye dot at [14, 14])
      if (markerInspect) map.removeLayer(markerInspect);
      if (data.inspectCoord) {
        var iconInsp = L.divIcon({
          className: 'leaflet-div-icon',
          html: '<div class="inspect-crosshair"><div class="inspect-circle"></div><div class="inspect-center-dot"></div></div>',
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        });
        markerInspect = L.marker(data.inspectCoord, { icon: iconInsp, zIndexOffset: 250 }).addTo(map);
      }

      // Normal Route Polyline
      if (normalPolyline) map.removeLayer(normalPolyline);
      if (data.normalRoute && data.normalRoute.length > 0) {
        normalPolyline = L.polyline(data.normalRoute, {
          color: '#94a3b8',
          weight: 4,
          dashArray: '6, 6',
          opacity: 0.8,
          zIndexOffset: 50
        }).addTo(map);
      }

      // Flood-Aware Safe Route Polyline
      if (floodPolyline) map.removeLayer(floodPolyline);
      if (data.floodRoute && data.floodRoute.length > 0) {
        floodPolyline = L.polyline(data.floodRoute, {
          color: '#00e5ff',
          weight: 6,
          opacity: 0.95,
          zIndexOffset: 60
        }).addTo(map);
      }
    }

    function onMessage(e) {
      try {
        var msg = JSON.parse(e.data);
        if (msg.type === 'UPDATE_DATA') {
          handleData(msg.payload);
        } else if (msg.type === 'ZOOM_IN') {
          map.zoomIn();
        } else if (msg.type === 'ZOOM_OUT') {
          map.zoomOut();
        } else if (msg.type === 'RECENTER') {
          map.setView([19.0760, 72.8777], 12);
        } else if (msg.type === 'FLY_TO') {
          map.flyTo([msg.lat, msg.lng], msg.zoom || 14);
        }
      } catch (err) {}
    }

    document.addEventListener('message', onMessage);
    window.addEventListener('message', onMessage);

    // Notify React Native that map is ready
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MAP_READY' }));
  </script>
</body>
</html>
  `

  const handleMessage = (e: any) => {
    try {
      const data = JSON.parse(e.nativeEvent.data)
      if (data.type === 'MAP_CLICK') {
        onMapPress({ latitude: data.lat, longitude: data.lng })
      } else if (data.type === 'MAP_READY') {
        const updateData = {
          apiBase,
          event,
          minutes,
          mapType,
          start: start ? [start.lat, start.lng] : null,
          end: end ? [end.lat, end.lng] : null,
          inspectCoord: inspectCoord ? [inspectCoord.lat, inspectCoord.lng] : null,
          normalRoute: normalRouteCoords,
          floodRoute: floodRouteCoords,
          timestamp: Date.now(),
        }
        webViewRef.current?.postMessage(JSON.stringify({ type: 'UPDATE_DATA', payload: updateData }))
      }
    } catch {}
  }

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: htmlContent }}
        style={styles.webview}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        overScrollMode="never"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.bgVoid,
  },
  webview: {
    flex: 1,
    backgroundColor: Colors.bgVoid,
  },
})
