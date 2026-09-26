/**
 * Routes bottom sheet panel for the Mobile App.
 * Matches web frontend's Routes tab.
 * Includes address lookup, GPS location, preset destinations, pick on map toggle,
 * Risk Tolerance controls (Low / Balanced / High), and comprehensive route comparisons.
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
import {
  geocodeAddress,
  type RouteComparison,
  type GeocodeResult,
} from '../api/floodApi'
import type { RoutePoint, MapMode, RiskTolerance } from '../types/flood'
import { Colors, Fonts } from '../theme'

interface RoutesSheetProps {
  routeMode: MapMode
  onSelectRouteMode: (mode: MapMode) => void
  routeStart: RoutePoint | null
  routeEnd: RoutePoint | null
  riskTolerance: RiskTolerance
  onSelectRiskTolerance: (tol: RiskTolerance) => void
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
  routeMode,
  onSelectRouteMode,
  routeStart,
  routeEnd,
  riskTolerance,
  onSelectRiskTolerance,
  routeComparison,
  isRouting,
  routeError,
  onComputeRoute,
  onClearRoute,
  onDismiss,
}: RoutesSheetProps) {
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
        setLocalError(
          `Location not found: "${startText}". Try adding "Mumbai" or using a landmark.`
        )
        return
      }
      if (!resB) {
        setLocalError(
          `Location not found: "${endText}". Try adding "Mumbai" or using a landmark.`
        )
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

  const safeDistKm =
    routeComparison?.tolerance_distance_km ??
    routeComparison?.flood_aware_distance_km ??
    (routeComparison?.flood_aware_route?.length_m
      ? routeComparison.flood_aware_route.length_m / 1000
      : routeComparison?.normal_distance_km ?? 0)

  const normalDistKm =
    routeComparison?.normal_distance_km ??
    (routeComparison?.normal_route?.length_m
      ? routeComparison.normal_route.length_m / 1000
      : 0)

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="always"
    >
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

      {/* Risk Tolerance Selector */}
      <View style={styles.riskTolSection}>
        <View style={styles.riskTolHeader}>
          <Ionicons name="shield-outline" size={13} color={Colors.cyan} />
          <Text style={styles.riskTolTitle}>FLOOD RISK TOLERANCE</Text>
        </View>

        <View style={styles.riskTolRow}>
          <TouchableOpacity
            style={[
              styles.riskTolChip,
              riskTolerance === 'low' && styles.riskTolChipActive,
            ]}
            onPress={() => onSelectRiskTolerance('low')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.riskTolText,
                riskTolerance === 'low' && styles.riskTolTextActive,
              ]}
            >
              Min Risk
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.riskTolChip,
              riskTolerance === 'medium' && styles.riskTolChipActiveGold,
            ]}
            onPress={() => onSelectRiskTolerance('medium')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.riskTolText,
                riskTolerance === 'medium' && styles.riskTolTextActiveGold,
              ]}
            >
              Balanced
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.riskTolChip,
              (riskTolerance === 'high' || riskTolerance === 'severe') &&
                styles.riskTolChipActiveRed,
            ]}
            onPress={() => onSelectRiskTolerance('high')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.riskTolText,
                (riskTolerance === 'high' || riskTolerance === 'severe') &&
                  styles.riskTolTextActiveRed,
              ]}
            >
              Fastest
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Mode Instructions for Pick-on-map */}
      {!isAddressMode ? (
        <View style={styles.pickGuideCard}>
          <Ionicons
            name="information-circle-outline"
            size={18}
            color={Colors.cyan}
          />
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
          <View
            style={{
              zIndex: isFocusedA ? 1000 : 20,
              elevation: isFocusedA ? 1000 : 20,
            }}
          >
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
                <Ionicons
                  name="navigate-outline"
                  size={13}
                  color={Colors.cyan}
                />
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

          <View
            style={{
              zIndex: isFocusedB ? 1000 : 5,
              elevation: isFocusedB ? 1000 : 5,
            }}
          >
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
              <Text style={styles.presetsTitle}>QUICK DESTINATIONS</Text>
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
              (isRouting || !startText.trim() || !endText.trim()) &&
                styles.computeBtnDisabled,
            ]}
            onPress={handleAddressSubmit}
            disabled={isRouting || !startText.trim() || !endText.trim()}
          >
            {isRouting ? (
              <View style={styles.btnRow}>
                <ActivityIndicator size="small" color="#000" />
                <Text style={styles.computeBtnText}>
                  COMPUTING SAFE ROUTE...
                </Text>
              </View>
            ) : (
              <View style={styles.btnRow}>
                <Ionicons name="shield-checkmark" size={15} color="#000" />
                <Text style={styles.computeBtnText}>CALCULATE SAFE ROUTE</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Route Results Comparison Card */}
      {routeComparison && (
        <View style={styles.comparisonCard}>
          <View style={styles.comparisonHeader}>
            <View style={styles.badgeRow}>
              <View style={styles.safeTag}>
                <Ionicons
                  name="shield-checkmark"
                  size={12}
                  color={Colors.cyan}
                />
                <Text style={styles.safeTagText}>FLOOD AVOIDANCE ROUTE</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onDismiss} style={styles.viewMapPill}>
              <Text style={styles.viewMapText}>View on Map</Text>
              <Ionicons name="arrow-forward" size={12} color={Colors.gold} />
            </TouchableOpacity>
          </View>

          {/* Warning Banner */}
          {routeComparison.warning && (
            <View style={styles.warningBanner}>
              <Ionicons name="alert-circle" size={14} color={Colors.capacityAmber} />
              <Text style={styles.warningBannerText}>
                {routeComparison.warning}
              </Text>
            </View>
          )}

          {/* Metrics Grid */}
          <View style={styles.metricsGrid}>
            <View style={styles.metricCol}>
              <Text style={styles.metricLabel}>SAFE DISTANCE</Text>
              <Text style={styles.metricValCyan}>
                {safeDistKm.toFixed(1)} km
              </Text>
            </View>

            <View style={styles.metricCol}>
              <Text style={styles.metricLabel}>DETOUR</Text>
              <Text style={styles.metricVal}>
                +{routeComparison.extra_distance_pct.toFixed(0)}%
              </Text>
            </View>

            <View style={styles.metricCol}>
              <Text style={styles.metricLabel}>PEAK FSI RISK</Text>
              <Text
                style={[
                  styles.metricVal,
                  {
                    color:
                      routeComparison.max_risk_on_route > 0.5
                        ? Colors.capacityRed
                        : Colors.statusNormal,
                  },
                ]}
              >
                {(routeComparison.max_risk_on_route * 100).toFixed(0)}%
              </Text>
            </View>
          </View>

          {/* Comparison Sub-row */}
          <View style={styles.comparisonRow}>
            <View style={styles.compBarItem}>
              <View style={[styles.dot, { backgroundColor: '#888' }]} />
              <Text style={styles.compSub}>
                Normal Shortest Route: {normalDistKm.toFixed(1)} km (
                {routeComparison.high_severe_segment_count > 0
                  ? `${routeComparison.high_severe_segment_count} severe flood segments avoided`
                  : 'Fastest baseline path'}
                )
              </Text>
            </View>
          </View>

          {/* Clear Route Button */}
          <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
            <Ionicons name="trash-outline" size={14} color="#f87171" />
            <Text style={styles.clearBtnText}>Clear Current Route</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
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
    marginBottom: 14,
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
    fontFamily: Fonts.monoBold,
    fontSize: 11,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
  },
  segmentTextActive: {
    color: Colors.gold,
  },
  segmentTextActiveCyan: {
    color: Colors.cyan,
  },
  riskTolSection: {
    marginBottom: 14,
  },
  riskTolHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  riskTolTitle: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    color: Colors.cyan,
    fontWeight: '700',
    letterSpacing: 1,
  },
  riskTolRow: {
    flexDirection: 'row',
    gap: 8,
  },
  riskTolChip: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  riskTolChipActive: {
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    borderColor: Colors.cyan,
  },
  riskTolChipActiveGold: {
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    borderColor: Colors.gold,
  },
  riskTolChipActiveRed: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: Colors.capacityRed,
  },
  riskTolText: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  riskTolTextActive: {
    color: Colors.cyan,
  },
  riskTolTextActiveGold: {
    color: Colors.gold,
  },
  riskTolTextActiveRed: {
    color: Colors.capacityRed,
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
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.cyan,
    marginBottom: 2,
  },
  pickGuideSubtitle: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  formContainer: {
    gap: 10,
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
    gap: 6,
    paddingVertical: 5,
  },
  gpsBtnText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: Colors.cyan,
    fontWeight: '600',
  },
  swapBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  presetsSection: {
    marginTop: 4,
  },
  presetsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  presetsTitle: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    color: Colors.gold,
    letterSpacing: 1,
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  presetChip: {
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  presetChipText: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: Colors.textPrimary,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  errorText: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: '#f87171',
    flex: 1,
  },
  computeBtn: {
    backgroundColor: Colors.gold,
    paddingVertical: 13,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  computeBtnDisabled: {
    opacity: 0.4,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  computeBtnText: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '800',
    color: '#04040a',
    letterSpacing: 0.5,
  },
  comparisonCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
    marginTop: 16,
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
    gap: 5,
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  safeTagText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: Colors.cyan,
  },
  viewMapPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewMapText: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: Colors.gold,
    fontWeight: '600',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    padding: 8,
    borderRadius: 6,
    marginBottom: 10,
  },
  warningBannerText: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: Colors.capacityAmber,
    flex: 1,
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  metricCol: {
    alignItems: 'center',
  },
  metricLabel: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  metricValCyan: {
    fontFamily: Fonts.mono,
    fontSize: 16,
    fontWeight: '800',
    color: Colors.cyan,
  },
  metricVal: {
    fontFamily: Fonts.mono,
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  comparisonRow: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingTop: 8,
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
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: Colors.textSecondary,
    flex: 1,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  clearBtnText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: '#f87171',
    fontWeight: '600',
  },
})
