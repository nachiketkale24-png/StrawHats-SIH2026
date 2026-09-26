import { Platform } from 'react-native'

/**
 * Typography definitions matching the web frontend's font stacks.
 */
const monoFont = Platform.select({
  ios: 'Courier',
  android: 'monospace',
  default: 'monospace',
})

const systemFont = Platform.select({
  ios: 'System',
  android: 'Roboto',
  default: 'sans-serif',
})

export const Fonts = {
  hud: 'JetBrainsMono',
  hudBold: 'JetBrainsMono-Bold',
  mono: monoFont,
  monoBold: monoFont,
  sans: systemFont,
  body: systemFont,
  bodyMedium: systemFont,
  bodySemiBold: systemFont,
  bodyBold: systemFont,
} as const

export const FontSizes = {
  xxs: 10,
  xs: 11,
  sm: 12,
  md: 13,
  base: 14,
  lg: 16,
  xl: 18,
  xxl: 24,
  xxxl: 30,
} as const
