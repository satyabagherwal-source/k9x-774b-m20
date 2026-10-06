# Forensic Learning Record (Deep Inspection): bradygaster/squad

> **Canonical Artifact**: `07_PROJECT_LEARNING/bradygaster-squad-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/bradygaster/squad](https://github.com/bradygaster/squad))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:04:58.714Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `bradygaster/squad`
- **Description**: Squad: AI agent teams for any project
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 3251 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/squad-cli/scripts/patch-ink-rendering.mjs`
```
#!/usr/bin/env node

/**
 * Ink Rendering Patcher for Squad CLI
 *
 * Patches ink/build/ink.js to fix scroll flicker on Windows Terminal.
 * Three patches are applied:
 *
 * 1. Remove trailing newline — the extra '\n' appended to output causes
 *    logUpdate's previousLineCount to be off by one, pushing the bottom of
 *    the UI below the viewport.
 *
 * 2. Disable clearTerminal fullscreen path — when output fills the terminal,
 *    Ink clears the entire screen, causing violent scroll-to-top flicker.
 *    We force the condition to `false` so logUpdate's incremental
 *    erase-and-rewrite is always used instead.
 *
 * 3. Verify incrementalRendering passthrough — confirms that Ink forwards
 *    the incrementalRendering option to logUpdate.create(). No code change
 *    needed if already wired up.
 *
 * All patches are idempotent (safe to run multiple times).
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function patchInkRendering() {
  // Try multiple possible locations (npm workspaces can hoist dependencies)
  const possiblePaths = [
    // squad-cli package node_modules
    join(__dirname, '..', 'node_modules', 'ink', 'build', 'ink.js'),
    // Workspace root node_modules (common with npm workspaces)
    join(__dirname, '..', '..', '..', 'node_modules', 'ink', 'build', 'ink.js'),
    // Global install location (node_modules at parent of package)
    join(__dirname, '..', '..', 'ink', 'build', 'ink.js'),
  ];

  const inkJsPath = possiblePaths.find(p => existsSync(p)) ?? null;

  if (!inkJsPath) {
    // ink not installed yet — exit silently
    return false;
  }

  try {
    let content = readFileSync(inkJsPath, 'utf8');
    let patchCount = 0;

    // --- Patch 1: Remove trailing newline ---
    // Original:  const outputToRender = output + '\n';
    // Patched:   const outputToRender = output;
    const trailingNewlineSearch = "const outputToRender = output + '\\n';";
    const trailingNewlineReplace = 'const outputToRender = output;';
    if (content.includes(trailingNewlineSearch)) {
      content = content.replace(trailingNewlineSearch, trailingNewlineReplace);
      console.log('  ✅ Patch 1/3: Removed trailing newline from outputToRender');
      patchCount++;
    } else if (content.includes(trailingNewlineReplace)) {
      console.log('  ⏭️  Patch 1/3: Trailing newline already removed');
    } else {
      console.warn('  ⚠️  Patch 1/3: Could not find outputToRender pattern — Ink version may have changed');
    }

    // --- Patch 2: Disable clearTerminal fullscreen path ---
    // Original:  if (isFullscreen) {
    //              const sync = shouldSynchronize(this.options.stdout);
    //              ...
    //              this.options.stdout.write(ansiEscapes.clearTerminal + ...
    // Patched:   if (false) {
    //
    // We match `if (isFullscreen) {` only when followed by the clearTerminal
    // usage to avoid replacing unrelated isFullscreen references.
    const fullscreenSearch = /if \(isFullscreen\) \{\s*\n\s*const sync = shouldSynchronize/;
    const fullscreenAlreadyPatched = /if \(false\) \{\s*\n\s*const sync = shouldSynchronize/;
    if (fullscreenSearch.test(content)) {
      content = content.replace(
        /if \(isFullscreen\) (\{\s*\n\s*const sync = shouldSynchronize)/,
        'if (false) $1'
      );
      console.log('  ✅ Patch 2/3: Disabled clearTerminal fullscreen path');
      patchCount++;
    } else if (fullscreenAlreadyPatched.test(content)) {
      console.log('  ⏭️  Patch 2/3: clearTerminal path already disabled');
    } else {
      console.warn('  ⚠️  Patch 2/3: Could not find isFullscreen pattern — Ink version may have changed');
    }

    // --- Patch 3: Verify incrementalRendering passthrough ---
    const incrementalPattern = 'incremental: options.incrementalRendering';
    if (content.includes(incrementalPattern)) {
      console.log('  ✅ Patch 3/3: incrementalRendering passthrough verified (no change needed)');
    } else {
      console.warn('  ⚠️  Patch 3/3: incrementalRendering passthrough not found — Ink version may have changed');
    }

    if (patchCount > 0) {
      writeFileSync(inkJsPath, content, 'utf8');
      console.log(`✅ Patched ink.js with ${patchCount} rendering fix(es) for scroll flicker`);
      return true;
    }

    return false;
  } catch (err) {
    console.warn('⚠️  Failed to patch ink.js rendering:', err.message);
    console.warn('    Scroll flicker may occur on Windows Terminal.');
    return false;
  }
}

// Run patch
patchInkRendering();

```

### Core Architecture Module: `packages/squad-cli/src/cli/commands/install-hooks.ts`
```
/**
 * Git Hook Installation — installs squad sync hooks into the repo's .git/hooks/.
 *
 * Hooks are installed with chaining: if a user already has a hook (e.g., from husky),
 * the squad hook is appended and the existing hook is called first.
 *
 * Installed hooks:
 * - pre-push: pushes squad-state branches alongside the user's push
 * - post-merge: fetches squad-state after the user pulls
 * - post-rewrite: fetches squad-state after rebase
 * - post-checkout: fetches squad-state on branch switch
 */

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

const SQUAD_HOOK_MARKER = '# --- squad-sync-hook ---';

/**
 * The shell script content for each hook.
 * These are minimal wrappers that call `squad sync`.
 * The SQUAD_SYNC_ACTIVE env guard prevents recursion.
 */
const HOOK_TEMPLATES: Record<string, string> = {
  'pre-push': `#!/bin/sh
${SQUAD_HOOK_MARKER}
# Auto-push squad-state branches alongside the user's push.
# Installed by: squad init / squad upgrade --state-backend
# The remote name and URL are passed as arguments by git.
if [ -z "$SQUAD_SYNC_ACTIVE" ]; then
  REMOTE="\$1"
  export SQUAD_SYNC_ACTIVE=1
  # Push all squad-state branches (including subsquad branches)
  for branch in $(git for-each-ref --format='%(refname:short)' 'refs/heads/squad-state' 'refs/heads/squad-state/*' 2>/dev/null); do
    git push --no-verify "$REMOTE" "refs/heads/$branch:refs/heads/$branch" 2>/dev/null || true
  done
  # Push git notes for two-layer backend
  git push --no-verify "$REMOTE" 'refs/notes/squad*:refs/notes/squad*' 2>/dev/null || true
  unset SQUAD_SYNC_ACTIVE
fi
`,
  'post-merge': `#!/bin/sh
${SQUAD_HOOK_MARKER}
# Auto-fetch squad-state branches after pull/merge.
# Installed by: squad init / squad upgrade --state-backend
if [ -z "$SQUAD_SYNC_ACTIVE" ]; then
  export SQUAD_SYNC_ACTIVE=1
  REMOTE=$(git config "branch.$(git symbolic-ref --short HEAD 2>/dev/null).remote" 2>/dev/null || echo origin)
  # Fetch squad-state branches
  git fetch "$REMOTE" '+refs/heads/squad-state:refs/remotes/'"$REMOTE"'/squad-state' '+refs/heads/squad-state/*:refs/remotes/'"$REMOTE"'/squad-state/*' 2>/dev/null || true
  # Fast-forward local squad-state from remote
  for remote_ref in $(git for-each-ref --format='%(refname:short)' "refs/remotes/$REMOTE/squad-state" "refs/remotes/$REMOTE/squad-state/*" 2>/dev/null); do
    local_name=\${remote_ref#"$REMOTE/"}
    local_sha=$(git rev-parse "refs/heads/$local_name" 2>/dev/null) || { git update-ref "refs/heads/$local_name" "$(git rev-parse "$remote_ref")" 2>/dev/null; continue; }
    remote_sha=$(git rev-parse "$remote_ref" 2>/dev/null) || continue
    [ "$local_sha" = "$remote_sha" ] && continue
    git merge-base --is-ancestor "$local_sha" "$remote_sha" 2>/dev/null && git update-ref "refs/heads/$local_name" "$remote_sha" 2>/dev/null || true
  done
  # Fetch git notes for two-layer backend
  git fetch "$REMOTE" '+refs/notes/squad*:refs/notes/squad*' 2>/dev/null || true
  unset SQUAD_SYNC_ACTIVE
fi
`,
  'post-rewrite': `#!/bin/sh
${SQUAD_HOOK_MARKER}
# Auto-fetch squad-state branches after rebase.
# Installed by: squad init / squad upgrade --state-backend
if [ -z "$SQUAD_SYNC_ACTIVE" ]; then
  export SQUAD_SYNC_ACTIVE=1
  REMOTE=$(git config "branch.$(git symbolic-ref --short HEAD 2>/dev/null).remote" 2>/dev/null || echo origin)
  git fetch "$REMOTE" '+refs/heads/squad-state:refs/remotes/'"$REMOTE"'/squad-state' '+refs/heads/squad-state/*:refs/remotes/'"$REMOTE"'/squad-state/*' 2>/dev/null || true
  for remote_ref in $(git for-each-ref --format='%(refname:short)' "refs/remotes/$REMOTE/squad-state" "refs/remotes/$REMOTE/squad-state/*" 2>/dev/null); do
    local_name=\${remote_ref#"$REMOTE/"}
    local_sha=$(git rev-parse "refs/heads/$local_name" 2>/dev/null) || { git update-ref "refs/heads/$local_name" "$(git rev-parse "$remote_ref")" 2>/dev/null; continue; }
    remote_sha=$(git rev-parse "$remote_ref" 2>/dev/null) || continue
    [ "$local_sha" = "$remote_sha" ] && continue
    git merge-base --is-ancestor "$local_sha" "$remote_sha" 2>/dev/null && git update-ref "refs/heads/$local_name" "$remote_sha" 2>/dev/null || true
  done
  git fetch "$REMOTE" '+refs/notes/squad*:refs/notes/squad*' 2>/dev/null || true
  unset SQUAD_SYNC_ACTIVE
fi
`,
  'post-checkout': `#!/bin/sh
${SQUAD_HOOK_MARKER}
# Auto-fetch squad-state branches on branch switch.
# Installed by: squad init / squad upgrade --state-backend
# Only run on branch checkout (3rd arg = 1), not file checkout.
if [ "\$3" = "1" ] && [ -z "$SQUAD_SYNC_ACTIVE" ]; then
  export SQUAD_SYNC_ACTIVE=1
  REMOTE=$(git config "branch.$(git symbolic-ref --short HEAD 2>/dev/null).remote" 2>/dev/null || echo origin)
  git fetch "$REMOTE" '+refs/heads/squad-state:refs/remotes/'"$REMOTE"'/squad-state' '+refs/heads/squad-state/*:refs/remotes/'"$REMOTE"'/squad-state/*' 2>/dev/null || true
  for remote_ref in $(git for-each-ref --format='%(refname:short)' "refs/remotes/$REMOTE/squad-state" "refs/remotes/$REMOTE/squad-state/*" 2>/dev/null); do
    local_name=\${remote_ref#"$REMOTE/"}
    local_sha=$(git rev-parse "refs/heads/$local_name" 2>/dev/null) || { git update-ref "refs/heads/$local_name" "$(git rev-parse "$remote_ref")" 2>/dev/null; continue; }
    remote_sha=$(git rev-parse "$remote_ref" 2>/dev/null) || continue
    [ "$local_sha" = "$remote_sha" ] && continue
    git merge-base --is-ancestor "$local_sha" "$remote_sha" 2>/dev/null && git update-ref "refs/heads/$local_name" "$remote_sha" 2>/dev/null || true
  done
  git fetch "$REMOTE" '+refs/notes/squad*:refs/notes/squad*' 2>/dev/null || true
  unset SQUAD_SYNC_ACTIVE
fi
`,
  'pre-commit': `#!/bin/sh
${SQUAD_HOOK_MARKER}
# WI-1: Guard against accidentally committing two-layer mutable state into the
# working tree. If the user has staged any .squad/ paths that are owned by the
# two-layer/orphan backend (decisions.md, agents/*/history.md, casting/, routing/),
# warn and abort so the state stays on the squad-state orphan branch.
# Installed by: squad init / squad upgrade --state-backend (two-layer/orphan)
if [ -z "$SQUAD_SYNC_ACTIVE" ]; then
  STAGED=$(git diff --cached --name-only 2>/dev/null | grep -E '^\\.squad/(decisions\\.md|agents/.+/history\\.md|casting/|routing/)' || true)
  if [ -n "$STAGED" ]; then
    echo "⚠ squad pre-commit: refusing to commit two-layer state into the working tree." >&2
    echo "  These paths belong on the 'squad-state' orphan branch, not in your normal commits:" >&2
    echo "$STAGED" | sed 's/^/    /' >&2
    echo "  Use 'git restore --staged <path>' to unstage, or set SQUAD_SYNC_ACTIVE=1 to bypass." >&2
    exit 1
  fi
fi
`,
  'post-commit': `#!/bin/sh
${SQUAD_HOOK_MARKER}
# WI-1: After a working-tree commit, sync any pending two-layer state (decisions,
# histories, casting) onto the squad-state orphan branch so team-state stays
# durable and shareable. Best-effort — never blocks the commit.
# Installed by: squad init / squad upgrade --state-backend (two-layer/orphan)
if [ -z "$SQUAD_SYNC_ACTIVE" ]; then
  export SQUAD_SYNC_ACTIVE=1
  # If the squad CLI is on PATH, ask it to flush any pending state.
  if command -v squad >/dev/null 2>&1; then
    squad sync --quiet 2>/dev/null || true
  fi
  unset SQUAD_SYNC_ACTIVE
fi
`,
};

export interface InstallHooksOptions {
  force?: boolean;
}

/**
 * Get the .git/hooks directory path for the repo.
 */
function getHooksDir(cwd: string): string {
  // Respect core.hooksPath if already set
  try {
    const customPath = execFileSync('git', ['config', '--get', 'core.hooksPath'], {
      cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    if (customPath) {
      return path.isAbsolute(customPath) ? customPath : path.resolve(cwd, customPath);
    }
  } catch {
    // Not set — use default
  }

  const gitDir = execFileSync('git', ['rev-parse', '--git-dir'], {
    cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();

  return path.resolve(cwd, gitDir, 'hooks');
}

/**
 * Install a single hook, chaining with any existing hook.
 */
function installHook(hooksDir: string, hookName: string, content: string, force: boolean): 'installed' | 'chained' | 'skipped' {
  const hookPath = path.join(hooksDir, hookName);

  // Check if hook already exists
  if (fs.existsSync(hookPath)) {
    const existing = fs.readFileSync(hookPath, 'utf-8');

    // Already has our marker — skip unless force
    if (existing.includes(SQUAD_HOOK_MARKER)) {
      if (!force) return 'skipped';
      // Force: remove old squad section and re-append
      const cleaned = existing.split('\n').filter(line => {
        // Remove lines between markers
        return true; // simplified: just replace the file
      }).join('\n');
      // For simplicity on force, rewrite with chaining
    }

    // Chain: existing hook runs first, then squad hook (without shebang)
    const squadSection = content.split('\n').slice(1).join('\n'); // remove #!/bin/sh
    const chained = existing.trimEnd() + '\n\n' + squadSection;
    fs.writeFileSync(hookPath, chained, { mode: 0o755 });
    return 'chained';
  }

  // No existing hook — write fresh
  fs.mkdirSync(hooksDir, { recursive: true });
  fs.writeFileSync(hookPath, content, { mode: 0o755 });
  return 'installed';
}

/**
 * Main hook installation entrypoint.
 */
export function installGitHooks(cwd: string, options: InstallHooksOptions = {}): void {
  const { force = false } = options;

  // Verify we're in a git repo
  try {
    execFileSync('git', ['rev-parse', '--git-dir'], {
      cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch {
    console.log(`${YELLOW}⚠${RESET} Not a git repository. Cannot install hooks.`);
    return;
  }

  // Check if backend needs hooks (only orphan/two-layer)
  let backend: string | null = null;
  try {
    const configPath = path.join(cwd, '.squad', 'config.json
```

### Core Architecture Module: `packages/squad-cli/src/cli/commands/loop.ts`
```
/**
 * Loop command — prompt-driven continuous work loop.
 *
 * Reads a loop.md file (YAML frontmatter + prompt body) and runs it on a
 * fixed interval without requiring GitHub issues.  Think of it as Ralph in
 * "free-run" mode: the prompt IS the work driver.
 */

import path from 'node:path';
import { execFile, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { effectiveSquadDir } from '../core/effective-squad-dir.js';
import { fatal } from '../core/errors.js';
import { GREEN, RED, DIM, BOLD, RESET, YELLOW } from '../core/output.js';
import { withAdditionalMcpConfig } from '../core/copilot-invocation.js';
import {
  CapabilityRegistry,
  createDefaultRegistry,
} from './watch/index.js';
import { buildCustomAgentCommand } from './watch/agent-spawn.js';
import type { WatchCapability, WatchContext, WatchPhase, CapabilityResult } from './watch/types.js';
import type { WatchConfig } from './watch/config.js';
import { createPlatformAdapter } from '@bradygaster/squad-sdk/platform';
import { parseRoster } from '@bradygaster/squad-sdk/ralph/triage';

// ── Types ────────────────────────────────────────────────────────

export interface LoopFrontmatter {
  /**
   * Onboarding-mode switch, not a safety gate.
   * - `configured: false` (or missing) → run the onboarding flow
   * - `configured: true` → run the normal loop flow
   * Do not reintroduce an early-return guard based on this flag.
   */
  configured: boolean;
  /** Minutes between cycles (default: 10). */
  interval: number;
  /** Max minutes per cycle (default: 30). */
  timeout: number;
  /** Human description shown in status output. */
  description?: string;
}

export interface LoopConfig {
  /** Path to loop file (default: loop.md in cwd). */
  filePath?: string;
  /** Override interval from frontmatter. */
  interval?: number;
  /** Override timeout from frontmatter. */
  timeout?: number;
  /** Extra flags passed to `gh copilot`. */
  copilotFlags?: string;
  /** Fully override the agent command (e.g., `gh copilot --yolo`). */
  agentCmd?: string;
  /** Capability overrides, keyed by capability name. */
  capabilities: Record<string, boolean | Record<string, unknown>>;
}

// ── Frontmatter Parser ───────────────────────────────────────────

/**
 * Parse a loop.md string into validated frontmatter + prompt body.
 *
 * Frontmatter is the YAML block between the first two `---` delimiters.
 * Only simple `key: value` pairs are supported — no yaml dependency needed.
 */
export function parseLoopFile(content: string): { frontmatter: LoopFrontmatter; prompt: string } {
  const lines = content.split('\n');

  let frontmatterLines: string[] = [];
  let bodyStart = 0;

  if (lines[0]?.trim() === '---') {
    for (let i = 1; i < lines.length; i++) {
      if (lines[i]?.trim() === '---') {
        bodyStart = i + 1;
        break;
      }
      frontmatterLines.push(lines[i] ?? '');
    }
  }

  // Parse simple key: value pairs from frontmatter
  const raw: Record<string, string> = {};
  for (const line of frontmatterLines) {
    const match = line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (match) {
      raw[match[1]!] = match[2]!.trim();
    }
  }

  // Extract and validate configured field
  const configuredRaw = raw['configured'];
  const configured = configuredRaw === 'true';

  // Parse numeric fields with defaults
  const intervalRaw = raw['interval'];
  const interval = intervalRaw ? parseInt(intervalRaw, 10) : 10;

  const timeoutRaw = raw['timeout'];
  const timeout = timeoutRaw ? parseInt(timeoutRaw, 10) : 30;

  // Strip surrounding quotes from description
  let description = raw['description'];
  if (description) {
    description = description.replace(/^["']|["']$/g, '');
  }

  const frontmatter: LoopFrontmatter = {
    configured,
    interval: isNaN(interval) ? 10 : interval,
    timeout: isNaN(timeout) ? 30 : timeout,
    description,
  };

  const prompt = lines.slice(bodyStart).join('\n').trim();

  return { frontmatter, prompt };
}

// ── Boilerplate Generator ────────────────────────────────────────

/** Returns the content of a starter loop.md for --init. */
export function generateLoopFile(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // Walk up from src/cli/commands (or dist/cli/commands) to package root
  const templatePath = path.resolve(here, '..', '..', '..', 'templates', 'loop.md');
  return readFileSync(templatePath, 'utf-8');
}

// ── Agent Command Builder ────────────────────────────────────────

export function buildLoopAgentCommand(
  prompt: string,
  options: { agentCmd?: string; copilotFlags?: string; teamRoot?: string },
): { cmd: string; args: string[] } {
  if (options.agentCmd) {
    return buildCustomAgentCommand(options.agentCmd, prompt);
  }
  const args = ['-p', prompt];
  if (options.copilotFlags) {
    args.push(...options.copilotFlags.trim().split(/\s+/));
  }
  return { cmd: 'copilot', args: withAdditionalMcpConfig('copilot', args, options.teamRoot) };
}

// ── Capability Phase Runner ──────────────────────────────────────

async function runPhase(
  phase: WatchPhase,
  enabled: WatchCapability[],
  context: WatchContext,
  config: WatchConfig,
): Promise<void> {
  const phaseCapabilities = enabled.filter(c => c.phase === phase);
  const ts = new Date().toLocaleTimeString();
  for (const cap of phaseCapabilities) {
    try {
      const capConfig = config.capabilities[cap.name];
      const capContext: WatchContext = {
        ...context,
        config: typeof capConfig === 'object' && capConfig !== null
          ? (capConfig as Record<string, unknown>)
          : { enabled: !!capConfig },
      };
      const result: CapabilityResult = await cap.execute(capContext);
      if (!result.success) {
        console.log(`${YELLOW}⚠${RESET} [${ts}] ${cap.name}: ${result.summary}`);
      }
    } catch (e) {
      console.log(`${YELLOW}⚠${RESET} [${ts}] ${cap.name} crashed: ${(e as Error).message}`);
    }
  }
}

// ── Preflight Capabilities ───────────────────────────────────────

async function preflightLoopCapabilities(
  registry: CapabilityRegistry,
  config: WatchConfig,
  context: WatchContext,
): Promise<WatchCapability[]> {
  const enabled: WatchCapability[] = [];
  const skipped: Array<{ name: string; reason: string }> = [];

  // Loop only activates pre-scan and housekeeping phases
  const allowedPhases: WatchPhase[] = ['pre-scan', 'housekeeping'];

  for (const cap of registry.all()) {
    if (!allowedPhases.includes(cap.phase)) continue;

    const capConfig = config.capabilities[cap.name];
    if (!capConfig) continue;

    const capContext: WatchContext = {
      ...context,
      config: typeof capConfig === 'object' && capConfig !== null
        ? (capConfig as Record<string, unknown>)
        : {},
    };

    try {
      const result = await cap.preflight(capContext);
      if (result.ok) {
        enabled.push(cap);
      } else {
        skipped.push({ name: cap.name, reason: result.reason ?? 'preflight failed' });
      }
    } catch (e) {
      skipped.push({ name: cap.name, reason: (e as Error).message });
    }
  }

  if (enabled.length > 0) {
    console.log(`${GREEN}✅${RESET} Capabilities: ${enabled.map(c => c.name).join(', ')}`);
  }
  for (const s of skipped) {
    console.log(`${YELLOW}⚠️${RESET}  ${s.name} skipped: ${s.reason}`);
  }

  return enabled;
}

// ── Noop Platform Adapter ────────────────────────────────────────

/** Safe no-op adapter for when no git remote / platform config is available. */
function createNoopAdapter(): ReturnType<typeof createPlatformAdapter> {
  const msg = 'No platform adapter available — loop running without git remote';
  return {
    type: 'github' as const,
    listWorkItems: async () => [],
    getWorkItem: async () => { throw new Error(msg); },
    createWorkItem: async () => { throw new Error(msg); },
    addTag: async () => {},
    removeTag: async () => {},
    addComment: async () => {},
    setAssignee: async () => {},
    listPullRequests: async () => [],
    createPullRequest: async () => { throw new Error(msg); },
    mergePullRequest: async () => {},
    createBranch: async () => {},
  } as ReturnType<typeof createPlatformAdapter>;
}

// ── gh Copilot Preflight ─────────────────────────────────────────

/** Verify the copilot CLI is available. */
async function checkCopilotCli(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    execFile('copilot', ['--version'], { shell: process.platform === 'win32', timeout: 5000 }, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

// ── Main Entry Point ─────────────────────────────────────────────

/**
 * Run the loop command.
 *
 * @param dest     - Working directory (typically process.cwd()).
 * @param options  - CLI-parsed config overrides.
 */
export async function runLoop(dest: string, options: LoopConfig): Promise<void> {
  const workTreeRoot = path.resolve(dest);

  // Detect squad directory (must exist) — follows external state if configured
  const { local: squadDirInfo, stateDir } = effectiveSquadDir(workTreeRoot);
  const teamMd = path.join(stateDir, 'team.md');
  const teamRoot = path.dirname(squadDirInfo.path);

  if (!existsSync(teamMd)) {
    fatal('No squad found — run `squad init` first.');
  }

  // Locate loop.md relative to the same work tree used for execution
  const loopFilePath = options.filePath
    ? path.resolve(workTreeRoot, options.filePath)
    : path.join(workTreeRoot, 'loop.md');

  if (!existsSync(loopFilePath)) {
    console.log(`\n💤 No loop.md found. Create one with: ${BOLD}squad loop --init${RESET}`);
    return;
  }

  // Parse loop file
  const content = readFileSync(loopFilePath, 'utf-8');
  const { frontmatter, prompt } = parseLoopFile(content);

  const isOnboarding = !frontmatter.configured;

  if (isOnboarding) {
    console.log(
      `\n${GREEN}🚀${RESET} ${BOLD}Onboarding mode${RESET} —
```

### Core Architecture Module: `packages/squad-cli/src/cli/commands/state-mcp.ts`
```
import { stdout, stderr } from 'node:process';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { resolveSquadState } from '@bradygaster/squad-sdk';
import { ToolRegistry } from '@bradygaster/squad-sdk/tools';

export type JsonRpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: unknown;
};

type JsonRpcResponse = {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

const SERVER_INFO = {
  name: 'squad-state',
  version: '0.1.0',
};

const MCP_TOOL_ALIASES: Record<string, string> = {
  squad_decide: 'squad_decide',
  squad_state_read: 'squad_state_read',
  squad_state_write: 'squad_state_write',
  squad_state_append: 'squad_state_append',
  squad_state_delete: 'squad_state_delete',
  squad_state_list: 'squad_state_list',
  squad_state_health: 'squad_state_health',
  'memory.classify': 'memory.classify',
  'memory.write': 'memory.write',
  'memory.search': 'memory.search',
  'memory.promote': 'memory.promote',
  'memory.delete': 'memory.delete',
  'memory.audit': 'memory.audit',
};

function parseObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function encodeMessage(message: JsonRpcResponse | Record<string, unknown>): string {
  const body = JSON.stringify(message);
  const length = Buffer.byteLength(body, 'utf8');
  return `Content-Length: ${length}\r\n\r\n${body}`;
}

function writeMessage(message: JsonRpcResponse | Record<string, unknown>): void {
  stdout.write(encodeMessage(message));
}

function success(id: JsonRpcRequest['id'], result: unknown): void {
  writeMessage({ jsonrpc: '2.0', id: id ?? null, result });
}

function failure(id: JsonRpcRequest['id'], code: number, message: string, data?: unknown): void {
  writeMessage({ jsonrpc: '2.0', id: id ?? null, error: { code, message, data } });
}

export function createStateMcpToolRegistry(startDir: string): ToolRegistry {
  const context = resolveSquadState(startDir);
  if (!context) {
    throw new Error(`No .squad directory found from ${startDir}`);
  }
  return new ToolRegistry(context.paths.teamSquadDir, undefined, context.storage);
}

function normalizeToolResult(result: unknown): { content: Array<{ type: 'text'; text: string }>; isError?: boolean } {
  if (typeof result === 'string') {
    return { content: [{ type: 'text', text: result }] };
  }

  const record = parseObject(result);
  const resultType = typeof record['resultType'] === 'string' ? record['resultType'] : undefined;
  const text = typeof record['textResultForLlm'] === 'string'
    ? record['textResultForLlm']
    : JSON.stringify(result);

  return {
    content: [{ type: 'text', text }],
    isError: resultType === 'failure' || resultType === 'denied' || resultType === 'rejected',
  };
}

export function createStateMcpSession(
  startDir = process.cwd(),
  write: (message: JsonRpcResponse | Record<string, unknown>) => void = writeMessage,
): { handleRequest(request: JsonRpcRequest): Promise<void> } {
  const registry = createStateMcpToolRegistry(startDir);
  const runtimeTools = new Map(registry.getTools().map(tool => [tool.name, tool]));
  const tools = Object.entries(MCP_TOOL_ALIASES).map(([mcpName, runtimeName]) => {
    const tool = runtimeTools.get(runtimeName);
    if (!tool) throw new Error(`Missing Squad runtime state tool: ${runtimeName}`);
    return { mcpName, runtimeName, tool };
  });
  const toolMap = new Map(tools.map(entry => [entry.mcpName, entry]));

  async function handleRequest(request: JsonRpcRequest): Promise<void> {
    try {
      switch (request.method) {
        case 'initialize':
          write({ jsonrpc: '2.0', id: request.id ?? null, result: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            serverInfo: SERVER_INFO,
          } });
          break;

        case 'notifications/initialized':
          break;

        case 'tools/list':
          write({ jsonrpc: '2.0', id: request.id ?? null, result: {
            tools: tools.map(tool => ({
              name: tool.mcpName,
              description: tool.tool.description,
              inputSchema: tool.tool.parameters,
            })),
          } });
          break;

        case 'tools/call': {
          const params = parseObject(request.params);
          const name = typeof params['name'] === 'string' ? params['name'] : '';
          const entry = toolMap.get(name);
          if (!entry) {
            write({ jsonrpc: '2.0', id: request.id ?? null, error: { code: -32602, message: `Unknown Squad state tool: ${name}` } });
            break;
          }
          const args = parseObject(params['arguments']);
          const result = await entry.tool.handler(args, {
            toolName: entry.runtimeName,
            toolCallId: `${entry.mcpName}-${Date.now()}`,
            arguments: args,
            sessionId: 'mcp',
          });
          write({ jsonrpc: '2.0', id: request.id ?? null, result: normalizeToolResult(result) });
          break;
        }

        default:
          if (request.id !== undefined && request.id !== null) {
            write({ jsonrpc: '2.0', id: request.id, error: { code: -32601, message: `Method not found: ${request.method ?? '(missing)'}` } });
          }
          break;
      }
    } catch (error) {
      write({ jsonrpc: '2.0', id: request.id ?? null, error: { code: -32603, message: error instanceof Error ? error.message : String(error) } });
    }
  }

  return { handleRequest };
}

export async function runStateMcp(startDir = process.cwd()): Promise<void> {
  // Lazy initialization: resolve state on first tool call, not at startup (#1353)
  // This ensures the MCP server connects quickly and doesn't block other MCPs
  let registry: ToolRegistry | undefined;
  let initError: Error | undefined;

  function getRegistry(): ToolRegistry {
    if (initError) throw initError;
    if (!registry) {
      try {
        registry = createStateMcpToolRegistry(startDir);
      } catch (err) {
        initError = err instanceof Error ? err : new Error(String(err));
        throw initError;
      }
    }
    return registry;
  }

  const server = new Server(SERVER_INFO, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, () => {
    const reg = getRegistry();
    const runtimeTools = new Map(reg.getTools().map(tool => [tool.name, tool]));
    const tools = Object.entries(MCP_TOOL_ALIASES).map(([mcpName, runtimeName]) => {
      const tool = runtimeTools.get(runtimeName);
      if (!tool) throw new Error(`Missing Squad runtime state tool: ${runtimeName}`);
      return { mcpName, runtimeName, tool };
    });
    return {
      tools: tools.map(tool => ({
        name: tool.mcpName,
        description: tool.tool.description,
        inputSchema: tool.tool.parameters as {
          type: 'object';
          properties?: Record<string, object>;
          required?: string[];
        },
      })),
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async request => {
    const reg = getRegistry();
    const runtimeTools = new Map(reg.getTools().map(tool => [tool.name, tool]));
    const tools = Object.entries(MCP_TOOL_ALIASES).map(([mcpName, runtimeName]) => {
      const tool = runtimeTools.get(runtimeName);
      if (!tool) throw new Error(`Missing Squad runtime state tool: ${runtimeName}`);
      return { mcpName, runtimeName, tool };
    });
    const toolMap = new Map(tools.map(entry => [entry.mcpName, entry]));

    const entry = toolMap.get(request.params.name);
    if (!entry) {
      throw new Error(`Unknown Squad state tool: ${request.params.name}`);
    }
    const args = parseObject(request.params.arguments);
    const result = await entry.tool.handler(args, {
      toolName: entry.runtimeName,
      toolCallId: `${entry.mcpName}-${Date.now()}`,
      arguments: args,
      sessionId: 'mcp',
    });
    return normalizeToolResult(result);
  });

  await server.connect(new StdioServerTransport());
}

export function printStateMcpHelp(): void {
  stderr.write([
    'squad state-mcp — MCP bridge for Squad runtime state tools',
    '',
    'Usage: squad state-mcp',
    '',
    'This command is intended to be launched by GitHub Copilot CLI through',
    '.copilot/mcp-config.json. It exposes squad_decide and state.* tools',
    'backed by the configured Squad state backend.',
    '',
  ].join('\n'));
}

```

### Core Architecture Module: `packages/squad-cli/src/cli/core/cast.ts`
```
/**
 * Team casting engine — parses coordinator team proposals and scaffolds agent files.
 * @module cli/core/cast
 */

import { join } from 'node:path';
import { FSStorageProvider } from '@bradygaster/squad-sdk';
import {
  getRoleById,
  generateCharterFromRole,
  addAgentToConfig,
  syncTeamCapabilities,
} from '@bradygaster/squad-sdk';
import {
  CastingEngine,
  acquireCastingRegistryLockAsync,
  commitCastingRegistryPair,
  prepareCastingRegistryPairLocked,
  readCastingRegistryPair,
  recoverCastingRegistryTransaction,
  reconcileAgentProvenanceRegistry,
  type CastMember as EngineCastMember,
  type AgentRole as EngineAgentRole,
} from '@bradygaster/squad-sdk/casting';
import { getTemplatesDir } from './templates.js';
import { hasCopilot, insertCopilotSection } from './team-md.js';

// ── RAI Policy Template ────────────────────────────────────────────

const RAI_POLICY_TEMPLATE = `# RAI Policy

> Responsible AI policy for this project. Rai enforces these standards.

## Critical Violations (Always Blocked)

- Hardcoded credentials, API keys, tokens, passwords
- SQL injection, command injection, path traversal
- Harmful content (hate speech, violence, self-harm)
- Deceptive content (ungrounded claims, hallucinated citations)
- Instructions that bypass AI safety guidelines

## Advisory Concerns (Flagged, Not Blocked)

- PII in logs or responses
- Bias indicators in algorithms
- Exclusionary language
- Missing rate limiting on user-facing endpoints
- Insufficient input validation

## Terminology Standards

| Avoid | Prefer |
|-------|--------|
| whitelist/blacklist | allowlist/blocklist |
| master/slave | primary/replica |
| sanity check | validation, smoke test |
| dummy value | placeholder, sample |

## Opt-Out Model

- Cannot disable critical checks (credentials, harmful content, injection)
- Can disable advisory checks with justification logged to audit trail
- Temporary opt-down supported (auto re-enables after 30 days)
`;

// ── Types ──────────────────────────────────────────────────────────

export interface CastMember {
  /** Immutable producer-owned id. Required when renaming an existing agent. */
  id?: string;
  name: string;
  role: string;
  scope: string;
  emoji: string;
}

export interface CastProposal {
  members: CastMember[];
  universe: string;
  projectDescription: string;
}

export interface CastResult {
  teamRoot: string;
  membersCreated: string[];
  filesCreated: string[];
}

// ── Emoji mapping ──────────────────────────────────────────────────

const ROLE_EMOJI_MAP: [RegExp, string][] = [
  [/lead|architect|tech\s*lead/i, '🏗️'],
  [/frontend|ui|design/i, '⚛️'],
  [/backend|api|server/i, '🔧'],
  [/test|qa|quality/i, '🧪'],
  [/devops|infra|platform/i, '⚙️'],
  [/docs|devrel|writer/i, '📝'],
  [/data|database|analytics/i, '📊'],
  [/security|auth/i, '🔒'],
];

/** Map a role string to its emoji. Exported for reuse. */
export function roleToEmoji(role: string): string {
  for (const [pattern, emoji] of ROLE_EMOJI_MAP) {
    if (pattern.test(role)) return emoji;
  }
  return '👤';
}

// ── Parser ─────────────────────────────────────────────────────────

/**
 * Parse a team proposal from the coordinator's response.
 * Handles multiple formats:
 *   1. Strict INIT_TEAM: format
 *   2. Markdown code blocks wrapping INIT_TEAM
 *   3. Pipe-delimited lines without INIT_TEAM header
 *   4. Emoji-prefixed role lines (🏗️ Name — Role  Scope)
 * Returns null only if no team members could be extracted.
 */
export function parseCastResponse(response: string): CastProposal | null {
  // Strip markdown code fences if present
  let cleaned = response.replace(/```[\s\S]*?```/g, (match) => {
    return match.replace(/^```\w*\n?/, '').replace(/\n?```$/, '');
  });

  // Also try without code fence stripping
  const candidates = [cleaned, response];

  for (const text of candidates) {
    const result = tryParseInitTeam(text);
    if (result && result.members.length > 0) return result;
  }

  // Fallback: try to extract pipe-delimited lines anywhere in the response
  const fallback = tryParsePipeLines(response);
  if (fallback && fallback.members.length > 0) return fallback;

  // Last resort: try emoji-prefixed lines (🏗️ Name — Role  Scope)
  const emojiResult = tryParseEmojiLines(response);
  if (emojiResult && emojiResult.members.length > 0) return emojiResult;

  return null;
}

function tryParseInitTeam(text: string): CastProposal | null {
  const initIdx = text.indexOf('INIT_TEAM:');
  // Also try "INIT_TEAM" without colon, and case-insensitive
  const altIdx = initIdx === -1 ? text.search(/INIT_TEAM\s*:?/i) : initIdx;
  if (altIdx === -1) return null;

  const block = text.slice(altIdx);
  return extractFromBlock(block);
}

function tryParsePipeLines(text: string): CastProposal | null {
  // Look for lines with pipe separators: "- Name | Role | Scope" or "Name | Role | Scope"
  const lines = text.split('\n');
  const members: CastMember[] = [];
  let universe = '';
  let projectDescription = '';

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip table headers and separators
    if (trimmed.match(/^\|?\s*Name\s*\|/i)) continue;
    if (trimmed.match(/^\|?\s*-+\s*\|/)) continue;

    // Match: "- Name | Role | Scope" or "* Name | Role | Scope" or just "Name | Role | Scope"
    const pipeMatch = trimmed.match(/^[-*•]?\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+)/);
    if (pipeMatch) {
      const name = pipeMatch[1]!.trim();
      const role = pipeMatch[2]!.trim();
      const scope = pipeMatch[3]!.trim().replace(/\|.*$/, '').trim(); // remove trailing pipes
      if (name && role && !/^-+$/.test(name)) {
        members.push({ name, role, scope, emoji: roleToEmoji(role) });
      }
    }

    const universeMatch = trimmed.match(/^(?:\*\*)?Universe(?:\*\*)?:?\s*(.+)/i);
    if (universeMatch) universe = universeMatch[1]!.trim();

    const projectMatch = trimmed.match(/^(?:\*\*)?Project(?:\*\*)?:?\s*(.+)/i);
    if (projectMatch) projectDescription = projectMatch[1]!.trim();
  }

  if (members.length === 0) return null;
  return { members, universe: universe || 'Unknown', projectDescription: projectDescription || 'User project' };
}

function tryParseEmojiLines(text: string): CastProposal | null {
  // Match lines like: 🏗️ Ripley — Lead   Architecture, code review
  // or: 🏗️  Ripley  — Lead          Scope, decisions
  const lines = text.split('\n');
  const members: CastMember[] = [];
  let universe = '';
  let projectDescription = '';

  for (const line of lines) {
    const trimmed = line.trim();
    // Match emoji + name + dash/emdash + role + optional scope
    const emojiMatch = trimmed.match(/^[^\w\s][\uFE0F]?\s+(\w+)\s+[—–-]\s+(.+)/);
    if (emojiMatch) {
      const name = emojiMatch[1]!.trim();
      const rest = emojiMatch[2]!.trim();
      // Split rest into role and scope (role is first word(s) before double space or tab)
      const roleScopeMatch = rest.match(/^(.+?)\s{2,}(.+)$/);
      if (roleScopeMatch) {
        const role = roleScopeMatch[1]!.trim();
        const scope = roleScopeMatch[2]!.trim();
        members.push({ name, role, scope, emoji: roleToEmoji(role) });
      } else {
        // No clear scope separation — treat whole rest as role
        members.push({ name, role: rest, scope: rest, emoji: roleToEmoji(rest) });
      }
    }

    const universeMatch = trimmed.match(/Universe:?\s*(.+)/i);
    if (universeMatch && !trimmed.includes('|')) universe = universeMatch[1]!.trim();

    const projectMatch = trimmed.match(/Project:?\s*(.+)/i);
    if (projectMatch && !trimmed.includes('|')) projectDescription = projectMatch[1]!.trim();
  }

  if (members.length === 0) return null;
  return { members, universe: universe || 'Unknown', projectDescription: projectDescription || 'User project' };
}

function extractFromBlock(block: string): CastProposal | null {
  const lines = block.split('\n').map(l => l.trim()).filter(Boolean);

  const members: CastMember[] = [];
  let universe = '';
  let projectDescription = '';

  for (const line of lines) {
    // Member line: - Name | Role | Scope
    if (line.startsWith('-') && line.includes('|')) {
      const parts = line.slice(1).split('|').map(s => s.trim());
      if (parts.length >= 3) {
        const name = parts[0]!;
        const role = parts[1]!;
        const scope = parts[2]!;
        members.push({ name, role, scope, emoji: roleToEmoji(role) });
      }
    }

    // Also handle * bullets
    if (line.startsWith('*') && line.includes('|')) {
      const parts = line.slice(1).split('|').map(s => s.trim());
      if (parts.length >= 3) {
        members.push({ name: parts[0]!, role: parts[1]!, scope: parts[2]!, emoji: roleToEmoji(parts[1]!) });
      }
    }

    // UNIVERSE: line (handles **UNIVERSE:** and **UNIVERSE**: formats)
    const universeMatch = line.match(/^(?:\*\*)?UNIVERSE(?:\*\*)?:?\s*(?:\*\*)?\s*(.+)/i);
    if (universeMatch) {
      universe = universeMatch[1]!.replace(/^\*\*\s*/, '').trim();
    }

    // PROJECT: line
    const projectMatch = line.match(/^(?:\*\*)?PROJECT(?:\*\*)?:?\s*(?:\*\*)?\s*(.+)/i);
    if (projectMatch) {
      projectDescription = projectMatch[1]!.replace(/^\*\*\s*/, '').trim();
    }
  }

  if (members.length === 0) return null;
  return { members, universe: universe || 'Unknown', projectDescription: projectDescription || 'User project' };
}

// ── CastingEngine Integration ──────────────────────────────────────

/**
 * Augment a parsed CastProposal with CastingEngine data if universe is recognized.
 * Maps LLM-proposed universe names to engine universe IDs, then uses the engine to:
 * - Allocate character names from the curated pool
 * - Inject template personalities and backstorie
```

### Core Architecture Module: `packages/squad-cli/src/cli/core/command-help.ts`
```
/**
 * Per-command help text for `squad <cmd> --help` / `-h`.
 *
 * Fixes #1201: previously `--help` after a subcommand was silently dropped
 * by the CLI router and the command would execute for real, sometimes with
 * destructive side effects (`squad init --help` would scaffold files into
 * the cwd, `squad triage --help` / `watch --help` would start a polling
 * loop, etc.).
 *
 * The entry point in `cli-entry.ts` intercepts `--help`/`-h` whenever it
 * appears on a subcommand and calls `printCommandHelp(cmd, version)`. If
 * the command has a dedicated help block, it is printed and `true` is
 * returned. Otherwise `false` is returned so the caller can show a generic
 * fallback that points users at the top-level `squad help`.
 */

/* eslint-disable no-console -- help printers stream to stdout via console.log,
   matching the style of the top-level help block in cli-entry.ts. */

import { BOLD, DIM, RESET } from './output.js';

type HelpPrinter = (version: string) => void;

function header(cmd: string, version: string, tagline: string): void {
  console.log(`\n${BOLD}squad ${cmd}${RESET} v${version} — ${tagline}\n`);
}

/**
 * Registry of per-command help printers. Adding a new command here is the
 * one place that needs updating when a new subcommand is added to the CLI.
 */
const COMMAND_HELP: Record<string, HelpPrinter> = {
  init: (version) => {
    header('init', version, 'Initialize Squad in the current project');
    console.log(`Usage: squad init [options]`);
    console.log(`       squad init --mode remote <team-repo-path>\n`);
    console.log(`Creates a markdown-based squad layout under .squad/ plus default agent`);
    console.log(`workflows under .github/. Safe to re-run — existing files are preserved.\n`);
    console.log(`Options:`);
    console.log(`  ${BOLD}--sdk${RESET}                       Use SDK builder syntax (squad.config.ts)`);
    console.log(`  ${BOLD}--roles${RESET}                     Seed the team with built-in base roles`);
    console.log(`  ${BOLD}--global${RESET}                    Initialize in the personal (global) squad directory`);
    console.log(`  ${BOLD}--no-workflows${RESET}              Skip writing GitHub Actions workflows`);
    console.log(`  ${BOLD}--preset <name>${RESET}             Apply a curated preset after init`);
    console.log(`  ${BOLD}--state-backend <type>${RESET}      State backend (local|orphan|two-layer)`);
    console.log(`  ${BOLD}--mode remote <path>${RESET}        Point at an external team root (creates .squad/config.json)\n`);
  },

  upgrade: (version) => {
    header('upgrade', version, 'Update Squad-owned files to the latest version');
    console.log(`Usage: squad upgrade [options]\n`);
    console.log(`Overwrites Squad-owned files (squad.agent.md, .squad/templates/) while`);
    console.log(`leaving your team state under .squad/ and .ai-team/ untouched.\n`);
    console.log(`Local customizations to squad.agent.md are backed up automatically.`);
    console.log(`Use --dry-run to preview changes before applying.\n`);
    console.log(`Options:`);
    console.log(`  ${BOLD}--dry-run${RESET}                   Preview changes without writing`);
    console.log(`  ${BOLD}--global${RESET}                    Upgrade the personal (global) squad`);
    console.log(`  ${BOLD}--migrate-directory${RESET}         Rename legacy .ai-team/ to .squad/`);
    console.log(`  ${BOLD}--state-backend <type>${RESET}      Migrate to a new backend (orphan|two-layer)`);
    console.log(`  ${BOLD}--self${RESET}                      Upgrade the squad CLI package itself`);
    console.log(`  ${BOLD}--insider${RESET}                   With --self, install the @insider tag`);
    console.log(`  ${BOLD}--force${RESET}                     Overwrite files without prompting\n`);
  },

  'update-check': (version) => {
    header('update-check', version, 'Report cached CLI update status');
    console.log(`Usage: squad update-check [options]\n`);
    console.log(`Reads the update-check cache maintained in the background by the CLI`);
    console.log(`and reports it without making a network call, unless --refresh is used.\n`);
    console.log(`Options:`);
    console.log(`  ${BOLD}--json${RESET}                      Emit structured JSON instead of text`);
    console.log(`  ${BOLD}--refresh${RESET}                   Bypass the cache and re-fetch from npm\n`);
    console.log(`Exit codes: 0 (up to date / no cache yet), 1 (update available),`);
    console.log(`            2 (transport failure during --refresh)\n`);
  },

  migrate: (version) => {
    header('migrate', version, 'Convert between markdown and SDK-First squad formats');
    console.log(`Usage: squad migrate --to sdk|markdown [options]\n`);
    console.log(`Options:`);
    console.log(`  ${BOLD}--to sdk|markdown${RESET}           Target format`);
    console.log(`  ${BOLD}--from ai-team${RESET}              Source format (defaults to current)`);
    console.log(`  ${BOLD}--dry-run${RESET}                   Show planned changes without writing\n`);
  },

  status: (version) => {
    header('status', version, 'Show which squad is active and why');
    console.log(`Usage: squad status\n`);
    console.log(`Reports the resolved squad directory, the resolution reason (repo vs.`);
    console.log(`global), and the state of the personal squad path.\n`);
  },

  roles: (version) => {
    header('roles', version, 'List built-in Squad roles');
    console.log(`Usage: squad roles [--category <name>] [--search <query>]\n`);
    console.log(`Options:`);
    console.log(`  ${BOLD}--category <name>${RESET}           Filter to a single category`);
    console.log(`  ${BOLD}--search <query>${RESET}            Match role name or description\n`);
  },

  cost: (version) => {
    header('cost', version, 'Report token usage from orchestration logs');
    console.log(`Usage: squad cost [options]\n`);
    console.log(`Options:`);
    console.log(`  ${BOLD}--all${RESET}                       Include all logged sessions, not just recent`);
    console.log(`  ${BOLD}--agent <name>${RESET}              Filter to a single agent\n`);
  },

  triage: (version) => printWatchHelp('triage', version),
  watch: (version) => printWatchHelp('watch', version),

  loop: (version) => {
    header('loop', version, 'Prompt-driven continuous work loop');
    console.log(`Usage: squad loop [options]\n`);
    console.log(`Reads loop.md and runs it as a continuous work loop.\n`);
    console.log(`Options:`);
    console.log(`  ${BOLD}--init${RESET}                Generate a boilerplate loop.md`);
    console.log(`  ${BOLD}--file <path>${RESET}         Path to loop file (default: loop.md)`);
    console.log(`  ${BOLD}--interval <min>${RESET}      Override loop interval in minutes`);
    console.log(`  ${BOLD}--timeout <min>${RESET}       Override max minutes per cycle`);
    console.log(`  ${BOLD}--copilot-flags "..."${RESET} Extra flags for Copilot CLI`);
    console.log(`  ${BOLD}--agent-cmd <cmd>${RESET}     Override the agent command`);
    console.log(`\nCapabilities (composable with the loop):`);
    console.log(`  ${BOLD}--self-pull${RESET}           git fetch/pull at round start`);
    console.log(`  ${BOLD}--monitor-email${RESET}       Scan email for actionable items`);
    console.log(`  ${BOLD}--monitor-teams${RESET}       Scan Teams for actionable messages`);
    console.log(`  ${BOLD}--decision-hygiene${RESET}    Auto-merge decision inbox`);
    console.log(`  ${BOLD}--retro${RESET}               Enforce retrospective checks`);
    console.log(`\nFrontmatter (in loop.md):`);
    console.log(`  configured: true     ${DIM}(required — confirms intentional setup)${RESET}`);
    console.log(`  interval: 10         ${DIM}(minutes between cycles)${RESET}`);
    console.log(`  timeout: 30          ${DIM}(max minutes per cycle)${RESET}`);
    console.log(`  description: "..."   ${DIM}(shown in status output)${RESET}`);
    console.log(`\nExamples:`);
    console.log(`  squad loop                          ${DIM}# run loop.md${RESET}`);
    console.log(`  squad loop --init                   ${DIM}# generate boilerplate${RESET}`);
    console.log(`  squad loop --file ops/loop.md       ${DIM}# custom loop file${RESET}`);
    console.log(`  squad loop --monitor-email          ${DIM}# with email monitoring${RESET}`);
  },

  cast: (version) => {
    header('cast', version, 'Show roster or add a new agent to the team');
    console.log(`Usage: squad cast                        ${DIM}# show the current cast (roster)${RESET}`);
    console.log(`       squad cast --name <name> --role <role>  ${DIM}# add a new agent${RESET}\n`);
    console.log(`With no flags, displays the current session cast (project + personal agents).`);
    console.log(`With --name/--role, launches the team creation wizard.\n`);
    console.log(`Options:`);
    console.log(`  ${BOLD}--name <name>${RESET}               Pre-fill the agent name`);
    console.log(`  ${BOLD}--role <role>${RESET}               Pre-select a built-in role (see 'squad roles')`);
    console.log(`\nAlias: ${BOLD}squad hire${RESET} (always runs the creation wizard)\n`);
  },

  copilot: (version) => {
    header('copilot', version, 'Add or remove the Copilot coding agent (@copilot)');
    console.log(`Usage: squad copilot [--off] [--auto-assign]\n`);
    console.log(`Options:`);
    console.log(`  ${BOLD}--off${RESET}                       Remove the @copilot agent from the team`);
    console.log(`  ${BOLD}--auto-assign${RESET}               Configure auto-assignment of issues to @copilot\n`);
  },

  plugin: (version) => {
    header('plugin', version, 'Manage plugin marketplaces');
    console.log(`Usage: squad plugin marketplace add|remove|list|browse\n`);
    console.log(`Subcommands:`);
    console.log(`  ${BOLD}marketplace add <url>${RESET}       Register a plugin marketplace`);
    console.log(`  ${BOLD}marketplace remove <name>${RESET}   Unregister a marketplace`);
    console.log(`  ${BOLD}marketplace list${RESE
```

### Core Architecture Module: `packages/squad-cli/src/cli/core/copilot-invocation.ts`
```
/**
 * Helpers for spawning the Copilot CLI from squad-managed code paths.
 *
 * Background — iter-9 finding: Copilot CLI 1.0.59 does NOT auto-load the
 * workspace `.mcp.json` in non-interactive (`-p`) mode due to a folder-trust
 * security gate (`FH.isFolderTrusted()`). The gate cannot be satisfied without
 * a UI prompt, so the `squad_state` MCP entry written by `squad init` /
 * `squad upgrade` to the repo-root `.mcp.json` is silently ignored every time
 * squad spawns `copilot -p` — leaving `squad_state_*` tools unwired.
 *
 * Mitigation: every squad-internal `copilot` spawn prepends two flags:
 *   1. `--yolo`  — suppresses the per-tool-call consent prompt that would
 *      otherwise block non-interactive (`-p`) automation.
 *   2. `--additional-mcp-config @<abs-path>`  — explicitly loads the project's
 *      `.mcp.json` so `squad_state_*` tools register for that session.
 *
 * We only inject when:
 *  - the command being spawned is the bare `copilot` binary (i.e. the user
 *    did not override via `--agent-cmd`)
 *  - a `.mcp.json` file actually exists at `teamRoot`
 *
 * Empirical test matrix (Copilot CLI 1.0.59):
 *   copilot -p "..."                                      → ❌ workspace MCP NOT loaded
 *   copilot --yolo -p "..."                               → ❌ workspace MCP NOT loaded
 *   copilot --yolo --autopilot -p "..."                   → ❌ workspace MCP NOT loaded
 *   copilot --additional-mcp-config @.mcp.json --yolo -p  → ✅ PROVEN WORKAROUND
 *   interactive copilot → "Trust folder?" → Yes           → ✅ loads (not automatable)
 *
 * See `.squad/files/validation/COMBINED-FIX-BRANCH-MANIFEST.md` (iter-9) for
 * the full empirical proof that this exact flag combination is required.
 */

import path from 'node:path';
import { existsSync } from 'node:fs';

/**
 * Build the extra CLI args needed to make the Copilot CLI load this project's
 * `.mcp.json` for a non-interactive (`-p`) spawned session.
 *
 * Returns `['--yolo', '--additional-mcp-config', '@<abs-path>']` when
 * injection is applicable, or an empty array when:
 *  - a custom agent command was specified (not the bare `copilot` binary), or
 *  - `teamRoot` is falsy, or
 *  - `.mcp.json` does not exist under `teamRoot` (squad init not run, repo
 *    downgraded, etc.) — a console warning is emitted in that case.
 *
 * The `@<path>` form is used (rather than inline JSON) to avoid argv quoting
 * issues with multi-line JSON on Windows.
 */
export function buildAdditionalMcpConfigArgs(cmd: string, teamRoot: string | undefined): string[] {
  if (cmd !== 'copilot') return [];
  if (!teamRoot) return [];
  const configPath = path.join(teamRoot, '.mcp.json');
  try {
    if (!existsSync(configPath)) {
      console.warn(
        `[squad] ⚠  .mcp.json not found at ${configPath}. ` +
          `Run \`squad init\` or \`squad upgrade\` to create it. ` +
          `squad_state_* tools will NOT be available in this session.`,
      );
      return [];
    }
  } catch {
    return [];
  }
  return ['--yolo', '--additional-mcp-config', `@${configPath}`];
}

/**
 * Prepend the MCP-config + yolo args to `args`. Returns the full argv list to
 * pass to spawn/execFile for the given cmd. The injection slots these flags
 * BEFORE other args so positional `-p <prompt>` still works correctly.
 *
 * If `--yolo` is already present in `args` (e.g. user supplied it via
 * `copilotFlags`), the duplicate is stripped from `args` before prepending to
 * avoid passing `--yolo` twice.
 */
export function withAdditionalMcpConfig(
  cmd: string,
  args: string[],
  teamRoot: string | undefined,
): string[] {
  const extra = buildAdditionalMcpConfigArgs(cmd, teamRoot);
  if (extra.length === 0) return args;
  // Strip any user-supplied --yolo to avoid passing it twice.
  const cleanArgs = args.filter(a => a !== '--yolo');
  return [...extra, ...cleanArgs];
}

```

### Core Architecture Module: `packages/squad-cli/src/cli/core/detect-squad-dir.ts`
```
/**
 * Squad directory detection — zero dependencies
 */

import fs from 'node:fs';
import path from 'node:path';

export interface SquadDirInfo {
  path: string;
  name: '.squad' | '.ai-team';
  isLegacy: boolean;
}

/**
 * If `dir` has a `.git` worktree pointer file, parse it and return the
 * absolute path of the main checkout. Returns `null` otherwise.
 *
 * The `.git` file format is: `gitdir: <path-to-.git/worktrees/name>`
 */
export function resolveWorktreeMainCheckout(dir: string): string | null {
  const gitPath = path.join(dir, '.git');
  try {
    if (fs.statSync(gitPath).isDirectory()) return null;
    const content = fs.readFileSync(gitPath, 'utf-8').trim();
    const match = content.match(/^gitdir:\s*(.+)$/m);
    if (!match || !match[1]) return null;
    const worktreeGitDir = path.resolve(dir, match[1].trim());
    // worktreeGitDir = /main/.git/worktrees/name
    // mainGitDir     = /main/.git   (up 2 levels)
    // mainCheckout   = /main        (dirname of mainGitDir)
    const mainGitDir = path.resolve(worktreeGitDir, '..', '..');
    const mainCheckout = path.dirname(mainGitDir);
    // Verify the derived main checkout is a real git repo
    if (!fs.existsSync(mainGitDir) || !fs.statSync(mainGitDir).isDirectory()) {
      return null;
    }
    return mainCheckout;
  } catch {
    return null;
  }
}

/**
 * Detect squad directory — .squad/ first, fall back to .ai-team/
 *
 * Worktree-aware: when neither directory exists at `dest`, checks if `dest`
 * is a git worktree and looks in the main checkout as a fallback.
 */
export function detectSquadDir(dest: string): SquadDirInfo {
  const squadDir = path.join(dest, '.squad');
  const aiTeamDir = path.join(dest, '.ai-team');

  if (fs.existsSync(squadDir)) {
    return { path: squadDir, name: '.squad', isLegacy: false };
  }
  if (fs.existsSync(aiTeamDir)) {
    return { path: aiTeamDir, name: '.ai-team', isLegacy: true };
  }

  // Worktree fallback: check the main checkout when dest has a .git pointer file
  const mainCheckout = resolveWorktreeMainCheckout(dest);
  if (mainCheckout) {
    const mainSquadDir = path.join(mainCheckout, '.squad');
    const mainAiTeamDir = path.join(mainCheckout, '.ai-team');
    if (fs.existsSync(mainSquadDir)) {
      return { path: mainSquadDir, name: '.squad', isLegacy: false };
    }
    if (fs.existsSync(mainAiTeamDir)) {
      return { path: mainAiTeamDir, name: '.ai-team', isLegacy: true };
    }
  }

  // Default for new installations
  return { path: squadDir, name: '.squad', isLegacy: false };
}

```

### Core Architecture Module: `packages/squad-cli/src/cli/core/effective-squad-dir.ts`
```
/**
 * Effective squad directory resolution — external state aware.
 *
 * Wraps detectSquadDir() to follow the config.json stateLocation marker
 * when state has been externalized via `squad externalize`.
 *
 * @module cli/core/effective-squad-dir
 */

import { detectSquadDir, type SquadDirInfo } from './detect-squad-dir.js';
import {
  loadDirConfig,
  resolveExternalStateDir,
} from '@bradygaster/squad-sdk';
import { resolveSquadPaths } from '@bradygaster/squad-sdk/resolution';

/**
 * Resolve the effective state directory from a local .squad/ path.
 *
 * If `.squad/config.json` has `stateLocation: 'external'` and a valid
 * `projectKey`, returns the external state directory. Otherwise returns
 * the original `squadDirPath` unchanged.
 */
export function resolveStateDir(squadDirPath: string): string {
  const config = loadDirConfig(squadDirPath);
  if (config?.stateLocation === 'external' && config.projectKey) {
    return resolveExternalStateDir(config.projectKey, false);
  }
  return squadDirPath;
}

export interface EffectiveSquadDirs {
  /** The local .squad/ directory info (for config.json and non-state files) */
  local: SquadDirInfo;
  /** The effective state directory (external dir when externalized, otherwise local .squad/) */
  stateDir: string;
  /** Directory whose config declares the active state backend */
  backendConfigDir: string;
}

/**
 * Detect the squad directory and resolve the effective state dir.
 *
 * Combines detectSquadDir() (zero-dependency bootstrap) with external
 * state resolution from config.json. Use `stateDir` for reading state
 * files (team.md, routing.md, agents/, plugins/, etc.) and `local.path`
 * for non-state files that remain in the working tree.
 */
export function effectiveSquadDir(dest: string): EffectiveSquadDirs {
  const local = detectSquadDir(dest);
  const paths = resolveSquadPaths(dest);
  const teamSquadDir =
    paths?.mode === 'remote'
      ? paths.teamSquadDir
      : local.path;
  return {
    local,
    stateDir: resolveStateDir(teamSquadDir),
    backendConfigDir: teamSquadDir,
  };
}

```

### Core Architecture Module: `packages/squad-cli/src/cli/core/email-scrub.ts`
```
/**
 * Email scrubbing utility — removes PII from Squad state files
 * @module cli/core/email-scrub
 */

import path from 'node:path';
import { FSStorageProvider } from '@bradygaster/squad-sdk';

const storage = new FSStorageProvider();

const EMAIL_PATTERN = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
const NAME_WITH_EMAIL_PATTERN = /([a-zA-Z0-9_-]+)\s*\(([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\)/g;

/**
 * Scrub email addresses from all files in a directory
 * Returns count of files scrubbed
 */
export async function scrubEmails(dir: string): Promise<number> {
  const scrubbedFiles: string[] = [];
  
  const filesToScrub = [
    'team.md',
    'decisions.md',
    'routing.md',
    'ceremonies.md'
  ];
  
  // Scrub root-level files
  for (const file of filesToScrub) {
    const filePath = path.join(dir, file);
    if (storage.existsSync(filePath)) {
      if (scrubFile(filePath)) {
        scrubbedFiles.push(file);
      }
    }
  }
  
  // Scrub agent history files
  const agentsDir = path.join(dir, 'agents');
  if (storage.existsSync(agentsDir)) {
    try {
      for (const agentName of storage.listSync(agentsDir)) {
        const historyPath = path.join(agentsDir, agentName, 'history.md');
        if (storage.existsSync(historyPath)) {
          if (scrubFile(historyPath)) {
            scrubbedFiles.push(path.join('agents', agentName, 'history.md'));
          }
        }
      }
    } catch {
      // Ignore errors reading agents directory
    }
  }
  
  // Scrub log files
  const logDir = path.join(dir, 'log');
  if (storage.existsSync(logDir)) {
    try {
      const logFiles = storage.listSync(logDir)
        .filter(f => f.endsWith('.md') || f.endsWith('.txt') || f.endsWith('.log'));
      
      for (const file of logFiles) {
        const filePath = path.join(logDir, file);
        if (scrubFile(filePath)) {
          scrubbedFiles.push(path.join('log', file));
        }
      }
    } catch {
      // Ignore errors reading log directory
    }
  }
  
  return scrubbedFiles.length;
}

/**
 * Scrub emails from a single file
 * Returns true if file was modified
 */
function scrubFile(filePath: string): boolean {
  try {
    let content = storage.readSync(filePath) ?? '';
    let modified = false;
    
    // Replace "name (email)" → "name"
    const beforeNameEmail = content;
    content = content.replace(NAME_WITH_EMAIL_PATTERN, '$1');
    if (content !== beforeNameEmail) modified = true;
    
    // Replace bare emails in identity contexts (preserve in URLs and code)
    const lines = content.split('\n');
    const scrubbed = lines.map(line => {
      // Skip lines that look like URLs, code blocks, or examples
      if (line.includes('http://') || line.includes('https://') || 
          line.includes('```') || line.includes('example.com') ||
          line.trim().startsWith('//') || line.trim().startsWith('#')) {
        return line;
      }
      
      const before = line;
      const after = line.replace(EMAIL_PATTERN, '[email scrubbed]');
      if (before !== after) modified = true;
      return after;
    });
    
    if (modified) {
      storage.writeSync(filePath, scrubbed.join('\n'));
    }
    
    return modified;
  } catch {
    return false;
  }
}

```

### Core Architecture Module: `packages/squad-cli/src/cli/core/errors.ts`
```
/**
 * Error handling utilities — zero dependencies
 */

/**
 * Error class for fatal CLI errors.
 * CLI entry points catch these and call process.exit(1).
 * Library consumers can catch the SquadError normally.
 */
export class SquadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SquadError';
  }
}

/**
 * Throw a fatal error. In CLI context, the entry point catches and exits.
 * In library context, callers can catch the SquadError normally.
 */
export function fatal(msg: string): never {
  throw new SquadError(msg);
}

```

### Core Architecture Module: `packages/squad-cli/src/cli/core/gh-cli.ts`
```
/**
 * GitHub CLI wrapper utilities — zero dependencies
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface GhIssue {
  number: number;
  title: string;
  body?: string;
  labels: Array<{ name: string }>;
  assignees: Array<{ login: string }>;
}

export interface GhListOptions {
  label?: string;
  state?: 'open' | 'closed' | 'all';
  limit?: number;
}

export interface GhEditOptions {
  addLabel?: string;
  removeLabel?: string;
  addAssignee?: string;
  removeAssignee?: string;
}

export interface GhPullRequest {
  number: number;
  title: string;
  author: { login: string };
  labels: Array<{ name: string }>;
  isDraft: boolean;
  reviewDecision: string;
  state: string;
  headRefName: string;
  statusCheckRollup: Array<{ state: string; name: string }>;
}

export interface GhPrListOptions {
  state?: 'open' | 'closed' | 'merged' | 'all';
  limit?: number;
  label?: string;
}

/**
 * Check if gh CLI is available
 */
export async function ghAvailable(): Promise<boolean> {
  try {
    await execFileAsync('gh', ['--version']);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if gh CLI is authenticated.
 *
 * Uses `gh auth token` instead of `gh auth status` because the latter
 * returns a non-zero exit code when ANY account in the keyring has an
 * invalid token — even if the active account (e.g. via GH_TOKEN) is
 * perfectly fine.  `gh auth token` only checks the active account.
 */
export async function ghAuthenticated(): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync('gh', ['auth', 'token']);
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * List issues with optional filters
 */
export async function ghIssueList(options: GhListOptions = {}): Promise<GhIssue[]> {
  const args = ['issue', 'list', '--json', 'number,title,body,labels,assignees'];
  
  if (options.label) {
    args.push('--label', options.label);
  }
  if (options.state) {
    args.push('--state', options.state);
  }
  if (options.limit) {
    args.push('--limit', String(options.limit));
  }
  
  const { stdout } = await execFileAsync('gh', args);
  return JSON.parse(stdout || '[]');
}

export async function ghPrList(options: GhPrListOptions = {}): Promise<GhPullRequest[]> {
  const args = ['pr', 'list', '--json', 'number,title,author,labels,isDraft,reviewDecision,state,headRefName,statusCheckRollup'];
  
  if (options.state) {
    args.push('--state', options.state);
  }
  if (options.limit) {
    args.push('--limit', String(options.limit));
  }
  if (options.label) {
    args.push('--label', options.label);
  }
  
  const { stdout } = await execFileAsync('gh', args);
  return JSON.parse(stdout || '[]');
}

/**
 * Edit an issue (add/remove labels or assignees)
 */
export async function ghIssueEdit(issueNumber: number, options: GhEditOptions): Promise<void> {
  const args = ['issue', 'edit', String(issueNumber)];
  
  if (options.addLabel) {
    args.push('--add-label', options.addLabel);
  }
  if (options.removeLabel) {
    args.push('--remove-label', options.removeLabel);
  }
  if (options.addAssignee) {
    args.push('--add-assignee', options.addAssignee);
  }
  if (options.removeAssignee) {
    args.push('--remove-assignee', options.removeAssignee);
  }
  
  await execFileAsync('gh', args);
}

// ── Rate limit helpers (#515) ──────────────────────────────────

export interface GhRateLimit {
  remaining: number;
  limit: number;
  resetAt: string;
}

/**
 * Check current GitHub API rate limit via `gh api rate_limit`.
 */
export async function ghRateLimitCheck(): Promise<GhRateLimit> {
  const { stdout } = await execFileAsync('gh', [
    'api', 'rate_limit', '--jq', '.resources.core | {remaining, limit, reset}',
  ]);
  const data = JSON.parse(stdout);
  return {
    remaining: data.remaining,
    limit: data.limit,
    resetAt: new Date(data.reset * 1000).toISOString(),
  };
}

/**
 * Detect if an error is a GitHub rate-limit error (429 or explicit rate-limit messages).
 * Does NOT match bare 403 — that indicates an auth/permissions error, not a transient rate limit.
 */
export function isRateLimitError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return msg.includes('rate limit') || msg.includes('secondary rate') || msg.includes('429');
  }
  return false;
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2049** (2026-09-23): **Fix terminal lifecycle for granular plan activation**
  *Symptoms*: ## Bug  `/squad plan activate` can create all planned issues successfully and still end red because the terminal lifecycle safe-output validator accepts `/squad activate` and `/squad plan accept`, but not the granular command `/squad plan activate`. The terminal repair path has the same command omission and only recognizes the fast-path `plan-accepted` artifact, not granular `impl-accepted`.  ## Evidence  - Reference failure: https://github.com/octodemo/eshop-bradyg-dev/actions/runs/34987615314 - Durable activation output: https://github.com/octodemo/eshop-bradyg-dev/issues/4#issuecomment-5682975648 - Failing job message: `Lifecycle body must include an H2 lifecycle heading plus state, last-command, and a nonterminal next-action value consisting of a backticked /squad command.`  ## Acceptance criteria  - Terminal lifecycle upsert accepts `/squad plan activate`. - Idempotent terminal repair recognizes `/squad plan activate` after a trusted `impl-accepted` artifact. - Existing fast-path commands remain supported. - Targeted lifecycle tests and all seven strict gh-aw compilations pass. 
  **Post-Mortem & Fix Analysis**:
  > ### 📋 Assigned to agentic-workflows-dev (Agentic Workflows Engineer)  **Issue:** #2049 — Fix terminal lifecycle for granular plan activation  agentic-workflows-dev will pick this up in the next Copilot session.  > **For Copilot coding agent:** If enabled, this issue will be worked automatically. > Otherwise, start a Copilot session and say: > `agentic-workflows-dev, work on issue #2049`
  > Closing as resolved — this was fixed by PR #2050, and current lifecycle validation accepts `/squad plan activate` (`workflows/shared/squad.md:338`, `scripts/check-workflow-input-interpolation.mjs:78-80`).

- **Issue #1971** (2026-09-11): **TEMPLATE_MANIFEST references Rai-charter.md but file is rai-charter.md (masked by macOS case-insensitivity)**
  *Symptoms*: ## Summary  `TEMPLATE_MANIFEST` declares `source: 'Rai-charter.md'` (`packages/squad-cli/src/cli/core/templates.ts:139-140`), but the file on disk is **`rai-charter.md`** (lowercase) in all four template locations. It is the **only** one of 59 manifest sources that does not resolve case-sensitively.  Found while fixing the README casing in #1949; deliberately left out of that docs PR because the fix spans runtime code, tests, and a prompt template.  ## Why this hasn't been caught  `existsSync` gives a **false pass on macOS**, because the filesystem is case-insensitive. A check that reads directory entries and compares exact basenames tells the truth:  ``` total 59  case-sensitively missing 1   MISSING: Rai-charter.md ```  On disk, all four locations agree:  ``` .squad-templates                 charter.md fact-checker-charter.md rai-charter.md scribe-charter.md templates                        charter.md fact-checker-charter.md personal-charter.md rai-charter.md scribe-charter.md packages/squad-cli/templates     charter.md fact-checker-charter.md rai-charter.md scribe-charter.md packages/squad-sdk/templates     charter.md fact-checker-charter.md rai-charter.md scribe-charter.md ```  This is exactly the failure mode the codebase already warns about in its own comment at `packages/squad-sdk/src/config/init.ts:1141-1151` — mixed-case lookups missing on case-sensitive filesystems (Linux CI), referencing the regression #1299 was fixing.  ## Blast radius  The wrong casing is load-be
  **Post-Mortem & Fix Analysis**:
  > Closing as completed following backlog cleanup: the associated fix, validation, or tracking work has been completed.

- **Issue #1878** (2026-08-25): **gh-aw install-order test still asserts worker-first after dispatcher-first rollout**
  *Symptoms*: ## Problem  PR #1874 deliberately changed every live `gh aw add` surface to install the dispatcher first because current gh-aw dependency discovery compiles the dispatcher before confirming the explicit worker/reviewer surface. The guide now correctly says:  > Keep the dispatcher first.  But `test/gh-aw-implement-workflow.test.ts` still asserts the old worker-first contract:  ```ts expect(dispatcherIndex).toBeGreaterThan(workerIndex); expect(guide).toContain('The single command installs the dedicated worker first'); ```  On current `dev` (`08b89daa` when measured), the guide indices are `dispatcher=875`, `worker=920`, so the full suite fails with `expected 875 to be greater than 920`.  This is not a #1605 regression: PR #1877 independently reproduces the same failure against `origin/dev`. It currently blocks that otherwise-repaired PR.  ## Acceptance criteria  - [ ] Update the install-order test to enforce the current dispatcher-first contract. - [ ] Assert the current explanatory prose (`gh aw add` discovers worker/reviewer dependencies while compiling the dispatcher), not the removed worker-first sentence. - [ ] Verify all three install surfaces remain in coherent order: dispatcher, implementation worker, reviewer. - [ ] Mutation-check reversing dispatcher/worker or worker/reviewer order makes the test fail. - [ ] Run the focused workflow test and full relevant CI.  ## Scope  Test correction only unless current `dev` reveals another stale worker-first assertion. Do not chan

- **Issue #1860** (2026-08-24): **gh-aw: `plan activate` summary reports `squad:{agent}` labels it did not apply, and omits the required `Non-roster agent values` disclosure**
  *Symptoms*: ## Summary  The `/squad plan activate` summary's **Hierarchy** section reports `squad:{agent}` labels on two epic issues that were never applied, and omits the `Non-roster agent values` disclosure that `workflows/squad.md:1325` requires in exactly this situation.  The *behaviour* was correct — the labels were rightly withheld. Only the **reporting** is wrong. But a summary that claims labels it did not apply is a false provenance claim, which is the specific failure mode #1812 exists to prevent.  ## Evidence  Fixture: `octodemo/aspiregregator-squad-e2e`, seed issue #5, activation run `32778953402` (all six jobs `success`).  **What the summary claimed:**  ``` - [Epic] Worker loop hardening (Epic 1.1) — squad:kint - [Epic] Fetch retry, timeout, and failure persistence (Epic 1.2) — squad:kint / squad:mcmanus ```  **What was actually applied:**  ``` #6 created=2026-08-24T21:28:57Z labels=[squad] [Epic] Worker loop hardening #7 created=2026-08-24T21:28:59Z labels=[squad] [Epic] Fetch retry, timeout, and failure ```  Neither epic carries any `squad:{agent}` label. For contrast, the very next two issues created seconds later did get theirs, so this is not a transient failure or a label-does-not-exist-yet race:  ``` #8 created=2026-08-24T21:29:01Z labels=[squad,squad:hockney] #9 created=2026-08-24T21:29:03Z labels=[squad,squad:kint] ```  ## Root cause  The withholding is correct and intentional. Both epics have **multi-valued** owners in the program plan:  - Epic 1.1 — suggested owne

- **Issue #1859** (2026-08-24): **gh-aw: `plan activate` binds a task's `squad:{agent}` label from its epic owner, not the task's `Agent` cell**
  *Symptoms*: ## Summary  During the E4 end-to-end run on the live fixture, `/squad plan activate` minted a task's `squad:{agent}` label from its **epic's owner** rather than from the task's own `Agent` cell in the accepted implementation plan. 11 of 12 tasks bound correctly; task 6 drifted.  This is an agent-binding correctness bug in the same family as #1784 / #1801 — but it survives all existing guards, because TG-2 certification and validation Check 10 both pass: the label applied *is* a certified roster name, just the **wrong** one.  ## Evidence  Fixture: `octodemo/aspiregregator-squad-e2e`, seed issue #5, activation run `32778953402` (all six jobs `success`).  **Accepted implementation plan** (comment `5400751833`, the artifact locked by `/squad plan accept implementation`):  ``` | 6 | Reconcile `MostRecentItems` by `Link` on refresh | M | — | McManus | 2.1 | ```  **Issue actually created** for that task:  ``` #17 [squad,squad:kint] Reconcile MostRecentItems by Link on refresh **Context:** Epic 2.1, D4 · Size M · Depends on: — ```  Epic 2.1's suggested owner in the program plan is **Kint**. The task's `Agent` is **McManus**. The minted label followed the epic, not the task.  All other 11 tasks matched their `Agent` cell exactly:  | Task | Plan `Agent` | Issue | Label | Match | |---|---|---|---|---| | 1 | Kint | #12 | `squad:kint` | ✅ | | 2 | Kint | #13 | `squad:kint` | ✅ | | 3 | Kint | #14 | `squad:kint` | ✅ | | 4 | Kint | #15 | `squad:kint` | ✅ | | 5 | McManus | #16 | `squad:mcmanus

- **Issue #1842** (2026-08-24): **workflows/squad.md is ~37 bytes from the prompt-budget floor — the next change to it fails CI on byte count alone**
  *Symptoms*: ## Measured  `test/gh-aw-quality.test.ts` → `gh-aw: prompt budget & planning import regression` → `reports combined bytes and headroom` asserts at least 5 KB of headroom under a 100 KB prompt ceiling:  ```js ).toBeGreaterThan(5 * 1024); ```  On `dev` at `4b32f7be`, that gate passes with roughly **5157 bytes** of headroom — about **37 bytes** above the 5120-byte floor.  ## Why this is a blocker, not a nit  Discovered while fixing #1835, which needed a ~18-byte change to one `awk` one-liner in `workflows/squad.md`. Measured cost of each attempt:  | Change | Headroom | Gate | |---|---:|---| | Baseline (`dev`) | ~5157 | ✅ | | Fix + 5-line explanatory paragraph | 4823 | ❌ | | Fix + 2-line note | 5040 | ❌ | | Fix + 1-line note, compacted `awk` | 5092 | ❌ | | Fix + 4-word note, compacted `awk` | ~5155 | ✅ |  To land an 18-byte behavioral fix I had to:  1. strip inter-statement spaces from the `awk` program, hurting readability of the exact line most likely to be reread during an incident, and 2. delete the prose explaining *why* the line is shaped that way.  That is the budget dictating code style and deleting rationale. Both are load-bearing in a file that **is** the prompt.  ## The compounding part  `workflows/squad.md` is the `/squad` coordinator prompt. Nearly every open gh-aw item edits it — #1801 (plan validation), #1780 (ontology drift next-hints), #1730 (issue-scoped concurrency + actor authorization), #1757 (adversarial plan validate), #1608 (richer `squad.agent.md`). Each 
  **Post-Mortem & Fix Analysis**:
  > ## Two corrections + one resolved unknown  ### 1. Acceptance criterion 3 is answered: the 100 KB ceiling is real, not inherited  This issue asks that the ceiling be "justified against the actual model/runner limit rather than inherited." It is a genuine gh-aw limit. `CHANGELOG.md:28` records the original compression work:  > prompt-size compression (135KB -> under the 100KB gh-aw limit)  So raising the ceiling is **not** on the table. Only three levers remain: trim the prompt, lower the 5 KB guard, or move content out of the assembled set.  ### 2. The byte numbers in the description are wrong  Measured against current `origin/dev`:  | ref | total | headroom | spare over the 5120 floor | |---|---:|---:|---:| | `origin/dev` | 97,207 | 5,193 | **73** | | #1841 head | 97,254 | 5,146 | **26** |  The description says ~37 and ~65. Actual is 73 and 26 — so #1841 is **tighter** than recorded, not looser.  ### 3. Measurement gotcha that will mislead the next person  Do not measure the working tr

- **Issue #1835** (2026-08-23): **PC-0 turns a leading-newline dispatch value into a silent EMPTY_DISPATCH halt**
  *Symptoms*: Follow-up nit from FIDO's pass-3 review of #1832 (merged). Filed rather than fixed in-PR because the review verdict was APPROVE/merge-as-is and the path is not reachable from either real producer.  ## Measured  `workflows/squad.md`, Step PC-0, normalizes the dispatched command with an `awk` program gated on `NR==1`:  ```bash printf '%s\n' "$SQUAD_DISPATCH_COMMAND" | awk 'NR==1{sub(/\r$/,""); sub(/^[[:space:]]+/,""); sub(/[[:space:]]+$/,""); if($0==""){print "EMPTY_DISPATCH"; exit} if($0 ~ /^\/squad([[:space:]]|$)/) print; else print "/squad " $0}' ```  Because the program only ever inspects record 1, a value whose first character is a newline puts an **empty string** on that record:  ``` PC0($'\nimplement')  →  EMPTY_DISPATCH ```  `EMPTY_DISPATCH` routes to the activation guard, which halts with a `::warning::` and **no comment** — by design, so that empty activation probes stay side-effect free (PR #1777, junk issues #12/#14). So a structurally valid `implement` dispatch would halt silently rather than run.  Silent-halt-on-valid-input is the same defect class #1824 and #1832 exist to close.  ## Why this is a nit and not a defect  FIDO enumerated the producers that can reach PC-0:  1. `workflows/squad-implement-worker.md:259` — relays a **literal** single-token value (`"command": "implement"`). 2. The `workflow_dispatch` UI input — single-line by schema.  Neither can emit a leading newline. Reaching this requires a crafted `actions: write` API payload, and an actor holding `a

- **Issue #1833** (2026-08-24): **gh-aw quality suite silently skips 13 tests (28 assertions) on Windows via `existsSync('/bin/sh')` probe**
  *Symptoms*: ## Summary  `test/gh-aw-quality.test.ts:30` gates two `describe` blocks on a POSIX shell that never exists on Windows:  ```ts const HAS_POSIX_SHELL = existsSync('/bin/sh'); ```  ```ts // :1515 describe.skipIf(!HAS_POSIX_SHELL)('gh-aw: Team Guard roster-row detection — committed-HEAD git repo coverage (#1689 revision 3)', …) // :1687 describe.skipIf(!HAS_POSIX_SHELL)('gh-aw: Cast PR dedup jq filter behavioral coverage (#1689 revision)', …) ```  On Windows, `/bin/sh` does not exist, so both blocks skip. **Measured: 13 tests containing 28 `expect()` calls never execute** — and the suite reports green.  This is the same defect class as #1824 / #1812 / #1801 / #1822 / #1827: **a gate that structurally cannot observe the failure it exists to catch.** Per the standing decision in `.squad/decisions.md` (2026-08-20): *a permanently green — or permanently red — gate is equivalent to no gate.*  ## Why this one stings  The skipped blocks are **#1689's own behavioral coverage** — assertions written specifically to prove gh-aw Team Guard and Cast PR dedup behavior. A Windows contributor sees a green suite and reasonably concludes that behavior is verified. It isn't.  Git Bash ships a POSIX shell on essentially every Windows dev machine that has Git installed, so the skip isn't even buying portability — it's discarding coverage that could have run.  ## Prior art in this repo — the fix shape already exists  `test/gh-aw-command-parse.test.ts` (added in #1832 for #1824) hit the identical probl

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

### Incident Patch 1: `d2364dfe` (2026-10-03)
**Commit Message**: fix(cli): accept persistent names in health routes (#2165)

Co-authored-by: brady gaster <[REDACTED_EMAIL]>
Co-authored-by: Copilot App <[REDACTED_EMAIL]>

**File**: `.changeset/cli-health-persistent-routing.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@bradygaster/squad-cli": patch
+---
+
+Accept casting registry persistent names as valid CLI health routing references.
```

**File**: `packages/squad-cli/src/cli/commands/health.ts` (modified, +6/-0)
```diff
@@ -286,6 +286,12 @@ function loadKnownRoutingAgentKeys(squadDir: string): Set<string> {
       throw new Error(`registry entry ${agentId} must be an object`);
     }
     keys.add(normalizeAgentRef(agentId));
+    if (
+      typeof entry.persistent_name === 'string' &&
+      entry.persistent_name.trim()
+    ) {
+      keys.add(normalizeAgentRef(entry.persistent_name));
+    }
   }
 
   const team = parseTeamMarkdown(
```

**File**: `test/cli/health-command.test.ts` (modified, +27/-0)
```diff
@@ -537,6 +537,33 @@ describe('routing readiness', () => {
     expect(result.message).toContain('registry is invalid');
   });
 
+  it('accepts persistent names and registry IDs as agent references', () => {
+    const registryPath = path.join(squadDir, 'casting', 'registry.json');
+    const registry = readFileSync(registryPath, 'utf8')
+      .replace('"display_name":"Alpha"', '"display_name":"Frontend Lead"')
+      .replace(
+        '"persistent_name":"Alpha"',
+        '"persistent_name":"Frontend Lead"',
+      );
+    writeFileSync(registryPath, registry, 'utf8');
+    writeSquad('team.md', TEAM.replace('| Alpha |', '| Frontend Lead |'));
+    writeSquad(
+      path.join('agents', 'alpha', 'charter.md'),
+      CHARTER.replace('**Name:** Alpha', '**Name:** Frontend Lead'),
+    );
+    writeSquad(
+      'routing.md',
+      ROUTING.replace(
+        '| feature | Alpha | New work |',
+        '| feature | Frontend Lead | New work |\n| maintenance | alpha | Maintenance |',
+      ),
+    );
+
+    expect(check(runSquadHealth(squadDir, repoRoot), 'routing').status).toBe(
+      'pass',
+    );
+  });
+
   it('reports unknown agents deterministically', () => {
     writeSquad(
       'routing.md',
```

---

### Incident Patch 2: `42c05654` (2026-10-03)
**Commit Message**: docs: fix remaining v0.13.1 reference in gh-aw activation walkthrough

Addresses copilot-pull-request-reviewer finding: the activation guide's
job-1 walkthrough still cited the old default at line 2032.

Co-authored-by: Copilot App <[REDACTED_EMAIL]>

**File**: `docs/src/content/docs/guide/gh-aw.md` (modified, +1/-1)
```diff
@@ -2029,7 +2029,7 @@ Understanding the two-job architecture helps when debugging.
 The activation job runs with full network access:
 
 1. Optionally mints a GitHub App installation token
-2. Resolves `SQUAD_CLI_VERSION` (default `v0.13.1`) and downloads the matching
+2. Resolves `SQUAD_CLI_VERSION` (default `v1.0.0`) and downloads the matching
    standalone GitHub Release bundle with checksum verification — no npm install
 3. Preserves a committed team with roster entries, or runs
    `squad init --preset default --state-backend local` when no usable team exists
```

---

### Incident Patch 3: `8c0311c3` (2026-10-03)
**Commit Message**: fix(release): repair Homebrew/WinGet publish auth for external-repo checkouts (#2161)

* fix(release): replace broken external-repo checkout auth for Homebrew/WinGet publish

The publish-homebrew and publish-winget jobs used actions/checkout with a
custom classic PAT against external repositories (bradygaster/homebrew-squad,
microsoft/winget-pkgs, tamirdresher/winget-pkgs). This failed deterministically
in the v1.0.0 release run (reproduced on rerun) with:
  fatal: could not read Username for 'https://github.com': terminal prompts disabled

Root cause not fully isolated (token validity could not be checked from
outside Actions), so this change removes the dependency on actions/checkout's
token/includeIf mechanism entirely rather than guessing around it:

- All three target repos are public, so the initial read/clone never actually
  needs authentication - switched to plain anonymous 'git clone'.
- Push credentials (needed only for the later 'git push'/gh pr create steps)
  are now set via a local, non-global 'git config --local http.<url>.extraheader'
  scoped to just that one clone directory - never embedded in a remote URL,
  never printed, and cleaned up automatically when the j

**File**: `.github/workflows/squad-standalone-release.yml` (modified, +75/-23)
```diff
@@ -429,6 +429,23 @@ jobs:
             exit 1
           fi
 
+      - name: Preflight - verify Homebrew tap token
+        env:
+          GH_TOKEN: ${{ secrets.HOMEBREW_TAP_TOKEN }}
+        run: |
+          set -euo pipefail
+          login="$(gh api user --jq '.login')" || {
+            echo "::error::HOMEBREW_TAP_TOKEN failed to authenticate against the GitHub API. The token is likely invalid, expired, or revoked and must be rotated by a maintainer with write access to bradygaster/homebrew-squad."
+            exit 1
+          }
+          echo "Authenticated as: ${login}"
+          push_access="$(gh api repos/bradygaster/homebrew-squad --jq '.permissions.push // false')"
+          echo "Push access to bradygaster/homebrew-squad: ${push_access}"
+          if [ "${push_access}" != "true" ]; then
+            echo "::error::HOMEBREW_TAP_TOKEN authenticates as '${login}', but that account/token does not have push access to bradygaster/homebrew-squad."
+            exit 1
+          fi
+
       - uses: actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c #v8
         with:
           name: packaging-manifests
@@ -439,9 +456,17 @@ jobs:
           repository: bradygaster/homebrew-squad
           ref: main
           path: homebrew-tap
-          fetch-depth: 1
           token: ${{ secrets.HOMEBREW_TAP_TOKEN }}
-          persist-credentials: true
+          persist-credentials: false
+
+      - name: Configure Homebrew tap push credential (scoped locally; checkout does not persist it)
+        env:
+          TOKEN: ${{ secrets.HOMEBREW_TAP_TOKEN }}
+        working-directory: homebrew-tap
+        run: |
+          set -euo pipefail
+          auth_header="Authorization: basic $(printf 'x-access-token:%s' "${TOKEN}" | base64 -w0)"
+          git config --local http.https://github.com/.extraheader "${auth_header}"
 
       - name: Publish cask to the tap
         env:
@@ -571,6 +596,23 @@ jobs:
             exit 1
           fi
 
+      - name: Preflight - verify WinGet publish token
+        env:
+          GH_TOKEN: ${{ secrets.WINGET_CREATE_GITHUB_TOKEN }}
+        run: |
+          set -euo pipefail
+          login="$(gh api user --jq '.login')" || {
+            echo "::error::WINGET_CREATE_GITHUB_TOKEN failed to authenticate against the GitHub API. The token is likely invalid, expired, or revoked and must be rotated by a maintainer with push access to tamirdresher/winget-pkgs."
+            exit 1
+          }
+          echo "Authenticated as: ${login}"
+          push_access="$(gh api repos/tamirdresher/winget-pkgs --jq '.permissions.push // false')"
+          echo "Push access to tamirdresher/winget-pkgs: ${push_access}"
+          if [ "${push_access}" != "true" ]; then
+            echo "::error::WINGET_CREATE_GITHUB_TOKEN authenticates as '${login}', but that account/token does not have push access to tamirdresher/winget-pkgs."
+            exit 1
+          fi
+
       - uses: actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c #v8
         with:
           name: packaging-manifests
@@ -609,15 +651,14 @@ jobs:
           echo "package_identifier=${PACKAGE_IDENTIFIER}" >> "${GITHUB_OUTPUT}"
           echo "package_root=${package_root}" >> "${GITHUB_OUTPUT}"
 
-      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 #v7
-        with:
-          repository: microsoft/winget-pkgs
-          ref: master
-          path: winget-base
-          fetch-depth: 1
-          sparse-checkout: ${{ steps.release.outputs.package_root }}
-          token: ${{ secrets.WINGET_CREATE_GITHUB_TOKEN }}
-          persist-credentials: false
+      - name: Clone WinGet manifests directory (read-only, public repo; no credential needed)
+        env:
+          PACKAGE_ROOT: ${{ steps.release.outputs.package_root }}
+        run: |
+          set -euo pipefail
+          git clone --no-checkout --depth 1 --branch master --filter=blob:none https://github.com/microsoft/winget-pkgs.git winget-base
+          git -C winget-base sparse-checkout set "${PACKAGE_ROOT}"
+          git -C winget-base checkout master
 
       - name: Check WinGet publication state
         id: guard
@@ -709,22 +750,33 @@ jobs:
           repository: tamirdresher/winget-pkgs
           ref: ${{ steps.release.outputs.branch }}
           path: winget-pkgs
+          token: ${{ secrets.WINGET_CREATE_GITHUB_TOKEN }}
+          persist-credentials: false
           fetch-depth: 1
           sparse-checkout: ${{ steps.release.outputs.package_root }}
-          token: ${{ secrets.WINGET_CREATE_GITHUB_TOKEN }}
-          persist-credentials: true
 
-      - name: Check out WinGet master for a new version branch
+      - name: Configure existing-branch push credential (scoped locally; checkout does not persist it)
+        if: steps.guard.outputs.skip == 'false' && steps.guard.outputs.branch_exists == 'true'
+        env:
+          TOKEN: ${{ secrets.WINGET_CREATE_GITHUB_TOKEN }}
+        working-d
```

---

### Incident Patch 4: `b127c7a4` (2026-10-03)
**Commit Message**: Fix assignment safety, roster parsing, and Ralph authority (#2156)

* fix: make Copilot assignment fail closed and disclose triage provenance

Closes #2080, Refs #2085

Co-authored-by: Copilot App <[REDACTED_EMAIL]>

* fix(sdk): scope team markdown parsing

Closes #2079

Co-authored-by: Copilot App <[REDACTED_EMAIL]>

* docs: clarify Ralph merge authority (Closes #2077)

Co-authored-by: Copilot App <[REDACTED_EMAIL]>

* fix: address assignment and roster review feedback

Co-authored-by: Copilot App <[REDACTED_EMAIL]>

---------

Co-authored-by: brady gaster <[REDACTED_EMAIL]>
Co-authored-by: Copilot App <[REDACTED_EMAIL]>

**File**: `.changeset/2079-team-roster-table-scope.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@bradygaster/squad-sdk": patch
+---
+
+Limit team markdown table parsing to supported roster sections, preserving the legacy Team Roster heading while excluding auxiliary tables.
```

**File**: `.changeset/assignment-safety-attribution.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+---
+"@bradygaster/squad-cli": patch
+"@bradygaster/squad-sdk": patch
+---
+
+Make issue-assign the sole Copilot assignment workflow, fail visibly on missing tokens or unconfirmed API responses, dispatch automated auto-assign handoffs explicitly, and disclose deterministic keyword triage provenance without attributing it to Lead-agent analysis.
```

**File**: `.changeset/tidy-ralph-guidance.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+---
+"@bradygaster/squad-cli": patch
+"@bradygaster/squad-sdk": patch
+---
+
+Clarify Ralph's monitor-only role and reserve pull request merging for humans in the distributed reference templates.
```

**File**: `.github/workflows/squad-heartbeat.yml` (modified, +21/-74)
```diff
@@ -1,10 +1,7 @@
 name: Squad Heartbeat (Ralph)
-# ⚠️ SYNC: This workflow is maintained in 4 locations. Changes must be applied to all:
-#   - templates/workflows/squad-heartbeat.yml (source template)
-#   - packages/squad-cli/templates/workflows/squad-heartbeat.yml (CLI package)
-#   - .squad/templates/workflows/squad-heartbeat.yml (installed template)
-#   - .github/workflows/squad-heartbeat.yml (active workflow)
-# Run 'squad upgrade' to sync installed copies from source templates.
+# Canonical source: .squad-templates/workflows/squad-heartbeat.yml.
+# Run node scripts/sync-templates.mjs --sync for root, CLI and SDK mirrors;
+# update the active .github/workflows copy while preserving repo-specific steps.
 #
 # CI Hardening: Cron schedule audit (item 8, refs diberry/squad#120)
 # ─────────────────────────────────────────────────────────────────
@@ -35,6 +32,7 @@ permissions:
   issues: write
   contents: read
   pull-requests: read
+  actions: write
 
 # CI Hardening Phase 3 item A1: Prevent parallel runs from competing for resources
 concurrency:
@@ -136,6 +134,8 @@ jobs:
               core.info('📋 Board is clear — Ralph found no untriaged issues');
               return;
             }
+            const autoAssign = /<!--\s*copilot-auto-assign:\s*true\s*-->/i
+              .test(fs.readFileSync('.squad/team.md', 'utf8'));
             
             for (const decision of results) {
               try {
@@ -161,80 +161,27 @@ jobs:
                     '> To reassign, swap the `squad:*` label.'
                   ].join('\n')
                 });
+
+                if (decision.label === 'squad:copilot' && autoAssign) {
+                  await github.rest.actions.createWorkflowDispatch({
+                    owner: context.repo.owner,
+                    repo: context.repo.repo,
+                    workflow_id: 'squad-issue-assign.yml',
+                    ref: context.payload.repository.default_branch,
+                    inputs: { issue_number: String(decision.issueNumber) }
+                  });
+                  core.info(`Dispatched squad-issue-assign.yml for auto-assigned issue #${decision.issueNumber}`);
+                }
                 
                 core.info(`Triaged #${decision.issueNumber} → ${decision.assignTo} (${decision.source})`);
               } catch (e) {
                 core.warning(`Failed to triage #${decision.issueNumber}: ${e.message}`);
+                if (decision.label === 'squad:copilot' && autoAssign) {
+                  core.setFailed(`Failed to dispatch Copilot assignment for #${decision.issueNumber}: ${e.message}`);
+                }
               }
             }
             
             core.info(`🔄 Ralph triaged ${results.length} issue(s)`);
 
-      # Copilot auto-assign step (uses PAT if available)
-      - name: Ralph — Assign @copilot issues
-        if: success()
-        uses: actions/github-script@3a2844b7e9c422d3c10d287c895573f7108da1b3 #v9
-        with:
-          github-token: ${{ secrets.COPILOT_ASSIGN_TOKEN || secrets.GITHUB_TOKEN }}
-          script: |
-            const fs = require('fs');
-
-            let teamFile = '.squad/team.md';
-            if (!fs.existsSync(teamFile)) {
-              teamFile = '.ai-team/team.md';
-            }
-            if (!fs.existsSync(teamFile)) return;
-
-            const content = fs.readFileSync(teamFile, 'utf8');
-
-            // Check if @copilot is on the team with auto-assign
-            const hasCopilot = content.includes('🤖 Coding Agent') || content.includes('@copilot');
-            const autoAssign = content.includes('<!-- copilot-auto-assign: true -->');
-            if (!hasCopilot || !autoAssign) return;
-
-            // Find issues labeled squad:copilot with no assignee
-            try {
-              const { data: copilotIssues } = await github.rest.issues.listForRepo({
-                owner: context.repo.owner,
-                repo: context.repo.repo,
-                labels: 'squad:copilot',
-                state: 'open',
-                per_page: 5
-              });
-
-              const unassigned = copilotIssues.filter(i =>
-                !i.assignees || i.assignees.length === 0
-              );
-
-              if (unassigned.length === 0) {
-                core.info('No unassigned squad:copilot issues');
-                return;
-              }
-
-              // Get repo default branch
-              const { data: repoData } = await github.rest.repos.get({
-                owner: context.repo.owner,
-                repo: context.repo.repo
-              });
-
-              for (const issue of unassigned) {
-                try {
-                  await github.request('POST /repos/{owner}/{repo}/issues/{issue_number}/assignees', {
-                    owner: context.repo.owner,
-                    repo: context.repo.repo,
-                    issue_number: issue.number,
-                    assignees: ['copilot-swe-agent[bot]'],
-               
```

**File**: `.github/workflows/squad-issue-assign.yml` (modified, +87/-57)
```diff
@@ -3,22 +3,39 @@ name: Squad Issue Assign
 on:
   issues:
     types: [labeled]
+  workflow_dispatch:
+    inputs:
+      issue_number:
+        description: Issue number to assign to Copilot
+        required: true
+        type: string
 
 permissions:
   issues: write
   contents: read
 
 # CI Hardening Phase 3 item A1: Prevent parallel runs from competing for resources
 concurrency:
-  group: ${{ github.workflow }}-${{ github.event.issue.number || github.ref }}
+  group: ${{ github.workflow }}-${{ github.event.issue.number || github.event.inputs.issue_number || github.ref }}
   cancel-in-progress: true
 
 jobs:
   assign-work:
     # Only trigger on squad:{member} labels (not the base "squad" label)
-    if: startsWith(github.event.label.name, 'squad:')
+    if: github.event_name == 'workflow_dispatch' || startsWith(github.event.label.name, 'squad:')
     runs-on: ubuntu-latest
     steps:
+      - name: Require Copilot assignment token
+        if: github.event_name == 'workflow_dispatch' || github.event.label.name == 'squad:copilot'
+        uses: actions/github-script@3a2844b7e9c422d3c10d287c895573f7108da1b3 #v9
+        env:
+          COPILOT_ASSIGN_TOKEN: ${{ secrets.COPILOT_ASSIGN_TOKEN }}
+        with:
+          script: |
+            if (!process.env.COPILOT_ASSIGN_TOKEN?.trim()) {
+              throw new Error('COPILOT_ASSIGN_TOKEN is required for squad:copilot assignment; no routing or assignment attempted.');
+            }
+
       - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 #v7
 
       # CI Hardening: GitHub API rate limit monitoring (item 9)
@@ -46,8 +63,12 @@ jobs:
         with:
           script: |
             const fs = require('fs');
-            const issue = context.payload.issue;
-            const label = context.payload.label.name;
+            const label = context.payload.label?.name || 'squad:copilot';
+            const issue = context.payload.issue || (await github.rest.issues.get({
+              owner: context.repo.owner,
+              repo: context.repo.repo,
+              issue_number: Number(context.payload.inputs.issue_number)
+            })).data;
             const slugify = value => value
               .toLowerCase()
               .replace(/[^a-z0-9]+/g, '-')
@@ -76,6 +97,8 @@ jobs:
 
             // Extract member name from label (e.g., "squad:ripley" → "ripley")
             const memberName = label.replace('squad:', '').toLowerCase();
+            // Copilot is acknowledged only after the assignment API accepts it.
+            if (memberName === 'copilot') return;
 
             // Read team roster — check .squad/ first, fall back to .ai-team/
             let teamFile = '.squad/team.md';
@@ -90,25 +113,17 @@ jobs:
             const content = fs.readFileSync(teamFile, 'utf8');
             const lines = content.split('\n');
 
-            // Check if this is a coding agent assignment
-            const isCopilotAssignment = memberName === 'copilot';
-
-            let assignedMember = null;
-            if (isCopilotAssignment) {
-              assignedMember = { name: '@copilot', role: 'Coding Agent' };
-            } else {
-              const match = findMemberBySlug(lines, memberName);
-              assignedMember = match.member;
-              if (match.ambiguous) {
-                core.warning(`Multiple squad members map to label "${label}" — refusing ambiguous assignment`);
-                await github.rest.issues.createComment({
-                  owner: context.repo.owner,
-                  repo: context.repo.repo,
-                  issue_number: issue.number,
-                  body: `⚠️ Multiple squad members map to label \`${label}\`. Rename the colliding members in \`.squad/team.md\` before assigning work.`
-                });
-                return;
-              }
+            const match = findMemberBySlug(lines, memberName);
+            const assignedMember = match.member;
+            if (match.ambiguous) {
+              core.warning(`Multiple squad members map to label "${label}" — refusing ambiguous assignment`);
+              await github.rest.issues.createComment({
+                owner: context.repo.owner,
+                repo: context.repo.repo,
+                issue_number: issue.number,
+                body: `⚠️ Multiple squad members map to label \`${label}\`. Rename the colliding members in \`.squad/team.md\` before assigning work.`
+              });
+              return;
             }
 
             if (!assignedMember) {
@@ -135,20 +150,7 @@ jobs:
             }
 
             // Post assignment acknowledgment
-            let comment;
-            if (isCopilotAssignment) {
-              comment = [
-                `### 🤖 Routed to @copilot (Coding Agent)`,
-                '',
-                `**Issue:** #${issue.number} — ${issue.title}`,
-                '',
-                `@copilot has been assigned and will pick this up automatically.`,
-                '',
-          
```

**File**: `.github/workflows/squad-triage.yml` (modified, +20/-16)
```diff
@@ -7,6 +7,7 @@ on:
 permissions:
   issues: write
   contents: read
+  actions: write
 
 # CI Hardening Phase 3 item A1: Prevent parallel runs from competing for resources
 concurrency:
@@ -40,7 +41,7 @@ jobs:
               core.info(`✅ Rate limit: OK — above safe threshold (resets ${resetDate})`);
             }
 
-      - name: Triage issue via Lead agent
+      - name: Triage issue via deterministic keyword routing
         uses: actions/github-script@3a2844b7e9c422d3c10d287c895573f7108da1b3 #v9
         with:
           script: |
@@ -59,10 +60,14 @@ jobs:
 
             const content = fs.readFileSync(teamFile, 'utf8');
             const lines = content.split('\n');
+            if (issue.labels.some(label => /^squad:.+/.test(label.name))) {
+              core.info(`Issue #${issue.number} already has a squad member label — skipping conflicting triage.`);
+              return;
+            }
+            const autoAssign = /<!--\s*copilot-auto-assign:\s*true\s*-->/i.test(content);
 
             // Check if @copilot is on the team
             const hasCopilot = content.includes('🤖 Coding Agent');
-            const copilotAutoAssign = content.includes('<!-- copilot-auto-assign: true -->');
 
             // Parse @copilot capability profile
             let goodFitKeywords = [];
@@ -312,19 +317,7 @@ jobs:
               labels: ['go:needs-research']
             });
 
-            // Auto-assign @copilot if enabled
-            if (isCopilot && copilotAutoAssign) {
-              try {
-                await github.rest.issues.addAssignees({
-                  owner: context.repo.owner,
-                  repo: context.repo.repo,
-                  issue_number: issue.number,
-                  assignees: ['copilot']
-                });
-              } catch (err) {
-                core.warning(`Could not auto-assign @copilot: ${err.message}`);
-              }
-            }
+            // Labels route work; only squad-issue-assign.yml assigns Copilot.
 
             // Build copilot evaluation note
             let copilotNote = '';
@@ -338,8 +331,9 @@ jobs:
 
             // Post triage comment
             const comment = [
-              `### 🏗️ Squad Triage — ${lead.name} (${lead.role})`,
+              `### 🏗️ Squad Triage — Automated keyword routing`,
               '',
+              `**Provenance:** Deterministic keyword matching against the capability profile in \`.squad/team.md\` and rules in \`.squad/routing.md\`; no Lead-agent analysis was performed.`,
               `**Issue:** #${issue.number} — ${issue.title}`,
               `**Assigned to:** ${assignedMember.name} (${assignedMember.role})`,
               `**Reason:** ${triageReason}`,
@@ -363,3 +357,13 @@ jobs:
             });
 
             core.info(`Triaged issue #${issue.number} → ${assignedMember.name} (${assignLabel})`);
+            if (isCopilot && autoAssign) {
+              await github.rest.actions.createWorkflowDispatch({
+                owner: context.repo.owner,
+                repo: context.repo.repo,
+                workflow_id: 'squad-issue-assign.yml',
+                ref: context.payload.repository.default_branch,
+                inputs: { issue_number: String(issue.number) }
+              });
+              core.info(`Dispatched squad-issue-assign.yml for auto-assigned issue #${issue.number}`);
+            }
```

**File**: `.squad-templates/ralph-reference.md` (modified, +31/-25)
```diff
@@ -2,9 +2,9 @@
 
 ## Ralph — Work Monitor
 
-Ralph is a built-in squad member whose job is keeping tabs on work. **Ralph tracks and drives the work queue.** Always on the roster, one job: make sure the team never sits idle.
+Ralph is a built-in squad member whose job is keeping tabs on work. **Ralph is monitor/triage-only:** it scans, categorizes, and reports work so the coordinator can keep the queue moving. Ralph does not implement changes, dispatch agents, approve or merge pull requests, or close issues.
 
-**⚡ CRITICAL BEHAVIOR: When Ralph is active, the coordinator MUST NOT stop and wait for user input between work items. Ralph runs a continuous loop — scan for work, do the work, scan again, repeat — until the board is empty or the user explicitly says "idle" or "stop". This is not optional. If work exists, keep going. When empty, Ralph enters idle-watch (auto-recheck every {poll_interval} minutes, default: 10).**
+**⚡ CRITICAL BEHAVIOR: When Ralph is active, the coordinator MUST NOT stop and wait for user input between work items. Ralph runs a continuous monitoring loop — scan for work, report findings to the coordinator, scan again, repeat — until the board is empty or the user explicitly says "idle" or "stop". This is not optional. If work exists, keep coordinating it. When empty, Ralph enters idle-watch (auto-recheck every {poll_interval} minutes, default: 10).**
 
 **Between checks:** Ralph's in-session loop runs while work exists. For persistent polling when the board is clear, use `npx @bradygaster/squad-cli watch --interval N` — a standalone local process that checks GitHub every N minutes and triggers triage/assignment. See [Watch Mode](#watch-mode-squad-watch).
 
@@ -23,12 +23,12 @@ Ralph always appears in `team.md`: `| Ralph | Work Monitor | — | 🔄 Monitor
 | "Ralph, check every N minutes" | Set idle-watch polling interval |
 | "Ralph, idle" / "Take a break" / "Stop monitoring" | Fully deactivate (stop loop + idle-watch) |
 | "Ralph, scope: just issues" / "Ralph, skip CI" | Adjust what Ralph monitors this session |
-| References PR feedback or changes requested | Spawn agent to address PR review feedback |
-| "merge PR #N" / "merge it" (recent context) | Merge via `gh pr merge` |
+| References PR feedback or changes requested | Report it to the coordinator for routing to the PR author agent |
+| "merge PR #N" / "merge it" (recent context) | Report the PR status to the coordinator; only a human may merge |
 
 These are intent signals, not exact strings — match meaning, not words.
 
-When Ralph is active, run this check cycle after every batch of agent work completes (or immediately on activation):
+When Ralph is active, run this check cycle after every batch of coordinator-managed agent work completes (or immediately on activation):
 
 **Step 1 — Scan for work** (run these in parallel):
 
@@ -50,27 +50,33 @@ gh pr list --state open --draft --json number,title,author,labels,checks --limit
 
 | Category | Signal | Action |
 |----------|--------|--------|
-| **Untriaged issues** | `squad` label, no `squad:{member}` label | Lead triages: reads issue, assigns `squad:{member}` label |
-| **Assigned but unstarted** | `squad:{member}` label, no assignee or no PR | Spawn the assigned agent to pick it up |
-| **Draft PRs** | PR in draft from squad member | Check if agent needs to continue; if stalled, nudge |
-| **Review feedback** | PR has `CHANGES_REQUESTED` review | Route feedback to PR author agent to address |
-| **CI failures** | PR checks failing | Notify assigned agent to fix, or create a fix issue |
-| **Approved PRs** | PR approved, CI green, ready to merge | Merge and close related issue |
+| **Untriaged issues** | `squad` label, no `squad:{member}` label | Report to the coordinator for triage and assignment |
+| **Assigned but unstarted** | `squad:{member}` label, no assignee or no PR | Report to the coordinator for agent dispatch |
+| **Draft PRs** | PR in draft from squad member | Report status; the coordinator decides whether the agent should continue |
+| **Review feedback** | PR has `CHANGES_REQUESTED` review | Report feedback to the coordinator for routing to the PR author agent |
+| **CI failures** | PR checks failing | Report to the coordinator to route a fix or create a fix issue |
+| **Approved PRs** | PR approved, CI green, ready for pre-merge review | Report readiness to the coordinator for verification and hand-off to a human; Ralph does not merge or close issues |
 | **No work found** | All clear | Report: "📋 Board is clear. Ralph is idling." Suggest `npx @bradygaster/squad-cli watch` for persistent polling. |
 
-**Step 3 — Act on highest-priority item:**
-- Process one category at a time, highest priority first (untriaged > assigned > CI failures > review feedback > approved PRs)
-- Spawn agents as needed, collect results
-- **⚡ CRITICAL: After results are collected, DO NOT stop. DO NOT wait for user input. IMMEDIATELY go back to Step 1 and scan again.** This is a loop — Ra
```

**File**: `.squad-templates/workflows/squad-heartbeat.yml` (modified, +21/-71)
```diff
@@ -1,10 +1,7 @@
 name: Squad Heartbeat (Ralph)
-# ⚠️ SYNC: This workflow is maintained in 4 locations. Changes must be applied to all:
-#   - templates/workflows/squad-heartbeat.yml (source template)
-#   - packages/squad-cli/templates/workflows/squad-heartbeat.yml (CLI package)
-#   - .squad/templates/workflows/squad-heartbeat.yml (installed template)
-#   - .github/workflows/squad-heartbeat.yml (active workflow)
-# Run 'squad upgrade' to sync installed copies from source templates.
+# Canonical source: .squad-templates/workflows/squad-heartbeat.yml.
+# Run node scripts/sync-templates.mjs --sync for root, CLI and SDK mirrors;
+# update the active .github/workflows copy while preserving repo-specific steps.
 
 on:
   # React to completed work or new squad work
@@ -26,6 +23,7 @@ permissions:
   issues: write
   contents: read
   pull-requests: read
+  actions: write
 
 jobs:
   heartbeat:
@@ -69,6 +67,8 @@ jobs:
               core.info('📋 Board is clear — Ralph found no untriaged issues');
               return;
             }
+            const autoAssign = /<!--\s*copilot-auto-assign:\s*true\s*-->/i
+              .test(fs.readFileSync('.squad/team.md', 'utf8'));
             
             for (const decision of results) {
               try {
@@ -94,77 +94,27 @@ jobs:
                     '> To reassign, swap the `squad:*` label.'
                   ].join('\n')
                 });
+
+                if (decision.label === 'squad:copilot' && autoAssign) {
+                  await github.rest.actions.createWorkflowDispatch({
+                    owner: context.repo.owner,
+                    repo: context.repo.repo,
+                    workflow_id: 'squad-issue-assign.yml',
+                    ref: context.payload.repository.default_branch,
+                    inputs: { issue_number: String(decision.issueNumber) }
+                  });
+                  core.info(`Dispatched squad-issue-assign.yml for auto-assigned issue #${decision.issueNumber}`);
+                }
                 
                 core.info(`Triaged #${decision.issueNumber} → ${decision.assignTo} (${decision.source})`);
               } catch (e) {
                 core.warning(`Failed to triage #${decision.issueNumber}: ${e.message}`);
+                if (decision.label === 'squad:copilot' && autoAssign) {
+                  core.setFailed(`Failed to dispatch Copilot assignment for #${decision.issueNumber}: ${e.message}`);
+                }
               }
             }
             
             core.info(`🔄 Ralph triaged ${results.length} issue(s)`);
 
-      # Copilot auto-assign step (uses PAT if available)
-      - name: Ralph — Assign @copilot issues
-        if: success()
-        uses: actions/github-script@f28e40c7f34bde8b3046d885e986cb6290c5673b #v7
-        with:
-          github-token: ${{ secrets.COPILOT_ASSIGN_TOKEN || secrets.GITHUB_TOKEN }}
-          script: |
-            const fs = require('fs');
-
-            const teamFile = '.squad/team.md';
-            if (!fs.existsSync(teamFile)) return;
-
-            const content = fs.readFileSync(teamFile, 'utf8');
-
-            // Check if @copilot is on the team with auto-assign
-            const hasCopilot = content.includes('🤖 Coding Agent') || content.includes('@copilot');
-            const autoAssign = content.includes('<!-- copilot-auto-assign: true -->');
-            if (!hasCopilot || !autoAssign) return;
-
-            // Find issues labeled squad:copilot with no assignee
-            try {
-              const { data: copilotIssues } = await github.rest.issues.listForRepo({
-                owner: context.repo.owner,
-                repo: context.repo.repo,
-                labels: 'squad:copilot',
-                state: 'open',
-                per_page: 5
-              });
-
-              const unassigned = copilotIssues.filter(i =>
-                !i.assignees || i.assignees.length === 0
-              );
-
-              if (unassigned.length === 0) {
-                core.info('No unassigned squad:copilot issues');
-                return;
-              }
-
-              // Get repo default branch
-              const { data: repoData } = await github.rest.repos.get({
-                owner: context.repo.owner,
-                repo: context.repo.repo
-              });
-
-              for (const issue of unassigned) {
-                try {
-                  await github.request('POST /repos/{owner}/{repo}/issues/{issue_number}/assignees', {
-                    owner: context.repo.owner,
-                    repo: context.repo.repo,
-                    issue_number: issue.number,
-                    assignees: ['copilot-swe-agent[bot]'],
-                    agent_assignment: {
-                      target_repo: `${context.repo.owner}/${context.repo.repo}`,
-                      base_branch: repoData.default_branch,
-                      custom_instructions: `Read .squad/team.md for team context and .squad/routing.md f
```

---

### Incident Patch 5: `deee4409` (2026-10-03)
**Commit Message**: fix(gh-aw): preserve bootstrap candidate through resolved validation (#2158)

* fix(squad-bootstrap): keep candidate tree until final validation

The resolved-link validation ran after the candidate tree was deleted,
so every builtin, evidence, and payload path reported missing.

Co-authored-by: Copilot App <[REDACTED_EMAIL]>

* test(gh-aw): prove bootstrap candidate lifetime and cleanup

Execute the live writer with real candidate validation through Cast provenance, linked proposals, and research comments. Cover success, early returns, API failure, and a premature-cleanup mutation. Verified the happy path fails against pre-fix dev source.

Co-authored-by: Copilot App <[REDACTED_EMAIL]>

---------

Co-authored-by: brady gaster <[REDACTED_EMAIL]>
Co-authored-by: Copilot App <[REDACTED_EMAIL]>

**File**: `test/gh-aw-bootstrap-workflow.test.ts` (modified, +187/-3)
```diff
@@ -1118,6 +1118,187 @@ describe('automatic Squad bootstrap workflow', () => {
   });
 });
 
+describe('gh-aw: squad-bootstrap candidate lifetime', () => {
+  const baseSha = 'c'.repeat(40);
+  const castSha = 'b'.repeat(40);
+  const prUrl = 'https://github.com/octo/example/pull/3';
+
+  function writerScript(source: string): string {
+    const frontmatter = source.split('\n---\n')[0].replace(/^---\n/, '');
+    const steps = parse(frontmatter)['safe-outputs'].jobs['materialize-bootstrap'].steps;
+    const script = steps.find((step: { with?: { script?: string } }) => step.with?.script)?.with.script;
+    expect(script, 'live materialize-bootstrap writer script must exist').toBeTypeOf('string');
+    return script;
+  }
+
+  function writerFixture(
+    scenario: 'success' | 'opt-out' | 'permission-denied' | 'api-error' = 'success',
+    source = WORKFLOW,
+  ) {
+    const fixture = createFixture();
+    const workspace = mkdtempSync(join(tmpdir(), 'gh-aw-bootstrap-writer-'));
+    workspaces.push(workspace);
+    const checkout = join(workspace, 'bootstrap-repo');
+    cpSync(fixture.root, checkout, { recursive: true });
+    cpSync(resolve(ROOT, 'workflows/shared'), join(checkout, '.github/workflows/shared'), { recursive: true });
+    const outputPath = join(workspace, 'output.json');
+    writeFileSync(outputPath, JSON.stringify({
+      items: [{ type: 'materialize_bootstrap', ...createBootstrapPayloadEnvelope(JSON.stringify(fixture.payload)) }],
+    }));
+    let candidate = '';
+    const captureCandidate = (path: string) => {
+      candidate = path;
+      workspaces.push(path);
+    };
+    const script = writerScript(source).replace(
+      "const candidate = mkdtempSync(join(tmpdir(), 'squad-bootstrap-candidate-'));",
+      "const candidate = mkdtempSync(join(tmpdir(), 'squad-bootstrap-candidate-')); captureCandidate(candidate);",
+    );
+    const runScript = compileFunction(
+      `return (async () => {\n${script}\n})();`,
+      ['github', 'context', 'core', 'process', 'captureCandidate'],
+      { importModuleDynamically: vmConstants.USE_MAIN_CONTEXT_DEFAULT_LOADER },
+    );
+    const issueCalls: Array<{ title: string; body: string }> = [];
+    const commentCalls: Array<{ issue_number: number; body: string }> = [];
+    const updates: Array<{ body: string }> = [];
+    const writesWithCandidate: boolean[] = [];
+    const recordWrite = () => writesWithCandidate.push(
+      existsSync(join(candidate, '.squad/team.md')) &&
+      existsSync(join(candidate, 'package.json')) &&
+      existsSync(join(candidate, '.github/workflows/shared/builtins/scribe-charter.md')),
+    );
+    const pull = {
+      number: 3,
+      state: scenario === 'opt-out' ? 'closed' : 'open',
+      title: BOOTSTRAP_PR_TITLE,
+      head: { ref: BOOTSTRAP_BRANCH, sha: castSha, repo: { full_name: 'octo/example' } },
+      base: { ref: 'main' },
+      html_url: prUrl,
+      body: fixture.payload.pr_body,
+      merged_at: null,
+    };
+    let branchCreated = false;
+    let pullCreated = false;
+    const github = {
+      paginate: async (method: () => Promise<unknown>) => method(),
+      rest: {
+        git: {
+          getRef: async ({ ref }: { ref: string }) => {
+            if (ref === `heads/${BOOTSTRAP_BRANCH}` && !branchCreated) {
+              throw Object.assign(new Error('Not Found'), { status: 404 });
+            }
+            return { data: { object: { sha: ref === 'heads/main' ? baseSha : castSha } } };
+          },
+          getCommit: async () => ({ data: { tree: { sha: 'base-tree' } } }),
+          createBlob: async () => { recordWrite(); return { data: { sha: 'blob' } }; },
+          createTree: async () => ({ data: { sha: 'tree' } }),
+          createCommit: async () => ({ data: { sha: castSha } }),
+          createRef: async () => { branchCreated = true; },
+        },
+        pulls: {
+          list: async () => scenario === 'opt-out' || pullCreated ? [pull] : [],
+          create: async () => {
+            recordWrite();
+            if (scenario === 'permission-denied') throw new Error(CREATE_PR_PERMISSION_DENIED_TEXT);
+            pullCreated = true;
+            return { data: pull };
+          },
+          get: async () => ({ data: pull }),
+          update: async (args: { body: string }) => { recordWrite(); updates.push(args); },
+        },
+        issues: {
+          listForRepo: async () => [],
+          listComments: async () => [],
+          create: async (args: { title: string; body: string }) => {
+            recordWrite();
+            issueCalls.push(args);
+            if (scenario === 'api-error') throw new Error('research issue API outage');
+            return { data: { number: 6, html_url: 'https://github.com/octo/example/issues/6' } };
+          },
+          createComment: async (args: { issue_number: number; body: string }) => {
+            recordWrite();
+            commentCalls.push(args);
+          },
+        },
+      },
+    }
```

**File**: `workflows/package/squad-bootstrap.md` (modified, +343/-343)
```diff
@@ -344,389 +344,389 @@ safe-outputs:
                   writeFileSync(target, file.content);
                 }
                 writeFileSync(payloadPath, payloadText);
-              } finally {
-                rmSync(candidate, { recursive: true, force: true });
-              }
 
-              const listState = async () => {
-                const pullRequests = await github.paginate(github.rest.pulls.list, {
-                  ...context.repo,
-                  state: 'all',
-                  per_page: 100,
-                });
-                const issues = (await github.paginate(github.rest.issues.listForRepo, {
-                  ...context.repo,
-                  state: 'all',
-                  per_page: 100,
-                })).filter((issue) => !issue.pull_request);
-                const preliminary = stateModule.classifyBootstrapState({
-                  pullRequests,
-                  issues,
-                  defaultBranch: process.env.SQUAD_BOOTSTRAP_DEFAULT_BRANCH,
-                });
-                const comments = preliminary.issue
-                  ? await github.paginate(github.rest.issues.listComments, {
-                      ...context.repo,
-                      issue_number: preliminary.issue.number,
-                      per_page: 100,
-                    })
-                  : [];
-                return {
-                  pullRequests,
-                  issues,
-                  comments,
-                  state: stateModule.classifyBootstrapState({
+                const listState = async () => {
+                  const pullRequests = await github.paginate(github.rest.pulls.list, {
+                    ...context.repo,
+                    state: 'all',
+                    per_page: 100,
+                  });
+                  const issues = (await github.paginate(github.rest.issues.listForRepo, {
+                    ...context.repo,
+                    state: 'all',
+                    per_page: 100,
+                  })).filter((issue) => !issue.pull_request);
+                  const preliminary = stateModule.classifyBootstrapState({
                     pullRequests,
                     issues,
-                    comments,
                     defaultBranch: process.env.SQUAD_BOOTSTRAP_DEFAULT_BRANCH,
-                  }),
+                  });
+                  const comments = preliminary.issue
+                    ? await github.paginate(github.rest.issues.listComments, {
+                        ...context.repo,
+                        issue_number: preliminary.issue.number,
+                        per_page: 100,
+                      })
+                    : [];
+                  return {
+                    pullRequests,
+                    issues,
+                    comments,
+                    state: stateModule.classifyBootstrapState({
+                      pullRequests,
+                      issues,
+                      comments,
+                      defaultBranch: process.env.SQUAD_BOOTSTRAP_DEFAULT_BRANCH,
+                    }),
+                  };
                 };
-              };
-
-              let snapshot = await listState();
-              if (snapshot.state.action === 'opt_out') {
-                core.info('A closed-unmerged bootstrap Cast PR records human opt-out; no replacement was created.');
-                return;
-              }
-              if (snapshot.state.action === 'noop') {
-                core.info('The deterministic Cast PR, research-proposals issue, and research artifact already exist.');
-                return;
-              }
 
-              const getRef = async (ref) => {
-                try {
-                  return (await github.rest.git.getRef({ ...context.repo, ref })).data;
-                } catch (error) {
-                  if (error.status === 404) return null;
-                  throw error;
-                }
-              };
-              const assertRemotePayload = async (ref) => {
-                for (const file of payload.files) {
-                  const response = await github.rest.repos.getContent({
-                    ...context.repo,
-                    path: file.path,
-                    ref,
-                  });
-                  if (Array.isArray(response.data) || response.data.type !== 'file') {
-                    throw new Error(`Bootstrap branch path is not a file: ${file.path}`);
-                  }
-                  const remote = Buffer.from(response.data.content, 'base64').toString('utf8').replace(/\r\n/g, '\n');
-                  if (remote !== String(file.content).replace(/\r\n/g, '\n')) {
-                    throw new Error(`Existing bootstrap branch diverges at ${file.path}; refusing replacement.`);
-                  }
+                let snapshot = await listState();
+                if (snapshot.state.action === 'opt_out') {
+                  core.info('A closed-unmerged bootstrap Cast PR records human opt-
```

**File**: `workflows/squad-bootstrap.md` (modified, +343/-343)
```diff
@@ -335,389 +335,389 @@ safe-outputs:
                   writeFileSync(target, file.content);
                 }
                 writeFileSync(payloadPath, payloadText);
-              } finally {
-                rmSync(candidate, { recursive: true, force: true });
-              }
 
-              const listState = async () => {
-                const pullRequests = await github.paginate(github.rest.pulls.list, {
-                  ...context.repo,
-                  state: 'all',
-                  per_page: 100,
-                });
-                const issues = (await github.paginate(github.rest.issues.listForRepo, {
-                  ...context.repo,
-                  state: 'all',
-                  per_page: 100,
-                })).filter((issue) => !issue.pull_request);
-                const preliminary = stateModule.classifyBootstrapState({
-                  pullRequests,
-                  issues,
-                  defaultBranch: process.env.SQUAD_BOOTSTRAP_DEFAULT_BRANCH,
-                });
-                const comments = preliminary.issue
-                  ? await github.paginate(github.rest.issues.listComments, {
-                      ...context.repo,
-                      issue_number: preliminary.issue.number,
-                      per_page: 100,
-                    })
-                  : [];
-                return {
-                  pullRequests,
-                  issues,
-                  comments,
-                  state: stateModule.classifyBootstrapState({
+                const listState = async () => {
+                  const pullRequests = await github.paginate(github.rest.pulls.list, {
+                    ...context.repo,
+                    state: 'all',
+                    per_page: 100,
+                  });
+                  const issues = (await github.paginate(github.rest.issues.listForRepo, {
+                    ...context.repo,
+                    state: 'all',
+                    per_page: 100,
+                  })).filter((issue) => !issue.pull_request);
+                  const preliminary = stateModule.classifyBootstrapState({
                     pullRequests,
                     issues,
-                    comments,
                     defaultBranch: process.env.SQUAD_BOOTSTRAP_DEFAULT_BRANCH,
-                  }),
+                  });
+                  const comments = preliminary.issue
+                    ? await github.paginate(github.rest.issues.listComments, {
+                        ...context.repo,
+                        issue_number: preliminary.issue.number,
+                        per_page: 100,
+                      })
+                    : [];
+                  return {
+                    pullRequests,
+                    issues,
+                    comments,
+                    state: stateModule.classifyBootstrapState({
+                      pullRequests,
+                      issues,
+                      comments,
+                      defaultBranch: process.env.SQUAD_BOOTSTRAP_DEFAULT_BRANCH,
+                    }),
+                  };
                 };
-              };
-
-              let snapshot = await listState();
-              if (snapshot.state.action === 'opt_out') {
-                core.info('A closed-unmerged bootstrap Cast PR records human opt-out; no replacement was created.');
-                return;
-              }
-              if (snapshot.state.action === 'noop') {
-                core.info('The deterministic Cast PR, research-proposals issue, and research artifact already exist.');
-                return;
-              }
 
-              const getRef = async (ref) => {
-                try {
-                  return (await github.rest.git.getRef({ ...context.repo, ref })).data;
-                } catch (error) {
-                  if (error.status === 404) return null;
-                  throw error;
-                }
-              };
-              const assertRemotePayload = async (ref) => {
-                for (const file of payload.files) {
-                  const response = await github.rest.repos.getContent({
-                    ...context.repo,
-                    path: file.path,
-                    ref,
-                  });
-                  if (Array.isArray(response.data) || response.data.type !== 'file') {
-                    throw new Error(`Bootstrap branch path is not a file: ${file.path}`);
-                  }
-                  const remote = Buffer.from(response.data.content, 'base64').toString('utf8').replace(/\r\n/g, '\n');
-                  if (remote !== String(file.content).replace(/\r\n/g, '\n')) {
-                    throw new Error(`Existing bootstrap branch diverges at ${file.path}; refusing replacement.`);
-                  }
+                let snapshot = await listState();
+                if (snapshot.state.action === 'opt_out') {
+                  core.info('A closed-unmerged bootstrap Cast PR records human opt-
```

**File**: `workflows/squad-workflows.manifest.json` (modified, +3/-3)
```diff
@@ -68,9 +68,9 @@
       "source": "workflows/package/squad-bootstrap.md",
       "destination": ".github/workflows/squad-bootstrap.md",
       "lock": ".github/workflows/squad-bootstrap.lock.yml",
-      "source_sha256": "b609e809707bce01cddafed44cab90f70fe4a269f843eda4ee3979f2b6d8f117",
-      "lock_sha256": "d6fb3b52f7aa880bf4b5d93cb7cd95085ff340e09e900596a2802a003fdf5457",
-      "package_lock_sha256": "3f77f39d1c9fa72c8ea5f65af8dc978dbfd47cea7dbb7065415b168a06adb35d"
+      "source_sha256": "10f85600b3e4a8617bbdc70afc95ea975f8d98c1b9e673ca7c15abb293aed7ee",
+      "lock_sha256": "faf0b03fa9ddceefe1cbcc653edb123dc733b484f1a6d0ada8ce7cb08993081f",
+      "package_lock_sha256": "8857134b8a6551b19c4271f814b2cde348eca02efead2d5713eecdcdd45d895c"
     },
     {
       "name": "squad-command-router",
```

---

### Incident Patch 6: `aa2dc2df` (2026-10-02)
**Commit Message**: fix(workflows): repair squad-heartbeat 403 on fork PR close (#2155)

fix(workflows): repair squad-heartbeat 403 on fork PR close

**File**: `.changeset/2155-heartbeat-fork-pr-labels.md` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+---
+"@bradygaster/squad-cli": patch
+"@bradygaster/squad-sdk": patch
+---
+
+Fix `squad-heartbeat.yml`'s "Repair orphaned squad labels" step 403ing when a fork PR closes.
+
+`GITHUB_TOKEN` is forced read-only for `pull_request`-triggered workflow runs originating from a fork, regardless of the workflow's declared `permissions:` block, so `issues.addLabels` was rejected with `403 Resource not accessible by integration`. The trigger is switched to `pull_request_target` across all 5 synced copies (`.github/workflows/`, `templates/workflows/`, `packages/squad-cli/templates/workflows/`, `packages/squad-sdk/templates/workflows/`, `.squad-templates/workflows/`), which runs with base-repo token permissions regardless of fork origin.
+
+This is safe because the `actions/checkout` step never overrides `ref:` (always checks out the base ref, never the fork head), and no step reads or executes anything from the triggering PR's content.
```

**File**: `.github/workflows/squad-heartbeat.yml` (modified, +7/-1)
```diff
@@ -19,7 +19,13 @@ on:
   # React to completed work or new squad work
   issues:
     types: [closed, labeled]
-  pull_request:
+  # pull_request_target (not pull_request): GITHUB_TOKEN is forced read-only
+  # for `pull_request` events triggered by a fork, so write steps below
+  # (addLabels/createComment) 403 on fork PR closes (#2080-class bug).
+  # Safe here because the checkout step below has no `ref:` override, so it
+  # always checks out the BASE ref — no fork code or fork-controlled input
+  # is ever read or executed by this job.
+  pull_request_target:
     types: [closed]
 
   # Manual trigger
```

**File**: `.squad-templates/workflows/squad-heartbeat.yml` (modified, +7/-1)
```diff
@@ -10,7 +10,13 @@ on:
   # React to completed work or new squad work
   issues:
     types: [closed, labeled]
-  pull_request:
+  # pull_request_target (not pull_request): GITHUB_TOKEN is forced read-only
+  # for `pull_request` events triggered by a fork, so write steps below
+  # (addLabels/createComment) 403 on fork PR closes.
+  # Safe here because the checkout step below has no `ref:` override, so it
+  # always checks out the BASE ref — no fork code or fork-controlled input
+  # is ever read or executed by this job.
+  pull_request_target:
     types: [closed]
 
   # Manual trigger
```

**File**: `packages/squad-cli/templates/workflows/squad-heartbeat.yml` (modified, +7/-1)
```diff
@@ -10,7 +10,13 @@ on:
   # React to completed work or new squad work
   issues:
     types: [closed, labeled]
-  pull_request:
+  # pull_request_target (not pull_request): GITHUB_TOKEN is forced read-only
+  # for `pull_request` events triggered by a fork, so write steps below
+  # (addLabels/createComment) 403 on fork PR closes.
+  # Safe here because the checkout step below has no `ref:` override, so it
+  # always checks out the BASE ref — no fork code or fork-controlled input
+  # is ever read or executed by this job.
+  pull_request_target:
     types: [closed]
 
   # Manual trigger
```

**File**: `packages/squad-sdk/templates/workflows/squad-heartbeat.yml` (modified, +7/-1)
```diff
@@ -10,7 +10,13 @@ on:
   # React to completed work or new squad work
   issues:
     types: [closed, labeled]
-  pull_request:
+  # pull_request_target (not pull_request): GITHUB_TOKEN is forced read-only
+  # for `pull_request` events triggered by a fork, so write steps below
+  # (addLabels/createComment) 403 on fork PR closes.
+  # Safe here because the checkout step below has no `ref:` override, so it
+  # always checks out the BASE ref — no fork code or fork-controlled input
+  # is ever read or executed by this job.
+  pull_request_target:
     types: [closed]
 
   # Manual trigger
```

**File**: `templates/workflows/squad-heartbeat.yml` (modified, +7/-1)
```diff
@@ -10,7 +10,13 @@ on:
   # React to completed work or new squad work
   issues:
     types: [closed, labeled]
-  pull_request:
+  # pull_request_target (not pull_request): GITHUB_TOKEN is forced read-only
+  # for `pull_request` events triggered by a fork, so write steps below
+  # (addLabels/createComment) 403 on fork PR closes.
+  # Safe here because the checkout step below has no `ref:` override, so it
+  # always checks out the BASE ref — no fork code or fork-controlled input
+  # is ever read or executed by this job.
+  pull_request_target:
     types: [closed]
 
   # Manual trigger
```

---

### Incident Patch 7: `67d9ed0d` (2026-10-02)
**Commit Message**: fix(cli): validate doctor state files against resolved team root in remote mode (#2057)

squad doctor detected the remote teamRoot correctly but then ran the
team.md/routing.md/agents/casting/decisions checks against the local
.squad/ stub instead of the resolved team root's .squad/, producing
false 'file not found' failures for linked projects even though squad
status and squad cast resolved the team fine.

runDoctor() now uses effectiveSquadDir() (the same dual-root resolver
already used by build/copilot/export/loop/plugin/watch) to compute the
state dir, so it follows the remote teamRoot the same way the rest of
the CLI does. Fixes #2056.

Co-authored-by: Copilot <[REDACTED_EMAIL]>
Co-authored-by: Tamir Dresher <[REDACTED_EMAIL]>
Co-authored-by: Brady Gaster <[REDACTED_EMAIL]>
Co-authored-by: Copilot <[REDACTED_EMAIL]>

**File**: `.changeset/2056-doctor-remote-state-dir.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@bradygaster/squad-cli": patch
+---
+
+`squad doctor` now validates team state files (`team.md`, `routing.md`, `agents/`, `casting/registry.json`, `decisions.md`) against the resolved team root in remote (linked) mode instead of the local `.squad/` stub, which only holds `config.json`. Previously this caused false "file not found" failures for correctly configured `squad link` setups even though `squad status` and `squad cast` resolved the team fine. Fixes #2056.
```

**File**: `packages/squad-cli/src/cli/commands/doctor.ts` (modified, +6/-3)
```diff
@@ -16,7 +16,7 @@ import { FSStorageProvider, resolveStateBackend, type StateBackendType } from '@
 import { readCastingRegistryPair } from '@bradygaster/squad-sdk/casting';
 import { resolveSquadPaths, clearResolveSquadCache } from '@bradygaster/squad-sdk/resolution';
 import { isMutableStateKey, MUTABLE_STATE_PATHS } from '@bradygaster/squad-sdk/tools';
-import { resolveStateDir } from '../core/effective-squad-dir.js';
+import { effectiveSquadDir } from '../core/effective-squad-dir.js';
 
 const storage = new FSStorageProvider();
 
@@ -796,8 +796,11 @@ export async function runDoctor(cwd?: string): Promise<DoctorCheck[]> {
 
   // 5–9 standard files (only if .squad/ exists)
   if (isDirectory(squadDir)) {
-    // Resolve effective state dir for externalized files
-    const stateDir = resolveStateDir(squadDir);
+    // Resolve effective state dir for externalized files and remote team
+    // roots — mirrors the dual-root resolver used by `squad cast`/`squad status`
+    // so linked (remote-mode) projects are validated against the team root's
+    // .squad/ instead of the local stub that only holds config.json (#2056).
+    const { stateDir } = effectiveSquadDir(resolvedCwd);
     checks.push(checkTeamMd(stateDir));
     checks.push(checkRoutingMd(stateDir));
     checks.push(checkAgentsDir(stateDir));
```

**File**: `test/cli/doctor.test.ts` (modified, +33/-0)
```diff
@@ -116,6 +116,39 @@ describe('squad doctor', () => {
     expect(rootCheck?.status).toBe('fail');
   });
 
+  it('validates state files against the resolved team root in remote mode (#2056)', async () => {
+    // Central team root: TEST_ROOT/.squad holds the real team state.
+    await scaffold(TEST_ROOT);
+
+    // Linked project: only .squad/config.json + the agent discovery file,
+    // pointing back at the central root via a relative teamRoot.
+    const linkedProject = join(TEST_ROOT, 'linked-project');
+    await mkdir(join(linkedProject, '.squad'), { recursive: true });
+    await writeFile(
+      join(linkedProject, '.squad', 'config.json'),
+      JSON.stringify({ version: 1, teamRoot: '..', projectKey: null }),
+    );
+    await mkdir(join(linkedProject, '.github', 'agents'), { recursive: true });
+    await writeFile(join(linkedProject, '.github', 'agents', 'squad.agent.md'), '# Squad Agent\n');
+
+    const checks = await runDoctor(linkedProject);
+
+    const rootCheck = checks.find((c: DoctorCheck) => c.name === 'team root resolves');
+    expect(rootCheck?.status).toBe('pass');
+
+    for (const name of [
+      'team.md found with ## Members header',
+      'routing.md found',
+      'agents/ directory exists',
+      'casting/registry.json exists',
+      'decisions.md exists',
+    ]) {
+      const check = checks.find((c: DoctorCheck) => c.name === name);
+      expect(check, `expected a check named "${name}"`).toBeDefined();
+      expect(check?.status, `expected "${name}" to pass, got: ${check?.message}`).toBe('pass');
+    }
+  });
+
   // One row per MUTABLE_STATE_PATHS entry: the state tools could write each of
   // these to the team repo root before #2107. `scaffold()` already puts
   // decisions.md in the team's .squad/, so that row is a merge, not a move.
```

---

### Incident Patch 8: `059b31e7` (2026-10-02)
**Commit Message**: fix(sdk,cli): resolve linked team state for both teamRoot forms (#2119)

teamRoot can name the team repo (what `squad link` writes) or the team's
.squad/ dir (what the docs show), but callers assumed different forms:
effectiveSquadDir and cast appended .squad, while the state MCP server
did not. The docs form broke `squad loop`/`watch`/`cast`; the link form
made squad_decide write decisions outside .squad/.

Add ResolvedSquadPaths.teamSquadDir, which resolves either form to the
team's squad dir (legacy .ai-team included), and use it in
effectiveSquadDir, cast, state-mcp, and the local-backend storage root.
Document on teamDir that callers must not join team-state paths onto it.

`squad doctor` now warns when a linked team repo still holds state-mcp
output outside .squad/. It checks every path the state tools can write
(exported as MUTABLE_STATE_PATHS, with isMutableStateKey) and lists each
.md/.json file to move, or to merge by hand when the same file already
exists under .squad/. It reports only and does not move files.

The SDK changeset is minor because teamSquadDir is a required field on
the exported ResolvedSquadPaths type.

Closes #2107

Co-authored-by: Copilot <[REDACTED_EMA

**File**: `.changeset/2107-linked-team-root-forms.md` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+---
+"@bradygaster/squad-sdk": minor
+"@bradygaster/squad-cli": patch
+---
+
+Linked teams now work with either `teamRoot` form: the team repository (what `squad link` writes) or the team's `.squad/` directory (what the docs show). `resolveSquadPaths()` adds `teamSquadDir`, the team's squad directory for both forms, and `resolveSquadState()` roots local-backend storage there. `squad loop`/`watch`, `squad cast`, and the state MCP server read team state from `teamSquadDir`, so `squad loop` no longer reports "No squad found" for the docs form, and `squad_decide` no longer writes decisions outside `.squad/` for the `squad link` form. Closes #2107.
+
+`teamSquadDir` is a required field on the exported `ResolvedSquadPaths` type, so code that constructs that type must now set it. `@bradygaster/squad-sdk/tools` also exports `MUTABLE_STATE_PATHS` and `isMutableStateKey()`, the list of state paths that the state tools can write.
+
+If you linked a team with `squad link`: state that the state MCP server wrote to the team repo root (`decisions.md`, `decisions/inbox/`, `casting/policy.json`, `agents/*/history.md`, `log/`, `orchestration-log/`, `sessions/`, `.scratch/`, `identity/`) now belongs in `<team>/.squad/`. Squad does not move it. Run `squad doctor` to find leftovers. It lists the `.md` and `.json` files to move to the same relative path under `<team>/.squad/` (for example `<team>/identity/now.md` to `<team>/.squad/identity/now.md`), and the files that already exist there, which you must merge by hand without overwriting the newer state. Do not replace the existing `<team>/.squad/` directories. Skills that `squad_skill` wrote went to `.github/skills/` in the folder that contains the team repo; move any you want to keep to `<team>/.github/skills/`. Doctor does not check that folder.
```

**File**: `docs/src/content/docs/guide/faq.md` (modified, +2/-0)
```diff
@@ -131,6 +131,8 @@ If your project links to a remote team repository:
 
 The path should be relative to your **project root** (where `.squad/` or `squad.config.ts` lives), not to the `.squad/` directory itself.
 
+`teamRoot` can name either the team repository (`"../team-repo"`, which is what `squad link` writes) or its `.squad/` directory (`"../team-repo/.squad"`). Squad resolves both forms to the same team directory.
+
 **Verify the fix:**
 ```bash
 squad doctor
```

**File**: `packages/squad-cli/src/cli/commands/cast.ts` (modified, +9/-8)
```diff
@@ -25,13 +25,11 @@ export async function runCast(cwd: string): Promise<void> {
   }
   
   // Discover project agents.
-  // LocalAgentSource appends .squad/agents to its base path, so we must supply:
-  //   - local mode: parent of paths.projectDir (the repo root)
-  //   - remote mode: paths.teamDir (the team repo root, which itself contains .squad/agents)
-  const agentBase =
-    paths.mode === 'remote'
-      ? paths.teamDir
-      : path.resolve(paths.projectDir, '..');
+  // LocalAgentSource appends .squad/agents to its base path, so local mode
+  // supplies the parent of paths.projectDir (the repo root). Remote mode hands
+  // it the team's agents dir explicitly, because teamRoot may name either the
+  // team repo or its .squad/ dir (#2107).
+  const agentBase = path.resolve(paths.projectDir, '..');
   // #1399: when state is externalized, agents live at <externalStateDir>/agents
   // (no .squad nesting), so the base-path probing above can't reach them —
   // externalize sets teamRoot '.' which lands here as remote mode with a
@@ -42,7 +40,10 @@ export async function runCast(cwd: string): Promise<void> {
     paths.config?.stateLocation === 'external' && paths.config.projectKey
       ? path.join(resolveExternalStateDir(paths.config.projectKey, false), 'agents')
       : undefined;
-  const projectSource = new LocalAgentSource(agentBase, undefined, undefined, externalAgentsDir);
+  const agentsDir =
+    externalAgentsDir
+    ?? (paths.mode === 'remote' ? path.join(paths.teamSquadDir, 'agents') : undefined);
+  const projectSource = new LocalAgentSource(agentBase, undefined, undefined, agentsDir);
   const projectAgents = await projectSource.listAgents();
   
   // Discover personal agents
```

**File**: `packages/squad-cli/src/cli/commands/doctor.ts` (modified, +75/-0)
```diff
@@ -14,6 +14,8 @@ import path from 'node:path';
 import { execFile, execFileSync } from 'node:child_process';
 import { FSStorageProvider, resolveStateBackend, type StateBackendType } from '@bradygaster/squad-sdk';
 import { readCastingRegistryPair } from '@bradygaster/squad-sdk/casting';
+import { resolveSquadPaths, clearResolveSquadCache } from '@bradygaster/squad-sdk/resolution';
+import { isMutableStateKey, MUTABLE_STATE_PATHS } from '@bradygaster/squad-sdk/tools';
 import { resolveStateDir } from '../core/effective-squad-dir.js';
 
 const storage = new FSStorageProvider();
@@ -158,6 +160,77 @@ function checkTeamRootResolves(squadDir: string, teamRoot: string): DoctorCheck
   };
 }
 
+/** Squad writes state as .md and .json; other files in a code dir named log/ etc. are not ours. */
+const STRAY_STATE_FILE = /\.(md|json)$/;
+const STRAY_STATE_MAX_DEPTH = 4;
+const STRAY_STATE_LIST_LIMIT = 10;
+
+/** Push `/`-separated keys of files under `base/rel`. Skips dirs it cannot list. */
+function collectFileKeys(base: string, rel: string, depth: number, out: string[]): void {
+  let entries: string[];
+  try {
+    entries = storage.listSync(path.join(base, rel));
+  } catch {
+    return;
+  }
+  for (const name of entries) {
+    const key = `${rel}/${name}`;
+    const full = path.join(base, key);
+    if (isDirectory(full)) {
+      if (depth > 1) collectFileKeys(base, key, depth - 1, out);
+    } else {
+      out.push(key);
+    }
+  }
+}
+
+function formatKeyList(keys: string[]): string {
+  const shown = keys.slice(0, STRAY_STATE_LIST_LIMIT).join(', ');
+  return keys.length > STRAY_STATE_LIST_LIMIT ? `${shown}, and ${keys.length - STRAY_STATE_LIST_LIMIT} more` : shown;
+}
+
+/**
+ * Before #2107, a `squad link` project (teamRoot = the team repo) made the
+ * state MCP server write team state to `<teamRoot>/<key>` instead of
+ * `<teamRoot>/.squad/<key>`. Squad no longer reads those files. Report every
+ * state-tool path (MUTABLE_STATE_PATHS) found there, split into files to move
+ * and files to merge by hand because a newer copy exists. Read-only.
+ */
+function checkStrandedLinkedTeamState(squadDir: string): DoctorCheck | undefined {
+  // Doctor must see the current disk, not a walk cached by an earlier call.
+  clearResolveSquadCache();
+  const paths = resolveSquadPaths(path.dirname(squadDir));
+  if (!paths || paths.mode !== 'remote' || paths.projectDir !== path.resolve(squadDir)) return undefined;
+  if (paths.teamSquadDir === paths.teamDir) return undefined;
+
+  const candidates: string[] = [];
+  for (const { root, kind } of MUTABLE_STATE_PATHS) {
+    const full = path.join(paths.teamDir, root);
+    if (kind === 'file') {
+      if (fileExists(full) && !isDirectory(full)) candidates.push(root);
+    } else if (isDirectory(full)) {
+      collectFileKeys(paths.teamDir, root, STRAY_STATE_MAX_DEPTH, candidates);
+    }
+  }
+  // Match only what the state tools could write, so an unrelated code dir
+  // named agents/ or log/ does not trigger advice to move it.
+  const stray = candidates.filter(key => isMutableStateKey(key) && STRAY_STATE_FILE.test(key));
+  if (stray.length === 0) return undefined;
+
+  const toMerge = stray.filter(key => fileExists(path.join(paths.teamSquadDir, key)));
+  const toMove = stray.filter(key => !toMerge.includes(key));
+  const parts = [
+    `found ${stray.length} team state file(s) in ${paths.teamDir}, outside the team's squad dir. Squad now reads team state from ${paths.teamSquadDir}.`,
+  ];
+  // teamSquadDir normally has its own agents/ and decisions/, so tell the user
+  // to move files, not to move (and replace) the directories.
+  if (toMove.length > 0) parts.push(`Move each file to the same relative path under it: ${formatKeyList(toMove)}.`);
+  if (toMerge.length > 0) parts.push(`A file already exists at the same relative path for these; merge by hand and do not overwrite the newer state: ${formatKeyList(toMerge)}.`);
+  parts.push('Do not replace the existing directories there.');
+
+  return { name: 'linked team state location', status: 'warn', message: parts.join(' ') };
+}
+
 function checkTeamMd(squadDir: string): DoctorCheck {
   const teamPath = path.join(squadDir, 'team.md');
   if (!fileExists(teamPath)) {
@@ -717,6 +790,8 @@ export async function runDoctor(cwd?: string): Promise<DoctorCheck[]> {
   // 4. Remote team root resolution
   if (mode === 'remote' && teamRoot) {
     checks.push(checkTeamRootResolves(squadDir, teamRoot));
+    const strayState = checkStrandedLinkedTeamState(squadDir);
+    if (strayState) checks.push(strayState);
   }
 
   // 5–9 standard files (only if .squad/ exists)
```

**File**: `packages/squad-cli/src/cli/commands/state-mcp.ts` (modified, +1/-1)
```diff
@@ -69,7 +69,7 @@ export function createStateMcpToolRegistry(startDir: string): ToolRegistry {
   if (!context) {
     throw new Error(`No .squad directory found from ${startDir}`);
   }
-  return new ToolRegistry(context.paths.teamDir, undefined, context.storage);
+  return new ToolRegistry(context.paths.teamSquadDir, undefined, context.storage);
 }
 
 function normalizeToolResult(result: unknown): { content: Array<{ type: 'text'; text: string }>; isError?: boolean } {
```

**File**: `packages/squad-cli/src/cli/core/effective-squad-dir.ts` (modified, +1/-2)
```diff
@@ -7,7 +7,6 @@
  * @module cli/core/effective-squad-dir
  */
 
-import path from 'node:path';
 import { detectSquadDir, type SquadDirInfo } from './detect-squad-dir.js';
 import {
   loadDirConfig,
@@ -52,7 +51,7 @@ export function effectiveSquadDir(dest: string): EffectiveSquadDirs {
   const paths = resolveSquadPaths(dest);
   const teamSquadDir =
     paths?.mode === 'remote'
-      ? path.join(paths.teamDir, paths.name)
+      ? paths.teamSquadDir
       : local.path;
   return {
     local,
```

**File**: `packages/squad-sdk/src/resolution.ts` (modified, +36/-3)
```diff
@@ -132,8 +132,19 @@ export interface ResolvedSquadPaths {
   mode: 'local' | 'remote';
   /** Project-local .squad/ (decisions, logs) */
   projectDir: string;
-  /** Team identity root (agents, casting, skills) */
+  /**
+   * Team identity root, exactly as configured. In remote mode this is the
+   * resolved `teamRoot`, which may be either the team repo (parent of
+   * `.squad/`) or the team's `.squad/` dir itself. Do not join team-state
+   * paths (`.squad`, `agents/`, `decisions/`) onto it — the result depends on
+   * which form the user wrote. Use {@link ResolvedSquadPaths.teamSquadDir}.
+   */
   teamDir: string;
+  /**
+   * The team's squad directory (team.md, agents/, casting/), whichever form
+   * `teamRoot` uses. Equals projectDir in local mode.
+   */
+  teamSquadDir: string;
   /** User's personal squad dir, null if not found or disabled */
   personalDir: string | null;
   config: SquadDirConfig | null;
@@ -344,6 +355,26 @@ export function isConsultMode(config: SquadDirConfig | null): boolean {
   return config?.consult === true;
 }
 
+/**
+ * Resolve the team's squad directory from a remote `teamRoot` (#2107).
+ *
+ * `squad link` writes `teamRoot` as the team repo (the parent of `.squad/`),
+ * while the docs show the team's `.squad/` dir itself; the coordinator accepts
+ * both. Prefer a nested squad dir; otherwise use teamDir when it already is
+ * one. Falls back to the nested path so a missing team reports "not found".
+ */
+function resolveTeamSquadDir(teamDir: string, name: '.squad' | '.ai-team'): string {
+  const names = name === '.squad' ? ['.squad', '.ai-team'] : ['.ai-team', '.squad'];
+  for (const candidate of names) {
+    const nested = path.join(teamDir, candidate);
+    if (storage.existsSync(nested) && storage.isDirectorySync(nested)) return nested;
+  }
+  if (names.includes(path.basename(teamDir)) || storage.existsSync(path.join(teamDir, 'team.md'))) {
+    return teamDir;
+  }
+  return path.join(teamDir, name);
+}
+
 /**
  * Resolve dual-root squad paths (projectDir / teamDir).
  *
@@ -377,6 +408,7 @@ export function resolveSquadPaths(startDir?: string): ResolvedSquadPaths | null
       mode: 'remote',
       projectDir,
       teamDir,
+      teamSquadDir: resolveTeamSquadDir(teamDir, name),
       personalDir: resolvePersonalSquadDir(),
       config,
       name,
@@ -389,6 +421,7 @@ export function resolveSquadPaths(startDir?: string): ResolvedSquadPaths | null
     mode: 'local',
     projectDir,
     teamDir: projectDir,
+    teamSquadDir: projectDir,
     personalDir: resolvePersonalSquadDir(),
     config,
     name,
@@ -851,12 +884,12 @@ export function resolveSquadState(startDir?: string, cliOverride?: StateBackendT
 
   // For local backend, use FSStorageProvider directly (more capable).
   // For git-notes/orphan, bridge via StateBackendStorageAdapter.
-  // rootDir is paths.teamDir (matches the squadRoot every local-backend
+  // rootDir is paths.teamSquadDir (matches the squadRoot every local-backend
   // caller — e.g. ToolRegistry in state-mcp.ts — builds its paths against),
   // so the traversal guard actually validates instead of no-op'ing on an
   // unset rootDir and letting a bad upstream path resolve silently.
   const stateStorage: StorageProvider = backend.name === 'local'
-    ? new FSStorageProvider(paths.teamDir)
+    ? new FSStorageProvider(paths.teamSquadDir)
     : new StateBackendStorageAdapter(backend, paths.projectDir);
 
   return { paths, backend, repoRoot, storage: stateStorage };
```

**File**: `packages/squad-sdk/src/tools/index.ts` (modified, +23/-15)
```diff
@@ -255,23 +255,31 @@ function normalizeStateToolDir(dir?: string): string {
   return normalized;
 }
 
-const MUTABLE_CASTING_STATE_KEYS = new Set([
-  'casting/policy.json',
-]);
+/**
+ * State paths, relative to the squad dir, that the state tools may write.
+ * `root` is a file or the directory to search; `pattern`, when set, is the
+ * only key shape allowed under that directory.
+ */
+export const MUTABLE_STATE_PATHS: ReadonlyArray<{ readonly root: string; readonly kind: 'file' | 'dir'; readonly pattern?: RegExp }> = [
+  { root: 'decisions.md', kind: 'file' },
+  { root: 'decisions/inbox', kind: 'dir' },
+  { root: 'casting/policy.json', kind: 'file' },
+  { root: 'agents', kind: 'dir', pattern: /^agents\/[a-zA-Z0-9_-]+\/history\.md$/ },
+  { root: 'log', kind: 'dir' },
+  { root: 'orchestration-log', kind: 'dir' },
+  { root: 'sessions', kind: 'dir' },
+  { root: '.scratch', kind: 'dir' },
+  { root: 'identity', kind: 'dir' },
+];
+
+/** True when the state tools may write `key` (a normalized, `/`-separated state key). */
+export function isMutableStateKey(key: string): boolean {
+  return MUTABLE_STATE_PATHS.some(({ root, kind, pattern }) =>
+    kind === 'file' ? key === root : key.startsWith(`${root}/`) && (!pattern || pattern.test(key)));
+}
 
 function validateMutableStateToolKey(key: string): void {
-  const isMutable =
-    key === 'decisions.md' ||
-    key.startsWith('decisions/inbox/') ||
-    MUTABLE_CASTING_STATE_KEYS.has(key) ||
-    /^agents\/[a-zA-Z0-9_-]+\/history\.md$/.test(key) ||
-    key.startsWith('log/') ||
-    key.startsWith('orchestration-log/') ||
-    key.startsWith('sessions/') ||
-    key.startsWith('.scratch/') ||
-    key.startsWith('identity/');
-
-  if (!isMutable) {
+  if (!isMutableStateKey(key)) {
     throw new Error(
       'State mutations are limited to mutable runtime state (decisions, inbox, casting policy, logs, sessions, scratch files, agent history, and identity). The casting registry/history pair must only be changed through the atomic casting protocol. Static config such as config.json, team.md, routing.md, charters, templates, and skills must not be changed with state tools.',
     );
```

---

### Incident Patch 9: `b846a1dd` (2026-10-02)
**Commit Message**: fix(casting): make durable casting registry work on Windows (#2114)

squad init and team casting failed on Windows with
"EPERM: operation not permitted, fsync" (regression from #2066).

- flushDirectory() fsynced directory handles after each rename, which
  Windows rejects. Skip it on win32; the file-level fsync already ran.
- The lock publishes by renaming a candidate dir onto registry.lock.
  Windows reports a rename onto an existing directory as EPERM, not
  ENOTEMPTY/EEXIST, so a contended lock crashed instead of waiting.
  Treat win32 EPERM as contention in the sync and async acquirers, and
  name the last publish error in the timeout so a real permission
  problem isn't blamed on a phantom writer.
- Lock release retries the quarantine rename on transient win32
  EPERM/EACCES/EBUSY (antivirus holding a fresh owner.json) for up to
  1s, since a leftover registry.lock.recovery blocks every later
  writer. Deleting the already-quarantined copy is best-effort on win32.
- A blocked quarantine delete could leave registry.lock.released-*
  folders in .squad/casting/ with no later cleanup. Release now sweeps
  abandoned lock quarantines while holding the recovery guard; guard
  quaran

**File**: `.changeset/2106-windows-durable-casting.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@bradygaster/squad-sdk": patch
+---
+
+Fix `squad init` and team casting failing on Windows with `EPERM: operation not permitted, fsync`. The durable casting registry fsynced directory handles after each rename, which Windows rejects; directory flushes are now skipped on `win32`, where the file-level fsync is the only flush available. Also fixed the casting writer lock crashing with `EPERM ... rename` instead of waiting when another process already holds it on Windows, which reports a rename onto an existing directory as `EPERM` rather than POSIX `ENOTEMPTY`/`EEXIST`. Lock timeouts now name the last publish error, and releasing the lock retries briefly when Windows transiently rejects the directory rename (e.g. antivirus holding a freshly written file), instead of leaving a recovery guard that blocks later casting writers. If Windows still blocks deleting the released lock copy, release succeeds and a later release sweeps the leftover out of `.squad/casting/`.
```

**File**: `packages/squad-sdk/src/casting/durable-registry.ts` (modified, +105/-8)
```diff
@@ -190,6 +190,10 @@ function readText(filePath: string): string | undefined {
 }
 
 function flushDirectory(directoryPath: string): void {
+  // Directory fsync is a POSIX durability step for rename. Windows rejects
+  // FlushFileBuffers on a directory handle with EPERM and has no equivalent;
+  // the file-level fsync before rename is the only flush available there.
+  if (process.platform === 'win32') return;
   const descriptor = openSync(directoryPath, 'r');
   try {
     fsyncSync(descriptor);
@@ -301,6 +305,76 @@ function ownerPath(lockDirectory: string): string {
   return path.join(lockDirectory, 'owner.json');
 }
 
+const WIN32_TRANSIENT_FS_CODES = ['EPERM', 'EACCES', 'EBUSY'];
+const WIN32_RENAME_RETRY_MS = 1_000;
+
+// Windows fails a directory rename while another process (antivirus, indexer)
+// briefly holds a handle to a freshly written file inside it. Quarantine
+// targets are unique paths, so these codes cannot mean "target exists" here.
+function renameWithTransientRetry(from: string, to: string): void {
+  const deadline = now() + WIN32_RENAME_RETRY_MS;
+  while (true) {
+    try {
+      renameSync(from, to);
+      return;
+    } catch (error) {
+      const code = (error as NodeJS.ErrnoException).code ?? '';
+      if (
+        process.platform !== 'win32'
+        || !WIN32_TRANSIENT_FS_CODES.includes(code)
+        || now() >= deadline
+      ) {
+        throw error;
+      }
+      wait(LOCK_RETRY_MS);
+    }
+  }
+}
+
+// The quarantine rename already moved ownership off the lock path, so this
+// delete is cleanup. On win32 a lingering handle must not fail release; the
+// uniquely named leftover is ignored by every reader of the casting dir.
+function removeQuarantine(quarantinePath: string): void {
+  if (process.platform !== 'win32') {
+    rmSync(quarantinePath, { recursive: true });
+    return;
+  }
+  try {
+    rmSync(quarantinePath, { recursive: true, maxRetries: 3 });
+  } catch (error) {
+    if (!WIN32_TRANSIENT_FS_CODES.includes((error as NodeJS.ErrnoException).code ?? '')) throw error;
+  }
+}
+
+const QUARANTINE_NAME = /^registry\.lock(\.recovery)?\.(?:released|stale)-/;
+
+// Best-effort cleanup of quarantines whose delete was abandoned, which would
+// otherwise accumulate in the committed casting directory. Call only while
+// holding the recovery guard: every lock quarantine happens under it, but a
+// guard quarantines itself after giving it up, so a guard leftover is removed
+// only once it is older than any live guard.
+function sweepAbandonedQuarantines(castingDir: string): void {
+  try {
+    const staleAge = hooks?.staleLockAgeMs ?? DEFAULT_STALE_LOCK_AGE_MS;
+    for (const name of readdirSync(castingDir)) {
+      const match = QUARANTINE_NAME.exec(name);
+      if (!match) continue;
+      const entry = path.join(castingDir, name);
+      try {
+        if (match[1]) {
+          const owner = parseOwner(readText(ownerPath(entry)));
+          if (!owner || now() - Date.parse(owner.created_at) < staleAge) continue;
+        }
+        rmSync(entry, { recursive: true, force: true });
+      } catch {
+        // Still held; a later release retries.
+      }
+    }
+  } catch {
+    // Cleanup must never fail a release that already succeeded.
+  }
+}
+
 function createOwnedDirectory(directoryPath: string, token: string): LockOwner {
   mkdirSync(directoryPath);
   const owner: LockOwner = {
@@ -341,7 +415,7 @@ function quarantineOwnedDirectory(
     directoryPath,
   );
   try {
-    renameSync(directoryPath, quarantinePath);
+    renameWithTransientRetry(directoryPath, quarantinePath);
   } catch (error) {
     if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
     throw error;
@@ -357,7 +431,7 @@ function quarantineOwnedDirectory(
     if (!existsSync(directoryPath)) renameSync(quarantinePath, directoryPath);
     throw new Error(`Casting lock ownership changed while quarantining ${directoryPath}`);
   }
-  rmSync(quarantinePath, { recursive: true });
+  removeQuarantine(quarantinePath);
   flushDirectory(path.dirname(directoryPath));
   return true;
 }
@@ -382,6 +456,25 @@ function acquireRecoveryGuard(lockPath: string): { token: string; release: () =>
   };
 }
 
+/**
+ * Whether publishing the candidate lock directory failed because another
+ * writer already holds the lock. POSIX reports a non-empty rename target as
+ * EEXIST/ENOTEMPTY; Windows (MoveFileEx onto an existing directory) reports
+ * EPERM.
+ */
+function isLockPublishContention(error: unknown): boolean {
+  const code = (error as NodeJS.ErrnoException).code ?? '';
+  if (['EEXIST', 'ENOTEMPTY', 'ENOTDIR'].includes(code)) return true;
+  return process.platform === 'win32' && code === 'EPERM';
+}
+
+// Win32 EPERM is ambiguous (held lock vs. a real permission problem), so the
+// timeout names the last publish error instead of only blaming a writer.
+function lockTimeoutError(purpose: string, lockPath: string, lastPublishCode: string | undefined): Error {
+  co
```

**File**: `test/casting-durable-registry-windows.test.ts` (added, +270/-0)
```diff
@@ -0,0 +1,270 @@
+import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
+import { basename, join } from 'node:path';
+import { tmpdir } from 'node:os';
+import { afterEach, describe, expect, it, vi } from 'vitest';
+
+// Emulate Windows filesystem semantics on any host (issue #2106):
+// - FlushFileBuffers on a directory handle fails with EPERM (file handles flush normally).
+// - MoveFileEx onto an existing directory fails with EPERM instead of POSIX ENOTEMPTY/EEXIST.
+// - Optionally, a directory rename into release quarantine fails with a transient code a set
+//   number of times per source path, as when antivirus briefly holds a freshly written owner.json.
+// - Optionally, deleting a release quarantine fails with a given code.
+const fsFaults = vi.hoisted(() => ({
+  releaseRenameFailuresPerPath: 0,
+  releaseRenameCode: 'EPERM',
+  injected: new Map<string, number>(),
+  quarantineRemoveCode: null as string | null,
+  directoryFsyncEperm: true,
+}));
+
+const WIN32_TRANSIENT_CODES = ['EPERM', 'EACCES', 'EBUSY'] as const;
+
+vi.mock('node:fs', async (importOriginal) => {
+  const actual = await importOriginal<typeof import('node:fs')>();
+  const fsError = (code: string, syscall: string): Error =>
+    Object.assign(new Error(`${code}: simulated failure, ${syscall}`), { code, syscall });
+  const eperm = (syscall: string): Error =>
+    Object.assign(new Error(`EPERM: operation not permitted, ${syscall}`), { code: 'EPERM', syscall });
+  const fsyncSync = vi.fn((descriptor: number) => {
+    if (actual.fstatSync(descriptor).isDirectory()) {
+      // With the fault off, emulate a POSIX host where directory fsync succeeds.
+      if (fsFaults.directoryFsyncEperm) throw eperm('fsync');
+      return undefined;
+    }
+    return actual.fsyncSync(descriptor);
+  });
+  const rmSync = vi.fn((target: string, options?: import('node:fs').RmOptions) => {
+    if (fsFaults.quarantineRemoveCode && String(target).includes('.released-')) {
+      throw fsError(fsFaults.quarantineRemoveCode, 'rmdir');
+    }
+    return actual.rmSync(target, options);
+  });
+  const renameSync = vi.fn((from: string, to: string) => {
+    if (process.platform === 'win32' && String(to).includes('.released-')) {
+      const seen = fsFaults.injected.get(String(from)) ?? 0;
+      if (seen < fsFaults.releaseRenameFailuresPerPath) {
+        fsFaults.injected.set(String(from), seen + 1);
+        throw fsError(fsFaults.releaseRenameCode, 'rename');
+      }
+    }
+    try {
+      return actual.renameSync(from, to);
+    } catch (error) {
+      const code = (error as NodeJS.ErrnoException).code;
+      if (process.platform === 'win32' && (code === 'ENOTEMPTY' || code === 'EEXIST')) {
+        throw eperm('rename');
+      }
+      throw error;
+    }
+  });
+  const overrides = { fsyncSync, renameSync, rmSync };
+  return { ...actual, ...overrides, default: { ...actual, ...overrides } };
+});
+
+const {
+  _setCastingDurabilityHooksForTesting,
+  acquireCastingRegistryLock,
+  acquireCastingRegistryLockAsync,
+  ensureCastingRegistryPair,
+} = await import('../packages/squad-sdk/src/casting/durable-registry.js');
+
+const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')!;
+const roots: string[] = [];
+
+function setPlatform(platform: NodeJS.Platform): void {
+  Object.defineProperty(process, 'platform', { ...originalPlatform, value: platform });
+}
+
+function castingDir(name: string): string {
+  const root = join(tmpdir(), `squad-durable-win-${name}-${process.pid}-${Date.now()}`);
+  roots.push(root);
+  const dir = join(root, '.squad', 'casting');
+  mkdirSync(dir, { recursive: true });
+  return dir;
+}
+
+function useFastLockClock(): { advance: (milliseconds: number) => void } {
+  let clock = Date.now();
+  _setCastingDurabilityHooksForTesting({
+    now: () => clock,
+    wait: milliseconds => { clock += milliseconds; },
+    lockTimeoutMs: 50,
+  });
+  return { advance: milliseconds => { clock += milliseconds; } };
+}
+
+const registryRaw = JSON.stringify({
+  schema: 'squad-agent-provenance/v1',
+  schema_version: 1,
+  revision: 1,
+  generated_at: '2026-09-20T00:00:00.000Z',
+  agents: {},
+}, null, 2) + '\n';
+const historyRaw = JSON.stringify({
+  assignment_cast_snapshots: {},
+  universe_usage_history: [],
+}, null, 2) + '\n';
+
+afterEach(() => {
+  fsFaults.releaseRenameFailuresPerPath = 0;
+  fsFaults.releaseRenameCode = 'EPERM';
+  fsFaults.injected.clear();
+  fsFaults.quarantineRemoveCode = null;
+  fsFaults.directoryFsyncEperm = true;
+  _setCastingDurabilityHooksForTesting(null);
+  Object.defineProperty(process, 'platform', originalPlatform);
+  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
+});
+
+describe('casting registry durability on Windows filesystem semantics (#2106)', () => {
+  it('initializes the casting pair on win32 when directory fsync returns EPERM', () => {
+    setPlatform('win32');
+    const dir = c
```

**File**: `test/casting-durable-registry.test.ts` (modified, +3/-2)
```diff
@@ -10,6 +10,7 @@ import {
 import { hostname } from 'node:os';
 import { join } from 'node:path';
 import { tmpdir } from 'node:os';
+import { pathToFileURL } from 'node:url';
 import { spawn, spawnSync } from 'node:child_process';
 import { afterEach, describe, expect, it } from 'vitest';
 import {
@@ -264,7 +265,7 @@ describe('casting registry directory lock', () => {
       'packages/squad-sdk/src/casting/durable-registry.ts',
     );
     const script = `
-      import { acquireCastingRegistryLock } from ${JSON.stringify(modulePath)};
+      import { acquireCastingRegistryLock } from ${JSON.stringify(pathToFileURL(modulePath).href)};
       import { appendFileSync } from 'node:fs';
       const castingDir = process.argv[1];
       const logPath = process.argv[2];
@@ -469,7 +470,7 @@ describe('casting registry/history roll-forward transaction', () => {
         import {
           _setCastingDurabilityHooksForTesting,
           commitCastingRegistryPair,
-        } from ${JSON.stringify(modulePath)};
+        } from ${JSON.stringify(pathToFileURL(modulePath).href)};
         import { readFileSync } from 'node:fs';
         import { join } from 'node:path';
         const failure = process.argv[1];
```

---

### Incident Patch 10: `ccb54420` (2026-10-02)
**Commit Message**: feat: establish Squad Core, Charter, and draft specification suite (#2069) (#2074)

* feat: formalize Squad charter profile

Part of #2069

Co-authored-by: Copilot App <[REDACTED_EMAIL]>

fix: complete charter profile conformance

Part of #2069

Co-authored-by: Copilot App <[REDACTED_EMAIL]>

docs: remove specification trailing whitespace

Part of #2069

Co-authored-by: Copilot App <[REDACTED_EMAIL]>

Source-Commit: d21ab99fa90c9df315b2897123f74231d12c1656

* fix: enforce portable charter conformance

Part of #2069

Co-authored-by: Copilot App <[REDACTED_EMAIL]>

Source-Commit: ab80da18087b7d37755db2c3cc5880d194a10f52

* fix: complete charter conformance gate

Part of #2069

Co-authored-by: Copilot App <[REDACTED_EMAIL]>

Source-Commit: f7d430a78e38dc00496f1799d76398df0f2a4884

* fix: enforce charter manifest schema

Part of #2069

Co-authored-by: Copilot App <[REDACTED_EMAIL]>

Source-Commit: 71634fde5ce288868fa2ff00ddfcb8dc7c58d3ee

* docs: draft Squad specification suite

Part of #2069

Co-authored-by: Copilot App <[REDACTED_EMAIL]>
(cherry picked from commit c03ba950fde071c8ec58a64504fdb7b5cf1206ef)

* fix: revise specification suite publication claims

Part of #2069

Co-author

**File**: `.changeset/formalize-charter-profile.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@bradygaster/squad-sdk': minor
+---
+
+Add the draft `squad-charter/v0.1` artifact profile, explicit conformance profile selection, validation-before-runtime compilation, typed diagnostics and operation-exact capability metadata, canonical and lossless extension-preserving serialization, a schema-defined language-neutral conformance manifest with complete diagnostic coverage, and implementation-independent specification documents.
```

**File**: `.gitattributes` (modified, +4/-1)
```diff
@@ -56,4 +56,7 @@ Dockerfile.* text eol=lf
 # Squad: union merge for append-only team state files
 .squad/fact-checker/audit-trail.md merge=union
 
-.github/workflows/*.lock.yml linguist-generated=true
\ No newline at end of file
+.github/workflows/*.lock.yml linguist-generated=true
+
+# Charter conformance binds exact document bytes across platform checkouts.
+docs/specification/charter-v0.1.md text eol=lf
\ No newline at end of file
```

**File**: `docs/specification/README.md` (added, +169/-0)
```diff
@@ -0,0 +1,169 @@
+# Squad Specification
+
+**Core version:** 0.1
+
+**Status:** Working Draft
+
+**Draft date:** 2026-09-25
+
+**Working-draft provenance:** [PR #2074](https://github.com/bradygaster/squad/pull/2074)
+contains the combined Core, Charter, and suite revision. The suite draft
+originated in [PR #2078](https://github.com/bradygaster/squad/pull/2078);
+the combined branch preserves its source-commit provenance.
+
+The source index keeps `publication.revision` and `publication.digest` null
+while it is a working draft. After review, the exact head SHA is recorded in
+the PR body and review report. A publication pipeline may copy the source index
+into a release artifact, set `publication.status` to `published`, insert that
+already-existing reviewed head SHA, and compute the release artifact digest.
+The derived release index is attached to the tag or release; it is not committed
+back onto the same commit. This records an immutable revision in the suite
+index without a self-referential hash that would invalidate the commit.
+
+Publication metadata is not a conformance-claim binding. Every claimable
+profile instead carries a non-null `revision` object in the suite registry and
+its executable manifest. For Charter v0.1, that object binds the exact Charter
+document bytes and the canonical manifest evidence payload with SHA-256
+digests. This makes working-draft claims reproducible while publication
+metadata remains null.
+
+**Document class:** Informative registry and navigation index
+
+**Foundation profile:** [Squad Charter Profile v0.1](charter-v0.1.md)
+
+This directory maps a working inventory of stable or observable Squad surfaces,
+including composition and initialization capabilities without profiles in
+the [artifact inventory](artifact-inventory.md). It does not yet specify the
+complete model for how independent Squads compose and interact. Publication
+status is independent from maturity: this suite is an unpublished working
+draft. Charter is the only profile with executable conformance evidence.
+
+## Maturity taxonomy
+
+The suite uses exactly five maturity values:
+
+| Maturity | Meaning | Claimable |
+|---|---|---|
+| `executable-normative-draft` | Normative working draft with an executable manifest and schema | Yes, only identifiers declared by that manifest; not published |
+| `experimental-normative-draft` | Normative working draft whose rules are exercised only through dependent profiles or partial evidence | No standalone claims |
+| `experimental-schema` | Machine-valid schema or fixture, but no complete conformance manifest | No |
+| `requirements-draft` | Conceptual and behavioral requirements awaiting portable fixtures | No |
+| `informative-draft` | Coverage, observations, or volatile requirements | No |
+
+The document-class vocabulary is `normative-profile`, `normative-schema`,
+`requirements`, and `informative`. The only conformance-class vocabulary is
+`canonical`, `compatible`, `legacy`, and `runtime`. Implementation roles
+(`producer`, `consumer`, `editor`, `validator`, and `executor`) describe what
+software does; they are not claims.
+
+Capability identifiers use one grammar:
+`squad-<profile>/v<major>.<minor>/<operation>`. The suite defines no `#operation`
+alias. A registry entry without an executable manifest has no claimable
+capabilities or conformance classes.
+
+## Document registry
+
+`Schema/manifest` uses `schema`, `manifest`, `fixture`, or `none`. Known
+deviations are summarized here and expanded in the
+[coverage matrix](artifact-inventory.md#known-unstable-and-non-conforming-behavior).
+
+| ID | Maturity / class | Dependencies | Claimable capabilities | Schema/manifest | Implementation status | Known deviations | Reader entry path |
+|---|---|---|---|---|---|---|---|
+| `squad-core/v0.1` | `experimental-normative-draft` / normative profile | None | None | None | Normative rules are exercised by Charter; no standalone Core manifest | Canonical JSON and standalone Core cases incomplete | [Core](core-v0.1.md), then Charter |
+| `squad-interop/v0.1` | `requirements-draft` / requirements | Core | None | Reference evidence schema; no manifest | Schema and example records inform future profile design | No discovery, relational-invariant, or replay corpus | [Interoperability](interoperability-conventions-v0.1.md) |
+| `squad-charter/v0.1` | `executable-normative-draft` / normative profile | Core | `squad-charter/v0.1/parse`, `squad-charter/v0.1/validate`, `squad-charter/v0.1/edit`, `squad-charter/v0.1/legacy-consume`, `squad-charter/v0.1/runtime` | Manifest, schema, and immutable revision binding | Parser, validator, editor, compiler, and cases implemented | None registered | [Charter](charter-v0.1.md) |
+| `squad-team-routing/v0.1` | `requirements-draft` / requirements | Core, Interop, Charter | None | None | Roster and routing exist in multiple shapes | Fallback and ambiguity differ | [Roster, then routing](team-routing-v0.1.md) |
+| `squad-configurat
```

**File**: `docs/specification/artifact-inventory.md` (added, +144/-0)
```diff
@@ -0,0 +1,144 @@
+# Squad Artifact Inventory
+
+**Document class:** Informative
+
+**Audit date:** 2026-09-25
+
+**Purpose:** Repository-derived traceability, profile planning, and
+interoperability maturity evidence for issue #2069.
+
+Artifact paths such as `agents/{id}/charter.md` are Squad-root-relative;
+repository-local installations render them beneath `.squad/`. Implementation
+links instead point to repository source, templates, and tests.
+
+This is a working inventory, not a complete specification of Squad composition.
+The current suite focuses on artifacts and behavior within one Squad, with
+separate observations of existing composition surfaces below. SubSquads,
+upstream inheritance, peer discovery, and cross-Squad delegation have different
+semantics; none acquires a portable contract from being listed here.
+
+| Capability | Implementation / artifacts | Spec status | Spec coverage | What's missing |
+|---|---|---|---|---|
+| Discovery, negotiation, authority identity, shared evidence, secrets | Core/profile metadata, registry IDs, events, audit records | Requirements draft with a reference schema; no claim | Interoperability Conventions v0.1 | Discovery, relational invariants, and negotiation need portable manifests and cases |
+| Core rules | profile identifiers, paths, diagnostics, trust boundary | Experimental normative working draft; no standalone claim | Core v0.1 | Charter depends on and exercises Core rules, but Core has no standalone manifest |
+| Agent charter | `agents/{id}/charter.md`; [compiler](../../packages/squad-sdk/src/agents/charter-compiler.ts), [validator](../../packages/squad-sdk/src/agents/charter-validator.ts), [fixture manifest](../../test-fixtures/spec/charter-v0.1/manifest.json) | Executable normative working draft | [Charter v0.1](charter-v0.1.md) | Stable parser and round-trip evidence; publication remains `working-draft` |
+| Team roster | `team.md`; [initialization and roster generation](../../packages/squad-sdk/src/config/init.ts) | Requirements draft; no claim | Team and Routing v0.1 | Promote independently with roster parsing, mutation, join, and diagnostic cases |
+| Routing ownership | `routing.md`, routing parser, coordinator tests | Requirements draft; no claim | Team and Routing v0.1 | Promote independently with priority, fallback, ambiguity, stale-write, and resolution cases |
+| Runtime configuration | `config.json`, config schema and loaders | Requirements draft; no claim | Configuration and Casting v0.1 | Promote independently with precedence and source-evidence cases |
+| Casting identity | `casting/registry.json`, `policy.json` | Requirements draft; no claim | Configuration and Casting v0.1 | Promote independently with identity, recast, join, and migration cases |
+| Casting provenance | `casting/history.json` | Requirements draft; no claim | Configuration and Casting v0.1 | Promote independently with append-only history, revision, replay, and CAS cases |
+| Governance and review | `governance.md`, reviewer protocol, PR requirements | Requirements draft with reference checks; no claim | Governance and Review v0.1 | Add language-neutral relational invariants and a complete transition manifest |
+| Execution preferences | charters, config, model selector, lifecycle manager | Requirements draft; no claim | Execution Preferences v0.1 | Add provider-neutral resolution cases and loss reporting |
+| PRD intake and planning | `prd-intake.md`, planning ontology, gh-aw workflows | Requirements draft; no claim | Planning and Activation v0.1 | Add portable planning-record and activation manifest |
+| Ceremonies | [declaration template](../../.squad-templates/ceremonies.md), [ceremony reference](../../.squad-templates/ceremony-reference.md), [SDK builder](../../packages/squad-sdk/src/builders/index.ts), [retro workflow](../../workflows/squad-retro.md) | Requirements draft; no claim | [Ceremony v0.1](ceremony-v0.1.md) | Map definition/agenda/hooks separately from shared scheduling and execution; prove cooldown with injected clocks |
+| Work lifecycle | issue lifecycle template, platform interfaces, worktree tests | Requirements draft; no claim | Work Lifecycle v0.1 | Run complete transition traces against two providers |
+| GitHub lifecycle | GitHub adapter, gh-aw workflows, issue/PR templates | Requirements binding draft; no claim | GitHub Work Lifecycle Binding v0.1 | Add deterministic sanitized provider transcripts |
+| Handoffs and sessions | spawn reference, lifecycle manager, event buses | Requirements draft; no claim | Coordination and Handoff v0.1 | Add portable envelope, ordering, expiry, and recovery cases |
+| State backends | state backend interfaces, worktree/orphan/two-layer implementations | Informative requirements now | State and Memory Requirements v0.1 | Authority and recovery vary by backend; promotion requires backend-neutral CAS fixtures |
+| Memory governance | memory classes, providers, audit records | Informative requirements now | St
```

**File**: `docs/specification/automation-v0.1.md` (added, +88/-0)
```diff
@@ -0,0 +1,88 @@
+# Squad Automation Profile v0.1
+
+**Status:** Working Draft
+
+**Document class:** Non-normative requirements draft
+
+**Profile identifier:** `squad-automation/v0.1`
+
+**Maturity:** Requirements draft; non-claimable
+
+**Claimable capabilities:** None
+
+**Implementation status:** Local and GitHub scheduling implementations exist,
+but there is no portable execution manifest.
+
+**Known deviations:** Time-zone behavior, retry evidence, generated-provider
+drift, and result records differ by provider.
+
+**Depends on:** `squad-core/v0.1`, `squad-interop/v0.1`,
+`squad-coordination-handoff/v0.1`
+
+**Artifact:** `schedule.json`
+
+## 1. Scope and non-goals
+
+This profile defines schedule entries, triggers, execution claims, retries,
+results, and provider generation boundaries. It does not standardize cron
+engines, host-local time policy, workflow syntax, scripts, prompt content, or
+provider deployment mechanisms.
+
+## 2. Manifest model
+
+A manifest declares version and schedules. Each schedule declares ID, name,
+enabled state, trigger, task reference, provider set, retry policy, and optional
+concurrency key. Trigger types are `cron`, `interval`, `event`, and `startup`.
+Task classes are `workflow`, `script`, `agent`, and `webhook`; bindings map
+class names to implementation operations.
+
+Task references are inert data. Consumers must not execute a task until
+authorization and provider policy checks succeed.
+
+## 3. Execution states
+
+`eligible -> claimed -> running -> succeeded|failed|cancelled|timed-out`
+
+Retry creates a new attempt under the same run ID. Attempt count, backoff, start,
+finish, output reference, error class, and next due time are recorded.
+Run and attempt records use the shared evidence envelope.
+
+## 4. Trigger and time semantics
+
+Cron bindings must declare time zone and daylight-saving behavior. Interval
+triggers use elapsed duration, not calendar arithmetic. Event triggers require
+a stable event ID. Startup triggers are idempotent per executor startup ID.
+
+## 5. Candidate operations and roles
+
+Candidate operations are `automation.consume`, `automation.evaluate`,
+`automation.claim`, `automation.execute`, and `automation.generate-provider`.
+Evaluators decide eligibility; executors claim and run; generators emit
+provider-native configuration but do not become manifest authority.
+
+## 6. Failure, retry, and concurrency
+
+Invalid triggers, unknown providers, denied tasks, claim conflict, timeout,
+spawn failure, nonzero result, generation drift, and exhausted retries are
+distinct failures. Claims use compare-and-swap. A run key deduplicates retries
+and multi-provider delivery. Provider generation must be reproducible from the
+same manifest and generator version.
+
+## 7. Versioning and extensions
+
+Manifest, provider binding, and generated workflow versions are independent.
+Unknown namespaced fields round-trip. Unsupported task or trigger types fail
+closed.
+
+## 8. Security and privacy
+
+Script and webhook execution cross a trust boundary and require explicit
+authorization. Arguments must remain vectors rather than shell-concatenated
+strings. Logs and results must redact secrets and should store large output by
+reference.
+
+## 9. Promotion criteria
+
+Publish a manifest covering every trigger, time-zone declaration, duplicate
+event, startup deduplication, claim race, retry and backoff, timeout, provider
+generation drift, denied execution, and secret-safe diagnostics.
```

**File**: `docs/specification/ceremony-v0.1.md` (added, +159/-0)
```diff
@@ -0,0 +1,159 @@
+# Squad Ceremony Profile v0.1
+
+**Status:** Working Draft
+
+**Document class:** Non-normative requirements draft
+
+**Profile identifier:** `squad-ceremony/v0.1`
+
+**Maturity:** Requirements draft; non-claimable
+
+**Claimable capabilities:** None
+
+**Implementation status:** The SDK builder preserves arbitrary trigger strings
+and schedule text. Existing tests demonstrate `manual`, `schedule`, and an
+event name (`pr-merged`); they do not prove runtime cooldown enforcement.
+
+**Known deviations:** Legacy `auto` is ambiguous, event names are not
+normalized, and cooldown currently has schedule-cadence evidence only.
+
+**Depends on:** `squad-core/v0.1`, `squad-interop/v0.1`,
+`squad-team-routing/v0.1`
+
+**Artifact:** `ceremonies.md` or an equivalent manifest selected by an API
+
+## 1. Scope and non-goals
+
+This profile defines observable ceremony declarations, triggers, cooldowns,
+participants, decisions, actions, and completion records. It does not
+standardize meeting culture, agenda prose, facilitation prompts, timekeeping
+style, consensus, or synchronous human attendance.
+
+This requirements draft is not a complete specification of today's ceremony
+extensibility surface. It separates three concerns: a definition describes what
+happens; shared scheduling describes when/how a trigger is delivered; an
+execution record describes one run. The proposed execution lifecycle below is
+not evidence that all of it is implemented.
+
+## 2. Declaration model
+
+A ceremony declares ID, enabled state, trigger mode, timing, condition
+reference, facilitator selector, participant selectors, cooldown policy, input
+record kinds, and output requirements. Canonical trigger modes are `manual`,
+`schedule`, and `event:<name>`. Existing bare event names such as `pr-merged`
+map to `event:pr-merged`. Legacy `auto` is accepted only as ambiguous compatible
+input and requires an implementation mapping to either a named event or a
+schedule. Natural-language conditions may be preserved but are
+noncanonical unless paired with a namespaced deterministic evaluator.
+
+Participant selectors are `accountable-owner`, `all-involved`,
+`all-relevant`, or explicit member IDs. Resolution must produce the exact
+participant set used.
+
+### 2.1 Definition and current implementation mapping
+
+A definition also preserves its agenda/process, participant roles, inputs,
+expected outputs, conditions, and extension hooks without standardizing their
+prose or silently executing hooks. The
+[SDK `defineCeremony()` builder](../../packages/squad-sdk/src/builders/index.ts)
+accepts name, trigger, schedule, participants, agenda, and hooks. The
+[configuration shape](../../packages/squad-sdk/src/config/schema.ts) and
+[Markdown template](../../.squad-templates/ceremonies.md) are distinct existing
+representations; the template includes agenda, timing, facilitator, conditions,
+and an enforcement skill. The
+[ceremony reference](../../.squad-templates/ceremony-reference.md) supplies
+implementation guidance.
+
+These are observations, not a claim of lossless conversion between those
+shapes. Hook invocation, process ordering, required input/output schemas,
+plugin/template merge behavior, and a complete mapping of existing fields
+remain promotion work.
+
+### 2.2 Shared trigger and scheduling boundary
+
+The [Automation requirements draft](automation-v0.1.md#2-manifest-model) owns
+the proposed common `schedule.json` model, including cron, interval, event, and
+startup triggers. Its [time semantics](automation-v0.1.md#4-trigger-and-time-semantics)
+are shared scheduling concerns, not ceremony-specific definitions. The
+[scheduler](../../packages/squad-sdk/src/runtime/scheduler.ts) and
+[schedule CLI](../../packages/squad-cli/src/cli/commands/schedule.ts) implement
+the current common scheduling surface.
+
+A future binding should reference a ceremony definition from a scheduled task
+and supply trigger evidence to its executor, rather than define another cron
+or retry engine here. The ceremony `manual`/`schedule`/`event:<name>` vocabulary
+above is a proposed declaration vocabulary, not a second `schedule.json`
+schema. Mapping builder schedule text and Markdown timing/conditions to common
+schedules, including non-cron triggers, is not yet specified or proven.
+Eligibility evaluation and delivery belong to scheduling; ceremony-specific
+cooldown, facilitation, and outcomes belong to execution.
+
+## 3. Execution record
+
+Every run records ceremony ID, run ID, trigger evidence, input revisions,
+facilitator, participants, start and completion times, status, decisions,
+actions, and next eligible time. Decisions and actions require stable IDs,
+owners, and dispositions.
+
+## 4. State transitions
+
+`eligible -> claimed -> running -> completed|failed|cancelled`
+
+Cooldown begins at terminal completion. A run during cooldown is `suppressed`
+with evidence and must not create a second active claim. Failure policy is
+`
```

**File**: `docs/specification/charter-v0.1.md` (added, +404/-0)
```diff
@@ -0,0 +1,404 @@
+# Squad Charter Profile v0.1
+
+<!-- cspell:ignore xhigh -->
+
+**Status:** Working Draft
+
+**Document class:** Normative unless a section is marked informative
+
+**Profile identifier:** `squad-charter/v0.1`
+
+**Editor:** Squad project maintainers
+
+**Draft date:** 2026-09-24
+
+**Working-draft provenance:** [PR #2074](https://github.com/bradygaster/squad/pull/2074),
+whose revision lineage starts at immutable review baseline
+[`ab80da18087b7d37755db2c3cc5880d194a10f52`](https://github.com/bradygaster/squad/commit/ab80da18087b7d37755db2c3cc5880d194a10f52).
+Each subsequent draft snapshot is identified by its immutable Git commit in
+that pull request.
+
+**Immutable publication tag:** None; this working draft is not a publication
+
+**Feedback:** [Issue #2069](https://github.com/bradygaster/squad/issues/2069)
+
+**Errata:** [§14](#14-errata)
+
+**Artifact class:** required
+
+**Squad-root-relative path:** `agents/{id}/charter.md`
+
+**Repository-relative example:** `.squad/agents/{id}/charter.md`
+
+The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**,
+**SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **NOT RECOMMENDED**, **MAY**, and
+**OPTIONAL** in this document are to be interpreted as described in BCP 14
+[RFC 2119](https://www.rfc-editor.org/rfc/rfc2119)
+[RFC 8174](https://www.rfc-editor.org/rfc/rfc8174) when, and only when, they
+appear in all capitals, as shown here.
+
+## 1. Purpose and authority
+
+A charter identifies one agent and supplies human-readable operating guidance
+plus optional runtime preferences. Team membership, routing ownership,
+authorization, and configuration overrides are outside this profile.
+
+The path segment `{id}` is the reference identity. When profile path context is
+available, `Identity ID` MUST equal `{id}` after converting Windows separators
+to `/`. Paths that are neither exactly `agents/{id}/charter.md` nor terminated
+by `.squad/agents/{id}/charter.md` provide no profile path context.
+
+## 2. Normative references
+
+- [Squad Specification Core v0.1](core-v0.1.md) defines common paths,
+  conformance, diagnostics, versioning, publication, and trust requirements.
+- [BCP 14](https://www.rfc-editor.org/info/bcp14), comprising RFC 2119 and
+  RFC 8174, defines requirement-keyword interpretation.
+- [CommonMark 0.31.2](https://spec.commonmark.org/0.31.2/) defines the Markdown
+  terms used by the deterministic subset below.
+- [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785) defines the JSON
+  Canonicalization Scheme used for the evidence revision digest.
+
+## 3. Association and unsupported versions
+
+The artifact path associates a charter with the charter artifact family. The
+profile version is selected by the calling API or surrounding manifest; v0.1
+has no in-document version marker.
+
+An API that claims portable conformance MUST require the caller to supply the
+profile identifier. Missing selection produces `SQC014`. A language-specific
+implementation MAY expose a separately named convenience validator or compiler
+that defaults a profile, but that default is implementation-specific and MUST
+NOT be treated as portable conformance behavior. The TypeScript reference
+implementation's `validateCharterMarkdown` and `compileCharterFull` convenience
+paths default to `squad-charter/v0.1` and report the selected profile.
+
+A consumer asked to process a profile other than one it supports MUST return an
+unsupported-profile error and MUST NOT reinterpret the document as v0.1.
+
+## 4. Canonical document shape
+
+```markdown
+# Display Name — Role
+
+## Identity
+- **ID:** `agent-id`
+- **Purpose:** Non-empty single-line purpose text.
+
+## Accountable Responsibilities
+...
+
+## Non-Responsibilities
+...
+
+## Collaboration and Review Authority
+...
+
+## Model
+- **Preferred:** auto
+- **Reasoning Effort:** auto
+- **Context Tier:** auto
+```
+
+The H1, `Identity`, and three canonical responsibility sections define the
+canonical presentation. `Model` is optional. Producers MUST emit canonical
+sections in this order: `Identity`, `Accountable Responsibilities`,
+`Non-Responsibilities`, `Collaboration and Review Authority`, optional
+`Model`, then extensions. Producers MUST use the em dash (`—`) H1 separator
+and canonical responsibility headings unless an API caller explicitly requests
+legacy output.
+
+`Purpose` is one non-empty, single-line Markdown field value. The profile does
+not attempt to determine whether prose is grammatically a sentence.
+
+## 5. Deterministic Markdown subset
+
+Structural recognition uses these rules, in order:
+
+1. Only ATX H1 and H2 headings beginning in column one are structural. Exactly
+   one structural H1 is allowed. Setext headings and H3-H6 headings are prose.
+2. A machine field is a single line with zero to three leading spaces, an
+   optional list marker, then `**Label:** value`.
+3. Headings and fields inside fenced code are ignored. Fences use at least
+   three backtic
```

**File**: `docs/specification/configuration-casting-v0.1.md` (added, +124/-0)
```diff
@@ -0,0 +1,124 @@
+# Squad Configuration and Casting Profile v0.1
+
+**Status:** Working Draft
+
+**Document class:** Non-normative requirements draft
+
+**Profile identifier:** `squad-configuration-casting/v0.1`
+
+**Maturity:** Requirements draft; non-claimable
+
+**Claimable capabilities:** None
+
+**Implementation status:** Configuration loaders, casting registries, and
+history records exist, but they do not share one portable manifest.
+
+**Known deviations:** Legacy registry shapes and runtime-only configuration
+keys remain accepted. See the
+[inventory deviation matrix](artifact-inventory.md#known-unstable-and-non-conforming-behavior).
+
+**Depends on:** `squad-core/v0.1`, `squad-interop/v0.1`,
+`squad-team-routing/v0.1`
+
+**Artifacts:** `config.json`, `casting/registry.json`, `casting/policy.json`,
+`casting/history.json`
+
+## 1. Scope and non-goals
+
+This profile defines portable configuration selection, cast identity
+provenance, revisions, and roster joins. It does not standardize themed
+universes, character-selection scoring, UI choices, provider credentials, or
+internal migration algorithms.
+
+Configuration, casting identity, and provenance are separate promotion units.
+Casting aesthetics are an informative, independently versioned extension and
+do not define authority.
+
+## 2. Configuration requirements
+
+`config.json` is authored configuration intent. Portable configuration covers
+declared values, precedence, and source evidence. Runtime-only keys and
+provider catalogs remain implementation policy.
+
+## 3. Casting identity requirements
+
+`casting/registry.json` is the current cast identity authority.
+`casting/policy.json` constrains allowed naming behavior but does not itself
+create members.
+
+Every registry document must declare a schema identifier, schema version,
+monotonic revision, generation timestamp, and agent map keyed by member ID.
+Each agent entry must include display name, persistent name, accountable role,
+universe or naming source, status, creation time, and update time.
+
+## 4. Provenance requirements
+
+`casting/history.json` is append-only provenance and does not override the
+registry. Each history entry records the operation, prior and result revision,
+actor, time, and identity joins needed to reproduce the change.
+
+## 5. Precedence and joins
+
+Portable configuration precedence is:
+
+1. explicit operation input;
+2. session-scoped user intent;
+3. repository `config.json`;
+4. charter preference;
+5. runtime automatic policy.
+
+Lower layers must not overwrite higher-layer authored intent. A value of
+`auto` requests runtime selection and is not a concrete override.
+
+Registry IDs must join to active team IDs. Recasting may change display names
+but must preserve member IDs unless an explicit identity migration is recorded.
+
+## 6. State transitions
+
+`unregistered -> active -> inactive -> retired` is the portable lifecycle.
+`retired -> active` requires a new revision and explicit reactivation evidence.
+Every mutation increments `revision` exactly once and appends history with the
+operation ID, prior revision, resulting revision, actor, and timestamp.
+
+## 7. Candidate operations and roles
+
+Candidate operations are `config.consume`, `config.edit`, `casting.produce`,
+`casting.validate`, `casting.recast`, and `casting.migrate`. They are not
+claimable capabilities. Producers create
+revisions; validators check joins and monotonicity; executors apply an
+authorized cast operation.
+
+## 8. Canonical, compatible, and failure behavior
+
+Canonical documents use declared schemas and complete provenance. Compatible
+consumers may ingest older registry shapes but must report the migration and
+must not fabricate provenance. Unknown configuration keys are preserved as
+namespaced extensions. Invalid joins, revision regression, duplicate persistent
+names where uniqueness is required, or stale writes fail closed.
+
+## 9. Idempotency, retry, and concurrency
+
+Operations must carry an idempotency key. Repeating a completed key returns the
+same resulting revision. Concurrent writers must compare the expected registry
+revision; a mismatch returns `stale-revision` without partial mutation.
+
+## 10. Versioning and extensions
+
+Artifact schema versions and this profile version are independent. Consumers
+must negotiate each supported schema. Namespaced policy and registry fields
+must round-trip unchanged.
+
+## 11. Security, privacy, and trust
+
+Configuration is not authorization. Model names, tools, repositories, and
+providers are requests subject to runtime policy. Registry content must not
+contain credentials. Theme or persona text is untrusted and must not grant
+capabilities.
+
+## 12. Promotion criteria
+
+Configuration promotion requires precedence and source-evidence cases. Casting
+promotion separately requires identity, join, recast, and migration cases.
+Provenance promotion requires append-only history, revision, replay,
+extension-
```

---

### Incident Patch 11: `88b45501` (2026-10-02)
**Commit Message**: docs(gh-aw): fix setup guide contradictions and sync enlistment guidance (#2153)

Resolve a set of contradictions/unreliable instructions in the public
Agentic Workflows setup guide (docs/src/content/docs/guide/gh-aw.md):

- Clarify the Profile A (least-privilege, recommended) Actions
  permission setting and what remains manual under it; add an explicit
  opt-in Profile B (automatic PR creation) section with its coupled
  security tradeoff instead of silently enabling it.
- Remove unconditional safe-update approval from the executable quick
  start; approval now requires verifying the report contains exactly
  SQUAD_GITHUB_APP_PRIVATE_KEY, SQUAD_GITHUB_TOKEN, and
  bradygaster/squad/.github/actions/squad-init, otherwise stop.
- Replace the broken `gh pr edit --add-reviewer @copilot` with a
  verified Copilot-as-Bot GraphQL requestReviewsByLogin/botLogins
  request plus a manual UI fallback (both quick-start and full-steps
  flows).
- Make SQUAD_SHA discovery immutable: remove prose claiming quick
  start resolves dev automatically; require a maintainer-approved SHA.
- Make quick start rerunnable/safe: validate a clean working tree and
  reuse an existing bootstrap branch instead o

**File**: `.squad-templates/skills/gh-aw-enlistment/SKILL.md` (modified, +23/-3)
```diff
@@ -382,13 +382,27 @@ gh pr create \
   --base "${default_branch}" \
   --title "ci: add Squad agentic workflow" \
   --body "Installs and strictly compiles the supported Squad GH-AW workflows."
-gh pr edit --add-reviewer @copilot
+
+# Copilot's review identity is a GraphQL Bot, not a User/Team — the REST
+# `gh pr edit --add-reviewer @copilot` path silently no-ops for it. Request the
+# review through the verified GraphQL path instead:
+pr_node_id="$(gh pr view --json id --jq '.id')"
+gh api graphql -f query='
+  mutation($pr: ID!) {
+    requestReviewsByLogin(input: { pullRequestId: $pr, botLogins: ["copilot-pull-request-reviewer"] }) {
+      pullRequest { number }
+    }
+  }' -f pr="${pr_node_id}" || echo "Could not request a Copilot review via GraphQL; open the PR in the GitHub UI and add Copilot as a reviewer manually (Reviewers -> Copilot)." >&2
 gh pr checks --watch
 ```
 
 - Open the PR against the **runtime-captured** `${default_branch}`, not a hardcoded
   `main`.
-- Request Copilot review, address feedback, and wait for required checks.
+- Request Copilot review via the GraphQL `requestReviewsByLogin` mutation
+  (never the REST `--add-reviewer` shortcut, which silently no-ops for the
+  Copilot Bot reviewer), address feedback, and wait for required checks. If
+  the GraphQL call fails, add Copilot as a reviewer manually from the PR's
+  GitHub UI.
 
 ### 9. Verify the native review contract after merge
 
@@ -497,7 +511,13 @@ git push -u origin HEAD
 gh pr create --base "${default_branch}" \
   --title "ci: add Squad agentic workflow" \
   --body "Installs and strictly compiles the supported Squad GH-AW workflows."
-gh pr edit --add-reviewer @copilot   # then wait for review + checks; DO NOT merge
+pr_node_id="$(gh pr view --json id --jq '.id')"
+gh api graphql -f query='
+  mutation($pr: ID!) {
+    requestReviewsByLogin(input: { pullRequestId: $pr, botLogins: ["copilot-pull-request-reviewer"] }) {
+      pullRequest { number }
+    }
+  }' -f pr="${pr_node_id}"   # Bot-aware review request; then wait for review + checks; DO NOT merge
 ```
 
 ### ✓ Correct: STOP on an undocumented safe-update entry
```

**File**: `docs/src/content/docs/guide/gh-aw.md` (modified, +143/-42)
```diff
@@ -55,7 +55,9 @@ test "${gh_aw_version}" = "${required_gh_aw_version}" || {
 owner_repo="$(gh repo view --json nameWithOwner --jq '.nameWithOwner')"
 default_branch="$(gh repo view --json defaultBranchRef --jq '.defaultBranchRef.name')"
 
-# 2. Require GitHub Issues, then allow GitHub Actions to create pull requests
+# 2. Require GitHub Issues, then keep Actions PR creation/approval disabled
+# (the recommended least-privilege profile; see "Allow workflow-created pull
+# requests" below for the opt-in alternative and its tradeoff)
 issues_enabled="$(gh api "repos/${owner_repo}" --jq '.has_issues')"
 if [ "${issues_enabled}" != "true" ]; then
   echo "GitHub Issues are disabled; enabling them before workflow installation."
@@ -76,8 +78,18 @@ gh api --method PUT "repos/${owner_repo}/actions/permissions/workflow" \
   -f default_workflow_permissions=read \
   -F can_approve_pull_request_reviews=false
 
-# 3. Create a bootstrap branch
-git switch -c chore/squad-gh-aw-bootstrap
+# 3. Create a bootstrap branch. Safe to run again: require a clean,
+# understood tree, and reuse the branch if a prior run already created it
+# instead of failing on an ordinary rerun.
+git diff --quiet && git diff --cached --quiet || {
+  echo "STOP: the working tree has uncommitted changes; commit, stash, or discard them before bootstrapping." >&2
+  exit 1
+}
+if git show-ref --verify --quiet refs/heads/chore/squad-gh-aw-bootstrap; then
+  git switch chore/squad-gh-aw-bootstrap
+else
+  git switch -c chore/squad-gh-aw-bootstrap
+fi
 
 # 4. Install the complete native package at an explicit, maintainer-approved
 # revision. SQUAD_SHA is never resolved from the `dev` branch's moving tip —
@@ -92,9 +104,12 @@ SQUAD_SHA="<40-character-commit-sha>"
 gh aw add "bradygaster/squad/workflows@${SQUAD_SHA}"
 rm -f .github/skills/agentic-workflows/SKILL.md
 
-# 5. On first install, review the safe-update report.
-# If it contains only the documented Squad secrets and init action, approve it:
-gh aw compile --strict --approve
+# 5. On first install, review the safe-update report. Approve ONLY if it
+# contains exactly the two documented secrets (SQUAD_GITHUB_APP_PRIVATE_KEY,
+# SQUAD_GITHUB_TOKEN) and the one documented action
+# (bradygaster/squad/.github/actions/squad-init) and nothing else. STOP and
+# report any other entry instead of approving.
+gh aw compile --strict --approve   # first install only, when the safe-update warning appears
 
 # Materialize package-owned runtime assets, then run the final strict compile
 node .github/workflows/shared/squad-install-verifier.mjs --materialize-runtime
@@ -123,12 +138,22 @@ gh pr create \
   --base "$default_branch" \
   --title "ci: add Squad agentic workflow" \
   --body "Installs and strictly compiles the supported Squad GH-AW workflows."
-gh pr edit --add-reviewer @copilot
+
+# Copilot's review identity is a GraphQL Bot, not a User/Team — the REST
+# `gh pr edit --add-reviewer @copilot` path silently no-ops for it.
+pr_node_id="$(gh pr view --json id --jq '.id')"
+gh api graphql -f query='
+  mutation($pr: ID!) {
+    requestReviewsByLogin(input: { pullRequestId: $pr, botLogins: ["copilot-pull-request-reviewer"] }) {
+      pullRequest { number }
+    }
+  }' -f pr="${pr_node_id}" || echo "Could not request a Copilot review via GraphQL; open the PR in the GitHub UI and add Copilot as a reviewer manually (Reviewers -> Copilot)." >&2
 gh pr checks --watch
 ```
 
-The quick start resolves the supported `dev` channel once, then installs the
-native package at that immutable 40-character commit. The package owns the
+SQUAD_SHA is an explicit, maintainer-approved commit, never resolved from the
+`dev` branch's moving tip; the quick start installs the native package at that
+one immutable 40-character commit. The package owns the
 complete eight-workflow set, runtime guards, integrity manifest, and enlistment
 skill as one update unit. For an upgrade, resolve or select one reviewed commit
 and reinstall that same package as described in
@@ -141,8 +166,15 @@ as a trusted Squad verdict. The canonical workflow reports
 `First-install manual boundary`, emits no `Squad-Review-Verdict:` record, and
 requires a human to review the verifier/compile evidence before merging.
 
-After merge, the default-branch bootstrap workflow opens the draft Cast PR.
-That PR is the activation canary: `Squad Review / review` must succeed using the
+After merge, the default-branch bootstrap workflow analyzes the repository and
+pushes the generated Cast branch. Under Profile A (recommended, the default
+this guide sets up), `GITHUB_TOKEN` cannot open the Cast PR directly, so
+`squad-bootstrap` instead opens (or reuses) a bot-authored fallback issue with
+a ready-to-click compare URL, and a human opens the Cast PR from that link —
+see [Set Actions pull-request permissions](#set-actions-pull-request-permissions-profile-a-recommended)
+for the exact signed-provenance acceptance rule. Only under Profile B does
+`squad-bootstrap
```

**File**: `packages/squad-cli/templates/skills/gh-aw-enlistment/SKILL.md` (modified, +23/-3)
```diff
@@ -382,13 +382,27 @@ gh pr create \
   --base "${default_branch}" \
   --title "ci: add Squad agentic workflow" \
   --body "Installs and strictly compiles the supported Squad GH-AW workflows."
-gh pr edit --add-reviewer @copilot
+
+# Copilot's review identity is a GraphQL Bot, not a User/Team — the REST
+# `gh pr edit --add-reviewer @copilot` path silently no-ops for it. Request the
+# review through the verified GraphQL path instead:
+pr_node_id="$(gh pr view --json id --jq '.id')"
+gh api graphql -f query='
+  mutation($pr: ID!) {
+    requestReviewsByLogin(input: { pullRequestId: $pr, botLogins: ["copilot-pull-request-reviewer"] }) {
+      pullRequest { number }
+    }
+  }' -f pr="${pr_node_id}" || echo "Could not request a Copilot review via GraphQL; open the PR in the GitHub UI and add Copilot as a reviewer manually (Reviewers -> Copilot)." >&2
 gh pr checks --watch
 ```
 
 - Open the PR against the **runtime-captured** `${default_branch}`, not a hardcoded
   `main`.
-- Request Copilot review, address feedback, and wait for required checks.
+- Request Copilot review via the GraphQL `requestReviewsByLogin` mutation
+  (never the REST `--add-reviewer` shortcut, which silently no-ops for the
+  Copilot Bot reviewer), address feedback, and wait for required checks. If
+  the GraphQL call fails, add Copilot as a reviewer manually from the PR's
+  GitHub UI.
 
 ### 9. Verify the native review contract after merge
 
@@ -497,7 +511,13 @@ git push -u origin HEAD
 gh pr create --base "${default_branch}" \
   --title "ci: add Squad agentic workflow" \
   --body "Installs and strictly compiles the supported Squad GH-AW workflows."
-gh pr edit --add-reviewer @copilot   # then wait for review + checks; DO NOT merge
+pr_node_id="$(gh pr view --json id --jq '.id')"
+gh api graphql -f query='
+  mutation($pr: ID!) {
+    requestReviewsByLogin(input: { pullRequestId: $pr, botLogins: ["copilot-pull-request-reviewer"] }) {
+      pullRequest { number }
+    }
+  }' -f pr="${pr_node_id}"   # Bot-aware review request; then wait for review + checks; DO NOT merge
 ```
 
 ### ✓ Correct: STOP on an undocumented safe-update entry
```

**File**: `packages/squad-sdk/templates/skills/gh-aw-enlistment/SKILL.md` (modified, +23/-3)
```diff
@@ -382,13 +382,27 @@ gh pr create \
   --base "${default_branch}" \
   --title "ci: add Squad agentic workflow" \
   --body "Installs and strictly compiles the supported Squad GH-AW workflows."
-gh pr edit --add-reviewer @copilot
+
+# Copilot's review identity is a GraphQL Bot, not a User/Team — the REST
+# `gh pr edit --add-reviewer @copilot` path silently no-ops for it. Request the
+# review through the verified GraphQL path instead:
+pr_node_id="$(gh pr view --json id --jq '.id')"
+gh api graphql -f query='
+  mutation($pr: ID!) {
+    requestReviewsByLogin(input: { pullRequestId: $pr, botLogins: ["copilot-pull-request-reviewer"] }) {
+      pullRequest { number }
+    }
+  }' -f pr="${pr_node_id}" || echo "Could not request a Copilot review via GraphQL; open the PR in the GitHub UI and add Copilot as a reviewer manually (Reviewers -> Copilot)." >&2
 gh pr checks --watch
 ```
 
 - Open the PR against the **runtime-captured** `${default_branch}`, not a hardcoded
   `main`.
-- Request Copilot review, address feedback, and wait for required checks.
+- Request Copilot review via the GraphQL `requestReviewsByLogin` mutation
+  (never the REST `--add-reviewer` shortcut, which silently no-ops for the
+  Copilot Bot reviewer), address feedback, and wait for required checks. If
+  the GraphQL call fails, add Copilot as a reviewer manually from the PR's
+  GitHub UI.
 
 ### 9. Verify the native review contract after merge
 
@@ -497,7 +511,13 @@ git push -u origin HEAD
 gh pr create --base "${default_branch}" \
   --title "ci: add Squad agentic workflow" \
   --body "Installs and strictly compiles the supported Squad GH-AW workflows."
-gh pr edit --add-reviewer @copilot   # then wait for review + checks; DO NOT merge
+pr_node_id="$(gh pr view --json id --jq '.id')"
+gh api graphql -f query='
+  mutation($pr: ID!) {
+    requestReviewsByLogin(input: { pullRequestId: $pr, botLogins: ["copilot-pull-request-reviewer"] }) {
+      pullRequest { number }
+    }
+  }' -f pr="${pr_node_id}"   # Bot-aware review request; then wait for review + checks; DO NOT merge
 ```
 
 ### ✓ Correct: STOP on an undocumented safe-update entry
```

**File**: `templates/skills/gh-aw-enlistment/SKILL.md` (modified, +23/-3)
```diff
@@ -382,13 +382,27 @@ gh pr create \
   --base "${default_branch}" \
   --title "ci: add Squad agentic workflow" \
   --body "Installs and strictly compiles the supported Squad GH-AW workflows."
-gh pr edit --add-reviewer @copilot
+
+# Copilot's review identity is a GraphQL Bot, not a User/Team — the REST
+# `gh pr edit --add-reviewer @copilot` path silently no-ops for it. Request the
+# review through the verified GraphQL path instead:
+pr_node_id="$(gh pr view --json id --jq '.id')"
+gh api graphql -f query='
+  mutation($pr: ID!) {
+    requestReviewsByLogin(input: { pullRequestId: $pr, botLogins: ["copilot-pull-request-reviewer"] }) {
+      pullRequest { number }
+    }
+  }' -f pr="${pr_node_id}" || echo "Could not request a Copilot review via GraphQL; open the PR in the GitHub UI and add Copilot as a reviewer manually (Reviewers -> Copilot)." >&2
 gh pr checks --watch
 ```
 
 - Open the PR against the **runtime-captured** `${default_branch}`, not a hardcoded
   `main`.
-- Request Copilot review, address feedback, and wait for required checks.
+- Request Copilot review via the GraphQL `requestReviewsByLogin` mutation
+  (never the REST `--add-reviewer` shortcut, which silently no-ops for the
+  Copilot Bot reviewer), address feedback, and wait for required checks. If
+  the GraphQL call fails, add Copilot as a reviewer manually from the PR's
+  GitHub UI.
 
 ### 9. Verify the native review contract after merge
 
@@ -497,7 +511,13 @@ git push -u origin HEAD
 gh pr create --base "${default_branch}" \
   --title "ci: add Squad agentic workflow" \
   --body "Installs and strictly compiles the supported Squad GH-AW workflows."
-gh pr edit --add-reviewer @copilot   # then wait for review + checks; DO NOT merge
+pr_node_id="$(gh pr view --json id --jq '.id')"
+gh api graphql -f query='
+  mutation($pr: ID!) {
+    requestReviewsByLogin(input: { pullRequestId: $pr, botLogins: ["copilot-pull-request-reviewer"] }) {
+      pullRequest { number }
+    }
+  }' -f pr="${pr_node_id}"   # Bot-aware review request; then wait for review + checks; DO NOT merge
 ```
 
 ### ✓ Correct: STOP on an undocumented safe-update entry
```

**File**: `test/gh-aw-enlistment-skill.test.ts` (modified, +1/-1)
```diff
@@ -497,7 +497,7 @@ describe('gh-aw-enlistment skill', () => {
 
       const setupSection = guide.slice(
         guide.indexOf('### Enable GitHub Issues'),
-        guide.indexOf('### Allow workflow-created pull requests'),
+        guide.indexOf('### Set Actions pull-request permissions (Profile A, recommended)'),
       );
       expect(setupSection).toContain(
         'test "$(gh api "repos/${owner_repo}" --jq \'.has_issues\')" = "true" || {',
```

**File**: `test/standalone-release-workflow.test.ts` (modified, +2/-1)
```diff
@@ -703,7 +703,8 @@ describe('automated package publication', () => {
     expect(ghAwGuide).toContain('gh aw compile --strict --approve');
     expect(ghAwGuide).toContain('gh aw compile --strict');
     expect(ghAwGuide).toContain('gh pr create');
-    expect(ghAwGuide).toContain('gh pr edit --add-reviewer @copilot');
+    expect(ghAwGuide).toContain('requestReviewsByLogin');
+    expect(ghAwGuide).toContain('copilot-pull-request-reviewer');
     expect(ghAwGuide).toContain('gh pr checks --watch');
     expect(ghAwGuide).toContain('.github/aw/');
     expect(ghAwGuide).toContain('`.vscode/settings.json`');
```

**File**: `workflows/skills/gh-aw-enlistment/SKILL.md` (modified, +23/-3)
```diff
@@ -382,13 +382,27 @@ gh pr create \
   --base "${default_branch}" \
   --title "ci: add Squad agentic workflow" \
   --body "Installs and strictly compiles the supported Squad GH-AW workflows."
-gh pr edit --add-reviewer @copilot
+
+# Copilot's review identity is a GraphQL Bot, not a User/Team — the REST
+# `gh pr edit --add-reviewer @copilot` path silently no-ops for it. Request the
+# review through the verified GraphQL path instead:
+pr_node_id="$(gh pr view --json id --jq '.id')"
+gh api graphql -f query='
+  mutation($pr: ID!) {
+    requestReviewsByLogin(input: { pullRequestId: $pr, botLogins: ["copilot-pull-request-reviewer"] }) {
+      pullRequest { number }
+    }
+  }' -f pr="${pr_node_id}" || echo "Could not request a Copilot review via GraphQL; open the PR in the GitHub UI and add Copilot as a reviewer manually (Reviewers -> Copilot)." >&2
 gh pr checks --watch
 ```
 
 - Open the PR against the **runtime-captured** `${default_branch}`, not a hardcoded
   `main`.
-- Request Copilot review, address feedback, and wait for required checks.
+- Request Copilot review via the GraphQL `requestReviewsByLogin` mutation
+  (never the REST `--add-reviewer` shortcut, which silently no-ops for the
+  Copilot Bot reviewer), address feedback, and wait for required checks. If
+  the GraphQL call fails, add Copilot as a reviewer manually from the PR's
+  GitHub UI.
 
 ### 9. Verify the native review contract after merge
 
@@ -497,7 +511,13 @@ git push -u origin HEAD
 gh pr create --base "${default_branch}" \
   --title "ci: add Squad agentic workflow" \
   --body "Installs and strictly compiles the supported Squad GH-AW workflows."
-gh pr edit --add-reviewer @copilot   # then wait for review + checks; DO NOT merge
+pr_node_id="$(gh pr view --json id --jq '.id')"
+gh api graphql -f query='
+  mutation($pr: ID!) {
+    requestReviewsByLogin(input: { pullRequestId: $pr, botLogins: ["copilot-pull-request-reviewer"] }) {
+      pullRequest { number }
+    }
+  }' -f pr="${pr_node_id}"   # Bot-aware review request; then wait for review + checks; DO NOT merge
 ```
 
 ### ✓ Correct: STOP on an undocumented safe-update entry
```

---

### Incident Patch 12: `bbe3d37d` (2026-10-02)
**Commit Message**: fix(gh-aw): generate manifest from committed LF resource bytes

Co-authored-by: Copilot App <[REDACTED_EMAIL]>

**File**: `workflows/squad-workflows.manifest.json` (modified, +1/-1)
```diff
@@ -185,7 +185,7 @@
       "package_destination": ".github/aw/squad/runtime/shared/implementation-provenance-v1.schema.json",
       "destination": ".github/workflows/shared/implementation-provenance-v1.schema.json",
       "ownership": "manifest",
-      "sha256": "9f0cbbd0929d3621e76420f516d3e448de2d77031f5fd8f7e2eb1bd443fa91a8"
+      "sha256": "c4ebb0a2b8fc2d0ee5e6bb77c28bee814cb8cd90acd4bda69cf0d8f23a614e7f"
     },
     {
       "path": "shared/builtins/scribe-charter.md",
```

---

### Incident Patch 13: `5455312b` (2026-10-02)
**Commit Message**: fix(gh-aw): prevent edited command replay (#2149)

* fix(gh-aw): prevent edited command replay

Co-authored-by: Copilot App <[REDACTED_EMAIL]>

* fix(gh-aw): address exact-head review findings

Co-authored-by: Copilot App <[REDACTED_EMAIL]>

* fix(gh-aw): finish command replay hardening

Co-authored-by: Copilot App <[REDACTED_EMAIL]>

* fix(gh-aw): reject ineffective revocations

Co-authored-by: Copilot App <[REDACTED_EMAIL]>

* fix(gh-aw): normalize durable revocations

Co-authored-by: Copilot App <[REDACTED_EMAIL]>

* fix(gh-aw): route edited revocation rejection

Co-authored-by: Copilot App <[REDACTED_EMAIL]>

---------

Co-authored-by: Copilot App <[REDACTED_EMAIL]>

**File**: `.changeset/prevent-command-replay.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+---
+"@bradygaster/squad-cli": patch
+"@bradygaster/squad-sdk": patch
+---
+
+Prevent edited issue and comment events from replaying unchanged embedded `/squad` commands, require dual-principal repository authorization for `/squad revoke-improvement`, and ignore unauthorized revocation comments during live approval revalidation.
```

**File**: `docs/src/content/docs/guide/gh-aw.md` (modified, +7/-5)
```diff
@@ -657,7 +657,7 @@ wins: `/squad plan accept scope` is not treated as `/squad plan`.
 | Review | `/squad review` | Show how to rerun the current pull request's automatic independent review | Does not dispatch branch-selected code; human approval remains mandatory |
 | Retrospective | `/squad retro` | Run the shared retrospective immediately | Authorized manual run; weekly and evidence-driven wakeups use the same durable gate |
 | Governance | `/squad approve-improvement` | Request implementation of an exact retrospective proposal revision | Human write/maintain/admin permission, `Approved-Revision:` hash and exact `Approved-Path:` lines; dispatcher relays nested `issue_number` and `approval_comment_id`, never approval authority |
-| Governance | `/squad revoke-improvement` | Withdraw a prior `/squad approve-improvement` | Reserved, read-only command available to any actor; emits no output of any kind — the comment itself is the record that later runs re-check |
+| Governance | `/squad revoke-improvement` | Withdraw a prior `/squad approve-improvement` | Reserved state-changing command requiring write, maintain, or admin authorization; emits no output of any kind — the comment itself is the record that later runs re-check |
 
 ### Implementation provenance
 
@@ -875,9 +875,11 @@ and validates its human author/provenance, permissions, issue state, revision an
 scope, both before work and before safe outputs; it never substitutes a newer
 approval or treats a relay actor as an approver.
 
-`/squad revoke-improvement` is a reserved no-dispatch route: a later human comment
-withdraws the referenced approval. Missing/edited/stale/revoked approvals require
-a fresh comment for the current content. Manual retries select
+`/squad revoke-improvement` is a reserved no-dispatch route: only a later
+unedited, non-app human issue comment from an author with live write, maintain,
+or admin permission withdraws the referenced approval. Unresolved permission,
+malformed timestamps, incomplete history, or missing/edited/stale/revoked
+approvals fail closed and require a fresh comment for the current content. Manual retries select
 **Actions → Squad Improvement Worker → Run workflow**, on the default branch,
 and supply the same `issue_number` and `approval_comment_id` (the numeric suffix
 of its `#issuecomment-N` URL). Retrying is not approval. Both workers remain
@@ -889,7 +891,7 @@ Opt-in reconciliation adds at most 48: three action pages, five all-state PR
 pages and two comment pages for each of twenty candidates. Candidates rotate
 every six hours; an incomplete history requires human inspection. Live retro
 output checks add at most 14 reads; receiving ordinary-worker checks at most
-nine. Improvement authorization is bounded to fourteen reads per check, twice
+nine. Improvement authorization is bounded to 36 reads per check, twice
 per worker run, plus two dispatcher checks. GitHub supplies no transaction
 covering a comment and a PR: revocation is checked immediately before safe
 outputs, not after publication; human review remains the final authority.
```

**File**: `test/gh-aw-command-parse.test.ts` (modified, +157/-2)
```diff
@@ -5,6 +5,7 @@ import { join } from 'node:path';
 import {
   classifySquadCommand,
   commandRequiresAuthorization,
+  editedCommandShouldRoute,
   enforceSquadCommandContract,
   isAuthorizedPermission,
   rejectionComment,
@@ -115,6 +116,7 @@ describe('gh-aw: shared /squad command contract (#1824)', () => {
       ['\n\n/squad status\n', 'status', null],
       ['activate phase 3', 'activate', 3],
       ['research Focus only on P1', 'research', null],
+      ['revoke-improvement', 'revoke-improvement', null],
     ])('accepts bare or slash-prefixed dispatch %j', (command, mode, phase) => {
       expect(classifySquadCommand(dispatch(command), 'workflow_dispatch')).toMatchObject({
         status: 'accepted',
@@ -124,6 +126,104 @@ describe('gh-aw: shared /squad command contract (#1824)', () => {
       });
     });
 
+    describe.each([
+      ['issues', issue],
+      ['issue_comment', comment],
+    ] as const)('edited-event replay gate for %s', (eventName, payload) => {
+      function edited(previousBody: unknown, currentBody: string) {
+        return {
+          ...payload(currentBody),
+          action: 'edited',
+          changes: { body: { from: previousBody } },
+        };
+      }
+
+      it.each([
+        [
+          'Context before.\n/squad plan implementation\nContext after.',
+          'Changed context before.\n\n  /squad   plan   implementation  \nChanged context after.',
+        ],
+        [
+          'Context before.\n/squad status extra\nContext after.',
+          'Changed context before.\n\n /squad   status   extra \nChanged context after.',
+        ],
+      ])('noops when only surrounding prose or command whitespace changes', (before, after) => {
+        const event = edited(before, after);
+        const current = classifySquadCommand(event, eventName);
+        expect(editedCommandShouldRoute(event, eventName, current)).toBe(false);
+      });
+
+      it.each([
+        ['/squad DANCE', '/squad dance'],
+        ['/squad STATUS EXTRA', '/squad status extra'],
+      ])('noops a rejected invocation case-only edit while preserving its current text: %j -> %j', (before, after) => {
+        const event = edited(before, after);
+        const current = classifySquadCommand(event, eventName);
+        expect(current).toMatchObject({ status: 'rejected', rejectedCommand: after });
+        expect(editedCommandShouldRoute(event, eventName, current)).toBe(false);
+        expect(rejectionComment(current as Extract<typeof current, { status: 'rejected' }>))
+          .toContain(`\`\`\`text\n${after}\n\`\`\``);
+      });
+
+      it.each([
+        ['ordinary body', '/squad status'],
+        ['/squad status', '/squad plan'],
+        ['/squad status extra', '/squad dance'],
+        ['Use `/squad status` after review.', '/squad status'],
+        ['```text\n/squad status\n```', '/squad status'],
+      ])('routes a newly introduced or materially changed command: %j -> %j', (before, after) => {
+        const event = edited(before, after);
+        const current = classifySquadCommand(event, eventName);
+        expect(editedCommandShouldRoute(event, eventName, current)).toBe(true);
+      });
+
+      it('rejects issue-body and edited-comment revocations but accepts a new comment revocation', () => {
+        expect(classifySquadCommand(issue('/squad revoke-improvement'), 'issues')).toMatchObject({
+          status: 'rejected',
+          source: 'issue',
+          reason: 'Issue-body revocations are not durable. Post /squad revoke-improvement as a new, unedited human issue comment.',
+        });
+        expect(classifySquadCommand(comment('/squad revoke-improvement'), 'issue_comment')).toMatchObject({
+          status: 'accepted',
+          source: 'comment',
+          mode: 'revoke-improvement',
+        });
+        expect(classifySquadCommand({
+          ...comment('/squad revoke-improvement'),
+          action: 'edited',
+        }, 'issue_comment')).toMatchObject({
+          status: 'rejected',
+          source: 'comment',
+          reason: 'Edited comment revocations are not durable. Post /squad revoke-improvement as a new, unedited human issue comment.',
+        });
+      });
+
+      if (eventName === 'issue_comment') {
+        it('routes an unchanged edited revocation from its accepted pre-edit state to rejection', () => {
+          const event = edited('/squad revoke-improvement', '/squad revoke-improvement');
+          const current = classifySquadCommand(event, eventName);
+          expect(current).toMatchObject({
+            status: 'rejected',
+            reason: 'Edited comment revocations are not durable. Post /squad revoke-improvement as a new, unedited human issue comment.',
+          });
+          expect(editedCommandShouldRoute(event, eventName, current)).toBe(true);
+        });
+      }
+
+      it.each([
+        undefined,
+        null,
+        42,
+        { unexpected: 'shape' },
+      ])('fails closed when previous-body e
```

**File**: `test/gh-aw-command-router-relay.test.ts` (modified, +299/-0)
```diff
@@ -100,6 +100,7 @@ async function runRouter({
   authorType,
   senderType,
   body,
+  previousBody,
   permissions,
   scriptMutation,
 }: {
@@ -110,6 +111,7 @@ async function runRouter({
   authorType?: string;
   senderType?: string;
   body: string;
+  previousBody?: string | null | Record<string, unknown>;
   permissions: Record<string, string>;
   scriptMutation?: (script: string) => string;
 }): Promise<RouterRun> {
@@ -132,6 +134,9 @@ async function runRouter({
       action,
       issue: textSource,
       ...(comment ? { comment } : {}),
+      ...(action === 'edited' && previousBody !== undefined
+        ? { changes: { body: { from: previousBody } } }
+        : {}),
       repository: { default_branch: 'dev' },
       sender: { login: actor, type: senderType ?? 'User' },
     },
@@ -208,6 +213,7 @@ describe('gh-aw: router-to-repair workflow_dispatch relay (#2, #3 findings)', ()
     expect(ROUTER).toContain('getCollaboratorPermissionLevel');
     assertAuthorBinding(ROUTER);
     expect(commandRequiresAuthorization({ status: 'accepted', mode: 'cast' })).toBe(true);
+    expect(commandRequiresAuthorization({ status: 'accepted', mode: 'revoke-improvement' })).toBe(true);
     expect(commandRequiresAuthorization({ status: 'accepted', mode: 'status' })).toBe(false);
     expect(isAuthorizedPermission('read')).toBe(false);
     expect(isAuthorizedPermission('write')).toBe(true);
@@ -391,6 +397,7 @@ describe('gh-aw: mutating router authorization is bound to text provenance', ()
       actor: 'maintainer-editor',
       author: 'unprivileged-author',
       body: 'Please run this request.\n/squad cast',
+      ...(action === 'edited' ? { previousBody: 'Please run this request.' } : {}),
       permissions: {
         'maintainer-editor': 'write',
         'unprivileged-author': 'read',
@@ -414,6 +421,7 @@ describe('gh-aw: mutating router authorization is bound to text provenance', ()
       actor: 'maintainer-editor',
       author: 'maintainer-author',
       body: 'Please run this request.\n/squad cast',
+      previousBody: 'Please run this request.',
       permissions: {
         'maintainer-editor': 'maintain',
         'maintainer-author': 'write',
@@ -432,6 +440,7 @@ describe('gh-aw: mutating router authorization is bound to text provenance', ()
       actor: 'unprivileged-editor',
       author: 'maintainer-author',
       body: 'Please run this request.\n/squad cast',
+      previousBody: 'Please run this request.',
       permissions: {
         'unprivileged-editor': 'read',
         'maintainer-author': 'admin',
@@ -469,6 +478,7 @@ describe('gh-aw: mutating router authorization is bound to text provenance', ()
       action: 'edited',
       actor: 'reader',
       body: 'Please report current state.\n/squad status',
+      previousBody: 'Please report current state.',
       permissions: {},
     });
 
@@ -495,6 +505,288 @@ describe('gh-aw: mutating router authorization is bound to text provenance', ()
     expect(result.dispatchedInputs).toMatchObject({ command: 'cast', issue_number: '4242' });
   });
 
+  it.each([
+    ['issues', 'Please update the title.\n/squad status', 'Updated title context.\n\n /squad   status '],
+    ['issue_comment', 'Before.\n/squad status extra', 'After.\n\n /squad   status   extra '],
+  ] as const)('noops an unrelated %s edit when the accepted or rejected invocation is unchanged', async (
+    eventName,
+    previousBody,
+    body,
+  ) => {
+    const result = await runRouter({
+      eventName,
+      action: 'edited',
+      actor: 'editor',
+      author: 'author',
+      previousBody,
+      body,
+      permissions: { editor: 'write', author: 'write' },
+    });
+
+    expect(result.dispatchedInputs).toBeNull();
+    expect(result.failure).toBeNull();
+    expect(result.postedComments).toEqual([]);
+    expect(result.permissionLookups).toEqual([]);
+  });
+
+  it.each(['issues', 'issue_comment'] as const)(
+    'noops a %s.edited change that only recases parsed command keywords',
+    async eventName => {
+      const result = await runRouter({
+        eventName,
+        action: 'edited',
+        actor: 'maintainer-editor',
+        author: 'maintainer-author',
+        previousBody: 'Before.\n/squad PLAN REVISE Keep APIName casing',
+        body: 'After.\n/squad plan revise Keep APIName casing',
+        permissions: {
+          'maintainer-editor': 'maintain',
+          'maintainer-author': 'write',
+        },
+      });
+
+      expect(result.dispatchedInputs).toBeNull();
+      expect(result.failure).toBeNull();
+      expect(result.postedComments).toEqual([]);
+      expect(result.permissionLookups).toEqual([]);
+    },
+  );
+
+  it.each(['issues', 'issue_comment'] as const)(
+    'noops a rejected %s.edited invocation that only changes command casing',
+    async eventName => {
+      const result = await runRouter({
+        eventName,
+        action: 'edited',
+        actor: 'maintainer-editor',
+        author: 'maintainer-aut
```

**File**: `test/gh-aw-improvement-worker.test.ts` (modified, +103/-6)
```diff
@@ -50,6 +50,7 @@ const env = (root = ROOT) => ({
 });
 function api(options: {
   proposal?: any; approved?: any; comments?: any[]; permission?: any; revision?: any; pulls?: any[];
+  permissions?: Record<string, any>;
   commentFailure?: boolean; pullFailure?: boolean; native?: any; nativeFailure?: boolean;
 } = {}) {
   const proposal = options.proposal || issue();
@@ -62,7 +63,10 @@ function api(options: {
       if (route === `repos/${REPO}/issues/77`) return proposal;
       if (route === `repos/${REPO}/issues/comments/901`) return approved;
       if (route.endsWith('/comments')) return options.commentFailure ? { __status: 503 } : fields.page === 1 ? options.comments || [approved] : [];
-      if (route.endsWith('/permission')) return options.permission || { permission: 'write' };
+      if (route.endsWith('/permission')) {
+        const login = decodeURIComponent(route.split('/').at(-2) || '');
+        return options.permissions?.[login] || options.permission || { permission: 'write' };
+      }
       if (route.endsWith('/pulls')) return options.pullFailure ? { __status: 503 } : fields.page === 1 ? options.pulls || [] : [];
       throw new Error(`Unexpected route: ${route}`);
     },
@@ -216,10 +220,97 @@ describe('improvement: live revalidation and permanent deduplication', () => {
   ])('fails closed on %s', async (_name, options) => {
     expect((await gate.collectImprovementContext(env(), api(options))).authorized).toBe(false);
   });
-  it('honors later revocation even with a newer unrelated approval, but not bot-generated revocation', async () => {
+  it('honors only an authorized, unedited human revocation after the approval', async () => {
     const revoke = comment({ id: 902, body: '/squad revoke-improvement', created_at: '2026-09-03T00:00:00Z', updated_at: '2026-09-03T00:00:00Z' });
-    expect((await gate.collectImprovementContext(env(), api({ comments: [comment(), revoke, comment({ id: 903 })] }))).reason).toBe('approval-revoked');
+    const authorized = api({ comments: [comment(), revoke, comment({ id: 903 })] });
+    expect((await gate.collectImprovementContext(env(), authorized)).reason).toBe('approval-revoked');
+    expect((await gate.collectImprovementContext(env(), api({
+      comments: [comment(), { ...revoke, body: 'Context.\n/squad REVOKE-IMPROVEMENT   ' }],
+    }))).reason).toBe('approval-revoked');
+    expect((await gate.collectImprovementContext(env(), api({
+      comments: [comment(), { ...revoke, body: '```text\n/squad revoke-improvement\n```' }],
+    }))).reason).toBe('approved');
+    expect(authorized.calls).toContain(`repos/${REPO}/collaborators/maintainer/permission`);
     expect((await gate.collectImprovementContext(env(), api({ comments: [{ ...revoke, user: { login: 'bot', type: 'Bot' } }] }))).authorized).toBe(true);
+    expect((await gate.collectImprovementContext(env(), api({
+      comments: [{ ...revoke, updated_at: '2026-09-04T00:00:00Z' }],
+    }))).authorized).toBe(true);
+    expect((await gate.collectImprovementContext(env(), api({
+      comments: [{ ...revoke, performed_via_github_app: { id: 1 } }],
+    }))).authorized).toBe(true);
+    expect((await gate.collectImprovementContext(env(), api({
+      comments: [{ ...revoke, created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z' }],
+    }))).authorized).toBe(true);
+    expect(await gate.collectImprovementContext(env(), api({
+      comments: [{ ...revoke, created_at: 'not-a-timestamp', updated_at: 'not-a-timestamp' }],
+    }))).toMatchObject({ authorized: false, reason: 'revocation-history-incomplete' });
+  });
+  it('uses complete comment order to resolve equal-timestamp revocation boundaries', async () => {
+    const revoke = comment({
+      id: 902,
+      body: '/squad revoke-improvement',
+      created_at: AT,
+      updated_at: AT,
+    });
+    expect(await gate.collectImprovementContext(env(), api({
+      comments: [revoke, comment()],
+    }))).toMatchObject({ authorized: true, reason: 'approved' });
+    expect(await gate.collectImprovementContext(env(), api({
+      comments: [comment(), revoke],
+    }))).toMatchObject({ authorized: false, reason: 'approval-revoked' });
+  });
+  it('uses numeric comment IDs for equal timestamps when the approval is absent from the complete list', async () => {
+    const before = comment({
+      id: 900,
+      body: '/squad revoke-improvement',
+      created_at: AT,
+      updated_at: AT,
+    });
+    const after = comment({
+      id: 902,
+      body: '/squad revoke-improvement',
+      created_at: AT,
+      updated_at: AT,
+    });
+    expect(await gate.collectImprovementContext(env(), api({
+      comments: [before],
+    }))).toMatchObject({ authorized: true, reason: 'approved' });
+    expect(await gate.collectImprovementContext(env(), api({
+      comments: [after],
+    }))).toMatchObject({ authorized: false, reason: 'approval-revoked' });
+  });
+  it('ignores an unprivileged revocation and fails closed 
```

**File**: `test/gh-aw-quality.test.ts` (modified, +3/-3)
```diff
@@ -3981,8 +3981,8 @@ describe('gh-aw: canonical package integrity contract', () => {
       expect(mutable).not.toContain(actionReference);
       expect(createHash('sha256').update(normalizeCompiledLock(mutable, revisionA)).digest('hex'))
         .toBe(sourceBinding === 'workflow'
-          ? '9bec39a94b57b8d6c2baf92b25bf2817ff7bf389533d6462d71a1937b2154cbe'
-          : '00bb10abb90600fd03411e6036ab67741b208da1c9698f8eb1f5faea142583a9');
+          ? 'c86cd65d09ee74d8da4dfec27f64ccba818d22f282c5a4acf33f04e04f5d6bd6'
+          : '206fcc936e5c03e81928565104bc7b2fef9c492f9e8152b17df563bd07e5065a');
       expect(() => validateCompilerActionPins(mutable)).toThrow(/invalid immutable action pin/);
       writeFileSync(lockPath, mutable);
       expect(verifyInstall(root).failures.join('\n'))
@@ -4036,7 +4036,7 @@ describe('gh-aw: canonical package integrity contract', () => {
     compile();
     const unpinned = readText(lockPath);
     expect(createHash('sha256').update(normalizeCompiledLock(unpinned, revisionA)).digest('hex'))
-      .toBe('00bb10abb90600fd03411e6036ab67741b208da1c9698f8eb1f5faea142583a9');
+      .toBe('206fcc936e5c03e81928565104bc7b2fef9c492f9e8152b17df563bd07e5065a');
     expect(verifyInstall(root).failures.join('\n')).toContain('Installed digest mismatch');
 
     const seedPins = () => spawnSync(process.execPath, ['--input-type=module', '-e', seed!], {
```

**File**: `test/gh-aw-retro-workflow.test.ts` (modified, +4/-0)
```diff
@@ -1642,6 +1642,10 @@ describe('Squad retrospective workflow integration', () => {
     expect(RETRO).toContain('/squad approve-improvement');
     expect(RETRO).toContain('Approved-Path: {first proposed path}');
     expect(RETRO).toContain('/squad revoke-improvement');
+    expect(RETRO).toContain('Only a later unedited, non-app human issue comment');
+    expect(RETRO).toContain('live repository permission is');
+    expect(RETRO).toContain('Unresolved revocation permission or');
+    expect(RETRO).toContain('comment-history evidence fails closed');
     expect(RETRO).toContain('Never post that command yourself in a comment');
   });
 
```

**File**: `workflows/package/squad-command-router.md` (modified, +9/-1)
```diff
@@ -59,10 +59,18 @@ safe-outputs:
             context.payload,
             process.env.SQUAD_EVENT_NAME,
           );
+          if (!contract.editedCommandShouldRoute(
+            context.payload,
+            process.env.SQUAD_EVENT_NAME,
+            result,
+          )) {
+            core.info('Ignoring an edited body whose canonical /squad invocation did not change or whose previous body is unavailable.');
+            return;
+          }
           if (result.status === 'accepted' || result.status === 'rejected') {
             // A bot-authored issue or comment body is never a trusted Squad
             // command, open mode or not: open modes (`status`, `review`,
-            // `research`, `plan`, `revoke-improvement`) intentionally skip
+            // `research`, `plan`) intentionally skip
             // the permission check below, so without this guard any bot that
             // reposts or quotes `/squad` text (for example a relay, mirror,
             // or notification bot) could replay it into a real dispatch with
```

---

### Incident Patch 14: `2b0ac279` (2026-10-02)
**Commit Message**: fix(gh-aw): remove mutable generated router (#2148)

* fix(gh-aw): remove mutable generated router

Reject gh-aw's unowned mutable agentic-workflows skill in final and staged installation verification while preserving the exact Squad enlistment skill.

Finding: octodemo/zava-social-queue-worker-20261002092250#1 comment 4164580830

Co-authored-by: Copilot App <[REDACTED_EMAIL]>

* test(gh-aw): prove router removal independence

Document and enforce that repository routing uses the owned agentic-workflows specialist, designer, and reliability skill without the mutable gh-aw router.

Co-authored-by: Copilot App <[REDACTED_EMAIL]>

* fix(gh-aw): repair verifier recovery cleanup

Co-authored-by: Copilot App <[REDACTED_EMAIL]>

---------

Co-authored-by: Copilot App <[REDACTED_EMAIL]>

**File**: `.changeset/remove-mutable-gh-aw-router.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+---
+"@bradygaster/squad-cli": patch
+"@bradygaster/squad-sdk": patch
+---
+
+Remove gh-aw's generated mutable `agentic-workflows` router during Squad enlistment and fail installation verification when that unowned skill remains.
```

**File**: `.github/agents.md` (modified, +13/-0)
```diff
@@ -50,8 +50,21 @@ The quick start installs this workflow set:
 ```bash
 SQUAD_SHA="<40-character-commit-sha>"  # explicit, maintainer-approved; never `commits/dev`
 gh aw add "bradygaster/squad/workflows@${SQUAD_SHA}"
+rm -f .github/skills/agentic-workflows/SKILL.md
 ```
 
+The removal is intentional: gh-aw v0.89.22 generates that generic tool-owned
+router, which loads mutable prompts from the current `github/gh-aw` repository.
+It is not Squad-owned or bound to `SQUAD_SHA`. Keep the exact
+`.github/skills/gh-aw-enlistment/SKILL.md` installed by Squad.
+This repository routes gh-aw work directly through the
+`agentic-workflows-dev` specialist in `.squad/routing.md`, with the local
+`agentic-workflow-designer` and `gh-aw-reliability` skills for design and
+contract validation. None depends on the deleted router. Retaining a rewritten
+or pinned copy would make Squad the owner of a forked generic gh-aw prompt
+router and its upstream corpus; removal preserves the package boundary without
+vendoring or synchronizing that mutable scaffold.
+
 This command:
 
 1. Fetches the Squad dispatcher, general and dependency workers, independent reviewer with a required-check gate, retrospective, and approval-gated improvement worker
```

**File**: `.github/skills/agentic-workflows/SKILL.md` (removed, +0/-98)
```diff
@@ -1,98 +0,0 @@
----
-name: agentic-workflows
-description: Route gh-aw workflow design/create/debug/upgrade requests to the right prompts.
----
-
-# Agentic Workflows Router
-
-Use this skill when a user asks to design, create, update, debug, or upgrade GitHub Agentic Workflows in this repository.
-
-This skill is a dispatcher: identify the task type, load the matching workflow prompt/skill file, and follow it directly. Keep responses concise and ask a clarifying question if the correct prompt is unclear.
-
-Read only the files you need:
-Load these files from `github/gh-aw` (they are not available locally).
-- `.github/aw/action-container-substitutions.md`
-- `.github/aw/agentic-chat.md`
-- `.github/aw/agentic-workflows-mcp.md`
-- `.github/aw/asciicharts.md`
-- `.github/aw/campaign.md`
-- `.github/aw/charts-trending.md`
-- `.github/aw/charts.md`
-- `.github/aw/cli-commands.md`
-- `.github/aw/configure-agentic-engine.md`
-- `.github/aw/context.md`
-- `.github/aw/create-agentic-workflow-trigger-details.md`
-- `.github/aw/create-agentic-workflow.md`
-- `.github/aw/create-shared-agentic-workflow.md`
-- `.github/aw/debug-agentic-workflow.md`
-- `.github/aw/dependabot.md`
-- `.github/aw/deployment-status.md`
-- `.github/aw/designer.md`
-- `.github/aw/evals.md`
-- `.github/aw/experiments.md`
-- `.github/aw/github-agentic-workflows.md`
-- `.github/aw/github-mcp-server-pagination.md`
-- `.github/aw/github-mcp-server.md`
-- `.github/aw/instructions.md`
-- `.github/aw/linter-workflows.md`
-- `.github/aw/llms.md`
-- `.github/aw/loop.md`
-- `.github/aw/lsp.md`
-- `.github/aw/mcp-clis.md`
-- `.github/aw/memory-stateful-patterns.md`
-- `.github/aw/memory.md`
-- `.github/aw/messages.md`
-- `.github/aw/multi-agent-research.md`
-- `.github/aw/network.md`
-- `.github/aw/optimize-agentic-workflow.md`
-- `.github/aw/patterns.md`
-- `.github/aw/pr-reviewer.md`
-- `.github/aw/release-workflow.md`
-- `.github/aw/report.md`
-- `.github/aw/reuse.md`
-- `.github/aw/safe-outputs-automation.md`
-- `.github/aw/safe-outputs-content.md`
-- `.github/aw/safe-outputs-management.md`
-- `.github/aw/safe-outputs-runtime.md`
-- `.github/aw/safe-outputs.md`
-- `.github/aw/serena-tool.md`
-- `.github/aw/shared-safe-jobs.md`
-- `.github/aw/skills.md`
-- `.github/aw/subagents.md`
-- `.github/aw/syntax-agentic.md`
-- `.github/aw/syntax-core.md`
-- `.github/aw/syntax-engine.md`
-- `.github/aw/syntax-tools-imports.md`
-- `.github/aw/syntax.md`
-- `.github/aw/test-coverage.md`
-- `.github/aw/test-expression.md`
-- `.github/aw/token-optimization-caching-budgets.md`
-- `.github/aw/token-optimization-observability.md`
-- `.github/aw/token-optimization.md`
-- `.github/aw/triggers.md`
-- `.github/aw/update-agentic-workflow.md`
-- `.github/aw/upgrade-agentic-workflows.md`
-- `.github/aw/visual-regression.md`
-- `.github/aw/workflow-constraints.md`
-- `.github/aw/workflow-editing.md`
-- `.github/aw/workflow-patterns.md`
-
-- `.github/skills/agentic-workflow-designer/SKILL.md`
-After loading the matching workflow prompt or skill, follow it directly:
-- Enlist a repository into Squad via gh-aw (install the supported `/squad` workflow bootstrap): `.squad/skills/gh-aw-enlistment/SKILL.md` — **this one is local to this repository**, not fetched from `github/gh-aw`. Use for "set up Squad agentic workflows", "enlist this repo in Squad", or "install Squad gh-aw workflows"
-- Design workflows from scratch via interview: `skills/agentic-workflow-designer/SKILL.md`
-- Create new workflows: `.github/aw/create-agentic-workflow.md`
-- Update existing workflows: `.github/aw/update-agentic-workflow.md`
-- Debug, audit, or investigate workflows: `.github/aw/debug-agentic-workflow.md`
-- Validate workflow contracts and safe outputs: `.github/skills/gh-aw-reliability/SKILL.md`
-- Upgrade workflows and fix deprecations: `.github/aw/upgrade-agentic-workflows.md`
-- Create shared components or MCP wrappers: `.github/aw/create-shared-agentic-workflow.md`
-- Create report-generating workflows: `.github/aw/report.md`
-- Fix Dependabot manifest PRs: `.github/aw/dependabot.md`
-- Analyze coverage workflows: `.github/aw/test-coverage.md`
-- Render compact markdown charts: `.github/aw/asciicharts.md`
-- Map CLI commands to MCP usage: `.github/aw/cli-commands.md`
-- Choose workflow architecture and patterns: `.github/aw/patterns.md`
-- Optimize token usage and cost: `.github/aw/token-optimization.md`
-
-When the task involves OTEL, OTLP, traces, observability backends, or telemetry-driven analysis, consult the relevant agentic workflow patterns for observability (the `skills/otel-queries/` skill is planned but not yet available).
```

**File**: `.github/workflows/squad-ci.yml` (modified, +1/-0)
```diff
@@ -784,6 +784,7 @@ jobs:
                 ".github/workflows/${workflow}.md"
             done
             gh aw add --force "$GITHUB_WORKSPACE/workflows"
+            rm -f .github/skills/agentic-workflows/SKILL.md
             node .github/workflows/shared/squad-install-verifier.mjs \
               --write-local-test-ownership \
               --source-revision "$SQUAD_SOURCE_REVISION"
```

**File**: `.squad-templates/skills/gh-aw-enlistment/SKILL.md` (modified, +26/-3)
```diff
@@ -194,6 +194,7 @@ published release guidance, then set it once:
   exit 1
 }
 gh aw add "bradygaster/squad/workflows@${SQUAD_SHA}"
+rm -f .github/skills/agentic-workflows/SKILL.md
 ```
 
 The nested `workflows/aw.yml` is the only supported distribution registration.
@@ -216,6 +217,15 @@ governance-scoped retrospective proposal (see the gh-aw guide's retrospective
 auto-implementation section); installing it alongside the other seven keeps the
 full stack consistent and avoids a second bootstrap pass later.
 
+gh-aw v0.89.22 also materializes
+`.github/skills/agentic-workflows/SKILL.md`. That generic tool-owned router is
+not part of the Squad package and directs agents to mutable prompts from the
+current `github/gh-aw` repository rather than the pinned Squad revision. Remove
+that exact file after every `gh aw add`. Keep
+`.github/skills/gh-aw-enlistment/SKILL.md`: it is the one Squad-owned skill and
+the verifier requires its exact package bytes. Do not adopt or vendor the rest
+of gh-aw's generic scaffold.
+
 Report/proposal-only is the default. Ordinary fixes require the explicit
 `"squadRetroAutoImplement": "allow"` setting in `.squad/config.json`;
 five action issues and three dispatches per wake-up remain separate caps.
@@ -337,11 +347,20 @@ git add -- .gitattributes .github/aw/ .github/workflows/ .github/skills/
 node .github/workflows/shared/squad-install-verifier.mjs \
   --verify-staged-install --stage-ownership --source-revision "${SQUAD_SHA}" || exit 1
 git diff --cached --stat
-# No deletions should be staged:
-test -z "$(git diff --cached --diff-filter=D --name-only)" || { echo "STOP: staged deletions"; exit 1; }
+unexpected_deletions="$(
+  git diff --cached --diff-filter=D --name-only |
+    grep -vxF '.github/skills/agentic-workflows/SKILL.md' || true
+)"
+test -z "${unexpected_deletions}" || {
+  printf 'STOP: unexpected staged deletions:\n%s\n' "${unexpected_deletions}" >&2
+  exit 1
+}
 ```
 
-- **STOP** if the staged diff shows **unexpected deletions**, **unexpected secrets**,
+- The only permitted staged deletion is
+  `.github/skills/agentic-workflows/SKILL.md`, when upgrading a repository that
+  previously committed gh-aw's mutable router.
+- **STOP** if the staged diff shows any other **unexpected deletions**, **unexpected secrets**,
   edits to **unrelated files**, or committed **log/diagnostic output**. Re-scope with
   explicit `git add -- <path>` — never `git add .`, `git add -A`, or `git commit -a`.
 
@@ -461,6 +480,7 @@ git switch -c chore/squad-gh-aw-bootstrap
   exit 1
 }
 gh aw add "bradygaster/squad/workflows@${SQUAD_SHA}"
+rm -f .github/skills/agentic-workflows/SKILL.md
 
 # Safe-update report shows ONLY the two documented secrets + squad-init → approve once
 gh aw compile --strict --approve
@@ -517,6 +537,9 @@ gh pr merge --squash                # auto-merge before human review. NEVER.
   before installation if repository administration permission is unavailable.
 - ❌ **Blanket staging** (`git add .` / `-A` / `git commit -a`). Stage only
   `.gitattributes`, `.github/aw/`, `.github/workflows/`, `.github/skills/`, by path.
+- ❌ **Committing gh-aw's mutable router.** Remove only
+  `.github/skills/agentic-workflows/SKILL.md`; keep the exact Squad-owned
+  `.github/skills/gh-aw-enlistment/SKILL.md`.
 - ❌ **Approving unknown safe updates.** Approve ONLY `SQUAD_GITHUB_APP_PRIVATE_KEY`,
   `SQUAD_GITHUB_TOKEN`, and `bradygaster/squad/.github/actions/squad-init`. Anything
   else is a STOP.
```

**File**: `README.md` (modified, +6/-1)
```diff
@@ -588,6 +588,7 @@ test "$(gh api "repos/${owner_repo}" --jq '.has_issues')" = "true" || {
 
 SQUAD_SHA="<40-character-commit-sha>"  # explicit, maintainer-approved; never `commits/dev`
 gh aw add "bradygaster/squad/workflows@${SQUAD_SHA}"
+rm -f .github/skills/agentic-workflows/SKILL.md
 git add -- \
   .github/aw/ \
   .github/skills/ \
@@ -606,12 +607,16 @@ Review the complete generated diff before you commit:
 |------|-------------------|---------|
 | `.github/workflows/` | The Squad workflow sources, shared imports, compiled lock files, and `agentics-maintenance.yml` | Yes |
 | `.github/aw/` | Supporting gh-aw state, including pinned action versions and SHAs | Yes |
-| `.github/skills/` | The agentic-workflows dispatcher skill | Yes |
+| `.github/skills/` | The exact Squad-owned `gh-aw-enlistment` skill; remove gh-aw's generated mutable `agentic-workflows` router before staging | Yes |
 | `.gitattributes` | Marks compiled `.lock.yml` workflows as generated | Yes |
 | `.vscode/` | Workspace settings that enable GitHub Copilot for Markdown files in VS Code | Optional — commit only if you want to share this workspace setting |
 
 `agentics-maintenance.yml` is a second installed workflow. Squad configures its created pull request safe output to expire after 14 days, so this workflow runs scheduled expiration cleanup and also exposes manual maintenance operations. To omit it, create `.github/workflows/aw.json` with `{"maintenance": false}` before installing. gh-aw then warns that expiration is disabled and removes the maintenance workflow.
 
+Unlike the mutable router skill, `agentics-maintenance.yml` is compiled runtime
+output required for the configured 14-day safe-output expiration behavior. Keep
+it unless you explicitly disable maintenance before installation.
+
 #### Retrospective auto-implementation (opt-in behavior)
 
 `squad-improvement-worker` installs as part of the standard seven-workflow
```

**File**: `docs/src/content/docs/guide/gh-aw.md` (modified, +30/-7)
```diff
@@ -90,6 +90,7 @@ SQUAD_SHA="<40-character-commit-sha>"
 }
 
 gh aw add "bradygaster/squad/workflows@${SQUAD_SHA}"
+rm -f .github/skills/agentic-workflows/SKILL.md
 
 # 5. On first install, review the safe-update report.
 # If it contains only the documented Squad secrets and init action, approve it:
@@ -111,7 +112,11 @@ git add -- .gitattributes .github/aw/ .github/workflows/ .github/skills/
 node .github/workflows/shared/squad-install-verifier.mjs \
   --verify-staged-install --stage-ownership --source-revision "${SQUAD_SHA}" || exit 1
 git diff --cached --stat
-test -z "$(git diff --cached --diff-filter=D --name-only)"
+unexpected_deletions="$(
+  git diff --cached --diff-filter=D --name-only |
+    grep -vxF '.github/skills/agentic-workflows/SKILL.md' || true
+)"
+test -z "${unexpected_deletions}"
 git commit -m "ci: add Squad agentic workflow"
 git push -u origin HEAD
 gh pr create \
@@ -158,8 +163,10 @@ PR could merge but the bootstrap journey could not complete. Reading
 that update fails, stop before installation and ask an administrator to enable
 **Settings → General → Features → Issues**, then rerun the quick start.
 
-> Step 7 stages `.github/skills/` because `gh aw add` installs the Squad skills
-> alongside the workflows, and it deliberately does not stage `.github/aw/logs/`.
+> Step 7 stages `.github/skills/` because `gh aw add` installs the Squad skill
+> alongside the workflows and may need to stage deletion of gh-aw's unowned
+> `.github/skills/agentic-workflows/SKILL.md`. It deliberately does not stage
+> `.github/aw/logs/`.
 > Downloaded workflow logs are local diagnostic output — see [ignoring downloaded
 > logs](#open-the-bootstrap-pull-request) before you commit.
 
@@ -336,6 +343,7 @@ SQUAD_SHA="<40-character-commit-sha>"
   exit 1
 }
 gh aw add "bradygaster/squad/workflows@${SQUAD_SHA}"
+rm -f .github/skills/agentic-workflows/SKILL.md
 ```
 
 The nested `workflows/aw.yml` is the canonical package registration. Its
@@ -374,8 +382,14 @@ add-on — it stays dormant until a maintainer approves a governance-scoped
 retrospective proposal (see [Retrospective
 auto-implementation](#retrospective-auto-implementation-opt-in) below).
 
-`gh aw add` also installs the Squad skills under `.github/skills/`, which is why
-the bootstrap commit stages that path alongside the workflows.
+`gh aw add` also installs the Squad skill under `.github/skills/`, which is why
+the bootstrap commit stages that path alongside the workflows. gh-aw v0.89.22
+additionally generates `.github/skills/agentic-workflows/SKILL.md`. That
+tool-owned router loads mutable prompt files from the current `github/gh-aw`
+repository and is not bound to the pinned Squad revision or compiler version.
+Remove that exact file after every install. Do not vendor the generic gh-aw
+prompt corpus. The verifier rejects the router if it remains and still requires
+the exact Squad-owned `.github/skills/gh-aw-enlistment/SKILL.md`.
 
 > **Revision note:** `SQUAD_SHA` is an explicit, maintainer-approved commit —
 > never resolved from `dev`'s moving tip. The package install itself uses only
@@ -479,7 +493,11 @@ git add -- .gitattributes .github/aw/ .github/workflows/ .github/skills/
 node .github/workflows/shared/squad-install-verifier.mjs \
   --verify-staged-install --stage-ownership --source-revision "${SQUAD_SHA}" || exit 1
 git diff --cached --stat
-test -z "$(git diff --cached --diff-filter=D --name-only)"
+unexpected_deletions="$(
+  git diff --cached --diff-filter=D --name-only |
+    grep -vxF '.github/skills/agentic-workflows/SKILL.md' || true
+)"
+test -z "${unexpected_deletions}"
 git commit -m "ci: add Squad agentic workflow"
 git push -u origin HEAD
 gh pr create \
@@ -495,6 +513,10 @@ state under `.github/aw/`, the installed skills, and `.gitattributes`. Review
 the complete generated diff in the bootstrap PR, address Copilot review
 feedback, and wait for required checks. Merge only after human approval.
 
+The exact router deletion above is the only permitted staged deletion, for an
+upgrade from a repository that previously committed it. Any other deletion is
+a hard stop.
+
 Consumer ignore rules such as `packages/` can silently omit the required
 `.github/aw/packages/` ownership JSON from directory staging. The staged verifier
 force-adds only the exact native package ownership JSON when ignored and
@@ -575,7 +597,7 @@ Use this checklist for the initial bootstrap and after any workflow update:
 | Stage | Action | Expected evidence |
 |-------|--------|-------------------|
 | Repository readiness | Confirm `.has_issues` is `true`; if it is `false`, enable it before installing workflows | GitHub Issues are available for `/squad` comments and the bootstrap research/proposals issue; insufficient administration permission stops the install before a bootstrap PR is created |
-| Install | Run the eight-workflow `gh aw add` command on a bootstrap branch | All eight `.md`/`.lock.yml` pairs exist, with shared imports, `.github/aw/`, in
```

**File**: `packages/squad-cli/templates/skills/gh-aw-enlistment/SKILL.md` (modified, +26/-3)
```diff
@@ -194,6 +194,7 @@ published release guidance, then set it once:
   exit 1
 }
 gh aw add "bradygaster/squad/workflows@${SQUAD_SHA}"
+rm -f .github/skills/agentic-workflows/SKILL.md
 ```
 
 The nested `workflows/aw.yml` is the only supported distribution registration.
@@ -216,6 +217,15 @@ governance-scoped retrospective proposal (see the gh-aw guide's retrospective
 auto-implementation section); installing it alongside the other seven keeps the
 full stack consistent and avoids a second bootstrap pass later.
 
+gh-aw v0.89.22 also materializes
+`.github/skills/agentic-workflows/SKILL.md`. That generic tool-owned router is
+not part of the Squad package and directs agents to mutable prompts from the
+current `github/gh-aw` repository rather than the pinned Squad revision. Remove
+that exact file after every `gh aw add`. Keep
+`.github/skills/gh-aw-enlistment/SKILL.md`: it is the one Squad-owned skill and
+the verifier requires its exact package bytes. Do not adopt or vendor the rest
+of gh-aw's generic scaffold.
+
 Report/proposal-only is the default. Ordinary fixes require the explicit
 `"squadRetroAutoImplement": "allow"` setting in `.squad/config.json`;
 five action issues and three dispatches per wake-up remain separate caps.
@@ -337,11 +347,20 @@ git add -- .gitattributes .github/aw/ .github/workflows/ .github/skills/
 node .github/workflows/shared/squad-install-verifier.mjs \
   --verify-staged-install --stage-ownership --source-revision "${SQUAD_SHA}" || exit 1
 git diff --cached --stat
-# No deletions should be staged:
-test -z "$(git diff --cached --diff-filter=D --name-only)" || { echo "STOP: staged deletions"; exit 1; }
+unexpected_deletions="$(
+  git diff --cached --diff-filter=D --name-only |
+    grep -vxF '.github/skills/agentic-workflows/SKILL.md' || true
+)"
+test -z "${unexpected_deletions}" || {
+  printf 'STOP: unexpected staged deletions:\n%s\n' "${unexpected_deletions}" >&2
+  exit 1
+}
 ```
 
-- **STOP** if the staged diff shows **unexpected deletions**, **unexpected secrets**,
+- The only permitted staged deletion is
+  `.github/skills/agentic-workflows/SKILL.md`, when upgrading a repository that
+  previously committed gh-aw's mutable router.
+- **STOP** if the staged diff shows any other **unexpected deletions**, **unexpected secrets**,
   edits to **unrelated files**, or committed **log/diagnostic output**. Re-scope with
   explicit `git add -- <path>` — never `git add .`, `git add -A`, or `git commit -a`.
 
@@ -461,6 +480,7 @@ git switch -c chore/squad-gh-aw-bootstrap
   exit 1
 }
 gh aw add "bradygaster/squad/workflows@${SQUAD_SHA}"
+rm -f .github/skills/agentic-workflows/SKILL.md
 
 # Safe-update report shows ONLY the two documented secrets + squad-init → approve once
 gh aw compile --strict --approve
@@ -517,6 +537,9 @@ gh pr merge --squash                # auto-merge before human review. NEVER.
   before installation if repository administration permission is unavailable.
 - ❌ **Blanket staging** (`git add .` / `-A` / `git commit -a`). Stage only
   `.gitattributes`, `.github/aw/`, `.github/workflows/`, `.github/skills/`, by path.
+- ❌ **Committing gh-aw's mutable router.** Remove only
+  `.github/skills/agentic-workflows/SKILL.md`; keep the exact Squad-owned
+  `.github/skills/gh-aw-enlistment/SKILL.md`.
 - ❌ **Approving unknown safe updates.** Approve ONLY `SQUAD_GITHUB_APP_PRIVATE_KEY`,
   `SQUAD_GITHUB_TOKEN`, and `bradygaster/squad/.github/actions/squad-init`. Anything
   else is a STOP.
```

---

### Incident Patch 15: `c51281db` (2026-10-02)
**Commit Message**: fix(gh-aw): verify installed workflow source bindings (#2147)

* fix(gh-aw): verify installed workflow source bindings

Closes #2146

Co-authored-by: Copilot App <[REDACTED_EMAIL]>

* fix(gh-aw): reject extra workflow newline

Closes #2146

Co-authored-by: Copilot App <[REDACTED_EMAIL]>

* chore(gh-aw): regenerate restacked workflow manifest

Closes #2146

Co-authored-by: Copilot App <[REDACTED_EMAIL]>

---------

Co-authored-by: Copilot App <[REDACTED_EMAIL]>

**File**: `.changeset/fail-closed-gh-aw-resource-verification.md` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+---
+"@bradygaster/squad-cli": patch
+"@bradygaster/squad-sdk": patch
+---
+
+Verify installed workflow resources against their trusted installer source binding,
+revision, ownership provenance, and canonical digest while preserving exact-byte
+verification for shared runtime and skill resources.
```

**File**: `test/gh-aw-verify-resource.test.ts` (added, +147/-0)
```diff
@@ -0,0 +1,147 @@
+import { afterEach, describe, expect, it } from 'vitest';
+import { createHash } from 'node:crypto';
+import { spawnSync } from 'node:child_process';
+import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
+import { dirname, join, resolve } from 'node:path';
+import {
+  CONTRACT_DESTINATION,
+  OWNERSHIP_DESTINATION,
+  PACKAGE_NAME,
+} from '../workflows/shared/squad-install-verifier.mjs';
+import { createFirstInstallFixture } from './helpers/gh-aw-install-fixture.js';
+
+const revision = 'a'.repeat(40);
+const verifier = resolve('workflows/shared/squad-install-verifier.mjs');
+const workspaceRoot = resolve('.test-workspaces');
+const roots: string[] = [];
+const workflowMutations: ReadonlyArray<
+  readonly [string, (text: string, source: string) => string]
+> = [
+  ['owner', (text, source) =>
+    text.replace(source, source.replace('bradygaster/', 'attacker/'))],
+  ['repo', (text, source) =>
+    text.replace(source, source.replace('/squad/', '/other/'))],
+  ['workflow', (text, source) =>
+    text.replace(source, source.replace('squad-review.md', 'squad.md'))],
+  ['revision', (text, source) =>
+    text.replace(source, source.replace(revision, 'b'.repeat(40)))],
+  ['suffix', (text, source) => text.replace(source, `${source}/extra`)],
+  ['missing', (text, source) => text.replace(`${source}\n`, '')],
+  ['duplicate', (text, source) => text.replace(source, `${source}\n${source}`)],
+  ['misplaced', (text, source) =>
+    text.replace(`${source}\n---\n`, `---\n${source}\n`)],
+  ['extra final newline', text => `${text}\n`],
+  ['content', text => text.replace('Squad Review', 'Tampered Squad Review')],
+];
+
+function write(root: string, path: string, content: string | Buffer): void {
+  const destination = join(root, path);
+  mkdirSync(dirname(destination), { recursive: true });
+  writeFileSync(destination, content);
+}
+
+function makeConsumer(sourceBinding: 'workflow' | 'package' = 'workflow'): string {
+  mkdirSync(workspaceRoot, { recursive: true });
+  const root = mkdtempSync(join(workspaceRoot, 'gh-aw-verify-resource-'));
+  roots.push(root);
+  const fixture = createFirstInstallFixture(revision, sourceBinding);
+  for (const [path, content] of fixture.consumerFiles) write(root, path, content);
+  write(root, OWNERSHIP_DESTINATION, `${JSON.stringify(fixture.provenance, null, 2)}\n`);
+  return root;
+}
+
+function runVerify(root: string, destination: string) {
+  return spawnSync(process.execPath, [
+    verifier,
+    '--root', root,
+    '--verify-resource', destination,
+  ], { encoding: 'utf8' });
+}
+
+function updateOwnedDigest(root: string, destination: string): void {
+  const ownershipPath = join(root, OWNERSHIP_DESTINATION);
+  const ownership = JSON.parse(readFileSync(ownershipPath, 'utf8'));
+  const entry = ownership.files.find(
+    (candidate: { destination: string }) => candidate.destination === destination,
+  );
+  if (!entry) throw new Error(`Missing ownership entry for ${destination}`);
+  entry.sha256 = createHash('sha256').update(readFileSync(join(root, destination))).digest('hex');
+  writeFileSync(ownershipPath, `${JSON.stringify(ownership, null, 2)}\n`);
+}
+
+afterEach(() => {
+  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
+});
+
+describe('gh-aw: consumer resource verification', () => {
+  it.each(['workflow', 'package'] as const)(
+    'exercises the shipped --verify-resource CLI against a clean %s-bound install',
+    sourceBinding => {
+      const root = makeConsumer(sourceBinding);
+      const destination = '.github/workflows/squad-review.md';
+      const result = runVerify(root, destination);
+      expect(result.status, result.stderr).toBe(0);
+      expect(result.stdout.trim()).toMatch(/^[0-9a-f]{64}$/);
+    },
+  );
+
+  it('accepts only the documented final-newline variation', () => {
+    const root = makeConsumer();
+    const destination = '.github/workflows/squad-review.md';
+    const original = readFileSync(join(root, destination), 'utf8');
+    expect(original.endsWith('\n')).toBe(true);
+    writeFileSync(join(root, destination), original.slice(0, -1));
+    updateOwnedDigest(root, destination);
+    const result = runVerify(root, destination);
+    expect(result.status, result.stderr).toBe(0);
+  });
+
+  it.each(workflowMutations)('rejects %s workflow resource mutation through the CLI', (label, mutate) => {
+    const root = makeConsumer();
+    const destination = '.github/workflows/squad-review.md';
+    const source = `source: ${PACKAGE_NAME}/package/squad-review.md@${revision}`;
+    const original = readFileSync(join(root, destination), 'utf8');
+    const modified = mutate(original, source);
+    expect(modified, label).not.toBe(original);
+    writeFileSync(join(root, destination), modified);
+    updateOwnedDigest(root, destination);
+    const result = runVerify(root, destination);
+    expect(result.status, `${label}: ${result.stdout}${result
```

**File**: `workflows/package/squad-bootstrap.md` (modified, +1/-1)
```diff
@@ -152,7 +152,7 @@ pre-agent-steps:
         node --check "$path" >/dev/null
       }
       # BEGIN GENERATED RESOURCE DIGESTS
-      check_hash "$install_verifier" "cf474be9b04d339f7e7a18c65e776b8a53e84bea5b4b85abfe65ed11f7b782ce"
+      check_hash "$install_verifier" "da3f2ef1fc7efc8676eb654643bd0d0c0e59606538eeb2ebe7cf25792c63d1c1"
       check_hash "$cast_validator" "c6d0b92aac71dc6f6d5727cac418a323b0bc9c12047400faa12d96150d548ada"
       check_hash "$bootstrap_validator" "1af6ab267eaf1148501a949b8b9ac65a1929130b03a1d7f757b156fd2de63fbb"
       # END GENERATED RESOURCE DIGESTS
```

**File**: `workflows/shared/squad-install-verifier.mjs` (modified, +40/-22)
```diff
@@ -703,30 +703,45 @@ function verifyOwnership(root, contract, expectedRevision) {
   return record.resolvedCommit;
 }
 
+function digestMatchesWithFinalNewlineTolerance(content, expectedDigest) {
+  return [content, `${content}\n`]
+    .some(candidate => sha256(Buffer.from(candidate)) === expectedDigest);
+}
+
+function verifyWorkflowSourceBinding(root, entry, revision) {
+  const installed = readRequired(root, entry.destination);
+  const text = installed.toString('utf8');
+  const lines = text.split('\n');
+  const frontmatterEnd = lines[0] === '---' ? lines.indexOf('---', 1) : -1;
+  const sourceIndexes = lines
+    .map((line, index) => line.startsWith('source:') ? index : -1)
+    .filter(index => index >= 0);
+  const sourceBindings = new Map([
+    [`source: ${PACKAGE_NAME}@${revision}`, entry.package_lock_sha256],
+    [`source: bradygaster/squad/${entry.source}@${revision}`, entry.lock_sha256],
+  ]);
+  const sourceIndex = sourceIndexes[0];
+  const sourceBinding = lines[sourceIndex];
+  if (frontmatterEnd < 0 || sourceIndexes.length !== 1
+    || sourceIndex !== frontmatterEnd - 1 || !sourceBindings.has(sourceBinding)) {
+    throw new Error(`Installed source binding is invalid for ${entry.destination}.`);
+  }
+  lines.splice(sourceIndex, 1);
+  if (!digestMatchesWithFinalNewlineTolerance(lines.join('\n'), entry.source_sha256)) {
+    throw new Error(`Installed digest mismatch for ${entry.destination}.`);
+  }
+  return {
+    digest: sha256(installed),
+    lockDigest: sourceBindings.get(sourceBinding),
+  };
+}
+
 function verifyInstalledBytes(root, contract, revision) {
   const lockDigests = new Map();
   for (const entry of contract.workflows) {
-    const installed = readRequired(root, entry.destination);
-    const text = installed.toString('utf8');
-    const { frontmatter } = splitWorkflow(text, entry.destination);
-    const sourceLines = frontmatter.split('\n').filter(line => /^source:/.test(line));
-    const sourceBinding = sourceLines[0];
-    const sourceBindings = new Map([
-      [`source: ${PACKAGE_NAME}@${revision}`, entry.package_lock_sha256],
-      [`source: bradygaster/squad/${entry.source}@${revision}`, entry.lock_sha256],
-    ]);
-    if (sourceLines.length !== 1 || !sourceBindings.has(sourceBinding)
-      || !frontmatter.endsWith(`\n${sourceBinding}`)) {
-      throw new Error(`Installed source binding is invalid for ${entry.destination}.`);
-    }
-    const canonicalText = text.replace(`\n${sourceBinding}\n---\n`, '\n---\n');
-    const canonical = Buffer.from(canonicalText);
-    const canonicalWithFinalNewline = Buffer.from(`${canonicalText}\n`);
-    if (![sha256(canonical), sha256(canonicalWithFinalNewline)].includes(entry.source_sha256)) {
-      throw new Error(`Installed digest mismatch for ${entry.destination}.`);
-    }
+    const verified = verifyWorkflowSourceBinding(root, entry, revision);
     // Select from the verified source, never accept whichever lock digest happens to match.
-    lockDigests.set(entry.name, sourceBindings.get(sourceBinding));
+    lockDigests.set(entry.name, verified.lockDigest);
   }
   for (const entry of contract.skills) {
     if (fileDigest(root, entry.destination) !== entry.sha256) {
@@ -941,9 +956,12 @@ export function verifyResource(root, destination) {
   const entry = [...contract.shared_runtime, ...contract.workflows, ...contract.skills]
     .find((candidate) => candidate.destination === destination);
   if (!entry) throw new Error(`Resource is not registered in the trusted Squad contract: ${destination}`);
+  if ('source_sha256' in entry) {
+    const revision = verifyOwnership(root, contract);
+    return verifyWorkflowSourceBinding(root, entry, revision).digest;
+  }
   const actual = fileDigest(root, destination);
-  const expected = entry.source_sha256 ?? entry.sha256;
-  if (actual !== expected) throw new Error(`Squad resource digest mismatch for ${destination}.`);
+  if (actual !== entry.sha256) throw new Error(`Squad resource digest mismatch for ${destination}.`);
   return actual;
 }
 
```

**File**: `workflows/squad-bootstrap.md` (modified, +1/-1)
```diff
@@ -159,7 +159,7 @@ pre-agent-steps:
         node --check "$path" >/dev/null
       }
       # BEGIN GENERATED RESOURCE DIGESTS
-      check_hash "$install_verifier" "cf474be9b04d339f7e7a18c65e776b8a53e84bea5b4b85abfe65ed11f7b782ce"
+      check_hash "$install_verifier" "da3f2ef1fc7efc8676eb654643bd0d0c0e59606538eeb2ebe7cf25792c63d1c1"
       check_hash "$cast_validator" "c6d0b92aac71dc6f6d5727cac418a323b0bc9c12047400faa12d96150d548ada"
       check_hash "$bootstrap_validator" "1af6ab267eaf1148501a949b8b9ac65a1929130b03a1d7f757b156fd2de63fbb"
       # END GENERATED RESOURCE DIGESTS
```

**File**: `workflows/squad-workflows.manifest.json` (modified, +4/-4)
```diff
@@ -68,9 +68,9 @@
       "source": "workflows/package/squad-bootstrap.md",
       "destination": ".github/workflows/squad-bootstrap.md",
       "lock": ".github/workflows/squad-bootstrap.lock.yml",
-      "source_sha256": "a266ed20e76b751e5527b49c9d3517482504a0fd6a6704d04531b57f99dbbaa1",
-      "lock_sha256": "3642cfb42e6b6230354fb245f84bf369d4db29051a6db184c93147504acc221d",
-      "package_lock_sha256": "a2a635dd98427b713c843e7baf22f98a01a0688f450bb2fc993b1fcaa960fb4e"
+      "source_sha256": "e1f45d8e0038550f437602a00fa40c2629ed28f5295afb40179fe68c1fe27e30",
+      "lock_sha256": "a72aa20fc6ce95ca5dbab08d0531c7d670c93bb129d1931b6ff471571eefe386",
+      "package_lock_sha256": "5be4f342fd4593e70ca39825e24469a19895949aece7364686d1d2aaedd0ce8c"
     },
     {
       "name": "squad-command-router",
@@ -97,7 +97,7 @@
       "package_destination": ".github/workflows/shared/squad-install-verifier.mjs",
       "destination": ".github/workflows/shared/squad-install-verifier.mjs",
       "ownership": "manifest",
-      "sha256": "cf474be9b04d339f7e7a18c65e776b8a53e84bea5b4b85abfe65ed11f7b782ce"
+      "sha256": "da3f2ef1fc7efc8676eb654643bd0d0c0e59606538eeb2ebe7cf25792c63d1c1"
     },
     {
       "path": "shared/squad-command-contract.mjs",
```

#### Recent Merged Pull Requests:
- **PR #2173** (2026-10-05): docs: refresh site for v1.0.1 stable release (@IEvangelist)
- **PR #2166** (2026-10-04): chore(release): prepare Squad CLI/SDK 1.0.1 (@bradygaster)
- **PR #2165** (2026-10-03): fix(cli): accept registered persistent names in health routing (@bradygaster)
- **PR #2164** (2026-10-03): fix(release): repair Homebrew/WinGet publish auth for external-repo checkouts (@tamirdresher)
- **PR #2163** (2026-10-03): chore: pin Squad CLI activation to 1.0.0 (@tamirdresher)
- **PR #2161** (2026-10-03): fix(release): repair Homebrew/WinGet publish auth for external-repo checkouts (@tamirdresher)
- **PR #2158** (2026-10-03): fix(gh-aw): preserve bootstrap candidate through resolved validation (@bradygaster)
- **PR #2157** (2026-10-03): docs: link ACA community squad-on-aca and squad-hub projects (@bradygaster)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
