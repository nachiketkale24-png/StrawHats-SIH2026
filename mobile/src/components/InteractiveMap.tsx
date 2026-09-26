/**
 * Interactive Leaflet/CARTO Dark Map for Expo Go Mobile App.
 * Features:
 * - Real-time GeoTIFF raster decoding using GeoTIFF.js with cache busting
 * - Dynamic color-coded FSI susceptibility heatmap overlay across historical events and accumulation windows
 * - Drainage Network layer:
 *   • Surcharged, strained, and normal conduit pipes with capacity utilization colors
 *   • Flow direction indicator arrows
 *   • Manhole nodes with detailed hydraulic inspection popups
 * - Flood-aware vs Shortest path polyline routes
 * - Pixel-perfect pin targeting with teardrop pointer needles (A & B) and crosshairs
 * - Full bi-directional touch interaction
 */
import React, { useRef, useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import { WebView } from 'react-native-webview'
import type {
  RoutePoint,
  RainfallSource,
  RiskTolerance,
  DrainageResponse,
} from '../types/flood'
import type { RouteComparison } from '../api/floodApi'
import { getApiBase, CARTO_API_KEY } from '../api/config'
import { Colors } from '../theme'

interface InteractiveMapProps {
  mapType: 'standard' | 'satellite'
  event: string
  minutes?: number
  rainfallSource?: RainfallSource
  riskTolerance?: RiskTolerance
  start: RoutePoint | null
  end: RoutePoint | null
  inspectCoord: RoutePoint | null
  routes: RouteComparison | null
  drainageData: DrainageResponse | null
  showFullDrainage: boolean
  onMapPress: (coord: { latitude: number; longitude: number }) => void
}

export function InteractiveMap({
  mapType,
  event,
  minutes,
  rainfallSource = 'observed',
  riskTolerance = 'low',
  start,
  end,
  inspectCoord,
  routes,
  drainageData,
  showFullDrainage,
  onMapPress,
}: InteractiveMapProps) {
  const webViewRef = useRef<WebView>(null)
  const apiBase = getApiBase()

  const normalRouteCoords =
    routes?.normal_route?.coordinates?.map(([lon, lat]) => [lat, lon]) ?? []
  const floodRouteCoords =
    (routes?.tolerance_route?.coordinates ||
      routes?.flood_aware_route?.coordinates)?.map(([lon, lat]) => [lat, lon]) ?? []

  // Send update payload whenever state changes
  useEffect(() => {
    const updateData = {
      apiBase,
      event,
      minutes,
      rainfallSource,
      riskTolerance,
      mapType,
      start: start ? [start.lat, start.lng] : null,
      end: end ? [end.lat, end.lng] : null,
      inspectCoord: inspectCoord ? [inspectCoord.lat, inspectCoord.lng] : null,
      normalRoute: normalRouteCoords,
      floodRoute: floodRouteCoords,
      drainageData: drainageData || null,
      showFullDrainage,
      timestamp: Date.now(),
    }
    webViewRef.current?.postMessage(
      JSON.stringify({ type: 'UPDATE_DATA', payload: updateData })
    )
  }, [
    apiBase,
    event,
    minutes,
    rainfallSource,
    riskTolerance,
    mapType,
    start,
    end,
    inspectCoord,
    routes,
    drainageData,
    showFullDrainage,
  ])

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
    
    /* Reset Leaflet default div-icon background and borders */
    .leaflet-div-icon {
      background: transparent !important;
      border: none !important;
    }
    
    /* Teardrop Pin Styles */
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

    /* Flow Arrow Marker */
    .flow-arrow-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
    }
    .flow-arrow-svg {
      width: 14px;
      height: 14px;
      fill: #ffffff;
      filter: drop-shadow(0 1px 2px rgba(0,0,0,0.8));
    }

    /* Leaflet Popup styling */
    .leaflet-popup-content-wrapper {
      background: rgba(10, 14, 26, 0.92) !important;
      color: #f1f5f9 !important;
      border: 1px solid rgba(212, 175, 55, 0.35) !important;
      backdrop-filter: blur(12px) !important;
      border-radius: 10px !important;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.7) !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-size: 12px !important;
    }
    .leaflet-popup-tip {
      background: rgba(10, 14, 26, 0.92) !important;
    }
    .popup-badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 700;
      font-size: 10px;
      text-transform: uppercase;
      margin-top: 4px;
    }
    .badge-surcharged { background: rgba(239, 68, 68, 0.25); color: #ef4444; border: 1px solid #ef4444; }
    .badge-strained { background: rgba(245, 158, 11, 0.25); color: #f59e0b; border: 1px solid #f59e0b; }
    .badge-normal { background: rgba(16, 185, 129, 0.25); color: #10b981; border: 1px solid #10b981; }
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

    var cartoKey = '${CARTO_API_KEY}';
    var darkLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}@2x.png?key=' + encodeURIComponent(cartoKey), {
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

    // Drainage Layer Groups
    var drainageEdgesLayer = L.layerGroup().addTo(map);
    var drainageArrowsLayer = L.layerGroup().addTo(map);
    var drainageNodesLayer = L.layerGroup().addTo(map);

    var currentRasterKey = '';
    var currentDrainageKey = '';
    var FSI_COLORS = ['#38bdf8', '#facc15', '#fb923c', '#ef4444'];

    map.on('click', function(e) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'MAP_CLICK',
        lat: e.latlng.lat,
        lng: e.latlng.lng
      }));
    });

    function calculateBearing(start, end) {
      var rad = Math.PI / 180;
      var lat1 = start[0] * rad;
      var lat2 = end[0] * rad;
      var dLng = (end[1] - start[1]) * rad;
      var y = Math.sin(dLng) * Math.cos(lat2);
      var x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
      var brng = Math.atan2(y, x) / rad;
      return (brng + 360) % 360;
    }

    async function ensureGeoTIFF() {
      if (window.GeoTIFF) return window.GeoTIFF;
      for (var i = 0; i < 25; i++) {
        await new Promise(function(resolve) { setTimeout(resolve, 200); });
        if (window.GeoTIFF) return window.GeoTIFF;
      }
      return null;
    }

    async function loadFloodRaster(apiBase, eventDate, minutes, rainfallSource) {
      if (!apiBase || !eventDate) return;
      var src = rainfallSource || 'observed';
      var key = apiBase + '_' + eventDate + '_' + (minutes !== undefined ? minutes : '15') + '_' + src;
      if (key === currentRasterKey && floodRasterOverlay) return;

      var geotiffLib = await ensureGeoTIFF();
      if (!geotiffLib) return;

      var url = apiBase + '/flood/raster/' + encodeURIComponent(eventDate);
      var params = [];
      if (minutes !== undefined) params.push('window_minutes=' + encodeURIComponent(minutes));
      if (src) params.push('rainfall_source=' + encodeURIComponent(src));
      params.push('_cb=' + Date.now());
      url += '?' + params.join('&');

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

    function renderDrainageNetwork(data, showFull) {
      drainageEdgesLayer.clearLayers();
      drainageArrowsLayer.clearLayers();
      drainageNodesLayer.clearLayers();

      if (!data) return;

      var manholes = data.manholes ? data.manholes.features : [];
      var conduits = data.conduits ? data.conduits.features : [];

      // 1. Render Conduits (Pipes)
      for (var i = 0; i < conduits.length; i++) {
        var feat = conduits[i];
        var coords = feat.geometry.coordinates;
        if (!coords || coords.length < 2) continue;

        var latlngs = coords.map(function(c) { return [c[1], c[0]]; });
        var p = feat.properties;
        var ratio = p.surcharge_ratio !== null && p.surcharge_ratio !== undefined ? p.surcharge_ratio : 0;
        var surcharged = !!p.surcharged;
        var isStrained = ratio > 0.5 && !surcharged;

        // Skip normal conduits if not full network
        if (!showFull && !surcharged && !isStrained) continue;

        var lineColor = surcharged ? '#ef4444' : isStrained ? '#f59e0b' : '#10b981';
        var lineWeight = surcharged ? 3.5 : isStrained ? 3 : 1.8;
        var lineOpacity = surcharged ? 0.95 : isStrained ? 0.85 : 0.45;
        var dash = ratio > 0.85 || surcharged ? '5, 5' : null;

        var polyline = L.polyline(latlngs, {
          color: lineColor,
          weight: lineWeight,
          opacity: lineOpacity,
          dashArray: dash,
          zIndexOffset: 15
        });

        var popupContent = '<div style="line-height: 1.4;">' +
          '<b>Conduit #' + p.id + '</b><br/>' +
          'From: ' + p.fromNodeId + ' → To: ' + p.toNodeId + '<br/>' +
          (p.q_in_m3s !== null ? 'Flow: ' + p.q_in_m3s.toFixed(2) + ' m³/s<br/>' : '') +
          (p.capacity_m3s !== null ? 'Capacity: ' + p.capacity_m3s.toFixed(2) + ' m³/s<br/>' : '') +
          '<span class="popup-badge ' + (surcharged ? 'badge-surcharged' : isStrained ? 'badge-strained' : 'badge-normal') + '">' +
          (surcharged ? 'SURCHARGING' : isStrained ? 'STRAINED (' + Math.round(ratio * 100) + '%)' : 'NORMAL') +
          '</span></div>';

        polyline.bindPopup(popupContent);
        drainageEdgesLayer.addLayer(polyline);

        // Flow Direction Arrow
        if (surcharged || isStrained || showFull) {
          var startPt = latlngs[0];
          var endPt = latlngs[latlngs.length - 1];
          var midLat = (startPt[0] + endPt[0]) / 2;
          var midLng = (startPt[1] + endPt[1]) / 2;
          var deg = calculateBearing(startPt, endPt);

          var arrowIcon = L.divIcon({
            className: 'flow-arrow-icon',
            html: '<div style="transform: rotate(' + deg + 'deg);"><svg class="flow-arrow-svg" viewBox="0 0 24 24"><polygon points="12,2 22,22 12,17 2,22"/></svg></div>',
            iconSize: [16, 16],
            iconAnchor: [8, 8]
          });

          var arrowMarker = L.marker([midLat, midLng], {
            icon: arrowIcon,
            interactive: false,
            zIndexOffset: 16
          });
          drainageArrowsLayer.addLayer(arrowMarker);
        }
      }

      // 2. Render Manholes (Nodes)
      for (var j = 0; j < manholes.length; j++) {
        var mFeat = manholes[j];
        var mCoords = mFeat.geometry.coordinates;
        if (!mCoords) continue;

        var mLat = mCoords[1];
        var mLng = mCoords[0];
        var mp = mFeat.properties;
        var mSurcharged = !!mp.surcharged;
        var mRatio = mp.surcharge_ratio !== null && mp.surcharge_ratio !== undefined ? mp.surcharge_ratio : 0;
        var mStrained = mRatio > 0.5 && !mSurcharged;

        if (!showFull && !mSurcharged && !mStrained) continue;

        var nodeColor = mSurcharged ? '#ef4444' : mStrained ? '#f59e0b' : '#10b981';
        var nodeRadius = mSurcharged ? 6 : mStrained ? 5 : 3;
        var nodeOpacity = mSurcharged ? 1 : mStrained ? 0.9 : 0.4;

        var circle = L.circleMarker([mLat, mLng], {
          radius: nodeRadius,
          color: '#04040a',
          weight: 1.5,
          fillColor: nodeColor,
          fillOpacity: nodeOpacity,
          zIndexOffset: 20
        });

        var mPopup = '<div style="line-height: 1.4;">' +
          '<b>Manhole #' + mp.id + '</b><br/>' +
          (mp.ground_elev !== null ? 'Ground Elev: ' + mp.ground_elev.toFixed(1) + ' m<br/>' : '') +
          (mp.q_in_m3s !== null ? 'Flow: ' + mp.q_in_m3s.toFixed(2) + ' m³/s<br/>' : '') +
          (mp.capacity_m3s !== null ? 'Capacity: ' + mp.capacity_m3s.toFixed(2) + ' m³/s<br/>' : '') +
          '<span class="popup-badge ' + (mSurcharged ? 'badge-surcharged' : mStrained ? 'badge-strained' : 'badge-normal') + '">' +
          (mSurcharged ? 'SURCHARGED' : mStrained ? 'STRAINED' : 'NORMAL') +
          '</span></div>';

        circle.bindPopup(mPopup);
        drainageNodesLayer.addLayer(circle);
      }
    }

    function handleData(data) {
      if (!data) return;

      // Load FSI raster heatmap
      if (data.apiBase && data.event) {
        loadFloodRaster(data.apiBase, data.event, data.minutes, data.rainfallSource);
      }

      // Render Drainage Network
      if (data.drainageData) {
        renderDrainageNetwork(data.drainageData, data.showFullDrainage);
      } else {
        drainageEdgesLayer.clearLayers();
        drainageArrowsLayer.clearLayers();
        drainageNodesLayer.clearLayers();
      }

      // Map style toggle
      if (data.mapType === 'satellite') {
        if (map.hasLayer(darkLayer)) map.removeLayer(darkLayer);
        if (!map.hasLayer(satelliteLayer)) map.addLayer(satelliteLayer);
      } else {
        if (map.hasLayer(satelliteLayer)) map.removeLayer(satelliteLayer);
        if (!map.hasLayer(darkLayer)) map.addLayer(darkLayer);
      }

      // Marker A
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

      // Marker B
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

      // Inspect Marker
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
          rainfallSource,
          riskTolerance,
          mapType,
          start: start ? [start.lat, start.lng] : null,
          end: end ? [end.lat, end.lng] : null,
          inspectCoord: inspectCoord ? [inspectCoord.lat, inspectCoord.lng] : null,
          normalRoute: normalRouteCoords,
          floodRoute: floodRouteCoords,
          drainageData: drainageData || null,
          showFullDrainage,
          timestamp: Date.now(),
        }
        webViewRef.current?.postMessage(
          JSON.stringify({ type: 'UPDATE_DATA', payload: updateData })
        )
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
