/**
 * Host schema sanity check against the plugin's exported schema:
 *   node test/host-schema-check.mjs
 */
import { BackgroundSettingsSchema } from '../lib/index.js'

// defaults resolve on an empty section
const resolved = BackgroundSettingsSchema({})
console.log('resolved defaults:', JSON.stringify(resolved))
if (resolved.enabled !== false || resolved.mode !== 'color' || resolved.imageOverlay !== 0) throw new Error('default resolution failed')
if (resolved.gradientAngle !== 135 || resolved.gradientLightStart !== '#f5f7fa') throw new Error('gradient defaults failed')

// invalid overlay rejected
let rejected = false
try {
  BackgroundSettingsSchema({ enabled: true, imageOverlay: 200 })
} catch (e) {
  rejected = true
}
if (!rejected) throw new Error('overlay bound not enforced')

// invalid mode rejected
rejected = false
try {
  BackgroundSettingsSchema({ mode: 'video' })
} catch (e) {
  rejected = true
}
if (!rejected) throw new Error('mode union not enforced')

// invalid gradient angle rejected
rejected = false
try {
  BackgroundSettingsSchema({ gradientAngle: 500 })
} catch (e) {
  rejected = true
}
if (!rejected) throw new Error('gradient angle bound not enforced')

// wire serialization round-trip
const json = BackgroundSettingsSchema.toJSON()
if (typeof json !== 'object' || json === null) throw new Error('schema.toJSON() failed')
console.log('schema json type:', json.type)

console.log('host schema check: passed')
