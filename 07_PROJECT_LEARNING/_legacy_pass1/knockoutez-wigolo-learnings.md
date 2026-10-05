# Forensic Learning Record (Deep Inspection): KnockOutEZ/wigolo

> **Canonical Artifact**: `07_PROJECT_LEARNING/knockoutez-wigolo-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/KnockOutEZ/wigolo](https://github.com/KnockOutEZ/wigolo))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:45:28.403Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `KnockOutEZ/wigolo`
- **Description**: The go-to web for your AI coding agent — local-first search, fetch, crawl & research over MCP. No API keys, no cloud, $0/query. Public beta.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 5435 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `benchmarks/agent/evaluator.ts`
```
import { createLogger } from '../../src/logger.js';
import type {
  ExpectedFact,
  FactEvaluation,
  TaskEvaluation,
  TaskType,
  TaskExecutionResult,
} from './types.js';

const log = createLogger('extract');

export function normalizeForComparison(text: string): string {
  try {
    if (!text || typeof text !== 'string') return '';
    return text
      .toLowerCase()
      .replace(/[,!?;:'"()[\]{}]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  } catch (err) {
    log.warn('normalizeForComparison failed', { error: String(err) });
    return '';
  }
}

function wordTokenize(text: string): string[] {
  return normalizeForComparison(text).split(/\s+/).filter(w => w.length > 0);
}

function computeWordOverlap(factWords: string[], contentWords: Set<string>): number {
  if (factWords.length === 0) return 0;
  let matches = 0;
  for (const word of factWords) {
    if (contentWords.has(word)) matches++;
  }
  return matches / factWords.length;
}

export function evaluateFact(fact: ExpectedFact, content: string): FactEvaluation {
  try {
    if (!fact.fact || fact.fact.length === 0 || !content || content.length === 0) {
      return {
        fact: fact.fact,
        required: fact.required,
        found: false,
        matchType: 'not-found',
        confidence: 0,
      };
    }

    const normalizedContent = normalizeForComparison(content);
    const normalizedFact = normalizeForComparison(fact.fact);

    // Exact substring match
    if (normalizedContent.includes(normalizedFact)) {
      return {
        fact: fact.fact,
        required: fact.required,
        found: true,
        matchType: 'exact',
        confidence: 1,
      };
    }

    // Case-insensitive substring (already lowercased, but check original for partial patterns)
    if (content.toLowerCase().includes(fact.fact.toLowerCase())) {
      return {
        fact: fact.fact,
        required: fact.required,
        found: true,
        matchType: 'substring',
        confidence: 0.9,
      };
    }

    // Semantic: word overlap above threshold
    const factWords = wordTokenize(fact.fact);
    const contentWordsSet = new Set(wordTokenize(content));
    const overlap = computeWordOverlap(factWords, contentWordsSet);

    if (overlap >= 0.6) {
      return {
        fact: fact.fact,
        required: fact.required,
        found: true,
        matchType: 'semantic',
        confidence: overlap * 0.8,
      };
    }

    return {
      fact: fact.fact,
      required: fact.required,
      found: false,
      matchType: 'not-found',
      confidence: 0,
    };
  } catch (err) {
    log.warn('evaluateFact failed', { fact: fact.fact, error: String(err) });
    return {
      fact: fact.fact,
      required: fact.required,
      found: false,
      matchType: 'not-found',
      confidence: 0,
    };
  }
}

export function computeFactualAccuracy(evaluations: FactEvaluation[]): number {
  try {
    if (evaluations.length === 0) return 0;
    const totalConfidence = evaluations.reduce((sum, e) => sum + e.confidence, 0);
    return totalConfidence / evaluations.length;
  } catch (err) {
    log.warn('computeFactualAccuracy failed', { error: String(err) });
    return 0;
  }
}

export function computeCitationAccuracy(evaluations: (FactEvaluation & { category?: string })[]): number {
  try {
    const citationEvals = evaluations.filter(e => e.category === 'citation');
    if (citationEvals.length === 0) return 1; // vacuously true
    const found = citationEvals.filter(e => e.found).length;
    return found / citationEvals.length;
  } catch (err) {
    log.warn('computeCitationAccuracy failed', { error: String(err) });
    return 0;
  }
}

export function computeCompleteness(evaluations: FactEvaluation[]): number {
  try {
    const required = evaluations.filter(e => e.required);
    if (required.length === 0) return 1; // no requirements => complete
    const found = required.filter(e => e.found).length;
    return found / required.length;
  } catch (err) {
    log.warn('computeCompleteness failed', { error: String(err) });
    return 0;
  }
}

export function evaluateTask(
  taskId: string,
  taskType: TaskType,
  query: string,
  execution: TaskExecutionResult,
  expectedFacts: ExpectedFact[],
): TaskEvaluation {
  try {
    const taskFacts = expectedFacts.filter(f => f.taskId === taskId);

    const factEvaluations = taskFacts.map(fact =>
      evaluateFact(fact, execution.collectedContent),
    );

    const factsFound = factEvaluations.filter(e => e.found).length;
    const requiredEvals = factEvaluations.filter(e => e.required);
    const requiredFound = requiredEvals.filter(e => e.found).length;

    const factualAccuracy = computeFactualAccuracy(factEvaluations);
    const citationAccuracy = computeCitationAccuracy(
      factEvaluations.map((e, i) => ({ ...e, category: taskFacts[i]?.category })),
    );
    const completeness = computeCompleteness(factEvaluations);

    const pagesFetched = execution.steps.filter(s => s.tool === 'fetch').length;

    return {
      taskId,
      taskType,
      query,
      factEvaluations,
      factsFound,
      factsTotal: taskFacts.length,
      requiredFactsFound: requiredFound,
      requiredFactsTotal: requiredEvals.length,
      factualAccuracy,
      citationAccuracy,
      completeness,
      pagesFetched,
      totalSteps: execution.steps.length,
      latencyMs: execution.totalDurationMs,
      error: execution.error,
    };
  } catch (err) {
    log.error('evaluateTask failed', { taskId, error: String(err) });
    return {
      taskId,
      taskType,
      query,
      factEvaluations: [],
      factsFound: 0,
      factsTotal: expectedFacts.filter(f => f.taskId === taskId).length,
      requiredFactsFound: 0,
      requiredFactsTotal: expectedFacts.filter(f => f.taskId === taskId && f.required).length,
      factualAccuracy: 0,
      citationAccuracy: 0,
      completeness: 0,
      pagesFetched: 0,
      totalSteps: 0,
      latencyMs: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

```

### Core Architecture Module: `benchmarks/agent/metrics.ts`
```
import { createLogger } from '../../src/logger.js';
import type {
  TaskEvaluation,
  AgentBenchmarkSummary,
  TaskTypeSummary,
} from './types.js';

const log = createLogger('extract');

const COMPLETION_THRESHOLD = 0.5;

export function computeAgentSummary(results: TaskEvaluation[]): AgentBenchmarkSummary {
  try {
    if (results.length === 0) {
      return {
        totalTasks: 0,
        successfulTasks: 0,
        failedTasks: 0,
        taskCompletionRate: 0,
        averageFactualAccuracy: 0,
        averageCitationAccuracy: 0,
        averageCompleteness: 0,
        averagePagesFetched: 0,
        averageLatencyMs: 0,
        averageTokenEfficiency: 0,
        byTaskType: {},
      };
    }

    const successful = results.filter(r => !r.error);
    const failed = results.filter(r => !!r.error);
    const completed = results.filter(r => r.completeness >= COMPLETION_THRESHOLD);

    const n = results.length;
    const sn = successful.length || 1;

    const sumAccuracy = successful.reduce((s, r) => s + r.factualAccuracy, 0);
    const sumCitation = successful.reduce((s, r) => s + r.citationAccuracy, 0);
    const sumCompleteness = successful.reduce((s, r) => s + r.completeness, 0);
    const sumPages = results.reduce((s, r) => s + r.pagesFetched, 0);
    const sumLatency = results.reduce((s, r) => s + r.latencyMs, 0);
    const sumEfficiency = successful.reduce((s, r) => s + r.factsFound / Math.max(r.pagesFetched, 1), 0);

    // Group by task type
    const byTaskType: Record<string, TaskTypeSummary> = {};
    for (const r of results) {
      if (!byTaskType[r.taskType]) {
        byTaskType[r.taskType] = {
          count: 0,
          completionRate: 0,
          averageAccuracy: 0,
          averageCompleteness: 0,
          averageLatencyMs: 0,
          tokenEfficiency: 0,
        };
      }
      const tt = byTaskType[r.taskType];
      tt.count++;
      tt.averageAccuracy += r.factualAccuracy;
      tt.averageCompleteness += r.completeness;
      tt.averageLatencyMs += r.latencyMs;
      tt.tokenEfficiency = (tt.tokenEfficiency ?? 0) + r.factsFound / Math.max(r.pagesFetched, 1);
      if (r.completeness >= COMPLETION_THRESHOLD) tt.completionRate++;
    }
    for (const key of Object.keys(byTaskType)) {
      const tt = byTaskType[key];
      tt.completionRate /= tt.count;
      tt.averageAccuracy /= tt.count;
      tt.averageCompleteness /= tt.count;
      tt.averageLatencyMs /= tt.count;
      tt.tokenEfficiency = (tt.tokenEfficiency ?? 0) / tt.count;
    }

    return {
      totalTasks: n,
      successfulTasks: successful.length,
      failedTasks: failed.length,
      taskCompletionRate: completed.length / n,
      averageFactualAccuracy: sumAccuracy / sn,
      averageCitationAccuracy: sumCitation / sn,
      averageCompleteness: sumCompleteness / sn,
      averagePagesFetched: sumPages / n,
      averageLatencyMs: sumLatency / n,
      averageTokenEfficiency: sumEfficiency / sn,
      byTaskType,
    };
  } catch (err) {
    log.error('computeAgentSummary failed', { error: String(err) });
    return {
      totalTasks: results.length,
      successfulTasks: 0,
      failedTasks: results.length,
      taskCompletionRate: 0,
      averageFactualAccuracy: 0,
      averageCitationAccuracy: 0,
      averageCompleteness: 0,
      averagePagesFetched: 0,
      averageLatencyMs: 0,
      averageTokenEfficiency: 0,
      byTaskType: {},
    };
  }
}

```

### Core Architecture Module: `benchmarks/agent/report.ts`
```
import { createLogger } from '../../src/logger.js';
import type { AgentBenchmarkReport } from './types.js';

const log = createLogger('extract');

export function generateAgentMarkdownReport(report: AgentBenchmarkReport): string {
  try {
    const { summary, results } = report;
    const lines: string[] = [];

    lines.push('# Agent Benchmark Report');
    lines.push('');
    lines.push(`**Run Date:** ${report.runDate}`);
    lines.push(`**Duration:** ${(report.durationMs / 1000).toFixed(1)}s`);
    lines.push(`**Total Tasks:** ${summary.totalTasks}`);
    lines.push(`**Successful:** ${summary.successfulTasks} | **Failed:** ${summary.failedTasks}`);
    lines.push('');

    lines.push('## Overall Metrics');
    lines.push('');
    lines.push('| Metric | Value |');
    lines.push('|--------|-------|');
    lines.push(`| Completion Rate | ${(summary.taskCompletionRate * 100).toFixed(1)}% |`);
    lines.push(`| Factual Accuracy | ${(summary.averageFactualAccuracy * 100).toFixed(1)}% |`);
    lines.push(`| Citation Accuracy | ${(summary.averageCitationAccuracy * 100).toFixed(1)}% |`);
    lines.push(`| Completeness | ${(summary.averageCompleteness * 100).toFixed(1)}% |`);
    lines.push(`| Avg Pages Fetched | ${summary.averagePagesFetched.toFixed(1)} |`);
    lines.push(`| Avg Latency | ${summary.averageLatencyMs.toFixed(0)}ms |`);
    lines.push(`| Token Efficiency (facts/page) | ${summary.averageTokenEfficiency.toFixed(2)} |`);
    lines.push('');

    // Task type breakdown
    const types = Object.keys(summary.byTaskType);
    if (types.length > 0) {
      lines.push('## By Task Type');
      lines.push('');
      lines.push('| Task Type | Count | Completion | Accuracy | Completeness | Avg Latency | Efficiency |');
      lines.push('|-----------|-------|------------|----------|--------------|-------------|------------|');
      for (const type of types) {
        const t = summary.byTaskType[type];
        lines.push(`| ${type} | ${t.count} | ${(t.completionRate * 100).toFixed(0)}% | ${(t.averageAccuracy * 100).toFixed(1)}% | ${(t.averageCompleteness * 100).toFixed(1)}% | ${t.averageLatencyMs.toFixed(0)}ms | ${(t.tokenEfficiency ?? 0).toFixed(2)} |`);
      }
      lines.push('');
    }

    // Per-task details
    lines.push('## Detailed Results');
    lines.push('');
    lines.push('| Task ID | Type | Accuracy | Completeness | Facts | Pages | Latency |');
    lines.push('|---------|------|----------|--------------|-------|-------|---------|');
    for (const r of results) {
      const errMark = r.error ? ' ERR' : '';
      lines.push(`| ${r.taskId}${errMark} | ${r.taskType} | ${(r.factualAccuracy * 100).toFixed(0)}% | ${(r.completeness * 100).toFixed(0)}% | ${r.factsFound}/${r.factsTotal} | ${r.pagesFetched} | ${r.latencyMs}ms |`);
    }
    lines.push('');

    return lines.join('\n');
  } catch (err) {
    log.error('generateAgentMarkdownReport failed', { error: String(err) });
    return '# Agent Benchmark Report\n\nError generating report.';
  }
}

export function generateAgentJsonReport(report: AgentBenchmarkReport): string {
  try {
    return JSON.stringify(report, null, 2);
  } catch (err) {
    log.error('generateAgentJsonReport failed', { error: String(err) });
    return JSON.stringify({ error: String(err) });
  }
}

```

### Core Architecture Module: `benchmarks/agent/runner.ts`
```
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createLogger } from '../../src/logger.js';
import { evaluateTask } from './evaluator.js';
import { computeAgentSummary } from './metrics.js';
import { generateAgentMarkdownReport, generateAgentJsonReport } from './report.js';
import { executeTask } from './task-executor.js';
import type {
  AgentTask,
  ExpectedFact,
  ExpectedOutput,
  TaskEvaluation,
  AgentBenchmarkReport,
  AgentRunnerOptions,
} from './types.js';
import type { SearchInput, SearchOutput, FetchInput, FetchOutput } from '../../src/types.js';

const log = createLogger('extract');

export function loadTasks(tasksPath: string): AgentTask[] {
  try {
    const raw = readFileSync(tasksPath, 'utf-8');
    const parsed = JSON.parse(raw);

    if (!parsed.tasks || !Array.isArray(parsed.tasks)) {
      throw new Error('Tasks file missing "tasks" array');
    }
    if (parsed.tasks.length === 0) {
      throw new Error('Tasks file has empty tasks array');
    }

    return parsed.tasks as AgentTask[];
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error(`Invalid JSON in tasks file: ${err.message}`);
    }
    throw err;
  }
}

export function loadExpected(expectedPath: string): ExpectedFact[] {
  try {
    const raw = readFileSync(expectedPath, 'utf-8');
    const parsed = JSON.parse(raw);

    if (!parsed.outputs || !Array.isArray(parsed.outputs)) {
      throw new Error('Expected file missing "outputs" array');
    }

    const allFacts: ExpectedFact[] = [];
    for (const output of parsed.outputs as ExpectedOutput[]) {
      for (const fact of output.facts) {
        allFacts.push(fact);
      }
    }

    return allFacts;
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error(`Invalid JSON in expected file: ${err.message}`);
    }
    throw err;
  }
}

export function filterTasks(
  tasks: AgentTask[],
  filter?: string,
): AgentTask[] {
  try {
    if (!filter) return tasks;

    const lower = filter.toLowerCase();
    return tasks.filter(t => {
      if (t.type.toLowerCase() === lower) return true;
      if (t.id.toLowerCase().includes(lower)) return true;
      if (t.tags?.some(tag => tag.toLowerCase() === lower)) return true;
      return false;
    });
  } catch (err) {
    log.warn('filterTasks failed', { error: String(err) });
    return tasks;
  }
}

export async function runAgentBenchmark(
  options: AgentRunnerOptions,
  searchFn?: (input: SearchInput) => Promise<SearchOutput>,
  fetchFn?: (input: FetchInput) => Promise<FetchOutput>,
): Promise<AgentBenchmarkReport> {
  const startTime = Date.now();

  if (!existsSync(options.tasksPath)) {
    throw new Error(`Tasks file not found: ${options.tasksPath}`);
  }
  if (!existsSync(options.expectedPath)) {
    throw new Error(`Expected file not found: ${options.expectedPath}`);
  }

  const tasks = loadTasks(options.tasksPath);
  const expectedFacts = loadExpected(options.expectedPath);
  const filtered = filterTasks(tasks, options.filter);

  if (filtered.length === 0) {
    throw new Error(`No tasks match filter "${options.filter}"`);
  }

  log.info('starting agent benchmark', {
    totalTasks: filtered.length,
    totalFacts: expectedFacts.length,
  });

  // Provide no-op implementations if no search/fetch functions given
  const doSearch = searchFn ?? (async (_input: SearchInput): Promise<SearchOutput> => ({
    results: [],
    query: _input.query,
    engines_used: ['none'],
    total_time_ms: 0,
  }));

  const doFetch = fetchFn ?? (async (_input: FetchInput): Promise<FetchOutput> => ({
    url: _input.url,
    title: '',
    markdown: '',
    metadata: {},
    links: [],
    images: [],
    cached: false,
    error: 'no fetch function provided',
  }));

  const evaluations: TaskEvaluation[] = [];

  for (const task of filtered) {
    const execution = await executeTask(task, doSearch, doFetch);
    const evaluation = evaluateTask(
      task.id,
      task.type,
      task.query,
      execution,
      expectedFacts,
    );

    evaluations.push(evaluation);

    if (options.verbose) {
      log.info('task benchmark complete', {
        taskId: task.id,
        accuracy: evaluation.factualAccuracy.toFixed(3),
        completeness: evaluation.completeness.toFixed(3),
        latencyMs: evaluation.latencyMs,
      });
    }
  }

  const durationMs = Date.now() - startTime;
  const summary = computeAgentSummary(evaluations);

  const report: AgentBenchmarkReport = {
    runDate: new Date().toISOString(),
    durationMs,
    summary,
    results: evaluations,
  };

  try {
    if (!existsSync(options.outputDir)) {
      mkdirSync(options.outputDir, { recursive: true });
    }

    writeFileSync(
      join(options.outputDir, 'agent-benchmark.json'),
      generateAgentJsonReport(report),
      'utf-8',
    );

    writeFileSync(
      join(options.outputDir, 'agent-benchmark.md'),
      generateAgentMarkdownReport(report),
      'utf-8',
    );

    log.info('agent benchmark complete', {
      totalTasks: summary.totalTasks,
      completionRate: (summary.taskCompletionRate * 100).toFixed(1) + '%',
      accuracy: (summary.averageFactualAccuracy * 100).toFixed(1) + '%',
      durationMs,
    });
  } catch (err) {
    log.error('failed to write agent benchmark output', { error: String(err) });
  }

  return report;
}

```

### Core Architecture Module: `benchmarks/agent/task-executor.ts`
```
import { createLogger } from '../../src/logger.js';
import type {
  AgentTask,
  TaskExecutionResult,
  ExecutionStep,
} from './types.js';
import type { SearchInput, SearchOutput, FetchInput, FetchOutput } from '../../src/types.js';

const log = createLogger('extract');

const DEFAULT_MAX_STEPS = 5;
const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_MAX_RESULTS = 5;
const DEFAULT_MAX_CHARS = 20000;

type SearchFn = (input: SearchInput) => Promise<SearchOutput>;
type FetchFn = (input: FetchInput) => Promise<FetchOutput>;

export function buildSearchInput(task: AgentTask): SearchInput {
  try {
    const input: SearchInput = {
      query: task.query,
      max_results: DEFAULT_MAX_RESULTS,
      include_content: true,
      content_max_chars: DEFAULT_MAX_CHARS,
    };

    if (task.expectedDomains && task.expectedDomains.length > 0) {
      input.include_domains = task.expectedDomains;
    }

    return input;
  } catch (err) {
    log.warn('buildSearchInput failed', { taskId: task.id, error: String(err) });
    return { query: task.query };
  }
}

export function buildFetchInput(url: string): FetchInput {
  return {
    url,
    render_js: 'auto',
    max_chars: DEFAULT_MAX_CHARS,
  };
}

export async function executeTask(
  task: AgentTask,
  searchFn: SearchFn,
  fetchFn: FetchFn,
): Promise<TaskExecutionResult> {
  const startTime = Date.now();
  const steps: ExecutionStep[] = [];
  const collectedContent: string[] = [];
  const collectedUrls: string[] = [];
  const maxSteps = task.maxSteps ?? DEFAULT_MAX_STEPS;
  const timeoutMs = task.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const deadline = startTime + timeoutMs;

  try {
    // Step 1: Search
    const searchInput = buildSearchInput(task);
    const searchStart = Date.now();
    let searchOutput: SearchOutput;

    try {
      searchOutput = await searchFn(searchInput);
      steps.push({
        tool: 'search',
        input: searchInput as unknown as Record<string, unknown>,
        output: searchOutput as unknown as Record<string, unknown>,
        durationMs: Date.now() - searchStart,
      });
    } catch (err) {
      steps.push({
        tool: 'search',
        input: searchInput as unknown as Record<string, unknown>,
        output: {},
        durationMs: Date.now() - searchStart,
        error: err instanceof Error ? err.message : String(err),
      });

      return {
        taskId: task.id,
        steps,
        collectedContent: '',
        collectedUrls: [],
        totalDurationMs: Date.now() - startTime,
        error: err instanceof Error ? err.message : String(err),
      };
    }

    // Collect content from search results that already have markdown_content
    for (const result of searchOutput.results) {
      if (result.markdown_content) {
        collectedContent.push(result.markdown_content);
        collectedUrls.push(result.url);
      }
    }

    // Step 2+: Fetch individual URLs that didn't have content
    const urlsToFetch = searchOutput.results
      .filter(r => !r.markdown_content && r.url)
      .map(r => r.url);

    let stepCount = 1; // search was step 1
    for (const url of urlsToFetch) {
      if (stepCount >= maxSteps) break;
      if (Date.now() >= deadline) break;

      const fetchInput = buildFetchInput(url);
      const fetchStart = Date.now();

      try {
        const fetchOutput = await fetchFn(fetchInput);
        steps.push({
          tool: 'fetch',
          input: fetchInput as unknown as Record<string, unknown>,
          output: fetchOutput as unknown as Record<string, unknown>,
          durationMs: Date.now() - fetchStart,
        });

        if (fetchOutput.markdown && fetchOutput.markdown.length > 0) {
          collectedContent.push(fetchOutput.markdown);
          collectedUrls.push(fetchOutput.url);
        }
      } catch (err) {
        steps.push({
          tool: 'fetch',
          input: fetchInput as unknown as Record<string, unknown>,
          output: {},
          durationMs: Date.now() - fetchStart,
          error: err instanceof Error ? err.message : String(err),
        });
      }

      stepCount++;
    }

    return {
      taskId: task.id,
      steps,
      collectedContent: collectedContent.join('\n\n---\n\n'),
      collectedUrls,
      totalDurationMs: Date.now() - startTime,
    };
  } catch (err) {
    log.error('executeTask failed', { taskId: task.id, error: String(err) });
    return {
      taskId: task.id,
      steps,
      collectedContent: collectedContent.join('\n\n---\n\n'),
      collectedUrls,
      totalDurationMs: Date.now() - startTime,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

```

### Core Architecture Module: `benchmarks/agent/types.ts`
```
export type TaskType = 'fact-lookup' | 'multi-step-research' | 'data-extraction' | 'comparison' | 'code-docs';

export interface AgentTask {
  id: string;
  type: TaskType;
  description: string;
  query: string;
  expectedUrls?: string[];
  expectedDomains?: string[];
  tags?: string[];
  maxSteps?: number;
  timeoutMs?: number;
}

export interface ExpectedFact {
  taskId: string;
  fact: string;
  required: boolean;
  category?: 'factual' | 'citation' | 'completeness';
}

export interface ExpectedOutput {
  taskId: string;
  facts: ExpectedFact[];
  minimumFactCount?: number;
}

export interface FactEvaluation {
  fact: string;
  required: boolean;
  found: boolean;
  matchType: 'exact' | 'substring' | 'semantic' | 'not-found';
  matchedIn?: string;
  confidence: number;
}

export interface TaskEvaluation {
  taskId: string;
  taskType: TaskType;
  query: string;
  factEvaluations: FactEvaluation[];
  factsFound: number;
  factsTotal: number;
  requiredFactsFound: number;
  requiredFactsTotal: number;
  factualAccuracy: number;
  citationAccuracy: number;
  completeness: number;
  pagesFetched: number;
  totalSteps: number;
  latencyMs: number;
  error?: string;
}

export interface AgentBenchmarkSummary {
  totalTasks: number;
  successfulTasks: number;
  failedTasks: number;
  taskCompletionRate: number;
  averageFactualAccuracy: number;
  averageCitationAccuracy: number;
  averageCompleteness: number;
  averagePagesFetched: number;
  averageLatencyMs: number;
  averageTokenEfficiency: number;
  byTaskType: Record<string, TaskTypeSummary>;
}

export interface TaskTypeSummary {
  count: number;
  completionRate: number;
  averageAccuracy: number;
  averageCompleteness: number;
  averageLatencyMs: number;
  tokenEfficiency?: number;
}

export interface AgentBenchmarkReport {
  runDate: string;
  durationMs: number;
  summary: AgentBenchmarkSummary;
  results: TaskEvaluation[];
}

export interface AgentRunnerOptions {
  tasksPath: string;
  expectedPath: string;
  outputDir: string;
  filter?: string;
  verbose?: boolean;
  maxConcurrency?: number;
}

export interface ExecutionStep {
  tool: 'search' | 'fetch';
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  durationMs: number;
  error?: string;
}

export interface TaskExecutionResult {
  taskId: string;
  steps: ExecutionStep[];
  collectedContent: string;
  collectedUrls: string[];
  totalDurationMs: number;
  error?: string;
}

```

### Core Architecture Module: `benchmarks/embedding/runner.ts`
```
#!/usr/bin/env node
/**
 * Embedding quality bench — nDCG@5, nDCG@10, MRR.
 *
 * Loads the fixed corpus + queries from benchmarks/search/fixtures/, embeds
 * all judged documents plus each query via fastembed, ranks by cosine
 * similarity, and computes retrieval quality metrics.
 *
 * Gated on RUN_FASTEMBED=1 (requires huggingface.co network for ONNX model).
 *
 * Run on dev host:
 *   RUN_FASTEMBED=1 tsx benchmarks/embedding/runner.ts
 *
 * Output: benchmarks/embedding/output/results.json
 *
 * Quality gates:
 *   nDCG@5  ≥ legacy baseline
 *   nDCG@10 ≥ legacy baseline
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FastembedEmbedProvider } from '../../src/embedding/fastembed-provider.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const FIXTURES_DIR = join(REPO_ROOT, 'benchmarks', 'search', 'fixtures');
const OUT_DIR = join(REPO_ROOT, 'benchmarks', 'embedding', 'output');
const BASELINE_PATH = join(OUT_DIR, 'baseline.json');

if (!process.env.RUN_FASTEMBED) {
  process.stderr.write(
    '[bench:embedding] Skipped. Set RUN_FASTEMBED=1 to run (requires huggingface.co network).\n',
  );
  process.exit(0);
}

// ── Math helpers ─────────────────────────────────────────────────────────────

function cosine(a: Float32Array, b: Float32Array): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

function dcg(relevances: number[]): number {
  return relevances.reduce(
    (acc, rel, i) => acc + (Math.pow(2, rel) - 1) / Math.log2(i + 2),
    0,
  );
}

function ndcgAtK(relevances: number[], idealRelevances: number[], k: number): number {
  const d = dcg(relevances.slice(0, k));
  const ideal = dcg([...idealRelevances].sort((a, b) => b - a).slice(0, k));
  return ideal === 0 ? 0 : d / ideal;
}

function mrr(relevances: number[]): number {
  const firstRel = relevances.findIndex(r => r > 0);
  return firstRel === -1 ? 0 : 1 / (firstRel + 1);
}

// ── Fixture types ─────────────────────────────────────────────────────────────

interface QueryFixture {
  id: string;
  query: string;
  category?: string;
}

interface RelevanceJudgment {
  queryId: string;
  url: string;
  grade: number;
}

interface QueriesFile {
  queries: QueryFixture[];
}

interface RelevanceFile {
  judgments: RelevanceJudgment[];
}

// ── Result types ──────────────────────────────────────────────────────────────

interface QueryResult {
  queryId: string;
  query: string;
  ndcg5: number;
  ndcg10: number;
  mrr: number;
  rankedUrls: string[];
}

interface AggregateMetrics {
  ndcg5: number;
  ndcg10: number;
  mrr: number;
}

interface BenchResults {
  timestamp: string;
  modelId: string;
  dim: number;
  queryCount: number;
  docCount: number;
  queries: QueryResult[];
  aggregate: AggregateMetrics;
  baselineComparison?: {
    baselineTimestamp: string;
    deltaNdcg5: number;
    deltaNdcg10: number;
    deltaMrr: number;
    gateNdcg5Pass: boolean;
    gateNdcg10Pass: boolean;
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const queriesPath = join(FIXTURES_DIR, 'queries.json');
  const relevancePath = join(FIXTURES_DIR, 'relevance.json');

  if (!existsSync(queriesPath) || !existsSync(relevancePath)) {
    process.stderr.write(
      `[bench:embedding] Fixtures missing.\n  Expected: ${queriesPath}\n           ${relevancePath}\n`,
    );
    process.exit(2);
  }

  const queriesFile = JSON.parse(readFileSync(queriesPath, 'utf-8')) as QueriesFile;
  const relevanceFile = JSON.parse(readFileSync(relevancePath, 'utf-8')) as RelevanceFile;

  const queries = queriesFile.queries;
  const judgments = relevanceFile.judgments;

  // Build a map: queryId -> { url -> grade }
  const relevanceMap = new Map<string, Map<string, number>>();
  for (const j of judgments) {
    if (!relevanceMap.has(j.queryId)) relevanceMap.set(j.queryId, new Map());
    relevanceMap.get(j.queryId)!.set(j.url, j.grade);
  }

  // Collect all unique judged URLs as the corpus
  const allUrls = [...new Set(judgments.map(j => j.url))];
  // Use URLs as document text (realistic proxy for what would be doc snippets)
  const docTexts = allUrls;

  process.stderr.write(
    `[bench:embedding] Loaded ${queries.length} queries, ${judgments.length} judgments, ${allUrls.length} unique docs\n`,
  );

  const provider = new FastembedEmbedProvider();
  process.stderr.write('[bench:embedding] Warming up model...\n');
  await provider.warmup();
  process.stderr.write(`[bench:embedding] Model ready: ${provider.modelId} (dim=${provider.dim})\n`);

  // Embed all documents in one batch
  process.stderr.write('[bench:embedding] Embedding corpus...\n');
  const docEmbeddings = await provider.embed(docTexts);

  // Embed all queries in one batch
  const queryTexts = queries.map(q => q.query);
  process.stderr.write('[bench:embedding] Embedding queries...\n');
  const queryEmbeddings = await provider.embed(queryTexts);

  const queryResults: QueryResult[] = [];

  for (let qi = 0; qi < queries.length; qi++) {
    const q = queries[qi];
    const qVec = queryEmbeddings[qi];
    const qRelevance = relevanceMap.get(q.id);

    if (!qRelevance || qRelevance.size === 0) {
      // No judgments for this query — skip
      continue;
    }

    // Score each doc by cosine similarity
    const scored = allUrls.map((url, di) => ({
      url,
      score: cosine(qVec, docEmbeddings[di]),
    }));
    scored.sort((a, b) => b.score - a.score);

    // Extract ordered relevance grades (0 for unjudged docs)
    const rankedRelevances = scored.map(s => qRelevance.get(s.url) ?? 0);
    const idealRelevances = [...qRelevance.values()];

    const qNdcg5 = ndcgAtK(rankedRelevances, idealRelevances, 5);
    const qNdcg10 = ndcgAtK(rankedRelevances, idealRelevances, 10);
    const qMrr = mrr(rankedRelevances);

    queryResults.push({
      queryId: q.id,
      query: q.query,
      ndcg5: qNdcg5,
      ndcg10: qNdcg10,
      mrr: qMrr,
      rankedUrls: scored.slice(0, 10).map(s => s.url),
    });
  }

  const n = queryResults.length;
  const aggregate: AggregateMetrics =
    n === 0
      ? { ndcg5: 0, ndcg10: 0, mrr: 0 }
      : {
          ndcg5: queryResults.reduce((s, r) => s + r.ndcg5, 0) / n,
          ndcg10: queryResults.reduce((s, r) => s + r.ndcg10, 0) / n,
          mrr: queryResults.reduce((s, r) => s + r.mrr, 0) / n,
        };

  process.stderr.write(
    `[bench:embedding] Aggregate nDCG@5=${aggregate.ndcg5.toFixed(4)}  nDCG@10=${aggregate.ndcg10.toFixed(4)}  MRR=${aggregate.mrr.toFixed(4)}\n`,
  );

  const results: BenchResults = {
    timestamp: new Date().toISOString(),
    modelId: provider.modelId,
    dim: provider.dim,
    queryCount: n,
    docCount: allUrls.length,
    queries: queryResults,
    aggregate,
  };

  // Compare to baseline if it exists
  if (existsSync(BASELINE_PATH)) {
    const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf-8')) as {
      timestamp: string;
      aggregate: AggregateMetrics;
    };
    results.baselineComparison = {
      baselineTimestamp: baseline.timestamp,
      deltaNdcg5: aggregate.ndcg5 - baseline.aggregate.ndcg5,
      deltaNdcg10: aggregate.ndcg10 - baseline.aggregate.ndcg10,
      deltaMrr: aggregate.mrr - baseline.aggregate.mrr,
      gateNdcg5Pass: aggregate.ndcg5 >= baseline.aggregate.ndcg5,
      gateNdcg10Pass: aggregate.ndcg10 >= baseline.aggregate.ndcg10,
    };
    process.stderr.write(
      `[bench:embedding] vs baseline: ΔnDCG@5=${results.baselineComparison.deltaNdcg5.toFixed(4)} gate=${results.baselineComparison.gateNdcg5Pass ? 'PASS' : 'FAIL'}\n`,
    );
  } else {
    process.stderr.write(
      `[bench:embed
```

### Core Architecture Module: `benchmarks/extraction/metrics.ts`
```
import { createLogger } from '../../src/logger.js';
import { tokenize, longestCommonSubsequence, tokenOverlap } from './tokenizer.js';
import type { MetricResult } from './types.js';

const log = createLogger('extract');

export function computePrecision(extracted: string, golden: string): number {
  try {
    const extractedTokens = tokenize(extracted);
    const goldenTokens = tokenize(golden);
    if (extractedTokens.length === 0 || goldenTokens.length === 0) return 0;

    const { precision } = tokenOverlap(extractedTokens, goldenTokens);
    return precision;
  } catch (err) {
    log.warn('computePrecision failed', { error: String(err) });
    return 0;
  }
}

export function computeRecall(extracted: string, golden: string): number {
  try {
    const extractedTokens = tokenize(extracted);
    const goldenTokens = tokenize(golden);
    if (extractedTokens.length === 0 || goldenTokens.length === 0) return 0;

    const { recall } = tokenOverlap(extractedTokens, goldenTokens);
    return recall;
  } catch (err) {
    log.warn('computeRecall failed', { error: String(err) });
    return 0;
  }
}

export function computeF1(extracted: string, golden: string): number {
  try {
    const p = computePrecision(extracted, golden);
    const r = computeRecall(extracted, golden);
    if (p + r === 0) return 0;
    return (2 * p * r) / (p + r);
  } catch (err) {
    log.warn('computeF1 failed', { error: String(err) });
    return 0;
  }
}

export function computeRougeL(extracted: string, golden: string): number {
  try {
    const extractedTokens = tokenize(extracted);
    const goldenTokens = tokenize(golden);
    if (extractedTokens.length === 0 || goldenTokens.length === 0) return 0;

    const lcsLen = longestCommonSubsequence(extractedTokens, goldenTokens);
    if (lcsLen === 0) return 0;

    const precision = lcsLen / extractedTokens.length;
    const recall = lcsLen / goldenTokens.length;

    if (precision + recall === 0) return 0;
    return (2 * precision * recall) / (precision + recall);
  } catch (err) {
    log.warn('computeRougeL failed', { error: String(err) });
    return 0;
  }
}

export function countHeadings(markdown: string): number {
  try {
    if (!markdown) return 0;
    const matches = markdown.match(/^#{1,6}\s+/gm);
    return matches ? matches.length : 0;
  } catch (err) {
    log.warn('countHeadings failed', { error: String(err) });
    return 0;
  }
}

export function countLinks(markdown: string): number {
  try {
    if (!markdown) return 0;
    const matches = markdown.match(/(?<!!)\[[^\]]*\]\([^)]+\)/g);
    return matches ? matches.length : 0;
  } catch (err) {
    log.warn('countLinks failed', { error: String(err) });
    return 0;
  }
}

export function computeMetrics(extracted: string, golden: string): MetricResult {
  try {
    const precision = computePrecision(extracted, golden);
    const recall = computeRecall(extracted, golden);
    const f1 = computeF1(extracted, golden);
    const rougeL = computeRougeL(extracted, golden);

    const headingCountActual = countHeadings(extracted);
    const headingCountExpected = countHeadings(golden);
    const linkCountActual = countLinks(extracted);
    const linkCountExpected = countLinks(golden);

    return {
      precision,
      recall,
      f1,
      rougeL,
      headingCountMatch: headingCountActual === headingCountExpected,
      headingCountExpected,
      headingCountActual,
      linkCountMatch: linkCountActual === linkCountExpected,
      linkCountExpected,
      linkCountActual,
    };
  } catch (err) {
    log.warn('computeMetrics failed', { error: String(err) });
    return {
      precision: 0,
      recall: 0,
      f1: 0,
      rougeL: 0,
      headingCountMatch: false,
      headingCountExpected: 0,
      headingCountActual: 0,
      linkCountMatch: false,
      linkCountExpected: 0,
      linkCountActual: 0,
    };
  }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #195** (2026-07-19): **Security and quality isn't working**
  *Symptoms*: Quick heads-up: the **Report a vulnerability** link under **Security → Advisories** (`…/security/advisories/new`) returns a 404, which means **Private Vulnerability Reporting isn't enabled** on this repo. As-is, there's no private channel for someone to responsibly disclose a security issue if one turns up.  Easy fix if you'd like to accept private reports: **Settings → Code security and analysis → Private vulnerability reporting → Enable.**  Nothing to report right now — just flagging the broken link so the channel's ready if anything ever comes up. Cheers!
  **Post-Mortem & Fix Analysis**:
  > Thanks @spartan8806 for pointing it out. I have enabled the Security and Quality option. Feel free to close the issue if you think this has been resolved. Cheers!

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

### Incident Patch 1: `c2b14fa3` (2026-09-27)
**Commit Message**: fix(site): accurate privacy wording and sturdier logo scripts

The comparison tables said query data never leaves the machine, but
wigolo's searches go to the search engines it queries; the row now
says where queries go, with no vendor in between. The analytics
disclosure describes Umami as anonymous, cookieless session counting,
and the tag no longer records URL query strings.

fetch-logos records a failed download and moves on instead of
aborting the run, and mine reports a final non-OK GitHub response with
its status instead of a TypeError.

**File**: `SPONSORS.md` (modified, +4/-4)
```diff
@@ -113,10 +113,10 @@ What is measured:
   pageviews, and Google Search Console impressions for the site's pages. README
   impressions can't be counted accurately, because GitHub proxies and caches
   images; repo views are the stand-in, and they're described as exactly that.
-- **What is never collected** — no cookies, no local storage, no personal
-  data, and nothing that identifies an individual visitor. The site uses
-  cookieless analytics (Umami) and honours Do Not Track. The wigolo tool itself
-  sends nothing to the site; this covers the website only.
+- **What is collected** — anonymous page views and events, grouped into
+  sessions without cookies or local storage, with URL query strings left out.
+  The site uses Umami and honours Do Not Track. The wigolo tool itself sends
+  nothing to the site; this covers the website only.
 
 The implementation is in [`site/src/lib/sponsors.ts`](site/src/lib/sponsors.ts),
 [`site/src/lib/analytics.ts`](site/src/lib/analytics.ts) and the interstitial in
```

**File**: `site/scripts/logo-wall/fetch-logos.mjs` (modified, +7/-1)
```diff
@@ -92,7 +92,13 @@ for (const c of companies) {
       problems.push(`${c.name}: unknown logo source "${c.logo.source}"`);
       continue;
     }
-    const res = await fetch(url, { redirect: "follow" });
+    let res;
+    try {
+      res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(15000) });
+    } catch (e) {
+      problems.push(`${c.name}: ${url} → ${e.message}`);
+      continue;
+    }
     const type = res.headers.get("content-type") ?? "";
     if (!res.ok || !type.startsWith("image/")) {
       problems.push(`${c.name}: ${url} → ${res.status} ${type}`);
```

**File**: `site/scripts/logo-wall/mine.mjs` (modified, +1/-0)
```diff
@@ -42,6 +42,7 @@ async function gql(query, variables, attempt = 1) {
     await new Promise((r) => setTimeout(r, 2000 * attempt));
     return gql(query, variables, attempt + 1);
   }
+  if (!res.ok) throw new Error(`GitHub GraphQL ${res.status}: ${await res.text()}`);
   const body = await res.json();
   if (body.errors?.length) {
     if (attempt < 5) {
```

**File**: `site/src/app/go/[slug]/SponsorCard.tsx` (modified, +2/-2)
```diff
@@ -26,8 +26,8 @@ export default function SponsorCard({
         </a>
         <p className={styles.note}>
           You&rsquo;re being forwarded from a wigolo sponsor link. We count
-          clicks on these links to measure how much reach a placement gets — no
-          cookies, nothing stored about you.
+          clicks on these links to measure how much reach a placement gets, with
+          anonymous, cookieless analytics.
         </p>
       </div>
     </main>
```

**File**: `site/src/app/sponsors/page.tsx` (modified, +1/-1)
```diff
@@ -92,7 +92,7 @@ export default async function SponsorsPage() {
               with the placement it came from, then forwards with a <code>utm_content</code>{" "}
               tag — so
               clicks from the README, the docs and releases show up separately in your analytics and in
-              ours. The site&apos;s analytics are cookieless and store nothing about individual visitors.
+              ours. The site&apos;s analytics are anonymous and cookieless.
               Figures are shared on request.
             </p>
           </section>
```

---

### Incident Patch 2: `60aaeccb` (2026-08-01)
**Commit Message**: fix(fetch): bound the reddit OAuth requests

Neither the token mint nor the data request passed a signal, and the default
fetch has no request timeout. A stalled call held the router's fetch path open
indefinitely rather than falling through to the normal ladder.

Both now carry a 15s ceiling, and the data request combines it with the
caller's signal so cancellation still wins. anySignal's cleanup runs in a
finally — it attaches a listener to the caller's long-lived shared signal, and
skipping it would accumulate one listener per fetch.

Found by CodeRabbit.

**File**: `src/fetch/reddit-api.ts` (modified, +37/-13)
```diff
@@ -26,6 +26,15 @@ import type { RawFetchResult } from '../types.js';
 import type { RedditThread, RedditComment } from '../extraction/site-extractors/reddit.js';
 import { guardFetchUrl } from '../watch/ssrf.js';
 import { createLogger } from '../logger.js';
+import { anySignal } from '../util/abort.js';
+
+/**
+ * Hard ceiling on each Reddit HTTP call. The default `fetch` has no request
+ * timeout, so a stalled token mint or data request would hold the router's
+ * fetch path open until the process exits instead of falling through to the
+ * normal ladder. Combined with any caller signal, so cancellation still wins.
+ */
+const REDDIT_REQUEST_TIMEOUT_MS = 15_000;
 
 /** Fixed OAuth token endpoint — app-only (client-credentials) grant. */
 const TOKEN_URL = 'https://www.reddit.com/api/v1/access_token';
@@ -198,6 +207,7 @@ export class RedditTokenManager {
         'User-Agent': this.creds.userAgent,
       },
       body: 'grant_type=client_credentials',
+      signal: AbortSignal.timeout(REDDIT_REQUEST_TIMEOUT_MS),
       // The token endpoint is a fixed host and must never legitimately
       // redirect. `redirect: 'manual'` disables the auto-follower so a hostile
       // 3xx (e.g. to an internal address) is never followed with the Basic
@@ -430,6 +440,7 @@ export async function fetchViaRedditApi(
   tokenManager: RedditTokenManager,
   creds: RedditCredentials,
   fetchFn: FetchFn = fetch,
+  signal?: AbortSignal,
 ): Promise<RawFetchResult | null> {
   const endpointPath = mapRedditUrlToEndpoint(url);
   if (endpointPath === null) return null;
@@ -443,19 +454,32 @@ export async function fetchViaRedditApi(
   }
 
   const token = await tokenManager.getToken();
-  const res = await fetchFn(endpointUrl, {
-    method: 'GET',
-    headers: {
-      Authorization: `Bearer ${token}`,
-      'User-Agent': creds.userAgent,
-    },
-    // The OAuth data host is fixed and must never legitimately redirect.
-    // `redirect: 'manual'` disables the auto-follower (default: follow, up to
-    // 20 hops) so a hostile 3xx to an internal address is never followed with
-    // the bearer token attached. Any 3xx is rejected below, which makes the
-    // router fall through to the normal fetch ladder.
-    redirect: 'manual',
-  });
+  // Bounded, and still cancellable by the caller — whichever fires first. The
+  // combiner attaches a listener to the caller's (long-lived, shared) signal,
+  // so its cleanup runs as soon as this request settles; skipping it would
+  // accumulate one listener per fetch on that signal.
+  const combined = signal
+    ? anySignal([signal, AbortSignal.timeout(REDDIT_REQUEST_TIMEOUT_MS)])
+    : null;
+  let res: Response;
+  try {
+    res = await fetchFn(endpointUrl, {
+      method: 'GET',
+      headers: {
+        Authorization: `Bearer ${token}`,
+        'User-Agent': creds.userAgent,
+      },
+      signal: combined ? combined.signal : AbortSignal.timeout(REDDIT_REQUEST_TIMEOUT_MS),
+      // The OAuth data host is fixed and must never legitimately redirect.
+      // `redirect: 'manual'` disables the auto-follower (default: follow, up to
+      // 20 hops) so a hostile 3xx to an internal address is never followed with
+      // the bearer token attached. Any 3xx is rejected below, which makes the
+      // router fall through to the normal fetch ladder.
+      redirect: 'manual',
+    });
+  } finally {
+    combined?.cleanup();
+  }
 
   if (res.status >= 300 && res.status < 400) {
     throw new Error(`reddit oauth endpoint returned an unexpected redirect (HTTP ${res.status})`);
```

**File**: `src/fetch/router.ts` (modified, +3/-3)
```diff
@@ -907,7 +907,7 @@ export class SmartRouter {
    * returns null so the caller degrades gracefully to the honest normal ladder
    * rather than hard-failing the whole fetch.
    */
-  private async tryRedditApi(url: string, config: Config): Promise<RawFetchResult | null> {
+  private async tryRedditApi(url: string, config: Config, signal?: AbortSignal): Promise<RawFetchResult | null> {
     const logger = createLogger('fetch');
     const creds: RedditCredentials = {
       // redditApiConfigured() guaranteed both are non-null before this call.
@@ -921,7 +921,7 @@ export class SmartRouter {
       this.redditTokenManager = { key: creds.clientId, mgr: new RedditTokenManager(creds) };
     }
     try {
-      return await fetchViaRedditApi(url, this.redditTokenManager.mgr, creds);
+      return await fetchViaRedditApi(url, this.redditTokenManager.mgr, creds, undefined, signal);
     } catch (err) {
       if (err instanceof RedditRateLimitError) {
         logger.info('reddit-api rate limited — falling through to normal ladder', {
@@ -964,7 +964,7 @@ export class SmartRouter {
       !screenshot &&
       !(actions && actions.length > 0)
     ) {
-      const redditResult = await this.tryRedditApi(url, config);
+      const redditResult = await this.tryRedditApi(url, config, options.signal);
       if (redditResult !== null) return redditResult;
       logger.debug('reddit-api path did not apply — falling through to normal ladder', { url });
     }
```

**File**: `tests/unit/fetch/reddit-api.test.ts` (modified, +43/-0)
```diff
@@ -401,3 +401,46 @@ describe('fetchViaRedditApi', () => {
     expect(calledUrl.hostname).toBe('oauth.reddit.com');
   });
 });
+
+describe('reddit fetches are bounded', () => {
+  // Neither call passed a signal, and the default fetch has no request timeout.
+  // A stalled token mint or data request therefore held the router's fetch path
+  // open indefinitely instead of falling through to the normal ladder.
+  it('passes an abort signal to the token request', async () => {
+    const fetchFn = vi.fn(async (_u: string, init?: RequestInit) => {
+      expect(init?.signal).toBeInstanceOf(AbortSignal);
+      return jsonResponse({ access_token: 't', expires_in: 3600 });
+    }) as unknown as FetchFn;
+    const mgr = new RedditTokenManager(CREDS, fetchFn, () => 0);
+    await mgr.getToken();
+    expect(fetchFn).toHaveBeenCalled();
+  });
+
+  it('passes an abort signal to the data request', async () => {
+    const calls: Array<RequestInit | undefined> = [];
+    const fetchFn = vi.fn(async (u: string, init?: RequestInit) => {
+      calls.push(init);
+      return u.includes('access_token')
+        ? jsonResponse({ access_token: 't', expires_in: 3600 })
+        : jsonResponse({ kind: 'Listing', data: { children: [] } });
+    }) as unknown as FetchFn;
+    const mgr = new RedditTokenManager(CREDS, fetchFn, () => 0);
+    await fetchViaRedditApi('https://www.reddit.com/r/rust/hot', mgr, CREDS, fetchFn);
+    expect(calls.length).toBe(2);
+    for (const c of calls) expect(c?.signal).toBeInstanceOf(AbortSignal);
+  });
+
+  it('aborts the data request when the caller cancels', async () => {
+    const ac = new AbortController();
+    const fetchFn = vi.fn(async (u: string, init?: RequestInit) => {
+      if (u.includes('access_token')) return jsonResponse({ access_token: 't', expires_in: 3600 });
+      ac.abort();
+      expect(init?.signal?.aborted).toBe(true);
+      throw Object.assign(new Error('aborted'), { name: 'AbortError' });
+    }) as unknown as FetchFn;
+    const mgr = new RedditTokenManager(CREDS, fetchFn, () => 0);
+    await expect(
+      fetchViaRedditApi('https://www.reddit.com/r/rust/hot', mgr, CREDS, fetchFn, ac.signal),
+    ).rejects.toThrow();
+  });
+});
```

---

### Incident Patch 3: `daf256ae` (2026-08-01)
**Commit Message**: fix: forward the whole failure-metadata contract from both adapters

The REPL adapter forwarded challenge_class + solve_method but dropped
http_status; the crawl adapter forwarded http_status but dropped the other
two. Each surface exposed a different subset of the same failure, and a
per-adapter subset is exactly how they drift apart.

Without http_status a caller cannot tell an anti-bot 403 from a challenge
served at 200. Both now forward all three.

Found by CodeRabbit.

**File**: `src/repl/commands/fetch.ts` (modified, +3/-0)
```diff
@@ -84,6 +84,9 @@ export async function executeFetch(args: ParsedArgs, deps: ReplDeps): Promise<Fe
       // an honest null solve_method), instead of dropping it in the envelope.
       return {
         ...errEnvelope(url, r.error_reason),
+        // http_status belongs to the same contract: without it a caller cannot
+        // tell an anti-bot 403 from a challenge served at 200.
+        ...(typeof r.http_status === 'number' ? { http_status: r.http_status } : {}),
         ...(r.challenge_class !== undefined ? { challenge_class: r.challenge_class } : {}),
         ...(r.solve_method !== undefined ? { solve_method: r.solve_method } : {}),
       };
```

**File**: `src/tools/crawl.ts` (modified, +5/-1)
```diff
@@ -73,8 +73,12 @@ export async function handleCrawl(
           cached: false,
           error: r.error_reason,
           // Carry the upstream status through when the failure exposes one
-          // (anti-bot 403/429) so the crawl limiter can adapt pace per-domain.
+          // (anti-bot 403/429) so the crawl limiter can adapt pace per-domain,
+          // plus the solve-ladder provenance — the three travel together, and a
+          // per-adapter subset is how the surfaces drift apart.
           ...(typeof r.http_status === 'number' ? { http_status: r.http_status } : {}),
+          ...(r.challenge_class !== undefined ? { challenge_class: r.challenge_class } : {}),
+          ...(r.solve_method !== undefined ? { solve_method: r.solve_method } : {}),
         };
       }
       return r.data;
```

---

### Incident Patch 4: `23ca3c71` (2026-08-01)
**Commit Message**: fix(crawl): clamp the cooldown multiplier when the base delay is zero

maxMultiplier fell back to `next` when delayMs was 0, so the clamp compared a
value against itself and the multiplier doubled on every 403/429 forever.

crawlPrivateDelayMs defaults to 0, so this is the NORMAL state for private
hosts. The wait it produced stayed 0 either way, but the unbounded state lies
in wait for any later change that gives such a domain a real delay. Pin the
ceiling to 1 there instead.

Found by CodeRabbit.

**File**: `src/crawl/rate-limiter.ts` (modified, +6/-1)
```diff
@@ -102,7 +102,12 @@ export class RateLimiter {
     if (status === 403 || status === 429) {
       state.successStreak = 0;
       const next = state.cooldownMultiplier * this.cooldownFactor;
-      const maxMultiplier = state.delayMs > 0 ? this.cooldownMaxMs / state.delayMs : next;
+      // A ZERO base delay (the default for private hosts) has no meaningful
+      // multiplier: scaling it yields 0 either way. Falling back to `next` left
+      // the multiplier uncapped, doubling on every block forever — unbounded
+      // state that also lies in wait for any later change that gives the domain
+      // a non-zero delay. Pin it to 1 instead.
+      const maxMultiplier = state.delayMs > 0 ? this.cooldownMaxMs / state.delayMs : 1;
       state.cooldownMultiplier = Math.min(next, Math.max(1, maxMultiplier));
       return;
     }
```

**File**: `tests/unit/crawl/rate-limiter.test.ts` (modified, +32/-0)
```diff
@@ -210,3 +210,35 @@ describe('RateLimiter adaptive cooldown', () => {
     expect(() => limiter.recordResponse('never-seen.com', 429)).not.toThrow();
   });
 });
+
+describe('RateLimiter — cooldown stays bounded when the base delay is zero', () => {
+  // crawlPrivateDelayMs defaults to 0, so delayMs === 0 is the NORMAL state for
+  // private hosts. maxMultiplier fell back to `next` there, leaving the
+  // multiplier uncapped: it doubled on every 403/429 forever, and any later
+  // change that made a zero base delay non-zero would inherit an absurd wait.
+  it('does not grow the multiplier without bound on repeated blocks', () => {
+    const rl = new RateLimiter({ cooldownFactor: 2, cooldownMaxMs: 30_000, jitterPct: 0, rng: () => 0.5 });
+    rl.registerDomain('http://zero.example/a');
+    // Force the zero-base-delay state this guards.
+    (rl as unknown as { domains: Map<string, { delayMs: number }> }).domains.get('zero.example')!.delayMs = 0;
+
+    for (let i = 0; i < 40; i++) rl.recordResponse('zero.example', 429);
+
+    const m = (rl as unknown as { domains: Map<string, { cooldownMultiplier: number }> })
+      .domains.get('zero.example')!.cooldownMultiplier;
+    expect(Number.isFinite(m)).toBe(true);
+    expect(m).toBeLessThanOrEqual(1);
+    // And the wait it produces is still sane.
+    expect(rl.nextWaitMs('zero.example')).toBe(0);
+  });
+
+  it('still caps a NON-zero base delay at cooldownMaxMs', () => {
+    const rl = new RateLimiter({ cooldownFactor: 2, cooldownMaxMs: 4_000, jitterPct: 0, rng: () => 0.5 });
+    rl.registerDomain('http://slow.example/a');
+    (rl as unknown as { domains: Map<string, { delayMs: number }> }).domains.get('slow.example')!.delayMs = 1_000;
+
+    for (let i = 0; i < 20; i++) rl.recordResponse('slow.example', 403);
+
+    expect(rl.nextWaitMs('slow.example')).toBeLessThanOrEqual(4_000);
+  });
+});
```

---

### Incident Patch 5: `a2b5a68f` (2026-08-01)
**Commit Message**: fix(cache): keep proxy credentials out of the persisted clearance route

solvedRoute is written as `proxyUrl ?? 'direct'`, and proxyUrl is resolved
through resolveCredentialUrl — so it can carry inline `user:pass@`. That went
into the cache DB verbatim, in cleartext, surviving across runs.
persisted-config.ts already treats credential-bearing URLs as secrets that
must never reach disk in cleartext; this contradicted that posture.

The reuse gate only needs EQUALITY of the egress route, never the original
string. routeIdentity() reduces it to scheme//host:port.

It lives in store.ts — the actual disk boundary, so no caller can bypass it —
and clearance-reuse imports the SAME function for the comparison side. Two
different reductions would have silently killed reuse for every proxy user,
which the test pins: a clearance minted from the credential-bearing config
must still match the current route derived from that same raw URL, while two
different proxies stay distinguishable.

cache/store imports nothing from fetch/, so the value import is cycle-free.

Found by CodeRabbit.

**File**: `src/cache/store.ts` (modified, +29/-1)
```diff
@@ -817,6 +817,34 @@ export function getDomainClearance(host: string): DomainClearance | null {
 }
 
 /** Store (or replace) the anti-bot clearance for a host. */
+/**
+ * The stable, NON-SECRET identity of an egress route.
+ *
+ * `solvedRoute` is supplied as `proxyUrl ?? 'direct'`, and proxyUrl is resolved
+ * through `resolveCredentialUrl` — so it can carry inline `user:pass@`. The
+ * reuse gate only ever needs EQUALITY of the route, never the original string,
+ * and persisted-config.ts already treats credential-bearing URLs as secrets
+ * that must not reach disk in cleartext. Strip the userinfo down to
+ * `scheme//host:port` so the cache DB never holds a credential, while two
+ * different proxies stay distinguishable.
+ *
+ * Lives here, at the disk boundary, so no caller can bypass it; the comparison
+ * side imports the same function so both ends agree.
+ */
+export function routeIdentity(route: string | undefined | null): string {
+  if (route == null) return 'direct';
+  const trimmed = route.trim();
+  if (trimmed.length === 0 || trimmed === 'direct') return 'direct';
+  try {
+    const u = new URL(trimmed);
+    return `${u.protocol}//${u.hostname}${u.port ? `:${u.port}` : ''}`;
+  } catch {
+    // Not a URL (a label, or malformed). It carries no userinfo to leak, so
+    // keep it as-is rather than collapsing distinct routes into 'direct'.
+    return trimmed;
+  }
+}
+
 export function recordDomainClearance(host: string, clearance: DomainClearance): void {
   try {
     const db = getDatabase();
@@ -839,7 +867,7 @@ export function recordDomainClearance(host: string, clearance: DomainClearance):
       clearance.ua,
       clearance.tier,
       clearance.expiresAt,
-      clearance.solvedRoute ?? 'direct',
+      routeIdentity(clearance.solvedRoute),
     );
   } catch (err) {
     log.warn('recordDomainClearance failed', { host, error: err instanceof Error ? err.message : String(err) });
```

**File**: `src/fetch/clearance-reuse.ts` (modified, +6/-3)
```diff
@@ -1,4 +1,5 @@
 import { currentStealthChromeMajor } from './stealth.js';
+import { routeIdentity } from '../cache/store.js';
 import type { DomainClearance } from '../cache/store.js';
 
 /**
@@ -61,9 +62,11 @@ export function isClearanceFresh(clearance: DomainClearance, now: number): boole
  * existed.
  */
 export function normalizeClearanceRoute(route: string | undefined | null): string {
-  if (route == null) return 'direct';
-  const trimmed = route.trim();
-  return trimmed.length === 0 ? 'direct' : trimmed;
+  // Same reduction the store applies on write, so a clearance minted while the
+  // configured proxyUrl carried credentials still matches the current route
+  // derived from that same raw URL. Using a different rule on either side would
+  // silently kill reuse for every proxy user.
+  return routeIdentity(route);
 }
 
 /**
```

**File**: `tests/unit/cache/clearance-route-secret.test.ts` (added, +90/-0)
```diff
@@ -0,0 +1,90 @@
+import { describe, it, expect, beforeEach, afterEach } from 'vitest';
+import { mkdtempSync, rmSync } from 'node:fs';
+import { tmpdir } from 'node:os';
+import { join } from 'node:path';
+import { initDatabase, closeDatabase, getDatabase } from '../../../src/cache/db.js';
+import { _resetMigrationGuard } from '../../../src/cache/migrations/runner.js';
+import { getDomainClearance, recordDomainClearance } from '../../../src/cache/store.js';
+import { routeMatchesClearance, normalizeClearanceRoute } from '../../../src/fetch/clearance-reuse.js';
+
+/**
+ * `solvedRoute` is written as `getConfig().proxyUrl ?? 'direct'`, and proxyUrl
+ * is resolved through resolveCredentialUrl — so it can carry inline
+ * `user:pass@`. Persisting it verbatim wrote those credentials into the cache
+ * DB in cleartext, where they survive across runs. persisted-config.ts already
+ * treats credential-bearing URLs as secrets that must never reach disk in
+ * cleartext; this contradicted that posture.
+ *
+ * The gate only needs EQUALITY of the egress route, never the original string.
+ */
+const CRED_PROXY = 'http://alice:hunter2@proxy.example.com:8080';
+
+describe('a clearance never persists proxy credentials', () => {
+  let dir: string;
+
+  beforeEach(() => {
+    _resetMigrationGuard();
+    dir = mkdtempSync(join(tmpdir(), 'wigolo-route-secret-'));
+    initDatabase(join(dir, 'cache.db'));
+  });
+  afterEach(() => {
+    closeDatabase();
+    rmSync(dir, { recursive: true, force: true });
+  });
+
+  function record(route: string) {
+    recordDomainClearance('example.com', {
+      cookie: 'cf_clearance=TOKEN',
+      ua: 'Mozilla/5.0 Chrome/142.0.0.0',
+      tier: 'browser',
+      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
+      solvedRoute: route,
+    });
+  }
+
+  it('strips userinfo before the value reaches the database', () => {
+    record(CRED_PROXY);
+    const raw = getDatabase()
+      .prepare('SELECT solved_route FROM domain_routing WHERE domain = ?')
+      .get('example.com') as { solved_route: string };
+
+    expect(raw.solved_route).not.toContain('hunter2');
+    expect(raw.solved_route).not.toContain('alice');
+    expect(raw.solved_route).toContain('proxy.example.com');
+  });
+
+  it('keeps the route distinguishable — different proxies must not collide', () => {
+    record(CRED_PROXY);
+    const a = getDomainClearance('example.com')!.solvedRoute;
+    record('http://bob:pw@other.example.com:8080');
+    const b = getDomainClearance('example.com')!.solvedRoute;
+    expect(a).not.toBe(b);
+  });
+
+  it('still matches the SAME proxy computed from the credential-bearing config', () => {
+    // The mint side stores the stripped identity; the compare side derives the
+    // current route from the raw configured proxyUrl. They must agree, or reuse
+    // silently dies for every proxy user.
+    record(CRED_PROXY);
+    const stored = getDomainClearance('example.com')!;
+    expect(routeMatchesClearance(stored.solvedRoute, CRED_PROXY)).toBe(true);
+  });
+
+  it('does NOT match a different proxy', () => {
+    record(CRED_PROXY);
+    const stored = getDomainClearance('example.com')!;
+    expect(routeMatchesClearance(stored.solvedRoute, 'http://elsewhere.example:3128')).toBe(false);
+  });
+
+  it('leaves the direct route alone', () => {
+    record('direct');
+    expect(getDomainClearance('example.com')!.solvedRoute).toBe('direct');
+    expect(routeMatchesClearance('direct', 'direct')).toBe(true);
+  });
+
+  it('normalizes both sides of the comparison identically', () => {
+    expect(normalizeClearanceRoute(CRED_PROXY)).toBe(
+      normalizeClearanceRoute('http://proxy.example.com:8080'),
+    );
+  });
+});
```

---

### Incident Patch 6: `72844239` (2026-08-01)
**Commit Message**: fix(fetch): stop stranding the hosted browser, and drive a frame that exists

Two defects on the hosted / solve paths.

The hosted browser was assigned and then handed to newContext() BEFORE the
main try/finally that closes it, so a context failure leaked it — remotely,
where it keeps billing. It now closes and degrades to a local browser, the
same way a failed connect already did.

challengeSolveFrame looped selectors inside a try/catch, but
page.frameLocator() builds a LAZY locator and never throws when nothing
matches. The catch could not fire, so the loop always returned the FIRST
selector: every vision solve drove the reCAPTCHA bframe locator and hCaptcha
frames were never targeted at all. Probe the underlying iframe element and
return the frame that is actually present.

Both found by CodeRabbit.

**File**: `src/fetch/browser-pool.ts` (modified, +37/-9)
```diff
@@ -88,6 +88,13 @@ const WIDGET_FRAME_SELECTORS = [
 
 /** How many selectors a total miss pays for. Exported so the budget contract is
  *  assertable without reaching into the private locator. */
+/** Cross-origin frames a vision solve drives into, most specific first. */
+const CHALLENGE_FRAME_SELECTORS = [
+  'iframe[src*="api2/bframe"]',
+  'iframe[src*="hcaptcha.com"]',
+  'iframe[title*="challenge" i]',
+] as const;
+
 export const WIDGET_LOCATE_SELECTOR_COUNT =
   WIDGET_DOC_SELECTORS.length + WIDGET_FRAME_SELECTORS.length;
 
@@ -690,8 +697,20 @@ export class MultiBrowserPool {
         // Treat the hosted browser like the pinned-CDP browser so the shared
         // finally closes it (never released to the local pool).
         cdpBrowser = scrapingHandle.browser;
-        const contexts = cdpBrowser.contexts();
-        ctx = contexts.length > 0 ? contexts[0] : await cdpBrowser.newContext();
+        try {
+          const contexts = cdpBrowser.contexts();
+          ctx = contexts.length > 0 ? contexts[0] : await cdpBrowser.newContext();
+        } catch (err) {
+          // This runs BEFORE the main try/finally, so a context failure here
+          // would strand the hosted browser — and a hosted one keeps running
+          // (and billing) remotely. Close it and degrade like a failed connect.
+          log.warn('hosted scraping-browser context creation failed, falling back to a local browser', {
+            error: err instanceof Error ? err.message : String(err),
+          });
+          await scrapingHandle.close().catch(() => {});
+          cdpBrowser = null;
+          ctx = await this.acquireForType(resolvedType);
+        }
       } else {
         // Off / bad scheme / connect failed → graceful fall back to launch.
         ctx = await this.acquireForType(resolvedType);
@@ -1520,12 +1539,21 @@ export class MultiBrowserPool {
 
   /** The cross-origin reCAPTCHA image-select (bframe) / hCaptcha challenge frame
    *  a vision solve drives into, or null when it can't be resolved. */
-  private challengeSolveFrame(page: import('playwright').Page) {
+  private async challengeSolveFrame(page: import('playwright').Page) {
     if (typeof page.frameLocator !== 'function') return null;
-    for (const sel of ['iframe[src*="api2/bframe"]', 'iframe[src*="hcaptcha.com"]', 'iframe[title*="challenge" i]']) {
-      try {
-        return page.frameLocator(sel).first();
-      } catch { /* try next selector */ }
+    // `frameLocator` builds a LAZY locator — it does not throw when no matching
+    // frame exists, so a try/catch around it never fires and the loop always
+    // returned the FIRST selector. hCaptcha and generic challenge frames were
+    // therefore never targeted: every solve drove the reCAPTCHA bframe locator,
+    // matching nothing. Probe the underlying iframe element instead.
+    for (const sel of CHALLENGE_FRAME_SELECTORS) {
+      const present = await page
+        .locator(sel)
+        .first()
+        .count()
+        .then((n) => n > 0)
+        .catch(() => false);
+      if (present) return page.frameLocator(sel).first();
     }
     return null;
   }
@@ -1534,7 +1562,7 @@ export class MultiBrowserPool {
    *  0-based left-to-right, top-to-bottom; the frame exposes them as a table of
    *  cells. Best-effort per tile so one un-clickable index never aborts the set. */
   private async clickChallengeTiles(page: import('playwright').Page, indices: number[]): Promise<void> {
-    const frame = this.challengeSolveFrame(page);
+    const frame = await this.challengeSolveFrame(page);
     if (!frame) return;
     for (const idx of indices) {
       const cell = frame.locator('table td, .task-image').nth(idx);
@@ -1563,7 +1591,7 @@ export class MultiBrowserPool {
 
   /** Press the verify/submit control of the challenge (grid + text captchas). */
   private async submitChallenge(page: import('playwright').Page): Promise<void> {
-    const frame = this.challengeSolveFrame(page);
+    const
```

---

### Incident Patch 7: `c1d7515a` (2026-08-01)
**Commit Message**: fix(fetch): close a hosted browser that connects after timeout or abort

withTimeoutAndAbort rejects on whichever fires first, but the underlying
connect(wss) keeps running. When it later resolved, the fulfilment handler
saw settled === true and returned without closing it.

Nobody was waiting for that browser and nobody would ever close it — and it
is a HOSTED one, so it kept running (and billing) on the provider's side
until their own idle timeout. Close it instead, best-effort and detached,
since by then there is no caller a rejection could reach.

**File**: `src/fetch/scraping-browser.ts` (modified, +21/-1)
```diff
@@ -145,6 +145,19 @@ export async function connectScrapingBrowser(
  * Race a connect promise against a timeout and an abort signal. Rejects on
  * whichever fires first so a hung / slow hosted endpoint never blocks forever.
  */
+/** Best-effort close of a browser nobody is waiting for any more. Never throws
+ *  — it runs detached from any caller, so a rejection here has nowhere to go. */
+async function closeStrandedBrowser(value: unknown): Promise<void> {
+  const closable = value as { close?: () => Promise<void> | void } | null;
+  if (!closable || typeof closable.close !== 'function') return;
+  try {
+    await closable.close();
+    defaultLogger.debug('scraping-browser: closed a connection that arrived after timeout/abort');
+  } catch {
+    /* nothing further we can do from here */
+  }
+}
+
 function withTimeoutAndAbort<T>(
   promise: Promise<T>,
   timeoutMs: number,
@@ -181,7 +194,14 @@ function withTimeoutAndAbort<T>(
 
     promise.then(
       (value) => {
-        if (settled) return;
+        if (settled) {
+          // The connect won the race against nothing — we already rejected on
+          // timeout/abort and the caller has moved on. Nobody will ever close
+          // this browser, and it is a HOSTED one: left open it keeps running
+          // (and billing) on the provider's side until their own idle timeout.
+          void closeStrandedBrowser(value);
+          return;
+        }
         settled = true;
         cleanup();
         resolve(value);
```

**File**: `tests/unit/fetch/resource-leak-guards.test.ts` (added, +72/-0)
```diff
@@ -0,0 +1,72 @@
+import { describe, it, expect, vi } from 'vitest';
+import { connectScrapingBrowser } from '../../../src/fetch/scraping-browser.js';
+
+/**
+ * Both opt-in browser paths could strand a live browser:
+ *
+ *  - `withTimeoutAndAbort` rejects on timeout/abort, but the underlying
+ *    `connect(wss)` keeps running. When it later resolved, the fulfilment
+ *    handler saw `settled === true` and returned WITHOUT closing it — a hosted
+ *    browser left running on the provider's side, billed, until it timed out
+ *    there.
+ *  - The pool assigned the hosted browser and then called `newContext()`
+ *    outside the try/finally that closes it, so a context failure leaked it.
+ */
+describe('scraping-browser never strands a browser that arrives late', () => {
+  it('closes a browser that connects AFTER the timeout fired', async () => {
+    const close = vi.fn().mockResolvedValue(undefined);
+    let resolveConnect: (b: unknown) => void = () => {};
+    const connect = vi.fn(
+      () => new Promise((res) => { resolveConnect = res; }),
+    ) as never;
+
+    const handle = await connectScrapingBrowser({
+      wss: 'wss://user:pass@host.example:9222',
+      timeoutMs: 20,
+      connect,
+    });
+    expect(handle).toBeNull(); // timed out
+
+    // The provider answers late. Nothing is waiting for it any more, so the
+    // only correct action is to close it.
+    resolveConnect({ close });
+    await vi.waitFor(() => expect(close).toHaveBeenCalledTimes(1));
+  });
+
+  it('closes a browser that connects AFTER an abort', async () => {
+    const close = vi.fn().mockResolvedValue(undefined);
+    let resolveConnect: (b: unknown) => void = () => {};
+    const connect = vi.fn(
+      () => new Promise((res) => { resolveConnect = res; }),
+    ) as never;
+    const ac = new AbortController();
+
+    const pending = connectScrapingBrowser({
+      wss: 'wss://host.example:9222',
+      timeoutMs: 5_000,
+      connect,
+      signal: ac.signal,
+    });
+    ac.abort();
+    expect(await pending).toBeNull();
+
+    resolveConnect({ close });
+    await vi.waitFor(() => expect(close).toHaveBeenCalledTimes(1));
+  });
+
+  it('does NOT close a browser that arrives in time', async () => {
+    const close = vi.fn().mockResolvedValue(undefined);
+    const connect = vi.fn(async () => ({ close })) as never;
+
+    const handle = await connectScrapingBrowser({
+      wss: 'wss://host.example:9222',
+      timeoutMs: 5_000,
+      connect,
+    });
+
+    expect(handle).not.toBeNull();
+    expect(close).not.toHaveBeenCalled();
+    await handle!.close();
+    expect(close).toHaveBeenCalledTimes(1);
+  });
+});
```

---

### Incident Patch 8: `72fbc3c3` (2026-08-01)
**Commit Message**: fix(fetch): stop the slider heuristic firing on ordinary page furniture

hasSliderMarker required a corroborating hint, but the hint could be
satisfied by the token that triggered the check: `'slider'.includes('slide')`
is true, so `sliderish && (puzzle || slide)` was vacuous for every page
carrying a carousel, a range input, or `class="slider"`.

Those pages classified as a drag puzzle, and the vision rung would attempt a
drag gesture on them.

The corroboration must be a SEPARATE signal, so it is now puzzle/verify/
captcha. GeeTest and slidebg still short-circuit ahead of it, and a slider
co-present with a real puzzle hint still resolves.

Found by CodeRabbit.

**File**: `src/fetch/challenge-classify.ts` (modified, +7/-2)
```diff
@@ -280,9 +280,14 @@ export function classifyImageSubType(html: string): ImageSolveSubType {
 function hasSliderMarker(lower: string): boolean {
   if (lower.includes('geetest')) return true;
   if (lower.includes('slidebg')) return true;
+  // The corroborating hint must be a SEPARATE signal from the token that
+  // triggered the check. `'slider'.includes('slide')` made the old guard
+  // vacuous: every carousel, range input and `class="slider"` satisfied its own
+  // corroboration and classified as a drag puzzle, so the vision rung would
+  // attempt a drag on ordinary UI.
   const sliderish = lower.includes('slider') || lower.includes('drag');
-  if (sliderish && (lower.includes('puzzle') || lower.includes('slide'))) return true;
-  return false;
+  if (!sliderish) return false;
+  return lower.includes('puzzle') || lower.includes('verify') || lower.includes('captcha');
 }
 
 /**
```

**File**: `tests/unit/fetch/challenge-classify.test.ts` (modified, +32/-0)
```diff
@@ -263,3 +263,35 @@ describe('classifyImageSubType', () => {
     });
   });
 });
+
+describe('classifyImageSubType — slider detection must not fire on ordinary UI', () => {
+  // `sliderish && (puzzle || slide)` was vacuous for the `slider` token, because
+  // the string "slider" itself contains "slide". Any page carrying a carousel,
+  // range input or `class="slider"` therefore classified as a drag puzzle — and
+  // the vision rung would attempt a drag gesture on it.
+  it('does NOT call a plain carousel a slider puzzle', () => {
+    expect(
+      classifyImageSubType('<html><body><div class="slider"><img src="/a.jpg"></div></body></html>'),
+    ).not.toBe('slider');
+  });
+
+  it('does NOT call a range input a slider puzzle', () => {
+    expect(
+      classifyImageSubType('<html><body><input type="range" class="volume-slider"></body></html>'),
+    ).not.toBe('slider');
+  });
+
+  it('still detects a GeeTest slide puzzle', () => {
+    expect(classifyImageSubType('<html><body><div class="geetest_slider"></div></body></html>')).toBe('slider');
+  });
+
+  it('still detects a slidebg drag puzzle', () => {
+    expect(classifyImageSubType('<html><body><div class="slideBg"></div></body></html>')).toBe('slider');
+  });
+
+  it('still detects a slider co-present with an explicit puzzle hint', () => {
+    expect(
+      classifyImageSubType('<html><body><div class="slider">Drag the puzzle piece to verify</div></body></html>'),
+    ).toBe('slider');
+  });
+});
```

---

### Incident Patch 9: `59e18046` (2026-08-01)
**Commit Message**: fix(fetch): judge wall density over the whole document, not a leading slice

isLowContentDensity measured the text ratio on html.slice(0, 32768). Any
modern page opens with 32KB+ of <head> scripts and stylesheets carrying
almost no text, so a genuinely substantive page read as empty and a real 403
was relabelled a bot wall:

  bytes total          69279
  visible WHOLE doc    34799   <- clearly a real page
  visible first 32KB     379   <- the slice lies
  isChallengeShell(403) true   <- relabelled

challenge-classify.ts already documents this exact trap, in this same PR:
walmart's 405KB page carries <600 visible chars in its first 32KB but 2,777
overall, "so slicing here would defeat the guard entirely". The density rule
made the mistake that comment warns about.

approxVisibleTextLength keeps its 32KB bound by DEFAULT — that is correct for
the interstitial detectors, where a challenge shell is tiny and a leading
slice sees all of it. Only the density rule opts into the whole document, and
only behind an anti-bot status, so no hot path pays for the full scan.

My earlier test asserted the opposite and passed only because its fixture was
~1.6KB — smaller than the slice, so the slic

**File**: `src/fetch/tls-tier.ts` (modified, +21/-4)
```diff
@@ -527,8 +527,20 @@ const REAL_FORM_PATTERN = /<form[\s>][\s\S]*?<(?:input|button|select|textarea)[\
 // Approximate the visible text length of an HTML body: strip script/style and
 // tags, collapse whitespace. Cheap and bounded — the caller only cares whether
 // the result is tiny (interstitial) or substantial (real page).
-function approxVisibleTextLength(html: string): number {
-  const slice = html.length > 32768 ? html.slice(0, 32768) : html;
+/**
+ * Approximate rendered-text length.
+ *
+ * Bounded to the first 32KB by DEFAULT, which is correct for the interstitial
+ * detectors (`isNearEmptyBody`, `isChallengeSkeleton`): a challenge shell is
+ * tiny, so a leading slice sees all of it and a huge real document is not worth
+ * scanning in full.
+ *
+ * `whole: true` measures the ENTIRE document, which the density rule needs — a
+ * ratio computed on a leading slice is meaningless, because any modern page
+ * opens with 32KB+ of head assets carrying no text.
+ */
+function approxVisibleTextLength(html: string, opts?: { whole?: boolean }): number {
+  const slice = !opts?.whole && html.length > 32768 ? html.slice(0, 32768) : html;
   const stripped = slice
     .replace(/<script[\s\S]*?<\/script>/gi, ' ')
     .replace(/<style[\s\S]*?<\/style>/gi, ' ')
@@ -587,8 +599,13 @@ const WALL_MAX_TEXT_DENSITY = 0.05;
  */
 export function isLowContentDensity(html: string | null | undefined): boolean {
   if (!html || html.length < WALL_MIN_HTML_BYTES) return false;
-  const slice = html.length > 32768 ? html.slice(0, 32768) : html;
-  return approxVisibleTextLength(slice) / slice.length < WALL_MAX_TEXT_DENSITY;
+  // Measured over the WHOLE document, deliberately NOT a leading slice. Any
+  // modern page opens with 32KB+ of <head> scripts and stylesheets carrying
+  // almost no text, so judging density on a prefix calls a large REAL page
+  // empty and relabels a genuine 403 as a bot wall. Mirrors the same rule in
+  // challenge-classify.ts, which documents the walmart case (405KB page: <600
+  // visible chars in its first 32KB, 2,777 overall).
+  return approxVisibleTextLength(html, { whole: true }) / html.length < WALL_MAX_TEXT_DENSITY;
 }
 
 export function isChallengeSkeleton(html: string | null | undefined): boolean {
```

**File**: `tests/unit/fetch/challenge-status-distinguishable.test.ts` (modified, +33/-0)
```diff
@@ -23,6 +23,20 @@ const REAL_403_PAGE =
   'You do not have permission to view this resource. Contact your administrator. '.repeat(20) +
   '</p></body></html>';
 
+/**
+ * A LARGE real page whose first 32KB is `<head>` scripts and stylesheets — the
+ * normal shape of any modern site, and the case the original fixture was too
+ * small to reach. challenge-classify.ts already documents this trap: walmart's
+ * 405KB page carries <600 visible chars in its first 32KB but 2,777 overall, so
+ * judging density on a leading slice calls a real page empty.
+ */
+const BIG_REAL_403_PAGE =
+  '<html><head>' +
+  '<script src="/static/chunk.js"></script><link rel="stylesheet" href="/a.css">'.repeat(420) +
+  '</head><body>' +
+  '<p>Access to this administrative area is restricted to authorised staff. Contact your administrator to request access. '.repeat(300) +
+  '</p></body></html>';
+
 describe('the wall-shape rule keeps a real anti-bot status distinguishable', () => {
   it('treats a large all-scaffolding body as low density', () => {
     expect(isLowContentDensity(SCAFFOLD)).toBe(true);
@@ -32,6 +46,25 @@ describe('the wall-shape rule keeps a real anti-bot status distinguishable', ()
     expect(isLowContentDensity(REAL_403_PAGE)).toBe(false);
   });
 
+  it('does NOT misjudge a LARGE real page whose first 32KB is head scripts', () => {
+    // Regression: density was measured on html.slice(0, 32768). Any modern
+    // page's leading 32KB is head assets, so a genuinely substantive body read
+    // as empty and a real 403 was relabelled a bot wall.
+    expect(isLowContentDensity(BIG_REAL_403_PAGE)).toBe(false);
+    expect(isChallengeShell(403, BIG_REAL_403_PAGE)).toBe(false);
+  });
+
+  it('still catches a LARGE wall — size alone must not buy a pass', () => {
+    // The mirror of the case above: a big page that is genuinely all
+    // scaffolding is still a wall, so the fix cannot be "ignore large pages".
+    const bigWall =
+      '<html><head>' +
+      '<script src="/px.js"></script><link rel="stylesheet" href="/a.css">'.repeat(900) +
+      '</head><body><div id="challenge"></div></body></html>';
+    expect(isLowContentDensity(bigWall)).toBe(true);
+    expect(isChallengeShell(403, bigWall)).toBe(true);
+  });
+
   it('needs BOTH an anti-bot status and low density — status alone is not a wall', () => {
     // A substantive 403 (an admin page saying "forbidden") must pass through as
     // an ordinary HTTP error, not get relabelled a challenge.
```

---

### Incident Patch 10: `8a6112cc` (2026-08-01)
**Commit Message**: fix(fetch): reject reddit path segments instead of rewriting them

sanitizeSegment stripped anything outside [A-Za-z0-9_-] so the fixed-host
endpoint could never be escaped. That kept the URL safe but silently changed
WHICH resource was fetched:

  /r/foo.bar                    -> /r/foobar
  /r/AskReddit%2F..%2Fpolitics  -> /r/AskReddit2F2Fpolitics

Both are real subreddits. The caller asked for one community and got another
back with no signal that a substitution had happened.

Reddit names are [A-Za-z0-9_-]+, so a segment needing rewrite is one we
cannot serve. Return null and let the router fall through to the normal
ladder against the URL as written.

Strictly stronger than the old behaviour, so the two existing SSRF tests are
updated to assert the stronger property rather than relaxed: a hostile path
now performs NO egress at all — not the data endpoint, not even a token —
where before it fetched a sanitized, wrong resource. The fixed-host assertion
is retained on a legal path so that guarantee stays covered.

**File**: `src/fetch/reddit-api.ts` (modified, +16/-6)
```diff
@@ -63,9 +63,19 @@ export function isRedditUrl(url: string): boolean {
 
 const SORTS = new Set(['hot', 'new', 'top', 'rising', 'controversial', 'best']);
 
-/** Keep only characters valid in a reddit name segment (sub / user / id). */
-function sanitizeSegment(seg: string): string {
-  return seg.replace(/[^A-Za-z0-9_-]/g, '');
+/**
+ * A reddit name segment (sub / user / id), or null when the input is not already
+ * one. Reddit names are `[A-Za-z0-9_-]+`, so anything else cannot be served.
+ *
+ * This REJECTS rather than sanitizes. Stripping the offending characters keeps
+ * the fixed-host URL safe but silently changes WHICH resource is fetched —
+ * `/r/foo.bar` became `/r/foobar`, and `/r/AskReddit%2F..%2Fpolitics` became the
+ * real-but-wrong `/r/AskReddit2F2Fpolitics` — handing back another community's
+ * content with no signal. Returning null makes the router fall through to the
+ * normal ladder against the URL as the caller wrote it.
+ */
+function validSegment(seg: string): string | null {
+  return /^[A-Za-z0-9_-]+$/.test(seg) ? seg : null;
 }
 
 /**
@@ -96,19 +106,19 @@ export function mapRedditUrlToEndpoint(url: string): string | null {
 
   // /user/<name> or /u/<name>
   if ((parts[0] === 'user' || parts[0] === 'u') && parts[1]) {
-    const name = sanitizeSegment(parts[1]);
+    const name = validSegment(parts[1]);
     if (!name) return null;
     return `/user/${name}/about`;
   }
 
   // /r/<sub>/...
   if (parts[0] === 'r' && parts[1]) {
-    const sub = sanitizeSegment(parts[1]);
+    const sub = validSegment(parts[1]);
     if (!sub) return null;
 
     // /r/<sub>/comments/<id>[/slug]
     if (parts[2] === 'comments' && parts[3]) {
-      const id = sanitizeSegment(parts[3]);
+      const id = validSegment(parts[3]);
       if (!id) return null;
       return `/r/${sub}/comments/${id}`;
     }
```

**File**: `tests/unit/fetch/reddit-api.test.ts` (modified, +18/-7)
```diff
@@ -90,11 +90,15 @@ describe('mapRedditUrlToEndpoint', () => {
     expect(mapRedditUrlToEndpoint('https://www.reddit.com/settings')).toBeNull();
   });
 
-  it('sanitizes path segments so no injection reaches the endpoint', () => {
-    // A crafted segment must not smuggle characters outside [A-Za-z0-9_-] into
-    // the constructed endpoint path.
-    expect(mapRedditUrlToEndpoint('https://www.reddit.com/r/ru$st!/hot')).toBe('/r/rust/hot');
-    expect(mapRedditUrlToEndpoint('https://www.reddit.com/r/a.b.c/hot')).toBe('/r/abc/hot');
+  it('REFUSES a segment carrying anything outside [A-Za-z0-9_-] rather than sanitizing it', () => {
+    // Stripping the offending characters kept the endpoint safe but silently
+    // fetched a DIFFERENT resource (`/r/a.b.c` -> the real `/r/abc`). Refusing
+    // is strictly stronger: no injection reaches the endpoint AND no wrong
+    // community is served in place of the requested one.
+    expect(mapRedditUrlToEndpoint('https://www.reddit.com/r/ru$st!/hot')).toBeNull();
+    expect(mapRedditUrlToEndpoint('https://www.reddit.com/r/a.b.c/hot')).toBeNull();
+    // The legal name is unaffected.
+    expect(mapRedditUrlToEndpoint('https://www.reddit.com/r/rust/hot')).toBe('/r/rust/hot');
   });
 });
 
@@ -378,13 +382,20 @@ describe('fetchViaRedditApi', () => {
     const mgr = new RedditTokenManager(CREDS, fetchFn, () => 0);
 
     // A hostile path with an embedded @ / host-like segment must not redirect
-    // egress off oauth.reddit.com — the host comes from the fixed base only.
-    await fetchViaRedditApi(
+    // egress off oauth.reddit.com. It no longer even reaches the API: the name
+    // is not a legal reddit segment, so the mapper refuses and NOTHING is
+    // fetched — not the data endpoint, not even a token.
+    const hostile = await fetchViaRedditApi(
       'https://www.reddit.com/r/rust@evil.example/hot',
       mgr,
       CREDS,
       fetchFn,
     );
+    expect(hostile).toBeNull();
+    expect((fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
+
+    // And the host of a LEGAL request still comes from the fixed base only.
+    await fetchViaRedditApi('https://www.reddit.com/r/rust/hot', mgr, CREDS, fetchFn);
     const dataCall = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[1];
     const calledUrl = new URL(dataCall[0] as string);
     expect(calledUrl.hostname).toBe('oauth.reddit.com');
```

**File**: `tests/unit/fetch/reddit-url-fidelity.test.ts` (added, +49/-0)
```diff
@@ -0,0 +1,49 @@
+import { describe, it, expect } from 'vitest';
+import { mapRedditUrlToEndpoint } from '../../../src/fetch/reddit-api.js';
+
+/**
+ * The endpoint mapper strips characters that are invalid in a Reddit name so the
+ * fixed-host URL can never be escaped. Stripping is the right defence, but
+ * SILENTLY stripping changes which resource is fetched: `/r/foo.bar` became
+ * `/r/foobar`, and the caller got a different subreddit's content back with no
+ * signal that a substitution happened.
+ *
+ * A segment that had to be rewritten is not a segment we can serve — return null
+ * so the router falls through to the normal ladder against the URL as given.
+ */
+describe('reddit endpoint mapping never silently substitutes a different resource', () => {
+  it('refuses a subreddit whose name had to be rewritten', () => {
+    expect(mapRedditUrlToEndpoint('https://www.reddit.com/r/foo.bar/')).toBeNull();
+  });
+
+  it('refuses a percent-encoded traversal attempt rather than mangling it into a real sub', () => {
+    // Previously mapped to /r/AskReddit2F2Fpolitics — a real, WRONG subreddit.
+    expect(
+      mapRedditUrlToEndpoint('https://www.reddit.com/r/AskReddit%2F..%2Fpolitics/'),
+    ).toBeNull();
+  });
+
+  it('refuses a rewritten username', () => {
+    expect(mapRedditUrlToEndpoint('https://www.reddit.com/user/bad$name')).toBeNull();
+  });
+
+  it('refuses a rewritten thread id', () => {
+    expect(mapRedditUrlToEndpoint('https://www.reddit.com/r/rust/comments/ab!c12/title/')).toBeNull();
+  });
+
+  it('still maps clean URLs exactly as before', () => {
+    expect(mapRedditUrlToEndpoint('https://www.reddit.com/r/rust/comments/abc123/title/')).toBe(
+      '/r/rust/comments/abc123',
+    );
+    expect(mapRedditUrlToEndpoint('https://www.reddit.com/r/rust/')).toBe('/r/rust/hot');
+    expect(mapRedditUrlToEndpoint('https://www.reddit.com/r/rust/top')).toBe('/r/rust/top');
+    expect(mapRedditUrlToEndpoint('https://www.reddit.com/user/spez')).toBe('/user/spez/about');
+    expect(mapRedditUrlToEndpoint('https://www.reddit.com/u/spez')).toBe('/user/spez/about');
+  });
+
+  it('accepts the underscore and hyphen that are legal in reddit names', () => {
+    expect(mapRedditUrlToEndpoint('https://www.reddit.com/r/my_sub-name/')).toBe(
+      '/r/my_sub-name/hot',
+    );
+  });
+});
```

#### Recent Merged Pull Requests:
- **PR #638** (2026-09-27): feat(site): wigolo.app, logo wall, docs site, comparison pages, analytics and sponsor layout (@KnockOutEZ)
- **PR #636** (2026-09-21): docs(licensing): strip the AGPL explainer, keep the ask (@KnockOutEZ)
- **PR #634** (2026-09-21): docs: add commercial licensing terms (LICENSING.md); AGPL-3.0 unchanged (@KnockOutEZ)
- **PR #627** (2026-09-11): docs(readme): add Discord community link and badge (@KnockOutEZ)
- **PR #626** (2026-09-08): fix(daemon): revoke broker grants after schema migration (@KnockOutEZ)
- **PR #625** (2026-09-08): fix(fetch): degrade to the lower tier on the domain-marked path when no browser engine (PX2 RC gate arm) (@KnockOutEZ)
- **PR #624** (2026-09-08): feat(binary): brew tap formula + release automation hook (@KnockOutEZ)
- **PR #623** (2026-09-08): fix(core)!: PX2-R — registration becomes an unlock, not a gate (@KnockOutEZ)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
