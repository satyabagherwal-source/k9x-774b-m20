# Forensic Learning Record (Deep Inspection): totec448-spec/chat-on-steroids

> **Canonical Artifact**: `07_PROJECT_LEARNING/totec448-spec-chat-on-steroids-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/totec448-spec/chat-on-steroids](https://github.com/totec448-spec/chat-on-steroids))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:02:27.546Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `totec448-spec/chat-on-steroids`
- **Description**: Cross-platform local MCP capabilities for ChatGPT with Chrome integration, Goal, Compact & Resume, and durable multi-agent workflows.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 4242 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `scripts/install-git-hooks.mjs`
```
import { spawnSync } from 'node:child_process';

const result = spawnSync('git', ['config', 'core.hooksPath', '.githooks'], {
  cwd: process.cwd(),
  encoding: 'utf8',
  windowsHide: true,
});

if (result.status !== 0) {
  const detail = String(result.stderr ?? '').trim();
  throw new Error(`Could not configure the repository hooks${detail ? `: ${detail}` : ''}`);
}

console.log('Installed repository Git hooks from .githooks/.');

```

### Core Architecture Module: `scripts/macos-audit-utils.mjs`
```
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function compareVersions(left, right) {
  const a = String(left).split('.').map((part) => Number.parseInt(part, 10));
  const b = String(right).split('.').map((part) => Number.parseInt(part, 10));
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index++) {
    const av = Number.isFinite(a[index]) ? a[index] : 0;
    const bv = Number.isFinite(b[index]) ? b[index] : 0;
    if (av !== bv) return av < bv ? -1 : 1;
  }
  return 0;
}

/**
 * Run an otool inspection without handing otool-classic a parenthesized pathname.
 *
 * Xcode's classic otool parser treats `file(member)` as archive-member syntax. Electron's
 * nested helpers are legitimately named e.g. `Chat On Steroids Helper (GPU)`, so passing that
 * pathname directly makes otool strip the parenthesized suffix and report a nonexistent file.
 * A temporary symlink with a parser-safe basename keeps the bytes and audit semantics identical
 * without modifying the packaged bundle.
 */
export function withOtoolSafePath(file, inspect, overrides = {}) {
  if (!/[()]/.test(file)) return inspect(file);

  const temporaryDirectory = (overrides.mkdtempSync ?? mkdtempSync)(
    path.join(overrides.tmpdir ?? os.tmpdir(), 'cos-otool-')
  );
  const alias = path.join(temporaryDirectory, 'payload');
  try {
    (overrides.symlinkSync ?? symlinkSync)(file, alias);
    return inspect(alias);
  } finally {
    (overrides.rmSync ?? rmSync)(temporaryDirectory, { recursive: true, force: true });
  }
}

/** Extract every macOS deployment floor encoded in `otool -l` output. */
export function macOSDeploymentTargetsFromOtool(output) {
  const targets = [];
  let command = null;
  let platform = null;

  for (const line of String(output).split(/\r?\n/)) {
    const commandMatch = line.match(/^\s*cmd\s+(LC_[A-Z0-9_]+)/);
    if (commandMatch) {
      command = commandMatch[1];
      platform = null;
      continue;
    }

    if (command === 'LC_BUILD_VERSION') {
      const platformMatch = line.match(/^\s*platform\s+(\S+)/i);
      if (platformMatch) {
        platform = platformMatch[1].toLowerCase();
        continue;
      }
      const minosMatch = line.match(/^\s*minos\s+(\d+(?:\.\d+)*)/i);
      if (minosMatch) {
        // `otool` prints numeric platform 1 on older Xcode and `macos` on newer versions.
        if (platform == null || platform === '1' || platform === 'macos') targets.push(minosMatch[1]);
      }
      continue;
    }

    if (command === 'LC_VERSION_MIN_MACOSX') {
      const versionMatch = line.match(/^\s*version\s+(\d+(?:\.\d+)*)/i);
      if (versionMatch) targets.push(versionMatch[1]);
    }
  }

  return targets;
}

export function assertCompatibleMacOSDeploymentTargets(file, otoolOutput, declaredMinimum) {
  const targets = macOSDeploymentTargetsFromOtool(otoolOutput);
  if (targets.length === 0) throw new Error(`${file} has no macOS deployment target load command`);
  for (const target of targets) {
    if (compareVersions(target, declaredMinimum) > 0) {
      throw new Error(
        `${file} requires macOS ${target}, newer than Info.plist LSMinimumSystemVersion ${declaredMinimum}`
      );
    }
  }
  return targets;
}

/**
 * Enforce the release's "unsigned" policy without rejecting Apple-Silicon ad-hoc signatures.
 *
 * arm64 Mach-O executables can carry an ad-hoc LC_CODE_SIGNATURE even when the application has
 * never been signed by a Developer ID. `codesign --display` may therefore succeed for a bundle
 * whose publisher identity is still untrusted. A trust-bearing signature instead exposes an
 * Authority chain and/or a real TeamIdentifier.
 *
 * The resource envelope is now required rather than forbidden, which is the opposite of what this
 * asserted before. That inversion was issue #66: arm64 Mach-Os are ad-hoc signed by the linker
 * whether anyone asks or not, so a bundle without CodeResources is one whose executables claim a
 * resource seal the bundle does not have. macOS reads that contradiction as damage and refuses to
 * launch, with Gatekeeper assessment disabled and no crash report to show for it. Demanding the
 * absence of a seal made the broken artifact the compliant one, and two releases shipped it.
 *
 * Coherent and untrusted are different axes. Only the second is the policy, and it is still
 * enforced below.
 */
export function assertNoTrustBearingMacCodeSignature(file, codesignResult, hasCodeResources = false) {
  if (!hasCodeResources) {
    throw new Error(
      `${file} has no bundle CodeResources envelope; macOS reads an ad-hoc linker-signed bundle ` +
        'without one as damaged. The afterPack ad-hoc seal should have created it.'
    );
  }

  const output = `${codesignResult.stdout ?? ''}\n${codesignResult.stderr ?? ''}`;
  if (codesignResult.status !== 0) {
    if (codesignResult.status === 1 && /code object is not signed(?: at all)?/i.test(output)) return;
    throw new Error(`${file} code-signature inspection failed unexpectedly (status ${codesignResult.status ?? 'null'})`);
  }

  const adHoc = /^Signature=adhoc\s*$/m.test(output);
  const authority = /^Authority=/m.test(output);
  const teamMatch = output.match(/^TeamIdentifier=(.+)$/m);
  const trustedTeam = teamMatch != null && teamMatch[1].trim() !== 'not set';
  if (!adHoc || authority || trustedTeam) {
    throw new Error(`${file} unexpectedly has a trust-bearing code signature; release metadata says unsigned`);
  }
}

```

### Core Architecture Module: `src/main/cos-browser/extension-worker.ts`
```
/**
 * The app's link to the companion extension's service worker inside the CoS browser.
 *
 * Three Chrome behaviours the companion depends on are not Electron's, and this module supplies
 * them:
 *   · Chrome keeps an extension worker alive while its WebSocket is active. The companion's wake
 *     channel is such a socket, but Electron stops an idle worker after 30 seconds anyway, which
 *     closed that channel and left new chats waiting. The link holds every running worker alive
 *     and starts a stopped one again.
 *   · Chrome wakes a stopped worker to deliver its events. The link queues events while no worker
 *     can take them, starts one, and delivers in order once its script has run (only then do its
 *     listeners exist).
 *   · Chrome fires `runtime.onStartup` when the browser starts; the host sends it through here.
 *
 * Nothing here imports Electron: the worker and its registry are the small interfaces below.
 */

export interface WorkerLike {
  readonly scope: string;
  isDestroyed(): boolean;
  send(channel: string, ...args: unknown[]): void;
  startTask(): { end(): void };
  readonly ipc: {
    handle(channel: string, listener: (event: unknown, ...args: unknown[]) => unknown): void;
    removeHandler(channel: string): void;
  };
}

export interface WorkerRegistry {
  getWorkerFromVersionID(versionId: number): WorkerLike | undefined;
  getAllRunning(): Record<number, unknown>;
  startWorkerForScope(scope: string): Promise<unknown>;
}

export type WorkerStatus = 'starting' | 'running' | 'stopping' | 'stopped';

export const EVENT_CHANNEL = 'cos-browser:event';
export const API_CHANNEL = 'cos-browser:api';
/** Events waiting for a worker. A worker that never comes back must not grow memory without bound. */
export const PENDING_EVENT_LIMIT = 1000;
const WAKE_RETRY_MS = 1000;

export class ExtensionWorkerLink {
  private readonly workers = new Map<number, WorkerLike>();
  private readonly ready = new Set<number>();
  private readonly keepAlive = new Map<number, { end(): void }>();
  private readonly pending: Array<[string, unknown[]]> = [];
  private dropped = 0;
  private closed = false;

  constructor(
    private readonly registry: WorkerRegistry,
    /** `chrome-extension://<id>/`: only this extension's worker is ever linked. */
    private readonly scope: string,
    private readonly answer: (name: string, args: unknown) => Promise<unknown>,
    private readonly warn: (message: string) => void
  ) {
    for (const versionId of Object.keys(registry.getAllRunning())) this.statusChanged(Number(versionId), 'running');
  }

  statusChanged(versionId: number, status: WorkerStatus): void {
    if (this.closed) return;
    if (status === 'starting' || status === 'running') { this.attach(versionId, status === 'running'); return; }
    // A stopping worker takes no more events; it stays linked until it has stopped.
    this.ready.delete(versionId);
    this.keepAlive.delete(versionId);
    if (status === 'stopping') return;
    // A running browser keeps its extension running.
    if (this.workers.delete(versionId)) this.wake();
  }

  /** Delivers an extension event now, or as soon as a worker can take it. */
  send(name: string, args: unknown[]): void {
    if (this.closed) return;
    const live = this.live();
    if (live.length > 0 && this.pending.length === 0) {
      for (const worker of live) worker.send(EVENT_CHANNEL, name, args);
      return;
    }
    if (this.pending.length < PENDING_EVENT_LIMIT) this.pending.push([name, args]);
    else if (this.dropped++ === 0) this.warn(`cos browser: the extension worker is not taking events; dropping ${name} and later ones until it does`);
    if (this.workers.size === 0) this.wake();
  }

  /** Releases every worker the link holds alive. The browser is stopping. */
  close(): void {
    this.closed = true;
    for (const task of this.keepAlive.values()) {
      try { task.end(); } catch { /* the worker is already gone */ }
    }
    this.keepAlive.clear();
    this.workers.clear();
    this.ready.clear();
    this.pending.length = 0;
  }

  private attach(versionId: number, running: boolean): void {
    const worker = this.registry.getWorkerFromVersionID(versionId);
    if (!worker || worker.isDestroyed() || worker.scope !== this.scope) return;
    if (this.workers.get(versionId) !== worker) {
      this.workers.set(versionId, worker);
      // A worker that outlived an earlier link still holds that link's handler.
      worker.ipc.removeHandler(API_CHANNEL);
      worker.ipc.handle(API_CHANNEL, (_event, name, args) => this.answer(String(name), args));
    }
    if (!running) return;
    if (!this.keepAlive.has(versionId)) {
      try { this.keepAlive.set(versionId, worker.startTask()); }
      catch (error) { this.warn(`cos browser: could not keep the extension worker alive: ${error instanceof Error ? error.message : String(error)}`); }
    }
    this.ready.add(versionId);
    this.flush();
  }

  private live(): WorkerLike[] {
    return [...this.workers].filter(([id, worker]) => this.ready.has(id) && !worker.isDestroyed()).map(([, worker]) => worker);
  }

  private flush(): void {
    const live = this.live();
    if (live.length === 0 || this.pending.length === 0) return;
    if (this.dropped > 0) { this.warn(`cos browser: the extension worker is back; ${this.dropped} event(s) were dropped meanwhile`); this.dropped = 0; }
    for (const [name, args] of this.pending.splice(0)) for (const worker of live) worker.send(EVENT_CHANNEL, name, args);
  }

  /**
   * Starts the worker. A start that races Electron's own (right after the extension loads) is
   * refused although a worker is on its way, so a refusal only counts once a second attempt,
   * made while still no worker has appeared, fails too.
   */
  private wake(retried = false): void {
    void this.registry.startWorkerForScope(this.scope).catch(error => {
      if (this.closed || this.workers.size > 0) return;
      if (!retried) { setTimeout(() => { if (!this.closed && this.workers.size === 0) this.wake(true); }, WAKE_RETRY_MS); return; }
      this.warn(`cos browser: could not start the extension worker: ${error instanceof Error ? error.message : String(error)}`);
    });
  }
}

```

### Core Architecture Module: `src/main/mcp/code-mode-worker.ts`
```
import { WINDOWS_COMPUTER_METHODS } from '../../shared/windows-computer.js';

/** Trusted worker bootstrap. Model source runs only inside the bounded QuickJS WASM heap,
 * never in Node's evaluator. The bridge copies JSON strings; no host object enters QuickJS. */
export const CODE_MODE_WORKER_SOURCE = String.raw`
const { parentPort, workerData } = require('node:worker_threads');
const { newQuickJSWASMModuleFromVariant } = require(workerData.coreModule);
const variant = require(workerData.wasmModule).default;
let closed = false;
const send = message => { if (!closed) parentPort.postMessage(message); };
function finish(error) { if (closed) return; send({ type: 'done', error }); closed = true; }
(async () => {
  const QuickJS = await newQuickJSWASMModuleFromVariant(variant);
  const runtime = QuickJS.newRuntime();
  runtime.setMemoryLimit(workerData.limits.memoryBytes);
  runtime.setMaxStackSize(512 * 1024);
  const vm = runtime.newContext();
  let usedCpu = 0, sliceStart = 0, fatal = null, nextId = 0, emitted = 0, outputBytes = 0;
  const pending = new Map();
  runtime.setInterruptHandler(() => usedCpu + performance.now() - sliceStart > workerData.limits.cpuMs);
  const enter = fn => { sliceStart = performance.now(); try { return fn(); } finally { usedCpu += performance.now() - sliceStart; } };
  const bridge = vm.newFunction('__bridge', (operation, payload) => {
    const kind = vm.getString(operation), json = vm.getString(payload);
    if (fatal) return { error: vm.newError('Script limit reached') };
    if (kind === 'exit') { finish(null); return vm.undefined; }
    if (closed) return { error: vm.newError('Script closed') };
    if (kind === 'call') {
      if (++nextId > workerData.limits.calls || pending.size >= workerData.limits.concurrentCalls || Buffer.byteLength(json) > workerData.limits.argumentBytes) {
        fatal = 'CALL_LIMIT'; return { error: vm.newError('Call limit') };
      }
      const promise = vm.newPromise();
      pending.set(nextId, promise);
      send({ type: 'call', id: nextId, json });
      return promise.handle.dup();
    }
    if (kind === 'text' || kind === 'image') {
      const size = Buffer.byteLength(json);
      outputBytes += size;
      if (++emitted > workerData.limits.outputItems || size > workerData.limits.resultBytes || outputBytes > workerData.limits.outputBytes) {
        fatal = 'OUTPUT_LIMIT'; return { error: vm.newError('Output limit') };
      }
      send({ type: 'emit', kind, json });
      return vm.undefined;
    }
    fatal = 'BRIDGE_ERROR'; return { error: vm.newError('Invalid bridge operation') };
  });
  vm.setProp(vm.global, '__bridge', bridge); bridge.dispose();
  const setup = enter(() => vm.evalCode('(() => { ' +
    'const bridge = globalThis.__bridge; delete globalThis.__bridge; ' +
    'const stringify = JSON.stringify, parse = JSON.parse, String_ = String; ' +
    'const tools = Object.create(null); ' +
    'const entries = ' + JSON.stringify(workerData.tools) + '; ' +
    'for (const entry of entries) { Object.freeze(entry); tools[entry.name] = args => bridge("call", stringify({name:entry.name,args})).then(parse); } ' +
    'Object.defineProperties(globalThis, {' +
      'tools: {value:Object.freeze(tools)}, ALL_TOOLS:{value:Object.freeze(entries)}, ' +
      'text:{value:value => bridge("text", stringify(typeof value === "string" ? value : (stringify(value) ?? String_(value))))}, ' +
      'image:{value:value => bridge("image", stringify(value))}, ' +
      'exit:{value:() => { bridge("exit", "null"); throw undefined; }}' +
    '}); ' +
    (workerData.windowsDesktop ?
      'const sky = Object.create(null); ' +
      'for (const name of ${JSON.stringify(WINDOWS_COMPUTER_METHODS)}) { if (!tools[name]) continue; ' +
        'sky[name] = async (args = {}) => { const result = await tools[name](args); ' +
          'if (result.isError) { const message = (result.content || []).filter(item => item.type === "text").map(item => item.text).join("\\n"); ' +
            'text(message); throw new Error(message || "Desktop operation failed"); } ' +
          'if (!result.structuredContent || !("value" in result.structuredContent)) throw new Error("Invalid Desktop result"); ' +
          'const value = result.structuredContent.value; ' +
          'if (name === "get_window_state") { for (const part of result.content) { if (part.type === "image") image(part); } } ' +
          'return value === null ? undefined : value; }; } ' +
      'sky.target = "windows"; Object.defineProperties(globalThis, {sky:{value:Object.freeze(sky)}, nodeRepl:{value:Object.freeze({write:text})}}); '
      : '') +
    '})()'));
  if (setup.error) { setup.error.dispose(); finish('RUNTIME_ERROR'); return; }
  setup.value.dispose();
  let execution;
  const check = () => {
    if (closed) return;
    if (fatal) { finish(fatal); return; }
    if (usedCpu > workerData.limits.cpuMs) { finish('CPU_LIMIT'); return; }
    const jobs = enter(() => runtime.executePendingJobs(64));
    if (jobs.error) { jobs.error.dispose(); finish(usedCpu > workerData.limits.cpuMs ? 'CPU_LIMIT' : 'SCRIPT_ERROR'); return; }
    const state = enter(() => vm.getPromiseState(execution));
    if (state.type === 'rejected') { state.error.dispose(); finish(fatal || (usedCpu > workerData.limits.cpuMs ? 'CPU_LIMIT' : 'SCRIPT_ERROR')); return; }
    if (state.type === 'fulfilled') { state.value.dispose(); finish(fatal); return; }
    if (runtime.hasPendingJob()) setImmediate(check);
  };
  parentPort.on('message', message => {
    if (closed || message.type !== 'result') return;
    const promise = pending.get(message.id);
    if (!promise) return;
    pending.delete(message.id);
    enter(() => {
      const value = vm.newString(message.json);
      promise.resolve(value); value.dispose(); promise.dispose();
    });
    check();
  });
  const evaluated = enter(() => vm.evalCode(workerData.code, 'code-mode.mjs', { type: 'module' }));
  if (evaluated.error) { evaluated.error.dispose(); finish(fatal || (usedCpu > workerData.limits.cpuMs ? 'CPU_LIMIT' : 'PARSE_ERROR')); return; }
  execution = evaluated.value;
  check();
})().catch(() => finish('RUNTIME_ERROR'));
`;

```

### Core Architecture Module: `src/main/mcp/tools-core.ts`
```
import { toolDeclaration } from './tool-declarations.js';
import { registerPlanTool } from './plan-tool.js';
import { goalWorkerChat, imageExportCapable } from '../bridge.js';
import { exportImage, ImageExportError } from '../image-export.js';
import { awaitRequestCorrelation } from '../session/correlation.js';
import { announceSessionFinish, sessionFinishDeadline } from '../session/finish.js';
import { getConfig } from '../config.js';
import { connectorName } from '../../shared/connector-names.js';
/**
 * The Core connector: reading, changing and running code on this PC.
 *
 * A no-query discovery returns every exposed schema here at once. Keep the surface
 * bounded and derive its count from the live declarations in surfaces.ts.
 *
 * The surface separates primitives from procedures: `exec_command` can run git, so `git`
 * is a skill rather than a tool; `read` can open a directory, a text file or an image,
 * because those are three shapes of one question. Anything that reads as "and also, for
 * this special case…" belongs in a skill over these primitives, not in a schema every
 * conversation pays for.
 */

import { rawPromises as fs } from '../rawfs.js';
import nodeFs from 'node:fs';
import nodePath from 'node:path';
import { z } from 'zod';
import { DEFAULT_READ_BYTES, MAX_READ_BYTES, formatBytes } from '../fsops.js';
import { BinaryReadError, listDirectoryLevel, readTextFile, statInfo, walkFiles } from '../codex/read-backend.js';
import {
  VIEW_IMAGE_DESCRIPTION,
  VIEW_IMAGE_PATH_DESCRIPTION,
  ViewImageError,
  viewImage
} from '../codex/view-image.js';
import { logInfo, logWarn } from '../logger.js';
import { SandboxError, isAbsoluteVirtualPath, isNativeWindowsPath, resolvePath, strayVirtualPath } from '../sandbox.js';
import { currentWorkspace } from '../workspace.js';
import type { Capabilities, Root } from '../../shared/types.js';
import { commandHasSameArguments, evaluateCommandAllowlist } from '../../shared/command-allowlist.js';
import type { FileChange } from '../../shared/session.js';
import { REASONING_EFFORTS } from '../../shared/session.js';
import { DEFAULT_EXCLUDES, MAX_CONTENT_FILE_BYTES, globToRegExp, search, searchOneFile } from '../search.js';
import {
  ApplyPatchError,
  PatchParseError,
  executeApplyPatch,
  parsePatch,
  verifyApplyPatchArgs,
  type AppliedPatchDelta,
  type Hunk,
  type PatchPathResolver
} from '../codex/apply-patch/index.js';
import { DEFAULT_APPLY_PATCH_FILE_UPDATE_MODE } from '../codex/apply-patch/mode.js';
import { maybeParseApplyPatchForExec } from '../codex/apply-patch/invocation.js';
import { composeCommandBatch, parseCommandBatchSections } from '../codex/command-batch.js';
import { formatExecOutputForModel, newStreamOutput } from '../codex/exec-output.js';
import { DEFAULT_TRUNCATION_POLICY, EXEC_OUTPUT_CEILING_POLICY, unifiedExecManager } from '../codex/manager.js';
import {
  backgroundExecObligations,
  execOwnershipFailure,
  executionPrincipal,
  forgetExecOwner,
  MAX_UNREAD_EXEC_RESULTS_PER_CONVERSATION,
  noteExecAttended,
  noteExecOwner
} from '../codex/ownership.js';
import {
  UnifiedExecError,
  applyUnifiedExecEnv,
  execCommandResponseText,
  execCommandStructuredOutput,
  type ExecCommandToolOutput
} from '../codex/unified-exec.js';
import {
  DEFAULT_EXEC_YIELD_TIME_MS,
  DEFAULT_TTY,
  DEFAULT_WRITE_STDIN_YIELD_TIME_MS
} from '../codex/unified-exec-constants.js';
import { defaultUserShell, deriveExecArgs, getShellByModelProvidedPath, shlexJoin, withPosixPathPrefix } from '../codex/shell.js';
import {
  APPLY_PATCH_ARGUMENT_DESCRIPTION,
  APPLY_PATCH_DESCRIPTION,
  EXEC_COMMAND_CMD_DESCRIPTION,
  EXEC_COMMAND_CMDS_DESCRIPTION,
  EXEC_COMMAND_DESCRIPTION,
  EXEC_COMMAND_LOGIN_DESCRIPTION,
  EXEC_COMMAND_SHELL_DESCRIPTION,
  EXEC_COMMAND_TTY_DESCRIPTION,
  EXEC_COMMAND_WORKDIR_DESCRIPTION,
  EXEC_COMMAND_YIELD_TIME_DESCRIPTION,
  MAX_OUTPUT_TOKENS_DESCRIPTION,
  WRITE_STDIN_CHARS_DESCRIPTION,
  WRITE_STDIN_DESCRIPTION,
  WRITE_STDIN_SESSION_ID_DESCRIPTION,
  WRITE_STDIN_YIELD_TIME_DESCRIPTION
} from '../codex/tool-specs.js';
import { lineDelta } from '../diffstat.js';
import {
  benignExitNote,
  bindBundledRipgrep,
  execRecoveryHints,
  nonZeroExitIsBenign,
  normalizePowerShellOperators,
  normalizeShellCommand,
  repairPowerShellQuoting,
  withExecNotes
} from '../exec-hints.js';
import { childEnv } from '../exec.js';
import { locateRipgrep } from '../ripgrep.js';
import { ensureDevToolchain } from '../toolchain.js';
import {
  agentForCaller,
  agentFamiliesForCaller,
  reconcileAgentRequestOwners,
  noteAgentContextTokens,
  persistCriticalSwarmNow,
  PRIME_ID,
  requestWorkerBootstraps,
  requestWorkerRevivals,
  statusForCaller,
  stageFinishAgent,
  stageMessages,
  stagePrimeMessage,
  stageSpawn,
  swarmRunning,
  swarmStateForCaller,
  type Caller
} from '../agents.js';
import { repairPrimeFromResumeShadow } from '../session/continuation.js';
import {
  currentCall,
  currentCaller,
  noteChanges,
  noteCount,
  noteDetail,
  noteExec
} from './call-context.js';
import {
  awaitFreshCallOrigin,
  recordAgentMessage
} from '../session/recorder.js';
import { findSessionByConversation, readRecentEvents } from '../session/store.js';
import { requestCorrelation } from '../session/correlation.js';
import {
  adoptAgent,
  fail,
  failIdentity,
  formatFileInfo,
  friendlyError,
  guard,
  IDENTITY_EVIDENCE_MS,
  PRIME_EVIDENCE_MS,
  SPAWN_EVIDENCE_MS,
  ok,
  pathArg,
  lineNumberArg,
  resolveCwd,
  resolveIn,
  type SurfaceRegistrar,
  type ToolResult
} from './kernel.js';

/** Entries one `read` of a directory returns before it says it stopped. */
const MAX_DIR_ENTRIES = 200;
/** Files one glob may expand to. A pattern is a convenience, not a way to bulk-read a repo. */
const MAX_GLOB_MATCHES = 20;
/** Files a single `read` call may touch after every path and glob is expanded. */
const MAX_READ_TARGETS = 40;
const MAX_READ_IMAGES = 4;
const MAX_READ_IMAGE_BYTES = 12 * 1024 * 1024;
/** Entries a glob walk will look at before giving up on the pattern. */
const GLOB_SCAN_LIMIT = 5_000;

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);

// Codex advertises these as JSON Schema `number`, but serde still deserializes them into
// integer Rust types. Refinements preserve the model-visible number schema while rejecting
// values Rust would reject before the handler runs.
const int32Number = z
  .number()
  .refine((value) => Number.isInteger(value) && value >= -2_147_483_648 && value <= 2_147_483_647);
const unsignedIntegerNumber = z.number().refine((value) => Number.isSafeInteger(value) && value >= 0);
const excludeFolderPattern = z
  .string()
  .min(1)
  .max(100)
  .refine(
    (value) =>
      !/[\\/]/.test(value) &&
      (value.indexOf('*') === -1 || (value.endsWith('*') && value.indexOf('*') === value.length - 1)),
    'exclude entries must be folder names with at most one trailing * prefix wildcard'
  );

const unifiedExecOutputSchema = z
  .object({
    chunk_id: z.string().optional().describe('Output chunk identifier.'),
    wall_time_seconds: z.number().describe('Seconds spent waiting for output.'),
    exit_code: z.number().optional().describe('Process exit code when the command finished during this call.'),
    session_id: z
      .number()
      .optional()
      .describe('Session ID while running.'),
    completed_session_id: z.number().optional().describe('Use as write_stdin session_id to reread completed output.'),
    benign_exit: z.boolean().optional().describe('Non-zero exit is an expected result, not a failure.'),
    output_replayed: z.boolean().optional().describe('Retained output; command was not run again.'),
    original_token_count: z.number().optional().describe('Approximate token count before output truncation.'),
    output: z.string().describe('Command output text, possibly truncated.'),
    supplemental_context: z.string().optional().describe('App context, not process output.')
  })
  .strict();

/** Whether the one-time note about a discovered toolchain has already been logged. */
let toolchainLogged = false;

/**
 * The environment `exec_command` hands its child.
 *
 * Built through `normalizeEnvironment` rather than by spreading `process.env`, because
 * `ensureDevToolchain` has to edit PATH and env.ts exists precisely to stop a second
 * spelling of it appearing beside the first. `applyUnifiedExecEnv` stays last so the Codex
 * pager/colour contract is still the final word, exactly as it was before.
 */
function execChildEnvironment(): NodeJS.ProcessEnv {
  // Start from the one shared child-process environment contract. Rebuilding only the PATH
  // casing fix here looked equivalent but quietly dropped two security/correctness guarantees
  // that `childEnv()` already owns: connector secrets are stripped before the child can read
  // them, and the bundled ripgrep directory is put on PATH (plus Windows' irreducible system
  // paths are repaired when the parent environment is sparse). Unified exec used to bypass
  // all three, so `exec_command` was the one launcher that could leak OPENAI_API_KEY and could
  // fail to find the very rg binary the app ships. Extend the shared environment only with the
  // dev-toolchain discovery that is specific to this surface.
  const env = childEnv();
  const added = ensureDevToolchain(env);
  if (added.length > 0 && !toolchainLogged) {
    toolchainLogged = true;
    logInfo(`exec_command: filled in unset toolchain variables (${added.join(', ')})`);
  }
  return applyUnifiedExecEnv(env);
}

/** One stable owner for the running model turn, upgraded lazily when page proof arrives. */
function execPrincipal(): string | null {
  const caller = currentCaller();
  return executionPrincipal(
    caller.requestId,
    caller.sessionId ?? null,
    currentCall()?.allowUnattributed ?? getConfig().multiAgent.allowUnattributedCalls
  );
}

export function registerCoreTools(reg: SurfaceRegistrar): void {
  const { ctx, caps, exposedCaps } = reg
```

### Core Architecture Module: `src/main/window-lifecycle.ts`
```
/** Minimal app-event shape kept separate so macOS activation behavior is unit-testable. */
export interface ActivateEventSource {
  on(event: 'activate', listener: () => void): unknown;
}

/** Only the process that owns Electron's single-instance lock owns app runtime state/teardown. */
export function ownsAppRuntime(hasSingleInstanceLock: boolean): boolean {
  return hasSingleInstanceLock;
}

/**
 * Whether this process is allowed to touch the shared userData bootstrap at all.
 *
 * A losing single-instance process still evaluates this module and its `whenReady()` callback
 * can race `app.quit()`. Likewise the primary can receive an OS/application quit before ready.
 * Both are terminal: config/secrets/session/durable initialization belongs only to the live lock
 * owner, never to a process already leaving.
 */
export function shouldBeginAppBootstrap(hasSingleInstanceLock: boolean, quitting: boolean): boolean {
  return ownsAppRuntime(hasSingleInstanceLock) && !quitting;
}

/**
 * `second-instance` is only guaranteed to happen after Electron's `ready` event. Our own startup
 * continues well past that while config/durable state is restored and, critically, before the
 * renderer CSP/permission handlers and IPC surface are installed. Keep an early re-launch from
 * constructing a BrowserWindow across that gap. The normal startup path opens the initial window
 * once the gate is enabled, so dropping an earlier focus request loses nothing; later requests
 * focus/recreate the window immediately.
 */
export function createWindowActivationGate(showWindow: () => void): {
  request: () => void;
  enable: () => void;
  disable: () => void;
  isDisabled: () => boolean;
} {
  let enabled = false;
  // Shutdown is a terminal lifetime boundary, not a temporary pause. A startup continuation
  // can resume after `before-quit` because the main bootstrap contains several awaits; letting
  // that stale continuation call enable() again would reopen native activation during teardown.
  let disabled = false;
  return {
    request: () => {
      if (enabled && !disabled) showWindow();
    },
    enable: () => {
      if (!disabled) enabled = true;
    },
    disable: () => {
      disabled = true;
      enabled = false;
    },
    isDisabled: () => disabled
  };
}

/**
 * Closing the last ordinary window is not an application quit on macOS. The app stays in the
 * Dock/menu bar until the user explicitly quits (Cmd+Q / application menu / tray menu), and a
 * later `activate` recreates the window. Windows/Linux retain the existing preference semantics:
 * when close-to-tray is off, closing the last window exits the app.
 */
export function shouldQuitOnWindowAllClosed(
  platform: NodeJS.Platform,
  minimizeToTray: boolean
): boolean {
  return platform !== 'darwin' && !minimizeToTray;
}

/**
 * macOS users return to a hidden app through the Dock, which Electron reports as `activate`.
 * Windows/Linux use the tray/second-instance paths and should not gain a synthetic handler.
 */
export function registerNativeWindowActivation(
  source: ActivateEventSource,
  showWindow: () => void,
  platform: NodeJS.Platform = process.platform
): void {
  if (platform === 'darwin') source.on('activate', showWindow);
}

export interface NormalWindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowPlacement {
  bounds: NormalWindowBounds;
  maximized: boolean;
}

interface NormalWindowBoundsOwner {
  on(event: 'move' | 'resize' | 'maximize' | 'unmaximize', listener: () => void): unknown;
  isDestroyed(): boolean;
  isMaximized(): boolean;
  isMinimized(): boolean;
  isFullScreen(): boolean;
  getNormalBounds(): NormalWindowBounds;
}

/**
 * Keep the user-controlled normal rectangle even while the native window is maximized. The
 * maximized bit is presentation state; minimized/fullscreen geometry remains transient and is
 * never allowed to replace the normal rectangle.
 */
export function trackNormalWindowBounds(
  owner: NormalWindowBoundsOwner,
  save: (placement: WindowPlacement) => void
): void {
  const normalBounds = (): NormalWindowBounds | null => {
    const bounds = owner.getNormalBounds();
    if (
      !Number.isFinite(bounds.x) || !Number.isFinite(bounds.y) ||
      !Number.isFinite(bounds.width) || bounds.width <= 0 ||
      !Number.isFinite(bounds.height) || bounds.height <= 0
    ) return null;
    return {
      x: Math.round(bounds.x),
      y: Math.round(bounds.y),
      width: Math.round(bounds.width),
      height: Math.round(bounds.height)
    };
  };
  const rememberNormal = (): void => {
    if (owner.isDestroyed() || owner.isMaximized() || owner.isMinimized() || owner.isFullScreen()) return;
    const bounds = normalBounds();
    if (bounds) save({ bounds, maximized: false });
  };
  const rememberMaximized = (): void => {
    if (owner.isDestroyed() || owner.isMinimized() || owner.isFullScreen()) return;
    const bounds = normalBounds();
    if (bounds) save({ bounds, maximized: true });
  };
  owner.on('move', rememberNormal);
  owner.on('resize', rememberNormal);
  owner.on('maximize', rememberMaximized);
  owner.on('unmaximize', rememberNormal);
}

/** Login launch is distinct from tunnel auto-connect and ordinary app activation. */
export function isBackgroundLaunch(argv: readonly string[]): boolean {
  return argv.includes('--background');
}

export function supportsLoginStartup(platform: NodeJS.Platform, packaged: boolean): boolean {
  return platform === 'win32' && packaged;
}

export function applyLoginStartup(
  app: { isPackaged: boolean; setLoginItemSettings(settings: { openAtLogin: boolean; path: string; args: string[] }): void },
  enabled: boolean,
  platform: NodeJS.Platform = process.platform,
  executable = process.execPath
): void {
  if (!supportsLoginStartup(platform, app.isPackaged)) return;
  app.setLoginItemSettings({ openAtLogin: enabled, path: executable, args: ['--background'] });
}

```

### Core Architecture Module: `src/preload/cos-browser-worker.ts`
```
/**
 * Service-worker preload for the CoS browser.
 *
 * Electron runs the companion extension unchanged, but its own `chrome.tabs` lacks the tab state
 * and events the extension orchestrates with, and it has no `chrome.windows` or
 * `chrome.debugger`. This preload replaces exactly those namespaces in the extension worker's
 * own world with calls into the app's tab model (src/main/cos-browser). Messaging, scripting,
 * storage, alarms and runtime stay Electron's.
 *
 * The session registers this preload for every service worker, including chatgpt.com's own, so
 * it acts only inside a `chrome-extension:` worker; the app also checks the caller's scope.
 */
import { contextBridge, ipcRenderer } from 'electron';

type Reply = { ok: true; value: unknown } | { ok: false; message: string };

/**
 * The app registers its handler as the worker starts; a call made by the extension's very first
 * lines can still arrive before that, so only that refusal is retried, briefly.
 */
async function invoke(name: string, args: unknown[]): Promise<Reply> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await ipcRenderer.invoke('cos-browser:api', name, args) as Reply;
    } catch (error) {
      if (attempt >= 40 || !/No handler registered/i.test(error instanceof Error ? error.message : String(error))) throw error;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
}

// The preload's own context has no `location`; the worker's world answers for itself.
const workerProtocol: unknown = contextBridge.executeInMainWorld({ func: () => globalThis.location?.protocol });
if (workerProtocol === 'chrome-extension:') {
  const subscribers = new Set<(name: string, args: unknown[]) => void>();
  ipcRenderer.on('cos-browser:event', (_event, name: string, args: unknown[]) => {
    for (const subscriber of subscribers) subscriber(name, args);
  });
  contextBridge.exposeInMainWorld('__cosBrowserWorker', {
    call: async (name: string, args: unknown[]): Promise<unknown> => {
      const reply = await invoke(name, args);
      // Chrome's exact messages, such as "No tab with id: 7.", reach the extension unchanged.
      if (!reply.ok) throw new Error(reply.message);
      return reply.value;
    },
    subscribe: (subscriber: (name: string, args: unknown[]) => void): void => { subscribers.add(subscriber); }
  });
  contextBridge.executeInMainWorld({ func: installChromeShim, args: [process.env.COS_BROWSER_TRACE === '1'] });
}

/** Runs in the worker's own world; it is serialized, so it must not reference this module. */
function installChromeShim(trace: boolean): void {
  const bridge = (globalThis as unknown as {
    __cosBrowserWorker: { call(name: string, args: unknown[]): Promise<unknown>; subscribe(fn: (name: string, args: unknown[]) => void): void };
  }).__cosBrowserWorker;
  const chrome = (globalThis as unknown as { chrome: Record<string, Record<string, unknown>> }).chrome;
  if (!chrome?.runtime || !chrome.tabs) return;
  const tabs = chrome.tabs;

  const events = new Map<string, Set<(...args: unknown[]) => void>>();
  const event = (name: string) => {
    const listeners = new Set<(...args: unknown[]) => void>();
    events.set(name, listeners);
    return {
      addListener: (listener: (...args: unknown[]) => void) => { listeners.add(listener); },
      removeListener: (listener: (...args: unknown[]) => void) => { listeners.delete(listener); },
      hasListener: (listener: (...args: unknown[]) => void) => listeners.has(listener),
      hasListeners: () => listeners.size > 0
    };
  };
  bridge.subscribe((name, args) => {
    for (const listener of [...(events.get(name) ?? [])]) {
      try { listener(...args); } catch (error) { console.error(error); }
    }
  });

  // Promise style, plus Chrome's callback style with runtime.lastError for older call sites.
  const method = (name: string) => (...args: unknown[]) => {
    const callback = typeof args.at(-1) === 'function' ? args.pop() as (value?: unknown) => void : null;
    const result = bridge.call(name, args);
    if (!callback) return result;
    result.then(value => callback(value), (error: Error) => {
      const runtime = chrome.runtime as Record<string, unknown>;
      runtime.lastError = { message: error.message };
      try { callback(); } finally { delete runtime.lastError; }
    });
    return undefined;
  };

  // Changed in place: messaging (`sendMessage`, `connect`) and anything else native stays.
  Object.assign(tabs, {
    TAB_ID_NONE: -1,
    query: method('tabs.query'),
    get: method('tabs.get'),
    getCurrent: () => Promise.resolve(undefined),
    create: method('tabs.create'),
    update: method('tabs.update'),
    reload: method('tabs.reload'),
    move: method('tabs.move'),
    remove: method('tabs.remove'),
    onCreated: event('tabs.onCreated'),
    onUpdated: event('tabs.onUpdated'),
    onActivated: event('tabs.onActivated'),
    onMoved: event('tabs.onMoved'),
    onDetached: event('tabs.onDetached'),
    onAttached: event('tabs.onAttached'),
    onRemoved: event('tabs.onRemoved'),
    onHighlighted: event('tabs.onHighlighted'),
    onReplaced: event('tabs.onReplaced'),
    onZoomChange: event('tabs.onZoomChange')
  });
  chrome.windows = {
    WINDOW_ID_NONE: -1,
    WINDOW_ID_CURRENT: -2,
    get: method('windows.get'),
    getAll: method('windows.getAll'),
    getCurrent: method('windows.getLastFocused'),
    getLastFocused: method('windows.getLastFocused'),
    create: method('windows.create'),
    update: method('windows.update'),
    remove: method('windows.remove'),
    onCreated: event('windows.onCreated'),
    onRemoved: event('windows.onRemoved'),
    onFocusChanged: event('windows.onFocusChanged'),
    onBoundsChanged: event('windows.onBoundsChanged')
  };
  // COS_BROWSER_TRACE=1: time Electron's own async calls too, so a call that never settles shows.
  if (trace) {
    let next = 0;
    const timed = (owner: Record<string, unknown>, name: string, label: string) => {
      const original = owner[name] as ((...args: unknown[]) => unknown) | undefined;
      if (typeof original !== 'function') return;
      owner[name] = function (this: unknown, ...args: unknown[]) {
        const id = ++next;
        const started = Date.now();
        const target = args[0] && typeof args[0] === 'object' ? JSON.stringify(args[0]).slice(0, 120) : String(args[0]);
        const result = original.apply(this, args);
        if (result && typeof (result as Promise<unknown>).then === 'function') {
          const late = setTimeout(() => console.warn(`CoS trace: ${label} #${id} ${target} still pending after 10 s`), 10_000);
          (result as Promise<unknown>).then(
            () => { clearTimeout(late); console.info(`CoS trace: ${label} #${id} ${target} done in ${Date.now() - started} ms`); },
            (error: Error) => { clearTimeout(late); console.info(`CoS trace: ${label} #${id} ${target} failed in ${Date.now() - started} ms: ${error?.message}`); });
        }
        return result;
      };
    };
    timed(tabs, 'sendMessage', 'tabs.sendMessage');
    timed(chrome.scripting as Record<string, unknown>, 'executeScript', 'scripting.executeScript');
    timed(chrome.scripting as Record<string, unknown>, 'insertCSS', 'scripting.insertCSS');
  }
  // Chrome fires onStartup when the browser starts; Electron never does, so the app does.
  Object.defineProperty(chrome.runtime, 'onStartup', { value: event('runtime.onStartup'), configurable: true, writable: true });
  chrome.debugger = {
    attach: method('debugger.attach'),
    detach: method('debugger.detach'),
    sendCommand: method('debugger.sendCommand'),
    getTargets: method('debugger.getTargets'),
    onEvent: event('debugger.onEvent'),
    onDetach: event('debugger.onDetach')
  };
  // Granted means declared: the CoS browser installs the extension with its manifest permissions.
  const manifest = (chrome.runtime.getManifest as () => { permissions?: string[]; host_permissions?: string[] })();
  chrome.permissions ??= {};
  Object.assign(chrome.permissions, {
    contains: (request: { permissions?: string[]; origins?: string[] } = {}, callback?: (granted: boolean) => void) => {
      const granted = (request.permissions ?? []).every(permission => manifest.permissions?.includes(permission)) &&
        (request.origins ?? []).every(origin => manifest.host_permissions?.includes(origin));
      if (callback) { callback(granted); return undefined; }
      return Promise.resolve(granted);
    }
  });
}

```

### Core Architecture Module: `src/renderer/agent-communication.ts`
```
import { t } from './i18n.js';
import type { SessionEvent, SessionSummary } from '../shared/session.js';
import { el } from './dom.js';

type Communication = Extract<SessionEvent, { kind: 'agent_message' }>;

export function workerAvatar(worker: string): HTMLElement {
  const avatar = el('span', 'agent-avatar', worker.replace(/^worker-/, ''));
  avatar.dataset.color = String([...worker].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 6);
  avatar.setAttribute('aria-hidden', 'true');
  return avatar;
}

/** Recorded participation, never a roster/status snapshot or a guessed slot incarnation. */
export function participatingWorkers(event: SessionEvent, workers: SessionSummary[]): SessionSummary[] {
  let names: unknown[] = [];
  if (event.kind === 'agent_message') names = [event.from, event.to];
  else if (event.kind === 'tool_call' && event.call.tool === 'agents' && event.call.outcome === 'ok') {
    if (event.call.args.truncated) return [];
    try {
      const args = JSON.parse(event.call.args.text);
      if (args.action === 'message' && !args.target_run_id) {
        names = Array.isArray(args.messages) ? args.messages.map((message: { to?: unknown }) => message?.to) : [args.to];
      }
      // Only structured spawn receipts name the workers actually accepted. Prose and
      // requested assignments cannot prove which reusable worker the broker chose.
      if (args.action === 'spawn' && !event.call.result.truncated) {
        const result = JSON.parse(event.call.result.text)?.structuredContent;
        if (result?.action === 'spawn' && Array.isArray(result.workers)) names = result.workers.map((worker: { id?: unknown }) => worker?.id);
      }
    } catch { return []; }
  }
  return [...new Set(names)].flatMap(name => {
    if (typeof name !== 'string' || !name.startsWith('worker-')) return [];
    const matches = workers.filter(worker => worker.origin?.agentId === name);
    return matches.length === 1 ? matches : [];
  });
}

export function communicationTitle(event: Communication): string {
  const worker = event.from === 'prime' ? event.to : event.from;
  if (event.from === 'prime') return t("Message to {0}", [worker]);
  if ((event.message.text.startsWith(`[${worker} is awake again]`) || event.message.text.startsWith(`[${worker} is back]`))) return t("{0} resumed work", [worker]);
  if ((event.message.text.startsWith(`[${worker} reported]`) || event.message.text.startsWith(`[${worker} finished]`))) return t("{0} finished · report", [worker]);
  return t("Message from {0}", [worker]);
}

/** Keep the tool's args/result as the single presentation of its outgoing message.
 * Old recordings have no causal call id: only collapse a unique exact payload match
 * inside the successful call's lifetime. Incoming reports are independent records.
 */
export function foldAgentCommunication(events: SessionEvent[]): SessionEvent[] {
  const calls = events.flatMap(event => {
    if (event.kind !== 'tool_call' || event.call.tool !== 'agents' || event.call.outcome !== 'ok' || event.call.args.truncated) return [];
    try {
      const args = JSON.parse(event.call.args.text);
      if (args.action !== 'message' || typeof args.to !== 'string' || typeof args.text !== 'string') return [];
      return [{ event, to: args.to, text: args.text }];
    } catch { return []; }
  });
  const matches = new Map<SessionEvent, SessionEvent[]>();
  for (const event of events) {
    if (event.kind !== 'agent_message' || event.delivery !== 'sent' || event.message.truncated) continue;
    const candidates = calls.filter(call => call.event.agent === event.from && call.to === event.to && call.text === event.message.text &&
      event.time >= call.event.time && event.time <= call.event.time + call.event.call.durationMs);
    if (candidates.length !== 1) continue;
    const call = candidates[0]!.event;
    matches.set(call, [...(matches.get(call) ?? []), event]);
  }
  const redundant = new Set([...matches.values()].filter(rows => rows.length === 1).flat());
  return events.filter(event => !redundant.has(event));
}

```

### Core Architecture Module: `src/renderer/agent-panel.ts`
```
import { ui, t } from './i18n.js';
import type { AgentInfo, SessionSummary, SessionEvent } from '../shared/session.js';
import { workerReportedFinish } from '../shared/session-activity.js';
import { evaluateWorkerOverviewHealth } from '../shared/agent-health.js';
import { compactNumber, el, icon } from './dom.js';
import { attachWorkPanelResize } from './work-panel-resize.js';
import { workerAvatar } from './agent-communication.js';

/** A read-only second pane. Its selection never changes the main chat's composer. */
export function createAgentPanel(options: {
  host: HTMLElement;
  mount?: HTMLElement;
  toggle?: HTMLButtonElement;
  onShow?: () => void;
  onEscape?: () => void;
  load: (id: string) => Promise<{ events: SessionEvent[] } | null>;
  render: (events: SessionEvent[], id: string, current: () => boolean) => HTMLElement[];
  openMain: (id: string) => void;
  working: (summary: SessionSummary) => boolean;
  agent?: (summary: SessionSummary) => (Pick<AgentInfo, 'state' | 'task'> & { conversationId?: string | null }) | null;
}) {
  const pane = el('aside', 'agent-panel'); pane.hidden = true;
  ui(pane, 'aria-label', () => t("Sub-agents"));
  if (!options.mount) attachWorkPanelResize(options.host, pane);
  const head = el('div', 'agent-panel-header'); head.hidden = true;
  const back = el('button', 'btn btn-icon agent-back'); back.append(icon('i-back'));
  ui(back, 'title', () => t("Back to sub-agents")); back.setAttribute('type', 'button');
  ui(back, 'aria-label', () => t("Back to sub-agents"));
  const title = el('strong');
  const body = el('div', 'agent-panel-body');
  head.append(back, title); pane.append(head, body); (options.mount ?? options.host).append(pane);
  let parent: string | null = null, workers: SessionSummary[] = [], selected: string | null = null;
  let generation = 0;
  let highlighted = new Set<string>();
  function hide(): void {
    generation++; selected = null; highlighted.clear(); pane.hidden = true;
    if (!options.mount) options.host.classList.remove('has-agent-panel');
    options.toggle?.setAttribute('aria-expanded', 'false');
  }
  function show(): void {
    options.onShow?.();
    pane.hidden = false;
    if (!options.mount) options.host.classList.add('has-agent-panel');
    options.toggle?.setAttribute('aria-expanded', 'true');
  }
  function list(): void {
    generation++; selected = null; head.hidden = true; body.replaceChildren();
    const isActive = (worker: SessionSummary): boolean => {
      const state = options.agent?.(worker)?.state;
      return state ? ['invited', 'active', 'detached', 'waking'].includes(state) : options.working(worker);
    };
    for (const active of [true, false]) {
      const group = workers.filter(worker => isActive(worker) === active);
      const failed = active ? 0 : group.filter(worker => options.agent?.(worker)?.state === 'failed').length;
      body.append(el('h3', '', () =>
        `${active ? t("Active") : t("History")} · ${group.length}${failed ? ` · ${t('{0} failed', [failed])}` : ''}`));
      if (!group.length) { body.append(el('p', 'meta', () => active ? t("No active sub-agents") : t("No recorded sub-agents"))); continue; }
      for (const worker of group) {
        const row = el('button', 'agent-panel-row'); row.setAttribute('type', 'button');
        row.dataset.workerSession = worker.id;
        row.classList.toggle('is-round-worker', highlighted.has(worker.id));
        const owner = options.agent?.(worker);
        const state = owner?.state ?? (workerReportedFinish(worker) ? 'sleeping' : active ? 'working' : 'history');
        row.dataset.state = state;
        const health = evaluateWorkerOverviewHealth({
          state: owner?.state ?? null,
          exactIdentity: Boolean(owner?.conversationId && worker.conversationId &&
            owner.conversationId === worker.conversationId),
          working: options.working(worker),
          activeTurn: worker.activeTurnId !== null && worker.activeTurnId !== undefined
        });
        row.dataset.health = health.health;
        const identity = worker.origin?.agentId ?? worker.title.split(' · ')[0] ?? worker.title;
        const task = owner?.task?.trim();
        const original = worker.origin?.task || worker.title;
        // A worker still opening has no conversation yet; undefined === undefined must not read a model.
        const model = worker.selectedModel && worker.conversationId && worker.selectedModel.conversationId === worker.conversationId
          ? [worker.selectedModel.model, worker.selectedModel.reasoningEffort].filter(Boolean).join(' · ') : '';
        const elapsedMs = Math.max(0, (active ? Date.now() : worker.endedAt ?? worker.updatedAt) - worker.startedAt);
        const elapsed = elapsedMs < 60_000 ? `${Math.floor(elapsedMs / 1000)}s`
          : elapsedMs < 3_600_000 ? `${Math.floor(elapsedMs / 60_000)}m` : `${Math.floor(elapsedMs / 3_600_000)}h`;
        const avatar = workerAvatar(worker.origin?.agentId ?? '•');
        const content = el('span', 'agent-card-content');
        const heading = el('span', 'agent-card-heading');
        heading.append(el('span', 'agent-status-dot'), el('strong', 'agent-card-name', identity));
        if (model) heading.append(el('span', 'agent-card-model', model));
        const statusLabel: Record<string, string> = { working: 'Working', history: 'History', invited: 'opening', detached: 'no tab' };
        const meta = el('span', 'agent-card-meta');
        const healthText = el('span', 'agent-card-health', () => {
          if (health.health === 'healthy') return t('Healthy');
          if (health.health === 'degraded') return t('Degraded');
          return t('Unknown');
        });
        const actionMeta = t('{0} actions · {1}', [compactNumber(worker.toolCalls ?? 0), elapsed]);
        meta.append(document.createTextNode(`${t(statusLabel[state] ?? state)} · `), healthText,
          document.createTextNode(` · ${actionMeta}`));
        const activity = worker.lastToolActivity
          ? el('span', 'agent-card-activity', worker.lastToolActivity.title)
          : null;
        if (activity) activity.dataset.kind = worker.lastToolActivity!.kind;
        content.append(
          heading,
          el('span', 'agent-card-task', () => task || `${t('Original assignment')}: ${original}`),
          ...(activity ? [activity] : []),
          meta
        );
        row.append(avatar, content);
        row.title = task || original;
        row.onclick = () => void open(worker.id);
        body.append(row);
      }
    }
  }
  async function open(id: string, refresh = false): Promise<void> {
    const worker = workers.find(row => row.id === id);
    if (!worker) return;
    const preserve = refresh && selected === id && !pane.hidden;
    if (!refresh) show();
    selected = id; const request = ++generation;
    head.hidden = false; title.textContent = worker.title;
    if (!preserve) body.replaceChildren(el('p', 'meta', () => t("Loading conversation…")));
    const current = () => request === generation && selected === id && !pane.hidden;
    const detail = await options.load(id);
    if (!current()) return;
    if (!detail) { body.replaceChildren(el('p', 'meta', () => t("Conversation unavailable"))); return; }
    const openMain = el('button', 'btn', () => t("Open full chat")); openMain.setAttribute('type', 'button');
    openMain.onclick = () => { if (current()) { hide(); options.openMain(id); } };
    const position = body.scrollTop;
    const follow = !preserve || position + body.clientHeight >= body.scrollHeight - 40;
    body.replaceChildren(openMain, ...options.render(detail.events, id, current));
    body.scrollTop = follow ? body.scrollHeight : position;
  }
  back.onclick = list;
  pane.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    event.preventDefault(); hide();
    if (options.onEscape) options.onEscape(); else options.toggle?.focus();
  });
  if (options.toggle) options.toggle.onclick = () => { if (pane.hidden) { show(); list(); } else hide(); };
  return {
    hide,
    show: () => { highlighted.clear(); show(); list(); },
    showWorkers(ids: string[]): void {
      highlighted = new Set(workers.filter(worker => ids.includes(worker.id)).map(worker => worker.id));
      if (!highlighted.size) return;
      show(); list();
      body.querySelector<HTMLButtonElement>('.is-round-worker')?.focus({ preventScroll: true });
    },
    open,
    update(id: string | null, next: SessionSummary[]): void {
      if (parent !== id) { hide(); parent = id; }
      const previous = workers.find(worker => worker.id === selected);
      workers = next;
      highlighted = new Set([...highlighted].filter(id => workers.some(worker => worker.id === id)));
      if (options.toggle) {
        options.toggle.hidden = id === null;
        ui(options.toggle, 'title', () => t("Sub-agents · {0} recorded", [workers.length]));
      }
      if (pane.hidden) return;
      const latest = workers.find(worker => worker.id === selected);
      if (!selected || !latest) list();
      else if (latest.updatedAt !== previous?.updatedAt) void open(latest.id, true);
    }
  };
}

```

### Core Architecture Module: `src/renderer/agent-plan.ts`
```
import { ui, t } from './i18n.js';
import type { AgentPlan } from '../shared/agent-plan.js';
import { el, icon } from './dom.js';

/** One current plan above the composer queue; every model string is text, never HTML. */
export function renderAgentPlan(host: HTMLElement, sessionId: string | null, plan: AgentPlan | null): void {
  if (host.dataset.sessionId !== (sessionId ?? '')) {
    host.replaceChildren();
    host.dataset.sessionId = sessionId ?? '';
    delete host.dataset.signature;
  }
  if (!sessionId || !plan?.plan.length) {
    host.hidden = true;
    host.replaceChildren();
    delete host.dataset.signature;
    return;
  }
  const signature = JSON.stringify([plan.plan, plan.explanation]);
  if (host.dataset.signature === signature) return;
  const previous = host.querySelector<HTMLDetailsElement>('.agent-plan-shell');
  const expanded = new Map([...host.querySelectorAll<HTMLDetailsElement>('[data-step]')].map(row => [row.dataset.step, row.open]));
  const focused = (document.activeElement?.closest('[data-step]') as HTMLElement | null)?.dataset.step;
  const completed = plan.plan.filter(step => step.status === 'completed').length;
  const complete = completed === plan.plan.length;
  // Completed documents remain durable, but only a visible unfinished plan celebrates.
  // Reopening a chat/restarting must not resurrect its completed composer card.
  const celebrate = complete && previous?.dataset.complete === 'false';
  host.hidden = complete && !celebrate;
  if (host.hidden) {
    host.replaceChildren();
    host.dataset.signature = signature;
    return;
  }
  const shell = el('details', 'agent-plan-shell') as HTMLDetailsElement;
  shell.dataset.complete = String(complete);
  shell.open = previous?.open ?? false;
  const heading = el('summary', 'agent-plan-heading');
  heading.append(icon('i-steps'), el('span', 'agent-plan-title', () => completed === plan.plan.length ? t("Plan complete") : t("Plan")),
    el('span', 'agent-plan-count', `${completed} / ${plan.plan.length}`));
  shell.append(heading);
  const body = el('div', 'agent-plan-body');
  if (plan.explanation) body.append(el('p', 'agent-plan-explanation', plan.explanation));
  for (const [index, step] of plan.plan.entries()) {
    const row = el('details', 'agent-plan-step') as HTMLDetailsElement;
    row.dataset.step = step.step;
    row.dataset.status = step.status;
    row.open = expanded.get(step.step) ?? false;
    const summary = el('summary', 'agent-plan-step-heading');
    const marker = el('span', 'agent-plan-marker', step.status === 'completed' ? '✓' : String(index + 1));
    ui(marker, 'aria-label', () => step.status === 'in_progress' ? t("In progress") : step.status === 'completed' ? t("Completed") : t("Pending"));
    summary.append(marker, el('span', 'agent-plan-step-title', step.step));
    if (!step.details) summary.addEventListener('click', event => event.preventDefault());
    row.append(summary);
    if (step.details) row.append(el('div', 'agent-plan-details', step.details));
    body.append(row);
    if (focused === step.step) queueMicrotask(() => { if (row.isConnected) summary.focus(); });
  }
  shell.append(body);
  host.replaceChildren(shell);
  host.dataset.signature = signature;
  if (celebrate) {
    const dismiss = () => {
      // A late animation completion cannot hide a newer plan or a different chat.
      if (shell.parentElement !== host) return;
      host.hidden = true;
      host.replaceChildren();
    };
    if (typeof shell.animate !== 'function') { dismiss(); return; }
    const reduced = document.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const height = shell.getBoundingClientRect().height;
    const animation = shell.animate(reduced ? [
      { opacity: 1 }, { opacity: 0 }
    ] : [
      { height: `${height}px`, opacity: 1, transform: 'scale(1)', boxShadow: 'inset 0 0 0 0 transparent', offset: 0 },
      { height: `${height}px`, opacity: 1, transform: 'scale(1)', boxShadow: 'inset 0 0 28px 0 rgba(70, 210, 150, .25)', offset: .25 },
      { height: `${height}px`, opacity: 1, transform: 'scale(1)', boxShadow: 'inset 0 0 0 0 transparent', offset: .7 },
      { height: '0px', opacity: 0, transform: 'scale(.98)', boxShadow: 'inset 0 0 0 0 transparent', offset: 1 }
    ], { duration: reduced ? 150 : 1800, easing: 'ease-in-out', fill: 'forwards' });
    animation.finished.then(dismiss, () => undefined);
  }
}

```

### Core Architecture Module: `src/renderer/appearance.ts`
```
import { defaultAppearance, mixColor, paletteTokens, type AppearanceSettings, type AppearanceTheme } from '../shared/appearance.js';
import type { UiPrefs } from '../shared/types.js';
import { $ } from './dom.js';

const FONT_FAMILIES = {
  system: '', sans: 'Arial, Helvetica, sans-serif',
  serif: 'Georgia, "Times New Roman", serif', mono: '"Cascadia Mono", Consolas, monospace'
};
const appearanceListeners = new Set<() => void>();
/** Canvas/terminal renderers must refresh after the CSS palette has been applied. */
export function onAppearanceChanged(listener: () => void): () => void {
  appearanceListeners.add(listener);
  return () => { appearanceListeners.delete(listener); };
}
function tokens(element: HTMLElement, values: Record<string, string>): void {
  for (const [key, value] of Object.entries(values)) if (element.style.getPropertyValue(key) !== value) element.style.setProperty(key, value);
}

export function applyAppearance(theme: AppearanceTheme, settings?: AppearanceSettings): void {
  const value = settings ?? defaultAppearance(), palette = value[theme], root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.translucentSidebar = String(value.translucentSidebar);
  tokens(root, paletteTokens(palette.background, palette.accent, palette.contrast));
  root.style.setProperty('--text-scale', String(value.fontSize / 14));
  if (value.font === 'system') root.style.removeProperty('--ui-font');
  else root.style.setProperty('--ui-font', FONT_FAMILIES[value.font]);
  root.style.setProperty('--sidebar-color', palette.sidebar);
  // Glass is composed inside the window: a colored backdrop and translucent layer.
  // No native transparent window, desktop capture, or platform permission is needed.
  const sidebarBackground = value.translucentSidebar ? mixColor(palette.sidebar, palette.background, .13) : palette.sidebar;
  for (const element of document.querySelectorAll<HTMLElement>('.sidebar, .app-topbar, .appearance-preview-sidebar, .connection-popover')) {
    tokens(element, paletteTokens(sidebarBackground, palette.accent, palette.contrast));
  }
  for (const listener of appearanceListeners) listener();
}

/** Only the in-progress form edit is local; the existing Settings queue owns persistence. */
export function initAppearance(save: (patch: { theme?: AppearanceTheme; appearance?: AppearanceSettings }) => void): { apply(ui: UiPrefs): void } {
  const panel = $('appearancePanel');
  let theme: AppearanceTheme = 'dark';
  let current = defaultAppearance();
  let editing = false;
  const colorKeys = ['accent', 'background', 'sidebar'] as const;
  function paint(): void {
    applyAppearance(theme, current);
    $<HTMLSelectElement>('appearanceTheme').value = theme;
    $<HTMLSelectElement>('appearanceFont').value = current.font;
    $<HTMLInputElement>('appearanceSize').value = String(current.fontSize);
    $('appearanceSizeValue').textContent = `${current.fontSize} px`;
    $<HTMLInputElement>('appearanceContrast').value = String(current[theme].contrast);
    $('appearanceContrastValue').textContent = String(current[theme].contrast);
    $<HTMLInputElement>('appearanceTranslucent').checked = current.translucentSidebar;
    for (const key of colorKeys) {
      const color = current[theme][key];
      panel.querySelector<HTMLInputElement>(`[data-color="${key}"]`)!.value = color;
      const hex = panel.querySelector<HTMLInputElement>(`[data-hex="${key}"]`)!;
      if (document.activeElement !== hex) hex.value = color.toUpperCase();
    }
  }
  function update(control: HTMLInputElement | HTMLSelectElement): boolean {
    if (control.dataset.color || control.dataset.hex) {
      const key = (control.dataset.color ?? control.dataset.hex) as typeof colorKeys[number];
      const value = control.value.trim();
      if (!/^#[\da-fA-F]{6}$/.test(value)) {
        control.setAttribute('aria-invalid', 'true');
        return false;
      }
      control.removeAttribute('aria-invalid');
      current = { ...current, [theme]: { ...current[theme], [key]: value.toLowerCase() } };
      // Keep the hex text in sync with native picker gestures too.
      if (control.dataset.color) panel.querySelector<HTMLInputElement>(`[data-hex="${key}"]`)!.value = value.toUpperCase();
    } else if (control.id === 'appearanceSize') current = { ...current, fontSize: Number(control.value) };
    else if (control.id === 'appearanceContrast') current = { ...current, [theme]: { ...current[theme], contrast: Number(control.value) } };
    else if (control.id === 'appearanceFont') current = { ...current, font: control.value as AppearanceSettings['font'] };
    else if (control.id === 'appearanceTranslucent') current = { ...current, translucentSidebar: (control as HTMLInputElement).checked };
    else return false;
    paint();
    return true;
  }
  panel.addEventListener('input', event => {
    const control = event.target;
    if (!(control instanceof HTMLInputElement) || !control.id.startsWith('appearance')) return;
    editing = true;
    update(control);
  });
  panel.addEventListener('change', event => {
    const control = event.target;
    if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement) || !control.id.startsWith('appearance')) return;
    editing = false;
    if (control.id === 'appearanceTheme') {
      theme = control.value as AppearanceTheme;
      paint(); save({ theme });
    } else if (update(control)) save({ appearance: current });
    else {
      // Incomplete hex input never becomes CSS or durable config. Restore the last valid value.
      control.removeAttribute('aria-invalid');
      if (control.dataset.hex) control.value = current[theme][control.dataset.hex as typeof colorKeys[number]].toUpperCase();
    }
  });
  $('appearanceReset').addEventListener('click', () => {
    editing = false; current = defaultAppearance(); paint(); save({ appearance: current });
  });
  return { apply(ui) {
    if (editing) return;
    theme = ui.theme; current = ui.appearance ?? defaultAppearance(); paint();
  } };
}

```

### Core Architecture Module: `src/renderer/assets.d.ts`
```
declare module '*?url' {
  const url: string;
  export default url;
}

declare module '*.css';

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1099** (2026-10-05): **Goal run stuck in "settling" after a fast first answer was not seen as finished**
  *Symptoms*: Found during QA of the 2.1.27 canary (main `ad8a16f4`) on the Windows 11 VM, Chrome, ChatGPT Team account. Intermittent: two earlier Goal runs on the same build with the same kind of prompt decided within ~20 seconds.  ## What happened  A Goal run started from the app in a new chat: objective "write one haiku about rain … complete as soon as it has been written once", first message "Write a haiku about rain. Do not use any tools." (model 5.6 Instant).  1. **20:05:15** the opening message was claimed, **20:05:19** acknowledged, and the chat got its id. **20:05:21** `turn_start`, and `assistant_message` already holds the finished haiku (an Instant answer, done within about two seconds). 2. The page never confirmed that the turn finished. In between, the app-opened tab showed ChatGPT's empty start screen ("Bereit, wenn du es bist.") while its URL was already `/c/<id>`; later it showed the haiku again, with the app's "Checking the answer is finished" status under it. 3. **20:15:22** the ten-minute stall check closed the turn: `chat_error` "No visible progress for ten minutes. The app could not confirm that this turn finished." and `turn_end` with outcome `stalled`. The assistant-error repair then "preserved the recovered page without spending its reload". 4. **After that, Goal never decides.** Session controls keep reporting `goalWait: { reason: "settling" }` with no `goalDraft`, more than two minutes after the stall (and still counting), and the composer row says "Pursuing goal 
  **Post-Mortem & Fix Analysis**:
  > More evidence from three more runs on the same canary (same objective shape, new chat each time):  - **Reproduces 1 in 3** (2 of 6 overall). Two runs ended normally after ~21 s; one got stuck the same way. - **The stuck tab shows ChatGPT's new-chat page at the conversation URL.** `/c/6ac2b4be…` with "Was steht heute an?" and **0** `conversation-turn` elements in the DOM (hidden ones included), while the page's own status says `generating: true`, `lastKind: assistant_message`. So it is not one of the kept, undisplayed pages from #901: the conversation is not mounted at all. - **Concurrency clue:** the stuck chat's opening message was claimed at 20:19:08 while Goal's helper request for the previous run was claimed at 20:19:12. Both open new ChatGPT chats in their own app-opened tabs at the same time. - **Activating the tab does not help** (still the new-chat page, 0 turns). - **A reload does render it, and the turn then ends normally** (outcome `completed`). But **Goal still never decide
  > Root cause found and fixed in #1101 (merged, ships in 2.1.27).  **Why the turn never ended.** A trace inside the page script showed that ChatGPT reported the answer's `end_turn` 0.3 s **before** the page script opened the turn. In a brand-new chat ChatGPT redraws the first exchange, and the question can be missing until the answer is there (#942), so the turn opens from the Send receipt. A fast Instant answer was already complete by then, and at turn start every final already on the page is filed as history (#746), including the answer's own. Nothing could close the turn after that. My earlier "new-chat page with 0 turns" reading was wrong: ChatGPT's new shell has no `conversation-turn` test ids, and the stuck tabs showed the finished answer.  **Fix.** The finals that are history for a question are now taken at Send. On the Windows VM: 4 of 6 Goal starts stalled before, and 0 of 12 after (each closed in 15-21 s).  **Still open here (part 2, pre-existing, not a 2.1.27 regression):** whe
  > The second part (Goal never deciding after the stall) is found and fixed in **#1119**.  When ChatGPT reported the answer's end before the page opened the turn (the race #1101 fixed for new runs), the page closed the turn as `stalled` ten minutes later. The app then counted two things as work after ChatGPT's final answer: the turn's own late start, and that stall. So the turn never counted as finished. Every Goal decision was refused with `chat_still_working`, also after reloads, and the row kept saying "Answer settling".  All five stuck repro chats from yesterday showed this. With #1119, ChatGPT's own final outlasts the stall verdict. On the Windows VM the stalled repro chat decided "goal met" as soon as the fixed build started. #1119 also fixes three other ways a Goal could hang on "Answer settling". 

- **Issue #1032** (2026-10-04): **Can we just have manual cancellation of this no activity detection.**
  *Symptoms*: ### App version  2.1.26  ### Operating system and version  Windows 11 latest  ### Architecture  x64 (Intel/AMD)  ### Was the Chrome extension connected?  Yes, and its version matches the app  ### ChatGPT plan  Pro  ### ChatGPT surface and workspace type  _No response_  ### What happened  This is about that CoS behaviour of detecting unresponsive activity.  The activity in ChatGPT is still doin the task, but this CoS is always thinking its 'No activity' and 'Interrupted response'. See image below. (Looks closely and see the activity + reload countdown)  # Read 4 and Read 2 path <img width="933" height="743" alt="Image" src="https://github.com/user-attachments/assets/a23fe553-f994-47bf-bef1-8480373abd00" />  # Edited 4 files <img width="937" height="708" alt="Image" src="https://github.com/user-attachments/assets/c62da8cf-0f7f-4069-923c-0db9402995a1" />    ### Steps to reproduce  1. Prompt to do long task 2. Wait for CoS weird no activity detection  ### Anything else  ```text  ```
  **Post-Mortem & Fix Analysis**:
  > <img width="948" height="409" alt="Image" src="https://github.com/user-attachments/assets/8fb29c8b-b564-405b-b8b0-6db2d0449241" />
  > @BroNils thanks for the clear screenshots, they show exactly what's going on.  What you're seeing: ChatGPT's **page** lost the live stream for that answer (its "Connection interrupted" state), while the model kept working on OpenAI's servers. That's why new tool steps (Read, Edited 4 files) keep arriving while CoS shows "Interrupted response · Reload in 2:43". The reload only reconnects the page to the running answer; it doesn't stop or restart the work. We can't let those tool calls cancel it automatically: we've seen pages stay dead for many minutes while every tool call still went through, and only the reload brought them back.  But you should be able to decide, so #1035 adds an **×** to that countdown row. It cancels the reload for the current answer (until the reload has actually started). Repeated "interrupted" notices for the same answer won't bring it back, and your next message gets normal recovery again. The row's tooltip now also explains what the reload does, instead of cla
  > The × to cancel the reload (#1035) is merged and ships with 2.1.27 this week; it is already in the current canary build. Closing this as done. If it doesn't do what you need, just reply here or reopen. Thanks @BroNils!

- **Issue #1012** (2026-10-03): **Compact & Resume destination tab is automatically closed after being idle**
  *Symptoms*: ### App version  2.1.25  ### Operating system and version  Windows 11  ### Architecture  x64 (Intel/AMD)  ### Was the Chrome extension connected?  Yes, and its version matches the app  ### ChatGPT plan  Pro  ### ChatGPT surface and workspace type  Chat, Personal workspace  ### What happened  After using Compact & Resume, I continue working normally in the newly created conversation.  If I switch away from that tab for several minutes, Chat On Steroids can automatically close it. This seems to happen because the resumed conversation remains CoS-managed and becomes eligible for idle tab cleanup.  I don't think a Compact & Resume destination should be treated like a disposable worker/helper tab. It becomes the main conversation I continue working in and should stay open like a normal ChatGPT tab.  Expected: idle cleanup may close temporary workers/helpers and superseded source chats, but it should not close the current Compact & Resume destination.  ### Steps to reproduce  Use Compact & Resume in an existing conversation.  Continue working in the newly created conversation.  Finish a turn and switch to another tab/application.  Leave it idle for several minutes.  The resumed conversation tab is automatically closed.  ### Anything else  ```text From the current code, browserTabPolicy() puts conversations with a durable origin into managedConversations. A resumed conversation has origin.kind === "resume", and pruneManagedTabs() later decides tab ownership from that managed convers
  **Post-Mortem & Fix Analysis**:
  > Thanks @Akilaydin, you nailed it: the resume stamps your own session as `resume`, and every session with an origin counted as an app-owned tab, so idle cleanup took your main chat. #1014 fixes it: a resumed chat is your chat and is never closed for being idle (the old source chat still is). The fix will be in 2.1.27 and in the next canary build.

- **Issue #1008** (2026-10-03): **v2.1.26: Compact & Resume can mint a shadow local session after a >60s pre-send wait**
  *Symptoms*: ### App version  2.1.26  ### Operating system and version  Windows 25H2 build 26200.9457  ### Architecture  x64 (Intel/AMD)  ### Was the Chrome extension connected?  Yes, and its version matches the app  ### ChatGPT plan  Plus  ### ChatGPT surface and workspace type  Chat / Personal workspace  ### What happened  On v2.1.26, Compact & Resume can complete the handoff generation and open/send into a replacement ChatGPT conversation, but the COS UI may create a new local session for that replacement instead of moving the existing durable COS session from chat A to chat B.  User-visible symptom: after the handoff, the app "starts a new chat instead of continuing on the same chat", and the existing session/worker lineage is split.  This is the same failure family as #218 / #224, but I found a new deterministic trigger in v2.1.26:  - the recorder's anti-shadow gate is bounded by `RESUME_CLAIM_WINDOW_MS = 60_000`; - that gate is armed when the continuation is claimed/opening; - model-picker/composer work can legitimately delay the destination Send by more than 60 seconds; - before Send, replacement chat B does not exist yet; - if the 60s gate expires during that pre-send wait, Send can later mint chat B while `resumeOpeningChat()` is false; - the recorder can then see unknown B and create a new local session before the A→B continuation commit; - the commit now sees B owned by another local session and cannot preserve the original durable identity.  Expected behavior: A and B are two 
  **Post-Mortem & Fix Analysis**:
  > sent twince

- **Issue #1007** (2026-10-03): **v2.1.26 regression: Compact & Resume can create a second local session after a long pre-Send wait**
  *Symptoms*: ### App version  2.1.26  ### Operating system and version  Windows 11 Pro 25H2, build 26200.9457  ### Architecture  x64 (Intel/AMD)  ### Was the Chrome extension connected?  Yes, and its version matches the app  ### ChatGPT plan  Plus  ### ChatGPT surface and workspace type  Chat, Personal workspace  ### What happened  After Compact & Resume, ChatGPT correctly moves from source conversation A to replacement conversation B, but CoS can create a new local session for B instead of rebinding the existing durable local session A→B. The user-visible result is a new in-app chat/session after handoff, sometimes equivalent to the prior “replacement chat belongs to another local session” failure from #218.  In v2.1.26 the session-transfer primitive itself is correct. The race is earlier: the recorder’s anti-shadow gate (RESUME_CLAIM_WINDOW_MS = 60_000) starts at continuation claim. If model-picker/composer work takes more than 60 seconds before destination Send, that gate expires while B does not exist yet. When Send finally mints B, the recorder can observe B as unknown with the gate false and create a fresh local session before the A→B continuation commit. The commit then sees B already owned by another local session.  Expected: Compact & Resume must always keep the same durable local COS session and rebind it from ChatGPT A to ChatGPT B; B must never become a separate local session because of a slow pre-Send provider UI transition.  ### Steps to reproduce  1. Start a recorded COS se
  **Post-Mortem & Fix Analysis**:
  > Thanks @m1d0e1, confirmed on `main`: the recorder's anti-shadow gate (`RESUME_CLAIM_WINDOW_MS`, 60 s in `resume-gate.ts`) starts at continuation claim, so a slow model picker or composer before the destination Send can let it lapse just before ChatGPT mints chat B.  Re-arming the existing gate with `noteResumeClaim(token)` at the exact point the destination Send is durably `dispatched-unresolved` is the right, narrow fix: no wider window, and no late merging of a second session. Would you open a PR for it, separately from #1006, with the regression you described (claim → advance past the window → dispatch → gate is open again)? Same house rules as on #1006. If you'd rather not, say so and we'll do it. 

- **Issue #1006** (2026-10-03): **v2.1.26 regression: worker bootstrap can time out after model selection because composer readiness is capped at 12s**
  *Symptoms*: ### App version  2.1.26  ### Operating system and version  Windows 11 Pro 25H2, build 26200.9457  ### Architecture  x64 (Intel/AMD)  ### Was the Chrome extension connected?  Yes, and its version matches the app  ### ChatGPT plan  Plus  ### ChatGPT surface and workspace type  Chat, Personal workspace  ### What happened  Intermittently CoS opens a fresh worker chat, completes model/reasoning selection, but never sends the worker bootstrap. The worker then fails with the generic “the chat this app opened did not report back in time” message.  This is a regression/remaining case after #469 / PR #470. v2.1.26 reacquires the composer after model selection, but the post-picker wait is still hard-coded to 12 seconds even though the broker command has a much longer lease. In retained logs I found 33 failures with the specific post-model error (“ChatGPT never re-exposed a usable composer after model selection”, including localized equivalents). In the same run one worker could succeed while another failed, which points to a per-tab provider/composer transition rather than a global broker/config failure.  Expected: once the requested model/reasoning is confirmed, bootstrap delivery should keep waiting for the current writable composer while the exact worker command/route is still valid, then send once. It must still fail closed if ownership/route expires, preserve real user drafts, and never blindly resend after an uncertain native Send.  ### Steps to reproduce  1. Enable background cha
  **Post-Mortem & Fix Analysis**:
  > Thank you @m1d0e1, this is an excellent report. I checked it against `main`: the post-picker wait really is a fixed `waitForComposer(12_000, …)` in `content.js`, while the command's lease is far longer, so a slow composer remount loses the bootstrap for no good reason. It very likely also explains the fresh workers stuck on a loaded `?clf=` page in #882 (3 in 10 when five start at once).  Your fix direction is right, all three parts of it: bound the wait by the command's remaining lease (keeping a reserve for Send and its receipt), require a connected **and writable** composer and watch the attributes that change that, and ignore stale copies hidden by CSS without relying on client rects. Since you already have it tested, would you open a PR? A few house rules that make review quick (the PR template has them):  - one PR for this fix, with your regression tests; the "Fail-first test" check proves they fail on `main`; - `## Why` / `## What changed` in plain words, `No visual change: …`; 

- **Issue #1005** (2026-10-03): **v2.1.26: worker bootstrap can still miss the composer after model selection exceeds the 12s readiness window**
  *Symptoms*: ### App version  2.1.26  ### Operating system and version  Windows 25H2 build 26200.9457  ### Architecture  x64 (Intel/AMD)  ### Was the Chrome extension connected?  Yes, and its version matches the app  ### ChatGPT plan  Plus  ### ChatGPT surface and workspace type  Chat / Personal workspace  ### What happened  On v2.1.26, a fresh worker chat can open successfully but never receive its bootstrap task after model/reasoning selection. The user-visible result is an intermittent worker start failure such as:  `the chat this app opened did not report back in time`  or the more specific browser-side failure:  `ChatGPT never re-exposed a usable composer after model selection`  This is a follow-on regression/gap after #469 / #470. That fix correctly reacquired the composer after model selection, but v2.1.26 still hard-codes the post-picker wait to 12 seconds and treats "connected" as sufficient readiness. ChatGPT can take longer than 12s to remount/re-enable the editor in a background worker tab, can leave a stale editor hidden only by CSS, or can flip the same editor from non-writable to writable using attributes only.  Retained logs from the affected v2.1.26 installation contained 33 identical post-model composer failures (30 localized French, 3 English). In the same multi-worker run, one worker bound normally while another timed out, which points to a per-tab startup/readiness race rather than a global broker or model-configuration failure.  Expected behavior: once the requested 

- **Issue #969** (2026-10-02): **model confirmation fails when sending replies in an existing chat**
  *Symptoms*: ### App version  2.1.15  ### Operating system and version  w11 24h2   ### Architecture  x64 (Intel/AMD)  ### Was the Chrome extension connected?  Yes, and its version matches the app  ### ChatGPT plan  Pro  ### ChatGPT surface and workspace type  n/a  ### What happened  Sending a message from the desktop app in an existing conversation failed with "Requested model or reasoning could not be confirmed"  The native model picker worked but CoS couldn't confirm the selection. New chats worked, until first reply. This happened in Brave, I haven't tried other browsers.  I expected CoS to send the message.  ### Steps to reproduce  1. Send a message to an existing conversation 2. It fails with "Requested model or reasoning could not be confirmed" 3. Refreshing models in the affected conversation also returns "picker_unavailable"  ### Anything else  ```text models=0 elapsed_ms=15069 error=picker_unavailable ```  A read-only console check measured the path to Reacts root: ```json {   "depth": 405, } ```  `committedPath()` in extension/fiber.js stops after 400 ancestors, so it never reached the root and rejected the valid picker state. Changing the limit from 400 to 1024 fixed sending. 
  **Post-Mortem & Fix Analysis**:
  > @ferrarinobrakes thank you, that is an exemplary report: the depth measurement pointed straight at the cause. Current `main` still had the same 400-level limit, so this would have hit everyone as soon as ChatGPT's page grew deeper. #970 raises it (and a second walk with the same ceiling, for the page's query client) to 2048 levels, with a test that places the turn 450 levels deep. It will be in 2.1.26.  One more thing: you are on 2.1.15, and a lot of send and recovery fixes have landed since. Please update once 2.1.26 is out. If anything still fails there, the log lines around "could not be confirmed" are the useful part. 

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

### Incident Patch 1: `d00c5048` (2026-10-06)
**Commit Message**: Merge pull request #1144 from Maximapple/fix/design-alignment

Center the Setup check marks, balance Health, keep the chat out of Agents & automation

**File**: `scripts/verify-chat-stays-at-end.cjs` (modified, +35/-5)
```diff
@@ -70,11 +70,41 @@ app.whenReady().then(async () => {
     // Shrink the window too, like opening the bottom terminal.
     win.setContentSize(1100,560); await pause(700);
     v=await view(); assert.ok(v.gap<=2 && v.lastVisible, 'stays at the end when the window shrinks: '+JSON.stringify(v));
-    // A reader who scrolled up keeps their place.
-    await js(`document.getElementById('chatBody').scrollTop=100`); await pause(300);
+    // A reader who scrolled up keeps their place. Only the reader's own scrolling counts as reading
+    // (a script setting scrollTop does not), so scroll with the wheel.
+    const pane=await js(`(()=>{const r=document.getElementById('chatBody').getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)}})()`);
+    for(let i=0;i<4;i++){win.webContents.sendInputEvent({type:'mouseWheel',x:pane.x,y:pane.y,deltaX:0,deltaY:240});await pause(120);}
+    await pause(500);
+    v=await view(); const place=v.top;
+    assert.ok(v.gap>200, 'scrolled up with the wheel: '+JSON.stringify(v));
     await js(`(()=>{const i=document.getElementById('chatInput');i.value='';i.dispatchEvent(new Event('input',{bubbles:true}));return 1})()`);
     await pause(700);
-    v=await view(); assert.ok(Math.abs(v.top-100)<=2, 'keeps a scrolled-up place: '+JSON.stringify(v));
-    console.log('PASS: the chat stays at its end when the message box or window shrinks, and keeps a scrolled-up reader in place.');
+    v=await view(); assert.ok(Math.abs(v.top-place)<=2, 'keeps a scrolled-up place: '+JSON.stringify({...v,place}));
+    // Agents & automation shows in the chat's own scroll pane. Reached the usual way (Settings opens
+    // Workspace first), it starts at its top without the chat's jump control, reading it is not
+    // reading the chat, and the chat comes back at its end, still following.
+    await js(`document.getElementById('jumpLatest').click()`); await pause(700);
+    v=await view(); assert.ok(v.gap<=2 && v.lastVisible, 'back at the end before Settings: '+JSON.stringify(v));
+    await js(`document.getElementById('workspaceSettings').click()`); await pause(300);
+    await js(`document.querySelector('#tabs button[data-tab="settings"]').click()`); await pause(700);
+    const agents=()=>js(`(()=>{const p=document.getElementById('chatBody');return {top:Math.round(p.scrollTop),max:p.scrollHeight-p.clientHeight,
+      jump:document.getElementById('jumpLatest').classList.contains('is-shown'),timeline:!document.getElementById('timelineContent').hidden}})()`);
+    let a=await agents();
+    assert.ok(a.max>200 && !a.timeline, 'Agents & automation fills the pane: '+JSON.stringify(a));
+    assert.equal(a.top,0,'Agents & automation opens at its top');
+    assert.equal(a.jump,false,'No jump-to-latest control over the settings');
+    const box=await js(`(()=>{const r=document.getElementById('chatBody').getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)}})()`);
+    for(const deltaY of [-240,-240,-240,240]){win.webContents.sendInputEvent({type:'mouseWheel',x:box.x,y:box.y,deltaX:0,deltaY});await pause(120);}
+    await pause(600);
+    a=await agents();
+    assert.ok(a.top>0 && a.top<a.max, 'the settings were scrolled to a middle: '+JSON.stringify(a));
+    assert.equal(a.jump,false,'Still no jump-to-latest control while reading the settings');
+    fs.writeFileSync(path.join(output,'agents-scrolled.png'),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());
+    await js(`document.getElementById('backToChat').click()`); await pause(700);
+    v=await view(); assert.ok(v.gap<=2 && v.lastVisible, 'the chat comes back at its end: '+JSON.stringify(v));
+    win.setContentSize(1100,480); await pause(700);
+    v=await view(); assert.ok(v.gap<=2 && v.lastVisible, 'and still follows when its area shrinks: '+JSON.stringify(v));
+    console.log('PASS: the chat stays at its end when the message box or window shrinks, keeps a scrolled-up reader in place, and is not moved by Agents & automation.');
   } finally { win?.destroy(); await server.close(); app.quit(); }
-});
+// A failed assertion must fail the check: quitting alone exits 0 and reads as a pass.
+}).catch(error => { console.error(error); app.exit(1); });
```

**File**: `scripts/verify-follow-output.cjs` (modified, +2/-1)
```diff
@@ -82,4 +82,5 @@ app.whenReady().then(async () => {
     assert.ok(await gap()>=200, 'switched off, growth outside a repaint is not followed: gap '+(await gap()));
     console.log('PASS: the chat follows growth at its end, holds a reader who scrolled up, resumes at the end, and stays put when switched off.');
   } finally { win?.destroy(); await server.close(); app.quit(); }
-});
+// A failed assertion must fail the check: quitting alone exits 0 and reads as a pass.
+}).catch(error => { console.error(error); app.exit(1); });
```

**File**: `scripts/verify-settings-layout.cjs` (modified, +78/-1)
```diff
@@ -231,7 +231,84 @@ app.whenReady().then(async () => {
       })()`);
       for (const result of dockChecks) assert.deepEqual(result, { fullWidth: true, hidden: true, contentVisible: true, restored: true });
     }
-    console.log('Settings layout passed: six pages, two themes, two widths, two zooms, live Usage renderer and long folder paths.');
+    // Optical alignment, measured on real pixels: a box can be centered while its glyph is not.
+    // Insets are CSS px from the element's inner edges to the first drawn pixel on each side.
+    const inkInsets = async element => {
+      // Settings scroll smoothly; the rect is read only after an instant scroll has landed.
+      await js(`${element}.scrollIntoView({ block: 'center', behavior: 'instant' })`);
+      await js('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
+      const box = await js(`(() => { const el = ${element}, r = el.getBoundingClientRect(), s = getComputedStyle(el);
+        return { x: r.left, y: r.top, width: r.width, height: r.height, border: parseFloat(s.borderTopWidth) || 0,
+          round: parseFloat(s.borderTopLeftRadius) >= r.width / 2 - 1 }; })()`);
+      const rect = { x: Math.floor(box.x), y: Math.floor(box.y) };
+      rect.width = Math.ceil(box.x + box.width) - rect.x; rect.height = Math.ceil(box.y + box.height) - rect.y;
+      const image = await win.webContents.capturePage(rect);
+      // The capture is in device pixels while its reported scale factor can stay 1.
+      const { width, height } = image.getSize(), bitmap = image.toBitmap(), scale = width / rect.width;
+      const at = (x, y) => { const i = (y * width + x) * 4; return [bitmap[i], bitmap[i + 1], bitmap[i + 2]]; };
+      // Inside the border; a round element is read inside its circle so the edge never counts as ink.
+      const left = (box.x - rect.x + box.border + 1) * scale, top = (box.y - rect.y + box.border + 1) * scale;
+      const right = (box.x - rect.x + box.width - box.border - 1) * scale, bottom = (box.y - rect.y + box.height - box.border - 1) * scale;
+      const cx = (left + right) / 2, cy = (top + bottom) / 2, radius = (right - left) / 2;
+      const inside = (x, y) => !box.round || (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= radius ** 2;
+      const counts = new Map();
+      for (let y = Math.ceil(top); y < bottom; y++) for (let x = Math.ceil(left); x < right; x++) if (inside(x, y)) {
+        const key = at(x, y).join(); counts.set(key, (counts.get(key) || 0) + 1);
+      }
+      const fill = [...counts].sort((a, b) => b[1] - a[1])[0][0].split(',').map(Number);
+      const diff = (x, y) => at(x, y).reduce((sum, value, i) => sum + Math.abs(value - fill[i]), 0);
+      let strongest = 0;
+      for (let y = Math.ceil(top); y < bottom; y++) for (let x = Math.ceil(left); x < right; x++) if (inside(x, y)) strongest = Math.max(strongest, diff(x, y));
+      const threshold = Math.max(36, strongest * 0.4), ink = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
+      for (let y = Math.ceil(top); y < bottom; y++) for (let x = Math.ceil(left); x < right; x++) if (inside(x, y) && diff(x, y) > threshold) {
+        ink.left = Math.min(ink.left, x); ink.right = Math.max(ink.right, x + 1); ink.top = Math.min(ink.top, y); ink.bottom = Math.max(ink.bottom, y + 1);
+      }
+      assert.ok(Number.isFinite(ink.left), 'Something is drawn in ' + element);
+      return { left: (ink.left - left) / scale, right: (right - ink.right) / scale, top: (ink.top - top) / scale, bottom: (bottom - ink.bottom) / scale };
+    };
+    const showPage = page => js(`(() => {
+      for (const panel of document.querySelectorAll('.panel')) panel.classList.toggle('is-active', panel.dataset.panel === '${page}');
+      for (const view of document.querySelectorAll('[data-view]')) view.hidden = view.dataset.view !== 'settings';
+      for (const animation of document.getAnimations()) if (Number.isFinite(animation.effect.getComputedTiming().endTime)) animation.finish();
+    })()`);
+    const offCenter = [];
+    win.setSize(1440, 950); win.webContents.setZoomFactor(1);
+    for (const theme of ['dark', 'light']) {
+      await js(`document.documentElement.dataset.theme = '${theme}'`);
+      // Every Setup step's check mark, done and ready; the green marks once sat low and right.
+      await showPage('setup');
+      await js(`document.querySelectorAll('.setup-rail li').forEach(li => { li.classList.add('is-done'); li.classList.remove('is-current'); })`);
+      const marks = await js(`document.querySelectorAll('.setup-rail-mark').length`);
+      assert.ok(marks >= 7, 'All Setup steps are on the rail');
+      for (let index = 0; index < marks; index++) {
+        const ink = await inkInsets(`document.querySelectorAll('.setup-rail-mark')[${index}]`);
+        // At 1x a device pixel is a whole CSS pixel, so snapping alone can leave 1 px; the bug was 2.5–3.7 px.
+        if (Math.abs(ink.left - ink.right) 
```

**File**: `src/renderer/chat.ts` (modified, +28/-5)
```diff
@@ -2327,9 +2327,20 @@ function distanceFromTail(): number {
   return pane.scrollHeight - reserve - pane.clientHeight - pane.scrollTop;
 }
 
+/**
+ * The chat and Agents & automation share one scroll pane (#chatBody). Reading position, following,
+ * the jump control and history paging belong to the chat alone, so they act only while it shows.
+ */
+function timelineShown(): boolean {
+  return !$('timelineContent').hidden;
+}
+
+/** The chat's own scroll position while another view of the pane is shown. */
+let timelineScrollTop: number | null = null;
+
 function paintJumpLatest(): void {
   const jump = document.getElementById('jumpLatest');
-  if (jump) jump.classList.toggle('is-shown', !!selectedId && distanceFromTail() > JUMP_DISTANCE);
+  if (jump) jump.classList.toggle('is-shown', !!selectedId && timelineShown() && distanceFromTail() > JUMP_DISTANCE);
 }
 
 function jumpToLatest(): void {
@@ -2472,7 +2483,7 @@ function toolBody(event: Extract<SessionEvent, { kind: 'tool_call' }>, context?:
 /** A batch is storage work, not a wheel detent. Fill the requested visible edge
  * through hidden events/collapsed activity, yielding between bounded IPC reads. */
 function requestHistory(direction: number, opening = false): void {
-  if (!selectedId || detailFor !== selectedId || !direction) return;
+  if (!selectedId || detailFor !== selectedId || !direction || !timelineShown()) return;
   historyDemand = { sessionId: selectedId, selection: selectionGeneration, direction, opening };
   void fillTimelineHistory();
 }
@@ -3614,7 +3625,7 @@ function paintDetail(followBottom = historyBefore === null): void {
   reconcileChildren($('timeline'), groupImageRows(groupToolRows(timelineRows)));
   paintPendingInputs();
   $('timelineEmpty').hidden = selectedId !== null || timelineRows.length > 0 || $('inputQueue').childElementCount > 0;
-  if (!holdSentMessage()) restoreViewport();
+  if (timelineShown() && !holdSentMessage()) restoreViewport();
   paintJumpLatest();
 
   const facts: string[] = [];
@@ -5499,6 +5510,9 @@ export function openChatView(name: string): void {
 }
 
 function showView(name: string): void {
+  const pane = $('chatBody');
+  const leavingTimeline = timelineShown() && name !== 'timeline';
+  if (leavingTimeline) timelineScrollTop = pane.scrollTop;
   $('composer').hidden = name === 'settings';
   $('composerDock').hidden = name === 'settings';
   $('inputQueue').hidden = name !== 'timeline';
@@ -5509,6 +5523,14 @@ function showView(name: string): void {
     view.hidden = view.dataset.view !== name;
   }
   $('chatSettingsBtn').classList.toggle('is-on', name === 'settings');
+  // Another view starts at its top; the chat comes back where its reader left it, or at its end
+  // when it was following.
+  if (leavingTimeline) pane.scrollTop = 0;
+  else if (name === 'timeline' && timelineScrollTop !== null) {
+    pane.scrollTop = readerAtEnd && !sendAnchor && !readingAfterSend ? pane.scrollHeight : timelineScrollTop;
+    timelineScrollTop = null;
+  }
+  paintJumpLatest();
 }
 
 function selectSession(id: string): void {
@@ -5998,7 +6020,7 @@ export function initChat(next: Deps): void {
     }, { passive: true, capture: true });
     window.addEventListener('keydown', event => { if (event.key === 'Escape' && heldPointer?.released) clearIntent(); }, { capture: true });
     pane.addEventListener('scroll', () => {
-      if (intent?.generation === selectionGeneration) {
+      if (intent?.generation === selectionGeneration && timelineShown()) {
         intent.scrolled = true;
         if (heldPointer?.released) heldPointer = null;
         // The absolute end, reserve included: scrolling up out of an underfilled page's blank
@@ -6091,7 +6113,7 @@ export function initChat(next: Deps): void {
     let lastHeight = historyPane.clientHeight;
     new ResizeObserver(() => {
       const height = historyPane.clientHeight;
-      if (height !== lastHeight && readerAtEnd && !sendAnchor && !readingAfterSend) historyPane.scrollTop = historyPane.scrollHeight;
+      if (height !== lastHeight && timelineShown() && readerAtEnd && !sendAnchor && !readingAfterSend) historyPane.scrollTop = historyPane.scrollHeight;
       lastHeight = height;
     }).observe(historyPane);
   }
@@ -6109,6 +6131,7 @@ export function initChat(next: Deps): void {
     // badge can move the height by a rounding pixel, and following that moved every message.
     let observedHeight = $('chatBody').scrollHeight;
     const observer = new ResizeObserver(() => {
+      if (!timelineShown()) return;
       holdSentMessage();
       // Growth that no repaint saw (a row expanding, an image loading, streamed text): follow it
       // while the reader is at the end. Older history pages never follow.
```

**File**: `src/renderer/main.ts` (modified, +4/-2)
```diff
@@ -186,8 +186,6 @@ function showTab(name: string): void {
   $('backToChat').hidden = !settings;
   document.querySelector<HTMLElement>('.sidebar-sessions')!.hidden = settings;
   $('newChat').hidden = settings;
-  if (name === 'settings') openChatView('settings');
-  else if (name === 'chat') openChatView('timeline');
 
   for (const tab of document.querySelectorAll<HTMLElement>('nav button')) {
     tab.classList.toggle('is-sel', tab.dataset.tab === name);
@@ -196,6 +194,10 @@ function showTab(name: string): void {
   for (const panel of document.querySelectorAll<HTMLElement>('.panel')) {
     panel.classList.toggle('is-active', panel.dataset.panel === (name === 'settings' ? 'chat' : name));
   }
+  // After the panel shows: the chat and Agents & automation share its scroll pane, and a hidden
+  // pane cannot be scrolled to where each view starts.
+  if (name === 'settings') openChatView('settings');
+  else if (name === 'chat') openChatView('timeline');
   // The Chat panel is the only one that costs anything to keep fresh, so it only
   // reloads while it is on screen.
   chatVisible(name === 'chat' || name === 'settings');
```

**File**: `src/renderer/styles.css` (modified, +10/-4)
```diff
@@ -1295,14 +1295,16 @@ main {
 
 /* ------------------------------------------------------------------ health */
 
+/* The two figures sit optically centered between the card's top edge and the facts divider. */
 .big {
   display: flex;
   gap: 26px;
-  padding: 3px 14px 12px;
+  padding: 13px 14px 14px;
 }
 
 .big b {
   display: block;
+  line-height: 1.15;
   font-size: calc(22px * var(--text-scale, 1));
   font-weight: 650;
   letter-spacing: -0.02em;
@@ -1319,6 +1321,9 @@ main {
 }
 
 .big span {
+  display: block;
+  margin-top: 3px;
+  line-height: 1.3;
   font-size: calc(11px * var(--text-scale, 1));
   color: var(--faint);
 }
@@ -1751,15 +1756,16 @@ details.connector[open] > summary::before { rotate: 90deg; }
   transition: border-color 160ms ease-out, background-color 160ms ease-out, color 160ms ease-out, box-shadow 160ms ease-out;
 }
 .setup-rail-mark::before { content: counter(setup-rail); }
-.setup-rail-mark .ico { display: none; --ico: 15px; }
+/* Phosphor's check sits low in its em box (its ink spans 64–208 of 256); lift it to the optical center. */
+.setup-rail-mark .ico { display: none; --ico: 15px; translate: 0 -1px; }
 .setup-rail-ready .setup-rail-mark::before { content: none; }
-.setup-rail-ready .setup-rail-mark .ico { display: block; }
+.setup-rail-ready .setup-rail-mark .ico { display: inline-flex; }
 .setup-rail-label { max-width: 100%; overflow: hidden; font-size: calc(12px * var(--text-scale, 1)); font-weight: 550; text-overflow: ellipsis; white-space: nowrap; }
 .setup-rail button:hover .setup-rail-mark { border-color: var(--accent-edge); color: var(--ink); }
 .setup-rail button:hover .setup-rail-label { color: var(--ink); }
 .setup-rail li.is-done .setup-rail-mark { border-color: var(--green-line); background: var(--green-wash); color: var(--green); }
 .setup-rail li.is-done .setup-rail-mark::before { content: none; }
-.setup-rail li.is-done .setup-rail-mark .ico { display: block; }
+.setup-rail li.is-done .setup-rail-mark .ico { display: inline-flex; }
 .setup-rail li.is-current .setup-rail-mark { border-color: var(--accent-edge); background: var(--accent-wash); color: var(--ink); }
 .setup-rail button[aria-current="step"] .setup-rail-mark { border-color: var(--accent); box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 22%, transparent); }
 .setup-rail button[aria-current="step"] .setup-rail-label { color: var(--ink); font-weight: 650; }
```

**File**: `test/renderer-timeline.test.ts` (modified, +25/-0)
```diff
@@ -4641,6 +4641,31 @@ it('offers a way back to the end of the chat that clears any reserved space', as
   expect(content.style.getPropertyValue('--timeline-scroll-reserve')).toBe('');
 });
 
+it('keeps the chat reading state out of Agents & automation, which shares its scroll pane', async () => {
+  const { w, append } = await boot([{ kind: 'assistant_message', seq: 1, time: T0 + 1000, source: 'extension', messageId: 'first', message: text('Hello'), final: false }]);
+  const pane = w.document.getElementById('chatBody')!;
+  const jump = w.document.getElementById('jumpLatest')!;
+  // The real navigation: the Agents & automation tab, then Back to chat.
+  const view = (name: string) => (w.document.querySelector(name === 'settings' ? 'nav button[data-tab="settings"]' : '#backToChat') as HTMLButtonElement).click();
+  Object.defineProperties(pane, { clientHeight: { value: 400, configurable: true }, scrollHeight: { value: 2000, configurable: true } });
+  pane.scrollTop = 1600;
+  // Settings open at their top, not at the chat's end, and offer no way back to a chat end.
+  view('settings');
+  expect(pane.scrollTop).toBe(0);
+  expect(jump.classList.contains('is-shown')).toBe(false);
+  // Reading the settings upwards is not reading the chat.
+  pane.scrollTop = 900;
+  pane.dispatchEvent(new w.WheelEvent('wheel', { deltaY: -120 }));
+  pane.dispatchEvent(new w.Event('scroll'));
+  expect(jump.classList.contains('is-shown')).toBe(false);
+  // Back in the chat, it is still at its end and still follows new output.
+  view('timeline');
+  expect(pane.scrollTop).toBe(2000);
+  await append([{ kind: 'assistant_message', seq: 2, time: T0 + 2000, source: 'extension', messageId: 'later', message: text('More output'), final: false }]);
+  expect(pane.scrollTop).toBe(pane.scrollHeight);
+  expect(jump.classList.contains('is-shown')).toBe(false);
+});
+
 it('opens round participants in the existing dock without moving the prime reader or draft', async () => {
   const report = (seq: number, worker: string): SessionEvent => ({ kind: 'agent_message', seq, time: T0 + seq * 1000,
     source: 'app', from: worker, to: 'prime', messageId: `report-${seq}`, delivery: 'delivered', message: text('Verified the build') });
```

---

### Incident Patch 2: `2254915a` (2026-10-06)
**Commit Message**: Merge pull request #1145 from Maximapple/fix/worker-default-automatic

Show an unset sub-agent default as Automatic instead of an empty select

**File**: `src/renderer/chat-models.ts` (modified, +8/-4)
```diff
@@ -152,6 +152,10 @@ function paintPair(modelId: string, effortId: string, modelValue?: string, effor
   const effort = document.getElementById(effortId) as HTMLSelectElement | null;
   if (!model || !effort) return;
   const models = modelId === 'composerModel' ? composerModels() : catalog.models;
+  // No saved sub-agent default starts workers on ChatGPT's current model. The select says so as
+  // Automatic instead of naming a model nothing would use; a model picked there still gets its
+  // preferred effort.
+  const automaticModel = allowEmpty || modelId === 'workerModel';
   let nextModel = modelValue ?? model.value;
   let nextEffort = effortValue ?? effort.value;
   const observed = observedModel(nextModel);
@@ -160,15 +164,15 @@ function paintPair(modelId: string, effortId: string, modelValue?: string, effor
     // cannot prove which efforts that alias supports. Retain both requested values
     // until the user deliberately selects a family; native selection proves the pair.
     const modelChoices = [...distinctModelChoices(models), { id: nextModel, label: `${observed.label} · ${nextModel}` }];
-    if (allowEmpty) modelChoices.unshift({ id: '', label: () => t('Automatic') });
+    if (automaticModel) modelChoices.unshift({ id: '', label: () => t('Automatic') });
     options(model, modelChoices, nextModel);
     const effortChoices = [{ id: nextEffort, label: () => nextEffort ? effortLabel(nextEffort) : t('Keep requested model settings') }];
     if (allowEmpty && nextEffort) effortChoices.unshift({ id: '', label: () => t('Automatic') });
     options(effort, effortChoices, nextEffort);
     return;
   }
   nextModel = observed?.id ?? nextModel;
-  if (models.length && !nextModel && !allowEmpty && !(modelId === 'composerModel' && composerContext?.automatic)) {
+  if (models.length && !nextModel && !automaticModel && !(modelId === 'composerModel' && composerContext?.automatic)) {
     // A preference selects only a model/effort actually observed in this catalog.
     const preferred = models.find(item => /^gpt[ -]?6$/i.test(item.label) && item.efforts.includes('high'));
     nextModel = (preferred ?? models[0]!).id;
@@ -179,10 +183,10 @@ function paintPair(modelId: string, effortId: string, modelValue?: string, effor
     nextEffort = supported.includes('high') ? 'high' : supported[0] ?? '';
   }
   const modelChoices = distinctModelChoices(models);
-  if (allowEmpty) modelChoices.unshift({ id: '', label: () => t('Automatic') });
+  if (automaticModel) modelChoices.unshift({ id: '', label: () => t('Automatic') });
   const effortChoices: Array<{ id: string; label: string | (() => string) }> =
     (models.find(item => item.id === nextModel)?.efforts ?? []).map(id => ({ id, label: () => effortLabel(id) }));
-  if (allowEmpty) effortChoices.unshift({ id: '', label: () => t('Automatic') });
+  if (allowEmpty || (automaticModel && !nextModel)) effortChoices.unshift({ id: '', label: () => t('Automatic') });
   options(model, modelChoices, nextModel);
   options(effort, effortChoices, nextEffort);
 }
```

**File**: `test/renderer-chat-models.test.ts` (modified, +19/-3)
```diff
@@ -269,8 +269,24 @@ it('disambiguates duplicate account model labels by their observed lane', async
   const { initChatModels, applyChatModels } = await import('../src/renderer/chat-models.js');
   initChatModels(); applyChatModels({ multiAgent: {}, goal: {} } as Config); await Promise.resolve();
   const labels = [...dom.window.document.querySelectorAll<HTMLOptionElement>('#workerModel option')].map(option => option.textContent);
-  expect(labels).toEqual(['5.6 · Instant', '5.6 · Reasoning', '5.5 · Instant', '5.5 · Reasoning']);
-  expect([...dom.window.document.querySelectorAll<HTMLOptionElement>('#workerModel option')].map(option => option.value)).toEqual(models.map(model => model.id));
+  expect(labels).toEqual(['Automatic', '5.6 · Instant', '5.6 · Reasoning', '5.5 · Instant', '5.5 · Reasoning']);
+  expect([...dom.window.document.querySelectorAll<HTMLOptionElement>('#workerModel option')].map(option => option.value)).toEqual(['', ...models.map(model => model.id)]);
+});
+
+it('shows a sub-agent default that was never chosen as Automatic, which is what workers then use', async () => {
+  dom = new JSDOM(await readFile('src/renderer/index.html', 'utf8'));
+  vi.stubGlobal('window', dom.window); vi.stubGlobal('document', dom.window.document);
+  const models = [{ id: 'gpt-6', label: 'GPT-6', efforts: ['medium', 'high'] }, { id: 'gpt-5-6', label: '5.6', efforts: ['none'] }];
+  Object.assign(dom.window, { api: { getChatModels: async () => ({ ok: true, data: { state: 'ready', requestedAt: 1, observedAt: 2, models } }) } });
+  const { initChatModels, applyChatModels } = await import('../src/renderer/chat-models.js');
+  initChatModels(); applyChatModels({ multiAgent: { defaultModel: '', defaultReasoning: '' }, goal: {} } as Config); await Promise.resolve();
+  const shown = (id: string) => { const select = dom.window.document.getElementById(id) as HTMLSelectElement; return [select.value, select.selectedOptions[0]?.textContent]; };
+  expect(shown('workerModel')).toEqual(['', 'Automatic']);
+  expect(shown('workerReasoning')).toEqual(['', 'Automatic']);
+  // A chosen default stays exactly that, with its own efforts.
+  applyChatModels({ multiAgent: { defaultModel: 'gpt-6', defaultReasoning: 'high' }, goal: {} } as Config); await Promise.resolve();
+  expect(shown('workerModel')).toEqual(['gpt-6', 'GPT-6']);
+  expect(shown('workerReasoning')).toEqual(['high', 'High']);
 });
 
 it('binds composer selection to the selected session across delayed catalog, user edits and A-B-A navigation', async () => {
@@ -612,7 +628,7 @@ it('preserves an observed saved execution slug together with its Pro reasoning',
   const { initChatModels, applyChatModels } = await import('../src/renderer/chat-models.js');
   initChatModels(); applyChatModels({ multiAgent: { defaultModel: 'gpt-5-6-pro', defaultReasoning: 'pro' }, goal: {} } as Config); await Promise.resolve();
   const model = dom.window.document.getElementById('workerModel') as HTMLSelectElement;
-  expect(model.value).toBe('gpt-5-6-pro'); expect(model.options).toHaveLength(2);
+  expect(model.value).toBe('gpt-5-6-pro'); expect([...model.options].map(option => option.value)).toEqual(['', '5.6', 'gpt-5-6-pro']);
   expect((dom.window.document.getElementById('workerReasoning') as HTMLSelectElement).value).toBe('pro');
 });
 it('preserves worker execution aliases without inferring a different family effort', async () => {
```

---

### Incident Patch 3: `a9d2a83d` (2026-10-05)
**Commit Message**: Merge pull request #1141 from Maximapple/fix/silent-recovery-reasons

Say why silence recovery leaves a chat alone (#1086)

**File**: `AGENTS.md` (modified, +8/-0)
```diff
@@ -1209,6 +1209,14 @@ New work withdraws an unspent ticket/pre-send claim and rearms the model's silen
 sends retain exclusive custody until their exact receipt or proven pre-send failure. Source work,
 document epoch, question, draft and native Send are rechecked across preparation awaits. An
 unclassified `stalled` end alone does not release a message; the refresh receipt is required.
+Every exit of the silence sweep that leaves a chat alone logs its reason once per grant and reason
+(`bridge: silence recovery for <chat> — …`): a Compact & Resume handoff owns it, no tool call is
+recorded for the turn (code-mode calls are often unattributed), a call of this chat or of an
+unknown chat is still running, the chat is blocked, recovery is off for it, its reload already
+happened, the page has not come back yet, or the work is no longer the current turn. A confirmed
+assistant-error reload also logs whether the chat is still under the silence watch, since the
+automatic Continue after it only comes from that watch (#1086: a log that went quiet after the
+reload could not say which of these held).
 
 At ordinary silence recovery, a never-offered immediate correction takes priority over generated
 Goal/Loop work and is sent as a normal native user message. Include at most the next eligible
```

**File**: `src/main/bridge.ts` (modified, +40/-3)
```diff
@@ -7969,24 +7969,48 @@ function browserRecoveryMonitoring(): boolean {
  * asks whether a conversation is still alive, so nothing scoped to one of its turns may switch
  * it off — see the supersede rule in `queueBrowserRecovery`.
  */
+/**
+ * Why silence recovery left a chat alone, said once per grant and reason (#1086).
+ *
+ * Every exit of the sweep used to be silent, so a chat that never got its automatic Continue left
+ * a log that simply stopped: the 2026-10-05 report showed a confirmed error reload and then
+ * seventeen quiet minutes. Repeated sweeps of the same grant say nothing new.
+ */
+const silenceNotes = new Set<string>();
+function noteSilence(conversationId: string, grant: ActivityGrant, reason: string): void {
+  const key = `${conversationId}:${grant.turnId ?? '-'}:${grant.sessionId}:${reason}`;
+  if (silenceNotes.has(key)) return;
+  silenceNotes.add(key);
+  if (silenceNotes.size > 500) for (const old of [...silenceNotes].slice(0, 100)) silenceNotes.delete(old);
+  logInfo(`bridge: silence recovery for ${conversationId} — ${reason}`);
+}
+
 async function inspectSilentChats(now: number): Promise<{ queued: boolean; spent: string[] }> {
   let queued = false;
   let deferred = false;
   const spent: string[] = [];
   const compacting = new Set(pendingContinuations().map((entry) => entry.from));
   for (const [conversationId, grant] of activeUntil) {
-    if (compacting.has(conversationId)) continue;
     if (grant.until > now) continue;
+    if (compacting.has(conversationId)) { noteSilence(conversationId, grant, 'a Compact & Resume handoff owns this chat\'s recovery'); continue; }
     // Observation owns liveness, never permission to interrupt the native page.
     // Only an exactly recorded local call in this source turn earns silence repair.
     if (!grant.turnId || !await turnHasMcpCall(grant.sessionId, conversationId, grant.turnId)) {
-      if (activeUntil.get(conversationId) === grant) spent.push(conversationId);
+      if (activeUntil.get(conversationId) === grant) {
+        noteSilence(conversationId, grant, grant.turnId
+          ? `not available: turn ${grant.turnId} has no tool call recorded for this chat (calls from ChatGPT's code mode are often not attributed)`
+          : 'not available: the silent work has no turn');
+        spent.push(conversationId);
+      }
       continue;
     }
     const pro = await extendedSilenceWindowFor(conversationId, grant.sessionId);
     const afterTurn = recoveryInputAllowed(grant.sessionId, conversationId) || loopAfterTurnFor(conversationId) || await hasQueuedAfterTurnInput(grant.sessionId);
     if (activeUntil.get(conversationId) !== grant) continue;
     if (runningToolProgress(conversationId) || (afterTurn && runningToolCalls(conversationId) > 0)) {
+      noteSilence(conversationId, grant, runningToolProgress(conversationId)
+        ? 'waiting: a tool call of this chat is still running'
+        : 'waiting: a tool call whose chat is not known yet is running, and it might be this chat\'s');
       grant.until = now + GOAL_QUIET_MS;
       deferred = true;
       continue;
@@ -7997,6 +8021,7 @@ async function inspectSilentChats(now: number): Promise<{ queued: boolean; spent
     // measured. (A blocked chat's worker slot is not this pass's business: sweepStaleSwarm
     // sleeps it from the block itself, grant or no grant.)
     if (isChatBlocked(conversationId)) {
+      noteSilence(conversationId, grant, 'not available: this chat is blocked');
       spent.push(conversationId);
       continue;
     }
@@ -8015,6 +8040,7 @@ async function inspectSilentChats(now: number): Promise<{ queued: boolean; spent
         deferred = true;
         continue;
       }
+      noteSilence(conversationId, grant, 'not available: automatic recovery is off for this chat and no Goal, Loop or queued message waits on it');
       spent.push(conversationId);
       continue;
     }
@@ -8025,6 +8051,7 @@ async function inspectSilentChats(now: number): Promise<{ queued: boolean; spent
         deferred = true;
         continue;
       }
+      noteSilence(conversationId, grant, `spent: its ${held.reason} reload already happened`);
       spent.push(conversationId);
       continue;
     }
@@ -8042,6 +8069,7 @@ async function inspectSilentChats(now: number): Promise<{ queued: boolean; spent
     // has run out.
     const lastReload = lastBrowserRecoveryAt.get(conversationId) ?? 0;
     if (awaitingReturn.has(conversationId) && now - lastReload < BROWSER_RECOVERY_COOLDOWN_MS) {
+      noteSilence(conversationId, grant, 'waiting: the page has not come back from the last reload yet');
       grant.until = lastReload + BROWSER_RECOVERY_COOLDOWN_MS;
       deferred = true;
       continue;
@@ -8054,7 +8082,10 @@ async function inspectSilentChats(now: number): Promise<{ queued: boolean; spent
         // Preserve its original silence deadline so a real page return does
         // not pretend to be fresh work or start another waiting window.
       
```

**File**: `test/bridge.test.ts` (modified, +35/-0)
```diff
@@ -8768,6 +8768,38 @@ describe('unattributed activity recovery', () => {
     } finally { vi.useRealTimers(); await saveConfig(previous); }
   });
 
+  it('says why silence recovery waits on a running call of unknown chat, and recovers once it ends (#1086)', async () => {
+    const previous = getConfig();
+    await saveConfig({ ...previous, ui: { ...previous.ui, autoContinue: true } });
+    vi.useFakeTimers();
+    try {
+      await pair();
+      const chat = randomUUID(), turnId = 'waits-on-unknown-call';
+      await events(chat, [
+        { kind: 'user_message', messageId: 'question', text: 'Review the changes', time: Date.now(), authoredNow: true },
+        { kind: 'model_selection', model: 'GPT-5.6 Sol', reasoningEffort: 'high', time: Date.now() },
+        openTurn(turnId)
+      ]);
+      await attributed(chat, false, Date.now());
+      const { trackInFlight, emptyEvidence } = await import('../src/main/mcp/call-context.js');
+      // Another chat's call that no page has claimed yet: it counts as possibly this chat's work.
+      await trackInFlight({ startedAt: Date.now(), transportKey: null, agent: null, outcome: null, evidence: emptyEvidence(),
+        caller: { conversationId: null, requestId: 'unknown-chat-call', transportKey: null } }, async () => {
+        for (let pass = 0; pass < 3; pass++) {
+          await vi.advanceTimersByTimeAsync(CHAT_SILENCE_MS);
+          await sweepStaleSwarm(Date.now());
+          expect(await maintenance()).toBeNull();
+        }
+      });
+      const why = getLog().filter(entry => entry.message.includes(`silence recovery for ${chat}`)).map(entry => entry.message);
+      expect(why).toEqual([expect.stringContaining('a tool call whose chat is not known yet is running')]);
+      // The call ended: the next pass recovers the chat.
+      await vi.advanceTimersByTimeAsync(GOAL_QUIET_MS);
+      await sweepStaleSwarm(Date.now());
+      expect(await maintenance()).toMatchObject({ conversationId: chat, reason: 'silence' });
+    } finally { vi.useRealTimers(); await saveConfig(previous); }
+  });
+
   it.each(['normal', 'pro'] as const)('keeps the %s silence countdown and reload valid across same-turn corrections', async model => {
     const previous = getConfig();
     await saveConfig({ ...previous, ui: { ...previous.ui, autoContinue: true } });
@@ -8839,6 +8871,9 @@ describe('unattributed activity recovery', () => {
         expect((await sessionControlsFor(session.id)).recovery).toEqual([]);
       }
       expect(getLog().filter(entry => entry.message.includes('asking the browser to reload') && entry.message.includes(chat))).toEqual([]);
+      // It says why, once, however often the sweep passes (#1086: these exits used to be silent).
+      const why = getLog().filter(entry => entry.message.includes(`silence recovery for ${chat}`)).map(entry => entry.message);
+      expect(why).toEqual([expect.stringContaining('spent: the silent work is no longer this chat\'s current turn')]);
     } finally { vi.useRealTimers(); await saveConfig(previous); }
   });
 
```

---

### Incident Patch 4: `a02fafd7` (2026-10-05)
**Commit Message**: Merge pull request #1142 from Maximapple/fix/unescape-stored-user-text

Show app-sent messages without Markdown escapes

**File**: `AGENTS.md` (modified, +6/-0)
```diff
@@ -1259,6 +1259,12 @@ While an exact send receipt still has a bounded evidence reader, the existing ob
 requests canonical MAIN-world text even after native generation stops. Rendered Markdown can
 remove submitted bytes; recognizing the generation must not be a prerequisite for reading the
 source needed to recognize its Send. Route, epoch and stable message identity still decide acceptance.
+Fiber reports ChatGPT's own mark for that storage (`serialization_metadata.render_format === 'markdown'`)
+as `markdown: true` on a user message when its message object carries it (the shell layout builds
+messages without metadata). Recorded `user_message` text is shown the way ChatGPT shows it
+(`shownUserText`): a marked copy is unescaped once, and so is an unmarked copy whose one-step
+unescape equals the text the page renders; a person's literal backslash is rendered and stays.
+Every comparison (receipts, handoff markers) still reads the raw stored text.
 ChatGPT stores text the page inserted Markdown-escaped (`` \`code\` ``, `\#`, `\<newline>`). A Goal
 reply's receipt is therefore marked `inserted` (`rememberUserSend(true)`; the page's own click and
 submit listeners that record the same Send again keep the mark) and is matched like a bootstrap:
```

**File**: `extension/content.js` (modified, +23/-4)
```diff
@@ -793,6 +793,21 @@
   // hard break kept its backslash, so the page never bound the worker until its turn had ended.
   // A third (#821): an indented line's first space reads back as `&#x20;`. A 96,000-character
   // opening never got its receipt, and the page held its input slot until it was reloaded.
+  /**
+   * The text of a user message as ChatGPT shows it. A message ChatGPT stored as Markdown (page-inserted
+   * text: Goal replies, app sends with the Core mention) comes back escaped, `\\`code\\`` for `code`;
+   * its flag says so. A plain copy is literal and stays exactly as typed.
+   */
+  const shownUserText = (text, markdown, rendered = null) => {
+    if (markdown) return unescapeMarkdown(text);
+    // ChatGPT's own rendering is the other proof: when the page shows exactly the unescaped text,
+    // the backslashes were storage escapes. A person's literal backslash is shown and stays.
+    if (typeof rendered === 'string' && rendered && text !== rendered && text.includes('\\')) {
+      const unescaped = unescapeMarkdown(text);
+      if (sendText(unescaped) === sendText(rendered)) return unescaped;
+    }
+    return text;
+  };
   const unescapeMarkdown = (value) => String(value || '').replace(/\\\r?\n/g, '\n').replace(/\\([!-\/:-@\[-`{-~])/g, '$1')
     .replace(/(^|\n)&#x20;/g, '$1 ');
   /** The leading continuation marker, as typed or as the composer escaped it. */
@@ -829,6 +844,7 @@
     // plain-text bubble retains the existing exact-text receipt contract; no Markdown stripping.
     const actual = authored.length === 1 ? authored[0].rawText : message.text;
     return typeof actual === 'string' && actual.length <= 256000 ? { text: actual, canonical: authored.length === 1,
+      markdown: authored.length === 1 && authored[0].markdown === true,
       ...(authored[0]?.attachments?.length ? { attachments: authored[0].attachments } : {}) } : null;
   }
   function userMessagePresent(message) {
@@ -2362,9 +2378,10 @@
         }
         markSeen(key, reaction);
         if (justAuthored) newUserMessage = justAuthored;
+        const shown = shownUserText(text, source.markdown, message.text);
         emit({
           kind: 'user_message',
-          text,
+          text: shown,
           ...(reaction !== undefined ? { reaction } : {}),
           ...(source.attachments?.length ? { attachments: source.attachments } : {}),
           messageId: message.id,
@@ -2373,7 +2390,7 @@
           ...(justAuthored ? { authoredNow: true } : {})
         });
         reportedUserMessages.delete(message.id);
-        reportedUserMessages.set(message.id, { text, createTime: null, conversationId: CLF_DOM.conversationId(), model: sentModel || null });
+        reportedUserMessages.set(message.id, { text: shown, createTime: null, conversationId: CLF_DOM.conversationId(), model: sentModel || null });
         if (reportedUserMessages.size > 256) reportedUserMessages.delete(reportedUserMessages.keys().next().value);
       } else if (message.role === 'assistant') {
         // Assistant identity/content comes exclusively from the MAIN-world Fiber scan now.
@@ -3636,6 +3653,8 @@
           /^[a-z0-9][a-z0-9._-]{0,63}$/i.test(entry.resolvedModel) ? { resolvedModel: entry.resolvedModel } : {}),
         ...(references ? { references } : {}),
         rawText,
+        // A boolean from MAIN; only `true` exactly means ChatGPT stored this as escaped Markdown.
+        ...(entry.role === 'user' && entry.markdown === true ? { markdown: true } : {}),
         ...(attachments.length ? { attachments } : {}),
         renderedHtml,
         sectionIndex:
@@ -4703,13 +4722,13 @@
           emit({
             kind: 'user_message',
             messageId: message.messageId,
-            text: message.rawText,
+            text: shownUserText(message.rawText, message.markdown === true, renderedUserTexts.get(message.messageId)),
             ...(message.attachments?.length ? { attachments: message.attachments } : {}),
             ...(sentModel ? { model: sentModel } : {}),
             ...(message.createTime ? { time: message.createTime, authoredTime: true, authoredAt: message.createTime } : {})
           });
           reportedUserMessages.delete(message.messageId);
-          reportedUserMessages.set(message.messageId, { text: message.rawText, createTime: message.createTime || null,
+          reportedUserMessages.set(message.messageId, { text: shownUserText(message.rawText, message.markdown === true, renderedUserTexts.get(message.messageId)), createTime: message.createTime || null,
             conversationId: CLF_DOM.conversationId(), model: sentModel || null });
           if (reportedUserMessages.size > 256) reportedUserMessages.delete(reportedUserMessages.keys().next().value);
           continue;
```

**File**: `extension/fiber.js` (modified, +3/-0)
```diff
@@ -690,6 +690,8 @@
         role: 'user',
         stable: true,
         rawText,
+        // ChatGPT's own mark for text it stored as escaped Markdown (page-inserted text).
+        ...(message.metadata?.serialization_metadata?.render_format === 'markdown' ? { markdown: true } : {}),
         ...(attachments.length ? { attachments } : {}),
         order: index,
         createTime: authoredTime(message)
@@ -1044,6 +1046,7 @@
         order: userCandidates[c].order,
         createTime: userCandidates[c].createTime,
         rawText: userCandidates[c].rawText,
+        ...(userCandidates[c].markdown ? { markdown: true } : {}),
         ...(userCandidates[c].attachments ? { attachments: userCandidates[c].attachments } : {}),
         renderedHtml: ''
       });
```

**File**: `test/content-script.test.ts` (modified, +24/-1)
```diff
@@ -889,7 +889,9 @@ describe('desktop input delivery and helper ownership', () => {
       await settle(); live.hook.observe(); await settle(); await live.hook.flush();
       const starts = emitted(live.sent, 'turn_start').length;
       if (acknowledge && !invalidate) {
-        expect(emitted(live.sent, 'user_message').filter(row => row.event.messageId === 'm-gated-spa-user').at(-1)?.event.text).toBe(canonical);
+        // Recorded the way ChatGPT shows it: the page renders the submitted text, so an escaped
+        // stored copy is recorded unescaped (the raw copy still decides the receipt above).
+        expect(emitted(live.sent, 'user_message').filter(row => row.event.messageId === 'm-gated-spa-user').at(-1)?.event.text).toBe(submitted);
         live.hook.observe(); await settle(); await live.hook.flush();
         expect(emitted(live.sent, 'turn_start')).toHaveLength(starts);
       }
@@ -3375,6 +3377,27 @@ describe('recording authored message text', () => {
 });
 
 describe('canonical Fiber transcript ingestion in 1.8', () => {
+  it.each([
+    ['marked as Markdown', true, 'Run `echo two` and keep #tags as they are.', 'Run `echo two` and keep #tags as they are.'],
+    ['unmarked but shown unescaped', false, 'Run `echo two` and keep #tags as they are.', 'Run `echo two` and keep #tags as they are.'],
+    ['unmarked and shown with its backslashes', false, 'Run \\`echo two\\` and keep \\#tags as they are.', 'Run \\`echo two\\` and keep \\#tags as they are.']
+  ] as const)('records a user message ChatGPT stored escaped (%s) the way ChatGPT shows it', async (_case, markdown, shown, recorded) => {
+    // ChatGPT stores page-inserted text (Goal replies, app-sent messages with the Core mention) as
+    // escaped Markdown and flags it; it shows the unescaped text. A plain copy is a person's literal.
+    live = await harness();
+    const stored = 'Run \\`echo two\\` and keep \\#tags as they are.';
+    const id = `stored-${_case.replaceAll(' ', '-')}`;
+    const section = userTurn(live.document, id, shown, { sent: false });
+    await bindFiberTurns([{ section, turn: { turnId: id, messages: [{ role: 'user', stable: true,
+      messageId: `m-${id}`, rawMessageId: `m-${id}`, rawText: stored, ...(markdown ? { markdown: true } : {}) }] } }]);
+    await live.hook.flush();
+    await settle();
+    live.hook.observe();
+    await live.hook.flush();
+    const users = emitted(live.sent, 'user_message').map(entry => entry.event).filter(event => event.messageId === `m-${id}`);
+    expect(users.at(-1)?.text).toBe(recorded);
+  });
+
   it('records a raw-provider-ID-only revision without changing canonical message identity', async () => {
     live = await harness();
     const section = assistantTurn(live.document, 'provider-id-revision-turn', []);
```

**File**: `test/fiber.test.ts` (modified, +15/-0)
```diff
@@ -863,6 +863,21 @@ describe('the calls a turn says it made', () => {
     expect(turns[0]!.messages[0]).toMatchObject({ role: 'user', rawText: authored_ });
   });
 
+  it.each([
+    ['marked', { serialization_metadata: { render_format: 'markdown' } }, true],
+    ['unmarked', {}, false],
+    ['marked with another format', { serialization_metadata: { render_format: 'plain' } }, false]
+  ] as const)('reports ChatGPT\'s own Markdown storage mark on a user message (%s)', async (_case, metadata, markdown) => {
+    const message = { ...authored('stored-user-message', 'Run \\`echo two\\`'), author: { role: 'user' } };
+    const { turns } = await scan([], [{
+      id: 'stored-user', messages: [{ ...message, metadata: { ...(message as { metadata?: object }).metadata, ...metadata } }],
+      conversationProps: { conversation: { id: THREAD } }
+    }]);
+    // The raw stored text stays for exact comparisons; the mark tells readers how ChatGPT shows it.
+    expect(turns[0]!.messages[0]).toMatchObject({ role: 'user', rawText: 'Run \\`echo two\\`' });
+    expect((turns[0]!.messages[0] as { markdown?: boolean }).markdown === true).toBe(markdown);
+  });
+
   it('keeps an ordinary Markdown link a user wrote', async () => {
     const { turns } = await scan([], [{
       id: 'link-user', messages: [{ ...authored('link-user-message', 'See [the docs](https://example.com/app) first.'), author: { role: 'user' } }],
```

---

### Incident Patch 5: `d2a8b8c8` (2026-10-05)
**Commit Message**: Document how recorded user text follows ChatGPT's rendering

**File**: `AGENTS.md` (modified, +5/-3)
```diff
@@ -1260,9 +1260,11 @@ requests canonical MAIN-world text even after native generation stops. Rendered
 remove submitted bytes; recognizing the generation must not be a prerequisite for reading the
 source needed to recognize its Send. Route, epoch and stable message identity still decide acceptance.
 Fiber reports ChatGPT's own mark for that storage (`serialization_metadata.render_format === 'markdown'`)
-as `markdown: true` on a user message. Recorded `user_message` text is shown the way ChatGPT shows it:
-a marked copy is unescaped once (`shownUserText`), a plain copy stays literal. Every comparison
-(receipts, handoff markers) still reads the raw stored text.
+as `markdown: true` on a user message when its message object carries it (the shell layout builds
+messages without metadata). Recorded `user_message` text is shown the way ChatGPT shows it
+(`shownUserText`): a marked copy is unescaped once, and so is an unmarked copy whose one-step
+unescape equals the text the page renders; a person's literal backslash is rendered and stays.
+Every comparison (receipts, handoff markers) still reads the raw stored text.
 ChatGPT stores text the page inserted Markdown-escaped (`` \`code\` ``, `\#`, `\<newline>`). A Goal
 reply's receipt is therefore marked `inserted` (`rememberUserSend(true)`; the page's own click and
 submit listeners that record the same Send again keep the mark) and is matched like a bootstrap:
```

---

### Incident Patch 6: `2030b29a` (2026-10-05)
**Commit Message**: Merge pull request #1100 from xuan2261/fix/pet-overlay-bounded-idle-shape

fix(pets): keep Windows idle overlay bounded

**File**: `AGENTS.md` (modified, +4/-0)
```diff
@@ -3301,6 +3301,10 @@ regeneration are documented in `docs/pet/PRODUCTION.md`; pet unit/DOM tests, `sc
 cover this owner without provider conversations.
 `scripts/verify-pet-performance.cjs` measures the production pet in isolated
 Electron with unchanged artwork, process CPU deltas and actual animation wakes.
+On Windows the desktop Pets host must receive a bounded native shape before it is
+shown, and it stays bounded to the visible pet/tray/menu regions while click-through.
+The `pet-overlay:bounds` projection advertises that idle-shape requirement to the
+renderer; Linux/macOS retain their existing full click-through visual-surface contract.
 
 `renderer/main.ts` owns the shell/setup/settings; `chat.ts` owns sessions, composer and timeline.
 Projects, workers, plans, model choice, usage and plugins have focused modules (§4). The renderer
```

**File**: `scripts/verify-pet-overlay-electron.cjs` (modified, +64/-15)
```diff
@@ -1,6 +1,6 @@
 // Exercise Pets with isolated userData against the built renderer or the live Vite dev renderer.
 // Run after `npm run build`; ELECTRON_RENDERER_URL=http://localhost:5173 also checks dev CSS loading.
-const { app, BrowserWindow } = require('electron');
+const { app, BrowserWindow, screen } = require('electron');
 const fs = require('node:fs');
 const os = require('node:os');
 const path = require('node:path');
@@ -31,6 +31,23 @@ app.setPath('userData', userData);
 app.setAppPath(root);
 process.env.CLF_BRIDGE_PORTS = '0';
 
+// Windows production proximity is owned by screen.getCursorScreenPoint(). Substitute only that
+// boundary so this fixture exercises the real sampler -> renderer -> IPC path without moving the
+// user's OS cursor. verify-pet-toggle.cjs owns the separate physical-pointer acceptance probe.
+let sampledCursor = { x: -1_000_000, y: -1_000_000 };
+app.whenReady().then(() => {
+  if (process.platform === 'win32') screen.getCursorScreenPoint = () => sampledCursor;
+});
+const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
+async function until(predicate, label, timeoutMs = 2500) {
+  const end = Date.now() + timeoutMs;
+  while (Date.now() < end) {
+    if (await predicate()) return;
+    await sleep(40);
+  }
+  throw new Error(`Timed out: ${label}`);
+}
+
 let found = false;
 const timeout = setTimeout(() => { console.error(`Pets overlay did not load; userData=${userData}`); app.exit(1); }, 30_000);
 // The product prewarms a provider tab before Pets. Keep that unrelated dependency local here.
@@ -119,30 +136,62 @@ function attachOverlay(win) {
         if (process.platform === 'win32') {
           assert.ok(ignoredMouseCalls.some(call => call.ignore),
             `The idle overlay must be click-through: ${JSON.stringify(ignoredMouseCalls)}`);
-          assert.equal(ignoredMouseCalls.some(call => call.ignore && call.forward), false,
-            `Windows must not forward ignored mouse movement to a second cursor owner: ${JSON.stringify(ignoredMouseCalls)}`);
+          assert.equal(win.isFocusable(), true,
+            'Windows Pets must remain focusable so explicit clicks survive hide/show.');
           const hoverOwner = BrowserWindow.getAllWindows().find(candidate => candidate !== win && candidate.getTitle() === 'Chat On Steroids');
           assert.ok(hoverOwner, 'The hover regression requires the visible owner behind Pets.');
           await hoverOwner.webContents.executeJavaScript(`(() => {
             clearInterval(window.__petBehindTimer);
             window.__petBehindTicks = 0;
             window.__petBehindTimer = setInterval(() => window.__petBehindTicks++, 50);
           })()`);
-          const hoverX = Math.round(geometry.shell.x + geometry.shell.width / 2);
-          const hoverY = Math.round(geometry.shell.y + geometry.shell.height / 2);
-          win.webContents.sendInputEvent({ type: 'mouseMove', x: 10, y: 10 });
-          await new Promise(resolve => setTimeout(resolve, 50));
-          assert.equal(win.isFocusable(), false, 'Pointer outside pet content must keep the overlay click-through.');
+          const area = win.getContentBounds();
+          const outside = { x: area.x - 1000, y: area.y - 1000 };
+          sampledCursor = outside;
+          assert.equal(ignoredMouseCalls.at(-1)?.ignore, true,
+            `The initial outside sampled cursor must observe the overlay in click-through state: ${JSON.stringify(ignoredMouseCalls)}`);
+          assert.equal(win.isFocused(), false, 'Showing the focusable overlay must not focus it.');
+          const focusedBeforeHover = BrowserWindow.getFocusedWindow();
           const ticksBeforeHover = await hoverOwner.webContents.executeJavaScript('window.__petBehindTicks');
-          win.webContents.sendInputEvent({ type: 'mouseMove', x: hoverX, y: hoverY });
-          await new Promise(resolve => setTimeout(resolve, 500));
-          assert.equal(win.isFocusable(), false, 'Pet interaction must not activate an occluding desktop window.');
+          const hoverRect = await win.webContents.executeJavaScript('document.querySelector(".pet-shell").getBoundingClientRect().toJSON()');
+          const hoverX = Math.round(hoverRect.x + hoverRect.width / 2);
+          const hoverY = Math.round(hoverRect.y + hoverRect.height / 2);
+          const enterStart = ignoredMouseCalls.length;
+          const shapeStart = nativeShapes.length;
+          const zoom = win.webContents.getZoomFactor();
+          sampledCursor = { x: area.x + hoverX * zoom, y: area.y + hoverY * zoom };
+          await until(() => ignoredMouseCalls.slice(enterStart).some(call => call.ignore === false),
+            'sampled cursor entering pet hit region');
+          const interactiveShape = nativeShapes.slice(shapeStart).at(-1);
+          assert.ok(Array.isArray(interactiveShape) && interactiveShape.length > 0 && interactiveShape.length <= 1024,
+            `Interactive Pets must publish bounded native hit r
```

**File**: `src/main/pet-overlay.ts` (modified, +50/-13)
```diff
@@ -21,12 +21,16 @@ const POINTER_INTERVAL_MS = 50;
 // proximity, and only the interactive overlay receives renderer mouse events.
 const FORWARDS_IGNORED_MOUSE_MOVES = process.platform === 'darwin';
 const SUPPORTS_WINDOW_SHAPE = process.platform === 'win32' || process.platform === 'linux';
-const MAX_HIT_REGIONS = 64;
+// One visible pet can publish its body plus temporary scene props. The library can expose the
+// builtin pet plus up to 100 bundled and 100 imported packages, so 1024 covers every supported
+// visible scene region while still bounding an arbitrary renderer payload.
+const MAX_HIT_REGIONS = 1024;
 
 let ownerWindow: (() => BrowserWindow | null) | null = null;
 let activateOwner: (() => void) | null = null;
 let overlay: BrowserWindow | null = null;
 let overlayReady = false;
+let overlayShapeReady = false;
 let overlayFocus: PetWindowFocus | null = null;
 let overlayInteractive: boolean | null = null;
 let globallyVisible = true;
@@ -51,7 +55,12 @@ function activePets(): number { return library.pets.filter(pet => pet.enabled).l
 function shouldShow(): boolean { return globallyVisible && library.pets.some(pet => pet.enabled && !dismissedPetIds.has(pet.id)); }
 
 export function petOverlayControlState(): PetOverlayControlState {
-  return { visible: shouldShow(), ready: !shouldShow() || overlayReady, activeCount: activePets(), activityCount: activities.length };
+  return {
+    visible: shouldShow(),
+    ready: !shouldShow() || (overlayReady && (process.platform !== 'win32' || overlayShapeReady)),
+    activeCount: activePets(),
+    activityCount: activities.length
+  };
 }
 
 function snapshot(): PetOverlaySnapshot {
@@ -91,14 +100,19 @@ function sendLibrary(): void {
 }
 function bounds(): PetOverlayBounds {
   const display = screen.getPrimaryDisplay();
-  return { width: display.workArea.width, height: display.workArea.height, scaleFactor: display.scaleFactor };
+  return {
+    width: display.workArea.width,
+    height: display.workArea.height,
+    scaleFactor: display.scaleFactor,
+    boundedIdleShape: process.platform === 'win32'
+  };
 }
 
-function validHitRegions(value: unknown, win: BrowserWindow): PetOverlayHitRegion[] {
+function validHitRegions(value: unknown, win: BrowserWindow, limit = MAX_HIT_REGIONS): PetOverlayHitRegion[] {
   if (!Array.isArray(value)) return [];
   const area = win.getContentBounds();
   const regions: PetOverlayHitRegion[] = [];
-  for (const raw of value.slice(0, MAX_HIT_REGIONS)) {
+  for (const raw of value.slice(0, limit)) {
     if (!raw || typeof raw !== 'object') continue;
     const candidate = raw as Record<string, unknown>;
     const x = candidate.x, y = candidate.y, width = candidate.width, height = candidate.height;
@@ -113,6 +127,14 @@ function validHitRegions(value: unknown, win: BrowserWindow): PetOverlayHitRegio
   return regions;
 }
 
+function maybeShowOverlay(win: BrowserWindow): void {
+  if (overlay !== win || win.isDestroyed() || !overlayReady || !shouldShow() || win.isVisible()) return;
+  if (process.platform === 'win32' && !overlayShapeReady) return;
+  win.showInactive();
+  startPointerTracking(overlayInteractive === true);
+  sendControl(true);
+}
+
 function setInteractive(interactive: boolean, requestedRegions?: unknown): void {
   const win = overlay;
   if (!win || win.isDestroyed()) return;
@@ -125,25 +147,38 @@ function setInteractive(interactive: boolean, requestedRegions?: unknown): void
     if (SUPPORTS_WINDOW_SHAPE) {
       if (regions.length === 0) return;
       win.setShape(regions);
+      if (process.platform === 'win32') overlayShapeReady = true;
     }
     if (changed) win.setIgnoreMouseEvents(false);
     overlayInteractive = true;
   } else {
-    // Restore click-through before the full visual shape. On Windows this deliberately omits
+    // Restore click-through before changing the visual shape. On Windows this deliberately omits
     // `forward`: forwarding makes the overlay and the underlying app race to set the OS cursor.
     if (changed) {
       if (FORWARDS_IGNORED_MOUSE_MOVES) win.setIgnoreMouseEvents(true, { forward: true });
       else win.setIgnoreMouseEvents(true);
     }
     if (SUPPORTS_WINDOW_SHAPE) {
-      const area = win.getContentBounds();
-      win.setShape([{ x: 0, y: 0, width: area.width, height: area.height }]);
+      if (process.platform === 'win32') {
+        // Keep Windows' transparent top-level window bounded to the visible pet UI even while
+        // click-through. Re-expanding it to the full work area leaves Chromium a fullscreen
+        // occluder to classify when hit-testing is re-enabled, despite Win32 already reporting
+        // the later bounded region. Renderer animation keeps these regions synchronized.
+        if (regions.length > 0) {
+          win.setShape(regions);
+          overlayShapeReady = true;
+        }
+      } else {
+        const area = win.getContentBounds();
+        win.setShape([{ x: 0, y: 0, width: area.width, height: a
```

**File**: `src/renderer/pet-overlay.ts` (modified, +10/-3)
```diff
@@ -44,7 +44,12 @@ const INTERACTION_PAD = 42;
 
 let library: PetLibraryState = { pets: [] };
 let snapshot: PetOverlaySnapshot | null = null;
-let bounds: PetOverlayBounds = { width: innerWidth, height: innerHeight, scaleFactor: devicePixelRatio };
+let bounds: PetOverlayBounds = {
+  width: innerWidth,
+  height: innerHeight,
+  scaleFactor: devicePixelRatio,
+  boundedIdleShape: false
+};
 let pointer: PetOverlayPointer = { x: -1000, y: -1000 };
 let interactive = false;
 let interactiveSignature = '';
@@ -512,7 +517,9 @@ function setInteractive(next: boolean): void {
   // Hiding forces native click-through. Reflect that same visibility in our
   // deduplication state so re-showing beneath a stationary pointer re-arms input.
   next = next && snapshot?.visible !== false && !disposed;
-  const regions = next ? interactionRegions() : [];
+  const regions = snapshot?.visible === false || disposed
+    ? []
+    : next || bounds.boundedIdleShape ? interactionRegions() : [];
   const signature = JSON.stringify([next, regions]);
   if (interactive === next && interactiveSignature === signature) return;
   interactive = next;
@@ -521,7 +528,7 @@ function setInteractive(next: boolean): void {
 }
 
 function syncInteractiveRegions(): void {
-  if (interactive) setInteractive(true);
+  if (interactive || bounds.boundedIdleShape) setInteractive(interactive);
 }
 
 function updateInteraction(next: PetOverlayPointer): void {
```

**File**: `src/shared/pets.ts` (modified, +1/-0)
```diff
@@ -125,6 +125,7 @@ export interface PetOverlayBounds {
   width: number;
   height: number;
   scaleFactor: number;
+  boundedIdleShape: boolean;
 }
 
 export interface PetOverlaySnapshot {
```

**File**: `test/pet-overlay-host.test.ts` (modified, +39/-14)
```diff
@@ -67,6 +67,9 @@ async function publish(next: PetLibraryState): Promise<void> {
   mocks.publish!(next);
   await vi.advanceTimersByTimeAsync(0);
 }
+function publishIdleShape(win: any, regions = [{ x: 24, y: 32, width: 176, height: 184 }]): void {
+  mocks.ipc.get('pet-overlay:interactive')!({ sender: win.webContents }, { interactive: false, regions });
+}
 beforeEach(() => {
   vi.useFakeTimers();
   mocks.read.mockClear(); mocks.cursor.mockClear(); mocks.windows.length = 0;
@@ -98,9 +101,33 @@ it('reads the catalog once; polling, activity, hover and controls use its publis
   expect(win.setIgnoreMouseEvents).toHaveBeenCalledWith(false);
 });
 
+it.runIf(process.platform === 'win32')('keeps the idle Windows native shape bounded to supplied pet regions', async () => {
+  await startPetOverlay(() => null, () => undefined);
+  const win = mocks.windows[0];
+  expect(win.isVisible()).toBe(false);
+  const regions = [{ x: 24, y: 32, width: 176, height: 184 }];
+  const interactive = mocks.ipc.get('pet-overlay:interactive')!;
+  interactive({ sender: win.webContents }, { interactive: false, regions });
+  expect(win.setShape).toHaveBeenLastCalledWith(regions);
+  expect(win.isVisible()).toBe(true);
+  interactive({ sender: win.webContents }, { interactive: true, regions });
+  expect(win.setIgnoreMouseEvents).toHaveBeenLastCalledWith(false);
+  interactive({ sender: win.webContents }, { interactive: false, regions });
+  expect(win.setIgnoreMouseEvents).toHaveBeenLastCalledWith(true);
+  expect(win.setShape).toHaveBeenLastCalledWith(regions);
+  const manyRegions = Array.from({ length: 605 }, (_, index) => ({
+    x: (index % 100) * 8, y: (index % 80) * 8, width: 8, height: 8
+  }));
+  interactive({ sender: win.webContents }, { interactive: false, regions: manyRegions });
+  expect(win.setShape.mock.lastCall?.[0]).toHaveLength(605);
+  interactive({ sender: win.webContents }, { interactive: true, regions: manyRegions });
+  expect(win.setShape.mock.lastCall?.[0]).toHaveLength(605);
+});
+
 it('switches pets and hides/restores the overlay without stale membership or another disk scan', async () => {
   await startPetOverlay(() => null, () => undefined);
   const win = mocks.windows[0];
+  publishIdleShape(win);
   await publish(state());
   expect(win.isVisible()).toBe(false);
   const samples = mocks.cursor.mock.calls.length;
@@ -123,26 +150,24 @@ it('starts empty without an overlay and accepts the first published enabled pet'
   expect(mocks.windows).toHaveLength(0);
   await publish(state('capy'));
   expect(mocks.windows).toHaveLength(1);
+  publishIdleShape(mocks.windows[0]);
   expect(mocks.windows[0].isVisible()).toBe(true);
   await shutdownPetOverlay();
   expect(petOverlayControlState().activeCount).toBe(0);
 });
 
-it('keeps Windows pets when the native focus binding cannot load', async () => {
+it.runIf(process.platform === 'win32')('keeps Windows pets when the native focus binding cannot load', async () => {
   // A quarantined or damaged binding used to destroy the overlay, so no pet appeared at all.
-  const platform = Object.getOwnPropertyDescriptor(process, 'platform')!;
-  Object.defineProperty(process, 'platform', { ...platform, value: 'win32' });
-  try {
-    vi.mocked(windowsPetFocus).mockRejectedValueOnce(new Error('koffi.node was not found'));
-    await startPetOverlay(() => null, () => undefined);
-    const win = mocks.windows[0];
-    expect(win.isDestroyed()).toBe(false);
-    expect(win.isVisible()).toBe(true);
-    expect(petOverlayControlState().activeCount).toBe(1);
-    expect(() => mocks.ipc.get('pet-overlay:releaseFocus')!({ sender: win.webContents })).not.toThrow();
-  } finally {
-    Object.defineProperty(process, 'platform', platform);
-  }
+  vi.mocked(windowsPetFocus).mockRejectedValueOnce(new Error('koffi.node was not found'));
+  await startPetOverlay(() => null, () => undefined);
+  const win = mocks.windows[0];
+  expect(win.isDestroyed()).toBe(false);
+  expect(petOverlayControlState().ready).toBe(false);
+  publishIdleShape(win);
+  expect(win.isVisible()).toBe(true);
+  expect(petOverlayControlState().ready).toBe(true);
+  expect(petOverlayControlState().activeCount).toBe(1);
+  expect(() => mocks.ipc.get('pet-overlay:releaseFocus')!({ sender: win.webContents })).not.toThrow();
 });
 
 it.runIf(process.platform === 'win32')('only lets the current overlay release native focus', async () => {
```

**File**: `test/pet-overlay-renderer.test.ts` (modified, +15/-5)
```diff
@@ -85,7 +85,7 @@ it('uses one spritesheet body per pet while preserving specials, multi-pet tasks
   Object.defineProperty(dom.window, 'petApi', { configurable: true, value: petApi });
   await import('../src/renderer/pet-overlay.js');
   await flushOverlay();
-  boundsListener!({ width: 1000, height: 800, scaleFactor: 1 });
+  boundsListener!({ width: 1000, height: 800, scaleFactor: 1, boundedIdleShape: true });
   const runningSnapshot: PetOverlaySnapshot = {
     visible: true, dismissedPetIds: [], level: 'running',
     activities: [{ id: 'task-1', title: 'Prime', body: 'Working', level: 'running', sessionId: 'session-one' }],
@@ -102,7 +102,10 @@ it('uses one spritesheet body per pet while preserving specials, multi-pet tasks
   const shells = [...dom.window.document.querySelectorAll<HTMLElement>('.pet-shell')];
   expect(shells).toHaveLength(2);
   expect(setInteractive.mock.lastCall?.[0]).toBe(false);
-  expect(setInteractive.mock.lastCall?.[1]).toEqual([]);
+  const idleRegions = setInteractive.mock.lastCall?.[1] as Array<{ x: number; y: number; width: number; height: number }>;
+  expect(idleRegions).toHaveLength(2);
+  expect(idleRegions.every(region => region.x >= 0 && region.y >= 0 && region.width > 0 && region.height > 0)).toBe(true);
+  expect(idleRegions.some(region => region.x === 0 && region.y === 0 && region.width === 1000 && region.height === 800)).toBe(false);
   expect(dom.window.document.querySelectorAll('.pet-body')).toHaveLength(2);
   expect(dom.window.document.querySelector('canvas,.pet-canvas,.pet-sprite,.pet-bat')).toBeNull();
   for (const shell of shells) {
@@ -167,7 +170,11 @@ it('uses one spritesheet body per pet while preserving specials, multi-pet tasks
   expect(focusOwner).not.toHaveBeenCalled();
   expect(releaseFocus).toHaveBeenCalledOnce();
   dom.window.document.dispatchEvent(new dom.window.MouseEvent('mousemove', { clientX: 700, clientY: 700, bubbles: true }));
-  expect(setInteractive).toHaveBeenLastCalledWith(false, []);
+  expect(setInteractive.mock.lastCall?.[0]).toBe(false);
+  expect(setInteractive.mock.lastCall?.[1]).toEqual(expect.not.arrayContaining([
+    { x: 0, y: 0, width: 1000, height: 800 }
+  ]));
+  expect((setInteractive.mock.lastCall?.[1] as unknown[]).length).toBeGreaterThan(0);
 
   pointer(tur, 'pointerdown', 120, 120, 8);
   pointer(tur, 'pointerup', 120, 120, 8);
@@ -186,13 +193,13 @@ it('uses one spritesheet body per pet while preserving specials, multi-pet tasks
   // The work area can change by a pixel mid-drag (menu bar, Dock): the pet stays held, follows the
   // pointer, and lands on release instead of staying lifted with its moves ignored.
   pointer(tur, 'pointerdown', 120, 120, 10);
-  boundsListener!({ width: 1000, height: 799, scaleFactor: 1 });
+  boundsListener!({ width: 1000, height: 799, scaleFactor: 1, boundedIdleShape: true });
   pointer(tur, 'pointermove', 170, 160, 10);
   expect(tur.dataset.state).toBe('held');
   pointer(tur, 'pointerup', 170, 160, 10);
   expect(tur.dataset.dragging).toBe('false');
   expect(tur.dataset.state).toBe('landing');
-  boundsListener!({ width: 1000, height: 800, scaleFactor: 1 });
+  boundsListener!({ width: 1000, height: 800, scaleFactor: 1, boundedIdleShape: true });
 
   const willow = dom.window.document.querySelector<HTMLElement>('.pet-shell[data-pet-id="willow"]')!;
   willow.dispatchEvent(new dom.window.MouseEvent('contextmenu', { clientX: 320, clientY: 280, bubbles: true }));
@@ -208,6 +215,9 @@ it('uses one spritesheet body per pet while preserving specials, multi-pet tasks
   await flushOverlay();
   expect(dom.window.document.querySelectorAll('.pet-shell')).toHaveLength(2);
   expect(dom.window.document.querySelector<HTMLButtonElement>('.pet-shell[data-pet-id="willow"] .pet-badge')?.hidden).toBe(false);
+  boundsListener!({ width: 1000, height: 800, scaleFactor: 1, boundedIdleShape: false });
+  dom.window.document.dispatchEvent(new dom.window.MouseEvent('mousemove', { clientX: 700, clientY: 700, bubbles: true }));
+  expect(setInteractive).toHaveBeenLastCalledWith(false, []);
 });
 
 it('sleeps between authored deadlines and uses display frames only for continuous motion', async () => {
```

---

### Incident Patch 7: `5100fc5e` (2026-10-05)
**Commit Message**: Merge branch 'main' into fix/pet-overlay-bounded-idle-shape

**File**: `.github/workflows/canary.yml` (modified, +207/-16)
```diff
@@ -1,7 +1,7 @@
 name: Canary
 
-# Test builds of main, published as one rolling prerelease named `canary`. Every push to main
-# that can change the app builds one; it can also be started by hand:
+# Test builds of main, published as one rolling prerelease at the fixed `canary` tag. Every push
+# to main that can change the app builds one; it can also be started by hand:
 #   gh workflow run canary.yml --ref main
 #
 # Not a release. It builds the same candidate as publish.yml (release.yml) and attaches it
@@ -24,9 +24,9 @@ on:
 permissions:
   contents: read
 
-# Never cancel a run in progress: the publish step replaces the previous canary, and a cancel
-# between its delete and create would leave none. GitHub keeps only the newest waiting run in
-# the group, so a burst of merges still ends in one build of the latest main.
+# Never cancel a run in progress: a replacement is staged and verified as a private draft before
+# the fixed public canary is swapped. GitHub keeps only the newest waiting run in the group, so a
+# burst of merges still converges on one build of the latest app-relevant main.
 concurrency:
   group: canary
   cancel-in-progress: false
@@ -82,7 +82,23 @@ jobs:
           cat SHA256SUMS.txt
           sha256sum -c SHA256SUMS.txt
 
-      # One canary at a time: the previous one and its tag are replaced, never kept beside it.
+      - name: Limit checksums to published canary assets
+        working-directory: publish
+        run: |
+          set -euo pipefail
+          # release.yml always includes the native-source archive in the candidate so the full
+          # candidate can be verified above. Canary intentionally does not attach that archive;
+          # do not publish a checksum manifest that names a file users cannot download here.
+          grep -Fq '  Chat-On-Steroids-Native-Sources.tar.gz' SHA256SUMS.txt || {
+            echo 'Candidate checksum manifest is missing the native-source archive.' >&2
+            exit 1
+          }
+          grep -vF '  Chat-On-Steroids-Native-Sources.tar.gz' SHA256SUMS.txt > SHA256SUMS.canary.txt
+          mv SHA256SUMS.canary.txt SHA256SUMS.txt
+          cat SHA256SUMS.txt
+
+      # Stage and verify the complete replacement before touching the fixed public canary. A stale
+      # run or a failed upload therefore leaves the previous /releases/tag/canary intact.
       - name: Replace the canary prerelease
         run: |
           set -euo pipefail
@@ -96,15 +112,190 @@ jobs:
           - Issues and pull requests are accepted only for problems that also happen on the [latest stable release](https://github.com/${GITHUB_REPOSITORY}/releases/latest).
           - The app does not offer canary builds as updates. It offers the next stable release as usual.
           NOTES
-          if gh release view canary >/dev/null 2>&1; then
-            gh release delete canary --cleanup-tag --yes
-          fi
           # Whatever the candidate packaged, without the native sources archive a release keeps.
           mapfile -t assets < <(find publish -maxdepth 1 -name 'Chat-On-Steroids-*' ! -name '*Native-Sources*' | sort)
-          gh release create canary \
-            "${assets[@]}" \
-            publish/SHA256SUMS.txt \
-            --prerelease --latest=false --target "$GITHUB_SHA" \
-            --title "Canary ${short} (not a release)" \
-            --notes-file canary-notes.md
-          gh release view canary --json url,isPrerelease --jq '"\(.url) prerelease=\(.isPrerelease)"'
+
+          main_sha="$(gh api "repos/${GITHUB_REPOSITORY}/commits/main" --jq .sha)"
+          if [ "$GITHUB_SHA" != "$main_sha" ]; then
+            echo "Skipping stale canary run at $GITHUB_SHA; main is now $main_sha."
+            exit 0
+          fi
+          staging_tag="canary-staging-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}"
+          draft_id=""
+          swap_started=false
+          staging_promoted=false
+
+          github_get_status() {
+            local url="$1"
+            local output="$2"
+            local status
+            if ! status="$(curl --silent --show-error --location \
+              --header 'Accept: application/vnd.github+json' \
+              --header "Authorization: Bearer $GH_TOKEN" \
+              --header 'X-GitHub-Api-Version: 2022-11-28' \
+              --output "$output" \
+              --write-out '%{http_code}' \
+              "$url")"; then
+              echo "GitHub API curl transport failed for $url." >&2
+              return 1
+            fi
+            case "$status" in
+              200|404) printf '%s' "$status" ;;
+              *) echo "Unexpected GitHub API status $status for $url." >&2; return 1 ;;
+            esac
+          }
+
+          cleanup_staging_ref() {
+            local status
+            status="$(github_get_status \
+              "https://api.github.com/repos/${GITHUB_REPOSITORY}/git/ref/tags/${staging_tag}" \
+              staging-ref.json)" || return 1
+            if [ "$
```

**File**: `.github/workflows/ci.yml` (modified, +4/-2)
```diff
@@ -113,8 +113,10 @@ jobs:
         if: steps.scope.outputs.run == 'true'
         env:
           # Pixel comparisons, animation timing and a transparent overlay window need a real GPU; the
-          # hosted runner has none. They run with npm run verify:ui on a real machine.
-          VERIFY_UI_SKIP: verify-plan-collapse.cjs,verify-settings-focus.cjs,verify-pet-overlay-electron.cjs,verify-message-reactions.cjs
+          # hosted runner has none. They run with npm run verify:ui on a real machine. The built-in
+          # browser's sign-in check (local TLS sites behind a proxied session) exits within seconds on
+          # the hosted macOS runner, before its first step; it passes on Windows and locally.
+          VERIFY_UI_SKIP: verify-plan-collapse.cjs,verify-settings-focus.cjs,verify-pet-overlay-electron.cjs,verify-message-reactions.cjs,verify-cos-sign-in.cjs
           # The shared runner times out a different check now and then; one retry each, named as flaky.
           VERIFY_UI_RETRY: '1'
         run: npm run verify:ui
```

**File**: `.github/workflows/welcome.yml` (modified, +4/-0)
```diff
@@ -26,3 +26,7 @@ jobs:
             - the steps that lead to the problem, and what you expected instead.
 
             If we need more details we will ask here. Screenshots are welcome; please blur names, chat text and paths.
+          # v3.1.0 reads both messages as required inputs before it checks which event fired.
+          # This workflow remains issue-only; pull requests are welcomed by scheduled PR triage.
+          pr_message: |
+            Thanks for your first pull request, and welcome! 👋
```

**File**: `AGENTS.md` (modified, +219/-12)
```diff
@@ -242,6 +242,7 @@ Paths in this section are repository-relative. Most mechanisms have `main`, `sha
 | Automation | `src/main/goal.ts`, `src/shared/{goal,goal-templates}.ts`: objectives, switches, obligations, provider/helper decisions. |
 | Agents | `src/main/agents.ts`, `src/renderer/{agent-panel,agent-communication}.ts`: independent prime families, staged mutations and addressed messages. |
 | Browser orchestration | `src/main/bridge.ts`, `browser.ts`, `browser-startup.ts`, `browser-wake.ts`, `browser-window-layout.ts`, `browser-preferences.ts`; `src/shared/browser-preferences.ts`. |
+| Built-in browser | `src/main/cos-browser/` (`selection.ts` opt-in loading, `index.ts` lifecycle, `host.ts` windows/tabs/extension/sign-in, `tab-model.ts`, `chrome-api.ts`, `extension-worker.ts`, `match-pattern.ts`, `sign-in.ts`, `sign-in-transfer.ts`); `src/preload/cos-browser{,-worker,-sign-in}.ts`; `src/renderer/cos-browser.{html,ts,css}` toolbar and `cos-browser-sign-in.{html,ts,css}` Google sign-in card; `src/shared/cos-browser-sites.ts`. See §13 Built-in browser. |
 | Extension | `extension/{manifest.json,chatgpt-dom.js,content.js,fiber.js,background.js,usage.js,overlay.css,popup.html,popup.css,popup.js}`: injection worlds, native observations/actions, journal and UI. |
 | Models/usage | `src/main/chat-models.ts`, `session/usage.ts`; `src/shared/{chat-models,usage}.ts`; `src/renderer/{chat-models,context-meter,usage}.ts`: account observations vs local estimates. |
 | External plugins | `src/main/plugins/{catalog,installer,manager,exposure,oauth}.ts`, `plugins-ipc.ts`, `plugin-refresh.ts`, `src/shared/{plugins,plugin-refresh}.ts`, `src/renderer/plugins.ts`. |
@@ -274,6 +275,7 @@ Paths in this section are repository-relative. Most mechanisms have `main`, `sha
 | Browser repair | `bridge.ts` process-memory episodes | Re-earn from live evidence; never restore an old reload token as action authority. |
 | Catalog/usage | Saved successful `chat-models`; derived `usage-cache`; live usage snapshot | Catalog is observation, not a send receipt; estimates are not provider billing. |
 | Connector refresh | `plugin-refresh.ts` / `state/plugin-refresh.json` | Exact installed app id + schema fingerprint, claimed before Refresh, verified after. |
+| Connector proof | `connector-proof.ts` / `connector-proof.json` | Per surface and tunnel: newest request, tool call and installed evidence from earlier runs. Setup reads it as "created in ChatGPT"; it is never call authority. A changed tunnel id has no proof. |
 | Control API endpoint | `control-api.ts` / `control-api/{token,endpoint.json}` | Per launch, only while the listener runs. Token written before the endpoint; endpoint removed first on stop. A crash can leave both behind, so a caller must still reach the port. |
 
 ## 5. Startup, configuration and shutdown
@@ -454,14 +456,20 @@ preserve order and deduplicate; prose/code later in a message is literal. Empty/
 states do not intercept Enter. Draft replacement, navigation, render generations and IME composition retire stale choices.
 
 `skill-library.ts` discovers repository `.agents/skills`, project `.codex/skills`, standard user,
-Codex, system and admin directories only within current approved roots. No new root authority or
-implicit cwd is granted. Depth, directory entries, catalog rows and errors are bounded; package
+Codex, system and admin directories within current approved roots, and the user's own Skill areas
+read-only without approving their homes (below). No new root authority or implicit cwd is granted. Depth, directory entries, catalog rows and errors are bounded; package
 references are not recursively treated as another catalog. External command IDs derive from
 canonical paths and remain stable when similarly named packages appear. `skill-metadata.ts` owns
 bounded YAML/TOML parsing and layered configuration. Invalid policy never enables implicit use.
+`skillLibraryInstructions` writes the model-facing index within `max_context_tokens` (2000 by
+default). Sources take turns (the user's own/repo/managed Skills, `~/.agents`, Codex home, Codex
+plugins, Claude's own, Claude plugins), so one large source cannot crowd the others out. Rows are
+grouped under their folder, written once, as `<entry>: /<id> — description` (descriptions cut at
+110 characters). Each Skill is `<folder>/<entry>/SKILL.md`. Skills that do not fit are counted in
+one closing line saying the user can pick them with `/`.
 `skill-package.ts` stages resource copies and publishes SKILL.md last; the existing serialized
 managed-library owner controls imports and removals. Scripts/assets remain inert resources.
-When `CODEX_HOME` is already inside an approved root and has a plugin cache, that same read-only
+When `CODEX_HOME` has a plugin cache (approved or as a user Skill area), that same read-only
 catalog may project Skills from the last `codex plugin list --json` installed/enabled snapshot.
 Only explicit `skills:library` inspection may create or r
```

**File**: `CHANGELOG.md` (modified, +114/-0)
```diff
@@ -9,6 +9,120 @@ The app and the `extension/` companion are versioned together. **Reload the
 extension after updating the app**. If their bridge protocols are incompatible,
 the app refuses the extension and asks you to reload the matching copy.
 
+## [2.1.28] — Find any chat, and bring your Skills along
+
+Search all your chats by title or by what was said in them, and give chats your own names. Your Claude Code, Codex and personal Skills work without sharing the rest of those folders. ChatGPT can now create pictures in app chats, and save them into your folders. Setup is a guided step-by-step wizard, and ChatGPT can now also run in the app's own built-in browser. Goal no longer gets stuck on "Answer settling".
+
+### ✨ Highlights
+
+- **Search your chats.** A search field above your chats finds any chat by its title or by what was said in it, including chats older than the list shows. Type a few words in any order; accents don't matter ("cafe" finds "café"). The words are marked in the title and in a short excerpt. Press ⌘K (Ctrl+K on Windows and Linux) to jump to it.
+- **Rename a chat.** Use the pencil on a chat, or double-click its title, to give it your own name in the app. ChatGPT's title stays as it is, and clearing the name brings it back.
+- **Your Skills from Claude Code, Codex and ~/.agents just work.** Skills from your enabled Claude Code plugins, `~/.claude/skills`, Codex and `~/.agents/skills` are available to ChatGPT, read-only, without sharing the rest of those folders (no settings, history or keys). Pick any of them with `/` in the message box. ChatGPT also gets a short list that takes turns across all your Skill sources, so one big folder no longer hides the others.
+- **A guided Setup.** Setup walks you through six steps, one at a time, with a picture for each. Every step checks what's really done and remembers it across restarts, so a finished step no longer drops back to pending after a restart.
+- **An optional built-in browser.** In Settings › ChatGPT browser you can choose "Chat On Steroids browser" to run ChatGPT in the app's own window, kept in the tray, instead of a tab in Chrome. Google doesn't allow signing in inside an embedded browser, so for Google sign-in the app offers your installed Chrome, Edge or Brave to finish signing in. Chrome with the extension stays the default.
+- **Ask for a picture, get a picture.** ChatGPT turns its image tool off for any message that mentions an app, and the app mentions Chat On Steroids in your messages so ChatGPT can use it. So "Create an image of …" used to end with "no image tool available". Now the app notices when your message asks for a picture, in any of its languages, and sends just that message without the mention. Follow-ups like "make it brighter" right after a picture, and edits of a picture you attached, count too. Everything else keeps the mention, including requests that only talk about images, like "compress the images in this folder".
+- **Save images ChatGPT generates.** Ask ChatGPT to save an image it generated in your chat, and it saves the original file, not a screenshot, into a folder you shared. Existing files are never replaced. This is a new tool, so refresh Chat On Steroids Core in ChatGPT once after updating; the app reminds you.
+
+### 🛠 Fixed
+
+- **Goal no longer hangs on "Answer settling".**
+  - **Closed chat:** if you close a chat's tab before Goal decides, the row now says "Paused until this chat is open in the browser", with a button to open it, and Goal continues when you do.
+  - **Goal met while closing:** a Goal that decided "goal reached" while its tab was closing no longer keeps spinning.
+  - **Reopened chat:** a reopened chat whose first message ChatGPT showed late now gets its Goal decision.
+  - **After a stall:** Goal decides after a turn the page had to give up on, when ChatGPT had already delivered the answer.
+  - **After its own message:** Goal no longer stops after sending a follow-up that contains `code` or other formatting. ChatGPT answered, but the app didn't notice the answer, so Goal waited forever.
+- **Goal no longer reloads a chat again and again** after a page reload. Tool calls already on the reloaded page were taken for new work, so every Goal pickup was refused and the chat reloaded.
+- **macOS 27: choosing "Continue with Google" in the built-in browser no longer closes the app.**
+- **Setup's ChatGPT step speaks your language** when it names the plugins ChatGPT hasn't called yet, with the right singular or plural, and it says to pick "Tunnel, then your tunnel ID".
+- **The Plugins plugin's Setup check stays correct** when Plugins uses its own tunnel.
+- **A new chat no longer shows "moved from ChatGPT conversation null"** in Activity.
+- **When ChatGPT sends an image save to another computer's plugin,** the message now says which computer answered, instead of blaming the request.
+
+### 💅 Polish
+
+- **Shortcut labels match your keyboard:** ⌘ on macOS, and "Strg" in German, 
```

**File**: `SECURITY.md` (modified, +1/-0)
```diff
@@ -22,6 +22,7 @@ Chat On Steroids is a permission boundary between ChatGPT and the logged-in OS u
 - Screen/control permissions also enable the companion's background browser tools on Chromium hosts. Chrome grants required debugger/tabs and HTTP(S) host permissions; there is no additional per-tab approval dialog. Read-only disables browser input, navigation, tab creation/closure and page JavaScript. Native screen, mouse/keyboard and clipboard remain desktop-wide on supported Windows/macOS hosts, independent of approved folders and macOS OS consent.
 - MCP servers bind to loopback and use secret tokenized paths. Public reachability comes only from the tunnel you configure.
 - The companion-extension bridge is a separate loopback service and exposes no filesystem, command or settings-mutation route.
+- Google sign-in for the built-in browser opens the user's installed Chrome/Edge/Brave with its normal profile. The companion requests optional cookie access only when the user clicks its session-transfer button. It may open its own popup when a login it watched returns to ChatGPT, ChatGPT confirms a signed-in session in that tab, and that transfer is pending; opening the popup reads and sends nothing. It sends only ChatGPT session-token cookies over the paired bridge for an outstanding, expiring sign-in operation; the app writes them to its browser partition without recording or logging their values. Disconnect cancels the operation. Importing a cookie does not prove ChatGPT will accept it, and there is no automatic session synchronization.
 - The optional local control API is off by default. When turned on, it is a loopback-only service for a local agent that reads app status, chat history, tool activity, queued messages, workers and the Activity log. A second switch, off by default and off whenever the API is off, also lets it send a message to an existing chat and cancel a message that has not been delivered.
   - Its per-launch token is written to the app's user data folder and never issued over HTTP. Any process that can read that folder can use the API.
   - It refuses any browser Origin.
```

**File**: `docs/release-notes/v2.1.27.md` (added, +73/-0)
```diff
@@ -0,0 +1,73 @@
+## 2.1.27 Workers stay on track, and you stay in control
+
+Workers that think for a long time keep working instead of being put to sleep, and waking several workers at once works reliably. You can now see and stop the commands the app runs for ChatGPT, and cancel a reload you don't want. Settings get a General page, and on macOS the app explains its Keychain prompt before it appears.
+
+### ✨ Highlights
+
+- **Long-thinking workers stay awake.** A worker that thought for half an hour between steps used to show as "sleeping" again and again while it worked. The app now checks whether the worker's chat is still answering before it puts it to sleep.
+- **Waking workers works reliably.** Several waiting workers now wake at once instead of one after another, a woken worker's tab is no longer reloaded under it, and a new worker no longer gives up 12 seconds after its model is selected.
+- **See and stop background commands.** Commands ChatGPT started that are still running show above the composer, with how long they have run and a Stop button for each.
+- **Cancel an "Interrupted response" reload.** When ChatGPT's page loses an answer's live stream, the app counts down to a reload that reconnects it. If the answer is clearly still working, click × to skip the reload for that answer.
+- **One ChatGPT account on several computers.** Give each computer a name in Setup, for example "Windows", and its plugins get their own names in ChatGPT. Each computer then records its own chats and runs its own tools, instead of one computer picking up the other's work. Workers are also told exactly which computer's plugin to report through.
+- **No waiting for a model list on ChatGPT Go and Free.** These plans show no model picker, so the app used to wait up to two minutes before your first message could go out. Messages now go out right away with ChatGPT's own model, and "Automatic" is the first choice in the model menu. A model you pick or set as your default is still used exactly.
+
+### 🛠 Fixed
+
+- **Compact & resume finds your Project again** after ChatGPT moved the Project link on its page, instead of stopping with "could not open the source Project".
+- **Compact & resume recovers in minutes, not a quarter of an hour,** when its new chat gets stuck before typing, for example while choosing the model. Workers waiting for the handoff are back sooner too.
+- **Compact & resume no longer creates a second session** when the new chat takes longer than a minute to open, and a resumed chat keeps its tab.
+- **Recovery after a restart is safer.** A saved handoff brief can only resume the handoff it was written for.
+- **Goal waits as long as the provider asks** after a rate limit, instead of retrying every 15 seconds.
+- **Skills with multi-line descriptions** show the right description.
+- **Uninstalling a plugin** no longer fails when its folder is still in use.
+- **When a new worker's first message isn't accepted,** the error now says why.
+- **Window screenshots work on older Windows 10 versions,** which used to refuse them as out of date.
+- **A pet you're dragging stays in your hand** when the screen area changes.
+- **When a worker can't start or wake, the app says where it stopped,** for example while choosing the model, or because its chat was still answering or its message box wasn't empty, instead of only "did not report back in time".
+- **A message sent before Setup is finished** now stays queued and says Setup needs to be finished, instead of failing a minute later and blaming the browser connection.
+- **In developer mode, tool groups are named after what they did** again, not after the app's recovery note shown in front of them.
+- **The Read-only button stays readable while it's on.** Its label used to vanish into the button's own color.
+- **Open in ChatGPT opens the chat in the right browser.** With several Chrome windows or profiles open, it used to open in whichever one you used last, which could be signed in to another account.
+- **Scrolling up to read stays put** while new output arrives, also on slower machines where the scroll used to be missed and the chat jumped back to the end.
+- **Workers stay with the connection that started them.** After you switch to another Setup profile, a worker from the first one says so and waits, instead of running its tools through the wrong connection.
+- **When Goal decides your goal is met, the chat says "Goal reached"** instead of still showing "Pursuing goal".
+- **When ChatGPT reads the top folder "/", it gets the list of your shared folders** instead of an error, so it no longer has to guess their names.
+- **A quick first answer in a new chat no longer leaves its turn open for ten minutes.** When ChatGPT redrew a new chat and the answer had already finished, the app missed the end of the turn, and Goal kept saying "Pursuing goal" without deciding.
+
+### ✨ New
+
+- **See which rounds used sub-agents.** A round that worked with sub-agents shows an
```

**File**: `docs/release-notes/v2.1.28.md` (added, +39/-0)
```diff
@@ -0,0 +1,39 @@
+## 2.1.28 Find any chat, and bring your Skills along
+
+Search all your chats by title or by what was said in them, and give chats your own names. Your Claude Code, Codex and personal Skills work without sharing the rest of those folders. ChatGPT can now create pictures in app chats, and save them into your folders. Setup is a guided step-by-step wizard, and ChatGPT can now also run in the app's own built-in browser. Goal no longer gets stuck on "Answer settling".
+
+### ✨ Highlights
+
+- **Search your chats.** A search field above your chats finds any chat by its title or by what was said in it, including chats older than the list shows. Type a few words in any order; accents don't matter ("cafe" finds "café"). The words are marked in the title and in a short excerpt. Press ⌘K (Ctrl+K on Windows and Linux) to jump to it.
+- **Rename a chat.** Use the pencil on a chat, or double-click its title, to give it your own name in the app. ChatGPT's title stays as it is, and clearing the name brings it back.
+- **Your Skills from Claude Code, Codex and ~/.agents just work.** Skills from your enabled Claude Code plugins, `~/.claude/skills`, Codex and `~/.agents/skills` are available to ChatGPT, read-only, without sharing the rest of those folders (no settings, history or keys). Pick any of them with `/` in the message box. ChatGPT also gets a short list that takes turns across all your Skill sources, so one big folder no longer hides the others.
+- **A guided Setup.** Setup walks you through six steps, one at a time, with a picture for each. Every step checks what's really done and remembers it across restarts, so a finished step no longer drops back to pending after a restart.
+- **An optional built-in browser.** In Settings › ChatGPT browser you can choose "Chat On Steroids browser" to run ChatGPT in the app's own window, kept in the tray, instead of a tab in Chrome. Google doesn't allow signing in inside an embedded browser, so for Google sign-in the app offers your installed Chrome, Edge or Brave to finish signing in. Chrome with the extension stays the default.
+- **Ask for a picture, get a picture.** ChatGPT turns its image tool off for any message that mentions an app, and the app mentions Chat On Steroids in your messages so ChatGPT can use it. So "Create an image of …" used to end with "no image tool available". Now the app notices when your message asks for a picture, in any of its languages, and sends just that message without the mention. Follow-ups like "make it brighter" right after a picture, and edits of a picture you attached, count too. Everything else keeps the mention, including requests that only talk about images, like "compress the images in this folder".
+- **Save images ChatGPT generates.** Ask ChatGPT to save an image it generated in your chat, and it saves the original file, not a screenshot, into a folder you shared. Existing files are never replaced. This is a new tool, so refresh Chat On Steroids Core in ChatGPT once after updating; the app reminds you.
+
+### 🛠 Fixed
+
+- **Goal no longer hangs on "Answer settling".**
+  - **Closed chat:** if you close a chat's tab before Goal decides, the row now says "Paused until this chat is open in the browser", with a button to open it, and Goal continues when you do.
+  - **Goal met while closing:** a Goal that decided "goal reached" while its tab was closing no longer keeps spinning.
+  - **Reopened chat:** a reopened chat whose first message ChatGPT showed late now gets its Goal decision.
+  - **After a stall:** Goal decides after a turn the page had to give up on, when ChatGPT had already delivered the answer.
+  - **After its own message:** Goal no longer stops after sending a follow-up that contains `code` or other formatting. ChatGPT answered, but the app didn't notice the answer, so Goal waited forever.
+- **Goal no longer reloads a chat again and again** after a page reload. Tool calls already on the reloaded page were taken for new work, so every Goal pickup was refused and the chat reloaded.
+- **macOS 27: choosing "Continue with Google" in the built-in browser no longer closes the app.**
+- **Setup's ChatGPT step speaks your language** when it names the plugins ChatGPT hasn't called yet, with the right singular or plural, and it says to pick "Tunnel, then your tunnel ID".
+- **The Plugins plugin's Setup check stays correct** when Plugins uses its own tunnel.
+- **A new chat no longer shows "moved from ChatGPT conversation null"** in Activity.
+- **When ChatGPT sends an image save to another computer's plugin,** the message now says which computer answered, instead of blaming the request.
+
+### 💅 Polish
+
+- **Shortcut labels match your keyboard:** ⌘ on macOS, and "Strg" in German, in the View menu and tooltips.
+- **Search says when there are more results** than it shows, and suggests adding a word.
+
+### 💛 Thank you
+
+To **@Haz4rdovisk** for the guided Setup and the built-in browser. To **@xuan2261** for keepi
```

---

### Incident Patch 8: `d12bafdd` (2026-10-05)
**Commit Message**: Capture the sidebar before pinning in the pin UI check

**File**: `scripts/verify-chat-pin.cjs` (modified, +3/-0)
```diff
@@ -55,6 +55,9 @@ app.whenReady().then(async () => {
   const before=await order();
   assert.equal(before.length,4,'Four chats: '+JSON.stringify(before));
   assert.equal(await js(`${row('other-chat-3')}.querySelector('button.sess-pin').getAttribute('aria-pressed')`),'false');
+  await js(`${row('other-chat-3')}.querySelector('.sess-top').focus()`);
+  await capture('before-pin.png');
+  await js(`document.activeElement.blur()`);
 
   // Pinning the last chat moves it to the top of its list, with a mark that stays visible.
   await pin('other-chat-3');
```

---

### Incident Patch 9: `bf0aa6c1` (2026-10-05)
**Commit Message**: Merge pull request #1135 from lavalava45/fix/stream-cache-expired

Recover chats after Stream cache expired

**File**: `extension/chatgpt-dom.js` (modified, +4/-3)
```diff
@@ -335,11 +335,12 @@ var CLF_DOM = (() => {
     }, '0|0|');
   }
 
-  // The newer shell's wording, measured live on 2026-09-26 after a reload mid-stream: "A network error
-  // occurred. Please check your connection and try again." and "Resume stream unavailable".
+  // The newer shell's wording, measured live after failed stream recovery: "A network error
+  // occurred. Please check your connection and try again.", "Resume stream unavailable", and
+  // "Stream cache expired" (2026-10-05).
   function transportFailure(value) {
     const line = String(value || '').replace(/\s+/g, ' ').trim();
-    return /^(?:message delivery timed out(?:\. please try again\.?)?|connection interrupted\.? waiting for the complete answer\.?|chatgpt stream recovery polling timed out\.?|unknown error occurred\.?|there was an error generating (?:a|the) response\.?|error in message stream\.?|network error\.?|a network error occurred\.?(?: please check your connection and try again\.?)?|resume stream unavailable\.?|something went wrong\.?|something went wrong while generating the response(?:\. if this issue persists please contact us through our help center at help\.openai\.com\.?)?\.?)(?: retry)?$/i.test(line);
+    return /^(?:message delivery timed out(?:\. please try again\.?)?|connection interrupted\.? waiting for the complete answer\.?|chatgpt stream recovery polling timed out\.?|stream cache expired\.?|unknown error occurred\.?|there was an error generating (?:a|the) response\.?|error in message stream\.?|network error\.?|a network error occurred\.?(?: please check your connection and try again\.?)?|resume stream unavailable\.?|something went wrong\.?|something went wrong while generating the response(?:\. if this issue persists please contact us through our help center at help\.openai\.com\.?)?\.?)(?: retry)?$/i.test(line);
   }
 
   /**
```

**File**: `test/chatgpt-dom-input.test.ts` (modified, +10/-0)
```diff
@@ -1179,6 +1179,16 @@ describe('transport-card scan cost', () => {
     ]);
   });
 
+  it('classifies Stream cache expired with a localized Retry control as recoverable', () => {
+    const card = document.createElement('div');
+    card.innerHTML = '<p>Stream cache expired </p><button>Reintentar</button>';
+    document.body.append(card);
+
+    expect(api.errors()).toEqual([
+      expect.objectContaining({ text: 'Stream cache expired', recoverable: true })
+    ]);
+  });
+
   it.each([500, 5000])('rejects a %i-character container before reading its rendered text', length => {
     const host = document.createElement('div');
     const control = document.createElement('button');
```

**File**: `test/content-script.test.ts` (modified, +5/-1)
```diff
@@ -8798,7 +8798,11 @@ describe('a stop button that goes missing while the turn is still running', () =
     );
   });
 
-  it.each(['A network error occurred. Please check your connection and try again.', 'Resume stream unavailable'])(
+  it.each([
+    'A network error occurred. Please check your connection and try again.',
+    'Resume stream unavailable',
+    'Stream cache expired'
+  ])(
     'classifies the newer shell failure %s as a recoverable transport failure', async (wording) => {
     live = await harness();
     startGenerating(live.document);
```

---

### Incident Patch 10: `c02cb424` (2026-10-05)
**Commit Message**: fix: recover expired stream cache

**File**: `extension/chatgpt-dom.js` (modified, +4/-3)
```diff
@@ -335,11 +335,12 @@ var CLF_DOM = (() => {
     }, '0|0|');
   }
 
-  // The newer shell's wording, measured live on 2026-09-26 after a reload mid-stream: "A network error
-  // occurred. Please check your connection and try again." and "Resume stream unavailable".
+  // The newer shell's wording, measured live after failed stream recovery: "A network error
+  // occurred. Please check your connection and try again.", "Resume stream unavailable", and
+  // "Stream cache expired" (2026-10-05).
   function transportFailure(value) {
     const line = String(value || '').replace(/\s+/g, ' ').trim();
-    return /^(?:message delivery timed out(?:\. please try again\.?)?|connection interrupted\.? waiting for the complete answer\.?|chatgpt stream recovery polling timed out\.?|unknown error occurred\.?|there was an error generating (?:a|the) response\.?|error in message stream\.?|network error\.?|a network error occurred\.?(?: please check your connection and try again\.?)?|resume stream unavailable\.?|something went wrong\.?|something went wrong while generating the response(?:\. if this issue persists please contact us through our help center at help\.openai\.com\.?)?\.?)(?: retry)?$/i.test(line);
+    return /^(?:message delivery timed out(?:\. please try again\.?)?|connection interrupted\.? waiting for the complete answer\.?|chatgpt stream recovery polling timed out\.?|stream cache expired\.?|unknown error occurred\.?|there was an error generating (?:a|the) response\.?|error in message stream\.?|network error\.?|a network error occurred\.?(?: please check your connection and try again\.?)?|resume stream unavailable\.?|something went wrong\.?|something went wrong while generating the response(?:\. if this issue persists please contact us through our help center at help\.openai\.com\.?)?\.?)(?: retry)?$/i.test(line);
   }
 
   /**
```

**File**: `test/chatgpt-dom-input.test.ts` (modified, +10/-0)
```diff
@@ -1179,6 +1179,16 @@ describe('transport-card scan cost', () => {
     ]);
   });
 
+  it('classifies Stream cache expired with a localized Retry control as recoverable', () => {
+    const card = document.createElement('div');
+    card.innerHTML = '<p>Stream cache expired </p><button>Reintentar</button>';
+    document.body.append(card);
+
+    expect(api.errors()).toEqual([
+      expect.objectContaining({ text: 'Stream cache expired', recoverable: true })
+    ]);
+  });
+
   it.each([500, 5000])('rejects a %i-character container before reading its rendered text', length => {
     const host = document.createElement('div');
     const control = document.createElement('button');
```

**File**: `test/content-script.test.ts` (modified, +5/-1)
```diff
@@ -8798,7 +8798,11 @@ describe('a stop button that goes missing while the turn is still running', () =
     );
   });
 
-  it.each(['A network error occurred. Please check your connection and try again.', 'Resume stream unavailable'])(
+  it.each([
+    'A network error occurred. Please check your connection and try again.',
+    'Resume stream unavailable',
+    'Stream cache expired'
+  ])(
     'classifies the newer shell failure %s as a recoverable transport failure', async (wording) => {
     live = await harness();
     startGenerating(live.document);
```

---

### Incident Patch 11: `00769ff0` (2026-10-05)
**Commit Message**: Merge pull request #1132 from m1d0e1/fix/compact-resume-dispatch-ownership

Fix Compact & Resume ownership after destination Send

**File**: `AGENTS.md` (modified, +7/-5)
```diff
@@ -2691,11 +2691,13 @@ and terminal custody while changing the provider binding **S: A → B**. Compact
 task and must not turn source A into an independently recoverable chat.
 
 `session/continuation.ts` owns the transaction; `handoff.ts` validates the brief; `bridge.ts`
-and the extension transport it. `resume-gate.ts` is a short pre-commit admission gate, not a
-second continuation owner. Unknown-chat recording honors its existing 60-second claim window
-instead of creating a shadow session after five seconds. Commit/abort releases the wait early;
-one claim window bounds each admission wait even when overlapping claims appear. Known sessions
-remain immediately readable. The ledger phases are:
+and the extension transport it. `resume-gate.ts` is a pre-commit admission gate, not a second
+continuation owner. Opening/pre-dispatch claims expire after 60 seconds. Once destination Send
+crosses its durable dispatch fence, the gate stays armed until that continuation commits, aborts
+or explicitly releases the dispatch, because ChatGPT may already hold the bootstrap in a chat
+whose id is still unavailable. Unknown-chat recording still waits at most one 60-second admission
+window per attempt, so an unrelated chat cannot be blocked forever. Known sessions remain
+immediately readable. The ledger phases are:
 
 ```text
 awaiting-summary -> awaiting-chat -> claimed -> committing -> committed
```

**File**: `src/main/session/continuation.ts` (modified, +17/-4)
```diff
@@ -68,7 +68,7 @@ import { clearGoalObjective, clearGoalSwitch, goalObjectiveFor, goalSwitchFor, m
 import { writeDurableNow, writeDurableSoon } from '../durable.js';
 import { handoffMatchesContinuation, prepareHandoff, resumeBootstrapMatches } from './handoff.js';
 import { ensureHandoffRecorded, recordHandoff, recordNote, rebindConversation } from './recorder.js';
-import { endResumeClaim, noteResumeClaim, resetResumeGate } from './resume-gate.js';
+import { endResumeClaim, noteResumeClaim, noteResumeDispatch, resetResumeGate } from './resume-gate.js';
 import {
   ensureCommittedResumeHandoff,
   findSessionByConversation,
@@ -959,7 +959,7 @@ export async function dispatchContinuationDestinationSendNow(token: string): Pro
       ...current,
       destinationSend: { state: 'dispatched-unresolved', conversationId: null, messageId: null }
     }));
-    noteResumeClaim(entry.token);
+    noteResumeDispatch(entry.token);
     return true;
   });
 }
@@ -994,6 +994,7 @@ export async function releaseContinuationDestinationSendNow(token: string, unatt
       claimedBy: null,
       destinationSend: { state: 'not-attempted', conversationId: null, messageId: null }
     }));
+    endResumeClaim(entry.token);
     return true;
   });
 }
@@ -1198,7 +1199,13 @@ export async function claimContinuationNow(token: string, claimant: string): Pro
     // After the transition, never before it. A throw here leaves nothing claimed, and arming
     // first would have made every unrelated new chat wait out the window for a claim that
     // does not exist.
-    if (entry.state === 'claimed') noteResumeClaim(entry.token);
+    if (entry.state === 'claimed') {
+      if (entry.destinationSend.state === 'dispatched-unresolved' || entry.destinationSend.state === 'sent') {
+        noteResumeDispatch(entry.token);
+      } else {
+        noteResumeClaim(entry.token);
+      }
+    }
     return { summary: entry.summary };
   });
 }
@@ -1748,7 +1755,13 @@ export async function restoreContinuations(snapshot: ContinuationSnapshot | null
     // collision it exists to prevent would be wide open for exactly the restart that is most
     // likely to hit it. Re-armed from now rather than from the original claim, because what
     // matters is how long from *here* that chat still has to appear.
-    if (entry.state === 'claimed') noteResumeClaim(entry.token);
+    if (entry.state === 'claimed') {
+      if (entry.destinationSend.state === 'dispatched-unresolved' || entry.destinationSend.state === 'sent') {
+        noteResumeDispatch(entry.token);
+      } else {
+        noteResumeClaim(entry.token);
+      }
+    }
     byToken.set(entry.token, entry);
   }
   try {
```

**File**: `src/main/session/resume-gate.ts` (modified, +30/-9)
```diff
@@ -31,11 +31,17 @@
  */
 export const RESUME_CLAIM_WINDOW_MS = 60_000;
 
-const claims = new Map<string, number>();
+interface ResumeClaim {
+  at: number;
+  dispatched: boolean;
+}
+
+const claims = new Map<string, ResumeClaim>();
 
 /** Records that a replacement chat is expected to appear imminently. */
 function noteExpectedResume(token: string): void {
-  claims.set(token, Date.now());
+  const current = claims.get(token);
+  claims.set(token, { at: Date.now(), dispatched: current?.dispatched === true });
 }
 
 /**
@@ -55,22 +61,37 @@ export function noteResumeClaim(token: string): void {
   noteExpectedResume(token);
 }
 
+/**
+ * Records that the replacement bootstrap crossed its exclusive pre-click dispatch fence.
+ *
+ * Past this point ChatGPT may already hold the handoff in a conversation whose id the page
+ * cannot expose yet. That ambiguity belongs to the continuation transaction, so it must stay
+ * armed until commit/abort/release rather than aging out with the browser-opening grace period.
+ * Recorder admission is still bounded independently by `settleResumeCommit()`; this does not
+ * make an unrelated new conversation wait forever.
+ */
+export function noteResumeDispatch(token: string): void {
+  claims.set(token, { at: Date.now(), dispatched: true });
+}
+
 /** Records that the move landed, or was given up on, so nothing waits on it any longer. */
 export function endResumeClaim(token: string): void {
   claims.delete(token);
 }
 
 /**
- * True while some replacement chat is expected to appear.
+ * True while some replacement chat is expected to appear or an already-dispatched bootstrap
+ * still belongs to an unresolved continuation.
  *
- * Self-expiring, so a claim that is never resolved — a crash between the claim and the
- * commit, a browser that never opens the tab — costs a bounded window rather than a
- * permanent one. That is the safe direction: failing to wait creates a stub session, which
- * is recoverable and visible, while waiting forever would stop recording new chats.
+ * Opening/pre-dispatch claims self-expire, so a browser that never opens costs only one short
+ * grace window. A dispatched claim is different: the prompt may already exist server-side and
+ * cannot be replayed safely, so the continuation transaction itself owns that gate until a
+ * terminal transition calls {@link endResumeClaim}. Recorder admission still has its own
+ * bounded wait and therefore cannot block an unrelated new chat forever.
  */
 export function resumeOpeningChat(now: number = Date.now()): boolean {
-  for (const [token, at] of claims) {
-    if (now - at <= RESUME_CLAIM_WINDOW_MS) return true;
+  for (const [token, claim] of claims) {
+    if (claim.dispatched || now - claim.at <= RESUME_CLAIM_WINDOW_MS) return true;
     claims.delete(token);
   }
   return false;
```

**File**: `test/continuation.test.ts` (modified, +38/-0)
```diff
@@ -1396,6 +1396,29 @@ describe('the window in which a replacement chat is expected', () => {
     expect(create).not.toHaveBeenCalled();
   });
 
+  it('keeps the destination ownership gate armed while an already-dispatched resume still awaits its chat id', async () => {
+    const { sessionId, token } = await readyContinuation();
+    const destination = '94949494-2222-4333-8444-666666666666';
+    await claimContinuationNow(token, 'very-slow-resume-command');
+    expect((await beginContinuationDestinationSendNow(token))?.allowed).toBe(true);
+    expect(await dispatchContinuationDestinationSendNow(token)).toBe(true);
+
+    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
+    await vi.advanceTimersByTimeAsync(RESUME_CLAIM_WINDOW_MS + 100);
+
+    // Once dispatch is durable, ChatGPT may already hold the bootstrap in a conversation whose
+    // id the page still cannot expose. The recorder fence therefore belongs to the dispatched
+    // continuation, not to the age of the original browser-opening claim.
+    expect(resumeOpeningChat()).toBe(true);
+
+    const create = vi.spyOn(store, 'createSession');
+    const observation = sessionForConversation(destination);
+    expect(await commitContinuation(token, destination)).toBe(true);
+    await vi.advanceTimersByTimeAsync(50);
+    expect(await observation).toBe(sessionId);
+    expect(create).not.toHaveBeenCalled();
+  });
+
   it.each(['abort', 'expiry'] as const)('releases unrelated new recording when the resume claim ends by %s', async reason => {
     const { token } = await readyContinuation();
     await claimContinuationNow(token, 'unfinished-resume-command');
@@ -1485,6 +1508,21 @@ describe('the window in which a replacement chat is expected', () => {
     expect(resumeOpeningChat()).toBe(true);
   });
 
+  it('restores a dispatched destination as transaction-owned instead of aging it out after restart', async () => {
+    const { token } = await readyContinuation();
+    await claimContinuationNow(token, 'restart-after-dispatch');
+    expect((await beginContinuationDestinationSendNow(token))?.allowed).toBe(true);
+    expect(await dispatchContinuationDestinationSendNow(token)).toBe(true);
+    const snapshot = snapshotContinuations();
+
+    resetContinuationsForTests();
+    await restoreContinuations(snapshot);
+    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
+    await vi.advanceTimersByTimeAsync(RESUME_CLAIM_WINDOW_MS + 100);
+
+    expect(resumeOpeningChat()).toBe(true);
+  });
+
   it('is not re-armed for a continuation that was already finished', async () => {
     const { sessionId, token } = await readyContinuation();
     resetContinuationsForTests();
```

---

### Incident Patch 12: `9e738c8e` (2026-10-05)
**Commit Message**: fix: preserve resume ownership after dispatch

**File**: `AGENTS.md` (modified, +7/-5)
```diff
@@ -2691,11 +2691,13 @@ and terminal custody while changing the provider binding **S: A → B**. Compact
 task and must not turn source A into an independently recoverable chat.
 
 `session/continuation.ts` owns the transaction; `handoff.ts` validates the brief; `bridge.ts`
-and the extension transport it. `resume-gate.ts` is a short pre-commit admission gate, not a
-second continuation owner. Unknown-chat recording honors its existing 60-second claim window
-instead of creating a shadow session after five seconds. Commit/abort releases the wait early;
-one claim window bounds each admission wait even when overlapping claims appear. Known sessions
-remain immediately readable. The ledger phases are:
+and the extension transport it. `resume-gate.ts` is a pre-commit admission gate, not a second
+continuation owner. Opening/pre-dispatch claims expire after 60 seconds. Once destination Send
+crosses its durable dispatch fence, the gate stays armed until that continuation commits, aborts
+or explicitly releases the dispatch, because ChatGPT may already hold the bootstrap in a chat
+whose id is still unavailable. Unknown-chat recording still waits at most one 60-second admission
+window per attempt, so an unrelated chat cannot be blocked forever. Known sessions remain
+immediately readable. The ledger phases are:
 
 ```text
 awaiting-summary -> awaiting-chat -> claimed -> committing -> committed
```

**File**: `src/main/session/continuation.ts` (modified, +17/-4)
```diff
@@ -68,7 +68,7 @@ import { clearGoalObjective, clearGoalSwitch, goalObjectiveFor, goalSwitchFor, m
 import { writeDurableNow, writeDurableSoon } from '../durable.js';
 import { handoffMatchesContinuation, prepareHandoff, resumeBootstrapMatches } from './handoff.js';
 import { ensureHandoffRecorded, recordHandoff, recordNote, rebindConversation } from './recorder.js';
-import { endResumeClaim, noteResumeClaim, resetResumeGate } from './resume-gate.js';
+import { endResumeClaim, noteResumeClaim, noteResumeDispatch, resetResumeGate } from './resume-gate.js';
 import {
   ensureCommittedResumeHandoff,
   findSessionByConversation,
@@ -959,7 +959,7 @@ export async function dispatchContinuationDestinationSendNow(token: string): Pro
       ...current,
       destinationSend: { state: 'dispatched-unresolved', conversationId: null, messageId: null }
     }));
-    noteResumeClaim(entry.token);
+    noteResumeDispatch(entry.token);
     return true;
   });
 }
@@ -994,6 +994,7 @@ export async function releaseContinuationDestinationSendNow(token: string, unatt
       claimedBy: null,
       destinationSend: { state: 'not-attempted', conversationId: null, messageId: null }
     }));
+    endResumeClaim(entry.token);
     return true;
   });
 }
@@ -1198,7 +1199,13 @@ export async function claimContinuationNow(token: string, claimant: string): Pro
     // After the transition, never before it. A throw here leaves nothing claimed, and arming
     // first would have made every unrelated new chat wait out the window for a claim that
     // does not exist.
-    if (entry.state === 'claimed') noteResumeClaim(entry.token);
+    if (entry.state === 'claimed') {
+      if (entry.destinationSend.state === 'dispatched-unresolved' || entry.destinationSend.state === 'sent') {
+        noteResumeDispatch(entry.token);
+      } else {
+        noteResumeClaim(entry.token);
+      }
+    }
     return { summary: entry.summary };
   });
 }
@@ -1748,7 +1755,13 @@ export async function restoreContinuations(snapshot: ContinuationSnapshot | null
     // collision it exists to prevent would be wide open for exactly the restart that is most
     // likely to hit it. Re-armed from now rather than from the original claim, because what
     // matters is how long from *here* that chat still has to appear.
-    if (entry.state === 'claimed') noteResumeClaim(entry.token);
+    if (entry.state === 'claimed') {
+      if (entry.destinationSend.state === 'dispatched-unresolved' || entry.destinationSend.state === 'sent') {
+        noteResumeDispatch(entry.token);
+      } else {
+        noteResumeClaim(entry.token);
+      }
+    }
     byToken.set(entry.token, entry);
   }
   try {
```

**File**: `src/main/session/resume-gate.ts` (modified, +30/-9)
```diff
@@ -31,11 +31,17 @@
  */
 export const RESUME_CLAIM_WINDOW_MS = 60_000;
 
-const claims = new Map<string, number>();
+interface ResumeClaim {
+  at: number;
+  dispatched: boolean;
+}
+
+const claims = new Map<string, ResumeClaim>();
 
 /** Records that a replacement chat is expected to appear imminently. */
 function noteExpectedResume(token: string): void {
-  claims.set(token, Date.now());
+  const current = claims.get(token);
+  claims.set(token, { at: Date.now(), dispatched: current?.dispatched === true });
 }
 
 /**
@@ -55,22 +61,37 @@ export function noteResumeClaim(token: string): void {
   noteExpectedResume(token);
 }
 
+/**
+ * Records that the replacement bootstrap crossed its exclusive pre-click dispatch fence.
+ *
+ * Past this point ChatGPT may already hold the handoff in a conversation whose id the page
+ * cannot expose yet. That ambiguity belongs to the continuation transaction, so it must stay
+ * armed until commit/abort/release rather than aging out with the browser-opening grace period.
+ * Recorder admission is still bounded independently by `settleResumeCommit()`; this does not
+ * make an unrelated new conversation wait forever.
+ */
+export function noteResumeDispatch(token: string): void {
+  claims.set(token, { at: Date.now(), dispatched: true });
+}
+
 /** Records that the move landed, or was given up on, so nothing waits on it any longer. */
 export function endResumeClaim(token: string): void {
   claims.delete(token);
 }
 
 /**
- * True while some replacement chat is expected to appear.
+ * True while some replacement chat is expected to appear or an already-dispatched bootstrap
+ * still belongs to an unresolved continuation.
  *
- * Self-expiring, so a claim that is never resolved — a crash between the claim and the
- * commit, a browser that never opens the tab — costs a bounded window rather than a
- * permanent one. That is the safe direction: failing to wait creates a stub session, which
- * is recoverable and visible, while waiting forever would stop recording new chats.
+ * Opening/pre-dispatch claims self-expire, so a browser that never opens costs only one short
+ * grace window. A dispatched claim is different: the prompt may already exist server-side and
+ * cannot be replayed safely, so the continuation transaction itself owns that gate until a
+ * terminal transition calls {@link endResumeClaim}. Recorder admission still has its own
+ * bounded wait and therefore cannot block an unrelated new chat forever.
  */
 export function resumeOpeningChat(now: number = Date.now()): boolean {
-  for (const [token, at] of claims) {
-    if (now - at <= RESUME_CLAIM_WINDOW_MS) return true;
+  for (const [token, claim] of claims) {
+    if (claim.dispatched || now - claim.at <= RESUME_CLAIM_WINDOW_MS) return true;
     claims.delete(token);
   }
   return false;
```

**File**: `test/continuation.test.ts` (modified, +38/-0)
```diff
@@ -1396,6 +1396,29 @@ describe('the window in which a replacement chat is expected', () => {
     expect(create).not.toHaveBeenCalled();
   });
 
+  it('keeps the destination ownership gate armed while an already-dispatched resume still awaits its chat id', async () => {
+    const { sessionId, token } = await readyContinuation();
+    const destination = '94949494-2222-4333-8444-666666666666';
+    await claimContinuationNow(token, 'very-slow-resume-command');
+    expect((await beginContinuationDestinationSendNow(token))?.allowed).toBe(true);
+    expect(await dispatchContinuationDestinationSendNow(token)).toBe(true);
+
+    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
+    await vi.advanceTimersByTimeAsync(RESUME_CLAIM_WINDOW_MS + 100);
+
+    // Once dispatch is durable, ChatGPT may already hold the bootstrap in a conversation whose
+    // id the page still cannot expose. The recorder fence therefore belongs to the dispatched
+    // continuation, not to the age of the original browser-opening claim.
+    expect(resumeOpeningChat()).toBe(true);
+
+    const create = vi.spyOn(store, 'createSession');
+    const observation = sessionForConversation(destination);
+    expect(await commitContinuation(token, destination)).toBe(true);
+    await vi.advanceTimersByTimeAsync(50);
+    expect(await observation).toBe(sessionId);
+    expect(create).not.toHaveBeenCalled();
+  });
+
   it.each(['abort', 'expiry'] as const)('releases unrelated new recording when the resume claim ends by %s', async reason => {
     const { token } = await readyContinuation();
     await claimContinuationNow(token, 'unfinished-resume-command');
@@ -1485,6 +1508,21 @@ describe('the window in which a replacement chat is expected', () => {
     expect(resumeOpeningChat()).toBe(true);
   });
 
+  it('restores a dispatched destination as transaction-owned instead of aging it out after restart', async () => {
+    const { token } = await readyContinuation();
+    await claimContinuationNow(token, 'restart-after-dispatch');
+    expect((await beginContinuationDestinationSendNow(token))?.allowed).toBe(true);
+    expect(await dispatchContinuationDestinationSendNow(token)).toBe(true);
+    const snapshot = snapshotContinuations();
+
+    resetContinuationsForTests();
+    await restoreContinuations(snapshot);
+    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
+    await vi.advanceTimersByTimeAsync(RESUME_CLAIM_WINDOW_MS + 100);
+
+    expect(resumeOpeningChat()).toBe(true);
+  });
+
   it('is not re-armed for a continuation that was already finished', async () => {
     const { sessionId, token } = await readyContinuation();
     resetContinuationsForTests();
```

---

### Incident Patch 13: `1efe32d2` (2026-10-05)
**Commit Message**: Merge pull request #1127 from Maximapple/fix/goal-reply-turn-open

Open the turn of a Goal reply that ChatGPT stored Markdown-escaped

**File**: `AGENTS.md` (modified, +6/-0)
```diff
@@ -1259,6 +1259,12 @@ While an exact send receipt still has a bounded evidence reader, the existing ob
 requests canonical MAIN-world text even after native generation stops. Rendered Markdown can
 remove submitted bytes; recognizing the generation must not be a prerequisite for reading the
 source needed to recognize its Send. Route, epoch and stable message identity still decide acceptance.
+ChatGPT stores text the page inserted Markdown-escaped (`` \`code\` ``, `\#`, `\<newline>`). A Goal
+reply's receipt is therefore marked `inserted` (`rememberUserSend(true)`; the page's own click and
+submit listeners that record the same Send again keep the mark) and is matched like a bootstrap:
+raw, then one unescape. A person's own typing stays an exact raw comparison. Compared raw, a reply
+with `code` never matched, so its turn opened only when the page saw the question before the app
+held it as an anchor; otherwise no turn opened and Goal waited forever (2026-10-05).
 
 Page-reply waits are bounded: reuse/close observations get three seconds; New Chat preparation
 gets fifteen seconds. Missing preparation replies retain the elected tab and grant no fallback.
```

**File**: `extension/content.js` (modified, +12/-3)
```diff
@@ -965,12 +965,14 @@
       receipt.accepted.conversationId === current && receipt.accepted.epoch === epoch;
     const attachmentsMatch = receipt.text || (receipt.attachmentNames?.length &&
       JSON.stringify(receipt.attachmentNames) === JSON.stringify((userMessageSource(message)?.attachments || []).map(file => file.name).sort()));
+    // Text this page inserted (a Goal reply) comes back Markdown-escaped like any app insertion,
+    // so it gets the bootstrap's raw-then-one-unescape comparison. A person's own typing stays raw.
     return (!receipt.conversationId || receipt.conversationId === current) &&
       (!receipt.previousMessageId || receipt.previousMessageId !== message.id) && !!attachmentsMatch &&
-      (acceptedIdentity || matchesSubmittedUser(message, receipt.text));
+      (acceptedIdentity || (receipt.inserted ? matchesSubmittedBootstrap : matchesSubmittedUser)(message, receipt.text));
   }
 
-  function rememberUserSend() {
+  function rememberUserSend(inserted = false) {
     if (!alive) return;
     // Only the explicitly selected offline Goal backend changes the user prompt.
     const composer = CLF_DOM.composer();
@@ -983,6 +985,10 @@
     const text = sendText(CLF_DOM.composerAuthoredText());
     const attachmentNames = CLF_DOM.composerAttachmentNames();
     if (!text && !attachmentNames.length) return;
+    // The same Send is recorded again by the page's own click and submit listeners; they cannot
+    // tell who inserted the text, so they keep what the inserting caller said about it.
+    if (!inserted && userSendReceipt?.inserted && userSendReceipt.text === text && Date.now() - userSendReceipt.at < USER_SEND_RECEIPT_MS)
+      inserted = true;
     let previousMessageId = null;
     for (const message of CLF_DOM.messages()) {
       if (userMessagePresent(message)) previousMessageId = message.id;
@@ -993,6 +999,7 @@
     const sections = assistantSections();
     userSendReceipt = {
       text,
+      inserted,
       attachmentNames,
       conversationId: CLF_DOM.conversationId(),
       previousMessageId,
@@ -10679,7 +10686,9 @@
             !(allowed.enabled === true || (allowed.own !== true && allowed.objective)) || allowed.hasKey !== true ||
             allowed.blocked || allowed.queuePending || authorization.data.job?.busy || authorization.data.pendingTools > 0 ||
             goalSourceGenerating() || CLF_DOM.generating() || nativeBusy || job?.busy) return false;
-        rememberUserSend();
+        // The page inserted this reply, and ChatGPT stores inserted text Markdown-escaped: a raw
+        // comparison never matched a reply with `code` or *emphasis*, and its turn never opened.
+        rememberUserSend(true);
         sendAttempted = true;
         return true;
       });
```

**File**: `test/content-script.test.ts` (modified, +41/-0)
```diff
@@ -19863,6 +19863,47 @@ describe('the goal loop', () => {
     expect(new Set(acks(live).map(message => `${message.conversationId}:${message.token}`)).size).toBe(1);
   });
 
+  /**
+   * The page inserts a Goal reply, and ChatGPT stores inserted text Markdown-escaped, so the
+   * stored copy of "Run `echo two`" reads "Run \\`echo two\\`". Compared raw, the send receipt never
+   * matched, and the turn opened only if the page saw the question before the app held it; when
+   * the app was first, the question read as history, no turn opened and Goal waited forever
+   * (live on 2026-10-05, 3 of 4 runs).
+   */
+  it.each([
+    ['as typed', 'Run `echo two` with the connector'],
+    ['Markdown-escaped', 'Run \\`echo two\\` with the connector']
+  ])('opens the turn of a sent Goal reply whose stored copy is %s, even once the app holds it', async (_case, stored) => {
+    const reply = 'Run `echo two` with the connector';
+    let draft: unknown = readyDraft(reply);
+    let anchors = [{ seq: 1, time: 1_700_000_000_000, messageId: 'm-prior-question' }];
+    let user: HTMLElement;
+    live = await harness(`https://chatgpt.com/c/${CHAT}`, {
+      ...goalReplies(),
+      activity: () => ({ ok: true, data: { entries: [], stream: [], nextSince: 0, pendingTools: 0, job: null, activeTurnId: null,
+        userAnchors: anchors, goal: { enabled: true, hasKey: true, model: MODEL, draft } } }),
+      goal_ack: () => { draft = null; return { ok: true, data: { acknowledged: true } }; }
+    }, (document) => {
+      userTurn(document, 'prior-question', 'first question', { sent: false });
+      document.querySelector('[data-testid="send-button"]')!.addEventListener('click', () => {
+        // The app learns of the question (from ChatGPT's own record) before this page shows it.
+        anchors = [...anchors, { seq: 2, time: 1_700_000_001_000, messageId: 'm-goal-question' }];
+      });
+    });
+    await live.hook.pullActivity();
+    await settle();
+    await live.hook.pullActivity();
+    await settle();
+    user = userTurn(live.document, 'goal-question', reply, { sent: false });
+    await bindFiberTurns([{ section: user, turn: { turnId: 'goal-question', conversationId: CHAT,
+      messages: [{ role: 'user', stable: true, messageId: 'm-goal-question', rawMessageId: 'm-goal-question', rawText: stored }] } }]);
+    startGenerating(live.document, { send: false });
+    live.hook.observe();
+    await settle();
+    await live.hook.flush();
+    expect(emitted(live.sent, 'turn_start')).toHaveLength(1);
+  });
+
   /** A conversation that moved on by itself is its own answer: the draft is about the past. */
   it('drops a ready draft when ChatGPT has started talking again', async () => {
     let sends = () => 0;
```

---

### Incident Patch 14: `32432c1f` (2026-10-05)
**Commit Message**: Merge pull request #1126 from Maximapple/fix/save-image-file-id

Let save_image work from ChatGPT's own chats: pick images by number, not by name

**File**: `AGENTS.md` (modified, +3/-2)
```diff
@@ -2243,8 +2243,9 @@ image ChatGPT generated in the calling chat (#889); the recording keeps only a p
 chat comes from request correlation (waiting up to 20 s), never from the model. Without one the
 refusal names the Core that answered (`connectorName`), since another computer's chat may have
 called it (#1097). The image is the
-latest recorded finished `native_image` of that chat's session, or the one whose `messageId` or
-`providerAssetId` the `image` argument names. The destination resolves like any write
+latest recorded finished `native_image` of that chat's session, or the `nth` one counting back
+(`nth` 2 is the one before). It is a number on purpose: ChatGPT filled a string argument with the
+picture's `file_…` id and then failed the call internally before it reached the app (2026-10-05). The destination resolves like any write
 (`allowMissing`), must not exist, and gets the image's own extension when it has none; a named
 extension of another format is refused. An extension whose `/status` body says
 `canExportImages: true` receives pending exports in `imageExports: [{ nonce, conversationId,
```

**File**: `src/main/mcp/tools-core.ts` (modified, +7/-8)
```diff
@@ -481,11 +481,13 @@ export function registerCoreTools(reg: SurfaceRegistrar): void {
         inputSchema: z
           .object({
             path: z.string().describe('New file path in an approved folder, for example /workspace/images/logo.png. Without an extension the image\'s own (.png, .jpg or .webp) is added.'),
-            image: z.string().optional().describe('Which image: the message id or file id ChatGPT gave it. Omit for the latest image generated in this chat.')
+            // A number, not a name: ChatGPT fills a string here with the picture's `file_…` id and then
+            // fails the call internally before it reaches the app (measured live 2026-10-05).
+            nth: z.number().int().min(1).max(100).optional().describe('Which image, counting back from the newest generated in this chat: 1 (the default) is the latest, 2 the one before, and so on.')
           })
           .strict()
       })),
-      async ({ path, image }) =>
+      async ({ path, nth }) =>
         guard('save_image', async () => {
           if (!caps.create) {
             return fail('TOOL_DISABLED: save_image is disabled by the current Chat On Steroids permissions. Ask the user to enable creating files in the app.');
@@ -509,13 +511,10 @@ export function registerCoreTools(reg: SurfaceRegistrar): void {
           const recorded = session ? await readRecentEvents(session.id, 400, { kinds: ['native_image'] }) : [];
           const images = recorded.filter((event): event is Extract<typeof event, { kind: 'native_image' }> =>
             event.kind === 'native_image' && event.providerStatus !== 'in_progress');
-          const wanted = image?.trim();
-          const chosen = wanted
-            ? images.filter(event => event.messageId === wanted || event.providerAssetId === wanted).at(-1)
-            : images.at(-1);
+          const chosen = images.at(-(nth ?? 1));
           if (!chosen) {
-            return fail(wanted
-              ? `save_image found no generated image "${wanted}" in this chat. Omit image to save the latest one.`
+            return fail(images.length
+              ? `save_image found only ${images.length} generated image${images.length === 1 ? '' : 's'} in this chat. Use nth ${images.length} or lower, or omit nth for the latest.`
               : 'save_image found no image generated in this chat yet.');
           }
           const target = await resolveIn(ctx.roots, path, { allowMissing: true });
```

**File**: `src/main/session/image-request.ts` (modified, +6/-3)
```diff
@@ -94,7 +94,7 @@ const FILES = words(`
   file | files | folder | folders | directory | directories | datei\\p{L}* | ordner\\p{L}* | verzeichnis\\p{L}* | archivo\\p{L}* | carpeta\\p{L}* |
   fichier\\p{L}* | dossier\\p{L}* | repertoire | arquivo\\p{L}* | pasta\\p{L}* | файл\\p{L}* | папк\\p{L}* | dosya\\p{L}* | klasor\\p{L}* | tệp | thư mục`);
 // "… and save it to the folder": where the picture goes, not file work.
-const SAVE_VERB = /(?<![\p{L}])(?:save|store|download|export|speicher\p{L}*|herunterladen|exportier\p{L}*|guarda\p{L}*|descarga\p{L}*|enregistre\p{L}*|télécharge\p{L}*|salve|salvar|baixe|сохрани\p{L}*|скача\p{L}*|kaydet\p{L}*|indir|lưu|tải)(?![\p{L}])/u;
+const SAVE_VERB = /(?<![\p{L}])(?:save[sd]?|saving|stor(?:e[sd]?|ing)|download(?:s|ed|ing)?|export(?:s|ed|ing)?|speicher\p{L}*|herunterladen|exportier\p{L}*|guarda\p{L}*|descarga\p{L}*|enregistre\p{L}*|télécharge\p{L}*|salve|salvar|baixe|сохрани\p{L}*|скача\p{L}*|kaydet\p{L}*|indir|lưu|tải)(?![\p{L}])/u;
 const SAVE_CLAUSE = /(?<![\p{L}])(?:save|store|put|speicher\p{L}*|lege|guarda\p{L}*|enregistre\p{L}*|salve|salvar|сохрани\p{L}*|kaydet\p{L}*|lưu)(?![\p{L}]).*$/u;
 // Files and everyday work: they rule out reading a short follow-up as an image edit, not a clear request.
 const TASK = words(`
@@ -118,6 +118,8 @@ const WORD_END = '(?![\\p{L}\\p{N}_])';
 const anyOf = (list: string): RegExp => new RegExp(`${WORD_EDGE}(?:${list})${WORD_END}`, 'u');
 const aboutRe = anyOf(ABOUT_PICTURES), filesRe = anyOf(FILES);
 const identifierRe = new RegExp(`${WORD_EDGE}(?:${NOUN})[-_](?!(?:style|like|realistic|real|quality|ready|perfect|based|inspired)${WORD_END})[\\p{L}\\p{N}]`, 'u');
+// Tool and variable names built on a picture word ("save_image", "view_image") are technical text.
+const toolNameRe = new RegExp(`[\\p{L}\\p{N}]_(?:${NOUN})${WORD_END}`, 'u');
 const nounRe = anyOf(NOUN), codeRe = anyOf(CODE), taskRe = anyOf(TASK), processRe = anyOf(PROCESS), editRe = anyOf(EDIT), createRe = anyOf(CREATE);
 // A request: a creating verb, then a picture noun within a few words ("create a small watercolor image").
 const DEFINITE = 'the|these|those|this|that|my|our|your|its|their|die|den|das|diese|dieses|meine|unsere|las|los|estas|estos|mis|nuestras|les|ces|mes|nos|as|os|estas|estes|minhas|nossas';
@@ -156,15 +158,16 @@ const CJK_PROCESS = /压缩|裁剪|调整大小|描述|分析|壓縮|裁切|調
 const CJK_EDIT = /加上|加一|添加|加个|加個|加入|换成|換成|改为|改為|追加して|加えて|つけて|추가해|넣어|修改|改成|变成|改為|變成|编辑|編輯|去掉背景|变得|編集|変えて|背景を消|にして|수정|바꿔|편집|배경 제거|로 만들어/u;
 
 function sentences(text: string): string[] {
-  return text.split(/[.!?;\n。！？；]+/u).map(part => part.trim()).filter(Boolean);
+  // A "." ends a sentence only before a space or the end, never inside a file name or a number.
+  return text.split(/[.!?;]+(?=\s|$)|[\n。！？；]+/u).map(part => part.trim()).filter(Boolean);
 }
 
 export function asksForImage(text: string, context: ImageRequestContext = {}): boolean {
   const raw = prose(text).trim();
   if (!raw) return false;
   const forms = [raw, fold(raw)];
   const any = (re: RegExp): boolean => forms.some(form => re.test(form));
-  if (any(codeRe) || any(identifierRe) || CJK_CODE.test(raw)) return false;
+  if (any(codeRe) || any(identifierRe) || any(toolNameRe) || CJK_CODE.test(raw)) return false;
   for (const sentence of sentences(raw)) {
     const variants = [sentence, fold(sentence)];
     const has = (re: RegExp): boolean => variants.some(form => re.test(form));
```

**File**: `test/image-request.test.ts` (modified, +6/-1)
```diff
@@ -45,6 +45,8 @@ describe('asksForImage', () => {
     '고양이 그림을 그려줘',
     '바다 이미지 만들어줘',
     '/clear-writing Create an image of a quiet library',
+    'Create a picture of version 2.5 of our mascot, a fox',
+    'Draw a cat. Then save it as cat.final.png',
     'Create a logo and save it to the project folder',
     'Erstelle ein Bild von einer Katze und speichere es im Ordner',
     'Draw a cartoon of a python snake',
@@ -101,7 +103,10 @@ describe('asksForImage', () => {
       // Saving the picture just made is file work for the app (live 2026-10-05: this went out without the mention).
       'Use the save_image tool of the "Chat On Steroids Core" connector exactly once to save the image you just generated as boat.png in the shared project folder. Then reply with only the tool result.',
       'save the image you just generated as boat.png', 'Save the picture you made into the project folder',
-      'Speichere das Bild, das du gerade erstellt hast, im Projektordner', 'Guarda la imagen que creaste en la carpeta del proyecto'])
+      'Speichere das Bild, das du gerade erstellt hast, im Projektordner', 'Guarda la imagen que creaste en la carpeta del proyecto',
+      // A "." inside a file name split this into a sentence that read "saves the latest image of" (live 2026-10-05).
+      'Call the save_image tool of the "Chat On Steroids Core" connector exactly once with ONLY the path argument /chatgpt_homelab/cos-qa-boat-final.png and no image argument (it then saves the latest image of this chat). Reply with only the tool result.',
+      'It saves the latest image of this chat into boat.final.png', 'Use view_image on the picture you made'])
       expect(asksForImage(text, { afterImage: true }), text).toBe(false);
     // Without an image just made, the same words are no image request.
     expect(asksForImage('make it brighter')).toBe(false);
```

**File**: `test/mcp.test.ts` (modified, +4/-1)
```diff
@@ -892,7 +892,10 @@ describe('surface boundaries', () => {
   it('saves a generated image only for a call it can tie to its chat (#889)', async () => {
     everything();
     const tool = toolList(await core('tools/list')).find((entry) => entry.name === 'save_image');
-    expect(Object.keys(tool?.inputSchema?.properties ?? {})).toEqual(['path', 'image']);
+    // No string that names an image: ChatGPT fills one with the generated picture's `file_…` id, and
+    // then fails the call internally before it reaches the app (measured live 2026-10-05, 3 of 3).
+    expect(Object.keys(tool?.inputSchema?.properties ?? {})).toEqual(['path', 'nth']);
+    expect(tool?.inputSchema?.properties?.nth).toMatchObject({ type: 'integer', minimum: 1 });
     expect(tool?.inputSchema?.required).toEqual(['path']);
     const reply = await core('tools/call', { name: 'save_image', arguments: { path: '/workspace/out.png' } });
     expect(reply.body.result?.isError).toBe(true);
```

---

### Incident Patch 15: `e34a111f` (2026-10-05)
**Commit Message**: Merge pull request #1124 from Maximapple/fix/skills-index-fair-share

Share the Skills index fairly across sources and write each folder once

**File**: `AGENTS.md` (modified, +6/-0)
```diff
@@ -461,6 +461,12 @@ read-only without approving their homes (below). No new root authority or implic
 references are not recursively treated as another catalog. External command IDs derive from
 canonical paths and remain stable when similarly named packages appear. `skill-metadata.ts` owns
 bounded YAML/TOML parsing and layered configuration. Invalid policy never enables implicit use.
+`skillLibraryInstructions` writes the model-facing index within `max_context_tokens` (2000 by
+default). Sources take turns (the user's own/repo/managed Skills, `~/.agents`, Codex home, Codex
+plugins, Claude's own, Claude plugins), so one large source cannot crowd the others out. Rows are
+grouped under their folder, written once, as `<entry>: /<id> — description` (descriptions cut at
+110 characters). Each Skill is `<folder>/<entry>/SKILL.md`. Skills that do not fit are counted in
+one closing line saying the user can pick them with `/`.
 `skill-package.ts` stages resource copies and publishes SKILL.md last; the existing serialized
 managed-library owner controls imports and removals. Scripts/assets remain inert resources.
 When `CODEX_HOME` has a plugin cache (approved or as a user Skill area), that same read-only
```

**File**: `src/main/skill-library.ts` (modified, +41/-5)
```diff
@@ -9,7 +9,7 @@ import { listSkills, readSkill, readSkillTextSnapshot, skillCatalogSnapshot, ski
 import { approvedManagedSkillLink, sameSkillLink } from './skill-links.js';
 import { parseCodexPluginManifest, parseSkillConfiguration, parseSkillFrontmatter, parseSkillInterface, type SkillConfiguration } from './skill-metadata.js';
 import { listInstalledCodexPlugins } from './codex-plugin-runtime.js';
-import type { ClaudePluginSkillProvenance, CodexPluginRuntimeEntry, CodexPluginSkillProvenance, SkillLibrary, SkillMetadata, SkillScope, SkillSource } from '../shared/skills.js';
+import type { ClaudePluginSkillProvenance, CodexPluginRuntimeEntry, CodexPluginSkillProvenance, LibrarySkill, SkillLibrary, SkillMetadata, SkillScope, SkillSource } from '../shared/skills.js';
 import type { SkillRoutingMetadata } from '../shared/skill-routing.js';
 import { discoverUserSkillPath } from './user-skills.js';
 
@@ -575,11 +575,47 @@ export function skillLibraryInstructions(library: SkillLibrary): string {
   const limit = (library.maxContextTokens ?? 2000) * 4;
   let chars = lines.join('\n').length;
   if (chars > limit) return '';
-  for (const skill of library.skills.filter(value => value.allowImplicitInvocation)) {
-    const row = JSON.stringify({ id: skill.id, name: skill.displayName ?? skill.name, description: (skill.shortDescription ?? skill.description).slice(0, 240), path: skill.path });
-    if (chars + row.length + 100 > limit) { lines.push('Additional Skills omitted from this bounded index; open Skills to inspect the full catalog.'); break; }
-    lines.push(`- ${row}`); chars += row.length + 3;
+  // Sources take turns, so one large source cannot crowd the others out of the bounded index:
+  // on a real Mac (2026-10-05) 26 ~/.agents and Codex Skills filled it and all 66 Claude Skills
+  // were left out. Rows sharing a folder are written under it once; long plugin and synced folders
+  // were most of every row.
+  const implicit = library.skills.filter(value => value.allowImplicitInvocation);
+  // Claude's plugin and own (synced) Skills, and Codex's, are separate sources; repo, project and
+  // managed Skills share one turn as the user's own.
+  const family = (skill: LibrarySkill): string =>
+    ['user-agents', 'codex-home', 'codex-plugin', 'claude-home', 'claude-plugin'].includes(skill.source) ? skill.source : 'own';
+  const queues = new Map<string, LibrarySkill[]>();
+  for (const skill of implicit) queues.set(family(skill), [...queues.get(family(skill)) ?? [], skill]);
+  const turns: LibrarySkill[] = [];
+  for (let round = 0; turns.length < implicit.length; round++)
+    for (const queue of queues.values()) { const next = queue[round]; if (next) turns.push(next); }
+  const split = (skill: LibrarySkill): { folder: string; entry: string } => {
+    const match = /^(.*)\/([^/]+)\/SKILL\.md$/.exec(skill.path);
+    return match ? { folder: match[1]!, entry: match[2]! } : { folder: '', entry: skill.path };
+  };
+  const row = (skill: LibrarySkill): string => {
+    const name = skill.displayName ?? skill.name;
+    const about = (skill.shortDescription ?? skill.description).replace(/\s+/g, ' ').trim();
+    return `  - ${split(skill).entry}: /${skill.id}${name !== skill.id && !skill.id.startsWith(`${name}--`) ? ` (${name})` : ''} — ${about.length > 110 ? `${about.slice(0, 109)}…` : about}`;
+  };
+  const chosen: LibrarySkill[] = [];
+  const opened = new Set<string>();
+  const reserve = 160;
+  for (const skill of turns) {
+    const { folder } = split(skill);
+    const cost = row(skill).length + 1 + (opened.has(folder) ? 0 : folder.length + 12);
+    if (chars + cost + reserve > limit) continue;
+    chars += cost; opened.add(folder); chosen.push(skill);
+  }
+  if (chosen.length) lines.push('Each Skill is <folder>/<entry>/SKILL.md; read it with read before following it.');
+  const folders = new Map<string, LibrarySkill[]>();
+  for (const skill of chosen) folders.set(split(skill).folder, [...folders.get(split(skill).folder) ?? [], skill]);
+  for (const [folder, rows] of folders) {
+    lines.push(folder ? `- Folder ${folder}` : '- Other');
+    for (const skill of rows) lines.push(row(skill));
   }
+  const left = implicit.length - chosen.length;
+  if (left > 0) lines.push(`${left} more Skills are installed but not listed here, to keep this index short. The user can pick any of them with / in the message box.`);
   if (library.errors.length) lines.push('Some Skills could not be indexed. The Skills library displays the errors.');
   return lines.join('\n');
 }
```

**File**: `test/skill-library.test.ts` (modified, +31/-0)
```diff
@@ -5,6 +5,7 @@ import { makeTempDir, removeTempDir } from './helpers.js';
 import { defaultConfig, getConfig, initConfigPath, saveConfig } from '../src/main/config.js';
 import { initSkillsPath, importSkillPackage, listSkills, removeSkill } from '../src/main/skills.js';
 import { listSkillLibrary, readLibrarySkill, skillLibraryInstructions } from '../src/main/skill-library.js';
+import type { LibrarySkill } from '../src/shared/skills.js';
 
 let root: string, project: string;
 const contents = (name: string, body = 'Keep all instructions.') => `---\nname: ${name}\ndescription: >-\n  Check the source\n  before editing.\n---\n${body}`;
@@ -245,3 +246,33 @@ it('lists only the signed-in Claude account\'s synced Skills and stays quiet abo
   expect(library.skills.map(skill => `${skill.name}:${skill.source}`).sort()).toEqual(['Pdf:claude-home', 'Shared:user-agents']);
   expect(library.errors).toEqual([]);
 });
+
+it('shares the bounded Skills index across sources and writes each folder once', () => {
+  // Measured on a real Mac (2026-10-05): 21 ~/.agents and 5 Codex Skills filled the index first,
+  // and all 66 Claude Skills, plugin and synced, were left out.
+  const skill = (source: LibrarySkill['source'], folder: string, name: string, implicit = true): LibrarySkill => ({
+    id: `${name}--${source}`, name, description: `${name} does one careful thing well, with checks before and after every single step it takes.`,
+    path: `${folder}/${name}/SKILL.md`, scope: source === 'managed' ? 'managed' : 'user', source, managed: source === 'managed', allowImplicitInvocation: implicit });
+  const plugin = '/user-skills/claude/plugins/cache/claude-plugins-official/superpowers/6.4.1/skills';
+  const synced = '/user-skills/claude/skills/synced/26cc62c5-fb37-4985-a89b-dfd98481eecc_94f9fd01-b3be-4e08-804b-418e3fd927f7';
+  const skills = [
+    skill('managed', '/skills', 'clear-writing'),
+    ...Array.from({ length: 21 }, (_, index) => skill('user-agents', '/user-skills/agents/skills', `agents-${index}`)),
+    ...Array.from({ length: 5 }, (_, index) => skill('codex-home', '/user-skills/codex/skills', `codex-${index}`)),
+    ...Array.from({ length: 40 }, (_, index) => skill('claude-plugin', plugin, `plugin-${index}`)),
+    ...Array.from({ length: 26 }, (_, index) => skill('claude-home', synced, `synced-${index}`)),
+    skill('claude-plugin', plugin, 'hidden-helper', false)
+  ];
+  const text = skillLibraryInstructions({ skills, errors: [], roots: [], includeInstructions: true });
+  const listed = skills.filter(entry => text.includes(`/${entry.id}`));
+  expect(text.length).toBeLessThanOrEqual(2000 * 4 + 400);
+  expect(listed.length).toBeGreaterThanOrEqual(45);
+  for (const source of ['managed', 'user-agents', 'codex-home', 'claude-plugin', 'claude-home'] as const)
+    expect(listed.some(entry => entry.source === source), source).toBe(true);
+  expect(text).not.toContain('hidden-helper');
+  // Long shared folders appear once, as a heading the rows complete.
+  expect(text.split(plugin).length - 1).toBe(1);
+  expect(text.split(synced).length - 1).toBe(1);
+  expect(text).toContain(`${skills.length - 1 - listed.length} more Skills are installed`);
+  expect(text).toMatch(/pick (?:any of )?them with \//);
+});
```

#### Recent Merged Pull Requests:
- **PR #1147** (2026-10-06): Search every settings page from the sidebar (@Maximapple)
- **PR #1145** (2026-10-06): Show an unset sub-agent default as Automatic instead of an empty select (@Maximapple)
- **PR #1144** (2026-10-06): Center the Setup check marks, balance Health, keep the chat out of Agents & automation (@Maximapple)
- **PR #1142** (2026-10-05): Show app-sent messages without Markdown escapes (@Maximapple)
- **PR #1141** (2026-10-05): Say why silence recovery leaves a chat alone (#1086) (@Maximapple)
- **PR #1139** (closed): Pin chats in the sidebar (@m1d0e1)
- **PR #1137** (2026-10-05): Pin chats to the top of their list in the sidebar (@Maximapple)
- **PR #1135** (2026-10-05): Recover chats after Stream cache expired (@lavalava45)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
