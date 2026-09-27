import { useTheme } from '../theme/ThemeProvider'
/**
 * Floating status toast matching the web's loading/error banner.
 */
import React from 'react'
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Colors, Fonts } from '../theme'

interface Props {
  loading?: boolean
  error?: string
  routeStatus?: string
  message?: string
  isError?: boolean
  onDismissError?: () => void
}

export default function StatusToast({
  loading,
  error,
  routeStatus,
  message,
  isError,
}: Props) {
  const { colors: Colors } = useTheme()
  const styles = makeStyles(Colors)
  const displayError = error || (isError ? message : null)
  const displayLoading = loading || (routeStatus && !error)
  const displayMsg = displayError || routeStatus || message

  if (!displayMsg && !displayLoading) return null

  return (
    <View style={styles.wrapper} pointerEvents="none">
      <View style={[styles.toast, displayError ? styles.toastError : styles.toastNormal]}>
        {displayError ? (
          <Ionicons name="alert-circle" size={16} color="#f87171" />
        ) : displayLoading ? (
          <ActivityIndicator size="small" color={Colors.cyan} />
        ) : (
          <View style={styles.pingDot} />
        )}
        <Text style={[styles.text, displayError ? styles.textError : styles.textNormal]} numberOfLines={2}>
          {displayMsg || (loading ? 'Loading flood dataset…' : '')}
        </Text>
      </View>
    </View>
  )
}

const makeStyles = (Colors: ReturnType<typeof useTheme>["colors"]) => StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 10,
    left: 16,
    right: 16,
    zIndex: 40,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
    maxWidth: '92%',
  },
  toastNormal: {
    backgroundColor: 'rgba(12, 14, 26, 0.95)',
    borderColor: Colors.borderPrimary,
  },
  toastError: {
    backgroundColor: 'rgba(30, 10, 15, 0.95)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  pingDot: {
    height: 8,
    width: 8,
    borderRadius: 4,
    backgroundColor: Colors.cyanPrimary,
  },
  text: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    flexShrink: 1,
  },
  textNormal: {
    color: Colors.textPrimary,
  },
  textError: {
    color: '#fca5a5',
  },
})
