const mkdirp = require('mkdirp')
const puppeteer = require('puppeteer')
const path = require('path')
const glob = require('glob')

const allExamples = glob
  .sync("*.js", {
    cwd: path.resolve(__dirname, "../")
  })
  .map(example => `./${example}`)
  .filter(example => !['./index.js', './helpers.js', './webpack.config.js'].includes(example))
  .map(example => path.basename(example, path.extname(example)))

let timer = null
const TIMEOUT = 5 * 60 * 1000

const examples = process.argv[2] ? [process.argv[2]] : allExamples
const url = process.argv[3] || 'http://localhost:8080/'

const folder = `screenshots`
mkdirp.sync(folder)

async function takeScreenshots () {
  const browser = await puppeteer.launch({
    timeout: 0,
    args: ["--proxy-server='direct://'", '--proxy-bypass-list=*']
  })
  const page = await browser.newPage()
  // page.setDefaultNavigationTimeout(2 * TIMEOUT)

  let promiseResolve
  let pScreenshotEvent

  await page.exposeFunction('onCustomEvent', e => {
    promiseResolve(`${e.type} fired`, e.detail || '')
  })

  await page.setViewport({ width: 1280, height: 720 })

  for (let example of examples) {
    console.log(`• Start screenshot for ${example}:`)
    console.time('  Duration')

    // Listen for custom event
    await page.evaluateOnNewDocument(type => {
      window.addEventListener(type, window.onCustomEvent)
    }, 'pex-screenshot')

    await page.goto(`${url}?name=${example}`, { waitUntil: 'load' })

    // Reset promise
    pScreenshotEvent = new Promise(resolve => (promiseResolve = resolve))

    // Timeout if no 'pex-screenshot' event is dispatched
    const result = await Promise.race([
      new Promise(resolve => (timer = setTimeout(resolve, TIMEOUT))),
      pScreenshotEvent
    ])

    // Reset the timer and remove custom event listener
    clearTimeout(timer)
    await page.evaluateOnNewDocument(type => {
      window.removeEventListener(type, window.onCustomEvent)
    }, 'pex-screenshot')
    console.log(`  Example ready triggered by: ${!result ? 'timer' : 'custom-event'}`)

    // Take the screenshot when ready
    await page.screenshot({ path: `${folder}/${example}.png` })
    console.log(`  Screenshot: ${folder}/${example}.png`)
    console.timeEnd('  Duration')
  }

  await page.close()
  await browser.close()
}

takeScreenshots().catch(error => {
  console.error(error)

  process.exit(1)
})
