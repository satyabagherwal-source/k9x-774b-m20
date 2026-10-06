# Forensic Learning Record (Deep Inspection): mksglu/context-mode

> **Canonical Artifact**: `07_PROJECT_LEARNING/mksglu-context-mode-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/mksglu/context-mode](https://github.com/mksglu/context-mode))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:13:35.573Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `mksglu/context-mode`
- **Description**: Context window optimization for AI coding agents. Sandboxes tool output (98% reduction), persists session memory, and   enforces routing across 17 platforms via MCP + hooks.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 25486 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `hooks/antigravity-cli/payload.mjs`
```
/**
 * Shared Antigravity CLI (`agy`) hook payload normalization.
 *
 * The only refs-backed field is the working directory: the upstream hook example
 * (refs/platforms/antigravity-cli/examples/title/title.sh:10, README.md:11)
 * reads it from `workspace.current_dir` (an OBJECT field). We read that FIRST.
 *
 * The remaining fields below are empirically-derived/UNVERIFIED — no upstream
 * agy doc or example confirms this shape; they are best-effort assumptions:
 *   { conversationId, stepIdx, toolCall: { name, args }, error,
 *     workspacePaths: [..], transcriptPath, artifactDirectoryPath }
 *
 * The shared context-mode capture/routing code expects Claude-shaped fields, so
 * keep this mapping in one place for PreToolUse/PostToolUse/Stop.
 */

export function parseAgyPayload(raw) {
  try {
    const cleaned = String(raw ?? "").replace(/^\uFEFF/, "").trim();
    return cleaned ? JSON.parse(cleaned) : {};
  } catch {
    return {};
  }
}

export function getAgyProjectDir(payload) {
  // Refs-backed FIRST: workspace.current_dir is the only upstream-documented
  // field (examples/title/title.sh:10). `workspacePaths[0]` is an unverified
  // fallback kept defensively.
  const workspace = payload?.workspace;
  if (workspace && typeof workspace === "object" && typeof workspace.current_dir === "string" && workspace.current_dir) {
    return workspace.current_dir;
  }
  return Array.isArray(payload?.workspacePaths) && payload.workspacePaths.length > 0
    ? String(payload.workspacePaths[0])
    : undefined;
}

// agy native tool-name -> canonical map. Keep in sync with the two other copies:
// hooks/core/routing.mjs (TOOL_ALIASES) and src/session/extract.ts
// (TOOL_NAME_NORMALIZE). Three layers normalize independently; adding a new agy
// tool means updating all three (a single shared table is a follow-up cleanup).
function normalizeAgyToolName(name) {
  switch (name) {
    case "run_command":
      return "Bash";
    case "view_file":
      return "Read";
    case "grep_search":
      return "Grep";
    case "list_dir":
      return "LS";
    case "web_fetch":
    case "read_url_content":
      return "WebFetch";
    case "search_web":
      return "WebSearch";
    default:
      return name;
  }
}

function normalizeAgyToolInput(toolName, args) {
  const input = args && typeof args === "object" ? { ...args } : {};
  const canonical = normalizeAgyToolName(toolName);
  if (canonical === "Bash" && typeof input.CommandLine === "string" && typeof input.command !== "string") {
    input.command = input.CommandLine;
  }
  if (canonical === "WebFetch") {
    const url = input.url ?? input.URL ?? input.Url;
    if (typeof url === "string" && typeof input.url !== "string") input.url = url;
  }
  if (canonical === "Read") {
    const filePath = input.file_path ?? input.path ?? input.AbsolutePath ?? input.FilePath;
    if (typeof filePath === "string" && typeof input.file_path !== "string") input.file_path = filePath;
  }
  if (canonical === "Grep") {
    const pattern = input.pattern ?? input.Pattern ?? input.query ?? input.Query;
    if (typeof pattern === "string" && typeof input.pattern !== "string") input.pattern = pattern;
  }
  return input;
}

export function fromAgy(payload) {
  const toolCall = payload?.toolCall ?? {};
  const rawToolName = toolCall?.name ?? "";
  return {
    session_id: payload?.conversationId,
    transcript_path: payload?.transcriptPath,
    cwd: getAgyProjectDir(payload),
    tool_name: normalizeAgyToolName(rawToolName),
    tool_input: normalizeAgyToolInput(rawToolName, toolCall?.args),
    tool_response: typeof payload?.error === "string" ? payload.error : "",
    tool_output: {
      isError: typeof payload?.error === "string" && payload.error.length > 0,
    },
  };
}

```

### Core Architecture Module: `hooks/antigravity-cli/posttooluse.mjs`
```
#!/usr/bin/env node
import "../suppress-stderr.mjs";
import "../ensure-deps.mjs";
/**
 * Antigravity CLI (`agy`) PostToolUse hook — session event capture.
 *
 * agy fires hooks from a config at ~/.gemini/config/hooks.json (or via an
 * installed agy plugin's hooks/hooks.json) and pipes a payload whose shape
 * differs from the Claude-Code/Codex wire format this pipeline expects:
 *
 *   { conversationId, stepIdx, toolCall: { name, args }, error,
 *     workspacePaths: [..], transcriptPath, artifactDirectoryPath }
 *
 * The event name arrives as argv (set in hooks.json), NOT in the payload, and
 * the hook CWD is ~/.gemini/config — so the project dir MUST come from
 * workspacePaths[0], never process.cwd(). We translate agy's payload into the
 * Claude-shaped `input` the shared extractor/attribution pipeline consumes,
 * then reuse it unchanged. This hook is capture-only and emits no stdout.
 */

import {
  readStdin,
  getSessionId,
  getSessionDBPath,
  getInputProjectDir,
  ANTIGRAVITY_CLI_OPTS,
} from "../session-helpers.mjs";
import { createSessionLoaders, attributeAndInsertEvents } from "../session-loaders.mjs";
import { readFileSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { fromAgy, parseAgyPayload } from "./payload.mjs";

const HOOK_DIR = dirname(fileURLToPath(import.meta.url));
const { loadSessionDB, loadExtract, loadProjectAttribution } = createSessionLoaders(HOOK_DIR);
const OPTS = ANTIGRAVITY_CLI_OPTS;

try {
  const input = fromAgy(parseAgyPayload(await readStdin()));

  if (input.tool_name) {
    const projectDir = getInputProjectDir(input, OPTS);

    const { extractEvents } = await loadExtract();
    const { resolveProjectAttributions } = await loadProjectAttribution();
    const { SessionDB } = await loadSessionDB();

    const dbPath = getSessionDBPath(OPTS, projectDir);
    const db = new SessionDB({ dbPath });
    const sessionId = getSessionId(input, OPTS);

    db.ensureSession(sessionId, projectDir);

    const normalizedInput = {
      tool_name: input.tool_name,
      tool_input: input.tool_input ?? {},
      tool_response: input.tool_response ?? "",
      tool_output: input.tool_output,
    };

    const events = extractEvents(normalizedInput);
    attributeAndInsertEvents(db, sessionId, events, input, projectDir, "PostToolUse", resolveProjectAttributions);

    try {
      const rejectedPath = resolve(tmpdir(), `context-mode-rejected-${sessionId}.txt`);
      let rejectedData;
      try {
        rejectedData = readFileSync(rejectedPath, "utf-8").trim();
        unlinkSync(rejectedPath);
      } catch { /* no marker */ }
      if (rejectedData) {
        const colonIdx = rejectedData.indexOf(":");
        const rejTool = colonIdx > 0 ? rejectedData.slice(0, colonIdx) : rejectedData;
        const rejReason = colonIdx > 0 ? rejectedData.slice(colonIdx + 1) : "denied";
        attributeAndInsertEvents(
          db,
          sessionId,
          [{
            type: "rejected",
            category: "rejected-approach",
            data: `${rejTool}: ${rejReason}`,
            priority: 2,
          }],
          input,
          projectDir,
          "PreToolUse",
          resolveProjectAttributions,
        );
      }
    } catch { /* best-effort */ }

    try {
      const redirectPath = resolve(tmpdir(), `context-mode-redirect-${sessionId}.txt`);
      let redirectData;
      try {
        redirectData = readFileSync(redirectPath, "utf-8").trim();
        unlinkSync(redirectPath);
      } catch { /* no marker */ }

      if (redirectData) {
        const i1 = redirectData.indexOf(":");
        const i2 = i1 >= 0 ? redirectData.indexOf(":", i1 + 1) : -1;
        const i3 = i2 >= 0 ? redirectData.indexOf(":", i2 + 1) : -1;
        if (i1 > 0 && i2 > i1 && i3 > i2) {
          const tool = redirectData.slice(0, i1);
          const type = redirectData.slice(i1 + 1, i2);
          const bytesRaw = redirectData.slice(i2 + 1, i3);
          const summary = redirectData.slice(i3 + 1);
          const bytesAvoided = Number.parseInt(bytesRaw, 10);
          if (Number.isFinite(bytesAvoided) && bytesAvoided > 0) {
            attributeAndInsertEvents(
              db,
              sessionId,
              [{
                type,
                category: "redirect",
                data: `${tool}: ${summary}`,
                priority: 2,
                bytes_avoided: bytesAvoided,
              }],
              input,
              projectDir,
              "PreToolUse",
              resolveProjectAttributions,
            );
          }
        }
      }
    } catch { /* best-effort */ }

    db.close();
  }
} catch {
  // Swallow errors — a hook must never fail the host agent.
}

// Capture-only hook: emit nothing.

```

### Core Architecture Module: `hooks/antigravity-cli/pretooluse.mjs`
```
#!/usr/bin/env node
import "../suppress-stderr.mjs";
/**
 * Antigravity CLI (`agy`) PreToolUse hook — bounded routing enforcement.
 *
 * agy honors top-level `{ decision: "deny" | "ask", reason }` responses for
 * PreToolUse. It does not honor additionalContext, so mapped context guidance is
 * emitted as a deny-and-retry instruction. We register only tools with existing
 * core routing branches (Bash/Read/Grep/WebFetch), not LS/search_web.
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { readStdin } from "../core/stdin.mjs";
import { routePreToolUse, initSecurity } from "../core/routing.mjs";
import { formatDecision } from "../core/formatters.mjs";
import { fromAgy, getAgyProjectDir, parseAgyPayload } from "./payload.mjs";
import { getSessionId, ANTIGRAVITY_CLI_OPTS } from "../session-helpers.mjs";

const __hookDir = dirname(fileURLToPath(import.meta.url));

try {
  await initSecurity(resolve(__hookDir, "..", "..", "build"));

  const payload = parseAgyPayload(await readStdin());
  const input = fromAgy(payload);

  const decision = routePreToolUse(
    String(input.tool_name ?? ""),
    input.tool_input ?? {},
    getAgyProjectDir(payload),
    "antigravity-cli",
    input.session_id,
  );
  const response = formatDecision("antigravity-cli", decision);

  if (decision && input.tool_name) {
    // Key markers on the SAME id posttooluse.mjs reads. getSessionId prefers the
    // transcript UUID over conversationId, so deriving it any other way here
    // (e.g. input.session_id) would miss the handoff whenever agy's transcript
    // is <uuid>.jsonl and silently drop the rejected/redirect analytics.
    const sessionId = getSessionId(input, ANTIGRAVITY_CLI_OPTS);
    const formattedDeny = response && typeof response === "object" && response.decision === "deny";
    if (formattedDeny || decision.action === "deny" || decision.action === "modify") {
      try {
        const reason = formattedDeny
          ? (response.reason || "denied")
          : decision.action === "deny"
            ? (decision.reason || "denied")
            : "Redirected to context-mode sandbox";
        writeFileSync(
          resolve(tmpdir(), `context-mode-rejected-${sessionId}.txt`),
          `${input.tool_name}:${reason}`,
          "utf-8",
        );
      } catch { /* best-effort */ }
    }
    if (decision.redirectMeta) {
      try {
        const meta = decision.redirectMeta;
        const summary = String(meta.commandSummary ?? "").slice(0, 200);
        writeFileSync(
          resolve(tmpdir(), `context-mode-redirect-${sessionId}.txt`),
          `${meta.tool}:${meta.type}:${meta.bytesAvoided}:${summary}`,
          "utf-8",
        );
      } catch { /* best-effort */ }
    }
  }

  if (response !== null) {
    process.stdout.write(JSON.stringify(response) + "\n");
  }
} catch {
  // Fail OPEN. Empty stdout + exit 0 lets agy continue the tool call.
}

```

### Core Architecture Module: `hooks/antigravity-cli/stop.mjs`
```
#!/usr/bin/env node
import "../suppress-stderr.mjs";
import "../ensure-deps.mjs";
/**
 * Antigravity CLI (`agy`) Stop hook — session-end capture.
 *
 * agy's verified hook list exposes `Stop` ("when agent tries to exit") and no
 * separate SessionEnd hook, so this records a single session_end marker when
 * agy emits it. `agy -p` probes have not emitted Stop, so registration is
 * best-effort. The hook is capture-only and emits no stdout.
 */

import {
  readStdin,
  getSessionId,
  getSessionDBPath,
  getInputProjectDir,
  ANTIGRAVITY_CLI_OPTS,
} from "../session-helpers.mjs";
import { createSessionLoaders } from "../session-loaders.mjs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { fromAgy, parseAgyPayload } from "./payload.mjs";

const HOOK_DIR = dirname(fileURLToPath(import.meta.url));
const { loadSessionDB } = createSessionLoaders(HOOK_DIR);
const OPTS = ANTIGRAVITY_CLI_OPTS;

try {
  const payload = parseAgyPayload(await readStdin());
  const input = fromAgy(payload);
  const projectDir = getInputProjectDir(input, OPTS);

  const { SessionDB } = await loadSessionDB();
  const dbPath = getSessionDBPath(OPTS, projectDir);
  const db = new SessionDB({ dbPath });
  const sessionId = getSessionId(input, OPTS);

  db.ensureSession(sessionId, projectDir);
  db.insertEvent(
    sessionId,
    {
      type: "session_end",
      category: "session",
      priority: 1,
      data: JSON.stringify({
        status: payload?.status ?? "stopped",
        stepIdx: payload?.stepIdx ?? null,
        transcriptPath: payload?.transcriptPath ?? null,
      }),
    },
    "Stop",
  );

  db.close();
} catch {
  // A hook must never fail the host agent.
}

```

### Core Architecture Module: `hooks/auto-injection.mjs`
```
/**
 * Auto-injection for compaction events.
 *
 * Builds a prioritized, budget-capped injection block from session events.
 * Only fires on source === "compact" (wired in sessionstart.mjs).
 *
 * Priority order:
 *   P1: Role (behavioral_directive) — always first, never truncated
 *   P2: Decisions (rules) — latest 5, overflow reduces to 3
 *   P3: Skills (active_skills) — unique names, latest 10
 *   P4: Intent (session_mode) — latest
 *
 * Hard cap: 500 tokens (~2000 chars at 4 chars/token).
 */

/**
 * Rough token estimate: ~4 chars per token.
 * @param {string} text
 * @returns {number}
 */
export function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

/**
 * Build auto-injection block from session events.
 * @param {Array<{category: string, data: string}>} events
 * @returns {string} XML block or empty string
 */
export function buildAutoInjection(events) {
  // Single O(N) pass instead of 4× O(N) Array.filter() loops. UserPromptSubmit
  // fires this on every prompt; with N up to 100 events the prior implementation
  // walked the array 4 times per prompt — wasteful on macOS, painful on Windows
  // where V8 cold paths cost more.
  let role;
  const decisionsAll = [];
  const skillsSeen = new Set();
  const skillsOrdered = [];
  let intent;
  for (const e of events) {
    switch (e.category) {
      case "role":
        role = e;
        break;
      case "decision":
        decisionsAll.push(e);
        break;
      case "skill":
        if (!skillsSeen.has(e.data)) {
          skillsSeen.add(e.data);
          skillsOrdered.push(e.data);
        }
        break;
      case "intent":
        intent = e;
        break;
    }
  }

  const parts = [];
  let budget = 500; // hard cap in tokens

  // P1: Role (always first, never truncated from output)
  if (role) {
    const text = `<behavioral_directive>\n${role.data.slice(0, 400)}\n</behavioral_directive>`;
    parts.push(text);
    budget -= estimateTokens(text);
  }

  // P2: Decisions (latest 5)
  const decisions = decisionsAll.slice(-5);
  if (decisions.length > 0) {
    const lines = decisions.map(d => `- ${d.data.slice(0, 100)}`).join("\n");
    const text = `<rules>\nFollow these decisions:\n${lines}\n</rules>`;
    const cost = estimateTokens(text);
    if (cost <= budget) {
      parts.push(text);
      budget -= cost;
    } else {
      // Overflow: reduce to 3 decisions
      const reduced = decisions.slice(-3).map(d => `- ${d.data.slice(0, 100)}`).join("\n");
      const fallback = `<rules>\nFollow these decisions:\n${reduced}\n</rules>`;
      parts.push(fallback);
      budget -= estimateTokens(fallback);
    }
  }

  // P3: Skills (unique names, latest 10)
  if (skillsOrdered.length > 0 && budget > 50) {
    const text = `<active_skills>\nRe-invoke if relevant: ${skillsOrdered.slice(-10).join(", ")}\nTo reload: call the Skill tool with the skill name.\n</active_skills>`;
    parts.push(text);
    budget -= estimateTokens(text);
  }

  // P4: Intent (latest)
  if (intent && budget > 20) {
    parts.push(`<session_mode>${intent.data}</session_mode>`);
  }

  if (parts.length === 0) return "";
  return `<session_state source="compaction">\n\n${parts.join("\n\n")}\n\n</session_state>`;
}

```

### Core Architecture Module: `hooks/cache-heal-utils.mjs`
```
// cache-heal-utils.mjs — fixes Brew-node-upgrade stale path bug
//
// Problem: start.mjs writes process.execPath into ~/.claude/settings.json
// when registering the cache-heal hook. On Brew, process.execPath returns
// the *versioned* Cellar snapshot:
//
//   /opt/homebrew/Cellar/node/25.9.0_2/bin/node
//
// When Brew upgrades Node, that path disappears and Claude fails to spawn
// the hook ("session start" error). The stable symlink is:
//
//   /opt/homebrew/bin/node
//
// Fix is two layered:
//   A) New installs on Unix: write hook script with `#!/usr/bin/env node`
//      shebang + chmod +x, register hook command as the bare script path.
//      `env` resolves node from PATH at runtime — survives any Node upgrade.
//      Windows keeps the explicit-execPath form (no shebang support).
//   B) Self-heal: every MCP boot, scan ~/.claude/settings.json for an
//      existing cache-heal hook command whose leading node path no longer
//      exists. If stale, rewrite using pattern (A).
//
// This module is pure (no global state) and side-effect free except for
// the explicit selfHealCacheHealHook() entry point that touches disk.

import {
  existsSync,
  readFileSync,
  writeFileSync,
  chmodSync,
  statSync,
  readdirSync,
  renameSync,
  unlinkSync,
} from "node:fs";
import { join } from "node:path";

/**
 * Convert any path string to forward slashes (matches normalize-hooks style,
 * keeps round-trips on Windows safe).
 */
function fwd(p) {
  return String(p).replace(/\\/g, "/");
}

/**
 * Extract the leading executable path from a hook command string IF it
 * looks like a node binary. Returns null when the command is shebang-style
 * (bare script path) or when the leading executable isn't node.
 *
 * Accepted shapes:
 *   '"/abs/path/to/node" "/abs/path/script.mjs"'
 *   '/abs/path/to/node "/abs/path/script.mjs"' (unquoted node)
 *
 * Returns null for:
 *   '"/abs/path/script.mjs"'                    (shebang form)
 *   '"/usr/bin/python3" "/abs/path/script.py"'  (not node)
 */
export function extractNodePath(cmd) {
  if (!cmd || typeof cmd !== "string") return null;
  const trimmed = cmd.trim();
  if (!trimmed) return null;

  // Match: optional quote, capture path until matching quote or whitespace.
  let leading;
  if (trimmed.startsWith('"')) {
    const end = trimmed.indexOf('"', 1);
    if (end === -1) return null;
    leading = trimmed.slice(1, end);
  } else {
    const end = trimmed.search(/\s/);
    leading = end === -1 ? trimmed : trimmed.slice(0, end);
  }

  if (!leading) return null;

  // Only treat as a node path if the basename is a node binary.
  // Match: "node", "node.exe" (case-insensitive on Windows-style names).
  const base = leading.split(/[\\/]/).pop() ?? "";
  if (!/^node(\.exe)?$/i.test(base)) return null;

  return leading;
}

/**
 * True when the hook command's leading node path no longer exists on disk.
 * Returns false for shebang-style commands (no node prefix to validate).
 */
export function isStaleNodePath(cmd) {
  const nodePath = extractNodePath(cmd);
  if (!nodePath) return false;
  try {
    return !existsSync(nodePath);
  } catch {
    return false;
  }
}

/**
 * Build a cross-platform hook command for the cache-heal script.
 *
 * On Unix (anything except win32):
 *   - Returns just the script path (double-quoted), e.g. '"/path/to/script.mjs"'
 *   - Caller MUST ensure the script has `#!/usr/bin/env node` shebang and
 *     chmod 0o755.
 *   - `env` resolves node from PATH at runtime → survives Brew/asdf/nvm
 *     upgrades.
 *
 * On Windows:
 *   - Returns '"<nodePath>" "<scriptPath>"' (forward slashes, both quoted).
 *   - Windows has no shebang support; we must invoke node explicitly.
 */
export function buildHookCommand({ scriptPath, platform, nodePath }) {
  if (!scriptPath || typeof scriptPath !== "string") {
    throw new TypeError("buildHookCommand: scriptPath is required");
  }
  const safeScript = fwd(scriptPath);
  if (platform === "win32") {
    if (!nodePath || typeof nodePath !== "string") {
      throw new TypeError(
        "buildHookCommand: nodePath is required on win32",
      );
    }
    const safeNode = fwd(nodePath);
    return `"${safeNode}" "${safeScript}"`;
  }
  return `"${safeScript}"`;
}

/**
 * Self-heal step for ~/.claude/settings.json.
 *
 * - Looks at SessionStart hooks for any registered cache-heal hook.
 * - If its command has a stale node path (Brew upgrade scenario),
 *   rewrites the command using buildHookCommand() — Unix gets shebang
 *   form, Windows gets explicit nodePath form.
 * - No-op when:
 *     * settings.json doesn't exist
 *     * no cache-heal hook is registered
 *     * the hook command is already valid (path exists or shebang form)
 * - On Unix, also re-asserts the script's shebang + chmod +x so a healed
 *   command actually works.
 *
 * Returns: one of "noop" | "healed" | "missing-settings" — useful for
 * tests and telemetry.
 *
 * Best-effort — all I/O is wrapped; never throws.
 */
export function selfHealCacheHealHook({
  settingsPath,
  scriptPath,
  platform,
  nodePath,
}) {
  if (!settingsPath || !existsSync(settingsPath)) return "missing-settings";

  let raw;
  try {
    raw = readFileSync(settingsPath, "utf-8");
  } catch {
    return "noop";
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return "noop";
  }

  const hooks = parsed?.hooks;
  if (!hooks || typeof hooks !== "object") return "noop";
  const sessionStart = Array.isArray(hooks.SessionStart)
    ? hooks.SessionStart
    : null;
  if (!sessionStart) return "noop";

  let healed = false;
  for (const matcher of sessionStart) {
    const inner = matcher?.hooks;
    if (!Array.isArray(inner)) continue;
    for (const h of inner) {
      if (typeof h?.command !== "string") continue;
      if (!h.command.includes("context-mode-cache-heal")) continue;
      if (!isStaleNodePath(h.command)) continue;

      // Stale → rewrite.
      h.command = buildHookCommand({ scriptPath, platform, nodePath });
      healed = true;
    }
  }

  if (!healed) return "noop";

  // Unix: re-assert shebang + chmod so the bare-script command works.
  if (platform !== "win32" && scriptPath && existsSync(scriptPath)) {
    try {
      ensureShebangAndExecBit(scriptPath);
    } catch {
      /* best effort */
    }
  }

  try {
    writeFileSync(
      settingsPath,
      JSON.stringify(parsed, null, 2) + "\n",
      "utf-8",
    );
  } catch {
    return "noop";
  }
  return "healed";
}

/**
 * Issue #710 — heal Claude Code's per-session shell snapshots.
 *
 * Claude Code writes a per-session snapshot at boot:
 *   ~/.claude/shell-snapshots/snapshot-<shell>-<ts>-<rand>.sh
 * Every Bash tool call `source`s that snapshot to reproduce the user env
 * (refs/platforms/claude-code/src/utils/bash/ShellSnapshot.ts:269-336;
 * sourced before every Bash tool call at bashProvider.ts:166). The snapshot
 * bakes an `export PATH='…'` line containing the active context-mode
 * `bin/` for the then-current cache version, e.g.
 *   …/.claude/plugins/cache/context-mode/context-mode/1.0.146/bin
 *
 * /ctx-upgrade installs the new version and deletes the old cache dir
 * mid-session, but it never touches the snapshot — so every subsequent
 * Bash tool call fails with "Plugin directory does not exist: …/1.0.146"
 * until the session restarts.
 *
 * This helper rewrites the version segment of every context-mode PATH
 * entry in every snapshot under `snapshotsDir` to `currentVersion`.
 * Anchored on the doubled `context-mode/context-mode/` segment so sibling
 * plugins (`pm-skills/pm-toolkit`, `claude-adhd/claude-adhd`, …) and
 * shape-spoofing entries (`evil-owner/context-mode/1.0.146`) are
 * untouched.
 *
 * Layered like cache-heal-utils' brew-node fix:
 *   Layer 1 — /ctx-upgrade calls this after install (cli.ts) so the
 *             session that just upgraded sees the new bin on the next
 *             Bash call.
 *   Layer 2 — SessionStart hook calls this on every boot so a session
 *             that started before /ctx-upgrade ran still self-heals.
 *
 * Write contract:
 *   - Atomic: write to `<file>.tmp-<pid>-<ts>` then rename. Snapshots
 *     are `source`d concurrently; a half-written file would crash the
 *     bash subprocess mid-call.
 *   - Idempotent: a snapshot already on `currentVersion` is not
 *     re-written (mtime preserved). A snapshot with no context-mode
 *     entry is not re-written.
 *   - Best-effort: every I/O is wrapped; never throws. Telemetry shape
 *     is `{ rewritten: string[] }` for caller logging.
 *   - Cross-platform: handles both unix (`/Users/x/.claude/…`),
 *     Cygwin/Git Bash (`/c/Users/x/.claude/…`), and Windows native
 *     (`C:\Users\x\.claude\…`) path variants. ShellSnapshot.ts
 *     writes paths using whatever shell wrote them, so all three
 *     shapes can appear depending on the user's shell environment.
 */
export function rewriteShellSnapshots({ snapshotsDir, currentVersion }) {
  const out = { rewritten: [] };
  if (
    !snapshotsDir ||
    typeof snapshotsDir !== "string" ||
    !currentVersion ||
    typeof currentVersion !== "string"
  ) {
    return out;
  }
  let entries;
  try {
    if (!existsSync(snapshotsDir)) return out;
    entries = readdirSync(snapshotsDir);
  } catch {
    return out;
  }

  // Match the version segment of any PATH entry of the form
  //   …/plugins/cache/context-mode/context-mode/<VERSION>/bin
  // across all three path shapes (`/`, `\`, mixed). The doubled
  // `context-mode/context-mode/` is the trust anchor — it prevents
  // shape-spoofing from another owner.
  //
  // Captures:
  //   $1 — separator-tolerant prefix up to and including the second
  //        `context-mode` segment + its trailing separator
  //   $2 — version segment (no separators)
  //   $3 — trailing separator + `bin`
  const versionSegmentRe =
    /(context-mode[/\\]context-mode[/\\])([^/\\]+)([/\\]bin)/g;

  for (const name of entries) {
    if (!name.endsWith(".sh")) continue;
    const file = join
```

### Core Architecture Module: `hooks/codex/platform.mjs`
```
process.env.CONTEXT_MODE_PLATFORM = "codex";

```

### Core Architecture Module: `hooks/codex/posttooluse.mjs`
```
#!/usr/bin/env node
import "./platform.mjs";
import "../suppress-stderr.mjs";
import "../ensure-deps.mjs";
/**
 * Codex CLI postToolUse hook — session event capture.
 */

import { readStdin, parseStdin, getSessionId, getSessionDBPath, getInputProjectDir, CODEX_OPTS } from "../session-helpers.mjs";
import { createSessionLoaders, attributeAndInsertEvents } from "../session-loaders.mjs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HOOK_DIR = dirname(fileURLToPath(import.meta.url));
const { loadSessionDB, loadExtract, loadProjectAttribution } = createSessionLoaders(HOOK_DIR);
const OPTS = CODEX_OPTS;

function normalizeToolName(toolName) {
  // Keep Codex-native tool names like apply_patch intact; only normalize
  // legacy shell aliases that should route through the Bash extractors.
  if (toolName === "Shell") return "Bash";
  return toolName;
}

try {
  const raw = await readStdin();
  const input = parseStdin(raw);
  const projectDir = getInputProjectDir(input, OPTS);

  const { extractEvents } = await loadExtract();
  const { resolveProjectAttributions } = await loadProjectAttribution();
  const { SessionDB } = await loadSessionDB();

  const dbPath = getSessionDBPath(OPTS, projectDir);
  const db = new SessionDB({ dbPath });
  const sessionId = getSessionId(input, OPTS);

  db.ensureSession(sessionId, projectDir);

  const normalizedInput = {
    tool_name: normalizeToolName(input.tool_name ?? ""),
    tool_input: input.tool_input ?? {},
    tool_response: typeof input.tool_response === "string"
      ? input.tool_response
      : JSON.stringify(input.tool_response ?? ""),
    tool_output: input.tool_output
      ? {
        ...input.tool_output,
        isError: input.tool_output.isError === true || input.tool_output.is_error === true,
      }
      : undefined,
  };

  const events = extractEvents(normalizedInput);

  attributeAndInsertEvents(db, sessionId, events, input, projectDir, "PostToolUse", resolveProjectAttributions);

  db.close();
} catch {
  // Swallow errors — hook must not fail
}

// Codex PostToolUse requires hookEventName in hookSpecificOutput
process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: "" },
}) + "\n");

```

### Core Architecture Module: `hooks/codex/precompact.mjs`
```
#!/usr/bin/env node
import "./platform.mjs";
import "../suppress-stderr.mjs";
import "../ensure-deps.mjs";
/**
 * Codex CLI PreCompact hook - snapshot generation.
 */

import {
  readStdin,
  parseStdin,
  getSessionId,
  getSessionDBPath,
  getInputProjectDir,
  resolveConfigDir,
  CODEX_OPTS,
} from "../session-helpers.mjs";
import { createSessionLoaders } from "../session-loaders.mjs";
import { appendFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HOOK_DIR = dirname(fileURLToPath(import.meta.url));
const { loadSessionDB, loadSnapshot } = createSessionLoaders(HOOK_DIR);
const OPTS = CODEX_OPTS;
const DEBUG_LOG = join(resolveConfigDir(OPTS), "context-mode", "precompact-debug.log");

try {
  const raw = await readStdin();
  const input = parseStdin(raw);
  const projectDir = getInputProjectDir(input, OPTS);

  const { buildResumeSnapshot } = await loadSnapshot();
  const { SessionDB } = await loadSessionDB();

  const dbPath = getSessionDBPath(OPTS, projectDir);
  const db = new SessionDB({ dbPath });
  const sessionId = getSessionId(input, OPTS);

  const events = db.getEvents(sessionId);

  if (events.length > 0) {
    const stats = db.getSessionStats(sessionId);
    const snapshot = buildResumeSnapshot(events, {
      compactCount: (stats?.compact_count ?? 0) + 1,
    });

    db.upsertResume(sessionId, snapshot, events.length);
    db.incrementCompactCount(sessionId);

    const fileEvents = events.filter((event) => event.category === "file");
    db.insertEvent(sessionId, {
      type: "compaction_summary",
      category: "compaction",
      data: `Session compacted. ${events.length} events, ${fileEvents.length} files touched.`,
      priority: 1,
    }, "PreCompact");
  }

  db.close();
} catch (err) {
  try {
    appendFileSync(DEBUG_LOG, `[${new Date().toISOString()}] ${err?.message || err}\n`);
  } catch {
    // Hook errors must not break Codex compaction.
  }
}

// Codex PreCompact accepts universal hook fields only; no hookSpecificOutput.
process.stdout.write(JSON.stringify({}) + "\n");

```

### Core Architecture Module: `hooks/codex/pretooluse.mjs`
```
#!/usr/bin/env node
import "./platform.mjs";
import "../suppress-stderr.mjs";
/**
 * Codex CLI preToolUse hook for context-mode.
 *
 * Codex PreToolUse honors `permissionDecision:"deny"` on all builds, and
 * `permissionDecision:"allow" + updatedInput` / `additionalContext` on
 * codex-cli >= 0.141.0 (#845). Capability is detected at runtime by
 * codex-caps.mjs; older builds fail closed (redirect → deny). `ask` is still
 * unsupported. Source: codex-rs/hooks/src/engine/output_parser.rs
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readStdin, parseStdin, getInputProjectDir, getSessionId, CODEX_OPTS } from "../session-helpers.mjs";
import { routePreToolUse, initSecurity } from "../core/routing.mjs";
import { formatDecision } from "../core/formatters.mjs";
import { codexSupportsUpdatedInput } from "../core/codex-caps.mjs";

const __hookDir = dirname(fileURLToPath(import.meta.url));
await initSecurity(resolve(__hookDir, "..", "..", "build"));

const raw = await readStdin();
const input = parseStdin(raw);
const tool = input.tool_name ?? "";
const toolInput = input.tool_input ?? {};
const projectDir = getInputProjectDir(input, CODEX_OPTS);

const decision = routePreToolUse(tool, toolInput, projectDir, "codex", getSessionId(input, CODEX_OPTS));
// #845: only modify/context depend on Codex's rewrite capability. Detection is
// cached, but skip the probe entirely for deny / ask / passthrough decisions.
const needsCaps = decision && (decision.action === "modify" || decision.action === "context");
const response = formatDecision(
  "codex",
  decision,
  needsCaps ? { codexSupportsRewrite: codexSupportsUpdatedInput() } : {},
);
const output = response ?? {
  hookSpecificOutput: { hookEventName: "PreToolUse" },
};
process.stdout.write(JSON.stringify(output) + "\n");

```

### Core Architecture Module: `hooks/codex/sessionstart.mjs`
```
#!/usr/bin/env node
import "./platform.mjs";
import "../suppress-stderr.mjs";
import "../ensure-deps.mjs";
/**
 * Codex CLI sessionStart hook for context-mode.
 */

import { createRoutingBlock } from "../routing-block.mjs";
import { createToolNamer } from "../core/tool-naming.mjs";

const toolNamer = createToolNamer("codex");
const ROUTING_BLOCK = createRoutingBlock(toolNamer);
import {
  writeSessionEventsFile,
  buildSessionDirective,
  getSessionEvents,
} from "../session-directive.mjs";
import {
  readStdin,
  parseStdin,
  getSessionId,
  getSessionDBPath,
  getSessionEventsPath,
  getCleanupFlagPath,
  getInputProjectDir,
  resolveConfigDir,
  CODEX_OPTS,
} from "../session-helpers.mjs";
import { createSessionLoaders } from "../session-loaders.mjs";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const HOOK_DIR = fileURLToPath(new URL(".", import.meta.url));
const { loadSessionDB } = createSessionLoaders(HOOK_DIR);
const OPTS = CODEX_OPTS;

let additionalContext = ROUTING_BLOCK;

function captureCodexInstructionRules(db, sessionId, projectDir) {
  const paths = [];
  for (const baseDir of [resolveConfigDir(OPTS), projectDir]) {
    paths.push(join(baseDir, "AGENTS.md"));
    paths.push(join(baseDir, "AGENTS.override.md"));
  }

  for (const p of [...new Set(paths)]) {
    try {
      if (!existsSync(p)) continue;
      const content = readFileSync(p, "utf8");
      db.insertEvent(sessionId, { type: "rule", category: "rule", data: p, priority: 1 });
      db.insertEvent(sessionId, { type: "rule_content", category: "rule", data: content, priority: 1 });
    } catch {
      // Missing or unreadable rule files should never break SessionStart.
    }
  }
}

try {
  const raw = await readStdin();
  const input = parseStdin(raw);
  const source = input.source ?? "startup";
  const projectDir = getInputProjectDir(input, CODEX_OPTS);

  if (source === "compact" || source === "resume") {
    const { SessionDB } = await loadSessionDB();
    const dbPath = getSessionDBPath(OPTS, projectDir);
    const db = new SessionDB({ dbPath });
    const sessionId = getSessionId(input, OPTS);
    let resumeSnapshot = null;

    if (source === "compact") {
      const resume = sessionId ? db.getResume(sessionId) : null;
      if (resume && !resume.consumed) {
        resumeSnapshot = resume.snapshot;
      }
    } else {
      try { unlinkSync(getCleanupFlagPath(OPTS, projectDir)); } catch { /* no flag */ }
    }

    // Filter events to the session being resumed/compacted. Falling back to
    // getLatestSessionEvents(db) for resume leaks events from any other
    // session whose session_meta.started_at is more recent — observed
    // cross-session bleed when a different session started after this one
    // and before the resume.
    const events = sessionId ? getSessionEvents(db, sessionId) : [];
    if (events.length > 0) {
      const eventMeta = writeSessionEventsFile(events, getSessionEventsPath(OPTS, projectDir));
      additionalContext += buildSessionDirective(source, eventMeta, toolNamer);
    }
    if (resumeSnapshot) {
      additionalContext += `\n\n${resumeSnapshot}`;
      db.markResumeConsumed(sessionId);
    }

    db.close();
  } else if (source === "startup") {
    const { SessionDB } = await loadSessionDB();
    const dbPath = getSessionDBPath(OPTS, projectDir);
    const db = new SessionDB({ dbPath });
    try { unlinkSync(getSessionEventsPath(OPTS, projectDir)); } catch { /* no stale file */ }

    db.cleanupOldSessions(7);
    db.db.exec(`DELETE FROM session_events WHERE session_id NOT IN (SELECT session_id FROM session_meta)`);

    const sessionId = getSessionId(input, OPTS);
    db.ensureSession(sessionId, projectDir);
    captureCodexInstructionRules(db, sessionId, projectDir);

    db.close();
  }
  // clear => routing block only
} catch {
  // Swallow errors — hook must not fail
}

// Codex SessionStart requires hookEventName in hookSpecificOutput
process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: "SessionStart", additionalContext },
}) + "\n");

```

### Core Architecture Module: `hooks/codex/stop.mjs`
```
#!/usr/bin/env node
import "./platform.mjs";
import "../suppress-stderr.mjs";
import "../ensure-deps.mjs";
/**
 * Codex CLI Stop hook — record turn-end state for continuity.
 *
 * Stop fires at the end of an assistant turn, not at true session shutdown.
 * Store a turn_end marker so session_end remains reserved for actual terminal
 * lifecycle events on platforms that expose one.
 */

import { readStdin, parseStdin, getSessionId, getSessionDBPath, getInputProjectDir, CODEX_OPTS } from "../session-helpers.mjs";
import { createSessionLoaders, attributeAndInsertEvents } from "../session-loaders.mjs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";

const HOOK_DIR = dirname(fileURLToPath(import.meta.url));
const { loadSessionDB, loadProjectAttribution } = createSessionLoaders(HOOK_DIR);
const OPTS = CODEX_OPTS;

/**
 * Locate the codex rollout JSONL for this session. Codex persists turns at
 * $CODEX_HOME/sessions/YYYY/MM/DD/rollout-<ts>-<session_id>.jsonl (default
 * $CODEX_HOME = ~/.codex). The hook stdin does NOT carry the path, so we walk
 * the sessions tree and match the filename suffix on the session id. Pure
 * directory walk + string suffix test — NO regex. Best-effort: returns null on
 * any failure so cost capture never blocks the turn.
 */
function findCodexRollout(sessionId) {
  try {
    if (typeof sessionId !== "string" || sessionId.length === 0) return null;
    const home = process.env.CODEX_HOME || join(homedir(), ".codex");
    const root = join(home, "sessions");
    if (!existsSync(root)) return null;
    const suffix = `${sessionId}.jsonl`;
    const stack = [root];
    while (stack.length > 0) {
      const dir = stack.pop();
      let entries;
      try { entries = readdirSync(dir, { withFileTypes: true }); } catch { continue; }
      for (const e of entries) {
        const full = join(dir, e.name);
        if (e.isDirectory()) { stack.push(full); continue; }
        if (e.isFile() && e.name.startsWith("rollout-") && e.name.endsWith(suffix)) {
          return full;
        }
      }
    }
  } catch {
    // ignore — best-effort
  }
  return null;
}

/**
 * Load the codex usage extractor (build/adapters/codex/usage.js), mirroring the
 * loadModule build-path fallback in session-loaders. Returns null if the module
 * is absent (e.g. pre-build dev tree) so the hook degrades gracefully.
 */
async function loadCodexUsage() {
  try {
    const pluginRoot = join(HOOK_DIR, "..", "..");
    const candidates = [
      join(pluginRoot, "build", "adapters", "codex", "usage.js"),
    ];
    for (const p of candidates) {
      if (existsSync(p)) return await import(pathToFileURL(p).href);
    }
  } catch {
    // ignore
  }
  return null;
}

try {
  const raw = await readStdin();
  const input = parseStdin(raw);
  const projectDir = getInputProjectDir(input, OPTS);

  const { SessionDB } = await loadSessionDB();
  const dbPath = getSessionDBPath(OPTS, projectDir);
  const db = new SessionDB({ dbPath });
  const sessionId = getSessionId(input, OPTS);

  db.ensureSession(sessionId, projectDir);
  const payload = {
    stop_hook_active: input.stop_hook_active ?? false,
    last_assistant_message: typeof input.last_assistant_message === "string"
      ? input.last_assistant_message.slice(0, 2000)
      : null,
  };
  db.insertEvent(sessionId, {
    type: "turn_end",
    category: "session",
    data: JSON.stringify(payload),
    priority: 1,
  }, "Stop");

  // ─── codex MAIN-turn cost capture (cursor-aware, no double-count) ─────────
  // Codex carries no tokens on the hook payload (model only); per-turn usage is
  // persisted to the session rollout JSONL as `event_msg`/`token_count`
  // records. We tail that file, cursor-gated by rollout LINE INDEX, summing
  // ONLY the completed turns NEW since the last Stop. Each step is best-effort
  // — a hook must never block the session, so any read/extract failure here is
  // swallowed without aborting the turn_end write above.
  try {
    const rolloutPath = findCodexRollout(sessionId);
    if (rolloutPath) {
      let rollout = null;
      try { rollout = readFileSync(rolloutPath, "utf-8"); } catch { /* unreadable — skip */ }
      if (rollout) {
        const usageMod = await loadCodexUsage();
        if (usageMod && typeof usageMod.extractCodexUsageSince === "function") {
          const { resolveProjectAttributions } = await loadProjectAttribution();
          const cursor = db.getUsageCursor(sessionId);
          const { events, cursor: next } = usageMod.extractCodexUsageSince(rollout, cursor);
          if (events.length > 0) {
            // attributeAndInsertEvents both INSERTS locally and FORWARDS to the
            // platform (gated on ~/.context-mode/platform.json).
            attributeAndInsertEvents(db, sessionId, events, input, projectDir, "Stop", resolveProjectAttributions);
          }
          if (next) db.setUsageCursor(sessionId, next);
        }
      }
    }
  } catch {
    // Best-effort cost capture — never block the session on failure.
  }

  db.close();
} catch {
  // Codex hooks must not block the session.
}

process.stdout.write("{}\n");

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1203** (2026-09-28): **Is this project abandoned?**
  *Symptoms*: ### Platform  OpenCode  ### context-mode version  NA  ### Debug script output (REQUIRED)  ```json I do not see any commits since few months (Last release) and only automated commits. ```  ### Exact prompt that triggered the bug (REQUIRED)  ```text opencode v2 support not being there ```  ### Full error output (REQUIRED)  ```text NA ```  ### Steps to reproduce (REQUIRED)  NA  ### What have you tried to fix it?  Pinged the maintainer on a separate thread https://github.com/mksglu/context-mode/issues/1199#issuecomment-5818717370  ### Pre-submission checklist  - [x] I have run the debug script and pasted the output above - [x] I am using the latest version of context-mode - [x] I have searched existing issues for duplicates - [x] I have included steps to reproduce the issue  ### Operating System  Linux (Other)  ### JS Runtime  _No response_
  **Post-Mortem & Fix Analysis**:
  > I noticed a `-next` branch with the commits pushed last month, was mistaken.. closing this.
  > @manorit2001 last commit was more than 1 month ago https://github.com/mksglu/context-mode/commits/next/  author does not reply to issues nor reviewing incoming prs. seems he lost interest in the project (or maybe life circumstances)
  > I can keep it open incase he wants to reply or has a different maintainance strategy with this being not the most priority

- **Issue #868** (2026-06-23): **[Bug]: Very intrusive message do not allow to type**
  *Symptoms*: ### Platform  Pi  ### context-mode version  1.0.165  ### Debug script output (REQUIRED)  ```json none ```  ### Exact prompt that triggered the bug (REQUIRED)  ```text Appears doing nothing ```  ### Full error output (REQUIRED)  ```text No error ```  ### Steps to reproduce (REQUIRED)  Suddendly this message appears in the editor box and do not allow to type  [mcp-bridge] [context-mode] idle MCP bridge child self-shutdown after 180000ms with no activity (#854)  ### What have you tried to fix it?  No  ### Pre-submission checklist  - [x] I have run the debug script and pasted the output above - [x] I am using the latest version of context-mode - [x] I have searched existing issues for duplicates - [x] I have included steps to reproduce the issue  ### Operating System  macOS (Apple Silicon)  ### JS Runtime  _No response_
  **Post-Mortem & Fix Analysis**:
  > Same thing happened on Pi coding agent (Windows 11, WSL 2)
  > Fixed in **v1.0.166**.  Two coupled fixes:  1. **The line no longer reaches your editor.** context-mode runs in-process under Pi, and its MCP bridge was writing diagnostics to `process.stderr` — which is Pi's raw-mode TUI terminal, so the text rendered straight into the prompt box. All Pi-adapter diagnostics now route to `pi.logger` (Pi's rotating log under `~/.omp/logs/`), the documented channel for in-process extensions — never the terminal. (Your keystrokes were actually still being read underneath; it was the *display* that got corrupted — but either way it's gone now.)  2. **The helper no longer shuts down on you.** The underlying event — `idle MCP bridge child self-shutdown` — was the idle reaper releasing the **active** session's helper after 3 minutes of inactivity. That reaper exists to stop *abandoned sub-agent* helpers from piling up, but it shouldn't touch the foreground session. It now keeps the interactive session's helper alive; only sub-agent / non-interactive helpers a

- **Issue #852** (2026-06-22): **[Bug]: Agents immediatly learn and than love to use context_mode:ctx_execute* to escape from harness sandbox and premission controls.**
  *Symptoms*: ### Platform  Claude Code  ### context-mode version  1.0.162  ### Debug script output (REQUIRED)  ```json {   "version": "2.0.0",   "generated": "2026-06-21T17:23:14Z",   "sections": {     "1. System Info": {       "checks": [],       "info": {         "OS type": "linux",         "uname -a": "Linux archlinux 7.0.5-arch1-1-g14 #1 SMP PREEMPT_DYNAMIC Wed, 13 May 2026 18:07:58 +0000 x86_64 GNU/Linux",         "Architecture": "x86_64",         "Distro": "Arch Linux",         "Shell": "/usr/bin/zsh",         "Bash version": "5.3.15(1)-release",         "Locale": "LANG=en_US.UTF-8, LC_ALL=unset"       },       "configs": [],       "warnings": [],       "details": []     },     "2. Runtime Versions": {       "checks": [],       "info": {         "Node.js": "v26.2.0",         "node path": "/usr/bin/node",         "execPath": "/usr/bin/node",         "Node install method": "unknown",         "Bun": "1.3.14",         "bun path": "/usr/bin/bun",         "Python": "Python 3.14.6",         "Ruby": "ruby 3.4.8 (2025-12-17 revision 995b59f666) +PRISM [x86_64-linux]",         "npm": "11.16.0",         "npm global root": "/usr/lib/node_modules"       },       "configs": [],       "warnings": [],       "details": []     },     "3. context-mode Installation": {       "checks": [         {           "pass": false,           "label": "build/ directory exists"         },         {           "pass": true,           "label": "hooks/pretooluse.mjs exists"         },         {           "pass": true, 
  **Post-Mortem & Fix Analysis**:
  > Fixed on `next` (`d1ae5625`, ships in the next release). Thank you for the careful report and repro, @Project579.  **What's fixed — your exact repro is closed.** `ctx_execute_file` now enforces **project-boundary containment**: an absolute or `../`-escaping path outside the project root is refused (symlink-canonical escapes closed too). The opt-in escape hatch is the host's **existing `permissions.allow` `Read(...)` rules** — reused exactly as Claude Code honors them, so there's no bespoke context-mode env to learn. The `ctx_execute`/`ctx_execute_file` tool **titles now announce code execution**, which is the one field the host permission prompt surfaces (we verified against Claude Code source that the prompt already renders all MCP args — the gap was readability, and there is no host 'sandbox-active' signal we could auto-detect).  **Honest scope.** This fully closes the reported file-read vector. The broader concern you raised — `ctx_execute`/`ctx_batch_execute` running **arbitrary co

- **Issue #847** (2026-06-19): **[Bug]: Seems to be suggesting claude related recommendations when installed in pi.dev**
  *Symptoms*: ### Platform  Pi  ### context-mode version  latest  ### Debug script output (REQUIRED)  ```json bash: scripts/ctx-debug.sh: No such file or directory ```  ### Exact prompt that triggered the bug (REQUIRED)  ```text /skill:ctx-insight ```  ### Full error output (REQUIRED)  ```text /skill:ctx-insight ```  ### Steps to reproduce (REQUIRED)  <img width="618" height="309" alt="Image" src="https://github.com/user-attachments/assets/7ff786dd-96ca-4b18-913a-0d9e085a665a" />  ### What have you tried to fix it?  reading docs  ### Pre-submission checklist  - [x] I have run the debug script and pasted the output above - [x] I am using the latest version of context-mode - [x] I have searched existing issues for duplicates - [x] I have included steps to reproduce the issue  ### Operating System  macOS (Apple Silicon)  ### JS Runtime  _No response_

- **Issue #824** (2026-06-21): **[Bug]: pi install hangs indefinitely — context-mode MCP server spawned but never cleaned up**
  *Symptoms*: ### Platform  OpenClaw (Pi Agent)  ### context-mode version  latest as of 2026-06-12  ### Debug script output (REQUIRED)  ```json Active handles: 6   Handle 0: Socket fd=1 (stdout)          ← normal   Handle 1: Socket fd=2 (stderr)          ← normal   Handle 2: Socket fd=26                  ← MCP bridge pipe   Handle 3: Socket fd=28                  ← MCP bridge pipe   Handle 4: Socket fd=30                  ← MCP bridge pipe   Handle 5: ChildProcess pid=126705       ← THE CULPRIT     args=["/usr/bin/node",".../context-mode/server.bundle.mjs"]     closesNeeded=3  === DETECTED: Spawning server.bundle.mjs ===   command: /usr/bin/node   args: /home/chagwood/.pi/agent/npm/node_modules/context-mode/server.bundle.mjs   argv[2]: install   isPiShortCircuitArgv would return: false  pi version: 0.79.2 OS: Linux (x86_64) Node.js: /usr/bin/node ```  ### Exact prompt that triggered the bug (REQUIRED)  ```text pi install npm:pi-subagents ```  ### Full error output (REQUIRED)  ```text The command prints:  Installing npm:pi-subagents... ... Installed npm:pi-subagents   ...and then the terminal hangs indefinitely. Ctrl+C is required to exit.  Root cause: The Pi extension in build/adapters/pi/extension.js has a short-circuit guard (PI_SHORT_CIRCUIT_TOKENS) that skips spawning the MCP server for --help and --version, but install/uninstall/remove/update/list/config are NOT in the short-circuit set.  The MCP bridge spawns server.bundle.mjs as a child process with piped stdio:   this.child = spawn
  **Post-Mortem & Fix Analysis**:
  > I also encountered this; using your fix for now locally worked
  > Fixed on `next` by #813 (5c18c673). Root cause: the MCP-bridge bootstrap ran **eagerly during Pi extension discovery on every `pi` invocation** — including non-agent CLI subcommands (install / list / update) — so the spawned server never had an agent turn to attach to and the command hung. #813 makes the bridge bootstrap **lazy** (only on actual agent turns), so plain CLI subcommands return immediately. Shipping in the next release. Closing as resolved — please reopen if you still hit it after upgrading. Thanks for the detailed report. 🙏

- **Issue #809** (2026-06-11): **[Bug]: Pi: After installing terminal hangs when running any pi command like pi list**
  *Symptoms*: ### Platform  Pi  ### context-mode version  1.0.162  ### Debug script output (REQUIRED)  ```json bash scripts/ctx-debug.sh  Command does not exists ```  ### Exact prompt that triggered the bug (REQUIRED)  ```text pi install npm:context-mode ```  ### Full error output (REQUIRED)  ```text No ouput. Hangs. ```  ### Steps to reproduce (REQUIRED)  1.  npm install -g --ignore-scripts @earendil-works/pi-coding-agent or      bun add -g --ignore-scripts @earendil-works/pi-coding-agent  2. pi install npm:context-mode 3. pi list ( Here hangs. The only way to terminate it is with ctrl-c )  ### What have you tried to fix it?  - Yes, Installed context-mode in a fresh Pi installation and the problem persists  - When hangs is using this files:  ~/.pi/context-mode/sessions/404d1027beb84920.db ~/.pi/context-mode/sessions/404d1027beb84920.db-wal ~/.pi/context-mode/sessions/404d1027beb84920.db-shm  ### Pre-submission checklist  - [x] I have run the debug script and pasted the output above - [x] I am using the latest version of context-mode - [x] I have searched existing issues for duplicates - [x] I have included steps to reproduce the issue  ### Operating System  macOS (Apple Silicon)  ### JS Runtime  Node 26.3.0, Bun 1.3.14 and pnpm 11.5.3
  **Post-Mortem & Fix Analysis**:
  > Hitting the same issue, I opened https://github.com/mksglu/context-mode/pull/813 as a fix.

- **Issue #805** (2026-06-10): **fix(server): canonicalize cacheRoot in healCacheMidSession via realpathSync for symlinked ~/.claude (#795)**
  *Symptoms*: ## Summary  Fix `healCacheMidSession` in `server.ts` to canonicalize `cacheRoot` via `realpathSync` before the path traversal guard, so the mid-session cache heal works when `~/.claude` is a symlink to another volume.  ## Why  When `~/.claude` is a symlink (e.g. macOS users relocating to an external SSD), `path.resolve()` returns the symlink path (`/Users/me/.claude/plugins/cache`) but the plugin registry stores `installPath` as the physical target (`/Volumes/SSD/claude-code/plugins/cache/...`). The `startsWith` guard at `server.ts:808` compares these mismatched paths and rejects every entry — the heal meant to repair a broken path after an auto-update never fires for these users.  `cli.ts` already uses `realpathSync(cacheRoot)` for the same comparison in `upgrade()` and `statuslineForward()`. This fix brings `healCacheMidSession` to parity.  ## What's covered  - **Source-level regression guard**: the test reads `src/server.ts` and asserts that `realpathSync(cacheRoot)` appears inside `healCacheMidSession` and that the traversal guard uses `cacheRootCanon + sep`. This fails immediately if the fix is reverted. - **Algorithmic symmetry test**: creates a sandbox with a symlinked `dot-claude` → `real-claude-root`, then proves that the lexical comparison rejects a physical `installPath` (old buggy behavior) while the canonical comparison accepts it (fixed behavior).  ## Test plan  - [x] `npx vitest run tests/core/cli.test.ts -t "#795"` — 2 passed (GREEN) - [x] `npx vitest run test
  **Post-Mortem & Fix Analysis**:
  > Hi @ousamabenyounes ci error

- **Issue #803** (2026-06-09): **fix(runtime): add liveness guard to resolveJavascriptRuntime for Homebrew Cellar ENOENT (#800)**
  *Symptoms*: ## Summary  `resolveJavascriptRuntime()` no longer blindly returns `process.execPath` when the file no longer exists on disk. On Homebrew, `process.execPath` is a versioned Cellar path (`/opt/homebrew/Cellar/node/26.0.0/bin/node`). After `brew upgrade` + `brew cleanup`, the old Cellar is deleted, leaving the in-process execPath dangling. The `existsSync` liveness guard falls through to PATH-resolved `node` instead.  ## Why  `ctx_fetch_and_index` (and any `ctx_execute` with `language: "javascript"`) spawns its worker via the JS runtime resolved by `detectRuntimes()` → `resolveJavascriptRuntime()`. That function gates on the `JS_RUNTIMES` allowlist (basename `node`, `bun`, `deno`), and when the basename matches, returns `process.execPath` with no existence check. On Homebrew, this is the Cellar snapshot — once `brew cleanup` deletes it mid-session (or before the next MCP boot), every subsequent `ctx_fetch_and_index` call fails with `spawn ... ENOENT`.  The existing cache-heal in `hooks/cache-heal-utils.mjs` only repairs the `settings.json` hook command — it does not touch the in-process fetch-worker spawn path. This change adds the defense directly at runtime resolution time.  ## Changes  - **`src/runtime.ts`**: In `resolveJavascriptRuntime()`, after confirming the execPath basename is a known JS runtime, add an `existsSync(execPath)` check. If the file does not exist (deleted Cellar, corrupted install, uninstall while process alive), fall through to PATH-resolved `node`. - **`

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

### Incident Patch 1: `e5fcca68` (2026-10-05)
**Commit Message**: ci: update install stats

**File**: `stats.json` (modified, +2/-2)
```diff
@@ -1,8 +1,8 @@
 {
   "schemaVersion": 1,
   "label": "users",
-  "message": "644.8k+",
+  "message": "647.7k+",
   "color": "brightgreen",
-  "npm": "601.8k+",
+  "npm": "604.7k+",
   "marketplace": "43k+"
 }
```

---

### Incident Patch 2: `827a5ed2` (2026-10-05)
**Commit Message**: ci: update install stats

**File**: `stats.json` (modified, +2/-2)
```diff
@@ -1,8 +1,8 @@
 {
   "schemaVersion": 1,
   "label": "users",
-  "message": "644.2k+",
+  "message": "644.8k+",
   "color": "brightgreen",
   "npm": "601.8k+",
-  "marketplace": "42.3k+"
+  "marketplace": "43k+"
 }
```

---

### Incident Patch 3: `a83c2016` (2026-10-04)
**Commit Message**: ci: update install stats

**File**: `stats.json` (modified, +2/-2)
```diff
@@ -1,8 +1,8 @@
 {
   "schemaVersion": 1,
   "label": "users",
-  "message": "640.1k+",
+  "message": "644.2k+",
   "color": "brightgreen",
-  "npm": "597.8k+",
+  "npm": "601.8k+",
   "marketplace": "42.3k+"
 }
```

---

### Incident Patch 4: `c844c96b` (2026-10-04)
**Commit Message**: ci: update install stats

**File**: `stats.json` (modified, +2/-2)
```diff
@@ -1,8 +1,8 @@
 {
   "schemaVersion": 1,
   "label": "users",
-  "message": "640.4k+",
+  "message": "640.1k+",
   "color": "brightgreen",
   "npm": "597.8k+",
-  "marketplace": "42.6k+"
+  "marketplace": "42.3k+"
 }
```

---

### Incident Patch 5: `80d4e823` (2026-10-04)
**Commit Message**: ci: update install stats

**File**: `stats.json` (modified, +2/-2)
```diff
@@ -1,8 +1,8 @@
 {
   "schemaVersion": 1,
   "label": "users",
-  "message": "636.9k+",
+  "message": "640.4k+",
   "color": "brightgreen",
-  "npm": "594.3k+",
+  "npm": "597.8k+",
   "marketplace": "42.6k+"
 }
```

---

### Incident Patch 6: `dbfa57d5` (2026-10-03)
**Commit Message**: ci: update install stats

**File**: `stats.json` (modified, +2/-2)
```diff
@@ -1,8 +1,8 @@
 {
   "schemaVersion": 1,
   "label": "users",
-  "message": "636.5k+",
+  "message": "636.9k+",
   "color": "brightgreen",
   "npm": "594.3k+",
-  "marketplace": "42.1k+"
+  "marketplace": "42.6k+"
 }
```

---

### Incident Patch 7: `9f3ecc8b` (2026-10-03)
**Commit Message**: ci: update install stats

**File**: `stats.json` (modified, +2/-2)
```diff
@@ -1,8 +1,8 @@
 {
   "schemaVersion": 1,
   "label": "users",
-  "message": "632k+",
+  "message": "636.5k+",
   "color": "brightgreen",
-  "npm": "589.8k+",
+  "npm": "594.3k+",
   "marketplace": "42.1k+"
 }
```

---

### Incident Patch 8: `b706902a` (2026-10-02)
**Commit Message**: ci: update install stats

**File**: `stats.json` (modified, +2/-2)
```diff
@@ -1,8 +1,8 @@
 {
   "schemaVersion": 1,
   "label": "users",
-  "message": "632.2k+",
+  "message": "632k+",
   "color": "brightgreen",
   "npm": "589.8k+",
-  "marketplace": "42.4k+"
+  "marketplace": "42.1k+"
 }
```

#### Recent Merged Pull Requests:
- **PR #1260** (closed): ci: use pnpm in openclaw-e2e, tier2-smoke and bundle workflows (@zademy)
- **PR #1202** (closed): merge (@meikocho1)
- **PR #1195** (closed): fix(ensure-deps): stop Bun from seeding an ABI-mismatched native cache (@jgbriel-io)
- **PR #1190** (closed): fix: bundle turndown so ctx_fetch_and_index works without node_modules (Windows) (@rabbitholedotdev)
- **PR #1169** (closed): fix(opencode): support OpenCode 2 plugin API (V1/V2 dual export) (@Scratchydisk)
- **PR #1133** (closed): fix: only route curl and wget in command position (@Rithb898)
- **PR #1115** (closed): feat(omp): inject routing block into task prompts (@tahsinrahman)
- **PR #1114** (closed): feat(omp): name MCP tools as bare ctx_* (@tahsinrahman)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
