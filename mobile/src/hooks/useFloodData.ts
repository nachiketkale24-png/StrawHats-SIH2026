/**
 * Custom hook for managing all flood and drainage data state in the mobile app.
 * Complete parity with web frontend state management.
 */
import { useEffect, useState, useCallback, useRef } from 'react'
import type {
  RoutePoint,
  MapMode,
  RainfallSource,
  RiskTolerance,
  DrainageResponse,
} from '../types/flood'
import {
  getEvents,
  getWindows,
  getSummary,
  getDrainage,
  getRoutes,
  getPointValue,
} from '../api/floodApi'
import type {
  EventSummary,
  EventWindows,
  RouteComparison,
} from '../api/floodApi'
import { addApiBaseListener } from '../api/config'

export function useFloodData() {
  const [events, setEvents] = useState<string[]>([])
  const [event, setEvent] = useState('')
  const [rainfallSource, setRainfallSource] = useState<RainfallSource>('observed')
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
  const [riskTolerance, setRiskTolerance] = useState<RiskTolerance>('low')

  // Drainage Network State
  const [drainageData, setDrainageData] = useState<DrainageResponse | null>(null)
  const [drainageStatus, setDrainageStatus] = useState('')
  const [showFullDrainage, setShowFullDrainage] = useState(false)
  const [drainageInfo, setDrainageInfo] = useState<{
    event: string
    summary: DrainageResponse['summary']
  } | null>(null)

  const drainageSummary = drainageInfo?.event === event ? drainageInfo.summary : null
  const intervalReady = !!event && windows?.event_date === event
  const selectedMinutes = windows?.windows.length ? minutes : undefined
  const activeWindow = windows?.windows.find((w) => w.minutes === minutes)
  const disabled = !intervalReady || eventsLoading
  const start = points[0]
  const end = points[1]

  // Listen to dynamic API base updates from settings
  useEffect(() => {
    const unsubscribe = addApiBaseListener(() => {
      setRefresh((r) => r + 1)
    })
    return () => unsubscribe()
  }, [])

  // 1. Load events list whenever refresh or rainfallSource changes
  useEffect(() => {
    const controller = new AbortController()
    setEventsLoading(true)
    setApiError('')
    setEvent('')
    setSummary(null)
    setRoutes(null)
    getEvents(controller.signal, rainfallSource)
      .then((dates) => {
        setEvents(dates)
        setEvent(dates.at(-1) ?? '')
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setEvents([])
          setApiError(
            `Cannot load events: ${err.message}. Check that API server is running on port 8001.`
          )
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setEventsLoading(false)
      })
    return () => controller.abort()
  }, [refresh, rainfallSource])

  // 2. Load windows for selected event
  useEffect(() => {
    const controller = new AbortController()
    setWindows(null)
    setMinutes(15)
    if (event) {
      getWindows(event, controller.signal, rainfallSource)
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
  }, [event, refresh, rainfallSource])

  // 3. Load summary for selected event + window
  useEffect(() => {
    const controller = new AbortController()
    setSummary(null)
    if (intervalReady) {
      getSummary(event, controller.signal, selectedMinutes, rainfallSource)
        .then((value) => {
          if (!controller.signal.aborted) setSummary(value)
        })
        .catch((err) => {
          if (!controller.signal.aborted)
            setApiError(`Cannot load summary: ${err.message}`)
        })
    }
    return () => controller.abort()
  }, [event, refresh, intervalReady, selectedMinutes, rainfallSource])

  // 4. Load drainage network data
  useEffect(() => {
    const controller = new AbortController()
    setDrainageStatus('')
    if (event) {
      setDrainageStatus('Loading drainage network…')
      getDrainage(event, controller.signal, showFullDrainage)
        .then((data) => {
          if (!controller.signal.aborted) {
            setDrainageData(data)
            setDrainageInfo({ event, summary: data.summary })
            setDrainageStatus('')
          }
        })
        .catch((err) => {
          if (!controller.signal.aborted) {
            setDrainageData(null)
            setDrainageStatus(`Drainage unavailable: ${err.message}`)
          }
        })
    } else {
      setDrainageData(null)
    }
    return () => controller.abort()
  }, [event, refresh, showFullDrainage])

  // 5. Compute routes when both points are set
  useEffect(() => {
    const controller = new AbortController()
    setRoutes(null)
    setRouteStatus('')
    if (intervalReady && start && end) {
      setRouteStatus('Calculating flood-aware vs shortest route…')
      getRoutes(
        event,
        start,
        end,
        riskTolerance,
        controller.signal,
        selectedMinutes,
        rainfallSource
      )
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
  }, [
    event,
    start,
    end,
    riskTolerance,
    refresh,
    intervalReady,
    selectedMinutes,
    rainfallSource,
  ])

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

  const toggleFullDrainage = useCallback(() => {
    setShowFullDrainage((prev) => !prev)
  }, [])

  const addPoint = useCallback((point: RoutePoint) => {
    setRoutes(null)
    setRouteStatus('')
    setPoints((prev) => (prev.length === 1 ? [...prev, point] : [point]))
  }, [])

  const setRoutePoints = useCallback(
    (startPoint: RoutePoint, endPoint: RoutePoint) => {
      setRoutes(null)
      setRouteStatus('')
      setPoints([startPoint, endPoint])
    },
    []
  )

  const clearPoints = useCallback(() => {
    setPoints([])
    setRoutes(null)
    setRouteStatus('')
  }, [])

  const inspectPoint = useCallback(
    async (lon: number, lat: number) => {
      if (!event) return null
      try {
        return await getPointValue(
          event,
          lon,
          lat,
          undefined,
          selectedMinutes,
          rainfallSource
        )
      } catch {
        return null
      }
    },
    [event, selectedMinutes, rainfallSource]
  )

  return {
    events,
    event,
    rainfallSource,
    windows,
    minutes,
    eventsLoading,
    apiError,
    summary,
    mode,
    points,
    routes,
    routeStatus,
    riskTolerance,
    drainageData,
    drainageStatus,
    showFullDrainage,
    drainageSummary,
    intervalReady,
    selectedMinutes,
    activeWindow,
    disabled,
    start,
    end,
    setMode,
    setRainfallSource,
    setRiskTolerance,
    setShowFullDrainage,
    toggleFullDrainage,
    handleRefresh,
    selectEvent,
    selectMinutes,
    addPoint,
    setRoutePoints,
    clearPoints,
    inspectPoint,
  }
}
