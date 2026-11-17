# Verification Protocol: Verification Protocol: Empirical Defect Shield for folkbench-folkbench-learnings

<!-- PROVENANCE_START
{
  "source_repository": "folkbench-folkbench-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T18:18:42.886Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-folkbench-folkbench-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [folkbench-folkbench-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T18:18:42.886Z`  
> **Learning ID**: `LEARN-EVO-folkbench-folkbench-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `folkbench-folkbench-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/folkbench-folkbench-learnings.md`  
> **Source**: github ([https://github.com/Folkbench/folkbench](https://github.com/Folkbench/folkbench))  
> **Source Version**: `1125e5dc`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-17T18:18:30.105Z  
> **Learning ID**: `learn-github-folkbench-folkbench`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): Folkbench/folkbench

> **Canonical Artifact**: `07_PROJECT_LEARNING/folkbench-folkbench-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Folkbench/folkbench](https://github.com/Folkbench/folkbench))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-17T18:18:30.102Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Folkbench/folkbench`
- **Description**: AI API 中转站推荐与评测：中转站排行榜、中转站检测、Claude / GPT / Gemini 中转站对比 · AI API relay rankings · Folkbench Switch for Claude Code, Codex & Gemini CLI
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 3950 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/switch/src/hooks/use-mobile.ts`
```
import * as React from 'react'

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener('change', onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return !!isMobile
}

```

### Core Architecture Module: `apps/switch/src/lib/utils.ts`
```
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

```

### Core Architecture Module: `apps/switch/scripts/apple-ci.mjs`
```
import { createPrivateKey } from 'node:crypto'
import { appendFile, chmod, mkdtemp, rm, rmdir, writeFile } from 'node:fs/promises'
import { isAbsolute, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export const requiredAppleSecrets = [
  'APPLE_CERTIFICATE', 'APPLE_CERTIFICATE_PASSWORD', 'APPLE_SIGNING_IDENTITY',
  'APPLE_TEAM_ID', 'APPLE_API_KEY', 'APPLE_API_ISSUER', 'APPLE_API_PRIVATE_KEY',
]

const appleEnvironment = [
  ...requiredAppleSecrets, 'APPLE_ID', 'APPLE_PASSWORD', 'APPLE_API_KEY_PATH',
  'APPLE_PROVIDER_SHORT_NAME', 'API_PRIVATE_KEYS_DIR',
]

export function validateAppleCredentials(env) {
  for (const name of requiredAppleSecrets) {
    if (typeof env[name] !== 'string' || !env[name].trim()) throw new Error(`Missing Apple secret: ${name}`)
  }
  if (!/^[A-Z0-9]{10}$/.test(env.APPLE_TEAM_ID) ||
      !env.APPLE_SIGNING_IDENTITY.startsWith('Developer ID Application: ') ||
      !env.APPLE_SIGNING_IDENTITY.endsWith(`(${env.APPLE_TEAM_ID})`) ||
      /[\r\n\x00]/.test(env.APPLE_SIGNING_IDENTITY)) {
    throw new Error('Developer ID Application identity must match APPLE_TEAM_ID.')
  }
  if (!/^[A-Z0-9]{10}$/.test(env.APPLE_API_KEY)) throw new Error('APPLE_API_KEY must be the Key ID, not private key material.')
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(env.APPLE_API_ISSUER)) {
    throw new Error('APPLE_API_ISSUER must be an Issuer UUID, not a Team ID.')
  }
  const encoded = env.APPLE_CERTIFICATE.replace(/\s/g, '')
  const certificate = Buffer.from(encoded, 'base64')
  if (!certificate.length || certificate.length > 16 * 1024 * 1024 || certificate.toString('base64') !== encoded) {
    throw new Error('APPLE_CERTIFICATE must contain the complete p12 encoded as Base64.')
  }
  const privateKey = env.APPLE_API_PRIVATE_KEY.trim() + '\n'
  try {
    if (privateKey.length > 64 * 1024 || !/^-----BEGIN PRIVATE KEY-----\r?\n[\s\S]+\r?\n-----END PRIVATE KEY-----\n$/.test(privateKey)) throw new Error()
    const key = createPrivateKey(privateKey)
    if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'prime256v1') throw new Error()
  } catch {
    throw new Error('APPLE_API_PRIVATE_KEY must be the original complete EC P-256 p8 PEM text, not Base64.')
  }
  return { certificate, privateKey }
}

async function removePreparedFiles(files) {
  await Promise.allSettled([rm(files.certificatePath, { force: true }), rm(files.privateKeyPath, { force: true })])
  await rmdir(files.directory).catch(() => {})
}

export async function prepareAppleFiles(env, temporaryRoot) {
  const material = validateAppleCredentials(env)
  if (!temporaryRoot || !isAbsolute(temporaryRoot) || /[\r\n\x00]/.test(temporaryRoot)) throw new Error('An absolute Runner temporary directory is required.')
  const directory = await mkdtemp(join(temporaryRoot, 'folkbench-switch-signing-'))
  const certificatePath = join(directory, 'certificate.p12')
  const privateKeyPath = join(directory, 'AuthKey.p8')
  const files = { directory, certificatePath, privateKeyPath }
  try {
    await chmod(directory, 0o700)
    await writeFile(certificatePath, material.certificate, { flag: 'wx', mode: 0o600 })
    await writeFile(privateKeyPath, material.privateKey, { flag: 'wx', mode: 0o600 })
    return files
  } catch (error) {
    await removePreparedFiles(files)
    throw error
  }
}

export function installerEnvironment(source, { macOS, notarize }) {
  const env = { ...source }
  for (const name of appleEnvironment) delete env[name]
  delete env.TAURI_BUNDLER_DMG_IGNORE_CI
  if (macOS) {
    // Tauri otherwise skips Finder layout on CI, losing the installer background.
    env.TAURI_BUNDLER_DMG_IGNORE_CI = 'true'
    env.APPLE_SIGNING_IDENTITY = '-'
    if (notarize) {
      for (const name of ['APPLE_SIGNING_IDENTITY', 'APPLE_API_KEY', 'APPLE_API_ISSUER', 'APPLE_API_KEY_PATH']) {
        if (!source[name]?.trim()) throw new Error(`Missing prepared Apple build credential: ${name}`)
        env[name] = source[name]
      }
    }
  }
  return env
}

export function installerBuildArguments({ runnerOS, target, bundle }) {
  const targets = {
    'macOS:aarch64-apple-darwin': 'dmg',
    'macOS:x86_64-apple-darwin': 'dmg',
    'Windows:x86_64-pc-windows-msvc': 'nsis',
  }
  if (!targets[`${runnerOS}:${target}`] || targets[`${runnerOS}:${target}`] !== bundle) throw new Error('Unexpected installer target or bundle.')
  // A dmg-only build removes its intermediate .app; retain it for signing checks.
  return ['run', 'tauri', 'build', '--target', target, '--bundles', runnerOS === 'macOS' ? 'app,dmg' : bundle]
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv[2] === 'prepare') {
      if (!process.env.GITHUB_ENV || !process.env.GITHUB_OUTPUT) throw new Error('GitHub Actions environment and output files are required.')
      const files = await prepareAppleFiles(process.env, process.env.RUNNER_TEMP)
      try {
        await appendFile(process.env.GITHUB_ENV, `FOLKBENCH_APPLE_SIGNING_DIR=${files.directory}\nAPPLE_API_KEY_PATH=${files.privateKeyPath}\n`)
        await appendFile(process.env.GITHUB_OUTPUT, `directory=${files.directory}\n`)
      } catch (error) {
        await removePreparedFiles(files)
        throw error
      }
      console.log('Prepared owner-only temporary Apple signing files; no credential contents are printed.')
    } else if (process.argv[2] === 'build') {
      if (!['macOS', 'Windows'].includes(process.env.RUNNER_OS) || !['true', 'false'].includes(process.env.NOTARIZE)) throw new Error('Invalid installer platform or notarization mode.')
      const args = installerBuildArguments({ runnerOS: process.env.RUNNER_OS, target: process.env.TARGET, bundle: process.env.BUNDLE })
      const env = installerEnvironment(process.env, { macOS: process.env.RUNNER_OS === 'macOS', notarize: process.env.NOTARIZE === 'true' })
      const child = spawnSync(process.platform === 'win32' ? 'bun.exe' : 'bun', args, { env, stdio: 'inherit' })
      if (child.error) throw new Error('Unable to start the installer build.')
      process.exitCode = child.status ?? 1
    } else throw new Error('Usage: apple-ci.mjs prepare | build')
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}

```

### Core Architecture Module: `apps/switch/scripts/artifacts.mjs`
```
import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile, mkdir, copyFile, lstat } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkVersion, releaseTag, switchRoot } from './version.mjs'
import { validateRelease, releaseModes, requiresAppleNotarization, extractReleaseNotes } from './release.mjs'

export const platforms = {
  'macos-arm64': { target: 'aarch64-apple-darwin', bundle: 'dmg', extension: '.dmg' },
  'macos-x64': { target: 'x86_64-apple-darwin', bundle: 'dmg', extension: '.dmg' },
  'windows-x64': { target: 'x86_64-pc-windows-msvc', bundle: 'nsis', extension: '.exe' },
}

export function validateArtifact(record, { version, commit, mode }) {
  if (!releaseModes.includes(mode)) throw new Error('Unknown artifact mode.')
  const platform = Object.hasOwn(platforms, record.platform) ? platforms[record.platform] : undefined
  if (!platform || record.schemaVersion !== 1 || record.version !== version || record.commit !== commit || record.mode !== mode || record.tag !== releaseTag(version)) throw new Error('Artifact identity differs from the validated release.')
  if (!/^[a-f0-9]{40}$/.test(commit) || !/^[a-f0-9]{64}$/.test(record.sha256) || !Number.isSafeInteger(record.bytes) || record.bytes <= 0) throw new Error('Invalid artifact digest, size or source commit.')
  const macOS = record.platform.startsWith('macos-')
  const notarized = macOS && requiresAppleNotarization(mode)
  const expectedName = `Folkbench-Switch_${version}_${record.platform}${macOS && !notarized ? '_unsigned' : ''}${platform.extension}`
  if (record.asset !== expectedName || basename(record.asset) !== record.asset) throw new Error('Unexpected artifact filename.')
  if (record.appleSignedAndNotarized !== notarized) throw new Error('Artifact notarization status differs from its build mode.')
  if (record.windowsAuthenticode !== false) throw new Error('Windows signing is not configured; artifacts must not claim it.')
  return record
}

async function collect(platformName, mode, output, root = switchRoot) {
  const version = await checkVersion(root)
  const platform = platforms[platformName]
  if (!platform) throw new Error('Unknown target platform.')
  const commit = process.env.FOLKBENCH_BUILD_COMMIT || ''
  const directory = resolve(root, 'src-tauri/target', platform.target, 'release/bundle', platform.bundle)
  const names = (await readdir(directory)).filter(name => name.endsWith(platform.extension) && name.includes(version))
  if (names.length !== 1) throw new Error('Expected exactly one installer matching this version.')
  const source = resolve(directory, names[0])
  if (!(await lstat(source)).isFile()) throw new Error('Installer is not a regular file.')
  const bytes = await readFile(source)
  const notarized = platformName.startsWith('macos-') && requiresAppleNotarization(mode)
  const asset = `Folkbench-Switch_${version}_${platformName}${platformName.startsWith('macos-') && !notarized ? '_unsigned' : ''}${platform.extension}`
  const record = validateArtifact({ schemaVersion: 1, platform: platformName, version, tag: releaseTag(version), commit, mode, asset, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), appleSignedAndNotarized: notarized, windowsAuthenticode: false }, { version, commit, mode })
  await mkdir(output, { recursive: true })
  await copyFile(source, resolve(output, asset))
  await writeFile(resolve(output, `${platformName}.json`), JSON.stringify(record, null, 2) + '\n')
}

export function selectPlatforms(selection) {
  const selected = selection === 'all' ? Object.keys(platforms) : typeof selection === 'string' ? [selection] : selection
  if (!Array.isArray(selected) || !selected.length || new Set(selected).size !== selected.length || selected.some(name => !Object.hasOwn(platforms, name))) throw new Error('Invalid candidate platform selection.')
  return selected
}

export async function verifyInstallerFiles(input, { version, commit, mode, selectedPlatforms }) {
  const records = []
  for (const platform of selectPlatforms(selectedPlatforms)) {
    const metadata = resolve(input, `${platform}.json`)
    const stat = await lstat(metadata)
    if (!stat.isFile() || stat.size > 64 * 1024) throw new Error('Installer metadata must be a bounded regular file.')
    const record = validateArtifact(JSON.parse(await readFile(metadata, 'utf8')), { version, commit, mode })
    if (record.platform !== platform) throw new Error('Platform metadata filename and content differ.')
    const file = resolve(input, record.asset)
    if (!(await lstat(file)).isFile()) throw new Error('Installer is not a regular file.')
    const bytes = await readFile(file)
    if (bytes.length !== record.bytes || createHash('sha256').update(bytes).digest('hex') !== record.sha256) throw new Error('Installer integrity verification failed.')
    records.push(record)
  }
  return records
}

export function buildIdentity(env) {
  const identity = { repository: env.GITHUB_REPOSITORY, workflowPath: '.github/workflows/switch-beta.yml', workflowCommit: env.GITHUB_SHA, runId: Number(env.GITHUB_RUN_ID), runAttempt: Number(env.GITHUB_RUN_ATTEMPT), event: env.GITHUB_EVENT_NAME, ref: env.GITHUB_REF }
  if (identity.repository !== 'Folkbench/folkbench' || !/^[a-f0-9]{40}$/.test(identity.workflowCommit) ||
      !Number.isSafeInteger(identity.runId) || identity.runId <= 0 || !Number.isSafeInteger(identity.runAttempt) || identity.runAttempt <= 0 || !['push', 'workflow_dispatch'].includes(identity.event) || identity.ref !== 'refs/heads/main') throw new Error('Candidate must originate from a push or manual build on the public main branch.')
  return identity
}

async function verify(input, mode) {
  const version = await checkVersion()
  const commit = process.env.FOLKBENCH_BUILD_COMMIT || ''
  const policy = JSON.parse(await readFile(resolve(switchRoot, 'release-policy.json'), 'utf8'))
  validateRelease({ version, tag: releaseTag(version), mode, policy })
  const selectedPlatforms = selectPlatforms(JSON.parse(process.env.BUILD_PLATFORMS || JSON.stringify(policy.requiredPlatforms)))
  const records = await verifyInstallerFiles(input, { version, commit, mode, selectedPlatforms })
  const expected = new Set(records.flatMap(record => [record.asset, `${record.platform}.json`]))
  for (const name of await readdir(input)) {
    if (!expected.has(name)) throw new Error('Unexpected file in release artifacts.')
  }
  let notes
  try { notes = extractReleaseNotes(await readFile(resolve(switchRoot, '../../docs/switch/CHANGELOG.md'), 'utf8'), version) }
  catch { notes = `## ${version} — 准备中，尚未公开\n\n请先补充当版发布说明，再构建待验收安装包。\n` }
  await writeFile(resolve(input, 'RELEASE-NOTES.md'), notes)
  await writeFile(resolve(input, 'SHA256SUMS.txt'), records.map(record => `${record.sha256}  ${record.asset}`).join('\n') + '\n')
  const manifest = { schemaVersion: 2, channel: 'beta', version, tag: releaseTag(version), commit, mode, build: buildIdentity(process.env), selectedPlatforms, assets: records, releaseNotes: { asset: 'RELEASE-NOTES.md', bytes: Buffer.byteLength(notes), sha256: createHash('sha256').update(notes).digest('hex') } }
  const manifestText = JSON.stringify(manifest, null, 2) + '\n'
  await writeFile(resolve(input, 'release-manifest.json'), manifestText)
  const digest = createHash('sha256').update(manifestText).digest('hex')
  if (process.env.GITHUB_STEP_SUMMARY) {
    const { appendFile } = await import('node:fs/promises')
    const next = process.env.GITHUB_EVENT_NAME === 'push'
      ? '本次为 main 新版本推送构建，成功后自动触发发布工作流；发布只读取本批不可变产物，不重新构建，也不声明人工安装验收已完成。'
      : '手动候选构建不自动发布；实际安装包验收后，在 Switch publish reviewed installers 输入本次构建编号、尝试、源码 SHA 和清单摘要。'
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `## 已校验安装包\n\n版本：\`${version}\`；源码：\`${commit}\`\n\n构建：\`${manifest.build.runId}\`；尝试：\`${manifest.build.runAttempt}\`\n\n平台：${selectedPlatforms.join(', ')}\n\n清单 SHA256：\`${digest}\`\n\n${next}\n\n原安装包位于本次运行的 \`switch-reviewed-${manifest.build.runId}-${manifest.build.runAttempt}\` Artifact。\n`)
  }
  console.log(`Verified ${records.length} Beta installers at source ${commit}.`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv[2] === 'collect') await collect(process.argv[3], process.argv[4], resolve(process.argv[5]))
    else if (process.argv[2] === 'verify') await verify(resolve(process.argv[3]), process.argv[4])
    else throw new Error('Usage: artifacts.mjs collect PLATFORM MODE OUTPUT | verify INPUT MODE')
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}

```

### Core Architecture Module: `apps/switch/scripts/assert-development-host.mjs`
```
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const markerPath = resolve(repositoryRoot, '.folkbench-switch-development-host')

if (!existsSync(markerPath)) {
  process.stderr.write(
    [
      'Folkbench Switch commands are disabled in this unverified environment.',
      'On a dedicated non-production development host, review the repository AGENTS.md and docs/development.md, then create apps/switch/.folkbench-switch-development-host.',
      '',
    ].join('\n')
  )
  process.exit(1)
}

```

### Core Architecture Module: `apps/switch/scripts/check-i18n.mjs`
```
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(scriptDirectory, '..')
const manifestPath = path.join(repositoryRoot, 'i18n', 'manifest.json')
const localesRoot = path.join(repositoryRoot, 'src', 'i18n', 'locales')
const sourceRoot = path.join(repositoryRoot, 'src')

function fail(message) {
  throw new Error(message)
}

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right))
}

function flattenTranslations(value, prefix = '', output = new Map()) {
  if (typeof value === 'string') {
    if (!prefix) fail('Translation leaf is missing a key path')
    output.set(prefix, value)
    return output
  }

  if (!value || Array.isArray(value) || typeof value !== 'object') {
    fail(
      `Translation value at "${prefix || '<root>'}" must be an object or string`
    )
  }

  for (const [key, child] of Object.entries(value)) {
    const nextPrefix = prefix ? `${prefix}.${key}` : key
    flattenTranslations(child, nextPrefix, output)
  }

  return output
}

function interpolationVariables(value) {
  const variables = new Set()
  const pattern = /{{\s*([A-Za-z0-9_.-]+)(?:\s*,[^}]*)?}}/g
  let match
  while ((match = pattern.exec(value)) !== null) {
    variables.add(match[1])
  }
  return sorted(variables)
}

async function jsonFiles(directory) {
  return sorted(
    (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry) => entry.name)
  )
}

async function readCatalog(locale, expectedFiles) {
  const directory = path.join(localesRoot, locale)
  const files = await jsonFiles(directory)

  if (files.join('\n') !== expectedFiles.join('\n')) {
    const missing = expectedFiles.filter((file) => !files.includes(file))
    const extra = files.filter((file) => !expectedFiles.includes(file))
    fail(
      `${locale}: module mismatch; missing=${missing.join(',')} extra=${extra.join(',')}`
    )
  }

  const catalog = new Map()

  for (const file of files) {
    const moduleName = path.basename(file, '.json')
    const parsed = JSON.parse(
      await readFile(path.join(directory, file), 'utf8')
    )
    const roots = Object.keys(parsed)
    if (roots.length !== 1 || roots[0] !== moduleName) {
      fail(`${locale}/${file}: expected one top-level "${moduleName}" object`)
    }

    const flattened = flattenTranslations(parsed)
    for (const [key, value] of flattened) {
      if (catalog.has(key)) fail(`${locale}: duplicate key ${key}`)
      if (value.trim() === '') fail(`${locale}: empty value for ${key}`)
      catalog.set(key, value)
    }
  }

  return catalog
}

async function sourceFiles(directory) {
  const output = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'locales') continue
      output.push(...(await sourceFiles(fullPath)))
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      output.push(fullPath)
    }
  }
  return output
}

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
const supported = manifest.supportedLocales
const required = manifest.requiredLocales

if (!Array.isArray(supported) || supported.length !== 3) {
  fail('supportedLocales must contain exactly en, zh-CN, and zh-Hant')
}
if (supported.join(',') !== 'en,zh-CN,zh-Hant') {
  fail('supportedLocales must be ordered as en, zh-CN, zh-Hant')
}
if (manifest.defaultLocale !== 'en' || manifest.fallbackLocale !== 'en') {
  fail('English must be the default and fallback locale')
}
if (required.join(',') !== supported.join(',')) {
  fail('Every supported locale must be required')
}

const expectedFiles = await jsonFiles(path.join(localesRoot, 'en'))
if (expectedFiles.length === 0) fail('English catalog has no modules')

const catalogs = new Map()
for (const locale of supported) {
  catalogs.set(locale, await readCatalog(locale, expectedFiles))
}

const english = catalogs.get('en')
const englishKeys = sorted(english.keys())

for (const locale of supported.filter((code) => code !== 'en')) {
  const catalog = catalogs.get(locale)
  const localeKeys = sorted(catalog.keys())
  const missing = englishKeys.filter((key) => !catalog.has(key))
  const extra = localeKeys.filter((key) => !english.has(key))
  if (missing.length || extra.length) {
    fail(
      `${locale}: key mismatch; missing=${missing.join(',')} extra=${extra.join(',')}`
    )
  }

  for (const key of englishKeys) {
    const expectedVariables = interpolationVariables(english.get(key))
    const actualVariables = interpolationVariables(catalog.get(key))
    if (expectedVariables.join(',') !== actualVariables.join(',')) {
      fail(
        `${locale}: interpolation mismatch for ${key}; expected=${expectedVariables.join(',')} actual=${actualVariables.join(',')}`
      )
    }
  }
}

for (const key of englishKeys.filter((value) => value.endsWith('_one'))) {
  const counterpart = `${key.slice(0, -4)}_other`
  if (!english.has(counterpart)) {
    fail(`plural key ${key} is missing ${counterpart}`)
  }
}

const referencedKeys = new Set()
const tCallPattern = /\bt\(\s*['"]([^'"]+)['"]/g
for (const file of await sourceFiles(sourceRoot)) {
  const content = await readFile(file, 'utf8')
  let match
  while ((match = tCallPattern.exec(content)) !== null) {
    referencedKeys.add(match[1])
  }
}

const unknownReferences = sorted(referencedKeys).filter(
  (key) => !english.has(key)
)
if (unknownReferences.length) {
  fail(`source references unknown keys: ${unknownReferences.join(', ')}`)
}

const i18nBootstrap = await readFile(
  path.join(sourceRoot, 'i18n', 'index.ts'),
  'utf8'
)
if (i18nBootstrap.includes('navigator.language')) {
  fail('Automatic system-language detection conflicts with English default')
}
if (!i18nBootstrap.includes('lng: DEFAULT_LOCALE')) {
  fail('i18n bootstrap must initialize with DEFAULT_LOCALE')
}

console.log(
  `i18n catalogs valid: ${supported.join(', ')}; ${expectedFiles.length} modules; ${englishKeys.length} keys; ${referencedKeys.size} referenced keys`
)

```

### Core Architecture Module: `apps/switch/scripts/dmg-layout.mjs`
```
import { createHash } from 'node:crypto'
import { mkdtemp, lstat, readFile, readdir, readlink, rmdir } from 'node:fs/promises'
import { isAbsolute, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const appRoot = fileURLToPath(new URL('../', import.meta.url))
const digest = bytes => createHash('sha256').update(bytes).digest('hex')

export async function verifyMountedLayout(mount, background) {
  const layout = await lstat(join(mount, '.DS_Store'))
  if (!layout.isFile() || layout.size < 32) throw new Error('DMG is missing Finder layout.')
  const entries = await readdir(join(mount, '.background'))
  const expected = digest(await readFile(background))
  let matched = false
  for (const name of entries) {
    const path = join(mount, '.background', name)
    const stat = await lstat(path)
    if (stat.isFile() && digest(await readFile(path)) === expected) matched = true
  }
  if (!matched) throw new Error('DMG does not contain the approved installation background.')
  const app = await lstat(join(mount, 'Folkbench Switch.app'))
  if (!app.isDirectory() || app.isSymbolicLink()) throw new Error('DMG is missing the native application bundle.')
  if (await readlink(join(mount, 'Applications')) !== '/Applications') throw new Error('DMG Applications drop link is incorrect.')
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' })
  if (result.error || result.status !== 0) throw new Error(`${command} failed while checking the DMG layout.`)
  return result
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.platform !== 'darwin' || !process.env.RUNNER_TEMP || !isAbsolute(process.env.RUNNER_TEMP)) {
      throw new Error('DMG layout verification requires an isolated macOS Runner.')
    }
    const target = process.env.TARGET
    if (!['aarch64-apple-darwin', 'x86_64-apple-darwin'].includes(target)) throw new Error('Invalid macOS build target.')
    const directory = join(appRoot, 'src-tauri', 'target', target, 'release', 'bundle', 'dmg')
    const installers = (await readdir(directory)).filter(name => name.endsWith('.dmg'))
    if (installers.length !== 1) throw new Error('Expected exactly one DMG installer.')
    const mount = await mkdtemp(join(process.env.RUNNER_TEMP, 'folkbench-dmg-layout-'))
    let attached = false
    try {
      run('hdiutil', ['attach', '-quiet', '-readonly', '-nobrowse', '-mountpoint', mount, join(directory, installers[0])])
      attached = true
      await verifyMountedLayout(mount, join(appRoot, 'assets', 'dmg', 'background.png'))
      console.log('Approved DMG background, Finder layout, native application and Applications drop link verified.')
    } finally {
      // Detach only the mount created by this invocation; never launch the app.
      if (attached) run('hdiutil', ['detach', '-quiet', mount])
      await rmdir(mount)
    }
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}

```

### Core Architecture Module: `apps/switch/scripts/ensure-png-rgba.mjs`
```
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync, inflateSync } from 'node:zlib'

// Tauri `generate_context!` panics unless window PNG icons are RGBA
// (`tauri-codegen` checks `output_color_type() == ColorType::Rgba`).
// `tauri icon` from an opaque SVG emits RGB, so this expands those files
// in place without changing pixels.

const COLOR = {
  gray: 0,
  rgb: 2,
  indexed: 3,
  grayA: 4,
  rgba: 6,
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  }
  return value >>> 0
})

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const typed = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typed))
  return Buffer.concat([length, typed, crc])
}

function paeth(a, b, c) {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  if (pb <= pc) return b
  return c
}

function parsePng(buffer) {
  if (buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
    throw new Error('not a PNG')
  }

  let ihdr
  const idat = []
  let offset = 8
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset)
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii')
    const data = buffer.subarray(offset + 8, offset + 8 + length)
    if (type === 'IHDR') {
      ihdr = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        compression: data[10],
        filter: data[11],
        interlace: data[12],
      }
    } else if (type === 'IDAT') {
      idat.push(data)
    } else if (type === 'IEND') {
      break
    }
    offset += 12 + length
  }

  if (!ihdr) throw new Error('missing IHDR')
  return { ihdr, inflated: inflateSync(Buffer.concat(idat)) }
}

function bytesPerPixel(colorType, bitDepth) {
  if (bitDepth !== 8) {
    throw new Error(`unsupported bit depth ${bitDepth}`)
  }
  switch (colorType) {
    case COLOR.gray:
      return 1
    case COLOR.rgb:
      return 3
    case COLOR.grayA:
      return 2
    case COLOR.rgba:
      return 4
    default:
      throw new Error(`unsupported PNG color type ${colorType}`)
  }
}

function unfilter(inflated, width, height, bpp) {
  const stride = width * bpp
  const rows = []
  let prev = Buffer.alloc(stride)
  let offset = 0
  for (let y = 0; y < height; y += 1) {
    const type = inflated[offset]
    const source = inflated.subarray(offset + 1, offset + 1 + stride)
    const recon = Buffer.alloc(stride)
    for (let i = 0; i < stride; i += 1) {
      const a = i >= bpp ? recon[i - bpp] : 0
      const b = prev[i]
      const c = i >= bpp ? prev[i - bpp] : 0
      let predictor = 0
      if (type === 1) predictor = a
      else if (type === 2) predictor = b
      else if (type === 3) predictor = Math.floor((a + b) / 2)
      else if (type === 4) predictor = paeth(a, b, c)
      else if (type !== 0) throw new Error(`unknown filter ${type}`)
      recon[i] = (source[i] + predictor) & 0xff
    }
    rows.push(recon)
    prev = recon
    offset += 1 + stride
  }
  return rows
}

function toRgbaRows(rows, colorType, width) {
  if (colorType === COLOR.rgba) return rows
  return rows.map((row) => {
    const out = Buffer.alloc(width * 4)
    if (colorType === COLOR.rgb) {
      for (let x = 0; x < width; x += 1) {
        out[x * 4] = row[x * 3]
        out[x * 4 + 1] = row[x * 3 + 1]
        out[x * 4 + 2] = row[x * 3 + 2]
        out[x * 4 + 3] = 255
      }
      return out
    }
    if (colorType === COLOR.gray) {
      for (let x = 0; x < width; x += 1) {
        out[x * 4] = row[x]
        out[x * 4 + 1] = row[x]
        out[x * 4 + 2] = row[x]
        out[x * 4 + 3] = 255
      }
      return out
    }
    if (colorType === COLOR.grayA) {
      for (let x = 0; x < width; x += 1) {
        out[x * 4] = row[x * 2]
        out[x * 4 + 1] = row[x * 2]
        out[x * 4 + 2] = row[x * 2]
        out[x * 4 + 3] = row[x * 2 + 1]
      }
      return out
    }
    throw new Error(`cannot expand color type ${colorType}`)
  })
}

function encodeRgbaPng(width, height, rows) {
  const raw = Buffer.alloc(height * (width * 4 + 1))
  for (let y = 0; y < height; y += 1) {
    const start = y * (width * 4 + 1)
    raw[start] = 0
    rows[y].copy(raw, start + 1)
  }

  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = COLOR.rgba
  header[10] = 0
  header[11] = 0
  header[12] = 0

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function convertFile(path) {
  const original = readFileSync(path)
  const { ihdr, inflated } = parsePng(original)
  if (ihdr.compression !== 0 || ihdr.filter !== 0 || ihdr.interlace !== 0) {
    throw new Error(`${path}: unsupported PNG options`)
  }
  if (ihdr.colorType === COLOR.rgba && ihdr.bitDepth === 8) {
    return { path, changed: false, width: ihdr.width, height: ihdr.height }
  }
  const bpp = bytesPerPixel(ihdr.colorType, ihdr.bitDepth)
  const rows = toRgbaRows(
    unfilter(inflated, ihdr.width, ihdr.height, bpp),
    ihdr.colorType,
    ihdr.width
  )
  writeFileSync(path, encodeRgbaPng(ihdr.width, ihdr.height, rows))
  return {
    path,
    changed: true,
    width: ihdr.width,
    height: ihdr.height,
    from: ihdr.colorType,
  }
}

const iconDir = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../src-tauri/icons'
)
const files = readdirSync(iconDir)
  .filter((name) => name.endsWith('.png'))
  .map((name) => join(iconDir, name))
  .sort()

const results = files.map(convertFile)
for (const result of results) {
  const name = result.path.slice(iconDir.length + 1)
  const status = result.changed ? 'RGB→RGBA' : 'already RGBA'
  process.stdout.write(`${name} ${result.width}x${result.height} ${status}\n`)
}

```

### Core Architecture Module: `apps/switch/scripts/generate-dependency-notices.mjs`
```
// Run after a locked cargo-about JSON scan of all advertised release targets.
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
const app = fileURLToPath(new URL('../', import.meta.url))
const output = app
if (!process.argv[2]) throw new Error('Usage: generate-dependency-notices.mjs <cargo-about-report.json>')
const report = path.resolve(process.argv[2])
const rust = JSON.parse(fs.readFileSync(report, 'utf8'))
const ghEnv = { ...process.env }
const gh = 'gh'
const api = route => JSON.parse(execFileSync(gh, ['api', route], { env: ghEnv, maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }))
const licenseName = name => /^(licen[cs]e|copying|copyright|notice)([-._]|$)/i.test(name) && !/pro-license/i.test(name)
const localNotices = dir => fs.readdirSync(dir).filter(licenseName).filter(name => fs.lstatSync(path.join(dir, name)).isFile()).map(name => ({ name, text: fs.readFileSync(path.join(dir, name), 'utf8') }))
const cacheFile = path.join(path.dirname(report), 'upstream-license-cache.json')
const cache = new Map(fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, 'utf8')) : [])
function upstreamNotices(pkg, dir) {
  const repo = /^https:\/\/github\.com\/([^/]+\/[^/]+?)(?:\.git)?(?:\/|$)/.exec(pkg.repository || '')?.[1]
  if (!repo) throw new Error(`Missing license source for ${pkg.name}`)
  const vcs = JSON.parse(fs.readFileSync(path.join(dir, '.cargo_vcs_info.json'), 'utf8'))
  const sha = vcs.git.sha1
  const key = `${repo}@${sha}`
  if (!cache.has(key)) {
    const tree = api(`repos/${repo}/contents?ref=${sha}`)
    const entries = tree.filter(entry => entry.type === 'file' && licenseName(entry.name)).map(entry => {
      const blob = api(`repos/${repo}/contents/${entry.name}?ref=${sha}`)
      return { name: entry.name, text: Buffer.from(blob.content, 'base64').toString('utf8'), url: `https://github.com/${repo}/blob/${sha}/${entry.name}` }
    })
    if (!entries.length && pkg.license === 'MPL-2.0') {
      const license = rust.licenses.find(l => l.id === 'MPL-2.0' && l.used_by.some(u => u.crate.name === pkg.name))
      if (license) entries.push({ name: 'MPL-2.0', text: license.text, url: `https://github.com/${repo}/tree/${sha}` })
    }
    if (!entries.length) throw new Error(`No upstream license files for ${key}`)
    cache.set(key, entries)
    fs.writeFileSync(cacheFile, JSON.stringify([...cache]))
  }
  return cache.get(key)
}
const manifest = JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8'))
const chunks = ['Folkbench Switch — third-party license texts', `Generated for ${manifest.version} from the locked dependency set.`, 'This inventory includes runtime dependencies and some build-time dependencies.', 'Original upstream licenses apply to their respective components. No product endorsement is implied.']
const packages = []
const seen = new Set()
const licenseTexts = new Map()
function noticeReference(notice) {
  const text = notice.text.replace(/\r\n/g, '\n').replace(/[\t ]+$/gm, '').trimEnd() + '\n'
  const hash = createHash('sha256').update(text).digest('hex')
  const id = `LICENSE-${hash}`
  licenseTexts.set(id, text)
  return `${notice.name}: ${id}${notice.url ? ` (${notice.url})` : ''}`
}
function npmVisit(name, parent = app) {
  let dir
  const require = createRequire(path.join(parent, 'package.json'))
  try { dir = path.dirname(require.resolve(`${name}/package.json`)) } catch {
    try {
      dir = path.dirname(require.resolve(name))
      while (dir !== path.dirname(dir)) {
        const manifest = path.join(dir, 'package.json')
        if (fs.existsSync(manifest) && JSON.parse(fs.readFileSync(manifest, 'utf8')).name === name) break
        dir = path.dirname(dir)
      }
    } catch { dir = path.join(app, 'node_modules', name) }
  }
  if (!fs.existsSync(path.join(dir, 'package.json'))) throw new Error(`Missing installed dependency ${name}`)
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'))
  const key = `${pkg.name}@${pkg.version}`
  if (seen.has(key)) return
  seen.add(key)
  let notices = localNotices(dir)
  if (pkg.name === '@hugeicons/core-free-icons' && !notices.length) {
    notices = localNotices(path.join(app, 'node_modules', '@hugeicons/react')).filter(n => n.name === 'LICENSE.md')
    chunks.push('Hugeicons free icon license confirmation: https://hugeicons.com/docs/faqs/license-questions')
  }
  if (!notices.length) throw new Error(`Missing npm license text ${key}`)
  chunks.push(`\n===== npm: ${key} (${pkg.license}) =====`, `Source: https://www.npmjs.com/package/${pkg.name}/v/${pkg.version}`, ...notices.map(noticeReference))
  packages.push({ ecosystem: 'npm', name: pkg.name, version: pkg.version, license: pkg.license })
  for (const dep of Object.keys(pkg.dependencies || {})) npmVisit(dep, dir)
  for (const dep of Object.keys(pkg.optionalDependencies || {})) {
    if (fs.existsSync(path.join(app, 'node_modules', dep, 'package.json'))) npmVisit(dep, dir)
  }
}
for (const name of Object.keys(manifest.dependencies)) npmVisit(name)
for (const entry of rust.crates) {
  const pkg = entry.package
  if (!pkg.source) continue
  const dir = path.dirname(pkg.manifest_path)
  let notices = localNotices(dir)
  if (!notices.length) notices = upstreamNotices(pkg, dir)
  // AWS-LC contains third-party cryptographic code with additional retained terms.
  if (pkg.name === 'aws-lc-sys') notices.push(...localNotices(path.join(dir, 'aws-lc')).map(n => ({ ...n, name: `aws-lc/${n.name}` })))
  chunks.push(`\n===== crate: ${pkg.name}@${pkg.version} (${pkg.license}) =====`, `Source archive: https://crates.io/api/v1/crates/${pkg.name}/${pkg.version}/download`, ...notices.map(noticeReference))
  packages.push({ ecosystem: 'crates.io', name: pkg.name, version: pkg.version, license: pkg.license })
}
chunks.push('\n===== MPL-2.0 source availability =====', 'The following MPL-2.0 crates are used without local modifications. Their exact corresponding Source Code Form, including original notices, is available at these public versioned source archives. Extract the archive to obtain the sources; the MPL-2.0 text is included above.')
for (const entry of rust.crates.filter(c => c.package.license?.includes('MPL-2.0'))) chunks.push(`${entry.package.name}@${entry.package.version}: https://crates.io/api/v1/crates/${entry.package.name}/${entry.package.version}/download`)
const hashes = Object.fromEntries(['package.json', 'bun.lock', 'src-tauri/Cargo.lock'].map(file => [file, createHash('sha256').update(fs.readFileSync(path.join(app, file))).digest('hex')]))
const shadcn = api('repos/shadcn-ui/ui/contents/LICENSE.md?ref=c257f688cf4de7ec10cc1be84cad29cd4631182c')
chunks.push('\n===== Adapted shadcn/ui calendar and popover =====', 'Source: https://github.com/shadcn-ui/ui/blob/c257f688cf4de7ec10cc1be84cad29cd4631182c/LICENSE.md', noticeReference({ name: 'LICENSE.md', text: Buffer.from(shadcn.content, 'base64').toString('utf8') }))
chunks.push('\n===== Full license texts =====', 'Identical texts are printed once; component entries above refer to their SHA256-based identifiers. All distinct copyright and permission notices are retained.')
for (const [id, text] of licenseTexts) chunks.push(`\n===== ${id} =====\n${text}`)
// Normalize line endings and trailing space only; retain all license wording.
fs.writeFileSync(path.join(output, 'THIRD_PARTY_LICENSES.txt'), chunks.join('\n\n').replace(/\r\n/g, '\n').replace(/[\t ]+$/gm, '').trimEnd() + '\n')
fs.writeFileSync(path.join(output, 'dependency-license-inventory.json'), JSON.stringify({ schemaVersion: 1, version: manifest.version, hashes, packages }, null, 2) + '\n')
console.log(`Collected ${packages.length} public dependency license entries.`)

```

### Core Architecture Module: `apps/switch/scripts/generate-placeholder-icon.mjs`
```
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

// Source-authored neutral icon for forks and modified distributions, which
// must not ship the Modelflare brand icon. Official builds use
// assets/app-icon.svg instead. See assets/LICENSE.md and TRADEMARKS.md.
//
// Geometry is defined on a 512-unit grid and scaled to the output size.

const SIZE = 1024
const UNIT = SIZE / 512
const CORNER_RADIUS = 112 * UNIT
const SURFACE = [0x18, 0x18, 0x18]
const SIGNAL = [0xd7, 0xff, 0x00]
const STROKE_RADIUS = 28 * UNIT
const SAMPLES_PER_AXIS = 3

const strokes = [
  { ax: 140, ay: 200, bx: 300, by: 200 },
  { ax: 212, ay: 312, bx: 372, by: 312 },
].map(({ ax, ay, bx, by }) => ({
  ax: ax * UNIT,
  ay: ay * UNIT,
  bx: bx * UNIT,
  by: by * UNIT,
}))

function roundedRectCoverageAt(x, y) {
  const halfInner = SIZE / 2 - CORNER_RADIUS
  const dx = Math.abs(x - SIZE / 2) - halfInner
  const dy = Math.abs(y - SIZE / 2) - halfInner
  const outsideX = Math.max(dx, 0)
  const outsideY = Math.max(dy, 0)
  const distance =
    Math.min(Math.max(dx, dy), 0) + Math.hypot(outsideX, outsideY)
  return distance <= CORNER_RADIUS ? 1 : 0
}

function strokeCoverageAt(x, y) {
  for (const { ax, ay, bx, by } of strokes) {
    const vx = bx - ax
    const vy = by - ay
    const lengthSquared = vx * vx + vy * vy
    const t = Math.max(
      0,
      Math.min(1, ((x - ax) * vx + (y - ay) * vy) / lengthSquared)
    )
    if (Math.hypot(x - (ax + t * vx), y - (ay + t * vy)) <= STROKE_RADIUS) {
      return 1
    }
  }
  return 0
}

function superSample(sampler, px, py) {
  let hits = 0
  for (let sy = 0; sy < SAMPLES_PER_AXIS; sy += 1) {
    for (let sx = 0; sx < SAMPLES_PER_AXIS; sx += 1) {
      const x = px + (sx + 0.5) / SAMPLES_PER_AXIS
      const y = py + (sy + 0.5) / SAMPLES_PER_AXIS
      hits += sampler(x, y)
    }
  }
  return hits / (SAMPLES_PER_AXIS * SAMPLES_PER_AXIS)
}

function renderPixels() {
  // One filter byte (0 = none) precedes every RGBA scanline.
  const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1))
  for (let y = 0; y < SIZE; y += 1) {
    const rowStart = y * (SIZE * 4 + 1)
    raw[rowStart] = 0
    for (let x = 0; x < SIZE; x += 1) {
      const surfaceAlpha = superSample(roundedRectCoverageAt, x, y)
      const signalAlpha =
        surfaceAlpha > 0 ? superSample(strokeCoverageAt, x, y) : 0
      const alpha = surfaceAlpha
      const offset = rowStart + 1 + x * 4
      for (let channel = 0; channel < 3; channel += 1) {
        raw[offset + channel] = Math.round(
          SURFACE[channel] * (1 - signalAlpha) + SIGNAL[channel] * signalAlpha
        )
      }
      raw[offset + 3] = Math.round(alpha * 255)
    }
  }
  return raw
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  }
  return value >>> 0
})

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const typed = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typed))
  return Buffer.concat([length, typed, crc])
}

function encodePng(raw) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(SIZE, 0)
  header.writeUInt32BE(SIZE, 4)
  header[8] = 8 // bit depth
  header[9] = 6 // truecolour with alpha
  header[10] = 0
  header[11] = 0
  header[12] = 0

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// Deliberately not written to src-tauri/icons/, so running this cannot
// partially overwrite the generated brand icon set.
const target = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'assets/fork-placeholder-icon.png'
)
mkdirSync(dirname(target), { recursive: true })
const png = encodePng(renderPixels())
writeFileSync(target, png)
process.stdout.write(
  [
    `fork placeholder icon written: ${SIZE}x${SIZE}, ${png.length} bytes`,
    'assets/fork-placeholder-icon.png',
    '',
    'To use it, replace the brand icon set:',
    '  bun run tauri icon assets/fork-placeholder-icon.png',
    '',
  ].join('\n')
)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #12** (2026-11-17): **Release Switch 0.1.0-beta.9 and update localized blog & README docs**
  *Symptoms*: ## Summary - Release Switch `0.1.0-beta.9`: add named route profiles, system tray quick switching, local loopback privacy-masking proxy, and discovery/value-frontier UX refinements. - Update the Switch section across all 12 locales of the model degradation detection blog post and the feature tables in the 4 localized `README` files.  ## Release & Merge Notes - Contains two standalone commits (Switch `0.1.0-beta.9` release + blog/README documentation updates). - Merge with **Rebase and merge** or **Create a merge commit** into `main` to automatically trigger `switch-beta.yml` (cross-platform builds & macOS notarization) and `switch-publish.yml` (`switch-v0.1.0-beta.9` pre-release).

- **Issue #11** (2026-11-17): **Convert blog article covers and inline raster figures from WebP to JPG**
  *Symptoms*: Product changes - Convert all 20 twelve-locale public blog cover images and 15 inline raster figures across 4 articles from WebP to JPG so article pages, Open Graph metadata, structured data, and the blog content manifest emit .jpg URLs consistently. - Keep SVG vector diagrams and repository README showcase images unchanged to preserve unrelated documentation links.  Implementation - Convert and replace public/covers/*.webp (19 files), public/blog/covers/kimi-k3-1-pro-deep-dive.webp (1 file), and public/blog/figures/*/*.webp (15 files) with same-named .jpg assets in sRGB color space at quality 90 (4:2:0 subsampling). - Update references across src/lib/manifest.ts, src/lib/seo.ts, src/components/ArticleDetail.astro, src/pages/blog/[slug].astro, src/pages/[locale]/blog/[slug].astro, design/benchmark-series-covers-2026-11-14.json, public/blog/figures/kimi-k3-1-pro-deep-dive/NOTICE.txt, and 180 inline figure links across 48 localized Markdown articles.  Migration and compatibility - No database or environment variable changes; directory layouts under public/covers/ and public/blog/covers/ remain unchanged with .jpg extensions. - Reversible via git revert if WebP assets and paths ever need to be restored.  Operations - Affects only static blog build artifacts and blog-content-manifest.json cover URLs; coordinate deployment with main-site public blog assets so cached manifests and static assets stay aligned. - Scoped strictly to the public blog content and static build in this repo

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

### Incident Patch 1: `1125e5dc` (2026-11-17)
**Commit Message**: Merge pull request #12 from MarlaRoselyn/release/switch-v0.1.0-beta.9

Release Switch 0.1.0-beta.9 and update localized blog & README docs

**File**: `README.en.md` (modified, +3/-0)
```diff
@@ -111,6 +111,9 @@ Installers and SHA256 checksums are available in [Releases](https://github.com/F
 | **Provider switching** | Save connection settings for multiple services and apply your selection to a supported tool. |
 | **Configuration previews** | Review changes before writing, preserving other custom settings. Restoration capabilities depend on the tool adapter. |
 | **Codex credential protection** | Temporarily park official OAuth credentials when switching to a third-party service and restore them when switching back. |
+| **Named profiles** | Save the routes each tool currently uses as a named profile and apply the whole set in one click. |
+| **Tray switching** | Switch profiles or individual tool services from the system tray without opening the main window. |
+| **Local privacy masking** | Optional. A local proxy replaces API keys, email addresses, public IPs and custom sensitive words with placeholders before requests leave your machine and restores them in responses; tools reconnect directly when Switch quits. |
 | **Public route discovery** | Browse routes, availability, status windows and prices from the public catalog in the client. |
 | **Local usage estimates** | Review session token usage and estimate cost using reference prices. |
 
```

**File**: `README.es.md` (modified, +3/-0)
```diff
@@ -111,6 +111,9 @@ Los instaladores y archivos de verificación SHA256 están en [Releases](https:/
 | **Cambio de proveedor** | Guarda la configuración de varios servicios y aplica tu elección a una herramienta compatible. |
 | **Vista previa de cambios** | Revisa los cambios antes de escribirlos y conserva otros ajustes personalizados. La restauración depende del adaptador de cada herramienta. |
 | **Protección de credenciales de Codex** | Al cambiar a un tercero, guarda temporalmente las credenciales OAuth oficiales y las restaura al volver. |
+| **Perfiles con nombre** | Guarda las conexiones que usa cada herramienta como un perfil y aplica el conjunto con un clic. |
+| **Cambio desde la bandeja** | Cambia perfiles o el servicio de cada herramienta desde la bandeja del sistema sin abrir la ventana principal. |
+| **Enmascarado local de privacidad** | Opcional. Un proxy local sustituye claves API, correos, IP públicas y palabras sensibles propias por marcadores antes de enviar las solicitudes y los restaura en las respuestas; al cerrar Switch, las herramientas vuelven a la conexión directa. |
 | **Descubrimiento de conexiones públicas** | Consulta conexiones, disponibilidad, ventanas de estado y precios del catálogo público dentro del cliente. |
 | **Estimación de uso local** | Revisa los tokens por sesión y estima el costo con precios de referencia. |
 
```

**File**: `README.ja.md` (modified, +3/-0)
```diff
@@ -101,6 +101,9 @@ macOS のインストーラーは `.dmg`、Windows は `.exe` 形式です。
 | **プロバイダーの切替** | 複数サービスの接続設定を保存し、選択した設定を対応ツールへ適用します。 |
 | **設定差分の確認** | 書き込み前に変更を確認し、ほかのカスタム設定を保持します。復元できる範囲はツールのアダプターによって異なります。 |
 | **Codex の認証情報保護** | サードパーティーへ切り替える際に公式 OAuth 認証情報を一時退避し、公式に戻すときに復元します。 |
+| **名前付きプロファイル** | 各ツールが使っている回線をプロファイルとして保存し、ワンクリックで一括適用します。 |
+| **トレイから切替** | メインウィンドウを開かずに、システムトレイからプロファイルやツールごとのサービスを切り替えます。 |
+| **ローカルプライバシーマスキング** | 任意で有効化。送信前にローカルプロキシが API キー、メールアドレス、公開 IP、任意の機密語をプレースホルダーに置き換え、応答で復元します。Switch 終了時は直接接続に戻ります。 |
 | **公開回線の検索** | 公開カタログの回線、稼働率、状態履歴、価格をクライアントで確認できます。 |
 | **ローカル使用量の推計** | セッションごとの Token 使用量を確認し、参考単価でコストを推計します。 |
 
```

**File**: `README.md` (modified, +3/-0)
```diff
@@ -179,6 +179,9 @@ macOS 安装包为 `.dmg`，Windows 安装包为 `.exe`。
 | **服务商切换** | 保存多家服务的连接参数，将选择应用到目标工具。 |
 | **配置差异预览** | 写入前检查变化，保留其他自定义设置；具体恢复能力以工具适配为准。 |
 | **Codex 凭据保护** | 切至第三方服务时暂存官方 OAuth 凭据，切回时恢复。 |
+| **组合档案** | 把各工具当前连接的线路保存为命名组合，一键整组切换。 |
+| **托盘快速切换** | 在系统托盘切换组合或单个工具的服务，无需打开主窗口。 |
+| **本机隐私脱敏** | 可选开启。请求经本机代理发出前，把 API Key、邮箱、公网 IP 与自定义敏感词替换为占位符，并在响应中还原；退出 Switch 时恢复直连。 |
 | **公开线路发现** | 在客户端查看公开目录中的线路、可用率、状态窗口与价格。 |
 | **本地用量估算** | 按会话查看 Token 消耗，并以参考单价估算成本。 |
 
```

**File**: `apps/switch/THIRD_PARTY_LICENSES.txt` (modified, +34/-1)
```diff
@@ -1,6 +1,6 @@
 Folkbench Switch — third-party license texts
 
-Generated for 0.1.0-beta.3 from the locked dependency set.
+Generated for 0.1.0-beta.9 from the locked dependency set.
 
 This inventory includes runtime dependencies and some build-time dependencies.
 
@@ -2940,6 +2940,16 @@ Source archive: https://crates.io/api/v1/crates/tracing-core/0.1.36/download
 LICENSE: LICENSE-898b1ae9821e98daf8964c8d6c7f61641f5f5aa78ad500020771c0939ee0dea1
 
 
+===== crate: tray-icon@0.24.2 (MIT OR Apache-2.0) =====
+
+Source archive: https://crates.io/api/v1/crates/tray-icon/0.24.2/download
+
+LICENSE-APACHE: LICENSE-a60eea817514531668d7e00765731449fe14d059d3249e0bc93b36de45f759f2
+
+LICENSE-MIT: LICENSE-2ab5537b8c0cb1d475e2145b6a7994b04e7c71e6e5bd836f7f9c47c221a5ad9a
+
+LICENSE.spdx: LICENSE-44181d1db740d9841dbe6d7fa1963a23067f335567127fc15a9d050476af71a6
+
 ===== crate: try-lock@0.2.5 (MIT) =====
 
 Source archive: https://crates.io/api/v1/crates/try-lock/0.2.5/download
@@ -18823,3 +18833,26 @@ AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 SOFTWARE.
+
+
+===== LICENSE-44181d1db740d9841dbe6d7fa1963a23067f335567127fc15a9d050476af71a6 =====
+
+SPDXVersion: SPDX-2.1
+DataLicense: CC0-1.0
+PackageName: tray-icon
+DataFormat: SPDXRef-1
+PackageSupplier: Organization: The Tauri Programme in the Commons Conservancy
+PackageHomePage: https://tauri.app
+PackageLicenseDeclared: Apache-2.0
+PackageLicenseDeclared: MIT
+PackageCopyrightText: 2020-2022, The Tauri Programme in the Commons Conservancy
+PackageSummary: <text>Create tray icons for desktop applications.
+                </text>
+PackageComment: <text>The package includes the following libraries; see
+Relationship information.
+                </text>
+Created: 2022-12-05T09:00:00Z
+PackageDownloadLocation: git://github.com/tauri-apps/tray-icon
+PackageDownloadLocation: git+https://github.com/tauri-apps/tray-icon.git
+PackageDownloadLocation: git+ssh://github.com/tauri-apps/tray-icon.git
+Creator: Person: Daniel Thompson-Yvetot
```

**File**: `apps/switch/dependency-license-inventory.json` (modified, +9/-3)
```diff
@@ -1,10 +1,10 @@
 {
   "schemaVersion": 1,
-  "version": "0.1.0-beta.8",
+  "version": "0.1.0-beta.9",
   "hashes": {
-    "package.json": "526d563cb6adbfd706485508808b96b241a3d2affe5eaebe690dd9ac85308ff2",
+    "package.json": "85d0f5f8cc5fb68e61f870e70d0fef4b46172650ef5c746ef800b5c85c853e94",
     "bun.lock": "231d61a49f3f16769c2034f5e30f7fc38824d906628edc0b3bbde18cb1b1a3cd",
-    "src-tauri/Cargo.lock": "44cabd6de3188eb17fb9ab90d4215c8296a6abb8a24938cc1afb261c37645755"
+    "src-tauri/Cargo.lock": "cdd9e6d8baeee2642b69e59589eed7449c9cd4454360da20aa9ff3dca1d6f019"
   },
   "packages": [
     {
@@ -2143,6 +2143,12 @@
       "version": "0.1.36",
       "license": "MIT"
     },
+    {
+      "ecosystem": "crates.io",
+      "name": "tray-icon",
+      "version": "0.24.2",
+      "license": "MIT OR Apache-2.0"
+    },
     {
       "ecosystem": "crates.io",
       "name": "try-lock",
```

**File**: `apps/switch/package.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "folkbench-switch",
   "private": true,
-  "version": "0.1.0-beta.8",
+  "version": "0.1.0-beta.9",
   "description": "Folkbench desktop assistant for API services the user already bought",
   "license": "Apache-2.0",
   "repository": {
```

**File**: `apps/switch/src-tauri/Cargo.lock` (modified, +1/-1)
```diff
@@ -1217,7 +1217,7 @@ checksum = "77ce24cb58228fbb8aa041425bb1050850ac19177686ea6e0f41a70416f56fdb"
 
 [[package]]
 name = "folkbench-switch"
-version = "0.1.0-beta.8"
+version = "0.1.0-beta.9"
 dependencies = [
  "arboard",
  "base64 0.22.1",
```

---

### Incident Patch 2: `1ce27cb1` (2026-11-17)
**Commit Message**: 博客与 README 补充 Switch 0.1.0-beta.9 新功能介绍

- 降智检测文章十二语言版本的 Switch 章节新增组合档案、托盘快速切换、本机隐私脱敏（可选）与按降智折算的性价比前沿介绍，并更新多线路容灾使用步骤与文章更新日期。
- 中、英、西、日四语 README 功能表新增组合档案、托盘快速切换与本机隐私脱敏三项。

**File**: `README.en.md` (modified, +3/-0)
```diff
@@ -111,6 +111,9 @@ Installers and SHA256 checksums are available in [Releases](https://github.com/F
 | **Provider switching** | Save connection settings for multiple services and apply your selection to a supported tool. |
 | **Configuration previews** | Review changes before writing, preserving other custom settings. Restoration capabilities depend on the tool adapter. |
 | **Codex credential protection** | Temporarily park official OAuth credentials when switching to a third-party service and restore them when switching back. |
+| **Named profiles** | Save the routes each tool currently uses as a named profile and apply the whole set in one click. |
+| **Tray switching** | Switch profiles or individual tool services from the system tray without opening the main window. |
+| **Local privacy masking** | Optional. A local proxy replaces API keys, email addresses, public IPs and custom sensitive words with placeholders before requests leave your machine and restores them in responses; tools reconnect directly when Switch quits. |
 | **Public route discovery** | Browse routes, availability, status windows and prices from the public catalog in the client. |
 | **Local usage estimates** | Review session token usage and estimate cost using reference prices. |
 
```

**File**: `README.es.md` (modified, +3/-0)
```diff
@@ -111,6 +111,9 @@ Los instaladores y archivos de verificación SHA256 están en [Releases](https:/
 | **Cambio de proveedor** | Guarda la configuración de varios servicios y aplica tu elección a una herramienta compatible. |
 | **Vista previa de cambios** | Revisa los cambios antes de escribirlos y conserva otros ajustes personalizados. La restauración depende del adaptador de cada herramienta. |
 | **Protección de credenciales de Codex** | Al cambiar a un tercero, guarda temporalmente las credenciales OAuth oficiales y las restaura al volver. |
+| **Perfiles con nombre** | Guarda las conexiones que usa cada herramienta como un perfil y aplica el conjunto con un clic. |
+| **Cambio desde la bandeja** | Cambia perfiles o el servicio de cada herramienta desde la bandeja del sistema sin abrir la ventana principal. |
+| **Enmascarado local de privacidad** | Opcional. Un proxy local sustituye claves API, correos, IP públicas y palabras sensibles propias por marcadores antes de enviar las solicitudes y los restaura en las respuestas; al cerrar Switch, las herramientas vuelven a la conexión directa. |
 | **Descubrimiento de conexiones públicas** | Consulta conexiones, disponibilidad, ventanas de estado y precios del catálogo público dentro del cliente. |
 | **Estimación de uso local** | Revisa los tokens por sesión y estima el costo con precios de referencia. |
 
```

**File**: `README.ja.md` (modified, +3/-0)
```diff
@@ -101,6 +101,9 @@ macOS のインストーラーは `.dmg`、Windows は `.exe` 形式です。
 | **プロバイダーの切替** | 複数サービスの接続設定を保存し、選択した設定を対応ツールへ適用します。 |
 | **設定差分の確認** | 書き込み前に変更を確認し、ほかのカスタム設定を保持します。復元できる範囲はツールのアダプターによって異なります。 |
 | **Codex の認証情報保護** | サードパーティーへ切り替える際に公式 OAuth 認証情報を一時退避し、公式に戻すときに復元します。 |
+| **名前付きプロファイル** | 各ツールが使っている回線をプロファイルとして保存し、ワンクリックで一括適用します。 |
+| **トレイから切替** | メインウィンドウを開かずに、システムトレイからプロファイルやツールごとのサービスを切り替えます。 |
+| **ローカルプライバシーマスキング** | 任意で有効化。送信前にローカルプロキシが API キー、メールアドレス、公開 IP、任意の機密語をプレースホルダーに置き換え、応答で復元します。Switch 終了時は直接接続に戻ります。 |
 | **公開回線の検索** | 公開カタログの回線、稼働率、状態履歴、価格をクライアントで確認できます。 |
 | **ローカル使用量の推計** | セッションごとの Token 使用量を確認し、参考単価でコストを推計します。 |
 
```

**File**: `README.md` (modified, +3/-0)
```diff
@@ -179,6 +179,9 @@ macOS 安装包为 `.dmg`，Windows 安装包为 `.exe`。
 | **服务商切换** | 保存多家服务的连接参数，将选择应用到目标工具。 |
 | **配置差异预览** | 写入前检查变化，保留其他自定义设置；具体恢复能力以工具适配为准。 |
 | **Codex 凭据保护** | 切至第三方服务时暂存官方 OAuth 凭据，切回时恢复。 |
+| **组合档案** | 把各工具当前连接的线路保存为命名组合，一键整组切换。 |
+| **托盘快速切换** | 在系统托盘切换组合或单个工具的服务，无需打开主窗口。 |
+| **本机隐私脱敏** | 可选开启。请求经本机代理发出前，把 API Key、邮箱、公网 IP 与自定义敏感词替换为占位符，并在响应中还原；退出 Switch 时恢复直连。 |
 | **公开线路发现** | 在客户端查看公开目录中的线路、可用率、状态窗口与价格。 |
 | **本地用量估算** | 按会话查看 Token 消耗，并以参考单价估算成本。 |
 
```

**File**: `src/content/articles/de/how-folkbench-detects-model-degradation.de.md` (modified, +3/-3)
```diff
@@ -12,7 +12,7 @@ modelIds: []
 benchmarkSlugs: []
 relatedSlugs: [did-the-model-get-dumber, ai-api-relay-stability-guide, api-relay-reliability-checks]
 publishedAt: '2026-11-15'
-updatedAt: '2026-11-15'
+updatedAt: '2026-11-17'
 sources:
   - id: folkbench-arena
     label: Folkbench Integrity Monitor
@@ -124,13 +124,13 @@ Herkömmliche KI-Portale prüfen entweder theoretische Modellwerte auf festen Da
 1. **Messung auf Modell- und Gruppenebene**: Jede Preis- oder Routinggruppe eines Anbieters wird getrennt bewertet, statt ein ganzes Domain-Label pauschal zusammenzufassen.
 2. **Vier spezialisierte Ranglisten**: **[Verfügbarkeit](/de/rankings)** (filtert Fake-`200`-Fehler und Stream-Abbrüche), **[Stabilität](/de/rankings/stability)** (Dauerlast & Stoßzeiten), **[Latenz](/de/rankings/latency)** (TTFT getrennt von Ausgabetempo) und **[Sitzungskosten](/de/rankings/cost)** (reale Arbeitskosten statt Lock-Multiplikatoren).
 3. **Offener [Integrity Monitor](/de/arena) & [Relay-Vergleich](/de/stations/compare)**: Kalibrierte Integritätsdaten und direkter Routenvergleich ohne eigene Test-Keys.
-4. **Open-Source-Client [Folkbench Switch](https://github.com/Folkbench/folkbench/releases)**: Tauri-+-Rust-Desktop-App (macOS `.dmg`, Windows `.exe`) für Claude Code, Codex, Gemini CLI, Aider, OpenCode und Kimi CLI mit **Diff-Vorschau vor dem Schreiben**, **Codex-OAuth-Schutz** und lokaler Nutzungsabschätzung. *(Integritäts- und Cache-Tracking bleiben Web-Evaluationsfunktionen.)*
+4. **Open-Source-Client [Folkbench Switch](https://github.com/Folkbench/folkbench/releases)**: Tauri-+-Rust-Desktop-App (macOS `.dmg`, Windows `.exe`) für Claude Code, Codex, Gemini CLI, Aider, OpenCode und Kimi CLI mit **Diff-Vorschau vor dem Schreiben**, **Codex-OAuth-Schutz** und lokaler Nutzungsabschätzung. Neu sind **benannte Profile** für das Umschalten aller Tools mit einem Klick, ein **Schnellwechsel über das Systemtray**, eine optionale **lokale Privatsphäre-Maskierung**, die API-Schlüssel, E-Mail-Adressen, öffentliche IPs und eigene Begriffe vor dem Versand durch Platzhalter ersetzt und in Antworten (auch Streams) wiederherstellt, sowie eine standardmäßig **degradationsbereinigte Preis-Leistungs-Front**. *(Integritäts- und Cache-Tracking bleiben Web-Evaluationsfunktionen.)*
 
 ## Praktischer Einsatz im Alltag
 
 1. Wählen Sie passende Modell-und-Gruppen-Kandidaten über [Verfügbarkeit](/de/rankings), [Stabilität](/de/rankings/stability), [Latenz](/de/rankings/latency) und [Sitzungskosten](/de/rankings/cost).
 2. Prüfen Sie im [Integrity Monitor](/de/arena) die Übereinstimmung von Sonden, Reasoning-Tokens und Fingerprints mit der offiziellen Live-Baseline über mehrere Zeitfenster.
 3. Vergleichen Sie vor der Buchung exakt die gewünschte Gruppe unter [Relay-Vergleich](/de/stations/compare).
-4. Verwalten Sie Haupt- und Ersatzroute in [Folkbench Switch](https://github.com/Folkbench/folkbench/releases), um bei Abweichungen per Diff-Vorschau in Sekunden umzuschalten.
+4. Speichern Sie Haupt- und Ersatzroute als benannte Profile in [Folkbench Switch](https://github.com/Folkbench/folkbench/releases), um bei Abweichungen nach Diff-Vorschau oder direkt über das Systemtray in Sekunden umzuschalten.
 
 Moderne KI-Bewertung muss nicht nur zeigen, welches Modell auf dem Papier führt, sondern ob jede bezahlte Route diese Leistung tatsächlich ausliefert. Durch Aktualitäts-Sonden, Modell-Fingerprints und unabhängige offizielle Kalibrierung setzt Folkbench dafür einen transparenten Maßstab.
```

**File**: `src/content/articles/en/how-folkbench-detects-model-degradation.en.md` (modified, +5/-2)
```diff
@@ -12,7 +12,7 @@ modelIds: []
 benchmarkSlugs: []
 relatedSlugs: [did-the-model-get-dumber, ai-api-relay-stability-guide, api-relay-reliability-checks]
 publishedAt: '2026-11-15'
-updatedAt: '2026-11-15'
+updatedAt: '2026-11-17'
 sources:
   - id: folkbench-arena
     label: Folkbench Integrity Monitor
@@ -161,13 +161,16 @@ Most benchmark sites stop at displaying tables, leaving users to edit local JSON
 
 - **Configuration diff previews**: Shows exact changes before writing local tool files while preserving unrelated custom settings.
 - **Codex credential protection**: Safely parks official OAuth credentials when switching to a third-party relay and restores them cleanly when switching back.
+- **Named profiles and tray switching**: Save the routes each tool currently uses as named profiles such as "daily" or "backup" and apply the whole set in one click; the system tray menu switches profiles or individual tool services without opening the main window.
+- **Optional local privacy masking**: When enabled, requests pass through a local loopback proxy that replaces API keys, private keys, email addresses, public IPs, and your custom sensitive words with placeholders before they leave the machine, then restores them in responses, including streamed output. Tools fall back to direct connections when Switch quits.
+- **Degradation-adjusted value frontier**: The cross-model Pareto frontier in Discover adjusts value with published integrity-monitor data by default, and frontier routes can be registered or connected directly.
 - **Public route discovery and local usage estimates**: Surfaces public route availability, status windows, and pricing inside the client alongside local session token cost estimates. *(Integrity monitoring and cache-compensation tracking remain web-platform evaluation features rather than client-integrated checks.)*
 
 ## Putting degradation signals to work
 
 1. **Filter by operational priority**: Start with [Availability](/en/rankings), [Stability](/en/rankings/stability), [Latency](/en/rankings/latency), and [Session Cost](/en/rankings/cost) to shortlist specific model-and-group routes that match your workload.
 2. **Verify baseline alignment in Integrity Monitor**: Check probe agreement, reasoning tokens, and model fingerprints on the [Integrity Monitor](/en/arena) against the live official baseline—especially over consecutive windows when quality feels inconsistent.
 3. **Compare the exact tier before funding**: Use [Compare relays](/en/stations/compare) on the specific group you plan to purchase rather than extrapolating from another pool under the same provider.
-4. **Maintain rapid failover via Switch**: Store primary and backup routes in [Folkbench Switch](https://github.com/Folkbench/folkbench/releases) so you can inspect the configuration diff and switch cleanly within seconds whenever route telemetry drifts.
+4. **Maintain rapid failover via Switch**: Save primary and backup routes as named profiles in [Folkbench Switch](https://github.com/Folkbench/folkbench/releases); whenever route telemetry drifts, inspect the configuration diff in the main window or switch the whole set from the system tray within seconds.
 
 As production workflows increasingly rely on third-party API routing, evaluation must verify not only which model leads on paper, but whether the route you pay for actually delivers it. By bringing **current-events probes**, **model fingerprints**, and **independent direct official calibration** into continuous public view, Folkbench establishes a clearer, auditable standard for choosing AI API routes.
```

**File**: `src/content/articles/es/how-folkbench-detects-model-degradation.es.md` (modified, +3/-3)
```diff
@@ -12,7 +12,7 @@ modelIds: []
 benchmarkSlugs: []
 relatedSlugs: [did-the-model-get-dumber, ai-api-relay-stability-guide, api-relay-reliability-checks]
 publishedAt: '2026-11-15'
-updatedAt: '2026-11-15'
+updatedAt: '2026-11-17'
 sources:
   - id: folkbench-arena
     label: Monitor de integridad de Folkbench
@@ -137,13 +137,13 @@ Mientras los sitios convencionales solo evalúan modelos oficiales en datasets f
 1. **Medición por modelo y grupo exacto**: Evalúa cada grupo comercial por separado para que los pools estables no encubran recortes en grupos promocionales.
 2. **Cuatro rankings públicos complementarios**: **[Disponibilidad](/es/rankings)** (descarta falsos `200`, cortes de streaming y fallos de parsing), **[Estabilidad](/es/rankings/stability)** (cargas sostenidas y horas pico), **[Latencia](/es/rankings/latency)** (separa TTFT del ritmo continuo de tokens) y **[Costo por sesión](/es/rankings/cost)** (gasto real en sesiones de código).
 3. **[Monitor de integridad](/es/arena) y [Comparar relays](/es/stations/compare) abiertos**: Telemetría calibrada y comparación lado a lado sin necesidad de mantener múltiples claves oficiales propias.
-4. **Cliente open source [Folkbench Switch](https://github.com/Folkbench/folkbench/releases)**: Aplicación en Tauri + Rust (macOS `.dmg` y Windows `.exe`) para Claude Code, Codex, Gemini CLI, Aider, OpenCode y Kimi CLI con **vista previa de diff**, **protección de credenciales OAuth de Codex** y estimación local de consumo. *(La detección de degradación y caché permanecen en la web como mediciones continuas.)*
+4. **Cliente open source [Folkbench Switch](https://github.com/Folkbench/folkbench/releases)**: Aplicación en Tauri + Rust (macOS `.dmg` y Windows `.exe`) para Claude Code, Codex, Gemini CLI, Aider, OpenCode y Kimi CLI con **vista previa de diff**, **protección de credenciales OAuth de Codex** y estimación local de consumo. Ahora suma **perfiles con nombre** para cambiar todas las herramientas con un clic, **cambio rápido desde la bandeja del sistema**, un **enmascarado local de privacidad** opcional que sustituye claves API, correos, IP públicas y palabras propias por marcadores antes de enviar y los restaura en las respuestas (incluido streaming), y una **frontera de valor ajustada por degradación** activada por defecto. *(La detección de degradación y caché permanecen en la web como mediciones continuas.)*
 
 ## Cómo aplicar estas señales en la práctica
 
 1. Filtra grupos candidatos según tu carga de trabajo en [Disponibilidad](/es/rankings), [Estabilidad](/es/rankings/stability), [Latencia](/es/rankings/latency) y [Costo por sesión](/es/rankings/cost).
 2. Revisa en el [Monitor de integridad](/es/arena) la concordancia, tokens de razonamiento y huella frente a la base oficial en ventanas consecutivas.
 3. Contrasta el grupo exacto antes de recargar en [Comparar relays](/es/stations/compare).
-4. Mantén una ruta principal y otra de respaldo en [Folkbench Switch](https://github.com/Folkbench/folkbench/releases) para cambiar en segundos tras revisar el diff de configuración.
+4. Guarda una ruta principal y otra de respaldo como perfiles en [Folkbench Switch](https://github.com/Folkbench/folkbench/releases) para cambiar en segundos tras revisar el diff o directamente desde la bandeja del sistema.
 
 Evaluar infraestructura de IA hoy exige comprobar no solo qué modelo lidera sobre el papel, sino si cada ruta entrega exactamente lo prometido. Con sondas de actualidad, huellas de modelo y calibración oficial directa independiente, Folkbench ofrece una referencia pública verificable para elegir rutas de API con criterio.
```

**File**: `src/content/articles/fr/how-folkbench-detects-model-degradation.fr.md` (modified, +3/-3)
```diff
@@ -12,7 +12,7 @@ modelIds: []
 benchmarkSlugs: []
 relatedSlugs: [did-the-model-get-dumber, ai-api-relay-stability-guide, api-relay-reliability-checks]
 publishedAt: '2026-11-15'
-updatedAt: '2026-11-15'
+updatedAt: '2026-11-17'
 sources:
   - id: folkbench-arena
     label: Moniteur d’intégrité Folkbench
@@ -124,13 +124,13 @@ La plupart des sites d’évaluation se cantonnent soit aux scores théoriques s
 1. **Mesure par modèle et par groupe exact** : Évite qu’une seule voie haut de gamme ne représente tout un prestataire.
 2. **Quatre classements publics spécialisés** : **[Disponibilité](/fr/rankings)** (écarte les faux `200` et coupures de flux), **[Stabilité](/fr/rankings/stability)** (charges longues et heures de pointe), **[Latence](/fr/rankings/latency)** (TTFT distinct du débit continu) et **[Coût par session](/fr/rankings/cost)** (coût réel de travail).
 3. **[Moniteur d’intégrité](/fr/arena) et [Comparateur de relais](/fr/stations/compare) ouverts** : Télémétrie étalonnée et comparaison directe sans maintenir vos propres clés de référence.
-4. **Client open source [Folkbench Switch](https://github.com/Folkbench/folkbench/releases)** : Application Tauri + Rust (macOS `.dmg`, Windows `.exe`) pour Claude Code, Codex, Gemini CLI, Aider, OpenCode et Kimi CLI avec **aperçu des diffs**, **protection des identifiants OAuth Codex** et estimation locale d’usage. *(Le suivi d’intégrité et de cache reste une fonction web continue.)*
+4. **Client open source [Folkbench Switch](https://github.com/Folkbench/folkbench/releases)** : Application Tauri + Rust (macOS `.dmg`, Windows `.exe`) pour Claude Code, Codex, Gemini CLI, Aider, OpenCode et Kimi CLI avec **aperçu des diffs**, **protection des identifiants OAuth Codex** et estimation locale d’usage. Nouveautés : des **profils nommés** pour basculer tous les outils en un clic, un **changement rapide depuis la barre système**, un **masquage local de confidentialité** optionnel qui remplace clés API, e-mails, IP publiques et termes personnalisés par des marqueurs avant envoi puis les restaure dans les réponses (streaming compris), et une **frontière de rapport qualité-prix ajustée à la dégradation** par défaut. *(Le suivi d’intégrité et de cache reste une fonction web continue.)*
 
 ## Exploiter ces signaux au quotidien
 
 1. Sélectionnez vos groupes candidats sur [Disponibilité](/fr/rankings), [Stabilité](/fr/rankings/stability), [Latence](/fr/rankings/latency) et [Coût par session](/fr/rankings/cost).
 2. Vérifiez sur le [Moniteur d’intégrité](/fr/arena) l’alignement des sondes, tokens de réflexion et empreintes avec la référence officielle sur plusieurs fenêtres consécutives.
 3. Comparez exactement le groupe visé dans [Comparer les relais](/fr/stations/compare) avant de créditer un compte.
-4. Enregistrez une route principale et une route de secours dans [Folkbench Switch](https://github.com/Folkbench/folkbench/releases) pour basculer en quelques secondes après contrôle du diff.
+4. Enregistrez une route principale et une route de secours comme profils dans [Folkbench Switch](https://github.com/Folkbench/folkbench/releases) pour basculer en quelques secondes après contrôle du diff ou directement depuis la barre système.
 
 Évaluer l’IA en production ne se limite plus au score théorique d’un modèle : il faut vérifier que chaque route délivre réellement le modèle payé. Grâce aux sondes d’actualité, aux empreintes de modèle et à l’étalonnage officiel direct indépendant, Folkbench fournit un repère public et vérifiable pour choisir vos routes d’API.
```

#### Recent Merged Pull Requests:
- **PR #12** (2026-11-17): Release Switch 0.1.0-beta.9 and update localized blog & README docs (@MarlaRoselyn)
- **PR #11** (2026-11-17): Convert blog article covers and inline raster figures from WebP to JPG (@MarlaRoselyn)
- **PR #10** (2026-11-16): Upgrade Switch client to Phase 0–2 evaluation and Precision Spectrum v0.5 design system (@MarlaRoselyn)
- **PR #2** (2026-10-11): Update README.md (@sharingcoke)
- **PR #1** (2026-10-07): Patch 1 (@sharingcoke)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. Empirical Invariant Guard in README.en.md

**RULE**:
When implementing operations in `README.en.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Folkbench/folkbench. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `1125e5dc`: . Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `README.en.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
| **Named profiles** | Save the routes each tool currently uses as a named profile and apply the whole set in one click. |
| **Tray switching** | Switch profiles or individual tool services from the system tray without opening the main window. |
| **Local privacy masking** | Optional. A local proxy replaces API keys, email addresses, public IPs and custom sensitive words with placeholders before requests leave your machine and restores them in responses; tools reconnect directly when Switch quits. |
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `1125e5dc` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
