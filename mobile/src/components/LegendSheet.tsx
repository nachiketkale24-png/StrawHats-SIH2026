/**
 * Legend & Layer settings bottom sheet matching the web frontend's Legend tab.
 * Includes FSI susceptibility scales, confidence explanation, and map style toggles.
 */
import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native'
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import { Colors, Fonts, FsiColors } from '../theme'

interface LegendSheetProps {
  mapType: 'standard' | 'satellite' | 'hybrid'
  onToggleMapType: () => void
}

const FSI_LEVELS = [
  {
    range: '0.00 – 0.25',
    label: 'Low Susceptibility',
    desc: 'Normal drainage, negligible ponding risk',
    color: FsiColors.low,
  },
  {
    range: '0.25 – 0.50',
    label: 'Moderate Susceptibility',
    desc: 'Localized waterlogging, caution on subways',
    color: FsiColors.medium,
  },
  {
    range: '0.50 – 0.75',
    label: 'High Susceptibility',
    desc: 'Significant flood depth, lane closures expected',
    color: FsiColors.high,
  },
  {
    range: '0.75 – 1.00',
    label: 'Severe / Critical Inundation',
    desc: 'Major flooding, impassable road corridors',
    color: FsiColors.severe,
  },
]

export function LegendSheet({ mapType, onToggleMapType }: LegendSheetProps) {
  const isSatellite = mapType === 'satellite' || mapType === 'hybrid'

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Map Layers Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>MAP DISPLAY LAYERS</Text>
        <View style={styles.layerRow}>
          <TouchableOpacity
            style={[
              styles.layerCard,
              !isSatellite && styles.layerCardActive,
            ]}
            onPress={() => isSatellite && onToggleMapType()}
            activeOpacity={0.8}
          >
            <Ionicons
              name="map"
              size={18}
              color={!isSatellite ? Colors.gold : Colors.textSecondary}
            />
            <Text
              style={[
                styles.layerCardText,
                !isSatellite && styles.layerCardTextActive,
              ]}
            >
              Dark HUD
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.layerCard,
              isSatellite && styles.layerCardActiveCyan,
            ]}
            onPress={() => !isSatellite && onToggleMapType()}
            activeOpacity={0.8}
          >
            <Ionicons
              name="earth"
              size={18}
              color={isSatellite ? Colors.cyan : Colors.textSecondary}
            />
            <Text
              style={[
                styles.layerCardText,
                isSatellite && styles.layerCardTextActiveCyan,
              ]}
            >
              Satellite
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* FSI Gradient Legend */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>FLOOD SUSCEPTIBILITY INDEX (FSI)</Text>
        <Text style={styles.sectionDesc}>
          AI/ML raster index mapping probabilistic surface water inundation across Mumbai.
        </Text>

        <View style={styles.legendList}>
          {FSI_LEVELS.map((lvl) => (
            <View key={lvl.label} style={styles.legendItem}>
              <View style={[styles.colorIndicator, { backgroundColor: lvl.color }]} />
              <View style={styles.legendInfo}>
                <View style={styles.legendHeaderRow}>
                  <Text style={styles.legendLabel}>{lvl.label}</Text>
                  <Text style={styles.legendRange}>{lvl.range}</Text>
                </View>
                <Text style={styles.legendDesc}>{lvl.desc}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Route Color Legend */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ROUTING ENGINE OVERLAYS</Text>
        <View style={styles.routeLegendRow}>
          <View style={styles.routeItem}>
            <View style={[styles.routeLine, { backgroundColor: Colors.cyan }]} />
            <Text style={styles.routeText}>Flood-Aware Safe Path</Text>
          </View>
          <View style={styles.routeItem}>
            <View style={[styles.routeLine, { backgroundColor: '#71717a' }]} />
            <Text style={styles.routeText}>Standard Shortest Path</Text>
          </View>
        </View>
      </View>

      {/* Model Spec Card */}
      <View style={styles.specCard}>
        <View style={styles.specHeader}>
          <MaterialCommunityIcons name="shield-lock-outline" size={14} color={Colors.gold} />
          <Text style={styles.specTitle}>MODEL ARCHITECTURE</Text>
        </View>
        <Text style={styles.specDetails}>
          UNet Multi-spectral InSAR + DEM Topographic Hydrology Engine (SIH-2026 StrawHats).
        </Text>
      </View>
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
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontFamily: Fonts.monoBold,
    fontSize: 10,
    color: Colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  sectionDesc: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 12,
    lineHeight: 16,
  },
  layerRow: {
    flexDirection: 'row',
    gap: 10,
  },
  layerCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.borderSecondary,
    borderRadius: 10,
    paddingVertical: 12,
  },
  layerCardActive: {
    backgroundColor: Colors.bgPanel,
    borderColor: Colors.gold,
  },
  layerCardActiveCyan: {
    backgroundColor: Colors.bgPanel,
    borderColor: Colors.cyan,
  },
  layerCardText: {
    fontFamily: Fonts.monoBold,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  layerCardTextActive: {
    color: Colors.gold,
  },
  layerCardTextActiveCyan: {
    color: Colors.cyan,
  },
  legendList: {
    gap: 10,
  },
  legendItem: {
    flexDirection: 'row',
    backgroundColor: Colors.bgSecondary,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.borderSecondary,
    padding: 10,
    alignItems: 'center',
  },
  colorIndicator: {
    width: 14,
    height: 14,
    borderRadius: 4,
    marginRight: 10,
  },
  legendInfo: {
    flex: 1,
  },
  legendHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  legendLabel: {
    fontFamily: Fonts.monoBold,
    fontSize: 12,
    color: Colors.textPrimary,
  },
  legendRange: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    color: Colors.gold,
  },
  legendDesc: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  routeLegendRow: {
    flexDirection: 'column',
    gap: 8,
    backgroundColor: Colors.bgSecondary,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.borderSecondary,
    padding: 12,
  },
  routeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  routeLine: {
    width: 24,
    height: 4,
    borderRadius: 2,
  },
  routeText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: Colors.textPrimary,
  },
  specCard: {
    backgroundColor: Colors.bgPanel,
    borderWidth: 1,
    borderColor: Colors.borderPrimary,
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
  },
  specHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  specTitle: {
    fontFamily: Fonts.monoBold,
    fontSize: 10,
    color: Colors.gold,
    letterSpacing: 0.5,
  },
  specDetails: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
})
