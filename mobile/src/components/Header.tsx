import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../theme/ThemeProvider'
interface HeaderProps { activeEvent?: string; loading?: boolean; onOpenSettings?: () => void }
export default function Header({ onOpenSettings }: HeaderProps) {
  const { colors, dark, toggle } = useTheme()
  const insets = useSafeAreaInsets()
  return <View style={{ paddingTop: insets.top, backgroundColor: colors.bgPanel, borderBottomWidth: 1, borderColor: colors.borderSecondary }}>
    <View style={{ height: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12 }}>
      <Ionicons name="water-outline" size={22} color={colors.gold} />
      <Text style={{ flex: 1, color: colors.textHeading, fontSize: 18, fontWeight: '600' }}>Mumbai Flood</Text>
      <TouchableOpacity onPress={toggle} accessibilityLabel={dark ? 'Switch to light theme' : 'Switch to dark theme'} style={{ padding: 8 }}><Ionicons name={dark ? 'sunny-outline' : 'moon-outline'} size={21} color={colors.textPrimary} /></TouchableOpacity>
      <TouchableOpacity onPress={onOpenSettings} accessibilityLabel="API settings" style={{ padding: 8 }}><Ionicons name="settings-outline" size={20} color={colors.textSecondary} /></TouchableOpacity>
    </View>
  </View>
}
