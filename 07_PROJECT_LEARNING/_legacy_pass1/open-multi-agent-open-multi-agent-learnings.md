# Forensic Learning Record (Deep Inspection): open-multi-agent/open-multi-agent

> **Canonical Artifact**: `07_PROJECT_LEARNING/open-multi-agent-open-multi-agent-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/open-multi-agent/open-multi-agent](https://github.com/open-multi-agent/open-multi-agent))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:59:22.783Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `open-multi-agent/open-multi-agent`
- **Description**: Self-hosted TypeScript agent runtime with durable approvals and verifiable run records. Own it, approve it, audit it.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 6971 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/core/benchmarks/file-trace-store.mjs`
```
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { performance } from 'node:perf_hooks'

const [candidatePath] = process.argv.slice(2)
const moduleUrl = candidatePath
  ? pathToFileURL(candidatePath).href
  : new URL('../dist/observability/file.js', import.meta.url).href
const { FileTraceStore } = await import(`${moduleUrl}?file-trace-store-benchmark`)

function records(count, prefix) {
  return Array.from({ length: count }, (_, index) => {
    const runIndex = Math.floor(index / 2)
    const isEnd = index % 2 === 1
    const start = 1_700_000_000_000 + runIndex
    return {
      schemaVersion: 2,
      recordId: `${prefix}-record-${index}`,
      sequence: isEnd ? 2 : 1,
      timestampUnixMs: start + (isEnd ? 1 : 0),
      runId: `${prefix}-run-${String(runIndex).padStart(6, '0')}`,
      attempt: 1,
      traceId: `${prefix}-trace-${runIndex}`,
      spanId: `${prefix}-span-${runIndex}`,
      recordType: isEnd ? 'span_end' : 'span_start',
      kind: 'run',
      name: 'oma.run',
      startUnixMs: start,
      ...(isEnd ? {
        endUnixMs: start + 1,
        durationMs: 1,
        status: { code: 'ok' },
      } : {}),
      attributes: {},
    }
  })
}

async function queryAll(store) {
  let cursor
  let count = 0
  do {
    const page = await store.queryRuns({ limit: 500, order: 'started_asc', ...(cursor ? { cursor } : {}) })
    count += page.items.length
    cursor = page.nextCursor
  } while (cursor)
  return count
}

async function measureScale(root, count) {
  global.gc?.()
  const heapBefore = process.memoryUsage().heapUsed
  const path = join(root, `scale-${count}.ndjson`)
  const payload = records(count, `scale-${count}`)
  const store = await FileTraceStore.open(path)
  const appendStarted = performance.now()
  await store.append(payload)
  const appendMs = performance.now() - appendStarted
  const flushStarted = performance.now()
  await store.flush()
  const flushMs = performance.now() - flushStarted
  global.gc?.()
  const heapAfterIndex = process.memoryUsage().heapUsed
  await store.close()

  const reopenStarted = performance.now()
  const reopened = await FileTraceStore.open(path)
  const reopenMs = performance.now() - reopenStarted
  const queryStarted = performance.now()
  const runs = await queryAll(reopened)
  const queryMs = performance.now() - queryStarted
  const beforeCompactionBytes = (await stat(path)).size
  const compactionStarted = performance.now()
  const compaction = await reopened.compact()
  const compactionMs = performance.now() - compactionStarted
  await reopened.close()

  return {
    records: count,
    runs,
    appendMs,
    flushMs,
    reopenMs,
    queryMs,
    compactionMs,
    estimatedIndexHeapBytes: Math.max(0, heapAfterIndex - heapBefore),
    bytesBeforeCompaction: beforeCompactionBytes,
    bytesAfterCompaction: compaction.fileSizeBytes,
  }
}

async function measureBatchSize(root, batchSize, count = 1_000) {
  const path = join(root, `batch-${batchSize}.ndjson`)
  const payload = records(count, `batch-${batchSize}`)
  const store = await FileTraceStore.open(path)
  const started = performance.now()
  for (let index = 0; index < payload.length; index += batchSize) {
    await store.append(payload.slice(index, index + batchSize))
  }
  const appendMs = performance.now() - started
  await store.flush()
  await store.close()
  return { batchSize, appendMs, fileSizeBytes: (await stat(path)).size }
}

const root = await mkdtemp(join(tmpdir(), 'oma-file-trace-benchmark-'))
try {
  const scales = []
  for (const count of [1_000, 10_000]) scales.push(await measureScale(root, count))
  const batchSizes = []
  for (const size of [1, 10, 100, 1_000]) batchSizes.push(await measureBatchSize(root, size))
  console.log(JSON.stringify({
    node: process.version,
    platform: `${process.platform}-${process.arch}`,
    durability: 'append=write-complete; flush/close=fsync',
    scales,
    batchSizes,
  }, null, 2))
} finally {
  await rm(root, { recursive: true, force: true })
}

```

### Core Architecture Module: `packages/core/benchmarks/observability-no-sink.mjs`
```
import { pathToFileURL } from 'node:url'
import { performance } from 'node:perf_hooks'

const [baselinePath, candidatePath] = process.argv.slice(2)
if (!baselinePath || !candidatePath) {
  throw new Error('Usage: node observability-no-sink.mjs <baseline-index.js> <candidate-index.js>')
}

const iterations = Number(process.env.OMA_BENCH_ITERATIONS ?? 2_000)
const rounds = Number(process.env.OMA_BENCH_ROUNDS ?? 9)

async function load(indexPath, label) {
  const { OpenMultiAgent } = await import(`${pathToFileURL(indexPath).href}?label=${label}`)
  const adapter = {
    name: `benchmark-${label}`,
    async chat() {
      return {
        id: 'benchmark-response',
        content: [{ type: 'text', text: 'ok' }],
        model: 'benchmark-model',
        stop_reason: 'end_turn',
        usage: { input_tokens: 1, output_tokens: 1 },
      }
    },
    async *stream() {},
  }
  const oma = new OpenMultiAgent({ defaultModel: 'benchmark-model' })
  const agent = { name: 'benchmark', model: 'benchmark-model', adapter }
  const run = async (count) => {
    const start = performance.now()
    for (let index = 0; index < count; index++) {
      await oma.runAgent(agent, 'ping')
    }
    return performance.now() - start
  }
  run.retainedBytesPerRun = async (count) => {
    if (!global.gc) return null
    global.gc()
    const before = process.memoryUsage().heapUsed
    const held = []
    for (let index = 0; index < count; index++) held.push(await oma.runAgent(agent, 'ping'))
    global.gc()
    const bytes = Math.max(0, process.memoryUsage().heapUsed - before) / count
    held.length = 0
    global.gc()
    return bytes
  }
  return run
}

const baseline = await load(baselinePath, 'baseline')
const candidate = await load(candidatePath, 'candidate')
await baseline(200)
await candidate(200)

const baselineMs = []
const candidateMs = []
for (let round = 0; round < rounds; round++) {
  if (round % 2 === 0) {
    baselineMs.push(await baseline(iterations))
    candidateMs.push(await candidate(iterations))
  } else {
    candidateMs.push(await candidate(iterations))
    baselineMs.push(await baseline(iterations))
  }
}

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
const baselineMedianMs = median(baselineMs)
const candidateMedianMs = median(candidateMs)
const regressionPercent = ((candidateMedianMs / baselineMedianMs) - 1) * 100
const retainedIterations = Number(process.env.OMA_BENCH_MEMORY_ITERATIONS ?? 2_000)
const retainedRounds = Number(process.env.OMA_BENCH_MEMORY_ROUNDS ?? 3)
const baselineRetained = []
const candidateRetained = []
for (let round = 0; round < retainedRounds; round++) {
  if (round % 2 === 0) {
    baselineRetained.push(await baseline.retainedBytesPerRun(retainedIterations))
    candidateRetained.push(await candidate.retainedBytesPerRun(retainedIterations))
  } else {
    candidateRetained.push(await candidate.retainedBytesPerRun(retainedIterations))
    baselineRetained.push(await baseline.retainedBytesPerRun(retainedIterations))
  }
}
const validMedian = (values) => values.some((value) => value === null)
  ? null
  : median(values)
const baselineRetainedBytesPerRun = validMedian(baselineRetained)
const candidateRetainedBytesPerRun = validMedian(candidateRetained)

console.log(JSON.stringify({
  iterations,
  rounds,
  baselineMedianMs,
  candidateMedianMs,
  regressionPercent,
  retainedMemory: {
    iterations: retainedIterations,
    rounds: retainedRounds,
    baselineBytesPerRun: baselineRetainedBytesPerRun,
    candidateBytesPerRun: candidateRetainedBytesPerRun,
    additionalBytesPerRun: baselineRetainedBytesPerRun === null || candidateRetainedBytesPerRun === null
      ? null
      : candidateRetainedBytesPerRun - baselineRetainedBytesPerRun,
    note: global.gc ? 'Retained result arrays; median of alternating same-process rounds.' : 'Run with --expose-gc.',
  },
  baselineSamplesMs: baselineMs,
  candidateSamplesMs: candidateMs,
}, null, 2))

```

### Core Architecture Module: `packages/core/benchmarks/observability-sinks.mjs`
```
import { fileURLToPath, pathToFileURL } from 'node:url'
import { performance } from 'node:perf_hooks'
import { cpus } from 'node:os'
import { dirname, resolve } from 'node:path'

const [candidatePath, otelCandidatePath] = process.argv.slice(2)
if (!candidatePath) {
  throw new Error('Usage: node observability-sinks.mjs <candidate-index.js> [otel-index.js]')
}

const iterations = Number(process.env.OMA_BENCH_ITERATIONS ?? 2_000)
const rounds = Number(process.env.OMA_BENCH_ROUNDS ?? 9)
const core = await import(`${pathToFileURL(candidatePath).href}?obs2-benchmark`)
const traceUtils = await import(`${pathToFileURL(resolve(dirname(candidatePath), 'utils/trace.js')).href}?legacy-benchmark`)

const adapter = {
  name: 'obs2-benchmark',
  async chat() {
    return {
      id: 'benchmark-response',
      content: [{ type: 'text', text: 'ok' }],
      model: 'benchmark-model',
      stop_reason: 'end_turn',
      usage: { input_tokens: 1, output_tokens: 1 },
    }
  },
  async *stream() {},
}
const agent = { name: 'benchmark', model: 'benchmark-model', adapter }

function makeBatchSink(options = {}) {
  return new core.BatchingTraceSink({
    async export(records) { return { status: 'success', exported: records.length } },
  }, { diagnostics: 'silent', ...options })
}

const batchSink = makeBatchSink()
const runners = {
  noSink: new core.OpenMultiAgent({ defaultModel: 'benchmark-model' }),
  syncCallback: new core.OpenMultiAgent({ defaultModel: 'benchmark-model', onTrace() {} }),
  batchSink: new core.OpenMultiAgent({
    defaultModel: 'benchmark-model',
    observability: { sinks: [batchSink] },
  }),
}

async function measure(oma, count) {
  const start = performance.now()
  for (let index = 0; index < count; index++) await oma.runAgent(agent, 'ping')
  return performance.now() - start
}

for (const oma of Object.values(runners)) await measure(oma, 200)
await batchSink.forceFlush({ timeoutMs: 5_000 })

const samples = { noSink: [], syncCallback: [], batchSink: [] }
const names = Object.keys(runners)
for (let round = 0; round < rounds; round++) {
  const order = round % 2 === 0 ? names : [...names].reverse()
  for (const name of order) samples[name].push(await measure(runners[name], iterations))
  await batchSink.forceFlush({ timeoutMs: 5_000 })
}

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
const percentile = (values, fraction) => [...values].sort((a, b) => a - b)[Math.floor(values.length * fraction)]
const medians = Object.fromEntries(Object.entries(samples).map(([name, values]) => [name, median(values)]))

const sampleRecord = {
  schemaVersion: 2,
  recordId: '00000000-0000-4000-8000-000000000000',
  sequence: 1,
  timestampUnixMs: Date.now(),
  runId: 'benchmark-run',
  attempt: 1,
  traceId: '1'.repeat(32),
  spanId: '2'.repeat(16),
  recordType: 'span_end',
  kind: 'agent',
  name: 'invoke_agent',
  startUnixMs: Date.now(),
  endUnixMs: Date.now(),
  durationMs: 1,
  status: { code: 'ok' },
  attributes: {
    'oma.agent.name': 'benchmark-agent',
    'oma.usage.input_tokens': 100,
    'oma.usage.output_tokens': 20,
    'oma.status': 'ok',
  },
}
const representativeRecords = Array.from({ length: 402 }, (_, index) => ({
  ...sampleRecord,
  recordId: `${index}`.padStart(36, '0'),
  sequence: index + 1,
}))
const representativeBytes = representativeRecords.reduce(
  (sum, record) => sum + Buffer.byteLength(JSON.stringify(record), 'utf8'),
  0,
)

const emitIterations = 10_000
const emitSink = makeBatchSink({
  maxQueueRecords: emitIterations + 1,
  maxQueueBytes: 64 * 1024 * 1024,
  maxBatchRecords: emitIterations + 1,
  scheduledDelayMs: 60_000,
})
const emitMicros = []
for (let index = 0; index < emitIterations; index++) {
  const started = performance.now()
  emitSink.emit({ ...sampleRecord, sequence: index + 1 })
  emitMicros.push((performance.now() - started) * 1_000)
}
const emitP95Micros = percentile(emitMicros, 0.95)
await emitSink.shutdown({ timeoutMs: 5_000 })

const legacyEvent = {
  type: 'agent', runId: 'legacy-benchmark', spanId: '00000000-0000-4000-8000-000000000001',
  agent: 'benchmark', turns: 1, tokens: { input_tokens: 1, output_tokens: 1 }, toolCalls: 0,
  startMs: 1, endMs: 2, durationMs: 1,
}
const legacyDispatchMicros = []
for (let index = 0; index < emitIterations; index++) {
  const started = performance.now()
  traceUtils.emitTrace(() => {}, legacyEvent)
  legacyDispatchMicros.push((performance.now() - started) * 1_000)
}

function storeRecords(count, prefix) {
  return Array.from({ length: count }, (_, index) => {
    const runIndex = Math.floor(index / 2)
    const isEnd = index % 2 === 1
    const traceId = (runIndex + 1).toString(16).padStart(32, '0')
    const spanId = (runIndex + 1).toString(16).padStart(16, '0')
    const startUnixMs = 1_700_000_000_000 + runIndex
    return {
      schemaVersion: 2,
      recordId: `${prefix}-${index}`,
      sequence: isEnd ? 2 : 1,
      timestampUnixMs: startUnixMs + (isEnd ? 1 : 0),
      runId: `${prefix}-run-${runIndex}`,
      attempt: 1,
      traceId,
      spanId,
      recordType: isEnd ? 'span_end' : 'span_start',
      kind: 'run',
      name: 'oma.run',
      startUnixMs,
      ...(isEnd ? {
        endUnixMs: startUnixMs + 1,
        durationMs: 1,
        status: { code: 'ok' },
      } : {}),
      attributes: {},
    }
  })
}

const inMemoryStore = []
for (const count of [1_000, 10_000]) {
  global.gc?.()
  const store = new core.InMemoryTraceStore()
  const records = storeRecords(count, `memory-${count}`)
  const heapBefore = process.memoryUsage().heapUsed
  const appendStarted = performance.now()
  await store.append(records)
  const appendMs = performance.now() - appendStarted
  global.gc?.()
  const heapAfter = process.memoryUsage().heapUsed
  const queryStarted = performance.now()
  const page = await store.queryRuns({ limit: 500 })
  inMemoryStore.push({
    records: count,
    appendMs,
    firstPageQueryMs: performance.now() - queryStarted,
    firstPageRuns: page.items.length,
    estimatedHeapBytes: Math.max(0, heapAfter - heapBefore),
  })
}

function workloadRecords(agentCount) {
  const traceId = 'a'.repeat(32)
  const records = []
  let localSequence = 0
  const rootId = '1'.repeat(16)
  records.push({ ...sampleRecord, recordId: `workload-root-start-${agentCount}`,
    sequence: ++localSequence, traceId, spanId: rootId, recordType: 'span_start', kind: 'run' })
  for (let index = 0; index < agentCount; index++) {
    const spanId = (index + 2).toString(16).padStart(16, '0')
    records.push({ ...sampleRecord, recordId: `workload-agent-start-${agentCount}-${index}`,
      sequence: ++localSequence, traceId, spanId, parentSpanId: rootId, recordType: 'span_start' })
    records.push({ ...sampleRecord, recordId: `workload-agent-end-${agentCount}-${index}`,
      sequence: ++localSequence, traceId, spanId, parentSpanId: rootId })
  }
  records.push({ ...sampleRecord, recordId: `workload-root-end-${agentCount}`,
    sequence: ++localSequence, traceId, spanId: rootId, kind: 'run' })
  return records
}

async function measureEnqueue(records) {
  const repeats = Math.max(1, Math.ceil(1_000 / records.length))
  const measurementRecords = Array.from({ length: repeats }, (_, repeat) =>
    records.map((record, index) => ({ ...record, recordId: `${record.recordId}-sample-${repeat}-${index}` }))).flat()
  const sink = makeBatchSink({
    maxQueueRecords: measurementRecords.length + 1,
    maxQueueBytes: 64 * 1024 * 1024,
    maxBatchRecords: measurementRecords.length + 1,
    scheduledDelayMs: 60_000,
  })
  const micros = []
  for (const record of measurementRecords) {
    const started = performance.now()
    sink.emit(record)
    micros.push((performance.now() - started) * 1_000)
  }
  const stats = sink.getStats()
  await sink.shutdown({ timeoutMs: 5_000 })
  return {
    records: records.length,
    measurementSamples: measurementRecords.length,
    bytes: records.reduce((sum, record) => sum + Buffer.byteLength(JSO
```

### Core Architecture Module: `packages/core/examples/basics/multi-model-team.ts`
```
/**
 * Multi-Model Team with Custom Tools
 *
 * Demonstrates:
 * - Mixing Anthropic and OpenAI models in the same team
 * - Defining custom tools with defineTool() and Zod schemas
 * - Building agents with a custom ToolRegistry so they can use custom tools
 * - Running a team goal that uses the custom tools
 *
 * Run:
 *   npx tsx packages/core/examples/basics/multi-model-team.ts
 *
 * Prerequisites:
 *   ANTHROPIC_API_KEY and OPENAI_API_KEY env vars must be set.
 *   (If you only have one key, set useOpenAI = false below.)
 */

import { z } from 'zod'
import { OpenMultiAgent, defineTool } from '../../src/index.js'
import type { AgentConfig, OrchestratorEvent } from '../../src/types.js'

// ---------------------------------------------------------------------------
// Custom tools — defined with defineTool() + Zod schemas
// ---------------------------------------------------------------------------

/**
 * A custom tool that fetches live exchange rates from a public API.
 */
const exchangeRateTool = defineTool({
  name: 'get_exchange_rate',
  description:
    'Get the current exchange rate between two currencies. ' +
    'Returns the rate as a decimal: 1 unit of `from` = N units of `to`.',
  inputSchema: z.object({
    from: z.string().describe('ISO 4217 currency code, e.g. "USD"'),
    to: z.string().describe('ISO 4217 currency code, e.g. "EUR"'),
  }),
  execute: async ({ from, to }) => {
    try {
      const url = `https://api.exchangerate.host/convert?from=${from}&to=${to}&amount=1`
      const resp = await fetch(url, { signal: AbortSignal.timeout(5000) })

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)

      interface ExchangeRateResponse {
        result?: number
        info?: { rate?: number }
      }
      const json = (await resp.json()) as ExchangeRateResponse
      const rate: number | undefined = json?.result ?? json?.info?.rate

      if (typeof rate !== 'number') throw new Error('Unexpected API response shape')

      return {
        data: JSON.stringify({ from, to, rate, timestamp: new Date().toISOString() }),
        isError: false,
      }
    } catch (err) {
      // Graceful degradation — return a stubbed rate so the team can still proceed
      const stub = parseFloat((Math.random() * 0.5 + 0.8).toFixed(4))
      return {
        data: JSON.stringify({
          from,
          to,
          rate: stub,
          note: `Live fetch failed (${err instanceof Error ? err.message : String(err)}). Using stub rate.`,
        }),
        isError: false,
      }
    }
  },
})

/**
 * A custom tool that formats a number as a localised currency string.
 */
const formatCurrencyTool = defineTool({
  name: 'format_currency',
  description: 'Format a number as a localised currency string.',
  inputSchema: z.object({
    amount: z.number().describe('The numeric amount to format.'),
    currency: z.string().describe('ISO 4217 currency code, e.g. "USD".'),
    locale: z
      .string()
      .optional()
      .describe('BCP 47 locale string, e.g. "en-US". Defaults to "en-US".'),
  }),
  execute: async ({ amount, currency, locale = 'en-US' }) => {
    try {
      const formatted = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
      }).format(amount)
      return { data: formatted, isError: false }
    } catch {
      return { data: `${amount} ${currency}`, isError: true }
    }
  },
})

// ---------------------------------------------------------------------------
// Helper: build an AgentConfig whose tools list includes custom tool names.
//
// Agents reference tools by name in their AgentConfig.tools array.
// The ToolRegistry is injected via the Agent constructor. When using OpenMultiAgent
// convenience methods (runTeam, runTasks, runAgent), the orchestrator builds
// agents internally using buildAgent(), which registers only the five built-in
// tools. For custom tools, use AgentPool + Agent directly (see the note in the
// README) or provide the custom tool names in the tools array and rely on a
// registry you inject yourself.
//
// In this example we demonstrate the custom-tool pattern by running the agents
// directly through AgentPool rather than through the OpenMultiAgent high-level API.
// ---------------------------------------------------------------------------

import { Agent, AgentPool, ToolRegistry, ToolExecutor, registerBuiltInTools } from '../../src/index.js'

/**
 * Build an Agent with both built-in and custom tools registered.
 */
function buildCustomAgent(
  config: AgentConfig,
  extraTools: ReturnType<typeof defineTool>[],
): Agent {
  const registry = new ToolRegistry()
  registerBuiltInTools(registry)
  for (const tool of extraTools) {
    registry.register(tool)
  }
  const executor = new ToolExecutor(registry)
  return new Agent(config, registry, executor)
}

// ---------------------------------------------------------------------------
// Agent definitions — mixed providers
// ---------------------------------------------------------------------------

const useOpenAI = Boolean(process.env.OPENAI_API_KEY)

const researcherConfig: AgentConfig = {
  name: 'researcher',
  model: 'claude-sonnet-4-6',
  provider: 'anthropic',
  systemPrompt: `You are a financial data researcher.
Use the get_exchange_rate tool to fetch current rates between the currency pairs you are given.
Return the raw rates as a JSON object keyed by pair, e.g. { "USD/EUR": 0.91, "USD/GBP": 0.79 }.`,
  tools: ['get_exchange_rate'],
  maxTurns: 6,
  temperature: 0,
}

const analystConfig: AgentConfig = {
  name: 'analyst',
  model: useOpenAI ? 'gpt-5.4' : 'claude-sonnet-4-6',
  provider: useOpenAI ? 'openai' : 'anthropic',
  systemPrompt: `You are a foreign exchange analyst.
You receive exchange rate data and produce a short briefing.
Use format_currency to show example conversions.
Keep the briefing under 200 words.`,
  tools: ['format_currency'],
  maxTurns: 4,
  temperature: 0.3,
}

// ---------------------------------------------------------------------------
// Build agents with custom tools
// ---------------------------------------------------------------------------

const researcher = buildCustomAgent(researcherConfig, [exchangeRateTool])
const analyst = buildCustomAgent(analystConfig, [formatCurrencyTool])

// ---------------------------------------------------------------------------
// Run with AgentPool for concurrency control
// ---------------------------------------------------------------------------

console.log('Multi-model team with custom tools')
console.log(`Providers: researcher=anthropic, analyst=${useOpenAI ? 'openai (gpt-5.4)' : 'anthropic (fallback)'}`)
console.log('Custom tools:', [exchangeRateTool.name, formatCurrencyTool.name].join(', '))
console.log()

const pool = new AgentPool(1) // sequential for readability
pool.add(researcher)
pool.add(analyst)

// Step 1: researcher fetches the rates
console.log('[1/2] Researcher fetching FX rates...')
const researchResult = await pool.run(
  'researcher',
  `Fetch exchange rates for these pairs using the get_exchange_rate tool:
- USD to EUR
- USD to GBP
- USD to JPY
- EUR to GBP

Return the results as a JSON object: { "USD/EUR": <rate>, "USD/GBP": <rate>, ... }`,
)

if (!researchResult.success) {
  console.error('Researcher failed:', researchResult.output)
  process.exit(1)
}

console.log('Researcher done. Tool calls made:', researchResult.toolCalls.map(c => c.toolName).join(', '))

// Step 2: analyst writes the briefing, receiving the researcher output as context
console.log('\n[2/2] Analyst writing FX briefing...')
const analystResult = await pool.run(
  'analyst',
  `Here are the current FX rates gathered by the research team:

${researchResult.output}

Using format_currency, show what $1,000 USD and €1,000 EUR convert to in each of the other currencies.
Then write a short FX market briefing (under 200 words) covering:
- Each rate with a brief observation
- The strongest and weakest currency in the set
- One-sentence market comment`,

```

### Core Architecture Module: `packages/core/examples/basics/single-agent.ts`
```
/**
 * Single Agent
 *
 * The simplest possible usage: one agent with bash and file tools, running
 * a coding task. Then shows streaming output using the Agent class directly.
 *
 * Run:
 *   npx tsx packages/core/examples/basics/single-agent.ts
 *
 * Prerequisites:
 *   ANTHROPIC_API_KEY env var must be set (default provider). To use any
 *   other built-in provider, set OMA_PROVIDER and OMA_MODEL plus that
 *   provider's key, for example:
 *     OMA_PROVIDER=deepseek OMA_MODEL=deepseek-flash DEEPSEEK_API_KEY=...
 *     OMA_PROVIDER=openai OMA_MODEL=gpt-5.4 OPENAI_API_KEY=...
 *   See docs/providers.md for the full provider and env var list.
 */

import { join } from 'node:path'
import { OpenMultiAgent, Agent, ToolRegistry, ToolExecutor, registerBuiltInTools, type SupportedProvider } from '../../src/index.js'
import type { OrchestratorEvent } from '../../src/types.js'

// Defaults to Claude. Any built-in provider works: set OMA_PROVIDER and
// OMA_MODEL plus that provider's API key (see docs/providers.md).
const provider = (process.env.OMA_PROVIDER ?? 'anthropic') as SupportedProvider
const model = process.env.OMA_MODEL ?? 'claude-sonnet-4-6'

// Built-in filesystem tools are sandboxed to `<cwd>/.agent-workspace` by
// default; write example output there so the demo runs without disabling
// the sandbox.
const OUTPUT_DIR = join(process.cwd(), '.agent-workspace', 'single-agent')
const GREET_FILE = join(OUTPUT_DIR, 'greet.ts')

// ---------------------------------------------------------------------------
// Part 1: Single agent via OpenMultiAgent (simplest path)
// ---------------------------------------------------------------------------

const orchestrator = new OpenMultiAgent({
  defaultProvider: provider,
  defaultModel: model,
  onProgress: (event: OrchestratorEvent) => {
    if (event.type === 'agent_start') {
      console.log(`[start]    agent=${event.agent}`)
    } else if (event.type === 'agent_complete') {
      console.log(`[complete] agent=${event.agent}`)
    }
  },
})

console.log('Part 1: runAgent() — single one-shot task\n')

const result = await orchestrator.runAgent(
  {
    name: 'coder',
    provider,
    model,
    systemPrompt: `You are a focused TypeScript developer.
When asked to implement something, write clean, minimal code with no extra commentary.
Use the bash tool to run commands and the file tools to read/write files.`,
    tools: ['bash', 'file_read', 'file_write'],
    maxTurns: 8,
  },
  `Create a small TypeScript utility function in ${GREET_FILE} that:
  1. Exports a function named greet(name: string): string
  2. Returns "Hello, <name>!"
  3. Adds a brief usage comment at the top of the file.
  Then add a default call greet("World") at the bottom and run the file with: npx tsx ${GREET_FILE}`,
)

if (result.success) {
  console.log('\nAgent output:')
  console.log('─'.repeat(60))
  console.log(result.output)
  console.log('─'.repeat(60))
} else {
  console.error('Agent failed:', result.output)
  process.exit(1)
}

console.log('\nToken usage:')
console.log(`  input:  ${result.tokenUsage.input_tokens}`)
console.log(`  output: ${result.tokenUsage.output_tokens}`)
console.log(`  tool calls made: ${result.toolCalls.length}`)

// ---------------------------------------------------------------------------
// Part 2: Streaming via Agent directly
//
// OpenMultiAgent.runAgent() is a convenient wrapper. When you need streaming, use
// the Agent class directly with an injected ToolRegistry + ToolExecutor.
// ---------------------------------------------------------------------------

console.log('\n\nPart 2: Agent.stream() — incremental text output\n')

// Build a registry with all built-in tools registered
const registry = new ToolRegistry()
registerBuiltInTools(registry)
const executor = new ToolExecutor(registry)

const streamingAgent = new Agent(
  {
    name: 'explainer',
    provider,
    model,
    systemPrompt: 'You are a concise technical writer. Keep explanations brief.',
    maxTurns: 3,
  },
  registry,
  executor,
)

process.stdout.write('Streaming: ')

for await (const event of streamingAgent.stream(
  'In two sentences, explain what a TypeScript generic constraint is.',
)) {
  if (event.type === 'text' && typeof event.data === 'string') {
    process.stdout.write(event.data)
  } else if (event.type === 'done') {
    process.stdout.write('\n')
  } else if (event.type === 'error') {
    console.error('\nStream error:', event.data)
  }
}

// ---------------------------------------------------------------------------
// Part 3: Multi-turn conversation via Agent.prompt()
// ---------------------------------------------------------------------------

console.log('\nPart 3: Agent.prompt() — multi-turn conversation\n')

const conversationAgent = new Agent(
  {
    name: 'tutor',
    provider,
    model,
    systemPrompt: 'You are a TypeScript tutor. Give short, direct answers.',
    maxTurns: 2,
    // Keep only the most recent turn in long prompt() conversations.
    contextStrategy: { type: 'sliding-window', maxTurns: 1 },
  },
  new ToolRegistry(), // no tools needed for this conversation
  new ToolExecutor(new ToolRegistry()),
)

const turn1 = await conversationAgent.prompt('What is a type guard in TypeScript?')
console.log('Turn 1:', turn1.output.slice(0, 200))

const turn2 = await conversationAgent.prompt('Give me one concrete code example of what you just described.')
console.log('\nTurn 2:', turn2.output.slice(0, 300))

// History is retained between prompt() calls
console.log(`\nConversation history length: ${conversationAgent.getHistory().length} messages`)

console.log('\nDone.')

```

### Core Architecture Module: `packages/core/examples/basics/structured-input.ts`
```
/**
 * Structured Multimodal Input
 *
 * Send an image and caller-owned message history through runAgent() without
 * bypassing OMA's hooks, tracing, budgets, progress, or evaluation path.
 *
 * Run:
 *   npx tsx packages/core/examples/basics/structured-input.ts ./photo.png
 *
 * Prerequisites:
 *   ANTHROPIC_API_KEY env var must be set (default provider). To use any
 *   other built-in provider, set OMA_PROVIDER and OMA_MODEL plus that
 *   provider's key, for example:
 *     OMA_PROVIDER=deepseek OMA_MODEL=deepseek-flash DEEPSEEK_API_KEY=...
 *     OMA_PROVIDER=openai OMA_MODEL=gpt-5.4 OPENAI_API_KEY=...
 *   The model must accept image input. See docs/providers.md for the full
 *   provider and env var list.
 *   The image must be PNG, JPEG, GIF, or WebP.
 */

import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'

import { OpenMultiAgent, type LLMMessage, type SupportedProvider } from '../../src/index.js'

// Defaults to Claude. Any built-in provider works: set OMA_PROVIDER and
// OMA_MODEL plus that provider's API key (see docs/providers.md).
const provider = (process.env.OMA_PROVIDER ?? 'anthropic') as SupportedProvider
const model = process.env.OMA_MODEL ?? 'claude-sonnet-4-6'

const imagePath = process.argv[2]
if (!imagePath) {
  throw new Error('Pass an image path: npx tsx packages/core/examples/basics/structured-input.ts ./photo.png')
}

const mediaTypes: Readonly<Record<string, string>> = {
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}
const mediaType = mediaTypes[extname(imagePath).toLowerCase()]
if (!mediaType) {
  throw new Error('Unsupported image extension. Use PNG, JPEG, GIF, or WebP.')
}

const imageData = (await readFile(imagePath)).toString('base64')
const messages: LLMMessage[] = [
  {
    role: 'user',
    content: [{ type: 'text', text: 'When I share an image, describe only visible facts.' }],
  },
  {
    role: 'assistant',
    content: [{ type: 'text', text: 'Understood.' }],
  },
  {
    role: 'user',
    content: [
      { type: 'text', text: 'Describe this image in three concise bullet points.' },
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: mediaType,
          data: imageData,
        },
      },
    ],
  },
]

const oma = new OpenMultiAgent({
  defaultProvider: provider,
  defaultModel: model,
})
const result = await oma.runAgent({ name: 'vision-assistant' }, messages)

if (!result.success) throw new Error(result.output)
console.log(result.output)

```

### Core Architecture Module: `packages/core/examples/basics/task-pipeline.ts`
```
/**
 * Explicit Task Pipeline with Dependencies
 *
 * Demonstrates how to define tasks with explicit dependency chains
 * (design → implement → test → review) using runTasks(). The TaskQueue
 * automatically blocks downstream tasks until their dependencies complete.
 * Prompt context is dependency-scoped by default: each task sees only its own
 * description plus direct dependency results (not unrelated team outputs).
 *
 * Run:
 *   npx tsx packages/core/examples/basics/task-pipeline.ts
 *
 * Prerequisites:
 *   ANTHROPIC_API_KEY env var must be set (default provider). To use any
 *   other built-in provider, set OMA_PROVIDER and OMA_MODEL plus that
 *   provider's key, for example:
 *     OMA_PROVIDER=deepseek OMA_MODEL=deepseek-flash DEEPSEEK_API_KEY=...
 *     OMA_PROVIDER=openai OMA_MODEL=gpt-5.4 OPENAI_API_KEY=...
 *   See docs/providers.md for the full provider and env var list.
 */

import { join } from 'node:path'
import { OpenMultiAgent, type SupportedProvider } from '../../src/index.js'
import type { AgentConfig, OrchestratorEvent, Task } from '../../src/types.js'

// Defaults to Claude. Any built-in provider works: set OMA_PROVIDER and
// OMA_MODEL plus that provider's API key (see docs/providers.md).
const provider = (process.env.OMA_PROVIDER ?? 'anthropic') as SupportedProvider
const model = process.env.OMA_MODEL ?? 'claude-sonnet-4-6'

// Built-in filesystem tools are sandboxed to `<cwd>/.agent-workspace` by
// default; pipeline output lives under that root so the demo runs without
// disabling the sandbox.
const OUTPUT_DIR = join(process.cwd(), '.agent-workspace', 'pipeline-output')
const SRC_DIR = join(OUTPUT_DIR, 'src')
const SPEC_FILE = join(OUTPUT_DIR, 'design-spec.md')

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------

const designer: AgentConfig = {
  name: 'designer',
  provider,
  model,
  systemPrompt: `You are a software designer. Your output is always a concise technical spec
in markdown. Focus on interfaces, data shapes, and file structure. Be brief.`,
  tools: ['file_write'],
  maxTurns: 4,
}

const implementer: AgentConfig = {
  name: 'implementer',
  provider,
  model,
  systemPrompt: `You are a TypeScript developer. Read the design spec written by the designer,
then implement it. Write all files to ${OUTPUT_DIR}/. Use the tools.`,
  tools: ['bash', 'file_read', 'file_write'],
  maxTurns: 10,
}

const tester: AgentConfig = {
  name: 'tester',
  provider,
  model,
  systemPrompt: `You are a QA engineer. Read the implemented files and run them to verify correctness.
Report: what passed, what failed, and any bugs found.`,
  tools: ['bash', 'file_read', 'grep'],
  maxTurns: 6,
}

const reviewer: AgentConfig = {
  name: 'reviewer',
  provider,
  model,
  systemPrompt: `You are a code reviewer. Read all files and produce a brief structured review.
Sections: Summary, Strengths, Issues (if any), Verdict (SHIP / NEEDS WORK).`,
  tools: ['file_read', 'grep'],
  maxTurns: 4,
}

// ---------------------------------------------------------------------------
// Progress handler — shows dependency blocking/unblocking
// ---------------------------------------------------------------------------

const taskTimes = new Map<string, number>()

function handleProgress(event: OrchestratorEvent): void {
  const ts = new Date().toISOString().slice(11, 23)

  switch (event.type) {
    case 'task_start': {
      taskTimes.set(event.task ?? '', Date.now())
      const task = event.data as Task | undefined
      console.log(`[${ts}] TASK READY    "${task?.title ?? event.task}" (assignee: ${task?.assignee ?? 'any'})`)
      break
    }
    case 'task_complete': {
      const elapsed = Date.now() - (taskTimes.get(event.task ?? '') ?? Date.now())
      const task = event.data as Task | undefined
      console.log(`[${ts}] TASK DONE     "${task?.title ?? event.task}" in ${elapsed}ms`)
      break
    }
    case 'agent_start':
      console.log(`[${ts}] AGENT START   ${event.agent}`)
      break
    case 'agent_complete':
      console.log(`[${ts}] AGENT DONE    ${event.agent}`)
      break
    case 'error': {
      const task = event.data as Task | undefined
      console.error(`[${ts}] ERROR         ${event.agent ?? ''}  task="${task?.title ?? event.task}"`)
      break
    }
  }
}

// ---------------------------------------------------------------------------
// Build the pipeline
// ---------------------------------------------------------------------------

const orchestrator = new OpenMultiAgent({
  defaultProvider: provider,
  defaultModel: model,
  maxConcurrency: 2, // allow test + review to potentially run in parallel later
  onProgress: handleProgress,
})

const team = orchestrator.createTeam('pipeline-team', {
  name: 'pipeline-team',
  agents: [designer, implementer, tester, reviewer],
  sharedMemory: true,
})

// Task IDs — use stable strings so dependsOn can reference them
// (IDs will be generated by the framework; we capture the returned Task objects)

const tasks: Array<{
  title: string
  description: string
  assignee?: string
  dependsOn?: string[]
  memoryScope?: 'dependencies' | 'all'
}> = [
  {
    title: 'Design: URL shortener data model',
    description: `Design a minimal in-memory URL shortener service.
Write a markdown spec to ${SPEC_FILE} covering:
- TypeScript interfaces for Url and ShortenRequest
- The shortening algorithm (hash approach is fine)
- API contract: POST /shorten, GET /:code
Keep the spec under 30 lines.`,
    assignee: 'designer',
    // no dependencies — this is the root task
  },
  {
    title: 'Implement: URL shortener',
    description: `Read the design spec at ${SPEC_FILE}.
Implement the URL shortener in ${SRC_DIR}/:
- shortener.ts: core logic (shorten, resolve functions)
- server.ts: tiny HTTP server using Node's built-in http module (no Express)
  - POST /shorten  body: { url: string } → { code: string, short: string }
  - GET  /:code    → redirect (301) or 404
- index.ts: entry point that starts the server on port 3002
No external dependencies beyond Node built-ins.`,
    assignee: 'implementer',
    dependsOn: ['Design: URL shortener data model'],
  },
  {
    title: 'Test: URL shortener',
    description: `Run the URL shortener implementation:
1. Start the server: node ${SRC_DIR}/index.ts (or tsx)
2. POST a URL to shorten it using curl
3. Verify the GET redirect works
4. Report what passed and what (if anything) failed.
Kill the server after testing.`,
    assignee: 'tester',
    dependsOn: ['Implement: URL shortener'],
  },
  {
    title: 'Review: URL shortener',
    description: `Read all .ts files in ${SRC_DIR}/ and the design spec.
Produce a structured code review with sections:
- Summary (2 sentences)
- Strengths (bullet list)
- Issues (bullet list, or "None" if clean)
- Verdict: SHIP or NEEDS WORK`,
    assignee: 'reviewer',
    dependsOn: ['Implement: URL shortener'], // runs in parallel with Test after Implement completes
    // Optional override: reviewers can opt into full shared memory when needed.
    // Remove this line to keep strict dependency-only context.
    memoryScope: 'all',
  },
]

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

console.log('Starting 4-stage task pipeline...\n')
console.log('Pipeline: design → implement → test + review (parallel)')
console.log('='.repeat(60))

const result = await orchestrator.runTasks(team, tasks)

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log('\n' + '='.repeat(60))
console.log('Pipeline complete.\n')
console.log(`Overall success: ${result.success}`)
console.log(`Tokens — input: ${result.totalTokenUsage.input_tokens}, output: ${result.totalTokenUsage.output_tokens}`)

cons
```

### Core Architecture Module: `packages/core/examples/basics/team-collaboration.ts`
```
/**
 * Multi-Agent Team Collaboration
 *
 * Three specialised agents (architect, developer, reviewer) collaborate on a
 * shared goal. The OpenMultiAgent orchestrator breaks the goal into tasks, assigns
 * them to the right agents, and collects the results.
 *
 * Run:
 *   npx tsx packages/core/examples/basics/team-collaboration.ts
 *
 * Prerequisites:
 *   OPENAI_API_KEY env var must be set. Works with any OpenAI-compatible
 *   provider: set OPENAI_BASE_URL + OMA_MODEL for Groq, DeepSeek, Ollama, etc.
 */

import { join } from 'node:path'
import { OpenMultiAgent } from '../../src/index.js'
import type { AgentConfig, OrchestratorEvent } from '../../src/types.js'

// Works with any OpenAI-compatible provider. Set OPENAI_API_KEY for OpenAI, or
// OPENAI_BASE_URL + OMA_MODEL for Groq, DeepSeek, Ollama, etc.
const model = process.env.OMA_MODEL ?? 'gpt-5.4'

// Built-in filesystem tools are sandboxed to `<cwd>/.agent-workspace` by
// default; the generated API lives under that root so the demo runs
// without disabling the sandbox.
const OUTPUT_DIR = join(process.cwd(), '.agent-workspace', 'express-api')

// ---------------------------------------------------------------------------
// Agent definitions
// ---------------------------------------------------------------------------

const architect: AgentConfig = {
  name: 'architect',
  model,
  systemPrompt: `You are a software architect with deep experience in Node.js and REST API design.
Your job is to design clear, production-quality API contracts and file/directory structures.
Output concise plans in markdown — no unnecessary prose.`,
  tools: ['bash', 'file_write'],
  maxTurns: 5,
  temperature: 0.2,
}

const developer: AgentConfig = {
  name: 'developer',
  model,
  systemPrompt: `You are a TypeScript/Node.js developer. You implement what the architect specifies.
Write clean, runnable code with proper error handling. Use the tools to write files and run tests.`,
  tools: ['bash', 'file_read', 'file_write', 'file_edit'],
  maxTurns: 12,
  temperature: 0.1,
}

const reviewer: AgentConfig = {
  name: 'reviewer',
  model,
  systemPrompt: `You are a senior code reviewer. Review code for correctness, security, and clarity.
Provide a structured review with: LGTM items, suggestions, and any blocking issues.
Read files using the tools before reviewing.`,
  tools: ['bash', 'file_read', 'grep'],
  maxTurns: 5,
  temperature: 0.3,
}

// ---------------------------------------------------------------------------
// Progress tracking
// ---------------------------------------------------------------------------

const startTimes = new Map<string, number>()

function handleProgress(event: OrchestratorEvent): void {
  const ts = new Date().toISOString().slice(11, 23) // HH:MM:SS.mmm

  switch (event.type) {
    case 'agent_start':
      startTimes.set(event.agent ?? '', Date.now())
      console.log(`[${ts}] AGENT START  → ${event.agent}`)
      break

    case 'agent_complete': {
      const elapsed = Date.now() - (startTimes.get(event.agent ?? '') ?? Date.now())
      console.log(`[${ts}] AGENT DONE   ← ${event.agent} (${elapsed}ms)`)
      break
    }

    case 'task_start':
      console.log(`[${ts}] TASK START   ↓ ${event.task}`)
      break

    case 'task_complete':
      console.log(`[${ts}] TASK DONE    ↑ ${event.task}`)
      break

    case 'message':
      console.log(`[${ts}] MESSAGE      • ${event.agent} → (team)`)
      break

    case 'error':
      console.error(`[${ts}] ERROR        ✗ agent=${event.agent} task=${event.task}`)
      if (event.data instanceof Error) {
        console.error(`               ${event.data.message}`)
      }
      break
  }
}

// ---------------------------------------------------------------------------
// Orchestrate
// ---------------------------------------------------------------------------

const orchestrator = new OpenMultiAgent({
  defaultProvider: 'openai',
  defaultModel: model,
  defaultBaseURL: process.env.OPENAI_BASE_URL, // unset = OpenAI
  maxConcurrency: 1, // run agents sequentially so output is readable
  onProgress: handleProgress,
})

const team = orchestrator.createTeam('api-team', {
  name: 'api-team',
  agents: [architect, developer, reviewer],
  sharedMemory: true,
  maxConcurrency: 1,
})

console.log(`Team "${team.name}" created with agents: ${team.getAgents().map(a => a.name).join(', ')}`)
console.log('\nStarting team run...\n')
console.log('='.repeat(60))

const goal = `Create a minimal Express.js REST API in ${OUTPUT_DIR}/ with:
- GET  /health       → { status: "ok" }
- GET  /users        → returns a hardcoded array of 2 user objects
- POST /users        → accepts { name, email } body, logs it, returns 201
- Proper error handling middleware
- The server should listen on port 3001
- Include a package.json with the required dependencies`

const result = await orchestrator.runTeam(team, goal)

console.log('\n' + '='.repeat(60))

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

console.log('\nTeam run complete.')
console.log(`Success: ${result.success}`)
console.log(`Total tokens — input: ${result.totalTokenUsage.input_tokens}, output: ${result.totalTokenUsage.output_tokens}`)

console.log('\nPer-agent results:')
for (const [agentName, agentResult] of result.agentResults) {
  const status = agentResult.success ? 'OK' : 'FAILED'
  const tools = agentResult.toolCalls.length
  console.log(`  ${agentName.padEnd(12)} [${status}]  tool_calls=${tools}`)
  if (!agentResult.success) {
    console.log(`    Error: ${agentResult.output.slice(0, 120)}`)
  }
}

// Print the developer's final output (the actual code) as a sample
const developerResult = result.agentResults.get('developer')
if (developerResult?.success) {
  console.log('\nDeveloper output (last 600 chars):')
  console.log('─'.repeat(60))
  const out = developerResult.output
  console.log(out.length > 600 ? '...' + out.slice(-600) : out)
  console.log('─'.repeat(60))
}

// Print the reviewer's findings
const reviewerResult = result.agentResults.get('reviewer')
if (reviewerResult?.success) {
  console.log('\nReviewer output:')
  console.log('─'.repeat(60))
  console.log(reviewerResult.output)
  console.log('─'.repeat(60))
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #535** (2026-08-20): **[Bug] Accepted verify revision leaves stale structured output**
  *Symptoms*: ## Describe the bug  When a per-task `verify` hook accepts a revised answer, the task's text `output` is replaced but `AgentRunResult.structured` still contains the original pre-revision value.  This makes the two representations disagree and causes downstream tasks using `dependencyPayload: 'structured'` to receive stale data.  ## To Reproduce  1. Configure a worker with an `outputSchema`. 2. Run a task through `runTasks()` with `verify: { onDissent: 'revise', maxRounds: 2, ... }`. 3. Have the worker initially return `{"decision":"accept"}`. 4. Have the judge dissent, then have the worker revise to `{"decision":"quarantine"}` and the judge accept. 5. Inspect the completed task result or a dependent task using `dependencyPayload: 'structured'`.  ## Current behavior  The completed task contains:  - `output === '{"decision":"quarantine"}'` - `structured === { decision: 'accept' }`  A dependent task receives the stale `accept` value.  ## Expected behavior  An accepted revision should replace the text and parsed representations atomically:  - `output === '{"decision":"quarantine"}'` - `structured === { decision: 'quarantine' }`  A rejected revision should continue to preserve the original pair.  ## Acceptance criteria  - An accepted verify revision updates both `output` and `structured`. - A downstream task using `dependencyPayload: 'structured'` receives the revised structured value. - Existing rejected-revision behavior remains unchanged. - `npm test -w @open-multi-agent/core -

- **Issue #488** (2026-08-11): **[Bug] Isolate create-oma-app runtime tests from ambient OMA_MODEL**
  *Symptoms*: ## Describe the bug  `packages/create-oma-app/tests/runtime.test.ts` restores selected environment variables in `afterEach`, but it does not clear an existing `OMA_MODEL` before each test. If the parent shell already defines `OMA_MODEL`, the Ollama fallback/error cases read that ambient value and fail for reasons unrelated to the behavior they are testing.  This is a test-isolation bug; the generated runtime behavior itself is not the problem.  ## To Reproduce  From repository `main` at `2f1198f`:  ```bash npm ci env OMA_MODEL=ambient-model npm run test -w create-oma-app -- runtime.test.ts ```  Current result: 2 failed, 1 passed.  ```text Expected model: first-model Received model: ambient-model  The empty-model-list case resolves with ambient-model instead of rejecting. ```  For comparison, the same focused test command without an ambient `OMA_MODEL` passes all 3 tests.  ## Expected behavior  `runtime.test.ts` should fully control the environment it relies on, so the focused suite passes regardless of whether the invoking shell defines `OMA_MODEL`.  ## Acceptance criteria  - The runtime tests explicitly isolate `OMA_MODEL` before each relevant test while preserving/restoring the caller's original environment after the test. - `env OMA_MODEL=ambient-model npm run test -w create-oma-app -- runtime.test.ts` passes all 3 tests. - `npm run test -w create-oma-app -- runtime.test.ts` continues to pass.  ## Target paths  - `packages/create-oma-app/tests/runtime.test.ts`  ## Out of s
  **Post-Mortem & Fix Analysis**:
  > <!-- oma-maintainer-bot-status:v2 {"version":2,"repository":"open-multi-agent/open-multi-agent","issueNumber":488,"status":"STARTED","claimId":"31464018202.1","actionsRunId":31464018202,"runUrl":"https://github.com/open-multi-agent/open-multi-agent/actions/runs/31464018202","baseSha":"694f8a7dc73c6adf9a110a88f2e573476f4c3285","issueRevision":null,"runKey":null,"branch":null,"pullRequestUrl":null,"updatedAt":"2026-08-11T06:08:29.860Z","claims":[]} --> ## OMA Maintainer Bot — STARTED  - Actions run: [31464018202](https://github.com/open-multi-agent/open-multi-agent/actions/runs/31464018202) - Base SHA: `694f8a7dc73c6adf9a110a88f2e573476f4c3285` - Issue revision: `pending`  The dedicated GitHub App token, identity, permission request, and repository scope passed preflight. Deterministic authorization, revision, scope, duplicate, and readiness checks are starting.  _This bot creates Draft PRs only. It never approves, merges, closes, releases, publishes, tags, or deploys._ 
  > <!-- oma-maintainer-bot-bootstrap-status:v1 {"version":1,"repository":"open-multi-agent/open-multi-agent","issueNumber":488,"status":"NEEDS_HUMAN","actionsRunId":31464018202,"runUrl":"https://github.com/open-multi-agent/open-multi-agent/actions/runs/31464018202","baseSha":"694f8a7dc73c6adf9a110a88f2e573476f4c3285","updatedAt":"2026-08-11T06:08:31.804Z"} --> ## OMA Maintainer Bot — NEEDS_HUMAN  - Actions run: [31464018202](https://github.com/open-multi-agent/open-multi-agent/actions/runs/31464018202) - Base SHA: `694f8a7dc73c6adf9a110a88f2e573476f4c3285` - Issue revision: `not resolved`  The dedicated Maintainer Bot GitHub App is disabled, missing required configuration, not installed with the requested permissions, or failed identity/scope preflight. No model or writer process ran.  _This bootstrap status has no durable run claim and cannot authorize a model run or Draft PR. Any earlier App-authenticated claim remains authoritative until a verified App run resolves it._ 

- **Issue #387** (2026-07-17): **fix(process): clean descendant group when direct child exits before stream break**
  *Symptoms*: ## Context  Follow-up from #378. The merged process backend cleans up the process group on abort and when a consumer stops reading an active stream. One lifecycle edge remains: if the direct child exits before the consumer breaks out of `stream()`, but a descendant in the detached process group remains alive, the finalizer can skip group cleanup because the direct child has already exited.  This is a non-blocking follow-up for the v1.11.0 release, as recorded in the maintainer review on #378.  ## Expected behavior  Breaking or closing the async stream must terminate and reap the entire spawned process group, even when the direct child has already exited and descendants remain alive.  ## Acceptance criteria  - Add a regression fixture where the direct child exits before the consumer breaks while a descendant stays alive. - Confirm stream finalization terminates the remaining process group on supported POSIX platforms. - Preserve the existing Windows fallback behavior. - Keep abort and early-stream-exit lifecycle tests green. - Document any unavoidable platform limitations.

- **Issue #216** (2026-05-11): **[Bug] `maxTokenBudget` break leaves orphaned `tool_use` block in returned messages**
  *Symptoms*: ## Summary  When `maxTokenBudget` is exceeded on a turn where the LLM requested a tool call,`AgentRunner` pushes the assistant message (which contains `tool_use` blocks) into`conversationMessages` and then immediately `break`s — before tool execution and before the matching `tool_result` user message is appended. The returned `result.messages` ends with an assistant turn that has an unmatched `tool_use` block.  The Anthropic and OpenAI APIs both reject this shape with a `400 Bad Request` if the caller tries to resume the conversation. (Actually `runner.ts: 1007-1010` mentions that. ) Because `agent.prompt()` appends `result.messages` to its persistent `messageHistory`, **every subsequent `prompt()` call after a budget-exceeded turn will throw a 400** when the model happened to request a tool on that turn.  ## Reproducer  `repro-budget-orphan.mjs` at https://github.com/CodingBangboo/open-multi-agent/tree/token_budget_early_break_orphan  Run with: ```bash ANTHROPIC_API_KEY=<your-key>  node repro-budget-orphan.mjs ``` === Phase 1: Budget exceeded — orphan produced === budgetExceeded: true   messages[0]: role=assistant  blocks=[text, tool_use]  === Phase 2: Resuming conversation via real Anthropic API === HTTP status : 400 Error type  : invalid_request_error Message     : tool_use block at index 1 requires a matching tool_result block  ## Root Cause  | Location | Fires | Used for | |---|---|---| | `runner.ts:798–811` | After assistant message pushed, **before** tool execution | R
  **Post-Mortem & Fix Analysis**:
  > Nice find. PR when you're ready

- **Issue #152** (2026-04-23): **[Bug] Context Compaction Strategy Fails to Persist Across Turns**
  *Symptoms*: ## Description The `contextStrategy` implementation inside `AgentRunner.stream()` currently compacts the conversation history internally but fails to return the compacted history back to the caller. The `RunResult` currently only returns `messages` (the new messages generated during the run), resulting in the caller retaining the original, uncompacted history payload and causing potential OOM/Token Budget exhaustion.  Additionally, the context compaction logic is currently skipped on the initial turn (`turns > 1`), meaning an initial prompt that exceeds the maximum token limit will not trigger the compaction strategy and will instead crash or trigger a `TokenBudgetExceededError`.  ## Reproduction Steps 1. Configure an `AgentRunner` with a `contextStrategy` (e.g., `'summarize'`) that triggers at 50,000 tokens. 2. Initialize an agent run using a `messageHistory` array containing > 50,000 tokens. 3. Observe that on the initial turn (`turns === 1`), the history is not compacted, triggering an immediate budget error or context overflow. 4. Bypass the first-turn restriction by forcing a multi-turn run. Observe that `AgentRunner` successfully compacts the history internally and generates a summarized prompt. 5. Review the resulting `RunResult.messages`. The `messages` array only contains the new turns, and the compacted history is discarded. 6. The caller appends the new `RunResult.messages` to its ongoing `history` array, meaning the old context was never actually removed.  ## Expe
  **Post-Mortem & Fix Analysis**:
  > Confirmed. Minor nit: oversized first-turn payloads fail in the LLM adapter with a provider context-length error, not `TokenBudgetExceededError` (that one tracks cumulative input+output, not single-request size). The first-turn skip is still the real problem.  Related bug worth flagging: `messages: conversationMessages.slice(initialMessages.length)` at the end of `stream()` assumes the first N entries are still the original seed. True for `compact` (same count, different block contents), but `summarize`/`sliding-window`/`custom` replace `conversationMessages` wholesale and can return fewer items than `initialMessages.length`. When that happens the slice returns an empty or truncated delta and `Agent.prompt()` silently drops the new assistant/tool turns. Existing tests use single-message seeds so this path isn't covered.  I'd fix both by accumulating a `newMessages: LLMMessage[]` in `stream()` as turns are appended and returning that directly, and dropping the `turns > 1` gate since eve
  > Btw Mark, circling back late on this.  I'm going through past contributions to understand what people are actually using OMA for.  Your compaction bug stood out because it only surfaces under real multi-turn loops. Would be useful to hear what you're building, if you're open to sharing.
  > > Btw Mark, circling back late on this. >  > I'm going through past contributions to understand what people are actually using OMA for. Your compaction bug stood out because it only surfaces under real multi-turn loops. Would be useful to hear what you're building, if you're open to sharing.  Hey Jack,  Thanks for reaching out!   To answer your question, I'm using open-multi-agent as the core orchestrator for a “Sovereign Engine”—a local-first AI entity I'm building. I've been stress-testing it on dual P100s (32GB VRAM) to replicate a "Coordinator -> Worker" pattern locally using the Qwopus 27B model (among many others)l. It's been wild seeing how fast you reversed that DAG architecture. I also do testing and experimentation on my RX 9070XT 16GB. I’ve also toyed with pinning tiny models to L3 cache on my 5700X3D chip. I basically play with AI all day and research, experiment, etc...  Recent MTP Testing:  Qwen 3.6 supports MTP speculative decoding (still don’t fully understand it). Your

- **Issue #101** (2026-04-12): **[P1] Gemini adapter ignores AbortSignal — API calls cannot be cancelled**
  *Symptoms*: ## Problem  The Gemini LLM adapter (`src/llm/gemini.ts`) does not pass `options.abortSignal` to the underlying `@google/genai` SDK calls in either `chat()` or `stream()`:  ```typescript // src/llm/gemini.ts:275 async chat(messages, options): Promise<LLMResponse> {   const response = await this.#client.models.generateContent({     model: options.model,     contents,     config: buildConfig(options),  // ← abortSignal not included   })   // ... }  // src/llm/gemini.ts:313 const streamResponse = await this.#client.models.generateContentStream({   model: options.model,   contents,   config: buildConfig(options),  // ← abortSignal not included }) ```  `buildConfig()` does not forward `options.abortSignal` to the SDK config object.  ## Impact  When a Gemini-based agent is aborted (via `AbortController`, orchestrator cancellation, or `timeoutMs`):  1. The **AgentRunner loop** stops checking for new turns (correct) 2. But the **in-flight Gemini API call** continues to completion — it cannot be cancelled 3. Users pay for tokens on a run that has already been cancelled 4. Long Gemini responses (e.g. long document generation) block the Node event loop even after cancellation  The Anthropic and OpenAI adapters both support `AbortSignal` natively (Anthropic via SDK `signal` option, OpenAI via `options.signal`). Gemini should be consistent.  ## Fix  Pass the abort signal to the Gemini SDK's `httpOptions`:  ```typescript async chat(messages, options): Promise<LLMResponse> {   const response

- **Issue #100** (2026-04-12): **[P1] Abort path in executeQueue leaves 'blocked' tasks non-terminal, skips event emission**
  *Symptoms*: ## Problem  When `ctx.abortSignal` fires inside `executeQueue`, the cancellation handler only transitions `'pending'` tasks and uses `queue.update()` (which bypasses event emission) instead of `queue.skip()`:  ```typescript // src/orchestrator/orchestrator.ts:435-441 if (ctx.abortSignal?.aborted) {   for (const t of queue.getByStatus('pending')) {     queue.update(t.id, { status: 'skipped' as TaskStatus })  // ← update(), not skip()   }   break } ```  ## Three bugs in this code path  ### 1. `'blocked'` tasks are never transitioned Tasks waiting for a now-skipped dependency remain in `'blocked'` state indefinitely. After `runTasks()` / `runTeam()` returns, `queue.getByStatus('blocked')` is non-empty even though the run is complete.  ### 2. `task:skipped` events are not emitted `queue.update()` mutates state but fires no events. `queue.skip()` emits `'task:skipped'`, which `executeQueue` relays to `config.onProgress` as `{ type: 'task_skipped' }`. Callers using `onProgress` receive **no notification** about skipped tasks on abort.  ### 3. `all:complete` never fires if blocked tasks remain `queue.isComplete()` returns `false` while any task is in a non-terminal state. With blocked tasks remaining, `'all:complete'` is never emitted. Any listener waiting on this event hangs.  ## Fix  Replace the abort handler with `queue.skipRemaining()`, which handles all three problems:  ```typescript if (ctx.abortSignal?.aborted) {   queue.skipRemaining('Skipped: run aborted.')   break } ```  `

- **Issue #99** (2026-04-12): **[P1] Per-call abortSignal not propagated to tool execution — bash/file tools ignore cancellation**
  *Symptoms*: ## Problem  `AgentRunner.stream()` correctly computes an `effectiveAbortSignal` that merges the static runner signal with the per-call `RunOptions.abortSignal`. This signal is used for LLM calls and the loop guard. However, `buildToolContext()` always uses only the **static** `this.options.abortSignal`, ignoring the per-call signal entirely.  ```typescript // src/agent/runner.ts:528-529 const effectiveAbortSignal = options.abortSignal ?? this.options.abortSignal //                            ^^^^^^^^^^^^^^^^^^^^ per-call signal included  // src/agent/runner.ts:846-855 private buildToolContext(): ToolUseContext {   return {     agent: { ... },     abortSignal: this.options.abortSignal,   // ← static only, misses per-call signal   } } ```  The orchestrator passes `abortSignal` as a **per-call** `RunOptions` value (not as a static `RunnerOptions`), so `this.options.abortSignal` is always `undefined` in practice.  ## Impact  When the orchestrator cancels a run via `ctx.abortSignal`, the LLM call is cancelled (correct), but any **in-flight tool executions** continue running to completion:  - **`bash` tool**: shell subprocess is NOT killed — long-running commands keep running - **`file_write` / `file_edit` tools**: file I/O continues uninterrupted - **`file_read` tool**: reads continue after the caller has moved on  This leads to **resource leaks**, **stale writes** to the filesystem after a cancelled run, and **delayed response** to cancellation signals.  ## Affected Code  - `src/

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

### Incident Patch 1: `2f1d0ff5` (2026-09-23)
**Commit Message**: fix(core): support adaptive thinking on current Claude models (#609)

The Anthropic adapter now sends adaptive thinking when thinking is enabled without budgetTokens, except on models from before adaptive thinking, which keep the 1024-token default budget; Claude Opus 4.7, Sonnet 5, and later reject budget_tokens with HTTP 400. The task profiler omits temperature only for Claude models that reject non-default sampling parameters, and the cost-tiered pipeline example drops the temperatures that broke its Opus 4.7 path. Built-in tool descriptions now state the sandbox boundary and match glob's path output, the coordinator prompt reused for synthesis no longer carries an unscoped JSON-only instruction, and the structured-output instruction states its requirement once.

**File**: `docs/providers.md` (modified, +1/-1)
```diff
@@ -263,7 +263,7 @@ const agent = {
 }
 ```
 
-- `budgetTokens` maps to Anthropic `thinking.budget_tokens` and Gemini `thinkingConfig.thinkingBudget`.
+- `budgetTokens` maps to Anthropic `thinking.budget_tokens` and Gemini `thinkingConfig.thinkingBudget`. Claude Opus 4.7, Sonnet 5, and later models reject `budget_tokens`; omit `budgetTokens` and the Anthropic adapter sends adaptive thinking instead. Models from before adaptive thinking (Sonnet 3.7 through the 4.5 generation) still receive a 1024-token default budget.
 - `effort` (`'low' | 'medium' | 'high'`) maps to OpenAI-compatible `reasoning_effort`. Values outside the framework union (such as `'minimal'` or `'none'`) can be passed via `extraBody: { reasoning_effort: '<value>' }`.
 - DeepSeek additionally maps `enabled` to `thinking: { type: 'enabled' | 'disabled' }` and accepts `effort: 'max'`. DeepSeek V4 enables thinking by default at `high` effort when no framework-level thinking config is supplied. Other built-in OpenAI-family adapters ignore the DeepSeek-only `max` value. Explicit `extraBody` values take precedence.
 - Adapters ignore fields they don't recognise, so one config is safe across a mixed-provider team.
```

**File**: `packages/core/examples/patterns/cost-tiered-pipeline.ts` (modified, +0/-4)
```diff
@@ -279,28 +279,24 @@ function createAgents(assignments: PipelineAssignments): AgentConfig[] {
       ...assignments.researcher,
       systemPrompt: RESEARCHER_PROMPT,
       maxTurns: 2,
-      temperature: 0.2,
     },
     {
       name: 'classifier',
       ...assignments.classifier,
       systemPrompt: CLASSIFIER_PROMPT,
       maxTurns: 2,
-      temperature: 0.2,
     },
     {
       name: 'drafter',
       ...assignments.drafter,
       systemPrompt: DRAFTER_PROMPT,
       maxTurns: 2,
-      temperature: 0.3,
     },
     {
       name: 'reviewer',
       ...assignments.reviewer,
       systemPrompt: REVIEWER_PROMPT,
       maxTurns: 2,
-      temperature: 0.2,
     },
   ]
 }
```

**File**: `packages/core/src/agent/structured-output.ts` (modified, +1/-3)
```diff
@@ -23,9 +23,7 @@ export function buildStructuredOutputInstruction(schema: ZodSchema): string {
   return [
     '',
     '## Output Format (REQUIRED)',
-    'You MUST respond with ONLY valid JSON that conforms to the following JSON Schema.',
-    'Do NOT include any text, markdown fences, or explanation outside the JSON object.',
-    'Do NOT wrap the JSON in ```json code fences.',
+    'Respond with only valid JSON that conforms to the following JSON Schema, with no text or code fence around it.',
     '',
     '```',
     JSON.stringify(jsonSchema, null, 2),
```

**File**: `packages/core/src/llm/anthropic-models.ts` (added, +29/-0)
```diff
@@ -0,0 +1,29 @@
+/**
+ * @fileoverview Claude model-generation checks shared by the Anthropic adapter
+ * and framework-internal calls. Kept free of the SDK import so callers outside
+ * the adapter do not load it.
+ *
+ * Both lists are closed: they name model generations that will not grow, so a
+ * model ID they do not recognise is treated as current.
+ */
+
+/** Models from before adaptive thinking (Sonnet 3.7 through the 4.5 generation). */
+const BUDGET_ONLY_THINKING_MODEL =
+  /^claude-(?:3-7-sonnet|sonnet-4(?:-0|-5)?|opus-4(?:-0|-1|-5)?|haiku-4-5)(?:-\d{8}|-latest)?$/
+
+/** Models up to the 4.6 generation, which still accept non-default sampling parameters. */
+const SAMPLING_MODEL =
+  /^claude-(?:3-|(?:sonnet|opus|haiku)-4(?:-[0-6])?(?:-\d{8}|-latest)?$)/
+
+/** True when the model only accepts `thinking: {type: 'enabled', budget_tokens}`. */
+export function requiresBudgetThinking(model: string): boolean {
+  return BUDGET_ONLY_THINKING_MODEL.test(model)
+}
+
+/**
+ * True when the model accepts a non-default `temperature`, `top_p`, or
+ * `top_k`. Claude Opus 4.7, Sonnet 5, and later reject them with HTTP 400.
+ */
+export function acceptsSamplingParams(model: string): boolean {
+  return SAMPLING_MODEL.test(model)
+}
```

**File**: `packages/core/src/llm/anthropic.ts` (modified, +15/-12)
```diff
@@ -62,6 +62,7 @@ import {
   resolveReasoningOutboundMaxChars,
   type ReasoningOutboundOptions,
 } from './reasoning-fallback.js'
+import { requiresBudgetThinking } from './anthropic-models.js'
 import { assertValidMessages } from './validate.js'
 import { createEgressFetch } from './egress.js'
 import { UnsupportedContentBlockError, UnsupportedToolResultContentError } from '../errors.js'
@@ -342,15 +343,13 @@ function fromAnthropicContentBlock(
  *      value less than max_tokens"). Throws early with a clear message
  *      rather than letting Anthropic return a 400.
  *
- * Defaults `budgetTokens` to 1024 when enabled without an explicit value;
- * combined with the second constraint, this means a caller passing
- * `thinking.enabled = true` MUST also set `maxTokens > 1024`.
- *
- * Model compatibility: emits `{type: 'enabled', budget_tokens}` which is
- * supported by Claude Sonnet 3.7 and all Claude 4.x models up to and
- * including 4.6 (deprecated on 4.6 in favor of `adaptive`). Claude Opus 4.7+
- * accepts only `{type: 'adaptive'}` and rejects this shape with HTTP 400.
- * Adaptive thinking support is tracked as a follow-up to RFC #200's phase 1.
+ * Model compatibility: an explicit `budgetTokens` always emits
+ * `{type: 'enabled', budget_tokens}`, which Claude Opus 4.7+, Sonnet 5, and
+ * later reject with HTTP 400. Without `budgetTokens`, models that predate
+ * adaptive thinking (Sonnet 3.7 through the 4.5 generation) get a 1024-token
+ * budget, so a caller enabling thinking on them must set `maxTokens > 1024`;
+ * every other model gets `{type: 'adaptive'}`. The legacy list is closed, so
+ * new model IDs default to adaptive.
  *
  * The `interleaved-thinking-2025-05-14` beta header (which would relax the
  * `budget_tokens < max_tokens` rule for Claude 4.x manual mode) is not yet
@@ -359,8 +358,12 @@ function fromAnthropicContentBlock(
 function toAnthropicThinkingParam(
   thinking: ThinkingConfig | undefined,
   maxTokens: number,
-): ThinkingConfigParam | undefined {
+  model: string,
+): ThinkingConfigParam | { type: 'adaptive' } | undefined {
   if (thinking === undefined || !thinking.enabled) return undefined
+  if (thinking.budgetTokens === undefined && !requiresBudgetThinking(model)) {
+    return { type: 'adaptive' }
+  }
   const budget = thinking.budgetTokens ?? 1024
   if (budget < 1024) {
     throw new Error(
@@ -440,7 +443,7 @@ export class AnthropicAdapter implements LLMAdapter {
         messages: anthropicMessages,
         system: options.systemPrompt,
         tools: options.tools ? toAnthropicTools(options.tools) : undefined,
-        thinking: toAnthropicThinkingParam(options.thinking, effectiveMaxTokens),
+        thinking: toAnthropicThinkingParam(options.thinking, effectiveMaxTokens, options.model),
         // Cast covers arbitrary `extraBody` keys not declared by the SDK.
       } as MessageCreateParamsNonStreaming,
       {
@@ -499,7 +502,7 @@ export class AnthropicAdapter implements LLMAdapter {
         messages: anthropicMessages,
         system: options.systemPrompt,
         tools: options.tools ? toAnthropicTools(options.tools) : undefined,
-        thinking: toAnthropicThinkingParam(options.thinking, effectiveMaxTokens),
+        thinking: toAnthropicThinkingParam(options.thinking, effectiveMaxTokens, options.model),
       } as MessageStreamParams,
       {
         signal: options.abortSignal,
```

---

### Incident Patch 2: `b67fd39f` (2026-09-14)
**Commit Message**: docs: document the minSamples regression skip (#606)

The baseline section of docs/evaluation-ci.md enumerates every condition
that makes a regression comparison warn and skip, and it was missing the
one a threshold introduces: when it sets `minSamples` and either the
current or the baseline aggregate is short, the comparison does not run.
Record that condition and the consequence a gate author has to plan for,
namely that a short baseline now yields a warning where it previously
yielded a `regression` failure, so the guard loosens one check while it
tightens another.

Record the guard and `passSampleCount` in the changelog, set `minSamples`
on the runnable offline-regression example so the option appears where a
gate is actually configured, and credit the contributor.

Follow-up to #602.

**File**: `CHANGELOG.md` (modified, +20/-0)
```diff
@@ -2,6 +2,26 @@
 
 ## Unreleased
 
+### Added
+
+- Added an optional positive-integer `GateThreshold.minSamples` so an
+  evaluation gate only accepts a threshold result that is backed by enough
+  evidence. Score metrics compare it against the selected aggregate's
+  `scoredCount` and `passRate` compares it against `passSampleCount`.
+  Tag-scoped thresholds use the tag aggregate's own counts. A count below the
+  minimum reports the new `insufficient_samples` failure kind carrying the
+  observed count and the configured limit, and a report written before
+  `passSampleCount` existed fails closed at zero rather than skipping the
+  guard. Baseline regression checks honor the same minimum: when either side
+  holds fewer samples, that comparison is skipped with a warning, so adding
+  `minSamples` turns a regression failure computed against a small baseline
+  into a warning. Omitting `minSamples` preserves the previous behavior and the
+  report schema version is unchanged.
+- Added `ScorerAggregate.passSampleCount`, the count of scored records that
+  define `pass`. It is emitted whenever `passRate` is, including on tag
+  aggregates, and gives `passRate` guards the denominator that `scoredCount`
+  does not provide.
+
 ## 1.19.0 - 2026-09-11
 
 ### Added
```

**File**: `CONTRIBUTORS.md` (modified, +1/-0)
```diff
@@ -28,6 +28,7 @@ Opening your first PR gets you added here. See the [contribution guide](.github/
 - [@LambIessz](https://github.com/LambIessz) (orchestrator cost budget, MessageBus persistence in checkpoints, retryable route fallback)
 - [@Bobuyoucrypto](https://github.com/Bobuyoucrypto) (Windows bash timeout process-tree kill)
 - [@green3sf](https://github.com/green3sf) (structured output refresh after an accepted verify revision)
+- [@Zhongghaoming](https://github.com/Zhongghaoming) (evaluation gate minimum-samples guard)
 
 ## Provider integrations
 
```

**File**: `docs/evaluation-ci.md` (modified, +10/-0)
```diff
@@ -123,6 +123,16 @@ does not produce a comparable score. Threshold and health checks still run.
 If baseline rules are configured but no baseline report is supplied, OMA warns
 and skips regression checks.
 
+A threshold that sets `minSamples` applies it to the regression comparison as
+well. When either the current or the baseline aggregate holds fewer samples
+than the minimum, OMA warns and skips that comparison instead of reporting a
+regression computed from a sample set the gate already called too small to
+judge. This loosens one check while it tightens another: a short baseline that
+previously produced a `regression` failure now produces only a warning, while a
+short current report still fails its own threshold with `insufficient_samples`.
+Commit a baseline large enough to satisfy every `minSamples` it serves, and
+read these warnings as a prompt to rerun the baseline rather than as noise.
+
 Use `oma eval gate` when report generation and quality enforcement are separate
 CI stages. It prints the exact verdict JSON to stdout:
 
```

**File**: `packages/core/examples/patterns/eval-offline-regression.ts` (modified, +4/-2)
```diff
@@ -116,8 +116,10 @@ if (baseline === undefined || candidate === undefined) throw new Error('Expected
 const verdict = evaluateGate(candidate, {
   schemaVersion: 1,
   thresholds: [
-    { scorer: 'exact_match', metric: 'passRate', min: 1 },
-    { scorer: 'answer_relevancy', metric: 'avg', min: 0.9 },
+    // minSamples is the fixture's own size: 2 cases at 2 repeats. Require far
+    // more in production, or a perfect score over a handful of samples passes.
+    { scorer: 'exact_match', metric: 'passRate', min: 1, minSamples: 4 },
+    { scorer: 'answer_relevancy', metric: 'avg', min: 0.9, minSamples: 4 },
   ],
   maxScorerErrorRate: 0,
   maxTargetErrorRate: 0,
```

---

### Incident Patch 3: `d52380a0` (2026-09-11)
**Commit Message**: fix(release-bot): request DeepSeek JSON output mode for every role (#601)

Two roles failed in 2026-09 with STRUCTURED_OUTPUT_VALIDATION_FAILED on
bracket mismatches deep inside long nested output, and the in-run
correction failed the same way. #599 moved the nested object to the end of
each schema so the model has no boundary to hold, which works around the
symptom without changing what the provider guarantees.

Set `response_format: { type: 'json_object' }` on the shared role config
through `extraBody`. DeepSeek then guarantees that the answer parses as
JSON, so the syntax failure class goes away at the source. A direct API
probe with the pre-#599 planner schema, thinking at max effort, and a tool
turn confirmed that DeepSeek accepts the mode in that combination and
returned strict JSON on every run. OMA still validates the answer against
the role's schema, so the in-run correction keeps handling schema
mismatches.

The scripted adapter test asserts that every role carries the mode, and
the README documents it next to the shared output ceiling.

**File**: `packages/release-bot/README.md` (modified, +5/-1)
```diff
@@ -27,7 +27,11 @@ as the truncation it is. The evidence roles have five turns and the planner and
 reviewer three. Every DAG task has `maxRetries: 0`, so a failed role is not
 silently rerun as a whole new analysis (OMA's one in-run structured-output
 correction still applies). The complete planning DAG has a thirty-minute
-wall-clock deadline.
+wall-clock deadline. Every request also sets DeepSeek's JSON output mode
+(`response_format: json_object`), so the provider guarantees that the answer
+parses as JSON. OMA still validates the answer against the role's schema, so
+the in-run correction only has to handle a schema mismatch, not a bracket
+error in several thousand characters of nested output.
 
 Repository diffs are untrusted evidence. The analyst and compatibility auditor
 receive only three custom read-only tools: immutable release evidence, a
```

**File**: `packages/release-bot/src/orchestrator.ts` (modified, +10/-1)
```diff
@@ -74,7 +74,7 @@ export async function generateReleaseDecision(
   const model = options.model ?? DEFAULT_MODEL
   const shared: Pick<AgentConfig,
     'model' | 'provider' | 'adapter' | 'apiKey' | 'temperature' | 'thinking' | 'maxTokens' |
-    'parallelToolCalls' | 'maxToolOutputChars' | 'compressToolResults'> = {
+    'parallelToolCalls' | 'extraBody' | 'maxToolOutputChars' | 'compressToolResults'> = {
       model,
       provider: options.adapter ? undefined : 'deepseek',
       adapter: options.adapter,
@@ -90,6 +90,15 @@ export async function generateReleaseDecision(
       // replace it because it is only checked after a call returns.
       maxTokens: 64_000,
       parallelToolCalls: false,
+      // DeepSeek's JSON output mode makes the provider guarantee that the
+      // answer parses. Two roles failed in 2026-09 on bracket mismatches deep
+      // inside long nested output, and the in-run correction failed the same
+      // way; #599 moved the nested object last as a workaround. The mode is
+      // accepted together with thinking and tool calls, and the structured
+      // output instruction already carries the word "json" that DeepSeek
+      // requires in the prompt. Schema conformance is still validated by OMA;
+      // this only removes the syntax failure class.
+      extraBody: { response_format: { type: 'json_object' } },
       maxToolOutputChars: 75_000,
       compressToolResults: { minChars: 2_000 },
     }
```

**File**: `packages/release-bot/tests/orchestrator.test.ts` (modified, +10/-0)
```diff
@@ -93,6 +93,14 @@ describe('OMA release orchestration', () => {
       ['release-planner', { enabled: true, effort: 'max' }],
       ['release-reviewer', { enabled: true, effort: 'max' }],
     ]))
+    // Every role asks DeepSeek for JSON output mode so the provider, not the
+    // in-run correction, guarantees the answer parses.
+    expect(adapter.extraBodyByRole).toEqual(new Map([
+      ['change-analyst', { response_format: { type: 'json_object' } }],
+      ['compatibility-auditor', { response_format: { type: 'json_object' } }],
+      ['release-planner', { response_format: { type: 'json_object' } }],
+      ['release-reviewer', { response_format: { type: 'json_object' } }],
+    ]))
     expect(run.tokenUsage).toEqual({ input_tokens: 40, output_tokens: 20 })
   })
 
@@ -193,6 +201,7 @@ class ReleaseScriptAdapter implements LLMAdapter {
   readonly toolSets: string[][] = []
   readonly maxTokensByRole = new Map<string, number | undefined>()
   readonly thinkingByRole = new Map<string, ThinkingConfig | undefined>()
+  readonly extraBodyByRole = new Map<string, Record<string, unknown> | undefined>()
   plannerMessages = ''
   reviewerMessages = ''
   private sequence = 0
@@ -203,6 +212,7 @@ class ReleaseScriptAdapter implements LLMAdapter {
     this.toolSets.push((options.tools ?? []).map(tool => tool.name))
     this.maxTokensByRole.set(role, options.maxTokens)
     this.thinkingByRole.set(role, options.thinking)
+    this.extraBodyByRole.set(role, options.extraBody)
     const messageText = JSON.stringify(messages)
     if (role === 'release-planner') this.plannerMessages = messageText
     if (role === 'release-reviewer') this.reviewerMessages = messageText
```

---

### Incident Patch 4: `1a7b80b6` (2026-09-11)
**Commit Message**: fix(release-bot): keep nested objects last in structured-output schemas (#599)

Two of the four analysis roles have failed with
`STRUCTURED_OUTPUT_VALIDATION_FAILED`, and they are exactly the two whose
schema declares a nested object with more root-level properties after it.
The other two schemas are flat and have never failed.

Each schema reaches the model as the JSON Schema embedded in its system
prompt, and the model emits properties in that order. With `changelog` in
the middle, the model has to close that nested object before the next
root-level property, across roughly five thousand characters of dense
content. On 2026-09-11 the planner did not: both its first attempt and its
repair retry put `risks` and `rationale` inside `changelog`, closed the
`rationale` array with `}` instead of `]`, and omitted the two remaining
closing braces. The 2026-09-04 change-analyst run failed the same way.

Declaring the nested object last removes the boundary instead of asking the
model to hold it. Nothing follows it, so the tail is a plain `]}}`. Field
order does not affect validation, since Zod matches by key, and the emitted
plan is unchanged.

A test asserts the invariant for all four sch

**File**: `packages/release-bot/src/schema.ts` (modified, +11/-2)
```diff
@@ -64,13 +64,15 @@ export const changelogSectionsSchema = z.object({
 
 export type ChangelogSections = z.infer<typeof changelogSectionsSchema>
 
+// `changelog` last, for the reason given on `releaseProposalSchema`. This is the
+// role whose 2026-09-04 run failed the same way.
 export const changeAnalysisSchema = z.object({
   releaseRecommended: z.boolean(),
   recommendedCoreBump: bumpSchema,
   recommendedCreateOmaAppBump: bumpSchema,
   recommendedOtelBump: bumpSchema,
-  changelog: changelogSectionsSchema,
   rationale: z.array(singleLine).min(1).max(12),
+  changelog: changelogSectionsSchema,
 })
 
 export type ChangeAnalysis = z.infer<typeof changeAnalysisSchema>
@@ -86,15 +88,22 @@ export const compatibilityAnalysisSchema = z.object({
 
 export type CompatibilityAnalysis = z.infer<typeof compatibilityAnalysisSchema>
 
+// `changelog` is declared last on purpose. The schema reaches the model as JSON
+// Schema, whose property order it follows, and `changelog` is the only nested
+// object here. Declared in the middle, the model has to close it before the next
+// root-level field after roughly five thousand characters of dense content, and
+// twice it did not: the 2026-09-11 planner run emitted `risks` and `rationale`
+// inside `changelog` and then ran out of matching brackets. Last, there is no
+// following root field to confuse it with and the tail is a plain `]}}`.
 export const releaseProposalSchema = z.object({
   decision: z.enum(['release', 'none']),
   coreBump: bumpSchema,
   createOmaAppBump: bumpSchema,
   otelBump: bumpSchema,
   summary: singleLine,
-  changelog: changelogSectionsSchema,
   risks: z.array(singleLine).max(12),
   rationale: z.array(singleLine).min(1).max(12),
+  changelog: changelogSectionsSchema,
 }).superRefine((proposal, context) => {
   if (proposal.decision === 'none') {
     for (const [name, bump] of [
```

**File**: `packages/release-bot/tests/schema.test.ts` (modified, +44/-0)
```diff
@@ -1,8 +1,13 @@
+import { buildStructuredOutputInstruction } from '@open-multi-agent/core'
+import type { ZodSchema } from 'zod'
 import { describe, expect, it } from 'vitest'
 import {
   buildReleaseDecision,
+  changeAnalysisSchema,
+  compatibilityAnalysisSchema,
   normalizeReleaseProposal,
   releaseProposalSchema,
+  releaseReviewSchema,
   type ReleaseEvidence,
 } from '../src/schema.js'
 
@@ -163,3 +168,42 @@ describe('release decision', () => {
     })).toThrow(/breaking changes cannot ship as a patch/)
   })
 })
+
+describe('structured-output schema shape', () => {
+  // The model receives each schema as the JSON Schema embedded in its system
+  // prompt and emits the properties in that order. A nested object followed by
+  // another root-level property makes it close the nested object mid-answer,
+  // and twice it did not: change-analyst on 2026-09-04 and release-planner on
+  // 2026-09-11 both put the trailing root properties inside `changelog` and
+  // then ran out of matching brackets. Keeping every nested object last removes
+  // the boundary rather than relying on the model to hold it.
+  const schemas = {
+    changeAnalysisSchema,
+    compatibilityAnalysisSchema,
+    releaseProposalSchema,
+    releaseReviewSchema,
+  }
+
+  function propertyTypes(schema: ZodSchema): Array<[string, string]> {
+    const instruction = buildStructuredOutputInstruction(schema)
+    const fenced = instruction.match(/```\n([\s\S]*?)\n```/)
+    expect(fenced?.[1], 'instruction embeds a fenced JSON Schema').toBeDefined()
+    const jsonSchema = JSON.parse(fenced![1]!) as {
+      properties?: Record<string, { type?: string }>
+    }
+    expect(jsonSchema.properties, 'JSON Schema exposes properties').toBeDefined()
+    return Object.entries(jsonSchema.properties!).map(([name, value]) => [name, value.type ?? ''])
+  }
+
+  for (const [label, schema] of Object.entries(schemas)) {
+    it(`keeps every nested object last in ${label}`, () => {
+      const entries = propertyTypes(schema)
+      const lastObjectIndex = entries.map(([, type]) => type).lastIndexOf('object')
+      if (lastObjectIndex === -1) return
+      expect(
+        entries.slice(lastObjectIndex).map(([name]) => name),
+        'no property may follow a nested object',
+      ).toEqual([entries[lastObjectIndex]![0]])
+    })
+  }
+})
```

---

### Incident Patch 5: `cc2a8339` (2026-09-11)
**Commit Message**: fix: name the current DeepSeek Flash model instead of a retired alias (#598)

DeepSeek retired the V4-Flash model and named the current generation
`deepseek-flash`, with no version in the name. `deepseek-v4-flash` is still
accepted, but DeepSeek documents it as a temporary compatibility name and
already serves those requests from V4.1-Flash.

The repository handed that name to users in the places most likely to be
copied: the `oma` CLI default for `provider: 'deepseek'`, the adapter JSDoc
that ships in the type declarations, the provider table in docs, the
scaffolder env template, and every DeepSeek example. A copied name that the
vendor calls temporary has an expiry date the reader cannot see.

The provider table and the adapter JSDoc also stated that `deepseek-v4-flash`
resolves to DeepSeek-V4-Flash-0731. That model is retired, so the sentence
described a routing that no longer happens.

Two corrections of the same kind travel with it. The thinking-mode note
claimed the V4 models run at `high` effort, but the adapter forwards whatever
effort the caller passes and sets none itself, so the claim is dropped rather
than restated. Three `examples/basics` headers offered `deepseek-chat

**File**: `.github/CONTRIBUTING.md` (modified, +1/-1)
```diff
@@ -45,7 +45,7 @@ Core E2E tests are separate because they require `RUN_E2E=1` and real provider c
 npm run test:e2e
 ```
 
-Set `DEEPSEEK_E2E_MODEL` to override the DeepSeek canary model; it defaults to `deepseek-v4-flash`.
+Set `DEEPSEEK_E2E_MODEL` to override the DeepSeek canary model; it defaults to `deepseek-flash`.
 
 The `Provider Canary` workflow runs the DeepSeek suite daily and can also be started manually. Maintainers must configure `DEEPSEEK_API_KEY` as a GitHub Actions repository secret; never add a provider credential to source files or workflow YAML.
 
```

**File**: `.github/brand/capture-hero-run.mts` (modified, +10/-10)
```diff
@@ -36,13 +36,13 @@ import type { AgentConfig, OrchestratorEvent } from '../../packages/core/src/typ
 const MAX_TITLE_CHARS = 28
 
 // DeepSeek published list prices in USD per token (api-docs.deepseek.com/quick_start/pricing),
-// using the standard cache-miss input rate. OMA ships no price table by design — callers own
-// provider pricing — so this hero capture (the caller) prices its own usage and injects it onto
-// each LLM span below, lighting up the viewer's Cost metric, per-span cost, and per-task cost
-// roll-up with honest numbers instead of "Not recorded".
+// using the off-peak cache-miss input rate, verified 2026-09-12. OMA ships no price table by
+// design — callers own provider pricing — so this hero capture (the caller) prices its own usage
+// and injects it onto each LLM span below, lighting up the viewer's Cost metric, per-span cost,
+// and per-task cost roll-up with honest numbers instead of "Not recorded".
 const DEEPSEEK_PRICE_PER_TOKEN: Readonly<Record<string, { input: number; output: number }>> = {
-  'deepseek-v4-flash': { input: 0.14 / 1e6, output: 0.28 / 1e6 },
-  'deepseek-v4-pro': { input: 0.435 / 1e6, output: 0.87 / 1e6 },
+  'deepseek-flash': { input: 0.15 / 1e6, output: 0.6 / 1e6 },
+  'deepseek-v4-pro': { input: 0.66 / 1e6, output: 1.98 / 1e6 },
 }
 const MODEL_ATTR_KEYS = ['oma.llm.model', 'oma.model', 'gen_ai.request.model', 'gen_ai.response.model']
 const INPUT_TOKEN_ATTR_KEYS = ['oma.usage.input_tokens', 'gen_ai.usage.input_tokens']
@@ -126,7 +126,7 @@ ${PATH_RULE}`,
 
 const backendDev: AgentConfig = {
   name: 'backend-dev',
-  model: 'deepseek-v4-flash',
+  model: 'deepseek-flash',
   provider: 'deepseek',
   systemPrompt: `You are a Node.js developer. Read the contract at ${OUTPUT_DIR}/CONTRACT.md, then
 implement the JWT sign/verify module using only Node's built-in \`crypto\` (no external packages).
@@ -140,7 +140,7 @@ ${PATH_RULE}`,
 
 const qaEngineer: AgentConfig = {
   name: 'qa-engineer',
-  model: 'deepseek-v4-flash',
+  model: 'deepseek-flash',
   provider: 'deepseek',
   systemPrompt: `You are a QA engineer. Read ONLY the contract at ${OUTPUT_DIR}/CONTRACT.md (the
 implementation runs in parallel and is not available to you). Write a plain-Node test script
@@ -170,7 +170,7 @@ ${PATH_RULE}`,
 
 const reviewer: AgentConfig = {
   name: 'reviewer',
-  model: 'deepseek-v4-flash',
+  model: 'deepseek-flash',
   provider: 'deepseek',
   systemPrompt: `You are a senior reviewer. Read exactly these three files with file_read:
 ${OUTPUT_DIR}/auth.js, ${OUTPUT_DIR}/auth.test.js, and ${OUTPUT_DIR}/THREAT-MODEL.md. Then RETURN
@@ -214,7 +214,7 @@ function handleProgress(event: OrchestratorEvent): void {
 // ---------------------------------------------------------------------------
 const capture = new DashboardTraceCaptureSink()
 const orchestrator = new OpenMultiAgent({
-  defaultModel: 'deepseek-v4-flash',
+  defaultModel: 'deepseek-flash',
   defaultProvider: 'deepseek',
   maxConcurrency: 3, // let the three parallel specialists genuinely overlap in the waterfall
   onProgress: handleProgress,
```

**File**: `.github/workflows/release-bot.yml` (modified, +1/-1)
```diff
@@ -73,7 +73,7 @@ jobs:
         env:
           DEEPSEEK_API_KEY: ${{ secrets.DEEPSEEK_API_KEY }}
           RELEASE_BOT_GITHUB_TOKEN: ${{ steps.app-token.outputs.token }}
-          RELEASE_BOT_MODEL: deepseek-v4-flash
+          RELEASE_BOT_MODEL: deepseek-flash
         run: node packages/release-bot/dist/cli.js prepare-pr
 
       # A weekly job that fails only into the Actions tab is a job nobody reads.
```

**File**: `CHANGELOG.md` (modified, +14/-0)
```diff
@@ -36,6 +36,20 @@
   lost lease stops the run at the dispatch gate, and a worker that lost its
   lease reports the fence failure rather than success. Runs with no run store
   configured are unchanged.
+- The `oma` CLI default model for `provider: 'deepseek'` is now `deepseek-flash`
+  (DeepSeek-V4.1-Flash), replacing `deepseek-v4-flash`. DeepSeek retired the
+  V4-Flash model and now serves `deepseek-v4-flash` requests from V4.1-Flash, so
+  a CLI run without `--model` is already answered by V4.1; the new default names
+  the model it actually gets rather than a compatibility alias DeepSeek
+  describes as temporary. The old name still resolves, and library users that
+  pass an explicit `model` are unaffected. Provider docs, the adapter JSDoc, the
+  scaffolder env template, and the DeepSeek examples moved to the same name;
+  three `examples/basics` headers that still named the long-retired
+  `deepseek-chat` moved with them.
+- The DeepSeek adapter's JSDoc no longer states that thinking runs at `high`
+  effort. The adapter forwards whatever effort the caller passes and sets none
+  itself, and DeepSeek documents only that thinking is on by default. The
+  correction ships in the published `.d.ts`; runtime behavior is unchanged.
 
 ## 1.18.0 - 2026-09-04
 
```

**File**: `docs/providers.md` (modified, +1/-1)
```diff
@@ -36,7 +36,7 @@ The framework ships a wired-in provider name for each of these. Set `provider` a
 | Azure OpenAI | `provider: 'azure-openai'` | `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT` | `gpt-4` | Optional `AZURE_OPENAI_API_VERSION`, `AZURE_OPENAI_DEPLOYMENT`. |
 | GitHub Copilot | `provider: 'copilot'` | `GITHUB_COPILOT_TOKEN` (falls back to `GITHUB_TOKEN`) | `gpt-4o` | Custom token-exchange flow on top of OpenAI protocol. |
 | Grok (xAI) | `provider: 'grok'` | `XAI_API_KEY` | `grok-4` | OpenAI-compatible; endpoint is `api.x.ai/v1`. |
-| DeepSeek | `provider: 'deepseek'` | `DEEPSEEK_API_KEY` | `deepseek-v4-flash` | OpenAI-compatible Chat Completions. `deepseek-v4-flash` resolves to DeepSeek-V4-Flash-0731 and `deepseek-v4-pro` to DeepSeek-V4-Pro-0813. Both support 1M context, 384K max output, and enable thinking by default at `high` effort (opt out with `thinking: { enabled: false }`). Both endpoints also offer DeepSeek's native Responses API, while OMA's built-in adapter uses Chat Completions. Legacy `deepseek-chat` / `deepseek-reasoner` were retired on 2026-07-24. |
+| DeepSeek | `provider: 'deepseek'` | `DEEPSEEK_API_KEY` | `deepseek-flash` | OpenAI-compatible Chat Completions. `deepseek-flash` is DeepSeek-V4.1-Flash and `deepseek-v4-pro` is DeepSeek-V4-Pro-0813. `deepseek-flash` carries no version because DeepSeek moves the name to the current Flash generation; the older `deepseek-v4-flash` is still accepted but that model is retired and those requests are served by V4.1-Flash. Both support 1M context, 384K max output, and enable thinking by default (opt out with `thinking: { enabled: false }`). Both endpoints also offer DeepSeek's native Responses API, while OMA's built-in adapter uses Chat Completions. Legacy `deepseek-chat` / `deepseek-reasoner` were retired on 2026-07-24. |
 | Doubao (Volcengine) | `provider: 'doubao'` | `ARK_API_KEY` | `doubao-seed-1-8-251228` | OpenAI-compatible. ByteDance Volcengine Ark endpoint `https://ark.cn-beijing.volces.com/api/v3`. See [`providers/doubao`](../packages/core/examples/providers/doubao.ts). |
 | Hunyuan (Tencent MaaS / TokenHub) | `provider: 'hunyuan'` | `HUNYUAN_API_KEY` | `hy3-preview` | OpenAI-compatible. Default endpoint `https://tokenhub.tencentmaas.com/v1` (Tencent's current platform; `sk-...` keys, Hunyuan 3 models). Tool calling verified on `hy3-preview`. See [`providers/hunyuan`](../packages/core/examples/providers/hunyuan.ts). |
 | Hunyuan (legacy Tencent Cloud) | `provider: 'hunyuan'` + `HUNYUAN_BASE_URL` | `HUNYUAN_API_KEY` | `hunyuan-turbos-latest` | Legacy endpoint `https://api.hunyuan.cloud.tencent.com/v1` (console.cloud.tencent.com/hunyuan key; separate key namespace). Tencent has announced this platform is being retired (sales stop 2026-06-30, full shutdown 2026-09-30). Set `HUNYUAN_BASE_URL=https://api.hunyuan.cloud.tencent.com/v1` to target it until then. Tool calling verified on `hunyuan-turbos` and `hunyuan-functioncall`. |
```

---

### Incident Patch 6: `a04c7bfb` (2026-09-09)
**Commit Message**: fix(bench): normalize CRLF when checking README CSV columns in test (#596)

`npm run bench:ab:test` failed on any CRLF checkout with `README does not
document the "run_id" column`, even though bench/README.md:204 lists it first.
The repository has no `.gitattributes` forcing LF, so the file arrives with
CRLF on a Windows clone.

The test locates the end of the column list with `section.indexOf('\n\n', ...)`.
A CRLF paragraph break is `\r\n\r\n`, which contains no `\n\n` substring, so the
search returns -1, the slice matches no columns, and the assertion fails on the
first one. Linux CI checks out LF, so the drift guard only ever broke for
contributors on Windows.

Normalize CRLF to LF before slicing. This is the only place in the file that
reads a file from disk and splits on a paragraph break; `fromCSV` already
tolerates CRLF and has its own test.

**File**: `bench/src/bench.test.mts` (modified, +3/-1)
```diff
@@ -437,7 +437,9 @@ test('fromCSV tolerates CRLF, a missing trailing newline, and an empty file', ()
 test('the README CSV column list matches the columns actually written', () => {
   // The list drifted once already: `variant` shipped in the CSV and never made
   // it into the README.
-  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf-8')
+  // Normalize CRLF: a Windows checkout separates paragraphs with `\r\n\r\n`,
+  // which contains no `\n\n` for the end-of-list search below.
+  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf-8').replaceAll('\r\n', '\n')
   const section = readme.slice(readme.indexOf('## CSV columns'))
   const documented = [...section.slice(0, section.indexOf('\n\n', section.indexOf('`')) + 2).matchAll(/`([a-z_]+)`/g)]
     .map((match) => match[1]!)
```

---

### Incident Patch 7: `e678bfb3` (2026-09-07)
**Commit Message**: fix(examples): use the supported AI SDK stream property (#590)

AI SDK 7 deprecates `StreamTextResult.fullStream` in favor of `stream`.
The example pins `ai@^7.0.0`, so the reference route was reading a
deprecated property that new readers would copy into their own code.

`packages/core/src/llm/ai-sdk.ts` keeps `fullStream` deliberately. Core
declares `ai` as a peer dependency across `^5.0.0 || ^6.0.0 || ^7.0.0`,
and `StreamTextResult` in v5 and v6 exposes no `stream` property at all,
so switching there would break those consumers at runtime. `fullStream`
is deprecated in v7 but not removed, so it stays correct for all three.

Verified with `tsc --noEmit` against the example's own tsconfig.

**File**: `packages/core/examples/integrations/with-vercel-ai-sdk/app/api/chat/route.ts` (modified, +1/-1)
```diff
@@ -108,5 +108,5 @@ ${teamOutput}`,
     messages: await convertToModelMessages(messages),
   })
 
-  return createUIMessageStreamResponse({ stream: toUIMessageStream({ stream: result.fullStream }) })
+  return createUIMessageStreamResponse({ stream: toUIMessageStream({ stream: result.stream }) })
 }
```

---

### Incident Patch 8: `f62c7edb` (2026-09-07)
**Commit Message**: fix(examples): keep the Vercel AI SDK route on the team topology (#589)

Anyone following this example got a blank article back. The route read
the team's answer from agentResults.get('coordinator'), but a goal this
short is routed to the single-agent path, where the orchestrator
publishes the answer under the winning agent's own name instead. The
lookup returned undefined, the ?? '' fallback swallowed it, and the app
streamed an empty Team Output section.

- Pass an explicit mode: 'team' so the demo runs the topology this
  example teaches. Explicit mode outranks the router.
- Read the terminal agent as a fallback so the route returns the article
  under either topology.
- Check success before streaming. A plan validation failure leaves the
  coordinator's unparsed plan under the 'coordinator' key, so testing
  for an empty string would stream planning scratch as the article.
- Raise maxDuration to 360 and say "a few minutes" in the placeholder,
  to match the measured team path: seven runs on deepseek-v4-flash took
  137 to 311 seconds, median 217, from one machine.

**File**: `packages/core/examples/integrations/with-vercel-ai-sdk/app/api/chat/route.ts` (modified, +23/-2)
```diff
@@ -3,7 +3,7 @@ import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
 import { OpenMultiAgent } from '@open-multi-agent/core'
 import type { AgentConfig } from '@open-multi-agent/core'
 
-export const maxDuration = 120
+export const maxDuration = 360
 
 // --- DeepSeek via OpenAI-compatible API ---
 const DEEPSEEK_BASE_URL = 'https://api.deepseek.com'
@@ -69,9 +69,30 @@ export async function POST(req: Request) {
   const teamResult = await orchestrator.runTeam(
     team,
     `Research and write an article about: ${lastText}`,
+    // Execution routing sends a short goal down the single-agent path. An
+    // explicit mode outranks the router, so this keeps the demo on the
+    // researcher + writer team topology.
+    { mode: 'team' },
   )
 
-  const teamOutput = teamResult.agentResults.get('coordinator')?.output ?? ''
+  // The team path publishes the synthesized answer under 'coordinator'; the
+  // single-agent path publishes it under the winning agent's own name. Read
+  // both so this route survives whichever topology runs.
+  const teamOutput =
+    teamResult.agentResults.get('coordinator')?.output
+    ?? teamResult.agentResults.get('writer')?.output
+    ?? ''
+
+  // A failed run still leaves the coordinator's unparsed plan under
+  // 'coordinator', so check `success` rather than testing for an empty string.
+  if (!teamResult.success || teamOutput === '') {
+    return new Response(
+      `The agent team did not produce an article: ${
+        teamResult.errorInfo?.message ?? teamResult.status?.code ?? 'unknown error'
+      }`,
+      { status: 500 },
+    )
+  }
 
   // --- Phase 2: Stream result via Vercel AI SDK ---
   const result = streamText({
```

**File**: `packages/core/examples/integrations/with-vercel-ai-sdk/app/page.tsx` (modified, +1/-1)
```diff
@@ -50,7 +50,7 @@ export default function Home() {
 
         {isLoading && status === 'submitted' && (
           <div style={{ color: '#888', fontSize: 14, padding: '8px 0' }}>
-            Agents are collaborating &mdash; this may take a minute...
+            Agents are collaborating &mdash; this takes a few minutes...
           </div>
         )}
 
```

---

### Incident Patch 9: `cc3c9c70` (2026-09-05)
**Commit Message**: docs: add reference pages, split long guides, and fix verified drift (#584)

Systematic documentation review: 12 new docs pages (coordinator, streaming, budgets and limits, errors, hooks and callbacks, glossary, production checklist, Run Viewer, MCP, sandbox and shell, evaluation in CI, routing evaluation) plus a docs index; the three longest guides split with stub sections that keep existing anchors; observability release records moved to docs/internal; statements re-verified against the code and corrected; READMEs, AGENTS.md, CONTRIBUTING.md, and issue templates synced. Documentation only, no behavior change.

**File**: `.github/CONTRIBUTING.md` (modified, +20/-10)
```diff
@@ -10,7 +10,7 @@ cd open-multi-agent
 npm install
 ```
 
-Requires Node.js >= 20.0.0.
+Requires Node.js >= 20.0.0. Node.js 20 is upstream-EOL and retained only as a migration compatibility window; OMA will remove it in the next major release, no earlier than 2026-10-31.
 
 ## Development Commands
 
@@ -22,11 +22,15 @@ npm test               # Run unit tests in every workspace
 npm run test:watch     # Core Vitest watch mode
 npm run test:coverage  # Core unit tests with coverage
 npm run test:scaffold  # End-to-end create-oma-app scaffold smoke test
+npm run test:example-catalog  # Validate example catalog metadata and coverage
+npm run test:e2e       # Core provider E2E; requires real API keys
+
+node packages/core/dist/cli/oma.js help  # After build; `oma` when installed from npm
 ```
 
 ## Running Tests
 
-Unit tests live in each workspace's `tests/` directory: currently `packages/core/tests/`, `packages/create-oma-app/tests/`, and `packages/otel/tests/`. They run without API keys or network access — provider SDKs and external processes are mocked where needed.
+Unit tests live in each workspace's `tests/` directory: currently `packages/core/tests/`, `packages/create-oma-app/tests/`, `packages/otel/tests/`, and `packages/release-bot/tests/`. They run without API keys or network access — provider SDKs and external processes are mocked where needed.
 
 ```bash
 npm test
@@ -74,14 +78,20 @@ Opening a PR prefills the [pull request template](pull_request_template.md), whi
 
 See the [README](../packages/core/README.md#architecture) for an architecture diagram. Key entry points:
 
-- **Orchestrator**: `packages/core/src/orchestrator/orchestrator.ts` — top-level API
-- **Task system**: `packages/core/src/task/queue.ts`, `packages/core/src/task/task.ts` — dependency DAG
-- **Agent**: `packages/core/src/agent/runner.ts` — conversation loop
-- **Tools**: `packages/core/src/tool/framework.ts`, `packages/core/src/tool/executor.ts` — tool registry and execution
-- **LLM adapters**: `packages/core/src/llm/` — built-in providers + OpenAI-compatible + AI SDK bridge (see [docs/providers.md](../docs/providers.md))
-- **Observability**: `packages/core/src/observability/` — trace records, sinks, exporters, and stores
-- **OpenTelemetry adapter**: `packages/otel/src/` — optional OTel mapping and export integration kept outside core
-- **App scaffolder**: `packages/create-oma-app/src/` and `packages/create-oma-app/templates/` — CLI and starter templates
+- **Orchestrator**: `packages/core/src/orchestrator/orchestrator.ts`. Top-level API.
+- **Task system**: `packages/core/src/task/queue.ts`, `packages/core/src/task/task.ts`. Dependency DAG.
+- **Agent**: `packages/core/src/agent/runner.ts`. Conversation loop.
+- **Tools**: `packages/core/src/tool/framework.ts`, `packages/core/src/tool/executor.ts`. Tool registry and execution.
+- **Team**: `packages/core/src/team/team.ts`, `packages/core/src/team/messaging.ts`. The team container and the in-memory inter-agent message bus.
+- **LLM adapters**: `packages/core/src/llm/`. Built-in providers + OpenAI-compatible + AI SDK bridge (see [docs/providers.md](../docs/providers.md)).
+- **Memory and checkpoints**: `packages/core/src/memory/`. Shared memory, stores, and checkpoint snapshots (see [docs/shared-memory.md](../docs/shared-memory.md) and [docs/checkpoint.md](../docs/checkpoint.md)).
+- **Durable approvals**: `packages/core/src/approval/durable.ts`. Suspended approval requests and decision records (see [docs/durable-approvals.md](../docs/durable-approvals.md)).
+- **Run journal**: `packages/core/src/journal/`. Append-only run events, offline verification, and tail replay (see [docs/run-journal.md](../docs/run-journal.md)).
+- **Observability**: `packages/core/src/observability/`. Trace records, sinks, exporters, and stores.
+- **Run Viewer**: `packages/core/src/dashboard/`. Offline single-run DAG and waterfall HTML rendering (see [docs/run-viewer.md](../docs/run-viewer.md)).
+- **Evaluation**: `pack
```

**File**: `.github/ISSUE_TEMPLATE/bug_report.md` (modified, +1/-1)
```diff
@@ -32,7 +32,7 @@ Paste any error messages or logs here
 
 - OS: [e.g. macOS 14, Ubuntu 22.04]
 - Node.js version: [e.g. 20.11]
-- Package version: [e.g. 1.8.0]
+- Package version: [e.g. 1.18.0]
 - LLM provider: [e.g. Anthropic, OpenAI]
 
 ## Additional context
```

**File**: `.github/ISSUE_TEMPLATE/feature_request.md` (modified, +2/-2)
```diff
@@ -11,11 +11,11 @@ assignees: ''
 **Where did this idea come from?** (Pick one — helps maintainers triage and prioritize.)
 
 - [ ] **Real use case** — I'm using open-multi-agent and hit this limit. Describe the use case in "Problem" below.
-- [ ] **Competitive reference** — Another framework has this (LangChain, AutoGen, CrewAI, Mastra, XCLI, etc.). Please name or link it.
+- [ ] **Competitive reference** — Another framework has this (LangChain, AutoGen, CrewAI, Mastra, etc.). Please name or link it.
 - [ ] **Systematic gap** — A missing piece in the framework matrix (provider not supported, tool not covered, etc.).
 - [ ] **Discussion / inspiration** — Came up in a tweet, Reddit post, Discord, or AI conversation. Please link or paste the source if possible.
 
-> **Maintainer note**: after triage, label with one of `community-feedback`, `source:competitive`, `source:analysis`, `source:owner` (multiple OK if the source is mixed — e.g. competitive analysis + user feedback).
+<!-- Maintainer note: after triage, label with one of `community-feedback`, `source:competitive`, `source:analysis`, `source:owner` (multiple OK if the source is mixed, e.g. competitive analysis + user feedback). -->
 
 ## Problem
 
```

**File**: `AGENTS.md` (modified, +13/-1)
```diff
@@ -13,7 +13,7 @@ This is a private npm-workspaces root. Run the commands below from the repositor
 | `create-oma-app` | Published scaffolder and starter templates | `packages/create-oma-app/src/`, `packages/create-oma-app/templates/`, `packages/create-oma-app/tests/` |
 | `@open-multi-agent/release-bot` | Private OMA-powered release planning and deterministic publication automation; never published | `packages/release-bot/src/`, `packages/release-bot/tests/`, `.github/workflows/release-bot.yml`, `.github/workflows/publish.yml` |
 
-Root-level `README.md`, `docs/`, `.github/`, and `scripts/` apply across workspaces. Paths in this file are repository-relative; do not assume an unprefixed `src/` or `tests/` means the workspace you intend.
+Root-level `README.md`, `docs/`, `.github/`, and `scripts/` apply across workspaces. Paths in this file are repository-relative; do not assume an unprefixed `src/` or `tests/` means the workspace you intend. [`bench/`](bench/README.md) is the A/B benchmark harness: it is not a workspace and is never published, it runs through `npx tsx`, and everything it produces is gitignored.
 
 ## Commands
 
@@ -103,11 +103,23 @@ These constraints span multiple files and can cause behavioral or compatibility
 | Checkpoint and restore | [docs/checkpoint.md](docs/checkpoint.md) |
 | Run event journal, lineage, and the model-visible boundary | [docs/run-journal.md](docs/run-journal.md) |
 | Tracing, stores, progress, Run Viewer, privacy, and OpenTelemetry | [docs/observability.md](docs/observability.md) |
+| Run Viewer inputs, rendering, and privacy boundary | [docs/run-viewer.md](docs/run-viewer.md) |
 | Evaluation, scorers, stores, reports, sampling, and gates | [docs/evaluation.md](docs/evaluation.md) |
+| Evaluation in CI and routing EvalSets | [evaluation-ci](docs/evaluation-ci.md), [evaluation-routing](docs/evaluation-routing.md) |
 | CLI commands and JSON schemas | [docs/cli.md](docs/cli.md) |
+| Coordinator planning, configuration, and the simple-goal short circuit | [docs/coordinator.md](docs/coordinator.md) |
+| Callback and hook surface across config, options, and tasks | [docs/hooks-and-callbacks.md](docs/hooks-and-callbacks.md) |
+| Filesystem sandbox and shell execution | [docs/sandbox-and-shell.md](docs/sandbox-and-shell.md) |
+| MCP connection, tool mapping, and process boundaries | [docs/mcp.md](docs/mcp.md) |
+| Structured agent input and content blocks | [docs/structured-input.md](docs/structured-input.md) |
+| Streaming surfaces and `StreamEvent` order | [docs/streaming.md](docs/streaming.md) |
+| Turn, timeout, loop, token, and cost ceilings | [docs/budgets-and-limits.md](docs/budgets-and-limits.md) |
+| Durable approval gates and decision records | [docs/durable-approvals.md](docs/durable-approvals.md) |
+| Exported error classes and retry classification | [docs/errors.md](docs/errors.md) |
 | Process and ACP backends | [docs/external-agents.md](docs/external-agents.md) |
 | Runtime footprint, network scope, state locations, and air-gapped deployment | [docs/self-hosting.md](docs/self-hosting.md) |
 | Routing, scheduling, consensus, recovery, and replay | [model-routing](docs/model-routing.md), [execution-routing](docs/execution-routing.md), [task-scheduling](docs/task-scheduling.md), [consensus](docs/consensus.md), [adaptive-recovery](docs/adaptive-recovery.md), [plan-replay](docs/plan-replay.md) |
+| Documentation index across every `docs/` page | [docs/README.md](docs/README.md) |
 
 ## Adding an LLM adapter
 
```

**File**: `README.md` (modified, +8/-6)
```diff
@@ -39,7 +39,9 @@
 ## Get started
 
 Requires Node.js 20 or newer. For production, use a currently maintained
-Node.js LTS release.
+Node.js LTS release. Node.js 20 is upstream-EOL and retained only as a
+migration compatibility window; OMA will remove it in the next major release,
+no earlier than 2026-10-31.
 
 Scaffold a PR review agent, security analysis agent, or teaching DAG:
 
@@ -139,7 +141,7 @@ const result = await oma.runTeam(team, 'Find overdue invoices and draft the remi
 
 Set `OPENAI_API_KEY` to run this example. [Providers](docs/providers.md) covers other hosted models, local servers, OpenAI-compatible endpoints, and AI SDK providers.
 
-`runTeam()` plans from a goal, `runAgent()` runs a single agent, and `runTasks()` executes an explicit pipeline. The [Core package guide](packages/core/README.md) walks through all three modes, provider and credential setup, and the production checklist. The [example index](packages/core/examples/README.md) lists 50+ runnable examples across basics, cookbook workflows, patterns, providers, and integrations.
+`runTeam()` plans from a goal, `runAgent()` runs a single agent, and `runTasks()` executes an explicit pipeline. The [Core package guide](packages/core/README.md) walks through all three modes, provider and credential setup, and the production checklist. The [example index](packages/core/examples/README.md) lists every runnable example across basics, cookbook workflows, patterns, providers, and integrations.
 
 ## Why OMA
 
@@ -211,10 +213,10 @@ Need to embed agent capabilities in an existing product or business system? We h
 
 | Goal | Start here |
 |---|---|
-| Install and run | [Core package guide](packages/core/README.md) · [Examples](packages/core/examples/README.md) · [CLI](docs/cli.md) |
-| Configure models and tools | [Providers](docs/providers.md) · [LLM egress policy](docs/egress-policy.md) · [Tools and sandbox](docs/tool-configuration.md) · [External agents](docs/external-agents.md) |
-| Operate reliably | [Observability](docs/observability.md) · [Evaluation](docs/evaluation.md) · [Checkpoint and resume](docs/checkpoint.md) · [Durable approvals](docs/durable-approvals.md) · [Adaptive recovery](docs/adaptive-recovery.md) · [Context management](docs/context-management.md) |
-| Control orchestration | [Consensus](docs/consensus.md) · [Execution routing](docs/execution-routing.md) · [Model routing](docs/model-routing.md) · [Task scheduling](docs/task-scheduling.md) · [Plan replay](docs/plan-replay.md) · [Shared memory](docs/shared-memory.md) |
+| Install and run | [All docs](docs/README.md) · [Core package guide](packages/core/README.md) · [Examples](packages/core/examples/README.md) · [CLI](docs/cli.md) · [Glossary](docs/glossary.md) · [Production checklist](docs/production-checklist.md) |
+| Configure models and tools | [Providers](docs/providers.md) · [LLM egress policy](docs/egress-policy.md) · [Tools](docs/tool-configuration.md) · [Sandbox and shell](docs/sandbox-and-shell.md) · [MCP](docs/mcp.md) · [Structured input](docs/structured-input.md) · [External agents](docs/external-agents.md) |
+| Operate reliably | [Observability](docs/observability.md) · [Run Viewer](docs/run-viewer.md) · [Run journal](docs/run-journal.md) · [Evaluation](docs/evaluation.md) · [Checkpoint and resume](docs/checkpoint.md) · [Durable approvals](docs/durable-approvals.md) · [Adaptive recovery](docs/adaptive-recovery.md) · [Context management](docs/context-management.md) · [Errors](docs/errors.md) |
+| Control orchestration | [Coordinator](docs/coordinator.md) · [Consensus](docs/consensus.md) · [Execution routing](docs/execution-routing.md) · [Model routing](docs/model-routing.md) · [Task scheduling](docs/task-scheduling.md) · [Plan replay](docs/plan-replay.md) · [Shared memory](docs/shared-memory.md) · [Streaming](docs/streaming.md) · [Budgets and limits](docs/budgets-and-limits.md) |
 
 ## Contributing
 
```

---

### Incident Patch 10: `ab3654db` (2026-09-04)
**Commit Message**: fix(release-bot): name otel in the title and @-mention credited logins (#578)

Two things the v1.18.0 release surfaced, both in text the bot publishes.

buildReleasePrTitle hard-coded core and create-oma-app, so a release that also
republished otel could never say so: v1.18.0 shipped otel 0.1.3 under a title
naming two packages. The signal was already present, because the body's package
table switches on `bumps.otel === null`, and only the title ignored it. The
title now reads the same condition. The two-package string is unchanged byte for
byte, and a test pins the `chore: release core vX.Y.Z` prefix in both shapes:
prepareReleasePr recognizes an already-open release PR by it, and the title is
also the release commit subject.

The Thanks section credited contributors as plain text, so the body reached
nobody it thanked. A contributor is now @-mentioned, but only when the name is a
login GitHub itself confirmed. The display-name fallback stays plain, because
v1.17.0 credited `s4kura` for #549 when the author was `Iams4kura`, an account
someone else holds. As text that was a wrong name; as an @-mention it would have
notified an uninvolved stranger in a body this bot publishes withou

**File**: `packages/release-bot/src/apply-plan.ts` (modified, +34/-5)
```diff
@@ -120,8 +120,14 @@ export interface ReleasePackageSummary {
 
 /** One outside contributor and what they landed in this release. */
 export interface ReleaseContributor {
-  /** GitHub login when the commit carried a noreply address, else the author name. */
+  /** GitHub login when one was resolved, else the author's display name. */
   readonly name: string
+  /**
+   * Whether {@link name} is a GitHub login rather than a display name, which
+   * decides whether it is safe to @-mention. See the Thanks section in
+   * {@link composeReleaseBody}.
+   */
+  readonly isLogin: boolean
   /** What they landed, one entry per merged commit, already stripped of its type prefix. */
   readonly contributions: readonly string[]
 }
@@ -158,11 +164,18 @@ export function composeReleaseBody(input: ReleaseBodyInput): string {
     return `- \`${item.name}\`: \`${item.version}\``
   })
 
-  // Plain names, never `@handle`: a release body that mentions an account
-  // notifies it, and this text is published without the person reviewing it.
+  // @-mention a contributor so the credit reaches them, but only when the name
+  // is a login GitHub itself confirmed. A display name is not a handle and can
+  // belong to someone else: v1.17.0 credited `s4kura` for #549 when the author
+  // was `Iams4kura`. As plain text that was a wrong name; as an @-mention it
+  // would have notified an uninvolved stranger, in a body this bot publishes
+  // without anyone reviewing it first. So the display-name fallback stays plain.
   const thanks = (input.contributors ?? [])
     .filter(contributor => contributor.contributions.length > 0)
-    .map(contributor => `- ${contributor.name}: ${contributor.contributions.join('; ')}`)
+    .map(contributor => {
+      const credit = contributor.isLogin ? `@${contributor.name}` : contributor.name
+      return `- ${credit}: ${contributor.contributions.join('; ')}`
+    })
   const thanksSection = thanks.length > 0 ? `\n## Thanks\n\n${thanks.join('\n')}\n` : ''
 
   return `${input.notes}
@@ -180,8 +193,24 @@ npm create oma-app@latest my-oma
 `
 }
 
+/**
+ * The title names every package this release publishes.
+ *
+ * It used to hard-code core and create-oma-app, so a release that republished
+ * otel never said so: v1.18.0 shipped otel 0.1.3 under a title that named two
+ * packages. otel is the only conditional one, because a release always moves
+ * core and create-oma-app, and `bumps.otel === null` is the same signal the
+ * body's package table already switches on.
+ *
+ * The `chore: release core vX.Y.Z` prefix is load-bearing and must stay first:
+ * `prepareReleasePr` recognizes an already-open release PR by it, and this
+ * string is also the release commit subject.
+ */
 export function buildReleasePrTitle(plan: ReleasePlan): string {
-  return `chore: release core v${plan.nextVersions.core} and create-oma-app v${plan.nextVersions.createOmaApp}`
+  const core = `core v${plan.nextVersions.core}`
+  const scaffolder = `create-oma-app v${plan.nextVersions.createOmaApp}`
+  if (plan.bumps.otel === null) return `chore: release ${core} and ${scaffolder}`
+  return `chore: release ${core}, otel v${plan.nextVersions.otel}, and ${scaffolder}`
 }
 
 export function buildReleasePrBody(plan: ReleasePlan): string {
```

**File**: `packages/release-bot/src/publisher.ts` (modified, +15/-9)
```diff
@@ -208,21 +208,21 @@ export async function collectReleaseContributors(
     { cwd: options.repoRoot },
   )
   const excluded = new Set(options.excludedContributors ?? DEFAULT_EXCLUDED_CONTRIBUTORS)
-  const byName = new Map<string, string[]>()
+  const byName = new Map<string, { isLogin: boolean; contributions: string[] }>()
   const loginByEmail = new Map<string, string | null>()
   for (const record of log.stdout.split('\u001e')) {
     const line = record.trim()
     if (line === '') continue
     const [sha = '', author = '', email = '', subject = ''] = line.split('\u001f')
-    const name = await resolveContributorName(sha, author, email, options.github, loginByEmail)
+    const { name, isLogin } = await resolveContributorName(sha, author, email, options.github, loginByEmail)
     if (name === '' || name.endsWith('[bot]') || excluded.has(name)) continue
     const contribution = describeContribution(subject)
     if (contribution === '') continue
     const existing = byName.get(name)
-    if (existing) existing.push(contribution)
-    else byName.set(name, [contribution])
+    if (existing) existing.contributions.push(contribution)
+    else byName.set(name, { isLogin, contributions: [contribution] })
   }
-  return [...byName].map(([name, contributions]) => ({ name, contributions }))
+  return [...byName].map(([name, entry]) => ({ name, isLogin: entry.isLogin, contributions: entry.contributions }))
 }
 
 /**
@@ -240,23 +240,29 @@ export async function collectReleaseContributors(
  * function had before, rather than failing a publish over a name. The result
  * is cached per address, so a contributor with several commits costs one
  * request and a transient failure degrades that contributor consistently.
+ *
+ * `isLogin` reports which of those happened, because the release body may only
+ * @-mention a confirmed login. A degraded display name is credited as plain
+ * text rather than used to notify whichever account happens to hold it.
  */
 async function resolveContributorName(
   sha: string,
   author: string,
   email: string,
   github: GitHubClient | undefined,
   loginByEmail: Map<string, string | null>,
-): Promise<string> {
+): Promise<{ readonly name: string; readonly isLogin: boolean }> {
   const address = email.trim()
   const noreply = /^(?:\d+\+)?(.+)@users\.noreply\.github\.com$/.exec(address)
-  if (noreply?.[1]) return noreply[1].trim()
-  if (!github || sha === '') return author.trim()
+  if (noreply?.[1]) return { name: noreply[1].trim(), isLogin: true }
+  if (!github || sha === '') return { name: author.trim(), isLogin: false }
 
   if (!loginByEmail.has(address)) {
     loginByEmail.set(address, await github.getCommitAuthorLogin(sha).catch(() => null))
   }
-  return (loginByEmail.get(address) ?? author).trim()
+  const login = loginByEmail.get(address)
+  if (login) return { name: login.trim(), isLogin: true }
+  return { name: author.trim(), isLogin: false }
 }
 
 /** `feat(examples): add a thing (#12)` becomes `add a thing (#12)`. */
```

**File**: `packages/release-bot/tests/apply-plan.test.ts` (modified, +52/-0)
```diff
@@ -5,6 +5,7 @@ import { afterEach, describe, expect, it } from 'vitest'
 import {
   applyReleasePlan,
   buildReleasePrBody,
+  buildReleasePrTitle,
   composeReleaseBody,
   insertReleaseEntry,
   renderReleaseNotes,
@@ -118,6 +119,31 @@ describe('release plan materialization', () => {
     expect(body).toContain('Version calculation, template pins')
     expect(body).toContain('Merging this PR is the human release approval')
   })
+
+  it('titles a two-package release with core and the scaffolder', () => {
+    expect(buildReleasePrTitle(plan)).toBe('chore: release core v1.15.0 and create-oma-app v0.8.0')
+  })
+
+  it('names otel in the title when otel is part of the release', () => {
+    // v1.18.0 published otel 0.1.3 under a title that named two packages,
+    // because the title hard-coded them while the body's table did not.
+    const otelPlan: ReleasePlan = {
+      ...plan,
+      nextVersions: { ...plan.nextVersions, otel: '0.1.2' },
+      bumps: { ...plan.bumps, otel: 'patch' },
+    }
+
+    expect(buildReleasePrTitle(otelPlan))
+      .toBe('chore: release core v1.15.0, otel v0.1.2, and create-oma-app v0.8.0')
+  })
+
+  it('keeps the prefix prepareReleasePr matches on in both shapes', () => {
+    const otelPlan: ReleasePlan = { ...plan, bumps: { ...plan.bumps, otel: 'patch' } }
+    const prefix = /^chore: release core v\d+\.\d+\.\d+\b/i
+
+    expect(buildReleasePrTitle(plan)).toMatch(prefix)
+    expect(buildReleasePrTitle(otelPlan)).toMatch(prefix)
+  })
 })
 
 async function createFixture(): Promise<string> {
@@ -195,6 +221,32 @@ describe('published release body', () => {
     expect(continuations).toEqual([])
   })
 
+  it('@-mentions a contributor whose name is a confirmed GitHub login', () => {
+    const body = composeReleaseBody({
+      notes: '### Added\n\n- Something.',
+      coreVersion: '1.15.0',
+      packages,
+      contributors: [{ name: 'green3sf', isLogin: true, contributions: ['add a verify loop (#541)'] }],
+    })
+
+    expect(body).toContain('- @green3sf: add a verify loop (#541)')
+  })
+
+  it('leaves a display-name fallback unmentioned so it cannot notify a stranger', () => {
+    // v1.17.0 credited `s4kura` for #549 when the author was `Iams4kura`. An
+    // unresolved display name is not a handle, and this body is published
+    // without anyone reviewing it, so it must never become an @-mention.
+    const body = composeReleaseBody({
+      notes: '### Added\n\n- Something.',
+      coreVersion: '1.15.0',
+      packages,
+      contributors: [{ name: 'Ada Lovelace', isLogin: false, contributions: ['tighten a guard (#12)'] }],
+    })
+
+    expect(body).toContain('- Ada Lovelace: tighten a guard (#12)')
+    expect(body).not.toContain('@Ada Lovelace')
+  })
+
   it('refuses a package set that does not carry core', () => {
     expect(() => composeReleaseBody({
       notes: '### Added',
```

**File**: `packages/release-bot/tests/publisher.test.ts` (modified, +8/-8)
```diff
@@ -61,7 +61,7 @@ describe('deterministic publisher', () => {
     expect(body).toContain('@open-multi-agent/core@1.15.0')
     // Outside contributors only: the maintainer and the bot are filtered out.
     expect(body).toContain('## Thanks')
-    expect(body).toContain('- green3sf: add a verify loop (#541)')
+    expect(body).toContain('- @green3sf: add a verify loop (#541)')
     expect(body).not.toContain('Jack Chen')
     expect(body).not.toContain('oma-release-bot')
 
@@ -270,7 +270,7 @@ describe('release contributor collection', () => {
     } as Parameters<typeof collectReleaseContributors>[0])
 
     expect(contributors).toEqual([
-      { name: 'green3sf', contributions: ['add a verify loop (#541)', 'refresh output (#536)'] },
+      { name: 'green3sf', isLogin: true, contributions: ['add a verify loop (#541)', 'refresh output (#536)'] },
     ])
   })
 
@@ -284,7 +284,7 @@ describe('release contributor collection', () => {
     } as Parameters<typeof collectReleaseContributors>[0])
 
     expect(contributors).toEqual([
-      { name: 'Iams4kura', contributions: ['align required fields (#549)'] },
+      { name: 'Iams4kura', isLogin: true, contributions: ['align required fields (#549)'] },
     ])
   })
 
@@ -297,7 +297,7 @@ describe('release contributor collection', () => {
     } as Parameters<typeof collectReleaseContributors>[0])
 
     expect(calls).toEqual([])
-    expect(contributors).toEqual([{ name: 'green3sf', contributions: ['a fix (#1)'] }])
+    expect(contributors).toEqual([{ name: 'green3sf', isLogin: true, contributions: ['a fix (#1)'] }])
   })
 
   it('falls back to the author name when no account claims the commit', async () => {
@@ -308,7 +308,7 @@ describe('release contributor collection', () => {
     } as Parameters<typeof collectReleaseContributors>[0])
 
     expect(contributors).toEqual([
-      { name: 'Ada Lovelace', contributions: ['tighten a guard (#12)'] },
+      { name: 'Ada Lovelace', isLogin: false, contributions: ['tighten a guard (#12)'] },
     ])
   })
 
@@ -321,7 +321,7 @@ describe('release contributor collection', () => {
     } as Parameters<typeof collectReleaseContributors>[0])
 
     expect(contributors).toEqual([
-      { name: 'Ada Lovelace', contributions: ['tighten a guard (#12)'] },
+      { name: 'Ada Lovelace', isLogin: false, contributions: ['tighten a guard (#12)'] },
     ])
   })
 
@@ -332,7 +332,7 @@ describe('release contributor collection', () => {
     } as Parameters<typeof collectReleaseContributors>[0])
 
     expect(contributors).toEqual([
-      { name: 'Ada Lovelace', contributions: ['tighten a guard (#12)'] },
+      { name: 'Ada Lovelace', isLogin: false, contributions: ['tighten a guard (#12)'] },
     ])
   })
 
@@ -349,7 +349,7 @@ describe('release contributor collection', () => {
 
     expect(calls).toEqual(['a'.repeat(40)])
     expect(contributors).toEqual([
-      { name: 'Iams4kura', contributions: ['first (#1)', 'second (#2)'] },
+      { name: 'Iams4kura', isLogin: true, contributions: ['first (#1)', 'second (#2)'] },
     ])
   })
 
```

#### Recent Merged Pull Requests:
- **PR #618** (2026-09-28): docs(core): clarify runImage validation errors (@JackChen-me)
- **PR #617** (closed): docs: record OpenAI SDK v7 compatibility decision (@Oscar-Williams)
- **PR #616** (closed): docs(budgets): add cost control on free tiers (@magiautonomous)
- **PR #615** (2026-09-25): chore: release core v1.21.0 and create-oma-app v0.8.7 (@oma-release-bot[bot])
- **PR #614** (2026-09-23): feat(core): add Black Forest Labs image adapter (@JackChen-me)
- **PR #613** (2026-09-23): feat(core): add OpenRouter image adapter (@JackChen-me)
- **PR #610** (2026-09-23): feat(core): add runImage and native image model adapters (@JackChen-me)
- **PR #609** (2026-09-23): fix(core): support adaptive thinking on current Claude models (@JackChen-me)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
