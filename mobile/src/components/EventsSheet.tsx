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
import { Colors, Fonts } from '../theme'
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
  showAffectedDrainage: boolean
  isWindowLoading?: boolean
  intervalReady: boolean
  selectedMinutes: number | undefined
  disabled: boolean
  onSelectEvent: (date: string) => void
  onSelectRainfallSource: (source: RainfallSource) => void
  onSelectMinutes: (val: number) => void
  onToggleFullDrainage: (value?: boolean) => void
  onToggleAffectedDrainage: (value?: boolean) => void
  onRefresh: () => void
}

const WINDOW_VALUES = [15, 30, 60, 90, 120, 180]

const EVENT_METADATA: Record<
  string,
  { title: string; subtitle: string; tag: string; tagColor: string }
> = {
  '2023-07-26': {
    title: '26 Jul 2023',
    subtitle: 'Extreme Inundation (Eastern Suburbs)',
    tag: 'Extreme',
    tagColor: Colors.capacityRed,
  },
  '2020-09-23': {
    title: '23 Sep 2020',
    subtitle: 'Severe Cloudburst & Waterlogging',
    tag: 'Severe',
    tagColor: Colors.capacityAmber,
  },
  '2020-08-04': {
    title: '04 Aug 2020',
    subtitle: 'South Mumbai Coastal Flood Surge',
    tag: 'High Rain',
    tagColor: Colors.capacityAmber,
  },
  '2019-09-04': {
    title: '04 Sep 2019',
    subtitle: 'Mithi River Overflow & Rail Inundation',
    tag: 'Monsoon',
    tagColor: Colors.cyan,
  },
  '2017-08-29': {
    title: '29 Aug 2017',
    subtitle: 'Historic 300mm+ City-Wide Flooding',
    tag: 'Historic',
    tagColor: Colors.gold,
  },
}

function getEventSubtitle(dateStr: string) {
  if (EVENT_METADATA[dateStr]) return EVENT_METADATA[dateStr].subtitle
  return 'Historical Flood Dataset'
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
  showAffectedDrainage,
  isWindowLoading = false,
  intervalReady,
  selectedMinutes,
  disabled,
  onSelectEvent,
  onSelectRainfallSource,
  onSelectMinutes,
  onToggleFullDrainage,
  onToggleAffectedDrainage,
  onRefresh,
}: Props) {
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false)
  const [sourceDropdownOpen, setSourceDropdownOpen] = useState(false)

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
    >
      {/* ── 1. RAINFALL DATA SOURCE DROPDOWN ────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>RAINFALL DATA SOURCE</Text>

        <TouchableOpacity
          style={[
            styles.selectBox,
            sourceDropdownOpen && styles.selectBoxActive,
          ]}
          onPress={() => {
            setSourceDropdownOpen((prev) => !prev)
            setDateDropdownOpen(false)
          }}
          activeOpacity={0.8}
        >
          <View style={styles.selectLeft}>
            <MaterialCommunityIcons
              name={
                rainfallSource === 'observed'
                  ? 'cloud-percent'
                  : 'chart-bell-curve'
              }
              size={16}
              color={
                rainfallSource === 'observed' ? Colors.gold : Colors.cyan
              }
            />
            <Text style={styles.selectValueText}>
              {rainfallSource === 'observed'
                ? 'Observed rainfall — comparison only'
                : 'Model nowcast — forecast'}
            </Text>
          </View>
          <Ionicons
            name={sourceDropdownOpen ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={Colors.gold}
          />
        </TouchableOpacity>

        {sourceDropdownOpen && (
          <View style={styles.optionsList}>
            <TouchableOpacity
              style={[
                styles.optionItem,
                rainfallSource === 'observed' && styles.optionItemActive,
              ]}
              onPress={() => {
                onSelectRainfallSource('observed')
                setSourceDropdownOpen(false)
              }}
              activeOpacity={0.8}
            >
              <View style={styles.optionLeft}>
                <Ionicons
                  name="cloudy-night-outline"
                  size={14}
                  color={
                    rainfallSource === 'observed'
                      ? Colors.gold
                      : Colors.textSecondary
                  }
                />
                <View>
                  <Text
                    style={[
                      styles.optionTitle,
                      rainfallSource === 'observed' && styles.optionTitleActive,
                    ]}
                  >
                    Observed rainfall — comparison only
                  </Text>
                  <Text style={styles.optionSub}>
                    5 historical gauge & radar events
                  </Text>
                </View>
              </View>
              {rainfallSource === 'observed' && (
                <Ionicons
                  name="checkmark-circle"
                  size={16}
                  color={Colors.gold}
                />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.optionItem,
                rainfallSource === 'nowcast' && styles.optionItemActive,
                { borderBottomWidth: 0 },
              ]}
              onPress={() => {
                onSelectRainfallSource('nowcast')
                setSourceDropdownOpen(false)
              }}
              activeOpacity={0.8}
            >
              <View style={styles.optionLeft}>
                <Ionicons
                  name="analytics-outline"
                  size={14}
                  color={
                    rainfallSource === 'nowcast'
                      ? Colors.cyan
                      : Colors.textSecondary
                  }
                />
                <View>
                  <Text
                    style={[
                      styles.optionTitle,
                      rainfallSource === 'nowcast' && styles.optionTitleActiveCyan,
                    ]}
                  >
                    Model nowcast — forecast
                  </Text>
                  <Text style={styles.optionSub}>
                    AI-powered continuous prediction
                  </Text>
                </View>
              </View>
              {rainfallSource === 'nowcast' && (
                <Ionicons
                  name="checkmark-circle"
                  size={16}
                  color={Colors.cyan}
                />
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ── 2. FLOOD EVENT DATE DROPDOWN ────────────────────────────── */}
      <View style={styles.section}>
        <View style={styles.labelRow}>
          <Text style={styles.sectionLabel}>HISTORICAL FLOOD EVENT</Text>
          {eventsLoading && (
            <View style={styles.syncPill}>
              <ActivityIndicator size="small" color={Colors.gold} />
              <Text style={styles.syncPillText}>LOADING</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.selectBox,
            dateDropdownOpen && styles.selectBoxActive,
            events.length === 0 && { opacity: 0.6 },
          ]}
          onPress={() => {
            setDateDropdownOpen((prev) => !prev)
            setSourceDropdownOpen(false)
          }}
          disabled={eventsLoading || events.length === 0}
          activeOpacity={0.8}
        >
          <View style={styles.selectLeft}>
            <Ionicons name="calendar-outline" size={16} color={Colors.gold} />
            <View>
              <Text style={styles.selectValueText}>
                {event ||
                  (eventsLoading ? 'Loading events…' : 'No events available')}
              </Text>
              {event ? (
                <Text style={styles.selectSubtext} numberOfLines={1}>
                  {getEventSubtitle(event)}
                </Text>
              ) : null}
            </View>
          </View>
          <Ionicons
            name={dateDropdownOpen ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={Colors.gold}
          />
        </TouchableOpacity>

        {/* Dropdown items */}
        {dateDropdownOpen && (
          <View style={styles.optionsList}>
            {events.map((dateStr, index) => {
              const isSelected = dateStr === event
              const info = EVENT_METADATA[dateStr]
              const isLast = index === events.length - 1

              return (
                <TouchableOpacity
                  key={dateStr}
                  style={[
                    styles.optionItem,
                    isSelected && styles.optionItemActive,
                    isLast && { borderBottomWidth: 0 },
                  ]}
                  onPress={() => {
                    onSelectEvent(dateStr)
                    setDateDropdownOpen(false)
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.optionLeft}>
                    <View
                      style={[
                        styles.bulletDot,
                        isSelected && styles.bulletDotActive,
                      ]}
                    />
                    <View style={{ flex: 1 }}>
                      <View style={styles.dateTitleRow}>
                        <Text
                          style={[
                            styles.optionDateText,
                            isSelected && styles.optionDateTextActive,
                          ]}
                        >
                          {dateStr}
                        </Text>
                        {info && (
                          <View
                            style={[
                              styles.miniTag,
                              {
                                backgroundColor: `${info.tagColor}22`,
                                borderColor: `${info.tagColor}55`,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.miniTagText,
                                { color: info.tagColor },
                              ]}
                            >
                              {info.tag}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.optionSub} numberOfLines={1}>
                        {getEventSubtitle(dateStr)}
                      </Text>
                    </View>
                  </View>

                  {isSelected && (
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color={Colors.gold}
                    />
                  )}
                </TouchableOpacity>
              )
            })}
          </View>
        )}
      </View>

      {/* ── 3. ACCUMULATION WINDOW ──────────────────────────────────── */}
      <View style={styles.section}>
        <View style={styles.labelRow}>
          <Text style={styles.sectionLabel}>ACCUMULATION WINDOW</Text>
          {isWindowLoading ? (
            <View style={styles.windowLoadingBadge}>
              <ActivityIndicator size="small" color={Colors.cyan} />
              <Text style={styles.windowLoadingText}>LOADING {minutes}M MAP...</Text>
            </View>
          ) : activeWindow ? (
            <Text style={styles.windowTimeBadge}>
              {activeWindow.start_time} → {activeWindow.end_time}
            </Text>
          ) : null}
        </View>

        <View style={styles.windowChipsGrid}>
          {WINDOW_VALUES.map((wVal) => {
            const isSelected = minutes === wVal
            const isAvail =
              windows?.windows.some((w) => w.minutes === wVal) ?? true

            return (
              <TouchableOpacity
                key={wVal}
                style={[
                  styles.windowChip,
                  isSelected && styles.windowChipActive,
                  !isAvail && styles.windowChipDisabled,
                ]}
                onPress={() => isAvail && onSelectMinutes(wVal)}
                disabled={!isAvail || disabled}
                activeOpacity={0.8}
              >
                {isSelected && isWindowLoading ? (
                  <ActivityIndicator size="small" color={Colors.cyan} />
                ) : (
                  <Text
                    style={[
                      styles.windowChipText,
                      isSelected && styles.windowChipTextActive,
                    ]}
                  >
                    {wVal}m
                  </Text>
                )}
              </TouchableOpacity>
            )
          })}
        </View>
      </View>

      {/* ── 4. DRAINAGE NETWORK PANEL ───────────────────────────────── */}
      <View style={styles.section}>
        <View style={styles.labelRow}>
          <Text style={styles.sectionLabel}>DRAINAGE NETWORK</Text>
          {drainageStatus ? (
            <Text style={styles.drainageStatusText}>{drainageStatus}</Text>
          ) : null}
        </View>

        <View style={styles.drainageCard}>
          {drainageSummary ? (
            <View style={styles.drainageCounters}>
              <View style={styles.counterBox}>
                <Text style={styles.counterVal}>
                  <Text
                    style={{
                      color:
                        drainageSummary.surcharged_manholes > 0
                          ? Colors.capacityRed
                          : Colors.statusNormal,
                    }}
                  >
                    {drainageSummary.surcharged_manholes.toLocaleString()}
                  </Text>
                  {' of '}
                  {drainageSummary.total_manholes.toLocaleString()}
                </Text>
                <Text style={styles.counterSub}>manholes surcharged</Text>
              </View>

              <View style={styles.counterDivider} />

              <View style={styles.counterBox}>
                <Text style={styles.counterVal}>
                  <Text
                    style={{
                      color:
                        drainageSummary.surcharged_conduits > 0
                          ? Colors.capacityRed
                          : Colors.statusNormal,
                    }}
                  >
                    {drainageSummary.surcharged_conduits.toLocaleString()}
                  </Text>
                  {' of '}
                  {drainageSummary.total_conduits.toLocaleString()}
                </Text>
                <Text style={styles.counterSub}>conduits surcharged</Text>
              </View>
            </View>
          ) : (
            <Text style={styles.drainageUnavailable}>
              {drainageStatus || 'Drainage status unavailable for this event.'}
            </Text>
          )}

          {/* Toggle 1: Affected drainage */}
          <TouchableOpacity
            style={styles.switchRow}
            activeOpacity={0.8}
            onPress={() => onToggleAffectedDrainage(!showAffectedDrainage)}
          >
            <View style={styles.switchLeft}>
              <View
                style={[
                  styles.switchDot,
                  { backgroundColor: Colors.capacityAmber },
                ]}
              />
              <Text style={styles.switchLabel}>
                Show affected drainage (yellow/red)
              </Text>
            </View>
            <Switch
              value={showAffectedDrainage}
              onValueChange={onToggleAffectedDrainage}
              trackColor={{ false: '#1e293b', true: Colors.capacityAmber }}
              thumbColor={showAffectedDrainage ? Colors.gold : '#94a3b8'}
            />
          </TouchableOpacity>

          {/* Toggle 2: Full network */}
          <TouchableOpacity
            style={styles.switchRow}
            activeOpacity={0.8}
            onPress={() => onToggleFullDrainage(!showFullDrainage)}
          >
            <View style={styles.switchLeft}>
              <View
                style={[
                  styles.switchDot,
                  { backgroundColor: Colors.cyan },
                ]}
              />
              <Text style={styles.switchLabel}>
                Show full drainage network (34k+ points)
              </Text>
            </View>
            <Switch
              value={showFullDrainage}
              onValueChange={onToggleFullDrainage}
              trackColor={{ false: '#1e293b', true: Colors.cyan }}
              thumbColor={showFullDrainage ? Colors.gold : '#94a3b8'}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── 5. FSI SUSCEPTIBILITY METRICS ───────────────────────────── */}
      {summary && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>FLOOD SUSCEPTIBILITY METRICS</Text>
          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricVal}>
                {(summary.fsi_mean * 100).toFixed(1)}%
              </Text>
              <Text style={styles.metricDesc}>MEAN FSI</Text>
            </View>

            <View style={styles.metricCard}>
              <Text
                style={[
                  styles.metricVal,
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
              <Text style={styles.metricDesc}>PEAK RISK</Text>
            </View>

            <View style={styles.metricCard}>
              <Text
                style={[
                  styles.metricVal,
                  { color: Colors.statusNormal },
                ]}
              >
                {(summary.fsi_min * 100).toFixed(1)}%
              </Text>
              <Text style={styles.metricDesc}>MIN RISK</Text>
            </View>
          </View>
        </View>
      )}

      {/* ── 6. REFRESH BUTTON ───────────────────────────────────────── */}
      <TouchableOpacity
        style={styles.refreshBtn}
        onPress={onRefresh}
        activeOpacity={0.8}
      >
        <Ionicons name="refresh" size={14} color={Colors.gold} />
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
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 48,
  },
  section: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sectionLabel: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    color: Colors.gold,
    letterSpacing: 0.8,
    fontWeight: '700',
    marginBottom: 6,
  },
  syncPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  syncPillText: {
    fontFamily: Fonts.mono,
    fontSize: 8,
    color: Colors.gold,
    fontWeight: '700',
  },
  selectBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.35)',
  },
  selectBoxActive: {
    borderColor: Colors.gold,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  selectLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  selectValueText: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  selectSubtext: {
    fontFamily: Fonts.body,
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  optionsList: {
    backgroundColor: '#0a0e1a',
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: Colors.gold,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    overflow: 'hidden',
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  optionItemActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  bulletDotActive: {
    backgroundColor: Colors.gold,
  },
  dateTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  optionDateText: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  optionDateTextActive: {
    color: Colors.gold,
  },
  miniTag: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    borderWidth: 1,
  },
  miniTagText: {
    fontFamily: Fonts.mono,
    fontSize: 8,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  optionTitle: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  optionTitleActive: {
    color: Colors.gold,
    fontWeight: '700',
  },
  optionTitleActiveCyan: {
    color: Colors.cyan,
    fontWeight: '700',
  },
  optionSub: {
    fontFamily: Fonts.body,
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  windowTimeBadge: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    color: Colors.cyan,
  },
  windowLoadingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
  },
  windowLoadingText: {
    fontFamily: Fonts.mono,
    fontSize: 8.5,
    color: Colors.cyan,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  windowChipsGrid: {
    flexDirection: 'row',
    gap: 6,
  },
  windowChip: {
    flex: 1,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.2)',
  },
  windowChipActive: {
    backgroundColor: 'rgba(0, 229, 255, 0.18)',
    borderColor: Colors.cyan,
  },
  windowChipDisabled: {
    opacity: 0.3,
  },
  windowChipText: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  windowChipTextActive: {
    color: Colors.cyan,
  },
  drainageStatusText: {
    fontFamily: Fonts.body,
    fontSize: 9,
    color: Colors.statusNormal,
  },
  drainageCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  drainageCounters: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 6,
  },
  counterBox: {
    alignItems: 'center',
  },
  counterVal: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  counterSub: {
    fontFamily: Fonts.body,
    fontSize: 9,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  counterDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  drainageUnavailable: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 4,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  switchLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    paddingRight: 10,
  },
  switchDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  switchLabel: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.textPrimary,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metricCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
  },
  metricVal: {
    fontFamily: Fonts.mono,
    fontSize: 15,
    fontWeight: '800',
    color: Colors.gold,
  },
  metricDesc: {
    fontFamily: Fonts.mono,
    fontSize: 8,
    color: Colors.textSecondary,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.35)',
    marginTop: 4,
  },
  refreshBtnText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    color: Colors.gold,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
})
