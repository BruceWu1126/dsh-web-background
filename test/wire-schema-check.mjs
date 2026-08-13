/**
 * Wire round-trip check: serialize the host schema exactly like the settings
 * provider does, then validate the resolved value with the SAME client-side
 * code the browser runs (dsh-client-schema-form's rehydrateSchema +
 * validateDraft, loaded from its real bundle).
 *   node test\wire-schema-check.mjs
 */
import assert from 'node:assert/strict'
import * as schemaForm from '@deepseek-ai/dsh-client-schema-form'
import { BackgroundSettingsSchema } from '../lib/index.js'

assert.equal(typeof schemaForm.rehydrateSchema, 'function', 'rehydrateSchema exported')
assert.equal(typeof schemaForm.validateDraft, 'function', 'validateDraft exported')

// the wire: provider serializes with schema.toJSON(), value is the resolved section
const wireSchema = BackgroundSettingsSchema.toJSON()
const resolvedValue = BackgroundSettingsSchema({ enabled: true, mode: 'image', imageUrl: 'https://example.com/a.jpg', imageOverlay: 25 })

const rehydrated = schemaForm.rehydrateSchema(wireSchema)
const failure = schemaForm.validateDraft(rehydrated, resolvedValue)
assert.equal(failure, undefined, `wire value must validate: ${JSON.stringify(failure)}`)

console.log('wire schema check: passed (host schema -> toJSON -> rehydrateSchema -> validateDraft -> ok)')
