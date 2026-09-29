import { useEffect, useRef } from 'react'
import { useMap } from '@vis.gl/react-google-maps'

export default function TrafficLayer({ visible }: { visible: boolean }) {
  const map = useMap('flood-map')
  const overlay = useRef<google.maps.TrafficLayer | null>(null)
  useEffect(() => {
    if (!map) return
    const layer = new google.maps.TrafficLayer()
    overlay.current = layer
    return () => { layer.setMap(null); overlay.current = null }
  }, [map])
  useEffect(() => { overlay.current?.setMap(visible ? map : null) }, [map, visible])
  return null
}
