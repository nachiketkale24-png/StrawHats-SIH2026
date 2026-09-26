const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_CORE_PATH || 'C:/Users/Vansh/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright-core')
const eventDate = process.env.EVENT_DATE || process.argv[2] || '2017-08-29'
const rainfallSource = process.env.RAINFALL_SOURCE || process.argv[3] || 'observed'
const finalMinutes = Number(process.env.FINAL_MINUTES || process.argv[5] || 180)
const expectedFirst = process.env.FIRST_COUNT === undefined ? undefined : Number(process.env.FIRST_COUNT)
const expectedLast = process.env.FINAL_COUNT || process.argv[4]
const screenshotPath = process.argv[6]

;(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
  })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await page.route('**/src/hooks/useMumbaiMap.ts*', async route => {
      const response = await route.fetch()
      const body = (await response.text()).replace('mapRef.current = map', 'mapRef.current = map; window.__testMap = map')
      await route.fulfill({ response, body })
    })
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' })
    if (rainfallSource === 'nowcast') {
      await page.getByLabel('Rainfall source').first().selectOption('nowcast')
    }
    const event = page.getByLabel('Rainfall event selection').first()
    await event.waitFor({ timeout: 60000 })
    await page.waitForFunction(date => [...document.querySelectorAll('select[aria-label="Rainfall event selection"] option')]
      .some(option => option.value === date), eventDate, { timeout: 60000 })

    const firstResponse = page.waitForResponse(response =>
      response.url().includes(`/drainage/${eventDate}?window_minutes=15`) &&
      (rainfallSource === 'observed' || response.url().includes('rainfall_source=nowcast')) &&
      response.status() === 200,
      { timeout: 120000 })
    if (await event.inputValue() === eventDate) {
      await page.getByRole('button', { name: 'Refresh events' }).first().click()
    } else {
      await event.selectOption(eventDate)
    }
    const first = (await (await firstResponse).json()).summary
    const firstCount = first.surcharged_manholes
    await page.waitForFunction(count => document.body.innerText.includes(`${count} of 34,431 manholes surcharged`),
      firstCount, { timeout: 60000 })

    const affectedToggle = page.getByRole('checkbox', { name: /Show affected drainage/ }).first()
    const fullToggle = page.getByRole('checkbox', { name: /Show full drainage network/ }).first()
    assert.equal(await affectedToggle.isChecked(), false)
    assert.equal(await fullToggle.isChecked(), false)
    assert.equal(await page.evaluate(() => window.__testMap.getSource('drainage-nodes').serialize().data.features.length), 0)
    await affectedToggle.check()
    await page.waitForFunction(() => window.__testMap.getSource('drainage-nodes').serialize().data.features.length > 0,
      null, { timeout: 60000 })
    const affectedOnly = await page.evaluate(() => {
      const map = window.__testMap
      const nodes = map.getSource('drainage-nodes').serialize().data.features
      return { count: nodes.length, statuses: [...new Set(nodes.map(node => node.properties.status))],
        radius: map.getPaintProperty('drainage-nodes', 'circle-radius'),
        normalRadius: map.getPaintProperty('drainage-nodes-normal', 'circle-radius') }
    })
    assert.ok(!affectedOnly.statuses.includes('normal'))
    assert.equal(affectedOnly.radius, affectedOnly.normalRadius)
    assert.equal(affectedOnly.radius, 4)
    assert.equal(await page.evaluate(() => window.__testMap.getLayoutProperty('drainage-arrows', 'visibility')), 'none')
    assert.equal(await page.evaluate(() => window.__testMap.getLayer('drainage-edges').minzoom), 15)
    assert.equal(await page.evaluate(() => window.__testMap.getPaintProperty('drainage-nodes', 'circle-stroke-width')), 1)

    await fullToggle.check()
    assert.equal(await affectedToggle.isChecked(), false)
    await page.waitForFunction(() => {
      const map = window.__testMap
      const count = id => map?.getSource(id)?.serialize()?.data?.features?.length || 0
      return count('drainage-nodes') + count('drainage-nodes-normal') === 34431
    }, null, { timeout: 120000 })
    const fullNetwork = await page.evaluate(() => {
      const map = window.__testMap
      return { zoom: map.getZoom(), normalMinzoom: map.getLayer('drainage-nodes-normal').minzoom,
        normalNodes: map.getSource('drainage-nodes-normal').serialize().data.features.length,
        renderedNodes: map.queryRenderedFeatures({ layers: ['drainage-nodes-normal'] }).length }
    })
    assert.ok(fullNetwork.zoom < 13)
    assert.ok(!fullNetwork.normalMinzoom)
    assert.ok(fullNetwork.normalNodes > 0)
    await page.waitForFunction(() => window.__testMap.queryRenderedFeatures({ layers: ['drainage-nodes-normal'] }).length > 0,
      null, { timeout: 60000 })
    fullNetwork.renderedNodes = await page.evaluate(() => window.__testMap.queryRenderedFeatures({ layers: ['drainage-nodes-normal'] }).length)
    await fullToggle.uncheck()
    await page.waitForFunction(() => ['drainage-nodes', 'drainage-nodes-normal', 'drainage-edges', 'drainage-edges-normal', 'drainage-arrows']
      .every(id => window.__testMap.getSource(id).serialize().data.features.length === 0), null, { timeout: 60000 })

    const lastResponse = page.waitForResponse(response =>
      response.url().includes(`/drainage/${eventDate}?window_minutes=${finalMinutes}`) &&
      (rainfallSource === 'observed' || response.url().includes('rainfall_source=nowcast')) &&
      response.status() === 200,
      { timeout: 120000 })
    await page.getByRole('group', { name: 'Rainfall duration intervals' }).getByRole('button', { name: `${finalMinutes}m` }).click()
    const last = (await (await lastResponse).json()).summary
    const finalCount = last.surcharged_manholes
    await page.waitForFunction(count => document.body.innerText.includes(`${count} of 34,431 manholes surcharged`),
      finalCount, { timeout: 60000 })

    if (expectedFirst !== undefined) assert.equal(firstCount, expectedFirst)
    if (expectedLast !== undefined) assert.equal(finalCount, Number(expectedLast))
    assert.notEqual(firstCount, finalCount)
    await page.waitForFunction(() => !!window.__testMap.getLayer('event-fsi'), null, { timeout: 120000 })
    const rasterDisplay = await page.evaluate(async () => {
      const map = window.__testMap
      const image = new Image()
      image.src = map.getSource('event-fsi').serialize().url
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = image.width; canvas.height = image.height
      const context = canvas.getContext('2d')
      context.drawImage(image, 0, 0)
      const data = context.getImageData(0, 0, image.width, image.height).data
      const { fromArrayBuffer } = await import('/node_modules/.vite/deps/geotiff.js')
      const { projectRaster } = await import('/src/lib/rasterProjection.ts')
      const response = await fetch('http://127.0.0.1:8002/flood/land-mask')
      const tiff = await fromArrayBuffer(await response.arrayBuffer())
      const land = await tiff.getImage()
      const projected = projectRaster(await land.readRasters({ samples: [0], interleave: true }),
        land.getWidth(), land.getHeight(), land.getBoundingBox())
      let bluePixels = 0, shadedPixels = 0
      let waterPixelsShaded = 0
      for (let i = 0; i < data.length; i += 4) {
        if (!data[i + 3]) continue
        shadedPixels++
        if (projected.values[i / 4] !== 1) waterPixelsShaded++
        if (data[i + 2] > data[i] && data[i + 2] > data[i + 1]) bluePixels++
      }
      return { bluePixels, shadedPixels, waterPixelsShaded, hatching: !!map.getLayer('station-coverage') }
    })
    assert.ok(rasterDisplay.bluePixels > 0)
    assert.equal(rasterDisplay.waterPixelsShaded, 0)
    assert.ok(rasterDisplay.shadedPixels > 0)
    assert.equal(rasterDisplay.hatching, false)
    const satelliteButton = page.getByRole('button', { name: 'Satellite imagery', exact: true })
    if (await satelliteButton.getAttribute('aria-pressed') !== 'true') await satelliteButton.click()
    await page.waitForFunction(() => window.__testMap.getLayoutProperty('satellite-imagery', 'visibility') === 'visible')
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => window.__testMap?.getLayer('satellite-imagery') &&
      window.__testMap.getLayoutProperty('satellite-imagery', 'visibility') === 'visible', null, { timeout: 60000 })
    assert.equal(await satelliteButton.getAttribute('aria-pressed'), 'true')
    await satelliteButton.click()
    await page.waitForFunction(() => window.__testMap.getLayoutProperty('satellite-imagery', 'visibility') === 'none')
    await satelliteButton.click()
    await page.waitForFunction(() => window.__testMap.getLayoutProperty('satellite-imagery', 'visibility') === 'visible')
    if (screenshotPath) {
      await page.waitForFunction(() => !!window.__testMap.getLayer('event-fsi'), null, { timeout: 120000 })
      await page.getByRole('button', { name: /Satellite/ }).first().click()
      await page.evaluate(() => window.__testMap.jumpTo({ center: [72.84, 19.02], zoom: 13 }))
      assert.equal(await page.evaluate(() => window.__testMap.getPaintProperty('event-fsi', 'raster-resampling')), 'nearest')
      await page.waitForTimeout(2500)
      await page.screenshot({ path: screenshotPath })
    }
    console.log(JSON.stringify({ eventDate, rainfallSource, first, last,
      ui: [`${firstCount} of 34,431`, `${finalCount} of 34,431`], affectedOnly, fullNetwork, rasterDisplay }, null, 2))
  } finally {
    await browser.close()
  }
})().catch(error => { console.error(error); process.exitCode = 1 })
