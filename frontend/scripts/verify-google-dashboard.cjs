const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_CORE_PATH || 'C:/Users/Vansh/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright-core')

;(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
  let page
  try {
    page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    page.setDefaultTimeout(60000)
    async function verifyComparison(data) {
      const comparison = page.locator('section[aria-label="Route comparison"]:visible').first()
      await comparison.waitFor()
      await page.waitForFunction(expected => {
        const panels = [...document.querySelectorAll('section[aria-label="Route comparison"]')]
        return panels.some(panel => panel.getBoundingClientRect().width && panel.textContent.includes(expected))
      }, data.normal_route.avg_risk.toFixed(3))
      const rows = await comparison.locator('dt').evaluateAll(elements => elements.map(element => [element.textContent, element.nextElementSibling.textContent]))
      assert.deepEqual(rows, [
        ['Maximum FSI', data.normal_route.max_risk.toFixed(3)],
        ['Average FSI', data.normal_route.avg_risk.toFixed(3)],
        ['Maximum FSI', data.max_risk_on_route.toFixed(3)],
        ['High/severe segments', String(data.high_severe_segment_count)],
        ['Distance difference', '+' + (data.tolerance_distance_km - data.normal_distance_km).toFixed(2) + ' km'],
      ])
      const contrast = await comparison.locator('dt, dd, strong, span').evaluateAll(elements => {
        const luminance = color => {
          const channels = color.match(/[\d.]+/g).slice(0,3).map(Number).map(n => n / 255).map(n => n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4)
          return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
        }
        return elements.filter(element => element.textContent.trim()).map(element => {
          let parent = element, background = 'rgb(255,255,255)'
          while (parent) {
            const bg = getComputedStyle(parent).backgroundColor, channels = bg.match(/[\d.]+/g)?.map(Number)
            if (channels && (channels.length === 3 || channels[3] >= 0.99)) { background = bg; break }
            parent = parent.parentElement
          }
          const a = luminance(getComputedStyle(element).color), b = luminance(background)
          return (Math.max(a,b) + 0.05) / (Math.min(a,b) + 0.05)
        })
      })
      assert.ok(contrast.every(ratio => ratio >= 4.5), JSON.stringify(contrast))
    }
    const errors = []
    page.on('request', request => { if (request.url().endsWith('/route')) console.log('Routing request sent to FastAPI.') })
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
    // Instrument this browser's Vite response; ship no test globals or fake data.
    await page.route('**/src/hooks/useGoogleMumbaiMap.ts*', async route => {
      const response = await route.fetch()
      const body = (await response.text()).replace('mapRef.current = map', `mapRef.current = map;
        window.__testMap = map; window.__drainage = drainageLayer(map);
        window.__clicks = []; map.addListener('click', e => window.__clicks.push(e.latLng?.toJSON()));
        if (!window.__lines) { window.__lines = []; const Polyline = google.maps.Polyline;
          google.maps.Polyline = class extends Polyline { constructor(options) { super(options); window.__lines.push(this); } }; }`)
      await route.fulfill({ response, body })
    })
    await page.route('**/src/components/map/RoadRiskLayer.tsx*', async route => {
      const response = await route.fetch()
      const body = (await response.text()).replace('const layer = new google.maps.Data({ map })', 'const layer = new google.maps.Data({ map }); window.__roads = layer')
      await route.fulfill({ response, body })
    })
    await page.route('**/src/components/map/TrafficLayer.tsx*', async route => {
      const response = await route.fetch()
      const body = (await response.text()).replace('const layer = new google.maps.TrafficLayer()', 'const layer = new google.maps.TrafficLayer(); window.__traffic = layer')
      await route.fulfill({ response, body })
    })
    await page.goto(process.argv[2] || 'http://localhost:5173')
    await page.waitForFunction(() => window.__testMap && document.querySelector('[data-flood-raster]'), null, { timeout: 120000 }).catch(async error => {
      console.log('LOAD DIAGNOSTICS', await page.locator('body').innerText())
      console.log('BROWSER ERRORS', errors.map(message => message.replace(/key=[^&\s]+/g, 'key=[redacted]')))
      await page.screenshot({ path: 'google-dashboard-error.png' })
      throw error
    })
    await page.locator('[data-flood-raster]').evaluate(image => image.decode())
    console.log('Google map and actual backend flood raster loaded.')
    await page.getByRole('checkbox', { name: 'Flood Risk', exact: true }).uncheck()
    assert.equal(await page.locator('[data-flood-raster]').isVisible(), false)
    await page.getByRole('checkbox', { name: 'Flood Risk', exact: true }).check()
    assert.equal(await page.locator('[data-flood-raster]').isVisible(), true)
    console.log('Flood visibility toggle passed.')
    const mapIdentity = await page.evaluate(() => { window.__originalMap = window.__testMap; return !!window.__originalMap })
    assert.ok(mapIdentity)
    let trafficRouteRequests = 0
    const countTrafficRoutes = request => { if (request.url().endsWith('/route')) trafficRouteRequests++ }
    page.on('request', countTrafficRoutes)
    await page.getByRole('checkbox', { name: 'Traffic', exact: true }).check()
    await page.waitForFunction(() => window.__traffic?.getMap() === window.__testMap)
    await page.evaluate(() => { window.__originalTraffic = window.__traffic })
    await page.getByRole('checkbox', { name: 'Traffic', exact: true }).uncheck()
    await page.waitForFunction(() => window.__traffic?.getMap() === null)
    await page.getByRole('checkbox', { name: 'Traffic', exact: true }).check()
    assert.ok(await page.evaluate(() => window.__traffic === window.__originalTraffic))
    await page.getByRole('checkbox', { name: 'Traffic', exact: true }).uncheck()
    assert.equal(trafficRouteRequests, 0)
    page.off('request', countTrafficRoutes)
    await page.getByRole('checkbox', { name: 'Satellite', exact: true }).check()
    await page.waitForFunction(() => window.__testMap.getMapTypeId() === 'hybrid')
    await page.getByRole('checkbox', { name: 'Satellite', exact: true }).uncheck()
    await page.waitForFunction(() => window.__testMap.getMapTypeId() === 'roadmap')
    console.log('Traffic attaches, detaches and reuses its layer without routing requests; satellite checkbox works.')
    const summary = await page.evaluate(() => ({
      event: document.querySelector('[aria-label="Rainfall event selection"]').value,
      has3D: [...document.querySelectorAll('button')].some(b => /3D/.test(b.textContent + b.getAttribute('aria-label'))),
    }))
    assert.equal(summary.has3D, false)
    assert.equal(await page.locator('[data-mumbai-mask]').count(), 0)
    await page.getByRole('checkbox', { name: 'Road Risk', exact: true }).check()
    await page.getByText('Zoom in to level 14 to see road risk.', { exact: true }).waitFor()
    await page.getByRole('checkbox', { name: 'Road Risk', exact: true }).uncheck()
    console.log('Event:', summary.event)
    await page.getByRole('button', { name: 'Address', exact: true }).first().click()
    const contrast = await page.evaluate(() => {
      const luminance = color => {
        const channels = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => value / 255).map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
        return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
      }
      return [...document.querySelectorAll('.hud-label, input[type="text"], select, .hud-panel label, .hud-panel p')]
        .filter(element => element.getBoundingClientRect().width && !element.disabled)
        .map(element => {
          const style = getComputedStyle(element)
          let parent = element, background
          while (parent) {
            const bg = getComputedStyle(parent).backgroundColor
            const channels = bg.match(/[\d.]+/g)?.map(Number)
            if (channels && (channels.length === 3 || channels[3] >= 0.99)) { background = bg; break }
            parent = parent.parentElement
          }
          const a = luminance(style.color), b = luminance(background || 'rgb(255,255,255)')
          return { text: element.getAttribute('placeholder') || element.getAttribute('aria-label') || element.textContent.trim().slice(0, 45), ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) }
        })
    })
    assert.ok(contrast.length > 10)
    assert.ok(contrast.every(item => item.ratio >= 4.5), JSON.stringify(contrast.filter(item => item.ratio < 4.5)))
    console.log('Light-theme inputs, dropdowns, captions and labels passed contrast:', contrast.length)
    await page.getByRole('button', { name: 'Inspect', exact: true }).first().click()
    await page.getByRole('button', { name: 'Toggle HUD panels' }).click()
    async function clickCoordinate(lng, lat) {
      const pixel = await page.evaluate(([lng, lat]) => {
        const map = window.__testMap, projection = map.getProjection(), scale = 2 ** map.getZoom()
        const point = projection.fromLatLngToPoint(new google.maps.LatLng(lat, lng))
        const center = projection.fromLatLngToPoint(map.getCenter())
        const rect = map.getDiv().getBoundingClientRect()
        return { x: rect.left + rect.width / 2 + (point.x - center.x) * scale, y: rect.top + rect.height / 2 + (point.y - center.y) * scale }
      }, [lng, lat])
      await page.mouse.click(pixel.x, pixel.y, { delay: 100 })
    }
    const inspection = page.waitForResponse(r => r.url().includes('/flood/point/') && r.ok())
    inspection.catch(() => {})
    await clickCoordinate(72.8777, 19.15)
    const sampled = await (await inspection).json()
    await page.waitForFunction(() => document.querySelector('.inspection-content')?.textContent.includes('FSI:'))
    assert.ok((await page.locator('.inspection-content').innerText()).includes(sampled.fsi.toFixed(3)))
    console.log('Map click inspection matches backend FSI:', sampled.fsi)
    await page.getByRole('button', { name: 'Close', exact: true }).click()
    await page.getByRole('button', { name: 'Toggle HUD panels' }).click()
    const affectedResponse = page.waitForResponse(r => r.url().includes('/drainage/') && !r.url().includes('summary_only') && r.ok(), { timeout: 120000 })
    affectedResponse.catch(() => {})
    await page.getByRole('checkbox', { name: /Show affected drainage/ }).first().check()
    console.log('Affected drainage enabled; waiting for API output.')
    const drainage = await (await affectedResponse).json()
    await page.waitForFunction(expected => {
      let count = 0; window.__drainage.forEach(() => count++)
      return count === expected
    }, drainage.manholes.features.length)
    console.log('Drainage GeoJSON rendered:', drainage.manholes.features.length, 'affected nodes; conduits deferred to close zoom.')
    await page.screenshot({ path: 'google-dashboard-drainage.png' })
    await page.getByRole('checkbox', { name: /Show affected drainage/ }).first().uncheck()
    await page.waitForFunction(() => { let count = 0; window.__drainage.forEach(() => count++); return count === 0 })
    const fullResponse = page.waitForResponse(r => r.url().includes('/drainage/') && r.url().includes('full=true') && r.ok(), { timeout: 120000 })
    fullResponse.catch(() => {})
    const fullStart = Date.now()
    await page.getByRole('checkbox', { name: /Show full drainage network/ }).first().check()
    await fullResponse
    // Full GeoJSON exceeds Chrome's inspector response cache. The current
    // backend summary supplies its exact counts without reading that cache.
    await page.waitForFunction(() => {
      let count = 0; window.__drainage.forEach(() => count++)
      return count > 0
    }, null, { timeout: 120000 })
    console.log('Full drainage response loaded with zoom-dependent display in', Date.now() - fullStart, 'ms')
    await page.evaluate(() => { window.__testMap.setZoom(15); window.__testMap.panTo({ lng: 72.8777, lat: 19.15 }) })
    await page.waitForFunction(() => {
      let lines = 0, nodes = 0
      window.__drainage.forEach(feature => feature.getGeometry().getType() === 'Point' ? nodes++ : lines++)
      return lines > 0 && nodes > 0
    }, null, { timeout: 120000 })
    const visibleNetwork = await page.evaluate(() => {
      const map = window.__testMap
      let nodes = 0, conduits = 0, outOfView = 0
      window.__drainage.forEach(feature => {
        if (feature.getGeometry().getType() === 'Point') {
          nodes++
          if (!map.getBounds().contains(feature.getGeometry().get())) outOfView++
        } else conduits++
      })
      return { nodes, conduits, outOfView }
    })
    assert.equal(visibleNetwork.outOfView, 0)
    assert.ok(visibleNetwork.nodes < drainage.summary.total_manholes)
    assert.ok(visibleNetwork.conduits < drainage.summary.total_conduits)
    console.log('Close-zoom drainage viewport:', visibleNetwork)
    const roadResponse = page.waitForResponse(r => r.url().includes('/flood/roads/') && r.ok(), { timeout: 120000 })
    roadResponse.catch(() => {})
    await page.getByRole('checkbox', { name: 'Road Risk', exact: true }).check()
    const roadData = await (await roadResponse).json()
    assert.equal(roadData.event_key, summary.event + '_15min')
    assert.ok(roadData.features.length > 0)
    await page.waitForFunction(expected => {
      let count = 0; window.__roads?.forEach(() => count++)
      return count === expected
    }, roadData.features.length)
    const displayedRoads = await page.evaluate(() => {
      const roads = []; window.__roads.forEach(feature => roads.push({
        id: feature.getId(), risk: feature.getProperty('flood_risk'),
        color: window.__roads.getStyle()(feature).strokeColor,
        coordinates: feature.getGeometry().getArray().map(point => [point.lng(), point.lat()]),
      })); return roads
    })
    const colors = ['#38bdf8', '#facc15', '#fb923c', '#ef4444']
    for (const road of displayedRoads) {
      const source = roadData.features.find(feature => feature.id === road.id)
      assert.equal(road.risk, source.properties.flood_risk)
      assert.equal(road.color, colors[Math.min(3, Math.floor(road.risk * 4))])
      assert.deepEqual(road.coordinates, source.geometry.coordinates)
    }
    await page.screenshot({ path: 'google-dashboard-road-risk.png' })
    await page.getByRole('checkbox', { name: 'Road Risk', exact: true }).uncheck()
    assert.equal(await page.evaluate(() => window.__roads.getMap()), null)
    let cachedRoadRequests = 0
    const countCachedRequests = request => { if (request.url().includes('/flood/roads/')) cachedRoadRequests++ }
    page.on('request', countCachedRequests)
    await page.getByRole('checkbox', { name: 'Road Risk', exact: true }).check()
    await page.waitForFunction(expected => { let count = 0; window.__roads?.forEach(() => count++); return count === expected }, roadData.features.length)
    assert.equal(cachedRoadRequests, 0)
    page.off('request', countCachedRequests)
    await page.getByRole('checkbox', { name: 'Road Risk', exact: true }).uncheck()
    console.log('Road-risk geometries, values, colors and toggle cleanup match backend:', displayedRoads.length)
    await page.getByRole('checkbox', { name: /Show full drainage network/ }).first().uncheck()
    await page.waitForFunction(() => { let count = 0; window.__drainage.forEach(() => count++); return count === 0 })
    await page.getByRole('button', { name: 'Reset Mumbai view', exact: true }).first().click()
    console.log('Reset camera:', await page.evaluate(() => ({ center: window.__testMap.getCenter().toJSON(), zoom: window.__testMap.getZoom() })))
    await page.waitForFunction(() => {
      const map = window.__testMap, center = map.getCenter()
      // Google may clamp the center toward the restriction's midpoint when the
      // viewport is larger than the entire Mumbai bounds at this zoom.
      return Math.abs(center.lat() - 19.076) < 0.01 && Math.abs(center.lng() - 72.8777) < 0.01 && map.getZoom() === 11
    })
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: 'Map Pin', exact: true }).first().click()
    await page.getByRole('group', { name: 'Flood risk tolerance', exact: true }).first().getByRole('button', { name: 'Severe', exact: true }).click()
    await page.getByRole('button', { name: 'Toggle HUD panels' }).click()
    const routing = page.waitForResponse(r => r.url().endsWith('/route') && r.ok(), { timeout: 120000 })
    routing.catch(() => {})
    await clickCoordinate(72.85, 19.11)
    await page.getByLabel('Route start', { exact: true }).waitFor()
    console.log('Start marker selected.')
    // Google gesture recognition needs separate clicks, rather than an instant pair.
    await page.waitForTimeout(600)
    await clickCoordinate(72.86, 19.2)
    await page.getByLabel('Route destination', { exact: true }).waitFor({ timeout: 15000 }).catch(async error => {
      console.log('ROUTE DIAGNOSTICS', await page.locator('body').innerText())
      console.log('GOOGLE CLICK EVENTS', await page.evaluate(() => window.__clicks))
      await page.screenshot({ path: 'google-dashboard-route-error.png' })
      throw error
    })
    console.log('Destination marker selected; waiting for NetworkX route.')
    const routeResponse = await routing
    const result = await routeResponse.json()
    const request = routeResponse.request().postDataJSON()
    assert.equal(request.risk_tolerance, 'severe')
    assert.equal(request.event_date, summary.event)
    await page.waitForFunction(() => window.__lines.filter(line => line.getMap()).length === 2)
    const paths = await page.evaluate(() => window.__lines.filter(line => line.getMap()).map(line => line.getPath().getArray().map(point => [point.lng(), point.lat()])))
    assert.deepEqual(paths[0], result.normal_route.coordinates)
    assert.deepEqual(paths[1], result.tolerance_route.coordinates)
    console.log('Normal and tolerance route paths exactly match FastAPI; endpoints rendered.')
    await page.getByRole('button', { name: 'Toggle HUD panels' }).click()
    assert.ok((await page.locator('body').innerText()).includes(result.normal_distance_km.toFixed(2) + ' km'))
    await verifyComparison(result)
    const satellite = page.getByRole('button', { name: 'Satellite imagery', exact: true })
    await satellite.click()
    await page.waitForFunction(() => window.__testMap.getMapTypeId() === 'hybrid')
    await satellite.click()
    await page.waitForFunction(() => window.__testMap.getMapTypeId() === 'roadmap')
    assert.ok(await page.evaluate(() => window.__testMap === window.__originalMap))
    await page.screenshot({ path: 'google-dashboard-desktop.png' })
    await page.evaluate(() => window.__testMap.setOptions({ zoom: 15, center: { lng: 72.8777, lat: 19.15 } }))
    await page.getByRole('checkbox', { name: 'Road Risk', exact: true }).check()
    await page.waitForFunction(() => { let count = 0; window.__roads?.forEach(() => count++); return count > 0 })
    const nextRoadWindow = page.waitForResponse(r => r.url().includes('/flood/roads/') && r.url().includes('window_minutes=30') && r.ok())
    nextRoadWindow.catch(() => {})
    await page.evaluate(() => { window.__originalRaster = document.querySelector('[data-flood-raster]') })
    const summaryResponse = page.waitForResponse(r => r.url().includes('/flood/summary/') && r.url().includes('window_minutes=30') && r.ok())
    summaryResponse.catch(() => {})
    await page.getByRole('group', { name: 'Rainfall duration intervals' }).getByRole('button', { name: '30m', exact: true }).click()
    const nextSummary = await (await summaryResponse).json()
    const nextRoads = await (await nextRoadWindow).json()
    assert.equal(nextRoads.event_key, summary.event + '_30min')
    assert.ok(nextRoads.features.length > 0)
    await page.waitForFunction(expected => {
      let count = 0; window.__roads.forEach(() => count++)
      return count === expected
    }, nextRoads.features.length)
    // Both intervals may have identical category colors; verify replacement,
    // rather than requiring a different PNG when all cells remain Low risk.
    await page.waitForFunction(() => {
      const image = document.querySelector('[data-flood-raster]')
      return image?.src && image !== window.__originalRaster
    })
    assert.ok((await page.locator('body').innerText()).includes(nextSummary.fsi_mean.toFixed(2)))
    assert.equal(await page.locator('[data-flood-raster]').count(), 1)
    assert.ok(await page.evaluate(() => window.__testMap === window.__originalMap))
    console.log('Time-window update replaces raster and summary without recreating the map.')
    await page.getByRole('checkbox', { name: 'Road Risk', exact: true }).uncheck()
    await page.getByRole('button', { name: 'Reset Mumbai view', exact: true }).first().click()
    await page.setViewportSize({ width: 390, height: 844 })
    await page.screenshot({ path: 'google-dashboard-mobile.png' })
    await page.getByRole('button', { name: 'Routes', exact: true }).click()
    await page.getByRole('heading', { name: /Safe Flood-Aware Routing/ }).waitFor()
    assert.equal(await page.getByLabel('From', { exact: true }).count(), 0)
    await page.getByRole('button', { name: 'Address Search', exact: true }).click()
    await page.getByLabel('From', { exact: true }).last().fill('19.11, 72.85')
    await page.getByLabel('To', { exact: true }).last().fill('19.20, 72.86')
    const addressRoute = page.waitForResponse(r => r.url().endsWith('/route') && r.ok(), { timeout: 120000 })
    addressRoute.catch(() => {})
    await page.getByRole('button', { name: 'Compute Safe Route', exact: true }).click()
    const addressResponse = await addressRoute
    const addressRequest = addressResponse.request().postDataJSON()
    assert.equal(addressRequest.origin_lat, 19.11)
    assert.equal(addressRequest.dest_lon, 72.86)
    assert.equal(addressRequest.window_minutes, 30)
    await verifyComparison(await addressResponse.json())
    assert.equal(await page.getByLabel('From', { exact: true }).last().inputValue(), '19.11, 72.85')
    assert.equal(await page.getByLabel('To', { exact: true }).last().inputValue(), '19.20, 72.86')
    console.log('Desktop/mobile comparison metrics match FastAPI and pass contrast; From/To submits real coordinates.')
    await page.screenshot({ path: 'google-dashboard-mobile-routes.png' })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    const missingKeyPage = await browser.newPage()
    await missingKeyPage.route('**/src/components/MumbaiFloodMap.tsx*', async route => {
      const response = await route.fetch()
      const body = (await response.text()).replace(/const apiKey = [^\n]+/, 'const apiKey = "";')
      await route.fulfill({ response, body })
    })
    await missingKeyPage.goto(process.argv[2] || 'http://localhost:5173')
    await missingKeyPage.getByRole('alert').filter({ hasText: 'Set VITE_GOOGLE_MAPS_API_KEY' }).waitFor()
    await missingKeyPage.close()
    await page.getByRole('button', { name: 'Close sheet', exact: true }).click()
    await page.getByRole('button', { name: 'Close sheet', exact: true }).waitFor({ state: 'hidden' })
    await page.setViewportSize({ width: 900, height: 1000 })
    assert.ok(await page.getByRole('navigation', { name: 'Mobile Navigation' }).isVisible())
    await page.screenshot({ path: 'google-dashboard-tablet.png' })
    await page.setViewportSize({ width: 1024, height: 1000 })
    assert.equal(await page.getByRole('navigation', { name: 'Mobile Navigation' }).isVisible(), false)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    if (errors.length) throw new Error(errors.join('\n'))
    console.log('PASS: real-data dashboard, map interactions, routing, satellite, contrast, missing-key handling and desktop/tablet/mobile layout.')
  } catch (error) {
    console.log('FAILED STEP:', error.message)
    if (page && !page.isClosed()) {
      console.log('PAGE STATE:', await page.locator('body').innerText())
      await page.screenshot({ path: 'google-dashboard-error.png' }).catch(() => {})
    }
    throw error
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
