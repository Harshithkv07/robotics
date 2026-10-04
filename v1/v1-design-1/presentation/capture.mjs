// Screenshot the running viewer through the Chrome DevTools Protocol (no extra npm packages).
// usage: node presentation/capture.mjs <url> <out.png> <layout> <bayIndex> <tSeconds> [width height]
import { spawn } from 'node:child_process'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const [url, out, layout = 'Cross', bayIdx = '0', tSec = '45', W = '1600', H = '900', mode = 'guided'] = process.argv.slice(2)
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const port = 9333
const profile = mkdtempSync(join(tmpdir(), 'cdp-'))
const proc = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, `--window-size=${W},${H}`,
  '--hide-scrollbars', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', 'about:blank',
], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function target() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
      const page = list.find((t) => t.type === 'page')
      if (page) return page.webSocketDebuggerUrl
    } catch {}
    await sleep(250)
  }
  throw new Error('chrome did not start')
}

const ws = new WebSocket(await target())
await new Promise((r) => ws.addEventListener('open', r, { once: true }))
let id = 0
const pending = new Map()
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
})
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
const evaluate = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 400))
  return r.result?.result?.value
}

try {
  await send('Emulation.setDeviceMetricsOverride', { width: +W, height: +H, deviceScaleFactor: 2, mobile: false })
  await send('Page.enable')
  await send('Page.navigate', { url })
  await sleep(6000)
  const steps = await evaluate(`(async () => {
    const sleep = (ms) => new Promise(r => setTimeout(r, ms)); const all = s => [...document.querySelectorAll(s)]; const q = s => document.querySelector(s)
    all('.pick').find(b => b.textContent.includes(${JSON.stringify(layout)})).click(); await sleep(1500)
    if (${JSON.stringify(mode)} === 'select') return { mode: 'select', hint: q('.hint')?.textContent }
    const bays = all('.baybtn:not(:disabled)'); bays[Math.min(${+bayIdx}, bays.length - 1)].click(); await sleep(1500)
    if (${JSON.stringify(mode)} === 'unaided') { all('[aria-label="Guidance"] button').find(b => b.textContent === 'Unaided').click(); await sleep(1500) }
    const pause = q('.transport .btn.primary'); if (pause.textContent.trim() === 'Pause') pause.click(); await sleep(300)
    const sc = q('.scrub'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    set.call(sc, String(${+tSec})); sc.dispatchEvent(new Event('input', { bubbles: true })); await sleep(2500)
    return { banner: q('.banner')?.textContent, step: q('.gb-top h3')?.textContent, label: q('.gbar .label')?.textContent, time: q('.time')?.textContent, canvas: !!q('canvas') }
  })()`)
  console.log('state', JSON.stringify(steps))
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  writeFileSync(out, Buffer.from(shot.result.data, 'base64'))
  console.log('wrote', out)
} finally {
  ws.close()
  proc.kill()
}
