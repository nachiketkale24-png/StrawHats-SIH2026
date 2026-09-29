import React, { createContext, useContext, useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Colors as DarkColors } from './colors'
import { restoreApiBase } from '../api/config'

// Mirrors the light token block in frontend/src/index.css.
const LightColors = {
  ...DarkColors,
  bgVoid: '#f1f5f9',
  bgPrimary: 'rgba(255,255,255,0.85)',
  bgSecondary: 'rgba(241,245,249,0.8)',
  bgPanel: 'rgba(255,255,255,0.88)',
  bgSheet: 'rgba(255,255,255,0.96)',
  surfaceRaised: 'rgba(255,255,255,0.9)',
  accentMuted: 'rgba(2,132,199,0.12)',
  accentStrong: 'rgba(2,132,199,0.2)',
  cyanMuted: 'rgba(2,132,199,0.12)',
  divider: 'rgba(226,232,240,0.9)',
  errorBackground: '#fff1f2',
  errorBorder: '#fecdd3',
  textError: '#be123c',
  textPrimary: '#1e293b',
  textSecondary: '#475569',
  textHeading: '#0f172a',
  onAccent: '#ffffff',
  gold: '#0284c7',
  goldPrimary: '#0284c7',
  goldLight: '#0369a1',
  cyan: '#0284c7',
  cyanPrimary: '#0284c7',
  cyanGlow: 'rgba(2,132,199,0.25)',
  borderPrimary: 'rgba(203,213,225,0.85)',
  borderSecondary: 'rgba(226,232,240,0.9)',
  borderActive: 'rgba(2,132,199,0.7)',
  emerald400: '#047857',
  emerald500: '#065f46',
  statusNormal: '#15803d',
  capacityAmber: '#a16207',
  capacityRed: '#b91c1c',
  amber400: '#d97706',
  rose300: '#be123c',
  rose400: '#be123c',
  red300: '#be123c',
  red500: '#b91c1c',
}
type Palette = { [K in keyof typeof DarkColors]: string }
const Context = createContext<{ dark: boolean; colors: Palette; toggle: () => void; satellite: boolean; setSatellite: (value: boolean) => void }>({ dark: false, colors: LightColors, toggle: () => {}, satellite: false, setSatellite: () => {} })
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useState(false)
  const [satellite, setSatelliteState] = useState(false)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    Promise.all([
      AsyncStorage.multiGet(['flood-theme', 'flood-satellite']).then(values => {
        setDark(values[0][1] === 'dark')
        setSatelliteState(values[1][1] === 'true')
      }).catch(() => {}),
      restoreApiBase(),
    ]).finally(() => setReady(true))
  }, [])
  const toggle = () => setDark(value => { void AsyncStorage.setItem('flood-theme', value ? 'light' : 'dark').catch(() => {}); return !value })
  const setSatellite = (value: boolean) => { setSatelliteState(value); void AsyncStorage.setItem('flood-satellite', String(value)).catch(() => {}) }
  if (!ready) return null
  return <Context.Provider value={{ dark, colors: dark ? DarkColors : LightColors, toggle, satellite, setSatellite }}>{children}</Context.Provider>
}
export const useTheme = () => useContext(Context)
