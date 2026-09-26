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
  }, [theme])
  return (
    <ThemeContext.Provider value={theme}><div data-theme={theme} className="google-map-preview flex h-[100dvh] w-full flex-col overflow-hidden bg-[var(--bg-void)]">
      <header className="z-20 flex h-12 shrink-0 items-center justify-between gap-3 border-b border-[var(--border-secondary)] bg-[var(--bg-primary)] px-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--gold-primary)] text-white">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
              <path d="M12 3C9 7 6 10 6 14a6 6 0 0 0 12 0c0-4-3-7-6-11Z" /><path d="M3 21h18" />
            </svg>
          </span>
          <h1 className="truncate text-sm font-semibold tracking-tight text-[var(--text-heading)]">Mumbai Flood</h1>
          <span className="hidden border-l border-[var(--border-secondary)] pl-3 text-xs text-[var(--text-secondary)] sm:block">Risk map &amp; route planning</span>
        </div>
        <button type="button" onClick={() => setTheme(value => value === 'light' ? 'dark' : 'light')}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`} title="Change interface theme"
          className="hud-button flex h-8 shrink-0 items-center gap-2 px-2.5 text-xs">
          {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
          <span className="hidden sm:inline">{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>
        </button>
      </header>
      <main className="relative min-h-0 w-full flex-1 overflow-hidden">
        {googlePreview ? <GoogleMapPreview /> : <MumbaiFloodMap />}
      </main>
    </div></ThemeContext.Provider>
  )
}
