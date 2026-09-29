import { PanelLabel } from '../ui/Panel'
import { Layers } from '../icons'

export default function LayerControls({ flood, roads, traffic, satellite, ready, roadStatus,
  onFlood, onRoads, onTraffic, onSatellite }: {
  flood: boolean; roads: boolean; traffic: boolean; satellite: boolean; ready: boolean; roadStatus: string;
  onFlood: (value: boolean) => void; onRoads: (value: boolean) => void;
  onTraffic: (value: boolean) => void; onSatellite: (value: boolean) => void;
}) {
  const items = [
    { label: 'Flood Risk', checked: flood, change: onFlood, color: 'accent-sky-600' },
    { label: 'Road Risk', checked: roads, change: onRoads, color: 'accent-rose-500' },
    { label: 'Live Traffic', checked: traffic, change: onTraffic, color: 'accent-emerald-500' },
    { label: 'Satellite', checked: satellite, change: onSatellite, color: 'accent-cyan-500' },
  ]

  return (
    <fieldset aria-label="Map layers" className="hud-panel w-64 p-3.5 text-xs shadow-xl">
      <legend className="sr-only">Map layers</legend>
      <div className="flex items-center gap-1.5 pb-2 border-b border-[var(--border-secondary)]">
        <Layers size={13} className="text-[var(--cyan-primary)]" />
        <PanelLabel>Map Layer Visibility</PanelLabel>
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-2">
        {items.map(({ label, checked, change, color }) => (
          <label
            key={label}
            className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 transition select-none ${
              checked
                ? 'border-[var(--border-active)] bg-[var(--bg-secondary)] text-[var(--text-heading)] shadow-sm'
                : 'border-transparent hover:border-[var(--border-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <input
              type="checkbox"
              checked={checked}
              disabled={!ready}
              className={`h-3.5 w-3.5 rounded ${color}`}
              onChange={event => change(event.target.checked)}
            />
            <span className="text-[11px] font-medium">{label}</span>
          </label>
        ))}
      </div>
      {roads && <p role="status" className="mt-2 text-[10px] text-[var(--text-secondary)]">{roadStatus}</p>}
      {traffic && <p className="mt-2 text-[10px] leading-relaxed text-[var(--text-secondary)]">Current traffic where available.</p>}
    </fieldset>
  )
}

