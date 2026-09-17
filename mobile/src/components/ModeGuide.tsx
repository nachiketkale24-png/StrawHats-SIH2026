/**
 * Floating mode guide pill matching the web's mobile top guide.
 * Shows current interaction hint: "Tap map to inspect FSI" / "Tap point A (Start)" etc.
 */
import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import { Colors, Fonts } from '../theme'
import type { MapMode, RoutePoint } from '../types/flood'

interface Props {
  mode: MapMode
  start?: RoutePoint
  end?: RoutePoint
  pointCount?: number
  onClearMode?: () => void
  onReset?: () => void
}

export default function ModeGuide({
  mode,
  start,
  end,
  pointCount,
  onClearMode,
  onReset,
}: Props) {
  if (mode === 'route-address') return null

  const handleReset = onClearMode || onReset
  const hasPoints = (pointCount !== undefined && pointCount > 0) || !!start

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <View style={styles.pill}>
        {mode === 'inspect' ? (
          <>
            <MaterialCommunityIcons
              name="crosshairs-gps"
              size={13}
              color={Colors.cyanPrimary}
            />
            <Text style={styles.textSecondary}>
              Tap map anywhere to inspect FSI
            </Text>
          </>
        ) : (
          <>
            <Ionicons name="location" size={13} color={Colors.cyanPrimary} />
            <Text style={styles.textGold}>
              {!start && (!pointCount || pointCount === 0)
                ? 'Tap point A (Start)'
                : !end && pointCount === 1
                ? 'Tap point B (Destination)'
                : 'Route plotted'}
            </Text>
            {hasPoints && handleReset && (
              <TouchableOpacity onPress={handleReset} style={styles.resetBtn}>
                <Ionicons name="close-circle" size={14} color={Colors.rose400} />
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 10,
    left: 12,
    right: 12,
    zIndex: 20,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.borderSecondary,
    backgroundColor: 'rgba(12, 14, 26, 0.92)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  textSecondary: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  textGold: {
    fontFamily: Fonts.monoBold,
    fontSize: 11,
    color: Colors.goldLight,
  },
  resetBtn: {
    marginLeft: 4,
    padding: 2,
  },
})
