# Forensic Learning Record (Deep Inspection): EKKOLearnAI/ekko-studio

> **Canonical Artifact**: `07_PROJECT_LEARNING/ekkolearnai-ekko-studio-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/EKKOLearnAI/ekko-studio](https://github.com/EKKOLearnAI/ekko-studio))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:55:16.693Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `EKKOLearnAI/ekko-studio`
- **Description**: Ekko Studio is a local-first AI workspace for multi-agent chat, coding, and visual workflows, available on desktop and the web.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 11259 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `bin/browser/arguments.mjs`
```
// Validate against the published browser schema before acquiring a tab or dispatching any action.
function validate(schema, value, path) {
  if (schema.oneOf) {
    const variant = schema.oneOf.find(item => item.properties?.action?.const === value?.action)
    return variant ? validate(variant, value, path) : `${path}.action must be click, type, press or scroll (use "action", not "type")`
  }
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return `${path} must be an object`
    for (const key of schema.required || []) if (value[key] === undefined) return `${path}.${key} is required`
    for (const [key, item] of Object.entries(value)) {
      if (!schema.properties?.[key]) {
        if (schema.additionalProperties === false) return `${path}.${key} is not supported`
      } else {
        const error = validate(schema.properties[key], item, `${path}.${key}`)
        if (error) return error
      }
    }
  } else if (schema.type === 'array') {
    if (!Array.isArray(value) || value.length < (schema.minItems || 0) || value.length > (schema.maxItems ?? Infinity)) {
      return `${path} must contain ${schema.minItems || 0}-${schema.maxItems ?? 'unlimited'} items`
    }
    for (let i = 0; i < value.length; i++) {
      const error = validate(schema.items, value[i], `${path}[${i}]`)
      if (error) return error
    }
  } else if (schema.type && typeof value !== schema.type) return `${path} must be ${schema.type}`
  if (schema.enum && !schema.enum.includes(value)) return `${path} must be one of: ${schema.enum.join(', ')}`
  if (schema.const !== undefined && value !== schema.const) return `${path} must be ${schema.const}`
  if (typeof value === 'string' && (value.length < (schema.minLength || 0) || value.length > (schema.maxLength ?? Infinity))) return `${path} has an invalid length`
  if (typeof value === 'number' && (!Number.isFinite(value) || value < (schema.minimum ?? -Infinity) || value > (schema.maximum ?? Infinity))) return `${path} is out of range`
}

export function validateBrowserArguments(tool, args) {
  const error = validate(tool.inputSchema, args, 'arguments')
  if (error) return error
  if (tool.name.endsWith('_snapshot')) {
    for (const key of ['offset', 'limit']) if (args[key] !== undefined && !Number.isSafeInteger(args[key])) return `arguments.${key} must be an integer`
    if (args.snapshot_id && ['selector', 'query', 'interactive_only'].some(key => args[key] !== undefined)) {
      return 'arguments.snapshot_id cannot be combined with selector/query/interactive_only; omit it for a new search'
    }
  }
  if (tool.name.endsWith('_interact') || tool.name.endsWith('_batch')) {
    const actions = tool.name.endsWith('_batch') ? args.actions : [args]
    for (const [index, action] of actions.entries()) {
      const path = tool.name.endsWith('_batch') ? `arguments.actions[${index}]` : 'arguments'
      if (['click', 'type'].includes(action.action)) {
        if (typeof args.snapshot_id !== 'string' || !args.snapshot_id.trim()) return 'arguments.snapshot_id is required for click/type; use the latest snapshotId'
        if (typeof action.ref !== 'string' || !/^@e[1-9]\d*$/.test(action.ref) || action.ref.length > 32) return `${path}.ref must be a snapshot ref such as @e1`
      }
      if (action.action === 'type' && typeof action.text !== 'string') return `${path}.text is required for type`
      if (action.action === 'press' && (typeof action.key !== 'string' || !action.key.trim())) return `${path}.key is required for press`
      if (action.action === 'scroll' && !['up', 'down', 'left', 'right'].includes(action.direction)) return `${path}.direction is required for scroll`
    }
  }
}

```

### Core Architecture Module: `bin/browser/jev.mjs`
```
// Optional, read-only assessments. All provider access stays behind Studio's authenticated facade.
export function browserIntent(value, name) {
  if (value === undefined) return undefined
  if (typeof value !== 'string' || !value.trim() || value.length > 2000) throw new Error(`${name} must be 1-2000 characters`)
  return value.trim()
}

function evidence(snapshot, observation) {
  if (!snapshot?.snapshotId || !snapshot.tabId || !Array.isArray(snapshot.nodes)) throw new Error('Snapshot unavailable')
  const relevant = observation?.tabId === snapshot.tabId && observation.status === 'observed' ? observation : undefined
  const targets = (relevant?.targets || []).flatMap(target => target.after ? [{ ...target.after,
    actionTarget: true, valueMatches: target.valueMatches }] : [])
  const changes = (relevant?.changes || []).flatMap(change => change.after ? [change.after] : [])
  // Prioritize post-action targets outside the selected page, without mixing tabs or old refs.
  const byRef = new Map()
  for (const node of [...targets, ...changes, ...snapshot.nodes]) if (!byRef.has(node.ref)) byRef.set(node.ref, node)
  const nodes = [...byRef.values()].slice(0, 500)
  return {
    tabId: snapshot.tabId, snapshotId: snapshot.snapshotId, title: snapshot.title,
    nodes: nodes.map(({ ref, role, name, disabled, checked, selected, pressed, expanded, actionTarget, valueMatches }) =>
      ({ ref, role, name, disabled, checked, selected, pressed, expanded, actionTarget, valueMatches })),
  }
}

function transportSignal(signal, timeoutMs) {
  const timeout = AbortSignal.timeout(timeoutMs)
  return signal ? AbortSignal.any([signal, timeout]) : timeout
}

// Only fixed diagnostic codes cross the tool boundary; provider bodies and credentials never do.
function unavailable(error, stage) {
  const httpStatus = Number.isInteger(error?.status) ? error.status : undefined
  const reason = httpStatus === 401 ? 'auth_required' : httpStatus === 403 ? 'access_denied'
    : httpStatus === 429 ? 'rate_limited' : error?.name === 'TimeoutError' ? 'timeout'
    : error?.code === 'invalid_assessment' ? 'invalid_result'
    : error?.name === 'TypeError' ? 'transport_unavailable'
    : stage === 'snapshot' ? 'snapshot_unavailable' : 'assessment_unavailable'
  return { status: 'unavailable', reason, stage, ...(httpStatus ? { httpStatus } : {}) }
}

async function settingsFor(request, feature, signal) {
  signal?.throwIfAborted()
  const settings = await request('/api/studio/jev/settings', { signal: transportSignal(signal, 5000) })
  if ((feature === 'match' ? settings.browserMatchEnabled : settings.browserVerifyEnabled) !== true) return { skip: 'disabled' }
  if (settings.hasApiKey !== true) return { skip: 'not_configured' }
  const timeout = feature === 'match' ? settings.browserMatchTimeoutMs : settings.browserVerifyTimeoutMs
  return { timeout: Number.isInteger(timeout) ? Math.max(100, Math.min(30000, timeout)) : 3000 }
}

async function assess(request, path, snapshot, intent, timeout, signal, observation) {
  signal?.throwIfAborted()
  const result = await request(path, {
    method: 'POST', body: { snapshot: evidence(snapshot, observation), ...intent }, signal: transportSignal(signal, timeout + 1000),
  })
  signal?.throwIfAborted()
  if (result?.snapshotId !== snapshot.snapshotId || result?.tabId !== snapshot.tabId
    || result.status === 'matched' && !snapshot.nodes.some(node => node.ref === result.ref && !node.disabled)) {
    throw Object.assign(new Error('Invalid assessment identity or ref'), { code: 'invalid_assessment' })
  }
  return result
}

export async function matchBrowserSnapshot(request, envelope, target, signal) {
  if (target === undefined) return envelope
  let elementMatch
  let stage = 'settings'
  try {
    const config = await settingsFor(request, 'match', signal)
    stage = 'assessment'
    elementMatch = config.skip ? { status: 'skipped', reason: config.skip }
      : await assess(request, '/api/studio/jev/browser/match', envelope.result, { target }, config.timeout, signal)
  } catch (error) {
    signal?.throwIfAborted()
    elementMatch = unavailable(error, stage)
  }
  return { ...envelope, result: { ...envelope.result, elementMatch } }
}

export async function verifyBrowserResult(request, envelope, expectation, readSnapshot, signal) {
  if (expectation === undefined) return envelope
  let verification
  let snapshot = envelope.result?.snapshot
  let stage = 'settings'
  try {
    const config = await settingsFor(request, 'verify', signal)
    if (config.skip) verification = { status: 'skipped', reason: config.skip }
    // Do not assess partial batches or reacquire a tab after a failed batch/takeover.
    else if (envelope.result?.total !== undefined && envelope.result.completed !== envelope.result.total) {
      verification = { status: 'skipped', reason: 'incomplete_batch' }
    } else if (envelope.result?.snapshotError) verification = { status: 'unavailable', reason: 'snapshot_unavailable' }
    else {
      signal?.throwIfAborted()
      stage = 'snapshot'
      snapshot ??= (await readSnapshot()).result
      stage = 'assessment'
      verification = await assess(request, '/api/studio/jev/browser/verify', snapshot, { expectation }, config.timeout, signal, envelope.result?.observation)
    }
  } catch (error) {
    signal?.throwIfAborted()
    verification = unavailable(error, stage)
  }
  // Outcome judgment is advisory: never change the action's completion/error, or retry it.
  return { ...envelope, result: { ...envelope.result, ...(snapshot ? { snapshot } : {}), verification } }
}

```

### Core Architecture Module: `bin/browser/output.mjs`
```
function snapshotOutput(snapshot, includeText) {
  if (includeText || !Array.isArray(snapshot?.nodes) || !snapshot.snapshotId) return snapshot
  const { text, ...result } = snapshot
  return result
}

/** Nodes preserve refs, rendered labels and state; the parallel text rendering duplicates them. */
export function browserOutput(envelope, includeText = false) {
  const result = snapshotOutput(envelope.result, includeText)
  return { content: [{ type: 'text', text: JSON.stringify({ ...envelope,
    result: result?.snapshot ? { ...result, snapshot: snapshotOutput(result.snapshot, includeText) } : result,
  }) }] }
}

```

### Core Architecture Module: `bin/ekko-studio-mcp.mjs`
```
#!/usr/bin/env node
import { browserIntent, matchBrowserSnapshot, verifyBrowserResult } from './browser/jev.mjs'
import { validateBrowserArguments } from './browser/arguments.mjs'
import { browserOutput } from './browser/output.mjs'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { createInterface } from 'node:readline'
import { randomUUID } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const DEFAULT_PORT = process.env.HERMES_WEB_UI_PORT || process.env.PORT || '8648'
const DEFAULT_BASE_URL = `http://127.0.0.1:${DEFAULT_PORT}`
const DISPLAY_COMMAND = 'ekko-studio-mcp'
const SERVER_NAME = process.env.HERMES_MCP_SERVER_NAME || DISPLAY_COMMAND
const TOOLSETS = new Set(['api', 'browser', 'devices', 'use', 'plan'])
const ALLOWED_PUBLIC_REQUEST_HEADERS = new Set([
  'accept',
  'accept-language',
  'content-type',
  'x-request-id',
])

const __dirname = dirname(fileURLToPath(import.meta.url))

function readPackageVersion() {
  const candidates = [
    resolve(__dirname, '../package.json'),
    resolve(__dirname, '../../package.json'),
    resolve(process.cwd(), 'package.json'),
  ]
  for (const packagePath of candidates) {
    try {
      const pkg = JSON.parse(readFileSync(packagePath, 'utf8'))
      if (typeof pkg.version === 'string' && pkg.version.trim()) return pkg.version.trim()
    } catch {
      // Try the next candidate path.
    }
  }
  return '0.0.0'
}

const VERSION = readPackageVersion()

function printHelp() {
  process.stdout.write(`${DISPLAY_COMMAND} v${VERSION}

Ekko Studio MCP stdio server.

Usage:
  ${DISPLAY_COMMAND} [api|browser|devices|use|plan]
  ${DISPLAY_COMMAND} --help
  ${DISPLAY_COMMAND} --version

Environment:
  HERMES_WEB_UI_URL       Web UI base URL. Default: ${DEFAULT_BASE_URL}
  HERMES_WEB_UI_HOME      Web UI state directory. Default: ~/.hermes-web-ui
  HERMES_WEBUI_STATE_DIR  Fallback Web UI state directory.
  HERMES_WEB_UI_PROFILE   Default Hermes profile when a tool call omits profile.
  HERMES_WEB_UI_TOKEN     Optional explicit API token.
  AUTH_TOKEN              Optional explicit API token fallback.
  HERMES_MCP_TOOLSET      Tool category to expose: api, browser, devices, use, or plan. Default: api.

When run without options, this process waits for MCP JSON-RPC messages on stdin.
`)
}

const positionalArgs = process.argv.slice(2).filter(arg => !arg.startsWith('-'))
const requestedToolset = String(positionalArgs[0] || process.env.HERMES_MCP_TOOLSET || 'api').trim().toLowerCase()
const ACTIVE_TOOLSET = TOOLSETS.has(requestedToolset) ? requestedToolset : 'api'
const SHARED_TASK_PLAN_ENABLED = process.env.HERMES_MCP_NATIVE_TASK_PLAN !== '1'
const USER_CLARIFICATION_ENABLED = SHARED_TASK_PLAN_ENABLED && process.env.HERMES_MCP_USER_CLARIFICATION === '1'

if (process.argv.includes('-h') || process.argv.includes('--help')) {
  printHelp()
  process.exit(0)
}

if (process.argv.includes('-v') || process.argv.includes('--version')) {
  process.stdout.write(`${SERVER_NAME} v${VERSION}\n`)
  process.exit(0)
}

function appHome() {
  return process.env.HERMES_WEB_UI_HOME ||
    process.env.HERMES_WEBUI_STATE_DIR ||
    join(homedir(), '.hermes-web-ui')
}

function normalizeProfileSegment(profile) {
  const raw = String(profile || '').trim()
  if (!raw) return ''
  const sanitized = raw.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
  if (sanitized === '.' || sanitized === '..' || sanitized.length > 128) return ''
  return sanitized
}

function readProfileToken(profile) {
  const segment = normalizeProfileSegment(profile)
  if (!segment) return ''
  try {
    return readFileSync(join(appHome(), 'profiles', segment, '.model-run-token'), 'utf8').trim()
  } catch {
    return ''
  }
}

function readToken(tokenOverride, allowTokenFile = true, profile = '') {
  const explicit = tokenOverride || process.env.HERMES_WEB_UI_TOKEN || process.env.AUTH_TOKEN
  if (explicit) return explicit.trim()
  if (!allowTokenFile) return ''
  const profileToken = readProfileToken(profile)
  if (profileToken) return profileToken
  try {
    return readFileSync(join(appHome(), '.token'), 'utf8').trim()
  } catch {
    return ''
  }
}

function readRunCredential(profile) {
  const file = process.env.HERMES_WEB_UI_RUN_TOKEN_FILE
  if (!file) return null
  let credential
  try { credential = JSON.parse(readFileSync(file, 'utf8')) } catch {
    throw new Error('The current run credential is unavailable. Start a new Studio run.')
  }
  if (!credential || typeof credential.token !== 'string' || !credential.token.startsWith('studio_run_')
    || typeof credential.context_id !== 'string' || !credential.context_id
    || typeof credential.profile !== 'string' || credential.profile !== profile) {
    throw new Error('The MCP request does not match its configured run credential.')
  }
  return credential
}

function defaultProfile() {
  return String(
    process.env.HERMES_WEB_UI_PROFILE ||
    process.env.HERMES_PROFILE ||
    process.env.PROFILE ||
    '',
  ).trim()
}

function authHint() {
  return `Web UI token was not accepted. Pass the current Hermes profile argument so this MCP server can read its temporary token, pass an explicit token argument, or set HERMES_WEB_UI_TOKEN.`
}

function baseUrl() {
  return (process.env.HERMES_WEB_UI_URL || DEFAULT_BASE_URL).replace(/\/$/, '')
}

function jsonText(data) {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  }
}

function errorText(message) {
  return {
    isError: true,
    content: [{ type: 'text', text: message }],
  }
}

async function request(path, options = {}) {
  const envelope = await requestEnvelope(path, options)
  if (envelope.status < 200 || envelope.status >= 300) {
    const message = envelope.status === 401 ? `${envelope.body?.error || 'Unauthorized'}. ${authHint()}`
      : envelope.body?.error || envelope.bodyText || `HTTP ${envelope.status}`
    throw Object.assign(new Error(message), { status: envelope.status })
  }
  return envelope.body
}

function appendQuery(path, query) {
  if (!query || typeof query !== 'object' || Array.isArray(query)) return path
  const parsed = new URL(path, 'http://hermes-web-ui.local')
  for (const [key, value] of Object.entries(query)) {
    if (value == null) continue
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item != null) parsed.searchParams.append(key, String(item))
      }
      continue
    }
    parsed.searchParams.set(key, String(value))
  }
  return `${parsed.pathname}${parsed.search}`
}

function normalizePublicHeaders(headers) {
  const normalized = {}
  if (!headers || typeof headers !== 'object' || Array.isArray(headers)) return normalized
  for (const [name, value] of Object.entries(headers)) {
    const lower = name.toLowerCase()
    if (!ALLOWED_PUBLIC_REQUEST_HEADERS.has(lower) || value == null) continue
    normalized[lower] = Array.isArray(value) ? String(value.find(Boolean) || '') : String(value)
  }
  return normalized
}

// User interactions can wait five minutes before producing response headers.
// Avoid fetch's 300-second headers deadline racing that business deadline.
async function fetchMobileConsent(url, options) {
  return new Promise((resolve, reject) => {
    const target = new URL(url)
    const transport = target.protocol === 'https:' ? httpsRequest : httpRequest
    let timer
    const req = transport(target, { method: options.method, headers: options.headers, signal: options.signal }, res => {
      const chunks = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('error', error => { clearTimeout(timer); reject(error) })
      res.on('end', () => {
        clearTimeout(timer)
        const text = Buffer.concat(chunks).toString('utf8')
        const headers = new Headers()
        for (const [name, value] of Object.entries(res.headers)) {
        
```

### Core Architecture Module: `bin/hermes-studio-mcp.mjs`
```
#!/usr/bin/env node
// Compatibility entry point for existing MCP configurations.
import './ekko-studio-mcp.mjs'

```

### Core Architecture Module: `bin/hermes-web-ui-mcp.mjs`
```
#!/usr/bin/env node
// Compatibility entry point for existing MCP configurations.
import './ekko-studio-mcp.mjs'

```

### Core Architecture Module: `bin/hermes-web-ui.mjs`
```
#!/usr/bin/env node
import { spawn, execSync, execFileSync } from 'child_process'
import { resolve, dirname, join, delimiter } from 'path'
import { fileURLToPath } from 'url'
import { readFileSync, writeFileSync, unlinkSync, mkdirSync, openSync, chmodSync, statSync, existsSync, realpathSync } from 'fs'
import { randomBytes, scryptSync } from 'crypto'
import { homedir } from 'os'

const __dirname = dirname(fileURLToPath(import.meta.url))
const __filename = fileURLToPath(import.meta.url)
const serverEntry = resolve(__dirname, '..', 'dist', 'server', 'index.js')
const pkgDir = resolve(__dirname, '..')
const pkg = JSON.parse(readFileSync(resolve(pkgDir, 'package.json'), 'utf-8'))
const VERSION = pkg.version
const PACKAGE_NAME = pkg.name
const CLI_NAME = PACKAGE_NAME === 'ekko-studio' ? 'ekko-studio-web' : 'hermes-web-ui'
const WEB_UI_HOME = process.env.HERMES_WEB_UI_HOME?.trim()
  ? resolve(process.env.HERMES_WEB_UI_HOME.trim())
  : resolve(homedir(), '.hermes-web-ui')
const PID_DIR = WEB_UI_HOME
const PID_FILE = join(PID_DIR, 'server.pid')
const LOG_FILE = join(PID_DIR, 'server.log')
const TOKEN_FILE = join(PID_DIR, '.token')
const LOGIN_LOCK_FILE = join(WEB_UI_HOME, '.login-lock.json')
const WEB_UI_DB_FILE = join(WEB_UI_HOME, 'hermes-web-ui.db')
const DEFAULT_PORT = 8648
const PREVIEW_BACKEND_PORT = 8650
const PREVIEW_FRONTEND_PORT = 8651
const PREVIEW_AGENT_BRIDGE_PORT = 18650
const DEFAULT_USERNAME = 'admin'
const DEFAULT_PASSWORD = '123456'
const DEFAULT_RESTART_GRACE_MS = 5000
const DEFAULT_STOP_GRACE_MS = 15000
const STOP_POLL_INTERVAL_MS = 500

function envPositiveInt(name) {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value > 0 ? value : undefined
}

function shouldPreserveBridgeOnShutdown() {
  const raw = String(process.env.HERMES_AGENT_BRIDGE_STOP_ON_SHUTDOWN || '').trim().toLowerCase()
  return ['0', 'false', 'no', 'off'].includes(raw)
}

function getDaemonStopGraceMs(options = {}) {
  const { restart = false } = options
  if (restart && shouldPreserveBridgeOnShutdown()) {
    return envPositiveInt('HERMES_WEB_UI_RESTART_GRACE_MS') ?? DEFAULT_RESTART_GRACE_MS
  }
  if (restart) {
    return envPositiveInt('HERMES_WEB_UI_RESTART_GRACE_MS')
      ?? envPositiveInt('HERMES_WEB_UI_STOP_GRACE_MS')
      ?? DEFAULT_STOP_GRACE_MS
  }
  return envPositiveInt('HERMES_WEB_UI_STOP_GRACE_MS') ?? DEFAULT_STOP_GRACE_MS
}

// ─── Auto-fix node-pty native module ──────────────────────────
function ensureNativeModules() {
  const prebuildDir = join(pkgDir, 'node_modules', 'node-pty', 'prebuilds', `${process.platform}-${process.arch}`)
  const helper = join(prebuildDir, 'spawn-helper')
  try {
    chmodSync(helper, 0o755)
  } catch {}
}

function getToken() {
  try {
    return readFileSync(TOKEN_FILE, 'utf-8').trim()
  } catch {
    return null
  }
}

function ensureToken() {
  // If AUTH_TOKEN is set, let server handle it.
  if (process.env.AUTH_TOKEN) return process.env.AUTH_TOKEN

  let token = getToken()
  if (!token) {
    mkdirSync(dirname(TOKEN_FILE), { recursive: true })
    token = randomBytes(32).toString('hex')
    writeFileSync(TOKEN_FILE, token + '\n', { mode: 0o600 })
  }
  return token
}

function getNodeBinDir() {
  return dirname(process.execPath)
}

function getNpmBin() {
  return join(getNodeBinDir(), process.platform === 'win32' ? 'npm.cmd' : 'npm')
}

function getCurrentNodeEnv() {
  return {
    ...process.env,
    PATH: [getNodeBinDir(), process.env.PATH].filter(Boolean).join(delimiter),
    npm_node_execpath: process.execPath,
  }
}

function getGlobalCliScript() {
  // .cmd files cannot be executed directly by execFileSync on Windows.
  const npmCli = join(getNodeBinDir(), 'node_modules', 'npm', 'bin', 'npm-cli.js')
  const command = process.platform === 'win32' ? process.execPath : getNpmBin()
  const args = process.platform === 'win32' ? [npmCli, 'root', '-g'] : ['root', '-g']
  const root = execFileSync(command, args, {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env: getCurrentNodeEnv(),
  }).trim()
  // Resolve inside this package; a global command shim may belong to the other name.
  return join(root, PACKAGE_NAME, 'bin', 'hermes-web-ui.mjs')
}

function getWindowsShell() {
  const systemRoot = process.env.SystemRoot || 'C:\\Windows'
  const candidates = [
    process.env.ComSpec,
    join(systemRoot, 'System32', 'cmd.exe'),
  ].filter(Boolean)

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }

  return 'cmd.exe'
}

function quoteForWindowsCommand(value) {
  return `"${value.replace(/"/g, '""')}"`
}

function spawnCli(command, args, options) {
  if (process.platform === 'win32') {
    const lowerCommand = String(command).toLowerCase()
    if (!lowerCommand.endsWith('.cmd') && !lowerCommand.endsWith('.bat')) {
      return spawn(command, args, options)
    }

    const commandLine = `${quoteForWindowsCommand(command)} ${args.map(arg => String(arg)).join(' ')}`
    return spawn(getWindowsShell(), ['/d', '/s', '/c', commandLine], options)
  }

  return spawn(command, args, options)
}

function getPortFromArgs() {
  if (process.argv[3] && !isNaN(process.argv[3])) return parseInt(process.argv[3])
  if (process.argv.includes('--port')) return parseInt(process.argv[process.argv.indexOf('--port') + 1])
  return null
}

function getRunningPort() {
  const pid = getPid()
  if (!pid || !isRunning(pid)) return null

  try {
    if (process.platform === 'win32') {
      const out = execSync(`netstat -aon -p tcp | findstr LISTENING | findstr " ${pid}$"`, { encoding: 'utf-8' }).trim()
      const line = out.split('\n').find(Boolean)
      const address = line?.trim().split(/\s+/)[1]
      const port = address?.split(':').pop()
      return port ? parseInt(port, 10) : null
    }

    const out = execSync(`lsof -Pan -p ${pid} -iTCP -sTCP:LISTEN`, { encoding: 'utf-8' }).trim()
    const lines = out.split('\n').slice(1)
    for (const line of lines) {
      const match = line.match(/:(\d+)\s+\(LISTEN\)$/)
      if (match) return parseInt(match[1], 10)
    }
  } catch {}

  return null
}

function getUpdatePort() {
  const argPort = getPortFromArgs()
  if (argPort !== null) return argPort

  const runningPort = getRunningPort()
  if (runningPort !== null) return runningPort

  if (process.env.PORT && !isNaN(process.env.PORT)) return parseInt(process.env.PORT)
  return DEFAULT_PORT
}

function getPort() {
  const argPort = getPortFromArgs()
  return argPort ?? DEFAULT_PORT
}

function shouldOpenBrowser(argv = process.argv) {
  return !argv.includes('--no-open')
}

function getRestartArgs(port, argv = process.argv) {
  const args = ['restart', '--port', String(port)]
  if (!shouldOpenBrowser(argv)) args.push('--no-open')
  return args
}

function enableClientMode() {
  process.env.HERMES_WEB_UI_DISABLE_GATEWAY_AUTOSTART = '1'
  process.env.CORS_ORIGINS = '*'
}

function commandExists(command) {
  try {
    if (process.platform === 'win32') {
      execFileSync('where', [command], { stdio: 'ignore', windowsHide: true })
    } else {
      execFileSync('sh', ['-c', `command -v "$1" >/dev/null 2>&1`, 'sh', command], { stdio: 'ignore' })
    }
    return true
  } catch {
    return false
  }
}

function parseUnixNetstatListeningPids(out, port) {
  const pids = []
  for (const line of out.split(/\r?\n/)) {
    const parts = line.trim().split(/\s+/)
    if (parts.length < 6) continue

    const proto = parts[0]?.toLowerCase()
    if (!proto?.startsWith('tcp')) continue

    const localAddress = parts[3]
    const state = parts.find(part => part.toUpperCase() === 'LISTEN' || part.toUpperCase() === 'LISTENING')
    if (!state || !localAddress?.endsWith(`:${port}`)) continue

    const pidPart = parts.find(part => /^\d+\//.test(part))
    const pid = pidPart ? parseInt(pidPart.split('/')[0], 10) : NaN
    if (Number.isFinite(pid)) pids.push(pid)
  }
  return pids
}

function getListeningPids(port) {
  if (!port || isNaN(port)) return []
  const uniquePids = (pid
```

### Core Architecture Module: `packages/client/public/notification-sw.js`
```
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(clients.claim()))

function safeClickUrl(value) {
  return typeof value === 'string'
    && value.startsWith('/hermes/')
    && !value.includes('..')
    && !value.includes('\\')
    ? value
    : null
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil((async () => {
    const clickUrl = safeClickUrl(event.notification.data?.clickUrl)
    const target = clickUrl ? `/#${clickUrl}` : '/'
    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of windows) {
      if (clickUrl && 'navigate' in client) await client.navigate(target)
      if ('focus' in client) return client.focus()
    }
    if (clients.openWindow) return clients.openWindow(target)
  })())
})

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3219** (2026-09-28): **Hermes不可用了，回退版本也不行了**
  *Symptoms*: ### Ekko Studio Version  7.24-7.25  ### Agent Runtime and Version (if applicable)  _No response_  ### Bug Description  Error: Hermes Runtime is unavailable: Runtime "/Users/jarhead/.hermes-web-ui/desktop-runtime/hermes/0.20.6/mac-arm64" failed: Python executable is missing: /Users/jarhead/.hermes-web-ui/desktop-runtime/hermes/0.20.6/mac-arm64/python/bin/python3; Hermes executable is missing: /Users/jarhead/.hermes-web-ui/desktop-runtime/hermes/0.20.6/mac-arm64/python/bin/hermes; Node executable is missing: /Users/jarhead/.hermes-web-ui/desktop-runtime/hermes/0.20.6/mac-arm64/node/bin/node No usable installed Runtime was found.  ### Steps to Reproduce  1  ### Expected Behavior  1  ### Actual Behavior  1  ### Logs / Error Messages  ```shell  ```  ### Environment  macOS  ### Node Version  _No response_  ### Additional Context  _No response_

- **Issue #3172** (2026-09-25): **[Bug]: 安卓 app 端，执行任务卡死**
  *Symptoms*: ### Ekko Studio Version  v1.0.4  ### Agent Runtime and Version (if applicable)  Hermes Agent v0.20  ### Bug Description  在APP端提交任务后，任务长时运行会导致整个app卡死，怀疑是下方的思考内容持续滚动导致的，当然也不一定是光有思考内容，甚至工具调用，它全部会在输入框上面一行的位置一直在滚动。  ### Steps to Reproduce  打开APP端新建会话，提交任意复杂任务。等候数分钟，APP端彻底卡死。**怀疑** 是思考内容或工具调用的内容一直在输入框上方一栏一直滚动导致。  ### Expected Behavior  任务正常运行，app内所有功能均可操作，正常输出结果  ### Actual Behavior  app未输出结果，并且直接卡死，只能 kill 掉，重新进入  ### Logs / Error Messages  ```shell  ```  ### Environment  WSL  ### Node Version  _No response_  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > > 

- **Issue #2943** (2026-09-08): **[Bug]: 0.7.18 最新版的mac app 不能配置频道了！！**
  *Symptoms*: ### Hermes Web UI Version  0.7.18  ### Hermes Agent Version  0.7.18  ### Bug Description  如题  ### Steps to Reproduce  升级最新版  ### Expected Behavior  升级最新版  ### Actual Behavior  升级最新版  ### Logs / Error Messages  ```shell  ```  ### Environment  macOS  ### Node Version  _No response_  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > agent管理 设置

- **Issue #2878** (2026-09-08): **[Bug]: OpenAI Codex provider missing for named profiles using inherited root OAuth credentials**
  *Symptoms*: ### Hermes Web UI Version  v0.7.15  ### Hermes Agent Version  v0.21.0  ### Bug Description  OpenAI Codex is missing from the model provider list in Hermes Web UI when using a named Hermes profile that inherits its OAuth credentials from the root Hermes auth store.  This appears to be a compatibility issue with a recent Hermes Agent authentication change. Hermes Agent now intentionally keeps single-use OAuth grants such as OpenAI Codex in the root auth store and allows named profiles to borrow/inherit those credentials instead of copying them into each profile's auth.json.  The named profile works correctly through Hermes CLI:  - Its configured provider is `openai-codex`. - Its model is configured correctly. - `hermes -p <profile> auth list openai-codex` finds the inherited OAuth credentials. - A real model request using `openai-codex` succeeds.  However, Hermes Web UI does not show the OpenAI Codex provider for that profile. The default/root profile displays it correctly.  It appears that Hermes Web UI determines provider availability only from the named profile's local auth.json and does not account for the root OAuth credential fallback implemented by Hermes Agent.   ### Steps to Reproduce  1. Authenticate OpenAI Codex in the root/default Hermes profile:     hermes auth add openai-codex  2. Create or use a named Hermes profile.  3. Configure the named profile through:     hermes -p <profile> setup model  4. Select OpenAI Codex and a supported Codex model.  5. Confirm that t

- **Issue #2826** (2026-09-01): **[Bug]: 普通管理员账号突然无法新建会话了，提示无资源访问权限，这个变故发生在reload skill之后**
  *Symptoms*: ### Hermes Web UI Version  0.7.1  ### Hermes Agent Version  0.20.6  ### Bug Description  普通管理员账号突然无法新建会话了，提示无资源访问权限  ### Steps to Reproduce    这个变故发生在reload skill之后。 发生情况是先新建了一个skill 然后通过/skill 技能名的方式使用提示/ not a supported bridge command: /技能名 执行reload skill后，突然就发现正聊着的普通管理员账号无法创建新会话了。 /reload skill这个操作在超级管理员下也执行了一次。 执行前普通管理员账号还在新建会话测试该技能有没有生效，提示错误才执行的重载技能  ### Expected Behavior   上面已说明  ### Actual Behavior    上面已说明  ### Logs / Error Messages  ```shell  ```  ### Environment  Docker  ### Node Version  _No response_  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > 更新到0.7.13版本问题解决了。不知道是什么原因造成的。之前重启docker也无法解决

- **Issue #2813** (2026-09-02): **[Bug]: 更新最新版以后，mac端打开桌面端会疯狂打开Hermes studio**
  *Symptoms*: ### Hermes Web UI Version  0.7.13  ### Hermes Agent Version  0.7.13  ### Bug Description  更新最新版以后，mac端打开桌面端会疯狂打开Hermes studio  ### Steps to Reproduce  更新最新版以后，mac端打开桌面端会疯狂打开Hermes studio  ### Expected Behavior  更新最新版以后，mac端打开桌面端会疯狂打开Hermes studio  ### Actual Behavior  更新最新版以后，mac端打开桌面端会疯狂打开Hermes studio  ### Logs / Error Messages  ```shell  ```  ### Environment  macOS  ### Node Version  _No response_  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > i meet it 
  > Same here. That thing acts like a rogue program—it forces itself to stay on top, and the issue still hasn't been resolved.
  > +1

- **Issue #2784** (2026-09-08): **[Bug]: Profile “Restart Configuration” always fails with Agent bridge request timed out after 5000ms**
  *Symptoms*: ### Hermes Web UI Version  0.6.47  ### Hermes Agent Version  0.20.6  ### Bug Description  Title: Profile “Restart Configuration” always fails with Agent bridge request timed out after 5000ms  Environment: - hermes-web-ui: v0.6.47 - Hermes Agent: v0.20.6 - Linux / systemd - Two profiles: default and newbaby - HERMES_WEB_UI_MANAGED_GATEWAY=0  Observed: Clicking “Restart Configuration” for either profile returns:  API Error 500: Agent bridge request timed out after 5000ms  The gateway itself remains running.  Root cause found in bundled server code:  var dA=()=>new Vt({connectRetryMs:0,timeoutMs:5e3})  Restart Configuration calls:  await dA().destroyProfile(profile)  The Python bridge does support destroy_profile. It synchronously: 1. Enumerates workers for the profile. 2. Calls worker.request({"action": "destroy_all"}). 3. Stops every worker. 4. Destroys sessions, interrupts active agents, and waits on session locks.  This cannot reliably complete within 5 seconds.  Expected: - Make this timeout configurable, preferably through an environment variable. - Or use HERMES_AGENT_BRIDGE_TIMEOUT_MS. - Or make destroy_profile cleanup asynchronous and return immediately.  ### Steps to Reproduce  1. Enumerates workers for the profile. 2. Calls worker.request({"action": "destroy_all"}). 3. Stops every worker. 4. Destroys sessions, interrupts active agents, and waits on session locks.   ### Expected Behavior  Expected: - Make this timeout configurable, preferably through an environment var

- **Issue #2653** (2026-08-21): **test: eliminate Node 24 Vitest IPC channel failures**
  *Symptoms*: ## Problem  A clean Node 24 coverage classification run for the immutable integration candidate terminated non-zero before Vitest emitted its normal coverage summary:  ```text ERR_IPC_CHANNEL_CLOSED: Channel closed ```  Observed stack ownership was Vitest/tinypool IPC. The run used an exact-HEAD `git archive`, a fresh `npm ci --include=dev`, no bind mount, no `HERMES_*`, and no Hermes runtime fallback. The same integration candidate does not change `package.json`, `package-lock.json`, `vitest.config.ts`, or `.github/workflows/build.yml` relative to its base.  This failure does **not** prove a product-code defect, but it makes the canonical `npm run test:coverage` gate non-authoritative because the run exits before a complete summary.  Related upstream report: vitest-dev/vitest#8201.  ## Scope  - Reproduce and classify the Node 24 Vitest/tinypool IPC shutdown failure on latest `main`. - Determine whether the underlying cause is a Vitest/tinypool regression, a child-worker/native crash, an unfinished async task, resource pressure, or another repository-specific test-harness defect. - Apply the smallest root-cause fix in test infrastructure/dependency/configuration. - Preserve the canonical command: `npm run test:coverage`.  ## Acceptance  1. A deterministic RED reproduction or bounded stress harness demonstrates the pre-fix failure mode, including the responsible worker/test when identifiable. 2. The fix prevents `ERR_IPC_CHANNEL_CLOSED` without swallowing unhandled rejections,

### D4: Resource Lifecycle & Leak Defenses
- Memory allocation, socket lifecycle, and handle cleanup observed from bug fixes and PR deltas.

### D5: Boundary Deserialization & Encoding
- Schema deserialization, payload validation, and untrusted input guards.

### D6: Cross-Platform & Runtime Gotchas
- Platform variance, OS-specific gotchas, and environment discrepancies detected in issue reports.

### D7: Build, CI/CD, Deployment & Tooling
- Toolchain requirements, dependencies, and packaging specs verified against remote manifests.

### D8: Forensic Bug Fixes & Real Production Code Patches
Observed empirical fixes and code patches:

### Incident Patch 1: `c756486f` (2026-09-30)
**Commit Message**: [codex] fix desktop theme surfaces, controls, and loading feedback (#3236)

* fix custom background window gutters

* extend header glass around rounded content

* composite background surfaces before rounding corners

* apply background glass to management pages

* separate custom background glass surface levels

* make composer microphone follow theme colors

* move macOS window buttons up slightly

* keep logo loading feedback visible across motion preferences

* update style regression checks for layered glass surfaces



---

### Incident Patch 2: `a1304fa1` (2026-09-30)
**Commit Message**: [codex] fix desktop theme surfaces, controls, and loading feedback (#3236)

* fix custom background window gutters

* extend header glass around rounded content

* composite background surfaces before rounding corners

* apply background glass to management pages

* separate custom background glass surface levels

* make composer microphone follow theme colors

* move macOS window buttons up slightly

* keep logo loading feedback visible across motion preferences

* update style regression checks for layered glass surfaces

**File**: `packages/client/public/logo-loading.css` (modified, +15/-7)
```diff
@@ -13,13 +13,11 @@
   content: "";
   position: absolute;
   inset: 0;
-  background: linear-gradient(105deg, transparent 30%, rgba(255, 255, 255, 0.85) 48%, transparent 66%);
-  transform: translateX(-140%);
-  mix-blend-mode: screen;
+  /* Move the highlight inside a fixed mask without a blended compositor layer. */
+  background: linear-gradient(105deg, transparent 44%, rgba(255, 255, 255, 0.85) 50%, transparent 56%) 120% 0 / 300% 100% no-repeat;
   pointer-events: none;
   -webkit-mask: url("/logo.png") center / contain no-repeat;
   mask: url("/logo.png") center / contain no-repeat;
-  will-change: transform;
   animation: studio-logo-shimmer 1.8s cubic-bezier(0.45, 0, 0.25, 1) infinite;
 }
 
@@ -32,13 +30,23 @@
 }
 
 @keyframes studio-logo-shimmer {
-  0% { transform: translateX(-140%); }
-  52%, 100% { transform: translateX(140%); }
+  0% { background-position: 120% 0; }
+  52%, 100% { background-position: -20% 0; }
+}
+
+@keyframes studio-logo-breathe {
+  0%, 100% { opacity: 1; }
+  50% { opacity: 0.55; }
 }
 
 @media (prefers-reduced-motion: reduce) {
   .studio-loading-logo::after {
+    display: none;
     animation: none;
-    will-change: auto;
+  }
+
+  .studio-loading-logo img {
+    /* Keep loading feedback without sweeping or moving the logo. */
+    animation: studio-logo-breathe 2.4s ease-in-out infinite;
   }
 }
```

**File**: `packages/client/src/App.vue` (modified, +44/-18)
```diff
@@ -516,6 +516,8 @@ useKeyboard();
 .app-shell--navigation-rail {
   --studio-header-height: 40px;
   --studio-header-inset: #{$navigation-rail-width};
+  --studio-content-gutter: 5px;
+  --studio-content-radius: #{$radius-lg};
   --desktop-window-controls-width: 138px;
   flex-direction: row;
   background-color: $bg-sidebar;
@@ -643,8 +645,8 @@ useKeyboard();
   }
   .app-layout {
     width: auto;
-    margin: 0 5px 5px 0;
-    border-radius: $radius-lg;
+    margin: 0 var(--studio-content-gutter) var(--studio-content-gutter) 0;
+    border-radius: var(--studio-content-radius);
   }
   .app-layout.no-sidebar { display: flex; }
 
@@ -661,6 +663,27 @@ useKeyboard();
 }
 
 .app-shell--custom-background {
+  .studio-page-header {
+    box-shadow: inset 0 -1px 0 var(--glass-divider-color);
+  }
+
+  &.app-shell--navigation-rail {
+    .app-box::before {
+      inset: 0;
+      height: auto;
+    }
+
+    .app-layout {
+      // Align this image with the shell's full-window background. Its opaque base
+      // keeps the continuous frame glass from tinting the content a second time.
+      background: $bg-sidebar var(--app-background-image, none) center / cover no-repeat fixed;
+      // Composite the image and surfaces before rounding them together. Separate
+      // rounded clips leave antialiased pixels that expose the unfiltered image.
+      border-radius: 0;
+      clip-path: inset(0 round var(--studio-content-radius));
+    }
+  }
+
   .app-layout {
     background-color: transparent;
   }
@@ -669,7 +692,7 @@ useKeyboard();
     background-color: transparent;
 
     &--card {
-      background-color: rgba(var(--bg-main-surface-rgb), 0.72);
+      background-color: var(--glass-content-bg);
       -webkit-backdrop-filter: blur(8px) saturate(110%);
       backdrop-filter: blur(8px) saturate(110%);
     }
@@ -684,23 +707,34 @@ useKeyboard();
   }
 
   &.app-shell--navigation-rail .app-box::before,
-  :deep(.sidebar),
   :deep(.studio-navigation-rail),
+  :deep(.desktop-titlebar:not(.desktop-titlebar--flush)),
+  :deep(.chat-panel > .chat-main > .chat-header),
+  :deep(.group-chat-panel > .chat-main > .chat-header) {
+    background-color: var(--glass-chrome-bg);
+    -webkit-backdrop-filter: blur(16px) saturate(110%);
+    backdrop-filter: blur(16px) saturate(110%);
+  }
+
+  :deep(.sidebar),
   :deep(.hermes-config-sidebar),
   :deep(.ekko-config-sidebar),
   :deep(.coding-agent-config-sidebar),
   :deep(.chat-panel > .session-list),
   :deep(.history-panel > .page-loading-content > .session-list),
   :deep(.group-chat-panel > .room-sidebar),
   :deep(.workflow-view > .page-loading-content > .workflow-sidebar) {
-    background-color: rgba(var(--bg-sidebar-surface-rgb), 0.72);
-    -webkit-backdrop-filter: blur(8px) saturate(110%);
-    backdrop-filter: blur(8px) saturate(110%);
+    background-color: var(--glass-sidebar-bg);
+    -webkit-backdrop-filter: blur(12px) saturate(110%);
+    backdrop-filter: blur(12px) saturate(110%);
   }
 
   :deep(.history-panel > .page-loading-content > .chat-main),
-  :deep(.workflow-view > .page-loading-content > .workflow-main) {
-    background-color: rgba(var(--bg-main-surface-rgb), 0.72);
+  :deep(.workflow-view > .page-loading-content > .workflow-main),
+  :deep(.connections-panel),
+  :deep(.agent-manager-panel),
+  :deep(.models-view) {
+    background-color: var(--glass-content-bg);
     -webkit-backdrop-filter: blur(8px) saturate(110%);
     backdrop-filter: blur(8px) saturate(110%);
   }
@@ -712,16 +746,8 @@ useKeyboard();
     backdrop-filter: none;
   }
 
-  :deep(.desktop-titlebar:not(.desktop-titlebar--flush)),
-  :deep(.chat-panel > .chat-main > .chat-header),
-  :deep(.group-chat-panel > .chat-main > .chat-header) {
-    background-color: rgba(var(--bg-main-surface-rgb), 0.72);
-    -webkit-backdrop-filter: blur(8px) saturate(110%);
-    backdrop-filter: blur(8px) saturate(110%);
-  }
-
   :deep(.chat-input-area),
-  :deep(.agent-manager-panel) {
+  :deep(.connections-tabs >
```

**File**: `packages/client/src/components/hermes/chat/VoiceDialogueControls.vue` (modified, +4/-4)
```diff
@@ -143,7 +143,7 @@ function cancel() {
   appearance: none;
   border: 0;
   font: inherit;
-  color: var(--text-color-3, #999999);
+  color: var(--text-muted);
   background: transparent;
   cursor: pointer;
   transition: background-color 0.15s ease, color 0.15s ease, opacity 0.15s ease;
@@ -161,12 +161,12 @@ function cancel() {
 }
 
 .voice-dialogue-controls__toggle:hover {
-  color: var(--text-color-2, currentColor);
+  color: var(--text-secondary);
   background: rgba(128, 128, 128, 0.12);
 }
 
 .voice-dialogue-controls__toggle:focus-visible {
-  outline: 2px solid var(--primary-color, #18a058);
+  outline: 2px solid var(--accent-primary);
   outline-offset: 2px;
 }
 
@@ -204,7 +204,7 @@ function cancel() {
 }
 
 .voice-dialogue-controls__cancel:hover {
-  color: var(--text-color-2, currentColor);
+  color: var(--text-secondary);
   background: rgba(128, 128, 128, 0.12);
 }
 </style>
```

**File**: `packages/client/src/styles/variables.scss` (modified, +9/-0)
```diff
@@ -21,6 +21,12 @@
   --bg-main-surface: var(--bg-card);
   --bg-main-surface-rgb: var(--bg-card-rgb);
 
+  // Custom backgrounds: frame, contextual sidebar, then the foreground page.
+  --glass-chrome-bg: rgba(var(--bg-primary-rgb), 0.6);
+  --glass-sidebar-bg: rgba(var(--bg-sidebar-surface-rgb), 0.78);
+  --glass-content-bg: rgba(var(--bg-main-surface-rgb), 0.86);
+  --glass-divider-color: rgba(var(--text-primary-rgb), 0.1);
+
   // Borders
   --border-color: #e0e0e0;
   --border-light: #ebebeb;
@@ -92,6 +98,9 @@
   --bg-main-surface: var(--bg-primary);
   --bg-main-surface-rgb: var(--bg-primary-rgb);
 
+  --glass-chrome-bg: rgba(var(--bg-primary-rgb), 0.9);
+  --glass-content-bg: rgba(var(--bg-card-rgb), 0.82);
+
   // Borders
   --border-color: #3a3a3a;
   --border-light: #333333;
```

**File**: `tests/client/style-system.test.ts` (modified, +4/-3)
```diff
@@ -134,7 +134,8 @@ describe('client style system', () => {
     expect(variables).toContain('--bg-main-surface-rgb: var(--bg-card-rgb);')
     expect(variables).toContain('--bg-main-surface-rgb: var(--bg-primary-rgb);')
     expect(customBackgroundStyles).toContain('rgba(var(--bg-main-surface-rgb), 0.72)')
-    expect(customBackgroundStyles).toContain('rgba(var(--bg-sidebar-surface-rgb), 0.72)')
+    expect(customBackgroundStyles).toContain('background-color: var(--glass-sidebar-bg)')
+    expect(customBackgroundStyles).toContain('background-color: var(--glass-content-bg)')
     expect(customBackgroundStyles).toContain('backdrop-filter: blur(8px) saturate(110%)')
     expect(customBackgroundStyles).toContain(':deep(.chat-panel > .chat-main)')
     expect(customBackgroundStyles).toContain(':deep(.group-chat-panel > .chat-main)')
@@ -153,10 +154,10 @@ describe('client style system', () => {
       /:deep\(\.chat-panel > \.chat-main\),[\s\S]*background-color: transparent;[\s\S]*backdrop-filter: none;/,
     )
     expect(customBackgroundStyles).toMatch(
-      /:deep\(\.chat-panel > \.chat-main > \.chat-header\),[\s\S]*background-color: rgba\(var\(--bg-main-surface-rgb\), 0\.72\);[\s\S]*backdrop-filter: blur\(8px\) saturate\(110%\);/,
+      /:deep\(\.chat-panel > \.chat-main > \.chat-header\),[\s\S]*background-color: var\(--glass-chrome-bg\);[\s\S]*backdrop-filter: blur\(16px\) saturate\(110%\);/,
     )
     expect(customBackgroundStyles).toMatch(
-      /:deep\(\.desktop-titlebar:not\(\.desktop-titlebar--flush\)\),[\s\S]*:deep\(\.chat-panel > \.chat-main > \.chat-header\),[\s\S]*background-color: rgba\(var\(--bg-main-surface-rgb\), 0\.72\);[\s\S]*backdrop-filter: blur\(8px\) saturate\(110%\);/,
+      /:deep\(\.desktop-titlebar:not\(\.desktop-titlebar--flush\)\),[\s\S]*:deep\(\.chat-panel > \.chat-main > \.chat-header\),[\s\S]*background-color: var\(--glass-chrome-bg\);[\s\S]*backdrop-filter: blur\(16px\) saturate\(110%\);/,
     )
     expect(customBackgroundStyles).toMatch(
       /:deep\(\.chat-input-area \.input-wrapper\)\s*\{[\s\S]*background-color: rgba\(var\(--bg-main-surface-rgb\), 0\.72\);[\s\S]*backdrop-filter: blur\(8px\) saturate\(110%\);/,
```

---

### Incident Patch 3: `5053c134` (2026-09-29)
**Commit Message**: fix(cursor): use the product logo on Agent Manager cards (#3222)

The card chip is a near-white rounded square, so the previous mark disappears on it.

Co-authored-by: KK-Skyline <285700637+KK-Skyline@users.noreply.github.com>
Co-authored-by: Cursor <cursoragent@cursor.com>

**File**: `packages/client/src/stores/hermes/chat.ts` (modified, +1/-1)
```diff
@@ -3570,7 +3570,7 @@ export const useChatStore = defineStore('chat', () => {
       return { icon: '/coding-agents/opencode.png' }
     }
     if (codingAgentId === 'cursor') {
-      return { icon: '/coding-agents/cursor.svg' }
+      return { icon: '/coding-agents/cursor-logo.png' }
     }
     if (codingAgentId === 'ekko-agent') {
       return { icon: '/coding-agents/ekko-agent.png' }
```

**File**: `packages/client/src/utils/chat-agent-avatar.ts` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ const AGENT_AVATARS = {
   grok: { label: 'Grok', src: '/coding-agents/grok.svg' },
   opencode: { label: 'OpenCode', src: '/coding-agents/opencode.png' },
   dsh: { label: 'DeepSeek Harness', src: '/coding-agents/deepseek.svg' },
-  cursor: { label: 'Cursor', src: '/coding-agents/cursor.svg' },
+  cursor: { label: 'Cursor', src: '/coding-agents/cursor-logo.png' },
 } as const satisfies Record<string, ChatAgentAvatar>
 
 export function chatSessionAgentAvatar(session?: ChatAgentSessionIdentity | null): ChatAgentAvatar {
```

**File**: `packages/client/src/utils/group-agent-avatar.ts` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@ const DEFAULT_AGENT_ICONS: Record<RoomAgent['agent'], string> = {
     grok: '/coding-agents/grok.svg',
     opencode: '/coding-agents/opencode.png',
     dsh: '/coding-agents/deepseek.svg',
-    cursor: '/coding-agents/cursor.svg',
+    cursor: '/coding-agents/cursor-logo.png',
 }
 
 export function parseStoredAvatar(raw: unknown): ProfileAvatar | null {
```

**File**: `packages/client/src/views/hermes/AgentManagerView.vue` (modified, +1/-1)
```diff
@@ -90,7 +90,7 @@ const codingAgents: CodingAgentCard[] = [
     id: 'cursor',
     name: 'Cursor',
     provider: 'Cursor',
-    logo: '/coding-agents/cursor.svg',
+    logo: '/coding-agents/cursor-logo.png',
     command: 'agent',
     packageName: 'cursor-agent',
   },
```

**File**: `tests/client/chat-agent-avatar.test.ts` (modified, +1/-1)
```diff
@@ -25,7 +25,7 @@ describe('single chat Agent avatars', () => {
     ['DeepSeek Harness', { codingAgentId: 'dsh' }, '/coding-agents/deepseek.svg'],
     ['Pi', { codingAgentId: 'pi' }, '/coding-agents/pi.svg'],
     ['Grok', { codingAgentId: 'grok' }, '/coding-agents/grok.svg'],
-    ['Cursor', { codingAgentId: 'cursor' }, '/coding-agents/cursor.svg'],
+    ['Cursor', { codingAgentId: 'cursor' }, '/coding-agents/cursor-logo.png'],
     ['OpenCode', { codingAgentId: 'opencode' }, '/coding-agents/opencode.png'],
   ])('maps session identity to the $label avatar', (label, session, src) => {
     expect(chatSessionAgentAvatar(session)).toEqual({ label, src })
```

---

### Incident Patch 4: `2b20237c` (2026-09-28)
**Commit Message**: fix browser action feedback and compact stale snapshots (#3215)

**File**: `bin/browser/jev.mjs` (modified, +14/-5)
```diff
@@ -5,11 +5,20 @@ export function browserIntent(value, name) {
   return value.trim()
 }
 
-function evidence(snapshot) {
+function evidence(snapshot, observation) {
   if (!snapshot?.snapshotId || !snapshot.tabId || !Array.isArray(snapshot.nodes)) throw new Error('Snapshot unavailable')
+  const relevant = observation?.tabId === snapshot.tabId && observation.status === 'observed' ? observation : undefined
+  const targets = (relevant?.targets || []).flatMap(target => target.after ? [{ ...target.after,
+    actionTarget: true, valueMatches: target.valueMatches }] : [])
+  const changes = (relevant?.changes || []).flatMap(change => change.after ? [change.after] : [])
+  // Prioritize post-action targets outside the selected page, without mixing tabs or old refs.
+  const byRef = new Map()
+  for (const node of [...targets, ...changes, ...snapshot.nodes]) if (!byRef.has(node.ref)) byRef.set(node.ref, node)
+  const nodes = [...byRef.values()].slice(0, 500)
   return {
     tabId: snapshot.tabId, snapshotId: snapshot.snapshotId, title: snapshot.title,
-    nodes: snapshot.nodes.map(({ ref, role, name, disabled }) => ({ ref, role, name, disabled })),
+    nodes: nodes.map(({ ref, role, name, disabled, checked, selected, pressed, expanded, actionTarget, valueMatches }) =>
+      ({ ref, role, name, disabled, checked, selected, pressed, expanded, actionTarget, valueMatches })),
   }
 }
 
@@ -38,10 +47,10 @@ async function settingsFor(request, feature, signal) {
   return { timeout: Number.isInteger(timeout) ? Math.max(100, Math.min(30000, timeout)) : 3000 }
 }
 
-async function assess(request, path, snapshot, intent, timeout, signal) {
+async function assess(request, path, snapshot, intent, timeout, signal, observation) {
   signal?.throwIfAborted()
   const result = await request(path, {
-    method: 'POST', body: { snapshot: evidence(snapshot), ...intent }, signal: transportSignal(signal, timeout + 1000),
+    method: 'POST', body: { snapshot: evidence(snapshot, observation), ...intent }, signal: transportSignal(signal, timeout + 1000),
   })
   signal?.throwIfAborted()
   if (result?.snapshotId !== snapshot.snapshotId || result?.tabId !== snapshot.tabId
@@ -84,7 +93,7 @@ export async function verifyBrowserResult(request, envelope, expectation, readSn
       stage = 'snapshot'
       snapshot ??= (await readSnapshot()).result
       stage = 'assessment'
-      verification = await assess(request, '/api/studio/jev/browser/verify', snapshot, { expectation }, config.timeout, signal)
+      verification = await assess(request, '/api/studio/jev/browser/verify', snapshot, { expectation }, config.timeout, signal, envelope.result?.observation)
     }
   } catch (error) {
     signal?.throwIfAborted()
```

**File**: `bin/ekko-studio-mcp.mjs` (modified, +2/-2)
```diff
@@ -966,7 +966,7 @@ const tools = [
   {
     name: 'ekko_studio_browser_interact',
     toolset: 'browser',
-    description: 'Click, type, press a key, or scroll in one Desktop browser tab. Click/type require a ref and snapshot_id from the latest snapshot. Supply expectation for optional JEV judgment of visible evidence after execution; verification is advisory and never retries the action.',
+    description: 'Click, type, press a key, or scroll in one Desktop browser tab. Click/type require a ref and snapshot_id from the latest snapshot. Returns a fresh snapshot and local observation of target states, changes and openedTabs even without JEV. Use the returned snapshot.tabId (it may be a newly opened destination). Dispatch alone does not prove success; if no change is observed, inspect a relevant region or screenshot instead of blindly repeating. Supply expectation for optional JEV judgment; verification is advisory and never retries the action.',
     inputSchema: browserInputSchema({
       tab_id: { type: 'string' },
       expectation: { type: 'string', minLength: 1, maxLength: 2000, description: 'Expected visible outcome to judge after the action, when enabled in Models > JEV.' },
@@ -979,7 +979,7 @@ const tools = [
   {
     name: 'ekko_studio_browser_batch',
     toolset: 'browser',
-    description: 'Execute 1-50 click/type/press/scroll actions sequentially in one tab in a single call. For click/type, pass one current snapshot_id and refs from that snapshot; original DOM targets are revalidated before each step. Stops on the first failure, navigation, user takeover, or the 30-second execution budget. Returns zero-based per-step completed/failed/skipped results and a fresh snapshot when available. Completed actions are not rolled back. Supply expectation for optional JEV verification of the final snapshot after a fully completed batch; verification does not change completion status or retry actions.',
+    description: 'Execute 1-50 click/type/press/scroll actions sequentially in one tab in a single call. For click/type, pass one current snapshot_id and refs from that snapshot; original DOM targets are revalidated before each step. Stops on the first failure, new-document navigation/reload, user takeover, or the 30-second execution budget. Same-document URL/SKU changes can continue when targets remain valid. Returns zero-based per-step completed/failed/skipped results, local observation and a fresh snapshot when available, even without JEV. Completed means dispatched, not a confirmed outcome; completed actions are not rolled back. Inspect target states and use snapshot.tabId if a new tab opened. Supply expectation for optional JEV verification after a fully completed batch; verification does not change completion status or retry actions.',
     inputSchema: browserInputSchema({
       tab_id: { type: 'string' },
       snapshot_id: { type: 'string', description: 'Current snapshot used by all click/type refs; optional for a batch containing only press/scroll.' },
```

**File**: `docs/browser-snapshots.md` (modified, +38/-2)
```diff
@@ -23,6 +23,8 @@ The result reports `totalNodes`, `matchedNodes`, `offset`, `limit`, `hasMore`,
 tree. Refs and snapshot identity stay stable across cached pages; interaction or
 navigation invalidates the snapshot, so subsequent work needs a fresh one.
 Repeating an unfiltered snapshot or scrolling does not advance its offset.
+Offsets count filtered results, not ref numbers or positions in the full tree.
+An out-of-range page explains this and suggests restarting at offset zero.
 
 For a form at the end of a large documentation page:
 
@@ -44,13 +46,47 @@ For the next page of a snapshot whose result has `nextOffset: 100`:
 
 Use returned refs with that snapshot ID for click/type or a sequential batch.
 Batch steps keep the original DOM identity, including targets beyond the first
-page. The final batch snapshot preserves the initial selection and page options.
-`checked`, `selected` and `expanded` state is included when provided by the
+page. Same-document SKU/query/hash changes can continue; a new document or reload
+stops remaining actions. The final snapshot preserves the initial selection and
+page options when that region still exists, and falls back to the new document
+after navigation or removal of the region.
+`checked`, `selected`, `pressed` and `expanded` state is included when provided by the
 accessibility tree, so ordinary agents can inspect control state without JEV.
 
+Single actions and batches return `observation` with bounded before/after target
+states and changes, including `valueMatches` when the final input can be compared
+locally without redacted/protected values. Only completed batch targets are
+observed. Input values preserve spaces and line breaks for exact comparison;
+redacted, protected or truncated values do not produce `valueMatches`.
+A short read-only settling window catches asynchronous updates; it
+never replays an action. Background timer throttling is temporarily disabled
+during execution and observation, then restored. Pages slower than the observation
+window may still need a fresh snapshot.
+
+`completed` means dispatched, not semantic success. No observed change means the
+agent should inspect the relevant region or screenshot and choose a new strategy.
+It does not prove failure. When an action opens a new tab, `openedTabs` identifies
+the destination and the returned `snapshot.tabId` can differ from the original tab.
+The observation remains bound to its originating `tabId`.
+
 `target` remains a separate optional JEV recommendation within the returned page.
 Use the local filters to expose missing controls before requesting semantic advice.
 `include_text` defaults to false to avoid duplicating node labels.
+Optional JEV verification also receives control states, operated targets and
+locally computed value matches. It still receives no raw input values, URLs or
+descriptions, and its independent switch and credential requirements remain in
+effect. A low-confidence judgment never retries an action.
+
+Ekko model requests summarize superseded browser snapshots into bounded facts,
+retaining all pages of the newest snapshot per tab and action/error metadata.
+Studio applies the same projection before context budgeting; current structured
+snapshots bypass generic character truncation so refs remain usable. Original
+tool events and stored session history stay complete. This projection does not
+control history owned by external coding agents. Browser JSON remains compact
+through the tool-result sanitizer.
+
+Requests naming the built-in/Studio browser prefer `ekko_studio_browser_toolset`.
+The separate Agent browser has its own environment and login state.
 
 The tree is the current document's accessibility tree. CSS scope does not switch
 into a separate iframe, and cached pages do not refresh after asynchronous DOM
```

**File**: `packages/desktop/src/main/browser/browser-automation.ts` (modified, +23/-4)
```diff
@@ -13,6 +13,7 @@ import type {
 import { MAX_BROWSER_TEXT_READ_LIMIT } from './browser-types'
 import { filterSnapshotNodes, snapshotOptions, DEFAULT_SNAPSHOT_LIMIT } from './browser-snapshot'
 import { publicBrowserUrl, redactBrowserContent, redactBrowserText } from './browser-url'
+import type { BrowserObservedState, BrowserObservedTarget } from './browser-observation'
 
 interface AxNode {
   nodeId?: string
@@ -29,6 +30,7 @@ interface StoredSnapshot {
   id: string
   refs: Map<string, { backendDOMNodeId: number; role: string; name: string }>
   nodes: BrowserSnapshotNode[]
+  allNodes: BrowserSnapshotNode[]
   totalNodes: number
   url: string
   title: string
@@ -115,6 +117,18 @@ export class BrowserAutomation {
     return { ...this.snapshots.get(tabId)?.options, snapshotId: undefined }
   }
 
+  observedState(tabId: string): BrowserObservedState | undefined {
+    const current = this.snapshots.get(tabId)
+    if (!current) return undefined
+    return { url: current.url, nodes: new Map(current.allNodes.map(node => [current.refs.get(node.ref)!.backendDOMNodeId, node])) }
+  }
+
+  observedTargets(tabId: string, snapshotId: unknown, actions: BrowserBatchAction[]): BrowserObservedTarget[] {
+    return actions.flatMap((action, actionIndex) => action.action === 'click' || action.action === 'type'
+      ? [{ nodeId: this.resolveRef(tabId, String(snapshotId), action.ref).backendDOMNodeId, actionIndex,
+        ...(action.action === 'type' ? { text: action.text } : {}) }] : [])
+  }
+
   async snapshot(tabId: string, contents: WebContents, input: BrowserSnapshotOptions = {}): Promise<BrowserSnapshot> {
     const options = snapshotOptions(input)
     if (options.snapshotId) {
@@ -149,27 +163,31 @@ export class BrowserAutomation {
       const role = textValue(node.role?.value, 80)
       const name = textValue(node.name?.value)
       const protectedValue = property(node, 'protected') === true
-      const value = protectedValue ? '' : textValue(node.value?.value)
+      // Input whitespace is significant for local value comparisons.
+      const value = protectedValue ? '' : redactBrowserContent(node.value?.value, 500)
       if (!role || role === 'none' || role === 'generic' && !name && !value) continue
       const ref = `@e${nodes.length + 1}`
       refs.set(ref, { backendDOMNodeId: node.backendDOMNodeId, role, name })
       if (!scope || scope.has(node.backendDOMNodeId)) inScope.add(ref)
       const checked = property(node, 'checked')
       const selected = property(node, 'selected')
       const expanded = property(node, 'expanded')
+      const pressed = property(node, 'pressed')
       nodes.push({
         ref, role, name,
-        ...(value ? { value } : {}),
+        ...(!protectedValue && node.value?.value !== undefined ? { value } : {}),
         ...(node.description?.value ? { description: textValue(node.description.value) } : {}),
         ...(property(node, 'disabled') === true ? { disabled: true } : {}),
         ...(property(node, 'focused') === true ? { focused: true } : {}),
         ...(checked === 'mixed' ? { checked } : checked === true || checked === 'true' ? { checked: true }
           : checked === false || checked === 'false' ? { checked: false } : {}),
         ...(typeof selected === 'boolean' ? { selected } : {}),
         ...(typeof expanded === 'boolean' ? { expanded } : {}),
+        ...(pressed === 'mixed' ? { pressed } : pressed === true || pressed === 'true' ? { pressed: true }
+          : pressed === false || pressed === 'false' ? { pressed: false } : {}),
       })
     }
-    const current: StoredSnapshot = { id: randomUUID(), refs, totalNodes: nodes.length,
+    const current: StoredSnapshot = { id: randomUUID(), refs, allNodes: nodes, totalNodes: nodes.length,
       nodes: filterSnapshotNodes(nodes.filter(node => inScope.has(node.ref)), options), options,
       url: publicBrowserUrl(contents.getURL()), title: redactBrowserText(contents.getTitle()) }
     this.snapshots.set(t
```

**File**: `packages/desktop/src/main/browser/browser-broker.ts` (modified, +1/-1)
```diff
@@ -262,7 +262,7 @@ export class BrowserBroker {
         }
         case 'interact': {
           const tab = await this.manager.interact(requiredString(params.tab_id, 'tab_id'), asObject(params.action) as unknown as BrowserInteractAction)
-          return this.publicTab(tab)
+          return { ...this.publicTab(tab), snapshot: tab.snapshot, snapshotError: tab.snapshotError, observation: tab.observation }
         }
         case 'interact.batch':
           return await this.manager.interactBatch(requiredString(params.tab_id, 'tab_id'), params.actions, params.snapshot_id, () => {
```

---

### Incident Patch 5: `d2ec3d12` (2026-09-28)
**Commit Message**: fix: support large browser pages and remove action confirmation gates (#3212)

* fix: restore browser JEV auth and reduce automation overhead

* fix: remove browser action gates and support local snapshot paging

**File**: `bin/browser/arguments.mjs` (added, +55/-0)
```diff
@@ -0,0 +1,55 @@
+// Validate against the published browser schema before acquiring a tab or dispatching any action.
+function validate(schema, value, path) {
+  if (schema.oneOf) {
+    const variant = schema.oneOf.find(item => item.properties?.action?.const === value?.action)
+    return variant ? validate(variant, value, path) : `${path}.action must be click, type, press or scroll (use "action", not "type")`
+  }
+  if (schema.type === 'object') {
+    if (!value || typeof value !== 'object' || Array.isArray(value)) return `${path} must be an object`
+    for (const key of schema.required || []) if (value[key] === undefined) return `${path}.${key} is required`
+    for (const [key, item] of Object.entries(value)) {
+      if (!schema.properties?.[key]) {
+        if (schema.additionalProperties === false) return `${path}.${key} is not supported`
+      } else {
+        const error = validate(schema.properties[key], item, `${path}.${key}`)
+        if (error) return error
+      }
+    }
+  } else if (schema.type === 'array') {
+    if (!Array.isArray(value) || value.length < (schema.minItems || 0) || value.length > (schema.maxItems ?? Infinity)) {
+      return `${path} must contain ${schema.minItems || 0}-${schema.maxItems ?? 'unlimited'} items`
+    }
+    for (let i = 0; i < value.length; i++) {
+      const error = validate(schema.items, value[i], `${path}[${i}]`)
+      if (error) return error
+    }
+  } else if (schema.type && typeof value !== schema.type) return `${path} must be ${schema.type}`
+  if (schema.enum && !schema.enum.includes(value)) return `${path} must be one of: ${schema.enum.join(', ')}`
+  if (schema.const !== undefined && value !== schema.const) return `${path} must be ${schema.const}`
+  if (typeof value === 'string' && (value.length < (schema.minLength || 0) || value.length > (schema.maxLength ?? Infinity))) return `${path} has an invalid length`
+  if (typeof value === 'number' && (!Number.isFinite(value) || value < (schema.minimum ?? -Infinity) || value > (schema.maximum ?? Infinity))) return `${path} is out of range`
+}
+
+export function validateBrowserArguments(tool, args) {
+  const error = validate(tool.inputSchema, args, 'arguments')
+  if (error) return error
+  if (tool.name.endsWith('_snapshot')) {
+    for (const key of ['offset', 'limit']) if (args[key] !== undefined && !Number.isSafeInteger(args[key])) return `arguments.${key} must be an integer`
+    if (args.snapshot_id && ['selector', 'query', 'interactive_only'].some(key => args[key] !== undefined)) {
+      return 'arguments.snapshot_id cannot be combined with selector/query/interactive_only; omit it for a new search'
+    }
+  }
+  if (tool.name.endsWith('_interact') || tool.name.endsWith('_batch')) {
+    const actions = tool.name.endsWith('_batch') ? args.actions : [args]
+    for (const [index, action] of actions.entries()) {
+      const path = tool.name.endsWith('_batch') ? `arguments.actions[${index}]` : 'arguments'
+      if (['click', 'type'].includes(action.action)) {
+        if (typeof args.snapshot_id !== 'string' || !args.snapshot_id.trim()) return 'arguments.snapshot_id is required for click/type; use the latest snapshotId'
+        if (typeof action.ref !== 'string' || !/^@e[1-9]\d*$/.test(action.ref) || action.ref.length > 32) return `${path}.ref must be a snapshot ref such as @e1`
+      }
+      if (action.action === 'type' && typeof action.text !== 'string') return `${path}.text is required for type`
+      if (action.action === 'press' && (typeof action.key !== 'string' || !action.key.trim())) return `${path}.key is required for press`
+      if (action.action === 'scroll' && !['up', 'down', 'left', 'right'].includes(action.direction)) return `${path}.direction is required for scroll`
+    }
+  }
+}
```

**File**: `bin/browser/jev.mjs` (modified, +24/-6)
```diff
@@ -18,6 +18,17 @@ function transportSignal(signal, timeoutMs) {
   return signal ? AbortSignal.any([signal, timeout]) : timeout
 }
 
+// Only fixed diagnostic codes cross the tool boundary; provider bodies and credentials never do.
+function unavailable(error, stage) {
+  const httpStatus = Number.isInteger(error?.status) ? error.status : undefined
+  const reason = httpStatus === 401 ? 'auth_required' : httpStatus === 403 ? 'access_denied'
+    : httpStatus === 429 ? 'rate_limited' : error?.name === 'TimeoutError' ? 'timeout'
+    : error?.code === 'invalid_assessment' ? 'invalid_result'
+    : error?.name === 'TypeError' ? 'transport_unavailable'
+    : stage === 'snapshot' ? 'snapshot_unavailable' : 'assessment_unavailable'
+  return { status: 'unavailable', reason, stage, ...(httpStatus ? { httpStatus } : {}) }
+}
+
 async function settingsFor(request, feature, signal) {
   signal?.throwIfAborted()
   const settings = await request('/api/studio/jev/settings', { signal: transportSignal(signal, 5000) })
@@ -33,21 +44,25 @@ async function assess(request, path, snapshot, intent, timeout, signal) {
     method: 'POST', body: { snapshot: evidence(snapshot), ...intent }, signal: transportSignal(signal, timeout + 1000),
   })
   signal?.throwIfAborted()
-  if (result?.snapshotId !== snapshot.snapshotId || result?.tabId !== snapshot.tabId) throw new Error('Assessment snapshot mismatch')
-  if (result.status === 'matched' && !snapshot.nodes.some(node => node.ref === result.ref && !node.disabled)) throw new Error('Unknown assessment ref')
+  if (result?.snapshotId !== snapshot.snapshotId || result?.tabId !== snapshot.tabId
+    || result.status === 'matched' && !snapshot.nodes.some(node => node.ref === result.ref && !node.disabled)) {
+    throw Object.assign(new Error('Invalid assessment identity or ref'), { code: 'invalid_assessment' })
+  }
   return result
 }
 
 export async function matchBrowserSnapshot(request, envelope, target, signal) {
   if (target === undefined) return envelope
   let elementMatch
+  let stage = 'settings'
   try {
     const config = await settingsFor(request, 'match', signal)
+    stage = 'assessment'
     elementMatch = config.skip ? { status: 'skipped', reason: config.skip }
       : await assess(request, '/api/studio/jev/browser/match', envelope.result, { target }, config.timeout, signal)
-  } catch {
+  } catch (error) {
     signal?.throwIfAborted()
-    elementMatch = { status: 'unavailable', reason: 'assessment_unavailable' }
+    elementMatch = unavailable(error, stage)
   }
   return { ...envelope, result: { ...envelope.result, elementMatch } }
 }
@@ -56,6 +71,7 @@ export async function verifyBrowserResult(request, envelope, expectation, readSn
   if (expectation === undefined) return envelope
   let verification
   let snapshot = envelope.result?.snapshot
+  let stage = 'settings'
   try {
     const config = await settingsFor(request, 'verify', signal)
     if (config.skip) verification = { status: 'skipped', reason: config.skip }
@@ -65,12 +81,14 @@ export async function verifyBrowserResult(request, envelope, expectation, readSn
     } else if (envelope.result?.snapshotError) verification = { status: 'unavailable', reason: 'snapshot_unavailable' }
     else {
       signal?.throwIfAborted()
+      stage = 'snapshot'
       snapshot ??= (await readSnapshot()).result
+      stage = 'assessment'
       verification = await assess(request, '/api/studio/jev/browser/verify', snapshot, { expectation }, config.timeout, signal)
     }
-  } catch {
+  } catch (error) {
     signal?.throwIfAborted()
-    verification = { status: 'unavailable', reason: 'assessment_unavailable' }
+    verification = unavailable(error, stage)
   }
   // Outcome judgment is advisory: never change the action's completion/error, or retry it.
   return { ...envelope, result: { ...envelope.result, ...(snapshot ? { snapshot } : {}), verification } }
```

**File**: `bin/browser/output.mjs` (added, +13/-0)
```diff
@@ -0,0 +1,13 @@
+function snapshotOutput(snapshot, includeText) {
+  if (includeText || !Array.isArray(snapshot?.nodes) || !snapshot.snapshotId) return snapshot
+  const { text, ...result } = snapshot
+  return result
+}
+
+/** Nodes preserve refs, rendered labels and state; the parallel text rendering duplicates them. */
+export function browserOutput(envelope, includeText = false) {
+  const result = snapshotOutput(envelope.result, includeText)
+  return { content: [{ type: 'text', text: JSON.stringify({ ...envelope,
+    result: result?.snapshot ? { ...result, snapshot: snapshotOutput(result.snapshot, includeText) } : result,
+  }) }] }
+}
```

**File**: `bin/ekko-studio-mcp.mjs` (modified, +34/-12)
```diff
@@ -1,5 +1,7 @@
 #!/usr/bin/env node
 import { browserIntent, matchBrowserSnapshot, verifyBrowserResult } from './browser/jev.mjs'
+import { validateBrowserArguments } from './browser/arguments.mjs'
+import { browserOutput } from './browser/output.mjs'
 import { request as httpRequest } from 'node:http'
 import { request as httpsRequest } from 'node:https'
 import { createInterface } from 'node:readline'
@@ -166,10 +168,9 @@ function errorText(message) {
 async function request(path, options = {}) {
   const envelope = await requestEnvelope(path, options)
   if (envelope.status < 200 || envelope.status >= 300) {
-    if (envelope.status === 401) {
-      throw new Error(`${envelope.body?.error || 'Unauthorized'}. ${authHint()}`)
-    }
-    throw new Error(envelope.body?.error || envelope.bodyText || `HTTP ${envelope.status}`)
+    const message = envelope.status === 401 ? `${envelope.body?.error || 'Unauthorized'}. ${authHint()}`
+      : envelope.body?.error || envelope.bodyText || `HTTP ${envelope.status}`
+    throw Object.assign(new Error(message), { status: envelope.status })
   }
   return envelope.body
 }
@@ -936,8 +937,18 @@ const tools = [
   {
     name: 'ekko_studio_browser_snapshot',
     toolset: 'browser',
-    description: 'Return a bounded accessibility snapshot with stable element refs. Pass its snapshot_id to read text, click, or type; stale snapshots are rejected. Supply target to request optional JEV element matching when enabled in Models > JEV; inspect elementMatch alongside the unchanged snapshot. A match is advisory and still requires snapshot_id/ref for interaction.',
-    inputSchema: browserInputSchema({ tab_id: { type: 'string' }, target: { type: 'string', minLength: 1, maxLength: 2000, description: 'Describe the unique element to find in the snapshot.' } }, ['tab_id']),
+    description: 'Read an accessibility snapshot in bounded pages. Large pages: use selector for a CSS region (e.g. #form-demo-layout), query for local label/text search, or interactive_only for controls. These search the full document before paging and require no JEV. When hasMore is true, continue with snapshot_id and offset=nextOffset instead of repeating or scrolling the same tree. Refs stay stable across pages of that snapshot; use snapshot_id/ref for click/type. Optional target adds JEV advice only when configured.',
+    inputSchema: browserInputSchema({
+      tab_id: { type: 'string' },
+      selector: { type: 'string', minLength: 1, maxLength: 2000, description: 'CSS selector for one region in the main document. A URL #anchor often identifies the intended demo/form. Omit to inspect the whole document.' },
+      query: { type: 'string', minLength: 1, maxLength: 2000, description: 'Local case-insensitive substring search of rendered names, roles and descriptions across the full selected region. Works without JEV.' },
+      interactive_only: { type: 'boolean', description: 'Return controls and links, excluding static text and layout containers. Works without JEV.' },
+      snapshot_id: { type: 'string', minLength: 1, maxLength: 2000, description: 'Continue the latest cached snapshot without re-reading the page. Do not combine with selector/query/interactive_only; omit for a fresh snapshot.' },
+      offset: { type: 'number', minimum: 0, description: 'Zero-based node offset, normally the previous nextOffset. Defaults to 0.' },
+      limit: { type: 'number', minimum: 1, maximum: 300, description: 'Nodes per response, default 100. Use pagination rather than increasing the limit for large documents.' },
+      include_text: { type: 'boolean', description: 'Include the duplicate text rendering alongside nodes. Defaults to false.' },
+      target: { type: 'string', minLength: 1, maxLength: 2000, description: 'Optional JEV semantic advice within the returned page; use local selector/query/interactive_only to locate missing controls first.' },
+    }, ['tab_id']),
   },
   {
     name: 'ekko_studio_browser_read_text',
@@ -95
```

**File**: `docs/browser-snapshots.md` (added, +70/-0)
```diff
@@ -0,0 +1,70 @@
+# Built-in browser snapshots
+
+Large-page navigation is a local Desktop browser capability. It works without a
+JEV key, with JEV disabled, and when the provider is unavailable. No model service
+is needed to find text, scope a region, page the accessibility tree or operate refs.
+
+Discover `ekko_studio_browser_toolset` with `action=list`, then describe the needed
+operation. `ekko_studio_browser_snapshot` supports:
+
+- `selector`: a CSS selector for one region in the main document, such as the
+  `#form-demo-layout` anchor from a form-demo URL. Only that element's DOM subtree
+  is returned; a missing selector gives an explicit error.
+- `query`: case-insensitive, Unicode-normalized substring search of accessible
+  names, roles and descriptions. Search runs across the selected tree before
+  paging. It is literal search, not semantic matching.
+- `interactive_only`: return controls and links instead of static text/layout nodes.
+- `limit`: nodes per response, default 100 and maximum 300.
+- `snapshot_id` and `offset`: continue a cached snapshot at `nextOffset`. Do not
+  combine `snapshot_id` with new filters. Omit it to read a fresh tree.
+
+The result reports `totalNodes`, `matchedNodes`, `offset`, `limit`, `hasMore`,
+`nextOffset` and `truncated`. The response limit does not discard the rest of the
+tree. Refs and snapshot identity stay stable across cached pages; interaction or
+navigation invalidates the snapshot, so subsequent work needs a fresh one.
+Repeating an unfiltered snapshot or scrolling does not advance its offset.
+
+For a form at the end of a large documentation page:
+
+```json
+{"tab_id":"tab-1","selector":"#form-demo-layout","interactive_only":true}
+```
+
+For a known visible label anywhere in the main document:
+
+```json
+{"tab_id":"tab-1","query":"Field A"}
+```
+
+For the next page of a snapshot whose result has `nextOffset: 100`:
+
+```json
+{"tab_id":"tab-1","snapshot_id":"snapshot-1","offset":100}
+```
+
+Use returned refs with that snapshot ID for click/type or a sequential batch.
+Batch steps keep the original DOM identity, including targets beyond the first
+page. The final batch snapshot preserves the initial selection and page options.
+`checked`, `selected` and `expanded` state is included when provided by the
+accessibility tree, so ordinary agents can inspect control state without JEV.
+
+`target` remains a separate optional JEV recommendation within the returned page.
+Use the local filters to expose missing controls before requesting semantic advice.
+`include_text` defaults to false to avoid duplicating node labels.
+
+The tree is the current document's accessibility tree. CSS scope does not switch
+into a separate iframe, and cached pages do not refresh after asynchronous DOM
+changes: omit `snapshot_id` to refresh. A missing control alone does not prove an
+iframe; inspect the page before making that claim.
+
+Browser automation does not classify action labels or insert business-risk
+confirmation dialogs. Agent downloads use the same configured Profile download
+preferences as other browser downloads.
+
+Validate with the desktop browser tests, the browser MCP tests, and the local
+Electron fixture:
+
+```bash
+npm --prefix packages/desktop run build
+env -u ELECTRON_RUN_AS_NODE packages/desktop/node_modules/.bin/electron scripts/verify-browser-large-page.cjs
+```
```

---

### Incident Patch 6: `4a80c1b1` (2026-09-27)
**Commit Message**: [codex] fix Hermes upgrade compatibility and bridge worker lifecycle (#3202)

* fix Hermes bootstrap before accepting bridge chat requests

* fix Hermes YAML compatibility in bridge config reads

* fix Hermes worker lifecycle and profile bootstrap isolation

**File**: `docs/chat-chain-changes/2026-09-27-hermes-bridge-compatibility-audit.md` (added, +67/-0)
```diff
@@ -0,0 +1,67 @@
+---
+date: 2026-09-27
+pr: pending
+feature: Correct bridge worker lifecycle and runtime initialization
+impact: Prevent replacement workers during shutdown and load the intended profile before Hermes imports.
+---
+
+The Hermes 0.21.5 compatibility audit found three additional problems after
+the bootstrap and YAML fixes:
+
+- `WorkerProcess.stop()` cleared its process reference, then used `request()`
+  to send shutdown. That method starts a worker when none is referenced, so
+  shutdown could launch a replacement that competes for the same endpoint.
+  Send directly to the existing socket and serialize shutdown/endpoint cleanup
+  with startup under the worker lock.
+- Non-default workers imported Hermes before binding their profile home and
+  dotenv. Bind those first, clearing sibling/default profile dotenv keys using
+  the existing isolation policy. Refresh terminal YAML after bootstrap makes
+  the selected runtime's dependencies available. This ordering also survives
+  interpreter re-execution.
+- Plugin discovery runs outside the persistent bridge and lacked the Hermes
+  bootstrap. It could use an obsolete interpreter or fail to activate managed
+  dependencies. Bootstrap before plugin imports and prefer `hermes_yaml` for
+  both config and manifest metadata, retaining legacy fallbacks only when the
+  respective upstream module is absent.
+
+The audit checked the Python broker, transport, runtime, pool, worker handler,
+Node manager/client contracts, and plugin probe. All 63 upstream import symbols
+were checked against the installed runtime: the only absent symbol belongs to
+the already-supported legacy MCP-loop fallback. AIAgent constructor and SessionDB
+call keywords matched current signatures. Existing regression coverage exercises
+streaming, resume, approvals, clarification, model/provider switching, compression,
+MCP imports/filtering, background completion, and interruption.
+
+New regression coverage catches shutdown auto-start without mocking away the
+request method, validates profile selection across a real interpreter re-exec,
+and exercises native/legacy plugin bootstrap, config inheritance, and manifest
+metadata. The endpoint tests now set their own worker port/transport environment;
+the previous failure came from inheriting the desktop's custom port base.
+
+A real Hermes 0.21.5 probe against a local simulated model completed two streamed
+turns, returned context estimation, and persisted exactly user/assistant/user/
+assistant in a temporary database. External connections were blocked in the probe.
+Real plugin discovery handed off from the old Python 3.12 to managed Python 3.14.7
+and returned 104 plugins without YAML warnings (268 warnings before the YAML fix).
+
+Validation completed:
+
+- 277 focused bridge/plugin tests passed, followed by 49 lifecycle/bootstrap
+  tests after adding the real worker-stop regression and shutdown lock.
+- `npm run harness:check` and `npm run build` passed.
+- The actual development server on port 8647 returned HTTP 200 for MCP servers
+  (five entries) and plugins (104 entries, zero warnings). Final bridge reload
+  completed successfully and the previous workers exited.
+- Full coverage run: 6,363 passed, 58 failed, 14 skipped. An unchanged pre-audit
+  checkout reproduced every one of those 58 failures (65 failures there in total,
+  including the inherited port-test environment issue). No newly failing test
+  names appeared in the changed checkout. These unrelated failures remain open.
+- Full browser run: 246 passed, one session-category retry notification test
+  failed. The same case failed when rerun individually, including on a fresh
+  port/cache, while the unchanged pre-audit checkout passed the isolated case.
+  That current-environment browser failure remains unresolved; no client code
+  changed in this audit, and it is not classified as a proven baseline failure.
+
+Windows-specific process handoff and provider network behavi
```

**File**: `docs/chat-chain-changes/2026-09-27-hermes-runtime-bootstrap.md` (added, +36/-0)
```diff
@@ -0,0 +1,36 @@
+---
+date: 2026-09-27
+pr: pending
+feature: Bootstrap the Hermes interpreter before accepting bridge requests
+impact: Prevent first-chat connection loss after Hermes upgrades replace the Python runtime.
+---
+
+Hermes 0.21.5 can re-execute an old virtualenv interpreter into its managed
+Python during `hermes_bootstrap` import. Studio previously loaded that module
+indirectly during the first `run_agent` import, after the worker had reported
+ready and accepted a context-estimation/chat request. Re-execution closes those
+sockets, producing `worker closed without a response` followed by connection
+refused while the worker restarts.
+
+Run Hermes bootstrap after resolving its source/home and before attribution,
+other Hermes imports, or broker/worker readiness. The upstream bootstrap owns
+interpreter and dependency selection. Older runtimes without that module keep
+their existing startup path; a missing dependency inside an existing bootstrap
+must fail startup instead of being treated as a legacy runtime.
+
+No profile/config migration or Hermes source modification is needed. Installed
+Studio bridge processes must restart after deploying the fix. Already-failed
+chat turns need to be retried.
+
+Regression coverage starts real bridge subprocesses with a fixture bootstrap
+that re-executes the interpreter. It verifies bootstrap precedes broker/worker
+readiness, the first context/chat requests reach the agent import boundary
+without losing their socket, subsequent pings work, and legacy/missing-dependency
+cases remain distinct.
+
+Validation: 147 focused bridge/chat tests, `npm run harness:check`, and
+`npm run build` passed. A separate temporary profile against the locally
+updated Hermes 0.21.5 started with the old Python 3.12 command, became ready
+under managed Python 3.14.7, successfully returned `context_estimate`, and
+answered a follow-up ping. This smoke check made no model-completion request;
+Windows interpreter handoff still needs platform validation.
```

**File**: `docs/chat-chain-changes/2026-09-27-hermes-yaml-compatibility.md` (added, +29/-0)
```diff
@@ -0,0 +1,29 @@
+---
+date: 2026-09-27
+pr: pending
+feature: Use the Hermes YAML adapter for bridge configuration reads
+impact: Restore MCP management and terminal configuration after Hermes replaces PyYAML.
+---
+
+Hermes 0.21.5 uses `hermes_yaml` backed by ruamel.yaml and its managed Python
+does not necessarily include PyYAML. Direct `import yaml` in Studio's bridge
+caused the MCP page to return HTTP 503 (`No module named 'yaml'`). The same
+assumption prevented terminal configuration refresh and fallback config reads.
+
+Load the upstream `hermes_yaml` adapter lazily for all three paths. Only fall
+back to PyYAML when that adapter itself is absent, preserving legacy runtime
+compatibility without hiding missing dependencies inside the new adapter.
+MCP saves keep using Hermes' atomic writer and no longer import unused PyYAML.
+This preserves upstream parsing policy, profile isolation, and unrelated config
+fields without installing packages or modifying Hermes source.
+
+Restart the bridge after deploying the Python files. Regression coverage checks
+native and legacy parser paths, MCP read/write round trips, profile isolation,
+fallback configuration, terminal environment refresh, and broken native imports.
+
+Validation: 45 focused YAML/bootstrap/profile/MCP tests, `npm run harness:check`,
+and `npm run build` passed. A temporary configuration round trip with the actual
+Hermes 0.21.5 adapter passed without PyYAML installed. After restarting only the
+development instance's bridge, its MCP list endpoint on port 8647 returned HTTP
+200 with five configured servers. The separately installed desktop app needs
+the updated bridge files through its normal build/update process.
```

**File**: `packages/server/src/modules/hermes/services/bridge/README.md` (modified, +11/-2)
```diff
@@ -1,9 +1,18 @@
 # Agent Bridge
 
-Optional backend-side bridge for talking to Hermes Agent by instantiating
+Backend-side bridge for talking to Hermes Agent by instantiating
 `run_agent.AIAgent` directly in a Python process.
 
-This is intentionally separate from the current Web UI chat path.
+Hermes chat, context estimation, and MCP management use this bridge. Plugin
+management uses a separate short-lived Python probe with the same interpreter
+resolver.
+
+Workers bind their profile home and environment before importing Hermes or its
+bootstrap. Bootstrap must finish before any socket reports ready, since Hermes
+upgrades can replace the interpreter and dependency environment. Configuration
+reads prefer Hermes' YAML adapter, with PyYAML support for older installations.
+Shutdown sends directly to the existing worker socket: the normal request path
+can start a worker and must not be used while stopping one.
 
 ## Python Service
 
```

**File**: `packages/server/src/modules/hermes/services/bridge/python/bridge_runtime.py` (modified, +24/-3)
```diff
@@ -498,6 +498,15 @@ def _ensure_agent_imports() -> None:
         )
     os.environ.setdefault("HERMES_HOME", str(_hermes_home()))
     os.environ.setdefault("HERMES_AGENT_BRIDGE_BASE_HOME", str(_hermes_home()))
+    # Updated Hermes installs may re-exec into a new Python interpreter here.
+    # Finish that bootstrap before either bridge binds its socket/reports ready;
+    # deferring it to the first run_agent import drops the in-flight chat socket.
+    try:
+        importlib.import_module("hermes_bootstrap")
+    except ModuleNotFoundError as exc:
+        if exc.name != "hermes_bootstrap":
+            raise
+        # Older Hermes runtimes do not have a bootstrap module.
     _apply_openrouter_attribution_override()
     from bridge_mcp import install_studio_mcp_env
 
@@ -529,6 +538,16 @@ def _apply_openrouter_attribution_override() -> None:
         pass
 
 
+def _load_yaml_module():
+    """Use Hermes' YAML policy, with PyYAML support for older runtimes."""
+    try:
+        return importlib.import_module("hermes_yaml")
+    except ModuleNotFoundError as exc:
+        if exc.name != "hermes_yaml":
+            raise
+        return importlib.import_module("yaml")
+
+
 def _load_cfg(profile: str | None = None) -> dict[str, Any]:
     _ensure_agent_imports()
     try:
@@ -538,7 +557,7 @@ def _load_cfg(profile: str | None = None) -> dict[str, Any]:
         return cfg if isinstance(cfg, dict) else {}
     except Exception:
         try:
-            import yaml
+            yaml = _load_yaml_module()
 
             path = _hermes_home() / "config.yaml"
             if not path.exists():
@@ -614,7 +633,9 @@ def _set_worker_profile_env(profile: str | None) -> None:
     profile_home = _profile_home(profile)
     os.environ["HERMES_HOME"] = str(profile_home)
     os.environ["HERMES_AGENT_BRIDGE_WORKER_PROFILE"] = profile or "default"
-    _refresh_worker_profile_env()
+    # Bind the worker's home and credentials before importing any Hermes code.
+    # Terminal config requires Hermes' YAML adapter and is refreshed after bootstrap.
+    _apply_profile_dotenv(profile)
 
 
 def _refresh_worker_profile_env() -> None:
@@ -657,7 +678,7 @@ def _refresh_terminal_env() -> None:
     if not config_path.exists():
         return
     try:
-        import yaml
+        yaml = _load_yaml_module()
         with open(config_path, encoding="utf-8") as f:
             cfg = yaml.safe_load(f) or {}
         terminal_cfg = cfg.get("terminal", {})
```

---

### Incident Patch 7: `ec123cc9` (2026-09-27)
**Commit Message**: fix Agent Manager layout and unsupported Cursor update status (#3201)

**File**: `packages/client/src/views/hermes/AgentManagerView.vue` (modified, +17/-4)
```diff
@@ -685,10 +685,10 @@ onUnmounted(() => {
                   {{ t('agentManager.deleteConfirm', { name: agent.name }) }}
                 </NPopconfirm>
               </div>
-              <div v-if="agent.id !== 'cursor' && toolStatus(agent.id)?.installed && updatePolicies[agent.id]" class="agent-update-policy">
+              <div v-if="toolStatus(agent.id)?.installed && updatePolicies[agent.id]" class="agent-update-policy">
                 <div class="agent-update-policy-row"><span>{{ t('agentAutoUpdate.label') }}</span><NSwitch class="agent-update-switch" size="small" :theme-overrides="{ railHeightSmall: '16px', railWidthSmall: '28px', buttonHeightSmall: '12px', buttonWidthSmall: '12px' }" :disabled="!updatePolicies[agent.id]?.autoUpdateSupported" :value="updatePolicies[agent.id]?.autoUpdate" @update:value="toggleAutoUpdate(agent.id, $event)" /></div>
 
-                <small v-if="updatePolicies[agent.id]?.error" class="agent-update-error">{{ t('codingAgents.checkUpdateFailed') }}</small>
+                <small v-if="updatePolicies[agent.id]?.autoUpdateSupported && updatePolicies[agent.id]?.error" class="agent-update-error">{{ t('codingAgents.checkUpdateFailed') }}</small>
               </div>
             </section>
           </div>
@@ -862,7 +862,7 @@ onUnmounted(() => {
 }
 
 .agent-manager-content {
-  max-width: 1240px;
+  container: agent-manager / inline-size;
   min-height: 100%;
   display: flex;
   flex-direction: column;
@@ -934,11 +934,24 @@ onUnmounted(() => {
 
 .coding-agent-grid {
   display: grid;
-  grid-template-columns: repeat(2, minmax(0, 1fr));
+  grid-template-columns: 1fr;
   align-items: stretch;
   gap: 16px;
 }
 
+// Keep cards at least 340px wide when showing multiple columns, including 16px gaps.
+@container agent-manager (min-width: 696px) {
+  .coding-agent-grid {
+    grid-template-columns: repeat(2, minmax(0, 1fr));
+  }
+}
+
+@container agent-manager (min-width: 1052px) {
+  .coding-agent-grid {
+    grid-template-columns: repeat(3, minmax(0, 1fr));
+  }
+}
+
 .coding-agent-card {
   min-width: 0;
   display: flex;
```

**File**: `packages/server/src/modules/coding-agents/services/update-policy.ts` (modified, +4/-0)
```diff
@@ -100,6 +100,10 @@ export class AgentUpdatePolicy {
     if(this.running)return;this.running=true
     try {
       for(const id of this.adapter.ids()) {
+        if (!this.adapter.safelyManaged(id)) {
+          this.idle.delete(id)
+          continue
+        }
         const state=this.states[id] ||= blank()
         try {
           if (this.manualInstalls.has(id)) continue
```

**File**: `tests/e2e/agent-manager-updates.spec.ts` (added, +53/-0)
```diff
@@ -0,0 +1,53 @@
+import { expect, test } from '@playwright/test'
+import { authenticate, mockHermesApi } from './fixtures'
+
+test('shows disabled Cursor updates without stale failures and preserves supported update controls', async ({ page }) => {
+  await authenticate(page)
+  await mockHermesApi(page)
+  await page.route('**/api/agents/status', route => route.fulfill({ json: {
+    revision: 1,
+    updatedAt: '2026-09-27T00:00:00.000Z',
+    agents: ['cursor', 'codex'].map(id => ({
+      id, installed: true, source: 'user-cli', version: '1.2.3', path: `/usr/local/bin/${id}`,
+    })),
+  } }))
+  const agents = {
+    cursor: {
+      autoUpdate: false, autoUpdateSupported: false, status: 'failed',
+      currentVersion: '1.2.3', latestVersion: '', checkedAt: '2026-09-27T00:00:00.000Z',
+      error: 'Cursor CLI updates are not managed by Studio',
+    },
+    codex: {
+      autoUpdate: false, autoUpdateSupported: true, status: 'failed',
+      currentVersion: '1.2.3', latestVersion: '', checkedAt: '2026-09-27T00:00:00.000Z',
+      error: 'Registry connection timed out',
+    },
+  }
+  await page.route('**/api/coding-agents/update-policies', route => route.fulfill({ json: { agents } }))
+  const updates: string[] = []
+  await page.route('**/api/coding-agents/*/update-policy', async route => {
+    const id = new URL(route.request().url()).pathname.split('/').at(-2)!
+    updates.push(id)
+    expect(id).toBe('codex')
+    agents.codex.autoUpdate = route.request().postDataJSON().autoUpdate
+    await route.fulfill({ json: { agents } })
+  })
+
+  await page.goto('/#/studio/agents')
+  const cursor = page.getByTestId('agent-card-cursor')
+  const cursorSwitch = cursor.getByRole('switch')
+  await expect(cursor.locator('.agent-update-policy')).toContainText('Automatic updates')
+  await expect(cursor.locator('.agent-update-error')).toHaveCount(0)
+  await expect(cursorSwitch).toHaveClass(/n-switch--disabled/)
+  await cursorSwitch.click({ force: true })
+  await expect(cursorSwitch).toHaveAttribute('aria-checked', 'false')
+  expect(updates).toEqual([])
+
+  const codex = page.getByTestId('agent-card-codex')
+  await expect(codex.locator('.agent-update-error')).toHaveText('Failed to check for update')
+  await codex.getByRole('switch').click()
+  await expect(codex.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
+  expect(updates).toEqual(['codex'])
+  await expect(cursorSwitch).toHaveClass(/n-switch--disabled/)
+  await expect(cursor.locator('.agent-update-error')).toHaveCount(0)
+})
```

**File**: `tests/server/agent-update-policy.test.ts` (modified, +30/-0)
```diff
@@ -47,6 +47,36 @@ it('unsupported external installations cannot enable automatic updates',async()=
  await expect(policy.set('codex',true)).rejects.toThrow('not supported')
  await policy.tick();expect(policy.snapshot().codex.autoUpdateSupported).toBe(false);expect(adapter.install).not.toHaveBeenCalled()
 })
+it('skips unsupported agents in normal and forced background checks without blocking supported agents', async () => {
+  const { dir, adapter } = await setup()
+  const check = vi.fn(async (id: string) => ({
+    success: id !== 'cursor',
+    tool: { installed: true, version: '1' },
+    latestVersion: id === 'cursor' ? '' : '2',
+    updateAvailable: id !== 'cursor',
+    message: id === 'cursor' ? 'Cursor CLI updates are not managed by Studio' : '',
+  }))
+  const policy = new AgentUpdatePolicy(dir, {
+    ...adapter,
+    ids: () => ['cursor', 'codex'],
+    safelyManaged: id => id !== 'cursor',
+    check,
+  })
+
+  await policy.tick()
+  await policy.tick(true)
+
+  expect(check.mock.calls).toEqual([['codex'], ['codex']])
+  expect(policy.snapshot().cursor).toMatchObject({
+    autoUpdate: false,
+    autoUpdateSupported: false,
+    status: 'unknown',
+    checkedAt: '',
+  })
+  expect(policy.snapshot().cursor.error).toBeUndefined()
+  expect(policy.snapshot().codex.status).toBe('available')
+  expect(adapter.install).not.toHaveBeenCalled()
+})
 it('requires 60 continuous safe seconds and resets on short activity between polls',async()=>{
  vi.useFakeTimers()
  try {
```

---

### Incident Patch 8: `c0f17e86` (2026-09-27)
**Commit Message**: [codex] refresh session pins and fix workspace favorite controls (#3193)

* replace workspace pin stars with SVG thumbtacks

* use stars for favorites and refresh session pin icon

* keep workspace More control from shrinking and wrapping

**File**: `packages/client/src/components/common/PinIcon.vue` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+<script setup lang="ts">
+defineProps<{ filled?: boolean }>()
+</script>
+
+<template>
+  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
+    <g transform="rotate(35 12 12)">
+      <path d="M9 3h6v6l3 4v2H6v-2l3-4V3Z" :fill="filled ? 'currentColor' : 'none'" />
+      <path d="M12 15v6" />
+    </g>
+  </svg>
+</template>
```

**File**: `packages/client/src/components/common/StarIcon.vue` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+<script setup lang="ts">
+defineProps<{ filled?: boolean }>()
+</script>
+
+<template>
+  <svg width="16" height="16" viewBox="0 0 24 24" :fill="filled ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
+    <path d="M12 3l2.78 5.63 6.22.91-4.5 4.39 1.06 6.2L12 17.2l-5.56 2.93 1.06-6.2L3 9.54l6.22-.91L12 3Z" />
+  </svg>
+</template>
```

**File**: `packages/client/src/components/hermes/chat/ChatPanel.vue` (modified, +48/-20)
```diff
@@ -44,6 +44,7 @@ import { useRouter } from "vue-router";
 import { useI18n } from "vue-i18n";
 import { copyToClipboard } from "@/utils/clipboard";
 import FolderPicker from "./FolderPicker.vue";
+import StarIcon from "@/components/common/StarIcon.vue";
 import ChatInput from "./ChatInput.vue";
 import RealtimeVoiceStage from "./RealtimeVoiceStage.vue";
 import ConversationMonitorPane from "./ConversationMonitorPane.vue";
@@ -3102,8 +3103,16 @@ async function handleSessionModelCustomSubmit() {
                   <span v-if="index < visibleDefaultWorkspaces.length - 1 || hasHiddenDefaults" class="workspace-chip-separator">/</span>
                 </template>
                 <div v-if="hasHiddenDefaults" class="workspace-chip-dropdown">
-                  <button class="workspace-chip-more" @click="showDefaultWorkspaceMenu = !showDefaultWorkspaceMenu">
-                    {{ t("chat.more") }} ▼
+                  <button
+                    class="workspace-chip-more"
+                    type="button"
+                    :aria-expanded="showDefaultWorkspaceMenu"
+                    @click="showDefaultWorkspaceMenu = !showDefaultWorkspaceMenu"
+                  >
+                    <span>{{ t("chat.more") }}</span>
+                    <svg class="workspace-more-chevron" :class="{ expanded: showDefaultWorkspaceMenu }" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
+                      <path d="m6 9 6 6 6-6" />
+                    </svg>
                   </button>
                   <div v-if="showDefaultWorkspaceMenu" class="workspace-dropdown-menu">
                     <div
@@ -3139,17 +3148,13 @@ async function handleSessionModelCustomSubmit() {
                 >
                   <template #icon>
                     <span
-                      v-if="defaultWorkspaces.includes(ws.path)"
-                      class="recent-pin-icon"
-                      @click.stop="handleTogglePinRecent(ws.path)"
-                      :title="t('chat.workspaceUnpin')"
-                    >★</span>
-                    <span
-                      v-else
                       class="recent-pin-icon"
+                      :class="{ 'is-pinned': defaultWorkspaces.includes(ws.path) }"
                       @click.stop="handleTogglePinRecent(ws.path)"
-                      :title="t('chat.workspacePin')"
-                    >☆</span>
+                      :title="defaultWorkspaces.includes(ws.path) ? t('chat.workspaceUnpin') : t('chat.workspacePin')"
+                    >
+                      <StarIcon :filled="defaultWorkspaces.includes(ws.path)" width="14" height="14" />
+                    </span>
                   </template>
                   {{ getFolderName(ws.path) }}
                 </NButton>
@@ -4514,7 +4519,9 @@ async function handleSessionModelCustomSubmit() {
 .default-workspace-chips {
   display: flex;
   align-items: center;
-  gap: 8px;
+  flex-wrap: wrap;
+  gap: 6px 8px;
+  min-width: 0;
   margin-bottom: 8px;
 }
 
@@ -4526,13 +4533,16 @@ async function handleSessionModelCustomSubmit() {
 
 .workspace-chips-container {
   display: flex;
+  flex: 1 1 240px;
+  min-width: 0;
   align-items: center;
   gap: 6px;
   flex-wrap: nowrap;
   position: relative;
 }
 
 .workspace-chip {
+  min-width: 0;
   padding: 4px 12px;
   font-size: 13px;
   color: var(--text-secondary);
@@ -4561,19 +4571,24 @@ async function handleSessionModelCustomSubmit() {
 }
 
 .workspace-chip-separator {
+  flex-shrink: 0;
   color: var(--n-text-color-3);
   font-size: 13px;
   user-select: none;
 }
 
 .workspace-chip-dropdown {
   position: relative;
-  display: inline-block;
+  display: flex;
+  flex-shrink: 0;
 }
 
 .workspace-chip-more {
   display: inline-flex;
   align-items: center;
+  gap: 4px;
+  white-space: nowrap;
+  line-height: inherit;
   padding: 4px 12px;
   font-size: 13px;
   background: va
```

**File**: `packages/client/src/components/hermes/chat/FolderPicker.vue` (modified, +8/-12)
```diff
@@ -4,6 +4,7 @@ import { NButton, NDropdown, NInput, NModal, NSpace, NSpin, useDialog, useMessag
 import { useI18n } from 'vue-i18n'
 import { request } from '@/api/client'
 import { copyToClipboard } from '@/utils/clipboard'
+import StarIcon from '@/components/common/StarIcon.vue'
 
 interface FolderEntry {
   name: string
@@ -375,15 +376,15 @@ const flatNodes = computed<FlatNode[]>(() => {
       <button
         v-if="props.showFavorite"
         class="folder-selected-favorite"
+        :class="{ 'is-pinned': props.favorite }"
         type="button"
         :disabled="props.favoriteDisabled"
         :title="props.favoriteTitle"
         :aria-label="props.favoriteTitle"
+        :aria-pressed="Boolean(props.favorite)"
         @click.stop="emit('toggle-favorite')"
       >
-        <span class="folder-selected-star" :class="{ 'is-pinned': props.favorite }">
-          {{ props.favorite ? '★' : '☆' }}
-        </span>
+        <StarIcon :filled="props.favorite" />
       </button>
     </div>
 
@@ -552,28 +553,23 @@ const flatNodes = computed<FlatNode[]>(() => {
   display: inline-flex;
   align-items: center;
   justify-content: center;
-  color: rgba(255, 255, 255, 0.55);
+  color: var(--text-muted);
   background: transparent;
   cursor: pointer;
   transition: background 0.15s, transform 0.15s, color 0.15s;
 
   &:hover:not(:disabled) {
-    background: rgba(255, 255, 255, 0.08);
+    color: var(--accent-primary);
+    background: rgba(var(--accent-primary-rgb), 0.08);
     transform: scale(1.08);
   }
 
   &:disabled {
     opacity: 0.45;
     cursor: not-allowed;
   }
-}
-
-.folder-selected-star {
-  font-size: 16px;
-  line-height: 1;
-
   &.is-pinned {
-    color: #f5a623;
+    color: var(--accent-primary);
   }
 }
 </style>
```

**File**: `packages/client/src/components/hermes/chat/SessionListItem.vue` (modified, +2/-5)
```diff
@@ -6,6 +6,7 @@ import type { Session } from '@/stores/hermes/chat'
 import { useAppStore } from '@/stores/hermes/app'
 import { useProfilesStore } from '@/stores/hermes/profiles'
 import ProfileAvatar from '@/components/hermes/profiles/ProfileAvatar.vue'
+import PinIcon from '@/components/common/PinIcon.vue'
 import { formatTimestampMs } from '@/shared/session-display'
 import { chatSessionAgentAvatar } from '@/utils/chat-agent-avatar'
 import { resolveSessionNavigation } from './session-list-item-navigation'
@@ -124,11 +125,7 @@ onUnmounted(() => {
       <span class="session-item-title-row">
         <span class="session-item-title-main">
           <span v-if="pinned" class="session-item-pin" aria-hidden="true">
-            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
-              <path d="M12 17v5" />
-              <path d="M5 8l14 0" />
-              <path d="M8 3l8 0 0 5 3 5-14 0 3-5z" />
-            </svg>
+            <PinIcon width="13" height="13" filled />
           </span>
           <span v-if="completedUnread" class="session-item-unread-dot" aria-hidden="true" />
           <span class="session-item-title" dir="auto">
```

---

### Incident Patch 9: `f1468ec4` (2026-09-26)
**Commit Message**: fix browser settings dark theme background (#3192)

**File**: `packages/client/src/views/hermes/DesktopBrowserView.vue` (modified, +1/-1)
```diff
@@ -392,7 +392,7 @@ onUnmounted(() => {
 
 <style scoped lang="scss">
 .browser-settings-page { height: 100%; min-height: 0; display: flex; flex-direction: column; overflow: hidden; color: var(--text-color); }
-.settings-card { flex: 1; min-height: 0; overflow: auto; padding: 4px 12px 20px; }
+.settings-card { flex: 1; min-height: 0; overflow: auto; padding: 4px 12px 20px; background-color: transparent; }
 .settings-card :deep(.n-card__content) { max-width: 1120px; width: 100%; margin: 0 auto; }
 .profiles-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 420px), 1fr)); gap: 14px; }
 .profile-card { min-width: 0; display: flex; flex-direction: column; padding: 16px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-card); transition: border-color .16s ease, box-shadow .16s ease; }
```

---

### Incident Patch 10: `deeacaf1` (2026-09-26)
**Commit Message**: fix group coding agent MCP run credentials (#3187)

**File**: `bin/ekko-studio-mcp.mjs` (modified, +20/-1)
```diff
@@ -117,6 +117,21 @@ function readToken(tokenOverride, allowTokenFile = true, profile = '') {
   }
 }
 
+function readRunCredential(profile) {
+  const file = process.env.HERMES_WEB_UI_RUN_TOKEN_FILE
+  if (!file) return null
+  let credential
+  try { credential = JSON.parse(readFileSync(file, 'utf8')) } catch {
+    throw new Error('The current run credential is unavailable. Start a new Studio run.')
+  }
+  if (!credential || typeof credential.token !== 'string' || !credential.token.startsWith('studio_run_')
+    || typeof credential.context_id !== 'string' || !credential.context_id
+    || typeof credential.profile !== 'string' || credential.profile !== profile) {
+    throw new Error('The MCP request does not match its configured run credential.')
+  }
+  return credential
+}
+
 function defaultProfile() {
   return String(
     process.env.HERMES_WEB_UI_PROFILE ||
@@ -216,14 +231,18 @@ async function requestEnvelope(path, options = {}) {
   const profile = typeof options.profile === 'string' && options.profile.trim()
     ? options.profile.trim()
     : defaultProfile()
-  const token = readToken(options.token, options.allowTokenFile !== false, profile)
+  // A managed group run must never fall back to another run's profile token,
+  // a stale inherited AUTH_TOKEN, or an explicit tool-argument override.
+  const runCredential = readRunCredential(profile)
+  const token = runCredential?.token || readToken(options.token, options.allowTokenFile !== false, profile)
   const method = options.method || 'GET'
   const body = method === 'GET' || method === 'HEAD' ? undefined : options.body
   const headers = {
     ...normalizePublicHeaders(options.headers),
     ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
     ...(token ? { Authorization: `Bearer ${token}` } : {}),
     ...(profile ? { 'X-Hermes-Profile': profile } : {}),
+    ...(runCredential ? { 'X-Studio-Run-Context': runCredential.context_id } : {}),
   }
   const fetchRequest = path === '/api/studio/mobile-calendar/request' || path === '/api/studio/mobile-health/request' || path === '/api/studio/clarifications/request' ? fetchMobileConsent : fetch
   const response = await fetchRequest(`${baseUrl()}${appendQuery(path, options.query)}`, {
```

**File**: `docs/chat-chain-changes/2026-09-26-group-mcp-run-credentials.md` (added, +61/-0)
```diff
@@ -0,0 +1,61 @@
+# Group Coding Agent MCP credentials
+
+Group Coding Agent runs previously entered ChatRunSocket without a socket user.
+The shared profile JWT writer therefore skipped them, and managed MCP requests
+fell back to a static server token that interaction endpoints reject (#3179).
+
+## Authorization
+
+The run coordinator now issues an opaque capability before native launch. Its
+server-side binding contains the local profile, session, room, Agent and current
+interaction context. The credential requires the matching run context header
+and profile; task-plan and clarification bodies must name that exact context.
+Native activity and the group executor's freshness guard are checked on every
+request. No fixed one-hour cutoff interrupts a still-active long-running turn.
+
+Local human requests may delegate the authenticated identity stored in the local
+room membership, provided that account is active and can access the Agent's
+profile. Account status and profile access are rechecked for each request, and
+ordinary endpoint authorization still applies. Agent handoffs, unauthenticated
+guests, and remote relay executions receive only current-turn task-plan and
+clarification permissions. A remote room owner or sender ID is never interpreted
+as a user ID on the executor's machine. Remote account API delegation is not
+implicitly authorized by pairing an Agent.
+
+## Transport and lifecycle
+
+Each turn gets a private `auth.json` under its own Studio `runtime/mcp-credentials` directory
+and a separate group runtime configuration directory. The file path is injected
+directly into each of the five bundled managed MCP definitions for all six Coding
+Agent runtimes, in scoped and global mode. Group runs use the bundled loopback
+transport even when a managed server has a custom transport override; enabled
+switches and unrelated custom MCP definitions are preserved. Credentials are
+never added to prompts, group messages, relay payloads or shared profile files.
+The sensitive basename also prevents local, session-share and remote workspace
+file APIs from serving the credential. Client-supplied group metadata cannot
+delegate account permissions; the internal coordinator must resolve the requester.
+
+The MCP client reads the bound file for every request. A missing, malformed or
+foreign-profile file fails closed, without falling back to environment tokens,
+tool-argument tokens or another session's profile token. Ordinary single-chat
+token precedence remains unchanged; #3036 is separate.
+
+Completion, failure, interruption, replacement, disposal and server shutdown
+revoke the capability and remove its file. Cancellation during asynchronous
+file creation also removes the late write. A process restart loses all in-memory
+bindings, so files left by an abrupt crash cannot authenticate again. Ending an
+old context cannot revoke a newer capability for the same session.
+
+## Validation
+
+- Real MCP subprocesses and the HTTP auth middleware exercise simultaneous
+  fresh-profile task-plan updates, clarification, stale environment tokens,
+  foreign context/profile rejection and file revocation.
+- Coordinator tests exercise the userless group launch and terminal/failure
+  cleanup; issuer tests exercise restart invalidation and preparation races.
+- Local/remote identity tests cover membership lookup and revoked account access.
+- Native configuration tests cover all six runtimes in scoped and global modes,
+  including concurrent turns of the same room Agent.
+
+These credentials enforce Studio HTTP authorization. They do not sandbox a
+Coding Agent's filesystem or shell access under the local operating-system user.
```

**File**: `packages/server/src/modules/coding-agents/services/index.ts` (modified, +46/-24)
```diff
@@ -304,6 +304,8 @@ export interface CodingAgentConfigFileContent extends CodingAgentConfigFileDefin
 }
 
 export interface CodingAgentLaunchInput extends CodingAgentConfigScope {
+  /** Server-issued credential file for this group turn's managed MCP servers. */
+  studioMcpTokenFile?: string
   agentPreset?: string
   mode?: 'scoped' | 'global'
   model?: string
@@ -892,7 +894,7 @@ function getScopedConfigRoot(id: CodingAgentId, scope: Required<CodingAgentConfi
 function getScopedRuntimeConfigRoot(
   id: CodingAgentId,
   scope: Required<CodingAgentConfigScope>,
-  input: Pick<CodingAgentLaunchInput, 'sessionId' | 'agentSessionId' | 'groupRuntimeScope'>,
+  input: Pick<CodingAgentLaunchInput, 'sessionId' | 'agentSessionId' | 'groupRuntimeScope' | 'studioMcpTokenFile'>,
 ): string {
   const groupRoomId = String(input.groupRuntimeScope?.roomId || '').trim()
   const groupAgentId = String(input.groupRuntimeScope?.agentId || '').trim()
@@ -907,6 +909,7 @@ function getScopedRuntimeConfigRoot(
       'group-chat',
       stableSegment(groupRoomId),
       stableSegment(groupAgentId),
+      ...(input.studioMcpTokenFile ? ['runs', createHash('sha256').update(input.studioMcpTokenFile).digest('hex').slice(0, 24)] : []),
     )
   }
   const rootDir = getScopedConfigRoot(id, scope)
@@ -1085,7 +1088,7 @@ async function activeGlobalCodexInstructions(sourceHome: string): Promise<string
   return await safeReadFile(join(sourceHome, 'AGENTS.md')) || ''
 }
 
-async function prepareGlobalCodexShadowHome(rootDir: string, systemPrompt: string, profile: string): Promise<string> {
+async function prepareGlobalCodexShadowHome(rootDir: string, systemPrompt: string, profile: string, runTokenFile?: string): Promise<string> {
   const sourceHome = getGlobalCodexHome()
   await mkdir(rootDir, { recursive: true, mode: 0o700 })
 
@@ -1108,7 +1111,7 @@ async function prepareGlobalCodexShadowHome(rootDir: string, systemPrompt: strin
     if (HERMES_MCP_SERVER_NAMES.has(name) || LEGACY_HERMES_MCP_SERVER_NAMES.has(name)
       || server?.env?.[HERMES_MCP_MANAGED_ENV_KEY]) delete externalMcp[name]
   }
-  config.mcp_servers = { ...externalMcp, ...getCodingAgentManagedMcpServerConfigs('codex', profile) } as any
+  config.mcp_servers = { ...externalMcp, ...getCodingAgentManagedMcpServerConfigs('codex', profile, runTokenFile) } as any
   await writeFile(join(rootDir, 'config.toml'), stringifyToml(config), { mode: 0o600 })
 
   const promptPath = join(rootDir, 'AGENTS.md')
@@ -1203,11 +1206,22 @@ function managedHermesMcpServerConfig(
   profile: string,
   serverName: string,
   toolset: string,
+  runTokenFile?: string,
 ): Record<string, unknown> {
   const override = getManagedMcpServerOverride(agentId, profile, serverName)
   const server: Record<string, unknown> = Object.keys(override).length
     ? override
     : hermesMcpServerConfig(profile, serverName, toolset)
+  if (runTokenFile) {
+    // A run credential is only entrusted to the bundled, local MCP transport.
+    // User-defined remote overrides must not receive this credential path.
+    const managed = hermesMcpServerConfig(profile, serverName, toolset)
+    Object.assign(server, managed, { env: { ...managed.env, HERMES_WEB_UI_RUN_TOKEN_FILE: runTokenFile } })
+    delete server.url
+    delete server.headers
+    delete server.type
+    delete server.transport
+  }
   if (toolset === 'plan') {
     const env = server.env as Record<string, string> | undefined
     if (env?.[HERMES_MCP_MANAGED_ENV_KEY] === '1') {
@@ -1284,14 +1298,14 @@ function inheritClaudeSettings(existingContent: string | null | undefined = ''):
   }
 }
 
-function claudeMcpConfigJson(profile: string, ...existingContents: Array<string | null | undefined>): string {
+function claudeMcpConfigJson(profile: string, runTokenFile: string | undefined, ...existingContents: Array<string | null | undefined>): string {
   const mcpServers: Record<string, unknown> = {}
   for (const content of existingContents) {
     Object.assign(mcpS
```

**File**: `packages/server/src/modules/coding-agents/services/runtime/run-manager.ts` (modified, +3/-0)
```diff
@@ -102,6 +102,7 @@ export interface CodingAgentRunLaunch {
   sessionSource?: 'global_agent' | 'workflow' | 'group_chat'
   reasoningEffort?: string
   approvalRequired?: boolean
+  studioMcpTokenFile?: string
 }
 
 export interface CodingAgentRunInfo {
@@ -678,12 +679,14 @@ export class CodingAgentRunManager {
     model?: string
     reasoningEffort?: string
     apiMode?: ApiMode
+    studioMcpTokenFile?: string
   }): boolean {
     const run = this.getBySession(sessionId)
     if (!run || run.exited) return false
     const mode = launch.mode === 'global' ? 'global' : 'scoped'
     if (run.launch.agentId !== launch.agentId) return false
     if (run.launch.mode !== mode) return false
+    if (run.launch.studioMcpTokenFile !== launch.studioMcpTokenFile) return false
     if (mode === 'scoped') {
       const provider = String(launch.provider || '').trim()
       const model = String(launch.model || '').trim()
```

**File**: `packages/server/src/modules/studio/middleware/auth.ts` (modified, +37/-0)
```diff
@@ -2,6 +2,7 @@ import { handleSessionShareHttp } from '../services/session-shares/http-access'
 import type { Context, Next } from 'koa'
 import { createHmac, randomUUID, timingSafeEqual } from 'crypto'
 import { getToken } from '../services/auth/token-auth'
+import { runMcpCredentials } from '../services/auth/run-mcp-credentials'
 import {
   findUserById,
   listUserProfiles,
@@ -325,6 +326,42 @@ export async function requireUserJwt(ctx: Context, next: Next): Promise<void> {
 
   const secret = await getJwtSecret()
   const token = requestToken(ctx)
+  if (runMcpCredentials.recognizes(token)) {
+    const binding = runMcpCredentials.authenticate(token)
+    if (!binding) {
+      ctx.status = 401
+      ctx.body = { error: 'Run credential is unavailable or has expired' }
+      return
+    }
+    const body = ctx.request.body as Record<string, unknown> | undefined
+    const profiles = [ctx.get('x-hermes-profile'), ctx.query.profile, body?.profile].filter(value => value !== undefined && value !== '')
+    const interaction = ctx.method === 'POST' && (
+      ctx.path === '/api/studio/task-plans/update' || ctx.path === '/api/studio/clarifications/request'
+    )
+    if (ctx.get('x-studio-run-context') !== binding.contextId
+      || profiles.some(value => typeof value !== 'string' || value.trim() !== binding.profile)
+      || (interaction && body?.context_id !== binding.contextId)) {
+      ctx.status = 403
+      ctx.body = { error: 'Request does not belong to this run context' }
+      return
+    }
+    if (binding.userId !== undefined) {
+      const user = findUserById(binding.userId)
+      if (!user || user.status !== 'active' || (user.role !== 'super_admin' && !userCanAccessProfile(user.id, binding.profile))) {
+        ctx.status = 403
+        ctx.body = { error: 'Run requester no longer has access to this profile' }
+        return
+      }
+      ctx.state.user = toAuthenticatedUser(user)
+    } else if (!interaction) {
+      ctx.status = 403
+      ctx.body = { error: 'This run credential only permits its task plan and clarification requests' }
+      return
+    }
+    ctx.state.profile = { name: binding.profile }
+    await next()
+    return
+  }
   const payload = token ? verifyUserJwt(token, secret) : null
   if (!payload) {
     if (await allowServerTokenForAgentEndpoint(ctx, token)) {
```

#### Recent Merged Pull Requests:
- **PR #3237** (2026-09-30): chore: bump Studio and desktop to 0.7.26 with localized changelog (@EKKOLearnAI)
- **PR #3236** (2026-09-30): [codex] fix desktop theme surfaces, controls, and loading feedback (@EKKOLearnAI)
- **PR #3235** (2026-09-30): [codex] refine desktop window control placement and styling (@EKKOLearnAI)
- **PR #3234** (2026-09-30): [codex] position desktop window controls by platform (@EKKOLearnAI)
- **PR #3233** (2026-09-30): [codex] make Gateway startup opt-in and unblock page initialization (@EKKOLearnAI)
- **PR #3232** (2026-09-30): [codex] unify Studio navigation, headers and mobile layouts (@EKKOLearnAI)
- **PR #3226** (2026-09-30): [codex] record usage costs and refresh local model pricing and limits (@EKKOLearnAI)
- **PR #3222** (2026-09-29): fix(cursor): use the product logo on Agent Manager cards (@KK-Skyline)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
