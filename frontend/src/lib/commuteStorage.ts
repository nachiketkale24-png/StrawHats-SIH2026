export interface SavedCommute {
  id: string
  name: string
  originName: string
  origin: { lat: number; lng: number }
  destinationName: string
  destination: { lat: number; lng: number }
  createdAt: number
  notes?: string
}

export interface CommuteAssessment {
  commuteId: string
  maxRisk: number
  avgRisk: number
  lengthKm: number
  status: 'low' | 'moderate' | 'high' | 'severe'
  statusText: string
  hasAlternative: boolean
  alternativeLengthKm?: number
  alternativeMaxRisk?: number
  detourExtraKm?: number
  transitAdvisory: {
    title: string
    recommendation: string
    preferredModes: Array<'train' | 'metro' | 'bus' | 'cab' | 'car' | 'wfh'>
    warning?: string
  }
}

const STORAGE_KEY = 'mumbai_commute_saved_routes_v1'

const DEFAULT_COMMUTES: SavedCommute[] = [
  {
    id: 'default-bkc-commute',
    name: 'Andheri ↔ BKC Commuter',
    originName: 'Andheri East, Mumbai',
    origin: { lat: 19.1136, lng: 72.8697 },
    destinationName: 'Bandra Kurla Complex, Mumbai',
    destination: { lat: 19.0607, lng: 72.8648 },
    createdAt: 1700000000000,
    notes: 'Daily tech corridor commute'
  },
  {
    id: 'default-south-mumbai',
    name: 'Dadar ↔ Lower Parel Office',
    originName: 'Dadar Station, Mumbai',
    origin: { lat: 19.0178, lng: 72.8478 },
    destinationName: 'Lower Parel, Mumbai',
    destination: { lat: 18.9953, lng: 72.8306 },
    createdAt: 1700000001000,
    notes: 'Commercial business district'
  },
  {
    id: 'default-suburban-link',
    name: 'Borivali ↔ Goregaon IT Park',
    originName: 'Borivali West, Mumbai',
    origin: { lat: 19.2307, lng: 72.8567 },
    destinationName: 'Goregaon East, Mumbai',
    destination: { lat: 19.1663, lng: 72.8526 },
    createdAt: 1700000002000,
    notes: 'Western suburbs commute'
  }
]

export function getSavedCommutes(): SavedCommute[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_COMMUTES))
      return DEFAULT_COMMUTES
    }
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed
    }
    return DEFAULT_COMMUTES
  } catch {
    return DEFAULT_COMMUTES
  }
}

export function saveCommute(commute: Omit<SavedCommute, 'id' | 'createdAt'>): SavedCommute {
  const all = getSavedCommutes()
  const newCommute: SavedCommute = {
    ...commute,
    id: `commute_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    createdAt: Date.now()
  }
  const updated = [newCommute, ...all]
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch (e) {
    console.error('Failed to save commute to localStorage', e)
  }
  return newCommute
}

export function deleteCommute(id: string): SavedCommute[] {
  const all = getSavedCommutes()
  const updated = all.filter(c => c.id !== id)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch (e) {
    console.error('Failed to delete commute from localStorage', e)
  }
  return updated
}

export function generateCommuteAdvisory(
  normalMaxRisk: number,
  _normalAvgRisk: number,
  normalDistM: number,
  toleranceRoute?: { max_risk?: number | null; distance_km?: number | null } | null
): CommuteAssessment['transitAdvisory'] & { status: CommuteAssessment['status']; statusText: string } {
  const normalDistKm = (normalDistM / 1000).toFixed(1)

  if (normalMaxRisk >= 0.75) {
    return {
      status: 'severe',
      statusText: 'Severe Risk (0.75 - 1.0)',
      title: '🚨 Extreme Flood Hazard on Regular Route',
      warning: `Deep standing water detected on regular route (${normalDistKm} km). Roads are likely submerged.`,
      recommendation: 'Work from home if possible. If travel is mandatory, avoid low-clearance 2/4 wheelers and switch to Western/Central Local Train or Metro where tracks are elevated.',
      preferredModes: ['wfh', 'metro', 'train']
    }
  }

  if (normalMaxRisk >= 0.50) {
    const normalKm = normalDistM / 1000
    const detourKm = toleranceRoute?.distance_km ? (toleranceRoute.distance_km - normalKm).toFixed(1) : '1.5'
    return {
      status: 'high',
      statusText: 'High Risk (0.50 - 0.75)',
      title: '⚠️ Significant Waterlogging Warning',
      warning: `Waterlogging detected on key intersections along ${normalDistKm} km stretch.`,
      recommendation: `Take the flood-tolerant detour (+${detourKm} km) or switch to Western/Central Line Local Train / Metro Line 1/2A/7 for an uninterrupted commute.`,
      preferredModes: ['train', 'metro', 'bus']
    }
  }

  if (normalMaxRisk >= 0.25) {
    return {
      status: 'moderate',
      statusText: 'Moderate Risk (0.25 - 0.50)',
      title: '⚡ Minor Water Accumulation Likely',
      warning: 'Pockets of moderate runoff may cause slow-moving traffic and 15-20 min delays.',
      recommendation: 'Normal road route is passable with caution. High ground routes / flyovers recommended over subways.',
      preferredModes: ['cab', 'bus', 'train', 'metro']
    }
  }

  return {
    status: 'low',
    statusText: 'Low Risk (0.00 - 0.25)',
    title: '✅ Regular Commute Route Clear & Safe',
    warning: undefined,
    recommendation: 'Roads along your commute are dry or within safe drainage capacity. Normal road transit running smoothly.',
    preferredModes: ['car', 'cab', 'bus', 'train', 'metro']
  }
}
