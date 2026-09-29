/**
 * Design tokens translated from the web frontend's index.css CSS variables.
 * Keeps the exact same visual language across platforms.
 */
export const Colors = {
  // Gold accent family
  goldPrimary: '#d4af37',
  gold: '#d4af37',
  goldLight: '#fcd34d',
  goldRgb: '212,175,55',

  // Cyan accent
  cyanPrimary: '#38bdf8',
  cyan: '#38bdf8',
  cyanGlow: 'rgba(56, 189, 248, 0.35)',

  // Backgrounds
  bgVoid: '#05070e',
  bgPrimary: 'rgba(15, 21, 35, 0.72)',
  bgSecondary: 'rgba(20, 28, 45, 0.65)',
  bgPanel: 'rgba(13, 18, 30, 0.82)',
  bgSheet: 'rgba(10, 15, 25, 0.94)',
  surfaceRaised: 'rgba(20, 28, 45, 0.7)',
  accentMuted: 'rgba(212,175,55,0.12)',
  accentStrong: 'rgba(212,175,55,0.18)',
  cyanMuted: 'rgba(56,189,248,0.12)',
  divider: 'rgba(255,255,255,0.1)',
  errorBackground: 'rgba(30,10,15,0.95)',
  errorBorder: 'rgba(239,68,68,0.4)',
  textError: '#fca5a5',

  // Flood depth scale
  depthLow: '#54768a',
  depthYellow: '#e8c968',
  depthOrange: '#e28b36',
  depthRed: '#e25555',

  // Heat scale
  heatLow: '#fff0b3',
  heatYellow: '#f9c74f',
  heatOrange: '#f98432',
  heatRed: '#aa1d22',

  // Status
  statusNormal: '#4ade80',
  capacityAmber: '#fbbf24',
  capacityRed: '#f87171',

  // Emerald (active model badge, etc.)
  emerald400: '#34d399',
  emerald500: '#10b981',

  // Borders
  borderPrimary: 'rgba(212,175,55,0.32)',
  borderSecondary: 'rgba(255,255,255,0.1)',
  borderActive: 'rgba(212,175,55,0.65)',

  // Text
  textPrimary: '#f1f5f9',
  textSecondary: '#94a3b8',
  textHeading: '#ffffff',
  onAccent: '#080b12',

  // Route colors (from eventLayers.ts)
  routeNormal: '#94a3b8',
  routeSafe: '#22d3ee',

  // Error / status
  rose300: '#fda4af',
  rose400: '#fb7185',
  amber400: '#fbbf24',
  cyan300: '#67e8f9',
  red300: '#fca5a5',
  red500: '#ef4444',

  // Transparent helpers
  transparent: 'transparent',
  black50: 'rgba(0,0,0,0.5)',
  white: '#ffffff',
} as const

export const FsiColors = {
  low: '#38bdf8',
  medium: '#facc15',
  high: '#fb923c',
  severe: '#ef4444',
} as const

/** FSI color scale matching eventLayers.ts */
export const FSI_COLORS = ['#38bdf8', '#facc15', '#fb923c', '#ef4444'] as const

export const FSI_LEGEND = [
  { label: 'Low Susceptibility', range: '0.00 – 0.25', color: FSI_COLORS[0] },
  { label: 'Medium Susceptibility', range: '0.25 – 0.50', color: FSI_COLORS[1] },
  { label: 'High Susceptibility', range: '0.50 – 0.75', color: FSI_COLORS[2] },
  { label: 'Severe Susceptibility', range: '0.75 – 1.00', color: FSI_COLORS[3] },
] as const
