# Forensic Learning Record (Deep Inspection): mvschwarz/openrig

> **Canonical Artifact**: `07_PROJECT_LEARNING/mvschwarz-openrig-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/mvschwarz/openrig](https://github.com/mvschwarz/openrig))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:07:10.917Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `mvschwarz/openrig`
- **Description**: Build your own network of agents from Claude Code, Codex and Pi: persistent teams with roles, shared context and owned work.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 5285 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/cli/src/commands/project-worker.ts`
```
import { createHash } from "node:crypto";
import fs from "node:fs";
import { parse } from "yaml";
import { StreamClassificationWorker, ClassifierLeaseError, ClassificationAttemptError, ProjectClassifierError,
  LABEL_FIELDS, type WorkerOptions, type ClassificationCandidates, type ClassificationDecision } from "@openrig/daemon/stream-classifier";
import type { DaemonClient } from "../client.js";

type Client = Pick<DaemonClient, "get" | "post">;
export interface WakeOptions { project: string; taxonomy: string; classifierVersion: string; evidenceEpoch: string; decisions?: string; limit?: string }
type SourceSnapshot = {
  occupant: { session: string; nodeId: string; generation: string; rigId: string };
  version: string; observedAt: string; unavailable: string[];
  sources: { project: unknown; scopes: {id: string; source: string; hash: string}[];
    roster: {session: string; nodeId: string; generation: string}[];
    recent: {streamItemId: string; body: string; evidenceRef: string}[] };
};
const hash = (text: string) => `sha256:${createHash("sha256").update(text).digest("hex")}`;
function localText(file: string): string {
  if (fs.statSync(file).size > 1024 * 1024) throw Error("worker input exceeds 1 MiB");
  const text = fs.readFileSync(file, "utf8");
  if (Buffer.byteLength(text) > 1024 * 1024) throw Error("worker input exceeds 1 MiB");
  return text;
}
function response<T>(r: {status: number; data: T}): T {
  if (r.status < 400) return r.data;
  const body = r.data as {error?: string; message?: string};
  const code = body?.error ?? "http_error", message = body?.message ?? code;
  if (code.startsWith("lease_") || ["no_active_lease", "occupant_changed", "occupant_unavailable"].includes(code)) throw new ClassifierLeaseError(code, message);
  if (code.startsWith("attempt_") || code === "already_classified") throw new ClassificationAttemptError(code, message);
  if (code === "idempotency_violation") throw new ProjectClassifierError(code, message);
  throw Error(`${code}: ${message}`);
}

export async function prepareWorker(client: Client, opts: WakeOptions, read = localText) {
  const limit = Number(opts.limit ?? 20);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw Error("limit must be an integer in 1..100");
  const text = read(opts.taxonomy), taxonomy = parse(text);
  if (!taxonomy || typeof taxonomy.version !== "string" || !taxonomy.version.trim()) throw Error("taxonomy version is required");
  const snapshot = response(await client.get<SourceSnapshot>(`/api/projects/worker-sources?project=${encodeURIComponent(opts.project)}`));
  const occupant = snapshot.occupant;
  if (!occupant?.session || !occupant.generation || !occupant.nodeId) throw Error("real classifier occupant unavailable");
  const values: ClassificationCandidates["values"] = {classificationType: [], classificationUrgency: [], classificationMaturity: [], classificationConfidence: [], classificationDestination: [], area: [], scopeRef: []};
  for (const [input, output] of [["kind","classificationType"],["urgency","classificationUrgency"],["maturity","classificationMaturity"],["area","area"]] as const) {
    const field = taxonomy.fields?.[input];
    if (typeof field?.question !== "string" || !field.values || Array.isArray(field.values) || typeof field.values !== "object") throw Error(`taxonomy ${input} question/values unavailable`);
    values[output] = Object.keys(field.values);
  }
  values.scopeRef = snapshot.sources.scopes.map(x => x.id);
  values.classificationDestination = [...snapshot.sources.roster.map(x => x.session), "pool"];
  const candidates: ClassificationCandidates = {
    version: hash(JSON.stringify({sourceVersion: snapshot.version, taxonomyHash: hash(text), values})), values,
    duplicateCandidates: snapshot.sources.recent.map(x => ({streamItemId: x.streamItemId, evidenceRef: x.evidenceRef})), relatedRefs: [],
  };
  const query = new URLSearchParams({classifierVersion: opts.classifierVersion, taxonomyVersion: taxonomy.version, evidenceEpoch: opts.evidenceEpoch, limit: opts.limit ?? "20", expectedOccupant: occupant.generation});
  const eligible = response(await client.get<{items: {streamItemId: string}[]; nextAfterSortKey: string | null}>(`/api/projects/eligible?${query}`));
  return {snapshot, candidates, taxonomy: {version: taxonomy.version, source: opts.taxonomy, hash: hash(text), questions: taxonomy.fields}, eligible};
}

/** The receiving entry for one occupant-owned bounded wake. No automatic registration. */
export async function runProjectWake(client: Client, opts: WakeOptions, read = localText, experiment?: {
  decide: (prepared: Awaited<ReturnType<typeof prepareWorker>>) => WorkerOptions["classify"];
  signal: AbortSignal; shouldStop: () => boolean; timeoutMs: number;
}) {
  const prepared = await prepareWorker(client, opts, read);
  const {snapshot, candidates, taxonomy} = prepared;
  const {session, generation} = snapshot.occupant;
  const suffix = (url: string) => `${url}${url.includes("?") ? "&" : "?"}expectedOccupant=${encodeURIComponent(generation)}`;
  const get = async <T>(url: string): Promise<T> => response(await client.get<T>(suffix(url)));
  const post = async <T>(url: string, body: unknown): Promise<T> => response(await client.post<T>(suffix(url), body));
  const packet = opts.decisions ? JSON.parse(read(opts.decisions)) as {
    candidateSetVersion: string; decisions: {streamItemId: string; bodyHash: string; decision: ClassificationDecision}[];
  } : null;
  if (packet && (!Array.isArray(packet.decisions) || packet.decisions.length > 100 || new Set(packet.decisions.map(x => x.streamItemId)).size !== packet.decisions.length)) throw Error("decisions must contain at most 100 unique stream item IDs");
  if (!experiment && (!packet || packet.candidateSetVersion !== candidates.version)) throw Error("fresh decisions bound to this candidateSetVersion are required; no attempts started");
  if (experiment && packet) throw Error("choose one source of decisions");
  const worker = new StreamClassificationWorker({
    session, classifierVersion: opts.classifierVersion, taxonomyVersion: taxonomy.version, evidenceEpoch: opts.evidenceEpoch,
    candidates, pageSize: Number(opts.limit ?? 20),
    ...(experiment ? {signal: experiment.signal, shouldStop: experiment.shouldStop, requestTimeoutMs: experiment.timeoutMs} : {}),
    leases: {
      evaluateDeadness: () => null, // acquire uses the existing evaluated-acquire transaction path.
      acquire: actor => post("/api/projects/lease/acquire", {classifierSession: actor, evaluateDeadnessFirst: true}),
      requireActiveHolder: (_actor, id) => get(`/api/projects/lease?expectedLeaseId=${encodeURIComponent(id ?? "")}`),
      heartbeat: (id, actor) => post("/api/projects/lease/heartbeat", {leaseId: id, classifierSession: actor}),
    },
    attempts: {
      eligible: input => get(`/api/projects/eligible?${new URLSearchParams(Object.entries(input).filter(([,v]) => v !== undefined).map(([k,v]): [string, string] => [k,String(v)]))}`),
      begin: input => post("/api/projects/attempts/begin", input),
      abstain: input => post(`/api/projects/attempts/${encodeURIComponent(input.attemptId)}/abstain`, input),
      fail: input => post(`/api/projects/attempts/${encodeURIComponent(input.attemptId)}/fail`, input),
    },
    classifier: {classify: input => post("/api/projects/project", input)},
    stream: {getById: id => get(`/api/stream/${encodeURIComponent(id)}`)},
    classify: experiment ? experiment.decide(prepared) : async request => {
      if (snapshot.unavailable.length) return {kind: "abstain", reason: `candidate sources unavailable: ${snapshot.unavailable.join("; ")}`};
      if (!packet || packet.candidateSetVersion !== candidates.version) return {kind: "abstain", reason: "decisions unavailable for this candidate snapshot"};
      const selected = packet.decisions.find(x => x.streamItemId === request.item.streamItemId && x.bodyHash === hash(request.item.body));
      if (!selected) return {kind: "abstain", reason: "decision unavailable for exact stream item bytes"};
      if (selected.decision?.kind === "classify") {
        const labels = selected.decision.labels;
        if (!labels || LABEL_FIELDS.some(field => labels[field] != null && !candidates.values[field].includes(labels[field]!))) return {kind: "abstain", reason: "selected label candidate unavailable"};
        if (labels.duplicateOfStreamItemId != null && !candidates.duplicateCandidates.some(x => x.streamItemId === labels.duplicateOfStreamItemId && x.evidenceRef === labels.duplicateEvidenceRef)) return {kind: "abstain", reason: "positive duplicate evidence unavailable"};
      }
      return selected.decision;
    },
  } satisfies WorkerOptions);
  const result = await worker.wake();
  // Descriptor only. A message requests this entry; it never executes a wake by itself.
  let wakeRequest: unknown = null;
  // A copied argument vector, never an interpolated shell command. The occupant still owns judgment.
  const nextCommand = ["rig", "project", "candidates", "--project", opts.project, "--taxonomy", opts.taxonomy,
    "--classifier-version", opts.classifierVersion, "--evidence-epoch", opts.evidenceEpoch, "--limit", opts.limit ?? "20", "--json"];
  try {
    if (experiment) return {occupant: snapshot.occupant, candidateSetVersion: candidates.version, evidenceEpoch: opts.evidenceEpoch,
      result, nextCommand: null, wakeRequest: null, registered: false, sourceSnapshot: snapshot,
      continuation: "Foreground experiment only; no automatic retry or wake registration. Inspect this result before another explicit run."};
    const descriptor = worker.wakeRegistration(session, generation);
    descriptor.specYaml = JSON.stringify({target: {session}, message: `Run ${JSON.stringify(nextCommand)} as an argument vector, read the exact eligible stream items with rig stream show, then supply source-bound decisions to rig project wake with these same options plus --decisions. One bounded wake only; 
```

### Core Architecture Module: `packages/cli/src/commands/queue.ts`
```
import fs from "node:fs";
import { randomBytes } from "node:crypto";
import { Command } from "commander";
import { DaemonClient, DaemonConnectionError, DaemonTimeoutError, DaemonResponseError } from "../client.js";
import { getDaemonStatus, getDaemonUrl , daemonStatusGuard} from "../daemon-lifecycle.js";
import { readOpenRigEnv } from "../openrig-compat.js";
import { sessionRigOf, isHumanSeatSessionRef } from "../session-name.js";
import { realDeps } from "./daemon.js";
import { enumArg, positiveIntArg } from "../cli-error.js";
import type { StatusDeps } from "./status.js";
import { resolveContextRef } from "../context-resolve.js";
import { shellQuote } from "../cross-host-executor.js";
import { omittedReadField, readView } from "../read-view.js";

/**
 * `rig queue` — coordination primitive L3/inbox/outbox commands (PL-004 Phase A).
 *
 * Backed by `/api/queue`. Operates only via the daemon HTTP API.
 * Does NOT touch the POC `rigx-queue-proto` filesystem state.
 *
 * Hot-potato strict-rejection is enforced at the daemon; `update --state done`
 * without `--closure-reason` returns exit 1 with structured error naming the
 * 6 valid closure reasons.
 */

export interface DeliveryVerifyDeps {
  timeoutMs?: number;
  intervalMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

export interface QueueDeps extends StatusDeps {
  deliveryVerify?: DeliveryVerifyDeps;
}

export interface VerifiedDeliveryResult {
  outcome: "posted" | "transport-failed" | "never-posted" | "still-pending" | "indeterminate";
  /** null means no receipt can presently settle connector acceptance. */
  connectorAccepted: boolean | null;
  /** A connector receipt can never prove that a person read the message. */
  humanReadership: "unknown";
  /** #96: present for a --reply-to update once posted; false = it posted top-level instead. */
  threaded?: boolean;
  detail?: string;
  nextAction: string | null;
}

export async function waitForDeliveryOutcome(
  client: Pick<DaemonClient, "get">,
  qitemId: string,
  deps: DeliveryVerifyDeps = {},
): Promise<VerifiedDeliveryResult> {
  const timeoutMs = deps.timeoutMs ?? 30_000;
  const intervalMs = deps.intervalMs ?? 500;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const now = deps.now ?? (() => Date.now());
  const started = now();
  for (;;) {
    try {
      const response = await client.get<Record<string, unknown>>(`/api/queue/${encodeURIComponent(qitemId)}`);
      if (response.status !== 200) throw new Error(`receipt lookup returned HTTP ${response.status}`);
      const outcome = response.data.deliveryOutcome;
      if (outcome === "posted") {
        // #96: a --reply-to update reports whether it joined the earlier item's thread.
        const replyTo = typeof response.data.replyTo === "string" ? response.data.replyTo : null;
        const fallback = typeof response.data.replyToFallback === "string" ? response.data.replyToFallback : null;
        return {
          outcome,
          connectorAccepted: true,
          humanReadership: "unknown",
          ...(replyTo ? { threaded: fallback === null } : {}),
          ...(replyTo && fallback ? { detail: `posted as a new top-level message, not in ${replyTo}'s thread: ${fallback}` } : {}),
          nextAction: null,
        };
      }
      if (outcome === "transport-failed" || outcome === "never-posted") {
        return {
          outcome,
          connectorAccepted: false,
          humanReadership: "unknown",
          detail: typeof response.data.deliveryFailureDetail === "string" ? response.data.deliveryFailureDetail : undefined,
          nextAction: `rig queue show ${qitemId} --json`,
        };
      }
    } catch (error) {
      return {
        outcome: "indeterminate",
        connectorAccepted: null,
        humanReadership: "unknown",
        detail: `delivery receipt could not be read: ${(error as Error).message}`,
        nextAction: `rig queue show ${qitemId} --json`,
      };
    }
    if (now() - started >= timeoutMs) {
      return {
        outcome: "still-pending",
        connectorAccepted: null,
        humanReadership: "unknown",
        detail: `no terminal connector receipt within ${timeoutMs}ms; the durable qitem remains intact`,
        nextAction: `rig queue show ${qitemId} --json`,
      };
    }
    await sleep(intervalMs);
  }
}

async function withClient<T>(
  deps: QueueDeps,
  fn: (client: DaemonClient) => Promise<T>,
  attemptWhenProbeUnconfirmed = false,
  // D14 — names the cross-host target in transport-failure output.
  hostContext?: string,
): Promise<T | undefined> {
  const status = await getDaemonStatus(deps.lifecycleDeps);
  // RULING 1ae863d2 — status is 3-state: hard-block ONLY on positive evidence
  // (stopped/stale). UNVERIFIED (timeout/wedged/wrong-home) proceeds to the
  // configured-target request as the authority — never a down assertion.
  const positiveDown = status.state === "stopped" || status.state === "stale";
  if (positiveDown || (status.state === "running" && status.healthy === false)) {
    if (!attemptWhenProbeUnconfirmed) {
      // B8-1b: the ONE epistemic-matched guard renders both branches.
      daemonStatusGuard(status);
      return undefined;
    }
  }
  if (status.state === "unverified" && status.siblingHint) {
    console.error(`note: OPENRIG_HOME may be wrong — resolved ${status.siblingHint.resolvedHome}, live sibling ${status.siblingHint.siblingHome}`);
  }
  const baseUrl = status.state === "running" && status.port !== undefined
    ? getDaemonUrl(status)
    : new DaemonClient().baseUrl;
  const client = deps.clientFactory(baseUrl);
  // D14 (accept-and-drop family #6): a THROWING transport must fail LOUD — the
  // classified error + host context on stderr, nonzero exit — never a silent exit.
  try {
    return await fn(client);
  } catch (err) {
    if (err instanceof DaemonConnectionError || err instanceof DaemonTimeoutError || err instanceof DaemonResponseError) {
      // D14 + B8 reconciliation (pre-existing main conflict, found at B8 A/B): the D14
      // context lines print here, then the typed error RETHROWS so the SHARED runProgram
      // render owns the 3-part fact/consequence/action + the io exit (response-integrity
      // contract). One render authority, layered context — never a swallowed exit.
      const where = hostContext ? ` (routing to host '${hostContext}')` : "";
      console.error(`queue transport failure${where}: ${err.message}`);
      console.error("The write outcome is INDETERMINATE if the request may have reached a daemon — reconcile by ID before any retry.");
    }
    throw err;
  }
}

function printResult(json: boolean, body: unknown, status: number): void {
  if (status >= 400 && body && typeof body === "object"
    && (body as { error?: unknown }).error === "remote_queue_write_failed"
    && (body as { outcome?: unknown }).outcome === "indeterminate") {
    console.error("The write outcome is INDETERMINATE if the request may have reached a daemon — reconcile by ID before any retry.");
  }
  if (json) {
    console.log(JSON.stringify(body));
  } else {
    console.log(JSON.stringify(body, null, 2));
  }
  if (status >= 400) process.exitCode = status >= 500 ? 2 : 1;
}

// Recovery belongs to the selected daemon's reply; never infer a host from an ID.
async function printQueueItemResult(
  client: DaemonClient,
  qitemId: string,
  json: boolean,
  body: unknown,
  status: number,
): Promise<void> {
  if (status >= 400 && body && typeof body === "object"
    && (body as { error?: unknown }).error === "qitem_not_found") {
    let selfHostId: string | undefined;
    try {
      const health = await client.get<{ selfHostId?: unknown }>("/healthz", { timeoutMs: 1_000 });
      if (health.status === 200 && typeof health.data?.selfHostId === "string" && health.data.selfHostId.trim()) {
        selfHostId = health.data.selfHostId;
      }
    } catch { /* Identity enrichment must not replace the original queue failure. */ }
    const daemon = selfHostId ? `daemon ${JSON.stringify(selfHostId)}` : "the selected daemon (host ID unavailable)";
    body = {
      ...body,
      hint: `Queue item ${JSON.stringify(qitemId)} was not found on ${daemon}.\n`
        + `If it came from another host, run rig host list; replace <daemon-url> with its registered daemon URL and run: OPENRIG_URL='<daemon-url>' rig queue show ${shellQuote(qitemId)} --full --json`,
    };
  }
  printResult(json, body, status);
}

// OPR.0.4.3.03 — `rig queue show` body preview.
//
// Default `show` renders a BOUNDED body preview instead of dumping the whole
// qitem body into the agent's context; `--full` opts back into the complete
// body. The bound is a CODE-POINT count (delivery-set, adjustable) per
// IMPL-SPEC §2.3-2.4.
const SHOW_BODY_PREVIEW_MAX_CODEPOINTS = 512;

function wakeDurationSeconds(value: string): number {
  const match = /^(\d+)(s|m|h)?$/i.exec(value.trim());
  if (!match) throw new Error("wake duration must be a positive integer with optional s, m, or h suffix");
  const amount = Number.parseInt(match[1]!, 10);
  const factor = match[2]?.toLowerCase() === "h" ? 3600 : match[2]?.toLowerCase() === "m" ? 60 : 1;
  const seconds = amount * factor;
  if (!Number.isSafeInteger(seconds) || seconds <= 0) throw new Error("wake duration must be positive");
  return seconds;
}

export interface BodyPreview {
  preview: string;
  bodyBytes: number;
  bodyTruncated: boolean;
}

// Multibyte-SAFE bounded preview (IMPL-SPEC §2.3-2.4). The preview is the first
// N CODE POINTS: `Array.from(body)` splits by code point (never a surrogate
// pair / multibyte char), so the slice is inherently multibyte-safe and never
// emits a partial/invalid UTF-8 sequence. `bodyTruncated` is CODE-POINT-count
// based (codePointCount > N). `bodyBytes` is the honest TRUE total UTF-8 byte
// length of the FULL body (never the truncated size).
export function previewBody(
  body: string,
  maxCode
```

### Core Architecture Module: `packages/cli/src/commands/workflow-render.ts`
```
/**
 * OPR.0.4.6.WF3 FR-2 — the glanceable human renderers for
 * trace/list/show. RENDER-SIDE ONLY (BR-2): these functions format
 * daemon payloads the CLI already receives; `--json` paths never come
 * through here and stay byte-identical to the shipped output.
 *
 * Shapes ported from in-repo precedent: the `rig ps` table mechanics
 * (fitCell/truncate) and the argo-get per-step tree bar (STEP / ACTOR
 * / EXIT / DURATION columns with status glyphs).
 *
 * Present-tolerant fields: WF-2's branch/gate additions
 * (closureEvidence.branch_taken etc.) render when the payload carries
 * them and leave no residue when absent — this module never requires
 * them (WF-3 builds against the pre-WF-2 tip; the fields land with
 * WF-2).
 */

import { shellQuote } from "../cross-host-executor.js";

export interface RenderInstance {
  guidance?: {lines: string[]};
  instanceId: string;
  workflowName?: string;
  workflowVersion?: string;
  status: string;
  createdBySession?: string;
  createdAt?: string;
  currentStepId?: string | null;
  currentFrontier?: string[];
  hopCount?: number;
  /** OPR.0.4.6.FAC1: the instance's bound rig (API-carried; null/absent = unbound, renders nothing). */
  boundRig?: string | null;
  /**
   * WF-1 FR-2's API-carried classification (present since the
   * completion fixback at 384e60f1). RAIL 1 (arch ruling): the CLI
   * CONSUMES this verbatim and never recomputes a threshold or class.
   */
  deadline?: {
    state: string;
    evidence?: {
      stepId?: string | null;
      ownerSession?: string;
      overdueBySeconds?: number;
      ageSeconds?: number;
    } | null;
  };
  /** Present on waiting instances that recorded their park decision. */
  lastContinuationDecision?: { blockedOn?: string | null } | null;
  /** S06: packet-addressed frontier facts are derived from the live queue row. */
  frontierPackets?: RenderFrontierPacket[];
  /** S06: unresolved branch failures remain visible even while siblings run. */
  failureOccurrences?: RenderFailureOccurrence[];
  /** Named broken joins; never collapse these to an apparently actionable row. */
  unknowns?: string[];
  exceptionObligations?: Array<{ qitemId: string; ownerSession: string; state: string; evidenceRef: string | null; inspectCommand: string }>;
  exceptionReadiness?: {
    selection: { state: string; role: string | null; source: string; entryRole: string | null };
    routes: Array<{ exceptionClass: string; state: string; roleResolution: string; destinationSession: string | null; position: string | null; resolvedVia: string | null; message: string }>;
    nextAction: string;
  } | null;
  reconciliation?: {
    status: string; adopted: boolean | null; boundDigest: string | null; proposedDigest: string | null;
    composition: { mode: string; explanation: string; boundSlices: string[]; executableSteps: unknown[] };
    changes: Array<{ kind: string; ref: string; fields?: string[] }>; reasons: string[];
    nextAction: string; applyCommand?: string; operationKey?: string;
  };
  lifecycleBinding?: { graphSource?: { mode?: string; profileSource?: string | null; missionSource?: string | null } } | null;
  boundaryObligations?: Array<{ stepId: string; required: boolean; state: string; receiptState: string;
    receipt: { evidenceRef: string; actorSession: string; closedAt: string } | null }>;

}

export interface RenderFrontierPacket {
  packetId: string;
  stepId: string | null;
  ownerSession: string | null;
  queueState: string | null;
  blockedOn: string | null;
  targetedAction: "project" | "route" | "indeterminate";
  dependsOn?: string[];
  receiptRequired?: boolean;
  acceptance?: {
    candidate: string;
    verdicts: string[];
    evidence_ref: string;
  } | null;
}

export interface RenderFailureOccurrence {
  occurrenceId: string;
  stepId: string;
  status: "unresolved" | "resolved";
  failureReason?: string | null;
  redrivePacketId?: string | null;
  targetedAction: "resume" | "none";
}

export interface RenderTrailRow {
  stepId: string;
  stepRole?: string;
  closedAt?: string;
  closureReason: string;
  closureEvidence?: Record<string, unknown> | null;
  actorSession: string;
  nextQitemId?: string | null;
  priorQitemId?: string;
}

/** One command-shaped owner action, including the typed acceptance contract when present. */
export function renderProjectAction(instanceId: string, packet: RenderFrontierPacket): string {
  const base = `rig workflow project --instance ${instanceId} --current-packet ${packet.packetId} --exit <handoff|waiting|done|failed> --actor-session ${packet.ownerSession ?? "<owner>"}${packet.receiptRequired ? " --evidence-ref <agent-judged-receipt>" : ""}`;
  if (!packet.acceptance) return base;
  const verdict = packet.acceptance.verdicts.length === 1
    ? packet.acceptance.verdicts[0]!
    : `<${packet.acceptance.verdicts.join("|")}>`;
  return `${base} --acceptance-candidate ${shellQuote(packet.acceptance.candidate)} --acceptance-verdict ${shellQuote(verdict)} --acceptance-evidence-ref ${shellQuote(packet.acceptance.evidence_ref)}`;
}

function actionableFailures(instance: RenderInstance): RenderFailureOccurrence[] {
  return (instance.failureOccurrences ?? []).filter(
    (failure) => failure.status === "unresolved" && failure.targetedAction === "resume",
  );
}

const STATUS_GLYPH: Record<string, string> = {
  completed: "✔",
  failed: "✖",
  active: "●",
  waiting: "◐",
  aborted: "■",
};

export function statusGlyph(status: string): string {
  return STATUS_GLYPH[status] ?? "●";
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function fitCell(value: string, width: number): string {
  return truncate(value, width).padEnd(width);
}

/** Compact human duration between two ISO timestamps ("3s", "4m", "2h", "5d"). */
export function humanDuration(fromIso: string | undefined, toIso: string | undefined): string {
  if (!fromIso || !toIso) return "";
  const ms = Date.parse(toIso) - Date.parse(fromIso);
  if (!Number.isFinite(ms) || ms < 0) return "";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  // Minutes render up to AND INCLUDING 120 so sub-/at-2h durations keep
  // their precision ("90m"/"120m" beat a rounded-up "2h" for judging
  // step latency). Guard prepass catch: `m < 120` excluded exactly 120.
  if (m <= 120) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

/** Instance age relative to a supplied "now" (injectable for tests). */
export function humanAge(createdAt: string | undefined, nowIso: string): string {
  return humanDuration(createdAt, nowIso);
}

/** Compact render of a plain seconds quantity (same scale rules). */
export function humanSeconds(seconds: number): string {
  return humanDuration("1970-01-01T00:00:00.000Z", new Date(seconds * 1000).toISOString());
}

/**
 * The trace tree (mini-req 2's bar: where it is + how it got there,
 * one screen, no JSON literacy required).
 */
export function renderTraceTree(
  instance: RenderInstance,
  trail: RenderTrailRow[],
  nowIso: string = new Date().toISOString(),
): string[] {
  const lines: string[] = [];
  const name = instance.workflowName ? `${instance.workflowName}${instance.workflowVersion ? ` v${instance.workflowVersion}` : ""}` : "";
  lines.push(`${statusGlyph(instance.status)} ${instance.instanceId}  ${name}  status=${instance.status}${instance.hopCount !== undefined ? `  hops=${instance.hopCount}` : ""}${instance.boundRig ? `  rig=${instance.boundRig}` : ""}`);
  if (instance.createdAt) {
    lines.push(`  created ${instance.createdAt}${instance.createdBySession ? ` by ${instance.createdBySession}` : ""}  age ${humanAge(instance.createdAt, nowIso)}`);
  }
  lines.push("");
  lines.push(`  ${fitCell("STEP", 22)}${fitCell("ACTOR", 28)}${fitCell("EXIT", 10)}DURATION`);
  let prevClosed = instance.createdAt;
  for (let i = 0; i < trail.length; i++) {
    const row = trail[i];
    if (!row) continue;
    const glyph = row.closureReason === "failed" ? "✖" : "✔";
    const bar = i === trail.length - 1 && !instance.currentStepId ? "└─" : "├─";
    const duration = humanDuration(prevClosed, row.closedAt);
    lines.push(`  ${bar} ${glyph} ${fitCell(row.stepId, 20)}${fitCell(row.actorSession, 28)}${fitCell(row.closureReason, 10)}${duration}`);
    const branchTaken = row.closureEvidence?.["branch_taken"];
    if (typeof branchTaken === "string" && branchTaken.length > 0) {
      lines.push(`  │    ↳ branch: ${branchTaken}`);
    }
    prevClosed = row.closedAt ?? prevClosed;
  }
  const packetRows = instance.frontierPackets ?? [];
  if (packetRows.length > 0) {
    for (let i = 0; i < packetRows.length; i++) {
      const packet = packetRows[i]!;
      const bar = i === packetRows.length - 1 ? "└─" : "├─";
      const step = packet.stepId ?? "INDETERMINATE";
      const owner = packet.ownerSession ?? "INDETERMINATE";
      const state = packet.queueState ?? "INDETERMINATE";
      lines.push(`  ${bar} ▸ ${fitCell(step, 20)}${fitCell(owner, 28)}${fitCell(state, 10)}packet=${packet.packetId}`);
      if (packet.blockedOn) lines.push(`  │    ↳ blocked on: ${packet.blockedOn}`);
    }
  } else if (instance.currentStepId) {
    const owner = ""; // frontier owner is a queue-side fact; the frontier packet ids are what the payload carries
    lines.push(`  └─ ▸ ${fitCell(instance.currentStepId, 20)}${fitCell(owner || "(current)", 28)}${fitCell("open", 10)}frontier=[${(instance.currentFrontier ?? []).join(", ")}]`);
  } else if (trail.length === 0) {
    lines.push(`  (no steps closed yet)`);
  }
  for (const failure of (instance.failureOccurrences ?? []).filter((item) => item.status === "unresolved")) {
    lines.push(`  ▲ failure ${failure.occurrenceId}  step=${failure.stepId}${failure.failureReason ? `  reason=${failure.failureReason}` : ""}`);
    lines.push(failure.targetedAction === "resume"
      ? `      action: rig workflow resume $
```

### Core Architecture Module: `packages/cli/src/daemon-lifecycle-status.ts`
```
import Database from "better-sqlite3";
import { join } from "node:path";
import { OPENRIG_HOME, readOpenRigEnv } from "./openrig-compat.js";

/** The daemon's lifecycle record (mig-061), read CLI-side for the status render. */
export interface DaemonLifecycleRecord {
  bootEpoch: string;
  startedAt: string;
  lastHeartbeatAt: string | null;
  stoppedAt: string | null;
}

export interface LifecycleDescription {
  /** clean-shutdown = stopped_at was written; no-clean-shutdown = it wasn't (crash/
   *  kill-9/power-loss); unknown = no record at all (pre-P7 daemon or never booted). */
  kind: "clean-shutdown" | "no-clean-shutdown" | "unknown";
  /** best last-seen: stopped_at if clean, else last heartbeat, else boot time. */
  lastSeen: string | null;
  stoppedAt: string | null;
}

/**
 * P7 render classification — pure. A stopped_at means the daemon marked a clean
 * shutdown; its ABSENCE (with a boot record present) is the money case: the daemon
 * died without recording a clean stop, so we render "no clean shutdown recorded,
 * last-seen T" instead of a bare "not running".
 */
export function describeLifecycle(record: DaemonLifecycleRecord | null): LifecycleDescription {
  if (!record) return { kind: "unknown", lastSeen: null, stoppedAt: null };
  if (record.stoppedAt) {
    return { kind: "clean-shutdown", lastSeen: record.stoppedAt, stoppedAt: record.stoppedAt };
  }
  return {
    kind: "no-clean-shutdown",
    lastSeen: record.lastHeartbeatAt ?? record.startedAt,
    stoppedAt: null,
  };
}

/**
 * Read the daemon_lifecycle singleton directly from the daemon's SQLite db,
 * READ-ONLY. This is the crash-surviving read path: on a dead pid the daemon
 * isn't answering HTTP and daemon.json is deleted, but the SQLite row persists.
 * Returns null if the db/table is absent or unreadable (→ "unknown").
 */
/** The daemon's db path, resolved the SAME way the daemon resolves it (D15):
 *  explicit OPENRIG_DB/RIGGED_DB wins, else OPENRIG_HOME/openrig.sqlite. Never
 *  CWD-relative. */
export function resolveLifecycleDbPath(): string {
  return readOpenRigEnv("OPENRIG_DB", "RIGGED_DB") || join(OPENRIG_HOME, "openrig.sqlite");
}

/** Read + classify the lifecycle record from the resolved db path (crash-surviving). */
export function readLifecycleDescription(): LifecycleDescription {
  return describeLifecycle(readDaemonLifecycle(resolveLifecycleDbPath()));
}

export function readDaemonLifecycle(dbPath: string): DaemonLifecycleRecord | null {
  let db: Database.Database | null = null;
  try {
    db = new Database(dbPath, { readonly: true, fileMustExist: true });
    const row = db
      .prepare(`SELECT boot_epoch, started_at, last_heartbeat_at, stopped_at FROM daemon_lifecycle WHERE singleton = 1`)
      .get() as
      | { boot_epoch: string; started_at: string; last_heartbeat_at: string | null; stopped_at: string | null }
      | undefined;
    if (!row) return null;
    return {
      bootEpoch: row.boot_epoch,
      startedAt: row.started_at,
      lastHeartbeatAt: row.last_heartbeat_at ?? null,
      stoppedAt: row.stopped_at ?? null,
    };
  } catch {
    return null; // no db / no table / locked → unknown, never a crash of `rig status`
  } finally {
    try {
      db?.close();
    } catch {
      /* best-effort */
    }
  }
}

```

### Core Architecture Module: `packages/cli/src/daemon-lifecycle.ts`
```
import path from "node:path";
import { existsSync } from "node:fs";
import type { ChildProcess } from "node:child_process";
import { connectionErrorCode, formatDaemonHostForUrl } from "./client.js";
import { blockedConnectionGuidance, isBlockedConnectionCode } from "./daemon-reachability.js";
import type { DaemonStartLock } from "./daemon-start-lock.js";
import { DAEMON_STOP_WAIT_MS, DAEMON_SHUTDOWN_RECEIPT, type DaemonShutdownReceipt } from "@openrig/daemon/daemon-shutdown";
import { ConfigStore } from "./config-store.js";
import { readLocalOrigin } from "./local-origin.js";
import { OPENRIG_HOME, LEGACY_RIGGED_HOME, readOpenRigEnv } from "./openrig-compat.js";
import {
  ensureDefaultWorkspace,
  ensureOpenRigInstance,
  formatInstanceInitializationConflicts,
  type InitializationFsOps,
  type InitWorkspaceResult,
  type ManagedPathKind,
} from "@openrig/daemon/instance-initialization";

export interface DaemonState {
  pid: number;
  port: number;
  host?: string;
  db: string;
  startedAt: string;
}

/**
 * OPR.0.4.3.21 — event-loop wedge evidence read from the enriched `/healthz`
 * body. Present only when the daemon actually answered healthz with a monitor
 * wired; absent when healthz timed out (a wedged loop can't respond — the
 * evidence in that case is `reason: "unresponsive"`).
 */
export interface DaemonEventLoopEvidence {
  lagMeanMs: number;
  lagP99Ms: number;
  utilization: number;
  lastTickAgeMs: number;
  healthy: boolean;
}

export interface DaemonStatus {
  /** RULING 1ae863d2 — C3 3-state semantics (canonical: daemon crash-cart-detect.ts, kept in
   *  lockstep): "stopped" requires POSITIVE evidence (connection refused); a probe TIMEOUT or
   *  other non-refusal failure is "unverified" — never a down assertion. */
  state: "running" | "stopped" | "stale" | "unverified";
  /** Home-resolution honesty: set when the resolved home lacks daemon state but a live sibling
   *  home (or a HOME-MOVED marker) exists — callers name BOTH paths, never assert down. */
  siblingHint?: { resolvedHome: string; siblingHome: string };
  port?: number;
  host?: string;
  pid?: number;
  healthy?: boolean;
  /**
   * OPR.0.4.3.21 — why an alive+listening daemon is unhealthy. "unresponsive"
   * = the process is up but `/healthz` timed out (the honest wedged-loop
   * signal); "event-loop-starved" = healthz answered but the loop-lag /
   * last-tick evidence crossed the threshold. Absent when healthy.
   */
  reason?: "unresponsive" | "event-loop-starved";
  /** OPR.0.4.3.21 — event-loop evidence when healthz answered with a monitor. */
  eventLoop?: DaemonEventLoopEvidence;
  /** #275 — the OS code behind a failed health probe (e.g. EPERM when a sandbox blocked it). */
  probeErrorCode?: string;
}

/** "unknown": the process may exist but this shell can neither signal nor inspect it. */
export type ProcessLiveness = "alive" | "dead" | "unknown";

export interface GetDaemonStatusOptions {
  /** Observers may disable cleanup; only a matching clean shutdown permits removal. */
  cleanupStaleState?: boolean;
}

/** Build the daemon HTTP URL from status. Uses persisted host or defaults to 127.0.0.1. */
export function getDaemonUrl(status: DaemonStatus): string {
  return `http://${formatDaemonHostForUrl(status.host ?? DEFAULT_HOST)}:${status.port}`;
}

/**
 * OPR.0.3.3.04.2 (AC-4): the ONE shared honest daemon-not-running error for the
 * daemon-dependent journey verbs (bootstrap / discover / workspace / workflow).
 * Mirrors the repo's 3-part fact / consequence / action convention
 * (commands/archive.ts, commands/queue.ts) so the daemon-dependency UX is
 * consistent across the new-operator journey instead of four divergent bare
 * dead-ends. Bounded to the daemon-not-running path - NOT a general
 * error-framework (that would be its own slice).
 */
export interface DaemonNotRunningError {
  fact: string;
  consequence: string;
  action: string;
  /** The OS code behind the failed probe, when known. */
  causeCode?: string;
}

export function daemonNotRunningError(): DaemonNotRunningError {
  return {
    fact: "Daemon not running.",
    consequence: "This command needs a running daemon.",
    action: "Run 'rig up' (it auto-starts the daemon), or 'rig daemon start'.",
  };
}

/**
 * Print the shared daemon-not-running error and set a failing exit code. Pass
 * `{ json: true }` for the agent-facing `{ error: { fact, consequence, action } }`
 * envelope (matching commands/queue.ts JSON output).
 */

/** B8-1b (shape 73ee4b25) — the epistemic-matched guard message: language derives from
 *  what the probe KNOWS. UNVERIFIED/unhealthy = "did not respond" (down ≠ busy);
 *  stopped/stale = the plain not-running truth. Pure so every surface shares it. */
export function statusGuardMessage(status: DaemonStatus): DaemonNotRunningError {
  if (status.state === "stopped" || status.state === "stale") {
    return daemonNotRunningError();
  }
  const causeCode = status.probeErrorCode ? { causeCode: status.probeErrorCode } : {};
  if (isBlockedConnectionCode(status.probeErrorCode)) {
    const blocked = blockedConnectionGuidance(status.probeErrorCode);
    return {
      fact: `Daemon could not be checked: the health probe was blocked (${status.probeErrorCode}).`,
      consequence: `This command needs a responsive daemon. ${blocked.consequence}`,
      action: blocked.action,
      ...causeCode,
    };
  }
  // unverified, or running-but-unhealthy: we do NOT know it is down.
  return {
    fact: "Daemon did not respond — it may be busy or stopped (state not confirmed).",
    consequence: "This command needs a responsive daemon; the outcome of proceeding would be indeterminate.",
    action: "Re-check with 'rig daemon status'. If it is confirmed stopped, run 'rig up' or 'rig daemon start'.",
    ...causeCode,
  };
}

/** B8-1b — THE precheck chokepoint: returns true when the daemon is running+healthy;
 *  otherwise prints the epistemic-matched 3-part (+ the wrong-home sibling hint when
 *  present), sets exit 1, returns false. Replaces the ~55 hand-rolled verbatim guards. */
export function daemonStatusGuard(status: DaemonStatus, opts?: { json?: boolean }): boolean {
  if (status.state === "running" && status.healthy !== false) return true;
  const err = statusGuardMessage(status);
  if (opts?.json) {
    console.log(JSON.stringify({ error: err }));
  } else {
    console.error(`Error: ${err.fact}`);
    console.error(`  ${err.consequence}`);
    console.error(`  ${err.action}`);
  }
  if (status.siblingHint) {
    console.error(`  note: OPENRIG_HOME may be wrong — resolved ${status.siblingHint.resolvedHome}, live sibling ${status.siblingHint.siblingHome}`);
  }
  process.exitCode = 1;
  return false;
}

export function printDaemonNotRunning(opts?: { json?: boolean }): void {
  const err = daemonNotRunningError();
  if (opts?.json) {
    console.log(JSON.stringify({ error: err }));
  } else {
    console.error(`Error: ${err.fact}`);
    console.error(`  ${err.consequence}`);
    console.error(`  ${err.action}`);
  }
  process.exitCode = 1;
}

export interface StartOptions {
  port?: number;
  host?: string;
  db?: string;
  transcriptsEnabled?: boolean;
  transcriptsPath?: string;
  /** When set, daemon startup idempotently ensures the default workspace exists. */
  workspaceRoot?: string;
  contextRoot?: string;
  skillsRoot?: string;
  topologyRoot?: string;
  // V1 pre-release CLI/daemon Item 1 — capture-pane rotation tunables.
  // Threaded through to the daemon process env so the rotation hook
  // picks up file-stored ConfigStore values, not just shell env.
  transcriptsLines?: number;
  transcriptsPollIntervalSeconds?: number;
  // V0.3.1 slice 05 kernel-rig-as-default — when true, daemon startup
  // skips the kernel auto-boot path (kernel rig is not materialized).
  // Exposed at the CLI as `rig daemon start --no-kernel`; projected
  // into the daemon process env as OPENRIG_NO_KERNEL.
  skipKernelBoot?: boolean;
}

export interface LifecycleDeps {
  /** Required by startDaemon; read-only lifecycle consumers need no launch capability. */
  acquireStartLock?: () => DaemonStartLock;
  spawn: (cmd: string, args: string[], opts: {
    env: Record<string, string>;
    stdio: unknown;
    detached: boolean;
  }) => ChildProcess;
  // OPR.0.4.3.21 — optional `json` lets getDaemonStatus read the enriched
  // /healthz body (event-loop evidence). Optional so existing mocks that
  // return `{ ok }` are unchanged; production (realDeps) supplies it.
  fetch: (url: string) => Promise<{ ok: boolean; json?: () => Promise<unknown> }>;
  kill: (pid: number, signal: string) => boolean;
  readFile: (path: string) => string | null;
  writeFile: (path: string, content: string) => void;
  removeFile: (path: string) => void;
  exists: (path: string) => boolean;
  mkdirp: (path: string) => void;
  /** Exact production path typing for additive initialization. Tests that do
   * not exercise collisions may omit it and use the legacy exists seam. */
  pathKind?: (path: string) => ManagedPathKind;
  openForAppend: (path: string) => number;
  closeFile?: (fd: number) => void;
  isProcessAlive: (pid: number) => boolean;
  /** #275 — three-state liveness for status reads (production: realDeps). Optional so existing
   *  mocks keep the boolean rule; absent = derived from isProcessAlive. */
  processLiveness?: (pid: number) => ProcessLiveness;
  // OPR.0.4.2.1 — optional injectable delay for the status-probe bounded settle/retry.
  // Defaults to a real setTimeout in production; tests pass a no-op to stay fast. Optional so
  // existing deps / mocks / callers are untouched.
  sleep?: (ms: number) => Promise<void>;
  // RULING 1ae863d2 — optional home-resolution honesty deps (optional so existing
  // mocks/callers are untouched): homeDir overrides the module-load OPENRIG_DIR for
  // the sibling-home scan; listDir lists a directory (production: fs.readdirSync).
  homeDir?: string;
  listDir?: (path: string) => string[];
}

export const OPENRIG_
```

### Core Architecture Module: `packages/daemon/assets/plugins/openrig-core/skills/claude-compaction-restore/scripts/precompact-hook.mjs`
```
#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const skillRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const restoreScript = path.join(skillRoot, "scripts", "restore-from-jsonl.mjs");
// P6(C) injectable output-root: the packet base defaults to the shared
// /tmp/claude-compaction-restore (production), but becomes per-run isolated when the
// hermetic env-var OPENRIG_COMPACTION_OUT_ROOT is set — so concurrent writers with the
// same injected clock + sessionId no longer collide on the same `${sessionId}-${stamp}`
// dir. Mirrors the injectable-clock seam (OPENRIG_TEST_CLOCK_NOW). Empty/absent = /tmp.
const outRoot = process.env.OPENRIG_COMPACTION_OUT_ROOT || "/tmp/claude-compaction-restore";
const defaultRestoreInstruction =
  "Read the claude-compaction-restore skill and follow its \"If You Just Compacted\" protocol.";

function emit(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function readHookInput() {
  const raw = fs.readFileSync(0, "utf8").trim();
  if (!raw) return {};
  return JSON.parse(raw);
}

function getOpenRigHome() {
  return process.env.OPENRIG_HOME || process.env.RIGGED_HOME || path.join(os.homedir(), ".openrig");
}

// A3-R3 injectable clock (slice 51-01): marker.createdAt defaults to real wall-clock,
// but becomes deterministic when the shared hermetic env-var OPENRIG_TEST_CLOCK_NOW is
// set (an ISO instant). Empty/absent = production real-time.
function nowIso() {
  const injected = process.env.OPENRIG_TEST_CLOCK_NOW;
  return typeof injected === "string" && injected.trim().length > 0 ? injected : new Date().toISOString();
}

function expandInstructionPath(filePath) {
  if (filePath.startsWith("~/")) return path.join(os.homedir(), filePath.slice(2));
  if (filePath.startsWith("${OPENRIG_HOME}/")) {
    return path.join(getOpenRigHome(), filePath.slice("${OPENRIG_HOME}/".length));
  }
  if (filePath.startsWith("$OPENRIG_HOME/")) {
    return path.join(getOpenRigHome(), filePath.slice("$OPENRIG_HOME/".length));
  }
  return filePath;
}

function readInstructionFile(filePath) {
  const expanded = expandInstructionPath(filePath);
  if (!fs.existsSync(expanded)) return "";
  return fs.readFileSync(expanded, "utf8");
}

// OPR.0.4.1.09 / R5 marker-lifecycle (foreign-content-in-marker face): the hook
// path must apply the SAME seat-check the daemon enforcer's resolvePostCompactExtra
// applies (rev1-r2 dcd95bd9), or a FOREIGN seat's global messageFilePath leaks into
// THIS seat's marker. Parse a WELL-FORMED leading `---` frontmatter for a declared
// seat (target_seat / seat / session); body text is never scanned; a broken/absent
// fence is GENERIC (valid for any seat). Byte-mirrors the enforcer regexes.
function declaredSeatOf(content) {
  const fm = /^\s*---\s*\n([\s\S]*?)\n---/.exec(content);
  if (!fm) return null;
  const m = /^[ \t]*(?:target[_-]?seat|seat|session(?:[_-]?name)?)[ \t]*:[ \t]*["']?([^"'\n#]+?)["']?[ \t]*$/im.exec(fm[1]);
  return m ? m[1].trim() : null;
}

function sanitizeSeat(value) {
  return value.replace(/[^a-zA-Z0-9_.@-]/g, "_");
}

// Resolve the post-compaction extra FOR THIS SEAT (mirror of the enforcer): (1) prefer
// a per-seat compaction/post-compact-extra/<seat>.md — no cross-seat contamination
// possible; (2) fall back to the global ONLY when it does not declare a DIFFERENT seat
// (a wrong-seat global is REFUSED). Generic/undeclared/configured-but-absent stay
// allowed. Returns the path to read, or null when nothing valid for this seat.
function resolveSeatSafeExtraPath(globalFilePathRaw) {
  const rawSeat = process.env.OPENRIG_SESSION_NAME || process.env.RIGGED_SESSION_NAME || "";
  const seatKey = rawSeat ? sanitizeSeat(rawSeat) : "";
  if (seatKey) {
    const perSeatPath = path.join(getOpenRigHome(), "compaction", "post-compact-extra", `${seatKey}.md`);
    if (fs.existsSync(perSeatPath)) {
      const declared = declaredSeatOf(fs.readFileSync(perSeatPath, "utf8"));
      if (declared && sanitizeSeat(declared) !== seatKey) return null; // wrong-seat per-seat file
      return perSeatPath;
    }
  }
  const trimmed = (globalFilePathRaw || "").trim();
  if (!trimmed) return null;
  const expanded = expandInstructionPath(trimmed);
  // configured-but-absent: keep the path (an absent file cannot be a wrong-seat leak;
  // readInstructionFile returns "" so nothing is appended).
  if (!fs.existsSync(expanded)) return trimmed;
  const declared = declaredSeatOf(fs.readFileSync(expanded, "utf8"));
  if (declared && sanitizeSeat(declared) !== seatKey) return null; // foreign-seat global REFUSED
  return trimmed;
}

function sessionKey(input) {
  const raw = [
    process.env.OPENRIG_SESSION_NAME,
    process.env.RIGGED_SESSION_NAME,
    input.session_id,
    input.sessionId,
    input.session_name,
    input.sessionName,
    input.transcript_path ? path.basename(input.transcript_path, ".jsonl") : "",
  ].find((value) => typeof value === "string" && value.trim().length > 0) || "unknown-session";
  return raw.replace(/[^a-zA-Z0-9_.@-]/g, "_");
}

function pendingMarkerPath(input) {
  return path.join(getOpenRigHome(), "compaction", "restore-pending", `${sessionKey(input)}.json`);
}

// R5 absent-when-needed: drop a lightweight EXPECTED sentinel FIRST (before the packet is
// generated + the marker is written), carrying the SAME identity binding the marker gets.
// Its presence-without-a-marker is what lets the bridge be LOUD about a missing packet
// (hook died partway / write failed); policy off = no hook = no sentinel = silent.
function writeExpectedSentinel(input) {
  const p = path.join(getOpenRigHome(), "compaction", "restore-pending", `${sessionKey(input)}.expected.json`);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, `${JSON.stringify({
    version: 1,
    sessionName: process.env.OPENRIG_SESSION_NAME || process.env.RIGGED_SESSION_NAME || null,
    sessionId: input.session_id || input.sessionId || null,
    transcriptPath: input.transcript_path || null,
    createdAt: nowIso(),
  }, null, 2)}\n`, "utf8");
}

function writePendingRestoreMarker(input, parsed, restoreInstruction, customMessage) {
  const markerPath = pendingMarkerPath(input);
  fs.mkdirSync(path.dirname(markerPath), { recursive: true });
  const payload = {
    version: 1,
    createdAt: nowIso(),
    sessionName: process.env.OPENRIG_SESSION_NAME || process.env.RIGGED_SESSION_NAME || null,
    sessionId: input.session_id || input.sessionId || null,
    transcriptPath: input.transcript_path || null,
    cwd: input.cwd || null,
    outputDir: parsed.outputDir,
    restoreInstruction,
    postCompactInstruction: customMessage || "",
    expectedAck: "restored from packet at <path>; resumed at step <X>",
    deliveredAt: null,
    deliveryCount: 0,
  };
  fs.writeFileSync(markerPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return markerPath;
}

// Slice 27 — read the OpenRig config directly (no daemon HTTP dependency
// so the hook still works when the daemon isn't running or isn't
// reachable from this process). Returns "" for either field when the
// config is missing, malformed, or the policy isn't set. If the policy is
// enabled but restore text has not been written yet, use OpenRig's default
// instruction to load the canonical restore skill. Inline instructions and
// file-path content are both included when both are configured.
function readClaudeCompactionMessage() {
  const configPath = path.join(getOpenRigHome(), "config.json");
  let inline = "";
  let filePath = "";
  let inlineConfigured = false;
  let filePathConfigured = false;
  let policyEnabled = false;
  try {
    if (!fs.existsSync(configPath)) return "";
    const raw = fs.readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw);
    const policy = parsed?.policies?.claudeCompaction;
    if (policy && typeof policy === "object") {
      policyEnabled = policy.enabled === true;
      if (typeof policy.messageInline === "string") {
        inlineConfigured = true;
        inline = policy.messageInline;
      }
      if (typeof policy.messageFilePath === "string") {
        filePathConfigured = true;
        filePath = policy.messageFilePath;
      }
    }
  } catch {
    return "";
  }

  const parts = [];
  if (inline && inline.length > 0) {
    parts.push(`Inline restore instruction:\n${inline}`);
  }
  if (filePath && filePath.length > 0) {
    // R5 seat-check: resolve to the per-seat extra or a seat-safe global; a
    // foreign-seat global resolves to null and is never injected into this marker.
    const resolved = resolveSeatSafeExtraPath(filePath);
    if (resolved) {
      try {
        const fileText = readInstructionFile(resolved);
        if (fileText) {
          parts.push(`Additional restore instruction file (${resolved}):\n${fileText}`);
        }
      } catch {
        // Keep any inline instruction; unreadable extra files degrade quietly.
      }
    }
  }
  if (parts.length > 0) return parts.join("\n\n");
  if (policyEnabled && !inlineConfigured && !filePathConfigured) {
    return defaultRestoreInstruction;
  }
  return "";
}

function buildSystemMessage(restoreInstruction, customMessage) {
  if (!customMessage) return restoreInstruction;
  return `${restoreInstruction}\n\n--- Operator-configured post-compaction restore instruction ---\n${customMessage}`;
}

try {
  // Slice 51-01 RIDER (leak-visibility, review-r1 escalation): OPENRIG_TEST_CLOCK_NOW is
  // read by nowIso() to make createdAt deterministic in tests — but a LEAKED var in a
  // real seat would silently FREEZE production createdAt. Announce loudly on stderr when
  // active so any leak is visible in seat logs; absence stays silent (production path).
  // MUST stay byte-identical to STUB_CLOCK_ANNOUNCEMENT in stub-runner.ts.
  if (typeof process.env.OPENRIG_TEST_CLOCK_NOW === "string" && process.e
```

### Core Architecture Module: `packages/daemon/assets/plugins/openrig-core/skills/claude-compaction-restore/scripts/restore-from-jsonl.mjs`
```
#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";

const TEXT_LIMIT = 4000;
const BASE64_RUN = 800; // strip contiguous base64 runs at least this long (screenshots, data URIs)

function sha256(text) {
  return crypto.createHash("sha256").update(String(text ?? "")).digest("hex").slice(0, 16);
}

// R3: replace binary / base64 payloads (data: URIs, long base64 runs) with a compact marker,
// so a single screenshot block does not blow the transcript into un-chunkable size.
function stripBinary(text) {
  let s = String(text ?? "");
  s = s.replace(/data:([\w.+-]+\/[\w.+-]+)?;base64,[A-Za-z0-9+/=\s]{200,}/g,
    (m, mime) => `[binary omitted: ~${m.length} bytes${mime ? `, ${mime}` : ""}]`);
  s = s.replace(new RegExp(`[A-Za-z0-9+/]{${BASE64_RUN},}={0,2}`, "g"),
    (m) => `[base64 omitted: ~${m.length} bytes]`);
  return s;
}
const DEFAULT_OUT = "/tmp/claude-compaction-restore";

function parseArgs(argv) {
  const args = {
    jsonl: null,
    out: DEFAULT_OUT,
    cwd: process.cwd(),
    json: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--jsonl") args.jsonl = argv[++i];
    else if (arg === "--out") args.out = argv[++i];
    else if (arg === "--cwd") args.cwd = argv[++i];
    else if (arg === "--json") args.json = true;
    else if (!arg.startsWith("-") && !args.jsonl) args.jsonl = arg;
    else throw new Error(`unknown argument: ${arg}`);
  }

  return args;
}

function readJsonLines(file) {
  const raw = fs.readFileSync(file, "utf8");
  return raw
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        return { type: "parse-error", line: index + 1, error: String(error), raw: line };
      }
    });
}

function findLatestJsonl(cwd) {
  const projectsRoot = path.join(os.homedir(), ".claude", "projects");
  if (!fs.existsSync(projectsRoot)) return null;

  const encoded = cwd ? cwd.replaceAll("/", "-") : null;
  const candidates = [];
  const roots = [];

  if (encoded) {
    const exact = path.join(projectsRoot, encoded);
    if (fs.existsSync(exact)) roots.push(exact);
  }
  roots.push(projectsRoot);

  for (const root of roots) {
    const result = spawnSync("find", [root, "-name", "*.jsonl", "-maxdepth", root === projectsRoot ? "4" : "2"], {
      encoding: "utf8",
    });
    if (result.status !== 0 && !result.stdout) continue;
    for (const file of result.stdout.split(/\r?\n/).filter(Boolean)) {
      try {
        const stat = fs.statSync(file);
        candidates.push({ file, mtimeMs: stat.mtimeMs });
      } catch {
        // Ignore raced/deleted transcript files.
      }
    }
    if (candidates.length) break;
  }

  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return candidates[0]?.file ?? null;
}

function stringifyContent(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((block) => {
        if (typeof block === "string") return block;
        if (block?.type === "text") return block.text ?? "";
        if (block?.type === "image") return `[image omitted: ${block.source?.media_type ?? "image"}]`;
        if (block?.type === "tool_use") return `[tool_use:${block.name}] ${JSON.stringify(block.input ?? {})}`;
        if (block?.type === "tool_result") return `[tool_result] ${truncate(stripBinary(stringifyContent(block.content)), TEXT_LIMIT)}`;
        return JSON.stringify(block);
      })
      .join("\n");
  }
  if (content == null) return "";
  return JSON.stringify(content);
}

function truncate(text, max) {
  const s = String(text ?? "");
  if (s.length <= max) return s;
  return `${s.slice(0, max)}\n[...truncated ${s.length - max} chars...]`;
}

function walkStrings(value, acc = []) {
  if (typeof value === "string") acc.push(value);
  else if (Array.isArray(value)) value.forEach((item) => walkStrings(item, acc));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => walkStrings(item, acc));
  return acc;
}

function normalizeFile(candidate, cwd) {
  let file = candidate.trim().replace(/[),.;:'"`\]\}>]+$/g, "").replace(/^[('"`<\[]+/g, "");
  if (!file || file.includes("\n")) return null;
  if (/\.(?:md|mdx|txt|json|jsonl|yaml|yml|toml|ts|tsx|js|jsx|mjs|cjs|py|sh|rs|go|sql|css|scss|html|xml|svg|csv|log|lock)\//i.test(file)) return null;
  if (file.startsWith("~")) file = path.join(os.homedir(), file.slice(1));
  let normalized = null;
  if (file.startsWith("/")) normalized = path.normalize(file);
  else if (file.startsWith("./") || file.startsWith("../")) normalized = path.normalize(path.resolve(cwd, file));
  else if (/^[A-Za-z0-9_@.+-][A-Za-z0-9_@.+/\-:]*\.[A-Za-z0-9]+$/.test(file)) {
    normalized = path.normalize(path.resolve(cwd, file));
  } else if (/^(CLAUDE|AGENTS|README|DESIGN|CULTURE|MEMORY)\.md$/.test(file)) {
    normalized = path.normalize(path.resolve(cwd, file));
  }

  if (!normalized) return null;
  try {
    if (fs.existsSync(normalized) && fs.statSync(normalized).isDirectory()) return null;
  } catch {
    // Keep the candidate if stat races; the restore agent can decide.
  }
  return normalized;
}

function extractPaths(text, cwd) {
  const paths = new Set();
  const s = String(text ?? "");
  const absolute = /(?:^|[\s"'(<\[])(\/(?:Users|private|tmp|var|opt|Volumes)\/[^\s"'()\]<>]+)/g;
  const relative = /(?:^|[\s"'(<\[])((?:\.{1,2}\/)?[A-Za-z0-9_@.+-][A-Za-z0-9_@.+/\-:]*\.(?:md|mdx|txt|json|jsonl|yaml|yml|toml|ts|tsx|js|jsx|mjs|cjs|py|sh|rs|go|sql|css|scss|html|xml|svg|csv|log|lock))(?:$|[\s"')>\],.;:])/g;
  const namedMarkdown = /(?:^|[\s"'(<\[])((?:CLAUDE|AGENTS|README|DESIGN|CULTURE|MEMORY)\.md)(?:$|[\s"')>\],.;:])/g;

  for (const regex of [absolute, relative, namedMarkdown]) {
    let match;
    while ((match = regex.exec(s)) !== null) {
      const normalized = normalizeFile(match[1], cwd);
      if (normalized) paths.add(normalized);
    }
  }
  return [...paths];
}

function createRegistry() {
  const files = new Map();
  let sequence = 0;

  return {
    add(file, kind, source) {
      if (!file) return;
      const existing = files.get(file) ?? {
        path: file,
        kinds: {},
        sources: new Set(),
        firstSeen: sequence,
        lastSeen: sequence,
      };
      existing.kinds[kind] = (existing.kinds[kind] ?? 0) + 1;
      existing.sources.add(source);
      existing.lastSeen = sequence;
      files.set(file, existing);
    },
    tick() {
      sequence += 1;
    },
    values() {
      return [...files.values()].map((entry) => ({
        ...entry,
        sources: [...entry.sources].slice(0, 8),
      }));
    },
  };
}

function toolKind(name, input) {
  if (["Write", "Edit", "MultiEdit", "NotebookEdit"].includes(name)) return "written";
  if (name === "Read") return "read";
  if (["Grep", "Glob", "LS"].includes(name)) return "discovered";
  if (name === "Bash") {
    const command = input?.command ?? "";
    if (/\b(apply_patch|tee|touch|mkdir|mv|cp|rm)\b|(^|[^>])>{1,2}[^>]/.test(command)) return "shell-write";
    return "shell-mentioned";
  }
  return "mentioned";
}

function scoreFile(entry) {
  const ext = path.extname(entry.path).toLowerCase();
  let score = 0;
  if (entry.kinds.written) score += 40;
  if (entry.kinds["shell-write"]) score += 30;
  if (entry.kinds["file-history"]) score += 35;
  if (ext === ".md" || ext === ".mdx") score += 20;
  if (entry.kinds.read) score += 10;
  if (entry.kinds.discovered) score += 4;
  if (/\/docs\/as-built\//.test(entry.path)) score += 25;
  if (/(codemap|architecture|CLAUDE|AGENTS|README|DESIGN|CULTURE|session\.log|queue\.md)/i.test(entry.path)) score += 15;
  score += Math.min(10, Object.values(entry.kinds).reduce((a, b) => a + b, 0));
  return score;
}

function discoverDocs(cwd) {
  const candidates = [
    "CLAUDE.md",
    "AGENTS.md",
    "README.md",
    "docs/as-built",
    "docs",
  ];
  const docs = new Set();

  for (const candidate of candidates) {
    const full = path.resolve(cwd, candidate);
    if (!fs.existsSync(full)) continue;
    const stat = fs.statSync(full);
    if (stat.isFile()) docs.add(full);
    if (stat.isDirectory()) {
      const result = spawnSync("find", [full, "-maxdepth", candidate === "docs" ? "2" : "1", "-type", "f", "-name", "*.md"], {
        encoding: "utf8",
      });
      for (const file of result.stdout.split(/\r?\n/).filter(Boolean)) {
        if (/as-built|codemap|architecture|README|overview/i.test(file)) docs.add(path.normalize(file));
      }
    }
  }

  return [...docs].sort();
}

function analyze(jsonlPath, cwd) {
  const records = readJsonLines(jsonlPath);
  const registry = createRegistry();
  const transcript = [];
  const narrative = []; // R4: message-turns only (assistant/user text), no tool bodies
  const readTargets = new Map(); // R1: tool_use_id -> file_path for Read calls
  const cwdCounts = new Map();
  let sessionId = null;

  for (const record of records) {
    registry.tick();
    if (record.sessionId || record.session_id) sessionId = record.sessionId ?? record.session_id;
    if (record.cwd) {
      cwdCounts.set(record.cwd, (cwdCounts.get(record.cwd) ?? 0) + 1);
      cwd = record.cwd;
    }

    if (record.type === "file-history-snapshot") {
      const backups = record.snapshot?.trackedFileBackups ?? {};
      for (const file of Object.keys(backups)) registry.add(path.normalize(file), "file-history", "file-history-snapshot");
    }

    const message = record.message;
    if (!message) continue;
    const role = message.role ?? record.type ?? "unknown";
    const content = message.content;

    if (typeof content === "string") {
      transcript.push(`\n## ${role}\n\n${content}`);
      narrative.push(`\n## ${role}\n\n${content}`);
      for (const file of extractPaths(content, cwd)) registry.add(file, "mentioned", `${role}:text`);
      cont
```

### Core Architecture Module: `packages/daemon/assets/plugins/openrig-core/skills/loading-addressable-markdown/scripts/resolve-markdown.mjs`
```
#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MIN_LEVEL = 2;
const MAX_LEVEL = 3;

export class AddressResolutionError extends Error {
  constructor(message) {
    super(message);
    this.name = "AddressResolutionError";
  }
}

export function slugifyHeader(title) {
  return title
    .toLowerCase()
    .replace(/[`*_~]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function parseAddress(address) {
  const hashCount = (address.match(/#/g) ?? []).length;
  if (hashCount > 1) {
    throw new AddressResolutionError(`address '${address}' must contain at most one '#' separator`);
  }

  const [ref, headerPart] = hashCount === 1 ? address.split("#") : [address, undefined];
  if (!ref) throw new AddressResolutionError(`address '${address}' has no file before '#'`);
  if (headerPart === undefined) return { ref, headerPath: [] };

  const headerPath = headerPart.split("/");
  if (headerPath.some((segment) => segment.length === 0)) {
    throw new AddressResolutionError(`address '${address}' has an empty header segment`);
  }
  if (headerPath.length > MAX_LEVEL - MIN_LEVEL + 1) {
    throw new AddressResolutionError(`address '${address}' is too deep; addresses target H2 and H3 only`);
  }
  return { ref, headerPath };
}

function scanHeaders(lines) {
  const hits = [];
  let fence = null;

  for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
    const line = lines[lineNumber];
    const fenceMatch = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      const length = fenceMatch[1].length;
      if (!fence) fence = { marker, length };
      else if (fence.marker === marker && length >= fence.length
        && /^[ \t\r]*$/.test(line.slice(fenceMatch[0].length))) fence = null;
      continue;
    }
    if (fence) continue;

    const heading = line.match(/^(#{1,6})\s+(.*\S)\s*$/);
    if (heading) hits.push({ level: heading[1].length, title: heading[2], line: lineNumber });
  }
  return hits;
}

export function parseMarkdownSections(text) {
  const lines = text.split("\n");
  const headers = scanHeaders(lines);
  const sections = [];
  let currentH2 = null;

  for (let index = 0; index < headers.length; index++) {
    const heading = headers[index];
    if (heading.level < MIN_LEVEL || heading.level > MAX_LEVEL) {
      if (heading.level < MIN_LEVEL) currentH2 = null;
      continue;
    }

    const slug = slugifyHeader(heading.title);
    if (heading.level === 2) currentH2 = slug;
    const headerPath = heading.level === 2
      ? [slug]
      : currentH2 !== null
        ? [currentH2, slug]
        : [slug];
    const fullEnd = headers.slice(index + 1).find((next) => next.level <= heading.level)?.line ?? lines.length;
    const ownEnd = headers[index + 1]?.line ?? lines.length;

    sections.push({
      level: heading.level,
      title: heading.title,
      headerPath,
      headerLine: heading.line,
      text: lines.slice(heading.line, fullEnd).join("\n"),
      ownText: lines.slice(heading.line, ownEnd).join("\n"),
    });
  }
  return sections;
}

export function resolveAddress(text, headerPath) {
  if (headerPath.length === 0) {
    throw new AddressResolutionError("a bare file resolves without section lookup");
  }

  const sections = parseMarkdownSections(text);
  const wanted = headerPath.join("/");
  const hits = sections.filter((section) => section.headerPath.join("/") === wanted);
  if (hits.length > 1) {
    throw new AddressResolutionError(
      `address '#${wanted}' is AMBIGUOUS: ${hits.length} sections match at lines ${hits.map((hit) => hit.headerLine + 1).join(", ")}`,
    );
  }
  if (hits.length === 1) return hits[0];

  const parentPath = headerPath.slice(0, -1).join("/");
  const candidates = sections
    .filter((section) => section.headerPath.slice(0, -1).join("/") === parentPath)
    .map((section) => section.headerPath.join("/"));
  throw new AddressResolutionError(
    `address '#${wanted}' matches no header. ` +
      (candidates.length > 0
        ? `Addressable sections under '${parentPath || "(top)"}': ${candidates.join(", ")}.`
        : `Addressable sections: ${sections.map((section) => section.headerPath.join("/")).join(", ") || "(none)"}.`),
  );
}

function usage() {
  return "Usage: resolve-markdown.mjs [--root DIR] FILE[#h2-slug[/h3-slug]]\n";
}

async function main(argv) {
  let root = process.cwd();
  const args = [...argv];

  if (args[0] === "--help" || args[0] === "-h") {
    process.stdout.write(usage());
    return;
  }
  if (args[0] === "--root") {
    if (!args[1]) throw new AddressResolutionError("--root needs a directory");
    root = path.resolve(args[1]);
    args.splice(0, 2);
  }
  if (args.length !== 1) throw new AddressResolutionError(usage().trim());

  const { ref, headerPath } = parseAddress(args[0]);
  const filePath = path.isAbsolute(ref) ? ref : path.resolve(root, ref);
  const text = await readFile(filePath, "utf8");
  process.stdout.write(headerPath.length === 0 ? text : resolveAddress(text, headerPath).text);
}

function isMainModule() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMainModule()) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error.name ?? "Error"}: ${error.message}\n`);
    process.exitCode = 1;
  });
}

```

### Core Architecture Module: `packages/daemon/assets/plugins/openrig-core/skills/openrig-operating-model/scripts/compose.py`
```
#!/usr/bin/env python3
"""compose.py — leaf-to-root chain composition and subtree renders.

SUPERSEDED FOR REFOCUS: the public core reorientation trace lives at
../../refocusing/scripts/trace-to-root.py. This general composer remains the
compatibility surface for down/progress and historical up invocations.

  up   <start-dir> --name FILE [--name FILE ...] [--root DIR]
       Walk from start-dir up to root (default: filesystem stops at a dir
       containing .compose-root, or at --root). Emit the chain ROOT-FIRST
       (defaults, then overrides) with provenance headers, and a MISSING-LINK
       report for altitudes without the file — the scream is output, not error.

  down <root-dir> --name FILE [--name FILE ...] [--exclude GLOB ...]
       Gather every instance of the named files under root-dir.

  progress <root-dir> --name FILE [--name FILE ...] [--exclude GLOB ...]
       THE DERIVED PROGRESS VIEW (the PROGRESS.md prototype done right):
       count markdown checkboxes in the named files (the mark level), roll
       counts UP the tree, and print a walk-map-shaped tree with done/total
       per level. Never stored in any file — the render is the only home.
       Gather every instance of the named files under root-dir (the subtree
       render; run at the topology root = THE TRUNK RENDER). Sorted by path.

Composed output is GENERATED, NEVER EDITED (fragments are the source of truth).
Seals/locks bind to a render's bytes, not to fragments. Stdlib only.
"""
import argparse, os, sys, fnmatch, datetime, re, shutil, subprocess

# A SHELF holds instances of an altitude; it is not a position and carries no chain file.
# Both trees have them: missions/ slices/ (work) and rigs/ pods/ seats/ (topology). Without
# this list the trace reports every shelf as a gap and the audit tells you to scaffold one —
# which is litter that inflates the map to a clean-looking 5/5 while adding nothing. Extend
# with --shelf for a tree that names them differently.
SHELF_NAMES = {"missions", "slices", "seats", "pods", "rigs"}

_TPL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "templates")
def _template_bytes(name):
    try:
        return open(os.path.join(_TPL_DIR, name), "rb").read()
    except OSError:
        return None

def read_state(path):
    """Detection is DETERMINISTIC-FIRST, declared-second — never memory-reliant:
    1. byte-identical to the shipped template  -> 'unseeded' (nobody had to remember anything)
    2. `status: UNSEEDED` marker on content that DIFFERS from the template -> 'conflicted':
       render the content AND scream — real work is never hidden behind a stale field,
       and the disagreement is its own reported state (third-state law).
    3. otherwise -> 'seeded'. Every residual failure mode shows too much plus a scream,
       never hides work and never silently trusts a field."""
    raw = open(path, "rb").read()
    tpl = _template_bytes(os.path.basename(path))
    body = raw.decode("utf-8", errors="replace")
    head = "\n".join(body.splitlines()[:15])
    marked = re.search(r"^status:\s*UNSEEDED", head, re.M)
    if tpl is not None and raw == tpl:
        m = re.search(r"^owners?:\s*(.+)$", head, re.M)
        return "unseeded", (m.group(1).strip() if m else "owner unknown — untouched scaffold")
    if marked:
        return "conflicted", body
    return "seeded", body

def hdr(title):
    return f"\n\n<!-- ═══ {title} ═══ -->\n\n## ⟦{title}⟧\n"

def frontmatter(payload):
    """Parse the frontmatter block ONCE. Returns (dict, note); note is set when there is
    nothing to read, so a caller can report the gap rather than silently skip it."""
    if not payload:
        return None, "no content"
    m = re.match(r"^---\n(.*?)\n---\n", payload, re.S)
    if not m:
        return None, "no frontmatter"
    try:
        import yaml
        return (yaml.safe_load(m.group(1)) or {}), None
    except Exception as e:
        return None, f"frontmatter did not parse ({e.__class__.__name__})"

def field_of(payload, field):
    """Extract ONE frontmatter field. Returns (value, note).
    A chain walked by FIELD composes intent without dragging bodies: three sentences
    unfurl, not three documents. A level whose file exists but lacks the field is a
    real gap and is reported as such — never silently skipped."""
    fm, note = frontmatter(payload)
    if fm is None:
        return None, note
    if field not in fm:
        return None, f"no `{field}:` field"
    v = fm[field]
    return (" ".join(str(v).split()) if v is not None else None), None

def _cut_at_boundary(s, n):
    """Cut to at most n characters without splitting a token.

    Prefer paragraph, line, then word boundaries. Drop a single unbroken token
    that exceeds the budget; a partial path or identifier looks valid but is not."""
    if len(s) <= n:
        return s
    head = s[:n]
    if s[n:n + 1].isspace():                 # n already sits on a boundary
        return head.rstrip()
    for sep, floor in (("\n\n", n // 2), ("\n", n // 2), (" ", 0)):
        i = head.rfind(sep)
        if i > floor:
            return head[:i].rstrip()
    return ""                                # one unbroken token — drop it, never cut into it


def _short(s, n=52):
    s = " ".join(str(s).split())
    if len(s) <= n:
        return s
    return _cut_at_boundary(s, n - 1).rstrip(" ,;:.-—") + "…"

_ARTIFACT_KEYS = ("outputs", "output", "artifacts", "artifact")


def dep_artifacts(dep_dir, names, dep_fm):
    """WHAT THE DEPENDENCY HANDS YOU — the file, not the fact that it is done.

    Frontmatter first if the node declares it (`outputs:`/`output:`/`artifacts:`/`artifact:`),
    because a declaration outranks a guess. Otherwise the directory itself: everything beside
    the node file, which for a built slice IS its output (MAP.md, PROOF.md, the script). No
    prose parsing — a `## Output` section is written for humans and reading it would make the
    trace confidently wrong exactly where it is trying to stop being that."""
    for k in _ARTIFACT_KEYS:
        v = (dep_fm or {}).get(k)
        if v:
            return [" ".join(str(x).split()) for x in (v if isinstance(v, list) else [v])], "declared"
    try:
        entries = sorted(os.listdir(dep_dir))
    except OSError:
        return [], "unreadable"
    out = [e + ("/" if os.path.isdir(os.path.join(dep_dir, e)) else "")
           for e in entries if not e.startswith(".") and e not in set(names)]
    return out, "on disk"


def blocking_state(payload, lvl, names):
    """Return leaf status and dependency facts beside its intent, or None.

    Intent alone does not say whether work may start or where dependency outputs
    live. Resolve dependencies on disk and report state, absolute path, and
    artifacts; leave ancestors to carry purpose."""
    fm, _ = frontmatter(payload)
    if not fm:
        return None
    parts = []
    if fm.get("status") is not None:
        parts.append(f"status: {_short(fm['status'], 88)}")
    deps = fm.get("depends")
    if deps:
        shelf = os.path.dirname(lvl)
        lines = ["depends:"]
        for dep in (deps if isinstance(deps, list) else [deps]):
            dep = " ".join(str(dep).split())
            dep_dir = os.path.join(shelf, dep)
            if not os.path.isdir(dep_dir):
                lines.append(f"    {dep} — ⚠ UNRESOLVED: no directory `{dep}` under {shelf}"
                             f" (nothing to point you at — check the id)")
                continue
            state, dfm = None, None
            for n in names:
                cand = os.path.join(dep_dir, n)
                if os.path.isfile(cand):
                    st, body = read_state(cand)
                    dfm = frontmatter(body)[0] if st != "unseeded" else None
                    state = _short((dfm or {}).get("status") or st)
                    break
            lines.append(f"    {dep} ({state})" if state else
                         f"    {dep} (⚠ no {'/'.join(names)} — state unknown)")
            lines.append(f"      path: {os.path.abspath(dep_dir)}")
            arts, how = dep_artifacts(dep_dir, names, dfm)
            if arts:
                shown = arts[:8]
                more = f" (+{len(arts) - 8} more)" if len(arts) > 8 else ""
                lines.append(f"      artifacts ({how}): " + " · ".join(shown) + more)
            else:
                lines.append(f"      artifacts: ⚠ none found — the dependency has produced no"
                             f" output file yet")
        parts.append("\n".join(lines))   # lines 2+ carry their own indent; the caller indents line 1
    return "\n  ".join(parts) or None


def operates_on(payload):
    """Return the roots a work node declares it operates on.

    The tree being walked need not be the tree the work changes. This cannot be
    inferred safely, so render `operates_on` verbatim and omit it when unstated."""
    fm, _ = frontmatter(payload)
    if not fm:
        return None
    roots = fm.get("operates_on")
    if not roots:
        return None
    return [" ".join(str(r).split()) for r in (roots if isinstance(roots, list) else [roots])]


# Preserve contract and scope sections ahead of rationale and history when the
# leaf body exceeds its cap. Unknown headings remain middle priority so new shapes
# degrade without being silently privileged or discarded.
_PRI_CONTRACT = re.compile(
    r"(done when|what done looks like|scope fence|outputs?\b|inputs?\b|depends on|"
    r"what must be built|how we will know|acceptance|payload|deliverable)", re.I)
_PRI_DISCUSSION = re.compile(
    r"^(why\b|the problem|the evidence|the finding|result\b|also\b|related\b|triage\b|"
    r"background\b|history\b|what is already done|new evidence|measured\b|answered\b|"
    r"where this spec was wrong|notes for|the counter-argument|the asset|the mechanism|"
    r"this mission is the acceptance criteria)", re.I)


def _priority(heading):
    """0 = preamble (never dropped) · 1 = contract · 2 = un
```

### Core Architecture Module: `packages/daemon/assets/plugins/openrig-core/skills/refocusing/scripts/trace-to-root.py`
```
#!/usr/bin/env python3
"""Render topology and work context by ascending directory paths only."""

import argparse
import json
import os
import re
import subprocess
from pathlib import Path

SHELVES = {"rigs", "pods", "seats", "missions", "slices"}
# The daemon's exact current-work refusal meaning "this seat holds no in-progress typed baton"
# (daemon domain/current-work.js, NO_TYPED_IN_PROGRESS). Only this exact text earns the work-root
# fallback. Compare by equality, not prefix: the sibling refusal "no typed in-progress work
# resolved to a work node" is a resolution failure and must stay a named gap. If the daemon's
# wording changes, equality fails toward a named gap that shows the new text, never a silent fallback.
NO_CURRENT_BATON_BASIS = (
    "no typed in-progress work (only in-progress rows are considered; a typed row that is "
    "pending or blocked is not current work)"
)
# The daemon's session-name character set and human-class refs (domain/session-name.ts:
# validateSessionName, isHumanSeatSessionRef).
SESSION_CHARS = re.compile(r"[A-Za-z0-9\-_.@]+")
HUMAN_CLASS_SESSION = re.compile(r"human(?:-[A-Za-z0-9._-]+)?@(?:kernel|host)|[A-Za-z0-9._:-]+@external")


def rig_output(*args):
    try:
        result = subprocess.run(
            ["rig", *args], capture_output=True, text=True, timeout=10, check=False
        )
    except (OSError, subprocess.SubprocessError):
        return None
    value = (result.stdout or "").strip()
    return value if result.returncode == 0 and value else None


def configured_root(key, env_key):
    value = os.environ.get(env_key) or rig_output("config", "get", key)
    return Path(value).expanduser().resolve() if value else None


def under_root(path, root):
    try:
        path.relative_to(root)
        return True
    except ValueError:
        return False


def ascent(start, root):
    start = start.expanduser().resolve()
    if not under_root(start, root):
        return None, f"start is outside configured root: {start}"
    nodes = []
    current = start
    while True:
        if current.name not in SHELVES:
            nodes.append(current)
        if current == root:
            break
        parent = current.parent
        if parent == current:
            return None, f"could not reach configured root: {root}"
        current = parent
    return list(reversed(nodes)), None


def read(path):
    try:
        return path.read_text(encoding="utf8", errors="replace")
    except OSError:
        return None


def resolve_notes(node):
    try:
        result = subprocess.run(
            ["rig", "scope", "resolve-notes", str(node), "--json"],
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )
    except subprocess.TimeoutExpired:
        return None, "resolver command timed out"
    except OSError as error:
        return None, f"resolver command could not start: {error}"
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "").strip().splitlines()
        suffix = f": {detail[0]}" if detail else ""
        return None, f"resolver command exited {result.returncode}{suffix}"
    try:
        payload = json.loads(result.stdout)
    except (json.JSONDecodeError, TypeError):
        return None, "resolver command returned malformed JSON"
    if not isinstance(payload, dict) or payload.get("ok") is not True or "resolution" not in payload:
        return None, "resolver command returned an invalid success shape"
    resolution = payload["resolution"]
    if resolution is None:
        return None, None
    if not isinstance(resolution, dict):
        return None, "resolver command returned an invalid resolution shape"
    resolved_path = resolution.get("path")
    resolved_name = resolution.get("name")
    if not isinstance(resolved_path, str) or not isinstance(resolved_name, str):
        return None, "resolver command returned an invalid resolution shape"
    return (Path(resolved_path), resolved_name), None


def intent(text):
    if not text or not text.startswith("---"):
        return None
    match = re.match(r"^---\s*\n(.*?)\n---(?:\s*\n|$)", text, re.S)
    if not match:
        return None
    lines = match.group(1).splitlines()
    for index, line in enumerate(lines):
        found = re.match(r"^intent:\s*(.*)$", line)
        if not found:
            continue
        value = found.group(1).strip()
        if value in {"|", ">", "|-", ">-", "|+", ">+"}:
            block = []
            for later in lines[index + 1:]:
                if later and not later[0].isspace():
                    break
                block.append(later.strip())
            return " ".join(part for part in block if part)
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            if value[0] == '"':
                try:
                    return json.loads(value)
                except json.JSONDecodeError:
                    pass
            return value[1:-1]
        return value or None
    return None


def light_learned(text):
    if not text:
        return ""
    body = re.sub(r"^---\s*\n.*?\n---\s*\n", "", text, count=1, flags=re.S).strip()
    if len(body) <= 800:
        return body
    boundary = body.rfind("\n", 0, 800)
    return body[:boundary if boundary > 0 else 800].rstrip() + "\n[… use --depth full for the rest]"


def render_topology(start, root, depth):
    output = ["## TOPOLOGY TRACE", f"root: {root}", f"start: {start}"]
    nodes, error = ascent(start, root)
    if error:
        return "\n".join(output + [f"TRACE GAP — {error}"])
    for node in nodes:
        chain_file = node / "LEARNED.md"
        text = read(chain_file)
        label = node.relative_to(root) or Path(".")
        if text is None:
            output.append(f"\n### {label}\nMISSING LINK — {chain_file}")
            continue
        body = text.strip() if depth == "full" else light_learned(text)
        output.append(f"\n### {label} · LEARNED.md\n{body}")
    return "\n".join(output)


def render_work(start, root, depth, fallback=None):
    output = ["## WORK TRACE", f"root: {root}", f"start: {start}"]
    if fallback:
        output.append(f"FALLBACK — {fallback}")
    nodes, error = ascent(start, root)
    if error:
        return "\n".join(output + [f"TRACE GAP — {error}"])
    for node in nodes:
        label = node.relative_to(root) or Path(".")
        spec = next((candidate for candidate in (node / "SPEC.md", node / "README.md") if candidate.is_file()), None)
        if spec is None:
            output.append(f"\n### {label}\nMISSING LINK — no SPEC.md or README.md at {node}")
        else:
            text = read(spec) or ""
            if depth == "full":
                body = text.strip()
            else:
                value = intent(text)
                body = f"intent: {value}" if value else "MISSING INTENT — no readable intent: field"
            output.append(f"\n### {label} · {spec.name}\n{body}")

        notes, resolution_error = resolve_notes(node)
        if resolution_error:
            output.append(f"NOTES RESOLUTION GAP — {resolution_error} at {node}")
        elif notes:
            notes_path, notes_name = notes
            if depth == "full":
                notes_text = read(notes_path)
                if notes_text is None:
                    output.append(f"NOTES RESOLUTION GAP — resolved {notes_name} became unreadable at {notes_path}")
                else:
                    output.append(f"\nNOTES · {notes_name}\n{notes_text.strip()}")
            else:
                try:
                    size = notes_path.stat().st_size
                except OSError:
                    output.append(f"NOTES RESOLUTION GAP — resolved {notes_name} became unreadable at {notes_path}")
                else:
                    output.append(f"NOTES · {notes_name} · {size} bytes · {notes_path}")
        else:
            output.append(f"NOTES GAP — no readable mission notes at {node}")
    return "\n".join(output)


def canonical_seat(session):
    """(member, rig) for a canonical session name, else None so the caller asks `rig whoami`.

    Mirrors the daemon's parse contract (domain/session-name.ts, parseSessionName): the member is
    everything before the FIRST "@" and the rig is everything after it, which may itself contain
    "@". Human-class refs are not seats, and a name outside the session character set
    (validateSessionName) is uncertain, so both keep the lookup."""
    if not session or not SESSION_CHARS.fullmatch(session) or HUMAN_CLASS_SESSION.fullmatch(session):
        return None
    member, at, rig = session.partition("@")
    return (member, rig) if at and member and rig else None


def derive_topology_start(root):
    explicit = os.environ.get("OPENRIG_REFOCUS_TOPOLOGY_NODE")
    if explicit:
        return Path(explicit)
    # A stale session name (one left over from a seat swap) can name a seat that has no folder;
    # only an existing seat directory is trusted, otherwise `rig whoami` decides.
    seat = canonical_seat(os.environ.get("OPENRIG_SESSION_NAME"))
    if seat:
        member, rig = seat
        candidate = root / "rigs" / rig / "seats" / member
        if candidate.is_dir():
            return candidate
    raw = rig_output("whoami", "--json")
    if not raw:
        return None
    try:
        identity = json.loads(raw).get("identity", {})
    except json.JSONDecodeError:
        return None
    rig = identity.get("rigName")
    session = identity.get("sessionName")
    if not rig or not session:
        return None
    seat = str(session).split("@", 1)[0]
    return root / "rigs" / str(rig) / "seats" / seat


def derive_work_start(root):
    explicit = os.environ.get("OPENRIG_REFOCUS_WORK_NODE")
    if explicit:
        return Path(explicit)
    current = Path.cwd().resolve()
    if not under_root(current, root):
        return None
    while under_root(current, root):
        if (current / "SPEC.md").
```

### Core Architecture Module: `packages/daemon/src/db/migrations/001_core_schema.ts`
```
import type { Migration } from "../migrate.js";

export const coreSchema: Migration = {
  name: "001_core_schema.sql",
  sql: `
    -- rigs: top-level topology container
    CREATE TABLE rigs (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- nodes: logical identity within a rig
    -- id = opaque DB primary key (ulid). All FKs reference this.
    -- logical_id = logical name from rig spec (e.g. "orchestrator"). Human-facing.
    CREATE TABLE nodes (
      id          TEXT PRIMARY KEY,
      rig_id      TEXT NOT NULL REFERENCES rigs(id) ON DELETE CASCADE,
      logical_id  TEXT NOT NULL,
      role        TEXT,
      runtime     TEXT,
      model       TEXT,
      cwd         TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(rig_id, logical_id)
    );

    -- edges: relationships between nodes
    CREATE TABLE edges (
      id          TEXT PRIMARY KEY,
      rig_id      TEXT NOT NULL REFERENCES rigs(id) ON DELETE CASCADE,
      source_id   TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
      target_id   TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
      kind        TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Edge integrity: source and target must belong to the same rig.
    -- SQLite CHECK cannot cross-reference tables, so we use a trigger.
    CREATE TRIGGER edge_same_rig_insert
    BEFORE INSERT ON edges
    BEGIN
      SELECT RAISE(ABORT, 'edge source and target must belong to the same rig')
      WHERE (SELECT rig_id FROM nodes WHERE id = NEW.source_id)
         != (SELECT rig_id FROM nodes WHERE id = NEW.target_id);
      SELECT RAISE(ABORT, 'edge rig_id must match source node rig_id')
      WHERE NEW.rig_id != (SELECT rig_id FROM nodes WHERE id = NEW.source_id);
    END;
  `,
};

```

### Core Architecture Module: `packages/daemon/src/db/migrations/024_queue_items.ts`
```
import type { Migration } from "../migrate.js";

/**
 * L3 — Queue (PL-004 Phase A).
 *
 * Owned work for a specific seat. Carries state, provenance, the closure
 * obligation, and the daemon-tracked nudge result. Live runtime state is
 * SQLite-canonical; markdown queue mirrors are read-only debug/export only.
 *
 * State enum (validated at the domain layer):
 *   pending | in-progress | done | blocked | failed | denied | canceled | handed-off
 *
 * Closure-reason enum (required on `done` transitions; hot-potato strict-rejection):
 *   handed_off_to | blocked_on | denied | canceled | no-follow-on | escalation
 *
 * `chain_of_record` and `tags` carry JSON arrays (TEXT-encoded) for forward
 * compat with structured query layers.
 */
export const queueItemsSchema: Migration = {
  name: "024_queue_items.sql",
  sql: `
    CREATE TABLE IF NOT EXISTS queue_items (
      qitem_id TEXT PRIMARY KEY,
      ts_created TEXT NOT NULL,
      ts_updated TEXT NOT NULL,
      source_session TEXT NOT NULL,
      destination_session TEXT NOT NULL,
      state TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'routine',
      tier TEXT,
      tags TEXT,
      blocked_on TEXT,
      handed_off_to TEXT,
      handed_off_from TEXT,
      expires_at TEXT,
      chain_of_record TEXT,
      body TEXT NOT NULL,
      closure_reason TEXT,
      closure_target TEXT,
      closure_required_at TEXT,
      claimed_at TEXT,
      last_nudge_attempt TEXT,
      last_nudge_result TEXT,
      last_heartbeat TEXT,
      resolution TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_queue_items_destination_state ON queue_items(destination_session, state);
    CREATE INDEX IF NOT EXISTS idx_queue_items_source ON queue_items(source_session);
    CREATE INDEX IF NOT EXISTS idx_queue_items_state ON queue_items(state);
    CREATE INDEX IF NOT EXISTS idx_queue_items_handed_off_to ON queue_items(handed_off_to);
    CREATE INDEX IF NOT EXISTS idx_queue_items_closure_overdue ON queue_items(state, closure_required_at) WHERE state = 'in-progress';
  `,
};

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #511** (2026-10-02): **Deleting or renaming a workflow spec file removes cached versions that running workflows still use**
  *Symptoms*: When a workflow spec file is deleted or renamed, a scan removes its cached versions, including an older version that a running workflow is still pinned to. That workflow then can't advance.  **Delete:** cache v1 and then v2 of a spec, start a workflow pinned to v1, delete the file and scan. Both versions are removed from the cache. The running workflow then fails to advance with `spec_not_cached` ("workflow spec <name>@1 is not in the spec cache. Re-run validate..."), and re-running validate can't help, because no file holds v1 any more.  **Rename:** with the same setup, rename the file and scan. The first scan leaves no rows for the spec at all, and the next one re-caches only v2 under the new path. v1 is gone, and the pinned workflow fails the same way.  What should stay as it is: a deleted file disappears from the library.  **How we know:** both cases above were executed in a scratch test with the real scanner, spec cache and workflow runtime from main `37dccd66`, without a daemon. Why a rename empties the cache is inferred from the source, not run: the current version is found by name and version but keeps its old path, so the removal pass deletes it.  A fix is being prepared; we'll link it here.  Refs #503.  — dev-planner@v-openrig-build, on behalf of @mvschwarz 
  **Post-Mortem & Fix Analysis**:
  > Fixed by #512, now merged. Deleting or renaming a spec file no longer removes a cached version that an unfinished workflow (active, waiting or failed) is pinned to, and a rename keeps the current version under its new path. A deleted file still leaves the library as before. One limit: versions removed before this fix aren't restored. It's on main and not in a release yet.  — dev-planner@v-openrig-build, on behalf of @mvschwarz 

- **Issue #503** (2026-10-02): **A parse error in a workflow spec file can overwrite an older cached version and leave a stale error after repair**
  *Symptoms*: When a workflow spec file has two cached versions (v1 and v2) and is then saved with a parse error, the cache records the error by rewriting one of that file's existing versioned rows in place (`writeDiagnostic`, `packages/daemon/src/domain/workflow-spec-cache.ts` around lines 824-851; the row is picked by an unordered query). In our test it rewrote v1. After the error, looking up v1 returned nothing, and repairing the file didn't bring v1 back.  After the file is repaired, a stale error row for that file stays in the spec list, because recovery clears the error only when no valid row with that name and version already exists (around lines 579-588).  Files with a single cached version recover correctly today.  **How we know:** both effects above were executed, running the real cache and scanner from main `88f1ef78` in a scratch test, without a daemon. Inferred from the source, not run: a workflow already running against v1 would then fail to find its spec, since its runtime looks the spec up by name and version.  A fix is being prepared; we'll link it here.  Refs #418, #442.  — dev-planner@v-openrig-build, on behalf of @mvschwarz 
  **Post-Mortem & Fix Analysis**:
  > Fixed by #508, now merged. A parse error now records a separate error entry for the file and never changes a cached version, and that error entry goes away once the file parses again. One limit: versions the old behaviour already damaged aren't restored by this change. From migration 050 on, a damaged row keeps its stored spec, so it stays recoverable, but restoring it is separate work; older ones can't be recovered. It's on main and not in a release yet.  — dev-planner@v-openrig-build, on behalf of @mvschwarz 

- **Issue #494** (2026-10-02): **Paths whose first segment starts with `..` are treated as outside the workspace**
  *Symptoms*: Several "is this path inside that root?" checks test `relative.startsWith("..")`. That's also true for a directory inside the root whose name starts with two dots, such as `..cache`, so a path like `repo/..cache/x` is treated as outside. #458 reports this for the workspace resolver. The same check remains at main `bff0142e` in: - `packages/daemon/src/domain/cwd-resolution.ts:25` (`isPathInsideRoot`). - `packages/cli/src/commands/up.ts:33` (a separate `isPathInsideRoot`). - `packages/daemon/src/domain/restore-check-service.ts:686` (a path checked against the home directory).  **How we know:** source reading at main `bff0142e`; not run.  **One possible approach:** treat a path as leaving the root only when the relative path is `..` itself or starts with `..` followed by a path separator. The fix isn't chosen yet.  Refs #458.  — dev-planner@v-openrig-build, on behalf of @mvschwarz 

- **Issue #493** (2026-10-02): **Daemon-side URLs don't bracket IPv6 hosts**
  *Symptoms*: When the daemon's host is an IPv6 address such as `::1`, several daemon-side callers build URLs like `http://::1:7433`, which Node's URL parser rejects (`ERR_INVALID_URL`). #425 covers the CLI side; this issue is the daemon side.  Unbracketed at main `bff0142e`: - `packages/daemon/src/domain/crash-cart-detect.ts:52`: the health-probe URL. - `packages/daemon/src/domain/crash-cart-discovery.ts:90`: the live-daemon check before a direct read. - `packages/daemon/src/domain/activity-endpoint.ts:39`: the wildcards `::` and `[::]` map to `127.0.0.1`, but a specific IPv6 host such as `::1` passes through unbracketed. - `packages/daemon/src/adapters/pi-runner.ts:651` and `packages/daemon/src/adapters/stub-runner.ts:257`: the runner's base URL built from `OPENRIG_HOST`.  **How we know:** source reading at main `bff0142e`. On Node 22, `new URL("http://::1:7433/healthz")` throws and `new URL("http://[::1]:7433/healthz")` parses. We haven't run a daemon on an IPv6 host.  **One possible approach:** bracket a host that contains `:` when building these URLs, the same rule the CLI-side fix uses. The fix isn't chosen yet.  Refs #425.  — dev-planner@v-openrig-build, on behalf of @mvschwarz 

- **Issue #492** (2026-10-02): **Discovery confuses session names beginning with = with tmux target syntax**
  *Symptoms*: When external tmux sessions named `=lit` and `lit` coexist, discovery can associate the plain session's panes with the literal `=lit` session. `packages/daemon/src/domain/tmux-discovery-scanner.ts:39-43` passes the raw name to `listWindows` and builds `=lit:0` for `listPanes`; the current adapter forwards both targets unchanged. Tmux treats the leading `=` as an exact-match marker and resolves those targets as `lit`; if that session is absent, the lookup can fail. Keep the session literal across both window and pane lookup, using an immutable ID or correctly encoded exact targets such as `==lit:0` for that pane lookup.  **How we know:** source reading and in-process checks at main `bff0142e`.  **One possible approach:** Cover literal-only, plain-only and both-present cases, including distinct window indexes; the target rule is defined in [tmux 3.6a](https://github.com/tmux/tmux/blob/3.6a/cmd-find.c#L1023-L1026). The fix isn't chosen yet.  — dev-planner@v-openrig-build, on behalf of @mvschwarz 
  **Post-Mortem & Fix Analysis**:
  > Hi @mvschwarz, I'd like to take this one.  Proposed fix, kept to the scanner: always pass exact-encoded targets, `listWindows("=" + name)` and `listPanes("=" + name + ":" + index)`. A session literally named `=lit` becomes `==lit` / `==lit:0` (per the tmux 3.6a rule you linked), and a plain `lit` becomes `=lit` / `=lit:0`. The adapter is unchanged, so `seat-switch-client-service` isn't affected.  Tests: scanner unit tests for literal-only, plain-only and both-present sessions with different window indexes, plus a check against real tmux.  If you'd rather go with immutable session or window IDs, I'll do that instead.  AI disclosure: I'm using Claude Code to help.
  > Thanks, yes please, go ahead. Always passing exact-encoded targets, `listWindows("=" + name)` and `listPanes("=" + name + ":" + index)`, covers both lookups, and keeping the adapter unchanged keeps the change contained. The scanner tests you listed, literal-only, plain-only, and both present with different window indexes, plus a check against real tmux, sound right. Once you open the PR, we'll review it.  — comm-replies@v-openrig-build, on behalf of @mvschwarz
  > Opened #515 with the exact-target approach described above. It includes before/after results against real tmux 3.6 for the both-present, `=lit`-only and plain-only cases. Happy to switch to immutable IDs if you'd prefer.

- **Issue #491** (2026-10-02): **Unknown audit action verbs return a server error instead of a bad-request error**
  *Symptoms*: `GET /api/mission-control/audit?action_verb=unsupported` returns HTTP 500 with `error: "audit_query_failed"`. `packages/daemon/src/domain/mission-control/audit-browse.ts:68-72` rejects the unknown value, but `packages/daemon/src/routes/mission-control.ts:455-464` maps that input error to 500. An in-process request through the actual route reproduces 500; the same setup with `action_verb=approve` returns 200.  **How we know:** source reading and in-process checks at main `bff0142e`.  **One possible approach:** Return HTTP 400 for an unsupported verb, preserving the supported-values message and keeping genuine query failures as server errors. The fix isn't chosen yet.  — dev-planner@v-openrig-build, on behalf of @mvschwarz 

- **Issue #490** (2026-10-03): **Declared overdue and view-refresh events have no producers**
  *Symptoms*: The daemon declares `qitem.closure_overdue` and `mission_control.view_refreshed`, but its implementation does not construct either event (`packages/daemon/src/domain/types.ts:251,309`). Queue watch accepts the overdue event, and Mission Control watch accepts the refresh event; the view bridge and activity feed also recognize overdue notifications. Consumers waiting specifically for these event types receive no signal when a queue item becomes overdue or a view is recomputed. Source references and a scan of runtime event-object declarations find no producer; the same scan finds ordinary `queue.created` producers.  **How we know:** source reading and in-process checks at main `bff0142e`.  **One possible approach:** Make these notifications match the declared contract, or retire unsupported event promises and update their consumers; existing polling and other refresh events need separate treatment. The fix isn't chosen yet.  — dev-planner@v-openrig-build, on behalf of @mvschwarz 

- **Issue #489** (2026-10-02): **Recent observations shows the oldest 50 stream items**
  *Symptoms*: `GET /api/mission-control/views/recent-observations` stops showing new observations once more than 50 unarchived items exist. `packages/daemon/src/domain/mission-control/mission-control-read-layer.ts:264` requests only a limit; `StreamStore.list` defaults to ascending time order (`packages/daemon/src/domain/stream-store.ts:201-208`). With 61 ordered items, the route returns items 1–50 and excludes item 61. The existing `direction: "latest"` store option returns items 12–61, preserving chronological order within that newest page.  **How we know:** source reading and in-process checks at main `bff0142e`.  **One possible approach:** Select the newest bounded page so the view continues to show recent activity. The fix isn't chosen yet.  — dev-planner@v-openrig-build, on behalf of @mvschwarz 

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

### Incident Patch 1: `0f2ea7df` (2026-10-06)
**Commit Message**: fix(install): run the installed compatibility checker explicitly (#841)

npm 11 and later can skip @openrig/cli's postinstall script, which checks that Node.js and the SQLite binding work together. The one-line installer now runs that checker itself after installing the package, stops with the checker's own output and exit if it fails, and says plainly when the checker could not be found. Nothing on the machine is changed to make the check pass.

**File**: `scripts/install.sh` (modified, +13/-1)
```diff
@@ -36,6 +36,8 @@ install_main() {
     '  [2/4] npm install -g @openrig/cli' \
     '        Installs the published CLI and dependencies into your npm global prefix.' \
     '        npm prefix -g locates that installation; its bin/rig is used below.' \
+    '        Run node "$(npm root -g)/@openrig/cli/scripts/check-abi.mjs" if present.' \
+    '        Check Node/SQLite explicitly even if npm skipped postinstall; report if unavailable.' \
     '  [3/4] rig setup --dry-run' \
     "        Show the installed version's setup plan without applying it." \
     '  [4/4] rig setup' \
@@ -46,7 +48,7 @@ install_main() {
     'The wrapper does not log in, choose a permission policy, launch a team or open a kernel conversation.' \
     'Node advice: 22 or 24; use 22 on Apple silicon. Install Node with npm using' \
     'your package manager or the official Node installer if either is missing.' \
-    'The package postinstall owns compatibility checks: below 22 and odd majors' \
+    'The installed package checker owns compatibility checks: below 22 and odd majors' \
     'are rejected; later even majors warn as untested. No automatic Node or permission repair.'
 
   if [ "$1" = '--dry-run' ]; then
@@ -72,6 +74,16 @@ install_main() {
   fi
   PATH="$install_prefix/bin:$PATH"
   export PATH
+  if install_modules=$(npm root -g); then :; else
+    install_failed "$?" '[2/4] npm root -g'
+  fi
+  install_checker="$install_modules/@openrig/cli/scripts/check-abi.mjs"
+  if [ -f "$install_checker" ]; then
+    install_step 2/4 node "$install_checker"
+    printf '\n%s\n' 'Node/SQLite compatibility check passed.'
+  else
+    printf '\nNode/SQLite compatibility check SKIPPED: installed checker not found at %s\n' "$install_checker" >&2
+  fi
   install_step 3/4 "$install_rig" setup --dry-run
   install_step 4/4 "$install_rig" setup
   printf '\n%s\n' 'Follow the next steps printed by rig setup: choose your providers, then rig up.'
```

**File**: `scripts/install.test.mjs` (modified, +49/-7)
```diff
@@ -14,16 +14,28 @@ function fixture(t, overrides = {}) {
   t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
   const bin = path.join(dir, "tools");
   const prefix = path.join(dir, "npm prefix with spaces");
+  const modules = path.join(dir, "global modules with spaces");
+  const checker = path.join(modules, "@openrig", "cli", "scripts", "check-abi.mjs");
   fs.mkdirSync(bin);
   fs.mkdirSync(path.join(prefix, "bin"), { recursive: true });
+  fs.mkdirSync(path.dirname(checker), { recursive: true });
+  fs.writeFileSync(checker, `import fs from "node:fs";
+fs.appendFileSync(process.env.TEST_LOG, "abi:check\\n");
+console.log("ABI native output");
+console.error("ABI native detail");
+process.exitCode = Number(process.env.ABI_EXIT || 0);
+`);
   const write = (file, body) => fs.writeFileSync(file, `#!/bin/sh\n${body}\n`, { mode: 0o755 });
-  write(path.join(bin, "node"), 'printf "node:%s\\n" "$*" >>"$TEST_LOG"; printf "v22.22.1\\n"');
+  write(path.join(bin, "node"), 'printf "node:%s\\n" "$*" >>"$TEST_LOG"; if [ "$1" = --version ]; then printf "v22.22.1\\n"; else exec "$TEST_NODE" "$@"; fi');
   write(path.join(bin, "npm"), `
 printf 'npm:%s\n' "$*" >>"$TEST_LOG"
 case "$*" in
-  --version) printf '10.9.4\n' ;;
-  'install -g @openrig/cli') printf 'npm native output\n'; printf 'npm native error\n' >&2; exit "\${INSTALL_EXIT:-0}" ;;
+  --version) printf '%s\n' "$TEST_NPM_VERSION" ;;
+  'install -g @openrig/cli')
+    if [ "$SKIP_POSTINSTALL" = 1 ]; then printf 'npm warn install-scripts postinstall skipped\n' >&2; fi
+    printf 'npm native output\n'; printf 'npm native error\n' >&2; exit "\${INSTALL_EXIT:-0}" ;;
   'prefix -g') printf '%s\n' "$TEST_PREFIX"; exit "\${PREFIX_EXIT:-0}" ;;
+  'root -g') printf '%s\n' "$TEST_MODULES"; exit "\${ROOT_EXIT:-0}" ;;
   *) exit 90 ;;
 esac`);
   write(path.join(bin, "rig"), 'printf "STALE\\n" >>"$TEST_LOG"; exit 91');
@@ -37,8 +49,8 @@ case "$*" in
     printf 'Next steps: choose providers, then rig up\n'; exit "\${SETUP_EXIT:-0}" ;;
   *) exit 93 ;;
 esac`);
-  const env = { PATH: bin, HOME: dir, TEST_PREFIX: prefix, TEST_LOG: path.join(dir, "calls"), ...overrides };
-  return { dir, bin, prefix, env,
+  const env = { PATH: bin, HOME: dir, TEST_PREFIX: prefix, TEST_MODULES: modules, TEST_NODE: process.execPath, TEST_NPM_VERSION: "10.9.4", TEST_LOG: path.join(dir, "calls"), ...overrides };
+  return { dir, bin, prefix, checker, env,
     calls: () => fs.existsSync(env.TEST_LOG) ? fs.readFileSync(env.TEST_LOG, "utf8").trim().split("\n") : [],
     run: (...args) => spawnSync("/bin/sh", [script, ...args], { env, encoding: "utf8", timeout: 10000 }),
   };
@@ -51,7 +63,7 @@ test("dry run needs no tools and only prints the complete plan", t => {
   f.env.PATH = path.join(f.dir, "absent");
   const r = f.run("--dry-run");
   assert.equal(r.status, 0, r.stderr);
-  for (const text of ["[1/4]", "npm install -g @openrig/cli", "rig setup --dry-run", "[4/4] rig setup", "both Claude Code and Codex", "setup may start cmux while configuring its control", "launch a team or open a kernel conversation", "Dry run:"]) assert.ok(r.stdout.includes(text), text);
+  for (const text of ["[1/4]", "npm install -g @openrig/cli", "npm root -g", "scripts/check-abi.mjs", "even if npm skipped postinstall", "rig setup --dry-run", "[4/4] rig setup", "both Claude Code and Codex", "setup may start cmux while configuring its control", "launch a team or open a kernel conversation", "Dry run:"]) assert.ok(r.stdout.includes(text), text);
   assert.deepEqual(f.calls(), []);
 });
 
@@ -68,6 +80,8 @@ for (const tool of ["node", "npm"]) test(`missing ${tool} reports the prerequisi
 for (const [variable, code, step, command] of [
   ["INSTALL_EXIT", 37, 2, "npm install -g @openrig/cli"],
   ["PREFIX_EXIT", 38, 2, "npm prefix -g"],
+  ["ROOT_EXIT", 45, 2, "npm root -g"],
+  ["ABI_EXIT", 44, 2, "check-abi.mjs"],
   ["PREVIEW_EXIT", 39, 3, "setup --dry-run"],
   ["SETUP_EXIT", 40, 4, "setup"],
 ]) test(`${command} failure preserves status and native output`, t => {
@@ -81,17 +95,45 @@ for (const [variable, code, step, command] of [
   assert.match(r.stderr, /npm native error/);
   assert.ok(!r.stdout.includes("Follow the next steps"));
   if (step < 4) assert.ok(!f.calls().includes("installed:setup"));
+  if (variable === "ABI_EXIT") {
+    assert.match(r.stdout, /ABI native output/);
+    assert.match(r.stderr, /ABI native detail/);
+    assert.ok(!r.stdout.includes("Node/SQLite compatibility check passed."));
+    assert.ok(!f.calls().includes("installed:setup --dry-run"));
+  }
 });
 
 test("installed rig wins over stale PATH and a prefix containing spaces works", t => {
   const f = fixture(t);
   const r = f.run();
   assert.equal(r.status, 0, r.stderr);
-  assert.deepEqual(f.calls(), ["node:--version", "npm:--version", "npm:install -g @openrig/cli", "npm:prefix -g", "installed:setup --dry-run", "installed:setup"]);
+  assert.deepEqual(f.calls(), ["node:--version", "npm:--version", "npm:instal
```

---

### Incident Patch 2: `572dba83` (2026-10-06)
**Commit Message**: docs: Node on Linux, the npm 11 install-scripts warning, and cmux on macOS only (#839)

From a blank-machine install on Ubuntu 24.04: the README and getting-started now name a Linux route to a supported Node.js (nvm or NodeSource, since the distribution's own may be 18), say cmux is macOS-only and optional, and explain that npm 11 and later can skip the CLI's postinstall Node.js and SQLite check with an install-scripts warning, which is expected, and how to run that check directly.

**File**: `README.md` (modified, +4/-2)
```diff
@@ -20,7 +20,7 @@ Not setting this up today? Get the next walkthrough and occasional OpenRig updat
 
 ## Install and first run
 
-Requires Node.js 22 or 24 and tmux, on macOS or Linux. On a Mac with Apple silicon, use Node.js 22 ([compatibility history](docs/releases/v0.5.15.md#known-compatibility-limitation)). Native Windows is not supported yet, and WSL2 has not been tested. Launching a rig writes provider hooks and workspace trust settings. Before running the commands below, read [what OpenRig changes on your machine](#what-openrig-changes-on-your-machine) and back up the relevant files.
+Requires Node.js 22 or 24 and tmux, on macOS or Linux. On Linux, the distribution's own Node.js can be older (Ubuntu 24.04's is 18); install a supported version with [nvm](https://github.com/nvm-sh/nvm) (`nvm install 22`) or NodeSource. On a Mac with Apple silicon, use Node.js 22 ([compatibility history](docs/releases/v0.5.15.md#known-compatibility-limitation)). Native Windows is not supported yet, and WSL2 has not been tested. Launching a rig writes provider hooks and workspace trust settings. Before running the commands below, read [what OpenRig changes on your machine](#what-openrig-changes-on-your-machine) and back up the relevant files.
 
 ```bash
 npm install -g @openrig/cli
@@ -29,6 +29,8 @@ rig setup --dry-run
 
 To install with Bun instead, run `bun add -g @openrig/cli`. OpenRig still runs on Node.js, so install Node.js 22 as well. Bun may block this package's postinstall script, in which case the Node.js and SQLite check described under [what OpenRig changes on your machine](#what-openrig-changes-on-your-machine) does not run at install time.
 
+npm 11 and later can skip that postinstall script and print `npm warn install-scripts` naming `@openrig/cli`. That's expected: the CLI still works, and only the Node.js and SQLite check was skipped. To run it yourself, use `node "$(npm root -g)/@openrig/cli/scripts/check-abi.mjs"`; `rig doctor` checks the Node.js version only.
+
 Choose the working account you already have: **Claude Code, Codex, or both**. Reuse an explicit choice; no second subscription is required. `rig setup --dry-run` previews the broader setup, but applying `rig setup` checks both harnesses and installs a missing one, and on macOS cmux too. It is optional for the [selected-provider path](docs/reference/getting-started.md#choose-your-providers).
 
 Before launching, your agent asks once: **“Allow your agents to run OpenRig commands without repeated permission prompts?” Yes — recommended / No — keep prompts.** This covers every `rig` command, including starting/stopping agents and configuration, at personal project scope unless you explicitly choose user-wide sessions. It is not global YOLO or permission to invent work. On Yes, the agent [adds and verifies native rules](docs/reference/getting-started.md#have-your-agent-configure-permissions); No or no answer leaves settings unchanged. An existing explicit choice is reused. Say “Undo the OpenRig command allowances added by this setup” to remove only its additions.
@@ -369,7 +371,7 @@ Optional:
 
 ## Setup and Troubleshooting
 
-- `rig setup` attempts core machine preparation: tmux, cmux, Claude Code, Codex, and tmux defaults. It reports what it tried and what actually succeeded. If something fails, it gives the local agent enough context to finish the job.
+- `rig setup` attempts core machine preparation: tmux, Claude Code, Codex and tmux defaults, plus cmux on macOS. cmux is optional and macOS-only; elsewhere setup skips it and `rig doctor` only warns that it's missing. It reports what it tried and what actually succeeded. If something fails, it gives the local agent enough context to finish the job.
 - `rig setup --full` attempts a broader operator workstation setup (jq, gh) on top of core.
 - `rig doctor` inspects current system health and helps diagnose problems after setup. Use it when something stops working or after machine changes.
 
```

**File**: `docs/reference/getting-started.md` (modified, +5/-2)
```diff
@@ -5,7 +5,10 @@ first-project recipes provide the same two seats: an outcome owner and an
 independent checker. Choose Claude Code, Codex, or one of each using the accounts
 you already have. Terminal-provider support does not change the harness or login.
 
-You need Node.js 22 or 24 and tmux, on macOS or Linux. On a Mac with Apple
+You need Node.js 22 or 24 and tmux, on macOS or Linux. On Linux, the
+distribution's own Node.js can be older (Ubuntu 24.04's is 18); install a
+supported version with [nvm](https://github.com/nvm-sh/nvm) (`nvm install 22`)
+or NodeSource. On a Mac with Apple
 silicon, use Node.js 22 (see the [compatibility
 history](../releases/v0.5.15.md#known-compatibility-limitation)). Native
 Windows is not supported yet, and WSL2 has not been tested. Node 20 and
@@ -88,7 +91,7 @@ command before proceeding. Confirm account access to any pin; if unavailable,
 ask for a supported model choice rather than silently substituting a model or
 provider. After launch, confirm the actual native model before assigning work.
 
-Install OpenRig (`npm install -g @openrig/cli`) and check `tmux -V`. Check **only the selected providers**:
+Install OpenRig (`npm install -g @openrig/cli`) and check `tmux -V`. With npm 11 or later, an `npm warn install-scripts` line for `@openrig/cli` is expected: only the postinstall Node.js and SQLite check was skipped, and `node "$(npm root -g)/@openrig/cli/scripts/check-abi.mjs"` runs it. Check **only the selected providers**:
 
 - Claude Code: `claude --version` and `claude auth status`. If sign-in is missing,
   ask once: “Please run `claude auth login` in your launch environment.”
```

---

### Incident Patch 3: `e6aaeb6c` (2026-10-06)
**Commit Message**: docs(tui): explain copying wrapped attachment commands (#833)

When the TUI shows plain-terminal attach commands because Herdr is unavailable, it now tells the person to widen the terminal until a wrapped command fits on one line before copying it. Tests cover the warning at the narrow detail width and the exact local attach command.

**File**: `packages/tui/src/terminals/terminal-model.ts` (modified, +1/-0)
```diff
@@ -115,6 +115,7 @@ export function terminalLines(state: ViewState, snap: FleetSnapshot, width: numb
     lines.push({ text: `Herdr unavailable on the selected daemon (${read.daemonTarget ?? "address unreported"}). Start/connect Herdr there and refresh, or use the plain-terminal commands below. Nothing opens automatically.` });
     if (page.length) {
       lines.push({ text: `Plain terminal · ${preview.view}: open a NEW terminal on the machine running that daemon, then run one of these commands. Use a separate terminal for each seat; do not run in an agent's terminal.` });
+      lines.push({ text: "If a command wraps, widen this terminal until it fits on one line before copying." });
       for (const member of page) {
         // A plain SSH terminal needs a remote PTY; keep the composer's quoted host and target.
         const command = member.paneCommand.replace(/^ssh /, "ssh -t ");
```

**File**: `packages/tui/test/terminal-journey.test.ts` (modified, +4/-0)
```diff
@@ -106,6 +106,10 @@ describe("terminal browser → preview → explicit Open", () => {
     expect(lines.map(l => l.text).join("\n")).toContain("Herdr unavailable");
     expect(lines.some(l => l.action?.type === "act")).toBe(false);
     expect(lines.some(l => l.action?.type === "back")).toBe(true);
+    const narrow = terminalLines(view.get(), snap, 54).map(line => line.text).join(" ").replace(/\s+/g, " ");
+    expect(narrow).toContain("If a command wraps, widen this terminal until it fits on one line before copying.");
+    const wide = terminalLines(view.get(), snap, 1000).map(line => line.text);
+    expect(wide).toContain("env -u TMUX tmux attach -t 'member-2'");
     expect(effects).toEqual([]);
   });
 
```

---

### Incident Patch 4: `35d55ae2` (2026-10-06)
**Commit Message**: fix(tui): give attachment commands when Herdr is unavailable (#831)

When Herdr is unavailable on the selected daemon, the TUI's terminal preview no longer stops at a dead end. It names the daemon and view, says to open a new terminal on the machine running that daemon, and lists each member's exact attach command (the composer's own pane command, with ssh -t for remote members). Nothing opens automatically.

**File**: `packages/tui/src/terminals/terminal-model.ts` (modified, +15/-1)
```diff
@@ -32,12 +32,15 @@ export interface TerminalPreview {
 export interface TerminalRead {
   catalog: TerminalEntry[];
   catalogLoaded?: boolean;
+  daemonTarget?: string;
   preview: TerminalPreview | null;
   error?: string;
 }
 
 export async function readTerminals(client: DaemonClient, view?: string | null): Promise<TerminalRead> {
   const result: TerminalRead = { catalog: [], preview: null };
+  // Display the endpoint without URL credentials, query parameters or fragments.
+  try { result.daemonTarget = new URL(client.baseUrl).origin; } catch { /* unavailable target */ }
   try {
     const listing = await client.terminalViews();
     if (!Array.isArray(listing.saved) || !Array.isArray(listing.rigs)) throw new Error("Terminal names could not be read.");
@@ -107,7 +110,18 @@ export function terminalLines(state: ViewState, snap: FleetSnapshot, width: numb
   // Actions precede the diagram so explicit Open/Back remain accessible at 80×24.
   lines.push({ text: "Back to views", action: { type: "back" } });
   if (preview.status.available && plan.opened.length) lines.push({ text: `Open in Herdr · all ${plan.pages.length} pages`, action: { type: "act", act: "open-terminal", view: preview.view, expectedPlan: preview.planId } });
-  else lines.push({ text: preview.status.available ? "Nothing attachable; no space will be opened." : "Herdr unavailable on the selected daemon host. Start/connect Herdr there, then refresh this preview. No automatic recovery." });
+  else if (preview.status.available) lines.push({ text: "Nothing attachable; no space will be opened." });
+  else {
+    lines.push({ text: `Herdr unavailable on the selected daemon (${read.daemonTarget ?? "address unreported"}). Start/connect Herdr there and refresh, or use the plain-terminal commands below. Nothing opens automatically.` });
+    if (page.length) {
+      lines.push({ text: `Plain terminal · ${preview.view}: open a NEW terminal on the machine running that daemon, then run one of these commands. Use a separate terminal for each seat; do not run in an agent's terminal.` });
+      for (const member of page) {
+        // A plain SSH terminal needs a remote PTY; keep the composer's quoted host and target.
+        const command = member.paneCommand.replace(/^ssh /, "ssh -t ");
+        lines.push({ text: `${member.label} · ${member.seat}` }, { text: `env -u TMUX ${command}` });
+      }
+    }
+  }
   lines.push({ text: "Refresh preview", action: { type: "terminal-preview", view: preview.view } });
   if (plan.pages.length > 1) {
     if (pageIndex > 0) lines.push({ text: "Previous page", action: { type: "terminal-page", page: pageIndex - 1 } });
```

**File**: `packages/tui/test/terminal-journey.test.ts` (modified, +23/-0)
```diff
@@ -109,6 +109,29 @@ describe("terminal browser → preview → explicit Open", () => {
     expect(effects).toEqual([]);
   });
 
+  it("keeps the selected daemon and remote member in plain-terminal guidance", async () => {
+    providerAlive = false;
+    const remote = { id: "remote view", name: "Remote", members: [{ seat: "quoted-seat", tmuxSession: "seat with spaces", host: "remote", readOnly: true }] };
+    const provider = new HerdrAdapter({ transportFactory: () => ({ probe: async () => ({ alive: false, version: null, protocol: null }), request: async () => { throw new Error("must remain passive"); } }) });
+    service = new TerminalService({ resolveProvider: () => provider, viewsStore: { get: () => remote, list: () => [remote] }, listRigNames: () => [], listRigSeats: () => null, listPodSeats: () => null, listScopeSeats: () => null, resolveHost: () => ({ id: "remote", transport: "ssh", target: "other.example", user: "viewer" }) as any, hasSession: () => { throw new Error("remote is not a local session"); } });
+    client = new DaemonClient({ baseUrl: "http://selected.example:7654", fetchImpl: (async (url, init) => {
+      const u = new URL(String(url));
+      const app = new Hono(); app.use("*", async (c, next) => { c.set("terminalService" as never, service); await next(); }); app.route("/api/terminal", terminalRoutes());
+      return app.request(u.pathname + u.search, init);
+    }) as typeof fetch });
+    view.dispatch({ type: "terminal-preview", view: "saved:remote view" }); await refresh();
+    const text = terminalLines(view.get(), snap, 1000).map(line => line.text).join("\n");
+    expect(text).toContain("http://selected.example:7654");
+    expect(text).toContain("saved:remote view");
+    expect(text).toContain("machine running that daemon");
+    const command = snap.terminals!.preview!.composed.pages[0]![0]!.paneCommand;
+    expect(text).toContain(`env -u TMUX ${command.replace(/^ssh /, "ssh -t ")}`);
+    expect(text).toContain("viewer@other.example");
+    expect(text).toContain("seat with spaces");
+    expect(text).toContain("attach -r");
+    expect(effects).toEqual([]);
+  });
+
   it("preserves a failed Open as failure, without a success notice", async () => {
     const p = await client.previewTerminal("saved:fixture"); failPage = true;
     await expect(client.openTerminal(p.view, p.planId)).rejects.toThrow("fixture layout refused");
```

---

### Incident Patch 5: `b02986a5` (2026-10-05)
**Commit Message**: docs(as-built): verify the A-D as-built pages against 82eb4bed (#826)

Restamps the 13 as-built A-D pages to 82eb4bed. Citations move with their source: 174 line numbers are renumbered, and one cited block grows by a line. Adds the kernel operational default (who gets it, the Claude allow list, Codex full_bypass, the per-launch decision, the floor fallback, the kernel_default status source) and the plugin skills now carried in the managed loadout with their three warnings. Updates the file counts that changed.

**File**: `docs/as-built/README.md` (modified, +3/-3)
```diff
@@ -10,14 +10,14 @@ applies-when: |
   its own source-verification stamp.
 siblings: [codemap.md, arteries.md, test-layers.md, cli-reference.md, frontmatter-schema.md]
 prerequisite-reads: []
-last-verified-against-source: a350c59b5a5fb37ee4a21b1026b595068b603df1
+last-verified-against-source: 82eb4bed0fbf4ce7df038090b43211a0b8a1aa1d
 last-updated: 2026-10-05
 ---
 
 # OpenRig as-built docs
 
 These pages describe the code and point to its owning files. This index was checked against
-main commit `a350c59b5a5fb37ee4a21b1026b595068b603df1`. A linked module's
+main commit `82eb4bed0fbf4ce7df038090b43211a0b8a1aa1d`. A linked module's
 `last-verified-against-source` is its own verification boundary; updating this index does not
 revalidate that module or identify a running daemon or published package.
 
@@ -93,7 +93,7 @@ At the named commit there are **26 Markdown files**: **14** under `architecture/
 these counts from the repository root:
 
 ```bash
-source_commit=a350c59b5a5fb37ee4a21b1026b595068b603df1
+source_commit=82eb4bed0fbf4ce7df038090b43211a0b8a1aa1d
 git ls-tree -r --name-only "$source_commit" -- docs/as-built | grep -E '\.md$' | wc -l
 git ls-tree -r --name-only "$source_commit" -- docs/as-built/architecture | grep -E '\.md$' | wc -l
 git ls-tree -r --name-only "$source_commit" -- docs/as-built/ui | grep -E '\.md$' | wc -l
```

**File**: `docs/as-built/architecture.md` (modified, +2/-2)
```diff
@@ -9,14 +9,14 @@ applies-when: |
   overview or the current as-built module index linked here.
 siblings: [README.md, codemap.md, arteries.md, test-layers.md, ui.md]
 prerequisite-reads: []
-last-verified-against-source: a350c59b5a5fb37ee4a21b1026b595068b603df1
+last-verified-against-source: 82eb4bed0fbf4ce7df038090b43211a0b8a1aa1d
 last-updated: 2026-10-05
 ---
 
 # Architecture module navigation
 
 This compatibility page points to the modular documentation. Its links were checked against main
-`a350c59b5a5fb37ee4a21b1026b595068b603df1`; the linked pages retain their own source stamps.
+`82eb4bed0fbf4ce7df038090b43211a0b8a1aa1d`; the linked pages retain their own source stamps.
 
 - [Repository architecture](../../ARCHITECTURE.md): package boundaries, request flow, derived
   source counts and contributor recipes.
```

**File**: `docs/as-built/architecture/adapters-and-runtimes.md` (modified, +75/-52)
```diff
@@ -12,7 +12,7 @@ applies-when: |
   layer).
 siblings: [daemon-core.md, agent-spec-and-startup.md, lifecycle-snapshot-restore.md]
 prerequisite-reads: [../README.md, daemon-core.md]
-last-verified-against-source: a350c59b5a5fb37ee4a21b1026b595068b603df1
+last-verified-against-source: 82eb4bed0fbf4ce7df038090b43211a0b8a1aa1d
 last-updated: 2026-10-05
 ---
 
@@ -27,62 +27,62 @@ adapters (`ClaudeResumeAdapter`, `CodexResumeAdapter`, `PiResumeAdapter` and
 this harness *actually* resume, or did it silently fresh-launch?" truthfully
 rather than optimistically.
 
-> Verified against source at main `a350c59b5a5fb37ee4a21b1026b595068b603df1`. Each count below sits beside the
+> Verified against source at main `82eb4bed0fbf4ce7df038090b43211a0b8a1aa1d`. Each count below sits beside the
 > command that produces it; run the command from the repository root to refresh
 > it.
 
 ## 1. The five-method RuntimeAdapter contract
 
-`RuntimeAdapter` is `packages/daemon/src/domain/runtime-adapter.ts:139`
+`RuntimeAdapter` is `packages/daemon/src/domain/runtime-adapter.ts:141`
 (`interface RuntimeAdapter`). Every adapter declares a `readonly runtime`
-string (`runtime-adapter.ts:142`) and implements five required methods
-(`runtime-adapter.ts:148–172`; **5** =
+string (`runtime-adapter.ts:144`) and implements five required methods
+(`runtime-adapter.ts:150–174`; **5** =
 `sed -n '/^export interface RuntimeAdapter/,/^}/p' packages/daemon/src/domain/runtime-adapter.ts | grep -c -E '^  [a-zA-Z]+\('`):
 
 | Method | Signature (`runtime-adapter.ts`) | Responsibility |
 |---|---|---|
-| `listInstalled` | `(binding)` `:149` | List currently installed/projected resources for a node. |
-| `project` | `(plan, binding)` `:152` | Project resources from a `ProjectionPlan` to the runtime's target locations. |
-| `deliverStartup` | `(files, binding, sendInteractiveText?)` `:156` | Deliver resolved startup files to the runtime. The startup orchestrator passes the optional third argument for Claude Code only, so Claude's `send_text` files go through the checked send described in `agent-spec-and-startup.md`. |
-| `launchHarness` | `(binding, opts)` `:166` | Launch the harness inside the bound tmux session; return a resume token. |
+| `listInstalled` | `(binding)` `:151` | List currently installed/projected resources for a node. |
+| `project` | `(plan, binding)` `:154` | Project resources from a `ProjectionPlan` to the runtime's target locations. |
+| `deliverStartup` | `(files, binding, sendInteractiveText?)` `:158` | Deliver resolved startup files to the runtime. The startup orchestrator passes the optional third argument for Claude Code only, so Claude's `send_text` files go through the checked send described in `agent-spec-and-startup.md`. |
+| `launchHarness` | `(binding, opts)` `:168` | Launch the harness inside the bound tmux session; return a resume token. |
 | `checkReady` | `(binding)` `:172` | Probe whether the harness is responsive and ready. |
 
-The interface also has two optional members: `claudeManagedLaunch` (`:141`)
-and `skillTargetPath?()` (`:146`), implemented by `PiRuntimeAdapter`
+The interface also has two optional members: `claudeManagedLaunch` (`:143`)
+and `skillTargetPath?()` (`:148`), implemented by `PiRuntimeAdapter`
 (`pi-runtime-adapter.ts:118`) and overridden by `OmpRuntimeAdapter`
 (`omp-runtime-adapter.ts:12`).
 
 Startup *action* execution (`slash_command` / `send_text`) is explicitly **not**
-part of this contract — the contract docstring (`runtime-adapter.ts:133–138`)
+part of this contract — the contract docstring (`runtime-adapter.ts:135–140`)
 states actions belong to the `StartupOrchestrator` *after* `checkReady()`. The
 orchestrator delivery split is in `agent-spec-and-startup.md`.
 
 ### `launchHarness` opts and the fork seam
 
 `launchHarness` opts is `{ name: string; resumeToken?: string; forkSource?:
-ForkSource }` (`runtime-adapter.ts:168`).
+ForkSource }` (`runtime-adapter.ts:170`).
 
-Per the contract docstring (`runtime-adapter.ts:158–165`) `resumeToken` and
+Per the contract docstring (`runtime-adapter.ts:160–167`) `resumeToken` and
 `forkSource` are mutually exclusive — if both are provided the adapter **must
 refuse** with a clear error, not guess; `forkSource` triggers a fork and the
 captured token is the NEW post-fork token, never the parent. `ForkSource` is
-`runtime-adapter.ts:128` (`kind: "native_id" | "artifact_path" | "name" |
-"last"`, `:129`; v1 MVP accepts `native_id` only — other shapes rejected at
-schema validation, docstring `:118–127`, and by the Claude, Codex and Pi
+`runtime-adapter.ts:130` (`kind: "native_id" | "artifact_path" | "name" |
+"last"`, `:131`; v1 MVP accepts `native_id` only — other shapes rejected at
+schema validation, docstring `:120–129`, and by the Claude, Codex and Pi
 adapters themselves).
 
 ### `HarnessLaunchResult` is a discriminated union with an honest failure arm
 
-`HarnessLaunchResult` is a **discriminated union** (`runtime-adapter.ts:93–98`):
+
```

**File**: `docs/as-built/architecture/agent-spec-and-startup.md` (modified, +20/-20)
```diff
@@ -11,7 +11,7 @@ applies-when: |
   resolve and preserve identity.
 siblings: [daemon-core.md, adapters-and-runtimes.md, lifecycle-snapshot-restore.md, packaging-bootstrap-bundles.md]
 prerequisite-reads: [../README.md, daemon-core.md]
-last-verified-against-source: a350c59b5a5fb37ee4a21b1026b595068b603df1
+last-verified-against-source: 82eb4bed0fbf4ce7df038090b43211a0b8a1aa1d
 last-updated: 2026-10-05
 ---
 
@@ -22,7 +22,7 @@ and identity-addressable topology. The spec-and-startup contract: parse →
 resolve → project → deliver pre-launch files → persist replay context → launch
 → wait → deliver post-launch files.
 
-> Verified against source at main `a350c59b5a5fb37ee4a21b1026b595068b603df1`. `domain/…` and `routes/…` paths
+> Verified against source at main `82eb4bed0fbf4ce7df038090b43211a0b8a1aa1d`. `domain/…` and `routes/…` paths
 > are under `packages/daemon/src/`; a bare file name such as
 > `rigspec-schema.ts:115` is in `packages/daemon/src/domain/`. Each count sits
 > beside the command that produces it; run the command from the repository
@@ -65,27 +65,27 @@ resolve → project → deliver pre-launch files → persist replay context →
 Restore/snapshot types are detailed in `lifecycle-snapshot-restore.md`; the
 spec/projection types live here.
 
-- **ResolvedNodeConfig** (`profile-resolver.ts:32`) — output of profile
+- **ResolvedNodeConfig** (`profile-resolver.ts:33`) — output of profile
   resolution. Carries effective runtime/model/effort/cwd, narrowed restore policy,
   selected resources, layered startup block, resolved spec identity, and the
   resolved compaction strategy, continuity mechanic, lifecycle, activity and
   skill loadout.
 - **ProjectionPlan** (`projection-planner.ts:42`) — runtime projection plan for
   a node: runtime, cwd, projection entries, startup block, diagnostics,
   conflict/no-op classifications.
-- **RuntimeAdapter** (`runtime-adapter.ts:139`) — the five-method contract
+- **RuntimeAdapter** (`runtime-adapter.ts:141`) — the five-method contract
   (adapter detail in `adapters-and-runtimes.md`): `listInstalled(binding)`
-  (`runtime-adapter.ts:149`), `project(plan, binding)` (`:152`),
-  `deliverStartup(files, binding, sendInteractiveText?)` (`:156`),
-  `launchHarness(binding, opts)` (`:166`), `checkReady(binding)` (`:172`). The
-  interface also declares an optional `claudeManagedLaunch` property (`:141`)
-  and an optional method, `skillTargetPath?(...)` (`:146`). Required methods:
+  (`runtime-adapter.ts:151`), `project(plan, binding)` (`:154`),
+  `deliverStartup(files, binding, sendInteractiveText?)` (`:158`),
+  `launchHarness(binding, opts)` (`:168`), `checkReady(binding)` (`:174`). The
+  interface also declares an optional `claudeManagedLaunch` property (`:143`)
+  and an optional method, `skillTargetPath?(...)` (`:148`). Required methods:
   **5**
   (`sed -n '/^export interface RuntimeAdapter /,/^}/p' packages/daemon/src/domain/runtime-adapter.ts | grep -c -E '^  [a-zA-Z]+\('`).
-- **HarnessLaunchResult** (`runtime-adapter.ts:93`) — returned by
+- **HarnessLaunchResult** (`runtime-adapter.ts:95`) — returned by
   `launchHarness`: either `{ ok: true, resumeToken?, resumeType?,
   appliedLaunch? }` or `{ ok: false, error, recovery?, evidence? }`, where
-  `recovery` is `"retry_fresh"` or `"attention_required"` (`:91`).
+  `recovery` is `"retry_fresh"` or `"attention_required"` (`:93`).
 - **StartupOrchestrator** (`startup-orchestrator.ts:140`) — drives the full
   startup sequence (§4 below).
 
@@ -143,7 +143,7 @@ startup context before the harness launch.
   (`startup-orchestrator.ts:130`; held for post-launch and delivered after
   readiness at `:473`). Rebuild artifacts are put in front of these files.
 - **Fresh launch:** the builtin `session_identity` action
-  (`rigspec-instantiator.ts:2628`) is sent as one turn together with the first
+  (`rigspec-instantiator.ts:2654`) is sent as one turn together with the first
   `send_text` file (`deliverInitialSessionPrompt`, `startup-orchestrator.ts:663`).
 - **Resume, fork or rebuild:** applicable `after_ready` `send_text` actions are
   sent ahead of the first `send_text` file as one turn.
@@ -210,11 +210,11 @@ invariant; the cross-cutting architecture rules are collected in
 
 The launch path takes only the actions from `resolveStartup`. It builds the
 startup *file* chain itself (`buildResolvedStartupFiles`,
-`rigspec-instantiator.ts:2491`), in this order: agent base, profile, the shipped
+`rigspec-instantiator.ts:2517`), in this order: agent base, profile, the shipped
 `CULTURE-default.md` floor (`:327`), the rig `culture_file`, rig, pod, member,
-the shipped `openrig-start.md` (`:2545`), and, for fresh launches when enabled,
-the onboarding files (`:2555`). Managed-block guidance is deduplicated, and a
-`starter_ref` layer is put in front when a member names one (`:2216`).
+the shipped `openrig-start.md` (`:2571`), and, for fresh launches when enabled,
+the onboarding files (`:2581`). Managed-block guidance is 
```

**File**: `docs/as-built/architecture/architecture-rules-and-event-system.md` (modified, +7/-7)
```diff
@@ -11,7 +11,7 @@ applies-when: |
   compatibility limits that still describe the shipped system.
 siblings: [daemon-core.md, coordination-primitive.md]
 prerequisite-reads: [../README.md, daemon-core.md]
-last-verified-against-source: a350c59b5a5fb37ee4a21b1026b595068b603df1
+last-verified-against-source: 82eb4bed0fbf4ce7df038090b43211a0b8a1aa1d
 last-updated: 2026-10-05
 ---
 
@@ -21,7 +21,7 @@ This module collects the cross-cutting invariants that do not belong to any
 single subsystem: the architecture rules the codebase holds itself to, the
 event-system shape, and the intentional compatibility limits.
 
-> Verified against source at main `a350c59b5a5fb37ee4a21b1026b595068b603df1`. Each count below sits beside the
+> Verified against source at main `82eb4bed0fbf4ce7df038090b43211a0b8a1aa1d`. Each count below sits beside the
 > command that produces it; run the command from the repository root to refresh
 > it.
 
@@ -61,7 +61,7 @@ system-level invariants.
     `monotonicFactory()`. Restore does not pick the newest session by max
     ULID; it resolves the active occupant recorded in the snapshot
     (`resolveActiveSnapshotSession`, `active-occupant.ts:74`, called at
-    `restore-orchestrator.ts:768` and `:965`).
+    `restore-orchestrator.ts:767` and `:964`).
 13. Readiness checking is a retry loop with exponential backoff and
     configurable timeout, using adapter-specific probes (Claude TUI
     indicator, Codex ready message, terminal immediate).
@@ -73,9 +73,9 @@ system-level invariants.
     new process assembled from artifacts.
 15. Restore honesty: a failed resume stops loudly as `awaiting-decision`, with
     the blank session rolled back and no session running
-    (`restore-orchestrator.ts:1049`). No automatic fresh fallback. Fresh launch
+    (`restore-orchestrator.ts:1048`). No automatic fresh fallback. Fresh launch
     is explicit follow-up only (`rig up --fresh <seats...>`,
-    `packages/cli/src/commands/up.ts:92`).
+    `packages/cli/src/commands/up.ts:93`).
 16. Post-command handoff required on `up`, `down`, `restore`,
     `snapshot create`: what happened + current state + next action.
 17. Session naming: `{pod}-{member}@{rig}` — human-authored,
@@ -136,7 +136,7 @@ comments:
   caller's opt-in to wait, and a failed wait returns without sending. Otherwise
   only positive evidence of an open
   picker or approval prompt refuses a send; a busy or unknown seat gets the
-  message with an advisory warning (`session-transport.ts:1403`–`1409`). The
+  message with an advisory warning (`session-transport.ts:1410`–`1409`). The
   audited `--dangerously-interact` override is the only way past an open prompt.
 - **Non-interruptive mode is per-launch flags only.** It never changes
   permissions or native settings files, applies only to full-bypass Claude Code
@@ -268,7 +268,7 @@ Intentional limits that still describe the shipped system:
 6. Chat is rig-scoped only — no cross-rig channels or DMs.
 7. `--verify` on `rig send` checks pane content for message visibility, not
    agent acknowledgement: it compares occurrences of the message's first 40
-   characters before and after the send (`session-transport.ts:1581`–`1584`).
+   characters before and after the send (`session-transport.ts:1588`–`1584`).
 8. Terminal node readiness is shell-ready only — no service health probes.
 9. Managed-app service surfaces are descriptive only — OpenRig does not
    auto-inject service URLs/tokens into agent prompts beyond authored
```

**File**: `docs/as-built/architecture/daemon-core.md` (modified, +9/-9)
```diff
@@ -9,7 +9,7 @@ applies-when: |
   graph, the SQLite schema/migration set, or the route-mount surface.
 siblings: [coordination-primitive.md, agent-spec-and-startup.md, lifecycle-snapshot-restore.md]
 prerequisite-reads: [../README.md]
-last-verified-against-source: a350c59b5a5fb37ee4a21b1026b595068b603df1
+last-verified-against-source: 82eb4bed0fbf4ce7df038090b43211a0b8a1aa1d
 last-updated: 2026-10-05
 ---
 
@@ -20,7 +20,7 @@ OpenRig is a local control plane for multi-agent coding topologies. The daemon
 (`@openrig/cli`), the terminal UI (`@openrig/tui`), the web UI (`@openrig/ui`)
 and the MCP server all sit on top of.
 
-> Verified against source at main `a350c59b5a5fb37ee4a21b1026b595068b603df1`. Each count below sits beside the
+> Verified against source at main `82eb4bed0fbf4ce7df038090b43211a0b8a1aa1d`. Each count below sits beside the
 > command that produces it; run the command from the repository root to refresh
 > it.
 
@@ -29,17 +29,17 @@ and the MCP server all sit on top of.
 For what OpenRig is and how its packages fit together, read `ARCHITECTURE.md` at
 the repository root. This module covers the daemon's own wiring.
 
-### Source footprint at `a350c59b5a5fb37ee4a21b1026b595068b603df1`
+### Source footprint at `82eb4bed0fbf4ce7df038090b43211a0b8a1aa1d`
 
 The footprint counts use non-test TypeScript files under each package's `src/`
 (tests live in separate `packages/*/test/` directories):
 `find <dir> -type f \( -name '*.ts' -o -name '*.tsx' \) ! -name '*.test.*' | wc -l`.
 
 | Metric | Count | Directory or command |
 |---|---|---|
-| All packages | **1186** | `packages/*/src` |
-| Daemon | **650** (**426** under `domain/`, **27** under `adapters/`) | `packages/daemon/src`, `…/src/domain`, `…/src/adapters` |
-| CLI | **169** | `packages/cli/src` |
+| All packages | **1188** | `packages/*/src` |
+| Daemon | **651** (**426** under `domain/`, **28** under `adapters/`) | `packages/daemon/src`, `…/src/domain`, `…/src/adapters` |
+| CLI | **170** | `packages/cli/src` |
 | Web UI | **304** | `packages/ui/src` |
 | TUI | **63** | `packages/tui/src` |
 | Database migrations | **94** (`001_core_schema.ts` … `095_rig_non_interruptive.ts`; no `093`) | `git ls-files packages/daemon/src/db/migrations \| wc -l` |
@@ -223,9 +223,9 @@ The daemon entrypoint `packages/daemon/src/index.ts:306` calls
 
 ## 5. Test files
 
-A static count of tracked test files at `a350c59b5a5fb37ee4a21b1026b595068b603df1` (no pass counts are claimed
-here; CI runs the suites in `.github/workflows/tests.yml`): daemon **891**,
-CLI **242**, web UI **198**, TUI **98**
+A static count of tracked test files at `82eb4bed0fbf4ce7df038090b43211a0b8a1aa1d` (no pass counts are claimed
+here; CI runs the suites in `.github/workflows/tests.yml`): daemon **894**,
+CLI **243**, web UI **198**, TUI **98**
 (`git ls-files 'packages/<package>/**/*.test.ts' 'packages/<package>/**/*.test.tsx' | wc -l`).
 
 ## See also
```

**File**: `docs/as-built/architecture/lifecycle-snapshot-restore.md` (modified, +63/-63)
```diff
@@ -11,7 +11,7 @@ applies-when: |
   and the CLI restore-packet command work.
 siblings: [daemon-core.md, agent-spec-and-startup.md, transport-and-transcripts.md]
 prerequisite-reads: [../README.md, agent-spec-and-startup.md]
-last-verified-against-source: a350c59b5a5fb37ee4a21b1026b595068b603df1
+last-verified-against-source: 82eb4bed0fbf4ce7df038090b43211a0b8a1aa1d
 last-updated: 2026-10-05
 ---
 
@@ -22,7 +22,7 @@ The durable-state half of the core product loop:
 captures serialized rig state; restore replays it honestly (no silent
 fresh-fallback); restore-check is a separate read-only readiness probe.
 
-> Verified against source at main `a350c59b5a5fb37ee4a21b1026b595068b603df1`. Each count below sits beside the
+> Verified against source at main `82eb4bed0fbf4ce7df038090b43211a0b8a1aa1d`. Each count below sits beside the
 > command that produces it; run the command from the repository root to refresh
 > it.
 
@@ -40,33 +40,33 @@ All in `packages/daemon/src/domain/types.ts`. The spec/projection types live in
   values without `n-a`: **8**
   (`grep -E '^  status: "resumed"' packages/daemon/src/domain/types.ts | grep -o '"[^"]*"' | wc -l`).
   Where `restore-orchestrator.ts` sets each one:
-  - `resumed` — `baseStatus = "resumed"` after a legacy resume (`:1031`); the
-    status is returned only by `finishJoinedResume` (defined `:1319`, called
-    `:1245` and `:1312`, returning `resumed` at `:1381`) after it has rebound
+  - `resumed` — `baseStatus = "resumed"` after a legacy resume (`:1030`); the
+    status is returned only by `finishJoinedResume` (defined `:1320`, called
+    `:1244` and `:1311`, returning `resumed` at `:1380`) after it has rebound
     and verified the pane; otherwise that becomes `attention_required`
-    (`:1353`, `:1377`).
-  - `rebuilt` — a checkpoint file was written (`:1091`).
+    (`:1352`, `:1376`).
+  - `rebuilt` — a checkpoint file was written (`:1090`).
   - `fresh-primed` — the default for a deliberate non-resume launch
-    (`:988`).
+    (`:987`).
   - `fresh` — only the skip path for a pod node whose live continuity state
-    is already `restoring` (`:786`).
+    is already `restoring` (`:785`).
   - `awaiting-decision` — the seat could not resume and nothing is running:
-    before launch (`:821`), or after launch once the blank session is rolled
-    back (`:1027`, `:1049`, `:1062`, `:1078`, `:1237`).
+    before launch (`:820`), or after launch once the blank session is rolled
+    back (`:1026`, `:1048`, `:1061`, `:1077`, `:1236`).
   - `attention_required` — a live session waiting on a runtime prompt
-    (`:1040`, `:1263`) or a harness that never started (`:1126`).
-  - `failed` — occupant ambiguity (`:773`, `:970`), launch failure (`:912`),
-    a checkpoint that cannot be delivered (`:1087`, `:1093`), a missing
-    required startup file (`:1162`), or a startup error (`:1272`, `:1283`,
-    `:1293`, `:1301`).
+    (`:1039`, `:1262`) or a harness that never started (`:1125`).
+  - `failed` — occupant ambiguity (`:772`, `:969`), launch failure (`:911`),
+    a checkpoint that cannot be delivered (`:1086`, `:1092`), a missing
+    required startup file (`:1161`), or a startup error (`:1271`, `:1282`,
+    `:1292`, `:1300`).
   - `operator_recovered` — only from later reconciliation,
     `reconcileNodeRuntimeTruth` (`:1587`, event at `:1724`).
 - **RestoreRigResult** (`types.ts:444`) — the rig-level rollup, **4** values
   (`grep '^export type RestoreRigResult' packages/daemon/src/domain/types.ts | grep -o '"[^"]*"' | wc -l`):
   `fully_restored`, `partially_restored`, `failed`, `not_attempted`.
-  `rollupRestoreRigResult` (`restore-orchestrator.ts:82`) produces only the
+  `rollupRestoreRigResult` (`restore-orchestrator.ts:81`) produces only the
   first three; `not_attempted` is set when pre-restore validation fails
-  (`:282`).
+  (`:281`).
 - **SnapshotData** (`types.ts:351`) — the serialized snapshot payload. It has
   **7** optional fields, kept optional so older snapshots still load
   (`sed -n '/^export interface SnapshotData/,/^}/p' packages/daemon/src/domain/types.ts | grep -c '?:'`):
@@ -79,7 +79,7 @@ All in `packages/daemon/src/domain/types.ts`. The spec/projection types live in
   restore replay seam: persists only entry identity + source metadata, NOT
   stale `classification`, `conflicts`, or `noOps` (Architecture Rule 10).
   Restore rebuilds each entry as `safe_projection` with empty `conflicts` and
-  `noOps` (`restore-orchestrator.ts:1171`, `:1176`, `:1177`).
+  `noOps` (`restore-orchestrator.ts:1170`, `:1175`, `:1176`).
 
 ## 2. Snapshot, restore, continuity domain services
 
@@ -97,9 +97,9 @@ All under `packages/daemon/src/domain/`:
   accept only snapshots that pass `isRestoreUsableSnapshotData` (`:283`).
 - `restore-orchestrator.ts` — resume, checkpoint delivery, startup replay,
   live continuity consultation, topology ordering (`computeRestorePlan`,
-  `:670`, ordering only `delegates_to` and `spawned_by` edges, `:72`, among
-  the ros
```

**File**: `docs/as-built/architecture/packaging-bootstrap-bundles.md` (modified, +2/-2)
```diff
@@ -9,14 +9,14 @@ applies-when: |
   source routing, bootstrap plan/apply, or the retained package install engine.
 siblings: [agent-spec-and-startup.md, plugin-agent-image-context-pack.md]
 prerequisite-reads: [../README.md, agent-spec-and-startup.md]
-last-verified-against-source: a350c59b5a5fb37ee4a21b1026b595068b603df1
+last-verified-against-source: 82eb4bed0fbf4ce7df038090b43211a0b8a1aa1d
 last-updated: 2026-10-05
 ---
 
 # Packaging, bootstrap and bundles
 
 This module describes source at main commit
-`a350c59b5a5fb37ee4a21b1026b595068b603df1`. Source paths below are repository-relative.
+`82eb4bed0fbf4ce7df038090b43211a0b8a1aa1d`. Source paths below are repository-relative.
 An npm CLI artifact and a `.rigbundle` have different builders and consumers; neither
 source verification nor archive integrity establishes that a daemon has adopted an artifact.
 
```

---

### Incident Patch 6: `236f9a0c` (2026-10-05)
**Commit Message**: fix(kernel): apply per-launch operational authority (#820)

Seats of the rig named kernel get an operational launch default, carried through fresh launch, continue, restore and same-seat handover. Claude launches in acceptEdits with per-launch allowances for Skill, file tools and operational command families, including reads under the user's home; it is not bypass mode, and explicit ask and deny rules still apply. Its file tools are not workspace-limited for writes. Codex launches with danger-full-access and approvals never: unsandboxed host access within the OS user's rights, not a command allowlist. Explicit seat choices, authored policies and named Codex profiles keep their meaning, other rigs keep their defaults, and if the kernel lookup cannot run the launch keeps its prior permission behaviour. The kernel's culture and role guidance explain how to hold this authority and the lifecycle consequences of down, restore and import.

**File**: `packages/cli/src/commands/seat.ts` (modified, +1/-0)
```diff
@@ -165,6 +165,7 @@ function printHuman(status: SeatStatusResponse): void {
     const formatSource = (source: string): string => {
       if (source === "member_spec") return "from the member's permission_policy";
       if (source === "rig_spec") return "from the rig's permission_policy";
+      if (source === "kernel_default") return "kernel operational default";
       if (source === "system_default") return "OpenRig default";
       return source;
     };
```

**File**: `packages/daemon/specs/rigs/launch/kernel/agents/advisor/lead/guidance/role.md` (modified, +37/-0)
```diff
@@ -48,3 +48,40 @@ for more detail.
 Say so plainly. Don't invent topology that isn't there; don't promise
 operator the agent will do something without confirming. Honest gaps
 are easier to fix than confident wrong answers.
+
+## Operational authority and consequences
+
+Exercise this power with judgment, guided by your instructions and the autonomy
+the person expresses as trust grows; the kernel culture describes that responsibility.
+
+Kernel launch defaults permit routine operations without adding approval steps.
+Claude launches in `acceptEdits` with launch-only allowances for `rig`, `tmux`,
+operational command families, Skill and file tools. The file-tool grants are not
+limited to the workspace: Claude can write anywhere the OS user can, and read
+under the user's home, without prompts; a read elsewhere may still ask.
+This is not bypass mode; explicit user ask/deny rules still apply. Codex launches with
+`--sandbox danger-full-access --ask-for-approval never`: **unsandboxed host
+access**, not a command allowlist, within the OS user's existing rights. Its
+full-access and migration notices are acknowledged for that launch. Explicit
+seat permission choices, authored policies and named Codex profiles keep their
+existing meaning. Other rigs keep their existing defaults. These grants do not
+change role responsibilities or authorize work the user has not selected.
+
+Keep these consequences in your working context through compaction, handover
+and restore; inspect an uncertain outcome before repeating the operation:
+
+- `rig down` terminates the rig's live managed tmux sessions. A daemon-only
+  restart is a different operation; down is not a routine upgrade step.
+- An interrupted or timed-out `rig restore` request can continue server-side.
+  Read its attempt/events: it can finish or fail after the client goes away.
+- A timed-out import is not proof of failure. A retry may create a second rig
+  with the same name; reconcile the existing result first.
+- Do not compact a peer to unblock it. Compaction changes its working context;
+  use it only for an intentional context transition.
+- Tight agent polling loops can exhaust shared provider limits. Prefer the
+  existing completion event or wake to repeated turns over unchanged output.
+- Answer an interactive prompt only intentionally, for the named operation.
+  An operations grant is not consent to answer a peer's prompt.
+- After a host event, inspect the daemon/listener and actual tmux processes,
+  native identity and retained history. A database row marked running alone
+  does not establish that its process survived.
```

**File**: `packages/daemon/specs/rigs/launch/kernel/agents/operator/agent/guidance/role.md` (modified, +37/-0)
```diff
@@ -59,3 +59,40 @@ Use the relevant peer for technical questions. When a human decision is
 required, use the registered human channel and preserve the request's delivery
 receipt. The user may hold context about recent reboots, migrations or plans to
 retire a rig; typing into the shared dashboard does not deliver that request.
+
+## Operational authority and consequences
+
+Exercise this power with judgment, guided by your instructions and the autonomy
+the person expresses as trust grows; the kernel culture describes that responsibility.
+
+Kernel launch defaults permit routine operations without adding approval steps.
+Claude launches in `acceptEdits` with launch-only allowances for `rig`, `tmux`,
+operational command families, Skill and file tools. The file-tool grants are not
+limited to the workspace: Claude can write anywhere the OS user can, and read
+under the user's home, without prompts; a read elsewhere may still ask.
+This is not bypass mode; explicit user ask/deny rules still apply. Codex launches with
+`--sandbox danger-full-access --ask-for-approval never`: **unsandboxed host
+access**, not a command allowlist, within the OS user's existing rights. Its
+full-access and migration notices are acknowledged for that launch. Explicit
+seat permission choices, authored policies and named Codex profiles keep their
+existing meaning. Other rigs keep their existing defaults. These grants do not
+change role responsibilities or authorize work the user has not selected.
+
+Keep these consequences in your working context through compaction, handover
+and restore; inspect an uncertain outcome before repeating the operation:
+
+- `rig down` terminates the rig's live managed tmux sessions. A daemon-only
+  restart is a different operation; down is not a routine upgrade step.
+- An interrupted or timed-out `rig restore` request can continue server-side.
+  Read its attempt/events: it can finish or fail after the client goes away.
+- A timed-out import is not proof of failure. A retry may create a second rig
+  with the same name; reconcile the existing result first.
+- Do not compact a peer to unblock it. Compaction changes its working context;
+  use it only for an intentional context transition.
+- Tight agent polling loops can exhaust shared provider limits. Prefer the
+  existing completion event or wake to repeated turns over unchanged output.
+- Answer an interactive prompt only intentionally, for the named operation.
+  An operations grant is not consent to answer a peer's prompt.
+- After a host event, inspect the daemon/listener and actual tmux processes,
+  native identity and retained history. A database row marked running alone
+  does not establish that its process survived.
```

**File**: `packages/daemon/specs/rigs/launch/kernel/agents/queue/worker/guidance/role.md` (modified, +37/-0)
```diff
@@ -39,3 +39,40 @@ configured delivery/watchdog path before claiming unattended intake is live.
 Work arrives through an explicit operator prompt or configured wake. Do not
 simulate watching with capture loops. Use `rig queue` for the queue command
 surface and closure-reason rules.
+
+## Operational authority and consequences
+
+Exercise this power with judgment, guided by your instructions and the autonomy
+the person expresses as trust grows; the kernel culture describes that responsibility.
+
+Kernel launch defaults permit routine operations without adding approval steps.
+Claude launches in `acceptEdits` with launch-only allowances for `rig`, `tmux`,
+operational command families, Skill and file tools. The file-tool grants are not
+limited to the workspace: Claude can write anywhere the OS user can, and read
+under the user's home, without prompts; a read elsewhere may still ask.
+This is not bypass mode; explicit user ask/deny rules still apply. Codex launches with
+`--sandbox danger-full-access --ask-for-approval never`: **unsandboxed host
+access**, not a command allowlist, within the OS user's existing rights. Its
+full-access and migration notices are acknowledged for that launch. Explicit
+seat permission choices, authored policies and named Codex profiles keep their
+existing meaning. Other rigs keep their existing defaults. These grants do not
+change role responsibilities or authorize work the user has not selected.
+
+Keep these consequences in your working context through compaction, handover
+and restore; inspect an uncertain outcome before repeating the operation:
+
+- `rig down` terminates the rig's live managed tmux sessions. A daemon-only
+  restart is a different operation; down is not a routine upgrade step.
+- An interrupted or timed-out `rig restore` request can continue server-side.
+  Read its attempt/events: it can finish or fail after the client goes away.
+- A timed-out import is not proof of failure. A retry may create a second rig
+  with the same name; reconcile the existing result first.
+- Do not compact a peer to unblock it. Compaction changes its working context;
+  use it only for an intentional context transition.
+- Tight agent polling loops can exhaust shared provider limits. Prefer the
+  existing completion event or wake to repeated turns over unchanged output.
+- Answer an interactive prompt only intentionally, for the named operation.
+  An operations grant is not consent to answer a peer's prompt.
+- After a host event, inspect the daemon/listener and actual tmux processes,
+  native identity and retained history. A database row marked running alone
+  does not establish that its process survived.
```

**File**: `packages/daemon/specs/rigs/launch/kernel/culture/CULTURE.md` (modified, +41/-0)
```diff
@@ -73,3 +73,44 @@ machine and have things happen.
 - Not a router for human-to-human messages. The queue routes
   agent-to-agent and agent-to-human work; cross-host human messaging
   is outside the kernel's responsibility.
+
+## Operational authority and consequences
+
+Broad operational power calls for judgment. Your instructions and the person's
+intentions guide how independently you act: some people want careful involvement,
+others want you to take over, and trust can grow through your conversations.
+Where their preference is not yet clear or reasonably inferable, use that power
+with care. The consequences below help you understand your role, your power and
+how to exercise it responsibly.
+
+Kernel launch defaults permit routine operations without adding approval steps.
+Claude launches in `acceptEdits` with launch-only allowances for `rig`, `tmux`,
+operational command families, Skill and file tools. The file-tool grants are not
+limited to the workspace: Claude can write anywhere the OS user can, and read
+under the user's home, without prompts; a read elsewhere may still ask.
+This is not bypass mode; explicit user ask/deny rules still apply. Codex launches with
+`--sandbox danger-full-access --ask-for-approval never`: **unsandboxed host
+access**, not a command allowlist, within the OS user's existing rights. Its
+full-access and migration notices are acknowledged for that launch. Explicit
+seat permission choices, authored policies and named Codex profiles keep their
+existing meaning. Other rigs keep their existing defaults. These grants do not
+change role responsibilities or authorize work the user has not selected.
+
+Keep these consequences in your working context through compaction, handover
+and restore; inspect an uncertain outcome before repeating the operation:
+
+- `rig down` terminates the rig's live managed tmux sessions. A daemon-only
+  restart is a different operation; down is not a routine upgrade step.
+- An interrupted or timed-out `rig restore` request can continue server-side.
+  Read its attempt/events: it can finish or fail after the client goes away.
+- A timed-out import is not proof of failure. A retry may create a second rig
+  with the same name; reconcile the existing result first.
+- Do not compact a peer to unblock it. Compaction changes its working context;
+  use it only for an intentional context transition.
+- Tight agent polling loops can exhaust shared provider limits. Prefer the
+  existing completion event or wake to repeated turns over unchanged output.
+- Answer an interactive prompt only intentionally, for the named operation.
+  An operations grant is not consent to answer a peer's prompt.
+- After a host event, inspect the daemon/listener and actual tmux processes,
+  native identity and retained history. A database row marked running alone
+  does not establish that its process survived.
```

**File**: `packages/daemon/src/adapters/claude-code-adapter.ts` (modified, +4/-4)
```diff
@@ -1,4 +1,4 @@
-import { nonInterruptiveArgs, nonInterruptiveArg } from "./non-interruptive.js";
+import { operationalLaunchArgs, operationalLaunchArg } from "./kernel-authority.js";
 import nodePath from "node:path";
 import fs from "node:fs";
 import { createHash, randomUUID } from "node:crypto";
@@ -260,7 +260,7 @@ export class ClaudeCodeAdapter implements RuntimeAdapter {
     }
     const posture = claudePostureFlag(process.env, binding.launchPosture, binding.permissionMode);
     const appliedLaunch = observeClaudePermission(posture);
-    const permissionMode = posture + nonInterruptiveArg(this.runtime, binding);
+    const permissionMode = posture + operationalLaunchArg(this.runtime, binding);
     // OPR.0.5.3.1: classic-renderer env prefix (default on) → native scrollback for every
     // managed launch path (fresh/resume/fork). "" when overridden off → byte-identical command.
     const rendererPrefix = claudeClassicRendererEnvPrefix(process.env);
@@ -290,7 +290,7 @@ export class ClaudeCodeAdapter implements RuntimeAdapter {
       if (!parentId) {
         return { ok: false, error: "claude-code fork: forkSource.value is required (parent native_id)" };
       }
-      const cmd = managed ? managed.command(["--permission-mode", binding.permissionMode!, ...nonInterruptiveArgs(this.runtime, binding), ...(model ? ["--model", model] : []), ...(effort ? ["--effort", effort] : []),
+      const cmd = managed ? managed.command(["--permission-mode", binding.permissionMode!, ...operationalLaunchArgs(this.runtime, binding), ...(model ? ["--model", model] : []), ...(effort ? ["--effort", effort] : []),
         "--resume", parentId, "--fork-session", "--name", opts.name])
         // The non-managed command text is parsed by the pane shell, so the
         // parent id needs the same quoting as --model/--effort above (and as
@@ -323,7 +323,7 @@ export class ClaudeCodeAdapter implements RuntimeAdapter {
     }
 
     const generatedSessionId = opts.resumeToken ? null : this.sessionIdFactory();
-    const cmd = managed ? managed.command(["--permission-mode", binding.permissionMode!, ...nonInterruptiveArgs(this.runtime, binding), ...(model ? ["--model", model] : []), ...(effort ? ["--effort", effort] : []),
+    const cmd = managed ? managed.command(["--permission-mode", binding.permissionMode!, ...operationalLaunchArgs(this.runtime, binding), ...(model ? ["--model", model] : []), ...(effort ? ["--effort", effort] : []),
       ...(opts.resumeToken ? ["--resume", opts.resumeToken] : ["--session-id", generatedSessionId!]), "--name", opts.name]) : opts.resumeToken
       ? `${rendererPrefix}claude ${permissionMode}${modelArg}${effortArg} --resume ${opts.resumeToken} --name ${opts.name}`
       : `${rendererPrefix}claude ${permissionMode}${modelArg}${effortArg} --session-id ${generatedSessionId} --name ${opts.name}`;
```

**File**: `packages/daemon/src/adapters/claude-resume.ts` (modified, +5/-4)
```diff
@@ -1,4 +1,4 @@
-import { nonInterruptiveArgs, nonInterruptiveArg } from "./non-interruptive.js";
+import { operationalLaunchArgs, operationalLaunchArg } from "./kernel-authority.js";
 import { setTimeout as sleep } from "node:timers/promises";
 import type { TmuxAdapter } from "./tmux.js";
 import type { SeatLaunchEnvironment } from "../domain/seat-launch-environment.js";
@@ -61,6 +61,7 @@ export class ClaudeResumeAdapter {
     nodeId?: string,
     effort?: string | null,
     nonInterruptive?: boolean,
+    kernelAuthority?: boolean,
   ): Promise<ResumeResult> {
     if (!this.canResume(resumeType, resumeToken)) {
       return { ok: false, code: "no_resume", message: "Claude resume not available" };
@@ -78,11 +79,11 @@ export class ClaudeResumeAdapter {
         managed = await this.options.claudeManagedLaunch!.prepare({ nodeId: nodeId!, cwd, session: tmuxSessionName }, selectedPermissionMode);
       } catch (error) { return { ok: false, code: "permission_selection_refused", message: (error as Error).message }; }
     }
-    const choice = { nonInterruptive, launchPosture: resolvedPosture, permissionMode: selectedPermissionMode };
+    const choice = { kernelAuthority, nonInterruptive, launchPosture: resolvedPosture, permissionMode: selectedPermissionMode };
     const posture = claudePostureFlag(process.env, resolvedPosture, selectedPermissionMode);
     const appliedLaunch = observeClaudePermission(posture);
-    const permissionMode = posture + nonInterruptiveArg("claude-code", choice);
-    const cmd = managed ? managed.command(["--permission-mode", selectedPermissionMode!, ...nonInterruptiveArgs("claude-code", choice), ...(model ? ["--model", model] : []), ...(effort ? ["--effort", effort] : []), "--resume", resumeToken!])
+    const permissionMode = posture + operationalLaunchArg("claude-code", choice);
+    const cmd = managed ? managed.command(["--permission-mode", selectedPermissionMode!, ...operationalLaunchArgs("claude-code", choice), ...(model ? ["--model", model] : []), ...(effort ? ["--effort", effort] : []), "--resume", resumeToken!])
       : `${claudeClassicRendererEnvPrefix(process.env)}claude ${permissionMode}${modelArg}${effortArg} --resume ${shellQuote(resumeToken!)}`;
 
     const textResult = managed ? await this.tmux.sendShellCommand(tmuxSessionName, cmd, managed.assertCurrent)
```

**File**: `packages/daemon/src/adapters/codex-resume.ts` (modified, +3/-2)
```diff
@@ -1,4 +1,4 @@
-import { nonInterruptiveArg } from "./non-interruptive.js";
+import { operationalLaunchArg } from "./kernel-authority.js";
 import { setTimeout as sleep } from "node:timers/promises";
 import type { TmuxAdapter } from "./tmux.js";
 import type { SeatLaunchEnvironment } from "../domain/seat-launch-environment.js";
@@ -60,6 +60,7 @@ export class CodexResumeAdapter {
     // #75: optional reasoning effort for the seat.
     effort?: string | null,
     nonInterruptive?: boolean,
+    kernelAuthority?: boolean,
   ): Promise<ResumeResult> {
     if (!this.canResume(resumeType, resumeToken)) {
       return { ok: false, code: "no_resume", message: "Codex resume not available" };
@@ -94,7 +95,7 @@ export class CodexResumeAdapter {
     const profileArg = codexConfigProfile ? ` -p ${shellQuote(codexConfigProfile)}` : "";
     const posture = codexPostureArg(profileArg, process.env, resolvedPosture);
     const appliedLaunch = observeCodexSandbox(posture);
-    const postureArg = posture + nonInterruptiveArg("codex", { nonInterruptive, launchPosture: resolvedPosture });
+    const postureArg = posture + operationalLaunchArg("codex", { kernelAuthority, nonInterruptive, launchPosture: resolvedPosture });
     const networkArg = await codexNetworkDefaultArg(this.options.readNetworkDefault, appliedLaunch, cwd, tmuxSessionName);
     const cmd = buildCodexResumeCore(
       resumeToken ?? "",
```

---

### Incident Patch 7: `a3b35929` (2026-10-05)
**Commit Message**: fix(tui): open work views without requiring a running rig (#818)

After a successful catalog read, the TUI now opens its ordinary work views even when no rig is fully running, so a person who has just installed OpenRig reaches their team without a hidden extra key. Start and return stays reachable for setup and recovery, nothing is started, resumed or reset by opening views, degraded and unavailable states stay visible, and any key the person presses still ends automatic entry.

**File**: `packages/tui/src/startup.ts` (modified, +3/-4)
```diff
@@ -98,10 +98,9 @@ export class StartupController {
       if (this.state.rig && this.state.rigs.some((r) => r.id === this.state.rig!.rigId)) await this.readRig(this.state.rig.rigId);
       else { this.state.page = "rigs"; this.state.selected = 0; }
       this.state.notice = "Daemon connected. Choose what to bring back.";
-      // The served fold is running only for a nonempty rig whose nodes are all
-      // observed running. Missing, stopped, degraded and unverified are not proof.
-      const running = rigs.find(r => r.lifecycleState === "running");
-      if (this.automaticEntry && this.state.open && running) {
+      // Connected users can inspect work regardless of the rigs' lifecycle states.
+      // Setup and recovery remain deliberate choices through Start and return.
+      if (this.automaticEntry && this.state.open) {
         this.automaticEntry = false;
         this.state.open = false;
         this.deps.onWork();
```

**File**: `packages/tui/test/entry-loading.test.ts` (modified, +21/-4)
```diff
@@ -101,12 +101,29 @@ describe("entry never takes navigation from the user", () => {
     expect(onWork).toHaveBeenCalledTimes(calls);
     if (key === "?") expect(onHelp).toHaveBeenCalledOnce();
   });
-  it.each(["stopped", "recoverable", "degraded", "attention_required", undefined])("does not infer running from %s", async lifecycleState => {
+  it.each(["stopped", "recoverable", "degraded", "attention_required", undefined])("opens ordinary views while retaining the %s observation, without effects", async lifecycleState => {
+    const onWork = vi.fn(); const startDaemon = vi.fn(); const probe = vi.fn();
+    const rigs = [{ id: "r", name: "r", lifecycleState }];
+    const fetchImpl = vi.fn<typeof fetch>(async () => Response.json(rigs));
+    const client = new DaemonClient({ fetchImpl });
+    const startup = new StartupController({ client, home: "/fixture", probe, startDaemon, onWork, onChange: () => {} });
+    await startup.refresh();
+    expect(startup.state.open).toBe(false); expect(onWork).toHaveBeenCalledOnce(); expect(onWork).toHaveBeenCalledWith();
+    expect(startup.state.rigs).toEqual(rigs);
+    expect(startDaemon).not.toHaveBeenCalled(); expect(probe).not.toHaveBeenCalled();
+    expect(fetchImpl).toHaveBeenCalledOnce();
+    expect(fetchImpl.mock.calls[0]?.[1]?.method).not.toBe("POST");
+  });
+  it("opens ordinary views for an empty instance and keeps explicit recovery open across refreshes", async () => {
     const onWork = vi.fn(); const startDaemon = vi.fn();
-    const client = new DaemonClient({ fetchImpl: (async () => new Response(JSON.stringify([{ id: "r", name: "r", lifecycleState }]))) as typeof fetch });
-    const startup = new StartupController({ client, home: "/fixture", probe: async () => '{"state":"up"}', startDaemon, onWork, onChange: () => {} });
+    const client = new DaemonClient({ fetchImpl: async () => Response.json([]) });
+    const startup = new StartupController({ client, home: "/fixture", probe: vi.fn(), startDaemon, onWork, onChange: () => {} });
+    await startup.refresh();
+    expect(startup.state.open).toBe(false); expect(onWork).toHaveBeenCalledOnce();
+    await startup.open(); // The ordinary view's S key deliberately opens Start and return.
     await startup.refresh();
-    expect(startup.state.open).toBe(true); expect(onWork).not.toHaveBeenCalled(); expect(startDaemon).not.toHaveBeenCalled();
+    expect(startup.state).toMatchObject({ open: true, page: "rigs", connection: "up", rigs: [] });
+    expect(onWork).toHaveBeenCalledOnce(); expect(startDaemon).not.toHaveBeenCalled();
   });
 });
 
```

**File**: `packages/tui/test/refresh-activity.test.ts` (modified, +3/-7)
```diff
@@ -92,14 +92,10 @@ esac
     child.stderr.on("data", (chunk: string) => { stderr += chunk; });
 
     try {
-      await until(() => stdout.includes("Daemon connected.") || child.exitCode != null);
-      expect(child.exitCode, stderr).toBeNull();
-      expect(stdout).toContain("Daemon connected.");
-      // S05 opens startup first. Enter ordinary work before measuring its cadence.
-      const startupReads = requests.length;
-      child.stdin.write("w");
-      await until(() => requests.length > startupReads || child.exitCode != null);
+      // A connected empty catalog enters ordinary work without a startup keypress.
+      await until(() => stdout.includes("no rigs served — proven empty") || child.exitCode != null);
       expect(child.exitCode, stderr).toBeNull();
+      expect(stdout).toContain("no rigs served — proven empty");
       // Wait for the initial hydration to finish before taking the idle sample.
       await new Promise((resolve) => setTimeout(resolve, 100));
       const initialReads = requests.length;
```

**File**: `packages/tui/test/startup.test.ts` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ function fixture() {
   });
   return { controller, seat, posts, startDaemon, onWork, onNative, response: (fn: typeof response) => { response = fn; }, down: () => { probeState = "down"; } };
 }
-async function chooseOperator(f: ReturnType<typeof fixture>) { await f.controller.refresh(); await f.controller.key("enter"); }
+async function chooseOperator(f: ReturnType<typeof fixture>) { await f.controller.open(); await f.controller.key("enter"); }
 
 describe("TUI startup choices", () => {
   const stagedWarning = "Startup prompt still staged in worker@example; press Enter in that pane.";
```

---

### Incident Patch 8: `d1c72756` (2026-10-05)
**Commit Message**: fix(skills): deliver selected plugin skills to Claude Code and Codex seats (#815)

A selected plugin's skills now reach Claude Code and Codex seats: they are projected into the project skill folders through the managed skill loadout, under their plain names, when a seat is instantiated. An edited, kept or unreadable plugin copy never blocks a reconcile or a launch: it is kept with a warning, and a deselected edited copy is left in place unmanaged. A plugin skills path that is a file or unreadable gives no plugin skills and a warning. An existing user folder that matches a plugin skill's name ignoring case is treated as the user's and left alone. Catalog skills that do not come from a plugin behave as before.

Scope: instantiate paths only. Seats that already exist get the plugin skills when they are next freshly instantiated; continue and restore reconciliation is later work.

**File**: `packages/daemon/src/domain/profile-resolver.ts` (modified, +25/-1)
```diff
@@ -10,7 +10,8 @@ import type {
 import type { ResolvedAgentSpec, ResourceCollision } from "./agent-resolver.js";
 import { resolveStartup } from "./startup-resolver.js";
 import { discoverSkillsForRuntime, parseSkillFrontmatter, type SkillRuntime } from "./skill-discovery.js";
-import { inspectSkillDirectory, resolveSkillLoadout, type SkillLoadout } from "./skill-catalog.js";
+import { inspectSkillDirectory, resolvePluginSkills, resolveSkillLoadout, type SkillLoadout } from "./skill-catalog.js";
+import { resolvePluginPath } from "./projection-planner.js";
 
 // -- Types --
 
@@ -283,6 +284,29 @@ export function resolveNodeConfig(ctx: ResolutionContext): ResolutionResult {
   }
   selectedResult!.skills.sort((a, b) => a.effectiveId < b.effectiveId ? -1 : a.effectiveId > b.effectiveId ? 1 : 0);
 
+  // A selected plugin's skills reach Claude Code and Codex seats through the managed
+  // loadout, because neither runtime reads skills from the plugin folder projected into
+  // the working directory. A skill the profile already selects keeps that source.
+  if (runtime === "claude-code" || runtime === "codex") {
+    const selectedIds = new Set(selectedResult!.skills.map((skill) => skill.effectiveId));
+    for (const plugin of selectedResult!.plugins) {
+      const resource = plugin.resource as PluginResource;
+      const pluginSkills = resolvePluginSkills({
+        pluginId: resource.id,
+        pluginRoot: resolvePluginPath(resource.source.path, plugin.sourcePath),
+        runtime,
+        pluginType: resource.pluginType,
+      });
+      skillWarnings.push(...pluginSkills.warnings);
+      for (const skill of pluginSkills.entries) {
+        if (selectedIds.has(skill.id)) continue;
+        selectedIds.add(skill.id);
+        catalogResult.loadout.entries.push(skill);
+      }
+    }
+    catalogResult.loadout.entries.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
+  }
+
   // 7. Resolve restorePolicy with narrowing
   const restorePolicyResult = resolveRestorePolicy(spec, profile, member);
   if (!restorePolicyResult.ok) {
```

**File**: `packages/daemon/src/domain/projection-planner.ts` (modified, +1/-1)
```diff
@@ -282,7 +282,7 @@ function checkAmbiguity(selected: ResolvedResources, collisions: ResourceCollisi
  * `~user/...` (with explicit username) is NOT expanded; treated as a
  * literal relative segment per Node's nodePath convention.
  */
-function resolvePluginPath(rawPath: string, specSourcePath: string, openrigHome: string): string {
+export function resolvePluginPath(rawPath: string, specSourcePath: string, openrigHome: string = OPENRIG_HOME): string {
   if (rawPath.startsWith("openrig-home:")) return nodePath.resolve(openrigHome, rawPath.slice("openrig-home:".length));
   if (rawPath === "~") return os.homedir();
   if (rawPath.startsWith("~/")) return nodePath.join(os.homedir(), rawPath.slice(2));
```

**File**: `packages/daemon/src/domain/rigspec-instantiator.ts` (modified, +20/-5)
```diff
@@ -321,7 +321,7 @@ import type {
   CompactionStrategy,
   ContinuityPolicyMaterializer,
 } from "./continuity-policy-materializer.js";
-import type { ReconcileSkillLoadoutResult, SkillLoadout, SkillRuntime } from "./skill-catalog.js";
+import { isKeptPluginSkill, type ReconcileSkillLoadoutResult, type SkillLoadout, type SkillRuntime } from "./skill-catalog.js";
 import type { SystemWorldResolution } from "./system-world.js";
 
 function defaultCultureStartupFile(): ResolvedStartupFile {
@@ -2021,25 +2021,40 @@ export class PodRigInstantiator {
     }
 
     const canonicalSessionName = deriveCanonicalSessionName(input.pod.id, input.member.id, input.rigSpec.name);
+    const keptSkillWarnings: string[] = [];
     if (
       configResult.config.skillLoadout
       && this.deps.skillReconciler
       && (configResult.config.runtime === "claude-code" || configResult.config.runtime === "codex")
     ) {
-      const projection = this.deps.skillReconciler({
-        loadout: configResult.config.skillLoadout,
-        runtime: configResult.config.runtime,
+      const reconcile = (selected: SkillLoadout) => this.deps.skillReconciler!({
+        loadout: selected,
+        runtime: configResult.config.runtime as SkillRuntime,
         cwd: configResult.config.cwd,
         apply: true,
         topologyOwner: canonicalSessionName,
       });
+      const loadout = configResult.config.skillLoadout;
+      let projection = reconcile(loadout);
+      // Plugin skills never stop a seat that launched before them: if they cannot be
+      // projected, the seat starts with the rest of its loadout and says why.
+      if (!projection.ok && loadout.entries.some((entry) => entry.pluginId)) {
+        const withoutPlugins = reconcile({ ...loadout, entries: loadout.entries.filter((entry) => !entry.pluginId) });
+        if (withoutPlugins.ok) {
+          keptSkillWarnings.push(`plugin_skills_not_projected: ${projection.errors.map((error) => `${error.code}: ${error.message}`).join("; ")}`);
+          projection = withoutPlugins;
+        }
+      }
       if (!projection.ok) {
         return {
           status: "failed",
           error: projection.errors.map((error) => `${error.code}: ${error.message}`).join("; "),
           sessionName: canonicalSessionName,
         };
       }
+      for (const receipt of projection.receipts.filter(isKeptPluginSkill)) {
+        keptSkillWarnings.push(`plugin_skill_kept: ${receipt.id}: ${receipt.detail.slice("kept: ".length)} (${receipt.target})`);
+      }
     }
     // Forward per-seat silenceWindowSeconds from the resolved profile.
     // Currently inert: the live SeatActivityService poller uses the
@@ -2094,7 +2109,7 @@ export class PodRigInstantiator {
     // P17: a divergent target is never SILENT again — each conflict rides the
     // instantiate warnings surface with the file, reason, and consequence.
     (launchResult.warnings ??= []).push(
-      ...(configResult.config.skillWarnings ?? []).map(warning => `${canonicalSessionName}: ${warning}`),
+      ...[...(configResult.config.skillWarnings ?? []), ...keptSkillWarnings].map(warning => `${canonicalSessionName}: ${warning}`),
       ...projectionConflictWarnings(planResult.plan),
     );
 
```

**File**: `packages/daemon/src/domain/skill-catalog.ts` (modified, +159/-9)
```diff
@@ -11,6 +11,7 @@ import {
   renameSync,
   rmSync,
   writeFileSync,
+  type Dirent,
 } from "node:fs";
 import nodePath from "node:path";
 import { parse as parseYaml } from "yaml";
@@ -33,6 +34,9 @@ export interface CatalogSkill {
   digest: string;
   files: Record<string, string>;
   selectedBy: SkillSelectionSource[];
+  /** Set when the skill comes from a selected plugin. Such a skill never displaces
+   *  a same-name skill OpenRig does not own (see reconcileSkillLoadout). */
+  pluginId?: string;
 }
 
 export interface SkillLoadout {
@@ -356,6 +360,90 @@ export function resolveSkillLoadout(input: {
   };
 }
 
+/** A selected plugin's skills as loadout entries for one runtime. Neither Claude Code
+ *  nor Codex reads skills from the plugin folder OpenRig projects into a seat's working
+ *  directory, so they travel in the managed loadout instead. A plugin applies to a
+ *  runtime as the adapters decide: an explicit pluginType, otherwise the runtime's own
+ *  manifest (.claude-plugin/ or .codex-plugin/). */
+export function resolvePluginSkills(input: {
+  pluginId: string;
+  pluginRoot: string;
+  runtime: SkillRuntime;
+  pluginType?: "claude" | "codex" | "auto";
+}): { entries: CatalogSkill[]; warnings: string[] } {
+  const entries: CatalogSkill[] = [];
+  const warnings: string[] = [];
+  const pluginRoot = nodePath.resolve(input.pluginRoot);
+  const manifestDir = input.runtime === "claude-code" ? ".claude-plugin" : ".codex-plugin";
+  const pluginType = input.pluginType ?? "auto";
+  const applies = pluginType === "auto"
+    ? existsSync(nodePath.join(pluginRoot, manifestDir, "plugin.json"))
+    : pluginType === (input.runtime === "claude-code" ? "claude" : "codex");
+  if (!applies) return { entries, warnings };
+
+  let manifest: Record<string, unknown> = {};
+  const manifestPath = [manifestDir, ".claude-plugin", ".codex-plugin"]
+    .map((dir) => nodePath.join(pluginRoot, dir, "plugin.json"))
+    .find((path) => existsSync(path));
+  if (manifestPath) {
+    try {
+      const parsed: unknown = JSON.parse(readFileSync(manifestPath, "utf8"));
+      if (isRecord(parsed)) manifest = parsed;
+    } catch { /* the plugin's own projection reports an unreadable manifest */ }
+  }
+  const skillsDir = nodePath.resolve(pluginRoot, typeof manifest["skills"] === "string" ? manifest["skills"] : "skills");
+  if (!isWithin(pluginRoot, skillsDir) || !existsSync(skillsDir)) return { entries, warnings };
+  const revision = `plugin:${input.pluginId}${typeof manifest["version"] === "string" ? `@${manifest["version"]}` : ""}`;
+
+  let listing: Dirent[];
+  try {
+    listing = readdirSync(skillsDir, { withFileTypes: true });
+  } catch (err) {
+    warnings.push(`plugin_skill_skipped: plugin ${input.pluginId} skills at ${skillsDir}: ${(err as Error).message}`);
+    return { entries, warnings };
+  }
+  for (const entry of listing.sort((a, b) => compareBytes(a.name, b.name))) {
+    if (!entry.isDirectory()) continue;
+    const sourceDir = nodePath.join(skillsDir, entry.name);
+    const skillFile = nodePath.join(sourceDir, "SKILL.md");
+    if (!existsSync(skillFile)) continue;
+    try {
+      const parsed = parseSkillFrontmatter(readFileSync(skillFile, "utf8"));
+      if (!parsed.ok) throw new Error(parsed.reason);
+      const id = parsed.frontmatter.name;
+      if (!SAFE_ID.test(id)) throw new Error(`frontmatter name '${id}' is not a bounded skill identity`);
+      if (entries.some((skill) => skill.id === id)) throw new Error(`the plugin has another skill named '${id}'`);
+      const tree = inspectSkillDirectory(sourceDir);
+      entries.push({
+        id,
+        sourceDir,
+        sourceRoot: pluginRoot,
+        revision,
+        digest: tree.digest,
+        files: tree.files,
+        selectedBy: ["topology"],
+        pluginId: input.pluginId,
+      });
+    } catch (err) {
+      warnings.push(`plugin_skill_skipped: plugin ${input.pluginId} skill at ${sourceDir}: ${(err as Error).message}`);
+    }
+  }
+  entries.sort((a, b) => compareBytes(a.id, b.id));
+  return { entries, warnings };
+}
+
+const KEPT_DETAIL = "kept: ";
+
+/** The plugin an owned record came from, from the revision resolvePluginSkills wrote. */
+function pluginIdOf(revision: string): string | undefined {
+  return /^plugin:([^@]+)/.exec(revision)?.[1];
+}
+
+/** A plugin skill left out because a skill OpenRig does not own already has its name. */
+export function isKeptPluginSkill(receipt: SkillProjectionReceipt): boolean {
+  return receipt.status === "shadowed" && receipt.detail.startsWith(KEPT_DETAIL);
+}
+
 function targetRootFor(runtime: SkillRuntime, cwd: string): string {
   return nodePath.join(cwd, runtime === "claude-code" ? ".claude" : ".agents", "skills");
 }
@@ -678,6 +766,39 @@ export function reconcileSkillLoadout(input: {
   }
   const owned = new Map(manifest.skills.map((skill) => [skill.id, skill]));
 
+  // A plugin's skill never displaces one OpenRig does not own: that target keeps its
```

**File**: `packages/daemon/test/codex-skill-projection.test.ts` (modified, +3/-2)
```diff
@@ -24,6 +24,7 @@ if (start < 0 || end < start) throw new Error("Production projection planning bl
 const buildPlan = new Function(
   "planProjection", "claudeConflictTargetPath", "projectionConflictWarnings", "nodePath",
   "input", "configResult", "resolveResult", "projectionManifest", "launchResult", "canonicalSessionName", "adapter",
+  "keptSkillWarnings",
   instantiator.slice(start, end) + "\nreturn planResult.plan;",
 );
 
@@ -63,7 +64,7 @@ function fixture(target: "absent" | "identical" | "edited", runtime = "codex", f
     claudeConflictTargetPath, projectionConflictWarnings, nodePath,
     { member: { runtime }, rigId: "fixture", force }, { config }, { collisions: [] },
     { lastHash: (path: string) => path === codexFile ? hashContent(sourceText) : null },
-    { warnings: [] }, "dev-check@fixture", {},
+    { warnings: [] }, "dev-check@fixture", {}, [],
   );
   const adapter = new CodexRuntimeAdapter({
     fsOps,
@@ -147,7 +148,7 @@ describe("OMP skill projection in a shared project", () => {
       { deps: { fsOps, rigRepo: { getRigClaudeManagedBlockFile: () => null } } },
       planProjection, claudeConflictTargetPath, projectionConflictWarnings, nodePath,
       { member: { runtime }, rigId: "fixture" }, { config: { ...config, runtime } }, { collisions: [] },
-      { lastHash: () => null }, { warnings: [], binding: { tmuxSession: seat } }, seat, adapter,
+      { lastHash: () => null }, { warnings: [], binding: { tmuxSession: seat } }, seat, adapter, [],
     );
     const binding = { tmuxSession: seat, cwd: config.cwd } as NodeBinding;
 
```

**File**: `packages/daemon/test/pod-rigspec-instantiator.test.ts` (modified, +75/-0)
```diff
@@ -343,6 +343,81 @@ profiles:
     } finally { db?.close(); fs.rmSync(root, { recursive: true, force: true }); }
   });
 
+  it.each(["claude-code", "codex"] as const)("projects a selected plugin's skills for %s and keeps a same-name skill it does not own", async (runtime) => {
+    const root = fs.mkdtempSync(nodePath.join(os.tmpdir(), "instantiator-plugin-skills-"));
+    let db: ReturnType<typeof createFullTestDb> | undefined;
+    try {
+      const installed = nodePath.join(root, "installed");
+      const plugin = nodePath.join(installed, "agents/impl/plugins/core");
+      const project = nodePath.join(root, "project");
+      const skills = nodePath.join(project, runtime === "codex" ? ".agents" : ".claude", "skills");
+      const skill = (id: string, body: string) => `---\nname: ${id}\ndescription: Skill fixture\n---\n${body}\n`;
+      for (const manifest of [".claude-plugin", ".codex-plugin"]) {
+        fs.mkdirSync(nodePath.join(plugin, manifest), { recursive: true });
+        fs.writeFileSync(nodePath.join(plugin, manifest, "plugin.json"), '{"name":"core","version":"0.1.4"}');
+      }
+      for (const id of ["delegating-work", "openrig-skills", "queue-handoff"]) {
+        fs.mkdirSync(nodePath.join(plugin, "skills", id), { recursive: true });
+        fs.writeFileSync(nodePath.join(plugin, "skills", id, "SKILL.md"), skill(id, "Plugin"));
+      }
+      fs.mkdirSync(nodePath.join(skills, "delegating-work"), { recursive: true });
+      fs.writeFileSync(nodePath.join(skills, "delegating-work/SKILL.md"), skill("delegating-work", "The project's own"));
+      fs.writeFileSync(nodePath.join(installed, "agents/impl/agent.yaml"), 'name: impl\nversion: "1.0"\nresources:\n  plugins:\n    - id: core\n      source:\n        kind: local\n        path: plugins/core\nprofiles:\n  default:\n    uses:\n      plugins: [core]\n');
+      const reconciler = vi.fn(reconcileSkillLoadout);
+      const fixture = setup(undefined, undefined, undefined, undefined, undefined, {
+        fsOps: { readFile: (p: string) => fs.readFileSync(p, "utf8"), exists: fs.existsSync },
+        skillsRootResolver: () => nodePath.join(root, "no-catalog"), skillReconciler: reconciler,
+      });
+      db = fixture.db;
+      const rig = makeRigSpec({ pods: [{ id: "dev", label: "Dev", edges: [], members: [
+        { id: "impl", agentRef: "local:agents/impl", profile: "default", runtime, cwd: project },
+      ] }] });
+      const result = await fixture.inst.instantiate(RigSpecCodec.serialize(rig), installed);
+      expect(result.ok, JSON.stringify(result)).toBe(true);
+      expect(reconciler.mock.results[0]?.value.ok).toBe(true);
+      for (const id of ["openrig-skills", "queue-handoff"]) {
+        expect(fs.readFileSync(nodePath.join(skills, id, "SKILL.md"), "utf8")).toBe(skill(id, "Plugin"));
+      }
+      expect(fs.readFileSync(nodePath.join(skills, "delegating-work/SKILL.md"), "utf8")).toBe(skill("delegating-work", "The project's own"));
+      const owner = reconciler.mock.calls[0]![0].topologyOwner;
+      expect(JSON.stringify(result)).toContain(`${owner}: plugin_skill_kept: delegating-work`);
+    } finally { db?.close(); fs.rmSync(root, { recursive: true, force: true }); }
+  });
+
+  it("starts the seat without plugin skills when they cannot be projected, and says why", async () => {
+    const root = fs.mkdtempSync(nodePath.join(os.tmpdir(), "instantiator-plugin-skills-refused-"));
+    let db: ReturnType<typeof createFullTestDb> | undefined;
+    try {
+      const installed = nodePath.join(root, "installed");
+      const plugin = nodePath.join(installed, "agents/impl/plugins/core");
+      const project = nodePath.join(root, "project");
+      fs.mkdirSync(nodePath.join(plugin, ".claude-plugin"), { recursive: true });
+      fs.writeFileSync(nodePath.join(plugin, ".claude-plugin/plugin.json"), '{"name":"core","version":"0.1.4"}');
+      fs.mkdirSync(nodePath.join(plugin, "skills/queue-handoff"), { recursive: true });
+      fs.writeFileSync(nodePath.join(plugin, "skills/queue-handoff/SKILL.md"), "---\nname: queue-handoff\ndescription: Skill fixture\n---\nPlugin\n");
+      fs.writeFileSync(nodePath.join(installed, "agents/impl/agent.yaml"), 'name: impl\nversion: "1.0"\nresources:\n  plugins:\n    - id: core\n      source:\n        kind: local\n        path: plugins/core\nprofiles:\n  default:\n    uses:\n      plugins: [core]\n');
+      // The project keeps its own ignore file where OpenRig would add its exclusions.
+      fs.mkdirSync(nodePath.join(project, ".claude/skills"), { recursive: true });
+      fs.writeFileSync(nodePath.join(project, ".claude/skills/.gitignore"), "*.tmp\n");
+      execFileSync("git", ["init", "-q", project]);
+      const reconciler = vi.fn(reconcileSkillLoadout);
+      const fixture = setup(undefined, undefined, undefined, undefined, undefined, {
+        fsOps: { readFile: (p: string) => fs.readFileSync(p, "utf8"), exists: fs.existsSync },
+        skillsRootResolver: () =>
```

**File**: `packages/daemon/test/profile-resolver.test.ts` (modified, +61/-0)
```diff
@@ -907,3 +907,64 @@ describe("selected bundle identity boundaries", () => {
     } finally { rmSync(root, { recursive: true, force: true }); }
   });
 });
+
+describe("selected plugin skills", () => {
+  function writePlugin(root: string): string {
+    const plugin = join(root, "plugins", "core");
+    mkdirSync(join(plugin, ".claude-plugin"), { recursive: true });
+    writeFileSync(join(plugin, ".claude-plugin", "plugin.json"), JSON.stringify({ name: "core", version: "0.1.0" }));
+    for (const id of ["delegating-work", "queue-handoff"]) {
+      mkdirSync(join(plugin, "skills", id), { recursive: true });
+      writeFileSync(join(plugin, "skills", id, "SKILL.md"), `---\nname: ${id}\ndescription: Use when testing ${id}.\n---\n\n# plugin ${id}\n`);
+    }
+    return plugin;
+  }
+
+  function resolveWithPlugin(root: string, plugin: string, skills: Array<{ id: string; path: string }>) {
+    const spec = makeSpec({
+      resources: { skills, guidance: [], subagents: [], plugins: [{ id: "core", source: { kind: "local", path: plugin } }], runtimeResources: [] },
+      profiles: {
+        default: { uses: { skills: skills.map((skill) => skill.id), guidance: [], subagents: [], plugins: ["core"], runtimeResources: [] } },
+      },
+    });
+    return resolveNodeConfig(makeCtx({
+      baseSpec: makeResolved(spec, root),
+      member: makeMember({ cwd: join(root, "work") }),
+      skillsRoot: join(root, "no-catalog"),
+      homedir: join(root, "home"),
+    }));
+  }
+
+  it("adds a selected plugin's skills to the managed loadout, not to the plan's skill entries", () => {
+    const root = mkdtempSync(join(tmpdir(), "openrig-profile-plugin-skills-"));
+    try {
+      const plugin = writePlugin(root);
+      const result = resolveWithPlugin(root, plugin, []);
+
+      expect(result.ok, JSON.stringify(result)).toBe(true);
+      if (!result.ok) return;
+      expect(result.config.selectedResources.skills).toEqual([]);
+      expect(result.config.skillLoadout?.entries.map((entry) => [entry.id, entry.sourceDir, entry.selectedBy])).toEqual([
+        ["delegating-work", join(plugin, "skills", "delegating-work"), ["topology"]],
+        ["queue-handoff", join(plugin, "skills", "queue-handoff"), ["topology"]],
+      ]);
+    } finally { rmSync(root, { recursive: true, force: true }); }
+  });
+
+  it("keeps a selected bundle skill's source when the plugin has a skill with the same name", () => {
+    const root = mkdtempSync(join(tmpdir(), "openrig-profile-plugin-precedence-"));
+    try {
+      const plugin = writePlugin(root);
+      const bundle = join(root, "bundle", "queue-handoff");
+      mkdirSync(bundle, { recursive: true });
+      writeFileSync(join(bundle, "SKILL.md"), "---\nname: queue-handoff\ndescription: Use when testing the bundle copy.\n---\n\n# bundle\n");
+      const result = resolveWithPlugin(root, plugin, [{ id: "queue-handoff", path: bundle }]);
+
+      expect(result.ok, JSON.stringify(result)).toBe(true);
+      if (!result.ok) return;
+      expect(result.config.selectedResources.skills.map((skill) => [skill.effectiveId, (skill.resource as { path: string }).path]))
+        .toEqual([["queue-handoff", bundle]]);
+      expect(result.config.skillLoadout?.entries.map((entry) => entry.id)).toEqual(["delegating-work"]);
+    } finally { rmSync(root, { recursive: true, force: true }); }
+  });
+});
```

**File**: `packages/daemon/test/skill-catalog-loadout.test.ts` (modified, +208/-2)
```diff
@@ -1,9 +1,9 @@
 import { execFileSync } from "node:child_process";
-import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
+import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
 import { tmpdir } from "node:os";
 import { join } from "node:path";
 import { afterEach, describe, expect, it } from "vitest";
-import { reconcileSkillLoadout, resolveSkillLoadout } from "../src/domain/skill-catalog.js";
+import { reconcileSkillLoadout, resolvePluginSkills, resolveSkillLoadout, type SkillLoadout } from "../src/domain/skill-catalog.js";
 
 const roots: string[] = [];
 
@@ -575,3 +575,209 @@ describe("managed skill catalog and composable loadouts", () => {
     expect(readFileSync(join(external, "marker"), "utf8")).toBe("preserved\n");
   });
 });
+
+describe("plugin skills in the managed loadout", () => {
+  function writePlugin(root: string, manifests: string[], skills: string[]): string {
+    const plugin = join(root, "plugins", "core");
+    for (const manifest of manifests) {
+      mkdirSync(join(plugin, manifest), { recursive: true });
+      writeFileSync(join(plugin, manifest, "plugin.json"), JSON.stringify({ name: "core", version: "1.2.3", skills: "./skills" }));
+    }
+    for (const id of skills) writeSkill(join(plugin, "skills"), id);
+    return plugin;
+  }
+
+  function loadoutOf(entries: SkillLoadout["entries"], root: string): SkillLoadout {
+    return { catalogRoot: join(root, "no-catalog"), catalogRevision: null, catalogDigest: null, projectSelectionDeclared: false, projectSelection: [], entries };
+  }
+
+  it("selects a plugin's skills only for the runtimes its manifests or plugin type name", () => {
+    const f = fixture([]);
+    const plugin = writePlugin(f.root, [".claude-plugin"], ["queue-handoff", "delegating-work"]);
+
+    const claude = resolvePluginSkills({ pluginId: "core", pluginRoot: plugin, runtime: "claude-code" });
+    expect(claude.warnings).toEqual([]);
+    expect(claude.entries.map((entry) => [entry.id, entry.selectedBy, entry.revision, entry.pluginId, entry.sourceDir])).toEqual([
+      ["delegating-work", ["topology"], "plugin:core@1.2.3", "core", join(plugin, "skills", "delegating-work")],
+      ["queue-handoff", ["topology"], "plugin:core@1.2.3", "core", join(plugin, "skills", "queue-handoff")],
+    ]);
+    expect(resolvePluginSkills({ pluginId: "core", pluginRoot: plugin, runtime: "codex" }).entries).toEqual([]);
+    expect(resolvePluginSkills({ pluginId: "core", pluginRoot: plugin, runtime: "codex", pluginType: "codex" }).entries.map((entry) => entry.id))
+      .toEqual(["delegating-work", "queue-handoff"]);
+    expect(resolvePluginSkills({ pluginId: "core", pluginRoot: plugin, runtime: "claude-code", pluginType: "codex" }).entries).toEqual([]);
+  });
+
+  it("skips a plugin skill it cannot copy exactly and says why", () => {
+    const f = fixture([]);
+    const plugin = writePlugin(f.root, [".claude-plugin"], ["good", "linked"]);
+    symlinkSync(join(plugin, "skills", "good", "SKILL.md"), join(plugin, "skills", "linked", "extra.md"));
+
+    const result = resolvePluginSkills({ pluginId: "core", pluginRoot: plugin, runtime: "claude-code" });
+    expect(result.entries.map((entry) => entry.id)).toEqual(["good"]);
+    expect(result.warnings).toEqual([expect.stringMatching(/^plugin_skill_skipped: .*linked.*symlink/)]);
+  });
+
+  it.each([
+    ["claude-code", ".claude"],
+    ["codex", ".agents"],
+  ] as const)("projects a plugin's skills into the %s project skill folder and owns them", (runtime, harnessDir) => {
+    const f = fixture([]);
+    const plugin = writePlugin(f.root, [".claude-plugin", ".codex-plugin"], ["queue-handoff", "delegating-work"]);
+    const loadout = loadoutOf(resolvePluginSkills({ pluginId: "core", pluginRoot: plugin, runtime }).entries, f.root);
+
+    expect(reconcileSkillLoadout({ loadout, runtime, cwd: f.project, topologyOwner: "seat-a", apply: true }))
+      .toMatchObject({ ok: true, applied: true });
+    for (const id of ["queue-handoff", "delegating-work"]) {
+      expect(readFileSync(join(f.project, harnessDir, "skills", id, "SKILL.md"), "utf8"))
+        .toBe(readFileSync(join(plugin, "skills", id, "SKILL.md"), "utf8"));
+    }
+    const manifest = JSON.parse(readFileSync(join(f.project, ".openrig", "skill-loadouts", `${runtime}.json`), "utf8")) as {
+      skills: Array<{ id: string; revision: string }>;
+    };
+    expect(manifest.skills.map((skill) => [skill.id, skill.revision])).toEqual([
+      ["delegating-work", "plugin:core@1.2.3"],
+      ["queue-handoff", "plugin:core@1.2.3"],
+    ]);
+    expect(reconcileSkillLoadout({ loadout, runtime, cwd: f.project, topologyOwner: "seat-a", apply: true }))
+      .toMatchObject({ ok: true, applied: false });
+  });
+
+  it("keeps a same-name skill OpenRig does not own and records no ownership o
```

---

### Incident Patch 9: `e80efb71` (2026-10-05)
**Commit Message**: fix(daemon): read Claude's other permission-mode footers below status warnings as idle (#814)

When one of Claude Code's status warnings (for example a failed auto-update, tmux focus events or a usage-limit notice) sits below the footer, an idle seat in any permission mode (default, auto, plan, bypass permissions, with or without vim mode) now reads idle. Before, only the exact accept-edits footer did, so rig compact refused those seats and send --wait-for-idle timed out. A draft in the composer keeps its existing reading. A status line showing a running hook ("running PostToolUse hook · 3m 12s") now reads as active work instead of idle. Refs #808.

**File**: `packages/daemon/src/domain/session-transport.ts` (modified, +10/-3)
```diff
@@ -143,9 +143,13 @@ const CLAUDE_STATUS_WARNINGS = [
   /^tmux focus-events off · add 'set -g focus-events on' to ~\/\.tmux\.conf and re…$/,
   /^You've used (?:\d|[1-9]\d)% of your weekly limit · resets \d{1,2}(?::\d{2})?(?:am|pm) \(UTC\)$/,
 ];
+// Claude's permission-mode footers: default, accept edits, bypass, auto and plan, optionally after a
+// vim-mode marker such as "-- INSERT --" (#808). A suffix such as "· 1 shell" can follow the mode.
+const CLAUDE_MODE_FOOTER = /^(?:-- [A-Z]+ -- )?(?:⏵⏵ (?:accept edits|bypass permissions|auto mode) on\b|⏸ plan mode on\b|\? for shortcuts\b)/;
 // Current Claude status rows need not end in "thinking)" or show "esc to interrupt".
 // Completed summaries such as "✻ Crunched for 2s" lack the live ellipsis/timer shape.
-const CLAUDE_LIVE_STATUS_PATTERN = /^[✶✢✳✻✽·*]\s+\S[^(]*(?:…|\.{3})\s+\((?:\d+h\s+)?(?:\d+m\s+)?\d+s\b/;
+// While a hook runs, the timer follows its label: "(running PostToolUse hook · 3m 12s · …)".
+const CLAUDE_LIVE_STATUS_PATTERN = /^[✶✢✳✻✽·*]\s+\S[^(]*(?:…|\.{3})\s+\((?:running [^()·]+ hook · )?(?:\d+h\s+)?(?:\d+m\s+)?\d+s\b/;
 
 function findClaudeComposer(paneContent: string) {
   // Preserve columns: a multiline draft may contain indented border/prompt text.
@@ -156,6 +160,7 @@ function findClaudeComposer(paneContent: string) {
   let bar = lines.length - 1;
   while (bar >= 0 && CLAUDE_STATUS_WARNINGS.some((pattern) => pattern.test(lines[bar]!.trim()))) bar--;
   const supportedWarningFooter = lines[bar]?.trim() === "⏵⏵ accept edits on (shift+tab to cycle) · ← for agents";
+  const modeFooter = CLAUDE_MODE_FOOTER.test(lines[bar]?.trim() ?? "");
   let indent = /^([ \t]*)─{3,}$/.exec(lines[bar - 1] ?? "")?.[1];
   const framed = indent !== undefined;
   let prompt = lines[bar - 2] ?? "";
@@ -188,7 +193,7 @@ function findClaudeComposer(paneContent: string) {
     // or completed status ends this block; do not revive an older work row.
     if (!/^\s/.test(line)) { headSeen = true; break; }
   }
-  return { text: prompt.slice(indent.length), bar: lines[bar]!.trim(), framed, hasWarnings: bar < lines.length - 1, supportedWarningFooter, headSeen, liveStatus };
+  return { text: prompt.slice(indent.length), bar: lines[bar]!.trim(), framed, hasWarnings: bar < lines.length - 1, supportedWarningFooter, modeFooter, headSeen, liveStatus };
 }
 
 function findPromptDraftBeforeFooter(paneContent: string): string | null {
@@ -273,7 +278,9 @@ export function classifyPaneActivity(paneContent: string): PaneActivityClassific
   if (claudeComposer && (!claudeComposer.headSeen || (claudeComposer.hasWarnings && !claudeComposer.framed))) {
     return { state: "unknown", reason: "no_activity_signal", evidence: truncateEvidence(lastLine) };
   }
-  if (claudeComposer && (!claudeComposer.hasWarnings || claudeComposer.supportedWarningFooter) &&
+  // Below warning rows, any Claude mode footer completes the frame for an EMPTY composer (#808).
+  // Drafts keep the narrower check above: attention is needs_input, a send refusal for other modes.
+  if (claudeComposer && (!claudeComposer.hasWarnings || claudeComposer.modeFooter) &&
       IDLE_PROMPT_PATTERNS.some((pattern) => pattern.test(claudeComposer.text))) {
     return { state: "agent_idle", reason: idleStatusBarLine ? "idle_status_bar" : "idle_prompt",
       evidence: truncateEvidence(idleStatusBarLine ?? claudeComposer.text) };
```

**File**: `packages/daemon/test/claude-warning-footer-readiness.test.ts` (modified, +83/-0)
```diff
@@ -187,6 +187,69 @@ describe("Claude composer below noninteractive status warnings", () => {
   });
 });
 
+// #808: Claude's other permission-mode footers above the same warning rows. The bypass and
+// background-shell rows are native captures from Claude seats on 2026-10-05; the auto rows are
+// quoted from the #808 report (Claude 2.1.289, the second with vim's insert prefix).
+const modeBars = [
+  ["bypass, background shell (native)", "⏵⏵ bypass permissions on · 1 shell · ← for agents"],
+  ["bypass (native)", "⏵⏵ bypass permissions on (shift+tab to cycle) · ← for agents"],
+  ["accept edits, background shell (native)", "⏵⏵ accept edits on · 1 shell · ← for agents"],
+  ["auto", "⏵⏵ auto mode on (shift+tab to cycle)"],
+  ["auto, vim insert prefix", "-- INSERT -- ⏵⏵ auto mode on (shift+tab to cycle)"],
+  ["plan", "⏸ plan mode on (shift+tab to cycle)"],
+  ["default", "? for shortcuts"],
+] as const;
+const warningSets = [[update], [focus], [weekly], [update, focus]];
+// Native, from a Claude seat running a hook mid-turn (2026-10-05): the timer follows a hook label.
+const hookRow = "✽ Sketching… (running PostToolUse hook · 3m 12s · ↓ 7.9k tokens)";
+function modePane(hint: string, trailers: string[], composer = "❯\u00a0", before = "● Ready.\n\n✻ Crunched for 2s") {
+  return pane(trailers, composer, before).replace(bar, hint);
+}
+
+describe("#808: Claude permission-mode footers below status warnings", () => {
+  it.each(modeBars)("reads an empty framed composer as idle: %s", async (_name, hint) => {
+    for (const trailers of warningSets) {
+      const content = modePane(hint, trailers);
+      expect(classifyPaneActivity(content)).toMatchObject({ state: "agent_idle", reason: "idle_prompt", evidence: "❯" });
+      const service = new SeatStructuralActivityService({ capturePaneContent: async () => content });
+      expect(await service.pollSeat("seat@rig")).toMatchObject({ state: "agent_idle", reason: "idle_prompt" });
+    }
+  });
+
+  it("keeps a hook-running turn active under the accept-edits footer", () => {
+    for (const trailers of [[], ...warningSets]) {
+      expect(classifyPaneActivity(pane(trailers, "❯\u00a0", hookRow))).toMatchObject({ state: "agent_active", reason: "mid_work_pattern" });
+    }
+  });
+
+  it.each(modeBars)("keeps current work active: %s", (_name, hint) => {
+    for (const trailers of [[], ...warningSets]) for (const row of [...workingRows, hookRow]) {
+      expect(classifyPaneActivity(modePane(hint, trailers, "❯\u00a0", row)))
+        .toMatchObject({ state: "agent_active", reason: "mid_work_pattern" });
+    }
+  });
+
+  it.each(modeBars)("keeps a question as attention: %s", (_name, hint) => {
+    for (const trailers of [[], ...warningSets]) {
+      expect(classifyPaneActivity(modePane(hint, trailers, "❯\u00a0", "Do you want to proceed?\n❯ 1. Yes\n  2. No")).state)
+        .toBe("attention");
+    }
+  });
+
+  // A warning-suffixed draft stays unknown: reporting it as attention (needs_input) would be a new
+  // send refusal for these modes. Only the exact accept-edits footer keeps its existing attention.
+  it.each(modeBars)("never reads a warning-suffixed draft as idle and adds no refusal: %s", (_name, hint) => {
+    for (const trailers of warningSets) {
+      expect(classifyPaneActivity(modePane(hint, trailers, "❯ unfinished message")).state).toBe("unknown");
+      expect(classifyPaneActivity(modePane(hint, trailers, "❯\u00a0\n  unfinished second line")).state).toBe("unknown");
+    }
+  });
+
+  it.each(modeBars)("still requires the complete input frame: %s", (_name, hint) => {
+    expect(classifyPaneActivity(modePane(hint, [update, focus]).replaceAll(border, "")).state).toBe("unknown");
+  });
+});
+
 describe("first guarded Claude send with retained warning-shaped composer", () => {
   let db: Database.Database | undefined;
   afterEach(() => { db?.close(); db = undefined; });
@@ -288,6 +351,26 @@ describe("first guarded Claude send with retained warning-shaped composer", () =
     expect(f.sendKeys).not.toHaveBeenCalled();
   });
 
+  it.each(modeBars)("#808: explicit wait sends once into an idle composer: %s", async (_name, hint) => {
+    const f = setup(modePane(hint, [update, focus]));
+    const result = await f.transport.send(f.name, "ordinary marker", { waitForIdleMs: 200 });
+    expect(result).toMatchObject({ ok: true, sent: true, activity: { state: "idle", evidenceSource: "pane_heuristic" } });
+    expect(f.sendText).toHaveBeenCalledTimes(1);
+    expect(f.sendKeys).toHaveBeenCalledTimes(1);
+  });
+
+  it.each(modeBars)("#808: explicit wait leaves a draft and current work untouched: %s", async (_name, hint) => {
+    for (const content of [modePane(hint, [update, focus], "❯ unfinished message"), modePane(hint, [update, focus], "❯\u00a0", workingRows[0]),
+      modePane(hint, [update, focus], "❯\u00a0", hookRow)]) {
+      const f = setup(content);
+      const result = await f.transport.send(f.name, "ordinary marker", { waitForI
```

---

### Incident Patch 10: `8f29405f` (2026-10-05)
**Commit Message**: fix(claude): quote authored fork parent ids on the default launch path (#773)

On the default (non-managed) Claude launch path, the fork command now passes the parent session id through the existing shellQuote helper, like the --model and --effort values beside it. An authored fork parent id therefore stays a single literal argument when the pane's shell runs the command. Valid ids produce the same arguments as before; managed Claude and Codex already quoted this value.

Thanks to @DeryFerd for the change.

**File**: `packages/daemon/src/adapters/claude-code-adapter.ts` (modified, +4/-1)
```diff
@@ -292,7 +292,10 @@ export class ClaudeCodeAdapter implements RuntimeAdapter {
       }
       const cmd = managed ? managed.command(["--permission-mode", binding.permissionMode!, ...nonInterruptiveArgs(this.runtime, binding), ...(model ? ["--model", model] : []), ...(effort ? ["--effort", effort] : []),
         "--resume", parentId, "--fork-session", "--name", opts.name])
-        : `${rendererPrefix}claude ${permissionMode}${modelArg}${effortArg} --resume ${parentId} --fork-session --name ${opts.name}`;
+        // The non-managed command text is parsed by the pane shell, so the
+        // parent id needs the same quoting as --model/--effort above (and as
+        // the codex fork path) — a hostile id must not leave --resume.
+        : `${rendererPrefix}claude ${permissionMode}${modelArg}${effortArg} --resume ${shellQuote(parentId)} --fork-session --name ${opts.name}`;
       const textResult = managed ? await this.tmux.sendShellCommand(binding.tmuxSession, cmd, managed.assertCurrent)
         : this.seatLaunchEnvironment
           ? await this.tmux.sendShellCommand(binding.tmuxSession, await this.seatLaunchEnvironment.command(binding.tmuxSession, cmd, { nodeId: binding.nodeId, generation: binding.launchGeneration, runtime: this.runtime }), undefined, { sourceInPane: true })
```

**File**: `packages/daemon/test/session-source-fork.test.ts` (modified, +26/-1)
```diff
@@ -6,6 +6,7 @@ import { createFullTestDb } from "./helpers/test-app.js";
 import { RigSpecSchema } from "../src/domain/rigspec-schema.js";
 import { RigSpecCodec } from "../src/domain/rigspec-codec.js";
 import { ClaudeCodeAdapter, type ClaudeAdapterFsOps } from "../src/adapters/claude-code-adapter.js";
+import { shellQuote } from "../src/adapters/shell-quote.js";
 import { CodexRuntimeAdapter } from "../src/adapters/codex-runtime-adapter.js";
 import { TerminalAdapter } from "../src/adapters/terminal-adapter.js";
 import { StartupOrchestrator, type StartupInput } from "../src/domain/startup-orchestrator.js";
@@ -285,7 +286,7 @@ describe("ClaudeCodeAdapter.launchHarness fork branch", () => {
     const sendText = tmux.sendText as ReturnType<typeof vi.fn>;
     expect(sendText).toHaveBeenCalledWith(
       "r01-impl",
-      "CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN=1 claude --permission-mode acceptEdits --resume PARENT-TOKEN-ABC --fork-session --name dev-impl@test-rig",
+      "CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN=1 claude --permission-mode acceptEdits --resume 'PARENT-TOKEN-ABC' --fork-session --name dev-impl@test-rig",
     );
     if (result.ok) {
       // Captured token MUST be the new post-fork token, NOT the parent.
@@ -295,6 +296,30 @@ describe("ClaudeCodeAdapter.launchHarness fork branch", () => {
     }
   });
 
+  it("quotes a hostile fork parent id so it cannot leave the --resume argument (the pane shell is the sink)", async () => {
+    const tmux = mockTmux();
+    const adapter = new ClaudeCodeAdapter({ tmux, fsOps: mockClaudeFs("NEW-POST-FORK-TOKEN-XYZ") });
+
+    const hostileParent = "ABC-123'; touch /tmp/OPENRIG_PWNED; '";
+    const result = await adapter.launchHarness(makeBinding(), {
+      name: "dev-impl@test-rig",
+      forkSource: { kind: "native_id", value: hostileParent },
+    });
+
+    expect(result.ok).toBe(true);
+    const sendText = tmux.sendText as ReturnType<typeof vi.fn>;
+    const command = sendText.mock.calls[0]?.[1] as string;
+    // The parent id must arrive as ONE quoted shell word — same treatment
+    // as --model/--effort in the same template and as the codex fork path.
+    expect(command).toContain(`--resume ${shellQuote(hostileParent)}`);
+    // The raw payload must not sit unquoted behind --resume, or the pane
+    // shell would execute everything after the first quote terminator.
+    expect(command).not.toContain("--resume ABC-123");
+    if (result.ok) {
+      expect(result.resumeToken).toBe("NEW-POST-FORK-TOKEN-XYZ");
+    }
+  });
+
   it("refuses forkSource.kind=artifact_path (defensive — schema also rejects)", async () => {
     const tmux = mockTmux();
     const adapter = new ClaudeCodeAdapter({ tmux, fsOps: mockClaudeFs() });
```

---

### Incident Patch 11: `a9d3e05f` (2026-10-05)
**Commit Message**: fix(cli): start the local daemon for context add (#784)

rig context add now starts the local daemon when it isn't running, using the same local daemon-ensure path as other commands, instead of stopping with "Daemon not running". An explicitly selected remote host still wins over a leftover local daemon.json, and commands that don't need a daemon are unchanged. A selected host is normalized the same way as the client URL before deciding whether it's local, so LOCALHOST and IPv6 loopback spellings (::1, [::1], the expanded form) count as local.

**File**: `packages/cli/src/commands/context.ts` (modified, +27/-7)
```diff
@@ -28,9 +28,9 @@ import { parse as parseYaml } from "yaml";
 import { assertSafeInstallRef, assertTreeHasNoSymlinks, assertDestinationNamespaceContained, validateContextPackManifestForInstall } from "../lib/context-install.js";
 import { addGitContext, inspectGitContext, updateGitContext } from "../lib/context-git.js";
 import { ConfigStore } from "../config-store.js";
-import { DaemonClient } from "../client.js";
+import { DaemonClient, formatDaemonHostForUrl } from "../client.js";
 import { enumArg } from "../cli-error.js";
-import { getDaemonStatus, getDaemonUrl , statusGuardMessage} from "../daemon-lifecycle.js";
+import { getDaemonStatus, getDaemonUrl, startDaemon, statusGuardMessage} from "../daemon-lifecycle.js";
 import { resolveWorkPosition, type WorkInstallPlan } from "../lib/work-install.js";
 import {
   reconcileSkillLoadout,
@@ -39,6 +39,8 @@ import {
   type SkillLoadout,
 } from "@openrig/daemon/skill-loadout";
 import { realDeps } from "./daemon.js";
+import { prepareDaemonAutoStart } from "../daemon-auto-start.js";
+import { readOpenRigEnv } from "../openrig-compat.js";
 import type { StatusDeps } from "./status.js";
 
 const contextRuntimeArg = enumArg(["claude-code", "claude", "codex"]);
@@ -236,7 +238,7 @@ async function resolvePack(client: DaemonClient, nameOrRef: string): Promise<Con
   return matches[0]!;
 }
 
-export function contextCommand(depsOverride?: StatusDeps): Command {
+export function contextCommand(depsOverride?: StatusDeps & { preflightExec?: (cmd: string) => Promise<string> }): Command {
   const cmd = new Command("context")
     .description("Browse, preview, compose, and manage operator-authored context packs")
     .addHelpText("after", `
@@ -389,9 +391,27 @@ Examples:
       for (const warning of result.warnings) console.error(`Warning: ${warning}`);
     });
 
-  async function getClient(): Promise<DaemonClient> {
+  async function getClient(autoStartLocal = false): Promise<DaemonClient> {
     const deps = getDeps();
-    const status = await getDaemonStatus(deps.lifecycleDeps);
+    let status = await getDaemonStatus(deps.lifecycleDeps);
+    if (autoStartLocal && (status.state === "stopped" || status.state === "stale")
+      && !readOpenRigEnv("OPENRIG_URL", "RIGGED_URL")) {
+      // Startup uses current config. A retained endpoint must not mask an
+      // explicitly selected host when deciding whether startup is local.
+      const selection = new ConfigStore().resolveWithSource("daemon.host");
+      const host = selection.source === "default"
+        ? new URL(new DaemonClient().baseUrl).hostname
+        : new URL(`http://${formatDaemonHostForUrl(String(selection.value))}`).hostname;
+      if (["127.0.0.1", "localhost", "[::1]"].includes(host)) {
+        const prepared = await prepareDaemonAutoStart(deps.lifecycleDeps, depsOverride?.preflightExec);
+        if (!prepared.preflight.ready) {
+          throw new Error(prepared.preflight.checks.filter((check) => !check.ok)
+            .map((check) => `${check.name}: ${check.error}${check.fix ? ` Fix: ${check.fix}` : ""}`).join("\n"));
+        }
+        await startDaemon(prepared.options, deps.lifecycleDeps);
+        status = await getDaemonStatus(deps.lifecycleDeps);
+      }
+    }
     if (status.state !== "running" || status.healthy === false) {
       // B8-1b: epistemic-matched language via the one helper (down ≠ busy).
       const gm = statusGuardMessage(status); throw new Error(`${gm.fact} ${gm.action}`);
@@ -834,7 +854,7 @@ Examples:
         let gitSelection: ReturnType<typeof addGitContext>["selected"] | undefined;
         if ((opts.pack || opts.checkout) && !opts.git) throw new Error("--pack and --checkout require --git.");
         if (opts.git) {
-          const gitClient = await getClient();
+          const gitClient = await getClient(true);
           assertLocalGitClient(gitClient);
           ({ installedAt: targetDir, selected: gitSelection } = addGitContext(source, opts, targetRoot));
         } else if (isHttpUrl(source)) {
@@ -878,7 +898,7 @@ Examples:
           }
         }
         // Sync the daemon library so the new pack appears immediately.
-        const client = await getClient();
+        const client = await getClient(true);
         const syncRes = await client.post<{ count: number; errors?: Array<{ source: string; error: string }>; entries: ContextPackEntryWire[] }>("/api/context-packs/library/sync");
         if (syncRes.status !== 200) {
           // Install succeeded; sync failed → still surface install path.
```

**File**: `packages/cli/src/commands/up.ts` (modified, +7/-47)
```diff
@@ -8,7 +8,8 @@ import { parse as parseYamlDoc } from "yaml";
 import { Command } from "commander";
 import { DaemonClient, DaemonConnectionError } from "../client.js";
 import { getDaemonStatus, getDaemonUrl, startDaemon, type LifecycleDeps, daemonStatusGuard } from "../daemon-lifecycle.js";
-import type { RiggedConfig } from "../config-store.js";
+import { prepareDaemonAutoStart } from "../daemon-auto-start.js";
+import type { StartOptions } from "../daemon-lifecycle.js";
 import { realDeps } from "./daemon.js";
 import type { StatusDeps } from "./status.js";
 import { formatThreePart, type ThreePartRejection } from "./workflow-errors.js";
@@ -188,42 +189,11 @@ Examples:
       // Run preflight before auto-start
       let status = await getDaemonStatus(deps.lifecycleDeps);
       if (status.state !== "running") {
-        let resolvedConfig: RiggedConfig | null = null;
-        // bug-fix slice auth-bearer-tailscale-trust: track whether
-        // daemon.host was operator-explicit (env or config file) vs
-        // default-fallback. The daemon's multi-bind path (loopback +
-        // tailscale auto-detect) only runs when OPENRIG_HOST is NOT
-        // exported to the child, so we omit it on the default path.
-        // Hoisted to function scope so the startDaemon block below can
-        // read it after the preflight try-catch.
-        let hostForDaemon: string | undefined;
+        let startOptions: StartOptions;
         try {
-          const { ConfigStore } = await import("../config-store.js");
-          const { SystemPreflight } = await import("../system-preflight.js");
-          const { execSync } = await import("node:child_process");
-          const { OPENRIG_DIR, resolveBindIntent } = await import("../daemon-lifecycle.js");
-          const configStore = new ConfigStore();
-          resolvedConfig = configStore.resolve();
-          const hostResolution = configStore.resolveWithSource("daemon.host");
-          // S20 (r2 repair): the SHARED dedicated-intent seam — an env-sourced
-          // daemon.host (ENV_MAP ← OPENRIG_HOST, the injected routing channel) never
-          // creates bind intent through auto-start; flag-less auto-start honors only a
-          // FILE-sourced daemon.host or OPENRIG_BIND_HOST.
-          hostForDaemon = resolveBindIntent({
-            flagHost: undefined,
-            envBindHost: process.env["OPENRIG_BIND_HOST"],
-            configSource: hostResolution.source,
-            configHost: resolvedConfig.daemon.host,
-          }).host;
-          const preflightExec = depsOverride?.preflightExec ?? (async (cmd: string) =>
-            execSync(cmd, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }));
-          const preflight = new SystemPreflight({
-            exec: preflightExec,
-            configStore,
-            getDaemonStatus: () => getDaemonStatus(deps.lifecycleDeps),
-            openrigHome: OPENRIG_DIR,
-          });
-          const preflightResult = await preflight.run();
+          const prepared = await prepareDaemonAutoStart(deps.lifecycleDeps, depsOverride?.preflightExec);
+          startOptions = prepared.options;
+          const preflightResult = prepared.preflight;
           if (!preflightResult.ready) {
             for (const check of preflightResult.checks.filter((c) => !c.ok)) {
               console.error(`✗ ${check.name}: ${check.error}`);
@@ -240,17 +210,7 @@ Examples:
         }
 
         try {
-          await startDaemon({
-            port: resolvedConfig?.daemon.port,
-            host: hostForDaemon,
-            db: resolvedConfig?.db.path,
-            transcriptsEnabled: resolvedConfig?.transcripts.enabled,
-            transcriptsPath: resolvedConfig?.transcripts.path,
-            workspaceRoot: resolvedConfig?.workspace.root,
-            contextRoot: resolvedConfig?.context.root,
-            skillsRoot: resolvedConfig?.skills.root,
-            topologyRoot: resolvedConfig?.topology.root,
-          }, deps.lifecycleDeps);
+          await startDaemon(startOptions, deps.lifecycleDeps);
           status = await getDaemonStatus(deps.lifecycleDeps);
         } catch (err) {
           console.error(err instanceof Error ? err.message : String(err));
```

**File**: `packages/cli/src/daemon-auto-start.ts` (added, +45/-0)
```diff
@@ -0,0 +1,45 @@
+import type { LifecycleDeps, StartOptions } from "./daemon-lifecycle.js";
+import type { PreflightResult } from "./system-preflight.js";
+
+/** The configuration and preflight shared by local command auto-starts. */
+export async function prepareDaemonAutoStart(
+  deps: LifecycleDeps,
+  preflightExec?: (cmd: string) => Promise<string>,
+): Promise<{ options: StartOptions; preflight: PreflightResult }> {
+  const { ConfigStore } = await import("./config-store.js");
+  const { SystemPreflight } = await import("./system-preflight.js");
+  const { execSync } = await import("node:child_process");
+  const { OPENRIG_DIR, getDaemonStatus, resolveBindIntent } = await import("./daemon-lifecycle.js");
+  const configStore = new ConfigStore();
+  const config = configStore.resolve();
+  const hostResolution = configStore.resolveWithSource("daemon.host");
+  // The inherited routing host is not bind intent. Keep the existing up rule:
+  // only a file-selected host or OPENRIG_BIND_HOST selects an explicit bind.
+  const host = resolveBindIntent({
+    flagHost: undefined,
+    envBindHost: process.env["OPENRIG_BIND_HOST"],
+    configSource: hostResolution.source,
+    configHost: config.daemon.host,
+  }).host;
+  const preflight = await new SystemPreflight({
+    exec: preflightExec ?? (async (cmd: string) =>
+      execSync(cmd, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] })),
+    configStore,
+    getDaemonStatus: () => getDaemonStatus(deps),
+    openrigHome: OPENRIG_DIR,
+  }).run();
+  return {
+    preflight,
+    options: {
+      port: config.daemon.port,
+      host,
+      db: config.db.path,
+      transcriptsEnabled: config.transcripts.enabled,
+      transcriptsPath: config.transcripts.path,
+      workspaceRoot: config.workspace.root,
+      contextRoot: config.context.root,
+      skillsRoot: config.skills.root,
+      topologyRoot: config.topology.root,
+    },
+  };
+}
```

**File**: `packages/cli/test/context-auto-start.test.ts` (added, +184/-0)
```diff
@@ -0,0 +1,184 @@
+import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
+import { EventEmitter } from "node:events";
+import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
+import { tmpdir } from "node:os";
+import { join } from "node:path";
+import { Command } from "commander";
+import { contextCommand } from "../src/commands/context.js";
+import type { DaemonClient } from "../src/client.js";
+import { STATE_FILE, type LifecycleDeps } from "../src/daemon-lifecycle.js";
+
+describe("context add local auto-start", () => {
+  let root: string;
+  let source: string;
+  let previousExit: typeof process.exitCode;
+  beforeEach(() => {
+    root = mkdtempSync(join(tmpdir(), "context-auto-start-"));
+    source = join(root, "source");
+    mkdirSync(source);
+    writeFileSync(join(source, "manifest.yaml"), "name: fixture-pack\nversion: 1.0.0\ntaxonomy: world\nfiles:\n  - path: NOTES.md\n    role: instruction\n");
+    writeFileSync(join(source, "NOTES.md"), "fixture context\n");
+    vi.stubEnv("OPENRIG_HOME", join(root, "state"));
+    vi.stubEnv("OPENRIG_CONTEXT_ROOT", join(root, "context"));
+    vi.stubEnv("OPENRIG_DB", join(root, "state", "fixture.sqlite"));
+    vi.stubEnv("OPENRIG_TRANSCRIPTS_PATH", join(root, "transcripts"));
+    vi.stubEnv("OPENRIG_PORT", "42761");
+    vi.stubEnv("OPENRIG_HOST", "127.0.0.1");
+    vi.stubEnv("RIGGED_HOST", "");
+    previousExit = process.exitCode;
+    process.exitCode = undefined;
+    vi.spyOn(console, "log").mockImplementation(() => {});
+    vi.spyOn(console, "error").mockImplementation(() => {});
+  });
+  afterEach(() => {
+    process.exitCode = previousExit;
+    vi.unstubAllEnvs();
+    vi.restoreAllMocks();
+    rmSync(root, { recursive: true, force: true });
+  });
+
+  function fixture(initial: "stopped" | "running" | "unknown" = "stopped", stale = false) {
+    let started = initial === "running";
+    let state: string | null = stale
+      ? JSON.stringify({ pid: 900001, port: 42760, host: "127.0.0.1", db: "fixture.sqlite", startedAt: "2026-01-01T00:00:00Z" })
+      : null;
+    const statePath = join(root, "state", "daemon.json");
+    if (state) {
+      mkdirSync(join(root, "state"), { recursive: true });
+      writeFileSync(statePath, state);
+    }
+    const lifecycleDeps: LifecycleDeps = {
+      acquireStartLock: () => ({ recordChild: vi.fn(), release: vi.fn() }),
+      spawn: vi.fn(() => {
+        started = true;
+        return Object.assign(new EventEmitter(), { pid: 4321, exitCode: null, signalCode: null, unref: vi.fn() }) as never;
+      }),
+      fetch: vi.fn(async () => {
+        if (initial === "unknown") throw Object.assign(new Error("timeout"), { code: "ETIMEDOUT" });
+        if (!started) throw Object.assign(new Error("refused"), { code: "ECONNREFUSED" });
+        return { ok: true, json: async () => ({ pid: 4321, bind: { mode: "explicit", hosts: ["127.0.0.1"], tailscaleDetected: false } }) };
+      }),
+      kill: vi.fn(() => true),
+      readFile: vi.fn((p) => p === STATE_FILE ? state : null),
+      writeFile: vi.fn((p, content) => { if (p === STATE_FILE) state = content; }),
+      removeFile: vi.fn(),
+      exists: vi.fn((p) => p === STATE_FILE && state !== null),
+      mkdirp: vi.fn(),
+      openForAppend: vi.fn(() => 3),
+      isProcessAlive: vi.fn(() => started),
+      sleep: async () => {},
+    };
+    const post = vi.fn(async () => ({ status: 200, data: { count: 1, entries: [], errors: [] } }));
+    const clientFactory = vi.fn(() => ({ post }) as unknown as DaemonClient);
+    const preflightExec = vi.fn(async (cmd: string) => cmd === "tmux -V" ? "tmux 3.6a" : "");
+    const command = () => new Command().exitOverride().addCommand(contextCommand({ lifecycleDeps, clientFactory, preflightExec }));
+    const add = () => command().parseAsync(["node", "rig", "context", "add", source, "--json"]);
+    return { lifecycleDeps, clientFactory, preflightExec, post, command, add };
+  }
+
+  it("starts a stopped local daemon with configured paths then syncs the installed pack", async () => {
+    const f = fixture();
+    await f.add();
+    expect(process.exitCode).toBeUndefined();
+    expect(f.lifecycleDeps.spawn).toHaveBeenCalledOnce();
+    const options = vi.mocked(f.lifecycleDeps.spawn).mock.calls[0]![2];
+    expect(options.env.OPENRIG_PORT).toBe("42761");
+    expect(options.env.OPENRIG_DB).toBe(join(root, "state", "fixture.sqlite"));
+    expect(options.env.OPENRIG_HOST).toBeUndefined(); // Routing is not bind intent.
+    expect(f.clientFactory).toHaveBeenCalledWith("http://127.0.0.1:42761");
+    expect(f.post).toHaveBeenCalledWith("/api/context-packs/library/sync");
+    expect(readFileSync(join(root, "context", "fixture-pack", "NOTES.md"), "utf8")).toBe("fixture context\n");
+    expect(JSON.parse(vi.mocked(console.log).mock.calls[0]![0])).toMatchObject({ count: 1 });
+  });
+
+  it("uses a running daemon without a start or preflight", async () => {
```

---

### Incident Patch 12: `03d6f7ba` (2026-10-05)
**Commit Message**: docs(tui): complete the Escape order (external links, health view) (#806)

packages/tui/README.md: complete the Escape order for ordinary browsing, from an after-merge source check. Escape clears typed command text first; with history it returns from a spec detail, an open file or an external link and restores the previous filter; otherwise it closes an open health view, then clears a filter, then goes back (resolveEscapeAction, packages/tui/src/input.ts). Text only; no behaviour change.

**File**: `packages/tui/README.md` (modified, +4/-3)
```diff
@@ -54,9 +54,10 @@ Specs separates authored declarations from observed consumers. Open a consumer
 to inspect its served runtime and seat binding; missing source stays explicit.
 The selected source is re-read on refresh even if the library revision did not
 change. `back` or Escape returns to the previous selection, tab and scroll.
-Escape first cancels command editing. On a spec detail page or an open file it
-then goes back, and the list keeps its filter; elsewhere it clears an active
-filter before going back. On long spec pages,
+During ordinary browsing, Escape clears typed command text first. With
+history, it returns from a spec detail, an open file or an external link and
+restores the previous filter; otherwise it closes an open health view, then
+clears a filter, then goes back. On long spec pages,
 Up/Down scroll by default; Right enters links, then Up/Down and Enter follow them.
 `rig tui commands --json` lists the shared command registry.
 
```

---

### Incident Patch 13: `e428972a` (2026-10-05)
**Commit Message**: docs(as-built): correct five architecture claims from the post-merge check (#805)

Five corrections to the as-built architecture pages from an after-merge source check at fcaf1f8e. Text only.

- content-surfaces: a non-empty files or progress root value is not validated; malformed entries are skipped silently, so a malformed value can leave no configured roots.
- mission-control: a missing annotation, destinationSession or decision returns 400; a drop without reason is refused by the audit record and currently returns 500; resolve answers 409 qitem_not_leg1_parked for an item not parked on a human seat.
- coordination-primitive: transport:v1 is recorded only for a direct request from a known origin; otherwise origin-unknown:v1, relay:v1 or claimed:v1.
- workflow-runtime: a revision may change exception_routing, which applies to future occurrences only.
- living-notes-review: the TUI calls only the fleet review read.

**File**: `docs/as-built/architecture/content-surfaces.md` (modified, +3/-2)
```diff
@@ -35,8 +35,9 @@ resolves environment overrides, then settings-file values, then defaults.
 `workspace:<resolved-workspace-root>`. Their environment overrides are
 `OPENRIG_FILES_ALLOWLIST` and `OPENRIG_PROGRESS_SCAN_ROOTS`. Thus, an unset
 or empty environment variable, or an empty settings-file value, does **not**
-imply an empty allowlist in normal daemon startup (an invalid environment value
-is dropped with a warning). Some source comments and route hints still say
+imply an empty allowlist in normal daemon startup. A non-empty value is not
+validated: the decoders silently skip malformed entries (no `name:` prefix, or
+a relative path), so a malformed value can leave no configured roots. Some source comments and route hints still say
 otherwise or point only at the environment variable. The standalone `readAllowlistFromEnv` helper has different inputs
 and retains its legacy environment fallback.
 
```

**File**: `docs/as-built/architecture/coordination-primitive.md` (modified, +5/-1)
```diff
@@ -341,7 +341,11 @@ a daemon route or reconnect policy.
 
 Every write route derives its actor through `requireSenderIdentity`
 (`routes/require-sender-identity.ts:76`): the `X-OpenRig-Session` header wins
-over a body actor and is recorded as `transport:v1`; without the header, the
+over a body actor. On a direct request from a known origin it is recorded as
+`transport:v1`; `resolveRecordedProvenance` (`:199`) instead records
+`origin-unknown:v1` when the origin-unknown marker is set, `relay:v1` for a
+relayed request that carried `transport:v1`, and `claimed:v1` for other relayed
+requests. Without the header, the
 body actor is recorded as `claimed:v1`; with neither (or, for inbox drop,
 without the header) the route answers 400 `actor_required`. The stamp lands in
 `identity_provenance` on transitions, inbox, outbox and stream rows
```

**File**: `docs/as-built/architecture/living-notes-review.md` (modified, +4/-2)
```diff
@@ -50,8 +50,10 @@ holders, recent holders, overdue work, settled work, and workflow exceptions.
 "Recent" is the current UTC day; overdue is in-progress slice-tagged work past
 `closure_required_at`; settled is today's `handed_off_to` transitions; and
 attention is any active item that is `human-gate`, addressed to a `human…`
-session, or blocked on one (`gather.ts`). The TUI reads `/agents`, `/rig` and
-`/fleet`.
+session, or blocked on one (`gather.ts`). Of the three review reads, the TUI
+calls only `/fleet`, from its broad hydration (`packages/tui/src/hydrate.ts`);
+its client also defines methods for `/agents` and `/rig`, which nothing in the
+TUI calls.
 
 ## Slice source selection and phase
 
```

**File**: `docs/as-built/architecture/mission-control.md` (modified, +9/-3)
```diff
@@ -107,9 +107,15 @@ Verbs: **8** — `sed -n '/^export const MISSION_CONTROL_VERBS = \[/,/\] as cons
 
 `annotate` requires `annotation`, `hold` and `drop` require `reason`, `route`
 and `handoff` require `destinationSession`, and `resolve` requires a non-empty
-`decision` (all 400). Items already `done` or `handed-off` are refused with
-409 `qitem_already_terminal`, and an unknown item returns 404
-`qitem_not_found` (`routes/mission-control.ts:240–248`, `:330–341`).
+`decision`. A missing `annotation`, `destinationSession` or `decision` returns
+400. A `drop` without `reason` passes the queue closure check and is refused by
+the audit record instead; the wrapped `reason_required` error has no status
+mapping, so it returns 500 (`mission-control-action-log.ts:128–133`,
+`mission-control-write-contract.ts:245–248`). Items already `done` or
+`handed-off` are refused with 409 `qitem_already_terminal`, except under
+`resolve`, which answers 409 `qitem_not_leg1_parked` for any item not parked on
+a human seat. An unknown item returns 404 `qitem_not_found`
+(`routes/mission-control.ts:240–251`, `:330–341`).
 
 Each verb is one atomic daemon transaction: the queue mutation via
 `QueueRepository.updateWithinTransaction()` (`domain/queue-repository.ts:2358`,
```

**File**: `docs/as-built/architecture/workflow-runtime.md` (modified, +4/-2)
```diff
@@ -244,8 +244,10 @@ Inspection reports `current`, `source-only`, `compatible`, `incompatible`,
 are explicit dependency graphs without `next_hop.on` can be revised; a
 revision may add steps and change unstarted ones, but may not remove steps,
 touch a step with completed, live or failed work, drop a required obligation
-or its order, change workflow-wide fields, or add an unstarted step with no
-outstanding prerequisite. Applying needs the inspected version and digest, an
+or its order, change workflow-wide fields other than `exception_routing`, or
+add an unstarted step with no outstanding prerequisite. A changed
+`exception_routing` applies to future occurrences only; existing obligations
+keep their owners. Applying needs the inspected version and digest, an
 operation key, an actor and a reason; the receipt is kept in the instance's
 `revisionHistory`, and replaying the same key with a different decision is
 refused with `lifecycle_revision_conflict` (`workflow-reconciliation.ts:12`,
```

---

### Incident Patch 14: `e894d72e` (2026-10-05)
**Commit Message**: docs(as-built): correct four test-layers claims from the post-merge check (#804)

Four corrections to docs/as-built/test-layers.md from an after-merge source check at fcaf1f8e. Text only.

- OPENRIG_REAL_CLAUDE_INTEGRATION=1 enables only a placeholder that checks the parent id format; no real-Claude fork test exists yet.
- Without tmux, some tmux tests skip and others fail; the release-tag tests skip without local tags unless CI=true.
- The stub carries the resolved floor or full_bypass posture, including one from permission_policy, into its runner, but ignores non-interruptive launches and does not exercise native permissions.
- rig seat launch <seat> --fresh needs --reason.

**File**: `docs/as-built/test-layers.md` (modified, +7/-6)
```diff
@@ -52,10 +52,11 @@ to `main`. In the PR description, say which layers you ran and which you could n
 
 Some package tests are gated. `OPENRIG_E2E_REAL_CODEX=1` runs two daemon e2e tests against a
 real Codex (they also need tmux, `codex` and `~/.codex/auth.json`, and they use provider
-credits). `OPENRIG_REAL_CLAUDE_INTEGRATION=1` with `OPENRIG_PARENT_NATIVE_ID` runs one
-real-Claude fork test. Tests that need tmux skip when it is absent, and the CLI's release-tag
-tests skip without local tags unless `CI=true`. A green local run without tmux or tags has
-skipped these; CI installs tmux and fetches full history.
+credits). `OPENRIG_REAL_CLAUDE_INTEGRATION=1` enables only a placeholder: it requires
+`OPENRIG_PARENT_NATIVE_ID` and checks its format, and no real-Claude fork test exists yet.
+Without tmux, some tmux tests skip and others (such as `transcript-seat-env-native.test.ts`)
+fail. The CLI's release-tag tests skip without local tags unless `CI=true`, so a green local
+run without tags has skipped them. CI installs tmux and fetches full history.
 
 The TUI has its own vitest suite (`npm run test -w packages/tui`, which builds the TUI first)
 and runs in the `tui` leg of `package-tests`; `npm run test:tui-package` launches the packed
@@ -249,7 +250,7 @@ means:
 |---|---|---|
 | Consuming a message | `stub-runner.ts` runs its launch script once and then idles. It has no stdin reader, socket or other input channel. The default script prints `[stub] scripted reply: acknowledged` at boot, before anything has been sent. | A pane showing a reply, or your echoed text, does not prove the message was consumed. No stub scenario can currently prove "delivered and answered". Separately, `rig send --verify` means "appeared in the pane", not acknowledgement (see `rig send --help`), and the scenario `send` step doesn't pass `--verify` at all. |
 | Launch path | `StubRuntimeAdapter` types `node <stub-runner> …` into the pane (`tmux.sendText`, then Enter). Claude Code with an explicit permission mode launches through a managed launch (`ClaudeManagedLaunch.prepare`, `tmux.sendShellCommand`). Otherwise Claude Code, Codex and Pi launch through `SeatLaunchEnvironment.command` and `tmux.sendShellCommand`; the stub adapter does not get that environment. The shell-foreground check in `session-transport.ts` (`unverifiedShellForeground`) runs for every runtime except `terminal` and `claude-code`, and only `codex` has a native-process proof; Claude Code ordinary delivery applies its own uncertainty policy at the input boundary. | A stub seat doesn't exercise the seat launch environment, managed launch, wrappers or native-process identity (the class behind #197). Wrapping the stub in a shell wouldn't change that. |
-| Permissions | `validateNativePermissionSelection` accepts only `codex` and `claude-code`. The stub models only the `floor` / `full_bypass` launch posture. Non-interruptive launches and declarative `permission_policy` postures change the Claude and Codex launch arguments; the stub ignores both. | Testing Claude permission modes or per-seat permission selection needs a real runtime. |
+| Permissions | `validateNativePermissionSelection` accepts only `codex` and `claude-code`. The stub carries the resolved `floor` / `full_bypass` posture, including one set by a declarative `permission_policy`, into its runner's `--posture` argument and READY line. It ignores non-interruptive launches, and it doesn't exercise Claude or Codex native permission behaviour. | Testing Claude permission modes or per-seat permission selection needs a real runtime. |
 | Queue pickup and wake | No stub worker reacts to a nudge by claiming an item, working on it and handing it back. | The baton scenarios prove the claim *survives a restart*. They don't prove delivery, pickup or wake. |
 | Reboot / tmux reset | `daemon: {op: restart}` restarts only the scenario daemon, and the tmux server keeps running. No step resets tmux. | Recycled pane IDs and stale bindings after a real reboot (the class behind #141) are not covered by a daemon restart. |
 | Multi-rig and same-name identities | The `up` step always uses the scenario's top-level `topology` and ignores a per-step override. No step archives or removes a rig. | Cross-rig scope, same-name generations and archive/remove routing (the class behind #174) need runner work before they can be tested. |
@@ -423,7 +424,7 @@ Before you start, two honest constraints:
 - The `restart` step runs `rig launch <rig> <node> --json` and passes no other flag; the node
   is the logical ID (for example `dev.qa`). A stub seat has no resume token. `rig launch` has
   no `--fresh` option: a deliberate fresh start of a stub seat after `down` goes through
-  `rig up --existing <rig> --fresh <seat>` or `rig seat launch <seat> --fresh`, so the
+  `rig up --existing <rig> --fresh <seat>` or `rig seat launch <seat> --fresh --reason "<why>"`, so the
   `launch` row needs a runner binding to one of those first.
 
 | Group | Fami
```

---

### Incident Patch 15: `38d47b7e` (2026-10-05)
**Commit Message**: docs: Docs Verify follow-ups for #796 (TUI Escape) and #799 (For You page) (#803)

Corrections from after-merge source checks of the TUI README and one web UI as-built page. Text only; no behaviour change.

- packages/tui/README.md: Escape first cancels command editing; on a spec detail page or an open file it then goes back and the list keeps its filter; elsewhere it clears an active filter before going back.
- docs/as-built/ui/project-and-for-you.md: queue-derived cards supersede only matching action-required or approval event cards; only the workspace and mission headers show the remote host chip; the maintenance-notice dismissal is persisted alongside the theme choice.

**File**: `docs/as-built/ui/project-and-for-you.md` (modified, +14/-8)
```diff
@@ -22,9 +22,11 @@ last-updated: 2026-10-05
 The three operator-facing destination surfaces: **For You** (`/for-you`,
 the attention feed), **Project** (`/project*`, the workspace/mission/slice
 scope pages), and the **Dashboard** (`/`, the launcher). All read live
-daemon state. UI-local persistence is limited to the For You dismissals
-(two localStorage sets) and the theme choice (see
-[`library-specs-and-design-system.md`](library-specs-and-design-system.md)).
+daemon state. For You persists two dismissal sets in localStorage; shared
+shell preferences include the theme choice (see
+[`library-specs-and-design-system.md`](library-specs-and-design-system.md))
+and the maintenance-notice dismissal (see
+[`shell-and-routing.md`](shell-and-routing.md)).
 
 > Paths are relative to `packages/ui/src/` unless prefixed `docs/` or
 > `packages/`. Verified at `104b78ee` (package version 0.6.6). The web UI
@@ -113,7 +115,9 @@ shipped; otherwise progress. A human-seat destination forces
    `GET /api/queue/list?attention=1…`, or `GET /api/queue/attention-aggregate`
    when a remote host subscription is on) and needs-input seats
    (`useNeedsInputSeats`) become cards, and `mergeAttentionIntoFeed` lets a
-   queue-derived card supersede an event card with the same qitem.
+   queue-derived card supersede a matching event-derived **action-required
+   or approval** card; shipped, progress and observation event cards for the
+   same qitem remain.
 3. **Decision-band sort:** `sortFeedByDecisionBand` lifts every
    action-required and approval card above the rest, newest-first within
    each band.
@@ -227,8 +231,9 @@ remain for the `/lab/card-previews` gallery. No UI code calls
 > `:112-123`, `TabNav`, `ScopeShell`; defaults `useState` at `:698`,
 > `:798`, `:1226`.
 
-Off the local host, scope pages show an `ON <host>` chip, the Review tab is
-local-only, and file-backed sections explain why local files are not shown.
+Off the local host, the workspace and mission headers show an `ON <host>`
+chip (the slice header does not), the Review tab is local-only, and
+file-backed sections explain why local files are not shown.
 
 ### 3.1 WorkspaceScopePage (`/project`)
 
@@ -348,8 +353,9 @@ The vellum barrel `dashboard/vellum/index.ts` still exports
 ## 5. Cross-cutting properties
 
 - **Live daemon state** — every surface reads daemon hooks. UI-local state
-  is the two For You dismissal sets (localStorage), the lens, host filter
-  and optimistic-outcome map (transient), and each scope page's tab state.
+  on these surfaces is the two For You dismissal sets (localStorage), the
+  lens, host filter and optimistic-outcome map (transient), and each scope
+  page's tab state.
 - **Honest empty/error states** — `WorkspaceScopePage` no-workspace and
   `SliceScopePage` not-available surface the cause and a remediation
   pointer, never a blank screen.
```

**File**: `packages/tui/README.md` (modified, +3/-1)
```diff
@@ -54,7 +54,9 @@ Specs separates authored declarations from observed consumers. Open a consumer
 to inspect its served runtime and seat binding; missing source stays explicit.
 The selected source is re-read on refresh even if the library revision did not
 change. `back` or Escape returns to the previous selection, tab and scroll.
-Escape first cancels editing or clears an active filter. On long spec pages,
+Escape first cancels command editing. On a spec detail page or an open file it
+then goes back, and the list keeps its filter; elsewhere it clears an active
+filter before going back. On long spec pages,
 Up/Down scroll by default; Right enters links, then Up/Down and Enter follow them.
 `rig tui commands --json` lists the shared command registry.
 
```

#### Recent Merged Pull Requests:
- **PR #841** (2026-10-06): fix(install): run the installed compatibility checker explicitly (@mvschwarz)
- **PR #839** (2026-10-06): docs: Node on Linux, the npm 11 install-scripts warning, and cmux on macOS only (@mvschwarz)
- **PR #833** (2026-10-06): docs(tui): explain copying wrapped attachment commands (@mvschwarz)
- **PR #832** (2026-10-06): feat(install): add an explicit one-line setup wrapper (@mvschwarz)
- **PR #831** (2026-10-06): fix(tui): give attachment commands when Herdr is unavailable (@mvschwarz)
- **PR #830** (2026-10-06): feat(terminal): provide a default kernel conversation view (@mvschwarz)
- **PR #829** (2026-10-06): docs(contributing): point contributors' agents at what already exists (@mvschwarz)
- **PR #828** (2026-10-06): docs(skills): point contributors at the capability map first (@mvschwarz)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
