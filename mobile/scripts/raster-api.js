export function windowQuery(minutes, source) {
  const query = new URLSearchParams()
  if (minutes !== undefined) query.set('window_minutes', String(minutes))
  if (source === 'nowcast') query.set('rainfall_source', source)
  return query.toString() ? '?' + query : ''
}
export async function apiRequest(path, signal) {
  const response = await fetch(window.floodApiBase + path, { signal })
  if (!response.ok) throw new Error('Raster request failed (' + response.status + ')')
  return response
}
