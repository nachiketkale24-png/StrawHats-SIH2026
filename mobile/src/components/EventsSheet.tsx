import React, { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Switch,
} from 'react-native'
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import { Colors, Fonts, FontSizes } from '../theme'
import type {
  EventSummary,
  EventWindows,
  EventWindow,
  DrainageResponse,
} from '../api/floodApi'
import type { RainfallSource } from '../types/flood'

interface Props {
  events: string[]
  event: string
  rainfallSource: RainfallSource
  eventsLoading: boolean
  windows: EventWindows | null
  minutes: number
  activeWindow: EventWindow | undefined
  summary: EventSummary | null
  drainageSummary: DrainageResponse['summary'] | null
  drainageStatus: string
  showFullDrainage: boolean
  intervalReady: boolean
  selectedMinutes: number | undefined
  disabled: boolean
  onSelectEvent: (date: string) => void
  onSelectRainfallSource: (source: RainfallSource) => void
  onSelectMinutes: (val: number) => void
  onToggleFullDrainage: () => void
  onRefresh: () => void
}

const WINDOW_VALUES = [15, 30, 60, 90, 120, 180]

function formatEventLabel(dateStr: string): { title: string; subtitle: string } {
  if (dateStr === '2023-07-26')
    return { title: '2023-07-26', subtitle: '26 Jul 2023 · Extreme Inundation' }
  if (dateStr === '2020-08-04')
    return { title: '2020-08-04', subtitle: '04 Aug 2020 · High Precipitation' }
  if (dateStr === '2019-09-04')
    return { title: '2019-09-04', subtitle: '04 Sep 2019 · Monsoon Inundation' }

  const parts = dateStr.split('-')
  if (parts.length === 3) {
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ]
    const mIdx = parseInt(parts[1], 10) - 1
    const mName = monthNames[mIdx] || parts[1]
    return {
      title: dateStr,
      subtitle: `${parts[2]} ${mName} ${parts[0]} · Historical Event`,
    }
  }
  return { title: dateStr, subtitle: 'Flood Dataset' }
}

export default function EventsSheet({
  events,
  event,
  rainfallSource,
  eventsLoading,
  windows,
  minutes,
  activeWindow,
  summary,
  drainageSummary,
  drainageStatus,
  showFullDrainage,
  intervalReady,
  selectedMinutes,
  disabled,
  onSelectEvent,
  onSelectRainfallSource,
  onSelectMinutes,
  onToggleFullDrainage,
  onRefresh,
}: Props) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const currentEventInfo = formatEventLabel(event || (events[0] ?? ''))

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
    >
      {/* SECTION 1: Rainfall Source Selector (Observed vs Nowcast) */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionTitleWrap}>
            <MaterialCommunityIcons
              name="weather-partly-rainy"
              size={14}
              color={Colors.gold}
            />
            <Text style={styles.sectionTitle}>RAINFALL DATA SOURCE</Text>
          </View>
        </View>

        <View style={styles.sourceToggleRow}>
          <TouchableOpacity
            style={[
              styles.sourceBtn,
              rainfallSource === 'observed' && styles.sourceBtnActive,
            ]}
            onPress={() => onSelectRainfallSource('observed')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="cloudy-night-outline"
              size={14}
              color={
                rainfallSource === 'observed'
                  ? Colors.gold
                  : Colors.textSecondary
              }
            />
            <Text
              style={[
                styles.sourceBtnText,
                rainfallSource === 'observed' && styles.sourceBtnTextActive,
              ]}
            >
              Observed Stations
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.sourceBtn,
              rainfallSource === 'nowcast' && styles.sourceBtnActiveCyan,
            ]}
            onPress={() => onSelectRainfallSource('nowcast')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="analytics-outline"
              size={14}
              color={
                rainfallSource === 'nowcast'
                  ? Colors.cyan
                  : Colors.textSecondary
              }
            />
            <Text
              style={[
                styles.sourceBtnText,
                rainfallSource === 'nowcast' && styles.sourceBtnTextActiveCyan,
              ]}
            >
              AI / Nowcast
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* SECTION 2: Event Date Selection Dropdown */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionTitleWrap}>
            <Ionicons name="calendar" size={13} color={Colors.gold} />
            <Text style={styles.sectionTitle}>FLOOD EVENT TIMELINE</Text>
          </View>
          {eventsLoading && (
            <View style={styles.loadingPill}>
              <ActivityIndicator size="small" color={Colors.gold} />
              <Text style={styles.loadingPillText}>SYNCING</Text>
            </View>
          )}
        </View>

        {/* Dropdown Selector Row */}
        <View style={styles.dropdownRow}>
          <TouchableOpacity
            style={[
              styles.dropdownTrigger,
              dropdownOpen && styles.dropdownTriggerActive,
            ]}
            onPress={() => setDropdownOpen((prev) => !prev)}
            activeOpacity={0.8}
            disabled={eventsLoading || events.length === 0}
          >
            <View style={styles.dropdownLeft}>
              <View style={styles.calendarIconBox}>
                <Ionicons
                  name="calendar-outline"
                  size={16}
                  color={Colors.gold}
                />
              </View>
              <View style={styles.dropdownTextWrap}>
                <Text style={styles.dropdownDateText}>
                  {event ||
                    (eventsLoading
                      ? 'Loading events...'
                      : 'No events available')}
                </Text>
                <Text style={styles.dropdownSubtext} numberOfLines={1}>
                  {event
                    ? currentEventInfo.subtitle
                    : 'Choose rainfall scenario'}
                </Text>
              </View>
            </View>

            <View style={styles.chevronBox}>
              <Ionicons
                name={dropdownOpen ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={Colors.gold}
              />
            </View>
          </TouchableOpacity>

          {/* Expanded Event List */}
          {dropdownOpen && (
            <View style={styles.dropdownList}>
              {events.map((dateStr) => {
                const isSelected = dateStr === event
                const label = formatEventLabel(dateStr)
                return (
                  <TouchableOpacity
                    key={dateStr}
                    style={[
                      styles.dropdownItem,
                      isSelected && styles.dropdownItemActive,
                    ]}
                    onPress={() => {
                      onSelectEvent(dateStr)
                      setDropdownOpen(false)
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={styles.dropdownItemLeft}>
                      <View
                        style={[
                          styles.dateBullet,
                          isSelected && styles.dateBulletActive,
                        ]}
                      />
                      <View>
                        <Text
                          style={[
                            styles.dropdownItemTitle,
                            isSelected && styles.dropdownItemTitleActive,
                          ]}
                        >
                          {label.title}
                        </Text>
                        <Text style={styles.dropdownItemSub}>
                          {label.subtitle}
                        </Text>
                      </View>
                    </View>
                    {isSelected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={18}
                        color={Colors.gold}
                      />
                    )}
                  </TouchableOpacity>
                )
              })}
            </View>
          )}
        </View>
      </View>

      {/* SECTION 3: Accumulation Window Selector */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionTitleWrap}>
            <Ionicons name="time" size={13} color={Colors.cyan} />
            <Text style={styles.sectionTitle}>ACCUMULATION WINDOW</Text>
          </View>
          {activeWindow && (
            <Text style={styles.windowTimeBasis}>
              {activeWindow.start_time} → {activeWindow.end_time}
            </Text>
          )}
        </View>

        <View style={styles.windowPillsGrid}>
          {WINDOW_VALUES.map((wVal) => {
            const isSelected = minutes === wVal
            const isAvail =
              windows?.windows.some((w) => w.minutes === wVal) ?? true

            return (
              <TouchableOpacity
                key={wVal}
                style={[
                  styles.windowPill,
                  isSelected && styles.windowPillActive,
                  !isAvail && styles.windowPillDisabled,
                ]}
                onPress={() => isAvail && onSelectMinutes(wVal)}
                disabled={!isAvail || disabled}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.windowPillValue,
                    isSelected && styles.windowPillValueActive,
                  ]}
                >
                  {wVal}
                </Text>
                <Text
                  style={[
                    styles.windowPillUnit,
                    isSelected && styles.windowPillUnitActive,
                  ]}
                >
                  MIN
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>
      </View>

      {/* SECTION 4: Drainage Network Controls & Metrics */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionTitleWrap}>
            <MaterialCommunityIcons
              name="pipe"
              size={15}
              color={Colors.statusNormal}
            />
            <Text style={styles.sectionTitle}>DRAINAGE NETWORK</Text>
          </View>
          {drainageStatus ? (
            <Text style={styles.drainageStatusText}>{drainageStatus}</Text>
          ) : null}
        </View>

        <View style={styles.drainageCard}>
          {drainageSummary ? (
            <View style={styles.drainageMetricsRow}>
              <View style={styles.drainageMetric}>
                <Text style={styles.metricVal}>
                  <Text
                    style={{
                      color:
                        drainageSummary.surcharged_manholes > 0
                          ? Colors.capacityRed
                          : Colors.statusNormal,
                    }}
                  >
                    {drainageSummary.surcharged_manholes}
                  </Text>
                  {' / '}
                  {drainageSummary.total_manholes}
                </Text>
                <Text style={styles.metricLabel}>Surcharged Manholes</Text>
              </View>

              <View style={styles.metricDivider} />

              <View style={styles.drainageMetric}>
                <Text style={styles.metricVal}>
                  <Text
                    style={{
                      color:
                        drainageSummary.surcharged_conduits > 0
                          ? Colors.capacityRed
                          : Colors.statusNormal,
                    }}
                  >
                    {drainageSummary.surcharged_conduits}
                  </Text>
                  {' / '}
                  {drainageSummary.total_conduits}
                </Text>
                <Text style={styles.metricLabel}>Surcharged Conduits</Text>
              </View>
            </View>
          ) : (
            <Text style={styles.drainageEmptyText}>
              {drainageStatus || 'Drainage status unavailable for this event.'}
            </Text>
          )}

          {/* Full Network Switch */}
          <View style={styles.fullDrainageToggleRow}>
            <View style={styles.toggleLeft}>
              <MaterialCommunityIcons
                name="vector-polyline"
                size={16}
                color={Colors.cyan}
              />
              <Text style={styles.toggleText}>
                Show full drainage network (34k+ points)
              </Text>
            </View>
            <Switch
              value={showFullDrainage}
              onValueChange={onToggleFullDrainage}
              trackColor={{ false: '#1e293b', true: Colors.cyan }}
              thumbColor={showFullDrainage ? Colors.gold : '#94a3b8'}
            />
          </View>
        </View>
      </View>

      {/* SECTION 5: Flood Susceptibility Summary Stats */}
      {summary && (
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleWrap}>
              <Ionicons name="stats-chart" size={13} color={Colors.gold} />
              <Text style={styles.sectionTitle}>
                FSI SUSCEPTIBILITY METRICS
              </Text>
            </View>
          </View>

          <View style={styles.statsCard}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>
                {(summary.fsi_mean * 100).toFixed(1)}%
              </Text>
              <Text style={styles.statLabel}>Average FSI</Text>
            </View>
            <View style={styles.statBox}>
              <Text
                style={[
                  styles.statValue,
                  {
                    color:
                      summary.fsi_max > 0.7
                        ? Colors.capacityRed
                        : Colors.capacityAmber,
                  },
                ]}
              >
                {(summary.fsi_max * 100).toFixed(1)}%
              </Text>
              <Text style={styles.statLabel}>Peak Risk</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: Colors.statusNormal }]}>
                {(summary.fsi_min * 100).toFixed(1)}%
              </Text>
              <Text style={styles.statLabel}>Min Risk</Text>
            </View>
          </View>
        </View>
      )}

      {/* Refresh API Data button */}
      <TouchableOpacity
        style={styles.refreshBtn}
        onPress={onRefresh}
        activeOpacity={0.8}
      >
        <Ionicons name="refresh" size={15} color={Colors.gold} />
        <Text style={styles.refreshBtnText}>REFRESH DATA PIPELINE</Text>
      </TouchableOpacity>
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
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: Colors.gold,
    letterSpacing: 1,
    fontWeight: '700',
  },
  loadingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  loadingPillText: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    color: Colors.gold,
    fontWeight: '700',
  },
  sourceToggleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  sourceBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  sourceBtnActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    borderColor: Colors.gold,
  },
  sourceBtnActiveCyan: {
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    borderColor: Colors.cyan,
  },
  sourceBtnText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  sourceBtnTextActive: {
    color: Colors.gold,
  },
  sourceBtnTextActiveCyan: {
    color: Colors.cyan,
  },
  dropdownRow: {
    position: 'relative',
    zIndex: 10,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  dropdownTriggerActive: {
    borderColor: Colors.gold,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  dropdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  calendarIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownTextWrap: {
    flex: 1,
  },
  dropdownDateText: {
    fontFamily: Fonts.mono,
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  dropdownSubtext: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  chevronBox: {
    paddingLeft: 8,
  },
  dropdownList: {
    backgroundColor: '#0a0e1a',
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: Colors.gold,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  dropdownItemActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
  },
  dropdownItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.textSecondary,
  },
  dateBulletActive: {
    backgroundColor: Colors.gold,
  },
  dropdownItemTitle: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  dropdownItemTitleActive: {
    color: Colors.gold,
    fontWeight: '700',
  },
  dropdownItemSub: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  windowTimeBasis: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    color: Colors.cyan,
  },
  windowPillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  windowPill: {
    flex: 1,
    minWidth: '28%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.2)',
  },
  windowPillActive: {
    backgroundColor: 'rgba(0, 229, 255, 0.2)',
    borderColor: Colors.cyan,
  },
  windowPillDisabled: {
    opacity: 0.3,
  },
  windowPillValue: {
    fontFamily: Fonts.mono,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  windowPillValueActive: {
    color: Colors.cyan,
  },
  windowPillUnit: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  windowPillUnitActive: {
    color: Colors.cyan,
  },
  drainageCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  drainageMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 12,
  },
  drainageMetric: {
    alignItems: 'center',
  },
  metricVal: {
    fontFamily: Fonts.mono,
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  metricLabel: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  metricDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  drainageEmptyText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 6,
  },
  drainageStatusText: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    color: Colors.statusNormal,
  },
  fullDrainageToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingTop: 10,
    marginTop: 6,
  },
  toggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    paddingRight: 10,
  },
  toggleText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Colors.textPrimary,
  },
  statsCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontFamily: Fonts.mono,
    fontSize: 16,
    fontWeight: '800',
    color: Colors.gold,
  },
  statLabel: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.4)',
    marginTop: 10,
  },
  refreshBtnText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: Colors.gold,
    fontWeight: '700',
    letterSpacing: 1,
  },
})
