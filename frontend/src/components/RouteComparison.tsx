import type { RouteComparison as Comparison } from '../lib/floodApi'
import type { RiskTolerance } from './RoutePanel'
import { ROUTE_COLORS } from '../lib/routeStyle'
import MapCard from './map/MapCard'

export default function RouteComparison({ routes, tolerance, onView }: {
  routes: Comparison; tolerance: RiskTolerance; onView?: () => void;
}) {
  const difference = routes.tolerance_distance_km === null ? null : routes.tolerance_distance_km - routes.normal_distance_km
  const label = tolerance[0].toUpperCase() + tolerance.slice(1)
  return (
    <MapCard title="Route comparison">
      <section aria-label="Route comparison" className="rounded-2xl border border-[var(--border-secondary)] bg-[var(--bg-primary)] p-3.5 text-xs text-[var(--text-primary)] shadow-md backdrop-blur-xl">
        <div className="flex items-center justify-between gap-2 border-b border-[var(--border-secondary)] pb-2.5">
          <span className="flex items-center gap-2 font-bold">
            <span style={{ backgroundColor: ROUTE_COLORS.fastest, boxShadow: '0 0 0 1px rgba(255,255,255,0.2)' }} className="h-1.5 w-4 rounded-full" />
            Fastest Route
          </span>
          <strong className="font-mono text-xs">{routes.normal_distance_km.toFixed(2)} km</strong>
        </div>
        <dl className="my-2.5 grid grid-cols-2 gap-1.5 text-[11px] text-[var(--text-secondary)]">
          <dt>Maximum FSI</dt><dd className="text-right font-mono font-semibold text-rose-400">{routes.normal_route.max_risk.toFixed(3)}</dd>
          <dt>Average FSI</dt><dd className="text-right font-mono font-semibold">{routes.normal_route.avg_risk.toFixed(3)}</dd>
        </dl>
        <div className="flex items-center justify-between gap-2 border-t border-[var(--border-secondary)] pt-2.5">
          <span className="flex items-center gap-2 font-bold text-[var(--cyan-primary)]">
            <span style={{ backgroundColor: ROUTE_COLORS.floodSafe, boxShadow: '0 0 8px var(--cyan-glow)' }} className="h-1.5 w-4 rounded-full" />
            FloodSafe ({label})
          </span>
          <strong className="font-mono text-xs text-[var(--cyan-primary)]">
            {routes.tolerance_distance_km === null ? 'No qualifying route' : `${routes.tolerance_distance_km.toFixed(2)} km`}
          </strong>
        </div>
        {routes.tolerance_route && (
          <dl className="mt-2.5 grid grid-cols-2 gap-1.5 text-[11px] text-[var(--text-secondary)] border-t border-[var(--border-secondary)] pt-2">
            <dt>Max Route FSI</dt><dd className="text-right font-mono font-semibold text-emerald-400">{routes.max_risk_on_route?.toFixed(3) ?? '—'}</dd>
            <dt>High/Severe Areas</dt><dd className="text-right font-mono font-semibold">{routes.high_severe_segment_count}</dd>
            <dt>Distance Delta</dt><dd className="text-right font-mono font-semibold">{difference === null ? '—' : `${difference >= 0 ? '+' : ''}${difference.toFixed(2)} km`}</dd>
          </dl>
        )}
        {onView && (
          <button type="button" className="hud-button mt-3 w-full py-2 text-xs font-semibold" onClick={onView}>
            View Route on Map
          </button>
        )}
      </section>
    </MapCard>
  )
}
