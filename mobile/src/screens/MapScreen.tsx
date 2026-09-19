/**
 * Main Map Screen for Mumbai Flood Susceptibility Expo Go App.
 * Full Safe Area View, premium glassmorphic HUD styling, CARTO Dark Matter vector tiles,
 * safe route plotting, coordinate inspection, and interactive bottom sheets.
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
const SHEET_HEIGHT = Math.min(SCREEN_HEIGHT * 0.58, 480)

export default function MapScreen() {
  const insets = useSafeAreaInsets()
  const mapRef = useRef<any>(null)

  // Data hook
  const {
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
  const [mapType, setMapType] = useState<'standard' | 'satellite'>('standard')
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
    mapRef.current?.postMessage?.(JSON.stringify({ type: delta > 0 ? 'ZOOM_IN' : 'ZOOM_OUT' }))
  }

  const handleMyLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'GPS permission is needed to locate your device.')
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
      {/* Top Header with Safe Area Inset */}
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
            <MaterialCommunityIcons name="crosshairs-gps" size={18} color={Colors.gold} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlBtn}
            onPress={() => setMapType(mapType === 'standard' ? 'satellite' : 'standard')}
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
          <View {...panResponder.panHandlers} style={styles.sheetHandleWrap}>
            <View style={styles.sheetHandle} />
          </View>

          {/* Tab Specific Content */}
          <View style={styles.sheetBody}>
            {activeTab === 'events' && (
              <EventsSheet
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
              />
            )}

            {activeTab === 'routes' && (
              <RoutesSheet
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

      {/* Bottom Tab Bar Dock — wrapped to extend dark bg behind Android gesture bar */}
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

const styles = StyleSheet.create({
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
    backgroundColor: 'rgba(12, 14, 26, 0.92)',
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
    backgroundColor: 'rgba(12, 14, 26, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.35)',
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
    fontFamily: Fonts.monoBold,
    fontSize: 10,
    color: Colors.goldLight,
  },
  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: SHEET_HEIGHT,
    backgroundColor: '#04040a',
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
    backgroundColor: '#04040a',
  },
})
