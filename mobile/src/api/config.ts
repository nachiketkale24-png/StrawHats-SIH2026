/**
 * API configuration.
 *
 * For Expo Go development, defaults to localhost / local IP.
 * Can be dynamically configured via the in-app Settings modal.
 */
import Constants from 'expo-constants'

const configuredApiBase = process.env.EXPO_PUBLIC_API_BASE_URL?.trim()

// Auto-detect dev machine IP from Expo debugger host if available
const getDebuggerHostIp = (): string => {
  const hostUri = Constants.expoConfig?.hostUri || (Constants as any).manifest2?.extra?.expoGo?.debuggerHost || (Constants as any).manifest?.debuggerHost
  if (hostUri) {
    const ip = hostUri.split(':')[0]
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return `http://${ip}:8000`
    }
  }
  return 'http://192.168.1.100:8000'
}

// Expo exposes EXPO_PUBLIC_* variables to the client bundle. Set this in
// mobile/.env for a physical device, for example:
// EXPO_PUBLIC_API_BASE_URL=http://10.179.221.175:8000
let currentApiBase = (configuredApiBase || getDebuggerHostIp()).replace(/\/+$/, '')

export const getApiBase = (): string => currentApiBase

export const setApiBase = (url: string): void => {
  currentApiBase = url.replace(/\/+$/, '')
}

export const API_BASE = currentApiBase
