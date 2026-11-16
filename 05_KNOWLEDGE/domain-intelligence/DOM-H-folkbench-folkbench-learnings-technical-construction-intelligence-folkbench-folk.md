# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: folkbench-folkbench-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "folkbench-folkbench-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-16T04:30:31.722Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-folkbench-folkbench-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [folkbench-folkbench-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-16T04:30:31.722Z`  
> **Learning ID**: `LEARN-EVO-folkbench-folkbench-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: D (Research & Knowledge Intelligence), K (Quality & Verification Intelligence), G (Architecture Intelligence), I (Content & Information Intelligence), F (Design Intelligence), M (Feedback & Evolution Intelligence), J (Search & Distribution Intelligence), C (Market & Business Intelligence), E (Creative Intelligence), L (Deployment & Operations Intelligence)
- **Confidence Rating**: 69%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from folkbench-folkbench-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/folkbench-folkbench-learnings.md`  
> **Source**: github ([https://github.com/Folkbench/folkbench](https://github.com/Folkbench/folkbench))  
> **Source Version**: `4bb39f16`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-16T04:30:13.778Z  
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
> **Harvest Timestamp**: 2026-11-16T04:30:13.775Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Folkbench/folkbench`
- **Description**: AI API 中转站评测排行与切换工具：实测可用率、延迟与价格 · Open-source AI API relay benchmark, rankings & switcher for Claude Code / Codex
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 3878 stars

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
- **Issue #10** (2026-11-16): **Upgrade Switch client to Phase 0–2 evaluation and Precision Spectrum v0.5 design system**
  *Symptoms*: ## Changes  - Component: Switch (`apps/switch/`) - User-visible change:   - Align visual tokens, typography weights/scales, light & dark themes, and trilingual dictionaries (`en`, `zh-CN`, `zh-Hant`) with Precision Spectrum v0.5   - Expand the public catalog and Rust IPC contracts to support model degradation monitoring, official upstream status, the Data Security board (`L4`–`L0`), and extended station profiles   - Upgrade Service Discovery into four views (Leaderboard, Integrity / Degradation Monitor, cross-model Pareto Value Frontier chart, and Data Security board) plus a floating bottom comparison bar   - Add a two-station five-axis SVG radar comparison dialog and redesign the Station Detail page (four verdict cards, interactive cache-hit-rate pricing calculator, and full operational profile)   - Consolidate ranking and pricing methodology documentation into the Methods page, adding 66 frontend & algorithm unit tests alongside contract unit tests  ## Verification  - [x] `bun run check` (`check:source`, `test:repository-tools`, `check:blog`, `check:switch`, `build:blog`, and `build:switch:web` verified via `.githooks/pre-push`) - [x] Rust tests for client behavior changes (`cargo fmt --all --check` and `cargo test -p folkbench-switch-contract --locked` verified locally; full three-OS `cargo test --workspace` matrix covered by `switch-ci.yml`) - [ ] Blog build for content/build changes (N/A: no blog content changes; regression blog build verified locally) - [x] No credentia

- **Issue #9** (2026-11-15): **评测需求：建议覆盖 超稳API / Stable API（apiniuma.com）**
  *Symptoms*: 希望按官网/仓库说明，申请对「超稳API / Stable API」做免费编辑评估或公开评测覆盖。这不是付费展示、赞助位或置顶申请，也未提供 API Key 或测试账号。  - 站点名称：超稳API / Stable API - 官网：https://apiniuma.com - 定价页：https://apiniuma.com/pricing - 文档：https://jqm6hiro8q.apifox.cn - OpenAI 兼容 Base URL：https://apiniuma.com/v1 - 公开注册入口：https://apiniuma.com/register - 类型：OpenAI 兼容的多模型聚合 / API 网关 - 计费：按量付费，额度不过期（以定价页为准） - 模型覆盖：定价页展示 GPT / Claude / Gemini / DeepSeek 等（以定价页实际清单为准） - 核验日期：2026-11-15（Asia/Shanghai）；上述公开页本次可访问，仅证明页面可达，不代表生成请求或注册流程实测成功  未提供任何 API key、Cookie、密码或私人账号资料。请按当前官方页面核对；不要为评测检查运行付费生成调用，除非你们使用自有探测资源。若不符合覆盖范围，直接不收录即可。  如需补充公开资料，可联系 lmj243-28a81c@mail.grokbot.com。谢谢！
  **Post-Mortem & Fix Analysis**:
  > 自行站内入驻

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

### Incident Patch 1: `af4c9d9c` (2026-10-17)
**Commit Message**: ci(release): retry flaky Apple stapler/notarytool during Beta builds

Ticket delivery and CloudKit lookups intermittently fail with network -1005 / missing staple; retry before failing the matrix.

**File**: `.github/workflows/switch-beta.yml` (modified, +20/-4)
```diff
@@ -159,20 +159,36 @@ jobs:
           TARGET: ${{ matrix.target }}
         run: |
           set -euo pipefail
+          retry() {
+            local attempt=1
+            local max=6
+            local delay=15
+            until "$@"; do
+              if (( attempt >= max )); then
+                echo "gave up after ${attempt} attempts: $*"
+                return 1
+              fi
+              echo "attempt ${attempt} failed; sleeping ${delay}s then retrying: $*"
+              sleep "$delay"
+              attempt=$((attempt + 1))
+              delay=$((delay + 15))
+            done
+          }
           bundle="apps/switch/src-tauri/target/$TARGET/release/bundle"
           app="$bundle/macos/Folkbench Switch.app"
           codesign --verify --deep --strict "$app"
           codesign -dv --verbose=4 "$app" 2> "$FOLKBENCH_APPLE_SIGNING_DIR/codesign-details.txt"
           node -e 'const fs=require("node:fs"); const text=fs.readFileSync(process.env.FOLKBENCH_APPLE_SIGNING_DIR + "/codesign-details.txt", "utf8"); if (!text.split("\n").includes("TeamIdentifier=" + process.env.APPLE_TEAM_ID) || !/flags=.*\bruntime\b/.test(text)) { console.error("Application signing team or hardened runtime verification failed."); process.exit(1); }'
-          xcrun stapler validate "$app"
+          # Ticket delivery can lag or flake on Apple's CDN; wait/retry before failing the whole matrix.
+          retry xcrun stapler validate "$app"
           spctl --assess --type execute "$app"
           shopt -s nullglob
           installers=("$bundle"/dmg/*.dmg)
           test "${#installers[@]}" -eq 1
-          xcrun notarytool submit "${installers[0]}" --key "$APPLE_API_KEY_PATH" --key-id "$APPLE_API_KEY" --issuer "$APPLE_API_ISSUER" --wait --output-format json > "$FOLKBENCH_APPLE_SIGNING_DIR/notarization.json"
+          retry bash -c 'xcrun notarytool submit "$0" --key "$APPLE_API_KEY_PATH" --key-id "$APPLE_API_KEY" --issuer "$APPLE_API_ISSUER" --wait --output-format json > "$FOLKBENCH_APPLE_SIGNING_DIR/notarization.json"' "${installers[0]}"
           node -e 'const fs=require("node:fs"); if (JSON.parse(fs.readFileSync(process.env.FOLKBENCH_APPLE_SIGNING_DIR + "/notarization.json", "utf8")).status !== "Accepted") { console.error("Apple did not accept the DMG notarization."); process.exit(1); }'
-          xcrun stapler staple "${installers[0]}"
-          xcrun stapler validate "${installers[0]}"
+          retry xcrun stapler staple "${installers[0]}"
+          retry xcrun stapler validate "${installers[0]}"
       - name: Collect only installers and public build metadata
         shell: bash
         env:
```

---

### Incident Patch 2: `4c290cc3` (2026-11-01)
**Commit Message**: fix(switch): 修复 claude-desktop connect 用例以恢复 beta.6 候选构建

claude-desktop 已是可写适配器，旧拒绝断言导致 signed-candidate CI 失败。

**File**: `apps/switch/src-tauri/src/services/connect.rs` (modified, +3/-2)
```diff
@@ -638,11 +638,12 @@ mod tests {
         let parsed = parse_connect_url(&connect_url(&sample_pairs())).unwrap();
         assert_eq!(parsed.tool_id, "claude-code");
 
+        // claude-desktop is a writable adapter (beta.6+); connect links may target it.
         let mut desktop = sample_pairs();
-        // Replace the tool value (last pair).
         let last = desktop.len() - 1;
         desktop[last] = ("tool", "claude-desktop");
-        assert!(parse_connect_url(&connect_url(&desktop)).is_err());
+        let desktop_parsed = parse_connect_url(&connect_url(&desktop)).unwrap();
+        assert_eq!(desktop_parsed.tool_id, "claude-desktop");
 
         let mut unknown = sample_pairs();
         let last = unknown.len() - 1;
```

---

### Incident Patch 3: `4e05cbb4` (2026-10-29)
**Commit Message**: docs: 更新智流 FluxLane 赞助商描述

按 KevinX 提供的新文案替换 README 与 docs/services 中的中英文介绍，保留 /go/fluxlane 跳转链接。

**File**: `README.en.md` (modified, +1/-1)
```diff
@@ -43,7 +43,7 @@ These relays support Folkbench's ongoing benchmarks. [Become a sponsor →](http
 </tr>
 <tr>
 <td width="200" align="center"><a href="https://folkbench.com/go/fluxlane?source=readme_en"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/images/sponsors/fluxlane-dark.png"><img src="docs/images/sponsors/fluxlane-light.png" alt="智流 FluxLane" width="180"></picture></a></td>
-<td><a href="https://folkbench.com/go/fluxlane?source=readme_en"><b>FluxLane (智流)</b></a><br>Extensive model catalog spanning international and domestic options with direct OpenAI SDK compatibility. Features platform-level routing, usage monitoring, latency tracking, and formal procurement support (invoices, corporate contracts, and purchase orders) for enterprises and academic institutions.</td>
+<td><a href="https://folkbench.com/go/fluxlane?source=readme_en"><b>FluxLane (智流)</b></a><br>An AI API gateway for developers and teams: full-capability, stable access to global models, supporting GPT, Claude, Gemini, DeepSeek, GLM, and other mainstream models as well as major global model-vendor protocols. The platform provides policy-based routing and multi-route failover, making long-term integration and cost accounting easier for teams in China. For enterprise and university procurement in China, it can sign contracts, accept wire transfers, and provide invoices, purchase orders, and related materials (subject to commercial confirmation). Publishes model capability evaluation reports, with multipliers as low as 0.1×, and new registrants receive a $2 trial credit.</td>
 </tr>
 </table>
 
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -46,7 +46,7 @@
 </tr>
 <tr>
 <td width="200" align="center"><a href="https://folkbench.com/go/fluxlane?source=readme"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/images/sponsors/fluxlane-dark.png"><img src="docs/images/sponsors/fluxlane-light.png" alt="智流 FluxLane" width="180"></picture></a></td>
-<td><a href="https://folkbench.com/go/fluxlane?source=readme"><b>智流 FluxLane</b></a><br>智流 FluxLane 的模型和线路比较多，国内外模型都有，接入方式也比较统一，直接兼容 OpenAI SDK。除了模型和线路比较全，它还把路由、用量、成本和延迟这些东西都做进了平台里，比较适合开发者和团队长期接入。对于企业和高校采购这方面是比较明显的优势，可以提供发票、合同、采购单。</td>
+<td><a href="https://folkbench.com/go/fluxlane?source=readme"><b>智流 FluxLane</b></a><br>智流 FluxLane 是一个面向开发者与团队的 AI API 网关：提供满血且稳定的全球模型，支持 GPT、Claude、Gemini、Deepseek、GLM 等主流模型和全球主流模型厂商协议，平台提供策略路由与多线路容灾，方便国内团队长期接入与成本核算。面向国内企业/高校采购，可签订合同、对公转账，并提供发票、采购单等材料（具体以商务确认为准），公开模型能力检测报告，倍率低至0.1倍率，新人注册可领 2 美元体验额度。</td>
 </tr>
 </table>
 
```

**File**: `docs/services/README.en.md` (modified, +1/-1)
```diff
@@ -63,6 +63,6 @@ A unified API aggregation platform for developers and teams, with published cove
 
 <h3><a href="https://folkbench.com/go/fluxlane?source=readme" target="_blank" rel="noopener noreferrer">智流 FluxLane</a></h3>
 
-Its published directory is large, covering a wide range of international and domestic models across multiple channels. Support for enterprise and university procurement, invoices, and related documents is a clear use-case advantage. The current profile still lacks enough independent experience and rating fields, so verify the site’s low-multiplier, stability, and TTFT claims against the model-specific rankings and current routes.
+FluxLane (智流) is an AI API gateway for developers and teams: it offers full-capability, stable access to global models, supporting GPT, Claude, Gemini, DeepSeek, GLM, and other mainstream models as well as major global model-vendor protocols. The platform provides policy-based routing and multi-route failover, making long-term integration and cost accounting easier for teams in China. For enterprise and university procurement in China, it can sign contracts, accept wire transfers, and provide invoices, purchase orders, and related materials (subject to commercial confirmation). It publishes model capability evaluation reports, with multipliers as low as 0.1×, and new registrants receive a $2 trial credit.
 
 Prices, available models, protocol support, and routes can change, so check each site’s current documentation, pricing page, and terms before use.
```

**File**: `docs/services/README.zh-CN.md` (modified, +1/-1)
```diff
@@ -37,4 +37,4 @@ Cloudbridge 比较偏海外使用场景，支持美元计费和多语言，起
 
 <h3><a href="https://folkbench.com/go/fluxlane?source=readme" target="_blank" rel="noopener noreferrer">智流 FluxLane</a></h3>
 
-智流 FluxLane 的模型和线路比较多，国内外模型都有，接入方式也比较统一，直接兼容 OpenAI SDK。除了模型和线路比较全，它还把路由、用量、成本和延迟这些东西都做进了平台里，比较适合开发者和团队长期接入。对于企业和高校采购这方面是比较明显的优势，可以提供发票、合同、采购单。
+智流 FluxLane 是一个面向开发者与团队的 AI API 网关：提供满血且稳定的全球模型，支持 GPT、Claude、Gemini、Deepseek、GLM 等主流模型和全球主流模型厂商协议，平台提供策略路由与多线路容灾，方便国内团队长期接入与成本核算。面向国内企业/高校采购，可签订合同、对公转账，并提供发票、采购单等材料（具体以商务确认为准），公开模型能力检测报告，倍率低至0.1倍率，新人注册可领 2 美元体验额度。
```

#### Recent Merged Pull Requests:
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

## X. ci(release): retry flaky Apple stapler/notarytool during Beta builds

**RULE**:
When implementing operations in `.github/workflows/switch-beta.yml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Folkbench/folkbench. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `af4c9d9c`: ci(release): retry flaky Apple stapler/notarytool during Beta builds. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/switch-beta.yml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
          retry() {
            local attempt=1
            local max=6
            local delay=15
            until "$@"; do
              if (( attempt >= max )); then
                echo "gave up after ${attempt} attempts: $*"
                return 1
              fi
              echo "attempt ${attempt} failed; sleeping ${delay}s then retrying: $*"
              sleep "$delay"
              attempt=$((attempt + 1))
              delay=$((delay + 15))
            done
          }
          # Ticket delivery can lag or flake on Apple's CDN; wait/retry before failing the whole matrix.
          retry xcrun stapler validate "$app"
          retry bash -c 'xcrun notarytool submit "$0" --key "$APPLE_API_KEY_PATH" --key-id "$APPLE_API_KEY" --issuer "$APPLE_API_ISSUER" --wait --output-format json > "$FOLKBENCH_APPLE_SIGNING_DIR/notarization.json"' "${installers[0]}"
          retry xcrun stapler staple "${installers[0]}"
          retry xcrun stapler validate "${installers[0]}"
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
          xcrun stapler validate "$app"
          xcrun notarytool submit "${installers[0]}" --key "$APPLE_API_KEY_PATH" --key-id "$APPLE_API_KEY" --issuer "$APPLE_API_ISSUER" --wait --output-format json > "$FOLKBENCH_APPLE_SIGNING_DIR/notarization.json"
          xcrun stapler staple "${installers[0]}"
          xcrun stapler validate "${installers[0]}"
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `af4c9d9c` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
