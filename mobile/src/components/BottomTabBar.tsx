/**
 * Bottom tab bar matching the web frontend's mobile navigation dock.
 * 4 tabs: Events, Routes, Legend, Inspect — with the same active state styling.
 */
import React from 'react'
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native'
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors, Fonts } from '../theme'
import type { MobileTab } from '../types/flood'

interface Props {
  activeTab: MobileTab
  onSelectTab: (tab: 'events' | 'routes' | 'legend' | 'inspect') => void
}

export default function BottomTabBar({ activeTab, onSelectTab }: Props) {
  const insets = useSafeAreaInsets()
  const bottomInset = Platform.OS === 'android' 
    ? Math.max(10, insets.bottom)
    : Math.max(8, insets.bottom)

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: bottomInset,
        },
      ]}
    >
      {/* Events */}
      <TouchableOpacity
        style={[
          styles.tab,
          activeTab === 'events' && styles.tabActiveGold,
        ]}
        onPress={() => onSelectTab('events')}
        activeOpacity={0.7}
      >
        <Ionicons
          name="calendar-outline"
          size={17}
          color={activeTab === 'events' ? Colors.goldLight : Colors.textSecondary}
        />
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={[
            styles.tabLabel,
            activeTab === 'events' && styles.tabLabelActiveGold,
          ]}
        >
          Events
        </Text>
      </TouchableOpacity>

      {/* Routes */}
      <TouchableOpacity
        style={[
          styles.tab,
          activeTab === 'routes' && styles.tabActiveCyan,
        ]}
        onPress={() => onSelectTab('routes')}
        activeOpacity={0.7}
      >
        <MaterialCommunityIcons
          name="routes"
          size={17}
          color={activeTab === 'routes' ? Colors.cyanPrimary : Colors.textSecondary}
        />
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={[
            styles.tabLabel,
            activeTab === 'routes' && styles.tabLabelActiveCyan,
          ]}
        >
          Routes
        </Text>
      </TouchableOpacity>

      {/* Legend */}
      <TouchableOpacity
        style={[
          styles.tab,
          activeTab === 'legend' && styles.tabActiveGold,
        ]}
        onPress={() => onSelectTab('legend')}
        activeOpacity={0.7}
      >
        <Ionicons
          name="layers-outline"
          size={17}
          color={activeTab === 'legend' ? Colors.goldLight : Colors.textSecondary}
        />
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={[
            styles.tabLabel,
            activeTab === 'legend' && styles.tabLabelActiveGold,
          ]}
        >
          Legend
        </Text>
      </TouchableOpacity>

      {/* Inspect */}
      <TouchableOpacity
        style={[
          styles.tab,
          activeTab === 'inspect' && styles.tabActiveEmerald,
        ]}
        onPress={() => onSelectTab('inspect')}
        activeOpacity={0.7}
      >
        <MaterialCommunityIcons
          name="crosshairs-gps"
          size={17}
          color={activeTab === 'inspect' ? Colors.emerald400 : Colors.textSecondary}
        />
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={[
            styles.tabLabel,
            activeTab === 'inspect' && styles.tabLabelActiveEmerald,
          ]}
        >
          Inspect
        </Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: Colors.borderPrimary,
    backgroundColor: '#04040a',
    paddingTop: 5,
    paddingHorizontal: 8,
    zIndex: 40,
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
    marginHorizontal: 3,
    borderRadius: 8,
    gap: 3,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabActiveGold: {
    backgroundColor: 'rgba(212,175,55,0.12)',
    borderColor: 'rgba(212,175,55,0.3)',
  },
  tabActiveCyan: {
    backgroundColor: 'rgba(0,229,255,0.12)',
    borderColor: 'rgba(0,229,255,0.3)',
  },
  tabActiveEmerald: {
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderColor: 'rgba(16,185,129,0.3)',
  },
  tabLabel: {
    fontFamily: Fonts.monoBold,
    fontSize: 10,
    color: Colors.textSecondary,
    letterSpacing: 0.2,
  },
  tabLabelActiveGold: {
    color: Colors.goldLight,
  },
  tabLabelActiveCyan: {
    color: Colors.cyanPrimary,
  },
  tabLabelActiveEmerald: {
    color: Colors.emerald400,
  },
})
