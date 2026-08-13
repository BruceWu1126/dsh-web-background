/**
 * Render-level test with the REAL React + react-dom/server from the dsh
 * checkout: catches jsx children bugs the stub-based logic test cannot see.
 *   node test\render-section.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'

// ── load the bundle with REAL runtime stubs ──────────────────────────────────
let registered = null
globalThis.window = { __ModuleLoader__: { load: (handoff) => { registered = handoff } } }
const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
new Function('window', source)(globalThis.window)

const pluginExports = registered.factory((spec) => {
  if (spec === 'react') return React
  if (spec === 'react/jsx-runtime') return jsxRuntime
  throw new Error(`unexpected require("${spec}")`)
})

// ── fake scope + ctx (same shape as run-client.mjs) ──────────────────────────
function createFakeScope() {
  const listeners = new Set()
  let snapshot = { status: 'loading', value: undefined, base: undefined, user: undefined, revision: 0, writable: true, mode: 'host' }
  const fire = () => { for (const fn of listeners) fn() }
  const setValue = (patch) => {
    snapshot = { ...snapshot, status: 'ready', value: { ...(snapshot.value ?? {}), ...patch }, revision: snapshot.revision + 1 }
    fire()
  }
  return {
    getSnapshot: () => snapshot,
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn) },
    set: async (field, value) => setValue({ [field]: value }),
    unset: async () => {},
    setValue,
  }
}

const scope = createFakeScope()
const ctx = {
  settingsScope: { bind: () => scope },
  theme: { overrideTokens: () => () => {} },
  locale: { register: () => () => {}, bind: (ns) => (key) => `${ns}.${key}` },
  slots: { inject: () => {}, register: () => () => {} },
  effect: (fn) => fn(),
  get: () => undefined,
}
pluginExports.apply(ctx)

const t = (key) => 'settings.web-background.' + key

// ── render the three states ──────────────────────────────────────────────────
// 1. loading / unavailable branch
let html = renderToStaticMarkup(React.createElement(pluginExports.BackgroundSection, { t }))
assert.ok(html.includes('settings.web-background.unavailable'), 'unavailable text rendered')

// 2. ready, color mode
scope.setValue({ enabled: false, mode: 'color', colorLight: '#f5f6f8', colorDark: '#0e1116' })
html = renderToStaticMarkup(React.createElement(pluginExports.BackgroundSection, { t }))
assert.ok(html.includes('settings.web-background.enable'), 'enable label rendered')
assert.ok(html.includes('settings.web-background.modeColor'), 'color segment rendered')
assert.ok(html.includes('settings.web-background.modeGradient'), 'gradient segment rendered')
assert.ok(html.includes('settings.web-background.modeImage'), 'image segment rendered')
assert.ok(html.includes('type="color"'), 'color inputs rendered')
assert.ok(html.includes('wb-previewcell'), 'preview cells rendered')
assert.ok(html.includes('settings.web-background.reset'), 'reset button rendered')

// 3. gradient mode: four color pickers + angle slider + presets
scope.setValue({ mode: 'gradient' })
html = renderToStaticMarkup(React.createElement(pluginExports.BackgroundSection, { t }))
assert.ok(html.includes('settings.web-background.gradientStart'), 'gradient start pickers rendered')
assert.ok(html.includes('settings.web-background.gradientAngle'), 'gradient angle slider rendered')
assert.equal((html.match(/type="color"/g) ?? []).length, 4, 'four gradient color pickers rendered')
assert.ok(html.includes('settings.web-background.preset'), 'gradient preset chips rendered')

// 4. image mode
scope.setValue({ mode: 'image', imageUrl: 'https://example.com/bg.jpg' })
html = renderToStaticMarkup(React.createElement(pluginExports.BackgroundSection, { t }))
assert.ok(html.includes('settings.web-background.imageUrl'), 'image url field rendered')
assert.ok(html.includes('type="range"'), 'overlay range rendered')
assert.ok(html.includes('https://example.com/bg.jpg'), 'preview carries the image')
assert.ok(html.includes('settings.web-background.importLocal'), 'local import button rendered')
assert.ok(html.includes('step="1"'), 'overlay slider steps by 1%')

// 5. imported data URL replaces the raw url field with a summary chip + clear
scope.setValue({ imageUrl: 'data:image/png;base64,AAAA' })
html = renderToStaticMarkup(React.createElement(pluginExports.BackgroundSection, { t }))
assert.ok(html.includes('settings.web-background.imported'), 'imported chip rendered')
assert.ok(html.includes('settings.web-background.clear'), 'clear button rendered')
assert.ok(!html.includes('https://example.com/bg.jpg'), 'raw url input replaced by the chip')

console.log('render test: all assertions passed')
console.log('--- sample color-mode output (first 600 chars) ---')
scope.setValue({ mode: 'color' })
console.log(renderToStaticMarkup(React.createElement(pluginExports.BackgroundSection, { t })).slice(0, 600))
