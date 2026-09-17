/**
 * Custom Dark HUD Map Style for Google Maps / react-native-maps.
 * Matches CARTO Dark Matter / Dark Void aesthetic from the web frontend.
 */
export const DARK_MAP_STYLE = [
  {
    elementType: 'geometry',
    stylers: [{ color: '#090a12' }],
  },
  {
    elementType: 'labels.text.fill',
    stylers: [{ color: '#757b95' }],
  },
  {
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#06070c' }],
  },
  {
    featureType: 'administrative',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#1e2235' }],
  },
  {
    featureType: 'administrative.land_parcel',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'administrative.neighborhood',
    stylers: [{ visibility: 'on' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#565c75' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#0e171b' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#1a1f33' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#8b94b2' }],
  },
  {
    featureType: 'road.arterial',
    elementType: 'geometry',
    stylers: [{ color: '#252c48' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#333e66' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#1f2640' }],
  },
  {
    featureType: 'road.local',
    stylers: [{ visibility: 'simplified' }],
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#171b2e' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#04050a' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#323c58' }],
  },
]
