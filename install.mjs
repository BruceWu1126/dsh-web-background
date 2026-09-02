#!/usr/bin/env node
/**
 * Cross-platform installer for the dsh-web-background plugin.
 *
 *   node install.mjs                     install into the default dsh home
 *   node install.mjs --dsh-home <path>   explicit harness home (`~` is expanded)
 *   node install.mjs --profile <name>    profile to patch (default: web)
 *   node install.mjs --uninstall         remove everything, restore backups
 *   node install.mjs --help              print usage, including Linux / Windows examples
 *
 * What it does (install):
 *   1. copies the plugin into $DSH_HOME/profiles/node_modules/dsh-web-background
 *   2. adds the Loader row to $DSH_HOME/profiles/<profile>/cordis.patch.yml
 *   3. patches dsh-host-apiproxy's WEB_SETTINGS_NAMESPACES allowlist so the
 *      plugin's settings namespace is exposed to the browser (the product has
 *      no third-party exposure mechanism yet — see README)
 *   4. patches dsh-client-ui-settings-general's nav glyph map so the
 *      "Background" row shows an image icon instead of the settings gear
 *      (cosmetic; the shell has no per-section icon slot yet)
 *
 * Steps 3 and 4 target the dsh INSTALL directory, located through the module
 * fallback links every dsh boot maintains at $DSH_HOME/profiles/node_modules.
 * Every patched file is backed up to <file>.dsh-wb-backup before the first
 * modification; `--uninstall` restores those backups, removes the plugin
 * directory, and restores the profile patch file.
 *
 * After installing, restart `dsh web` (Host-side changes load at boot).
 */
import { existsSync, readFileSync, writeFileSync, copyFileSync, mkdirSync, rmSync, cpSync, realpathSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'

const pluginDir = dirname(fileURLToPath(import.meta.url))
const defaultDshHome = join(homedir(), '.dsh')
const isWindows = process.platform === 'win32'

function flag(name) {
  const i = process.argv.indexOf(name)
  if (i < 0) return undefined
  const value = process.argv[i + 1]
  if (value === undefined || value.startsWith('--')) fail(`${name} requires a value`)
  return value
}

/** Expand a leading `~` so `--dsh-home ~/.dsh` works even if the shell did not expand it. */
function expandHome(path) {
  if (path === '~') return homedir()
  if (path.startsWith('~/') || path.startsWith('~\\')) return join(homedir(), path.slice(2))
  return path
}

function printHelp() {
  const unixHome = '~/.dsh'
  const winHome = '%USERPROFILE%\\.dsh'
  console.log(`Usage: node install.mjs [options]

  --dsh-home <path>   Harness data directory (default: $DSH_HOME or ${isWindows ? winHome : unixHome})
  --profile <name>    Profile to patch (default: web)
  --uninstall         Restore backups and remove the plugin
  -h, --help          Show this help

Linux / macOS:
  npx @deepseek-ai/dsh web    # run once so ~/.dsh/profiles exists
  node install.mjs
  node install.mjs --dsh-home ~/.dsh
  node install.mjs --uninstall

Windows (PowerShell):
  npx @deepseek-ai/dsh web
  node install.mjs
  node install.mjs --dsh-home $env:USERPROFILE\\.dsh

Switching OS does not copy $DSH_HOME. Re-run this script on the other system.`)
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  printHelp()
  process.exit(0)
}

const uninstall = process.argv.includes('--uninstall')
const profile = flag('--profile') ?? 'web'
const dshHome = expandHome(flag('--dsh-home') ?? process.env.DSH_HOME ?? defaultDshHome)

if (profile === '.' || profile === '..' || /[\\/]/.test(profile)) fail(`invalid --profile "${profile}": must be a bare profile name`)
if (/^~/.test(profile)) fail(`invalid --profile "${profile}": "~" is not expanded here; pass an absolute path with --dsh-home instead`)

const profilesDir = join(dshHome, 'profiles')
const modulesDir = join(profilesDir, 'node_modules')
const profileDir = join(profilesDir, profile)
const patchFile = join(profileDir, 'cordis.patch.yml')
const targetDir = join(modulesDir, 'dsh-web-background')

const PATCH_BLOCK = [
  '# Web UI background customization plugin (dsh-web-background).',
  '- insert:',
  '    - id: web-background',
  '      name: dsh-web-background',
].join('\n')

/** The shipped empty profile patch template, restored when the file did not exist before install. */
const DEFAULT_PROFILE_PATCH = [
  '# Your patch layer for this dsh profile, applied after every bundle layer:',
  '# a top-level YAML array of loader patch entries (id-targeted config',
  '# overrides, disables, and insert lists; `!!js` expressions allowed).',
  '[]',
].join('\n') + '\n'

const PROFILE_MARKER = 'name: dsh-web-background'

const APIPROXY_ANCHOR = '\t"web-search-deepseek"\n];'
const APIPROXY_REPLACEMENT = [
  '\t"web-search-deepseek",',
  '\t// Third-party: the dsh-web-background settings namespace (re-run install.mjs after a dsh update).',
  '\t"web-background"',
  '];',
].join('\n')
const APIPROXY_MARKER = 'the dsh-web-background settings namespace'

const SHELL_ANCHOR = [
  '\t\t\tif (id === "plugins") return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPersonalizationOutline16, {',
  '\t\t\t\tclassName: SettingsRoot_module_css_default.navIcon,',
  '\t\t\t\tsize: 16',
  '\t\t\t});',
  '\t\t\treturn (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSettingsOutline16, {',
  '\t\t\t\tclassName: SettingsRoot_module_css_default.navIcon,',
  '\t\t\t\tsize: 16',
  '\t\t\t});',
].join('\n')
const SHELL_REPLACEMENT = [
  '\t\t\tif (id === "plugins") return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPersonalizationOutline16, {',
  '\t\t\t\tclassName: SettingsRoot_module_css_default.navIcon,',
  '\t\t\t\tsize: 16',
  '\t\t\t});',
  '\t\t\t// Third-party: the dsh-web-background section glyph (re-run install.mjs after a dsh update).',
  '\t\t\tif (id === "background") return (0, react_jsx_runtime.jsx)("svg", {',
  '\t\t\t\twidth: 16,',
  '\t\t\t\theight: 16,',
  '\t\t\t\tclassName: SettingsRoot_module_css_default.navIcon,',
  '\t\t\t\tviewBox: "0 0 24 24",',
  '\t\t\t\tfill: "currentColor",',
  '\t\t\t\txmlns: "http://www.w3.org/2000/svg",',
  '\t\t\t\tchildren: (0, react_jsx_runtime.jsx)("path", {',
  '\t\t\t\t\tfillRule: "evenodd",',
  '\t\t\t\t\tclipRule: "evenodd",',
  '\t\t\t\t\td: "M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"',
  '\t\t\t\t})',
  '\t\t\t});',
  '\t\t\treturn (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSettingsOutline16, {',
  '\t\t\t\tclassName: SettingsRoot_module_css_default.navIcon,',
  '\t\t\t\tsize: 16',
  '\t\t\t});',
].join('\n')
const SHELL_MARKER = 'the dsh-web-background section glyph'

function ok(message) {
  console.log('  [ok] ' + message)
}
function warn(message) {
  console.log('  [!!] ' + message)
}
function fail(message) {
  console.error('install.mjs: ' + message)
  process.exit(1)
}

/** Absolute real path of one in-box product package, through the boot-healed fallback link. */
function realProductDir(name) {
  const link = join(modulesDir, '@deepseek-ai', name)
  if (!existsSync(link)) return undefined
  try {
    return realpathSync(link)
  } catch {
    return undefined
  }
}

/** Back up + string-patch one product file. Returns the outcome word. */
function patchProduct(file, anchor, replacement, marker, alreadyNeedle) {
  const content = readFileSync(file, 'utf8')
  if (content.includes(marker) || content.includes(alreadyNeedle)) return 'already'
  if (!content.includes(anchor)) return 'anchor-missing'
  const backup = file + '.dsh-wb-backup'
  if (!existsSync(backup)) copyFileSync(file, backup)
  writeFileSync(file, content.replace(anchor, replacement))
  return 'patched'
}

/** Restore one product file from its backup, when one exists. */
function restoreProduct(file) {
  const backup = file + '.dsh-wb-backup'
  if (!existsSync(backup)) return false
  copyFileSync(backup, file)
  rmSync(backup)
  return true
}

/** Add the Loader row to a profile's cordis.patch.yml (a top-level YAML list). */
function patchProfile() {
  const backup = patchFile + '.dsh-wb-backup'
  if (!existsSync(patchFile)) {
    if (!existsSync(backup)) writeFileSync(backup, DEFAULT_PROFILE_PATCH)
    writeFileSync(patchFile, PATCH_BLOCK + '\n')
    return 'created'
  }
  let content = readFileSync(patchFile, 'utf8')
  if (content.includes(PROFILE_MARKER)) return 'already'
  if (!existsSync(backup)) copyFileSync(patchFile, backup)
  if (/\[\s*\]\s*$/.test(content)) {
    content = content.replace(/\[\s*\]\s*$/, PATCH_BLOCK)
  } else if (/^\s*\]\s*$/m.test(content)) {
    content = content.replace(/\n?\s*\]\s*$/, '\n' + PATCH_BLOCK)
  } else {
    content = content.replace(/\s*$/, '') + '\n' + PATCH_BLOCK + '\n'
  }
  writeFileSync(patchFile, content)
  return 'patched'
}

function restoreProfile() {
  const backup = patchFile + '.dsh-wb-backup'
  if (!existsSync(backup)) return false
  copyFileSync(backup, patchFile)
  rmSync(backup)
  return true
}

function doUninstall() {
  console.log('Uninstalling dsh-web-background from ' + dshHome)
  const apiproxyDir = realProductDir('dsh-host-apiproxy')
  const shellDir = realProductDir('dsh-client-ui-settings-general')
  if (apiproxyDir !== undefined) {
    ok(restoreProduct(join(apiproxyDir, 'lib', 'index.js')) ? 'restored dsh-host-apiproxy/lib/index.js' : 'no backup for dsh-host-apiproxy (left as is)')
  } else {
    warn('dsh-host-apiproxy link not found; skipping')
  }
  if (shellDir !== undefined) {
    ok(restoreProduct(join(shellDir, 'lib', 'client.js')) ? 'restored dsh-client-ui-settings-general/lib/client.js' : 'no backup for dsh-client-ui-settings-general (left as is)')
  } else {
    warn('dsh-client-ui-settings-general link not found; skipping')
  }
  ok(restoreProfile() ? 'restored ' + patchFile : 'no backup for the profile patch file (left as is)')
  if (existsSync(targetDir)) {
    rmSync(targetDir, { recursive: true, force: true })
    ok('removed ' + targetDir)
  } else {
    warn('plugin directory not found; nothing to remove')
  }
  console.log('Done. Restart `dsh web` to finish.')
}

function doInstall() {
  console.log('Installing dsh-web-background into ' + dshHome + ' (profile: ' + profile + ')')
  if (typeof process.getuid === 'function' && process.getuid() === 0) {
    warn('running as root; dsh data usually lives in the login user\'s ~/.dsh, not /root/.dsh')
  }
  if (!existsSync(profileDir)) {
    const launch = profile === 'web' ? 'web' : '--profile ' + profile
    fail(`profile directory not found: ${profileDir} — run \`npx @deepseek-ai/dsh ${launch}\` once first so dsh creates ${isWindows ? '%USERPROFILE%\\.dsh' : '~/.dsh'}/profiles/${profile}`)
  }

  // 1. plugin package
  mkdirSync(targetDir, { recursive: true })
  for (const file of ['package.json', 'README.md']) copyFileSync(join(pluginDir, file), join(targetDir, file))
  rmSync(join(targetDir, 'lib'), { recursive: true, force: true })
  cpSync(join(pluginDir, 'lib'), join(targetDir, 'lib'), { recursive: true })
  ok('copied plugin to ' + targetDir)

  // 2. profile patch row
  ok('cordis.patch.yml: ' + patchProfile())

  // 3. settings allowlist (required on 0.1.0-rc.6; 0.1.1+ describes every registered namespace)
  const apiproxyDir = realProductDir('dsh-host-apiproxy')
  if (apiproxyDir === undefined) fail('cannot locate the dsh install through ' + join(modulesDir, '@deepseek-ai', 'dsh-host-apiproxy') + ' — run `npx @deepseek-ai/dsh web` once (it heals the module fallback links), then re-run')
  const apiproxyFile = join(apiproxyDir, 'lib', 'index.js')
  const apiproxyOutcome = patchProduct(apiproxyFile, APIPROXY_ANCHOR, APIPROXY_REPLACEMENT, APIPROXY_MARKER, '\t"web-background"')
  if (apiproxyOutcome === 'anchor-missing') {
    warn('dsh-host-apiproxy has no WEB_SETTINGS_NAMESPACES allowlist (this dsh version exposes every registered namespace) — skipping that patch')
  } else {
    ok('dsh-host-apiproxy allowlist: ' + apiproxyOutcome)
  }

  // 4. nav glyph (cosmetic)
  const shellDir = realProductDir('dsh-client-ui-settings-general')
  if (shellDir === undefined) {
    warn('cannot locate dsh-client-ui-settings-general; skipping the nav icon patch (the section shows the gear icon)')
  } else {
    const shellFile = join(shellDir, 'lib', 'client.js')
    const shellOutcome = patchProduct(shellFile, SHELL_ANCHOR, SHELL_REPLACEMENT, SHELL_MARKER, 'if (id === "background")')
    if (shellOutcome === 'anchor-missing') warn('dsh-client-ui-settings-general/lib/client.js does not contain the expected navIcon anchor (different dsh version?) — skipping the icon patch; see README for the manual edit')
    else ok('dsh-client-ui-settings-general nav glyph: ' + shellOutcome)
  }

  console.log('')
  console.log('Install complete. Restart `dsh web`, refresh the page, then open Settings \u2192 Background.')
  console.log('After a dsh update, re-run this script to re-apply the two product patches.')
}

if (uninstall) doUninstall()
else doInstall()
