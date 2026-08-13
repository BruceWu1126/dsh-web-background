/**
 * Client bundle logic test (run with plain node from this directory):
 *   node test/run-client.mjs
 *
 * Loads lib/client.js against stub module-loader/React environments and
 * drives the plugin through a fake Cordis context, asserting the background
 * override layer follows the settings scope exactly.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// ── stub the browser module-loader sink, then execute the bundle ─────────────
let registered = null
globalThis.window = {
  __ModuleLoader__: {
    load(handoff) {
      registered = handoff
    },
  },
}

const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
// Execute as a classic script in this realm (the bundle uses no imports).
new Function('window', source)(globalThis.window)

assert.ok(registered !== null, 'bundle registered a factory')
assert.equal(registered.id, 'dsh-web-background')

const stubRequire = (spec) => {
  if (spec === 'react') return {}
  if (spec === 'react/jsx-runtime') return { jsx: () => null, jsxs: () => null, Fragment: null }
  throw new Error(`unexpected require("${spec}")`)
}

const pluginExports = registered.factory(stubRequire)
assert.equal(typeof pluginExports.apply, 'function', 'factory returns apply')
assert.deepEqual(pluginExports.inject, ['connection', 'remote', 'settingsScope', 'theme', 'slots', 'locale'])

// ── fake client context ──────────────────────────────────────────────────────
function createFakeScope() {
  const listeners = new Set()
  let snapshot = { status: 'loading', value: undefined, base: undefined, user: undefined, revision: 0, writable: true, mode: 'host' }
  const setCalls = []
  const unsetCalls = []
  const fire = () => {
    for (const fn of listeners) fn()
  }
  const setValue = (patch) => {
    const next = { ...(snapshot.value ?? {}), ...patch }
    snapshot = { ...snapshot, status: 'ready', value: next, revision: snapshot.revision + 1 }
    fire()
  }
  return {
    getSnapshot: () => snapshot,
    subscribe: (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    set: async (field, value) => {
      setCalls.push({ field, value })
      setValue({ [field]: value })
    },
    unset: async (field) => {
      unsetCalls.push(field)
      const next = { ...(snapshot.value ?? {}) }
      delete next[field]
      snapshot = { ...snapshot, status: 'ready', value: next, revision: snapshot.revision + 1 }
      fire()
    },
    setValue,
    setCalls,
    unsetCalls,
  }
}

function createFakeCtx(scope) {
  const layers = []
  const layerDisposed = []
  const sections = []
  const ctx = {
    settingsScope: { bind: () => scope },
    theme: {
      overrideTokens(source, tokens) {
        layers.push({ source, tokens })
        const layer = layers[layers.length - 1]
        return () => {
          layer.disposed = true
          layerDisposed.push(layer)
        }
      },
    },
    locale: {
      register: () => () => {},
      bind: (ns) => (key) => `${ns}.${key}`,
    },
    slots: {
      inject: (name, cb) => {
        if (name === 'settings.section') cb()
      },
      register: (options, component) => {
        sections.push({ options, component })
        return () => {}
      },
    },
    effects: [],
    effect(fn, label) {
      ctx.effects.push({ fn, label })
      const disposer = fn()
      return disposer
    },
    get: () => undefined,
  }
  return { ctx, layers, layerDisposed, sections }
}

// ── scenario drive ───────────────────────────────────────────────────────────
const scope = createFakeScope()
const { ctx, layers, layerDisposed, sections } = createFakeCtx(scope)
const test = pluginExports.__test

pluginExports.apply(ctx)

/** Drive a persisted snapshot change, then flush the frame-coalesced theme application. */
function persisted(patch) {
  scope.setValue(patch)
  test.syncNow()
}

// 1. while loading: no override layer
assert.equal(layers.length, 0, 'no layer while scope is loading')

// 2. ready but disabled: still no layer
persisted({ enabled: false, mode: 'color', colorLight: '#111111', colorDark: '#222222' })
assert.equal(layers.length, 0, 'no layer while disabled')

// 3. enabled color mode: base token override with light/dark pair
persisted({ enabled: true })
assert.equal(layers.length, 1, 'one layer after enabling')
assert.equal(layers[0].source, 'dsh-web-background')
assert.deepEqual(layers[0].tokens['--dsw-alias-bg-base'], { light: '#111111', dark: '#222222' })
assert.ok(!('--dsw-specific-sidebar-fill' in layers[0].tokens), 'sidebar untouched by default')

// 4. re-override with same source replaces the layer (previous layer disposed)
const firstLayer = layers[0]
persisted({ colorLight: '#abcdef' })
assert.equal(layers.length, 2, 're-override creates a new layer record')
assert.equal(firstLayer.disposed, true, 'previous layer disposed on re-override')

// 5. gradient mode composes start/end colors and the angle for both palettes
persisted({ mode: 'gradient', gradientAngle: 180, gradientLightStart: '#aaaaaa', gradientLightEnd: '#bbbbbb', gradientDarkStart: '#111111', gradientDarkEnd: '#222222' })
const gradientTokens = layers[layers.length - 1].tokens['--dsw-alias-bg-base']
assert.equal(gradientTokens.light, 'linear-gradient(180deg, #aaaaaa, #bbbbbb)')
assert.equal(gradientTokens.dark, 'linear-gradient(180deg, #111111, #222222)')

// 6. image mode: url + fit + fallback base color, no overlay at 0
persisted({ mode: 'image', imageUrl: 'https://example.com/bg.jpg', imageFit: 'cover', imageOverlay: 0, colorLight: '#fafafa', colorDark: '#101010' })
const imageTokens = layers[layers.length - 1].tokens['--dsw-alias-bg-base']
assert.ok(imageTokens.light.startsWith('url("https://example.com/bg.jpg") center/cover no-repeat #fafafa'), `cover light value: ${imageTokens.light}`)
assert.ok(imageTokens.dark.startsWith('url("https://example.com/bg.jpg") center/cover no-repeat #101010'), `cover dark value: ${imageTokens.dark}`)

// 7. tile + overlay dimming
persisted({ imageFit: 'tile', imageOverlay: 40 })
const tileTokens = layers[layers.length - 1].tokens['--dsw-alias-bg-base']
assert.ok(tileTokens.light.startsWith('linear-gradient(rgba(0,0,0,0.40),rgba(0,0,0,0.40)), url("https://example.com/bg.jpg") repeat #fafafa'), `tile light value: ${tileTokens.light}`)

// 8. empty url falls back to the solid color
persisted({ imageUrl: '   ' })
const emptyTokens = layers[layers.length - 1].tokens['--dsw-alias-bg-base']
assert.equal(emptyTokens.light, '#fafafa')

// 9. sidebar token when enabled
persisted({ imageUrl: 'https://example.com/bg.jpg', applyToSidebar: true })
const sidebarTokens = layers[layers.length - 1].tokens['--dsw-specific-sidebar-fill']
assert.ok(sidebarTokens !== undefined, 'sidebar token present when applyToSidebar')
assert.ok(sidebarTokens.light.includes('url("https://example.com/bg.jpg")'), 'sidebar light value carries the image')

// 10. disabling disposes the layer
persisted({ enabled: false })
assert.equal(layerDisposed.length > 0, true, 'layer disposed on disable')
assert.equal(layers[layers.length - 1].disposed, true, 'latest layer disposed')

// 11. settings section registration
assert.equal(sections.length, 1, 'settings.section registered')
assert.equal(sections[0].options.name, 'settings.section')
assert.equal(sections[0].options.id, 'background')
assert.equal(sections[0].options.order, 30)
assert.equal(sections[0].options.locale, 'settings.web-background')
assert.equal(sections[0].options.label(), 'settings.web-background.nav')

// 12. (moved to the end — disposal unsubscribes the local sync, so the
// optimistic tests below must run while the plugin is still live)

// ── optimistic local-state layer ─────────────────────────────────────────────

// 13. a local edit applies to the theme layer with zero persistence wait
scope.setCalls.length = 0
test.applyLocalChange({ mode: 'color', enabled: true, colorLight: '#ff0000', colorDark: '#0000ff' })
test.syncNow() // flush the frame-coalesced theme application
const instantTokens = layers[layers.length - 1].tokens['--dsw-alias-bg-base']
assert.equal(instantTokens.light, '#ff0000', 'optimistic edit applies without waiting for persistence')
assert.equal(instantTokens.dark, '#0000ff', 'optimistic dark value applies without waiting for persistence')
assert.equal(scope.setCalls.length, 0, 'no scope write before flush')

// 13b. burst edits coalesce into a single theme application carrying the latest value
const layerCountBefore = layers.length
test.applyLocalChange({ colorLight: '#101010' })
test.applyLocalChange({ colorLight: '#202020' })
test.applyLocalChange({ colorLight: '#303030' })
test.syncNow()
assert.equal(layers.length, layerCountBefore + 1, 'three burst edits coalesce into one theme application')
assert.equal(layers[layers.length - 1].tokens['--dsw-alias-bg-base'].light, '#303030', 'coalesced application carries the latest value')
await test.flush() // settle the pending fields so step 14 measures a clean window
scope.setCalls.length = 0

// 14. rapid edits on one field coalesce into a single persisted write (last value wins)
test.applyLocalChange({ colorLight: '#111111' })
test.applyLocalChange({ colorLight: '#222222' })
test.applyLocalChange({ colorLight: '#333333' })
await test.flush()
assert.equal(scope.setCalls.length, 1, 'three rapid edits flush as one write')
assert.equal(scope.setCalls[0].field, 'colorLight')
assert.equal(scope.setCalls[0].value, '#333333')

// 15. the flush settle adopts the persisted value back into the local state
assert.equal(test.optimisticValue().colorLight, '#333333', 'persisted value adopted after flush')

// 16. reset restores defaults instantly and persists unset ops for every field
scope.unsetCalls.length = 0
test.applyLocalReset()
assert.equal(test.optimisticValue().enabled, false, 'reset restores the default instantly')
assert.equal(test.optimisticValue().imageOverlay, 0, 'reset restores numeric default instantly')
await test.flush()
assert.equal(scope.unsetCalls.length, 13, 'reset persists one unset per field')
assert.ok(scope.unsetCalls.includes('enabled'), 'reset unsets the master switch')

// 17. a persisted snapshot arriving while a local edit is pending does not clobber it
test.applyLocalChange({ colorLight: '#aaaaaa' })
scope.setValue({ colorLight: '#999999', colorDark: '#0000ff', enabled: true }) // stale/other write lands
assert.equal(test.optimisticValue().colorLight, '#aaaaaa', 'pending local edit survives an intermediate snapshot')
await test.flush()
assert.equal(scope.setCalls[scope.setCalls.length - 1].value, '#aaaaaa', 'pending edit persisted after the intermediate snapshot')

// 12. effect disposal also disposes an active layer
scope.setValue({ enabled: true, mode: 'color', colorLight: '#123456', colorDark: '#654321' })
test.syncNow()
const activeBeforeDispose = layers[layers.length - 1]
const disposer = ctx.effects[0].fn()
disposer()
assert.equal(activeBeforeDispose.disposed, true, 'effect disposer disposes the active layer')

console.log('client bundle logic: all assertions passed')
