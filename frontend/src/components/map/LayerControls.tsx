import { PanelLabel } from '../ui/Panel'

export default function LayerControls({ flood, roads, traffic, satellite, ready, roadStatus,
  onFlood, onRoads, onTraffic, onSatellite }: {
  flood: boolean; roads: boolean; traffic: boolean; satellite: boolean; ready: boolean; roadStatus: string;
  onFlood: (value: boolean) => void; onRoads: (value: boolean) => void;
  onTraffic: (value: boolean) => void; onSatellite: (value: boolean) => void;
}) {
  return <fieldset aria-label="Map layers" className="hud-panel w-60 p-3 text-xs">
    <legend className="sr-only">Map layers</legend>
    <PanelLabel>Map layers</PanelLabel>
    <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
      {[
        { label: 'Flood Risk', checked: flood, change: onFlood },
        { label: 'Road Risk', checked: roads, change: onRoads },
        { label: 'Traffic', checked: traffic, change: onTraffic },
        { label: 'Satellite', checked: satellite, change: onSatellite },
      ].map(({ label, checked, change }) => <label key={label} className="flex cursor-pointer items-center gap-2">
        <input type="checkbox" checked={checked} disabled={!ready} className="accent-[var(--gold-primary)]" onChange={event => change(event.target.checked)} />{label}
      </label>)}
    </div>
    {roads && <p role="status" className="mt-2 text-[10px] text-[var(--text-secondary)]">{roadStatus}</p>}
    {traffic && <p className="mt-2 text-[10px] text-[var(--text-secondary)]">Current traffic, where available. Display only; flood routes use the selected rainfall data.</p>}
  </fieldset>
}
