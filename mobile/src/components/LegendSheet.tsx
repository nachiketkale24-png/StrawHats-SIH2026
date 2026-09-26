/**
 * Legend & Layer settings bottom sheet matching the web frontend's Legend tab.
 * Includes FSI susceptibility scales, confidence explanation, drainage network keys, and map style toggles.
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
        <Text style={styles.sectionTitle}>BASE MAP STYLE</Text>
        <View style={styles.layerRow}>
          <TouchableOpacity
            style={[styles.layerCard, !isSatellite && styles.layerCardActive]}
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
              CARTO Dark HUD
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
              Satellite Imagery
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* FSI Susceptibility Legend */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>FLOOD SUSCEPTIBILITY INDEX (FSI)</Text>
        <Text style={styles.sectionSubtitle}>
          Decoded continuous raster values from 0.00 (Dry) to 1.00 (Critical)
        </Text>

        <View style={styles.fsiList}>
          {FSI_LEVELS.map((item) => (
            <View key={item.range} style={styles.fsiItem}>
              <View style={[styles.fsiColorBar, { backgroundColor: item.color }]} />
              <View style={styles.fsiDetails}>
                <View style={styles.fsiTopRow}>
                  <Text style={styles.fsiLabel}>{item.label}</Text>
                  <Text style={[styles.fsiRange, { color: item.color }]}>
                    {item.range}
                  </Text>
                </View>
                <Text style={styles.fsiDesc}>{item.desc}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Drainage Network Legend */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>DRAINAGE & HYDRAULIC NETWORK</Text>
        <Text style={styles.sectionSubtitle}>
          Real-time manhole surcharge and conduit capacity utilization
        </Text>

        <View style={styles.drainageLegendBox}>
          <View style={styles.drainageRow}>
            <View style={[styles.nodeDot, { backgroundColor: Colors.statusNormal }]} />
            <Text style={styles.drainageText}>
              <Text style={{ fontWeight: '700', color: Colors.statusNormal }}>
                Normal Node / Pipe:
              </Text>{' '}
              Capacity {'<'} 50%
            </Text>
          </View>

          <View style={styles.drainageRow}>
            <View style={[styles.nodeDot, { backgroundColor: Colors.capacityAmber }]} />
            <Text style={styles.drainageText}>
              <Text style={{ fontWeight: '700', color: Colors.capacityAmber }}>
                Strained Node / Pipe:
              </Text>{' '}
              Capacity 50% – 85%
            </Text>
          </View>

          <View style={styles.drainageRow}>
            <View style={[styles.nodeDot, { backgroundColor: Colors.capacityRed }]} />
            <Text style={styles.drainageText}>
              <Text style={{ fontWeight: '700', color: Colors.capacityRed }}>
                Surcharging Node / Pipe:
              </Text>{' '}
              Capacity {'>'} 85% / Surcharged
            </Text>
          </View>

          <View style={styles.drainageRow}>
            <MaterialCommunityIcons
              name="navigation"
              size={14}
              color={Colors.cyan}
              style={{ transform: [{ rotate: '45deg' }] }}
            />
            <Text style={styles.drainageText}>
              <Text style={{ fontWeight: '700', color: Colors.cyan }}>
                Flow Direction Arrows:
              </Text>{' '}
              Conduit water flow vector
            </Text>
          </View>

          <View style={styles.drainageRow}>
            <View style={styles.dashedLine} />
            <Text style={styles.drainageText}>
              <Text style={{ fontWeight: '700', color: Colors.capacityRed }}>
                Dashed Conduits:
              </Text>{' '}
              Utilization {'>'} 85% overload
            </Text>
          </View>
        </View>
      </View>

      {/* Safe Routing Legend */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>SAFE NAVIGATION ROUTES</Text>

        <View style={styles.routeLegendItem}>
          <View style={[styles.routeLine, { backgroundColor: Colors.cyan }]} />
          <View style={styles.routeDetails}>
            <Text style={styles.routeLabel}>Flood-Aware Safe Route</Text>
            <Text style={styles.routeDesc}>
              Avoids high FSI risk corridors, minimizing flood depth exposure
            </Text>
          </View>
        </View>

        <View style={styles.routeLegendItem}>
          <View
            style={[
              styles.routeLine,
              { backgroundColor: '#94a3b8', borderStyle: 'dashed' },
            ]}
          />
          <View style={styles.routeDetails}>
            <Text style={styles.routeLabel}>Fastest Normal Route</Text>
            <Text style={styles.routeDesc}>
              Standard shortest driving distance without flood compensation
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 22,
  },
  sectionTitle: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: Colors.gold,
    letterSpacing: 1,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  layerRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  layerCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  layerCardActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    borderColor: Colors.gold,
  },
  layerCardActiveCyan: {
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    borderColor: Colors.cyan,
  },
  layerCardText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  layerCardTextActive: {
    color: Colors.gold,
  },
  layerCardTextActiveCyan: {
    color: Colors.cyan,
  },
  fsiList: {
    gap: 10,
  },
  fsiItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  fsiColorBar: {
    width: 6,
    height: 38,
    borderRadius: 3,
    marginRight: 12,
  },
  fsiDetails: {
    flex: 1,
  },
  fsiTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  fsiLabel: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  fsiRange: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
  },
  fsiDesc: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  drainageLegendBox: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 8,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  drainageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  nodeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dashedLine: {
    width: 14,
    height: 2,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.capacityRed,
  },
  drainageText: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: Colors.textPrimary,
    flex: 1,
  },
  routeLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  routeLine: {
    width: 24,
    height: 4,
    borderRadius: 2,
    marginRight: 12,
  },
  routeDetails: {
    flex: 1,
  },
  routeLabel: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  routeDesc: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: Colors.textSecondary,
  },
})
