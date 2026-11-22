# Verification Protocol: Verification Protocol: Empirical Defect Shield for Folkbench/folkbench

<!-- PROVENANCE_START
{
  "source_repository": "Folkbench/folkbench",
  "source_url": "https://github.com/Folkbench/folkbench",
  "source_version": "f0856c35",
  "license": "NOASSERTION",
  "timestamp": "2026-11-22T18:52:39.067Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-folkbench-folkbench",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [Folkbench/folkbench](https://github.com/Folkbench/folkbench) (Revision: `f0856c35`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-22T18:52:39.067Z`  
> **Learning ID**: `learn-github-folkbench-folkbench`


## 1. Scope & Verification Target
- **Target Repository**: `Folkbench/folkbench` (Commit: `f0856c35`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): Folkbench/folkbench

> **Canonical Artifact**: `07_PROJECT_LEARNING/folkbench-folkbench-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Folkbench/folkbench](https://github.com/Folkbench/folkbench))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-22T18:52:37.750Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Folkbench/folkbench`
- **Description**: AI API 中转站推荐与评测：中转站排行榜、中转站检测、Claude / GPT / Gemini 中转站对比 · AI API relay rankings · Folkbench Switch for Claude Code, Codex & Gemini CLI
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 3349 stars

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

### Incident Patch 1: `f0856c35` (2026-11-22)
**Commit Message**: 新增 Folkbench Pelican Database 开源发布博客（12 语种）并修复 Windows 路径校验兼容

**File**: `scripts/distribution/subsite-core.ts` (modified, +3/-2)
```diff
@@ -88,14 +88,15 @@ export async function verifySubsite(root:string,site:Subsite,snapshot:PublicData
   await visit(root)
   const forbidden=FORBIDDEN_WORDS
   const titles=new Set<string>(),descriptions=new Set<string>(),urls=new Set<string>()
-  for(const path of htmlFiles){const body=await readFile(path,'utf8');if(forbidden.some(word=>body.includes(word)))throw new Error('subsite_wording_rejected');if(path.endsWith('/404.html'))continue
+  const rootPosix=resolve(root).replaceAll('\\','/')
+  for(const path of htmlFiles){const body=await readFile(path,'utf8');if(forbidden.some(word=>body.includes(word)))throw new Error('subsite_wording_rejected');if(path.replaceAll('\\','/').endsWith('/404.html'))continue
     if(!body.includes('lang="zh-CN"')||!body.includes(SUBSITE_NOTICE)||!body.includes(snapshot.snapshot_version)||!body.includes(snapshot.published_at))throw new Error('subsite_provenance_missing')
     const title=body.match(/<title>(.*?)<\/title>/u)?.[1],description=body.match(/name="description" content="([^"]*)"/u)?.[1],canonical=body.match(/rel="canonical" href="([^"]*)"/u)?.[1]
     if(!title||!description||titles.has(title)||descriptions.has(description)||!canonical?.startsWith(origin+'/'))throw new Error('subsite_metadata_invalid')
     titles.add(title);descriptions.add(description);urls.add(canonical)
     for(const match of body.matchAll(/(?:href|src)="([^"]+)"/gu)){
       const href=match[1]!.replaceAll('&amp;','&')
-      if(href.startsWith('/')){const url=new URL(href,origin);if(url.origin!==origin)throw new Error('subsite_external_relative_link');const target=resolve(root,'.'+url.pathname+(url.pathname.endsWith('/')?'index.html':''));if(!target.startsWith(resolve(root)+'/'))throw new Error('subsite_link_escape');await readFile(target)}
+      if(href.startsWith('/')){const url=new URL(href,origin);if(url.origin!==origin)throw new Error('subsite_external_relative_link');const target=resolve(root,'.'+url.pathname+(url.pathname.endsWith('/')?'index.html':''));if(!target.replaceAll('\\','/').startsWith(rootPosix+'/'))throw new Error('subsite_link_escape');await readFile(target)}
       if(href.startsWith('https://folkbench.com')){const url=new URL(href);if(url.origin!=='https://folkbench.com'||url.searchParams.get('utm_source')!==site||!((url.searchParams.get('utm_medium')==='pages'&&url.searchParams.get('utm_campaign')==='subsite'&&url.searchParams.get('utm_content'))||isCtaUrl(site,url)))throw new Error('subsite_attribution_invalid')}
       if(href.startsWith('https://'))checkNetworkLink(site,href)
       if(/[?&](?:aff|ref|partner)=|\/go\/|\/outbound/iu.test(href))throw new Error('subsite_link_rejected')
```

**File**: `src/content/articles/de/folkbench-pelican-database.de.md` (added, +116/-0)
```diff
@@ -0,0 +1,116 @@
+---
+slug: folkbench-pelican-database
+translationKey: folkbench-pelican-database
+locale: de
+kind: article
+title: "Open-Source-Release der Folkbench Pelican Database: Eine der größten und umfassendsten models.dev-ausgerichteten Pelikan-Datenbanken"
+description: "Folkbench veröffentlicht die Pelican Database als Open Source: 507 kanonische Modelle von 68 Anbietern aus 3.875 Quellen, 454 echte SVGs, 507 standardisierte PNGs, models.dev-Abgleich und täglicher automatischer Sync für Modell-Authentizitätsprüfungen."
+category: Tests
+tags: [pelican-benchmark, open-database, model-authenticity, models.dev]
+authorId: cang-lin
+modelIds: [gpt-6-2-astra, claude-fable-5-2, gemini-4-neon, deepseek-v4-pro]
+benchmarkSlugs: []
+relatedSlugs: [how-to-score-a-cycling-pelican, how-folkbench-detects-model-degradation, did-the-model-get-dumber]
+publishedAt: '2026-11-22'
+updatedAt: '2026-11-22'
+sources:
+  - id: folkbench-pelican-db
+    label: Open-Source-Repository Folkbench/pelican-database
+    url: https://github.com/Folkbench/pelican-database
+    checkedAt: '2026-11-22'
+    claimScope: official
+  - id: simon-pelican-tag
+    label: Simon Willison, Tag-Archiv pelican-riding-a-bicycle
+    url: https://simonwillison.net/tags/pelican-riding-a-bicycle/
+    checkedAt: '2026-11-22'
+    claimScope: official
+  - id: simon-pelican-repo
+    label: Ursprüngliches Experiment-Repository simonw/pelican-bicycle
+    url: https://github.com/simonw/pelican-bicycle
+    checkedAt: '2026-11-22'
+    claimScope: official
+  - id: unclek-pelicanmap
+    label: Täglich aktualisiertes mehrsprachiges Archiv UncleK/pelicanmap
+    url: https://github.com/UncleK/pelicanmap
+    checkedAt: '2026-11-22'
+    claimScope: observed
+  - id: models-dev
+    label: Öffentliche Modell-ID- und Metadaten-API von models.dev
+    url: https://models.dev/api.json
+    checkedAt: '2026-11-22'
+    claimScope: official
+  - id: folkbench-arena
+    label: Folkbench Integrity Monitor
+    url: https://folkbench.com/de/arena
+    checkedAt: '2026-11-22'
+    claimScope: observed
+---
+
+> Wenn ein Pelikan auf dem Fahrrad nicht mehr nur ein flüchtiger Screenshot in sozialen Medien ist, sondern als standardisierte, durchsuchbare und täglich aktualisierte Referenzdatenbank für 507 Modelle vorliegt, wird aus einem viralen Test eine belastbare Engineering-Grundlage zur Überprüfung der Modell-Authentizität.
+
+Heute veröffentlichen wir **[Folkbench/pelican-database](https://github.com/Folkbench/pelican-database)** als Open Source – eine der weltweit größten und umfassendsten strukturierten SVG- und PNG-Referenzdatenbanken für den LLM-Benchmark **„Pelican Riding a Bicycle“**.
+
+Seit Simon Willison im Oktober 2024 den Prompt *"Generate an SVG of a pelican riding a bicycle"* bekannt machte, wurden Hunderte Frontier- und Open-Weight-Modelle getestet. Doch diese Ergebnisse waren über Blogs, X-Threads, GitHub Gists und Galerien verstreut – mit inkonsistenten Modellnamen und häufig nur als komprimierte Screenshots ohne echten SVG-Quellcode.
+
+`Folkbench/pelican-database` führt diese Quellen in einem sauberen, an **[models.dev](https://models.dev)** ausgerichteten und per GitHub Actions täglich inkrementell aktualisierten Datensatz zusammen, der die Modell-Authentizitätsprüfung von [Folkbench](https://folkbench.com/de) antreibt.
+
+---
+
+## 1. Zahlen im Überblick: Warum sie zu den größten und vollständigsten Pelikan-Datenbanken zählt
+
+Zum ersten öffentlichen Snapshot (2026-11-22) umfasst `Folkbench/pelican-database`:
+
+| Dimension | Verifizierter Stand | Details |
+| --- | --- | --- |
+| **Zusammengeführte Kandidaten** | **3.875** | Kombiniert aus UncleK/pelicanmap + allen 161 Beiträgen, HTML-Tabellen und Direkt-SVGs von Simon Willison |
+| **Eindeutige kanonische Modelle** | **507** | Dedupliziert aus **799** Rohbezeichnungen in `provider/model_id` |
+| **Abgedeckte Anbieter** | **68** | Von Frontier-Labs bis zu Open-Weight-Familien weltweit |
+| **Echte `.svg`-Quellcodes** | **454 (89,5 %)** | Validierte, parsbare SVG-Dateien statt bloßer Screenshots |
+| **Standardisierte `.png`-Renders** | **507 (100 %)** | Einheitliche 1024px-Renders auf weißem Hintergrund per Headless-Browser (0 Fehler) |
+| **Exakte `models.dev`-Treffer** | **378 (74,6 %)** | Davon 190 First-Party-Zuordnungen; 129 ältere Modelle folgen demselben Schema |
+| **Von Simon Willison getestet** | **177** | Mit `tested_by_simon` markiert und nach Möglichkeit auf echte `.svg`-Quellen aufgewertet |
+| **Zeitraum** | **2024-10-25 bis 2026-11-21** | Über zwei Jahre Entwicklung von räumlichem Denken und SVG-Codegenerierung |
+
+![SVG-Entwicklung von 2024-Baselines zu 2026-Frontier-Modellen in der Folkbench Pelican Database bei OpenAI, Anthropic und Google.](/blog/figures/folkbench-pelican-database/evolution-grid.png)
+
+*Abbildung 1: Sechs Original-`.svg`-Dateien direkt aus `Folkbench/pelican-database`. Obere Reihe (Oktober 2024): `openai/gpt-4o`, `anthropic/claude-3-5-sonne
```

**File**: `src/content/articles/en/folkbench-pelican-database.en.md` (added, +201/-0)
```diff
@@ -0,0 +1,201 @@
+---
+slug: folkbench-pelican-database
+translationKey: folkbench-pelican-database
+locale: en
+kind: article
+title: "Open-Sourcing Folkbench Pelican Database: One of the Largest, Most Comprehensive models.dev-Aligned Pelican Datasets"
+description: "Folkbench open-sources Pelican Database: 507 canonical models across 68 providers deduplicated from 3,875 multi-source records, with 454 raw SVGs, 507 standardized PNG renders, models.dev alignment, and daily automated GitHub Actions sync powering model authenticity detection."
+category: Evaluation
+tags: [pelican-benchmark, open-database, model-authenticity, models.dev]
+authorId: cang-lin
+modelIds: [gpt-6-2-astra, claude-fable-5-2, gemini-4-neon, deepseek-v4-pro]
+benchmarkSlugs: []
+relatedSlugs: [how-to-score-a-cycling-pelican, how-folkbench-detects-model-degradation, did-the-model-get-dumber]
+publishedAt: '2026-11-22'
+updatedAt: '2026-11-22'
+sources:
+  - id: folkbench-pelican-db
+    label: Folkbench/pelican-database Open-Source Repository
+    url: https://github.com/Folkbench/pelican-database
+    checkedAt: '2026-11-22'
+    claimScope: official
+  - id: simon-pelican-tag
+    label: Simon Willison, pelican-riding-a-bicycle tag archive
+    url: https://simonwillison.net/tags/pelican-riding-a-bicycle/
+    checkedAt: '2026-11-22'
+    claimScope: official
+  - id: simon-pelican-repo
+    label: simonw/pelican-bicycle original experiment repository
+    url: https://github.com/simonw/pelican-bicycle
+    checkedAt: '2026-11-22'
+    claimScope: official
+  - id: unclek-pelicanmap
+    label: UncleK/pelicanmap daily multilingual pelican archive
+    url: https://github.com/UncleK/pelicanmap
+    checkedAt: '2026-11-22'
+    claimScope: observed
+  - id: models-dev
+    label: models.dev public model ID and metadata API
+    url: https://models.dev/api.json
+    checkedAt: '2026-11-22'
+    claimScope: official
+  - id: folkbench-arena
+    label: Folkbench Integrity Monitor
+    url: https://folkbench.com/en/arena
+    checkedAt: '2026-11-22'
+    claimScope: observed
+---
+
+> When a drawing of a pelican riding a bicycle stops being a passing social-media screenshot and becomes a standardized, searchable, daily-synced reference archive covering 507 models, a viral LLM meme turns into real engineering infrastructure for verifying model authenticity.
+
+Today, we are open-sourcing **[Folkbench/pelican-database](https://github.com/Folkbench/pelican-database)**—one of the largest and most comprehensive structured **"pelican riding a bicycle"** SVG and PNG reference databases in the world.
+
+Since October 2024, when Simon Willison popularized the prompt *"Generate an SVG of a pelican riding a bicycle,"* developers and researchers across the globe have tested hundreds of frontier and open-weight LLMs. Yet that remarkable visual record remained scattered across blog posts, X threads, GitHub Gists, static comparison tables, and independent galleries: model names were inconsistent, a single checkpoint appeared under dozens of informal aliases, and many entries survived only as compressed screenshots without raw SVG source code.
+
+`Folkbench/pelican-database` turns that fragmented record into a clean, machine-readable dataset aligned to **[models.dev](https://models.dev)** canonical identifiers and automatically kept up to date every day via GitHub Actions—built to power [Folkbench's](https://folkbench.com/en) model authenticity detection and visual baseline comparison.
+
+---
+
+## 1. By the Numbers: Why It Is One of the Largest and Most Complete Pelican Databases
+
+The usefulness of a reference dataset comes down to breadth, source-code fidelity, identifier consistency, and ongoing freshness. As of its initial public snapshot (2026-11-22), `Folkbench/pelican-database` delivers:
+
+| Dimension | Verified Count | Details |
+| --- | --- | --- |
+| **Aggregated Candidate Specimens** | **3,875** | Merged from UncleK/pelicanmap + all 161 Simon Willison tag posts, static HTML grids, and direct SVGs |
+| **Unique Canonical Models** | **507** | Deduplicated from **799** raw model strings into canonical `provider/model_id` entries |
+| **Providers Covered** | **68** | Spanning frontier labs, open-weight model families, and research platforms worldwide |
+| **Original `.svg` Source Coverage** | **454 (89.5%)** | Validated, parseable raw SVG source code rather than secondhand screenshots |
+| **Standardized `.png` Renders** | **507 (100%)** | Uniform 1024px white-background headless browser renders (or normalized PNGs), 0 missing |
+| **Exact Live `models.dev` Matches** | **378 (74.6%)** | Including 190 first-party provider matches; all 129 retired/historical models follow the same schema |
+| **Simon Willison Tested Models** | **177** | Flagged via `tested_by_simon`; automatically upgraded to raw `.svg` whenever available |
+| **Historical Time Span** | **2024-10-25 to 2026-11-21** | Over two years of spatial reasoning and SVG coding evolution i
```

**File**: `src/content/articles/es/folkbench-pelican-database.es.md` (added, +116/-0)
```diff
@@ -0,0 +1,116 @@
+---
+slug: folkbench-pelican-database
+translationKey: folkbench-pelican-database
+locale: es
+kind: article
+title: "Presentamos Folkbench Pelican Database: una de las bases de datos de pelícanos más grandes y completas alineada con models.dev"
+description: "Folkbench publica en código abierto Pelican Database: 507 modelos canónicos de 68 proveedores deduplicados desde 3.875 registros, con 454 SVG originales, 507 PNG estandarizados, alineación con models.dev y sincronización diaria automática."
+category: Evaluación
+tags: [pelican-benchmark, open-database, model-authenticity, models.dev]
+authorId: cang-lin
+modelIds: [gpt-6-2-astra, claude-fable-5-2, gemini-4-neon, deepseek-v4-pro]
+benchmarkSlugs: []
+relatedSlugs: [how-to-score-a-cycling-pelican, how-folkbench-detects-model-degradation, did-the-model-get-dumber]
+publishedAt: '2026-11-22'
+updatedAt: '2026-11-22'
+sources:
+  - id: folkbench-pelican-db
+    label: Repositorio abierto Folkbench/pelican-database
+    url: https://github.com/Folkbench/pelican-database
+    checkedAt: '2026-11-22'
+    claimScope: official
+  - id: simon-pelican-tag
+    label: Simon Willison, archivo de la etiqueta pelican-riding-a-bicycle
+    url: https://simonwillison.net/tags/pelican-riding-a-bicycle/
+    checkedAt: '2026-11-22'
+    claimScope: official
+  - id: simon-pelican-repo
+    label: Repositorio original simonw/pelican-bicycle
+    url: https://github.com/simonw/pelican-bicycle
+    checkedAt: '2026-11-22'
+    claimScope: official
+  - id: unclek-pelicanmap
+    label: Archivo diario multilingüe UncleK/pelicanmap
+    url: https://github.com/UncleK/pelicanmap
+    checkedAt: '2026-11-22'
+    claimScope: observed
+  - id: models-dev
+    label: API pública de IDs y metadatos de models.dev
+    url: https://models.dev/api.json
+    checkedAt: '2026-11-22'
+    claimScope: official
+  - id: folkbench-arena
+    label: Folkbench Integrity Monitor
+    url: https://folkbench.com/es/arena
+    checkedAt: '2026-11-22'
+    claimScope: observed
+---
+
+> Cuando el dibujo de un pelícano en bicicleta deja de ser una captura aislada en redes sociales y se convierte en un archivo de referencia estandarizado, consultable y actualizado a diario con 507 modelos, una prueba viral se transforma en infraestructura de ingeniería para verificar la autenticidad de los LLM.
+
+Hoy publicamos en código abierto **[Folkbench/pelican-database](https://github.com/Folkbench/pelican-database)**, una de las bases de datos de referencia SVG y PNG de **"un pelícano montando en bicicleta"** más grandes y completas del mundo.
+
+Desde que Simon Willison popularizó el prompt *"Generate an SVG of a pelican riding a bicycle"* en octubre de 2024, la comunidad ha evaluado cientos de modelos cerrados y de pesos abiertos. Sin embargo, esos resultados estaban dispersos entre blogs, hilos de X, GitHub Gists y galerías independientes, con nombres inconsistentes y muchas entradas limitadas a capturas comprimidas sin código SVG original.
+
+`Folkbench/pelican-database` unifica esas fuentes en un conjunto de datos limpio, alineado con los identificadores canónicos de **[models.dev](https://models.dev)** y sincronizado automáticamente cada día mediante GitHub Actions, diseñado para impulsar la detección de autenticidad de modelos en [Folkbench](https://folkbench.com/es).
+
+---
+
+## 1. En cifras: por qué es una de las bases de datos de pelícanos más completas
+
+En su primera publicación pública (2026-11-22), `Folkbench/pelican-database` reúne:
+
+| Dimensión | Cifra verificada | Detalle |
+| --- | --- | --- |
+| **Muestras candidatas agregadas** | **3.875** | Fusión de UncleK/pelicanmap + las 161 entradas de Simon Willison, tablas HTML estáticas y SVG directos |
+| **Modelos canónicos únicos** | **507** | Deduplicados desde **799** nombres originales hacia claves `provider/model_id` |
+| **Proveedores cubiertos** | **68** | Laboratorios de frontera, familias open-weight y plataformas experimentales |
+| **Cobertura de `.svg` original** | **454 (89,5%)** | Código fuente SVG validado y analizable, no solo capturas de pantalla |
+| **Renderizados `.png` estándar** | **507 (100%)** | Render uniforme de 1024px en fondo blanco vía navegador headless (0 faltantes) |
+| **Coincidencia exacta en `models.dev`** | **378 (74,6%)** | Incluye 190 proveedores de primera parte; los 129 modelos históricos siguen la misma convención |
+| **Modelos probados por Simon Willison** | **177** | Etiquetados con `tested_by_simon` y actualizados automáticamente a `.svg` cuando existe |
+| **Rango histórico** | **2024-10-25 a 2026-11-21** | Más de dos años de evolución en razonamiento espacial y generación SVG |
+
+![Evolución real de SVG entre modelos base de 2024 y modelos de frontera de 2026 en Folkbench Pelican Database para OpenAI, Anthropic y Google.](/blog/figures/folkbench-pelican-database/evolution-grid.png)
+
+*Figura 1: Seis archivos `.svg` originales renderizados directamente desde `Folkbench/pel
```

**File**: `src/content/articles/fr/folkbench-pelican-database.fr.md` (added, +116/-0)
```diff
@@ -0,0 +1,116 @@
+---
+slug: folkbench-pelican-database
+translationKey: folkbench-pelican-database
+locale: fr
+kind: article
+title: "Ouverture de Folkbench Pelican Database : l'une des plus vastes et complètes bases de données de pélicans alignée sur models.dev"
+description: "Folkbench publie Pelican Database en open source : 507 modèles canoniques de 68 fournisseurs issus de 3 875 sources, 454 SVG originaux, 507 PNG standardisés, alignement models.dev et synchronisation quotidienne automatique."
+category: Évaluation
+tags: [pelican-benchmark, open-database, model-authenticity, models.dev]
+authorId: cang-lin
+modelIds: [gpt-6-2-astra, claude-fable-5-2, gemini-4-neon, deepseek-v4-pro]
+benchmarkSlugs: []
+relatedSlugs: [how-to-score-a-cycling-pelican, how-folkbench-detects-model-degradation, did-the-model-get-dumber]
+publishedAt: '2026-11-22'
+updatedAt: '2026-11-22'
+sources:
+  - id: folkbench-pelican-db
+    label: Dépôt open source Folkbench/pelican-database
+    url: https://github.com/Folkbench/pelican-database
+    checkedAt: '2026-11-22'
+    claimScope: official
+  - id: simon-pelican-tag
+    label: Simon Willison, archive du tag pelican-riding-a-bicycle
+    url: https://simonwillison.net/tags/pelican-riding-a-bicycle/
+    checkedAt: '2026-11-22'
+    claimScope: official
+  - id: simon-pelican-repo
+    label: Dépôt original simonw/pelican-bicycle
+    url: https://github.com/simonw/pelican-bicycle
+    checkedAt: '2026-11-22'
+    claimScope: official
+  - id: unclek-pelicanmap
+    label: Archive multilingue quotidienne UncleK/pelicanmap
+    url: https://github.com/UncleK/pelicanmap
+    checkedAt: '2026-11-22'
+    claimScope: observed
+  - id: models-dev
+    label: API publique des identifiants et métadonnées models.dev
+    url: https://models.dev/api.json
+    checkedAt: '2026-11-22'
+    claimScope: official
+  - id: folkbench-arena
+    label: Folkbench Integrity Monitor
+    url: https://folkbench.com/fr/arena
+    checkedAt: '2026-11-22'
+    claimScope: observed
+---
+
+> Lorsqu'un pélican à vélo cesse d'être une capture d'écran éphémère pour devenir une base de référence standardisée, interrogeable et mise à jour quotidiennement couvrant 507 modèles, un test viral devient une véritable infrastructure d'ingénierie pour vérifier l'authenticité des LLM.
+
+Nous publions aujourd'hui en open source **[Folkbench/pelican-database](https://github.com/Folkbench/pelican-database)** — l'une des bases de données SVG et PNG **« pelican riding a bicycle »** les plus vastes et complètes au monde.
+
+Depuis octobre 2024 et le célèbre prompt de Simon Willison *"Generate an SVG of a pelican riding a bicycle"*, des centaines de modèles propriétaires et open-weight ont été testés. Mais ces résultats restaient éparpillés entre billets de blog, fils X, Gists GitHub et galeries, avec des noms hétérogènes et souvent uniquement des captures compressées.
+
+`Folkbench/pelican-database` unifie ces sources en un jeu de données aligné sur **[models.dev](https://models.dev)** et synchronisé chaque jour via GitHub Actions pour alimenter la détection d'authenticité des modèles sur [Folkbench](https://folkbench.com/fr).
+
+---
+
+## 1. En chiffres : pourquoi c'est l'une des bases de pélicans les plus complètes
+
+Au premier instantané public (2026-11-22), `Folkbench/pelican-database` réunit :
+
+| Dimension | Chiffre vérifié | Détails |
+| --- | --- | --- |
+| **Spécimens candidats agrégés** | **3 875** | Fusion d'UncleK/pelicanmap + les 161 articles, grilles HTML statiques et SVG directs de Simon Willison |
+| **Modèles canoniques uniques** | **507** | Dédupliqués depuis **799** alias bruts vers des clés `provider/model_id` |
+| **Fournisseurs couverts** | **68** | Laboratoires de pointe et familles open-weight du monde entier |
+| **Couverture en `.svg` original** | **454 (89,5 %)** | Code source SVG validé et exploitable plutôt que de simples captures |
+| **Rendus `.png` standardisés** | **507 (100 %)** | Rendu uniforme 1024px sur fond blanc via navigateur headless (0 manquant) |
+| **Correspondance exacte `models.dev`** | **378 (74,6 %)** | Dont 190 fournisseurs natifs ; les 129 modèles historiques suivent le même schéma |
+| **Modèles testés par Simon Willison** | **177** | Marqués `tested_by_simon` et enrichis en `.svg` original dès que disponible |
+| **Période couverte** | **2024-10-25 au 2026-11-21** | Plus de deux ans d'évolution du raisonnement spatial et de la génération SVG |
+
+![Évolution réelle des SVG entre les modèles 2024 et les modèles frontière 2026 dans Folkbench Pelican Database pour OpenAI, Anthropic et Google.](/blog/figures/folkbench-pelican-database/evolution-grid.png)
+
+*Figure 1 : Six fichiers `.svg` originaux rendus directement depuis `Folkbench/pelican-database`. En haut (octobre 2024) : `openai/gpt-4o`, `anthropic/claude-3-5-sonnet-20241022` et `google/gemini-1.5-pro-001`. En bas (novembre 2026) : `openai/gpt-6.2-astra`, `anthropic/claude-fable-5-2` et `google/gemini-4-neo
```

**File**: `src/content/articles/id/folkbench-pelican-database.id.md` (added, +116/-0)
```diff
@@ -0,0 +1,116 @@
+---
+slug: folkbench-pelican-database
+translationKey: folkbench-pelican-database
+locale: id
+kind: article
+title: "Merilis Open-Source Folkbench Pelican Database: Salah Satu Basis Data Pelikan Terbesar dan Terlengkap Selaras models.dev"
+description: "Folkbench merilis Pelican Database secara terbuka: 507 model kanonis dari 68 penyedia yang dikurasi dari 3.875 catatan multi-sumber, 454 SVG asli, 507 PNG terstandar, selaras models.dev dan sinkronisasi harian otomatis."
+category: Evaluasi
+tags: [pelican-benchmark, open-database, model-authenticity, models.dev]
+authorId: cang-lin
+modelIds: [gpt-6-2-astra, claude-fable-5-2, gemini-4-neon, deepseek-v4-pro]
+benchmarkSlugs: []
+relatedSlugs: [how-to-score-a-cycling-pelican, how-folkbench-detects-model-degradation, did-the-model-get-dumber]
+publishedAt: '2026-11-22'
+updatedAt: '2026-11-22'
+sources:
+  - id: folkbench-pelican-db
+    label: Repositori open-source Folkbench/pelican-database
+    url: https://github.com/Folkbench/pelican-database
+    checkedAt: '2026-11-22'
+    claimScope: official
+  - id: simon-pelican-tag
+    label: Simon Willison, arsip tag pelican-riding-a-bicycle
+    url: https://simonwillison.net/tags/pelican-riding-a-bicycle/
+    checkedAt: '2026-11-22'
+    claimScope: official
+  - id: simon-pelican-repo
+    label: Repositori eksperimen asli simonw/pelican-bicycle
+    url: https://github.com/simonw/pelican-bicycle
+    checkedAt: '2026-11-22'
+    claimScope: official
+  - id: unclek-pelicanmap
+    label: Arsip pelikan multibahasa harian UncleK/pelicanmap
+    url: https://github.com/UncleK/pelicanmap
+    checkedAt: '2026-11-22'
+    claimScope: observed
+  - id: models-dev
+    label: API publik ID model dan metadata models.dev
+    url: https://models.dev/api.json
+    checkedAt: '2026-11-22'
+    claimScope: official
+  - id: folkbench-arena
+    label: Folkbench Integrity Monitor
+    url: https://folkbench.com/id/arena
+    checkedAt: '2026-11-22'
+    claimScope: observed
+---
+
+> Ketika gambar pelikan mengendarai sepeda tidak lagi sekadar tangkapan layar media sosial, melainkan menjadi arsip referensi terstandar yang dapat dicari dan diperbarui setiap hari untuk 507 model, uji viral itu berubah menjadi infrastruktur rekayasa nyata untuk memverifikasi keaslian LLM.
+
+Hari ini kami merilis secara open-source **[Folkbench/pelican-database](https://github.com/Folkbench/pelican-database)** — salah satu basis data referensi SVG dan PNG **"pelican riding a bicycle"** terbesar dan terlengkap di dunia.
+
+Sejak Oktober 2024 saat Simon Willison mempopulerkan prompt *"Generate an SVG of a pelican riding a bicycle"*, ratusan model frontier dan open-weight telah diuji. Namun hasilnya tersebar di blog, utas X, GitHub Gist, dan galeri dengan penamaan tidak konsisten serta banyak yang hanya berupa tangkapan layar tanpa kode SVG asli.
+
+`Folkbench/pelican-database` menyatukan sumber-sumber tersebut ke dalam dataset bersih yang selaras dengan ID kanonis **[models.dev](https://models.dev)** dan diperbarui otomatis setiap hari melalui GitHub Actions untuk menggerakkan deteksi keaslian model di [Folkbench](https://folkbench.com/id).
+
+---
+
+## 1. Dalam Angka: Mengapa Menjadi Salah Satu Basis Data Pelikan Terlengkap
+
+Pada snapshot publik perdana (2026-11-22), `Folkbench/pelican-database` mencakup:
+
+| Dimensi | Angka Terverifikasi | Detail |
+| --- | --- | --- |
+| **Total Sampel Kandidat** | **3.875** | Gabungan UncleK/pelicanmap + 161 pos tag, tabel HTML statis, dan SVG langsung Simon Willison |
+| **Model Kanonis Unik** | **507** | Dideduplikasi dari **799** nama mentah menjadi kunci `provider/model_id` |
+| **Penyedia Tercakup** | **68** | Meliputi lab frontier dan keluarga model open-weight global |
+| **Cakupan `.svg` Asli** | **454 (89,5%)** | Kode sumber SVG tervalidasi, bukan sekadar tangkapan layar |
+| **Render `.png` Terstandar** | **507 (100%)** | Render seragam 1024px latar putih via peramban headless (0 hilang) |
+| **Kecocokan Tepat `models.dev`** | **378 (74,6%)** | Termasuk 190 penyedia pihak pertama; 129 model historis mengikuti skema yang sama |
+| **Diuji oleh Simon Willison** | **177** | Ditandai `tested_by_simon` dengan prioritas pemulihan `.svg` asli |
+| **Rentang Waktu** | **2024-10-25 hingga 2026-11-21** | Lebih dari dua tahun evolusi penalaran spasial dan pembuatan SVG |
+
+![Evolusi SVG asli antara baseline 2024 dan model frontier 2026 di Folkbench Pelican Database untuk OpenAI, Anthropic, dan Google.](/blog/figures/folkbench-pelican-database/evolution-grid.png)
+
+*Gambar 1: Enam berkas `.svg` asli dirender langsung dari `Folkbench/pelican-database`. Baris atas (Oktober 2024): `openai/gpt-4o`, `anthropic/claude-3-5-sonnet-20241022`, `google/gemini-1.5-pro-001`. Baris bawah (November 2026): `openai/gpt-6.2-astra`, `anthropic/claude-fable-5-2`, `google/gemini-4-neon`.*
+
+---
+
+## 2. Lima Pilar Rekayasa
+
+![Gambar 2: Arsitektur pengumpulan multi-sumber, penyelarasan models.dev, re
```

**File**: `src/content/articles/ja/folkbench-pelican-database.ja.md` (added, +116/-0)
```diff
@@ -0,0 +1,116 @@
+---
+slug: folkbench-pelican-database
+translationKey: folkbench-pelican-database
+locale: ja
+kind: article
+title: "Folkbench Pelican Database をオープンソース公開：models.dev 準拠・507 モデルを網羅する世界最大級のペリカンデータベース"
+description: "Folkbench は Pelican Database を公開しました。3,875 件の複数ソース標本から 507 の正規モデル・68 プロバイダー・454 件のオリジナル SVG と 507 枚の標準 PNG を整備し、models.dev 準拠と毎日の自動差分同期でモデル真正性検証を支えます。"
+category: 評価
+tags: [ペリカンベンチマーク, オープンデータベース, モデル真正性, models.dev]
+authorId: cang-lin
+modelIds: [gpt-6-2-astra, claude-fable-5-2, gemini-4-neon, deepseek-v4-pro]
+benchmarkSlugs: []
+relatedSlugs: [how-to-score-a-cycling-pelican, how-folkbench-detects-model-degradation, did-the-model-get-dumber]
+publishedAt: '2026-11-22'
+updatedAt: '2026-11-22'
+sources:
+  - id: folkbench-pelican-db
+    label: Folkbench/pelican-database オープンソースリポジトリ
+    url: https://github.com/Folkbench/pelican-database
+    checkedAt: '2026-11-22'
+    claimScope: official
+  - id: simon-pelican-tag
+    label: Simon Willison, pelican-riding-a-bicycle タグアーカイブ
+    url: https://simonwillison.net/tags/pelican-riding-a-bicycle/
+    checkedAt: '2026-11-22'
+    claimScope: official
+  - id: simon-pelican-repo
+    label: simonw/pelican-bicycle オリジナル実験リポジトリ
+    url: https://github.com/simonw/pelican-bicycle
+    checkedAt: '2026-11-22'
+    claimScope: official
+  - id: unclek-pelicanmap
+    label: UncleK/pelicanmap 日次更新多言語ペリカンアーカイブ
+    url: https://github.com/UncleK/pelicanmap
+    checkedAt: '2026-11-22'
+    claimScope: observed
+  - id: models-dev
+    label: models.dev 公開モデル ID・メタデータ API
+    url: https://models.dev/api.json
+    checkedAt: '2026-11-22'
+    claimScope: official
+  - id: folkbench-arena
+    label: Folkbench 劣化監視（Integrity Monitor）
+    url: https://folkbench.com/ja/arena
+    checkedAt: '2026-11-22'
+    claimScope: observed
+---
+
+> 「自転車に乗るペリカン」の SVG が単なる SNS のスクリーンショットを超え、507 モデルを網羅し毎日自動更新される標準参照ベースラインへと整備されたとき、それはモデルの真正性を検証するための実用的なエンジニアリング基盤になります。
+
+本日、私たちは **[Folkbench/pelican-database](https://github.com/Folkbench/pelican-database)** をオープンソース公開します。これは、LLM による「自転車に乗るペリカン（Pelican Riding a Bicycle）」の SVG・PNG 参照データセットとして**世界最大級かつ最も体系的に整備されたデータベースの一つ**です。
+
+2024 年 10 月に Simon Willison が *"Generate an SVG of a pelican riding a bicycle"* というプロンプトを広めて以来、世界中の開発者が数百ものフロンティアおよびオープンウェイトモデルをテストしてきました。しかし、これらの記録はブログ記事、X 投稿、GitHub Gist、比較表、コミュニティギャラリーに分散しており、モデル名の表記揺れやオリジナル SVG 欠損（スクリーンショットのみ）が自動評価への活用を阻んでいました。
+
+`Folkbench/pelican-database` は、これらを体系的に収集・正規化し、**[models.dev](https://models.dev)** の標準 ID（`provider/model_id`）へ統合、GitHub Actions による毎日の自動差分同期を備えたオープンリポジトリとして構築され、[Folkbench](https://folkbench.com/ja) のモデル真正性検証を支えます。
+
+---
+
+## 1. 数字で見る規模と網羅性
+
+初回公開スナップショット（2026-11-22）の検証済み統計は以下の通りです。
+
+| 項目 | 実績値 | 詳細 |
+| --- | --- | --- |
+| **統合候補標本数** | **3,875 件** | UncleK/pelicanmap + Simon Willison の全 161 記事・静的 HTML 比較表・直接リンク SVG を統合 |
+| **正規化後ユニークモデル数** | **507 モデル** | **799 種**の表記揺れ・エイリアスを正規 `provider/model_id` へ集約 |
+| **対象プロバイダー数** | **68 社/組織** | 主要商用ラボからオープンウェイト開発チームまで網羅 |
+| **オリジナル `.svg` 保有率** | **454 モデル（89.5%）** | XML/タグ検証済みの解析可能な SVG ソースコードを収録 |
+| **統一 `.png` レンダリング** | **507 モデル（100%）** | ヘッドレスブラウザで 1024px 白背景に統一レンダリング（欠損 0） |
+| **現行 `models.dev` 完全一致** | **378 モデル（74.6%）** | うち 190 モデルが一次プロバイダー一致。過去モデル 129 件も同一命名規則で正規化 |
+| **Simon Willison 実測カバー** | **177 モデル** | `tested_by_simon` を付与し、原本 SVG がある場合は優先採用 |
+| **収録期間** | **2024-10-25 〜 2026-11-21** | 2 年以上にわたる空間推論と SVG 生成能力の進化を記録 |
+
+![Folkbench Pelican Database における 2024 年ベースラインと 2026 年フロンティアモデルのオリジナル SVG 進化比較（OpenAI、Anthropic、Google）。](/blog/figures/folkbench-pelican-database/evolution-grid.png)
+
+*図 1：`Folkbench/pelican-database` のオリジナル `.svg` から直接レンダリングした 6 標本。上段（2024 年 10 月）は `openai/gpt-4o`、`anthropic/claude-3-5-sonnet-20241022`、`google/gemini-1.5-pro-001`、下段（2026 年 11 月）は `openai/gpt-6.2-astra`、`anthropic/claude-fable-5-2`、`google/gemini-4-neon`。*
+
+---
+
+## 2. 本番評価システム向け 5 つのエンジニアリング設計
+
+![図 2 アーキテクチャ図：Folkbench Pelican Database のマルチソース収集、models.dev 準拠正規化、SHA-256 差分レンダリング、および毎日の自動同期パイプライン。](/blog/figures/folkbench-pelican-database/pipeline-architecture-en.svg)
+
+1. **マルチソース復元でスクリーンショットから SVG 原本を回収**：[UncleK/pelicanmap](https://github.com/UncleK/pelicanmap)[^unclek-pelicanmap] と [Simon Willison の全 161 記事](https://simonwillison.net/tags/pelican-riding-a-bicycle/)[^simon-pelican-tag] を照合し、`static.simonwillison.net` の比較 HTML に埋め込まれた 180 件の base64 SVG と直リンク SVG を復元。**「原本 `.svg` > Simon 実測 > classic プロンプト > 標準/高推論設定」** の決定論的ルールで代表標本を選定しています。
+2. **`models.dev` 準拠とネイティブ開発元への正規化**：[`models.dev/api.json`](https://models.dev/api.json)[^models-dev] に基づき、OpenAI（72）、Google（64）、Alibaba/Qwen（63）、Anthropic（30）、Meta（21）、Mistral（21）、DeepSeek（19）、Z.AI/GLM（19）、xAI（16）など 68 プロバイダーへ正確に帰属させ、799 件の元表記を `model_aliases` テーブルに保存しています。
+3. **ヘッドレスブラウザ統一レンダリング**：クロスプラットフォームの Chromium/Edge CDP を用い、隔離された `<img>` サンドボックス内で 1024px 白背景 PNG へレンダリングし、全 507 ファイルのヘッダと解像度を検証しています。
+4. **ファイル + JSON + SQLite の即時利用**：`models/<provider>/<model_id>.{svg,png}`、`catalog.json`、および 4 テーブル＋2 ビューを備えた `p
```

**File**: `src/content/articles/ko/folkbench-pelican-database.ko.md` (added, +116/-0)
```diff
@@ -0,0 +1,116 @@
+---
+slug: folkbench-pelican-database
+translationKey: folkbench-pelican-database
+locale: ko
+kind: article
+title: "Folkbench Pelican Database 오픈소스 공개: models.dev 정렬·507개 모델을 아우르는 세계 최대급 펠리컨 데이터베이스"
+description: "Folkbench가 Pelican Database를 오픈소스로 공개합니다. 3,875개 다중 출처 표본에서 507개 정규 모델, 68개 제공사, 454개 원본 SVG 및 507개 표준 PNG를 정제하고 models.dev 정렬과 일일 자동 동기화로 모델 진위 검증을 지원합니다."
+category: 평가
+tags: [펠리컨벤치마크, 오픈데이터베이스, 모델진위검증, models.dev]
+authorId: cang-lin
+modelIds: [gpt-6-2-astra, claude-fable-5-2, gemini-4-neon, deepseek-v4-pro]
+benchmarkSlugs: []
+relatedSlugs: [how-to-score-a-cycling-pelican, how-folkbench-detects-model-degradation, did-the-model-get-dumber]
+publishedAt: '2026-11-22'
+updatedAt: '2026-11-22'
+sources:
+  - id: folkbench-pelican-db
+    label: Folkbench/pelican-database 오픈소스 저장소
+    url: https://github.com/Folkbench/pelican-database
+    checkedAt: '2026-11-22'
+    claimScope: official
+  - id: simon-pelican-tag
+    label: Simon Willison, pelican-riding-a-bicycle 태그 아카이브
+    url: https://simonwillison.net/tags/pelican-riding-a-bicycle/
+    checkedAt: '2026-11-22'
+    claimScope: official
+  - id: simon-pelican-repo
+    label: simonw/pelican-bicycle 원본 실험 저장소
+    url: https://github.com/simonw/pelican-bicycle
+    checkedAt: '2026-11-22'
+    claimScope: official
+  - id: unclek-pelicanmap
+    label: UncleK/pelicanmap 일일 업데이트 다국어 펠리컨 아카이브
+    url: https://github.com/UncleK/pelicanmap
+    checkedAt: '2026-11-22'
+    claimScope: observed
+  - id: models-dev
+    label: models.dev 공개 모델 ID 및 메타데이터 API
+    url: https://models.dev/api.json
+    checkedAt: '2026-11-22'
+    claimScope: official
+  - id: folkbench-arena
+    label: Folkbench 무결성 모니터(Integrity Monitor)
+    url: https://folkbench.com/ko/arena
+    checkedAt: '2026-11-22'
+    claimScope: observed
+---
+
+> '자전거 타는 펠리컨' 그림이 단순한 SNS 스크린샷을 넘어 507개 모델을 아우르고 매일 자동 갱신되는 표준 참조 기준선으로 정리되면, 바이럴 벤치마크는 모델의 진위 여부를 검증하는 실질적인 엔지니어링 인프라가 됩니다.
+
+오늘 우리는 **[Folkbench/pelican-database](https://github.com/Folkbench/pelican-database)** 를 오픈소스로 공개합니다. 이는 LLM이 생성한 '자전거 타는 펠리컨(Pelican Riding a Bicycle)' SVG 및 PNG 참조 데이터셋 중 **세계 최대 규모이자 가장 체계적으로 구축된 데이터베이스 중 하나**입니다.
+
+2024년 10월 Simon Willison이 *"Generate an SVG of a pelican riding a bicycle"* 프롬프트를 대중화한 이후 전 세계 개발자들이 수백 개의 프런티어 및 오픈웨이트 모델을 테스트해 왔습니다. 하지만 기록들이 블로그, X, GitHub Gist, HTML 비교표와 갤러리에 흩어져 있어 모델 명칭이 제각각이고 원본 SVG 없이 스크린샷만 남은 경우가 많았습니다.
+
+`Folkbench/pelican-database`는 이를 체계적으로 수집·정제하고 **[models.dev](https://models.dev)** 표준 식별자(`provider/model_id`)에 맞춘 뒤, GitHub Actions로 매일 증분 동기화하여 [Folkbench](https://folkbench.com/ko)의 모델 진위 검증을 구동합니다.
+
+---
+
+## 1. 숫자로 보는 규모와 완성도
+
+초기 공개 스냅샷(2026-11-22) 기준 핵심 지표는 다음과 같습니다.
+
+| 항목 | 검증 수치 | 세부 내용 |
+| --- | --- | --- |
+| **통합 후보 표본** | **3,875개** | UncleK/pelicanmap + Simon Willison 태그 글 161편·정적 HTML 비교표·직접 링크 SVG 통합 |
+| **정규화된 고유 모델** | **507개** | **799개**의 비정형 모델명 별칭을 표준 `provider/model_id`로 통합 |
+| **포함된 제공사** | **68곳** | 주요 상용 AI 연구소부터 오픈웨이트 모델 패밀리까지 포괄 |
+| **원본 `.svg` 확보율** | **454개 (89.5%)** | XML 및 태그 검증을 통과한 파싱 가능한 원본 SVG 소스코드 |
+| **표준 `.png` 렌더링** | **507개 (100%)** | 헤드리스 브라우저 기반 1024px 흰 배경 통일 렌더링(누락 0건) |
+| **실시간 `models.dev` 정확 일치** | **378개 (74.6%)** | 190개 퍼스트파티 제공사 일치 포함, 종료된 구버전 129개도 동일 규격 정규화 |
+| **Simon Willison 테스트 포함** | **177개** | `tested_by_simon` 플래그 기록 및 원본 SVG 우선 확보 |
+| **수록 기간** | **2024-10-25 ~ 2026-11-21** | 2년 이상 걸친 공간 추론 및 SVG 코드 생성 역량의 진화 기록 |
+
+![Folkbench Pelican Database 내 2024년 기준선과 2026년 프런티어 모델의 원본 SVG 진화 비교(OpenAI, Anthropic, Google).](/blog/figures/folkbench-pelican-database/evolution-grid.png)
+
+*그림 1: `Folkbench/pelican-database`의 원본 `.svg`에서 직접 렌더링한 6개 표본. 상단(2024년 10월)은 `openai/gpt-4o`, `anthropic/claude-3-5-sonnet-20241022`, `google/gemini-1.5-pro-001`, 하단(2026년 11월)은 `openai/gpt-6.2-astra`, `anthropic/claude-fable-5-2`, `google/gemini-4-neon`입니다.*
+
+---
+
+## 2. 프로덕션급 아카이브를 위한 5가지 엔지니어링 설계
+
+![그림 2 아키텍처: Folkbench Pelican Database의 다중 출처 수집, models.dev 정규화, SHA-256 증분 렌더링 및 일일 자동 동기화 파이프라인.](/blog/figures/folkbench-pelican-database/pipeline-architecture-en.svg)
+
+1. **다중 출처 복원으로 원본 SVG 회수**: [UncleK/pelicanmap](https://github.com/UncleK/pelicanmap)[^unclek-pelicanmap] 일일 아카이브와 [Simon Willison의 전체 161편 글](https://simonwillison.net/tags/pelican-riding-a-bicycle/)[^simon-pelican-tag]을 교차 수집해 `static.simonwillison.net` 비교표의 base64 SVG 180건과 직링크 SVG를 복원했으며, **원본 `.svg` > Simon 실측 > classic 프롬프트 > 기본/고추론 설정** 우선순위로 대표 표본을 선정합니다.
+2. **`models.dev` 정렬 및 원개발사 귀속 보정**: [`models.dev/api.json`](https://models.dev/api.json)[^models-dev]을 기준으로 OpenAI(72), Google(64), Alibaba/Qwen(63), Anthropic(30), Meta(21), Mistral(21), DeepSeek(19), Z.AI/GLM(19), xAI(16) 등 68개 제공사로 정규화하고, 799개 원본 별칭을 `model_aliases` 테이블에 보존합니다.
+3. **헤드리스 브라우저 통일 렌더링 및 무결성 검증**: 크로스플랫폼 Chromium/Edge CDP로 격리된 `<img>` 샌드박스에서 1024px 흰 배경 PNG를 생성하고 507개 전체의 파일 헤더와 해상도를 검증했습니다.
+4. **파일 + JSON + SQLite 즉시 활용**: `models/<provider>/<model_id>.{svg,png}`, `catalog.json`, 그리고 4개 테이블과 2개 뷰를 갖춘 `pelicans.sqlite`를 함께 제공합니다.

```

---

### Incident Patch 2: `fe9249fb` (2026-11-22)
**Commit Message**: 去掉公开快照里把数据称为的说明。

产品变化：
- 公开快照说明只保留排序沿用主站规则，以及合作档位和运营加权。
- 页面不再写。

核心实现：
- 更新仓库说明、分发文案和对应测试里的固定句子。

迁移与兼容：
- 不改快照字段、policy 标识或已归档 JSON。

运维影响：
- 只更新这个仓库的说明文本，不改主站运行容器。

验证：
- 提交钩子按该仓库的检查执行。

**File**: `README.md` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@
 
 ## AI API 中转站推荐与选站指南
 
-> 排序遵循 Folkbench 站点规则，包含合作等级和运营加权；部分数据为。
+> 排序遵循 Folkbench 站点规则，包含合作等级和运营加权。
 
 ### 中转站怎么选
 
```

**File**: `scripts/distribution/distribution.test.ts` (modified, +1/-1)
```diff
@@ -51,7 +51,7 @@ test('README preserves all bytes outside markers, includes disclosure and avoids
   const original=`中文前缀\r\n${START}\r\nold\r\n${END}\r\n尾部 unchanged\r\n`
   const result=updateReadme(original,input());assert.equal(result.slice(0,result.indexOf(START)),original.slice(0,original.indexOf(START)));assert.equal(result.slice(result.indexOf(END)),original.slice(original.indexOf(END)))
   for (const tag of result.match(/<details\b[^>]*>/gi) ?? []) assert.match(tag, /\bopen(?:\s|=|>)/i)
-  assert.match(result,/今日|快照/u);assert.match(result,//u);assert.match(result,/快照收录 1 条探针结果，覆盖 1 家站点/u);assert.match(result,/2026-11-09 20:00:00/u);assert.doesNotMatch(result,/过去 24 小时.*运行/u)
+  assert.match(result,/今日|快照/u);assert.match(result,/合作档位/u);assert.match(result,/快照收录 1 条探针结果，覆盖 1 家站点/u);assert.match(result,/2026-11-09 20:00:00/u);assert.doesNotMatch(result,/过去 24 小时.*运行/u)
   assert.equal(updateReadme(result,input()),result);assert.throws(()=>updateReadme(original+START,input()),/markers/)
 })
 test('selection follows source order, not scores',()=>{
```

**File**: `scripts/distribution/sites.ts` (modified, +7/-7)
```diff
@@ -45,13 +45,13 @@ export async function buildRelaySite(root: string, snapshot: PublicDataExport, h
   let home=intro+cards([['公开站点',snapshot.stations.length],['榜单模型',snapshot.boards.length],['收录探针结果',snapshot.integrity.length]])+`<h2>与前一日快照比较</h2>${prior?changes.length?`<ul>${changes.map(change=>`<li>${e(change)}</li>`).join('')}</ul>`:'<p>展示顺序没有变化。</p>':'<p>暂无前一日快照。</p>'}`
   const homeItems:unknown[]=[]
   for(const board of snapshot.boards){ const rows=selectedRows(snapshot,board.model_id,5);if(!rows.length)continue;const name=rows[0]!.model_name;home+=`<h2><a href="${base}models/${board.model_id}/">${e(name)}</a></h2>${rankingTable(rows)}`;homeItems.push({'@type':'ListItem',position:homeItems.length+1,name,url:`https://folkbench.github.io${base}models/${board.model_id}/`}) }
-  pages.push({path:'',title:`AI API 中转站公开快照 · ${date}`,description:`${date} 的 Folkbench 主站公开榜单快照、价格和探针汇总。含，沿用主站排序。`,body:home,date,structured:{'@context':'https://schema.org','@type':'ItemList',itemListElement:homeItems}})
+  pages.push({path:'',title:`AI API 中转站公开快照 · ${date}`,description:`${date} 的 Folkbench 主站公开榜单快照、价格和探针汇总。沿用主站排序。`,body:home,date,structured:{'@context':'https://schema.org','@type':'ItemList',itemListElement:homeItems}})
   for(const board of snapshot.boards){const rows=snapshot.rankings.filter(row=>row.model_id===board.model_id);const selected=selectedRows(snapshot,board.model_id);const other=rows.filter(row=>!selected.includes(row));const catalogModel=snapshot.models.find(row=>row.id===board.model_id);const name=catalogModel?.name??board.model_id;const official=catalogModel?.official_price;const officialBlock=official?`<p>官方参考价：输入 ${e(price(official.input,official.currency,official.unit))} / 输出 ${e(price(official.output,official.currency,official.unit))} · 来源 ${official.source_url?`<a href="${e(official.source_url)}">${e(official.source_label)}</a>`:e(official.source_label)} · 核验 ${e(official.verified_at)}</p>`:'';const past=history.filter(item=>item.date<=date&&Date.parse(`${date}T00:00:00Z`)-Date.parse(`${item.date}T00:00:00Z`)<30*86_400_000);const trend=past.flatMap(item=>item.rankings.filter(row=>row.model_id===board.model_id).map(row=>[e(item.date),e(row.station_name),e(row.rank_published??'—'),percent(row.overall_bps)]));pages.push({path:`models/${board.model_id}/`,title:`${name} 中转站公开快照 · ${date}`,description:`${name} 的 ${rows.length} 条公开线路记录、价格和已有历史快照。`,date,body:`<h1>${e(name)} 公开快照</h1><p class="muted">来源窗口：${e(board.observed_window??'—')} · 方法：${e(board.method_version??'—')}</p>${officialBlock}${rankingTable(selected)}<h2>仅收录或未验证</h2><div class="catalog">${other.length?rankingTable(other):'<p>无其他记录。</p>'}</div><h2>近 7 / 30 天已有快照</h2>${table(['日期','中转站','来源名次','综合'],trend)}<p><a class="button" href="${e(mainLink(`/rankings/${board.model_id}`,'pages','relay-board','model-full-board'))}">查看主站完整榜单</a></p>${relatedViews('relay-rank',snapshot,'model',board.model_id,name)}`,structured:{'@context':'https://schema.org','@type':'ItemList',itemListElement:rows.map((row,i)=>({'@type':'ListItem',position:i+1,name:row.station_name,url:mainLink(`/services/${row.station_slug}`,'pages','relay-board','structured-station')}))}})}
   for(const station of snapshot.stations){const rows=snapshot.rankings.filter(row=>row.station_slug===station.slug);const probes=snapshot.integrity.filter(row=>row.station_slug===station.slug);pages.push({path:`stations/${station.slug}/`,title:`${station.name} · 公开快照 ${date}`,description:`${station.name} 在 ${date} 公开快照中的榜单、价格、安全等级和探针汇总。`,date,body:`<h1>${e(station.name)} 公开快照</h1>${cards([['安全等级',station.data_security_level],['榜单记录',rows.length],['收录探针结果',probes.length]])}<p>收录状态：${e(station.listing_status==='catalog_only'?'仅收录':'常规收录')} · 首次收录：${e(station.first_listed_at??'—')} · 安全核验状态：${e(station.data_security_validity)} · 核验日期：${e(station.checked_at??'—')}</p>${rows.length?table(['模型','来源名次','可用率','输出价'],rows.map(row=>[`<a href="${base}models/${row.model_id}/">${e(row.model_name)}</a>`,e(row.rank_published??'—'),percent(row.availability_bps),e(price(row.output_price,row.output_price_currency,row.output_price_unit))])):'<p>本快照没有该站的榜单记录。</p>'}<h2>公开探针汇总</h2>${probes.length?probeTable(probes,'relay-board'):'<p>没有公开探针汇总。</p>'}<p><a class="button" href="${e(mainLink(`/services/${station.slug}`,'pages','relay-board','station-full-profile'))}">查看主站完整档案</a></p>${relatedViews('relay-rank',snapshot,'station',station.slug,station.name)}`})}
   pages.push({path:'history/',title:'历史公开快照',description:'按日期浏览 Folkbench 已归档公开快照；缺失日期不补造。',date,body:`<h1>历史公开快照</h1>${table(['归档日期','快照版本'],history.toReversed().map(item=>[`<a href="${DATA_REPO}/tree/main/${archivePath(item.date)}">${item.date}</a>`,`<code>${e(item.snapshot_version)}</code>`]))}<h2>全部公开站点</h2><ul>${snapshot.stations.map(station=>`<li><a href="${base}stations/${station.slug}/">${e(station.name)}</a></li>`).join('')}</ul>`,structured:{'@context':'https://schema.org','@type':'Dataset',name:'Folkbench 公开快照',description:NOTICE,url:`https://folkb
```

**File**: `scripts/distribution/subsites.ts` (modified, +1/-1)
```diff
@@ -119,7 +119,7 @@ export function identitySnapshotPages(snapshot:PublicDataExport,history:PublicDa
   const mismatches=rows.filter(row=>row.identified_model_id!==null&&row.identified_model_id!==row.model_id)
   const stats=`快照收录 ${rows.length} 条探针结果、覆盖 ${stations.length} 家站点`
   const total=rows.reduce((sum,row)=>sum+row.total,0),agree=rows.reduce((sum,row)=>sum+row.agree,0)
-  const pages:SubsitePage[]=[{path:'/',title:`模型身份探针公开快照 · ${snapshot.date}`,description:`Folkbench ${snapshot.date} 公开快照的身份探针汇总。${stats}。。单次结果不能证明模型被替换。`,body:`<h1>模型身份探针公开快照</h1><p class="lede">${stats}。下面是按模型和站点查看的公开汇总，以及指纹识别结果与申报模型不一致的观察。单次结果不能证明模型被替换。</p>${stamp(snapshot)}<p>覆盖 ${models.length} 个模型 · 汇总一致率 ${e(agreement(agree,total))}</p><section class="signals"><h2>指纹观察</h2><p>这是公开快照中的指纹观察，单次结果不能证明模型被替换。</p>${sharedBaseNotice(rows)}${mismatches.length?table(['申报模型','识别结果','站点','分组','agree / total','测量时间'],mismatches.map(row=>[`${cell(modelName(snapshot,row.model_id))}<br><small>${e(row.model_id)}</small>`,cell(row.identified_model_id),stationLink(site,snapshot,row.station_slug),cell(row.group_name),e(agreement(row.agree,row.total)),cell(row.measured_at)]),'fingerprint-observations'):'<p>本日快照未收录标识不同的指纹观察。</p>'}</section><h2 id="models">按模型查看</h2>${table(['模型','公开结果条数'],models.map(id=>[link(`/models/${pathId(id)}/`,modelName(snapshot,id)),String(rows.filter(row=>row.model_id===id).length)]),'probe-models')}<h2 id="stations">按站点查看</h2>${table(['站点','公开结果条数'],stations.map(slug=>[link(`/stations/${pathId(slug)}/`,stationName(snapshot,slug)),String(rows.filter(row=>row.station_slug===slug).length)]),'probe-stations')}`}]
+  const pages:SubsitePage[]=[{path:'/',title:`模型身份探针公开快照 · ${snapshot.date}`,description:`Folkbench ${snapshot.date} 公开快照的身份探针汇总。${stats}。单次结果不能证明模型被替换。`,body:`<h1>模型身份探针公开快照</h1><p class="lede">${stats}。下面是按模型和站点查看的公开汇总，以及指纹识别结果与申报模型不一致的观察。单次结果不能证明模型被替换。</p>${stamp(snapshot)}<p>覆盖 ${models.length} 个模型 · 汇总一致率 ${e(agreement(agree,total))}</p><section class="signals"><h2>指纹观察</h2><p>这是公开快照中的指纹观察，单次结果不能证明模型被替换。</p>${sharedBaseNotice(rows)}${mismatches.length?table(['申报模型','识别结果','站点','分组','agree / total','测量时间'],mismatches.map(row=>[`${cell(modelName(snapshot,row.model_id))}<br><small>${e(row.model_id)}</small>`,cell(row.identified_model_id),stationLink(site,snapshot,row.station_slug),cell(row.group_name),e(agreement(row.agree,row.total)),cell(row.measured_at)]),'fingerprint-observations'):'<p>本日快照未收录标识不同的指纹观察。</p>'}</section><h2 id="models">按模型查看</h2>${table(['模型','公开结果条数'],models.map(id=>[link(`/models/${pathId(id)}/`,modelName(snapshot,id)),String(rows.filter(row=>row.model_id===id).length)]),'probe-models')}<h2 id="stations">按站点查看</h2>${table(['站点','公开结果条数'],stations.map(slug=>[link(`/stations/${pathId(slug)}/`,stationName(snapshot,slug)),String(rows.filter(row=>row.station_slug===slug).length)]),'probe-stations')}`}]
   for(const id of models){const selected=rows.filter(row=>row.model_id===id);const past=sevenDays(snapshot,history).flatMap(day=>day.integrity.filter(row=>row.model_id===id).map(row=>[day.date,cell(stationName(day,row.station_slug)),e(agreement(row.agree,row.total)),cell(row.identified_model_id),cell(row.measured_at)]));pages.push({path:`/models/${pathId(id)}/`,title:`${modelName(snapshot,id)} 身份探针快照 · ${snapshot.date}`,description:`${modelName(snapshot,id)} 在 ${snapshot.date} 已公开的 ${selected.length} 条探针汇总，展示调用方式、Token 与指纹观察。`,body:`<h1>${e(modelName(snapshot,id))} 身份探针快照</h1><p>以下为该模型当日已经公开的汇总，记录数不是执行次数。输入 Token、思考 Token 和指纹均为辅助信号。</p>${sharedBaseNotice(selected,snapshot.integrity)}${probeRowsTable(snapshot,selected,'model-probes')}${past.length?`<h2>近 7 日已有归档</h2>${table(['归档日期','站点','agree / total','识别模型','测量时间'],past,'probe-history')}`:''}${relatedViews(site,snapshot,'model',id,modelName(snapshot,id))}`})}
   for(const slug of stations){const selected=rows.filter(row=>row.station_slug===slug);pages.push({path:`/stations/${pathId(slug)}/`,title:`${stationName(snapshot,slug)} 身份探针快照 · ${snapshot.date}`,description:`${stationName(snapshot,slug)} 在 ${snapshot.date} 公开的 ${selected.length} 条身份探针汇总，按模型和分组展示。`,body:`<h1>${e(stationName(snapshot,slug))} 身份探针快照</h1><p>这里按站点汇集当日公开结果，不是完整站点档案。单次一致率或指纹观察不能证明模型被替换。</p>${sharedBaseNotice(selected,snapshot.integrity)}${probeRowsTable(snapshot,selected,'station-probes')}<p>${mainAnchor(site,`/services/${slug}`,'查看主站完整页面',`station-${slug}`)}</p>${relatedViews(site,snapshot,'station',slug,stationName(snapshot,slug))}`})}
   pages.push(about(site,snapshot,'身份探针信号与局限','说明一致率、匿名题目 ID、Token、模型指纹及共享底模的解释边界。',['agree / total 表示可比较题目的匹配情况。总一致率为所展示汇总的 agree 之和除以 total 之和。','题目只公开匿名 ID；输入 Token、思考 Token 和指纹都是辅助信号。不设置未经确认的异常阈值，不由单次结果推断模型替换。','记录数不是执行次数。部分模型共享底模，指纹无法区分；涉及这类配对时，会在观察列表和相关页面注明。',...(hasSharedBasePair(rows)?['GPT 6 Astra 与 GPT 6.1 Sol 共享底模，当前指纹无法区分这类配对。']:[])]))
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

## X. 新增 Folkbench Pelican Database 开源发布博客（12 语种）并修复 Windows 路径校验兼容

**RULE**:
When implementing operations in `scripts/distribution/subsite-core.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Folkbench/folkbench. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `f0856c35`: 新增 Folkbench Pelican Database 开源发布博客（12 语种）并修复 Windows 路径校验兼容. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `scripts/distribution/subsite-core.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
  const rootPosix=resolve(root).replaceAll('\\','/')
  for(const path of htmlFiles){const body=await readFile(path,'utf8');if(forbidden.some(word=>body.includes(word)))throw new Error('subsite_wording_rejected');if(path.replaceAll('\\','/').endsWith('/404.html'))continue
      if(href.startsWith('/')){const url=new URL(href,origin);if(url.origin!==origin)throw new Error('subsite_external_relative_link');const target=resolve(root,'.'+url.pathname+(url.pathname.endsWith('/')?'index.html':''));if(!target.replaceAll('\\','/').startsWith(rootPosix+'/'))throw new Error('subsite_link_escape');await readFile(target)}
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
  for(const path of htmlFiles){const body=await readFile(path,'utf8');if(forbidden.some(word=>body.includes(word)))throw new Error('subsite_wording_rejected');if(path.endsWith('/404.html'))continue
      if(href.startsWith('/')){const url=new URL(href,origin);if(url.origin!==origin)throw new Error('subsite_external_relative_link');const target=resolve(root,'.'+url.pathname+(url.pathname.endsWith('/')?'index.html':''));if(!target.startsWith(resolve(root)+'/'))throw new Error('subsite_link_escape');await readFile(target)}
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `f0856c35` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
