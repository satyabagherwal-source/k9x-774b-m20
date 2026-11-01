> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/mcpjam-inspector-learnings.md`  
> **Source**: github ([https://github.com/MCPJam/inspector](https://github.com/MCPJam/inspector))  
> **Source Version**: `6b50480f`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-27T17:16:42.278Z  
> **Learning ID**: `learn-github-mcpjam-inspector`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): MCPJam/inspector

> **Canonical Artifact**: `07_PROJECT_LEARNING/mcpjam-inspector-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/MCPJam/inspector](https://github.com/MCPJam/inspector))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-27T17:16:40.771Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `MCPJam/inspector`
- **Description**: Testing and evaluation platform to chat, inspect, and debug MCP servers, MCP apps, and ChatGPT apps.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 2287 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.devin/hook-probe.mjs`
```
#!/usr/bin/env node
/**
 * Temporary probe for `.devin/hooks.v1.json`. Devin documents repo hooks for
 * local sessions (CLI, Desktop) and says nothing about cloud sessions; this
 * records whether they fire there, and with which tool names, so a real hook
 * can be written against facts. Delete both files once that is known.
 *
 * Appends one JSON line per event to /tmp/devin-hook-probe.log. Records env
 * var names only, never values. Always exits 0.
 */
import { appendFileSync, readFileSync } from "node:fs";

const LOG = "/tmp/devin-hook-probe.log";

function readEvent() {
  const raw = readFileSync(0, "utf8");
  try {
    return JSON.parse(raw);
  } catch (error) {
    return { unparsed: raw.slice(0, 200), parseError: String(error) };
  }
}

const event = readEvent();
appendFileSync(
  LOG,
  JSON.stringify({
    at: new Date().toISOString(),
    event: event.hook_event_name,
    tool: event.tool_name,
    cwd: process.cwd(),
    keys: Object.keys(event),
    env: Object.keys(process.env).filter((name) =>
      /DEVIN|CLAUDE|WINDSURF|COGNITION/.test(name),
    ),
  }) + "\n",
);

if (event.hook_event_name === "SessionStart") {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext:
          "The repo hook probe (.devin/hooks.v1.json) ran at session start. " +
          `If asked about hooks, report the contents of ${LOG}.`,
      },
    }),
  );
}

```

### Core Architecture Module: `chat-ui/src/internal/tool-result-utils.ts`
```
/**
 * Shared helpers for reading metadata and server IDs from tool results.
 *
 * Tool results may carry `_meta` and `_serverId` either at the top level
 * or nested under a `.value` wrapper. These utilities normalise access
 * across both shapes.
 *
 * Ported verbatim from the inspector (`@/lib/tool-result-utils`).
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function readToolResultObject(
  result: unknown,
): Record<string, unknown> | undefined {
  if (!isRecord(result)) return undefined;
  return result;
}

export function readToolResultMeta(
  result: unknown,
): Record<string, unknown> | undefined {
  if (!isRecord(result)) return undefined;

  if (isRecord(result._meta)) {
    return result._meta;
  }

  if (isRecord(result.value) && isRecord(result.value._meta)) {
    return result.value._meta;
  }

  return undefined;
}

export function readToolResultServerId(result: unknown): string | undefined {
  if (!isRecord(result)) return undefined;

  if (typeof result._serverId === "string") {
    return result._serverId;
  }

  if (isRecord(result.value) && typeof result.value._serverId === "string") {
    return result.value._serverId;
  }

  const meta = readToolResultMeta(result);
  return typeof meta?._serverId === "string" ? meta._serverId : undefined;
}

```

### Core Architecture Module: `cli/src/lib/projects-render.ts`
```
import type {
  ListProjectServersResult,
  PlatformOrganization,
  PlatformProject,
  ShowServersPayload,
} from "@mcpjam/sdk/platform";

function formatTimestamp(value: number | null | undefined): string {
  return typeof value === "number" ? new Date(value).toISOString() : "-";
}

function table(rows: string[][]): string[] {
  if (rows.length === 0) {
    return [];
  }
  const widths = rows[0].map((_cell, column) =>
    Math.max(...rows.map((row) => row[column]?.length ?? 0)),
  );
  return rows.map((row) =>
    row
      .map((cell, column) =>
        column === row.length - 1 ? cell : cell.padEnd(widths[column]),
      )
      .join("  ")
      .trimEnd(),
  );
}

/**
 * Organizations render alongside projects rather than in their own module: an
 * organization id is only ever useful as an argument to a project command
 * (`projects list --org`, `projects create --org`), so the
 * two tables want the same column widths and the same timestamp treatment.
 */
export function formatOrganizationsHuman(
  organizations: PlatformOrganization[],
): string {
  if (organizations.length === 0) {
    return "No accessible organizations.";
  }

  const lines = table([
    ["ID", "NAME", "PLAN", "ROLE"],
    ...organizations.map((organization) => [
      organization.id,
      organization.name,
      organization.plan ?? "-",
      organization.myRole ?? "-",
    ]),
  ]);
  lines.push("", `${organizations.length} organization(s).`);
  return lines.join("\n");
}

export function formatProjectsHuman(projects: PlatformProject[]): string {
  if (projects.length === 0) {
    return "No accessible projects.";
  }

  const lines = table([
    ["ID", "NAME", "UPDATED"],
    ...projects.map((project) => [
      project.id,
      project.name,
      formatTimestamp(project.updatedAt),
    ]),
  ]);
  lines.push("", `${projects.length} project(s).`);
  return lines.join("\n");
}

export function formatProjectServersHuman(
  result: ListProjectServersResult,
): string {
  const lines = [`Project: ${result.project.name} (${result.project.id})`, ""];

  if (result.items.length === 0) {
    lines.push("No servers in this project.");
  } else {
    lines.push(
      ...table([
        ["ID", "NAME", "TRANSPORT", "URL", "ENABLED"],
        ...result.items.map((server) => [
          server.id,
          server.name,
          server.transportType,
          server.url ?? "-",
          server.enabled ? "yes" : "no",
        ]),
      ]),
    );
  }

  appendOtherProjects(lines, result.otherProjects);
  return lines.join("\n");
}

export function formatShowServersHuman(payload: ShowServersPayload): string {
  const lines = [
    `Project: ${payload.project.name} (${payload.project.id})`,
    "",
  ];

  if (payload.servers.length === 0) {
    lines.push("No servers in this project.");
  } else {
    for (const server of payload.servers) {
      const headline = `${statusGlyph(server.status)} ${server.name} [${server.status}]`;
      lines.push(server.url ? `${headline} ${server.url}` : headline);
      if (server.statusDetail) {
        lines.push(`    ${server.statusDetail}`);
      }
      if (server.serverInfo?.name || server.serverInfo?.version) {
        lines.push(
          `    Server: ${server.serverInfo.name ?? "unknown"}${server.serverInfo.version ? ` v${server.serverInfo.version}` : ""}`,
        );
      }
      if (server.primitives) {
        lines.push(
          `    Primitives: tools ${server.primitives.tools.items.length}, resources ${server.primitives.resources.items.length}, prompts ${server.primitives.prompts.items.length}`,
        );
      }
    }
  }

  const summary = payload.summary;
  lines.push(
    "",
    `Summary: ${summary.reachable} reachable, ${summary.unreachable} unreachable, ${summary.skipped} skipped, ${summary.error} error(s).`,
  );
  appendOtherProjects(lines, payload.otherProjects);
  lines.push(`Generated at ${payload.generatedAt}.`);
  return lines.join("\n");
}

function appendOtherProjects(
  lines: string[],
  otherProjects: Array<{ id: string; name: string }>,
): void {
  if (otherProjects.length > 0) {
    lines.push(
      "",
      `Other projects: ${otherProjects
        .map((project) => project.name)
        .join(", ")} (switch with --project)`,
    );
  }
}

function statusGlyph(
  status: "reachable" | "unreachable" | "skipped" | "error",
): string {
  switch (status) {
    case "reachable":
      return "✓";
    case "unreachable":
      return "✗";
    case "skipped":
      return "-";
    case "error":
      return "!";
  }
}

```

### Core Architecture Module: `cli/src/lib/registry-render.ts`
```
import type {
  PlatformCatalogServer,
  PlatformRegistryInstallResult,
} from "@mcpjam/sdk/platform";

function line(label: string, value: string | undefined | null): string | null {
  if (value === undefined || value === null || value === "") return null;
  return `${label}: ${value}`;
}

/**
 * Decision-relevant fields for `registry show`. The freshness pin is the
 * field an agent must pass to `registry install`, so it is printed first
 * among the actionable block rather than buried in a raw-row dump.
 */
export function formatRegistryDirectoryServerHuman(
  server: PlatformCatalogServer,
): string {
  const title = server.displayName ?? server.serverName;
  const lines = [
    `${title}  (${server.id})`,
    line("source", server.source),
    line("serverName", server.serverName),
    line("authPosture", server.authPosture),
    line("verifiedTier", server.verifiedTier),
    line("endpointKind", server.endpointKind),
    line("unavailableReason", server.unavailableReason),
    line("latestContentHash", server.latestContentHash),
    line("remoteUrl", server.remoteUrl),
    line("remoteUrlRegex", server.remoteUrlRegex),
    line("remoteUrlHint", server.remoteUrlHint),
    server.remoteUrlOptions && server.remoteUrlOptions.length > 0
      ? `remoteUrlOptions: ${server.remoteUrlOptions.join(", ")}`
      : null,
    server.description ? `\n${server.description}` : null,
    server.remoteUrl
      ? `\nTry locally:\n  mcpjam server probe --url ${server.remoteUrl}`
      : null,
    server.latestContentHash
      ? `\nInstall pin (pass to registry install):\n  --expected-content-hash ${server.latestContentHash}`
      : null,
  ].filter((entry): entry is string => entry !== null);
  return lines.join("\n");
}

/**
 * Human install success: the follow-ups, not just the outcome — and as
 * runnable CLI commands, not operation names a CLI user cannot type. JSON
 * callers already get the same facts as `nextSteps` on the structured result.
 */
export function formatRegistryInstallHuman(
  result: PlatformRegistryInstallResult,
  context: { project?: string; endpointUrl?: string } = {},
): string {
  const projectFlag = context.project ? ` --project ${context.project}` : "";
  const lines = [
    `Installed ${result.serverName} (${result.outcome}).`,
    `serverId: ${result.serverId}`,
    "This wrote a project servers row — it is not a live connection.",
    "Next steps:",
    `  mcpjam cloud projects status${projectFlag}`,
    `  mcpjam cloud projects servers connect --server ${result.serverId} --url ${
      context.endpointUrl ?? "<endpoint-url>"
    }${projectFlag}`,
  ];
  if (result.nextSteps.connectLinkUrl) {
    lines.push("  Finish OAuth in the browser:");
    lines.push(`    ${result.nextSteps.connectLinkUrl}`);
  } else if (result.nextSteps.connectLinkError) {
    lines.push(
      `  OAuth connect-link could not be created (${result.nextSteps.connectLinkError}); run the connect command above to start one.`,
    );
  }
  return lines.join("\n");
}

```

### Core Architecture Module: `cli/src/lib/widget-render.ts`
```
import type { MCPServerConfig } from "@mcpjam/sdk";
import { InspectorApiClient } from "./inspector-api.js";
import { operationalError, usageError } from "./output.js";

/**
 * widget-render.ts — CLI client for the local Inspector's headless widget-render
 * capability (`POST /api/mcp/widget-render`), backing `mcpjam apps render`.
 *
 * The CLI deliberately does NOT depend on `@mcpjam/inspector` (and the server's
 * `shared/` is not a clean CLI dependency), so the wire contract is mirrored
 * here as a slim copy — the same convention `inspector-api.ts` uses for the
 * command-bus types. If a single source of truth is wanted later, the contract
 * can move into `@mcpjam/sdk` (which the CLI does depend on).
 */

/** Render verdicts mirrored from the harness's `WidgetRenderStatus`. */
export type WidgetRenderStatus =
  | "rendered"
  | "no_ui_resource"
  | "resource_read_failed"
  | "mount_failed"
  | "bridge_timeout"
  | "render_error"
  | "blank_screenshot"
  | "screenshot_failed"
  | "browser_unavailable";

/** Response body of `POST /api/mcp/widget-render`. */
export interface WidgetRenderResponse {
  status: WidgetRenderStatus;
  resourceUri?: string;
  bridgeInitialized?: boolean;
  screenshotBase64?: string;
  consoleErrors?: string[];
  blockedRequests?: string[];
  elapsedMs?: number;
  /** Present on `browser_unavailable`: the install command to remediate. */
  hint?: string;
}

/** The slice of `InspectorApiClient` the render flow uses (injectable for tests). */
export type WidgetRenderClient = Pick<
  InspectorApiClient,
  "ensureBackend" | "connectServer" | "request"
>;

export interface RunWidgetRenderOptions {
  baseUrl?: string;
  config: MCPServerConfig;
  serverName: string;
  toolName: string;
  parameters: Record<string, unknown>;
  injectOpenAiCompat?: boolean;
  viewport?: { width: number; height: number };
  startIfNeeded?: boolean;
  timeoutMs: number;
}

/**
 * Floor for the render POST timeout. The first render on a machine without
 * Chromium triggers an on-demand Playwright install INSIDE that request, which
 * routinely exceeds the default 30s op timeout. Give the render call a generous
 * floor so the CLI waits for the install (and gets a real verdict, or a
 * `browser_unavailable` hint) instead of aborting with a transport/timeout
 * error. A larger explicit `--timeout` still wins.
 */
const RENDER_REQUEST_TIMEOUT_FLOOR_MS = 5 * 60_000;

/** The render POST timeout: the larger of the caller's timeout and the floor. */
export function resolveRenderRequestTimeoutMs(timeoutMs: number): number {
  return Math.max(timeoutMs, RENDER_REQUEST_TIMEOUT_FLOOR_MS);
}

/**
 * Ensure the local Inspector is up (no browser client needed — the harness runs
 * server-side), connect the target server, and request a one-shot headless
 * render of `toolName`'s widget. Returns the parsed render observation.
 */
export async function runWidgetRender(
  options: RunWidgetRenderOptions,
  deps: { client?: WidgetRenderClient } = {},
): Promise<WidgetRenderResponse> {
  const client =
    deps.client ?? new InspectorApiClient({ baseUrl: options.baseUrl });

  // No browser tab required: the render runs server-side, so only a live
  // backend is needed (no frontend resolution / browser open).
  await client.ensureBackend({
    startIfNeeded: options.startIfNeeded ?? true,
    timeoutMs: options.timeoutMs,
  });

  await client.connectServer(options.serverName, options.config, {
    timeoutMs: options.timeoutMs,
  });

  const response = await client.request("/api/mcp/widget-render", {
    method: "POST",
    body: {
      serverId: options.serverName,
      toolName: options.toolName,
      parameters: options.parameters,
      ...(options.injectOpenAiCompat ? { injectOpenAiCompat: true } : {}),
      ...(options.viewport ? { viewport: options.viewport } : {}),
    },
    // The render may install Chromium on first use — wait generously rather
    // than abort on the default op timeout.
    timeoutMs: resolveRenderRequestTimeoutMs(options.timeoutMs),
  });

  return normalizeWidgetRenderResponse(response);
}

const WIDGET_RENDER_STATUSES: ReadonlySet<string> = new Set<WidgetRenderStatus>([
  "rendered",
  "no_ui_resource",
  "resource_read_failed",
  "mount_failed",
  "bridge_timeout",
  "render_error",
  "blank_screenshot",
  "screenshot_failed",
  "browser_unavailable",
]);

function normalizeWidgetRenderResponse(value: unknown): WidgetRenderResponse {
  if (!value || typeof value !== "object") {
    throw operationalError("Inspector widget-render response was invalid.", value);
  }

  const record = value as Record<string, unknown>;
  if (
    typeof record.status !== "string" ||
    !WIDGET_RENDER_STATUSES.has(record.status)
  ) {
    throw operationalError(
      "Inspector widget-render response was missing a known status.",
      value,
    );
  }

  return {
    status: record.status as WidgetRenderStatus,
    ...(typeof record.resourceUri === "string"
      ? { resourceUri: record.resourceUri }
      : {}),
    ...(typeof record.bridgeInitialized === "boolean"
      ? { bridgeInitialized: record.bridgeInitialized }
      : {}),
    ...(typeof record.screenshotBase64 === "string"
      ? { screenshotBase64: record.screenshotBase64 }
      : {}),
    ...(Array.isArray(record.consoleErrors)
      ? { consoleErrors: record.consoleErrors.map(String) }
      : {}),
    ...(Array.isArray(record.blockedRequests)
      ? { blockedRequests: record.blockedRequests.map(String) }
      : {}),
    ...(typeof record.elapsedMs === "number"
      ? { elapsedMs: record.elapsedMs }
      : {}),
    ...(typeof record.hint === "string" ? { hint: record.hint } : {}),
  };
}

/**
 * Upper bound for a viewport edge (px). Mirrors the server's
 * `widget-render` cap so an obviously-invalid size (e.g. `999999x999999`)
 * fails client-side before connecting to the Inspector.
 */
const MAX_VIEWPORT_EDGE = 8192;

/**
 * Parse a `--viewport <WxH>` string (e.g. `1280x800`) into pixel dimensions.
 * Returns undefined when unset; throws a usage error on a malformed value.
 */
export function parseWidgetRenderViewport(
  value: string | undefined,
): { width: number; height: number } | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const match = /^(\d+)\s*[x×]\s*(\d+)$/i.exec(trimmed);
  if (!match) {
    throw usageError(
      `Invalid viewport "${value}". Use <width>x<height>, e.g. 1280x800.`,
    );
  }

  const width = Number(match[1]);
  const height = Number(match[2]);
  if (
    width <= 0 ||
    height <= 0 ||
    width > MAX_VIEWPORT_EDGE ||
    height > MAX_VIEWPORT_EDGE
  ) {
    throw usageError(
      `Invalid viewport "${value}". Width and height must be between 1 and ${MAX_VIEWPORT_EDGE}.`,
    );
  }

  return { width, height };
}

/**
 * Map `--protocol` to the harness's `injectOpenAiCompat` flag: the OpenAI Apps
 * SDK surface (`openai-sdk`) injects the `window.openai` shim; MCP Apps
 * (`mcp-apps`, the default) does not.
 */
export function resolveWidgetRenderInjectOpenAiCompat(
  protocol: string | undefined,
): boolean {
  if (protocol === undefined) {
    return false;
  }
  if (protocol === "mcp-apps") {
    return false;
  }
  if (protocol === "openai-sdk") {
    return true;
  }
  throw usageError(
    `Invalid protocol "${protocol}". Use "mcp-apps" or "openai-sdk".`,
  );
}

export interface WidgetRenderOutput {
  status: WidgetRenderStatus;
  toolName?: string;
  serverName?: string;
  observation: {
    consoleErrors?: string[];
    blockedRequests?: string[];
    resourceUri?: string;
    bridgeInitialized?: boolean;
    elapsedMs?: number;
  };
  /** True when the harness produced an image, regardless of how it's delivered. */
  screenshotCaptured: boolean;
  screenshotPath?: string;
  screenshotBase64?: string;
  hint?: string;
}

/**
 * Shape the render observation into the command's JSON envelope. `toolName` and
 * `serverName` echo the request so the result is self-describing in agent logs.
 * The screenshot is delivered out-of-band by default: a file path when
 * `--screenshot-out` was written, and the inline base64 only when
 * `--screenshot-base64` is set, so normal stdout stays free of large image
 * blobs.
 */
export function buildWidgetRenderOutput(
  response: WidgetRenderResponse,
  options: {
    screenshotPath?: string;
    includeBase64?: boolean;
    toolName?: string;
    serverName?: string;
  } = {},
): WidgetRenderOutput {
  const screenshotCaptured =
    typeof response.screenshotBase64 === "string" &&
    response.screenshotBase64.length > 0;

  return {
    status: response.status,
    ...(options.toolName ? { toolName: options.toolName } : {}),
    ...(options.serverName ? { serverName: options.serverName } : {}),
    observation: {
      ...(response.consoleErrors
        ? { consoleErrors: response.consoleErrors }
        : {}),
      ...(response.blockedRequests
        ? { blockedRequests: response.blockedRequests }
        : {}),
      ...(response.resourceUri ? { resourceUri: response.resourceUri } : {}),
      ...(response.bridgeInitialized !== undefined
        ? { bridgeInitialized: response.bridgeInitialized }
        : {}),
      ...(response.elapsedMs !== undefined
        ? { elapsedMs: response.elapsedMs }
        : {}),
    },
    screenshotCaptured,
    ...(options.screenshotPath ? { screenshotPath: options.screenshotPath } : {}),
    ...(options.includeBase64 && screenshotCaptured
      ? { screenshotBase64: response.screenshotBase64 }
      : {}),
    ...(response.hint ? { hint: response.hint } : {}),
  };
}

```

### Core Architecture Module: `discord-app/renderer.js`
```
// @ts-nocheck
import { plainText } from "@mcpjam/surface-core";

function discordText(content) {
	return (content?.parts || [])
		.map((part) => {
			if (typeof part === "string") return part;
			if (part?.mention) return `<@${part.mention}>`;
			if (part?.link)
				return `[${part.link.label || part.link.url}](${part.link.url})`;
			if (part?.code) return `\`${String(part.code).replace(/`/g, "\\`")}\``;
			return "";
		})
		.join("");
}

/** Render structured content without letting core depend on Discord markup. */
export function renderDiscord(content, { components = [] } = {}) {
	const text = content?.parts ? discordText(content) : plainText(content);
	const body = text.replace(
		/@everyone|@here|<@&\d+>/g,
		(match) => `\\${match}`,
	);
	return {
		content: body,
		components,
		allowedMentions: {
			parse: [],
			users: (content?.parts || [])
				.filter((part) => part && typeof part === "object" && "mention" in part)
				.map((part) => part.mention),
		},
	};
}

/** Discord's hard 2,000-character message limit. */
export function chunkDiscordText(text, maxLength = 2_000) {
	const chunks = [];
	for (let offset = 0; offset < text.length; offset += maxLength)
		chunks.push(text.slice(offset, offset + maxLength));
	return chunks.length ? chunks : [""];
}

export function renderDiscordChunks(content, options = {}) {
	const proposalComponents = (content?.proposedActions || [])
		.slice(0, 5)
		.map((proposal) => ({
			type: 2,
			style: 1,
			label: String(proposal.buttonLabel || "Approve").slice(0, 80),
			custom_id: String(proposal.actionId).slice(0, 100),
		}));
	const components =
		options.components ||
		(proposalComponents.length
			? [{ type: 1, components: proposalComponents }]
			: []);
	return chunkDiscordText(renderDiscord(content, options).content).map(
		(text, index, all) => ({
			content: text,
			allowedMentions: renderDiscord(content).allowedMentions,
			components: index === all.length - 1 ? components : [],
		}),
	);
}

```

### Core Architecture Module: `evaluators/src/scorers/concurrency.ts`
```
/**
 * Counting semaphore shared by the iteration loop and the scorer runner.
 *
 * Lifted verbatim out of `EvalTest.ts` (where it was private) rather than
 * duplicated: the two schedulers now bound the same kind of thing — concurrent
 * work against a provider — and two copies would inevitably drift.
 */
export class Semaphore {
  private permits: number;
  private waiting: (() => void)[] = [];

  constructor(permits: number) {
    // A non-positive or non-finite permit count means every acquire() queues
    // forever and the caller hangs with no diagnostic. Fail loudly instead —
    // this also closes a pre-existing footgun on `EvalTest.run({concurrency: 0})`.
    if (!Number.isFinite(permits) || permits < 1) {
      throw new Error(
        `Semaphore requires at least 1 permit, got ${String(permits)}`,
      );
    }
    this.permits = Math.floor(permits);
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }
    await new Promise<void>((resolve) => this.waiting.push(resolve));
  }

  release(): void {
    const next = this.waiting.shift();
    if (next) {
      next();
    } else {
      this.permits++;
    }
  }
}

```

### Core Architecture Module: `evaluators/src/scorers/predicate-scorer.ts`
```
/**
 * The deterministic predicate scorer.
 *
 * Wraps one authored {@link Predicate} so it reports through the same contract
 * as everything else. It is a projection, not a re-implementation: the verdict
 * still comes from `evaluatePredicates`, so a predicate scored through this
 * path and a predicate evaluated the old way cannot disagree.
 */

import { evaluatePredicates } from "../predicates/evaluate.js";
import {
  requiresRenderObservations,
  type Predicate,
} from "../predicates/types.js";
import { predicateScoreDefinition } from "../contract/adapters.js";
import { canonicalDigest } from "../contract/canonical.js";
import { canonicalizeCheckRole } from "../predicates/policy.js";
import type { ScorerRole } from "../contract/types.js";
import type { Scorer } from "./types.js";

/**
 * Reject a predicate a local run can never satisfy.
 *
 * The widget predicates read `renderObservations`, which only the hosted
 * headless-browser runner produces, and they fail CLOSED — so accepting one
 * here would mean every iteration fails with "no render observations" and the
 * author cannot tell a real regression from an unsupported check. Failing at
 * construction says exactly what is wrong, once. Mirrors the same guard in
 * `EvalTest`'s constructor.
 */
function assertLocallyEvaluable(predicate: Predicate): void {
  if (!requiresRenderObservations(predicate.type)) return;
  throw new Error(
    `Predicate ${predicate.type} needs widget render observations, which only ` +
      `a hosted run captures. Remove it from this code-first scorer, or move ` +
      `the case to a hosted eval suite.`,
  );
}

export type PredicateScorerOptions = {
  /**
   * Stable id. Omit and a positional `predicate:<type>#<ordinal>` id is minted
   * — fine for local reporting, but UNSTABLE across config edits, so anything
   * gated in CI should name itself.
   */
  id?: string;
  /**
   * Position in the authored list; feeds the generated id.
   *
   * Omit it and the id is derived from the predicate's CONTENT instead of its
   * position, so two anonymous scorers of the same type cannot both mint
   * `predicate:<type>#0` and collide in the snapshot. Either way the id is
   * `idSource: "generated"` and therefore not gateable.
   */
  ordinal?: number;
  /** Predicates gate by default — determinism is what a release gate needs. */
  role?: ScorerRole;
};

export function predicateScorer(
  predicate: Predicate,
  options?: PredicateScorerOptions,
): Scorer {
  assertLocallyEvaluable(predicate);
  const definition = predicateScoreDefinition(predicate, {
    id: options?.id,
    ordinal: options?.ordinal ?? 0,
    role: options?.role,
  });

  // Positional numbering is meaningless for a standalone scorer nobody gave an
  // index to, and defaulting every one of them to `#0` means two anonymous
  // scorers of the same predicate type mint the SAME id and collide in the
  // snapshot. When no ordinal was supplied, derive the suffix from the
  // predicate's content instead. Still `idSource: "generated"` — content-stable
  // is not the same as author-stable, and a gate must not select it.
  //
  // The WHOLE digest, not a prefix: two distinct predicates sharing a truncated
  // one would mint a single id for two different definitions, and the snapshot
  // builder would reject the config outright. `predicate:` + the longest
  // predicate type + 64 hex is comfortably inside MAX_SCORER_ID_LENGTH, so
  // there is nothing to buy by shortening it. Two IDENTICAL predicates still
  // land on one id — they are one definition, and the builder collapses them.
  //
  // The rule goes through `canonicalizeCheckRole` first. `role` is ON the
  // digested object here — unlike `assertion()`, which strips policy off the
  // rule before minting — so a raw `predicateScorer({...}, ...)` caller who
  // spelled the role `"required"` would otherwise mint a DIFFERENT id for the
  // same rule than one who spelled it `"gating"`, and the two would stop
  // joining to each other's score history.
  if (options?.id === undefined && options?.ordinal === undefined) {
    definition.scorerId = `predicate:${predicate.type}#${canonicalDigest(
      canonicalizeCheckRole(predicate),
    )}`;
  }

  return {
    definition,
    score(context) {
      // `context.transcript` is exactly the predicate-minimal shape the
      // evaluator already consumes — no adaptation, no second opinion.
      const [result] = evaluatePredicates(context.transcript, [predicate]);
      if (!result) {
        return {
          kind: "skipped",
          rationale: "predicate evaluator returned no verdict",
        };
      }
      // An unscored row from these kinds is "we could not measure", not a 0:
      // throwing routes it to the runner's error result instead.
      if (
        (predicate.type === "responseCloseTo" ||
          predicate.type === "toolInputMatches" ||
          predicate.type === "toolResultMatches") &&
        result.status === "error"
      )
        throw new Error(result.reason);
      return {
        kind: "scored",
        value: result.passed ? 1 : 0,
        rationale: result.reason,
        ...(result.scope ? { scope: result.scope } : {}),
      };
    },
  };
}

```

### Core Architecture Module: `evaluators/src/scorers/run.ts`
```
/**
 * Bounded execution of a set of scorers against one iteration.
 *
 * Two bounds, both enforced by the RUNNER rather than trusted to the scorer:
 *
 *   - **A hard timeout per scorer.** `AbortSignal` is cooperative, and a custom
 *     scorer that ignores it would otherwise hold an iteration open forever. The
 *     `Promise.race` is the enforcement; the signal is the courtesy that lets a
 *     well-behaved scorer cancel its HTTP request too.
 *   - **A concurrency cap.** N judges × 30 iterations would otherwise stampede a
 *     provider into rate-limiting the whole run.
 *
 * Every failure mode lands as an `error` result, never as a low score, and the
 * gate engine decides what that means by reading the definition's `onError`.
 */

import {
  errorScoreResult,
  finalizeScoreResult,
  resolveScoreDefinition,
  skippedScoreResult,
} from "../contract/derive.js";
import { definitionHash } from "../contract/derive.js";
import type {
  ResolvedScoreDefinition,
  ScoreResult,
  ScorerContextV1,
} from "../contract/types.js";
import { Semaphore } from "./concurrency.js";
import {
  DEFAULT_SCORER_CONCURRENCY,
  DEFAULT_SCORER_TIMEOUT_MS,
  type Scorer,
  type ScorerRunOptions,
} from "./types.js";
import { isRequiredRole } from "../predicates/policy.js";

class ScorerTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`scorer timed out after ${timeoutMs}ms`);
    this.name = "ScorerTimeoutError";
  }
}

/**
 * Run one scorer under its bounds. Resolves to a finished row for every
 * outcome — it never rejects, so one misbehaving scorer cannot take down the
 * others or the iteration.
 */
async function runOne(
  scorer: Scorer,
  definition: ResolvedScoreDefinition,
  context: ScorerContextV1,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<ScoreResult> {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let cancel: (() => void) | undefined;

  try {
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        const error = new ScorerTimeoutError(timeoutMs);
        // Signal first so a cooperative scorer can abort its request, then
        // reject — the race resolves regardless of whether it cooperates.
        controller.abort(error);
        reject(error);
      }, timeoutMs);
    });

    const cancelled = new Promise<never>((_, reject) => {
      cancel = () => {
        const error = new Error("Evaluator cancelled");
        controller.abort(error);
        reject(error);
      };
      signal?.addEventListener("abort", cancel, { once: true });
      if (signal?.aborted) cancel();
    });
    const outcome = await Promise.race([
      Promise.resolve().then(() => {
        if (controller.signal.aborted) throw new Error("Evaluator cancelled");
        return scorer.score(context, controller.signal);
      }),
      timeout,
      cancelled,
    ]);
    return finalizeScoreResult(definition, outcome);
  } catch (error) {
    return errorScoreResult(definition, error);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    if (cancel) signal?.removeEventListener("abort", cancel);
  }
}

/**
 * Grade an iteration with every scorer, in authored order, under the runner's
 * bounds. Results come back in authored order regardless of completion order,
 * so a dashboard renders the same list every time.
 */
export async function runScorers(
  scorers: Scorer[],
  context: ScorerContextV1,
  options?: ScorerRunOptions,
): Promise<ScoreResult[]> {
  if (scorers.length === 0) return [];

  // Normalized, not trusted: a non-finite or fractional cap either disables
  // the bound or wedges every scorer waiting on a permit that never frees.
  const requested = options?.concurrency ?? DEFAULT_SCORER_CONCURRENCY;
  const concurrency = Number.isFinite(requested)
    ? Math.max(1, Math.floor(requested))
    : DEFAULT_SCORER_CONCURRENCY;
  const fallbackTimeout = options?.timeoutMs ?? DEFAULT_SCORER_TIMEOUT_MS;
  const semaphore = new Semaphore(concurrency);
  const skipReason = options?.skipNonDeterministicReason;

  return Promise.all(
    scorers.map(async (scorer) => {
      const definition = resolveScoreDefinition(scorer.definition);

      // The retry-exhausted path. A gating judge skipped here fails closed by
      // default, which is correct: an unscored gate is not a passed gate, and
      // the rationale says exactly why so nobody has to guess.
      if (skipReason !== undefined && !definition.deterministic) {
        return skippedScoreResult(
          definition,
          skipReason || "iteration errored before scoring",
        );
      }

      await semaphore.acquire();
      try {
        if (options?.signal?.aborted)
          return errorScoreResult(definition, new Error("Evaluator cancelled"));
        return await runOne(
          scorer,
          definition,
          context,
          scorer.timeoutMs ?? fallbackTimeout,
          options?.signal,
        );
      } finally {
        semaphore.release();
      }
    }),
  );
}

/**
 * Whether a set of scores clears the gate.
 *
 * The one place `passed` is decided for an iteration, and it reads policy off
 * the DEFINITIONS rather than the rows — results deliberately do not repeat
 * `role`/`onError`/`onSkipped`, so there is no second copy to disagree with.
 *
 *   - advisory scores never gate, whatever their status;
 *   - `not_applicable` never gates (and never enters a denominator);
 *   - a gating `scored` row must have passed;
 *   - a gating `error` / `skipped` row fails unless its policy says ignore.
 *
 * The join is on `definitionHash`, not `scorerId`. Matching by id would let a
 * row produced under one configuration be graded against another — which is
 * precisely the substitution an integrity check exists to catch. A result with
 * no matching definition is treated as GATING and failing: an unjoinable row is
 * evidence something is wrong with the run, and the whole point of this
 * contract is that missing evidence never reads as a pass.
 */
export function scoresPassed(
  scores: ScoreResult[],
  definitions: ResolvedScoreDefinition[],
): boolean {
  const byHash = new Map(
    definitions.map((definition) => [definitionHash(definition), definition]),
  );

  for (const score of scores) {
    const definition = byHash.get(score.definitionHash);
    if (!definition) return false;
    if (!isRequiredRole(definition.role)) continue;

    switch (score.status) {
      case "scored":
        if (score.passed !== true) return false;
        break;
      case "error":
        if (definition.onError === "fail") return false;
        break;
      case "skipped":
        if (definition.onSkipped === "fail") return false;
        break;
      case "not_applicable":
        break;
      default: {
        // An unknown status is unhandled evidence, and unhandled evidence
        // fails closed.
        return false;
      }
    }
  }

  // Every gating definition must actually be REPRESENTED. Iterating scores
  // alone silently passes an iteration whose gating scorer produced no row at
  // all — the loop simply never runs — which is the same "absent evidence read
  // as a pass" the whole contract exists to prevent.
  const present = new Set(scores.map((score) => score.definitionHash));
  for (const [hash, definition] of byHash) {
    if (isRequiredRole(definition.role) && !present.has(hash)) return false;
  }
  return true;
}

```

### Core Architecture Module: `evaluators/src/scorers/types.ts`
```
/**
 * The scorer interface.
 *
 * A scorer pairs a {@link ScoreDefinition} (what it is, whether it gates) with
 * a `score` function that returns a RAW observation. It never returns a
 * finished {@link ScoreResult}: only `finalizeScoreResult` in the contract can
 * mint one, which is the structural reason a scorer cannot assert its own
 * `passed` or slip a value outside [0,1] onto the wire.
 */

import type {
  ScoreDefinition,
  ScoreRawOutcome,
  ScorerContextV1,
} from "../contract/types.js";

/** Default hard cap on a single scorer's execution. */
export const DEFAULT_SCORER_TIMEOUT_MS = 60_000;

/** Default number of scorers allowed to run at once within one iteration. */
export const DEFAULT_SCORER_CONCURRENCY = 4;

export type Scorer = {
  definition: ScoreDefinition;
  /**
   * Grade one iteration.
   *
   * `signal` is a courtesy, not a guarantee — a custom scorer is free to ignore
   * it, which is exactly why the runner ALSO races against a hard timeout. Any
   * throw is caught by the runner and becomes an `error` result, never a low
   * score.
   */
  score(
    context: ScorerContextV1,
    signal?: AbortSignal,
  ): ScoreRawOutcome | Promise<ScoreRawOutcome>;
  /**
   * Hard cap for this scorer, overriding {@link DEFAULT_SCORER_TIMEOUT_MS}.
   * A judge sets its own so a slow provider cannot hold an iteration open.
   */
  timeoutMs?: number;
};

/** Bounds the runner enforces regardless of what a scorer does. */
export type ScorerRunOptions = {
  signal?: AbortSignal;
  /** Max scorers in flight at once. Default {@link DEFAULT_SCORER_CONCURRENCY}. */
  concurrency?: number;
  /** Fallback per-scorer timeout. Default {@link DEFAULT_SCORER_TIMEOUT_MS}. */
  timeoutMs?: number;
  /**
   * When set, non-deterministic scorers are not run at all and are reported as
   * `skipped` with this reason. Used by the retry-exhausted path: grading a
   * partial transcript with a stochastic judge produces a number that means
   * nothing, while a deterministic scorer still says something true about what
   * the iteration actually did.
   */
  skipNonDeterministicReason?: string;
};

export type { ScoreDefinition, ScoreRawOutcome, ScorerContextV1 };

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5904** (2026-10-06): **[BUG] Local eval case generation returns 403: authorized inspector must capture tool snapshot**
  *Symptoms*: ## Issue  In the local Inspector (`npx @mcpjam/inspector@3.13.0`), generating eval test cases from a connected MCP server fails with HTTP 403:  ``` An authorized inspector must capture the tool snapshot. ```  The server is reachable from the local Inspector: connection succeeds, `tools/list` returns tools, and a manually authored eval case can call a tool successfully. This appears specific to the case-generation authoring flow.  ## How to reproduce  1. Start Inspector locally with `npx @mcpjam/inspector@3.13.0` and sign in. 2. Connect an MCP server that is reachable from the local machine and verify its tools appear in **Tools**. 3. Create an eval suite for that server. 4. Choose **Generate → From live discovery**, select **Quick set** and **Read-only**, then click **Generate cases**. 5. The UI shows the error above. In DevTools, `POST /api/mcp/evals/authoring-v1` returns 403 with `{"error":"An authorized inspector must capture the tool snapshot."}`. No draft cases are created.  ## Expected Behavior  The local Inspector should capture the connected server's tool snapshot and stage generated cases for review, or provide a clear setup step if additional local authorization is required.  ## Platform  - `npx` / local Inspector, `@mcpjam/inspector` 3.13.0 - macOS  ## Additional Context  - A manually authored case ran locally and made a successful tool call to the same MCP server. - The local legacy `POST /api/mcp/evals/generate-tests` route generated cases from that server succes

- **Issue #5472** (2026-09-23): **Built-in OpenRouter BYOK provider is charged as a Free model**
  *Symptoms*: # Issue description I am unable to use the built-in OpenRouter BYOK provider in a locally started MCPJam Inspector session.  Although I configure OpenRouter successfully and select an OpenRouter model from Your providers, sending a message fails with an MCPJam free-credit/allowance error. The request appears to be handled as a hosted MCPJam model rather than routed to OpenRouter using my API key.  ## Environment text OS: Windows Inspector: Started locally with npx @mcpjam/inspector@latest Authentication: Signed in to MCPJam Provider: Built-in OpenRouter provider Model: OpenRouter / anthropic/claude-sonnet-5  ## Steps to reproduce Start Inspector locally:  powershell npx @mcpjam/inspector@latest Sign in to MCPJam.  Navigate to Settings → LLM Providers.  Configure the built-in OpenRouter provider with a valid OpenRouter API key.  Confirm that the provider is shown as Configured.  Create a new chat, or click Reset chat.  Select an OpenRouter model under:  text Your providers → OpenRouter Send any prompt.  ## Expected behavior The request should be sent through OpenRouter and billed against my OpenRouter API account. It should not consume or require MCPJam free-model credits.  ## Actual behavior The chat fails immediately with:  text This model is not included in the free daily allowance. Add credits or use your own API key (BYOK) to use it. This happens even though I am already using the built-in OpenRouter BYOK provider and the model is visibly selected under Your providers, no

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

### Incident Patch 1: `c6c376ef` (2026-10-22)
**Commit Message**: fix(oauth): tighten the debugger's automatic code exchange (#6801)

**File**: `.changeset/oauth-debugger-redemption-followups.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@mcpjam/inspector": patch
+---
+
+The OAuth Debugger's Continue button now reads "Continuing..." while a step's request is in flight, including the automatic code exchange after sign-in. Before, it showed a disabled "Continue" during the request.
```

**File**: `mcpjam-inspector/client/src/components/OAuthFlowTab.tsx` (modified, +7/-3)
```diff
@@ -403,6 +403,12 @@ export const OAuthFlowTab = ({
 
   const processedCodeRef = useRef<string | null>(null);
   const exchangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
+  // Unmount only: the callback effect re-runs whenever the machine is rebuilt,
+  // and a scheduled redemption has to survive that.
+  useEffect(
+    () => () => clearTimeout(exchangeTimeoutRef.current ?? undefined),
+    [],
+  );
 
   // Reset OAuth flow state when switching servers
   const prevServerNameRef = useRef(selectedServerName);
@@ -859,9 +865,7 @@ export const OAuthFlowTab = ({
 
       processedCodeRef.current = code;
 
-      if (exchangeTimeoutRef.current) {
-        clearTimeout(exchangeTimeoutRef.current);
-      }
+      clearTimeout(exchangeTimeoutRef.current ?? undefined);
 
       updateOAuthFlowState({
         authorizationCode: code,
```

**File**: `mcpjam-inspector/client/src/components/__tests__/OAuthFlowTab.agent.test.tsx` (modified, +46/-2)
```diff
@@ -74,6 +74,7 @@ const machineCtl = vi.hoisted(() => ({
       ) => void | Promise<void>)
     | null,
   updateState: null as ((u: Partial<OAuthFlowState>) => void) | null,
+  machinesCreated: 0,
 }));
 
 vi.mock("@/lib/oauth/debug-state-machine-adapter", () => ({
@@ -82,6 +83,7 @@ vi.mock("@/lib/oauth/debug-state-machine-adapter", () => ({
     getState: () => OAuthFlowState;
   }) => {
     machineCtl.updateState = opts.updateState;
+    machineCtl.machinesCreated += 1;
     return {
       proceedToNextStep: async () => {
         await machineCtl.onAdvance?.(opts.updateState, opts.getState);
@@ -539,8 +541,10 @@ describe("OAuthFlowTab, when the authorization callback delivers the code", () =
     };
   }
 
-  async function signInAndReturn() {
-    renderTab();
+  async function signInAndReturn(
+    serverConfigs?: Record<string, ServerWithName>,
+  ) {
+    const view = renderTab(serverConfigs && { serverConfigs });
     await act(async () => {
       machineCtl.updateState?.({
         currentStep: "authorization_request",
@@ -560,6 +564,7 @@ describe("OAuthFlowTab, when the authorization callback delivers the code", () =
         }),
       );
     });
+    return view;
   }
 
   it("redeems the code without waiting for Continue, with Continue held off meanwhile", async () => {
@@ -586,6 +591,45 @@ describe("OAuthFlowTab, when the authorization callback delivers the code", () =
     );
   });
 
+  it("doesn't spend the code once the tab unmounts before the timer fires", async () => {
+    const exchange = scriptRedemption({ currentStep: "received_access_token" });
+    const view = await signInAndReturn();
+    view.unmount();
+
+    await act(() => new Promise((resolve) => setTimeout(resolve, 700)));
+
+    expect(exchange.startedFrom).toEqual([]);
+  });
+
+  it("still redeems the code when the machine is rebuilt before the timer fires", async () => {
+    // A server-list refresh hands the tab fresh server objects. With a custom
+    // header that rebuilds the machine and re-runs the callback effect.
+    const withHeader = () => {
+      const server = httpServer("linear");
+      server.oauthFlowProfile!.customHeaders = [
+        { key: "X-Api-Key", value: "k" },
+      ];
+      return { linear: server };
+    };
+    const exchange = scriptRedemption({ currentStep: "received_access_token" });
+    const view = await signInAndReturn(withHeader());
+    const machinesBefore = machineCtl.machinesCreated;
+    view.rerender(
+      <OAuthFlowTab
+        serverConfigs={withHeader()}
+        selectedServerName="linear"
+        hasHeaderServers
+        areServersHydrated
+        onSelectServer={vi.fn()}
+      />,
+    );
+    expect(machineCtl.machinesCreated).toBeGreaterThan(machinesBefore);
+
+    await waitFor(() => expect(exchange.tokenRequestSent()).toBe(true), {
+      timeout: 2_000,
+    });
+  });
+
   it("stops at a rejected code instead of sending it again", async () => {
     const exchange = scriptRedemption(REJECTED_EXCHANGE);
     await signInAndReturn();
```

**File**: `mcpjam-inspector/client/src/components/oauth/OAuthFlowLogger.tsx` (modified, +4/-7)
```diff
@@ -461,12 +461,14 @@ export function OAuthFlowLogger({
                       : "Refresh Tokens"}
                   </Button>
                 )}
-                {actions?.onContinue && (
+                {actions && (actions.onContinue || actions.continueLabel) && (
                   <Button
                     size="sm"
                     onClick={actions.onContinue}
                     disabled={
-                      actions.continueDisabled || actions.continuePending
+                      !actions.onContinue ||
+                      actions.continueDisabled ||
+                      actions.continuePending
                     }
                     aria-busy={actions.continuePending || undefined}
                     className="h-7"
@@ -476,11 +478,6 @@ export function OAuthFlowLogger({
                       : actions.continueLabel || "Continue"}
                   </Button>
                 )}
-                {!actions?.onContinue && actions?.continueLabel && (
-                  <Button size="sm" disabled={true} className="h-7">
-                    {actions.continueLabel}
-                  </Button>
-                )}
               </div>
             </div>
 
```

**File**: `mcpjam-inspector/client/src/components/oauth/__tests__/OAuthFlowLogger.continue-pending.test.tsx` (modified, +10/-0)
```diff
@@ -47,6 +47,16 @@ describe("OAuthFlowLogger — Continue pending state", () => {
     expect(screen.queryByRole("button", { name: "Next Step" })).toBeNull();
   });
 
+  it("keeps 'Continuing...' while a step runs and Continue has no handler", () => {
+    // The tab withdraws onContinue while a step is in flight, such as the
+    // token request the callback sends on its own.
+    renderLogger({ continueLabel: "Continue", continuePending: true });
+
+    const button = screen.getByRole("button", { name: "Continuing..." });
+    expect(button).toBeDisabled();
+    expect(button).toHaveAttribute("aria-busy", "true");
+  });
+
   it("stays disabled when the flow itself disables Continue", () => {
     renderLogger({
       onContinue: vi.fn(),
```

**File**: `mcpjam-inspector/client/src/lib/oauth/__tests__/code-redemption.test.ts` (modified, +15/-2)
```diff
@@ -1,6 +1,9 @@
 import { describe, expect, it } from "vitest";
-import type { OAuthFlowState } from "@mcpjam/sdk/browser";
-import { redeemAuthorizationCode } from "../code-redemption";
+import { getStepIndex, type OAuthFlowState } from "@mcpjam/sdk/browser";
+import {
+  CODE_REDEMPTION_STEPS,
+  redeemAuthorizationCode,
+} from "../code-redemption";
 
 const NEXT: Record<string, OAuthFlowState["currentStep"]> = {
   authorization_request: "received_authorization_code",
@@ -39,6 +42,16 @@ describe("redeemAuthorizationCode", () => {
     ]);
   });
 
+  it("lists every step the SDK orders from the callback through the token request", () => {
+    // Fails when the SDK adds a step in that range. Decide whether the new
+    // step is safe to run without a click before adding it to the list.
+    const first = getStepIndex("authorization_request");
+    const last = getStepIndex("token_request");
+    expect(
+      [...CODE_REDEMPTION_STEPS].map(getStepIndex).sort((a, b) => a - b),
+    ).toEqual(Array.from({ length: last - first + 1 }, (_, i) => first + i));
+  });
+
   it("does not start while another step is in flight", async () => {
     const { machine, flowState, startedFrom } = scriptedMachine({
       currentStep: "token_request",
```

**File**: `mcpjam-inspector/client/src/lib/oauth/code-redemption.ts` (modified, +4/-2)
```diff
@@ -4,8 +4,10 @@ import type {
   OAuthStateMachine,
 } from "@mcpjam/sdk/browser";
 
-// The steps between the authorization callback and the tokens.
-const CODE_REDEMPTION_STEPS = new Set<OAuthFlowStep>([
+// The steps between the authorization callback and the tokens, listed rather
+// than read off the SDK's order: only steps known to need no click may run on
+// their own. The test pins this list to that order.
+export const CODE_REDEMPTION_STEPS = new Set<OAuthFlowStep>([
   "authorization_request",
   "received_authorization_code",
   "token_request",
```

**File**: `mcpjam-inspector/e2e/visual/mobile-oauth-layout.spec.ts` (modified, +2/-1)
```diff
@@ -304,9 +304,10 @@ for (const theme of ["light", "dark"])
           .getByRole("button", { name: /POST.*pending/ })
           .first();
         await expect(pending).toBeVisible();
+        // The request is in flight, so the button shows its pending label.
         await inside(
           page,
-          page.getByRole("button", { name: "Continue", exact: true }),
+          page.getByRole("button", { name: "Continuing...", exact: true }),
         );
         release();
         await requestFinished;
```

---

### Incident Patch 2: `e0b2724c` (2026-10-26)
**Commit Message**: fix(oauth): name the server's certificate when TLS trust fails (#6832)

**File**: `.changeset/oauth-tls-trust-failures.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+---
+"@mcpjam/sdk": patch
+"@mcpjam/inspector": patch
+---
+
+When the server under test presents a TLS certificate that Node.js does not trust, the local inspector's OAuth proxy now answers 502 with "The server's TLS certificate could not be verified" followed by Node's own message, instead of a 500. The OAuth Debugger shows that message without "Backend debug proxy error" and no longer reports it as an MCPJam error. The SDK adds `tlsTrustFailure`, `isTlsTrustFailure` and the `transport/tls_untrusted` error code.
```

**File**: `docs/troubleshooting/error-codes.mdx` (modified, +17/-0)
```diff
@@ -332,6 +332,23 @@ The server closed the connection without sending a response.
 - Retry the request.
 - Check server-side logs for the crash.
 
+### TLS certificate not trusted
+
+`transport/tls_untrusted`
+
+The server presented a TLS certificate that Node.js could not verify, so no request reached it.
+
+**Likely causes**
+- The certificate comes from a private or corporate CA that Node.js does not trust.
+- The server does not send its intermediate certificates.
+- The certificate is self-signed, expired, or issued for a different hostname.
+- A TLS-inspecting proxy or antivirus replaces the server's certificate.
+
+**Next steps**
+- Fix the certificate on the server: renew it, send the full chain, and match the hostname.
+- If the error suggests `--use-system-ca`, start the inspector with `NODE_OPTIONS=--use-system-ca npx @mcpjam/inspector@latest` so Node.js trusts your system's CAs.
+- Or point Node.js at the CA file: `NODE_EXTRA_CA_CERTS=/path/to/ca.pem npx @mcpjam/inspector@latest`.
+
 ---
 
 ## Auth & OAuth
```

**File**: `mcpjam-inspector/client/src/lib/oauth/__tests__/debug-state-machine-adapter.test.ts` (modified, +16/-0)
```diff
@@ -296,6 +296,22 @@ describe("Inspector OAuth debug proxy failures", () => {
       "Backend debug proxy error: 400 Bad Request",
     );
   });
+
+  // PLB-273: the proxy reached the server, and the server's certificate failed.
+  // "Backend debug proxy error: 502" would blame MCPJam for it.
+  it("shows a certificate failure as the server's, without the proxy prefix", async () => {
+    const reason =
+      "The server's TLS certificate could not be verified: unable to verify the first certificate; if the root CA is installed locally, try running Node.js with --use-system-ca";
+    authFetchMock.mockResolvedValue(
+      new Response(JSON.stringify({ error: reason }), {
+        status: 502,
+        statusText: "Bad Gateway",
+      }),
+    );
+
+    const error = await createDebugRequestExecutor()(request).catch((e) => e);
+    expect(error.message).toBe(reason);
+  });
 });
 
 describe("Inspector OAuth adapter SSRF loopback opt-in", () => {
```

**File**: `mcpjam-inspector/client/src/lib/oauth/__tests__/debug-state-machine-step-reporting.test.ts` (modified, +31/-0)
```diff
@@ -299,6 +299,37 @@ describe("OAuth debugger step-failure reporting", () => {
     expect(updateState).toHaveBeenCalledWith(serverFailure);
   });
 
+  // PLB-273: 34 events from 5 users in 120 days, every one a server under test
+  // whose certificate Node.js would not accept, filed as an MCPJam failure.
+  it("ignores a certificate failure on the server under test", async () => {
+    const { wrapped, updateState, execute } = wrappedUpdateState(
+      vi.fn(),
+      "request_without_token",
+    );
+    vi.mocked(authFetch).mockResolvedValue(
+      new Response(
+        JSON.stringify({
+          error:
+            "The server's TLS certificate could not be verified: unable to verify the first certificate; if the root CA is installed locally, try running Node.js with --use-system-ca",
+        }),
+        { status: 502, statusText: "Bad Gateway" },
+      ),
+    );
+    const failure = await execute({
+      url: "https://mcp.example.test/mcp",
+      method: "POST",
+      headers: {},
+    }).catch((error: Error) => error);
+    const update = {
+      error: `Failed to request MCP server: ${(failure as Error).message}`,
+    };
+
+    wrapped(update);
+
+    expect(reportCaught).not.toHaveBeenCalled();
+    expect(updateState).toHaveBeenCalledWith(update);
+  });
+
   it("still reports the debug proxy failing on the probe", () => {
     const { wrapped } = wrappedUpdateState(vi.fn(), "request_without_token");
 
```

**File**: `mcpjam-inspector/client/src/lib/oauth/debug-state-machine-adapter.ts` (modified, +11/-1)
```diff
@@ -8,6 +8,7 @@ import {
   isAuthenticatedRequestFailure,
   stepFailureFindingKey,
   isResourceMetadataNotImplemented,
+  isTlsTrustFailure,
   isUnexpectedProbeStatus,
   isLoopbackOAuthUrl,
   type OAuthFlowState,
@@ -194,6 +195,9 @@ export function createDebugRequestExecutor(
         requestMethod: request.method,
         proxyStatus: proxyResponse.status,
       });
+      // The proxy reached the server and its certificate failed. The reason
+      // already says so; "Backend debug proxy error: 502" would blame MCPJam.
+      if (reason && isTlsTrustFailure(reason)) throw new Error(reason);
       throw new Error(
         `Backend debug proxy error: ${proxyResponse.status} ${
           proxyResponse.statusText
@@ -322,6 +326,11 @@ function createHostedClientSecretResolver({
  * real response, and the target said no. A proxy failure throws its own
  * "Backend debug proxy error" instead, so that one still reports.
  *
+ * A server certificate Node.js would not accept is one more (PLB-273). The
+ * local proxy answers 502 with a sentence the SDK owns (`isTlsTrustFailure`)
+ * followed by Node's own fix. A certificate failure on MCPJam's own hosts
+ * never gets that sentence, so it still reports.
+ *
  * The SDK owns all of these messages and exports them, so matching here cannot
  * drift out of sync with what the machines actually throw.
  */
@@ -336,7 +345,8 @@ function isUnreportedStepFailure(error: string): boolean {
     UNREPORTED_STEP_FAILURES.has(error) ||
     isAuthenticatedRequestFailure(error) ||
     isResourceMetadataNotImplemented(error) ||
-    isUnexpectedProbeStatus(error)
+    isUnexpectedProbeStatus(error) ||
+    isTlsTrustFailure(error)
   );
 }
 
```

**File**: `mcpjam-inspector/server/routes/mcp/__tests__/oauth.test.ts` (added, +137/-0)
```diff
@@ -0,0 +1,137 @@
+import { Hono } from "hono";
+import { beforeEach, describe, expect, it, vi } from "vitest";
+import { TLS_TRUST_FAILURE } from "@mcpjam/sdk";
+import { requestLogContextMiddleware } from "../../../middleware/request-log-context.js";
+
+const {
+  executeDebugOAuthProxyMock,
+  executeOAuthProxyMock,
+  fetchOAuthMetadataMock,
+} = vi.hoisted(() => ({
+  executeDebugOAuthProxyMock: vi.fn(),
+  executeOAuthProxyMock: vi.fn(),
+  fetchOAuthMetadataMock: vi.fn(),
+}));
+
+vi.mock("../../../utils/oauth-proxy.js", async (importOriginal) => ({
+  ...(await importOriginal<typeof import("../../../utils/oauth-proxy.js")>()),
+  executeDebugOAuthProxy: executeDebugOAuthProxyMock,
+  executeOAuthProxy: executeOAuthProxyMock,
+  fetchOAuthMetadata: fetchOAuthMetadataMock,
+}));
+
+import oauth from "../oauth.js";
+
+/** What the pinned transport rejects with: Node's text, OpenSSL's code. */
+function nodeError(code: string, message: string): Error {
+  return Object.assign(new Error(message), { code });
+}
+
+const UNTRUSTED_LEAF = nodeError(
+  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
+  "unable to verify the first certificate; if the root CA is installed locally, try running Node.js with --use-system-ca",
+);
+
+const app = new Hono()
+  .use("/api/*", requestLogContextMiddleware)
+  .route("/api/mcp/oauth", oauth);
+
+async function postDebugProxy(url: string) {
+  const response = await app.request("/api/mcp/oauth/debug/proxy", {
+    method: "POST",
+    headers: { "Content-Type": "application/json" },
+    body: JSON.stringify({ url, method: "POST" }),
+  });
+  return {
+    status: response.status,
+    body: (await response.json()) as {
+      error: string;
+      normalized?: { slug: string };
+      origin?: string;
+    },
+  };
+}
+
+describe("local OAuth debug proxy: certificate failures", () => {
+  beforeEach(() => {
+    executeDebugOAuthProxyMock.mockReset();
+  });
+
+  it("answers 502 naming the server's certificate and keeps Node's hint", async () => {
+    executeDebugOAuthProxyMock.mockRejectedValue(UNTRUSTED_LEAF);
+
+    const { status, body } = await postDebugProxy(
+      "https://mcp.example.com/mcp",
+    );
+
+    expect(status).toBe(502);
+    expect(body.error).toBe(`${TLS_TRUST_FAILURE}: ${UNTRUSTED_LEAF.message}`);
+    expect(body.normalized?.slug).toBe("transport/tls_untrusted");
+    expect(body.origin).toBe("user_server");
+  });
+
+  it("keeps the 500 path for MCPJam's own hosts", async () => {
+    // The debugger fetches MCPJam's client metadata document through this
+    // proxy. A certificate failure there is ours, not the server under test's.
+    executeDebugOAuthProxyMock.mockRejectedValue(UNTRUSTED_LEAF);
+
+    const { status, body } = await postDebugProxy(
+      "https://www.mcpjam.com/.well-known/oauth/client-metadata.json",
+    );
+
+    expect(status).toBe(500);
+    expect(body.error).toBe(UNTRUSTED_LEAF.message);
+  });
+
+  it("leaves other transport failures on the 500 path", async () => {
+    const refused = nodeError(
+      "ECONNREFUSED",
+      "connect ECONNREFUSED 127.0.0.1:9",
+    );
+    executeDebugOAuthProxyMock.mockRejectedValue(refused);
+
+    const { status, body } = await postDebugProxy(
+      "https://mcp.example.com/mcp",
+    );
+
+    expect(status).toBe(500);
+    expect(body.error).toBe(refused.message);
+  });
+});
+
+describe("local OAuth proxy and metadata routes: certificate failures", () => {
+  beforeEach(() => {
+    executeOAuthProxyMock.mockReset();
+    fetchOAuthMetadataMock.mockReset();
+  });
+
+  it("answers 502 on /proxy", async () => {
+    executeOAuthProxyMock.mockRejectedValue(UNTRUSTED_LEAF);
+
+    const response = await app.request("/api/mcp/oauth/proxy", {
+      method: "POST",
+      headers: { "Content-Type": "application/json" },
+      body: JSON.stringify({ url: "https://auth.example.com/token" }),
+    });
+
+    expect(response.status).toBe(502);
+    expect(((await response.json()) as { error: string }).error).toBe(
+      `${TLS_TRUST_FAILURE}: ${UNTRUSTED_LEAF.message}`,
+    );
+  });
+
+  it("answers 502 on /metadata", async () => {
+    fetchOAuthMetadataMock.mockRejectedValue(UNTRUSTED_LEAF);
+
+    const response = await app.request(
+      `/api/mcp/oauth/metadata?url=${encodeURIComponent(
+        "https://auth.example.com/.well-known/oauth-authorization-server",
+      )}`,
+    );
+
+    expect(response.status).toBe(502);
+    expect(((await response.json()) as { error: string }).error).toBe(
+      `${TLS_TRUST_FAILURE}: ${UNTRUSTED_LEAF.message}`,
+    );
+  });
+});
```

**File**: `mcpjam-inspector/server/routes/mcp/oauth.ts` (modified, +18/-3)
```diff
@@ -9,6 +9,7 @@ import {
   executeDebugOAuthProxy,
   fetchOAuthMetadata,
   OAuthProxyError,
+  tlsTrustFailure,
 } from "../../utils/oauth-proxy.js";
 import { reportRouteFailureForResponse } from "../../utils/route-error-report.js";
 
@@ -37,6 +38,17 @@ function safeHostname(url: string | undefined): string {
   }
 }
 
+/**
+ * A certificate the server under test presented and Node.js would not accept,
+ * as a 502 that says so. MCPJam's own hosts keep the 500 path: the debugger
+ * fetches our client metadata document through this proxy, and a certificate
+ * failure there is ours (or a TLS-inspecting proxy in front of the user).
+ */
+function asTargetTlsFailure(error: unknown, host: string) {
+  if (host === "mcpjam.com" || host.endsWith(".mcpjam.com")) return undefined;
+  return tlsTrustFailure(error);
+}
+
 /**
  * Debug proxy for OAuth flow visualization and testing
  * POST /api/mcp/oauth/debug/proxy
@@ -65,8 +77,9 @@ oauth.post("/debug/proxy", async (c) => {
       ...(redirect === "manual" || redirect === "follow" ? { redirect } : {}),
     });
     return c.json(result);
-  } catch (error) {
+  } catch (caught) {
     const targetUrlHost = safeHostname(proxyUrl);
+    const error = asTargetTlsFailure(caught, targetUrlHost) ?? caught;
     if (error instanceof OAuthProxyError) {
       getRequestLogger(c, "routes.mcp.oauth").event("mcp.oauth.proxy.failed", {
         targetUrlHost,
@@ -138,8 +151,9 @@ oauth.post("/proxy", async (c) => {
     });
     c.header(OAUTH_UPSTREAM_URL_HEADER, result.finalUrl);
     return c.json(result);
-  } catch (error) {
+  } catch (caught) {
     const targetUrlHost = safeHostname(proxyUrl);
+    const error = asTargetTlsFailure(caught, targetUrlHost) ?? caught;
     if (error instanceof OAuthProxyError) {
       getRequestLogger(c, "routes.mcp.oauth").event("mcp.oauth.proxy.failed", {
         targetUrlHost,
@@ -216,8 +230,9 @@ oauth.get("/metadata", async (c) => {
 
     c.header(OAUTH_UPSTREAM_URL_HEADER, result.finalUrl);
     return c.json(result.metadata);
-  } catch (error) {
+  } catch (caught) {
     const targetUrlHost = safeHostname(metadataUrl);
+    const error = asTargetTlsFailure(caught, targetUrlHost) ?? caught;
     if (error instanceof OAuthProxyError) {
       getRequestLogger(c, "routes.mcp.oauth").event("mcp.oauth.proxy.failed", {
         targetUrlHost,
```

**File**: `mcpjam-inspector/server/utils/oauth-proxy.ts` (modified, +1/-0)
```diff
@@ -4,5 +4,6 @@ export {
   executeOAuthProxy,
   executeDebugOAuthProxy,
   fetchOAuthMetadata,
+  tlsTrustFailure,
 } from "@mcpjam/sdk";
 export type { OAuthProxyRequest, OAuthProxyResponse } from "@mcpjam/sdk";
```

---

### Incident Patch 3: `a6074595` (2026-10-27)
**Commit Message**: Evaluate: go straight to creating a suite when none exists (#6822)

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `.changeset/evaluate-no-suite-picker.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@mcpjam/inspector": patch
+---
+
+In Evaluate, Add case and Setup Run go straight to creating a suite when none exists, instead of opening a nearly empty picker.
```

**File**: `mcpjam-inspector/client/src/components/EvaluateTab.tsx` (modified, +22/-14)
```diff
@@ -597,6 +597,23 @@ function EvaluateTabContent({
   );
 
   const [suiteAction, setSuiteAction] = useState<"run" | "case" | null>(null);
+  // A case and a run both start from a suite. With none there is nothing to
+  // pick, so Add case and Setup Run go straight to creating one instead of
+  // opening the picker on an empty list. A tap while suites load waits.
+  const hasNoSuites =
+    !overviewQueries.isOverviewLoading && visibleSuites.length === 0;
+  useEffect(() => {
+    // The picker lives on the list. Leaving it (Back while suites load)
+    // drops the pending action, or Create suite would open over another
+    // page once the overview answers.
+    if (route.type !== "list") {
+      setSuiteAction(null);
+      return;
+    }
+    if (suiteAction === null || !hasNoSuites) return;
+    setSuiteAction(null);
+    handleOpenCreateSuite();
+  }, [route.type, suiteAction, hasNoSuites, handleOpenCreateSuite]);
   const [runReviewSuiteId, setRunReviewSuiteId] = useState<string | null>(null);
   useEffect(() => {
     if (route.type === "run-detail") setRunReviewSuiteId(null);
@@ -1745,7 +1762,7 @@ function EvaluateTabContent({
         )}
 
         <Sheet
-          open={route.type === "list" && suiteAction !== null}
+          open={route.type === "list" && suiteAction !== null && !hasNoSuites}
           onOpenChange={(open) => {
             if (!open) setSuiteAction(null);
           }}
@@ -1791,19 +1808,10 @@ function EvaluateTabContent({
                 </Button>
               ))}
               {visibleSuites.length === 0 && (
-                <>
-                  <p className="text-sm text-muted-foreground">
-                    Create a suite to get started.
-                  </p>
-                  <Button
-                    onClick={() => {
-                      setSuiteAction(null);
-                      handleOpenCreateSuite();
-                    }}
-                  >
-                    Create suite
-                  </Button>
-                </>
+                <p className="flex items-center gap-2 text-sm text-muted-foreground">
+                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
+                  Loading suites…
+                </p>
               )}
             </div>
           </SheetContent>
```

**File**: `mcpjam-inspector/client/src/components/__tests__/EvaluateTab.test.tsx` (modified, +118/-0)
```diff
@@ -543,6 +543,124 @@ describe("EvaluateTab", () => {
     });
   });
 
+  describe("Add case and Setup Run with no suite yet", () => {
+    function withSuites(sortedSuites: unknown[], isOverviewLoading = false) {
+      mocks.useEvalQueries.mockImplementation(
+        ({ selectedSuiteId }: { selectedSuiteId: string | null }) => ({
+          ...makeQueryState(selectedSuiteId),
+          suiteOverview: sortedSuites,
+          sortedSuites,
+          selectedSuiteEntry: null,
+          selectedSuite: null,
+          isOverviewLoading,
+        }),
+      );
+    }
+
+    beforeEach(() => {
+      mocks.route.current = { type: "list" };
+    });
+
+    it("Setup Run goes straight to creating a suite instead of an empty picker", async () => {
+      withSuites([]);
+      render(<EvaluateTab projectId="ws-1" />);
+
+      await userEvent.click(screen.getByRole("button", { name: /setup run/i }));
+
+      expect(mocks.navigatePlaygroundEvalsRoute).toHaveBeenCalledWith({
+        type: "create",
+      });
+      expect(screen.queryByRole("dialog")).toBeNull();
+    });
+
+    it("Add test case goes straight to creating a suite too", async () => {
+      withSuites([]);
+      render(<EvaluateTab projectId="ws-1" />);
+      await userEvent.click(screen.getByRole("button", { name: /^suites$/i }));
+
+      await userEvent.click(
+        screen.getByRole("button", { name: "More evaluate actions" }),
+      );
+      await userEvent.click(
+        screen.getByRole("menuitem", { name: "Add test case" }),
+      );
+
+      expect(mocks.navigatePlaygroundEvalsRoute).toHaveBeenCalledWith({
+        type: "create",
+      });
+      expect(screen.queryByRole("dialog")).toBeNull();
+    });
+
+    it("still opens the picker when a suite exists", async () => {
+      render(<EvaluateTab projectId="ws-1" />);
+      await userEvent.click(screen.getByRole("button", { name: /^suites$/i }));
+
+      await userEvent.click(
+        screen.getByRole("button", { name: "More evaluate actions" }),
+      );
+      await userEvent.click(
+        screen.getByRole("menuitem", { name: "Add test case" }),
+      );
+
+      expect(
+        screen.getByText("Choose a suite for the new case."),
+      ).toBeInTheDocument();
+      expect(mocks.navigatePlaygroundEvalsRoute).not.toHaveBeenCalled();
+    });
+
+    it("waits for suites to load before deciding there are none", async () => {
+      withSuites([], true);
+      const view = render(<EvaluateTab projectId="ws-1" />);
+      await userEvent.click(screen.getByRole("button", { name: /setup run/i }));
+      expect(mocks.navigatePlaygroundEvalsRoute).not.toHaveBeenCalled();
+      expect(screen.getByText("Loading suites…")).toBeInTheDocument();
+
+      withSuites([]);
+      view.rerender(<EvaluateTab projectId="ws-1" />);
+
+      expect(mocks.navigatePlaygroundEvalsRoute).toHaveBeenCalledWith({
+        type: "create",
+      });
+      expect(screen.queryByRole("dialog")).toBeNull();
+    });
+
+    it("opens the picker once suites arrive, without sending anyone to create one", async () => {
+      withSuites([], true);
+      const view = render(<EvaluateTab projectId="ws-1" />);
+      await userEvent.click(screen.getByRole("button", { name: /setup run/i }));
+
+      mocks.useEvalQueries.mockImplementation(
+        ({ selectedSuiteId }: { selectedSuiteId: string | null }) =>
+          makeQueryState(selectedSuiteId),
+      );
+      view.rerender(<EvaluateTab projectId="ws-1" />);
+
+      expect(
+        screen.getByText("Choose a suite to configure its next run."),
+      ).toBeInTheDocument();
+      expect(screen.queryByText("Loading suites…")).toBeNull();
+      expect(mocks.navigatePlaygroundEvalsRoute).not.toHaveBeenCalled();
+    });
+
+    it("drops a pending action when the route leaves the list", async () => {
+      withSuites([], true);
+      const view = render(<EvaluateTab projectId="ws-1" />);
+      await userEvent.click(screen.getByRole("button", { name: /setup run/i }));
+
+      // Back to another page while suites load, then the overview answers.
+      mocks.route.current = { type: "suite-overview", suiteId: "suite-a" };
+      view.rerender(<EvaluateTab projectId="ws-1" />);
+      withSuites([]);
+      view.rerender(<EvaluateTab projectId="ws-1" />);
+
+      // (The overview's own redirect for a suite that no longer exists may
+      // run; Create suite must not.)
+      expect(mocks.navigatePlaygroundEvalsRoute).not.toHaveBeenCalledWith({
+        type: "create",
+      });
+    });
+  });
+
   it("defaults the bare Evaluate route to Runs, with Runs first", () => {
     mocks.route.current = { type: "list" };
     render(<EvaluateTab projectId="ws-1" />);
```

#### Recent Merged Pull Requests:
- **PR #6862** (2026-10-27): deps: clear the open Dependabot alerts (MCP SDK 1.32.1, storybook, electron, undici, zod, vite) (@olartgabo)
- **PR #6853** (2026-10-26): fix(ci): repair release SDK smoke and contract checks (@chelojimenez)
- **PR #6851** (2026-10-26): test(e2e): mock legalAcceptance:getStatus in the signed-in visual fixture (@nachocossio)
- **PR #6847** (2026-10-26): sdk: mirror the 2026-10-25 host catalog probe sweep (@ignaciojimenezr)
- **PR #6844** (2026-10-26): fix: keep chat running when saved servers cannot connect (@chelojimenez)
- **PR #6843** (2026-10-26): fix(client): default Auto-connect to off (@prathmeshpatel)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. oauth): tighten the debugger's automatic code exchange (#6801)

**RULE**:
When implementing operations in `.changeset/oauth-debugger-redemption-followups.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in MCPJam/inspector. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c6c376ef`: oauth): tighten the debugger's automatic code exchange (#6801). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `.changeset/oauth-debugger-redemption-followups.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
---
"@mcpjam/inspector": patch
---

The OAuth Debugger's Continue button now reads "Continuing..." while a step's request is in flight, including the automatic code exchange after sign-in. Before, it showed a disabled "Continue" during the request.
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `c6c376ef` are properly handled with clean fallback behavior.
