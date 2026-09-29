import { useTheme } from '../theme/ThemeProvider'
/**
 * Inspect bottom sheet panel for examining point-specific Flood Susceptibility Index (FSI).
 * Displays coordinates, calculated FSI value, risk rating, and advice.
 */
import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import { Colors, Fonts, FsiColors } from '../theme'
import type { RoutePoint } from '../types/flood'

interface InspectSheetProps {
  inspectPoint: RoutePoint | null
  inspectFsi: number | null
  loadingFsi: boolean
  onClearInspect: () => void
  onDismiss: () => void
}

export function InspectSheet({
  inspectPoint,
  inspectFsi,
  loadingFsi,
  onClearInspect,
  onDismiss,
}: InspectSheetProps) {
  const { colors: Colors } = useTheme()
  const styles = makeStyles(Colors)
  const getFsiCategory = (fsi: number) => {
    if (fsi < 0.25) return { label: 'LOW RISK', color: FsiColors.low, advice: 'Low susceptibility in the selected rainfall window.' }
    if (fsi < 0.50) return { label: 'MODERATE RISK', color: FsiColors.medium, advice: 'Medium susceptibility in the selected rainfall window.' }
    if (fsi < 0.75) return { label: 'HIGH RISK', color: FsiColors.high, advice: 'High susceptibility in the selected rainfall window.' }
    return { label: 'CRITICAL / SEVERE', color: FsiColors.severe, advice: 'Severe susceptibility in the selected rainfall window.' }
  }

  const category = inspectFsi !== null ? getFsiCategory(inspectFsi) : null

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {!inspectPoint ? (
        <View style={styles.emptyState}>
          <View style={styles.crosshairCircle}>
            <MaterialCommunityIcons name="crosshairs-gps" size={32} color={Colors.gold} />
          </View>
          <Text style={styles.emptyTitle}>Tap anywhere on map</Text>
          <Text style={styles.emptyDesc}>
            Switch to the map view and tap any coordinate in Mumbai to query Flood Susceptibility Index (FSI) for the selected rainfall source and window.
          </Text>
          <TouchableOpacity style={styles.tapMapBtn} onPress={onDismiss}>
            <Text style={styles.tapMapBtnText}>Go to Map</Text>
            <Ionicons name="arrow-forward" size={14} color="#000" />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.resultContainer}>
          {/* Header Info */}
          <View style={styles.coordCard}>
            <View style={styles.coordRow}>
              <Ionicons name="location" size={16} color={Colors.cyan} />
              <Text style={styles.coordText}>
                {inspectPoint.lat.toFixed(5)}° N, {inspectPoint.lng.toFixed(5)}° E
              </Text>
            </View>
            <TouchableOpacity onPress={onClearInspect} style={styles.clearIconBtn}>
              <Ionicons name="close" size={16} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Loading or Metric */}
          {loadingFsi ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={Colors.gold} />
              <Text style={styles.loadingText}>SAMPLING HYDROLOGIC RASTER...</Text>
            </View>
          ) : inspectFsi !== null && category ? (
            <View style={styles.fsiResultCard}>
              <View style={styles.badgeRow}>
                <View style={[styles.fsiBadge, { backgroundColor: `${category.color}25`, borderColor: category.color }]}>
                  <Text style={[styles.fsiBadgeText, { color: category.color }]}>{category.label}</Text>
                </View>
                <Text style={styles.fsiPercent}>{(inspectFsi * 100).toFixed(1)}% FSI</Text>
              </View>

              {/* Meter bar */}
              <View style={styles.meterTrack}>
                <View
                  style={[
                    styles.meterFill,
                    {
                      width: `${Math.min(100, Math.max(5, inspectFsi * 100))}%`,
                      backgroundColor: category.color,
                    },
                  ]}
                />
              </View>

              <Text style={styles.adviceText}>{category.advice}</Text>
            </View>
          ) : (
            <Text style={styles.errorText}>Unable to sample FSI at this location.</Text>
          )}
        </View>
      )}
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
  emptyState: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  crosshairCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontFamily: Fonts.bodyBold,
    fontSize: 14,
    color: Colors.gold,
    letterSpacing: 0,
    marginBottom: 8,
  },
  emptyDesc: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  tapMapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.gold,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
  },
  tapMapBtnText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12,
    color: Colors.onAccent,
    fontWeight: '700',
  },
  resultContainer: {
    gap: 14,
  },
  coordCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.borderSecondary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  coordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  coordText: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    color: Colors.textPrimary,
  },
  clearIconBtn: {
    padding: 4,
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 20,
  },
  loadingText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 11,
    color: Colors.gold,
  },
  fsiResultCard: {
    backgroundColor: Colors.bgPanel,
    borderWidth: 1,
    borderColor: Colors.borderPrimary,
    borderRadius: 12,
    padding: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  fsiBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  fsiBadgeText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 11,
  },
  fsiPercent: {
    fontFamily: Fonts.bodyBold,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  meterTrack: {
    height: 6,
    backgroundColor: Colors.bgSecondary,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 12,
  },
  meterFill: {
    height: '100%',
    borderRadius: 3,
  },
  adviceText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  errorText: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    color: '#f87171',
    textAlign: 'center',
    marginVertical: 10,
  },
})
