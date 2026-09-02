import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const installer = join(repoRoot, 'install.mjs')

const shellAnchor = [
  '\t\t\tif (id === "plugins") return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPersonalizationOutline16, {',
  '\t\t\t\tclassName: SettingsRoot_module_css_default.navIcon,',
  '\t\t\t\tsize: 16',
  '\t\t\t});',
  '\t\t\treturn (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSettingsOutline16, {',
  '\t\t\t\tclassName: SettingsRoot_module_css_default.navIcon,',
  '\t\t\t\tsize: 16',
  '\t\t\t});',
].join('\n')

function write(path, content) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}

function fixture({ manualAllowlist = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'dsh-web-background-'))
  const dshHome = join(root, '.dsh')
  const profilePatch = join(dshHome, 'profiles', 'web', 'cordis.patch.yml')
  const apiproxy = join(dshHome, 'profiles', 'node_modules', '@deepseek-ai', 'dsh-host-apiproxy', 'lib', 'index.js')
  const shell = join(dshHome, 'profiles', 'node_modules', '@deepseek-ai', 'dsh-client-ui-settings-general', 'lib', 'client.js')
  const apiproxyOriginal = manualAllowlist
    ? 'const WEB_SETTINGS_NAMESPACES = [\n\t"web-search-deepseek",\n\t"web-background"\n];\n'
    : 'const WEB_SETTINGS_NAMESPACES = [\n\t"web-search-deepseek"\n];\n'
  const shellOriginal = `function navIcon(id) {\n${shellAnchor}\n}\n`
  write(profilePatch, '[]\n')
  write(apiproxy, apiproxyOriginal)
  write(shell, shellOriginal)
  return { root, dshHome, profilePatch, apiproxy, shell, apiproxyOriginal, shellOriginal }
}

function run(dshHome, ...args) {
  return spawnSync(process.execPath, [installer, '--dsh-home', dshHome, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
  })
}

function occurrences(value, needle) {
  return value.split(needle).length - 1
}

// Install, repeat, and uninstall must be lossless and idempotent.
{
  const f = fixture()
  try {
    let result = run(f.dshHome)
    assert.equal(result.status, 0, result.stderr)
    const target = join(f.dshHome, 'profiles', 'node_modules', 'dsh-web-background')
    assert.ok(existsSync(join(target, 'lib', 'client.js')), 'plugin client copied')
    assert.ok(readFileSync(f.profilePatch, 'utf8').includes('name: dsh-web-background'), 'profile row added')
    assert.ok(readFileSync(f.apiproxy, 'utf8').includes('the dsh-web-background settings namespace'), 'allowlist patched')
    assert.ok(readFileSync(f.shell, 'utf8').includes('the dsh-web-background section glyph'), 'nav glyph patched')

    result = run(f.dshHome)
    assert.equal(result.status, 0, result.stderr)
    assert.equal(occurrences(readFileSync(f.profilePatch, 'utf8'), 'name: dsh-web-background'), 1, 'profile row not duplicated')
    assert.equal(occurrences(readFileSync(f.apiproxy, 'utf8'), 'the dsh-web-background settings namespace'), 1, 'allowlist patch not duplicated')

    result = run(f.dshHome, '--uninstall')
    assert.equal(result.status, 0, result.stderr)
    assert.equal(readFileSync(f.profilePatch, 'utf8'), '[]\n', 'profile patch restored byte-for-byte')
    assert.equal(readFileSync(f.apiproxy, 'utf8'), f.apiproxyOriginal, 'apiproxy restored byte-for-byte')
    assert.equal(readFileSync(f.shell, 'utf8'), f.shellOriginal, 'settings shell restored byte-for-byte')
    assert.ok(!existsSync(target), 'plugin directory removed')
  } finally {
    rmSync(f.root, { recursive: true, force: true })
  }
}

// A user-provided allowlist entry is already satisfied and must not be treated
// as an incompatible product version or removed during uninstall.
{
  const f = fixture({ manualAllowlist: true })
  try {
    let result = run(f.dshHome)
    assert.equal(result.status, 0, result.stderr)
    assert.equal(readFileSync(f.apiproxy, 'utf8'), f.apiproxyOriginal, 'manual allowlist remains untouched')
    assert.ok(!existsSync(f.apiproxy + '.dsh-wb-backup'), 'manual allowlist does not create a product backup')
    result = run(f.dshHome, '--uninstall')
    assert.equal(result.status, 0, result.stderr)
    assert.equal(readFileSync(f.apiproxy, 'utf8'), f.apiproxyOriginal, 'uninstall preserves manual allowlist')
  } finally {
    rmSync(f.root, { recursive: true, force: true })
  }
}

// A profile name must never escape $DSH_HOME/profiles.
{
  const f = fixture()
  try {
    const result = run(f.dshHome, '--profile', '..')
    assert.notEqual(result.status, 0, 'path-traversing profile rejected')
    assert.match(result.stderr, /invalid --profile/, 'rejection explains the invalid profile')
    assert.ok(!existsSync(join(f.dshHome, 'cordis.patch.yml')), 'no file written outside the profiles directory')
  } finally {
    rmSync(f.root, { recursive: true, force: true })
  }
}

// --help must exit 0 without touching a harness home, and mention Linux usage.
{
  const result = spawnSync(process.execPath, [installer, '--help'], {
    cwd: repoRoot,
    encoding: 'utf8',
  })
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /Linux \/ macOS/, 'help lists Linux usage')
  assert.match(result.stdout, /npx @deepseek-ai\/dsh web/, 'help tells Linux users how to create ~/.dsh first')
  assert.match(result.stdout, /Switching OS/, 'help notes that $DSH_HOME is per operating system')
}

// A quoted `~` in --dsh-home must still resolve to the login home, not a literal tilde directory.
{
  const missing = join('~', `dsh-wb-missing-${process.pid}`)
  const result = spawnSync(process.execPath, [installer, '--dsh-home', missing], {
    cwd: repoRoot,
    encoding: 'utf8',
  })
  assert.notEqual(result.status, 0, 'missing expanded home still fails install')
  assert.match(result.stderr, /profile directory not found/, 'missing profile is explained')
  assert.doesNotMatch(result.stderr, /~\/dsh-wb-missing/, 'tilde is expanded before the error path is printed')
  assert.match(result.stderr, process.platform === 'win32' ? /%USERPROFILE%\\\.dsh/ : /~\/\.dsh/, 'hint uses the current OS default home')
}

console.log('installer integration: all assertions passed')
