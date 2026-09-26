import { useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronDown, ChevronUp } from '../icons'

export default function MapCard({ title, children, className = '', hidden = false }: {
  title: string; children: ReactNode; className?: string; hidden?: boolean
}) {
  const [collapsed, setCollapsed] = useState(false)
  const reducedMotion = useReducedMotion()
  // Avoid conflicting positioning utilities: relative overrides absolute in
  // generated CSS regardless of their order in the class attribute.
  const positioned = className.split(/\s+/).some(token => ['absolute', 'fixed', 'sticky', 'relative'].includes(token))
  return <div className={`${positioned ? '' : 'relative'} ${className}`}>
    <AnimatePresence initial={false}>
      {!hidden && <motion.div key="card" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }} transition={{ duration: reducedMotion ? 0 : 0.16 }}>
        <AnimatePresence initial={false} mode="wait">
        <motion.div key={collapsed ? 'closed' : 'open'} initial={{ opacity: 0, y: -3 }} animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -3 }} transition={{ duration: reducedMotion ? 0 : 0.12 }}>
        {collapsed ? <button type="button" aria-label={`Show ${title}`} aria-expanded={false}
          className="hud-button flex items-center gap-2 rounded-lg px-3 py-2 text-xs shadow-sm"
          onClick={() => setCollapsed(false)}>{title}<ChevronDown size={14} /></button> : <>
          <button type="button" aria-label={`Hide ${title}`} title={`Hide ${title}`} aria-expanded={true}
            className="hud-button absolute -right-1 -top-1 z-30 flex h-6 w-6 items-center justify-center rounded-full shadow-sm"
            onClick={() => setCollapsed(true)}><ChevronUp size={13} /></button>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reducedMotion ? 0 : 0.16 }}>{children}</motion.div>
        </>}
        </motion.div>
        </AnimatePresence>
      </motion.div>}
    </AnimatePresence>
  </div>
}
