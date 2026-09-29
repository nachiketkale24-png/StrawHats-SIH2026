import { useTheme } from '../theme/ThemeProvider'
/**
 * Backend Connection Settings Modal.
 * Allows configuring the FastAPI server IP/URL and testing connection from Expo Go.
 */
import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { getApiBase, saveApiBase, suggestedApiBase } from '../api/config'
import { Colors, Fonts } from '../theme'

interface SettingsModalProps {
  visible: boolean
  onClose: () => void
  onSuccess: () => void
}

export function SettingsModal({ visible, onClose, onSuccess }: SettingsModalProps) {
  const { colors: Colors } = useTheme()
  const styles = makeStyles(Colors)
  const [url, setUrl] = useState(getApiBase())
  const [testing, setTesting] = useState(false)
  const [status, setStatus] = useState<{ type: 'idle' | 'success' | 'error'; message: string }>({
    type: 'idle',
    message: '',
  })

  const handleTestAndSave = async () => {
    const candidate = url.trim().replace(/\/+$/, '')
    if (!/^https?:\/\/[^\s/]+(?::\d+)?$/.test(candidate)) {
      setStatus({ type: 'error', message: 'Enter a full URL such as http://192.168.1.15:8000.' })
      return
    }

    setTesting(true)
    setStatus({ type: 'idle', message: '' })
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 6000)
      let events: string[]
      try {
        const response = await fetch(`${candidate}/flood/events`, { signal: controller.signal })
        if (!response.ok) throw new Error(`Server returned ${response.status} for /flood/events.`)
        events = await response.json()
        if (!Array.isArray(events)) throw new Error('This server did not return an event list.')
      } finally {
        clearTimeout(timeout)
      }
      await saveApiBase(candidate)

      setStatus({
        type: 'success',
        message: `Connected successfully! Found ${events.length} event(s).`,
      })
      setTimeout(() => {
        onSuccess()
        onClose()
      }, 1000)
    } catch (err: any) {
      setStatus({
        type: 'error',
        message: err.name === 'AbortError'
          ? 'Connection timed out. Check if phone & PC are on the same Wi-Fi.'
          : `${err?.message || 'Connection failed.'} Tried ${candidate}. Check the PC address and API port.`,
      })
    } finally {
      setTesting(false)
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Ionicons name="server" size={18} color={Colors.gold} />
              <Text style={styles.title}>Backend server settings</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.desc}>
            Use this PC's Wi-Fi IPv4 address and the API port. Run the API with --host 0.0.0.0, then connect your phone to the same Wi-Fi.
          </Text>
          {suggestedApiBase && <TouchableOpacity onPress={() => setUrl(suggestedApiBase || '')}>
            <Text style={styles.suggestion}>Use Expo host: {suggestedApiBase}</Text>
          </TouchableOpacity>}

          {/* Input */}
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              value={url}
              onChangeText={setUrl}
              placeholder="http://192.168.x.x:8000"
              placeholderTextColor={Colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </View>

          {/* Status Message */}
          {status.type !== 'idle' && (
            <View
              style={[
                styles.statusBox,
                status.type === 'success' ? styles.statusSuccess : styles.statusError,
              ]}
            >
              <Ionicons
                name={status.type === 'success' ? 'checkmark-circle' : 'alert-circle'}
                size={14}
                color={status.type === 'success' ? Colors.emerald400 : Colors.textError}
              />
              <Text
                style={[
                  styles.statusText,
                  status.type === 'success' ? styles.statusTextSuccess : styles.statusTextError,
                ]}
              >
                {status.message}
              </Text>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveBtn, testing && styles.saveBtnDisabled]}
              onPress={handleTestAndSave}
              disabled={testing}
            >
              {testing ? (
                <ActivityIndicator size="small" color={Colors.onAccent} />
              ) : (
                <Text style={styles.saveBtnText}>Test & Connect</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const makeStyles = (Colors: ReturnType<typeof useTheme>["colors"]) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  dialog: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: Colors.bgPanel,
    borderWidth: 1,
    borderColor: Colors.borderPrimary,
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 25,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13,
    color: Colors.gold,
    letterSpacing: 0,
  },
  closeBtn: {
    padding: 4,
  },
  desc: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 14,
  },
  suggestion: {
    color: Colors.cyan,
    fontSize: 12,
    marginBottom: 12,
  },
  inputWrap: {
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.borderSecondary,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  input: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    color: Colors.textPrimary,
    paddingVertical: 10,
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    marginBottom: 14,
  },
  statusSuccess: {
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.3)',
  },
  statusError: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  statusText: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: 12,
  },
  statusTextSuccess: {
    color: '#34d399',
  },
  statusTextError: {
    color: Colors.textError,
  },
  btnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  cancelBtnText: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  saveBtn: {
    backgroundColor: Colors.gold,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 110,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12,
    color: Colors.onAccent,
    fontWeight: '700',
  },
})
