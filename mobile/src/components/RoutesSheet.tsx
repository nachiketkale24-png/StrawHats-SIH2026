import { useTheme } from '../theme/ThemeProvider'
/**
 * Routes bottom sheet panel matching the web frontend's Routes tab.
 * Includes address lookup, GPS location, preset destinations, pick on map toggle,
 * route computation, and comprehensive flood-aware vs shortest route comparisons.
 * Fixed zIndex stacking so suggestions dropdown never mixes with destination inputs.
 */
import React, { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import * as Location from 'expo-location'
import { AddressInput } from './AddressInput'
import { geocodeAddress, type RouteComparison, type GeocodeResult } from '../api/floodApi'
import type { RoutePoint, MapMode } from '../types/flood'
import { Colors, Fonts } from '../theme'

interface RoutesSheetProps {
  tolerance: import("../api/floodApi").RiskTolerance
  onTolerance: (value: import("../api/floodApi").RiskTolerance) => void
  routeMode: MapMode
  onSelectRouteMode: (mode: MapMode) => void
  routeStart: RoutePoint | null
  routeEnd: RoutePoint | null
  routeComparison: RouteComparison | null
  isRouting: boolean
  routeError: string | null
  onComputeRoute: (start: RoutePoint, end: RoutePoint) => void
  onClearRoute: () => void
  onDismiss: () => void
}

const MUMBAI_PRESETS = [
  { name: 'BKC', query: 'Bandra Kurla Complex, Mumbai' },
  { name: 'Dadar', query: 'Dadar Station, Mumbai' },
  { name: 'Andheri', query: 'Andheri East, Mumbai' },
  { name: 'Airport', query: 'Chhatrapati Shivaji Maharaj International Airport, Mumbai' },
  { name: 'Kurla', query: 'Kurla West, Mumbai' },
  { name: 'Colaba', query: 'Colaba, Mumbai' },
]

export function RoutesSheet({
  tolerance, onTolerance,
  routeMode,
  onSelectRouteMode,
  routeStart,
  routeEnd,
  routeComparison,
  isRouting,
  routeError,
  onComputeRoute,
  onClearRoute,
  onDismiss,
}: RoutesSheetProps) {
  const { colors: Colors } = useTheme()
  const styles = makeStyles(Colors)
  const [startText, setStartText] = useState('')
  const [endText, setEndText] = useState('')
  const [isFocusedA, setIsFocusedA] = useState(false)
  const [isFocusedB, setIsFocusedB] = useState(false)
  const [locatingGPS, setLocatingGPS] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const isAddressMode = routeMode === 'route-address'

  const handleUseGPS = async () => {
    try {
      setLocatingGPS(true)
      setLocalError(null)
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        setLocalError('Location permission denied. Please enter an address.')
        return
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      })
      const { latitude, longitude } = location.coords
      setStartText(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`)
    } catch (e: any) {
      setLocalError('Failed to get GPS location. Please type an address.')
    } finally {
      setLocatingGPS(false)
    }
  }

  const handleSwap = () => {
    const temp = startText
    setStartText(endText)
    setEndText(temp)
  }

  const handleApplyPreset = (query: string) => {
    if (!startText.trim()) {
      setStartText(query)
    } else {
      setEndText(query)
    }
  }

  const handleAddressSubmit = async () => {
    if (!startText.trim() || !endText.trim()) {
      setLocalError('Please enter both start and destination points.')
      return
    }

    setLocalError(null)
    try {
      const [resA, resB] = await Promise.all([
        geocodeAddress(startText),
        geocodeAddress(endText),
      ])

      if (!resA) {
        setLocalError(`Location not found: "${startText}". Try adding "Mumbai" or using a landmark.`)
        return
      }
      if (!resB) {
        setLocalError(`Location not found: "${endText}". Try adding "Mumbai" or using a landmark.`)
        return
      }

      setStartText(resA.displayName.split(',')[0] || resA.displayName)
      setEndText(resB.displayName.split(',')[0] || resB.displayName)

      onComputeRoute(
        { lat: resA.lat, lng: resA.lng },
        { lat: resB.lat, lng: resB.lng }
      )
    } catch (e: any) {
      setLocalError(e?.message || 'Geocoding service unavailable.')
    }
  }

  const handleClear = () => {
    setStartText('')
    setEndText('')
    setLocalError(null)
    onClearRoute()
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="always"
    >
      <Text style={{ color: Colors.textHeading, fontSize: 15, fontWeight: '600', marginBottom: 10 }}>Flood risk tolerance</Text>
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 18 }}>{(['low','medium','high','severe'] as const).map(value => <TouchableOpacity key={value} onPress={() => onTolerance(value)} style={{ flex: 1, paddingVertical: 11, alignItems: 'center', borderWidth: 1, borderColor: Colors.borderPrimary, borderRadius: 9, backgroundColor: tolerance === value ? Colors.gold : Colors.bgSecondary }}><Text style={{ color: tolerance === value ? Colors.bgVoid : Colors.textPrimary, textTransform: 'capitalize' }}>{value}</Text></TouchableOpacity>)}</View>

      {/* Mode Segmented Control */}
      <View style={styles.segmentContainer}>
        <TouchableOpacity
          style={[styles.segmentBtn, isAddressMode && styles.segmentBtnActive]}
          onPress={() => onSelectRouteMode('route-address')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="search-outline"
            size={14}
            color={isAddressMode ? Colors.gold : Colors.textSecondary}
          />
          <Text
            style={[
              styles.segmentText,
              isAddressMode && styles.segmentTextActive,
            ]}
          >
            Address Search
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.segmentBtn, !isAddressMode && styles.segmentBtnActive]}
          onPress={() => {
            onSelectRouteMode('route')
            onDismiss() // Let them tap on the map
          }}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons
            name="map-marker-path"
            size={14}
            color={!isAddressMode ? Colors.cyan : Colors.textSecondary}
          />
          <Text
            style={[
              styles.segmentText,
              !isAddressMode && styles.segmentTextActiveCyan,
            ]}
          >
            Pick on Map
          </Text>
        </TouchableOpacity>
      </View>

      {/* Mode Instructions for Pick-on-map */}
      {!isAddressMode ? (
        <View style={styles.pickGuideCard}>
          <Ionicons name="information-circle-outline" size={18} color={Colors.cyan} />
          <View style={styles.pickGuideTextWrap}>
            <Text style={styles.pickGuideTitle}>Map Pick Mode Active</Text>
            <Text style={styles.pickGuideSubtitle}>
              {!routeStart
                ? 'Tap any point on the map for Start (A).'
                : !routeEnd
                ? 'Now tap a second point on the map for Destination (B).'
                : 'Both points selected. You can re-tap the map to choose new points.'}
            </Text>
          </View>
        </View>
      ) : (
        /* Address Mode Form */
        <View style={styles.formContainer}>
          {/* Input A with high stacking context */}
          <View style={{ zIndex: isFocusedA ? 1000 : 20, elevation: isFocusedA ? 1000 : 20 }}>
            <AddressInput
              label="A"
              placeholder="Origin / Start location"
              value={startText}
              onChangeText={setStartText}
              onSelectSuggestion={(s: GeocodeResult) =>
                setStartText(s.displayName.split(',')[0] || s.displayName)
              }
              onClear={() => setStartText('')}
              onFocusChange={setIsFocusedA}
              disabled={isRouting}
            />
          </View>

          {/* Location & Swap Row */}
          <View style={[styles.actionRow, { zIndex: 10, elevation: 10 }]}>
            <TouchableOpacity
              style={styles.gpsBtn}
              onPress={handleUseGPS}
              disabled={locatingGPS || isRouting}
            >
              {locatingGPS ? (
                <ActivityIndicator size="small" color={Colors.cyan} />
              ) : (
                <Ionicons name="navigate-outline" size={13} color={Colors.cyan} />
              )}
              <Text style={styles.gpsBtnText}>Use Current GPS</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.swapBtn}
              onPress={handleSwap}
              disabled={isRouting}
            >
              <Ionicons name="swap-vertical" size={14} color={Colors.gold} />
            </TouchableOpacity>
          </View>

          {/* Input B with high stacking context */}
          <View style={{ zIndex: isFocusedB ? 1000 : 5, elevation: isFocusedB ? 1000 : 5 }}>
            <AddressInput
              label="B"
              placeholder="Destination in Mumbai"
              value={endText}
              onChangeText={setEndText}
              onSelectSuggestion={(s: GeocodeResult) =>
                setEndText(s.displayName.split(',')[0] || s.displayName)
              }
              onClear={() => setEndText('')}
              onFocusChange={setIsFocusedB}
              disabled={isRouting}
            />
          </View>

          {/* Quick Presets */}
          <View style={[styles.presetsSection, { zIndex: 1, elevation: 1 }]}>
            <View style={styles.presetsHeader}>
              <Ionicons name="sparkles" size={12} color={Colors.gold} />
              <Text style={styles.presetsTitle}>Quick destinations</Text>
            </View>
            <View style={styles.presetsGrid}>
              {MUMBAI_PRESETS.map((p) => (
                <TouchableOpacity
                  key={p.name}
                  style={styles.presetChip}
                  onPress={() => handleApplyPreset(p.query)}
                  disabled={isRouting}
                >
                  <Text style={styles.presetChipText}>{p.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Error Message */}
          {(localError || routeError) && (
            <View style={styles.errorBox}>
              <Ionicons name="warning-outline" size={14} color="#f87171" />
              <Text style={styles.errorText}>{localError || routeError}</Text>
            </View>
          )}

          {/* Compute Button */}
          <TouchableOpacity
            style={[
              styles.computeBtn,
              (isRouting || !startText.trim() || !endText.trim()) && styles.computeBtnDisabled,
            ]}
            onPress={handleAddressSubmit}
            disabled={isRouting || !startText.trim() || !endText.trim()}
          >
            {isRouting ? (
              <View style={styles.btnRow}>
                <ActivityIndicator size="small" color="#000" />
                <Text style={styles.computeBtnText}>COMPUTING SAFE ROUTE...</Text>
              </View>
            ) : (
              <View style={styles.btnRow}>
                <Ionicons name="shield-checkmark" size={15} color="#000" />
                <Text style={styles.computeBtnText}>Calculate safe route</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      )}

      {routeComparison && <View style={styles.comparisonCard}>
        <Text style={{ color: Colors.textPrimary, fontWeight: '600', fontSize: 15 }}>Fastest route (gray) · {(routeComparison.normal_route.length_m / 1000).toFixed(2)} km</Text>
        <Text style={{ color: Colors.textSecondary, marginTop: 8 }}>Maximum FSI {routeComparison.normal_route.max_risk.toFixed(3)} · Average FSI {routeComparison.normal_route.avg_risk.toFixed(3)}</Text>
        <Text style={{ color: Colors.cyan, fontWeight: '600', fontSize: 15, marginTop: 18 }}>FloodSafe (cyan) · {tolerance} tolerance</Text>
        <Text style={{ color: Colors.textPrimary, marginTop: 8 }}>{routeComparison.tolerance_route ? `${routeComparison.tolerance_distance_km?.toFixed(2)} km · Maximum FSI ${routeComparison.max_risk_on_route?.toFixed(3)}` : 'No connected route meets this tolerance.'}</Text>
        {routeComparison.tolerance_route && <Text style={{ color: Colors.textSecondary, marginTop: 8 }}>High/severe segments: {routeComparison.high_severe_segment_count} · Distance difference: {((routeComparison.tolerance_distance_km ?? 0) - routeComparison.normal_route.length_m / 1000).toFixed(2)} km</Text>}
        {routeComparison.warning && <Text style={{ color: Colors.textSecondary, marginTop: 12 }}>{routeComparison.warning}</Text>}
        {routeComparison.suggested_route && <TouchableOpacity onPress={() => onTolerance(routeComparison.suggested_route!.risk_tolerance)} style={{ padding: 12, borderWidth: 1, borderColor: Colors.gold, borderRadius: 9, marginTop: 14 }}><Text style={{ color: Colors.gold }}>Use {routeComparison.suggested_route.risk_tolerance} tolerance · {(routeComparison.suggested_route.length_m / 1000).toFixed(2)} km</Text></TouchableOpacity>}
        <TouchableOpacity onPress={onDismiss} style={styles.viewMapPill}><Text style={styles.viewMapText}>View on map</Text></TouchableOpacity>
        <TouchableOpacity style={styles.clearBtn} onPress={handleClear}><Text style={styles.clearBtnText}>Clear route</Text></TouchableOpacity>
      </View>}
    </ScrollView>
  )
}

const makeStyles = (Colors: ReturnType<typeof useTheme>["colors"]) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgVoid,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.bgSecondary,
    borderRadius: 10,
    padding: 3,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.borderSecondary,
    zIndex: 1,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 8,
    gap: 6,
  },
  segmentBtnActive: {
    backgroundColor: Colors.bgPanel,
    borderWidth: 1,
    borderColor: Colors.borderPrimary,
  },
  segmentText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 11,
    color: Colors.textSecondary,
    textTransform: 'none',
  },
  segmentTextActive: {
    color: Colors.gold,
  },
  segmentTextActiveCyan: {
    color: Colors.cyan,
  },
  pickGuideCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
    borderRadius: 10,
    padding: 12,
    gap: 10,
    marginBottom: 16,
  },
  pickGuideTextWrap: {
    flex: 1,
  },
  pickGuideTitle: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12,
    color: Colors.cyan,
    marginBottom: 4,
  },
  pickGuideSubtitle: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.textPrimary,
    lineHeight: 17,
  },
  formContainer: {
    gap: 10,
    position: 'relative',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  gpsBtnText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: Colors.cyan,
  },
  swapBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.borderSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetsSection: {
    marginTop: 4,
  },
  presetsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
  },
  presetsTitle: {
    fontFamily: Fonts.bodyBold,
    fontSize: 10,
    color: Colors.textSecondary,
    letterSpacing: 0,
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  presetChip: {
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.borderSecondary,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
  },
  presetChipText: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 8,
    padding: 10,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: 11,
    color: '#f87171',
  },
  computeBtn: {
    backgroundColor: Colors.gold,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  computeBtnDisabled: {
    opacity: 0.5,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  computeBtnText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12,
    color: Colors.bgVoid,
    fontWeight: '800',
    letterSpacing: 0,
  },
  comparisonCard: {
    marginTop: 18,
    backgroundColor: Colors.bgPanel,
    borderWidth: 1,
    borderColor: Colors.borderPrimary,
    borderRadius: 12,
    padding: 14,
  },
  comparisonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  safeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  safeTagText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 10,
    color: Colors.cyan,
  },
  viewMapPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  viewMapText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 11,
    color: Colors.gold,
  },
  metricsGrid: {
    flexDirection: 'row',
    backgroundColor: Colors.bgSecondary,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  metricCol: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  metricVal: {
    fontFamily: Fonts.bodyBold,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  metricValCyan: {
    fontFamily: Fonts.bodyBold,
    fontSize: 14,
    color: Colors.cyan,
  },
  metricValGreen: {
    fontFamily: Fonts.bodyBold,
    fontSize: 14,
    color: '#34d399',
  },
  comparisonRow: {
    marginBottom: 10,
  },
  compBarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  compSub: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 8,
  },
  clearBtnText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: '#f87171',
  },
})
