import type { ReactNode, SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number | string }
const icon = (children: ReactNode) => ({ size = 18, ...props }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>{children}</svg>
)
export const Plus = icon(<><path d="M12 5v14"/><path d="M5 12h14"/></>)
export const Minus = icon(<path d="M5 12h14"/>)
export const Moon = icon(<path d="M20 14a8 8 0 0 1-10-10 8 8 0 1 0 10 10Z" />)
export const Sun = icon(<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5" /></>)
export const ChevronUp = icon(<path d="m18 15-6-6-6 6"/>)
export const ChevronDown = icon(<path d="m6 9 6 6 6-6"/>)
export const ChevronLeft = icon(<path d="m15 18-6-6 6-6"/>)
export const ChevronRight = icon(<path d="m9 18 6-6-6-6"/>)
export const Box = icon(<><path d="m21 8-9-5-9 5 9 5 9-5Z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></>)
export const Layers = icon(<><path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/></>)
export const Satellite = icon(<><path d="m13.5 6.5 4-4 4 4-4 4"/><path d="m10.5 17.5-4 4-4-4 4-4"/><path d="m14 10 7 7"/><path d="m3 7 7 7"/><circle cx="12" cy="12" r="3"/></>)
export const Activity = icon(<><path d="M3 12h4l2-8 4 16 2-8h6"/></>)
export const AlertCircle = icon(<><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></>)
export const ArrowUpDown = icon(<><path d="m7 15 5 5 5-5M7 9l5-5 5 5"/></>)
export const Calendar = icon(<><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></>)
export const Clock = icon(<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>)
export const Compass = icon(<><circle cx="12" cy="12" r="9"/><path d="m15 9-2 4-4 2 2-4 4-2Z"/></>)
export const Crosshair = icon(<><circle cx="12" cy="12" r="4"/><path d="M3 12h5M16 12h5M12 3v5M12 16v5"/></>)
export const Download = icon(<><path d="M12 3v12M7 10l5 5 5-5M4 21h16"/></>)
export const Locate = Crosshair
export const Loader2 = Activity
export const MapPin = icon(<><path d="M12 21s7-5 7-11a7 7 0 1 0-14 0c0 6 7 11 7 11Z"/><circle cx="12" cy="10" r="2"/></>)
export const Maximize2 = icon(<path d="M8 3H3v5M16 3h5v5M8 21H3v-5M21 16v5h-5"/>)
export const Minimize2 = Maximize2
export const Navigation = MapPin
export const Navigation2 = MapPin
export const RefreshCw = Activity
export const Route = Navigation
export const ShieldAlert = AlertCircle
export const ShieldCheck = AlertCircle
export const Sparkles = Activity
export const X = icon(<><path d="m6 6 12 12M18 6 6 18"/></>)
