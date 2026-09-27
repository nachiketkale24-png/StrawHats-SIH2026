import { Map, useApiIsLoaded, useMap } from '@vis.gl/react-google-maps'
import { useContext, useEffect } from 'react'
import { ThemeContext } from '../../lib/theme'
import { MUMBAI_BOUNDS } from '../../config/mumbai'

const [[west, south], [east, north]] = MUMBAI_BOUNDS
const restriction = { latLngBounds: { west, south, east, north }, strictBounds: false }
const styles: google.maps.MapTypeStyle[] = [
  { featureType: 'poi', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
]
const darkStyles: google.maps.MapTypeStyle[] = [
  ...styles,
  { elementType: 'geometry', stylers: [{ color: '#202633' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#c4cad5' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#171c27' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#242a35' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#28313a' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#243c36' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#414957' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#242a35' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#6a6052' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#323b4a' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#121e31' }] },
]

function KeepMapSized() {
  const map = useMap('flood-map')
  useEffect(() => {
    if (!map) return
    let frame = 0
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => google.maps.event.trigger(map, 'resize'))
    })
    observer.observe(map.getDiv())
    return () => { observer.disconnect(); cancelAnimationFrame(frame) }
  }, [map])
  return null
}

export default function FloodMapCanvas({ satellite, onSatelliteChange }: {
  satellite: boolean; onSatelliteChange: (value: boolean) => void
}) {
  const loaded = useApiIsLoaded()
  const theme = useContext(ThemeContext)
  if (!loaded) return null
  return <Map id="flood-map" defaultCenter={{ lat: 19.076, lng: 72.8777 }} defaultZoom={11}
    mapTypeId={satellite ? 'hybrid' : 'roadmap'} restriction={restriction}
    styles={!satellite && theme === 'dark' ? darkStyles : styles}
    backgroundColor={satellite ? '#4c6389' : theme === 'dark' ? '#202633' : '#edf0f3'}
    mapTypeControl zoomControl fullscreenControl streetViewControl={false}
    mapTypeControlOptions={{ position: google.maps.ControlPosition.BOTTOM_LEFT }}
    fullscreenControlOptions={{ position: google.maps.ControlPosition.RIGHT_BOTTOM }}
    zoomControlOptions={{ position: google.maps.ControlPosition.LEFT_CENTER }}
    clickableIcons={false} gestureHandling="greedy"
    onMapTypeIdChanged={event => onSatelliteChange(['satellite', 'hybrid'].includes(event.map.getMapTypeId() ?? ''))}
    style={{ width: '100%', height: '100%' }}><KeepMapSized /></Map>
}
