# Forensic Learning Record (Deep Inspection): 777genius/agent-teams-ai

> **Canonical Artifact**: `07_PROJECT_LEARNING/777genius-agent-teams-ai-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/777genius/agent-teams-ai](https://github.com/777genius/agent-teams-ai))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:21:47.370Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `777genius/agent-teams-ai`
- **Description**: You're the boss, agents are your team. They handle tasks on their own, message each other, and review each other's work. You just watch the kanban board and give high-level commands. Codex/Claude/OpenCode/Cursor/Grok/GitHub/Kiro/Z.AI/Xiaomi/MiniMax/Kimi(300+ models, 200+ LLM providers, free models no auth) Build your AI company with multiple teams
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 2195 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `agent-teams-controller/src/controller.js`
```
const { createControllerContext } = require('./internal/context.js');
const tasks = require('./internal/tasks.js');
const kanban = require('./internal/kanban.js');
const review = require('./internal/review.js');
const taskBoard = require('./internal/taskBoard.js');
const messages = require('./internal/messages.js');
const processes = require('./internal/processes.js');
const maintenance = require('./internal/maintenance.js');
const crossTeam = require('./internal/crossTeam.js');
const runtime = require('./internal/runtime.js');
const workSync = require('./internal/workSync.js');
const agentBlocks = require('./internal/agentBlocks.js');
const taskCompletionClaim = require('./internal/taskCompletionClaim.js');

function bindModule(context, moduleApi) {
  return Object.fromEntries(
    Object.entries(moduleApi).map(([name, fn]) => [name, (...args) => fn(context, ...args)])
  );
}

function createController(options) {
  const context = createControllerContext(options);

  // tasks/kanban/review stay exposed for low-level compatibility.
  // New task-board lifecycle writes should enter through taskBoard.
  return {
    context,
    tasks: bindModule(context, tasks),
    kanban: bindModule(context, kanban),
    review: bindModule(context, review),
    taskBoard: bindModule(context, taskBoard),
    messages: bindModule(context, messages),
    processes: bindModule(context, processes),
    maintenance: bindModule(context, maintenance),
    crossTeam: bindModule(context, crossTeam),
    runtime: bindModule(context, runtime),
    workSync: bindModule(context, workSync),
  };
}

module.exports = {
  createController,
  createControllerContext,
  agentBlocks,
  taskTextSignals: {
    isTaskCompletionClaimText: taskCompletionClaim.isTaskCompletionClaimText,
  },
  protocols: {
    buildActionModeProtocolText: tasks.buildActionModeProtocolText,
    MEMBER_DELEGATE_DESCRIPTION: tasks.MEMBER_DELEGATE_DESCRIPTION,
    buildProcessProtocolText: tasks.buildProcessProtocolText,
  },
  tasks,
  kanban,
  review,
  taskBoard,
  messages,
  processes,
  maintenance,
  crossTeam,
  runtime,
  workSync,
};

```

### Core Architecture Module: `agent-teams-controller/src/index.js`
```
const controller = require('./controller.js');
const mcpToolCatalog = require('./mcpToolCatalog.js');

module.exports = {
  ...controller,
  ...mcpToolCatalog,
};

```

### Core Architecture Module: `agent-teams-controller/src/internal/agenda.js`
```
const kanbanStore = require('./kanbanStore.js');
const taskStore = require('./taskStore.js');
const runtimeHelpers = require('./runtimeHelpers.js');
const reviewStateHelpers = require('./reviewState.js');
const { withTeamBoardLock } = require('./boardLock.js');

const INVENTORY_KANBAN_COLUMNS = new Set(['review', 'approved']);
const MAX_MEMBER_ACTIONABLE_ITEMS = 50;
const MAX_MEMBER_AWARENESS_ITEMS = 30;
const MAX_LEAD_SECTION_ITEMS = 50;
const MAX_EXPANDED_CONTEXT_ITEMS = 8;
const MAX_DESCRIPTION_CHARS = 1200;
const MAX_COMMENT_CHARS = 500;
const MAX_SUBJECT_CHARS = 240;
const MAX_ANOMALY_ITEMS = 25;
const MAX_ANOMALY_DETAIL_CHARS = 500;

function normalizeName(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function normalizeKey(value) {
  return normalizeName(value).toLowerCase();
}

function formatTaskLabel(task) {
  return `#${task.displayId || task.id}`;
}

function isLeadCandidate(member) {
  return runtimeHelpers.isCanonicalLeadMember(member);
}

function buildQueueRoster(paths) {
  const resolved = runtimeHelpers.resolveTeamMembers(paths);
  const explicit = runtimeHelpers.collectExplicitTeamMembers(paths);
  const membersByKey = new Map();

  for (const member of resolved.members || []) {
    const key = normalizeKey(member && member.name);
    if (!key) continue;
    membersByKey.set(key, member);
  }

  const leadCandidates = (resolved.members || []).filter(isLeadCandidate);
  const uniqueLeadName = leadCandidates.length === 1 ? normalizeName(leadCandidates[0].name) : '';
  const inferredLeadName = normalizeName(runtimeHelpers.inferLeadName(paths));
  const canonicalLeadName =
    uniqueLeadName ||
    (membersByKey.get(normalizeKey(inferredLeadName)) &&
    normalizeName(membersByKey.get(normalizeKey(inferredLeadName)).name)) ||
    '';
  const leadAliases = new Set(['team-lead']);
  if (canonicalLeadName) {
    leadAliases.add(normalizeKey(canonicalLeadName));
    leadAliases.add('lead');
  }

  return {
    membersByKey,
    explicitMemberKeys: new Set(explicit.membersByKey.keys()),
    removedNames: resolved.removedNames || new Set(),
    leadAliases,
    leadCandidates: leadCandidates.map((member) => normalizeName(member.name)).filter(Boolean),
    canonicalLeadName,
    leadHeaderName: uniqueLeadName || '',
  };
}

function collectExplicitMemberKeys(paths) {
  return new Set(runtimeHelpers.collectExplicitTeamMembers(paths).membersByKey.keys());
}

function isCurrentRuntimeMember(teamName, memberName) {
  const requestedKey = normalizeKey(memberName);
  if (!requestedKey) return false;

  const runtimeIdentity = runtimeHelpers.getCurrentRuntimeMemberIdentity();
  if (!runtimeIdentity) return false;

  const runtimeAgentName = normalizeKey(runtimeIdentity.agentName);
  const runtimeAgentId = normalizeKey(runtimeIdentity.agentId);
  const runtimeTeamName = normalizeKey(runtimeIdentity.teamName);
  const requestedAgentId = `${requestedKey}@${normalizeKey(teamName)}`;
  return (
    (runtimeAgentName === requestedKey || runtimeAgentId === requestedAgentId) &&
    (!runtimeTeamName || runtimeTeamName === normalizeKey(teamName))
  );
}

function validateBriefingMember(paths, teamName, memberName) {
  const normalized = normalizeName(memberName);
  const key = normalizeKey(normalized);
  if (!key) {
    throw new Error('Missing member name');
  }

  const roster = buildQueueRoster(paths);
  if (roster.removedNames.has(key)) {
    throw new Error(`Member is removed from the team: ${normalized}`);
  }
  const explicitMemberKeys = collectExplicitMemberKeys(paths);
  if (explicitMemberKeys.has(key) || isCurrentRuntimeMember(teamName, normalized)) {
    return { warnings: [] };
  }
  if (roster.membersByKey.has(key)) {
    return {
      warnings: [
        `Member identity warning: ${normalized} is known only from inbox state, not team config/member metadata. Verify the member name before acting.`,
      ],
    };
  }
  throw new Error(`Member not found in team metadata or inboxes: ${normalized}`);
}

function resolveQueueActor(value, roster) {
  const normalized = normalizeName(value);
  if (!normalized) return null;

  const key = normalizeKey(normalized);
  if (roster.removedNames.has(key)) {
    return null;
  }

  if (roster.leadAliases.has(key) && roster.canonicalLeadName) {
    return { kind: 'lead', memberName: roster.canonicalLeadName };
  }

  const member = roster.membersByKey.get(key);
  if (!member) return null;
  if (!roster.explicitMemberKeys || !roster.explicitMemberKeys.has(key)) return null;

  if (roster.canonicalLeadName && normalizeKey(member.name) === normalizeKey(roster.canonicalLeadName)) {
    return { kind: 'lead', memberName: roster.canonicalLeadName };
  }

  return { kind: 'member', memberName: normalizeName(member.name) };
}

function areSameActors(left, right) {
  if (!left || !right || left.kind !== right.kind) return false;
  if (left.kind === 'lead') return true;
  return normalizeKey(left.memberName) === normalizeKey(right.memberName);
}

function resolveEffectiveReviewState(task, kanbanEntry) {
  return reviewStateHelpers.getEffectiveReviewState(task, kanbanEntry);
}

function resolveLegacyKanbanReviewer(task, roster, options = {}) {
  const reviewState = normalizeName(options.reviewState);
  const kanbanEntry = options.kanbanEntry;
  if (reviewState !== 'review' || !kanbanEntry || kanbanEntry.column !== 'review') {
    return null;
  }

  const legacyReviewer = normalizeName(kanbanEntry.reviewer);
  if (!legacyReviewer) {
    return null;
  }

  const actor = resolveQueueActor(legacyReviewer, roster);
  if (actor) {
    return { actor, source: 'legacy_kanban_reviewer', invalidValue: null };
  }

  return {
    actor: null,
    source: 'legacy_kanban_reviewer_invalid',
    invalidValue: legacyReviewer,
  };
}

function resolveCurrentCycleReviewer(task, roster, options = {}) {
  const events = Array.isArray(task.historyEvents) ? task.historyEvents : [];

  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i];

    if (event.type === 'review_started') {
      const actor = resolveQueueActor(event.actor, roster);
      if (actor) {
        return { actor, source: 'history_review_started_actor', invalidValue: null };
      }
      return {
        actor: null,
        source: 'history_review_started_invalid',
        invalidValue: normalizeName(event.actor) || null,
      };
    }

    if (event.type === 'review_requested') {
      const reviewer = resolveQueueActor(event.reviewer, roster);
      if (reviewer) {
        return { actor: reviewer, source: 'history_review_requested_reviewer', invalidValue: null };
      }
      return {
        actor: null,
        source: 'history_review_requested_invalid',
        invalidValue: normalizeName(event.reviewer) || null,
      };
    }

    if (event.type === 'review_approved' || event.type === 'review_changes_requested') {
      break;
    }

    if (
      event.type === 'status_changed' &&
      (event.to === 'in_progress' || event.to === 'pending' || event.to === 'deleted')
    ) {
      break;
    }

    if (event.type === 'task_created') {
      break;
    }
  }

  const legacyFallback = resolveLegacyKanbanReviewer(task, roster, options);
  if (legacyFallback) {
    return legacyFallback;
  }

  return { actor: null, source: 'none', invalidValue: null };
}

function compareTasksByFreshness(left, right) {
  const leftTs = Date.parse(normalizeName(left.updatedAt) || normalizeName(left.createdAt) || '') || 0;
  const rightTs = Date.parse(normalizeName(right.updatedAt) || normalizeName(right.createdAt) || '') || 0;
  if (leftTs !== rightTs) return rightTs - leftTs;

  const byDisplay = String(left.displayId || left.id).localeCompare(String(right.displayId || right.id), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
  if (byDisplay !== 0) return byDisplay;

  return String(left.id).localeCompare(String(right.id), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

function bui
```

### Core Architecture Module: `agent-teams-controller/src/internal/agentBlocks.js`
```
const AGENT_BLOCK_TAG = 'info_for_agent';
const AGENT_BLOCK_OPEN = `<${AGENT_BLOCK_TAG}>`;
const AGENT_BLOCK_CLOSE = `</${AGENT_BLOCK_TAG}>`;
const AGENT_BLOCK_RE = new RegExp(`<${AGENT_BLOCK_TAG}>[\\s\\S]*?</${AGENT_BLOCK_TAG}>`, 'g');

/** Fresh instance per call: the shared /g regex carries `lastIndex` between uses. */
function createAgentBlockRegex() {
  return new RegExp(`<${AGENT_BLOCK_TAG}>[\\s\\S]*?</${AGENT_BLOCK_TAG}>`, 'g');
}

function wrapAgentBlock(text) {
  const trimmed = typeof text === 'string' ? text.trim() : '';
  if (!trimmed) {
    return '';
  }
  return `${AGENT_BLOCK_OPEN}\n${trimmed}\n${AGENT_BLOCK_CLOSE}`;
}

/**
 * Strip all agent-only blocks from text.
 * Returns text with `<info_for_agent>...</info_for_agent>` blocks removed and trimmed.
 */
function stripAgentBlocks(text) {
  if (typeof text !== 'string') return '';
  return text.replace(AGENT_BLOCK_RE, '').trim();
}

/**
 * Contents of every agent block in `text`, wrapper markers removed.
 *
 * Lets a caller move agent-only content somewhere the markers still parse
 * instead of carrying it through a transform that breaks them - quoting, for
 * one: `> <info_for_agent>` still matches, so the block is stripped but the
 * `> ` that opened it is left behind as a dangling blockquote line.
 */
function extractAgentBlockContents(text) {
  if (typeof text !== 'string') return [];
  return Array.from(text.matchAll(createAgentBlockRegex()))
    .map((match) => match[0].slice(AGENT_BLOCK_OPEN.length, -AGENT_BLOCK_CLOSE.length).trim())
    .filter((content) => content.length > 0);
}

module.exports = {
  AGENT_BLOCK_TAG,
  AGENT_BLOCK_OPEN,
  AGENT_BLOCK_CLOSE,
  AGENT_BLOCK_RE,
  createAgentBlockRegex,
  extractAgentBlockContents,
  stripAgentBlocks,
  wrapAgentBlock,
};

```

### Core Architecture Module: `agent-teams-controller/src/internal/agentLanguage.js`
```
function getSystemLocale() {
    const lang = typeof process.env.LANG === 'string' ? process.env.LANG.trim() : '';
    if (!lang) return 'en';
    return lang.split('.')[0].replace('_', '-');
}

function extractPrimaryLanguage(locale) {
    const normalized = String(locale || '').trim();
    const dash = normalized.indexOf('-');
    return dash > 0 ? normalized.slice(0, dash) : normalized || 'en';
}

function resolveLanguageName(code, systemLocale) {
    const effectiveCode = code === 'system' ? extractPrimaryLanguage(systemLocale || 'en') : code;
    try {
        const displayNames = new Intl.DisplayNames([effectiveCode], { type: 'language' });
        const name = displayNames.of(effectiveCode);
        if (name) {
            return name.charAt(0).toUpperCase() + name.slice(1);
        }
    } catch {
        // Ignore Intl lookup failures and fall back to the raw code.
    }
    return effectiveCode;
}

function buildMemberLanguageInstruction(config) {
    const configured =
        config && typeof config.language === 'string' && config.language.trim() ?
        config.language.trim() :
        '';
    if (!configured) {
        return 'IMPORTANT: Continue using the communication language already specified in your spawn prompt until the team config stores an explicit language.';
    }
    const language = resolveLanguageName(configured, getSystemLocale());
    return `IMPORTANT: Communicate in ${language}. All messages, summaries, and task descriptions MUST be in ${language}.`;
}

module.exports = {
    buildMemberLanguageInstruction,
};

```

### Core Architecture Module: `agent-teams-controller/src/internal/atomicFile.js`
```
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RENAME_MAX_ATTEMPTS = 8;
const RENAME_RETRY_BASE_DELAY_MS = 40;
const RENAME_RETRY_MAX_DELAY_MS = 250;
const RENAME_RETRY_JITTER_MS = 25;
const RETRYABLE_RENAME_CODES = new Set(['EPERM', 'EACCES', 'EBUSY']);

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function getRenameRetryDelayMs(attempt) {
  const backoff = Math.min(RENAME_RETRY_BASE_DELAY_MS * attempt, RENAME_RETRY_MAX_DELAY_MS);
  return backoff + Math.floor(Math.random() * (RENAME_RETRY_JITTER_MS + 1));
}

function fsyncFileBestEffort(filePath) {
  let fd = null;
  try {
    fd = fs.openSync(filePath, 'r+');
    fs.fsyncSync(fd);
  } catch {
    // Best effort only. Some filesystems do not support fsync for these files.
  } finally {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch {
        // Best effort only.
      }
    }
  }
}

function renameWithRetrySync(tempPath, filePath) {
  for (let attempt = 1; attempt <= RENAME_MAX_ATTEMPTS; attempt += 1) {
    try {
      fs.renameSync(tempPath, filePath);
      return;
    } catch (error) {
      if (error && error.code === 'EXDEV') {
        fs.copyFileSync(tempPath, filePath);
        try {
          fs.rmSync(tempPath, { force: true });
        } catch {
          // Best effort cleanup after cross-device fallback.
        }
        return;
      }

      if (error && RETRYABLE_RENAME_CODES.has(error.code) && attempt < RENAME_MAX_ATTEMPTS) {
        sleepSync(getRenameRetryDelayMs(attempt));
        continue;
      }

      throw error;
    }
  }
}

function atomicWriteFileSync(filePath, data, options) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = path.join(path.dirname(filePath), `.tmp.${crypto.randomUUID()}`);

  try {
    fs.writeFileSync(tempPath, data, options);
    fsyncFileBestEffort(tempPath);
    renameWithRetrySync(tempPath, filePath);
  } catch (error) {
    try {
      fs.rmSync(tempPath, { force: true });
    } catch {
      // Cleanup is best effort. Preserve the original write error.
    }
    throw error;
  }
}

function writeJsonFileSync(filePath, value, options = {}) {
  const suffix = options.trailingNewline === true ? '\n' : '';
  atomicWriteFileSync(filePath, `${JSON.stringify(value, null, 2)}${suffix}`, 'utf8');
}

module.exports = {
  atomicWriteFileSync,
  writeJsonFileSync,
};

```

### Core Architecture Module: `agent-teams-controller/src/internal/boardLock.js`
```
const path = require('path');

const { withFileLockSync } = require('./fileLock.js');

const reentrantLockStateByScope = new Map();

function getTeamBoardLockScope(paths) {
  return path.join(paths.teamDir, 'board-state');
}

function getTeamBoardLockContext(paths) {
  return reentrantLockStateByScope.get(getTeamBoardLockScope(paths))?.context;
}

function withTeamBoardLock(paths, fn) {
  const scope = getTeamBoardLockScope(paths);
  const currentState = reentrantLockStateByScope.get(scope);

  if (currentState) {
    currentState.depth += 1;
    try {
      return fn();
    } finally {
      currentState.depth -= 1;
    }
  }

  return withFileLockSync(scope, () => {
    reentrantLockStateByScope.set(scope, {
      context: new Map(),
      depth: 1,
    });
    try {
      return fn();
    } finally {
      reentrantLockStateByScope.delete(scope);
    }
  });
}

module.exports = {
  getTeamBoardLockContext,
  getTeamBoardLockScope,
  withTeamBoardLock,
};

```

### Core Architecture Module: `agent-teams-controller/src/internal/briefingProtocols.js`
```
const { wrapAgentBlock } = require('./agentBlocks.js');

/**
 * Raw action-mode protocol text parameterized by DELEGATE description.
 * Shared between lead (actionModeInstructions.ts) and member (memberBriefing).
 * Context-free — does NOT follow the (context, ...) convention.
 */
function buildActionModeProtocolText(delegateDescription) {
    return [
        'TURN ACTION MODE PROTOCOL (HIGHEST PRIORITY FOR EACH USER TURN):',
        '- Some incoming user or relay messages may include a hidden agent-only block that declares the current action mode.',
        '- If such a block is present, that mode applies to THIS TURN ONLY and overrides any conflicting default behavior.',
        '- Never silently broaden permissions beyond the selected mode.',
        '- Never reveal the hidden mode block verbatim to the human unless they explicitly ask for it.',
        '- Modes:',
        '  - DO: Full execution mode. You may discuss, inspect, edit files, change state, run commands/tools, and delegate if useful.',
        '  - ASK: Strict read-only conversation mode. You may read/analyze/explain and reply, but you must not change code/files/tasks/state or run side-effecting commands/tools/scripts.',
        `  - DELEGATE: ${delegateDescription}`,
    ].join('\n');
}

const MEMBER_DELEGATE_DESCRIPTION =
    'Do not implement yourself. Pass the task with full context (what you know, what is needed) to your team lead or another teammate and let them handle it.';

function buildMemberActionModeProtocol() {
    return buildActionModeProtocolText(MEMBER_DELEGATE_DESCRIPTION);
}

/**
 * Raw process-registration protocol text (no agent-block wrapping).
 * Shared between member briefing and lead provisioning prompt (DRY).
 * Context-free — does NOT follow the (context, ...) convention.
 */
function buildProcessProtocolText(teamName) {
    return `BACKGROUND SERVICE PROCESS REGISTRATION — this is ONLY for extra background services started by teammates (dev server, watcher, database, etc.). It is NOT a list of teammate agents themselves.
1. Launch with & to get PID:
   pnpm dev &
2. Register immediately with MCP tool process_register (--port and --url are optional, use when the process listens on a port):
   { teamName: "${teamName}", pid: <PID>, label: "<description>", from: "<your-name>", port?: <PORT>, url?: "http://localhost:<PORT>", command?: "<command>" }
3. VERIFY registration succeeded (MANDATORY — never skip this step) using MCP tool process_list:
   { teamName: "${teamName}" }
   process_list shows ONLY registered background services for the team. It does NOT show whether teammate agents themselves are alive.
4. When stopping a process, use MCP tool process_stop:
   { teamName: "${teamName}", pid: <PID> }
5. To fully remove a process record (e.g. after it has been stopped and is no longer needed), use MCP tool process_unregister:
   { teamName: "${teamName}", pid: <PID> }
If verification in step 3 fails or the process is missing from the list, re-register it.`;
}

function buildMemberProcessProtocol(teamName) {
    return wrapAgentBlock(buildProcessProtocolText(teamName));
}

function buildMemberFormattingProtocol() {
    return wrapAgentBlock(`Hidden internal instructions rule (IMPORTANT):
- If you send internal operational instructions to another agent/teammate that the human user must NOT see in the UI, wrap ONLY that hidden part in:
  <info_for_agent>
  ... hidden instructions only ...
  </info_for_agent>
- Keep normal human-readable coordination outside the block.
- NEVER use agent-only blocks in messages to "user".`);
}

module.exports = {
    MEMBER_DELEGATE_DESCRIPTION,
    buildActionModeProtocolText,
    buildMemberActionModeProtocol,
    buildMemberFormattingProtocol,
    buildMemberProcessProtocol,
    buildProcessProtocolText,
};

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #765** (2026-09-28): **[BUG] OpenCode provider diagnostics fails because disabled Managed Cursor requires an absolute native executable.**
  *Symptoms*: ## Summary  OpenCode provider diagnostics fail because Agent Teams attempts to initialize the disabled Managed Cursor provider. This prevents OpenCode provider/model diagnostics from completing.  ## Area  - Provider runtime (OpenCode) - Settings / authentication  ## Steps to reproduce  1. Open Agent Teams AI. 2. Open **Providers & Plans** or **Provider Settings**. 3. Leave Cursor disabled; do not install or connect it. 4. Configure or select the OpenCode provider. 5. Run OpenCode provider diagnostics/model discovery. 6. See the error: `Managed Cursor requires an absolute native executable`.  ## Frequency  Always.  ## Regression  Unknown. First encountered on the current installation.  ## Actual behavior  OpenCode diagnostics fail with:      Runtime provider management command failed unexpectedly:     Managed Cursor requires an absolute native executable  The failure occurs even though Cursor is not enabled or connected.  ## Expected behavior  Disabled providers should not be initialized or required for OpenCode diagnostics. OpenCode provider discovery should run independently of Cursor Agent availability.  ## Environment  - OS and version: macOS, Apple Silicon - App version: 2.15.0 - Install type: GitHub release - Provider/runtime involved: OpenCode - Desktop app mode: Electron - Intended model provider: OpenRouter  ## Logs and diagnostics  ```     Error code: runtime-unhealthy     Summary: Runtime provider management command failed unexpectedly:     Managed Cursor requires a
  **Post-Mortem & Fix Analysis**:
  > Fixed and released in v2.17.1: https://github.com/777genius/agent-teams-ai/releases/tag/v2.17.1  The OpenCode runtime fix is in https://github.com/777genius/agent_teams_orchestrator/pull/102. The missing-Cursor end-to-end coverage is in https://github.com/777genius/agent-teams-ai/pull/770. Provider Settings now lets users select non-Cursor models without Cursor CLI installed.
  > @chrisyoungbrighte Hi! You’ve found a critical bug - thank you so much for that. It’s extremely useful that I found out about this.  Please test this if possible 🙏🏼

- **Issue #509** (2026-08-31): **[BUG] Team launch fails immediately with no UI error**
  *Symptoms*: **Summary** A team that used to launch fine now dies on Launch. The button goes to Starting and immediately back to Launch. Nothing shows in the UI. A copy of the team on the same repo launches. The log says one member worktree is on branch `m0merge` instead of the branch the app expected.  **Area** Which part of the app is affected? - Agent teams / teammate launch - Built-in editor / Git - Provider runtime (Claude, Codex, OpenCode)  **Steps to reproduce** 1. Use a team that already has per-member worktrees under `~/Library/Application Support/agent-teams-ai/data/team-worktrees/<team-id>/<team>/<member>/`. 2. Launch that team at least once so those worktrees exist. 3. In one member worktree, check out another branch. Mine was on `m0merge`. The app expected `agent-teams/<team>/<member>-<suffix>`. 4. Stop the team. 5. Click Launch.  **Frequency** Always, as long as that worktree stays on the wrong branch.  **Regression** Yes. This team launched on 2.12.0, then it stopped. I do not have an older app version to compare. A copy of the team on the same repo launched because it got new worktrees.  **Actual behavior** Starting flashes, then Launch comes back. No error notification.  `~/Library/Logs/agent-teams-ai/app-errors.ndjson` has:  `[teams:launch] Worktree path is checked out on "m0merge", expected "agent-teams/<team>/<member>-<suffix>": .../Application Support/agent-teams-ai/data/team-worktrees/<team-id>/<team>/<member>`   **Expected behavior** If launch cannot start because a
  **Post-Mortem & Fix Analysis**:
  > Hi! Thanks for the information! This has been fixed and will be in the next release! 🚀 

- **Issue #443** (2026-09-03): **[BUG] OpenCode command timed out**
  *Symptoms*: **Summary** Failed to query OpenCode agents: OpenCode command timed out after 10000ms  **Area** Which part of the app is affected? - Agent teams / teammate launch  **Steps to reproduce** Try to start the project  **Frequency** Always  **Environment** macOS 15.8  **Logs and diagnostics**  **Screenshots or recording**  <img width="807" height="322" alt="Image" src="https://github.com/user-attachments/assets/c6ed3f0b-efc0-4755-bcaa-a7f543af60bb" />  **Additional context** # Team provisioning diagnostics  ## Quick triage - User-visible title: Launch failed - User-visible message: Failed to query OpenCode models: OpenCode command timed out after 10000ms Failed to query OpenCode agents: OpenCode command timed out after 10000ms OpenCode request timed out after 15000ms for /config - Tone: error - Started at: 2026-08-14T21:24:34.422Z; elapsed: 14:10; pid: (none) - Step index: current=-1; error=0 - Classification: (none); confidence=(unknown) - Bootstrap transport: submitted=(unknown); rejected=(unknown); noStdinWarning=(unknown); lastStage=(none) - Counts: warnings=0; launchDiagnostics=0; memberSnapshots=6; artifactFiles=4 - Manifest counts: expectedMembers=(none); effectiveMembers=(none); spawnStatuses=(none) - Manifest progress: state=(none); message=(none); error=(none) - Raw CLI logs present: yes; live output present: yes  ## Summary Title: Launch failed Message: Failed to query OpenCode models: OpenCode command timed out after 10000ms Failed to query OpenCode agents: OpenCode com
  **Post-Mortem & Fix Analysis**:
  > Resolved on dev with the minimal #443 core:  - Orchestrator #49 enforces a strict launch attempt. - Orchestrator #50 adds the fake-only issue #443 E2E coverage. - Desktop #507 enforces passive status authority. - Desktop #508 binds launch authorization to the exact behavior fingerprint.  The regression path is covered with a fake runtime: hung status or catalog work cannot authorize launch, launch requires fresh exact proof, and member sessions are not created before that proof. Exact-head CI, both test shards, CodeQL, lint, and Windows smoke are green. Verification used only sandbox and fake runtime fixtures - no real user project, provider, team, or agent launch was used.  Hosted work remains preserved as separate Draft follow-ups and is not part of this fix.
  > Reopening: the earlier closure overstated the production catalog coverage.  The Desktop catalog hydration path still calls non-summary `runtime status`, which can enter full OpenCode inventory. The previous fake child-process test accepted that command and therefore did not prove the production route was provider-scoped. A narrow Desktop follow-up is now in progress to use the existing selected-provider models API and test the actual route.  The separate bounded cancellation follow-up is 777genius/agent_teams_orchestrator#51. It is a P2 session-store lock gap, not evidence that locks caused the original models timeout. Hosted contract work and the large WIP branches remain outside these fixes.  This issue will not be considered resolved merely because the adapter-level tests or unrelated CI checks pass. 
  > Resolved by the merged production changes:  - Orchestrator PR #51 merged at `db7f3aee99838556aa66fa3a69bb19f17f01ca3c`. - Desktop PR #530 merged at `497747e0617421f4ed0fb1918f57713ae85995a5`. - Fake-only production-route E2E passed with a disposable sandbox; the trace stayed provider-scoped and did not invoke `models --verbose`, `agent list`, or unrelated managed plugins. - Desktop exact-head focused regression suite: 168/168 passed, plus typecheck, fast lint, source-size guard, and `git diff --check`. - Functional GitHub CI checks passed, including both test shards, lint, CodeQL, Windows smoke, and static analysis.  The hosted no-fast review pool was unavailable for final model verdicts because of external provider capacity/turn-start failures; no worker changed either PR. The unrelated transitive `fast-uri` audit remains tracked separately. 

- **Issue #400** (2026-08-22): **Windows: Cursor ACP (cursor-acp/auto) readiness probe exits immediately; team launch hangs on OpenCode readiness gate**
  *Symptoms*: ## Summary  On Windows 11, launching a team that uses **Cursor App → `auto`** (`providerId: opencode`, `model: cursor-acp/auto`) hangs forever (or until timeout) at:  `Starting OpenCode sessions through runtime adapter`  OpenCode itself starts successfully. The hang is specifically the **readiness execution probe** for `cursor-acp/auto`.  ## Environment  - **OS:** Windows 11 (10.0.22000) - **Agent Teams AI:** 2.11.0 (installed under `C:\Program Files\AgentTeamsAI\`) - **Bundled runtime:** claude-multimodel `0.0.71` (`f1fd20be86fe7755af0f54cca03cb4a4188221ae`) - **OpenCode:** 1.18.5 (app-managed + npm global) - **Cursor Agent CLI:** 2026.07.23-e383d2b (`agent status` = logged in) - **Developer Mode:** enabled (`AllowDevelopmentWithoutDevLicense=1`) - Reinstalling the desktop app does **not** fix it  ## Expected  Team launch with Cursor App models should pass OpenCode readiness (including `requireExecutionProbe`) and start teammates.  ## Actual  1. OpenCode hosts come up healthy (`GET /global/health` → `{"healthy":true,"version":"1.18.5"}`). 2. Bridge runs `opencode.readiness` with body like:  ```json {   "projectPath": "C:\\DEVS",   "selectedModel": "cursor-acp/auto",   "requireExecutionProbe": true } ```  (`timeoutMs`: 300000)  3. OpenCode creates a probe session `probe:cursor-acp/auto`, selects `cursor-acp/auto`, then **exits the loop in ~0.2s with no ERROR**:  ```text stream providerID=cursor-acp modelID=auto ... agent=teammate-model-
  **Post-Mortem & Fix Analysis**:
  > Additional context: this is blocking production use of Cursor App teams on Windows. Cursor Agent CLI works directly (\gent -p\ returns OK), OpenCode serve is healthy, but the managed \cursor-acp/auto\ readiness probe exits the loop in ~200ms with no ERROR and the launch gate hangs on \execution_poll\.  Related ecosystem reports of Cursor/OpenCode ACP hanging or failing on Windows (not Agent Teams specific, but same surface area): - https://github.com/anomalyco/opencode/pull/13222 (ACP hang on Windows thinking state) - https://github.com/zed-industries/zed/issues/57856 (Cursor ACP hangs without clear error)  Happy to run any diagnostic build / collect more traces.
  > Follow-up: same hang happens with \opencode/big-pickle\ (not only Cursor). Probe session starts and exits loop quickly; bridge diagnostics show \stdoutBytes: 0\, \outputSource: none\, \outputReadError: ENOENT\, \stderrBytes: ~442\. So this looks like a Windows OpenCode readiness bridge output-contract failure, not just Cursor ACP.
  > **Root cause found on this machine:** OpenCode readiness returns \hostHealthy=false\ / \ppMcpConnected=false\ with:  \Unable to resolve the agent-teams MCP entrypoint for OpenCode dynamic attach. Set CLAUDE_MULTIMODEL_AGENT_TEAMS_MCP_ENTRY to override...\  When \CLAUDE_MULTIMODEL_AGENT_TEAMS_MCP_ENTRY\ is set to \%APPDATA%\\agent-teams-ai\\mcp-server\\2.11.0\\index.js\, readiness for \opencode/big-pickle\ becomes \state=ready\ / \launchAllowed=true\.  Cursor still reports needing execution verification / auth separately, but the MCP entrypoint miss appears to be the primary Windows launch-gate failure for OpenCode teams.

- **Issue #290** (2026-07-30): **[BUG] Request for a private security reporting channel**
  *Symptoms*: Hello maintainers, I identified a potential security issue affecting the current desktop workflow. At a high level, it concerns the flow where a user selects a repository to create or start a Claude team: the application may change Claude's workspace trust state before the user receives a separate trust confirmation. Your `SECURITY.md` asks researchers not to disclose undisclosed vulnerabilities in public issues, so I am intentionally omitting configuration details, impact analysis, and reproduction steps here. Could you provide a private reporting contact or enable GitHub private vulnerability reporting? I can share the affected commit, source-level evidence, and a minimal non-destructive reproduction privately. 
  **Post-Mortem & Fix Analysis**:
  > Hi @glmgbj233, thanks for taking the time to review the project and for reporting this responsibly. We really appreciate it.  We have now enabled GitHub Private Vulnerability Reporting for this repository. You can submit the full report through Security > Advisories > Report a vulnerability.  Our initial assumption is that you may be referring to the workspace trust preflight used when a user explicitly selects a project and creates or launches a team. The agents run non-interactively, so without handling the provider trust prompt the launch would remain blocked. Other agent orchestrators use a similar approach. For example, Gas Town automatically accepts Claude and Codex workspace trust dialogs for non-interactive sessions: https://github.com/gastownhall/gastown/blob/main/internal/tmux/tmux.go#L1897-L1964  At first glance, we consider the general behavior intentional after an explicit Create/Launch action. That said, we are very interested in your analysis, especially if your concern 
  > Thank you for the clarification. I understand why a non-interactive launch cannot wait for Claude's native trust prompt. My concern is not that the launch must remain blocked. It is that Create/Launch currently appears to be treated as implicit acceptance of all repository-controlled executable configuration, including project hooks and MCP, without a separate in-app disclosure or choice. There are alternatives that preserve non-interactive operation: - Launching untrusted projects in Claude safe mode; - Loading only user-level settings until the user opts in; - Or presenting an Agent Teams-owned confirmation that identifies project hooks/MCP and distinguishes one-time execution from persistent Git-root trust.  My testing confirms that project SessionStart hooks can run during the non-interactive launch. I agree that this may be intentional behavior, but I believe the consent boundary and the persistent trust scope warrant review. 
  > Thanks, this distinction is clear, and the SessionStart hook result is useful.  Our Gas Town comparison was about the need to unblock non-interactive startup, but we agree that this is separate from how Agent Teams communicates and scopes repository-controlled executable configuration. The persistence scope and the difference between a safe one-time launch and permanently trusting the Git root are worth reviewing.  Please submit the reproduction and exact affected configuration through GitHub Private Vulnerability Reporting: https://github.com/777genius/agent-teams-ai/security/advisories/new  We will review the current project hooks and MCP loading path, as well as the feasibility of a safe launch mode or an Agent Teams-owned confirmation while preserving non-interactive operation.  Thanks again for testing this carefully and for the constructive follow-up.

- **Issue #288** (2026-07-21): **[BUG] Phase-2 readiness `blocking_metrics` suppresses nudges on any active team — maxFingerprintChangesPerMemberHour: 1 is unreachable in normal use**
  *Symptoms*: ### Summary  On any team that is actually doing work, member work-sync nudges are permanently suppressed by the Phase-2 readiness `blocking_metrics` gate. The system correctly detects that a member needs waking, then declines to wake it. The member sits idle indefinitely with actionable work assigned.  The core problem: **`maxFingerprintChangesPerMemberHour: 1` is below the rate that normal operation produces.** In my deployment, every single active member exceeds it, so the safety net is effectively off exactly when it is needed.  ### Observed behavior  Members stop working while their process is still alive, holding `in_progress` tasks that are not blocked. Journal entries from `members/<member>/.member-work-sync/journal.jsonl`:  ```json {   "event": "nudge_skipped",   "source": "nudge_planner",   "state": "needs_sync",   "actionableCount": 1,   "reason": "blocking_metrics",   "providerId": "codex" } ```  The decision layer got it right — `state: needs_sync`, `actionableCount: 1` — and the nudge was then dropped.  ### Why this is structural, not a tuning issue  Measured board-mutation rate per member over a 3-hour window (5 teams, ~28 members, all `providerId: codex`), using task `historyEvents` as a proxy for agenda changes:  | member | events/hour | |---|---| | busiest | 3.7 | | median  | ~2.3 | | quietest active member | 1.0 |  `maxFingerprintChangesPerMemberHour` is **1**. Every active member is at or above the limit; most are 2–4x over. There is no realistic level of "
  **Post-Mortem & Fix Analysis**:
  > Follow-up with sharper data — my original report understated this. It is not "active teams get gated"; it is **every team, all the time**, and the gate is self-reinforcing.  ### 1. The blocking metric is `would_nudge`, and it is 5–21x over threshold on every team  Measured over a 1-hour window across 5 teams (`nudge_skipped` + `nudge_planned` + `runtime_stall_observed` as the observable proxy for `would_nudge`), divided by live member count:  | team | members | events/member-hour | threshold | |---|---|---|---| | A | 4 | 10.0 | 2 | | B | 3 | 27.7 | 2 | | C | 9 | 24.9 | 2 | | D | 12 | 24.2 | 2 | | E | 5 | 42.6 | 2 |  Every team, including the ones that are still making progress. So `blocking_metrics` is not an occasional degraded state — it is the steady state.  ### 2. It is a positive feedback loop  A stalled member emits a would-nudge every reconcile cycle. That inflates `wouldNudgesPerMemberHour`, which trips `blocking_metrics`, which suppresses the nudge that would have unstuck it, 
  > Update: we built an external compensator and it worked. Sharing the numbers in case they help calibrate the fix — **no code, just the mechanism and the measurements.**  ### Context  5 teams, 38 teammates (excluding leads), all Codex on `codex-native`, `skipPermissions: true`, per-member `isolation: worktree`. Single human operator.  ### What we observed before intervening  Members were alive but idle: process running, holding an assigned card, no turns for hours. Leads were the only reliably-woken agents, because messages and task comments kept reaching them while the nudge path stayed suppressed by `blocking_metrics`.  The decisive measurement was separating two things that look identical from outside:  | | count | |---|---| | members holding a card but not turning | 3 | | **members with no card assigned at all** | **30** |  Only 3 were actually stalled. **30 had nothing to do.** Poking those 30 would have burned a turn each and changed nothing — they would wake, see an empty agenda, 
  > Hi! Thanks, this is a major bug! I'm taking a closer look.

- **Issue #276** (2026-07-20): **[BUG] fail to load model**
  *Symptoms*: after update tool, all teams and new team unavailable .   <img width="1094" height="866" alt="Image" src="https://github.com/user-attachments/assets/22bfd02e-777a-4742-9c64-f6c0dcf1a218" />  <img width="1802" height="610" alt="Image" src="https://github.com/user-attachments/assets/e0050393-ce36-4bdc-8e7a-8ed88e2e9ef2" />
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report. We checked the diagnostics in your screenshot and found two separate authentication issues:  - The models shown as `via OpenCode` are actually using OpenCode Zen. Zen is rejecting the saved credential with `Invalid API key`, so the OpenCode Zen API key needs to be replaced. - The models shown as `via OpenRouter` are returning `Forbidden: Access denied by security policy`. This means OpenRouter accepted the credential format, but the request was blocked by the key, account, or security restrictions.  These authentication failures are why the selected teammates could not start.  We have also improved this system for the next release. It will:  - Clearly label the provider as `OpenCode Zen` instead of the ambiguous `OpenCode` - Verify credentials with a minimal real model request when connecting - Prefer a free model for verification when available - Show exactly which provider and credential failed - Preserve the previous working credential if a replacement fails v
  > We also found bug on our side - fixing it.
  > Fixed in the v2.10.0. Thanks for the info!

- **Issue #258** (2026-07-19): **[BUG] Agent be completely deleted**
  *Symptoms*: **Summary** In version 2.7.0, why can't the agent be completely deleted? Every time I start the team afterwards, the deleted agent still starts up and tries to join the team. The agent's status is always idle. Although it doesn't affect the team's task completion, it still feels a bit uncomfortable.   **Steps to reproduce** 1. Go to '...' 2. Click on '...' 3. Run / create / send '...' 4. See the problem  **Frequency** Always 
  **Post-Mortem & Fix Analysis**:
  > Hello! Thank you for your inquiry, we are already in the process of fixing it.
  > Hi! Thank you again for reporting this and for the helpful reproduction details. We fixed the issue in #260: removing a teammate now stops its runtime and prevents it from rejoining on future team launches. The fix has been merged and will be included in the next release. Thanks a lot for helping us improve Agent Teams!
  > Fixed in the 2.9.0. 

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

### Incident Patch 1: `f936527b` (2026-09-30)
**Commit Message**: fix(runtime): prevent legacy CLI selection and status refresh loops (#781)

Prevent the repeated automatic CLI status bootstrap that kept provider cards loading after a completed mode mismatch.

Always use the multimodel orchestrator in development and release builds, ignore the legacy CLI flavor toggle and generic Claude path override, and correct runtime recovery hints. Update affected sandbox fixtures and regression checks.

Verified focused regression behavior, provider-management tests, TypeScript, lint, Windows smoke, full CI, and an independent gpt-6.1-sol review of the final head.

**File**: `src/features/runtime-provider-management/main/infrastructure/AgentTeamsRuntimeProviderManagementCliClient.ts` (modified, +5/-5)
```diff
@@ -503,8 +503,8 @@ function formatNonJsonCliOutputError(input: {
     : 'The runtime command printed logs, help text, or a crash message instead of JSON.';
   const hints = likelyWrongBinary
     ? [
-        'Check CLAUDE_AGENT_TEAMS_ORCHESTRATOR_CLI_PATH and CLAUDE_CLI_PATH.',
-        'Those environment variables must not point to opencode.',
+        'Check CLAUDE_AGENT_TEAMS_ORCHESTRATOR_CLI_PATH.',
+        'This environment variable must not point to opencode.',
         'The expected binary is the Agent Teams runtime/orchestrator CLI, not the OpenCode CLI.',
       ]
     : [
@@ -562,8 +562,8 @@ function formatWrongRuntimeBinaryError(
 ): RuntimeProviderCommandFailure {
   const likelyCause = 'The app resolved the OpenCode CLI itself as the Agent Teams runtime binary.';
   const hints = [
-    'Check CLAUDE_AGENT_TEAMS_ORCHESTRATOR_CLI_PATH and CLAUDE_CLI_PATH.',
-    'Those environment variables must not point to opencode.',
+    'Check CLAUDE_AGENT_TEAMS_ORCHESTRATOR_CLI_PATH.',
+    'This environment variable must not point to opencode.',
     'The expected binary is the Agent Teams runtime/orchestrator CLI, not the OpenCode CLI.',
   ];
   const lines = [
@@ -702,7 +702,7 @@ function formatMissingRuntimeBinaryError(
   const likelyCause =
     'The Agent Teams runtime/orchestrator CLI could not be resolved from the current environment.';
   const hints = [
-    'Check CLAUDE_AGENT_TEAMS_ORCHESTRATOR_CLI_PATH and CLAUDE_CLI_PATH.',
+    'Check CLAUDE_AGENT_TEAMS_ORCHESTRATOR_CLI_PATH.',
     'If you are developing locally, start the desktop app from a shell that can resolve the orchestrator CLI.',
     'The expected binary is the Agent Teams runtime/orchestrator CLI, not the OpenCode CLI.',
   ];
```

**File**: `src/main/services/team/ClaudeBinaryResolver.ts` (modified, +2/-2)
```diff
@@ -217,11 +217,11 @@ async function resolveBundledOrchestratorBinary(): Promise<string | null> {
   return resolveFromCandidateList([path.join(resourcesPath, 'runtime', binaryName)]);
 }
 
+/** Keep provider CLI path overrides separate from the orchestrator path override. */
 function getConfiguredRuntimeOverrideRaw(flavor: 'claude' | 'agent_teams_orchestrator'): string {
   return (
     (flavor === 'agent_teams_orchestrator'
-      ? (process.env.CLAUDE_AGENT_TEAMS_ORCHESTRATOR_CLI_PATH?.trim() ??
-        process.env.CLAUDE_CLI_PATH?.trim())
+      ? process.env.CLAUDE_AGENT_TEAMS_ORCHESTRATOR_CLI_PATH?.trim()
       : process.env.CLAUDE_CLI_PATH?.trim()) ?? ''
   );
 }
```

**File**: `src/main/services/team/cliFlavor.ts` (modified, +1/-13)
```diff
@@ -2,20 +2,8 @@ import type { CliFlavor, CliFlavorUiOptions } from '@shared/types';
 
 export const DEFAULT_CLI_FLAVOR: CliFlavor = 'agent_teams_orchestrator';
 
-function parseFlavorOverride(raw: string | undefined): CliFlavor | null {
-  const trimmed = raw?.trim();
-  if (trimmed === 'claude' || trimmed === 'agent_teams_orchestrator') {
-    return trimmed;
-  }
-  return null;
-}
-
+/** Always use the orchestrator; native Claude is a provider, not an alternate app runtime. */
 export function getConfiguredCliFlavor(): CliFlavor {
-  const envOverride = parseFlavorOverride(process.env.CLAUDE_TEAM_CLI_FLAVOR);
-  if (envOverride) {
-    return envOverride;
-  }
-
   return DEFAULT_CLI_FLAVOR;
 }
 
```

**File**: `src/renderer/components/extensions/ExtensionStoreView.tsx` (modified, +9/-2)
```diff
@@ -4,7 +4,7 @@
  * Global catalog data comes from Zustand store.
  */
 
-import { useCallback, useEffect, useMemo, useState } from 'react';
+import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
 
 import {
   isCodexAccountSnapshotPending,
@@ -221,6 +221,8 @@ export const ExtensionStoreView = (): React.JSX.Element => {
 
   const tabState = useExtensionsTabState();
   const [customMcpDialogOpen, setCustomMcpDialogOpen] = useState(false);
+  // A completed status may disagree with the UI mode; retry automatically only after a mode change.
+  const autoCliRefresh = useRef<{ mode: boolean; attempted: boolean } | null>(null);
   const resolvedProject = useMemo(
     () => resolveProjectPathById(extensionsTabProjectId, projects, repositoryGroups),
     [extensionsTabProjectId, projects, repositoryGroups]
@@ -263,14 +265,18 @@ export const ExtensionStoreView = (): React.JSX.Element => {
   }, [fetchPluginCatalog, projectPath]);
 
   useEffect(() => {
+    if (autoCliRefresh.current?.mode !== multimodelEnabled) {
+      autoCliRefresh.current = { mode: multimodelEnabled, attempted: false };
+    }
     const cliStatusMatchesCurrentMode =
       cliStatus &&
       (multimodelEnabled
         ? cliStatus.flavor === 'agent_teams_orchestrator'
         : cliStatus.flavor !== 'agent_teams_orchestrator');
-    if (cliStatusLoading || cliStatusMatchesCurrentMode) {
+    if (cliStatusLoading || cliStatusMatchesCurrentMode || autoCliRefresh.current.attempted) {
       return;
     }
+    autoCliRefresh.current.attempted = true;
     void refreshCliStatusForCurrentMode({
       multimodelEnabled,
       providerStatusMode: 'defer',
@@ -291,6 +297,7 @@ export const ExtensionStoreView = (): React.JSX.Element => {
 
   // Refresh all data (plugins + MCP browse + installed + skills)
   const handleRefresh = useCallback(() => {
+    autoCliRefresh.current = { mode: multimodelEnabled, attempted: true };
     void refreshCliStatusForCurrentMode({
       multimodelEnabled,
       bootstrapCliStatus,
```

**File**: `test/main/features/runtime-provider-management/AgentTeamsRuntimeProviderManagementCliClient.test.ts` (modified, +2/-2)
```diff
@@ -1809,7 +1809,7 @@ describe('AgentTeamsRuntimeProviderManagementCliClient', () => {
     expect(response.error?.diagnostics?.stdoutPreview).toBeNull();
     expect(response.error?.diagnostics?.stderrPreview).toBeNull();
     expect(response.error?.diagnostics?.hints).toContain(
-      'Those environment variables must not point to opencode.'
+      'This environment variable must not point to opencode.'
     );
   });
 
@@ -1953,7 +1953,7 @@ describe('AgentTeamsRuntimeProviderManagementCliClient', () => {
     expect(response.error?.diagnostics?.projectPath).toBe('/Users/test/My Project');
     expect(response.error?.diagnostics?.likelyCause).toContain('OpenCode CLI itself');
     expect(response.error?.diagnostics?.hints).toContain(
-      'Those environment variables must not point to opencode.'
+      'This environment variable must not point to opencode.'
     );
     expect(response.error?.diagnostics?.stdoutPreview).toContain('api_key: ...redacted');
     expect(response.error?.diagnostics?.stdoutPreview).not.toContain('sk-secret-value-123456');
```

---

### Incident Patch 2: `21b1103f` (2026-09-30)
**Commit Message**: fix(deps): clear high-severity audit findings (#780)

Update patched brace-expansion and undici overrides to fixed releases so landing build and CI validate pass their high-severity audits.

**File**: `landing/package-lock.json` (modified, +6/-6)
```diff
@@ -7288,9 +7288,9 @@
       "license": "ISC"
     },
     "node_modules/brace-expansion": {
-      "version": "5.0.9",
-      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-5.0.9.tgz",
-      "integrity": "sha512-ScQ4IuvIEF1TMlP7Zt+vjJ//9zlPb2SDcxWxM3bk8s6t6GGdJ7KO1dCcTidOPJKePW30LE/2cT7wCyPho9/Wxg==",
+      "version": "5.0.12",
+      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-5.0.12.tgz",
+      "integrity": "sha512-YovQ3rzhaLMIrDjNDMkNS01tea93qhEhG5xy8f6+R0l+dw3Ki+5sCoIoI942iuLZTHWogWktgwVDhU09iNEimQ==",
       "license": "MIT",
       "dependencies": {
         "balanced-match": "^4.0.2"
@@ -13846,9 +13846,9 @@
       "license": "ISC"
     },
     "node_modules/picomatch": {
-      "version": "4.0.5",
-      "resolved": "https://registry.npmjs.org/picomatch/-/picomatch-4.0.5.tgz",
-      "integrity": "sha512-RvwwcruNjI1ncT5xRakeyS9Lf8lcItv34KD+aif+VH9kduAyfYBipGh12274xtenIPZ119/R9BdTBa8gAwSh0A==",
+      "version": "4.0.7",
+      "resolved": "https://registry.npmjs.org/picomatch/-/picomatch-4.0.7.tgz",
+      "integrity": "sha512-qcJu88Q2IWqJsDD529JKMdwGm/dvInW4HvQnRwiH9JtihJvzGOscDtHE3x1pBKeUOTysQ8kVmLnJ2kJu7yhcGA==",
       "license": "MIT",
       "engines": {
         "node": ">=12"
```

**File**: `landing/package.json` (modified, +1/-1)
```diff
@@ -58,7 +58,7 @@
   "overrides": {
     "@nuxt/devtools": "3.4.1",
     "@nuxt/schema": "3.21.11",
-    "brace-expansion": "5.0.9",
+    "brace-expansion": "5.0.12",
     "esbuild": "0.28.1",
     "immutable": "5.1.9",
     "js-yaml@3": "3.15.2",
```

**File**: `patches/brace-expansion@5.0.12.patch` (renamed, +1/-2)
```diff
@@ -1,8 +1,7 @@
 diff --git a/dist/commonjs/index.js b/dist/commonjs/index.js
 --- a/dist/commonjs/index.js
 +++ b/dist/commonjs/index.js
-@@ -286,4 +286,7 @@ function expand_(str, max, maxLength, isTop) {
-     }
+@@ -330,3 +330,6 @@ function expand_(str, max, maxLength, isTop) {
      return acc;
  }
 +// Keep the callable CommonJS export expected by minimatch 3.x and 5.x while
```

**File**: `pnpm-lock.yaml` (modified, +124/-136)
```diff
@@ -23,9 +23,9 @@ overrides:
   axios: 1.18.1
   body-parser: 2.3.0
   browserslist: 4.28.8
-  brace-expansion@1: 5.0.9
-  brace-expansion@2: 5.0.9
-  brace-expansion@5: 5.0.9
+  brace-expansion@1: 5.0.12
+  brace-expansion@2: 5.0.12
+  brace-expansion@5: 5.0.12
   defu: 6.1.5
   devalue: 5.9.4
   dompurify: 3.4.12
@@ -72,8 +72,8 @@ overrides:
   tar: 7.5.22
   form-data: 4.0.6
   tmp: 0.2.7
-  undici@6: 6.27.0
-  undici@7: 7.29.0
+  undici@6: 6.29.0
+  undici@7: 7.30.0
   unhead: 2.1.13
   uuid: ^11.1.1
   vitepress>vite: 7.3.5
@@ -92,7 +92,7 @@ patchedDependencies:
   '@radix-ui/react-slot@1.2.4': 5c525e90054caa3bbfa5599b10f7650914e2085f54b773bd115ad0e41eeca30a
   '@radix-ui/react-switch@1.3.7': 7c271784b060c98aedf8f10ae0a0d051a9d7dd7020e50195c1b6e93927d11280
   '@radix-ui/react-tooltip@1.2.8': 92cb648a695f616d3b7222b90053cb36e162bab4303abf0fe39b517e1d9dd6b8
-  brace-expansion@5.0.9: 9ef3b00122b6a8ab9921733d7e330b30e18388b591246cc7c5dbadd9ee8f1b06
+  brace-expansion@5.0.12: 3ae36edc21bd38f2596d0a98e3d223dc194dd5a639b7cba945ba690dfff4e8a3
   fastmcp@3.35.0: 7175182f509e3d149c517648f2b8e6d04a023a3c8fe126ca4ec58426b9d606df
 
 importers:
@@ -638,13 +638,13 @@ importers:
         version: 0.11.3(magicast@0.5.2)(pinia@3.0.4(typescript@5.9.3)(vue@3.5.30(typescript@5.9.3)))
       '@vueuse/nuxt':
         specifier: ^10.11.1
-        version: 10.11.1(magicast@0.5.2)(nuxt@3.21.11(@oxc-project/types@0.143.0)(@parcel/watcher@2.5.6)(@types/node@24.12.4)(@vue/compiler-sfc@3.5.41)(better-sqlite3@12.11.1)(cac@6.7.14)(commander@14.0.3)(db0@0.3.4(better-sqlite3@12.11.1)(drizzle-orm@0.45.2(@opentelemetry/api@1.9.0)(@types/better-sqlite3@7.6.13)(@types/pg@8.15.6)(better-sqlite3@12.11.1)))(drizzle-orm@0.45.2(@opentelemetry/api@1.9.0)(@types/better-sqlite3@7.6.13)(@types/pg@8.15.6)(better-sqlite3@12.11.1))(encoding@0.1.13)(esbuild@0.28.1)(eslint@9.39.4(jiti@2.7.0)(supports-color@10.2.2))(idb-keyval@6.2.2)(ioredis@5.10.1(supports-color@10.2.2))(magicast@0.5.2)(optionator@0.9.4)(rollup-plugin-visualizer@7.0.1(rollup@4.59.0))(rollup@4.59.0)(sass@1.98.0)(supports-color@10.2.2)(terser@5.46.0)(tsx@4.21.0)(typescript@5.9.3)(vite@7.3.5(@types/node@24.12.4)(jiti@2.7.0)(sass@1.98.0)(terser@5.46.0)(tsx@4.21.0)(yaml@2.9.0))(yaml@2.9.0))(vue@3.5.30(typescript@5.9.3))
+        version: 10.11.1(magicast@0.5.2)(nuxt@3.21.11(@oxc-project/types@0.143.0)(@parcel/watcher@2.5.6)(@types/node@24.12.4)(@vue/compiler-sfc@3.5.41)(better-sqlite3@12.11.1)(cac@6.7.14)(commander@14.0.3)(db0@0.3.4(better-sqlite3@12.11.1)(drizzle-orm@0.45.2(@opentelemetry/api@1.9.0)(@types/better-sqlite3@7.6.13)(@types/pg@8.15.6)(better-sqlite3@12.11.1)))(drizzle-orm@0.45.2(@opentelemetry/api@1.9.0)(@types/better-sqlite3@7.6.13)(@types/pg@8.15.6)(better-sqlite3@12.11.1))(encoding@0.1.13)(esbuild@0.28.1)(eslint@9.39.4(jiti@2.7.0)(supports-color@10.2.2))(idb-keyval@6.2.2)(ioredis@5.10.1(supports-color@10.2.2))(magicast@0.5.2)(optionator@0.9.4)(rollup-plugin-visualizer@7.0.1(rollup@4.59.0))(rollup@4.59.0)(sass@1.98.0)(supports-color@10.2.2)(terser@5.46.0)(tsx@4.23.15)(typescript@5.9.3)(vite@7.3.5(@types/node@24.12.4)(jiti@2.7.0)(sass@1.98.0)(terser@5.46.0)(tsx@4.23.15)(yaml@2.9.0))(yaml@2.9.0))(vue@3.5.30(typescript@5.9.3))
       nuxt:
         specifier: ^3.21.11
-        version: 3.21.11(@oxc-project/types@0.143.0)(@parcel/watcher@2.5.6)(@types/node@24.12.4)(@vue/compiler-sfc@3.5.41)(better-sqlite3@12.11.1)(cac@6.7.14)(commander@14.0.3)(db0@0.3.4(better-sqlite3@12.11.1)(drizzle-orm@0.45.2(@opentelemetry/api@1.9.0)(@types/better-sqlite3@7.6.13)(@types/pg@8.15.6)(better-sqlite3@12.11.1)))(drizzle-orm@0.45.2(@opentelemetry/api@1.9.0)(@types/better-sqlite3@7.6.13)(@types/pg@8.15.6)(better-sqlite3@12.11.1))(encoding@0.1.13)(esbuild@0.28.1)(eslint@9.39.4(jiti@2.7.0)(supports-color@10.2.2))(idb-keyval@6.2.2)(ioredis@5.10.1(supports-color@10.2.2))(magicast@0.5.2)(optionator@0.9.4)(rollup-plugin-visualizer@7.0.1(rollup@4.59.0))(rollup@4.59.0)(sass@1.98.0)(supports-color@10.2.2)(terser@5.46.0)(tsx@4.21.
```

**File**: `pnpm-workspace.yaml` (modified, +7/-7)
```diff
@@ -6,7 +6,7 @@ packages:
 minimumReleaseAge: 4320
 minimumReleaseAgeExclude:
   - '@esbuild/*'
-  - brace-expansion@5.0.9
+  - brace-expansion@5.0.12
   - esbuild
   - fast-uri@3.1.7
   - find-my-way@9.7.0
@@ -36,9 +36,9 @@ overrides:
   'axios': '1.18.1'
   'body-parser': '2.3.0'
   'browserslist': '4.28.8'
-  'brace-expansion@1': '5.0.9'
-  'brace-expansion@2': '5.0.9'
-  'brace-expansion@5': '5.0.9'
+  'brace-expansion@1': '5.0.12'
+  'brace-expansion@2': '5.0.12'
+  'brace-expansion@5': '5.0.12'
   'defu': '6.1.5'
   'devalue': '5.9.4'
   'dompurify': '3.4.12'
@@ -87,8 +87,8 @@ overrides:
   'tar': '7.5.22'
   'form-data': '4.0.6'
   'tmp': '0.2.7'
-  'undici@6': '6.27.0'
-  'undici@7': '7.29.0'
+  'undici@6': '6.29.0'
+  'undici@7': '7.30.0'
   'unhead': '2.1.13'
   'uuid': '^11.1.1'
   'vitepress>vite': '7.3.5'
@@ -121,5 +121,5 @@ patchedDependencies:
   '@radix-ui/react-menu@2.1.16': 'patches/@radix-ui__react-menu@2.1.16.patch'
   '@radix-ui/react-checkbox@1.3.3': 'patches/@radix-ui__react-checkbox@1.3.3.patch'
   'fastmcp@3.35.0': 'patches/fastmcp@3.35.0.patch'
-  brace-expansion@5.0.9: patches/brace-expansion@5.0.9.patch
+  brace-expansion@5.0.12: patches/brace-expansion@5.0.12.patch
   '@radix-ui/react-switch@1.3.7': patches/@radix-ui__react-switch@1.3.7.patch
```

---

### Incident Patch 3: `fc33a2c2` (2026-09-30)
**Commit Message**: fix(landing): lead screenshots with team chat (#779)

Show the team chat first and organization map last, preserving their matching previews.

**File**: `landing/data/screenshots.ts` (modified, +12/-12)
```diff
@@ -14,12 +14,12 @@ export type Screenshot = {
  */
 export const screenshots: Screenshot[] = [
   {
-    path: 'screenshots/organization-map.png',
-    previewPath: 'screenshots/organization-map.png',
-    alt: 'Organization structure map with team and task details',
-    ruAlt: 'Карта структуры организации с командами и деталями задач',
-    width: 2624,
-    height: 1648,
+    path: 'screenshots/team-chat.png',
+    previewPath: 'screenshots/previews/team-chat.webp',
+    alt: 'Full-screen team chat with replies, attachments, mentions, and drafts',
+    ruAlt: 'Полноэкранный чат команды с ответами, вложениями, упоминаниями и черновиками',
+    width: 1500,
+    height: 1000,
   },
   {
     path: 'screenshots/1.png',
@@ -118,11 +118,11 @@ export const screenshots: Screenshot[] = [
     height: 1640,
   },
   {
-    path: 'screenshots/team-chat.png',
-    previewPath: 'screenshots/previews/team-chat.webp',
-    alt: 'Full-screen team chat with replies, attachments, mentions, and drafts',
-    ruAlt: 'Полноэкранный чат команды с ответами, вложениями, упоминаниями и черновиками',
-    width: 1500,
-    height: 1000,
+    path: 'screenshots/organization-map.png',
+    previewPath: 'screenshots/organization-map.png',
+    alt: 'Organization structure map with team and task details',
+    ruAlt: 'Карта структуры организации с командами и деталями задач',
+    width: 2624,
+    height: 1648,
   },
 ];
```

---

### Incident Patch 4: `9af71f9a` (2026-09-29)
**Commit Message**: fix(landing): use unique chat screenshot asset URLs (#777)

Prevents cached organization-map previews from appearing on the team chat screenshot. Follow-up to #774.

**File**: `landing/data/screenshots.ts` (modified, +2/-2)
```diff
@@ -118,8 +118,8 @@ export const screenshots: Screenshot[] = [
     height: 1640,
   },
   {
-    path: 'screenshots/12.png',
-    previewPath: 'screenshots/previews/12.webp',
+    path: 'screenshots/team-chat.png',
+    previewPath: 'screenshots/previews/team-chat.webp',
     alt: 'Full-screen team chat with replies, attachments, mentions, and drafts',
     ruAlt: 'Полноэкранный чат команды с ответами, вложениями, упоминаниями и черновиками',
     width: 1500,
```

---

### Incident Patch 5: `883756ee` (2026-09-29)
**Commit Message**: fix(review): preserve task Changes across relaunch

Preserve task Changes across Codex edits, prior lead sessions, duplicate paths, renames and interrupted recovery. Bind destructive review actions to task-specific ledger evidence and keep ambiguous legacy changes fail closed. Add isolated desktop and Windows regression coverage.

PR: https://github.com/777genius/agent-teams-ai/pull/769
Depends on merged Electron 44 PR #761 and Node 26 PR #760.
Refs #684
Refs #765

**File**: `scripts/ci/source-file-size-baseline.json` (modified, +2/-3)
```diff
@@ -75,7 +75,7 @@
     "src/main/services/team/ReviewApplierService.ts": 2062,
     "src/main/services/team/ReviewDecisionStore.ts": 1970,
     "src/main/services/team/runtime/OpenCodeTeamRuntimeAdapter.ts": 1591,
-    "src/main/services/team/TaskChangeComputer.ts": 1357,
+    "src/main/services/team/TaskChangeComputer.ts": 1312,
     "src/main/services/team/TaskChangeLedgerReader.ts": 2159,
     "src/main/services/team/taskLogs/stream/BoardTaskLogStreamService.ts": 2516,
     "src/main/services/team/taskLogs/stream/OpenCodeTaskLogStreamSource.ts": 1364,
@@ -86,13 +86,12 @@
     "src/main/services/team/TeamInboxReader.ts": 820,
     "src/main/services/team/TeamLaunchStateEvaluator.ts": 1059,
     "src/main/services/team/TeamLogSourceTracker.ts": 1088,
-    "src/main/services/team/TeamMemberLogsFinder.ts": 2349,
+    "src/main/services/team/TeamMemberLogsFinder.ts": 2344,
     "src/main/services/team/TeamMemberRuntimeAdvisoryService.ts": 964,
     "src/main/services/team/TeamMessageFeedService.ts": 1094,
     "src/main/services/team/TeamTaskActivityIntervalService.ts": 892,
     "src/main/services/team/TeamTaskReader.ts": 882,
     "src/main/services/team/TeamTranscriptProjectResolver.ts": 1558,
-    "src/main/utils/atomicWrite.ts": 822,
     "src/main/utils/childProcess.ts": 965,
     "src/main/utils/jsonl.ts": 957,
     "src/main/workers/team-fs-worker.ts": 2151,
```

**File**: `scripts/e2e/anthropic-compatible-status/run-packaged.mjs` (modified, +20/-8)
```diff
@@ -324,7 +324,18 @@ try {
     deviceScaleFactor: 1,
     mobile: false,
   });
-  await cdp.wait('Boolean(window.electronAPI?.cliInstaller && document.body)', 'app preload');
+  await cdp.wait('Boolean(window.electronAPI?.startup?.getStatus && document.body)', 'app preload');
+  const startup = await cdp.wait(
+    `window.electronAPI.startup.getStatus().then(status =>
+      (status.ready || status.error || status.phase === 'failed') && status)`,
+    'app services ready'
+  );
+  record('startup-status', startup);
+  assert(
+    startup.ready && !startup.error,
+    `App startup failed: ${redact(startup.error ?? startup.phase)}`
+  );
+  record('startup-ready');
   const discovery = await cdp.probe(
     'discovery',
     'window.electronAPI.cliInstaller.getStatus({providerStatusMode:"defer"})'
@@ -407,10 +418,7 @@ try {
   const selectedModelExpression = `[...document.querySelectorAll('[data-testid=team-model-selector-model-option]')]
     .some(b => b.textContent.trim() === ${JSON.stringify(model)} && b.getAttribute('aria-pressed') === 'true')`;
   await cdp.clickText(model, 'document.querySelector("[data-role=lead-row]")');
-  await cdp.wait(
-    selectedModelExpression,
-    'selected compatible model'
-  );
+  await cdp.wait(selectedModelExpression, 'selected compatible model');
   const readSelection = `(() => ({
     leadLabel: document.querySelector('[data-role="lead-row"] button[aria-label^="Anthropic provider,"]')?.getAttribute('aria-label') ?? null,
     storedModel: localStorage.getItem('createTeam:lastSelectedModel:anthropic'),
@@ -430,7 +438,9 @@ try {
     await pause(400);
   }
   assert(
-    evidence.requests.some((request) => request.method === 'POST' && request.path === '/v1/messages'),
+    evidence.requests.some(
+      (request) => request.method === 'POST' && request.path === '/v1/messages'
+    ),
     'The existing direct-credential diagnostic did not finish'
   );
   await cdp.wait(
@@ -480,12 +490,14 @@ try {
   evidence.error = redact(error?.stack ?? error);
   if (cdp) {
     try {
-      evidence.failureUi = (await cdp.evaluate(`(() =>
+      evidence.failureUi = (
+        await cdp.evaluate(`(() =>
         (document.querySelector('[role=dialog]')?.innerText ?? '')
           .split('\\n').map((line) => line.trim())
           .filter((line) => /selected provider|selected model|issue684-compatible-model|checking|preflight|anthropic/i.test(line))
           .slice(-24)
-      )()`)).map(redact);
+      )()`)
+      ).map(redact);
     } catch {
       // The renderer may have exited before diagnostics are collected.
     }
```

**File**: `scripts/e2e/change-review-hunk-desktop.mjs` (modified, +5/-1)
```diff
@@ -1188,7 +1188,11 @@ async function main() {
     );
     const reviewCloseButton = `Array.from(document.querySelectorAll('h2'))
       .find((heading) => heading.textContent?.startsWith('Changes for task #'))
-      ?.parentElement?.parentElement?.querySelector('button')`;
+      ?.parentElement?.parentElement?.querySelector('button[aria-label="Close Changes"]')`;
+    await client.waitFor(
+      `(${reviewCloseButton}) && !(${reviewCloseButton}).disabled`,
+      'enabled Changes close button'
+    );
     await client.domClick(reviewCloseButton);
     await client.waitFor(
       `!Array.from(document.querySelectorAll('h2'))
```

**File**: `scripts/e2e/opencode-without-cursor-desktop.mjs` (modified, +8/-44)
```diff
@@ -146,20 +146,6 @@ async function click(selector) {
   // this dev window. The repository's existing desktop E2E uses DOM activation.
   await cdp.inspect(`document.querySelector(${jsLiteral(selector)}).click()`);
 }
-async function openModelsTab() {
-  const selector = '[data-testid=runtime-provider-tab-providers]';
-  await waitFor(`Boolean(document.querySelector(${jsLiteral(selector)})?.previousElementSibling) && !document.querySelector(${jsLiteral(selector)}).previousElementSibling.disabled`, 'enabled Models tab');
-  // Radix Tabs switches on mousedown; HTMLElement.click() emits only click.
-  await cdp.inspect(`(() => { const tab = document.querySelector(${jsLiteral(selector)}).previousElementSibling; tab.dispatchEvent(new MouseEvent('mousedown', {bubbles:true,button:0})); tab.click(); })()`);
-  await waitFor('Boolean(document.querySelector("[data-testid=opencode-default-inheritance]"))', 'default model settings');
-}
-async function readPersistedDefault() {
-  const { stdout } = await execFileAsync(launcherPath, [
-    'runtime', 'providers', 'view', '--runtime', 'opencode',
-    '--project-path', data.project, '--json',
-  ], { cwd: data.project, env, timeout: 90_000, maxBuffer: 4 * 1024 * 1024 });
-  return JSON.parse(stdout).view;
-}
 async function cleanupSandboxHosts() {
   const input = path.join(root, 'cleanup-hosts.json');
   await save('cleanup-hosts.json', JSON.stringify({
@@ -248,37 +234,15 @@ try {
     await waitFor('Boolean(document.querySelector("[data-testid=runtime-provider-directory-row-openrouter]"))', 'OpenRouter provider');
     await screenshot('directory.png');
     assert(!(await cdp.inspect('document.body.innerText.includes("Managed Cursor requires an absolute native executable")')));
-    // OpenRouter is visible but needs an API key in this empty sandbox.
-    await waitFor('Boolean(document.querySelector("[data-testid=runtime-provider-directory-row-atomic-chat-header]"))', 'Atomic Chat provider');
-    await openModelsTab();
-    await click('[data-testid=opencode-default-inheritance] button');
-    await waitFor('Boolean(document.querySelector("[data-testid=opencode-default-target-banner]"))', 'all-projects model picker');
-    // Connected OpenCode Zen models can be selected without inference.
-    const selectableContent = '[data-testid="runtime-provider-directory-row-opencode-content"]';
-    if (!(await cdp.inspect(`Boolean(document.querySelector(${jsLiteral(selectableContent)}))`))) {
-      await click('[data-testid="runtime-provider-directory-row-opencode-header"]');
-    }
-    await waitFor(`Boolean(document.querySelector(${jsLiteral(selectableContent)} + ' [data-testid=runtime-provider-model-list]'))`, 'OpenCode Zen model list');
-    await waitFor(`document.querySelectorAll(${jsLiteral(selectableContent)} + ' [data-testid^=runtime-provider-model-row-]').length > 0`, 'OpenCode Zen model rows');
-    const modelIds = await cdp.inspect(`Array.from(document.querySelectorAll(${jsLiteral(selectableContent)} + ' [data-testid^=runtime-provider-model-row-]')).map(item => item.dataset.testid)`);
-    const availableSelect = `${selectableContent} [data-testid^=runtime-provider-model-row-] button[aria-pressed="false"]:not([disabled])`;
-    await waitFor(`Boolean(document.querySelector(${jsLiteral(availableSelect)}))`, 'non-Cursor selectable model');
-    const selectedModelId = (await cdp.inspect(`document.querySelector(${jsLiteral(availableSelect)}).closest('[data-testid^=runtime-provider-model-row-]').dataset.testid`))
-      .slice('runtime-provider-model-row-'.length);
-    await click(availableSelect);
-    const selectedRow = `${selectableContent} [data-testid=${JSON.stringify(`runtime-provider-model-row-${selectedModelId}`)}] button[aria-pressed="true"]`;
-    await waitFor(`Boolean(document.querySelector(${jsLiteral(selectedRow)}))`, 'default model saved');
-    await openModelsTab();
-    await waitFor(`document.querySelector('[data-testid=opencode-default-inheritance]')?.textCon
```

**File**: `scripts/e2e/team-direct-chats-desktop.mjs` (modified, +183/-29)
```diff
@@ -60,9 +60,46 @@ async function assertRuntimeAudit(fixture) {
     .filter(Boolean)
     .map((line) => JSON.parse(line));
   assert(
-    invocations.every(
-      ({ args }) => Array.isArray(args) && args.length === 1 && args[0] === '--version'
-    ),
+    invocations.every(({ args, outcome, bridgeCommand }) => {
+      if (!Array.isArray(args)) return false;
+      if (args.length === 1 && args[0] === '--version') return outcome === 'version';
+      if (outcome !== 'denied') return false;
+      if (
+        args.length === 11 &&
+        args[0] === 'runtime' &&
+        args[1] === 'providers' &&
+        args[2] === 'directory' &&
+        args[3] === '--runtime' &&
+        args[4] === 'opencode' &&
+        args[5] === '--json' &&
+        args[6] === '--summary' &&
+        args[7] === '--filter' &&
+        args[8] === 'all' &&
+        args[9] === '--limit' &&
+        args[10] === '100'
+      )
+        return true;
+      if (
+        args.length === 6 &&
+        args[0] === 'runtime' &&
+        args[1] === 'status' &&
+        args[2] === '--json' &&
+        args[3] === '--provider' &&
+        ['anthropic', 'opencode', 'codex'].includes(args[4]) &&
+        args[5] === '--summary'
+      )
+        return true;
+      return (
+        args.length === 7 &&
+        args[0] === 'runtime' &&
+        args[1] === 'opencode-command' &&
+        args[2] === '--json' &&
+        args[3] === '--input' &&
+        args[5] === '--output' &&
+        args[6] === `${args[4]}.output.json` &&
+        ['opencode.cleanupHosts', 'opencode.cleanupStartupHosts'].includes(bridgeCommand)
+      );
+    }),
     `fixture runtime received a forbidden command: ${JSON.stringify(invocations)}`
   );
 }
@@ -111,6 +148,34 @@ async function pressKey(client, key, code = key) {
   });
 }
 
+async function waitForDesktopStartup(client, label, timeoutMs = 60_000) {
+  const deadline = Date.now() + timeoutMs;
+  let lastTransientError = null;
+  while (Date.now() < deadline) {
+    try {
+      if (
+        await client.evaluate(
+          '(async () => Boolean((await window.electronAPI?.startup?.getStatus?.())?.ready))()'
+        )
+      )
+        return;
+      lastTransientError = null;
+    } catch (error) {
+      if (
+        !/execution context was destroyed|cannot find (?:default )?execution context|cannot find context with specified id/i.test(
+          String(error)
+        )
+      )
+        throw error;
+      lastTransientError = error;
+    }
+    await new Promise((resolve) => setTimeout(resolve, 50));
+  }
+  throw new Error(
+    `Timed out waiting for ${label}${lastTransientError ? `: ${String(lastTransientError)}` : ''}`
+  );
+}
+
 function rememberAppLog(chunk, stream) {
   const text = chunk.toString();
   const lines = `${appLogRemainder[stream]}${text}`.split(/\r?\n/);
@@ -182,9 +247,14 @@ async function seedFixture() {
   await writeFile(
     fixture.runtimeWrapperPath,
     `#!${nodeBinary}\n'use strict';\n` +
-      `const { appendFileSync } = require('node:fs');\n` +
+      `const { appendFileSync, readFileSync } = require('node:fs');\n` +
       `const args = process.argv.slice(2);\n` +
-      `appendFileSync(${JSON.stringify(fixture.runtimeAuditPath)}, JSON.stringify({ args }) + '\\n');\n` +
+      `const version = args.length === 1 && args[0] === '--version';\n` +
+      `let bridgeCommand;\n` +
+      `if (args[0] === 'runtime' && args[1] === 'opencode-command' && args[3] === '--input') {\n` +
+      `  try { bridgeCommand = JSON.parse(readFileSync(args[4], 'utf8')).command; } catch {}\n` +
+      `}\n` +
+      `appendFileSync(${JSON.stringify(fixture.runtimeAuditPath)}, JSON.stringify({ args, outcome: version ? 'version' : 'denied', bridgeCommand }) + '\\n');\n` +
       `if (args.length === 1 && args[0] === '--version') {\n` +
       `  process.stdout.write(${JSON.stringify(`${runtimeLock.version}\n`)});\n` +
       `  process.exit(0);\n` +
@@ -538,13 +608,15 @@ async function main() {
   
```

---

### Incident Patch 6: `70f0e7b7` (2026-09-29)
**Commit Message**: fix(sponsor): enable Fluxion banner (#775)

**File**: `package.json` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@
   "type": "module",
   "version": "2.1.2",
   "dynamicFlags": {
-    "showSponsorFluxion": false
+    "showSponsorFluxion": true
   },
   "description": "Desktop app for managing AI agent teams, reviews, runtime logs, and provider-aware workflows",
   "license": "AGPL-3.0",
```

---

### Incident Patch 7: `b8d24d12` (2026-09-29)
**Commit Message**: fix(review): pin trusted ReviewRouter action

Pin the ReviewRouter reusable review, runtime ref, and scheduled refresh Action to the trusted immutable SHA. This permits the supported default-branch workflow activation before a fresh exact-head review of Product PR #252.

Refs #252
Refs 777genius/review-router-ai#479

**File**: `.github/workflows/reviewrouter-codex.yml` (modified, +3/-3)
```diff
@@ -21,9 +21,9 @@ jobs:
       contents: read
       pull-requests: read
       id-token: write
-    uses: 777genius/review-router/.github/workflows/reviewrouter-t0-reusable.yml@2cecf3249a4e4d02eb6bc629d0752773ba58690d
+    uses: 777genius/review-router/.github/workflows/reviewrouter-t0-reusable.yml@b951d16fb0a96cc377578a6f69be7112badd8e33
     with:
-      runtime_ref: "2cecf3249a4e4d02eb6bc629d0752773ba58690d"
+      runtime_ref: "b951d16fb0a96cc377578a6f69be7112badd8e33"
       api_url: "https://api.reviewrouter.site"
       runtime_config_mode: oidc
       pr_number: ${{ format('{0}', github.event.pull_request.number) }}
@@ -48,7 +48,7 @@ jobs:
     steps:
       - name: ReviewRouter Codex OAuth refresh
         id: refresh_codex
-        uses: 777genius/review-router@2cecf3249a4e4d02eb6bc629d0752773ba58690d
+        uses: 777genius/review-router@b951d16fb0a96cc377578a6f69be7112badd8e33
         with:
           mode: codex-oauth-refresh
           api-url: "https://api.reviewrouter.site"
```

---

### Incident Patch 8: `f8e3630b` (2026-09-28)
**Commit Message**: fix(dashboard): merge Cursor quick-connect ordering (#771)

Refs #765

**File**: `src/features/runtime-provider-management/renderer/RuntimeProviderQuickConnect.tsx` (modified, +1/-1)
```diff
@@ -145,12 +145,12 @@ const OPEN_CODE_GATEWAYS: readonly OpenCodeGatewayDefinition[] = [
 ];
 
 const QUICK_CONNECT_CARD_ORDER = [
-  'cursor',
   'github-copilot',
   'supergrok',
   'zai-coding-plan',
   'kimi-code-membership',
   'kiro',
+  'cursor',
   'minimax-token-plan',
   'xiaomi-mimo-token-plan',
   'openrouter',
```

---

### Incident Patch 9: `b627233d` (2026-09-28)
**Commit Message**: test(e2e): merge missing-Cursor regression coverage (#770)

Refs #765

**File**: `scripts/e2e/opencode-without-cursor-desktop.mjs` (added, +340/-0)
```diff
@@ -0,0 +1,340 @@
+#!/usr/bin/env node
+// Real runtime + OpenCode, disposable data, no team launch or model inference.
+import assert from 'node:assert/strict';
+import { execFile, spawn } from 'node:child_process';
+import { randomUUID } from 'node:crypto';
+import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
+import os from 'node:os';
+import path from 'node:path';
+import { fileURLToPath } from 'node:url';
+import { promisify } from 'node:util';
+import { connectCdp } from './announcements/cdp.mjs';
+import {
+  assertListenerOwnership,
+  assertPortAvailable,
+  isolatedEnvironment,
+  listeners,
+  ownedTree,
+  processes,
+  sameIdentity,
+} from './opencode-diagnostics/platform.mjs';
+
+const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
+const execFileAsync = promisify(execFile);
+const options = new Map();
+for (let index = 2; index < process.argv.length; index += 2) {
+  assert(process.argv[index]?.startsWith('--') && process.argv[index + 1], 'Expected --key value');
+  options.set(process.argv[index], process.argv[index + 1]);
+}
+for (const key of options.keys()) {
+  assert(['--runtime', '--opencode', '--cursor-assets', '--expect', '--reuse-root'].includes(key), `Unknown ${key}`);
+}
+const runtime = await realpath(options.get('--runtime') || '');
+const opencode = await realpath(options.get('--opencode') || '');
+const cursorAssets = await realpath(options.get('--cursor-assets') || '');
+const expected = options.get('--expect') || 'ready';
+assert(['ready', 'cursor-error'].includes(expected));
+assert.equal(process.platform, 'darwin', 'Managed Cursor assets are macOS-only');
+await assertPortAvailable();
+const root = options.has('--reuse-root')
+  ? await realpath(options.get('--reuse-root'))
+  : await realpath(await mkdtemp(path.join(os.tmpdir(), 'opencode-without-cursor-e2e-')));
+if (options.has('--reuse-root')) {
+  assert(path.basename(root).startsWith('opencode-without-cursor-e2e-'), 'Expected disposable E2E root');
+  assert(root.startsWith(await realpath(os.tmpdir()) + path.sep), 'Reusable root must be under tmp');
+  const previous = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
+  assert.equal(previous.root, root, 'Reusable root manifest mismatch');
+  assert.equal(previous.project, path.join(root, 'sandbox'), 'Reusable project mismatch');
+}
+// A failed rerun must never leave a previous PASS beside its new failure logs.
+await rm(path.join(root, 'result.json'), { force: true });
+const data = {
+  root, home: path.join(root, 'home'), userData: path.join(root, 'user-data'),
+  bin: path.join(root, 'bin'), temp: path.join(root, 'tmp'), node: process.execPath,
+  orchestrator: runtime, opencode, project: path.join(root, 'sandbox'),
+};
+async function ensureSandboxDirectory(directory) {
+  await mkdir(directory, { recursive: true });
+  assert.equal(await realpath(directory), directory, 'Sandbox directory escaped through a symlink');
+}
+for (const target of [data.home, data.userData, data.bin, data.temp, data.project]) {
+  await ensureSandboxDirectory(target);
+}
+const claudeRoot = path.join(data.home, '.claude');
+await ensureSandboxDirectory(claudeRoot);
+await writeFile(path.join(data.project, 'README.md'), '# Issue 765 disposable sandbox\n');
+await writeFile(path.join(claudeRoot, 'agent-teams-config.json'), JSON.stringify({
+  general: { appLocale: 'en', agentLanguage: 'en', theme: 'dark', defaultTab: 'dashboard' },
+}));
+const projectDir = path.join(claudeRoot, 'projects', data.project.replace(/[/\\]/g, '-'));
+await ensureSandboxDirectory(projectDir);
+await writeFile(path.join(projectDir, 'issue765.jsonl'), JSON.stringify({
+  type: 'user', cwd: data.project, sessionId: 'issue765-sandbox',
+  timestamp: new Date().toISOString(), isMeta: false,
+  message: { role: 'user', content: 'Issue 765 test fixture' },
+}) + '\n');
+const manifestPath = path.join(data.userData, 'data/runtimes/opencode/current.json'
```

---

### Incident Patch 10: `f7188c05` (2026-09-28)
**Commit Message**: fix(dashboard): move Cursor provider to sixth position

**File**: `src/features/runtime-provider-management/renderer/RuntimeProviderQuickConnect.tsx` (modified, +1/-1)
```diff
@@ -145,12 +145,12 @@ const OPEN_CODE_GATEWAYS: readonly OpenCodeGatewayDefinition[] = [
 ];
 
 const QUICK_CONNECT_CARD_ORDER = [
-  'cursor',
   'github-copilot',
   'supergrok',
   'zai-coding-plan',
   'kimi-code-membership',
   'kiro',
+  'cursor',
   'minimax-token-plan',
   'xiaomi-mimo-token-plan',
   'openrouter',
```

#### Recent Merged Pull Requests:
- **PR #781** (2026-09-30): fix(runtime): prevent legacy CLI selection and status refresh loops (@777genius)
- **PR #780** (2026-09-30): fix(deps): clear high-severity audit findings (@777genius)
- **PR #779** (2026-09-30): fix(landing): lead screenshots with team chat (@777genius)
- **PR #777** (2026-09-29): fix(landing): use unique chat screenshot asset URLs (@777genius)
- **PR #776** (2026-09-29): test(runtime-provider): settle virtualizer timer before DOM teardown (@777genius)
- **PR #775** (2026-09-29): fix(sponsor): enable Fluxion banner (@777genius)
- **PR #774** (2026-09-29): feat(landing): lead gallery with organization map and expand providers (@777genius)
- **PR #773** (2026-09-29): fix(review): pin trusted ReviewRouter action (@777genius)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
