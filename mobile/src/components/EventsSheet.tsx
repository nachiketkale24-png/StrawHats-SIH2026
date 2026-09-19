/**
 * Events sheet content — matches the web's "Events" mobile tab content.
 * Event date picker, refresh, time interval buttons, FSI summary stats, download link.
 */
import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Linking,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Colors, Fonts, FontSizes } from '../theme'
import { API_BASE } from '../api/config'
import { windowQuery } from '../api/floodApi'
import type { EventSummary, EventWindows, EventWindow } from '../api/floodApi'

interface Props {
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

export default function EventsSheet({
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
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Event selection */}
      <View>
        <Text style={styles.label}>HISTORICAL DATE SELECTION</Text>
        <View style={styles.pickerRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.eventScrollContainer}
            contentContainerStyle={styles.eventScroll}
          >
            {events.length === 0 && (
              <Text style={styles.emptyText}>
                {eventsLoading ? 'Loading events…' : 'No events found'}
              </Text>
            )}
            {events.map((date) => (
              <TouchableOpacity
                key={date}
                style={[
                  styles.eventChip,
                  event === date && styles.eventChipActive,
                ]}
                onPress={() => onSelectEvent(date)}
                disabled={eventsLoading}
              >
                <Text
                  style={[
                    styles.eventChipText,
                    event === date && styles.eventChipTextActive,
                  ]}
                >
                  {date}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={onRefresh}
            disabled={eventsLoading}
          >
            <Ionicons
              name="refresh"
              size={16}
              color={eventsLoading ? Colors.textSecondary : Colors.goldLight}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Time intervals */}
      <View>
        <View style={styles.labelRow}>
          <Text style={styles.label}>ACCUMULATION WINDOW</Text>
          {activeWindow && (
            <Text style={styles.windowTime}>
              {activeWindow.start_time.slice(11, 16)} →{' '}
              {activeWindow.end_time.slice(11, 16)}
            </Text>
          )}
        </View>
        <View style={styles.intervalGrid}>
          {WINDOW_VALUES.map((val) => {
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
              >
                <Text
                  style={[
                    styles.intervalBtnText,
                    isActive && styles.intervalBtnTextActive,
                  ]}
                >
                  {val} min
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>
      </View>

      {/* FSI Stats */}
      {summary && (
        <View style={styles.statsContainer}>
          <Text style={styles.statsTitle}>EVENT SUMMARY INDEX</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>MIN</Text>
              <Text style={styles.statValue}>{summary.fsi_min.toFixed(2)}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>MEAN</Text>
              <Text style={[styles.statValue, { color: Colors.cyanPrimary }]}>
                {summary.fsi_mean.toFixed(2)}
              </Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>MAX</Text>
              <Text style={[styles.statValue, { color: Colors.amber400 }]}>
                {summary.fsi_max.toFixed(2)}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Download link */}
      {intervalReady && (
        <TouchableOpacity
          style={styles.downloadBtn}
          onPress={() => {
            const url = `${API_BASE}/flood/raster/${encodeURIComponent(event)}${windowQuery(selectedMinutes)}`
            Linking.openURL(url)
          }}
        >
          <Ionicons name="download-outline" size={14} color={Colors.goldLight} />
          <Text style={styles.downloadText}>Download FSI GeoTIFF</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { gap: 16, paddingBottom: 24 },
  label: {
    fontFamily: Fonts.hud,
    fontSize: FontSizes.xs,
    fontWeight: '600',
    letterSpacing: 1.4,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  windowTime: {
    fontFamily: Fonts.hud,
    fontSize: FontSizes.xs,
    color: Colors.goldLight,
  },
  pickerRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  eventScrollContainer: { flex: 1 },
  eventScroll: { gap: 6 },
  emptyText: {
    fontSize: 13,
    color: Colors.textSecondary,
    paddingVertical: 8,
  },
  eventChip: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.borderPrimary,
    backgroundColor: Colors.bgPrimary,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  eventChipActive: {
    borderColor: Colors.goldPrimary,
    backgroundColor: 'rgba(212,175,55,0.15)',
  },
  eventChipText: {
    fontFamily: Fonts.hud,
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  eventChipTextActive: {
    color: Colors.goldLight,
    fontWeight: '700',
  },
  refreshBtn: {
    height: 44,
    width: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.borderSecondary,
    backgroundColor: Colors.bgPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  intervalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  intervalBtn: {
    flex: 1,
    minWidth: '30%',
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.borderSecondary,
    backgroundColor: Colors.bgPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  intervalBtnActive: {
    borderColor: Colors.goldPrimary,
    backgroundColor: Colors.goldPrimary,
  },
  intervalBtnDisabled: {
    opacity: 0.4,
  },
  intervalBtnText: {
    fontFamily: Fonts.hud,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  intervalBtnTextActive: {
    color: Colors.bgPrimary,
    fontWeight: '700',
  },
  statsContainer: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderSecondary,
    backgroundColor: Colors.bgPrimary,
    padding: 12,
  },
  statsTitle: {
    fontFamily: Fonts.hud,
    fontSize: FontSizes.xxs,
    letterSpacing: 1.2,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  statBox: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: Colors.bgSecondary,
    padding: 8,
    alignItems: 'center',
  },
  statLabel: {
    fontFamily: Fonts.hud,
    fontSize: FontSizes.xxs,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  statValue: {
    fontFamily: Fonts.hud,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.4)',
    backgroundColor: 'rgba(212,175,55,0.1)',
    paddingVertical: 12,
  },
  downloadText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.goldLight,
  },
})
