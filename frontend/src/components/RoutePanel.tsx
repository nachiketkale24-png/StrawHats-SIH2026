import type { MapMode, RoutePoint, RouteResult } from '../types/flood'
import Panel, { PanelCaption, PanelLabel } from './ui/Panel'

export type RiskTolerance = 'low' | 'medium' | 'high' | 'severe'

export const RISK_TOLERANCE_OPTIONS: { value: RiskTolerance; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'severe', label: 'Severe' },
]

interface RiskToleranceSelectorProps {
  value: RiskTolerance
  onChange: (value: RiskTolerance) => void
  disabled: boolean
}

// Shared with the API-backed route panel so it follows the existing forecast
// segmented-button pattern instead of introducing another control style.
export function RiskToleranceSelector({ value, onChange, disabled }: RiskToleranceSelectorProps) {
  return <div className="mt-3" aria-live="polite">
    <PanelLabel className="mb-2">Flood risk tolerance</PanelLabel>
    <div className="flex gap-1" role="group" aria-label="Flood risk tolerance">
      {RISK_TOLERANCE_OPTIONS.map(option => (
        <button
          key={option.value}
          type="button"
          className="hud-button flex-1 px-2 py-2 text-xs"
          disabled={disabled}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
    {value === 'severe' && <PanelCaption className="mt-1.5">Close to the fastest route because no flood risk is being avoided.</PanelCaption>}
  </div>
}

interface Props {
  mode: MapMode
  onModeChange: (mode: MapMode) => void
  start: RoutePoint | null
  end: RoutePoint | null
  route: RouteResult | null
  shortest: RouteResult | null
  onClear: () => void
  disabled: boolean
}
export default function RoutePanel({ mode, onModeChange, start, end, route, shortest, onClear, disabled }: Props) {
  const activeMode = disabled ? null : mode
  const instruction = activeMode === null ? 'Click a hotspot, node or edge'
    : activeMode === 'inspect' ? 'Inspecting hotspots and drainage'
    : !start ? 'Pick your start point' : !end ? 'Pick your destination' : ''
  return (
    <aside aria-label="Route picker">
      <Panel>
      <PanelLabel className="mb-3">Explore Mumbai</PanelLabel>
      <div className="mb-3 flex gap-2">
        <button type="button" className="hud-button flex-1 px-2 py-2 text-xs" disabled={disabled} aria-pressed={activeMode === 'inspect'} onClick={() => onModeChange('inspect')}>Inspect</button>
        <button type="button" className="hud-button flex-1 px-2 py-2 text-xs" disabled={disabled} aria-pressed={activeMode === 'route'} onClick={() => onModeChange('route')}>Pick route</button>
      </div>
      <div role="status">{instruction && <PanelCaption>{instruction}</PanelCaption>}</div>
      {start && <div className="mt-3 space-y-1 font-[family-name:var(--font-hud)]">
        <PanelCaption>A · {start.lat.toFixed(3)}, {start.lng.toFixed(3)}</PanelCaption>
        {end && <PanelCaption>B · {end.lat.toFixed(3)}, {end.lng.toFixed(3)}</PanelCaption>}
      </div>}
      {start && end && <div aria-live="polite"><PanelCaption className="mt-3 text-[var(--cyan-primary)]">
        {route && shortest ? route.distanceKm === 0 ? 'Choose a farther destination.' : `Depth-weighted: ${route.distanceKm.toFixed(1)} km · Shortest: ${shortest.distanceKm.toFixed(1)} km` : 'No connected road path between these points.'}
      </PanelCaption></div>}
      {start && <button type="button" className="hud-button mt-3 px-3 py-1.5 text-xs" onClick={onClear}>Clear route</button>}
      </Panel>
    </aside>
  )
}
