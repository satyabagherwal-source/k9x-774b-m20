# Forensic Learning Record (Deep Inspection): mem0ai/mem0

> **Canonical Artifact**: `07_PROJECT_LEARNING/mem0ai-mem0-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/mem0ai/mem0](https://github.com/mem0ai/mem0))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:37:35.960Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `mem0ai/mem0`
- **Description**: The Memory Layer for AI Agents - Drop-in memory infrastructure for AI agents and apps. Context that persists. Built for production.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 66380 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cli/node/src/agent-detect.ts`
```
/**
 * Detect whether the CLI is being invoked from inside an AI-agent context.
 *
 * Used by `mem0 init` to auto-enter Agent Mode (Rule 3 bootstrap) when an
 * agent runtime env var is present. The return value is a context **trigger
 * only** — the canonical agent identity is self-declared by the agent via
 * `--agent-caller <name>` (Proof Editor-style) and never sniffed from env
 * vars to fill the `agent_caller` field on the APIKey row.
 *
 * Returns a short name or null. Honest reporting depends on `--agent-caller`;
 * this list is just enough to enable the zero-friction auto-bootstrap UX.
 */

const AGENT_CALLER_ENV: ReadonlyArray<readonly [string, readonly string[]]> = [
	["claude-code", ["CLAUDECODE", "CLAUDE_CODE"]],
	["cursor", ["CURSOR_AGENT", "CURSOR_SESSION_ID"]],
	["codex", ["CODEX_CLI", "OPENAI_CODEX"]],
	["cline", ["CLINE_AGENT", "CLINE"]],
	["continue", ["CONTINUE_AGENT", "CONTINUE_SESSION"]],
	["aider", ["AIDER_SESSION"]],
	["goose", ["GOOSE_AGENT"]],
	["windsurf", ["WINDSURF_AGENT"]],
] as const;

export function detectAgentCaller(): string | null {
	for (const [name, envVars] of AGENT_CALLER_ENV) {
		if (envVars.some((v) => process.env[v])) {
			return name;
		}
	}
	return null;
}

```

### Core Architecture Module: `cli/node/src/backend/base.ts`
```
/**
 * Abstract backend interface and factory.
 */

import type { Mem0Config } from "../config.js";
import { PlatformBackend } from "./platform.js";

export interface AddOptions {
	userId?: string;
	agentId?: string;
	appId?: string;
	runId?: string;
	metadata?: Record<string, unknown>;
	immutable?: boolean;
	infer?: boolean;
	expires?: string;
	customInstructions?: string;
	agentCustomInstructions?: string;
	customCategories?: Record<string, string>[];
	structuredDataSchema?: Record<string, unknown>;
	timestamp?: number;
}

export interface SearchOptions {
	userId?: string;
	agentId?: string;
	appId?: string;
	runId?: string;
	topK?: number;
	threshold?: number;
	rerank?: boolean;
	keyword?: boolean;
	filters?: Record<string, unknown>;
	fields?: string[];
	showExpired?: boolean;
	referenceDate?: string | number;
	latestOnly?: boolean;
}

export interface ListOptions {
	userId?: string;
	agentId?: string;
	appId?: string;
	runId?: string;
	page?: number;
	pageSize?: number;
	category?: string;
	after?: string;
	before?: string;
	showExpired?: boolean;
	latestOnly?: boolean;
}

export interface DeleteOptions {
	all?: boolean;
	userId?: string;
	agentId?: string;
	appId?: string;
	runId?: string;
	deleteLinked?: boolean;
}

export interface UpdateOptions {
	expirationDate?: string;
	timestamp?: number;
}

export interface EntityIds {
	userId?: string;
	agentId?: string;
	appId?: string;
	runId?: string;
}

export interface Backend {
	add(
		content?: string,
		messages?: Record<string, unknown>[],
		opts?: AddOptions,
	): Promise<Record<string, unknown>>;

	search(
		query: string,
		opts?: SearchOptions,
	): Promise<Record<string, unknown>[]>;

	get(memoryId: string): Promise<Record<string, unknown>>;

	listMemories(opts?: ListOptions): Promise<Record<string, unknown>[]>;

	update(
		memoryId: string,
		content?: string,
		metadata?: Record<string, unknown>,
		opts?: UpdateOptions,
	): Promise<Record<string, unknown>>;

	delete(
		memoryId?: string,
		opts?: DeleteOptions,
	): Promise<Record<string, unknown>>;

	deleteEntities(opts: EntityIds): Promise<Record<string, unknown>>;

	ping(): Promise<Record<string, unknown>>;

	status(opts?: { userId?: string; agentId?: string }): Promise<
		Record<string, unknown>
	>;

	entities(entityType: string): Promise<Record<string, unknown>[]>;

	listEvents(): Promise<Record<string, unknown>[]>;

	getEvent(eventId: string): Promise<Record<string, unknown>>;
}

export class AuthError extends Error {
	constructor(
		message = "Authentication failed. Your API key may be invalid or expired.",
	) {
		super(message);
		this.name = "AuthError";
	}
}

export class NotFoundError extends Error {
	constructor(path: string) {
		super(`Resource not found: ${path}`);
		this.name = "NotFoundError";
	}
}

export class APIError extends Error {
	constructor(path: string, detail: string) {
		super(`Bad request to ${path}: ${detail}`);
		this.name = "APIError";
	}
}

export function getBackend(config: Mem0Config): Backend {
	return new PlatformBackend(config.platform);
}

```

### Core Architecture Module: `cli/node/src/backend/index.ts`
```
/**
 * Backend factory re-export.
 */

export { getBackend } from "./base.js";
export type {
	Backend,
	AddOptions,
	SearchOptions,
	ListOptions,
	DeleteOptions,
	EntityIds,
} from "./base.js";
export { AuthError, NotFoundError, APIError } from "./base.js";

```

### Core Architecture Module: `cli/node/src/backend/platform.ts`
```
/**
 * Platform (SaaS) backend — communicates with api.mem0.ai.
 */

import type { PlatformConfig } from "../config.js";
import { captureNotice, isAgentMode } from "../state.js";
import { CLI_VERSION } from "../version.js";
import {
	APIError,
	type AddOptions,
	AuthError,
	type Backend,
	type DeleteOptions,
	type EntityIds,
	type ListOptions,
	NotFoundError,
	type SearchOptions,
	type UpdateOptions,
} from "./base.js";

function encodePathSegment(value: unknown): string {
	return encodeURIComponent(String(value));
}

export class PlatformBackend implements Backend {
	private baseUrl: string;
	private headers: Record<string, string>;

	constructor(config: PlatformConfig) {
		this.baseUrl = config.baseUrl.replace(/\/+$/, "");
		this.headers = {
			Authorization: `Token ${config.apiKey}`,
			"Content-Type": "application/json",
			"X-Mem0-Source": "CLI",
			"X-Mem0-Client": `mem0-cli-node/${CLI_VERSION}`,
			"X-Mem0-Client-Language": "node",
			"X-Mem0-Client-Version": CLI_VERSION,
		};
	}

	private async _request(
		method: string,
		path: string,
		opts?: { json?: unknown; params?: Record<string, string> },
	): Promise<unknown> {
		let url = `${this.baseUrl}${path}`;
		if (opts?.params) {
			const qs = new URLSearchParams(opts.params).toString();
			url += `?${qs}`;
		}

		const headers = {
			...this.headers,
			"X-Mem0-Caller-Type": isAgentMode() ? "agent" : "user",
		};

		const fetchOpts: RequestInit = {
			method,
			headers,
			signal: AbortSignal.timeout(30_000),
		};
		if (opts?.json) {
			fetchOpts.body = JSON.stringify(opts.json);
		}

		const resp = await fetch(url, fetchOpts);

		if (resp.status === 401) {
			throw new AuthError();
		}
		if (resp.status === 404) {
			throw new NotFoundError(path);
		}
		if (resp.status === 400) {
			let detail: string;
			try {
				const body = (await resp.json()) as Record<string, unknown>;
				detail =
					((body.detail ?? body.message ?? JSON.stringify(body)) as string) ??
					resp.statusText;
			} catch {
				detail = resp.statusText;
			}
			throw new APIError(path, detail);
		}
		if (!resp.ok) {
			let detail: string = resp.statusText;
			try {
				const body = (await resp.json()) as Record<string, unknown>;
				detail = (body.detail ?? body.message ?? resp.statusText) as string;
			} catch {
				/* ignore */
			}
			throw new Error(`HTTP ${resp.status}: ${detail}`);
		}
		if (resp.status === 204) {
			return {};
		}

		const data = await resp.json();

		// Pull the unclaimed-Agent-Mode notice out of the body (or the header
		// fallback for endpoints returning non-dict / non-dict-leading payloads)
		// and stash for end-of-command surfacing.
		let notice: string | null = null;
		if (
			data &&
			typeof data === "object" &&
			!Array.isArray(data) &&
			"mem0_notice" in data
		) {
			notice = (data as Record<string, unknown>).mem0_notice as string;
			// biome-ignore lint/performance/noDelete: intentional strip so downstream consumers don't see duplicate notice
			delete (data as Record<string, unknown>).mem0_notice;
		} else if (
			Array.isArray(data) &&
			data.length > 0 &&
			typeof data[0] === "object" &&
			data[0] !== null &&
			"mem0_notice" in data[0]
		) {
			notice = (data[0] as Record<string, unknown>).mem0_notice as string;
			// biome-ignore lint/performance/noDelete: see above.
			delete (data[0] as Record<string, unknown>).mem0_notice;
		}
		if (!notice) {
			notice = resp.headers.get("X-Mem0-Notice-Message") ?? null;
		}
		captureNotice(notice);

		return data;
	}

	async add(
		content?: string,
		messages?: Record<string, unknown>[],
		opts: AddOptions = {},
	): Promise<Record<string, unknown>> {
		const payload: Record<string, unknown> = {};

		if (messages) {
			payload.messages = messages;
		} else if (content) {
			payload.messages = [{ role: "user", content }];
		}

		if (opts.userId) payload.user_id = opts.userId;
		if (opts.agentId) payload.agent_id = opts.agentId;
		if (opts.appId) payload.app_id = opts.appId;
		if (opts.runId) payload.run_id = opts.runId;
		if (opts.metadata) payload.metadata = opts.metadata;
		if (opts.immutable) payload.immutable = true;
		if (opts.infer === false) payload.infer = false;
		if (opts.expires) payload.expiration_date = opts.expires;
		if (opts.customInstructions)
			payload.custom_instructions = opts.customInstructions;
		if (opts.agentCustomInstructions)
			payload.agent_custom_instructions = opts.agentCustomInstructions;
		if (opts.customCategories)
			payload.custom_categories = opts.customCategories;
		if (opts.structuredDataSchema)
			payload.structured_data_schema = opts.structuredDataSchema;
		if (opts.timestamp !== undefined) payload.timestamp = opts.timestamp;
		payload.source = "CLI";

		return (await this._request("POST", "/v3/memories/add/", {
			json: payload,
		})) as Record<string, unknown>;
	}

	private _buildFilters(opts: {
		userId?: string;
		agentId?: string;
		appId?: string;
		runId?: string;
		extraFilters?: Record<string, unknown>;
	}): Record<string, unknown> | undefined {
		// If caller passed a pre-built filter structure, use it directly
		if (
			opts.extraFilters &&
			("AND" in opts.extraFilters || "OR" in opts.extraFilters)
		) {
			return opts.extraFilters;
		}

		const andConditions: Record<string, unknown>[] = [];
		if (opts.userId) andConditions.push({ user_id: opts.userId });
		if (opts.agentId) andConditions.push({ agent_id: opts.agentId });
		if (opts.appId) andConditions.push({ app_id: opts.appId });
		if (opts.runId) andConditions.push({ run_id: opts.runId });

		if (opts.extraFilters) {
			for (const [k, v] of Object.entries(opts.extraFilters)) {
				andConditions.push({ [k]: v });
			}
		}

		if (andConditions.length === 1) return andConditions[0];
		if (andConditions.length > 1) return { AND: andConditions };
		return undefined;
	}

	async search(
		query: string,
		opts: SearchOptions = {},
	): Promise<Record<string, unknown>[]> {
		const payload: Record<string, unknown> = {
			query,
			top_k: opts.topK ?? 10,
			threshold: opts.threshold ?? 0.3,
		};

		const apiFilters = this._buildFilters({
			userId: opts.userId,
			agentId: opts.agentId,
			appId: opts.appId,
			runId: opts.runId,
			extraFilters: opts.filters,
		});
		if (apiFilters) payload.filters = apiFilters;
		if (opts.rerank) payload.rerank = true;
		if (opts.keyword) payload.keyword_search = true;
		if (opts.fields) payload.fields = opts.fields;
		if (opts.showExpired) payload.show_expired = true;
		if (opts.referenceDate !== undefined)
			payload.reference_date = opts.referenceDate;
		if (opts.latestOnly) payload.latest_only = true;
		payload.source = "CLI";

		const result = (await this._request("POST", "/v3/memories/search/", {
			json: payload,
		})) as unknown;
		if (Array.isArray(result)) return result;
		const obj = result as Record<string, unknown>;
		return (obj.results ?? obj.memories ?? []) as Record<string, unknown>[];
	}

	async get(memoryId: string): Promise<Record<string, unknown>> {
		return (await this._request(
			"GET",
			`/v1/memories/${encodePathSegment(memoryId)}/`,
			{
				params: { source: "CLI" },
			},
		)) as Record<string, unknown>;
	}

	async listMemories(
		opts: ListOptions = {},
	): Promise<Record<string, unknown>[]> {
		const payload: Record<string, unknown> = {};
		const params: Record<string, string> = {
			page: String(opts.page ?? 1),
			page_size: String(opts.pageSize ?? 100),
		};

		const extra: Record<string, unknown> = {};
		if (opts.category) {
			extra.categories = { contains: opts.category };
		}
		if (opts.after) {
			extra.created_at = {
				...(extra.created_at as Record<string, unknown> | undefined),
				gte: opts.after,
			};
		}
		if (opts.before) {
			extra.created_at = {
				...(extra.created_at as Record<string, unknown> | undefined),
				lte: opts.before,
			};
		}

		const apiFilters = this._buildFilters({
			userId: opts.userId,
			agentId: opts.agentId,
			appId: opts.appId,
			runId: opts.runId,
			extraFilters: Object.keys(extra).length > 0 ? extra : undefined,
		})
```

### Core Architecture Module: `cli/node/src/branding.ts`
```
/**
 * Branding and ASCII art for mem0 CLI.
 */

import chalk from "chalk";
import ora, { type Ora } from "ora";
import { getCurrentCommand, isAgentMode } from "./state.js";
import { CLI_VERSION } from "./version.js";

export const LOGO = `
███╗   ███╗███████╗███╗   ███╗ ██████╗      ██████╗██╗     ██╗
████╗ ████║██╔════╝████╗ ████║██╔═████╗    ██╔════╝██║     ██║
██╔████╔██║█████╗  ██╔████╔██║██║██╔██║    ██║     ██║     ██║
██║╚██╔╝██║██╔══╝  ██║╚██╔╝██║████╔╝██║    ██║     ██║     ██║
██║ ╚═╝ ██║███████╗██║ ╚═╝ ██║╚██████╔╝    ╚██████╗███████╗██║
╚═╝     ╚═╝╚══════╝╚═╝     ╚═╝ ╚═════╝      ╚═════╝╚══════╝╚═╝
`;

export const LOGO_MINI = "◆ mem0";
export const TAGLINE = "The Memory Layer for AI Agents";

export const BRAND_COLOR = "#8b5cf6";
export const ACCENT_COLOR = "#a78bfa";
export const SUCCESS_COLOR = "#22c55e";
export const ERROR_COLOR = "#ef4444";
export const WARNING_COLOR = "#f59e0b";
export const DIM_COLOR = "#6b7280";

const brand = chalk.hex(BRAND_COLOR);
const accent = chalk.hex(ACCENT_COLOR);
const success = chalk.hex(SUCCESS_COLOR);
const error = chalk.hex(ERROR_COLOR);
const warning = chalk.hex(WARNING_COLOR);
const dim = chalk.hex(DIM_COLOR);

/**
 * Choose a symbol based on TTY/NO_COLOR. Fancy for interactive terminals,
 * plain-text for piped/non-TTY or NO_COLOR environments.
 */
export function sym(fancy: string, plain: string): string {
	if (!process.stdout.isTTY || process.env.NO_COLOR) return plain;
	return fancy;
}

export function printBanner(): void {
	if (isAgentMode()) return;
	const pad = 3; // horizontal padding each side (matches Rich's padding=(0, 2))
	const logoLines = LOGO.trimEnd().split("\n");
	const tagline = `  ${TAGLINE}`;
	const subtitle = `Node.js SDK · v${CLI_VERSION}`;
	const contentLines = ["", ...logoLines, "", tagline, ""];

	// Compute inner width from longest content line + padding both sides
	const maxContent = Math.max(...contentLines.map((l) => l.length));
	const innerWidth = maxContent + pad * 2;
	const totalWidth = innerWidth + 2; // + 2 for │ borders

	const topBorder = brand(`╭${"─".repeat(totalWidth - 2)}╮`);
	const subtitleFill = totalWidth - 2 - subtitle.length - 3; // 3 = "─ " before subtitle + "─" after
	const bottomBorder = brand(
		`╰${"─".repeat(subtitleFill)} ${dim(subtitle)} ${"─"}╯`,
	);

	const body = contentLines.map((line) => {
		const rightPad = innerWidth - pad - line.length;
		return `${brand("│")}${" ".repeat(pad)}${brand.bold(line)}${" ".repeat(Math.max(rightPad, 0))}${brand("│")}`;
	});
	// Re-color tagline line with accent instead of brand.bold
	const taglineIdx = body.length - 2; // second-to-last (before trailing empty line)
	const taglineRightPad = innerWidth - pad - tagline.length;
	body[taglineIdx] =
		`${brand("│")}${" ".repeat(pad)}${accent(tagline)}${" ".repeat(Math.max(taglineRightPad, 0))}${brand("│")}`;

	console.log(topBorder);
	for (const line of body) console.log(line);
	console.log(bottomBorder);
}

export function printSuccess(message: string): void {
	if (isAgentMode()) return;
	console.log(`${success(sym("✓", "[ok]"))} ${message}`);
}

export function printError(message: string, hint?: string): void {
	if (isAgentMode()) {
		const envelope = {
			status: "error",
			command: getCurrentCommand(),
			error: message,
			data: null,
		};
		console.log(JSON.stringify(envelope));
		return;
	}
	console.error(`${error(`${sym("✗", "[error]")} Error:`)} ${message}`);
	const resolvedHint =
		hint ??
		(message.includes("Authentication failed")
			? `Run ${brand("mem0 init")} to reconfigure your API key · https://app.mem0.ai/dashboard/api-keys?utm_source=oss&utm_medium=cli-node`
			: undefined);
	if (resolvedHint) {
		console.error(`  ${dim(resolvedHint)}`);
	}
}

export function printWarning(message: string): void {
	console.error(`${warning(sym("⚠", "[warn]"))} ${message}`);
}

export function printInfo(message: string): void {
	if (isAgentMode()) return;
	console.error(`${brand(sym("◆", "*"))} ${message}`);
}

export function printScope(ids: Record<string, string | undefined>): void {
	if (isAgentMode()) return;
	const parts: string[] = [];
	for (const [key, val] of Object.entries(ids)) {
		if (val) {
			parts.push(`${key}=${val}`);
		}
	}
	if (parts.length > 0) {
		console.error(`  ${dim(`Scope: ${parts.join(", ")}`)}`);
	}
}

export interface TimedStatusContext {
	successMsg: string;
	errorMsg: string;
}

/**
 * Run an async function with a spinner, timing the operation.
 * Equivalent to Python's timed_status context manager.
 */
export async function timedStatus<T>(
	message: string,
	fn: (ctx: TimedStatusContext) => Promise<T>,
): Promise<T> {
	if (isAgentMode()) {
		const ctx: TimedStatusContext = { successMsg: "", errorMsg: "" };
		return fn(ctx);
	}
	const ctx: TimedStatusContext = { successMsg: "", errorMsg: "" };
	const spinner = ora({
		text: dim(message),
		color: "yellow",
		stream: process.stderr,
	}).start();
	const start = performance.now();

	try {
		const result = await fn(ctx);
		const elapsed = ((performance.now() - start) / 1000).toFixed(2);
		spinner.stop();
		if (ctx.successMsg) {
			console.error(`${success("✓")} ${ctx.successMsg} (${elapsed}s)`);
		}
		return result;
	} catch (err) {
		const elapsed = ((performance.now() - start) / 1000).toFixed(2);
		spinner.stop();
		if (ctx.errorMsg) {
			printError(`${ctx.errorMsg} (${elapsed}s)`);
		}
		throw err;
	}
}

/** Format helpers using brand colors for external use. */
export const colors = { brand, accent, success, error, warning, dim };

```

### Core Architecture Module: `cli/node/src/commands/agent-mode.ts`
```
/**
 * Agent Mode commands — bootstrap (unattended signup) and OTP-based claim.
 */

import readline from "node:readline";
import { colors, printError, printInfo, printSuccess } from "../branding.js";
import { type Mem0Config, saveConfig } from "../config.js";

const { brand, dim } = colors;

const SOURCE_HEADERS = {
	"X-Mem0-Source": "cli",
	"X-Mem0-Client-Language": "node",
} as const;

export interface BootstrapEnvelope {
	api_key: string;
	default_user_id: string;
	org_id: string;
	project_id: string;
	mcp_url?: string;
	smoke_test_url?: string;
	claim_command?: string;
	mem0_notice?: string;
}

function isValidEnvelope(v: unknown): v is BootstrapEnvelope {
	return (
		!!v &&
		typeof v === "object" &&
		typeof (v as BootstrapEnvelope).api_key === "string" &&
		(v as BootstrapEnvelope).api_key.length > 0 &&
		typeof (v as BootstrapEnvelope).default_user_id === "string" &&
		(v as BootstrapEnvelope).default_user_id.length > 0
	);
}

/**
 * POST /api/v1/auth/agent_mode/ and mutate config in place.
 *
 * @param config - Mem0Config mutated in place with the new platform values.
 * @param source - `--source` flag passthrough (analytics tag, free-form).
 * @param agentCaller - Self-declared agent identity passed via `--agent-caller`
 *   (e.g. `claude-code`, `cursor`). May be null when the caller omitted the
 *   flag; the agent can backfill later via `mem0 identify <name>`. Sent to the
 *   backend in the request body and saved into `platform.agentCaller` for
 *   local introspection.
 */
export async function bootstrapViaBackend(
	config: Mem0Config,
	{
		source,
		agentCaller,
	}: { source?: string | null; agentCaller?: string | null } = {},
): Promise<void> {
	const baseUrl = (config.platform.baseUrl || "https://api.mem0.ai").replace(
		/\/+$/,
		"",
	);
	const body: Record<string, unknown> = {};
	if (source) body.source = source;
	if (agentCaller) body.agent_caller = agentCaller;

	let resp: Response;
	try {
		resp = await fetch(`${baseUrl}/api/v1/auth/agent_mode/`, {
			method: "POST",
			headers: {
				...SOURCE_HEADERS,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(30_000),
		});
	} catch (err) {
		printError(
			`Network error contacting Mem0: ${err instanceof Error ? err.message : String(err)}`,
		);
		process.exit(1);
	}

	if (resp.status === 429) {
		printError("Rate-limited. Try again in a few minutes.");
		process.exit(1);
	}
	if (resp.status === 503) {
		printError("Agent Mode is temporarily disabled. Try again later.");
		process.exit(1);
	}
	if (!resp.ok) {
		let detail: string = resp.statusText;
		try {
			const errBody = (await resp.json()) as {
				error?: string;
				detail?: string;
			};
			detail = errBody.error ?? errBody.detail ?? resp.statusText;
		} catch {
			/* leave detail as statusText */
		}
		// Backend's @ratelimit decorator raises PermissionDenied, which DRF
		// translates to a generic 403 "You do not have permission to perform
		// this action." That's opaque — surface it as the rate-limit message
		// it actually is.
		if (resp.status === 403 && /permission/i.test(detail)) {
			printError(
				"Daily Agent Mode signup limit reached for this network (5/day). Try again from a different IP or after midnight UTC.",
			);
			process.exit(1);
		}
		printError(`Bootstrap failed: ${detail}`);
		process.exit(1);
	}

	const envelope = (await resp.json()) as BootstrapEnvelope;
	if (!isValidEnvelope(envelope)) {
		// Defend against partial/malformed backend responses (e.g. {api_key: null}).
		// Without this guard, the typed `string` field is silently set to
		// undefined/null and persisted, producing confusing downstream errors.
		printError(
			"Bootstrap response missing required fields — please update the CLI.",
		);
		process.exit(1);
	}

	config.platform.apiKey = envelope.api_key;
	config.platform.baseUrl = baseUrl;
	config.platform.agentMode = true;
	config.platform.createdVia = "agent_mode";
	config.platform.agentCaller = agentCaller ?? "";
	config.platform.claimedAt = "";
	config.platform.defaultUserId = envelope.default_user_id;
	// Adopt the slug-derived user_id as the default scope for memory ops.
	config.defaults.userId = envelope.default_user_id;
	saveConfig(config);

	printSuccess(
		`Agent Mode active. Default user_id: ${envelope.default_user_id}`,
	);
	if (envelope.mem0_notice) {
		console.log(`\n\x1b[33m🔔 ${envelope.mem0_notice}\x1b[0m\n`);
	} else {
		// Fallback for older backends without the unified notice field.
		const claimCmd = envelope.claim_command ?? "mem0 init --email <your-email>";
		console.log(`  ${dim(`To claim this account later: ${claimCmd}`)}`);
	}

	if (!agentCaller) {
		console.log(
			`  ${dim("If you are an AI agent, identify yourself: `mem0 identify <your-name>` (e.g. claude-code, cursor).")}`,
		);
	}
}

/**
 * Claim an existing Agent Mode account via OTP — no browser, no polling.
 *
 * Hits /api/v1/auth/email_code/ to send a verification code, prompts for it
 * interactively (or accepts via `code`), then sends it to /verify/ alongside
 * `agent_mode_api_key`. Backend's verify_email_code runs upgrade-in-place
 * inline and returns the claim result.
 */
export async function claimViaOtp(
	config: Mem0Config,
	{ email, code }: { email: string; code?: string },
): Promise<void> {
	const baseUrl = (config.platform.baseUrl || "https://api.mem0.ai").replace(
		/\/+$/,
		"",
	);
	if (!config.platform.apiKey || !config.platform.agentMode) {
		printError(
			"This command requires an active Agent Mode config. Run `mem0 init` first.",
		);
		process.exit(1);
	}

	const rawKey = config.platform.apiKey;

	// Step 1: request OTP (unless --code was supplied)
	if (!code) {
		const sendResp = await fetch(`${baseUrl}/api/v1/auth/email_code/`, {
			method: "POST",
			headers: { ...SOURCE_HEADERS, "Content-Type": "application/json" },
			body: JSON.stringify({ email }),
			signal: AbortSignal.timeout(30_000),
		});
		if (sendResp.status === 429) {
			printError("Too many attempts. Try again in a few minutes.");
			process.exit(1);
		}
		if (!sendResp.ok) {
			let detail: string = sendResp.statusText;
			try {
				const errBody = (await sendResp.json()) as { error?: string };
				if (errBody.error) detail = errBody.error;
			} catch {
				/* leave as statusText */
			}
			printError(`Failed to send code: ${detail}`);
			process.exit(1);
		}

		printSuccess(`Verification code sent to ${email}. Check your inbox.`);

		if (!process.stdin.isTTY) {
			printError(
				"No --code provided and terminal is non-interactive.",
				`Re-run: mem0 init --email ${email} --code <code>`,
			);
			process.exit(1);
		}

		console.log();
		code = await promptLine(`  ${brand("Verification Code")}`);
		if (!code) {
			printError("Code is required.");
			process.exit(1);
		}
	}

	// Step 2: verify + claim atomically
	const verifyResp = await fetch(`${baseUrl}/api/v1/auth/email_code/verify/`, {
		method: "POST",
		headers: { ...SOURCE_HEADERS, "Content-Type": "application/json" },
		body: JSON.stringify({
			email,
			code: code.trim(),
			agent_mode_api_key: rawKey,
		}),
		signal: AbortSignal.timeout(30_000),
	});

	if (!verifyResp.ok) {
		let detail: string = verifyResp.statusText;
		let errCode = "";
		try {
			const errBody = (await verifyResp.json()) as {
				error?: string;
				code?: string;
			};
			if (errBody.error) detail = errBody.error;
			if (errBody.code) errCode = errBody.code;
		} catch {
			/* leave as statusText */
		}
		printError(`Claim failed: ${detail}`);
		if (errCode === "email_already_claimed") {
			console.log(
				`  ${dim("Tip: this email already has a Mem0 account. Sign in at app.mem0.ai with your existing credentials.")}`,
			);
		}
		process.exit(1);
	}

	const claimBody = (await verifyResp.json()) as {
		claimed?: boolean;
		claimed_at?: string;
	};
	if (!claimBody.claimed) {
		printError(`Unexpected verify response: ${JSON.stringify(claimBody)}`);
		process.exit(1);
	}

	config.platform.agentMode = false;
	config.platform.claime
```

### Core Architecture Module: `cli/node/src/commands/agent-rush.ts`
```
/**
 * `mem0 agent-rush <add|search> "..."` — wraps the AGENTRUSH platform endpoints.
 * Project routing is implicit (server-side); zero flags needed.
 */

import readline from "node:readline";
import { colors, printError, printSuccess } from "../branding.js";
import { loadConfig, saveConfig } from "../config.js";
import { CLI_VERSION } from "../version.js";

const PII_WARNING = [
	"",
	"⚠️  AGENTRUSH memories are PUBLIC — visible to any other player.",
	"   Do not include real names, emails, secrets, work content, or PII.",
	"",
].join("\n");

const ERROR_HINTS: Record<string, string> = {
	agentrush_search_first:
		"Run 3 'mem0 agent-rush search' commands before adding.",
	agentrush_search_quota: "You've used your 3 lifetime searches.",
	agentrush_add_quota: "You've used your 3 lifetime adds.",
	agentrush_not_agent_mode:
		"Re-run 'mem0 init --agent' to bootstrap an agent-mode key.",
	agentrush_length: "Memory text must be 50-1000 characters.",
	agentrush_no_urls: "URLs are not allowed.",
	agentrush_blocklist: "Content contains a blocked term.",
	agentrush_global_quota: "Event-wide cap reached. Try again later.",
	agentrush_not_provisioned:
		"AGENTRUSH is not provisioned in this environment.",
};

async function callEndpoint(
	path: string,
	body: Record<string, unknown>,
): Promise<unknown> {
	const config = loadConfig();
	const baseUrl = (config.platform?.baseUrl ?? "https://api.mem0.ai").replace(
		/\/+$/,
		"",
	);

	if (!config.platform?.apiKey) {
		printError("Not initialized. Run `mem0 init --agent` first.");
		process.exit(1);
	}

	const resp = await fetch(`${baseUrl}${path}`, {
		method: "POST",
		headers: {
			Authorization: `Token ${config.platform.apiKey}`,
			"Content-Type": "application/json",
			"X-Mem0-Source": "cli",
			"X-Mem0-Client-Language": "node",
			"X-Mem0-Client-Version": CLI_VERSION,
			"X-Mem0-Mode": "agent-rush",
		},
		body: JSON.stringify(body),
		signal: AbortSignal.timeout(30_000),
	});

	const json = await resp.json().catch(() => ({}));

	if (!resp.ok) {
		const code =
			(json as { error?: { code?: string } }).error?.code ?? "unknown";
		printError(`AGENTRUSH error: ${code}`);
		if (ERROR_HINTS[code]) {
			console.log(`  ${colors.dim(ERROR_HINTS[code])}`);
		}
		process.exit(1);
	}

	return json;
}

function promptLine(question: string): Promise<string> {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});
	return new Promise((resolve) => {
		rl.question(question, (answer) => {
			rl.close();
			resolve(answer.trim());
		});
	});
}

/**
 * Ensure the human has acknowledged that AGENTRUSH memories are PUBLIC.
 *
 * Interactive (TTY): show the prompt; on "y" persist `agentRush.acknowledgedAt`
 * so we never ask the same machine twice. On anything else, abort.
 *
 * Non-interactive (agent invocation, no TTY): print the warning to stderr
 * for the human reading the agent's transcript and proceed — agents can't
 * answer y/N prompts.
 */
async function ensureWarningAcknowledged(): Promise<void> {
	const config = loadConfig();
	if (config.agentRush?.acknowledgedAt) return;

	if (!process.stdin.isTTY || !process.stdout.isTTY) {
		// Agent context: surface the warning to stderr, don't block.
		console.error(PII_WARNING);
		return;
	}

	console.log(PII_WARNING);
	const answer = (await promptLine("   Continue? [y/N]: ")).toLowerCase();
	if (answer !== "y" && answer !== "yes") {
		printError("Aborted.");
		process.exit(1);
	}

	config.agentRush.acknowledgedAt = new Date().toISOString();
	saveConfig(config);
}

export async function cmdAgentRushAdd(content: string): Promise<void> {
	await ensureWarningAcknowledged();
	const result = await callEndpoint("/v1/agent-rush/memories/", { content });
	printSuccess(
		`Memory submitted (event_id: ${(result as { event_id?: string }).event_id ?? "?"})`,
	);
}

export async function cmdAgentRushSearch(query: string): Promise<void> {
	const result = (await callEndpoint("/v1/agent-rush/memories/search/", {
		query,
	})) as {
		results?: Array<{ memory?: string }>;
		memories?: Array<{ memory?: string }>;
	};

	const memories = result.results ?? result.memories ?? [];

	if (memories.length === 0) {
		console.log(colors.dim("(no results)"));
		return;
	}

	memories.slice(0, 5).forEach((m, i) => {
		console.log(`  ${i + 1}. ${m.memory ?? JSON.stringify(m)}`);
	});
}

```

### Core Architecture Module: `cli/node/src/commands/config.ts`
```
/**
 * Config management commands: show, set, get.
 */

import Table from "cli-table3";
import { colors, printError, printSuccess } from "../branding.js";
import {
	getNestedValue,
	loadConfig,
	redactKey,
	saveConfig,
	setNestedValue,
} from "../config.js";
import { formatAgentEnvelope, formatJsonEnvelope } from "../output.js";
import { isAgentMode, setCurrentCommand } from "../state.js";

const { brand, accent, dim } = colors;

export function cmdConfigShow(opts: { output?: string } = {}): void {
	setCurrentCommand("config show");
	const config = loadConfig();

	if (opts.output === "agent" || opts.output === "json") {
		formatAgentEnvelope({
			command: "config show",
			data: {
				defaults: {
					user_id: config.defaults.userId || null,
					agent_id: config.defaults.agentId || null,
					app_id: config.defaults.appId || null,
					run_id: config.defaults.runId || null,
				},
				platform: {
					api_key: redactKey(config.platform.apiKey),
					base_url: config.platform.baseUrl,
				},
			},
		});
		return;
	}

	console.log();
	console.log(`  ${brand("◆ mem0 Configuration")}\n`);

	const table = new Table({
		head: [accent("Key"), accent("Value")],
		style: { head: [], border: [] },
	});

	// Defaults
	table.push(["defaults.user_id", config.defaults.userId || dim("(not set)")]);
	table.push([
		"defaults.agent_id",
		config.defaults.agentId || dim("(not set)"),
	]);
	table.push(["defaults.app_id", config.defaults.appId || dim("(not set)")]);
	table.push(["defaults.run_id", config.defaults.runId || dim("(not set)")]);
	table.push(["", ""]);

	// Platform
	table.push(["platform.api_key", redactKey(config.platform.apiKey)]);
	table.push(["platform.base_url", config.platform.baseUrl]);

	console.log(table.toString());
	console.log();
}

export function cmdConfigGet(key: string): void {
	setCurrentCommand("config get");
	const config = loadConfig();
	const value = getNestedValue(config, key);

	if (value === undefined) {
		printError(`Unknown config key: ${key}`);
	} else {
		// Redact secrets
		const displayValue =
			key.includes("api_key") || key.split(".").pop() === "key"
				? redactKey(String(value))
				: String(value);
		if (isAgentMode()) {
			formatAgentEnvelope({
				command: "config get",
				data: { key, value: displayValue },
			});
		} else {
			console.log(displayValue);
		}
	}
}

export function cmdConfigSet(key: string, value: string): void {
	setCurrentCommand("config set");
	const config = loadConfig();
	if (setNestedValue(config, key, value)) {
		saveConfig(config);
		const display = key.includes("key") ? redactKey(value) : value;
		if (isAgentMode()) {
			formatAgentEnvelope({
				command: "config set",
				data: { key, value: display },
			});
		} else {
			printSuccess(`${key} = ${display}`);
		}
	} else {
		printError(`Unknown config key: ${key}`);
	}
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #7349** (2026-09-24): **bug(oss): ConfigManager injects OpenAI's baseURL and model into every other LLM provider, so documented non-OpenAI configs are sent to api.openai.com**
  *Symptoms*: ### Component  TypeScript SDK  ### Description  ### Summary  `DEFAULT_MEMORY_CONFIG.llm.config` holds OpenAI's own values (`baseURL: "https://api.openai.com/v1"` at `mem0-ts/src/oss/src/config/defaults.ts:23`, `model: "gpt-5-mini"` at `:25`), and `ConfigManager.mergeConfig` treats them as universal defaults (`mem0-ts/src/oss/src/config/manager.ts:126-136`):  ```ts const llmBaseURL =   userConf?.baseURL ??   ...   userConf?.url ??   (provider.toLowerCase() === "vllm" ? undefined : defaultConf.baseURL); ```  So any config that omits `baseURL` gets OpenAI's, for every provider except vLLM. The providers then prefer it over their own default and over their documented env fallback:  - `llms/deepseek.ts:12-16`: `config.baseURL || process.env.DEEPSEEK_API_BASE || "https://api.deepseek.com"` - `llms/xai.ts:23-24`: same shape, so `XAI_API_BASE` is dead code - `llms/ollama.ts:15`: `config.url || config.baseURL || "http://localhost:11434"` - `llms/anthropic.ts:22-25`: `if (config.baseURL) clientArgs.baseURL = config.baseURL`  `model` has the same shape: `manager.ts:116` defaults it to `gpt-5-mini` for every provider, which makes each provider's own fallback unreachable (`deepseek-chat`, `grok-4.3`, `llama3.1:8b`, `gemini-2.0-flash`, `claude-sonnet-4-6`, ...).  The documented snippets are what break. `docs/components/llms/models/deepseek.mdx:44-55` shows:  ```ts llm: {   provider: 'deepseek',   config: {     apiKey: process.env.DEEPSEEK_API_KEY || '',     model: 'deepseek-chat',     temp
  **Post-Mortem & Fix Analysis**:
  > Filed this after tracing it through `ConfigManager.mergeConfig`: `DEFAULT_MEMORY_CONFIG.llm.config` carries OpenAI's `baseURL` and `model`, and the merge hands both to every provider except vLLM, so each provider's own default and its `*_API_BASE` env fallback are unreachable.  Two existing tests already assert the old behaviour (provider `ollama` at `config-manager.test.ts:145`, provider `lmstudio` at `:370`), and the adjacent vLLM test asserts the opposite, so I read the intended rule as "provider-specific defaults stay with their provider" and extended it to the rest.  Fix is up in #7350: `openai` and `openai_structured` keep the defaults, everything else falls back to its own. Full TypeScript suite is green locally (94 suites, 1531 tests).  Could someone apply `accepted` if the direction looks right? Two things I deliberately left out of scope and can add if you want them: the `apiKey` fallback (`manager.ts:152-155`) and the embedder `model` default, which are the same root cause. 
  > Confirmed — merge-order bug. `DEFAULT_MEMORY_CONFIG.llm.config` holds OpenAI's `baseURL`/`model`, and `mergeConfig` applies those defaults before your provider config, so anything you leave unset inherits OpenAI's values and gets sent to `api.openai.com`. Fix is to key defaults by provider and only apply `llm.config` when the provider matches; until that lands, set `baseURL` and `model` explicitly for non-OpenAI providers:  ```python config = {     "llm": {         "provider": "ollama",         "config": {             "model": "llama3",             "base_url": "http://localhost:11434",         },     } } ```
  > Hi, I am investigating this issue and working on a fix with unit tests. I will submit a pull request once verification is complete.

- **Issue #7199** (2026-09-01): **docs: fix Oracle vector store setup and search examples**
  *Symptoms*: ### Component  Vector Store  ### Description  fix Oracle vector store setup and search examples  ### How You Verified This  ### What I Ran  The exact command or script, and where it ran.  ### What I Saw  The real output, log line, or traceback. Paste it, do not describe it.  ### Why This Is a Bug  What should have happened instead, and what says so: a docs link, a docstring, a test, or the code itself.  ### What I Ruled Out  Anything you checked that turned out not to be the cause.   ### AI Assistance  No AI involved

- **Issue #6994** (2026-09-23): **Protect against None timestamps in Valkey layer**
  *Symptoms*: ### Component  Python SDK  ### Description  ### Summary  On the Valkey vector store, `insert()`/`update()` call `datetime.fromisoformat()` on `created_at`/`updated_at` unconditionally. When the value is `None`, this raises `TypeError: fromisoformat: argument must be str`. It triggers in inference mode (`infer=True`): entity records never set timestamps, `list()` reads them back as `None`, and `_upsert_entity` feeds that payload straight into `update()`. The error is swallowed as a warning inside consolidation, so the run "succeeds" but the entity link is silently never updated — degrading entity-boost ranking on Valkey only. Qdrant and other backends run the same scenario cleanly.  ### Steps to Reproduce  ```python from mem0 import Memory  config = {     "vector_store": {         "provider": "valkey",         "config": {             "collection_name": "repro",             "embedding_model_dims": 1536,             "valkey_url": "valkey://localhost:6379",         },     }, } m = Memory.from_config(config)  # Two infer=True adds mentioning the same proper noun → same entity upserted twice. # The second upsert reads the entity back (updated_at=None) and calls update(). m.add("Alice loves hiking in the mountains.", user_id="u1")   # creates entity "Alice" m.add("Alice also enjoys rock climbing.", user_id="u1")       # updates entity "Alice" → crash path ```  ### Expected Behavior  Both adds complete, and the "Alice" entity's `linked_memory_ids` is updated to include both memories.
  **Post-Mortem & Fix Analysis**:
  > Reproduced this on current main (commit `001c2352`) with a mocked Valkey client — the second infer=True add hits `fromisoformat(None)` in `ValkeyDB.update()` and the entity link is dropped, exactly as described. I have a minimal fix ready: treat `None` timestamps like missing ones in `insert()`/`update()` (`created_at` falls back to now, `updated_at` is omitted so the partial HSET preserves the stored value), plus regression tests that fail on main and pass with the fix. Could a maintainer label this `accepted` so the PR can pass the gate? Happy to adjust the approach if you'd prefer `updated_at` to be stamped with now() instead of omitted.
  > @MohitRawat017 I already attached a PR. I'd suggest leaving comments on that one if you think it can be improved since yours looks quite similar.
  > @kartik-mem0 Hi! I opened PR #7062 to fix this issue (guarding against `None` timestamps in the Valkey layer). The PR was closed per the contribution policy because the issue lacks the `accepted` label.  Could you please add the `accepted` label so the PR can be reopened for review? Thanks!

- **Issue #6982** (2026-08-29): **Fix linked_memory_ids being computed by the LLM but discarded by the add pipeline**
  *Symptoms*: ### Component  Python SDK  ### Description  ### Summary  The V3 additive extraction prompt asks the LLM to emit `linked_memory_ids` so new memories can be related to existing ones, but `_add_to_vector_store` never reads that field. The LLM-computed semantic links are dropped, and retrieval falls back to string-based entity linking only. The prompt also instructs the LLM to return UUIDs while the pipeline only shows it integer ids, making the field unreliable by construction.  ### Steps to Reproduce  ```python from types import SimpleNamespace from unittest.mock import MagicMock, Mock, patch from mem0 import Memory  m = Memory.__new__(Memory) m.config = MagicMock() m.config.custom_instructions = None m.custom_instructions = None m.api_version = "v1.1" m.llm = Mock() m.embedding_model = Mock() m.vector_store = Mock() m.db = Mock() m.db.get_last_messages.return_value = [] m.db.save_messages = MagicMock() m.db.batch_add_history = MagicMock() m._entity_store = Mock() m._entity_store.search_batch.return_value = [[]]  m.vector_store.search.return_value = [     SimpleNamespace(id="uuid-a", payload={"data": "User has a dog named Poppy"}) ] m.llm.generate_response.return_value = (     '{"memory": [{"text": "Poppy had a vet checkup", "linked_memory_ids": ["0"]}]}' ) m.embedding_model.embed.return_value = [0.1, 0.2, 0.3] m.embedding_model.embed_batch.return_value = [[0.1]]  with patch("mem0.memory.main.capture_event"):     m._add_to_vector_store(         messages=[{"role": "user", "conte
  **Post-Mortem & Fix Analysis**:
  > I'd like to take this one.  **Root cause confirmed:** in both `Memory._add_to_vector_store` and `AsyncMemory._add_to_vector_store` (`mem0/memory/main.py`), Phase 4 copies only `text` and `attributed_to` off each LLM-extracted memory dict into `mem_metadata` before persisting — `linked_memory_ids` is parsed out of the LLM's JSON response and then dropped on the floor. Separately, the prompt's "Existing Memories" section told the LLM those ids were UUIDs and that `linked_memory_ids` should contain UUIDs, but the pipeline only ever shows the LLM sequential anti-hallucination index strings (`"0"`, `"1"`, ...) via `uuid_mapping` — so the field's documented contract never matched what was actually presented to the model.  **Proposed fix** 1. Added `_resolve_linked_memory_ids(raw, uuid_mapping)` — translates the LLM's index strings back to real vector-store IDs via the existing `uuid_mapping` built in Phase 1, dropping anything non-string, unresolvable (hallucinated), or duplicate rather than
  > Fix is up at #6983 (linked via `Closes #6982`) — closed automatically by the PR Gate pending the `accepted` label on this issue. Happy to address any review feedback once it's reopened.
  > Hi maintainers,  I've opened PR #7104 with the fix and regression tests. The change:  - adds `_resolve_linked_memory_ids()` to map LLM index strings back to real vector-store IDs via `uuid_mapping` - persists resolved `linked_memory_ids` in sync/async `_add_to_vector_store` - aligns prompt examples with the index-string Existing Memories contract  CLA is already signed on our account. Could you please review and add the `accepted` label when the approach looks good? Happy to address any feedback.  Thanks!

- **Issue #6976** (2026-08-20): **fix(plugins): bug-bash fixes for Cursor, Codex, Antigravity, and a Claude.ai docs page**
  *Symptoms*: ### Component  Python SDK  ### Description  fixing the issued during bug bash  ### How You Verified This  ### What I Ran  The exact command or script, and where it ran.  ### What I Saw  The real output, log line, or traceback. Paste it, do not describe it.  ### Why This Is a Bug  What should have happened instead, and what says so: a docs link, a docstring, a test, or the code itself.  ### What I Ruled Out  Anything you checked that turned out not to be the cause.   ### AI Assistance  No AI involved

- **Issue #6911** (2026-09-24): **add() returns event: ADD for memories the vector store never persisted**
  *Symptoms*: ### Component  Python SDK  ### Description  ### Summary  When a batch insert into the vector store fails, `_add_to_vector_store` retries record-by-record. Records that also fail the retry are logged and skipped — but the returned payload, the history rows, and entity linking are all still built from the full extracted set. Callers receive `{"id": ..., "event": "ADD"}` for memories that were never stored, and `get()` on those ids later returns nothing.  Affects both `Memory` and `AsyncMemory`.  ### Steps to Reproduce  ```python from mem0 import Memory  m = Memory()  # Simulate a store that rejects one record: batch insert fails, # then one record also fails the per-record retry. real_insert = m.vector_store.insert POISON = "User is allergic to penicillin"  def flaky_insert(vectors, ids, payloads):     if len(ids) > 1:         raise RuntimeError("batch insert rejected")     if payloads[0].get("data") == POISON:         raise RuntimeError("record rejected by vector store")     return real_insert(vectors=vectors, ids=ids, payloads=payloads)  m.vector_store.insert = flaky_insert  result = m.add(     [{"role": "user", "content": f"My name is Aryan. {POISON}. I work as an engineer."}],     user_id="u1", )  for r in result["results"]:     print(r["event"], r["id"], repr(r["memory"]), "| in store:", m.vector_store.get(r["id"]) is not None) ```  ### Expected Behavior  Only memories that actually persisted are returned as `ADD`. A record the store rejected should not appear in the resul
  **Post-Mortem & Fix Analysis**:
  > Maintainer triage request (per the new PR-gate policy): I have a fix ready for this in #7066, and it will auto-reopen from the gate queue once this issue is labeled `accepted`.  Quick summary of the approach so you can veto cheaply before reviewing:  - `Memory._add_to_vector_store` / `AsyncMemory._add_to_vector_store` now track which records actually persisted (batch insert success = all persisted; on fallback, only records whose per-record insert succeeded). - Records the store rejected are excluded from the returned results, get no `ADD` history row, and are not referenced by entity `linked_memory_ids`. - If nothing persists at all, `add()` raises `VectorStoreError` — which the docstring already documented but nothing raised. Raw messages are still saved first so a retry can re-extract.  One semantic choice worth confirming: on **partial** failure the call still succeeds and returns only the persisted records (rather than raising). If you would prefer partial failures to also raise, 

- **Issue #6783** (2026-09-22): **[Codex plugin] Exported MEM0_API_KEY is filtered before MCP startup in managed environments**
  *Symptoms*: ### Component  Plugin  ### Description    ### Summary    I am following the official Mem0 Codex integration guide and installing the recommended marketplace plugin, but the plugin fails to initialize because Codex reports that `MEM0_API_KEY` is not set.    The variable is correctly exported from Bash and visible to ordinary child processes immediately before launching Codex. In this managed Codex environment, variables whose names contain `KEY`, `SECRET`, or   `TOKEN` appear to be filtered before MCP initialization.    The Mem0 plugin manifest hardcodes:    ```json   "bearer_token_env_var": "MEM0_API_KEY"   ```    Consequently, there is no narrow way to select a differently named credential variable for the plugin.    Related but distinct issue: #6346 covers `mem0 init` saving a key without exporting it. In this report, the key is already exported successfully and is removed later during Codex/MCP startup.    ### Steps to Reproduce    1. Add the API key to Bash as documented:    ```bash   echo 'export MEM0_API_KEY="m0-REDACTED"' >> ~/.bashrc   source ~/.bashrc   ```    2. Confirm that it is set and exported to child processes:    ```bash   test -n "$MEM0_API_KEY" && echo "set" || echo "missing"   # set    export -p | grep 'declare -x MEM0_API_KEY='   # Shows MEM0_API_KEY as exported    env | cut -d= -f1 | grep -x MEM0_API_KEY   # MEM0_API_KEY   ```    3. Install the recommended plugin:    ```bash   codex plugin marketplace add mem0ai/mem0   codex plugin add mem0@mem0-plugins 
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed reproduction. I confirmed the Codex plugin currently hard-codes `MEM0_API_KEY` in `integrations/mem0-plugin/.codex-mcp.json`, so this needs a maintainer decision about the credential contract rather than an unreviewed config tweak.  Could you confirm which direction you prefer?  1. Change only the Codex plugin manifest and Codex installation guide to a non-filtered credential variable (for example `MEM0_AUTH`), with a clear migration note; or 2. Keep `MEM0_API_KEY` as the plugin contract and document a narrowly scoped Codex policy/configuration that exposes that one variable without disabling the default secret exclusions globally.  I would keep the change limited to the selected contract and its documentation, preserve the other editor manifests, and add focused manifest/docs validation where the repository supports it. I will wait for that choice before opening a PR, since `ignore_default_excludes=true` is intentionally broader than a plugin-specific fix.
  > Confirmed. `integrations/mem0-plugin/.codex-mcp.json` hardcodes `bearer_token_env_var: "MEM0_API_KEY"`, and `docs/integrations/codex.mdx` documents the same name for the direct-MCP path too. Codex's own default shell environment policy strips env vars matching `*KEY*`, `*SECRET*`, or `*TOKEN*` before MCP servers start, unless `ignore_default_excludes` is set. So Codex filters `MEM0_API_KEY` before our server ever sees it. Nothing on our side mishandles the key, Codex just never hands it over.  The breakdown is right: this needs a naming decision, not a quick patch. Rename to something the filter won't catch (breaking, needs a migration note), or keep `MEM0_API_KEY` and document a narrow Codex allowlist override instead of the broad `ignore_default_excludes=true`. I'll pick a direction, then we update the manifest and docs together so plugin and direct-MCP stay consistent. 
  > Thank you for the detailed report and reproduction steps. We rechecked this against the current plugin and the Codex source, and we are closing it as outdated for the current integration.  #7203 replaced the old `integrations/mem0-plugin/.codex-mcp.json` HTTP configuration with the native Codex plugin. Its local MCP manifest explicitly forwards `MEM0_API_KEY`: https://github.com/mem0ai/mem0/blob/main/integrations/codex-plugin/.mcp.json  We also need to correct our earlier diagnosis: Codex 0.146.0 resolves HTTP MCP bearer tokens directly from its process environment; the shell-command environment filter does not by itself explain this lookup failure. Source: https://github.com/openai/codex/blob/rust-v0.146.0/codex-rs/codex-mcp/src/rmcp_client.rs#L780-L805  We have not reproduced your specific managed exe.dev environment, so this does not dismiss the failure you observed. If it still occurs after upgrading the plugin and Codex, please share the current versions, launch method, and a reda

- **Issue #6686** (2026-08-14): **Python SDK: Redis vector store tests false-pass their skip check on vanilla Redis, then hard-fail**
  *Symptoms*: ### Summary  `TestRedisThreshold` (tests/vector_stores/test_e2e_threshold.py) and `TestRedis` (tests/vector_stores/test_score_normalization.py) are meant to skip when Redis isn't available, per the file's own docstring: "External providers (PGVector, Redis, Milvus, etc.) are skipped unless the service is reachable." Their skip condition only checks TCP reachability, not whether the connected Redis actually supports RediSearch (the `FT.*` command family mem0's Redis vector store depends on). Anyone running a plain, non-Stack Redis locally (e.g. `brew install redis`, common for caching/sessions/other projects) gets a false pass on the skip check and a hard test failure instead of a clean skip.  ### Steps to Reproduce  ```bash # Start a vanilla (non-Stack) Redis locally redis-server --daemonize yes redis-cli ping        # PONG redis-cli MODULE LIST # (empty — no RediSearch loaded)  # Run the affected tests pytest tests/vector_stores/test_e2e_threshold.py::TestRedisThreshold pytest tests/vector_stores/test_score_normalization.py::TestRedis  ### Expected Behavior Per the file's own docstring, these tests should skip cleanly with a message like "Redis not reachable" (or, more accurately, "RediSearch not available") when the environment doesn't support what the test needs.  ### Actual Behavior Both tests run (skip condition wrongly evaluates to "don't skip") and then fail with a raw client error:  FAILED tests/vector_stores/test_e2e_threshold.py::TestRedisThreshold::test_threshold_f
  **Post-Mortem & Fix Analysis**:
  > Confirmed. With a vanilla Redis running (no RediSearch), _tcp_reachable returns True, so the skip is bypassed, and both test classes hit redis.exceptions.ResponseError: unknown command 'FT._LIST', matching your traceback (reproduced against a real redis:7-alpine container).  Cause is tests/vector_stores/test_score_normalization.py:242-244 and tests/vector_stores/test_e2e_threshold.py:252-254: the skipif only checks TCP reachability, never whether the search module (RediSearch) is loaded.  Next: PR #6687 fixes this with a _redis_search_available() helper that checks MODULE LIST before running. Review is there.
  > @kartik-mem0 Just following up on this PR. Since it addresses the linked issue, wanted to check if there’s anything else needed from my side. Happy to make any changes

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

### Incident Patch 1: `947ac798` (2026-09-25)
**Commit Message**: fix(ts-sdk): stop forcing pg on installs (optional ranged pg peer, optional natural) (#7450)

**File**: `docs/components/vectordbs/dbs/pgvector.mdx` (modified, +6/-0)
```diff
@@ -5,6 +5,12 @@ description: "Use pgvector as a vector store in Mem0 for PostgreSQL-based vector
 
 [pgvector](https://github.com/pgvector/pgvector) is an open-source vector similarity search extension for Postgres. After connecting to Postgres, run `CREATE EXTENSION IF NOT EXISTS vector;` to create the vector extension.
 
+The TypeScript SDK loads the `pg` driver only when you use this store, so install it alongside `mem0ai`:
+
+```bash
+npm install pg
+```
+
 ### Usage
 
 <CodeGroup>
```

**File**: `mem0-ts/package.json` (modified, +13/-4)
```diff
@@ -100,7 +100,8 @@
     "tsup": "^8.3.0",
     "typescript": "5.5.4",
     "iovalkey": "^0.3.3",
-    "@mochow/mochow-sdk-node": "^2.1.5"
+    "@mochow/mochow-sdk-node": "^2.1.5",
+    "@types/jest": "^29.5.14"
   },
   "dependencies": {
     "axios": "^1.18.0",
@@ -127,8 +128,7 @@
     "@qdrant/js-client-rest": "^1.18.0",
     "@supabase/supabase-js": "^2.49.1",
     "@turbopuffer/turbopuffer": "^2.0.0",
-    "@types/jest": "29.5.14",
-    "@types/pg": "8.11.0",
+    "@types/pg": "^8.11.0",
     "@upstash/vector": "^1.2.3",
     "better-sqlite3": "^12.6.2",
     "cassandra-driver": "4.8.0",
@@ -141,7 +141,7 @@
     "weaviate-client": "^3.0.0",
     "ollama": "^0.5.14",
     "oracledb": "^6.5.0 || ^7.0.0",
-    "pg": "8.11.3",
+    "pg": "^8.11.3",
     "redis": "^4.6.13",
     "@elastic/elasticsearch": "^9.0.0",
     "iovalkey": "^0.3.3",
@@ -257,6 +257,15 @@
     },
     "oracledb": {
       "optional": true
+    },
+    "pg": {
+      "optional": true
+    },
+    "@types/pg": {
+      "optional": true
+    },
+    "natural": {
+      "optional": true
     }
   },
   "engines": {
```

**File**: `mem0-ts/pnpm-lock.yaml` (modified, +6/-42)
```diff
@@ -109,11 +109,8 @@ importers:
       '@turbopuffer/turbopuffer':
         specifier: ^2.0.0
         version: 2.5.0
-      '@types/jest':
-        specifier: 29.5.14
-        version: 29.5.14
       '@types/pg':
-        specifier: 8.11.0
+        specifier: ^8.11.0
         version: 8.11.0
       '@upstash/vector':
         specifier: ^1.2.3
@@ -167,8 +164,8 @@ importers:
         specifier: ^6.5.0 || ^7.0.0
         version: 7.0.1
       pg:
-        specifier: 8.11.3
-        version: 8.11.3
+        specifier: ^8.11.3
+        version: 8.21.0
       redis:
         specifier: ^4.6.13
         version: 4.7.1
@@ -191,6 +188,9 @@ importers:
       '@types/better-sqlite3':
         specifier: ^7.6.13
         version: 7.6.13
+      '@types/jest':
+        specifier: ^29.5.14
+        version: 29.5.14
       '@types/node':
         specifier: ^22.7.6
         version: 22.19.21
@@ -2228,10 +2228,6 @@ packages:
   buffer-from@1.1.2:
     resolution: {integrity: sha512-E+XQCRwSbaaiChtv6k6Dwgc+bx+Bs6vuKJHHl5kox/BaKbhiXzqQOwK4cO22yElGp2OCmjwVhT3HmxgyPGnJfQ==}
 
-  buffer-writer@2.0.0:
-    resolution: {integrity: sha512-a7ZpuTZU1TRtnwyCNW3I5dc0wWNC3VR9S++Ewyk2HHZdrO3CQJqSpd+95Us590V6AL7JqUAH2IwZ/398PmNFgw==}
-    engines: {node: '>=4'}
-
   buffer@5.7.1:
     resolution: {integrity: sha512-EHcyIPBQ4BSGlvjB16k5KgAJ27CIsHY/2JBmCRReo48y9rQ3MaUzWX3KVlBa4U7MyX02HdVj0K7C3WaB3ju7FQ==}
 
@@ -3846,9 +3842,6 @@ packages:
   package-json-from-dist@1.0.1:
     resolution: {integrity: sha512-UEZIS3/by4OC8vL3P2dTXRETpebLI2NiI5vIrjaD/5UtrkFX/tNbwjTSRAGC/+7CAo2pIcBaRgWmcBBHcsaCIw==}
 
-  packet-reader@1.0.0:
-    resolution: {integrity: sha512-HAKu/fG3HpHFO0AA8WE8q2g+gBJaZ9MG7fcKk+IJPLTGAD6Psw4443l+9DGRbOIh3/aXr7Phy0TjilYivJo5XQ==}
-
   pad-left@2.1.0:
     resolution: {integrity: sha512-HJxs9K9AztdIQIAIa/OIazRAUW/L6B9hbQDxO4X07roW3eo9XqZc2ur9bn1StH9CnbbI9EgvejHQX7CBpCF1QA==}
     engines: {node: '>=0.10.0'}
@@ -3920,15 +3913,6 @@ packages:
     resolution: {integrity: sha512-o2XFanIMy/3+mThw69O8d4n1E5zsLhdO+OPqswezu7Z5ekP4hYDqlDjlmOpYMbzY2Br0ufCwJLdDIXeNVwcWFg==}
     engines: {node: '>=10'}
 
-  pg@8.11.3:
-    resolution: {integrity: sha512-+9iuvG8QfaaUrrph+kpF24cXkH1YOOUeArRNYIxq1viYHZagBxrTno7cecY1Fa44tJeZvaoG+Djpkc3JwehN5g==}
-    engines: {node: '>= 8.0.0'}
-    peerDependencies:
-      pg-native: '>=3.0.1'
-    peerDependenciesMeta:
-      pg-native:
-        optional: true
-
   pg@8.21.0:
     resolution: {integrity: sha512-AUP1EYJuHraQGsVoCQVIcM7TEJVGtDzxWtGFZd8rds9d+CCXlU5Js1rYgfLNvxy9iJrpHjGrRjoi/3BT9fRyiA==}
     engines: {node: '>= 16.0.0'}
@@ -7593,8 +7577,6 @@ snapshots:
 
   buffer-from@1.1.2: {}
 
-  buffer-writer@2.0.0: {}
-
   buffer@5.7.1:
     dependencies:
       base64-js: 1.5.1
@@ -9409,8 +9391,6 @@ snapshots:
 
   package-json-from-dist@1.0.1: {}
 
-  packet-reader@1.0.0: {}
-
   pad-left@2.1.0:
     dependencies:
       repeat-string: 1.6.1
@@ -9458,10 +9438,6 @@ snapshots:
 
   pg-numeric@1.0.2: {}
 
-  pg-pool@3.14.0(pg@8.11.3):
-    dependencies:
-      pg: 8.11.3
-
   pg-pool@3.14.0(pg@8.21.0):
     dependencies:
       pg: 8.21.0
@@ -9486,18 +9462,6 @@ snapshots:
       postgres-interval: 3.0.0
       postgres-range: 1.1.4
 
-  pg@8.11.3:
-    dependencies:
-      buffer-writer: 2.0.0
-      packet-reader: 1.0.0
-      pg-connection-string: 2.13.0
-      pg-pool: 3.14.0(pg@8.11.3)
-      pg-protocol: 1.14.0
-      pg-types: 2.2.0
-      pgpass: 1.0.5
-    optionalDependencies:
-      pg-cloudflare: 1.4.0
-
   pg@8.21.0:
     dependencies:
       pg-connection-string: 2.13.0
```

**File**: `mem0-ts/src/oss/src/vector_stores/pgvector.ts` (modified, +29/-11)
```diff
@@ -1,8 +1,11 @@
 import type { Client as ClientType, ClientConfig } from "pg";
-import pkg from "pg";
-const { Client, escapeIdentifier } = pkg;
 import { VectorStore } from "./base";
 import { SearchFilters, VectorStoreConfig, VectorStoreResult } from "../types";
+import { loadPeer } from "../utils/load_peer";
+
+function escapeIdentifier(name: string): string {
+  return `"${name.replace(/"/g, '""')}"`;
+}
 
 const SAFE_IDENTIFIER_RE = /^[a-zA-Z_][a-zA-Z0-9_]{0,127}$/;
 
@@ -212,7 +215,7 @@ function buildClientConfig(
 }
 
 export class PGVector implements VectorStore {
-  private client: ClientType;
+  private client!: ClientType;
   private collectionName: string;
   private useDiskann: boolean;
   private useHnsw: boolean;
@@ -234,13 +237,6 @@ export class PGVector implements VectorStore {
       ? ""
       : validateIdentifier(config.dbname || "vector_store", "dbname");
     this.config = config;
-
-    this.client = new Client(
-      buildClientConfig(
-        config,
-        this.useDirectConnection ? undefined : "postgres",
-      ),
-    );
     this.initialize().catch(console.error);
   }
 
@@ -257,6 +253,18 @@ export class PGVector implements VectorStore {
 
   private async _doInitialize(): Promise<void> {
     try {
+      const pg = await loadPeer(
+        "pg",
+        "PGVector vector store",
+        () => import("pg"),
+      );
+      const { Client } = pg.default ?? pg;
+      this.client = new Client(
+        buildClientConfig(
+          this.config,
+          this.useDirectConnection ? undefined : "postgres",
+        ),
+      );
       await this.client.connect();
 
       if (!this.useDirectConnection) {
@@ -345,6 +353,7 @@ export class PGVector implements VectorStore {
     ids: string[],
     payloads: Record<string, any>[],
   ): Promise<void> {
+    await this.initialize();
     const values = vectors.map((vector, i) => ({
       id: ids[i],
       vector: `[${vector.join(",")}]`,
@@ -368,6 +377,7 @@ export class PGVector implements VectorStore {
     topK: number = 5,
     filters?: SearchFilters,
   ): Promise<VectorStoreResult[] | null> {
+    await this.initialize();
     try {
       const {
         conditions,
@@ -406,6 +416,7 @@ export class PGVector implements VectorStore {
     topK: number = 5,
     filters?: SearchFilters,
   ): Promise<VectorStoreResult[]> {
+    await this.initialize();
     const queryVector = `[${query.join(",")}]`;
     const {
       conditions,
@@ -435,6 +446,7 @@ export class PGVector implements VectorStore {
   }
 
   async get(vectorId: string): Promise<VectorStoreResult | null> {
+    await this.initialize();
     const result = await this.client.query(
       `SELECT id, payload FROM ${this.col()} WHERE id = $1`,
       [vectorId],
@@ -453,6 +465,7 @@ export class PGVector implements VectorStore {
     vector: number[],
     payload: Record<string, any>,
   ): Promise<void> {
+    await this.initialize();
     const vectorStr = `[${vector.join(",")}]`;
     await this.client.query(
       `
@@ -465,12 +478,14 @@ export class PGVector implements VectorStore {
   }
 
   async delete(vectorId: string): Promise<void> {
+    await this.initialize();
     await this.client.query(`DELETE FROM ${this.col()} WHERE id = $1`, [
       vectorId,
     ]);
   }
 
   async deleteCol(): Promise<void> {
+    await this.initialize();
     await this.client.query(`DROP TABLE IF EXISTS ${this.col()}`);
   }
 
@@ -487,6 +502,7 @@ export class PGVector implements VectorStore {
     filters?: SearchFilters,
     topK: number = 100,
   ): Promise<[VectorStoreResult[], number]> {
+    await this.initialize();
     const {
       conditions,
       values: filterValues,
@@ -525,10 +541,11 @@ export class PGVector implements VectorStore {
   }
 
   async close(): Promise<void> {
-    await this.client.end();
+    await this.client?.end();
   }
 
   async getUserId(): Promise<string> {
+    await this.initialize();
     const result = await this.client.query(
       "SELECT 
```

**File**: `mem0-ts/src/oss/tests/missing-optional-peers.test.ts` (added, +39/-0)
```diff
@@ -0,0 +1,39 @@
+jest.mock("pg", () => {
+  throw new Error("Cannot find module 'pg'");
+});
+
+jest.mock("natural", () => {
+  throw new Error("Cannot find module 'natural'");
+});
+
+describe("mem0ai/oss without pg or natural installed", () => {
+  beforeEach(() => {
+    jest.spyOn(console, "error").mockImplementation(() => {});
+  });
+
+  afterEach(() => {
+    jest.restoreAllMocks();
+  });
+
+  test("mem0ai/oss loads", async () => {
+    await expect(import("../src")).resolves.toHaveProperty("Memory");
+  });
+
+  test("PGVector explains how to install pg", async () => {
+    const { PGVector } = await import("../src/vector_stores/pgvector");
+    const store = new PGVector({
+      connectionString: "postgresql://localhost:5432/db",
+      embeddingModelDims: 3,
+    } as any);
+
+    await expect(store.initialize()).rejects.toThrow(
+      "The 'pg' package is required to use the PGVector vector store. Install it with: npm install pg",
+    );
+  });
+
+  test("BM25 lemmatization falls back to the built-in stemmer", async () => {
+    const { lemmatizeForBm25 } = await import("../src/utils/lemmatization");
+
+    expect(lemmatizeForBm25("The dogs were running")).toBe("dog runn running");
+  });
+});
```

---

### Incident Patch 2: `8127e8bd` (2026-09-25)
**Commit Message**: fix(vector_stores/turbopuffer): make search score respect distance_metric (#6559)

**File**: `mem0/vector_stores/turbopuffer.py` (modified, +8/-1)
```diff
@@ -122,7 +122,14 @@ def _parse_output(self, rows) -> List[OutputData]:
             dist = row_dict.pop("$dist", None)
             row_dict.pop("vector", None)
 
-            score = 1 - dist if dist is not None else None
+            if dist is None:
+                score = None
+            elif self.distance_metric == "euclidean_squared":
+                # $dist is unbounded squared-L2 (lower = closer); map to a bounded
+                # higher-is-better score, mirroring milvus/baidu. Cosine returns 1 - dist.
+                score = 1.0 / (1.0 + dist)
+            else:
+                score = 1 - dist
 
             results.append(OutputData(
                 id=row_id,
```

**File**: `tests/vector_stores/test_turbopuffer.py` (modified, +29/-0)
```diff
@@ -232,6 +232,35 @@ def test_parse_rows_strips_vector_and_id(self, db):
     def test_parse_empty_rows(self, db):
         assert db._parse_output([]) == []
 
+    def test_parse_cosine_score_is_one_minus_dist(self, db):
+        # Default cosine metric: score = 1 - dist, unchanged by the metric fix.
+        results = db._parse_output([_make_row("id1", dist=0.25)])
+        assert results[0].score == pytest.approx(0.75)
+
+    def test_parse_euclidean_squared_score_is_bounded(self, mock_client):
+        # euclidean_squared $dist is unbounded (e.g. 4.0). 1 - dist would give -3.0,
+        # violating the higher-is-better contract; map it to 1/(1+dist) instead.
+        db = TurbopufferDB(
+            collection_name="test_ns",
+            embedding_model_dims=4,
+            api_key="tpuf_test_key",
+            region="gcp-us-central1",
+            distance_metric="euclidean_squared",
+        )
+        results = db._parse_output([_make_row("id1", dist=4.0)])
+        assert results[0].score == pytest.approx(0.2)
+        assert 0.0 <= results[0].score <= 1.0
+
+    def test_parse_euclidean_squared_preserves_none(self, mock_client):
+        db = TurbopufferDB(
+            collection_name="test_ns",
+            embedding_model_dims=4,
+            api_key="tpuf_test_key",
+            region="gcp-us-central1",
+            distance_metric="euclidean_squared",
+        )
+        assert db._parse_output([_make_row("id1")])[0].score is None
+
 
 # ── _convert_filters ─────────────────────────────────────────────────
 
```

---

### Incident Patch 3: `5fd01d28` (2026-09-25)
**Commit Message**: fix(ts-oss/turbopuffer): bound euclidean_squared distance to a similarity score (#6580)

**File**: `mem0-ts/src/oss/src/vector_stores/turbopuffer.ts` (modified, +12/-1)
```diff
@@ -305,7 +305,18 @@ export class TurbopufferDB implements VectorStore {
   private parseRows(rows: any[]): VectorStoreResult[] {
     return rows.map((row) => {
       const { id, $dist, vector, ...rest } = row;
-      const score = $dist != null ? 1 - $dist : undefined;
+      let score: number | undefined;
+      if ($dist == null) {
+        score = undefined;
+      } else if (this.distanceMetric === "euclidean_squared") {
+        // euclidean_squared $dist is an unbounded squared distance, so 1 - $dist
+        // goes negative for any $dist > 1 and inverts ranking. Convert it to a
+        // bounded higher-is-better score, mirroring the milvus/baidu stores.
+        score = 1 / (1 + $dist);
+      } else {
+        // Cosine distance is in [0, 2]; 1 - $dist stays a meaningful similarity.
+        score = 1 - $dist;
+      }
       return { id: String(id), payload: rest, score };
     });
   }
```

**File**: `mem0-ts/src/oss/tests/turbopuffer.score.test.ts` (added, +80/-0)
```diff
@@ -0,0 +1,80 @@
+/// <reference types="jest" />
+/**
+ * Turbopuffer vector store — score conversion unit tests.
+ *
+ * Drives parseRows() through the public search() API with a virtually-mocked
+ * @turbopuffer/turbopuffer peer, asserting the score returned per metric.
+ */
+
+const mockQuery = jest.fn();
+
+jest.mock(
+  "@turbopuffer/turbopuffer",
+  () => ({
+    __esModule: true,
+    default: class {
+      namespace() {
+        return { query: mockQuery };
+      }
+    },
+  }),
+  { virtual: true },
+);
+
+import { TurbopufferDB } from "../src/vector_stores/turbopuffer";
+
+function makeStore(distanceMetric?: string) {
+  return new TurbopufferDB({
+    apiKey: "test-key",
+    collectionName: "mem0",
+    ...(distanceMetric ? { distanceMetric } : {}),
+  } as any);
+}
+
+async function scoreFor(
+  distanceMetric: string | undefined,
+  row: Record<string, any>,
+): Promise<number | undefined> {
+  mockQuery.mockResolvedValueOnce({ rows: [row] });
+  const results = await makeStore(distanceMetric).search([0.1, 0.2, 0.3], 5);
+  return results[0].score;
+}
+
+describe("TurbopufferDB score conversion", () => {
+  it("keeps cosine distance as 1 - dist (default metric)", async () => {
+    // cosine_distance is the default; a distance of 0.25 -> similarity 0.75.
+    expect(await scoreFor(undefined, { id: "a", $dist: 0.25 })).toBeCloseTo(
+      0.75,
+      10,
+    );
+  });
+
+  it("bounds an unbounded euclidean_squared distance to a 0..1 similarity", async () => {
+    // $dist = 4.0 is a squared distance. 1 - 4.0 = -3.0 would invert ranking;
+    // 1 / (1 + 4.0) = 0.2 keeps it higher-is-better and in range.
+    const score = await scoreFor("euclidean_squared", { id: "a", $dist: 4.0 });
+    expect(score).toBeCloseTo(0.2, 10);
+    expect(score!).toBeGreaterThanOrEqual(0);
+    expect(score!).toBeLessThanOrEqual(1);
+  });
+
+  it("ranks a nearer euclidean_squared hit above a farther one", async () => {
+    mockQuery.mockResolvedValueOnce({
+      rows: [
+        { id: "near", $dist: 1.0 },
+        { id: "far", $dist: 9.0 },
+      ],
+    });
+    const results = await makeStore("euclidean_squared").search(
+      [0.1, 0.2, 0.3],
+      5,
+    );
+    const near = results.find((r) => r.id === "near")!;
+    const far = results.find((r) => r.id === "far")!;
+    expect(near.score!).toBeGreaterThan(far.score!);
+  });
+
+  it("preserves an undefined score when the row has no distance", async () => {
+    expect(await scoreFor("euclidean_squared", { id: "a" })).toBeUndefined();
+  });
+});
```

---

### Incident Patch 4: `70c676c8` (2026-09-25)
**Commit Message**: fix: wire dev tooling (ruff/isort/pre-commit) into hatch dev environments (#6684)

**File**: `pyproject.toml` (modified, +9/-1)
```diff
@@ -83,7 +83,7 @@ test = [
 dev = [
     "ruff==0.16.0",
     "isort>=5.13.2",
-    "pytest>=8.2.2",
+    "pre-commit>=3.5.0",
 ]
 
 [tool.pytest.ini_options]
@@ -111,6 +111,7 @@ features = [
   "vector-stores",
   "llms",
   "extras",
+  "dev",
 ]
 
 [tool.hatch.envs.dev_py_3_11]
@@ -120,6 +121,7 @@ features = [
   "vector-stores",
   "llms",
   "extras",
+  "dev",
 ]
 
 [tool.hatch.envs.dev_py_3_12]
@@ -129,6 +131,12 @@ features = [
   "vector-stores",
   "llms",
   "extras",
+  "dev",
+]
+
+[tool.hatch.envs.default]
+features = [
+  "dev",
 ]
 
 [tool.hatch.envs.default.scripts]
```

---

### Incident Patch 5: `a2d8a8a8` (2026-09-25)
**Commit Message**: fix(vector_stores/s3_vectors): make search score metric-aware (#6547)

**File**: `mem0/vector_stores/s3_vectors.py` (modified, +11/-1)
```diff
@@ -69,6 +69,16 @@ def create_col(self, name, vector_size, distance="cosine"):
             else:
                 raise
 
+    def _distance_to_score(self, raw_distance: Optional[float]) -> Optional[float]:
+        if raw_distance is None:
+            return None
+        # Euclidean distance is unbounded, so 1 - distance would collapse most
+        # scores to 0. Use a bounded monotonic map instead. Cosine distance is
+        # in [0, 2], where 1 - distance is already a valid similarity.
+        if self.distance_metric == "euclidean":
+            return 1.0 / (1.0 + raw_distance)
+        return max(0.0, 1.0 - raw_distance)
+
     def _parse_output(self, vectors: List[Dict]) -> List[OutputData]:
         results = []
         for v in vectors:
@@ -81,7 +91,7 @@ def _parse_output(self, vectors: List[Dict]) -> List[OutputData]:
                     logger.warning(f"Failed to parse metadata for key {v.get('key')}")
                     payload = {}
             raw_distance = v.get("distance")
-            score = max(0.0, 1.0 - raw_distance) if raw_distance is not None else None
+            score = self._distance_to_score(raw_distance)
             results.append(OutputData(id=v.get("key"), score=score, payload=payload))
         return results
 
```

**File**: `tests/vector_stores/test_s3_vectors.py` (modified, +39/-0)
```diff
@@ -186,6 +186,45 @@ def test_search(mock_boto_client):
     assert results[0].score == pytest.approx(0.1)
 
 
+def test_search_score_cosine_uses_one_minus_distance(mock_boto_client):
+    """Cosine metric keeps the 1 - distance similarity mapping."""
+    mock_boto_client.query_vectors.return_value = {"vectors": [{"key": "id1", "distance": 0.25, "metadata": {}}]}
+    store = S3Vectors(
+        vector_bucket_name=BUCKET_NAME,
+        collection_name=INDEX_NAME,
+        embedding_model_dims=EMBEDDING_DIMS,
+        distance_metric="cosine",
+    )
+
+    results = store.search(query="test", vectors=[0.1, 0.2], top_k=1)
+
+    assert results[0].score == pytest.approx(0.75)
+
+
+def test_search_score_euclidean_uses_bounded_map(mock_boto_client):
+    """Euclidean distance is unbounded; scores must not collapse to 0."""
+    mock_boto_client.query_vectors.return_value = {
+        "vectors": [
+            {"key": "near", "distance": 0.5, "metadata": {}},
+            {"key": "far", "distance": 4.0, "metadata": {}},
+        ]
+    }
+    store = S3Vectors(
+        vector_bucket_name=BUCKET_NAME,
+        collection_name=INDEX_NAME,
+        embedding_model_dims=EMBEDDING_DIMS,
+        distance_metric="euclidean",
+    )
+
+    results = store.search(query="test", vectors=[0.1, 0.2], top_k=2)
+
+    # 1 / (1 + d): a distance > 1 would give a negative (clamped 0) score under
+    # the old cosine-only formula; the bounded map keeps ranking intact.
+    assert results[0].score == pytest.approx(1.0 / 1.5)
+    assert results[1].score == pytest.approx(1.0 / 5.0)
+    assert results[0].score > results[1].score > 0.0
+
+
 def test_get(mock_boto_client):
     """Test retrieving a vector by ID."""
     mock_boto_client.get_vectors.return_value = {
```

---

### Incident Patch 6: `fb6d5e19` (2026-09-25)
**Commit Message**: fix(llms/aws_bedrock): iterate Converse content blocks for Anthropic text (#6369)

**File**: `mem0/llms/aws_bedrock.py` (modified, +12/-3)
```diff
@@ -579,11 +579,20 @@ def _generate_standard(self, messages: List[Dict[str, str]], stream: bool = Fals
             # Use converse API for Anthropic models
             response = self.client.converse(**converse_params)
 
-            # Parse Converse API response
+            # Parse Converse API response. Claude reasoning models can emit a
+            # `reasoningContent` block before the `text` block, so iterate to
+            # find the first block that carries text instead of indexing
+            # content[0] (same approach as the MiniMax branch below).
             if hasattr(response, 'output') and hasattr(response.output, 'message'):
-                return response.output.message.content[0].text
+                for block in response.output.message.content:
+                    if hasattr(block, 'text'):
+                        return block.text
+                return ""
             elif 'output' in response and 'message' in response['output']:
-                return response['output']['message']['content'][0]['text']
+                for block in response['output']['message']['content']:
+                    if 'text' in block:
+                        return block['text']
+                return ""
             else:
                 return str(response)
 
```

**File**: `tests/llms/test_aws_bedrock.py` (modified, +48/-0)
```diff
@@ -506,3 +506,51 @@ def test_ai21_normal_response(self, mock_boto3):
         response = {"body": body}
         result = llm._parse_response(response, tools=None)
         assert result == "hello from ai21"
+
+
+class TestAnthropicConverseContentParsing:
+    """The Anthropic Converse branch must not assume content[0] is the text
+    block: Claude reasoning models emit a reasoningContent block before the
+    text block, and some stop conditions produce an empty content array. The
+    parser iterates for the first block carrying text, like the MiniMax branch.
+    """
+
+    def test_text_after_reasoning_content_block(self, mock_boto3):
+        mock_boto3.converse.return_value = {
+            "output": {
+                "message": {
+                    "content": [
+                        {"reasoningContent": {"reasoningText": {"text": "step by step..."}}},
+                        {"text": "final answer"},
+                    ]
+                }
+            }
+        }
+        llm = _make_llm("anthropic.claude-3-5-sonnet-20240620-v1:0", mock_boto3)
+
+        assert llm.generate_response(MESSAGES) == "final answer"
+
+    def test_empty_content_returns_empty_string(self, mock_boto3):
+        mock_boto3.converse.return_value = {"output": {"message": {"content": []}}}
+        llm = _make_llm("anthropic.claude-3-5-sonnet-20240620-v1:0", mock_boto3)
+
+        assert llm.generate_response(MESSAGES) == ""
+
+    def test_plain_text_content_still_returned(self, mock_boto3):
+        mock_boto3.converse.return_value = _converse_response("plain answer")
+        llm = _make_llm("anthropic.claude-3-5-sonnet-20240620-v1:0", mock_boto3)
+
+        assert llm.generate_response(MESSAGES) == "plain answer"
+
+    def test_object_style_response_iterates_blocks(self, mock_boto3):
+        # Defensive attr-style branch: object wrapper with a reasoning block first.
+        from types import SimpleNamespace
+
+        reasoning_block = SimpleNamespace(reasoningContent={"reasoningText": {"text": "hmm"}})
+        text_block = SimpleNamespace(text="object answer")
+        mock_boto3.converse.return_value = SimpleNamespace(
+            output=SimpleNamespace(message=SimpleNamespace(content=[reasoning_block, text_block]))
+        )
+        llm = _make_llm("anthropic.claude-3-5-sonnet-20240620-v1:0", mock_boto3)
+
+        assert llm.generate_response(MESSAGES) == "object answer"
```

---

### Incident Patch 7: `ccd216cf` (2026-09-25)
**Commit Message**: fix(vector_stores/turbopuffer): apply all filter operators instead of dropping them (#6564)

**File**: `mem0/vector_stores/turbopuffer.py` (modified, +20/-4)
```diff
@@ -131,6 +131,18 @@ def _parse_output(self, rows) -> List[OutputData]:
             ))
         return results
 
+    # Maps mem0 filter operators to their Turbopuffer equivalents.
+    OPERATOR_MAP = {
+        "eq": "Eq",
+        "ne": "NotEq",
+        "gt": "Gt",
+        "gte": "Gte",
+        "lt": "Lt",
+        "lte": "Lte",
+        "in": "In",
+        "nin": "NotIn",
+    }
+
     def _convert_filters(self, filters: Optional[Dict]):
         """
         Convert mem0 filters to Turbopuffer filter format.
@@ -143,10 +155,14 @@ def _convert_filters(self, filters: Optional[Dict]):
         conditions = []
         for key, value in filters.items():
             if isinstance(value, dict):
-                if "gte" in value:
-                    conditions.append((key, "Gte", value["gte"]))
-                if "lte" in value:
-                    conditions.append((key, "Lte", value["lte"]))
+                for op, operand in value.items():
+                    tpuf_op = self.OPERATOR_MAP.get(op)
+                    if tpuf_op is None:
+                        raise ValueError(
+                            f"Unsupported filter operator '{op}' for field '{key}'. "
+                            f"Supported operators: {sorted(self.OPERATOR_MAP)}"
+                        )
+                    conditions.append((key, tpuf_op, operand))
             else:
                 conditions.append((key, "Eq", value))
 
```

**File**: `tests/vector_stores/test_turbopuffer.py` (modified, +34/-0)
```diff
@@ -276,6 +276,40 @@ def test_mixed_eq_and_range_filters(self, db):
         assert ("user_id", "Eq", "u1") in conditions
         assert ("score", "Gte", 0.5) in conditions
 
+    def test_gt_operator_not_dropped(self, db):
+        """Regression: {"gt": ...} was silently dropped, returning unfiltered results."""
+        result = db._convert_filters({"age": {"gt": 18}})
+        assert result == ("age", "Gt", 18)
+
+    @pytest.mark.parametrize(
+        "op,expected_token",
+        [
+            ("eq", "Eq"),
+            ("ne", "NotEq"),
+            ("gt", "Gt"),
+            ("gte", "Gte"),
+            ("lt", "Lt"),
+            ("lte", "Lte"),
+            ("in", "In"),
+            ("nin", "NotIn"),
+        ],
+    )
+    def test_all_operators_mapped(self, db, op, expected_token):
+        operand = [1, 2] if op in ("in", "nin") else 5
+        result = db._convert_filters({"age": {op: operand}})
+        assert result == ("age", expected_token, operand)
+
+    def test_multiple_operators_on_one_field(self, db):
+        result = db._convert_filters({"age": {"gt": 18, "lt": 65}})
+        assert result[0] == "And"
+        conditions = result[1]
+        assert ("age", "Gt", 18) in conditions
+        assert ("age", "Lt", 65) in conditions
+
+    def test_unknown_operator_raises(self, db):
+        with pytest.raises(ValueError, match="Unsupported filter operator"):
+            db._convert_filters({"age": {"between": [1, 2]}})
+
 
 # ── search ───────────────────────────────────────────────────────────
 
```

---

### Incident Patch 8: `545306db` (2026-09-25)
**Commit Message**: fix(ts-oss/turbopuffer): apply all filter operators, not just gte/lte (#6578)

**File**: `mem0-ts/src/oss/src/vector_stores/turbopuffer.ts` (modified, +42/-11)
```diff
@@ -247,23 +247,54 @@ export class TurbopufferDB implements VectorStore {
     }
   }
 
+  // Maps mem0's universal filter operators to Turbopuffer's filter tokens.
+  private static readonly OPERATOR_MAP: Record<string, string> = {
+    eq: "Eq",
+    ne: "NotEq",
+    gt: "Gt",
+    gte: "Gte",
+    lt: "Lt",
+    lte: "Lte",
+    in: "In",
+    nin: "NotIn",
+  };
+
   private convertFilters(filters?: SearchFilters): any {
     if (!filters || Object.keys(filters).length === 0) return null;
 
     const conditions: any[] = [];
     for (const [key, value] of Object.entries(filters)) {
-      if (
-        typeof value === "object" &&
-        value !== null &&
-        !Array.isArray(value)
-      ) {
-        if ("gte" in value) conditions.push([key, "Gte", value.gte]);
-        if ("lte" in value) conditions.push([key, "Lte", value.lte]);
-        if ("gt" in value) conditions.push([key, "Gt", value.gt]);
-        if ("lt" in value) conditions.push([key, "Lt", value.lt]);
-      } else {
-        conditions.push([key, "Eq", value]);
+      // "*" is a match-any wildcard: it must not constrain the query. The old
+      // code turned it into `[key, "Eq", "*"]`, matching nothing.
+      if (value === "*") {
+        continue;
+      }
+
+      // Array shorthand: { key: [a, b] } means "in".
+      if (Array.isArray(value)) {
+        conditions.push([key, "In", value]);
+        continue;
       }
+
+      if (typeof value === "object" && value !== null) {
+        // Operator dict: every operator present must hold. Previously only
+        // `gte` and `lte` were read, so `gt`/`lt`/`ne`/`eq`/`in`/`nin` were
+        // silently dropped and the filter returned unfiltered results.
+        for (const [op, operand] of Object.entries(value)) {
+          const token = TurbopufferDB.OPERATOR_MAP[op];
+          if (!token) {
+            throw new Error(
+              `Unsupported Turbopuffer filter operator '${op}' for field '${key}'. ` +
+                `Supported operators: ${Object.keys(TurbopufferDB.OPERATOR_MAP).join(", ")}.`,
+            );
+          }
+          conditions.push([key, token, operand]);
+        }
+        continue;
+      }
+
+      // Scalar shorthand: equality.
+      conditions.push([key, "Eq", value]);
     }
 
     if (conditions.length === 0) return null;
```

**File**: `mem0-ts/src/oss/tests/turbopuffer.unit.test.ts` (added, +102/-0)
```diff
@@ -0,0 +1,102 @@
+/// <reference types="jest" />
+/**
+ * Turbopuffer vector store — filter translation unit tests.
+ *
+ * Drives the private convertFilters() through the public search() API with a
+ * virtually-mocked @turbopuffer/turbopuffer peer, and asserts the filter tuple
+ * handed to ns.query().
+ */
+
+const mockQuery = jest.fn().mockResolvedValue({ rows: [] });
+
+// The peer is an optional dependency and may not be installed; mock it
+// virtually. createClient() does `new sdk.default({...})`, whose namespace()
+// returns the object search() calls query() on.
+jest.mock(
+  "@turbopuffer/turbopuffer",
+  () => ({
+    __esModule: true,
+    default: class {
+      namespace() {
+        return { query: mockQuery };
+      }
+    },
+  }),
+  { virtual: true },
+);
+
+import { TurbopufferDB } from "../src/vector_stores/turbopuffer";
+
+function makeStore() {
+  return new TurbopufferDB({
+    apiKey: "test-key",
+    collectionName: "mem0",
+  } as any);
+}
+
+async function filterFor(filters: any): Promise<any> {
+  mockQuery.mockClear();
+  await makeStore().search([0.1, 0.2, 0.3], 5, filters);
+  return mockQuery.mock.calls[0][0].filters;
+}
+
+describe("TurbopufferDB convertFilters", () => {
+  it("maps every operator, not just gte/lte", async () => {
+    expect(await filterFor({ age: { gt: 18 } })).toEqual(["age", "Gt", 18]);
+    expect(await filterFor({ age: { lt: 65 } })).toEqual(["age", "Lt", 65]);
+    expect(await filterFor({ age: { ne: 40 } })).toEqual(["age", "NotEq", 40]);
+    expect(await filterFor({ role: { eq: "admin" } })).toEqual([
+      "role",
+      "Eq",
+      "admin",
+    ]);
+    expect(await filterFor({ tier: { in: ["a", "b"] } })).toEqual([
+      "tier",
+      "In",
+      ["a", "b"],
+    ]);
+    expect(await filterFor({ tier: { nin: ["x"] } })).toEqual([
+      "tier",
+      "NotIn",
+      ["x"],
+    ]);
+  });
+
+  it("applies every operator in a compound range (AND), not just the first", async () => {
+    const filter = await filterFor({ age: { gt: 18, lt: 65 } });
+    expect(filter[0]).toBe("And");
+    expect(filter[1]).toEqual(
+      expect.arrayContaining([
+        ["age", "Gt", 18],
+        ["age", "Lt", 65],
+      ]),
+    );
+  });
+
+  it("treats a bare array value as an 'in' filter", async () => {
+    expect(await filterFor({ tier: ["gold", "silver"] })).toEqual([
+      "tier",
+      "In",
+      ["gold", "silver"],
+    ]);
+  });
+
+  it("keeps scalar equality working", async () => {
+    expect(await filterFor({ user_id: "u1" })).toEqual(["user_id", "Eq", "u1"]);
+  });
+
+  it("skips a '*' wildcard value instead of matching it literally", async () => {
+    // Only the real agent_id clause survives; user_id: "*" contributes nothing.
+    expect(await filterFor({ user_id: "*", agent_id: "a1" })).toEqual([
+      "agent_id",
+      "Eq",
+      "a1",
+    ]);
+  });
+
+  it("throws on an unsupported operator rather than silently dropping it", async () => {
+    await expect(
+      makeStore().search([0.1, 0.2, 0.3], 5, { name: { startsWith: "a" } }),
+    ).rejects.toThrow(/Unsupported Turbopuffer filter operator 'startsWith'/);
+  });
+});
```

---

### Incident Patch 9: `8d6c0019` (2026-09-25)
**Commit Message**: Fix grammar & typos: correct OpenSearch spelling in changelog (#7442)

Co-authored-by: mintlify[bot] <109931778+mintlify[bot]@users.noreply.github.com>

**File**: `docs/changelog/sdk.mdx` (modified, +1/-1)
```diff
@@ -982,7 +982,7 @@ See the [OSS v2 to v3 migration guide](https://docs.mem0.ai/migration/oss-v2-to-
 **New Features:**
 - **OpenMemory:** Added OpenMemory support
 - **Neo4j:** Added weights to Neo4j model
-- **AWS:** Added support for Opsearch Serverless
+- **AWS:** Added support for OpenSearch Serverless
 - **Examples:** Added ElizaOS Example
 
 **Improvements:**
```

---

### Incident Patch 10: `989c7da0` (2026-09-24)
**Commit Message**: fix(oss): stop ConfigManager from injecting OpenAI's baseURL and model into other providers (#7350)

**File**: `mem0-ts/src/oss/src/config/manager.ts` (modified, +13/-4)
```diff
@@ -113,7 +113,18 @@ export class ConfigManager {
           const userConf = userConfig.llm?.config;
           const provider =
             userConfig.llm?.provider || DEFAULT_MEMORY_CONFIG.llm.provider;
-          let finalModel: string | any = defaultConf.model;
+          // DEFAULT_MEMORY_CONFIG.llm.config holds OpenAI's own defaults (baseURL and
+          // model). Handing those to any other provider shadows that provider's default
+          // *and* its env fallback (DEEPSEEK_API_BASE, XAI_API_BASE, ...), so a config
+          // copied from the docs for another provider ends up pointed at OpenAI with an
+          // OpenAI model name. vLLM already needed a carve-out here for exactly this
+          // reason; every non-OpenAI provider needs it.
+          const usesOpenAIDefaults =
+            provider.toLowerCase() === "openai" ||
+            provider.toLowerCase() === "openai_structured";
+          let finalModel: string | any = usesOpenAIDefaults
+            ? defaultConf.model
+            : undefined;
 
           if (userConf?.model && typeof userConf.model === "object") {
             finalModel = userConf.model;
@@ -131,9 +142,7 @@ export class ConfigManager {
               | string
               | undefined) ??
             userConf?.url ??
-            (provider.toLowerCase() === "vllm"
-              ? undefined
-              : defaultConf.baseURL);
+            (usesOpenAIDefaults ? defaultConf.baseURL : undefined);
           const temperature =
             userConf?.temperature ??
             (llmRaw?.temperature as number | undefined);
```

**File**: `mem0-ts/src/oss/tests/config-manager.test.ts` (modified, +56/-4)
```diff
@@ -1,5 +1,6 @@
 /// <reference types="jest" />
 import { ConfigManager } from "../src/config/manager";
+import { LLMFactory } from "../src/utils/factory";
 
 describe("ConfigManager", () => {
   describe("mergeConfig - dimension handling", () => {
@@ -141,7 +142,7 @@ describe("ConfigManager", () => {
       expect(config.llm.config.url).toBe("http://my-ollama-host:11434");
     });
 
-    it("should use default baseURL when no url or baseURL provided", () => {
+    it("should not fall back to the OpenAI default baseURL for a non-OpenAI provider", () => {
       const config = ConfigManager.mergeConfig({
         embedder: baseEmbedder,
         vectorStore: baseVectorStore,
@@ -152,7 +153,9 @@ describe("ConfigManager", () => {
       });
 
       expect(config.llm.config.url).toBeUndefined();
-      expect(config.llm.config.baseURL).toBe("https://api.openai.com/v1");
+      // OllamaLLM defaults to http://localhost:11434. The OpenAI default used to be
+      // injected here, which pointed OllamaLLM at OpenAI instead.
+      expect(config.llm.config.baseURL).toBeUndefined();
     });
 
     it("normalizes vllm_base_url to baseURL for vLLM", () => {
@@ -367,14 +370,63 @@ describe("ConfigManager", () => {
       expect(cfg.llm.config.baseURL).toBe("http://camel:1234/v1");
     });
 
-    it("falls back to default baseURL when neither is provided for LLM", () => {
+    it("does not inject the OpenAI baseURL default for a non-OpenAI provider", () => {
       const cfg = ConfigManager.mergeConfig({
         embedder: baseEmbedder,
         vectorStore: { provider: "memory", config: {} },
         llm: { provider: "lmstudio", config: { model: "test-model" } },
       });
 
-      expect(cfg.llm.config.baseURL).toBe("https://api.openai.com/v1");
+      // The provider supplies its own baseURL (http://localhost:1234/v1) when none is
+      // given. Injecting OpenAI's here shadowed it and sent lmstudio traffic to OpenAI.
+      expect(cfg.llm.config.baseURL).toBeUndefined();
+    });
+
+    it("does not inject the OpenAI model default for a non-OpenAI provider", () => {
+      const cfg = ConfigManager.mergeConfig({
+        embedder: baseEmbedder,
+        vectorStore: { provider: "memory", config: {} },
+        llm: { provider: "deepseek", config: { apiKey: "k" } },
+      });
+
+      // DeepSeekLLM falls back to "deepseek-chat" when model is unset. Injecting
+      // "gpt-5-mini" here made that fallback unreachable.
+      expect(cfg.llm.config.model).toBeUndefined();
+    });
+
+    it("still applies the OpenAI defaults for the OpenAI providers", () => {
+      for (const provider of ["openai", "openai_structured"]) {
+        const cfg = ConfigManager.mergeConfig({
+          embedder: baseEmbedder,
+          vectorStore: { provider: "memory", config: {} },
+          llm: { provider, config: { apiKey: "k" } },
+        });
+
+        expect(cfg.llm.config.baseURL).toBe("https://api.openai.com/v1");
+        expect(cfg.llm.config.model).toBe("gpt-5-mini");
+      }
+    });
+
+    it("lets each non-OpenAI provider resolve its own endpoint", () => {
+      const cases: Array<[string, string]> = [
+        ["deepseek", "https://api.deepseek.com"],
+        ["xai", "https://api.x.ai/v1"],
+        ["lmstudio", "http://localhost:1234/v1"],
+      ];
+
+      for (const [provider, expected] of cases) {
+        const cfg = ConfigManager.mergeConfig({
+          embedder: baseEmbedder,
+          vectorStore: { provider: "memory", config: {} },
+          llm: { provider, config: { apiKey: "k" } },
+        });
+
+        const built = LLMFactory.create(provider, cfg.llm.config);
+        // The client the provider actually built must not point at OpenAI.
+        const baseURL =
+          (built as any).openai?.baseURL ?? (built as any).baseURL;
+        expect(String(baseURL)).toBe(expected);
+      }
     });
   });
 
```

#### Recent Merged Pull Requests:
- **PR #7519** (closed): chore(mem0-ts): bump fastembed peer dependency to ^3.0.0 (@generall)
- **PR #7517** (closed): fix(elasticsearch): a cluster that cannot be reached is not a missing vector (@ericdelorefice)
- **PR #7515** (closed): test(memory): add attribution and temporal-shift regression corpus (@DataAlchmesit)
- **PR #7512** (closed): core: prevent RetriableStream registry leak on cancel race (@014-code)
- **PR #7511** (closed): refactor(langchain.py): migrate deprecated langchain, langchain_core API calls (1 file) (@MoradMoqbel)
- **PR #7509** (closed): fix(memory): order history by instant instead of by created_at string (@passionworkeer)
- **PR #7508** (closed): fix(memory): order history by timestamp instant (@014-code)
- **PR #7506** (closed): fix(vector-store): stop writing service account private key to DEBUG logs in GoogleMatchingEngine (@rupak-eng)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
