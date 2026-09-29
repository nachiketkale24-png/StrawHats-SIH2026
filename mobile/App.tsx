import React from 'react'
import { StatusBar } from 'expo-status-bar'
import { StyleSheet, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { NavigationBar } from 'expo-navigation-bar'
import MapScreen from './src/screens/MapScreen'
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider'

function Content() {
  const { dark, colors } = useTheme()
  return <View style={{ flex: 1, backgroundColor: colors.bgVoid }}><StatusBar style={dark ? 'light' : 'dark'} /><NavigationBar style={dark ? 'dark' : 'light'} /><MapScreen /></View>
}

export default function App() {
  return (
    <SafeAreaProvider style={styles.container}>
      <ThemeProvider><Content /></ThemeProvider>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
})
