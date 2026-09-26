import { useEffect } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import { useMap } from '@vis.gl/react-google-maps'
import { drainageLayer, refreshDrainageView, removeDrainageLayer } from '../lib/googleDrainage'

export function useGoogleMumbaiMap(mapRef: MutableRefObject<google.maps.Map | null>, setReady: Dispatch<SetStateAction<boolean>>) {
  const map = useMap('flood-map')
  useEffect(() => {
    if (!map) return
    mapRef.current = map
    drainageLayer(map)
    setReady(true)
    let timer: ReturnType<typeof setTimeout> | undefined
    const viewport = map.addListener('bounds_changed', () => {
      clearTimeout(timer)
      timer = setTimeout(() => refreshDrainageView(map), 200)
    })
    return () => {
      clearTimeout(timer)
      viewport.remove()
      removeDrainageLayer(map)
      mapRef.current = null
      setReady(false)
    }
  }, [map, mapRef, setReady])
}
