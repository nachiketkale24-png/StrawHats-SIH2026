// Inspect the running development map with the existing local Playwright install.
const assert = require('node:assert/strict')
const os = require('node:os')
const path = require('node:path')
const { chromium } = require(process.env.PLAYWRIGHT_CORE_PATH || 'C:/Users/Vansh/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright-core')

;(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    const pageErrors = []
    page.on('pageerror', error => pageErrors.push(error.message))
    await page.route('**/src/hooks/useMumbaiMap.ts*', async route => {
      const response = await route.fetch()
      const body = (await response.text()).replace('mapRef.current = map', 'mapRef.current = map; window.__testMap = map')
      console.log('Map instrumentation:', body.includes('window.__testMap'))
      await route.fulfill({ response, body })
    })
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => window.__testMap?.isStyleLoaded()
      && !!window.__testMap?.getLayer('drainage-nodes'), null, { timeout: 60000 })
    await page.getByLabel('Rainfall event selection').first().selectOption('2017-08-29')
    await page.waitForFunction(() => {
      const map = window.__testMap
      return map?.getSource('drainage-nodes')?.serialize?.()?.data?.features?.length === 649
        && map?.getSource('drainage-edges')?.serialize?.()?.data?.features?.length === 673
    }, null, { timeout: 60000 }).catch(async error => {
      console.log('Drainage diagnostics', await page.evaluate(() => ({
        map: !!window.__testMap,
        styleLoaded: window.__testMap?.isStyleLoaded(),
        sourceKeys: Object.keys(window.__testMap?.getSource('drainage-nodes') || {}),
        sourceData: window.__testMap?.getSource('drainage-nodes')?.serialize?.()?.data?.features?.length,
        layers: window.__testMap?.getStyle()?.layers?.map(layer => layer.id).filter(id => id.includes('drainage')),
        nodes: window.__testMap?.getSource('drainage-nodes')?._data?.features?.length,
        edges: window.__testMap?.getSource('drainage-edges')?._data?.features?.length,
        errors: document.body.innerText.match(/Drainage unavailable:[^\n]*/g),
        text: document.body.innerText.slice(0, 800),
      })))
      throw error
    })

    const state = await page.evaluate(() => {
      const map = window.__testMap
      const nodes = map.getSource('drainage-nodes').serialize().data.features
      const edges = map.getSource('drainage-edges').serialize().data.features
      const redNodes = nodes.filter(feature => feature.properties.status === 'surcharging')
      const redEdges = edges.filter(feature => feature.properties.surcharged)
      const colors = map.getPaintProperty('drainage-nodes', 'circle-color')
      const edgeColors = map.getPaintProperty('drainage-edges', 'line-color')
      const dashed = map.getPaintProperty('drainage-edges', 'line-dasharray')
      return { nodes: nodes.length, edges: edges.length, redNodes: redNodes.length,
        redEdges: redEdges.length, colors, edgeColors, dashed }
    })
    assert.equal(state.nodes, 649)
    assert.equal(state.edges, 673)
    assert.equal(state.redNodes, 231)
    assert.equal(state.redEdges, 236)
    assert.match(await page.locator('body').innerText(), /231 of 34,431 manholes surcharged/)
    assert.match(await page.locator('body').innerText(), /236 of 34,711 conduits surcharged/)
    assert.match(JSON.stringify(state.colors), /#4ade80.*#fbbf24.*#f87171/)
    assert.match(JSON.stringify(state.edgeColors), /capacityUtilization/)
    assert.match(JSON.stringify(state.dashed), /capacityUtilization/)
    if (!await page.evaluate(() => !!window.__testMap?.getLayer('event-fsi'))) {
      // The existing raster effect can miss an event change while style tiles load.
      // Re-selecting a time window after the map is ready exercises its normal UI path.
      await page.getByRole('button', { name: '30m' }).first().click()
    }
    await page.waitForFunction(() => !!window.__testMap?.getLayer('event-fsi'), null, { timeout: 30000 })
    const defaultScreenshot = path.join(os.tmpdir(), 'drainage-default-2017.png')
    await page.screenshot({ path: defaultScreenshot })

    const target = await page.evaluate(() => {
      const map = window.__testMap
      const feature = map.getSource('drainage-nodes').serialize().data.features
        .find(feature => feature.properties.status === 'surcharging')
      map.jumpTo({ center: feature.geometry.coordinates, zoom: 15 })
      return { id: feature.properties.id, coordinates: feature.geometry.coordinates }
    })
    await page.waitForFunction(target => {
      const map = window.__testMap
      const point = map.project(target.coordinates)
      return map.queryRenderedFeatures(point, { layers: ['drainage-nodes'] })
        .some(hit => hit.properties.id === target.id)
    }, target, { timeout: 30000 })
    const point = await page.evaluate(target => {
      const map = window.__testMap
      const projected = map.project(target.coordinates)
      const rect = map.getContainer().getBoundingClientRect()
      return { x: rect.left + projected.x, y: rect.top + projected.y }
    }, target)
    await page.mouse.click(point.x, point.y)
    const popup = await page.locator('.maplibregl-popup-content').innerText()
    assert.match(popup, /Manhole/)
    assert.match(popup, /Ground elevation:/)
    assert.match(popup, /Incoming Q:/)
    assert.match(popup, /Conduit capacity:/)
    assert.match(popup, /Surcharge ratio:/)
    assert.doesNotMatch(popup, /mock/i)
    await page.locator('.maplibregl-popup-close-button').click()
    const conduit = await page.evaluate(() => {
      const map = window.__testMap
      const feature = map.getSource('drainage-edges').serialize().data.features
        .filter(feature => feature.properties.surcharged && feature.geometry.coordinates.length >= 2)
        .sort((left, right) => {
          const a = left.geometry.coordinates, b = right.geometry.coordinates
          return Math.hypot(b.at(-1)[0] - b[0][0], b.at(-1)[1] - b[0][1])
            - Math.hypot(a.at(-1)[0] - a[0][0], a.at(-1)[1] - a[0][1])
        })[0]
      const coordinates = feature.geometry.coordinates
      const index = Math.floor((coordinates.length - 1) / 2)
      const a = coordinates[index], b = coordinates[index + 1]
      const midpoint = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
      map.jumpTo({ center: midpoint, zoom: 17 })
      return { id: feature.properties.id, midpoint }
    })
    await page.waitForFunction(conduit => {
      const map = window.__testMap
      const point = map.project(conduit.midpoint)
      return map.queryRenderedFeatures(point, { layers: ['drainage-edges'] })
        .some(hit => hit.properties.id === conduit.id)
    }, conduit, { timeout: 30000 })
    const conduitPoint = await page.evaluate(conduit => {
      const map = window.__testMap
      const projected = map.project(conduit.midpoint)
      const rect = map.getContainer().getBoundingClientRect()
      return { x: rect.left + projected.x, y: rect.top + projected.y }
    }, conduit)
    await page.mouse.click(conduitPoint.x, conduitPoint.y)
    const conduitPopup = await page.locator('.maplibregl-popup-content').innerText()
    assert.match(conduitPopup, /Drainage flow/)
    assert.match(conduitPopup, /Incoming Q:/)
    assert.match(conduitPopup, /Capacity:/)
    assert.match(conduitPopup, /Surcharge ratio:/)
    assert.match(conduitPopup, /Surcharged/)
    assert.doesNotMatch(conduitPopup, /mock/i)

    await page.evaluate(() => window.__testMap.jumpTo({ zoom: 11 }))
    const fullResponse = page.waitForResponse(response => response.url().includes('/drainage/2017-08-29?full=true') && response.status() === 200, { timeout: 120000 })
    await page.getByRole('checkbox', { name: 'Show full drainage network (34k+ points)' }).first().check()
    await fullResponse
    await page.waitForFunction(() => !document.body.innerText.includes('Loading drainage network…'), null, { timeout: 60000 })
    const zoomedOut = await page.evaluate(() => {
      const map = window.__testMap
      return {
        zoom: map.getZoom(),
        importantNodes: map.getSource('drainage-nodes').serialize().data.features.length,
        importantEdges: map.getSource('drainage-edges').serialize().data.features.length,
        normalNodes: map.getSource('drainage-nodes-normal').serialize().data.features.length,
        normalEdges: map.getSource('drainage-edges-normal').serialize().data.features.length,
        normalNodeMinzoom: map.getLayer('drainage-nodes-normal').minzoom,
        normalRadius: map.getPaintProperty('drainage-nodes-normal', 'circle-radius'),
        normalOpacity: map.getPaintProperty('drainage-nodes-normal', 'circle-opacity'),
        normalWidth: map.getPaintProperty('drainage-edges-normal', 'line-width'),
        normalLineOpacity: map.getPaintProperty('drainage-edges-normal', 'line-opacity'),
      }
    })
    assert.equal(zoomedOut.normalNodes, 0)
    assert.equal(zoomedOut.normalEdges, 0)
    assert.equal(zoomedOut.importantNodes, 649)
    assert.equal(zoomedOut.importantEdges, 673)
    assert.equal(zoomedOut.normalNodeMinzoom, 13)
    assert.equal(zoomedOut.normalRadius, 3)
    assert.equal(zoomedOut.normalOpacity, 0.35)
    assert.equal(zoomedOut.normalWidth, 1.75)
    assert.equal(zoomedOut.normalLineOpacity, 0.35)
    const fullZoomedOutScreenshot = path.join(os.tmpdir(), 'drainage-full-zoomed-out-2017.png')
    await page.screenshot({ path: fullZoomedOutScreenshot })
    await page.evaluate(() => window.__testMap.jumpTo({ zoom: 14 }))
    await page.waitForFunction(() => {
      const map = window.__testMap
      return map.getSource('drainage-nodes-normal').serialize().data.features.length === 34431 - 649
        && map.getSource('drainage-edges-normal').serialize().data.features.length === 34711 - 673
    }, null, { timeout: 60000 })
    const zoomedIn = await page.evaluate(() => ({
      normalNodes: window.__testMap.getSource('drainage-nodes-normal').serialize().data.features.length,
      normalEdges: window.__testMap.getSource('drainage-edges-normal').serialize().data.features.length,
    }))
    assert.deepEqual(pageErrors, [])
    console.log(JSON.stringify({ ...state, clickedManhole: target.id, popup,
      clickedConduit: conduit.id, conduitPopup, zoomedOut, zoomedIn,
      defaultScreenshot, fullZoomedOutScreenshot }, null, 2))
  } finally {
    await browser.close()
  }
})().catch(error => { console.error(error); process.exitCode = 1 })
