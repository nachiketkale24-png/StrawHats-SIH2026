import React, { createContext, useContext, useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Colors as DarkColors } from './colors'
const LightColors = { ...DarkColors, bgVoid: '#f5f7fa', bgPrimary: '#ffffff', bgSecondary: '#f1f5f9', bgPanel: '#ffffff', bgSheet: '#ffffff', textPrimary: '#253047', textSecondary: '#52627b', textHeading: '#172033', gold: '#8a4b08', goldPrimary: '#8a4b08', goldLight: '#995309', borderPrimary: '#cbd5e1', borderSecondary: '#e2e8f0', borderActive: '#995309', cyan: '#007ea8', cyanPrimary: '#007ea8' }
type Palette = { [K in keyof typeof DarkColors]: string }
const Context = createContext<{ dark: boolean; colors: Palette; toggle: () => void; satellite: boolean; setSatellite: (value: boolean) => void }>({ dark: true, colors: DarkColors, toggle: () => {}, satellite: false, setSatellite: () => {} })
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useState(true)
  const [satellite, setSatelliteState] = useState(false)
  const [ready, setReady] = useState(false)
  useEffect(() => { AsyncStorage.multiGet(['flood-theme', 'flood-satellite']).then(values => { setDark(values[0][1] !== 'light'); setSatelliteState(values[1][1] === 'true') }).catch(() => {}).finally(() => setReady(true)) }, [])
  const toggle = () => setDark(value => { void AsyncStorage.setItem('flood-theme', value ? 'light' : 'dark').catch(() => {}); return !value })
  const setSatellite = (value: boolean) => { setSatelliteState(value); void AsyncStorage.setItem('flood-satellite', String(value)).catch(() => {}) }
  if (!ready) return null
  return <Context.Provider value={{ dark, colors: dark ? DarkColors : LightColors, toggle, satellite, setSatellite }}>{children}</Context.Provider>
}
export const useTheme = () => useContext(Context)
