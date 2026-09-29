/**
 * API configuration.
 *
 * For Expo Go development, defaults to localhost / local IP.
 * Can be dynamically configured via the in-app Settings modal.
 */
import Constants from 'expo-constants'
import AsyncStorage from '@react-native-async-storage/async-storage'

const configuredApiBase = process.env.EXPO_PUBLIC_API_BASE_URL?.trim()
const STORAGE_KEY = 'flood-api-base'

// Auto-detect dev machine IP from Expo debugger host if available
const getDebuggerHostIp = (): string | null => {
  const hostUri = Constants.expoConfig?.hostUri || (Constants as any).manifest2?.extra?.expoGo?.debuggerHost || (Constants as any).manifest?.debuggerHost
  if (hostUri) {
    const ip = hostUri.replace(/^[a-z]+:\/\//i, '').split(':')[0]
    // Expo tunnel hostnames do not identify the PC's address on the phone's LAN.
    if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip)) {
      return `http://${ip}:8000`
    }
  }
  return null
}

// Expo exposes EXPO_PUBLIC_* variables to the client bundle. Set this in
// mobile/.env for a physical device, for example:
// EXPO_PUBLIC_API_BASE_URL=http://192.168.1.15:8000
export const suggestedApiBase = getDebuggerHostIp()
let currentApiBase = (suggestedApiBase || configuredApiBase || 'http://localhost:8000').replace(/\/+$/, '')

export async function restoreApiBase(): Promise<void> {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY)
    if (saved) currentApiBase = saved
  } catch { /* The default remains usable when device storage is unavailable. */ }
}

export const getApiBase = (): string => currentApiBase

export const setApiBase = (url: string): void => {
  currentApiBase = url.trim().replace(/\/+$/, '')
}

export async function saveApiBase(url: string): Promise<void> {
  setApiBase(url)
  await AsyncStorage.setItem(STORAGE_KEY, currentApiBase)
}
