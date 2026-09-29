import { useState, useEffect, useCallback } from 'react'
import {
  AlertCircle,
  ArrowRight,
  ArrowUpDown,
  Briefcase,
  Bus,
  Car,
  CheckCircle,
  Loader2,
  Plus,
  Route,
  ShieldAlert,
  Sparkles,
  Train,
  Trash2,
  X
} from './icons'
import {
  getSavedCommutes,
  saveCommute,
  deleteCommute,
  generateCommuteAdvisory
} from '../lib/commuteStorage'
import type { SavedCommute, CommuteAssessment } from '../lib/commuteStorage'
import { geocodeAddress, geocodeSuggest, getRoutes } from '../lib/floodApi'
import type { GeocodeResult, RainfallSource, RouteComparison } from '../lib/floodApi'
import type { RiskTolerance } from './RoutePanel'
import type { RoutePoint } from '../types/flood'

interface CommuteMonitorProps {
  event: string
  selectedMinutes?: number
  rainfallSource: RainfallSource
  intervalReady: boolean
  onApplyRouteToMap: (start: RoutePoint, end: RoutePoint, routeResult?: RouteComparison) => void
  onClearMapRoute?: () => void
  onCloseSheet?: () => void
}

const POPULAR_COMMUTE_PRESETS = [
  { name: 'BKC', query: 'Bandra Kurla Complex, Mumbai' },
  { name: 'Andheri (E)', query: 'Andheri East, Mumbai' },
  { name: 'Dadar', query: 'Dadar Station, Mumbai' },
  { name: 'Lower Parel', query: 'Lower Parel, Mumbai' },
  { name: 'Borivali', query: 'Borivali West, Mumbai' },
  { name: 'Goregaon', query: 'Goregaon East, Mumbai' },
  { name: 'Kurla', query: 'Kurla, Mumbai' },
  { name: 'Colaba', query: 'Colaba, Mumbai' }
]

function useSuggestions(query: string, setSuggestions: (s: GeocodeResult[]) => void) {
  useEffect(() => {
    if (!query.trim() || query.match(/^\s*(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)\s*$/)) {
      setSuggestions([])
      return
    }
    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      geocodeSuggest(query, controller.signal)
        .then(res => {
          if (!controller.signal.aborted) setSuggestions(res)
        })
        .catch(() => {
          if (!controller.signal.aborted) setSuggestions([])
        })
    }, 400)
    return () => {
      clearTimeout(timeoutId)
      controller.abort()
    }
  }, [query, setSuggestions])
}

export default function CommuteMonitor({
  event,
  selectedMinutes,
  rainfallSource,
  intervalReady,
  onApplyRouteToMap,
  onClearMapRoute,
  onCloseSheet
}: CommuteMonitorProps) {
  const [commutes, setCommutes] = useState<SavedCommute[]>([])
  const [selectedCommuteId, setSelectedCommuteId] = useState<string>('')

  // Assessment state
  const [loadingAssessment, setLoadingAssessment] = useState(false)
  const [currentRouteComparison, setCurrentRouteComparison] = useState<RouteComparison | null>(null)
  const [assessment, setAssessment] = useState<CommuteAssessment | null>(null)
  const [assessmentError, setAssessmentError] = useState('')

  // Add Commute modal / inline form state
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newOriginQuery, setNewOriginQuery] = useState('')
  const [newDestQuery, setNewDestQuery] = useState('')
  const [originSuggestions, setOriginSuggestions] = useState<GeocodeResult[]>([])
  const [destSuggestions, setDestSuggestions] = useState<GeocodeResult[]>([])
  const [originFocused, setOriginFocused] = useState(false)
  const [destFocused, setDestFocused] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState('')

  useSuggestions(newOriginQuery, setOriginSuggestions)
  useSuggestions(newDestQuery, setDestSuggestions)

  // Load saved commutes on mount
  useEffect(() => {
    const list = getSavedCommutes()
    setCommutes(list)
    if (list.length > 0 && !selectedCommuteId) {
      setSelectedCommuteId(list[0].id)
    }
  }, [])

  const selectedCommute = commutes.find(c => c.id === selectedCommuteId) || commutes[0]

  // Assess commute when selection or rainfall event changes
  const evaluateSelectedCommute = useCallback(async () => {
    if (!selectedCommute || !intervalReady || !event) return
    setLoadingAssessment(true)
    setAssessmentError('')
    setCurrentRouteComparison(null)

    const controller = new AbortController()
    try {
      const result = await getRoutes(
        event,
        selectedCommute.origin,
        selectedCommute.destination,
        'low' as RiskTolerance,
        controller.signal,
        selectedMinutes,
        rainfallSource
      )

      setCurrentRouteComparison(result)

      const normalMax = result.normal_route.max_risk
      const normalAvg = result.normal_route.avg_risk
      const normalDistM = result.normal_route.length_m
      const normalDistKm = result.normal_distance_km

      const altDistKm = result.tolerance_distance_km ?? (result.suggested_route ? result.suggested_route.length_m / 1000 : null)
      const altMaxRisk = result.max_risk_on_route ?? (result.suggested_route ? result.suggested_route.max_risk : null)
      const hasAlt = (result.tolerance_route !== null || result.suggested_route !== null) && altMaxRisk !== null && altMaxRisk < normalMax

      const advisory = generateCommuteAdvisory(normalMax, normalAvg, normalDistM, {
        max_risk: altMaxRisk,
        distance_km: altDistKm
      })

      const assessmentObj: CommuteAssessment = {
        commuteId: selectedCommute.id,
        maxRisk: normalMax,
        avgRisk: normalAvg,
        lengthKm: Number(normalDistKm.toFixed(2)),
        status: advisory.status,
        statusText: advisory.statusText,
        hasAlternative: hasAlt,
        alternativeLengthKm: altDistKm !== null ? Number(altDistKm.toFixed(2)) : undefined,
        alternativeMaxRisk: altMaxRisk !== null ? Number(altMaxRisk.toFixed(3)) : undefined,
        detourExtraKm: altDistKm !== null ? Number(Math.max(0, altDistKm - normalDistKm).toFixed(2)) : undefined,
        transitAdvisory: {
          title: advisory.title,
          recommendation: advisory.recommendation,
          preferredModes: advisory.preferredModes,
          warning: advisory.warning
        }
      }

      setAssessment(assessmentObj)
    } catch (err: any) {
      if (!controller.signal.aborted) {
        setAssessmentError(err.message || 'Unable to assess route flood risk')
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoadingAssessment(false)
      }
    }
  }, [selectedCommute, intervalReady, event, selectedMinutes, rainfallSource])

  useEffect(() => {
    evaluateSelectedCommute()
  }, [evaluateSelectedCommute])

  // Save new commute handler
  const handleCreateCommute = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newOriginQuery.trim() || !newDestQuery.trim()) {
      setFormError('Please enter both origin and destination.')
      return
    }

    setFormLoading(true)
    setFormError('')

    try {
      const controller = new AbortController()
      const [originRes, destRes] = await Promise.all([
        geocodeAddress(newOriginQuery, controller.signal),
        geocodeAddress(newDestQuery, controller.signal)
      ])

      if (!originRes) {
        setFormError(`Origin "${newOriginQuery}" not found. Try including "Mumbai".`)
        setFormLoading(false)
        return
      }
      if (!destRes) {
        setFormError(`Destination "${newDestQuery}" not found. Try including "Mumbai".`)
        setFormLoading(false)
        return
      }

      const origClean = originRes.displayName.split(',')[0] || originRes.displayName
      const destClean = destRes.displayName.split(',')[0] || destRes.displayName
      const autoName = newName.trim() || `${origClean} ➔ ${destClean}`

      const created = saveCommute({
        name: autoName,
        originName: origClean,
        origin: { lat: originRes.lat, lng: originRes.lng },
        destinationName: destClean,
        destination: { lat: destRes.lat, lng: destRes.lng },
        notes: 'User saved commute'
      })

      const updated = getSavedCommutes()
      setCommutes(updated)
      setSelectedCommuteId(created.id)
      setIsAddingNew(false)
      setNewName('')
      setNewOriginQuery('')
      setNewDestQuery('')
    } catch (err: any) {
      setFormError(err.message || 'Geocoding failed. Check connection.')
    } finally {
      setFormLoading(false)
    }
  }

  // Reverse current commute
  const handleReverseCommute = () => {
    if (!selectedCommute) return
    const reversedName = `${selectedCommute.destinationName} ➔ ${selectedCommute.originName}`
    const created = saveCommute({
      name: reversedName,
      originName: selectedCommute.destinationName,
      origin: selectedCommute.destination,
      destinationName: selectedCommute.originName,
      destination: selectedCommute.origin,
      notes: 'Reversed return commute'
    })
    const updated = getSavedCommutes()
    setCommutes(updated)
    setSelectedCommuteId(created.id)
  }

  // Delete commute
  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const updated = deleteCommute(id)
    setCommutes(updated)
    if (selectedCommuteId === id) {
      setSelectedCommuteId(updated[0]?.id || '')
      if (onClearMapRoute) onClearMapRoute()
    }
  }

  // Apply to Map
  const handleApplyToMap = () => {
    if (!selectedCommute) return
    onApplyRouteToMap(
      selectedCommute.origin,
      selectedCommute.destination,
      currentRouteComparison || undefined
    )
    if (onCloseSheet) {
      onCloseSheet()
    }
  }

  const getStatusBadge = (status?: CommuteAssessment['status']) => {
    switch (status) {
      case 'severe':
        return {
          bg: 'bg-transparent border-2 border-rose-500/80 dark:bg-rose-950/40 dark:border-rose-500/50',
          textColor: 'text-rose-600 dark:text-rose-200',
          fsiColor: 'text-rose-600 dark:text-rose-300',
          warningBox: 'bg-transparent border border-rose-500/80 text-rose-600 dark:bg-rose-950/40 dark:border-rose-500/30 dark:text-rose-200',
          icon: <ShieldAlert size={16} className="text-rose-600 dark:text-rose-400 shrink-0" />,
          label: 'SEVERE FLOOD HAZARD'
        }
      case 'high':
        return {
          bg: 'bg-transparent border-2 border-orange-500/80 dark:bg-orange-950/40 dark:border-orange-500/50',
          textColor: 'text-orange-600 dark:text-orange-200',
          fsiColor: 'text-orange-600 dark:text-orange-300',
          warningBox: 'bg-transparent border border-orange-500/80 text-orange-600 dark:bg-orange-950/40 dark:border-orange-500/30 dark:text-orange-200',
          icon: <AlertCircle size={16} className="text-orange-600 dark:text-orange-400 shrink-0" />,
          label: 'HIGH WATERLOGGING'
        }
      case 'moderate':
        return {
          bg: 'bg-transparent border-2 border-amber-500/80 dark:bg-amber-950/40 dark:border-amber-500/50',
          textColor: 'text-amber-600 dark:text-amber-200',
          fsiColor: 'text-amber-600 dark:text-amber-300',
          warningBox: 'bg-transparent border border-amber-500/80 text-amber-600 dark:bg-amber-950/40 dark:border-amber-500/30 dark:text-amber-200',
          icon: <AlertCircle size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />,
          label: 'MODERATE RUNOFF'
        }
      case 'low':
      default:
        return {
          bg: 'bg-transparent border-2 border-emerald-500/80 dark:bg-emerald-950/40 dark:border-emerald-500/50',
          textColor: 'text-emerald-600 dark:text-emerald-200',
          fsiColor: 'text-emerald-600 dark:text-emerald-300',
          warningBox: 'bg-transparent border border-emerald-500/80 text-emerald-600 dark:bg-emerald-950/40 dark:border-emerald-500/30 dark:text-emerald-200',
          icon: <CheckCircle size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />,
          label: 'ROUTE CLEAR & SAFE'
        }
    }
  }

  const badgeInfo = getStatusBadge(assessment?.status)

  return (
    <div className="flex flex-col gap-3 font-sans">
      {/* Route Switcher Dropdown & Add Button Toolbar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <select
            aria-label="Select saved commute route"
            className="w-full rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-primary)] px-3 py-2 text-xs font-bold text-[var(--text-primary)] shadow-sm focus:border-[var(--gold-primary)] focus:outline-none transition"
            value={selectedCommuteId}
            onChange={e => setSelectedCommuteId(e.target.value)}
          >
            {commutes.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          className="hud-button flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[var(--gold-light)] shrink-0"
          onClick={() => setIsAddingNew(v => !v)}
        >
          {isAddingNew ? <X size={13} /> : <Plus size={13} />}
          <span>{isAddingNew ? 'Cancel' : 'New Route'}</span>
        </button>

        {commutes.length > 1 && selectedCommute && !isAddingNew && (
          <button
            type="button"
            title="Delete this saved commute"
            aria-label="Delete saved commute"
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:text-rose-400 hover:border-rose-400/50 transition shrink-0"
            onClick={e => handleDelete(selectedCommute.id, e)}
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {/* Add New Commute Form */}
      {isAddingNew && (
        <form
          onSubmit={handleCreateCommute}
          className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-panel)] p-3.5 shadow-xl backdrop-blur-xl space-y-3"
        >
          <div className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
            <Sparkles size={14} className="text-[var(--gold-light)]" />
            Save Frequent Commute Route
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
              Custom Route Name
            </label>
            <input
              type="text"
              placeholder="e.g. Home ➔ BKC Express"
              className="w-full rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-primary)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-[var(--gold-primary)] focus:outline-none"
              value={newName}
              onChange={e => setNewName(e.target.value)}
            />
          </div>

          {/* Origin Input */}
          <div className="relative">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
              Origin (Starting Point)
            </label>
            <div className="flex items-center rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-primary)] px-3 py-2">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[9px] font-bold text-emerald-500 mr-2">A</span>
              <input
                type="text"
                placeholder="Origin location in Mumbai"
                className="w-full bg-transparent text-xs text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none font-medium"
                value={newOriginQuery}
                onChange={e => setNewOriginQuery(e.target.value)}
                onFocus={() => setOriginFocused(true)}
                onBlur={() => setTimeout(() => setOriginFocused(false), 200)}
              />
            </div>
            {originFocused && originSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-40 overflow-y-auto rounded-xl border border-[var(--border-primary)] bg-[var(--bg-panel)] shadow-2xl backdrop-blur-xl">
                {originSuggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    className="w-full border-b border-[var(--border-secondary)] px-3 py-2 text-left text-xs text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] last:border-b-0"
                    onMouseDown={() => {
                      setNewOriginQuery(s.displayName.split(',')[0] || s.displayName)
                      setOriginFocused(false)
                    }}
                  >
                    {s.displayName}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Destination Input */}
          <div className="relative">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
              Destination (Office / Landmark)
            </label>
            <div className="flex items-center rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-primary)] px-3 py-2">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-sky-500/20 text-[9px] font-bold text-sky-500 mr-2">B</span>
              <input
                type="text"
                placeholder="Destination landmark"
                className="w-full bg-transparent text-xs text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none font-medium"
                value={newDestQuery}
                onChange={e => setNewDestQuery(e.target.value)}
                onFocus={() => setDestFocused(true)}
                onBlur={() => setTimeout(() => setDestFocused(false), 200)}
              />
            </div>
            {destFocused && destSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-40 overflow-y-auto rounded-xl border border-[var(--border-primary)] bg-[var(--bg-panel)] shadow-2xl backdrop-blur-xl">
                {destSuggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    className="w-full border-b border-[var(--border-secondary)] px-3 py-2 text-left text-xs text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] last:border-b-0"
                    onMouseDown={() => {
                      setNewDestQuery(s.displayName.split(',')[0] || s.displayName)
                      setDestFocused(false)
                    }}
                  >
                    {s.displayName}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick presets */}
          <div>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Popular Hubs:</div>
            <div className="flex flex-wrap gap-1">
              {POPULAR_COMMUTE_PRESETS.slice(0, 6).map(p => (
                <button
                  key={p.name}
                  type="button"
                  className="rounded-md border border-[var(--border-secondary)] bg-[var(--bg-secondary)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-active)]"
                  onClick={() => {
                    if (!newOriginQuery.trim()) setNewOriginQuery(p.query)
                    else setNewDestQuery(p.query)
                  }}
                >
                  + {p.name}
                </button>
              ))}
            </div>
          </div>

          {formError && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-500">
              {formError}
            </div>
          )}

          <button
            type="submit"
            disabled={formLoading || !newOriginQuery.trim() || !newDestQuery.trim()}
            className="hud-button flex h-10 w-full items-center justify-center gap-2 rounded-xl text-xs font-bold text-emerald-400 hover:text-emerald-300"
          >
            {formLoading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Saving Commute...
              </>
            ) : (
              <>
                <Plus size={14} />
                Save to My Commutes
              </>
            )}
          </button>
        </form>
      )}

      {/* Selected Commute Details Card */}
      {selectedCommute ? (
        <div className="space-y-3">
          {/* Origin & Destination Banner */}
          <div className="rounded-2xl border border-[var(--border-secondary)] bg-[var(--bg-primary)] p-3 shadow-xs">
            <div className="flex items-center justify-between pb-1.5 border-b border-[var(--border-secondary)]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1">
                <Briefcase size={12} className="text-[var(--gold-light)]" />
                Commute Route
              </span>
              <button
                type="button"
                className="flex items-center gap-1 text-[11px] font-semibold text-[var(--cyan-primary)] hover:underline"
                onClick={handleReverseCommute}
                title="Swap origin & destination for return commute"
              >
                <ArrowUpDown size={12} />
                Swap for Return
              </button>
            </div>

            <div className="mt-2.5 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">A</span>
                <span className="font-bold text-[var(--text-primary)] truncate">{selectedCommute.originName}</span>
              </div>
              <ArrowRight size={14} className="shrink-0 text-[var(--text-secondary)] px-1" />
              <div className="flex items-center gap-2 min-w-0 flex-1 justify-end text-right">
                <span className="font-bold text-[var(--text-primary)] truncate">{selectedCommute.destinationName}</span>
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-500/20 text-[10px] font-bold text-sky-600 dark:text-sky-400">B</span>
              </div>
            </div>
          </div>

          {/* Risk Assessment Box */}
          {loadingAssessment ? (
            <div className="flex items-center justify-center gap-2.5 rounded-2xl border border-[var(--border-secondary)] bg-[var(--bg-primary)] p-6 text-xs text-[var(--cyan-primary)]">
              <Loader2 size={16} className="animate-spin" />
              <span className="font-medium">Evaluating live flood risk along route...</span>
            </div>
          ) : assessmentError ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-500">
              <div className="flex items-center gap-1.5 font-semibold">
                <AlertCircle size={14} />
                <span>Notice</span>
              </div>
              <p className="mt-1 text-[11px] opacity-90">{assessmentError}</p>
            </div>
          ) : assessment ? (
            <div className="space-y-3">
              {/* Status Header Badge */}
              <div className={`flex items-center justify-between rounded-2xl border px-3.5 py-2.5 shadow-sm ${badgeInfo.bg}`}>
                <div className="flex items-center gap-2">
                  {badgeInfo.icon}
                  <span className={`text-xs font-black tracking-wide ${badgeInfo.textColor}`}>
                    {badgeInfo.label}
                  </span>
                </div>
                <span className={`font-mono text-xs font-black ${badgeInfo.fsiColor}`}>
                  Max FSI: {assessment.maxRisk.toFixed(2)}
                </span>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-2xl border border-[var(--border-secondary)] bg-[var(--bg-primary)] p-3 text-center shadow-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block">
                    Usual Distance
                  </span>
                  <div className="mt-1 font-mono text-base font-black text-[var(--text-primary)]">
                    {assessment.lengthKm} <span className="text-xs font-normal">km</span>
                  </div>
                  <span className="text-[10px] font-medium text-[var(--text-secondary)] block mt-0.5">
                    Avg FSI: {assessment.avgRisk.toFixed(2)}
                  </span>
                </div>

                <div className="rounded-2xl border border-[var(--border-secondary)] bg-[var(--bg-primary)] p-3 text-center shadow-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block">
                    Safe Detour
                  </span>
                  {assessment.hasAlternative && assessment.alternativeLengthKm ? (
                    <>
                      <div className="mt-1 font-mono text-base font-black text-emerald-600 dark:text-emerald-400">
                        {assessment.alternativeLengthKm} <span className="text-xs font-normal">km</span>
                      </div>
                      <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 block mt-0.5">
                        +{assessment.detourExtraKm ?? 0} km (FSI: {assessment.alternativeMaxRisk?.toFixed(2)})
                      </span>
                    </>
                  ) : (
                    <>
                      <div className="mt-1 font-mono text-sm font-bold text-[var(--text-secondary)]">
                        Not Needed
                      </div>
                      <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 block mt-0.5">
                        Normal route is safe
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Transit Advisory Section */}
              <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-3.5 shadow-sm space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-heading)]">
                  <Train size={14} className="text-[var(--gold-light)]" />
                  <span>Commute Advisory</span>
                </div>

                <h5 className="text-xs font-bold text-[var(--text-primary)] leading-snug">
                  {assessment.transitAdvisory.title}
                </h5>

                {assessment.transitAdvisory.warning && (
                  <p className={`text-[11px] font-semibold border rounded-xl p-2.5 leading-relaxed ${badgeInfo.warningBox}`}>
                    {assessment.transitAdvisory.warning}
                  </p>
                )}

                <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                  {assessment.transitAdvisory.recommendation}
                </p>

                {/* Recommended Transit Modes Badges */}
                <div className="pt-1.5 border-t border-[var(--border-secondary)]">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block mb-1.5">
                    Recommended Transit Options
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {assessment.transitAdvisory.preferredModes.map(mode => (
                      <span
                        key={mode}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-secondary)] bg-[var(--bg-secondary)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-primary)]"
                      >
                        {mode === 'train' && <Train size={12} className="text-cyan-500" />}
                        {mode === 'metro' && <Train size={12} className="text-purple-500" />}
                        {mode === 'bus' && <Bus size={12} className="text-amber-500" />}
                        {mode === 'car' && <Car size={12} className="text-emerald-500" />}
                        {mode === 'cab' && <Car size={12} className="text-blue-500" />}
                        {mode === 'wfh' && <ShieldAlert size={12} className="text-rose-500" />}
                        <span>
                          {mode === 'wfh' ? 'Work From Home' : mode === 'train' ? 'Mumbai Local' : mode === 'metro' ? 'Metro Rail' : mode === 'bus' ? 'BEST Bus' : mode === 'cab' ? 'Cab / Taxi' : 'Personal Vehicle'}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Button: View / Apply to Map */}
              <button
                type="button"
                className="hud-button flex h-10 w-full items-center justify-center gap-2 rounded-xl text-xs font-bold uppercase tracking-wider text-sky-600 dark:text-sky-300 hover:text-sky-700 dark:hover:text-white shadow-md transition-all"
                onClick={handleApplyToMap}
              >
                <Route size={14} />
                Plot Live Commute On Map
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="p-4 text-center text-xs text-[var(--text-secondary)]">
          No saved commutes yet. Click &quot;New Route&quot; to add your daily commute!
        </div>
      )}
    </div>
  )
}
