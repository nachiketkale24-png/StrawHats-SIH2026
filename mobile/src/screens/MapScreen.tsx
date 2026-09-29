import { useTheme } from '../theme/ThemeProvider'
/**
 * Native Google Maps screen with window-aware flood layers and bottom panels.
 */
import React, { useState, useRef, useEffect } from 'react'
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Alert,
  PanResponder,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'

import { useFloodData } from '../hooks/useFloodData'
import Header from '../components/Header'
import BottomTabBar from '../components/BottomTabBar'
import EventsSheet from '../components/EventsSheet'
import { RoutesSheet } from '../components/RoutesSheet'
import { LegendSheet } from '../components/LegendSheet'
import { InspectSheet } from '../components/InspectSheet'
import StatusToast from '../components/StatusToast'
import ModeGuide from '../components/ModeGuide'
import { SettingsModal } from '../components/SettingsModal'
import MapView from 'react-native-maps'
import { InteractiveMap } from '../components/InteractiveMap'

import { Colors, Fonts } from '../theme'
import type { RoutePoint } from '../types/flood'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')
const SHEET_HEIGHT = Math.min(SCREEN_HEIGHT * 0.58, 480)

export default function MapScreen() {
  const { colors: Colors } = useTheme()
  const styles = makeStyles(Colors)
  const mapRef = useRef<MapView>(null)
  const { satellite, setSatellite } = useTheme()
  const [floodVisible, setFloodVisible] = useState(true)
  const [traffic, setTraffic] = useState(false)
  const [roadsVisible, setRoadsVisible] = useState(false)
  const [mapStatus, setMapStatus] = useState('')

  // Data hook
  const {
    source, setSource, tolerance, setTolerance, drainageMode, setDrainageMode, drainage, drainageError, refresh,
    setApiError,
    events,
    event,
    windows,
    minutes,
    eventsLoading,
    apiError,
    summary,
    mode,
    points,
    routes,
    routeStatus,
    intervalReady,
    selectedMinutes,
    activeWindow,
    disabled,
    start,
    end,
    setMode,
    handleRefresh,
    selectEvent,
    selectMinutes,
    addPoint,
    setRoutePoints,
    clearPoints,
    inspectPoint,
  } = useFloodData()

  // Local UI State - default is full map only (no sheet open)
  const [activeTab, setActiveTab] = useState<'events' | 'routes' | 'legend' | 'inspect' | null>(null)
  const mapType = satellite ? 'satellite' : 'standard'
  const setMapType = (value: 'standard'|'satellite') => setSatellite(value === 'satellite')
  const [settingsVisible, setSettingsVisible] = useState(false)

  // Inspect State
  const [inspectCoord, setInspectCoord] = useState<RoutePoint | null>(null)
  const [inspectFsi, setInspectFsi] = useState<number | null>(null)
  const [inspecting, setInspecting] = useState(false)

  // Sheet Slide Animation
  const sheetAnim = useRef(new Animated.Value(activeTab ? 0 : SHEET_HEIGHT)).current

  useEffect(() => {
    if (activeTab) {
      Animated.spring(sheetAnim, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 0,
        speed: 18,
      }).start()
    } else {
      Animated.timing(sheetAnim, {
        toValue: SHEET_HEIGHT,
        duration: 220,
        useNativeDriver: true,
      }).start()
    }
  }, [activeTab])

  // Slidable PanResponder to drag/swipe down to close sheet
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 4,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          sheetAnim.setValue(gestureState.dy)
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 60 || gestureState.vy > 0.4) {
          Animated.timing(sheetAnim, {
            toValue: SHEET_HEIGHT,
            duration: 200,
            useNativeDriver: true,
          }).start(() => setActiveTab(null))
        } else {
          Animated.spring(sheetAnim, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 3,
            speed: 16,
          }).start()
        }
      },
    })
  ).current

  // Map Press Handler
  const handleMapPress = async ({ latitude, longitude }: { latitude: number; longitude: number }) => {
    if (mode === 'inspect') {
      setInspectCoord({ lat: latitude, lng: longitude })
      setActiveTab('inspect')
    } else if (mode === 'route') {
      addPoint({ lat: latitude, lng: longitude })
      if (points.length === 1) {
        // Point B picked -> switch back to Routes tab to view comparison
        setActiveTab('routes')
      }
    }
  }

  useEffect(() => {
    let active = true
    setInspectFsi(null)
    if (!inspectCoord) { setInspecting(false); return }
    setInspecting(true)
    inspectPoint(inspectCoord.lng, inspectCoord.lat).then(result => {
      if (active) { setInspectFsi(result?.fsi ?? null); setInspecting(false) }
    })
    return () => { active = false }
  }, [inspectCoord, inspectPoint])
  useEffect(() => {
    const line = routes?.tolerance_route?.coordinates ?? routes?.suggested_route?.coordinates ?? routes?.normal_route.coordinates
    if (line?.length) mapRef.current?.fitToCoordinates(line.map(([longitude, latitude]) => ({ latitude, longitude })), { edgePadding: { top: 90, bottom: 120, left: 40, right: 40 }, animated: true })
  }, [routes])
  // A suggested route is a higher-risk preview, accepted only by the user.
  useEffect(() => {
    if (!routes?.tolerance_route && routes?.suggested_route) {
      const suggestion = routes.suggested_route
      Alert.alert('A route is available at higher risk', `No connected route meets ${tolerance} tolerance. ${suggestion.risk_tolerance} tolerance offers ${(suggestion.length_m / 1000).toFixed(2)} km with maximum FSI ${suggestion.max_risk.toFixed(3)}. The amber route is a preview.`, [
        { text: 'Keep tolerance', style: 'cancel' },
        { text: `Use ${suggestion.risk_tolerance}`, onPress: () => setTolerance(suggestion.risk_tolerance) },
      ])
    }
  }, [routes])
  return (
    <View style={styles.container}>
      {/* Top Header with Safe Area Inset */}
      <Header />

      {/* Main Map View Container */}
      <View style={styles.mapWrapper}>
        <InteractiveMap
          ref={mapRef}
          source={source} refresh={refresh} floodVisible={floodVisible} traffic={traffic} roadsVisible={roadsVisible}
          drainage={drainage} drainageMode={drainageMode} onStatus={setMapStatus}
          mapType={mapType}
          event={intervalReady ? event : ''}
          minutes={selectedMinutes}
          start={start ?? null}
          end={end ?? null}
          inspectCoord={inspectCoord}
          routes={routes}
          onMapPress={handleMapPress}
        />

        {/* Floating Top Mode Guide Pill */}
        <ModeGuide
          mode={mode}
          pointCount={points.length}
          onClearMode={() => {
            setMode('inspect')
            clearPoints()
          }}
        />

        {/* Match the web mobile map's single floating view button. */}
        <View style={styles.mapControls}>
          <TouchableOpacity
            style={styles.controlBtn}
            onPress={() => setMapType(mapType === 'standard' ? 'satellite' : 'standard')}
            activeOpacity={0.7}
            accessibilityLabel="Toggle satellite view"
          >
            <Ionicons
              name={mapType === 'standard' ? 'earth-outline' : 'map-outline'}
              size={17}
              color={Colors.textPrimary}
            />
          </TouchableOpacity>

        </View>

        {/* Floating Status / Error Banner */}
        <StatusToast
          loading={eventsLoading}
          error={apiError}
          routeStatus={routeStatus || mapStatus}
          onDismissError={() => setApiError('')}
        />

        {/* Sliding Bottom Sheet Container with PanResponder */}
        <Animated.View
          style={[
            styles.bottomSheet,
            {
              transform: [{ translateY: sheetAnim }],
            },
          ]}
        >
          {/* Sheet Handle Bar - Swipe / Drag down to close */}
          <TouchableOpacity accessibilityLabel="Close panel" onPress={() => setActiveTab(null)} style={{ position: 'absolute', right: 14, top: 6, zIndex: 2, padding: 6 }}><Ionicons name="chevron-down" size={20} color={Colors.textSecondary} /></TouchableOpacity>
          <View {...panResponder.panHandlers} style={styles.sheetHandleWrap}>
            <View style={styles.sheetHandle} />
          </View>

          {/* Tab Specific Content */}
          <View style={styles.sheetBody}>
            {activeTab === 'events' && (
              <EventsSheet
                source={source} onSource={setSource}
                events={events}
                event={event}
                eventsLoading={eventsLoading}
                windows={windows}
                minutes={minutes}
                activeWindow={activeWindow}
                summary={summary}
                intervalReady={intervalReady}
                selectedMinutes={selectedMinutes}
                disabled={disabled}
                onSelectEvent={selectEvent}
                onSelectMinutes={selectMinutes}
                onRefresh={handleRefresh}
                onOpenSettings={() => setSettingsVisible(true)}
              />
            )}

            {activeTab === 'routes' && (
              <RoutesSheet
                tolerance={tolerance} onTolerance={setTolerance}
                routeMode={mode}
                onSelectRouteMode={(m) => setMode(m)}
                routeStart={start ?? null}
                routeEnd={end ?? null}
                routeComparison={routes}
                isRouting={!!routeStatus && !routes}
                routeError={routeStatus.startsWith('Route unavailable') ? routeStatus : null}
                onComputeRoute={(s, e) => setRoutePoints(s, e)}
                onClearRoute={clearPoints}
                onDismiss={() => setActiveTab(null)}
              />
            )}

            {activeTab === 'legend' && (
              <LegendSheet
                floodVisible={floodVisible} onFlood={setFloodVisible} traffic={traffic} onTraffic={setTraffic}
                roadsVisible={roadsVisible} onRoads={setRoadsVisible} drainage={drainage} drainageError={drainageError}
                drainageMode={drainageMode} onDrainageMode={setDrainageMode}
                mapType={mapType}
                onToggleMapType={() =>
                  setMapType(mapType === 'standard' ? 'satellite' : 'standard')
                }
              />
            )}

            {activeTab === 'inspect' && (
              <InspectSheet
                inspectPoint={inspectCoord}
                inspectFsi={inspectFsi}
                loadingFsi={inspecting}
                onClearInspect={() => {
                  setInspectCoord(null)
                  setInspectFsi(null)
                }}
                onDismiss={() => setActiveTab(null)}
              />
            )}
          </View>
        </Animated.View>
      </View>

      {/* Bottom navigation mirrors the web mobile layout. */}
      <View style={styles.bottomDock}>
        <BottomTabBar
          activeTab={activeTab}
          onSelectTab={(tab) => {
            if (activeTab === tab) {
              setActiveTab(null)
            } else {
              setActiveTab(tab)
              if (tab === 'inspect') setMode('inspect')
              if (tab === 'routes' && mode === 'inspect') setMode('route-address')
            }
          }}
        />
      </View>

      {/* Backend IP Settings Modal */}
      <SettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        onSuccess={handleRefresh}
      />
    </View>
  )
}

const makeStyles = (Colors: ReturnType<typeof useTheme>["colors"]) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgVoid,
  },
  mapWrapper: {
    flex: 1,
    width: '100%',
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: Colors.bgVoid,
  },
  mapControls: {
    position: 'absolute',
    top: 52,
    right: 12,
    gap: 8,
    zIndex: 20,
  },
  controlBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.bgPanel,
    borderWidth: 1,
    borderColor: Colors.borderPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 8,
  },
  collapsePill: {
    position: 'absolute',
    top: 52,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.bgPanel,
    borderWidth: 1,
    borderColor: Colors.borderActive,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  collapsePillText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 10,
    color: Colors.goldLight,
  },
  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: SHEET_HEIGHT,
    backgroundColor: Colors.bgVoid,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: Colors.borderPrimary,
    zIndex: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.7,
    shadowRadius: 24,
    elevation: 30,
  },
  sheetHandleWrap: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.gold,
    opacity: 0.45,
  },
  sheetBody: {
    flex: 1,
    paddingHorizontal: 4,
  },
  bottomDock: {
    backgroundColor: Colors.bgVoid,
  },
})
