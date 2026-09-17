/**
 * API configuration.
 *
 * For Expo Go development, defaults to localhost / local IP.
 * Can be dynamically configured via the in-app Settings modal.
 */
import Constants from 'expo-constants'

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

let currentApiBase = getDebuggerHostIp()

export const getApiBase = (): string => currentApiBase

export const setApiBase = (url: string): void => {
  currentApiBase = url.replace(/\/+$/, '')
}

export const API_BASE = currentApiBase
