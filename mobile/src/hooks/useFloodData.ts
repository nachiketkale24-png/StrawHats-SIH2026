/**
 * Custom hook for managing all flood data state.
 * Ported from the state management logic in MumbaiFloodMap.tsx.
 */
import { useEffect, useState, useCallback, useRef } from 'react'
import type { RoutePoint, MapMode } from '../types/flood'
import {
  getEvents,
  getWindows,
  getSummary,
  getRoutes,
  getPointValue,
} from '../api/floodApi'
import type {
  EventSummary,
  EventWindows,
  RouteComparison,
} from '../api/floodApi'

export function useFloodData() {
  const [events, setEvents] = useState<string[]>([])
  const [event, setEvent] = useState('')
  const [windows, setWindows] = useState<EventWindows | null>(null)
  const [minutes, setMinutes] = useState(15)
  const [refresh, setRefresh] = useState(0)
  const [eventsLoading, setEventsLoading] = useState(true)
  const [apiError, setApiError] = useState('')
  const [summary, setSummary] = useState<EventSummary | null>(null)
  const [mode, setMode] = useState<MapMode>('inspect')
  const [points, setPoints] = useState<RoutePoint[]>([])
  const [routes, setRoutes] = useState<RouteComparison | null>(null)
  const [routeStatus, setRouteStatus] = useState('')

  const intervalReady = !!event && windows?.event_date === event
  const selectedMinutes = windows?.windows.length ? minutes : undefined
  const activeWindow = windows?.windows.find((w) => w.minutes === minutes)
  const disabled = !intervalReady || eventsLoading
  const start = points[0]
  const end = points[1]

  // Load events list
  useEffect(() => {
    const controller = new AbortController()
    setEventsLoading(true)
    setApiError('')
    setEvent('')
    setSummary(null)
    setRoutes(null)
    getEvents(controller.signal)
      .then((dates) => {
        setEvents(dates)
        setEvent(dates.at(-1) ?? '')
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setEvents([])
          setApiError(
            `Cannot load events: ${err.message}. Check that the API server is running.`
          )
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setEventsLoading(false)
      })
    return () => controller.abort()
  }, [refresh])

  // Load windows for selected event
  useEffect(() => {
    const controller = new AbortController()
    setWindows(null)
    setMinutes(15)
    if (event) {
      getWindows(event, controller.signal)
        .then((info) => {
          if (!controller.signal.aborted) {
            setWindows(info)
            setMinutes(info.windows[0]?.minutes ?? 15)
          }
        })
        .catch((err) => {
          if (!controller.signal.aborted)
            setApiError(`Cannot load time intervals: ${err.message}`)
        })
    }
    return () => controller.abort()
  }, [event, refresh])

  // Load summary for selected event + window
  useEffect(() => {
    const controller = new AbortController()
    setSummary(null)
    if (intervalReady) {
      getSummary(event, controller.signal, selectedMinutes)
        .then((value) => {
          if (!controller.signal.aborted) setSummary(value)
        })
        .catch((err) => {
          if (!controller.signal.aborted)
            setApiError(`Cannot load summary: ${err.message}`)
        })
    }
    return () => controller.abort()
  }, [event, refresh, intervalReady, selectedMinutes])

  // Compute routes when both points are set
  useEffect(() => {
    const controller = new AbortController()
    setRoutes(null)
    setRouteStatus('')
    if (intervalReady && start && end) {
      setRouteStatus('Calculating flood-aware vs shortest route…')
      getRoutes(event, start, end, controller.signal, selectedMinutes)
        .then((result) => {
          if (!controller.signal.aborted) {
            setRoutes(result)
            setRouteStatus('')
          }
        })
        .catch((err) => {
          if (!controller.signal.aborted)
            setRouteStatus(`Route unavailable: ${err.message}`)
        })
    }
    return () => controller.abort()
  }, [event, start, end, refresh, intervalReady, selectedMinutes])

  const handleRefresh = useCallback(() => {
    setRefresh((v) => v + 1)
  }, [])

  const selectEvent = useCallback((date: string) => {
    setEvent(date)
    setRoutes(null)
    setSummary(null)
    setApiError('')
  }, [])

  const selectMinutes = useCallback((val: number) => {
    setMinutes(val)
    setRoutes(null)
    setSummary(null)
    setRouteStatus('')
  }, [])

  const addPoint = useCallback((point: RoutePoint) => {
    setRoutes(null)
    setRouteStatus('')
    setPoints((prev) =>
      prev.length === 1 ? [...prev, point] : [point]
    )
  }, [])

  const setRoutePoints = useCallback((s: RoutePoint, e: RoutePoint) => {
    setPoints([s, e])
    setRoutes(null)
    setRouteStatus('')
  }, [])

  const clearPoints = useCallback(() => {
    setPoints([])
    setRoutes(null)
    setRouteStatus('')
  }, [])

  const inspectPoint = useCallback(
    async (lon: number, lat: number) => {
      if (!intervalReady) return null
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)
      try {
        const data = await getPointValue(
          event,
          lon,
          lat,
          controller.signal,
          selectedMinutes
        )
        clearTimeout(timeout)
        return data
      } catch {
        clearTimeout(timeout)
        return null
      }
    },
    [event, intervalReady, selectedMinutes]
  )

  return {
    // State
    events,
    event,
    windows,
    minutes,
    eventsLoading,
    apiError,
    summary,
    mode,
    points,
    routes,
    routeStatus,
    intervalReady,
    selectedMinutes,
    activeWindow,
    disabled,
    start,
    end,

    // Actions
    setMode,
    handleRefresh,
    selectEvent,
    selectMinutes,
    addPoint,
    setRoutePoints,
    clearPoints,
    inspectPoint,
    setApiError,
  }
}
