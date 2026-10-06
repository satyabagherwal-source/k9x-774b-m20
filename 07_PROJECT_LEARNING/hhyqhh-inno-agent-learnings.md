# Forensic Learning Record (Deep Inspection): hhyqhh/inno-agent

> **Canonical Artifact**: `07_PROJECT_LEARNING/hhyqhh-inno-agent-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/hhyqhh/inno-agent](https://github.com/hhyqhh/inno-agent))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:52:52.329Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `hhyqhh/inno-agent`
- **Description**: An open-source personal learning agent with three-layer memory (learner profile / wiki knowledge base / cross-conversation recall), a proactive scheduler, personal IM channels, and a workspace-scoped Practice Lab — built on the Pi SDK.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 1289 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/inno-agent/src/memory/learner/state-engine.ts`
```
import { collectLearningEvidence, evidenceWeight } from "./evidence.js";
import type {
	DerivedKnowledgeState,
	KnowledgeState,
	LearnerProfile,
	LearningEvidence,
	LearningEvent,
} from "./types.js";

const LEARNING_RATE = 0.35;
const REVIEW_RETRIEVABILITY_THRESHOLD = 0.7;

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

function validTime(value?: string): number | undefined {
	if (!value) return undefined;
	const parsed = Date.parse(value);
	return Number.isFinite(parsed) ? parsed : undefined;
}

function resultValue(evidence: LearningEvidence): number | undefined {
	// The categorical result is the authoritative rubric outcome. A model can
	// accidentally emit contradictory fields (for example, result=incorrect
	// with score=1); constrain the optional score to the selected result band
	// so malformed evidence can never invert the learning signal.
	if (evidence.result === "correct") return clamp(evidence.score ?? 1, 0.8, 1);
	if (evidence.result === "partial") return clamp(evidence.score ?? 0.5, 0.2, 0.79);
	if (evidence.result === "incorrect") return 0;
	return undefined;
}

function isRetrieval(evidence: LearningEvidence): boolean {
	return evidence.kind === "guided_recall"
		|| evidence.kind === "free_recall"
		|| evidence.kind === "application"
		|| evidence.kind === "transfer";
}

export function calculateRetrievability(
	lastSuccessfulRetrievalAt: string | undefined,
	stabilityDays: number,
	asOf: Date,
): number | undefined {
	const last = validTime(lastSuccessfulRetrievalAt);
	if (last === undefined) return undefined;
	const elapsedDays = Math.max(0, (asOf.getTime() - last) / 86_400_000);
	return clamp(0.9 ** (elapsedDays / Math.max(0.25, stabilityDays)), 0, 1);
}

function nextReviewAt(lastSuccessfulRetrievalAt: string | undefined, stabilityDays: number): string | undefined {
	const last = validTime(lastSuccessfulRetrievalAt);
	if (last === undefined) return undefined;
	const elapsedDays = stabilityDays
		* (Math.log(REVIEW_RETRIEVABILITY_THRESHOLD) / Math.log(0.9));
	return new Date(last + elapsedDays * 86_400_000).toISOString();
}

function stateDescription(state: DerivedKnowledgeState): { diagnosis: string; nextActions: string[] } {
	switch (state.state_label) {
		case "misconception":
			return {
				diagnosis: "存在与当前概念相关的活跃误区，应先修复而不是继续叠加讲解。",
				nextActions: ["使用反例或表征转换定位并修复误区。"],
			};
		case "stable":
			return {
				diagnosis: "有多次可靠提取和迁移证据，当前状态较稳定。",
				nextActions: ["直接应用该概念，必要时安排更远迁移。"],
			};
		case "review_due":
			return {
				diagnosis: "曾有成功提取，但根据间隔时间当前可能需要唤醒。",
				nextActions: ["先做一次无提示的低成本提取，不要提前重新讲解。"],
			};
		case "fragile":
			return {
				diagnosis: "近期有成功表现，但稳定度或证据质量仍不足。",
				nextActions: ["用一道轻微变式验证能否独立应用。"],
			};
		case "learning":
			return {
				diagnosis: "已有接触或低质量证据，尚不能确认独立掌握。",
				nextActions: ["用一个最小任务诊断，而不是询问学习者是否会。"],
			};
		default:
			return {
				diagnosis: "没有足够可靠的学习证据，当前状态未知。",
				nextActions: ["仅在当前任务确实依赖该概念时进行一次低成本诊断。"],
			};
	}
}

export interface ProjectKnowledgeStateOptions {
	asOf?: Date;
	hasActiveMisconception?: boolean;
	activeMisconceptionIds?: string[];
}

export function projectKnowledgeState(
	base: KnowledgeState | undefined,
	conceptId: string,
	evidence: LearningEvidence[],
	options: ProjectKnowledgeStateOptions = {},
): DerivedKnowledgeState {
	const asOf = options.asOf ?? new Date();
	let mastery = clamp(base?.mastery ?? 0.05, 0, 1);
	let estimateConfidence = clamp(
		base?.estimate_confidence
			?? Math.min(base?.confidence ?? 0.1, (base?.evidence_ids.length ?? 0) > 0 ? 0.6 : 0.35),
		0,
		1,
	);
	let stabilityDays = clamp(base?.stability_days ?? Math.max(0.25, (base?.stability ?? 0.1) * 7), 0.25, 365);
	let lastEvidenceAt = base?.last_evidence_at ?? base?.last_practiced_at;
	let lastSuccessfulRetrievalAt = base?.last_successful_retrieval_at;
	let lastResult: LearningEvidence["result"] | undefined = base?.last_result;
	let exposureCount = base?.exposure_count ?? 0;
	let retrievalCount = base?.retrieval_count ?? 0;
	let lapseCount = base?.lapse_count ?? 0;
	let successfulTransferCount = base?.successful_transfer_count ?? 0;
	const evidenceIds = new Set(base?.evidence_ids ?? []);
	const asOfTime = asOf.getTime();

	const relevant = evidence
		.filter((item) => {
			if (item.concept_id !== conceptId) return false;
			const occurredAt = validTime(item.occurred_at);
			return occurredAt === undefined || occurredAt <= asOfTime;
		})
		.sort((a, b) => (validTime(a.occurred_at) ?? 0) - (validTime(b.occurred_at) ?? 0));

	for (const item of relevant) {
		if (evidenceIds.has(item.evidence_id)) continue;
		evidenceIds.add(item.evidence_id);
		lastEvidenceAt = item.occurred_at;
		if (item.kind === "exposure") exposureCount += 1;
		if (isRetrieval(item)) retrievalCount += 1;

		const observed = resultValue(item);
		const weight = evidenceWeight(item);
		const isLegacy = item.metadata?.legacy === true;
		if (observed === undefined || weight === 0 || isLegacy) {
			continue;
		}
		if (isRetrieval(item)) lastResult = item.result;

		mastery = clamp(mastery + LEARNING_RATE * weight * (observed - mastery), 0, 1);
		estimateConfidence = clamp(1 - (1 - estimateConfidence) * (1 - 0.5 * weight), 0, 1);

		if (observed >= 0.8 && isRetrieval(item)) {
			const before = calculateRetrievability(lastSuccessfulRetrievalAt, stabilityDays, new Date(item.occurred_at)) ?? 1;
			stabilityDays = clamp(stabilityDays * (1 + 0.6 * weight + 0.3 * Math.max(0, 1 - before)), 0.25, 365);
			lastSuccessfulRetrievalAt = item.occurred_at;
			if (item.kind === "transfer") successfulTransferCount += 1;
		} else if (observed < 0.5 && isRetrieval(item)) {
			stabilityDays = clamp(stabilityDays * (0.8 - 0.4 * weight), 0.25, 365);
			lapseCount += 1;
		}
	}

	const retrievability = calculateRetrievability(lastSuccessfulRetrievalAt, stabilityDays, asOf);
	let stateLabel: DerivedKnowledgeState["state_label"];
	if (options.hasActiveMisconception) {
		stateLabel = "misconception";
	} else if (
		mastery >= 0.75
		&& estimateConfidence >= 0.65
		&& stabilityDays >= 7
		&& successfulTransferCount > 0
	) {
		stateLabel = "stable";
	} else if (lastResult === "incorrect") {
		stateLabel = "learning";
	} else if (retrievability !== undefined && retrievability < REVIEW_RETRIEVABILITY_THRESHOLD) {
		stateLabel = "review_due";
	} else if (lastSuccessfulRetrievalAt) {
		stateLabel = "fragile";
	} else if (relevant.length > 0 || base?.last_practiced_at) {
		stateLabel = "learning";
	} else {
		stateLabel = "unknown";
	}

	const projected: DerivedKnowledgeState = {
		concept_id: conceptId,
		concept_name: base?.concept_name ?? conceptId,
		domain: base?.domain ?? "general",
		mastery,
		estimate_confidence: estimateConfidence,
		stability_days: stabilityDays,
		retrievability,
		last_evidence_at: lastEvidenceAt,
		last_successful_retrieval_at: lastSuccessfulRetrievalAt,
		last_result: lastResult,
		next_review_at: nextReviewAt(lastSuccessfulRetrievalAt, stabilityDays),
		exposure_count: exposureCount,
		retrieval_count: retrievalCount,
		lapse_count: lapseCount,
		successful_transfer_count: successfulTransferCount,
		active_misconception_ids: options.activeMisconceptionIds ?? [],
		evidence_ids: [...evidenceIds],
		state_label: stateLabel,
		diagnosis: "",
		next_actions: [],
	};
	const description = stateDescription(projected);
	projected.diagnosis = description.diagnosis;
	projected.next_actions = description.nextActions;
	return projected;
}

/**
 * Fold a derived evidence snapshot back into the compact learner profile.
 * This keeps state stable when events.jsonl is tail-read or rotated; evidence
 * ids prevent recent events from being applied twice on the next projection.
 */
export function applyDerivedKnowledgeState(
	profile: LearnerProfile,
	state: DerivedKnowledgeState,
): boolean {
	const target = profile.knowledge_states.find((item) => item.concept_id === state.concept_id);
	if (!target) return false;
	const before = JSON.stringify(target);
	target.mastery = state.mastery;
	// Keep the v1 fields coherent while the existing profile API/UI migrates to
	// the explicit v2 fields below.
	target.confidence = state.estimate_confidence;
	target.stability = clamp(state.stability_days / 7, 0, 1);
	target.last_practiced_at = state.last_evidence_at;
	target.estimate_confidence = state.estimate_confidence;
	target.stability_days = state.stability_days;
	target.retrievability = state.retrievability;
	target.state_label = state.state_label;
	target.last_evidence_at = state.last_evidence_at;
	target.last_successful_retrieval_at = state.last_successful_retrieval_at;
	target.last_result = state.last_result;
	target.exposure_count = state.exposure_count;
	target.retrieval_count = state.retrieval_count;
	target.lapse_count = state.lapse_count;
	target.successful_transfer_count = state.successful_transfer_count;
	target.review_due_at = state.next_review_at;
	target.evidence_ids = [...state.evidence_ids];
	target.diagnosis = state.diagnosis;
	target.next_actions = [...state.next_actions];
	return JSON.stringify(target) !== before;
}

/**
 * A misconception is not cleared merely because the same concept was used.
 * Only an explicitly linked, reliable repair check moves it out of the active
 * blocker state. A later linked failure reactivates it.
 */
export function applyEvidenceToLinkedMisconception(
	profile: LearnerProfile,
	evidence: LearningEvidence,
): boolean {
	if (!evidence.misconception_id) return false;
	const target = profile.misconceptions.find((item) => (
		item.misconception_id === evidence.misconception_id
		&& item.concept_id === evidence.concept_id
	));
	if (!target) return false;
	const before = JSON.stringify(target);
	if (!target.evidence_ids.includes(evidence.evidence_id)) {
		target.evidence_ids.push(evidence.evidence_id);
	}
	if (evidence.result === "incorrect" || evidence.result === "partial") {
		target.status = "active";
		target.last_seen_at = evidence.occurred_at;
	} else if (
		evidence.result === "correct"
		&&
```

### Core Architecture Module: `apps/inno-agent/src/scheduler/cron-utils.ts`
```
import { logger } from "../logger.js";
import { CronExpressionParser } from "cron-parser";

/**
 * Default timezone for scheduled jobs when neither the job nor the global
 * `scheduler.timezone` config specifies one.
 */
export const DEFAULT_SCHEDULER_TIMEZONE = "Asia/Shanghai";

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_OCCURRENCES_PER_DAY = 10_000;

export function computeNextRunAt(
	cron: string,
	timezone: string,
	currentDate: Date = new Date(),
): string | undefined {
	try {
		const expr = CronExpressionParser.parse(cron, {
			currentDate,
			tz: timezone || DEFAULT_SCHEDULER_TIMEZONE,
		});
		return expr.next().toDate().toISOString();
	} catch (err) {
		logger.warn({ err, cron }, "failed to compute next run time");
		return undefined;
	}
}

export function isCronDue(
	cron: string,
	timezone: string,
	lastRunAt: string | undefined,
	now: Date = new Date(),
): boolean {
	return getCronDueAt(cron, timezone, lastRunAt, now) !== undefined;
}

/**
 * Return the most recent cron occurrence that the scheduler should execute.
 * The scheduler intentionally keeps its existing two-minute catch-up behavior
 * for jobs that have never run, while exposing the exact occurrence so daily
 * check-in progress can be tied to a plan slot instead of a wall-clock run.
 */
export function getCronDueAt(
	cron: string,
	timezone: string,
	lastRunAt: string | undefined,
	now: Date = new Date(),
): string | undefined {
	try {
		const expr = CronExpressionParser.parse(cron, {
			currentDate: now,
			tz: timezone || DEFAULT_SCHEDULER_TIMEZONE,
		});
		const prev = expr.prev().toDate();

		if (!lastRunAt) {
			const diffMs = now.getTime() - prev.getTime();
			return diffMs >= 0 && diffMs < 120_000 ? prev.toISOString() : undefined;
		}

		return prev.getTime() > new Date(lastRunAt).getTime() ? prev.toISOString() : undefined;
	} catch (err) {
		logger.warn({ err, cron }, "failed to check if cron is due");
		return undefined;
	}
}

/**
 * Enumerate every occurrence of a cron expression whose instant falls inside
 * one calendar day in `dayTimezone`. The expression itself is evaluated in
 * the job timezone, matching the scheduler, while the check-in day boundary
 * remains the global scheduler timezone.
 */
export function getCronOccurrencesForDate(
	cron: string,
	timezone: string,
	dateKey: string,
	dayTimezone: string = timezone || DEFAULT_SCHEDULER_TIMEZONE,
): string[] {
	if (!DATE_KEY_RE.test(dateKey)) return [];
	try {
		const start = zonedDateKeyToUtc(dateKey, dayTimezone);
		const end = zonedDateKeyToUtc(nextDateKey(dateKey), dayTimezone);
		const expr = CronExpressionParser.parse(cron, {
			currentDate: new Date(start.getTime() - 1),
			tz: timezone || DEFAULT_SCHEDULER_TIMEZONE,
		});
		const occurrences: string[] = [];
		for (let i = 0; i < MAX_OCCURRENCES_PER_DAY; i++) {
			const next = expr.next().toDate();
			if (next.getTime() >= end.getTime()) break;
			if (next.getTime() >= start.getTime()) occurrences.push(next.toISOString());
		}
		return occurrences;
	} catch (err) {
		logger.warn({ err, cron, timezone, dateKey, dayTimezone }, "failed to enumerate cron occurrences");
		return [];
	}
}

/** Calendar date in an IANA timezone, represented as YYYY-MM-DD. */
export function dateKeyForTimeZone(date: Date, timezone: string): string {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone: timezone || DEFAULT_SCHEDULER_TIMEZONE,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(date);
	const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
	return `${values.year}-${values.month}-${values.day}`;
}

/** Return the next Gregorian calendar date for a validated date key. */
function nextDateKey(dateKey: string): string {
	const [year, month, day] = dateKey.split("-").map(Number);
	const next = new Date(Date.UTC(year, month - 1, day + 1));
	return [next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate()]
		.map((part) => String(part).padStart(2, "0"))
		.join("-");
}

/** Convert a local midnight date key to its corresponding UTC instant. */
function zonedDateKeyToUtc(dateKey: string, timezone: string): Date {
	const [year, month, day] = dateKey.split("-").map(Number);
	const guess = new Date(Date.UTC(year, month - 1, day));
	let result = guess;
	// Re-evaluate twice so DST transitions converge to the correct offset.
	for (let i = 0; i < 2; i++) {
		const parts = new Intl.DateTimeFormat("en-US", {
			timeZone: timezone || DEFAULT_SCHEDULER_TIMEZONE,
			hourCycle: "h23",
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		}).formatToParts(result);
		const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
		const localAsUtc = Date.UTC(
			Number(values.year),
			Number(values.month) - 1,
			Number(values.day),
			Number(values.hour),
			Number(values.minute),
			Number(values.second),
		);
		result = new Date(guess.getTime() - (localAsUtc - result.getTime()));
	}
	return result;
}

/**
 * Validate a cron expression. Returns { ok: true } if parseable,
 * otherwise { ok: false, error: string }.
 */
export function validateCron(cron: string, timezone = DEFAULT_SCHEDULER_TIMEZONE): { ok: true } | { ok: false; error: string } {
	const value = (cron ?? "").trim();
	if (!value) return { ok: false, error: "Cron expression is required" };
	const fields = value.split(/\s+/);
	if (fields.length !== 5) {
		return { ok: false, error: `Cron must have 5 fields (minute hour day month weekday), got ${fields.length}` };
	}
	try {
		CronExpressionParser.parse(value, { tz: timezone || DEFAULT_SCHEDULER_TIMEZONE });
		return { ok: true };
	} catch (err) {
		return { ok: false, error: err instanceof Error ? err.message : String(err) };
	}
}

/**
 * Detect a cron that can only fire once (minute, hour, day-of-month, month
 * all pinned to a single literal value). After firing, such a job's next run
 * would be a year later, which is almost never what the user intended for
 * one-shot reminders like "tomorrow at 14:30".
 */
export function isOneShotCron(cron: string): boolean {
	const fields = (cron ?? "").trim().split(/\s+/);
	if (fields.length !== 5) return false;
	const [m, h, dom, mon] = fields;
	const literal = /^\d+$/;
	return literal.test(m) && literal.test(h) && literal.test(dom) && literal.test(mon);
}

```

### Core Architecture Module: `apps/inno-agent/src/utils/fetch-logger.ts`
```
/**
 * Lightweight fetch wrapper that logs HTTP requests to LLM providers.
 *
 * Installed once at startup via {@link installFetchLogger}. It wraps
 * `globalThis.fetch` so that any SDK (OpenAI, Anthropic, etc.) that uses
 * `fetch` under the hood will have its request URL and timing logged through
 * the shared Pino logger.
 *
 * Every LLM request gets a unique {@code seq/timestamp} identifier so that
 * request and response log lines can be correlated even when concurrent
 * calls produce interleaved output.
 *
 * Privacy: by default only metadata (URL, status, elapsed time, body sizes)
 * is logged. Request/response bodies — which contain the system prompt,
 * learner profile, user messages and model output — are only logged when
 * LOG_LLM_BODY=1 is set explicitly.
 */

import { logger } from "../logger.js";

/** URL path segments that identify an LLM API call. */
const LLM_API_PATTERNS = [
  "/chat/completions",   // OpenAI & OpenAI-compatible providers
  "/messages",           // Anthropic Messages API
  "/api/stream",         // PI proxy mode
];

/** Maximum characters of the request body to log (avoid blowing up log files). */
const MAX_BODY_LENGTH = 8000;

/** Maximum characters of the response body to log. */
const MAX_RESPONSE_BODY_LENGTH = 4000;

/**
 * Body logging is opt-in: request bodies contain the system prompt, learner
 * profile, user messages and uploaded document contents, and response bodies
 * contain model output — all of it private learning data that should not sit
 * in `log/server-*.log` by default. Set LOG_LLM_BODY=1 (or "true") to include
 * truncated bodies when actively debugging a provider issue. Read dynamically
 * so the toggle works without a restart (and stays testable).
 */
function shouldLogBodies(): boolean {
	return /^(1|true|yes)$/i.test(process.env.LOG_LLM_BODY ?? "");
}

type FetchFn = typeof globalThis.fetch;

/** Monotonically-increasing sequence number for LLM request correlation. */
let nextSeq = 1;

/** Build a {@code seq/unixTimestamp} request identifier. */
function nextReqId(): string {
  const seq = nextSeq++;
  const ts = Math.floor(Date.now() / 1000);
  return `${seq}/${ts}`;
}

/**
 * Wrap `globalThis.fetch` to log POST requests whose URL matches a known
 * LLM API pattern. The original `fetch` is called transparently so this
 * wrapper has no effect on request behaviour.
 */
export function installFetchLogger(): void {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async function (
    input: Parameters<FetchFn>[0],
    init?: Parameters<FetchFn>[1],
  ): ReturnType<FetchFn> {
    const url = resolveURL(input);
    const method = (init?.method ?? "GET").toString().toUpperCase();
    const isLlmCall = method === "POST" && LLM_API_PATTERNS.some((p) => url.includes(p));
    const reqId = isLlmCall ? nextReqId() : "";
    const startTime = isLlmCall ? Date.now() : 0;

    if (isLlmCall) {
      const bodyStr = extractBodyString(init?.body);
      // Default: metadata only (see shouldLogBodies). bodyBytes keeps size
      // observability without persisting the content itself.
      const fields: Record<string, unknown> = { reqId, url, requestBodyBytes: bodyStr.length };
      if (shouldLogBodies()) {
        fields.requestBody = bodyStr.length > MAX_BODY_LENGTH
          ? bodyStr.slice(0, MAX_BODY_LENGTH) + "...[truncated]"
          : bodyStr;
      }
      logger.info(fields, `[LLM ${reqId}] REQ → POST ${url}`);
    }

    let response: Awaited<ReturnType<FetchFn>>;
    try {
      response = (await originalFetch.call(
        globalThis,
        input,
        init,
      )) as Awaited<ReturnType<FetchFn>>;
    } catch (err) {
      if (isLlmCall) {
        const elapsedMs = Date.now() - startTime;
        const error = err instanceof Error
          ? {
              name: err.name,
              message: err.message,
              stack: err.stack,
              cause: formatErrorCause(err.cause),
            }
          : { name: "Error", message: String(err), stack: undefined };
        logger.warn(
          { reqId, url, elapsedMs, error },
          `[LLM ${reqId}] FETCH ERROR after ${elapsedMs}ms`,
        );
      }
      throw err;
    }

    // Log response for LLM API calls
    if (isLlmCall) {
      const elapsedMs = Date.now() - startTime;
      logResponse(reqId, url, response, elapsedMs).catch(() => {
        // Silently ignore logging errors to avoid breaking the caller.
      });
    }

    return response;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveURL(input: Parameters<FetchFn>[0]): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  // Request object — check .url before falling back to string coercion.
  if (input != null && typeof input === "object" && "url" in input) {
    return String((input as { url: unknown }).url);
  }
  return String(input);
}

function formatErrorCause(cause: unknown): Record<string, unknown> | undefined {
  if (cause == null) return undefined;
  if (cause instanceof Error) {
    return {
      name: cause.name,
      message: cause.message,
      stack: cause.stack,
      ...("code" in cause ? { code: cause.code } : {}),
    };
  }
  if (typeof cause === "object") {
    return Object.fromEntries(
      Object.entries(cause as Record<string, unknown>)
        .filter(([, value]) => typeof value !== "function"),
    );
  }
  return { message: String(cause) };
}

function extractBodyString(
  body: NonNullable<Parameters<FetchFn>[1]>["body"],
): string {
  if (body == null) return "";
  if (typeof body === "string") return body;
  if (body instanceof Uint8Array || body instanceof ArrayBuffer) {
    return new TextDecoder().decode(body);
  }
  // ReadableStream / FormData / URLSearchParams / Blob — skip.
  return "[non-text body]";
}

async function logResponse(
  reqId: string,
  url: string,
  response: Response,
  elapsedMs: number,
): Promise<void> {
  const status = response.status;
  let bodyStr = "";

  if (shouldLogBodies()) {
    try {
      // Clone so we can read the body without consuming it for the caller.
      const cloned = response.clone();
      bodyStr = await cloned.text();
    } catch {
      bodyStr = "[unable to read response body]";
    }

    if (bodyStr.length > MAX_RESPONSE_BODY_LENGTH) {
      bodyStr = bodyStr.slice(0, MAX_RESPONSE_BODY_LENGTH) + "...[truncated]";
    }
  } else {
    // Content-Length keeps response-size observability without reading
    // (and persisting) the body itself.
    bodyStr = "";
  }

  const level = status >= 400 ? "warn" : "info";
  const elapsed = elapsedMs >= 1000
    ? `${(elapsedMs / 1000).toFixed(1)}s`
    : `${elapsedMs}ms`;
  const fields: Record<string, unknown> = { reqId, url, status, elapsedMs };
  if (shouldLogBodies()) {
    fields.responseBody = bodyStr;
  } else {
    const contentLength = response.headers.get("content-length");
    if (contentLength) fields.responseBodyBytes = Number.parseInt(contentLength, 10);
  }
  logger[level](
    fields,
    `[LLM ${reqId}] RESP ← ${status} (${elapsed})`,
  );
}

```

### Core Architecture Module: `apps/inno-agent/src/utils/path-safety.ts`
```
/**
 * Symlink-aware path containment checks, shared by the HTTP file endpoints
 * (server/file-helpers.ts) and the agent-side workspace path guard
 * (agent/workspace-path-guard.ts).
 *
 * A purely lexical `resolve` + `relative` check is not enough for paths that
 * may contain symlinks: a symlink planted inside an allowed root (e.g. by the
 * agent's bash tool inside a workspace) lets a request escape to any file on
 * the host. The checks here resolve the closest *existing* ancestor through
 * `realpathSync` and project the non-existent suffix from there, so symlink
 * escapes are caught for both reads and writes.
 *
 * "Existing" is determined with `lstatSync`, not `existsSync`: `existsSync`
 * follows links, so a *dangling* symlink (target missing) would look like a
 * non-existent suffix and skip the realpath check — and a subsequent write
 * would follow the link and create the file outside the root. With lstat the
 * symlink itself counts as existing, and `realpathSync` on a dangling link
 * throws, which fails closed.
 */

import { lstatSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

export function isWithin(root: string, target: string): boolean {
	const rel = relative(root, target);
	return rel === "" || (!isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${sep}`));
}

/**
 * Closest ancestor of `target` that exists, where a symlink itself counts as
 * existing even when its target does not (see module header). Returns null
 * when nothing exists or a component cannot be inspected.
 */
export function findExistingAncestor(target: string): string | null {
	let current = target;
	for (;;) {
		try {
			lstatSync(current);
			return current;
		} catch (err) {
			const code = (err as NodeJS.ErrnoException).code;
			// Only "not there" keeps the walk going; anything else (EACCES,
			// ELOOP, ...) fails closed instead of skipping past a component
			// we cannot inspect.
			if (code !== "ENOENT" && code !== "ENOTDIR") return null;
			const parent = dirname(current);
			if (parent === current) return null;
			current = parent;
		}
	}
}

/**
 * Canonicalize a containment root. The root itself may contain symlink
 * components (e.g. macOS /tmp → /private/tmp); children's realpaths never
 * match a non-canonical root, which would silently reject every legitimate
 * path. Falls back to the lexical path when the root does not exist yet.
 */
export function canonicalContainmentRoot(dir: string): string {
	try {
		return realpathSync(dir);
	} catch {
		return dir;
	}
}

/**
 * Canonicalize a path that may not exist yet: realpath the closest existing
 * ancestor and project the missing suffix from there. Unlike a bare
 * realpath-or-lexical fallback, this stays correct when the path is missing
 * but an ancestor contains a symlink (macOS /var → /private/var, symlinked
 * $HOME) — the mixed lexical/canonical comparison would otherwise reject
 * every legitimate path under the not-yet-created directory.
 */
function canonicalizePossiblyMissing(target: string): string | null {
	const ancestor = findExistingAncestor(target);
	if (!ancestor) return null;
	try {
		return resolve(realpathSync(ancestor), relative(ancestor, target));
	} catch {
		return null;
	}
}

/**
 * Resolve `userPath` against `baseDir` and verify that the canonical
 * (symlink-resolved) target stays inside the canonical base. Returns the
 * lexically resolved path (not the canonical one — callers keep their
 * existing path semantics) or null when the path escapes.
 */
export function resolveContainedPath(baseDir: string, userPath: string): string | null {
	try {
		const resolvedBase = resolve(baseDir);
		const resolvedPath = resolve(resolvedBase, userPath);
		// Fast lexical reject before touching the filesystem.
		if (!isWithin(resolvedBase, resolvedPath)) return null;

		// The base may not exist yet (e.g. the L2 dir before the first wiki
		// page is written); canonicalize it through its own existing ancestor
		// so a symlinked ancestor cannot make every legitimate path mismatch.
		const canonicalBase = canonicalizePossiblyMissing(resolvedBase);
		if (!canonicalBase) return null;
		const canonicalTarget = canonicalizePossiblyMissing(resolvedPath);
		if (!canonicalTarget) return null;
		if (!isWithin(canonicalBase, canonicalTarget)) return null;

		return resolvedPath;
	} catch {
		return null;
	}
}

```

### Core Architecture Module: `apps/inno-agent/src/utils/process-fallback.ts`
```
/**
 * Process-level last-resort handlers (`uncaughtException` / `unhandledRejection`).
 *
 * Without these, a single stray rejection or an exception thrown from inside a
 * catch block (e.g. the HTTP catch-all calling `json()` after SSE headers were
 * already sent) takes the whole process down with no log entry and no cleanup.
 * Node's own stance is that the process state is untrustworthy after an
 * uncaught exception, so these handlers log at fatal level and then shut down
 * gracefully rather than trying to soldier on.
 */

import { logger } from "../logger.js";

export interface ProcessFallbackOptions {
	/**
	 * Best-effort cleanup before exit (e.g. closing the HTTP server so
	 * in-flight SSE/terminal clients get a close frame instead of a hang).
	 * A thrown error here is ignored — the process exits regardless.
	 */
	onFatal?: () => void | Promise<void>;
	/** Max milliseconds to wait for `onFatal` before forcing exit. */
	exitTimeoutMs?: number;
}

let installed = false;
let shuttingDown = false;

export function installProcessFallbacks(options: ProcessFallbackOptions = {}): void {
	if (installed) return;
	installed = true;

	const fatal = (kind: string, err: unknown): void => {
		// A second fault while shutting down (e.g. cleanup throws, or another
		// rejection lands) must not recurse — exit immediately.
		if (shuttingDown) {
			process.exit(1);
		}
		shuttingDown = true;

		logger.fatal({ err }, `[inno] ${kind} — shutting down`);

		const forceExit = setTimeout(() => process.exit(1), options.exitTimeoutMs ?? 3_000);
		forceExit.unref();

		Promise.resolve()
			.then(() => options.onFatal?.())
			.catch(() => {
				// Cleanup is best-effort; never let it block or prevent the exit.
			})
			.finally(() => process.exit(1));
	};

	process.on("uncaughtException", (err) => fatal("uncaughtException", err));
	process.on("unhandledRejection", (reason) => fatal("unhandledRejection", reason));
}

```

### Core Architecture Module: `apps/inno-agent/src/utils/proxy-bypass.ts`
```
import type { InnoConfig } from "../config.js";
import { logger } from "../logger.js";

const NO_PROXY_KEYS = ["NO_PROXY", "no_proxy"] as const;
let managedHosts = new Set<string>();

export function applyProviderProxyBypass(config: InnoConfig): void {
	const hosts = Object.values(config.providers)
		.filter((provider) => provider.bypassProxy === true)
		.map((provider) => parseHostname(provider.baseUrl))
		.filter((host): host is string => Boolean(host));

	const current = splitNoProxy(process.env.NO_PROXY ?? process.env.no_proxy ?? "");
	const previousManagedHosts = managedHosts;
	const merged = new Set(current.filter((host) => !managedHosts.has(host)));
	const nextManagedHosts = new Set<string>();
	for (const host of hosts) {
		if (!merged.has(host)) {
			merged.add(host);
			nextManagedHosts.add(host);
		}
	}
	managedHosts = nextManagedHosts;
	const added = Array.from(nextManagedHosts).filter((host) => !previousManagedHosts.has(host));
	const removed = Array.from(previousManagedHosts).filter((host) => !nextManagedHosts.has(host));

	const next = Array.from(merged).join(",");
	for (const key of NO_PROXY_KEYS) {
		process.env[key] = next;
	}
	if (added.length > 0 || removed.length > 0) {
		logger.info({ added, removed }, "[inno] provider proxy bypass updated");
	}
}

function parseHostname(baseUrl: string): string | undefined {
	try {
		return new URL(baseUrl).hostname;
	} catch {
		return undefined;
	}
}

function splitNoProxy(value: string): string[] {
	return value
		.split(",")
		.map((part) => part.trim())
		.filter(Boolean);
}

```

### Core Architecture Module: `apps/inno-agent/web/src/react/chat/composer-utils.ts`
```
import type { InlineImage } from "../../api/chat.js";

export const PASTE_COLLAPSE_LINES = 20;
export const PASTE_COLLAPSE_CHARS = 2000;
const COMPOSER_MIN_LINES = 2;
const COMPOSER_MAX_LINES = 8;

export interface PendingPasteBlock {
	id: number;
	text: string;
}

/**
 * A staged composer attachment. `local` items carry the OS File until send
 * time; `workspace` items reference an existing workspace file and bind/attach instantly.
 */
export interface PendingUpload {
	/** Stable identity for React keys — survives removal of earlier chips. */
	id: number;
	fileName: string;
	/** Workspace-relative path: upload target for local files, existing path for workspace files. */
	path: string;
	/** Present for files selected from the OS; retained for local previews. */
	file?: File;
	source: "local" | "workspace";
	/** Upload lifecycle for local files; workspace items stay "ready". */
	status: "ready" | "uploading" | "failed";
	/** 0-100 upload progress for local files. */
	pct: number;
}

let pendingUploadSeq = 0;

export function localPendingUpload(file: File): PendingUpload {
	return {
		id: ++pendingUploadSeq,
		fileName: file.name,
		path: file.name.replace(/[\\/?%*:|"<>]/g, "_").trim() || `upload-${Date.now()}`,
		file,
		source: "local",
		status: "ready",
		pct: 0,
	};
}

export function workspacePendingUpload(path: string): PendingUpload {
	const name = path.split("/").pop() ?? path;
	return { id: ++pendingUploadSeq, fileName: name, path, source: "workspace", status: "ready", pct: 100 };
}

export function pendingUploadId(): number {
	return ++pendingUploadSeq;
}

/** Flatten a workspace tree into file rows (depth-first, stable order). */
export function flattenWorkspaceFiles(
	node: { type: string; children?: Array<{ name: string; path: string; type: string; children?: unknown[] }> },
	out: Array<{ name: string; path: string }> = [],
	limit = 60,
): Array<{ name: string; path: string }> {
	for (const child of node.children ?? []) {
		if (out.length >= limit) return out;
		if (child.type === "file") out.push({ name: child.name, path: child.path });
		else if (child.type === "directory" && child.children) {
			flattenWorkspaceFiles(child as never, out, limit);
		}
	}
	return out;
}

export type PreparedInlineImage = InlineImage & { name: string; previewUrl: string };

function parseCssPixels(value: string): number {
	const parsed = Number.parseFloat(value);
	return Number.isFinite(parsed) ? parsed : 0;
}

/** Resize using the browser's actual wrapped-text height and keep the caret stable. */
export function resizeComposerTextarea(el: HTMLTextAreaElement): number {
	const styles = window.getComputedStyle(el);
	const fontSize = parseCssPixels(styles.fontSize) || 14;
	const lineHeight = parseCssPixels(styles.lineHeight) || fontSize * 1.25;
	const verticalPadding = parseCssPixels(styles.paddingTop) + parseCssPixels(styles.paddingBottom);
	const verticalBorder = parseCssPixels(styles.borderTopWidth) + parseCssPixels(styles.borderBottomWidth);
	const minHeight = Math.ceil(lineHeight * COMPOSER_MIN_LINES + verticalPadding + verticalBorder);
	const maxHeight = Math.ceil(lineHeight * COMPOSER_MAX_LINES + verticalPadding + verticalBorder);
	const selectionStart = el.selectionStart;
	const selectionEnd = el.selectionEnd;
	const previousHeight = el.style.height;
	const previousOverflowY = el.style.overflowY;

	// Reset before measuring so shrinking after delete/cut/undo is symmetrical
	// with growth. scrollHeight is the browser's actual wrapped-text height.
	el.style.height = "auto";
	const contentHeight = el.scrollHeight + verticalBorder;
	const nextHeight = Math.max(minHeight, Math.min(contentHeight, maxHeight));
	const nextHeightStyle = `${nextHeight}px`;
	const nextOverflowY = contentHeight > maxHeight ? "auto" : "hidden";
	const layoutChanged = previousHeight !== nextHeightStyle || previousOverflowY !== nextOverflowY;
	el.style.height = nextHeightStyle;
	el.style.overflowY = nextOverflowY;
	el.style.overflowX = "hidden";

	// Re-applying the existing selection lets the browser keep the caret in
	// view after the textarea changes between intrinsic and scrollable height.
	if (layoutChanged && document.activeElement === el && selectionStart >= 0 && selectionEnd >= 0) {
		const restoreSelection = () => {
			if (document.activeElement === el) el.setSelectionRange(selectionStart, selectionEnd);
		};
		if (typeof requestAnimationFrame === "function") requestAnimationFrame(restoreSelection);
		else restoreSelection();
	}

	return minHeight;
}

export function isLargeTextPaste(text: string): boolean {
	const lineCount = text.split(/\r\n|\r|\n/).length;
	return lineCount > PASTE_COLLAPSE_LINES || text.length > PASTE_COLLAPSE_CHARS;
}

// Inline chat images are sent to the provider as base64 inside the JSON body.
// Full-resolution photos can exceed reverse-proxy body limits, so large images
// are downscaled before they leave the browser.
const INLINE_IMAGE_MAX_DIMENSION = 1280;
const INLINE_IMAGE_TARGET_BYTES = 380 * 1024;
const INLINE_IMAGE_MAX_BYTES = 500 * 1024;

function rawInlineImage(file: File, dataUrl: string): PreparedInlineImage {
	const commaIdx = dataUrl.indexOf(",");
	const header = dataUrl.slice(0, commaIdx);
	return {
		data: dataUrl.slice(commaIdx + 1),
		mimeType: header.match(/:(.*?);/)?.[1] ?? file.type,
		name: file.name || "image",
		previewUrl: dataUrl,
	};
}

/** Binary size estimate of a base64 data URL payload. */
function dataUrlBytes(dataUrl: string): number {
	return Math.floor((dataUrl.length - dataUrl.indexOf(",") - 1) * 3 / 4);
}

/** Re-encode a decoded image until the payload fits the request budget. */
function downscaleToFit(img: HTMLImageElement): string | undefined {
	const canvas = document.createElement("canvas");
	const ctx = canvas.getContext("2d");
	if (!ctx) return undefined;
	let scale = Math.min(1, INLINE_IMAGE_MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
	let quality = 0.8;
	let best: string | undefined;
	for (let attempt = 0; attempt < 5; attempt++) {
		canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
		canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
		ctx.fillStyle = "#ffffff";
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
		const outUrl = canvas.toDataURL("image/jpeg", quality);
		if (!best || outUrl.length < best.length) best = outUrl;
		if (dataUrlBytes(outUrl) <= INLINE_IMAGE_TARGET_BYTES) break;
		if (quality > 0.5) {
			quality -= 0.15;
		} else {
			scale *= 0.75;
			quality = 0.7;
		}
	}
	return best;
}

export async function prepareInlineImage(file: File): Promise<PreparedInlineImage> {
	const dataUrl = await new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(file);
	});
	const passthrough = () => rawInlineImage(file, dataUrl);
	if (file.size <= INLINE_IMAGE_MAX_BYTES) return passthrough();
	try {
		const img = await new Promise<HTMLImageElement>((resolve, reject) => {
			const el = document.createElement("img");
			el.onload = () => resolve(el);
			el.onerror = () => reject(new Error("image decode failed"));
			el.src = dataUrl;
		});
		const outUrl = downscaleToFit(img);
		if (!outUrl || outUrl.length >= dataUrl.length) return passthrough();
		return {
			data: outUrl.slice(outUrl.indexOf(",") + 1),
			mimeType: "image/jpeg",
			name: file.name || "image",
			previewUrl: outUrl,
		};
	} catch {
		return passthrough();
	}
}

```

### Core Architecture Module: `apps/inno-agent/web/src/react/chat/slash-palette-utils.ts`
```
import type { SlashCommandItem } from "../../api/commands.js";

/**
 * Pure helpers for the composer slash-command palette. Kept free of React so
 * the filtering semantics are unit-testable (mirrors workspace.test.ts style).
 */

export type SlashPaletteAction = "new-chat" | "model" | "profile" | "jobs" | "skills" | "settings";

export interface SlashPaletteEntry {
	key: string;
	/** Text after the leading `/`, e.g. `new` or `skill:ppt-creation`. */
	name: string;
	description?: string;
	group: "app" | "agent";
	/** App actions execute in the UI; agent commands are inserted into the composer. */
	action?: SlashPaletteAction;
}

/** The palette opens only while the draft is a bare `/query` (no whitespace). */
export function slashQueryFromDraft(draft: string): string | null {
	const match = /^\/(\S*)$/.exec(draft);
	return match ? match[1] : null;
}

function matchesQuery(name: string, description: string | undefined, query: string): boolean {
	if (!query) return true;
	const needle = query.toLowerCase();
	return name.toLowerCase().includes(needle) || (description?.toLowerCase().includes(needle) ?? false);
}

/**
 * Build the flat, display-ordered palette entries: app actions first
 * (Codex-style), then agent commands sorted by name within each source group
 * (extension → prompt → skill). Matches against both the command name and
 * its description, so localized queries (e.g. "画像") find English slugs.
 */
export function buildSlashPaletteEntries(
	appActions: Array<{ action: SlashPaletteAction; name: string; description: string }>,
	commands: SlashCommandItem[],
	query: string,
): SlashPaletteEntry[] {
	const entries: SlashPaletteEntry[] = [];
	for (const item of appActions) {
		if (matchesQuery(item.name, item.description, query)) {
			entries.push({ key: `app:${item.action}`, name: item.name, description: item.description, group: "app", action: item.action });
		}
	}
	const sourceOrder: Record<SlashCommandItem["source"], number> = { extension: 0, prompt: 1, skill: 2 };
	const sorted = [...commands].sort((a, b) => sourceOrder[a.source] - sourceOrder[b.source] || a.name.localeCompare(b.name));
	for (const command of sorted) {
		if (matchesQuery(command.name, command.description, query)) {
			entries.push({ key: `agent:${command.name}`, name: command.name, description: command.description, group: "agent" });
		}
	}
	return entries;
}

```

### Core Architecture Module: `apps/inno-agent/web/src/react/chat/smart-input/drag-utils.ts`
```
import type { EngineAttachmentItem } from "./engine.js";

export type DropMatchState = "match" | "mismatch" | "partial";

/** One measurable chunk of visible mirror text/geometry used for hit-testing. */
export interface FlowAtom {
	start: number;
	end: number;
	left: number;
	right: number;
	top: number;
	bottom: number;
}

// Chromium/WebKit renders the native green copy badge around the pointer. Keep
// the app-owned feedback just outside that badge instead of leaving a visible gap.
export const DRAG_FEEDBACK_OFFSET_X = 22;
export const DRAG_FEEDBACK_OFFSET_Y = 8;
export const DRAG_FEEDBACK_RING_SIZE = 20;

/**
 * Resolve a caret offset from the pre-measured flow atoms. The textarea sits
 * above the mirror and makes caretRangeFromPoint unreliable, so line selection
 * and half-atom snapping happen over the mirror's own geometry.
 */
export function offsetAtPointInAtoms(atoms: FlowAtom[], clientX: number, clientY: number): number | null {
	if (atoms.length === 0) return null;
	const lines = new Map<number, FlowAtom[]>();
	for (const atom of atoms) {
		const lineKey = Math.round((atom.top + atom.bottom) / 2);
		const line = lines.get(lineKey) ?? [];
		line.push(atom);
		lines.set(lineKey, line);
	}
	const orderedLines = Array.from(lines.values()).sort((a, b) => (a[0]?.top ?? 0) - (b[0]?.top ?? 0));
	const line = orderedLines.find((candidate) => {
		const top = Math.min(...candidate.map((atom) => atom.top));
		const bottom = Math.max(...candidate.map((atom) => atom.bottom));
		return clientY >= top && clientY <= bottom;
	}) ?? (clientY < (orderedLines[0]?.[0]?.top ?? 0) ? orderedLines[0] : orderedLines[orderedLines.length - 1]);
	if (!line || line.length === 0) return null;
	line.sort((a, b) => a.left - b.left || a.start - b.start);
	if (clientX <= line[0]!.left) return line[0]!.start;
	for (const atom of line) {
		if (clientX <= (atom.left + atom.right) / 2) return atom.start;
		if (clientX <= atom.right) return atom.end;
	}
	return line[line.length - 1]!.end;
}

/**
 * Auto-scroll delta (px per step) while pointer-dragging near the textarea
 * edges; 0 when the pointer is inside the safe band.
 */
export function autoScrollDelta(
	clientY: number,
	rect: { top: number; bottom: number; height: number },
	maxScroll: number,
): number {
	if (maxScroll <= 0 || rect.height <= 0) return 0;
	const edge = Math.min(56, Math.max(28, rect.height * 0.24));
	if (clientY <= rect.top + edge) {
		const distance = rect.top + edge - clientY;
		return -Math.min(24, Math.max(6, distance * 0.65));
	}
	if (clientY >= rect.bottom - edge) {
		const distance = clientY - (rect.bottom - edge);
		return Math.min(24, Math.max(6, distance * 0.65));
	}
	return 0;
}

/** Clamp the drag-following status pill inside the viewport, clear of the native badge. */
export function clampDropStatusPosition(x: number, y: number, width: number, height: number): { left: number; top: number } {
	const left = Math.max(8, Math.min(x + DRAG_FEEDBACK_OFFSET_X, window.innerWidth - width - 8));
	// Center with the 20px dwell ring so a taller status bar is not pushed downward.
	const centeredTop = y + DRAG_FEEDBACK_OFFSET_Y - Math.max(0, (height - DRAG_FEEDBACK_RING_SIZE) / 2);
	const top = Math.max(8, Math.min(centeredTop, window.innerHeight - height - 8));
	return { left, top };
}

export function parseAttachmentTransfer(dataTransfer: DataTransfer | null | undefined): EngineAttachmentItem[] {
	if (!dataTransfer) return [];
	try {
		const raw = dataTransfer.getData("application/x-inno-file");
		if (!raw) return [];
		const parsed = JSON.parse(raw) as {
			name?: unknown;
			path?: unknown;
			source?: unknown;
			items?: unknown;
		};
		const candidates = Array.isArray(parsed.items) ? parsed.items : [parsed];
		return candidates.flatMap((candidate): EngineAttachmentItem[] => {
			if (!candidate || typeof candidate !== "object") return [];
			const item = candidate as { name?: unknown; path?: unknown; source?: unknown };
			if (typeof item.name !== "string" || typeof item.path !== "string") return [];
			if (item.source !== "workspace" && item.source !== "local") return [];
			return [{
				name: item.name,
				path: item.path,
				source: item.source,
			}];
		});
	} catch {
		return [];
	}
}

export function dropMatchState(files: EngineAttachmentItem[], accepts: (name: string) => boolean): DropMatchState {
	const matched = files.reduce((count, file) => count + (accepts(file.name) ? 1 : 0), 0);
	if (matched === 0) return "mismatch";
	if (matched === files.length) return "match";
	return "partial";
}

let hiddenImageEl: HTMLCanvasElement | null = null;

/**
 * Build the shared drag file panel (extension badge + name, multi-file count
 * pill, stacked-sheet shadow). Used by the smart-input live follower and by
 * the native drag-image snapshots so every drag mode looks identical.
 * Pass `snapshot: true` for setDragImage use (parked offscreen).
 */
export function buildDragFilePanel(
	items: ReadonlyArray<{ name: string }>,
	snapshot = false,
): HTMLElement {
	const panel = document.createElement("div");
	panel.className = `inno-drag-follower${items.length > 1 ? " is-multi" : ""}${snapshot ? " is-snapshot" : ""}`;
	panel.setAttribute("aria-hidden", "true");
	if (items.length === 0) return panel;

	const files = document.createElement("div");
	files.className = "inno-drag-follower-files";
	// Multi-file drags collapse to one row (first file + count pill); a
	// stacked list reads as clutter next to the cursor.
	const shown = items.length > 1 ? items.slice(0, 1) : items.slice(0, 3);
	for (const item of shown) {
		const row = document.createElement("div");
		row.className = "inno-drag-follower-file";
		const ext = document.createElement("span");
		ext.className = "inno-drag-follower-ext";
		const dot = item.name.lastIndexOf(".");
		ext.textContent = dot > 0 ? item.name.slice(dot + 1).toUpperCase().slice(0, 4) : "FILE";
		row.appendChild(ext);
		const name = document.createElement("span");
		name.className = "inno-drag-follower-name";
		name.textContent = item.name;
		row.appendChild(name);
		files.appendChild(row);
	}
	if (items.length > 1) {
		const count = document.createElement("span");
		count.className = "inno-drag-follower-count";
		count.textContent = `×${items.length}`;
		files.querySelector(".inno-drag-follower-file")!.appendChild(count);
	} else if (items.length > 3) {
		const more = document.createElement("div");
		more.className = "inno-drag-follower-more";
		more.textContent = `+${items.length - 3}`;
		files.appendChild(more);
	}
	panel.appendChild(files);
	if (snapshot) {
		panel.style.position = "fixed";
		panel.style.top = "-10000px";
		panel.style.left = "-10000px";
		document.body.appendChild(panel);
	}
	return panel;
}

/**
 * 1x1 transparent canvas used as the native drag image when the smart-input
 * engine owns the live drag follower, so only one drag panel is visible.
 */
export function hiddenDragImage(): HTMLCanvasElement {
	if (!hiddenImageEl) {
		hiddenImageEl = document.createElement("canvas");
		hiddenImageEl.width = 1;
		hiddenImageEl.height = 1;
		// Must live in the DOM (offscreen) or Chromium renders the drag image
		// as a visible dot at the cursor.
		hiddenImageEl.style.position = "fixed";
		hiddenImageEl.style.top = "-10000px";
		hiddenImageEl.style.left = "-10000px";
		document.body.appendChild(hiddenImageEl);
	}
	return hiddenImageEl;
}

```

### Core Architecture Module: `apps/inno-agent/web/src/react/chat/smart-input/engine.ts`
```
import type { SmartInputRule } from "../../../types/settings.js";
import type { AttachmentBinding, AttachmentRef } from "../../../types/chat.js";
import type { SlashCommandItem } from "../../../api/commands.js";
import { KIND_COLORS, activeRules, kindFromName, kindFromRule, nameMatchesRule, sameRuleFormat } from "./kinds.js";
import {
	analyzeKeywords,
	agentRule,
	buildOutgoing as buildOutgoingPure,
	normalizeAgentCommand,
	slotChar,
	TOKEN_RE,
	tokenRegexFor,
	type KwRange,
	type OutgoingFile,
} from "./rules.js";
import {
	buildClipboardPayload,
	clipboardFilesFor,
	parseClipboardPayload,
	SMART_BUBBLE_CLIPBOARD_TYPE,
	type SmartBubbleClipboardPayload,
} from "./clipboard.js";
import {
	autoScrollDelta,
	dropMatchState as dropMatchStatePure,
	offsetAtPointInAtoms,
	parseAttachmentTransfer,
	buildDragFilePanel,
	type DropMatchState,
	type FlowAtom,
} from "./drag-utils.js";
import { getOversizedFiles } from "../../../utils/upload-limits.js";

/**
 * SmartInputEngine — imperative port of the v76 prototype's three-layer
 * composer (mirror / textarea / hit layer). React owns the layer elements;
 * this class owns tokens, slots, rendering and the atomic-caret behavior.
 *
 * Layers:
 *   mirror  (bottom) — renders the visible text + red keyword underlines and
 *                      transparent token spans that size the in-text bubbles
 *   textarea (mid)   — transparent text, visible caret; the single source of
 *                      truth for the value
 *   hit     (top)    — absolutely positioned keyword hit-zones and bubble
 *                      chips; bubbles stay aligned to their inline token in
 *                      the mirror and can be reordered within the text flow
 */

export interface BoundFile {
	uid: number;
	name: string;
	/** Upload target / workspace path. */
	path: string;
	source: "workspace" | "upload";
	state: OutgoingFile["state"];
	pct: number;
	/** Present for staged OS files. */
	file?: File;
}

export interface Slot {
	id: number;
	word: string;
	rule: SmartInputRule;
	files: BoundFile[];
	/** File bubbles are the legacy/default kind; Agent bubbles carry commands. */
	bubbleType?: "file" | "agent";
	/** Command without the leading slash, e.g. `recall` or `skill:lesson-plan`. */
	agentCommand?: string;
	/** Last badge count — only re-pop when the number changes. */
	_bc?: number;
	/** Spawned this sync — play the materialize animation once. */
	_spawn?: boolean;
	/** Measured token width from buildToken — avoids a DOM probe per render. */
	_w?: number;
	/** `insertAgentCommandAsBubble` added a command-argument separator space. */
	_agentSpacer?: boolean;
}

export interface EngineAttachmentItem {
	name: string;
	path: string;
	source: "workspace" | "local";
	file?: File;
}

export interface EngineSnapshot {
	slotCount: number;
	boundFileCount: number;
}

export interface EngineCallbacks {
	onChange: () => void;
	onSlotsSnapshot: (snapshot: EngineSnapshot) => void;
	onOpenStatusPanel: (slot: Slot, anchor: HTMLElement) => void;
	onOpenFillMenu: (slot: Slot, anchor: HTMLElement) => void;
	onOpenAgentPicker?: (keyword: KwRange, anchor: HTMLElement) => void;
	onAgentBubbleClick?: (slot: Slot, anchor: HTMLElement) => void;
	onBubbleContextMenu: (event: MouseEvent, slot: Slot, anchor: HTMLElement) => void;
	onBubbleClose?: (slot: Slot, anchor: HTMLElement) => void;
	/** Filled-chip hover — drives the 250ms hover-open of the status panel. */
	onChipHover?: (slot: Slot, anchor: HTMLElement, entering: boolean) => void;
	onUploadLimitExceeded?: (count: number) => void;
	onWorkspaceHighlight: (paths: string[] | null) => void;
}

export interface EngineData {
	getSettings: () => { enabled: boolean; allowDrag: boolean; allowRightClick: boolean; allowAgentCommands: boolean };
	getRules: () => SmartInputRule[];
	takeAttachment: (path: string) => EngineAttachmentItem | undefined;
	returnAttachment: (item: EngineAttachmentItem) => void;
}

export interface EngineLabels {
	[key: string]: string;
}

export interface SmartInputEngineOptions {
	textarea: HTMLTextAreaElement;
	mirror: HTMLElement;
	hitLayer: HTMLElement;
	labels: () => EngineLabels;
	/** Localized human-readable label for a command bubble. */
	agentCommandLabel?: (command: string) => string;
	data: EngineData;
	callbacks: EngineCallbacks;
}

interface TokRect {
	start: number;
	end: number;
	x0: number;
	x1: number;
}

const DWELL_MS = 1000;
const BUBBLE_SEAM_PX = 3;
const DROP_STATUS_FALLBACK_MS = 3000;

export class SmartInputEngine {
	private readonly ta: HTMLTextAreaElement;
	private readonly mirror: HTMLElement;
	private readonly hit: HTMLElement;
	private readonly opts: SmartInputEngineOptions;

	slots: Slot[] = [];
	private nextSlotId = 1;
	private nextFileId = 1;
	private tokRects: TokRect[] = [];
	private renderedKeywords: KwRange[] = [];
	private renderedSlots: Array<{ start: number; end: number; slotId: number }> = [];
	/** Bumped on every mirror rebuild; invalidates drag hit-test caches. */
	private mirrorVersion = 0;
	private lastLayerWidth: number | null = null;
	private flowAtomsCache: { version: number; value: string; atoms: FlowAtom[] } | null = null;
	private lastSelection: { start: number; end: number } | null = null;
	private selectionRenderScheduled = false;
	private syncFrame: number | null = null;
	private detached = false;
	private dwellFollower: HTMLElement | null = null;
	private dwellRaf = 0;
	private dwellStart = 0;
	private dragFollower: HTMLElement | null = null;
	private dragFollowerStatus: HTMLElement | null = null;
	private dropStatusSlotId: number | null = null;
	private dropStatusTimer: number | null = null;
	private dragPos = { x: 0, y: 0 };
	private bubblePointerDrag: {
		slot: Slot;
		pointerId: number;
		startX: number;
		startY: number;
		clientX: number;
		clientY: number;
		moved: boolean;
	} | null = null;
	private bubbleAutoScrollRaf: number | null = null;
	private suppressedBubbleClickSlotId: number | null = null;
	/** Set while an in-page file drag is live (workspace handle / attachment chip). */
	dragMeta: {
		raw: string;
		files: EngineAttachmentItem[];
		consumed?: boolean;
	} | null = null;

	constructor(options: SmartInputEngineOptions) {
		this.opts = options;
		this.ta = options.textarea;
		this.mirror = options.mirror;
		this.hit = options.hitLayer;
	}

	// ── lifecycle ───────────────────────────────────────────────────────────

	attach(): void {
		const ta = this.ta;
		ta.addEventListener("input", this.handleInput);
		ta.addEventListener("beforeinput", this.handleBeforeInput);
		ta.addEventListener("copy", this.handleCopy);
		ta.addEventListener("paste", this.handlePaste);
		ta.addEventListener("keydown", this.handleKeyDown);
		ta.addEventListener("click", this.snapCaretOut);
		ta.addEventListener("select", this.snapCaretOut);
		ta.addEventListener("select", this.handleSelectionChange);
		ta.addEventListener("mousedown", this.handleMouseDown);
		ta.addEventListener("scroll", this.handleScroll);
		document.addEventListener("selectionchange", this.handleDocumentSelectionChange);
		window.addEventListener("resize", this.sync);
		this.sync();
	}

	/**
	 * Flush a pending mirror update immediately after a paste or a programmatic
	 * textarea edit. The visible textarea is transparent while smart input is
	 * enabled, so waiting for a scheduled mirror update would briefly expose an
	 * empty mirror during rapid paste operations.
	 */
	syncNow(): void {
		if (this.detached) return;
		this.cancelPendingSync();
		this.sync();
	}

	/**
	 * Reapply layer geometry after the composer changes the textarea's overflow
	 * mode. A native scrollbar reduces the textarea's usable line width without
	 * changing the smart-input wrapper's width, so the mirror and hit layer must
	 * reserve the same gutter before they measure or paint another line.
	 */
	syncLayout(): void {
		if (this.detached) return;
		this.syncLayerLayout();
	}

	private cancelPendingSync(): void {
		if (this.syncFrame !== null) {
			cancelAnimationFrame(this.syncFrame);
			this.syncFrame = null;
		}
	}

	private scheduleFrameSync(): void {
		if (this.syncFrame !== null) return;
		if (typeof requestAnimationFrame !== "function") {
			this.sync();
			return;
		}
		this.syncFrame = requestAnimationFrame(() => {
			this.syncFrame = null;
			this.sync();
		});
	}

	/**
	 * Rehydrate slots when the composer DOM remounts (welcome ↔ conversation
	 * switch). Tokens in the surviving draft value keep their PUA slot ids, so
	 * the new engine instance adopts the old slot list as-is.
	 */
	adoptSlots(slots: Slot[]): void {
		this.slots = slots;
		this.nextSlotId = slots.reduce((max, slot) => Math.max(max, slot.id + 1), 1);
		this.nextFileId = slots.reduce(
			(max, slot) => slot.files.reduce((inner, file) => Math.max(inner, file.uid + 1), max),
			1,
		);
	}

	detach(): void {
		this.detached = true;
		this.teardown();
		// Settings only affect future input: restore any in-draft bubbles back
		// to their plain words so no PUA glyphs leak into the raw value. Bound
		// files leave the disabled bubble and return to the attachment row.
		this.restoreAllTokens();
		for (const slot of this.slots) this.returnFilesToAttachments(slot);
		this.slots = [];
		this.opts.callbacks.onWorkspaceHighlight(null);
		this.emitSnapshot();
	}

	/**
	 * Tear down for a composer DOM remount (welcome ↔ conversation switch):
	 * listeners and layers go away, but the draft value and slot list survive
	 * so the next engine instance picks up exactly where this one left off.
	 */
	detachForRemount(): void {
		this.detached = true;
		this.teardown();
	}

	private teardown(): void {
		this.cancelPendingSync();
		this.stopDwellFollower();
		this.stopDropStatusFollower();
		this.cancelBubblePointerDrag();
		this.ta.removeEventListener("input", this.handleInput);
		this.ta.removeEventListener("beforeinput", this.handleBeforeInput);
		this.ta.removeEventListener("copy", this.handleCopy);
		this.ta.removeEventListener("paste", this.handlePaste);
		this.ta.removeEventListener("ke
```

### Core Architecture Module: `apps/inno-agent/web/src/react/hooks.ts`
```
import { useEffect, useRef, useState } from "react";

const TITLE_MARQUEE_SPEED_PX_PER_SECOND = 28;
const TITLE_MARQUEE_END_PADDING_PX = 2;

type ChangeStore = {
	on(event: "change", fn: () => void): () => void;
};

/**
 * Shallow equality for store snapshots. Stores emit "change" for any field
 * update, but a component's snapshot often picks fields that didn't change —
 * returning the previous state in that case lets React skip the re-render
 * entirely (this is what keeps high-frequency streaming emits from
 * re-rendering the whole chat view 25 times a second).
 */
function snapshotEqual(a: unknown, b: unknown): boolean {
	if (Object.is(a, b)) return true;
	if (typeof a !== "object" || a === null || typeof b !== "object" || b === null) return false;
	const aRecord = a as Record<string, unknown>;
	const bRecord = b as Record<string, unknown>;
	const aKeys = Object.keys(aRecord);
	if (aKeys.length !== Object.keys(bRecord).length) return false;
	return aKeys.every((key) => Object.is(aRecord[key], bRecord[key]));
}

export function useStoreSnapshot<TStore extends ChangeStore, TSnapshot>(
	store: TStore,
	getSnapshot: () => TSnapshot,
): TSnapshot {
	const getSnapshotRef = useRef(getSnapshot);
	const [snapshot, setSnapshot] = useState(getSnapshot);
	getSnapshotRef.current = getSnapshot;

	useEffect(() => {
		setSnapshot((prev) => {
			const next = getSnapshotRef.current();
			return snapshotEqual(prev, next) ? prev : next;
		});
		return store.on("change", () => {
			setSnapshot((prev) => {
				const next = getSnapshotRef.current();
				return snapshotEqual(prev, next) ? prev : next;
			});
		});
	}, [store]);

	return snapshot;
}

export function useTitleMarquee<T extends HTMLElement>(name: string, hovered: boolean) {
	const titleViewportRef = useRef<T>(null);
	const titleMeasureRef = useRef<HTMLSpanElement>(null);
	const [titleOverflowing, setTitleOverflowing] = useState(false);
	const [titleShift, setTitleShift] = useState(0);

	useEffect(() => {
		const viewport = titleViewportRef.current;
		const measure = titleMeasureRef.current;
		if (!viewport || !measure) return;
		const updateTitleOverflow = () => {
			const shift = Math.max(0, measure.getBoundingClientRect().width - viewport.clientWidth);
			setTitleOverflowing(shift > 2);
			setTitleShift(Math.ceil(shift));
		};
		updateTitleOverflow();
		if (typeof ResizeObserver === "undefined") return;
		const observer = new ResizeObserver(updateTitleOverflow);
		observer.observe(viewport);
		observer.observe(measure);
		return () => observer.disconnect();
	}, [name]);

	const marqueeShift = titleShift + TITLE_MARQUEE_END_PADDING_PX;
	return {
		titleViewportRef,
		titleMeasureRef,
		titleOverflowing,
		marqueeActive: titleOverflowing && hovered,
		marqueeShift,
		titleMarqueeDuration: Math.max(0.05, marqueeShift / TITLE_MARQUEE_SPEED_PX_PER_SECOND),
	};
}

```

### Core Architecture Module: `apps/inno-agent/web/src/react/markdown/ArtifactRenderers.tsx`
```
import {
	AlertTriangle,
	Check,
	Code2,
	Columns2,
	Copy,
	Download,
	Eye,
	Maximize2,
	MoreHorizontal,
	Pencil,
	Play,
	RotateCcw,
	Save,
	WrapText,
	ZoomIn,
	ZoomOut,
} from "lucide-react";
import plantumlEncoder from "plantuml-encoder";
import {
	Fragment,
	type CSSProperties,
	type PointerEvent as ReactPointerEvent,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import { StreamdownContext, type CustomRendererProps } from "streamdown";
import {
	downloadBlob,
	MarkdownFullscreenDialog,
	MarkdownToolbar,
	MarkdownToolbarDivider,
	MarkdownToolbarGroup,
	ToolbarIconButton,
	ToolbarMenu,
	ToolbarMenuItem,
	ToolbarSegmentedButton,
	markdownControlEnabled,
	markdownMaxHeight,
	markdownToolbarEnabled,
} from "./shared.js";

type ArtifactViewMode = "preview" | "source" | "split";

const RESTRICTED_PREVIEW_CSP = [
	"default-src 'none'",
	"img-src data: blob:",
	"media-src data: blob:",
	"style-src 'unsafe-inline'",
	"font-src data:",
	"form-action 'none'",
	"base-uri 'none'",
].join("; ");
const INTERACTIVE_PREVIEW_CSP = [
	RESTRICTED_PREVIEW_CSP,
	"script-src 'unsafe-inline'",
	"connect-src 'none'",
	"frame-src 'none'",
	"worker-src 'none'",
].join("; ");

function htmlRequiresInteraction(html: string): boolean {
	return /<(?:script|iframe|object|embed)\b|\son[a-z]+\s*=|javascript\s*:/i.test(html);
}

function stripMetaRefresh(html: string): string {
	return html.replace(/<meta\b(?=[^>]*\bhttp-equiv\s*=\s*["']?refresh\b)[^>]*>/gi, "");
}

const SVG_ALLOWED_ELEMENTS = new Set([
	"svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon",
	"text", "tspan", "title", "desc", "defs", "symbol", "use", "image", "marker",
	"lineargradient", "radialgradient", "stop", "clippath", "mask", "pattern", "style",
	"filter", "fegaussianblur", "feoffset", "femerge", "femergenode", "fecolormatrix",
]);
const SVG_ALLOWED_ATTRIBUTES = new Set([
	"xmlns", "viewbox", "preserveaspectratio", "width", "height", "x", "y", "x1", "x2", "y1", "y2",
	"cx", "cy", "r", "rx", "ry", "d", "dx", "dy", "points", "pathlength", "transform",
	"fill", "fill-opacity", "fill-rule", "stroke", "stroke-width", "stroke-opacity", "stroke-linecap",
	"stroke-linejoin", "stroke-dasharray", "stroke-dashoffset", "opacity", "color", "offset",
	"stop-color", "stop-opacity", "font-family", "font-size", "font-style", "font-weight", "text-anchor",
	"dominant-baseline", "alignment-baseline", "baseline-shift", "letter-spacing", "word-spacing",
	"clip-path", "clip-rule", "mask", "filter", "marker-start", "marker-mid", "marker-end",
	"id", "class", "style", "href", "xlink:href", "role", "aria-label", "aria-hidden",
]);

function sanitizeSvgMarkup(source: string): string | null {
	if (typeof DOMParser === "undefined" || typeof XMLSerializer === "undefined") return null;
	const documentNode = new DOMParser().parseFromString(source, "image/svg+xml");
	const root = documentNode.documentElement;
	if (root.localName.toLowerCase() !== "svg" || documentNode.querySelector("parsererror")) {
		return null;
	}

	for (const element of Array.from(root.querySelectorAll("*"))) {
		const tag = element.localName.toLowerCase();
		if (!SVG_ALLOWED_ELEMENTS.has(tag)) {
			element.remove();
			continue;
		}
		if (tag === "style") {
			const css = element.textContent ?? "";
			if (/@import|expression\s*\(|javascript\s*:|url\s*\(\s*(?!['"]?#)/i.test(css)) element.remove();
			continue;
		}
		for (const attribute of Array.from(element.attributes)) {
			const name = attribute.name.toLowerCase();
			const value = attribute.value.trim();
			if (!SVG_ALLOWED_ATTRIBUTES.has(name) || name.startsWith("on")) {
				element.removeAttribute(attribute.name);
				continue;
			}
			if ((name === "href" || name === "xlink:href") && !/^#[-\w:.]+$/.test(value) && !/^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(value)) {
				element.removeAttribute(attribute.name);
				continue;
			}
			if (/^(?:fill|stroke|filter|clip-path|mask|marker-start|marker-mid|marker-end)$/.test(name) && /url\s*\(/i.test(value) && !/^url\(\s*['"]?#[-\w:.]+['"]?\s*\)$/i.test(value)) {
				element.removeAttribute(attribute.name);
				continue;
			}
			if (name === "style" && /@import|expression\s*\(|javascript\s*:|url\s*\(\s*(?!['"]?#)/i.test(value)) element.removeAttribute(attribute.name);
		}
	}
	for (const attribute of Array.from(root.attributes)) {
		if (!SVG_ALLOWED_ATTRIBUTES.has(attribute.name.toLowerCase()) || attribute.name.toLowerCase().startsWith("on")) root.removeAttribute(attribute.name);
	}
	return new XMLSerializer().serializeToString(root);
}

function injectRestrictedHead(html: string, csp = RESTRICTED_PREVIEW_CSP): string {
	const safeHtml = stripMetaRefresh(html);
	const meta = `<meta http-equiv="Content-Security-Policy" content="${csp}">`;
	if (/<head(?:\s[^>]*)?>/i.test(safeHtml)) {
		return safeHtml.replace(/<head(?:\s[^>]*)?>/i, (head) => `${head}${meta}`);
	}
	if (/<html(?:\s[^>]*)?>/i.test(safeHtml)) {
		return safeHtml.replace(/<html(?:\s[^>]*)?>/i, (htmlTag) => `${htmlTag}<head>${meta}</head>`);
	}
	return `<head>${meta}</head>${safeHtml}`;
}

function safeFilename(value: string): string {
	const normalized = value.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").replace(/\s+/g, "-");
	return normalized.slice(0, 80) || "inno-artifact";
}

function extractHtmlTitle(html: string): string {
	const title = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]
		?.replace(/<[^>]+>/g, "")
		.trim();
	return title || "";
}

function ArtifactSource({
	source,
	editing,
	wrapped,
	onChange,
}: {
	source: string;
	editing: boolean;
	wrapped: boolean;
	onChange: (value: string) => void;
}) {
	if (editing) {
		return (
			<textarea
				value={source}
				onChange={(event) => onChange(event.target.value)}
				spellCheck={false}
				className="inno-markdown-artifact-editor"
			/>
		);
	}

	return (
		<pre className={`inno-markdown-artifact-source ${wrapped ? "is-wrapped" : ""}`}>
			<code>{source}</code>
		</pre>
	);
}

interface ArtifactShellProps extends CustomRendererProps {
	title: string;
	extension: string;
	mimeType?: string;
	renderPreview: (source: string, isFullscreen: boolean) => ReactNode;
	renderToolbarAction?: (source: string) => ReactNode;
}

interface ArtifactToolbarProps {
	displayMode: ArtifactViewMode;
	canPreview: boolean;
	isIncomplete: boolean;
	editing: boolean;
	wrapped: boolean;
	copied: boolean;
	copyEnabled: boolean;
	downloadEnabled: boolean;
	fullscreenEnabled: boolean;
	moreOpen: boolean;
	moreId: string;
	hasEditedSource: boolean;
	onPreview: () => void;
	onSource: () => void;
	onSplit: () => void;
	onToggleMore: () => void;
	onCloseMore: () => void;
	onWrap: () => void;
	onApply: () => void;
	onEdit: () => void;
	onRestore: () => void;
	onCopy: () => void | Promise<void>;
	onDownload: () => void;
	onFullscreen: () => void;
	toolbarAction?: ReactNode;
}

function ArtifactToolbar({
	displayMode,
	canPreview,
	isIncomplete,
	editing,
	wrapped,
	copied,
	copyEnabled,
	downloadEnabled,
	fullscreenEnabled,
	moreOpen,
	moreId,
	hasEditedSource,
	onPreview,
	onSource,
	onSplit,
	onToggleMore,
	onCloseMore,
	onWrap,
	onApply,
	onEdit,
	onRestore,
	onCopy,
	onDownload,
	onFullscreen,
	toolbarAction,
}: ArtifactToolbarProps) {
	const { t } = useTranslation();
	return (
		<MarkdownToolbar label={t("markdown.artifactTools", "Artifact 工具")}>
			<div className="inno-markdown-toolbar-group inno-markdown-toolbar-group--modes" role="tablist" aria-label={t("markdown.artifactView", "Artifact 视图")}>
				<ToolbarSegmentedButton label={t("markdown.preview", "预览")} showLabel selected={displayMode === "preview"} disabled={!canPreview} onClick={onPreview}><Eye size={14} /></ToolbarSegmentedButton>
				<ToolbarSegmentedButton label={t("markdown.viewSource", "查看源码")} showLabel selected={displayMode === "source"} onClick={onSource}><Code2 size={14} /></ToolbarSegmentedButton>
			</div>
			{copyEnabled ? (
				<ToolbarIconButton label={copied ? t("markdown.copied", "已复制") : t("markdown.copySource", "复制源码")} showLabel onClick={onCopy}>
					{copied ? <Check size={14} /> : <Copy size={14} />}
				</ToolbarIconButton>
			) : null}
			{toolbarAction}
			<div className="inno-markdown-toolbar-menu-anchor">
				<ToolbarIconButton label={t("markdown.moreTools", "更多")} showLabel menu expanded={moreOpen} aria-controls={moreId} onClick={onToggleMore}>
					<MoreHorizontal size={14} />
				</ToolbarIconButton>
				<ToolbarMenu id={moreId} open={moreOpen} onClose={onCloseMore} label={t("markdown.moreTools", "更多")}>
					<ToolbarMenuItem label={t("markdown.splitView", "分屏查看")} disabled={!canPreview} onClick={onSplit}><Columns2 size={14} /></ToolbarMenuItem>
					<ToolbarMenuItem label={wrapped ? t("markdown.disableWrapText", "取消自动换行") : t("markdown.wrapText", "自动换行")} onClick={onWrap}><WrapText size={14} /></ToolbarMenuItem>
					{editing ? (
						<ToolbarMenuItem label={t("markdown.applyChanges", "应用更改")} onClick={onApply}><Save size={14} /></ToolbarMenuItem>
					) : (
						<ToolbarMenuItem label={t("markdown.editCopy", "编辑副本")} disabled={isIncomplete} onClick={onEdit}><Pencil size={14} /></ToolbarMenuItem>
					)}
					{hasEditedSource ? <ToolbarMenuItem label={t("markdown.restoreOriginal", "恢复模型原文")} onClick={onRestore}><RotateCcw size={14} /></ToolbarMenuItem> : null}
					{downloadEnabled ? <ToolbarMenuItem label={t("markdown.downloadSource", "下载源码")} onClick={onDownload}><Download size={14} /></ToolbarMenuItem> : null}
					{fullscreenEnabled ? <ToolbarMenuItem label={t("markdown.fullscreen", "全屏查看")} disabled={!canPreview} onClick={onFullscreen}><Maximize2 size={14} /></ToolbarMenuItem> : null}
				</ToolbarMenu>
			</div>
		</MarkdownToolbar>
	);
}

function ArtifactShell({ code, language, isIncomplete, title, extension, mimeType, renderPreview, renderToolbarAction }: ArtifactShellProps) {
	const { t } = useTranslation();
	const streamdownContext = useContext(StreamdownContext);
	const toolbarEnabl
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #243** (2026-10-01): **chore(deps): upgrade PI SDK 0.84.2 → 0.99.2**
  *Symptoms*: ## Summary  Upgrades the PI SDK base from 0.84.2 to 0.99.2 (upstream skipped 0.88–0.98), plus the plugin ecosystem:  - `@earendil-works/pi-ai` / `pi-coding-agent` → ^0.99.2 - `pi-subagents` → ^0.74.0, `pi-web-access` → ^0.35.0 - `@gotgenes/pi-permission-system` → ^36.2.0 (config schema unchanged; breaking entries are all bash rule-evaluation refinements) - `@juicesharp/rpiv-todo` / `rpiv-ask-user-question` → ^2.12.0 - `pi-mcp-adapter` → 4.0.0 (first version explicitly supporting pi 0.99) - `pi-sandbox` stays pinned at 0.4.3 — upstream 0.6.8 still peers `^0.80.0`, so the lockfile keeps tolerating the known peer conflict (verified working against 0.99.2 via the jiti alias in `--sandbox` mode)  ## Code changes  1. **`agent.state.messages` → `session.refreshContext()`** (pi-runner, 2 sites). pi ≥0.87 made `SessionManager` canonical for provider context; assigning `agent.state.messages` is silently inert now. Both sites (failed-prompt restore, user-message edit branch) navigate the session tree and then rebuild context. 2. **`Context` → `TranscriptContext` in the teaching-entry-agent test mock.** pi ≥0.86 folds the system prompt and tool declarations into a leading system message; provider streams receive a branded `TranscriptContext`. The faux provider assertions now use `getCurrentSystemPrompt()` / `getCurrentTools()` from the pi-ai root entry. Inno's own provider registration is declarative (baseUrl/api/models) and unaffected. 3. **Managed MCP config renamed `mcp.json` → `mcp-a

- **Issue #242** (2026-09-19): **fix(docker): copy vendor/ before npm ci in production build**
  *Symptoms*: ## Summary - Dockerfile's build stage copies package manifests and runs `npm ci` before `vendor/` (holding the vendored `xlsx-0.20.3.tgz` both package.json files reference via `file:`) is ever copied in — `docker compose build` fails on a clean checkout with ENOENT on the tarball. - Adds `COPY vendor/ vendor/` right after the manifest COPYs, before `npm ci`.  ## Test plan - [x] `docker compose build --no-cache` completes - [x] `docker compose up -d` → `/health` returns `{"status":"ok"}` - [x] `bash restart-dev.sh smoke` passes (health, workspaces list, session+terminal create, WS upgrade)
  **Post-Mortem & Fix Analysis**:
  > Closing as a duplicate of #240, which was merged as 5d3ae27 — same fix (COPY vendor/ before npm ci), same Dockerfile change. Thanks for the PR; the fix is already in main.

- **Issue #240** (2026-09-19): **fix(docker): copy vendor/ before npm ci in production build**
  *Symptoms*: Both apps/inno-agent/package.json and apps/inno-agent/web/package.json depend on xlsx via a file: reference to vendor/xlsx-0.20.3.tgz. The Dockerfile build stage never copied vendor/ into the build context, so `docker compose build` failed on a clean checkout with ENOENT on the tarball before npm ci could even run.

- **Issue #239** (2026-09-18): **feat: add session workspace switching with file migration**
  *Symptoms*: ## 概述  为会话增加工作区切换能力。用户可以在已有对话的标题栏选择另一个工作区，先查看该会话曾经访问过的文件，再逐文件决定复制、移动或不处理，最后完成会话绑定切换。  本 PR 包含以下两个已提交的改动：  - `26192d5 feat: add session workspace switching` - `24b6356 fix: harden session workspace activity tracking`  ## 主要改动  <img width="1200" height="800" alt="Screenshot 2026-09-18 at 00-50-19" src="https://github.com/user-attachments/assets/002ec59b-40ee-4df1-b97c-1311b7a5571a" />  ### 后端  - 新增 `workspace-activity-store` 会话工作区活动旁车数据：   - 将会话、工作区、相对路径、访问类型（读取/写入/读写）及首次/最近访问时间持久化到 `sessions/workspace-activity.json`。   - 只保存元数据，不保存文件内容、工具输出或 prompt 文本。   - 合并同一路径的多次访问，并正确合并为 `read_write`。   - 对绝对路径、越界路径、路径穿越、URL、符号链接、忽略目录等输入进行过滤。   - 会话删除时同步清理活动元数据。  - 新增 `workspace-switch` 切换与文件迁移服务：   - 生成源工作区到目标工作区的切换预览，只展示源工作区中仍存在且可安全处理的普通文件。   - 支持 `move`、`copy`、`none` 三种文件级操作。   - 使用排他复制，目标文件已存在时返回冲突，不覆盖目标文件。   - 拒绝符号链接、非普通文件、不安全目标路径和不可创建的目标目录。   - 每个文件返回 `moved`、`copied`、`conflict`、`missing` 或 `failed` 状态，并汇总成功、冲突、失败、缺失和已选择数量。  - 新增会话工作区切换接口：   - `GET /api/sessions/:id/workspace/switch-preview?targetWorkspaceId=...`   - `POST /api/sessions/:id/workspace/switch`   - 切换前校验会话、目标工作区和当前活动对话状态。   - 对当前正在使用的会话，在迁移文件前先原子更新工作区绑定并刷新 agent cwd；cwd 更新失败时恢复旧绑定。   - 保留会话历史和记忆，不迁移 session 文件或记忆数据。   - channel 专属工作区不允许作为对话切换目标。  - 加固工作区活动追踪：   - 在非流式、流式和 session prompt 入口统一观察工具执行事件，补齐不同 prompt 入口产生的读写记录。   - 记录图片写入、结构化附件访问及工具参数中明确声明的文件路径。   - 对 workspace change 事件记录写入路径；事件被截断或工具路径无法可靠分类时标记 `trackingIncomplete`，避免把不完整统计伪装成完整结果。   - 兼容旧的 trace/attachment 旁车数据：旧数据可

- **Issue #238** (2026-09-17): **feat: desktop computer use via @injaneity/pi-computer-use**
  *Symptoms*: ## What  Bundles [`@injaneity/pi-computer-use`](https://github.com/injaneity/pi-computer-use) so the **desktop app** can observe and control the local screen: accessibility-tree-first observation (`find_roots` / `observe_ui` / `search_ui` / `expand_ui` / `inspect_ui` / `read_text` / `wait_for`) plus side-effecting actions (`act_ui`, `launch_browser` / `navigate_browser` / `evaluate_browser`). Chosen over screenshot-coordinate alternatives because it supports macOS + Windows, works without a vision-capable model, and has zero runtime dependencies.  ## Gating — desktop only by default  - `electron/main.js` now sets `INNO_DESKTOP=1` for the spawned backend; `isComputerUseEnabled` (in `config.ts`, shared by the extension and the settings route) resolves: explicit `plugins.computerUse.enabled` wins in both directions → unset means on only under `INNO_DESKTOP=1`. **Online/server deployments stay off by default.** - TS-only plugin source is jiti-loaded like the other bundled plugins; it imports only pi-coding-agent + typebox, so no pi-ai alias is needed. - New `PUT /api/settings/computer-use` toggle + a switch in **Settings → General** (zh/en). Tool registration happens at session init, so the change applies on restart — the UI says so. - `GET /api/settings` exposes the effective state as `computerUse: { enabled, explicit, isDesktop }`.  ## Safety  - Managed permission policy now `ask`s on the four side-effecting tools (approval card per click/keystroke/browser action); passive obse

- **Issue #237** (2026-09-16): **fix: address PR #236 review follow-ups**
  *Symptoms*: ## Summary  Follow-ups from the post-merge review of #236 (https://github.com/hhyqhh/inno-agent/pull/236#issuecomment-5681542584):  - **checkins**: return an idempotent `200 {skipped: true, alreadySkipped: true}` on a *repeated skip* — the retry a lost skip response actually lands on (`POST /api/checkins/skip`), where a bare 409 would be misread as "auto-execution won the race". Also correct the misplaced comment on the claim route to describe the race it really covers (countdown takeover vs. a completed skip). - **server**: extract the uploaded-images prefix pattern into `src/server/upload-prefix.ts` as the single source of truth shared by `chat.ts` (builder) and `server.ts` (title stripper); the web client's mirrored regex in `ChatConversation.tsx` gets a cross-referencing comment (it cannot import server code). - **web**: scope job-stream settle/discard clearing of `pendingQuestion`/`pendingPermission` to the job run's session — the fields are shared with normal chat turns, so the unconditional clear could clobber a chat turn's card if that invariant ever broke. - **tests**: backend coverage for the previously untested #236 paths — check-ins skip/claim idempotency (4), `withRecordedTopic` `topicPendingUpgrade` transitions (5), and the upload-prefix stripper (2).  ## Verification  - `npm test`: 90 files / 703 tests pass (CLAUDE.md counts updated). - `npm run build` passes (backend + web). - Live end-to-end against the dev server: armed a real deferred slot, skipped it insid

- **Issue #236** (2026-09-15): **fix: stabilize chat sessions and scheduled runs**
  *Symptoms*: ## Summary  - 修复签到执行与跳过的竞态，避免重复提示或重复处理。 - 修复定时任务流在聊天页面中的可见性与会话切换行为。 - 增加会话首条消息标题预览，并修复预览标题升级后的侧边栏刷新。 - 提升上下文用量在会话切换、缓存和激活期间的稳定性。 - 更新 `CLAUDE.md` 的测试统计，并清理重复的上下文百分比格式化代码。  ## Verification  - `npm test`：87 个测试文件、692 个测试全部通过。 - `npm run build --workspace inno-agent` 通过。 - `npm run build --workspace inno-agent-web` 通过。
  **Post-Mortem & Fix Analysis**:
  > Post-merge review notes (verified locally on the merged head: 87 test files / 692 tests pass, backend + web builds pass). The changes are solid overall — these are follow-ups, not blockers, and I'll address them in a small fix PR.  **1. `alreadySkipped` idempotency sits on the wrong route (minor).** The comment in `server/routes/checkins.ts` describes "the response to an earlier skip can be lost… treat a repeated request for that same slot as success" — but a lost skip response is retried against `POST /api/checkins/skip`, which still returns a bare 409 (`checkins.ts:74`). The 200 `alreadySkipped` branch was added to the **claim** route instead. It's harmless today (the skip-route 409 is already treated as settled client-side, and a claim-after-skip is safely neutralized by `isSlotSettled` + `resolveOccurrence` + `discardJobStream`), but the handling and the comment should move to — or be duplicated on — the skip route.  **2. No backend test coverage for the two server-side changes.** 

- **Issue #235** (2026-09-14): **feat: read-only session context usage API and localized composer control**
  *Symptoms*: ## What  Adds a **context usage indicator** to the chat composer, showing how much of the model's context window the current session has consumed.  ## Changes  ### Backend - `src/shared/context-usage.ts` — shared types for the context usage payload. - `src/agent/context-usage.ts` — computes token usage vs. the active model's `contextWindow` from PI session state (with unit tests). - `src/server/routes/sessions.ts` — new **read-only** endpoint `GET /api/sessions/:id/context-usage` (with route tests).  ### Web UI - `web/src/api/sessions.ts` — client for the new endpoint. - `web/src/react/chat/useContextUsage.ts` — hook that fetches and refreshes usage for the active session. - `web/src/react/chat/ContextUsage.tsx` + `context-usage.css` — composer control rendering the usage readout. - Wired into `ChatCenter.tsx` / `ChatComposer.tsx`. - Fully localized (zh-CN + en), with component tests.  ### Docs - `docs/features/context-usage.md` — feature notes.  592 insertions across 15 files; no changes to existing behavior beyond the new endpoint and composer control.

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

### Incident Patch 1: `5d3ae278` (2026-09-19)
**Commit Message**: fix(docker): copy vendor/ before npm ci in production build (#240)

Both apps/inno-agent/package.json and apps/inno-agent/web/package.json
depend on xlsx via a file: reference to vendor/xlsx-0.20.3.tgz. The
Dockerfile build stage never copied vendor/ into the build context, so
`docker compose build` failed on a clean checkout with ENOENT on the
tarball before npm ci could even run.

Co-authored-by: Claude Sonnet 5 <[REDACTED_EMAIL]>

**File**: `Dockerfile` (modified, +3/-0)
```diff
@@ -12,6 +12,9 @@ RUN sed -i 's|http://deb.debian.org/debian|http://mirrors.tuna.tsinghua.edu.cn/d
 COPY package.json package-lock.json tsconfig.base.json ./
 COPY apps/inno-agent/package.json apps/inno-agent/tsconfig.json apps/inno-agent/
 COPY apps/inno-agent/web/package.json apps/inno-agent/web/tsconfig.json apps/inno-agent/web/
+# Vendored xlsx tarball — both package.json files pull it in via a `file:` dependency,
+# so it must exist before npm ci runs.
+COPY vendor/ vendor/
 
 RUN npm config set registry https://registry.npmmirror.com && npm ci
 
```

---

### Incident Patch 2: `24b6356c` (2026-09-17)
**Commit Message**: fix: harden session workspace activity tracking

**File**: `apps/inno-agent/src/agent/pi-runner.ts` (modified, +25/-0)
```diff
@@ -35,6 +35,8 @@ let _currentCwd = "";
 let _configHolder: ConfigHolder | null = null;
 let _cwdResolver: ((sessionPath: string) => string | null) | null = null;
 let _activePromptToken: string | null = null;
+/** Server-side observer for metadata that must cover every prompt entrypoint. */
+let _promptEventObserver: ((event: AgentSessionEvent, sessionPath: string | null) => void) | null = null;
 /** Provider IDs registered into the active model registry by Inno's config. */
 const _registeredProviderIds = new Set<string>();
 
@@ -59,6 +61,26 @@ export function setWorkspaceCwdResolver(fn: ((sessionPath: string) => string | n
 	_cwdResolver = fn;
 }
 
+/**
+ * Observe raw agent events without changing prompt output or stream delivery.
+ * The server uses this for workspace activity metadata so channel, scheduler,
+ * and non-streaming prompts are tracked alongside web streams.
+ */
+export function setPromptEventObserver(
+	observer: ((event: AgentSessionEvent, sessionPath: string | null) => void) | null,
+): void {
+	_promptEventObserver = observer;
+}
+
+function notifyPromptEvent(event: AgentSessionEvent): void {
+	if (!_promptEventObserver) return;
+	try {
+		_promptEventObserver(event, _runtime?.session.sessionFile ?? null);
+	} catch (err) {
+		logger.warn({ err, eventType: event.type }, "prompt event observer failed");
+	}
+}
+
 function resolveCwdFor(sessionPath: string | null | undefined): string {
 	if (!sessionPath) return _workspaceDir;
 	if (_cwdResolver) {
@@ -1248,6 +1270,7 @@ export async function runPrompt(
 	const obsUnsub = session.subscribe(promptObserver);
 
 	const unsubscribe = session.subscribe((event) => {
+		notifyPromptEvent(event);
 		if (event.type === "message_update") {
 			const ev = event.assistantMessageEvent;
 			if (ev.type === "text_delta") {
@@ -1543,6 +1566,7 @@ export function runPromptStreaming(
 		const obsUnsub = session.subscribe(promptObserver);
 
 		const unsubscribe = session.subscribe((event) => {
+			notifyPromptEvent(event);
 			if (
 				!retryingWithoutNativeImages &&
 				isNativeImagePayloadError(eventErrorMessage(event))
@@ -1658,6 +1682,7 @@ export function runPromptStreamingInSession(
 				const promptObserver = createPromptObserver({ promptStartTime });
 				const obsUnsub = session.subscribe(promptObserver);
 				const unsubscribe = session.subscribe((event) => {
+					notifyPromptEvent(event);
 					if (
 						!retryingWithoutNativeImages &&
 						isNativeImagePayloadError(eventErrorMessage(event))
```

**File**: `apps/inno-agent/src/server.ts` (modified, +21/-0)
```diff
@@ -22,6 +22,7 @@ import {
 	initSession,
 	isQueueTaskCancelled,
 	reloadResources,
+	setPromptEventObserver,
 	setWorkspaceCwdResolver,
 } from "./agent/pi-runner.js";
 import { completePromptOnce, runPromptSerialized, runPromptStreamingInSession, runPromptInSession, abortPromptForTurnToken, abortJobPromptInSession } from "./agent/pi-runner.js";
@@ -58,6 +59,7 @@ import { handleChatRoutes } from "./server/routes/chat.js";
 import { handleCommandsRoutes } from "./server/routes/commands.js";
 import { handleBtwRoutes } from "./server/routes/btw.js";
 import { mergeSessionAgentCommands } from "./server/agent-command-store.js";
+import { recordToolWorkspaceActivity } from "./server/workspace-activity-store.js";
 import { stripUploadedImagesPrefix } from "./server/upload-prefix.js";
 import {
 	mergeChannels,
@@ -222,6 +224,25 @@ async function ensureBootstrapped(): Promise<void> {
 			const workspaceId = workspaceRegistry.getSessionWorkspaceId(id);
 			return workspaceRegistry.resolveWorkspaceDir(workspaceId);
 		});
+		setPromptEventObserver((event, sessionPath) => {
+			if (event.type !== "tool_execution_start" && event.type !== "tool_execution_update") return;
+			// Progress events normally omit args; the start event is the source of
+			// truth in that case, so do not turn a harmless update into an
+			// incomplete-tracking warning.
+			if (event.type === "tool_execution_update" && event.args === undefined) return;
+			const sessionId = sessionPath ? basename(sessionPath) : getCurrentSessionId();
+			if (!sessionId) return;
+			const workspaceId = workspaceRegistry.getSessionWorkspaceId(sessionId);
+			const workspaceRoot = workspaceRegistry.resolveWorkspaceDir(workspaceId);
+			if (!workspaceRoot) return;
+			recordToolWorkspaceActivity(dataDir, {
+				sessionId,
+				workspaceId,
+				workspaceRoot,
+				toolName: event.toolName,
+				args: event.args,
+			});
+		});
 
 		migrateLegacyPiSkills();
 
```

**File**: `apps/inno-agent/src/server/attachments-store.ts` (modified, +2/-0)
```diff
@@ -17,6 +17,8 @@ export interface SessionAttachmentEntry {
 	promptContent: string;
 	attachments: ChatAttachments;
 	timestamp: number;
+	/** Workspace that contained the attached files when the turn was accepted. */
+	workspaceId?: string;
 }
 
 export type SessionAttachmentsMetadata = Record<string, SessionAttachmentEntry[]>;
```

**File**: `apps/inno-agent/src/server/routes/chat.ts` (modified, +13/-31)
```diff
@@ -36,7 +36,6 @@ import { recordSessionAgentCommand } from "../agent-command-store.js";
 import { recordSessionTrace } from "../trace-store.js";
 import {
 	markWorkspaceTrackingIncomplete,
-	recordToolWorkspaceActivity,
 	recordWorkspaceAttachmentActivity,
 	recordWorkspaceFileAccess,
 } from "../workspace-activity-store.js";
@@ -546,6 +545,7 @@ export async function handleChatRoutes(
 				promptContent: prompt,
 				attachments,
 				timestamp: Date.now(),
+				workspaceId: imageWorkspaceId,
 			});
 			recordWorkspaceAttachmentActivity(dataDir, {
 				sessionId: imageSessionId,
@@ -804,6 +804,7 @@ export async function handleChatRoutes(
 				promptContent: prompt,
 				attachments: streamAttachments,
 				timestamp: Date.now(),
+				workspaceId: streamWorkspaceId,
 			});
 			recordWorkspaceAttachmentActivity(dataDir, {
 				sessionId: requestedSessionId,
@@ -885,37 +886,17 @@ export async function handleChatRoutes(
 					}
 					break;
 				}
-					case "tool_execution_start":
-						recordToolWorkspaceActivity(dataDir, {
-						sessionId: state.sessionId,
-						workspaceId: state.workspaceId,
-						workspaceRoot: state.workspaceRoot,
-						toolName: event.toolName,
-							args: event.args,
-						});
-						logger.info(
-							{ toolName: event.toolName, toolCallId: event.toolCallId },
-							"tool call started: %s", event.toolName,
-						);
-						break;
-					case "tool_execution_update":
-					recordToolWorkspaceActivity(dataDir, {
-						sessionId: state.sessionId,
-						workspaceId: state.workspaceId,
-						workspaceRoot: state.workspaceRoot,
-						toolName: event.toolName,
-							args: event.args,
-						});
-						// Partial tool output is forwarded to the stream registry below.
-						// Do not report these normal progress events as unhandled.
-						break;
+				case "tool_execution_start":
+					logger.info(
+						{ toolName: event.toolName, toolCallId: event.toolCallId },
+						"tool call started: %s", event.toolName,
+					);
+					break;
+				case "tool_execution_update":
+					// Partial tool output is forwarded to the stream registry below.
+					// Do not report these normal progress events as unhandled.
+					break;
 				case "tool_execution_end":
-					recordToolWorkspaceActivity(dataDir, {
-						sessionId: state.sessionId,
-						workspaceId: state.workspaceId,
-						workspaceRoot: state.workspaceRoot,
-						toolName: event.toolName,
-					});
 					workspaceChangeMonitor?.noteToolEnd(event.toolCallId, event.toolName);
 					if (event.isError) {
 						const errText = Array.isArray(event.result?.content)
@@ -1047,6 +1028,7 @@ export async function handleChatRoutes(
 								assistantMessageId: assistantMessage?.role === "assistant" ? assistantMessage.entryId : undefined,
 								startedAt: state.startedAt,
 								finishedAt: state.finishedAt ?? new Date().toISOString(),
+								workspaceId: state.workspaceId,
 								events: state.history,
 							});
 						} catch (err) {
```

**File**: `apps/inno-agent/src/server/trace-store.test.ts` (modified, +12/-0)
```diff
@@ -76,6 +76,18 @@ describe("session UI trace sidecar", () => {
 		expect(mergeSessionTraces(dataDir, "session-1", messages)).toEqual(messages);
 	});
 
+	it("persists the active workspace on trace events", () => {
+		recordSessionTrace(dataDir, "session-1", {
+			assistantIndex: 0,
+			workspaceId: "workspace-1",
+			events: [envelope(1, { type: "tool_start", toolName: "read_file", args: { path: "notes.md" } })],
+		});
+
+		const messages: SessionMessageSummary[] = [{ role: "assistant", content: "answer", timestamp: 1 }];
+		expect(mergeSessionTraces(dataDir, "session-1", messages)[0]?.traceEvents?.[0]?.event.workspaceId)
+			.toBe("workspace-1");
+	});
+
 	it("prefers the persisted PI message id when a branch changes message indexes", () => {
 		recordSessionTrace(dataDir, "session-1", {
 			assistantIndex: 4,
```

**File**: `apps/inno-agent/src/server/trace-store.ts` (modified, +6/-1)
```diff
@@ -80,6 +80,8 @@ export function recordSessionTrace(
 		assistantMessageId?: string;
 		startedAt?: string;
 		finishedAt?: string;
+		/** Workspace active for this turn; persisted onto each trace event. */
+		workspaceId?: string;
 		events: StreamEventEnvelope[];
 	},
 ): void {
@@ -89,7 +91,10 @@ export function recordSessionTrace(
 		eventId: envelope.eventId,
 		...(envelope.traceId ? { traceId: envelope.traceId } : {}),
 		...(envelope.occurredAt ? { occurredAt: envelope.occurredAt } : {}),
-		event: envelope.event as Record<string, unknown>,
+		event: {
+			...(envelope.event as Record<string, unknown>),
+			...(entry.workspaceId ? { workspaceId: entry.workspaceId } : {}),
+		},
 	}));
 	const nextEntry: SessionTraceEntry = {
 		assistantIndex: entry.assistantIndex,
```

**File**: `apps/inno-agent/src/server/workspace-activity-store.test.ts` (modified, +30/-1)
```diff
@@ -65,7 +65,7 @@ describe("workspace activity sidecar", () => {
 				assistantIndex: 0,
 				events: [{
 					occurredAt: "2026-09-17T00:00:00.000Z",
-					event: { type: "tool_start", toolName: "read", args: { path: "legacy.md" } },
+					event: { type: "tool_start", workspaceId: "w1", toolName: "read", args: { path: "legacy.md" } },
 				}],
 			}],
 		}));
@@ -78,4 +78,33 @@ describe("workspace activity sidecar", () => {
 		expect(activity.files).toEqual([expect.objectContaining({ path: "legacy.md", access: "read" })]);
 		expect(activity.trackingIncomplete).toBe(true);
 	});
+
+	it("does not attribute unscoped or other-workspace legacy traces", () => {
+		writeFileSync(join(root, "same.md"), "current workspace");
+		mkdirSync(join(dir, "sessions"), { recursive: true });
+		writeFileSync(traceMetadataPath(dir), JSON.stringify({
+			"s1": [{
+				assistantIndex: 0,
+				events: [
+					{
+						occurredAt: "2026-09-17T00:00:00.000Z",
+						event: { type: "tool_start", workspaceId: "w2", toolName: "read", args: { path: "same.md" } },
+					},
+					{
+						occurredAt: "2026-09-17T00:00:01.000Z",
+						event: { type: "tool_start", toolName: "read", args: { path: "same.md" } },
+					},
+				],
+			}],
+		}));
+
+		const activity = getWorkspaceFileActivities(dir, {
+			sessionId: "s1",
+			workspaceId: "w1",
+			workspaceRoot: root,
+			hasSessionHistory: true,
+		});
+		expect(activity.files).toEqual([]);
+		expect(activity.trackingIncomplete).toBe(true);
+	});
 });
```

**File**: `apps/inno-agent/src/server/workspace-activity-store.ts` (modified, +30/-5)
```diff
@@ -281,7 +281,11 @@ function legacyTraceActivities(
 			const event = envelope.event ?? {};
 			const type = typeof event.type === "string" ? event.type : "";
 			if (type === "workspace_change") {
-				const eventWorkspaceId = typeof event.workspaceId === "string" ? event.workspaceId : workspaceId;
+				const eventWorkspaceId = typeof event.workspaceId === "string" && event.workspaceId ? event.workspaceId : null;
+				if (!eventWorkspaceId) {
+					incomplete = true;
+					continue;
+				}
 				if (eventWorkspaceId !== workspaceId) continue;
 				if (event.truncated === true) incomplete = true;
 				const changes = Array.isArray(event.changes) ? event.changes : [];
@@ -307,12 +311,26 @@ function legacyTraceActivities(
 				continue;
 			}
 			if (type !== "tool_start" && type !== "tool_call_start" && type !== "tool_call_end") continue;
+			const eventWorkspaceId = typeof event.workspaceId === "string" && event.workspaceId ? event.workspaceId : null;
+			if (!eventWorkspaceId) {
+				// Tool traces without a persisted workspace binding are unsafe to
+				// attribute after a session has been switched between workspaces.
+				incomplete = true;
+				continue;
+			}
+			if (eventWorkspaceId !== workspaceId) continue;
+			// The assistant-side start event often has no arguments; the matching
+			// end/execution event carries the usable path. Do not turn that normal
+			// streaming shape into a false incomplete-tracking warning.
+			if (type === "tool_call_start" && event.args === undefined) continue;
 			const toolName = typeof event.toolName === "string" ? event.toolName : "";
 			const { paths, access, incomplete: toolIncomplete } = extractToolActivity(toolName, event.args);
-			if (toolIncomplete || access === "none") {
-				incomplete ||= toolIncomplete;
+			if (access === "none") continue;
+			if (access === "unknown") {
+				incomplete = true;
 				continue;
 			}
+			if (toolIncomplete) incomplete = true;
 			if (paths.length === 0) {
 				incomplete = true;
 				continue;
@@ -342,11 +360,17 @@ function legacyAttachmentActivities(
 	sessionId: string,
 	workspaceId: string,
 	workspaceRoot: string,
-): { files: WorkspaceFileActivity[]; hasAttachments: boolean } {
+): { files: WorkspaceFileActivity[]; incomplete: boolean; hasAttachments: boolean } {
 	const metadata = readJson<SessionAttachmentsMetadata>(attachmentsMetadataPath(dataDir), {});
 	const entries = metadata[sessionId] ?? [];
 	const map = new Map<string, WorkspaceFileActivity>();
+	let incomplete = false;
 	for (const entry of entries) {
+		if (typeof entry.workspaceId !== "string" || !entry.workspaceId) {
+			incomplete = true;
+			continue;
+		}
+		if (entry.workspaceId !== workspaceId) continue;
 		const attachments = entry.attachments;
 		if (!attachments) continue;
 		const timestamp = typeof entry.timestamp === "number" ? entry.timestamp : typeof entry.timestamp === "string" ? Date.parse(entry.timestamp) : Number.NaN;
@@ -357,7 +381,7 @@ function legacyAttachmentActivities(
 			addEphemeralActivity(map, { sessionId, workspaceId, path, access: "read", firstSeenAt: seenAt, lastSeenAt: seenAt });
 		}
 	}
-	return { files: [...map.values()], hasAttachments: entries.length > 0 };
+	return { files: [...map.values()], incomplete, hasAttachments: entries.length > 0 };
 }
 
 /**
@@ -390,6 +414,7 @@ export function getWorkspaceFileActivities(
 	const legacyOnly = !hasCurrentActivity && (legacyTrace.hasTrace || legacyAttachments.hasAttachments);
 	const trackingIncomplete = currentIncomplete
 		|| legacyTrace.incomplete
+		|| legacyAttachments.incomplete
 		|| legacyOnly
 		|| (input.hasSessionHistory === true && !current && !legacyOnly);
 	return { files: [...map.values()], trackingIncomplete };
```

---

### Incident Patch 3: `8bf71487` (2026-09-16)
**Commit Message**: feat(build): signed and notarized macOS release pipeline

- release-mac.yml: replace the unsigned packaging step with
  electron:package:mac:signed (preflight env check, Developer ID signing,
  notarization, DMG content verification); add the mac-signing test gate
- build/electron-builder.mac-signed.cjs: release-only overlay forcing
  code signing with identity "Hao Hao (Q5N3RF9WVC)", hardened runtime
  and notarize
- scripts/check-mac-signing.cjs: fail fast when any of the five signing
  env vars is missing or the Team ID mismatches
- scripts/verify-mac-release.sh: verify the app inside the shipped DMG
  (codesign deep/strict + Team ID requirement, hardened runtime flag,
  stapler ticket, Gatekeeper assessment)
- scripts/build-mac-signed.sh: interactive local signed build reading the
  p12 export password and app-specific password without echo
- .gitignore: exclude private key/credential files (*.p12/*.pfx/*.p8/*.key,
  .env.*)
- docs/mac-app-packaging.md: signing identity, local build, and CI secrets
  runbook

**File**: `.github/workflows/release-mac.yml` (modified, +15/-19)
```diff
@@ -36,15 +36,19 @@ jobs:
       # ── 3. 覆盖版本号（仅 workflow_dispatch 且输入了版本） ──────────────────
       - name: Bump version
         if: github.event_name == 'workflow_dispatch' && inputs.version != ''
-        run: npm version "${{ inputs.version }}" --no-git-tag-version
+        env:
+          RELEASE_VERSION: ${{ inputs.version }}
+        run: npm version "$RELEASE_VERSION" --no-git-tag-version
 
       # ── 4. 安装依赖 ──────────────────────────────────────────────────────────
       - name: Install dependencies
         run: npm ci
 
       # ── 4.5 跑测试（vitest，作为发版门禁）───────────────────────────────────
       - name: Run tests
-        run: npm test
+        run: |
+          npm test
+          npm run test:mac-signing
 
       # ── 5. 编译后端 TypeScript ───────────────────────────────────────────────
       - name: Build backend (tsc)
@@ -56,24 +60,15 @@ jobs:
           NODE_OPTIONS: --max-old-space-size=4096
         run: npm --workspace inno-agent-web run build
 
-      # ── 7. 打包 Electron DMG ─────────────────────────────────────────────────
-      #   未签名版：不需要 Apple 证书，用户首次打开需右键→打开
-      - name: Package Electron (unsigned DMG)
-        # --publish never：只打包，不让 electron-builder 自动发布（发布交给后面的步骤）
-        run: npx electron-builder --mac dmg --arm64 --publish never
+      # ── 7. 签名、公证，并验证 DMG 内的实际应用；失败时禁止上传 ───────────────
+      - name: Package and verify signed + notarized DMG
+        run: npm run electron:package:mac:signed
         env:
-          # 跳过代码签名（无证书时必须）
-          CSC_IDENTITY_AUTO_DISCOVERY: false
-
-      # ── 7b. [可选] 签名 + 公证版（取消注释并配置 Secrets 后生效） ────────────
-      # - name: Package Electron (signed + notarized DMG)
-      #   run: npx electron-builder --mac dmg --arm64
-      #   env:
-      #     CSC_LINK: ${{ secrets.CSC_LINK }}                          # base64 编码的 .p12 证书
-      #     CSC_KEY_PASSWORD: ${{ secrets.CSC_KEY_PASSWORD }}          # .p12 密码
-      #     APPLE_ID: ${{ secrets.APPLE_ID }}                          # Apple ID 邮箱
-      #     APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
-      #     APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
+          CSC_LINK: ${{ secrets.CSC_LINK }}
+          CSC_KEY_PASSWORD: ${{ secrets.CSC_KEY_PASSWORD }}
+          APPLE_ID: ${{ secrets.APPLE_ID }}
+          APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
+          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
 
       # ── 8. 读取实际版本号 ────────────────────────────────────────────────────
       - name: Read version
@@ -89,6 +84,7 @@ jobs:
           name: InnoAgent-${{ steps.pkg.outputs.version }}-arm64
           path: dist-electron/*.dmg
           retention-days: 30
+          if-no-files-found: error
 
       # ── 10. 创建 GitHub Release（仅 tag 触发时） ────────────────────────────
       - name: Create GitHub Release
```

**File**: `.gitignore` (modified, +8/-0)
```diff
@@ -29,3 +29,11 @@ build/icon.iconset/
 # Docs (local only)
 apps/inno-agent/docs/
 .zcode/
+
+# Signing credentials: never commit private keys, exports, or local passwords
+*.p12
+*.pfx
+*.p8
+*.key
+.env.*
+!.env.example
```

**File**: `build/electron-builder.mac-signed.cjs` (added, +15/-0)
```diff
@@ -0,0 +1,15 @@
+// Release-only overlay. No passwords or certificate bytes belong in this file.
+const { build } = require("../package.json");
+
+module.exports = {
+	...build,
+	forceCodeSigning: true,
+	mac: {
+		...build.mac,
+		identity: "Hao Hao (Q5N3RF9WVC)",
+		hardenedRuntime: true,
+		notarize: true,
+		artifactName: "${name}-${version}-${arch}.${ext}",
+		// Keep electron-builder's Electron entitlements for the app and helpers.
+	},
+};
```

**File**: `docs/mac-app-packaging.md` (added, +80/-0)
```diff
@@ -0,0 +1,80 @@
+# macOS 签名与公证发布
+
+## 已配置的签名身份
+
+- Developer ID Application: Hao Hao (Q5N3RF9WVC)
+- Team ID：`Q5N3RF9WVC`
+- 本机证书默认路径：`$HOME/Documents/inno-agent-developer-id.p12`
+- 本机默认 Apple ID：`hhyqhh@126.com`（可用环境变量 `APPLE_ID` 覆盖）
+
+`.p12` 包含私钥，不能提交 Git、作为 Release 附件，或发送到聊天中。
+证书安装/文件存在不代表已验证密码或完成应用签名。当前证书到期时间为
+2027-02-02 06:12:15（北京时间），到期前需更新本机证书和 CI Secret。
+
+## 本机打包
+
+先安装依赖（`npm ci`），确保 Xcode 命令行工具中的 `notarytool`、`stapler` 可用。
+在 Apple Account 的“登录与安全”中生成 **App 专用密码**；它不是 Apple 登录密码。
+然后在自己的终端运行：
+
+```bash
+npm run electron:build:mac:signed
+```
+
+脚本默认读取上述 `.p12`，依次隐藏输入导出密码和 Apple App 专用密码。
+密码仅供本次进程使用，不写入文件或 shell 历史。不要用 `bash -x`、调试日志或录屏运行。
+也可事先通过安全方式提供同名环境变量。首次签名时如 macOS 弹出私钥访问提示，
+请确认是本次构建的签名操作后由本人授权。
+
+此命令会解密检查 `.p12`、编译前后端、签名应用、将应用提交 Apple 公证、
+staple 公证票据、生成 arm64 DMG，再只读挂载 DMG 验证内部应用：
+
+- `codesign` 深度/严格校验及预期 Team ID；
+- Hardened Runtime；
+- `stapler validate`；
+- Gatekeeper `spctl --assess`。
+
+完成产物：`dist-electron/inno-agent-<版本>-arm64.dmg`。
+需另外人工测试安装、首次启动、内置终端和后端功能；静态校验不能代替运行测试。
+当前仅构建 Apple Silicon（arm64），未新增 Intel 版本。
+
+## GitHub Actions
+
+目标仓库：`hhyqhh/inno-agent`。在 Settings → Secrets and variables → Actions 中配置
+以下 **Repository secrets**（不是 Variables）。本地路径不能供 GitHub runner 使用。
+
+| Secret | 内容 |
+| --- | --- |
+| `CSC_LINK` | `.p12` 完整文件的 Base64 内容（同样属于私钥机密） |
+| `CSC_KEY_PASSWORD` | `.p12` 导出密码 |
+| `APPLE_ID` | Apple ID 邮箱 |
+| `APPLE_APP_SPECIFIC_PASSWORD` | Apple App 专用密码 |
+| `APPLE_TEAM_ID` | `Q5N3RF9WVC` |
+
+本人确认将签名私钥存入此仓库后，可在自己的终端使用已登录的 GitHub CLI：
+
+```bash
+# 直接通过 stdin 上传，不能把 base64 输出到聊天、日志或文件。
+set -o pipefail
+base64 < "$HOME/Documents/inno-agent-developer-id.p12" | gh secret set CSC_LINK --repo hhyqhh/inno-agent
+# 以下命令分别交互输入值，不把密码放入命令行参数。
+gh secret set CSC_KEY_PASSWORD --repo hhyqhh/inno-agent
+gh secret set APPLE_ID --repo hhyqhh/inno-agent
+gh secret set APPLE_APP_SPECIFIC_PASSWORD --repo hhyqhh/inno-agent
+gh secret set APPLE_TEAM_ID --repo hhyqhh/inno-agent
+```
+
+macOS Release 工作流仍支持手动触发以及版本 tag 触发。
+它使用单独的签名配置，强制签名；缺少凭据、公证失败或产物校验失败时不会上传 DMG。
+`notarize: true` 本身不保证凭据缺失时失败，所以打包前额外校验必需环境变量。
+上传/发布由 GitHub Actions 负责，electron-builder 使用 `--publish never`。
+只有 tag 触发才自动创建 Release；手动构建只上传 Actions artifact。
+
+仓库 CI 中持有发布私钥，请限制能修改/运行发布工作流的人员，并保护发布分支及 tag。
+配置代码、上传 Secrets、推送代码和触发发布是不同操作，配置完成不代表已发布。
+
+## 未签名内部测试
+
+原有 `bash scripts/build-mac.sh` 继续作为内部未签名/临时签名打包方式，
+不提供 Developer ID 和公证保证，不能代替对外发布的签名命令。
+Windows/Linux 配置不受本次更改影响。
```

**File**: `scripts/build-mac-signed.sh` (added, +35/-0)
```diff
@@ -0,0 +1,35 @@
+#!/usr/bin/env bash
+# Run in your own terminal: passwords are read without echo and never saved.
+set +x
+set -euo pipefail
+cd "$(dirname "${BASH_SOURCE[0]}")/.."
+
+if [[ "$(uname -s)" != Darwin ]]; then
+  echo '签名打包需要 macOS。' >&2
+  exit 1
+fi
+export CSC_LINK="${CSC_LINK:-$HOME/Documents/inno-agent-developer-id.p12}"
+export APPLE_ID="${APPLE_ID:-hhyqhh@126.com}"
+export APPLE_TEAM_ID="${APPLE_TEAM_ID:-Q5N3RF9WVC}"
+unset CSC_IDENTITY_AUTO_DISCOVERY
+if [[ ! -f "$CSC_LINK" ]]; then
+  echo '找不到本地 .p12 文件，请通过 CSC_LINK 指定绝对路径。' >&2
+  exit 1
+fi
+xcrun --find notarytool >/dev/null
+xcrun --find stapler >/dev/null
+
+if [[ -z "${CSC_KEY_PASSWORD:-}" ]]; then
+  read -r -s -p '.p12 导出密码（不显示）：' CSC_KEY_PASSWORD </dev/tty
+  printf '\n'
+fi
+if [[ -z "${APPLE_APP_SPECIFIC_PASSWORD:-}" ]]; then
+  read -r -s -p 'Apple App 专用密码（不是 Apple 登录密码，不显示）：' APPLE_APP_SPECIFIC_PASSWORD </dev/tty
+  printf '\n'
+fi
+export CSC_KEY_PASSWORD APPLE_APP_SPECIFIC_PASSWORD
+node scripts/check-mac-signing.cjs
+# Authenticate/decrypt the P12 without printing its private key or the password.
+/usr/bin/openssl pkcs12 -in "$CSC_LINK" -passin env:CSC_KEY_PASSWORD -noout
+npm run build
+npm run electron:package:mac:signed
```

**File**: `scripts/check-mac-signing.cjs` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+const REQUIRED = [
+	"CSC_LINK",
+	"CSC_KEY_PASSWORD",
+	"APPLE_ID",
+	"APPLE_APP_SPECIFIC_PASSWORD",
+	"APPLE_TEAM_ID",
+];
+
+function validateSigningEnvironment(env) {
+	const missing = REQUIRED.filter((name) => !env[name]?.trim());
+	if (missing.length) {
+		throw new Error(`缺少签名/公证环境变量：${missing.join(", ")}。请参阅 docs/mac-app-packaging.md。`);
+	}
+	if (env.APPLE_TEAM_ID !== "Q5N3RF9WVC") {
+		throw new Error("APPLE_TEAM_ID 必须与项目签名证书的 Team ID Q5N3RF9WVC 一致。");
+	}
+	if (env.CSC_IDENTITY_AUTO_DISCOVERY === "false") {
+		throw new Error("签名发布不能设置 CSC_IDENTITY_AUTO_DISCOVERY=false。");
+	}
+}
+
+module.exports = { validateSigningEnvironment };
+if (require.main === module) {
+	try {
+		validateSigningEnvironment(process.env);
+		console.log("签名/公证环境变量已齐备（尚未验证密码或 Apple 服务）。");
+	} catch (error) {
+		console.error(error.message);
+		process.exitCode = 1;
+	}
+}
```

**File**: `scripts/check-mac-signing.test.cjs` (added, +44/-0)
```diff
@@ -0,0 +1,44 @@
+const { test } = require("node:test");
+const assert = require("node:assert/strict");
+const { validateSigningEnvironment } = require("./check-mac-signing.cjs");
+
+const valid = {
+	CSC_LINK: "dummy-certificate-not-a-secret",
+	CSC_KEY_PASSWORD: "dummy-password-not-a-secret",
+	APPLE_ID: "test@example.com",
+	APPLE_APP_SPECIFIC_PASSWORD: "dummy-app-password-not-a-secret",
+	APPLE_TEAM_ID: "Q5N3RF9WVC",
+};
+
+test("complete credentials pass the presence check", () => {
+	assert.doesNotThrow(() => validateSigningEnvironment(valid));
+});
+for (const name of Object.keys(valid)) {
+	test(`missing ${name} fails closed without disclosing values`, () => {
+		assert.throws(() => validateSigningEnvironment({ ...valid, [name]: "  " }), (error) => {
+			assert.ok(error.message.includes(name));
+			assert.ok(!error.message.includes(valid.CSC_KEY_PASSWORD));
+			assert.ok(!error.message.includes(valid.APPLE_APP_SPECIFIC_PASSWORD));
+			return true;
+		});
+	});
+}
+test("another Apple team is rejected", () => {
+	assert.throws(() => validateSigningEnvironment({ ...valid, APPLE_TEAM_ID: "OTHERTEAM" }), /Team ID/);
+});
+test("unsigned environment is rejected", () => {
+	assert.throws(() => validateSigningEnvironment({ ...valid, CSC_IDENTITY_AUTO_DISCOVERY: "false" }), /AUTO_DISCOVERY/);
+});
+test("release overlay preserves packaging and requires Developer ID + notarization", () => {
+	const signed = require("../build/electron-builder.mac-signed.cjs");
+	const base = require("../package.json").build;
+	assert.equal(signed.forceCodeSigning, true);
+	assert.equal(signed.mac.notarize, true);
+	assert.equal(signed.mac.hardenedRuntime, true);
+	assert.equal(signed.mac.identity, "Hao Hao (Q5N3RF9WVC)");
+	for (const key of ["appId", "afterPack", "files", "asarUnpack", "win", "linux"]) {
+		assert.deepEqual(signed[key], base[key]);
+	}
+	assert.deepEqual(signed.mac.target, base.mac.target);
+	assert.equal(base.forceCodeSigning, undefined);
+});
```

**File**: `scripts/verify-mac-release.sh` (added, +26/-0)
```diff
@@ -0,0 +1,26 @@
+#!/usr/bin/env bash
+# Verify the actual app shipped inside the DMG, not a stale unpacked build.
+set -euo pipefail
+cd "$(dirname "${BASH_SOURCE[0]}")/.."
+VERSION=$(node -p 'require("./package.json").version')
+DMG="dist-electron/inno-agent-${VERSION}-arm64.dmg"
+[[ -f "$DMG" ]] || { echo "缺少产物：$DMG" >&2; exit 1; }
+MOUNT=$(mktemp -d "${TMPDIR:-/tmp}/inno-agent-verify.XXXXXX")
+cleanup() {
+  hdiutil detach "$MOUNT" -quiet >/dev/null 2>&1 || true
+  rmdir "$MOUNT" 2>/dev/null || true
+}
+trap cleanup EXIT
+hdiutil attach "$DMG" -readonly -nobrowse -mountpoint "$MOUNT" -quiet
+APP="$MOUNT/Inno Agent.app"
+[[ -d "$APP" ]] || { echo 'DMG 中未找到 Inno Agent.app。' >&2; exit 1; }
+codesign --verify --deep --strict --verbose=2 \
+  -R='anchor apple generic and certificate leaf[subject.OU] = "Q5N3RF9WVC"' "$APP"
+DETAILS=$(codesign --display --verbose=4 "$APP" 2>&1)
+if ! printf '%s\n' "$DETAILS" | grep -Eq 'flags=.*runtime'; then
+  echo '应用未启用 Hardened Runtime。' >&2
+  exit 1
+fi
+xcrun stapler validate "$APP"
+spctl --assess --type execute --verbose=4 "$APP"
+echo "签名、Team ID、Hardened Runtime、公证票据和 Gatekeeper 验证通过：$DMG"
```

---

### Incident Patch 4: `fdd95ccd` (2026-09-16)
**Commit Message**: Merge pull request #237 from hhyqhh/fix/pr236-followups

fix: address PR #236 review follow-ups

**File**: `CLAUDE.md` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@ PI SDK packages (`@earendil-works/pi-ai`, `@earendil-works/pi-coding-agent`, `@e
 
 Key dependencies: `ws` (WebSocket), `node-pty` (PTY terminal), `cron-parser` (scheduler), `@larksuiteoapi/node-sdk` (Feishu), `typebox` (validation), `undici` (HTTP client), `@juicesharp/rpiv-ask-user-question` (bridges agent `ask_user_question` tool calls to the web UI), `@juicesharp/rpiv-todo` (`todo` task-list tool), `pi-web-access` (`fetch_content`/`get_search_content` URL/GitHub/PDF/YouTube extraction), `pi-subagents` (optional subagent support), `pi-sandbox` (optional OS-level sandboxing), `graphology` + `graphology-communities-louvain` (wiki knowledge graph), `yaml` (YAML parsing), `@llamaindex/liteparse` (document parsing).
 
-Tests run with `npm test` (`vitest run`, root script) and also execute in the release CI. The suite is 87 files (692 tests), including backend chat-stream/trace persistence coverage and web chat trace/timeline coverage, while remaining skewed toward `memory/l2`; coverage for channels/scheduler/terminal/L1/L3 is tracked in `docs/quality-remediation-plan.md`. The TypeScript build (`npm run build`) remains the primary sanity check. No ESLint or Prettier configuration exists.
+Tests run with `npm test` (`vitest run`, root script) and also execute in the release CI. The suite is 90 files (703 tests), including backend chat-stream/trace persistence coverage and web chat trace/timeline coverage, while remaining skewed toward `memory/l2`; coverage for channels/scheduler/terminal/L1/L3 is tracked in `docs/quality-remediation-plan.md`. The TypeScript build (`npm run build`) remains the primary sanity check. No ESLint or Prettier configuration exists.
 
 When a PR changes the test count, the size of `server.ts`, or other structural facts stated in this file, update this file in the same PR — AI agents read it as ground truth.
 
```

**File**: `apps/inno-agent/src/server.ts` (modified, +2/-3)
```diff
@@ -58,6 +58,7 @@ import { handleChatRoutes } from "./server/routes/chat.js";
 import { handleCommandsRoutes } from "./server/routes/commands.js";
 import { handleBtwRoutes } from "./server/routes/btw.js";
 import { mergeSessionAgentCommands } from "./server/agent-command-store.js";
+import { stripUploadedImagesPrefix } from "./server/upload-prefix.js";
 import {
 	mergeChannels,
 	selectActiveSessionEntries,
@@ -1283,9 +1284,7 @@ function cleanGeneratedTopic(raw: string): string {
 /** Strip machine-injected prefixes (e.g. the image-upload hint prepended to
  *  user prompts) so titles reflect the user's actual words. */
 function stripInjectedPrefix(content: string): string {
-	return content
-		.replace(/^\[用户本轮上传了 \d+ 张图片，已保存到工作区：[\s\S]*?\]\s*/, "")
-		.trim();
+	return stripUploadedImagesPrefix(content);
 }
 
 function fallbackTopicFromMessages(messages: SessionMessageSummary[], summary: SessionSummary): string {
```

**File**: `apps/inno-agent/src/server/routes/chat.ts` (modified, +4/-0)
```diff
@@ -236,6 +236,10 @@ function mimeTypeToExtension(mimeType: string): string {
  * Only sent when the model can't natively see images (text-only model or a
  * rejected native payload) — vision-capable turns receive the raw prompt so
  * they aren't steered toward `ocr_image`.
+ *
+ * The prefix format is owned by `server/upload-prefix.ts`
+ * (UPLOADED_IMAGES_PREFIX_PATTERN), which strips it back out when deriving
+ * session titles — keep the two in sync when changing the format.
  */
 function prependImagePathsHint(prompt: string, imagePaths: string[]): string {
 	if (imagePaths.length === 0) return prompt;
```

**File**: `apps/inno-agent/src/server/routes/checkins.test.ts` (added, +127/-0)
```diff
@@ -0,0 +1,127 @@
+import { mkdtempSync, rmSync } from "node:fs";
+import type { IncomingMessage as HttpReq, ServerResponse } from "node:http";
+import { tmpdir } from "node:os";
+import { join } from "node:path";
+import { Readable } from "node:stream";
+import { afterEach, beforeEach, describe, expect, it } from "vitest";
+import { CheckInStore } from "../../checkins/check-in-store.js";
+import { JobStore } from "../../scheduler/job-store.js";
+import { handleCheckInsRoutes } from "./checkins.js";
+
+let dir: string;
+let jobStore: JobStore;
+let checkInStore: CheckInStore;
+
+beforeEach(() => {
+	dir = mkdtempSync(join(tmpdir(), "inno-checkins-route-"));
+	jobStore = new JobStore(join(dir, "jobs"), "Asia/Shanghai");
+	checkInStore = new CheckInStore(join(dir, "data"), "Asia/Shanghai", jobStore);
+});
+
+afterEach(() => {
+	rmSync(dir, { recursive: true, force: true });
+});
+
+function fakeReq(body: unknown): HttpReq {
+	const req = Readable.from([JSON.stringify(body)]) as HttpReq;
+	req.headers = {};
+	return req;
+}
+
+function fakeRes(): ServerResponse & { statusCode: number; payload: unknown } {
+	const res = {
+		statusCode: 0,
+		payload: undefined as unknown,
+		writeHead(status: number) {
+			res.statusCode = status;
+			return res;
+		},
+		end(body?: string) {
+			res.payload = body ? JSON.parse(body) : undefined;
+			return res;
+		},
+	};
+	return res as unknown as ServerResponse & { statusCode: number; payload: unknown };
+}
+
+/** Create an enabled daily learning job and return today's planned slot. */
+function plannedOccurrence() {
+	const job = jobStore.create({
+		name: "daily review",
+		cron: "0 9 * * *",
+		timezone: "Asia/Shanghai",
+		enabled: true,
+		taskType: "daily_review",
+		prompt: "review my notes",
+	});
+	const occurrence = checkInStore.getTodayPlan().jobs
+		.find((candidate) => candidate.jobId === job.id)?.occurrences[0];
+	if (!occurrence) throw new Error("expected a planned occurrence for today");
+	return { job, occurrence };
+}
+
+function skipOccurrence(occurrenceId: string) {
+	checkInStore.recordOccurrence({
+		occurrenceId,
+		jobId: "job",
+		scheduledAt: new Date().toISOString(),
+		status: "skipped",
+		runId: "skip_test",
+		finishedAt: new Date().toISOString(),
+	});
+}
+
+describe("check-ins skip/claim idempotency", () => {
+	it("treats a repeated skip of an already-skipped slot as success", async () => {
+		const { occurrence } = plannedOccurrence();
+		skipOccurrence(occurrence.occurrenceId);
+		// No deferred run is registered, so the cancel misses and the route
+		// falls back to the persisted slot state.
+
+		const res = fakeRes();
+		const handled = await handleCheckInsRoutes(
+			fakeReq({ occurrenceId: occurrence.occurrenceId }), res,
+			"POST", "/api/checkins/skip", { checkInStore },
+		);
+
+		expect(handled).toBe(true);
+		expect(res.statusCode).toBe(200);
+		expect(res.payload).toEqual({ skipped: true, alreadySkipped: true });
+	});
+
+	it("returns 409 for a repeated skip of a slot that is still pending", async () => {
+		const { occurrence } = plannedOccurrence();
+
+		const res = fakeRes();
+		await handleCheckInsRoutes(
+			fakeReq({ occurrenceId: occurrence.occurrenceId }), res,
+			"POST", "/api/checkins/skip", { checkInStore },
+		);
+
+		expect(res.statusCode).toBe(409);
+	});
+
+	it("returns 409 for an unknown slot", async () => {
+		const res = fakeRes();
+		await handleCheckInsRoutes(
+			fakeReq({ occurrenceId: "nope" }), res,
+			"POST", "/api/checkins/skip", { checkInStore },
+		);
+
+		expect(res.statusCode).toBe(409);
+	});
+
+	it("lets a late claim of an already-skipped slot stand down quietly", async () => {
+		const { occurrence } = plannedOccurrence();
+		skipOccurrence(occurrence.occurrenceId);
+
+		const res = fakeRes();
+		await handleCheckInsRoutes(
+			fakeReq({ occurrenceId: occurrence.occurrenceId }), res,
+			"POST", "/api/checkins/claim", { checkInStore },
+		);
+
+		expect(res.statusCode).toBe(200);
+		expect(res.payload).toEqual({ skipped: true, alreadySkipped: true });
+	});
+});
```

**File**: `apps/inno-agent/src/server/routes/checkins.ts` (modified, +13/-3)
```diff
@@ -47,9 +47,10 @@ export async function handleCheckInsRoutes(
 		}
 		const cancelled = cancelDeferredRun(occurrenceId);
 		if (!cancelled) {
-			// The response to an earlier skip can be lost after the server has
-			// already persisted the slot. Treat a repeated request for that same
-			// slot as success so the client cannot resurrect the banner by polling.
+			// A claim can race a completed skip (e.g. the countdown takeover in
+			// another tab). The slot is already settled, so report success and
+			// let the client's settled-slot pre-check quietly stand down instead
+			// of surfacing a spurious failure.
 			const occurrence = ctx.checkInStore.getOccurrenceById(occurrenceId);
 			if (occurrence?.status === "skipped") {
 				json(res, 200, { skipped: true, alreadySkipped: true });
@@ -72,6 +73,15 @@ export async function handleCheckInsRoutes(
 		}
 		const cancelled = cancelDeferredRun(occurrenceId);
 		if (!cancelled) {
+			// The response to an earlier skip can be lost after the server has
+			// already persisted the slot. Treat a repeated skip for that same
+			// slot as success so the client cannot resurrect the banner by
+			// retrying (a plain 409 would look like "auto-execution won").
+			const occurrence = ctx.checkInStore.getOccurrenceById(occurrenceId);
+			if (occurrence?.status === "skipped") {
+				json(res, 200, { skipped: true, alreadySkipped: true });
+				return true;
+			}
 			json(res, 409, { error: "This slot is no longer pending." });
 			return true;
 		}
```

**File**: `apps/inno-agent/src/server/routes/sessions.topic.test.ts` (added, +56/-0)
```diff
@@ -0,0 +1,56 @@
+import { describe, expect, it } from "vitest";
+import { TOPIC_UPGRADE_MESSAGE_THRESHOLD, type SessionSummary } from "../session-model.js";
+import { withRecordedTopic } from "./sessions.js";
+
+function summary(overrides: Partial<SessionSummary> = {}): SessionSummary {
+	return {
+		id: "s1",
+		name: "s1",
+		createdAt: "2026-09-15T00:00:00.000Z",
+		updatedAt: "2026-09-15T00:00:00.000Z",
+		messageCount: 2,
+		preview: "hello",
+		channels: ["web"],
+		...overrides,
+	};
+}
+
+describe("withRecordedTopic", () => {
+	it("reports no topic when nothing is recorded", () => {
+		const result = withRecordedTopic(summary(), {});
+		expect(result.hasTopic).toBe(false);
+		expect(result.topicPendingUpgrade).toBe(false);
+		expect(result.name).toBe("s1");
+	});
+
+	it("keeps a generated preview final below the upgrade threshold", () => {
+		const result = withRecordedTopic(summary({ messageCount: TOPIC_UPGRADE_MESSAGE_THRESHOLD - 1 }), {
+			s1: { topic: "preview title", updatedAt: "2026-09-15T00:00:00.000Z", generated: true },
+		});
+		expect(result.name).toBe("preview title");
+		expect(result.hasTopic).toBe(true);
+		expect(result.topicPendingUpgrade).toBe(false);
+	});
+
+	it("flags a generated preview as pending once the conversation reaches the threshold", () => {
+		const result = withRecordedTopic(summary({ messageCount: TOPIC_UPGRADE_MESSAGE_THRESHOLD }), {
+			s1: { topic: "preview title", updatedAt: "2026-09-15T00:00:00.000Z", generated: true },
+		});
+		expect(result.topicPendingUpgrade).toBe(true);
+	});
+
+	it("settles once the upgrade lands", () => {
+		const result = withRecordedTopic(summary({ messageCount: TOPIC_UPGRADE_MESSAGE_THRESHOLD + 2 }), {
+			s1: { topic: "贝叶斯定理入门", updatedAt: "2026-09-15T00:00:00.000Z", generated: true, upgraded: true },
+		});
+		expect(result.name).toBe("贝叶斯定理入门");
+		expect(result.topicPendingUpgrade).toBe(false);
+	});
+
+	it("never flags a manual rename as pending upgrade", () => {
+		const result = withRecordedTopic(summary({ messageCount: TOPIC_UPGRADE_MESSAGE_THRESHOLD + 2 }), {
+			s1: { topic: "my title", updatedAt: "2026-09-15T00:00:00.000Z" },
+		});
+		expect(result.topicPendingUpgrade).toBe(false);
+	});
+});
```

**File**: `apps/inno-agent/src/server/routes/sessions.ts` (modified, +2/-1)
```diff
@@ -215,7 +215,8 @@ function withRecordedChannels(summary: SessionSummary, metadata: SessionChannelM
 	};
 }
 
-function withRecordedTopic(summary: SessionSummary, metadata: SessionTopicMetadata): SessionSummary {
+/** Exported for tests — pure merge of a listing summary with recorded topic metadata. */
+export function withRecordedTopic(summary: SessionSummary, metadata: SessionTopicMetadata): SessionSummary {
 	const recorded = metadata[summary.id];
 	const topic = recorded?.topic?.trim();
 	if (!topic) return { ...summary, hasTopic: false, topicPendingUpgrade: false };
```

**File**: `apps/inno-agent/src/server/upload-prefix.test.ts` (added, +14/-0)
```diff
@@ -0,0 +1,14 @@
+import { describe, expect, it } from "vitest";
+import { stripUploadedImagesPrefix } from "./upload-prefix.js";
+
+describe("stripUploadedImagesPrefix", () => {
+	it("removes the injected image-upload prefix, including the OCR hint line", () => {
+		const prompt = `[用户本轮上传了 2 张图片，已保存到工作区：\n- /ws/a.png\n- /ws/b.png\n如果需要识别图片中的文字（当前模型可能不支持图片识别），请调用 ocr_image 工具并传入上述路径。]\n\n帮我讲讲这张图`;
+		expect(stripUploadedImagesPrefix(prompt)).toBe("帮我讲讲这张图");
+	});
+
+	it("leaves ordinary prompts untouched", () => {
+		expect(stripUploadedImagesPrefix("  什么是贝叶斯定理？ ")).toBe("什么是贝叶斯定理？");
+		expect(stripUploadedImagesPrefix("[笔记] 复习计划")).toBe("[笔记] 复习计划");
+	});
+});
```

---

### Incident Patch 5: `b125a454` (2026-09-15)
**Commit Message**: fix: address PR #236 review follow-ups

- checkins: return idempotent 200 alreadySkipped on a repeated skip (the
  response a lost skip is actually retried against), and correct the
  misplaced comment on the claim route
- server: extract the uploaded-images prefix pattern into
  src/server/upload-prefix.ts as the single source of truth shared by
  chat.ts (builder) and server.ts (stripper); cross-reference it from the
  web client's mirrored regex
- web: scope job-stream settle/discard clearing of pending
  question/permission cards to the job run's session so shared chat-turn
  state can never be clobbered
- tests: route-level coverage for check-ins skip/claim idempotency,
  withRecordedTopic topicPendingUpgrade transitions, and the upload-prefix
  stripper (90 files / 703 tests)

**File**: `CLAUDE.md` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@ PI SDK packages (`@earendil-works/pi-ai`, `@earendil-works/pi-coding-agent`, `@e
 
 Key dependencies: `ws` (WebSocket), `node-pty` (PTY terminal), `cron-parser` (scheduler), `@larksuiteoapi/node-sdk` (Feishu), `typebox` (validation), `undici` (HTTP client), `@juicesharp/rpiv-ask-user-question` (bridges agent `ask_user_question` tool calls to the web UI), `@juicesharp/rpiv-todo` (`todo` task-list tool), `pi-web-access` (`fetch_content`/`get_search_content` URL/GitHub/PDF/YouTube extraction), `pi-subagents` (optional subagent support), `pi-sandbox` (optional OS-level sandboxing), `graphology` + `graphology-communities-louvain` (wiki knowledge graph), `yaml` (YAML parsing), `@llamaindex/liteparse` (document parsing).
 
-Tests run with `npm test` (`vitest run`, root script) and also execute in the release CI. The suite is 87 files (692 tests), including backend chat-stream/trace persistence coverage and web chat trace/timeline coverage, while remaining skewed toward `memory/l2`; coverage for channels/scheduler/terminal/L1/L3 is tracked in `docs/quality-remediation-plan.md`. The TypeScript build (`npm run build`) remains the primary sanity check. No ESLint or Prettier configuration exists.
+Tests run with `npm test` (`vitest run`, root script) and also execute in the release CI. The suite is 90 files (703 tests), including backend chat-stream/trace persistence coverage and web chat trace/timeline coverage, while remaining skewed toward `memory/l2`; coverage for channels/scheduler/terminal/L1/L3 is tracked in `docs/quality-remediation-plan.md`. The TypeScript build (`npm run build`) remains the primary sanity check. No ESLint or Prettier configuration exists.
 
 When a PR changes the test count, the size of `server.ts`, or other structural facts stated in this file, update this file in the same PR — AI agents read it as ground truth.
 
```

**File**: `apps/inno-agent/src/server.ts` (modified, +2/-3)
```diff
@@ -58,6 +58,7 @@ import { handleChatRoutes } from "./server/routes/chat.js";
 import { handleCommandsRoutes } from "./server/routes/commands.js";
 import { handleBtwRoutes } from "./server/routes/btw.js";
 import { mergeSessionAgentCommands } from "./server/agent-command-store.js";
+import { stripUploadedImagesPrefix } from "./server/upload-prefix.js";
 import {
 	mergeChannels,
 	selectActiveSessionEntries,
@@ -1283,9 +1284,7 @@ function cleanGeneratedTopic(raw: string): string {
 /** Strip machine-injected prefixes (e.g. the image-upload hint prepended to
  *  user prompts) so titles reflect the user's actual words. */
 function stripInjectedPrefix(content: string): string {
-	return content
-		.replace(/^\[用户本轮上传了 \d+ 张图片，已保存到工作区：[\s\S]*?\]\s*/, "")
-		.trim();
+	return stripUploadedImagesPrefix(content);
 }
 
 function fallbackTopicFromMessages(messages: SessionMessageSummary[], summary: SessionSummary): string {
```

**File**: `apps/inno-agent/src/server/routes/chat.ts` (modified, +4/-0)
```diff
@@ -236,6 +236,10 @@ function mimeTypeToExtension(mimeType: string): string {
  * Only sent when the model can't natively see images (text-only model or a
  * rejected native payload) — vision-capable turns receive the raw prompt so
  * they aren't steered toward `ocr_image`.
+ *
+ * The prefix format is owned by `server/upload-prefix.ts`
+ * (UPLOADED_IMAGES_PREFIX_PATTERN), which strips it back out when deriving
+ * session titles — keep the two in sync when changing the format.
  */
 function prependImagePathsHint(prompt: string, imagePaths: string[]): string {
 	if (imagePaths.length === 0) return prompt;
```

**File**: `apps/inno-agent/src/server/routes/checkins.test.ts` (added, +127/-0)
```diff
@@ -0,0 +1,127 @@
+import { mkdtempSync, rmSync } from "node:fs";
+import type { IncomingMessage as HttpReq, ServerResponse } from "node:http";
+import { tmpdir } from "node:os";
+import { join } from "node:path";
+import { Readable } from "node:stream";
+import { afterEach, beforeEach, describe, expect, it } from "vitest";
+import { CheckInStore } from "../../checkins/check-in-store.js";
+import { JobStore } from "../../scheduler/job-store.js";
+import { handleCheckInsRoutes } from "./checkins.js";
+
+let dir: string;
+let jobStore: JobStore;
+let checkInStore: CheckInStore;
+
+beforeEach(() => {
+	dir = mkdtempSync(join(tmpdir(), "inno-checkins-route-"));
+	jobStore = new JobStore(join(dir, "jobs"), "Asia/Shanghai");
+	checkInStore = new CheckInStore(join(dir, "data"), "Asia/Shanghai", jobStore);
+});
+
+afterEach(() => {
+	rmSync(dir, { recursive: true, force: true });
+});
+
+function fakeReq(body: unknown): HttpReq {
+	const req = Readable.from([JSON.stringify(body)]) as HttpReq;
+	req.headers = {};
+	return req;
+}
+
+function fakeRes(): ServerResponse & { statusCode: number; payload: unknown } {
+	const res = {
+		statusCode: 0,
+		payload: undefined as unknown,
+		writeHead(status: number) {
+			res.statusCode = status;
+			return res;
+		},
+		end(body?: string) {
+			res.payload = body ? JSON.parse(body) : undefined;
+			return res;
+		},
+	};
+	return res as unknown as ServerResponse & { statusCode: number; payload: unknown };
+}
+
+/** Create an enabled daily learning job and return today's planned slot. */
+function plannedOccurrence() {
+	const job = jobStore.create({
+		name: "daily review",
+		cron: "0 9 * * *",
+		timezone: "Asia/Shanghai",
+		enabled: true,
+		taskType: "daily_review",
+		prompt: "review my notes",
+	});
+	const occurrence = checkInStore.getTodayPlan().jobs
+		.find((candidate) => candidate.jobId === job.id)?.occurrences[0];
+	if (!occurrence) throw new Error("expected a planned occurrence for today");
+	return { job, occurrence };
+}
+
+function skipOccurrence(occurrenceId: string) {
+	checkInStore.recordOccurrence({
+		occurrenceId,
+		jobId: "job",
+		scheduledAt: new Date().toISOString(),
+		status: "skipped",
+		runId: "skip_test",
+		finishedAt: new Date().toISOString(),
+	});
+}
+
+describe("check-ins skip/claim idempotency", () => {
+	it("treats a repeated skip of an already-skipped slot as success", async () => {
+		const { occurrence } = plannedOccurrence();
+		skipOccurrence(occurrence.occurrenceId);
+		// No deferred run is registered, so the cancel misses and the route
+		// falls back to the persisted slot state.
+
+		const res = fakeRes();
+		const handled = await handleCheckInsRoutes(
+			fakeReq({ occurrenceId: occurrence.occurrenceId }), res,
+			"POST", "/api/checkins/skip", { checkInStore },
+		);
+
+		expect(handled).toBe(true);
+		expect(res.statusCode).toBe(200);
+		expect(res.payload).toEqual({ skipped: true, alreadySkipped: true });
+	});
+
+	it("returns 409 for a repeated skip of a slot that is still pending", async () => {
+		const { occurrence } = plannedOccurrence();
+
+		const res = fakeRes();
+		await handleCheckInsRoutes(
+			fakeReq({ occurrenceId: occurrence.occurrenceId }), res,
+			"POST", "/api/checkins/skip", { checkInStore },
+		);
+
+		expect(res.statusCode).toBe(409);
+	});
+
+	it("returns 409 for an unknown slot", async () => {
+		const res = fakeRes();
+		await handleCheckInsRoutes(
+			fakeReq({ occurrenceId: "nope" }), res,
+			"POST", "/api/checkins/skip", { checkInStore },
+		);
+
+		expect(res.statusCode).toBe(409);
+	});
+
+	it("lets a late claim of an already-skipped slot stand down quietly", async () => {
+		const { occurrence } = plannedOccurrence();
+		skipOccurrence(occurrence.occurrenceId);
+
+		const res = fakeRes();
+		await handleCheckInsRoutes(
+			fakeReq({ occurrenceId: occurrence.occurrenceId }), res,
+			"POST", "/api/checkins/claim", { checkInStore },
+		);
+
+		expect(res.statusCode).toBe(200);
+		expect(res.payload).toEqual({ skipped: true, alreadySkipped: true });
+	});
+});
```

**File**: `apps/inno-agent/src/server/routes/checkins.ts` (modified, +13/-3)
```diff
@@ -47,9 +47,10 @@ export async function handleCheckInsRoutes(
 		}
 		const cancelled = cancelDeferredRun(occurrenceId);
 		if (!cancelled) {
-			// The response to an earlier skip can be lost after the server has
-			// already persisted the slot. Treat a repeated request for that same
-			// slot as success so the client cannot resurrect the banner by polling.
+			// A claim can race a completed skip (e.g. the countdown takeover in
+			// another tab). The slot is already settled, so report success and
+			// let the client's settled-slot pre-check quietly stand down instead
+			// of surfacing a spurious failure.
 			const occurrence = ctx.checkInStore.getOccurrenceById(occurrenceId);
 			if (occurrence?.status === "skipped") {
 				json(res, 200, { skipped: true, alreadySkipped: true });
@@ -72,6 +73,15 @@ export async function handleCheckInsRoutes(
 		}
 		const cancelled = cancelDeferredRun(occurrenceId);
 		if (!cancelled) {
+			// The response to an earlier skip can be lost after the server has
+			// already persisted the slot. Treat a repeated skip for that same
+			// slot as success so the client cannot resurrect the banner by
+			// retrying (a plain 409 would look like "auto-execution won").
+			const occurrence = ctx.checkInStore.getOccurrenceById(occurrenceId);
+			if (occurrence?.status === "skipped") {
+				json(res, 200, { skipped: true, alreadySkipped: true });
+				return true;
+			}
 			json(res, 409, { error: "This slot is no longer pending." });
 			return true;
 		}
```

**File**: `apps/inno-agent/src/server/routes/sessions.topic.test.ts` (added, +56/-0)
```diff
@@ -0,0 +1,56 @@
+import { describe, expect, it } from "vitest";
+import { TOPIC_UPGRADE_MESSAGE_THRESHOLD, type SessionSummary } from "../session-model.js";
+import { withRecordedTopic } from "./sessions.js";
+
+function summary(overrides: Partial<SessionSummary> = {}): SessionSummary {
+	return {
+		id: "s1",
+		name: "s1",
+		createdAt: "2026-09-15T00:00:00.000Z",
+		updatedAt: "2026-09-15T00:00:00.000Z",
+		messageCount: 2,
+		preview: "hello",
+		channels: ["web"],
+		...overrides,
+	};
+}
+
+describe("withRecordedTopic", () => {
+	it("reports no topic when nothing is recorded", () => {
+		const result = withRecordedTopic(summary(), {});
+		expect(result.hasTopic).toBe(false);
+		expect(result.topicPendingUpgrade).toBe(false);
+		expect(result.name).toBe("s1");
+	});
+
+	it("keeps a generated preview final below the upgrade threshold", () => {
+		const result = withRecordedTopic(summary({ messageCount: TOPIC_UPGRADE_MESSAGE_THRESHOLD - 1 }), {
+			s1: { topic: "preview title", updatedAt: "2026-09-15T00:00:00.000Z", generated: true },
+		});
+		expect(result.name).toBe("preview title");
+		expect(result.hasTopic).toBe(true);
+		expect(result.topicPendingUpgrade).toBe(false);
+	});
+
+	it("flags a generated preview as pending once the conversation reaches the threshold", () => {
+		const result = withRecordedTopic(summary({ messageCount: TOPIC_UPGRADE_MESSAGE_THRESHOLD }), {
+			s1: { topic: "preview title", updatedAt: "2026-09-15T00:00:00.000Z", generated: true },
+		});
+		expect(result.topicPendingUpgrade).toBe(true);
+	});
+
+	it("settles once the upgrade lands", () => {
+		const result = withRecordedTopic(summary({ messageCount: TOPIC_UPGRADE_MESSAGE_THRESHOLD + 2 }), {
+			s1: { topic: "贝叶斯定理入门", updatedAt: "2026-09-15T00:00:00.000Z", generated: true, upgraded: true },
+		});
+		expect(result.name).toBe("贝叶斯定理入门");
+		expect(result.topicPendingUpgrade).toBe(false);
+	});
+
+	it("never flags a manual rename as pending upgrade", () => {
+		const result = withRecordedTopic(summary({ messageCount: TOPIC_UPGRADE_MESSAGE_THRESHOLD + 2 }), {
+			s1: { topic: "my title", updatedAt: "2026-09-15T00:00:00.000Z" },
+		});
+		expect(result.topicPendingUpgrade).toBe(false);
+	});
+});
```

**File**: `apps/inno-agent/src/server/routes/sessions.ts` (modified, +2/-1)
```diff
@@ -215,7 +215,8 @@ function withRecordedChannels(summary: SessionSummary, metadata: SessionChannelM
 	};
 }
 
-function withRecordedTopic(summary: SessionSummary, metadata: SessionTopicMetadata): SessionSummary {
+/** Exported for tests — pure merge of a listing summary with recorded topic metadata. */
+export function withRecordedTopic(summary: SessionSummary, metadata: SessionTopicMetadata): SessionSummary {
 	const recorded = metadata[summary.id];
 	const topic = recorded?.topic?.trim();
 	if (!topic) return { ...summary, hasTopic: false, topicPendingUpgrade: false };
```

**File**: `apps/inno-agent/src/server/upload-prefix.test.ts` (added, +14/-0)
```diff
@@ -0,0 +1,14 @@
+import { describe, expect, it } from "vitest";
+import { stripUploadedImagesPrefix } from "./upload-prefix.js";
+
+describe("stripUploadedImagesPrefix", () => {
+	it("removes the injected image-upload prefix, including the OCR hint line", () => {
+		const prompt = `[用户本轮上传了 2 张图片，已保存到工作区：\n- /ws/a.png\n- /ws/b.png\n如果需要识别图片中的文字（当前模型可能不支持图片识别），请调用 ocr_image 工具并传入上述路径。]\n\n帮我讲讲这张图`;
+		expect(stripUploadedImagesPrefix(prompt)).toBe("帮我讲讲这张图");
+	});
+
+	it("leaves ordinary prompts untouched", () => {
+		expect(stripUploadedImagesPrefix("  什么是贝叶斯定理？ ")).toBe("什么是贝叶斯定理？");
+		expect(stripUploadedImagesPrefix("[笔记] 复习计划")).toBe("[笔记] 复习计划");
+	});
+});
```

---

### Incident Patch 6: `949a9a6b` (2026-09-15)
**Commit Message**: Merge pull request #236 from nfcino/fix/inno-agent-stability

fix: stabilize chat sessions and scheduled runs

**File**: `CLAUDE.md` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@ PI SDK packages (`@earendil-works/pi-ai`, `@earendil-works/pi-coding-agent`, `@e
 
 Key dependencies: `ws` (WebSocket), `node-pty` (PTY terminal), `cron-parser` (scheduler), `@larksuiteoapi/node-sdk` (Feishu), `typebox` (validation), `undici` (HTTP client), `@juicesharp/rpiv-ask-user-question` (bridges agent `ask_user_question` tool calls to the web UI), `@juicesharp/rpiv-todo` (`todo` task-list tool), `pi-web-access` (`fetch_content`/`get_search_content` URL/GitHub/PDF/YouTube extraction), `pi-subagents` (optional subagent support), `pi-sandbox` (optional OS-level sandboxing), `graphology` + `graphology-communities-louvain` (wiki knowledge graph), `yaml` (YAML parsing), `@llamaindex/liteparse` (document parsing).
 
-Tests run with `npm test` (`vitest run`, root script) and also execute in the release CI. The suite is 84 files (670 tests), including backend chat-stream/trace persistence coverage and web chat trace/timeline coverage, while remaining skewed toward `memory/l2`; coverage for channels/scheduler/terminal/L1/L3 is tracked in `docs/quality-remediation-plan.md`. The TypeScript build (`npm run build`) remains the primary sanity check. No ESLint or Prettier configuration exists.
+Tests run with `npm test` (`vitest run`, root script) and also execute in the release CI. The suite is 87 files (692 tests), including backend chat-stream/trace persistence coverage and web chat trace/timeline coverage, while remaining skewed toward `memory/l2`; coverage for channels/scheduler/terminal/L1/L3 is tracked in `docs/quality-remediation-plan.md`. The TypeScript build (`npm run build`) remains the primary sanity check. No ESLint or Prettier configuration exists.
 
 When a PR changes the test count, the size of `server.ts`, or other structural facts stated in this file, update this file in the same PR — AI agents read it as ground truth.
 
```

**File**: `apps/inno-agent/src/checkins/check-in-store.ts` (modified, +7/-0)
```diff
@@ -263,6 +263,13 @@ export class CheckInStore {
 			?.occurrences.find((occurrence) => occurrence.occurrenceId === occurrenceId);
 	}
 
+	/** Find a live occurrence by its stable id, including settled slots. */
+	getOccurrenceById(occurrenceId: string, now: Date = new Date()): CheckInOccurrence | undefined {
+		return this.getTodayPlan(now).jobs
+			.flatMap((job) => job.occurrences)
+			.find((occurrence) => occurrence.occurrenceId === occurrenceId);
+	}
+
 	/**
 	 * Persist the result for one planned slot and reconcile today's check-in.
 	 * A successful attempt is sticky: a later failed retry cannot undo a slot
```

**File**: `apps/inno-agent/src/server.ts` (modified, +9/-6)
```diff
@@ -61,6 +61,7 @@ import { mergeSessionAgentCommands } from "./server/agent-command-store.js";
 import {
 	mergeChannels,
 	selectActiveSessionEntries,
+	TOPIC_UPGRADE_MESSAGE_THRESHOLD,
 	type SessionChannel,
 	type SessionChannelMetadata,
 	type SessionMessageSummary,
@@ -1358,14 +1359,14 @@ ${excerpt}
  *
  * Two passes, both guarded by `_pendingAutoTopics`:
  * 1. First pass: no topic recorded yet and ≥2 messages (the first exchange).
- * 2. Upgrade pass: the existing topic is auto-generated (never a manual
+ *    Persist the user's first-message preview immediately so the UI never
+ *    shows a model-generated placeholder or a session-file id.
+ * 2. Upgrade pass: the existing preview is auto-generated (never a manual
  *    rename), hasn't been upgraded yet, and the conversation has grown to
- *    TOPIC_UPGRADE_MESSAGE_THRESHOLD messages — the first-pass title was
- *    based on a single exchange and is often vague, so re-roll it once with
- *    richer context.
+ *    TOPIC_UPGRADE_MESSAGE_THRESHOLD messages — generate a richer summary
+ *    once there is enough context.
  */
 const _pendingAutoTopics = new Set<string>();
-const TOPIC_UPGRADE_MESSAGE_THRESHOLD = 6;
 
 function maybeAutoGenerateTopic(sessionId: string): void {
 	if (!sessionId || _pendingAutoTopics.has(sessionId)) return;
@@ -1381,7 +1382,9 @@ function maybeAutoGenerateTopic(sessionId: string): void {
 			const parsed = parseSessionFile(sessionPath);
 			if (!parsed || parsed.messages.length < 2) return;
 			if (existing && parsed.messages.length < TOPIC_UPGRADE_MESSAGE_THRESHOLD) return;
-			const topic = await generateSessionTopic(parsed.summary, parsed.messages);
+			const topic = existing
+				? await generateSessionTopic(parsed.summary, parsed.messages)
+				: fallbackTopicFromMessages(parsed.messages, parsed.summary);
 			writeSessionTopic(sessionId, topic, true, existing ? { upgraded: true } : undefined);
 			logger.info(`[auto-topic] ${sessionId} → ${topic}${existing ? " (upgraded)" : ""}`);
 		} catch (err) {
```

**File**: `apps/inno-agent/src/server/routes/checkins.ts` (modified, +8/-0)
```diff
@@ -47,6 +47,14 @@ export async function handleCheckInsRoutes(
 		}
 		const cancelled = cancelDeferredRun(occurrenceId);
 		if (!cancelled) {
+			// The response to an earlier skip can be lost after the server has
+			// already persisted the slot. Treat a repeated request for that same
+			// slot as success so the client cannot resurrect the banner by polling.
+			const occurrence = ctx.checkInStore.getOccurrenceById(occurrenceId);
+			if (occurrence?.status === "skipped") {
+				json(res, 200, { skipped: true, alreadySkipped: true });
+				return true;
+			}
 			json(res, 409, { error: "This slot is no longer pending." });
 			return true;
 		}
```

**File**: `apps/inno-agent/src/server/routes/sessions.ts` (modified, +11/-4)
```diff
@@ -42,6 +42,7 @@ import { contentDispositionAttachment } from "../file-helpers.js";
 import { HttpError, json, matchRoute, readBody } from "../http-helpers.js";
 import {
 	mergeChannels,
+	TOPIC_UPGRADE_MESSAGE_THRESHOLD,
 	type SessionChannel,
 	type SessionChannelMetadata,
 	type SessionMessageSummary,
@@ -215,10 +216,16 @@ function withRecordedChannels(summary: SessionSummary, metadata: SessionChannelM
 }
 
 function withRecordedTopic(summary: SessionSummary, metadata: SessionTopicMetadata): SessionSummary {
-	const topic = metadata[summary.id]?.topic?.trim();
-	// hasTopic lets clients distinguish "no topic recorded yet" (auto-topic may
-	// still be generating) from a fallback preview name, without guessing.
-	return topic ? { ...summary, name: topic, hasTopic: true } : { ...summary, hasTopic: false };
+	const recorded = metadata[summary.id];
+	const topic = recorded?.topic?.trim();
+	if (!topic) return { ...summary, hasTopic: false, topicPendingUpgrade: false };
+	// A generated preview is only provisional once the conversation has enough
+	// messages for the richer upgrade pass. Legacy generated topics without the
+	// upgraded marker remain final until a later turn reaches that threshold.
+	const topicPendingUpgrade = recorded.generated === true
+		&& recorded.upgraded !== true
+		&& summary.messageCount >= TOPIC_UPGRADE_MESSAGE_THRESHOLD;
+	return { ...summary, name: topic, hasTopic: true, topicPendingUpgrade };
 }
 
 /**
```

**File**: `apps/inno-agent/src/server/session-model.ts` (modified, +4/-0)
```diff
@@ -46,6 +46,8 @@ export interface SessionTraceEvent {
 
 export type SessionChannel = "cli" | "web" | "feishu" | "qq" | "wechat" | "scheduler" | "unknown";
 
+export const TOPIC_UPGRADE_MESSAGE_THRESHOLD = 6;
+
 export interface SessionSummary {
 	id: string;
 	name: string;
@@ -58,6 +60,8 @@ export interface SessionSummary {
 	origin?: SessionChannel;
 	/** True once a topic (manual or auto-generated) has been recorded. */
 	hasTopic?: boolean;
+	/** True while an auto-generated preview is waiting for its richer summary. */
+	topicPendingUpgrade?: boolean;
 }
 
 export type SessionTopicMetadata = Record<string, { topic: string; updatedAt: string; generated?: boolean; upgraded?: boolean }>;
```

**File**: `apps/inno-agent/web/src/api/sessions.ts` (modified, +2/-0)
```diff
@@ -17,6 +17,8 @@ export interface SessionMeta {
 	archived?: boolean;
 	/** True once a topic (manual or auto-generated) has been recorded server-side. */
 	hasTopic?: boolean;
+	/** True while an auto-generated preview is waiting for its richer summary. */
+	topicPendingUpgrade?: boolean;
 }
 
 export interface PendingQuestionData {
```

**File**: `apps/inno-agent/web/src/i18n/locales/en.json` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 	"contextUsage": {
 		"title": "Context usage",
 		"close": "Close context usage",
-		"summary": "{{percent}} · {{amount}} context used",
+		"summary": "Context window:\n{{percent}} used ({{remaining}} left)\n{{amount}} tokens used",
 		"used": "Used {{amount}}",
 		"loading": "Loading usage…",
 		"failed": "Could not load usage",
```

---

### Incident Patch 7: `f971d9b2` (2026-09-15)
**Commit Message**: fix(sessions): refresh after topic preview upgrade

**File**: `CLAUDE.md` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@ PI SDK packages (`@earendil-works/pi-ai`, `@earendil-works/pi-coding-agent`, `@e
 
 Key dependencies: `ws` (WebSocket), `node-pty` (PTY terminal), `cron-parser` (scheduler), `@larksuiteoapi/node-sdk` (Feishu), `typebox` (validation), `undici` (HTTP client), `@juicesharp/rpiv-ask-user-question` (bridges agent `ask_user_question` tool calls to the web UI), `@juicesharp/rpiv-todo` (`todo` task-list tool), `pi-web-access` (`fetch_content`/`get_search_content` URL/GitHub/PDF/YouTube extraction), `pi-subagents` (optional subagent support), `pi-sandbox` (optional OS-level sandboxing), `graphology` + `graphology-communities-louvain` (wiki knowledge graph), `yaml` (YAML parsing), `@llamaindex/liteparse` (document parsing).
 
-Tests run with `npm test` (`vitest run`, root script) and also execute in the release CI. The suite is 84 files (670 tests), including backend chat-stream/trace persistence coverage and web chat trace/timeline coverage, while remaining skewed toward `memory/l2`; coverage for channels/scheduler/terminal/L1/L3 is tracked in `docs/quality-remediation-plan.md`. The TypeScript build (`npm run build`) remains the primary sanity check. No ESLint or Prettier configuration exists.
+Tests run with `npm test` (`vitest run`, root script) and also execute in the release CI. The suite is 87 files (692 tests), including backend chat-stream/trace persistence coverage and web chat trace/timeline coverage, while remaining skewed toward `memory/l2`; coverage for channels/scheduler/terminal/L1/L3 is tracked in `docs/quality-remediation-plan.md`. The TypeScript build (`npm run build`) remains the primary sanity check. No ESLint or Prettier configuration exists.
 
 When a PR changes the test count, the size of `server.ts`, or other structural facts stated in this file, update this file in the same PR — AI agents read it as ground truth.
 
```

**File**: `apps/inno-agent/src/server.ts` (modified, +1/-1)
```diff
@@ -61,6 +61,7 @@ import { mergeSessionAgentCommands } from "./server/agent-command-store.js";
 import {
 	mergeChannels,
 	selectActiveSessionEntries,
+	TOPIC_UPGRADE_MESSAGE_THRESHOLD,
 	type SessionChannel,
 	type SessionChannelMetadata,
 	type SessionMessageSummary,
@@ -1366,7 +1367,6 @@ ${excerpt}
  *    once there is enough context.
  */
 const _pendingAutoTopics = new Set<string>();
-const TOPIC_UPGRADE_MESSAGE_THRESHOLD = 6;
 
 function maybeAutoGenerateTopic(sessionId: string): void {
 	if (!sessionId || _pendingAutoTopics.has(sessionId)) return;
```

**File**: `apps/inno-agent/src/server/routes/sessions.ts` (modified, +11/-4)
```diff
@@ -42,6 +42,7 @@ import { contentDispositionAttachment } from "../file-helpers.js";
 import { HttpError, json, matchRoute, readBody } from "../http-helpers.js";
 import {
 	mergeChannels,
+	TOPIC_UPGRADE_MESSAGE_THRESHOLD,
 	type SessionChannel,
 	type SessionChannelMetadata,
 	type SessionMessageSummary,
@@ -215,10 +216,16 @@ function withRecordedChannels(summary: SessionSummary, metadata: SessionChannelM
 }
 
 function withRecordedTopic(summary: SessionSummary, metadata: SessionTopicMetadata): SessionSummary {
-	const topic = metadata[summary.id]?.topic?.trim();
-	// hasTopic lets clients distinguish "no topic recorded yet" (auto-topic may
-	// still be generating) from a fallback preview name, without guessing.
-	return topic ? { ...summary, name: topic, hasTopic: true } : { ...summary, hasTopic: false };
+	const recorded = metadata[summary.id];
+	const topic = recorded?.topic?.trim();
+	if (!topic) return { ...summary, hasTopic: false, topicPendingUpgrade: false };
+	// A generated preview is only provisional once the conversation has enough
+	// messages for the richer upgrade pass. Legacy generated topics without the
+	// upgraded marker remain final until a later turn reaches that threshold.
+	const topicPendingUpgrade = recorded.generated === true
+		&& recorded.upgraded !== true
+		&& summary.messageCount >= TOPIC_UPGRADE_MESSAGE_THRESHOLD;
+	return { ...summary, name: topic, hasTopic: true, topicPendingUpgrade };
 }
 
 /**
```

**File**: `apps/inno-agent/src/server/session-model.ts` (modified, +4/-0)
```diff
@@ -46,6 +46,8 @@ export interface SessionTraceEvent {
 
 export type SessionChannel = "cli" | "web" | "feishu" | "qq" | "wechat" | "scheduler" | "unknown";
 
+export const TOPIC_UPGRADE_MESSAGE_THRESHOLD = 6;
+
 export interface SessionSummary {
 	id: string;
 	name: string;
@@ -58,6 +60,8 @@ export interface SessionSummary {
 	origin?: SessionChannel;
 	/** True once a topic (manual or auto-generated) has been recorded. */
 	hasTopic?: boolean;
+	/** True while an auto-generated preview is waiting for its richer summary. */
+	topicPendingUpgrade?: boolean;
 }
 
 export type SessionTopicMetadata = Record<string, { topic: string; updatedAt: string; generated?: boolean; upgraded?: boolean }>;
```

**File**: `apps/inno-agent/web/src/api/sessions.ts` (modified, +2/-0)
```diff
@@ -17,6 +17,8 @@ export interface SessionMeta {
 	archived?: boolean;
 	/** True once a topic (manual or auto-generated) has been recorded server-side. */
 	hasTopic?: boolean;
+	/** True while an auto-generated preview is waiting for its richer summary. */
+	topicPendingUpgrade?: boolean;
 }
 
 export interface PendingQuestionData {
```

**File**: `apps/inno-agent/web/src/stores/sessions-store.test.ts` (modified, +22/-0)
```diff
@@ -102,6 +102,28 @@ describe("SessionsStore navigation", () => {
 		expect(store.contextUsageRevision).toBe(1);
 	});
 
+	it("keeps refreshing while a preview topic waits for its upgrade", async () => {
+		vi.useFakeTimers();
+		try {
+			const preview = { ...session("topic.jsonl"), hasTopic: true, topicPendingUpgrade: true };
+			mocks.listSessions
+				.mockResolvedValueOnce([preview])
+				.mockResolvedValueOnce([{ ...preview, topicPendingUpgrade: false }]);
+			const store = new SessionsStoreImpl();
+			const refreshing = store.refreshUntilTopic("topic.jsonl");
+
+			await Promise.resolve();
+			await Promise.resolve();
+			expect(mocks.listSessions).toHaveBeenCalledTimes(1);
+			await vi.advanceTimersByTimeAsync(2_000);
+			await refreshing;
+
+			expect(mocks.listSessions).toHaveBeenCalledTimes(2);
+		} finally {
+			vi.useRealTimers();
+		}
+	});
+
 	it("returns to the welcome page on a popstate URL without a session", () => {
 		const store = new SessionsStoreImpl();
 		store.currentSessionId = "a.jsonl";
```

**File**: `apps/inno-agent/web/src/stores/sessions-store.ts` (modified, +4/-3)
```diff
@@ -159,14 +159,15 @@ export class SessionsStoreImpl extends EventEmitter<SessionsStoreEvents> {
 	 *
 	 * Topic recording is fire-and-forget on the server, so the refresh that
 	 * runs at turn end can race the first-message preview or the later summary.
-	 * Poll with bounded backoff and stop as soon as `hasTopic` flips (or the
-	 * session disappears).
+	 * Poll with bounded backoff and stop once the final topic is visible (or the
+	 * session disappears). A recorded first-message preview can still be waiting
+	 * for the richer summary after the conversation reaches six messages.
 	 */
 	async refreshUntilTopic(sessionId: string): Promise<void> {
 		await this.refresh();
 		for (const delayMs of TOPIC_REFRESH_DELAYS_MS) {
 			const entry = this.sessions.find((session) => session.id === sessionId);
-			if (!entry || entry.hasTopic) return;
+			if (!entry || (entry.hasTopic && entry.topicPendingUpgrade !== true)) return;
 			await new Promise((resolve) => setTimeout(resolve, delayMs));
 			await this.refresh();
 		}
```

---

### Incident Patch 8: `d7128019` (2026-09-15)
**Commit Message**: fix(sessions): show first-message preview immediately

**File**: `apps/inno-agent/src/server.ts` (modified, +8/-5)
```diff
@@ -1358,11 +1358,12 @@ ${excerpt}
  *
  * Two passes, both guarded by `_pendingAutoTopics`:
  * 1. First pass: no topic recorded yet and ≥2 messages (the first exchange).
- * 2. Upgrade pass: the existing topic is auto-generated (never a manual
+ *    Persist the user's first-message preview immediately so the UI never
+ *    shows a model-generated placeholder or a session-file id.
+ * 2. Upgrade pass: the existing preview is auto-generated (never a manual
  *    rename), hasn't been upgraded yet, and the conversation has grown to
- *    TOPIC_UPGRADE_MESSAGE_THRESHOLD messages — the first-pass title was
- *    based on a single exchange and is often vague, so re-roll it once with
- *    richer context.
+ *    TOPIC_UPGRADE_MESSAGE_THRESHOLD messages — generate a richer summary
+ *    once there is enough context.
  */
 const _pendingAutoTopics = new Set<string>();
 const TOPIC_UPGRADE_MESSAGE_THRESHOLD = 6;
@@ -1381,7 +1382,9 @@ function maybeAutoGenerateTopic(sessionId: string): void {
 			const parsed = parseSessionFile(sessionPath);
 			if (!parsed || parsed.messages.length < 2) return;
 			if (existing && parsed.messages.length < TOPIC_UPGRADE_MESSAGE_THRESHOLD) return;
-			const topic = await generateSessionTopic(parsed.summary, parsed.messages);
+			const topic = existing
+				? await generateSessionTopic(parsed.summary, parsed.messages)
+				: fallbackTopicFromMessages(parsed.messages, parsed.summary);
 			writeSessionTopic(sessionId, topic, true, existing ? { upgraded: true } : undefined);
 			logger.info(`[auto-topic] ${sessionId} → ${topic}${existing ? " (upgraded)" : ""}`);
 		} catch (err) {
```

**File**: `apps/inno-agent/web/src/react/ChatCenter.tsx` (modified, +1/-0)
```diff
@@ -1564,6 +1564,7 @@ export function ChatCenter({ onOpenPresetPanels, onPreviewFile }: ChatCenterProp
 			onRetry={handleRetry}
 			wsError={wsError}
 			sessionTitle={currentSessionMeta?.name}
+			sessionHasTopic={currentSessionMeta?.hasTopic === true}
 			workspaceName={activeWorkspaceName}
 			workspaceCollapsed={appLayout.workspaceMode === "collapsed"}
 			sidebarCollapsed={appLayout.sidebarCollapsed}
```

**File**: `apps/inno-agent/web/src/react/chat/ChatConversation.tsx` (modified, +19/-5)
```diff
@@ -22,6 +22,15 @@ function traceContainsAssistantText(message: ChatMessage): boolean {
 	)));
 }
 
+function firstMessageTitle(messages: ChatMessage[]): string | undefined {
+	const content = messages.find((message) => message.role === "user")?.content
+		.replace(/^\[用户本轮上传了 \d+ 张图片，已保存到工作区：[\s\S]*?\]\s*/, "")
+		.replace(/\s+/g, " ")
+		.trim();
+	if (!content) return undefined;
+	return content.length > 28 ? `${content.slice(0, 28)}...` : content;
+}
+
 interface ChatConversationProps {
 	chat: {
 		messages: ChatMessage[];
@@ -64,6 +73,8 @@ interface ChatConversationProps {
 	wsError: string;
 	/** Session topic shown in the conversation header. */
 	sessionTitle?: string;
+	/** True once the server has recorded a deliberate session topic. */
+	sessionHasTopic?: boolean;
 	/** Bound workspace name rendered as a chip next to the title. */
 	workspaceName?: string | null;
 	/** Reserve room for the desktop chrome's workspace button when collapsed. */
@@ -97,6 +108,7 @@ export function ChatConversation({
 	onRetry,
 	wsError,
 	sessionTitle,
+	sessionHasTopic = false,
 	workspaceName,
 	workspaceCollapsed = false,
 	sidebarCollapsed = false,
@@ -113,6 +125,10 @@ export function ChatConversation({
 		return () => window.clearTimeout(timer);
 	}, [chat.isLoadingHistory, chat.messages.length]);
 	const conversationTurns = useMemo(() => buildConversationTurns(chat.messages), [chat.messages]);
+	const initialTitle = useMemo(() => firstMessageTitle(chat.messages), [chat.messages]);
+	const visibleSessionTitle = sessionHasTopic && sessionTitle
+		? sessionTitle
+		: initialTitle || t("nav.newChat", "新建会话");
 	const turnIndexByStartMessage = useMemo(
 		() => new Map(conversationTurns.map((turn) => [turn.startMessageIndex, turn.index])),
 		[conversationTurns],
@@ -216,10 +232,9 @@ export function ChatConversation({
 		<section className="relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-[var(--inno-chat-bg)]">
 			{topOverlay}
 			{smartToast}
-			{sessionTitle ? (
-				<header className={`inno-conversation-header relative z-[5] flex h-12 shrink-0 items-center gap-2.5 border-b border-[var(--inno-border)] bg-[color-mix(in_srgb,var(--inno-chat-bg)_85%,transparent)] pr-4 backdrop-blur-md ${workspaceCollapsed ? "pr-14" : ""} ${sidebarCollapsed ? "inno-conversation-header--sidebar-collapsed" : "pl-4"}`}>
+			<header className={`inno-conversation-header relative z-[5] flex h-12 shrink-0 items-center gap-2.5 border-b border-[var(--inno-border)] bg-[color-mix(in_srgb,var(--inno-chat-bg)_85%,transparent)] pr-4 backdrop-blur-md ${workspaceCollapsed ? "pr-14" : ""} ${sidebarCollapsed ? "inno-conversation-header--sidebar-collapsed" : "pl-4"}`}>
 					<div className="inno-conversation-heading flex min-w-0 items-center gap-2.5">
-						<span className="inno-conversation-title min-w-0 truncate text-[14.5px] font-semibold text-[var(--inno-text)]" title={sessionTitle}>{sessionTitle}</span>
+					<span className="inno-conversation-title min-w-0 truncate text-[14.5px] font-semibold text-[var(--inno-text)]" title={visibleSessionTitle}>{visibleSessionTitle}</span>
 					{workspaceName ? (
 						<span className="inno-conversation-workspace-chip inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[9px] bg-[var(--inno-chip-bg)] px-2.5 py-[3px] text-[11px] text-[var(--inno-text-subtle)]">
 							<Folder size={11} aria-hidden="true" />
@@ -228,8 +243,7 @@ export function ChatConversation({
 						) : null}
 					</div>
 					{btwControl ? <div className="ml-auto flex shrink-0 items-center">{btwControl}</div> : null}
-				</header>
-			) : null}
+			</header>
 			<div className="conversation-stage relative flex-1 min-h-0">
 				<div
 					ref={scrollRef}
```

**File**: `apps/inno-agent/web/src/stores/sessions-store.ts` (modified, +5/-5)
```diff
@@ -152,12 +152,12 @@ export class SessionsStoreImpl extends EventEmitter<SessionsStoreEvents> {
 	}
 
 	/**
-	 * Refresh the sidebar until the session's auto-generated topic lands.
+	 * Refresh the sidebar until the session's recorded topic/preview lands.
 	 *
-	 * Topic generation is fire-and-forget on the server (an extra LLM call
-	 * after the turn's `done` event), so the refresh that runs at turn end
-	 * usually sees the untitled fallback name. Poll with bounded backoff and
-	 * stop as soon as `hasTopic` flips (or the session disappears).
+	 * Topic recording is fire-and-forget on the server, so the refresh that
+	 * runs at turn end can race the first-message preview or the later summary.
+	 * Poll with bounded backoff and stop as soon as `hasTopic` flips (or the
+	 * session disappears).
 	 */
 	async refreshUntilTopic(sessionId: string): Promise<void> {
 		await this.refresh();
```

---

### Incident Patch 9: `9dae1a29` (2026-09-15)
**Commit Message**: fix(jobs): keep scheduled runs visible in chat

**File**: `apps/inno-agent/web/src/react/ChatCenter.tsx` (modified, +1/-0)
```diff
@@ -238,6 +238,7 @@ export function ChatCenter({ onOpenPresetPanels, onPreviewFile }: ChatCenterProp
 		isSending: chatStore.isSending,
 		isLoadingHistory: chatStore.isLoadingHistory,
 		jobStreaming: chatStore.jobStreaming,
+		jobStreamInCurrentSession: chatStore.jobStreamInCurrentSession,
 		canReconnect: chatStore.canReconnect,
 		activeTools: chatStore.activeTools,
 		completedTools: chatStore.completedTools,
```

**File**: `apps/inno-agent/web/src/react/chat/ChatConversation.tsx` (modified, +12/-9)
```diff
@@ -30,6 +30,8 @@ interface ChatConversationProps {
 		/** A manual job run is streaming into this conversation — the empty
 		 *  session placeholder must not cover the live job timeline. */
 		jobStreaming: boolean;
+		/** Whether the manual job stream belongs to this conversation. */
+		jobStreamInCurrentSession: boolean;
 		activeTools: ChatToolRecord[];
 		completedTools: ChatToolRecord[];
 		pendingQuestion: PendingQuestion | null;
@@ -131,13 +133,14 @@ export function ChatConversation({
 	// markdown re-parse) in place of the live stream tree. Defer that swap to
 	// a transition-scheduled render so React can slice the expensive mount
 	// across frames while StreamingBubbles keeps showing the finished stream.
-	const settledSending = useDeferredValue(chat.isSending);
-	const activeTurnStartMessage = settledSending ? conversationTurns.at(-1)?.startMessageIndex : undefined;
+	const liveTurn = chat.isSending || (chat.jobStreaming && chat.jobStreamInCurrentSession);
+	const settledLiveTurn = useDeferredValue(liveTurn);
+	const activeTurnStartMessage = settledLiveTurn ? conversationTurns.at(-1)?.startMessageIndex : undefined;
 	// The assistant record for a finished stream mounts at the same render the
 	// live trace unmounts; skip its entrance fade so the swap is seamless.
 	// Messages mounted any other way (e.g. switching conversations) still fade in.
 	const skipFadeKeysRef = useRef<Set<string>>(new Set());
-	const wasSendingRef = useRef(chat.isSending);
+	const wasLiveTurnRef = useRef(liveTurn);
 	const knownKeysRef = useRef<Set<string>>(new Set());
 	const currentKeys = chat.messages.map((message, index) => `${message.timestamp}-${index}`);
 	// Fresh conversation load: none of the previously seen keys survive, so
@@ -146,15 +149,15 @@ export function ChatConversation({
 		skipFadeKeysRef.current.clear();
 	}
 	knownKeysRef.current = new Set(currentKeys);
-	if (wasSendingRef.current && !chat.isSending) {
+	if (wasLiveTurnRef.current && !liveTurn) {
 		for (let index = chat.messages.length - 1; index >= 0; index -= 1) {
 			if (chat.messages[index]?.role === "assistant") {
 				skipFadeKeysRef.current.add(`${chat.messages[index].timestamp}-${index}`);
 				break;
 			}
 		}
 	}
-	wasSendingRef.current = chat.isSending;
+	wasLiveTurnRef.current = liveTurn;
 	const traceTurnPresentation = useMemo(() => {
 		const coveredAssistantIndexes = new Set<number>();
 		const actionOwnerIndexes = new Set<number>();
@@ -244,7 +247,7 @@ export function ChatConversation({
 							</div>
 						) : null}
 
-						{!chat.isLoadingHistory && chat.messages.length === 0 && !chat.isSending && !chat.jobStreaming ? (
+						{!chat.isLoadingHistory && chat.messages.length === 0 && !chat.isSending && !chat.jobStreamInCurrentSession ? (
 							<div className="flex flex-col items-center justify-center pt-20 text-center text-[var(--inno-text-muted)]">
 								<div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--inno-surface-muted)] text-[var(--inno-text-subtle)]"><Sparkles size={18} /></div>
 								<p className="text-sm font-medium text-[var(--inno-text)]">{t("chat.emptySessionTitle")}</p>
@@ -263,7 +266,7 @@ export function ChatConversation({
 								// terminal stream event. Keep the live trace as the only
 								// visible representation until the turn is finalized, so the
 								// trace does not briefly duplicate or change its geometry.
-								if (settledSending && index === chat.messages.length - 1 && message.role === "assistant") return null;
+								if (settledLiveTurn && index === chat.messages.length - 1 && message.role === "assistant") return null;
 								const isActiveTurnAssistant = activeTurnStartMessage !== undefined && index >= activeTurnStartMessage && message.role === "assistant";
 								const isTurnActionOwner = lastAssistantMessageIndexes.has(index) || traceTurnPresentation.actionOwnerIndexes.has(index);
 								const showActions = message.role === "user" || (isTurnActionOwner && !isActiveTurnAssistant);
@@ -289,8 +292,8 @@ export function ChatConversation({
 							});
 						})()}
 
-						<StreamingBubbles onOpenSkill={onOpenSkill} holdCompleted={settledSending} />
-						<JobStreamBubbles />
+						{!chat.jobStreamInCurrentSession ? <StreamingBubbles onOpenSkill={onOpenSkill} holdCompleted={settledLiveTurn} /> : null}
+						<JobStreamBubbles holdCompleted={settledLiveTurn} />
 					</div>
 				</div>
 				<ConversationMinimap messages={chat.messages} scrollContainerRef={scrollRef} onNavigateStart={onPauseAutoScroll} />
```

**File**: `apps/inno-agent/web/src/react/chat/JobStreamBubbles.tsx` (modified, +30/-19)
```diff
@@ -1,15 +1,17 @@
+import { useRef } from "react";
 import { motion } from "motion/react";
 import { chatStore } from "../../stores/chat-store.js";
 import { useStoreSnapshot } from "../hooks.js";
 import { QuestionDialog } from "../QuestionDialog.js";
 import { PermissionDialog } from "../PermissionDialog.js";
 import { AgentTraceTimeline } from "./AgentTraceTimeline.js";
+import { AgentAvatar } from "./MessageBubble.js";
 
 /** Live view of a manual job run. Deliberately renders with the exact same
  *  trace timeline as a normal chat turn (StreamingBubbles), but is driven by
  *  the job-run SSE namespace so the composer never locks (isSending stays
  *  false) and an active chat stream is never disturbed. */
-export function JobStreamBubbles() {
+export function JobStreamBubbles({ holdCompleted = false }: { holdCompleted?: boolean }) {
 	const stream = useStoreSnapshot(chatStore, () => ({
 		active: chatStore.jobStreaming,
 		belongsToCurrentSession: chatStore.jobStreamInCurrentSession,
@@ -20,34 +22,43 @@ export function JobStreamBubbles() {
 		pendingQuestion: chatStore.pendingQuestion,
 		pendingPermission: chatStore.pendingPermission,
 	}));
-	if (!stream.active || !stream.belongsToCurrentSession) return null;
-	const pendingQuestion = stream.pendingQuestion
+	// The job store clears its live fields in the same update that appends the
+	// canonical assistant message. Keep the last live snapshot for the parent's
+	// deferred handoff so the timeline does not jump or briefly disappear.
+	const heldRef = useRef<typeof stream | null>(null);
+	if (stream.active && stream.belongsToCurrentSession) heldRef.current = stream;
+	const effective = stream.active ? stream : (holdCompleted ? heldRef.current : null);
+	if (!effective || !effective.belongsToCurrentSession) return null;
+	const pendingQuestion = effective.pendingQuestion
 		? {
-			questionId: stream.pendingQuestion.questionId,
-			card: <QuestionDialog pending={stream.pendingQuestion} />,
+			questionId: effective.pendingQuestion.questionId,
+			card: <QuestionDialog pending={effective.pendingQuestion} />,
 		}
 		: undefined;
-	const permissionCard = stream.pendingPermission
-		? <PermissionDialog pending={stream.pendingPermission} />
+	const permissionCard = effective.pendingPermission
+		? <PermissionDialog pending={effective.pendingPermission} />
 		: undefined;
 	return (
 		<motion.div
-			className="inno-trace-shell inno-trace-shell-live"
+			className="inno-trace-shell inno-trace-shell-live flex gap-3"
 			initial={{ opacity: 0, y: 8 }}
 			animate={{ opacity: 1, y: 0 }}
 			transition={{ duration: 0.2, ease: "easeOut" }}
 		>
-			<AgentTraceTimeline
-				steps={stream.trace}
-				isSending
-				startedAt={stream.startedAt}
-				finishedAt={null}
-				error={stream.error}
-				showText
-				fallbackText={stream.text}
-				pendingQuestion={pendingQuestion}
-				trailingCard={permissionCard}
-			/>
+			<AgentAvatar />
+			<div className="min-w-0 flex-1">
+				<AgentTraceTimeline
+					steps={effective.trace}
+					isSending
+					startedAt={effective.startedAt}
+					finishedAt={null}
+					error={effective.error}
+					showText
+					fallbackText={effective.text}
+					pendingQuestion={pendingQuestion}
+					trailingCard={permissionCard}
+				/>
+			</div>
 		</motion.div>
 	);
 }
```

**File**: `apps/inno-agent/web/src/react/jobs/runJobInConversation.ts` (modified, +5/-0)
```diff
@@ -1,3 +1,4 @@
+import { appStore } from "../../stores/app-store.js";
 import { chatStore } from "../../stores/chat-store.js";
 import { jobsStore } from "../../stores/jobs-store.js";
 import { sessionsStore } from "../../stores/sessions-store.js";
@@ -46,6 +47,10 @@ export async function runJobInConversation(job: ScheduledJob, t: Translate, occu
 		await sessionsStore.createSessionWith(workspaceId ? { workspaceId } : { newWorkspace: { isTemp: true } });
 		const targetSessionId = sessionsStore.currentSessionId;
 		if (!targetSessionId) throw new Error(t("jobs.errors.sessionCreateFailed"));
+		// The jobs page is a separate app route. Selecting the new session is
+		// not enough to render its conversation, so return to ChatCenter before
+		// starting the stream.
+		appStore.setPage("chat");
 		// createSessionWith clears the chat but does not load an empty history,
 		// so bind the new session before starting the streaming job view.
 		chatStore.loadHistory([], targetSessionId);
```

**File**: `apps/inno-agent/web/src/stores/chat-store.ts` (modified, +4/-0)
```diff
@@ -338,6 +338,8 @@ export class ChatStoreImpl extends EventEmitter<ChatStoreEvents> {
 		this.jobStreamTrace = [];
 		this.jobStreamText = "";
 		this.jobStreamError = "";
+		this.pendingQuestion = null;
+		this.pendingPermission = null;
 		this.jobUserMessageId = null;
 		if (!messageId) return;
 		const index = this.messages.findIndex((message) => message.turnId === messageId && message.transient);
@@ -362,6 +364,8 @@ export class ChatStoreImpl extends EventEmitter<ChatStoreEvents> {
 		this.jobStreamTrace = [];
 		this.jobStreamText = "";
 		this.jobStreamError = "";
+		this.pendingQuestion = null;
+		this.pendingPermission = null;
 		// The settled record belongs to the run's conversation only — never to
 		// whatever other session the user may be viewing by then.
 		if (!sessionId || sessionId !== this.currentSessionContext) return;
```

---

### Incident Patch 10: `c989d6c2` (2026-09-15)
**Commit Message**: fix(checkins): make scheduled actions race-safe

**File**: `apps/inno-agent/src/checkins/check-in-store.ts` (modified, +7/-0)
```diff
@@ -263,6 +263,13 @@ export class CheckInStore {
 			?.occurrences.find((occurrence) => occurrence.occurrenceId === occurrenceId);
 	}
 
+	/** Find a live occurrence by its stable id, including settled slots. */
+	getOccurrenceById(occurrenceId: string, now: Date = new Date()): CheckInOccurrence | undefined {
+		return this.getTodayPlan(now).jobs
+			.flatMap((job) => job.occurrences)
+			.find((occurrence) => occurrence.occurrenceId === occurrenceId);
+	}
+
 	/**
 	 * Persist the result for one planned slot and reconcile today's check-in.
 	 * A successful attempt is sticky: a later failed retry cannot undo a slot
```

**File**: `apps/inno-agent/src/server/routes/checkins.ts` (modified, +8/-0)
```diff
@@ -47,6 +47,14 @@ export async function handleCheckInsRoutes(
 		}
 		const cancelled = cancelDeferredRun(occurrenceId);
 		if (!cancelled) {
+			// The response to an earlier skip can be lost after the server has
+			// already persisted the slot. Treat a repeated request for that same
+			// slot as success so the client cannot resurrect the banner by polling.
+			const occurrence = ctx.checkInStore.getOccurrenceById(occurrenceId);
+			if (occurrence?.status === "skipped") {
+				json(res, 200, { skipped: true, alreadySkipped: true });
+				return true;
+			}
 			json(res, 409, { error: "This slot is no longer pending." });
 			return true;
 		}
```

**File**: `apps/inno-agent/web/src/react/chat/ScheduledRunBanner.tsx` (modified, +23/-2)
```diff
@@ -2,6 +2,7 @@ import { useEffect, useRef, useState } from "react";
 import { useTranslation } from "react-i18next";
 import { BellRing, Play } from "lucide-react";
 import { claimOccurrence, getPendingRuns, skipOccurrence, type PendingRun } from "../../api/checkins.js";
+import { ApiError } from "../../api/client.js";
 import { chatStore } from "../../stores/chat-store.js";
 import { sessionsStore } from "../../stores/sessions-store.js";
 import { findJobById, runJobInConversation } from "../jobs/runJobInConversation.js";
@@ -31,7 +32,10 @@ export function ScheduledRunBanner() {
 		let disposed = false;
 		const poll = async (): Promise<void> => {
 			try {
-				const next = await getPendingRuns();
+				// Keep a slot hidden while a user action is in flight (and after it
+				// succeeds), otherwise the 2s poll can re-add the same banner before
+				// the skip response arrives.
+				const next = (await getPendingRuns()).filter((run) => !handledRef.current.has(run.occurrenceId));
 				if (disposed) return;
 				// A run that vanished without our doing means the server settled
 				// it (auto-exec) — pull the new conversation into the sidebar.
@@ -102,11 +106,28 @@ export function ScheduledRunBanner() {
 	}
 
 	async function handleSkip(run: PendingRun): Promise<void> {
+		if (busyId) return;
 		handledRef.current.add(run.occurrenceId);
+		setBusyId(run.occurrenceId);
 		try {
 			await skipOccurrence(run.occurrenceId);
-		} finally {
 			setRuns((prev) => prev.filter((candidate) => candidate.occurrenceId !== run.occurrenceId));
+		} catch (error) {
+			// A 409 means the server has already taken the slot out of the
+			// pending queue (usually because auto-execution won the race), so it
+			// cannot produce this banner again. Other failures must remain
+			// retryable instead of silently allowing the server to execute it.
+			if (error instanceof ApiError && error.status === 409) {
+				setRuns((prev) => prev.filter((candidate) => candidate.occurrenceId !== run.occurrenceId));
+				void sessionsStore.refresh();
+			} else {
+				handledRef.current.delete(run.occurrenceId);
+				setRuns((prev) => prev.some((candidate) => candidate.occurrenceId === run.occurrenceId)
+					? prev
+					: [...prev, run]);
+			}
+		} finally {
+			setBusyId(null);
 		}
 	}
 
```

---

### Incident Patch 11: `29e2004d` (2026-09-14)
**Commit Message**: Merge pull request #235 from hhyqhh/codex/context-usage-ui

feat: read-only session context usage API and localized composer control

**File**: `apps/inno-agent/src/agent/context-usage.test.ts` (added, +57/-0)
```diff
@@ -0,0 +1,57 @@
+import { describe, expect, it } from "vitest";
+import { buildContextUsage } from "./context-usage.js";
+
+type Input = Parameters<typeof buildContextUsage>[1];
+function fixture(overrides: Partial<Input> = {}): Input {
+	return {
+		getContextUsage: () => ({ tokens: 65700, contextWindow: 262144, percent: 25.06 }),
+		systemPrompt: "System instructions. <available_skills>skill list</available_skills>",
+		getActiveToolNames: () => ["read", "docs_search"],
+		getAllTools: () => [
+			{ name: "read", description: "Read a file", parameters: {}, sourceInfo: { path: "builtin" } },
+			{ name: "docs_search", description: "Search docs", parameters: {}, sourceInfo: { path: "/node_modules/pi-mcp-adapter/index.ts" } },
+			{ name: "disabled", description: "x".repeat(10000), parameters: {}, sourceInfo: { path: "builtin" } },
+		] as never,
+		messages: [{ role: "assistant", content: [{ type: "text", text: "Hello" }], stopReason: "stop",
+			usage: { input: 64000, output: 1700, cacheRead: 0, cacheWrite: 0 } }] as never,
+		...overrides,
+	};
+}
+
+describe("buildContextUsage", () => {
+	it("calibrates categories to SDK total without exposing content", () => {
+		const result = buildContextUsage("session", fixture());
+		expect(result.tokens).toBe(65700);
+		expect(result.percent).toBeCloseTo(25.0625, 2);
+		expect(result.source).toBe("sdk");
+		expect(result.breakdown.reduce((sum, p) => sum + p.tokens, 0)).toBe(result.tokens);
+		expect(result.breakdown.find((p) => p.id === "mcp")!.tokens).toBeGreaterThan(0);
+		expect(result.breakdown.find((p) => p.id === "skills")!.tokens).toBeGreaterThan(0);
+		expect(JSON.stringify(result)).not.toContain("System instructions");
+		expect(JSON.stringify(result)).not.toContain("docs_search");
+	});
+	it("ignores inactive tool schemas", () => {
+		const s = fixture();
+		expect(buildContextUsage("s", s)).toEqual(buildContextUsage("s", fixture({ getAllTools: () => s.getAllTools().slice(0, 2) })));
+	});
+	it("does not turn unknown post-compaction usage into zero or old estimates", () => {
+		const result = buildContextUsage("s", fixture({ getContextUsage: () => ({ tokens: null, percent: null, contextWindow: 1000 }) }));
+		expect(result).toMatchObject({ status: "pending", tokens: null, percent: null, breakdown: [] });
+	});
+	it("includes prompt and schemas before the first provider response", () => {
+		const result = buildContextUsage("s", fixture({ messages: [], getContextUsage: () => ({ tokens: 0, percent: 0, contextWindow: 1000 }) }));
+		expect(result.source).toBe("estimated");
+		expect(result.tokens).toBeGreaterThan(0);
+		expect(result.breakdown.find((p) => p.id === "messages")!.tokens).toBe(0);
+	});
+	it("keeps over-capacity usage and supports empty context", () => {
+		expect(buildContextUsage("s", fixture({ getContextUsage: () => ({ tokens: 2000, percent: 200, contextWindow: 1000 }) })).percent).toBe(200);
+		const empty = buildContextUsage("s", fixture({ messages: [], systemPrompt: "", getAllTools: () => [] }));
+		expect(empty.tokens).toBe(0);
+		expect(empty.breakdown.every((p) => p.tokens === 0)).toBe(true);
+	});
+	it("handles no model and invalid totals", () => {
+		expect(buildContextUsage("s", fixture({ getContextUsage: () => undefined })).status).toBe("unavailable");
+		expect(buildContextUsage("s", fixture({ getContextUsage: () => ({ tokens: NaN, percent: NaN, contextWindow: 1000 }) })).status).toBe("unavailable");
+	});
+});
```

**File**: `apps/inno-agent/src/agent/context-usage.ts` (added, +61/-0)
```diff
@@ -0,0 +1,61 @@
+import { estimateTokens, type AgentSession } from "@earendil-works/pi-coding-agent";
+import type { SessionContextUsage } from "../shared/context-usage.js";
+
+type ContextSession = Pick<AgentSession, "getContextUsage" | "systemPrompt" | "messages" | "getAllTools" | "getActiveToolNames">;
+
+export function unavailableContextUsage(sessionId: string, status: "inactive" | "unavailable"): SessionContextUsage {
+	return { sessionId, status, source: "sdk", tokens: null, contextWindow: null, percent: null, breakdown: [] };
+}
+
+/** Categories are heuristic weights, calibrated to the SDK's current context total.
+ * Tool results stay in messages; tool schemas are counted only once. MCP attribution
+ * uses extension provenance as well as names (direct MCP tools can have any prefix).
+ */
+export function buildContextUsage(sessionId: string, session: ContextSession): SessionContextUsage {
+	const usage = session.getContextUsage();
+	if (!usage || !Number.isFinite(usage.contextWindow) || usage.contextWindow <= 0) {
+		return unavailableContextUsage(sessionId, "unavailable");
+	}
+	const base = { sessionId, contextWindow: usage.contextWindow };
+	if (usage.tokens === null) {
+		return { ...base, status: "pending", source: "sdk", tokens: null, percent: null, breakdown: [] };
+	}
+	const weights = { system: 0, tools: 0, messages: 0, mcp: 0, skills: 0 };
+	const estimateText = (text: string) => Math.ceil(text.length / 4);
+	const prompt = session.systemPrompt.replace(/<available_skills>[\s\S]*?<\/available_skills>/g, (block) => {
+		weights.skills += estimateText(block);
+		return "";
+	});
+	weights.system = estimateText(prompt);
+	const active = new Set(session.getActiveToolNames());
+	for (const tool of session.getAllTools()) {
+		if (!active.has(tool.name)) continue;
+		const provenance = `${tool.sourceInfo?.path ?? ""} ${tool.sourceInfo?.source ?? ""}`;
+		const category = /^mcp(?:_|$)/i.test(tool.name) || /pi-mcp-adapter/.test(provenance) ? "mcp" : "tools";
+		weights[category] += estimateText(JSON.stringify({ name: tool.name, description: tool.description, parameters: tool.parameters }));
+	}
+	for (const message of session.messages) weights.messages += estimateTokens(message);
+	const entries = Object.entries(weights) as Array<[keyof typeof weights, number]>;
+	const weightTotal = entries.reduce((sum, [, value]) => sum + value, 0);
+	// Before the first successful provider response the SDK only estimates messages,
+	// omitting the system prompt and schemas. Include them in the initial estimate.
+	const hasUsage = session.messages.some((m) => m.role === "assistant" && m.stopReason !== "error" && m.stopReason !== "aborted"
+		&& m.usage.input + m.usage.output + m.usage.cacheRead + m.usage.cacheWrite > 0);
+	const rawTotal = hasUsage ? usage.tokens : weightTotal;
+	if (!Number.isFinite(rawTotal) || rawTotal < 0) return unavailableContextUsage(sessionId, "unavailable");
+	const tokens = Math.round(rawTotal);
+	// Largest-remainder allocation keeps the category tokens equal to the total.
+	const parts = entries.map(([id, weight]) => {
+		const exact = weightTotal ? tokens * weight / weightTotal : (id === "messages" ? tokens : 0);
+		return { id, tokens: Math.floor(exact), remainder: exact - Math.floor(exact) };
+	});
+	let remaining = tokens - parts.reduce((sum, part) => sum + part.tokens, 0);
+	for (const part of [...parts].sort((a, b) => b.remainder - a.remainder)) {
+		if (remaining-- > 0) part.tokens++;
+	}
+	return {
+		...base, status: "ready", source: hasUsage ? "sdk" : "estimated", tokens,
+		percent: tokens / usage.contextWindow * 100,
+		breakdown: parts.map(({ id, tokens }) => ({ id, tokens, percent: tokens / usage.contextWindow * 100 })),
+	};
+}
```

**File**: `apps/inno-agent/src/server/routes/sessions.context-usage.test.ts` (added, +51/-0)
```diff
@@ -0,0 +1,51 @@
+import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
+import { tmpdir } from "node:os";
+import { join } from "node:path";
+import type { IncomingMessage, ServerResponse } from "node:http";
+import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
+import { handleSessionsRoutes, type SessionsRouteContext } from "./sessions.js";
+import { getSession, getCurrentSessionId } from "../../agent/pi-runner.js";
+vi.mock("../../agent/pi-runner.js", () => ({
+	getSession: vi.fn(), getCurrentSessionId: vi.fn(), applyWorkspaceCwd: vi.fn(),
+	branchSessionBeforeUserMessage: vi.fn(), createNewSession: vi.fn(), SessionEditError: class extends Error {}, switchSessionFile: vi.fn(),
+}));
+let dir: string;
+let ctx: SessionsRouteContext;
+beforeEach(() => {
+	vi.clearAllMocks();
+	dir = mkdtempSync(join(tmpdir(), "context-usage-route-"));
+	mkdirSync(join(dir, "sessions"));
+	writeFileSync(join(dir, "sessions", "s1.jsonl"), "");
+	ctx = { dataDir: dir, sessionFileFromId: (_dir: string, id: string) => id === "s1.jsonl" ? join(dir, "sessions", id) : null } as SessionsRouteContext;
+	vi.mocked(getCurrentSessionId).mockReturnValue("s1.jsonl");
+	vi.mocked(getSession).mockReturnValue({
+		getContextUsage: () => ({ tokens: null, percent: null, contextWindow: 1000 }),
+	} as never);
+});
+afterEach(() => rmSync(dir, { recursive: true, force: true }));
+async function request(id: string) {
+	let body = "";
+	const res = { statusCode: 0, setHeader: vi.fn(), writeHead(code: number) { this.statusCode = code; }, end(chunk: string) { body = chunk; } };
+	const handled = await handleSessionsRoutes({} as IncomingMessage, res as unknown as ServerResponse, "GET", `/api/sessions/${id}/context-usage`, ctx);
+	return { ...res, handled, data: JSON.parse(body) };
+}
+describe("GET session context usage", () => {
+	it("returns a no-store, session-scoped payload", async () => {
+		const res = await request("s1.jsonl");
+		expect(res.handled).toBe(true);
+		expect(res.statusCode).toBe(200);
+		expect(res.data).toMatchObject({ sessionId: "s1.jsonl", status: "pending", tokens: null });
+		expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
+	});
+	it("never reads another session's live runtime", async () => {
+		vi.mocked(getCurrentSessionId).mockReturnValue("other.jsonl");
+		const res = await request("s1.jsonl");
+		expect(res.data.status).toBe("inactive");
+		expect(res.data.tokens).toBeNull();
+		expect(getSession).not.toHaveBeenCalled();
+	});
+	it("rejects nonexistent sessions", async () => {
+		expect((await request("missing.jsonl")).statusCode).toBe(404);
+		expect(getSession).not.toHaveBeenCalled();
+	});
+});
```

**File**: `apps/inno-agent/src/server/routes/sessions.ts` (modified, +20/-0)
```diff
@@ -1,11 +1,13 @@
 import type { IncomingMessage as HttpReq, ServerResponse } from "node:http";
 import { existsSync, readdirSync, rmSync } from "node:fs";
 import { basename, dirname, join } from "node:path";
+import { buildContextUsage, unavailableContextUsage } from "../../agent/context-usage.js";
 import {
 	applyWorkspaceCwd,
 	branchSessionBeforeUserMessage,
 	createNewSession,
 	getCurrentSessionId,
+	getSession,
 	SessionEditError,
 	switchSessionFile,
 } from "../../agent/pi-runner.js";
@@ -272,6 +274,24 @@ export async function handleSessionsRoutes(
 		runQueueOpWithTimeout,
 	} = ctx;
 
+	// Read-only: never switch the singleton runtime to inspect a different session.
+	const contextMatch = matchRoute("GET", method, url, "/api/sessions/:id/context-usage");
+	if (contextMatch) {
+		const id = contextMatch.id;
+		res.setHeader("Cache-Control", "no-store");
+		const sessionPath = sessionFileFromId(join(dataDir, "sessions"), id);
+		if (!sessionPath || !existsSync(sessionPath)) {
+			json(res, 404, { error: "Session not found" });
+			return true;
+		}
+		if (getCurrentSessionId() !== id) {
+			json(res, 200, unavailableContextUsage(id, "inactive"));
+			return true;
+		}
+		json(res, 200, buildContextUsage(id, getSession()));
+		return true;
+	}
+
 	// --- Sessions API ---
 	if (method === "GET" && url === "/api/sessions") {
 		const sessionDir = join(dataDir, "sessions");
```

**File**: `apps/inno-agent/src/shared/context-usage.ts` (added, +14/-0)
```diff
@@ -0,0 +1,14 @@
+/** Aggregate-only payload: never expose prompt text, tool schemas or message content. */
+export interface SessionContextUsage {
+	sessionId: string;
+	status: "ready" | "pending" | "inactive" | "unavailable";
+	source: "sdk" | "estimated";
+	tokens: number | null;
+	contextWindow: number | null;
+	percent: number | null;
+	breakdown: Array<{
+		id: "system" | "tools" | "messages" | "mcp" | "skills";
+		tokens: number;
+		percent: number;
+	}>;
+}
```

**File**: `apps/inno-agent/web/src/api/sessions.ts` (modified, +9/-0)
```diff
@@ -1,3 +1,4 @@
+import type { SessionContextUsage } from "../../../src/shared/context-usage.js";
 import { apiFetch } from "./client.js";
 import type { ChatMessage } from "../types/chat.js";
 
@@ -141,3 +142,11 @@ export async function unarchiveSession(id: string): Promise<{ id: string; archiv
 		method: "POST",
 	});
 }
+
+export type { SessionContextUsage } from "../../../src/shared/context-usage.js";
+
+export async function fetchSessionContextUsage(id: string, signal?: AbortSignal) {
+	return apiFetch<SessionContextUsage>(
+		`/api/sessions/${encodeURIComponent(id)}/context-usage`, { signal },
+	);
+}
```

**File**: `apps/inno-agent/web/src/i18n/locales/en.json` (modified, +21/-0)
```diff
@@ -1,4 +1,25 @@
 {
+	"contextUsage": {
+		"title": "Context usage",
+		"close": "Close context usage",
+		"summary": "{{percent}} · {{amount}} context used",
+		"used": "Used {{amount}}",
+		"loading": "Loading usage…",
+		"failed": "Could not load usage",
+		"pending": "Awaiting usage after compaction",
+		"inactive": "No live usage for this session",
+		"unavailable": "Usage unavailable",
+		"note": "Pi SDK estimates the total from model usage and subsequent messages. Categories are estimates scaled to that total; percentages use the full context window. Tool results count as messages.",
+		"estimatedNote": "No model usage reported yet. Total and categories are estimates including the system prompt, tool definitions and messages. Percentages use the full context window.",
+		"unknownNote": "Unknown usage is not shown as 0%. Updates automatically after session activation, a model response or reconnection.",
+		"categories": {
+			"system": "System prompt",
+			"tools": "Tools & subagents",
+			"messages": "Messages",
+			"mcp": "Connectors & MCP",
+			"skills": "Skill catalog"
+		}
+	},
 	"workspace": {
 		"title": "Workspace",
 		"switch": "Switch workspace",
```

**File**: `apps/inno-agent/web/src/i18n/locales/zh-CN.json` (modified, +21/-0)
```diff
@@ -1,4 +1,25 @@
 {
+	"contextUsage": {
+		"title": "上下文用量",
+		"close": "关闭上下文用量",
+		"summary": "{{percent}} · {{amount}} 上下文已使用",
+		"used": "已使用 {{amount}}",
+		"loading": "正在读取用量…",
+		"failed": "用量读取失败",
+		"pending": "压缩后等待更新",
+		"inactive": "此会话暂无实时用量",
+		"unavailable": "用量暂不可用",
+		"note": "总量由 Pi SDK 根据模型用量及后续消息估算。分类为按总量校准的估算值，占比以完整上下文窗口为分母；工具返回内容计入对话消息。",
+		"estimatedNote": "尚无模型用量回报，总量和分类均为估算，包含系统提示词、工具定义与消息。占比以完整上下文窗口为分母。",
+		"unknownNote": "未知用量不会显示为 0%。会话激活、模型响应或连接恢复后自动更新。",
+		"categories": {
+			"system": "系统提示词",
+			"tools": "工具及子智能体",
+			"messages": "对话消息",
+			"mcp": "连接器及 MCP",
+			"skills": "技能目录"
+		}
+	},
 	"workspace": {
 		"title": "工作区",
 		"switch": "切换工作区",
```

---

### Incident Patch 12: `d059f255` (2026-09-14)
**Commit Message**: Merge pull request #234 from hhyqhh/fix/sidebar-chrome-overlap

fix(web): adopt reference app's sidebar collapse pattern, fixing brand overlap

**File**: `apps/inno-agent/web/src/app.css` (modified, +36/-12)
```diff
@@ -1414,6 +1414,27 @@ inno-app-shell {
 	color: var(--inno-text);
 }
 
+/* Browsers have no traffic lights beside the toggle, which only renders as
+   the collapsed-state expand button: pull it to the window edge and give it
+   a card chip at every width — the <=960px block merely restyles it for
+   touch. */
+.app-layout--browser {
+	--inno-window-chrome-control-left: 12px;
+	--inno-window-chrome-title-inset: 54px;
+}
+
+.app-layout--browser .inno-window-chrome-button {
+	background: var(--inno-surface);
+	border: 1px solid var(--inno-border);
+	box-shadow: var(--inno-shadow-soft);
+	color: var(--inno-text-muted);
+}
+
+.app-layout--browser .inno-window-chrome-button:hover {
+	background: var(--inno-surface-muted);
+	color: var(--inno-text);
+}
+
 .inno-window-chrome-workspace-button {
 	position: absolute;
 	/* Match the workspace-header action buttons by aligning the shared 30px
@@ -1469,7 +1490,9 @@ inno-app-shell {
 
 /* Keep the sidebar brand row below the traffic lights. The conversation and
    workbench headers intentionally occupy the same top row as the compact
-   window chrome, matching the reference layout's title hierarchy. */
+   window chrome, matching the reference layout's title hierarchy. Browsers
+   need no such offset — their only chrome control is the collapsed-state
+   expand button, which never overlaps the expanded header. */
 .app-layout--desktop .inno-sidebar-header {
 	padding-top: var(--inno-window-chrome-height);
 	-webkit-app-region: drag;
@@ -1498,9 +1521,10 @@ inno-app-shell {
 }
 
 /* Feature pages also start at the window edge when the session rail is
-   collapsed. Keep their titles clear of macOS traffic lights just like the
-   conversation and workspace headers. */
-.app-layout--desktop.app-layout--sidebar-collapsed .inno-feature-header {
+   collapsed. Keep their titles clear of macOS traffic lights — and of the
+   chrome toggle, which also renders in browsers — just like the conversation
+   and workspace headers. */
+.app-layout--sidebar-collapsed .inno-feature-header {
 	padding-left: var(--inno-window-chrome-title-inset);
 }
 
@@ -1673,19 +1697,11 @@ inno-app-shell {
 		--inno-window-chrome-title-inset: calc(64px + env(safe-area-inset-left, 0px));
 	}
 
-	.app-layout--browser .inno-window-chrome-button {
-		background: var(--inno-surface);
-		border: 1px solid var(--inno-border);
-		box-shadow: var(--inno-shadow-soft);
-		color: var(--inno-text-muted);
-	}
-
 	.app-layout--browser .inno-window-chrome-workspace-button {
 		top: var(--inno-window-chrome-control-top);
 		right: calc(8px + env(safe-area-inset-right, 0px));
 	}
 
-	.app-layout--browser .inno-sidebar-header,
 	.app-layout--browser .inno-feature-header,
 	.app-layout--browser .inno-conversation-header,
 	.app-layout--browser .inno-workspace-panel-header {
@@ -1695,6 +1711,14 @@ inno-app-shell {
 		padding-left: var(--inno-window-chrome-title-inset);
 	}
 
+	/* The drawer header shares the safe-area top but needs no toggle inset —
+	   the chrome toggle only renders while the sidebar is collapsed. */
+	.app-layout--browser .inno-sidebar-header {
+		min-height: calc(48px + env(safe-area-inset-top, 0px));
+		padding-top: env(safe-area-inset-top, 0px);
+		padding-bottom: 0;
+	}
+
 	/* Component display rules override Tailwind's layered hidden utility. */
 	.inno-workspace-header-button[aria-pressed] {
 		display: none;
```

**File**: `apps/inno-agent/web/src/react/DesktopWindowChrome.tsx` (modified, +18/-12)
```diff
@@ -1,5 +1,5 @@
 import type { ReactNode } from "react";
-import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from "lucide-react";
+import { PanelLeftOpen, PanelRightClose, PanelRightOpen } from "lucide-react";
 
 interface DesktopWindowChromeProps {
 	showWorkspaceControl: boolean;
@@ -14,6 +14,10 @@ interface DesktopWindowChromeProps {
  * Renderer-owned macOS window chrome. Electron keeps the traffic lights in
  * the hidden title-bar area; the overlay is limited to the renderer control
  * so the page headers below remain reliable drag surfaces and click targets.
+ *
+ * The sidebar toggle only renders while the sidebar is collapsed — the
+ * expanded sidebar carries its own collapse button inside its header, so no
+ * floating control ever overlaps the brand row (reference-app pattern).
  */
 export function DesktopWindowChrome({
 	showWorkspaceControl,
@@ -25,17 +29,19 @@ export function DesktopWindowChrome({
 }: DesktopWindowChromeProps) {
 	return (
 		<div className="inno-window-chrome" aria-label="窗口工具栏">
-			<div className="inno-window-chrome-bar">
-				<button
-					type="button"
-					className="inno-window-chrome-button"
-					title={sidebarCollapsed ? "展开侧栏" : "收起侧栏"}
-					aria-label={sidebarCollapsed ? "展开侧栏" : "收起侧栏"}
-					onClick={onToggleSidebar}
-				>
-					{sidebarCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
-				</button>
-			</div>
+			{sidebarCollapsed ? (
+				<div className="inno-window-chrome-bar">
+					<button
+						type="button"
+						className="inno-window-chrome-button"
+						title="展开侧栏"
+						aria-label="展开侧栏"
+						onClick={onToggleSidebar}
+					>
+						<PanelLeftOpen size={15} />
+					</button>
+				</div>
+			) : null}
 			{btwControl ? (
 				<div className="inno-window-chrome-right-actions">
 					{btwControl}
```

**File**: `apps/inno-agent/web/src/react/SessionSidebar.tsx` (modified, +12/-0)
```diff
@@ -21,6 +21,7 @@ import {
 	ArrowUpDown,
 	Check,
 	GripVertical,
+	PanelLeftClose,
 	ChevronUp,
 	ChevronDown,
 	SquarePen,
@@ -1100,6 +1101,17 @@ export function SessionSidebar({ collapsed }: SessionSidebarProps) {
 						>
 							<RefreshCw size={14} />
 						</button>
+						{/* Collapse lives inside the sidebar header (reference-app
+							pattern); the floating chrome toggle only reappears as the
+							expand button once the rail is hidden. */}
+						<button
+							className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--inno-text-subtle)] transition-colors hover:bg-[var(--inno-surface)] hover:text-[var(--inno-text-muted)]"
+							title={t("sidebar.collapse")}
+							aria-label={t("sidebar.collapse")}
+							onClick={() => appStore.setSidebarCollapsed(true)}
+						>
+							<PanelLeftClose size={14} />
+						</button>
 					</div>
 				</div>
 			</div>
```

---

### Incident Patch 13: `cb02fa18` (2026-09-14)
**Commit Message**: fix(web): adopt the reference app's sidebar collapse pattern

The window-chrome toggle rendered at all times, so in a desktop-width
browser (no traffic lights beside it) the button at left: 96px landed on
the expanded sidebar's "Inno Agent" brand row. The reference harness
splits the two states instead: the expanded sidebar carries its own
collapse button inside its header, and the collapsed state leaves only a
floating expand chip. Adopt that split so no floating control ever
overlaps header content:

- SessionSidebar: add a collapse button (PanelLeftClose, sidebar.collapse)
  to the expanded header's right cluster, next to refresh.
- DesktopWindowChrome: render the sidebar toggle only while collapsed —
  it is now purely the expand button.
- app.css: in browsers pull the expand button to the window edge
  (control-left 12px, title-inset 54px) with the card chip treatment at
  every width, not just <=960px, plus a matching hover rule. The narrow
  browser block drops the now-duplicated chip styles, and the drawer
  header no longer reserves toggle inset (the toggle is hidden while the
  drawer is open).
- Keep the sidebar header's padding-top desktop-only again (Electron
  traffic

**File**: `apps/inno-agent/web/src/app.css` (modified, +36/-12)
```diff
@@ -1414,6 +1414,27 @@ inno-app-shell {
 	color: var(--inno-text);
 }
 
+/* Browsers have no traffic lights beside the toggle, which only renders as
+   the collapsed-state expand button: pull it to the window edge and give it
+   a card chip at every width — the <=960px block merely restyles it for
+   touch. */
+.app-layout--browser {
+	--inno-window-chrome-control-left: 12px;
+	--inno-window-chrome-title-inset: 54px;
+}
+
+.app-layout--browser .inno-window-chrome-button {
+	background: var(--inno-surface);
+	border: 1px solid var(--inno-border);
+	box-shadow: var(--inno-shadow-soft);
+	color: var(--inno-text-muted);
+}
+
+.app-layout--browser .inno-window-chrome-button:hover {
+	background: var(--inno-surface-muted);
+	color: var(--inno-text);
+}
+
 .inno-window-chrome-workspace-button {
 	position: absolute;
 	/* Match the workspace-header action buttons by aligning the shared 30px
@@ -1469,7 +1490,9 @@ inno-app-shell {
 
 /* Keep the sidebar brand row below the traffic lights. The conversation and
    workbench headers intentionally occupy the same top row as the compact
-   window chrome, matching the reference layout's title hierarchy. */
+   window chrome, matching the reference layout's title hierarchy. Browsers
+   need no such offset — their only chrome control is the collapsed-state
+   expand button, which never overlaps the expanded header. */
 .app-layout--desktop .inno-sidebar-header {
 	padding-top: var(--inno-window-chrome-height);
 	-webkit-app-region: drag;
@@ -1498,9 +1521,10 @@ inno-app-shell {
 }
 
 /* Feature pages also start at the window edge when the session rail is
-   collapsed. Keep their titles clear of macOS traffic lights just like the
-   conversation and workspace headers. */
-.app-layout--desktop.app-layout--sidebar-collapsed .inno-feature-header {
+   collapsed. Keep their titles clear of macOS traffic lights — and of the
+   chrome toggle, which also renders in browsers — just like the conversation
+   and workspace headers. */
+.app-layout--sidebar-collapsed .inno-feature-header {
 	padding-left: var(--inno-window-chrome-title-inset);
 }
 
@@ -1673,19 +1697,11 @@ inno-app-shell {
 		--inno-window-chrome-title-inset: calc(64px + env(safe-area-inset-left, 0px));
 	}
 
-	.app-layout--browser .inno-window-chrome-button {
-		background: var(--inno-surface);
-		border: 1px solid var(--inno-border);
-		box-shadow: var(--inno-shadow-soft);
-		color: var(--inno-text-muted);
-	}
-
 	.app-layout--browser .inno-window-chrome-workspace-button {
 		top: var(--inno-window-chrome-control-top);
 		right: calc(8px + env(safe-area-inset-right, 0px));
 	}
 
-	.app-layout--browser .inno-sidebar-header,
 	.app-layout--browser .inno-feature-header,
 	.app-layout--browser .inno-conversation-header,
 	.app-layout--browser .inno-workspace-panel-header {
@@ -1695,6 +1711,14 @@ inno-app-shell {
 		padding-left: var(--inno-window-chrome-title-inset);
 	}
 
+	/* The drawer header shares the safe-area top but needs no toggle inset —
+	   the chrome toggle only renders while the sidebar is collapsed. */
+	.app-layout--browser .inno-sidebar-header {
+		min-height: calc(48px + env(safe-area-inset-top, 0px));
+		padding-top: env(safe-area-inset-top, 0px);
+		padding-bottom: 0;
+	}
+
 	/* Component display rules override Tailwind's layered hidden utility. */
 	.inno-workspace-header-button[aria-pressed] {
 		display: none;
```

**File**: `apps/inno-agent/web/src/react/DesktopWindowChrome.tsx` (modified, +18/-12)
```diff
@@ -1,5 +1,5 @@
 import type { ReactNode } from "react";
-import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from "lucide-react";
+import { PanelLeftOpen, PanelRightClose, PanelRightOpen } from "lucide-react";
 
 interface DesktopWindowChromeProps {
 	showWorkspaceControl: boolean;
@@ -14,6 +14,10 @@ interface DesktopWindowChromeProps {
  * Renderer-owned macOS window chrome. Electron keeps the traffic lights in
  * the hidden title-bar area; the overlay is limited to the renderer control
  * so the page headers below remain reliable drag surfaces and click targets.
+ *
+ * The sidebar toggle only renders while the sidebar is collapsed — the
+ * expanded sidebar carries its own collapse button inside its header, so no
+ * floating control ever overlaps the brand row (reference-app pattern).
  */
 export function DesktopWindowChrome({
 	showWorkspaceControl,
@@ -25,17 +29,19 @@ export function DesktopWindowChrome({
 }: DesktopWindowChromeProps) {
 	return (
 		<div className="inno-window-chrome" aria-label="窗口工具栏">
-			<div className="inno-window-chrome-bar">
-				<button
-					type="button"
-					className="inno-window-chrome-button"
-					title={sidebarCollapsed ? "展开侧栏" : "收起侧栏"}
-					aria-label={sidebarCollapsed ? "展开侧栏" : "收起侧栏"}
-					onClick={onToggleSidebar}
-				>
-					{sidebarCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
-				</button>
-			</div>
+			{sidebarCollapsed ? (
+				<div className="inno-window-chrome-bar">
+					<button
+						type="button"
+						className="inno-window-chrome-button"
+						title="展开侧栏"
+						aria-label="展开侧栏"
+						onClick={onToggleSidebar}
+					>
+						<PanelLeftOpen size={15} />
+					</button>
+				</div>
+			) : null}
 			{btwControl ? (
 				<div className="inno-window-chrome-right-actions">
 					{btwControl}
```

**File**: `apps/inno-agent/web/src/react/SessionSidebar.tsx` (modified, +12/-0)
```diff
@@ -21,6 +21,7 @@ import {
 	ArrowUpDown,
 	Check,
 	GripVertical,
+	PanelLeftClose,
 	ChevronUp,
 	ChevronDown,
 	SquarePen,
@@ -1100,6 +1101,17 @@ export function SessionSidebar({ collapsed }: SessionSidebarProps) {
 						>
 							<RefreshCw size={14} />
 						</button>
+						{/* Collapse lives inside the sidebar header (reference-app
+							pattern); the floating chrome toggle only reappears as the
+							expand button once the rail is hidden. */}
+						<button
+							className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--inno-text-subtle)] transition-colors hover:bg-[var(--inno-surface)] hover:text-[var(--inno-text-muted)]"
+							title={t("sidebar.collapse")}
+							aria-label={t("sidebar.collapse")}
+							onClick={() => appStore.setSidebarCollapsed(true)}
+						>
+							<PanelLeftClose size={14} />
+						</button>
 					</div>
 				</div>
 			</div>
```

---

### Incident Patch 14: `5386ae65` (2026-09-14)
**Commit Message**: Fix mobile layouts for navigation, chat controls, and settings

**File**: `apps/inno-agent/web/src/app.css` (modified, +65/-4)
```diff
@@ -1663,16 +1663,48 @@ inno-app-shell {
 		font-size: max(16px, 1em);
 	}
 
-	.inno-panel-fab {
-		top: calc(8px + env(safe-area-inset-top, 0px));
-		width: 40px;
-		height: 40px;
+	/* The shared toolbar also renders in browsers. Do not reserve macOS
+	   traffic-light space on phones, or the toggle covers the page title. */
+	.app-layout--browser {
+		--inno-window-chrome-height: 48px;
+		--inno-window-chrome-control-left: calc(8px + env(safe-area-inset-left, 0px));
+		--inno-window-chrome-control-size: 44px;
+		--inno-window-chrome-control-top: calc(2px + env(safe-area-inset-top, 0px));
+		--inno-window-chrome-title-inset: calc(64px + env(safe-area-inset-left, 0px));
+	}
+
+	.app-layout--browser .inno-window-chrome-button {
 		background: var(--inno-surface);
 		border: 1px solid var(--inno-border);
 		box-shadow: var(--inno-shadow-soft);
 		color: var(--inno-text-muted);
 	}
 
+	.app-layout--browser .inno-window-chrome-workspace-button {
+		top: var(--inno-window-chrome-control-top);
+		right: calc(8px + env(safe-area-inset-right, 0px));
+	}
+
+	.app-layout--browser .inno-sidebar-header,
+	.app-layout--browser .inno-feature-header,
+	.app-layout--browser .inno-conversation-header,
+	.app-layout--browser .inno-workspace-panel-header {
+		min-height: calc(48px + env(safe-area-inset-top, 0px));
+		padding-top: env(safe-area-inset-top, 0px);
+		padding-bottom: 0;
+		padding-left: var(--inno-window-chrome-title-inset);
+	}
+
+	/* Component display rules override Tailwind's layered hidden utility. */
+	.inno-workspace-header-button[aria-pressed] {
+		display: none;
+	}
+
+	/* Navigation remains an overlay even if the full workspace is open. */
+	.app-layout--browser.app-layout--workspace-full > .workspace-panel {
+		left: 0;
+	}
+
 	/* Three subrow pills (workspace / permission / model) can exceed a phone's
 	   width — let the row scroll horizontally instead of overflowing. */
 	.inno-composer-subrow {
@@ -1690,6 +1722,35 @@ inno-app-shell {
 	}
 }
 
+/* Keep conversation controls in two legible rows instead of letting the
+   non-shrinking model picker paint over permissions and attachments. */
+@media (max-width: 640px) {
+	.inno-composer--conversation .inno-composer-toolbar {
+		flex-wrap: wrap;
+	}
+
+	.inno-composer--conversation .inno-composer-toolbar > div {
+		width: 100%;
+		justify-content: space-between;
+		gap: 4px;
+	}
+}
+
+/* In phone landscape, the vertical navigation otherwise consumes almost
+   all the drawer height, leaving session cards under sticky headers. */
+@media (max-width: 960px) and (max-height: 500px) {
+	.inno-sidebar-scope > nav {
+		display: grid;
+		grid-template-columns: repeat(2, minmax(0, 1fr));
+		gap: 2px;
+		padding-block: 4px;
+	}
+
+	.inno-sidebar-scope > nav > * {
+		margin-block: 0;
+	}
+}
+
 /* Disable transitions while the user is dragging the resize handle */
 .workspace-resizing .app-layout > :nth-child(2),
 .workspace-resizing .app-layout > :nth-child(3) {
```

**File**: `apps/inno-agent/web/src/react/chat/ChatComposer.tsx` (modified, +1/-1)
```diff
@@ -529,7 +529,7 @@ export function ChatComposer({
 	};
 	return (
 		<div
-			className="inno-composer relative"
+			className={`inno-composer relative ${conversationMode ? "inno-composer--conversation" : ""}`}
 			onDragOverCapture={handleComposerDragOver}
 			onDragOver={handleComposerDragOver}
 			onDragLeave={(event) => {
```

**File**: `apps/inno-agent/web/src/react/settings/GeneralSettings.tsx` (modified, +2/-2)
```diff
@@ -11,7 +11,7 @@ function ThemePicker() {
 	const { t } = useTranslation();
 	const state = useStoreSnapshot(themeStore, () => ({ current: themeStore.current }));
 	return (
-		<div className="flex gap-2">
+		<div className="flex flex-wrap gap-2">
 			{THEME_IDS.map((id) => {
 				const active = state.current === id;
 				return (
@@ -22,7 +22,7 @@ function ThemePicker() {
 						aria-pressed={active}
 						title={t(`settings.themeOptions.${id}`)}
 						onClick={() => void themeStore.save(id)}
-						className={`flex items-center gap-2 rounded-full border py-1.5 pl-2 pr-3.5 text-xs transition-colors ${
+						className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border py-1.5 pl-2 pr-3.5 text-xs transition-colors ${
 							active
 								? "border-[var(--inno-accent)] bg-[var(--inno-accent-soft)] font-medium text-[var(--inno-accent)]"
 								: "border-[var(--inno-border)] text-[var(--inno-text-muted)] hover:border-[var(--inno-border-strong)] hover:text-[var(--inno-text)]"
```

**File**: `apps/inno-agent/web/src/react/settings/SettingsOverlay.tsx` (modified, +4/-4)
```diff
@@ -64,21 +64,21 @@ export function SettingsOverlay() {
 				role="dialog"
 				aria-modal="true"
 				aria-label={t("settings.title")}
-				className="relative flex h-[min(680px,88vh)] w-[min(980px,92vw)] overflow-hidden rounded-[20px] bg-[var(--inno-card-bg)] shadow-[0_16px_48px_rgba(0,0,0,0.22)] max-md:h-dvh max-md:w-full max-md:flex-col max-md:rounded-none"
+				className="relative flex h-[min(680px,88vh)] w-[min(980px,92vw)] overflow-hidden rounded-[20px] bg-[var(--inno-card-bg)] shadow-[0_16px_48px_rgba(0,0,0,0.22)] max-md:h-[var(--inno-viewport-height,100dvh)] max-md:w-full max-md:flex-col max-md:rounded-none"
 				onClick={(event) => event.stopPropagation()}
 			>
 				<button
 					type="button"
 					onClick={() => appStore.closeSettings()}
 					title={t("common.close")}
 					aria-label={t("common.close")}
-					className="absolute right-3.5 top-3.5 z-[5] flex h-[30px] w-[30px] items-center justify-center rounded-full text-[var(--inno-text-subtle)] transition-colors hover:bg-[var(--inno-surface-muted)] hover:text-[var(--inno-text)]"
+					className="absolute right-3.5 top-3.5 z-[5] max-md:right-2 max-md:top-[calc(7px+env(safe-area-inset-top,0px))] max-md:h-11 max-md:w-11 max-md:bg-[var(--inno-sidebar-bg)] flex h-[30px] w-[30px] items-center justify-center rounded-full text-[var(--inno-text-subtle)] transition-colors hover:bg-[var(--inno-surface-muted)] hover:text-[var(--inno-text)]"
 				>
 					<X size={17} />
 				</button>
 
 				{/* Left nav — horizontal tab strip on phones, icon rail on narrow desktop */}
-				<aside className="flex w-[208px] shrink-0 flex-col gap-0.5 overflow-y-auto bg-[var(--inno-sidebar-bg)] px-3 py-5 md:max-[820px]:w-[64px] md:max-[820px]:px-2 max-md:w-full max-md:flex-row max-md:items-center max-md:overflow-x-auto max-md:overflow-y-hidden max-md:py-2 max-md:pr-12">
+				<aside className="flex w-[208px] shrink-0 flex-col gap-0.5 overflow-y-auto bg-[var(--inno-sidebar-bg)] px-3 py-5 md:max-[820px]:w-[64px] md:max-[820px]:px-2 max-md:w-full max-md:flex-row max-md:items-center max-md:overflow-x-auto max-md:overflow-y-hidden max-md:pb-2 max-md:pt-[calc(8px+env(safe-area-inset-top,0px))] max-md:pr-16">
 					<div className="px-3 pb-3 text-sm font-semibold text-[var(--inno-text)] md:max-[820px]:hidden max-md:hidden">{t("settings.title")}</div>
 					{TABS.map(({ id, icon }) => {
 						const active = activeSettingsTab === id;
@@ -102,7 +102,7 @@ export function SettingsOverlay() {
 				</aside>
 
 				{/* Content */}
-				<div className="min-w-0 flex-1 overflow-y-auto px-[26px] pb-8 pt-[22px] max-md:px-4">
+				<div className="min-w-0 flex-1 overflow-y-auto px-[26px] pb-8 pt-[22px] max-md:px-4 max-md:pb-[calc(32px+env(safe-area-inset-bottom,0px))]">
 					{!settings && isLoading ? (
 						<div className="text-sm text-[var(--inno-text-muted)]">{t("settings.loading")}</div>
 					) : (
```

**File**: `apps/inno-agent/web/src/react/settings/primitives.tsx` (modified, +3/-3)
```diff
@@ -36,12 +36,12 @@ export function SettingsRow({ label, description, control, disabled }: {
 	disabled?: boolean;
 }) {
 	return (
-		<div className={`flex items-start justify-between gap-3 ${disabled ? "opacity-60" : ""}`}>
-			<div className="min-w-0">
+		<div className={`flex flex-wrap items-start justify-between gap-3 ${disabled ? "opacity-60" : ""}`}>
+			<div className="min-w-0 flex-[1_1_160px]">
 				<h4 className="text-sm font-medium text-[var(--inno-text)]">{label}</h4>
 				{description ? <p className="mt-1 text-sm text-[var(--inno-text-muted)]">{description}</p> : null}
 			</div>
-			{control}
+			<div className="max-w-full shrink-0">{control}</div>
 		</div>
 	);
 }
```

**File**: `docs/mobile-layout-review-2026-09-14.md` (added, +44/-0)
```diff
@@ -0,0 +1,44 @@
+# Mobile layout recheck — 2026-09-14
+
+## Verification
+
+- Chromium, isolated profile, touch/mobile emulation against the local Vite frontend and existing backend.
+- Viewports: 320×568, 375×667, 390×844, 430×932, 768×1024, 844×390, 960×800, 1440×900 (desktop control).
+- 135 layout/interaction states passed: welcome composer, model menu and dismissal, workspace, simultaneous workspace/sidebar, scrim dismissal, all eight settings categories, notebook, skills, learner profile, jobs, existing conversation, synthetic visual viewport resize.
+- Existing long conversation additionally checked at 320×568, 390×844 and 844×390: message scroll area, input, model menu and input visibility with a synthetic 240px visual viewport. No messages sent or settings saved.
+- Frontend Vitest: 39 files / 309 tests passed.
+- `npm --workspace inno-agent-web run build`: passed, including TypeScript.
+
+## Fixes
+
+| Before | After | Why |
+| --- | --- | --- |
+| Mobile CSS targeted a retired toolbar class; actual sidebar toggle retained a 96px macOS inset and overlapped feature titles. | Browser/mobile toolbar uses a left-edge 44px touch target with matching header spacing. Desktop chrome remains unchanged. | Keep navigation and titles separately readable/clickable. |
+| Opening the sidebar while the full workspace was visible shifted and squeezed the workspace. | Full workspace stays edge-to-edge behind the drawer. | Drawer should overlay rather than resize content. |
+| Workspace size toggle remained visible because component display CSS overrode Tailwind's hidden utility. | Explicit narrow-screen display rule hides the size toggle. | Mobile has only a full-width workspace. |
+| Small settings cards squeezed description text and theme labels into narrow columns. | Setting controls wrap below labels as space requires; theme labels do not shrink or wrap internally. | Preserve legibility at 320px. |
+| Settings close button visually merged into the scrolling tab strip; modal height ignored the app's visual viewport variable. | Solid 44px mobile close button, safe-area padding and visual-viewport-aware height. | Keep dismissal discoverable and content reachable when the viewport shrinks. |
+| Active conversation composer controls painted over each other. | Two toolbar rows at widths up to 640px, scoped to conversations only. | Preserve attachment, permission, workspace, newline, model and send controls without overlap. |
+| Landscape drawer navigation consumed almost the entire height, making session cards difficult to tap. | Two-column navigation at narrow widths with height up to 500px. | Leave a usable session-list area. |
+
+## Repeatable browser smoke test
+
+`scripts/mobile-layout-smoke.cjs` uses an externally supplied Playwright installation; no production dependencies added.
+
+```sh
+PLAYWRIGHT_MODULE=/absolute/path/to/playwright \
+CHROMIUM_PATH=/absolute/path/to/chromium \
+MOBILE_TEST_URL=http://localhost:5173 \
+MOBILE_TEST_OUTPUT=/tmp/inno-mobile-smoke \
+MOBILE_TEST_SESSION_TITLE='an existing conversation title' \
+node scripts/mobile-layout-smoke.cjs
+```
+
+The session title is optional (128 states without it; 135 with it). The script asserts document width, menu bounds, mobile toolbar geometry, drawer/workspace placement, settings bounds, title separation and conversation button overlap. Screenshots and JSON results are written outside the repository by default. Conversation screenshots may contain local user content; do not commit or publish them without review.
+
+## Limits
+
+- Chromium emulation is not a physical iPhone/Android test, nor a Safari/WebKit compatibility test.
+- Synthetic `visualViewport` changes validate resize handling only, not real keyboard panning, browser address-bar behavior, pinch zoom or notch safe-area rendering.
+- The test checks layout/interactions, not model inference, uploads, task execution, saving settings or every document format.
+- Some remote preset data can still be loading at screenshot time; passing layout assertions does not validate that remote service.
```

**File**: `docs/pr231-review.md` (added, +213/-0)
```diff
@@ -0,0 +1,213 @@
+# PR #231 评审报告
+
+## 1. 评审范围与结论
+
+- **PR**：#231 — `feat: refine workspace, BTW, and desktop/browser UI`
+- **评审分支**：`pr-231`
+- **评审提交**：`9ac43b5b0d6af59e75f8da5543f7c56d486a9bc6`
+- **比较基线**：`cc485280305a4e711bf2a4324dce52435d1e95d8`
+- **变更规模**：38 个文件，新增 2840 行、删除 449 行。
+- **范围**：代码审查、自动化测试、构建、针对性回归复现，以及隔离环境中的前端交互测试。
+
+**结论：建议修复已确认的数据丢失问题和三项前端交互问题后再合并，并补充桌面端入口验证。** 原有测试和构建均通过，但不能覆盖本次发现的状态恢复、功能入口和多标签交互缺陷。
+
+本报告只对上述提交负责，不代表后续版本仍存在同样问题。评审未修改业务代码，也未调用真实模型。
+
+## 2. 问题总览
+
+| 编号 | 优先级 | 问题 | 证据与归属 |
+| --- | --- | --- | --- |
+| R1 | P1 | BTW 首次加载失败后可能覆盖持久化历史 | 针对性回归复现；真实磁盘存储，传输层模拟一次 GET 失败 |
+| R2 | P2 | 已有会话丢失工作区切换入口 | 基线组件对照、代码检查、浏览器实测；PR 回归 |
+| R3 | P2 | BTW 删除确认框没有正确管理键盘焦点，Esc 无法取消 | 浏览器实测及代码检查；新增交互缺陷 |
+| R4 | P2 | 新建多个 BTW 标签后活动标签被裁切 | 浏览器实测及几何测量；新增多标签交互缺陷 |
+| R5 | 待验证 | 桌面端非聊天页面可能保留无效 BTW 入口 | 静态代码检查；尚未在 Electron 中实测 |
+| R6 | 改进项 | 窄窗口下“打开工作区”没有响应或提示 | 浏览器实测；核心布局限制早于本 PR，不计作新增回归 |
+
+优先级说明：P1 应优先修复，存在数据丢失风险；P2 为应修复的功能或交互缺陷。“待验证”和“改进项”不等同于已确认的 PR 回归。
+
+## 3. 已确认问题
+
+### R1 · [P1] BTW 首次加载失败后可能覆盖持久化历史
+
+**代码位置**：`/Users/haohao/local path/project/inno-agent-open/apps/inno-agent/web/src/stores/btw-store.ts:154–159`
+
+#### 问题
+
+`hydrateSession()` 在首次 GET 失败后把会话设置为空状态，并将其标记为已完成加载。之后 `openOrRestore()` 不再重新获取原有状态，而是创建新标签；随后的整会话 PUT 可能用新状态覆盖服务器上的原有标签、草稿和问答。
+
+#### 复现与证据
+
+1. 在真实后端 sidecar 存储中写入已有 BTW 标签、草稿和问答。
+2. 在传输层模拟首次 GET 失败。
+3. 打开 BTW，触发创建标签及后续持久化。
+4. 清除后端缓存后重新读取磁盘，确认原有内容已被覆盖。
+
+此复现使用模拟 API 传输，但落盘和磁盘回读是真实的；不是一次完整浏览器断网测试。
+
+#### 影响与建议
+
+- 短暂网络故障可能升级为不可逆的数据丢失，不能把“加载失败”等同于“服务端没有历史”。
+- 失败时保留未加载状态，允许重试，并在前端显示恢复或重试提示。
+- 在旧状态成功加载前禁止整会话覆盖式保存；如需支持离线修改，应设计安全合并机制。
+- 补充“首次加载失败 → 重试 → 原有历史仍完整”的回归测试。
+
+### R2 · [P2] 已有会话丢失工作区切换入口
+
+**代码位置**：
+
+- `/Users/haohao/local path/project/inno-agent-open/apps/inno-agent/web/src/react/ChatCenter.tsx:1384–1386`
+- `/Users/haohao/local path/project/inno-agent-open/apps/inno-agent/web/src/react/chat/ChatComposer.tsx:553–560`
+
+#### 问题与复现
+
+1. 在欢迎页可以看到工作区选择器。
+2. 进入已有会话后，输入框不再提供该选择器。
+3. 顶部工作区标签是静态展示，不能作为替代切换入口。
+
+`ChatCenter` 只在欢迎页传入 `workspaceControl`，`ChatComposer` 也在会话模式隐藏对应行。已有会话的工作区绑定处理逻辑仍存在，但缺少可达的交互入口。
+
+基线组件对照确认：旧版本会话组件可显示选择器，PR 会话组件不再显示；欢迎页正向对照仍正常。浏览器检查与该结果一致。
+
+#### 影响与建议
+
+- 用户无法通过原有路径切换已有会话的工作区，也失去了对应的创建／导入入口。
+- 除非产品明确禁止已有会话切换工作区，否则应在会话头部或其他可发现位置恢复入口。
+- 补充已有会话打开选择器及完成切换的交互测试，而不只验证欢迎页。
+
+### R3 · [P2] BTW 删除确认框缺少键盘焦点管理
+
+**代码位置**：`/Users/haohao/local path/project/inno-agent-open/apps/inno-agent/web/src/react/BtwPanel.tsx:523–530`
+
+#### 复现与证据
+
+1. 打开 BTW，输入一段草稿。
+2. 点击当前标签的关闭按钮，出现“关闭并删除”确认框。
+3. 检查 `document.activeElement`：焦点仍停在遮罩后的关闭标签按钮，不在 `role="alertdialog"` 内。
+4. 按 Esc，确认框仍然存在。
+
+代码声明了 `aria-modal="true"`，但没有配套的初始焦点、焦点限制及恢复逻辑；外层 Escape 处理只清理拖拽／缩放状态，不取消确认框。点击“取消”可以正常关闭确认框并保留草稿。
+
+#### 影响与建议
+
+这是涉及永久删除的确认操作。视觉上弹窗已出现，键盘焦点却仍留在背景，容易使用户无法判断当前操作目标。
+
+- 复用具备完整焦点管理的模态框组件。
+- 默认聚焦“取消”，将键盘焦点限制在确认框内。
+- 支持 Esc 取消，关闭后把焦点恢复到合理的触发位置。
+- 补充焦点、Esc、Tab 循环和关闭后焦点恢复测试。
+
+本次未实际执行删除，也未验证背景误发送；不将这些潜在后果作为已复现事实。
+
+### R4 · [P2] 新建多个 BTW 标签后活动标签被裁切
+
+**代码位置**：
+
+- `/Users/haohao/local path/project/inno-agent-open/apps/inno-agent/web/src/react/BtwPanel.tsx:378–387`
+- `/Users/haohao/local path/project/inno-agent-open/apps/inno-agent/web/src/react/BtwPanel.tsx:175–183`
+
+#### 复现与证据
+
+1. 保持 BTW 窗口默认约 520 CSS px 的宽度。
+2. 连续创建标签，直到第 6 个。
+3. 内容已切换到第 6 个标签，但其名称和关闭按钮被标签栏右边界裁切。
+
+浏览器测量结果：标签栏右边界约为 `1097.43`，第 6 个活动标签的左右边界约为 `1069.35–1168.51`。截图也确认了裁切现象。
+
+活动标签变化时，组件会聚焦输入框，但没有同步把活动标签滚动到可见区域。
+
+#### 影响与建议
+
+- 用户已经进入新标签，却无法完整看到标签名称和关闭入口，需要额外手动横向滚动。
+- 新建、切换或恢复活动标签后，应自动将其滚动到可见区域。
+- 建议把“＋”按钮固定在横向滚动区外，避免标签越多越难发现创建入口。
+- 补充标签溢出、窄窗口及恢复活动标签的交互测试。
+
+## 4. 待验证风险与原有体验问题
+
+### R5 · 桌面端非聊天页面可能保留无效 BTW 入口
+
+**代码位置**：`/Users/haohao/local path/project/inno-agent-open/apps/inno-agent/web/src/react/App.tsx:49–56`
+
+`desktopBtwControl` 的显示条件包含桌面环境、工作区收起和当前会话存在，但没有要求 `app.page === "chat"`。另一方面，进入技能仓库等功能页后，`ChatCenter` 及其 BTW 浮窗不再挂载。
+
+因此，从代码路径判断：有当前会话且工作区收起时，切换到功能页可能仍看到 BTW 按钮，点击却没有浮窗出现。
+
+**证据边界**：这是静态检查发现，尚未跑实际 Electron 交互，不应表述为已经完成桌面端复现。
+
+**建议**：限制入口仅在聊天页出现，或将浮窗提升到全局挂载；补测“聊天页 → 功能页 → 点击 BTW → 返回聊天页”的完整路径。
+
+### R6 · 窄窗口下打开工作区无反馈
+
+**相关代码**：
+
+- `/Users/haohao/local path/project/inno-agent-open/apps/inno-agent/web/src/stores/app-layout.ts`
+- `/Users/haohao/local path/project/inno-agent-open/apps/inno-agent/web/src/react/App.tsx:195–215`
+
+#### 实测结果
+
+- 实际 CSS 视口宽度 `889px`：点击“打开工作区”后，工作区仍收起，按钮状态不变，也没有可见提示。
+- 实际 CSS 视口宽度 `1111px`：工作区可以展开，并自动收起侧栏。
+
+布局逻辑要求聊天区域至少 800px、最窄工作区至少 240px。空间不足时不能打开分栏，但界面没有向用户说明原因。
+
+**归属说明**：核心最小宽度限制早于本 PR，因此记为原有体验问题，不列作 PR 新增回归。
+
+**建议**：空间不足时自动切换为覆盖式工作区；如果产品不支持覆盖模式，至少明确提示需要扩大窗口，而不是让可点击按钮无反馈。
+
+## 5. 测试结果
+
+### 自动化与构建
+
+| 检查 | 结果 | 说明 |
+| --- | --- | --- |
+| `npm test` | 81 个测试文件、636 项测试通过 | 首次沙箱运行遇到本地监听 EPERM；授权后重跑通过 |
+| `npm run build` | 通过 | 后端 TypeScript、前端 TypeScript／Vite 构建通过 |
+| `git diff --check cc485280305a4e711bf2a4324dce52435d1e95d8 HEAD` | 通过 | 未发现该检查覆盖的空白格式问题 |
+| 临时补充回归测试 | 2 项正向对照通过，2 项回归断言失败 | 失败项对应 R1、R2，不是原有 636 项测试失败 |
+
+### 浏览器交互验证
+
+测试使用本地隔离服务、合成会话 A／B 和 dummy 模型配置，没有提交真实模型请求。
+

```

**File**: `scripts/mobile-layout-smoke.cjs` (added, +140/-0)
```diff
@@ -0,0 +1,140 @@
+/**
+ * Read-only responsive browser regression (does not send chats or save settings).
+ * Start the web dev server first. Supply Playwright externally, without adding
+ * a production dependency: PLAYWRIGHT_MODULE=/path/to/playwright node scripts/mobile-layout-smoke.cjs
+ * Optional: MOBILE_TEST_URL, MOBILE_TEST_OUTPUT, CHROMIUM_PATH, MOBILE_TEST_SESSION_TITLE.
+ */
+const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
+const assert = require('node:assert/strict');
+const fs = require('node:fs/promises');
+const path = require('node:path');
+const os = require('node:os');
+const base = process.env.MOBILE_TEST_URL || 'http://localhost:5173';
+const output = process.env.MOBILE_TEST_OUTPUT || path.join(os.tmpdir(), 'inno-mobile-smoke');
+const sizes = [[320,568],[375,667],[390,844],[430,932],[768,1024],[844,390],[960,800],[1440,900]];
+
+(async () => {
+  await fs.mkdir(output, { recursive: true });
+  const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), args: ['--disable-gpu'] });
+  const results = [];
+  try {
+    for (const [width, height] of sizes) {
+      const context = await browser.newContext({ viewport: { width, height }, isMobile: width <= 960, hasTouch: width <= 960, deviceScaleFactor: 1 });
+      const page = await context.newPage();
+      const errors = [];
+      page.on('pageerror', error => errors.push(error.message));
+      const check = async (name) => {
+        await page.waitForTimeout(280);
+        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${width} ${name}: document overflow`);
+        results.push({ width, height, name });
+      };
+      const screenshot = name => page.screenshot({ path: path.join(output, `${width}x${height}-${name}.png`) });
+      const inside = async locator => {
+        const box = await locator.boundingBox();
+        assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1, 'control outside viewport');
+      };
+      const openSidebar = async () => {
+        const toggle = page.getByRole('button', { name: '展开侧栏', exact: true });
+        if (await toggle.count()) await toggle.click();
+      };
+      await page.goto(base);
+      await page.getByRole('button', { name: '选择模型', exact: true }).waitFor();
+      await check('home');
+      if (width <= 960) {
+        const toggle = page.getByRole('button', { name: '展开侧栏', exact: true });
+        const box = await toggle.boundingBox();
+        assert.ok(box.x < 20 && box.width >= 44 && box.height >= 44, 'mobile toolbar position / touch target');
+        const input = page.locator('textarea').first();
+        assert.ok(await input.evaluate(e => parseFloat(getComputedStyle(e).fontSize) >= 16), 'composer font under 16px');
+        await input.fill('移动端布局测试（不发送）');
+        await input.fill('');
+      }
+      await screenshot('home');
+      await page.getByRole('button', { name: '选择模型', exact: true }).click();
+      const menu = page.getByRole('menu');
+      if (await menu.count()) {
+        await inside(menu);
+        await screenshot('model-menu');
+        await page.keyboard.press('Escape');
+        assert.equal(await menu.count(), 0);
+        await check('model-menu');
+      }
+      await page.getByRole('button', { name: '打开工作区', exact: true }).click();
+      await check('workspace');
+      if (width <= 960) {
+        const box = await page.locator('.workspace-panel').boundingBox();
+        assert.equal(box.x, 0);
+        assert.equal(Math.round(box.width), width);
+        assert.equal(await page.locator('.inno-workspace-header-button[aria-pressed]').isVisible(), false);
+        await openSidebar();
+        await check('workspace-with-sidebar');
+        assert.equal((await page.locator('.workspace-panel').boundingBox()).x, 0);
+        await page.locator('.app-layout-scrim').click({ position: { x: width - 5, y: height / 2 } });
+        await page.getByRole('button', { name: '展开侧栏', exact: true }).waitFor();
+      }
+      await screenshot('workspace');
+      await page.getByRole('button', { name: '收起工作区', exact: true }).click();
+      await openSidebar();
+      await page.getByRole('button', { name: 'IA Inno Agent' }).click();
+      await page.getByRole('button', { name: '设置', exact: true }).click();
+      const dialog = page.getByRole('dialog');
+      for (const tab of ['通用','模型','记忆','集成','渠道','MCP','实验室','关于']) {
+        await dialog.locator('aside button').filter({ hasText: tab }).click();
+        await check(`settings-${tab}`);
+        assert.equal(await dialog.evaluate(e => e.scrollWidth <= e.clientWidth), true, 'settings horizontal overflow');
+        await inside(dialog.getByRole('button', { name: '关闭', exact: true }));
+        if (tab === '通用') await screenshot('settings');
+      }
+      await dialog.getByRole('but
```

---

### Incident Patch 15: `ad1f883c` (2026-09-13)
**Commit Message**: Fix mobile layout, composer focus, and model picker positioning

**File**: `apps/inno-agent/web/src/app.css` (modified, +30/-4)
```diff
@@ -1652,6 +1652,11 @@ inno-app-shell {
  *    safe-area-aware placement.
  */
 @media (max-width: 960px) {
+	.inno-feature-header,
+	.inno-workspace-panel-header {
+		padding-left: 64px;
+	}
+
 	input,
 	textarea,
 	select {
@@ -2007,8 +2012,19 @@ inno-workspace-panel textarea {
 	height: 100%;
 }
 
-/* docx: docx-preview lays out fixed-width A4 pages. Let the wrapper shrink to
-   the panel and scale each page down proportionally on narrow previews. */
+/* Reflow DOCX pages to the panel width. On narrow panels, also reduce the
+   original print margins; retaining e.g. 120px on each side leaves only a
+   few characters of usable text on a phone. */
+.docx-host {
+	container-type: inline-size;
+}
+
+@container (max-width: 640px) {
+	.docx-host .docx-wrapper > section.docx {
+		padding-inline: 24px !important;
+	}
+}
+
 .docx-host .docx-wrapper {
 	width: 100%;
 	max-width: 100%;
@@ -4375,7 +4391,19 @@ button.inno-smart-ref-chip:hover {
 	--inno-smart-font-size: 14px;
 	--inno-smart-line-height: 20px;
 }
+/* Keep the editable source, painted mirror and measurement probes on the
+   same mobile metrics. A generic textarea rule is not enough: the active
+   smart-input selector below has higher specificity and used to restore
+   14px, triggering focus zoom on iOS. Keep pinch-to-zoom available. */
+@media (max-width: 960px), (pointer: coarse) {
+	.inno-smart-wrap {
+		--inno-smart-font-size: 16px;
+		--inno-smart-line-height: 24px;
+	}
+}
 .inno-smart-wrap .inno-composer-textarea {
+	font-size: var(--inno-smart-font-size);
+	line-height: var(--inno-smart-line-height);
 	position: relative;
 	z-index: 2;
 	background: transparent;
@@ -4387,8 +4415,6 @@ button.inno-smart-ref-chip:hover {
 .inno-smart-wrap.is-active textarea.inno-composer-textarea {
 	color: transparent;
 	caret-color: var(--inno-accent);
-	font-size: var(--inno-smart-font-size);
-	line-height: var(--inno-smart-line-height);
 }
 /* The textarea is only the editable source layer. Let the mirror paint the
    selection, otherwise the browser highlights hidden token markers instead of
```

**File**: `apps/inno-agent/web/src/react/ChatCenter.tsx` (modified, +2/-2)
```diff
@@ -1071,7 +1071,7 @@ export function ChatCenter({ onOpenPresetPanels, onPreviewFile }: ChatCenterProp
 		const el = inputRef.current;
 		if (el) {
 			el.value = text;
-			el.focus();
+			el.focus({ preventScroll: true });
 			// Programmatic value assignment fires no input event, and while smart
 			// input is enabled the textarea's own text is transparent — without an
 			// explicit sync the mirror stays stale and the draft renders invisible
@@ -1260,7 +1260,7 @@ export function ChatCenter({ onOpenPresetPanels, onPreviewFile }: ChatCenterProp
 		if (!block || !el) return;
 		const start = Math.min(el.selectionStart, el.value.length);
 		const end = Math.min(el.selectionEnd, el.value.length);
-		el.focus();
+		el.focus({ preventScroll: true });
 		el.setRangeText(block.text, start, end, "end");
 		draftRef.current = el.value;
 		setDraftValue(el.value);
```

**File**: `apps/inno-agent/web/src/react/FeaturePage.tsx` (modified, +1/-1)
```diff
@@ -51,7 +51,7 @@ export function FeaturePage({ page }: { page: FeaturePageId }) {
 	const { t } = useTranslation();
 	return (
 		<div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-[var(--inno-background)]">
-		<header className="inno-feature-header flex shrink-0 items-center justify-between gap-2 border-b border-[var(--inno-border)] px-5 py-3">
+			<header className="inno-feature-header flex shrink-0 items-center justify-between gap-2 border-b border-[var(--inno-border)] px-5 py-3">
 				<h1 className="text-[15px] font-medium text-[var(--inno-text)]">{t(PAGE_TITLE_KEYS[page])}</h1>
 			</header>
 			<div className="min-h-0 flex-1 overflow-y-auto">
```

**File**: `apps/inno-agent/web/src/react/SkillsPanel.tsx` (modified, +7/-7)
```diff
@@ -368,7 +368,7 @@ function SkillCard({ skill, category, onClick }: { skill: SkillInfo; category: s
 	const tone = tileToneFor(category);
 	return (
 		<button
-			className="flex items-center gap-3 rounded-[14px] border border-[var(--inno-border)] bg-[var(--inno-card-bg)] px-4 py-3.5 text-left transition-shadow hover:shadow-[var(--inno-shadow-soft)]"
+			className="flex min-w-0 w-full items-center gap-3 overflow-hidden rounded-[14px] border border-[var(--inno-border)] bg-[var(--inno-card-bg)] px-4 py-3.5 text-left transition-shadow hover:shadow-[var(--inno-shadow-soft)]"
 			onClick={onClick}
 		>
 			<span
@@ -492,8 +492,8 @@ export function SkillsPanel({ dndManager }: { dndManager: DragDropManager }) {
 							</button>
 						))}
 					</div>
-					<div className="flex items-center gap-2">
-						<div className="flex w-[220px] items-center gap-2 rounded-[18px] border border-[var(--inno-border)] bg-[var(--inno-card-bg)] px-3.5 py-[7px] max-md:w-full">
+					<div className="flex min-w-0 items-center gap-2 max-md:w-full">
+						<div className="flex min-w-0 w-[220px] items-center gap-2 rounded-[18px] border border-[var(--inno-border)] bg-[var(--inno-card-bg)] px-3.5 py-[7px] max-md:flex-1">
 							<Search size={15} className="shrink-0 text-[var(--inno-text-subtle)]" />
 							<input
 								type="text"
@@ -513,15 +513,15 @@ export function SkillsPanel({ dndManager }: { dndManager: DragDropManager }) {
 							) : null}
 						</div>
 						<button
-							className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--inno-text-muted)] hover:bg-[var(--inno-surface-muted)] hover:text-[var(--inno-text)]"
+							className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--inno-text-muted)] hover:bg-[var(--inno-surface-muted)] hover:text-[var(--inno-text)]"
 							title={isLibraryTab ? t("skills.reload") : t("preview.refresh", "Refresh")}
 							onClick={() => void (isLibraryTab ? skillsStore.loadLibrary(true) : skillsStore.reload())}
 						>
 							<RefreshCw size={15} />
 						</button>
 						<input ref={uploadRef} type="file" className="hidden" accept=".zip,application/zip,.md,text/markdown,text/plain" onChange={handleUpload} />
 						<button
-							className="flex h-8 items-center gap-1.5 rounded-[10px] inno-primary-button px-3.5 text-[13px] text-white disabled:opacity-50"
+							className="flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[10px] inno-primary-button px-3.5 text-[13px] text-white disabled:opacity-50"
 							disabled={state.isUploading}
 							title={state.isUploading ? t("skills.uploading") : t("skills.upload")}
 							onClick={() => uploadRef.current?.click()}
@@ -601,15 +601,15 @@ export function SkillsPanel({ dndManager }: { dndManager: DragDropManager }) {
 								</span>
 								<span className="text-[12.5px] text-[var(--inno-text-subtle)]">· {items.length}</span>
 							</div>
-							<div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
+							<div className="grid min-w-0 grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
 								{isLibraryTab
 									? (items as SkillLibraryItem[]).map((item) => {
 											const isImporting = state.importing.has(item.name);
 											const tone = tileToneFor(category);
 											return (
 												<div
 													key={item.name}
-													className="flex items-center gap-3 rounded-[14px] border border-[var(--inno-border)] bg-[var(--inno-card-bg)] px-4 py-3.5"
+													className="flex min-w-0 w-full items-center gap-3 overflow-hidden rounded-[14px] border border-[var(--inno-border)] bg-[var(--inno-card-bg)] px-4 py-3.5"
 												>
 													<span
 														className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px]"
```

**File**: `apps/inno-agent/web/src/react/chat/ChatComposer.model-menu.test.tsx` (added, +97/-0)
```diff
@@ -0,0 +1,97 @@
+// @vitest-environment jsdom
+import { createRef } from "react";
+import { cleanup, fireEvent, render, screen } from "@testing-library/react";
+import { afterEach, describe, expect, it, vi } from "vitest";
+import { ChatComposer, type ChatComposerProps } from "./ChatComposer.js";
+import type { InnoModelInfo } from "../../types/settings.js";
+
+vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
+afterEach(cleanup);
+
+const model: InnoModelInfo = {
+	id: "test-model", name: "Test model", provider: "test", reasoning: false,
+	input: ["text"], contextWindow: 4096, maxTokens: 1024,
+};
+function props(): ChatComposerProps {
+	return {
+		inputRef: createRef(), fileInputRef: createRef(), imageInputRef: createRef(),
+		mirrorRef: createRef(), hitRef: createRef(), placeholder: "Message", defaultValue: "",
+		inlineImages: [], pasteBlocks: [], uploadChips: null,
+		modelState: { models: [model], defaultProvider: model.provider, defaultModel: model.id,
+			currentModelSupportsNativeImages: false, isSavingModel: false },
+		modelOptions: [model], currentModel: model, modelPickerOpen: true, attachMenuOpen: false,
+		workspaceFiles: [], smartInputEnabled: false, chatIsSending: false, canReconnect: false,
+		isUploading: false, hasSendableContent: false, hasPendingQuestion: false,
+		onInput: vi.fn(), onCompositionStart: vi.fn(), onCompositionEnd: vi.fn(), onKeyDown: vi.fn(),
+		onPaste: vi.fn(), onFiles: vi.fn(), onImageFiles: vi.fn(), onRemoveInlineImage: vi.fn(),
+		onShowPasteInTextField: vi.fn(), onRemovePasteBlock: vi.fn(), onToggleModelPicker: vi.fn(),
+		onCloseModelPicker: vi.fn(), onModelSelect: vi.fn(), onOpenModelSettings: vi.fn(),
+		onToggleAttachMenu: vi.fn(), onCloseAttachMenu: vi.fn(), onPickWorkspaceFiles: vi.fn(),
+		onDropFiles: vi.fn(), onSend: vi.fn(), onStop: vi.fn(), onReconnect: vi.fn(),
+	};
+}
+
+describe("ChatComposer portaled model menu", () => {
+	it("inserts a newline without asking the browser to scroll the page on focus", () => {
+		const p = props();
+		render(<ChatComposer {...p} modelPickerOpen={false} />);
+		const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
+		const focus = vi.spyOn(textarea, "focus");
+		fireEvent.click(screen.getByRole("button", { name: "chat.insertNewline" }));
+		expect(textarea.value).toBe("\n");
+		expect(focus).toHaveBeenCalledWith({ preventScroll: true });
+		focus.mockRestore();
+	});
+
+	it("escapes the composer's overflow clipping parent", () => {
+		const { container } = render(<div style={{ overflow: "auto", height: 40 }}><ChatComposer {...props()} /></div>);
+		const menu = screen.getByRole("menu", { name: "chat.selectModel" });
+		expect(menu.parentElement).toBe(document.body);
+		expect(container.contains(menu)).toBe(false);
+		expect(menu.style.position).toBe("fixed");
+	});
+
+	it("does not dismiss before a portaled option can be selected", () => {
+		const p = props();
+		render(<ChatComposer {...p} />);
+		const option = screen.getByRole("menuitemradio", { name: "Test model" });
+		fireEvent.pointerDown(option);
+		expect(p.onCloseModelPicker).not.toHaveBeenCalled();
+		fireEvent.click(option);
+		expect(p.onModelSelect).toHaveBeenCalledWith(model);
+		fireEvent.click(screen.getByRole("menuitem", { name: "chat.manageModels" }));
+		expect(p.onOpenModelSettings).toHaveBeenCalledTimes(1);
+	});
+
+	it("preserves trigger toggling and dismisses on outside pointer / Escape", () => {
+		const p = props();
+		render(<ChatComposer {...p} />);
+		const trigger = screen.getByRole("button", { name: "chat.selectModel" });
+		fireEvent.pointerDown(trigger);
+		expect(p.onCloseModelPicker).not.toHaveBeenCalled();
+		fireEvent.click(trigger);
+		expect(p.onToggleModelPicker).toHaveBeenCalledTimes(1);
+		fireEvent.pointerDown(document.body);
+		fireEvent.keyDown(document, { key: "Escape" });
+		expect(p.onCloseModelPicker).toHaveBeenCalledTimes(2);
+	});
+
+	it("removes the portal and dismissal listeners when closed", () => {
+		const p = props();
+		const { rerender } = render(<ChatComposer {...p} />);
+		rerender(<ChatComposer {...p} modelPickerOpen={false} />);
+		expect(screen.queryByRole("menu")).toBeNull();
+		fireEvent.pointerDown(document.body);
+		fireEvent.keyDown(document, { key: "Escape" });
+		expect(p.onCloseModelPicker).not.toHaveBeenCalled();
+	});
+
+	it("does not open an empty menu or allow model changes while sending", () => {
+		const p = props();
+		const { rerender } = render(<ChatComposer {...p} modelOptions={[]} />);
+		expect(screen.queryByRole("menu")).toBeNull();
+		rerender(<ChatComposer {...p} chatIsSending />);
+		fireEvent.click(screen.getByRole("menuitemradio", { name: "Test model" }));
+		expect(p.onModelSelect).not.toHaveBeenCalled();
+	});
+});
```

**File**: `apps/inno-agent/web/src/react/chat/ChatComposer.tsx` (modified, +54/-5)
```diff
@@ -9,6 +9,7 @@ import type { InnoModelInfo } from "../../types/settings.js";
 import type { PreparedInlineImage, PendingPasteBlock } from "./composer-utils.js";
 import { kindFromName } from "./smart-input/kinds.js";
 import { ModelProviderIcon } from "./ModelProviderIcon.js";
+import { positionModelMenu } from "./model-menu-position.js";
 
 export interface ChatComposerModelState {
 	models: InnoModelInfo[];
@@ -128,16 +129,20 @@ export function ChatComposer({
 }: ChatComposerProps) {
 	const { t } = useTranslation();
 	const modelPickerRef = useRef<HTMLDivElement | null>(null);
+	const modelMenuRef = useRef<HTMLDivElement | null>(null);
 	const attachTriggerRef = useRef<HTMLDivElement | null>(null);
 	const attachMenuRef = useRef<HTMLDivElement | null>(null);
+	const [modelMenuPosition, setModelMenuPosition] = useState({ left: 8, top: 8, maxHeight: 360, maxWidth: 220 });
 	const [attachMenuPosition, setAttachMenuPosition] = useState({ left: 8, top: 8 });
 	const [osFileDragOver, setOsFileDragOver] = useState(false);
 	const currentModelLabel = currentModel?.name || currentModel?.id || modelState.defaultModel || t("chat.modelUnavailable");
 
 	useEffect(() => {
 		if (!modelPickerOpen) return;
 		const handlePointerDown = (event: PointerEvent) => {
-			if (!modelPickerRef.current?.contains(event.target as Node)) onCloseModelPicker();
+			const target = event.target as Node;
+			if (modelPickerRef.current?.contains(target) || modelMenuRef.current?.contains(target)) return;
+			onCloseModelPicker();
 		};
 		const handleKeyDown = (event: KeyboardEvent) => {
 			if (event.key === "Escape") onCloseModelPicker();
@@ -168,6 +173,43 @@ export function ChatComposer({
 		};
 	}, [attachMenuOpen, onCloseAttachMenu]);
 
+	const repositionModelMenu = useCallback(() => {
+		const trigger = modelPickerRef.current;
+		const menu = modelMenuRef.current;
+		if (!trigger || !menu) return;
+		const vv = window.visualViewport;
+		// Use the untransformed layout box: opening animations must not alter
+		// the anchor calculation. The visual viewport also tracks soft keyboards.
+		const next = positionModelMenu(trigger.getBoundingClientRect(), {
+			width: vv?.width ?? window.innerWidth,
+			height: vv?.height ?? window.innerHeight,
+			left: vv?.offsetLeft ?? 0,
+			top: vv?.offsetTop ?? 0,
+		}, { width: menu.offsetWidth, height: menu.scrollHeight + 2 });
+		setModelMenuPosition((previous) => Object.keys(next).every(
+			(key) => previous[key as keyof typeof next] === next[key as keyof typeof next],
+		) ? previous : next);
+	}, []);
+
+	useLayoutEffect(() => {
+		if (!modelPickerOpen) return;
+		const handleScroll = (event: Event) => {
+			if (event.target instanceof Node && modelMenuRef.current?.contains(event.target)) return;
+			repositionModelMenu();
+		};
+		repositionModelMenu();
+		window.addEventListener("resize", repositionModelMenu);
+		window.visualViewport?.addEventListener("resize", repositionModelMenu);
+		window.visualViewport?.addEventListener("scroll", repositionModelMenu);
+		document.addEventListener("scroll", handleScroll, true);
+		return () => {
+			window.removeEventListener("resize", repositionModelMenu);
+			window.visualViewport?.removeEventListener("resize", repositionModelMenu);
+			window.visualViewport?.removeEventListener("scroll", repositionModelMenu);
+			document.removeEventListener("scroll", handleScroll, true);
+		};
+	}, [modelPickerOpen, modelOptions.length, repositionModelMenu]);
+
 	const repositionAttachMenu = useCallback(() => {
 		const trigger = attachTriggerRef.current;
 		const menu = attachMenuRef.current;
@@ -430,8 +472,14 @@ export function ChatComposer({
 				<span className="max-w-[32vw] truncate whitespace-nowrap md:max-w-none" title={currentModelLabel}>{currentModelLabel}</span>
 				{modelPickerOpen ? <ChevronUp size={13} className="shrink-0" /> : <ChevronDown size={13} className="shrink-0" />}
 			</button>
-			{modelPickerOpen && modelOptions.length > 0 ? (
-				<div className="inno-composer-model-menu" role="menu" aria-label={t("chat.selectModel")}>
+			{modelPickerOpen && modelOptions.length > 0 && typeof document !== "undefined" ? createPortal(
+				<div
+					ref={modelMenuRef}
+					className="inno-composer-model-menu"
+					role="menu"
+					aria-label={t("chat.selectModel")}
+					style={{ ...modelMenuPosition, position: "fixed", right: "auto", bottom: "auto", zIndex: 100 }}
+				>
 					{modelOptions.map((model) => {
 						const selected = model.provider === modelState.defaultProvider && model.id === modelState.defaultModel;
 						return (
@@ -459,7 +507,8 @@ export function ChatComposer({
 							<span>{t("chat.manageModels")}</span>
 						</button>
 					</div>
-				</div>
+				</div>,
+				document.body,
 			) : null}
 		</div>
 	);
@@ -476,7 +525,7 @@ export function ChatComposer({
 		// The textarea is uncontrolled; notify React's onInput chain (smart-input
 		// mirror, autosize) about the programmatic edit.
 		el.dispatchEvent(new Event("input", { bub
```

**File**: `apps/inno-agent/web/src/react/chat/model-menu-position.test.ts` (added, +50/-0)
```diff
@@ -0,0 +1,50 @@
+import { describe, expect, it } from "vitest";
+import { positionModelMenu } from "./model-menu-position.js";
+
+describe("positionModelMenu", () => {
+	it.each([
+		[320, 568], [375, 667], [390, 844], [430, 932], [768, 1024],
+		[844, 390], [960, 800], [961, 800], [1440, 900], [320, 180],
+	])("keeps a long menu within a %i × %i viewport", (width, height) => {
+		for (const top of [0, height / 2, height - 40]) {
+			for (const right of [12, width / 2, width + 100]) {
+				const p = positionModelMenu({ top, bottom: top + 32, right },
+					{ width, height, left: 0, top: 0 }, { width: 220, height: 820 });
+				expect(p.left).toBeGreaterThanOrEqual(8);
+				expect(p.top).toBeGreaterThanOrEqual(8);
+				expect(p.left + p.maxWidth).toBeLessThanOrEqual(width - 8);
+				expect(p.top + p.maxHeight).toBeLessThanOrEqual(height - 8);
+				expect(p.maxHeight).toBeLessThanOrEqual(360);
+			}
+		}
+	});
+
+	it("anchors a short menu above the trigger when it fits", () => {
+		const p = positionModelMenu({ top: 400, bottom: 432, right: 300 },
+			{ width: 390, height: 844, left: 0, top: 0 }, { width: 220, height: 100 });
+		expect(p.left).toBe(80);
+		expect(p.top).toBe(292);
+	});
+
+	it("uses the space below a trigger near the top", () => {
+		const p = positionModelMenu({ top: 20, bottom: 52, right: 300 },
+			{ width: 390, height: 844, left: 0, top: 0 }, { width: 220, height: 100 });
+		expect(p.top).toBe(60);
+	});
+
+	it("accounts for the visual viewport offset and reduced keyboard height", () => {
+		const p = positionModelMenu({ top: 700, bottom: 732, right: 400 },
+			{ width: 320, height: 240, left: 25, top: 350 }, { width: 220, height: 820 });
+		expect(p.left).toBeGreaterThanOrEqual(33);
+		expect(p.left + p.maxWidth).toBeLessThanOrEqual(337);
+		expect(p.top).toBeGreaterThanOrEqual(358);
+		expect(p.top + p.maxHeight).toBeLessThanOrEqual(582);
+	});
+
+	it("caps width on exceptionally narrow viewports", () => {
+		const p = positionModelMenu({ top: 100, bottom: 132, right: 180 },
+			{ width: 180, height: 300, left: 0, top: 0 }, { width: 220, height: 820 });
+		expect(p.maxWidth).toBe(156);
+		expect(p.left + p.maxWidth).toBeLessThanOrEqual(172);
+	});
+});
```

**File**: `apps/inno-agent/web/src/react/chat/model-menu-position.ts` (added, +25/-0)
```diff
@@ -0,0 +1,25 @@
+/** Position a portaled menu inside the visible viewport, including a keyboard. */
+export function positionModelMenu(
+	trigger: { top: number; bottom: number; right: number },
+	viewport: { width: number; height: number; left: number; top: number },
+	content: { width: number; height: number },
+) {
+	const gap = 8;
+	const maxWidth = Math.min(220, Math.max(0, viewport.width - 24));
+	const maxHeight = Math.min(360, Math.max(0, viewport.height - 24));
+	const width = Math.min(content.width || 220, maxWidth);
+	const height = Math.min(content.height, maxHeight);
+	const minLeft = viewport.left + gap;
+	const minTop = viewport.top + gap;
+	const maxLeft = Math.max(minLeft, viewport.left + viewport.width - width - gap);
+	const maxTop = Math.max(minTop, viewport.top + viewport.height - height - gap);
+	const above = trigger.top - height - gap;
+	const below = trigger.bottom + gap;
+	const preferredTop = above >= minTop || below > maxTop ? above : below;
+	return {
+		left: Math.max(minLeft, Math.min(trigger.right - width, maxLeft)),
+		top: Math.max(minTop, Math.min(preferredTop, maxTop)),
+		maxHeight,
+		maxWidth,
+	};
+}
```

#### Recent Merged Pull Requests:
- **PR #243** (2026-10-01): chore(deps): upgrade PI SDK 0.84.2 → 0.99.2 (@hhyqhh)
- **PR #242** (closed): fix(docker): copy vendor/ before npm ci in production build (@sy007-spec)
- **PR #240** (2026-09-19): fix(docker): copy vendor/ before npm ci in production build (@sy007-spec)
- **PR #239** (2026-09-18): feat: add session workspace switching with file migration (@nfcino)
- **PR #238** (2026-09-17): feat: desktop computer use via @injaneity/pi-computer-use (@hhyqhh)
- **PR #237** (2026-09-16): fix: address PR #236 review follow-ups (@hhyqhh)
- **PR #236** (2026-09-15): fix: stabilize chat sessions and scheduled runs (@nfcino)
- **PR #235** (2026-09-14): feat: read-only session context usage API and localized composer control (@hhyqhh)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
