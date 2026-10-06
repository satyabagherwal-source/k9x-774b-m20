# Forensic Learning Record (Deep Inspection): morluto/rea

> **Canonical Artifact**: `07_PROJECT_LEARNING/morluto-rea-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/morluto/rea](https://github.com/morluto/rea))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:34:14.228Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `morluto/rea`
- **Description**: Reverse engineer anything with agents, from app behavior down to native binaries.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 6207 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `scripts/lib/catalog-core.mjs`
```
import { createHash } from "node:crypto";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import canonicalize from "canonicalize";

const load = (root, path) => import(pathToFileURL(join(root, path)).href);

/** Sort tool/provider names alphabetically. */
export const names = (contracts) =>
  contracts
    .map(({ name }) => name)
    .sort((left, right) => left.localeCompare(right));

/** Return the stable digest for a generated catalog projection. */
export const digest = (value) => {
  const encoded = canonicalize(value);
  if (encoded === undefined)
    throw new TypeError("Catalog projection is not canonical JSON");
  return createHash("sha256").update(encoded).digest("hex");
};

/** Throw when two name lists diverge. */
export const assertSameNames = (label, actual, expected) => {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  const missing = [...expectedSet].filter((name) => !actualSet.has(name));
  const extra = [...actualSet].filter((name) => !expectedSet.has(name));
  if (missing.length === 0 && extra.length === 0) return;
  throw new Error(
    `${label} drifted (missing: ${missing.join(", ") || "none"}; extra: ${extra.join(", ") || "none"})`,
  );
};

const SOURCE_PATHS = {
  packageMetadata: "dist/generatedPackageMetadata.js",
  catalogIdentity: "dist/catalogIdentity.js",
  cli: "dist/cli.js",
  toolContracts: "dist/contracts/toolContracts.js",
  officialContracts: "dist/contracts/officialToolContracts.js",
  enhancedContracts: "dist/contracts/enhancedToolContracts.js",
  sessionContracts: "dist/contracts/sessionToolContracts.js",
  nativeContracts: "dist/contracts/nativeToolContracts.js",
  artifactContracts: "dist/contracts/artifactToolContracts.js",
  managedContracts: "dist/contracts/managedToolContracts.js",
  managedWorkflowContracts: "dist/contracts/managedWorkflowToolContracts.js",
  browserContracts: "dist/contracts/browserToolContracts.js",
  browserScenarioContracts: "dist/contracts/browserScenarioToolContracts.js",
  electronContracts: "dist/contracts/electronToolContracts.js",
  javascriptRuntimeObservationContracts:
    "dist/contracts/javascriptRuntimeObservationToolContracts.js",
  applicationContracts: "dist/contracts/applicationToolContracts.js",
  supportedClients: "dist/application/SupportedClients.js",
  hopperProvider: "dist/hopper/HopperProvider.js",
  ghidraProvider: "dist/ghidra/GhidraProvider.js",
  nativeProvider: "dist/native/NativeMacOSProvider.js",
  artifactProviders: "dist/application/InvestigationProviders.js",
  browserProvider: "dist/browser/CdpBrowserProvider.js",
  browserScenarioProvider: "dist/browser/PlaywrightBrowserScenarioProvider.js",
  electronProvider: "dist/browser/CdpElectronProvider.js",
  electronActiveProvider: "dist/browser/PlaywrightElectronActiveProvider.js",
  v8InspectorProvider: "dist/browser/V8InspectorProvider.js",
  evidence: "dist/domain/evidence.js",
  evidenceBundle: "dist/domain/evidenceBundle.js",
  evidenceCompletion: "dist/domain/evidenceCompletionLedger.js",
  completionGeneration: "dist/domain/completionLedgerGeneration.js",
  processCapture: "dist/domain/processCapture.js",
  analysisSnapshot: "dist/domain/analysisSnapshot.js",
  artifactGraph: "dist/domain/artifactGraph.js",
  browserObservation: "dist/domain/browserObservation.js",
  browserScenario: "dist/domain/browserScenario.js",
  browserScenarioCapture: "dist/domain/browserScenarioCapture.js",
  browserScenarioDiff: "dist/domain/browserScenarioDiff.js",
  browserSession: "dist/domain/browserSession.js",
  electronObservation: "dist/domain/electronObservation.js",
  electronActiveObservation: "dist/domain/electronActiveObservation.js",
  javascriptRuntimeObservation: "dist/domain/javascriptRuntimeObservation.js",
  webBundleAnalysis: "dist/domain/webBundleAnalysis.js",
  webCaptureDiff: "dist/domain/webCaptureDiff.js",
  managedArtifact: "dist/domain/managedArtifact.js",
  managedComparison: "dist/domain/managedMemberComparison.js",
  managedNativeVerification: "dist/domain/managedNativeVerification.js",
  webMcpDiscovery: "dist/domain/webMcpDiscovery.js",
  webScreenshot: "dist/domain/webScreenshot.js",
  javascriptApplicationGraph: "dist/domain/javascriptApplicationGraph.js",
  javascriptApplicationAnalysis: "dist/domain/javascriptApplicationAnalysis.js",
  javascriptSemanticGraph: "dist/domain/javascriptSemanticGraph.js",
  javascriptSemanticQuery: "dist/domain/javascriptSemanticQuerySchemas.js",
  javascriptSemanticTrace: "dist/domain/javascriptSemanticTraceSchemas.js",
  javascriptFeatureTrace: "dist/domain/javascriptFeatureTraceSchemas.js",
  javascriptVersionComparison:
    "dist/domain/javascriptApplicationVersionComparisonSchemas.js",
  reconstructionVerification:
    "dist/domain/reconstructionVerificationSchemas.js",
  residualUnknown: "dist/domain/residualUnknown.js",
};

/** Load every compiled source module referenced by the catalog. */
export const loadSources = async (root) =>
  Object.fromEntries(
    await Promise.all(
      Object.entries(SOURCE_PATHS).map(async ([key, path]) => [
        key,
        await load(root, path),
      ]),
    ),
  );

```

### Core Architecture Module: `scripts/lib/verify-package-core.mjs`
```
import { execFile } from "node:child_process";
import { lstat } from "node:fs/promises";
import { promisify } from "node:util";
import { Ajv2020 } from "ajv/dist/2020.js";

/** Promisified child_process execution helper. */
export const exec = promisify(execFile);

/** Run a command and return its stdout. */
export const run = async (command, args, env) =>
  (await exec(command, args, { env })).stdout;

/** Run a command and treat exit code 1 as a non-throwing status result. */
export const runWithStatus = async (command, args, env) => {
  try {
    return { stdout: await run(command, args, env), status: 0 };
  } catch (cause) {
    if (
      typeof cause === "object" &&
      cause !== null &&
      cause.code === 1 &&
      typeof cause.stdout === "string"
    )
      return { stdout: cause.stdout, status: 1 };
    throw cause;
  }
};

/** Parse JSON from a command output string. */
export const json = (text) => JSON.parse(text);

/** Verify schema validity and that the MCP catalog matches session metadata. */
export const verifyCompleteToolCatalog = async (client, options) => {
  const listed = await client.listTools(undefined, options);
  const ajv = new Ajv2020({ strict: false, validateFormats: false });
  for (const tool of listed.tools) {
    for (const kind of ["inputSchema", "outputSchema"]) {
      const schema = tool[kind];
      if (schema !== undefined && !ajv.validateSchema(schema))
        throw new Error(
          `packaged MCP has invalid ${tool.name}.${kind}: ${ajv.errorsText(ajv.errors)}`,
        );
    }
  }
  const status = await client.callTool(
    { name: "binary_session", arguments: {} },
    options,
  );
  const availability = status.structuredContent?.result?.tool_availability;
  if (!Array.isArray(availability))
    throw new Error("packaged MCP omitted tool availability");
  const expected = availability.map(({ name }) => name).sort();
  const observed = listed.tools.map(({ name }) => name).sort();
  if (JSON.stringify(observed) !== JSON.stringify(expected))
    throw new Error(
      "packaged MCP tool inventory diverged from session metadata",
    );
  return observed;
};

/** Check whether a path exists on disk. */
export const pathExists = async (path) => {
  try {
    await lstat(path);
    return true;
  } catch (cause) {
    if (cause instanceof Error && "code" in cause && cause.code === "ENOENT")
      return false;
    throw cause;
  }
};

/** Synthetic function dossier for managed/native verification fixtures. */
export const functionDossier = (name) => {
  return {
    procedure: {
      address: "0x401000",
      name,
      classification: {
        external: false,
        thunk: false,
        thunk_target: null,
        provenance: "synthetic-provider",
      },
      signature: null,
      locals: [],
    },
    pseudocode: "",
    assembly: [],
    comments: [],
    callers: [],
    callees: [],
    incoming_references: [],
    outgoing_references: [],
    referenced_strings: [],
    referenced_names: [],
    basic_blocks: [],
    limitations: [],
  };
};

```

### Core Architecture Module: `src/application/ProcessCaptureLifecycle.ts`
```
import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { IPty } from "@lydell/node-pty";

import type {
  FilesystemCheckpoint,
  InteractionEvent,
  ProcessCapture,
  UnverifiedProcessCapture,
  ProcessSample,
  ProcessSettlement,
  ProcessScenario,
  ProcessCaptureEventJournalEntry,
  RecordProcessCaptureEvent,
  TerminalFrame,
} from "../domain/processCapture.js";
import {
  digestProcessCommitment,
  processComparisonContract,
  processScenarioCommitment,
} from "../domain/processCapture.js";
import { PRODUCT_IDENTITY } from "../identity.js";
import type { SnapshotResult } from "./FilesystemSnapshot.js";
import { snapshotRoots } from "./FilesystemSnapshot.js";
import { classifyFilesystemEffects } from "./ProcessFilesystemEffects.js";
import { cleanupOwnedProcessGroup } from "../process/ProcessOwnership.js";
import { observeOwnedProcessGroup } from "../process/ProcessOwnershipObservation.js";
import { ProcessCaptureError } from "./ProcessCaptureError.js";
import { assertNotCancelled } from "./ProcessScenarioRuntimeValidation.js";
import {
  normalizeProcessElapsedTime,
  normalizeProcessSamples,
  normalizeProcessText,
} from "./ProcessNormalization.js";
import { PROCESS_PROVIDER } from "./ProcessEvidence.js";
import { TerminalRenderer } from "./TerminalRenderer.js";
import { scheduleProcessInterval, type ProcessTimer } from "./ProcessTimer.js";

interface TerminalExitOptions {
  readonly terminal: IPty;
  readonly scenario: ProcessScenario;
  readonly started: number;
  readonly lastOutput: () => number;
  readonly signal: AbortSignal | undefined;
  readonly timers: Set<ProcessTimer>;
  readonly interactions: InteractionEvent[];
  readonly dispatchedEventIndexes: ReadonlySet<number>;
  readonly recordEvent: RecordProcessCaptureEvent;
}

interface CaptureResultOptions {
  readonly frames: readonly TerminalFrame[];
  readonly exit: {
    readonly exitCode: number;
    readonly signal?: number;
    readonly reason: "exited" | "timeout" | "idle_timeout";
  };
  readonly samples: readonly ProcessSample[];
  readonly before: SnapshotResult;
  readonly after: SnapshotResult;
  readonly truncated: boolean;
  readonly scenario: ProcessScenario;
  readonly rootPid: number;
  readonly samplingPartial: boolean;
  readonly renderedFrames: UnverifiedProcessCapture["rendered_frames"];
  readonly interactions: readonly InteractionEvent[];
  readonly checkpoints: readonly FilesystemCheckpoint[];
  readonly settlement: ObservedProcessSettlement;
  readonly manifest: UnverifiedProcessCapture["manifest"];
  readonly eventJournal: readonly ProcessCaptureEventJournalEntry[];
}

/** Settlement observation before process-resource cleanup has completed. */
export type ObservedProcessSettlement =
  | Pick<
      Extract<ProcessSettlement, { readonly state: "quiesced" }>,
      "state" | "elapsed_ms"
    >
  | Pick<
      Exclude<ProcessSettlement, { readonly state: "quiesced" }>,
      "state" | "elapsed_ms"
    >;

/** Capture observations before owned-resource cleanup has been verified. */
export type PendingProcessCapture = Omit<
  UnverifiedProcessCapture,
  "cleanup" | "settlement"
> & {
  readonly settlement: ObservedProcessSettlement;
};

/** Wait for trailing PTY callbacks before the capture becomes immutable. */
export const settleProcessCaptureJournal = async (
  journal: readonly ProcessCaptureEventJournalEntry[],
  quietMs = 25,
  maxWaitMs = 500,
): Promise<void> => {
  const deadline = Date.now() + maxWaitMs;
  let observed = journal.length;
  let lastChangeAt = Date.now();
  while (Date.now() < deadline) {
    await new Promise<void>((resolve) => setTimeout(resolve, 4));
    if (journal.length !== observed) {
      observed = journal.length;
      lastChangeAt = Date.now();
    } else if (Date.now() - lastChangeAt >= quietMs) return;
  }
};

export const buildCaptureResult = (
  options: CaptureResultOptions,
): PendingProcessCapture => {
  const hasSensitiveScriptedInput = options.scenario.events.some(
    (event) => event.type === "input" && event.sensitive,
  );
  const sensitiveInputUnknown =
    "Sensitive scripted input values are redacted from process capture Evidence.";
  const filesystemObservationUnknown =
    "No filesystem observation paths were selected; filesystem effects remain unknown.";
  const hasFilesystemObservations =
    options.scenario.filesystem_observation_paths.length > 0;
  return {
    manifest: options.manifest,
    normalization: options.scenario.normalization,
    frames: options.frames,
    rendered_frames: options.renderedFrames,
    interaction_events: options.interactions,
    exit: {
      code:
        options.exit.reason === "exited" && options.exit.exitCode >= 0
          ? options.exit.exitCode
          : null,
      signal: options.exit.signal ?? null,
      reason: options.exit.reason,
    },
    settlement: options.settlement,
    process_samples: normalizeProcessSamples(
      options.samples,
      options.scenario,
      options.rootPid,
    ),
    filesystem_checkpoints: options.checkpoints,
    event_journal: options.eventJournal,
    files_before: options.before.files,
    files_after: options.after.files,
    filesystem_effects: classifyFilesystemEffects(
      options.before.files,
      options.after.files,
    ),
    truncated: options.truncated,
    limitations: [
      "Process trees are sampled and may omit short-lived descendants.",
      ...(options.samplingPartial
        ? ["Process-tree sampling ended with an incomplete observation."]
        : []),
      "Filesystem observations are before/after snapshots, not syscall traces.",
      "Inherited host environment variables are not recorded and may affect results.",
      ...(!hasFilesystemObservations ? [filesystemObservationUnknown] : []),
      ...(hasSensitiveScriptedInput ? [sensitiveInputUnknown] : []),
    ],
    residual_unknowns: [
      {
        scope: "process",
        reason:
          "Process trees are sampled and may omit short-lived descendants.",
      },
      {
        scope: "environment",
        reason: "Inherited host environment variables are not recorded.",
      },
      {
        scope: "network",
        reason: "Network activity is not observed by this capture.",
      },
      ...(!hasFilesystemObservations
        ? [
            {
              scope: "filesystem" as const,
              reason: filesystemObservationUnknown,
            },
          ]
        : []),
      ...(hasSensitiveScriptedInput
        ? [{ scope: "interaction" as const, reason: sensitiveInputUnknown }]
        : []),
    ],
  };
};

const hashFile = async (path: string): Promise<string> => {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
};

export const createRunManifest = async (
  scenario: ProcessScenario,
  startedAt: Date,
  completedAt: Date,
  host: {
    readonly platform: NodeJS.Platform;
    readonly architecture: NodeJS.Architecture;
  } = {
    platform: process.platform,
    architecture: process.arch,
  },
): Promise<UnverifiedProcessCapture["manifest"]> => {
  const executableSha256 = await hashFile(scenario.executable);
  const scenarioCommitment = processScenarioCommitment(
    scenario,
    executableSha256,
  );
  const comparisonContract = processComparisonContract(scenario);
  return {
    rea_version: PRODUCT_IDENTITY.packageVersion,
    provider_version: PROCESS_PROVIDER.version,
    platform: host.platform,
    architecture: host.architecture,
    pty_backend: "node-pty",
    started_at: startedAt.toISOString(),
    completed_at: completedAt.toISOString(),
    scenario: scenarioCommitment,
    comparison_contract: comparisonContract,
    full_scenario_sha256: digestProcessCommitment(scenarioCommitment),
    comparison_contract_sha256: digestProcessCommitment(comparisonContract),
    executable_sha256: executableSha256,
    normalization_sha256: digestProcessCommitment(scenario.normalization),
  };
};

export const observeSettlement = async (
  runId: string,
  processGroupIds: readonly number[],
  settleMs: number,
  recordEvent: RecordProcessCaptureEvent = () => undefined,
  platform: NodeJS.Platform = process.platform,
): Promise<ObservedProcessSettlement> => {
  if (platform === "win32") {
    recordEvent("lifecycle", 1);
    return { state: "unverifiable", elapsed_ms: 0 };
  }
  const started = Date.now();
  let consecutiveEmpty = 0;
  let deadlineReached = false;
  while (!deadlineReached) {
    const observations = await Promise.all(
      [...new Set(processGroupIds)].map((processGroupId) =>
        observeOwnedProcessGroup({
          runId,
          leaderPid: processGroupId,
          processGroupId,
        }),
      ),
    );
    if (observations.some(({ state }) => state === "unverifiable")) {
      recordEvent("lifecycle", 1);
      return { state: "unverifiable", elapsed_ms: Date.now() - started };
    }
    if (observations.every(({ state }) => state === "empty")) {
      consecutiveEmpty += 1;
      if (consecutiveEmpty >= 2) {
        recordEvent("lifecycle", 1);
        return { state: "quiesced", elapsed_ms: Date.now() - started };
      }
    } else consecutiveEmpty = 0;
    deadlineReached = Date.now() - started >= settleMs;
    if (deadlineReached) break;
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
  }
  recordEvent("lifecycle", 1);
  return { state: "alive_at_deadline", elapsed_ms: Date.now() - started };
};

export const awaitTerminalExit = async ({
  terminal,
  scenario,
  started,
  lastOutput,
  signal,
  timers,
  interactions,
  dispatchedEventIndexes,
  recordEvent,
}: TerminalExitOptions): Promise<{
  exitCode: number;
  signal?: number;
  reason: "exited" | "timeout" | "idle_timeout" | "cancelled";
}> =>
  new Promise((resolveExit) => {
    // The kill caused 
```

### Core Architecture Module: `src/application/TerminalRenderer.ts`
```
import { createRequire } from "node:module";

import type {
  RecordProcessCaptureEvent,
  RenderedTerminalFrame,
} from "../domain/processCapture.js";

const require = createRequire(import.meta.url);
// SAFETY: both pinned xterm packages publish CommonJS at runtime and matching declarations.
const HeadlessPackage =
  require("@xterm/headless") as typeof import("@xterm/headless");
// SAFETY: the addon package is pinned with the compatible headless xterm release.
const SerializePackage =
  require("@xterm/addon-serialize") as typeof import("@xterm/addon-serialize");

interface TerminalRendererOptions {
  readonly columns: number;
  readonly rows: number;
  readonly scrollback: number;
  readonly maxBytes: number;
  readonly normalize: (value: string) => string;
  readonly recordEvent?: RecordProcessCaptureEvent;
}

/**
 * Owns one headless terminal and serializes writes into deterministic frames.
 * Reconstructs bounded terminal states while raw PTY chunks remain authoritative.
 *
 * Rendered frames answer what an operator saw after control-sequence handling;
 * raw frames preserve byte/chunk differences that can render identically.
 * Comparisons retain both because neither representation subsumes the other.
 */
export class TerminalRenderer {
  readonly #terminal: InstanceType<typeof HeadlessPackage.Terminal>;
  readonly #serializeAddon = new SerializePackage.SerializeAddon();
  readonly #frames: RenderedTerminalFrame[] = [];
  #pending: Promise<void> = Promise.resolve();
  #capturedBytes = 0;
  #truncated = false;

  constructor(private readonly options: TerminalRendererOptions) {
    this.#terminal = new HeadlessPackage.Terminal({
      allowProposedApi: true,
      cols: options.columns,
      rows: options.rows,
      scrollback: options.scrollback,
    });
    this.#terminal.loadAddon(this.#serializeAddon);
  }

  /** Queue one PTY chunk and capture state only after xterm has parsed it. */
  write(data: string, atMs: number): void {
    this.#pending = this.#pending.then(
      () =>
        new Promise<void>((resolveWrite) => {
          this.#terminal.write(data, () => {
            this.#capture(atMs);
            resolveWrite();
          });
        }),
    );
  }

  /** Queue a terminal resize after every preceding write. */
  resize(columns: number, rows: number, atMs: number): void {
    this.#pending = this.#pending.then(() => {
      this.#terminal.resize(columns, rows);
      this.#capture(atMs);
    });
  }

  /** Await all queued parsing and return immutable rendered observations. */
  async frames(): Promise<readonly RenderedTerminalFrame[]> {
    await this.#pending;
    return structuredClone(this.#frames);
  }

  /** Whether a rendered observation exceeded its independent capture budget. */
  truncated(): boolean {
    return this.#truncated;
  }

  /** Release addon and terminal resources after all writes settle. */
  async dispose(): Promise<void> {
    await this.#pending;
    this.#serializeAddon.dispose();
    this.#terminal.dispose();
  }

  #capture(atMs: number): void {
    const buffer = this.#terminal.buffer.active;
    const lines: string[] = [];
    for (let row = 0; row < this.#terminal.rows; row += 1) {
      const line = buffer.getLine(buffer.viewportY + row);
      lines.push(
        this.options.normalize(
          (line?.translateToString(false, 0, this.#terminal.cols) ?? "").padEnd(
            this.#terminal.cols,
            " ",
          ),
        ),
      );
    }
    const serializedState = this.options.normalize(
      this.#serializeAddon.serialize(),
    );
    const bytes =
      Buffer.byteLength(serializedState) +
      lines.reduce((total, line) => total + Buffer.byteLength(line), 0);
    if (this.#capturedBytes + bytes > this.options.maxBytes) {
      this.#truncated = true;
      return;
    }
    this.#capturedBytes += bytes;
    const sequence = this.#frames.length;
    this.#frames.push({
      sequence,
      at_ms: atMs,
      columns: this.#terminal.cols,
      rows: this.#terminal.rows,
      cursor_x: buffer.cursorX,
      cursor_y: buffer.cursorY,
      active_buffer: buffer.type,
      lines,
      serialized_state: serializedState,
    });
    this.options.recordEvent?.("rendered_frames", sequence);
  }
}

```

### Core Architecture Module: `src/browser/CdpCaptureEventState.ts`
```
import type {
  InspectWebPageInput,
  WebPageInspection,
} from "../domain/browserObservation.js";
import type { CdpCaptureCompleteness } from "./CdpCaptureCompleteness.js";
import type { CapturedScript, NetworkState } from "./CdpCaptureEventTypes.js";

export interface CdpCaptureEventsState {
  readonly input: InspectWebPageInput;
  readonly allowedOrigins: ReadonlySet<string>;
  readonly scripts: Map<string, CapturedScript>;
  readonly executionContextFrames: Map<string, string>;
  readonly network: Map<string, NetworkState>;
  readonly allowedWebSockets: Set<string>;
  console: WebPageInspection["console"]["events"];
  websockets: WebPageInspection["network"]["websocket_events"];
  responseMetadata: WebPageInspection["metadata"]["responses"];
  agentHints: WebPageInspection["metadata"]["agent_hints"];
  readonly completeness: CdpCaptureCompleteness;
  originViolation: boolean;
  navigationDuringCapture: boolean;
  mainFrameId: string | undefined;
  /**
   * Identity of the document last observed in the main frame. `frameNavigated`
   * re-fires for the same document, so this is what distinguishes a real
   * document change from a duplicate event.
   */
  committedDocument: string | undefined;
}

```

### Core Architecture Module: `src/browser/CdpElectronWorkers.ts`
```
import type {
  ElectronPageInspection,
  InspectElectronPageInput,
} from "../domain/electronObservation.js";
import type { CdpConnection } from "./CdpConnection.js";
import { CdpCaptureCompleteness } from "./CdpCaptureCompleteness.js";
import { recordValue, recordsValue, stringValue } from "./CdpCaptureValues.js";
import type { CdpEndpointTarget } from "./CdpEndpoint.js";
import { optionalCdpCommand } from "./CdpOptionalCommand.js";
import { authorizedElectronFile } from "./ElectronFileScope.js";

/** Inventory local worker targets without attaching to them. */
export const captureElectronWorkers = async (input: {
  readonly connection: CdpConnection;
  readonly signal?: AbortSignal;
  readonly target: CdpEndpointTarget;
  readonly request: InspectElectronPageInput;
  readonly frameIds: ReadonlySet<string>;
  readonly completeness: CdpCaptureCompleteness;
  readonly limitations: string[];
}): Promise<ElectronPageInspection["workers"]> => {
  const result = await optionalCdpCommand(
    {
      connection: input.connection,
      sessionId: undefined,
      ...(input.signal === undefined ? {} : { signal: input.signal }),
    },
    "Target.getTargets",
    {},
    input.limitations,
  );
  if (result === undefined) {
    input.completeness.unavailable("workers");
    return [];
  }
  const workers: ElectronPageInspection["workers"] = [];
  for (const target of recordsValue(recordValue(result)?.targetInfos)) {
    const type = stringValue(target.type) ?? "";
    if (!type.includes("worker")) continue;
    const openerTargetId = boundedTargetField(target.openerId);
    const parentFrameId = boundedTargetField(target.parentFrameId);
    if (
      openerTargetId !== input.target.id &&
      (parentFrameId === null || !input.frameIds.has(parentFrameId))
    ) {
      input.completeness.exclude("workers", "out_of_target_scope");
      continue;
    }
    const path = await authorizedElectronFile(stringValue(target.url) ?? "");
    if (path === undefined) {
      input.completeness.exclude("workers", "out_of_target_scope");
      continue;
    }
    const targetId = boundedTargetField(target.targetId);
    if (targetId === null) {
      input.completeness.exclude("workers", "invalid_protocol_value");
      continue;
    }
    workers.push({
      target_id: targetId,
      type,
      file_path: path,
      attached: target.attached === true,
      opener_target_id: openerTargetId,
      parent_frame_id: parentFrameId,
    });
  }
  return workers.sort((left, right) =>
    left.target_id.localeCompare(right.target_id),
  );
};

const boundedTargetField = (value: unknown): string | null => {
  const field = stringValue(value);
  return field === undefined || field === "" ? null : field;
};

```

### Core Architecture Module: `src/browser/CdpPageCaptureWorkers.ts`
```
import type { WebPageInspection } from "../domain/browserObservation.js";
import type { CdpCaptureEvents } from "./CdpCaptureEvents.js";
import {
  allowedSanitizedUrl,
  isHttpUrl,
  recordValue,
  recordsValue,
  stringValue,
} from "./CdpCaptureValues.js";
import type { CaptureContext } from "./CdpPageCapture.js";
import { optionalCdpCommand } from "./CdpOptionalCommand.js";

interface CaptureWorkersInput {
  readonly context: CaptureContext;
  readonly allowedOrigins: ReadonlySet<string>;
  readonly limitations: string[];
  readonly events: CdpCaptureEvents;
}

export const captureWorkers = async (
  input: CaptureWorkersInput,
  frameIds: ReadonlySet<string>,
): Promise<WebPageInspection["workers"]> => {
  const { context, allowedOrigins, limitations, events } = input;
  const completeness = events.completeness;
  const result = await optionalCdpCommand(
    { ...context, sessionId: undefined },
    "Target.getTargets",
    {},
    limitations,
  );
  const items: WebPageInspection["workers"] = [];
  if (result === undefined) completeness.unavailable("workers");
  for (const target of recordsValue(recordValue(result)?.targetInfos)) {
    const type = stringValue(target.type) ?? "";
    const url = allowedSanitizedUrl(target.url, allowedOrigins);
    const relatedToPage =
      stringValue(target.openerId) === context.target.id ||
      (stringValue(target.parentFrameId) !== undefined &&
        frameIds.has(stringValue(target.parentFrameId) ?? ""));
    if (!type.includes("worker")) continue;
    if (!relatedToPage) {
      completeness.exclude("workers", "out_of_target_scope");
      continue;
    }
    if (url === undefined) {
      const rawUrl = stringValue(target.url);
      completeness.exclude(
        "workers",
        rawUrl === undefined || rawUrl === ""
          ? "unattributed_origin"
          : isHttpUrl(rawUrl)
            ? "disallowed_origin"
            : "unsupported_url",
      );
      continue;
    }
    items.push({
      target_id: stringValue(target.targetId) ?? "",
      type,
      url: url.url,
      origin: url.origin,
      attached: target.attached === true,
      opener_target_id: stringValue(target.openerId) ?? null,
      parent_frame_id: stringValue(target.parentFrameId) ?? null,
    });
  }
  return items;
};

```

### Core Architecture Module: `src/cli/coreAnalysisCommands.ts`
```
import { z } from "incur";
import { stat } from "node:fs/promises";
import { resolve } from "node:path";

import { runDirectAnalysis } from "../application/DirectAnalysis.js";
import { CLI_COMMANDS } from "../cliCommandNames.js";
import { logCliCommand } from "../cliLogging.js";
import type { Logger } from "../logger.js";
import { directAnalysisOptions, providerSelectionOption } from "./options.js";
import type { CliInstance } from "./types.js";
import { runCliJavaScriptApplicationAnalysis } from "./javascriptApplicationAnalysis.js";

export const registerCoreAnalysisCommands = (
  cli: CliInstance,
  logger: Logger,
): void => {
  registerCoreCommands(cli, logger);
  cli.command(CLI_COMMANDS.traceNativeValues, {
    description: "Trace bounded native def-use and call dependencies",
    args: z.object({
      path: z.string().describe("Local native executable or app path"),
      procedure: z
        .string()
        .describe("Explicit native procedure symbol or address"),
    }),
    options: z.object({
      maxDepth: z
        .number()
        .int()
        .min(0)
        .max(16)
        .default(3)
        .describe("Maximum call traversal depth"),
      maxFunctions: z
        .number()
        .int()
        .min(1)
        .max(64)
        .default(16)
        .describe("Maximum function decompilations"),
      maxCallSites: z
        .number()
        .int()
        .min(1)
        .max(4096)
        .default(256)
        .describe("Maximum static call-site resolutions"),
      maxNodes: z
        .number()
        .int()
        .min(1)
        .max(20000)
        .default(5000)
        .describe("Maximum retained graph nodes"),
      maxEdges: z
        .number()
        .int()
        .min(1)
        .max(40000)
        .default(10000)
        .describe("Maximum retained graph edges"),
      offset: z
        .number()
        .int()
        .min(0)
        .default(0)
        .describe("First graph node index"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(5000)
        .default(1000)
        .describe("Maximum nodes on this page"),
      provider: providerSelectionOption,
    }),
    alias: {
      maxDepth: "max-depth",
      maxFunctions: "max-functions",
      maxCallSites: "max-call-sites",
      maxNodes: "max-nodes",
      maxEdges: "max-edges",
    },
    run: ({ args, options }) =>
      logCliCommand(logger, CLI_COMMANDS.traceNativeValues, () =>
        runDirectAnalysis(
          args.path,
          "trace_native_values",
          {
            procedure: args.procedure,
            max_depth: options.maxDepth,
            max_functions: options.maxFunctions,
            max_call_sites: options.maxCallSites,
            max_nodes: options.maxNodes,
            max_edges: options.maxEdges,
            offset: options.offset,
            limit: options.limit,
          },
          directAnalysisOptions(logger, undefined, options.provider),
        ),
      ),
  });
  cli.command(CLI_COMMANDS.inspectNativeDataType, {
    description: "Inspect one recovered database type or typed data object",
    args: z.object({
      path: z.string().describe("Local native executable or app path"),
    }),
    options: z.object({
      type: z.string().optional().describe("Exact database type category path"),
      address: z.string().describe("Exact native address").optional(),
      provider: providerSelectionOption,
    }),
    run: ({ args, options }) =>
      logCliCommand(logger, CLI_COMMANDS.inspectNativeDataType, () =>
        runDirectAnalysis(
          args.path,
          "inspect_native_data_type",
          {
            ...(options.type === undefined ? {} : { type: options.type }),
            ...(options.address === undefined
              ? {}
              : { address: options.address }),
          },
          directAnalysisOptions(logger, undefined, options.provider),
        ),
      ),
  });
  for (const [command, operation] of [
    [CLI_COMMANDS.inspectNativeInstruction, "inspect_native_instruction"],
    [CLI_COMMANDS.resolveNativeCallTargets, "resolve_native_call_targets"],
  ] as const) {
    cli.command(command, {
      description:
        operation === "inspect_native_instruction"
          ? "Inspect one native instruction with decoded operand facts"
          : "Resolve one static native call site",
      args: z.object({
        path: z.string().describe("Local native executable or app path"),
        address: z.string().describe("Exact native address"),
      }),
      options: z.object({ provider: providerSelectionOption }),
      run: ({ args, options }) =>
        logCliCommand(logger, command, () =>
          runDirectAnalysis(
            args.path,
            operation,
            { address: args.address },
            directAnalysisOptions(logger, undefined, options.provider),
          ),
        ),
    });
  }
  registerFunctionCommand(cli, logger);
  registerNativeApiCommand(cli, logger);
  registerInstructionsCommand(cli, logger);
  registerSearchCommand(cli, logger);
  registerXrefsCommand(cli, logger);
  registerTraceCommand(cli, logger);
  registerNativeUiActionCommand(cli, logger);
  registerNativeDispatchMetadataCommand(cli, logger);
};

const registerNativeDispatchMetadataCommand = (
  cli: CliInstance,
  logger: Logger,
): void => {
  cli.command(CLI_COMMANDS.inspectNativeDispatchMetadata, {
    description: "Inspect typed Objective-C and Swift dispatch metadata",
    args: z.object({
      path: z.string().describe("Target path used to bind the result evidence"),
    }),
    options: z.object({
      maxRecords: z
        .number()
        .int()
        .min(1)
        .max(20_000)
        .default(5_000)
        .describe("Maximum symbol records to inspect"),
      snapshot: z
        .string()
        .min(1)
        .optional()
        .describe("Load or update the local analysis snapshot"),
      provider: providerSelectionOption,
    }),
    alias: { maxRecords: "max-records" },
    run: async ({ args, options }) =>
      logCliCommand(logger, "inspect-native-dispatch-metadata", () =>
        runDirectAnalysis(
          args.path,
          "inspect_native_dispatch_metadata",
          { max_records: options.maxRecords },
          directAnalysisOptions(logger, options.snapshot, options.provider),
        ),
      ),
  });
};

const registerNativeUiActionCommand = (
  cli: CliInstance,
  logger: Logger,
): void => {
  cli.command(CLI_COMMANDS.traceNativeUiAction, {
    description:
      "Trace a compiled UI action selector to its native handler and direct callees",
    args: z.object({
      path: z.string().describe("Target path used to bind the result evidence"),
      action: z
        .string()
        .min(1)
        .describe(
          "A unique compiled UI action selector or interface object ID",
        ),
    }),
    options: z.object({
      maxDepth: z
        .number()
        .int()
        .min(0)
        .max(32)
        .default(8)
        .describe("Maximum relationship depth"),
      maxNodes: z
        .number()
        .int()
        .min(1)
        .max(2_000)
        .default(250)
        .describe("Maximum returned graph nodes"),
      maxEdges: z
        .number()
        .int()
        .min(1)
        .max(5_000)
        .default(500)
        .describe("Maximum returned graph edges"),
      provider: providerSelectionOption,
    }),
    alias: {
      maxDepth: "max-depth",
      maxNodes: "max-nodes",
      maxEdges: "max-edges",
    },
    run: async ({ args, options }) =>
      logCliCommand(logger, "trace-native-ui-action", () =>
        runDirectAnalysis(
          args.path,
          "trace_native_ui_action",
          {
            action: args.action,
            max_depth: options.maxDepth,
            max_nodes: options.maxNodes,
            max_edges: options.maxEdges,
          },
          directAnalysisOptions(logger, undefined, options.provider),
        ),
      ),
  });
};

const registerCoreCommands = (cli: CliInstance, logger: Logger): void => {
  const overviewOptions = z.object({
    snapshot: z
      .string()
      .min(1)
      .optional()
      .describe("Load and update a local analysis snapshot"),
    provider: providerSelectionOption,
  });
  cli.command(CLI_COMMANDS.analyze, {
    description: "Get an overview of an app",
    args: z.object({
      path: z.string().describe("App, program, or analysis database path"),
    }),
    options: overviewOptions,
    run: ({ args, options }) =>
      logCliCommand(logger, "analyze", () =>
        runRoutedOverview(args.path, options, logger),
      ),
  });
  cli.command(CLI_COMMANDS.inspect, {
    description: "Inspect an app overview with evidence",
    args: z.object({
      path: z.string().describe("App, program, or analysis database path"),
    }),
    options: overviewOptions,
    run: ({ args, options }) =>
      logCliCommand(logger, "inspect", () =>
        runDirectAnalysis(
          args.path,
          "binary_overview",
          {},
          directAnalysisOptions(logger, options.snapshot, options.provider),
        ),
      ),
  });
  cli.command(CLI_COMMANDS.decompile, {
    description: "Read one part of an app as code",
    args: z.object({
      path: z.string().describe("App or program path"),
      address: z.string().describe("Procedure address"),
    }),
    options: z.object({
      snapshot: z
        .string()
        .min(1)
        .optional()
        .describe("Load and update a local analysis snapshot"),
      provider: providerSelectionOption,
    }),
    run: ({ args, options }) =>
      logCliCommand(logger, "decompile", () =>
        runDirectAnalysis(
          args.path,
          "procedure_pseudo_code",
          { procedure: args.address },
          directAnalysisOptions(logger, options.snapshot, options.provider),
        ),
      ),
  });
};

const runRoutedOverview = async (
  path: string,
  options: {
    readonly snapshot?: string | undefined;
    readonly p
```

### Core Architecture Module: `src/cli/utilityCommands.ts`
```
import { z } from "incur";
import { jsonValueSchema } from "../domain/jsonValue.js";

import {
  runCapabilityStatus,
  runProviderAnalysis,
  runProviderStatus,
} from "../application/DirectAnalysis.js";
import { importReferenceSource } from "../application/ReferenceSourceImport.js";
import { projectReferenceSourceImportError } from "../application/ReferenceSourceImportTypes.js";
import { parseConfig } from "../config.js";
import { projectAnalysisError } from "../domain/analysisErrorProjection.js";
import { PRODUCT_IDENTITY } from "../identity.js";
import { logCliCommand } from "../cliLogging.js";
import { CLI_COMMANDS } from "../cliCommandNames.js";
import type { Logger } from "../logger.js";
import type { CliInstance } from "./types.js";

export const registerUtilityCommands = (
  cli: CliInstance,
  logger: Logger,
  environment: Readonly<Record<string, string | undefined>> = process.env,
): void => {
  registerCapabilityCommands(cli, logger);
  registerNativeCommands(cli, logger);
  for (const [command, operation] of [
    [CLI_COMMANDS.observeNativeUi, "observe_native_ui"],
    [CLI_COMMANDS.captureNativeUiScenario, "capture_native_ui_scenario"],
  ] as const) {
    cli.command(command, {
      description:
        "Observe or run a scenario in one exact native application window",
      args: z.object({
        path: z.string().describe("Local native executable or app path"),
      }),
      options: z.object({
        pid: z.number().int().positive().describe("Existing application PID"),
        windowId: z
          .number()
          .int()
          .positive()
          .describe("Exact selected application window ID"),
        steps: z
          .string()
          .optional()
          .describe("JSON array of declarative AX actions or waits"),
        screenshot: z
          .boolean()
          .default(true)
          .describe("Capture only the selected window"),
        accessibility: z
          .boolean()
          .default(true)
          .describe("Read the selected window accessibility tree"),
        maxNodes: z
          .number()
          .int()
          .positive()
          .safe()
          .default(500)
          .describe("Maximum accessibility nodes per capture"),
      }),
      alias: {
        windowId: "window-id",
        maxNodes: "max-nodes",
      },
      run: ({ args, options }) =>
        logCliCommand(logger, command, () =>
          runProviderAnalysis(
            args.path,
            operation,
            {
              pid: options.pid,
              window_id: options.windowId,
              screenshot: options.screenshot,
              accessibility: options.accessibility,
              max_nodes: options.maxNodes,
              ...(operation === "capture_native_ui_scenario"
                ? {
                    steps:
                      options.steps === undefined
                        ? []
                        : jsonValueSchema.parse(JSON.parse(options.steps)),
                  }
                : {}),
            },
            logger,
          ),
        ),
    });
  }
  registerReferenceSourceCommand(cli, logger, environment);
};

const registerCapabilityCommands = (cli: CliInstance, logger: Logger): void => {
  for (const command of [
    CLI_COMMANDS.capabilities,
    CLI_COMMANDS.providers,
  ] as const) {
    cli.command(command, {
      description:
        command === "capabilities"
          ? "List provider capabilities and side effects"
          : "List configured analysis providers",
      run: () =>
        logCliCommand(logger, command, () =>
          command === CLI_COMMANDS.providers
            ? runProviderStatus(logger)
            : runCapabilityStatus(logger),
        ),
    });
  }
};

const registerNativeCommands = (cli: CliInstance, logger: Logger): void => {
  for (const [command, tool] of [
    [CLI_COMMANDS.inspectMacho, "inspect_macho"],
    [CLI_COMMANDS.inspectSignature, "inspect_signature"],
    [CLI_COMMANDS.listArchitectures, "list_architectures"],
  ] as const) {
    cli.command(command, {
      description: `Run ${tool} without launching Hopper`,
      args: z.object({ path: z.string().describe("Mach-O or app path") }),
      run: ({ args }) =>
        logCliCommand(logger, command, () =>
          runProviderAnalysis(args.path, tool, {}, logger),
        ),
    });
  }
  cli.command(CLI_COMMANDS.inspectPlist, {
    description: "Parse app plist metadata without launching Hopper",
    args: z.object({ path: z.string().describe("App or Mach-O path") }),
    options: z.object({
      relativePath: z
        .string()
        .default("Contents/Info.plist")
        .describe("Plist path relative to the app root"),
    }),
    alias: { relativePath: "relative-path" },
    run: ({ args, options }) =>
      logCliCommand(logger, "inspect-plist", () =>
        runProviderAnalysis(
          args.path,
          "inspect_plist",
          { relative_path: options.relativePath },
          logger,
        ),
      ),
  });
  cli.command(CLI_COMMANDS.demangleSwift, {
    description: "Demangle Swift symbols without Hopper",
    args: z.object({
      path: z.string().describe("Artifact path used for evidence identity"),
      symbols: z
        .array(z.string().min(1))
        .min(1)
        .describe("Swift mangled symbols to demangle"),
    }),
    run: ({ args }) =>
      logCliCommand(logger, "demangle-swift", () =>
        runProviderAnalysis(
          args.path,
          "demangle_swift",
          { symbols: args.symbols },
          logger,
        ),
      ),
  });
};

const registerReferenceSourceCommand = (
  cli: CliInstance,
  logger: Logger,
  environment: Readonly<Record<string, string | undefined>> = process.env,
): void => {
  cli.command(CLI_COMMANDS.importReferenceSource, {
    description: "Import a source tree as historical reference only",
    args: z.object({
      root: z
        .string()
        .describe("Local source directory to import as historical reference"),
    }),
    run: ({ args }) =>
      logCliCommand(logger, "import-reference-source", async () => {
        const config = parseConfig(environment);
        if (!config.ok)
          return {
            error: "Import failed",
            ...projectAnalysisError(config.error),
          };
        const imported = await importReferenceSource({
          root: args.root,
          caller: "rea-cli",
          policy: config.value.referenceSourcePolicy,
          importer: PRODUCT_IDENTITY.packageName,
          importerVersion: null,
        });
        return imported.ok
          ? imported.value
          : {
              error: "Import failed",
              ...projectReferenceSourceImportError(imported.error),
            };
      }),
  });
};

```

### Core Architecture Module: `src/contracts/sessionLifecycleInputs.ts`
```
import { z } from "zod";
import { analysisProviderSelectorSchema } from "./providerSelection.js";

/** Input contract for opening a target with an optional staged snapshot. */
export const openBinaryInputSchema = z.object({
  path: z.string().min(1),
  provider_id: analysisProviderSelectorSchema.optional(),
  snapshot_path: z.string().min(1).optional(),
});

/** Input contract for closing a target after an optional atomic snapshot. */
export const closeBinaryInputSchema = z.object({
  snapshot_path: z.string().min(1).optional(),
  overwrite: z.boolean().default(false),
});

```

### Core Architecture Module: `src/domain/analysisErrorCore.ts`
```
import type { JsonValue } from "./jsonValue.js";
import { AnalysisError } from "./analysisErrorBase.js";

/** Provider-neutral invalid analysis input or output at an application boundary. */
export class AnalysisProtocolError extends AnalysisError {
  readonly _tag = "AnalysisProtocolError";
}

/** Caller input failed provider-neutral application parsing. */
export class AnalysisInputError extends AnalysisError {
  readonly _tag = "AnalysisInputError";

  constructor(
    readonly operation: string,
    options?: ErrorOptions,
    readonly issues: readonly AnalysisInputIssue[] = [],
  ) {
    super(`Invalid analysis input for ${operation}`, options);
  }
}

/** Secret-safe correction metadata for one rejected caller argument. */
export interface AnalysisInputIssue {
  readonly path: readonly (string | number)[];
  readonly reason:
    | "unknown_argument"
    | "missing_argument"
    | "invalid_type"
    | "out_of_range"
    | "invalid_value"
    | "invalid_format";
  /** Schema-authored correction guidance for cross-field or custom checks. */
  readonly message?: string;
  readonly expected?: JsonValue;
  readonly minimum?: number;
  readonly maximum?: number;
}

/** Provider output failed provider-neutral application parsing. */
export class AnalysisOutputError extends AnalysisError {
  readonly _tag = "AnalysisOutputError";

  constructor(
    readonly operation: string,
    readonly reason: string,
    options?: ErrorOptions,
  ) {
    super(`Invalid analysis output for ${operation}: ${reason}`, options);
  }
}

/** Selected provider cannot execute a declared analysis operation. */
export class AnalysisCapabilityUnavailableError extends AnalysisError {
  readonly _tag = "AnalysisCapabilityUnavailableError";

  constructor(
    readonly providerId: string,
    readonly operation: string,
    readonly reason: string,
  ) {
    super(`Provider ${providerId} cannot execute ${operation}: ${reason}`);
  }
}

/** Caller cancellation won before provider-neutral work completed. */
export class AnalysisCancelledError extends AnalysisError {
  readonly _tag = "AnalysisCancelledError";

  constructor(readonly operation: string) {
    super(`Analysis operation was cancelled: ${operation}`);
  }
}

/** Provider-neutral operation exceeded its declared execution deadline. */
export class AnalysisTimeoutError extends AnalysisError {
  readonly _tag = "AnalysisTimeoutError";

  constructor(
    readonly operation: string,
    readonly timeoutMs: number,
  ) {
    super(
      `Analysis operation timed out after ${String(timeoutMs)}ms: ${operation}`,
    );
  }
}

```

### Core Architecture Module: `src/domain/javascriptRuntimeLoadState.ts`
```
import { type ApplicationNode } from "./javascriptApplicationGraph.js";
import { uniqueSorted } from "./canonicalOrdering.js";
import type { ParsedStaticLayer } from "./javascriptRuntimeReconciliationParsing.js";
import type {
  JavaScriptRuntimeReconciliationItem,
  JavaScriptStaticLoadState,
} from "./javascriptRuntimeReconciliationSchemas.js";
import type { RuntimeReconciliationEntity } from "./javascriptRuntimeReconciliationRuntime.js";
import {
  createStaticRuntimeScope,
  mappedRuntimePaths,
  staticNodeWithinRuntimeScope,
} from "./javascriptRuntimeStaticCandidates.js";

export interface StaticLoadStateProjection {
  readonly states: readonly JavaScriptStaticLoadState[];
  readonly omittedStates: number;
}

/** Classify static code presence without claiming bundled module execution. */
export const classifyStaticLoadStates = (
  layers: readonly ParsedStaticLayer[],
  runtimeEntities: readonly RuntimeReconciliationEntity[],
  matches: readonly JavaScriptRuntimeReconciliationItem[],
  options: {
    readonly reconciliationComplete: boolean;
  },
): StaticLoadStateProjection => {
  const states: JavaScriptStaticLoadState[] = [];
  for (const layer of layers) {
    const projection = classifyLayer(layer, runtimeEntities, matches, {
      reconciliationComplete: options.reconciliationComplete,
    });
    states.push(...projection.states);
  }
  return { states, omittedStates: 0 };
};

const classifyLayer = (
  layer: ParsedStaticLayer,
  runtimeEntities: readonly RuntimeReconciliationEntity[],
  matches: readonly JavaScriptRuntimeReconciliationItem[],
  options: {
    readonly reconciliationComplete: boolean;
  },
): { readonly states: JavaScriptStaticLoadState[] } => {
  const nodes = layer.graph.nodes.filter(isLoadStateNode);
  const direct = new Map<string, string[]>();
  for (const match of matches)
    if (
      match.status === "matched" &&
      match.static_layer_id === layer.layerId &&
      match.static_node_id !== null
    )
      append(direct, match.static_node_id, match.runtime_node_id);
  const resident = residentNodes(layer, new Set(direct.keys()));
  const runtimeScope = createStaticRuntimeScope(layer, runtimeEntities);
  const scopedEntities = runtimeEntities.filter(
    (entity) => mappedRuntimePaths(layer, entity).length > 0,
  );
  const layerComplete =
    options.reconciliationComplete &&
    layer.graph.coverage.status === "complete" &&
    scopedEntities.length > 0 &&
    scopedEntities.every(({ capture }) =>
      captureScriptsComplete(capture.evidence.evidence_id, runtimeEntities),
    );
  const states = nodes.map((node) => {
    const runtimeNodeIds = uniqueSorted(direct.get(node.node_id) ?? []);
    if (runtimeNodeIds.length > 0)
      return state(layer, node, {
        status: "loaded",
        runtimeNodeIds,
        reason: "runtime-script-correspondence",
      });
    if (resident.has(node.node_id))
      return state(layer, node, {
        status: "resident-in-loaded-asset",
        runtimeNodeIds: [],
        reason: "containing-asset-was-loaded",
      });
    const nodeWithinScope = staticNodeWithinRuntimeScope(node, runtimeScope);
    if (layerComplete && nodeWithinScope)
      return state(layer, node, {
        status: "not-observed-in-capture",
        runtimeNodeIds: [],
        reason: "not-observed-in-bounded-capture",
      });
    return state(layer, node, {
      status: "unknown",
      runtimeNodeIds: [],
      reason: !nodeWithinScope
        ? "layer-outside-runtime-scope"
        : "static-or-runtime-coverage-incomplete",
    });
  });
  return { states };
};

const residentNodes = (
  layer: ParsedStaticLayer,
  directlyLoaded: ReadonlySet<string>,
): ReadonlySet<string> => {
  const nodeKinds = new Map(
    layer.graph.nodes.map(({ node_id: id, kind }) => [id, kind]),
  );
  const children = new Map<string, string[]>();
  for (const edge of layer.graph.edges)
    if (edge.relation === "contains")
      append(children, edge.source_node_id, edge.target_node_id);
  const pending = [...directlyLoaded].filter(
    (nodeId) => nodeKinds.get(nodeId) === "javascript-asset",
  );
  const resident = new Set<string>();
  for (let index = 0; index < pending.length; index += 1) {
    const current = pending[index];
    if (current === undefined) break;
    for (const child of children.get(current) ?? []) {
      if (resident.has(child)) continue;
      resident.add(child);
      pending.push(child);
    }
  }
  return resident;
};

const append = (
  values: Map<string, string[]>,
  key: string,
  value: string,
): void => {
  const current = values.get(key);
  if (current === undefined) values.set(key, [value]);
  else current.push(value);
};

const captureScriptsComplete = (
  evidenceId: string,
  entities: readonly RuntimeReconciliationEntity[],
): boolean =>
  entities.find(({ capture }) => capture.evidence.evidence_id === evidenceId)
    ?.capture.scriptsCompleteWithinScope === true;

const isLoadStateNode = (
  node: ApplicationNode,
): node is ApplicationNode & {
  readonly kind: "javascript-asset" | "javascript-chunk" | "javascript-module";
} =>
  node.kind === "javascript-asset" ||
  node.kind === "javascript-chunk" ||
  node.kind === "javascript-module";

const state = (
  layer: ParsedStaticLayer,
  node: ApplicationNode & {
    readonly kind:
      | "javascript-asset"
      | "javascript-chunk"
      | "javascript-module";
  },
  input: {
    readonly status: JavaScriptStaticLoadState["status"];
    readonly runtimeNodeIds: readonly string[];
    readonly reason: JavaScriptStaticLoadState["reason"];
  },
): JavaScriptStaticLoadState => ({
  static_layer_id: layer.layerId,
  static_node_id: node.node_id,
  kind: node.kind,
  status: input.status,
  runtime_node_ids: [...input.runtimeNodeIds],
  reason: input.reason,
});

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #441** (2026-07-26): **[Bug] MCP cold start exhausts Codex startup deadline**
  *Symptoms*: ## Bug Description  REA's MCP process can exhaust the 30-second Codex startup deadline that `rea setup` configures. On a cold launch, importing the production entrypoint consumed about 20 seconds before the server could answer MCP `initialize`; modest client startup contention is therefore enough for Codex to report:  ```text MCP client for `rea` timed out after 30 seconds. MCP startup incomplete (failed: rea) ```  This is also a package-validation gap. The current runtime and package smoke tests exercise MCP connectivity after build, doctor, or other repository activity has warmed the same module graph, and they do not assert a cold time-to-initialize budget.  ## Steps to Reproduce  1. Configure Codex with the value generated by REA:     ```toml    [mcp_servers.rea]    command = "/absolute/path/to/rea/scripts/rea.mjs"    args = ["mcp"]    startup_timeout_sec = 30    ```  2. Start Codex in an environment where REA's compiled runtime and dependencies are not already in the filesystem cache. 3. Observe that Codex can time out while starting the `rea` MCP server.  The following diagnostics were also run against the same checkout:  ```bash /usr/bin/time -f 'elapsed=%e maxrss=%M' \   node -e 'await import("/root/rea/dist/main.js")' ```  First observed run:  ```text elapsed=20.09 maxrss=345404 ```  An MCP SDK probe launching `scripts/rea.mjs mcp` observed:  ```json {"connected_ms":21027} {"listed_ms":21902,"tools":39} ```  A subsequent warm import completed in 2.72 seconds, confirm

- **Issue #439** (2026-07-26): **[Bug] Bare npx setup can again select a stale local REA release**
  *Symptoms*: ## Bug Description  REA's recommended setup command, `npx rea-agents setup`, can select an older project-local `rea-agents` dependency instead of the current npm release. The stale bootstrap then plans setup and version-pinned MCP registration using its own older product identity.  This behavior was previously reported in #291 and fixed by #292, which made `rea-agents@latest` canonical. PR #307 later restored the bare `npx rea-agents setup` entrypoint and the current `main` README recommends that form in the primary setup paths.  The persisted MCP launcher itself remains exact-version pinned. The regression is in selecting the package that runs setup and chooses that pinned version.  ## Steps to Reproduce  On Linux with Node.js 24.18.0 and npm 11.16.0:  ```sh repro=$(mktemp -d) mkdir -p "$repro/project/subdir" "$repro/home-old/.codex" "$repro/home-new/.codex" npm install --prefix "$repro/project" --no-save rea-agents@2.4.0 cd "$repro/project/subdir"  npx -y rea-agents --version npx -y rea-agents@latest --version  HOME="$repro/home-old" \   npx -y rea-agents setup \   --client codex --skill=false --dry-run --json >"$repro/old-plan.json"  HOME="$repro/home-new" \   npx -y rea-agents@latest setup \   --client codex --skill=false --dry-run --json >"$repro/new-plan.json" ```  Observed on 2026-07-26, when npm `latest` was 2.5.0:  ```text $ npx -y rea-agents --version 2.4.0  $ npx -y rea-agents@latest --version 2.5.0 ```  The dry-run diagnostic reports also diverged:  ```text old-pl

- **Issue #399** (2026-07-22): **Agent integration capability selection is unclear and can silently drop the bundled skill**
  *Symptoms*: ## Problem  The **"Agent integration (MCP + guided workflow)"** capability bundles MCP client configuration and the REA reverse-engineering skill. However, the UI flow for selecting which agents to configure is unclear, and selecting the capability without selecting any agents can silently omit the skill installation.  ## Observed behavior  1. The capability label says **"MCP + guided workflow"** but the second prompt **"Which agents should use REA?"** appears only after the capability is selected, with no explanation that the skill install depends on selecting agents. 2. In `selectSetupActions` (`src/cliSetup.ts`, lines 150-166), when `agentIntegrationCapabilityId` is selected but no clients are selected (`selectedClients.length === 0`), the function returns `selectedActionIds` without including `bundledSkillAction`. So a user who selects "Agent integration" but toggles off every detected agent gets neither client configs nor the guided-workflow skill. 3. The agent option hints show implementation details (`create · /Users/.../.codex/config.toml`) rather than something helpful about what each agent is.  ## Expected behavior  - If **"Agent integration"** is selected, the skill should always be included, because the guided workflow is part of the bundle. The only exception should be an explicit opt-out such as `--skill=false`. - The agent picker should make clear that at least one agent must be selected for the integration to be useful, or default to selecting all detected age

- **Issue #291** (2026-07-17): **[Bug] npm entry points can select stale local REA versions and leave install scripts blocked**
  *Symptoms*: ## Bug Description  REA's no-install commands and npx-generated MCP registrations use the unversioned package specifier `rea-agents`. When a project already contains an older local dependency, npm selects that local version instead of the current release.  A bare `npm install rea-agents` also installs `rea` only in the project's `node_modules/.bin`, so running `rea` directly still reports `command not found`. The documentation clearly distinguishes npx from global installation, but it does not explicitly warn about this local-install behavior.  npm 11 additionally leaves two lifecycle scripts pending approval during installation: REA's `postinstall` and `node-pty`'s install scripts. Removing only REA's chmod hook would therefore not fully remove the warning.  ## Steps to Reproduce  Run with a current npm release in a temporary project:  ```bash npm init -y npm install rea-agents@1.7.0 --no-audit --no-fund command -v rea npx -y rea-agents --version npx -y rea-agents@latest --version ```  Observed on Node.js 24.18.0 and npm 11.16.0:  ```text npm warn allow-scripts 2 packages have install scripts not yet covered by allowScripts: npm warn allow-scripts   rea-agents@1.7.0 (postinstall: node scripts/prepare-node-pty.mjs) npm warn allow-scripts   node-pty@1.1.0 (install: node scripts/prebuild.js || node-gyp rebuild; postinstall: node scripts/post-install.js)  command -v rea:             no result npx -y rea-agents:          1.7.0 npx -y rea-agents@latest:   2.0.0 ```  Registry metad

- **Issue #244** (2026-07-15): **fix(cli): make clean source checkouts start reliably**
  *Symptoms*: ## Description  A clean source checkout could persist MCP registrations to `scripts/rea.mjs` while its required, gitignored `dist/` runtime was absent. `npm ci` installed dependencies but did not build that runtime, and both CLI and MCP startup failed with a raw `ERR_MODULE_NOT_FOUND` stack.  This change:  - builds the compiled runtime in npm's documented [`prepare` lifecycle](https://docs.npmjs.com/cli/using-npm/scripts/#life-cycle-scripts), which covers clean source installs and package preparation; - removes the duplicate `prepack` build now owned by `prepare`; - routes `npm start` through the canonical dispatcher; - checks the route-specific compiled entrypoints before importing them and prints exact recovery for a source checkout or damaged installation; - documents the clean-checkout lifecycle and adds regressions for CLI and MCP startup.  The launcher does not build at runtime. If generated output is removed after preparation, it reports the checkout path and asks the user to run `npm ci` or reinstall the package instead of mutating the checkout during startup.  The related startup audit found no other public `dist/` consumer without an explicit build prerequisite. Real Hopper/browser verifiers and the package verifier already build before importing generated modules.  ## Type of Change  - [x] Bug fix - [ ] New feature - [x] Documentation update - [ ] Performance improvement - [ ] Refactoring (no functional change) - [ ] Tool contract change (MCP schema modification)  
  **Post-Mortem & Fix Analysis**:
  > You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).

- **Issue #243** (2026-07-15): **Source-checkout MCP registrations break when build artifacts are absent**
  *Symptoms*: ## Bug Description  Running setup from a source checkout can persist MCP registrations that point to `scripts/rea.mjs`, even though that launcher requires generated files under the gitignored `dist/` directory. A fresh or cleaned checkout leaves those registrations unable to start REA.  The registration health check compares only the configured command path and arguments, so it reports the local command as `aligned` when `dist/main.js` and `dist/cli.js` are absent. Because the same launcher is also needed to run `rea doctor`, the failure presents as a raw Node `MODULE_NOT_FOUND` error instead of a REA diagnostic.  The registry package is not affected: `rea-agents@1.6.0` contains `dist/main.js`, `dist/cli.js`, and `scripts/rea.mjs`, and its CLI starts successfully.  ## Steps to Reproduce  1. Start from a clean source checkout with no `node_modules/` or `dist/`. 2. Run `npm ci`. 3. Confirm that `dist/` is still absent; the `prepare` lifecycle runs `husky`, not the build. 4. Run `npm start` or `node scripts/rea.mjs --help`. 5. For the persistent form of the bug, build the checkout, run setup so clients are registered to the absolute `scripts/rea.mjs` path, then remove the ignored build output or recreate the checkout at the same path.  ## Expected Behavior  Source-checkout setup should not report a client registration as ready/aligned unless its persisted command is runnable. A clean or rebuilt source checkout should either preserve a runnable registration or provide an actionab

- **Issue #192** (2026-07-14): **fix(application): avoid requiring snapshot write permission for direct analysis cache hits**
  *Symptoms*: ### Problem `runDirectAnalysis` requests both `snapshot_read` and `snapshot_write` authorization whenever `snapshotPath` is provided, even when the command can be fully satisfied from an existing snapshot cache.  In `authorizeAnalysis()` (`src/application/DirectAnalysis.ts`), snapshot capabilities are added unconditionally before checking whether the requested query is replayable:  - It always requests `snapshot_read` and `snapshot_write` for `snapshotPath` with `write` access. - `prepareSnapshot()` may return cached `evidence` and `runAnalysis()` returns it without opening Hopper or modifying the snapshot.  This blocks read-only snapshot use-cases: a policy that permits cache reads but not snapshot writes cannot execute cached replay even though no write would occur.  ### Repro steps 1. Create a valid snapshot for a binary with at least one query result. 2. Run a direct tool command (for example `rea analyze`) with `--snapshot` against that cache while permission policy includes `snapshot_read` for the file but no `snapshot_write`. 3. Observe permission preflight failure on `snapshot_write` even when cached evidence exists.  ### Expected - If `prepareSnapshot()` has a replayable hit, authorization should only require `snapshot_read` (unless the operation actually needs to persist new evidence).  ### Observed - Permission preflight always requests `snapshot_write`, forcing operators to grant a broader path authority than needed for replay.  ### Impact - Unnecessary permission

- **Issue #189** (2026-07-14): **fix(application): traverse bounded JSON values correctly in readBoundedJson**
  *Symptoms*: ## Problem `readBoundedJson` enforces `EvidenceFilePolicy` limits through `validateJsonLimits` before returning JSON data. Inside the object traversal loop, the code pushes the current object back into the stack instead of each child value.  ## Evidence - File: `src/application/BoundedJsonFiles.ts` - In `validateJsonLimits`, the loop is currently:  ```ts for (const [key, value] of Object.entries(current.value)) {   if (key.length > policy.maxStringLength) return false;   pending.push({ value: current.value, depth: current.depth + 1 }); } ```  It should push `value`, not `current.value`.  ## Impact - Nested objects/arrays are effectively never descended into as intended. - Bounded JSON checks can trip `maxNodes`/`maxDepth` incorrectly due to re-queueing the same parent object. - Valid bounded payloads can be rejected as too large or malformed for policy enforcement.  ## Suggested fix In `src/application/BoundedJsonFiles.ts`, replace:  ```ts pending.push({ value: current.value, depth: current.depth + 1 }); ```  with  ```ts pending.push({ value, depth: current.depth + 1 }); ```  Add/adjust regression tests for nested JSON traversal under policy limits. 
  **Post-Mortem & Fix Analysis**:
  > Triage on current `main` (`6a3fd5b`): this report is not reproducible. `validateJsonLimits` has pushed the child `value` (not `current.value`) since its introduction in `c439b9e`. The nested/depth evidence read coverage passes in the full suite. The related deduplication work in #193 will preserve this behavior with shared regression coverage, but there is no #189 bug to fix.

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

### Incident Patch 1: `433ebda8` (2026-10-06)
**Commit Message**: Merge pull request #682 from kaoru0822-kitauji/fix/disable-unmanaged-skill-sync

fix(cli): disable unmanaged skill synchronization

**File**: `package-lock.json` (modified, +23/-11)
```diff
@@ -24,7 +24,7 @@
         "cross-spawn": "7.0.6",
         "diff": "9.0.0",
         "ignore": "7.0.6",
-        "incur": "0.4.13",
+        "incur": "0.6.1",
         "isomorphic-git": "1.38.7",
         "jsonc-parser": "3.3.1",
         "pino": "10.4.0",
@@ -2054,9 +2054,9 @@
       }
     },
     "node_modules/@toon-format/toon": {
-      "version": "2.3.0",
-      "resolved": "https://registry.npmjs.org/@toon-format/toon/-/toon-2.3.0.tgz",
-      "integrity": "sha512-/Ew9etdRQKVMnm9fDaCG0JjyAOK/O7T0M97oum1aW4W+UR8ZhVVPBanIV7oWgHBiGlnVxV9M55PWQCHofDV07w==",
+      "version": "2.3.1",
+      "resolved": "https://registry.npmjs.org/@toon-format/toon/-/toon-2.3.1.tgz",
+      "integrity": "sha512-sWqEMeAJGMda9qRrfPKrX3C4c33CO9SJuvJzzrcBEn5sbDB+k6pSLkDsfN0rVnLQwR97MV3sDgVbcxQNsq8xVw==",
       "license": "MIT"
     },
     "node_modules/@turbo/darwin-64": {
@@ -3581,27 +3581,39 @@
       }
     },
     "node_modules/incur": {
-      "version": "0.4.13",
-      "resolved": "https://registry.npmjs.org/incur/-/incur-0.4.13.tgz",
-      "integrity": "sha512-BeKlYFLIsRCgC8IxsUd3S2/4kPeZaNf1Rbz+Kz41jQII4jOgr7j5w4KYe00aAEQa3V0Ur57BVxE5JDTx8L2s5Q==",
+      "version": "0.6.1",
+      "resolved": "https://registry.npmjs.org/incur/-/incur-0.6.1.tgz",
+      "integrity": "sha512-QgaPKsKH+/3SLdUTSkCYwMWzL56vO3wn7iheEwKE0jOtWSa9Irzn8KeyhkRIkTzHW0ReiQwo0EtT8bBGR9PpMw==",
       "license": "MIT",
       "dependencies": {
         "@cfworker/json-schema": "^4.1.1",
-        "@modelcontextprotocol/server": "^2.0.0-alpha.2",
+        "@modelcontextprotocol/server": "2.0.0-alpha.4",
         "@scalar/openapi-types": "^0.8.0",
-        "@toon-format/toon": "^2.1.0",
+        "@toon-format/toon": "^2.3.1",
         "tokenx": "^1.3.0",
         "yaml": "^2.8.2",
         "zod": "^4.3.6"
       },
       "bin": {
-        "incur": "dist/bin.js",
-        "incur.src": "src/bin.ts"
+        "incur": "dist/cli/index.js",
+        "incur.src": "src/cli/index.ts"
       },
       "engines": {
         "node": ">=22"
       }
     },
+    "node_modules/incur/node_modules/@modelcontextprotocol/server": {
+      "version": "2.0.0-alpha.4",
+      "resolved": "https://registry.npmjs.org/@modelcontextprotocol/server/-/server-2.0.0-alpha.4.tgz",
+      "integrity": "sha512-/KEo3ZJ50HlagHp0lz2vPgfBZFtXHu6zTBXT9XqPc+4O9i4+IbBVWKq/a9yAfv/ifp0u3+mRo8SUk5kMKzhN8A==",
+      "license": "MIT",
+      "dependencies": {
+        "zod": "^4.2.0"
+      },
+      "engines": {
+        "node": ">=20"
+      }
+    },
     "node_modules/inherits": {
       "version": "2.0.4",
       "resolved": "https://registry.npmjs.org/inherits/-/inherits-2.0.4.tgz",
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -179,7 +179,7 @@
     "cross-spawn": "7.0.6",
     "diff": "9.0.0",
     "ignore": "7.0.6",
-    "incur": "0.4.13",
+    "incur": "0.6.1",
     "isomorphic-git": "1.38.7",
     "jsonc-parser": "3.3.1",
     "pino": "10.4.0",
```

**File**: `src/cli.ts` (modified, +1/-10)
```diff
@@ -1,5 +1,4 @@
 import { Cli } from "incur";
-import { fileURLToPath } from "node:url";
 
 import { createLogger, parseLogLevel } from "./logger.js";
 import { PRODUCT_IDENTITY } from "./identity.js";
@@ -40,15 +39,7 @@ export const createCli = (
       instructions:
         "Ask what software, artifact, protocol, or behavior the user wants to understand, then choose the available investigation capabilities that can produce evidence.",
     },
-    sync: {
-      cwd: fileURLToPath(new URL("..", import.meta.url)),
-      include: ["skills/*"],
-      suggestions: [
-        "understand how a software feature works",
-        "investigate an artifact or observed behavior",
-        "check my REA setup",
-      ],
-    },
+    sync: false,
   });
 
   registerSetupCommands(cli, logger);
```

**File**: `tests/boundary/cli/skillSync.test.ts` (added, +30/-0)
```diff
@@ -0,0 +1,30 @@
+import { readdir } from "node:fs/promises";
+
+import { describe, expect } from "vitest";
+
+import { workspaceCliTest } from "../../support/cli/workspaceCliFixture.js";
+
+const CLI_INTEGRATION_TIMEOUT_MS = 60_000;
+
+describe("CLI skill lifecycle boundary", () => {
+  workspaceCliTest(
+    "does not expose the unmanaged Incur skill generator",
+    async ({ cli, workspace }) => {
+      const help = await cli.run({
+        arguments: ["--help"],
+        environment: workspace.environment,
+      });
+      expect(help).toMatchObject({ exitCode: 0 });
+      expect(help.stdout).not.toMatch(/^\s+skills\b/mu);
+
+      const result = await cli.run({
+        arguments: ["skills", "add"],
+        environment: workspace.environment,
+      });
+      expect(result.exitCode).toBe(1);
+      expect(result.stdout).toContain("COMMAND_NOT_FOUND");
+      await expect(readdir(workspace.home)).resolves.toEqual([]);
+    },
+    CLI_INTEGRATION_TIMEOUT_MS,
+  );
+});
```

---

### Incident Patch 2: `2c1bf920` (2026-10-06)
**Commit Message**: fix(cli): disable unmanaged skill synchronization

**File**: `package-lock.json` (modified, +23/-11)
```diff
@@ -24,7 +24,7 @@
         "cross-spawn": "7.0.6",
         "diff": "9.0.0",
         "ignore": "7.0.6",
-        "incur": "0.4.13",
+        "incur": "0.6.1",
         "isomorphic-git": "1.38.7",
         "jsonc-parser": "3.3.1",
         "pino": "10.4.0",
@@ -2054,9 +2054,9 @@
       }
     },
     "node_modules/@toon-format/toon": {
-      "version": "2.3.0",
-      "resolved": "https://registry.npmjs.org/@toon-format/toon/-/toon-2.3.0.tgz",
-      "integrity": "sha512-/Ew9etdRQKVMnm9fDaCG0JjyAOK/O7T0M97oum1aW4W+UR8ZhVVPBanIV7oWgHBiGlnVxV9M55PWQCHofDV07w==",
+      "version": "2.3.1",
+      "resolved": "https://registry.npmjs.org/@toon-format/toon/-/toon-2.3.1.tgz",
+      "integrity": "sha512-sWqEMeAJGMda9qRrfPKrX3C4c33CO9SJuvJzzrcBEn5sbDB+k6pSLkDsfN0rVnLQwR97MV3sDgVbcxQNsq8xVw==",
       "license": "MIT"
     },
     "node_modules/@turbo/darwin-64": {
@@ -3581,27 +3581,39 @@
       }
     },
     "node_modules/incur": {
-      "version": "0.4.13",
-      "resolved": "https://registry.npmjs.org/incur/-/incur-0.4.13.tgz",
-      "integrity": "sha512-BeKlYFLIsRCgC8IxsUd3S2/4kPeZaNf1Rbz+Kz41jQII4jOgr7j5w4KYe00aAEQa3V0Ur57BVxE5JDTx8L2s5Q==",
+      "version": "0.6.1",
+      "resolved": "https://registry.npmjs.org/incur/-/incur-0.6.1.tgz",
+      "integrity": "sha512-QgaPKsKH+/3SLdUTSkCYwMWzL56vO3wn7iheEwKE0jOtWSa9Irzn8KeyhkRIkTzHW0ReiQwo0EtT8bBGR9PpMw==",
       "license": "MIT",
       "dependencies": {
         "@cfworker/json-schema": "^4.1.1",
-        "@modelcontextprotocol/server": "^2.0.0-alpha.2",
+        "@modelcontextprotocol/server": "2.0.0-alpha.4",
         "@scalar/openapi-types": "^0.8.0",
-        "@toon-format/toon": "^2.1.0",
+        "@toon-format/toon": "^2.3.1",
         "tokenx": "^1.3.0",
         "yaml": "^2.8.2",
         "zod": "^4.3.6"
       },
       "bin": {
-        "incur": "dist/bin.js",
-        "incur.src": "src/bin.ts"
+        "incur": "dist/cli/index.js",
+        "incur.src": "src/cli/index.ts"
       },
       "engines": {
         "node": ">=22"
       }
     },
+    "node_modules/incur/node_modules/@modelcontextprotocol/server": {
+      "version": "2.0.0-alpha.4",
+      "resolved": "https://registry.npmjs.org/@modelcontextprotocol/server/-/server-2.0.0-alpha.4.tgz",
+      "integrity": "sha512-/KEo3ZJ50HlagHp0lz2vPgfBZFtXHu6zTBXT9XqPc+4O9i4+IbBVWKq/a9yAfv/ifp0u3+mRo8SUk5kMKzhN8A==",
+      "license": "MIT",
+      "dependencies": {
+        "zod": "^4.2.0"
+      },
+      "engines": {
+        "node": ">=20"
+      }
+    },
     "node_modules/inherits": {
       "version": "2.0.4",
       "resolved": "https://registry.npmjs.org/inherits/-/inherits-2.0.4.tgz",
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -179,7 +179,7 @@
     "cross-spawn": "7.0.6",
     "diff": "9.0.0",
     "ignore": "7.0.6",
-    "incur": "0.4.13",
+    "incur": "0.6.1",
     "isomorphic-git": "1.38.7",
     "jsonc-parser": "3.3.1",
     "pino": "10.4.0",
```

**File**: `src/cli.ts` (modified, +1/-10)
```diff
@@ -1,5 +1,4 @@
 import { Cli } from "incur";
-import { fileURLToPath } from "node:url";
 
 import { createLogger, parseLogLevel } from "./logger.js";
 import { PRODUCT_IDENTITY } from "./identity.js";
@@ -40,15 +39,7 @@ export const createCli = (
       instructions:
         "Ask what software, artifact, protocol, or behavior the user wants to understand, then choose the available investigation capabilities that can produce evidence.",
     },
-    sync: {
-      cwd: fileURLToPath(new URL("..", import.meta.url)),
-      include: ["skills/*"],
-      suggestions: [
-        "understand how a software feature works",
-        "investigate an artifact or observed behavior",
-        "check my REA setup",
-      ],
-    },
+    sync: false,
   });
 
   registerSetupCommands(cli, logger);
```

**File**: `tests/boundary/cli/skillSync.test.ts` (added, +30/-0)
```diff
@@ -0,0 +1,30 @@
+import { readdir } from "node:fs/promises";
+
+import { describe, expect } from "vitest";
+
+import { workspaceCliTest } from "../../support/cli/workspaceCliFixture.js";
+
+const CLI_INTEGRATION_TIMEOUT_MS = 60_000;
+
+describe("CLI skill lifecycle boundary", () => {
+  workspaceCliTest(
+    "does not expose the unmanaged Incur skill generator",
+    async ({ cli, workspace }) => {
+      const help = await cli.run({
+        arguments: ["--help"],
+        environment: workspace.environment,
+      });
+      expect(help).toMatchObject({ exitCode: 0 });
+      expect(help.stdout).not.toMatch(/^\s+skills\b/mu);
+
+      const result = await cli.run({
+        arguments: ["skills", "add"],
+        environment: workspace.environment,
+      });
+      expect(result.exitCode).toBe(1);
+      expect(result.stdout).toContain("COMMAND_NOT_FOUND");
+      await expect(readdir(workspace.home)).resolves.toEqual([]);
+    },
+    CLI_INTEGRATION_TIMEOUT_MS,
+  );
+});
```

---

### Incident Patch 3: `6ad62cec` (2026-10-06)
**Commit Message**: Merge pull request #663 from kaoru0822-kitauji/fix/semantic-candidate-relevance

fix(javascript): scope candidate ambiguity to query traversal

**File**: `src/domain/javascriptSemanticGraphTraversal.test.ts` (modified, +196/-0)
```diff
@@ -4,6 +4,7 @@ import type { ApplicationGraphEvidence } from "./javascriptApplicationEvidenceSc
 import {
   JAVASCRIPT_SEMANTIC_NODE_KINDS,
   JAVASCRIPT_SEMANTIC_RELATION_FAMILIES,
+  JAVASCRIPT_SEMANTIC_RELATION_FAMILY,
 } from "./javascriptSemanticGraphSchemas.js";
 import {
   createJavaScriptSemanticFingerprint,
@@ -13,6 +14,7 @@ import {
   createJavaScriptSemanticGraphUnknown,
   type JavaScriptSemanticGraph,
   type JavaScriptSemanticGraphNode,
+  type JavaScriptSemanticGraphRelation,
 } from "./javascriptSemanticGraph.js";
 import { queryJavaScriptSemanticGraph } from "./javascriptSemanticQuery.js";
 import type { JsonValue } from "./jsonValue.js";
@@ -396,3 +398,197 @@ it("retains all explicit unresolved candidate node identifiers", () => {
   });
   expect(unknown.candidate_node_ids).toHaveLength(1_001);
 });
+
+const directionalGraph = (
+  nodes: readonly JavaScriptSemanticGraphNode[],
+  relations: readonly JavaScriptSemanticGraphRelation[],
+  partial = false,
+): JavaScriptSemanticGraph =>
+  createJavaScriptSemanticGraph({
+    schema: "JavaScriptSemanticRelationGraph",
+    root_artifact_sha256: SHA,
+    application_graph_id: JAG_ID,
+    root_node_ids: nodes.slice(0, 1).map(({ node_id }) => node_id),
+    nodes: [...nodes],
+    relations: [...relations],
+    fingerprints: [],
+    unknowns: [],
+    coverage: {
+      status: partial ? "partial" : "complete",
+      truncated: false,
+      omitted_nodes: partial ? 1 : 0,
+      omitted_relations: 0,
+      limits: [],
+      families: JAVASCRIPT_SEMANTIC_RELATION_FAMILIES.map((family) => ({
+        family,
+        status: "complete",
+        retained_relations: relations.filter(
+          ({ relation }) =>
+            JAVASCRIPT_SEMANTIC_RELATION_FAMILY[relation] === family,
+        ).length,
+        omitted_relations: 0,
+        unknown_ids: [],
+      })),
+    },
+    limitations: partial ? ["One source graph node was omitted."] : [],
+  });
+
+const relationBetween = (
+  source: JavaScriptSemanticGraphNode,
+  target: JavaScriptSemanticGraphNode,
+  relation: JavaScriptSemanticGraphRelation["relation"],
+  resolution: JavaScriptSemanticGraphRelation["resolution"] = "resolved",
+) =>
+  createJavaScriptSemanticGraphRelation({
+    source_node_id: source.node_id,
+    target_node_id: target.node_id,
+    relation,
+    resolution,
+    properties: {},
+    evidence: evidence("inferred"),
+  });
+
+it.each([
+  {
+    direction: "forward-influence",
+    relation: "calls",
+    incoming: true,
+    relevant: false,
+  },
+  {
+    direction: "forward-influence",
+    relation: "calls",
+    incoming: false,
+    relevant: true,
+  },
+  {
+    direction: "backward-provenance",
+    relation: "calls",
+    incoming: false,
+    relevant: false,
+  },
+  {
+    direction: "backward-provenance",
+    relation: "calls",
+    incoming: true,
+    relevant: true,
+  },
+  { direction: "callers", relation: "reads", incoming: true, relevant: false },
+  { direction: "callers", relation: "calls", incoming: false, relevant: false },
+  { direction: "callers", relation: "calls", incoming: true, relevant: true },
+  {
+    direction: "ownership",
+    relation: "reads",
+    incoming: false,
+    relevant: false,
+  },
+  { direction: "ownership", relation: "owns", incoming: false, relevant: true },
+  { direction: "ownership", relation: "owns", incoming: true, relevant: true },
+] as const)(
+  "limits $direction ambiguity to traversable $relation candidates (incoming=$incoming)",
+  ({ direction, relation, incoming, relevant }) => {
+    const seed = node("function", "directional-seed");
+    const reached = node("function", "directional-reached");
+    const other = node("function", "directional-other");
+    const reverse =
+      direction === "callers" || direction === "backward-provenance";
+    const resolved = relationBetween(
+      reverse ? reached : seed,
+      reverse ? seed : reached,
+      direction === "ownership" ? "owns" : "calls",
+    );
+    const candidate = relationBetween(
+      incoming ? other : reached,
+      incoming ? reached : other,
+      relation,
+      "candidate",
+    );
+    const nodes = [seed, reached, other];
+    const control = queryJavaScriptSemanticGraph(
+      directionalGraph(nodes, [resolved]),
+      {
+        seed: { kind: "semantic-node", node_id: seed.node_id },
+        direction,
+      },
+    );
+    expect(control).toMatchObject({
+      status: "found",
+      coverage: { status: "complete" },
+    });
+    for (const include of [false, true]) {
+      const result = queryJavaScriptSemanticGraph(
+        directionalGraph(nodes, [resolved, candidate]),
+        {
+          seed: { kind: "semantic-node", node_id: seed.node_id },
+          direction,
+          include_ambiguous_dynamic_edges: include,
+        },
+      );
+      expect(result).toMatchObject({
+        status: relevant ? "ambiguous" : "found",
+        coverage: { status: relevant ? "partial" : "complet
```

**File**: `src/domain/javascriptSemanticQuery.ts` (modified, +9/-11)
```diff
@@ -281,17 +281,15 @@ const relevantCandidateRelationCount = (
   nodeIds: ReadonlySet<string>,
   input: JavaScriptSemanticQueryInput,
 ): number => {
-  const allowed =
-    input.allowed_relations === undefined
-      ? null
-      : new Set(input.allowed_relations);
-  return graph.relations.filter(
-    (relation) =>
-      relation.resolution === "candidate" &&
-      (allowed === null || allowed.has(relation.relation)) &&
-      (nodeIds.has(relation.source_node_id) ||
-        nodeIds.has(relation.target_node_id)),
-  ).length;
+  const adjacency = buildAdjacency(
+    graph.relations.filter(({ resolution }) => resolution === "candidate"),
+    { ...input, include_ambiguous_dynamic_edges: true },
+  );
+  const relevant = new Set<string>();
+  for (const nodeId of nodeIds)
+    for (const { relation } of adjacency.get(nodeId) ?? [])
+      relevant.add(relation.relation_id);
+  return relevant.size;
 };
 
 const expectedMatchesFor = (
```

---

### Incident Patch 4: `39db9fe4` (2026-10-06)
**Commit Message**: docs: align MCP discovery and skill guidance with the stable catalog (#664)

**File**: `CONTRIBUTING.md` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@ Turbo. Turbo caches deterministic builds and static checks across Git
 worktrees. After a package, lockfile, or managed-skill version change, run
 `npm run metadata:generate` before building.
 
-Keep dependencies flowing inward through the existing domain, contracts, provider, application, server, and adapter layers. Parse unknown values at process and protocol boundaries, model expected failures with `Result`, and preserve the canonical tool inventory defined by `TOOL_CONTRACTS` unless a deliberate contract change updates every verifier, generated catalog artifact, and snapshot. Prefer capability- and session-scoped tool advertisement over schema truncation.
+Keep dependencies flowing inward through the existing domain, contracts, provider, application, server, and adapter layers. Parse unknown values at process and protocol boundaries, model expected failures with `Result`, and preserve the canonical tool inventory defined by `TOOL_CONTRACTS` unless a deliberate contract change updates every verifier, generated catalog artifact, and snapshot. Keep tool discovery complete and report capability- and session-scoped availability through `binary_session`.
 
 ## Development feedback and PR verification
 
```

**File**: `docs/mcp-contracts.md` (modified, +11/-7)
```diff
@@ -8,15 +8,19 @@ registrations, reports their command vectors as aligned, stale, missing, or
 invalid, and keeps live-server state `unknown` unless the active connection
 supplies identity.
 
-Canonical tool names remain stable, while `tools/list` advertises only the
-operations callable for the current target, provider, host, and
-negotiated client capabilities. `binary_session.tool_availability` remains the
-complete inventory: it explains advertised and hidden operations with stable
-availability reasons and remediation. Each entry also reports required and
-optional negotiated client features plus the currently missing features.
-Opening or closing a target or observing a provider health transition emits
+`tools/list` returns the complete canonical tool inventory, including tools that
+are currently unavailable. Opening or closing a target or observing a provider
+health transition leaves that catalog unchanged and does not emit
 `notifications/tools/list_changed`.
 
+Call `binary_session` with `{}` and read `result.tool_availability` to choose a
+callable operation for the current target, provider, host, and negotiated client
+capabilities. The default result includes the complete inventory with each
+tool's availability, reason, and remediation. Each entry also reports required
+and optional negotiated client features plus the currently missing features.
+The optional inputs `expected_package_version`, `expected_catalog_digest`, and
+`expected_server_path` compare the live session with the caller's expectations.
+
 `binary_session.analysis_provider_candidates` is authoritative for deep-engine
 discovery. Target-free discovery is sorted by provider ID, reports host
 availability and `unknown` target support, and does not create an analysis
```

**File**: `docs/product-catalog.json` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@
       "client": "2.3.1",
       "core": "2.3.1"
     },
-    "skill_version": "24"
+    "skill_version": "25"
   },
   "tools": {
     "total": 116,
```

**File**: `docs/verification/managed-conformance-manifest.json` (modified, +2/-2)
```diff
@@ -1,5 +1,5 @@
 {
-  "manifest_id": "ecm_7da021af56cf2eb25489ed7ce494bfe92244e791fa3b5ad5a238a5eb14a23d9a",
+  "manifest_id": "ecm_6f5a77c85a58f9980ef709b832b5ccb5207c137d40e181b1ea209afa3de60c67",
   "verifier": {
     "id": "rea-managed-conformance",
     "version": "1"
@@ -13,7 +13,7 @@
   "skill_digests": [
     {
       "skill_id": "reverse-engineer-anything",
-      "sha256": "411d5b61e237e3b9b2cb9b3a987d83a36134a2ea1810ddd8d9f695dc05709f5b"
+      "sha256": "08b7039f48babaeda3660d9f62fa1066a6e9f72cf522a3f35201e59634253537"
     }
   ],
   "claims": [
```

**File**: `skills/reverse-engineer-anything/SKILL.md` (modified, +6/-5)
```diff
@@ -2,7 +2,7 @@
 name: reverse-engineer-anything
 description: Reverse engineer native, managed, Electron/JavaScript, packaged, and browser applications with REA. Use shipped-artifact or requested runtime evidence to explain features, compare versions, decompile code, or guide a reconstruction. Skip REA for ordinary source-repository architecture analysis.
 metadata:
-  version: "24"
+  version: "25"
   tool_count: 116
   catalog_digest: "5bb3f994a3c4d0c87a34ff5aab4e28141b5fa6f3a98b5ae7e95686d85d9d983e"
 ---
@@ -37,10 +37,11 @@ name to one clear installed artifact when possible; ask only when matches are
 ambiguous. Never choose an example app on the user's behalf.
 
 In a target-free session, use `open_binary` to bind any archive/package or
-native target whose analysis tool operates on the active target. Do not call a
-tool hidden from `tools/list`; inspect `binary_session` with
-`detail: "capabilities"` for the exact remediation when a desired capability
-is unavailable.
+native target whose analysis tool operates on the active target. `tools/list`
+includes the complete catalog, including unavailable tools. When choosing a
+capability, call `binary_session` with no arguments and read the desired tool's
+entry in `result.tool_availability`. Follow its availability reason and
+remediation before calling an unavailable operation.
 
 ## Work summary-first
 
```

**File**: `skills/reverse-engineer-anything/references/native-and-artifacts.md` (modified, +5/-4)
```diff
@@ -9,10 +9,11 @@ cross-references. Addresses and recovered pseudocode are analysis observations,
 not original source. Provider unavailability and unsupported metadata remain
 unknown rather than false.
 
-Use `binary_session` with its default summary to check the open target, selected
-provider, alignment, and recommended remediation. Request the capabilities view
-with a family filter and page bounds only when choosing a tool. Request the full
-view only for an explicit session-diagnostic need.
+Use `binary_session` with no arguments to check the open target, selected
+provider, and alignment. Its default `result.tool_availability` includes the
+complete tool inventory with availability reasons and remediation. When choosing
+a tool, use its entry in that result; `tools/list` retains the complete catalog
+when the target or provider state changes.
 
 ## Managed PE/CLI
 
```

**File**: `src/generatedPackageMetadata.ts` (modified, +1/-1)
```diff
@@ -5,5 +5,5 @@ export const PACKAGE_METADATA = {
   serverSdkVersion: "2.3.1",
   clientSdkVersion: "2.3.1",
   coreSdkVersion: "2.3.1",
-  skillVersion: "24",
+  skillVersion: "25",
 } as const;
```

**File**: `tests/boundary/filesystem/setupSkill.test.ts` (modified, +13/-1)
```diff
@@ -8,6 +8,7 @@ import {
   installCanonicalSkill,
 } from "../../../src/application/SetupSkill.js";
 import { TOOL_CONTRACTS } from "../../../src/contracts/toolContracts.js";
+import { PRODUCT_IDENTITY } from "../../../src/identity.js";
 
 describe("canonical skill transaction", () => {
   it("backs up and upgrades a stale managed skill without touching siblings", async () => {
@@ -34,7 +35,18 @@ describe("canonical skill transaction", () => {
       "stale managed skill\n",
     );
     const installedSkill = await readFile(destination, "utf8");
-    expect(installedSkill).toContain('version: "24"');
+    expect(installedSkill).toBe(
+      await readFile(
+        new URL(
+          "../../../skills/reverse-engineer-anything/SKILL.md",
+          import.meta.url,
+        ),
+        "utf8",
+      ),
+    );
+    expect(installedSkill).toContain(
+      `version: "${PRODUCT_IDENTITY.skillVersion}"`,
+    );
     expect(installedSkill).toContain("call available analysis tools");
     expect(installedSkill).toContain("obtain approval before setup writes");
     expect(await readFile(`${nativeGuide}.rea.backup`, "utf8")).toBe(
```

---

### Incident Patch 5: `c3d013b2` (2026-10-06)
**Commit Message**: Merge pull request #659 from kaoru0822-kitauji/fix/function-collation-ties

fix(comparison): break function collection collation ties

**File**: `src/domain/functionComparison.test.ts` (modified, +74/-0)
```diff
@@ -8,6 +8,7 @@ import {
 } from "./functionComparison.js";
 import { createEvidence, type Evidence } from "./evidence.js";
 import { functionDossierSchema } from "./hopperValues.js";
+import { canonicalDigest, canonicalJson } from "./comparisonSemantics.js";
 import { jsonValueSchema } from "./jsonValue.js";
 
 const dossier = (
@@ -172,6 +173,79 @@ describe("function comparison normalized identity", () => {
   });
 });
 
+describe("function collection collation ties", () => {
+  const composed = { address: "0x2000", name: "caf\u00e9" };
+  const decomposed = { address: "0x3000", name: "cafe\u0301" };
+  const calling = (
+    callees: readonly { readonly address: string; readonly name: string }[],
+  ) =>
+    functionDossierSchema.parse({
+      ...dossier("return 0;", "0x1000"),
+      callees,
+    });
+
+  it("ignores reordered callees whose distinct names collate equally", () => {
+    const result = compareFunctions(
+      observe("b", calling([composed, decomposed])),
+      observe("c", calling([decomposed, composed])),
+    );
+    expect(result.status).toBe("unchanged");
+    const calls = result.dimensions.find(
+      ({ dimension }) => dimension === "calls",
+    );
+    expect(calls).toMatchObject({
+      status: "unchanged",
+      left_count: 2,
+      right_count: 2,
+    });
+    expect(calls?.left_digest).toBe(calls?.right_digest);
+  });
+
+  it.each([
+    ["remove composed", [decomposed]],
+    ["remove decomposed", [composed]],
+    ["replace composed", [decomposed, decomposed]],
+    ["replace decomposed", [composed, composed]],
+  ] as const)("preserves an exact name change: %s", (_label, changed) => {
+    const result = compareFunctions(
+      observe("b", calling([composed, decomposed])),
+      observe("c", calling(changed)),
+    );
+    expect(result.status).toBe("changed");
+    const calls = result.dimensions.find(
+      ({ dimension }) => dimension === "calls",
+    );
+    expect(calls).toMatchObject({ status: "changed" });
+    expect(calls?.left_digest).not.toBe(calls?.right_digest);
+  });
+
+  it("preserves existing digests when canonical records do not collate equally", () => {
+    const callees = ["zeta", "Alpha", "alpha", "_helper", "beta"].map(
+      (name, index) => ({
+        address: `0x${(0x2000 + index).toString(16)}`,
+        name,
+      }),
+    );
+    const legacyProjection = callees
+      .map(({ name }) => ({ direction: "out", name }))
+      .sort((left, right) =>
+        canonicalJson(left).localeCompare(canonicalJson(right)),
+      );
+    const result = compareFunctions(
+      observe("b", calling(callees)),
+      observe("c", calling([...callees].reverse())),
+    );
+    const calls = result.dimensions.find(
+      ({ dimension }) => dimension === "calls",
+    );
+    expect(calls).toMatchObject({
+      status: "unchanged",
+      left_digest: canonicalDigest(legacyProjection),
+      right_digest: canonicalDigest(legacyProjection),
+    });
+  });
+});
+
 describe("function comparison CFG address normalization", () => {
   it("matches CFG successors by numeric address", () => {
     const make = (base: "0x1000" | "0x2000") =>
```

**File**: `src/domain/functionComparisonNormalization.ts` (modified, +11/-3)
```diff
@@ -1,5 +1,7 @@
 import canonicalize from "canonicalize";
 
+import { compareCodePoints } from "./canonicalOrdering.js";
+
 import type {
   FunctionCollection,
   FunctionSnapshot,
@@ -176,9 +178,15 @@ export const stringAndNameProjection = (
 };
 
 export const sorted = (values: readonly unknown[]): readonly unknown[] =>
-  [...values].sort((left, right) =>
-    canonicalJson(left).localeCompare(canonicalJson(right)),
-  );
+  [...values].sort((left, right) => {
+    const leftJson = canonicalJson(left);
+    const rightJson = canonicalJson(right);
+    // Preserve existing collation while ordering distinct values within a tie.
+    return (
+      leftJson.localeCompare(rightJson) ||
+      compareCodePoints(leftJson, rightJson)
+    );
+  });
 
 export const combineCoverage = <Item>(
   left: FunctionCollection<Item>,
```

---

### Incident Patch 6: `a5d2986b` (2026-10-06)
**Commit Message**: Merge pull request #657 from kaoru0822-kitauji/fix/reference-dynamic-imports

fix(reference): retain dynamic import relationships

**File**: `src/domain/referenceSourceImportParsing.test.ts` (added, +81/-0)
```diff
@@ -0,0 +1,81 @@
+import { describe, expect, it } from "vitest";
+
+import { parseReferenceSourceImports } from "./referenceSourceImportParsing.js";
+
+const parse = (source: string) =>
+  parseReferenceSourceImports(
+    "main.ts",
+    new TextEncoder().encode(source),
+    "TypeScript",
+  );
+
+describe("historical source dynamic imports", () => {
+  it.each([
+    'import("./lazy.js");',
+    'const module = import("./lazy.js");',
+    'async function load() { return await import("./lazy.js"); }',
+    'import("./lazy.js", { with: { type: "json" } });',
+  ])("retains the literal dependency in %s", (source) => {
+    expect(parse(source)).toEqual({
+      relationships: [
+        {
+          from_path: "main.ts",
+          to: "./lazy.js",
+          kind: "imports",
+          resolution: "internal",
+          parse_state: "parsed",
+        },
+      ],
+      parse_failures: [],
+    });
+  });
+
+  it.each([
+    "import(moduleName);",
+    "async function load(name: string) { return await import(name); }",
+    "import(`./${moduleName}.js`);",
+  ])("keeps a computed dependency unknown in %s", (source) => {
+    expect(parse(source)).toEqual({
+      relationships: [
+        {
+          from_path: "main.ts",
+          to: "<dynamic-import>",
+          kind: "imports",
+          resolution: "unknown",
+          parse_state: "partial",
+        },
+      ],
+      parse_failures: [],
+    });
+  });
+
+  it("retains static import and require relationships alongside dynamic imports", () => {
+    const result = parse(
+      'import "./static.js"; require("./common.cjs"); import("node:fs");',
+    );
+    expect(result.parse_failures).toEqual([]);
+    expect(result.relationships).toEqual([
+      {
+        from_path: "main.ts",
+        to: "./static.js",
+        kind: "imports",
+        resolution: "internal",
+        parse_state: "parsed",
+      },
+      {
+        from_path: "main.ts",
+        to: "./common.cjs",
+        kind: "requires",
+        resolution: "internal",
+        parse_state: "parsed",
+      },
+      {
+        from_path: "main.ts",
+        to: "node:fs",
+        kind: "imports",
+        resolution: "external",
+        parse_state: "parsed",
+      },
+    ]);
+  });
+});
```

**File**: `src/domain/referenceSourceImportParsing.ts` (modified, +28/-9)
```diff
@@ -1,12 +1,19 @@
 import { parse, type ParserPlugin } from "@babel/parser";
-import type { CallExpression, File, Node, StringLiteral } from "@babel/types";
+import type {
+  CallExpression,
+  File,
+  ImportExpression,
+  Node,
+  StringLiteral,
+} from "@babel/types";
 import {
   isCallExpression,
   isExportAllDeclaration,
   isExportNamedDeclaration,
   isIdentifier,
   isImport,
   isImportDeclaration,
+  isImportExpression,
   isMemberExpression,
   isNode,
   isStringLiteral,
@@ -196,18 +203,18 @@ const isRequireCallee = (callee: Node | null | undefined): boolean => {
 const isImportCallee = (callee: Node | null | undefined): boolean =>
   isImport(callee);
 
-const collectCallExpressions = (
+const collectModuleExpressions = (
   node: unknown,
-  targets: CallExpression[],
+  targets: Array<CallExpression | ImportExpression>,
 ): void => {
   if (node === null || node === undefined) return;
   if (typeof node !== "object") return;
   if (Array.isArray(node)) {
-    for (const item of node) collectCallExpressions(item, targets);
+    for (const item of node) collectModuleExpressions(item, targets);
     return;
   }
   if (!isNode(node)) return;
-  if (isCallExpression(node)) {
+  if (isCallExpression(node) || isImportExpression(node)) {
     targets.push(node);
   }
   for (const value of Object.values(node)) {
@@ -217,7 +224,7 @@ const collectCallExpressions = (
       typeof value === "object" &&
       !isSourceLocation(value)
     ) {
-      collectCallExpressions(value, targets);
+      collectModuleExpressions(value, targets);
     }
   }
 };
@@ -234,10 +241,22 @@ const extractRequireAndDynamicImports = (
   from_path: string,
   relationships: ReferenceSourceImportRelationship[],
 ): void => {
-  const calls: CallExpression[] = [];
-  for (const statement of body) collectCallExpressions(statement, calls);
+  const expressions: Array<CallExpression | ImportExpression> = [];
+  for (const statement of body)
+    collectModuleExpressions(statement, expressions);
 
-  for (const call of calls) {
+  for (const call of expressions) {
+    if (isImportExpression(call)) {
+      const specifier = safeModuleName(call.source);
+      appendRelationship(relationships, {
+        fromPath: from_path,
+        to: specifier ?? "<dynamic-import>",
+        kind: "imports",
+        parseState: specifier === undefined ? "partial" : "parsed",
+        ...(specifier === undefined ? { resolution: "unknown" } : {}),
+      });
+      continue;
+    }
     const first = call.arguments[0];
     if (isRequireCallee(call.callee) && isModuleExpression(first)) {
       const result = moduleSpecifierFromExpression(first);
```

**File**: `tests/boundary/filesystem/referenceSourceDynamicImports.test.ts` (added, +57/-0)
```diff
@@ -0,0 +1,57 @@
+import { writeFile } from "node:fs/promises";
+import { join } from "node:path";
+
+import { expect, it } from "vitest";
+
+import { importReferenceSource } from "../../../src/application/ReferenceSourceImport.js";
+import { createTestTempDirectory } from "../../fixtures/temporaryDirectory.js";
+
+it("resolves dynamic source imports while retaining computed targets as unknown", async () => {
+  const root = await createTestTempDirectory("rea-reference-dynamic-import-");
+  await Promise.all([
+    writeFile(
+      join(root, "main.ts"),
+      [
+        'import "./static";',
+        'require("./common");',
+        'const lazy = import("./lazy");',
+        'async function load() { return await import("./data.json", { with: { type: "json" } }); }',
+        'const name = "./not-guessed.js"; import(name);',
+      ].join("\n"),
+    ),
+    ...["static.ts", "common.js", "lazy.ts"].map((path) =>
+      writeFile(join(root, path), "export {};\n"),
+    ),
+    writeFile(join(root, "data.json"), '{"value":1}\n'),
+  ]);
+
+  const result = await importReferenceSource({
+    root,
+    caller: "reference-dynamic-import-test",
+    policy: { secretPatterns: [] },
+  });
+  expect(result.ok).toBe(true);
+  if (!result.ok) return;
+  expect(result.value.parse_failures).toEqual([]);
+  expect(result.value.relationships).toHaveLength(5);
+  for (const [to, kind] of [
+    ["static.ts", "imports"],
+    ["common.js", "requires"],
+    ["lazy.ts", "imports"],
+    ["data.json", "imports"],
+  ])
+    expect(result.value.relationships).toContainEqual({
+      from_path: "main.ts",
+      to,
+      kind,
+      resolution: "internal",
+      parse_state: "parsed",
+    });
+  expect(result.value.relationships).toContainEqual({
+    from_path: "main.ts",
+    to: "<dynamic-import>",
+    kind: "imports",
+    resolution: "unknown",
+    parse_state: "partial",
+  });
+});
```

---

### Incident Patch 7: `6a37346a` (2026-10-06)
**Commit Message**: Merge pull request #652 from kaoru0822-kitauji/fix/dispatcher-build-recovery

fix(cli): include build step in missing-runtime recovery

**File**: `scripts/rea.mjs` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@ const runtimeFiles = isMcpMode
 
 if (!(await compiledRuntimeExists(runtimeFiles))) {
   process.stderr.write(
-    `REA's compiled runtime is missing. Run \`npm ci\` in ${packageRoot} to install dependencies and build REA, then restart it. If this is an installed package, reinstall rea-agents.\n`,
+    `REA's compiled runtime is missing. Run \`npm ci && npm run build:cached\` in ${packageRoot} to install dependencies and build REA, then restart it. If this is an installed package, reinstall rea-agents.\n`,
   );
   process.exitCode = 1;
 } else if (isMcpMode) {
```

**File**: `tests/boundary/cli/dispatcher.test.ts` (modified, +4/-1)
```diff
@@ -83,9 +83,12 @@ describe("executable dispatcher", () => {
         expect(result).toMatchObject({
           exitCode: 1,
           stderr: expect.stringContaining(
-            "REA's compiled runtime is missing. Run `npm ci` in",
+            "REA's compiled runtime is missing. Run `npm ci && npm run build:cached` in",
           ),
         });
+        expect(result.stderr).toContain(
+          "If this is an installed package, reinstall rea-agents.",
+        );
         expect(result).toMatchObject({
           stderr: expect.not.stringContaining("ERR_MODULE_NOT_FOUND"),
         });
```

---

### Incident Patch 8: `f94fc796` (2026-10-06)
**Commit Message**: fix(javascript): scope candidate ambiguity to query traversal

**File**: `src/domain/javascriptSemanticGraphTraversal.test.ts` (modified, +196/-0)
```diff
@@ -4,6 +4,7 @@ import type { ApplicationGraphEvidence } from "./javascriptApplicationEvidenceSc
 import {
   JAVASCRIPT_SEMANTIC_NODE_KINDS,
   JAVASCRIPT_SEMANTIC_RELATION_FAMILIES,
+  JAVASCRIPT_SEMANTIC_RELATION_FAMILY,
 } from "./javascriptSemanticGraphSchemas.js";
 import {
   createJavaScriptSemanticFingerprint,
@@ -13,6 +14,7 @@ import {
   createJavaScriptSemanticGraphUnknown,
   type JavaScriptSemanticGraph,
   type JavaScriptSemanticGraphNode,
+  type JavaScriptSemanticGraphRelation,
 } from "./javascriptSemanticGraph.js";
 import { queryJavaScriptSemanticGraph } from "./javascriptSemanticQuery.js";
 import type { JsonValue } from "./jsonValue.js";
@@ -396,3 +398,197 @@ it("retains all explicit unresolved candidate node identifiers", () => {
   });
   expect(unknown.candidate_node_ids).toHaveLength(1_001);
 });
+
+const directionalGraph = (
+  nodes: readonly JavaScriptSemanticGraphNode[],
+  relations: readonly JavaScriptSemanticGraphRelation[],
+  partial = false,
+): JavaScriptSemanticGraph =>
+  createJavaScriptSemanticGraph({
+    schema: "JavaScriptSemanticRelationGraph",
+    root_artifact_sha256: SHA,
+    application_graph_id: JAG_ID,
+    root_node_ids: nodes.slice(0, 1).map(({ node_id }) => node_id),
+    nodes: [...nodes],
+    relations: [...relations],
+    fingerprints: [],
+    unknowns: [],
+    coverage: {
+      status: partial ? "partial" : "complete",
+      truncated: false,
+      omitted_nodes: partial ? 1 : 0,
+      omitted_relations: 0,
+      limits: [],
+      families: JAVASCRIPT_SEMANTIC_RELATION_FAMILIES.map((family) => ({
+        family,
+        status: "complete",
+        retained_relations: relations.filter(
+          ({ relation }) =>
+            JAVASCRIPT_SEMANTIC_RELATION_FAMILY[relation] === family,
+        ).length,
+        omitted_relations: 0,
+        unknown_ids: [],
+      })),
+    },
+    limitations: partial ? ["One source graph node was omitted."] : [],
+  });
+
+const relationBetween = (
+  source: JavaScriptSemanticGraphNode,
+  target: JavaScriptSemanticGraphNode,
+  relation: JavaScriptSemanticGraphRelation["relation"],
+  resolution: JavaScriptSemanticGraphRelation["resolution"] = "resolved",
+) =>
+  createJavaScriptSemanticGraphRelation({
+    source_node_id: source.node_id,
+    target_node_id: target.node_id,
+    relation,
+    resolution,
+    properties: {},
+    evidence: evidence("inferred"),
+  });
+
+it.each([
+  {
+    direction: "forward-influence",
+    relation: "calls",
+    incoming: true,
+    relevant: false,
+  },
+  {
+    direction: "forward-influence",
+    relation: "calls",
+    incoming: false,
+    relevant: true,
+  },
+  {
+    direction: "backward-provenance",
+    relation: "calls",
+    incoming: false,
+    relevant: false,
+  },
+  {
+    direction: "backward-provenance",
+    relation: "calls",
+    incoming: true,
+    relevant: true,
+  },
+  { direction: "callers", relation: "reads", incoming: true, relevant: false },
+  { direction: "callers", relation: "calls", incoming: false, relevant: false },
+  { direction: "callers", relation: "calls", incoming: true, relevant: true },
+  {
+    direction: "ownership",
+    relation: "reads",
+    incoming: false,
+    relevant: false,
+  },
+  { direction: "ownership", relation: "owns", incoming: false, relevant: true },
+  { direction: "ownership", relation: "owns", incoming: true, relevant: true },
+] as const)(
+  "limits $direction ambiguity to traversable $relation candidates (incoming=$incoming)",
+  ({ direction, relation, incoming, relevant }) => {
+    const seed = node("function", "directional-seed");
+    const reached = node("function", "directional-reached");
+    const other = node("function", "directional-other");
+    const reverse =
+      direction === "callers" || direction === "backward-provenance";
+    const resolved = relationBetween(
+      reverse ? reached : seed,
+      reverse ? seed : reached,
+      direction === "ownership" ? "owns" : "calls",
+    );
+    const candidate = relationBetween(
+      incoming ? other : reached,
+      incoming ? reached : other,
+      relation,
+      "candidate",
+    );
+    const nodes = [seed, reached, other];
+    const control = queryJavaScriptSemanticGraph(
+      directionalGraph(nodes, [resolved]),
+      {
+        seed: { kind: "semantic-node", node_id: seed.node_id },
+        direction,
+      },
+    );
+    expect(control).toMatchObject({
+      status: "found",
+      coverage: { status: "complete" },
+    });
+    for (const include of [false, true]) {
+      const result = queryJavaScriptSemanticGraph(
+        directionalGraph(nodes, [resolved, candidate]),
+        {
+          seed: { kind: "semantic-node", node_id: seed.node_id },
+          direction,
+          include_ambiguous_dynamic_edges: include,
+        },
+      );
+      expect(result).toMatchObject({
+        status: relevant ? "ambiguous" : "found",
+        coverage: { status: relevant ? "partial" : "complet
```

**File**: `src/domain/javascriptSemanticQuery.ts` (modified, +9/-11)
```diff
@@ -281,17 +281,15 @@ const relevantCandidateRelationCount = (
   nodeIds: ReadonlySet<string>,
   input: JavaScriptSemanticQueryInput,
 ): number => {
-  const allowed =
-    input.allowed_relations === undefined
-      ? null
-      : new Set(input.allowed_relations);
-  return graph.relations.filter(
-    (relation) =>
-      relation.resolution === "candidate" &&
-      (allowed === null || allowed.has(relation.relation)) &&
-      (nodeIds.has(relation.source_node_id) ||
-        nodeIds.has(relation.target_node_id)),
-  ).length;
+  const adjacency = buildAdjacency(
+    graph.relations.filter(({ resolution }) => resolution === "candidate"),
+    { ...input, include_ambiguous_dynamic_edges: true },
+  );
+  const relevant = new Set<string>();
+  for (const nodeId of nodeIds)
+    for (const { relation } of adjacency.get(nodeId) ?? [])
+      relevant.add(relation.relation_id);
+  return relevant.size;
 };
 
 const expectedMatchesFor = (
```

---

### Incident Patch 9: `5802ef87` (2026-10-06)
**Commit Message**: Merge pull request #651 from kaoru0822-kitauji/fix/node-runtime-engine-alignment

fix(setup): align Node runtime checks with package engines

**File**: `README.md` (modified, +1/-1)
```diff
@@ -144,7 +144,7 @@ Update either installation with `rea update`.
 
 - macOS 12 or newer
 - Ubuntu 24.04+, Fedora 41+, or 64-bit Arch Linux
-- Node.js 22.19+ or 24.11+ (including newer releases)
+- Node.js 22.x (>=22.19), 24.x (>=24.11), or 26+
 - npm; REA does not require or install a particular npm version
 
 Native binary analysis requires [Hopper](https://www.hopperapp.com/) or [Ghidra](#ghidra-read-only-analysis-provider). Hopper is separate software with its own license; its demo supports analysis with vendor-defined limits. REA can use Ghidra that you have already installed.
```

**File**: `README_ar.md` (modified, +1/-1)
```diff
@@ -126,7 +126,7 @@ rea setup
 
 - macOS 12 أو أحدث
 - Ubuntu 24.04+ أو Fedora 41+ أو Arch Linux بنواة 64 بت
-- Node.js 22.19+ أو 24.11+ وnpm
+- Node.js 22.x (>=22.19) أو 24.x (>=24.11) أو 26+ وnpm
 
 يتطلب تحليل الملفات التنفيذية الأصلية Hopper أو Ghidra. Hopper برنامج منفصل، وللوضع التجريبي قيود يحددها المورّد، لكن الترخيص المدفوع ليس إلزاميًا.
 
```

**File**: `README_ja.md` (modified, +1/-1)
```diff
@@ -126,7 +126,7 @@ rea setup
 
 - macOS 12 以降
 - Ubuntu 24.04+、Fedora 41+、または 64 ビット Arch Linux
-- Node.js 22.19+ または 24.11+ と npm
+- Node.js 22.x (>=22.19)、24.x (>=24.11)、または 26+ と npm
 
 ネイティブバイナリ解析には Hopper または Ghidra が必要です。Hopper は別製品です。デモにはベンダー所定の制限がありますが、有料ライセンスは必須ではありません。
 
```

**File**: `README_ko.md` (modified, +1/-1)
```diff
@@ -127,7 +127,7 @@ rea setup
 
 - macOS 12 이상
 - Ubuntu 24.04+, Fedora 41+ 또는 64비트 Arch Linux
-- Node.js 22.19+ 또는 24.11+와 npm
+- Node.js 22.x (>=22.19), 24.x (>=24.11) 또는 26+와 npm
 
 네이티브 바이너리 분석에는 Hopper 또는 Ghidra가 필요합니다. Hopper는 별도 소프트웨어입니다. 데모에는 공급업체의 제한이 있지만 유료 라이선스가 필수는 아닙니다.
 
```

**File**: `README_zh.md` (modified, +1/-1)
```diff
@@ -126,7 +126,7 @@ rea setup
 
 - macOS 12 或更高版本
 - Ubuntu 24.04+、Fedora 41+ 或 64 位 Arch Linux
-- Node.js 22.19+ 或 24.11+，以及 npm
+- Node.js 22.x (>=22.19)、24.x (>=24.11) 或 26+，以及 npm
 
 原生二进制分析需要 Hopper 或 Ghidra。Hopper 是独立软件；演示模式有厂商规定的限制，不要求购买许可证。
 
```

**File**: `docs/installation.md` (modified, +1/-1)
```diff
@@ -36,7 +36,7 @@ Setup continues to pin persistent MCP registrations to the exact version that
 performed setup. Running current setup later migrates unversioned or older
 managed registrations through the normal reviewed setup transaction.
 
-REA supports Node.js 22.19+ and 24.11+ (including newer releases). It uses the npm already paired with that runtime and never upgrades Node.js, npm, or Homebrew.
+REA supports Node.js 22.x (>=22.19), 24.x (>=24.11), and 26+. Node.js 23, 25, and prereleases are unsupported. It uses the npm already paired with that runtime and never upgrades Node.js, npm, or Homebrew.
 
 Running `npm install rea-agents` without `--global` installs the executable only
 in the current project's `node_modules/.bin`; it does not make `rea` available
```

**File**: `docs/user-visible-errors.csv` (modified, +5/-5)
```diff
@@ -55,7 +55,7 @@ harm_rank,location,trigger,current_copy,user_risk,proposed_replacement,implement
 45.5,src/application/Uninstall.ts:removeClient restore,Configuration update fails and restoring the original also fails,"Configuration could not be updated or restored. Restore its `.rea.backup` manually, then rerun uninstall.","High risk; persistent configuration may be damaged, but retained backup is authoritative",Keep new recovery copy,implemented,verified by injected restoration failure test
 46,src/application/Uninstall.ts:removeManagedPath symlink,Managed cache/state/skill path is a symbolic link,Refused to follow symlink {path}.,Exposes local path and does not explain manual safety check,"REA did not remove this item because its managed path is a symbolic link. Verify the link target before removing it manually.",implemented,focused assertion passed
 47,src/application/Uninstall.ts:removeManagedPath failure,Managed item removal fails,{path} could not be removed.,Exposes local path and gives no recovery,"This item could not be removed. Check file permissions, then rerun uninstall.",implemented,verified by injected managed-path removal failure test
-48,src/application/Doctor.ts:node,Runtime version is outside supported ranges,Install Node.js 22.19+ or 24.11+.,Low risk; exact dependency recovery,Keep current copy,unchanged,verified by doctor unit test
+48,src/application/DoctorDiagnostics.ts:node,Runtime version is outside supported ranges,"Install Node.js 22.x (>=22.19), 24.x (>=24.11), or 26+.",Low risk; exact dependency recovery,Keep current copy,unchanged,verified by doctor unit test
 49,src/application/Doctor.ts:host,Host OS/distribution is unsupported,"REA supports macOS 12+, Ubuntu 24.04+, Fedora 41+, and 64-bit Arch Linux.",Low risk; clearly states supported choices,Keep current copy,unchanged,verified by doctor unit tests
 50,src/application/Doctor.ts:analysis engine,Optional deep-analysis executable cannot be found,"Run rea setup to install Hopper, or set HOPPER_LAUNCHER_PATH.",Low risk in setup-specific diagnostic; exact recovery paths,Keep current copy,unchanged,verified by doctor unit tests
 51,src/application/Doctor.ts:target,Optional target path fails shared validation,Supply a readable local app or program path.,Low risk; tells caller valid target class,Keep current copy,unchanged,verified by doctor unit test
@@ -65,7 +65,7 @@ harm_rank,location,trigger,current_copy,user_risk,proposed_replacement,implement
 55,src/application/Setup.ts:optional engine,Setup completes without optional deep-analysis engine,Hopper is optional for non-Hopper providers. Rerun with --yes --install-hopper for deep native analysis.,Exposes provider terminology but this is an explanatory setup status rather than an error; recovery command is exact,Keep current copy,unchanged,verified by setup unit test
 56,src/application/Setup.ts:doctor fallback,Post-setup diagnostics remain unhealthy,Run rea doctor and apply each reported remediation.,Low risk; delegates to structured per-check recovery,Keep current copy,unchanged,verified by exact setup unit test
 57,src/application/Setup.ts:unsupported platform,Platform is neither macOS nor Linux,REA supports Hopper on macOS and selected 64-bit Linux distributions.,Low risk; states support boundary,Keep current copy,unchanged,verified by setup unit test
-58,src/application/Setup.ts:unsupported Node,Runtime version cannot run setup,Install Node.js 22.19+ or 24.11+ and rerun setup.,Low risk; exact dependency and retry,Keep current copy,unchanged,verified by setup host tests
+58,src/application/SetupHost.ts:unsupported Node,Runtime version cannot run setup,"Install Node.js 22.x (>=22.19), 24.x (>=24.11), or 26+ and rerun setup.",Low risk; exact dependency and retry,Keep current copy,unchanged,verified by setup host tests
 59,src/application/Setup.ts:unsupported macOS,macOS version is missing or older than 12,Upgrade to macOS 12 or newer.,Low risk; exact support floor,Keep current copy,unchanged,verified by setup host tests
 60,src/application/Setup.ts:unsupported Linux,Linux distribution is outside supported set,"REA supports Hopper on Ubuntu 24.04+, Fedora 41+, and 64-bit Arch Linux.",Low risk; exact supported alternatives,Keep current copy,unchanged,verified by setup unit test
 61,src/application/ProcessCli.ts:readJson read,Process scenario or evidence file cannot be read,Raw filesystem exception through CLI framework,Can expose local paths/codes and no recovery,"Process input file could not be read. Check that the path exists and is readable.",implemented,verified by focused CLI test
@@ -83,11 +83,11 @@ harm_rank,location,trigger,current_copy,user_risk,proposed_replacement,implement
 74,install.sh:unknown option,Installer receives an unsupported flag,unknown option with caller-provided flag,Low risk; identifies offending input,Keep current copy,unchanged,verified by shell branch inspection
 75,install.sh:platform,Installer runs outside macOS or supported Linux,REA supports macO
```

**File**: `docs/windows-ghidra-p0.md` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@ mutable targets require separate acceptance.
 Once the required native controls are implemented, the intended P0 is limited to:
 
 - a Windows x64 host;
-- Node.js 22.19+ or 24.11+;
+- Node.js 22.x (>=22.19), 24.x (>=24.11), or 26+;
 - an operator-installed official Ghidra 12.1.4 distribution;
 - a 64-bit full JDK 21;
 - an explicit native, non-managed, non-DLL x86-64 PE application; and
```

---

### Incident Patch 10: `3aaf7e2c` (2026-10-06)
**Commit Message**: fix(comparison): break function collection collation ties

**File**: `src/domain/functionComparison.test.ts` (modified, +74/-0)
```diff
@@ -8,6 +8,7 @@ import {
 } from "./functionComparison.js";
 import { createEvidence, type Evidence } from "./evidence.js";
 import { functionDossierSchema } from "./hopperValues.js";
+import { canonicalDigest, canonicalJson } from "./comparisonSemantics.js";
 import { jsonValueSchema } from "./jsonValue.js";
 
 const dossier = (
@@ -172,6 +173,79 @@ describe("function comparison normalized identity", () => {
   });
 });
 
+describe("function collection collation ties", () => {
+  const composed = { address: "0x2000", name: "caf\u00e9" };
+  const decomposed = { address: "0x3000", name: "cafe\u0301" };
+  const calling = (
+    callees: readonly { readonly address: string; readonly name: string }[],
+  ) =>
+    functionDossierSchema.parse({
+      ...dossier("return 0;", "0x1000"),
+      callees,
+    });
+
+  it("ignores reordered callees whose distinct names collate equally", () => {
+    const result = compareFunctions(
+      observe("b", calling([composed, decomposed])),
+      observe("c", calling([decomposed, composed])),
+    );
+    expect(result.status).toBe("unchanged");
+    const calls = result.dimensions.find(
+      ({ dimension }) => dimension === "calls",
+    );
+    expect(calls).toMatchObject({
+      status: "unchanged",
+      left_count: 2,
+      right_count: 2,
+    });
+    expect(calls?.left_digest).toBe(calls?.right_digest);
+  });
+
+  it.each([
+    ["remove composed", [decomposed]],
+    ["remove decomposed", [composed]],
+    ["replace composed", [decomposed, decomposed]],
+    ["replace decomposed", [composed, composed]],
+  ] as const)("preserves an exact name change: %s", (_label, changed) => {
+    const result = compareFunctions(
+      observe("b", calling([composed, decomposed])),
+      observe("c", calling(changed)),
+    );
+    expect(result.status).toBe("changed");
+    const calls = result.dimensions.find(
+      ({ dimension }) => dimension === "calls",
+    );
+    expect(calls).toMatchObject({ status: "changed" });
+    expect(calls?.left_digest).not.toBe(calls?.right_digest);
+  });
+
+  it("preserves existing digests when canonical records do not collate equally", () => {
+    const callees = ["zeta", "Alpha", "alpha", "_helper", "beta"].map(
+      (name, index) => ({
+        address: `0x${(0x2000 + index).toString(16)}`,
+        name,
+      }),
+    );
+    const legacyProjection = callees
+      .map(({ name }) => ({ direction: "out", name }))
+      .sort((left, right) =>
+        canonicalJson(left).localeCompare(canonicalJson(right)),
+      );
+    const result = compareFunctions(
+      observe("b", calling(callees)),
+      observe("c", calling([...callees].reverse())),
+    );
+    const calls = result.dimensions.find(
+      ({ dimension }) => dimension === "calls",
+    );
+    expect(calls).toMatchObject({
+      status: "unchanged",
+      left_digest: canonicalDigest(legacyProjection),
+      right_digest: canonicalDigest(legacyProjection),
+    });
+  });
+});
+
 describe("function comparison CFG address normalization", () => {
   it("matches CFG successors by numeric address", () => {
     const make = (base: "0x1000" | "0x2000") =>
```

**File**: `src/domain/functionComparisonNormalization.ts` (modified, +11/-3)
```diff
@@ -1,5 +1,7 @@
 import canonicalize from "canonicalize";
 
+import { compareCodePoints } from "./canonicalOrdering.js";
+
 import type {
   FunctionCollection,
   FunctionSnapshot,
@@ -176,9 +178,15 @@ export const stringAndNameProjection = (
 };
 
 export const sorted = (values: readonly unknown[]): readonly unknown[] =>
-  [...values].sort((left, right) =>
-    canonicalJson(left).localeCompare(canonicalJson(right)),
-  );
+  [...values].sort((left, right) => {
+    const leftJson = canonicalJson(left);
+    const rightJson = canonicalJson(right);
+    // Preserve existing collation while ordering distinct values within a tie.
+    return (
+      leftJson.localeCompare(rightJson) ||
+      compareCodePoints(leftJson, rightJson)
+    );
+  });
 
 export const combineCoverage = <Item>(
   left: FunctionCollection<Item>,
```

---

### Incident Patch 11: `b89de8fe` (2026-10-06)
**Commit Message**: fix(reference): retain dynamic import relationships

**File**: `src/domain/referenceSourceImportParsing.test.ts` (added, +81/-0)
```diff
@@ -0,0 +1,81 @@
+import { describe, expect, it } from "vitest";
+
+import { parseReferenceSourceImports } from "./referenceSourceImportParsing.js";
+
+const parse = (source: string) =>
+  parseReferenceSourceImports(
+    "main.ts",
+    new TextEncoder().encode(source),
+    "TypeScript",
+  );
+
+describe("historical source dynamic imports", () => {
+  it.each([
+    'import("./lazy.js");',
+    'const module = import("./lazy.js");',
+    'async function load() { return await import("./lazy.js"); }',
+    'import("./lazy.js", { with: { type: "json" } });',
+  ])("retains the literal dependency in %s", (source) => {
+    expect(parse(source)).toEqual({
+      relationships: [
+        {
+          from_path: "main.ts",
+          to: "./lazy.js",
+          kind: "imports",
+          resolution: "internal",
+          parse_state: "parsed",
+        },
+      ],
+      parse_failures: [],
+    });
+  });
+
+  it.each([
+    "import(moduleName);",
+    "async function load(name: string) { return await import(name); }",
+    "import(`./${moduleName}.js`);",
+  ])("keeps a computed dependency unknown in %s", (source) => {
+    expect(parse(source)).toEqual({
+      relationships: [
+        {
+          from_path: "main.ts",
+          to: "<dynamic-import>",
+          kind: "imports",
+          resolution: "unknown",
+          parse_state: "partial",
+        },
+      ],
+      parse_failures: [],
+    });
+  });
+
+  it("retains static import and require relationships alongside dynamic imports", () => {
+    const result = parse(
+      'import "./static.js"; require("./common.cjs"); import("node:fs");',
+    );
+    expect(result.parse_failures).toEqual([]);
+    expect(result.relationships).toEqual([
+      {
+        from_path: "main.ts",
+        to: "./static.js",
+        kind: "imports",
+        resolution: "internal",
+        parse_state: "parsed",
+      },
+      {
+        from_path: "main.ts",
+        to: "./common.cjs",
+        kind: "requires",
+        resolution: "internal",
+        parse_state: "parsed",
+      },
+      {
+        from_path: "main.ts",
+        to: "node:fs",
+        kind: "imports",
+        resolution: "external",
+        parse_state: "parsed",
+      },
+    ]);
+  });
+});
```

**File**: `src/domain/referenceSourceImportParsing.ts` (modified, +28/-9)
```diff
@@ -1,12 +1,19 @@
 import { parse, type ParserPlugin } from "@babel/parser";
-import type { CallExpression, File, Node, StringLiteral } from "@babel/types";
+import type {
+  CallExpression,
+  File,
+  ImportExpression,
+  Node,
+  StringLiteral,
+} from "@babel/types";
 import {
   isCallExpression,
   isExportAllDeclaration,
   isExportNamedDeclaration,
   isIdentifier,
   isImport,
   isImportDeclaration,
+  isImportExpression,
   isMemberExpression,
   isNode,
   isStringLiteral,
@@ -196,18 +203,18 @@ const isRequireCallee = (callee: Node | null | undefined): boolean => {
 const isImportCallee = (callee: Node | null | undefined): boolean =>
   isImport(callee);
 
-const collectCallExpressions = (
+const collectModuleExpressions = (
   node: unknown,
-  targets: CallExpression[],
+  targets: Array<CallExpression | ImportExpression>,
 ): void => {
   if (node === null || node === undefined) return;
   if (typeof node !== "object") return;
   if (Array.isArray(node)) {
-    for (const item of node) collectCallExpressions(item, targets);
+    for (const item of node) collectModuleExpressions(item, targets);
     return;
   }
   if (!isNode(node)) return;
-  if (isCallExpression(node)) {
+  if (isCallExpression(node) || isImportExpression(node)) {
     targets.push(node);
   }
   for (const value of Object.values(node)) {
@@ -217,7 +224,7 @@ const collectCallExpressions = (
       typeof value === "object" &&
       !isSourceLocation(value)
     ) {
-      collectCallExpressions(value, targets);
+      collectModuleExpressions(value, targets);
     }
   }
 };
@@ -234,10 +241,22 @@ const extractRequireAndDynamicImports = (
   from_path: string,
   relationships: ReferenceSourceImportRelationship[],
 ): void => {
-  const calls: CallExpression[] = [];
-  for (const statement of body) collectCallExpressions(statement, calls);
+  const expressions: Array<CallExpression | ImportExpression> = [];
+  for (const statement of body)
+    collectModuleExpressions(statement, expressions);
 
-  for (const call of calls) {
+  for (const call of expressions) {
+    if (isImportExpression(call)) {
+      const specifier = safeModuleName(call.source);
+      appendRelationship(relationships, {
+        fromPath: from_path,
+        to: specifier ?? "<dynamic-import>",
+        kind: "imports",
+        parseState: specifier === undefined ? "partial" : "parsed",
+        ...(specifier === undefined ? { resolution: "unknown" } : {}),
+      });
+      continue;
+    }
     const first = call.arguments[0];
     if (isRequireCallee(call.callee) && isModuleExpression(first)) {
       const result = moduleSpecifierFromExpression(first);
```

**File**: `tests/boundary/filesystem/referenceSourceDynamicImports.test.ts` (added, +57/-0)
```diff
@@ -0,0 +1,57 @@
+import { writeFile } from "node:fs/promises";
+import { join } from "node:path";
+
+import { expect, it } from "vitest";
+
+import { importReferenceSource } from "../../../src/application/ReferenceSourceImport.js";
+import { createTestTempDirectory } from "../../fixtures/temporaryDirectory.js";
+
+it("resolves dynamic source imports while retaining computed targets as unknown", async () => {
+  const root = await createTestTempDirectory("rea-reference-dynamic-import-");
+  await Promise.all([
+    writeFile(
+      join(root, "main.ts"),
+      [
+        'import "./static";',
+        'require("./common");',
+        'const lazy = import("./lazy");',
+        'async function load() { return await import("./data.json", { with: { type: "json" } }); }',
+        'const name = "./not-guessed.js"; import(name);',
+      ].join("\n"),
+    ),
+    ...["static.ts", "common.js", "lazy.ts"].map((path) =>
+      writeFile(join(root, path), "export {};\n"),
+    ),
+    writeFile(join(root, "data.json"), '{"value":1}\n'),
+  ]);
+
+  const result = await importReferenceSource({
+    root,
+    caller: "reference-dynamic-import-test",
+    policy: { secretPatterns: [] },
+  });
+  expect(result.ok).toBe(true);
+  if (!result.ok) return;
+  expect(result.value.parse_failures).toEqual([]);
+  expect(result.value.relationships).toHaveLength(5);
+  for (const [to, kind] of [
+    ["static.ts", "imports"],
+    ["common.js", "requires"],
+    ["lazy.ts", "imports"],
+    ["data.json", "imports"],
+  ])
+    expect(result.value.relationships).toContainEqual({
+      from_path: "main.ts",
+      to,
+      kind,
+      resolution: "internal",
+      parse_state: "parsed",
+    });
+  expect(result.value.relationships).toContainEqual({
+    from_path: "main.ts",
+    to: "<dynamic-import>",
+    kind: "imports",
+    resolution: "unknown",
+    parse_state: "partial",
+  });
+});
```

---

### Incident Patch 12: `ae72abd0` (2026-10-06)
**Commit Message**: fix(cli): include build step in missing-runtime recovery

**File**: `scripts/rea.mjs` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@ const runtimeFiles = isMcpMode
 
 if (!(await compiledRuntimeExists(runtimeFiles))) {
   process.stderr.write(
-    `REA's compiled runtime is missing. Run \`npm ci\` in ${packageRoot} to install dependencies and build REA, then restart it. If this is an installed package, reinstall rea-agents.\n`,
+    `REA's compiled runtime is missing. Run \`npm ci && npm run build:cached\` in ${packageRoot} to install dependencies and build REA, then restart it. If this is an installed package, reinstall rea-agents.\n`,
   );
   process.exitCode = 1;
 } else if (isMcpMode) {
```

**File**: `tests/boundary/cli/dispatcher.test.ts` (modified, +4/-1)
```diff
@@ -83,9 +83,12 @@ describe("executable dispatcher", () => {
         expect(result).toMatchObject({
           exitCode: 1,
           stderr: expect.stringContaining(
-            "REA's compiled runtime is missing. Run `npm ci` in",
+            "REA's compiled runtime is missing. Run `npm ci && npm run build:cached` in",
           ),
         });
+        expect(result.stderr).toContain(
+          "If this is an installed package, reinstall rea-agents.",
+        );
         expect(result).toMatchObject({
           stderr: expect.not.stringContaining("ERR_MODULE_NOT_FOUND"),
         });
```

---

### Incident Patch 13: `ea0b7336` (2026-10-06)
**Commit Message**: fix(setup): align Node runtime checks with package engines

**File**: `README.md` (modified, +1/-1)
```diff
@@ -144,7 +144,7 @@ Update either installation with `rea update`.
 
 - macOS 12 or newer
 - Ubuntu 24.04+, Fedora 41+, or 64-bit Arch Linux
-- Node.js 22.19+ or 24.11+ (including newer releases)
+- Node.js 22.x (>=22.19), 24.x (>=24.11), or 26+
 - npm; REA does not require or install a particular npm version
 
 Native binary analysis requires [Hopper](https://www.hopperapp.com/) or [Ghidra](#ghidra-read-only-analysis-provider). Hopper is separate software with its own license; its demo supports analysis with vendor-defined limits. REA can use Ghidra that you have already installed.
```

**File**: `README_ar.md` (modified, +1/-1)
```diff
@@ -126,7 +126,7 @@ rea setup
 
 - macOS 12 أو أحدث
 - Ubuntu 24.04+ أو Fedora 41+ أو Arch Linux بنواة 64 بت
-- Node.js 22.19+ أو 24.11+ وnpm
+- Node.js 22.x (>=22.19) أو 24.x (>=24.11) أو 26+ وnpm
 
 يتطلب تحليل الملفات التنفيذية الأصلية Hopper أو Ghidra. Hopper برنامج منفصل، وللوضع التجريبي قيود يحددها المورّد، لكن الترخيص المدفوع ليس إلزاميًا.
 
```

**File**: `README_ja.md` (modified, +1/-1)
```diff
@@ -126,7 +126,7 @@ rea setup
 
 - macOS 12 以降
 - Ubuntu 24.04+、Fedora 41+、または 64 ビット Arch Linux
-- Node.js 22.19+ または 24.11+ と npm
+- Node.js 22.x (>=22.19)、24.x (>=24.11)、または 26+ と npm
 
 ネイティブバイナリ解析には Hopper または Ghidra が必要です。Hopper は別製品です。デモにはベンダー所定の制限がありますが、有料ライセンスは必須ではありません。
 
```

**File**: `README_ko.md` (modified, +1/-1)
```diff
@@ -127,7 +127,7 @@ rea setup
 
 - macOS 12 이상
 - Ubuntu 24.04+, Fedora 41+ 또는 64비트 Arch Linux
-- Node.js 22.19+ 또는 24.11+와 npm
+- Node.js 22.x (>=22.19), 24.x (>=24.11) 또는 26+와 npm
 
 네이티브 바이너리 분석에는 Hopper 또는 Ghidra가 필요합니다. Hopper는 별도 소프트웨어입니다. 데모에는 공급업체의 제한이 있지만 유료 라이선스가 필수는 아닙니다.
 
```

**File**: `README_zh.md` (modified, +1/-1)
```diff
@@ -126,7 +126,7 @@ rea setup
 
 - macOS 12 或更高版本
 - Ubuntu 24.04+、Fedora 41+ 或 64 位 Arch Linux
-- Node.js 22.19+ 或 24.11+，以及 npm
+- Node.js 22.x (>=22.19)、24.x (>=24.11) 或 26+，以及 npm
 
 原生二进制分析需要 Hopper 或 Ghidra。Hopper 是独立软件；演示模式有厂商规定的限制，不要求购买许可证。
 
```

**File**: `docs/installation.md` (modified, +1/-1)
```diff
@@ -36,7 +36,7 @@ Setup continues to pin persistent MCP registrations to the exact version that
 performed setup. Running current setup later migrates unversioned or older
 managed registrations through the normal reviewed setup transaction.
 
-REA supports Node.js 22.19+ and 24.11+ (including newer releases). It uses the npm already paired with that runtime and never upgrades Node.js, npm, or Homebrew.
+REA supports Node.js 22.x (>=22.19), 24.x (>=24.11), and 26+. Node.js 23, 25, and prereleases are unsupported. It uses the npm already paired with that runtime and never upgrades Node.js, npm, or Homebrew.
 
 Running `npm install rea-agents` without `--global` installs the executable only
 in the current project's `node_modules/.bin`; it does not make `rea` available
```

**File**: `docs/user-visible-errors.csv` (modified, +5/-5)
```diff
@@ -55,7 +55,7 @@ harm_rank,location,trigger,current_copy,user_risk,proposed_replacement,implement
 45.5,src/application/Uninstall.ts:removeClient restore,Configuration update fails and restoring the original also fails,"Configuration could not be updated or restored. Restore its `.rea.backup` manually, then rerun uninstall.","High risk; persistent configuration may be damaged, but retained backup is authoritative",Keep new recovery copy,implemented,verified by injected restoration failure test
 46,src/application/Uninstall.ts:removeManagedPath symlink,Managed cache/state/skill path is a symbolic link,Refused to follow symlink {path}.,Exposes local path and does not explain manual safety check,"REA did not remove this item because its managed path is a symbolic link. Verify the link target before removing it manually.",implemented,focused assertion passed
 47,src/application/Uninstall.ts:removeManagedPath failure,Managed item removal fails,{path} could not be removed.,Exposes local path and gives no recovery,"This item could not be removed. Check file permissions, then rerun uninstall.",implemented,verified by injected managed-path removal failure test
-48,src/application/Doctor.ts:node,Runtime version is outside supported ranges,Install Node.js 22.19+ or 24.11+.,Low risk; exact dependency recovery,Keep current copy,unchanged,verified by doctor unit test
+48,src/application/DoctorDiagnostics.ts:node,Runtime version is outside supported ranges,"Install Node.js 22.x (>=22.19), 24.x (>=24.11), or 26+.",Low risk; exact dependency recovery,Keep current copy,unchanged,verified by doctor unit test
 49,src/application/Doctor.ts:host,Host OS/distribution is unsupported,"REA supports macOS 12+, Ubuntu 24.04+, Fedora 41+, and 64-bit Arch Linux.",Low risk; clearly states supported choices,Keep current copy,unchanged,verified by doctor unit tests
 50,src/application/Doctor.ts:analysis engine,Optional deep-analysis executable cannot be found,"Run rea setup to install Hopper, or set HOPPER_LAUNCHER_PATH.",Low risk in setup-specific diagnostic; exact recovery paths,Keep current copy,unchanged,verified by doctor unit tests
 51,src/application/Doctor.ts:target,Optional target path fails shared validation,Supply a readable local app or program path.,Low risk; tells caller valid target class,Keep current copy,unchanged,verified by doctor unit test
@@ -65,7 +65,7 @@ harm_rank,location,trigger,current_copy,user_risk,proposed_replacement,implement
 55,src/application/Setup.ts:optional engine,Setup completes without optional deep-analysis engine,Hopper is optional for non-Hopper providers. Rerun with --yes --install-hopper for deep native analysis.,Exposes provider terminology but this is an explanatory setup status rather than an error; recovery command is exact,Keep current copy,unchanged,verified by setup unit test
 56,src/application/Setup.ts:doctor fallback,Post-setup diagnostics remain unhealthy,Run rea doctor and apply each reported remediation.,Low risk; delegates to structured per-check recovery,Keep current copy,unchanged,verified by exact setup unit test
 57,src/application/Setup.ts:unsupported platform,Platform is neither macOS nor Linux,REA supports Hopper on macOS and selected 64-bit Linux distributions.,Low risk; states support boundary,Keep current copy,unchanged,verified by setup unit test
-58,src/application/Setup.ts:unsupported Node,Runtime version cannot run setup,Install Node.js 22.19+ or 24.11+ and rerun setup.,Low risk; exact dependency and retry,Keep current copy,unchanged,verified by setup host tests
+58,src/application/SetupHost.ts:unsupported Node,Runtime version cannot run setup,"Install Node.js 22.x (>=22.19), 24.x (>=24.11), or 26+ and rerun setup.",Low risk; exact dependency and retry,Keep current copy,unchanged,verified by setup host tests
 59,src/application/Setup.ts:unsupported macOS,macOS version is missing or older than 12,Upgrade to macOS 12 or newer.,Low risk; exact support floor,Keep current copy,unchanged,verified by setup host tests
 60,src/application/Setup.ts:unsupported Linux,Linux distribution is outside supported set,"REA supports Hopper on Ubuntu 24.04+, Fedora 41+, and 64-bit Arch Linux.",Low risk; exact supported alternatives,Keep current copy,unchanged,verified by setup unit test
 61,src/application/ProcessCli.ts:readJson read,Process scenario or evidence file cannot be read,Raw filesystem exception through CLI framework,Can expose local paths/codes and no recovery,"Process input file could not be read. Check that the path exists and is readable.",implemented,verified by focused CLI test
@@ -83,11 +83,11 @@ harm_rank,location,trigger,current_copy,user_risk,proposed_replacement,implement
 74,install.sh:unknown option,Installer receives an unsupported flag,unknown option with caller-provided flag,Low risk; identifies offending input,Keep current copy,unchanged,verified by shell branch inspection
 75,install.sh:platform,Installer runs outside macOS or supported Linux,REA supports macO
```

**File**: `docs/windows-ghidra-p0.md` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@ mutable targets require separate acceptance.
 Once the required native controls are implemented, the intended P0 is limited to:
 
 - a Windows x64 host;
-- Node.js 22.19+ or 24.11+;
+- Node.js 22.x (>=22.19), 24.x (>=24.11), or 26+;
 - an operator-installed official Ghidra 12.1.4 distribution;
 - a 64-bit full JDK 21;
 - an explicit native, non-managed, non-DLL x86-64 PE application; and
```

---

### Incident Patch 14: `19f8cddf` (2026-10-06)
**Commit Message**: fix(ghidra): preserve request and shutdown failure diagnostics (#647)

**File**: `docs/installation.md` (modified, +8/-0)
```diff
@@ -281,6 +281,14 @@ is no fixed per-operation or response-size ceiling. Unresolved computed calls
 remain unknown, reference-kind provenance is preserved, and provider-specific
 pseudocode is never treated as original source or Hopper-equivalent text.
 
+Unexpected request failures retain their original internal cause. CLI and MCP
+errors expose Error names, messages, and available codes under
+`details.diagnostics.failure_cause`; other rejection values retain their
+primitive value or an explicit type. Shutdown warnings include the failure
+kind, message, and diagnostics, while process and temporary-project cleanup
+continues. These messages redact known bridge authentication tokens and
+preserve local paths and other analysis context.
+
 Run `GHIDRA_INSTALL_DIR=... npm run verify:ghidra` from a source checkout to
 compile and analyze debug and stripped host-native fixtures (ELF on Linux x64
 or Mach-O on macOS), plus a native DWARF 4 type-layout object. This lane needs a
```

**File**: `src/ghidra/GhidraClient.ts` (modified, +27/-4)
```diff
@@ -76,6 +76,8 @@ export class GhidraClient {
   #runtimeRoot: PrivateRuntimeRoot | undefined;
   #snapshotPath: string | undefined;
   #token: string | undefined;
+  // Retain authentication identities for diagnostics from late request settlement.
+  readonly #authenticationTokens = new Set<string>();
   #runId: string | undefined;
   readonly #lineage = new ProviderRunLineage();
   #nextId = 1;
@@ -85,7 +87,10 @@ export class GhidraClient {
   #startupController: AbortController | undefined;
   #startPromise: Promise<GhidraStartResult> | undefined;
   #closePromise: Promise<void> | undefined;
-  readonly #failure = bindGhidraSessionFailure(() => this.#diagnostics());
+  readonly #failure = bindGhidraSessionFailure(
+    () => this.#diagnostics(),
+    (value) => this.#redactAuthentication(value),
+  );
   readonly #wire: GhidraWire;
   readonly #requestQueue: GhidraRequestQueue;
   readonly #responseRouter = new GhidraResponseRouter({
@@ -287,6 +292,7 @@ export class GhidraClient {
     }
     if (deadline.signal.aborted) return this.#startupInterrupted(deadline);
     this.#token = randomBytes(32).toString("hex");
+    this.#authenticationTokens.add(this.#token);
     this.#lineage.reset();
     this.#runId = this.#options.runId ?? randomUUID();
     const launched = await this.#options.launcher
@@ -419,12 +425,23 @@ export class GhidraClient {
       if (!forceStop && socket !== undefined && !socket.destroyed) {
         const shutdown = await this.#wire
           .request("shutdown", {}, { timeoutMs: SHUTDOWN_TIMEOUT_MS })
-          .catch(() =>
-            err(this.#failure("process", "Ghidra shutdown request failed")),
+          .catch((cause: unknown) =>
+            err(
+              this.#failure("process", "Ghidra shutdown request failed", cause),
+            ),
           );
         if (!shutdown.ok || !isGhidraShutdownAcknowledgement(shutdown.value))
           this.#logger.warn(
-            { status: shutdown.ok ? "invalid-acknowledgement" : "failed" },
+            {
+              status: shutdown.ok ? "invalid-acknowledgement" : "failed",
+              ...(shutdown.ok
+                ? {}
+                : {
+                    kind: shutdown.error.kind,
+                    message: shutdown.error.message,
+                    diagnostics: shutdown.error.diagnostics,
+                  }),
+            },
             "Ghidra bridge shutdown was not confirmed",
           );
       }
@@ -480,6 +497,12 @@ export class GhidraClient {
     }
   }
 
+  #redactAuthentication(value: string): string {
+    for (const token of this.#authenticationTokens)
+      value = value.replaceAll(token, "[REDACTED]");
+    return value;
+  }
+
   #onProcessDiagnostic(event: ProviderProcessDiagnostic): void {
     if (event.type === "output") {
       this.#options.onDiagnostic?.({
```

**File**: `src/ghidra/GhidraRequestQueue.test.ts` (added, +92/-0)
```diff
@@ -0,0 +1,92 @@
+import { describe, expect, it } from "vitest";
+
+import { err, ok } from "../domain/result.js";
+import { GhidraRequestQueue } from "./GhidraRequestQueue.js";
+import { bindGhidraSessionFailure } from "./GhidraSessionError.js";
+
+const failure = bindGhidraSessionFailure(() => ({
+  target_path: "/tmp/queue-fixture",
+}));
+
+describe("Ghidra request queue failure settlement", () => {
+  it.each([new TypeError("Decoder rejected"), "decoder rejected", null])(
+    "preserves a rejected executor cause (%j) and drains the next request",
+    async (cause) => {
+      const executed: string[] = [];
+      const queue = new GhidraRequestQueue(
+        async (method) => {
+          executed.push(method);
+          if (method === "first") throw cause;
+          return ok({ method });
+        },
+        failure,
+        () => Promise.resolve(),
+      );
+      const first = queue.run("first", {}, {});
+      const second = queue.run("second", {}, {});
+      const result = await first;
+      expect(result).toMatchObject({
+        ok: false,
+        error: {
+          kind: "protocol",
+          message: "Ghidra serial request execution rejected unexpectedly",
+          diagnostics: { target_path: "/tmp/queue-fixture" },
+        },
+      });
+      if (result.ok) throw new Error("Expected queue failure");
+      expect(result.error.cause).toBe(cause);
+      expect(result.error.diagnostics).toHaveProperty("failure_cause");
+      await expect(second).resolves.toEqual(ok({ method: "second" }));
+      expect(executed).toEqual(["first", "second"]);
+    },
+  );
+
+  it("does not replace an executor's typed failure", async () => {
+    const original = failure("timeout", "Request deadline elapsed");
+    const queue = new GhidraRequestQueue(
+      () => Promise.resolve(err(original)),
+      failure,
+      () => Promise.resolve(),
+    );
+    const result = await queue.run("first", {}, {});
+    expect(result).toEqual(err(original));
+    if (!result.ok) expect(result.error).toBe(original);
+  });
+
+  it("preserves cancellation cleanup failures and rejects queued work", async () => {
+    const controller = new AbortController();
+    const cause = new Error("Runtime removal failed");
+    let release: (() => void) | undefined;
+    const completed = new Promise<void>((resolve) => {
+      release = resolve;
+    });
+    const queue = new GhidraRequestQueue(
+      async () => {
+        await completed;
+        return err(failure("cancelled", "Request cancelled"));
+      },
+      failure,
+      async () => {
+        throw cause;
+      },
+    );
+    const active = queue.run("active", {}, { signal: controller.signal });
+    const queued = queue.run("queued", {}, {});
+    controller.abort();
+    release?.();
+    const result = await active;
+    expect(result).toMatchObject({
+      ok: false,
+      error: {
+        kind: "process",
+        diagnostics: { failure_cause: { message: cause.message } },
+      },
+    });
+    if (result.ok) throw new Error("Expected cleanup failure");
+    expect(result.error.cause).toBe(cause);
+    await expect(queued).resolves.toMatchObject({
+      ok: false,
+      error: { kind: "process" },
+    });
+  });
+});
```

**File**: `src/ghidra/GhidraRequestQueue.ts` (modified, +2/-1)
```diff
@@ -148,13 +148,14 @@ export class GhidraRequestQueue {
         executionSettled = true;
         entry.resolve(result);
       })
-      .catch(() => {
+      .catch((cause: unknown) => {
         executionSettled = true;
         entry.resolve(
           err(
             this.failure(
               "protocol",
               "Ghidra serial request execution rejected unexpectedly",
+              cause,
             ),
           ),
         );
```

**File**: `src/ghidra/GhidraSessionError.test.ts` (added, +81/-0)
```diff
@@ -0,0 +1,81 @@
+import { describe, expect, it } from "vitest";
+
+import { bindGhidraSessionFailure } from "./GhidraSessionError.js";
+
+const diagnostics = {
+  target_path: "/tmp/public-fixture",
+  target_sha256: "a".repeat(64),
+};
+
+describe("Ghidra session failure diagnostics", () => {
+  it("retains the original Error while projecting its name, message and code", () => {
+    const cause = Object.assign(
+      new TypeError("Cannot decode /tmp/public-fixture at offset 17"),
+      { code: "EDECODE" },
+    );
+    const failure = bindGhidraSessionFailure(() => diagnostics)(
+      "protocol",
+      "Request rejected",
+      cause,
+    );
+    expect(failure.cause).toBe(cause);
+    expect(failure.kind).toBe("protocol");
+    expect(failure.diagnostics).toEqual({
+      ...diagnostics,
+      failure_cause: {
+        name: "TypeError",
+        message: cause.message,
+        code: "EDECODE",
+      },
+    });
+    expect(failure.diagnostics).not.toHaveProperty("stack");
+  });
+
+  it.each([
+    ["decoder rejected", { type: "string", message: "decoder rejected" }],
+    [null, { type: "null", value: null }],
+    [false, { type: "boolean", value: false }],
+    [42, { type: "number", value: 42 }],
+    [{ opaque: true }, { type: "object" }],
+  ])("handles a non-Error rejection (%j)", (cause, expected) => {
+    const failure = bindGhidraSessionFailure(() => diagnostics)(
+      "process",
+      "Shutdown rejected",
+      cause,
+    );
+    expect(failure.cause).toBe(cause);
+    expect(failure.diagnostics.failure_cause).toEqual(expected);
+  });
+
+  it("redacts only known authentication material in projected failure fields", () => {
+    const token = "actual-bridge-authentication";
+    const message = `Failure ${token}: http://localhost/secret?token=public-value /tmp/password-fixture`;
+    const cause = Object.assign(new Error(message), { code: `code-${token}` });
+    const failure = bindGhidraSessionFailure(
+      () => diagnostics,
+      (value) => value.replaceAll(token, "[REDACTED]"),
+    )("remote", message, cause, { remoteCode: `code-${token}` });
+    expect(failure.cause).toBe(cause);
+    expect(failure.message).toBe(message.replaceAll(token, "[REDACTED]"));
+    expect(failure.diagnostics).toMatchObject({
+      remote_code: "code-[REDACTED]",
+      remote_message: failure.message,
+      failure_cause: { message: failure.message, code: "code-[REDACTED]" },
+    });
+    expect(JSON.stringify(failure.diagnostics)).not.toContain(token);
+    expect(JSON.stringify(failure.diagnostics)).toContain(
+      "token=public-value /tmp/password-fixture",
+    );
+  });
+
+  it("leaves absent causes and existing timeout metadata unchanged", () => {
+    const failure = bindGhidraSessionFailure(() => diagnostics)(
+      "timeout",
+      "Deadline elapsed",
+      undefined,
+      { timeoutMs: 5 },
+    );
+    expect(failure.timeoutMs).toBe(5);
+    expect(failure.diagnostics).toEqual(diagnostics);
+  });
+});
```

**File**: `src/ghidra/GhidraSessionError.ts` (modified, +39/-4)
```diff
@@ -44,6 +44,7 @@ const createGhidraSessionError = (failure: {
   readonly cause?: unknown;
   readonly timeoutMs?: number;
   readonly remoteCode?: string;
+  readonly redact: (value: string) => string;
 }): GhidraSessionError =>
   new GhidraSessionError(
     failure.kind,
@@ -52,7 +53,7 @@ const createGhidraSessionError = (failure: {
       ? failure.diagnostics
       : {
           ...failure.diagnostics,
-          remote_code: failure.remoteCode,
+          remote_code: failure.redact(failure.remoteCode),
           remote_message: failure.message,
         },
     {
@@ -68,7 +69,10 @@ const createGhidraSessionError = (failure: {
 
 /** Bind session-failure construction to a live, token-redacted diagnostic view. */
 export const bindGhidraSessionFailure =
-  (diagnostics: () => Readonly<Record<string, JsonValue>>) =>
+  (
+    diagnostics: () => Readonly<Record<string, JsonValue>>,
+    redact: (value: string) => string = (value) => value,
+  ) =>
   (
     kind: GhidraSessionFailureKind,
     message: string,
@@ -77,8 +81,39 @@ export const bindGhidraSessionFailure =
   ): GhidraSessionError =>
     createGhidraSessionError({
       kind,
-      message,
-      diagnostics: diagnostics(),
+      message: redact(message),
+      diagnostics: {
+        ...diagnostics(),
+        ...(cause === undefined
+          ? {}
+          : { failure_cause: describeCause(cause, redact) }),
+      },
+      redact,
       ...(cause === undefined ? {} : { cause }),
       ...options,
     });
+
+const describeCause = (
+  cause: unknown,
+  redact: (value: string) => string,
+): JsonValue => {
+  if (cause instanceof Error) {
+    const code = "code" in cause ? cause.code : undefined;
+    return {
+      name: redact(cause.name),
+      message: redact(cause.message),
+      ...(typeof code === "string"
+        ? { code: redact(code) }
+        : typeof code === "number" && Number.isFinite(code)
+          ? { code }
+          : {}),
+    };
+  }
+  if (typeof cause === "string")
+    return { type: "string", message: redact(cause) };
+  if (cause === null || typeof cause === "boolean")
+    return { type: cause === null ? "null" : "boolean", value: cause };
+  if (typeof cause === "number" && Number.isFinite(cause))
+    return { type: "number", value: cause };
+  return { type: typeof cause };
+};
```

**File**: `tests/boundary/mcp/ghidraFailureDiagnostics.test.ts` (added, +79/-0)
```diff
@@ -0,0 +1,79 @@
+import { expect, it } from "vitest";
+
+import { logCliCommand } from "../../../src/cliLogging.js";
+import { analysisErrorProjectionSchema } from "../../../src/contracts/errorSchemas.js";
+import { GhidraRequestQueue } from "../../../src/ghidra/GhidraRequestQueue.js";
+import { bindGhidraSessionFailure } from "../../../src/ghidra/GhidraSessionError.js";
+import { silentLogger } from "../../../src/logger.js";
+import { connectGhidraMcp } from "./ghidraMcpHarness.js";
+
+it("preserves queue failure diagnostics through the provider, CLI adapter and SDK MCP transport", async () => {
+  const token = "fixture-authentication-token";
+  const cause = Object.assign(
+    new TypeError(
+      `Decode failed ${token}: /tmp/password-fixture http://localhost/secret?token=public-value`,
+    ),
+    { code: "EDECODE" },
+  );
+  const failure = bindGhidraSessionFailure(
+    () => ({
+      target_path: "/tmp/public-fixture",
+      target_sha256: "a".repeat(64),
+    }),
+    (value) => value.replaceAll(token, "[REDACTED]"),
+  );
+  const queue = new GhidraRequestQueue(
+    async () => {
+      throw cause;
+    },
+    failure,
+    () => Promise.resolve(),
+  );
+  const harness = await connectGhidraMcp(
+    "ghidra-failure-diagnostics",
+    (operation, input, options) => queue.run(operation, input, options ?? {}),
+  );
+  const previousExitCode = process.exitCode;
+  try {
+    const cli = await logCliCommand(silentLogger, "inspect", async () => {
+      const result = await harness.session.execute("list_procedures", {
+        document: null,
+      });
+      if (!result.ok) throw result.error;
+      return result.value.result;
+    });
+    expect(process.exitCode).toBe(1);
+    const parsed = analysisErrorProjectionSchema.parse(cli);
+    expect(parsed).toMatchObject({
+      code: "execution_failure",
+      details: {
+        diagnostics: {
+          target_path: "/tmp/public-fixture",
+          failure_cause: {
+            name: "TypeError",
+            code: "EDECODE",
+            message:
+              "Decode failed [REDACTED]: /tmp/password-fixture http://localhost/secret?token=public-value",
+          },
+        },
+      },
+    });
+    const mcp = await harness.mcp.callTool({
+      name: "list_procedures",
+      arguments: {},
+    });
+    expect(mcp.isError).toBe(true);
+    expect(mcp.structuredContent).toMatchObject({ error: parsed });
+    expect(mcp.content).toContainEqual(
+      expect.objectContaining({
+        type: "text",
+        text: expect.stringContaining("EDECODE"),
+      }),
+    );
+    expect(JSON.stringify(mcp)).not.toContain(token);
+    expect(JSON.stringify(mcp)).not.toContain(cause.stack);
+  } finally {
+    process.exitCode = previousExitCode;
+    await harness.close();
+  }
+}, 30_000);
```

**File**: `tests/boundary/mcp/ghidraMcpHarness.ts` (modified, +6/-2)
```diff
@@ -24,15 +24,19 @@ import {
 
 const INSTALL = "/opt/ghidra_12.1.4_PUBLIC";
 
-export const connectGhidraMcp = async (name: string) => {
+export const connectGhidraMcp = async (
+  name: string,
+  execute?: ReturnType<GhidraProviderClientFactory>["callTool"],
+) => {
   const calls: GhidraOperation[] = [];
   const factory: GhidraProviderClientFactory = (options) => ({
     start: () =>
       Promise.resolve(
         ok(sessionInfo(options.profileDigest, options.targetSha256)),
       ),
-    callTool: (operation, input) => {
+    callTool: (operation, input, options) => {
       calls.push(operation);
+      if (execute !== undefined) return execute(operation, input, options);
       return Promise.resolve(ok(resultFor(operation, input)));
     },
     close: () => Promise.resolve(),
```

---

### Incident Patch 15: `9f42495d` (2026-10-06)
**Commit Message**: fix(javascript): hash graph and evidence JSON incrementally (#646)

**File**: `docs/javascript-artifact-reconstruction.md` (modified, +17/-0)
```diff
@@ -52,6 +52,23 @@ manifest and graph commitments, JavaScript Application Graph, static
 Electron summary, reconstruction statistics, and explicit limitations. It does
 not require a live Hopper, Ghidra, browser, or Electron process.
 
+## Large results
+
+Graph and Evidence identifiers hash canonical JSON incrementally, without
+assembling a single string for the whole graph. The canonical bytes and existing
+identifiers remain unchanged. The opt-in regression check is
+`npm run verify:javascript:digests`;
+it hashes a value larger than the running Node engine's single-string limit.
+
+Output formatters and MCP transport serialization still assemble whole strings.
+For a large CLI result, select the needed fields
+before formatting, for example `--format json --filter-output
+evidence_id,normalized_result.statistics`. Complete serialization of a result
+beyond the engine's string limit is not established by this digest check.
+Client framing limits also apply: the pinned Node MCP SDK's stdio transport
+defaults to a 10 MiB buffer. Its caller-selected `maxBufferSize` must accommodate
+the complete response, including text and structured Evidence projections.
+
 ## What is reconstructed
 
 The projector reuses the content-addressed artifact inventory and safe artifact
```

**File**: `package.json` (modified, +1/-0)
```diff
@@ -128,6 +128,7 @@
     "verify:electron": "npm run build:cached && node scripts/verify-real-electron.mjs",
     "verify:inspector": "npm run build:cached && node scripts/verify-real-javascript-runtime-observation.mjs",
     "verify:javascript-runtime": "npm run build:cached && node scripts/verify-local-javascript-runtime.mjs",
+    "verify:javascript:digests": "npm run build:cached && node scripts/verify-large-javascript-digests.mjs",
     "verify:application-workflows": "npm run build:cached && node scripts/verify-local-application-workflows.mjs",
     "verify:managed": "npm run build:cached && node scripts/verify-managed-conformance.mjs",
     "verify:agent": "npm run build:cached && node scripts/verify-agent-experience.mjs",
```

**File**: `scripts/verify-large-javascript-digests.mjs` (added, +38/-0)
```diff
@@ -0,0 +1,38 @@
+#!/usr/bin/env node
+
+import assert from "node:assert/strict";
+import { constants } from "node:buffer";
+import { createHash } from "node:crypto";
+
+import { canonicalDigest } from "../dist/domain/comparisonSemantics.js";
+import { createEvidence, parseEvidence } from "../dist/domain/evidence.js";
+
+// This opt-in check crosses the actual engine string limit; keep it outside
+// routine source tests. Build first, then run this script with the local Node.
+const leaf = "x".repeat(1024 * 1024);
+const encodedLeaf = JSON.stringify(leaf);
+const count = Math.ceil(constants.MAX_STRING_LENGTH / encodedLeaf.length) + 1;
+const value = { payload: Array.from({ length: count }, () => leaf) };
+const expected = createHash("sha256");
+expected.update('{"payload":[');
+for (let index = 0; index < count; index += 1) {
+  if (index > 0) expected.update(",");
+  expected.update(encodedLeaf);
+}
+expected.update("]}");
+assert.equal(canonicalDigest(value), expected.digest("hex"));
+
+const evidence = createEvidence(
+  undefined,
+  { id: "large-json-fixture", name: "Large JSON fixture", version: "1" },
+  { operation: "inspect_fixture", parameters: {}, result: value },
+);
+assert.equal(parseEvidence(evidence).evidence_id, evidence.evidence_id);
+process.stdout.write(
+  `${JSON.stringify({
+    verified: true,
+    serialized_value_bytes: count * encodedLeaf.length + count - 1 + 14,
+    engine_string_limit: constants.MAX_STRING_LENGTH,
+    evidence_id: evidence.evidence_id,
+  })}\n`,
+);
```

**File**: `src/application/JavaScriptApplicationService.test.ts` (added, +87/-0)
```diff
@@ -0,0 +1,87 @@
+import { writeFile } from "node:fs/promises";
+import { join } from "node:path";
+
+import { describe, expect, it } from "vitest";
+
+import { createTestTempDirectory } from "../../tests/fixtures/temporaryDirectory.js";
+import { projectAnalysisError } from "../domain/analysisErrorProjection.js";
+import { analyzeJavaScriptApplication } from "./JavaScriptApplicationService.js";
+
+describe("JavaScript application failure diagnostics", () => {
+  it("retains unexpected failures and their input identity in caller-visible diagnostics", async () => {
+    const inputPath = await createTestTempDirectory("rea-js-failure-");
+    await writeFile(join(inputPath, "main.js"), "export const value = 1;\n");
+    const cause = new RangeError("Invalid string length");
+    const result = await analyzeJavaScriptApplication(
+      { input_path: inputPath, format: "directory" },
+      {
+        progress: {
+          report: async (event) => {
+            if (event.terminal) throw cause;
+          },
+        },
+      },
+    );
+    expect(result.ok).toBe(false);
+    if (result.ok) throw new Error("Expected analysis failure");
+    expect(result.error.cause).toBe(cause);
+    expect(projectAnalysisError(result.error)).toMatchObject({
+      code: "execution_failure",
+      details: {
+        provider_id: "rea-javascript-application",
+        operation: "analyze_javascript_application",
+        diagnostics: {
+          input_path: inputPath,
+          error_name: "RangeError",
+          error_message: "Invalid string length",
+        },
+      },
+    });
+  });
+
+  it("keeps filesystem failures distinct from engine failures", async () => {
+    const root = await createTestTempDirectory("rea-js-missing-");
+    const result = await analyzeJavaScriptApplication({
+      input_path: join(root, "missing"),
+      format: "directory",
+    });
+    expect(result.ok).toBe(false);
+    if (result.ok) throw new Error("Expected missing artifact failure");
+    expect(projectAnalysisError(result.error)).toMatchObject({
+      code: "artifact_operation_failed",
+      details: { operation: "analyze_javascript_application", reason: "io" },
+    });
+  });
+
+  it.each(["reported failure", null])(
+    "retains non-Error failures (%s)",
+    async (cause) => {
+      const inputPath = await createTestTempDirectory("rea-js-non-error-");
+      await writeFile(join(inputPath, "main.js"), "export const value = 1;\n");
+      const result = await analyzeJavaScriptApplication(
+        { input_path: inputPath, format: "directory" },
+        {
+          progress: {
+            report: async (event) => {
+              if (event.terminal) throw cause;
+            },
+          },
+        },
+      );
+      expect(result.ok).toBe(false);
+      if (result.ok) throw new Error("Expected analysis failure");
+      expect(projectAnalysisError(result.error)).toMatchObject({
+        code: "execution_failure",
+        details: {
+          diagnostics: {
+            error_name: "UnknownError",
+            error_message:
+              typeof cause === "string"
+                ? cause
+                : "JavaScript analysis failed with a non-Error value",
+          },
+        },
+      });
+    },
+  );
+});
```

**File**: `src/application/JavaScriptApplicationService.ts` (modified, +39/-1)
```diff
@@ -14,9 +14,11 @@ import { type AnalysisError } from "../domain/analysisErrorBase.js";
 import type { Evidence } from "../domain/evidence.js";
 import { projectInputIssues } from "../domain/inputIssueProjection.js";
 import { err, ok, type Result } from "../domain/result.js";
+import { ProviderAdapterError } from "../domain/providerAdapterError.js";
 import type { ExecutionOptions } from "./AnalysisProvider.js";
 import { createJavaScriptApplicationEvidence } from "./JavaScriptApplicationEvidence.js";
 import { reconstructJavaScriptArtifact } from "./JavaScriptArtifactReconstruction.js";
+import { JAVASCRIPT_APPLICATION_PROVIDER } from "./InvestigationProviders.js";
 
 const OPERATION = "analyze_javascript_application" as const;
 
@@ -82,6 +84,42 @@ export const analyzeJavaScriptApplicationValidated = async (
           { cause },
         ),
       );
-    return err(new ArtifactOperationError(OPERATION, "io"));
+    if (
+      cause instanceof Error &&
+      "code" in cause &&
+      typeof cause.code === "string" &&
+      FILESYSTEM_ERROR_CODES.has(cause.code)
+    )
+      return err(new ArtifactOperationError(OPERATION, "io"));
+    return err(
+      new ProviderAdapterError(JAVASCRIPT_APPLICATION_PROVIDER.id, OPERATION, {
+        cause,
+        diagnostics: {
+          input_path: input.input_path,
+          error_name: cause instanceof Error ? cause.name : "UnknownError",
+          error_message:
+            cause instanceof Error
+              ? cause.message
+              : typeof cause === "string"
+                ? cause
+                : "JavaScript analysis failed with a non-Error value",
+        },
+      }),
+    );
   }
 };
+
+const FILESYSTEM_ERROR_CODES = new Set([
+  "ENOENT",
+  "EACCES",
+  "EPERM",
+  "ENOTDIR",
+  "EISDIR",
+  "EIO",
+  "ELOOP",
+  "ENAMETOOLONG",
+  "EMFILE",
+  "ENFILE",
+  "ENOSPC",
+  "EROFS",
+]);
```

**File**: `src/domain/canonicalDigest.test.ts` (added, +83/-0)
```diff
@@ -0,0 +1,83 @@
+import { createHash } from "node:crypto";
+
+import { fc, it } from "@fast-check/vitest";
+import canonicalize from "canonicalize";
+import { describe, expect } from "vitest";
+
+import { digestCanonicalValue } from "./canonicalDigest.js";
+
+const legacyDigest = (value: unknown): string => {
+  const encoded = canonicalize(value);
+  if (encoded === undefined) throw new TypeError("Unserializable fixture");
+  return createHash("sha256").update(encoded).digest("hex");
+};
+
+describe("incremental canonical digest", () => {
+  it.prop([fc.jsonValue()])(
+    "preserves canonicalize digests for JSON values",
+    (value) => {
+      expect(digestCanonicalValue(value)).toBe(legacyDigest(value));
+    },
+  );
+
+  it("preserves Unicode ordering, escaping, numeric forms and non-JSON normalization", () => {
+    const shared = { key: "value" };
+    const sparse: unknown[] = [undefined, Symbol("omit"), () => undefined];
+    sparse.length = 6;
+    const fixtures: unknown[] = [
+      {
+        "€": "\ud800",
+        "😀": "\udc00",
+        "\r": '\n\t"\\',
+        number: -0,
+        exponent: 1e30,
+      },
+      { omitted: undefined, symbol: Symbol("omit"), fn: () => undefined },
+      sparse,
+      [shared, shared],
+      new Date("2026-10-06T00:00:00Z"),
+      { toJSON: () => ({ b: 2, a: [1, null] }) },
+      { nested: { toJSON: () => undefined } },
+    ];
+    for (const value of fixtures)
+      expect(digestCanonicalValue(value)).toBe(legacyDigest(value));
+  });
+
+  it("rejects unsupported roots, non-finite numbers, BigInt and ancestor cycles", () => {
+    for (const value of [undefined, Symbol("root"), () => undefined])
+      expect(() => digestCanonicalValue(value, "Fixture")).toThrow(
+        "Fixture could not canonicalize data",
+      );
+    const cyclic: Record<string, unknown> = {};
+    cyclic.self = cyclic;
+    const recursiveJson = { toJSON: (): unknown => recursiveJson };
+    for (const value of [NaN, Infinity, -Infinity, 1n, cyclic, recursiveJson])
+      expect(() => digestCanonicalValue(value)).toThrow();
+  });
+
+  it("hashes repeated large leaves with the same byte sequence", () => {
+    const value = {
+      payload: Array.from({ length: 64 }, () => "x".repeat(16_384)),
+    };
+    expect(digestCanonicalValue(value)).toBe(legacyDigest(value));
+  });
+
+  it("preserves canonicalize property access and toJSON cycle behavior", () => {
+    const createAccessor = () => {
+      let reads = 0;
+      return {
+        get value() {
+          reads += 1;
+          return reads;
+        },
+      };
+    };
+    expect(digestCanonicalValue(createAccessor())).toBe(
+      legacyDigest(createAccessor()),
+    );
+    const shared = { toJSON: () => ({ answer: 42 }) };
+    expect(digestCanonicalValue([shared, shared])).toBe(
+      legacyDigest([shared, shared]),
+    );
+  });
+});
```

**File**: `src/domain/canonicalDigest.ts` (added, +75/-0)
```diff
@@ -0,0 +1,75 @@
+import { createHash } from "node:crypto";
+
+/** Hash canonicalize-compatible JSON without assembling an aggregate string. */
+export const digestCanonicalValue = (
+  value: unknown,
+  context = "Comparison",
+): string => {
+  const hash = createHash("sha256");
+  const encoded = emitCanonical(value, (part) => hash.update(part), new Set());
+  if (!encoded) throw new TypeError(`${context} could not canonicalize data`);
+  return hash.digest("hex");
+};
+
+type Emit = (part: string) => void;
+
+const emitCanonical = (
+  value: unknown,
+  emit: Emit,
+  ancestors: Set<object>,
+): boolean => {
+  if (typeof value === "number" && !Number.isFinite(value))
+    throw new Error(
+      Number.isNaN(value) ? "NaN is not allowed" : "Infinity is not allowed",
+    );
+  if (value === null || typeof value !== "object") {
+    const encoded = JSON.stringify(value);
+    if (encoded === undefined) return false;
+    emit(encoded);
+    return true;
+  }
+  if (ancestors.has(value)) throw new Error("Circular reference detected");
+  ancestors.add(value);
+  try {
+    if ("toJSON" in value && typeof value.toJSON === "function") {
+      const normalized: unknown = value.toJSON();
+      return emitCanonical(normalized, emit, ancestors);
+    }
+    if (Array.isArray(value)) {
+      emit("[");
+      const length = value.length;
+      for (let index = 0; index < length; index += 1) {
+        if (index > 0) emit(",");
+        // Preserve canonicalize's sparse-array and unsupported-value behavior.
+        if (!(index in value)) continue;
+        const item: unknown = value[index];
+        emitCanonical(
+          item === undefined || typeof item === "symbol" ? null : item,
+          emit,
+          ancestors,
+        );
+      }
+      emit("]");
+    } else {
+      emit("{");
+      let first = true;
+      for (const key of Object.keys(value).sort()) {
+        if (
+          Reflect.get(value, key) === undefined ||
+          typeof Reflect.get(value, key) === "symbol"
+        )
+          continue;
+        const item: unknown = Reflect.get(value, key);
+        if (!first) emit(",");
+        first = false;
+        emit(JSON.stringify(key));
+        emit(":");
+        if (!emitCanonical(item, emit, ancestors)) emit("undefined");
+      }
+      emit("}");
+    }
+    return true;
+  } finally {
+    ancestors.delete(value);
+  }
+};
```

**File**: `src/domain/comparisonSemantics.ts` (modified, +3/-5)
```diff
@@ -1,7 +1,7 @@
-import { createHash } from "node:crypto";
-
 import canonicalize from "canonicalize";
 
+import { digestCanonicalValue } from "./canonicalDigest.js";
+
 /** Whether an inventory can support a claim that an item is absent. */
 export const absenceClaimable = (coverage: {
   readonly status: string;
@@ -17,9 +17,7 @@ export const canonicalDigest = (
   value: unknown,
   context = "Comparison",
 ): string => {
-  return createHash("sha256")
-    .update(canonicalJson(value, context))
-    .digest("hex");
+  return digestCanonicalValue(value, context);
 };
 
 /** Canonical JSON used for deterministic tie breaking and stable digests. */
```

#### Recent Merged Pull Requests:
- **PR #683** (2026-10-06): docs: add the official Trendshift badge to README headers (@N0zoM1z0)
- **PR #682** (2026-10-06): fix(cli): disable unmanaged skill synchronization (@kaoru0822-kitauji)
- **PR #664** (2026-10-06): docs: align MCP discovery and skill guidance with the stable catalog (@N0zoM1z0)
- **PR #663** (2026-10-06): fix(javascript): scope candidate ambiguity to query traversal (@kaoru0822-kitauji)
- **PR #662** (2026-10-06): test(hopper): synchronize startup cancellation with launcher readiness (@N0zoM1z0)
- **PR #659** (2026-10-06): fix(comparison): break function collection collation ties (@kaoru0822-kitauji)
- **PR #658** (2026-10-06): docs(installation): pin manual MCP registration to the release version (@kaoru0822-kitauji)
- **PR #657** (2026-10-06): fix(reference): retain dynamic import relationships (@kaoru0822-kitauji)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
