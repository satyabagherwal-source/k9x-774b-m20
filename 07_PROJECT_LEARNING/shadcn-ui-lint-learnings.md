# Forensic Learning Record (Deep Inspection): shadcn-ui/lint

> **Canonical Artifact**: `07_PROJECT_LEARNING/shadcn-ui-lint-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/shadcn-ui/lint](https://github.com/shadcn-ui/lint))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:19:19.517Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `shadcn-ui/lint`
- **Description**: An agent-first linter for Tailwind design systems. Write design system rules that agents can verify.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 3073 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/evals/fixture-ds/lib/utils.ts`
```
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function absoluteUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_APP_URL}${path}`
}

```

### Core Architecture Module: `packages/evals/fixture-rich/lib/utils.ts`
```
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function absoluteUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_APP_URL}${path}`
}

```

### Core Architecture Module: `packages/evals/fixture/lib/utils.ts`
```
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function absoluteUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_APP_URL}${path}`
}

```

### Core Architecture Module: `packages/evals/lib/render.mjs`
```
// Renders a generated component to a screenshot: esbuild bundles the
// TSX (with the fixture's ui components and React), the Tailwind v4
// CLI compiles the theme CSS against the workdir, and Playwright
// screenshots the result.

import { execFileSync } from "node:child_process"
import * as fs from "node:fs"
import * as path from "node:path"
import * as esbuild from "esbuild"

import { readComponent } from "./component.mjs"

// Mounts the component with or without sample children. A component
// that only renders its children (a bare Card slot set) collapses to a
// zero-width box on its own; the second attempt fills it.
export function entrySource(exportName, componentPath, withChildren) {
  const binding =
    exportName === "default"
      ? "PreviewComponent"
      : `{ ${exportName} as PreviewComponent }`
  const element = withChildren
    ? `<PreviewComponent>Preview content</PreviewComponent>`
    : `<PreviewComponent />`
  return `import * as React from "react"
import { createRoot } from "react-dom/client"
import ${binding} from "${componentPath.replace(/\.tsx$/, "")}"

createRoot(document.getElementById("root")).render(
  <div style={{ padding: 40, display: "grid", placeItems: "center", minHeight: "100vh" }}>
    ${element}
  </div>
)
`
}

// A component mounted with no children that still paints something
// tiny (an empty badge pill at 14x16) is as unjudgeable as a blank one,
// so the fallback threshold is the size of the smallest real subject.
const MIN_SUBJECT = { width: 24, height: 12 }

// Renders and returns the screenshot path plus whether the captured
// subject is large enough to judge; an empty mount is not a verdict.
export async function renderToScreenshot(options) {
  const judgeable = (shot) =>
    shot.width >= MIN_SUBJECT.width && shot.height >= MIN_SUBJECT.height
  const first = await renderAttempt({ ...options, withChildren: false })
  if (judgeable(first)) return { outPng: first.outPng, judgeable: true }
  const second = await renderAttempt({ ...options, withChildren: true })
  return { outPng: second.outPng, judgeable: judgeable(second) }
}

async function renderAttempt({ workdir, taskFile, outPng, withChildren }) {
  workdir = path.resolve(workdir)
  const previewDir = path.join(workdir, ".preview")
  fs.mkdirSync(previewDir, { recursive: true })

  const { exportName, findings } = await readComponent(workdir, taskFile)
  if (findings.length) {
    throw new Error(findings.map((finding) => finding.message).join("\n"))
  }

  // Entry that mounts the component on a padded stage.
  const entryPath = path.join(previewDir, "entry.tsx")
  const componentPath = path
    .relative(previewDir, path.join(workdir, taskFile))
    .replace(/\\/g, "/")
  fs.writeFileSync(
    entryPath,
    entrySource(exportName, componentPath, withChildren)
  )

  await esbuild.build({
    entryPoints: [entryPath],
    bundle: true,
    outfile: path.join(previewDir, "bundle.js"),
    format: "iife",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    alias: { "@": workdir },
    logLevel: "silent",
  })

  // Workdirs from runs that predate the fixture theme get it backfilled.
  const globalsPath = path.join(workdir, "app/globals.css")
  if (!fs.existsSync(globalsPath)) {
    fs.copyFileSync(
      new URL("../fixture/app/globals.css", import.meta.url),
      globalsPath
    )
  }

  // Tailwind v4 scans the workdir for classes; cwd matters.
  execFileSync(
    "npx",
    [
      "@tailwindcss/cli",
      "-i",
      path.join(workdir, "app/globals.css"),
      "-o",
      path.join(previewDir, "styles.css"),
    ],
    { cwd: workdir, stdio: "pipe" }
  )

  fs.writeFileSync(
    path.join(previewDir, "index.html"),
    `<!doctype html>
<html>
<head><meta charset="utf-8"><link rel="stylesheet" href="./styles.css"></head>
<body><div id="root"></div><script src="./bundle.js"></script></body>
</html>
`
  )

  const { chromium } = await import("playwright")
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({
      viewport: { width: 800, height: 600 },
      deviceScaleFactor: 2,
    })
    await page.goto(`file://${path.join(previewDir, "index.html")}`)
    await page.waitForTimeout(300)
    // Crop to the rendered component (plus margin) so small subjects
    // like a lone badge stay legible to the judge.
    const box = await page
      .locator("#root > div > *")
      .first()
      .boundingBox()
      .catch(() => null)
    if (box && box.width > 0) {
      const pad = 32
      await page.screenshot({
        path: outPng,
        clip: {
          x: Math.max(0, box.x - pad),
          y: Math.max(0, box.y - pad),
          width: Math.min(800, box.width + pad * 2),
          height: Math.min(600, box.height + pad * 2),
        },
      })
    } else {
      await page.screenshot({ path: outPng })
    }
    return { outPng, width: box?.width ?? 0, height: box?.height ?? 0 }
  } finally {
    await browser.close()
  }
}

```

### Core Architecture Module: `packages/lint/src/tailwind/worker.ts`
```
// The worker thread that hosts the Tailwind oracle. The linter's rules
// are synchronous and Tailwind's loader is not, so the main thread
// posts a request, blocks on a shared integer, and the worker answers
// through a message port and flips the integer. See client.ts.

import { workerData, type MessagePort } from "node:worker_threads"

import { query } from "./oracle"

type Request = {
  id: number
  cssFile: string
  candidates: string[]
  shared: SharedArrayBuffer
}

const port = workerData.port as MessagePort

port.on("message", async ({ id, cssFile, candidates, shared }: Request) => {
  let answer
  try {
    answer = await query(cssFile, candidates)
  } catch (error) {
    answer = { ok: false as const, reason: (error as Error).message }
  }
  port.postMessage({ id, answer })
  const flag = new Int32Array(shared)
  Atomics.store(flag, 0, 1)
  Atomics.notify(flag, 0)
})

```

### Core Architecture Module: `eslint.config.mjs`
```
// Same setup as shadcn-ui/cn: TS parser, recommended rules, prettier last.
import js from "@eslint/js"
import prettier from "eslint-config-prettier"
import globals from "globals"
import tseslint from "typescript-eslint"

export default tseslint.config(
  {
    ignores: [
      "**/dist/",
      "**/node_modules/",
      "**/.registry/",
      "packages/evals/results/",
      "packages/evals/fixture/",
      "packages/lint/test/fixtures/",
      "**/dist-next/",
      ".claude/",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    // Rules walk ESTree nodes from two runtimes (ESLint and Oxlint) whose
    // types differ; the AST is handled untyped on purpose.
    files: ["packages/lint/src/**", "packages/lint/test/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  prettier
)

```

### Core Architecture Module: `packages/evals/aggregate-runs.mjs`
```
#!/usr/bin/env node
// Aggregates multiple temptation-suite runs into variance statistics:
// per-task and overall mean/min/max for before-violations, green rate,
// and rounds to green. Single-run numbers invite the "n=1" objection;
// this answers it.
//
// Usage: node evals/aggregate-runs.mjs <run-id> [run-id ...]
//        node evals/aggregate-runs.mjs --from evals/results/variance-runs.txt
import * as fs from "node:fs"
import * as path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RESULTS_DIR = path.join(__dirname, "results")

let runIds = process.argv.slice(2)
const fromIdx = runIds.indexOf("--from")
if (fromIdx !== -1) {
  const listPath = path.resolve(runIds[fromIdx + 1])
  runIds = fs
    .readFileSync(listPath, "utf-8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
}
if (!runIds.length) {
  console.error("Usage: node evals/aggregate-runs.mjs <run-id> [...]")
  process.exit(1)
}

const runs = runIds.map((id) => {
  const data = JSON.parse(
    fs.readFileSync(path.join(RESULTS_DIR, id, "results.json"), "utf-8")
  )
  return { id, model: data.model, results: data.results }
})

const stat = (xs) => ({
  mean: Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10,
  min: Math.min(...xs),
  max: Math.max(...xs),
})
const fmt = (s) => `${s.mean} (${s.min}–${s.max})`

// Per-task aggregation across runs.
const taskIds = [...new Set(runs.flatMap((r) => r.results.map((t) => t.task)))]
const perTask = []
for (const task of taskIds) {
  const samples = runs
    .map((r) => r.results.find((t) => t.task === task))
    .filter(Boolean)
  perTask.push({
    task,
    n: samples.length,
    before: stat(samples.map((s) => s.a.violations.length)),
    rounds: stat(samples.map((s) => s.c.rounds.length)),
    green: samples.filter((s) => s.c.violations.length === 0).length,
    redirects: samples.map((s) => s.c.redirect),
  })
}

// Overall per-run totals.
const totals = runs.map((r) => ({
  id: r.id,
  before: r.results.reduce((s, t) => s + t.a.violations.length, 0),
  after: r.results.reduce((s, t) => s + t.c.violations.length, 0),
  green: r.results.filter((t) => t.c.violations.length === 0).length,
  tasks: r.results.length,
}))

console.log(`Runs: ${runs.length} (model: ${runs[0].model})\n`)
console.log(`| Run | Before | After | Green |`)
console.log(`|---|---|---|---|`)
for (const t of totals) {
  console.log(`| ${t.id} | ${t.before} | ${t.after} | ${t.green}/${t.tasks} |`)
}
const beforeStat = stat(totals.map((t) => t.before))
const afterStat = stat(totals.map((t) => t.after))
console.log(
  `\nOverall: before ${fmt(beforeStat)} violations/run, after ${fmt(afterStat)}, ` +
    `green ${totals.reduce((s, t) => s + t.green, 0)}/${totals.reduce((s, t) => s + t.tasks, 0)} tasks`
)

console.log(
  `\n| Task | n | Before (mean, range) | Rounds | Green | Redirects |`
)
console.log(`|---|---|---|---|---|---|`)
for (const t of perTask) {
  const redirectCounts = {}
  for (const r of t.redirects) redirectCounts[r] = (redirectCounts[r] ?? 0) + 1
  const redirectStr = Object.entries(redirectCounts)
    .map(([k, v]) => `${k}×${v}`)
    .join(", ")
  console.log(
    `| ${t.task} | ${t.n} | ${fmt(t.before)} | ${fmt(t.rounds)} | ${t.green}/${t.n} | ${redirectStr} |`
  )
}

```

### Core Architecture Module: `packages/evals/drift.mjs`
```
#!/usr/bin/env node
// Drift over time: one project, tasks in sequence, the way a week of
// work goes. Two conditions, each a single persistent work dir:
//
//   A (no lint): every task is generated into the same project; the
//      agent sees what earlier tasks left behind. Violations per task
//      measure ambient drift as the project grows.
//   C (enforced): the same sequence, with lint feedback after each task
//      until green. Violations before feedback per task measure whether
//      enforcement compounds: the vocabulary earlier tasks created
//      should make later tasks cleaner on the first try.
//
// Usage:
//   node evals/drift.mjs [--model <model>] [--tasks <path>] [--fixture <dir>]
//                        [--limit <n>] [--forbid-workarounds]
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

import { feedbackPrompt, generationPrompt, runAgent } from "./lib/agent.mjs"
import { classifyRedirect } from "./lib/classify.mjs"
import { agentFailure, lintWorkdir } from "./lib/lint.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i !== -1 ? args[i + 1] : fallback
}
const MODEL = flag("model", "claude-sonnet-5")
const TASKS_PATH = flag("tasks", path.join(__dirname, "tasks/neutral.json"))
const FIXTURE_NAME = flag("fixture", "fixture-rich")
const FIXTURE = path.join(__dirname, FIXTURE_NAME)
const LIMIT = parseInt(flag("limit", "0")) || 0
const FORBID_WORKAROUNDS = args.includes("--forbid-workarounds")
const MAX_ROUNDS = 3

// The linter's own project readers, for counting the vocabulary.
const lint = await import(
  process.env.SHADCN_LINT_PLUGIN
    ? pathToFileURL(path.resolve(process.env.SHADCN_LINT_PLUGIN)).href
    : "@shadcn/lint"
)

const runId = `drift-${new Date().toISOString().replace(/[:.]/g, "-")}`
const RUN_DIR = path.join(__dirname, "results", runId)
fs.mkdirSync(RUN_DIR, { recursive: true })

const tasks = JSON.parse(fs.readFileSync(TASKS_PATH, "utf-8")).slice(
  0,
  LIMIT || undefined
)

// Tokens declared in the theme and variants available on the ui
// components, as the linter sees them from a file in the project.
function vocabulary(workdir) {
  const probe = path.join(workdir, "app/probe.tsx")
  const tokens = lint.project.colorTokensFor(probe)?.size ?? 0
  const index = lint.project.componentsFor(probe)
  let variants = 0
  const seen = new Set()
  for (const [name, file] of index.files) {
    const key = `${file}:${name}`
    if (seen.has(key)) continue
    seen.add(key)
    variants += lint.project.variantNamesFor(file, name)?.length ?? 0
  }
  return { tokens, variants }
}

function snapshotUi(workdir) {
  const dir = path.join(workdir, "components/ui")
  const out = new Map()
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile()) continue
    out.set(entry.name, fs.readFileSync(path.join(dir, entry.name), "utf-8"))
  }
  out.set(
    "app/globals.css",
    fs.readFileSync(path.join(workdir, "app/globals.css"), "utf-8")
  )
  return out
}

function changedFiles(before, after) {
  const changed = []
  for (const [file, content] of after) {
    if (before.get(file) !== content) changed.push(file)
  }
  return changed
}

function byRule(findings) {
  const counts = {}
  for (const f of findings) counts[f.rule] = (counts[f.rule] ?? 0) + 1
  return counts
}

async function runCondition(condition) {
  const workdir = path.join(RUN_DIR, condition)
  fs.cpSync(FIXTURE, workdir, { recursive: true })
  const enforced = condition === "c"
  const steps = []
  console.log(
    `\n== Condition ${condition.toUpperCase()} (${enforced ? "enforced" : "no lint"}) ==`
  )

  // Every task file written so far must still exist: a later task that
  // deletes an earlier one's output is not a clean project.
  const expected = []
  for (const [i, task] of tasks.entries()) {
    console.log(`\n[${i + 1}/${tasks.length}] ${task.id}`)
    const before = snapshotUi(workdir)
    // The ui directory as it stood before this task, for the classifier.
    const priorDir = fs.mkdtempSync(path.join(os.tmpdir(), "drift-prior-"))
    fs.cpSync(
      path.join(workdir, "components/ui"),
      path.join(priorDir, "components/ui"),
      { recursive: true }
    )
    expected.push(task.file)
    const gen = await runAgent(workdir, generationPrompt(task), {
      model: MODEL,
    })
    let findings = [
      ...agentFailure(gen, task.file),
      ...(await lintWorkdir(workdir, { expectFiles: expected })),
    ]
    const inTask = findings.filter((f) => f.file === task.file)
    console.log(
      `  generated: ${findings.length} violations in project, ${inTask.length} in ${task.file}`
    )
    const step = {
      index: i + 1,
      task: task.id,
      file: task.file,
      generation: {
        costUsd: gen.costUsd,
        numTurns: gen.numTurns,
        violationsInProject: findings.length,
        violationsInTask: inTask.length,
        byRule: byRule(inTask),
      },
    }

    if (enforced) {
      const rounds = []
      while (findings.length > 0 && rounds.length < MAX_ROUNDS) {
        console.log(
          `  round ${rounds.length + 1} (${findings.length} violations)...`
        )
        const meta = await runAgent(
          workdir,
          feedbackPrompt(task, findings, {
            forbidWorkarounds: FORBID_WORKAROUNDS,
          }),
          { model: MODEL }
        )
        findings = [
          ...agentFailure(meta, task.file),
          ...(await lintWorkdir(workdir, { expectFiles: expected })),
        ]
        rounds.push({
          ...meta,
          violationsAfter: findings.length,
          violations: findings,
        })
      }
      const after = snapshotUi(workdir)
      const changed = changedFiles(before, after)
      // The same classifier as the paired runner, against the ui
      // directory as it stood before this task.
      const redirect = classifyRedirect({
        workdir,
        fixtureDir: priorDir,
        task,
        findings,
      })
      step.enforcement = {
        rounds,
        violationsAfter: findings.length,
        redirect,
        systemFilesChanged: changed,
      }
      console.log(
        `  ${findings.length} violations after ${rounds.length} round(s) -> ${redirect}${changed.length ? ` (${changed.join(", ")})` : ""}`
      )
    }

    step.vocabulary = vocabulary(workdir)
    console.log(
      `  vocabulary: ${step.vocabulary.tokens} tokens, ${step.vocabulary.variants} variants`
    )
    steps.push(step)
  }
  return steps
}

console.log(`Run: ${runId}`)
console.log(`Model: ${MODEL}`)
console.log(`Fixture: ${FIXTURE_NAME}`)
console.log(`Tasks: ${tasks.map((t) => t.id).join(", ")}`)

const a = await runCondition("a")
const c = await runCondition("c")

const outPath = path.join(RUN_DIR, "results.json")
fs.writeFileSync(
  outPath,
  JSON.stringify(
    {
      runId,
      model: MODEL,
      tasks: path.relative(__dirname, TASKS_PATH),
      fixture: FIXTURE_NAME,
      forbidWorkarounds: FORBID_WORKAROUNDS,
      a,
      c,
    },
    null,
    2
  )
)

console.log(
  `\n| # | Task | A: new | A: total | C: before | C: rounds | C: redirect | C: tokens | C: variants |`
)
console.log(
  `| - | ---- | -----: | -------: | --------: | --------: | ----------- | --------: | ----------: |`
)
for (let i = 0; i < tasks.length; i++) {
  const sa = a[i]
  const sc = c[i]
  console.log(
    `| ${i + 1} | ${sa.task} | ${sa.generation.violationsInTask} | ${sa.generation.violationsInProject} | ${sc.generation.violationsInTask} | ${sc.enforcement.rounds.length} | ${sc.enforcement.redirect} | ${sc.vocabulary.tokens} | ${sc.vocabulary.variants} |`
  )
}
console.log(`\nResults: ${outPath}`)

```

### Core Architecture Module: `packages/evals/fidelity.mjs`
```
#!/usr/bin/env node
// Fidelity guard: renders the before (A) and after (C) outputs of a
// run, screenshots both, and asks a judge model whether the after
// preserves the design intent. Lint-green achieved by styling less is
// a failure, and this is the check that catches it.
//
// Usage: node evals/fidelity.mjs <results.json> [--judge-model <model>] [--passes <n>] [--force]
//
// The judge is a model and varies between passes on identical
// screenshots; --passes runs it n times (default 3) and records the
// median score and the majority sameIntent, keeping every pass.
import { spawnSync } from "node:child_process"
import * as fs from "node:fs"
import * as path from "node:path"

import { renderToScreenshot } from "./lib/render.mjs"

const resultsPath = process.argv[2]
if (!resultsPath) {
  console.error("Usage: node evals/fidelity.mjs <results.json>")
  process.exit(1)
}
const args = process.argv.slice(3)
const judgeIdx = args.indexOf("--judge-model")
const JUDGE_MODEL = judgeIdx !== -1 ? args[judgeIdx + 1] : "claude-fable-5"
const passesIdx = args.indexOf("--passes")
const PASSES = passesIdx !== -1 ? Math.max(1, parseInt(args[passesIdx + 1])) : 3

const data = JSON.parse(fs.readFileSync(resultsPath, "utf-8"))
const runDir = path.dirname(path.resolve(resultsPath))

function judge(task, beforePng, afterPng) {
  const prompt = `You are judging design fidelity for a UI code transformation. A component was regenerated to satisfy lint rules; the transformation must preserve the design intent.

The original task was:
"${task.prompt}"

Read these two screenshots:
- BEFORE (no lint): ${beforePng}
- AFTER (lint-enforced): ${afterPng}

Judge whether AFTER still satisfies the design intent of the task. Pay particular attention to requirements the task states explicitly (specific colors, sizes, emphasis). Cosmetic differences that keep the intent are fine; dropping or weakening a stated requirement is not.

Rubric for values: the transformation is allowed to snap a stated value to the nearest design-system token, so 13px padding rendered at 12px, 11px text at 12px, or a stated hex color replaced by the visually nearest theme color all count as intent preserved (score 8-10) as long as the element still reads the way the task asked. Intent is lost when a stated emphasis, color family, shape, or element is missing or reversed, or when AFTER is visibly plainer than the task asked for.

Respond with ONLY a JSON object, no other text:
{"sameIntent": true|false, "score": 0-10, "notes": "<one sentence>"}
Where score 10 = intent fully preserved, 5 = partially, 0 = intent lost.`

  const result = spawnSync(
    "claude",
    [
      "-p",
      prompt,
      "--model",
      JUDGE_MODEL,
      "--allowedTools",
      "Read",
      "--output-format",
      "json",
    ],
    { encoding: "utf-8", timeout: 180_000 }
  )
  try {
    const parsed = JSON.parse(result.stdout)
    const text = parsed.result ?? ""
    const json = text.match(/\{[\s\S]*\}/)?.[0]
    return json ? JSON.parse(json) : { error: "no json in judge output" }
  } catch {
    return { error: `judge failed: ${result.stderr?.slice(0, 200)}` }
  }
}

for (const r of data.results) {
  // Skip tasks that already have a verdict; pass --force to redo.
  if (r.fidelity?.score != null && !args.includes("--force")) {
    console.log(`\n[${r.task}] already judged, skipping`)
    continue
  }
  console.log(`\n[${r.task}]`)
  const fidelity = { judgeModel: JUDGE_MODEL }
  for (const condition of ["a", "c"]) {
    const workdir = path.join(runDir, r.task, condition)
    const outPng = path.join(runDir, r.task, `preview-${condition}.png`)
    try {
      const shot = await renderToScreenshot({
        workdir,
        taskFile: r.file,
        outPng,
      })
      console.log(
        `  ${condition}: rendered${shot?.judgeable === false ? " (empty subject)" : ""}`
      )
      fidelity[`${condition}Png`] = path.relative(runDir, outPng)
      if (shot?.judgeable === false) fidelity[`${condition}Empty`] = true
    } catch (err) {
      console.log(`  ${condition}: render failed — ${err.message}`)
      fidelity[`${condition}Error`] = err.message
    }
  }

  if (fidelity.aEmpty && fidelity.cEmpty) {
    // Both renders are empty: the judge would be comparing two blank
    // pills. Recorded as unjudgeable, not scored.
    fidelity.unjudgeable = true
    console.log(`  unjudgeable: both renders are empty`)
  } else if (fidelity.aPng && fidelity.cPng) {
    const passes = []
    for (let i = 0; i < PASSES; i++) {
      const verdict = judge(
        r,
        path.join(runDir, fidelity.aPng),
        path.join(runDir, fidelity.cPng)
      )
      passes.push(verdict)
      console.log(
        `  judge ${i + 1}/${PASSES}: sameIntent=${verdict.sameIntent} score=${verdict.score} — ${verdict.notes ?? verdict.error}`
      )
    }
    const scored = passes.filter((p) => typeof p.score === "number")
    if (scored.length) {
      const scores = scored.map((p) => p.score).sort((a, b) => a - b)
      const median = scores[Math.floor((scores.length - 1) / 2)]
      const yes = scored.filter((p) => p.sameIntent === true).length
      const representative = scored.find((p) => p.score === median) ?? scored[0]
      Object.assign(fidelity, {
        passes,
        score: median,
        sameIntent: yes * 2 > scored.length,
        notes: representative.notes,
      })
      console.log(
        `  median score ${median}, sameIntent ${yes}/${scored.length}`
      )
    } else {
      Object.assign(fidelity, { passes, error: passes[0]?.error })
    }
  }
  r.fidelity = fidelity
}

fs.writeFileSync(resultsPath, JSON.stringify(data, null, 2))
console.log(`\nUpdated: ${resultsPath}`)

```

### Core Architecture Module: `packages/evals/fixture-ds/ds/avatar.tsx`
```
"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar"

function Avatar({
  className,
  size = "default",
  ...props
}: AvatarPrimitive.Root.Props & {
  size?: "default" | "sm" | "lg"
}) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      data-size={size}
      className={cn(
        "group/avatar relative flex size-8 shrink-0 rounded-full select-none after:absolute after:inset-0 after:rounded-full after:border after:border-border after:mix-blend-darken data-[size=lg]:size-10 data-[size=sm]:size-6 dark:after:mix-blend-lighten",
        className
      )}
      {...props}
    />
  )
}

function AvatarImage({ className, ...props }: AvatarPrimitive.Image.Props) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn(
        "aspect-square size-full rounded-full object-cover",
        className
      )}
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  ...props
}: AvatarPrimitive.Fallback.Props) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "flex size-full items-center justify-center rounded-full bg-muted text-sm text-muted-foreground group-data-[size=sm]/avatar:text-xs",
        className
      )}
      {...props}
    />
  )
}

function AvatarBadge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="avatar-badge"
      className={cn(
        "absolute right-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground bg-blend-color ring-2 ring-background select-none",
        "group-data-[size=sm]/avatar:size-2 group-data-[size=sm]/avatar:[&>svg]:hidden",
        "group-data-[size=default]/avatar:size-2.5 group-data-[size=default]/avatar:[&>svg]:size-2",
        "group-data-[size=lg]/avatar:size-3 group-data-[size=lg]/avatar:[&>svg]:size-2",
        className
      )}
      {...props}
    />
  )
}

function AvatarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group"
      className={cn(
        "group/avatar-group flex -space-x-2 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-background",
        className
      )}
      {...props}
    />
  )
}

function AvatarGroupCount({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group-count"
      className={cn(
        "relative flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm text-muted-foreground ring-2 ring-background group-has-data-[size=lg]/avatar-group:size-10 group-has-data-[size=sm]/avatar-group:size-6 [&>svg]:size-4 group-has-data-[size=lg]/avatar-group:[&>svg]:size-5 group-has-data-[size=sm]/avatar-group:[&>svg]:size-3",
        className
      )}
      {...props}
    />
  )
}

export {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarBadge,
}

```

### Core Architecture Module: `packages/evals/fixture-ds/ds/badge.tsx`
```
import { cn } from "@/lib/utils"
import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive:
          "bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }

```

### Core Architecture Module: `packages/evals/fixture-ds/ds/button.tsx`
```
import { cn } from "@/lib/utils"
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/80",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #68** (2026-10-05): **fix: resolve tailwind beside the stylesheet that imports it**
  *Symptoms*: Resolves Tailwind from the stylesheets the entry imports when only a workspace UI package depends on it, fixing #67.

- **Issue #67** (2026-10-05): **no-unknown-classes: Tailwind is not found when only a workspace UI package depends on it**
  *Symptoms*: Outside PRs are limited to collaborators, so this is an issue with a ready branch: https://github.com/nkurunziza-saddy/shadcn-ui-lint/tree/fix/tailwind-from-importing-stylesheet (one commit on a89d047). Happy to adjust it, or for you to take it over.  ## Problem  `loadTailwind` resolves `tailwindcss` from the entry stylesheet's directory, then from the working directory. In a pnpm workspace like this, neither reaches it:      apps/web/src/app.css          @import "@acme/ui/styles.css";     packages/ui/src/styles.css    @import "tailwindcss";  Only `packages/ui` depends on `tailwindcss`, so pnpm installs it beside that package. The theme fails to build with "tailwindcss v4 could not be resolved from apps/web/src", and the app has to list `tailwindcss` as a dependency it never imports (which knip then reports as unused).  It only shows when the linter is not started through a pnpm bin shim, since the shim puts the hoisted modules on `NODE_PATH`. Vite+ (`vp check`) and editor integrations start it without one.  ## Change  When neither place resolves Tailwind, follow the entry's `@import`s and resolve from the directories of the stylesheets that import `tailwindcss`. Existing lookups run first, so projects that resolve today behave the same.  `stripComments` and `parseImports` move to `src/project/css.ts` (no imports of its own) so the oracle's worker can use them; `theme.ts` re-exports both.  ## Tests  `test/tailwind-oracle.test.ts` builds that workspace layout in a temp directo
  **Post-Mortem & Fix Analysis**:
  > Fixed in #68. When Tailwind doesn't resolve from the entry stylesheet, the oracle now resolves it beside the stylesheets that import it. Ships in the next release.

- **Issue #52** (2026-10-05): **feat: classify a project's theme scales from its CSS**
  *Symptoms*: cn 0.4.0 reads the scales your theme declares, so `--radius-card` makes `rounded-card` a radius and `cn("rounded-card rounded-lg")` merges to `rounded-lg`. The linter did not read the theme that way and reported `rounded-card` as unclassified even when a contract allowed `shape`. It now merges the project's `@theme` scales into cn's grammar, so both tools read one theme the same way.
  **Post-Mortem & Fix Analysis**:
  > **Review the following changes in direct dependencies.** Learn more about [Socket for GitHub](https://socket.dev?utm_medium=gh).  <table> <thead> <tr> <th>Diff</th> <th width="200px">Package</th> <th align="left" width="100px">Supply Chain<br/>Security</th> <th align="left" width="100px">Vulnerability</th> <th align="left" width="100px">Quality</th> <th align="left" width="100px">Maintenance</th> <th align="left" width="100px">License</th> </tr> </thead> <tbody> <tr><td align="center"><a href="https://socket.dev/dashboard/org/vercel/diff-scan/8ae866c2-b074-414c-a560-1e21dc5288f1?tab=dependencies&dependency_item_key=101951282245"><img src="https://github-app-statics.socket.dev/diff-updated.svg" title="Updated" alt="Updated" width="20" height="20"></a></td><td><a href="https://socket.dev/dashboard/org/vercel/diff-scan/8ae866c2-b074-414c-a560-1e21dc5288f1?tab=dependencies&dependency_item_key=101951282245">npm/​cn@​0.3.2 ⏵ 0.4.0</a></td><td align="left"><a href="https://socket.dev/dashboar

- **Issue #51** (2026-09-22): **chore(release): version packages**
  *Symptoms*: This PR was opened by the [Changesets release](https://github.com/changesets/action) GitHub action. When you're ready to do a release, you can merge this and the packages will be published to npm automatically. If you're not ready to do a release yet, that's fine, whenever you add more changesets to main, this PR will be updated.   # Releases ## @shadcn/lint@0.2.0  ### Minor Changes  - [#50](https://github.com/shadcn-ui/lint/pull/50) [`b9572a8`](https://github.com/shadcn-ui/lint/commit/b9572a87ad3da8c6341b5d3d283b0e5c3a01323d) Thanks [@shadcn](https://github.com/shadcn)! - Add support for Vue and Svelte.  ### Patch Changes  - [#50](https://github.com/shadcn-ui/lint/pull/50) [`b9572a8`](https://github.com/shadcn-ui/lint/commit/b9572a87ad3da8c6341b5d3d283b0e5c3a01323d) Thanks [@shadcn](https://github.com/shadcn)! - Read a barrel whose export list carries comments.

- **Issue #50** (2026-09-22): **feat: add vue and svelte support**
  *Symptoms*: fixes #12 
  **Post-Mortem & Fix Analysis**:
  > **Review the following changes in direct dependencies.** Learn more about [Socket for GitHub](https://socket.dev?utm_medium=gh).  <table> <thead> <tr> <th>Diff</th> <th width="200px">Package</th> <th align="center" width="100px">Supply Chain<br/>Security</th> <th align="center" width="100px">Vulnerability</th> <th align="center" width="100px">Quality</th> <th align="center" width="100px">Maintenance</th> <th align="center" width="100px">License</th> </tr> </thead> <tbody> <tr><td align="center"><a href="https://socket.dev/dashboard/org/vercel/diff-scan/e4f73aa3-74f2-47a0-84ae-be8e7c755d89?tab=dependencies&dependency_item_key=101888281988"><img src="https://github-app-statics.socket.dev/diff-added.svg" title="Added" alt="Added" width="20" height="20"></a></td><td><a href="https://socket.dev/dashboard/org/vercel/diff-scan/e4f73aa3-74f2-47a0-84ae-be8e7c755d89?tab=dependencies&dependency_item_key=101888281988">npm/​vue-eslint-parser@​10.4.1</a></td><td align="center"><a href="https://socke

- **Issue #48** (2026-09-21): **chore(release): version packages**
  *Symptoms*: This PR was opened by the [Changesets release](https://github.com/changesets/action) GitHub action. When you're ready to do a release, you can merge this and the packages will be published to npm automatically. If you're not ready to do a release yet, that's fine, whenever you add more changesets to main, this PR will be updated.   # Releases ## @shadcn/lint@0.1.5  ### Patch Changes  - [#47](https://github.com/shadcn-ui/lint/pull/47) [`7638587`](https://github.com/shadcn-ui/lint/commit/7638587e93ebff5bd7c8a7f9a8c42f236bb73c8e) Thanks [@shadcn](https://github.com/shadcn)! - Update the bundled cn grammar to 0.3.2. Axis utilities such as `px-2` now conflict with the logical sides they cover, and only Tailwind's own `animate-*` names share the `animate` group.

- **Issue #47** (2026-09-21): **chore: update cn to 0.3.2**
  *Symptoms*: Updates the bundled cn grammar and `BUNDLED_CN` to 0.3.2, which adds the axis and logical side conflicts and limits the `animate` group to Tailwind's own names.

- **Issue #46** (2026-09-21): **chore(release): version packages**
  *Symptoms*: This PR was opened by the [Changesets release](https://github.com/changesets/action) GitHub action. When you're ready to do a release, you can merge this and the packages will be published to npm automatically. If you're not ready to do a release yet, that's fine, whenever you add more changesets to main, this PR will be updated.   # Releases ## @shadcn/lint@0.1.4  ### Patch Changes  - [#45](https://github.com/shadcn-ui/lint/pull/45) [`b291b5b`](https://github.com/shadcn-ui/lint/commit/b291b5b25be39263b4b9921100714b19cfd8fde6) Thanks [@shadcn](https://github.com/shadcn)! - Read a project's animations from its CSS. An `animate-*` class now classifies as motion when the theme declares `--animate-<name>` or the CSS declares it with `@utility` or a selector, so the result no longer depends on cn grouping every `animate-*` name.

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

### Incident Patch 1: `ee939103` (2026-10-05)
**Commit Message**: feat: classify a project's theme scales from its CSS (#52)

**File**: `.changeset/theme-scales-from-css.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@shadcn/lint": patch
+---
+
+Classify a project's custom theme scales, such as `rounded-card`, the way cn 0.4.0 merges them.
```

**File**: `docs/how-it-works.md` (modified, +9/-1)
```diff
@@ -135,12 +135,20 @@ layout. `allow: ["layout"]` permits layout classes. A contract that
 replaces `allow` must include `layout` to keep that allowance. See the
 [category table](./rules.md#categories).
 
-The linter uses your project's `cn` when it is at least version 0.3.2.
+The linter uses your project's `cn` when it is at least version 0.4.0.
 Otherwise, it uses the bundled grammar and warns if an older copy was
 found. A class with no recognized group is `unclassified` and is not
 allowed by `layout`. A recognized group with no appearance category is
 treated as layout; newly unmapped groups produce a warning.
 
+The grammar reads the scales your theme declares, the way `cn build`
+registers them. A `--radius-card` in `@theme` makes `rounded-card` a
+shape class, `--text-display` makes `text-display` typography, and
+`--spacing-gutter` makes `p-gutter` spacing. A `--radius-*: initial`
+reset replaces the default names with the declared ones, so `rounded-lg`
+is unclassified until the theme declares it again. Only `@theme` blocks
+count, and relative `@import`s are followed.
+
 Utilities Tailwind still generates under their Tailwind 3 names read as
 the utilities they are: `flex-grow` and `flex-shrink-0` classify with
 `grow` and `shrink`, `overflow-ellipsis` with `text-ellipsis`, and
```

**File**: `packages/lint/package.json` (modified, +1/-1)
```diff
@@ -53,7 +53,7 @@
   ],
   "dependencies": {
     "@eslint/core": "^0.17.0",
-    "cn": "0.3.2"
+    "cn": "0.4.0"
   },
   "peerDependencies": {
     "@typescript-eslint/parser": ">=8.40.0",
```

**File**: `packages/lint/src/grammar/classifier.ts` (modified, +62/-3)
```diff
@@ -5,17 +5,20 @@
 import { readFileSync } from "node:fs"
 import { createRequire } from "node:module"
 import * as path from "node:path"
+import { mergeConfigs } from "cn/compiler"
 import { defaultConfig, type ClassGroupDef, type CnConfig } from "cn/config"
 
-import { dirOf } from "../project/fs"
+import { dirOf, mtimeOf, TTL } from "../project/fs"
+import { themeFileFor } from "../project/theme"
+import { themeScalesFromCss } from "../project/theme-scales"
 import { warnOnce } from "../project/warn"
 import { GROUP_CATEGORY } from "./categories"
 import { splitVariants } from "./classes"
 import * as cnValidators from "./validators"
 
 // The grammar this package is written against. An older cn in the project
 // is linted with the bundled copy instead, with a one-time warning.
-export const BUNDLED_CN = "0.3.2"
+export const BUNDLED_CN = "0.4.0"
 
 function cnVersionAt(resolvedConfigPath: string) {
   let dir = path.dirname(resolvedConfigPath)
@@ -92,6 +95,62 @@ export function resolveCnConfig(fromFile?: string) {
   return config
 }
 
+type ThemedConfig = {
+  config: CnConfig
+  files: string[]
+  signature: string
+  checkedAt: number
+}
+
+const themedByConfig = new WeakMap<CnConfig, Map<string, ThemedConfig>>()
+
+function signatureOf(files: string[]) {
+  return files.map((file) => `${file}:${mtimeOf(file) ?? "missing"}`).join("|")
+}
+
+// The grammar with the project's theme scales applied, the way `cn build`
+// registers them: a declared --radius-card makes rounded-card a radius,
+// and --radius-*: initial replaces the default names. One config per
+// grammar and theme file, so every file in a project shares one
+// classifier, re-read when a stylesheet changes so a watcher run sees an
+// edited theme. A stylesheet that cannot be read leaves the grammar alone.
+export function themedCnConfig(fromFile?: string) {
+  const config = resolveCnConfig(fromFile)
+  const themeFile = fromFile ? themeFileFor(fromFile) : null
+  if (!themeFile) return config
+  let byFile = themedByConfig.get(config)
+  if (!byFile) {
+    byFile = new Map()
+    themedByConfig.set(config, byFile)
+  }
+  const cached = byFile.get(themeFile)
+  const now = Date.now()
+  if (cached && now - cached.checkedAt < TTL) return cached.config
+  if (cached && signatureOf(cached.files) === cached.signature) {
+    cached.checkedAt = now
+    return cached.config
+  }
+  let themed = config
+  let files = [themeFile]
+  try {
+    const theme = themeScalesFromCss([themeFile])
+    files = theme.files
+    themed = mergeConfigs(config, theme.extension)
+  } catch (error) {
+    warnOnce(
+      `theme-scales:${themeFile}`,
+      `The theme scales in ${themeFile} could not be read (${(error as Error).message}), so classes such as rounded-card that it declares are unclassified until the stylesheet is fixed.`
+    )
+  }
+  byFile.set(themeFile, {
+    config: themed,
+    files,
+    signature: signatureOf(files),
+    checkedAt: now,
+  })
+  return themed
+}
+
 type Node = {
   next: Map<string, Node>
   validators: { test: (value: string) => boolean; group: string }[] | null
@@ -318,7 +377,7 @@ export function unknownGroups(config: CnConfig) {
 
 // One trie per distinct config, built lazily.
 export function classifierFor(fromFile?: string) {
-  const config = resolveCnConfig(fromFile)
+  const config = themedCnConfig(fromFile)
   let classifier = classifierByConfig.get(config)
   if (!classifier) {
     try {
```

**File**: `packages/lint/src/project/namespaces.ts` (modified, +15/-38)
```diff
@@ -1,8 +1,9 @@
-// cn's grammar reads a class by its shape, so every text-* and shadow-*
-// with a name it does not know is a color. Tailwind reads the same class
-// against the project's theme, where a declared --text-stat-label makes
-// it a font-size and --shadow-card-glow a box-shadow. This is the theme's
-// half of that answer: the grammar with the project's namespaces applied.
+// cn's grammar reads a class by its shape, with the project's theme scales
+// applied: a declared --text-stat-label makes text-stat-label a font-size
+// and --shadow-card-glow a box-shadow before any lookup here. What cn
+// does not read is what this module adds: bg-stripes comes from a
+// --background-image-* the grammar has no scale for, so it reads as a
+// color, and a project's animations live in @utility as often as @theme.
 
 import { categoryOf } from "../grammar/categories"
 import { normalizeClass, OPACITY_MODIFIER } from "../grammar/classes"
@@ -13,46 +14,19 @@ import {
   type ThemeVocabulary,
 } from "./theme"
 
-// Longest prefix first: text-shadow-crisp is a text-shadow, not text
-// "shadow-crisp".
 const NAMESPACES: {
   // The prefix as written in the class.
   prefix: string
-  // The @theme namespace the utility reads, which is not always the
-  // prefix: bg-stripes comes from --background-image-stripes.
+  // The @theme namespace the utility reads, which is not the prefix:
+  // bg-stripes comes from --background-image-stripes.
   namespace: string
   // The cn group the class belongs to when the namespace answers.
   group: string
-  // Whether the namespace wins over a --color-* of the same name. The
-  // shadow family takes its own first; text- and bg- take the color.
-  // Verified against Tailwind 4.3.3, not inferred from the docs.
-  overColor: boolean
 }[] = [
-  {
-    prefix: "text-shadow-",
-    namespace: "text-shadow-",
-    group: "text-shadow",
-    overColor: true,
-  },
-  {
-    prefix: "inset-shadow-",
-    namespace: "inset-shadow-",
-    group: "inset-shadow",
-    overColor: true,
-  },
-  {
-    prefix: "drop-shadow-",
-    namespace: "drop-shadow-",
-    group: "drop-shadow",
-    overColor: true,
-  },
-  { prefix: "shadow-", namespace: "shadow-", group: "shadow", overColor: true },
-  { prefix: "text-", namespace: "text-", group: "font-size", overColor: false },
   {
     prefix: "bg-",
     namespace: "background-image-",
     group: "bg-image",
-    overColor: false,
   },
 ]
 
@@ -80,13 +54,15 @@ function valueOf(base: string, prefix: string) {
   return value
 }
 
+// A --color-* of the same name wins over the namespace, the way Tailwind
+// reads bg-*. Verified against Tailwind 4.3.3, not inferred from the docs.
 function lookup(vocabulary: ThemeVocabulary, token: string) {
   const base = normalizeClass(token)
   const entry = NAMESPACES.find((n) => base.startsWith(n.prefix))
   if (!entry) return null
   const value = valueOf(base, entry.prefix)
   if (!value) return null
-  if (!entry.overColor && vocabulary.tokens.has(value)) return null
+  if (vocabulary.tokens.has(value)) return null
   return vocabulary.names.has(`${entry.namespace}${value}`) ? entry.group : null
 }
 
@@ -105,9 +81,10 @@ export function themeGroupFor(fromFile: string | undefined, token: string) {
   return group
 }
 
-// cn groups only Tailwind's own animations, so that merging never drops a
-// plugin's animate-once. A project's animation is one its CSS declares:
-// --animate-shimmer in @theme, or animate-in from an @utility or selector.
+// cn groups Tailwind's own animations and the --animate-* names a theme
+// declares, so that merging never drops a plugin's animate-once. The rest
+// of a project's animations come from its CSS: animate-in from an
+// @utility or selector.
 export function animationGroupFor(fromFile: string | undefined, token: string) {
   if (!fromFile) return null
   const base = normalizeClass(token)
```

**File**: `packages/lint/src/project/theme-scales.ts` (added, +142/-0)
```diff
@@ -0,0 +1,142 @@
+// Reads the theme scales a project's stylesheets declare, the way `cn
+// build` registers them: `--radius-card` in `@theme` adds `card` to the
+// radius scale, and `--radius-*: initial` replaces the default scale with
+// the declared names. Only `@theme` blocks are read. Relative `@import`s
+// are followed; packages are not.
+//
+// A port of cn's `themeFromCss` (packages/cn/src/theme-css.ts), which cn
+// 0.4.0 does not export. Kept in step with it so the linter and the
+// project's runtime `cn` read one theme the same way; replace with the
+// import once cn exports it.
+
+import { readFileSync } from "node:fs"
+import * as path from "node:path"
+import type { ConfigExtension } from "cn/compiler"
+
+// Tailwind namespace to cn theme scale. Longest first, so `--text-shadow-x`
+// is a text shadow and `--font-weight-x` a weight. `--color-*` and
+// `--font-*` are left out: cn already accepts any name on those scales.
+const NAMESPACES: [string, string][] = [
+  ["inset-shadow", "inset-shadow"],
+  ["drop-shadow", "drop-shadow"],
+  ["text-shadow", "text-shadow"],
+  ["font-weight", "font-weight"],
+  ["perspective", "perspective"],
+  ["breakpoint", "breakpoint"],
+  ["container", "container"],
+  ["tracking", "tracking"],
+  ["spacing", "spacing"],
+  ["leading", "leading"],
+  ["animate", "animate"],
+  ["radius", "radius"],
+  ["shadow", "shadow"],
+  ["aspect", "aspect"],
+  ["blur", "blur"],
+  ["ease", "ease"],
+  ["text", "text"],
+]
+
+function stripComments(css: string) {
+  return css.replace(/\/\*[\s\S]*?\*\//g, "")
+}
+
+// Bodies of every `@theme` block, at any nesting depth.
+function themeBlocks(css: string) {
+  const bodies: string[] = []
+  const re = /@theme\b[^{;]*\{/g
+  while (re.exec(css)) {
+    let depth = 1
+    let i = re.lastIndex
+    for (; i < css.length && depth > 0; i++) {
+      if (css[i] === "{") depth++
+      else if (css[i] === "}") depth--
+    }
+    bodies.push(css.slice(re.lastIndex, i - 1))
+    re.lastIndex = i
+  }
+  return bodies
+}
+
+function importPaths(css: string) {
+  const paths: string[] = []
+  const re = /@import\s+(?:url\(\s*)?["']([^"']+)["']/g
+  let match
+  while ((match = re.exec(css))) {
+    const spec = match[1]
+    if (spec.startsWith("./") || spec.startsWith("../")) paths.push(spec)
+  }
+  return paths
+}
+
+// The theme scales declared in the stylesheets and the files they import,
+// as a config extension: declared names under `extend`, and scales reset
+// with `--<namespace>-*: initial` under `override`. Also returns every
+// file read, so a cache can re-read when one changes. Throws when a
+// stylesheet cannot be read.
+export function themeScalesFromCss(entries: readonly string[]) {
+  const files: string[] = []
+  let entry = ""
+  const names = new Map<string, Set<string>>()
+  const reset = new Set<string>()
+  const visit = (file: string) => {
+    if (files.includes(file)) return
+    files.push(file)
+    let css
+    try {
+      css = stripComments(readFileSync(file, "utf8"))
+    } catch (error) {
+      throw new Error(
+        `cannot read css ${file === entry ? file : `${file} (imported from ${entry})`}: ${(error as Error).message}`,
+        { cause: error }
+      )
+    }
+    for (const spec of importPaths(css)) {
+      visit(path.resolve(path.dirname(file), spec))
+    }
+    for (const body of themeBlocks(css)) {
+      for (const declaration of body.split(";")) {
+        const colon = declaration.indexOf(":")
+        if (colon === -1) continue
+        const prop = declaration.slice(0, colon).trim()
+        const value = declaration.slice(colon + 1).trim()
+        if (!prop.startsWith("--")) continue
+        if (prop === "--*" && value === "initial") {
+          for (const [, scale] of NAMESPACES) reset.add(scale)
+          continue
+        }
+        const namespace = NAMESPACES.find(([ns]) => prop.startsWith(`--${ns}-`))
+        if (!namespace) continue
+        const [ns, scale] = namespace
+        const name = prop.slice(ns.length + 3)
+        if (name === "*") {
+          if (value === "initial") reset.add(scale)
+          continue
+        }
+        // `--text-display--line-height` is a sub-property of `display`.
+        if (!name || name.includes("--")) continue
+        if (value === "initial") {
+          names.get(scale)?.delete(name)
+          continue
+        }
+        let set = names.get(scale)
+        if (!set) names.set(scale, (set = new Set()))
+        set.add(name)
+      }
+    }
+  }
+  for (const file of entries) {
+    entry = path.resolve(file)
+    visit(entry)
+  }
+
+  const extend: Record<string, string[]> = {}
+  const override: Record<string, string[]> = {}
+  for (const [scale, set] of names) {
+    if (!reset.has(scale)) extend[scale] = [...set]
+  }
+  for (const scale of reset) override[scale] = [...(names.get(scale) ?? [])]
+  const extension: ConfigExtension = {}
+  if (Object.keys(extend).length) extension.extend = { theme: exten
```

**File**: `packages/lint/src/rules/contracts.ts` (modified, +4/-3)
```diff
@@ -3,7 +3,7 @@
 
 import { CATEGORIES, categoryOf } from "../grammar/categories"
 import { isMarkerClass, normalizeClass } from "../grammar/classes"
-import { resolveCnConfig } from "../grammar/classifier"
+import { resolveCnConfig, themedCnConfig } from "../grammar/classifier"
 import { didYouMean } from "../grammar/similar"
 import { projectClassifierFor } from "../project/namespaces"
 import { knownClassesFor } from "../project/theme"
@@ -113,15 +113,16 @@ function groupIdsFor(config: object & { classGroups: object }) {
   return ids
 }
 
-// Per grammar and option value, so a thousand files compile once.
+// Per grammar and option value, so a thousand files compile once. The
+// themed grammar, so a project's own scales and an edited theme are read.
 const compiledByConfig = new WeakMap<object, Map<string, unknown>>()
 
 function compiledOnce<T>(
   fromFile: string | undefined,
   key: string,
   build: () => T
 ) {
-  const config = resolveCnConfig(fromFile)
+  const config = themedCnConfig(fromFile)
   let byKey = compiledByConfig.get(config)
   if (!byKey) {
     byKey = new Map()
```

**File**: `packages/lint/test/classifier-project.test.ts` (modified, +149/-3)
```diff
@@ -1,15 +1,17 @@
 import * as fs from "node:fs"
 import * as os from "node:os"
 import * as path from "node:path"
-import { afterEach, describe, expect, test } from "vitest"
+import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
 
 import { categoryOf } from "../src/grammar/categories"
 import {
   BUNDLED_CN,
   classifierFor,
   groupOf,
   resolveCnConfig,
+  themedCnConfig,
 } from "../src/grammar/classifier"
+import { resetFsMemo } from "../src/project/fs"
 import {
   animationGroupFor,
   projectClassifierFor,
@@ -28,8 +30,13 @@ describe("animate values, from cn's grammar", () => {
 
 // cn groups only Tailwind's own animations, so a project's animation is
 // read from its CSS. These hold whichever cn grammar is installed.
+const PAGE_IN_NAMESPACE_THEME = path.join(
+  __dirname,
+  "fixtures/namespace-theme/app/page.tsx"
+)
+
 describe("animate values, from the project's CSS", () => {
-  const PAGE = path.join(__dirname, "fixtures/namespace-theme/app/page.tsx")
+  const PAGE = PAGE_IN_NAMESPACE_THEME
 
   test.each([
     "animate-shimmer",
@@ -56,6 +63,145 @@ describe("animate values, from the project's CSS", () => {
   })
 })
 
+// cn build registers the scales a theme declares, so the project's cn
+// merges rounded-card with rounded-lg. The classifier reads the same
+// theme, so a contract that allows shape accepts rounded-card too.
+describe("theme scales, from the project's CSS", () => {
+  const PAGE = PAGE_IN_NAMESPACE_THEME
+  const RESET = path.join(__dirname, "fixtures/reset-theme/app/page.tsx")
+
+  test.each([
+    ["rounded-card", "rounded-lg"],
+    ["p-gutter", "p-4"],
+    ["tracking-display", "tracking-tight"],
+    ["leading-display", "leading-tight"],
+    // A breakpoint names a screen width, not a max-width step.
+    ["max-w-screen-wide", "max-w-screen-md"],
+    ["columns-prose", "columns-3"],
+    ["ease-snappy", "ease-in"],
+    ["blur-glass", "blur-sm"],
+    ["perspective-stage", "perspective-near"],
+    ["aspect-poster", "aspect-video"],
+    ["hover:rounded-card", "hover:rounded-lg"],
+    ["text-stat-label", "text-sm"],
+    ["shadow-card-glow", "shadow-lg"],
+    ["drop-shadow-lift", "drop-shadow-lg"],
+  ])("%s classifies with %s", (custom, standard) => {
+    const group = groupOf(custom, PAGE)
+    expect(group).not.toBeNull()
+    expect(group).toBe(groupOf(standard, PAGE))
+    expect(categoryOf(group)).toBe(categoryOf(groupOf(standard, PAGE)))
+    expect(projectClassifierFor(PAGE).groupOf(custom)).toBe(group)
+  })
+
+  test("rounded-card is shape", () => {
+    expect(categoryOf(groupOf("rounded-card", PAGE))).toBe("shape")
+  })
+
+  test.each(["rounded-nope", "rounded-panel", "p-nope"])(
+    "%s is not declared, so it stays unclassified",
+    (token) => {
+      expect(groupOf(token, PAGE)).toBeNull()
+      expect(projectClassifierFor(PAGE).groupOf(token)).toBeNull()
+    }
+  )
+
+  test("without a file there is no theme to read", () => {
+    expect(groupOf("rounded-card")).toBeNull()
+    expect(groupOf("rounded-card", "/nonexistent/app/page.tsx")).toBeNull()
+  })
+
+  test("every file in the project shares one classifier", () => {
+    const other = path.join(path.dirname(PAGE), "other.tsx")
+    expect(classifierFor(PAGE)).toBe(classifierFor(other))
+    expect(classifierFor(PAGE)).not.toBe(classifierFor(RESET))
+    expect(themedCnConfig(PAGE)).not.toBe(resolveCnConfig(PAGE))
+  })
+
+  test("a reset replaces the default names with the declared ones", () => {
+    expect(groupOf("rounded-lg", RESET)).toBeNull()
+    expect(groupOf("rounded-fresh", RESET)).toBe("rounded")
+    expect(groupOf("text-sm", RESET)).toBe("font-size")
+    expect(groupOf("text-lg", RESET)).not.toBe("font-size")
+    // Untouched scales keep their defaults.
+    expect(groupOf("p-4", RESET)).toBe("p")
+  })
+})
+
+describe("theme scales refresh and fail safe", () => {
+  const directories = new Set<string>()
+  const warnings: string[] = []
+
+  function createProject(theme: string) {
+    const root = fs.realpathSync.native(
+      fs.mkdtempSync(path.join(os.tmpdir(), "lint-theme-scales-"))
+    )
+    directories.add(root)
+    const write = (name: string, source: string) => {
+      const file = path.join(root, name)
+      fs.mkdirSync(path.dirname(file), { recursive: true })
+      fs.writeFileSync(file, source)
+      fs.utimesSync(file, new Date(Date.now()), new Date(Date.now()))
+      return file
+    }
+    write("package.json", JSON.stringify({ private: true }))
+    write(
+      "components.json",
+      JSON.stringify({
+        aliases: { ui: "@/components/ui" },
+        tailwind: { css: "theme.css" },
+      })
+    )
+    write("theme.css", theme)
+    return { write, page: path.join(root, "page.tsx") }
+  }
+
+  beforeEach(() => {
+    vi.useFakeTimers({ toFake: ["Date"] })
+    setWarningSink((m) => warnings.push(m))
+  })
+
+  afterEach(() => {
+    vi.useRealTimers()
+    resetFsMemo()
+    resetWarnings()
+    warnings.length
```

---

### Incident Patch 2: `0e91da36` (2026-10-05)
**Commit Message**: fix: resolve tailwind beside the stylesheet that imports it (#68)

**File**: `.changeset/tailwind-from-importing-stylesheet.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@shadcn/lint": patch
+---
+
+Resolve Tailwind beside the stylesheet that imports it.
```

**File**: `packages/lint/src/tailwind/oracle.ts` (modified, +37/-3)
```diff
@@ -10,6 +10,7 @@ import { pathToFileURL } from "node:url"
 
 import { splitVariants } from "../grammar/classes"
 import { didYouMean } from "../grammar/similar"
+import { parseImports } from "../project/theme"
 
 type DesignSystem = {
   theme?: { prefix?: string | null }
@@ -80,10 +81,43 @@ function resolveFrom(base: string, id: string) {
   return createRequire(path.join(base, "noop.js")).resolve(id)
 }
 
+// The directories of the stylesheets that import Tailwind, reached
+// through the entry's @imports. In a workspace the app's stylesheet may
+// import a UI package's, and only that package depends on Tailwind.
+function* tailwindImporters(cssFile: string) {
+  const seen = new Set<string>()
+  const queue = [cssFile]
+  while (queue.length) {
+    const file = queue.shift()!
+    if (seen.has(file)) continue
+    seen.add(file)
+    let css: string
+    try {
+      css = fs.readFileSync(file, "utf-8")
+    } catch {
+      continue
+    }
+    for (const id of parseImports(css)) {
+      if (id === "tailwindcss" || id.startsWith("tailwindcss/")) {
+        yield path.dirname(file)
+        continue
+      }
+      const resolved = resolveStylesheet(path.dirname(file), id)
+      if (resolved) queue.push(realpathOf(resolved))
+    }
+  }
+}
+
+function* tailwindBases(cssFile: string) {
+  yield path.dirname(cssFile)
+  yield* tailwindImporters(cssFile)
+  yield process.cwd()
+}
+
 // Resolved from the stylesheet outward: ours is not a substitute for the
 // version that actually generates the project's CSS.
-async function loadTailwind(dir: string): Promise<Tailwind | null> {
-  for (const from of [dir, process.cwd()]) {
+async function loadTailwind(cssFile: string): Promise<Tailwind | null> {
+  for (const from of tailwindBases(cssFile)) {
     let resolved: string
     try {
       resolved = resolveFrom(from, "tailwindcss")
@@ -248,7 +282,7 @@ function signatureOf(files: string[]) {
 
 async function build(cssFile: string): Promise<Loaded> {
   const dir = path.dirname(cssFile)
-  const tailwind = await loadTailwind(dir)
+  const tailwind = await loadTailwind(cssFile)
   if (!tailwind) {
     throw new Error(`tailwindcss v4 could not be resolved from ${dir}`)
   }
```

**File**: `packages/lint/test/tailwind-oracle.test.ts` (modified, +63/-1)
```diff
@@ -2,9 +2,12 @@
 // classes generate CSS. Tested directly (async, no worker) here; the
 // synchronous bridge is exercised by the no-unknown-classes rule tests.
 
+import * as fs from "node:fs"
+import Module, { createRequire } from "node:module"
+import * as os from "node:os"
 import * as path from "node:path"
 import { fileURLToPath } from "node:url"
-import { describe, expect, test } from "vitest"
+import { afterAll, describe, expect, test, vi } from "vitest"
 
 import { query, resetOracle, resolveStylesheet } from "../src/tailwind/oracle"
 import { PROJECT } from "./helpers"
@@ -21,6 +24,37 @@ const PATTERN = path.resolve(
   "fixtures/exports-pattern"
 )
 
+const temporary: string[] = []
+
+afterAll(() => {
+  for (const dir of temporary) fs.rmSync(dir, { recursive: true, force: true })
+})
+
+function workspace() {
+  const root = fs.mkdtempSync(path.join(os.tmpdir(), "shadcn-lint-"))
+  temporary.push(root)
+  const write = (file: string, content: string) => {
+    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
+    fs.writeFileSync(path.join(root, file), content)
+  }
+  const link = (target: string, file: string) => {
+    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
+    fs.symlinkSync(target, path.join(root, file), "dir")
+  }
+  write("apps/web/src/app.css", `@import "@acme/ui/styles.css";\n`)
+  write("packages/ui/package.json", `{ "name": "@acme/ui" }\n`)
+  write(
+    "packages/ui/styles.css",
+    `@import "tailwindcss";\n@utility kit-frame { display: flex; }\n`
+  )
+  link(path.join(root, "packages/ui"), "apps/web/node_modules/@acme/ui")
+  const tailwind = path.dirname(
+    createRequire(import.meta.url).resolve("tailwindcss/package.json")
+  )
+  link(tailwind, "packages/ui/node_modules/tailwindcss")
+  return path.join(root, "apps/web/src/app.css")
+}
+
 describe("tailwind oracle", () => {
   test("knows the theme, @utility rules and every variant", async () => {
     resetOracle()
@@ -125,6 +159,34 @@ describe("tailwind oracle", () => {
     ])
   })
 
+  // Only the UI package depends on Tailwind, so it is installed beside
+  // that package and the app's stylesheet cannot resolve it. Built
+  // outside the repository, where nothing above it or the working
+  // directory has Tailwind either.
+  test("finds Tailwind beside the stylesheet that imports it", async () => {
+    resetOracle()
+    const css = workspace()
+    const cwd = vi.spyOn(process, "cwd").mockReturnValue(path.dirname(css))
+    // A pnpm bin shim puts the hoisted modules on NODE_PATH, which would
+    // hide the bug; editors and Vite+ start the linter without one.
+    const nodePath = process.env.NODE_PATH
+    const paths = Module as unknown as { _initPaths(): void }
+    delete process.env.NODE_PATH
+    paths._initPaths()
+    try {
+      const answer = await query(css, ["kit-frame", "flex", "kit-frmae"])
+      expect(answer.ok).toBe(true)
+      if (!answer.ok) return
+      expect(answer.unknown).toEqual([
+        { token: "kit-frmae", suggestion: "kit-frame", baseKnown: false },
+      ])
+    } finally {
+      cwd.mockRestore()
+      if (nodePath !== undefined) process.env.NODE_PATH = nodePath
+      paths._initPaths()
+    }
+  })
+
   test("a theme that cannot be read is unavailable, not wrong", async () => {
     const answer = await query("/nonexistent/app/globals.css", ["flex"])
     expect(answer.ok).toBe(false)
```

---

### Incident Patch 3: `b291b5b2` (2026-09-21)
**Commit Message**: fix: read a project's animations from its CSS (#45)

**File**: `.changeset/animate-from-project.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@shadcn/lint": patch
+---
+
+Read a project's animations from its CSS. An `animate-*` class now classifies as motion when the theme declares `--animate-<name>` or the CSS declares it with `@utility` or a selector, so the result no longer depends on cn grouping every `animate-*` name.
```

**File**: `packages/lint/src/project/namespaces.ts` (modified, +24/-4)
```diff
@@ -7,7 +7,11 @@
 import { categoryOf } from "../grammar/categories"
 import { normalizeClass, OPACITY_MODIFIER } from "../grammar/classes"
 import { classifierFor } from "../grammar/classifier"
-import { themeVocabularyFor, type ThemeVocabulary } from "./theme"
+import {
+  declaresClass,
+  themeVocabularyFor,
+  type ThemeVocabulary,
+} from "./theme"
 
 // Longest prefix first: text-shadow-crisp is a text-shadow, not text
 // "shadow-crisp".
@@ -52,6 +56,8 @@ const NAMESPACES: {
   },
 ]
 
+const ANIMATE_PREFIX = "animate-"
+
 const memos = new WeakMap<ThemeVocabulary, Map<string, string | null>>()
 
 function memoFor(vocabulary: ThemeVocabulary) {
@@ -99,15 +105,29 @@ export function themeGroupFor(fromFile: string | undefined, token: string) {
   return group
 }
 
+// cn groups only Tailwind's own animations, so that merging never drops a
+// plugin's animate-once. A project's animation is one its CSS declares:
+// --animate-shimmer in @theme, or animate-in from an @utility or selector.
+export function animationGroupFor(fromFile: string | undefined, token: string) {
+  if (!fromFile) return null
+  const base = normalizeClass(token)
+  if (!base.startsWith(ANIMATE_PREFIX)) return null
+  const value = valueOf(base, ANIMATE_PREFIX)
+  if (!value) return null
+  if (themeVocabularyFor(fromFile)?.names.has(base)) return "animate"
+  return declaresClass(fromFile, token) ? "animate" : null
+}
+
 // The classifier the rules use: cn's grammar, then the project's theme
 // wherever the grammar's answer was a color it could not have known was
-// something else. Nothing but a color can be shadowed this way, so the
-// grammar answers first and the theme is read only when it could change
-// the verdict.
+// something else, or no answer for an animation the project declares.
+// Nothing else can be shadowed this way, so the grammar answers first and
+// the theme is read only when it could change the verdict.
 export function projectClassifierFor(fromFile?: string) {
   const { groupOf: grammarGroupOf } = classifierFor(fromFile)
   const groupOf = (token: string) => {
     const group = grammarGroupOf(token)
+    if (!group) return animationGroupFor(fromFile, token)
     if (categoryOf(group) !== "color") return group
     return themeGroupFor(fromFile, token) ?? group
   }
```

**File**: `packages/lint/test/classifier-project.test.ts` (modified, +37/-7)
```diff
@@ -10,19 +10,49 @@ import {
   groupOf,
   resolveCnConfig,
 } from "../src/grammar/classifier"
+import {
+  animationGroupFor,
+  projectClassifierFor,
+} from "../src/project/namespaces"
 import { resetWarnings, setWarningSink } from "../src/project/warn"
 
 describe("animate values, from cn's grammar", () => {
+  test.each(["animate-spin", "animate-none", "hover:animate-pulse"])(
+    "%s classifies as animate (motion)",
+    (token) => {
+      expect(groupOf(token)).toBe("animate")
+      expect(categoryOf(groupOf(token))).toBe("motion")
+    }
+  )
+})
+
+// cn groups only Tailwind's own animations, so a project's animation is
+// read from its CSS. These hold whichever cn grammar is installed.
+describe("animate values, from the project's CSS", () => {
+  const PAGE = path.join(__dirname, "fixtures/namespace-theme/app/page.tsx")
+
   test.each([
+    "animate-shimmer",
     "animate-in",
-    "animate-out",
-    "animate-accordion-down",
-    "animate-caret-blink",
-    "data-[state=open]:animate-accordion-down",
-    "animate-spin",
+    "data-[state=open]:animate-in",
+    "animate-in!",
+    "animate-duration-500",
   ])("%s classifies as animate (motion)", (token) => {
-    expect(groupOf(token)).toBe("animate")
-    expect(categoryOf(groupOf(token))).toBe("motion")
+    expect(animationGroupFor(PAGE, token)).toBe("animate")
+    const group = projectClassifierFor(PAGE).groupOf(token)
+    expect(group).toBe("animate")
+    expect(categoryOf(group)).toBe("motion")
+  })
+
+  test.each(["animate-wiggle", "animate-[spin_1s]", "fade-in", "text-sm"])(
+    "%s is not a project animation",
+    (token) => {
+      expect(animationGroupFor(PAGE, token)).toBeNull()
+    }
+  )
+
+  test("no file means no project to read", () => {
+    expect(animationGroupFor(undefined, "animate-shimmer")).toBeNull()
   })
 })
 
```

**File**: `packages/lint/test/fixtures/namespace-theme/app/globals.css` (modified, +14/-0)
```diff
@@ -20,3 +20,17 @@
 .text-legacy {
   color: #f00;
 }
+
+/* Animations the project declares: a theme value, and the @utility shape
+   tw-animate-css uses for animate-in. */
+@theme inline {
+  --animate-shimmer: shimmer 2s linear infinite;
+}
+
+@utility animate-in {
+  animation: enter 150ms ease;
+}
+
+@utility animate-duration-* {
+  animation-duration: calc(--value(integer) * 1ms);
+}
```

---

### Incident Patch 4: `505a37d3` (2026-09-20)
**Commit Message**: fix: read a destructured binding's own slot, and resolve a package's own name (#42)

**File**: `.changeset/destructuring-and-self-reference.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@shadcn/lint": patch
+---
+
+Read a destructured binding's own slot of its initializer, and resolve a ui package's alias to its own name.
```

**File**: `packages/lint/src/project/resolve.ts` (modified, +14/-1)
```diff
@@ -221,6 +221,16 @@ function packageDirectory(name: string, fromDir: string) {
   return found ? realpath(found) : null
 }
 
+// A package that refers to itself by name, the way a monorepo's ui
+// package points aliases.ui at "@workspace/ui/components": Node reads
+// that through the enclosing package.json, so the linter does too.
+function selfPackageDirectory(name: string, fromDir: string) {
+  const manifest = findUp(fromDir, "package.json")
+  if (!manifest) return null
+  const dir = path.dirname(manifest)
+  return readPackageJson(dir)?.name === name ? realpath(dir) : null
+}
+
 function splitPackageSpecifier(spec: string) {
   const parts = spec.split("/")
   const nameLength = spec.startsWith("@") ? 2 : 1
@@ -284,7 +294,10 @@ export function candidatesFor(
   const pkg = splitPackageSpecifier(spec)
   if (!pkg) return out
   const dir =
-    packageDirectory(pkg.name, rootDir) ?? packageDirectory(pkg.name, fromDir)
+    selfPackageDirectory(pkg.name, rootDir) ??
+    selfPackageDirectory(pkg.name, fromDir) ??
+    packageDirectory(pkg.name, rootDir) ??
+    packageDirectory(pkg.name, fromDir)
   if (!dir) return out
   const subpath = pkg.subpath ? `./${pkg.subpath}` : "."
   const exportsMap = readPackageJson(dir)?.exports
```

**File**: `packages/lint/src/sites/collect.ts` (modified, +120/-4)
```diff
@@ -408,21 +408,86 @@ function isWritten(variable: any) {
   )
 }
 
+// The slot a destructured binding reads from its initializer: `cls` in
+// `const [dot, text, cls] = init` is element 2, `colorCls` in
+// `const { Icon, colorCls } = init` is that property.
+export type PatternStep = { index: number } | { key: string }
+
+// The steps from a binding up to its declarator's pattern, outermost
+// first. Null for a rest or a default, whose value no one slot holds.
+function patternStepsOf(binding: any, pattern: any) {
+  const steps: PatternStep[] = []
+  let node = binding
+  while (node !== pattern) {
+    const parent = node?.parent
+    if (parent?.type === "ArrayPattern") {
+      steps.unshift({ index: parent.elements.indexOf(node) })
+      node = parent
+    } else if (
+      parent?.type === "Property" &&
+      parent.value === node &&
+      parent.parent?.type === "ObjectPattern"
+    ) {
+      const key = keyName(parent)
+      if (key === null) return null
+      steps.unshift({ key })
+      node = parent.parent
+    } else {
+      return null
+    }
+  }
+  return steps
+}
+
+// Follows the steps into a literal initializer as far as the shape is
+// plain: an array without a spread before the slot, an object without
+// spreads. What remains is for the reader to follow through branches.
+function projectStatic(init: any, steps: PatternStep[]) {
+  let node = init
+  let i = 0
+  for (; i < steps.length; i++) {
+    const value = unwrapTs(node)
+    const step = steps[i]
+    if ("index" in step && value?.type === "ArrayExpression") {
+      const before = value.elements.slice(0, step.index + 1)
+      if (before.some((el: any) => el?.type === "SpreadElement")) break
+      const element = value.elements[step.index]
+      if (!element) break
+      node = element
+    } else if ("key" in step && value?.type === "ObjectExpression") {
+      if (value.properties.some((p: any) => p.type !== "Property")) break
+      const found = value.properties.filter((p: any) => keyName(p) === step.key)
+      if (!found.length) break
+      node = found[found.length - 1].value
+    } else break
+  }
+  return { init: node, steps: steps.slice(i) }
+}
+
 // One hop to a same-file const's initializer. `path` holds the variables
 // on the current route, so a self-reference stops while the same variable
-// read from both branches of a ternary resolves twice.
+// read from both branches of a ternary resolves twice. A destructured
+// binding gets its own slot of the initializer, and any steps a reader
+// still has to follow through a conditional.
 export function resolveIdentifier(node: any, context: any, path: Set<any>) {
   const variable = variableOf(node, context)
   if (!variable || path.has(variable)) return null
   const def = variable.defs?.[0]
   if (!def || def.type !== "Variable" || !def.node?.init) return null
   if (isWritten(variable)) return null
+  let init = def.node.init
+  let steps: PatternStep[] = []
+  if (def.name !== def.node.id) {
+    const route = patternStepsOf(def.name, def.node.id)
+    if (!route) return null
+    ;({ init, steps } = projectStatic(init, route))
+  }
   if (
-    unwrapTs(def.node.init)?.type === "ObjectExpression" &&
+    unwrapTs(init)?.type === "ObjectExpression" &&
     isEscaped(variable, context)
   )
     return null
-  return { init: def.node.init, variable }
+  return { init, variable, steps }
 }
 
 // A props parameter or a property destructured from it. A nested data
@@ -667,6 +732,57 @@ export function collectClassStrings(
     if (resolvedCalls === 0) vocabularyStrings.push(string)
   }
 
+  // The slot a destructured binding reads, followed through the branches
+  // of its initializer: `const [, , cls] = ok ? a : b` reads element 2 of
+  // a and of b. A shape the steps cannot enter is unresolved, not read
+  // whole: its other slots were never classes.
+  const visitThrough = (
+    node: any,
+    steps: PatternStep[],
+    valuesMode: boolean
+  ): void => {
+    if (!steps.length) {
+      visit(node, valuesMode)
+      return
+    }
+    const value = unwrapTs(node)
+    switch (value?.type) {
+      case "ConditionalExpression":
+        visitThrough(value.consequent, steps, valuesMode)
+        visitThrough(value.alternate, steps, valuesMode)
+        return
+      case "LogicalExpression":
+        if (value.operator !== "&&") visitThrough(value.left, steps, valuesMode)
+        visitThrough(value.right, steps, valuesMode)
+        return
+      case "Identifier": {
+        const resolved = resolve
+          ? resolveIdentifier(value, context, path)
+          : null
+        if (!resolved) {
+          unresolved.push(value)
+          return
+        }
+        path.add(resolved.variable)
+        visitThrough(resolved.init, [...resolved.steps, ...steps], valuesMode)
+        path.delete(resolved.variable)
+        return
+      }
+      case "ArrayExpression":
+      case "ObjectExpression": {
+        const projected = projectStati
```

**File**: `packages/lint/test/destructured-initializers.test.ts` (added, +134/-0)
```diff
@@ -0,0 +1,134 @@
+// A destructured binding reads one slot of its initializer. Reading the
+// whole initializer reported a sibling label as a class and an object's
+// keys instead of the destructured value.
+
+import { describe, test } from "vitest"
+
+import { noArbitraryValues } from "../src/rules/no-arbitrary-values"
+import { noUnknownClasses } from "../src/rules/no-unknown-classes"
+import { oracleAvailable } from "../src/tailwind/client"
+import { createTester, PAGE } from "./helpers"
+
+const tester = createTester()
+
+// With the worker built the project's Tailwind names the fix; without
+// it the bundled grammar only knows the class is unknown.
+const unknown = (code: string, className: string, suggestion: string) =>
+  oracleAvailable()
+    ? {
+        messageId: "unknownClassSuggest",
+        data: {
+          className,
+          suggestion,
+          file: "test/fixtures/project/app/globals.css",
+        },
+        suggestions: [
+          {
+            messageId: "useSuggestion",
+            data: { suggestion },
+            output: code.replace(className, suggestion),
+          },
+        ],
+      }
+    : {
+        messageId: "unknownClass",
+        data: {
+          className,
+          suggestion: "",
+          file: "test/fixtures/project/app/globals.css",
+        },
+      }
+
+const ARRAY_TYPO = `export function A({ ok }: { ok: boolean }) {
+  const [dot, text, cls] = ok ? ["var(--ok)", "Connected", "itms-center"] : ["var(--muted)", "Needs setup", "items-start"]
+  return <span className={cls}>{text}</span>
+}`
+
+const OBJECT_TYPO = `export function A({ ok }: { ok: boolean }) {
+  const { Icon, colorCls } = ok ? { Icon: "x", colorCls: "flex" } : { Icon: "y", colorCls: "flx" }
+  return <span className={colorCls} title={Icon} />
+}`
+
+describe("destructured initializers", () => {
+  test("only the destructured slot reaches the class site", () => {
+    tester.run("no-unknown-classes", noUnknownClasses as any, {
+      valid: [
+        // The reporter's case: the array's other slots are a variable
+        // reference and a label, and the object's keys are not classes.
+        {
+          filename: PAGE,
+          code: `export function A({ ok }: { ok: boolean }) {
+  const [dot, text, cls] = ok ? ["var(--ok)", "Connected", "items-center"] : ["var(--muted)", "Needs setup", "items-start"]
+  const { Icon, colorCls } = ok ? { Icon: "x", colorCls: "flex" } : { Icon: "y", colorCls: "grid" }
+  return <span className={\`flex \${cls} \${colorCls}\`} style={{ background: dot }} title={Icon}>{text}</span>
+}`,
+        },
+        // Through another binding, and a plain literal.
+        {
+          filename: PAGE,
+          code: `const pair = ["Label", "flex"]
+const [, , cls] = ["a", "b", "grid"]
+export function A() {
+  const [label, klass] = pair
+  return <span className={\`\${klass} \${cls}\`}>{label}</span>
+}`,
+        },
+      ],
+      invalid: [
+        // The slot itself is still read: one finding, for the typo.
+        {
+          filename: PAGE,
+          code: ARRAY_TYPO,
+          errors: [unknown(ARRAY_TYPO, "itms-center", "items-center")],
+        },
+        {
+          filename: PAGE,
+          code: OBJECT_TYPO,
+          errors: [unknown(OBJECT_TYPO, "flx", "flex")],
+        },
+      ],
+    })
+  })
+
+  test("a slot that cannot be read is not read as its siblings", () => {
+    tester.run("no-arbitrary-values", noArbitraryValues as any, {
+      valid: [
+        // A rest holds several slots; a spread moves them: neither is
+        // read, and the siblings are not read in their place.
+        {
+          filename: PAGE,
+          code: `export function A({ more }: { more: string[] }) {
+  const [label, ...rest] = ["p-[13px]", "flex"]
+  const [first, second] = [...more, "p-[13px]"]
+  return <span className={\`\${rest[0]} \${second}\`}>{label}</span>
+}`,
+        },
+      ],
+      invalid: [
+        {
+          filename: PAGE,
+          code: `export function A({ ok }: { ok: boolean }) {
+  const [dot, label, cls] = ok ? ["var(--ok)", "Connected", "p-[13px]"] : ["var(--muted)", "Needs setup", "p-4"]
+  return <span className={cls}>{label}</span>
+}`,
+          errors: [
+            {
+              messageId: "arbitraryValueWithScale",
+              data: { className: "p-[13px]", replacement: "p-3.25" },
+              suggestions: [
+                {
+                  messageId: "useScale",
+                  data: { replacement: "p-3.25" },
+                  output: `export function A({ ok }: { ok: boolean }) {
+  const [dot, label, cls] = ok ? ["var(--ok)", "Connected", "p-3.25"] : ["var(--muted)", "Needs setup", "p-4"]
+  return <span className={cls}>{label}</span>
+}`,
+                },
+              ],
+            },
+          ],
+        },
+      ],
+    })
+  })
+})
```

**File**: `packages/lint/test/fixtures/monorepo/packages/ui/components.json` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+{
+  "aliases": {
+    "components": "@workspace/ui/components",
+    "ui": "@workspace/ui/components",
+    "lib": "@workspace/ui/lib"
+  },
+  "tailwind": { "css": "src/styles/globals.css" }
+}
```

**File**: `packages/lint/test/project-model.test.ts` (modified, +14/-0)
```diff
@@ -152,6 +152,20 @@ describe("monorepo", () => {
     expect(componentsFor(ADMIN_PAGE).files.get("Button")).toBe(UI_BUTTON)
   })
 
+  // The ui package's own components.json names the package itself, the
+  // way the official monorepo template does; from inside the package
+  // there is no node_modules entry to find, only the package.json above.
+  test("ui alias through the package's own name, from inside it", () => {
+    const warnings: string[] = []
+    setWarningSink((message) => warnings.push(message))
+    const ui = path.join(MONO, "packages/ui")
+    expect(
+      resolveDirectory("@workspace/ui/components", UI_COMPONENTS, ui)
+    ).toBe(UI_COMPONENTS)
+    expect(componentsFor(UI_BUTTON).files.get("Button")).toBe(UI_BUTTON)
+    expect(warnings).toEqual([])
+  })
+
   test("theme through a workspace @import, not through tailwindcss itself", () => {
     const tokens = colorTokensFor(WEB_PAGE)!
     expect(tokens.has("brand")).toBe(true)
```

---

### Incident Patch 5: `28f102c5` (2026-09-20)
**Commit Message**: fix: read themes past comments, scoped color namespaces, exports patterns, and plain selectors (#35)

**File**: `.changeset/theme-reading-bugs.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@shadcn/lint": patch
+---
+
+Fix theme reading past comments, scoped color namespaces, `exports` patterns, plain selectors hiding raw colors, and the TypeScript parser peer warning.
```

**File**: `.gitignore` (modified, +2/-0)
```diff
@@ -21,3 +21,5 @@ dist-next/
 !packages/lint/test/fixtures/project/node_modules/
 !packages/lint/test/fixtures/pnpm-linked/node_modules/
 !packages/lint/test/fixtures/pnpm-linked/node_modules/.pnpm/*/node_modules/
+!packages/lint/test/fixtures/exports-pattern/node_modules/
+!packages/lint/test/fixtures/exports-pattern/node_modules/demo-widgets/dist/
```

**File**: `CONTRIBUTING.md` (modified, +4/-2)
```diff
@@ -139,8 +139,10 @@ the built plugin. Time `oxlint .` with and without the plugin. Set
 bridge builds an AST for each file visited by a JavaScript rule.
 
 Project analysis uses the optional `oxc-parser`, falling back to
-`@typescript-eslint/parser`. With `oxc-parser` installed, this analysis
-does not load TypeScript under Oxlint. Same-file wrapper analysis
+`@typescript-eslint/parser`, an optional peer so that an Oxlint project
+on a TypeScript the parser does not yet support sees no peer warning.
+With `oxc-parser` installed, this analysis does not load TypeScript
+under Oxlint. Same-file wrapper analysis
 reuses the linter's AST. Measure `no-unknown-classes` separately when
 cold-start cost matters: its first query also loads Tailwind.
 
```

**File**: `docs/how-it-works.md` (modified, +5/-0)
```diff
@@ -65,6 +65,11 @@ reads `--color-*` declarations in `@theme`:
 - `bg-zinc-100` is reported: it uses a raw palette color.
 - `bg-highlight` is reported: it names an undeclared token.
 
+A color utility also reads its own namespace, the way Tailwind does:
+`--background-color-surface` declares `bg-surface` and nothing else,
+`--text-color-ink` declares `text-ink`, `--border-color-edge` declares
+`border-edge`.
+
 Imported stylesheets can contribute tokens and custom utilities.
 Tailwind's built-in palette does not count as your project's declared
 tokens. See [no-raw-colors](./rules/no-raw-colors.md).
```

**File**: `docs/rules/no-raw-colors.md` (modified, +9/-1)
```diff
@@ -44,7 +44,15 @@ Some theme namespaces share a prefix with a color utility. Declaring
 color, and neither is reported as one; the same holds for
 `--inset-shadow-*`, `--drop-shadow-*`, `--text-shadow-*`, and
 `--background-image-*`. Classes your CSS declares with `@utility` are
-your vocabulary too.
+your vocabulary too. A plain selector is not: with
+`.text-danger { color: #f00 }` in your CSS, `text-danger` is still
+reported, since the color behind it is raw.
+
+Tailwind also reads a color from the utility's own namespace before
+`--color-*`. `--background-color-surface` declares `bg-surface`,
+`--text-color-ink` declares `text-ink`, and `--border-color-edge`
+declares `border-edge`. Such a token counts for that utility only:
+`text-surface` is still undeclared.
 
 ### SVG attributes
 
```

**File**: `packages/lint/package.json` (modified, +5/-1)
```diff
@@ -53,19 +53,23 @@
   ],
   "dependencies": {
     "@eslint/core": "^0.17.0",
-    "@typescript-eslint/parser": "^8.40.0",
     "cn": "0.2.6"
   },
   "peerDependencies": {
+    "@typescript-eslint/parser": ">=8.40.0",
     "eslint": ">=9.30.0"
   },
   "peerDependenciesMeta": {
+    "@typescript-eslint/parser": {
+      "optional": true
+    },
     "eslint": {
       "optional": true
     }
   },
   "devDependencies": {
     "@types/node": "^24.3.0",
+    "@typescript-eslint/parser": "^8.40.0",
     "eslint": "^9.33.0",
     "oxlint": "^1.80.0",
     "tailwind-merge": "^3.6.0",
```

**File**: `packages/lint/src/project/parser.ts` (modified, +14/-2)
```diff
@@ -7,6 +7,8 @@
 import { createRequire } from "node:module"
 import * as path from "node:path"
 
+import { warnOnce } from "./warn"
+
 const require = createRequire(import.meta.url)
 
 export type ParserKind = "oxc" | "typescript"
@@ -61,8 +63,18 @@ function loadOxc(): Parser | null {
 }
 
 function loadTypeScript(): Parser {
-  const ts = require("@typescript-eslint/parser") as {
-    parse: (source: string, options: object) => any
+  let ts: { parse: (source: string, options: object) => any }
+  try {
+    ts = require("@typescript-eslint/parser")
+  } catch {
+    // Both parsers are optional installs; without either, component
+    // files cannot be read and every caller degrades quietly, so say
+    // so once.
+    warnOnce(
+      "parser:none",
+      "Neither oxc-parser nor @typescript-eslint/parser is installed, so component files cannot be read: variants and wrappers are unknown until one is."
+    )
+    throw new Error("no parser is installed")
   }
   return {
     kind: "typescript",
```

**File**: `packages/lint/src/project/theme.ts` (modified, +110/-17)
```diff
@@ -29,6 +29,9 @@ type Declaration = { name: string; value: string; theme: boolean }
 
 type ThemeRead = {
   tokens: Set<string>
+  // Tokens a color utility reads from its own namespace before
+  // --color-*: --background-color-surface declares bg-surface only.
+  scoped: Map<string, Set<string>>
   utilities: Set<string>
   classes: Set<string>
   // Every custom property the project declares, in light mode, last
@@ -53,6 +56,37 @@ const cache = new Map<
   { signature: string; checkedAt: number; read: ThemeRead }
 >()
 
+// Removes /* */ comments the way a CSS tokenizer would: a "/*" inside a
+// string or an unquoted url() is text, so an @source glob such as
+// "dist/*.js" does not swallow the theme declared after it.
+export function stripComments(css: string) {
+  const parts: string[] = []
+  let start = 0
+  let i = 0
+  while (i < css.length) {
+    const char = css[i]
+    if (char === "/" && css[i + 1] === "*") {
+      parts.push(css.slice(start, i))
+      const end = css.indexOf("*/", i + 2)
+      i = end === -1 ? css.length : end + 2
+      start = i
+    } else if (char === '"' || char === "'") {
+      i++
+      while (i < css.length && css[i] !== char) {
+        i += css[i] === "\\" ? 2 : 1
+      }
+      i++
+    } else if (css.startsWith("url(", i)) {
+      const end = css.indexOf(")", i + 4)
+      i = end === -1 ? css.length : end + 1
+    } else {
+      i++
+    }
+  }
+  parts.push(css.slice(start))
+  return parts.join("")
+}
+
 export function parseColorTokens(css: string) {
   const tokens = new Set<string>()
   applyColorTokens(css, tokens)
@@ -63,25 +97,59 @@ function applyColorTokens(css: string, tokens: Set<string>) {
   applyTokenDeclarations(parseDeclarations(css).declarations, tokens)
 }
 
+// The namespaces Tailwind reads a color utility from before --color-*,
+// verified against Tailwind 4.3.3. Shadows, inset rings and gradient
+// stops read --color-* only.
+export const COLOR_NAMESPACES = [
+  "background-color",
+  "text-color",
+  "border-color",
+  "divide-color",
+  "ring-color",
+  "outline-color",
+  "accent-color",
+  "caret-color",
+  "placeholder-color",
+  "text-decoration-color",
+  "text-shadow-color",
+  "drop-shadow-color",
+  "fill",
+  "stroke",
+]
+
 // In cascade order: `--color-x: initial` drops x, `--color-*: initial`
-// and `--*: initial` drop everything declared so far.
+// and `--*: initial` drop everything declared so far. A scoped
+// namespace resets on its own.
 function applyTokenDeclarations(
   declarations: Declaration[],
-  tokens: Set<string>
+  tokens: Set<string>,
+  scoped?: Map<string, Set<string>>
 ) {
   for (const { name, value, theme } of declarations) {
     if (!theme) continue
     const reset = value.trim() === "initial"
     if (name === "*") {
-      if (reset) tokens.clear()
+      if (reset) {
+        tokens.clear()
+        scoped?.clear()
+      }
       continue
     }
-    if (!name.startsWith("color-")) continue
-    const token = name.slice("color-".length)
+    const namespace = name.startsWith("color-")
+      ? "color"
+      : COLOR_NAMESPACES.find((candidate) => name.startsWith(`${candidate}-`))
+    if (!namespace) continue
+    const token = name.slice(namespace.length + 1)
+    let set = tokens
+    if (namespace !== "color") {
+      if (!scoped) continue
+      set = scoped.get(namespace) ?? new Set()
+      scoped.set(namespace, set)
+    }
     if (token === "*") {
-      if (reset) tokens.clear()
-    } else if (reset) tokens.delete(token)
-    else tokens.add(token)
+      if (reset) set.clear()
+    } else if (reset) set.delete(token)
+    else set.add(token)
   }
 }
 
@@ -94,7 +162,7 @@ export function parseDeclarations(css: string) {
   const values = new Map<string, string>()
   const themeNames = new Set<string>()
   const declarations: { name: string; value: string; theme: boolean }[] = []
-  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "")
+  const stripped = stripComments(css)
   const stack: { theme: boolean; dark: boolean }[] = []
   let start = 0
   for (let i = 0; i < stripped.length; i++) {
@@ -154,10 +222,12 @@ export function resolveVariables(
   return failed ? null : out
 }
 
+// Comments go first: a partial whose comment spells out the consumer's
+// `@import "tailwindcss"` does not import Tailwind.
 export function parseImports(css: string) {
   const out: string[] = []
   const re = /@import\s+(?:url\(\s*)?["']([^"']+)["']\s*\)?[^;]*;/g
-  for (const match of css.matchAll(re)) out.push(match[1])
+  for (const match of stripComments(css).matchAll(re)) out.push(match[1])
   return out
 }
 
@@ -172,7 +242,11 @@ export function parseUtilities(css: string) {
 // A class that exists in CSS (.legacy-card) is not an unknown class.
 export function parseClassSelectors(css: string) {
   const out = new Set<string>()
-  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "")
+  // A "dist/*.js" in a string is a glob, not a .js selector.
+  const stripped = stripComments(css).rep
```

---

### Incident Patch 6: `be5f6c42` (2026-09-17)
**Commit Message**: fix: read class:list Sets and keep unreadable render props on the trigger (#34)

**File**: `.changeset/review-follow-ups.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@shadcn/lint": patch
+---
+
+Read a `class:list` Set, and keep classes on the trigger when a `render` prop cannot be read.
```

**File**: `docs/how-it-works.md` (modified, +8/-4)
```diff
@@ -204,14 +204,18 @@ in a trigger's place, and the `className` goes with it:
 ```
 
 The suggestion lists Button's variants, since Button is what wears the
-classes. `render={(props) => <Button {...props} />}` reads the same. A
-trigger that renders a plain element, such as `render={<span />}`,
-restyles nothing in the design system and is not reported.
+classes. `render={(props) => <Button {...props} />}` reads the same,
+because the spread is what carries `className` across. A trigger that
+renders a plain element, such as `render={<span />}`, restyles nothing
+in the design system and is not reported. When the value cannot be
+read, a variable or a function that renders without spreading its
+props, the classes stay on the trigger and its own contract decides.
 
 ## Where it looks
 
 - `className` and similar props, including `wrapperClassName`,
-  `classNames={{ day: "..." }}`, and Astro's `class:list`.
+  `classNames={{ day: "..." }}`, and Astro's `class:list` with a string,
+  array, object, or Set.
 - Calls to `cn`, `cx`, `clsx`, `cva`, `tv`, `twMerge`, `twJoin`, and
   `classNames`, including calls outside JSX. Add functions through
   `mergeFunctions` and `variantFunctions` in shared settings or rule options.
```

**File**: `docs/rules/no-restyle.md` (modified, +2/-1)
```diff
@@ -124,7 +124,8 @@ See [message placeholders](../rules.md#your-own-words).
 The rule follows imports, re-exports, and wrappers that forward
 `className`, including a Base UI `render` prop: the classes on
 `<DialogTrigger render={<Button />} className="...">` belong to Button. A
-wrapper uses the underlying component's contract and variant suggestions.
+`render` value the rule cannot read leaves them on the trigger. A wrapper
+uses the underlying component's contract and variant suggestions.
 
 It also reads same-file values and known class helpers:
 
```

**File**: `packages/lint/src/project/component-imports.ts` (modified, +1/-2)
```diff
@@ -1,4 +1,5 @@
 import type { ComponentIndex } from "./components"
+import { NODE_MODULES } from "./fs"
 import type { ExportBinding } from "./modules"
 
 export type ComponentImport = {
@@ -25,8 +26,6 @@ export function importNameOf(
   }
 }
 
-const NODE_MODULES = /[\\/]node_modules[\\/]/
-
 // One the ui index owns, or any export of a componentImports source.
 export function componentFromImport(
   index: ComponentIndex,
```

**File**: `packages/lint/src/project/fs.ts` (modified, +3/-0)
```diff
@@ -9,6 +9,9 @@ import * as path from "node:path"
 // signature caches (components, theme, wrappers) re-stat on the same beat.
 export const TTL = 1000
 
+// A path inside an installed package, on either separator.
+export const NODE_MODULES = /[\\/]node_modules[\\/]/
+
 const MAX_MEMO_ENTRIES = 50_000
 
 const memo = new Map<string, { at: number; value: unknown }>()
```

**File**: `packages/lint/src/project/namespaces.ts` (modified, +4/-6)
```diff
@@ -9,7 +9,9 @@ import { normalizeClass, OPACITY_MODIFIER } from "../grammar/classes"
 import { classifierFor } from "../grammar/classifier"
 import { themeVocabularyFor, type ThemeVocabulary } from "./theme"
 
-type Namespace = {
+// Longest prefix first: text-shadow-crisp is a text-shadow, not text
+// "shadow-crisp".
+const NAMESPACES: {
   // The prefix as written in the class.
   prefix: string
   // The @theme namespace the utility reads, which is not always the
@@ -21,11 +23,7 @@ type Namespace = {
   // shadow family takes its own first; text- and bg- take the color.
   // Verified against Tailwind 4.3.3, not inferred from the docs.
   overColor: boolean
-}
-
-// Longest prefix first: text-shadow-crisp is a text-shadow, not text
-// "shadow-crisp".
-const NAMESPACES: Namespace[] = [
+}[] = [
   {
     prefix: "text-shadow-",
     namespace: "text-shadow-",
```

**File**: `packages/lint/src/project/theme.ts` (modified, +13/-12)
```diff
@@ -5,7 +5,7 @@
 import * as fs from "node:fs"
 import * as path from "node:path"
 
-import { normalizeClass } from "../grammar/classes"
+import { normalizeClass, OPACITY_MODIFIER } from "../grammar/classes"
 import { parseColor, type Lab } from "../grammar/colors"
 import { lengthInPx } from "../grammar/lengths"
 import { FONT_SIZES, RADII } from "../grammar/tailwind-theme"
@@ -335,6 +335,11 @@ export function discoverThemeFile(root: string) {
   return file
 }
 
+// The path a warning shows, as the project would write it.
+function relativeTo(root: string, file: string) {
+  return path.relative(root, file).replace(/\\/g, "/")
+}
+
 // A components.json naming a stylesheet that is not there is a wrong
 // path, not the absence of a theme: say so once and fall back to
 // discovery, so the token check does not go quiet meanwhile.
@@ -344,13 +349,11 @@ export function themeFileFor(fromFile: string) {
   if (project.cssFile) {
     if (isFile(project.cssFile)) return project.cssFile
     const discovered = discoverThemeFile(project.root)
-    const shown = (file: string) =>
-      path.relative(project.root, file).replace(/\\/g, "/")
     warnOnce(
       `theme:missing:${project.cssFile}`,
-      `components.json sets tailwind.css to ${shown(project.cssFile)}, which does not exist. ${
+      `components.json sets tailwind.css to ${relativeTo(project.root, project.cssFile)}, which does not exist. ${
         discovered
-          ? `Using ${shown(discovered)} until the path is fixed.`
+          ? `Using ${relativeTo(project.root, discovered)} until the path is fixed.`
           : "No stylesheet importing Tailwind was found under the project, so no-raw-colors cannot check declared tokens until the path is fixed."
       }`
     )
@@ -372,13 +375,11 @@ export function tailwindEntryFor(fromFile: string) {
   const project = projectFor(fromFile)
   if (!project) return file
   const discovered = discoverThemeFile(project.root)
-  const shown = (candidate: string) =>
-    path.relative(project.root, candidate).replace(/\\/g, "/")
   warnOnce(
     `theme:no-tailwind:${file}`,
-    `components.json sets tailwind.css to ${shown(file)}, which does not import Tailwind. ${
+    `components.json sets tailwind.css to ${relativeTo(project.root, file)}, which does not import Tailwind. ${
       discovered
-        ? `Using ${shown(discovered)} to read the classes Tailwind knows until the path is fixed.`
+        ? `Using ${relativeTo(project.root, discovered)} to read the classes Tailwind knows until the path is fixed.`
         : "No stylesheet importing Tailwind was found under the project, so no-unknown-classes is using the grammar bundled with @shadcn/lint until the path is fixed."
     }`
   )
@@ -511,7 +512,7 @@ export function themeVocabularyFor(fromFile: string) {
 const utilityPrefixes = new WeakMap<Set<string>, string[]>()
 
 // The `tab-` of an `@utility tab-*`, computed once per theme read.
-function prefixesOf(utilities: Set<string>) {
+export function utilityPrefixesOf(utilities: Set<string>) {
   let list = utilityPrefixes.get(utilities)
   if (!list) {
     list = [...utilities]
@@ -526,11 +527,11 @@ function prefixesOf(utilities: Set<string>) {
 // an @utility prefix, or a class selector. Tailwind generates such a
 // class, so a rule must not report it as a misspelling.
 export function declaresClass(fromFile: string, token: string) {
-  const base = normalizeClass(token).replace(/\/[\w.%]+$/, "")
+  const base = normalizeClass(token).replace(OPACITY_MODIFIER, "")
   if (!base) return false
   const { utilities, classes } = knownClassesFor(fromFile)
   if (utilities.has(base) || classes.has(base)) return true
-  return prefixesOf(utilities).some((prefix) => base.startsWith(prefix))
+  return utilityPrefixesOf(utilities).some((prefix) => base.startsWith(prefix))
 }
 
 // What a project's CSS declares beyond Tailwind's own.
```

**File**: `packages/lint/src/project/variants.ts` (modified, +11/-7)
```diff
@@ -51,12 +51,16 @@ function axesOf(config: any) {
 
 const MAY_DEFINE_VARIANTS = /\b(?:cva|tv)\s*\(|\|\s*["']|\bkeyof\s+typeof\b/
 
+// How far a type is followed through parentheses, aliases and unions
+// before it is given up as unreadable.
+const MAX_TYPE_DEPTH = 8
+
 // oxc keeps parentheses in the type AST; @typescript-eslint drops them.
 function unwrapType(type: any) {
   let out = type
   for (
     let depth = 0;
-    out?.type === "TSParenthesizedType" && depth < 8;
+    out?.type === "TSParenthesizedType" && depth < MAX_TYPE_DEPTH;
     depth++
   ) {
     out = out.typeAnnotation
@@ -84,11 +88,11 @@ function objectKeys(object: any) {
 // as an inline union, which is how a design system without cva writes it.
 function literalValues(
   input: any,
-  declared: { types: Map<string, any>; objects: Map<string, any> },
+  declared: ReturnType<typeof declarationsIn>,
   depth = 0
-): string[] | null {
+) {
   const type = unwrapType(input)
-  if (!type || depth > 8) return null
+  if (!type || depth > MAX_TYPE_DEPTH) return null
   if (type.type === "TSTypeReference" && type.typeName?.type === "Identifier") {
     return literalValues(
       declared.types.get(type.typeName.name),
@@ -119,7 +123,7 @@ function literalValues(
     type.literal?.type === "Literal" &&
     typeof type.literal.value === "string"
   ) {
-    return [type.literal.value]
+    return [type.literal.value as string]
   }
   return null
 }
@@ -128,12 +132,12 @@ function literalValues(
 // `React.ComponentProps<"div"> & Props` resolves.
 function axesOfPropsType(
   input: any,
-  declared: { types: Map<string, any>; objects: Map<string, any> },
+  declared: ReturnType<typeof declarationsIn>,
   depth = 0
 ) {
   const axes: Record<string, string[]> = {}
   const type = unwrapType(input)
-  if (!type || depth > 8) return axes
+  if (!type || depth > MAX_TYPE_DEPTH) return axes
   if (type.type === "TSIntersectionType") {
     for (const member of type.types) {
       Object.assign(axes, axesOfPropsType(member, declared, depth + 1))
```

---

### Incident Patch 7: `b2518bec` (2026-09-17)
**Commit Message**: fix: read variant names through a type alias and a props union (#32)

**File**: `.changeset/variant-names-through-alias.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@shadcn/lint": patch
+---
+
+Read variant names through a type alias and a props union.
```

**File**: `docs/how-it-works.md` (modified, +8/-4)
```diff
@@ -104,10 +104,14 @@ it names stays the one a token belongs in.
 `cva` and `tv` definitions, plus props typed as string unions, such as
 `variant?: "default" | "destructive"` or `size?: "sm" | "lg"`.
 
-Props resolve through intersections and same-file type aliases and
-interfaces. Prop definitions apply only to their component; a factory
-definition can be used for other components in the same file. Spacing
-findings suggest values from the `size` axis.
+Props resolve through intersections, unions, and same-file type aliases
+and interfaces. A prop typed with an alias reads the same as the union
+written inline, and `keyof typeof` a lookup object declared in the file
+lists that object's keys, the shape a design system without `cva` uses.
+When props are a union of shapes — an anchor or a button — the variants
+listed are the ones every member accepts. Prop definitions apply only to
+their component; a factory definition can be used for other components in
+the same file. Spacing findings suggest values from the `size` axis.
 
 The file can come from the UI directory or a resolved import, including
 a barrel. Variant suggestions work without `components.json`.
```

**File**: `packages/lint/src/project/variants.ts` (modified, +115/-27)
```diff
@@ -49,42 +49,114 @@ function axesOf(config: any) {
   return axes
 }
 
-const MAY_DEFINE_VARIANTS = /\b(?:cva|tv)\s*\(|\|\s*["']/
+const MAY_DEFINE_VARIANTS = /\b(?:cva|tv)\s*\(|\|\s*["']|\bkeyof\s+typeof\b/
+
+// oxc keeps parentheses in the type AST; @typescript-eslint drops them.
+function unwrapType(type: any) {
+  let out = type
+  for (
+    let depth = 0;
+    out?.type === "TSParenthesizedType" && depth < 8;
+    depth++
+  ) {
+    out = out.typeAnnotation
+  }
+  return out
+}
+
+// The keys of `const VARIANTS = { ... } as const`, the axis a lookup
+// object declares. Null when a spread or a computed key hides one: a
+// partial list of variants is worse than none.
+function objectKeys(object: any) {
+  if (object?.type !== "ObjectExpression") return null
+  const keys: string[] = []
+  for (const property of object.properties) {
+    if (property.type !== "Property" || property.computed) return null
+    const key = keyName(property.key)
+    if (!key) return null
+    keys.push(key)
+  }
+  return keys.length ? keys : null
+}
 
 // Null unless every member is a string literal (or undefined, for `?:`).
-function literalValues(type: any) {
-  if (!type) return null
-  const members = type.type === "TSUnionType" ? type.types : [type]
-  const values: string[] = []
-  for (const member of members) {
-    if (member.type === "TSUndefinedKeyword") continue
-    if (
-      member.type === "TSLiteralType" &&
-      member.literal?.type === "Literal" &&
-      typeof member.literal.value === "string"
-    ) {
-      values.push(member.literal.value)
-      continue
+// A same-file alias and `keyof typeof` a lookup object name the same axis
+// as an inline union, which is how a design system without cva writes it.
+function literalValues(
+  input: any,
+  declared: { types: Map<string, any>; objects: Map<string, any> },
+  depth = 0
+): string[] | null {
+  const type = unwrapType(input)
+  if (!type || depth > 8) return null
+  if (type.type === "TSTypeReference" && type.typeName?.type === "Identifier") {
+    return literalValues(
+      declared.types.get(type.typeName.name),
+      declared,
+      depth + 1
+    )
+  }
+  if (
+    type.type === "TSTypeOperator" &&
+    type.operator === "keyof" &&
+    type.typeAnnotation?.type === "TSTypeQuery" &&
+    type.typeAnnotation.exprName?.type === "Identifier"
+  ) {
+    return objectKeys(declared.objects.get(type.typeAnnotation.exprName.name))
+  }
+  if (type.type === "TSUnionType") {
+    const values: string[] = []
+    for (const member of type.types) {
+      if (member.type === "TSUndefinedKeyword") continue
+      const nested = literalValues(member, declared, depth + 1)
+      if (!nested) return null
+      values.push(...nested)
     }
-    return null
+    return values.length ? values : null
+  }
+  if (
+    type.type === "TSLiteralType" &&
+    type.literal?.type === "Literal" &&
+    typeof type.literal.value === "string"
+  ) {
+    return [type.literal.value]
   }
-  return values.length ? values : null
+  return null
 }
 
-// Follows intersections and same-file aliases, so
+// Follows intersections, unions and same-file aliases, so
 // `React.ComponentProps<"div"> & Props` resolves.
-function axesOfPropsType(type: any, declared: Map<string, any>, depth = 0) {
+function axesOfPropsType(
+  input: any,
+  declared: { types: Map<string, any>; objects: Map<string, any> },
+  depth = 0
+) {
   const axes: Record<string, string[]> = {}
-  if (!type || depth > 4) return axes
+  const type = unwrapType(input)
+  if (!type || depth > 8) return axes
   if (type.type === "TSIntersectionType") {
     for (const member of type.types) {
       Object.assign(axes, axesOfPropsType(member, declared, depth + 1))
     }
     return axes
   }
+  // A props union (an anchor or a button, one set of variants): only what
+  // every member accepts is a variant of the component.
+  if (type.type === "TSUnionType") {
+    const [first, ...rest]: Record<string, string[]>[] = type.types.map(
+      (member: any) => axesOfPropsType(member, declared, depth + 1)
+    )
+    for (const [name, values] of Object.entries(first ?? {})) {
+      const shared = values.filter((value) =>
+        rest.every((other) => other[name]?.includes(value))
+      )
+      if (shared.length) axes[name] = shared
+    }
+    return axes
+  }
   if (type.type === "TSTypeReference" && type.typeName?.type === "Identifier") {
     return axesOfPropsType(
-      declared.get(type.typeName.name),
+      declared.types.get(type.typeName.name),
       declared,
       depth + 1
     )
@@ -99,28 +171,44 @@ function axesOfPropsType(type: any, declared: Map<string, any>, depth = 0) {
   for (const member of members) {
     if (member.type !== "TSPropertySignature") continue
     const key = keyName(member.key)
-    const values = literalValues(member.typeAnnotation?.typeAnnotation)
+    const values = literalValues(
+      member.typeAnnotation?.typeAnnotation,
+      declared
+    )
     if 
```

**File**: `packages/lint/test/parser.test.ts` (modified, +23/-0)
```diff
@@ -52,6 +52,29 @@ describe("parser", () => {
     useParser(null)
   })
 
+  test("both parsers read an alias, a lookup object and a props union", () => {
+    const source = `
+      const VARIANTS = { primary: "", secondary: "" } as const
+      type ButtonVariant = keyof typeof VARIANTS
+      type Base = { variant?: ButtonVariant }
+      type ButtonProps = (Base & { href: string }) | (Base & { href?: undefined })
+      export function Button(props: ButtonProps) { return <button /> }
+    `
+    const results = KINDS.map((kind) => {
+      useParser(kind)
+      return extractVariantDefinitions(source, "button.tsx")
+    })
+    expect(results[0]).toEqual([
+      {
+        name: "Button",
+        axes: { variant: ["primary", "secondary"] },
+        source: "props",
+      },
+    ])
+    for (const result of results.slice(1)) expect(result).toEqual(results[0])
+    useParser(null)
+  })
+
   test("both parsers find the same wrappers", () => {
     const saveButton = path.join(PROJECT, "components/save-button.tsx")
     const cases: [string, string][] = [
```

**File**: `packages/lint/test/variants-props.test.ts` (modified, +72/-0)
```diff
@@ -62,6 +62,66 @@ describe("variants from props", () => {
     ])
   })
 
+  test("an alias on the prop, and keyof typeof a lookup object", () => {
+    const source = `
+      const VARIANTS = { primary: "bg-accent", secondary: "bg-accent-soft" } as const
+      type ButtonVariant = keyof typeof VARIANTS
+      type ButtonSize = "sm" | "lg"
+      type ButtonProps = { variant?: ButtonVariant; size?: ButtonSize; className?: string }
+      export function Button({ variant = "primary", className }: ButtonProps) {
+        return <button className={cn(VARIANTS[variant], className)} />
+      }
+    `
+    expect(extractVariantDefinitions(source)).toEqual([
+      {
+        name: "Button",
+        axes: { variant: ["primary", "secondary"], size: ["sm", "lg"] },
+        source: "props",
+      },
+    ])
+  })
+
+  test("a lookup object a spread or a computed key hides is not a list", () => {
+    const source = `
+      const VARIANTS = { ...BASE, primary: "bg-accent" } as const
+      type Props = { variant?: keyof typeof VARIANTS }
+      export function Tag(props: Props) { return <span /> }
+    `
+    expect(extractVariantDefinitions(source)).toEqual([])
+  })
+
+  // A component that renders as an anchor or a button declares its props
+  // as a union: the variants it accepts are the ones every member does.
+  test("a props union keeps the variants every member accepts", () => {
+    const source = `
+      type Base = { variant?: "primary" | "secondary"; className?: string }
+      type AsLink = Base & Omit<ComponentProps<typeof Link>, keyof Base>
+      type AsButton = Base &
+        Omit<ComponentProps<"button">, keyof Base> & { href?: undefined }
+      type ButtonProps = AsLink | AsButton
+      export function Button(props: ButtonProps) { return <button /> }
+    `
+    expect(extractVariantDefinitions(source)).toEqual([
+      {
+        name: "Button",
+        axes: { variant: ["primary", "secondary"] },
+        source: "props",
+      },
+    ])
+  })
+
+  test("a variant one member of the union does not accept is left out", () => {
+    const source = `
+      type AsLink = { variant?: "primary" | "ghost" }
+      type AsButton = { variant?: "primary" }
+      type ChipProps = AsLink | AsButton
+      export function Chip(props: ChipProps) { return <span /> }
+    `
+    expect(extractVariantDefinitions(source)).toEqual([
+      { name: "Chip", axes: { variant: ["primary"] }, source: "props" },
+    ])
+  })
+
   test("non-literal unions and plain strings are not axes", () => {
     const source = `
       export function Field({ label, kind, width }: { label: string; kind?: Kind | "auto"; width?: number | "full" }) {
@@ -94,6 +154,18 @@ describe("variants from props", () => {
     expect(sizeNamesFor(file, "CardTitle")).toBeNull()
   })
 
+  test("variantNamesFor reads an alias and a lookup object from the file", () => {
+    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "shadcn-lint-variants-"))
+    const file = path.join(dir, "button.tsx")
+    fs.writeFileSync(
+      file,
+      `const VARIANTS = { primary: "", secondary: "" } as const
+       type ButtonVariant = keyof typeof VARIANTS
+       export function Button({ variant }: { variant?: ButtonVariant }) { return <button /> }`
+    )
+    expect(variantNamesFor(file, "Button")).toEqual(["primary", "secondary"])
+  })
+
   test("variantNamesFor and sizeNamesFor read the component's props", () => {
     const dir = fs.mkdtempSync(path.join(os.tmpdir(), "shadcn-lint-variants-"))
     const file = path.join(dir, "text.tsx")
```

---

### Incident Patch 8: `3df54f21` (2026-09-17)
**Commit Message**: fix: classify Tailwind 3 utility names as the utilities they are (#28)

**File**: `.changeset/renamed-utility-names.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@shadcn/lint": patch
+---
+
+Classify `flex-grow`, `flex-shrink`, and other Tailwind 3 utility names.
```

**File**: `docs/how-it-works.md` (modified, +5/-0)
```diff
@@ -127,6 +127,11 @@ found. A class with no recognized group is `unclassified` and is not
 allowed by `layout`. A recognized group with no appearance category is
 treated as layout; newly unmapped groups produce a warning.
 
+Utilities Tailwind still generates under their Tailwind 3 names read as
+the utilities they are: `flex-grow` and `flex-shrink-0` classify with
+`grow` and `shrink`, `overflow-ellipsis` with `text-ellipsis`, and
+`decoration-slice` and `decoration-clone` as box decorations.
+
 ## Values in variables
 
 The linter follows class values one hop into same-file variables:
```

**File**: `packages/lint/src/grammar/classifier.ts` (modified, +23/-0)
```diff
@@ -236,6 +236,28 @@ function postfixIndex(base: string) {
   return index
 }
 
+// Tailwind still generates these utilities under the names they had in
+// Tailwind 3, so a project that has not renamed them is writing real
+// classes. cn's config carries the current names only, and reads
+// `decoration-clone` as a text-decoration color, so the rename happens
+// before the lookup.
+const RENAMED = new Map([
+  ["flex-grow", "grow"],
+  ["flex-shrink", "shrink"],
+  ["overflow-ellipsis", "text-ellipsis"],
+  ["decoration-slice", "box-decoration-slice"],
+  ["decoration-clone", "box-decoration-clone"],
+])
+
+const RENAMED_SCALE = /^flex-(grow|shrink)-(.+)$/
+
+function currentName(base: string) {
+  const renamed = RENAMED.get(base)
+  if (renamed) return renamed
+  const scale = RENAMED_SCALE.exec(base)
+  return scale ? `${scale[1]}-${scale[2]}` : base
+}
+
 export function createClassifier(config = resolveCnConfig()) {
   const root = buildTrie(config)
   const postfixLookupGroups = new Set(config.postfixLookupClassGroups ?? [])
@@ -264,6 +286,7 @@ export function createClassifier(config = resolveCnConfig()) {
     if (base.endsWith("!")) base = base.slice(0, -1)
     else if (base.startsWith("!")) base = base.slice(1)
     if (!base) return null
+    base = currentName(base)
 
     const slash = postfixIndex(base)
     if (slash === -1) return lookup(base)
```

**File**: `packages/lint/test/classifier.test.ts` (modified, +10/-0)
```diff
@@ -55,6 +55,16 @@ describe("groupOf", () => {
     ["col-start-2", "col-start"],
     ["self-end", "align-self"],
     ["sr-only", "sr"],
+    // Tailwind 3 names Tailwind still generates.
+    ["flex-grow", "grow"],
+    ["flex-grow-0", "grow"],
+    ["flex-shrink", "shrink"],
+    ["flex-shrink-[2]", "shrink"],
+    ["md:flex-grow", "grow"],
+    ["overflow-ellipsis", "text-overflow"],
+    ["decoration-slice", "box-decoration"],
+    ["decoration-clone", "box-decoration"],
+    ["decoration-sky-500", "text-decoration-color"],
   ])("%s -> %s", (token, group) => {
     expect(groupOf(token)).toBe(group)
   })
```

**File**: `packages/lint/test/renamed-utilities.test.ts` (added, +46/-0)
```diff
@@ -0,0 +1,46 @@
+import { describe, test } from "vitest"
+
+import { noRawColors } from "../src/rules/no-raw-colors"
+import { noRestyle } from "../src/rules/no-restyle"
+import { button, createTester, PAGE } from "./helpers"
+
+const tester = createTester()
+
+const layout = [{ allow: ["layout"] }]
+
+// Tailwind still generates the Tailwind 3 names, so the rules read them
+// as the utilities they are rather than as classes nobody recognizes.
+describe("renamed utilities", () => {
+  test("no-restyle allows them wherever the current name is allowed", () => {
+    tester.run("no-restyle", noRestyle as any, {
+      valid: [
+        {
+          filename: PAGE,
+          options: layout,
+          code: `${button}\nexport const A = () => <Button className="flex-grow flex-shrink-0">Go</Button>`,
+        },
+      ],
+      invalid: [
+        // Typography and shape still belong to the component.
+        {
+          filename: PAGE,
+          options: layout,
+          code: `${button}\nexport const A = () => <Button className="overflow-ellipsis">Go</Button>`,
+          errors: [{ messageId: "appearanceClassWithVariants" }],
+        },
+      ],
+    })
+  })
+
+  test("no-raw-colors reads decoration-clone as a box decoration", () => {
+    tester.run("no-raw-colors", noRawColors as any, {
+      valid: [
+        {
+          filename: PAGE,
+          code: `export const A = () => <div className="decoration-clone decoration-slice" />`,
+        },
+      ],
+      invalid: [],
+    })
+  })
+})
```

---

### Incident Patch 9: `0bc3bf25` (2026-09-17)
**Commit Message**: fix: name components from the ui directory's exports, not a package's (#26)

**File**: `.changeset/tidy-pugs-wave.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@shadcn/lint": patch
+---
+
+Fix `no-restyle` naming components after a package's minified exports.
```

**File**: `docs/how-it-works.md` (modified, +7/-0)
```diff
@@ -33,6 +33,13 @@ component just because it has the same name. Name matching is a fallback
 only when an import cannot be resolved. An unresolved UI alias produces
 a warning with the configuration to fix.
 
+A UI file may re-export a name from a package, which makes the linter
+read that package's file. Only the names your UI directory exports are
+its components; the rest of that package is not, whatever its bundled
+locals are called. A component you do re-export from your UI directory
+is checked, and its finding names no file: there is no variant to add
+inside `node_modules`.
+
 Without `components.json`, the linter uses the nearest `package.json`
 and looks in `components/ui` or `src/components/ui`. For another import
 location, set `settings.shadcn.ui`, such as `"@/ds"`. This recognizes
```

**File**: `packages/lint/src/project/component-imports.ts` (modified, +12/-1)
```diff
@@ -25,6 +25,8 @@ export function importNameOf(
   }
 }
 
+const NODE_MODULES = /[\\/]node_modules[\\/]/
+
 // One the ui index owns, or any export of a componentImports source.
 export function componentFromImport(
   index: ComponentIndex,
@@ -34,7 +36,16 @@ export function componentFromImport(
 ) {
   if (binding && index.owns(binding.file)) {
     const component = `${binding.name}${importedName.suffix}`
-    return { component, file: index.files.get(component) ?? binding.file }
+    const indexed = index.files.get(component)
+    // A ui file that re-exports one name from a package pulls that whole
+    // package into the export closure. Only a name the ui directory
+    // exports is the project's component; the package's other exports,
+    // whose bundled locals are the minifier's (`er`), are not.
+    if (!NODE_MODULES.test(binding.file) || indexed) {
+      const file = indexed ?? binding.file
+      // No message sends anyone into a package to add a variant.
+      return { component, file: NODE_MODULES.test(file) ? null : file }
+    }
   }
   if (patterns.some((pattern) => pattern.test(importedName.source))) {
     return { component: importedName.name, file: binding?.file ?? null }
```

**File**: `packages/lint/test/bundled-package-components.test.ts` (added, +75/-0)
```diff
@@ -0,0 +1,75 @@
+// A ui file that wraps a package primitive and re-exports something else
+// from the same package pulls that package into the ui directory's export
+// closure. Reading a package's file does not make its exports the
+// project's components, and no message sends anyone into node_modules.
+
+import * as path from "node:path"
+import { describe, test } from "vitest"
+
+import { noRestyle } from "../src/rules/no-restyle"
+import { createTester, PROJECT } from "./helpers"
+
+const SCROLLER = path.join(PROJECT, "components/ui/scroller.tsx")
+const SCROLLER_SOURCE = `import { Scroller as ScrollerPrimitive, useScroller } from "minified-kit"
+import { cn } from "@/lib/utils"
+function ScrollerButton({ className }: { className?: string }) {
+  return <ScrollerPrimitive.Button className={cn("bg-background", className)} />
+}
+export { ScrollerButton, useScroller }`
+
+describe("a package reached through a ui file's re-export", () => {
+  test("is not the project's design system, whatever its locals are named", () => {
+    createTester().run("no-restyle", noRestyle as any, {
+      valid: [
+        {
+          filename: SCROLLER,
+          code: SCROLLER_SOURCE,
+          options: [{ allow: ["layout"] }],
+        },
+      ],
+      invalid: [],
+    })
+  })
+
+  test("leaves the wrapper itself named and placed by its own file", () => {
+    createTester().run("no-restyle", noRestyle as any, {
+      valid: [],
+      invalid: [
+        {
+          filename: path.join(PROJECT, "app/scroller-page.tsx"),
+          code: `import { ScrollerButton } from "@/components/ui/scroller"
+const a = <ScrollerButton className="bg-background" />`,
+          options: [{ allow: ["layout"] }],
+          errors: [
+            {
+              message:
+                '"bg-background" is not allowed on <ScrollerButton>: <ScrollerButton> owns its color. Add a variant in test/fixtures/project/components/ui/scroller.tsx only if the design explicitly calls for this treatment.',
+            },
+          ],
+        },
+      ],
+    })
+  })
+})
+
+describe("a vendor component the ui directory re-exports", () => {
+  test("is still checked, and its finding names no package file", () => {
+    createTester().run("no-restyle", noRestyle as any, {
+      valid: [],
+      invalid: [
+        {
+          filename: path.join(PROJECT, "app/vendor-page.tsx"),
+          code: `import { VendorChip } from "@/components/ui/vendor-chip"
+const a = <VendorChip className="bg-background" />`,
+          options: [{ allow: ["layout"] }],
+          errors: [
+            {
+              message:
+                '"bg-background" is not allowed on <VendorChip>: <VendorChip> owns its color. Use one of its variants. Add a new variant only if the design explicitly calls for a treatment none of them provides.',
+            },
+          ],
+        },
+      ],
+    })
+  })
+})
```

**File**: `packages/lint/test/fixtures/project/components/ui/scroller.tsx` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+import { Scroller as ScrollerPrimitive, useScroller } from "minified-kit"
+import { cn } from "@/lib/utils"
+
+function ScrollerButton({ className }: { className?: string }) {
+  return <ScrollerPrimitive.Button className={cn("bg-background", className)} />
+}
+
+export { ScrollerButton, useScroller }
```

**File**: `packages/lint/test/fixtures/project/components/ui/vendor-chip.tsx` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+export { VendorChip } from "other-kit/chip"
```

**File**: `packages/lint/test/fixtures/project/node_modules/minified-kit/index.js` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+// A bundled package: the namespace object is a minified local, and the
+// hook beside it is what a ui file re-exports.
+const er = { Provider: (props) => null, Button: (props) => null }
+function Pt() {}
+export { er as Scroller, Pt as useScroller }
```

**File**: `packages/lint/test/fixtures/project/node_modules/minified-kit/package.json` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+{
+  "name": "minified-kit",
+  "version": "1.0.0",
+  "main": "./index.js"
+}
```

---

### Incident Patch 10: `d782dbb2` (2026-09-17)
**Commit Message**: fix: attribute classes to the component a render prop renders (#29)

**File**: `.changeset/render-prop-attribution.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@shadcn/lint": patch
+---
+
+Attribute classes to the component a `render` prop renders.
```

**File**: `docs/how-it-works.md` (modified, +15/-0)
```diff
@@ -177,6 +177,21 @@ Wrapper chains can cross files and use namespace imports such as
 values. A props spread counts as forwarding only if it still contains
 `className`. If several targets qualify, the first supplies the contract.
 
+A `render` prop forwards the same way. Base UI renders another component
+in a trigger's place, and the `className` goes with it:
+
+```tsx
+// no-restyle reports a color override on Button through DialogTrigger.
+<DialogTrigger render={<Button />} className="bg-primary">
+  Open
+</DialogTrigger>
+```
+
+The suggestion lists Button's variants, since Button is what wears the
+classes. `render={(props) => <Button {...props} />}` reads the same. A
+trigger that renders a plain element, such as `render={<span />}`,
+restyles nothing in the design system and is not reported.
+
 ## Where it looks
 
 - `className` and similar props, including `wrapperClassName`,
```

**File**: `docs/rules/no-restyle.md` (modified, +3/-2)
```diff
@@ -122,8 +122,9 @@ See [message placeholders](../rules.md#your-own-words).
 ### Wrappers and variables
 
 The rule follows imports, re-exports, and wrappers that forward
-`className`. A wrapper uses the underlying component's contract and
-variant suggestions.
+`className`, including a Base UI `render` prop: the classes on
+`<DialogTrigger render={<Button />} className="...">` belong to Button. A
+wrapper uses the underlying component's contract and variant suggestions.
 
 It also reads same-file values and known class helpers:
 
```

**File**: `packages/lint/src/sites/collect.ts` (modified, +34/-3)
```diff
@@ -975,6 +975,28 @@ function sharedFor(context: any, options: SiteOptions): Shared {
   return shared
 }
 
+// Base UI renders another element in a component's place through
+// `render`, and the className goes with it: `<DialogTrigger
+// render={<Button />} className="bg-primary" />` is a Button. Returns
+// the opening element the classes reach, null when nothing readable
+// wears them, and undefined when there is no render prop at all.
+function renderedOpeningOf(element: any) {
+  const attribute = (element.attributes ?? []).find(
+    (candidate: any) =>
+      candidate.type === "JSXAttribute" && candidate.name?.name === "render"
+  )
+  if (!attribute) return undefined
+  const value = attribute.value
+  if (value?.type !== "JSXExpressionContainer") return null
+  let expression = value.expression
+  // `render={(props) => <Button {...props} />}` hands the classes to the
+  // same component the element form does.
+  if (expression?.type === "ArrowFunctionExpression") {
+    expression = expression.body
+  }
+  return expression?.type === "JSXElement" ? expression.openingElement : null
+}
+
 // Calls `onSite` for every class site in the file.
 export function classSiteVisitors(
   context: any,
@@ -1005,11 +1027,20 @@ export function classSiteVisitors(
     )
   }
 
+  // A render prop replaces the element, and the className lands on what
+  // it renders, so that is the component wearing the classes.
   const elementOf = (node: any) => {
     const element = node.parent
-    return element?.type === "JSXOpeningElement"
-      ? tracker.resolve(element.name)
-      : null
+    if (element?.type !== "JSXOpeningElement") return null
+    const rendered = renderedOpeningOf(element)
+    if (rendered === undefined) return tracker.resolve(element.name)
+    if (!rendered) return null
+    const resolved = tracker.resolve(rendered.name)
+    if (!resolved) return null
+    return {
+      ...resolved,
+      wrapper: resolved.wrapper ?? jsxNameText(element.name),
+    }
   }
 
   // Fragments and expression containers are not layout parents.
```

**File**: `packages/lint/test/fixtures/project/components/ui/dialog.tsx` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
+
+function Dialog({ ...props }: DialogPrimitive.Root.Props) {
+  return <DialogPrimitive.Root data-slot="dialog" {...props} />
+}
+
+function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
+  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
+}
+
+export { Dialog, DialogTrigger }
```

**File**: `packages/lint/test/render-prop.test.ts` (added, +51/-0)
```diff
@@ -0,0 +1,51 @@
+import { describe, test } from "vitest"
+
+import { noRestyle } from "../src/rules/no-restyle"
+import { button, createTester, PAGE } from "./helpers"
+
+const tester = createTester()
+const rule = noRestyle as any
+
+const layout = [{ allow: ["layout"] }]
+const dialog = `import { DialogTrigger } from "@/components/ui/dialog"`
+
+describe("render prop", () => {
+  test("classes belong to the component the render prop renders", () => {
+    tester.run("no-restyle", rule, {
+      valid: [
+        // The classes land on a plain element, not on the trigger.
+        {
+          filename: PAGE,
+          code: `${dialog}\nexport const A = () => <DialogTrigger render={<span />} className="bg-primary px-6" />`,
+        },
+        // Layout still crosses to the rendered component when allowed.
+        {
+          filename: PAGE,
+          options: layout,
+          code: `${dialog}\n${button}\nexport const A = () => <DialogTrigger render={<Button />} className="mt-4" />`,
+        },
+      ],
+      invalid: [
+        // The variants come from Button, which is what gets the classes.
+        {
+          filename: PAGE,
+          options: layout,
+          code: `${dialog}\n${button}\nexport const A = () => <DialogTrigger render={<Button />} className="bg-primary" />`,
+          errors: [
+            {
+              message:
+                /^"bg-primary" is not allowed on <DialogTrigger>: <DialogTrigger> forwards className to <Button>, which owns its color\. Use a variant: default, outline, secondary, ghost, destructive, link\. Add a new variant in .*button\.tsx /,
+            },
+          ],
+        },
+        // A function render prop hands over the same component.
+        {
+          filename: PAGE,
+          options: layout,
+          code: `${dialog}\n${button}\nexport const A = () => <DialogTrigger render={(props) => <Button {...props} />} className="bg-primary" />`,
+          errors: [{ messageId: "appearanceClassViaWrapper" }],
+        },
+      ],
+    })
+  })
+})
```

---

### Incident Patch 11: `f0df37d7` (2026-09-17)
**Commit Message**: fix: read Astro class:list as a class site (#25)

**File**: `.changeset/astro-class-list.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@shadcn/lint": patch
+---
+
+Read Astro `class:list` as a class site.
```

**File**: `docs/how-it-works.md` (modified, +2/-2)
```diff
@@ -179,8 +179,8 @@ values. A props spread counts as forwarding only if it still contains
 
 ## Where it looks
 
-- `className` and similar props, including `wrapperClassName` and
-  `classNames={{ day: "..." }}`.
+- `className` and similar props, including `wrapperClassName`,
+  `classNames={{ day: "..." }}`, and Astro's `class:list`.
 - Calls to `cn`, `cx`, `clsx`, `cva`, `tv`, `twMerge`, `twJoin`, and
   `classNames`, including calls outside JSX. Add functions through
   `mergeFunctions` and `variantFunctions` in shared settings or rule options.
```

**File**: `packages/lint/src/sites/collect.ts` (modified, +13/-5)
```diff
@@ -55,14 +55,23 @@ export const DEFAULT_MERGE_FUNCTIONS = [
 // Object arguments carry classes as values (cva), not keys (clsx).
 export const DEFAULT_VARIANT_FUNCTIONS = ["cva", "tv"]
 
-const CLASS_ATTRIBUTE = /class(name)?s?$/i
+const CLASS_ATTRIBUTE = /^(class:list|[^:]*class(name)?s?)$/i
 
 const NODE_MODULES = /[\\/]node_modules[\\/]/
 
 export function isClassAttribute(name: string) {
   return CLASS_ATTRIBUTE.test(name)
 }
 
+// Astro's `class:list` parses as a namespaced name.
+export function attributeNameOf(attribute: any) {
+  const name = attribute?.name
+  if (name?.type === "JSXNamespacedName") {
+    return `${name.namespace?.name}:${name.name?.name}`
+  }
+  return typeof name?.name === "string" ? name.name : ""
+}
+
 export type TrackerOptions = {
   componentImports?: string[]
   // Left alone even when the name matches: a raw Radix primitive
@@ -348,7 +357,7 @@ function isEscaped(variable: any, context?: any) {
       if (
         attribute?.type === "JSXAttribute" &&
         (attribute.name?.name === "style" ||
-          isClassAttribute(attribute.name?.name ?? ""))
+          isClassAttribute(attributeNameOf(attribute)))
       )
         return false
       // A helper reads its arguments and never keeps them, directly or
@@ -1070,7 +1079,7 @@ export function classSiteVisitors(
       siteFor(
         node,
         node.value,
-        node.name.name,
+        attributeNameOf(node),
         elementOf(node),
         jsxElementOf(node)
       ),
@@ -1118,8 +1127,7 @@ export function classSiteVisitors(
       tracker.collectImport(node)
     },
     JSXAttribute(node: any) {
-      const name = node.name?.name
-      if (typeof name !== "string" || !isClassAttribute(name)) return
+      if (!isClassAttribute(attributeNameOf(node))) return
       for (const site of attributeSites(node)) emit(site)
     },
     JSXSpreadAttribute(node: any) {
```

**File**: `packages/lint/test/astro-class-list.test.ts` (added, +97/-0)
```diff
@@ -0,0 +1,97 @@
+import { describe, expect, test } from "vitest"
+
+import { noArbitraryValues } from "../src/rules/no-arbitrary-values"
+import { noRawColors } from "../src/rules/no-raw-colors"
+import { attributeNameOf, isClassAttribute } from "../src/sites/collect"
+import { createTester, PAGE } from "./helpers"
+
+const tester = createTester()
+
+// astro-eslint-parser gives `class:list` the same JSXNamespacedName the
+// TypeScript parser does, so these cases run on the shared tester.
+describe("class:list", () => {
+  test("is a class attribute", () => {
+    expect(isClassAttribute("class:list")).toBe(true)
+    expect(isClassAttribute("class")).toBe(true)
+    expect(isClassAttribute("wrapperClassName")).toBe(true)
+    expect(isClassAttribute("client:load")).toBe(false)
+    expect(isClassAttribute("xlink:class")).toBe(false)
+    expect(
+      attributeNameOf({
+        name: {
+          type: "JSXNamespacedName",
+          namespace: { type: "JSXIdentifier", name: "class" },
+          name: { type: "JSXIdentifier", name: "list" },
+        },
+      })
+    ).toBe("class:list")
+  })
+
+  test("strings, arrays and objects reach the class rules", () => {
+    tester.run("no-arbitrary-values", noArbitraryValues as any, {
+      valid: [
+        {
+          filename: PAGE,
+          code: `export const A = () => <a class:list={["p-4", { "mt-2": true }]}>Go</a>`,
+        },
+        {
+          filename: PAGE,
+          code: `export const A = () => <a client:load="p-[13px]">Go</a>`,
+        },
+      ],
+      invalid: [
+        {
+          filename: PAGE,
+          code: `export const A = () => <a class:list="p-[14px]">Go</a>`,
+          errors: [
+            {
+              messageId: "arbitraryValueWithScale",
+              data: { className: "p-[14px]", replacement: "p-3.5" },
+              suggestions: [
+                {
+                  messageId: "useScale",
+                  data: { replacement: "p-3.5" },
+                  output: `export const A = () => <a class:list="p-3.5">Go</a>`,
+                },
+              ],
+            },
+          ],
+        },
+        {
+          filename: PAGE,
+          code: `export const A = () => <a class:list={["p-[15px]"]}>Go</a>`,
+          errors: [
+            {
+              messageId: "arbitraryValueWithScale",
+              data: { className: "p-[15px]", replacement: "p-3.75" },
+              suggestions: [
+                {
+                  messageId: "useScale",
+                  data: { replacement: "p-3.75" },
+                  output: `export const A = () => <a class:list={["p-3.75"]}>Go</a>`,
+                },
+              ],
+            },
+          ],
+        },
+        // Object keys are the classes, the way clsx reads them.
+        {
+          filename: PAGE,
+          code: `export const A = ({ on }: { on: boolean }) => <a class:list={["flex", { "min-w-[70px]": on }, on && "py-[10px]"]}>Go</a>`,
+          errors: 2,
+        },
+      ],
+    })
+
+    tester.run("no-raw-colors", noRawColors as any, {
+      valid: [],
+      invalid: [
+        {
+          filename: PAGE,
+          code: `export const A = () => <a class:list={["bg-red-500"]}>Go</a>`,
+          errors: 1,
+        },
+      ],
+    })
+  })
+})
```

---

### Incident Patch 12: `3ac1d523` (2026-09-17)
**Commit Message**: fix: stop calling a declared @utility class a misspelling (#27)

**File**: `.changeset/warm-lions-report.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@shadcn/lint": patch
+---
+
+Stop `no-restyle` calling a declared `@utility` class a misspelling.
```

**File**: `docs/rules.md` (modified, +3/-0)
```diff
@@ -258,6 +258,9 @@ pass with layout allowed.
 
 `unclassified` is a reported category, not an allowance you can configure.
 Allow a custom class by name, for example `allow: ["layout", "tap-target"]`.
+A class your own CSS declares with `@utility`, or as a plain selector, is
+still `unclassified`: the rule cannot read what it changes. It is reported
+in its own words, which do not call it a misspelling.
 You can open a category for a component with a contract:
 
 ```js
```

**File**: `docs/rules/no-restyle.md` (modified, +3/-1)
```diff
@@ -161,7 +161,9 @@ The rule also accepts [recognition options](../rules.md#recognition):
   and unrelated components are outside this rule.
 - A class the grammar cannot classify is reported as `unclassified`,
   even with `allow: ["layout"]`. Allow a custom class by name when needed.
-  The rule does not inspect that class's CSS.
+  The rule does not inspect that class's CSS. A class your CSS declares
+  with `@utility` is reported the same way, in words that do not treat it
+  as a misspelling.
 - Contracts match class names and groups, not every equivalent CSS effect.
   For example, `w-*` does not match `[width:100%]` or `inline-full`.
 - Allowing `p-*` also allows `p-[13px]` through this rule. Use
```

**File**: `packages/lint/src/project/theme.ts` (modified, +26/-0)
```diff
@@ -5,6 +5,7 @@
 import * as fs from "node:fs"
 import * as path from "node:path"
 
+import { normalizeClass } from "../grammar/classes"
 import { parseColor, type Lab } from "../grammar/colors"
 import { lengthInPx } from "../grammar/lengths"
 import { FONT_SIZES, RADII } from "../grammar/tailwind-theme"
@@ -507,6 +508,31 @@ export function themeVocabularyFor(fromFile: string) {
   })
 }
 
+const utilityPrefixes = new WeakMap<Set<string>, string[]>()
+
+// The `tab-` of an `@utility tab-*`, computed once per theme read.
+function prefixesOf(utilities: Set<string>) {
+  let list = utilityPrefixes.get(utilities)
+  if (!list) {
+    list = [...utilities]
+      .filter((name) => name.endsWith("*"))
+      .map((name) => name.slice(0, -1))
+    utilityPrefixes.set(utilities, list)
+  }
+  return list
+}
+
+// Whether the project's own CSS declares this class: an @utility name,
+// an @utility prefix, or a class selector. Tailwind generates such a
+// class, so a rule must not report it as a misspelling.
+export function declaresClass(fromFile: string, token: string) {
+  const base = normalizeClass(token).replace(/\/[\w.%]+$/, "")
+  if (!base) return false
+  const { utilities, classes } = knownClassesFor(fromFile)
+  if (utilities.has(base) || classes.has(base)) return true
+  return prefixesOf(utilities).some((prefix) => base.startsWith(prefix))
+}
+
 // What a project's CSS declares beyond Tailwind's own.
 export function knownClassesFor(fromFile: string) {
   const cssFile = themeFileFor(fromFile)
```

**File**: `packages/lint/src/rules/no-restyle.ts` (modified, +7/-1)
```diff
@@ -4,6 +4,7 @@
 import { CATEGORIES } from "../grammar/categories"
 import { splitClasses } from "../grammar/classes"
 import { componentsFor } from "../project/components"
+import { declaresClass } from "../project/theme"
 import { sizeNamesFor, variantNamesFor } from "../project/variants"
 import { classSiteVisitors, type ClassSite } from "../sites/collect"
 import { compileContracts, configErrorVisitors } from "./contracts"
@@ -50,6 +51,9 @@ const MESSAGES = {
   layoutClass: `${NOT_ALLOWED} its contract allows {{entries}}. Use one of those, or put layout classes on a parent element.`,
   layoutClassClosed: `${NOT_ALLOWED} its contract allows no classes. Put layout classes on a parent element instead.`,
   unclassifiedClass: `${NOT_ALLOWED} the grammar does not recognize it. Fix the spelling, or use a class Tailwind generates.`,
+  // The project's CSS declares it, so Tailwind does generate it. What it
+  // changes is unreadable, so the contract still owns the decision.
+  declaredClass: `${NOT_ALLOWED} your CSS declares it, and the grammar cannot tell what it changes. Use a variant, or put it on a parent element.`,
   // Padding on a button usually means size; space around it is layout
   // the page owns. A component with no size axis is offered layout only.
   spacingClassWithSizes: `${NOT_ALLOWED} ${OWNS} ${SPACING_SIZES} ${SPACING_NEW_SIZE}`,
@@ -147,7 +151,9 @@ export const noRestyle = {
                   verdict.kind === "denied"
                     ? "deniedClass"
                     : verdict.category === "unclassified"
-                      ? "unclassifiedClass"
+                      ? declaresClass(filename, token)
+                        ? "declaredClass"
+                        : "unclassifiedClass"
                       : verdict.entries.length
                         ? "layoutClass"
                         : "layoutClassClosed",
```

**File**: `packages/lint/test/custom-utility-classes.test.ts` (added, +57/-0)
```diff
@@ -0,0 +1,57 @@
+// A class the project's own CSS declares with @utility is one Tailwind
+// generates. The grammar still cannot say what it changes, so a contract
+// does not let it through, but the finding must not call it a typo.
+
+import { describe, expect, test } from "vitest"
+
+import { declaresClass } from "../src/project/theme"
+import { noRestyle } from "../src/rules/no-restyle"
+import { button, createTester, OUTSIDE, PAGE } from "./helpers"
+
+describe("declaresClass", () => {
+  test("knows the project's @utility names, prefixes, and selectors", () => {
+    expect(declaresClass(PAGE, "tap-target")).toBe(true)
+    expect(declaresClass(PAGE, "hover:tap-target")).toBe(true)
+    expect(declaresClass(PAGE, "tab-4")).toBe(true)
+    expect(declaresClass(PAGE, "legacy-card")).toBe(true)
+    // The reporter's case: an @utility from an imported package's CSS.
+    expect(declaresClass(PAGE, "shimmer")).toBe(true)
+    expect(declaresClass(PAGE, "flex-cols")).toBe(false)
+    expect(declaresClass(OUTSIDE, "tap-target")).toBe(false)
+  })
+})
+
+describe("no-restyle", () => {
+  test("does not report a declared utility as a misspelling", () => {
+    createTester().run("no-restyle", noRestyle as any, {
+      valid: [
+        // Allowing it by name stays the way through.
+        {
+          filename: PAGE,
+          code: `${button}\nconst a = <Button className="tap-target" />`,
+          options: [{ allow: ["layout", "tap-target"] }],
+        },
+      ],
+      invalid: [
+        {
+          filename: PAGE,
+          code: `${button}\nconst a = <Button className="tap-target" />`,
+          options: [{ allow: ["layout"] }],
+          errors: [
+            {
+              message:
+                '"tap-target" is not allowed on <Button>: your CSS declares it, and the grammar cannot tell what it changes. Use a variant, or put it on a parent element.',
+            },
+          ],
+        },
+        // A name nothing declares is still a spelling finding.
+        {
+          filename: PAGE,
+          code: `${button}\nconst a = <Button className="flex-cols" />`,
+          options: [{ allow: ["layout"] }],
+          errors: [{ messageId: "unclassifiedClass" }],
+        },
+      ],
+    })
+  })
+})
```

---

### Incident Patch 13: `a249aeda` (2026-09-17)
**Commit Message**: fix: resolve theme imports from a pnpm-linked package's real path (#30)

**File**: `.changeset/linked-theme-imports.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@shadcn/lint": patch
+---
+
+Resolve theme imports from a pnpm-linked package's real path.
```

**File**: `.gitignore` (modified, +2/-0)
```diff
@@ -19,3 +19,5 @@ plans/
 
 dist-next/
 !packages/lint/test/fixtures/project/node_modules/
+!packages/lint/test/fixtures/pnpm-linked/node_modules/
+!packages/lint/test/fixtures/pnpm-linked/node_modules/.pnpm/*/node_modules/
```

**File**: `packages/lint/src/tailwind/oracle.ts` (modified, +16/-2)
```diff
@@ -195,6 +195,16 @@ export function resolveStylesheet(base: string, id: string) {
   return stylesheetAt(pkgDir, "index")
 }
 
+// The real path of a file reached through a symlink: what its own
+// imports resolve from.
+function realpathOf(file: string) {
+  try {
+    return fs.realpathSync.native(file)
+  } catch {
+    return file
+  }
+}
+
 function mtimeOf(file: string) {
   try {
     return fs.statSync(file).mtimeMs
@@ -220,11 +230,15 @@ async function build(cssFile: string): Promise<Loaded> {
     base: dir,
     async loadStylesheet(id, base) {
       if (/^(?:https?:|data:)/.test(id)) return { base, content: "" }
-      const file = resolveStylesheet(base, id)
+      const resolved = resolveStylesheet(base, id)
       // Refusing to judge beats judging against half a theme.
-      if (!file) {
+      if (!resolved) {
         throw new Error(`@import "${id}" could not be resolved from ${base}`)
       }
+      // A pnpm-installed package is a link into node_modules/.pnpm and its
+      // own dependencies sit beside the real file, so the base for the
+      // imports inside it is the directory that file really lives in.
+      const file = realpathOf(resolved)
       files.push(file)
       return {
         base: path.dirname(file),
```

**File**: `packages/lint/test/fixtures/pnpm-linked/node_modules/.pnpm/linked-kit@1.0.0/node_modules/kit-font/400.css` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+@font-face {
+  font-family: "Kit";
+  font-weight: 400;
+  src: local("Kit");
+}
```

**File**: `packages/lint/test/fixtures/pnpm-linked/node_modules/.pnpm/linked-kit@1.0.0/node_modules/kit-font/package.json` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+{
+  "name": "kit-font",
+  "version": "1.0.0"
+}
```

**File**: `packages/lint/test/fixtures/pnpm-linked/node_modules/.pnpm/linked-kit@1.0.0/node_modules/linked-kit/package.json` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+{
+  "name": "linked-kit",
+  "version": "1.0.0",
+  "dependencies": {
+    "kit-font": "1.0.0"
+  },
+  "exports": {
+    "./css": "./src/styles/kit.css"
+  }
+}
```

**File**: `packages/lint/test/fixtures/pnpm-linked/node_modules/.pnpm/linked-kit@1.0.0/node_modules/linked-kit/src/styles/kit.css` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+/* Imports a dependency installed beside the real file, not beside the link. */
+@import "kit-font/400.css";
+
+@utility kit-frame {
+  outline: 1px dashed currentColor;
+}
```

**File**: `packages/lint/test/fixtures/pnpm-linked/node_modules/linked-kit` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+.pnpm/linked-kit@1.0.0/node_modules/linked-kit
\ No newline at end of file
```

---

### Incident Patch 14: `b6f1f705` (2026-09-17)
**Commit Message**: fix: ask a discovered entry for base utilities when tailwind.css is a partial (#31)

**File**: `.changeset/partial-theme-entry.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@shadcn/lint": patch
+---
+
+Read base utilities from a discovered entry when `tailwind.css` is a partial.
```

**File**: `docs/how-it-works.md` (modified, +6/-0)
```diff
@@ -85,6 +85,12 @@ Tailwind runs in a worker thread because its loader is asynchronous.
 Answers are cached per theme. If Tailwind or the theme cannot load, the
 rule warns and uses a [grammar fallback](./rules/no-unknown-classes.md).
 
+A theme CSS that declares tokens without importing Tailwind — the usual
+shape for a component package — knows no base utilities, so the rule
+would report every stock class. When `components.json` names such a file,
+the linter warns once and asks a discovered entry instead, while the file
+it names stays the one a token belongs in.
+
 ## Variants
 
 `no-restyle` suggests variants found in the component file. It reads
```

**File**: `packages/lint/src/project/theme.ts` (modified, +26/-0)
```diff
@@ -358,6 +358,32 @@ export function themeFileFor(fromFile: string) {
   return discoverThemeFile(project.root)
 }
 
+// The stylesheet whose Tailwind answers which classes exist. A
+// components.json can point tailwind.css at a partial that declares tokens
+// without importing Tailwind, the normal shape for a component package in
+// a monorepo. A theme built from that file holds no base utilities, so
+// every stock class would read as unknown: say so once and ask a
+// discovered entry meanwhile, so the theme's own tokens still name the
+// file a token belongs in.
+export function tailwindEntryFor(fromFile: string) {
+  const file = themeFileFor(fromFile)
+  if (!file || themeAt(file).tailwind) return file
+  const project = projectFor(fromFile)
+  if (!project) return file
+  const discovered = discoverThemeFile(project.root)
+  const shown = (candidate: string) =>
+    path.relative(project.root, candidate).replace(/\\/g, "/")
+  warnOnce(
+    `theme:no-tailwind:${file}`,
+    `components.json sets tailwind.css to ${shown(file)}, which does not import Tailwind. ${
+      discovered
+        ? `Using ${shown(discovered)} to read the classes Tailwind knows until the path is fixed.`
+        : "No stylesheet importing Tailwind was found under the project, so no-unknown-classes is using the grammar bundled with @shadcn/lint until the path is fixed."
+    }`
+  )
+  return discovered
+}
+
 export function colorTokensFor(fromFile: string) {
   const cssFile = themeFileFor(fromFile)
   if (!cssFile) return null
```

**File**: `packages/lint/src/rules/no-raw-colors.ts` (modified, +6/-3)
```diff
@@ -17,6 +17,7 @@ import {
   colorTokensFor,
   colorValuesFor,
   knownClassesFor,
+  tailwindEntryFor,
   themeFileFor,
 } from "../project/theme"
 import { classSiteVisitors } from "../sites/collect"
@@ -171,7 +172,9 @@ export const noRawColors = {
         : "your theme CSS"
       return {
         declared,
-        themeFile,
+        // The stylesheet the oracle can build: not every theme file
+        // imports Tailwind.
+        entry: tailwindEntryFor(filename),
         file,
         memo: verdictMemo(declared ?? NO_THEME, file),
       }
@@ -242,8 +245,8 @@ export const noRawColors = {
     // typo belongs to no-unknown-classes and this rule stays quiet, so
     // the class is reported once.
     const isTypoOfAnotherUtility = (token: string) => {
-      const { themeFile } = themeFor()
-      const asked = themeFile ? unknownClasses(themeFile, [token]) : null
+      const { entry } = themeFor()
+      const asked = entry ? unknownClasses(entry, [token]) : null
       const suggestion = asked?.[0]?.suggestion
       return !!suggestion && categoryOf(groupOf(suggestion)) !== "color"
     }
```

**File**: `packages/lint/src/rules/no-unknown-classes.ts` (modified, +10/-2)
```diff
@@ -7,7 +7,12 @@ import { categoryOf } from "../grammar/categories"
 import { isMarkerClass, normalizeClass, splitClasses } from "../grammar/classes"
 import { didYouMean } from "../grammar/similar"
 import { projectClassifierFor } from "../project/namespaces"
-import { colorTokensFor, knownClassesFor, themeFileFor } from "../project/theme"
+import {
+  colorTokensFor,
+  knownClassesFor,
+  tailwindEntryFor,
+  themeFileFor,
+} from "../project/theme"
 import { classSiteVisitors } from "../sites/collect"
 import { unknownClasses } from "../tailwind/client"
 import { compileVocabularyPolicy, configErrorVisitors } from "./contracts"
@@ -68,6 +73,9 @@ export const noUnknownClasses = {
     const known = knownClassesFor(filename)
     const themeFile = themeFileFor(filename)
     const file = themeFile ? displayPath(themeFile, context) : "your theme CSS"
+    // A theme file that does not import Tailwind knows no base utilities,
+    // so the grammar answers instead of a half-built design system.
+    const entry = tailwindEntryFor(filename)
     const utilityPrefixes = [...known.utilities]
       .filter((name) => name.endsWith("*"))
       .map((name) => name.slice(0, -1))
@@ -154,7 +162,7 @@ export const noUnknownClasses = {
         if (!tokens.length) continue
         // The worker tells a misspelled variant on a real color from a
         // utility that only looks like one, prefix and all.
-        const asked = themeFile ? unknownClasses(themeFile, tokens) : null
+        const asked = entry ? unknownClasses(entry, tokens) : null
         if (asked) {
           for (const { token, suggestion, baseKnown } of asked) {
             if (
```

**File**: `packages/lint/test/fixtures/partial-theme/components.json` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+{
+  "aliases": { "components": "@/components", "ui": "@/components/ui" },
+  "tailwind": { "css": "src/theme.css" }
+}
```

**File**: `packages/lint/test/fixtures/partial-theme/package.json` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+{
+  "name": "partial-theme-fixture",
+  "private": true
+}
```

**File**: `packages/lint/test/fixtures/partial-theme/src/app.css` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+@import "tailwindcss";
+@import "./theme.css";
```

---

### Incident Patch 15: `cba3775e` (2026-09-17)
**Commit Message**: fix: read non-color theme namespaces before calling a class a color (#24)

* fix: read non-color theme namespaces before calling a class a color

* chore: shorten changeset

**File**: `.changeset/cool-moons-repeat.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@shadcn/lint": patch
+---
+
+Fix `no-raw-colors` reporting declared `--text-*` and `--shadow-*` tokens as colors.
```

**File**: `docs/rules/no-raw-colors.md` (modified, +8/-0)
```diff
@@ -38,6 +38,14 @@ Variants, opacity, and important markers are preserved in replacements.
 color names. Arbitrary colors such as `bg-[#333]` belong to
 [no-arbitrary-values](./no-arbitrary-values.md).
 
+Some theme namespaces share a prefix with a color utility. Declaring
+`--text-stat-label` makes `text-stat-label` a font size, and
+`--shadow-card-glow` makes `shadow-card-glow` a box shadow. Neither is a
+color, and neither is reported as one; the same holds for
+`--inset-shadow-*`, `--drop-shadow-*`, `--text-shadow-*`, and
+`--background-image-*`. Classes your CSS declares with `@utility` are
+your vocabulary too.
+
 ### SVG attributes
 
 Use `currentColor` with a text color class, or reference a theme variable:
```

**File**: `packages/lint/src/project/namespaces.ts` (added, +117/-0)
```diff
@@ -0,0 +1,117 @@
+// cn's grammar reads a class by its shape, so every text-* and shadow-*
+// with a name it does not know is a color. Tailwind reads the same class
+// against the project's theme, where a declared --text-stat-label makes
+// it a font-size and --shadow-card-glow a box-shadow. This is the theme's
+// half of that answer: the grammar with the project's namespaces applied.
+
+import { categoryOf } from "../grammar/categories"
+import { normalizeClass, OPACITY_MODIFIER } from "../grammar/classes"
+import { classifierFor } from "../grammar/classifier"
+import { themeVocabularyFor, type ThemeVocabulary } from "./theme"
+
+type Namespace = {
+  // The prefix as written in the class.
+  prefix: string
+  // The @theme namespace the utility reads, which is not always the
+  // prefix: bg-stripes comes from --background-image-stripes.
+  namespace: string
+  // The cn group the class belongs to when the namespace answers.
+  group: string
+  // Whether the namespace wins over a --color-* of the same name. The
+  // shadow family takes its own first; text- and bg- take the color.
+  // Verified against Tailwind 4.3.3, not inferred from the docs.
+  overColor: boolean
+}
+
+// Longest prefix first: text-shadow-crisp is a text-shadow, not text
+// "shadow-crisp".
+const NAMESPACES: Namespace[] = [
+  {
+    prefix: "text-shadow-",
+    namespace: "text-shadow-",
+    group: "text-shadow",
+    overColor: true,
+  },
+  {
+    prefix: "inset-shadow-",
+    namespace: "inset-shadow-",
+    group: "inset-shadow",
+    overColor: true,
+  },
+  {
+    prefix: "drop-shadow-",
+    namespace: "drop-shadow-",
+    group: "drop-shadow",
+    overColor: true,
+  },
+  { prefix: "shadow-", namespace: "shadow-", group: "shadow", overColor: true },
+  { prefix: "text-", namespace: "text-", group: "font-size", overColor: false },
+  {
+    prefix: "bg-",
+    namespace: "background-image-",
+    group: "bg-image",
+    overColor: false,
+  },
+]
+
+const memos = new WeakMap<ThemeVocabulary, Map<string, string | null>>()
+
+function memoFor(vocabulary: ThemeVocabulary) {
+  let memo = memos.get(vocabulary)
+  if (!memo) {
+    memo = new Map()
+    memos.set(vocabulary, memo)
+  }
+  if (memo.size > 50_000) memo.clear()
+  return memo
+}
+
+// The value a utility looks up, without the opacity or line-height
+// modifier. Null when there is nothing a namespace could name.
+function valueOf(base: string, prefix: string) {
+  const rest = base.slice(prefix.length)
+  const modifier = rest.match(OPACITY_MODIFIER)?.[0] ?? ""
+  const value = rest.slice(0, rest.length - modifier.length)
+  if (!value || value.startsWith("[") || value.startsWith("(")) return null
+  return value
+}
+
+function lookup(vocabulary: ThemeVocabulary, token: string) {
+  const base = normalizeClass(token)
+  const entry = NAMESPACES.find((n) => base.startsWith(n.prefix))
+  if (!entry) return null
+  const value = valueOf(base, entry.prefix)
+  if (!value) return null
+  if (!entry.overColor && vocabulary.tokens.has(value)) return null
+  return vocabulary.names.has(`${entry.namespace}${value}`) ? entry.group : null
+}
+
+// The cn group a project's own @theme gives this class, or null when the
+// theme says nothing about it.
+export function themeGroupFor(fromFile: string | undefined, token: string) {
+  if (!fromFile) return null
+  const vocabulary = themeVocabularyFor(fromFile)
+  if (!vocabulary) return null
+  const memo = memoFor(vocabulary)
+  let group = memo.get(token)
+  if (group === undefined) {
+    group = lookup(vocabulary, token)
+    memo.set(token, group)
+  }
+  return group
+}
+
+// The classifier the rules use: cn's grammar, then the project's theme
+// wherever the grammar's answer was a color it could not have known was
+// something else. Nothing but a color can be shadowed this way, so the
+// grammar answers first and the theme is read only when it could change
+// the verdict.
+export function projectClassifierFor(fromFile?: string) {
+  const { groupOf: grammarGroupOf } = classifierFor(fromFile)
+  const groupOf = (token: string) => {
+    const group = grammarGroupOf(token)
+    if (categoryOf(group) !== "color") return group
+    return themeGroupFor(fromFile, token) ?? group
+  }
+  return { groupOf }
+}
```

**File**: `packages/lint/src/project/theme.ts` (modified, +22/-0)
```diff
@@ -15,6 +15,15 @@ import { warnOnce } from "./warn"
 
 export type ScaleKind = "radius" | "text"
 
+// What a project's own CSS names: the @theme declarations, the color
+// tokens among them, and its @utility names. One object per theme read,
+// replaced when the CSS changes, so callers can memo against its identity.
+export type ThemeVocabulary = {
+  names: Set<string>
+  tokens: Set<string>
+  utilities: Set<string>
+}
+
 type Declaration = { name: string; value: string; theme: boolean }
 
 type ThemeRead = {
@@ -35,6 +44,7 @@ type ThemeRead = {
   colors?: Map<string, Lab>
   scales?: Record<ScaleKind, Map<string, number>>
   spacing?: number | null
+  vocabulary?: ThemeVocabulary
 }
 
 const cache = new Map<
@@ -459,6 +469,18 @@ export function scaleFor(fromFile: string, kind: ScaleKind) {
   return scaleOf(themeAt(cssFile), kind)
 }
 
+// Null when the project has no theme to read.
+export function themeVocabularyFor(fromFile: string) {
+  const cssFile = themeFileFor(fromFile)
+  if (!cssFile) return null
+  const read = themeAt(cssFile)
+  return (read.vocabulary ??= {
+    names: read.themeNames,
+    tokens: read.tokens,
+    utilities: read.utilities,
+  })
+}
+
 // What a project's CSS declares beyond Tailwind's own.
 export function knownClassesFor(fromFile: string) {
   const cssFile = themeFileFor(fromFile)
```

**File**: `packages/lint/src/rules/contracts.ts` (modified, +6/-5)
```diff
@@ -3,13 +3,14 @@
 
 import { CATEGORIES, categoryOf } from "../grammar/categories"
 import { isMarkerClass, normalizeClass } from "../grammar/classes"
-import { classifierFor, resolveCnConfig } from "../grammar/classifier"
+import { resolveCnConfig } from "../grammar/classifier"
 import { didYouMean } from "../grammar/similar"
+import { projectClassifierFor } from "../project/namespaces"
 import { knownClassesFor } from "../project/theme"
 import { warnOnce } from "../project/warn"
 import { checkMessage } from "./messages"
 
-type Classifier = ReturnType<typeof classifierFor>
+type Classifier = ReturnType<typeof projectClassifierFor>
 
 export type MessageKey = (typeof CATEGORIES)[number] | "layout" | "default"
 
@@ -143,7 +144,7 @@ export function createMatcher(
     fromFile,
     `matcher:${JSON.stringify(entries ?? [])}`,
     () => {
-      const classifier = classifierFor(fromFile)
+      const classifier = projectClassifierFor(fromFile)
       const set = compileEntries(
         entries,
         groupIdsFor(resolveCnConfig(fromFile)),
@@ -262,7 +263,7 @@ export function checkAllowEntries(
   rule: string
 ) {
   if (!entries?.length) return
-  const classifier = classifierFor(fromFile)
+  const classifier = projectClassifierFor(fromFile)
   const groupIds = groupIdsFor(resolveCnConfig(fromFile))
   for (const entry of entries) {
     if (
@@ -314,7 +315,7 @@ function buildContracts(
   inputs: ContractInput[] | undefined,
   options: PolicyInput & { fromFile?: string }
 ) {
-  const classifier = classifierFor(options.fromFile)
+  const classifier = projectClassifierFor(options.fromFile)
   const groupIds = groupIdsFor(resolveCnConfig(options.fromFile))
   // Entries first, so a typo is named before a list that does nothing.
   if (!options.uncheckedEntries) {
```

**File**: `packages/lint/src/rules/no-arbitrary-values.ts` (modified, +2/-2)
```diff
@@ -9,8 +9,8 @@ import {
   splitVariants,
   withBase,
 } from "../grammar/classes"
-import { classifierFor } from "../grammar/classifier"
 import { lengthInPx } from "../grammar/lengths"
+import { projectClassifierFor } from "../project/namespaces"
 import {
   colorTokensFor,
   colorValuesFor,
@@ -161,7 +161,7 @@ export const noArbitraryValues = {
     } catch (error) {
       return configErrorVisitors(context, error)
     }
-    const { groupOf } = classifierFor(filename)
+    const { groupOf } = projectClassifierFor(filename)
 
     let file: string | undefined
     let unitPx: number | null | undefined
```

**File**: `packages/lint/src/rules/no-raw-colors.ts` (modified, +25/-3)
```diff
@@ -11,9 +11,14 @@ import {
   splitClasses,
   withBase,
 } from "../grammar/classes"
-import { classifierFor } from "../grammar/classifier"
 import { isNamedColor, parseColor } from "../grammar/colors"
-import { colorTokensFor, colorValuesFor, themeFileFor } from "../project/theme"
+import { projectClassifierFor } from "../project/namespaces"
+import {
+  colorTokensFor,
+  colorValuesFor,
+  knownClassesFor,
+  themeFileFor,
+} from "../project/theme"
 import { classSiteVisitors } from "../sites/collect"
 import { unknownClasses } from "../tailwind/client"
 import { compileVocabularyPolicy, configErrorVisitors } from "./contracts"
@@ -156,7 +161,7 @@ export const noRawColors = {
     } catch (error) {
       return configErrorVisitors(context, error)
     }
-    const { groupOf } = classifierFor(filename)
+    const { groupOf } = projectClassifierFor(filename)
     let theme: ReturnType<typeof readTheme> | undefined
     function readTheme() {
       const declared = colorTokensFor(filename)
@@ -216,6 +221,22 @@ export const noRawColors = {
       }
     }
 
+    // A class the project's own CSS declares with @utility is its
+    // vocabulary, whatever the name looks like: "not a declared theme
+    // color" is false about a name the theme declares.
+    let utilities: ReturnType<typeof knownClassesFor> | undefined
+    let utilityPrefixes: string[] | undefined
+    const isDeclaredUtility = (token: string) => {
+      utilities ??= knownClassesFor(filename)
+      if (!utilities.utilities.size) return false
+      utilityPrefixes ??= [...utilities.utilities]
+        .filter((name) => name.endsWith("*"))
+        .map((name) => name.slice(0, -1))
+      const base = normalizeClass(token).replace(OPACITY_MODIFIER, "")
+      if (utilities.utilities.has(base)) return true
+      return utilityPrefixes.some((prefix) => base.startsWith(prefix))
+    }
+
     // cn's color groups take any value, so text-smal classifies as a
     // color here. When Tailwind's nearest real class is not a color, the
     // typo belongs to no-unknown-classes and this rule stays quiet, so
@@ -259,6 +280,7 @@ export const noRawColors = {
       if (!declared) return null
       if (categoryOf(groupOf(token)) !== "color") return null
       if (!colorValue || NAMED.has(colorValue)) return null
+      if (isDeclaredUtility(token)) return null
       return undeclaredVerdict(token)
     }
 
```

**File**: `packages/lint/src/rules/no-unknown-classes.ts` (modified, +2/-2)
```diff
@@ -5,8 +5,8 @@
 
 import { categoryOf } from "../grammar/categories"
 import { isMarkerClass, normalizeClass, splitClasses } from "../grammar/classes"
-import { classifierFor } from "../grammar/classifier"
 import { didYouMean } from "../grammar/similar"
+import { projectClassifierFor } from "../project/namespaces"
 import { colorTokensFor, knownClassesFor, themeFileFor } from "../project/theme"
 import { classSiteVisitors } from "../sites/collect"
 import { unknownClasses } from "../tailwind/client"
@@ -64,7 +64,7 @@ export const noUnknownClasses = {
     } catch (error) {
       return configErrorVisitors(context, error)
     }
-    const { groupOf } = classifierFor(filename)
+    const { groupOf } = projectClassifierFor(filename)
     const known = knownClassesFor(filename)
     const themeFile = themeFileFor(filename)
     const file = themeFile ? displayPath(themeFile, context) : "your theme CSS"
```

#### Recent Merged Pull Requests:
- **PR #68** (2026-10-05): fix: resolve tailwind beside the stylesheet that imports it (@shadcn)
- **PR #52** (2026-10-05): feat: classify a project's theme scales from its CSS (@shadcn)
- **PR #51** (2026-09-22): chore(release): version packages (@github-actions[bot])
- **PR #50** (2026-09-22): feat: add vue and svelte support (@shadcn)
- **PR #48** (2026-09-21): chore(release): version packages (@github-actions[bot])
- **PR #47** (2026-09-21): chore: update cn to 0.3.2 (@shadcn)
- **PR #46** (2026-09-21): chore(release): version packages (@github-actions[bot])
- **PR #45** (2026-09-21): fix: read a project's animations from its CSS (@shadcn)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
