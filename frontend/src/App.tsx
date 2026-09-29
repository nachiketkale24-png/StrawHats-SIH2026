import { useEffect, useState } from 'react'
import { Moon, Sun } from './components/icons'
import MumbaiFloodMap from './components/MumbaiFloodMap'
import GoogleMapPreview from './components/map/GoogleMapPreview'
import { ThemeContext } from './lib/theme'

export default function App() {
  const googlePreview = new URLSearchParams(window.location.search).get('map') === 'preview'
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try { return localStorage.getItem('mumbai-theme') === 'dark' ? 'dark' : 'light' } catch { return 'light' }
  })
  useEffect(() => {
    try { localStorage.setItem('mumbai-theme', theme) } catch { /* Storage may be disabled. */ }
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
      document.documentElement.setAttribute('data-theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      document.documentElement.setAttribute('data-theme', 'light')
    }
  }, [theme])
  return (
    <ThemeContext.Provider value={theme}>
      <div data-theme={theme} className={`google-map-preview ${theme === 'dark' ? 'dark' : ''} flex h-[100dvh] w-full flex-col overflow-hidden bg-[var(--bg-void)]`}>
        <header className="z-20 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-[var(--border-secondary)] bg-[var(--bg-primary)] px-4 sm:px-6 backdrop-blur-2xl shadow-sm">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 shadow-md ring-1 ring-white/20">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3C9 7 6 10 6 14a6 6 0 0 0 12 0c0-4-3-7-6-11Z" />
                <path d="M3 21h18" />
              </svg>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-sm font-bold tracking-tight text-[var(--text-heading)]">Mumbai Flood Portal</h1>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live GIS
                </span>
              </div>
              <span className="hidden text-[11px] text-[var(--text-secondary)] sm:block font-medium">Real-Time Risk Map &amp; Flood-Aware Safe Routing</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTheme(value => value === 'light' ? 'dark' : 'light')}
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
              title="Change interface theme"
              className="hud-button flex h-9 items-center gap-2 px-3 text-xs font-semibold"
            >
              {theme === 'light' ? (
                <>
                  <Moon size={15} className="text-slate-700" />
                  <span className="hidden sm:inline">Dark</span>
                </>
              ) : (
                <>
                  <Sun size={15} className="text-amber-400" />
                  <span className="hidden sm:inline">Light</span>
                </>
              )}
            </button>
          </div>
        </header>
        <main className="relative min-h-0 w-full flex-1 overflow-hidden">
          {googlePreview ? <GoogleMapPreview /> : <MumbaiFloodMap />}
        </main>
      </div>
    </ThemeContext.Provider>
  )
}
