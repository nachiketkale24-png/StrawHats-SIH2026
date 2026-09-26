/**
 * API configuration for the Mumbai Flood App.
 * Default port set to 8001 to match backend server uvicorn instance.
 */
import Constants from 'expo-constants'

const configuredApiBase = process.env.EXPO_PUBLIC_API_BASE_URL?.trim()

// Auto-detect dev machine IP from Expo debugger host if available
const getDebuggerHostIp = (): string => {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost ||
    (Constants as any).manifest?.debuggerHost
  if (hostUri) {
    const ip = hostUri.split(':')[0]
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return `http://${ip}:8001`
    }
  }
  return 'http://10.65.25.109:8001'
}

let currentApiBase = (configuredApiBase || getDebuggerHostIp()).replace(/\/+$/, '')

const listeners: Array<(url: string) => void> = []

export const getApiBase = (): string => currentApiBase

export const setApiBase = (url: string): void => {
  currentApiBase = url.replace(/\/+$/, '')
  listeners.forEach((listener) => {
    try {
      listener(currentApiBase)
    } catch {}
  })
}

export const addApiBaseListener = (listener: (url: string) => void): (() => void) => {
  listeners.push(listener)
  return () => {
    const index = listeners.indexOf(listener)
    if (index !== -1) listeners.splice(index, 1)
  }
}

export const CARTO_API_KEY =
  process.env.EXPO_PUBLIC_CARTO_API_KEY?.trim() ||
  'cb1_3z00_1_64cd8bd9a5767edb51139ddf'

export const API_BASE = currentApiBase
