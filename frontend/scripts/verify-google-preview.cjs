const { chromium } = require('C:/Users/Vansh/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright-core')

;(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(process.argv[2] || 'http://localhost:5173/?map=preview')
    await page.getByRole('heading', { name: 'Google Maps · Phase 2 preview' }).waitFor()
    const missingKey = await page.getByRole('alert').filter({ hasText: 'VITE_GOOGLE_MAPS_API_KEY' }).count()
    if (!missingKey) {
      await page.waitForSelector('.gm-style', { timeout: 45000 })
      await page.getByRole('status').filter({ hasText: 'Loading Google Maps' }).waitFor({ state: 'hidden', timeout: 45000 })
      console.log('Google Maps tiles loaded; confirm billing/authentication warnings visually.')
    } else console.log('Missing-key state verified. Live Google Maps rendering remains unverified.')
    const contrast = await page.locator('.google-map-preview .hud-label').first().evaluate(element => {
      const color = getComputedStyle(element).color
      const background = getComputedStyle(element.closest('.hud-panel')).backgroundColor
      const luminance = value => {
        const rgb = value.match(/[\d.]+/g).slice(0, 3).map(Number).map(x => {
          const c = x / 255
          return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
        })
        return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722
      }
      const values = [luminance(color), luminance(background)].sort((a, b) => b - a)
      return { color, background, ratio: (values[0] + 0.05) / (values[1] + 0.05) }
    })
    if (contrast.ratio < 4.5) throw new Error(`Label contrast too low: ${contrast.ratio}`)
    console.log('Light-card label contrast:', contrast)
    await page.screenshot({ path: 'google-preview-desktop.png' })
    await page.setViewportSize({ width: 390, height: 844 })
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Mobile horizontal overflow')
    await page.screenshot({ path: 'google-preview-mobile.png' })
    if (errors.length) throw new Error(errors.join('\n'))
    console.log('Desktop/mobile preview verified; no uncaught browser errors.')
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
