declare module 'lucide-react' {
  import type { ComponentType, SVGProps } from 'react'

  export type LucideProps = SVGProps<SVGSVGElement> & {
    size?: string | number
    absoluteStrokeWidth?: boolean
  }

  export const Box: ComponentType<LucideProps>
  export const ChevronDown: ComponentType<LucideProps>
  export const ChevronLeft: ComponentType<LucideProps>
  export const ChevronRight: ComponentType<LucideProps>
  export const ChevronUp: ComponentType<LucideProps>
  export const Layers: ComponentType<LucideProps>
  export const Minus: ComponentType<LucideProps>
  export const Plus: ComponentType<LucideProps>
  export const Satellite: ComponentType<LucideProps>
}
