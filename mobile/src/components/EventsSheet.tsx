import { useTheme } from '../theme/ThemeProvider'
import React, { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Linking,
  ActivityIndicator,
} from 'react-native'
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import { Colors, Fonts, FontSizes } from '../theme'
import { getApiBase } from '../api/config'
import { windowQuery } from '../api/floodApi'
import type { EventSummary, EventWindows, EventWindow } from '../api/floodApi'

interface Props {
  source: import("../api/floodApi").RainfallSource
  onSource: (value: import("../api/floodApi").RainfallSource) => void
  events: string[]
  event: string
  eventsLoading: boolean
  windows: EventWindows | null
  minutes: number
  activeWindow: EventWindow | undefined
  summary: EventSummary | null
  intervalReady: boolean
  selectedMinutes: number | undefined
  disabled: boolean
  onSelectEvent: (date: string) => void
  onSelectMinutes: (val: number) => void
  onRefresh: () => void
}

const WINDOW_VALUES = [15, 30, 60, 90, 120, 180]

function formatEventLabel(dateStr: string): { title: string; subtitle: string } {
  if (dateStr === '2023-07-26') return { title: '2023-07-26', subtitle: '26 Jul 2023 · Extreme Inundation' }
  if (dateStr === '2020-08-04') return { title: '2020-08-04', subtitle: '04 Aug 2020 · High Precipitation' }
  if (dateStr === '2019-09-04') return { title: '2019-09-04', subtitle: '04 Sep 2019 · Monsoon Inundation' }
  
  const parts = dateStr.split('-')
  if (parts.length === 3) {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const mIdx = parseInt(parts[1], 10) - 1
    const mName = monthNames[mIdx] || parts[1]
    return { title: dateStr, subtitle: `${parts[2]} ${mName} ${parts[0]} · Historical Event` }
  }
  return { title: dateStr, subtitle: 'Historical Flood Dataset' }
}

export default function EventsSheet({
  source, onSource,
  events,
  event,
  eventsLoading,
  windows,
  minutes,
  activeWindow,
  summary,
  intervalReady,
  selectedMinutes,
  disabled,
  onSelectEvent,
  onSelectMinutes,
  onRefresh,
}: Props) {
  const { colors: Colors } = useTheme()
  const styles = makeStyles(Colors)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const currentEventInfo = formatEventLabel(event || (events[0] ?? ''))

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
    >
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>{(['observed','nowcast'] as const).map(value => <TouchableOpacity key={value} onPress={() => onSource(value)} style={{ flex: 1, padding: 12, borderRadius: 9, borderWidth: 1, borderColor: Colors.borderPrimary, backgroundColor: source === value ? Colors.gold : Colors.bgSecondary }}><Text style={{ textAlign: 'center', color: source === value ? Colors.bgVoid : Colors.textPrimary }}>{value === 'observed' ? 'Observed rainfall' : 'Nowcast'}</Text></TouchableOpacity>)}</View>

      {/* SECTION 1: Historical Date Selection Dropdown */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionTitleWrap}>
            <Ionicons name="calendar" size={13} color={Colors.gold} />
            <Text style={styles.sectionTitle}>Historical flood event</Text>
          </View>
          {eventsLoading && (
            <View style={styles.loadingPill}>
              <ActivityIndicator size="small" color={Colors.gold} />
              <Text style={styles.loadingPillText}>Updating</Text>
            </View>
          )}
        </View>

        {/* Dropdown Selector Row */}
        <View style={styles.dropdownRow}>
          <TouchableOpacity
            style={[styles.dropdownTrigger, dropdownOpen && styles.dropdownTriggerActive]}
            onPress={() => setDropdownOpen((prev) => !prev)}
            activeOpacity={0.8}
            disabled={eventsLoading || events.length === 0}
          >
            <View style={styles.dropdownLeft}>
              <View style={styles.calendarIconBox}>
                <Ionicons name="calendar-outline" size={16} color={Colors.gold} />
              </View>
              <View style={styles.dropdownTextWrap}>
                <Text style={styles.dropdownDateText}>
                  {event || (eventsLoading ? 'Loading events...' : 'Select an event date')}
                </Text>
                <Text style={styles.dropdownSubtext} numberOfLines={1}>
                  {event ? currentEventInfo.subtitle : 'Choose historical rainfall timeline'}
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

          {/* Refresh Button */}
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={onRefresh}
            disabled={eventsLoading}
            activeOpacity={0.7}
          >
            <Ionicons
              name="refresh"
              size={17}
              color={eventsLoading ? Colors.textSecondary : Colors.gold}
            />
          </TouchableOpacity>
        </View>

        {/* Dropdown Menu Options */}
        {dropdownOpen && (
          <View style={styles.dropdownMenu}>
            {events.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  {eventsLoading ? 'Loading historical events…' : 'No events available'}
                </Text>
              </View>
            ) : (
              events.map((dateStr, idx) => {
                const info = formatEventLabel(dateStr)
                const isSelected = event === dateStr
                return (
                  <TouchableOpacity
                    key={dateStr}
                    style={[
                      styles.dropdownItem,
                      isSelected && styles.dropdownItemActive,
                      idx === events.length - 1 && styles.dropdownItemLast,
                    ]}
                    onPress={() => {
                      onSelectEvent(dateStr)
                      setDropdownOpen(false)
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.dropdownItemLeft}>
                      <View
                        style={[
                          styles.radioDot,
                          isSelected && styles.radioDotActive,
                        ]}
                      >
                        {isSelected && <View style={styles.radioDotInner} />}
                      </View>
                      <View style={styles.itemTextWrap}>
                        <Text
                          style={[
                            styles.itemDateText,
                            isSelected && styles.itemDateTextActive,
                          ]}
                        >
                          {info.title}
                        </Text>
                        <Text style={styles.itemSubText}>{info.subtitle}</Text>
                      </View>
                    </View>

                    {isSelected && (
                      <View style={styles.checkBadge}>
                        <Ionicons name="checkmark" size={14} color={Colors.goldLight} />
                      </View>
                    )}
                  </TouchableOpacity>
                )
              })
            )}
          </View>
        )}
      </View>

      {/* SECTION 2: Accumulation Window Buttons */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionTitleWrap}>
            <MaterialCommunityIcons name="clock-outline" size={13} color={Colors.cyan} />
            <Text style={styles.sectionTitle}>Accumulation window</Text>
          </View>

          {activeWindow && (
            <View style={styles.timeRangePill}>
              <View style={styles.timeRangeDot} />
              <Text style={styles.timeRangeText}>
                {activeWindow.start_time.match(/\d{2}:\d{2}/)?.[0]} → {activeWindow.end_time.match(/\d{2}:\d{2}/)?.[0]}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.intervalGrid}>
          {(windows?.windows.map(window => window.minutes) ?? WINDOW_VALUES).map((val) => {
            const available = windows?.windows.some((w) => w.minutes === val)
            const isActive = !!activeWindow && val === minutes
            return (
              <TouchableOpacity
                key={val}
                style={[
                  styles.intervalBtn,
                  isActive && styles.intervalBtnActive,
                  (!available || disabled) && styles.intervalBtnDisabled,
                ]}
                onPress={() => onSelectMinutes(val)}
                disabled={disabled || !available}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.intervalBtnText,
                    isActive && styles.intervalBtnTextActive,
                  ]}
                >
                  {val} min
                </Text>
                {isActive && <View style={styles.intervalActiveDot} />}
              </TouchableOpacity>
            )
          })}
        </View>
      </View>

      {/* SECTION 3: Event Summary Index Stats */}
      {summary && (
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleWrap}>
              <MaterialCommunityIcons name="chart-bar" size={13} color={Colors.gold} />
              <Text style={styles.sectionTitle}>Event summary index</Text>
            </View>
            <View style={styles.fsiPill}>
              <Text style={styles.fsiPillText}>FSI SCALE 0 - 1</Text>
            </View>
          </View>

          <View style={styles.statsCard}>
            <View style={styles.statsGrid}>
              {/* MIN */}
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Min risk</Text>
                <Text style={styles.statValueMin}>{summary.fsi_min.toFixed(2)}</Text>
                <Text style={styles.statSubLabel}>Baseline</Text>
              </View>

              <View style={styles.statDivider} />

              {/* MEAN */}
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Avg fsi</Text>
                <Text style={styles.statValueMean}>{summary.fsi_mean.toFixed(2)}</Text>
                <Text style={styles.statSubLabel}>Citywide</Text>
              </View>

              <View style={styles.statDivider} />

              {/* MAX */}
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Peak fsi</Text>
                <Text style={styles.statValueMax}>{summary.fsi_max.toFixed(2)}</Text>
                <Text style={styles.statSubLabel}>Critical</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* SECTION 4: Download GeoTIFF Action Button */}
      {intervalReady && (
        <TouchableOpacity
          style={styles.downloadBtn}
          onPress={() => {
            const url = `${getApiBase()}/flood/raster/${encodeURIComponent(event)}${windowQuery(selectedMinutes, source)}`
            Linking.openURL(url)
          }}
          activeOpacity={0.8}
        >
          <View style={styles.downloadIconWrap}>
            <Ionicons name="download-outline" size={15} color={Colors.goldLight} />
          </View>
          <Text style={styles.downloadText}>Download FSI GeoTIFF</Text>
          <Ionicons name="arrow-forward" size={13} color={Colors.goldLight} style={{ opacity: 0.8 }} />
        </TouchableOpacity>
      )}
    </ScrollView>
  )
}

const makeStyles = (Colors: ReturnType<typeof useTheme>["colors"]) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 28,
    gap: 14,
  },
  section: {
    gap: 7,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  sectionTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontFamily: Fonts.bodyBold,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0,
    color: Colors.textSecondary,
    textTransform: 'none',
  },
  loadingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(212,175,55,0.1)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  loadingPillText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 8.5,
    color: Colors.gold,
  },
  dropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dropdownTrigger: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#060710',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.25)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  dropdownTriggerActive: {
    borderColor: Colors.gold,
    backgroundColor: Colors.bgVoid,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  dropdownLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  calendarIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(212,175,55,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  dropdownDateText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textHeading,
    letterSpacing: 0,
  },
  dropdownSubtext: {
    fontFamily: Fonts.body,
    fontSize: 10.5,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  chevronBox: {
    paddingLeft: 6,
  },
  refreshBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#060710',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  dropdownMenu: {
    backgroundColor: Colors.bgVoid,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
    borderRadius: 10,
    marginTop: 2,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  dropdownItemLast: {
    borderBottomWidth: 0,
  },
  dropdownItemActive: {
    backgroundColor: 'rgba(212,175,55,0.12)',
  },
  dropdownItemLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  radioDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: Colors.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDotActive: {
    borderColor: Colors.gold,
  },
  radioDotInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.gold,
  },
  itemTextWrap: {
    flex: 1,
  },
  itemDateText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  itemDateTextActive: {
    color: Colors.goldLight,
  },
  itemSubText: {
    fontFamily: Fonts.body,
    fontSize: 10.5,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  checkBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(212,175,55,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    padding: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  timeRangePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,229,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0,229,255,0.25)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
  },
  timeRangeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Colors.cyan,
  },
  timeRangeText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 10,
    color: Colors.cyan,
    fontWeight: '700',
  },
  intervalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  intervalBtn: {
    flexBasis: '31.5%',
    flexGrow: 1,
    height: 40,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#060710',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  intervalBtnActive: {
    borderColor: Colors.gold,
    backgroundColor: 'rgba(212,175,55,0.18)',
    borderWidth: 1.5,
  },
  intervalBtnDisabled: {
    opacity: 0.35,
  },
  intervalBtnText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 11.5,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 0,
  },
  intervalBtnTextActive: {
    color: Colors.goldLight,
    fontWeight: '800',
  },
  intervalActiveDot: {
    position: 'absolute',
    top: 5,
    right: 6,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.gold,
  },
  fsiPill: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  fsiPillText: {
    fontFamily: Fonts.mono,
    fontSize: 8.5,
    color: Colors.textSecondary,
  },
  statsCard: {
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
    backgroundColor: '#060710',
    paddingVertical: 10,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  statsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  statLabel: {
    fontFamily: Fonts.bodyBold,
    fontSize: 9,
    color: Colors.textSecondary,
    letterSpacing: 0,
    marginBottom: 2,
  },
  statValueMin: {
    fontFamily: Fonts.bodyBold,
    fontSize: 16,
    fontWeight: '800',
    color: '#94a3b8',
  },
  statValueMean: {
    fontFamily: Fonts.bodyBold,
    fontSize: 16,
    fontWeight: '800',
    color: Colors.cyan,
  },
  statValueMax: {
    fontFamily: Fonts.bodyBold,
    fontSize: 16,
    fontWeight: '800',
    color: '#fbbf24',
  },
  statSubLabel: {
    fontFamily: Fonts.body,
    fontSize: 9.5,
    color: 'rgba(155,151,142,0.7)',
    marginTop: 1,
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
    backgroundColor: 'rgba(212,175,55,0.08)',
    paddingVertical: 11,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  downloadIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: 'rgba(212,175,55,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 11.5,
    fontWeight: '700',
    color: Colors.goldLight,
    letterSpacing: 0,
  },
})
