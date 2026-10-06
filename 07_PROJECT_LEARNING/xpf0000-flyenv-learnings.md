# Forensic Learning Record (Deep Inspection): xpf0000/FlyEnv

> **Canonical Artifact**: `07_PROJECT_LEARNING/xpf0000-flyenv-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/xpf0000/FlyEnv](https://github.com/xpf0000/FlyEnv))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:04:12.788Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `xpf0000/FlyEnv`
- **Description**: Native local development environment for Windows, macOS & Linux. A modern alternative to XAMPP, MAMP, Laragon and Laravel Herd, with runtimes, databases, web servers, local sites, HTTPS, AI coding tools and MCP.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 3256 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `plugins/kafka/render/Module.ts`
```
import { defineAsyncComponent } from 'vue'
import type { AppModuleItem } from '@/core/type'

const module = {
  moduleType: 'cacheAndQueue',
  typeFlag: 'kafka',
  label: 'Kafka',
  icon: import('./kafka.svg?raw'),
  index: defineAsyncComponent(() => import('./Index.vue')),
  aside: defineAsyncComponent(() => import('./aside.vue')),
  asideIndex: 49,
  isService: true,
  isTray: true,
  platform: ['Windows', 'macOS', 'Linux']
} as unknown as AppModuleItem

export default module

```

### Core Architecture Module: `plugins/kafka/render/lang.ts`
```
import { AppI18n } from '@lang/index'
import { createKafkaT } from '../lang'

export const KafkaT = createKafkaT(() => `${AppI18n().global.locale ?? 'en'}`)

export type { KafkaLangKey } from '../lang'

```

### Core Architecture Module: `plugins/kafka/render/policy.ts`
```
import type { SoftInstalled } from '@/store/brew'
import { compareVersions } from '@shared/compare-versions'

export const kafkaMinJavaMajor = 17

export type KafkaJavaCandidate = {
  bin: string
  path: string
  version: string | null
  num?: number | null
}

/** Parse a JDK version string (17, 17.0.9, 1.8.0_292, 21.x) to a major number. */
export function javaMajorFromVersion(version: string | null | undefined) {
  const value = `${version ?? ''}`.trim().replace(/_/g, '.')
  if (!value) return 0
  const legacy = value.match(/^1\.(\d+)/)
  if (legacy) return Number(legacy[1])
  const match = value.match(/^(\d+)/)
  return match ? Number(match[1]) : 0
}

export function kafkaJavaCandidateMajor(candidate: KafkaJavaCandidate) {
  const fromVersion = javaMajorFromVersion(candidate.version)
  if (fromVersion > 0) return fromVersion
  return candidate.num ? Number(String(candidate.num).slice(0, 2)) : 0
}

function comparableJavaVersion(version: string | null | undefined) {
  const normalized = `${version ?? ''}`
    .trim()
    .replace(/_/g, '.')
    .replace(/[^\d.].*$/, '')
  return normalized || '0'
}

/** Sort display candidates from the newest Java runtime to the oldest. */
export function sortKafkaJavaCandidates(candidates: KafkaJavaCandidate[]) {
  return [...candidates].sort((a, b) => {
    const majorResult = kafkaJavaCandidateMajor(b) - kafkaJavaCandidateMajor(a)
    if (majorResult !== 0) return majorResult

    let versionResult = 0
    try {
      versionResult = compareVersions(
        comparableJavaVersion(b.version),
        comparableJavaVersion(a.version)
      )
    } catch {
      versionResult = 0
    }
    if (versionResult !== 0) return versionResult
    return `${a.path}`.localeCompare(`${b.path}`)
  })
}

/** Keep only JDK installations whose major version can run Kafka (Java 17+). */
export function filterKafkaJavaCandidates(installed: SoftInstalled[]): KafkaJavaCandidate[] {
  const candidates = installed
    .map((item) => ({
      bin: item.bin,
      path: item.path,
      version: item.version ?? null,
      num: item.num
    }))
    .filter((candidate) => kafkaJavaCandidateMajor(candidate) >= kafkaMinJavaMajor)
  return sortKafkaJavaCandidates(candidates)
}

```

### Core Architecture Module: `plugins/kafka/render/store.ts`
```
import { BrewStore, type SoftInstalled } from '@/store/brew'
import { reactiveBind } from '@/util/Index'
import { StorageGetAsync, StorageSetAsync } from '@/util/Storage'
import { effectScope, watch, type EffectScope } from 'vue'
import {
  filterKafkaJavaCandidates,
  kafkaJavaCandidateMajor,
  kafkaMinJavaMajor,
  type KafkaJavaCandidate
} from './policy'
import { KafkaT } from './lang'

const storageKey = 'flyenv-kafka-java-bindings'

export type KafkaJavaBinding = {
  javaHome: string
  javaMajor: number
}

/** Keep a binding stable when the same installation is represented with different separators. */
export const normalizeKafkaBin = (bin: string | undefined | null) => {
  const value = `${bin ?? ''}`.trim().replaceAll('\\', '/')
  return value.replace(/\/+/g, '/').replace(/\/$/, '')
}

const copyBindings = (value: unknown): Record<string, KafkaJavaBinding> => {
  if (!value || typeof value !== 'object') return {}
  const result: Record<string, KafkaJavaBinding> = {}
  Object.entries(value as Record<string, unknown>).forEach(([bin, binding]) => {
    if (!binding || typeof binding !== 'object') return
    const item = binding as Partial<KafkaJavaBinding>
    if (typeof item.javaHome !== 'string' || !item.javaHome.trim()) return
    const javaMajor = Number(item.javaMajor)
    if (!Number.isFinite(javaMajor) || javaMajor <= 0) return
    result[normalizeKafkaBin(bin)] = {
      javaHome: item.javaHome,
      javaMajor
    }
  })
  return result
}

/**
 * Owns Kafka-to-Java bindings outside AppStore config. The singleton survives
 * page re-entry while the reactive wrapper keeps the Java select rows current.
 */
export class KafkaJavaBindingManager {
  javaByBin: Record<string, KafkaJavaBinding> = {}
  inited = false
  private initPromise?: Promise<void>
  private mutationQueue: Promise<void> = Promise.resolve()
  private installedVersionsWatching = false
  private installedVersionsScope?: EffectScope

  private enqueueMutation<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.mutationQueue.then(operation, operation)
    this.mutationQueue = next.then(
      () => undefined,
      () => undefined
    )
    return next
  }

  async init() {
    if (this.inited) return
    if (!this.initPromise) {
      this.initPromise = StorageGetAsync<Record<string, KafkaJavaBinding>>(storageKey)
        .then((saved) => {
          Object.assign(this.javaByBin, copyBindings(saved))
        })
        .catch(() => undefined)
        .finally(() => {
          this.inited = true
        })
    }
    await this.initPromise
  }

  getBinding(bin: string | undefined | null): KafkaJavaBinding | undefined {
    // This method is called while rendering each service-table row. Keep it
    // strictly read-only; initialization belongs to setup/actions, never render.
    return this.javaByBin[normalizeKafkaBin(bin)]
  }

  async setBinding(bin: string, binding: KafkaJavaBinding) {
    const key = normalizeKafkaBin(bin)
    if (!key) throw new Error(KafkaT('installationPathRequired'))
    if (!binding?.javaHome || !Number.isFinite(binding.javaMajor)) {
      throw new Error(KafkaT('javaRuntimeRequired'))
    }
    await this.init()
    return this.enqueueMutation(async () => {
      this.javaByBin[key] = {
        javaHome: binding.javaHome,
        javaMajor: Number(binding.javaMajor)
      }
      await this.persist()
      return this.javaByBin[key]
    })
  }

  async removeBinding(bin: string) {
    await this.init()
    return this.enqueueMutation(async () => {
      delete this.javaByBin[normalizeKafkaBin(bin)]
      await this.persist()
    })
  }

  watchInstalledVersions() {
    if (this.installedVersionsWatching) return
    this.installedVersionsWatching = true
    const kafkaModule = BrewStore().module('kafka')
    const javaModule = BrewStore().module('java')
    // The Java module page may never have been opened, so its installed list
    // can be empty even though JDKs are installed. Pull it on demand; the
    // watch below reconciles bindings once the fetch lands.
    if (!javaModule.installedFetched) {
      javaModule
        .fetchInstalled()
        .catch((error) => console.error('Kafka Java candidates fetch failed', error))
    }
    this.installedVersionsScope = effectScope(true)
    this.installedVersionsScope.run(() => {
      watch(
        () => ({
          kafkaFetched: kafkaModule.installedFetched,
          kafka: kafkaModule.installed.map((item) => [item.bin, item.path, item.version]),
          java: javaModule.installed.map((item) => [item.bin, item.path, item.version, item.num])
        }),
        () => {
          if (!kafkaModule.installedFetched) return
          this.reconcileBindings(kafkaModule.installed).catch((error) =>
            console.error('Kafka Java binding reconciliation failed', error)
          )
        },
        { immediate: true }
      )
    })
  }

  stopInstalledVersionsWatch() {
    this.installedVersionsScope?.stop()
    this.installedVersionsScope = undefined
    this.installedVersionsWatching = false
  }

  /** Remove stale paths and initialize new rows with the recommended local JDK. */
  async reconcileBindings(installed: SoftInstalled[]) {
    const kafkaModule = BrewStore().module('kafka')
    if (!kafkaModule.installedFetched && installed.length === 0) return
    await this.init()
    return this.enqueueMutation(async () => {
      const bins = new Set(installed.map((item) => normalizeKafkaBin(item.bin)).filter(Boolean))
      let changed = false
      Object.keys(this.javaByBin).forEach((bin) => {
        if (!bins.has(bin)) {
          delete this.javaByBin[bin]
          changed = true
        }
      })

      const candidates = this.candidates()
      installed.forEach((item) => {
        if (!item.version || this.getBinding(item.bin)) return
        const candidate = candidates[0]
        if (!candidate) return
        const javaMajor = kafkaJavaCandidateMajor(candidate)
        if (!javaMajor) return
        this.javaByBin[normalizeKafkaBin(item.bin)] = {
          javaHome: candidate.path,
          javaMajor
        }
        changed = true
      })
      if (changed) await this.persist()
    })
  }

  /** All installed JDK runtimes that can run Kafka (Java 17+), newest first. */
  candidates(): KafkaJavaCandidate[] {
    const java = BrewStore().module('java')
    return filterKafkaJavaCandidates(java.installed)
  }

  /** Parameters appended to the existing ModuleInstalledItem startService IPC call. */
  async startParams(item: SoftInstalled): Promise<[{ javaHome: string }]> {
    await this.init()
    const binding = this.getBinding(item.bin)
    if (!binding) {
      throw new Error(KafkaT('bindJavaFirst'))
    }
    if (binding.javaMajor < kafkaMinJavaMajor) {
      throw new Error(
        KafkaT('javaMajorUnsupported', { min: kafkaMinJavaMajor, major: binding.javaMajor })
      )
    }
    return [{ javaHome: binding.javaHome }]
  }

  /** Keep stopping available after a Java binding is removed or becomes invalid. */
  async stopParams(item: SoftInstalled): Promise<[{ javaHome?: string }]> {
    await this.init()
    return [{ javaHome: this.getBinding(item.bin)?.javaHome }]
  }

  async persist() {
    await StorageSetAsync(storageKey, JSON.parse(JSON.stringify(this.javaByBin)))
  }
}

export const KafkaManager = reactiveBind(new KafkaJavaBindingManager())

```

### Core Architecture Module: `plugins/mailpit/render/Module.ts`
```
import { defineAsyncComponent } from 'vue'
import type { AppModuleItem } from '@/core/type'

const module = {
  moduleType: 'emailServer',
  typeFlag: 'mailpit-plugin',
  label: 'Mailpit Plugin',
  icon: import('@/svg/mailpit.svg?raw'),
  index: defineAsyncComponent(() => import('./Index.vue')),
  aside: defineAsyncComponent(() => import('./aside.vue')),
  asideIndex: 14,
  isService: true,
  isTray: false,
  platform: ['Windows', 'macOS', 'Linux']
} as unknown as AppModuleItem

export default module

```

### Core Architecture Module: `src/fork/TaskQueue.ts`
```
import { cpus } from 'os'
import type { CallbackFn } from '@shared/app'

interface TaskItem {
  item: (...args: any) => Promise<any>
  param: any
  state: 'wait' | 'running'
}
class TaskQueue {
  private callback: WeakMap<TaskItem, { resolve: CallbackFn; reject: CallbackFn }> = new WeakMap()
  #queue: Array<TaskItem> = []
  #runQueue: Array<TaskItem> = []
  #runSize = 4

  constructor() {
    this.#runSize = cpus().length
  }

  #_handle() {
    console.log('TaskQueue: ', this.#queue.length, this.#runQueue.length)
    /**
     * queue is empty. exit
     */
    if (this.#queue.length === 0 && this.#runQueue.length === 0) {
      return
    }
    /**
     * run queue is not full. put it full
     */
    if (this.#runQueue.length < this.#runSize) {
      for (let i = 0; i < this.#runSize - this.#runQueue.length; i += 1) {
        const taskItem = this.#queue.shift()
        if (taskItem) {
          this.#runQueue.push(taskItem)
        }
      }
    }

    for (const taskItem of this.#runQueue) {
      if (taskItem.state === 'wait') {
        taskItem.state = 'running'
        const item = taskItem.item
        const { resolve, reject } = this.callback.get(taskItem)!
        item(...taskItem.param)
          .then((...args) => {
            resolve(...args)
          })
          .catch((e) => {
            reject(e)
          })
          .finally(() => {
            const index = this.#runQueue.indexOf(taskItem)
            if (index >= 0) {
              this.#runQueue.splice(index, 1)
            }
            this.callback.delete(taskItem)
            this.#_handle()
          })
      }
    }
  }

  run<T>(item: (...args: any) => Promise<T>, ...args: any): Promise<T> {
    return new Promise((resolve, reject) => {
      const obj: TaskItem = {
        item,
        param: args ?? [],
        state: 'wait'
      }
      this.callback.set(obj, { resolve, reject })
      if (this.#runQueue.length >= this.#runSize) {
        this.#queue.push(obj)
      } else {
        this.#runQueue.push(obj)
      }
      this.#_handle()
    })
  }
}
export default new TaskQueue()

```

### Core Architecture Module: `src/fork/module/ClickHouse/lifecycle.ts`
```
import { join } from 'node:path'
import { md5 } from '@shared/utils'

export function clickHouseVersionPidFile(baseDir: string, bin: string): string {
  return join(baseDir, 'pid', `clickhouse-${md5(bin)}.pid`)
}

```

### Core Architecture Module: `src/fork/module/Cron/utils.ts`
```
import type { CronJob } from '@shared/app'
import { computeNextCronRun } from '@shared/CronExpression'
import { homedir } from 'os'
import { join } from 'path'
import {
  GLOBAL_HOST_ID,
  type CronFindResult,
  type CronStorageData,
  type CronTaskScriptExt
} from './types'

export function homePath(): string {
  return homedir() || process.env.HOME || process.env.USERPROFILE || ''
}

export function cronBaseDir(): string {
  return join(global.Server.BaseDir!, 'cron')
}

export function storageKey(hostId?: number | null): string {
  const id = Number(hostId ?? GLOBAL_HOST_ID)
  return Number.isFinite(id) && id > 0 ? `${id}` : `${GLOBAL_HOST_ID}`
}

export function normalizeHostId(hostId?: number | null): number {
  const id = Number(hostId ?? GLOBAL_HOST_ID)
  return Number.isFinite(id) && id > 0 ? id : GLOBAL_HOST_ID
}

export function normalizeJob(job: CronJob, hostId: number): CronJob {
  const normalizedHostId = normalizeHostId(job.hostId ?? hostId)
  const scope = job.scope ?? (normalizedHostId > 0 ? 'host' : 'global')
  return {
    ...job,
    hostId: normalizedHostId > 0 ? normalizedHostId : undefined,
    scope
  }
}

export function normalizeCronData(data: CronStorageData): CronStorageData {
  const normalized: CronStorageData = {}
  for (const [key, jobs] of Object.entries(data || {})) {
    const hostId = normalizeHostId(Number(key))
    const keyName = storageKey(hostId)
    const normalizedJobs = Array.isArray(jobs) ? jobs.map((job) => normalizeJob(job, hostId)) : []
    normalized[keyName] = [...(normalized[keyName] || []), ...normalizedJobs]
  }
  if (!normalized[storageKey(GLOBAL_HOST_ID)]) {
    normalized[storageKey(GLOBAL_HOST_ID)] = []
  }
  return normalized
}

export function flattenJobs(data: CronStorageData): CronJob[] {
  return Object.values(data)
    .flat()
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
}

export function findJob(
  data: CronStorageData,
  hostId: number | undefined | null,
  jobId: string
): CronFindResult | undefined {
  const preferredKey = typeof hostId === 'number' ? storageKey(hostId) : ''
  const keys = preferredKey
    ? [preferredKey, ...Object.keys(data).filter((key) => key !== preferredKey)]
    : Object.keys(data)

  for (const key of keys) {
    const jobs = data[key] || []
    const index = jobs.findIndex((job) => job.id === jobId)
    if (index >= 0) {
      return {
        key,
        hostId: normalizeHostId(Number(key)),
        jobs,
        index,
        job: jobs[index]
      }
    }
  }

  return undefined
}

export function computeNextRunTime(schedule: string, fromDate: Date): number {
  try {
    return computeNextCronRun(schedule, fromDate)
  } catch {
    return 0
  }
}

export function ensureNextRunTimes(data: CronStorageData): boolean {
  const now = new Date()
  let changed = false

  for (const jobs of Object.values(data)) {
    for (const job of jobs) {
      const nextTs = job.enabled ? computeNextRunTime(job.schedule, now) : 0
      if ((job.nextRunTime ?? 0) !== nextTs) {
        job.nextRunTime = nextTs
        changed = true
      }
    }
  }

  return changed
}

export function runLogPath(cronRoot: string, jobId: string): string {
  return join(cronRoot, 'runs', `${jobId}.jsonl`)
}

export function taskScriptPath(cronRoot: string, jobId: string, ext: CronTaskScriptExt): string {
  return join(cronRoot, 'tasks', `${jobId}.${ext}`)
}

export function systemTaskName(jobId: string): string {
  return `FlyEnv-Cron-${jobId}`
}

export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

export function base64(value: string): string {
  return Buffer.from(value, 'utf-8').toString('base64')
}

export function decodeBase64(value?: string): string {
  if (!value) {
    return ''
  }
  try {
    return Buffer.from(value, 'base64').toString('utf-8')
  } catch {
    return ''
  }
}

```

### Core Architecture Module: `src/fork/module/Flutter/fs-utils.ts`
```
import { basename, join } from 'path'
import { existsSync } from 'fs'
import fs from 'fs-extra'
import YAML from 'yamljs'

export async function _replaceByRegex(
  file: string,
  regex: RegExp,
  replaceWith: string
): Promise<boolean> {
  if (!existsSync(file)) {
    return false
  }
  const content = await fs.readFile(file, 'utf-8')
  const next = content.replace(regex, replaceWith)
  if (next === content) {
    return false
  }
  await fs.writeFile(file, next)
  return true
}

export async function _listFilesRecursive(root: string): Promise<string[]> {
  if (!root || !existsSync(root)) {
    return []
  }

  const files: string[] = []
  const stack: string[] = [root]

  while (stack.length) {
    const current = stack.pop() as string
    let entries: fs.Dirent[] = []
    try {
      entries = await fs.readdir(current, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      const full = join(current, entry.name)
      if (entry.isDirectory()) {
        stack.push(full)
      } else if (entry.isFile()) {
        files.push(full)
      }
    }
  }

  return files
}

export async function _syncAndroidEntryPackage(
  projectDir: string,
  androidPackage: string
): Promise<{
  updatedFiles: string[]
  manifestUpdated: boolean
}> {
  const updatedFiles: string[] = []
  let manifestUpdated = false

  const sourceRoots = [
    join(projectDir, 'android', 'app', 'src', 'main', 'kotlin'),
    join(projectDir, 'android', 'app', 'src', 'main', 'java')
  ]

  const candidates: string[] = []
  for (const root of sourceRoots) {
    const files = await _listFilesRecursive(root)
    candidates.push(
      ...files.filter((f) => /(MainActivity|MainApplication)\.(kt|java)$/i.test(basename(f)))
    )
  }

  for (const file of candidates) {
    let source = ''
    try {
      source = await fs.readFile(file, 'utf-8')
    } catch {
      continue
    }

    let next = source
    const hasPackageLine = /^\s*package\s+[a-zA-Z0-9_.]+\s*$/m.test(next)
    if (hasPackageLine) {
      next = next.replace(/^\s*package\s+[a-zA-Z0-9_.]+\s*$/m, `package ${androidPackage}`)
    } else {
      next = `package ${androidPackage}\n\n${next}`
    }

    if (next !== source) {
      await fs.writeFile(file, next)
      updatedFiles.push(file)
    }
  }

  const manifests = [
    join(projectDir, 'android', 'app', 'src', 'main', 'AndroidManifest.xml'),
    join(projectDir, 'android', 'app', 'src', 'debug', 'AndroidManifest.xml'),
    join(projectDir, 'android', 'app', 'src', 'profile', 'AndroidManifest.xml')
  ]

  for (const manifest of manifests) {
    if (!existsSync(manifest)) {
      continue
    }
    let xml = ''
    try {
      xml = await fs.readFile(manifest, 'utf-8')
    } catch {
      continue
    }

    const nextXml = xml.replace(
      /(android:name\s*=\s*")[^"]*MainActivity(")/g,
      `$1.${'MainActivity'}$2`
    )

    if (nextXml !== xml) {
      await fs.writeFile(manifest, nextXml)
      manifestUpdated = true
    }
  }

  return { updatedFiles, manifestUpdated }
}

export async function _readPubspec(projectDir: string): Promise<any> {
  const pubspec = join(projectDir, 'pubspec.yaml')
  if (!existsSync(pubspec)) {
    return null
  }
  try {
    const raw = await fs.readFile(pubspec, 'utf-8')
    const parsed = YAML.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

```

### Core Architecture Module: `src/fork/module/Flutter/util.ts`
```
import { relative } from 'path'
import { isMacOS, isWindows } from '@shared/utils'

export function _archiveExt(url: string): string {
  const lower = (url || '').toLowerCase()
  if (lower.endsWith('.tar.xz')) {
    return '.tar.xz'
  }
  if (lower.endsWith('.tar.gz')) {
    return '.tar.gz'
  }
  if (lower.endsWith('.zip')) {
    return '.zip'
  }
  if (isWindows() || isMacOS()) {
    return '.zip'
  }
  return '.tar.xz'
}

export function _detectChannelByUrl(url: string): 'stable' | 'beta' | 'dev' {
  const lower = `${url ?? ''}`.toLowerCase()
  if (lower.includes('/beta/')) {
    return 'beta'
  }
  if (lower.includes('/dev/')) {
    return 'dev'
  }
  return 'stable'
}

export function _sanitizeProjectName(name: string): string {
  return `${name ?? ''}`
    .trim()
    .replace(/[^a-z0-9_]/gi, '_')
    .toLowerCase()
}

export function _bundleIdFrom(orgName: string, projectName: string): string {
  const org = `${orgName ?? ''}`
    .trim()
    .replace(/[^a-z0-9.]/gi, '')
    .toLowerCase()
  const name = _sanitizeProjectName(projectName)
  const tail = name || 'app'
  if (!org) {
    return `com.example.${tail}`
  }
  const fixedOrg = org.endsWith('.') ? org.slice(0, -1) : org
  return `${fixedOrg}.${tail}`
}

export function _normalizeBundleId(raw: string, orgName: string, projectName: string): string {
  const input = `${raw ?? ''}`.trim().toLowerCase()
  if (!input) {
    return _bundleIdFrom(orgName, projectName)
  }
  const cleaned = input
    .replace(/[^a-z0-9._]/g, '_')
    .replace(/\.+/g, '.')
    .replace(/^\./, '')
    .replace(/\.$/, '')
  if (!cleaned.includes('.')) {
    return _bundleIdFrom(orgName, cleaned)
  }
  return cleaned
}

export function _toProjectRelative(projectDir: string, filePath: string): string {
  const p = `${filePath ?? ''}`.trim()
  if (!p) {
    return ''
  }
  if (!projectDir) {
    return p.replace(/\\/g, '/')
  }
  const rel = relative(projectDir, p).replace(/\\/g, '/')
  if (!rel || rel === '.') {
    return p.replace(/\\/g, '/')
  }
  return rel
}

```

### Core Architecture Module: `src/fork/module/N8N/utils.ts`
```
import { join } from 'path'
import { existsSync, realpathSync } from 'fs'
import { tmpdir } from 'os'
import { readFile, writeFile, remove, execPromiseWithEnv } from '../../Fn'
import { appDebugLog, isWindows } from '@shared/utils'
import EnvSync from '@shared/EnvSync'

/** Get the env file path for n8n */
export function getEnvFilePath(): string {
  return join(global.Server.BaseDir!, 'n8n/n8n.env')
}

/** Read a specific config value from the env file */
export async function readEnvValue(key: string): Promise<string | undefined> {
  try {
    const envFile = getEnvFilePath()
    if (!existsSync(envFile)) return undefined
    const content = await readFile(envFile, 'utf-8')
    for (const line of content.split('\n')) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const eqIdx = t.indexOf('=')
      if (eqIdx < 0) continue
      const k = t.slice(0, eqIdx).trim()
      const v = t
        .slice(eqIdx + 1)
        .trim()
        .replace(/^["']|["']$/g, '')
      if (k === key) return v
    }
  } catch {}
  return undefined
}

/** Get N8N_PORT from config (default 5678) */
export async function getPort(): Promise<string> {
  return (await readEnvValue('N8N_PORT')) || '5678'
}

/** Parse env file into key-value dict (skip comments and empty lines) */
export async function parseEnvFile(envFile: string): Promise<Record<string, string>> {
  try {
    const content = await readFile(envFile, 'utf-8')
    const dict: Record<string, string> = {}
    content
      .split('\n')
      .filter((s) => {
        const str = s.trim()
        return !!str && !str.startsWith('#')
      })
      .forEach((s) => {
        const item = s.trim().split('=')
        const k = item.shift()
        const v = item.join('=').replace(/^["']|["']$/g, '')
        if (k) dict[k] = v
      })
    return dict
  } catch {
    return {}
  }
}

/** Read N8N_PORT / N8N_OWNER_EMAIL / N8N_OWNER_PASSWORD from the env file. */
export async function getN8nConfig(): Promise<{ port: string; email: string; password: string }> {
  const envFile = getEnvFilePath()
  const opt = await parseEnvFile(envFile)
  return {
    port: opt['N8N_PORT'] || '5678',
    email: opt['N8N_OWNER_EMAIL'] || '',
    password: opt['N8N_OWNER_PASSWORD'] || ''
  }
}

/** Resolve the effective N8N_USER_FOLDER (falls back to OS-native ~/.n8n). */
export async function resolveDataDir(): Promise<string> {
  const { homedir } = await import('os')
  const customDir = await readEnvValue('N8N_USER_FOLDER')
  return customDir || join(homedir(), '.n8n')
}

/**
 * Resolve the path to n8n's bundled node_modules directory.
 * n8n ships sqlite3 and bcryptjs inside its own node_modules.
 */
export async function resolveN8nModulesDir(): Promise<string | null> {
  try {
    const cmd = isWindows() ? 'where n8n.cmd' : 'which n8n'
    const result = await execPromiseWithEnv(cmd)
    const binPath = result.stdout.trim().split('\n')[0].trim()
    if (isWindows()) {
      // binPath = C:\...\nodejs\n8n.cmd → modules at C:\...\nodejs\node_modules\n8n\node_modules
      const candidate = join(binPath, '..', 'node_modules', 'n8n', 'node_modules')
      if (existsSync(candidate)) return candidate
    } else {
      // n8n binary is usually a symlink — resolve it first
      const real: string = realpathSync(binPath) // e.g. /usr/local/lib/node_modules/n8n/bin/n8n
      const candidate = join(real, '..', '..', 'node_modules')
      if (existsSync(candidate)) return candidate
    }
  } catch (e) {
    appDebugLog(`[resolveN8nModulesDir][error]`, `${e}`).catch()
    appDebugLog(`[resolveN8nModulesDir][AppEnv]`, JSON.stringify(EnvSync.AppEnv, null, 2)).catch()
  }
  return null
}

/**
 * Write a JS script to a temp file, execute it with the system `node`, return stdout.
 * Using a temp file avoids all shell quoting/escaping issues.
 * The system `node` has the correct ABI for n8n's native sqlite3 binding.
 */
export async function runNodeScript(script: string): Promise<string> {
  const tmpFile = join(tmpdir(), `flyenv-n8n-${Date.now()}.js`)
  await writeFile(tmpFile, script, 'utf-8')
  try {
    const result = await execPromiseWithEnv(`node "${tmpFile}"`)
    return result.stdout ?? ''
  } finally {
    try {
      await remove(tmpFile)
    } catch {}
  }
}

/** Helper to get sqlite3 module path or throw */
export async function getSqlite3Path(): Promise<string> {
  const n8nModules = await resolveN8nModulesDir()
  const sqlite3Path = n8nModules ? join(n8nModules, 'sqlite3', 'lib', 'sqlite3.js') : ''
  if (!sqlite3Path || !existsSync(sqlite3Path)) {
    throw new Error(
      'Could not find sqlite3 module in n8n installation. Please make sure n8n is installed globally.'
    )
  }
  return sqlite3Path
}

/** Helper to get bcryptjs module path or throw */
export async function getBcryptPath(): Promise<string> {
  const n8nModules = await resolveN8nModulesDir()
  const bcryptPath = n8nModules ? join(n8nModules, 'bcryptjs', 'index.js') : ''
  if (!bcryptPath || !existsSync(bcryptPath)) {
    throw new Error('Could not find bcryptjs module in n8n installation.')
  }
  return bcryptPath
}

/** Helper to get database file path or throw */
export async function getDbFilePath(): Promise<string> {
  const dataDir = await resolveDataDir()
  const dbFile = join(dataDir, 'database.sqlite')
  if (!existsSync(dbFile)) {
    throw new Error('n8n database not found at ' + dbFile)
  }
  return dbFile
}

/** Default env file content template */
export function getDefaultEnvContent(): string {
  return [
    '# n8n Environment Configuration',
    '# https://docs.n8n.io/hosting/configuration/environment-variables/',
    '',
    '# N8N_PORT=5678',
    '# N8N_HOST=localhost',
    '# N8N_PROTOCOL=http',
    '# N8N_PATH=/',
    '',
    '# N8N_USER_FOLDER=',
    '',
    '# N8N_SKIP_OWNER_SETUP=false',
    '',
    '# N8N_OWNER_EMAIL=',
    '# N8N_OWNER_PASSWORD=',
    '',
    '# DB_TYPE=sqlite',
    '# DB_SQLITE_DATABASE=',
    '',
    '# EXECUTIONS_PROCESS=main',
    '# EXECUTIONS_MODE=regular',
    '',
    '# N8N_BASIC_AUTH_ACTIVE=false',
    '# N8N_BASIC_AUTH_USER=',
    '# N8N_BASIC_AUTH_PASSWORD=',
    '',
    '# N8N_ENCRYPTION_KEY=',
    '',
    '# WEBHOOK_URL=',
    '',
    '# N8N_LOG_LEVEL=info',
    '# N8N_LOG_OUTPUT=console',
    ''
  ].join('\n')
}

```

### Core Architecture Module: `src/fork/module/Php.win/FastCgiWorkers.ts`
```
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, win32 } from 'node:path'

export const DEFAULT_FASTCGI_WORKER_COUNT = 4
export const MIN_FASTCGI_WORKER_COUNT = 1
export const MAX_FASTCGI_WORKER_COUNT = 64

type FastCgiWorkerCounts = Record<string, number>

export const normalizeFastCgiWorkerPath = (versionPath: string) => {
  const normalized = win32.normalize(versionPath.trim()).replace(/\\/g, '/').replace(/\/+$/, '')
  return normalized === '.' ? '' : normalized.toLowerCase()
}

const isValidFastCgiWorkerCount = (count: unknown): count is number => {
  return (
    typeof count === 'number' &&
    Number.isInteger(count) &&
    count >= MIN_FASTCGI_WORKER_COUNT &&
    count <= MAX_FASTCGI_WORKER_COUNT
  )
}

const validateFastCgiWorkerCount = (count: unknown) => {
  if (!isValidFastCgiWorkerCount(count)) {
    throw new Error(
      `FastCGI worker count must be an integer between ${MIN_FASTCGI_WORKER_COUNT} and ${MAX_FASTCGI_WORKER_COUNT}.`
    )
  }
}

const parseFastCgiWorkerCounts = (content: string): FastCgiWorkerCounts => {
  try {
    const value: unknown = JSON.parse(content)
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {}
    }

    return Object.entries(value).reduce<FastCgiWorkerCounts>((counts, [path, count]) => {
      const key = normalizeFastCgiWorkerPath(path)
      if (key && isValidFastCgiWorkerCount(count)) {
        counts[key] = count
      }
      return counts
    }, {})
  } catch {
    return {}
  }
}

export class FastCgiWorkerStore {
  private writeTail: Promise<void> = Promise.resolve()

  constructor(readonly filePath: string) {}

  async get(versionPath: string): Promise<number> {
    const key = normalizeFastCgiWorkerPath(versionPath)
    if (!key) {
      return DEFAULT_FASTCGI_WORKER_COUNT
    }
    const counts = await this.read()
    return counts[key] ?? DEFAULT_FASTCGI_WORKER_COUNT
  }

  async set(versionPath: string, count: number): Promise<number> {
    const key = normalizeFastCgiWorkerPath(versionPath)
    if (!key) {
      throw new Error('PHP installation path is required.')
    }
    validateFastCgiWorkerCount(count)

    const write = async () => {
      const counts = await this.read()
      counts[key] = count
      await this.write(counts)
    }
    const pending = this.writeTail.then(write, write)
    this.writeTail = pending.catch(() => {})
    await pending
    return count
  }

  private async read(): Promise<FastCgiWorkerCounts> {
    try {
      return parseFastCgiWorkerCounts(await readFile(this.filePath, 'utf8'))
    } catch {
      return {}
    }
  }

  private async write(counts: FastCgiWorkerCounts): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true })
    const tempPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`
    try {
      await writeFile(tempPath, `${JSON.stringify(counts, null, 2)}\n`, 'utf8')
      await rename(tempPath, this.filePath)
    } catch (error) {
      await rm(tempPath, { force: true }).catch(() => {})
      throw error
    }
  }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #884** (2026-10-05): **build(deps): bump axios from 1.19.0 to 1.20.0**
  *Symptoms*: Bumps [axios](https://github.com/axios/axios) from 1.19.0 to 1.20.0. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/axios/axios/releases">axios's releases</a>.</em></p> <blockquote> <h2>v1.20.0 — August 19, 2026</h2> <p>This release hardens runtime option handling, adds RFC 9110 status-code aliases, fixes Node.js and XHR reliability issues, and refreshes project tooling and documentation.</p> <h2>⚠️ Breaking Changes &amp; Deprecations</h2> <ul> <li>HTTP Status Naming: Added ContentTooLarge (413) and UnprocessableContent (422), while retaining PayloadTooLarge and UnprocessableEntity as backward-compatible deprecated aliases. (<a href="https://redirect.github.com/axios/axios/issues/11082">#11082</a>)</li> </ul> <h2>🔒 Security Fixes</h2> <ul> <li>Runtime Option Handling: Hardened behavioral configuration reads against shared and foreign prototype pollution and normalized unsafe interceptor replacement objects. This also clarifies Fetch redirect and custom implementation behavior, HTTP/2 DNS and proxy handling, CIDR-based NO_PROXY matching, and malformed data URI rejection; see the PR for documented compatibility effects. (<a href="https://redirect.github.com/axios/axios/issues/11141">#11141</a>)</li> </ul> <h2>🐛 Bug Fixes</h2> <ul> <li>Interceptor Lifecycle: Prevented unbounded handler-array growth by trimming trailing ejected interceptors without changing iteration semantics, and kept interceptor operations safe when the public hand

- **Issue #883** (2026-10-05): **build(deps): bump dompurify from 3.4.13 to 3.4.16**
  *Symptoms*: Bumps [dompurify](https://github.com/cure53/DOMPurify) from 3.4.13 to 3.4.16. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/cure53/DOMPurify/releases">dompurify's releases</a>.</em></p> <blockquote> <h2>DOMPurify 3.4.16</h2> <ul> <li>Fixed a problem with <code>IN_PLACE</code> node removal when working with hooks, thanks <a href="https://github.com/manus-pi"><code>@​manus-pi</code></a></li> <li>Fixed a problem with <code>IN_PLACE</code> sanitization and raw-text roots, thanks <a href="https://github.com/h-t-m"><code>@​h-t-m</code></a></li> <li>Fixed a problem with ESM default exports landing in CommonJS declarations, thanks <a href="https://github.com/ssi02014"><code>@​ssi02014</code></a></li> <li>Migrated from <code>rollup</code> to <code>rolldown</code> because performance, thanks <a href="https://github.com/ssi02014"><code>@​ssi02014</code></a></li> <li>Bumped several dependencies where possible</li> </ul> <h2>DOMPurify 3.4.15</h2> <ul> <li>Added better clobbering hardening when XML content is involved, thanks <a href="https://github.com/gnyselcuk"><code>@​gnyselcuk</code></a></li> <li>Added several smaller hardening and edge-case improvements, thanks <a href="https://github.com/leechristensen"><code>@​leechristensen</code></a></li> <li>Bumped several dependencies where possible</li> </ul> <h2>DOMPurify 3.4.14</h2> <ul> <li>Fixed an issue with possible bypasses when risky tags are allow-listed, thanks <a href="https://github.com/

- **Issue #881** (2026-10-05): **build(deps): bump moment from 2.30.1 to 2.31.0**
  *Symptoms*: Bumps [moment](https://github.com/moment/moment) from 2.30.1 to 2.31.0. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/moment/moment/releases">moment's releases</a>.</em></p> <blockquote> <h2>2.31.0</h2> <p><em>Released Sep 14, 2026</em></p> <h4>Security fixes</h4> <ul> <li>Fix <a href="https://www.cve.org/CVERecord?id=CVE-2026-17495">CVE-2026-17495</a> (<a href="https://github.com/moment/moment/security/advisories/GHSA-4p3w-j4w9-5jqw">GHSA-4p3w-j4w9-5jqw</a>)</li> </ul> <h4>Bug fixes</h4> <ul> <li><a href="https://redirect.github.com/moment/moment/pull/6376">#6376</a> Prevent object prototype properties from being used as format tokens</li> <li><a href="https://redirect.github.com/moment/moment/pull/6386">#6386</a> Normalize lazy-loaded locale names</li> <li><a href="https://redirect.github.com/moment/moment/pull/6404">#6404</a> Fix parsing issue with <code>eHHmm</code> format</li> <li><a href="https://redirect.github.com/moment/moment/pull/6433">#6433</a> Ignore non-Moment arguments in min and max</li> <li><a href="https://redirect.github.com/moment/moment/pull/6434">#6434</a> Fix inherited lowercase long date formats</li> <li><a href="https://redirect.github.com/moment/moment/pull/6436">#6436</a> Reset locale parsing caches after updates</li> <li><a href="https://redirect.github.com/moment/moment/pull/6437">#6437</a> Fix weekday mismatch when the format only has part of a date</li> <li><a href="https://redirect.github.com/moment/

- **Issue #876** (2026-10-05): **build(deps): bump ip-address from 10.4.0 to 10.7.2**
  *Symptoms*: Bumps [ip-address](https://github.com/beaugunderson/ip-address) from 10.4.0 to 10.7.2. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/beaugunderson/ip-address/releases">ip-address's releases</a>.</em></p> <blockquote> <h2>v10.7.2</h2> <h2>What's Changed</h2> <ul> <li>Accept an arpa suffix in any case and without the root dot in fromArpa by <a href="https://github.com/beaugunderson"><code>@​beaugunderson</code></a> in <a href="https://redirect.github.com/beaugunderson/ip-address/pull/227">beaugunderson/ip-address#227</a></li> </ul> <p><strong>Full Changelog</strong>: <a href="https://github.com/beaugunderson/ip-address/compare/v10.7.1...v10.7.2">https://github.com/beaugunderson/ip-address/compare/v10.7.1...v10.7.2</a></p> <h2>v10.7.1</h2> <h2>What's Changed</h2> <ul> <li>Bump js-yaml and brace-expansion in the lockfile by <a href="https://github.com/beaugunderson"><code>@​beaugunderson</code></a> in <a href="https://redirect.github.com/beaugunderson/ip-address/pull/226">beaugunderson/ip-address#226</a></li> </ul> <p><strong>Full Changelog</strong>: <a href="https://github.com/beaugunderson/ip-address/compare/v10.7.0...v10.7.1">https://github.com/beaugunderson/ip-address/compare/v10.7.0...v10.7.1</a></p> <h2>v10.7.0</h2> <h2>What's Changed</h2> <ul> <li>Add offset() and nextNetwork(), accept prefix-length ip6.arpa names, correct the IPv6 end-address docs by <a href="https://github.com/beaugunderson"><code>@​beaugunderson</code></a> in

- **Issue #875** (2026-10-05): **build(deps): bump undici from 7.29.0 to 7.29.1**
  *Symptoms*: Bumps [undici](https://github.com/nodejs/undici) from 7.29.0 to 7.29.1. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/nodejs/undici/releases">undici's releases</a>.</em></p> <blockquote> <h2>v7.29.1</h2> <h2>⚠️ Security fixes</h2> <h3>High severity</h3> <ul> <li><a href="https://github.com/nodejs/undici/security/advisories/GHSA-w293-vg96-wgc3">GHSA-w293-vg96-wgc3</a>: <code>BalancedPool</code> could drop function-valued connection options while cloning its configuration, including custom TLS certificate validation callbacks. Undici now preserves <code>connect</code> and legacy <code>tls</code> options when creating upstreams. Fixed by <a href="https://github.com/nodejs/undici/commit/f690157d728508652fef14673630c71515123e96">f690157d</a>.</li> <li><a href="https://github.com/nodejs/undici/security/advisories/GHSA-rfgv-xxqx-mfg5">GHSA-rfgv-xxqx-mfg5</a>: a WebSocket server could select a subprotocol when none was requested, causing an uncaught <code>TypeError</code> that could terminate the process. Undici now rejects the handshake with protocol error 1002. Fixed by <a href="https://github.com/nodejs/undici/commit/6615e0175e9b635bcd2e3e87a47daa82f6f5b728">6615e017</a>.</li> </ul> <h3>Medium severity</h3> <ul> <li><a href="https://github.com/nodejs/undici/security/advisories/GHSA-3wwx-pv8p-q78v">GHSA-3wwx-pv8p-q78v</a>: a malformed permessage-deflate payload exceeding the configured decompression limit could emit an unhandled zlib err

- **Issue #872** (2026-10-05): **feat: 按版本配置读取 MySQL 和 MariaDB 连接参数**
  *Symptoms*: ## 变更说明  - MySQL 和 MariaDB 的端口、Socket 从对应版本配置文件读取。 - 移除 macOS/Linux 普通启动流程中硬编码的 MySQL/MariaDB Socket。 - MariaDB 新生成的版本配置默认使用端口 `3307` 和 Socket `/tmp/mariadb.sock`。 - MySQL 默认端口保持 `3306`，默认 Socket 保持 `/tmp/mysql.sock`。 - 初始化密码、密码修改、数据库管理和 MCP 连接信息统一使用配置文件中的端口和 Socket。 - `my-版本.cnf` 文件名继续根据实际版本动态生成，不写死具体版本。 - 恢复密码维护模式的独立临时 Socket，避免维护实例与正常实例冲突。  ## 兼容性  - 默认密码仍沿用原有默认值 `root`，未修改密码语义，也未把密码写入配置文件。 - 已存在的 MariaDB 历史配置如果没有 `port` 或 `socket`，继续使用原来的 `3306` 和 `/tmp/mysql.sock`。 - 只有新生成的 MariaDB 配置才使用 `3307` 和 `/tmp/mariadb.sock`。 - 已配置自定义端口或 Socket 的用户继续使用自定义值。 - 未修改 MySQL group service 的独立实例 Socket 和端口逻辑。  ## 验证  - `pnpm exec eslint src/fork/module/Mysql/index.ts src/fork/module/Mariadb/index.ts src/main/core/MCPContextResolver.ts scripts/mcp-context-regression-test.ts scripts/mysql-init-password-port-test.ts` - `pnpm exec tsx scripts/mysql-init-password-port-test.ts` - `pnpm exec tsx scripts/mcp-context-regression-test.ts` - `git diff --check`  全量 `tsc --noEmit` 仍受仓库已有的 Electron/DNS/Image/Podman 等基线类型错误影响，本次修改文件没有新增类型错误。

- **Issue #871** (2026-09-29): **feat: 将数据库启动参数改为读取配置**
  *Symptoms*: 

- **Issue #870** (2026-10-05): **fix(i18n): complete Indonesian Podman translations**
  *Symptoms*: - Add the missing Indonesian translation for rosettaGlobalTip - Add the missing Indonesian translation for rosettaNeedVersion - Complete the Indonesian Podman localization to match the English locale keys
  **Post-Mortem & Fix Analysis**:
  > I also checked the other locales and found that these two keys are currently only present in `en`, and `zh`. The other locales are still missing both keys.  I kept this PR limited to the Indonesian locale for now in `id` , so the scope stays focused. 

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

### Incident Patch 1: `680f8d76` (2026-10-06)
**Commit Message**: 1. Fix Issues

**File**: `build/linux.build.yml` (modified, +1/-1)
```diff
@@ -1 +1 @@
-version: 80
+version: 81
```

---

### Incident Patch 2: `1a276797` (2026-10-06)
**Commit Message**: 1. Fix Issues

**File**: `docs/task/linux-helper-hardening-plan.md` (modified, +9/-0)
```diff
@@ -319,3 +319,12 @@ Web 服务沿用同 UID 的普通停止链，不新增 root PID 信号或进程
 - 七组迁移、Linux 启动/提示行为、helper 合约/版本同步通过；Windows 健康、安装脚本、安装 IPC、安装后 hosts 回归与 Go module/utils 测试通过。Windows Go 测试明确设置 GOOS=windows，避免继承交叉编译配置。
 - main/fork 使用对应平台、入口、打包及分包参数编译通过；修改 TS 文件 lint/格式、Bash 语法与 diff 检查通过。全仓 TypeScript 与 HEAD 对照仍为 38/38，无新增错误。
 - 独立只读复核确认修复后的公共响应未改变 Windows/macOS 业务行为，无剩余重要问题。三端真实安装和发行版包升级仍按原 VM 验收范围验证。本轮未提交、未推送，linux-issues.md 用户修改保持原状。
+
+### 2026-10-06 安装弹窗链路复查
+
+- 操作归属：自动安装沿用 HelperStore 与主进程 AppHelper single-flight；终端安装由 FlyEnvHelper/setup.ts 模块单例持有命令快照、PTY、IPC、提示、健康验证及清理，Vue 页面只挂载显示。页面卸载不终止已授权的安装，终态后释放 loading；无新 Pinia、持久化或模块约束例外。
+- 事件与重入：needInstall 只打开确认，code 200 不结束操作；取消授权、脚本失败和健康检查失败各自结束并报告。图形确认/安装期间拒绝终端入口，主进程安装未结束时拒绝准备终端命令，即使前端超时也不自动重放。正常失败后的终端回退仍保留；重复终端安装复用同一 Promise。
+- 成功条件：安装脚本退出码为 0 且 helper 健康检查通过。目录恢复回调沿用现有独立失败通知；安装后 hosts 同步失败只报告 hosts 结果，不撤销帮助程序安装或再次提权。服务进程生命周期不变，仅清理本次安装 PTY。
+- 修复 Linux 图形提权命令被 Sudo 拒绝的问题：AppHelper 构造原始 Bash 命令，pkexec 按 argv 启动，终端入口单独加 sudo；取消 polkit 与提权后脚本退出 126 分别处理。Unix PTY 可显式报告真实退出码，普通终端调用保留原返回约定；初始化/执行失败不再悬挂安装页面。
+- 新增 17 个安装链路行为用例与 2 个 UI 用例，接入 renderer-operation-boundaries；涵盖真实 Bash 引号/退出码、前后端安装通知、取消、回退、超时、重入、卸载、PTY 初始化失败和 hosts 附加失败。相关 Windows 安装/renderer 回归、Linux 提示/迁移/transport、WSL Go 全包测试通过。
+- main/fork 和相关 Vue 编译、修改文件 ESLint 与 diff 检查通过；全仓 TypeScript 仍有 38 个既有错误，本次修改文件没有错误。独立复查发现并修复图形/终端并发入口后复核通过。当前 Windows/WSL 环境未验证真实 Linux 桌面授权弹窗和发行版安装，不宣称这些验收已经完成。
```

**File**: `package.json` (modified, +2/-0)
```diff
@@ -73,6 +73,8 @@
     "test:startup-hosts-sync": "tsx scripts/startup-hosts-sync-test.ts",
     "test:hosts-idempotent-write": "tsx scripts/hosts-idempotent-write-test.ts",
     "test:stop-process-list-cache": "tsx scripts/stop-process-list-cache-test.ts",
+    "test:unix-process-list": "tsx scripts/unix-process-list-test.ts",
+    "test:service-stop-batch": "tsx scripts/service-stop-batch-test.ts",
     "test:bin-version-cache": "tsx scripts/bin-version-cache-test.ts",
     "test:brew-formula-tap-installed": "tsx scripts/brew-formula-tap-installed-test.ts",
     "test:brew-formula-conflict": "tsx scripts/brew-formula-conflict-test.ts",
```

**File**: `scripts/clickhouse-service-lifecycle-test.ts` (modified, +1/-1)
```diff
@@ -31,7 +31,7 @@ const directStopSource = source.slice(
 assert.match(source, /startService\(version: SoftInstalled, \.\.\.args: any\)/)
 assert.match(source, /private _stopAllServers\(version: SoftInstalled, \.\.\.args: any\)/)
 assert.match(source, /pidPath: this\.versionPidFile\(version\)/)
-assert.match(directStopSource, /const plist = await ProcessListFetch\(\)/)
+assert.match(directStopSource, /const plist = await StopProcessListFetch\(\)/)
 assert.match(
   directStopSource,
   /ProcessOwnedPidsByPidOrDescendant\(\s*pid,\s*plist,\s*\[version\.bin\],\s*\['clickhouse-watchdog'\]\s*\)/,
```

**File**: `scripts/helper-install-hosts-retry-test.ts` (modified, +4/-4)
```diff
@@ -12,19 +12,19 @@ const helperFixSource = readFileSync(
   'utf8'
 )
 const manualInstallerSource = readFileSync(
-  join(root, 'src/render/components/FlyEnvHelper/index.vue'),
+  join(root, 'src/render/components/FlyEnvHelper/setup.ts'),
   'utf8'
 )
 
 assert.match(helperStoreSource, /import \{ handleWriteHosts \} from '@\/util\/Host'/)
 
 const verifyHelperReady = helperStoreSource.match(
-  /verifyHelperReady\(\) \{(?<body>[\s\S]*?)\n[ ]{2}\}\n\n[ ]{2}private handleInstallResult/
+  /verifyHelperReady\(\): Promise<boolean> \{(?<body>[\s\S]*?)\n[ ]{2}\}\n\n[ ]{2}private syncHostsAfterInstall/
 )
 assert.ok(verifyHelperReady?.groups?.body, 'verifyHelperReady must exist')
 assert.match(
   verifyHelperReady.groups.body,
-  /if \(res\?\.code === 0\) \{\s*handleWriteHosts\(\)\s*\.catch\(\(\) => \{\}\)/
+  /if \(res\?\.code !== 0\)[\s\S]*?return[\s\S]*?this\.syncHostsAfterInstall\(\)[\s\S]*?resolve\(true\)/
 )
 
 const installResult = helperStoreSource.match(
@@ -33,7 +33,7 @@ const installResult = helperStoreSource.match(
 assert.ok(installResult?.groups?.body, 'handleInstallResult must exist')
 assert.match(
   installResult.groups.body,
-  /if \(res\?\.code !== 0\)[\s\S]*?return[\s\S]*?handleWriteHosts\(\)\s*\.catch\(\(\) => \{\}\)/
+  /if \(res\?\.code !== 0\)[\s\S]*?return[\s\S]*?this\.syncHostsAfterInstall\(\)/
 )
 
 assert.doesNotMatch(
```

**File**: `scripts/helper-version-sync-test.ts` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@ import path from 'node:path'
 const repoRoot = process.cwd()
 // Go 源码变更的发布版本必须与 Go、应用端同时递增；检查双方一致仍不足以
 // 防止两边一起漏升版本，因此保留独立的本次发布版本断言。
-const expectedVersion = 40
+const expectedVersion = 41
 
 function readFile(relPath: string): string {
   return fs.readFileSync(path.join(repoRoot, relPath), 'utf8')
```

**File**: `scripts/linux-helper-install-flow-test.ts` (added, +715/-0)
```diff
@@ -0,0 +1,715 @@
+import assert from 'node:assert/strict'
+import { createRequire } from 'node:module'
+import { posix as unixPath } from 'node:path'
+import { spawnSync } from 'node:child_process'
+import { build } from 'esbuild'
+import { runInNewContext } from 'node:vm'
+import * as helperState from '../src/shared/WindowsHelperState'
+
+const require = createRequire(import.meta.url)
+const tick = () => new Promise((resolve) => setImmediate(resolve))
+const failures: unknown[] = []
+
+async function load(
+  file: string,
+  dependencies: Record<string, any>,
+  extra: Record<string, any> = {}
+) {
+  const result = await build({
+    entryPoints: [file],
+    bundle: true,
+    platform: 'node',
+    format: 'cjs',
+    write: false,
+    plugins: [
+      {
+        name: 'external-boundaries',
+        setup(builder) {
+          builder.onResolve({ filter: /./ }, (args) => {
+            if (args.kind === 'entry-point') return
+            if (args.path.endsWith('/FlyEnvHelper/index.vue'))
+              return { path: 'installer', namespace: 'fixture' }
+            if (args.kind === 'dynamic-import' && args.path.endsWith('/FlyEnvHelper/setup'))
+              return { path: 'setup', namespace: 'fixture' }
+            return { path: args.path, external: true }
+          })
+          builder.onLoad({ filter: /./, namespace: 'fixture' }, ({ path }) => ({
+            contents:
+              path === 'setup'
+                ? "export {FlyEnvHelperSetup} from '@/components/FlyEnvHelper/setup'"
+                : 'export default {}'
+          }))
+        }
+      }
+    ]
+  })
+  const module = { exports: {} as any }
+  runInNewContext(result.outputFiles[0].text, {
+    module,
+    exports: module.exports,
+    require: (path: string) =>
+      path === 'node:path' || path === 'path'
+        ? unixPath
+        : path in dependencies
+          ? (dependencies[path].default ?? dependencies[path])
+          : /^(node:|events$|path$|fs$)/.test(path)
+            ? require(path)
+            : {},
+    process: { platform: 'linux', cwd: () => '/tmp', env: {}, title: 'FlyEnv' },
+    window: { Server: { isLinux: true, isWindows: false }, removeEventListener() {} },
+    global: {
+      Server: {
+        Static: '/opt/FlyEnv " $literal \'/static',
+        AppDir: '/home/user/FlyEnv/data',
+        BaseDir: '/home/user/FlyEnv/data'
+      }
+    },
+    setTimeout,
+    clearTimeout,
+    console: { log() {}, error() {} },
+    ...extra
+  })
+  return module.exports
+}
+
+async function check(name: string, test: () => Promise<void>) {
+  try {
+    await test()
+    console.log(`PASS: ${name}`)
+  } catch (error) {
+    failures.push(error)
+    console.error(`FAIL: ${name}`, error)
+  }
+}
+
+async function chain() {
+  let installed = false
+  let confirmCount = 0
+  let confirmCancelled = false
+  let elevationFails = false
+  let elevationCancelled = false
+  let elevatedProgramFails = false
+  let hostsFail = false
+  let terminalRuns = 0
+  let terminalStops = 0
+  let terminalDestroyed = 0
+  let terminalMountFails = false
+  let terminalExecutionFails = false
+  let releaseTerminal: (() => void) | undefined
+  let pkexecCalls = 0
+  let hostWrites = 0
+  const notices: any[] = []
+  const messages: string[] = []
+  const listeners = new Map<string, (...args: any[]) => void>()
+  const timers = new Set<() => void>()
+  let sent = 0
+  const ipc = {
+    send(command: string, ...args: any[]) {
+      const key = `request-${++sent}`
+      queueMicrotask(() => route.handleCommand(command, key, ...args))
+      return { key, then: (callback: any) => listeners.set(key, callback) }
+    },
+    on: (key: string) => ({ then: (callback: any) => listeners.set(key, callback) }),
+    off: (key: string) => listeners.delete(key)
+  }
+  const utils = {
+    isLinux: () => true,
+    isWindows: () => false,
+    isMacOS: () => false,
+    uuid: () => 'fixture',
+    appDebugLog: async () => {},
+    waitTime: async () => {}
+  }
+  const sudo = await load('src/shared/Sudo.ts', {
+    './utils': utils,
+    'node:fs/promises': {
+      stat: async (path: string) => {
+        if (path.includes('kdesudo')) throw Object.assign(new Error('absent'), { code: 'ENOENT' })
+      }
+    },
+    'node:child_process': {
+      exec: (_command: string, _options: any, callback: any) =>
+        callback(new Error('must use argv')),
+      execFile: (binary: string, args: string[], _options: any, callback: any) => {
+        pkexecCalls++
+        assert.equal(binary, '/usr/bin/pkexec')
+        assert.equal(args[0], '--disable-internal-agent')
+        assert.equal(args[1], '/bin/bash')
+        assert.equal(args[2], '-c')
+        assert.ok(args[3].includes('/bin/bash'))
+        if (elevationCancelled)
+          callback(Object.assign(new Error('authorization dismissed'), { code: 126, stdout: '' }))
+        else if (elevatedProgramFails)
+          callback(
+            Object.assign(new Error('installer can
```

**File**: `scripts/linux-helper-ui-test.ts` (added, +161/-0)
```diff
@@ -0,0 +1,161 @@
+import assert from 'node:assert/strict'
+import { build } from 'esbuild'
+import { runInNewContext } from 'node:vm'
+
+async function load(file: string, dependencies: Record<string, any>) {
+  const output = await build({
+    entryPoints: [file],
+    bundle: true,
+    platform: 'node',
+    format: 'cjs',
+    write: false,
+    plugins: [
+      {
+        name: 'renderer-boundaries',
+        setup(builder) {
+          builder.onResolve({ filter: /^@\/components\/FlyEnvHelper\/index\.vue$/ }, () => ({
+            path: 'installer',
+            namespace: 'fixture'
+          }))
+          builder.onLoad({ filter: /./, namespace: 'fixture' }, () => ({
+            contents: 'export default {}'
+          }))
+          builder.onResolve({ filter: /./ }, ({ path }) =>
+            path in dependencies ? { path, external: true } : undefined
+          )
+        }
+      }
+    ]
+  })
+  const module = { exports: {} as any }
+  runInNewContext(output.outputFiles[0].text, {
+    module,
+    exports: module.exports,
+    require: (path: string) => dependencies[path].default ?? dependencies[path],
+    window: { Server: { isLinux: true, isWindows: false } },
+    console
+  })
+  return module.exports
+}
+
+const failures: unknown[] = []
+async function check(name: string, test: () => Promise<void>) {
+  try {
+    await test()
+    console.log(`PASS: ${name}`)
+  } catch (error) {
+    failures.push(error)
+    console.error(`FAIL: ${name}`, error)
+  }
+}
+
+await check('Linux needInstall status reaches the existing installation dialog', async () => {
+  const callbacks = new Map<string, (...args: any[]) => void>()
+  const prompts: string[] = []
+  let pending = false
+  const { default: notifications } = await load('src/render/util/GlobalIPCOn.ts', {
+    '@/util/MCP': { setupMcpIpc: () => {} },
+    '@/util/IPC': {
+      default: { on: (key: string) => ({ then: (fn: any) => callbacks.set(key, fn) }) }
+    },
+    '@/util/Element': {
+      MessageError: () => {},
+      MessageSuccess: () => {},
+      MessageWarning: () => {}
+    },
+    '@/components/FlyEnvHelper/setup': { FlyEnvHelperSetup: { show: false } },
+    '@/store/helper': {
+      default: {
+        isInstallResultPending: () => pending,
+        shouldShowNeedInstallDialog: () => true,
+        showNeedInstallDialog: (reason: string) => prompts.push(reason)
+      }
+    },
+    '@/util/NodeFn': { nativeTheme: {} },
+    'lodash-es': { isEqual: () => false },
+    '@/store/app': { AppStore: () => ({}) },
+    '@/components/Setup/store': { SetupStore: () => ({}) },
+    '@lang/index': { I18nT: (key: string) => key },
+    '@/core/AppModules': { syncRendererPluginModules: () => Promise.resolve() },
+    '@/components/Setup/WindowsElevationMethod/Controller': { default: {} },
+    '@shared/WindowsHelperState': { WINDOWS_ELEVATION_CHOICE_VERSION: 1 }
+  })
+  notifications.init()
+  const notify = callbacks.get('APP-FlyEnv-Helper-Notice')!
+  notify('', { code: 1, status: 'needInstall', reason: 'helper_key_missing' })
+  assert.deepEqual(prompts, ['helper_key_missing'])
+  pending = true
+  notify('', { code: 1, status: 'needInstall' })
+  assert.equal(prompts.length, 1, 'installation in progress must suppress repeated prompts')
+  pending = false
+  notify('', { code: 1, status: 'installing' })
+  assert.equal(prompts.length, 1, 'other status events must not request another installation')
+  notify('', { code: 1, reason: 'helper_pipe_unreachable' })
+  assert.deepEqual(prompts, ['helper_key_missing', 'helper_pipe_unreachable'])
+})
+
+await check('Linux repair releases entry loading without waiting for a dialog submit', async () => {
+  let opened = 0
+  let failOpen = false
+  const errors: string[] = []
+  const dependencies: Record<string, any> = {
+    vue: { reactive: (value: any) => value, markRaw: (value: any) => value },
+    '@/util/IPC': { default: {} },
+    'element-plus': { ElMessage: { error: (msg: string) => errors.push(msg), success: () => {} } },
+    '@lang/index': { I18nT: (key: string) => key },
+    '@/util/Index': { reactiveBind: (value: any) => value },
+    '@/util/Element': { MessageError: (msg: string) => errors.push(msg) },
+    '@/util/XTerm': { default: class {} },
+    '@/store/helper': { default: { isInstalling: () => false } },
+    '@/util/AsyncComponent': {
+      AsyncComponentShow: () => {
+        opened++
+        if (failOpen) return Promise.reject(new Error('dialog mount failed'))
+        state.show = true
+        // Closing this dialog never emits onSubmit: its promise remains pending.
+        return new Promise(() => {})
+      }
+    }
+  }
+  const state = (await load('src/render/components/FlyEnvHelper/setup.ts', dependencies))
+    .FlyEnvHelperSetup
+  state.command = 'stale command'
+  dependencies['@/components/FlyEnvHelper/setup'] = { FlyEnvHelperSetup: state }
+  const { FlyEnvHelperFix: fix } = await load(
+    'src/render/components/Setup/FlyEnvHelper/setup.t
```

**File**: `scripts/renderer-operation-boundaries-test.ts` (modified, +3/-0)
```diff
@@ -480,4 +480,7 @@ assert.match(privilegeController, /IPC\.off\(key\)/)
 assert.match(privilegeController, /private operation\?: Promise<void>/)
 assert.match(privilegeController, /snapshot\.revision < /)
 
+await import('./linux-helper-ui-test')
+await import('./linux-helper-install-flow-test')
+
 console.log('renderer operation boundary tests passed')
```

---

### Incident Patch 3: `cc8f6208` (2026-10-06)
**Commit Message**: 1. Fix Issues

**File**: `build/linux.build.yml` (modified, +1/-1)
```diff
@@ -1 +1 @@
-version: 79
+version: 80
```

---

### Incident Patch 4: `548e4c52` (2026-10-06)
**Commit Message**: 1. Fix Issues

**File**: `docs/task/linux-helper-hardening-plan.md` (added, +321/-0)
```diff
@@ -0,0 +1,321 @@
+# Linux 帮助程序权限优化方案
+
+日期：2026-10-05。
+
+状态：已按用户授权实施，当前分支 `fix/linux-helper-hardening`。以下为批准方案，实际简化取舍与验证记录见第 13 节。未安装线上 helper，未修改真实 hosts 或系统信任库。
+
+依据：[用户安全反馈](linux-issues.md)、根目录 AGENTS.md、模块边界与失败边界技能，以及现有 Windows 权限执行链。
+
+## 1 目标和已确认约束
+
+保留 Linux 常驻 root helper，把桌面用户获得的能力从“执行 root 脚本、覆盖系统文件”收缩为安装时明确批准的有限业务操作。每个请求都由 helper 核验真实调用者、操作类别、资源范围和参数；普通权限能够完成的操作回到普通进程。
+
+用户已确认：
+
+- 盘点目前 Linux 需要权限的操作。
+- 关闭任意脚本执行和通用系统文件覆盖，提供明确的业务接口。
+- helper 增加权限验证。
+- Pure-Ftpd 可以由 helper 以 root 启动，兼容 FlyEnv 普通用户安装的版本；不要求管理员安装 FTP，也不检查程序或动态库完整性。这类被篡改程序的风险由用户明确排除在本轮范围外。
+- helper 仅安装时授权，其日常业务请求不再显示认证窗口。
+- helper 不采用 UAC 式一次性提权执行，不增加日常 polkit、pkexec 或 sudo 密码弹窗。
+- hosts 保留任意域名、任意 IP 地址和界面全文编辑，不增加域名/IP 授权名单。
+- XTerm 命令中必要的 sudo 保留，包括应用生成并在 XTerm 展示执行的安装维护命令，不限于用户手工输入的命令；终端中的 sudo 继续遵循操作系统自己的认证和权限规则。
+
+因此，helper 的权限验证是“安装时建立授权策略，日常由 helper 强制执行”，不采用逐次管理员认证。新增 helper 权限范围只能通过重新执行受管理员授权的安装维护流程变更；日常 RPC 超出范围时直接失败，不能自动弹窗扩大权限。XTerm 现有必要 sudo 属于独立的终端执行能力，其系统认证提示不受“helper 日常无认证窗口”约束，不迁入 helper 授权策略。
+
+**安全目标**：关闭通用 root 脚本执行、系统文件覆盖和任意进程终止接口，由 helper 强制执行身份与业务资源约束。Pure-Ftpd 的用户安装程序仍以 root 运行，按用户明确要求不处理程序及依赖被篡改的风险；因此本方案不声称阻断同 UID 经这个 root 程序执行路径取得任意 root 代码执行。
+
+**授权边界**：安装时批准的有限业务能力仍可被该用户的其他代码调用；无日常认证的设计不能同时保证“每次操作必然由用户亲自点击”。例如 `/etc/hosts` 的完整内容修改、已批准证书安装和低端口绑定能力仍属于被委托的权限。hosts 全文写入可以改变系统域名解析；该能力是本次明确保留的长期授权，不能声称能阻止同 UID 代码修改系统解析。不能把 HMAC 或客户端路径检查描述为同用户恶意代码的隔离保证。
+
+## 2 当前 Linux 提权操作盘点
+
+以下区分“当前代码使用 root/helper”与“业务确实需要系统权限”。普通配置、日志、插件和环境变量通常无需 root，当前回退行为不代表必须保留提权。
+
+| 操作 | 当前入口和执行方式 | 权限判断与建议 |
+| --- | --- | --- |
+| helper 安装和升级 | `src/main/core/AppHelper.ts`、`static/sh/Linux/flyenv-helper-init.sh`；写 `/usr/local/bin`、角色/根目录策略、systemd unit 并启停服务 | 确需管理员权限；保留安装维护授权，保护来源、策略和发布顺序 |
+| Nginx、Apache 启动 | 对应 fork 模块调用 `serviceStartExec({root:true})`，最终 `tools.runScript` | 80/443 等低端口可能需要额外权限；不应因此让用户提供的程序和配置以 root 运行 |
+| Caddy、FrankenPHP 启动 | 同上，Linux 固定走 root 分支 | 按实际端口决定；普通端口普通启动，低端口只提供绑定能力 |
+| Tomcat、Numa 启动 | `Tomcat/index.ts`、`Numa/index.ts`，Linux 固定 `root:true` | 源码不足以证明业务始终需要 root；先移除固定 root，按实际缺失能力判断，不自动恢复 root |
+| Pure-Ftpd 启动 | `PureFtpd/index.ts` 使用 `sudo -S`，不经过 helper；终端分支还包含 macOS 特定代码 | FTP 低端口、身份切换和系统认证是不同权限；不能统一替换为低端口 capability，需单独验收兼容性 |
+| 自定义服务、语言项目的 sudo 模式 | `customerServiceStartExec`、`ModuleCustomer.ts`、`LanguageProjects/ProjectItem.ts` 的 `isSudo` | 本质是任意用户命令提权；不迁入 helper，Linux 应取消应用后台自动 sudo 模式 |
+| 站点 hosts 同步、删除及退出清理 | `Host/index.ts`、`ServerManager.cleanHosts()`，通过通用 root 写入覆盖 `/etc/hosts` | 确需系统文件写权限；改为 helper 解析并更新自己的托管块 |
+| 手工 hosts／系统环境文件编辑 | `Tool.systemEnvSave`、main 的通用 `fs_writeFile`／`fs_writeBufferBase64` 回退；环境文件列表含 `/etc/profile`、`/etc/paths` | hosts 全文编辑改走固定目标的专用接口；其他系统文件关闭自动 root 全文编辑，普通读取，禁止通用写入回退 |
+| CA 证书加入系统信任 | `Host/SSL.ts` → `host.sslAddTrustedCert`；helper 内调用 sudo cp 和系统 CA 更新工具 | 确需系统权限；仅能安装管理员在 helper 安装时批准并留存的证书 |
+| CA 证书查询 | `host.sslFindCertificate` 使用 find、openssl | 优先普通读取和 Go 证书解析；不为查询新增 root 通用文件访问 |
+| DNS 缓存刷新 | `host.dnsRefresh` 在 root helper 内再次 sudo，尝试重启 resolved、nscd、dnsmasq | 可能需要系统权限；限制为固定解析器刷新，优先作为 hosts 写入后的附加动作 |
+| 进程列表、端口进程查询 | `ProcessListFetch`、`fetchProcessPidByPort` 会优先使用 helper | 优先普通查询；确需 helper 查询时只返回有限元数据，不返回 root 进程的任意敏感内容 |
+| 服务停止、PID 工具、清理端口 | `ProcessKillStrict`、`Tool/process.ts` → `tools.kill`、`tools.killPorts` | 同 UID 进程通常普通权限可停止；取消对任意 PID/端口目标的 root 终止能力 |
+| PID 目录所有者修复和删除 | `Base.ensureAppPidDirWritable` → `redis.logFileFixed`，随后可回退 `tools.rm` | 旧 root 启动可能留下 root 所有目录；仅保留固定 PID 目录的所有者修复，不递归删除或任意 chown |
+| PHP ini 创建、复制及保存 | `Php/index.ts`、`php.iniFileFixed`、`tools.chmod`、通用 root 写入 | FlyEnv 自有 PHP 改用用户配置文件；系统 PHP 配置不提供通用 root 覆盖；取消 777 提权修复 |
+| RabbitMQ 管理插件初始化 | `RabbitMQ._initPlugin` → `rabbitmq.initPlugin`；helper 执行调用者指定目录中的 `rabbitmq-plugins` | 另一条执行用户可修改程序的 root 路径；移到普通用户执行，不仅关闭 runScript |
+| Shell 集成、PATH、别名 | `Tool/init.ts`、`path.ts`、`alias.ts`；通用 root 读写，集成脚本还会 helper chmod/chown | 改为用户数据目录中的集成脚本和用户 profile；不修改安装目录权限，不使用 root |
+| 通用 root 文件操作 | `Fn.ts`、main utils、`AppNodeFn.ts` → read/write/base64/rm/chmod；`ln_s` 已公开但未找到当前业务调用 | Linux 停用这些 RPC；普通权限失败如实返回，不能再自动扩大权限 |
+| Git、Homebrew 依赖安装 | `Git/setup.ts`、`VersionManager/brew/setup.ts` 和 Linux brew 安装脚本，在终端使用 sudo/package manager | 保留 XTerm 自动生成的必要 sudo 安装命令和终端交互；不把包管理器或远程安装脚本暴露为 helper RPC |
+| pgvector 编译安装 | `PostgreSql/Extension/setup.ts` 的终端实际执行 sudo make/install/rm；fork 的 `installPgvector` 当前只生成脚本，执行代码已注释 | 保留 XTerm 中系统目录安装及需要权限的清理等必要 sudo；不统一删除现有终端命令中的 sudo，也不开放 helper root 构建接口；某条编译命令是否需要 sudo 可单独评估 |
+| Ollama 硬件信息 | `Ollama/Linux.ts` 使用 `sudo dmidecode -t memory` | 补充硬件信息不应静默提权；采用普通可读信息，权限不足时省略详细字段 |
+| 应用保存和复用 sudo 密码 | `IPCHandler.handlePasswordCheck` 将密码写配置、放入 `global.Server.Password` 并回传 renderer；`execPromiseSudo` 自动送入 stdin，`NodePTY.ts` 也会响应 `Password:` 注入该值 | Linux 停止保存、广播和跨请求自动复用管理员密码，清理旧配置和内存值；保留 XTerm 命令、用户终端输入与 sudo 自身的认证机制 |
+
+盘点说明：
+
+- MySQL/MariaDB 的 `macportsDirFixed`、Mailpit quarantine 清理、MacPorts 和 Windows 系统 PATH 属于其他平台，不纳入 Linux 接口保留名单。
+- OpenClaw 的 Linux 服务安装使用 `systemctl --user`；源码中的 `sudo openclaw` 仅在 macOS 分支，不算 Linux root 
```

**File**: `docs/task/linux-issues.md` (added, +43/-0)
```diff
@@ -0,0 +1,43 @@
+# Security issue in FlyEnv, local privilege escalation to root via flyenv-helper
+
+Hi Alex,
+
+I've been using FlyEnv-4.18.3 (also checked in FlyEnv-4.19.1-x64) on Ubuntu 26.06-LTS & Ubuntu 24.04.5 LTS in a VM and while poking around the helper I ran into a privilege-escalation problem I think you'll want to look at sooner rather than later. The short version: any code running as the local user that runs FlyEnv can turn itself into root through flyenv-helper.
+
+When the helper gets installed it runs as a root systemd service and listens on
+a Unix socket. That part is fine. But one of the privileged methods, runScript, takes
+a script path and runs it as root. It checks that the file is named start-*.sh, but it
+never checks who owns the file or whether a normal user can write to it. And one of
+those allowed folders is the FlyEnv data directory (~/.config/FlyEnv), which the user
+obviously owns and can write to.
+
+So the whole thing collapses into this: I drop my own start-whatever.sh into
+~/.config/FlyEnv, I ask the helper to runScript it, and root executes my script.
+I've attached a screenshot of my PoC doing exactly that: a normal user going
+straight to uid=0(root).
+
+The one thing that's supposed to gate this is the HMAC signature, but the
+installer chowns the signing key to the desktop user (0600, but owned by that same
+user), so I can just read it and sign my own requests.
+
+I do want to be fair about the blast radius, because it's easy to overstate this:
+it is NOT "any local user becomes root". The socket and the key are 0600 owned by
+the FlyEnv user, and the helper verifies the caller's uid over the socket, so a different
+local user can't reach it. I tested this both ways and the isolation holds. What it really is:
+the user who runs FlyEnv can escalate to root. That still matters a lot, because it means
+anything that ends up running code as that user, a malicious project you open in the app,
+a poisoned dependency, a bug in the renderer, plain local malware, gets a path to root.
+
+I've kept the step-by-step reproduction out of this email on purpose, but I have a full
+PoC and notes ready. If you need more details to pin it down or fix it, just ask and I'll
+send over whatever helps you most.
+
+I'm in no rush to publish anything. I'm happy to hold off on any public write-up until
+you've had time to ship a fix, and to test a patch for you on the same setup. Just let me
+know what timeline works.
+
+Thanks for FlyEnv, honestly, it's a genuinely useful tool and I'd rather see this
+quietly fixed.
+
+Best,
+Sergio | @sd0lv
```

**File**: `scripts/helper-contract-check.ts` (modified, +39/-10)
```diff
@@ -102,7 +102,9 @@ function checkArgType(call: HelperCall, spec: MethodSpec, arg: ArgSpec, node: ts
   const loc = `${path.relative(repoRoot, call.file)}:${call.line}`
   if (arg.type === 'string[]' || arg.type === 'processStartIdentity[]') {
     if (actual !== 'array') {
-      errors.push(`${loc} ${methodKey(spec.module, spec.function)} arg ${arg.name} must be an array`)
+      errors.push(
+        `${loc} ${methodKey(spec.module, spec.function)} arg ${arg.name} must be an array`
+      )
       return
     }
     const arr = node as ts.ArrayLiteralExpression
@@ -122,24 +124,32 @@ function checkArgType(call: HelperCall, spec: MethodSpec, arg: ArgSpec, node: ts
         const properties = new Map<string, ts.Expression>()
         for (const property of element.properties) {
           if (!ts.isPropertyAssignment(property)) {
-            errors.push(`${loc} ${methodKey(spec.module, spec.function)} arg ${arg.name} has an invalid identity property`)
+            errors.push(
+              `${loc} ${methodKey(spec.module, spec.function)} arg ${arg.name} has an invalid identity property`
+            )
             continue
           }
           const key = property.name.getText().replace(/^['"]|['"]$/g, '')
           if (!['pid', 'created', 'source', 'path'].includes(key)) {
-            errors.push(`${loc} ${methodKey(spec.module, spec.function)} arg ${arg.name} identity has unknown field ${key}`)
+            errors.push(
+              `${loc} ${methodKey(spec.module, spec.function)} arg ${arg.name} identity has unknown field ${key}`
+            )
           }
           properties.set(key, property.initializer)
         }
         for (const key of ['pid', 'created', 'source']) {
           if (!properties.has(key)) {
-            errors.push(`${loc} ${methodKey(spec.module, spec.function)} arg ${arg.name} identity is missing ${key}`)
+            errors.push(
+              `${loc} ${methodKey(spec.module, spec.function)} arg ${arg.name} identity is missing ${key}`
+            )
           }
         }
         for (const key of ['created', 'source', 'path']) {
           const value = properties.get(key)
           if (value && literalKind(value) && literalKind(value) !== 'string') {
-            errors.push(`${loc} ${methodKey(spec.module, spec.function)} arg ${arg.name} identity ${key} must be a string`)
+            errors.push(
+              `${loc} ${methodKey(spec.module, spec.function)} arg ${arg.name} identity ${key} must be a string`
+            )
           }
         }
         const source = properties.get('source')
@@ -157,14 +167,20 @@ function checkArgType(call: HelperCall, spec: MethodSpec, arg: ArgSpec, node: ts
           sourceValue !== 'cim' &&
           !(sourceValue === 'cim-descendant' && allowsDescendant)
         ) {
-          errors.push(`${loc} ${methodKey(spec.module, spec.function)} arg ${arg.name} identity has invalid source ${sourceValue}`)
+          errors.push(
+            `${loc} ${methodKey(spec.module, spec.function)} arg ${arg.name} identity has invalid source ${sourceValue}`
+          )
         }
         if (sourceValue === 'cim' && !properties.has('path')) {
-          errors.push(`${loc} ${methodKey(spec.module, spec.function)} arg ${arg.name} CIM identity is missing path`)
+          errors.push(
+            `${loc} ${methodKey(spec.module, spec.function)} arg ${arg.name} CIM identity is missing path`
+          )
         }
         const pid = properties.get('pid')
         if (pid && literalKind(pid) && literalKind(pid) !== 'number') {
-          errors.push(`${loc} ${methodKey(spec.module, spec.function)} arg ${arg.name} identity pid must be a number`)
+          errors.push(
+            `${loc} ${methodKey(spec.module, spec.function)} arg ${arg.name} identity pid must be a number`
+          )
         }
       }
     }
@@ -240,21 +256,34 @@ function extractGoDispatch(): Map<string, Set<string>> {
   const text = fs.readFileSync(helperGoPath, 'utf-8')
   const dispatch = new Map<string, Set<string>>()
   let currentModule = ''
+  const indent = text.match(/^(\t+)switch info\.Module \{/m)?.[1]
+  if (!indent) {
+    errors.push('Unable to find the Go module dispatcher')
+    return dispatch
+  }
+  const moduleCase = new RegExp(`^${indent}case "([^"]+)":`)
+  const functionCase = new RegExp(`^${indent}\\tcase "([^"]+)":`)
 
   for (const line of text.split(/\r?\n/)) {
-    const moduleMatch = line.match(/^\t\tcase "([^"]+)":/)
+    const moduleMatch = line.match(moduleCase)
     if (moduleMatch) {
       currentModule = moduleMatch[1]
       if (!dispatch.has(currentModule)) dispatch.set(currentModule, new Set())
       continue
     }
 
-    const fnMatch = line.match(/^\t\t\tcase "([^"]+)":/)
+    const fnMatch = line.match(functionCase)
     if (fnMatch && currentModule) {
       dispatch.get(currentModule)?.add(fnMatch[1])
     }
   }
 
+  const linux = fs.readFileSync(path.join(repoRoot, 'src/helper-go/linux.go'), 'utf8')
+  for (con
```

**File**: `scripts/helper-version-sync-test.ts` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@ import path from 'node:path'
 const repoRoot = process.cwd()
 // Go 源码变更的发布版本必须与 Go、应用端同时递增；检查双方一致仍不足以
 // 防止两边一起漏升版本，因此保留独立的本次发布版本断言。
-const expectedVersion = 35
+const expectedVersion = 40
 
 function readFile(relPath: string): string {
   return fs.readFileSync(path.join(repoRoot, relPath), 'utf8')
```

**File**: `scripts/linux-helper-chain-test.ts` (added, +112/-0)
```diff
@@ -0,0 +1,112 @@
+import assert from 'node:assert/strict'
+import { build } from 'esbuild'
+import { mkdtemp, writeFile, rm } from 'node:fs/promises'
+import { tmpdir } from 'node:os'
+import { join } from 'node:path'
+import { pathToFileURL } from 'node:url'
+import { createAppHelperChecker } from '../src/shared/AppHelperCheck'
+
+const directory = await mkdtemp(join(tmpdir(), 'flyenv-helper-chain-'))
+try {
+  const mocks: Record<string, string> = {
+    '@shared/utils': `import {randomUUID} from 'node:crypto';export const uuid=randomUUID,isLinux=()=>true,isWindows=()=>false,appDebugLog=async()=>{};`,
+    '@shared/AppHelperCheck': `export const AppHelperCheck=async()=>true,AppHelperSocketPathGet=async()=>'',getHelperKey=async()=>null,helperResponseErrorCode=()=>'',helperTaskAuthFields=()=>({}),signTaskItem=()=>'',windowsHelperBinaryExists=()=>true;`,
+    '@shared/WindowsPrivilege': 'export const hasWindowsPrivilegeProvider=()=>false;',
+    '@shared/WindowsPrivilegeOperation':
+      'export const executeWindowsPrivilegeOperation=()=>{throw Error("unexpected Windows operation")};',
+    '@shared/WindowsHelperFallback':
+      'export const runWindowsHelperFallback=()=>{throw Error("unexpected Windows fallback")};',
+    '@shared/OperationTiming': 'export const timeOperation=(_name,fn)=>fn();',
+    '@shared/WindowsPathDiagnostics': 'export const bindWindowsPathLogger=()=>()=>{};'
+  }
+  const result = await build({
+    stdin: {
+      contents:
+        "export {Helper} from './src/fork/Helper'; export {AppHelperError} from './src/shared/WindowsHelperState'",
+      resolveDir: process.cwd()
+    },
+    bundle: true,
+    platform: 'node',
+    format: 'esm',
+    write: false,
+    plugins: [
+      {
+        name: 'linux-helper-boundaries',
+        setup(builder) {
+          // Use the same Error class as the real checker loaded by this script.
+          builder.onResolve({ filter: /WindowsHelperState$/ }, () => ({
+            path: pathToFileURL(join(process.cwd(), 'src/shared/WindowsHelperState.ts')).href,
+            external: true
+          }))
+          builder.onResolve({ filter: /^@shared\// }, ({ path }) =>
+            path in mocks ? { path, namespace: 'mock' } : undefined
+          )
+          builder.onLoad({ filter: /./, namespace: 'mock' }, ({ path }) => ({
+            contents: mocks[path],
+            loader: 'js'
+          }))
+        }
+      }
+    ]
+  })
+  const file = join(directory, 'chain.mjs')
+  await writeFile(file, result.outputFiles[0].text)
+  const { Helper, AppHelperError } = await import(pathToFileURL(file).href)
+  for (const [code, shouldNotify] of [
+    ['helper_pipe_unreachable', true],
+    ['helper_version_mismatch', true],
+    ['helper_key_missing', true],
+    ['helper_key_invalid', true],
+    ['helper_execution_failed', false],
+    ['helper_signature_invalid', false]
+  ] as const) {
+    let notices = 0
+    let fallback = 0
+    let connects = 0
+    const error = new AppHelperError(code, 'test failure')
+    const keyFailure = code === 'helper_key_missing' || code === 'helper_key_invalid'
+    const helper = new Helper({
+      appHelperCheck: keyFailure
+        ? createAppHelperChecker({
+            isWindows: () => false,
+            isLinux: () => true,
+            getHelperKey: async () => (code === 'helper_key_missing' ? null : Buffer.alloc(31)),
+            createConnection: (() => {
+              connects++
+              throw new Error('unexpected unsigned dispatch')
+            }) as any
+          })
+        : async () => {
+            throw error
+          },
+      createConnection: () => {
+        connects++
+        throw Error('unexpected dispatch')
+      },
+      isWindows: () => false,
+      getHelperKey: async () => null,
+      helperRequestTimeoutMs: 100,
+      runWindowsHelperFallback: async () => {
+        fallback++
+        throw Error('unexpected elevation')
+      }
+    })
+    helper.appHelper = {
+      needInstall: () => {
+        notices++
+      },
+      initHelper: () => {
+        throw Error('daily operation must not install')
+      }
+    }
+    await assert.rejects(helper.send('host', 'readHosts'), (got: any) =>
+      keyFailure ? got.code === code : got === error
+    )
+    assert.equal(notices, shouldNotify ? 1 : 0, code)
+    assert.equal(connects, 0, 'failed prerequisite must not dispatch a business request')
+    assert.equal(fallback, 0, 'maintenance hint must not select an elevation fallback')
+  }
+  console.log('Linux helper chain: maintenance hints preserve errors and do not elevate')
+} finally {
+  await rm(directory, { recursive: true, force: true })
+}
```

**File**: `scripts/linux-helper-migration-test.ts` (added, +333/-0)
```diff
@@ -0,0 +1,333 @@
+import assert from 'node:assert/strict'
+import { EventEmitter } from 'node:events'
+import { spawnSync } from 'node:child_process'
+import { build } from 'esbuild'
+import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
+import { tmpdir } from 'node:os'
+import { join } from 'node:path'
+import { pathToFileURL } from 'node:url'
+import { parse, compileScript } from '@vue/compiler-sfc'
+import { createAppHelperChecker, HelperVersion } from '../src/shared/AppHelperCheck'
+
+const selected = process.argv[2]
+const cases: Record<string, () => Promise<void>> = {
+  async transport() {
+    const paths: string[] = []
+    let legacyOnly = false
+    const check = createAppHelperChecker({
+      isWindows: () => false,
+      isLinux: () => true,
+      getHelperKey: async () => Buffer.alloc(32),
+      createConnection: ((path: string) => {
+        paths.push(path)
+        const socket = new EventEmitter() as any
+        socket.destroy = () => socket
+        socket.end = () => socket.emit('end')
+        socket.write = (text: string) => {
+          const request = JSON.parse(text)
+          queueMicrotask(() =>
+            socket.emit(
+              'data',
+              Buffer.from(JSON.stringify({ key: request.key, code: 0, data: HelperVersion }))
+            )
+          )
+        }
+        queueMicrotask(() => {
+          if (legacyOnly && path !== '/tmp/flyenv-helper.sock')
+            socket.emit('error', new Error('new helper missing'))
+          else socket.emit('connect')
+        })
+        return socket
+      }) as any
+    } as any)
+    assert.equal(await check(), true)
+    assert.equal(paths[0], '/run/flyenv-helper/helper.sock')
+    legacyOnly = true
+    await assert.rejects(check(), /new helper missing/)
+    assert.equal(paths.length, 2, 'checker must never retry the legacy socket')
+    for (const [key, code] of [
+      [null, 'helper_key_missing'],
+      [Buffer.alloc(31), 'helper_key_invalid']
+    ] as const) {
+      let connects = 0
+      const check = createAppHelperChecker({
+        isWindows: () => false,
+        isLinux: () => true,
+        getHelperKey: async () => key,
+        createConnection: (() => {
+          connects++
+          throw new Error('unsigned requests must not reach the helper')
+        }) as any
+      })
+      await assert.rejects(check(), (error: any) => error.code === code)
+      assert.equal(connects, 0, 'key failures must be classified before dispatch')
+    }
+  },
+  async installer() {
+    const source = await readFile('static/sh/Linux/flyenv-helper-init.sh', 'utf8')
+    const stop = source.match(/^stop_existing_helper\(\) \{[\s\S]*?^\}/m)?.[0]
+    assert.ok(stop, 'installer needs a tested existing-service stop gate')
+    for (const scenario of ['absent', 'stop-failed', 'still-running', 'stopped']) {
+      const script: string = `SERVICE_NAME=flyenv-helper
+SCENARIO='${scenario}'
+systemctl() {
+  if [ "$1" = stop ]; then [ "$SCENARIO" != stop-failed ]; return; fi
+  case "$*" in
+    *LoadState*) if [ "$SCENARIO" = absent ]; then echo not-found; else echo loaded; fi;;
+    *ActiveState*) if [ "$SCENARIO" = still-running ]; then echo active; else echo inactive; fi;;
+    *MainPID*) if [ "$SCENARIO" = still-running ]; then echo 123; else echo 0; fi;;
+    *) return 1;;
+  esac
+}
+${stop}
+stop_existing_helper`
+      const executable = process.platform === 'win32' ? 'wsl' : '/bin/bash'
+      const args =
+        process.platform === 'win32'
+          ? ['-d', 'Ubuntu-24.04', '--exec', '/bin/bash', '-c', script]
+          : ['-c', script]
+      const result = spawnSync(executable, args, {
+        encoding: 'utf8'
+      })
+      if (result.error) throw result.error
+      assert.equal(
+        result.status,
+        ['absent', 'stopped'].includes(scenario) ? 0 : 1,
+        scenario + ': ' + result.stderr
+      )
+    }
+    // Execute the whole installer with only its privileged/system operations doubled.
+    // A failed stop must preserve credentials, not merely avoid replacing the binary.
+    for (const scenario of ['stop-failed', 'stopped']) {
+      const script = `
+scratch=$(mktemp -d)
+printf old > "$scratch/key"
+(
+id() { echo 0; }
+stat() { if [ "$2" = %u ]; then echo 0; else echo 755; fi; }
+install() { :; }
+mktemp() { if [[ "$1" == /usr/local/* ]]; then echo /flyenv-test/helper; else echo "$scratch/unit"; fi; }
+/flyenv-test/helper() { printf new > "$scratch/key"; }
+mv() { :; }
+rm() { :; }
+systemctl() {
+  if [ "$1" = stop ]; then [ '${scenario}' != stop-failed ]; return; fi
+  case "$*" in
+    *LoadState*) echo loaded;;
+    *ActiveState*) echo inactive;;
+    *MainPID*) echo 0;;
+  esac
+}
+set -- /unused/source 1000:1000 /unused/data /unused/root
+${source}
+)
+result=$?
+printf '\\nKEY='; cat "$scratch/key"; printf '\\n'
+rm -r -- "$scratch"
+exit "$result"`
+      const result = spawnSync(
+        process.platform === 'win32' ? 'wsl' : '/bin/bash',
+       
```

**File**: `scripts/linux-service-start-test.ts` (added, +219/-0)
```diff
@@ -0,0 +1,219 @@
+import assert from 'node:assert/strict'
+import { build } from 'esbuild'
+import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
+import { tmpdir } from 'node:os'
+import { join } from 'node:path'
+import { pathToFileURL } from 'node:url'
+
+const calls: unknown[][] = []
+;(globalThis as any).__linuxHelperTest = {
+  send: async (...args: unknown[]) => {
+    calls.push(args)
+    return 12345
+  }
+}
+const mocks: Record<string, string> = {
+  helper: 'export default globalThis.__linuxHelperTest',
+  utils: 'export const isLinux=()=>true,isMacOS=()=>false,isWindows=()=>false',
+  env: 'export default {sync:async()=>process.env}',
+  lang: 'export const I18nT=(key)=>key',
+  process: 'export const ProcessListFetch=async()=>[]',
+  windows:
+    'export const resolveWindowsPowerShellPath=()=>{throw Error("unexpected Windows launcher")}',
+  fn: `import * as fs from 'node:fs';import * as fsp from 'node:fs/promises';
+    export const existsSync=fs.existsSync,writeFile=fsp.writeFile;
+    export const readFile=(p,...args)=>p==='/proc/sys/net/ipv4/ip_unprivileged_port_start' ? Promise.resolve(String(globalThis.__linuxHelperTest.threshold ?? 1024)) : fsp.readFile(p,...args);
+    export const mkdirp=(p)=>fsp.mkdir(p,{recursive:true}),remove=(p)=>fsp.rm(p,{force:true,recursive:true});
+    export const AppLog=(...args)=>args;
+    export const execPromise=async()=>{throw Error('unexpected command')};
+    export const execPromiseSudo=execPromise,removeByRoot=execPromise,spawnPromiseWithEnv=execPromise,waitPidFile=execPromise,waitTime=execPromise;`
+}
+const directory = await mkdtemp(join(tmpdir(), 'flyenv-linux-start-test-'))
+try {
+  const result = await build({
+    stdin: {
+      contents:
+        "export * from './src/fork/util/ServiceStart'; export * from './src/fork/module/Host/LinuxHosts'; export * from './src/fork/util/ListenPorts'; export * from './src/fork/module/Caddy/Ports'",
+      resolveDir: process.cwd()
+    },
+    bundle: true,
+    platform: 'node',
+    format: 'esm',
+    write: false,
+    packages: 'external',
+    plugins: [
+      {
+        name: 'linux-start-fixtures',
+        setup(builder) {
+          builder.onResolve({ filter: /./ }, ({ path }) => {
+            const name =
+              path === '../Helper' || path === '../../Helper'
+                ? 'helper'
+                : path === '../Fn' || path === '../../Fn'
+                  ? 'fn'
+                  : path === '@shared/utils'
+                    ? 'utils'
+                    : path === '@shared/EnvSync'
+                      ? 'env'
+                      : path === '@lang/runtime'
+                        ? 'lang'
+                        : path === '@shared/Process'
+                          ? 'process'
+                          : path === '@shared/WindowsSystemPaths'
+                            ? 'windows'
+                            : ''
+            return name ? { path: name, namespace: 'fixtures' } : undefined
+          })
+          builder.onLoad({ filter: /./, namespace: 'fixtures' }, ({ path }) => ({
+            contents: mocks[path],
+            loader: 'js'
+          }))
+        }
+      }
+    ]
+  })
+  const bundle = join(directory, 'start.mjs')
+  await writeFile(bundle, result.outputFiles[0].text)
+  const {
+    serviceStartSpawn,
+    serviceStartExec,
+    customerServiceStartExec,
+    syncLinuxHosts,
+    replaceLinuxHosts,
+    finishLinuxHostsEditing,
+    portsFromListenConfig,
+    portsFromCaddyConfig
+  } = await import(pathToFileURL(bundle).href)
+  assert.deepEqual(
+    portsFromListenConfig(
+      '# listen 1;\n listen [::]:443 ssl;\n Listen "127.0.0.1:8080"\nlisten unix:/tmp/http.sock;'
+    ),
+    [443, 8080]
+  )
+  assert.deepEqual(
+    portsFromListenConfig('http { server { listen 80; listen "[::]:443" ssl; } } # listen 21;'),
+    [80, 443]
+  )
+  assert.deepEqual(
+    portsFromListenConfig('http { server { listen\n80; set $x "listen 21;"; } }'),
+    [80]
+  )
+  assert.deepEqual(
+    portsFromCaddyConfig({
+      admin: { listen: ':81' },
+      apps: { http: { servers: { main: { listen: [':8443'], tls_connection_policies: [{}] } } } }
+    }),
+    [81, 8443, 80]
+  )
+  assert.deepEqual(
+    portsFromCaddyConfig({
+      apps: {
+        http: {
+          http_port: 8080,
+          https_port: 8443,
+          servers: { main: { listen: ['[::]:8443'], automatic_https: { disable_redirects: true } } }
+        }
+      }
+    }),
+    [8443]
+  )
+  const common = {
+    version: { typeFlag: 'nginx', version: 'test' },
+    baseDir: directory,
+    bin: process.execPath,
+    on: () => {},
+    waitTime: 80,
+    lowPortService: true
+  }
+  const direct = await serviceStartSpawn({
+    ...common,
+    listenPorts: [21, 443],
+    execArgs: ['-e', 'throw Error("known low ports must not execute ordinary startup")']
+  })
+  assert.equal(direct['APP-Service-Start-PID'], '12345')
+  assert.equal(calls.length, 1, 'known l
```

**File**: `src/fork/Fn.ts` (modified, +10/-1)
```diff
@@ -58,7 +58,7 @@ import {
   writeFile
 } from '@shared/fs-extra'
 import { addPath, fetchRawPATH, handleWinPathArr, writePath } from './util/PATH.win'
-import { isWindows, waitTime } from '@shared/utils'
+import { isLinux, isWindows, waitTime } from '@shared/utils'
 import { splitHostAliases } from '@shared/siteRuntime'
 import { timeOperation } from '@shared/OperationTiming'
 import { probeWindowsNTFS } from '@shared/WindowsVolume'
@@ -283,6 +283,10 @@ const validateHelperPath = (path: string): boolean => {
 }
 
 export const writeFileByRoot = async (file: string, content: string) => {
+  if (isLinux()) {
+    await writeFile(file, content)
+    return true
+  }
   if (!validateHelperPath(file)) {
     throw new Error(`Path traversal detected: ${file}`)
   }
@@ -298,6 +302,7 @@ export const writeFileByRoot = async (file: string, content: string) => {
 }
 
 export const readFileByRoot = async (file: string): Promise<string> => {
+  if (isLinux()) return readFile(file, 'utf8')
   if (!validateHelperPath(file)) {
     throw new Error(`Path traversal detected: ${file}`)
   }
@@ -308,6 +313,10 @@ export const readFileByRoot = async (file: string): Promise<string> => {
 }
 
 export const removeByRoot = async (file: string): Promise<void> => {
+  if (isLinux()) {
+    await remove(file)
+    return
+  }
   if (!validateHelperPath(file)) {
     throw new Error(`Path traversal detected: ${file}`)
   }
```

---

### Incident Patch 5: `ea981845` (2026-10-05)
**Commit Message**: build(deps): bump axios from 1.19.0 to 1.20.0 (#884)

Bumps [axios](https://github.com/axios/axios) from 1.19.0 to 1.20.0.
- [Release notes](https://github.com/axios/axios/releases)
- [Changelog](https://github.com/axios/axios/blob/v1.x/CHANGELOG.md)
- [Commits](https://github.com/axios/axios/compare/v1.19.0...v1.20.0)

---
updated-dependencies:
- dependency-name: axios
  dependency-version: 1.20.0
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `package.json` (modified, +1/-1)
```diff
@@ -154,7 +154,7 @@
     "@shikijs/transformers": "^3.4.2",
     "@shikijs/types": "^3.4.2",
     "@xpf0000/node-window-manager": "^0.0.16",
-    "axios": "^1.18.0",
+    "axios": "^1.20.0",
     "chardet": "^2.1.0",
     "compressing": "^1.10.5",
     "date-fns": "^4.1.0",
```

**File**: `yarn.lock` (modified, +4/-4)
```diff
@@ -3464,10 +3464,10 @@ aws4@^1.13.2:
   resolved "https://registry.npmmirror.com/aws4/-/aws4-1.13.2.tgz#0aa167216965ac9474ccfa83892cfb6b3e1e52ef"
   integrity sha512-lHe62zvbTB5eEABUVi/AwVh0ZKY9rMMDhmm+eeyuuUQbQ3+J+fONVQOZyj+DdrvD4BY33uYniyRJ4UJIaSKAfw==
 
-axios@^1.18.0:
-  version "1.19.0"
-  resolved "https://registry.npmmirror.com/axios/-/axios-1.19.0.tgz#ddf864d4c8233c0e6873746ab59361537d05ad39"
-  integrity sha512-ht/iuYZXEjFxLH/Hkezgd7m6JKlHHXEUSneaDz8uZe1Gj5QZtCnpyDsckvAiEnT89OEbCLmnte4R4sn7P0EKFw==
+axios@^1.20.0:
+  version "1.20.0"
+  resolved "https://registry.yarnpkg.com/axios/-/axios-1.20.0.tgz#515513445aa60e71d04b6521ca6210829ccb4786"
+  integrity sha512-r8aOh8j9cGKpgQAqpzrUHnSIc6a59Y3Xf/cv8sy1DrHCkZHzQGEuoq1tARk6qSyDdtQGSDgpb9kFlruzPvrgwg==
   dependencies:
     follow-redirects "^1.16.0"
     form-data "^4.0.6"
```

---

### Incident Patch 6: `61616c22` (2026-10-05)
**Commit Message**: build(deps): bump dompurify from 3.4.13 to 3.4.16 (#883)

Bumps [dompurify](https://github.com/cure53/DOMPurify) from 3.4.13 to 3.4.16.
- [Release notes](https://github.com/cure53/DOMPurify/releases)
- [Commits](https://github.com/cure53/DOMPurify/compare/3.4.13...3.4.16)

---
updated-dependencies:
- dependency-name: dompurify
  dependency-version: 3.4.16
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `package.json` (modified, +1/-1)
```diff
@@ -159,7 +159,7 @@
     "compressing": "^1.10.5",
     "date-fns": "^4.1.0",
     "dns2": "^2.1.0",
-    "dompurify": "^3.4.12",
+    "dompurify": "^3.4.16",
     "electron-is": "^3.0.0",
     "electron-localshortcut": "^3.2.1",
     "electron-log": "^5.4.1",
```

**File**: `yarn.lock` (modified, +4/-4)
```diff
@@ -4505,10 +4505,10 @@ domhandler@^4.0.0, domhandler@^4.2.0, domhandler@^4.3.1:
   dependencies:
     domelementtype "^2.2.0"
 
-dompurify@*, dompurify@^3.4.12:
-  version "3.4.13"
-  resolved "https://registry.npmmirror.com/dompurify/-/dompurify-3.4.13.tgz#fc28949d59f92d62e28a3a764bcbeee35897a1be"
-  integrity sha512-2vmYIoqjze2d+kakP8S/nS5shfsl587kzwEjcGlTdiksUVgFHnFCsLYDVj/JNqJVOQZGSYBTmuycv0PodwmnMQ==
+dompurify@*, dompurify@^3.4.16:
+  version "3.4.16"
+  resolved "https://registry.yarnpkg.com/dompurify/-/dompurify-3.4.16.tgz#c51b3709ea15ee9abb07e804f2ef30ea9b953128"
+  integrity sha512-sqo+pNp3qRhCIpbgRi1y8Tgk27Bo2Ry7w0dC1NBeNTdZChWjz9Xb/KOoZbRP/R6pQZ80Qw8YhXw13hWWBbMRnQ==
   optionalDependencies:
     "@types/trusted-types" "^2.0.7"
 
```

---

### Incident Patch 7: `bacfb456` (2026-10-05)
**Commit Message**: build(deps): bump moment from 2.30.1 to 2.31.0 (#881)

Bumps [moment](https://github.com/moment/moment) from 2.30.1 to 2.31.0.
- [Release notes](https://github.com/moment/moment/releases)
- [Changelog](https://github.com/moment/moment/blob/develop/CHANGELOG.md)
- [Commits](https://github.com/moment/moment/compare/2.30.1...2.31.0)

---
updated-dependencies:
- dependency-name: moment
  dependency-version: 2.31.0
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `yarn.lock` (modified, +3/-3)
```diff
@@ -7175,9 +7175,9 @@ mkdirp@^0.5.1, mkdirp@~0.5.1:
     minimist "^1.2.6"
 
 moment@^2.19.3, moment@^2.22.1:
-  version "2.30.1"
-  resolved "https://registry.npmmirror.com/moment/-/moment-2.30.1.tgz#f8c91c07b7a786e30c59926df530b4eac96974ae"
-  integrity sha512-uEmtNhbDOrWPFS+hdjFCBfy9f2YoyzRpwcl+DqpC6taX21FzsTLQVbMV/W7PzNSX6x/bhC1zA3c2UQ5NzH6how==
+  version "2.31.0"
+  resolved "https://registry.yarnpkg.com/moment/-/moment-2.31.0.tgz#6e19184e8005a9dfc61c9351263d4d6ea2ace7aa"
+  integrity sha512-0acOTfMiWOheYS4eoWb80yYMb/JLvVv9SHbs2PehaDzfUG0Bw855SKyk0IKTnPGa5+U2bmi3W68l1+sGLX/pvw==
 
 monaco-editor@^0.55.1:
   version "0.55.1"
```

---

### Incident Patch 8: `16b28282` (2026-10-05)
**Commit Message**: build(deps): bump ip-address from 10.4.0 to 10.7.2 (#876)

Bumps [ip-address](https://github.com/beaugunderson/ip-address) from 10.4.0 to 10.7.2.
- [Release notes](https://github.com/beaugunderson/ip-address/releases)
- [Commits](https://github.com/beaugunderson/ip-address/compare/v10.4.0...v10.7.2)

---
updated-dependencies:
- dependency-name: ip-address
  dependency-version: 10.7.2
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `yarn.lock` (modified, +3/-3)
```diff
@@ -6119,9 +6119,9 @@ internal-slot@^1.1.0:
     side-channel "^1.1.0"
 
 ip-address@^10.2.0:
-  version "10.4.0"
-  resolved "https://registry.npmmirror.com/ip-address/-/ip-address-10.4.0.tgz#c5910bc541b6eae287765d1e4846be0308a05d93"
-  integrity sha512-oSK96Grm3aP6OrS263xVxbNDGVL7rzBtYdpGqlDG8iQdoenDoTs/nkki+DflYbAEE8Xl6o5YxhxlrKvI3nqKXQ==
+  version "10.7.2"
+  resolved "https://registry.yarnpkg.com/ip-address/-/ip-address-10.7.2.tgz#5b3b2b7d46c6293861b82dfcd49cc203aa8f2c5c"
+  integrity sha512-7H/2gFSIitxc0hG3nOI1glS8QLo/EHBFFLk8vEUjXY/xu0AdL8jZ9U1IzO2PUm0d2D/ofQcAifb0g6OBkt8U7w==
 
 ip-regex@^5.0.0:
   version "5.0.0"
```

---

### Incident Patch 9: `a36a8c7f` (2026-10-05)
**Commit Message**: build(deps): bump undici from 7.29.0 to 7.29.1 (#875)

Bumps [undici](https://github.com/nodejs/undici) from 7.29.0 to 7.29.1.
- [Release notes](https://github.com/nodejs/undici/releases)
- [Commits](https://github.com/nodejs/undici/compare/v7.29.0...v7.29.1)

---
updated-dependencies:
- dependency-name: undici
  dependency-version: 7.29.1
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `package.json` (modified, +1/-1)
```diff
@@ -196,7 +196,7 @@
     "shell-env": "^4.0.2",
     "shiki": "^3.4.2",
     "tangerine": "^1.6.0",
-    "undici": "^7.29.0",
+    "undici": "^7.29.1",
     "vue": "^3.5.17",
     "vue-i18n": "^11.1.7",
     "vue-shadow-dom": "^4.2.0",
```

**File**: `yarn.lock` (modified, +4/-4)
```diff
@@ -9472,10 +9472,10 @@ undici@^6.25.0:
   resolved "https://registry.npmmirror.com/undici/-/undici-6.28.0.tgz#9f0e385744fef5021d6596c5bccd783f61193c1c"
   integrity sha512-LIY910g9TI13YS95lrMFrs8Rm/u/irgHeTWoKCoteeJ04CUJ92eEfj0rVn+7VKMPBpUPiUoBKfhNyLI23EE/KA==
 
-undici@^7.29.0:
-  version "7.29.0"
-  resolved "https://registry.npmmirror.com/undici/-/undici-7.29.0.tgz#ae0f6f62e06e057a9cbb7b2b5fde2bb74f791b8f"
-  integrity sha512-IDxfleLmmbSskfWSUATiN1nfn2rDuvnMOqb5CWR92iIfojA0Ud+ulOAAEQ57LPr9rWmsreUyf5lwyao+7GNNVw==
+undici@^7.29.1:
+  version "7.29.1"
+  resolved "https://registry.yarnpkg.com/undici/-/undici-7.29.1.tgz#7741c6fc8b3e1a48e30323833642bfbe841443ad"
+  integrity sha512-RYONW2MeafgYlkVOKYKkA/Ag7BmXqgIWCa8t1m0JcxrQg9pI9lEqRhAOruOBCbAohOa/gkCF+iPi9hrgvTzu6Q==
 
 unicode-canonical-property-names-ecmascript@^2.0.0:
   version "2.0.1"
```

---

### Incident Patch 10: `089cd6fb` (2026-10-05)
**Commit Message**: 1. Fix Issues

**File**: `src/lang/en/mysql.json` (modified, +1/-0)
```diff
@@ -1,5 +1,6 @@
 {
   "port": "TCP Port (Default: 3306)",
+  "socket": "Local connection Socket path (default: /tmp/mysql.sock). On Windows, this is the named pipe name (default: MySQL).",
   "key_buffer_size": "Buffer size for indexing",
   "query_cache_size": "Query cache, please set to 0 if not enabled",
   "tmp_table_size": "Temporary table cache size",
```

**File**: `src/lang/zh-hant/mysql.json` (modified, +1/-0)
```diff
@@ -1,5 +1,6 @@
 {
   "port": "通訊埠號。預設為 3306",
+  "socket": "本機連線的 Socket 路徑，預設 /tmp/mysql.sock；Windows 下為具名管道名稱，預設 MySQL。",
   "key_buffer_size": "用於索引的緩衝區大小",
   "query_cache_size": "查詢快取，不開啟請設為 0",
   "tmp_table_size": "臨時表快取大小",
```

**File**: `src/lang/zh/mysql.json` (modified, +1/-0)
```diff
@@ -1,5 +1,6 @@
 {
   "port": "端口号. 默认为3306",
+  "socket": "本地连接的 Socket 路径，默认 /tmp/mysql.sock；Windows 下为命名管道名称，默认 MySQL。",
   "key_buffer_size": "用于索引的缓冲区大小",
   "query_cache_size": "查询缓存,不开启请设为0",
   "tmp_table_size": "临时表缓存大小",
```

**File**: `src/render/components/MariaDB/Config.vue` (modified, +13/-1)
```diff
@@ -69,6 +69,17 @@ datadir=${dataDir}`
         return I18nT('mysql.port')
       }
     },
+    {
+      section: 'mariadbd',
+      name: 'socket',
+      value: window.Server.isWindows ? 'MySQL' : '/tmp/mysql.sock',
+      enable: true,
+      isString: true,
+      show: !window.Server.isWindows,
+      tips() {
+        return I18nT('mysql.socket')
+      }
+    },
     {
       section: 'mariadbd',
       name: 'key_buffer_size',
@@ -197,7 +208,8 @@ datadir=${dataDir}`
     }
     const parse = new IniParse(editConfig)
     const arr = [...names]
-      .map((item) => {
+      .map((definition) => {
+        const item = { ...definition }
         const find = parse.get(item.name)
         let value = find ?? item.value
         if (item.isString) {
```

**File**: `src/render/components/Mysql/Config.vue` (modified, +13/-1)
```diff
@@ -69,6 +69,17 @@ datadir=${dataDir}`
         return I18nT('mysql.port')
       }
     },
+    {
+      section: 'mysqld',
+      name: 'socket',
+      value: window.Server.isWindows ? 'MySQL' : '/tmp/mysql.sock',
+      enable: true,
+      isString: true,
+      show: !window.Server.isWindows,
+      tips() {
+        return I18nT('mysql.socket')
+      }
+    },
     {
       section: 'mysqld',
       name: 'key_buffer_size',
@@ -198,7 +209,8 @@ datadir=${dataDir}`
     }
     const parse = new IniParse(editConfig)
     const arr = [...names]
-      .map((item) => {
+      .map((definition) => {
+        const item = { ...definition }
         const find = parse.get(item.name)
         let value = find ?? item.value
         if (item.isString) {
```

---

### Incident Patch 11: `52ead818` (2026-10-05)
**Commit Message**: fix(i18n): complete Indonesian Podman translations (#870)

**File**: `src/lang/id/podman.json` (modified, +2/-0)
```diff
@@ -16,6 +16,8 @@
   "rootful": "Mode Rootful",
   "userModeNetworking": "Jaringan Mode Pengguna",
   "rosetta": "Rosetta untuk Mac",
+  "rosettaGlobalTip": "Berlaku sebagai preferensi Podman global untuk mesin Apple Silicon (bukan per-VM). Membutuhkan Podman >= 5.1.0.",
+  "rosettaNeedVersion": "Rosetta membutuhkan Podman >= 5.1.0. Perbarui Podman untuk mengaktifkan opsi ini.",
   "identityPath": "Path Kunci SSH",
   "remoteUsername": "Pengguna Jarak Jauh",
   "Dashboard": "Dasbor",
```

---

### Incident Patch 12: `f84aed13` (2026-10-05)
**Commit Message**: 1. Fix Issues

**File**: `AGENTS.md` (modified, +12/-0)
```diff
@@ -223,6 +223,18 @@ Unless the user explicitly authorizes an exception for the specific module, appl
 
 Before implementation, record the exception authorization (if any) and verify this checklist in the plan. Do not infer authorization from an existing module that predates these rules.
 
+## Failure Boundaries and Partial Completion
+
+When adding or changing a multi-step operation, batch processing, candidate filtering, cleanup, or error propagation, read `docs/skills/flyenv-failure-boundaries/SKILL.md` before implementation and use it again during review. This project skill is loaded through this instruction; it does not depend on automatic skill discovery.
+
+- Define success by the user's requested outcome. Classify each changed step as a required dependency, independent item, or supplementary action; record what its failure may stop.
+- A supplementary action such as DNS refresh after a successful hosts write must only report its own failure. It must not reject the completed write, overwrite its result, or trigger a replay of the write.
+- Invalid or unverifiable candidates are skipped individually with a reason. Continue processing valid candidates; do not use one failed PID check to abort the entire batch. Skipping a candidate does not authorize executing it.
+- Required failures still propagate to their dependents. Do not swallow actual file-write failures, failed service termination, or a shared prerequisite failure and report success.
+- Preserve completed side effects and individual outcomes. Report partial completion when required items failed; distinguish skipped, failed, completed, and unknown results.
+- Review every added `throw`, `reject`, early `return`, and batch rejection for its impact on sibling work and already completed work. Keep failure handling at the smallest owner that can decide its consequence; reuse that policy across callers.
+- Do not introduce duplicate execution-layer PID validation, extra queries, retries, or privilege prompts solely to handle an optional failure. Follow the existing ownership and execution contracts.
+
 ## Adding a New Module
 
 ### Step 1: Define Module Type
```

**File**: `configs/esbuild.config.ts` (modified, +18/-4)
```diff
@@ -40,10 +40,24 @@ const dist: BuildOptions = {
   drop: ['debugger', 'console']
 }
 
+// 与 Windows 保持相同的模块动态加载边界，避免新 worker 静态加载全部业务外部包。
+// fork.mjs 仍为固定入口，新 chunk 随 dist/electron/**/* 打包；main/fork 并行构建
+// 必须使用不同 chunk 目录，防止两个独立依赖图生成同名文件并相互覆盖。
+const forkOutput: Pick<
+  BuildOptions,
+  'outdir' | 'entryNames' | 'chunkNames' | 'outExtension' | 'splitting'
+> = {
+  outdir: 'dist/electron',
+  entryNames: '[name]',
+  chunkNames: 'fork-chunks/[name]-[hash]',
+  outExtension: { '.js': '.mjs' },
+  splitting: true
+}
+
 const devFork: BuildOptions = {
+  ...forkOutput,
   platform: 'node',
-  entryPoints: ['src/fork/index.ts'],
-  outfile: 'dist/electron/fork.mjs',
+  entryPoints: { fork: 'src/fork/index.ts' },
   minify: false,
   bundle: true,
   packages: 'external',
@@ -56,9 +70,9 @@ const devFork: BuildOptions = {
 }
 
 const distFork: BuildOptions = {
+  ...forkOutput,
   platform: 'node',
-  entryPoints: ['src/fork/index.ts'],
-  outfile: 'dist/electron/fork.mjs',
+  entryPoints: { fork: 'src/fork/index.ts' },
   minify: true,
   bundle: true,
   packages: 'external',
```

**File**: `configs/esbuild.config.win.ts` (modified, +18/-4)
```diff
@@ -37,10 +37,24 @@ const dist: BuildOptions = {
   drop: ['debugger', 'console']
 }
 
+// 模块动态 import 必须保留为独立 chunk；单文件 bundle 会把模块专属外部依赖
+// 提升成入口静态导入，只停 PHP 的新 worker 也要加载 Image/SQL/FTP 等依赖。
+// 固定 fork.mjs 兼容已有资源路径，独立 chunk 目录避免与并行构建的 main 冲突。
+const forkOutput: Pick<
+  BuildOptions,
+  'outdir' | 'entryNames' | 'chunkNames' | 'outExtension' | 'splitting'
+> = {
+  outdir: 'dist/electron',
+  entryNames: '[name]',
+  chunkNames: 'fork-chunks/[name]-[hash]',
+  outExtension: { '.js': '.mjs' },
+  splitting: true
+}
+
 const devFork: BuildOptions = {
+  ...forkOutput,
   platform: 'node',
-  entryPoints: ['src/fork/index.ts'],
-  outfile: 'dist/electron/fork.mjs',
+  entryPoints: { fork: 'src/fork/index.ts' },
   minify: false,
   bundle: true,
   packages: 'external',
@@ -50,9 +64,9 @@ const devFork: BuildOptions = {
 }
 
 const distFork: BuildOptions = {
+  ...forkOutput,
   platform: 'node',
-  entryPoints: ['src/fork/index.ts'],
-  outfile: 'dist/electron/fork.mjs',
+  entryPoints: { fork: 'src/fork/index.ts' },
   minify: true,
   bundle: true,
   packages: 'external',
```

**File**: `docs/skills/flyenv-failure-boundaries/SKILL.md` (added, +64/-0)
```diff
@@ -0,0 +1,64 @@
+---
+name: flyenv-failure-boundaries
+description: Use when implementing or reviewing FlyEnv multi-step operations, batch actions, PID candidate filtering, cleanup, supplementary actions, or changes to throw/reject and terminal result handling.
+---
+
+# FlyEnv Failure Boundaries
+
+先确定用户要求完成的结果，再决定一个步骤的失败能影响谁。一次附加动作失败不能
+否定已完成的主操作，一个候选不合格不能阻断其他有效候选；必要依赖的失败仍要如实报告。
+
+本项目通过根目录 AGENTS.md 指定读取本技能，实施前和 review 时都适用，不依赖自动发现。
+
+## 实施前的判断
+
+阅读实际调用者、共享执行器及终态处理，不只看发生异常的函数。对本次调整的步骤，在
+现有计划/实现说明中记录：成功条件、是否必要、影响范围、失败处理以及已发生的副作用。
+如果没有独立计划，在修改理由中写清这些判断，不为简单修复新增框架或配置。
+
+| 步骤类别 | 判断依据 | 失败的影响范围 |
+| --- | --- | --- |
+| 必要依赖 | 没完成就无法实现请求结果，或后续步骤缺少可靠输入 | 阻断依赖它的步骤，保留已完成结果 |
+| 独立单项 | 与其他项可以独立判断和执行 | 记录该项失败/跳过，继续其他有效项 |
+| 附加动作 | 主结果已经成立，只改善体验、观测或后续状态 | 记录自己的失败，保持主结果 |
+
+不能只因为步骤位于主流程的中间/最后，就判定它必要或可忽略。DNS 刷新是 hosts
+写入后的附加动作；hosts 写入本身是必要操作。停止是否成功、是否删除 PID 文件，遵守
+对应生命周期约定；不能用“清理”这个名称把失败全部吞掉。
+
+## 实现规则
+
+- **候选逐项过滤**：缺字段、身份不符、PID 已退出等只影响该候选；记 PID/跳过原因，
+  继续其他有效候选。共同前置条件失败（例如没有可靠进程列表）才影响所有依赖它的项。
+  无候选应区分“本来没有目标”和“全部无法确认”，不能把后者宣称为全部停止成功。
+- **校验放在归属所有者**：复用已经获取的进程表和既有身份判断。执行器按契约执行已
+  选目标，不另建重复校验、查询或排序，不重新扩大目标范围。过滤不等于允许操作未确认项。
+- **附加动作隔离错误**：使用窄范围 catch，在共同执行器/所有者处统一记录并返回明确
+  状态；不要每个模块复制处理。后台错误也要有接收者，不产生未处理 rejection。
+  日志失败不能反过来阻断主操作，也不要求为日志等待磁盘写入。
+- **终态保留事实**：主结果已完成时，附加动作失败不能进入主失败回调、覆盖主结果或触发
+  重放。必要项有失败时报告部分完成/失败；未知结果保持未知，不擅自重试。
+- **批量等待与单项结果分开**：独立并行项不因第一项拒绝而提前结束整个批次的结果收集。
+  使用已有的逐项错误处理或合适的聚合方式，记录每项终态；这不授权把启动组串行改为并行。
+- **不追加补救链路**：附加动作失败不自动安装帮助程序、弹 UAC、查询所有进程或重试主
+  操作。必要操作的授权/补救仍遵守原契约，不借本技能改变业务要求。
+
+## 提交前 review
+
+逐个检查本次新增/调整的 throw、reject、提前 return、循环内异常、批量聚合及成功/失败回调：
+
+1. 它改变的是哪一个结果：单项、主操作、整批，还是退出流程？调用者是否会扩大这个影响？
+2. 是否已经完成写入/kill 等副作用？后续失败会不会把它显示为没执行，或者导致重复执行？
+3. 一个坏候选与一个有效候选并存时，有效候选是否仍能执行？必要项失败是否仍会如实报告？
+4. 失败只是记录，还是偷偷引入了等待、查询、重试或提权？日志自身失败是否也被隔离？
+5. 是否复用了共同策略？UI、退出、MCP、模块、Helper 的调用结果是否与各自原契约一致？
+
+以下情形用于检查设计及代码路径；是否新增/运行测试遵守用户要求和会话测试约束：
+
+- hosts 写入成功、DNS 启动失败：文件结果保持成功，有刷新失败日志，无写入重放。
+- hosts 写入失败：请求仍失败，不继续发起以成功写入为前提的动作。
+- 三个候选中一个不合格：只跳过该项，两个有效项继续；日志说明每项选择/跳过原因。
+- 批量中一个必要停止失败：其他独立服务继续，汇总保留失败项，不假报全部停止成功。
+- 主操作完成、通知或诊断记录失败：不改变主终态，不引入未处理异步异常。
+
+本技能约束失败传播和结果语义；它不能替代实际 review 或证明实现无缺陷。
```

**File**: `docs/task/application-quit-parallel-cleanup.md` (added, +92/-0)
```diff
@@ -0,0 +1,92 @@
+# FlyEnv 退出清理并行调整
+
+## 目标与原因
+
+用户要求检查完整退出链路，将能够独立执行的操作并行。原 Application.doStop 在完成
+服务停止和 fork 回收后才清理 hosts。2026-10-04 18:59 的实机日志中，服务停止耗时
+6588ms，hosts 清理耗时 4265ms，两段串行使总退出耗时达到 10870ms。
+
+本次沿用 flyenv-module-boundaries、flyenv-failure-boundaries 的所有权及失败边界，
+直接调整现有 Application 的执行顺序，不新增退出控制器、队列、IPC 或配置。
+
+## 实施计划与操作契约
+
+- 所有者：Application 持有退出防重 stopPromise，并负责本轮清理任务的启动、等待和
+  收尾；ServiceProcessManager 管理服务登记，ForkManager 管理请求和 worker。
+- 生命周期：菜单退出、正常 app.quit、relaunch 共用 Application.stop/doStop。
+- 起点：同步关闭服务和原始 fork 请求入口，权限协调器禁止新选择但保留已选授权。
+- 必要前置：等待已受理生命周期请求及其终态消费者，再等待原始 fork 请求结算。
+  消费者可能继续派发配置/hosts 等请求，不能把这两个屏障直接改成一次 Promise.all。
+- 中间事件：保留各 quit 阶段日志；增加 quit.parallel-cleanup.begin/completed，
+  覆盖 HTTP、MCP、服务停止和 hosts 清理这一组任务的实际重叠区间。
+- 并行范围：两个屏障完成后，在同一轮中发起四个独立任务。同步清理函数仍直接调用，
+  没有 Promise 或外部等待可重叠，不将它们包装成虚假的异步任务。
+  HTTP/MCP 放在 drain 后，避免提前关闭已受理业务发送终态所需的通信连接。
+- 终态：等待所有并行任务 settle，再回收 fork，释放权限协调器，销毁托盘。
+  阶段 completed 表示等待已结束，不保证每项业务成功；失败保留单项 failed 日志。
+- 重复调用：沿用 stopPromise，同一退出过程只执行一轮；不改变服务自身批量防重。
+- 失败范围：每项按原 catch 记录错误；Promise.allSettled 防止某个任务或其日志函数
+  异常导致提前回收其他任务所需资源。hosts 的取消/未知写入结果不自动重放。
+- 服务交互：服务内部继续共用首表并行停止，退出 kill 不增加结果查询；数据库确认
+  策略不变。启动组的串行启动/停止和 UI/MCP 单独服务操作不受此调整影响。
+- 生命周期检查：复核迟到启动登记、关门前 hosts 写入、单项拒绝、UAC 取消、退出防重、
+  fork/权限资源释放顺序；本次只做静态检查，不新增/运行测试或真实服务操作。
+
+## 全部退出操作与依赖
+
+| 操作 | 当前处理 | 依赖或说明 |
+| --- | --- | --- |
+| 窗口退出标记 | 同步 | 防止窗口关闭流程重入；保留窗口供既有授权收尾使用 |
+| Windows 权限 beginShutdown | 同步 | 取消未完成首次选择，已选方式仍可处理必要清理 |
+| 服务与 fork 接口关门 | 同步 | 禁止退出过程中提交新的普通服务/hosts 操作 |
+| service-drain | 等待 | 必须先完成迟到的 PID 登记及完整终态消费者 |
+| fork-drain | 在 service-drain 后等待 | 等消费者可能继续派发的原始请求，防止 hosts 清理后又被旧请求写回 |
+| 快捷键注销 | 同步 | 不含异步等待，逐项 catch 保留 |
+| 屏幕监听销毁 | 同步 | 清理事件监听及 debounce timer |
+| SiteSucker 销毁 | 同步 | 停止既有下载/抓取任务、窗口及状态，不提前加载未使用模块 |
+| OAuth 取消 | 同步 | 标记取消并关闭回调 HTTP 服务 |
+| PTY 清理 | 同步 | 对已加载 PTY runtime 清理终端，不等待新增外部进程 |
+| Capturer 清理 | 同步 | 停止捕获状态与窗口通知 |
+| 静态 HTTP stopAll | 并行组 | 与服务和 hosts 无相互依赖；原接口只是发起 server.close，未新增关闭确认 |
+| MCP stopLoaded | 并行组 | 关闭已加载服务器与连接；服务/fork 门禁已关闭，不再接纳新业务 |
+| ServiceProcessManager.stop | 并行组 | 使用最终服务登记和批次首表，内部各实例已经并行 |
+| ServerManager.cleanHosts | 并行组 | drain 后无旧站点请求继续写入；由 main 直接操作系统文件，不依赖服务退出或 fork 回收 |
+| hosts 读取、写入、DNS 启动 | 保留顺序 | 必须先读取和写入成功，才尝试 DNS 刷新；无变更不写入、不申请 UAC |
+| DNS 刷新 | 仅等待 spawn | 附加动作，不等待退出码，失败不覆盖 hosts 已写入结果 |
+| fork destroy | 并行组全部结算后 | 服务仍需 worker；同时保留 EnvSync provider 到 hosts 收尾结束 |
+| 权限协调器 dispose | 并行组及 fork 回收之后 | hosts 或服务仍可能需要租约；不能因 hosts 提前完成就撤销其他清理的权限 |
+| 托盘销毁 | 最终同步收尾 | 不含可缩短等待的异步任务 |
+
+## 调整后的链路
+
+1. 设置退出标记，关闭权限首次选择、服务请求和 fork 请求入口。
+2. service-drain → fork-drain，等待关门前请求及其消费者结算。
+3. 按原逻辑执行快捷键、屏幕、SiteSucker、OAuth、PTY、Capturer 的同步清理。
+4. 同时启动 HTTP 关闭、MCP 关闭、服务批量停止、hosts 清理，等待四项全部 settle。
+5. 回收 fork（包含版本缓存落盘、EnvSync provider 释放和 worker 销毁）。
+6. 最后释放权限协调器、销毁托盘，记录 quit.returned；Launcher 继续实际退出。
+
+## 修改文件
+
+- src/main/Application.ts：将原四个串行 await 放入同一组 Promise.allSettled；保留
+  逐项 catch、计时、hosts 诊断/交互上下文；把 fork 回收和权限 dispose 放在组后。
+- src/main/core/ServerManager.ts：修正 stopServer/cleanHosts 的调用顺序注释。
+- src/main/core/WindowsPrivilegeCoordinator.ts：修正退出阶段资源保留期限的注释。
+- 相关历史说明补充当前链路引用，避免旧的串行顺序被误认为当前行为。
+
+## 耗时预期与边界
+
+服务和 hosts 不再相加，退出耗时主要取决于并行组中耗时最长的任务。按上一份日志，
+可重叠约 4 秒，但并发启动 PowerShell、worker 和 UAC 会影响实际用时，不能把历史
+串行时间当成新流程实测值。UAC 确认仍需要用户完成；等待旧请求、数据库确认以及
+资源回收仍受各自原有约定约束。
+
+## 静态复查与验证记录
+
+已核对 UI/MCP 请求的关门行为、生命周期消费者的后续派发、原始 fork 请求跟踪、
+Host.writeHosts 的写入终态、main 的文件执行入口、数据库确认以及权限租约释放。
+两层 drain 继续由原有超时机制收口未知请求；未知副作用不宣称已撤销，也不重放。
+
+三个修改的 TypeScript 文件语法解析无诊断，相关 diff 空白检查通过。没有新增/运行
+测试、构建、完整类型检查、格式工具或真实系统操作。并行后实际耗时与 UAC 显示时机
+需通过下一份实机日志确认；静态检查不能证明新流程已经实机通过。
```

**File**: `docs/task/performance-diagnostics-build-switch.md` (added, +137/-0)
```diff
@@ -0,0 +1,137 @@
+# 性能诊断统一常量开关
+
+## 实施约定
+
+本次仅统一性能观察开关，沿用现有业务归属：main 管理 worker 和缓存，fork 模块执行
+服务/hosts/环境变量操作，renderer 保持现有操作控制器。观察器不拥有业务状态，
+不开新 IPC，不保存用户设置，不增加模块或 Pinia 状态，不需要模块约束例外。
+
+关闭诊断后，开始、进度、成功、失败、重入规则、进程清理和后台通知均按原链路执行。
+真实失败继续由原业务错误路径返回；诊断失败不改变业务结果。并发请求原有隔离保持。
+
+## 实施范围与验收边界
+
+统一覆盖操作计时、服务停止阶段、跨 main/fork 边界、worker 启动、PATH 阶段及广播、
+Windows 授权执行阶段和项目环境计时。帮助程序安装/认证故障及真实操作错误保留。
+产品功能本身的耗时结果（例如请求计时工具）不属于调试日志，不受开关影响。
+
+本轮按会话约束不新增或运行测试、构建；进行源代码和引用静态检查。
+后续验收应分别检查常量 false 时无性能日志、true 时有日志、计时脚本开启时有报告，
+并确认关闭日志不影响失败回包、并行停止、hosts/PATH 写入和后台通知。
+
+## 唯一开关与打包方式
+
+运行时代码只调用 `src/shared/PerformanceDiagnostics.ts` 的日志/计时方法。
+`PERFORMANCE_DIAGNOSTICS_ENABLED` 仅在该文件内部使用，不导出给业务文件。该文件
+没有静态依赖，不加载 shared/utils、Electron 或模块树，可用于轻量 worker 与 renderer。
+
+直接修改这一行即可，目前为 true，以便继续诊断：
+
+```typescript
+const PERFORMANCE_DIAGNOSTICS_ENABLED: boolean = true
+```
+
+- true：开启性能计时和阶段调试日志。
+- false：关闭性能计时和阶段调试日志。
+
+开发、打包、插件与源码计时脚本统一调用同一套方法，方法内部读取这个常量。开关不读取环境变量，
+不按 NODE_ENV、运行平台、开发/发布或压缩模式切换，也没有缺配置回退分支。
+Windows 和 macOS/Linux 使用相同的常量。
+
+需要不含性能日志的正式包时，把常量改为 false，再执行 `yarn build:win` 等既有
+打包命令即可。需要诊断包或运行计时脚本时改为 true。已生成的产物使用打包时的
+常量值，修改源码后应重新构建；不增加运行时设置项或 IPC。
+
+此前为环境变量增加的 configs/performance-diagnostics.ts 已删除；esbuild、Vite 和
+插件构建里的开关注入同步移除。普通 TypeScript 常量导入已经足够，不保留另一份
+构建开关或读取逻辑，也不会因为直接运行源码而报环境变量未配置。
+
+## 调整位置及原因
+
+- **OperationTiming**：关闭时直接调用原业务函数，不创建计时范围，不分发观察事件。
+  同步返回值和异步错误照常传播；存在观察器并不意味着可绕过发布开关。
+- **ServiceStopDiagnostics、WindowsPathDiagnostics**：仅保留 Node 请求范围与元信息，调用统一 logger。
+  服务停止的真实首表仍由 ServiceStopContext/参数承载，与诊断 ALS 分开；关闭诊断
+  不改变 PID 选取、父子排序、并行停止、退出确认或 PATH 更新结果。
+- **ForkItem、fork/index、fork/runtime**：停止耗时范围、初始化诊断元信息和下一轮探针
+  受开关控制。轻量引导仍按原方式导入 runtime；导入失败继续记录错误并非零退出。
+- **ForkManager、ServiceProcess**：缓存指标、批量快照和正常停止阶段日志关闭；快照
+  获取失败、单实例停止失败、退出未完成等错误继续保留。缓存的 TTL、失效、合并查询
+  和实例登记均不受开关控制。
+- **WindowsActionStage、WindowsActionPipe、WindowsElevation、WindowsRunAs**：关闭时生成
+  同名空阶段函数，不创建 PowerShell 阶段时钟/数组；C# 启动阶段函数不输出日志，
+  Node 不分派阶段事件。认证终态不再附加 actionStages 和计时字段。即使调用者主动
+  传 reportTiming=true，也不能绕过统一常量。
+- **WindowsHelperFallback、WindowsPrivilegeOperation**：关闭 PowerShell 停止事件收集、
+  成功执行和身份快照调试日志。实际路径验证、权限分类、进程身份及原生句柄处理
+  保持原逻辑。关闭时不访问未创建的事件列表。
+- **WindowsEnvironmentBroadcast、WindowsDnsRefresh**：正常后台阶段关闭，故障信息
+  保留。通知照常调度和启动，DNS 照常尽力刷新；日志开关不引入等待或影响主结果。
+- **EnvSyncLocal、Tool.win/init、LanguageProjects/Project、ServiceManager/EXT/store**：
+  原来分散的控制台计时、项目环境步骤日志和 renderer PATH 调试 IPC 同样受控。
+  原业务错误仍返回界面；项目状态、shell 安装和环境同步仍由原所有者负责。
+- **现有 VM 回归脚本**：补充新增轻量依赖的映射，避免源文件新增 import 后替身
+  加载器报 Unexpected dependency。本轮未执行这些脚本。
+
+## 保留内容与检查到的边界
+
+不修改通用 appDebugLog；它仍承担帮助程序安装、修复、签名、认证和真实故障诊断。
+Go Helper 的已有身份/执行诊断也保留，本轮没有修改 Go 或帮助程序版本。
+产品请求计时工具的测量结果不是调试日志，不受影响。
+
+关闭 PowerShell 阶段采集时，必须同时关闭 actionStages.ToArray 回传，否则空函数
+没有初始化列表，会把已完成业务错误地变为回包失败；本次已同时处理。nonce、digest、
+READY/LAUNCH、启动错误信息和经过身份认证的业务回包保持完整，不把诊断开关当作
+授权判断。真实错误继续传播，不因关闭日志而变成成功或触发重试。
+
+缓存到期、业务超时、租约、未知执行状态、PID 创建时间和退出确认中的时间是业务
+判断依据，保留这些时间计算；关闭日志不能改变业务安全边界。部分调用点仍构造轻量
+阶段参数，公共日志入口会立即返回，不序列化、不落盘；不是把所有 Date.now 全局禁用。
+
+静态检查记录：此前涉及的 28 个 TypeScript 文件解析未发现语法问题；本次改为常量后
+再次检查修改文件语法及引用，并确认已移除环境变量读取和构建注入；`git diff --check`
+无空白错误，仅出现工作区已有 CRLF 提示。该检查不替代构建或 Windows 实机验收。
+
+新增性能打点调用 PerformanceDiagnostics.ts 的统一方法，不导入开关，不自行 JSON.stringify、
+直接落盘或 console.time。已有 Node 请求可以沿用 OperationTiming/对应上下文适配入口。
+真实故障日志继续走原错误通道，或显式 fault=true 调用统一 logger，不因关闭性能日志丢失。
+
+## 本轮收敛实现与操作约定
+
+日志格式、序列化、写入容错、计时器、同步/异步计时包装、脚本诊断生成统一放在
+PerformanceDiagnostics.ts。常量仅此文件内部使用，业务文件调用方法。
+ServiceStopDiagnostics、WindowsPathDiagnostics、OperationTiming 仅保留 Node 异步上下文、
+请求关联和协议适配，公共文件不能静态依赖 Node、Electron 或 utils，避免 renderer
+不可加载或轻量 worker 为第一条日志加载整个业务依赖树。
+
+日志传输仍由既有 appDebugLog、renderer debug.log 或 worker 的内置 appendFile 承担，
+通过回调交给统一方法，不建立全局注册器/写入队列/新 IPC。主业务开始、进度、终态、
+重复调用、服务交互及生命周期仍由既有模块管理；诊断回调异常只丢失日志，业务错误
+原样传播。关闭常量后不创建计时范围、不调用性能日志 sink，真实错误可显式保留。
+本轮只做静态检查，不新增/运行测试、构建。
+
+### 统一 API 的职责
+
+- writePerformanceLog：唯一序列化和写入方法；检查开关、延迟采集数据、固定 UTC、
+  捕获同步/异步日志错误。关闭时不调用 writer；故障日志可以显式 fault=true 保留。
+- bindPerformanceLogger：绑定请求元信息和起点，返回阶段 logger。请求元信息优先于
+  普通阶段数据，防止阶段数据改掉关联 ID；所有实际写入委托 writePerformanceLog。
+- beginPerformanceStage、timePerformanceSync、timePerformanceOperation、measurePerformanceStep：
+  统一阶段时钟、幂等 finish、同步/异步异常传播、观察器隔离及独立步骤计时。
+- performanceDiagnosticNow/Elapsed：分派、查询等既有边界需要跨回调持有起点时使用，
+  不让业务文件再实现时钟/耗时差值的开关判断。
+- buildPerformanceStagePrelude、buildPerformanceProcessStopPrelude、buildPerformanceScriptTiming、
+  native 诊断生成方法：固定 PowerShell/C# 阶段采集的统一生成入口。两个停止脚本共用
+  一份事件收集方法；关闭时不创建/访问列表，也不生成未使用的 native timer 声明。
+
+OperationTiming 只管理 AsyncLocalStorage 观察器与固定 stderr 协议转换；
+ServiceStopDiagnostics 只提供 stopId/首表来源/模块等上下文；WindowsPathDiagnostics
+只提供 PATH 请求关联。三者已经移除自己的时钟、JSON 序列化、日志写入容错与开关。
+保留这些适配层，是因为 Node ALS 不能静态放到 renderer/轻量引导共用的公共文件。
+
+worker 引导仍使用内置 appendFile 回调，不导入 utils；renderer 仍使用既有 debug.log
+回调。回调只运送已经序列化的文本，不再实现各自的性能日志格式或判断开关。
+
+本轮额外检查：开关引用仅位于统一文件；公共诊断文件无静态 import；固定脚本标记
+生成也集中于此。27 个相关 TypeScript 文件语法解析、公共导出引用检查无发现，
+git diff --check 无空白错误。未执行测试/构建，Windows 实机与完整类型检查未覆
```

**File**: `docs/task/service-lifecycle-concurrency.md` (added, +91/-0)
```diff
@@ -0,0 +1,91 @@
+# 服务多版本启动与并行停止
+
+## 修复范围与操作契约
+
+用户要求 PHP-FPM 允许不同版本在启动中继续启动其他版本；退出停止需要与 UI 一键停止一样并行。源码定位到三个阻挡：服务列表/InstalledItem 的模块级忙碌判断、main 的模块级请求队列、退出逐项 await。renderer `Module.startSingleFlight` 已按 `isOnlyRunOne` 区分多版本，`Module.stop` 已并行提交，需修正外围链路而非增加第二套生命周期。
+
+- 所有者：renderer 仍由既有 Module/InstalledItem 管理状态和 IPC；main 管理实例队列、登记代次和批量编排；fork 模块仍管理归属、父树停止、原生数据库关闭和 companion。
+- 生命周期：每次请求从受理、参数/目标解析、排队到终态登记消费均进入退出 drain；关闭入口后拒绝新外部请求。每个实例自己的启动/停止互斥，不同 PHP 版本独立运行。
+- 事件：进度不释放 flight；真正终态才更新 PID/状态和队列。批量停止等待所有实例结算，一项失败不取消其他实例。
+- 交互：UI/退出保留原授权意图。普通权限停止可并行；需要提升时仍由原 FIFO 权限租约协调授权/维护操作。
+- 重入：同版本 renderer flight 保留；main 同实例按队列排序，模块范围操作作为屏障等待该模块已有实例任务，并阻止后来实例任务越过。
+- 批量停止：退出、MCP stop_all、插件停用复用登记快照的并行编排；UI 每版本 stopService 沿用同一 fork 停止契约和 main 实例排队规则。companion 仍登记和收尾，不把展示状态作为完整停止清单。
+- 模块约束：PHP 的多版本队列策略放在 PHP 模块目录；通用队列只提供策略注册和实例/模块屏障机制。不添加新 Pinia、共享持久字段、新 IPC 或独立 start/stop 控制器，无需例外授权。
+- 验收场景：PHP A 启动中启动 B；同版本重复启动；A 启动中停止 A；独占服务版本切换；同模块两个版本退出/一键停止并行；数据库与面板重复清理；某实例失败其他继续；drain 超时后迟到回包不登记。本轮仅源码复核，不新增或运行测试、构建或真实服务操作。
+
+## 实施安排
+
+1. 通用服务列表及 InstalledItem 的模块忙碌限制仅对独占模块生效，多版本模块只防本实例重入。
+2. main 生命周期队列支持模块所有的实例键解析器；PHP UI/MCP 使用同一版本对象求键，目标解析仍受生命周期许可和预算保护。
+3. 单实例 stop 按安装实例排队，独占 start 和模块级操作保持屏障。不同实例 stop 并行，同实例与启动按序。
+4. 登记批量停止提取为公共并行编排，保留派发代次快照、错误隔离和真正终态消费，退出/MCP/插件共用。
+5. 补充详细代码注释、最新链路与限制，完成源码语法和差异检查。
+
+## 实际修改与原因
+
+### 1. 服务列表只限制本行重入
+
+`src/render/components/ServiceManager/setup.ts` 原先只要模块内任意版本 `running`，就直接从 `serviceDo` 返回。PHP 列表按钮只显示本行状态，因此另一个版本的按钮看起来可点，实际请求没有发出。
+
+现在 `versionRunning` 仅对 `isOnlyRunOne` 的独占模块汇总忙碌状态；入口另外检查本行 `item.running`。`src/render/core/Module/ModuleInstalledItem.ts` 的通用入口同步使用相同规则，避免绕开服务列表的调用仍被整个模块阻挡。PHP/PHP-FPM 已声明 `isOnlyRunOne: false`，`Module.startSingleFlight` 已允许多版本，不需要新增 PHP 专用 UI 启动流程。
+
+同实例的 start/stop Promise 仍由已有 WeakMap 管理：重复启动共用原请求，停止本实例时等待其启动终态；独占模块仍保留版本切换前先停止原版本的流程。
+
+### 2. main 从模块串行改为实例队列与模块屏障
+
+`src/main/core/ServiceProcess.ts` 的 `runLifecycle` 原先所有相同模块请求串行，renderer 并行提交也无法改变实际执行顺序。现在每个模块保存已受理请求的范围 Promise 和完成 Promise。
+
+- 同实例请求等待此前同键的请求完成。
+- 不同实例请求可以并行，但会等待此前目标范围解析完成，以判断是否冲突。
+- 无法确定实例的请求使用空范围，作为模块屏障：等待此前全部请求；后来请求也等待该屏障完成。
+- 默认 start 保留模块屏障，避免独占服务两个版本同时切换。模块可注册自己的多版本策略。
+- 普通 stop 的安装对象按 bin 排队；PID 签名按 PID 排队；没有确定身份时继续使用模块屏障。
+
+`src/fork/module/Php/lifecycle.ts` 是 PHP 自己的纯并发策略：相同安装 bin 使用同一键，不同安装 bin 独立。Windows 规范化路径并忽略大小写，macOS/Linux 保留大小写；路径本身不经 shell，不受空格或中文影响。启动前没有 PID，因此不能用 PID 把一个版本的 start 与 stop 关联。缺少 bin 时返回 undefined：启动保留模块屏障，停止沿用通用 PID/未知目标规则。
+
+策略在 `ServiceProcess.ts` 的集成处注册；队列类不按 PHP 版本号分支，也不向通用服务对象增加 PHP 专用字段。PHP 的端口、配置目录和进程归属规则仍由原 fork 模块负责；本次并行许可不会消除这些已有资源约束。
+
+队列在**受理时**冻结前驱，而非选版本完成后才入队。例如先受理一个查询较慢的 MCP start，随后受理 stop_all：stop_all 必须等该 start，较早 start 不能反过来等待后来 stop_all。否则会遗漏退出等待或构成环形等待。目标解析、排队、fork 请求和 PID 登记消费全部位于原六分钟操作预算中；取消/超时同时结算范围与完成 Promise，不让后续请求永久卡住。
+
+### 3. UI 与 MCP 使用相同实例身份
+
+`src/main/core/IPCHandler.ts` 向 `runLifecycle` 传入请求中的实例对象。停止的 generation/参数快照仍在真正派发时取得：同实例 start 刚完成后，stop 能使用刚登记的 PID，而不是入队前的旧值。
+
+`src/main/core/MCPTools.ts` 在受理许可内解析已装版本，将结果交给相同队列并复用一次选中的对象。start/stop/restart 不各自重复选版本；MCP restart 持有同一范围直到停止和启动两步完成。目标解析失败也属于可 drain 的终态，不留下排队节点。
+
+### 4. 批量停止共用并行编排
+
+`ServiceProcess.stopRegisteredInstances` 为退出、MCP stop_all 和插件停用提供相同实现：
+
+1. 同步冻结完整运行登记，包括被展示状态隐藏的 companion，以及每个实例启动时记录的 stopArgs、rootGeneration 和同模块登记代次。
+2. 使用 `Promise.all(instances.map(...))` 启动各项停止；每项内部的 await 不会阻挡其他项。每个实例都调用原 `forkManager.send(module, 'stopService', ...args)`。
+3. fork 进度不能视为成功；真正终态必须 `code === 0`，再按冻结的 generation 注销。迟到响应不能删除后来启动的实例。
+4. 每项内部捕获失败并保留登记，其他项继续；等待全部结果后再返回逐项 stopped/skipped/failed。标签从运行登记读取，不假设所有 stopArgs 都以版本对象开头。
+
+UI 的 `Module.stop()` 已使用 `Promise.all`，仍沿用 InstalledItem.stop 与原 fork 方法；主进程现在允许不同实例 stop 并行。退出不能调用 renderer 的 Module.stop，因为关闭窗口后 renderer 不再可靠，且 renderer 展示列表不包含完整 companion 登记。因此共用 main/fork 停止契约与并行规则，由 main 从自己的运行登记发请求。
+
+`src/main/Application.ts` 插件停用在模块屏障内调用公共批量方法，全部结算后才检查失败或剩余登记，不能提前卸载正在停止的模块代码。MCP stop_all 同样在模块屏障内直接调用公共方法，不把每一项再排进自己的屏障后面而形成自等待。
+
+### 5. 退出的完整顺序
+
+Application 关闭新请求入口 → drain 已受理生命周期及 fork 请求 → ServiceProcess 取得最终运行登记 → 在 shutdown 许可内并行停止全部实例 → 等待全部终态并记录失败 → 回收 fork → 执行 hosts 清理及其余退出收尾。
+
+顺序约束发生在这些阶段之间，不再逐服务串行停止。多个退出触发仍共享一次 stopPromise。`ServiceLifecycle.ts` 只更新对应注释，原许可、退出 drain 超时和迟到请求保护继续有效。
+
+## 源码复核的边界
+
+- 同版本 A 连续请求按序完成；A 与 B 的安装键不同，可同时派发。
+- A start、模块 stop_all、B start 的受理顺序中，stop_all 等 A，B 等 stop_all；不能绕过批量停止。
+- 异步选版本失败或排队超时会释放节点；较晚请求仍等待其余存活前驱，不能因中间节点取消就越过更早的同实例任务。
+- 退出先 drain 后取登记，避免刚启动成功的版本遗漏清理。超时的旧消费者仍不能登记或注销新实例。
+- MongoDB/PostgreSQL 等仍通过原模块的数据库原生关闭、公共父树停止/退出确认收尾；不同实例可以并行，每个实例内部必要顺序保留。
+- companion 仍由所属 fork 模块管理；现有模块内部 stop flight 只在其所属 worker 内复用。本次未增加跨 worker 的 companion flight，也未把 companion 排除出退出清单。
+- 普通权限停止不占全局提升租约，可以并行；确实需要 Helper/UAC 的提升操作仍遵守原 FIFO 租约。因此并行提交不承诺授权弹窗也同时出现，或真实停止耗时固定为某个值。
+- 本次只修改 TypeScript/文档，未修改 Go Helper 执行逻辑，不需要提升 Helper 版本。停止 PID 选择、父树归属、CIM 首次快照和退出确认规则保持原实现。
+- 既有耗时脚本仍按两个 PHP 版本串行调用，适合测单实例阶段开销；其 serial-batch 结果不能当作本次退出并行耗时。
+
+## 检查范围
+
+本轮进行 TypeScript 源码语法解析、导入使用检查、差异空白检查及上述控制流复核；没有执行测试、构建、完整类型检查或真实服务启动/退出操作。PHP-FPM 实际双版本启动、Windows/macOS 退出
```

**File**: `docs/task/service-stop-candidate-filtering.md` (added, +72/-0)
```diff
@@ -0,0 +1,72 @@
+# 服务停止：无效候选逐项过滤
+
+## 本次要求与操作契约
+
+用户明确要求：PHP 的一个候选 PID 不可验证时只能过滤该项，不能抛错中断整个停止；其他停止入口中的同类逻辑也需要处理。本规则取代此前文档中“发现阶段明确登记的活 PID 不可读即整体失败”的策略。
+
+- 所有者：fork 模块/Runtime 保留实例归属、数据库原生关闭和伴随服务顺序；公共快照工具统一判断根证据与父子关系；公共停止器负责执行、退出确认和文件清理。
+- 生命周期：快照和候选集合只在当前停止调用内使用，不增加全局状态、存储、IPC 或 renderer 控制器。
+- 事件：沿用既有日志、进度和终态。发现时过滤一条候选，继续其余有效目标；过滤不表示该 PID 已退出，也不表示已执行 kill。
+- 重入与交互：保留原有启动/停止单飞、退出串行停止及伴随服务顺序。启动流程中未知活进程不能当作已退出而覆盖旧实例记录。
+- 错误边界：严格列表查询失败、授权取消、执行身份变化、执行失败、已选目标退出超时及 PID 文件读删错误仍传播。
+- 验收口径：本次仅源码检查，未新增/执行测试、构建或真实服务停止。已有耗时脚本可以复测正常路径；异常候选与有效候选混合的实机场景尚待验证。
+- 模块约束：没有新模块、新 Pinia 状态、共享配置字段或第二套生命周期，无需模块约束例外。
+
+## 原问题
+
+PHP 从版本对象、共享 app PID 文件和版本私有 PID 文件收集候选。共享文件可能指向另一 PHP 版本，也可能保存过期 PID。原先遍历候选时，只要发现一个活 PID 没有 COMMAND/EXECUTABLE 就 throw；后面通过专用 ini 和实际安装路径确认的有效 spawner 树也不会执行停止。
+
+Base 和部分模块存在相同的提前 throw：登记号归属不匹配、父已缺席但还有历史 PPID 后代、候选命令不可读。候选只是发现线索，这些条件应排除该项，不应否定其他已确认的目标。
+
+## 当前完整处理顺序
+
+1. 严格读取首次完整进程列表。读取失败仍终止操作，不能伪造空表。
+2. 以运行登记/私有文件、服务名和实例配置寻找候选，不恢复按相同 EXE 全系统扫描的策略。
+3. 对每个根检查证据与实例归属。不满足时返回空集合或跳过；其他候选继续。
+4. 父确认后，从原完整列表收集父及全部后代。正常 worker 不需要各自的命令、EXE 或启动证明；“子创建早于父”的历史 PPID 假关系继续排除。
+5. 合并、去重已确认目标，进入公共停止器。Windows 压缩树根，复用首次身份，经普通权限/已选 Helper 或 UAC 执行；执行端仍复核身份。数据库保留自己的有序关闭策略。
+6. 公共等待查询停止后的列表，确认本次全部原目标退出。正常树停止仍只需两次全量查询；有残留才继续有界轮询。
+7. 用返回的同一列表检查版本残留和清理 PID 文件。无有效目标时沿用首次列表；仍存活的被过滤候选文件保留，不因空目标无条件删除。
+
+公共规则在 `src/shared/ProcessSnapshot.ts` 的 `isReadableServiceStopRoot`：默认要求根命令可读；Windows 还要求实际映像路径和可用 CIM UTC 创建时间。Unix 不要求完整二进制路径，继续兼容 macOS 的进程标题。持有启动证明或直接依据实际映像的调用可关闭命令要求，但仍须完成自身归属判断。该方法只检查证据齐备，不以 EXE 单独授权。
+
+## 修改位置和原因
+
+| 文件/入口 | 处理 |
+| --- | --- |
+| `src/shared/ProcessSnapshot.ts` | 增加公共根证据筛选；父子关系函数只要求实际消费的字段，供模块快照复用。无系统查询。 |
+| `src/shared/Process.ts` | 三个根归属工具统一返回空集合过滤不可读根；确认父后完整后代直接纳入。严格执行器的错误处理保持。 |
+| `src/fork/module/Base/index.ts` | Windows/Unix 删除候选提前 throw；常规模块均受益，保留模块额外配置约束。 |
+| `src/fork/module/Php.win/index.ts` | 删除用户指出的整个预检循环；spawner/独立根按专用 ini、安装路径及根证据逐项筛选，再合并完整树。清理保留共享文件中的其他活版本。 |
+| `src/fork/module/Php/index.ts` | 删除空命令、登记不匹配和部分后代无法独立验证的提前阻断；独立根仍需本模块证据。 |
+| `src/fork/module/Mysql/index.ts` | Unix defaults-file 和分组停止移除登记预检；分组实际根只来自完整配置匹配及可读身份，不强行追加登记 PID。 |
+| `src/fork/module/Mariadb/index.ts` | Unix defaults-file 候选逐项筛选；Windows 复用 Base 公共规则。 |
+| `src/fork/module/ClickHouse/index.ts` | 服务/watchdog 和 CH-UI 无效候选过滤；活未知候选不标 stale。Windows/Unix 都以最终列表按值清理文件。 |
+| `src/fork/module/Temporal/index.ts` | UI 停止过滤坏候选，共用最终列表清理；启动去重的未知活实例检查保留。 |
+| `src/fork/module/Neo4j/index.ts`、`startup.ts` | 根不可读时过滤，其他 home/config 明确的 Java 根继续恢复；不凭缺席启动父的历史 PPID 扩选未知兄弟树。祖先恢复复用创建时间关系，已确认祖先取完整树；Unix 清理也保留活的被过滤候选。 |
+| `src/fork/module/DbGate/index.ts` | 候选筛选返回空集合；删除重复 PPID 遍历，复用公共树；过滤的活候选保留 PID/端口。打开流程显式阻止覆盖未知活实例。 |
+| `src/fork/module/Redis/RedisCommander.ts` | 同 DbGate 的候选、树与清理规则；保留打开过程单飞/取消及真正执行错误。 |
+| `src/fork/module/Postgresql/index.ts` | pgAdmin 两个恢复分支过滤不可读/不匹配根，确认父后纳入全部后代，不强行追加文件 PID。Windows PostgreSQL 过滤无证据根；postmaster.pid 未指向已确认根时跳过本次数据库原生关闭。 |
+| `src/fork/module/CloudflareTunnel/CloudflareTunnel.ts` | 唯一根不可读、归属不匹配或仅剩无法证明的历史后代时返回空停止结果，保留文件和本地 PID，不阻断外层其他服务。 |
+| `src/shared/ServiceProcessIdentity.ts` | 项目/自定义服务的启动证明缺失或不匹配转为可区分的候选错误，公共停止入口只捕获这类错误并返回空集合；真实系统身份查询错误不被吞掉。 |
+
+N8N、Redis 等已经通过公共归属工具/Base 发现目标，本次不复制筛选实现到模块。main、MCP、退出入口仍调用同一 fork 停止链路，没有新增停止实现。
+
+## 必须区分的边界
+
+- 候选不可读：过滤当前根；不凭号码结束它，也不因为一条坏记录阻断其他树。
+- 根已确认、worker 命令不可读：worker 仍属于完整树，不逐个过滤。
+- 父已缺席：历史 PPID 只是一条数字关系，不能授权整批孤立进程；模块可用自身配置证据独立恢复根。
+- PostgreSQL 原生关闭：pg_ctl 读取 postmaster.pid，不能通过筛选其他进程来授权错误文件。因此文件根未确认时跳过数据库关闭；不回退强杀，已确认 pgAdmin 停止可完成。
+- 执行器复核失败：发生在目标选定之后，仍作为实际操作失败传播，不能把执行异常一概 catch 成“候选已过滤”。Go Helper 的执行端身份保护继续保留。
+- PID 文件和端口：公共清理仅删除仍指向本次候选、且最终列表已缺席的 PID；新值、空值和活候选保留。面板 PID 保留时同步保留端口文件。
+- 打开与停止：停止允许过滤；打开不能把未知活根当作空实例继续启动。DbGate/Redis Commander 增加打开侧显式检查；Temporal/pgAdmin 原有启动检查保留。
+- 返回列表：停止 PID 返回值仅包含本次确认的目标；空列表不表示系统所有候选都已退出。本次没有改 main/renderer 的既有登记终态规则，不能把私有 PID 文件保留解释为所有 UI 登记也必然保留。
+- 空目标与注入：DbGate/Redis Commander 的自定义 kill provider 也直接返回首次完整列表，不能把空等待结果当作全系统表而删除活候选。
+- 无额外查询：停止阶段的证据过滤、树收集、Neo4j 祖先关系和文件判断都使用已有列表；没有恢复独立采样管道。DbGate 打开时即使端口文件缺失，也检查旧 PID，防止绕过未知活实例的保护。
+
+本次未修改 Go Helper 源码或协议，Helper 版本维持 32；没有构建二进制。
+
+## 静态检查结果
+
+16 个关联 TypeScript 文件经源码解析，语法诊断为零，命名/默认导入未发现未使用项；改动文件和三份说明的行尾空白检查通过，`git diff --check` 退出码为 0。这些检查不导入或执行服务逻辑，不替代 Windows 实机验收。
```

---

### Incident Patch 13: `5d7f349c` (2026-09-28)
**Commit Message**: 1. Fixed Issues

**File**: `README.md` (modified, +8/-8)
```diff
@@ -106,24 +106,24 @@ FlyEnv can manage complete local project stacks, not just one runtime.
 
 ### Windows
 
-- **Installer:** [FlyEnv-Setup-4.19.0.exe](https://github.com/xpf0000/FlyEnv/releases/download/v4.19.0/FlyEnv-Setup-4.19.0.exe)
-- **Portable:** [FlyEnv-Portable-4.19.0.exe](https://github.com/xpf0000/FlyEnv/releases/download/v4.19.0/FlyEnv-Portable-4.19.0.exe)
+- **Installer:** [FlyEnv-Setup-4.19.1.exe](https://github.com/xpf0000/FlyEnv/releases/download/v4.19.1/FlyEnv-Setup-4.19.1.exe)
+- **Portable:** [FlyEnv-Portable-4.19.1.exe](https://github.com/xpf0000/FlyEnv/releases/download/v4.19.1/FlyEnv-Portable-4.19.1.exe)
 
 ### macOS
 
 ```bash
 brew install flyenv
 ```
 
-- [FlyEnv-4.19.0.dmg (Intel)](https://github.com/xpf0000/FlyEnv/releases/download/v4.19.0/FlyEnv-4.19.0.dmg)
-- [FlyEnv-4.19.0-arm64.dmg (Apple Silicon)](https://github.com/xpf0000/FlyEnv/releases/download/v4.19.0/FlyEnv-4.19.0-arm64.dmg)
+- [FlyEnv-4.19.1.dmg (Intel)](https://github.com/xpf0000/FlyEnv/releases/download/v4.19.1/FlyEnv-4.19.1.dmg)
+- [FlyEnv-4.19.1-arm64.dmg (Apple Silicon)](https://github.com/xpf0000/FlyEnv/releases/download/v4.19.1/FlyEnv-4.19.1-arm64.dmg)
 
 ### Linux
 
-- [x86_64 `.deb`](https://github.com/xpf0000/FlyEnv/releases/download/v4.19.0/FlyEnv-4.19.0-x64.deb)
-- [ARM64 `.deb`](https://github.com/xpf0000/FlyEnv/releases/download/v4.19.0/FlyEnv-4.19.0-arm64.deb)
-- [x86_64 `.rpm`](https://github.com/xpf0000/FlyEnv/releases/download/v4.19.0/FlyEnv-4.19.0-x64.rpm)
-- [ARM64 `.rpm`](https://github.com/xpf0000/FlyEnv/releases/download/v4.19.0/FlyEnv-4.19.0-arm64.rpm)
+- [x86_64 `.deb`](https://github.com/xpf0000/FlyEnv/releases/download/v4.19.1/FlyEnv-4.19.1-x64.deb)
+- [ARM64 `.deb`](https://github.com/xpf0000/FlyEnv/releases/download/v4.19.1/FlyEnv-4.19.1-arm64.deb)
+- [x86_64 `.rpm`](https://github.com/xpf0000/FlyEnv/releases/download/v4.19.1/FlyEnv-4.19.1-x64.rpm)
+- [ARM64 `.rpm`](https://github.com/xpf0000/FlyEnv/releases/download/v4.19.1/FlyEnv-4.19.1-arm64.rpm)
 
 For the latest packages, see **[GitHub Releases](https://github.com/xpf0000/FlyEnv/releases)**.
 
```

**File**: `latest-linux-arm64.yml` (modified, +10/-10)
```diff
@@ -1,11 +1,11 @@
-version: 4.19.0
+version: 4.19.1
 files:
-  - url: FlyEnv-4.19.0-arm64.deb
-    sha512: m8KdS7r9Uc2LGKLFwUe0lfo7zya4z2Dhl3p9gvuh08tqQrO7JHw7YPLStzyQlUJnC3yV5f1hKLImrWPlC5aO1Q==
-    size: 133600396
-  - url: FlyEnv-4.19.0-arm64.rpm
-    sha512: ggewZixDuXcn1LHtKlX3n5OM9GxefDI73GjcUC0BR6F1vgJ+uThRoPrFdWaYMOxfFrZIzGoYdsvcISmwkMIoOA==
-    size: 113912601
-path: FlyEnv-4.19.0-arm64.deb
-sha512: m8KdS7r9Uc2LGKLFwUe0lfo7zya4z2Dhl3p9gvuh08tqQrO7JHw7YPLStzyQlUJnC3yV5f1hKLImrWPlC5aO1Q==
-releaseDate: '2026-09-26T05:31:44.783Z'
+  - url: FlyEnv-4.19.1-arm64.deb
+    sha512: 5uHo1fj/jQqQHVS+MvjrRXpwyVqSePczwAcRIUxYQYqLLH70QlSDUiZF9qQRo96cTsyEG88WHdEppR+sLHSnuA==
+    size: 133600736
+  - url: FlyEnv-4.19.1-arm64.rpm
+    sha512: LAXOGB723ytcQJqkWq9pqOZd0tuvuahpp634Vb1h94XeAtSJnf6lR/+Q+d4uAB7kk5tlasdWYJV8veTZcGYuOw==
+    size: 113899173
+path: FlyEnv-4.19.1-arm64.deb
+sha512: 5uHo1fj/jQqQHVS+MvjrRXpwyVqSePczwAcRIUxYQYqLLH70QlSDUiZF9qQRo96cTsyEG88WHdEppR+sLHSnuA==
+releaseDate: '2026-09-28T14:06:32.934Z'
```

**File**: `latest-linux.yml` (modified, +10/-10)
```diff
@@ -1,11 +1,11 @@
-version: 4.19.0
+version: 4.19.1
 files:
-  - url: FlyEnv-4.19.0-x64.deb
-    sha512: Hvlj0YbqduCYDBX6RBeKTtLOQlFSgepPN8UwXwgZVipumGKzp444sBjO2AR4VZ2hSNd3eFjSY9YxeSbjHH2bVQ==
-    size: 139942868
-  - url: FlyEnv-4.19.0-x64.rpm
-    sha512: 7GjIyIY3Ikr/TGMMw2kLLkp9RZzQ/V+/0QDnLRYZ4VSG55cTHytRDTmkpEDjn/6HedpkkZrlQ36F36tQ9pJnaA==
-    size: 119671625
-path: FlyEnv-4.19.0-x64.deb
-sha512: Hvlj0YbqduCYDBX6RBeKTtLOQlFSgepPN8UwXwgZVipumGKzp444sBjO2AR4VZ2hSNd3eFjSY9YxeSbjHH2bVQ==
-releaseDate: '2026-09-26T05:32:21.107Z'
+  - url: FlyEnv-4.19.1-x64.deb
+    sha512: cT3FP6/W5IEfJTJHXsMICa5zEOll2g3+OE3mKtxCH9bHtBQMXcJooEHi4pXyTH02G6pSMMKcj+N1eqeAzW5guw==
+    size: 139943444
+  - url: FlyEnv-4.19.1-x64.rpm
+    sha512: qYBlkqcGr5BtaCCcVgMyoacXpTW34YnsdlSJwTtNSpWiltJXOXwaTWGDhd+78On49zLtOHkavk0+S50reS0eug==
+    size: 119636993
+path: FlyEnv-4.19.1-x64.deb
+sha512: cT3FP6/W5IEfJTJHXsMICa5zEOll2g3+OE3mKtxCH9bHtBQMXcJooEHi4pXyTH02G6pSMMKcj+N1eqeAzW5guw==
+releaseDate: '2026-09-28T14:05:28.173Z'
```

**File**: `latest-mac-arm64.yml` (modified, +10/-10)
```diff
@@ -1,11 +1,11 @@
-version: 4.19.0
+version: 4.19.1
 files:
-  - url: FlyEnv-4.19.0-arm64-mac.zip
-    sha512: b/N7g3Y3Ric/nE7dCD0UfBg10q6/FoReyRuY/AXZpaKLcZWQe4T0paaq104cV6gvtVLzwNKrxc/P7NGyO49w5w==
-    size: 164488905
-  - url: FlyEnv-4.19.0-arm64.dmg
-    sha512: thKv143IdXc7l+4FvCO7KEknbkyFlBAeXErwBMucATZoWbEKhU6JbsfR2+r+XsSeItJiOqWGki5YwZaYr4jNZQ==
-    size: 172671432
-path: FlyEnv-4.19.0-arm64-mac.zip
-sha512: b/N7g3Y3Ric/nE7dCD0UfBg10q6/FoReyRuY/AXZpaKLcZWQe4T0paaq104cV6gvtVLzwNKrxc/P7NGyO49w5w==
-releaseDate: '2026-09-26T05:36:12.338Z'
+  - url: FlyEnv-4.19.1-arm64-mac.zip
+    sha512: t5vJfTFPjJVzVLNdVOtA+X8OmX/wPiQFtJiV/XGhYomQq7vu3p4kwKB1VcSwnPkPnwApSx375NnLcl/XT+f6gQ==
+    size: 164490437
+  - url: FlyEnv-4.19.1-arm64.dmg
+    sha512: WImL9Qt8w85kUPGQ06q/+CY4U8XaKWmSUJav/w0pX418b6vD+k/zV72FIzHODf7iqXNco7IMdRiBvmazfoRJ8w==
+    size: 172674596
+path: FlyEnv-4.19.1-arm64-mac.zip
+sha512: t5vJfTFPjJVzVLNdVOtA+X8OmX/wPiQFtJiV/XGhYomQq7vu3p4kwKB1VcSwnPkPnwApSx375NnLcl/XT+f6gQ==
+releaseDate: '2026-09-28T14:13:58.775Z'
```

**File**: `latest-mac.yml` (modified, +16/-16)
```diff
@@ -1,21 +1,21 @@
-version: 4.19.0
+version: 4.19.1
 files:
   -
-    url: FlyEnv-4.19.0-mac.zip
-    sha512: CK5bJYu7Ak7EaYQGCnrhk3dmJsyjNXV7rQc19+hpX4narmYYFs02tLCX3fQPIpssHd0nTf3DY6HhRnYnN0E8SQ==
-    size: 173907148
+    url: FlyEnv-4.19.1-mac.zip
+    sha512: OUSlUeUgSK2MBcRtLeuEpHhODK5jcM3gVyw+ledhhHhpzMAawueYCpAGkfxkOxiUAxUvOPutr8lZQDbd1BJ/GA==
+    size: 173908728
   -
-    url: FlyEnv-4.19.0-arm64-mac.zip
-    sha512: b/N7g3Y3Ric/nE7dCD0UfBg10q6/FoReyRuY/AXZpaKLcZWQe4T0paaq104cV6gvtVLzwNKrxc/P7NGyO49w5w==
-    size: 164488905
+    url: FlyEnv-4.19.1-arm64-mac.zip
+    sha512: t5vJfTFPjJVzVLNdVOtA+X8OmX/wPiQFtJiV/XGhYomQq7vu3p4kwKB1VcSwnPkPnwApSx375NnLcl/XT+f6gQ==
+    size: 164490437
   -
-    url: FlyEnv-4.19.0.dmg
-    sha512: mlhFSGSXtYqX1dXHEj/Xje3Mcxh4j6zfprjv7WJECJb519o3mLjLkDvrUqDLJ5K8dCPyzVcNxRFtIGeiNwr89g==
-    size: 182165654
+    url: FlyEnv-4.19.1.dmg
+    sha512: nXRl2tKz/7HgLDXIW9XhUAaf9qUumVssN5BCpJ/qtRycubZmOTsA+lbzE2t9z3rNdOSXp4I7yGQ9Bu5CVfyyKw==
+    size: 182156377
   -
-    url: FlyEnv-4.19.0-arm64.dmg
-    sha512: thKv143IdXc7l+4FvCO7KEknbkyFlBAeXErwBMucATZoWbEKhU6JbsfR2+r+XsSeItJiOqWGki5YwZaYr4jNZQ==
-    size: 172671432
-path: FlyEnv-4.19.0-mac.zip
-sha512: CK5bJYu7Ak7EaYQGCnrhk3dmJsyjNXV7rQc19+hpX4narmYYFs02tLCX3fQPIpssHd0nTf3DY6HhRnYnN0E8SQ==
-releaseDate: '2026-09-26T05:50:52.758Z'
+    url: FlyEnv-4.19.1-arm64.dmg
+    sha512: WImL9Qt8w85kUPGQ06q/+CY4U8XaKWmSUJav/w0pX418b6vD+k/zV72FIzHODf7iqXNco7IMdRiBvmazfoRJ8w==
+    size: 172674596
+path: FlyEnv-4.19.1-mac.zip
+sha512: OUSlUeUgSK2MBcRtLeuEpHhODK5jcM3gVyw+ledhhHhpzMAawueYCpAGkfxkOxiUAxUvOPutr8lZQDbd1BJ/GA==
+releaseDate: '2026-09-28T14:18:27.142Z'
```

**File**: `latest.yml` (modified, +7/-7)
```diff
@@ -1,8 +1,8 @@
-version: 4.19.0
+version: 4.19.1
 files:
-  - url: FlyEnv-Setup-4.19.0.exe
-    sha512: IdFvMdqyzubKrad44wnWQDVrHfqVmvbZa9JjYIw9XZj28PAa9AMdxtx+OkCdcJpRhdncRtGOso/M8+iP+FX0GQ==
-    size: 154671880
-path: FlyEnv-Setup-4.19.0.exe
-sha512: IdFvMdqyzubKrad44wnWQDVrHfqVmvbZa9JjYIw9XZj28PAa9AMdxtx+OkCdcJpRhdncRtGOso/M8+iP+FX0GQ==
-releaseDate: '2026-09-26T05:41:13.362Z'
+  - url: FlyEnv-Setup-4.19.1.exe
+    sha512: YSPLCG/TuSpHakEObuB8KMhWihytN4KLvwtrJhASgRkQMCHNTrkhMMsrm9XXrvmtlv4i/8+3tYp6kYGFnED46Q==
+    size: 154672411
+path: FlyEnv-Setup-4.19.1.exe
+sha512: YSPLCG/TuSpHakEObuB8KMhWihytN4KLvwtrJhASgRkQMCHNTrkhMMsrm9XXrvmtlv4i/8+3tYp6kYGFnED46Q==
+releaseDate: '2026-09-28T14:14:26.587Z'
```

---

### Incident Patch 14: `fab035c0` (2026-09-28)
**Commit Message**: 1. Fixed Issues

**File**: `build/linux.build.yml` (modified, +1/-1)
```diff
@@ -1 +1 @@
-version: 78
+version: 79
```

**File**: `build/macos.build.yml` (modified, +1/-1)
```diff
@@ -1 +1 @@
-version: 64
+version: 65
```

**File**: `build/windows.build.yml` (modified, +1/-1)
```diff
@@ -1 +1 @@
-version: 115
+version: 116
```

---

### Incident Patch 15: `c4463e7a` (2026-09-28)
**Commit Message**: 1. Fixed Issues

**File**: `package.json` (modified, +1/-0)
```diff
@@ -24,6 +24,7 @@
     "test:go-gvm": "tsx scripts/go-gvm-test.ts",
     "test:sdkman-java-parser": "tsx scripts/sdkman-java-parser-test.ts",
     "test:node-tray-issues": "tsx scripts/node-tray-issues-test.ts",
+    "test:tray-popup-lifecycle": "tsx scripts/tray-popup-lifecycle-test.ts",
     "test:rust-windows-install": "tsx scripts/rust-windows-install-test.ts",
     "test:php-project-directory": "tsx scripts/php-project-directory-test.ts",
     "test:hermes-provider": "tsx scripts/hermes-provider-config-test.ts",
```

**File**: `scripts/node-tray-issues-test.ts` (modified, +1/-1)
```diff
@@ -64,7 +64,7 @@ assert(
     /win\.on\('blur', this\.onBlur\)/.test(tray) &&
     /Date\.now\(\) - this\.lastBlurCloseAt < 350/.test(tray) &&
     !/win\.focus\(\)/.test(tray),
-  'Tray popup must close on outside click via a 250ms-delayed blur listener, without ever calling focus(): explicit focus lets the OS foreground restore close it instantly'
+  'Tray popup must close on blur and suppress the same tray click from reopening it, without forcing focus'
 )
 assert(
   /private getPopupSide\(display: Display, trayBounds: Rectangle\): TrayPopupSide \{/.test(tray) &&
```

**File**: `scripts/tray-popup-lifecycle-test.ts` (added, +244/-0)
```diff
@@ -0,0 +1,244 @@
+import assert from 'node:assert/strict'
+import { EventEmitter } from 'node:events'
+import { readFileSync } from 'node:fs'
+import * as path from 'node:path'
+import { test } from 'node:test'
+import { runInNewContext } from 'node:vm'
+import { transformSync } from 'esbuild'
+
+class PopupWindow extends EventEmitter {
+  visible = false
+  focused = false
+  destroyed = false
+  nonce = 0
+  webContents = {
+    send: (_channel: string, _command: string, _key: string, payload: { nonce: number }) => {
+      this.nonce = payload.nonce
+    }
+  }
+  isDestroyed() {
+    return this.destroyed
+  }
+  isFocused() {
+    return this.focused
+  }
+  setBounds() {}
+  setAlwaysOnTop() {}
+  moveTop() {}
+  show() {
+    this.visible = true
+    this.focused = true
+  }
+  blur() {
+    this.focused = false
+    this.emit('blur', { preventDefault() {} })
+  }
+  hide() {
+    this.visible = false
+  }
+}
+
+const loadClass = (filename: string, require: (id: string) => unknown, timers: object = {}) => {
+  const code = transformSync(readFileSync(filename, 'utf8'), {
+    loader: 'ts',
+    format: 'cjs'
+  }).code
+  const module = { exports: {} as { default: any } }
+  runInNewContext(code, {
+    module,
+    exports: module.exports,
+    require,
+    console,
+    global: { __static: '/test' },
+    __static: '/test',
+    ...timers
+  })
+  return module.exports.default
+}
+
+const setup = (windows = false) => {
+  const timers = new Map<number, { callback: () => void; delay: number }>()
+  let nextTimer = 0
+  const tray = new EventEmitter()
+  const image = { resize: () => image }
+  Object.assign(tray, {
+    setToolTip() {},
+    setContextMenu() {},
+    destroy() {},
+    getBounds: () => ({ x: 500, y: 0, width: 24, height: 24 })
+  })
+  const electron = {
+    Tray: function () {
+      return tray
+    },
+    nativeImage: { createFromPath: () => image },
+    screen: {
+      getDisplayNearestPoint: () => ({
+        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
+        workArea: { x: 0, y: 24, width: 1920, height: 1056 }
+      })
+    }
+  }
+  const Manager = loadClass(
+    'src/main/ui/TrayManager.ts',
+    (id) => {
+      if (id === 'events') return { EventEmitter }
+      if (id === 'path') return path
+      if (id === 'electron') return electron
+      if (id === '@shared/utils') return { isWindows: () => windows }
+      if (id === '@lang/runtime') return { I18nT: (key: string) => key }
+      if (id === '../core/Logger') return { default: { info() {} } }
+      throw new Error(`Unexpected dependency: ${id}`)
+    },
+    {
+      setTimeout: (callback: () => void, delay: number) => {
+        timers.set(++nextTimer, { callback, delay })
+        return nextTimer
+      },
+      clearTimeout: (id: number) => timers.delete(id)
+    }
+  )
+  const manager = new Manager()
+  const win = new PopupWindow()
+  manager.attachWindow(win)
+  const settle = () => {
+    for (const [id, timer] of [...timers]) {
+      timers.delete(id)
+      timer.callback()
+    }
+  }
+  const open = async () => {
+    const pending = manager.openPopup(400, 24, 'down', 15)
+    manager.notifyLayoutApplied(win.nonce)
+    await pending
+  }
+  return { manager, win, tray, timers, settle, open }
+}
+
+test('outside click immediately after showing closes the popup', async () => {
+  const { manager, win, open } = setup()
+  await open()
+  win.blur()
+  assert.equal(win.visible, false)
+  assert.equal(manager.show, false)
+  assert.equal(manager.clicking, false)
+})
+
+test('focus loss emitted while showing the popup is not missed', async () => {
+  const { manager, win, open } = setup()
+  const show = win.show.bind(win)
+  win.show = () => {
+    show()
+    win.blur()
+  }
+  await open()
+  assert.equal(win.visible, false)
+  assert.equal(manager.show, false)
+})
+
+test('Windows focus loss during opening cannot leave an unfocused popup visible', async () => {
+  const { manager, win, settle, open } = setup(true)
+  await open()
+  win.blur()
+  settle()
+  assert.equal(win.visible, false)
+  assert.equal(manager.show, false)
+})
+
+test('outside click after Windows opening settles closes the popup', async () => {
+  const { manager, win, settle, open } = setup(true)
+  await open()
+  settle()
+  assert.equal(win.visible, true)
+  win.blur()
+  assert.equal(win.visible, false)
+  manager.handleTrayClick({})
+  assert.equal(manager.show, false, 'the same tray click must not reopen a blurred popup')
+})
+
+test('Windows transient focus loss can settle without prematurely hiding the popup', async () => {
+  const { win, settle, open } = setup(true)
+  await open()
+  win.blur()
+  assert.equal(win.visible, true)
+  win.focused = true
+  settle()
+  assert.equal(win.visible, true)
+  win.blur()
+  assert.equal(win.visible, false)
+})
+
+test('double-click closes the popup before requesting the main window', async () => {
+  const { manager, win, tray, open } = setup()
+  await open()
+  m
```

**File**: `src/main/Application.ts` (modified, +4/-1)
```diff
@@ -894,6 +894,9 @@ export default class Application extends EventEmitter {
   }
 
   show(page = 'index') {
+    if (page === 'index') {
+      this.trayManager?.closePopup()
+    }
     this.windowManager.showWindow(page)
   }
 
@@ -986,7 +989,7 @@ export default class Application extends EventEmitter {
     side: TrayPopupSide
   ) {
     if (show) {
-      // 布局同步(含渲染层回执)、移动、置顶、取焦点都由 TrayManager 在全透明状态下完成
+      // 布局同步、移动、显示及失焦关闭统一由 TrayManager 管理
       this.trayManager.openPopup(x, y, side, arrowOffset)
     } else {
       this.trayManager.closePopup()
```

**File**: `src/main/ui/TrayManager.ts` (modified, +39/-15)
```diff
@@ -31,6 +31,8 @@ export default class TrayManager extends EventEmitter {
   window: BrowserWindow | undefined
   private lastBlurCloseAt: number = 0
   private alwaysOnTopArmed: boolean = false
+  private popupGeneration: number = 0
+  private blurArmTimer: ReturnType<typeof setTimeout> | undefined
   private layoutNonce: number = 0
   private layoutAppliedResolver: (() => void) | undefined
   // 弹窗的设计尺寸(WindowManager 创建窗口时也是 270x435),任何 DPI 下 DIP 尺寸都恒定。
@@ -62,6 +64,7 @@ export default class TrayManager extends EventEmitter {
     }
     this.tray.on('right-click', this.handleTrayClick)
     this.tray.on('double-click', () => {
+      this.closePopup()
       this.emit('double-click')
     })
   }
@@ -177,28 +180,35 @@ export default class TrayManager extends EventEmitter {
    * 状态标志必须一起重置。
    */
   attachWindow(win: BrowserWindow) {
+    this.closePopup()
     this.window = win
     this.show = false
     this.clicking = false
     this.alwaysOnTopArmed = false
   }
 
-  /** 打开弹窗:先等渲染层应用布局,再钉住尺寸移动到目标位置、置顶并显示。
-   * 纯 show——不取焦点、不做透明度操作。显式 focus() 会引入 blur 竞态:溢出菜单
-   * 里的图标右键后系统会把前台还给之前的窗口,弹窗刚显示就被自己的 blur 关掉 */
+  /** 先同步布局再显示。失焦监听在 show 前绑定,避免漏掉打开时的失焦。
+   * Windows 给托盘菜单的前台切换留出短暂缓冲,结束时检查实际焦点。 */
   async openPopup(x: number, y: number, side: TrayPopupSide, arrowOffset: number) {
     const win = this.window
     if (!win || win.isDestroyed()) {
       return
     }
+    this.closePopup()
+    const generation = this.popupGeneration
     // 先置意图标志:布局回执是异步的,期间再次点击会得到正确的"关闭"切换
     this.show = true
     this.clicking = true
     win.removeListener('blur', this.onBlur)
     // 等渲染层真正应用了方向/箭头再显示;直接发 IPC 不等回执的话,窗口可见后
     // 布局才落地,箭头会以旧位置渲染一帧再跳变(肉眼可见的"闪一下")
     await this.syncPopupLayout(side, arrowOffset)
-    if (!this.show || win.isDestroyed()) {
+    if (
+      !this.show ||
+      generation !== this.popupGeneration ||
+      win !== this.window ||
+      win.isDestroyed()
+    ) {
       // 等待期间已被关闭(快速切换),放弃本次打开
       return
     }
@@ -211,25 +221,38 @@ export default class TrayManager extends EventEmitter {
       this.alwaysOnTopArmed = true
     }
     win.moveTop()
+    win.on('blur', this.onBlur)
+    this.clicking = isWindows()
     win.show()
-    setTimeout(() => {
-      if (!this.show || win.isDestroyed()) {
-        return
-      }
-      // 250ms 后再挂 blur:溢出菜单场景下系统在右键后立刻把前台还给之前的窗口,
-      // 这次 blur 落在武装之前自然忽略;之后用户点了弹窗外面,blur 才关窗。
-      // 先摘再挂:250ms 内快速关→开会叠加多个定时器,避免 onBlur 被注册多份
-      win.removeListener('blur', this.onBlur)
-      win.on('blur', this.onBlur)
-      this.clicking = false
-    }, 250)
+    if (isWindows() && this.show && generation === this.popupGeneration) {
+      this.blurArmTimer = setTimeout(() => {
+        this.blurArmTimer = undefined
+        if (!this.show || generation !== this.popupGeneration || win.isDestroyed()) {
+          return
+        }
+        this.clicking = false
+        // 缓冲期间的 blur 已发生,不能等待窗口再次失焦才关闭。
+        if (!win.isFocused()) {
+          this.lastBlurCloseAt = Date.now()
+          this.closePopup()
+        }
+      }, 250)
+    }
   }
 
   /** 关闭弹窗:真正 hide。隐藏窗口不存在也就谈不上拦截点击(issue #869),
    * 不做 setOpacity(0) 之类的伪隐藏,避免再次 show 时不合成画面 */
   closePopup() {
     const win = this.window
     this.show = false
+    this.clicking = false
+    this.popupGeneration += 1
+    if (this.blurArmTimer !== undefined) {
+      clearTimeout(this.blurArmTimer)
+      this.blurArmTimer = undefined
+    }
+    this.layoutAppliedResolver?.()
+    this.layoutAppliedResolver = undefined
     if (!win || win.isDestroyed()) {
       return
     }
@@ -418,6 +441,7 @@ export default class TrayManager extends EventEmitter {
   }
 
   destroy() {
+    this.closePopup()
     this.tray.removeAllListeners()
     this.tray.setContextMenu(null)
     this.tray.destroy()
```

#### Recent Merged Pull Requests:
- **PR #884** (2026-10-05): build(deps): bump axios from 1.19.0 to 1.20.0 (@dependabot[bot])
- **PR #883** (2026-10-05): build(deps): bump dompurify from 3.4.13 to 3.4.16 (@dependabot[bot])
- **PR #881** (2026-10-05): build(deps): bump moment from 2.30.1 to 2.31.0 (@dependabot[bot])
- **PR #876** (2026-10-05): build(deps): bump ip-address from 10.4.0 to 10.7.2 (@dependabot[bot])
- **PR #875** (2026-10-05): build(deps): bump undici from 7.29.0 to 7.29.1 (@dependabot[bot])
- **PR #872** (2026-10-05): feat: 按版本配置读取 MySQL 和 MariaDB 连接参数 (@ieras)
- **PR #871** (closed): feat: 将数据库启动参数改为读取配置 (@ieras)
- **PR #870** (2026-10-05): fix(i18n): complete Indonesian Podman translations (@sepsarip)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
