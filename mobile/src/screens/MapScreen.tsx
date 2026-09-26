/**
 * Main Map Screen for Mumbai Flood Susceptibility Mobile App.
 * Complete feature parity with web dashboard:
 * - Real-time FSI heatmaps
 * - Drainage network conduits, manholes, flow vectors, and full network toggles
 * - Observed vs AI/Nowcast rainfall sources
 * - Risk tolerance routing (low, balanced, fastest)
 * - Address geocoding, pin targeting, and coordinate inspection
 */
import React, { useState, useRef, useEffect } from 'react'
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Animated,
  Dimensions,
  Alert,
  PanResponder,
  ActivityIndicator,
} from 'react-native'
import * as Location from 'expo-location'
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

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
import { InteractiveMap } from '../components/InteractiveMap'

import { Colors, Fonts } from '../theme'
import type { RoutePoint } from '../types/flood'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')
const SHEET_HEIGHT = Math.min(SCREEN_HEIGHT * 0.72, 580)

export default function MapScreen() {
  const insets = useSafeAreaInsets()
  const mapRef = useRef<any>(null)

  // Data hook
  const {
    events,
    event,
    rainfallSource,
    windows,
    minutes,
    eventsLoading,
    apiError,
    summary,
    mode,
    points,
    routes,
    routeStatus,
    riskTolerance,
    drainageData,
    drainageStatus,
    showFullDrainage,
    showAffectedDrainage,
    drainageSummary,
    intervalReady,
    selectedMinutes,
    activeWindow,
    disabled,
    start,
    end,
    isWindowLoading,
    rasterLoading,
    isTimeLoading,
    handleRasterLoadingChange,
    setMode,
    setRainfallSource,
    setRiskTolerance,
    toggleFullDrainage,
    toggleAffectedDrainage,
    handleRefresh,
    selectEvent,
    selectMinutes,
    addPoint,
    setRoutePoints,
    clearPoints,
    inspectPoint,
  } = useFloodData()

  // Local UI State
  const [activeTab, setActiveTab] = useState<
    'events' | 'routes' | 'legend' | 'inspect' | null
  >(null)
  const [mapType, setMapType] = useState<'standard' | 'satellite'>('standard')
  const [settingsVisible, setSettingsVisible] = useState(false)

  // Inspect State
  const [inspectCoord, setInspectCoord] = useState<RoutePoint | null>(null)
  const [inspectFsi, setInspectFsi] = useState<number | null>(null)
  const [inspecting, setInspecting] = useState(false)

  // Sheet Slide Animation
  const sheetAnim = useRef(
    new Animated.Value(activeTab ? 0 : SHEET_HEIGHT)
  ).current

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
  const handleMapPress = async ({
    latitude,
    longitude,
  }: {
    latitude: number
    longitude: number
  }) => {
    if (mode === 'inspect') {
      setInspectCoord({ lat: latitude, lng: longitude })
      setInspecting(true)
      setInspectFsi(null)
      setActiveTab('inspect')

      const result = await inspectPoint(longitude, latitude)
      setInspecting(false)
      if (result && result.fsi !== null) {
        setInspectFsi(result.fsi)
      } else {
        setInspectFsi(null)
      }
    } else if (mode === 'route') {
      addPoint({ lat: latitude, lng: longitude })
      if (points.length === 1) {
        // Point B picked -> switch back to Routes tab to view comparison
        setActiveTab('routes')
      }
    }
  }

  // Camera Actions
  const handleRecenter = () => {
    mapRef.current?.postMessage?.(JSON.stringify({ type: 'RECENTER' }))
  }

  const handleZoom = (delta: number) => {
    mapRef.current?.postMessage?.(
      JSON.stringify({ type: delta > 0 ? 'ZOOM_IN' : 'ZOOM_OUT' })
    )
  }

  const handleMyLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert(
          'Permission Denied',
          'GPS permission is needed to locate your device.'
        )
        return
      }
      const loc = await Location.getCurrentPositionAsync({})
      mapRef.current?.postMessage?.(
        JSON.stringify({
          type: 'FLY_TO',
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
          zoom: 14,
        })
      )
    } catch {
      Alert.alert('Location Error', 'Could not obtain current GPS location.')
    }
  }

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <Header
        activeEvent={event}
        loading={eventsLoading}
        onOpenSettings={() => setSettingsVisible(true)}
      />

      {/* Main Map View Container */}
      <View style={styles.mapWrapper}>
        <InteractiveMap
          mapType={mapType}
          event={event}
          minutes={selectedMinutes}
          rainfallSource={rainfallSource}
          riskTolerance={riskTolerance}
          start={start ?? null}
          end={end ?? null}
          inspectCoord={inspectCoord}
          routes={routes}
          drainageData={drainageData}
          showFullDrainage={showFullDrainage}
          showAffectedDrainage={showAffectedDrainage}
          onRasterLoadingChange={handleRasterLoadingChange}
          onMapPress={handleMapPress}
        />

        {/* Floating Time Simulation Loading HUD */}
        {isTimeLoading && !eventsLoading && (
          <View style={styles.timeLoadingHud} pointerEvents="none">
            <View style={styles.timeLoadingPill}>
              <ActivityIndicator size="small" color={Colors.cyan} />
              <Text style={styles.timeLoadingText}>
                Loading {selectedMinutes ?? minutes}m simulation map…
              </Text>
            </View>
          </View>
        )}

        {/* Floating Top Mode Guide Pill */}
        {!eventsLoading && !apiError && !routeStatus && !isTimeLoading && (
          <ModeGuide
            mode={mode}
            pointCount={points.length}
            onClearMode={() => {
              setMode('inspect')
              clearPoints()
            }}
          />
        )}

        {/* Floating Map Action Controls (Right side) */}
        <View style={styles.mapControls}>
          <TouchableOpacity
            style={styles.controlBtn}
            onPress={handleMyLocation}
            activeOpacity={0.7}
          >
            <Ionicons name="navigate" size={17} color={Colors.cyan} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlBtn}
            onPress={handleRecenter}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name="crosshairs-gps"
              size={18}
              color={Colors.gold}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlBtn}
            onPress={() =>
              setMapType(mapType === 'standard' ? 'satellite' : 'standard')
            }
            activeOpacity={0.7}
          >
            <Ionicons
              name={mapType === 'standard' ? 'earth-outline' : 'map-outline'}
              size={17}
              color={Colors.textPrimary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlBtn}
            onPress={() => handleZoom(1)}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={18} color={Colors.textPrimary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlBtn}
            onPress={() => handleZoom(-1)}
            activeOpacity={0.7}
          >
            <Ionicons name="remove" size={18} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Floating Status / Error Banner */}
        <StatusToast
          loading={eventsLoading}
          error={apiError}
          routeStatus={routeStatus}
          onDismissError={() => {}}
        />

        {/* Sliding Bottom Sheet Container */}
        <Animated.View
          style={[
            styles.bottomSheet,
            {
              transform: [{ translateY: sheetAnim }],
            },
          ]}
        >
          {/* Sheet Handle Bar */}
          <View {...panResponder.panHandlers} style={styles.sheetHandleWrap}>
            <View style={styles.sheetHandle} />
          </View>

          {/* Tab Specific Content */}
          <View style={styles.sheetBody}>
            {activeTab === 'events' && (
              <EventsSheet
                events={events}
                event={event}
                rainfallSource={rainfallSource}
                eventsLoading={eventsLoading}
                windows={windows}
                minutes={minutes}
                activeWindow={activeWindow}
                summary={summary}
                drainageSummary={drainageSummary}
                drainageStatus={drainageStatus}
                showFullDrainage={showFullDrainage}
                showAffectedDrainage={showAffectedDrainage}
                isWindowLoading={isTimeLoading}
                intervalReady={intervalReady}
                selectedMinutes={selectedMinutes}
                disabled={disabled}
                onSelectEvent={selectEvent}
                onSelectRainfallSource={setRainfallSource}
                onSelectMinutes={selectMinutes}
                onToggleFullDrainage={toggleFullDrainage}
                onToggleAffectedDrainage={toggleAffectedDrainage}
                onRefresh={handleRefresh}
              />
            )}

            {activeTab === 'routes' && (
              <RoutesSheet
                routeMode={mode}
                onSelectRouteMode={(m) => setMode(m)}
                routeStart={start ?? null}
                routeEnd={end ?? null}
                riskTolerance={riskTolerance}
                onSelectRiskTolerance={setRiskTolerance}
                routeComparison={routes}
                isRouting={!!routeStatus && !routes}
                routeError={
                  routeStatus.startsWith('Route unavailable')
                    ? routeStatus
                    : null
                }
                onComputeRoute={(s, e) => setRoutePoints(s, e)}
                onClearRoute={clearPoints}
                onDismiss={() => setActiveTab(null)}
              />
            )}

            {activeTab === 'legend' && (
              <LegendSheet
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

      {/* Bottom Tab Bar Dock */}
      <View style={styles.bottomDock}>
        <BottomTabBar
          activeTab={activeTab}
          onSelectTab={(tab) => {
            if (activeTab === tab) {
              setActiveTab(null)
            } else {
              setActiveTab(tab)
              if (tab === 'routes') {
                if (mode === 'inspect') setMode('route-address')
              } else if (tab === 'inspect') {
                setMode('inspect')
              }
            }
          }}
        />
      </View>

      {/* Settings Modal */}
      <SettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        onSaved={() => handleRefresh()}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgVoid,
  },
  mapWrapper: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  mapControls: {
    position: 'absolute',
    right: 14,
    top: 14,
    gap: 8,
    zIndex: 30,
  },
  controlBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(10, 14, 26, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 6,
  },
  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: SHEET_HEIGHT,
    backgroundColor: 'rgba(10, 14, 26, 0.96)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(212, 175, 55, 0.35)',
    zIndex: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 20,
  },
  sheetHandleWrap: {
    width: '100%',
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(212, 175, 55, 0.5)',
  },
  sheetBody: {
    flex: 1,
  },
  bottomDock: {
    backgroundColor: Colors.bgVoid,
    paddingBottom: 2,
    zIndex: 50,
  },
  timeLoadingHud: {
    position: 'absolute',
    top: 14,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 35,
  },
  timeLoadingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(10, 14, 26, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.4)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    shadowColor: '#00e5ff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  timeLoadingText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: Colors.cyan,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
})
