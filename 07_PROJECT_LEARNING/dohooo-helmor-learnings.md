# Forensic Learning Record (Deep Inspection): dohooo/helmor

> **Canonical Artifact**: `07_PROJECT_LEARNING/dohooo-helmor-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/dohooo/helmor](https://github.com/dohooo/helmor))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:16:18.129Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `dohooo/helmor`
- **Description**: Open-source local workbench for multi-agent software development.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 1309 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.agents/skills/helmor-cli/scripts/render_stack.py`
```
#!/usr/bin/env python3
"""Deterministic renderer for the Helmor stacked-PR diagram (canonical style A).

The stacked-pr skill builds a JSON "stack spec" and pipes it through this
script so the diagram is byte-for-byte identical every time — never hand-drawn
by the model. Column widths are derived from the data, so any stack renders in
the same shape.

Usage:
    python3 render_stack.py spec.json      # render a spec file
    python3 render_stack.py -              # render a spec from stdin
    python3 render_stack.py --selfcheck    # verify the canonical sample

Spec shape (layers ordered tip -> root, i.e. newest PR first):
    {
      "name": "dark-mode",
      "repo": "helmor/uranus",
      "base": "main",
      "layers": [
        {"pr": "483", "title": "feat: dark mode toggle",  "state": "draft",  "ws": "dark-mode-ui"},
        {"pr": "482", "title": "feat: persist theme pref", "state": "open",   "ws": "dark-mode-api"},
        {"pr": "481", "title": "feat: add theme column",   "state": "merged", "ws": "dark-mode-schema"}
      ]
    }

`pr` may be empty for a layer whose PR hasn't been opened yet (lazy growth).
"""

import json
import sys

# State glyph legend (matches the locked canonical style A):
#   ✓ merged   ◉ open / draft (has a live PR)   ✕ closed   ○ no PR yet
GLYPH = {
    "merged": "✓",
    "open": "◉",
    "draft": "◉",
    "closed": "✕",
    "none": "○",
    "": "○",
}


def render(spec):
    layers = spec.get("layers", [])
    base = str(spec.get("base", "main"))
    name = str(spec.get("name", "stack"))
    repo = str(spec.get("repo", ""))
    n = len(layers)

    def pr_str(layer):
        pr = str(layer.get("pr") or "")
        return ("#" + pr) if pr else "—"

    prw = max((len(pr_str(l)) for l in layers), default=2)
    titlew = max((len(str(l.get("title", ""))) for l in layers), default=0) + 4
    wsw = max((len(str(l.get("ws", ""))) for l in layers), default=0) + 2

    lines = []
    header = f"stack: {name}"
    meta = " · ".join(
        part for part in (repo, f"{n} PR" + ("s" if n != 1 else "")) if part
    )
    if meta:
        header += " · " + meta
    lines.append(header)
    lines.append("")

    for i, layer in enumerate(layers):
        glyph = GLYPH.get(str(layer.get("state", "none")), "○")
        title = str(layer.get("title", ""))
        state = str(layer.get("state", ""))
        main = f"{glyph} {pr_str(layer):<{prw}}  {title:<{titlew}}{state}"
        if i == 0:
            main += "    ← HEAD"
        lines.append(main)

        ws = str(layer.get("ws", ""))
        if i + 1 < n:
            lower = layers[i + 1]
            lower_pr = str(lower.get("pr") or "")
            base_ref = ("#" + lower_pr) if lower_pr else str(lower.get("ws") or "—")
        else:
            base_ref = base
        lines.append(f"│  └ ws: {ws:<{wsw}}base ◂ {base_ref}")
        if i < n - 1:
            lines.append("│")

    lines.append(f"┴ {base}")
    return "\n".join(lines)


SELF_CHECK_SPEC = {
    "name": "dark-mode",
    "repo": "helmor/uranus",
    "base": "main",
    "layers": [
        {"pr": "483", "title": "feat: dark mode toggle", "state": "draft", "ws": "dark-mode-ui"},
        {"pr": "482", "title": "feat: persist theme pref", "state": "open", "ws": "dark-mode-api"},
        {"pr": "481", "title": "feat: add theme column", "state": "merged", "ws": "dark-mode-schema"},
    ],
}

SELF_CHECK_EXPECTED = "\n".join(
    [
        "stack: dark-mode · helmor/uranus · 3 PRs",
        "",
        "◉ #483  feat: dark mode toggle      draft    ← HEAD",
        "│  └ ws: dark-mode-ui      base ◂ #482",
        "│",
        "◉ #482  feat: persist theme pref    open",
        "│  └ ws: dark-mode-api     base ◂ #481",
        "│",
        "✓ #481  feat: add theme column      merged",
        "│  └ ws: dark-mode-schema  base ◂ main",
        "┴ main",
    ]
)


def selfcheck():
    got = render(SELF_CHECK_SPEC)
    if got == SELF_CHECK_EXPECTED:
        print("render_stack selfcheck OK")
        return 0
    print("render_stack selfcheck FAILED\n", file=sys.stderr)
    print("--- expected ---", file=sys.stderr)
    print(SELF_CHECK_EXPECTED, file=sys.stderr)
    print("--- got ---", file=sys.stderr)
    print(got, file=sys.stderr)
    return 1


def main(argv):
    if len(argv) < 2:
        print(__doc__)
        return 2
    arg = argv[1]
    if arg == "--selfcheck":
        return selfcheck()
    raw = sys.stdin.read() if arg == "-" else open(arg, encoding="utf-8").read()
    print(render(json.loads(raw)))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))

```

### Core Architecture Module: `.agents/skills/helmor-debug-loop/scripts/terminal_log_summary.py`
```
#!/usr/bin/env python3
"""Summarize Helmor terminal/run-script logs for debugging evidence."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ANSI_RE = re.compile(r"\x1b(?:\[[0-9;?=<>]*[ -/]*[@-~]|\][^\x07]*(?:\x07|\x1b\\)|[@-Z\\-_])")
URL_RE = re.compile(r"https?://(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|::1|[^\s'\"<>]+)[^\s'\"<>]*")
ERROR_RE = re.compile(
    r"\b(error|exception|panic|failed|failure|traceback|unhandled|cannot|could not|enoent|eaddrinuse)\b",
    re.IGNORECASE,
)
WARNING_RE = re.compile(r"\b(warn|warning|deprecated)\b", re.IGNORECASE)


def read_text(path: str | None) -> str:
    if path:
        return Path(path).read_text(errors="replace")
    return sys.stdin.read()


def strip_ansi(text: str) -> str:
    return ANSI_RE.sub("", text)


def unique(values: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        out.append(value)
    return out


def summarize(text: str, tail_lines: int) -> dict[str, object]:
    clean = strip_ansi(text).replace("\r\n", "\n").replace("\r", "\n")
    lines = clean.splitlines()
    error_lines = [line for line in lines if ERROR_RE.search(line)]
    warning_lines = [line for line in lines if WARNING_RE.search(line)]
    urls = unique(URL_RE.findall(clean))
    return {
        "bytes": len(text.encode()),
        "cleanBytes": len(clean.encode()),
        "lineCount": len(lines),
        "urls": urls[:20],
        "errorCount": len(error_lines),
        "warningCount": len(warning_lines),
        "errors": error_lines[-20:],
        "warnings": warning_lines[-20:],
        "tail": lines[-tail_lines:],
    }


def print_markdown(summary: dict[str, object]) -> None:
    print("# Terminal Log Summary\n")
    print(f"- Bytes: {summary['bytes']}")
    print(f"- Clean bytes: {summary['cleanBytes']}")
    print(f"- Lines: {summary['lineCount']}")
    print(f"- Errors: {summary['errorCount']}")
    print(f"- Warnings: {summary['warningCount']}")

    urls = summary["urls"]
    if urls:
        print("\n## URLs")
        for url in urls:
            print(f"- `{url}`")

    errors = summary["errors"]
    if errors:
        print("\n## Recent Error Lines")
        for line in errors:
            print(f"- `{line[:500]}`")

    warnings = summary["warnings"]
    if warnings:
        print("\n## Recent Warning Lines")
        for line in warnings:
            print(f"- `{line[:500]}`")

    print("\n## Tail")
    print("```text")
    for line in summary["tail"]:
        print(line)
    print("```")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("path", nargs="?", help="Log file path. Reads stdin when omitted.")
    parser.add_argument("--tail-lines", type=int, default=120)
    parser.add_argument("--json", action="store_true", help="Emit JSON instead of markdown.")
    args = parser.parse_args()

    summary = summarize(read_text(args.path), max(0, args.tail_lines))
    if args.json:
        print(json.dumps(summary, ensure_ascii=False, indent=2))
    else:
        print_markdown(summary)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

```

### Core Architecture Module: `sidecar/src/cursor/worker/cursor-core.ts`
```
/** SessionManager backed by @cursor/sdk. One Agent per Helmor session;
 * stream events forwarded with `type` namespaced as `cursor/<original>`
 * so Rust dispatch doesn't collide with claude/codex event types. */

import {
	Agent,
	Cursor,
	type ModelParameterValue,
	type Run,
	type SDKAgent,
} from "@cursor/sdk";
import { ActiveTurnRegistry } from "../../active-turn-registry.js";
import type { SidecarEmitter } from "../../emitter.js";
import { parseImageRefs } from "../../images.js";
import { errorDetails, logger } from "../../logger.js";
import { listProviderModels } from "../../model-catalog.js";
import type {
	CursorModelParameter,
	GenerateTitleOptions,
	ListSlashCommandsParams,
	ProviderModelInfo,
	SendMessageParams,
	SlashCommandInfo,
} from "../../session-manager.js";
import {
	buildTitlePrompt,
	parseTitleAndBranchWithDiagnostics,
	TITLE_GENERATION_TIMEOUT_MS,
} from "../../title.js";
import { loadCursorMcpServers } from "../project-mcp.js";
import { scanCursorSkills } from "../skill-scanner.js";
import {
	buildCursorMessage,
	computeModelParameterValues,
	extractCreatePlanText,
	isAgentBusyError,
	isRetryableCursorError,
	modelInfoToProviderInfo,
	namespaceEvent,
	toCursorMode,
} from "./cursor-helpers.js";
import { fatalScope, sessionContext } from "./fatal-context.js";

/// Cheapest model on the title-gen hot path.
const TITLE_MODEL_ID = "composer-2";

/// Retry transient network failures (Cursor's API intermittently resets the
/// TLS handshake) on the SDK's connection-setup calls. 3 attempts, linear
/// backoff. Non-retryable errors throw immediately.
const RETRY_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = 400;

async function withCursorRetry<T>(
	label: string,
	fn: () => Promise<T>,
): Promise<T> {
	let lastErr: unknown;
	for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
		try {
			return await fn();
		} catch (err) {
			lastErr = err;
			if (attempt === RETRY_ATTEMPTS || !isRetryableCursorError(err)) throw err;
			const wait = RETRY_BACKOFF_MS * attempt;
			logger.info(
				`[cursor] ${label} transient network failure (attempt ${attempt}/${RETRY_ATTEMPTS}), retrying in ${wait}ms: ${err instanceof Error ? err.message : String(err)}`,
			);
			await new Promise((resolve) => setTimeout(resolve, wait));
		}
	}
	throw lastErr;
}

interface LiveSession {
	readonly agent: SDKAgent;
	/// Updated per turn — composer can switch model mid-conversation.
	modelId: string;
	currentRun: Run | null;
	currentRequestId: string | null;
}

export class CursorCore {
	private readonly sessions = new Map<string, LiveSession>();
	private readonly turns = new ActiveTurnRegistry();
	/// Per-wire-id parameters[] cache. Populated by listModels(), read
	/// by sendMessage() to build ModelParameterValue[].
	private readonly modelParameters = new Map<
		string,
		readonly CursorModelParameter[]
	>();
	/// API key, pushed in via Rust's `updateConfig` RPC (UI-configured only —
	/// no env-var fallback). `null` means not configured → cursor errors out.
	private apiKey: string | null = null;

	setApiKey(apiKey: string | null): void {
		const next = apiKey?.trim() ? apiKey.trim() : null;
		if (next === this.apiKey) return; // unchanged — keep live sessions
		this.apiKey = next;
		// Drop existing sessions — they were minted with the old key.
		// In-flight cursor turns abort; claude/codex unaffected.
		for (const [sessionId, session] of this.sessions) {
			this.turns.requestStop(sessionId);
			try {
				session.agent.close();
			} catch {
				/* ignored */
			}
		}
		this.sessions.clear();
		logger.info(
			next === null
				? "Cursor API key cleared"
				: "Cursor API key updated; existing cursor sessions invalidated",
		);
	}

	private resolveApiKey(): string | null {
		return this.apiKey;
	}

	async sendMessage(
		requestId: string,
		params: SendMessageParams,
		emitter: SidecarEmitter,
	): Promise<void> {
		// Tag this turn's async context so a detached SDK fault (uncaught in
		// the worker) is attributed to THIS session — see worker.ts's fatal
		// handler. Without it, one session's fault fails every active session.
		return sessionContext.run({ sessionId: params.sessionId }, async () => {
			const apiKey = this.resolveApiKey();
			if (!apiKey) {
				emitter.error(
					requestId,
					"Cursor API key is not configured. Add it in Settings → Models → Cursor.",
				);
				emitter.end(requestId);
				return;
			}

			// Register the turn before any startup await so a Stop pressed during
			// Agent.create / agent.send aborts instantly. Teardown reads the run
			// lazily — it's null until agent.send resolves.
			this.turns.begin(params.sessionId, requestId, emitter, () => {
				void this.sessions
					.get(params.sessionId)
					?.currentRun?.cancel()
					.catch(() => {});
			});

			const modelId = params.model ?? "composer-2";
			const cwd = params.cwd ?? process.cwd();
			// Cursor MCP servers (~/.cursor/mcp.json + project) aren't auto-loaded
			// by the SDK without `settingSources`; inject them explicitly so Helmor
			// agents get the same MCP tools as the Cursor IDE/CLI.
			const mcpServers = loadCursorMcpServers(params.sourceRepoPath);
			if (mcpServers) {
				logger.info(`[${requestId}] cursor MCPs injected`, {
					servers: Object.keys(mcpServers),
				});
			}

			let session = this.sessions.get(params.sessionId);
			if (!session) {
				try {
					const agent = await withCursorRetry("Agent.create", () =>
						params.resume
							? Agent.resume(params.resume, { apiKey, local: { cwd } })
							: Agent.create({
									apiKey,
									model: { id: modelId },
									local: { cwd },
									mode: toCursorMode(params.permissionMode),
									...(mcpServers ? { mcpServers } : {}),
								}),
					);
					session = {
						agent,
						modelId,
						currentRun: null,
						currentRequestId: null,
					};
					this.sessions.set(params.sessionId, session);
					// Synthetic event — Rust persists agentId as provider_session_id.
					emitter.passthrough(requestId, {
						type: "cursor/agent_init",
						session_id: agent.agentId,
						model: modelId,
					});
				} catch (error) {
					const msg = error instanceof Error ? error.message : String(error);
					logger.error(`[${requestId}] Cursor Agent.create failed: ${msg}`, {
						...errorDetails(error),
					});
					emitter.error(requestId, `Cursor: ${msg}`);
					emitter.end(requestId);
					return;
				}
			}

			// Stop pressed during Agent.create — `requestStop` already emitted
			// `aborted`. Keep the freshly-minted agent for reuse; just bail.
			if (this.turns.isAbortRequested(params.sessionId)) {
				this.turns.end(params.sessionId, requestId);
				return;
			}

			// Use this turn's modelId, not the agent's create-time pick —
			// composer can switch models mid-conversation. `thinking` is
			// auto-enabled inside buildSendModelParams when present.
			session.modelId = modelId;
			const modelParams = await this.buildSendModelParams(
				modelId,
				params.effortLevel,
				params.fastMode,
				apiKey,
			);
			// Lift `@<path>` image markers out of the prompt and materialize
			// them as base64 attachments. Local agents only accept the
			// `{ data, mimeType }` SDKImage variant (`url` throws).
			const { text, imagePaths } = parseImageRefs(params.prompt, params.images);
			const message = await buildCursorMessage(text, imagePaths);
			const activeSession = session;
			// `local.force` expires a wedged active run (left non-terminal in the
			// cwd-scoped store by a worker that died mid-turn) before starting this
			// one. Only set on the recovery retry — never force-expire a run that's
			// legitimately in flight.
			const sendOptions = (force: boolean) => ({
				// Pass mode every turn — Cursor sticks with the create-time mode
				// otherwise, so toggling Plan on/off mid-conversation (incl.
				// "Implement" → back to agent) wouldn't take effect.
				mode: toCursorMode(params.permissionMode),
				model: {
					id: modelId,
					...(modelParams.length > 0 ? { params: modelParams } : {}),
				},
				// Re-assert MCP servers per turn so resumed sessions and mid-
				// session config edits pick them up (mirrors `mode`).
				...(mcpServers ? { mcpServers } : {}),
				...(force ? { local: { force: true } } : {}),
			});
			let run: Run;
			try {
				run = await withCursorRetry("agent.send", () =>
					activeSession.agent.send(message, sendOptions(false)),
				);
			} catch (error) {
				// A run wedged in the local store ("already has active run") blocks
				// every follow-up send and survives app restarts. Retry once with
				// `local.force` — the SDK's recovery path for agents left wedged by a
				// crashed CLI/worker process — before surfacing a hard failure.
				if (!isAgentBusyError(error)) {
					const msg = error instanceof Error ? error.message : String(error);
					logger.error(`[${requestId}] Cursor agent.send failed: ${msg}`, {
						...errorDetails(error),
					});
					emitter.error(requestId, `Cursor: ${msg}`);
					emitter.end(requestId);
					return;
				}
				logger.info(
					`[${requestId}] Cursor agent has a wedged active run; retrying agent.send with local.force`,
				);
				try {
					run = await withCursorRetry("agent.send(force)", () =>
						activeSession.agent.send(message, sendOptions(true)),
					);
				} catch (retryError) {
					const msg =
						retryError instanceof Error
							? retryError.message
							: String(retryError);
					logger.error(
						`[${requestId}] Cursor agent.send(force) failed: ${msg}`,
						{
							...errorDetails(retryError),
						},
					);
					emitter.error(requestId, `Cursor: ${msg}`);
					emitter.end(requestId);
					return;
				}
			}
			session.currentRun = run;
			session.currentRequestId = requestId;

			// Stop pressed during agent.send — the run now exists, so cancel it.
			if (this.turns.isAbortRequested(params.sessionId)) {
				void run.cancel().catch(() => {});
				this.turns.end(params.sessionId, requestId);
				return;
			}

			// Plan mode ends by calling the 
```

### Core Architecture Module: `sidecar/src/cursor/worker/cursor-helpers.ts`
```
/** Pure helpers for the cursor worker — kept @cursor/sdk-runtime-free (the SDK
 * is imported as types only) so unit tests can exercise them under Bun without
 * loading @cursor/sdk. The stateful Agent logic that DOES load the SDK lives in
 * `cursor-core.ts`, which only ever runs in the Node worker. */

import { basename, extname } from "node:path";
import type {
	ModelListItem,
	ModelParameterValue,
	SDKImage,
	SDKMessage,
	SDKUserMessage,
} from "@cursor/sdk";
import { readImageWithResize } from "../../image-resize.js";
import { errorDetails, logger } from "../../logger.js";
import type {
	CursorModelParameter,
	ProviderModelInfo,
} from "../../session-manager.js";

/// Map Helmor's permissionMode to Cursor's conversation mode. Plan mode
/// runs Cursor read-only; everything else is the normal agent mode.
export function toCursorMode(
	permissionMode: string | undefined,
): "agent" | "plan" {
	return permissionMode === "plan" ? "plan" : "agent";
}

/// Pull the plan markdown out of a `createPlan` tool_call event
/// (`args.plan`). Returns null when absent/blank so `planCaptured` falls
/// back to a bare marker rather than an empty plan card.
export function extractCreatePlanText(
	e: Record<string, unknown>,
): string | null {
	const args = e.args as Record<string, unknown> | undefined;
	const plan = args?.plan;
	return typeof plan === "string" && plan.trim() !== "" ? plan : null;
}

export function extToMimeType(filePath: string): string {
	switch (extname(filePath).toLowerCase()) {
		case ".jpg":
		case ".jpeg":
			return "image/jpeg";
		case ".png":
			return "image/png";
		case ".gif":
			return "image/gif";
		case ".webp":
			return "image/webp";
		default:
			return "image/png";
	}
}

/// Build the `agent.send` payload. Returns a plain string when there are
/// no attachments (cheapest path); otherwise an SDKUserMessage carrying
/// base64 images. Unreadable files degrade to a `[Image not found]` note
/// appended to the text so the turn still goes through.
export async function buildCursorMessage(
	text: string,
	imagePaths: readonly string[],
): Promise<string | SDKUserMessage> {
	if (imagePaths.length === 0) return text;
	const images: SDKImage[] = [];
	const notes: string[] = [];
	for (const imgPath of imagePaths) {
		try {
			const { buffer } = await readImageWithResize(imgPath);
			images.push({
				data: buffer.toString("base64"),
				mimeType: extToMimeType(imgPath),
			});
		} catch (err) {
			logger.error("Failed to read Cursor image attachment", {
				imageName: basename(imgPath),
				...errorDetails(err),
			});
			notes.push(`[Image not found: ${imgPath}]`);
		}
	}
	const finalText = [text, ...notes].filter(Boolean).join("\n");
	if (images.length === 0) return finalText;
	return { text: finalText, images };
}

/// Prefix `type` with `cursor/` so Rust dispatch doesn't collide with
/// claude/codex. `tool_call` is split into `tool_call_start` /
/// `tool_call_end` based on `status` so accumulator can branch on type.
export function namespaceEvent(event: SDKMessage): Record<string, unknown> {
	const e = event as unknown as Record<string, unknown>;
	if (e.type === "tool_call") {
		const status = typeof e.status === "string" ? e.status : "running";
		return {
			...e,
			type:
				status === "completed"
					? "cursor/tool_call_end"
					: "cursor/tool_call_start",
		};
	}
	return { ...e, type: `cursor/${String(e.type)}` };
}

/// Effort wire ids in priority order: Claude uses `effort`, GPT/Codex
/// uses `reasoning`. Both can carry levels; when both present, `effort`
/// wins (Claude has effort + thinking; thinking is the boolean one).
const CURSOR_EFFORT_PARAM_IDS = ["effort", "reasoning"] as const;

/// Build agent.send params from composer toolbar state. Toolbar surfaces
/// effort + fast; `thinking` is auto-enabled when the model exposes it.
export function computeModelParameterValues(
	parameters: readonly CursorModelParameter[],
	effortLevel: string | undefined,
	fastMode: boolean | undefined,
): ModelParameterValue[] {
	const out: ModelParameterValue[] = [];

	if (typeof effortLevel === "string" && effortLevel !== "") {
		for (const id of CURSOR_EFFORT_PARAM_IDS) {
			const param = parameters.find((p) => p.id === id);
			if (!param) continue;
			// Reject out-of-band values — API rejects unknown values.
			if (param.values.some((v) => v.value === effortLevel)) {
				out.push({ id: param.id, value: effortLevel });
			}
			break;
		}
	}

	// Auto-enable `thinking` when present (Claude extended thinking).
	const thinkingParam = parameters.find((p) => p.id === "thinking");
	if (thinkingParam?.values.some((v) => v.value === "true")) {
		out.push({ id: "thinking", value: "true" });
	}

	// Always forward an explicit fast value when the model exposes it.
	// Omitting it lets Cursor fall back to a model-specific server default
	// (Composer 2.5 defaults to fast), so OFF must be sent as fast=false.
	const fastParam = parameters.find((p) => p.id === "fast");
	if (fastParam) {
		const desired = fastMode === true ? "true" : "false";
		if (fastParam.values.some((v) => v.value === desired)) {
			out.push({ id: "fast", value: desired });
		}
	}

	return out;
}

export function modelInfoToProviderInfo(
	model: ModelListItem,
): ProviderModelInfo {
	const params = model.parameters ?? [];
	const effortParam = CURSOR_EFFORT_PARAM_IDS.map((id) =>
		params.find((p) => p.id === id),
	).find((p): p is NonNullable<typeof p> => p !== undefined);
	const fastParam = params.find((p) => p.id === "fast");
	const effortLevels = effortParam?.values
		.map((v) => v.value)
		.filter((v): v is string => typeof v === "string");
	const supportsFastMode = Boolean(fastParam);
	const cursorParameters: CursorModelParameter[] | undefined = model.parameters
		? model.parameters.map((p) => ({
				id: p.id,
				...(p.displayName !== undefined ? { displayName: p.displayName } : {}),
				values: p.values.map((v) => ({
					value: v.value,
					...(v.displayName !== undefined
						? { displayName: v.displayName }
						: {}),
				})),
			}))
		: undefined;
	return {
		id: model.id,
		label: model.displayName ?? model.id,
		cliModel: model.id,
		...(effortLevels && effortLevels.length > 0 ? { effortLevels } : {}),
		...(supportsFastMode ? { supportsFastMode } : {}),
		...(cursorParameters && cursorParameters.length > 0
			? { cursorParameters }
			: {}),
	};
}

/// Transient network failures worth retrying / recovering from rather than
/// surfacing as a hard failure: TLS/connection resets, timeouts, DNS hiccups.
/// `api2.cursor.sh` intermittently resets the TLS handshake from some networks,
/// and the SDK's HTTP/2 client throws that as a ConnectError whose `cause` is a
/// Node socket error. We match by error `code`, nested `cause.code`, and the
/// message text so it works across ConnectError and raw socket errors.
const RETRYABLE_NET_CODES = new Set([
	"ECONNRESET",
	"ETIMEDOUT",
	"ECONNREFUSED",
	"ECONNABORTED",
	"EPIPE",
	"ENOTFOUND",
	"EAI_AGAIN",
	"ENETUNREACH",
	"EHOSTUNREACH",
]);

const RETRYABLE_NET_MESSAGES = [
	"socket disconnected",
	"before secure tls",
	"socket hang up",
	"econnreset",
	"etimedout",
	"timed out",
	"network socket disconnected",
];

export function isRetryableCursorError(err: unknown, depth = 0): boolean {
	if (!err || typeof err !== "object" || depth > 4) return false;
	const o = err as { code?: unknown; message?: unknown; cause?: unknown };
	if (typeof o.code === "string" && RETRYABLE_NET_CODES.has(o.code))
		return true;
	if (typeof o.message === "string") {
		const m = o.message.toLowerCase();
		if (RETRYABLE_NET_MESSAGES.some((needle) => m.includes(needle)))
			return true;
	}
	return isRetryableCursorError(o.cause, depth + 1);
}

/// "Agent already has an active run" conflict (SDK AgentBusyError / 409). A run
/// left non-terminal in the cwd-scoped local store — e.g. the worker was killed
/// mid-turn before it could cancel — blocks every follow-up `agent.send`. The
/// local store throws it as a plain `Error("Agent <id> already has active run")`;
/// the cloud path wraps it as AgentBusyError. Match both, walking `cause`.
export function isAgentBusyError(err: unknown, depth = 0): boolean {
	if (!err || typeof err !== "object" || depth > 4) return false;
	const o = err as {
		name?: unknown;
		errorName?: unknown;
		message?: unknown;
		cause?: unknown;
	};
	if (o.name === "AgentBusyError" || o.errorName === "AgentBusyError")
		return true;
	if (
		typeof o.message === "string" &&
		/already has (an )?active run/i.test(o.message)
	)
		return true;
	return isAgentBusyError(o.cause, depth + 1);
}

/// Authentication failures (SDK AuthenticationError / 401). Raw ConnectErrors
/// from the SDK's background streaming tasks surface as `[unauthenticated] …`
/// and never get wrapped, so match by ConnectError `code` and message text in
/// addition to the wrapped class name. Walks `cause`.
const AUTH_ERROR_CODES = new Set([
	"unauthenticated",
	"unauthorized",
	"permission_denied",
]);

export function isAuthError(err: unknown, depth = 0): boolean {
	if (!err || typeof err !== "object" || depth > 4) return false;
	const o = err as {
		name?: unknown;
		errorName?: unknown;
		code?: unknown;
		message?: unknown;
		cause?: unknown;
	};
	if (o.name === "AuthenticationError" || o.errorName === "AuthenticationError")
		return true;
	if (typeof o.code === "string" && AUTH_ERROR_CODES.has(o.code.toLowerCase()))
		return true;
	if (typeof o.message === "string") {
		const m = o.message.toLowerCase();
		if (
			m.includes("[unauthenticated]") ||
			m.includes("[unauthorized]") ||
			m.includes("invalid api key")
		)
			return true;
	}
	return isAuthError(o.cause, depth + 1);
}

// Test-only export.
export const __CURSOR_INTERNAL = {
	namespaceEvent,
	modelInfoToProviderInfo,
	computeModelParameterValues,
	buildCursorMessage,
	extToMimeType,
	toCursorMode,
	extractCreatePlanText,
	isRetryableCursorError,
	isAgentBusyError,
	isAuthError,
};

```

### Core Architecture Module: `sidecar/src/cursor/worker/fatal-context.ts`
```
import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Per-turn async context so the worker's process-level fatal handler can
 * attribute a detached SDK fault (a raw `[unauthenticated]` / network error
 * thrown from the HTTP/2 client's background task, escaping every try/catch)
 * to the session that spawned it — instead of failing every session.
 *
 * Set in `CursorCore.sendMessage` (wrapping `Agent.create` / `agent.send` /
 * the stream loop, where the SDK's background tasks are born, so they inherit
 * the context); read in `worker.ts`'s `handleFatal`.
 */
export const sessionContext = new AsyncLocalStorage<{ sessionId: string }>();

export type FatalScope =
	| { kind: "session"; sessionId: string }
	| { kind: "all" };

/**
 * Decide which in-flight turns a worker-fatal should terminate.
 *
 * Auth faults are per-stream — a `[unauthenticated]` / 401 status is returned
 * on one session's specific stream and doesn't kill siblings — so we trust the
 * async-context attribution (`attributedSessionId`) and scope the failure to
 * just that session (the #868 cascade fix).
 *
 * Network/connection faults may instead be connection-level: if the SDK pools
 * one HTTP/2 connection across sessions, a GOAWAY/RST kills every stream but
 * surfaces in only one session's async context. Attributing those would leave
 * the real victims hung (no terminal event ever fires), so for non-auth faults
 * we fall back to the blunt-but-safe "fail every in-flight turn" — except when
 * a lone turn is live, which is unambiguous regardless of cause.
 */
export function fatalScope(
	isAuth: boolean,
	attributedSessionId: string | undefined,
	activeSessionIds: readonly string[],
): FatalScope {
	if (isAuth && attributedSessionId) {
		return { kind: "session", sessionId: attributedSessionId };
	}
	const [only] = activeSessionIds;
	if (activeSessionIds.length === 1 && only !== undefined) {
		return { kind: "session", sessionId: only };
	}
	return { kind: "all" };
}

```

### Core Architecture Module: `sidecar/src/cursor/worker/protocol.ts`
```
/** Wire protocol between the Bun sidecar (proxy) and the Node cursor worker.
 *
 * Cursor's `@cursor/sdk` runs its agent loop + HTTP/2 transport in-process.
 * Bun's HTTP/2 client throws `NGHTTP2_FRAME_SIZE_ERROR` on the larger frames
 * Cursor sends inside a git repo, which silently breaks every tool call. Node
 * does not have this bug, so we run the SDK in a Node child process and bridge
 * it over stdin/stdout JSON Lines. See `cursor/session-manager.ts` (proxy) and
 * `worker.ts` (Node entry). */

import type {
	GenerateTitleOptions,
	ListSlashCommandsParams,
	ProviderModelInfo,
	SendMessageParams,
	SlashCommandInfo,
} from "../../session-manager.js";

// --- proxy → worker -------------------------------------------------------

export type ToWorker =
	| { t: "setApiKey"; apiKey: string | null }
	| { t: "send"; requestId: string; params: SendMessageParams }
	| {
			t: "title";
			rpcId: string;
			requestId: string;
			userMessage: string;
			branchRenamePrompt: string | null;
			timeoutMs?: number;
			options?: GenerateTitleOptions;
	  }
	| { t: "slash"; rpcId: string; params: ListSlashCommandsParams }
	| { t: "models"; rpcId: string; opts?: { apiKey?: string } }
	| { t: "stop"; sessionId: string }
	| { t: "shutdown" };

// --- worker → proxy -------------------------------------------------------

/** One emitter call to replay on the real `SidecarEmitter`. Only the subset
 * the cursor SDK logic actually emits is carried over the wire. */
export type EmitMsg =
	| {
			m: "error";
			requestId: string | null;
			message: string;
			internal?: boolean;
	  }
	| { m: "end"; requestId: string }
	| { m: "aborted"; requestId: string; reason: string }
	| { m: "passthrough"; requestId: string; message: object }
	| {
			m: "planCaptured";
			requestId: string;
			toolUseId: string;
			plan: string | null;
	  }
	| {
			m: "titleGenerated";
			requestId: string;
			title: string;
			branchName: string | undefined;
	  };

export type FromWorker =
	| { t: "ready" }
	| { t: "emit"; e: EmitMsg }
	/** Resolves the proxy's `sendMessage(requestId)` promise. */
	| { t: "sendDone"; requestId: string }
	| {
			t: "rpcOk";
			rpcId: string;
			value: SlashCommandInfo[] | ProviderModelInfo[];
	  }
	| { t: "rpcErr"; rpcId: string; message: string }
	| { t: "log"; level: "debug" | "info" | "error"; message: string };

```

### Core Architecture Module: `sidecar/src/cursor/worker/worker.ts`
```
/** Node entry for the cursor worker. Runs `@cursor/sdk` on Node (whose
 * HTTP/2 client, unlike Bun's, handles the large frames Cursor sends inside a
 * git repo without `NGHTTP2_FRAME_SIZE_ERROR`). Speaks the JSON-Lines wire
 * protocol in `protocol.ts` with the Bun sidecar proxy over stdin/stdout.
 *
 * stdout is reserved for protocol lines only; everything else (SDK noise,
 * logger) goes to stderr, which the proxy drains into the sidecar log. */

import { createInterface } from "node:readline";
import { applyAgentProxyToProcessEnv } from "../../agent-proxy.js";
import type { SidecarEmitter } from "../../emitter.js";
import { CursorCore } from "./cursor-core.js";
import { isAuthError, isRetryableCursorError } from "./cursor-helpers.js";
import { sessionContext } from "./fatal-context.js";
import type { EmitMsg, FromWorker, ToWorker } from "./protocol.js";

// Keep stdout pristine: any stray console.log from the SDK would corrupt the
// protocol stream, so route it to stderr.
console.log = (...args: unknown[]) => console.error(...args);

function out(msg: FromWorker): void {
	process.stdout.write(`${JSON.stringify(msg)}\n`);
}

function emit(e: EmitMsg): void {
	out({ t: "emit", e });
}

/** A full `SidecarEmitter` whose calls cross the wire. The cursor SDK logic
 * (and the shared turn registry) only ever emit the methods serialized below;
 * the rest are off-path for cursor and no-op. */
const noop = (..._args: unknown[]): void => {};
const wireEmitter: SidecarEmitter = {
	error: (requestId, message, internal) =>
		emit({ m: "error", requestId, message, internal }),
	end: (requestId) => emit({ m: "end", requestId }),
	aborted: (requestId, reason) => emit({ m: "aborted", requestId, reason }),
	passthrough: (requestId, message) =>
		emit({ m: "passthrough", requestId, message }),
	planCaptured: (requestId, toolUseId, plan) =>
		emit({ m: "planCaptured", requestId, toolUseId, plan }),
	titleGenerated: (requestId, title, branchName) =>
		emit({ m: "titleGenerated", requestId, title, branchName }),
	ready: noop,
	stopped: noop,
	steered: noop,
	pong: noop,
	heartbeat: noop,
	slashCommandsListed: noop,
	permissionRequest: noop,
	userInputRequest: noop,
	userQuestionResolved: noop,
	permissionModeChanged: noop,
	modelsListed: noop,
	contextUsageUpdated: noop,
	contextUsageResult: noop,
	codexGoalUpdated: noop,
};

const core = new CursorCore();

// The worker is a permanent resident shared by every cursor session. Errors
// reach this handler only when they escape every try/catch — in practice that's
// the SDK's HTTP/2 client throwing an operational error from a detached
// background task (a network reset, or a raw `[unauthenticated]` ConnectError
// from an event stream). Operational errors don't corrupt the process, so we
// stay alive: log, fail the *originating* session's in-flight turn with an
// actionable message (`failTurnsForFatal`, attributed via `sessionContext`),
// and drop only that session — its next send re-resumes cleanly. Sibling
// sessions keep streaming. Killing the worker would cold-restart every other
// session for nothing.
//
// Error type selects ONLY the user-facing copy, never the process lifecycle.
//
// The sole reason to give up the process is a crash-loop: if fatals keep firing
// in a tight window the process is genuinely wedged (e.g. a leaked SDK
// background loop faulting on repeat that `agent.close()` didn't stop), so we
// exit once and let the supervisor respawn a clean worker.
const FATAL_LOOP_WINDOW_MS = 10_000;
const FATAL_LOOP_THRESHOLD = 5;
let fatalExiting = false;
let recentFatals: number[] = [];

function fatalReason(err: unknown, message: string): string {
	if (isRetryableCursorError(err))
		return "Cursor lost its network connection. Please send the message again.";
	if (isAuthError(err))
		return "Cursor authentication failed. Please send the message again; if it keeps failing, re-check your Cursor API key in Settings → Models → Cursor.";
	return `Cursor worker error: ${message}`;
}

function handleFatal(kind: string, err: unknown): void {
	const message = errMessage(err);
	console.error(`[cursor-worker] ${kind}: ${message}`);
	try {
		// Attribute the fault to its originating session (set in
		// CursorCore.sendMessage). Auth faults are per-session so they scope to
		// just it; non-auth faults may be connection-level and fall back to
		// failing every turn — see `failTurnsForFatal` / `fatalScope`.
		const attributedSessionId = sessionContext.getStore()?.sessionId;
		for (const requestId of core.failTurnsForFatal(
			fatalReason(err, message),
			isAuthError(err),
			attributedSessionId,
		)) {
			out({ t: "sendDone", requestId });
		}
	} catch (recoverErr) {
		console.error(`[cursor-worker] recovery failed: ${errMessage(recoverErr)}`);
	}

	// Crash-loop breaker — the only condition under which the permanent worker
	// gives up and lets the supervisor respawn.
	const now = Date.now();
	recentFatals = recentFatals.filter((t) => now - t < FATAL_LOOP_WINDOW_MS);
	recentFatals.push(now);
	if (recentFatals.length < FATAL_LOOP_THRESHOLD || fatalExiting) return;
	fatalExiting = true;
	console.error(
		`[cursor-worker] ${recentFatals.length} fatal errors within ${FATAL_LOOP_WINDOW_MS}ms — respawning a clean worker`,
	);
	// Let the terminal events flush to the parent, then exit.
	setTimeout(() => process.exit(1), 30);
}

process.on("uncaughtException", (err) => handleFatal("uncaughtException", err));
process.on("unhandledRejection", (reason) =>
	handleFatal("unhandledRejection", reason),
);

async function handle(msg: ToWorker): Promise<void> {
	switch (msg.t) {
		case "setApiKey":
			core.setApiKey(msg.apiKey);
			return;
		case "send":
			applyAgentProxyToProcessEnv(msg.params.agentProxy);
			// CursorCore emits its own terminal end/error; `sendDone` just
			// releases the proxy's awaiting promise.
			await core.sendMessage(msg.requestId, msg.params, wireEmitter);
			out({ t: "sendDone", requestId: msg.requestId });
			return;
		case "title":
			try {
				await core.generateTitle(
					msg.requestId,
					msg.userMessage,
					msg.branchRenamePrompt,
					wireEmitter,
					msg.timeoutMs,
					msg.options,
				);
				out({ t: "rpcOk", rpcId: msg.rpcId, value: [] });
			} catch (err) {
				out({ t: "rpcErr", rpcId: msg.rpcId, message: errMessage(err) });
			}
			return;
		case "slash":
			try {
				const value = await core.listSlashCommands(msg.params);
				out({ t: "rpcOk", rpcId: msg.rpcId, value: [...value] });
			} catch (err) {
				out({ t: "rpcErr", rpcId: msg.rpcId, message: errMessage(err) });
			}
			return;
		case "models":
			try {
				const value = await core.listModels(msg.opts);
				out({ t: "rpcOk", rpcId: msg.rpcId, value: [...value] });
			} catch (err) {
				out({ t: "rpcErr", rpcId: msg.rpcId, message: errMessage(err) });
			}
			return;
		case "stop":
			await core.stopSession(msg.sessionId);
			return;
		case "shutdown":
			await core.shutdown();
			process.exit(0);
	}
}

function errMessage(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}

const rl = createInterface({ input: process.stdin });
rl.on("line", (line) => {
	const trimmed = line.trim();
	if (!trimmed) return;
	let msg: ToWorker;
	try {
		msg = JSON.parse(trimmed) as ToWorker;
	} catch {
		console.error(`[cursor-worker] bad request line: ${trimmed.slice(0, 200)}`);
		return;
	}
	void handle(msg).catch((err) => {
		console.error(`[cursor-worker] handler failed: ${errMessage(err)}`);
	});
});

// stdin EOF means the parent sidecar is gone — exit so we don't linger.
rl.on("close", () => process.exit(0));

out({ t: "ready" });

```

### Core Architecture Module: `src-tauri/src/agents/streaming/state.rs`
```
//! Explicit state machine for an agent turn.
//!
//! Replaces the implicit-state munge that used to live as a 1500-line
//! match arm in `streaming/mod.rs`. The types here are:
//!
//! - [`TurnState`] — three explicit phases (Initializing, Streaming,
//!   Terminated) with `is_terminated` checks at the top of every
//!   handler so a late event after a terminal transition is rejected
//!   loudly rather than silently dropped.
//! - [`TurnContext`] — the per-turn invariants that handlers read and
//!   mutate (provider, model id, working directory, permission mode,
//!   resolved session id, etc.). Replaces the bag of local `let mut`
//!   bindings that used to thread through the closure.
//! - [`TerminalReason`] — what flavor of terminal we hit, including
//!   the abnormal exits (`HeartbeatTimeout`, `SidecarDisconnected`)
//!   that don't arrive as a sidecar event.
//! - [`TransitionError`] — the structured rejection type the state
//!   machine returns instead of silently no-op'ing on invalid input.
//! - [`Action`](super::actions::Action) — the side-effect descriptor
//!   each `handle_*` returns. Caller dispatches via
//!   [`super::actions::apply_action`].
//!
//! Every event arm in `streaming/mod.rs` flows through one of these
//! handlers:
//!
//! | Event | Handler |
//! |-------|---------|
//! | `permissionRequest` | [`TurnSession::handle_permission_request`] |
//! | `permissionModeChanged` | [`TurnSession::handle_permission_mode_changed`] |
//! | `userInputRequest` | [`TurnSession::handle_user_input_request`] |
//! | `contextUsageUpdated` | [`TurnSession::handle_context_usage_updated`] |
//! | `planCaptured` | [`TurnSession::handle_plan_captured`] |
//! | `error` | [`TurnSession::handle_error`] |
//! | `end` / `aborted` | [`TurnSession::handle_end_or_aborted`] |
//! | default (`stream_event`, `assistant`, `result`, etc.) | [`TurnSession::handle_stream_event`] |
//! | heartbeat timeout / sidecar disconnect (synthesized) | [`TurnSession::handle_abnormal_exit`] |
//!
//! Pipeline mutation and DB writes still happen inline in the call
//! site because they need owned access to `MessagePipeline` and the
//! single-writer DB pool; the state machine takes the prepared values
//! and decides what to emit and how to advance the state.

// `TransitionError` variants `UnexpectedEventInState` / `MalformedEvent`
// (and the `TurnStateKind` discriminant they reference) are reserved for
// a future strict-validation pass — handlers today only emit
// `AlreadyTerminated`. Suppress dead-code warnings on the module rather
// than on each variant so the diff stays readable when those readers
// come online.
#![allow(dead_code)]

use serde_json::Value;

use crate::agents::AgentStreamEvent;
use crate::pipeline::types::ThreadMessageLike;
use crate::pipeline::PipelineEmit;

use super::actions::Action;
use super::bridges::{
    bridge_aborted_event, bridge_done_event, bridge_error_event, bridge_permission_request_event,
    bridge_user_input_request_event,
};

/// Top-level state of a single agent turn.
///
/// The Codex/Claude variation lives inside `TurnContext` (resolved model,
/// session id) and the pipeline accumulator (block-level streaming state).
/// `TurnState` is provider-agnostic: it tracks just whether the turn is
/// in-flight, paused, or done.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) enum TurnState {
    /// Sidecar request has been sent; we have not yet seen the first
    /// event. `system.init` (Claude) or the first stream notification
    /// (Codex) advances us to `Streaming`.
    Initializing,

    /// Receiving events. Most of the turn lives here. `permissionRequest`,
    /// `elicitationRequest`, `userInputRequest`, `permissionModeChanged`,
    /// `planCaptured`, and the default stream-event arm all keep us in
    /// `Streaming`.
    Streaming,

    /// A terminal event was received and processed. The event loop must
    /// break out of its receive loop on this transition. `TerminalReason`
    /// records why so the surface emit at the call site (Done / Aborted /
    /// Error) can be derived without re-inspecting the raw event.
    Terminated(TerminalReason),
}

/// Why the turn ended. Mirrors the AgentStreamEvent terminal variants
/// the frontend understands, plus two abnormal-exit reasons that don't
/// arrive as a sidecar event.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) enum TerminalReason {
    /// Sidecar emitted `end` — normal completion.
    Done,
    /// Sidecar emitted `aborted` — user pressed stop or app shutdown.
    Aborted { reason: String },
    /// Sidecar emitted `error`.
    Error {
        message: String,
        internal: bool,
        persisted: bool,
    },
    /// Heartbeat timeout fired (no sidecar event for 45s). Synthesized
    /// from the receiver loop, not from the sidecar.
    HeartbeatTimeout,
    /// Sidecar mpsc channel disconnected. Sidecar process likely died.
    /// Synthesized from the receiver loop.
    SidecarDisconnected,
}

/// Why the receiver loop synthesized an abnormal exit. Distinct from
/// `TerminalReason` because the call site needs to know which message
/// to log + whether to send `stopSession` to the sidecar BEFORE the
/// state-machine transition runs.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum AbnormalExit {
    /// `HEARTBEAT_TIMEOUT` elapsed without a sidecar event. Sidecar may
    /// still be alive but stuck; the call site sends stopSession before
    /// transitioning so a wedged turn doesn't keep eating tokens.
    HeartbeatTimeout,
    /// The sidecar mpsc channel disconnected. The sidecar process is
    /// almost certainly dead, so stopSession is best-effort and
    /// typically skipped.
    SidecarDisconnected,
}

impl AbnormalExit {
    fn event_kind(self) -> &'static str {
        match self {
            Self::HeartbeatTimeout => "heartbeat_timeout",
            Self::SidecarDisconnected => "sidecar_disconnected",
        }
    }

    fn into_terminal_reason(self) -> TerminalReason {
        match self {
            Self::HeartbeatTimeout => TerminalReason::HeartbeatTimeout,
            Self::SidecarDisconnected => TerminalReason::SidecarDisconnected,
        }
    }
}

/// Coarse-grained discriminant for `TurnState`, used in
/// `TransitionError::UnexpectedEventInState` to keep the variant cheap to
/// serialize for tracing without leaking the full payload.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum TurnStateKind {
    Initializing,
    Streaming,
    Terminated,
}

impl TurnState {
    pub(super) fn kind(&self) -> TurnStateKind {
        match self {
            TurnState::Initializing => TurnStateKind::Initializing,
            TurnState::Streaming => TurnStateKind::Streaming,
            TurnState::Terminated(_) => TurnStateKind::Terminated,
        }
    }

    pub(super) fn is_terminated(&self) -> bool {
        matches!(self, TurnState::Terminated(_))
    }
}

/// Per-turn invariants that the event handlers read and mutate. Distinct
/// from `TurnState` so the state-transition logic can be expressed without
/// dragging the long list of context fields into every variant.
///
/// All fields here exist in today's event loop as local `let mut` bindings
/// inside `stream_via_sidecar`. Bundling them into a struct lets the state
/// machine's `handle` function take `&mut self` once instead of threading
/// 12 arguments.
#[derive(Debug, Clone)]
pub(super) struct TurnContext {
    pub provider: String,
    pub model_id: String,
    pub working_directory: String,
    pub effort_level: Option<String>,
    pub permission_mode: Option<String>,
    pub fast_mode: bool,

    /// Helmor's session id (the DB primary key), if the request had one.
    /// `None` for transient turns that don't persist (e.g., title gen).
    pub helmor_session_id: Option<String>,

    /// Provider-issued session id (Claude conversation id, Codex thread id).
    /// Adopted from `system.init` per the rules in
    /// [`super::session_id::should_adopt_provider_session_id`].
    pub resolved_session_id: Option<String>,

    /// CLI model name. Initialized from the resolved-model fallback; the
    /// pipeline accumulator may upgrade it from a `system.init` event.
    pub resolved_model: String,

    /// How many turns we've already written to the DB. Compared against
    /// `pipeline.accumulator.turns_len()` after every push to drain newly
    /// completed turns into the DB without double-writing.
    pub persisted_turn_count: usize,

    /// When `planCaptured` fires we synthesize an exit-plan-review row;
    /// it lingers here so the terminal `end` event can append it to the
    /// final UI message bundle.
    pub persisted_exit_plan_review: Option<ThreadMessageLike>,
}

/// Reasons a `handle(state, event)` call may refuse to advance.
///
/// Today's event loop never returns these — invalid events are silently
/// dropped or processed despite being out-of-state. The state machine
/// surfaces them so the call site can log + decide (drop vs. force-
/// terminate); the loss-of-information bug class is closed.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) enum TransitionError {
    /// Event arrived after a terminal transition.
    AlreadyTerminated { event_kind: String },
    /// Event arrived in a state where it isn't legal.
    UnexpectedEventInState {
        state: TurnStateKind,
        event_kind: String,
    },
    /// Event payload missing required fields.
    MalformedEvent { event_kind: String, reason: String },
}

/// Owns the per-turn state machine. Every sidecar event the loop sees
/// flows through one of the `handle_*` methods on this struct.
///
/// The session is `Send` so it can live inside the `spawn_blocking`
/// closure that owns the event loop.
#[derive(Debug)]
pub(super) struct TurnSession {
    pub state: TurnState,
    pub ctx: TurnContext,
}

impl TurnSession {
    pub(super) fn new(ctx: TurnContext) -> Self {
        Self {
            state: TurnState::Initializing,
     
```

### Core Architecture Module: `src-tauri/src/agents/streaming/task_state_persist.rs`
```
//! Persist non-workflow background-task state as compact projection rows.
//!
//! The raw Claude `task_*` and `tool_progress` events are collected for live
//! rendering but are not normal persisted turns. Store one synthetic
//! `task_snapshot` system row per task so `convert_historical` can rebuild the
//! same final `TaskState` on reload without saving every progress delta.

use rusqlite::{params, Connection};
use serde_json::{json, Value};

use crate::pipeline::types::TaskState;

pub(super) fn is_task_state_source_event(raw: &Value) -> bool {
    match raw.get("type").and_then(Value::as_str) {
        Some("system") => crate::pipeline::event_filter::is_claude_task_lifecycle(raw),
        Some("tool_progress") => raw.get("task_id").and_then(Value::as_str).is_some(),
        _ => false,
    }
}

pub(super) fn upsert_task_state_snapshots(
    conn: &Connection,
    session_id: &str,
    tasks: &[TaskState],
) {
    for task in tasks {
        if let Err(err) = upsert_task_state_snapshot(conn, session_id, task) {
            tracing::warn!(
                task_id = %task.id,
                error = %err,
                "task_state_persist: failed to upsert task snapshot row",
            );
        }
    }
}

fn upsert_task_state_snapshot(
    conn: &Connection,
    session_id: &str,
    task: &TaskState,
) -> rusqlite::Result<()> {
    let row_id = format!("task-state:{session_id}:{}", task.id);
    let content = json!({
        "type": "system",
        "subtype": "task_snapshot",
        "task_id": task.id,
        "tool_use_id": task.tool_use_id,
        "task_state": task,
    })
    .to_string();
    let now = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    conn.execute(
        r#"
            INSERT INTO session_messages (id, session_id, role, content, created_at, sent_at)
            VALUES (?1, ?2, 'system', ?3, ?4, ?4)
            ON CONFLICT(id) DO UPDATE SET content = excluded.content
        "#,
        params![row_id, session_id, content, now],
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pipeline::types::{
        ExtendedMessagePart, HistoricalRecord, MessagePart, MessageRole, ThreadMessageLike,
    };
    use crate::pipeline::MessagePipeline;
    use rusqlite::params;

    fn test_conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            r#"
            CREATE TABLE session_messages (
                id TEXT PRIMARY KEY,
                session_id TEXT,
                role TEXT,
                content TEXT,
                sent_at TEXT,
                is_ai_priming INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            "#,
        )
        .unwrap();
        conn
    }

    fn task_tool_event(tool_use_id: &str, description: &str) -> Value {
        json!({
            "type": "assistant",
            "message": {
                "role": "assistant",
                "content": [{
                    "type": "tool_use",
                    "id": tool_use_id,
                    "name": "Task",
                    "input": {"description": description},
                }],
            },
        })
    }

    fn persist_new_turns(
        conn: &Connection,
        session_id: &str,
        pipeline: &MessagePipeline,
        persisted_turn_count: &mut usize,
    ) {
        while *persisted_turn_count < pipeline.accumulator.turns_len() {
            let turn = pipeline.accumulator.turn_at(*persisted_turn_count);
            let created_at = format!("2026-01-01T00:00:{:02}Z", *persisted_turn_count + 1);
            conn.execute(
                r#"
                    INSERT INTO session_messages (id, session_id, role, content, created_at, sent_at)
                    VALUES (?1, ?2, ?3, ?4, ?5, ?5)
                "#,
                params![
                    &turn.id,
                    session_id,
                    turn.role,
                    &turn.content_json,
                    created_at,
                ],
            )
            .unwrap();
            *persisted_turn_count += 1;
        }
    }

    fn feed_events(conn: &Connection, session_id: &str, events: Vec<Value>) -> MessagePipeline {
        let mut pipeline =
            MessagePipeline::new("claude", "claude-test", "session:test", session_id);
        let mut persisted_turn_count = 0usize;

        for event in events {
            let raw = event.to_string();
            pipeline.push_event(&event, &raw);
            persist_new_turns(conn, session_id, &pipeline, &mut persisted_turn_count);
            if is_task_state_source_event(&event) {
                let tasks = pipeline.task_state_snapshot();
                upsert_task_state_snapshots(conn, session_id, &tasks);
            }
        }

        pipeline.accumulator.flush_pending();
        persist_new_turns(conn, session_id, &pipeline, &mut persisted_turn_count);
        pipeline
    }

    fn records(conn: &Connection, session_id: &str) -> Vec<HistoricalRecord> {
        let mut stmt = conn
            .prepare(
                "SELECT id, role, content, created_at FROM session_messages \
                 WHERE session_id = ?1 ORDER BY created_at, id",
            )
            .unwrap();
        stmt.query_map([session_id], |r| {
            let content: String = r.get(2)?;
            Ok(HistoricalRecord {
                id: r.get(0)?,
                role: r.get::<_, String>(1)?.parse::<MessageRole>().unwrap(),
                parsed_content: serde_json::from_str(&content).ok(),
                content,
                created_at: r.get(3)?,
            })
        })
        .unwrap()
        .map(Result::unwrap)
        .collect()
    }

    fn first_task_state(messages: &[ThreadMessageLike]) -> TaskState {
        messages
            .iter()
            .flat_map(|message| message.content.iter())
            .find_map(|part| match part {
                ExtendedMessagePart::Basic(MessagePart::ToolCall { task_state, .. }) => {
                    task_state.as_deref().cloned()
                }
                _ => None,
            })
            .expect("task state attached to task tool")
    }

    fn assert_reloaded_task_matches_live(
        conn: &Connection,
        session_id: &str,
        pipeline: &mut MessagePipeline,
    ) {
        let live = first_task_state(&pipeline.finish());
        let reloaded = first_task_state(&crate::pipeline::adapter::convert_historical(&records(
            conn, session_id,
        )));
        assert_eq!(
            serde_json::to_value(reloaded).unwrap(),
            serde_json::to_value(live).unwrap(),
        );
    }

    #[test]
    fn non_workflow_task_snapshot_round_trips_completed_state() {
        let conn = test_conn();
        let session_id = "s1";
        let mut pipeline = feed_events(
            &conn,
            session_id,
            vec![
                task_tool_event("toolu_task_1", "Review repository state"),
                json!({
                    "type": "system",
                    "subtype": "task_started",
                    "task_id": "task_1",
                    "tool_use_id": "toolu_task_1",
                    "task_type": "local_agent",
                    "subagent_type": "Explore",
                    "description": "Review repository state",
                }),
                json!({
                    "type": "tool_progress",
                    "task_id": "task_1",
                    "tool_use_id": "toolu_task_1",
                    "tool_name": "Read",
                }),
                json!({
                    "type": "system",
                    "subtype": "task_notification",
                    "task_id": "task_1",
                    "tool_use_id": "toolu_task_1",
                    "status": "completed",
                    "summary": "Repository review complete",
                    "usage": {"total_tokens": 180, "tool_uses": 3, "duration_ms": 4500},
                }),
            ],
        );

        assert_reloaded_task_matches_live(&conn, session_id, &mut pipeline);
    }

    #[test]
    fn non_workflow_task_snapshot_round_trips_killed_state() {
        let conn = test_conn();
        let session_id = "s1";
        let mut pipeline = feed_events(
            &conn,
            session_id,
            vec![
                task_tool_event("toolu_task_kill", "Long-running audit"),
                json!({
                    "type": "system",
                    "subtype": "task_started",
                    "task_id": "task_kill",
                    "tool_use_id": "toolu_task_kill",
                    "task_type": "local_agent",
                    "description": "Long-running audit",
                }),
                json!({
                    "type": "system",
                    "subtype": "task_updated",
                    "task_id": "task_kill",
                    "patch": {
                        "status": "killed",
                        "is_backgrounded": true,
                        "error": "terminated by user",
                        "end_time": 1780015779522_i64,
                    },
                }),
            ],
        );

        assert_reloaded_task_matches_live(&conn, session_id, &mut pipeline);
    }

    #[test]
    fn task_snapshot_with_reused_task_id_round_trips_per_session() {
        let conn = test_conn();
        let mut first_pipeline = feed_events(
            &conn,
            "s1",
            vec![
                task_tool_event("toolu_shared_1", "First session task"),
                json!({
                    "type": "system",
                    "subtype": "task_started",
                    "task_id": "shared_task",
                    "tool_use_id": "toolu_shared_1",
                    "task_type": "local_agent",
                    "description": "First session task",
                }),
      
```

### Core Architecture Module: `src-tauri/src/cli/terminal_hook.rs`
```
//! `helmor terminal-hook` — receives an agent CLI's hook callback.
//!
//! Registered as the hook command for Terminal-Mode agents (claude/codex).
//! The agent runs it on lifecycle events with the hook payload
//! on stdin; the owning terminal session id arrives via the
//! `HELMOR_TERMINAL_SESSION_ID` env var (injected when Helmor spawns the PTY).
//!
//! Its job for M4a: persist the agent's real session id into
//! `sessions.provider_session_id` so a later relaunch can `--resume`. It is a
//! strict no-op when not invoked from a Helmor terminal (env missing), so a
//! user running the same agent outside Helmor is never affected. A hook must
//! never break the agent, so every failure is swallowed.

use std::io::Read;

use anyhow::Result;

use super::args::Cli;

pub fn run(agent: &str, _cli: &Cli) -> Result<()> {
    let Ok(terminal_session_id) = std::env::var("HELMOR_TERMINAL_SESSION_ID") else {
        return Ok(());
    };
    if terminal_session_id.is_empty() {
        return Ok(());
    }

    let mut payload = String::new();
    let _ = std::io::stdin().read_to_string(&mut payload);
    if payload.trim().is_empty() {
        return Ok(());
    }

    let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&payload) else {
        return Ok(());
    };

    if let Some(provider_session_id) = extract_session_id(agent, &parsed) {
        let _ = crate::models::sessions::set_provider_session_id(
            &terminal_session_id,
            &provider_session_id,
        );
    }

    // Busy/idle + captured prompt both need the owning workspace; look it up
    // once and reuse.
    let workspace_id = crate::models::sessions::workspace_id_for_session(&terminal_session_id)
        .ok()
        .flatten();

    // Mirror the hook lifecycle into busy/idle so the sidebar spinner +
    // completion notification treat this terminal exactly like a GUI session.
    if let (Some(busy), Some(workspace_id)) = (event_to_busy(&parsed), workspace_id.clone()) {
        let _ = crate::ui_sync::notify_running_app(
            crate::ui_sync::UiMutationEvent::TerminalActivityChanged {
                session_id: terminal_session_id.clone(),
                workspace_id,
                busy,
            },
        );
    }

    // Capture the submitted prompt so a Terminal session names itself + renames
    // its branch like a GUI session does on its first turn. The generator is
    // gated server-side, so only the first prompt actually renames.
    if let (Some(prompt), Some(workspace_id)) = (extract_prompt(&parsed), workspace_id) {
        let _ = crate::ui_sync::notify_running_app(
            crate::ui_sync::UiMutationEvent::TerminalPromptCaptured {
                session_id: terminal_session_id.clone(),
                workspace_id,
                prompt,
            },
        );
    }

    Ok(())
}

/// Map a hook event to a busy/idle transition (None = not state-changing).
/// Busy on prompt submit / tool use, idle on Stop or SessionEnd — Stop never
/// fires on a user interrupt, so SessionEnd is the only hook left when the
/// user quits claude mid-turn. SessionStart is NOT busy — the agent fires it
/// just by opening, which would spin the sidebar before any input (mirrors
/// ORCA's hook state machine).
fn event_to_busy(payload: &serde_json::Value) -> Option<bool> {
    match payload.get("hook_event_name").and_then(|v| v.as_str()) {
        Some("UserPromptSubmit" | "PreToolUse" | "PostToolUse") => Some(true),
        Some("Stop" | "SessionEnd") => Some(false),
        _ => None,
    }
}

/// Pull the user's submitted prompt out of a `UserPromptSubmit` payload.
/// claude and codex both use `prompt`; the fallbacks mirror ORCA's
/// candidate-key list for resilience. Gated on the event name — other events
/// carry unrelated text fields (e.g. Notification's `message`) that must not
/// masquerade as a prompt and trigger title/branch generation.
fn extract_prompt(payload: &serde_json::Value) -> Option<String> {
    if payload.get("hook_event_name").and_then(|v| v.as_str()) != Some("UserPromptSubmit") {
        return None;
    }
    for key in ["prompt", "user_prompt", "userPrompt", "message"] {
        if let Some(s) = payload.get(key).and_then(|v| v.as_str()) {
            let trimmed = s.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
    }
    None
}

/// Claude and Codex hook payloads both carry the session id in the common
/// `session_id` field, so one extractor covers both.
fn extract_session_id(_agent: &str, payload: &serde_json::Value) -> Option<String> {
    payload
        .get("session_id")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .map(str::to_string)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn extracts_session_id_from_claude_payload() {
        let p = json!({
            "session_id": "abc-123",
            "hook_event_name": "SessionStart",
            "cwd": "/x",
        });
        assert_eq!(extract_session_id("claude", &p).as_deref(), Some("abc-123"));
    }

    #[test]
    fn extracts_session_id_from_codex_payload() {
        let p = json!({ "session_id": "019b-xyz", "hook_event_name": "SessionStart" });
        assert_eq!(extract_session_id("codex", &p).as_deref(), Some("019b-xyz"));
    }

    #[test]
    fn missing_session_id_returns_none() {
        let p = json!({ "hook_event_name": "Stop" });
        assert_eq!(extract_session_id("claude", &p), None);
    }

    #[test]
    fn empty_session_id_returns_none() {
        let p = json!({ "session_id": "" });
        assert_eq!(extract_session_id("claude", &p), None);
    }

    #[test]
    fn session_start_does_not_set_busy() {
        let p = json!({ "hook_event_name": "SessionStart", "session_id": "x" });
        assert_eq!(event_to_busy(&p), None);
    }

    #[test]
    fn prompt_and_tool_events_set_busy() {
        for name in ["UserPromptSubmit", "PreToolUse", "PostToolUse"] {
            let p = json!({ "hook_event_name": name });
            assert_eq!(event_to_busy(&p), Some(true), "{name}");
        }
    }

    #[test]
    fn stop_and_session_end_clear_busy() {
        for name in ["Stop", "SessionEnd"] {
            let p = json!({ "hook_event_name": name });
            assert_eq!(event_to_busy(&p), Some(false), "{name}");
        }
    }

    #[test]
    fn extracts_prompt_from_user_prompt_submit() {
        let p = json!({ "hook_event_name": "UserPromptSubmit", "prompt": "fix the bug" });
        assert_eq!(extract_prompt(&p).as_deref(), Some("fix the bug"));
    }

    #[test]
    fn extract_prompt_trims_and_rejects_blank() {
        let submit = |p: &str| json!({ "hook_event_name": "UserPromptSubmit", "prompt": p });
        assert_eq!(extract_prompt(&submit("  hi  ")).as_deref(), Some("hi"));
        assert_eq!(extract_prompt(&submit("   ")), None);
        assert_eq!(extract_prompt(&json!({ "hook_event_name": "Stop" })), None);
    }

    #[test]
    fn extract_prompt_ignores_other_events_with_text_fields() {
        // Notification carries `message`; it must not masquerade as a prompt.
        let p = json!({ "hook_event_name": "Notification", "message": "perm needed" });
        assert_eq!(extract_prompt(&p), None);
        // No event name at all → not a prompt either.
        assert_eq!(extract_prompt(&json!({ "prompt": "hi" })), None);
    }
}

```

### Core Architecture Module: `src-tauri/src/downloads/worker.rs`
```
//! The async body that actually pulls bytes from a remote source.
//!
//! One worker per `Asset.id`. Multi-part HF assets are downloaded
//! sequentially (HF CDN doesn't reward parallel chunks per host, and
//! sequential keeps the progress bar honest).
//!
//! Lifecycle:
//!   1. Compute the total expected bytes (HF manifest or asset estimate).
//!   2. Emit `Started`.
//!   3. For each file: stream `Range:`-resumed bytes to `.part`,
//!      hash them on the fly, throttled-emit `Progress`.
//!   4. On EOF: verify SHA-256 (when manifest provided one), rename
//!      `.part` to its final name.
//!   5. Emit `Completed` once everything's on disk.
//!
//! Cancel observed at every chunk boundary — for a 5 GB download
//! over a typical residential connection that's ~250 ms of polling
//! granularity, plenty fast for "Pause" to feel instant.

use std::io::SeekFrom;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Instant;

use anyhow::{Context, Result};
use sha2::{Digest, Sha256};
use tauri::Manager;
use tokio::fs::{File, OpenOptions};
use tokio::io::{AsyncReadExt, AsyncSeekExt, AsyncWriteExt};

use super::hf::HfManifest;
use super::registry::DownloadsManager;
use super::types::{Asset, AssetEvent, AssetEventKind, AssetSource};

/// Throttle progress events to ~4/sec. UI doesn't need finer
/// granularity, and a flood of Channel sends starves the Tauri ipc
/// thread on slow machines.
const EMIT_INTERVAL: std::time::Duration = std::time::Duration::from_millis(250);

/// Chunk-level fsync cadence. Reading from a network stream is
/// dominated by socket latency; flushing every ~8 MB keeps disk-flush
/// amortised without making a power-cut resume re-download more than
/// a few seconds.
const FSYNC_INTERVAL: u64 = 8 * 1024 * 1024;

/// Per-chunk read timeout. The HTTP client only has a connect timeout
/// — without an explicit chunk-level deadline a TCP connection that
/// silently stops producing data (CDN edge wedge, NAT timeout, ISP
/// rebalance) would wedge the worker forever and Pause/Cancel only
/// fires on the *next* chunk boundary. 90 s is well above normal
/// inter-chunk gaps for HF-served LFS objects (~ms range) while still
/// surfacing a stuck stream within a useful window.
const CHUNK_READ_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(90);

pub async fn run(app: tauri::AppHandle, asset: Asset, cancel: Arc<AtomicBool>) -> Result<()> {
    tokio::fs::create_dir_all(&asset.target_dir)
        .await
        .with_context(|| format!("mkdir {}", asset.target_dir.display()))?;

    let registry = app.state::<DownloadsManager>();
    let client = registry.http_client()?;

    match asset.source.clone() {
        AssetSource::HuggingFace { repo } => run_hf(asset, &repo, cancel, &client, &registry).await,
    }
}

async fn run_hf(
    asset: Asset,
    repo: &str,
    cancel: Arc<AtomicBool>,
    client: &reqwest::Client,
    registry: &DownloadsManager,
) -> Result<()> {
    // Best-effort HF manifest. If this fails we still download (skip
    // SHA-256 verification + trust HTTP Content-Length).
    let manifest = match HfManifest::fetch(client, repo).await {
        Ok(m) => Some(m),
        Err(error) => {
            tracing::warn!(
                error = ?error,
                repo,
                "HF manifest fetch failed, continuing without integrity check"
            );
            None
        }
    };

    // Top-up mode: all essentials on disk, ≥1 optional missing. Progress scoped to optional bytes only.
    let mut all_essentials_present = true;
    for file in &asset.files {
        if tokio::fs::metadata(asset.target_dir.join(file))
            .await
            .is_err()
        {
            all_essentials_present = false;
            break;
        }
    }
    let mut any_optional_missing = false;
    for opt in &asset.optional_files {
        if tokio::fs::metadata(asset.target_dir.join(&opt.local_name))
            .await
            .is_err()
        {
            any_optional_missing = true;
            break;
        }
    }
    let top_up_mode = all_essentials_present && any_optional_missing;

    let total_expected = if top_up_mode {
        compute_total_optional_hf(&asset, manifest.as_ref())
    } else {
        compute_total_hf(&asset, manifest.as_ref())
    };
    registry.emit(AssetEvent {
        entry_id: asset.id.clone(),
        kind: AssetEventKind::Started {
            total: total_expected,
        },
    });

    let mut accumulated: u64 = 0;
    let mut last_emit = Instant::now();
    let mut last_bytes_marker = 0u64;
    let mut any_sha_verified = false;

    // Essential files: failure aborts the whole asset. Skipped in top-up mode.
    if !top_up_mode {
        for file in &asset.files {
            let final_path = asset.target_dir.join(file);
            let part_path = asset.target_dir.join(format!("{file}.part"));

            if let Ok(meta) = tokio::fs::metadata(&final_path).await {
                accumulated = accumulated.saturating_add(meta.len());
                continue;
            }

            let expected_size = manifest
                .as_ref()
                .and_then(|m| m.per_file.get(file))
                .and_then(|info| info.size)
                .unwrap_or(0);
            let expected_sha256 = manifest
                .as_ref()
                .and_then(|m| m.per_file.get(file))
                .and_then(|info| info.sha256.clone());

            let url = format!("https://huggingface.co/{repo}/resolve/main/{file}");
            let outcome = stream_to_part(
                client,
                &asset,
                &url,
                &part_path,
                expected_size,
                expected_sha256.as_deref(),
                &cancel,
                registry,
                &mut accumulated,
                total_expected,
                &mut last_emit,
                &mut last_bytes_marker,
            )
            .await;

            match outcome {
                Ok(FileOutcome::Completed { sha256_ok }) => {
                    tokio::fs::rename(&part_path, &final_path)
                        .await
                        .with_context(|| {
                            format!("rename {} -> {}", part_path.display(), final_path.display())
                        })?;
                    if sha256_ok {
                        any_sha_verified = true;
                    }
                }
                Ok(FileOutcome::Paused { downloaded }) => {
                    registry.emit(AssetEvent {
                        entry_id: asset.id.clone(),
                        kind: AssetEventKind::Paused {
                            downloaded,
                            total: total_expected,
                        },
                    });
                    return Ok(());
                }
                Err(error) => {
                    let retryable = is_retryable(&error);
                    registry.emit(AssetEvent {
                        entry_id: asset.id.clone(),
                        kind: AssetEventKind::Failed {
                            error: format!("{error:#}"),
                            retryable,
                        },
                    });
                    return Err(error);
                }
            }
        }
    } // end !top_up_mode

    // Optional files: best-effort. `remote_name` keys HF; `local_name` lives on disk.
    for opt in &asset.optional_files {
        let final_path = asset.target_dir.join(&opt.local_name);
        let part_path = asset.target_dir.join(format!("{}.part", opt.local_name));

        if tokio::fs::metadata(&final_path).await.is_ok() {
            continue;
        }
        if cancel.load(Ordering::Acquire) {
            // User cancelled mid-optional — fall through to the
            // Paused-emit path below.
            registry.emit(AssetEvent {
                entry_id: asset.id.clone(),
                kind: AssetEventKind::Paused {
                    downloaded: accumulated,
                    total: total_expected,
                },
            });
            return Ok(());
        }

        let expected_size = manifest
            .as_ref()
            .and_then(|m| m.per_file.get(&opt.remote_name))
            .and_then(|info| info.size)
            .unwrap_or(0);
        let expected_sha256 = manifest
            .as_ref()
            .and_then(|m| m.per_file.get(&opt.remote_name))
            .and_then(|info| info.sha256.clone());

        let url = format!(
            "https://huggingface.co/{repo}/resolve/main/{}",
            opt.remote_name
        );
        match stream_to_part(
            client,
            &asset,
            &url,
            &part_path,
            expected_size,
            expected_sha256.as_deref(),
            &cancel,
            registry,
            &mut accumulated,
            total_expected,
            &mut last_emit,
            &mut last_bytes_marker,
        )
        .await
        {
            Ok(FileOutcome::Completed { sha256_ok }) => {
                if let Err(error) = tokio::fs::rename(&part_path, &final_path).await {
                    tracing::warn!(
                        error = %error,
                        file = %opt.local_name,
                        "optional file rename failed; continuing without it"
                    );
                }
                if sha256_ok {
                    any_sha_verified = true;
                }
            }
            Ok(FileOutcome::Paused { downloaded }) => {
                registry.emit(AssetEvent {
                    entry_id: asset.id.clone(),
                    kind: AssetEventKind::Paused {
                        downloaded,
                        total: total_expected,
                    },
                });
                return Ok(());
            }
            Err(error) => {
                tracing::warn!(
          
```

### Core Architecture Module: `src-tauri/src/pipeline/adapter/task_state.rs`
```
//! Aggregation for Claude SDK background-task lifecycle events.
//!
//! This keeps `task_*` control events out of the rendered transcript while
//! preserving their structured state for later task-panel consumers.

use std::collections::HashMap;

use serde_json::Value;

use crate::pipeline::types::{
    ExtendedMessagePart, IntermediateMessage, MessagePart, TaskState, TaskStatus, TaskUsage,
    ThreadMessageLike,
};

#[derive(Default)]
pub(crate) struct TaskStateAccumulator {
    order: Vec<String>,
    runs: HashMap<String, TaskState>,
    tool_to_task: HashMap<String, String>,
}

impl TaskStateAccumulator {
    pub(crate) fn on_task_event(&mut self, msg: &IntermediateMessage, value: &Value) -> bool {
        if value.get("subtype").and_then(Value::as_str) == Some("task_snapshot") {
            return self.on_task_snapshot(value);
        }
        if !crate::pipeline::event_filter::is_claude_task_lifecycle(value) {
            return false;
        }
        if value.get("task_type").and_then(Value::as_str) == Some("local_workflow") {
            return false;
        }

        let Some(task_id) = self.resolve_task_id(value) else {
            // Unattributable lifecycle event (neither task_id nor
            // tool_use_id): swallow it — it is still task noise, not
            // transcript prose — but do NOT mint a phantom per-event
            // TaskState keyed by the message id (those would accumulate
            // unbounded "Untitled task" rows and persist as snapshots).
            return true;
        };
        let subtype = value.get("subtype").and_then(Value::as_str).unwrap_or("");
        let tool_use_id = value.get("tool_use_id").and_then(Value::as_str);
        self.link_refs(&task_id, tool_use_id);

        let state = self.ensure_state(task_id, tool_use_id);
        state.updated_at = Some(msg.created_at.clone());
        merge_string(
            &mut state.task_type,
            value.get("task_type").and_then(Value::as_str),
        );
        merge_string(
            &mut state.subagent_type,
            value.get("subagent_type").and_then(Value::as_str),
        );
        merge_string(
            &mut state.description,
            value.get("description").and_then(Value::as_str),
        );

        match subtype {
            "task_started" => {
                if state.started_at.is_none() {
                    state.started_at = Some(msg.created_at.clone());
                }
                set_status(state, TaskStatus::Running);
            }
            "task_progress" => {
                if !is_terminal(&state.status) {
                    state.status = TaskStatus::Running;
                }
                merge_string(
                    &mut state.summary,
                    value.get("summary").and_then(Value::as_str),
                );
                merge_string(
                    &mut state.last_tool_name,
                    value.get("last_tool_name").and_then(Value::as_str),
                );
                merge_usage(state, value);
            }
            "task_updated" => {
                if let Some(patch) = value.get("patch") {
                    merge_patch(state, patch);
                }
            }
            "task_notification" => {
                if let Some(status) = value.get("status").and_then(Value::as_str) {
                    set_status(state, map_status(status));
                }
                merge_string(
                    &mut state.summary,
                    value
                        .get("summary")
                        .or_else(|| value.get("message"))
                        .and_then(Value::as_str),
                );
                merge_string(
                    &mut state.output_file,
                    value.get("output_file").and_then(Value::as_str),
                );
                merge_usage(state, value);
            }
            _ => {}
        }

        true
    }

    pub(crate) fn on_tool_progress(&mut self, msg: &IntermediateMessage, value: &Value) -> bool {
        if value.get("type").and_then(Value::as_str) != Some("tool_progress") {
            return false;
        }
        let Some(task_id) = value.get("task_id").and_then(Value::as_str) else {
            return false;
        };
        let task_id = task_id.to_string();
        let tool_use_id = value.get("tool_use_id").and_then(Value::as_str);
        self.link_refs(&task_id, tool_use_id);

        let state = self.ensure_state(task_id, tool_use_id);
        state.updated_at = Some(msg.created_at.clone());
        if state.started_at.is_none() {
            state.started_at = Some(msg.created_at.clone());
        }
        if !is_terminal(&state.status) {
            state.status = TaskStatus::Running;
        }
        merge_string(
            &mut state.last_tool_name,
            value.get("tool_name").and_then(Value::as_str),
        );
        true
    }

    pub(crate) fn states(&self) -> Vec<TaskState> {
        self.order
            .iter()
            .filter_map(|id| self.runs.get(id).cloned())
            .collect()
    }

    fn on_task_snapshot(&mut self, value: &Value) -> bool {
        let Some(snapshot) = value.get("task_state").or_else(|| value.get("taskState")) else {
            return false;
        };
        let state = match serde_json::from_value::<TaskState>(snapshot.clone()) {
            Ok(state) => state,
            Err(error) => {
                // Never silently drop persisted task history: a TaskState
                // field rename would otherwise erase every historical
                // snapshot with no signal.
                tracing::warn!(%error, "Failed to deserialize persisted task_snapshot row");
                return false;
            }
        };
        let task_id = state.id.clone();
        self.link_refs(&task_id, state.tool_use_id.as_deref());
        if !self.runs.contains_key(&task_id) {
            self.order.push(task_id.clone());
        }
        self.runs.insert(task_id, state);
        true
    }

    /// Events lacking BOTH ids are unattributable — dropping them beats
    /// minting a phantom per-event TaskState keyed by the message id (which
    /// would accumulate unbounded "Untitled task" rows that also persist).
    fn resolve_task_id(&self, value: &Value) -> Option<String> {
        if let Some(id) = value.get("task_id").and_then(Value::as_str) {
            return Some(id.to_string());
        }
        let tool_use_id = value.get("tool_use_id").and_then(Value::as_str)?;
        self.tool_to_task
            .get(tool_use_id)
            .cloned()
            .or_else(|| Some(tool_use_id.to_string()))
    }

    fn link_refs(&mut self, task_id: &str, tool_use_id: Option<&str>) {
        let Some(tool_use_id) = tool_use_id else {
            return;
        };
        self.tool_to_task
            .insert(tool_use_id.to_string(), task_id.to_string());
    }

    fn ensure_state(&mut self, task_id: String, tool_use_id: Option<&str>) -> &mut TaskState {
        if !self.runs.contains_key(&task_id) {
            self.order.push(task_id.clone());
            self.runs.insert(
                task_id.clone(),
                TaskState {
                    id: task_id.clone(),
                    tool_use_id: tool_use_id.map(str::to_string),
                    description: None,
                    task_type: None,
                    subagent_type: None,
                    status: TaskStatus::Running,
                    is_backgrounded: false,
                    summary: None,
                    usage: None,
                    last_tool_name: None,
                    error: None,
                    started_at: None,
                    updated_at: None,
                    end_time_ms: None,
                    total_paused_ms: None,
                    output_file: None,
                },
            );
        }
        let state = self
            .runs
            .get_mut(&task_id)
            .expect("task state inserted above");
        if state.tool_use_id.is_none() {
            state.tool_use_id = tool_use_id.map(str::to_string);
        }
        state
    }
}

pub(super) fn attach_task_states(messages: &mut [ThreadMessageLike], acc: &TaskStateAccumulator) {
    for state in acc.states() {
        if let Some(tool_use_id) = state.tool_use_id.clone() {
            attach_to_owner(messages, tool_use_id, state);
        }
    }
}

fn attach_to_owner(
    messages: &mut [ThreadMessageLike],
    tool_use_id: String,
    state: TaskState,
) -> bool {
    for msg in messages {
        if msg
            .content
            .iter_mut()
            .any(|part| attach_to_part(part, &tool_use_id, state.clone()))
        {
            return true;
        }
    }
    false
}

fn attach_to_part(part: &mut ExtendedMessagePart, tool_use_id: &str, state: TaskState) -> bool {
    match part {
        ExtendedMessagePart::Basic(MessagePart::ToolCall {
            tool_call_id,
            task_state,
            children,
            ..
        }) => {
            if tool_call_id == tool_use_id {
                *task_state = Some(Box::new(state));
                return true;
            }
            children
                .iter_mut()
                .any(|child| attach_to_part(child, tool_use_id, state.clone()))
        }
        ExtendedMessagePart::CollapsedGroup(group) => {
            for tool in &mut group.tools {
                if let MessagePart::ToolCall {
                    tool_call_id,
                    task_state,
                    ..
                } = tool
                {
                    if tool_call_id == tool_use_id {
                        *task_state = Some(Box::new(state));
                        return true;
                    }
                }
            }
            false
        }
        _ => false,
    }
}

fn merge_patch(state: &mut TaskState, patch: &Value) {
    if let Some(status) = patch.get("status").a
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #293** (2026-04-29): **bad CPU type in executable - gh binary bundled in Helmor.app may be arm64 only**
  *Symptoms*: ## Error Description  When trying to run `gh auth login` through Helmor, I get the error:    ## Steps to Reproduce  1. Open Helmor 2. Run `gh auth login` 3. Error above  ## Environment  - macOS - **Intel Mac (x64)** - NOT Apple Silicon - This error suggests the bundled gh binary may be compiled for arm64 only, not Intel  ## Suggested Fix  The gh binary in `/Applications/Helmor.app/Contents/Resources/vendor/gh/gh` needs to be rebuilt as a universal binary (supporting both arm64 and amd64) or provide separate binaries per architecture.
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting, will fix it ASAP.
  > @lncitador Please check the latest release. The issue should be fixed, but I really couldn’t test it myself. Give it a try :)

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

### Incident Patch 1: `bda8c15c` (2026-07-17)
**Commit Message**: fix: sign Codex code-mode host with JIT entitlements (#937)

fix(sidecar): sign Codex code-mode host for JIT

**File**: `.changeset/fresh-tools-work.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"helmor": patch
+---
+
+Fix Codex code-mode tool calls failing in signed macOS builds.
```

**File**: `sidecar/scripts/stage-vendor.ts` (modified, +3/-1)
```diff
@@ -508,7 +508,9 @@ function stageCodexFromVendorRoot(archRoot: string): void {
 		const hostDest = join(DIST_VENDOR, "codex", `codex-code-mode-host${EXE}`);
 		copyFile(hostSrc, hostDest);
 		chmodSync(hostDest, 0o755);
-		maybeSignMacBinary(hostDest, false);
+		// The host embeds V8, which needs executable-memory entitlements under
+		// the hardened runtime or it traps during isolate initialization.
+		maybeSignMacBinary(hostDest, true);
 	}
 
 	const pathSrc = join(archRoot, pathDir);
```

---

### Incident Patch 2: `979b230e` (2026-07-17)
**Commit Message**: fix: exclude Run Action scripts from background task bar (#934)

**File**: `.changeset/quiet-setup-task-bar.md` (modified, +1/-1)
```diff
@@ -2,4 +2,4 @@
 "helmor": patch
 ---
 
-Keep workspace setup scripts out of the background task bar above the composer.
+Keep workspace setup and Run Action scripts out of the background task bar above the composer.
```

**File**: `src/features/composer/container.tsx` (modified, +0/-1)
```diff
@@ -1310,7 +1310,6 @@ export const WorkspaceComposerContainer = memo(
 					<TaskProgressPanel
 						sessionId={displayedSessionId}
 						workspaceId={displayedWorkspaceId}
-						repoId={effectiveRepoId}
 					/>
 					{/* Docked (open-bottom) bars live in normal flow DIRECTLY above
 					    the composer — nothing may render between them and it. Order
```

**File**: `src/features/composer/task-progress/index.test.tsx` (modified, +4/-10)
```diff
@@ -63,11 +63,7 @@ function renderPanelWithScripts(repoScripts: RepoScripts) {
 		repoScripts,
 	);
 	return render(
-		<TaskProgressPanel
-			sessionId={SESSION_ID}
-			workspaceId={WORKSPACE_ID}
-			repoId={REPO_ID}
-		/>,
+		<TaskProgressPanel sessionId={SESSION_ID} workspaceId={WORKSPACE_ID} />,
 		{
 			wrapper: ({ children }) => (
 				<QueryClientProvider client={queryClient}>
@@ -158,15 +154,15 @@ describe("TaskProgressPanel", () => {
 		expect(container).toBeEmptyDOMElement();
 	});
 
-	it("continues surfacing running run actions as background tasks", () => {
+	it("does not surface running run actions as background tasks", () => {
 		scriptStoreMocks.getScriptState.mockImplementation(
 			(_workspaceId, scriptType, actionId) =>
 				scriptType === "run" && actionId === "dev"
 					? { status: "running" }
 					: null,
 		);
 
-		renderPanelWithScripts(
+		const { container } = renderPanelWithScripts(
 			makeRepoScripts({
 				runFromProject: true,
 				runActions: [
@@ -181,9 +177,7 @@ describe("TaskProgressPanel", () => {
 			}),
 		);
 
-		const strip = screen.getByRole("button", { name: "Background tasks" });
-		expect(strip).toHaveTextContent("Dev server");
-		expect(strip).toHaveTextContent("0/1");
+		expect(container).toBeEmptyDOMElement();
 	});
 
 	it("collapses by default showing current task, progress, and status", () => {
```

**File**: `src/features/composer/task-progress/index.tsx` (modified, +2/-4)
```diff
@@ -140,21 +140,19 @@ function toolArgString(tool: ToolCallPart | null, key: string): string | null {
 /**
  * Composer-anchored background-task pill + drill-down card, the sibling of
  * `WorkflowProgressPanel`. The pill appears whenever the session has tasks
- * (or, with none, running workspace processes); clicking it opens a card with
+ * (or, with none, running terminal processes); clicking it opens a card with
  * Level 0 = the task list and Level 1 = one task's detail (metrics, command,
  * summary, error, and a clickable output file that opens in the editor).
  */
 export function TaskProgressPanel({
 	sessionId,
 	workspaceId,
-	repoId,
 }: {
 	sessionId: string | null;
 	workspaceId?: string | null;
-	repoId?: string | null;
 }) {
 	const { f, t } = useI18n();
-	const data = useBackgroundTasks({ sessionId, workspaceId, repoId });
+	const data = useBackgroundTasks({ sessionId, workspaceId });
 	const panelRef = useRef<HTMLDivElement>(null);
 	const scrollContentRef = useRef<HTMLDivElement>(null);
 	const activeRef = useRef<HTMLButtonElement>(null);
```

**File**: `src/features/composer/task-progress/use-background-tasks.ts` (modified, +4/-98)
```diff
@@ -1,10 +1,6 @@
 import { useQuery } from "@tanstack/react-query";
 import { useEffect, useMemo, useState } from "react";
 import { useStreamingStore } from "@/features/conversation/state/streaming-store";
-import {
-	getScriptState,
-	subscribeStatus,
-} from "@/features/inspector/script-store";
 import {
 	getTerminalDisplayTitle,
 	getTerminals,
@@ -16,23 +12,17 @@ import {
 } from "@/features/terminal/terminal-session-store";
 import type {
 	ExtendedMessagePart,
-	RepoScripts,
 	TaskState,
 	ThreadMessageLike,
 	ToolCallPart,
 } from "@/lib/api";
-import { loadRepoScripts } from "@/lib/api";
-import {
-	helmorQueryKeys,
-	sessionThreadMessagesQueryOptions,
-} from "@/lib/query-client";
+import { sessionThreadMessagesQueryOptions } from "@/lib/query-client";
 
 const EMPTY_TASKS: readonly TaskState[] = Object.freeze([]);
-const EMPTY_RUN_ACTIONS = Object.freeze([]);
 
 export type BackgroundFallbackItem = {
 	id: string;
-	kind: "script" | "inspector-terminal" | "terminal-session";
+	kind: "inspector-terminal" | "terminal-session";
 	title: string;
 	typeKey: string;
 	command?: string | null;
@@ -93,66 +83,6 @@ export function extractTaskStatesFromMessages(
 	return Array.from(tasksById.values());
 }
 
-function runningScriptFallbacks(
-	workspaceId: string | null | undefined,
-	repoScripts: RepoScripts | null | undefined,
-): BackgroundFallbackItem[] {
-	if (!workspaceId || !repoScripts) return [];
-	const items: BackgroundFallbackItem[] = [];
-	// Setup is workspace initialization with its own inspector status/output,
-	// not background work owned by the active chat session. Keep this fallback
-	// focused on long-lived Run actions and terminals.
-	for (const action of repoScripts.runActions) {
-		if (!action.command.trim()) continue;
-		const run = getScriptState(workspaceId, "run", action.id);
-		if (run?.status === "running") {
-			items.push({
-				id: `${workspaceId}:run:${action.id}`,
-				kind: "script",
-				title: action.name.trim() || "run",
-				typeKey: "taskPanelTypeScript",
-				command: action.command,
-				status: "running",
-			});
-		}
-	}
-	return items;
-}
-
-function useScriptFallbacks(
-	workspaceId: string | null | undefined,
-	repoScripts: RepoScripts | null | undefined,
-	enabled: boolean,
-): BackgroundFallbackItem[] {
-	const [items, setItems] = useState<BackgroundFallbackItem[]>(() =>
-		enabled ? runningScriptFallbacks(workspaceId, repoScripts) : [],
-	);
-	const runActions = repoScripts?.runActions ?? EMPTY_RUN_ACTIONS;
-	const runActionKey = runActions.map((action) => action.id).join("|");
-
-	useEffect(() => {
-		if (!enabled || !workspaceId || !repoScripts) {
-			setItems([]);
-			return;
-		}
-		const refresh = () => {
-			setItems(runningScriptFallbacks(workspaceId, repoScripts));
-		};
-		refresh();
-		const unsubscribers: Array<() => void> = [];
-		for (const action of runActions) {
-			unsubscribers.push(
-				subscribeStatus(workspaceId, "run", refresh, action.id),
-			);
-		}
-		return () => {
-			for (const unsubscribe of unsubscribers) unsubscribe();
-		};
-	}, [enabled, repoScripts, runActions, runActionKey, workspaceId]);
-
-	return items;
-}
-
 function useInspectorTerminalFallbacks(
 	workspaceId: string | null | undefined,
 	enabled: boolean,
@@ -231,16 +161,14 @@ function useTerminalSessionFallbacks(
  * from the streaming store during a turn; historical terminal states are
  * re-derived from the rendered thread cache (same source the conversation
  * reads). When the session has no tasks at all, running workspace processes
- * (scripts / terminals) surface as fallback items.
+ * (terminals) surface as fallback items.
  */
 export function useBackgroundTasks({
 	sessionId,
 	workspaceId,
-	repoId,
 }: {
 	sessionId: string | null;
 	workspaceId?: string | null;
-	repoId?: string | null;
 }): BackgroundTasksData {
 	const activeTasks = useStreamingStore((state) =>
 		sessionId
@@ -269,22 +197,6 @@ export function useBackgroundTasks({
 		return Array.from(byId.values());
 	}, [activeTasks, historicalTasks]);
 	const fallbackEnabled = tasks.length === 0;
-	// Scripts are only needed for fallback mode — don't fetch (or refetch on
-	// window focus) while real tasks own the panel.
-	const { data: repoScripts } = useQuery({
-		queryKey: helmorQueryKeys.repoScripts(
-			repoId ?? "__none__",
-			workspaceId ?? null,
-		),
-		queryFn: () => loadRepoScripts(repoId!, workspaceId ?? null),
-		enabled: fallbackEnabled && Boolean(repoId && workspaceId),
-		staleTime: 30_000,
-	});
-	const scriptFallbacks = useScriptFallbacks(
-		workspaceId,
-		repoScripts,
-		fallbackEnabled,
-	);
 	const inspectorTerminalFallbacks = useInspectorTerminalFallbacks(
 		workspaceId,
 		fallbackEnabled,
@@ -299,18 +211,12 @@ export function useBackgroundTasks({
 			return { mode: "tasks", tasks, fallbacks: [] };
 		}
 		const fallbacks = [
-			...scriptFallbacks,
 			...inspectorTerminalFallbacks,
 			...terminalSessionFallbacks,
 		];
 		if (fallbacks.length > 0) {
 			return { mod
```

---

### Incident Patch 3: `21f9c770` (2026-07-16)
**Commit Message**: fix: hide setup scripts from background task bar (#932)

**File**: `.changeset/quiet-setup-task-bar.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"helmor": patch
+---
+
+Keep workspace setup scripts out of the background task bar above the composer.
```

**File**: `src/features/composer/task-progress/index.test.tsx` (modified, +94/-1)
```diff
@@ -3,12 +3,21 @@ import { cleanup, fireEvent, render, screen } from "@testing-library/react";
 import type { ReactNode } from "react";
 import { beforeEach, describe, expect, it, vi } from "vitest";
 import { useStreamingStore } from "@/features/conversation/state/streaming-store";
-import type { TaskState } from "@/lib/api";
+import type { RepoScripts, TaskState } from "@/lib/api";
 import { helmorQueryKeys } from "@/lib/query-client";
 import { shellEventName } from "@/shell/event-bus";
 import { TaskProgressPanel } from "./index";
 
 const SESSION_ID = "session-1";
+const WORKSPACE_ID = "workspace-1";
+const REPO_ID = "repo-1";
+
+const scriptStoreMocks = vi.hoisted(() => ({
+	getScriptState: vi.fn(),
+	subscribeStatus: vi.fn(() => () => {}),
+}));
+
+vi.mock("@/features/inspector/script-store", () => scriptStoreMocks);
 
 function makeTask(overrides: Partial<TaskState> = {}): TaskState {
 	return {
@@ -41,9 +50,52 @@ function renderPanel(tasks: TaskState[]) {
 	return render(<TaskProgressPanel sessionId={SESSION_ID} />, { wrapper });
 }
 
+function renderPanelWithScripts(repoScripts: RepoScripts) {
+	const queryClient = new QueryClient({
+		defaultOptions: { queries: { retry: false, enabled: false } },
+	});
+	queryClient.setQueryData(
+		[...helmorQueryKeys.sessionMessages(SESSION_ID), "thread"],
+		[],
+	);
+	queryClient.setQueryData(
+		helmorQueryKeys.repoScripts(REPO_ID, WORKSPACE_ID),
+		repoScripts,
+	);
+	return render(
+		<TaskProgressPanel
+			sessionId={SESSION_ID}
+			workspaceId={WORKSPACE_ID}
+			repoId={REPO_ID}
+		/>,
+		{
+			wrapper: ({ children }) => (
+				<QueryClientProvider client={queryClient}>
+					{children}
+				</QueryClientProvider>
+			),
+		},
+	);
+}
+
+function makeRepoScripts(overrides: Partial<RepoScripts> = {}): RepoScripts {
+	return {
+		setupScript: null,
+		archiveScript: null,
+		setupFromProject: false,
+		runFromProject: false,
+		archiveFromProject: false,
+		autoRunSetup: true,
+		runActions: [],
+		...overrides,
+	};
+}
+
 beforeEach(() => {
 	cleanup();
 	useStreamingStore.setState({ activeTasksBySession: {} });
+	scriptStoreMocks.getScriptState.mockReset().mockReturnValue(null);
+	scriptStoreMocks.subscribeStatus.mockClear();
 });
 
 describe("TaskProgressPanel", () => {
@@ -93,6 +145,47 @@ describe("TaskProgressPanel", () => {
 		expect(container).toBeEmptyDOMElement();
 	});
 
+	it("does not surface a running setup script as a background task", () => {
+		scriptStoreMocks.getScriptState.mockImplementation(
+			(_workspaceId, scriptType) =>
+				scriptType === "setup" ? { status: "running" } : null,
+		);
+
+		const { container } = renderPanelWithScripts(
+			makeRepoScripts({ setupScript: "bun install" }),
+		);
+
+		expect(container).toBeEmptyDOMElement();
+	});
+
+	it("continues surfacing running run actions as background tasks", () => {
+		scriptStoreMocks.getScriptState.mockImplementation(
+			(_workspaceId, scriptType, actionId) =>
+				scriptType === "run" && actionId === "dev"
+					? { status: "running" }
+					: null,
+		);
+
+		renderPanelWithScripts(
+			makeRepoScripts({
+				runFromProject: true,
+				runActions: [
+					{
+						id: "dev",
+						name: "Dev server",
+						command: "bun run dev",
+						mode: "non-concurrent",
+						fromProject: true,
+					},
+				],
+			}),
+		);
+
+		const strip = screen.getByRole("button", { name: "Background tasks" });
+		expect(strip).toHaveTextContent("Dev server");
+		expect(strip).toHaveTextContent("0/1");
+	});
+
 	it("collapses by default showing current task, progress, and status", () => {
 		renderPanel([makeTask()]);
 		const strip = screen.getByRole("button", { name: "Background tasks" });
```

**File**: `src/features/composer/task-progress/use-background-tasks.ts` (modified, +4/-25)
```diff
@@ -99,19 +99,9 @@ function runningScriptFallbacks(
 ): BackgroundFallbackItem[] {
 	if (!workspaceId || !repoScripts) return [];
 	const items: BackgroundFallbackItem[] = [];
-	if (repoScripts.setupScript?.trim()) {
-		const setup = getScriptState(workspaceId, "setup");
-		if (setup?.status === "running") {
-			items.push({
-				id: `${workspaceId}:setup`,
-				kind: "script",
-				title: "setup",
-				typeKey: "taskPanelTypeScript",
-				command: repoScripts.setupScript,
-				status: "running",
-			});
-		}
-	}
+	// Setup is workspace initialization with its own inspector status/output,
+	// not background work owned by the active chat session. Keep this fallback
+	// focused on long-lived Run actions and terminals.
 	for (const action of repoScripts.runActions) {
 		if (!action.command.trim()) continue;
 		const run = getScriptState(workspaceId, "run", action.id);
@@ -139,7 +129,6 @@ function useScriptFallbacks(
 	);
 	const runActions = repoScripts?.runActions ?? EMPTY_RUN_ACTIONS;
 	const runActionKey = runActions.map((action) => action.id).join("|");
-	const setupEnabled = Boolean(repoScripts?.setupScript?.trim());
 
 	useEffect(() => {
 		if (!enabled || !workspaceId || !repoScripts) {
@@ -151,9 +140,6 @@ function useScriptFallbacks(
 		};
 		refresh();
 		const unsubscribers: Array<() => void> = [];
-		if (setupEnabled) {
-			unsubscribers.push(subscribeStatus(workspaceId, "setup", refresh));
-		}
 		for (const action of runActions) {
 			unsubscribers.push(
 				subscribeStatus(workspaceId, "run", refresh, action.id),
@@ -162,14 +148,7 @@ function useScriptFallbacks(
 		return () => {
 			for (const unsubscribe of unsubscribers) unsubscribe();
 		};
-	}, [
-		enabled,
-		repoScripts,
-		runActions,
-		runActionKey,
-		setupEnabled,
-		workspaceId,
-	]);
+	}, [enabled, repoScripts, runActions, runActionKey, workspaceId]);
 
 	return items;
 }
```

---

### Incident Patch 4: `b45da7bf` (2026-07-16)
**Commit Message**: Fix new workspace repository picker alignment (#933)

fix: align new workspace repository picker

**File**: `.changeset/steady-repo-headings.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"helmor": patch
+---
+
+Fix repository names shifting vertically on the new workspace screen when switching between generated initials and image icons.
```

**File**: `src/App.create.test.tsx` (modified, +4/-0)
```diff
@@ -362,6 +362,10 @@ describe("App create workspace flow", () => {
 		await user.click(screen.getByRole("button", { name: "New workspace" }));
 
 		expect(await screen.findByLabelText("Workspace input")).toBeInTheDocument();
+		const repositoryPicker = await screen.findByRole("button", {
+			name: "dosu-cli",
+		});
+		expect(repositoryPicker.parentElement).toHaveClass("flex");
 		await waitFor(() => {
 			expect(
 				screen.getByRole("button", { name: "New Workspace" }),
```

**File**: `src/features/workspace-start/index.tsx` (modified, +2/-1)
```diff
@@ -531,7 +531,8 @@ export function WorkspaceStartPage({
 										onOpenChange={setRepoTooltipOpen}
 									>
 										<TooltipTrigger asChild>
-											<div>
+											{/* Avoid avatar-dependent inline baselines shifting the button. */}
+											<div className="flex">
 												<RepositoryPicker
 													repositories={repositories}
 													selectedRepository={selectedRepository}
```

---

### Incident Patch 5: `364c4118` (2026-07-15)
**Commit Message**: fix: show all repositories in workspace start page picker (#930)

The repository picker was filtering to show only the first 9 repositories
with keyboard shortcuts, preventing users from selecting or even searching
for the 10th and later repositories. This now displays the full list while
keeping the 1-9 keyboard shortcuts for the first 9 items.

**File**: `.changeset/repo-picker-show-all.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"helmor": patch
+---
+
+Fix the start page repository picker capping its list at 9, so the 10th and later repositories now show up and can be searched.
```

**File**: `src/features/workspace-start/index.tsx` (modified, +25/-9)
```diff
@@ -198,7 +198,7 @@ function RepositoryPicker({
 						<CommandEmpty>
 							<I18nText source="noRepositoriesFound" />
 						</CommandEmpty>
-						{repositories.slice(0, 9).map((repository, index) => {
+						{repositories.map((repository, index) => {
 							const repoName = extractRepoName(repository.remoteUrl);
 							return (
 								<CommandItem
@@ -207,10 +207,19 @@ function RepositoryPicker({
 									onSelect={() => handleSelect(repository.id)}
 									className="gap-2"
 								>
-									{/* Number badge for first 9 repos */}
-									<kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
-										{index + 1}
-									</kbd>
+									{/* Number badge for the first 9 repos — mirrors the 1-9
+									 *  keyboard shortcut. Later repos keep a same-width spacer
+									 *  so the avatars stay aligned. */}
+									{index < 9 ? (
+										<kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
+											{index + 1}
+										</kbd>
+									) : (
+										<span
+											className="inline-flex h-5 w-5 shrink-0"
+											aria-hidden
+										/>
+									)}
 									<WorkspaceAvatar
 										repoIconSrc={repository.repoIconSrc}
 										repoInitials={repository.repoInitials}
@@ -637,7 +646,7 @@ export function WorkspaceStartPage({
 											<CommandEmpty>
 												<I18nText source="noRepositoriesFound" />
 											</CommandEmpty>
-											{repositories.slice(0, 9).map((repository, index) => {
+											{repositories.map((repository, index) => {
 												const repoName = extractRepoName(repository.remoteUrl);
 												return (
 													<CommandItem
@@ -646,9 +655,16 @@ export function WorkspaceStartPage({
 														onSelect={() => onSelectRepository(repository)}
 														className="gap-2"
 													>
-														<kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
-															{index + 1}
-														</kbd>
+														{index < 9 ? (
+															<kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
+																{index + 1}
+															</kbd>
+														) : (
+															<span
+																className="inline-flex h-5 w-5 shrink-0"
+																aria-hidden
+															/>
+														)}
 														<WorkspaceAvatar
 															repoIconSrc={repository.repoIconSrc}
 															repoInitials={repository.repoInitials}
```

---

### Incident Patch 6: `a1f97fc0` (2026-07-10)
**Commit Message**: fix(sidecar): keep draining after background tasks settle so the agent's continuation survives (#927)

#922 replayed the deferred `completed` (and closed the query) the instant
the pending background-task count hit zero. But the recorded CLI contract
(claude 2.1.205) is: after `task_notification` the CLI re-invokes the main
agent on the SAME query to synthesize the results and then emits a second,
genuinely terminal `completed`. Closing at drain time killed that
continuation — background tasks finished, but the summary never arrived.

Now the loop keeps draining after the drain: the continuation streams
through and its terminal result ends the turn. A continuation grace
(default 60s, HELMOR_CLAUDE_BG_CONTINUATION_GRACE_MS) falls back to
replaying the deferred `completed` when no continuation ever comes (the
task_updated-drip case #922 was written for), and the 20-minute drain
timeout remains the hard backstop.

Contract pinned by controlled experiments against the bundled binary;
tests rewritten to match the recorded event stream (one previously
asserted the continuation being dropped).

**File**: `.changeset/patient-drain-continues.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"helmor": patch
+---
+
+Fix Claude turns ending the moment background tasks finished, cutting off the agent's follow-up synthesis before it could report the results.
```

**File**: `sidecar/src/claude/background-resume.test.ts` (modified, +97/-24)
```diff
@@ -26,6 +26,8 @@ let hangAfterScenario = false;
 let queryCloseCount = 0;
 const releaseHangingQueries = new Set<() => void>();
 const previousBgDrainTimeout = process.env.HELMOR_CLAUDE_BG_DRAIN_TIMEOUT_MS;
+const previousContinuationGrace =
+	process.env.HELMOR_CLAUDE_BG_CONTINUATION_GRACE_MS;
 const LONG_BG_DRAIN_TIMEOUT_MS = "60000";
 
 function makeQuery(messages: SDKMessage[]) {
@@ -131,7 +133,10 @@ function assistant(text: string): SDKMessage {
 	} as unknown as SDKMessage;
 }
 
-function result(terminalReason: string): SDKMessage {
+function result(
+	terminalReason: string,
+	uuid = `r-${terminalReason}`,
+): SDKMessage {
 	return {
 		type: "result",
 		subtype: "success",
@@ -140,7 +145,7 @@ function result(terminalReason: string): SDKMessage {
 		usage: USAGE,
 		modelUsage: MODEL_USAGE,
 		session_id: "s1",
-		uuid: `r-${terminalReason}`,
+		uuid,
 	} as unknown as SDKMessage;
 }
 
@@ -210,6 +215,12 @@ afterEach(() => {
 	} else {
 		process.env.HELMOR_CLAUDE_BG_DRAIN_TIMEOUT_MS = previousBgDrainTimeout;
 	}
+	if (previousContinuationGrace === undefined) {
+		delete process.env.HELMOR_CLAUDE_BG_CONTINUATION_GRACE_MS;
+	} else {
+		process.env.HELMOR_CLAUDE_BG_CONTINUATION_GRACE_MS =
+			previousContinuationGrace;
+	}
 });
 
 async function expectSettles<T>(
@@ -300,14 +311,19 @@ describe("ClaudeSessionManager run_in_background drain (completed with pending b
 				(m as { terminal_reason?: string }).terminal_reason === "completed",
 		).length;
 
-	test("defers `completed` while a bg task is pending, replays it on task_notification, ends once", async () => {
+	// Recorded contract (claude 2.1.205, .agent-contexts/bg-drain-contract):
+	// after `task_notification` the CLI re-invokes the main agent on the SAME
+	// query (the continuation may even use tools) and then emits a SECOND,
+	// genuinely terminal `completed`. Replaying the deferred `completed` at
+	// notification time — the pre-fix behavior — killed that continuation.
+	test("keeps draining after task_notification: the continuation passes through and the SECOND completed ends the turn", async () => {
 		scenario = [
 			assistant("dispatching"),
 			taskStarted("bg1"),
-			result("completed"), // intermediate — bg1 still pending, must be deferred
-			taskNotification("bg1"), // bg1 settles
+			result("completed", "r-intermediate"), // bg1 still pending — deferred
+			taskNotification("bg1"), // bg1 settles; continuation follows
 			assistant("synthesizing"),
-			result("completed"), // genuinely terminal
+			result("completed", "r-final"), // genuinely terminal
 		];
 		const spy = makeSpyEmitter();
 		await new ClaudeSessionManager().sendMessage(
@@ -318,24 +334,52 @@ describe("ClaudeSessionManager run_in_background drain (completed with pending b
 
 		// One terminal end — the intermediate `completed` must not fire it.
 		expect(spy.ends).toBe(1);
-		// Only one `completed` reaches the pipeline (one result per turn).
+		// Only one `completed` reaches the pipeline (one result per turn) and it
+		// is the CONTINUATION's result, not the stale deferred one.
 		expect(completedResultCount(spy)).toBe(1);
-		// Notification flows through before the deferred terminal result is replayed.
-		const subtypes = spy.passthroughs.map(
-			(m) => (m as { subtype?: string }).subtype,
+		const completed = spy.passthroughs.find(
+			(m) => (m as { type?: string }).type === "result",
 		);
-		const notificationIndex = subtypes.findIndex(
-			(subtype) => subtype === "task_notification",
+		expect((completed as { uuid?: string }).uuid).toBe("r-final");
+		// The continuation (the synthesis the user actually asked for) survives.
+		const texts = spy.passthroughs
+			.filter((m) => (m as { type?: string }).type === "assistant")
+			.map(
+				(m) =>
+					(m as { message?: { content?: { text?: string }[] } }).message
+						?.content?.[0]?.text,
+			);
+		expect(texts).toContain("synthesizing");
+		// Usage recorded at the deferred pause and at the terminal result.
+		expect(spy.contextUsageUpdates).toBeGreaterThanOrEqual(2);
+	});
+
+	test("continuation that spawns ANOTHER bg task re-defers and ends on the final completed", async () => {
+		scenario = [
+			assistant("dispatching"),
+			taskStarted("bg1"),
+			result("completed", "r-c1"), // deferred (bg1 pending)
+			taskNotification("bg1"),
+			assistant("first continuation"),
+			taskStarted("bg2"), // continuation fans out again
+			result("completed", "r-c2"), // deferred (bg2 pending)
+			taskNotification("bg2"),
+			assistant("final synthesis"),
+			result("completed", "r-c3"), // genuinely terminal
+		];
+		const spy = makeSpyEmitter();
+		await new ClaudeSessionManager().sendMessage(
+			"req-bg-refan",
+			baseParams(),
+			spy.emitter,
 		);
-		const replayedCompletedIndex = spy.passthroughs.findIndex(
-			(m) =>
-				(m as { type?: string }).type === "result" &&
-				(m as { terminal_reason?: string }).terminal_reason === "completed",
+
+		expect(spy.ends).toBe(1);
+		expect(completedResultCo
```

**File**: `sidecar/src/claude/session-manager.ts` (modified, +97/-5)
```diff
@@ -76,6 +76,21 @@ const CONTEXT_USAGE_TIMEOUT_MS = 30_000;
 const BACKGROUND_TASK_DRAIN_TIMEOUT_MS = 20 * 60_000;
 const BACKGROUND_TASK_DRAIN_TIMEOUT_ENV = "HELMOR_CLAUDE_BG_DRAIN_TIMEOUT_MS";
 
+/**
+ * After the last pending background task settles, the CLI re-invokes the main
+ * agent on the SAME query to synthesize the results and then emits a second,
+ * genuinely terminal `completed` (contract recorded against claude 2.1.205:
+ * task_updated(patch.status) + task_notification arrive together, the
+ * continuation starts ~2s later and may use tools). We therefore keep draining
+ * after the pending count hits zero. This grace bounds the wait for the FIRST
+ * sign of that continuation — if nothing but system events arrives (e.g. a
+ * task killed with no notification), we fall back to replaying the deferred
+ * `completed` instead of hanging until the 20-minute drain timeout.
+ */
+const BACKGROUND_TASK_CONTINUATION_GRACE_MS = 60_000;
+const BACKGROUND_TASK_CONTINUATION_GRACE_ENV =
+	"HELMOR_CLAUDE_BG_CONTINUATION_GRACE_MS";
+
 /**
  * Resolve the Claude Code native binary for `pathToClaudeCodeExecutable`.
  * Prefers `HELMOR_CLAUDE_CODE_BIN_PATH` (release), then the platform
@@ -714,13 +729,20 @@ export class ClaudeSessionManager implements SessionManager {
 		const pendingBgTasks = new Map<string, PendingBgTask>();
 		let bgDrainTimer: ReturnType<typeof setTimeout> | null = null;
 		let bgDrainTimedOut = false;
+		let continuationGraceTimer: ReturnType<typeof setTimeout> | null = null;
+		let bgDrainSettledByGrace = false;
 		let deferredCompletedResult: SDKMessage | null = null;
 		let turnEnded = false;
 		const clearBgDrainTimer = () => {
 			if (bgDrainTimer === null) return;
 			clearTimeout(bgDrainTimer);
 			bgDrainTimer = null;
 		};
+		const clearContinuationGraceTimer = () => {
+			if (continuationGraceTimer === null) return;
+			clearTimeout(continuationGraceTimer);
+			continuationGraceTimer = null;
+		};
 		const endTurnOnce = () => {
 			if (turnEnded) return false;
 			turnEnded = true;
@@ -731,6 +753,7 @@ export class ClaudeSessionManager implements SessionManager {
 			if (turnEnded) return false;
 			deferredCompletedResult = null;
 			clearBgDrainTimer();
+			clearContinuationGraceTimer();
 			emitter.passthrough(requestId, terminalResult);
 			const meta = buildClaudeStoredMeta(terminalResult, model ?? "");
 			if (meta) {
@@ -744,6 +767,42 @@ export class ClaudeSessionManager implements SessionManager {
 			const terminalResult = deferredCompletedResult;
 			return passthroughTerminalResult(terminalResult);
 		};
+		// Armed when the pending count hits zero while a `completed` is deferred.
+		// The expected next step is the CLI re-invoking the main agent (assistant/
+		// user/stream messages, then a second terminal result) — any such message
+		// cancels this timer. If only system events trickle in (a task settled
+		// with no follow-up continuation), fire the fallback: replay the deferred
+		// `completed` and close, instead of hanging until the 20-min drain timeout.
+		const armContinuationGraceTimer = () => {
+			if (continuationGraceTimer !== null || turnEnded) return;
+			if (!deferredCompletedResult || pendingBgTasks.size > 0) return;
+			const graceMs = backgroundTaskContinuationGraceMs();
+			logger.info(
+				`[${requestId}] background tasks drained; awaiting agent continuation`,
+				{ graceMs },
+			);
+			continuationGraceTimer = setTimeout(() => {
+				continuationGraceTimer = null;
+				if (turnEnded || pendingBgTasks.size > 0) return;
+				if (this.turns.isAbortRequested(sessionId)) return;
+				logger.error(
+					`[${requestId}] no agent continuation after background drain; replaying deferred completed`,
+					{ graceMs },
+				);
+				bgDrainSettledByGrace = true;
+				passthroughDeferredCompletedIfReady();
+				try {
+					q.close();
+				} catch (closeErr) {
+					logger.error("Claude continuation grace q.close() failed", {
+						requestId,
+						sessionId,
+						...errorDetails(closeErr),
+					});
+				}
+			}, graceMs);
+			(continuationGraceTimer as { unref?: () => void }).unref?.();
+		};
 		const summarizePendingBgTasks = () =>
 			Array.from(pendingBgTasks.values())
 				.slice(0, 12)
@@ -801,6 +860,10 @@ export class ClaudeSessionManager implements SessionManager {
 				// `result`. Drop them and return: passing them through or emitting
 				// `end` here would violate the "exactly one terminal event" contract.
 				if (this.turns.isAbortRequested(sessionId)) return;
+				// The continuation-grace fallback can end the turn from its timer
+				// while the iterator still has buffered messages — drop them, the
+				// terminal event has already been emitted.
+				if (turnEnded) return;
 				logger.sdkEvent(requestId, message);
 				if (message.type === "rate_limit_event") {
 					lastRateLimitInfo = (
@@ -857,6 +920,7 @@ export class ClaudeSessionManager implements SessionManager {
 					const toolUseId = (message as { tool_use_id?: string }).t
```

---

### Incident Patch 7: `bd5857f7` (2026-07-10)
**Commit Message**: fix(sidecar): bundle codex-code-mode-host companion binary (#926)

codex 0.144 added a codex-code-mode-host binary alongside the main
codex binary in the npm package's bin/ dir. codex spawns it as a
sibling at runtime for code-mode tool execution, but the descriptor
only advertises the entrypoint, so stage-vendor omitted it and every
code-mode tool call failed with ENOENT. Stage the companion next to
the flattened codex binary when present.

**File**: `.changeset/stage-codex-code-mode-host.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"helmor": patch
+---
+
+Fix Codex tool calls failing after the 0.144 upgrade by bundling the new `codex-code-mode-host` companion binary that Codex spawns for code-mode execution.
```

**File**: `sidecar/scripts/stage-vendor.ts` (modified, +14/-0)
```diff
@@ -497,6 +497,20 @@ function stageCodexFromVendorRoot(archRoot: string): void {
 	chmodSync(binDest, 0o755);
 	maybeSignMacBinary(binDest, false);
 
+	// codex >= 0.144 ships a `codex-code-mode-host` companion next to the main
+	// binary in `bin/`. The descriptor does not advertise it (only `entrypoint`),
+	// but codex spawns it as a sibling of itself at runtime for "code mode" tool
+	// execution — omit it and every code-mode tool call fails with ENOENT. Copy
+	// it next to the flattened codex binary when present (guarded for older
+	// layouts / platforms that don't ship it).
+	const hostSrc = join(dirname(binSrc), `codex-code-mode-host${EXE}`);
+	if (existsSync(hostSrc)) {
+		const hostDest = join(DIST_VENDOR, "codex", `codex-code-mode-host${EXE}`);
+		copyFile(hostSrc, hostDest);
+		chmodSync(hostDest, 0o755);
+		maybeSignMacBinary(hostDest, false);
+	}
+
 	const pathSrc = join(archRoot, pathDir);
 	if (existsSync(pathSrc)) {
 		const pathDest = join(DIST_VENDOR, "codex", "path");
```

---

### Incident Patch 8: `5d93835e` (2026-07-09)
**Commit Message**: fix(sidecar): end Claude turn once pending background tasks drain (#922)

* fix(sidecar): end Claude turn once pending background tasks drain

Previously, when a Claude turn's completed result arrived while background
tasks were still pending, the result was swallowed and the session never
closed — task_updated events kept dripping in indefinitely after all
tasks finished.

Now the swallowed completed result is replayed as soon as the pending
task count reaches zero, and turnEnded is idempotent so the turn closes
exactly once.

* chore: add changeset

**File**: `.changeset/calm-turns-close.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"helmor": patch
+---
+
+Fix Claude sessions never finishing their turn after background tasks completed, leaving the conversation stuck streaming indefinitely.
```

**File**: `sidecar/src/claude/background-resume.test.ts` (modified, +154/-14)
```diff
@@ -23,7 +23,10 @@ import type { SendMessageParams } from "../session-manager.js";
 // outer variable so each test can swap the SDK message stream.
 let scenario: SDKMessage[] = [];
 let hangAfterScenario = false;
+let queryCloseCount = 0;
+const releaseHangingQueries = new Set<() => void>();
 const previousBgDrainTimeout = process.env.HELMOR_CLAUDE_BG_DRAIN_TIMEOUT_MS;
+const LONG_BG_DRAIN_TIMEOUT_MS = "60000";
 
 function makeQuery(messages: SDKMessage[]) {
 	let closed = false;
@@ -47,14 +50,21 @@ function makeQuery(messages: SDKMessage[]) {
 				const heartbeat = setInterval(() => {}, 1000);
 				try {
 					await new Promise<void>((resolve) => {
-						releaseHang = resolve;
+						const release = () => {
+							releaseHangingQueries.delete(release);
+							resolve();
+						};
+						releaseHang = release;
+						releaseHangingQueries.add(release);
 					});
 				} finally {
 					clearInterval(heartbeat);
+					if (releaseHang) releaseHangingQueries.delete(releaseHang);
 				}
 			}
 		},
 		close() {
+			queryCloseCount += 1;
 			closed = true;
 			releaseHang?.();
 		},
@@ -159,6 +169,17 @@ function taskStarted(taskId = "t1"): SDKMessage {
 	} as unknown as SDKMessage;
 }
 
+function taskUpdated(taskId = "t1", status = "completed"): SDKMessage {
+	return {
+		type: "system",
+		subtype: "task_updated",
+		task_id: taskId,
+		patch: { status },
+		session_id: "s1",
+		uuid: `tu-${taskId}-${status}`,
+	} as unknown as SDKMessage;
+}
+
 function baseParams(): SendMessageParams {
 	return {
 		sessionId: "s1",
@@ -179,15 +200,38 @@ beforeAll(async () => {
 });
 
 afterEach(() => {
+	for (const release of releaseHangingQueries) release();
+	releaseHangingQueries.clear();
 	scenario = [];
 	hangAfterScenario = false;
+	queryCloseCount = 0;
 	if (previousBgDrainTimeout === undefined) {
 		delete process.env.HELMOR_CLAUDE_BG_DRAIN_TIMEOUT_MS;
 	} else {
 		process.env.HELMOR_CLAUDE_BG_DRAIN_TIMEOUT_MS = previousBgDrainTimeout;
 	}
 });
 
+async function expectSettles<T>(
+	promise: Promise<T>,
+	label: string,
+): Promise<T> {
+	let timeout: ReturnType<typeof setTimeout> | undefined;
+	try {
+		return await Promise.race([
+			promise,
+			new Promise<never>((_resolve, reject) => {
+				timeout = setTimeout(
+					() => reject(new Error(`${label} timed out`)),
+					500,
+				);
+			}),
+		]);
+	} finally {
+		if (timeout) clearTimeout(timeout);
+	}
+}
+
 describe("ClaudeSessionManager backgrounded-task resume (#891)", () => {
 	test("filters the pause result, resumes, and ends exactly once", async () => {
 		scenario = [
@@ -256,7 +300,7 @@ describe("ClaudeSessionManager run_in_background drain (completed with pending b
 				(m as { terminal_reason?: string }).terminal_reason === "completed",
 		).length;
 
-	test("defers `completed` while a bg task is pending, resumes on task_notification, ends once", async () => {
+	test("defers `completed` while a bg task is pending, replays it on task_notification, ends once", async () => {
 		scenario = [
 			assistant("dispatching"),
 			taskStarted("bg1"),
@@ -274,22 +318,23 @@ describe("ClaudeSessionManager run_in_background drain (completed with pending b
 
 		// One terminal end — the intermediate `completed` must not fire it.
 		expect(spy.ends).toBe(1);
-		// Only the FINAL `completed` reaches the pipeline (one result per turn).
+		// Only one `completed` reaches the pipeline (one result per turn).
 		expect(completedResultCount(spy)).toBe(1);
-		// Continuation flows through: notification + the post-resume assistant.
+		// Notification flows through before the deferred terminal result is replayed.
 		const subtypes = spy.passthroughs.map(
 			(m) => (m as { subtype?: string }).subtype,
 		);
-		expect(subtypes).toContain("task_notification");
-		const assistantTexts = spy.passthroughs
-			.filter((m) => (m as { type?: string }).type === "assistant")
-			.map(
-				(m) =>
-					(m as { message?: { content?: { text?: string }[] } }).message
-						?.content?.[0]?.text,
-			);
-		expect(assistantTexts).toContain("synthesizing");
-		// Usage recorded at the deferred pause AND the terminal result.
+		const notificationIndex = subtypes.findIndex(
+			(subtype) => subtype === "task_notification",
+		);
+		const replayedCompletedIndex = spy.passthroughs.findIndex(
+			(m) =>
+				(m as { type?: string }).type === "result" &&
+				(m as { terminal_reason?: string }).terminal_reason === "completed",
+		);
+		expect(notificationIndex).toBeGreaterThanOrEqual(0);
+		expect(replayedCompletedIndex).toBe(notificationIndex + 1);
+		// Usage recorded at the deferred pause and when replayed as terminal.
 		expect(spy.contextUsageUpdates).toBeGreaterThanOrEqual(2);
 	});
 
@@ -378,4 +423,99 @@ describe("ClaudeSessionManager run_in_background drain (completed with pending b
 			.filter(Boolean);
 		expect(reasons).toContain("max_turns"); // passed through, not deferred
 	});
+
+	test("deferred completed closes immediately when task_notification drains the last pending task even 
```

**File**: `sidecar/src/claude/session-manager.ts` (modified, +35/-19)
```diff
@@ -714,11 +714,36 @@ export class ClaudeSessionManager implements SessionManager {
 		const pendingBgTasks = new Map<string, PendingBgTask>();
 		let bgDrainTimer: ReturnType<typeof setTimeout> | null = null;
 		let bgDrainTimedOut = false;
+		let deferredCompletedResult: SDKMessage | null = null;
+		let turnEnded = false;
 		const clearBgDrainTimer = () => {
 			if (bgDrainTimer === null) return;
 			clearTimeout(bgDrainTimer);
 			bgDrainTimer = null;
 		};
+		const endTurnOnce = () => {
+			if (turnEnded) return false;
+			turnEnded = true;
+			emitter.end(requestId);
+			return true;
+		};
+		const passthroughTerminalResult = (terminalResult: SDKMessage) => {
+			if (turnEnded) return false;
+			deferredCompletedResult = null;
+			clearBgDrainTimer();
+			emitter.passthrough(requestId, terminalResult);
+			const meta = buildClaudeStoredMeta(terminalResult, model ?? "");
+			if (meta) {
+				emitter.contextUsageUpdated(requestId, sessionId, JSON.stringify(meta));
+			}
+			endTurnOnce();
+			return true;
+		};
+		const passthroughDeferredCompletedIfReady = () => {
+			if (!deferredCompletedResult || pendingBgTasks.size > 0) return false;
+			const terminalResult = deferredCompletedResult;
+			return passthroughTerminalResult(terminalResult);
+		};
 		const summarizePendingBgTasks = () =>
 			Array.from(pendingBgTasks.values())
 				.slice(0, 12)
@@ -841,12 +866,12 @@ export class ClaudeSessionManager implements SessionManager {
 							});
 						} else if (subtype === "task_notification") {
 							pendingBgTasks.delete(taskId);
-							if (pendingBgTasks.size === 0) clearBgDrainTimer();
 						} else if (subtype === "task_updated") {
 							const pending = pendingBgTasks.get(taskId);
 							const status = terminalTaskUpdateStatus(message);
 							if (pending && status) {
 								pending.terminalStatus = status;
+								pendingBgTasks.delete(taskId);
 							}
 						}
 					} else if (subtype === "task_notification" && toolUseId) {
@@ -856,7 +881,6 @@ export class ClaudeSessionManager implements SessionManager {
 								break;
 							}
 						}
-						if (pendingBgTasks.size === 0) clearBgDrainTimer();
 					}
 				}
 				// A `completed` result while background tasks are still pending is
@@ -867,6 +891,7 @@ export class ClaudeSessionManager implements SessionManager {
 				// The final `completed` (pending drained) and any error terminal
 				// fall through to the terminal branch below.
 				if (isCompletedResult(message) && pendingBgTasks.size > 0) {
+					deferredCompletedResult = message;
 					ensureBgDrainTimer();
 					const meta = buildClaudeStoredMeta(message, model ?? "");
 					if (meta) {
@@ -878,33 +903,23 @@ export class ClaudeSessionManager implements SessionManager {
 					}
 					continue;
 				}
+				if (isTerminalResult(message)) {
+					passthroughTerminalResult(message);
+					return;
+				}
 				// AskUserQuestion tool_use blocks pass through INTACT — the Rust
 				// adapter renders them as the persistent Q&A card (and merges
 				// the tool_result answers into it), so stripping them here
 				// would lose the card on finalize/persist/reload.
 				emitter.passthrough(requestId, message);
-				if (isTerminalResult(message)) {
-					// Terminal result (success OR error) — both shapes carry
-					// `usage`/`modelUsage`, so both should update the ring.
-					// Bail on the first one we see; any steer() still in its
-					// image-load await will find `promptSource.closed` via
-					// the finally block below and return false.
-					const meta = buildClaudeStoredMeta(message, model ?? "");
-					if (meta) {
-						emitter.contextUsageUpdated(
-							requestId,
-							sessionId,
-							JSON.stringify(meta),
-						);
-					}
-					emitter.end(requestId);
+				if (passthroughDeferredCompletedIfReady()) {
 					return;
 				}
 			}
-			if (!this.turns.isAbortRequested(sessionId)) emitter.end(requestId);
+			if (!this.turns.isAbortRequested(sessionId)) endTurnOnce();
 		} catch (err) {
 			if (bgDrainTimedOut) {
-				if (!this.turns.isAbortRequested(sessionId)) emitter.end(requestId);
+				if (!this.turns.isAbortRequested(sessionId)) endTurnOnce();
 				return;
 			}
 			if (isAbortError(err)) {
@@ -1497,6 +1512,7 @@ function isTerminalTaskStatus(status: string): boolean {
 		status === "completed" ||
 		status === "failed" ||
 		status === "cancelled" ||
+		status === "killed" ||
 		status === "canceled" ||
 		status === "errored"
 	);
```

---

### Incident Patch 9: `863a12c7` (2026-07-04)
**Commit Message**: [codex] Add Helmor debug skills (#920)

docs: add Helmor debug skills

**File**: `.agents/skills/helmor-debug-loop/SKILL.md` (added, +38/-0)
```diff
@@ -0,0 +1,38 @@
+---
+name: helmor-debug-loop
+description: Autonomous local-development debugging loop for Helmor bugs. Use when the user asks an agent to reproduce, diagnose, instrument, fix, or verify a Helmor local dev build issue using repeated local UI simulation, temporary logging, Tauri MCP/towery MCP, screenshots, DOM/accessibility snapshots, IPC traces, console/system logs, terminal/run-script logs, or multi-attempt verification. This skill coordinates with $helmor-debug-operate for operating the running desktop app.
+---
+
+# Helmor Debug Loop
+
+Use this skill to drive a bounded reproduce -> instrument -> inspect -> fix -> verify loop for Helmor local-dev bugs. Always use `$helmor-debug-operate` for actual local app control through Tauri MCP; this skill owns the debugging strategy and evidence discipline.
+
+## Core Loop
+
+1. Define the suspected behavior, expected behavior, and success signal in one or two sentences.
+2. Reproduce through `$helmor-debug-operate` with real UI actions when possible. Start with screenshots, DOM/accessibility snapshots, IPC monitor, console/system logs, and terminal buffers.
+3. If evidence is insufficient, add the smallest temporary log or probe with a unique prefix such as `[debug-loop:<slug>]`, rerun the flow, then remove or justify the probe before finalizing.
+4. Analyze the evidence before editing product code. Prefer a narrow fix that explains the observed signal.
+5. Verify the fix with the same user path. For user-visible flows, require three consecutive successful runs unless the user explicitly lowers the bar.
+6. Produce an evidence pack under `.agent-contexts/<task-slug>/` with repro attempts, logs, screenshots, IPC, fix summary, and remaining uncertainty.
+
+## Fault Tolerance
+
+- If you cannot reproduce after three distinct attempts, do not invent a failure. Mark the state as `not reproduced`, preserve evidence, inspect code paths that should have fired, and report the most likely missing precondition.
+- If the bug is flaky, run at least three attempts and compare evidence. Treat intermittent pass/fail as a valid finding, not a failure of the loop.
+- If Tauri MCP cannot connect, use `$helmor-debug-operate` recovery steps. If the bridge remains unavailable, fall back to static code analysis and terminal tests, and label UI verification as blocked.
+- If a skill recipe fails three times, follow `$helmor-debug-operate` stale-skill rules: reason from fresh screenshots/DOM/code, record a candidate skill update, and ask before editing that skill unless the user explicitly requested it.
+- If adding logs risks exposing secrets, log shape/count/state only. Never print access tokens, credentials, API keys, cookies, or private account details.
+- If verification cannot be run safely because it would mutate durable user data, switch to a disposable workspace/session or stop and state the risk.
+
+## Evidence Sources
+
+Use the available signals in this order:
+
+- Terminal buffers: use `$helmor-debug-operate`'s **Call App Commands** helper to run `debug_list_terminal_buffers`, then `debug_read_terminal_buffer` with the returned raw `scriptType`.
+- UI state: screenshot plus accessibility or structure snapshot.
+- IPC: start monitor, perform one action, capture filtered commands/events, then stop monitor.
+- Logs: Tauri console/system logs, sidecar JSONL logs under the dev data dir when relevant.
+- Code probes: temporary logs with unique prefixes, guarded by debug context when possible.
+
+Read `references/debug-loop.md` when the task needs the full loop checklist or when reproduction fails. Use scripts in `scripts/` to summarize logs and build evidence packs instead of pasting raw dumps into the chat.
```

**File**: `.agents/skills/helmor-debug-loop/agents/openai.yaml` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+interface:
+  display_name: "Helmor Debug Loop"
+  short_description: "Autonomous Helmor local-dev bug loop."
+  default_prompt: "Use $helmor-debug-loop to reproduce, instrument, inspect, fix, and verify a Helmor local-dev bug."
```

**File**: `.agents/skills/helmor-debug-loop/references/debug-loop.md` (added, +95/-0)
```diff
@@ -0,0 +1,95 @@
+# Helmor Debug Loop Reference
+
+Use this reference after loading `SKILL.md` when a bug needs iterative local verification.
+
+## Attempt Structure
+
+Each attempt should record:
+
+- Attempt number and timestamp.
+- Preconditions: workspace, session, selected model/mode, run action, feature flags, relevant settings.
+- Exact user path driven through `$helmor-debug-operate`.
+- Evidence collected: screenshot path, DOM/snapshot file, IPC capture, console/system logs, terminal buffer ids, and code probes.
+- Result: `reproduced`, `not reproduced`, `flaky`, `fixed`, `blocked`, or `inconclusive`.
+
+Store attempt notes under `.agent-contexts/<task-slug>/attempts.md`.
+
+## Terminal Buffer Commands
+
+When the app has a debug build with the terminal buffer commands registered, use `$helmor-debug-operate`'s **Call App Commands** helper. Do not call the Tauri MCP `ipc_execute_command` tool for these app commands; the current bridge returns `Unsupported Tauri command`.
+
+```json
+{ "id": "list-buffers", "command": "debug_list_terminal_buffers", "payload": {} }
+```
+
+Pick the relevant item from the returned `repoId`, `workspaceId`, and `scriptType`, then read the tail:
+
+```json
+{
+  "id": "read-buffer",
+  "command": "debug_read_terminal_buffer",
+  "payload": {
+    "repoId": "REPO_ID",
+    "workspaceId": "WORKSPACE_ID_OR_NULL",
+    "scriptType": "RAW_SCRIPT_TYPE_FROM_LIST",
+    "maxBytes": 200000
+  }
+}
+```
+
+If the helper result says the command is unavailable, fall back to visible xterm screenshots/DOM and mark terminal-buffer evidence as unavailable. Do not block the whole loop on this one signal.
+
+## Reproduction Branches
+
+### Reproduced
+
+1. Freeze the smallest path that reproduces the bug.
+2. Add temporary probes only where the next unknown remains.
+3. Fix the code.
+4. Repeat the same path three times.
+
+### Not Reproduced
+
+After three distinct attempts:
+
+1. Record every precondition and attempt.
+2. Inspect the code path that should have handled the user flow.
+3. Identify missing preconditions, likely stale recipe, or environment drift.
+4. If a low-risk static fix is obvious, make it and verify with available tests; otherwise report `not reproduced` with next recommended probe.
+
+### Flaky
+
+Treat flaky behavior as a valid bug. Preserve a run table with pass/fail state and compare:
+
+- Logs immediately before divergence.
+- DOM state before the click/keypress.
+- IPC event ordering.
+- Terminal/run-script timing.
+
+Fix the race or state leak only after the divergence has a plausible mechanism.
+
+### Blocked
+
+Use `blocked` only when the loop cannot progress without user input or an external state change, such as missing credentials, no running debug build, destructive verification risk, or unavailable Tauri bridge after recovery attempts.
+
+## Temporary Logging Rules
+
+- Use a unique prefix: `[debug-loop:<short-slug>]`.
+- Log the smallest state needed: ids, booleans, counts, branch names, command names, elapsed times.
+- Avoid secrets and large objects.
+- Prefer existing structured logging in Rust/backend and `console.debug` in frontend only when it is removed before final.
+- Remove temporary logs before final unless they become intentional product diagnostics.
+
+## Evidence Pack Checklist
+
+Create `.agent-contexts/<task-slug>/evidence.md` with:
+
+- User request and expected behavior.
+- Reproduction attempts table.
+- Evidence links and summaries.
+- Root cause.
+- Fix summary.
+- Verification table with three pass rows or a clear exception.
+- Residual risk and unverified paths.
+
+Use `scripts/terminal_log_summary.py` for terminal text and `scripts/build_evidence_pack.py` to assemble a markdown pack.
```

**File**: `.agents/skills/helmor-debug-loop/scripts/build_evidence_pack.py` (added, +85/-0)
```diff
@@ -0,0 +1,85 @@
+#!/usr/bin/env python3
+"""Build a compact markdown evidence pack from local debugging artifacts."""
+
+from __future__ import annotations
+
+import argparse
+from pathlib import Path
+
+
+TEXT_EXTENSIONS = {
+    ".txt",
+    ".log",
+    ".json",
+    ".jsonl",
+    ".md",
+    ".html",
+    ".xml",
+    ".yaml",
+    ".yml",
+}
+
+
+def tail_text(path: Path, max_lines: int) -> str:
+    text = path.read_text(errors="replace")
+    lines = text.splitlines()
+    return "\n".join(lines[-max_lines:])
+
+
+def parse_artifact(value: str) -> tuple[str, Path]:
+    if "=" not in value:
+        path = Path(value)
+        return (path.stem or "artifact", path)
+    label, raw_path = value.split("=", 1)
+    return (label.strip() or "artifact", Path(raw_path))
+
+
+def render_artifact(label: str, path: Path, max_lines: int) -> str:
+    exists = path.exists()
+    out = [f"## {label}", "", f"- Path: `{path}`", f"- Exists: `{str(exists).lower()}`"]
+    if not exists:
+        return "\n".join(out) + "\n"
+
+    if path.suffix.lower() in TEXT_EXTENSIONS:
+        out.extend(["", "```text", tail_text(path, max_lines), "```"])
+    else:
+        out.extend(["", f"![{label}]({path})"])
+    return "\n".join(out) + "\n"
+
+
+def main() -> int:
+    parser = argparse.ArgumentParser(description=__doc__)
+    parser.add_argument("--out", required=True, help="Markdown output path.")
+    parser.add_argument("--title", default="Helmor Debug Evidence")
+    parser.add_argument("--status", default="inconclusive")
+    parser.add_argument("--summary", default="")
+    parser.add_argument(
+        "--artifact",
+        action="append",
+        default=[],
+        help="Artifact as label=path, repeatable. Text files are tailed; images are linked.",
+    )
+    parser.add_argument("--max-lines", type=int, default=200)
+    args = parser.parse_args()
+
+    parts = [
+        f"# {args.title}",
+        "",
+        f"- Status: `{args.status}`",
+    ]
+    if args.summary:
+        parts.extend(["", args.summary])
+
+    for value in args.artifact:
+        label, path = parse_artifact(value)
+        parts.extend(["", render_artifact(label, path, max(0, args.max_lines)).rstrip()])
+
+    out_path = Path(args.out)
+    out_path.parent.mkdir(parents=True, exist_ok=True)
+    out_path.write_text("\n".join(parts).rstrip() + "\n")
+    print(out_path)
+    return 0
+
+
+if __name__ == "__main__":
+    raise SystemExit(main())
```

**File**: `.agents/skills/helmor-debug-loop/scripts/terminal_log_summary.py` (added, +110/-0)
```diff
@@ -0,0 +1,110 @@
+#!/usr/bin/env python3
+"""Summarize Helmor terminal/run-script logs for debugging evidence."""
+
+from __future__ import annotations
+
+import argparse
+import json
+import re
+import sys
+from pathlib import Path
+
+ANSI_RE = re.compile(r"\x1b(?:\[[0-9;?=<>]*[ -/]*[@-~]|\][^\x07]*(?:\x07|\x1b\\)|[@-Z\\-_])")
+URL_RE = re.compile(r"https?://(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|::1|[^\s'\"<>]+)[^\s'\"<>]*")
+ERROR_RE = re.compile(
+    r"\b(error|exception|panic|failed|failure|traceback|unhandled|cannot|could not|enoent|eaddrinuse)\b",
+    re.IGNORECASE,
+)
+WARNING_RE = re.compile(r"\b(warn|warning|deprecated)\b", re.IGNORECASE)
+
+
+def read_text(path: str | None) -> str:
+    if path:
+        return Path(path).read_text(errors="replace")
+    return sys.stdin.read()
+
+
+def strip_ansi(text: str) -> str:
+    return ANSI_RE.sub("", text)
+
+
+def unique(values: list[str]) -> list[str]:
+    seen: set[str] = set()
+    out: list[str] = []
+    for value in values:
+        if value in seen:
+            continue
+        seen.add(value)
+        out.append(value)
+    return out
+
+
+def summarize(text: str, tail_lines: int) -> dict[str, object]:
+    clean = strip_ansi(text).replace("\r\n", "\n").replace("\r", "\n")
+    lines = clean.splitlines()
+    error_lines = [line for line in lines if ERROR_RE.search(line)]
+    warning_lines = [line for line in lines if WARNING_RE.search(line)]
+    urls = unique(URL_RE.findall(clean))
+    return {
+        "bytes": len(text.encode()),
+        "cleanBytes": len(clean.encode()),
+        "lineCount": len(lines),
+        "urls": urls[:20],
+        "errorCount": len(error_lines),
+        "warningCount": len(warning_lines),
+        "errors": error_lines[-20:],
+        "warnings": warning_lines[-20:],
+        "tail": lines[-tail_lines:],
+    }
+
+
+def print_markdown(summary: dict[str, object]) -> None:
+    print("# Terminal Log Summary\n")
+    print(f"- Bytes: {summary['bytes']}")
+    print(f"- Clean bytes: {summary['cleanBytes']}")
+    print(f"- Lines: {summary['lineCount']}")
+    print(f"- Errors: {summary['errorCount']}")
+    print(f"- Warnings: {summary['warningCount']}")
+
+    urls = summary["urls"]
+    if urls:
+        print("\n## URLs")
+        for url in urls:
+            print(f"- `{url}`")
+
+    errors = summary["errors"]
+    if errors:
+        print("\n## Recent Error Lines")
+        for line in errors:
+            print(f"- `{line[:500]}`")
+
+    warnings = summary["warnings"]
+    if warnings:
+        print("\n## Recent Warning Lines")
+        for line in warnings:
+            print(f"- `{line[:500]}`")
+
+    print("\n## Tail")
+    print("```text")
+    for line in summary["tail"]:
+        print(line)
+    print("```")
+
+
+def main() -> int:
+    parser = argparse.ArgumentParser(description=__doc__)
+    parser.add_argument("path", nargs="?", help="Log file path. Reads stdin when omitted.")
+    parser.add_argument("--tail-lines", type=int, default=120)
+    parser.add_argument("--json", action="store_true", help="Emit JSON instead of markdown.")
+    args = parser.parse_args()
+
+    summary = summarize(read_text(args.path), max(0, args.tail_lines))
+    if args.json:
+        print(json.dumps(summary, ensure_ascii=False, indent=2))
+    else:
+        print_markdown(summary)
+    return 0
+
+
+if __name__ == "__main__":
+    raise SystemExit(main())
```

**File**: `.agents/skills/helmor-debug-operate/SKILL.md` (added, +484/-0)
```diff
@@ -0,0 +1,484 @@
+---
+name: helmor-debug-operate
+description: Operate, reproduce, and debug a running local Helmor desktop development build through the Tauri MCP bridge. Use when the user asks to use Tauri MCP, towery MCP, the local dev build, the Tauri webview, visual end-to-end validation, UI automation, screenshots, DOM/accessibility snapshots, IPC or log tracing, terminal/run-script buffer inspection, switching workspaces or sessions, creating/renaming/closing sessions, typing or sending composer prompts, inspecting styles/logs, or reproducing Helmor desktop behavior as a user would.
+---
+
+# Helmor Debug Operate
+
+Use this skill to operate and debug a running Helmor dev build through Tauri MCP with the least possible exploration. It is the visual/runtime counterpart to `helmor-cli`: prefer Tauri MCP for webview UI, screenshots, CSS, accessibility, and IPC tracing; prefer `helmor-cli` for terminal-first data inspection or workspace orchestration.
+
+Examples below use bare tool names such as `driver_session`; call the same tool through whatever namespace the runtime exposes.
+
+## References
+
+Read these only when needed:
+
+- `references/verified-recipes.md` for action-specific recipes that have passed three consecutive Tauri MCP verification attempts.
+- `references/ui-map.md` for selectors, Settings panels, Inspector/Editor preconditions, and destructive-action boundaries.
+
+## Ground Rules
+
+- Treat every action as real user input against the active app. Do not send prompts, close sessions, archive/delete workspaces, stop streams, or mutate settings unless the user asked for that outcome or it is necessary for the verification.
+- Use the Tauri MCP bridge only for Helmor desktop debugging. Do not switch to Chrome DevTools, Browser, Playwright, or `/agent-browser` unless the user explicitly asks for another surface.
+- Require a debug Tauri build. The bridge is absent in release builds. If connection fails, ask the user to run `bun run dev` or call `get_setup_instructions` only when bridge setup itself is suspect.
+- Default to `port: 9223` and `windowId: "main"`.
+- Re-run `webview_dom_snapshot` after every meaningful UI change. `ref=eN` handles are per-snapshot and expire after DOM changes.
+- Prefer accessibility snapshots for finding controls, but fall back to structure snapshots and read-only DOM rect inspection when accessibility support is unavailable.
+- Prefer UI operations for end-to-end validation. Do not use the Tauri MCP tool `ipc_execute_command` for Helmor app commands such as `list_workspace_groups`, `reveal_workspace_in_main_window`, or `debug_list_terminal_buffers`: the current bridge returns `Unsupported Tauri command` because dynamic app-command execution is not implemented there. Use the verified app-command helper in **Call App Commands** instead.
+- Do not use `webview_execute_js` to dispatch synthetic user events. Use it only for read-only, JSON-serializable inspection when MCP tools cannot answer the question.
+- Exception: Helmor's composer is a Lexical `contenteditable`, not a native input. If `webview_keyboard type` fails with the current bridge, `document.execCommand("insertText", false, text)` after real MCP focus/click is the last-resort smoke-test input path. Label it as a fallback and verify visible state afterward.
+- If you start `ipc_monitor`, always stop it before finishing, even if the task fails.
+- Save screenshots or scratch logs under `.agent-contexts/<task-slug>/` when working inside this repository.
+- If a Settings dialog appears stuck visible with `data-state="closed"`, press `Cmd+,` to reopen it, then `Escape` to close. Verify `document.querySelectorAll('[role="dialog"]').length === 0` and `main[aria-hidden]` is absent.
+- If `webview_execute_js` or console log reads start timing out while screenshots and `driver_session status` still work, restart only the MCP driver session (`driver_session stop appIdentifier=9223`, then `driver_session start port=9223`). Do not restart the Helmor dev build unless the bridge cannot reconnect.
+- If you launch a disposable app with `HELMOR_DATA_DIR` for validation, create both the data dir and its `run/` subdir first. Missing `run/` can make the UI sync socket fail to bind, leaving backend mutations invisible until you force a reveal or restart.
+- Treat this skill as an operation hint, not an authoritative source of truth. The local UI can drift ahead of these recipes. If a recipe fails three times, stop repeating it mechanically: take a fresh screenshot/snapshot, reason from the visible UI, and inspect the relevant code if needed.
+- Keep this skill self-improving by proposal, not silent mutation. When you discover a better path, missing pitfall, stale selector, or unverified workaround, record a candidate update under `.agent-contexts/<task-slug>/skill-update-candidates.md` with the scenario, failing attempts, evidence, proposed recipe, and verification status. Ask the user before editing this skill unless t
```

**File**: `.agents/skills/helmor-debug-operate/agents/openai.yaml` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+interface:
+  display_name: "Helmor Debug Operations"
+  short_description: "Operate and debug Helmor dev builds through Tauri MCP."
+  default_prompt: "Use $helmor-debug-operate to operate the local Helmor dev build through Tauri MCP and verify the UI flow."
```

**File**: `.agents/skills/helmor-debug-operate/references/ui-map.md` (added, +263/-0)
```diff
@@ -0,0 +1,263 @@
+# Helmor UI Map For Tauri MCP
+
+Use this map to decide which recipe or selector to use. It is not a substitute for live verification; always re-snapshot or inspect DOM state after each action.
+
+## Shell
+
+- Application shell: `[aria-label="Application shell"]`
+- Workspace sidebar: `[aria-label="Workspace sidebar"]`, `[data-helmor-sidebar-root]`, `[data-shell-pane="sidebar"]`
+- Workspace panel: `[aria-label="Workspace panel"]`
+- Workspace viewport: `[aria-label="Workspace viewport"]`
+- Workspace header: `[aria-label="Workspace header"]`
+- Left resize handle: `[aria-label="Resize sidebar"]`, `role="separator"`
+- Right inspector sidebar: `[aria-label="Inspector sidebar"]`, `[data-shell-pane="inspector"]`
+- Right resize handle: `[aria-label="Resize inspector sidebar"]`
+
+## Sidebar And Workspaces
+
+- Top buttons:
+  - `Workspace location`
+  - `Filter and sort sidebar`
+  - `Add repository`
+  - `New workspace`
+  - `Collapse left sidebar`
+- Workspace rows:
+  - Prefer `[data-workspace-row-id]` when available.
+  - Fallback: row `role="button"` with `workspace-row` classes and matching text/aria-label.
+  - Selected row class: `.workspace-row-selected`
+- Row actions:
+  - `Archive workspace`
+  - `Restore workspace`
+  - `Delete permanently`
+  - Context-menu actions in code include `Pin/Unpin`, `Set status`, `Mark as unread`, `Open in Finder`, and `Move into a new worktree`.
+- Group headings observed:
+  - `Chats`
+  - `Done`
+  - `In review`
+  - `In progress`
+  - `Backlog`
+  - `Canceled`
+  - `Archived`
+  - Group headers are safe to collapse/expand; click the header rect, then verify child row visibility.
+
+## Header And Sessions
+
+- Session tabs: `[role="tablist"][aria-label="Sessions"]`, `[role="tab"]`
+- Session tab actions:
+  - `Rename session`
+  - `Close session`
+- Header buttons:
+  - `New session`
+  - `Session history`
+- Hidden session history can show:
+  - `No hidden sessions`
+  - `Restore session`
+  - `Delete session permanently`
+- Non-chat workspaces may show workspace header actions:
+  - `Open in <editor>`
+  - Open-in dropdown trigger near `Open in Warp` (`button[data-slot="dropdown-menu-trigger"][data-size="xs"]`) with `Finder`, `Cursor`, `VS Code`, `Xcode`, `Terminal`, `Warp`
+  - `More workspace actions`
+  - `Expand right sidebar` / `Collapse right sidebar`
+  - Right sidebar state is best verified by the button label plus `[aria-label="Inspector sidebar"]` `aria-hidden`, not only by raw DOM width.
+  - `Create PR options` opens `Create draft PR` / `Create PR manually`; opening is safe, selecting is a real PR action.
+
+## Composer
+
+- Composer: `[aria-label="Workspace composer"]`
+- Input: `#workspace-input`, `[aria-label="Workspace input"]`, `role="textbox"`
+- Model menu: Radix dropdown trigger whose text includes the current model, for example `ClaudeOpus 4.8 1M`
+- Controls:
+  - `Fast mode`
+  - `Carry room context`
+  - Effort menu text such as `high`
+  - `Plan mode`
+  - `Terminal mode` when enabled
+  - `Add context`
+  - `Context usage`
+  - `Usage Stats` when enabled
+  - Terminal mode enabled class includes `text-emerald-500`; disabled class includes `text-muted-foreground/70`.
+  - `Add context` toggles the right inspector between normal Git and `Contexts` mode in repo-backed workspaces.
+  - `Context usage` and `Usage Stats` may require hover or another precondition; click/long-press did not open stable pickers in observed states.
+- Submit states:
+  - `Send`
+  - `Stop`
+  - `Steer`
+  - `Request Changes`
+  - `Implement`
+- Start surface can show:
+  - `What should we work on?`
+  - `New Workspace`
+  - `Start options`
+  - `Just chat`
+  - `Save for later`
+  - `Start now`
+
+## Settings
+
+Open from the first bottom-left sidebar icon or `Cmd+,`.
+
+Sections observed:
+
+- General:
+  - `Desktop Notifications`
+  - `Notification sound`
+  - `Expand terminals on hover`
+  - `Terminal Mode`
+  - `Always show context usage`
+  - `Usage Stats`
+  - `Auto-archive on merge`
+  - `Follow-up behavior`
+  - `Queue`
+  - `Steer`
+  - `Claude Code Thinking Display`
+  - `Clean up archived workspaces`
+  - `App Updates`
+  - `Helmor Components`
+- Appearance:
+  - `Theme`
+  - `Color Theme`
+  - `Chat font size`
+  - `UI font`
+  - `Code font`
+  - `Terminal font`
+  - `Use pointer cursors`
+- Models:
+  - `Default model`
+  - `Review model`
+  - `Action model`
+- Providers:
+  - `OpenCode`
+  - `MiMo Code`
+  - `Claude Code`
+  - `Codex`
+  - `Kimi`
+  - `Cursor`
+  - `Proxy`
+  - Provider actions include `Log in`, `Sync models`, `Fetch models`, `Add provider`, `Get your API key`
+- Shortcuts:
+  - Full shortcut table including navigation, session, workspace, actions, system, composer, start surface, editor, and terminal.
+  - Shortcut buttons begin keybinding edit flow. Do not click them unless the user wants to edit keybindings.
+- Accounts:
+  - Connected forge accounts synced from local `gh` / `glab`.
+  - Do not copy account name
```

---

### Incident Patch 10: `205da668` (2026-07-03)
**Commit Message**: Fix repo avatars falling back to initials when icon can't load (#919)

fix: repo avatars falling back to initials when icon can't load

- Handle empty/undecodable icon files (e.g. 0-byte favicon.ico) in backend
- Track Radix Avatar's `onLoadingStatusChange` instead of img events
- Fix avatar showing blank instead of initials when icon fails
- Add test coverage for fallback behavior and empty icon files

**File**: `.changeset/repo-icon-fallback.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"helmor": patch
+---
+
+Fix repo avatars rendering blank instead of falling back to the name initials when a repository's icon file can't be displayed (e.g. an empty or undecodable `favicon.ico`).
```

**File**: `src-tauri/src/workspace/helpers.rs` (modified, +23/-0)
```diff
@@ -263,6 +263,13 @@ pub fn repo_icon_src_for_root_path(root_path: Option<&str>) -> Option<String> {
     let data_uri = icon_path.as_deref().and_then(|path| {
         let mime_type = repo_icon_mime_type(Path::new(path));
         let bytes = fs::read(path).ok()?;
+        // A 0-byte icon file (e.g. the empty `public/favicon.ico` placeholder
+        // scaffolded API repos ship) would otherwise become a valid-looking but
+        // image-less `data:` URI — the frontend can't render it and the avatar
+        // ends up blank. Treat it as "no icon" so the UI falls back to initials.
+        if bytes.is_empty() {
+            return None;
+        }
         Some(format!(
             "data:{mime_type};base64,{}",
             BASE64_STANDARD.encode(bytes)
@@ -1368,6 +1375,22 @@ mod tests {
         assert!(repo_icon_src_for_root_path(Some(&root_str)).is_none());
     }
 
+    #[test]
+    fn repo_icon_src_returns_none_for_empty_icon_file() {
+        // A matched-but-empty icon file (e.g. a 0-byte `public/favicon.ico`
+        // placeholder) must NOT produce a blank `data:` URI — the avatar has to
+        // fall back to initials instead of rendering nothing.
+        let dir = tempfile::tempdir().unwrap();
+        let root_str = dir.path().to_str().unwrap().to_string();
+
+        fs::create_dir_all(dir.path().join("public")).unwrap();
+        fs::write(dir.path().join("public/favicon.ico"), b"").unwrap();
+
+        assert!(repo_icon_src_for_root_path(Some(&root_str)).is_none());
+        // Second call exercises the cached path.
+        assert!(repo_icon_src_for_root_path(Some(&root_str)).is_none());
+    }
+
     // ---- Workspace naming tests ----
 
     fn test_db() -> (rusqlite::Connection, tempfile::TempDir) {
```

**File**: `src/features/navigation/avatar.test.tsx` (modified, +49/-2)
```diff
@@ -1,8 +1,55 @@
-import { render } from "@testing-library/react";
-import { describe, expect, it } from "vitest";
+import { render, waitFor } from "@testing-library/react";
+import { afterEach, describe, expect, it, vi } from "vitest";
 import { WorkspaceAvatar } from "./avatar";
 
 describe("WorkspaceAvatar", () => {
+	afterEach(() => {
+		vi.unstubAllGlobals();
+	});
+
+	it("falls back to initials when the icon src fails to load", async () => {
+		// Radix's <Avatar.Image> never mounts the underlying <img> on error — it
+		// renders null — so a native `onError` never fires. jsdom also never
+		// loads images, leaving Radix's internal probe stuck in "loading"
+		// forever. Stub window.Image so setting a src dispatches an error, which
+		// drives our `onLoadingStatusChange` path. Without the fix this repo
+		// (a non-empty but undecodable `data:image/x-icon;base64,` URI) would
+		// render a permanently blank avatar.
+		class FailingImage {
+			#src = "";
+			complete = false;
+			naturalWidth = 0;
+			#onError: (() => void) | null = null;
+			addEventListener(type: string, cb: () => void) {
+				if (type === "error") this.#onError = cb;
+			}
+			removeEventListener() {}
+			set src(value: string) {
+				this.#src = value;
+				queueMicrotask(() => this.#onError?.());
+			}
+			get src() {
+				return this.#src;
+			}
+		}
+		vi.stubGlobal("Image", FailingImage);
+
+		const { container } = render(
+			<WorkspaceAvatar
+				repoIconSrc="data:image/x-icon;base64,"
+				repoInitials="RA"
+				repoName="retail-api"
+				title="retail-api"
+			/>,
+		);
+
+		await waitFor(() => {
+			const fallback = container.querySelector('[data-slot="avatar-fallback"]');
+			expect(fallback).toBeInTheDocument();
+			expect(fallback).toHaveTextContent("RA");
+		});
+	});
+
 	it("renders fallback immediately when switching from an icon repo to a repo without an icon", () => {
 		const { container, rerender } = render(
 			<WorkspaceAvatar
```

**File**: `src/features/navigation/avatar.tsx` (modified, +19/-9)
```diff
@@ -31,6 +31,9 @@ function getWorkspaceAvatarSrc(repoIconSrc?: string | null) {
 	return repoIconSrc?.trim() ? repoIconSrc : null;
 }
 
+/** Mirrors Radix's `ImageLoadingStatus` union (not exported by the package). */
+type AvatarLoadingStatus = "idle" | "loading" | "loaded" | "error";
+
 export const WorkspaceAvatar = memo(function WorkspaceAvatar({
 	repoIconSrc,
 	repoInitials,
@@ -63,12 +66,24 @@ export const WorkspaceAvatar = memo(function WorkspaceAvatar({
 		.slice(0, 2)
 		.toUpperCase();
 	const src = getWorkspaceAvatarSrc(repoIconSrc);
-	const [hasImage, setHasImage] = useState(Boolean(src));
+	// Radix's <Avatar.Image> never mounts the underlying <img> unless its own
+	// probe reports "loaded" — on failure it just renders `null`. A native
+	// <img onError> therefore never fires, so we drive the fallback from
+	// Radix's `onLoadingStatusChange` instead. Without this, a broken or
+	// undecodable icon (an empty `favicon.ico`, an `.ico` WebKit can't render,
+	// a corrupt file) leaves the avatar permanently blank instead of showing
+	// the initials.
+	const [status, setStatus] = useState<AvatarLoadingStatus>("idle");
 
+	// Reset when the icon source changes so a new icon gets a fresh chance to
+	// load before we decide to fall back.
 	useEffect(() => {
-		setHasImage(Boolean(src));
+		setStatus("idle");
 	}, [src]);
-	const showFallback = !src || !hasImage;
+
+	// Stay optimistic while idle/loading (no initials flash for good icons);
+	// only fall back once the load actually errors or there's no src at all.
+	const showFallback = !src || status === "error";
 
 	return (
 		<Avatar
@@ -86,12 +101,7 @@ export const WorkspaceAvatar = memo(function WorkspaceAvatar({
 				<AvatarImage
 					src={src}
 					alt={`${repoName ?? title} icon`}
-					onError={() => {
-						setHasImage(false);
-					}}
-					onLoad={() => {
-						setHasImage(true);
-					}}
+					onLoadingStatusChange={(nextStatus) => setStatus(nextStatus)}
 				/>
 			) : null}
 			{showFallback ? (
```

**File**: `src/features/navigation/row-item.tsx` (modified, +1/-1)
```diff
@@ -470,7 +470,7 @@ export const WorkspaceRowItem = memo(
 						<div className="flex min-w-0 flex-1 items-center gap-2">
 							<WorkspaceAvatar
 								repoIconSrc={row.repoIconSrc}
-								repoInitials={row.repoInitials ?? row.avatar ?? null}
+								repoInitials={row.repoInitials || row.avatar || null}
 								repoName={row.repoName}
 								title={displayTitle}
 								badgeClassName={showStatusDot ? statusDotClassName : null}
```

**File**: `src/features/navigation/workspace-hover-card.tsx` (modified, +1/-1)
```diff
@@ -663,7 +663,7 @@ export function WorkspaceHoverCard({
 						<div className="flex min-w-0 items-center gap-2">
 							<WorkspaceAvatar
 								repoIconSrc={row.repoIconSrc}
-								repoInitials={row.repoInitials ?? row.avatar ?? null}
+								repoInitials={row.repoInitials || row.avatar || null}
 								repoName={row.repoName}
 								title={title}
 								className="size-4 rounded-[4px]"
```

---

### Incident Patch 11: `b5ba1e04` (2026-07-01)
**Commit Message**: [codex] fix claude background drain timeout (#915)

fix claude background drain timeout

**File**: `.changeset/stale-background-drain.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"helmor": patch
+---
+
+Prevent Claude background-task drain from leaving a session loading forever when a task never sends its completion notification.
```

**File**: `sidecar/src/claude/background-resume.test.ts` (modified, +47/-3)
```diff
@@ -14,21 +14,36 @@
  * `end`. The loop keeps draining until the genuinely terminal result.
  */
 
-import { beforeAll, describe, expect, mock, test } from "bun:test";
+import { afterEach, beforeAll, describe, expect, mock, test } from "bun:test";
 import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
 import type { SendMessageParams } from "../session-manager.js";
 
 // The mocked query() returns whatever the active scenario holds. A single
 // mocked binding (resolved at session-manager import time) reads this mutable
 // outer variable so each test can swap the SDK message stream.
 let scenario: SDKMessage[] = [];
+let hangAfterScenario = false;
+const previousBgDrainTimeout = process.env.HELMOR_CLAUDE_BG_DRAIN_TIMEOUT_MS;
 
 function makeQuery(messages: SDKMessage[]) {
+	let closed = false;
+	let releaseHang: (() => void) | null = null;
 	return {
 		async *[Symbol.asyncIterator]() {
-			for (const m of messages) yield m;
+			for (const m of messages) {
+				if (closed) return;
+				yield m;
+			}
+			if (hangAfterScenario && !closed) {
+				await new Promise<void>((resolve) => {
+					releaseHang = resolve;
+				});
+			}
+		},
+		close() {
+			closed = true;
+			releaseHang?.();
 		},
-		close() {},
 	};
 }
 
@@ -149,6 +164,16 @@ beforeAll(async () => {
 	({ ClaudeSessionManager } = await import("./session-manager.js"));
 });
 
+afterEach(() => {
+	scenario = [];
+	hangAfterScenario = false;
+	if (previousBgDrainTimeout === undefined) {
+		delete process.env.HELMOR_CLAUDE_BG_DRAIN_TIMEOUT_MS;
+	} else {
+		process.env.HELMOR_CLAUDE_BG_DRAIN_TIMEOUT_MS = previousBgDrainTimeout;
+	}
+});
+
 describe("ClaudeSessionManager backgrounded-task resume (#891)", () => {
 	test("filters the pause result, resumes, and ends exactly once", async () => {
 		scenario = [
@@ -301,6 +326,25 @@ describe("ClaudeSessionManager run_in_background drain (completed with pending b
 		expect(completedResultCount(spy)).toBe(0); // deferred, never reached pipeline
 	});
 
+	test("forces end after the background drain timeout if a pending task never notifies", async () => {
+		process.env.HELMOR_CLAUDE_BG_DRAIN_TIMEOUT_MS = "5";
+		hangAfterScenario = true;
+		scenario = [
+			assistant("dispatching"),
+			taskStarted("bg1"),
+			result("completed"), // deferred; query then stays open forever
+		];
+		const spy = makeSpyEmitter();
+		await new ClaudeSessionManager().sendMessage(
+			"req-bg-timeout",
+			baseParams(),
+			spy.emitter,
+		);
+
+		expect(spy.ends).toBe(1);
+		expect(completedResultCount(spy)).toBe(0);
+	});
+
 	test("error terminal is NOT deferred even with a bg task pending", async () => {
 		scenario = [
 			assistant("dispatching"),
```

**File**: `sidecar/src/claude/session-manager.ts` (modified, +138/-9)
```diff
@@ -67,6 +67,15 @@ const SLASH_COMMANDS_TIMEOUT_MS = 20_000;
  */
 const CONTEXT_USAGE_TIMEOUT_MS = 30_000;
 
+/**
+ * Upper bound after a turn's `completed` result has been deferred for pending
+ * `run_in_background` tasks. Normal background tasks still report back through
+ * `task_notification`; this only prevents a missing/never-settling task event
+ * from leaving the Helmor session busy forever.
+ */
+const BACKGROUND_TASK_DRAIN_TIMEOUT_MS = 20 * 60_000;
+const BACKGROUND_TASK_DRAIN_TIMEOUT_ENV = "HELMOR_CLAUDE_BG_DRAIN_TIMEOUT_MS";
+
 /**
  * Resolve the Claude Code native binary for `pathToClaudeCodeExecutable`.
  * Prefers `HELMOR_CLAUDE_CODE_BIN_PATH` (release), then the platform
@@ -687,16 +696,70 @@ export class ClaudeSessionManager implements SessionManager {
 		};
 		this.sessions.set(sessionId, live);
 
+		// In-flight `run_in_background` tasks (subagents / background Bash),
+		// keyed by task_id. They settle asynchronously via `task_notification`
+		// AFTER the agent ends its turn; closing the query on the turn's
+		// `completed` while any are still pending would `q.close()` the
+		// claude-code subprocess and kill them before they notify, so we keep
+		// draining the SAME query until they all settle (see deferral below).
+		const pendingBgTasks = new Map<string, PendingBgTask>();
+		let bgDrainTimer: ReturnType<typeof setTimeout> | null = null;
+		let bgDrainTimedOut = false;
+		const clearBgDrainTimer = () => {
+			if (bgDrainTimer === null) return;
+			clearTimeout(bgDrainTimer);
+			bgDrainTimer = null;
+		};
+		const summarizePendingBgTasks = () =>
+			Array.from(pendingBgTasks.values())
+				.slice(0, 12)
+				.map((task) => ({
+					taskId: task.taskId,
+					taskType: task.taskType,
+					toolUseId: task.toolUseId,
+					description: task.description,
+					terminalStatus: task.terminalStatus,
+					ageMs: Date.now() - task.startedAt,
+				}));
+		const ensureBgDrainTimer = () => {
+			if (bgDrainTimer !== null) return;
+			const timeoutMs = backgroundTaskDrainTimeoutMs();
+			logger.info(
+				`[${requestId}] deferring completed result for pending background tasks`,
+				{
+					timeoutMs,
+					pendingCount: pendingBgTasks.size,
+					pendingTasks: summarizePendingBgTasks(),
+				},
+			);
+			bgDrainTimer = setTimeout(() => {
+				if (pendingBgTasks.size === 0 || this.turns.isAbortRequested(sessionId))
+					return;
+				bgDrainTimedOut = true;
+				logger.error(
+					`[${requestId}] background task drain timed out; closing Claude query`,
+					{
+						timeoutMs,
+						pendingCount: pendingBgTasks.size,
+						pendingTasks: summarizePendingBgTasks(),
+					},
+				);
+				try {
+					q.close();
+				} catch (closeErr) {
+					logger.error("Claude background drain timeout q.close() failed", {
+						requestId,
+						sessionId,
+						...errorDetails(closeErr),
+					});
+				}
+			}, timeoutMs);
+			(bgDrainTimer as { unref?: () => void }).unref?.();
+		};
+
 		try {
 			let lastRateLimitInfo: RateLimitOverageInfo | undefined;
 			let fastModeNoticeEmitted = false;
-			// In-flight `run_in_background` tasks (subagents / background Bash),
-			// keyed by task_id. They settle asynchronously via `task_notification`
-			// AFTER the agent ends its turn; closing the query on the turn's
-			// `completed` while any are still pending would `q.close()` the
-			// claude-code subprocess and kill them before they notify, so we keep
-			// draining the SAME query until they all settle (see deferral below).
-			const pendingBgTasks = new Set<string>();
 			for await (const message of q) {
 				// stopSession already emitted the terminal `aborted` and tore the
 				// session down. The new SDK keeps the child alive ~2s after abort,
@@ -757,10 +820,34 @@ export class ClaudeSessionManager implements SessionManager {
 				if (message.type === "system") {
 					const subtype = (message as { subtype?: string }).subtype;
 					const taskId = (message as { task_id?: string }).task_id;
+					const toolUseId = (message as { tool_use_id?: string }).tool_use_id;
 					if (taskId) {
-						if (subtype === "task_started") pendingBgTasks.add(taskId);
-						else if (subtype === "task_notification")
+						if (subtype === "task_started") {
+							pendingBgTasks.set(taskId, {
+								taskId,
+								toolUseId,
+								taskType: (message as { task_type?: string }).task_type,
+								description: (message as { description?: string }).description,
+								startedAt: Date.now(),
+							});
+						} else if (subtype === "task_notification") {
 							pendingBgTasks.delete(taskId);
+							if (pendingBgTasks.size === 0) clearBgDrainTimer();
+						} else if (subtype === "task_updated") {
+							const pending = pendingBgTasks.get(taskId);
+							const status = terminalTaskUpdateStatus(message);
+							if (pending && status) {
+								pending.terminalStatus = status;
+							}
+						}
+					} else if (subtype === "task_notification" && toolUseId) {
+						for (const [pendingTaskId, pending] of pe
```

---

### Incident Patch 12: `4069f1e5` (2026-07-01)
**Commit Message**: fix: re-target stacked workspaces when their base PR merges (#913)

* fix: re-target stacked workspaces when their base PR merges

A stacked layer's PR merging is a structural transition that removes the
layer from the active stack, but nothing re-homed its children onto the
merged layer's base — they stayed pinned to the now-merged branch, so the
child header, branch diff, and `gh pr create --base` all kept pointing at
a merged branch.

Add a shared `splice_out_stack_layer_tx` primitive: a layer's direct
children re-home onto its own parent (the grandparent), or detach to the
repo default branch for a bottom-of-stack merge, while the merged layer
itself survives as a standalone "Done" workspace. The post-splice state
still satisfies the stack invariant, so the startup backfill and rename
cascade leave it alone, and the frontend re-nests with no UI changes.

Wire it up three ways, all through the one primitive:
- merge: called atomically inside the `sync_workspace_pr_state` flip to
  Merged (covers both the poll and explicit-merge paths), before
  auto-archive;
- delete: the existing root-pop reparent is unified onto it;
- startup: a reconcile heals stacks already left pointing at 

**File**: `.changeset/retarget-stack-on-merge.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"helmor": patch
+---
+
+Stacked workspaces now re-target automatically when their base PR merges — the layer above a merged PR moves onto that layer's own base (the repo default branch for a bottom-of-stack merge) instead of staying pinned to the now-merged branch, and stacks already left in this state are healed on launch.
```

**File**: `src-tauri/src/commands/forge_commands.rs` (modified, +20/-0)
```diff
@@ -366,6 +366,16 @@ pub async fn refresh_workspace_change_request(
     if outcome.transitioned_to_merged {
         crate::workspace::archive::try_auto_archive_after_merge(&app, &workspace_id);
     }
+    // A merged layer's stacked children were re-homed onto its base; refresh
+    // each so the sidebar re-nests and the child's header retargets.
+    for child_id in &outcome.retargeted_children {
+        ui_sync::publish(
+            &app,
+            UiMutationEvent::WorkspaceChanged {
+                workspace_id: child_id.clone(),
+            },
+        );
+    }
     Ok(result)
 }
 
@@ -437,6 +447,16 @@ async fn run_change_request_action(
     if outcome.transitioned_to_merged {
         crate::workspace::archive::try_auto_archive_after_merge(&app, &workspace_id);
     }
+    // A merged layer's stacked children were re-homed onto its base; refresh
+    // each so the sidebar re-nests and the child's header retargets.
+    for child_id in &outcome.retargeted_children {
+        ui_sync::publish(
+            &app,
+            UiMutationEvent::WorkspaceChanged {
+                workspace_id: child_id.clone(),
+            },
+        );
+    }
     Ok(result)
 }
 
```

**File**: `src-tauri/src/commands/tests/workspace_creation.rs` (modified, +79/-0)
```diff
@@ -95,6 +95,85 @@ fn stack_deletion_constraint_tip_free_root_pops_middle_blocked() {
     assert_eq!(target.as_deref(), Some(default_branch.as_str()));
 }
 
+#[test]
+fn stack_bottom_merge_pops_children_to_default_and_keeps_merged_row() {
+    let _guard = TEST_LOCK
+        .lock()
+        .unwrap_or_else(|poisoned| poisoned.into_inner());
+    let harness = CreateTestHarness::new();
+
+    // root -> mid -> tip
+    let root = workspaces::create_workspace_from_repo_impl(&harness.repo_id).unwrap();
+    let mid = workspaces::create_stacked_workspace_impl(&root.created_workspace_id).unwrap();
+    let tip = workspaces::create_stacked_workspace_impl(&mid.created_workspace_id).unwrap();
+
+    // The bottom layer's PR merges.
+    let merged = crate::forge::ChangeRequestInfo {
+        url: "https://example.test/pr/1".to_string(),
+        number: 1,
+        state: "MERGED".to_string(),
+        title: "root PR".to_string(),
+        is_merged: true,
+    };
+    let outcome =
+        workspaces::sync_workspace_pr_state(&root.created_workspace_id, Some(&merged)).unwrap();
+    assert!(outcome.transitioned_to_merged);
+    // Only the direct child (mid) is re-homed; the tip stays put.
+    assert_eq!(
+        outcome.retargeted_children,
+        vec![mid.created_workspace_id.clone()]
+    );
+
+    let connection = Connection::open(harness.db_path()).unwrap();
+
+    // The merged bottom layer SURVIVES (not deleted) and is marked done/merged.
+    let (root_pr_state, root_status): (String, String) = connection
+        .query_row(
+            "SELECT pr_sync_state, status FROM workspaces WHERE id = ?1",
+            [&root.created_workspace_id],
+            |row| Ok((row.get(0)?, row.get(1)?)),
+        )
+        .unwrap();
+    assert_eq!(root_pr_state, "merged");
+    assert_eq!(root_status, "done");
+
+    // mid detaches to a root, retargeting the repo default branch — exactly the
+    // "upper layer auto-points to main once the bottom merged" behaviour.
+    let (mid_parent, mid_target): (Option<String>, Option<String>) = connection
+        .query_row(
+            "SELECT parent_workspace_id, intended_target_branch FROM workspaces WHERE id = ?1",
+            [&mid.created_workspace_id],
+            |row| Ok((row.get(0)?, row.get(1)?)),
+        )
+        .unwrap();
+    assert_eq!(
+        mid_parent, None,
+        "mid should detach to a root after the bottom merged"
+    );
+    let default_branch: String = connection
+        .query_row(
+            "SELECT default_branch FROM repos WHERE id = ?1",
+            [&harness.repo_id],
+            |row| row.get(0),
+        )
+        .unwrap();
+    assert_eq!(mid_target.as_deref(), Some(default_branch.as_str()));
+
+    // tip is untouched: still stacked on mid, still targeting mid's branch.
+    let (tip_parent, tip_target): (Option<String>, Option<String>) = connection
+        .query_row(
+            "SELECT parent_workspace_id, intended_target_branch FROM workspaces WHERE id = ?1",
+            [&tip.created_workspace_id],
+            |row| Ok((row.get(0)?, row.get(1)?)),
+        )
+        .unwrap();
+    assert_eq!(
+        tip_parent.as_deref(),
+        Some(mid.created_workspace_id.as_str())
+    );
+    assert_eq!(tip_target.as_deref(), Some(mid.branch.as_str()));
+}
+
 #[test]
 fn load_workspace_stack_returns_root_to_tip_chain() {
     let _guard = TEST_LOCK
```

**File**: `src-tauri/src/models/workspaces.rs` (modified, +93/-0)
```diff
@@ -794,6 +794,99 @@ pub(crate) fn update_workspace_branch(workspace_id: &str, new_branch: &str) -> R
     Ok(())
 }
 
+/// Splice a stack layer out from under its children.
+///
+/// Every direct child of `layer_id` is reparented onto that layer's OWN parent
+/// (the grandparent) and its cached `intended_target_branch` is repointed to the
+/// grandparent's branch — or, when `layer_id` was the bottom of the stack (no
+/// live grandparent), the child detaches to a root targeting the repo default
+/// branch. The `layer_id` row itself is left untouched, so a merged layer
+/// survives as a standalone workspace.
+///
+/// This is the shared primitive behind every event that removes a layer from the
+/// active stack: a lower layer's PR merged, or the stack root was deleted. In
+/// both cases the layer stops being part of the stack and its children must
+/// re-home onto whatever is now below them. Crucially the post-splice state still
+/// satisfies the stack invariant (`child.intended_target_branch ==
+/// parent(child).branch`), so the startup backfill and the rename cascade leave
+/// it alone.
+///
+/// Runs directly on the caller's connection, so it participates in whatever
+/// transaction (if any) the caller already holds: pass a `&Transaction` (it
+/// deref-coerces to `&Connection`) to make it atomic with a surrounding change
+/// like the merge flip or a delete, or a bare `&Connection` to autocommit each
+/// UPDATE. It deliberately does NOT open its own transaction — the startup
+/// reconcile calls it from inside `run_migrations`, which can itself run inside
+/// a caller's transaction where a nested `BEGIN` would fail. Must run while the
+/// `layer_id` row still exists
+/// (the base is resolved from it). Returns the reparented child ids for UI
+/// refresh; empty when `layer_id` has no children (a tip or non-stacked layer).
+pub(crate) fn splice_out_stack_layer(
+    conn: &rusqlite::Connection,
+    layer_id: &str,
+) -> Result<Vec<String>> {
+    let children: Vec<String> = {
+        let mut stmt = conn
+            .prepare("SELECT id FROM workspaces WHERE parent_workspace_id = ?1")
+            .context("Failed to prepare stack-children query")?;
+        let rows = stmt
+            .query_map([layer_id], |row| row.get::<_, String>(0))
+            .context("Failed to query stack children")?;
+        rows.collect::<rusqlite::Result<Vec<String>>>()
+            .context("Failed to read stack children")?
+    };
+    if children.is_empty() {
+        return Ok(children);
+    }
+
+    // The layer's own parent becomes the children's new base. Resolve it to a
+    // LIVE row so a dangling parent id degrades to "detach to root".
+    let grandparent: Option<(String, Option<String>)> = conn
+        .query_row(
+            "SELECT p.id, p.branch
+               FROM workspaces layer
+               JOIN workspaces p ON p.id = layer.parent_workspace_id
+              WHERE layer.id = ?1",
+            [layer_id],
+            |row| Ok((row.get(0)?, row.get(1)?)),
+        )
+        .ok();
+
+    // Fallback target when there is no grandparent (the layer was the bottom).
+    let default_branch: Option<String> = conn
+        .query_row(
+            "SELECT r.default_branch
+               FROM workspaces w JOIN repos r ON r.id = w.repository_id
+              WHERE w.id = ?1",
+            [layer_id],
+            |row| row.get(0),
+        )
+        .ok()
+        .flatten();
+
+    let (new_parent, new_target): (Option<String>, String) = match grandparent {
+        Some((grandparent_id, grandparent_branch)) => (
+            Some(grandparent_id),
+            grandparent_branch
+                .or_else(|| default_branch.clone())
+                .unwrap_or_else(|| "main".to_string()),
+        ),
+        None => (None, default_branch.unwrap_or_else(|| "main".to_string())),
+    };
+
+    conn.execute(
+        "UPDATE workspaces
+            SET parent_workspace_id = ?2,
+                intended_target_branch = ?3,
+                updated_at = datetime('now')
+          WHERE parent_workspace_id = ?1",
+        (layer_id, new_parent.as_deref(), new_target.as_str()),
+    )
+    .context("Failed to reparent stack children")?;
+
+    Ok(children)
+}
+
 /// Set (or clear) the user's custom display name for a workspace. `Some(name)`
 /// overrides the auto-derived title; `None` clears it back to the derived one.
 pub(crate) fn update_workspace_custom_name(
```

**File**: `src-tauri/src/schema.rs` (modified, +136/-0)
```diff
@@ -210,6 +210,44 @@ fn backfill_stacked_target_branches(connection: &Connection) -> Result<()> {
     Ok(())
 }
 
+/// Startup reconcile for stacks whose base merged under an older build, before
+/// merge-time splicing existed. Every workspace still stacked on a merged layer
+/// is spliced out via the shared write-layer primitive
+/// [`crate::models::workspaces::splice_out_stack_layer`], re-homing its
+/// children onto the nearest surviving base — the exact end state a live merge
+/// now produces. Iterating over *all* merged layers converges even for chained
+/// merges (a child of a merged layer always ends on a non-merged ancestor or
+/// the repo default). Idempotent: once every merged layer is childless it's a
+/// no-op, so this can run on every startup like the backfill above.
+fn heal_children_of_merged_stack_layers(connection: &Connection) -> Result<()> {
+    if !has_table(connection, "workspaces")
+        || !has_column(connection, "workspaces", "parent_workspace_id")
+        || !has_column(connection, "workspaces", "pr_sync_state")
+    {
+        return Ok(());
+    }
+    let merged_layers: Vec<String> = {
+        let mut stmt = connection
+            .prepare("SELECT id FROM workspaces WHERE pr_sync_state = 'merged'")
+            .context("Failed to prepare merged-layer query")?;
+        let rows = stmt
+            .query_map([], |row| row.get::<_, String>(0))
+            .context("Failed to query merged layers")?;
+        rows.collect::<rusqlite::Result<Vec<String>>>()
+            .context("Failed to read merged layers")?
+    };
+    // Splice directly on `connection` rather than opening our own transaction:
+    // `ensure_schema` / `run_migrations` can run inside a caller's transaction,
+    // where an `unchecked_transaction()` here would fail with "cannot start a
+    // transaction within a transaction". Each splice is a single idempotent
+    // UPDATE, so a crash mid-loop just heals on the next run.
+    for layer_id in &merged_layers {
+        crate::models::workspaces::splice_out_stack_layer(connection, layer_id)
+            .with_context(|| format!("Failed to splice merged stack layer {layer_id}"))?;
+    }
+    Ok(())
+}
+
 fn run_migrations(connection: &Connection) -> Result<()> {
     // Migration: rename claude_session_id → provider_session_id (supports any agent provider)
     let has_old_column: bool = connection
@@ -559,6 +597,13 @@ fn run_migrations(connection: &Connection) -> Result<()> {
     backfill_stacked_target_branches(connection)
         .context("Failed to backfill stacked-PR target branches")?;
 
+    // A stacked base that merged under an older build never spliced its children
+    // out (merge-time splicing is newer). Re-home any workspace still stacked on
+    // a merged layer so its parent/target point past the merged base — the same
+    // end state a live merge now produces.
+    heal_children_of_merged_stack_layers(connection)
+        .context("Failed to heal children of merged stack layers")?;
+
     let had_workspace_status =
         has_table(connection, "workspaces") && has_column(connection, "workspaces", "status");
     if has_table(connection, "workspaces") && !had_workspace_status {
@@ -1369,6 +1414,97 @@ mod tests {
         );
     }
 
+    fn parent_of(connection: &Connection, id: &str) -> Option<String> {
+        connection
+            .query_row(
+                "SELECT parent_workspace_id FROM workspaces WHERE id = ?1",
+                [id],
+                |r| r.get(0),
+            )
+            .unwrap()
+    }
+
+    #[test]
+    fn heal_splices_children_off_a_merged_base() {
+        let (connection, _dir) = open_test_db();
+        ensure_schema(&connection).unwrap();
+
+        // root(bottom) -> mid -> tip; the bottom's PR is already merged.
+        insert_ws(&connection, "root", "feat/root", Some("main"), None);
+        insert_ws(
+            &connection,
+            "mid",
+            "feat/mid",
+            Some("feat/root"),
+            Some("root"),
+        );
+        insert_ws(
+            &connection,
+            "tip",
+            "feat/tip",
+            Some("feat/mid"),
+            Some("mid"),
+        );
+        connection
+            .execute(
+                "UPDATE workspaces SET pr_sync_state = 'merged' WHERE id = 'root'",
+                [],
+            )
+            .unwrap();
+
+        heal_children_of_merged_stack_layers(&connection).unwrap();
+
+        // mid detaches to a root: it no longer points at the merged root, and
+        // its target falls back to "main" (this fixture has no `repos` row, so
+        // the repo-default lookup misses — the real default_branch path is
+        // covered by the models-layer test).
+        assert_eq!(parent_of(&connection, "mid"), None);
+        assert_eq!(target_of(&connection, "mid").as_deref(), Some("main"));
+
+        // tip is untouched: still stacked on mid, still targeting mid's branch.
+        assert_eq!(paren
```

**File**: `src-tauri/src/workspace/workspaces.rs` (modified, +30/-25)
```diff
@@ -814,18 +814,20 @@ fn next_order_for_target(transaction: &Transaction<'_>, target: &MoveTarget) ->
 /// `Merged` in this call — combined with the absorbing-state guarantee
 /// in `stabilize_pr_sync_state`, this means it fires at most once per
 /// workspace per merge.
-#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
+#[derive(Debug, Clone, Default, PartialEq, Eq)]
 pub struct PrSyncOutcome {
     pub changed: bool,
     pub transitioned_to_merged: bool,
+    /// Ids of stacked children re-homed when this layer's PR merged (empty
+    /// otherwise). The command layer republishes each so the sidebar re-nests
+    /// and the child's header retargets onto the new base. See
+    /// [`crate::models::workspaces::splice_out_stack_layer`].
+    pub retargeted_children: Vec<String>,
 }
 
 impl PrSyncOutcome {
     fn unchanged() -> Self {
-        Self {
-            changed: false,
-            transitioned_to_merged: false,
-        }
+        Self::default()
     }
 }
 
@@ -875,6 +877,7 @@ pub fn sync_workspace_pr_state(
         None
     };
 
+    let mut retargeted_children: Vec<String> = Vec::new();
     let mut connection = db::write_conn()?;
     if let Some(status) = target_status {
         let transaction = connection
@@ -922,6 +925,14 @@ pub fn sync_workspace_pr_state(
                 )
                 .context("Failed to sync workspace PR state")?;
         }
+        // A layer leaving the stack (its PR just merged) pops its children onto
+        // its own base. Same transaction as the merge flip so it's atomic, and
+        // before auto-archive so the children are re-homed while the layer row
+        // still exists.
+        if transitioned_to_merged {
+            retargeted_children =
+                workspace_models::splice_out_stack_layer(&transaction, workspace_id)?;
+        }
         transaction
             .commit()
             .context("Failed to commit PR-sync workspace transaction")?;
@@ -943,6 +954,7 @@ pub fn sync_workspace_pr_state(
     Ok(PrSyncOutcome {
         changed: true,
         transitioned_to_merged,
+        retargeted_children,
     })
 }
 
@@ -1527,14 +1539,14 @@ pub fn permanently_delete_workspace(workspace_id: &str) -> Result<()> {
     // --- Stacked-PR deletion guard: tip free / root = pop-bottom / middle
     // blocked. A middle layer (a live parent below AND layers stacked above)
     // can't be deleted — it would leave an unrebaseable hole in the stack.
-    let (parent_id, default_branch): (Option<String>, Option<String>) = connection
+    let parent_id: Option<String> = connection
         .query_row(
-            "SELECT w.parent_workspace_id, r.default_branch
-               FROM workspaces w JOIN repos r ON r.id = w.repository_id WHERE w.id = ?1",
+            "SELECT parent_workspace_id FROM workspaces WHERE id = ?1",
             [workspace_id],
-            |row| Ok((row.get(0)?, row.get(1)?)),
+            |row| row.get(0),
         )
-        .unwrap_or((None, None));
+        .ok()
+        .flatten();
     let has_children: bool = connection
         .query_row(
             "SELECT EXISTS(SELECT 1 FROM workspaces WHERE parent_workspace_id = ?1)",
@@ -1599,6 +1611,14 @@ pub fn permanently_delete_workspace(workspace_id: &str) -> Result<()> {
             [workspace_id],
         )
         .context("Failed to delete workspace sessions")?;
+    // Pop this layer out of the stack before deleting it: its direct children
+    // re-home onto the layer's own base (the grandparent branch, or the repo
+    // default when this is a stack root — a deleted-with-children layer is
+    // guaranteed rootless by the guard above). Shared with merge-driven
+    // splicing so both paths keep the stack consistent. Must run while the row
+    // still exists so the base can be resolved from it.
+    workspace_models::splice_out_stack_layer(&transaction, workspace_id)?;
+
     let deleted_rows = transaction
         .execute("DELETE FROM workspaces WHERE id = ?1", [workspace_id])
         .context("Failed to delete workspace row")?;
@@ -1607,21 +1627,6 @@ pub fn permanently_delete_workspace(workspace_id: &str) -> Result<()> {
         bail!("Workspace delete affected {deleted_rows} rows for {workspace_id}");
     }
 
-    // Root pop: a deleted stack root's direct children become new roots
-    // targeting the repo default branch (they'll need a restack onto it).
-    if has_children {
-        transaction
-            .execute(
-                "UPDATE workspaces
-                   SET parent_workspace_id = NULL,
-                       intended_target_branch = ?2,
-                       updated_at = datetime('now')
-                 WHERE parent_workspace_id = ?1",
-                (workspace_id, default_branch.as_deref().unwrap_or("main")),
-            )
-            .context("Failed to reparent stack children after root delete")?;
-    }
-
     transaction
         .commit()
         .context("Failed to commit delete workspace transactio
```

---

### Incident Patch 13: `a7148338` (2026-07-01)
**Commit Message**: fix/lets-ship-i18n (#908)

Fix lets ship i18n label

Co-authored-by: Caspian 東澔 <[REDACTED_EMAIL]>

**File**: `src/features/onboarding/steps/repo-import-step.tsx` (modified, +1/-1)
```diff
@@ -192,7 +192,7 @@ export function RepoImportStep({
 						onClick={onComplete}
 						className="h-11 gap-2 px-4 text-title"
 					>
-						<I18nText source="letAposSShip" />
+						<I18nText source="letsShip" />
 						<ArrowRight data-icon="inline-end" className="size-4" />
 					</Button>
 				</div>
```

**File**: `src/lib/i18n/locales/en.json` (modified, +1/-1)
```diff
@@ -763,7 +763,7 @@
 	"lastUpdated": "Last updated",
 	"latestUpdateHasBeenDownloadedReady": "The latest update has been downloaded and is ready to install.",
 	"left": "% left",
-	"letAposSShip": "Let&apos;s ship",
+	"letsShip": "Let's ship",
 	"light": "Light",
 	"lightCleanupHandoffBeforeArchiving": "Light cleanup or handoff before archiving.",
 	"linear": "Linear",
```

**File**: `src/lib/i18n/locales/zh-CN.json` (modified, +1/-1)
```diff
@@ -763,7 +763,7 @@
 	"lastUpdated": "最后更新",
 	"latestUpdateHasBeenDownloadedReady": "最新更新已下载，准备安装。",
 	"left": "% 剩余",
-	"letAposSShip": "准备交付",
+	"letsShip": "准备交付",
 	"light": "浅色",
 	"lightCleanupHandoffBeforeArchiving": "归档前进行轻量清理或交接。",
 	"linear": "Linear",
```

---

### Incident Patch 14: `99a8af36` (2026-07-01)
**Commit Message**: fix: keep background subagents/tasks alive so they report back (#909)

fix(sidecar): keep query alive for pending run_in_background tasks

An agent that spawns run_in_background subagents (or a background Bash) and then ends its turn emits a completed result. The claude session manager treated that as terminal and closed the query, which terminates the claude-code subprocess and kills the still-running in-process background tasks before they can deliver their task_notification. Any subagent slower than its dispatching turn was silently lost. Track in-flight background tasks by task_id (task_started opens one, task_notification settles it) and defer the turn's completed while any remain pending, draining the same query until they all settle (mirrors the existing background_requested pause handling). Error/aborted terminals still end immediately.

**File**: `.changeset/late-tasks-report-back.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"helmor": patch
+---
+
+Fix background subagents and background shell commands being killed when an agent finishes its turn — they now run to completion and report their results back instead of silently dying.
```

**File**: `sidecar/src/claude/background-resume.test.ts` (modified, +128/-3)
```diff
@@ -105,16 +105,28 @@ function result(terminalReason: string): SDKMessage {
 	} as unknown as SDKMessage;
 }
 
-function taskNotification(): SDKMessage {
+function taskNotification(taskId = "t1"): SDKMessage {
 	return {
 		type: "system",
 		subtype: "task_notification",
-		task_id: "t1",
+		task_id: taskId,
 		status: "completed",
 		output_file: "",
 		summary: "done",
 		session_id: "s1",
-		uuid: "tn-1",
+		uuid: `tn-${taskId}`,
+	} as unknown as SDKMessage;
+}
+
+function taskStarted(taskId = "t1"): SDKMessage {
+	return {
+		type: "system",
+		subtype: "task_started",
+		task_id: taskId,
+		tool_use_id: `tu-${taskId}`,
+		parent_tool_use_id: null,
+		session_id: "s1",
+		uuid: `ts-${taskId}`,
 	} as unknown as SDKMessage;
 }
 
@@ -196,3 +208,116 @@ describe("ClaudeSessionManager backgrounded-task resume (#891)", () => {
 		expect(passedReasons).not.toContain("background_requested");
 	});
 });
+
+describe("ClaudeSessionManager run_in_background drain (completed with pending bg tasks)", () => {
+	const completedResultCount = (spy: EmitterSpy) =>
+		spy.passthroughs.filter(
+			(m) =>
+				(m as { type?: string }).type === "result" &&
+				(m as { terminal_reason?: string }).terminal_reason === "completed",
+		).length;
+
+	test("defers `completed` while a bg task is pending, resumes on task_notification, ends once", async () => {
+		scenario = [
+			assistant("dispatching"),
+			taskStarted("bg1"),
+			result("completed"), // intermediate — bg1 still pending, must be deferred
+			taskNotification("bg1"), // bg1 settles
+			assistant("synthesizing"),
+			result("completed"), // genuinely terminal
+		];
+		const spy = makeSpyEmitter();
+		await new ClaudeSessionManager().sendMessage(
+			"req-bg-1",
+			baseParams(),
+			spy.emitter,
+		);
+
+		// One terminal end — the intermediate `completed` must not fire it.
+		expect(spy.ends).toBe(1);
+		// Only the FINAL `completed` reaches the pipeline (one result per turn).
+		expect(completedResultCount(spy)).toBe(1);
+		// Continuation flows through: notification + the post-resume assistant.
+		const subtypes = spy.passthroughs.map(
+			(m) => (m as { subtype?: string }).subtype,
+		);
+		expect(subtypes).toContain("task_notification");
+		const assistantTexts = spy.passthroughs
+			.filter((m) => (m as { type?: string }).type === "assistant")
+			.map(
+				(m) =>
+					(m as { message?: { content?: { text?: string }[] } }).message
+						?.content?.[0]?.text,
+			);
+		expect(assistantTexts).toContain("synthesizing");
+		// Usage recorded at the deferred pause AND the terminal result.
+		expect(spy.contextUsageUpdates).toBeGreaterThanOrEqual(2);
+	});
+
+	test("waits for ALL of several bg tasks before ending", async () => {
+		scenario = [
+			assistant("dispatch 3"),
+			taskStarted("a"),
+			taskStarted("b"),
+			taskStarted("c"),
+			result("completed"), // pending {a,b,c} — deferred
+			taskNotification("a"),
+			result("completed"), // pending {b,c} — deferred
+			taskNotification("b"),
+			taskNotification("c"), // pending now empty
+			assistant("all settled"),
+			result("completed"), // terminal
+		];
+		const spy = makeSpyEmitter();
+		await new ClaudeSessionManager().sendMessage(
+			"req-bg-2",
+			baseParams(),
+			spy.emitter,
+		);
+
+		expect(spy.ends).toBe(1);
+		expect(completedResultCount(spy)).toBe(1); // only the final completed
+		const notifs = spy.passthroughs.filter(
+			(m) => (m as { subtype?: string }).subtype === "task_notification",
+		);
+		expect(notifs).toHaveLength(3);
+	});
+
+	test("safe fallback: SDK ends the iterator before the notification arrives", async () => {
+		scenario = [
+			assistant("dispatching"),
+			taskStarted("bg1"),
+			result("completed"), // deferred; iterator then ends without a notification
+		];
+		const spy = makeSpyEmitter();
+		await new ClaudeSessionManager().sendMessage(
+			"req-bg-3",
+			baseParams(),
+			spy.emitter,
+		);
+
+		// Loop exits naturally → post-loop end fires once; no hang, no double end.
+		expect(spy.ends).toBe(1);
+		expect(completedResultCount(spy)).toBe(0); // deferred, never reached pipeline
+	});
+
+	test("error terminal is NOT deferred even with a bg task pending", async () => {
+		scenario = [
+			assistant("dispatching"),
+			taskStarted("bg1"),
+			result("max_turns"), // non-`completed` terminal — must end immediately
+		];
+		const spy = makeSpyEmitter();
+		await new ClaudeSessionManager().sendMessage(
+			"req-bg-4",
+			baseParams(),
+			spy.emitter,
+		);
+
+		expect(spy.ends).toBe(1);
+		const reasons = spy.passthroughs
+			.map((m) => (m as { terminal_reason?: string }).terminal_reason)
+			.filter(Boolean);
+		expect(reasons).toContain("max_turns"); // passed through, not deferred
+	});
+});
```

**File**: `sidecar/src/claude/session-manager.ts` (modified, +49/-0)
```diff
@@ -690,6 +690,13 @@ export class ClaudeSessionManager implements SessionManager {
 		try {
 			let lastRateLimitInfo: RateLimitOverageInfo | undefined;
 			let fastModeNoticeEmitted = false;
+			// In-flight `run_in_background` tasks (subagents / background Bash),
+			// keyed by task_id. They settle asynchronously via `task_notification`
+			// AFTER the agent ends its turn; closing the query on the turn's
+			// `completed` while any are still pending would `q.close()` the
+			// claude-code subprocess and kill them before they notify, so we keep
+			// draining the SAME query until they all settle (see deferral below).
+			const pendingBgTasks = new Set<string>();
 			for await (const message of q) {
 				// stopSession already emitted the terminal `aborted` and tore the
 				// session down. The new SDK keeps the child alive ~2s after abort,
@@ -744,6 +751,36 @@ export class ClaudeSessionManager implements SessionManager {
 					}
 					continue;
 				}
+				// Track in-flight background tasks (run_in_background subagents /
+				// Bash) by task_id: `task_started` opens one, `task_notification`
+				// settles it. These system events still pass through below.
+				if (message.type === "system") {
+					const subtype = (message as { subtype?: string }).subtype;
+					const taskId = (message as { task_id?: string }).task_id;
+					if (taskId) {
+						if (subtype === "task_started") pendingBgTasks.add(taskId);
+						else if (subtype === "task_notification")
+							pendingBgTasks.delete(taskId);
+					}
+				}
+				// A `completed` result while background tasks are still pending is
+				// NOT terminal: ending here closes the query and kills the
+				// in-flight subagents before they emit `task_notification`. Keep it
+				// OUT of the pipeline (one-result-per-turn) and keep draining the
+				// SAME query — mirror of the `background_requested` pause above.
+				// The final `completed` (pending drained) and any error terminal
+				// fall through to the terminal branch below.
+				if (isCompletedResult(message) && pendingBgTasks.size > 0) {
+					const meta = buildClaudeStoredMeta(message, model ?? "");
+					if (meta) {
+						emitter.contextUsageUpdated(
+							requestId,
+							sessionId,
+							JSON.stringify(meta),
+						);
+					}
+					continue;
+				}
 				// AskUserQuestion tool_use blocks pass through INTACT — the Rust
 				// adapter renders them as the persistent Q&A card (and merges
 				// the tool_result answers into it), so stripping them here
@@ -1315,6 +1352,18 @@ function isBackgroundPauseResult(message: SDKMessage): boolean {
 	);
 }
 
+/** A turn's natural `completed` result. While `run_in_background` tasks are
+ *  still pending it is filtered (like `background_requested`) so the query —
+ *  and the claude-code subprocess hosting the in-flight subagents — stays
+ *  alive until their `task_notification`s arrive. Only `completed` is
+ *  deferred; error / aborted terminals end the turn immediately. */
+function isCompletedResult(message: SDKMessage): boolean {
+	return (
+		message.type === "result" &&
+		(message as { terminal_reason?: string }).terminal_reason === "completed"
+	);
+}
+
 /** Terminal result — success OR error. Both shapes carry
  *  `usage`/`modelUsage`, so both should update the ring. AskUserQuestion
  *  pauses live inside `canUseTool` instead of producing a result event, and
```

---

### Incident Patch 15: `fe6108d1` (2026-06-24)
**Commit Message**: Fix: Handle background_requested pause results in Claude session manager (#897)

fix: handle background_requested pause results in Claude session manager

- Filter intermediate background_requested results to prevent premature turn termination
- Record usage for paused tasks but keep pause results out of the pipeline
- Add regression tests for backgrounded subagent resume flow (#891)

**File**: `.changeset/background-subagent-resume.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"helmor": patch
+---
+
+Fix Claude turns ending prematurely after a subagent is moved to the background — the main agent now stays paused and resumes once the background task completes.
```

**File**: `sidecar/src/claude/background-resume.test.ts` (added, +198/-0)
```diff
@@ -0,0 +1,198 @@
+/**
+ * Regression for issue #891: backgrounded subagents never resumed the main
+ * turn. The SDK signals a backgrounded task with an intermediate `result`
+ * whose `terminal_reason === "background_requested"`, keeps the SAME query()
+ * alive, then resumes via `task_notification` to a real terminal result.
+ *
+ * The old loop treated ANY `result` as terminal: it fired `end` on the pause
+ * and `q.close()` tore the session down, so the later `task_notification` was
+ * lost and the turn ended prematurely.
+ *
+ * Fix under test (`session-manager.ts`): a `background_requested` result is
+ * filtered before passthrough — usage is still recorded via
+ * `contextUsageUpdated`, but it never reaches the pipeline and never fires
+ * `end`. The loop keeps draining until the genuinely terminal result.
+ */
+
+import { beforeAll, describe, expect, mock, test } from "bun:test";
+import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
+import type { SendMessageParams } from "../session-manager.js";
+
+// The mocked query() returns whatever the active scenario holds. A single
+// mocked binding (resolved at session-manager import time) reads this mutable
+// outer variable so each test can swap the SDK message stream.
+let scenario: SDKMessage[] = [];
+
+function makeQuery(messages: SDKMessage[]) {
+	return {
+		async *[Symbol.asyncIterator]() {
+			for (const m of messages) yield m;
+		},
+		close() {},
+	};
+}
+
+mock.module("@anthropic-ai/claude-agent-sdk", () => ({
+	query: () => makeQuery(scenario),
+}));
+
+interface EmitterSpy {
+	passthroughs: object[];
+	contextUsageUpdates: number;
+	ends: number;
+	emitter: import("../emitter.js").SidecarEmitter;
+}
+
+function makeSpyEmitter(): EmitterSpy {
+	const spy: EmitterSpy = {
+		passthroughs: [],
+		contextUsageUpdates: 0,
+		ends: 0,
+		emitter: undefined as unknown as import("../emitter.js").SidecarEmitter,
+	};
+	// Proxy: record the methods we assert on, no-op everything else so an
+	// incidental call (e.g. logging) can't blow up the test.
+	spy.emitter = new Proxy(
+		{},
+		{
+			get(_t, prop) {
+				if (prop === "passthrough") {
+					return (_id: string, message: object) =>
+						spy.passthroughs.push(message);
+				}
+				if (prop === "contextUsageUpdated") {
+					return () => {
+						spy.contextUsageUpdates += 1;
+					};
+				}
+				if (prop === "end") {
+					return () => {
+						spy.ends += 1;
+					};
+				}
+				return () => undefined;
+			},
+		},
+	) as import("../emitter.js").SidecarEmitter;
+	return spy;
+}
+
+const MODEL = "claude-test";
+// Shape buildClaudeStoredMeta needs to return non-null so the pause records usage.
+const USAGE = { input_tokens: 1000, output_tokens: 500 };
+const MODEL_USAGE = { [MODEL]: { contextWindow: 200_000 } };
+
+function assistant(text: string): SDKMessage {
+	return {
+		type: "assistant",
+		message: { role: "assistant", content: [{ type: "text", text }] },
+		parent_tool_use_id: null,
+		session_id: "s1",
+		uuid: `a-${text}`,
+	} as unknown as SDKMessage;
+}
+
+function result(terminalReason: string): SDKMessage {
+	return {
+		type: "result",
+		subtype: "success",
+		result: terminalReason,
+		terminal_reason: terminalReason,
+		usage: USAGE,
+		modelUsage: MODEL_USAGE,
+		session_id: "s1",
+		uuid: `r-${terminalReason}`,
+	} as unknown as SDKMessage;
+}
+
+function taskNotification(): SDKMessage {
+	return {
+		type: "system",
+		subtype: "task_notification",
+		task_id: "t1",
+		status: "completed",
+		output_file: "",
+		summary: "done",
+		session_id: "s1",
+		uuid: "tn-1",
+	} as unknown as SDKMessage;
+}
+
+function baseParams(): SendMessageParams {
+	return {
+		sessionId: "s1",
+		prompt: "research X in the background then synthesize",
+		model: MODEL,
+		cwd: undefined,
+		resume: undefined,
+		permissionMode: "bypassPermissions",
+		effortLevel: undefined,
+		fastMode: undefined,
+	} as SendMessageParams;
+}
+
+let ClaudeSessionManager: typeof import("./session-manager.js").ClaudeSessionManager;
+
+beforeAll(async () => {
+	({ ClaudeSessionManager } = await import("./session-manager.js"));
+});
+
+describe("ClaudeSessionManager backgrounded-task resume (#891)", () => {
+	test("filters the pause result, resumes, and ends exactly once", async () => {
+		scenario = [
+			assistant("starting"),
+			result("background_requested"),
+			taskNotification(),
+			assistant("synthesizing"),
+			result("completed"),
+		];
+		const spy = makeSpyEmitter();
+		const manager = new ClaudeSessionManager();
+
+		await manager.sendMessage("req-1", baseParams(), spy.emitter);
+
+		// Exactly one terminal end — NOT one per result.
+		expect(spy.ends).toBe(1);
+
+		// The pause result is never passed into the pipeline.
+		const passedReasons = spy.passthroughs
+			.map((m) => (m as { terminal_reason?: string }).terminal_reason)
+			.filter(Boolean);
+		expect(passedReasons).not.toContain("background_requested");
+		expect(passedReasons).toContain("completed");
+
+		// Continuation flow
```

**File**: `sidecar/src/claude/session-manager.ts` (modified, +35/-6)
```diff
@@ -165,10 +165,10 @@ interface LiveSession {
 	 * Streaming-input source. The initial prompt is pushed up front in
 	 * `sendMessage`; each `steer()` call pushes one more user message.
 	 * The SDK folds every pushed message into ONE extended turn and
-	 * emits a SINGLE terminal `result` when the whole trajectory is
-	 * done — verified empirically (steer mid-stream yields one merged
-	 * assistant message and one result, not per-push results). The
-	 * for-await loop therefore bails on the first result it sees.
+	 * emits a SINGLE *terminal* `result` when the whole trajectory is
+	 * done. Backgrounded tasks add intermediate `background_requested`
+	 * results mid-turn (filtered out, see `isBackgroundPauseResult`), so
+	 * the for-await loop bails on the first *genuinely terminal* result.
 	 */
 	readonly promptSource: Pushable<SDKUserMessage>;
 	/** Request id owning this session; needed by `steer()` to synthesize
@@ -728,6 +728,22 @@ export class ClaudeSessionManager implements SessionManager {
 						uuid: randomUUID(),
 					});
 				}
+				// Backgrounded task pause: SDK keeps the SAME query() alive and
+				// resumes later via task_notification. Record usage, but keep the
+				// pause result OUT of the pipeline (accumulator assumes one result
+				// per turn) and do NOT end the turn — must intercept before the
+				// unconditional passthrough below.
+				if (isBackgroundPauseResult(message)) {
+					const meta = buildClaudeStoredMeta(message, model ?? "");
+					if (meta) {
+						emitter.contextUsageUpdated(
+							requestId,
+							sessionId,
+							JSON.stringify(meta),
+						);
+					}
+					continue;
+				}
 				// AskUserQuestion tool_use blocks pass through INTACT — the Rust
 				// adapter renders them as the persistent Q&A card (and merges
 				// the tool_result answers into it), so stripping them here
@@ -1287,10 +1303,23 @@ function isResultMessage(
 	);
 }
 
+/** Intermediate `result` the SDK emits when a task is backgrounded — the
+ *  same `query()` stays alive and resumes via `task_notification`. NOT
+ *  terminal: must be filtered before passthrough so it never reaches the
+ *  accumulator (one-result-per-turn) and never fires `end`. */
+function isBackgroundPauseResult(message: SDKMessage): boolean {
+	return (
+		message.type === "result" &&
+		(message as { terminal_reason?: string }).terminal_reason ===
+			"background_requested"
+	);
+}
+
 /** Terminal result — success OR error. Both shapes carry
  *  `usage`/`modelUsage`, so both should update the ring. AskUserQuestion
- *  pauses live inside `canUseTool` instead of producing a result event,
- *  so any `result` we see here is genuinely terminal for this turn. */
+ *  pauses live inside `canUseTool` instead of producing a result event, and
+ *  `background_requested` pauses are filtered upstream, so any `result` that
+ *  reaches this check is genuinely terminal for this turn. */
 function isTerminalResult(message: SDKMessage): boolean {
 	return message.type === "result";
 }
```

#### Recent Merged Pull Requests:
- **PR #949** (closed): feat(local-llm): show the running local model in the composer picker (@daniel-mf28)
- **PR #947** (closed): Add knos to .mcp.json so agents share one decision record (@drexthealpha)
- **PR #944** (2026-07-24): chore(deps): bump bundled agents to latest + add Claude Opus 5 (@dohooo)
- **PR #943** (2026-07-24): chore(release): version packages (@dohooo)
- **PR #940** (2026-07-24): chore(deps): bump bundled agents to latest (@dohooo)
- **PR #939** (2026-07-24): feat(inspector): let run scripts declare their Open menu URL (@dalkommatt)
- **PR #938** (2026-07-17): chore(release): version packages (@dohooo)
- **PR #937** (2026-07-17): fix: sign Codex code-mode host with JIT entitlements (@dohooo)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
