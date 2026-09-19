/**
 * Header component matching the web frontend's header bar.
 * Fully responsive on all mobile screen widths with zero overflow.
 */
import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Platform, StatusBar as RNStatusBar } from 'react-native'
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors, Fonts } from '../theme'

interface HeaderProps {
  activeEvent?: string
  loading?: boolean
  onOpenSettings?: () => void
}

export default function Header({ activeEvent, loading, onOpenSettings }: HeaderProps) {
  const insets = useSafeAreaInsets()
  // Subtle top padding under status bar
  const topPadding = Platform.OS === 'android' ? 10 : Math.max(insets.top, 10)

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      {/* Left: Shield Icon + Title + Badge */}
      <View style={styles.leftContainer}>
        <View style={styles.iconBox}>
          <Ionicons name="shield-checkmark" size={17} color={Colors.goldLight} />
        </View>

        <View style={styles.titleColumn}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
              MUMBAI FLOOD
            </Text>
            <View style={styles.badge}>
              <View style={styles.badgeDot} />
              <Text style={styles.badgeText}>LIVE</Text>
            </View>
          </View>
          <Text style={styles.subtitle} numberOfLines={1} ellipsizeMode="tail">
            Hydrology & Safe Routing Engine
          </Text>
        </View>
      </View>

      {/* Right: Settings / Server Config + FSI Badge */}
      <View style={styles.rightActions}>
        {onOpenSettings && (
          <TouchableOpacity
            style={styles.settingsBtn}
            onPress={onOpenSettings}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <Ionicons name="server-outline" size={14} color={Colors.gold} />
          </TouchableOpacity>
        )}

        <View style={styles.fsiBox}>
          <MaterialCommunityIcons name="pulse" size={13} color={Colors.cyanPrimary} />
          <Text style={styles.fsiLabel}>FSI</Text>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 10,
    backgroundColor: '#04040a',
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderPrimary,
    zIndex: 100,
    overflow: 'hidden',
  },
  leftContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
    marginRight: 8,
  },
  iconBox: {
    height: 34,
    width: 34,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
    backgroundColor: 'rgba(212,175,55,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  titleColumn: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  title: {
    fontFamily: Fonts.monoBold,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.7,
    color: Colors.textHeading,
    flexShrink: 1,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.35)',
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    flexShrink: 0,
  },
  badgeDot: {
    height: 4.5,
    width: 4.5,
    borderRadius: 2.5,
    backgroundColor: Colors.emerald400,
  },
  badgeText: {
    fontFamily: Fonts.monoBold,
    fontSize: 7.5,
    color: Colors.emerald400,
  },
  subtitle: {
    fontFamily: Fonts.mono,
    fontSize: 8.5,
    letterSpacing: 0.25,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  settingsBtn: {
    height: 32,
    width: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.borderSecondary,
    backgroundColor: Colors.bgSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fsiBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.borderSecondary,
    backgroundColor: 'rgba(12,14,26,0.9)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5.5,
  },
  fsiLabel: {
    fontFamily: Fonts.monoBold,
    fontSize: 10,
    color: Colors.textPrimary,
  },
})
