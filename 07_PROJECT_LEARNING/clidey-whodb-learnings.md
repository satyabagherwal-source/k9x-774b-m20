# Forensic Learning Record (Deep Inspection): clidey/whodb

> **Canonical Artifact**: `07_PROJECT_LEARNING/clidey-whodb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/clidey/whodb](https://github.com/clidey/whodb))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:48:14.760Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `clidey/whodb`
- **Description**: Where data access meets operational intelligence
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 5033 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.agents/hooks/changed-files.py`
```
#!/usr/bin/env python3
"""Print file paths from Claude-style file hooks or Codex apply_patch hooks."""

import json
import re
import sys


def add_path(paths: list[str], value: object) -> None:
    if not isinstance(value, str):
        return

    path = value.strip()
    if not path or "\n" in path or "\0" in path:
        return

    paths.append(path)


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return 0

    tool_input = payload.get("tool_input")
    if not isinstance(tool_input, dict):
        return 0

    paths: list[str] = []

    add_path(paths, tool_input.get("file_path"))
    add_path(paths, tool_input.get("path"))

    files = tool_input.get("files")
    if isinstance(files, list):
        for file_path in files:
            add_path(paths, file_path)

    command = tool_input.get("command")
    if isinstance(command, str):
        for pattern in (
            r"^\*\*\* (?:Add|Update|Delete) File: (.+)$",
            r"^\*\*\* Move to: (.+)$",
        ):
            for match in re.finditer(pattern, command, re.MULTILINE):
                add_path(paths, match.group(1))

    seen: set[str] = set()
    for path in paths:
        if path not in seen:
            seen.add(path)
            print(path)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

```

### Core Architecture Module: `.agents/skills/impeccable/scripts/concept-seed.mjs`
```
#!/usr/bin/env node
/**
 * External concept seed: the dice half of new-work's complete-direction and
 * established-world surface procedures.
 *
 * Before this script runs, the model retrieves cultural material and derives
 * a grounded shortlist of complete candidate directions from it (see
 * reference/new-work.md). Left alone, it then always builds its #1 —
 * and a single model's resonance ranking is deterministic, so every run
 * in a category ships the same one or two concepts. Measured: 30/35
 * identical concepts across 16 prompt framings; the model cannot roll
 * its own dice.
 *
 * This script rolls them from outside, the same trick that made the
 * palette seed work:
 *   - ASSIGNED INDEX: which entry of the model's own resonance-ordered
 *     shortlist gets built. The assignment is the dice: it never chooses an
 *     ungrounded ingredient, it only refuses the argmax rut. Attended runs
 *     present the assigned direction and offer re-roll instead of a ranked
 *     lineup, because a lineup hands selection back to a taste function
 *     (model or user) and taste functions pick the safest card.
 *   - CHALLENGERS (6): outside forms from concept-ingredients.json, two from
 *     each challenger tier (graphic system, instrument language, atmosphere
 *     world), fused with the product first (challenger supplies form and
 *     system grammar, product supplies every fact, clarity wins conflicts),
 *     then weighed against the derived candidates on audience identification
 *     and product clarity. They win only when they beat the grounded list;
 *     measured behavior is that they lose to strong cultural material and
 *     win over thin categories, which is the intended shape.
 *   - RE-ROLL (--reroll <n>): round n of the same base key. The script
 *     recomputes what rounds 0..n-1 drew, excludes all of it, and rolls a
 *     fresh assigned index, challengers, and compositions. One base key therefore
 *     reproduces the entire chain of rounds.
 *   - RATINGS: the reviewer's approval ratings weight the challenger draw
 *     (3-star doubles the odds, 1-star sits out); the approved pool itself
 *     is unchanged.
 *
 * Usage:
 *   node scripts/concept-seed.mjs --scope direction --mode persuade
 *   node scripts/concept-seed.mjs --scope surface --mode operate --from <key>
 *   node scripts/concept-seed.mjs --scope surface --mode operate --grain flow
 *   node scripts/concept-seed.mjs --scope direction --candidate-count 6
 *   node scripts/concept-seed.mjs --scope direction --mode persuade --from <key> --reroll 1
 *   node scripts/concept-seed.mjs --chosen <challenger-id> --from <key> --scope direction
 *
 * --grain names how much of the product is in play: product, flow, view, or
 * region. A docs site, an onboarding flow, a landing page and a data table are
 * four different amounts of product and want different compositions. Grain is a
 * preference: it deals matching compositions first and tops up from the rest of
 * the register, and the rendered seed says how many actually matched so a
 * borrowed structure is never mistaken for a supplied one.
 *
 * --platform names the delivery target (web, ios, android). Unlike grain this is
 * a hard filter: a composition that needs hover or a pointer does not degrade on
 * a phone, it stops working. --mode also gates which worlds are eligible, for
 * worlds whose reviewer marked them as carrying only some modes.
 *
 * --mode names the requested surface's mode (persuade, operate, read,
 * experience) so the appended compositions match its register of work; omitted,
 * they roll from the full approved pool.
 *
 * Challenger data resolves in order: a local catalog directory (the private
 * service repo, evals, and tests set IMPECCABLE_CATALOG_DIR), then the roll
 * API at impeccable.style, then a degraded assignment-only seed when both are
 * unavailable. --chosen sends the anonymous choice ping for API-dealt rolls;
 * DO_NOT_TRACK or IMPECCABLE_NO_TELEMETRY disables it.
 *
 * Env vars:
 *   IMPECCABLE_CONCEPT_SEED — same as --from; for reproducible eval runs.
 *   IMPECCABLE_CATALOG_DIR  — directory holding the four catalog JSON files.
 *   IMPECCABLE_API_URL      — roll API base (default https://impeccable.style/api).
 *   IMPECCABLE_NO_TELEMETRY — disables the choice ping (DO_NOT_TRACK also honored).
 */

import crypto from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  approvedPoolRevision,
  readConceptCatalog,
  validateConceptCatalog,
  WELL_TIERS,
} from './lib/concept-catalog.mjs';
import { readCompositionCatalog } from './lib/composition-catalog.mjs';
import {
  COMPOSITION_GRAINS,
  COMPOSITION_PLATFORMS,
  runSyncSelection,
  selectApprovedChallengers as selectApprovedChallengersCore,
  selectApprovedCompositions as selectApprovedCompositionsCore,
} from './lib/roll-selection.mjs';

const here = dirname(fileURLToPath(import.meta.url));

// Data resolution order: a local catalog (the private service repo, evals, and
// tests point IMPECCABLE_CATALOG_DIR at one), then the roll API, then a
// degraded assignment-only seed. The full catalog does not ship with the skill.
const CATALOG_DIR = process.env.IMPECCABLE_CATALOG_DIR || here;
const API_BASE = (process.env.IMPECCABLE_API_URL || 'https://impeccable.style/api').replace(/\/$/, '');
const API_TIMEOUT_MS = Number(process.env.IMPECCABLE_API_TIMEOUT || 4000);
// All API calls in one seed run share a single deadline so an unreachable
// network degrades after one timeout total, never one timeout per call.
let apiDeadline = null;
function apiBudgetMs() {
  if (apiDeadline === null) apiDeadline = Date.now() + API_TIMEOUT_MS;
  return Math.max(0, apiDeadline - Date.now());
}

const localStates = new Map();
function loadLocal(catalogDir = CATALOG_DIR) {
  if (localStates.has(catalogDir)) return localStates.get(catalogDir);
  let localState;
  try {
    const catalogState = readConceptCatalog(
      join(catalogDir, 'concept-ingredients.json'),
      join(catalogDir, 'concept-reviews.json')
    );
    const validation = validateConceptCatalog(catalogState.catalog, catalogState.reviewData);
    if (validation.errors.length > 0) {
      throw new Error(`invalid catalog: ${validation.errors.join('; ')}`);
    }
    const compositionState = readCompositionCatalog(
      join(catalogDir, 'composition-ingredients.json'),
      join(catalogDir, 'composition-reviews.json')
    );
    localState = {
      concepts: catalogState.concepts,
      compositions: compositionState.compositions,
    };
  } catch {
    localState = null;
  }
  localStates.set(catalogDir, localState);
  return localState;
}

function requireLocalConcepts() {
  const local = loadLocal();
  if (!local) {
    throw new Error('concept-seed: no local catalog (set IMPECCABLE_CATALOG_DIR or pass sourceConcepts)');
  }
  return local;
}

async function fetchRoll({ scope, key, mode, grain, platform, reroll }) {
  const params = new URLSearchParams({ scope, key, reroll: String(reroll) });
  if (mode) params.set('mode', mode);
  if (grain) params.set('grain', grain);
  if (platform) params.set('platform', platform);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), apiBudgetMs());
  try {
    // Race the budget explicitly: abort signals do not reliably cancel the
    // TCP connect phase, so a blackholed route would otherwise stall ~10s.
    const response = await Promise.race([
      fetch(`${API_BASE}/roll?${params}`, { signal: controller.signal }),
      new Promise(resolveTimeout => setTimeout(() => resolveTimeout(null), apiBudgetMs())),
    ]);
    if (!response) return null;
    if (!response.ok) return null;
    const roll = await response.json();
    if (!Array.isArray(roll.challengers) || roll.challengers.length === 0) return null;
    return roll;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function telemetryDisabled() {
  ret
```

### Core Architecture Module: `.agents/skills/impeccable/scripts/context-signals.mjs`
```
#!/usr/bin/env node
/**
 * Context-signals gatherer for the bare Impeccable invocation
 * (no-argument) path. Collects cheap, deterministic signals about the current
 * project and emits them as JSON.
 *
 * It does NOT score or rank. The agent reasons over the raw signals using its
 * knowledge of the command catalog (see SKILL.md routing rule 1). Deliberately
 * light: no LLM calls, no detector run (`npx impeccable detect` is heavier and
 * opt-in), no file writes. Every probe is best-effort and never throws; the
 * output is always valid JSON.
 *
 * Signals:
 *   - setup:     PRODUCT.md / DESIGN.md presence and whether code exists
 *   - critique:  the latest cached critique score (.impeccable/critique)
 *   - git:       branch + files changed vs the default branch (a scope hint)
 *   - devServer: whether a local dev server answers on a common port (gates live)
 */
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { loadContext, extractPlatform } from './context.mjs';
import { getCritiqueDir } from './lib/impeccable-paths.mjs';

/** Is there code here at all, or just context files / an empty repo? */
function hasCode(cwd) {
  if (fs.existsSync(path.join(cwd, 'package.json'))) return true;
  for (const d of ['src', 'app', 'pages', 'site', 'public', 'components', 'lib']) {
    if (fs.existsSync(path.join(cwd, d))) return true;
  }
  return false;
}

/**
 * The most recent critique snapshot across all targets. Filenames are
 * timestamp-prefixed (`<iso>__<slug>.md`), so a lexical sort is chronological.
 * Parses the small frontmatter for score + P0/P1 counts.
 */
function latestCritique(cwd) {
  try {
    const dir = getCritiqueDir(cwd);
    if (!fs.existsSync(dir)) return null;
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
    if (!files.length) return null;
    const newest = files[files.length - 1];
    const text = fs.readFileSync(path.join(dir, newest), 'utf-8');
    const front = text.split('---')[1] || '';
    const get = (k) => {
      const m = front.match(new RegExp(`^${k}:\\s*(.+)$`, 'm'));
      return m ? m[1].trim() : null;
    };
    const num = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    return {
      slug: get('slug'),
      score: num(get('score')),
      p0: num(get('p0')),
      p1: num(get('p1')),
      timestamp: get('timestamp'),
      file: path.relative(cwd, path.join(dir, newest)),
    };
  } catch {
    return null;
  }
}

/** Branch + a scope hint: files changed vs the default branch, else working tree. */
function gitSignals(cwd) {
  const run = (args, { trim = true } = {}) => {
    try {
      const out = execFileSync('git', args, {
        cwd,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      return trim ? out.trim() : out;
    } catch {
      return null;
    }
  };
  if (run(['rev-parse', '--is-inside-work-tree']) !== 'true') {
    return { isRepo: false, branch: null, base: null, changedFiles: [], changedCount: 0 };
  }
  const branch = run(['rev-parse', '--abbrev-ref', 'HEAD']);
  // The merge target is detected, not assumed. A hardcoded main/master list
  // diffed develop-based repos against the wrong base, so git.changedFiles
  // carried the whole develop/main divergence into scan.targets (issue
  // #302). Signals, most specific first: the branch's configured upstream
  // (@{u}; a branch pushed with -u tracks itself and is skipped by the
  // self-check), then the remote's default-branch symref (origin/HEAD),
  // then the conventional integration names. The conventional fallbacks
  // are withheld when the current branch IS one of them: sitting on main
  // in a repo that also has develop must not diff the two integration
  // branches against each other.
  // Candidates carry a display name (what git.base reports) and the revs to
  // try, in order. A remote ref like `upstream/release` (fork workflows) or
  // an origin/HEAD target with no local checkout is a perfectly good diff
  // base, so revs are not limited to local branch names.
  const remotes = (run(['remote']) || '').split('\n').filter(Boolean);
  // Read @{u} as a FULL symbolic ref: refs/heads/... is a local upstream
  // (branch.<x>.remote = "."), refs/remotes/<r>/... is remote-tracking. No
  // string guessing on the abbreviated form survives contact with reality:
  // a local upstream named release/2.0 is one branch name, and a local
  // feature/foo beside a remote actually named "feature" is only told apart
  // from feature's remote-tracking refs by the full ref namespace.
  const resolveUpstream = () => {
    const full = run(['rev-parse', '--symbolic-full-name', '@{u}']);
    if (!full) return null;
    if (full.startsWith('refs/heads/')) {
      const name = full.slice('refs/heads/'.length);
      return { name, rev: name };
    }
    if (full.startsWith('refs/remotes/')) {
      const rest = full.slice('refs/remotes/'.length);
      const i = rest.indexOf('/');
      if (i > 0) return { name: rest.slice(i + 1), rev: rest };
    }
    return null;
  };
  const conventional = ['develop', 'main', 'master'];
  // On an integration branch itself the scope hint is the working tree. No
  // signal may override that: an origin/HEAD or upstream naming a DIFFERENT
  // integration branch (sitting on develop while the remote default is
  // main) would produce exactly the integration-vs-integration divergence
  // this detection exists to prevent. "Integration branch" means a
  // conventional name OR any remote's default branch (origin first, but a
  // fork-parent layout may only have an `upstream` remote), so a
  // non-standard default like trunk is guarded the same way. A detached
  // checkout (branch reads as the literal `HEAD`) has no branch identity to
  // diff for and keeps the working-tree scope too.
  const remoteHeads = [];
  for (const r of [...new Set(['origin', ...remotes])]) {
    // The symref's own prefix is the remote just queried, so it is stripped
    // directly; the remote need not be in `git remote` output (tests and
    // partial clones fabricate refs/remotes/origin/* without a remote).
    const ref = run(['symbolic-ref', '--short', `refs/remotes/${r}/HEAD`]);
    if (ref && ref.startsWith(`${r}/`)) remoteHeads.push({ name: ref.slice(r.length + 1), rev: ref });
  }
  const onIntegrationBranch = branch === 'HEAD'
    || conventional.includes(branch)
    || remoteHeads.some((head) => head.name === branch);
  let base = null;
  let baseRev = null;
  if (!onIntegrationBranch) {
    const upstream = resolveUpstream();
    // Every named candidate tries the local branch first, then that name on
    // every remote (origin first). Covering all remotes up front is what
    // makes the name-level dedup below safe: a develop or main that exists
    // only as upstream/<name> still resolves even though origin's candidate
    // claimed the name first.
    const remoteOrder = ['origin', ...remotes.filter((name) => name !== 'origin')];
    const revsFor = (name) => [name, ...remoteOrder.map((r) => `${r}/${name}`)];
    const candidates = [];
    const seen = new Set();
    const addCandidate = (name, revs) => {
      if (!name || name === branch || seen.has(name)) return;
      seen.add(name);
      candidates.push({ name, revs });
    };
    // The upstream tracks the actual merge target, so its own rev wins over
    // a possibly stale local branch of the same name.
    if (upstream) addCandidate(upstream.name, [upstream.rev]);
    // A develop branch marks a git-flow repo where features merge to develop
    // even when the platform default (origin/HEAD) was never flipped off
    // main; an existing develop therefore outranks the remote default. This
    // is #302's own repro shape, and repos without develop are unaffected.
    // A remote's advertised default prefers its own 
```

### Core Architecture Module: `.agents/skills/impeccable/scripts/context.mjs`
```
/**
 * Context loader: prints PRODUCT.md, DESIGN.md when present, the matching
 * persisted surface brief when one can be resolved, and native-platform
 * guidance selected from PRODUCT.md. It prints a
 * `NO_PRODUCT_MD:` message when no
 * PRODUCT.md is found anywhere. The skill keys off that message to branch:
 * from-scratch build requests (plus init / teach / shape) and clear
 * build/shape intent divert into the init flow, while scoped commands proceed
 * using the existing code as context.
 *
 * Path resolution (first match wins):
 *   1. Active project root, if PRODUCT.md or DESIGN.md is there. An explicit
 *      --target selects the active project: the workspace child in a
 *      monorepo, or the nearest directory around the target carrying
 *      canonical context files in an ordinary repo (issue #376).
 *   2. Active project .agents/context/ then docs/
 *   3. Repo root context, using the same order, as a per-file fallback
 *      whenever the active project is nested below it (a repo counts as a
 *      monorepo when a package manager declares workspaces, or
 *      `.impeccable/config.json` declares `projectRoots`)
 *   4. $IMPECCABLE_CONTEXT_DIR (absolute or cwd-relative) — power-user
 *      escape hatch, only consulted when defaults are empty
 *   5. Active project root as a "nothing found" default
 *
 * `resolveContextDir()` and `loadContext()` are also exported for the
 * server-side scripts (live.mjs, live-server.mjs) that need the structured
 * shape rather than the markdown block.
 */
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTargetOptions } from './lib/target-args.mjs';
import { IMPECCABLE_COMMAND, IMPECCABLE_PROVIDER_ID } from './lib/provider.mjs';
import { resolveSurfaceBrief } from './lib/surface-briefs.mjs';
import { collectBootFindings, designSidecarCandidatesFor } from './lib/staleness.mjs';
import {
  buildStalenessDirective,
  filterFreshFindings,
  stalenessCheckDisabled,
} from './lib/staleness-notice.mjs';

const PRODUCT_NAMES = ['PRODUCT.md', 'Product.md', 'product.md'];
const DESIGN_NAMES = ['DESIGN.md', 'Design.md', 'design.md'];
const SKILL_REFERENCE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'reference');
const FALLBACK_DIRS = ['.agents/context', 'docs'];
const MONOREPO_MARKER_FILES = ['pnpm-workspace.yaml', 'turbo.json', 'nx.json', 'lerna.json'];
const MONOREPO_FALLBACK_PROJECT_DIRS = ['apps', 'packages'];
const WORKSPACE_DISCOVERY_IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.nuxt',
  '.svelte-kit',
  '.turbo',
  '.cache',
  'coverage',
  'vendor',
  'vendors',
]);
const VISUAL_SOURCE_DIRS = ['src', 'app', 'pages', 'components', 'site', 'public', 'styles'];
const STYLE_EXTENSIONS = new Set(['.css', '.scss', '.sass', '.less', '.styl']);
const UI_EXTENSIONS = new Set(['.html', '.htm', '.jsx', '.tsx', '.vue', '.svelte', '.astro']);
const VISUAL_SCAN_FILE_LIMIT = 250;
const VISUAL_SCAN_DEPTH_LIMIT = 4;

// ─── Update check ──────────────────────────────────────────────────────────
// Piggyback a lightweight skill-version check on the once-per-session boot.
// When a newer skill ships, append an UPDATE_AVAILABLE directive so the agent
// can offer `npx impeccable update`. Everything here is best-effort and
// silent on failure: a network problem, sandbox, or missing cache must never
// block context output or print an error.

const UPDATE_HOST = (process.env.IMPECCABLE_UPDATE_HOST || 'https://impeccable.style').replace(/\/$/, '');
const UPDATE_CACHE_PATH =
  process.env.IMPECCABLE_UPDATE_CACHE || path.join(os.homedir(), '.impeccable', 'update-check.json');
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // throttle the network poll to once a day
const RENOTIFY_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // don't re-surface the same version for a week
const FETCH_TIMEOUT_MS = 1200;

export function resolveContextDir(cwd = process.cwd(), options = {}) {
  return resolveContext(cwd, options).contextDir;
}

export function loadContext(cwd = process.cwd(), options = {}) {
  const resolved = resolveContext(cwd, options);
  const absCwd = path.resolve(cwd);
  const productPath = resolved.productPath;
  const designPath = resolved.designPath;
  const product = productPath ? safeRead(productPath) : null;
  const design = designPath ? safeRead(designPath) : null;
  const platform = extractPlatform(product);
  const surfaceResolution = resolveSurfaceBrief(
    resolved.projectRoot,
    hasTargetOption(options) ? options.targetPath : null,
  );
  const surfaceBrief = surfaceResolution.brief;
  return {
    hasProduct: !!product,
    product,
    productPath: productPath ? path.relative(absCwd, productPath) : null,
    hasDesign: !!design,
    design,
    designPath: designPath ? path.relative(absCwd, designPath) : null,
    contextDir: resolved.contextDir,
    productContextDir: productPath ? path.dirname(productPath) : null,
    designContextDir: designPath ? path.dirname(designPath) : null,
    hasSurfaceBrief: !!surfaceBrief,
    surfaceBrief: surfaceBrief?.text ?? null,
    surfaceBriefPath: surfaceBrief?.path ? path.relative(absCwd, surfaceBrief.path) : null,
    surfaceBriefReason: surfaceResolution.reason,
    surfaceBriefCandidates: surfaceResolution.candidates.map((brief) => ({
      slug: brief.slug,
      path: path.relative(absCwd, brief.path),
      primaryTarget: brief.primaryTarget,
      relatedTargets: brief.relatedTargets,
    })),
    hasVisualImplementation: hasVisualImplementation(resolved.projectRoot),
    platform,
    projectRoot: resolved.projectRoot,
    repoRoot: resolved.repoRoot,
    isMonorepo: resolved.isMonorepo,
  };
}

function resolveContext(cwd = process.cwd(), options = {}) {
  const absCwd = path.resolve(cwd);
  const project = resolveProject(absCwd, options);
  const projectContextDir = resolveLocalContextDir(project.projectRoot);
  // Per-file inheritance from the repo root whenever the active project is
  // nested below it: monorepo workspace children and explicit-target nested
  // products in ordinary repos behave the same way.
  const rootContextDir = project.repoRoot !== project.projectRoot
    ? resolveLocalContextDir(project.repoRoot)
    : null;

  let productPath =
    (projectContextDir ? firstExisting(projectContextDir, PRODUCT_NAMES) : null)
    || (rootContextDir ? firstExisting(rootContextDir, PRODUCT_NAMES) : null);
  let designPath =
    (projectContextDir ? firstExisting(projectContextDir, DESIGN_NAMES) : null)
    || (rootContextDir ? firstExisting(rootContextDir, DESIGN_NAMES) : null);

  let envContextDir = null;
  if (!productPath && !designPath) {
    envContextDir = resolveEnvContextDir(absCwd);
    if (envContextDir) {
      productPath = firstExisting(envContextDir, PRODUCT_NAMES);
      designPath = firstExisting(envContextDir, DESIGN_NAMES);
    }
  }

  return {
    contextDir: productPath
      ? path.dirname(productPath)
      : designPath
        ? path.dirname(designPath)
        : envContextDir || project.projectRoot,
    productPath,
    designPath,
    projectRoot: project.projectRoot,
    repoRoot: project.repoRoot,
    isMonorepo: project.isMonorepo,
    targetDir: project.targetDir,
  };
}

export function resolveProjectRoot(cwd = process.cwd(), options = {}) {
  return resolveProject(cwd, options).projectRoot;
}

export function resolveTargetSelection(cwd = process.cwd(), options = {}) {
  if (hasTargetOption(options)) return null;
  const project = resolveProject(cwd);
  if (
    !project.isMonorepo
    || !project.projectRoot
    || !project.repoRoot
    || path.resolve(project.projectRoot) !== path.resolve(project.repoRoot)
  ) {
    return null;
  }
  const targetCandidates = discoverTargetCandidates(project.repoRoot);
  // No discoverable child apps (e.g. `workspaces: ["."]`, a root-only workspace,
  // or a marker file with no apps/pa
```

### Core Architecture Module: `.agents/skills/impeccable/scripts/critique-storage.mjs`
```
#!/usr/bin/env node
/**
 * Critique persistence helper.
 *
 * Each critique run writes a per-target snapshot to
 *   .impeccable/critique/<timestamp>__<slug>.md
 * with a small YAML frontmatter carrying the score + P0/P1 counts.
 *
 * The polish workflow reads the latest matching snapshot at start as its
 * fix backlog. No other skill auto-reads critique output.
 *
 * The slug is derived mechanically from the *resolved* primary artifact
 * (file path or URL), never from the user's natural-language phrasing.
 * Slug stability across runs is what lets the trend display work.
 *
 * CLI entry points (called from skill instructions):
 *   node critique-storage.mjs slug <resolved-target>
 *   node critique-storage.mjs write <slug> <snapshot-body-file>
 *   node critique-storage.mjs latest <slug>
 *   node critique-storage.mjs trend <slug> [limit]
 *
 * Note: there is intentionally no `ignore` subcommand. ignore.md is a plain
 * markdown file; the model reads it directly with its file-read tool. This
 * helper only exists for operations the model can't trivially do inline
 * (normalizing paths, generating filenames, globbing + parsing frontmatter).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { getCritiqueDir } from './lib/impeccable-paths.mjs';
import { slugFromTarget } from './lib/target-slug.mjs';

export { slugFromTarget } from './lib/target-slug.mjs';

/**
 * Mechanically derive a slug from a resolved target. Returns null if the
 * input doesn't look like a stable identifier (empty, project root, etc).
 *
 * Accepts file paths and URLs. The model resolves "the homepage" to a
 * concrete artifact before calling this — we never slug a natural-language
 * phrase.
 */
/**
 * Filename-safe UTC ISO timestamp: hyphens for separators, trailing Z.
 * Plain colons aren't allowed on Windows filesystems.
 */
export function nowFilenameStamp(date = new Date()) {
  const iso = date.toISOString();           // 2026-05-12T18:30:00.123Z
  return iso.replace(/[:.]/g, '-').replace(/-\d+Z$/, 'Z');
}

/**
 * Write a snapshot for `slug`. `meta` carries the small structured frontmatter
 * keys read back by readTrend(). `body` is the human-readable critique
 * report (everything below the frontmatter).
 *
 * Returns the absolute path written.
 */
export function writeSnapshot({ slug, meta, body, cwd = process.cwd(), now = new Date() }) {
  if (!slug) throw new Error('writeSnapshot requires a slug');
  const dir = getCritiqueDir(cwd);
  fs.mkdirSync(dir, { recursive: true });
  const timestamp = nowFilenameStamp(now);
  const filePath = path.join(dir, `${timestamp}__${slug}.md`);
  // Spread `meta` first so internally computed `timestamp` and `slug`
  // always win. Otherwise a caller-supplied meta blob (parsed from the
  // IMPECCABLE_CRITIQUE_META env var) could clobber them, leaving the
  // filename in disagreement with its frontmatter and corrupting trends.
  const front = serializeFrontmatter({ ...meta, timestamp, slug });
  fs.writeFileSync(filePath, `${front}\n${body.trim()}\n`, 'utf-8');
  return filePath;
}

function serializeFrontmatter(obj) {
  const lines = ['---'];
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue;
    const str = typeof value === 'string' ? value : String(value);
    // Quote strings that contain : or # to keep parsing simple.
    const needsQuotes = typeof value === 'string' && /[:#]/.test(str);
    lines.push(`${key}: ${needsQuotes ? JSON.stringify(str) : str}`);
  }
  lines.push('---');
  return lines.join('\n');
}

function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const out = {};
  for (const line of match[1].split(/\r?\n/)) {
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim();
    let value = line.slice(colon + 1).trim();
    if (/^".*"$/.test(value)) {
      try { value = JSON.parse(value); } catch { /* leave as-is */ }
    } else if (/^-?\d+$/.test(value)) {
      value = Number(value);
    }
    out[key] = value;
  }
  return out;
}

/**
 * Return all snapshot files for `slug`, sorted oldest → newest.
 */
function listSnapshotsForSlug(slug, cwd) {
  const dir = getCritiqueDir(cwd);
  if (!fs.existsSync(dir)) return [];
  const suffix = `__${slug}.md`;
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith(suffix))
    .sort()
    .map((f) => path.join(dir, f));
}

/**
 * Return the most recent snapshot for `slug`, or null. Polish reads this
 * to find its fix backlog when the slug matches.
 */
export function readLatestSnapshot(slug, { cwd = process.cwd() } = {}) {
  const all = listSnapshotsForSlug(slug, cwd);
  if (!all.length) return null;
  const latest = all[all.length - 1];
  const body = fs.readFileSync(latest, 'utf-8');
  return { path: latest, body, meta: parseFrontmatter(body) };
}

/**
 * Return the last `limit` snapshots' frontmatter, oldest → newest.
 * Critique appends a one-line trend to its output using this.
 */
export function readTrend(slug, { limit = 5, cwd = process.cwd() } = {}) {
  const all = listSnapshotsForSlug(slug, cwd);
  const slice = all.slice(-limit);
  return slice.map((file) => parseFrontmatter(fs.readFileSync(file, 'utf-8')));
}

// ---- CLI ---------------------------------------------------------------

// Accept either a ready slug or a concrete target (path/URL) everywhere, so
// callers never have to run the slug step separately. Anything containing a
// path or URL marker is resolved through slugFromTarget.
function coerceSlug(value) {
  if (!value) return null;
  if (/^[a-z0-9-]+$/.test(value) && !value.includes('/')) return value;
  return slugFromTarget(value);
}

function main(argv) {
  const [cmd, ...args] = argv;
  switch (cmd) {
    case 'slug': {
      const slug = slugFromTarget(args[0]);
      if (!slug) { process.stderr.write('no stable slug for input\n'); process.exit(1); }
      process.stdout.write(`${slug}\n`);
      return;
    }
    case 'write': {
      const [slugArg, bodyFile] = args;
      const slug = coerceSlug(slugArg);
      if (!slug || !bodyFile) { process.stderr.write('usage: write <slug-or-target> <body-file>\n'); process.exit(1); }
      const raw = fs.readFileSync(bodyFile, 'utf-8');
      // The body file may be a full report. The caller passes the meta as
      // a JSON object on stdin if it wants structured frontmatter; otherwise
      // we write with minimal metadata.
      let meta = {};
      const metaArg = process.env.IMPECCABLE_CRITIQUE_META;
      if (metaArg) {
        try { meta = JSON.parse(metaArg); } catch { /* ignore */ }
      }
      const out = writeSnapshot({ slug, meta, body: raw });
      process.stdout.write(`${out}\n`);
      return;
    }
    case 'latest': {
      const latest = readLatestSnapshot(coerceSlug(args[0]));
      if (!latest) { process.exit(2); }
      process.stdout.write(latest.body);
      return;
    }
    case 'trend': {
      const rows = readTrend(coerceSlug(args[0]), { limit: args[1] ? Number(args[1]) : 5 });
      process.stdout.write(JSON.stringify(rows, null, 2) + '\n');
      return;
    }
    default:
      process.stderr.write('usage: critique-storage.mjs <slug|write|latest|trend> [args]\n');
      process.exit(1);
  }
}

function isMainModule() {
  if (!process.argv[1]) return false;
  try {
    return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(process.argv[1]);
  } catch {
    // pathToFileURL normalizes Windows paths; keep it as a fallback for any
    // environment where realpath is unavailable.
    return import.meta.url === pathToFileURL(process.argv[1]).href;
  }
}

// Why the realpath check: generated skills are often reached through symlinked
// harness directories (for example a demo repo's `.agents` -> source `.agents`).
// Node resolves import.meta.url to the real file, while process.argv[1] keeps
// the symli
```

### Core Architecture Module: `.agents/skills/impeccable/scripts/detect-csp.mjs`
```
/**
 * Scan a project tree for Content-Security-Policy signals and classify the
 * shape so the agent knows which patch template to propose.
 *
 * Used at first-time `live.mjs` setup. Mechanical (grep-based) — no network,
 * no dev server, no JS evaluation. The classification drives a user-facing
 * consent prompt; the agent does the actual patch writing.
 *
 * Shapes are named by patch mechanism, not framework origin:
 *   - "append-arrays":  CSP defined as structured directive arrays. Patch
 *                       appends a dev-only localhost entry. Covers:
 *                         - Monorepo helpers with additional*Src options
 *                           (e.g. createBaseNextConfig for Next)
 *                         - SvelteKit kit.csp.directives
 *                         - nuxt-security module's contentSecurityPolicy
 *   - "append-string":  CSP built as a literal value string. Patch splices
 *                       a dev-only token into script-src and connect-src.
 *                       Covers:
 *                         - Inline Next.js headers() with CSP string
 *                         - Nuxt routeRules / nitro.routeRules CSP headers
 *   - "middleware":     CSP set dynamically in middleware.{ts,js}.
 *                       Detected but not auto-patched in v1.
 *   - "meta-tag":       <meta http-equiv="Content-Security-Policy"> in
 *                       layout files. Detected but not auto-patched in v1.
 *   - null:             no CSP signals found; no patch needed.
 */

import fs from 'node:fs';
import path from 'node:path';

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  '.turbo',
  '.svelte-kit',
  '.nuxt',
  '.astro',
  'dist',
  'build',
  'out',
  '.vercel',
]);

const SCAN_EXTS = new Set(['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts', '.tsx', '.jsx']);
const LAYOUT_EXTS = new Set(['.tsx', '.jsx', '.astro', '.vue', '.svelte', '.html']);
const MAX_DEPTH = 6;
const MAX_READ_BYTES = 64 * 1024;

// append-arrays signals: CSP expressed as structured directive arrays
const MONOREPO_HELPER_SIGNALS = [
  /\bbuildCSPConfig\b/,
  /\bbuildSecurityHeaders\b/,
  /\badditionalScriptSrc\b/,
  /\badditionalConnectSrc\b/,
  /\bcreateBaseNextConfig\b/,
];
const SVELTEKIT_CSP_SIGNALS = [
  /\bkit\s*:/,
  /\bcsp\s*:/,
  /\bdirectives\s*:/,
];
const NUXT_SECURITY_SIGNALS = [
  /['"]nuxt-security['"]/,
  /\bcontentSecurityPolicy\b/,
];

// append-string signals: CSP written as a literal value string
const INLINE_HEADER_SIGNALS = [
  /["']Content-Security-Policy["']/i,
  /\bscript-src\b/,
  /\bconnect-src\b/,
];
const NUXT_ROUTE_RULES_SIGNALS = [
  /\brouteRules\b/,
  /Content-Security-Policy/i,
  /\bscript-src\b/,
];

const MIDDLEWARE_HINT = /headers\.set\(\s*["']Content-Security-Policy["']/i;
const META_TAG_HINT = /http-equiv\s*=\s*["']Content-Security-Policy["']/i;

/**
 * @param {string} cwd Project root.
 * @returns {{ shape: string|null, signals: string[] }}
 */
export function detectCsp(cwd = process.cwd()) {
  const hits = { appendArrays: [], appendString: [], middleware: [], metaTag: [] };

  walk(cwd, cwd, 0, (absPath, relPath, body) => {
    const ext = path.extname(absPath);
    const base = path.basename(absPath).toLowerCase();
    const isConfig = (name) =>
      new RegExp('(^|/)' + name + '\\.config\\.').test(relPath);

    // === append-arrays candidates ===

    // Monorepo CSP helper: packages/*/src/.../(config|security)/*
    if (SCAN_EXTS.has(ext) &&
        /packages\/[^/]+\/src\/.*(config|next-config|security)/.test(relPath) &&
        MONOREPO_HELPER_SIGNALS.some((re) => re.test(body))) {
      hits.appendArrays.push(relPath);
      return;
    }

    // SvelteKit kit.csp.directives
    if (SCAN_EXTS.has(ext) && isConfig('svelte') &&
        SVELTEKIT_CSP_SIGNALS.every((re) => re.test(body))) {
      hits.appendArrays.push(relPath);
      return;
    }

    // Nuxt nuxt-security module
    if (SCAN_EXTS.has(ext) && isConfig('nuxt') &&
        NUXT_SECURITY_SIGNALS.every((re) => re.test(body))) {
      hits.appendArrays.push(relPath);
      return;
    }

    // === append-string candidates ===

    // Inline headers in Next/Nuxt/SvelteKit/Astro/Vite config
    if (SCAN_EXTS.has(ext) &&
        /(^|\/)(next|nuxt|vite|astro|svelte)\.config\./.test(relPath) &&
        INLINE_HEADER_SIGNALS.every((re) => re.test(body))) {
      // Nuxt routeRules is a sub-shape of append-string; we already covered
      // nuxt-security above via return, so any remaining Nuxt CSP match here
      // is a route-rules / inline-headers case. Either way, same patch
      // mechanism.
      hits.appendString.push(relPath);
      return;
    }

    // === detect-only shapes ===

    if ((base === 'middleware.ts' || base === 'middleware.js' || base === 'middleware.mjs') &&
        MIDDLEWARE_HINT.test(body)) {
      hits.middleware.push(relPath);
    }

    if (LAYOUT_EXTS.has(ext) && META_TAG_HINT.test(body)) {
      hits.metaTag.push(relPath);
    }
  });

  // Priority: append-arrays > append-string > middleware > meta-tag.
  // Structured patches are safer than string splices; runtime and HTML
  // injection patches are less reliable and v1 doesn't auto-apply them.
  if (hits.appendArrays.length > 0) {
    return { shape: 'append-arrays', signals: hits.appendArrays };
  }
  if (hits.appendString.length > 0) {
    return { shape: 'append-string', signals: hits.appendString };
  }
  if (hits.middleware.length > 0) {
    return { shape: 'middleware', signals: hits.middleware };
  }
  if (hits.metaTag.length > 0) {
    return { shape: 'meta-tag', signals: hits.metaTag };
  }
  return { shape: null, signals: [] };
}

function walk(root, dir, depth, visit) {
  if (depth > MAX_DEPTH) return;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return; }

  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(root, abs, depth + 1, visit);
      continue;
    }
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name);
    if (!SCAN_EXTS.has(ext) && !LAYOUT_EXTS.has(ext)) continue;
    let body;
    try {
      const fd = fs.openSync(abs, 'r');
      try {
        const buf = Buffer.alloc(MAX_READ_BYTES);
        const n = fs.readSync(fd, buf, 0, MAX_READ_BYTES, 0);
        body = buf.slice(0, n).toString('utf-8');
      } finally { fs.closeSync(fd); }
    } catch { continue; }
    visit(abs, path.relative(root, abs), body);
  }
}

// CLI mode
const _running = process.argv[1];
if (_running?.endsWith('detect-csp.mjs') || _running?.endsWith('detect-csp.mjs/')) {
  const result = detectCsp(process.cwd());
  console.log(JSON.stringify(result, null, 2));
}

```

### Core Architecture Module: `.agents/skills/impeccable/scripts/detect.mjs`
```
#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const candidates = [
  path.join(__dirname, 'detector', 'detect-antipatterns.mjs'),
  path.join(__dirname, '..', '..', 'cli', 'engine', 'detect-antipatterns.mjs'),
];
const detectorPath = candidates.find(p => fs.existsSync(p));

if (!detectorPath) {
  process.stderr.write('Error: bundled detector not found.\n');
  process.exit(1);
}

const { detectCli } = await import(pathToFileURL(detectorPath));

await detectCli();

```

### Core Architecture Module: `.agents/skills/impeccable/scripts/detector/browser/injected/index.mjs`
```
const IS_BROWSER = typeof window !== 'undefined';

// ─── Section 7: Browser UI (IS_BROWSER only) ────────────────────────────────

if (IS_BROWSER) {
  // Detect extension mode via the script tag's data attribute or the document element fallback.
  // currentScript is reliable for synchronously-executing scripts (which our IIFE is).
  const _myScript = document.currentScript;
  const EXTENSION_MODE = (_myScript && _myScript.dataset.impeccableExtension === 'true')
    || document.documentElement.dataset.impeccableExtension === 'true';

  // Kinpaku gold — pinned to the site's brand token (see
  // site/styles/kinpaku-tokens.css --ks-kinpaku). Keep this in sync with
  // the picker's C.brand in skill/scripts/live-browser.js and the kit's
  // picker section in site/styles/kinpaku-kit.css.
  //
  // One color across both light and dark host pages. The outline is a
  // 2px gesture pointing at an element + a labeled tag — it's a marker,
  // not body text, so it doesn't need WCAG AA against the page. The
  // label text inside the gold tag is dark (LABEL_INK) which has ~16:1
  // against the leaf gold, so reading the rule name is solid in both
  // modes. Hover deepens the gold (preserves chroma — never drops it,
  // dropping chroma washes the gold into a sand/olive tone).
  const BRAND_COLOR = 'oklch(84% 0.19 80.46)';
  const BRAND_COLOR_HOVER = 'oklch(74% 0.18 80)';
  const LABEL_INK = 'oklch(4% 0.004 95)';
  const LABEL_BG = BRAND_COLOR;
  const OUTLINE_COLOR = BRAND_COLOR;

  // Inject hover styles via CSS (more reliable than JS event listeners)
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    @keyframes impeccable-reveal {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    .impeccable-overlay:not(.impeccable-banner) {
      pointer-events: none;
      outline: 2px solid ${OUTLINE_COLOR};
      border-radius: 4px;
      transition: outline-color 0.15s ease;
      animation: impeccable-reveal 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
      animation-play-state: paused;
      border-top-left-radius: 0;
    }
    .impeccable-overlay.impeccable-visible {
      animation-play-state: running;
    }
    .impeccable-overlay.impeccable-hover {
      outline-color: ${BRAND_COLOR_HOVER};
      z-index: 100001 !important;
    }
    .impeccable-overlay.impeccable-hover .impeccable-label {
      background: ${BRAND_COLOR_HOVER};
    }
    .impeccable-overlay.impeccable-spotlight {
      z-index: 100002 !important;
    }
    .impeccable-overlay.impeccable-spotlight-dimmed {
      opacity: 0.15 !important;
      animation: none !important;
      filter: blur(3px);
    }
    .impeccable-spotlight-backdrop {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      backdrop-filter: blur(3px) brightness(0.6);
      -webkit-backdrop-filter: blur(3px) brightness(0.6);
      pointer-events: none;
      z-index: 99998;
      opacity: 0;
      outline: none !important;
      animation: none !important;
    }
    .impeccable-spotlight-backdrop.impeccable-visible {
      opacity: 1;
    }
    .impeccable-hidden .impeccable-overlay${EXTENSION_MODE ? '' : ':not(.impeccable-banner)'} {
      display: none !important;
    }
  `;
  (document.head || document.documentElement).appendChild(styleEl);

  // Spotlight backdrop element (created lazily on first use)
  let spotlightBackdrop = null;
  let spotlightTarget = null;

  function getSpotlightBackdrop() {
    if (!spotlightBackdrop) {
      spotlightBackdrop = document.createElement('div');
      spotlightBackdrop.className = 'impeccable-spotlight-backdrop';
      document.body.appendChild(spotlightBackdrop);
    }
    return spotlightBackdrop;
  }

  function updateSpotlightClipPath() {
    if (!spotlightBackdrop || !spotlightTarget) return;
    const r = spotlightTarget.getBoundingClientRect();
    // Match the overlay's outer edge: element rect + 4px (2px overlay offset + 2px outline width)
    const inset = 4;
    const radius = 6; // outline border-radius (4) + outline width (2)
    const x1 = r.left - inset;
    const y1 = r.top - inset;
    const x2 = r.right + inset;
    const y2 = r.bottom + inset;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Outer rect + rounded inner rect (evenodd creates a hole)
    const path = `M0 0H${vw}V${vh}H0Z M${x1 + radius} ${y1}H${x2 - radius}A${radius} ${radius} 0 0 1 ${x2} ${y1 + radius}V${y2 - radius}A${radius} ${radius} 0 0 1 ${x2 - radius} ${y2}H${x1 + radius}A${radius} ${radius} 0 0 1 ${x1} ${y2 - radius}V${y1 + radius}A${radius} ${radius} 0 0 1 ${x1 + radius} ${y1}Z`;
    spotlightBackdrop.style.clipPath = `path(evenodd, "${path}")`;
  }

  function showSpotlight(target) {
    if (!target || !target.getBoundingClientRect) return;
    // Respect the spotlightBlur setting: if disabled, don't show the backdrop
    if (window.__IMPECCABLE_CONFIG__?.spotlightBlur === false) {
      spotlightTarget = target;
      return;
    }
    spotlightTarget = target;
    const bd = getSpotlightBackdrop();
    updateSpotlightClipPath();
    bd.classList.add('impeccable-visible');
  }

  function hideSpotlight() {
    spotlightTarget = null;
    if (spotlightBackdrop) spotlightBackdrop.classList.remove('impeccable-visible');
  }

  function isInViewport(el) {
    const r = el.getBoundingClientRect();
    return r.top >= 0 && r.left >= 0 && r.bottom <= window.innerHeight && r.right <= window.innerWidth;
  }

  // Reposition spotlight on scroll/resize
  window.addEventListener('scroll', () => {
    if (spotlightTarget) updateSpotlightClipPath();
  }, { passive: true });
  window.addEventListener('resize', () => {
    if (spotlightTarget) updateSpotlightClipPath();
  });

  const overlays = [];
  const TYPE_LABELS = {};
  const RULE_CATEGORY = {};
  for (const ap of ANTIPATTERNS) {
    TYPE_LABELS[ap.id] = ap.name.toLowerCase();
    RULE_CATEGORY[ap.id] = ap.category || 'quality';
  }

  function isInFixedContext(el) {
    let p = el;
    while (p && p !== document.body) {
      if (getComputedStyle(p).position === 'fixed') return true;
      p = p.parentElement;
    }
    return false;
  }

  function positionOverlay(overlay) {
    const el = overlay._targetEl;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (overlay._isFixed) {
      // Viewport-relative coords for fixed targets
      overlay.style.top = `${rect.top - 2}px`;
      overlay.style.left = `${rect.left - 2}px`;
    } else {
      // Document-relative coords for normal targets
      overlay.style.top = `${rect.top + scrollY - 2}px`;
      overlay.style.left = `${rect.left + scrollX - 2}px`;
    }
    overlay.style.width = `${rect.width + 4}px`;
    overlay.style.height = `${rect.height + 4}px`;
  }

  function repositionOverlays() {
    for (const o of overlays) {
      if (!o._targetEl || o.classList.contains('impeccable-banner')) continue;
      // Skip overlays whose target is currently hidden (display: none on the overlay)
      if (o.style.display === 'none') continue;
      positionOverlay(o);
    }
  }

  let resizeRAF;
  const onResize = () => {
    cancelAnimationFrame(resizeRAF);
    resizeRAF = requestAnimationFrame(repositionOverlays);
  };
  window.addEventListener('resize', onResize);
  // Reposition on scroll too -- catches sticky/parallax shifts
  window.addEventListener('scroll', onResize, { passive: true });
  // Reposition when body resizes (lazy-loaded images, dynamic content, fonts loading)
  if (typeof ResizeObserver !== 'undefined') {
    const bodyResizeObserver = new ResizeObserver(onResize);
    bodyResizeObserver.observe(document.body);
  }

  // Track target element visibility via IntersectionObserver.
  // Uses a huge rootMargin so all *rendered* elements count as intersecting,
  // while display:none / closed <details> / hidden modals etc. do not.
  // This is event-driven -- no polling needed.
  let overlayIndex = 0;
  const visibilityObserver = new IntersectionObserver((entries) => {
    for (const 
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1004** (2026-05-21): **[BUG] - Since version 0.106.0, it has been impossible to start the whodb application using Docker.**
  *Symptoms*: **Describe the bug** Since **WhoDB v0.107.0**, it has been impossible to start the application using Docker.  Version **0.106.0** works normally, but after upgrading to **0.107.0 or later (tested on 0.109.0)**, the container continuously restarts or exits immediately, making the application unusable.  At first, I thought this was caused by my custom Docker Compose configuration, but even when using the official Docker run command, the container still fails to stay running.  ---  **To Reproduce**  ### Method 1: Docker Compose  Use the following `docker-compose.yml`:  ```yaml networks:     1panel-network:         external: true  services:     whodb:         container_name: ${CONTAINER_NAME}         deploy:             resources:                 limits:                     cpus: ${CPUS}                     memory: ${MEMORY_LIMIT}         environment:             - WHODB_AI_GENERIC_GLM_NAME="glm"             - WHODB_AI_GENERIC_GLM_API_KEY=${PANEL_WHODB_OPENAI_API_KEY}             - WHODB_AI_GENERIC_GLM_BASE_URL=${PANEL_WHODB_OPENAI_ENDPOINT}             - WHODB_AI_GENERIC_GLM_MODELS=${PANEL_WHODB_CUSTOM_MODELS}             # - WHODB_ANTHROPIC_API_KEY=${PANEL_WHODB_ANTHROPIC_API_KEY}             # - WHODB_ANTHROPIC_ENDPOINT=${PANEL_WHODB_ANTHROPIC_ENDPOINT}             # - WHODB_OLLAMA_HOST=${PANEL_WHODB_OLLAMA_HOST}             # - WHODB_OLLAMA_PORT=${PANEL_WHODB_OLLAMA_PORT}         image: clidey/whodb:0.109.0         labels:             createdBy: Apps         networks:        
  **Post-Mortem & Fix Analysis**:
  > Hi @willow-god , are you able to try the latest version 0.110.0? I didn't have any issue with that
  > @modelorona Hello, thank you for your response and the update.  I have tested again with version 0.110.0, but the issue still persists and the application still cannot start.  After further investigation, I confirmed the following:  ### Environment  * Host OS: Linux (x86_64) * Docker image: `clidey/whodb` * Architecture: x86_64 (confirmed via `uname -m`)  ---  ### Observed behavior  When running the container:  ```bash docker run -it -p 8080:8080 clidey/whodb ```  The container immediately restarts or exits without any logs.  Inspecting the container shows that the entrypoint is:  ``` /core ```  Inside the container, `/core` exists and is executable:  ```bash -rwxr-xr-x 1 root root 18.0M /core ```  However, executing it manually results in a crash:  ```bash /core Trace/breakpoint trap (core dumped) ```  ---  ### Further investigation  The binary is detected as:  ``` ELF 64-bit LSB executable, x86-64, statically linked, stripped ```  The container uses Alpine Linux (musl libc):  ``` Alp
  > I wasn't able to replicate it on my mac or windows. I do have a linux laptop and will try there. Thank you for all of the debugging information!

- **Issue #956** (2026-05-08): **[BUG] - CLI update notice prints the wrong version comparison**
  *Symptoms*: **Describe the bug** The current update message prints `latestVersion -> update URL` instead of `currentVersion -> latestVersion`. The notice is malformed even when it is correct that an update exists.  **To Reproduce** 1. Trigger an update-available result. 2. Read the printed notice. 3. Observe that the comparison does not show the installed version.  **Expected behavior** The notice should clearly display current version, latest version, and where to upgrade.  **Screenshots** N/A  **Desktop (please complete the following information):**  - OS that WhoDB is running on: CLI environment  - How you're running WhoDB: CLI  - Browser: N/A  - Version: N/A  **Smartphone (please complete the following information):**  - Device: N/A  - OS: N/A  - Browser: N/A  - Version: N/A  **Additional context** Area: CLI  Evidence: - `cli/cmd/root.go:94-95`  Acceptance Criteria: - Notice format is corrected. - Current and latest versions are both present. - The upgrade URL is presented separately from the version comparison. - Add a focused test if practical. 
  **Post-Mortem & Fix Analysis**:
  > Hi @modelcrona! I'd love to pick this up. I see the exact spot in `cli/cmd/root.go:94-95`.  Could you please assign this to me? I can have a PR ready shortly!
  > @krasilovalex done

- **Issue #955** (2026-05-13): **[BUG] - CLI update-check side effects still run for non-interactive and machine-readable commands**
  *Symptoms*: **Describe the bug** The global `PersistentPostRun` update check only skips trivial invocations like help/version/completion. That still allows update notices to appear on non-interactive and machine-readable commands, which is noisy for scripts and tooling.  **To Reproduce** 1. Run JSON/NDJSON/CSV-oriented commands in a scripted or non-interactive environment. 2. Hit a case where the update check runs. 3. Observe stderr output unrelated to the command result.  **Expected behavior** Automation-oriented commands should not emit update notices unless explicitly requested.  **Screenshots** N/A  **Desktop (please complete the following information):**  - OS that WhoDB is running on: CLI environment  - How you're running WhoDB: CLI  - Browser: N/A  - Version: N/A  **Smartphone (please complete the following information):**  - Device: N/A  - OS: N/A  - Browser: N/A  - Version: N/A  **Additional context** Area: CLI  Evidence: - `cli/cmd/root.go:90-96` - `cli/cmd/root.go:197-221` - `cli/cmd/output_helpers.go:32-50`  Acceptance Criteria: - Update checks are skipped for non-interactive and machine-readable commands by default. - Existing `--no-update-check` behavior still works. - TUI users still see update prompts as before. - Suppression rules are documented and covered by a focused test. 
  **Post-Mortem & Fix Analysis**:
  > Hi @modelorona , I would like to take this issue. Could you please assign this to me?
  > @dhimanAbhi done

- **Issue #954** (2026-05-08): **[BUG] - CLI docs and help text drift on the editor clear keybinding**
  *Symptoms*: **Describe the bug** At least one documented shortcut still drifts from the implementation: the README says `Ctrl+L` clears the editor, while the root help text uses `Ctrl+L` for layout cycling and the actual editor keymap binds clear to `Alt+L`.  **To Reproduce** 1. Read the CLI README editor keybinding table. 2. Read the root command help text. 3. Compare both against the actual TUI keymap. 4. Observe that the editor clear binding is documented inconsistently.  **Expected behavior** README/help text should match the implemented keymap.  **Screenshots** N/A  **Desktop (please complete the following information):**  - OS that WhoDB is running on: CLI environment  - How you're running WhoDB: CLI  - Browser: N/A  - Version: N/A  **Smartphone (please complete the following information):**  - Device: N/A  - OS: N/A  - Browser: N/A  - Version: N/A  **Additional context** Area: CLI  Evidence: - `cli/README.md:892-899` - `cli/cmd/root.go:45-46` - `cli/internal/tui/keymap.go:381-383`  Acceptance Criteria: - README keybinding tables match the implemented keymap. - Root command help does not advertise conflicting shortcuts. - Editor clear is documented consistently with the implementation, or the implementation is changed to match the chosen docs. - Add a lightweight doc-validation check or checklist if practical. 
  **Post-Mortem & Fix Analysis**:
  > Hi, I've observed the issue described above and confirmed that the keybind for clearing the editor is Alt+L and made a commit to update the CLI README accordingly. This clarifies how to clear the editor, and Ctrl+L for layout cycling is unchanged.  If this change is sufficient, I can make a PR. Otherwise, would be open to discuss if any other changes are required.
  > @SSSM0602 sure thing it's a small enough change please feel free to open a PR and I can review

- **Issue #953** (2026-05-13): **[BUG] - Table action shortcuts are disabled on empty result sets**
  *Symptoms*: **Describe the bug** The table keyboard handler exits early when `paginatedRows.length === 0`. That blocks table-level actions like refresh, import, and export even when those actions should still be available with an empty dataset.  **To Reproduce** 1. Open a table with zero visible rows. 2. Try refresh, import, and export shortcuts. 3. Observe that nothing happens because the handler returns before action shortcuts are checked.  **Expected behavior** Row-navigation shortcuts can be disabled on empty tables, but table-level actions should still work when they are otherwise supported.  **Screenshots** N/A  **Desktop (please complete the following information):**  - OS that WhoDB is running on: N/A  - How you're running WhoDB: Source-reviewed frontend issue  - Browser: N/A  - Version: N/A  **Smartphone (please complete the following information):**  - Device: N/A  - OS: N/A  - Browser: N/A  - Version: N/A  **Additional context** Area: Frontend CE  Evidence: - `frontend/src/components/table.tsx:927-938` - `frontend/src/components/table.tsx:960-985`  Acceptance Criteria: - Refresh works with zero rows. - Import works with zero rows when supported. - Export behavior is explicitly defined for empty tables. - Row-navigation shortcuts remain safe no-ops when there are no rows. - Add focused component coverage for the empty-dataset path. 
  **Post-Mortem & Fix Analysis**:
  > @modelorona  hey, i have opened a PR for this.

- **Issue #952** (2026-05-08): **[BUG] - Desktop import action is documented in frontend but not wired through the Wails menu**
  *Symptoms*: **Describe the bug** The frontend listens for `menu:trigger-import`, and shortcut help documents import, but the Wails menu/event bridge never emits an import event or defines an import accelerator.  **To Reproduce** 1. Open the desktop app on a table view that supports import. 2. Open shortcut help or inspect the app menu. 3. Try to trigger import from the desktop menu layer. 4. Observe that import is not available from the Wails menu/event bridge.  **Expected behavior** Documented desktop shortcuts and menu actions should exist and should dispatch the matching frontend event.  **Screenshots** N/A  **Desktop (please complete the following information):**  - OS that WhoDB is running on: Desktop CE / Wails  - How you're running WhoDB: Desktop app  - Browser: N/A  - Version: N/A  **Smartphone (please complete the following information):**  - Device: N/A  - OS: N/A  - Browser: N/A  - Version: N/A  **Additional context** Area: Desktop CE  Evidence: - `frontend/src/components/table.tsx:843-855` - `frontend/src/components/keyboard-shortcuts-help.tsx:123-133` - `frontend/src/utils/shortcuts.ts:25-28` - `desktop-common/app.go:373-409` - `frontend/src/hooks/useDesktop.ts:140-186`  Acceptance Criteria: - Desktop menu includes Import where it is valid to trigger it. - The desktop bridge emits `menu:trigger-import`. - Frontend shortcut docs and desktop menu accelerators stay in sync. - Add a parity test or equivalent coverage if practical. 
  **Post-Mortem & Fix Analysis**:
  > Hey! I would like to work on this issue.
  > @PMota173 assigned!

- **Issue #951** (2026-07-20): **[BUG] - JSON preview throws on invalid JSON instead of showing a local validation state**
  *Symptoms*: **Describe the bug** The editor's JSON preview path still calls `JSON.parse(value)` during render. Invalid JSON can throw and trip the top-level error boundary instead of showing a local validation message.  **To Reproduce** 1. Open a JSON editor view. 2. Enter invalid JSON. 3. Switch to preview. 4. Observe that the page can crash instead of showing an inline preview error.  **Expected behavior** Invalid JSON should show a local preview error state, not crash the app shell.  **Screenshots** N/A  **Desktop (please complete the following information):**  - OS that WhoDB is running on: N/A  - How you're running WhoDB: Source-reviewed frontend issue  - Browser: N/A  - Version: N/A  **Smartphone (please complete the following information):**  - Device: N/A  - OS: N/A  - Browser: N/A  - Version: N/A  **Additional context** Area: Frontend CE  Evidence: - `frontend/src/components/editor.tsx:377-397`  Acceptance Criteria: - Preview mode never throws for malformed JSON. - Invalid JSON shows a readable local validation message. - The error boundary is not triggered by malformed preview input. - Valid JSON preview still renders as before. 

- **Issue #950** (2026-05-08): **[BUG] - Chat SSE parser still loses or corrupts chunk-split events**
  *Symptoms*: **Describe the bug** The chat stream parser still splits each network read on `\n` and parses `data:` lines immediately. It does not buffer incomplete lines across reads, so valid SSE frames can be split across chunks and produce parse errors or missing updates.  **To Reproduce** 1. Send a prompt that produces a long streaming response. 2. Simulate or observe network chunking where an SSE frame is split across `reader.read()` boundaries. 3. Watch for `Failed to parse SSE data` errors and compare the rendered output with the expected stream contents.  **Expected behavior** Streaming should buffer partial SSE lines across reads and reconstruct frames before parsing.  **Screenshots** N/A  **Desktop (please complete the following information):**  - OS that WhoDB is running on: N/A  - How you're running WhoDB: Source-reviewed frontend issue  - Browser: N/A  - Version: N/A  **Smartphone (please complete the following information):**  - Device: N/A  - OS: N/A  - Browser: N/A  - Version: N/A  **Additional context** Area: Frontend CE  Evidence: - `frontend/src/pages/chat/chat.tsx:493-507` - `frontend/src/pages/chat/chat.tsx:509-597`  Acceptance Criteria: - Partial SSE lines are buffered across reads. - Split `event:` and `data:` lines are handled correctly. - No parse errors occur for valid split frames. - Add focused coverage for chunk-split event delivery. 

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

### Incident Patch 1: `b8603b82` (2026-09-30)
**Commit Message**: fix appcapture func

**File**: `cli/internal/appcapture/capture.go` (modified, +1/-1)
```diff
@@ -180,7 +180,7 @@ func Capture(parent context.Context, options Options) (*Result, error) {
 	if err := cmd.Run(); err != nil {
 		message := strings.TrimSpace(stderr.String())
 		if strings.Contains(message, "Executable doesn't exist") || strings.Contains(message, "Please run the following command") {
-			return nil, errors.New("Chromium is missing; run whodb apps setup-capture, or retry whodb apps screenshot --install")
+			return nil, errors.New("missing Chromium; run whodb apps setup-capture, or retry whodb apps screenshot --install")
 		}
 		if len(message) > 700 {
 			message = message[:700]
```

**File**: `cli/internal/appcapture/runtime.go` (modified, +1/-1)
```diff
@@ -34,7 +34,7 @@ func RuntimeDir() (string, error) {
 // It is only called by an explicit CLI setup command or --install flag.
 func SetupRuntime(ctx context.Context) (string, error) {
 	if _, err := exec.LookPath("node"); err != nil {
-		return "", errors.New("Node.js is required; install Node.js, then run whodb apps setup-capture")
+		return "", errors.New("missing Node.js; install Node.js, then run whodb apps setup-capture")
 	}
 	if _, err := exec.LookPath("npm"); err != nil {
 		return "", errors.New("npm is required; install Node.js with npm, then run whodb apps setup-capture")
```

---

### Incident Patch 2: `3179940a` (2026-09-29)
**Commit Message**: feat(cli): fix up capturing screenshots

**File**: `cli/README.md` (modified, +47/-0)
```diff
@@ -754,6 +754,53 @@ whodb mcp serve --platform --read-only
 whodb mcp serve --platform --allow-write
 ```
 
+To capture an actual rendered app with its current data, use the app commands
+or the `whodb_platform_app_views` and `whodb_platform_app_screenshot` MCP tools.
+The MCP screenshot tool returns WebP image content directly to the model. Both
+paths use the selected hosted workspace and are available in read-only mode.
+
+```bash
+whodb apps views "Clidey Sales" --org clidey-erp --project erp-demo --env dev
+whodb apps screenshot "Clidey Sales" --org clidey-erp --project erp-demo \
+  --env dev --tab Catalog --output sales-catalog.webp
+whodb apps setup-capture
+# Or install the optional browser on demand when taking a screenshot:
+whodb apps screenshot "Clidey Sales" --install --org clidey-erp --project erp-demo
+```
+
+For a specific page or interactive state, list pages first, then pass `--page`.
+Use `--click` for a visible app control, or `--actions` for an ordered sequence.
+Selectors are Playwright selectors inside the app frame. `--js` evaluates a
+JavaScript expression or IIFE in that frame after the actions; `--script-file`
+reads the expression from a file. JSON output includes the screenshot path,
+visible text, browser console errors, page errors, failed requests, HTTP error
+responses, and the JavaScript result.
+An assertion in `--js` can throw an error. The command still saves the screenshot
+and JSON diagnostics, sets `checks_passed` to `false`, and exits nonzero.
+`checks_passed` confirms that actions ran and explicit `wait_for` or JavaScript
+assertions passed; a click alone does not prove the app reached an intended view.
+
+```bash
+whodb apps views "Clidey Sales" --org clidey-erp --project erp-demo --env dev
+whodb apps screenshot "Clidey Sales" --org clidey-erp --project erp-demo \
+  --env dev --page main --click 'text=Orders' \
+  --js '(() => ({ rows: document.querySelectorAll("tr").length }))()' \
+  --output sales-orders.webp --format json
+```
+
+The MCP screenshot tool accepts the same `page`, `tab`, `actions`, and `script`
+inputs, so an agent can click, fill, press, wait for a selector, or inspect DOM
+state without creating a Playwright script. For example, use an action
+`{"kind":"click","selector":"text=Orders"}` followed by a script
+`"(() => document.querySelectorAll('tr').length)()"`.
+
+App capture needs Node.js and npm. `setup-capture` installs Playwright and
+Chromium in the user's cache; `--install` does the same before capturing.
+Without them, the command and MCP tool return setup instructions. Existing
+Playwright installations in the WhoDB source checkout work without setup.
+Captures only allow hosted GraphQL reads and never upload or publish the image.
+Inspect sample data and loading states before using a capture as product media.
+
 Local or staging setup:
 
 ```bash
```

**File**: `cli/cmd/platform_apps.go` (modified, +1/-0)
```diff
@@ -86,6 +86,7 @@ func registerPlatformAppCommands() {
 	appsCloneCmd.Flags().BoolVar(&appCloneOverwrite, "overwrite", false, "update an existing target app with the same name")
 	appsCloneCmd.Flags().BoolVarP(&platformWriteYes, "yes", "y", false, "clone without first printing the plan")
 	appsCmd.AddCommand(appsListCmd, appsCloneCmd)
+	registerPlatformAppCaptureCommands()
 }
 
 func readPlatformApps(ctx context.Context, session *platformSession, projectID string) ([]platformApp, error) {
```

**File**: `cli/cmd/platform_apps_capture.go` (added, +223/-0)
```diff
@@ -0,0 +1,223 @@
+/*
+ * Copyright 2026 Clidey, Inc.
+ *
+ * Licensed under the Apache License, Version 2.0 (the "License");
+ */
+
+package cmd
+
+import (
+	"context"
+	"encoding/json"
+	"fmt"
+	"os"
+	"path/filepath"
+	"strings"
+
+	"github.com/clidey/whodb/cli/internal/appcapture"
+	"github.com/clidey/whodb/cli/internal/platform"
+	"github.com/clidey/whodb/cli/pkg/output"
+	"github.com/spf13/cobra"
+)
+
+var (
+	appCaptureEnv         string
+	appCapturePage        string
+	appCaptureTab         string
+	appCaptureOutput      string
+	appCaptureWidth       int
+	appCaptureHeight      int
+	appCaptureInstall     bool
+	appCaptureClicks      []string
+	appCaptureActionsJSON string
+	appCaptureJS          string
+	appCaptureScriptFile  string
+)
+
+var appsSetupCaptureCmd = &cobra.Command{
+	Use:           "setup-capture",
+	Short:         "Install the optional app screenshot browser in your user cache",
+	Args:          cobra.NoArgs,
+	SilenceUsage:  true,
+	SilenceErrors: true,
+	RunE: func(cmd *cobra.Command, _ []string) error {
+		packageFile, err := appcapture.SetupRuntime(cmd.Context())
+		if err != nil {
+			return err
+		}
+		_, err = fmt.Fprintf(cmd.OutOrStdout(), "App capture is ready (%s)\n", packageFile)
+		return err
+	},
+}
+
+var appsViewsCmd = &cobra.Command{
+	Use:           "views <app>",
+	Short:         "List the pages available in a hosted app",
+	Args:          cobra.ExactArgs(1),
+	SilenceUsage:  true,
+	SilenceErrors: true,
+	RunE:          runPlatformAppViews,
+}
+
+var appsScreenshotCmd = &cobra.Command{
+	Use:           "screenshot <app>",
+	Short:         "Capture the rendered hosted app as a WebP image",
+	Args:          cobra.ExactArgs(1),
+	SilenceUsage:  true,
+	SilenceErrors: true,
+	RunE:          runPlatformAppScreenshot,
+}
+
+func registerPlatformAppCaptureCommands() {
+	appsViewsCmd.Flags().StringVar(&appCaptureEnv, "env", "published", "app environment: published or dev")
+	appsScreenshotCmd.Flags().StringVar(&appCaptureEnv, "env", "published", "app environment: published or dev")
+	appsScreenshotCmd.Flags().StringVar(&appCapturePage, "page", "", "app page from the views command")
+	appsScreenshotCmd.Flags().StringVar(&appCaptureTab, "tab", "", "visible app tab or button label to open before capture")
+	appsScreenshotCmd.Flags().StringVar(&appCaptureOutput, "output", "", "output WebP file (defaults to the app name and page)")
+	appsScreenshotCmd.Flags().IntVar(&appCaptureWidth, "width", 1440, "capture viewport width in pixels")
+	appsScreenshotCmd.Flags().IntVar(&appCaptureHeight, "height", 900, "capture viewport height in pixels")
+	appsScreenshotCmd.Flags().BoolVar(&appCaptureInstall, "install", false, "install the optional capture browser before screenshotting")
+	appsScreenshotCmd.Flags().StringArrayVar(&appCaptureClicks, "click", nil, "click a Playwright selector in the app; repeat for sequential clicks")
+	appsScreenshotCmd.Flags().StringVar(&appCaptureActionsJSON, "actions", "", "ordered JSON array of click, fill, press, wait_for, or wait actions")
+	appsScreenshotCmd.Flags().StringVar(&appCaptureJS, "js", "", "JavaScript expression or IIFE to evaluate in the app frame")
+	appsScreenshotCmd.Flags().StringVar(&appCaptureScriptFile, "script-file", "", "read JavaScript to evaluate from a local file")
+	appsCmd.AddCommand(appsViewsCmd, appsScreenshotCmd, appsSetupCaptureCmd)
+}
+
+func resolveAppCapture(ctx context.Context, appRef string) (*platformSession, appcapture.Options, string, error) {
+	session, err := loadPlatformSession(ctx, platformHost)
+	if err != nil {
+		return nil, appcapture.Options{}, "", err
+	}
+	org, project, err := resolvePlatformProject(ctx, session, platformResourceOrg, platformResourceProject)
+	if err != nil {
+		return nil, appcapture.Options{}, "", err
+	}
+	session.Client.SetWorkspaceContext(org.ID, project.ID)
+	apps, err := appcapture.ListApps(ctx, session.Client, project.ID)
+	if err != nil {
+		return nil, appcapture.Options{}, "", err
+	}
+	app, err :
```

**File**: `cli/internal/agentmanifest/manifest.go` (modified, +2/-0)
```diff
@@ -330,6 +330,8 @@ func buildMCPTools() []MCPTool {
 	tools = append(tools,
 		MCPTool{Name: "whodb_platform_apps", Description: "List hosted ontology-powered apps in the selected project.", ReadOnly: true},
 		MCPTool{Name: "whodb_platform_app", Description: "Inspect one hosted app, including its generated definition.", ReadOnly: true},
+		MCPTool{Name: "whodb_platform_app_views", Description: "List pages available in one rendered hosted app.", ReadOnly: true},
+		MCPTool{Name: "whodb_platform_app_screenshot", Description: "Capture a rendered hosted app page after optional browser actions or JavaScript, with console and network diagnostics.", ReadOnly: true},
 		MCPTool{Name: "whodb_platform_app_files", Description: "List files belonging to one hosted app.", ReadOnly: true},
 		MCPTool{Name: "whodb_platform_app_view", Description: "Read the current hosted app view and generated files.", ReadOnly: true},
 		MCPTool{Name: "whodb_platform_app_version_view", Description: "Read a promoted hosted app version.", ReadOnly: true},
```

**File**: `cli/internal/appcapture/capture.go` (added, +245/-0)
```diff
@@ -0,0 +1,245 @@
+/*
+ * Copyright 2026 Clidey, Inc.
+ *
+ * Licensed under the Apache License, Version 2.0 (the "License");
+ */
+
+package appcapture
+
+import (
+	"bytes"
+	"context"
+	_ "embed"
+	"encoding/base64"
+	"encoding/json"
+	"errors"
+	"fmt"
+	"io"
+	"net/http"
+	"net/url"
+	"os"
+	"os/exec"
+	"strings"
+	"time"
+)
+
+//go:embed capture.mjs
+var browserScript string
+
+// App is the small part of a hosted app needed to select a capture target.
+type App struct {
+	ID          string `json:"id"`
+	Name        string `json:"name"`
+	Description string `json:"description"`
+}
+
+// View describes a page that the hosted app runtime can render.
+type View struct {
+	Page string `json:"page"`
+	URL  string `json:"url"`
+}
+
+// Action is one browser interaction performed inside the rendered app frame.
+type Action struct {
+	Kind         string `json:"kind"`
+	Selector     string `json:"selector,omitempty"`
+	Value        string `json:"value,omitempty"`
+	Milliseconds int    `json:"milliseconds,omitempty"`
+}
+
+// Diagnostics reports browser errors observed during an app capture.
+type Diagnostics struct {
+	ConsoleErrors  []string `json:"console_errors,omitempty"`
+	PageErrors     []string `json:"page_errors,omitempty"`
+	FailedRequests []string `json:"failed_requests,omitempty"`
+	HTTPResponses  []string `json:"http_error_responses,omitempty"`
+	ActionErrors   []string `json:"action_errors,omitempty"`
+	ScriptErrors   []string `json:"script_errors,omitempty"`
+}
+
+// Options select one rendered app view for a local browser capture.
+type Options struct {
+	Host        string
+	OrgSlug     string
+	ProjectSlug string
+	OrgID       string
+	ProjectID   string
+	AppID       string
+	Env         string
+	Page        string
+	Tab         string
+	Actions     []Action
+	Script      string
+	Token       string
+	Width       int
+	Height      int
+}
+
+// Result contains the screenshot and visible app content observed at capture time.
+type Result struct {
+	Image            []byte      `json:"-"`
+	MIMEType         string      `json:"mime_type"`
+	URL              string      `json:"url"`
+	Page             string      `json:"page,omitempty"`
+	Tab              string      `json:"tab,omitempty"`
+	Width            int         `json:"width"`
+	Height           int         `json:"height"`
+	Text             string      `json:"visible_text,omitempty"`
+	Diagnostics      Diagnostics `json:"diagnostics"`
+	ScriptResultJSON string      `json:"script_result_json,omitempty"`
+}
+
+// URL builds the actual end-user app route without credentials.
+func (o Options) URL() (string, error) {
+	base, err := url.Parse(o.Host)
+	if err != nil || (base.Scheme != "https" && base.Scheme != "http") || base.Host == "" {
+		return "", errors.New("valid hosted WhoDB URL is required")
+	}
+	if o.OrgSlug == "" || o.ProjectSlug == "" || o.AppID == "" {
+		return "", errors.New("organization, project, and app are required")
+	}
+	base.Path = strings.TrimRight(base.Path, "/") + "/" + url.PathEscape(o.OrgSlug) + "/" + url.PathEscape(o.ProjectSlug) + "/apps/" + url.PathEscape(o.AppID)
+	query := base.Query()
+	if o.Env != "" {
+		if o.Env != "dev" && o.Env != "published" {
+			return "", errors.New("env must be dev or published")
+		}
+		if o.Env == "dev" {
+			query.Set("env", "dev")
+		}
+	}
+	if o.Page != "" {
+		query.Set("page", o.Page)
+	}
+	base.RawQuery = query.Encode()
+	return base.String(), nil
+}
+
+type browserInput struct {
+	Options           Options        `json:"options"`
+	URL               string         `json:"url"`
+	Session           map[string]any `json:"session"`
+	PlaywrightPackage string         `json:"playwrightPackage"`
+}
+
+type browserOutput struct {
+	ImageBase64      string      `json:"imageBase64"`
+	Text             string      `json:"text"`
+	Diagnostics      Diagnostics `json:"diagnostics"`
+	ScriptResultJSON string      `json:"scriptResultJSON"`
+}
+
+// Capture renders the actual app in an isolated browser and ret
```

---

### Incident Patch 3: `7d64b4b6` (2026-09-29)
**Commit Message**: fix for sqlite auth bypass

**File**: `core/src/auth/session_store.go` (modified, +30/-11)
```diff
@@ -19,6 +19,7 @@ package auth
 import (
 	"context"
 	"crypto/rand"
+	"crypto/subtle"
 	"encoding/base64"
 	"encoding/json"
 	"errors"
@@ -43,6 +44,8 @@ import (
 // the data directory. It is distinct from any user-configured sqlite3 data source.
 const sessionDBFileName = "whodb.db"
 
+const sessionPayloadVersion = 1
+
 // errSessionNotFound indicates no live session matched the token.
 var errSessionNotFound = errors.New("session not found")
 
@@ -63,6 +66,13 @@ type sessionRow struct {
 	UpdatedAt            time.Time
 }
 
+type sessionPayload struct {
+	Version       int                 `json:"version"`
+	SessionHash   string              `json:"sessionHash"`
+	CSRFTokenHash string              `json:"csrfTokenHash"`
+	Credentials   *source.Credentials `json:"credentials"`
+}
+
 // TableName sets the table name for sessionRow.
 func (sessionRow) TableName() string { return "sessions" }
 
@@ -213,31 +223,36 @@ func CreateSession(credentials *source.Credentials, ttl time.Duration) (token, c
 		return "", "", time.Time{}, errors.New("session store not initialized")
 	}
 
-	// Marshaling the credentials (including any AccessToken) is intentional — the
-	// result is immediately AES-256-GCM encrypted before it is ever stored.
-	plaintext, err := json.Marshal(credentials) // #nosec G117 -- plaintext is immediately AES-256-GCM encrypted before storage.
+	token, err = randomToken(48)
 	if err != nil {
 		return "", "", time.Time{}, err
 	}
-	encrypted, err := crypto.Encrypt(key, string(plaintext))
+	csrfToken, err = randomToken(32)
 	if err != nil {
 		return "", "", time.Time{}, err
 	}
 
-	token, err = randomToken(48)
+	sessionHash := hashToken(token)
+	csrfTokenHash := hashToken(csrfToken)
+	plaintext, err := json.Marshal(sessionPayload{
+		Version:       sessionPayloadVersion,
+		SessionHash:   sessionHash,
+		CSRFTokenHash: csrfTokenHash,
+		Credentials:   credentials,
+	}) // #nosec G117 -- plaintext is immediately AES-256-GCM encrypted before storage.
 	if err != nil {
 		return "", "", time.Time{}, err
 	}
-	csrfToken, err = randomToken(32)
+	encrypted, err := crypto.Encrypt(key, string(plaintext))
 	if err != nil {
 		return "", "", time.Time{}, err
 	}
 
 	expiresAt = time.Now().Add(ttl)
 	row := sessionRow{
-		SessionHash:          hashToken(token),
+		SessionHash:          sessionHash,
 		EncryptedCredentials: encrypted,
-		CSRFTokenHash:        hashToken(csrfToken),
+		CSRFTokenHash:        csrfTokenHash,
 		ExpiresAt:            expiresAt,
 	}
 	if err := db.Create(&row).Error; err != nil {
@@ -277,14 +292,18 @@ func LookupSession(token string, ttl time.Duration) (creds *source.Credentials,
 		_ = db.Where("session_hash = ?", row.SessionHash).Delete(&sessionRow{}).Error
 		return nil, "", false, errSessionInvalid
 	}
-	credentials := &source.Credentials{}
-	if err := json.Unmarshal([]byte(plaintext), credentials); err != nil {
+	payload := sessionPayload{}
+	if err := json.Unmarshal([]byte(plaintext), &payload); err != nil ||
+		payload.Version != sessionPayloadVersion ||
+		payload.Credentials == nil ||
+		subtle.ConstantTimeCompare([]byte(payload.SessionHash), []byte(row.SessionHash)) != 1 ||
+		subtle.ConstantTimeCompare([]byte(payload.CSRFTokenHash), []byte(row.CSRFTokenHash)) != 1 {
 		_ = db.Where("session_hash = ?", row.SessionHash).Delete(&sessionRow{}).Error
 		return nil, "", false, errSessionInvalid
 	}
 
 	needsRefresh = time.Until(row.ExpiresAt) < ttl/2
-	return credentials, row.CSRFTokenHash, needsRefresh, nil
+	return payload.Credentials, row.CSRFTokenHash, needsRefresh, nil
 }
 
 // RefreshSession slides the session expiry forward by ttl from now.
```

**File**: `core/src/auth/session_store_test.go` (modified, +63/-0)
```diff
@@ -17,13 +17,15 @@
 package auth
 
 import (
+	"encoding/json"
 	"errors"
 	"sync"
 	"testing"
 	"time"
 
 	sqlite3 "github.com/mattn/go-sqlite3"
 
+	"github.com/clidey/whodb/core/src/crypto"
 	"github.com/clidey/whodb/core/src/source"
 )
 
@@ -78,6 +80,67 @@ func TestCreateAndLookupSession(t *testing.T) {
 	}
 }
 
+func TestLookupRejectsCredentialsCopiedBetweenSessions(t *testing.T) {
+	newTestStore(t)
+	victimToken, _, _, err := CreateSession(testCredentials(), time.Hour)
+	if err != nil {
+		t.Fatalf("create victim session: %v", err)
+	}
+	attackerCredentials := testCredentials()
+	attackerCredentials.Values["Hostname"] = "attacker.invalid"
+	attackerToken, _, _, err := CreateSession(attackerCredentials, time.Hour)
+	if err != nil {
+		t.Fatalf("create attacker session: %v", err)
+	}
+
+	var victim sessionRow
+	if err := sessionDB.Where("session_hash = ?", hashToken(victimToken)).First(&victim).Error; err != nil {
+		t.Fatalf("load victim session: %v", err)
+	}
+	if err := sessionDB.Model(&sessionRow{}).
+		Where("session_hash = ?", hashToken(attackerToken)).
+		Update("encrypted_credentials", victim.EncryptedCredentials).Error; err != nil {
+		t.Fatalf("copy victim credentials: %v", err)
+	}
+
+	if _, _, _, err := LookupSession(attackerToken, time.Hour); !errors.Is(err, errSessionInvalid) {
+		t.Fatalf("copied credentials returned %v, want errSessionInvalid", err)
+	}
+	credentials, _, _, err := LookupSession(victimToken, time.Hour)
+	if err != nil {
+		t.Fatalf("victim session should remain valid: %v", err)
+	}
+	if credentials.Values["Password"] != "s3cr3t" {
+		t.Fatalf("victim credentials changed: %#v", credentials.Values)
+	}
+}
+
+func TestLookupRejectsLegacyUnboundSession(t *testing.T) {
+	newTestStore(t)
+	token := "legacy-session-token"
+	csrfToken := "legacy-csrf-token"
+	plaintext, err := json.Marshal(testCredentials())
+	if err != nil {
+		t.Fatal(err)
+	}
+	encrypted, err := crypto.Encrypt(storeTestKey, string(plaintext))
+	if err != nil {
+		t.Fatal(err)
+	}
+	if err := sessionDB.Create(&sessionRow{
+		SessionHash:          hashToken(token),
+		EncryptedCredentials: encrypted,
+		CSRFTokenHash:        hashToken(csrfToken),
+		ExpiresAt:            time.Now().Add(time.Hour),
+	}).Error; err != nil {
+		t.Fatalf("create legacy session: %v", err)
+	}
+
+	if _, _, _, err := LookupSession(token, time.Hour); !errors.Is(err, errSessionInvalid) {
+		t.Fatalf("legacy session returned %v, want errSessionInvalid", err)
+	}
+}
+
 func TestLookupExpiredSession(t *testing.T) {
 	newTestStore(t)
 	// Negative TTL creates an already-expired row.
```

**File**: `core/src/plugins/sqlite3/db.go` (modified, +1/-2)
```diff
@@ -23,7 +23,6 @@ import (
 	"path/filepath"
 	"strings"
 
-	"gorm.io/driver/sqlite"
 	"gorm.io/gorm"
 	"gorm.io/gorm/logger"
 
@@ -111,7 +110,7 @@ func (p *Sqlite3Plugin) DB(config *engine.PluginConfig) (*gorm.DB, error) {
 		dsn = uri.String()
 	}
 
-	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(plugins.GetGormLogConfig())})
+	db, err := gorm.Open(sourceSQLiteDialector(dsn, false), &gorm.Config{Logger: logger.Default.LogMode(plugins.GetGormLogConfig())})
 	if err != nil {
 		l.WithError(err).Error("Failed to connect to SQLite database")
 		return nil, err
```

**File**: `core/src/plugins/sqlite3/driver.go` (added, +66/-0)
```diff
@@ -0,0 +1,66 @@
+/*
+ * Copyright 2026 Clidey, Inc.
+ *
+ * Licensed under the Apache License, Version 2.0 (the "License");
+ * you may not use this file except in compliance with the License.
+ * You may obtain a copy of the License at
+ *
+ *     http://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ */
+
+package sqlite3
+
+import (
+	"database/sql"
+	"strings"
+
+	sqlitedriver "github.com/mattn/go-sqlite3"
+	sqlitegorm "gorm.io/driver/sqlite"
+	"gorm.io/gorm"
+
+	"github.com/clidey/whodb/core/src/env"
+)
+
+const (
+	confinedSQLiteDriverName         = "whodb_sqlite3_confined"
+	confinedReadOnlySQLiteDriverName = "whodb_sqlite3_confined_read_only"
+)
+
+func init() {
+	sql.Register(confinedSQLiteDriverName, confinedSQLiteDriver(false))
+	sql.Register(confinedReadOnlySQLiteDriverName, confinedSQLiteDriver(true))
+}
+
+func confinedSQLiteDriver(readOnly bool) *sqlitedriver.SQLiteDriver {
+	return &sqlitedriver.SQLiteDriver{
+		ConnectHook: func(conn *sqlitedriver.SQLiteConn) error {
+			conn.RegisterAuthorizer(func(operation int, argument1, _ string, _ string) int {
+				if operation == sqlitedriver.SQLITE_ATTACH || operation == sqlitedriver.SQLITE_DETACH {
+					return sqlitedriver.SQLITE_DENY
+				}
+				if readOnly && operation == sqlitedriver.SQLITE_PRAGMA && strings.EqualFold(argument1, "query_only") {
+					return sqlitedriver.SQLITE_DENY
+				}
+				return sqlitedriver.SQLITE_OK
+			})
+			return nil
+		},
+	}
+}
+
+func sourceSQLiteDialector(dsn string, readOnly bool) gorm.Dialector {
+	if env.GetIsLocalMode() {
+		return sqlitegorm.Open(dsn)
+	}
+	driverName := confinedSQLiteDriverName
+	if readOnly {
+		driverName = confinedReadOnlySQLiteDriverName
+	}
+	return sqlitegorm.New(sqlitegorm.Config{DriverName: driverName, DSN: dsn})
+}
```

**File**: `core/src/plugins/sqlite3/sample.go` (modified, +3/-3)
```diff
@@ -20,7 +20,6 @@ import (
 	_ "embed"
 	"sync"
 
-	"gorm.io/driver/sqlite"
 	"gorm.io/gorm"
 	"gorm.io/gorm/logger"
 
@@ -36,6 +35,7 @@ var sampleSQL string
 const SampleDatabaseName = "whodb-sample"
 
 const sampleDatabaseURI = "file:" + SampleDatabaseName + "?mode=memory&cache=shared"
+const readOnlySampleDatabaseURI = sampleDatabaseURI + "&_query_only=1"
 
 var (
 	sampleDBOnce sync.Once
@@ -58,7 +58,7 @@ func GetSampleProfile() types.DatabaseCredentials {
 
 func GetSampleDatabase() (*gorm.DB, error) {
 	sampleDBOnce.Do(func() {
-		db, err := gorm.Open(sqlite.Open(sampleDatabaseURI), &gorm.Config{
+		db, err := gorm.Open(sourceSQLiteDialector(sampleDatabaseURI, false), &gorm.Config{
 			Logger: logger.Default.LogMode(plugins.GetGormLogConfig()),
 		})
 		if err != nil {
@@ -78,7 +78,7 @@ func GetSampleDatabase() (*gorm.DB, error) {
 		return nil, sampleDBErr
 	}
 
-	return gorm.Open(sqlite.Open(sampleDatabaseURI), &gorm.Config{
+	return gorm.Open(sourceSQLiteDialector(readOnlySampleDatabaseURI, true), &gorm.Config{
 		Logger: logger.Default.LogMode(plugins.GetGormLogConfig()),
 	})
 }
```

---

### Incident Patch 4: `cf6828f1` (2026-09-29)
**Commit Message**: fix for profile login and sessions

**File**: `core/graph/resolver_mutation_test.go` (modified, +83/-0)
```diff
@@ -40,6 +40,7 @@ import (
 	"github.com/clidey/whodb/core/src/settings"
 	"github.com/clidey/whodb/core/src/source"
 	"github.com/clidey/whodb/core/src/sourcecatalog"
+	"github.com/clidey/whodb/core/src/types"
 )
 
 func TestAddRowSuccess(t *testing.T) {
@@ -383,6 +384,88 @@ func TestGraphQLAuthorizationRejectsOperationNameSpoofBeforeMutation(t *testing.
 	}
 }
 
+func TestLoginWithSourceProfileRejectsAnonymousConnectionRedirection(t *testing.T) {
+	mock := testutil.NewPluginMock(engine.DatabaseType("Postgres"))
+	connectionAttempts := 0
+	mock.IsAvailableFunc = func(context.Context, *engine.PluginConfig) bool {
+		connectionAttempts++
+		return false
+	}
+	setEngineMock(t, mock)
+	src.MainEngine.AddLoginProfile(types.DatabaseCredentials{
+		CustomId:  "production",
+		Type:      "Postgres",
+		Hostname:  "db.internal",
+		Port:      "5432",
+		Username:  "reader",
+		Password:  "server-owned-secret",
+		Database:  "app",
+		Source:    "environment",
+		IsProfile: true,
+		Advanced:  map[string]string{"SSL Mode": "verify-full"},
+	})
+
+	graphQLServer := handler.NewDefaultServer(NewExecutableSchema(Config{Resolvers: &Resolver{}}))
+	graphQLServer.AroundOperations(auth.GraphQLAuthorizationMiddleware)
+	srv := auth.AuthMiddleware(graphQLServer)
+	body := `{"operationName":"LoginWithSourceProfile","query":"mutation LoginWithSourceProfile($profile: SourceProfileLoginInput!) { LoginWithSourceProfile(profile: $profile) { Status } }","variables":{"profile":{"Id":"production","Values":[{"Key":"Hostname","Value":"attacker.example"},{"Key":"Port","Value":"443"},{"Key":"SSL Mode","Value":"disabled"}]}}}`
+	if strings.Contains(body, "server-owned-secret") {
+		t.Fatal("test request must not contain the stored password")
+	}
+	req := httptest.NewRequest(http.MethodPost, "/api/query", strings.NewReader(body))
+	req.Header.Set("Content-Type", "application/json")
+	w := httptest.NewRecorder()
+
+	srv.ServeHTTP(w, req)
+
+	if w.Code != http.StatusOK || !strings.Contains(w.Body.String(), "source profile connection fields cannot be overridden") {
+		t.Fatalf("expected profile override to be rejected, got status %d body %s", w.Code, w.Body.String())
+	}
+	if connectionAttempts != 0 {
+		t.Fatalf("expected rejection before any connection attempt, got %d attempts", connectionAttempts)
+	}
+}
+
+func TestLoginSourceDoesNotReuseSessionSecretsForConnectionRedirection(t *testing.T) {
+	mock := testutil.NewPluginMock(engine.DatabaseType("Postgres"))
+	var attempted *engine.Credentials
+	mock.IsAvailableFunc = func(_ context.Context, config *engine.PluginConfig) bool {
+		attempted = config.Credentials
+		return false
+	}
+	setEngineMock(t, mock)
+	ctx := testSourceContext("Postgres", map[string]string{
+		"Hostname": "db.internal",
+		"Username": "reader",
+		"Password": "server-owned-secret",
+		"Database": "app",
+		"Port":     "5432",
+		"SSL Mode": "verify-full",
+	})
+
+	_, err := (&Resolver{}).Mutation().LoginSource(ctx, model.SourceLoginInput{
+		SourceType: "Postgres",
+		Values: []*model.RecordInput{
+			{Key: "Hostname", Value: "attacker.example"},
+			{Key: "Port", Value: "443"},
+			{Key: "SSL Mode", Value: "disabled"},
+		},
+	})
+
+	if err == nil {
+		t.Fatal("expected redirected connection without credentials to fail")
+	}
+	if attempted == nil {
+		t.Fatal("expected independent connection attempt")
+	}
+	if attempted.Password != "" || attempted.Username != "" {
+		t.Fatalf("session credentials were reused for redirected connection: %#v", attempted)
+	}
+	if attempted.Hostname != "attacker.example" {
+		t.Fatalf("expected independent request values to be retained, got %#v", attempted)
+	}
+}
+
 func TestLoginFailsWhenPluginUnavailable(t *testing.T) {
 	resolver := &Resolver{}
 	mut := resolver.Mutation()
```

**File**: `core/graph/schema.resolvers.go` (modified, +3/-3)
```diff
@@ -43,7 +43,7 @@ import (
 func (r *mutationResolver) LoginSource(ctx context.Context, credentials model.SourceLoginInput) (*model.StatusResponse, error) {
 	creds := sourceCredentialsFromInput(credentials)
 	if current := auth.GetSourceCredentials(ctx); current != nil && current.SourceType == creds.SourceType {
-		creds.Values = mergeCredentialValues(current.CloneValues(), creds.Values)
+		creds.Values = mergeCurrentSourceValues(current, creds.Values)
 	}
 	return performSourceLogin(ctx, creds, "")
 }
@@ -55,7 +55,7 @@ func (r *mutationResolver) LoginWithSourceProfile(ctx context.Context, profile m
 		return nil, errors.New("login profile does not exist or is not authorized")
 	}
 
-	values, err := auth.MergeSourceProfileValues(credentials.Values, recordInputsToMap(profile.Values))
+	values, err := auth.MergeSourceProfileValues(credentials.SourceType, credentials.Values, recordInputsToMap(profile.Values))
 	if err != nil {
 		return nil, err
 	}
@@ -1134,7 +1134,7 @@ func (r *queryResolver) SourceFieldOptions(ctx context.Context, sourceType strin
 		Values:     recordInputsToMap(values),
 	}
 	if current := auth.GetSourceCredentials(ctx); current != nil && current.SourceType == sourceType {
-		credentials.Values = mergeCredentialValues(current.CloneValues(), credentials.Values)
+		credentials.Values = mergeCurrentSourceValues(current, credentials.Values)
 	}
 
 	session, err := source.Open(ctx, spec, credentials)
```

**File**: `core/graph/source_helpers.go` (modified, +5/-5)
```diff
@@ -20,7 +20,6 @@ import (
 	"context"
 	"errors"
 	"fmt"
-	"maps"
 	"slices"
 	"strconv"
 
@@ -618,10 +617,11 @@ func scopeValueForKind(spec source.TypeSpec, ref source.ObjectRef, kind source.O
 	return ref.Path[index]
 }
 
-func mergeCredentialValues(base map[string]string, overrides map[string]string) map[string]string {
-	merged := map[string]string{}
-	maps.Copy(merged, base)
-	maps.Copy(merged, overrides)
+func mergeCurrentSourceValues(current *source.Credentials, requested map[string]string) map[string]string {
+	merged, err := auth.MergeSourceProfileValues(current.SourceType, current.Values, requested)
+	if err != nil {
+		return requested
+	}
 	return merged
 }
 
```

**File**: `core/src/auth/auth.go` (modified, +14/-9)
```diff
@@ -23,11 +23,11 @@ import (
 	"errors"
 	"maps"
 	"net/http"
+	"slices"
 	"strings"
 	"sync"
 
 	"github.com/clidey/whodb/core/src"
-	"github.com/clidey/whodb/core/src/common/ssl"
 	"github.com/clidey/whodb/core/src/log"
 	"github.com/clidey/whodb/core/src/source"
 	"github.com/clidey/whodb/core/src/sourcecatalog"
@@ -176,7 +176,7 @@ func AuthMiddleware(next http.Handler) http.Handler {
 			_, storedProfile, ok := src.FindSourceProfile(*credentials.ID)
 			if ok {
 				storedProfile.ID = credentials.ID
-				storedProfile.Values, err = MergeSourceProfileValues(storedProfile.Values, credentials.Values)
+				storedProfile.Values, err = MergeSourceProfileValues(storedProfile.SourceType, storedProfile.Values, credentials.Values)
 				if err != nil {
 					http.Error(w, err.Error(), http.StatusBadRequest)
 					return
@@ -189,7 +189,7 @@ func AuthMiddleware(next http.Handler) http.Handler {
 			if !matched {
 				if stored, err := LoadCredentials(*credentials.ID); err == nil && stored != nil {
 					stored.ID = credentials.ID
-					stored.Values, err = MergeSourceProfileValues(stored.Values, credentials.Values)
+					stored.Values, err = MergeSourceProfileValues(stored.SourceType, stored.Values, credentials.Values)
 					if err != nil {
 						http.Error(w, err.Error(), http.StatusBadRequest)
 						return
@@ -285,16 +285,21 @@ func RegisterAuthBypass(fn func(*http.Request) bool) {
 	authBypassFn = fn
 }
 
-// MergeSourceProfileValues merges client overrides while keeping server-side
-// TLS file paths under the control of the stored profile.
-func MergeSourceProfileValues(base map[string]string, overrides map[string]string) (map[string]string, error) {
-	for _, key := range []string{ssl.KeySSLCACertPath, ssl.KeySSLClientCertPath, ssl.KeySSLClientKeyPath} {
-		if value, ok := overrides[key]; ok && value != base[key] {
-			return nil, errors.New("SSL file paths cannot be overridden by clients")
+// MergeSourceProfileValues applies the database selection supported by a
+// stored profile while keeping every connection target and secret server-owned.
+func MergeSourceProfileValues(sourceType string, base map[string]string, overrides map[string]string) (map[string]string, error) {
+	for key := range overrides {
+		if key != "Database" || !sourceSupportsDatabaseSwitching(sourceType) {
+			return nil, errors.New("source profile connection fields cannot be overridden")
 		}
 	}
 	merged := map[string]string{}
 	maps.Copy(merged, base)
 	maps.Copy(merged, overrides)
 	return merged, nil
 }
+
+func sourceSupportsDatabaseSwitching(sourceType string) bool {
+	spec, ok := sourcecatalog.Find(sourceType)
+	return ok && slices.Contains(spec.Contract.BrowsePath, source.ObjectKindDatabase)
+}
```

**File**: `core/src/auth/auth_middleware_test.go` (modified, +6/-6)
```diff
@@ -189,23 +189,23 @@ func TestAuthMiddlewareResolvesIDOnlyCredentialsFromProfiles(t *testing.T) {
 	}
 }
 
-func TestAuthMiddlewareRejectsProfileSSLPathOverride(t *testing.T) {
+func TestAuthMiddlewareRejectsProfileConnectionOverride(t *testing.T) {
 	origEngine := src.MainEngine
 	src.MainEngine = &engine.Engine{}
 	t.Cleanup(func() { src.MainEngine = origEngine })
 
 	src.MainEngine.AddLoginProfile(types.DatabaseCredentials{
-		CustomId:  "profile-with-ca",
+		CustomId:  "profile-with-secret",
 		Type:      "Postgres",
 		Hostname:  "db.local",
 		IsProfile: true,
-		Advanced:  map[string]string{ssl.KeySSLCACertPath: "/trusted/ca.pem"},
+		Advanced:  map[string]string{ssl.KeySSLMode: "verify-full"},
 	})
 
-	id := "profile-with-ca"
+	id := "profile-with-secret"
 	creds := source.Credentials{
 		ID:     &id,
-		Values: map[string]string{ssl.KeySSLCACertPath: "/attacker/ca.pem"},
+		Values: map[string]string{"Hostname": "attacker.example", ssl.KeySSLMode: "disabled"},
 	}
 	payload, err := json.Marshal(&creds)
 	if err != nil {
@@ -221,7 +221,7 @@ func TestAuthMiddlewareRejectsProfileSSLPathOverride(t *testing.T) {
 	})).ServeHTTP(rr, req)
 
 	if rr.Code != http.StatusBadRequest || called {
-		t.Fatalf("expected profile path override to be rejected, got status=%d called=%v", rr.Code, called)
+		t.Fatalf("expected profile connection override to be rejected, got status=%d called=%v", rr.Code, called)
 	}
 }
 
```

---

### Incident Patch 5: `d325b183` (2026-09-29)
**Commit Message**: chat fixes

**File**: `cli/pkg/mcp/tools_test.go` (modified, +10/-0)
```diff
@@ -54,6 +54,11 @@ func TestHandleQuery_ReadOnlyBlocksWrites(t *testing.T) {
 		{"CREATE blocked", "CREATE TABLE foo (id int)"},
 		{"ALTER blocked", "ALTER TABLE users ADD col int"},
 		{"TRUNCATE blocked", "TRUNCATE TABLE users"},
+		{"Postgres file read blocked", "SELECT pg_read_file('/etc/passwd', 0, 100000)"},
+		{"Postgres file export blocked", "SELECT lo_export(1, '/tmp/export')"},
+		{"MySQL file read blocked", "SELECT LOAD_FILE('/etc/passwd')"},
+		{"MySQL OUTFILE blocked", "SELECT 1 INTO\nOUTFILE '/tmp/export'"},
+		{"MySQL DUMPFILE blocked", "SELECT 1 INTO DUMPFILE '/tmp/export'"},
 	}
 
 	for _, tc := range blockedQueries {
@@ -141,6 +146,11 @@ func TestHandleQuery_ConfirmWritesMode(t *testing.T) {
 		"INSERT INTO users VALUES (1, 'test')",
 		"UPDATE users SET name='x' WHERE id=1",
 		"DELETE FROM users WHERE id=1",
+		"SELECT pg_read_file('/etc/passwd', 0, 100000)",
+		"SELECT lo_export(1, '/tmp/export')",
+		"SELECT LOAD_FILE('/etc/passwd')",
+		"SELECT 1 INTO\nOUTFILE '/tmp/export'",
+		"SELECT 1 INTO DUMPFILE '/tmp/export'",
 	}
 
 	for _, query := range writeQueries {
```

**File**: `core/src/bamlconfig/chat_baml_test.go` (modified, +7/-1)
```diff
@@ -219,7 +219,13 @@ func TestSetupAIClientAndCreateDynamicBAMLClient(t *testing.T) {
 }
 
 func TestPlannerCannotLabelWritesAsReads(t *testing.T) {
-	for _, query := range []string{"SELECT * INTO stolen FROM users", "SELECT 1; DELETE FROM users", "SELECT side_effect()"} {
+	for _, query := range []string{
+		"DELETE FROM users",
+		"DROP TABLE users",
+		"SELECT * INTO stolen FROM users",
+		"SELECT 1; DELETE FROM users",
+		"SELECT side_effect()",
+	} {
 		op := types.OperationTypeGET
 		runner := &queryExecutorStub{}
 		message := ProcessChatResponse(t.Context(), &types.ChatResponse{Type: types.ChatMessageTypeSQL, Operation: &op, Text: query}, runner)
```

**File**: `core/src/plugins/sqlite3/sqlite3_runtime_test.go` (modified, +37/-0)
```diff
@@ -17,14 +17,18 @@
 package sqlite3
 
 import (
+	"context"
 	"path/filepath"
 	"testing"
 
 	"gorm.io/driver/sqlite"
 	"gorm.io/gorm"
 
+	"github.com/clidey/whodb/core/baml_client/types"
+	"github.com/clidey/whodb/core/src/bamlconfig"
 	"github.com/clidey/whodb/core/src/engine"
 	"github.com/clidey/whodb/core/src/importer"
+	"github.com/clidey/whodb/core/src/source"
 	_ "github.com/clidey/whodb/core/src/sources/database"
 )
 
@@ -109,6 +113,39 @@ func TestSQLiteReadOnlyRawExecuteRejectsWrites(t *testing.T) {
 	}
 }
 
+func TestChatPlannerMislabelledWriteDoesNotChangeSQLiteState(t *testing.T) {
+	plugin, config, db := newSQLiteRuntimeTestFixture(t,
+		"CREATE TABLE chat_guard (id INTEGER PRIMARY KEY)",
+		"INSERT INTO chat_guard VALUES (1)",
+	)
+	operation := types.OperationTypeGET
+	executions := 0
+	executor := bamlconfig.ChatQueryExecutorFunc(func(_ context.Context, query string, params ...any) (*source.RowsResult, error) {
+		executions++
+		return plugin.RawExecute(config, query, params...)
+	})
+
+	message := bamlconfig.ProcessChatResponse(t.Context(), &types.ChatResponse{
+		Type:      types.ChatMessageTypeSQL,
+		Operation: &operation,
+		Text:      "DELETE FROM chat_guard",
+	}, executor)
+
+	if !message.RequiresConfirmation {
+		t.Fatalf("mislabelled write did not require confirmation: %#v", message)
+	}
+	if executions != 0 {
+		t.Fatalf("mislabelled write reached the executor %d times", executions)
+	}
+	var count int64
+	if err := db.Table("chat_guard").Count(&count).Error; err != nil {
+		t.Fatal(err)
+	}
+	if count != 1 {
+		t.Fatalf("mislabelled write changed database state: row count = %d", count)
+	}
+}
+
 func TestSQLiteColumnMetadataAndGeneratedColumns(t *testing.T) {
 	plugin, config, db := newSQLiteRuntimeTestFixture(t,
 		`CREATE TABLE parents (id INTEGER PRIMARY KEY, name TEXT);`,
```

**File**: `core/src/sqlguard/security_test.go` (modified, +3/-1)
```diff
@@ -5,7 +5,9 @@ import "testing"
 func TestProtectedReadsFailClosed(t *testing.T) {
 	for _, query := range []string{
 		"SELECT * INTO copy FROM users", "SELECT * FROM users INTO OUTFILE '/tmp/dump'",
-		"SELECT data FROM blobs INTO DUMPFILE '/tmp/dump'", "SELECT 1; USE other_database",
+		"SELECT data FROM blobs INTO DUMPFILE '/tmp/dump'", "SELECT 1 INTO\nOUTFILE '/tmp/dump'",
+		"SELECT pg_read_file('/etc/passwd', 0, 100000)", "SELECT lo_export(1, '/tmp/export')",
+		"SELECT LOAD_FILE('/etc/passwd')", "SELECT 1; USE other_database",
 		"SELECT 1; FLURB anything", "SELECT 1 /*! INTO OUTFILE '/tmp/dump' */",
 		"SELECT 1 /*M! INTO OUTFILE '/tmp/dump' */", "SELECT set_config('search_path', 'evil', false)",
 		"SELECT nextval('seq')", "SELECT seq.nextval FROM dual", `SELECT seq."NEXTVAL" FROM dual`, "SELECT pg_advisory_lock(1)", "SELECT readfile('/tmp/secret')",
```

---

### Incident Patch 6: `1246c8e0` (2026-09-28)
**Commit Message**: fix for mcp omiting local source path on upload

**File**: `.agents/docs/hosted-platform-cli.md` (modified, +9/-0)
```diff
@@ -247,6 +247,15 @@ the default mode. They return a confirmation token, and the write runs only
 after approval through `whodb_platform_confirm`. Use `whodb_platform_pending`
 to recover active confirmation tokens.
 
+Upload previews must show the stored absolute source path and destination across
+write plans, confirmations, and pending-action retrieval. Keep this display
+exception specific to uploads; do not relax secret detection for persisted
+workflows or send paths to telemetry. Confirmation tokens are available to the
+model and do not independently prove human approval. File contents and symlink
+targets are not snapshotted at preview time. See the CLI guide's
+[upload review and confirmation limitations](../../cli/README.md#upload-review-and-confirmation-limitations)
+for the user-facing security contract.
+
 Generic write tools are capability-backed. Before using
 `whodb_platform_create`, `whodb_platform_update`, `whodb_platform_delete`, or
 `whodb_platform_action`, agents should read `whodb://platform/schema` and use
```

**File**: `cli/README.md` (modified, +29/-0)
```diff
@@ -931,6 +931,35 @@ safe, and allow-write modes.
 
 Write operations require confirmation by default. Use `--allow-write` to disable confirmations, or `--read-only` to block writes entirely.
 
+#### Upload review and confirmation limitations
+
+For file uploads, the write plan, confirmation preview, and pending-action list
+show the full absolute source path, destination host and project, and folder ID
+(`null` means the project root). The summary quotes the path and escapes control
+characters. Relative paths are resolved against the MCP server's working
+directory when the action is prepared; confirmation uses that stored absolute
+path. A literal `~` is not expanded to the user's home directory.
+
+The CLI reads file contents only when the upload executes. The preview approves
+a path, not an immutable file snapshot: replacing the file or changing a symlink
+before execution can change the uploaded contents. This flow does not sandbox
+local file access; the CLI can read files permitted by its operating-system
+identity.
+
+**A confirmation token does not independently prove human approval.** The model
+receives the token and can call `whodb_platform_confirm`. The assistant is
+instructed to ask the user first, but an independent approval guarantee requires
+the MCP host or another trusted interaction outside the model's control to
+enforce that approval. Clear previews support informed review; they do not
+prevent a malicious or prompt-injected model from calling available tools.
+Use `--read-only` or `--safe-mode` to hide hosted write tools when writes are not
+needed. `--allow-write` executes uploads without the CLI confirmation step.
+
+Upload source paths are intentionally visible to the MCP client for review.
+They are excluded from WhoDB upload telemetry; client-side logging and retention
+are controlled by the MCP host. Other sensitive fields remain redacted, and
+persisted workflow payloads still reject local file paths.
+
 ### Transport Modes
 
 **stdio (default)** - For local CLI integration with Claude Desktop, Claude Code, etc.
```

**File**: `cli/pkg/mcp/platform_tools.go` (modified, +17/-4)
```diff
@@ -487,7 +487,7 @@ func (o PlatformPendingOutput) MarshalJSON() ([]byte, error) {
 	return json.Marshal(Alias(o))
 }
 
-// PlatformActionPreview describes a pending hosted source write without secrets.
+// PlatformActionPreview describes a hosted write with secrets redacted and upload source paths visible.
 type PlatformActionPreview struct {
 	Operation    string                `json:"operation"`
 	Resource     string                `json:"resource,omitempty"`
@@ -1527,7 +1527,7 @@ func platformActionFieldChanges(action *PendingPlatformAction) []PlatformFieldCh
 	changes := make([]PlatformFieldChange, 0, len(keys))
 	for _, key := range keys {
 		value := values[key]
-		if sensitivePlatformWriteKey(key) {
+		if sensitivePlatformWriteKey(key) && (action.Mutation != "UploadProjectFile" || key != "filePath") {
 			changes = append(changes, PlatformFieldChange{Field: key, After: map[string]any{"value": "[redacted]"}, Redacted: true})
 			continue
 		}
@@ -2175,17 +2175,29 @@ func listPendingPlatformActions() []*PendingPlatformAction {
 	return actions
 }
 
+// Preview returns the review details shared by write plans, confirmations, and pending actions.
 func (action *PendingPlatformAction) Preview() *PlatformActionPreview {
 	if action == nil {
 		return nil
 	}
 	changes := append([]string(nil), action.Changes...)
+	summary := action.Summary
+	if action.Mutation == "UploadProjectFile" {
+		// The source path is essential for approval, but stays sensitive in persisted workflows.
+		filePath, _ := action.Variables["filePath"].(string)
+		summary = fmt.Sprintf("Upload file %q", filePath)
+		for i, change := range changes {
+			if change == "filePath (redacted)" {
+				changes[i] = "filePath"
+			}
+		}
+	}
 	willAffect := platformActionWillAffect(action, changes)
 	return &PlatformActionPreview{
 		Operation:    action.Operation,
 		Resource:     action.Resource,
 		Action:       action.Action,
-		Summary:      action.Summary,
+		Summary:      summary,
 		Host:         action.Host,
 		OrgID:        action.OrgID,
 		ProjectID:    action.ProjectID,
@@ -2598,4 +2610,5 @@ Use this to recover confirmation tokens returned by hosted platform write tools.
 
 const descPlatformConfirm = `Confirm and execute a pending hosted WhoDB platform write.
 
-Use the confirmation_token returned by hosted platform write tools. Tokens expire after 5 minutes. Only call this after the user has approved the pending write preview.`
+Use the confirmation_token returned by hosted platform write tools. Tokens expire after 5 minutes. Only call this after the user has approved the pending write preview.
+The token does not independently prove human approval: the MCP host must enforce approval if that guarantee is required. For uploads, review the full local source path and destination; the file is read at execution time, not snapshotted when the preview is created.`
```

**File**: `cli/pkg/mcp/platform_tools_test.go` (modified, +6/-5)
```diff
@@ -649,7 +649,7 @@ func TestHandlePlatformGenericFolderDeleteConfirmsNestedDeletion(t *testing.T) {
 	}
 }
 
-func TestHandlePlatformGenericFileUploadConfirmWritesRedactsPreview(t *testing.T) {
+func TestHandlePlatformGenericFileUploadConfirmWritesShowsSourcePath(t *testing.T) {
 	client := &fakePlatformClient{}
 	withPlatformSessionLoader(t, func(context.Context) (*platformToolSession, error) {
 		return testPlatformSession(client), nil
@@ -669,18 +669,19 @@ func TestHandlePlatformGenericFileUploadConfirmWritesRedactsPreview(t *testing.T
 	if !output.ConfirmationRequired || output.ConfirmationToken == "" {
 		t.Fatalf("output = %#v, want confirmation token", output)
 	}
+	t.Cleanup(func() { consumePendingPlatformAction(output.ConfirmationToken) })
 	raw, err := json.Marshal(output)
 	if err != nil {
 		t.Fatalf("json.Marshal(output) error = %v", err)
 	}
-	if strings.Contains(string(raw), "/tmp/private.csv") {
-		t.Fatalf("confirmation preview leaked local file path: %s", raw)
+	if !strings.Contains(string(raw), "/tmp/private.csv") {
+		t.Fatalf("confirmation preview omitted local file path: %s", raw)
 	}
 	if output.ConfirmationPreview == nil || output.ConfirmationPreview.Resource != "file" || output.ConfirmationPreview.Action != "upload" {
 		t.Fatalf("preview = %#v, want file upload preview", output.ConfirmationPreview)
 	}
-	if output.ConfirmationPreview.Summary != "Upload file" {
-		t.Fatalf("preview summary = %q, want generic upload summary", output.ConfirmationPreview.Summary)
+	if output.ConfirmationPreview.Summary != `Upload file "/tmp/private.csv"` {
+		t.Fatalf("preview summary = %q, want upload source path", output.ConfirmationPreview.Summary)
 	}
 	if client.mutationName != "" {
 		t.Fatalf("mutation executed in confirm-writes mode: %q", client.mutationName)
```

**File**: `cli/pkg/mcp/platform_upload_test.go` (added, +250/-0)
```diff
@@ -0,0 +1,250 @@
+/*
+ * Copyright 2026 Clidey, Inc.
+ *
+ * Licensed under the Apache License, Version 2.0 (the "License");
+ * you may not use this file except in compliance with the License.
+ * You may obtain a copy of the License at
+ *
+ *     http://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ */
+
+package mcp
+
+import (
+	"context"
+	"encoding/json"
+	"io"
+	"net/http"
+	"net/http/httptest"
+	"os"
+	"path/filepath"
+	"reflect"
+	"slices"
+	"strconv"
+	"strings"
+	"sync/atomic"
+	"testing"
+	"time"
+
+	platformapi "github.com/clidey/whodb/cli/internal/platform"
+)
+
+func TestPlatformUploadReviewSurfaces(t *testing.T) {
+	t.Chdir(t.TempDir())
+	cwd, err := os.Getwd()
+	if err != nil {
+		t.Fatal(err)
+	}
+	for _, path := range []string{"./customers.csv", "reports/customer names.csv", "quote\"line\n\t.csv", "~/.ssh/id_rsa", filepath.Join(cwd, "absolute.csv")} {
+		t.Run(strconv.Quote(path), func(t *testing.T) {
+			client := &fakePlatformClient{}
+			session := testPlatformSession(client)
+			withPlatformSessionLoader(t, func(context.Context) (*platformToolSession, error) { return session, nil })
+			input := PlatformGenericWriteInput{Resource: "file", Action: "upload", Payload: map[string]any{"file_path": path, "folderId": "folder-1"}}
+			expectedPath := path
+			if !filepath.IsAbs(path) {
+				expectedPath = filepath.Join(cwd, path)
+			}
+			_, output, err := handlePlatformGenericWrite(context.Background(), "platform_action", input, "action", true)
+			if err != nil || output.Error != "" || !output.ConfirmationRequired {
+				t.Fatalf("prepare upload: %v, %+v", err, output)
+			}
+			t.Cleanup(func() { consumePendingPlatformAction(output.ConfirmationToken) })
+			preview := output.ConfirmationPreview
+			if preview == nil {
+				t.Fatal("missing preview")
+			}
+			if preview.Summary != "Upload file "+strconv.Quote(expectedPath) {
+				t.Fatalf("summary = %q, want quoted absolute path %q", preview.Summary, expectedPath)
+			}
+			if preview.Host != session.Host.URL || preview.OrgID != "org-1" || preview.ProjectID != "proj-1" || preview.ProjectName != "Customer" {
+				t.Fatalf("missing destination: %+v", preview)
+			}
+			fields := map[string]PlatformFieldChange{}
+			for _, field := range preview.FieldChanges {
+				fields[field.Field] = field
+			}
+			if fields["filePath"].Redacted || fields["filePath"].After["value"] != expectedPath || fields["folderId"].After["value"] != "folder-1" {
+				t.Fatalf("incorrect upload fields: %+v", fields)
+			}
+			if slices.Contains(preview.Changes, "filePath (redacted)") || !slices.Contains(preview.Changes, "filePath") {
+				t.Fatalf("inconsistent change labels: %v", preview.Changes)
+			}
+			spec, variables, err := buildPlatformGenericWrite(session, input, "action")
+			if err != nil {
+				t.Fatal(err)
+			}
+			plan := buildPlatformWritePlan(nil, session, spec, variables, "")
+			if !reflect.DeepEqual(plan.Preview, preview) || !reflect.DeepEqual(plan.PayloadKeys, preview.Changes) {
+				t.Fatalf("write plan differs from confirmation: %+v", plan)
+			}
+			_, pending, err := HandlePlatformPending(context.Background(), nil, PlatformPendingInput{})
+			if err != nil {
+				t.Fatal(err)
+			}
+			found := false
+			for _, item := range pending.Pending {
+				if item.Token == output.ConfirmationToken {
+					found = true
+					if !reflect.DeepEqual(item.Action, *preview) {
+						t.Fatalf("pending preview differs: %+v", item.Action)
+					}
+				}
+			}
+			if !found || client.mutationName != "" {
+				t.Fatalf("pending found = %v, mutation = %q", found, client.mutationName)
+			}
+		})
+	}
+}
+
+func TestPlatformUploadPreviewPreservesSensitiveFieldRules(t *
```

---

### Incident Patch 7: `1df642af` (2026-09-18)
**Commit Message**: fix go hash in snapcraft build

**File**: `snapcraft.yaml` (modified, +2/-2)
```diff
@@ -421,11 +421,11 @@ parts:
       case "$(uname -m)" in
         x86_64)
           GO_ARCH=amd64
-          GO_SHA256=675c26c449cbb18fc24b74650de1eabbae6e16f64326fd85a283fb3b58280685
+          GO_SHA256=63d339f0da5ab53635a56f2490a7984dfe12dfcff22ad749f63edaf590168445
           ;;
         aarch64)
           GO_ARCH=arm64
-          GO_SHA256=51798d2c42d0e1c6ed7fd9f48728b4193abac9e8aad6dbac2fe96a81f5909bda
+          GO_SHA256=3450b45a3f9ee8568792736a5c5e70a1f2e9b36c35a8f74958c03e51d7d92bec
           ;;
         *)
           echo "Unsupported Go build architecture: $(uname -m)" >&2
```

---

### Incident Patch 8: `421d18e9` (2026-09-18)
**Commit Message**: fix cli + desktop build

**File**: `cli/cmd/platform_ontology_import.go` (modified, +0/-36)
```diff
@@ -19,7 +19,6 @@ package cmd
 import (
 	"context"
 	"crypto/sha256"
-	"database/sql"
 	"encoding/csv"
 	"encoding/hex"
 	"encoding/json"
@@ -36,7 +35,6 @@ import (
 
 	"github.com/clidey/whodb/cli/internal/platform"
 	"github.com/clidey/whodb/cli/pkg/output"
-	_ "github.com/duckdb/duckdb-go/v2"
 	"github.com/spf13/cobra"
 )
 
@@ -430,40 +428,6 @@ func readOntologyImportRows(ctx context.Context, path string) ([]map[string]any,
 	}
 }
 
-func readOntologyImportParquet(ctx context.Context, path string) ([]map[string]any, error) {
-	db, err := sql.Open("duckdb", "")
-	if err != nil {
-		return nil, err
-	}
-	defer db.Close()
-	rows, err := db.QueryContext(ctx, "SELECT * FROM read_parquet(?)", path)
-	if err != nil {
-		return nil, fmt.Errorf("read parquet: %w", err)
-	}
-	defer rows.Close()
-	columns, err := rows.Columns()
-	if err != nil {
-		return nil, err
-	}
-	result := []map[string]any{}
-	for rows.Next() {
-		values := make([]any, len(columns))
-		pointers := make([]any, len(columns))
-		for index := range values {
-			pointers[index] = &values[index]
-		}
-		if err := rows.Scan(pointers...); err != nil {
-			return nil, err
-		}
-		record := make(map[string]any, len(columns))
-		for index, column := range columns {
-			record[column] = normalizeOntologyImportValue(values[index])
-		}
-		result = append(result, record)
-	}
-	return result, rows.Err()
-}
-
 func readOntologyImportCSV(path string) ([]map[string]any, error) {
 	file, err := os.Open(path)
 	if err != nil {
```

**File**: `cli/cmd/platform_ontology_import_parquet.go` (added, +64/-0)
```diff
@@ -0,0 +1,64 @@
+//go:build !arm && !riscv64
+
+/*
+ * Copyright 2026 Clidey, Inc.
+ *
+ * Licensed under the Apache License, Version 2.0 (the "License");
+ * you may not use this file except in compliance with the License.
+ * You may obtain a copy of the License at
+ *
+ *     http://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ */
+
+package cmd
+
+import (
+	"context"
+	"database/sql"
+	"fmt"
+
+	_ "github.com/duckdb/duckdb-go/v2"
+)
+
+// readOntologyImportParquet reads a Parquet file into rows via an in-memory
+// DuckDB instance. DuckDB has no prebuilt libraries for 32-bit ARM or
+// riscv64, so this lives behind the same build tags as the core plugin.
+func readOntologyImportParquet(ctx context.Context, path string) ([]map[string]any, error) {
+	db, err := sql.Open("duckdb", "")
+	if err != nil {
+		return nil, err
+	}
+	defer db.Close()
+	rows, err := db.QueryContext(ctx, "SELECT * FROM read_parquet(?)", path)
+	if err != nil {
+		return nil, fmt.Errorf("read parquet: %w", err)
+	}
+	defer rows.Close()
+	columns, err := rows.Columns()
+	if err != nil {
+		return nil, err
+	}
+	result := []map[string]any{}
+	for rows.Next() {
+		values := make([]any, len(columns))
+		pointers := make([]any, len(columns))
+		for index := range values {
+			pointers[index] = &values[index]
+		}
+		if err := rows.Scan(pointers...); err != nil {
+			return nil, err
+		}
+		record := make(map[string]any, len(columns))
+		for index, column := range columns {
+			record[column] = normalizeOntologyImportValue(values[index])
+		}
+		result = append(result, record)
+	}
+	return result, rows.Err()
+}
```

**File**: `cli/cmd/platform_ontology_import_parquet_unsupported.go` (added, +30/-0)
```diff
@@ -0,0 +1,30 @@
+//go:build arm || riscv64
+
+/*
+ * Copyright 2026 Clidey, Inc.
+ *
+ * Licensed under the Apache License, Version 2.0 (the "License");
+ * you may not use this file except in compliance with the License.
+ * You may obtain a copy of the License at
+ *
+ *     http://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ */
+
+package cmd
+
+import (
+	"context"
+	"errors"
+)
+
+// readOntologyImportParquet is unavailable on architectures without DuckDB
+// prebuilt libraries (32-bit ARM, riscv64).
+func readOntologyImportParquet(_ context.Context, _ string) ([]map[string]any, error) {
+	return nil, errors.New("parquet import is not supported on this platform; convert the file to CSV, JSON, or NDJSON")
+}
```

**File**: `go.work.desktop-ce` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-go 1.27.0
+go 1.27.1
 
 use (
     ./core
```

**File**: `go.work.desktop-ce.sum` (modified, +191/-0)
```diff
@@ -1,11 +1,133 @@
 atomicgo.dev/cursor v0.2.0/go.mod h1:Lr4ZJB3U7DfPPOkbH7/6TOtJ4vFGHlgj1nc+n900IpU=
 atomicgo.dev/keyboard v0.2.9/go.mod h1:BC4w9g00XkxH/f1HXhW2sXmJFOCWbKn9xrOunSFtExQ=
 atomicgo.dev/schedule v0.1.0/go.mod h1:xeUa3oAkiuHYh8bKiQBRojqAMq3PXXbJujjb0hw8pEU=
+cel.dev/expr v0.25.2/go.mod h1:hrXvqGP6G6gyx8UAHSHJ5RGk//1Oj5nXQ2NI02Nrsg4=
+cloud.google.com/go/accessapproval v1.13.0/go.mod h1:7bmInw17bQX+ZPi7YmReC3xKymDrMmxXaUnaI6zQOqI=
+cloud.google.com/go/accesscontextmanager v1.14.0/go.mod h1:VO15iVnsM0FO9Dt8hSFPgkuHRZjq6LEYZq1szJ27U2k=
+cloud.google.com/go/aiplatform v1.125.0/go.mod h1:yWTZiCunYDnyxeWWD14tDo6+BMlvAUCC5VxuxhvbrVI=
+cloud.google.com/go/analytics v0.35.0/go.mod h1:V9Qef2N0y8GDqQ9FTlmM2XpDEMYonZJRPSUNGZlPCcc=
+cloud.google.com/go/apigateway v1.12.0/go.mod h1:f3Sk8Tdh1Ty5HR7kgbWB6Yu1M82LM+nIr5DTMZnLZWk=
+cloud.google.com/go/apigeeconnect v1.12.0/go.mod h1:mYJekCKZHc2ia5yZX5lwtexTn9CzsOfb6+sh/2hi42Q=
+cloud.google.com/go/apigeeregistry v1.0.0/go.mod h1:o+j6eA8hYhTWX5gEqMMBVDWY+/QQFrYe/YJBsO19pn0=
+cloud.google.com/go/appengine v1.14.0/go.mod h1:JMjrVFg+YgfksZCWbtA3TgbKbPfZZtapB9cGL/5WVnM=
+cloud.google.com/go/area120 v0.15.0/go.mod h1:jD1fw9W4xxIZMY68g7PpbCPleoeGddFs5jPcdhfg3+Y=
+cloud.google.com/go/artifactregistry v1.25.0/go.mod h1:aMmdtqKVmbuxCCb/NGDJYZHsK6AtqlcyvD05ACzs1n8=
+cloud.google.com/go/asset v1.27.0/go.mod h1:+HaDReZQAh/0syAf0uTMeUrMfXikr+KKyDtCdvf7j4M=
+cloud.google.com/go/assuredworkloads v1.18.0/go.mod h1:zBnVYn0E+sDW/mhEmcg1R8+8tguXrtBgmfGY0q34kss=
+cloud.google.com/go/auth v0.18.2/go.mod h1:xD+oY7gcahcu7G2SG2DsBerfFxgPAJz17zz2joOFF3M=
+cloud.google.com/go/auth v0.20.0/go.mod h1:942/yi/itH1SsmpyrbnTMDgGfdy2BUqIKyd0cyYLc5Q=
+cloud.google.com/go/automl v1.20.0/go.mod h1:OkHxjbVDblDafhwuP8yEkz1xcUJhgcbhbsieCW7GaiI=
+cloud.google.com/go/baremetalsolution v1.9.0/go.mod h1:o+stutiS8t+HmjNIG92Gkn8H9+5/q27d6lQp7e9GWdg=
+cloud.google.com/go/batch v1.19.0/go.mod h1:dpWfhLmLQZqsTBAFYjZA3pS04fCY5ttTenZcWmSeILw=
+cloud.google.com/go/beyondcorp v1.7.0/go.mod h1:vujdO0wfsBV2y1egrJxGtwKZr5P5V6bIHKWp1phWHBY=
+cloud.google.com/go/bigquery v1.77.0/go.mod h1:J4wuqka/1hEpdJxH2oBrUR0vjTD+r7drGkpcA3yqERM=
+cloud.google.com/go/bigtable v1.47.0/go.mod h1:GUM6PdkG3rrDse9kugqvX5+ktwo3ldfLtLi1VFn5Wj4=
+cloud.google.com/go/billing v1.26.0/go.mod h1:axqDO1uHegh7u5qngkTfqN1djAeLGsWAFAblERgmgEk=
+cloud.google.com/go/binaryauthorization v1.15.0/go.mod h1:+0CndCJPtcHuVCNok+qQskWvbP5Sp5m6eGL8Vpu5mss=
+cloud.google.com/go/certificatemanager v1.14.0/go.mod h1:QOA8qRoM6/Ik03+srLnBykenGTy0fk78dnPcx5ZWOW8=
+cloud.google.com/go/channel v1.26.0/go.mod h1:04T5Wjq+mHlvEUNzExydnBW1vO64q3Q2Wsblp/dpBxY=
+cloud.google.com/go/cloudbuild v1.30.0/go.mod h1:rg52xEmndQQPiC9NV/8sCaVtKxHMU9D9MeU+oE9VGKA=
+cloud.google.com/go/clouddms v1.13.0/go.mod h1:aMgrOZ+/EKF/PL+h1sDbS+7fAIYV5rTwD+G/apCeHQk=
+cloud.google.com/go/cloudtasks v1.18.0/go.mod h1:3KeCxwtGEyaySL7CR3lMmEa2I4mq1ynXdgmfNiO4RYE=
 cloud.google.com/go/compute v1.54.0 h1:4CKmnpO+40z44bKG5bdcKxQ7ocNpRtOc9SCLLUzze1w=
+cloud.google.com/go/compute v1.63.0 h1:KsBourH0wajM4RhzwPwRMKbxHVdvzGsk7StvACoWXD8=
+cloud.google.com/go/compute v1.63.0/go.mod h1:Xm6PbsLgBpAg4va77ljbBdpMjzuU+uPp5Ze2dnZq7lw=
+cloud.google.com/go/contactcenterinsights v1.22.0/go.mod h1:2Crd36H59Lwkt4gWrLgmnbnF59IIZIa3XYt1gtNqJkQ=
+cloud.google.com/go/container v1.49.0/go.mod h1:EvqoT2eXfxLweXXUlhAMGR0sOAB00XPzEjoL01esSDs=
+cloud.google.com/go/containeranalysis v0.19.0/go.mod h1:Zq0XHzUIa0oTa7H6aSR8HWqeJnoRI9syUcYJzfozjZQ=
+cloud.google.com/go/datacatalog v1.32.0/go.mod h1:DE272tynQUwheJeQAyVfV+nO8yrdkuDyOgH2LtOrkWM=
+cloud.google.com/go/dataflow v0.16.0/go.mod h1:BWhSrIGmsMfuYj3J+nJ2Tw7tplRR6r28kvRiqCD3WlQ=
+cloud.google.com/go/dataform v1.0.0/go.mod h1:i1a0zkS751kvrY1IIPpUQZ77H5doxx7cs0AP3hnXTMk=
+cloud.google.com/go/datafusion v1.13.0/go.mod h1:MQdANs3I/4gitzY+mTBx27rrQyMiUg8uc2Z4TPLWWfc=
+cloud.google.com/go/datalabeling v0.14.0/go.mod h1:DYjvP4RhQ0332YgO22APYlBjCebb+SCaS0e2KApDq/Q=
+cloud.google.com/go/dataplex v1.34.0
```

#### Recent Merged Pull Requests:
- **PR #1312** (2026-09-30): release (@modelorona)
- **PR #1311** (2026-09-30): release (@modelorona)
- **PR #1310** (2026-09-30): release (@modelorona)
- **PR #1306** (2026-09-29): release (@modelorona)
- **PR #1301** (2026-09-28): release (@modelorona)
- **PR #1299** (closed): Bump @types/node from 26.5.0 to 26.6.1 in /sdk (@dependabot[bot])
- **PR #1298** (2026-09-28): Bump golang.org/x/oauth2 from 0.36.0 to 0.37.0 in /core (@dependabot[bot])
- **PR #1295** (2026-09-28): Bump github.com/posthog/posthog-go from 1.25.1 to 1.25.2 in /core (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
