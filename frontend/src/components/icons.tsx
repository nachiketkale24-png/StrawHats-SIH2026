import type { ReactNode, SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number | string }
const icon = (children: ReactNode) => ({ size = 18, ...props }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>{children}</svg>
)
export const Plus = icon(<><path d="M12 5v14"/><path d="M5 12h14"/></>)
export const Minus = icon(<path d="M5 12h14"/>)
export const ChevronUp = icon(<path d="m18 15-6-6-6 6"/>)
export const ChevronDown = icon(<path d="m6 9 6 6 6-6"/>)
export const ChevronLeft = icon(<path d="m15 18-6-6 6-6"/>)
export const ChevronRight = icon(<path d="m9 18 6-6-6-6"/>)
export const Box = icon(<><path d="m21 8-9-5-9 5 9 5 9-5Z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></>)
export const Layers = icon(<><path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/></>)
export const Satellite = icon(<><path d="m13.5 6.5 4-4 4 4-4 4"/><path d="m10.5 17.5-4 4-4-4 4-4"/><path d="m14 10 7 7"/><path d="m3 7 7 7"/><circle cx="12" cy="12" r="3"/></>)
