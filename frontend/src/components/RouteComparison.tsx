import type { RouteComparison as Comparison } from '../lib/floodApi'
import type { RiskTolerance } from './RoutePanel'
import { ROUTE_COLORS } from '../lib/routeStyle'
import MapCard from './map/MapCard'

export default function RouteComparison({ routes, tolerance, onView }: {
  routes: Comparison; tolerance: RiskTolerance; onView?: () => void;
}) {
  const difference = routes.tolerance_distance_km === null ? null : routes.tolerance_distance_km - routes.normal_distance_km
  const label = tolerance[0].toUpperCase() + tolerance.slice(1)
  return <MapCard title="Route comparison"><section aria-label="Route comparison" className="rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-primary)] p-3 text-xs text-[var(--text-primary)] shadow-sm">
    <div className="flex items-center justify-between gap-2 border-b border-[var(--border-secondary)] pb-2">
      <span className="flex items-center gap-2 font-semibold"><span style={{ backgroundColor: ROUTE_COLORS.fastest, boxShadow: '0 0 0 1px #e2e8f0' }} className="h-[3px] w-5 rounded" />Fastest route</span>
      <strong>{routes.normal_distance_km.toFixed(2)} km</strong>
    </div>
    <dl className="my-2 grid grid-cols-2 gap-1 text-[11px] text-[var(--text-secondary)]">
      <dt>Maximum FSI</dt><dd className="text-right">{routes.normal_route.max_risk.toFixed(3)}</dd>
      <dt>Average FSI</dt><dd className="text-right">{routes.normal_route.avg_risk.toFixed(3)}</dd>
    </dl>
    <div className="flex items-center justify-between gap-2 border-t border-[var(--border-secondary)] pt-2">
      <span className="flex items-center gap-2 font-semibold text-[var(--cyan-primary)]"><span style={{ backgroundColor: ROUTE_COLORS.floodSafe }} className="h-1 w-5 rounded" />FloodSafe · {label} tolerance</span>
      <strong>{routes.tolerance_distance_km === null ? 'No qualifying route' : `${routes.tolerance_distance_km.toFixed(2)} km`}</strong>
    </div>
    {routes.tolerance_route && <dl className="mt-2 grid grid-cols-2 gap-1 text-[11px] text-[var(--text-secondary)]">
      <dt>Maximum FSI</dt><dd className="text-right">{routes.max_risk_on_route?.toFixed(3) ?? 'Unavailable'}</dd>
      <dt>High/severe segments</dt><dd className="text-right">{routes.high_severe_segment_count}</dd>
      <dt>Distance difference</dt><dd className="text-right">{difference === null ? 'Unavailable' : `${difference >= 0 ? '+' : ''}${difference.toFixed(2)} km`}</dd>
    </dl>}
    {onView && <button type="button" className="hud-button mt-3 w-full py-2 text-xs" onClick={onView}>View Route on Map</button>}
  </section></MapCard>
}
