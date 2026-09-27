import { useTheme } from '../theme/ThemeProvider'
/**
 * Reusable Address Input component with instant Mumbai landmark & Nominatim autocomplete suggestions.
 * Fixed zIndex and stacking context to prevent overlapping with destination box.
 */
import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
  Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { geocodeSuggest, type GeocodeResult } from '../api/floodApi'
import { Colors, Fonts } from '../theme'

interface AddressInputProps {
  label: 'A' | 'B'
  placeholder: string
  value: string
  onChangeText: (text: string) => void
  onSelectSuggestion: (suggestion: GeocodeResult) => void
  onClear: () => void
  onFocusChange?: (focused: boolean) => void
  disabled?: boolean
}

export function AddressInput({
  label,
  placeholder,
  value,
  onChangeText,
  onSelectSuggestion,
  onClear,
  onFocusChange,
  disabled,
}: AddressInputProps) {
  const { colors: Colors } = useTheme()
  const styles = makeStyles(Colors)
  const [suggestions, setSuggestions] = useState<GeocodeResult[]>([])
  const [isFocused, setIsFocused] = useState(false)
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const blurTimeout = useRef<any>(null)

  const showDropdown = isFocused && suggestions.length > 0

  useEffect(() => {
    if (!value.trim() || value.match(/^\s*(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)\s*$/)) {
      setSuggestions([])
      setLoadingSuggestions(false)
      return
    }

    const controller = new AbortController()
    setLoadingSuggestions(true)

    const timeoutId = setTimeout(() => {
      geocodeSuggest(value, controller.signal)
        .then((res) => {
          if (!controller.signal.aborted) {
            setSuggestions(res)
            setLoadingSuggestions(false)
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setSuggestions([])
            setLoadingSuggestions(false)
          }
        })
    }, 120)

    return () => {
      clearTimeout(timeoutId)
      controller.abort()
    }
  }, [value])

  const handleFocus = () => {
    if (blurTimeout.current) clearTimeout(blurTimeout.current)
    setIsFocused(true)
    onFocusChange?.(true)
  }

  const handleBlur = () => {
    blurTimeout.current = setTimeout(() => {
      setIsFocused(false)
      onFocusChange?.(false)
    }, 280)
  }

  const handleSelect = (item: GeocodeResult) => {
    if (blurTimeout.current) clearTimeout(blurTimeout.current)
    onSelectSuggestion(item)
    setSuggestions([])
    setIsFocused(false)
    onFocusChange?.(false)
    Keyboard.dismiss()
  }

  return (
    <View
      style={[
        styles.container,
        showDropdown && styles.containerElevated,
      ]}
    >
      <View
        style={[
          styles.inputRow,
          isFocused && styles.inputRowFocused,
          disabled && styles.inputRowDisabled,
        ]}
      >
        <View
          style={[
            styles.badge,
            label === 'A' ? styles.badgeA : styles.badgeB,
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              label === 'A' ? styles.badgeTextA : styles.badgeTextB,
            ]}
          >
            {label}
          </Text>
        </View>

        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={Colors.textSecondary}
          value={value}
          onChangeText={onChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          editable={!disabled}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />

        {loadingSuggestions && (
          <ActivityIndicator size="small" color={Colors.cyan} style={styles.iconBtn} />
        )}

        {value.length > 0 && !loadingSuggestions && (
          <TouchableOpacity
            onPress={onClear}
            style={styles.iconBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={16} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Autocomplete Suggestions Dropdown with Solid Background */}
      {showDropdown && (
        <View style={styles.suggestionsContainer}>
          <ScrollView
            keyboardShouldPersistTaps="always"
            nestedScrollEnabled
            showsVerticalScrollIndicator={true}
            style={styles.suggestionsScroll}
          >
            {suggestions.map((item, idx) => {
              const parts = item.displayName.split(',')
              const title = parts[0]
              const subtitle = parts.slice(1).join(',').trim()

              return (
                <TouchableOpacity
                  key={`${item.lat}-${item.lng}-${idx}`}
                  style={[
                    styles.suggestionItem,
                    idx === suggestions.length - 1 && styles.suggestionItemLast,
                  ]}
                  onPress={() => handleSelect(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.iconCircle}>
                    <Ionicons
                      name="location"
                      size={13}
                      color={label === 'A' ? '#10b981' : Colors.cyan}
                    />
                  </View>
                  <View style={styles.textColumn}>
                    <Text style={styles.suggestionTitle} numberOfLines={1}>
                      {title}
                    </Text>
                    {subtitle.length > 0 && (
                      <Text style={styles.suggestionSubtitle} numberOfLines={1}>
                        {subtitle}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        </View>
      )}
    </View>
  )
}

const makeStyles = (Colors: ReturnType<typeof useTheme>["colors"]) => StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 10,
    elevation: 10,
  },
  containerElevated: {
    zIndex: 1000,
    elevation: 1000,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.borderSecondary,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 2,
    minHeight: 44,
  },
  inputRowFocused: {
    borderColor: Colors.gold,
    backgroundColor: Colors.bgPanel,
  },
  inputRowDisabled: {
    opacity: 0.6,
  },
  badge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  badgeA: {
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
  },
  badgeB: {
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
  },
  badgeText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 11,
    fontWeight: '700',
  },
  badgeTextA: {
    color: '#34d399',
  },
  badgeTextB: {
    color: Colors.cyan,
  },
  input: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.textPrimary,
    paddingVertical: 8,
  },
  iconBtn: {
    padding: 4,
  },
  suggestionsContainer: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    backgroundColor: Colors.bgPanel, // 100% solid opaque dark panel
    borderWidth: 1,
    borderColor: Colors.borderPrimary,
    borderRadius: 12,
    maxHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.85,
    shadowRadius: 20,
    elevation: 1000,
    zIndex: 99999,
  },
  suggestionsScroll: {
    maxHeight: 200,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 175, 55, 0.12)',
    backgroundColor: Colors.bgPanel,
  },
  suggestionItemLast: {
    borderBottomWidth: 0,
  },
  iconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.bgSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  textColumn: {
    flex: 1,
  },
  suggestionTitle: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  suggestionSubtitle: {
    fontFamily: Fonts.body,
    fontSize: 10,
    color: Colors.textSecondary,
  },
})
