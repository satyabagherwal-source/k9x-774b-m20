# Forensic Learning Record (Deep Inspection): shadcn-ui/lint

> **Canonical Artifact**: `07_PROJECT_LEARNING/shadcn-ui-lint-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/shadcn-ui/lint](https://github.com/shadcn-ui/lint))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:17:42.950Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `shadcn-ui/lint`
- **Description**: An agent-first linter for Tailwind design systems. Write design system rules that agents can verify.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 2962 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

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

### Core Architecture Module: `packages/evals/fixture-ds/ds/card.tsx`
```
import * as React from "react"
import { cn } from "@/lib/utils"

function Card({
  className,
  size = "default",
  ...props
}: React.ComponentProps<"div"> & { size?: "default" | "sm" }) {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(
        "group/card flex flex-col gap-(--card-spacing) overflow-hidden rounded-xl bg-card py-(--card-spacing) text-sm text-card-foreground ring-1 ring-foreground/10 [--card-spacing:--spacing(4)] has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(3)] data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-xl px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "font-heading text-base leading-snug font-medium group-data-[size=sm]/card:text-sm",
        className
      )}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-(--card-spacing)", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center rounded-b-xl border-t bg-muted/50 p-(--card-spacing)",
        className
      )}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
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

- **Issue #45** (2026-09-21): **fix: read a project's animations from its CSS**
  *Symptoms*: Classifies an `animate-*` class as motion when the project's theme declares `--animate-<name>` or its CSS declares the class with `@utility` or a selector, so the result holds whether or not cn groups custom animation names.

- **Issue #43** (2026-09-20): **chore(release): version packages**
  *Symptoms*: This PR was opened by the [Changesets release](https://github.com/changesets/action) GitHub action. When you're ready to do a release, you can merge this and the packages will be published to npm automatically. If you're not ready to do a release yet, that's fine, whenever you add more changesets to main, this PR will be updated.   # Releases ## @shadcn/lint@0.1.3  ### Patch Changes  - [#42](https://github.com/shadcn-ui/lint/pull/42) [`505a37d`](https://github.com/shadcn-ui/lint/commit/505a37d3ff1a0e156d3171dc173519ac35f3db9f) Thanks [@shadcn](https://github.com/shadcn)! - Read a destructured binding's own slot of its initializer, and resolve a ui package's alias to its own name.

- **Issue #42** (2026-09-20): **fix: read a destructured binding's own slot, and resolve a package's own name**
  *Symptoms*: A destructured binding now reads only its own slot of the initializer, through the branches of a conditional, and a ui package whose alias names the package itself resolves from inside that package. Fixes #38, fixes #39.

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

### Incident Patch 1: `b291b5b2` (2026-09-21)
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

### Incident Patch 2: `505a37d3` (2026-09-20)
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
+  
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
+     
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

---

### Incident Patch 3: `28f102c5` (2026-09-20)
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

---

### Incident Patch 4: `be5f6c42` (2026-09-17)
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

---

### Incident Patch 5: `b2518bec` (2026-09-17)
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
+    const [first, ...rest]: Record<string, string[]>[] = t
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

### Incident Patch 6: `3df54f21` (2026-09-17)
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

### Incident Patch 7: `0bc3bf25` (2026-09-17)
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

---

### Incident Patch 8: `d782dbb2` (2026-09-17)
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

---

### Incident Patch 9: `f0df37d7` (2026-09-17)
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

### Incident Patch 10: `3ac1d523` (2026-09-17)
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

#### Recent Merged Pull Requests:
- **PR #51** (2026-09-22): chore(release): version packages (@github-actions[bot])
- **PR #50** (2026-09-22): feat: add vue and svelte support (@shadcn)
- **PR #48** (2026-09-21): chore(release): version packages (@github-actions[bot])
- **PR #47** (2026-09-21): chore: update cn to 0.3.2 (@shadcn)
- **PR #46** (2026-09-21): chore(release): version packages (@github-actions[bot])
- **PR #45** (2026-09-21): fix: read a project's animations from its CSS (@shadcn)
- **PR #43** (2026-09-20): chore(release): version packages (@github-actions[bot])
- **PR #42** (2026-09-20): fix: read a destructured binding's own slot, and resolve a package's own name (@shadcn)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
