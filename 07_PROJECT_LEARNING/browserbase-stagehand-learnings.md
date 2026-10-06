# Forensic Learning Record (Deep Inspection): browserbase/stagehand

> **Canonical Artifact**: `07_PROJECT_LEARNING/browserbase-stagehand-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/browserbase/stagehand](https://github.com/browserbase/stagehand))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:41:53.418Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `browserbase/stagehand`
- **Description**: The SDK to extract data and interact with any site on the web. Get started with Claude Code, Codex, Eve, Mastra, and more.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 25540 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/cli/src/hooks/command-not-found.ts`
```
import { Errors, type Hook } from "@oclif/core";

import { suggestCommand } from "../lib/command-suggestions.js";
import { captureCommandNotFound } from "../lib/telemetry.js";

function toSpaced(commandId: string): string {
  return commandId.replaceAll(":", " ");
}

const hook: Hook.CommandNotFound = async function ({ config, id }) {
  let attempted = "";
  let suggestion: string | null = null;

  try {
    const commandIds = config.commands
      .filter((command) => !command.hidden)
      .map((command) => command.id);
    const result = suggestCommand(id, commandIds);
    attempted = result.attempted;
    suggestion = result.suggestion;
    if (
      suggestion &&
      !config.findCommand(suggestion) &&
      !config.findTopic(suggestion)
    ) {
      // Guards against alias targets drifting out of the command tree.
      suggestion = null;
    }

    const displayAttempted = toSpaced(attempted || (id.split(":")[0] ?? id));
    const didYouMean = suggestion
      ? ` Did you mean "${config.bin} ${toSpaced(suggestion)}"?`
      : "";
    process.stderr.write(
      `"${config.bin} ${displayAttempted}" is not a ${config.bin} command.${didYouMean} Run ${config.bin} --help for all commands.\n`,
    );
  } catch {
    // Suggestions are best-effort and must never mask the not-found error.
  }

  try {
    // Awaited so the event is delivered before the process exits; the
    // transport aborts after a short timeout, so this cannot hang the CLI.
    await captureCommandNotFound(config.version, attempted || null, suggestion);
  } catch {
    // Best-effort telemetry should never affect CLI behavior.
  }

  // Re-throw oclif's standard not-found error. Returning normally from a
  // command_not_found hook makes oclif treat the invocation as handled
  // (exit 0), so this throw preserves the default error and exit code 2.
  throw new Errors.CLIError(`command ${id} not found`);
};

export default hook;

```

### Core Architecture Module: `packages/cli/src/hooks/finally.ts`
```
import type { Hook } from "@oclif/core";

import { captureCommandCompleted } from "../lib/telemetry.js";

const hook: Hook.Finally = async function ({ config, error }) {
  try {
    await captureCommandCompleted(config.version, error);
  } catch {
    // Best-effort telemetry should never affect CLI behavior.
  }
};

export default hook;

```

### Core Architecture Module: `packages/cli/src/hooks/init.ts`
```
import { join } from "node:path";

import type { Hook } from "@oclif/core";

import { startTelemetryInvocation } from "../lib/telemetry.js";
import { maybeAutoUpdateCli } from "../lib/update.js";

const hook: Hook.Init = async function ({ config }) {
  try {
    startTelemetryInvocation();
  } catch {
    // Best-effort telemetry should never affect CLI behavior.
  }

  try {
    await maybeAutoUpdateCli(config.version, process.env, {
      cacheFile: join(config.cacheDir, "update-check.json"),
    });
  } catch {
    // Best-effort update checks should never affect CLI behavior.
  }
};

export default hook;

```

### Core Architecture Module: `packages/cli/src/hooks/prerun.ts`
```
import type { Hook } from "@oclif/core";

import { captureCommandInvoked } from "../lib/telemetry.js";

const hook: Hook.Prerun = async function ({ Command, config }) {
  try {
    captureCommandInvoked(Command, config.version);
  } catch {
    // Best-effort telemetry should never affect CLI behavior.
  }
};

export default hook;

```

### Core Architecture Module: `packages/cli/src/update-check-worker.ts`
```
import { refreshUpdateCheckCache } from "./lib/update.js";

try {
  await refreshUpdateCheckCache();
} catch {
  // Best-effort update refreshes should never surface to users.
}

```

### Core Architecture Module: `packages/evals/core/contracts/representation.ts`
```
export interface RepresentationOpts {
  includeIframes?: boolean;
}

export interface PageRepresentation {
  kind: "accessibility_tree" | "snapshot_refs" | "dom_text" | "custom";
  content: string;
  metadata?: {
    bytes?: number;
    tokenEstimate?: number;
    refCount?: number;
    nodeCount?: number;
  };
  raw?: unknown;
}

```

### Core Architecture Module: `packages/evals/core/contracts/results.ts`
```
export type EnvironmentName = "local" | "browserbase";

export type BrowserOwnership = "runner" | "tool";

export type ConnectionMode = "launch" | "attach_ws" | "attach_http" | "browserbase_native";

export interface Artifact {
  name: string;
  type: "text" | "json" | "image" | "binary";
  path?: string;
  data?: Buffer | string;
  mimeType?: string;
}

```

### Core Architecture Module: `packages/evals/core/contracts/targets.ts`
```
export type TargetKind = "selector" | "coords" | "snapshot_ref" | "role_name" | "text" | "focused";

export type FocusedTarget = { kind: "focused" };

export type ActionTarget =
  | { kind: "selector"; value: string }
  | { kind: "coords"; x: number; y: number }
  | { kind: "snapshot_ref"; value: string }
  | { kind: "role_name"; role: string; name?: string }
  | { kind: "text"; text: string };

export type WaitSpec =
  | {
      kind: "selector";
      selector: string;
      timeoutMs?: number;
      state?: "attached" | "detached" | "visible" | "hidden";
    }
  | {
      kind: "timeout";
      timeoutMs: number;
    }
  | {
      kind: "load_state";
      state: "load" | "domcontentloaded" | "networkidle";
      timeoutMs?: number;
    };

```

### Core Architecture Module: `packages/evals/core/contracts/tool.ts`
```
import type { ProbeEvidence } from "stagehand-v3";
import type { EvalLogger } from "../../logger.js";
import type { ActionTarget, FocusedTarget, TargetKind, WaitSpec } from "./targets.js";
import type { PageRepresentation, RepresentationOpts } from "./representation.js";
import type { Artifact, BrowserOwnership, ConnectionMode, EnvironmentName } from "./results.js";

export type ToolSurface =
  | "understudy_code"
  | "stagehand_code"
  | "playwright_code"
  | "cdp_code"
  | "playwright_mcp"
  | "chrome_devtools_mcp"
  | "google_computer_use"
  | "anthropic_browser_toolset"
  | "stagehand_facade"
  | "stagehand_facade_legacy"
  | "browse_cli";

export type StartupProfile =
  | "runner_provided_local_cdp"
  | "runner_provided_browserbase_cdp"
  | "tool_launch_local"
  | "tool_attach_local_cdp"
  | "tool_create_browserbase"
  | "tool_attach_browserbase";

export type CoreCapability =
  | "session"
  | "navigation"
  | "evaluation"
  | "screenshot"
  | "viewport"
  | "wait"
  | "click"
  | "hover"
  | "scroll"
  | "type"
  | "press"
  | "tabs"
  | "representation";

export interface NavOpts {
  waitUntil?: "load" | "domcontentloaded" | "networkidle";
  timeoutMs?: number;
}

export interface ScreenshotOpts {
  fullPage?: boolean;
  type?: "png" | "jpeg";
  quality?: number;
}

export interface CoreLocatorHandle {
  count(): Promise<number>;
  click(): Promise<void>;
  hover(): Promise<void>;
  fill(value: string): Promise<void>;
  type(text: string, opts?: { delay?: number }): Promise<void>;
  isVisible(): Promise<boolean>;
  textContent(): Promise<string | null>;
  inputValue(): Promise<string>;
}

export interface CorePageHandle {
  readonly id: string;

  goto(url: string, opts?: NavOpts): Promise<void>;
  reload(opts?: NavOpts): Promise<void>;
  back(opts?: NavOpts): Promise<boolean>;
  forward(opts?: NavOpts): Promise<boolean>;
  goBack(opts?: NavOpts): Promise<boolean>;
  goForward(opts?: NavOpts): Promise<boolean>;

  url(): string;
  title(): Promise<string>;
  evaluate<R = unknown, Arg = unknown>(
    pageFunctionOrExpression: string | ((arg: Arg) => R | Promise<R>),
    arg?: Arg,
  ): Promise<R>;
  screenshot(opts?: ScreenshotOpts): Promise<Buffer>;

  setViewport(size: { width: number; height: number }): Promise<void>;
  setViewportSize(width: number, height: number): Promise<void>;

  wait(spec: WaitSpec): Promise<void>;
  waitForSelector(
    selector: string,
    opts?: {
      timeout?: number;
      state?: "attached" | "detached" | "visible" | "hidden";
    },
  ): Promise<boolean>;
  waitForTimeout(ms: number): Promise<void>;

  locator(selector: string): CoreLocatorHandle;

  click(target: string | ActionTarget): Promise<void>;
  click(x: number, y: number): Promise<void>;

  hover(target: string | ActionTarget): Promise<void>;
  hover(x: number, y: number): Promise<void>;

  scroll(x: number, y: number, deltaX: number, deltaY: number): Promise<void>;

  type(text: string): Promise<void>;
  type(target: string | ActionTarget | FocusedTarget, text: string): Promise<void>;

  press(key: string): Promise<void>;
  press(target: string | ActionTarget | FocusedTarget, key: string): Promise<void>;

  represent?(opts?: RepresentationOpts): Promise<PageRepresentation>;
}

export interface CoreSession {
  listPages(): Promise<CorePageHandle[]>;
  activePage(): Promise<CorePageHandle>;
  newPage(url?: string): Promise<CorePageHandle>;
  selectPage(pageId: string): Promise<void>;
  closePage(pageId: string): Promise<void>;
  close(): Promise<void>;
  getArtifacts(): Promise<Artifact[]>;
  getRawMetrics(): Promise<Record<string, unknown>>;
}

export interface ToolStartInput {
  logger: EvalLogger;
  startupProfile: StartupProfile;
  environment: "LOCAL" | "BROWSERBASE";
  providedEndpoint?: {
    kind: "ws" | "http";
    url: string;
    headers?: Record<string, string>;
  };
  browserbase?: {
    sessionId?: string;
    sessionParams?: Record<string, unknown>;
  };
}

export interface BrowserSessionLoss {
  cause: string;
  tool?: string;
  at?: string;
  provider?: "local" | "browserbase";
  sessionId?: string;
  /** Elapsed time since the facade started browser launch, including initialization. */
  sessionAgeMs?: number;
  sessionTimeoutMs?: number;
}

/** MCP content returned unchanged by a runner call into its existing surface. */
export interface RunnerToolCallResult {
  content: Array<
    | { type: "text"; text: string }
    | { type: "image"; data: string; mimeType: string }
    | Record<string, unknown>
  >;
  isError?: boolean;
}

export interface ToolStartResult {
  session: CoreSession;
  /**
   * Optional agent-facing binding for this running surface. `via` describes
   * delivery to the agent and is independent of `CoreTool.surface`; for
   * example, a code surface may be delivered through MCP or a CLI wrapper.
   */
  agentMount?: AgentMount;
  /**
   * Best-effort evidence captured from the current surface state. Harnesses may
   * call this after individual actions and once more at the end of a run.
   * Implementations must swallow per-field failures and must not throw.
   */
  captureEvidence?: () => Promise<ProbeEvidence>;
  /** Calls the same mounted surface; this must not launch another browser. */
  callTool?: (
    name: string,
    args: Record<string, unknown>,
    options?: { timeoutMs?: number },
  ) => Promise<RunnerToolCallResult>;
  browserSessionLoss?: () => BrowserSessionLoss | undefined;
  /** Releases the runtime; `captureEvidence` is invalid after this resolves. */
  cleanup: () => Promise<void>;
  metadata: {
    environment: EnvironmentName;
    browserOwnership: BrowserOwnership;
    connectionMode: ConnectionMode;
    [key: string]: unknown;
  };
}

export interface CoreTool {
  id: ToolSurface;
  surface: "code" | "mcp" | "cli";
  family: "understudy" | "stagehand" | "playwright" | "cdp" | "stagehand_cli" | "chrome_devtools";
  supportedStartupProfiles: StartupProfile[];
  supportedCapabilities: CoreCapability[];
  supportedTargetKinds: TargetKind[];
  start(input: ToolStartInput): Promise<ToolStartResult>;
}

/**
 * The MCP server / tool name used when an agent harness wraps handles in a
 * code-execution tool.
 */
export const AGENT_RUN_TOOL_SERVER = "stagehand_browser";
export const AGENT_RUN_TOOL_NAME = `mcp__${AGENT_RUN_TOOL_SERVER}__run`;
export const AGENT_RUN_TOOL_RESERVED_HANDLES = ["startUrl", "task", "console"] as const;

/**
 * Surface-specific copy for the harness's code-execution tool. The harness
 * owns mechanics and task bindings; the surface owns what the agent sees.
 */
export interface AgentRunToolSpec {
  /** MCP tool description shown to the model. */
  description: string;
  /** Description of the tool's `code` parameter. */
  codeParamDescription: string;
  /** Message from the harness-owned tool allowlist when access is denied. */
  denyMessage: string;
}

/**
 * How an agent harness reaches an already-running surface. This is independent
 * of `CoreTool.surface`; harnesses switch on `via` and need no surface-specific
 * mounting logic.
 */
export type AgentMount = { promptInstructions: string } & (
  | {
      via: "handles";
      /**
       * Named values placed in snippet scope. Names, not order, bind values.
       * `AGENT_RUN_TOOL_RESERVED_HANDLES` are injected by the harness and may
       * not appear here.
       */
      handles: Record<string, unknown>;
      runTool: AgentRunToolSpec;
    }
  | { via: "mcp"; mcpServers: Record<string, unknown> }
  | {
      via: "cli";
      command: {
        bin: string;
        args?: string[];
        cwd?: string;
        /** Extra variables merged over the harness environment. */
        env?: Record<string, string>;
      };
    }
);

```

### Core Architecture Module: `packages/evals/core/fixtures/index.ts`
```
import { getCoreFixtureBaseUrl } from "./server.js";

export const dropdownHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Core Dropdown Fixture</title>
    <style>
      body { font-family: sans-serif; margin: 0; padding: 24px; }
      #app { max-width: 640px; }
      #menu { display: none; margin-top: 8px; padding: 8px 16px; border: 1px solid #ccc; }
      #menu.open { display: block; }
      #hover-status { margin-top: 12px; color: #444; }
      input { margin-top: 16px; width: 240px; padding: 8px; }
    </style>
  </head>
  <body>
    <div id="app">
      <div>
        <button id="dropdown-button" type="button" aria-expanded="false">Open Menu</button>
        <ul id="menu" aria-hidden="true">
          <li>Alpha</li>
          <li>Beta</li>
          <li>Gamma</li>
        </ul>
      </div>
      <p id="hover-status">idle</p>
      <input id="fixture-input" type="text" value="" />
    </div>
    <script>
      const button = document.getElementById("dropdown-button");
      const menu = document.getElementById("menu");
      const hoverStatus = document.getElementById("hover-status");
      button.addEventListener("mouseenter", () => {
        hoverStatus.textContent = "hovered";
      });
      button.addEventListener("mouseleave", () => {
        hoverStatus.textContent = "idle";
      });
      button.addEventListener("click", () => {
        const open = menu.classList.toggle("open");
        button.setAttribute("aria-expanded", open ? "true" : "false");
        menu.setAttribute("aria-hidden", open ? "false" : "true");
      });
    </script>
  </body>
</html>`;

export const resistorHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Core Resistor Fixture</title>
    <style>
      body { font-family: sans-serif; margin: 0; }
      header { position: sticky; top: 0; background: #fff; padding: 16px; border-bottom: 1px solid #ddd; }
      main { padding: 24px; }
      .spacer { height: 2400px; background: linear-gradient(180deg, #fafafa, #e9e9e9); }
    </style>
  </head>
  <body>
    <header>Resistor Reference</header>
    <main>
      <h1>Resistor Color Codes</h1>
      <p>Scroll to exercise viewport movement.</p>
      <div class="spacer"></div>
    </main>
  </body>
</html>`;

export const coreFixtureRoutes = [
  { path: "/dropdown", html: dropdownHtml },
  { path: "/resistor", html: resistorHtml },
] as const;

function htmlFixtureUrl(name: string, html: string): string {
  return `data:text/html;fixture=${name};base64,${Buffer.from(html, "utf8").toString("base64")}`;
}

function fixtureUrl(path: string, fallback: string): string {
  const baseUrl = getCoreFixtureBaseUrl();
  return baseUrl ? `${baseUrl}${path}` : fallback;
}

const dropdownSelectors = {
  button: "#dropdown-button",
  menu: "#menu",
  hoverStatus: "#hover-status",
  input: "#fixture-input",
} as const;

const resistorSelectors = {
  header: "header",
  heading: "h1",
} as const;

export const dropdownFixture = {
  get url() {
    return fixtureUrl("/dropdown", htmlFixtureUrl("dropdown", dropdownHtml));
  },
  selectors: dropdownSelectors,
  targets: {
    button: { kind: "selector", value: dropdownSelectors.button },
    menu: { kind: "selector", value: dropdownSelectors.menu },
    hoverStatus: { kind: "selector", value: dropdownSelectors.hoverStatus },
    input: { kind: "selector", value: dropdownSelectors.input },
  } as const,
  expected: {
    title: "Core Dropdown Fixture",
    buttonText: "Open Menu",
    hoverStatus: "hovered",
  },
};

export const resistorFixture = {
  get url() {
    return fixtureUrl("/resistor", htmlFixtureUrl("resistor", resistorHtml));
  },
  selectors: resistorSelectors,
  expected: {
    title: "Core Resistor Fixture",
    headingText: "Resistor Color Codes",
  },
};

```

### Core Architecture Module: `packages/evals/core/fixtures/server.ts`
```
import http from "node:http";

const FIXTURE_HOST = "127.0.0.1";
const BASE_URL_ENV = "EVAL_CORE_FIXTURE_BASE_URL";

type FixtureRoute = {
  path: string;
  html: string;
};

let serverPromise: Promise<string> | null = null;

export function getCoreFixtureBaseUrl(): string | undefined {
  return process.env[BASE_URL_ENV];
}

export async function ensureCoreFixtureServer(routes: FixtureRoute[]): Promise<string> {
  if (process.env[BASE_URL_ENV]) {
    return process.env[BASE_URL_ENV]!;
  }

  if (!serverPromise) {
    serverPromise = new Promise<string>((resolve, reject) => {
      const routeMap = new Map(routes.map((route) => [route.path, route.html]));
      const server = http.createServer((req, res) => {
        const pathname = new URL(req.url ?? "/", `http://${FIXTURE_HOST}`).pathname;
        const html = routeMap.get(pathname);

        if (!html) {
          res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
          res.end("Not found");
          return;
        }

        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(html);
      });

      server.on("error", reject);
      server.listen(0, FIXTURE_HOST, () => {
        const address = server.address();
        if (!address || typeof address === "string") {
          reject(new Error("Failed to determine core fixture server address"));
          return;
        }

        // Don't keep the process alive when the CLI is done running tasks.
        // Pre-change this lived in a tsx child process that exited after
        // each run; now runs are in-process, so we have to opt out of
        // holding the event loop open ourselves.
        server.unref();

        const baseUrl = `http://${FIXTURE_HOST}:${address.port}`;
        process.env[BASE_URL_ENV] = baseUrl;
        resolve(baseUrl);
      });
    });
  }

  return serverPromise;
}

```

### Core Architecture Module: `packages/evals/core/runtime/coreDeps.ts`
```
import { createRequire } from "node:module";
import path from "node:path";
import type { ReadStream } from "node:fs";
import { fileURLToPath } from "node:url";

type BrowserbaseConstructor = new (options: { apiKey: string }) => {
  extensions: {
    create: (
      payload: { file: ReadStream },
      options?: { maxRetries?: number },
    ) => Promise<{ id: string }>;
    delete: (
      extensionId: string,
      options?: { headers?: Record<string, string | null> },
    ) => Promise<unknown>;
  };
  sessions: {
    create: (payload: Record<string, unknown>) => Promise<unknown>;
    update: (sessionId: string, payload: Record<string, unknown>) => Promise<unknown>;
    debug?: (sessionId: string) => Promise<unknown>;
  };
};

type WsModule = {
  new (
    url: string,
    options?: Record<string, unknown>,
  ): {
    on: (event: string, listener: (...args: unknown[]) => void) => void;
    once: (event: string, listener: (...args: unknown[]) => void) => void;
    send: (data: string, cb?: (error?: Error) => void) => void;
    close: () => void;
    readyState: number;
  };
  OPEN?: number;
};

// Resolve from this package's own dependency tree. Lazy requires keep these
// CommonJS dependencies out of surfaces that never touch Browserbase or raw CDP.
const evalsRequire = createRequire(import.meta.url);

export function resolveStagehandExtensionArchivePath(): string {
  const stagehandEntry = fileURLToPath(import.meta.resolve("@browserbasehq/stagehand"));
  return path.join(path.dirname(stagehandEntry), "assets", "stagehand-extension.zip");
}

export function loadBrowserbaseSdk(): BrowserbaseConstructor {
  const module = evalsRequire("@browserbasehq/sdk") as {
    default?: BrowserbaseConstructor;
  } & BrowserbaseConstructor;
  return module.default ?? (module as BrowserbaseConstructor);
}

export function loadWsModule(): WsModule {
  const module = evalsRequire("ws") as {
    default?: WsModule;
  } & WsModule;
  return module.default ?? (module as WsModule);
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2356** (2026-07-31): **fix: make missing daemon errors actionable**
  *Symptoms*: ## Summary  - translate daemon socket `ECONNREFUSED` and `ENOENT` failures into a human-readable error - print the exact `browse open` command that restarts the requested session - document that API keys are forwarded to an already-running daemon and that `browse stop` is idempotent - preserve regression coverage for late environment variables and exit-code-zero cleanup  ## Root cause  The daemon client passed raw Unix socket errors through to users when the daemon disappeared between the readiness check and the request. Agents received `ECONNREFUSED` without a recovery command.  ## Impact  Agents now get an actionable `daemon_not_running` failure with the exact command needed to restart the session. Recovery command arguments are shell-quoted, and a daemon disappearing between status and stop is treated as an already-stopped session. Cleanup synchronizes with daemon startup so it preserves a replacement daemon that starts during the stop race. The bundled SKILL.md also makes the already-fixed env timing and stop behavior explicit.  ## E2E Test Matrix  | Command / flow | Observed output | Confidence / sufficiency | | --- | --- | --- | | `pnpm --filter browse build` | TypeScript compilation and oclif manifest generation completed successfully. | Proves the exact local CLI code under review builds; does not exercise a live browser. | | `pnpm --filter browse test:cli` | 25 test files passed; 366/366 tests passed. This includes deterministic daemon disappearance/restart races, ad
  **Post-Mortem & Fix Analysis**:
  > ###  🦋  Changeset detected  Latest commit: 030c02ae69c9648e4fa3a92ff3af77a0133e50b6  **The changes in this PR will be included in the next version bump.**  <details><summary>This PR includes changesets to release 0 packages</summary>    When changesets are added to this PR, you'll see the packages that this PR includes changesets for and the associated semver types  </details>  Not sure what this means? [Click here  to learn what changesets are](https://github.com/changesets/changesets/blob/main/docs/adding-a-changeset.md).  [Click here if you're a maintainer who wants to add another changeset to this PR](https://github.com/browserbase/stagehand/new/kylejeong/gro-1908-cli-reliability?filename=.changeset/metal-impalas-study.md&value=---%0A%22browse%22%3A%20patch%0A---%0A%0A%5BGRO-1908%5D%20Make%20missing%20daemon%20errors%20actionable%0A)  

- **Issue #897** (2025-07-25): **[fix] ensure selfHeal respects arguments**
  *Symptoms*: # why On self healing we were finding the selector, but nor remembering the arguments previously passed; so either they were empty or the LLM was hallucinating them. This PR fixes this  # what changed Updated the logic from selfHealing to reuse the previously passed arguments and method  # test plan - [x] Added evals to act and regression (`evals/tasks/heal_*.ts`)
  **Post-Mortem & Fix Analysis**:
  > ###  🦋  Changeset detected  Latest commit: 31e36c483d7826af669335f0e404f1107a8dd0c9  **The changes in this PR will be included in the next version bump.**    Not sure what this means? [Click here  to learn what changesets are](https://github.com/changesets/changesets/blob/main/docs/adding-a-changeset.md).  [Click here if you're a maintainer who wants to add another changeset to this PR](https://github.com/browserbase/stagehand/new/miguel/stg-562-fix-bug-with-self-heal-forgetting-arguments?filename=.changeset/ten-beds-invent.md&value=---%0A%22%40fake-scope%2Ffake-pkg%22%3A%20patch%0A---%0A%0A%5Bfix%5D%20ensure%20selfHeal%20respects%20arguments%0A)  

- **Issue #313** (2025-05-09): **Bug: forcing tool use for anthropic**
  *Symptoms*: During extraction, Claude will extract some data, continue chunking, and encounter a chunk with no relevant data to extract. Claude is forced to use the `print_extracted_data` tool even when there is no new data. This results in a tool use error, and we therefore lose all the previously extracted data.   We should not force Claude to use the `print_extracted_data` tool on an empty array.

- **Issue #301** (2025-01-03): **stagehand.act interacts with stagehand-nav components**
  *Symptoms*: I updated from stagehand version 1.3 to 1.6 so I could remove the debug dom elements without having to run manual cleanup   Note: they still are present in my session with `debugDom: false` <img width="1245" alt="image" src="https://github.com/user-attachments/assets/3bcfd1fd-7294-4845-8979-165face6f6af" />  It seems like the system prompts update (https://github.com/browserbase/stagehand/blob/main/lib/prompt.ts#L22)  For me this has caused the agent to now attempt to resolve actions by clicking these debugDom elements. Which ends up in an endless loop where it clicks the button and clicks it again. (Note I downgraded to 1.3 and this behaviour is not seen) Heres a small snippet of the log for a acting on a url https://zip.co/us with `action=close any popups, banners, terms and conditions that are present when you navigate to the homepage.`  ``` [stagehand:action] received response from LLM {"response":{"value":"{\"method\":\"click\",\"element\":0,\"args\":[],\"step\":\"Clicked on the 'Next' button to potentially close a popup or navigate through a carousel.\",\"why\":\"This button might be part of a popup or carousel that needs to be closed or navigated through to access the main content.\",\"completed\":false}","type":"object"}} [stagehand:action] executing method {"method":{"value":"click","type":"string"},"elementId":{"value":"0","type":"integer"},"xpaths":{"value":"[\"/html/body[1]/button[2]\",\"//html/body/button[2]\"]","type":"object"},"args":{"value":"[]","
  **Post-Mortem & Fix Analysis**:
  > Thanks so much for making this a GitHub issue! @seanmcguire12 pointed this out internally when running evals. Appreciate the detailed write-up, but idk if a system-prompt is going to help here. We should probably just deprecate/remove stagehand nav; I don't personally find it very useful, and it's clearly causing some bugs.
  > Fixed in #360 

- **Issue #251** (2024-12-01): **no such file or directory, mkdtemp '/tmp/pwtestXXXXXX'**
  *Symptoms*: index.js ``` import { Stagehand } from "@browserbasehq/stagehand"; import { z } from "zod";  const stagehand = new Stagehand({     env: "LOCAL",     headless: true, });  await stagehand.init(); await stagehand.page.goto("https://github.com/browserbase/stagehand"); await stagehand.act({ action: "click on the contributors" }); const contributor = await stagehand.extract({     instruction: "extract the top contributor",     schema: z.object({         username: z.string(),         url: z.string(),     }), }); console.log(`Our favorite contributor is ${contributor.username}`); ```  package.json ``` {   "name": "TestApp",   "version": "1.0.0",   "description": "",   "type": "module",   "main": "index.js",   "scripts": {     "test": "echo \"Error: no test specified\" && exit 1"   },   "keywords": [],   "author": "",   "license": "ISC",   "dependencies": {     "@browserbasehq/stagehand": "^1.3.0",     "zod": "^3.23.8"   } } ```  command ``` node index.js ```  output - error ``` 2024-12-01T14:53:57.200Z::[stagehand:init] launching local browser {"headless":{"value":"true","type":"boolean"}} Error in init: Error: ENOENT: no such file or directory, mkdtemp '/tmp/pwtestXXXXXX'     at Object.mkdtempSync (node:fs:2993:18)     at <Obfuscated_Path>\node_modules\.pnpm\@browserbasehq+stagehand@1.3.0_@playwright+test@1.49.0_deepmerge@4.3.1_dotenv@16.4.5_openai@4_XXXXXX\node_modules\@browserbasehq\stagehand\dist\index.js:3318:41     at Gener

- **Issue #185** (2025-05-08): **Add safe typing**
  *Symptoms*: Typing is a mess right now. It's really hard to add types to browser-side code, and there's a lot of `as any` types. We want to enforce strong typing wherever possible to avoid simple errors and exposing private methods

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

### Incident Patch 1: `1ec76204` (2026-10-04)
**Commit Message**: Standardize eval policy, budgets, session metadata, traces, and cost accounting (#2902)

Defines one eval-owned autonomy policy and a shared result contract for
external harnesses. Records policy channel/version, effective budget and
unit, requested configuration, browser identity, execution reason,
normalized usage and trace/timing metadata.

Unknown usage and subscription costs remain unavailable. Astra estimates
also remain unavailable until per-request context-tier accounting
exists. Other supported direct-provider estimates include the dated
catalog source. Generic task JSON is preserved in results and verifier
trajectories. Failed facade calls remain failures regardless of
tool-output text; runner-owned telemetry determines run-level session
loss. PR13 wires browser identity and budget helpers into existing
adapters.

Validation: isolated shared-runner changes passed all 896 eval tests and
eval typecheck. The complete repaired stack passed 30 build/typecheck
tasks and 29 unit-test tasks, including 999 eval tests. Fresh CI passed
on this PR’s current head.

Stack base: `evals/consolidation-04-cdp-diagnostics`. Review this PR
relative to its immediate predecessor.

Reviewer ent

**File**: `packages/evals/docs/verifier-gates.md` (modified, +2/-2)
```diff
@@ -20,10 +20,10 @@ Blocker wording is recorded as `blockerMentioned` on criterion diagnostics. It n
 
 These fields depend on the producing runner; this verifier layer forwards them but does not make every harness emit them:
 
-- Where supplied, `facade_tool_calls`, `facade_tool_call_failures` and `facade_tool_calls_after_session_lost` distinguish attempted browser work from repeated terminal failures. Missing counters are unknown, not measured zero. A graded pass with an explicit zero browser-call count is shown in the batch summary; with `EVAL_MAX_UNVERIFIABLE_CRITERIA` enabled, it fails the batch gate.
+- Where supplied, `facade_tool_calls` and `facade_tool_call_failures` count attempted and failed browser work. Missing counters are unknown, not measured zero. Run-level browser loss comes from runner-owned telemetry. Normalized steps do not provide trusted per-call loss attribution, so tool-output text cannot exclude failures or synthesize a count after session loss. A graded pass with an explicit zero browser-call count is shown in the batch summary; with `EVAL_MAX_UNVERIFIABLE_CRITERIA` enabled, it fails the batch gate.
 - Separate agent, evidence-capture and verifier wall times are available only when recorded by the producer.
 - Usage must be interpreted with the producer's presence marker and cache convention. Legacy runners may supply zero placeholders; without an explicit presence marker, zero does not establish measured usage. Historical Cursor CLI usage remains unreported.
-- Costs reported by the harness can be retained. A `cost_source` field, when supplied by a producer, distinguishes reported dollars from a catalog estimate (`computed`). This verifier layer does not compute estimates. Without provenance, cost origin is unavailable; unknown or subscription costs must not be inferred as zero.
+- A producer's `cost_source` distinguishes reported dollars from a catalog estimate (`computed`). Shared runner estimates use the dated catalog in `pricing/pricing.json`; they are not invoices. This verifier layer does not compute estimates. Without provenance, cost origin is unavailable; unknown, tier-dependent or subscription costs must not be inferred as zero.
 - `harnessImplementation` records adapter and SDK versions when supplied. Its absence means unknown implementation; historical labels are preserved.
 
 Use `VERIFIER_PERSIST_TRAJECTORIES=1` for reviewable evidence. HardBench's compatibility gate rejects verifier errors, uncertainty sentinels, missing criteria and self-report fallbacks before accepting a result. Offline transport checks establish integration compatibility; live rubric accuracy still requires the separately recorded live fixtures.
```

**File**: `packages/evals/framework/agentToolRuntime.ts` (modified, +11/-0)
```diff
@@ -3,6 +3,7 @@ import { prepareCoreBrowserTarget } from "../core/targets/index.js";
 import { getCoreTool } from "../core/tools/registry.js";
 import { EvalsError } from "../errors.js";
 import type { EvalLogger } from "../logger.js";
+import { browserSessionFromMetadata, type BrowserSessionInfo } from "./browserSession.js";
 
 export interface AgentToolRuntimeInput {
   toolSurface: ToolSurface;
@@ -13,6 +14,12 @@ export interface AgentToolRuntimeInput {
 
 export interface StartedAgentToolRuntime {
   running: ToolStartResult;
+  /**
+   * Browser behind the surface, whether the runner provided it (Browserbase
+   * CDP target) or the tool created it (facade, stagehand_code). Known before
+   * the agent starts so the session URL can head the task log.
+   */
+  browserSession: BrowserSessionInfo;
   /** Closes the tool-owned runtime, then the runner-owned browser target. */
   cleanup: () => Promise<void>;
 }
@@ -49,6 +56,10 @@ export async function startAgentToolRuntime(
   let cleanupPromise: Promise<void> | undefined;
   return {
     running,
+    browserSession: browserSessionFromMetadata(
+      { ...running.metadata, ...target.metadata },
+      input.environment,
+    ),
     cleanup: async () => {
       cleanupPromise ??= (async () => {
         try {
```

**File**: `packages/evals/framework/benchHarness.ts` (modified, +38/-5)
```diff
@@ -1,5 +1,6 @@
 import { V3, normalizeRubric, type AvailableModel, type TaskSpec } from "stagehand-v3";
 import { EvalsError } from "../errors.js";
+import { sanitizeErrorMessage } from "@browserbasehq/stagehand-integrations/harness";
 import type { EvalLogger } from "../logger.js";
 import type { StagehandInitResult } from "../initStagehand.js";
 import type { EvalInput } from "../types/evals.js";
@@ -26,7 +27,13 @@ import {
   buildExternalHarnessTaskPlan,
   type ExternalHarnessTaskPlan,
 } from "./externalHarnessPlan.js";
+import {
+  logBrowserSession,
+  withBrowserSession,
+  type BrowserSessionInfo,
+} from "./browserSession.js";
 import { withHarnessAgentSpan } from "./otel.js";
+import { verifierTraceEnabled } from "./verifierTrace.js";
 import type { DiscoveredTask, TaskResult } from "./types.js";
 import type { BenchMatrixRow, BenchTaskKind, Harness } from "./benchTypes.js";
 import { DEFAULT_BENCH_HARNESS } from "./benchTypes.js";
@@ -69,7 +76,7 @@ export interface BenchHarness {
   supportsApi: boolean;
   /**
    * Tool surfaces this harness can mount for the agent, in display order; the
-   * first entry is the default when --tool is omitted. An empty list means the
+   * facade is preferred when --tool is omitted, otherwise the first entry. An empty list means the
    * harness does not mount tool surfaces and the planner passes the requested
    * surface/profile through unchanged as row metadata (stagehand harness).
    */
@@ -105,7 +112,14 @@ export interface ExternalHarnessRunInput<TAdapter> {
   verifier: ExternalHarnessVerifierConfig;
 }
 
-export interface ExternalHarnessDefinition<TAdapter extends { cleanup: () => Promise<void> }> {
+/** What every prepared external-harness adapter must expose to the shared lifecycle. */
+export interface ExternalHarnessAdapterBase {
+  cleanup: () => Promise<void>;
+  /** Browser behind the mounted surface; logged before the agent starts. */
+  browserSession?: BrowserSessionInfo;
+}
+
+export interface ExternalHarnessDefinition<TAdapter extends ExternalHarnessAdapterBase> {
   harness: string;
   supportedToolSurfaces: ToolSurface[];
   defaultModels: AvailableModel[];
@@ -119,7 +133,7 @@ export interface ExternalHarnessDefinition<TAdapter extends { cleanup: () => Pro
  * Define the lifecycle common to external agent harnesses without registering
  * it; registry ownership stays explicit so list order remains deterministic.
  */
-export function defineExternalHarness<TAdapter extends { cleanup: () => Promise<void> }>(
+export function defineExternalHarness<TAdapter extends ExternalHarnessAdapterBase>(
   definition: ExternalHarnessDefinition<TAdapter>,
 ): BenchHarness {
   const {
@@ -148,6 +162,9 @@ export function defineExternalHarness<TAdapter extends { cleanup: () => Promise<
       // the adapter and the carrier.
       const carrierV3 = buildVerifierCarrierV3(logger);
       let toolAdapter: TAdapter | undefined;
+      let browserSession: BrowserSessionInfo = {
+        provider: row.config.environment === "BROWSERBASE" ? "browserbase" : "local",
+      };
       try {
         toolAdapter = await prepareToolAdapter({
           toolSurface: row.config.toolSurface,
@@ -157,7 +174,9 @@ export function defineExternalHarness<TAdapter extends { cleanup: () => Promise<
           logger,
         });
         const preparedAdapter = toolAdapter;
-        return await withHarnessAgentSpan(
+        browserSession = preparedAdapter.browserSession ?? browserSession;
+        logBrowserSession(logger, browserSession);
+        const result = await withHarnessAgentSpan(
           {
             harness,
             model: input.modelName,
@@ -178,6 +197,18 @@ export function defineExternalHarness<TAdapter extends { cleanup: () => Promise<
               },
             }),
         );
+        return withBrowserSession(result, browserSession);
+      } catch (error) {
+        return withBrowserSession(
+          {
+            _success: false,
+            error: sanitizeErrorMessage(error instanceof Error ? error.message : String(error)),
+            harnessStatus: "sdk_error",
+            terminationReason: signal?.aborted ? "aborted" : "sdk_error",
+            logs: logger.getLogs(),
+          },
+          browserSession,
+        );
       } finally {
         try {
           await toolAdapter?.cleanup();
@@ -208,7 +239,9 @@ function buildVerifierCarrierV3(logger: EvalLogger): V3 {
     disablePino: true,
     disableAPI: true,
     experimental: true,
-    verbose: 0,
+    // verbose 2 surfaces the judge's LLM request/response lines (level 2),
+    // which verifierAdapter routes to scores/verifier-trace.jsonl.
+    verbose: verifierTraceEnabled() ? 2 : 0,
   });
 }
 
```

**File**: `packages/evals/framework/benchPlanner.ts` (modified, +9/-2)
```diff
@@ -1,5 +1,6 @@
 import type { AvailableModel } from "stagehand-v3";
 import { EvalsError } from "../errors.js";
+import { explicitSnapshotActionsEnabled } from "@browserbasehq/stagehand-integrations/facade";
 import { buildOnlineMind2WebTestcases } from "../suites/onlineMind2Web.js";
 import { buildHardBenchmarkTestcases } from "../suites/hardbenchmark.js";
 import { buildWebTailBenchTestcases } from "../suites/webtailbench.js";
@@ -366,11 +367,17 @@ function withBenchMetadata(
 }
 
 function buildToolMetadata(row: BenchMatrixRow): Partial<Testcase["metadata"]> {
+  const promptVariant =
+    row.toolSurface === "stagehand_facade"
+      ? {
+          promptVariant: explicitSnapshotActionsEnabled() ? "explicit_snapshot_actions" : "default",
+        }
+      : {};
   if (
     getBenchHarness(row.harness).supportedToolSurfaces.includes("browse_cli") &&
     row.toolSurface === "browse_cli"
   ) {
-    return getBrowseCliToolMetadata();
+    return { ...getBrowseCliToolMetadata(), ...promptVariant };
   }
-  return {};
+  return promptVariant;
 }
```

**File**: `packages/evals/framework/browserSession.ts` (added, +89/-0)
```diff
@@ -0,0 +1,89 @@
+import type { LogLine } from "stagehand-v3";
+import type { TaskResult } from "./types.js";
+
+export const BROWSER_SESSION_LOG_CATEGORY = "session";
+
+/** Where the browser behind a run lives, resolved before the agent starts. */
+export interface BrowserSessionInfo {
+  provider: "browserbase" | "local";
+  sessionId?: string;
+  sessionUrl?: string;
+  debugUrl?: string;
+}
+
+export function browserbaseSessionUrl(sessionId: string): string {
+  return `https://www.browserbase.com/sessions/${encodeURIComponent(sessionId)}`;
+}
+
+/**
+ * Read the session fields core tools and runner-provided targets publish on
+ * their `metadata` (`browserbaseSessionId` / `browserbaseSessionUrl` /
+ * `browserbaseDebugUrl`). Falls back to the bare provider when a Browserbase
+ * surface does not report its session id (browse_cli).
+ */
+export function browserSessionFromMetadata(
+  metadata: Record<string, unknown> | undefined,
+  environment: "LOCAL" | "BROWSERBASE",
+): BrowserSessionInfo {
+  if (environment !== "BROWSERBASE") return { provider: "local" };
+  const rawUrl = readString(metadata?.browserbaseSessionUrl);
+  const sessionId =
+    readString(metadata?.browserbaseSessionId) ?? rawUrl?.match(/\/sessions\/([^/?#]+)/u)?.[1];
+  const sessionUrl = rawUrl ?? (sessionId ? browserbaseSessionUrl(sessionId) : undefined);
+  const debugUrl = readString(metadata?.browserbaseDebugUrl);
+  return {
+    provider: "browserbase",
+    ...(sessionId && { sessionId }),
+    ...(sessionUrl && { sessionUrl }),
+    ...(debugUrl && { debugUrl }),
+  };
+}
+
+export function formatBrowserSessionMessage(info: BrowserSessionInfo): string {
+  if (info.provider === "local") return "Browser: local";
+  if (!info.sessionUrl) return "Browser: browserbase (session id not reported by this surface)";
+  return `Browserbase session: ${info.sessionUrl}`;
+}
+
+/** Level-0 lines so the session pointer survives every log filter. */
+export function buildBrowserSessionLogLines(info: BrowserSessionInfo): LogLine[] {
+  const lines: LogLine[] = [
+    {
+      category: BROWSER_SESSION_LOG_CATEGORY,
+      level: 0,
+      message: formatBrowserSessionMessage(info),
+      auxiliary: {
+        provider: { value: info.provider, type: "string" },
+        ...(info.sessionId && { sessionId: { value: info.sessionId, type: "string" } }),
+        ...(info.sessionUrl && { sessionUrl: { value: info.sessionUrl, type: "string" } }),
+      },
+    },
+  ];
+  if (info.debugUrl) {
+    lines.push({
+      category: BROWSER_SESSION_LOG_CATEGORY,
+      level: 0,
+      message: `Browserbase debugger: ${info.debugUrl}`,
+    });
+  }
+  return lines;
+}
+
+export function logBrowserSession(sink: { log(line: LogLine): void }, info: BrowserSessionInfo) {
+  for (const line of buildBrowserSessionLogLines(info)) sink.log(line);
+}
+
+/** Surface the session on the TaskResult row so Braintrust output is filterable. */
+export function withBrowserSession(result: TaskResult, info: BrowserSessionInfo): TaskResult {
+  return {
+    ...result,
+    browserProvider: info.provider,
+    ...(info.sessionId && { browserbaseSessionId: info.sessionId }),
+    ...(info.sessionUrl && { sessionUrl: result.sessionUrl || info.sessionUrl }),
+    ...(info.debugUrl && { debugUrl: result.debugUrl || info.debugUrl }),
+  };
+}
+
+function readString(value: unknown): string | undefined {
+  return typeof value === "string" && value.trim() ? value : undefined;
+}
```

**File**: `packages/evals/framework/costEstimate.ts` (added, +272/-0)
```diff
@@ -0,0 +1,272 @@
+import fs from "node:fs";
+import path from "node:path";
+import { getPackageRootDir } from "../runtimePaths.js";
+import type { NormalizedUsage } from "./usageNormalization.js";
+
+/** USD per million tokens. `null` marks a model the owner has not priced yet. */
+export interface ModelPrice {
+  input_per_m: number | null;
+  cached_input_per_m: number | null;
+  /** Cache-write rate where the provider bills one; falls back to `input_per_m`. */
+  cache_write_input_per_m?: number | null;
+  output_per_m: number | null;
+  source: string;
+  note?: string;
+}
+
+export interface PriceMap {
+  as_of: string;
+  models: Record<string, ModelPrice>;
+}
+
+/**
+ * Where `cost_usd` came from:
+ * - `reported`: the harness's own billing channel reported dollars.
+ * - `computed`: the harness called the provider API directly with our key, so
+ *   the estimate is normalized tokens × the dated catalog price in pricing.json.
+ * - `unavailable`: neither — subscription-billed cells (cursor, claude_code on
+ *   a plan) or a model missing from the price map. No cost metric is emitted;
+ *   token efficiency stays on the usage_* metrics.
+ */
+export type CostSource = "reported" | "computed" | "unavailable";
+
+export interface BilledCost {
+  cost_usd?: number;
+  cost_source: CostSource;
+  /** Who billed the tokens, e.g. "anthropic_api", "ai_gateway", "pi_catalog", "subscription". */
+  billing_channel: string;
+  /** Catalog provenance for a list-price estimate, never for a reported bill. */
+  cost_pricing?: { as_of: string; model: string; source: string };
+}
+
+/**
+ * Billing channel per harness.
+ *
+ * | harness     | reports dollars?                        | channel when reported | when not reported                                     |
+ * |-------------|-----------------------------------------|-----------------------|-------------------------------------------------------|
+ * | claude_code | total_cost_usd on the result message    | anthropic_api         | subscription (Claude plan; no dollars, unavailable)   |
+ * | eve         | costUsd per step (gateway-routed models)| ai_gateway            | first-party creators run direct → computed <p>_api    |
+ * | pi          | usage.cost.total from pi's model catalog| pi_catalog            | direct provider call → computed <provider>_api        |
+ * | fx          | total_cost in usage-v2.json             | fx_gateway            | fx always bills via its gateway → unavailable         |
+ * | codex       | never (turn.completed has tokens only)  | —                     | OpenAI API with our key → computed openai_api         |
+ * | mastra      | never (AI SDK usage has no dollars)     | —                     | provider SDK with our key → computed <provider>_api   |
+ * | deepagents  | never (LangChain usage_metadata)        | —                     | provider SDK with our key → computed <provider>_api   |
+ * | cursor      | never                                   | —                     | subscription → unavailable                            |
+ */
+const REPORTED_CHANNEL: Readonly<Record<string, string>> = {
+  claude_code: "anthropic_api",
+  claude_cua: "anthropic_api",
+  gemini_cua: "google_api",
+  eve: "ai_gateway",
+  pi: "pi_catalog",
+  fx: "fx_gateway",
+};
+
+/** Harnesses whose unreported bill is our own provider-API spend, priceable at list. */
+const DIRECT_PROVIDER_HARNESSES: ReadonlySet<string> = new Set([
+  "codex",
+  "claude_cua",
+  "gemini_cua",
+  "mastra",
+  "deepagents",
+  "eve",
+  "pi",
+]);
+
+const SUBSCRIPTION_HARNESSES: ReadonlySet<string> = new Set(["cursor", "claude_code"]);
+
+export interface ResolveBilledCostInput {
+  harness: string;
+  model: string | undefined;
+  usage: NormalizedUsage;
+  /** Dollars the harness's own channel reported for the run, when any. */
+  reportedCostUsd?: number;
+  priceMap?: PriceMap;
+}
+
+/**
+ * The cost column: reported dollars win;
+ * otherwise a direct-provider harness is estimated at catalog price; otherwise the
+ * cost is unavailable rather than zero.
+ */
+export function resolveBilledCost({
+  harness,
+  model,
+  usage,
+  reportedCostUsd,
+  priceMap = loadPriceMap(),
+}: ResolveBilledCostInput): BilledCost {
+  if (
+    typeof reportedCostUsd === "number" &&
+    Number.isFinite(reportedCostUsd) &&
+    reportedCostUsd >= 0
+  ) {
+    return {
+      cost_usd: reportedCostUsd,
+      cost_source: "reported",
+      billing_channel: REPORTED_CHANNEL[harness] ?? `${harness}_reported`,
+    };
+  }
+  const provider = providerOf(model);
+  const channel =
+    harness === "fx"
+      ? "fx_gateway"
+      : SUBSCRIPTION_HARNESSES.has(harness)
+        ? "subscription"
+        : provider
+          ? `${provider}_api`
+          : "none";
+  if (!DIRECT_PROVIDER_HARNESSES.has(harness) || usage.convention === "unreported") {
+    return { cost_source: "unavailable", billing_channel: channel };
+  }
+  const matched = resolveModelPrice(model, priceMap);
+  con
```

**File**: `packages/evals/framework/evalSystemPrompt.ts` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+/** Evaluations have no operator available to answer follow-up questions. */
+export const EVAL_SYSTEM_PROMPT =
+  "Do not ask for clarification. Make a reasonable assumption and proceed.";
```

**File**: `packages/evals/framework/harnesses/externalRunner.ts` (modified, +349/-29)
```diff
@@ -1,11 +1,17 @@
 import type { ProbeEvidence, TaskSpec, Trajectory } from "stagehand-v3";
+import type { HarnessTrajectory, TerminationReason } from "./trajectoryAdapter.js";
 import { sanitizeErrorMessage } from "@browserbasehq/stagehand-integrations/harness";
+import type { BrowserSessionLoss } from "../../core/contracts/tool.js";
 import type { EvalLogger } from "../../logger.js";
+import { EVAL_SYSTEM_PROMPT } from "../evalSystemPrompt.js";
 import { datasetPromptGuidance } from "../externalHarnessPlan.js";
 import type { ExternalHarnessTaskPlan } from "../externalHarnessPlan.js";
 import type { StepObservation } from "../observationRecorder.js";
 import type { TaskResult } from "../types.js";
 import { gradeExternalTrajectory, type ExternalHarnessVerifierConfig } from "../verifierAdapter.js";
+import { emitTrajectoryTrace } from "./traceLog.js";
+import { resolveBilledCost, type BilledCost } from "../costEstimate.js";
+import { normalizeUsage, type NormalizedUsage } from "../usageNormalization.js";
 
 export type MetricValue = { count: number; value: number };
 
@@ -45,10 +51,13 @@ export function parseEvalResult(raw: string): ParsedEvalResult {
   const markerIndex = markerMatch?.index ?? -1;
   const resultText =
     markerIndex >= 0 ? raw.slice(markerIndex + (markerMatch?.[0].length ?? 0)).trim() : raw.trim();
+  // Without a marker the report may trail free-form narration ("I'll open
+  // the site...\n\n{...}"): a report-shaped object that ends the message is
+  // the agent's conclusion. One quoted mid-prose is not.
   const candidates =
     markerIndex >= 0
       ? [resultText, resultText.split(/\r?\n/, 1)[0]?.trim(), extractFirstJsonObject(resultText)]
-      : [resultText, resultText.split(/\r?\n/, 1)[0]?.trim()];
+      : [resultText, resultText.split(/\r?\n/, 1)[0]?.trim(), trailingEvalResultJson(resultText)];
 
   for (const candidate of candidates) {
     if (!candidate) continue;
@@ -58,6 +67,33 @@ export function parseEvalResult(raw: string): ParsedEvalResult {
   return { success: false, raw };
 }
 
+/**
+ * The answer the verifier should grade: the structured report's finalAnswer
+ * when the agent produced one, otherwise its last message. Remove recognized
+ * eval reports without discarding legitimate JSON task deliverables.
+ */
+export function resolveFinalAnswer(
+  parsed: Pick<ParsedEvalResult, "finalAnswer">,
+  lastMessage: string | undefined,
+): string | undefined {
+  if (parsed.finalAnswer !== undefined) return parsed.finalAnswer;
+  if (!lastMessage) return undefined;
+  const stripped = stripEmbeddedEvalReports(lastMessage).trim();
+  return stripped || undefined;
+}
+
+/** Remove eval report envelopes, preserving unrelated JSON content. */
+export function stripEmbeddedEvalReports(text: string): string {
+  let output = text;
+  for (const span of extractJsonObjects(text)) {
+    if (isEvalResultJson(span)) output = output.replace(span, "");
+  }
+  output = output.replace(/^[ \t]*(?:\*\*)?EVAL_RESULT:[ \t]*(?:\*\*)?[ \t]*$/gmu, "");
+  // Drop the now-empty Markdown fence that wrapped a removed report.
+  output = output.replace(/^[ \t]*```[\w-]+[ \t]*\n\s*```[ \t]*$/gmu, "");
+  return output.replace(/\n{3,}/gu, "\n\n");
+}
+
 export interface ExternalHarnessPromptInput {
   plan: ExternalHarnessTaskPlan;
   toolInstructions?: string;
@@ -107,6 +143,12 @@ export interface ExternalHarnessUsage {
   cacheCreationInputTokens?: number;
   reasoningOutputTokens?: number;
   totalTokens: number;
+  /**
+   * `false` when the SDK exposed no usage at all (cursor; codex after an
+   * aborted turn with no rollout to recover from). Zeros with `reported: false`
+   * are treated as unknown, never as a free run.
+   */
+  reported?: boolean;
 }
 
 export interface ExternalHarnessSessionOutcome<TRaw> {
@@ -126,6 +168,26 @@ export interface ExternalHarnessToolAdapterLike {
   captureEvidence?: () => Promise<ProbeEvidence>;
   drainStepObservations?: () => Promise<StepObservation[]>;
   observedToolMatcher?: (name: string) => boolean;
+  browserSessionLoss?: () => BrowserSessionLoss | undefined;
+}
+
+/** harnessStopReason recorded when the mounted browser died before the agent finished. */
+export const BROWSER_SESSION_LOST_STOP_REASON = "browser_session_lost";
+
+/**
+ * Collapse a harness's normalized status + stop reason into why the run ended.
+ * Every SDK reports `completed | max_turns | sdk_error`; the stop reason is the
+ * only place aborts and browser loss are distinguishable from other errors.
+ */
+export function deriveTerminationReason(
+  outcome: Pick<ExternalHarnessSessionOutcome<unknown>, "status" | "stopReason">,
+): TerminationReason {
+  if (outcome.status === "completed") return "completed";
+  if (outcome.status === "max_turns") return "step_budget";
+  const stopReason = outcome.stopReason ?? "";
+  if (stopReason === BROWSER_SESSION_LOST_STOP_REASON) return "browser_session_lost";
+  if (/\b(aborted|interrupted)\b/iu.test(stopReason)) return "aborted";
```

---

### Incident Patch 2: `5788121e` (2026-10-01)
**Commit Message**: fix(ci): push Browse tags despite npm propagation delay (#3015)

Browse 0.10.0 uploaded successfully in [the Release
workflow](https://github.com/browserbase/stagehand/actions/runs/35798682312/job/106985029323),
but the following tag step saw a temporary npm 404 and returned
`unpublished`. The job finished green without pushing the release tag.

Push the validated local tag that Changesets creates after a successful
upload without requiring immediate registry visibility. When no local
tag exists, retain the registry check and original version-bump commit
guard for recovery.

Validation: reproduced the failure with a real HTTP server returning 404
and a bare Git remote, then verified the fix; all 67 release tests,
tooling typecheck, targeted lint/format, and diff checks pass. The diff
changes only the helper and its existing regression test.

The current `browse@0.10.0` tag has been repaired separately to the
exact commit verified in npm provenance. No npm upload or package
version change is part of this PR.


<!-- This is an auto-generated description by cubic. -->
---
## Summary by cubic
Fixes the release workflow so an existing local Browse tag is pushed
without waiting for npm r

**File**: `scripts/release/push-cli-release-tag.test.ts` (modified, +4/-2)
```diff
@@ -93,11 +93,13 @@ it("refuses to create a missing tag on a later main commit", async () => {
   expect(git("ls-remote", "--tags", "origin")).toBe("");
 });
 
-it("pushes an existing local publisher tag at its original commit", async () => {
-  const { repositoryRoot, git, releaseCommit, registry } = await fixture();
+it("pushes the publisher's original tag while npm reads still return 404", async () => {
+  const { repositoryRoot, git, releaseCommit, registry, registryState } = await fixture();
   git("tag", "-a", "browse@0.10.0", "-m", "browse@0.10.0");
   git("commit", "--allow-empty", "-m", "Later main change");
+  registryState.status = 404;
   expect(await pushCliReleaseTag(repositoryRoot, registry)).toBe("pushed");
+  expect(registryState.requests).toBe(0);
   expect(git("ls-remote", "--tags", "origin", "refs/tags/browse@0.10.0^{}")).toBe(
     `${releaseCommit}\trefs/tags/browse@0.10.0^{}`,
   );
```

**File**: `scripts/release/push-cli-release-tag.ts` (modified, +3/-1)
```diff
@@ -15,14 +15,14 @@ export async function pushCliReleaseTag(
   const git = (args: string[]) =>
     execFileSync("git", args, { cwd: repositoryRoot, encoding: "utf8" }).trim();
   if (git(["ls-remote", "--tags", "origin", ref])) return "existing";
-  if (!(await isCliVersionPublished(repositoryRoot, registry))) return "unpublished";
 
   const local = spawnSync("git", ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], {
     cwd: repositoryRoot,
     encoding: "utf8",
   });
   if (local.error) throw local.error;
   if (local.status === 1) {
+    if (!(await isCliVersionPublished(repositoryRoot, registry))) return "unpublished";
     // A fresh checkout after npm accepted the upload may have no local tag.
     // Recover only on the version-bump commit; tagging a later main HEAD would
     // misidentify the released code. Retrying the original workflow retains it.
@@ -36,6 +36,8 @@ export async function pushCliReleaseTag(
   } else if (local.status !== 0) {
     throw new Error("Could not inspect the local Browse release tag");
   } else {
+    // Changesets creates this tag after a successful upload. Registry reads can
+    // still return 404 while npm propagates the version, so trust the local tag.
     const tagged = JSON.parse(git(["show", `${local.stdout.trim()}:${manifestPath}`]));
     if (tagged.version !== version)
       throw new Error("Local Browse tag points to a different package version");
```

---

### Incident Patch 3: `666b6fa3` (2026-10-01)
**Commit Message**: [feat]: expose `timeout` param in `page.snapshot()` (#3083)

# why
`page.snapshot()` had no timeout param, nor did some of its internal
helpers. the helpers that it calls are also called by other functions in
the codebase that require timeout handling. this PR wires the `progress`
object through the shared downstream helpers, and also exposes a user
facing `timeout` param in `page.snapshot()`

# what changed
- added a snapshot timeout in milliseconds to typescript, python, & go.
omission or `0` keeps snapshots unlimited.
- made one deadline cover frame readiness, element lookup, document &
accessibility tree reads, & frame traversal
- allowed internal snapshot calls to reuse a caller's remaining time &
timeout error instead of starting a new budget.
- stopped retries, fallback reads, & further frame traversal after
expiry. temporary element references are released, including those
returned after timeout. already-issued browser commands can still
finish.
- updated sdk response waits to allow the requested timeout plus
delivery grace, with no response deadline for unlimited snapshots

# test plan
- `capture.test.ts` checks public & inherited deadlines, unlimited
snapshots, expiry pre

**File**: `.changeset/fifty-teams-decide.md` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+---
+"@browserbasehq/stagehand-python": minor
+"@browserbasehq/stagehand-extension": minor
+"@browserbasehq/stagehand-protocol": minor
+"@browserbasehq/stagehand-go": minor
+"@browserbasehq/stagehand": minor
+---
+
+expose a timeout option for page.snapshot() across all sdks, defaulting to 20 seconds.
+set it to 0 for unlimited execution. one budget covers the whole snapshot capture.
```

**File**: `packages/docs/v4/reference/page.mdx` (modified, +13/-0)
```diff
@@ -691,6 +691,10 @@ const snapshot = await page.snapshot();
   <ParamField path="options.includeIframes" type="boolean" optional>
     Whether to include iframe content.
   </ParamField>
+  <ParamField path="options.timeout" type="number" optional>
+    Maximum time in milliseconds for the whole snapshot, including frame traversal & browser reads.
+    Defaults to 20,000 ms. Use `0` for no timeout. Request delivery is outside this budget.
+  </ParamField>
 </ParamField>
 
 <ResponseField name="result" type="Promise<SnapshotResult>">
@@ -1442,6 +1446,11 @@ snapshot = await page.snapshot()
   Whether to include iframe content.
 </ParamField>
 
+<ParamField path="timeout" type="float | None" optional>
+  Maximum time in milliseconds for the whole snapshot, including frame traversal & browser reads.
+  Defaults to 20,000 ms. Use `0` for no timeout. Request delivery is outside this budget.
+</ParamField>
+
 <ResponseField name="result" type="SnapshotResult">
   The operation result.
 
@@ -2271,6 +2280,10 @@ fmt.Println(snapshot.FormattedTree)
   <ParamField path="options.IncludeIframes" type="*bool" optional>
     Whether to include iframe content.
   </ParamField>
+  <ParamField path="options.Timeout" type="*float64" optional>
+    Maximum time in milliseconds for the whole snapshot, including frame traversal & browser reads.
+    Defaults to 20,000 ms. Use `0` for no timeout. Request delivery is outside this budget.
+  </ParamField>
 </ParamField>
 
 <ResponseField name="result" type="(SnapshotResult, error)">
```

**File**: `packages/extension/tests/frame-locator.test.ts` (modified, +4/-9)
```diff
@@ -152,21 +152,16 @@ describe("FrameLocator readiness", () => {
     const { locator, childFrame } = createFrameLocator(oldSession, getSessionForFrame);
 
     await expect(locator.resolveFrame()).resolves.toBe(childFrame);
-    expect(waitForLocatorWorld).toHaveBeenNthCalledWith(
-      1,
-      oldSession,
-      "child",
-      200,
-      undefined,
-      false,
-    );
+    expect(waitForLocatorWorld).toHaveBeenNthCalledWith(1, oldSession, "child", 200, undefined, {
+      readinessRetries: "none",
+    });
     expect(waitForLocatorWorld).toHaveBeenNthCalledWith(
       2,
       adoptedSession,
       "child",
       200,
       undefined,
-      false,
+      { readinessRetries: "none" },
     );
   });
 });
```

**File**: `packages/extension/understudy/a11y/snapshot/a11yTree.test.ts` (modified, +106/-5)
```diff
@@ -1,10 +1,13 @@
 import type { Protocol } from "devtools-protocol";
-import { beforeEach, describe, expect, it, vi } from "vitest";
+import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
 import type { CDPSessionLike } from "../../cdp.js";
+import { Progress } from "../../progress.js";
+import { executionContexts } from "../../executionContextRegistry.js";
 import { a11yForFrame } from "./a11yTree.js";
 import { resolveObjectIdForCss, resolveObjectIdForXPath } from "./focusSelectors.js";
 
-vi.mock("./focusSelectors.js", () => ({
+vi.mock("./focusSelectors.js", async (importOriginal) => ({
+  ...(await importOriginal<typeof import("./focusSelectors.js")>()),
   resolveObjectIdForCss: vi.fn(),
   resolveObjectIdForXPath: vi.fn(),
 }));
@@ -14,6 +17,92 @@ describe("a11yForFrame focused locators", () => {
     vi.resetAllMocks();
   });
 
+  afterEach(() => {
+    vi.useRealTimers();
+    vi.restoreAllMocks();
+  });
+
+  it.each(["Accessibility.getFullAXTree", "DOM.describeNode"])(
+    "does not fall back after %s exceeds the deadline",
+    async (command) => {
+      vi.useFakeTimers();
+      const progress = new Progress("act()", 10);
+      vi.mocked(resolveObjectIdForCss).mockResolvedValue("object-second");
+      const session = fakeSession(20, (method) => {
+        if (method === command) {
+          vi.spyOn(performance, "now").mockReturnValue(10);
+          throw new Error("Frame with the given id is not found");
+        }
+      });
+      const send = vi.spyOn(session, "send");
+      try {
+        await expect(
+          a11yForFrame(
+            session,
+            "frame",
+            {
+              focusLocator: { selector: ".card" },
+              tagNameMap: {},
+              scrollableMap: {},
+              encode: String,
+            },
+            progress,
+          ),
+        ).rejects.toThrow(/act\(\) timed out/);
+        expect(send.mock.calls.filter(([method]) => method === command)).toHaveLength(1);
+        if (command === "DOM.describeNode") {
+          expect(send).toHaveBeenCalledWith("Runtime.releaseObject", {
+            objectId: "object-second",
+          });
+        }
+      } finally {
+        progress.dispose();
+      }
+    },
+  );
+
+  it.each([".card", "xpath=//article"])(
+    "bounds a stalled %s focus lookup by the caller's deadline",
+    async (selector) => {
+      vi.useFakeTimers();
+      const progress = new Progress("snapshot", 10);
+      const actual =
+        await vi.importActual<typeof import("./focusSelectors.js")>("./focusSelectors.js");
+      vi.mocked(resolveObjectIdForCss).mockImplementation(actual.resolveObjectIdForCss);
+      vi.mocked(resolveObjectIdForXPath).mockImplementation(actual.resolveObjectIdForXPath);
+      const session = fakeSession(20, async (method) => {
+        if (method === "Runtime.evaluate") await new Promise((resolve) => setTimeout(resolve, 25));
+      });
+      executionContexts.registerExtensionWorld(session, "frame", 1);
+      const send = vi.spyOn(session, "send");
+      let failure: unknown;
+      const settled = a11yForFrame(
+        session,
+        "frame",
+        {
+          focusLocator: { selector },
+          tagNameMap: {},
+          scrollableMap: {},
+          encode: String,
+        },
+        progress,
+      ).catch((error: unknown) => {
+        failure = error;
+      });
+      try {
+        await vi.advanceTimersByTimeAsync(10);
+        const failureAtDeadline = failure;
+        await vi.advanceTimersByTimeAsync(15);
+        await settled;
+        expect(failureAtDeadline).toBe(progress.signal.reason);
+        expect(send).toHaveBeenCalledWith("Runtime.releaseObject", { objectId: "object-second" });
+        expect(send).not.toHaveBeenCalledWith("DOM.describeNode", expect.anything());
+      } finally {
+        progress.dispose();
+      }
+    },
+  );
+
   it.each([
     {
       name: "CSS",
@@ -30,6 +119,7 @@ describe("a11yForFrame focused locators", () => {
     async ({ selector, resolver }) => {
       vi.mocked(resolver).mockResolvedValue("object-second");
       const session = fakeSession(20);
+      const send = vi.spyOn(session, "send");
 
       const result = await a11yForFrame(session, "root-frame", {
         focusLocator: { selector, nth: 1 },
@@ -43,24 +133,35 @@ describe("a11yForFrame focused locators", () => {
       expect(result.outline).toContain("Second detail");
       expect(result.outline).not.toContain("First match");
       expect(result.outline).not.toContain("First detail");
-      expect(resolver).toHaveBeenCalledWith(session, selector, "root-frame", 1);
+      expect(resolver).toHaveBeenCalledWith(session, selector, "root-frame", 1, undefined);
+      expect(send).toHaveBeenCalledWith("Runtime.releaseObject", {
+        objectId: "object-second",
+      });
     },
   );
 });
 
-function fakeSession(focusedBackendNodeId: number): CDPSessionLike {
+function fakeSession(
+  focusedBackendNodeId: num
```

**File**: `packages/extension/understudy/a11y/snapshot/a11yTree.ts` (modified, +36/-16)
```diff
@@ -1,11 +1,16 @@
 import type { Protocol } from "devtools-protocol";
 import type { CDPSessionLike } from "../../cdp.js";
+import { type Progress, runLocatorStep } from "../../progress.js";
 import type {
   A11yNode,
   A11yOptions,
   AccessibilityTreeResult,
 } from "../../../types/private/snapshot.js";
-import { resolveObjectIdForCss, resolveObjectIdForXPath } from "./focusSelectors.js";
+import {
+  releaseSnapshotObject,
+  resolveObjectIdForCss,
+  resolveObjectIdForXPath,
+} from "./focusSelectors.js";
 import { formatTreeLine, normaliseSpaces } from "./treeFormatUtils.js";
 
 /**
@@ -16,27 +21,36 @@ export async function a11yForFrame(
   session: CDPSessionLike,
   frameId: string | undefined,
   opts: A11yOptions,
+  progress?: Progress,
 ): Promise<AccessibilityTreeResult> {
-  await session.send("Accessibility.enable").catch(() => {});
-  await session.send("Runtime.enable").catch(() => {});
-  await session.send("DOM.enable").catch(() => {});
+  await runLocatorStep(progress, "enabling Accessibility", () =>
+    session.send("Accessibility.enable").catch(() => {}),
+  );
+  await runLocatorStep(progress, "enabling Runtime", () =>
+    session.send("Runtime.enable").catch(() => {}),
+  );
+  await runLocatorStep(progress, "enabling DOM", () => session.send("DOM.enable").catch(() => {}));
 
   let nodes: Protocol.Accessibility.AXNode[] = [];
   try {
     const params = frameId ? ({ frameId } as Record<string, unknown>) : {};
-    ({ nodes } = await session.send<{
-      nodes: Protocol.Accessibility.AXNode[];
-    }>("Accessibility.getFullAXTree", params));
+    ({ nodes } = await runLocatorStep(progress, "reading snapshot accessibility tree", () =>
+      session.send<Protocol.Accessibility.GetFullAXTreeResponse>(
+        "Accessibility.getFullAXTree",
+        params,
+      ),
+    ));
   } catch (e) {
+    progress?.throwIfStopped();
     const msg = String((e as Error)?.message ?? e ?? "");
     const isFrameScopeError =
       msg.includes("Frame with the given") ||
       msg.includes("does not belong to the target") ||
       msg.includes("is not found");
     if (!isFrameScopeError || !frameId) throw e;
-    ({ nodes } = await session.send<{
-      nodes: Protocol.Accessibility.AXNode[];
-    }>("Accessibility.getFullAXTree"));
+    ({ nodes } = await runLocatorStep(progress, "reading snapshot accessibility tree", () =>
+      session.send<Protocol.Accessibility.GetFullAXTreeResponse>("Accessibility.getFullAXTree"),
+    ));
   }
 
   let scopeApplied = false;
@@ -45,16 +59,17 @@ export async function a11yForFrame(
     if (!locator) return nodes;
     const sel = locator.selector.trim();
     if (!sel) return nodes;
+    let objectId: string | null = null;
     try {
       const looksLikeXPath = /^xpath=/i.test(sel) || sel.startsWith("/");
       const nth = locator.nth ?? 0;
-      const objectId = looksLikeXPath
-        ? await resolveObjectIdForXPath(session, sel, frameId, nth)
-        : await resolveObjectIdForCss(session, sel, frameId, nth);
+      objectId = looksLikeXPath
+        ? await resolveObjectIdForXPath(session, sel, frameId, nth, progress)
+        : await resolveObjectIdForCss(session, sel, frameId, nth, progress);
       if (!objectId) return nodes;
-      const desc = await session.send<{ node?: { backendNodeId?: number } }>("DOM.describeNode", {
-        objectId,
-      });
+      const desc = await runLocatorStep(progress, "reading snapshot focus", () =>
+        session.send<Protocol.DOM.DescribeNodeResponse>("DOM.describeNode", { objectId }),
+      );
       const be = desc.node?.backendNodeId;
       if (typeof be !== "number") return nodes;
       const target = nodes.find((n) => n.backendDOMNodeId === be);
@@ -75,10 +90,14 @@ export async function a11yForFrame(
         .filter((n) => keep.has(n.nodeId))
         .map((n) => (n.nodeId === target.nodeId ? { ...n, parentId: undefined } : n));
     } catch {
+      progress?.throwIfStopped();
       return nodes;
+    } finally {
+      await releaseSnapshotObject(session, objectId ?? undefined, progress);
     }
   })();
 
+  progress?.throwIfStopped();
   const filteredNodes = nodesForOutline.filter((node) => {
     const be = node.backendDOMNodeId;
     return typeof be !== "number" || !opts.isIgnoredBackendNode?.(be);
@@ -97,6 +116,7 @@ export async function a11yForFrame(
   const decorated = decorateRoles(filteredNodes, opts);
   const { tree } = await buildHierarchicalTree(decorated, opts);
 
+  progress?.throwIfStopped();
   const simplified = tree.map((n) => formatTreeLine(n)).join("\n");
   return { outline: simplified.trimEnd(), urlMap, scopeApplied };
 }
```

**File**: `packages/extension/understudy/a11y/snapshot/capture.test.ts` (modified, +190/-3)
```diff
@@ -1,7 +1,9 @@
-import { beforeEach, describe, expect, it, vi } from "vitest";
+import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
 import type { FrameContext, FrameDomMaps, SessionDomIndex } from "../../../types/private/index.js";
 import type { StagehandLogger } from "../../../logger.js";
-import type { Page } from "../../page.js";
+import { Page } from "../../page.js";
+import { Progress } from "../../progress.js";
+import { executionContexts } from "../../executionContextRegistry.js";
 import { FrameSelectorResolver } from "../../selectorResolver.js";
 import { a11yForFrame } from "./a11yTree.js";
 import {
@@ -319,6 +321,7 @@ describe("snapshot Unicode repair", () => {
       expect.objectContaining({
         focusLocator: { selector: "#target", nth: 2 },
       }),
+      undefined,
     );
   });
 
@@ -356,7 +359,7 @@ describe("snapshot Unicode repair", () => {
         new Map(),
       );
 
-      expect(resolveAtIndex).toHaveBeenCalledWith({ kind: "css", value: ".card" }, 1);
+      expect(resolveAtIndex).toHaveBeenCalledWith({ kind: "css", value: ".card" }, 1, undefined);
       expect(resolveAll).not.toHaveBeenCalled();
       expect(ignoredNodes.get("root")).toEqual(new Set([20]));
       expect(session.send).toHaveBeenCalledWith("DOM.describeNode", { objectId: "object-second" });
@@ -366,3 +369,187 @@ describe("snapshot Unicode repair", () => {
     }
   });
 });
+
+describe("snapshot progress ownership", () => {
+  let page: Page;
+  let progress: Progress;
+  const root = { nodeId: 1, backendNodeId: 1, nodeName: "#document", children: [] };
+  const send = vi.fn(async (_method: string, _params?: unknown): Promise<unknown> => ({ root }));
+  const session = { id: "session", send };
+  const warn = vi.fn();
+
+  beforeEach(() => {
+    vi.resetAllMocks();
+    vi.useFakeTimers();
+    progress = new Progress("extract", 20);
+    send.mockResolvedValue({ root });
+    vi.mocked(ownerSession).mockReturnValue(session as never);
+    vi.mocked(parentSession).mockReturnValue(session as never);
+    vi.mocked(a11yForFrame).mockResolvedValue({ outline: "root", urlMap: {}, scopeApplied: false });
+    vi.mocked(resolveCssFocusFrameAndTail).mockResolvedValue({
+      targetFrameId: "root",
+      tailSelector: ".card",
+      absPrefix: "",
+    });
+    page = Object.assign(Object.create(Page.prototype) as Page, {
+      logger: { warn },
+      mainFrameId: () => "root",
+      listAllFrameIds: () => ["root", "child"],
+      asProtocolFrameTree: () => ({
+        frame: { id: "root" },
+        childFrames: [{ frame: { id: "child" } }],
+      }),
+      getOrdinal: (id: string) => (id === "root" ? 0 : 1),
+    });
+  });
+  afterEach(() => {
+    progress.dispose();
+    vi.useRealTimers();
+    vi.restoreAllMocks();
+  });
+
+  it.each(["public snapshot", "default snapshot", "nested snapshot", "nested capture"] as const)(
+    "%s stops at its deadline without continuing after a late response",
+    async (method) => {
+      let respond!: (value: unknown) => void;
+      send.mockImplementationOnce(
+        () =>
+          new Promise((resolve) => {
+            respond = resolve;
+          }),
+      );
+      await vi.advanceTimersByTimeAsync(10);
+      const result =
+        method === "default snapshot"
+          ? page.snapshot()
+          : method === "public snapshot"
+            ? page.snapshot({ timeout: 10 })
+            : method === "nested snapshot"
+              ? page.snapshot({ timeout: 1 }, progress)
+              : page.captureSnapshot({}, progress);
+      const timedOut = expect(result).rejects.toThrow(
+        method === "default snapshot"
+          ? /snapshot timed out after 20000ms/
+          : method === "public snapshot"
+            ? /snapshot timed out after 10ms/
+            : /extract timed out after 20ms/,
+      );
+      await vi.advanceTimersByTimeAsync(method === "default snapshot" ? 20_000 : 10);
+      await timedOut;
+      if (method.startsWith("nested")) await expect(result).rejects.toBe(progress.signal.reason);
+      respond({ root });
+      await vi.advanceTimersByTimeAsync(0);
+      expect(send).toHaveBeenCalledTimes(1);
+      expect(a11yForFrame).not.toHaveBeenCalled();
+    },
+  );
+
+  it.each([
+    { name: "explicit zero", capture: () => page.snapshot({ includeIframes: false, timeout: 0 }) },
+    { name: "internal capture", capture: () => page.captureSnapshot({ includeIframes: false }) },
+    { name: "unlimited parent", capture: () => page.snapshot({ includeIframes: false }, progress) },
+  ])("keeps $name unlimited beyond the public default", async ({ capture }) => {
+    progress.dispose();
+    progress = new Progress("extract", 0);
+    send.mockImplementationOnce(async () => {
+      await new Promise((resolve) => setTimeout(resolve, 25_000));
+      return {};
+    });
+    const result = capture();
+    await vi.advanceTimersByTimeAsync(25_000);
+    await expect(result).resolves.toBeDefined();
+
```

**File**: `packages/extension/understudy/a11y/snapshot/capture.ts` (modified, +136/-50)
```diff
@@ -3,6 +3,7 @@ import type { Locator } from "@browserbasehq/stagehand-protocol/types";
 import type { CDPSessionLike } from "../../cdp.js";
 import { Page } from "../../page.js";
 import { Frame } from "../../frame.js";
+import { type Progress, runLocatorStep } from "../../progress.js";
 import {
   FrameSelectorResolver,
   type ResolvedNode,
@@ -58,9 +59,11 @@ const toWellFormed = (value: string): string => (value as StringWithToWellFormed
  */
 export async function captureHybridSnapshot(
   page: Page,
-  options?: SnapshotOptions,
+  options: SnapshotOptions | undefined,
+  progress: Progress,
   logger: StagehandLogger = page.logger,
 ): Promise<HybridSnapshot> {
+  progress.throwIfStopped();
   const pierce = options?.pierceShadow ?? true;
   const includeIframes = options?.includeIframes !== false;
   const hasIgnoreLocators = (options?.ignoreLocators?.length ?? 0) > 0;
@@ -80,22 +83,25 @@ export async function captureHybridSnapshot(
       new Map<string, SessionDomIndex>(),
       new Map(),
       logger,
+      progress,
     );
     if (scopedSnapshot) return scopedSnapshot;
   }
 
-  const sessionToIndex = await buildSessionIndexes(page, framesInScope, pierce);
+  const sessionToIndex = await buildSessionIndexes(page, framesInScope, pierce, progress);
   const ignoredNodesByFrame = await resolveIgnoredNodes(
     page,
     options?.ignoreLocators,
     context,
     sessionToIndex,
+    progress,
   );
   const exclusionIntervalsByFrame = await buildFrameExclusionIntervals(
     page,
     context,
     sessionToIndex,
     ignoredNodesByFrame,
+    progress,
   );
   if (hasIgnoreLocators) {
     const scopedSnapshot = await tryScopedSnapshot(
@@ -106,6 +112,7 @@ export async function captureHybridSnapshot(
       sessionToIndex,
       exclusionIntervalsByFrame,
       logger,
+      progress,
     );
     if (scopedSnapshot) return scopedSnapshot;
   }
@@ -118,14 +125,17 @@ export async function captureHybridSnapshot(
     pierce,
     framesInScope,
     exclusionIntervalsByFrame,
+    progress,
   );
   const { absPrefix, iframeHostEncByChild } = await computeFramePrefixes(
     page,
     context,
     perFrameMaps,
     framesInScope,
+    progress,
   );
 
+  progress.throwIfStopped();
   return mergeFramesIntoSnapshot(
     context,
     perFrameMaps,
@@ -170,7 +180,9 @@ export async function tryScopedSnapshot(
   sessionToIndex: Map<string, SessionDomIndex>,
   exclusionIntervalsByFrame: ExclusionIntervalsByFrame,
   logger: StagehandLogger,
+  progress?: Progress,
 ): Promise<HybridSnapshot | null> {
+  progress?.throwIfStopped();
   const focusLocator = options?.focusLocator;
   if (!focusLocator) return null;
   const requestedFocus = focusLocator.selector.trim();
@@ -196,6 +208,7 @@ export async function tryScopedSnapshot(
         focus,
         context.parentByFrame,
         context.rootId,
+        progress,
       );
       targetFrameId = hit.targetFrameId;
       tailSelector = hit.tailXPath || undefined;
@@ -206,6 +219,7 @@ export async function tryScopedSnapshot(
         requestedFocus,
         context.parentByFrame,
         context.rootId,
+        progress,
       );
       targetFrameId = cssHit.targetFrameId;
       tailSelector = cssHit.tailSelector || undefined;
@@ -222,24 +236,30 @@ export async function tryScopedSnapshot(
       pierce,
       (fid, be) => `${page.getOrdinal(fid)}-${be}`,
       sameSessionAsParent,
+      progress,
     );
 
-    const { outline, urlMap, scopeApplied } = await a11yForFrame(owningSess, targetFrameId, {
-      focusLocator: tailSelector
-        ? {
-            selector: tailSelector,
-            ...(focusNth === undefined ? {} : { nth: focusNth }),
-          }
-        : undefined,
-      isIgnoredBackendNode: makeIsIgnoredBackendNode(
-        targetFrameId,
-        ownerSessionIndexForFrame(page, targetFrameId, sessionToIndex),
-        exclusionIntervalsByFrame,
-      ),
-      tagNameMap,
-      scrollableMap,
-      encode: (backendNodeId) => `${page.getOrdinal(targetFrameId)}-${backendNodeId}`,
-    });
+    const { outline, urlMap, scopeApplied } = await a11yForFrame(
+      owningSess,
+      targetFrameId,
+      {
+        focusLocator: tailSelector
+          ? {
+              selector: tailSelector,
+              ...(focusNth === undefined ? {} : { nth: focusNth }),
+            }
+          : undefined,
+        isIgnoredBackendNode: makeIsIgnoredBackendNode(
+          targetFrameId,
+          ownerSessionIndexForFrame(page, targetFrameId, sessionToIndex),
+          exclusionIntervalsByFrame,
+        ),
+        tagNameMap,
+        scrollableMap,
+        encode: (backendNodeId) => `${page.getOrdinal(targetFrameId)}-${backendNodeId}`,
+      },
+      progress,
+    );
 
     const scopedXpathMap: Record<string, string> = {};
     const isIgnoredBackendNode = makeIsIgnoredBackendNode(
@@ -291,6 +311,7 @@ export async function tryScopedSnapshot(
 
     logScopeFallback();
   } catch {
+    progress?.
```

**File**: `packages/extension/understudy/a11y/snapshot/domTree.test.ts` (modified, +40/-1)
```diff
@@ -1,9 +1,48 @@
 import type { Protocol } from "devtools-protocol";
-import { describe, expect, it, vi } from "vitest";
+import { afterEach, describe, expect, it, vi } from "vitest";
 import type { CDPSessionLike } from "../../cdp.js";
+import { Progress } from "../../progress.js";
 import { buildSessionDomIndex, getDomTreeWithFallback, hydrateDomTree } from "./domTree.js";
 
 describe("DOM tree adaptive retries", () => {
+  afterEach(() => {
+    vi.useRealTimers();
+  });
+
+  it.each(["DOM.getDocument", "DOM.describeNode"])(
+    "stops waiting for %s and ignores its late retryable error",
+    async (command) => {
+      vi.useFakeTimers();
+      const progress = new Progress("snapshot", 10);
+      let reject!: (error: Error) => void;
+      const pending = new Promise<never>((_, fail) => {
+        reject = fail;
+      });
+      const send = vi.fn(() => pending);
+      const session = { send } as unknown as CDPSessionLike;
+      const read =
+        command === "DOM.getDocument"
+          ? getDomTreeWithFallback(session, true, progress)
+          : hydrateDomTree(
+              session,
+              { nodeId: 1, childNodeCount: 1 } as Protocol.DOM.Node,
+              true,
+              progress,
+            );
+      const timedOut = expect(read).rejects.toThrow(/snapshot timed out/);
+      try {
+        await vi.advanceTimersByTimeAsync(10);
+        await timedOut;
+        reject(new Error("CBOR: stack limit exceeded"));
+        await vi.advanceTimersByTimeAsync(0);
+        expect(send).toHaveBeenCalledOnce();
+      } finally {
+        reject(new Error("test cleanup"));
+        progress.dispose();
+      }
+    },
+  );
+
   it("throws the last original DOM.getDocument retry error", async () => {
     const errors = Array.from(
       { length: 10 },
```

---

### Incident Patch 4: `1e3270c2` (2026-09-30)
**Commit Message**: [fix]: enforce `screenshot` & `pdf` deadlines across downstream steps (#3081)

# why
`screenshot()` timeouts could stop the caller waiting while downstream
functions (eg, preparation & mask lookup) continued without a shared
deadline. `pdf()` also used separate timeout handling. this PR makes
both `screenshot()` & `pdf()` use the `progress` tracker.
# what changed
- used shared progress for screenshots & pdfs, starting before queueing.
nested calls reuse their parent's remaining time.
- passed screenshot progress through preparation, mask lookup, tab
activation, & capture. mask lookup & its paint delay consume the same
budget.
- the timeout/deadline are checked before starting further browser
commands, including when the timeout timer has not fired yet.
already-issued commands can still finish.
- the page is kept unavailable until pending work & restoration finish.
stalled preparation or cleanup does not block other tabs; activation &
capture remain serialized across the browser.
- registered restoration before setup starts & released all resolved
mask nodes, including nodes skipped after expiry. cleanup cannot replace
an earlier capture error.
- preserved defaults: screenshots are

**File**: `packages/extension/understudy/frame.ts` (modified, +31/-20)
```diff
@@ -3,7 +3,6 @@ import { Protocol } from "devtools-protocol";
 import { type CDPSessionLike, isCdpClosedError } from "./cdp.js";
 import { Locator } from "./locator.js";
 import { type Progress, runLocatorStep } from "./progress.js";
-import { waitForScreenshot } from "./screenshotUtils.js";
 import { executionContexts } from "./executionContextRegistry.js";
 import type { StagehandLogger } from "../logger.js";
 
@@ -127,13 +126,17 @@ export class Frame implements FrameManager {
    * Evaluate a function or expression in this frame's main world.
    * - If a string is provided, treated as a JS expression.
    * - If a function is provided, it is stringified and invoked with the optional argument.
+   * Progress guards dispatch, but issued evaluations are awaited so screenshot
+   * restoration cannot run before a late page mutation finishes.
    */
   async evaluate<R = unknown, Arg = unknown>(
     pageFunctionOrExpression: string | ((arg: Arg) => R | Promise<R>),
     arg?: Arg,
+    progress?: Progress,
   ): Promise<R> {
+    progress?.throwIfStopped();
     await this.session.send("Runtime.enable").catch(() => {});
-    const contextId = await this.getMainWorldExecutionContextId();
+    const contextId = await this.getMainWorldExecutionContextId(progress);
 
     const isString = typeof pageFunctionOrExpression === "string";
     let expression: string;
@@ -157,6 +160,7 @@ export class Frame implements FrameManager {
 
     let res: Protocol.Runtime.EvaluateResponse;
     try {
+      progress?.throwIfStopped();
       res = await this.session.send<Protocol.Runtime.EvaluateResponse>("Runtime.evaluate", {
         expression,
         contextId,
@@ -168,7 +172,8 @@ export class Frame implements FrameManager {
       // Runtime.evaluate during popup/navigate churn. Retry once with a fresh id.
       const msg = error instanceof Error ? error.message : String(error);
       if (!msg.includes("Cannot find context with specified id")) throw error;
-      const freshContextId = await this.getMainWorldExecutionContextId();
+      const freshContextId = await this.getMainWorldExecutionContextId(progress);
+      progress?.throwIfStopped();
       res = await this.session.send<Protocol.Runtime.EvaluateResponse>("Runtime.evaluate", {
         expression,
         contextId: freshContextId,
@@ -234,17 +239,20 @@ export class Frame implements FrameManager {
   }
 
   /** Page.captureScreenshot (frame-scoped session) */
-  async screenshot(options?: {
-    fullPage?: boolean;
-    clip?: { x: number; y: number; width: number; height: number };
-    type?: "png" | "jpeg";
-    quality?: number;
-    scale?: number;
-    signal?: AbortSignal;
-  }): Promise<Uint8Array> {
-    const signal = options?.signal;
-    signal?.throwIfAborted();
-    await waitForScreenshot(this.session.send("Page.enable"), signal);
+  async screenshot(
+    options: {
+      fullPage?: boolean;
+      clip?: { x: number; y: number; width: number; height: number };
+      type?: "png" | "jpeg";
+      quality?: number;
+      scale?: number;
+    },
+    progress: Progress,
+  ): Promise<Uint8Array> {
+    // The page bounds the caller's wait. Await actual commands here so the capture
+    // lock stays held until Chrome finishes, even after the caller times out.
+    progress.throwIfStopped();
+    await this.session.send("Page.enable");
     const format = options?.type ?? "png";
     const params: Protocol.Page.CaptureScreenshotRequest & { scale?: number } = {
       format,
@@ -276,11 +284,14 @@ export class Frame implements FrameManager {
     }
 
     // Headless Chrome can wait indefinitely for a background tab to produce a frame.
-    await waitForScreenshot(this.session.send("Page.bringToFront"), signal);
-    const { data } = await waitForScreenshot(
-      this.session.send<Protocol.Page.CaptureScreenshotResponse>("Page.captureScreenshot", params),
-      signal,
+    progress.throwIfStopped();
+    await this.session.send("Page.bringToFront");
+    progress.throwIfStopped();
+    const { data } = await this.session.send<Protocol.Page.CaptureScreenshotResponse>(
+      "Page.captureScreenshot",
+      params,
     );
+    progress.throwIfStopped();
     return base64ToBytes(data);
   }
 
@@ -355,8 +366,8 @@ export class Frame implements FrameManager {
   }
 
   /** Resolve the main-world execution context id for this frame. */
-  async getMainWorldExecutionContextId(): Promise<number> {
-    return executionContexts.waitForMainWorld(this.session, this.frameId, 1000);
+  async getMainWorldExecutionContextId(progress?: Progress): Promise<number> {
+    return executionContexts.waitForMainWorld(this.session, this.frameId, 1000, progress);
   }
 
   async getExtensionWorldExecutionContextId(): Promise<number> {
```

**File**: `packages/extension/understudy/locator.ts` (modified, +5/-4)
```diff
@@ -948,29 +948,30 @@ export class Locator {
    * Resolve all matching nodes for this locator.
    * If the locator is narrowed via nth(), only that index is returned.
    */
-  public async resolveNodesForMask(): Promise<
+  public async resolveNodesForMask(progress: Progress): Promise<
     Array<{
       nodeId: Protocol.DOM.NodeId | null;
       objectId: Protocol.Runtime.RemoteObjectId;
     }>
   > {
     const session = this.frame.session;
 
-    await session.send("Runtime.enable");
-    await session.send("DOM.enable");
+    await progress.run("enabling runtime", () => session.send("Runtime.enable"));
+    await progress.run("enabling DOM", () => session.send("DOM.enable"));
 
     if (this.nthIndex >= 0) {
       const resolved = await this.selectorResolver.resolveAtIndex(
         this.selectorQuery,
         this.nthIndex,
+        progress,
       );
       if (!resolved) {
         throw new Error(`Could not find an element for the given xPath(s): ${this.selector}`);
       }
       return [resolved];
     }
 
-    const resolved = await this.selectorResolver.resolveAll(this.selectorQuery);
+    const resolved = await this.selectorResolver.resolveAll(this.selectorQuery, {}, progress);
     if (!resolved.length) {
       throw new Error(`Could not find an element for the given xPath(s): ${this.selector}`);
     }
```

**File**: `packages/extension/understudy/page.ts` (modified, +66/-52)
```diff
@@ -4,6 +4,7 @@ import type { CDPSessionLike } from "./cdp.js";
 import { CdpConnection } from "./cdp.js";
 import { evaluateWithShadowRoots } from "./shadowRootEvaluation.js";
 import { Frame } from "./frame.js";
+import { type Progress, runWithProgress } from "./progress.js";
 import { FrameLocator } from "./frameLocator.js";
 import { deepLocatorFromPage, resolveLocatorTarget } from "./deepLocator.js";
 import { captureHybridSnapshot } from "./a11y/snapshot/index.js";
@@ -57,7 +58,6 @@ import {
   runScreenshotCleanups,
   setTransparentBackground,
   withScreenshotLock,
-  waitForScreenshot,
   type ScreenshotCleanup,
 } from "./screenshotUtils.js";
 import { InitScriptSource } from "../types/private/index.js";
@@ -1506,7 +1506,10 @@ export class Page {
    * timeout error is thrown.
    * @param options.type Image format (`"png"` by default).
    */
-  async screenshot(options?: UnderstudyScreenshotOptions): Promise<Uint8Array> {
+  async screenshot(
+    options?: UnderstudyScreenshotOptions,
+    parentProgress?: Progress,
+  ): Promise<Uint8Array> {
     const opts = options ?? {};
     const type = opts.type ?? "png";
 
@@ -1532,65 +1535,74 @@ export class Page {
 
     const cleanupTasks: ScreenshotCleanup[] = [];
 
-    const exec = async (signal: AbortSignal): Promise<Uint8Array> => {
+    let failure: { error: unknown } | undefined;
+    const exec = async (progress: Progress): Promise<Uint8Array> => {
       try {
-        const captureScale = await waitForScreenshot(
-          computeScreenshotScale(this, scaleMode),
-          signal,
-        );
+        const captureScale = await computeScreenshotScale(this, scaleMode, progress);
         if (opts.omitBackground) {
-          signal.throwIfAborted();
-          cleanupTasks.push(await setTransparentBackground(this.mainSession));
+          await setTransparentBackground(this.mainSession, progress, cleanupTasks);
         }
 
         if (animationsMode === "disabled") {
-          signal.throwIfAborted();
-          cleanupTasks.push(await disableAnimations(frames));
+          await disableAnimations(frames, progress, cleanupTasks);
         }
 
         if (caretMode === "hide") {
-          signal.throwIfAborted();
-          cleanupTasks.push(await hideCaret(frames));
+          await hideCaret(frames, progress, cleanupTasks);
         }
 
         if (opts.style && opts.style.trim()) {
-          signal.throwIfAborted();
-          cleanupTasks.push(await applyStyleToFrames(frames, opts.style, "custom"));
+          await applyStyleToFrames(frames, opts.style, "custom", progress, cleanupTasks);
         }
 
         if (maskLocators.length > 0) {
-          signal.throwIfAborted();
-          cleanupTasks.push(await applyMaskOverlays(maskLocators, opts.maskColor ?? "#FF00FF"));
+          await applyMaskOverlays(
+            maskLocators,
+            opts.maskColor ?? "#FF00FF",
+            progress,
+            cleanupTasks,
+          );
         }
 
         // Setup and cleanup mutate this page only. Hold the browser-wide lock solely
-        // while activating and capturing, so a stalled page cannot block other tabs.
-        return await waitForScreenshot(
-          withScreenshotLock(
-            this.conn,
-            () =>
-              this.mainFrameWrapper.screenshot({
+        // while activating and capturing, so stalled preparation cannot block other tabs.
+        return await withScreenshotLock(
+          this.conn,
+          () =>
+            this.mainFrameWrapper.screenshot(
+              {
                 fullPage: opts.fullPage,
                 clip,
                 type,
                 quality: type === "jpeg" ? opts.quality : undefined,
                 scale: captureScale,
-                signal,
-              }),
-            undefined,
-          ),
-          signal,
+              },
+              progress,
+            ),
+          progress,
         );
+      } catch (error) {
+        progress.throwIfStopped();
+        failure = { error };
+        throw error;
       } finally {
         await runScreenshotCleanups(cleanupTasks);
       }
     };
 
-    return await withScreenshotLock(this, exec, opts.timeout);
+    try {
+      return await runWithProgress(
+        parentProgress ?? { name: "screenshot", timeout: opts.timeout ?? 0 },
+        (progress) => withScreenshotLock(this, () => exec(progress), progress),
+      );
+    } catch (error) {
+      // Cleanup may outlast the deadline; preserve a capture error already received.
+      throw failure ? failure.error : error;
+    }
   }
 
   /** Keep the PDF base64-encoded for transport; SDKs decode it to bytes. */
-  async pdf(options?: PagePDFOptions): Promise<PagePDFResult> {
+  async pdf(options?: PagePDFOptions, parentProgress?: Progress): Promise<PagePDFResult> {
     const {
       timeout = 30_000,
       width,
@@ -1600,28 +1612,30 @@ export class Page {
       outline = false,
       ...printOptions
     } = options ?
```

**File**: `packages/extension/understudy/pdf.test.ts` (modified, +223/-14)
```diff
@@ -4,11 +4,23 @@ import { TimeoutError } from "../errors.js";
 import { StagehandLogger } from "../logger.js";
 import { CdpConnection, type CDPSessionLike } from "./cdp.js";
 import { Page } from "./page.js";
+import { Locator } from "./locator.js";
+import { Progress } from "./progress.js";
 
 describe("Page.pdf", () => {
   let page: Page;
   const send = vi.fn(async (_method: string, _params?: object): Promise<unknown> => ({}));
 
+  const releaseResponses: Array<() => void> = [];
+  function hold<T>(value: T) {
+    let release!: () => void;
+    const promise = new Promise<T>((resolve) => {
+      release = () => resolve(value);
+    });
+    releaseResponses.push(release);
+    return { promise, release };
+  }
+
   beforeEach(() => {
     const logger = new StagehandLogger({ tracer: trace.getTracer("pdf-test") }, () => {});
     const connection = new CdpConnection(
@@ -34,12 +46,144 @@ describe("Page.pdf", () => {
     send.mockResolvedValue({ data: "JVBERi0xLjcK" });
   });
 
-  afterEach(() => {
+  afterEach(async () => {
+    for (const release of releaseResponses.splice(0)) release();
+    if (vi.isFakeTimers()) await vi.advanceTimersByTimeAsync(0);
     page.dispose();
     vi.useRealTimers();
     vi.restoreAllMocks();
   });
 
+  it("includes mask lookup and paint waiting in the parent's screenshot budget", async () => {
+    vi.useFakeTimers();
+    const progress = new Progress("extract", 105);
+    const locator = new Locator(page.mainFrame(), ".mask");
+    const mask = page.deepLocator("iframe >> .mask");
+    vi.spyOn(mask, "real").mockImplementation(async (received) => {
+      expect(received).toBe(progress);
+      await progress.delay(10);
+      return locator;
+    });
+    const resolve = vi
+      .spyOn(locator.selectorResolver, "resolveAll")
+      .mockResolvedValue([{ objectId: "mask-node", nodeId: null }]);
+    const evaluate = vi.spyOn(page.mainFrame(), "evaluate").mockResolvedValue(undefined);
+    send.mockResolvedValue({ result: { value: { x: 1, y: 2, width: 3, height: 4 } } });
+    await vi.advanceTimersByTimeAsync(10);
+    const screenshot = page.screenshot({ mask: [mask], caret: "initial", timeout: 999 }, progress);
+    const timedOut = expect(screenshot).rejects.toThrow("extract timed out after 105ms");
+    try {
+      await vi.advanceTimersByTimeAsync(10);
+      expect(resolve).toHaveBeenCalledWith(expect.any(Object), {}, progress);
+      expect(evaluate).toHaveBeenCalledTimes(1);
+      await vi.advanceTimersByTimeAsync(85);
+      await timedOut;
+      await expect(screenshot).rejects.toBe(progress.signal.reason);
+      expect(evaluate).toHaveBeenCalledTimes(2);
+      expect(send).toHaveBeenCalledWith("Runtime.releaseObject", { objectId: "mask-node" });
+      expect(send.mock.calls.some(([method]) => method === "Page.captureScreenshot")).toBe(false);
+    } finally {
+      progress.dispose();
+    }
+  });
+
+  it("restores late mask measurements and releases skipped nodes before allowing printing", async () => {
+    vi.useFakeTimers();
+    const locator = new Locator(page.mainFrame(), ".mask");
+    vi.spyOn(locator.selectorResolver, "resolveAll").mockResolvedValue([
+      { objectId: "first", nodeId: null },
+      { objectId: "second", nodeId: null },
+    ]);
+    const measurement = hold({
+      result: { value: { x: 1, y: 2, width: 3, height: 4, rootToken: "root" } },
+    });
+    send.mockImplementation(async (method) =>
+      method === "Runtime.callFunctionOn" ? measurement.promise : { data: "AQ==" },
+    );
+    const cleanup = hold(undefined);
+    const evaluate = vi.spyOn(page.mainFrame(), "evaluate").mockReturnValue(cleanup.promise);
+    const screenshot = page.screenshot({ mask: [locator], caret: "initial", timeout: 10 });
+    const timedOut = expect(screenshot).rejects.toThrow("screenshot timed out after 10ms");
+    await vi.advanceTimersByTimeAsync(10);
+    await timedOut;
+    expect(evaluate).not.toHaveBeenCalled();
+    await expect(page.pdf()).rejects.toThrow(/still recovering/);
+    measurement.release();
+    await vi.advanceTimersByTimeAsync(0);
+    expect(send.mock.calls.filter(([method]) => method === "Runtime.callFunctionOn")).toHaveLength(
+      1,
+    );
+    for (const objectId of ["first", "second"]) {
+      expect(send).toHaveBeenCalledWith("Runtime.releaseObject", { objectId });
+    }
+    expect(evaluate).toHaveBeenCalledTimes(1);
+    await expect(page.pdf()).rejects.toThrow(/still recovering/);
+    cleanup.release();
+    await vi.advanceTimersByTimeAsync(0);
+    await expect(page.pdf()).resolves.toEqual({ data: "AQ==" });
+    expect(send.mock.calls.some(([method]) => method === "Page.captureScreenshot")).toBe(false);
+  });
+
+  it("preserves a capture error when restoration stalls past the deadline", async () => {
+    vi.useFakeTimers();
+    vi.spyOn(page, "frames").mockReturnValue([page.mainFrame()]);
+    const failure = new Error("capture failed");
+    send.mockImplementation(async (me
```

**File**: `packages/extension/understudy/screenshotUtils.test.ts` (modified, +93/-28)
```diff
@@ -3,8 +3,11 @@ import { Page } from "./page.js";
 import { CdpConnection } from "./cdp.js";
 import { Frame } from "./frame.js";
 import { StagehandLogger } from "../logger.js";
-import { describe, expect, it, vi } from "vitest";
+import { afterEach, describe, expect, it, vi } from "vitest";
 import { withScreenshotLock } from "./screenshotUtils.js";
+import { Progress, runWithProgress } from "./progress.js";
+
+const captureCommands = ["Page.enable", "Page.bringToFront", "Page.captureScreenshot"];
 
 function connection() {
   return { send: vi.fn(), on: vi.fn(), off: vi.fn(), close: vi.fn(), id: null };
@@ -19,12 +22,26 @@ function captureGate() {
 }
 
 describe("screenshot serialization", () => {
+  const operations: Progress[] = [];
+  const progress = (timeout = 0) => {
+    const operation = new Progress("screenshot", timeout);
+    operations.push(operation);
+    return operation;
+  };
+  const runCapture = (owner: object, capture: () => Promise<Uint8Array>, operation: Progress) =>
+    runWithProgress(operation, (progress) => withScreenshotLock(owner, capture, progress));
+
+  afterEach(() => {
+    for (const operation of operations.splice(0)) operation.dispose();
+    vi.restoreAllMocks();
+  });
+
   it("keeps another page's capture queued until the first finishes", async () => {
     const browser = connection();
     const first = captureGate();
     const nextCapture = vi.fn(async () => new Uint8Array([2]));
-    const a = withScreenshotLock(browser, () => first.pending, undefined);
-    const b = withScreenshotLock(browser, nextCapture, undefined);
+    const a = runCapture(browser, () => first.pending, progress());
+    const b = runCapture(browser, nextCapture, progress());
     await Promise.resolve();
     expect(nextCapture).not.toHaveBeenCalled();
     first.release();
@@ -34,10 +51,10 @@ describe("screenshot serialization", () => {
 
   it("does not block a different browser", async () => {
     const first = captureGate();
-    const a = withScreenshotLock(connection(), () => first.pending, undefined);
+    const a = runCapture(connection(), () => first.pending, progress());
     try {
       await expect(
-        withScreenshotLock(connection(), async () => new Uint8Array([2]), undefined),
+        runCapture(connection(), async () => new Uint8Array([2]), progress()),
       ).resolves.toEqual(new Uint8Array([2]));
     } finally {
       first.release();
@@ -47,28 +64,26 @@ describe("screenshot serialization", () => {
 
   it("continues after a failed capture", async () => {
     const browser = connection();
-    const a = withScreenshotLock(
+    const a = runCapture(
       browser,
       async () => {
         throw new Error("capture failed");
       },
-      undefined,
+      progress(),
     );
-    const b = withScreenshotLock(browser, async () => new Uint8Array([2]), undefined);
+    const b = runCapture(browser, async () => new Uint8Array([2]), progress());
     await expect(a).rejects.toThrow("capture failed");
     await expect(b).resolves.toEqual(new Uint8Array([2]));
   });
 
-  it("releases a stalled capture only after cleanup, ignoring its late response", async () => {
+  it.each(captureCommands)("keeps stalled %s locked until recovery", async (command) => {
     vi.useFakeTimers();
     const browser = connection();
     let respond!: (value: { data: string }) => void;
     const response = new Promise<{ data: string }>((resolve) => {
       respond = resolve;
     });
-    browser.send.mockImplementation(async (method: string) =>
-      method === "Page.captureScreenshot" ? response : {},
-    );
+    browser.send.mockImplementation(async (method: string) => (method === command ? response : {}));
     const frame = new Frame(
       browser,
       "frame",
@@ -78,45 +93,81 @@ describe("screenshot serialization", () => {
     );
     const cleanup = captureGate();
     const cleanupStarted = vi.fn();
-    const first = withScreenshotLock(
+    const operation = progress(10);
+    const first = runCapture(
       browser,
-      async (signal) => {
+      async () => {
         try {
-          return await frame.screenshot({ signal });
+          return await frame.screenshot({}, operation);
         } finally {
           cleanupStarted();
           await cleanup.pending;
         }
       },
-      10,
+      operation,
     );
     const nextCapture = vi.fn(async () => new Uint8Array([2]));
-    const second = withScreenshotLock(browser, nextCapture, undefined);
+    const second = runCapture(browser, nextCapture, progress());
     const timedOut = expect(first).rejects.toThrow(/screenshot.*timed out/i);
     const blocked = expect(second).rejects.toThrow(/still recovering/);
     try {
       await vi.advanceTimersByTimeAsync(10);
       await timedOut;
-      expect(browser.send).toHaveBeenCalledWith("Page.captureScreenshot", expect.any(Object));
-      expect(cleanupStarted).toHaveBeenCalledOnce();
+      const expectedCommands = captureCommands.slice
```

**File**: `packages/extension/understudy/screenshotUtils.ts` (modified, +176/-165)
```diff
@@ -1,4 +1,4 @@
-import { TimeoutError } from "../errors.js";
+import type { Progress } from "./progress.js";
 import { Protocol } from "devtools-protocol";
 import type { CDPSessionLike } from "./cdp.js";
 import type { DeepLocatorDelegate } from "./deepLocator.js";
@@ -15,62 +15,62 @@ const screenshotQueues = new WeakMap<object, { tail: Promise<void>; blocked: Abo
 /** Serialize page mutations, or the browser-wide activation/capture critical section. */
 export async function withScreenshotLock<T>(
   owner: object,
-  capture: (signal: AbortSignal) => Promise<T>,
-  timeout: number | undefined,
-  operation = "screenshot",
+  capture: () => Promise<T>,
+  progress: Progress,
 ): Promise<T> {
+  progress.throwIfStopped();
   const queue = screenshotQueues.get(owner) ?? {
     tail: Promise.resolve(),
     blocked: new AbortController(),
   };
   // Keep late setup/cleanup isolated, but never make callers wait indefinitely for it.
   queue.blocked.signal.throwIfAborted();
-  const controller = new AbortController();
   let started = false;
-  const timer =
-    typeof timeout === "number" && Number.isFinite(timeout) && timeout > 0
-      ? setTimeout(
-          () => {
-            const error = new TimeoutError(operation, timeout);
-            controller.abort(error);
-            if (started) {
-              queue.blocked.abort(
-                new Error(`A previous capture is still recovering: ${error.message}`, {
-                  cause: error,
-                }),
-              );
-            }
-          },
-          Math.min(timeout, 2_147_483_647),
-        )
-      : undefined;
-  const pending = queue.tail.then(() => {
+  const onAbort = () => {
+    if (started) {
+      const error = progress.signal.reason as Error;
+      queue.blocked.abort(
+        new Error(`A previous capture is still recovering: ${error.message}`, { cause: error }),
+      );
+    }
+  };
+  progress.signal.addEventListener("abort", onAbort, { once: true });
+  const previous = queue.tail;
+  const pending = waitForScreenshot(
+    previous,
+    AbortSignal.any([queue.blocked.signal, progress.signal]),
+  ).then(async () => {
     queue.blocked.signal.throwIfAborted();
-    controller.signal.throwIfAborted();
+    progress.throwIfStopped();
     started = true;
-    return capture(controller.signal);
+    try {
+      return await capture();
+    } finally {
+      started = false;
+    }
   });
-  const released = pending.then(
+  const settled = pending.then(
     () => {},
     () => {},
   );
+  // A queued request can fail before the active capture finishes. Retain both
+  // promises so that failure cannot release the active capture's lock.
+  const released = Promise.all([previous, settled]).then(() => {});
   queue.tail = released;
   screenshotQueues.set(owner, queue);
   try {
-    return await waitForScreenshot(
-      waitForScreenshot(pending, queue.blocked.signal),
-      controller.signal,
-    );
+    // The page's operation bounds its caller; nested locks await actual recovery.
+    return await pending;
   } finally {
-    if (timer !== undefined) clearTimeout(timer);
+    progress.signal.removeEventListener("abort", onAbort);
     void released.then(() => {
       if (queue.tail === released) screenshotQueues.delete(owner);
     });
   }
 }
 
-/** Stop waiting for a stalled CDP capture; its eventual response cannot resume cleanup. */
-export async function waitForScreenshot<T>(pending: Promise<T>, signal?: AbortSignal): Promise<T> {
+/** Bound a wait by an operation or queue recovery signal. */
+async function waitForScreenshot<T>(pending: Promise<T>, signal?: AbortSignal): Promise<T> {
   if (!signal) return await pending;
   return await new Promise<T>((resolve, reject) => {
     const onAbort = () => {
@@ -124,46 +124,76 @@ export function normalizeScreenshotClip(clip: ScreenshotClip): ScreenshotClip {
 export async function computeScreenshotScale(
   page: Page,
   mode: NonNullable<UnderstudyScreenshotOptions["scale"]>,
+  progress: Progress,
 ): Promise<number | undefined> {
   if (mode !== "css") return undefined;
-  try {
-    const frame = page.mainFrame();
-    const dpr = await frame
-      .evaluate(() => {
+  const dpr = await page
+    .mainFrame()
+    .evaluate(
+      () => {
         const ratio = Number(window.devicePixelRatio || 1);
         return Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
-      })
-      .catch(() => 1);
-    const safeRatio = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
-    return Math.min(2, Math.max(0.1, 1 / safeRatio));
-  } catch {
-    return 1;
-  }
+      },
+      undefined,
+      progress,
+    )
+    .catch(() => {
+      progress.throwIfStopped();
+      return 1;
+    });
+  progress.throwIfStopped();
+  const safeRatio = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
+  return Math.min(2, Math.max(0.1, 1 / safeRatio));
 }
 
 export async function setTransparentBackground(
   session: CDPSessionLike,
-): Promise<ScreenshotCleanup> {
+  pro
```

---

### Incident Patch 5: `1562d350` (2026-09-30)
**Commit Message**: [feat]: expose timeout param in ts & protocol (#3033)

# why
this PR adds the `timeout` param to the protocol, & exposes it publicly
in ts. the default timeout is 20 seconds

# what changed
- added optional timeout settings to all 17 terminal locator methods,
including reads. typescript callers can use `click({ timeout: 5000 })`,
`fill("hello", { timeout: 5000 })`, or `count({ timeout: 0 })`.
- started one deadline before frame resolution & passed it through the
whole call. frame readiness, element lookup, typing delays, highlight
duration, & extension-side upload preparation all share that budget.
- aligned typescript response waits with the execution timeout plus
delivery grace. zero disables that response deadline too. long timeouts
avoid the JS timer limit, & timeout errors retain their name & message.
- made the compatibility facade pass its remaining budget to native
locator calls, including zero, instead of dropping timeout options

# test plan
- `locator-timeouts.test.ts` checks every registered locator method
accepts zero & positive timeouts, rejects invalid values, preserves
omission, & keeps existing options working. timeout settings stay
separate from locator identity.


**File**: `.changeset/long-apes-remain.md` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+---
+"@browserbasehq/stagehand-python": patch
+"@browserbasehq/stagehand-extension": patch
+"@browserbasehq/stagehand-protocol": patch
+"@browserbasehq/stagehand-go": patch
+"@browserbasehq/stagehand": patch
+---
+
+add per-call locator timeouts across TypeScript, Python, & Go. one timeout covers frame readiness, element lookup, & execution, including typing delays & highlight duration. the default is 20 seconds. setting timeout to 0 disables it.
```

**File**: `packages/docs/v4/reference/locator.mdx` (modified, +352/-4)
```diff
@@ -24,6 +24,14 @@ const locator = page.locator("button[type=submit]");
 await locator.click();
 ```
 
+Each locator call has a 20-second timeout covering frame readiness, element lookup, & the action itself. Typing delays & highlight duration count toward the same budget. File reading in the SDK & request delivery happen before that budget starts. A timeout stops further steps; it cannot undo browser commands already sent.
+
+```typescript
+await locator.click({ timeout: 5000 });
+await locator.fill("hello", { timeout: 5000 });
+const count = await locator.count({ timeout: 0 }); // no timeout
+```
+
 ## click()
 
 Click the element matched by this locator.
@@ -35,6 +43,10 @@ await locator.click();
 <ParamField path="options" type="LocatorClickOptions" optional>
   Options that configure this operation.
 
+  <ParamField path="options.timeout" type="number" optional>
+    The timeout for the whole call in milliseconds. Defaults to 20,000. Set to `0` to disable it.
+  </ParamField>
+
 <ParamField path="options.button" type="MouseButton" optional>
   The mouse button to use: `"left"`, `"middle"`, or `"right"`.
 </ParamField>
@@ -56,6 +68,14 @@ Move the pointer over the matched element.
 await locator.hover();
 ```
 
+<ParamField path="options" type="LocatorOptions" optional>
+  Options that configure this operation.
+
+  <ParamField path="options.timeout" type="number" optional>
+    The timeout for the whole call in milliseconds. Defaults to 20,000. Set to `0` to disable it.
+  </ParamField>
+</ParamField>
+
 <ResponseField name="result" type="Promise<void>">
   Resolves after the operation completes.
 </ResponseField>
@@ -72,6 +92,14 @@ await locator.fill("Browserbase");
   The value to set.
 </ParamField>
 
+<ParamField path="options" type="LocatorOptions" optional>
+  Options that configure this operation.
+
+  <ParamField path="options.timeout" type="number" optional>
+    The timeout for the whole call in milliseconds. Defaults to 20,000. Set to `0` to disable it.
+  </ParamField>
+</ParamField>
+
 <ResponseField name="result" type="Promise<void>">
   Resolves after the operation completes.
 </ResponseField>
@@ -84,6 +112,14 @@ Count the elements matched by this locator.
 const count = await locator.count();
 ```
 
+<ParamField path="options" type="LocatorOptions" optional>
+  Options that configure this operation.
+
+  <ParamField path="options.timeout" type="number" optional>
+    The timeout for the whole call in milliseconds. Defaults to 20,000. Set to `0` to disable it.
+  </ParamField>
+</ParamField>
+
 <ResponseField name="result" type="Promise<number>">
   The operation result.
 </ResponseField>
@@ -96,6 +132,14 @@ Check whether the matched control is checked.
 const checked = await locator.isChecked();
 ```
 
+<ParamField path="options" type="LocatorOptions" optional>
+  Options that configure this operation.
+
+  <ParamField path="options.timeout" type="number" optional>
+    The timeout for the whole call in milliseconds. Defaults to 20,000. Set to `0` to disable it.
+  </ParamField>
+</ParamField>
+
 <ResponseField name="result" type="Promise<boolean>">
   The operation result.
 </ResponseField>
@@ -108,6 +152,14 @@ Return the current value of the matched input.
 const value = await locator.inputValue();
 ```
 
+<ParamField path="options" type="LocatorOptions" optional>
+  Options that configure this operation.
+
+  <ParamField path="options.timeout" type="number" optional>
+    The timeout for the whole call in milliseconds. Defaults to 20,000. Set to `0` to disable it.
+  </ParamField>
+</ParamField>
+
 <ResponseField name="result" type="Promise<string>">
   The operation result.
 </ResponseField>
@@ -120,6 +172,14 @@ Check whether the matched element is visible.
 const visible = await locator.isVisible();
 ```
 
+<ParamField path="options" type="LocatorOptions" optional>
+  Options that configure this operation.
+
+  <ParamField path="options.timeout" type="number" optional>
+    The timeout for the whole call in milliseconds. Defaults to 20,000. Set to `0` to disable it.
+  </ParamField>
+</ParamField>
+
 <ResponseField name="result" type="Promise<boolean>">
   The operation result.
 </ResponseField>
@@ -132,6 +192,14 @@ Return the rendered text inside the matched element.
 const text = await locator.innerText();
 ```
 
+<ParamField path="options" type="LocatorOptions" optional>
+  Options that configure this operation.
+
+  <ParamField path="options.timeout" type="number" optional>
+    The timeout for the whole call in milliseconds. Defaults to 20,000. Set to `0` to disable it.
+  </ParamField>
+</ParamField>
+
 <ResponseField name="result" type="Promise<string>">
   The operation result.
 </ResponseField>
@@ -144,6 +212,14 @@ Return the HTML inside the matched element.
 const html = await locator.innerHtml();
 ```
 
+<ParamField path="options" type="LocatorOptions" optional>
+  Options that configure this operation.
+
+  <ParamField path="options.timeout" type="number" optional>
+    T
```

**File**: `packages/extension/controllers/locatorController.ts` (modified, +10/-10)
```diff
@@ -1,6 +1,6 @@
 import type {
   LocatorClickParams,
-  LocatorDescriptor,
+  LocatorParams,
   LocatorFillParams,
   LocatorHighlightParams,
   LocatorScrollToParams,
@@ -23,42 +23,42 @@ export function createLocatorController(runtime: StagehandRuntime) {
     return runtime.locatorFill(params);
   }
 
-  async function hover(params: LocatorDescriptor, { logger }: HandlerContext) {
+  async function hover(params: LocatorParams, { logger }: HandlerContext) {
     logger.debug("locator.hover", {});
     return runtime.locatorHover(params);
   }
 
-  async function count(params: LocatorDescriptor, { logger }: HandlerContext) {
+  async function count(params: LocatorParams, { logger }: HandlerContext) {
     logger.debug("locator.count", {});
     return runtime.locatorCount(params);
   }
 
-  async function isChecked(params: LocatorDescriptor, { logger }: HandlerContext) {
+  async function isChecked(params: LocatorParams, { logger }: HandlerContext) {
     logger.debug("locator.is_checked", {});
     return runtime.locatorIsChecked(params);
   }
 
-  async function inputValue(params: LocatorDescriptor, { logger }: HandlerContext) {
+  async function inputValue(params: LocatorParams, { logger }: HandlerContext) {
     logger.debug("locator.input_value", {});
     return runtime.locatorInputValue(params);
   }
 
-  async function isVisible(params: LocatorDescriptor, { logger }: HandlerContext) {
+  async function isVisible(params: LocatorParams, { logger }: HandlerContext) {
     logger.debug("locator.is_visible", {});
     return runtime.locatorIsVisible(params);
   }
 
-  async function innerText(params: LocatorDescriptor, { logger }: HandlerContext) {
+  async function innerText(params: LocatorParams, { logger }: HandlerContext) {
     logger.debug("locator.inner_text", {});
     return runtime.locatorInnerText(params);
   }
 
-  async function innerHtml(params: LocatorDescriptor, { logger }: HandlerContext) {
+  async function innerHtml(params: LocatorParams, { logger }: HandlerContext) {
     logger.debug("locator.inner_html", {});
     return runtime.locatorInnerHtml(params);
   }
 
-  async function textContent(params: LocatorDescriptor, { logger }: HandlerContext) {
+  async function textContent(params: LocatorParams, { logger }: HandlerContext) {
     logger.debug("locator.text_content", {});
     return runtime.locatorTextContent(params);
   }
@@ -68,7 +68,7 @@ export function createLocatorController(runtime: StagehandRuntime) {
     return runtime.locatorScrollTo(params);
   }
 
-  async function centroid(params: LocatorDescriptor, { logger }: HandlerContext) {
+  async function centroid(params: LocatorParams, { logger }: HandlerContext) {
     logger.debug("locator.centroid", {});
     return runtime.locatorCentroid(params);
   }
```

**File**: `packages/extension/runtime.ts` (modified, +111/-56)
```diff
@@ -1,3 +1,5 @@
+import { DEFAULT_LOCATOR_TIMEOUT_MS } from "@browserbasehq/stagehand-protocol/schemas";
+import { runWithProgress, type Progress } from "./understudy/progress.js";
 import { ShadowRootEvaluationUnavailableError } from "./errors.js";
 import type {
   ClearCookieOptions,
@@ -33,6 +35,7 @@ import type {
   LocatorCentroidResult,
   LocatorCountResult,
   LocatorDescriptor,
+  LocatorParams,
   LocatorFillParams,
   LocatorFillResult,
   LocatorHighlightParams,
@@ -224,23 +227,30 @@ export type UnderstudyRuntimeClipboard = {
 };
 
 export type UnderstudyRuntimeLocator = {
-  click(options?: LocatorClickParams["options"]): Promise<void> | void;
-  hover(): Promise<void> | void;
-  fill(value: string): Promise<void> | void;
-  count(): Promise<number>;
-  isChecked(): Promise<boolean>;
-  inputValue(): Promise<string>;
-  isVisible(): Promise<boolean>;
-  innerText(): Promise<string>;
-  innerHtml(): Promise<string>;
-  textContent(): Promise<string>;
-  scrollTo(percent: LocatorScrollToParams["percent"]): Promise<void> | void;
-  centroid(): Promise<LocatorCentroidResult>;
-  highlight(options?: LocatorHighlightParams["options"]): Promise<void> | void;
-  sendClickEvent(options?: LocatorSendClickEventParams["options"]): Promise<void> | void;
-  type(text: string, options?: LocatorTypeParams["options"]): Promise<void> | void;
-  selectOption(values: LocatorSelectOptionParams["values"]): Promise<string[]>;
-  setInputFiles(files: SetInputFilesArgument): Promise<void>;
+  click(options?: LocatorClickParams["options"], progress?: Progress): Promise<void> | void;
+  hover(progress?: Progress): Promise<void> | void;
+  fill(value: string, progress?: Progress): Promise<void> | void;
+  count(progress?: Progress): Promise<number>;
+  isChecked(progress?: Progress): Promise<boolean>;
+  inputValue(progress?: Progress): Promise<string>;
+  isVisible(progress?: Progress): Promise<boolean>;
+  innerText(progress?: Progress): Promise<string>;
+  innerHtml(progress?: Progress): Promise<string>;
+  textContent(progress?: Progress): Promise<string>;
+  scrollTo(percent: LocatorScrollToParams["percent"], progress?: Progress): Promise<void> | void;
+  centroid(progress?: Progress): Promise<LocatorCentroidResult>;
+  highlight(options?: LocatorHighlightParams["options"], progress?: Progress): Promise<void> | void;
+  sendClickEvent(
+    options?: LocatorSendClickEventParams["options"],
+    progress?: Progress,
+  ): Promise<void> | void;
+  type(
+    text: string,
+    options?: LocatorTypeParams["options"],
+    progress?: Progress,
+  ): Promise<void> | void;
+  selectOption(values: LocatorSelectOptionParams["values"], progress?: Progress): Promise<string[]>;
+  setInputFiles(files: SetInputFilesArgument, progress?: Progress): Promise<void>;
   nth(index: number): UnderstudyRuntimeLocator;
 };
 
@@ -831,99 +841,144 @@ export class StagehandRuntime {
   }
 
   async locatorClick(params: LocatorClickParams): Promise<LocatorClickResult> {
-    await this.resolveLocator(params).click(params.options);
+    await this.runLocator("locator.click", params, (locator, progress) =>
+      locator.click(params.options, progress),
+    );
     return { clicked: true };
   }
 
-  async locatorHover(params: LocatorDescriptor): Promise<LocatorHoverResult> {
-    await this.resolveLocator(params).hover();
+  async locatorHover(params: LocatorParams): Promise<LocatorHoverResult> {
+    await this.runLocator("locator.hover", params, (locator, progress) => locator.hover(progress));
     return { hovered: true };
   }
 
   async locatorFill(params: LocatorFillParams): Promise<LocatorFillResult> {
-    await this.resolveLocator(params).fill(params.value);
+    await this.runLocator("locator.fill", params, (locator, progress) =>
+      locator.fill(params.value, progress),
+    );
     return { filled: true };
   }
 
-  async locatorCount(params: LocatorDescriptor): Promise<LocatorCountResult> {
-    return await this.resolveLocator(params).count();
+  async locatorCount(params: LocatorParams): Promise<LocatorCountResult> {
+    return await this.runLocator("locator.count", params, (locator, progress) =>
+      locator.count(progress),
+    );
   }
 
-  async locatorIsChecked(params: LocatorDescriptor): Promise<LocatorIsCheckedResult> {
-    return await this.resolveLocator(params).isChecked();
+  async locatorIsChecked(params: LocatorParams): Promise<LocatorIsCheckedResult> {
+    return await this.runLocator("locator.is_checked", params, (locator, progress) =>
+      locator.isChecked(progress),
+    );
   }
 
-  async locatorInputValue(params: LocatorDescriptor): Promise<LocatorInputValueResult> {
-    return await this.resolveLocator(params).inputValue();
+  async locatorInputValue(params: LocatorParams): Promise<LocatorInputValueResult> {
+    return await this.runLocator("locator.input_value", params, (locator, progress) =>
+      locator.inputValue(progress),
+    );
   }
 
-  async locatorIsVisible(params: LocatorDescriptor
```

**File**: `packages/extension/tests/runtime-locator-timeouts.test.ts` (added, +85/-0)
```diff
@@ -0,0 +1,85 @@
+import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
+import { StagehandMethods } from "@browserbasehq/stagehand-protocol/schema-registry";
+import { DEFAULT_LOCATOR_TIMEOUT_MS } from "@browserbasehq/stagehand-protocol/schemas";
+import { createStagehandRuntime, type UnderstudyRuntimeLocator } from "../runtime.js";
+import { Progress } from "../understudy/progress.js";
+
+const methods = Object.entries(StagehandMethods).filter(([, method]) =>
+  method.name.startsWith("locator."),
+);
+const fields: Record<string, Record<string, unknown>> = {
+  locatorFill: { value: "hello" },
+  locatorType: { text: "hello" },
+  locatorScrollTo: { percent: 50 },
+  locatorSelectOption: { values: "a" },
+  locatorSetInputFiles: { files: [{ name: "hello.txt", data: "aGVsbG8=" }] },
+};
+
+describe("runtime locator deadlines", () => {
+  beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] }));
+  afterEach(() => {
+    vi.restoreAllMocks();
+    vi.useRealTimers();
+  });
+
+  describe.each(methods)("%s", (key, method) => {
+    it.each([undefined, {}, { timeout: 50 }, { timeout: 0 }])(
+      "owns a deadline before resolution with options %j",
+      async (options) => {
+        const runtime = createStagehandRuntime();
+        let progress: Progress | undefined;
+        let complete!: () => void;
+        const work = new Promise<void>((resolve) => {
+          complete = resolve;
+        });
+        const actionName = key.slice("locator".length);
+        const action = vi.fn((...args: unknown[]) => {
+          progress = args.at(-1) as Progress;
+          expect(progress).toBeInstanceOf(Progress);
+          expect(progress.name).toBe(method.name);
+          return work;
+        });
+        const budget = options?.timeout ?? DEFAULT_LOCATOR_TIMEOUT_MS;
+        vi.spyOn(runtime, "resolveLocator").mockImplementation(() => {
+          expect(vi.getTimerCount()).toBe(budget === 0 ? 0 : 1);
+          // Resolution has already spent part of this call's budget.
+          vi.advanceTimersByTime(10);
+          return {
+            [actionName[0]!.toLowerCase() + actionName.slice(1)]: action,
+          } as unknown as UnderstudyRuntimeLocator;
+        });
+        const invoke = runtime[key as keyof typeof runtime] as (
+          params: unknown,
+        ) => Promise<unknown>;
+        const pending = invoke.call(runtime, {
+          pageId: "page-1",
+          selector: "iframe >> button",
+          ...fields[key],
+          ...(options ? { options } : {}),
+        });
+        const observed = pending.catch((error: unknown) => error);
+        await vi.advanceTimersByTimeAsync(0);
+        expect(action).toHaveBeenCalledOnce();
+        expect(progress!.remainingMs()).toBe(budget === 0 ? Infinity : budget - 10);
+        if (budget === 0) {
+          await vi.advanceTimersByTimeAsync(DEFAULT_LOCATOR_TIMEOUT_MS + 1);
+          expect(progress!.signal.aborted).toBe(false);
+          complete();
+          await pending;
+        } else {
+          await vi.advanceTimersByTimeAsync(budget - 11);
+          expect(progress!.signal.aborted).toBe(false);
+          await vi.advanceTimersByTimeAsync(1);
+          expect(await observed).toMatchObject({
+            name: "TimeoutError",
+            message: expect.stringContaining(method.name),
+          });
+          expect(progress!.signal.aborted).toBe(true);
+          complete();
+        }
+        await vi.advanceTimersByTimeAsync(0);
+        expect(vi.getTimerCount()).toBe(0);
+      },
+    );
+  });
+});
```

**File**: `packages/extension/understudy/locatorActions.test.ts` (modified, +29/-14)
```diff
@@ -1,5 +1,6 @@
 import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
 import { TimeoutError } from "../errors.js";
+import { createStagehandRuntime } from "../runtime.js";
 import {
   assignFilePayloadsToInputElement,
   fillElementValue,
@@ -67,6 +68,19 @@ function createLocator(selector = "button") {
   return { locator, frame, resolveNode, readiness, send };
 }
 
+function runPublicAction(locator: Locator, action: "highlight" | "upload") {
+  const runtime = createStagehandRuntime();
+  vi.spyOn(runtime, "resolveLocator").mockReturnValue(locator);
+  const descriptor = { pageId: "page-1", selector: "button" };
+  return action === "highlight"
+    ? runtime.locatorHighlight({ ...descriptor, options: { durationMs: 0, timeout: 100 } })
+    : runtime.locatorSetInputFiles({
+        ...descriptor,
+        files: [{ name: "test.txt", data: "YWJj", lastModified: 1 }],
+        options: { timeout: 100 },
+      });
+}
+
 function createFillLocator(legacy = false) {
   const fixture = createLocator();
   let nextNode = 0;
@@ -753,7 +767,7 @@ describe("locator action deadlines", () => {
   );
 
   it.each(["highlight", "upload"] as const)(
-    "preserves the primary %s error while cleanup is stalled",
+    "preserves the primary %s error through the runtime while cleanup is stalled",
     async (action) => {
       const { locator, send } = createLocator();
       const primary = new Error("action failed");
@@ -771,11 +785,7 @@ describe("locator action deadlines", () => {
         return respond(method, params);
       });
       const settled = vi.fn();
-      const pending = runWithProgress({ name: action, timeout: 100 }, (progress) =>
-        action === "highlight"
-          ? locator.highlight({ durationMs: 0 }, progress)
-          : locator.setInputFiles(upload, progress),
-      );
+      const pending = runPublicAction(locator, action);
       void pending.then(settled, settled);
       try {
         await vi.advanceTimersByTimeAsync(0);
@@ -792,9 +802,14 @@ describe("locator action deadlines", () => {
     },
   );
 
-  it.each(["highlight", "upload"] as const)(
-    "reports an expired %s without waiting for stalled cleanup",
-    async (action) => {
+  it.each([
+    ["highlight", false],
+    ["upload", false],
+    ["highlight", true],
+    ["upload", true],
+  ] as const)(
+    "reports an expired %s without waiting for stalled cleanup (runtime: %s)",
+    async (action, throughRuntime) => {
       const { locator, send } = createLocator();
       const work = deferred();
       const cleanup = deferred();
@@ -810,11 +825,11 @@ describe("locator action deadlines", () => {
           return work.promise;
         return respond(method, params);
       });
-      const progress = createProgress();
-      const pending =
-        action === "highlight"
-          ? locator.highlight({ durationMs: 0 }, progress)
-          : locator.setInputFiles(upload, progress);
+      const pending = throughRuntime
+        ? runPublicAction(locator, action)
+        : action === "highlight"
+          ? locator.highlight({ durationMs: 0 }, createProgress())
+          : locator.setInputFiles(upload, createProgress());
       const settled = vi.fn();
       void pending.then(settled, settled);
       try {
```

**File**: `packages/integrations/core/src/facade/runtime.ts` (modified, +110/-55)
```diff
@@ -46,23 +46,29 @@ type QueryStep =
 
 type RoleStep = Extract<QueryStep, { kind: "role" }>;
 
+type LocatorTimeoutOptions = { timeout?: number };
+
 type RawLocator = {
-  click(options?: { button?: "left" | "right" | "middle"; clickCount?: number }): Promise<void>;
-  hover(): Promise<void>;
-  fill(value: string): Promise<void>;
-  type(text: string, options?: { delay?: number }): Promise<void>;
-  selectOption(values: string | string[]): Promise<string[]>;
-  setInputFiles(files: unknown): Promise<void>;
-  count(): Promise<number>;
+  click(options?: {
+    button?: "left" | "right" | "middle";
+    clickCount?: number;
+    timeout?: number;
+  }): Promise<void>;
+  hover(options?: LocatorTimeoutOptions): Promise<void>;
+  fill(value: string, options?: LocatorTimeoutOptions): Promise<void>;
+  type(text: string, options?: { delay?: number; timeout?: number }): Promise<void>;
+  selectOption(values: string | string[], options?: LocatorTimeoutOptions): Promise<string[]>;
+  setInputFiles(files: unknown, options?: LocatorTimeoutOptions): Promise<void>;
+  count(options?: LocatorTimeoutOptions): Promise<number>;
   nth(index: number): RawLocator;
-  isVisible(): Promise<boolean>;
-  isChecked(): Promise<boolean>;
-  inputValue(): Promise<string>;
-  innerText(): Promise<string>;
-  innerHtml(): Promise<string>;
-  textContent(): Promise<string>;
-  scrollTo(percent: number): Promise<void>;
-  centroid(): Promise<{ x: number; y: number }>;
+  isVisible(options?: LocatorTimeoutOptions): Promise<boolean>;
+  isChecked(options?: LocatorTimeoutOptions): Promise<boolean>;
+  inputValue(options?: LocatorTimeoutOptions): Promise<string>;
+  innerText(options?: LocatorTimeoutOptions): Promise<string>;
+  innerHtml(options?: LocatorTimeoutOptions): Promise<string>;
+  textContent(options?: LocatorTimeoutOptions): Promise<string>;
+  scrollTo(percent: number, options?: LocatorTimeoutOptions): Promise<void>;
+  centroid(options?: LocatorTimeoutOptions): Promise<{ x: number; y: number }>;
 };
 
 type CompatSelectOption =
@@ -169,6 +175,13 @@ export async function createPlaywrightCompatRuntime(
     error?: { name: string; message: string; stack?: string };
   };
 
+  const locatorTimeoutOptions = (deadline: number, method: string): LocatorTimeoutOptions => {
+    if (deadline === Infinity) return { timeout: 0 };
+    const remaining = deadline - Date.now();
+    if (remaining <= 0) throw new Error(`${method}: timed out`);
+    return { timeout: remaining };
+  };
+
   const stats: CompatStats = { calls: {}, misses: {} };
   const record = (bucket: "calls" | "misses", method: string): void => {
     stats[bucket][method] = (stats[bucket][method] ?? 0) + 1;
@@ -1396,7 +1409,7 @@ export async function createPlaywrightCompatRuntime(
 
     private async withTaggedTarget(
       method: string,
-      action: (locator: RawLocator) => Promise<void>,
+      action: (locator: RawLocator, options: LocatorTimeoutOptions) => Promise<void>,
       options: { timeout?: number } = {},
     ): Promise<void> {
       record("calls", method);
@@ -1409,7 +1422,7 @@ export async function createPlaywrightCompatRuntime(
       const deadline = timeout === 0 ? Infinity : Date.now() + timeout;
       let result: QueryResult = { count: 0 };
       let lastActionError: unknown;
-      while (Date.now() <= deadline) {
+      while (Date.now() < deadline) {
         result = await this.state.execute(this.plan, "inspect");
         if (result.count > 1) throw await this.strictModeViolation(method, result.count);
         if (result.count === 1) {
@@ -1421,7 +1434,10 @@ export async function createPlaywrightCompatRuntime(
           await this.state.execute(this.plan, "tag", { token });
           let actionSucceeded = false;
           try {
-            await action(this.state.rawPage.locator(`[data-stagehand-pw-compat="${token}"]`));
+            await action(
+              this.state.rawPage.locator(`[data-stagehand-pw-compat="${token}"]`),
+              locatorTimeoutOptions(deadline, method),
+            );
             actionSucceeded = true;
           } catch (error) {
             lastActionError = error;
@@ -1481,8 +1497,9 @@ export async function createPlaywrightCompatRuntime(
       }
       await this.withTaggedTarget(
         method,
-        (locator) =>
+        (locator, timeoutOptions) =>
           locator.click({
+            ...timeoutOptions,
             ...(typeof options.button === "string"
               ? { button: options.button as "left" | "right" | "middle" }
               : {}),
@@ -1493,17 +1510,21 @@ export async function createPlaywrightCompatRuntime(
     }
 
     async fill(value: string, options: Record<string, unknown> = {}): Promise<void> {
-      await this.withTaggedTarget("locator.fill", (locator) => locator.fill(value), options);
+      await this.withTaggedTarget(
+        "locator.fill",
+        (locator, timeoutOptions) => locator.fill(value, timeoutOptions),
+        options,
+      );
     }
```

**File**: `packages/integrations/core/tests/facade-locator-actions.test.ts` (modified, +26/-3)
```diff
@@ -28,7 +28,7 @@ async function fixture({
       return { count: Date.now() >= appearedAt ? 1 : 0, value: checked, visible: true };
     }),
     waitForTimeout: (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
-    locator: () => ({ click }),
+    locator: () => ({ click, count: async () => (Date.now() >= appearedAt ? 1 : 0) }),
   };
   // Errors and timeout helpers must survive the callback serialization boundary.
   const create = new Function(
@@ -38,8 +38,15 @@ async function fixture({
     page: rawPage,
     context: { pages: async () => [rawPage] },
   } as unknown as Parameters<typeof createPlaywrightCompatRuntime>[0]);
-  const page = runtime.page as { locator(selector: string): Locator };
-  return { locator: page.locator("input"), click };
+  const page = runtime.page as {
+    locator(selector: string): Locator;
+    frameLocator(selector: string): { locator(selector: string): Locator };
+  };
+  return {
+    locator: page.locator("input"),
+    frameLocator: page.frameLocator("iframe").locator("input"),
+    click,
+  };
 }
 
 describe("facade locator action deadlines", () => {
@@ -49,6 +56,22 @@ describe("facade locator action deadlines", () => {
   });
   afterEach(() => vi.useRealTimers());
 
+  describe.each(["locator", "frameLocator"] as const)("%s forwarding", (kind) => {
+    it.each([undefined, 0, 75])("forwards timeout %s to the native action", async (timeout) => {
+      const fixtureResult = await fixture();
+      await fixtureResult[kind].click(timeout === undefined ? {} : { timeout });
+      expect(fixtureResult.click).toHaveBeenCalledWith({ timeout: timeout ?? 10_000 });
+    });
+
+    it("forwards only the budget left after finding the target", async () => {
+      const fixtureResult = await fixture({ appearedAt: 100 });
+      const pending = fixtureResult[kind].click({ timeout: 150 });
+      await vi.advanceTimersByTimeAsync(100);
+      await pending;
+      expect(fixtureResult.click).toHaveBeenCalledWith({ timeout: 50 });
+    });
+  });
+
   it.each(["check", "uncheck"] as const)("bounds the absent-element %s probe", async (method) => {
     const { locator, click } = await fixture({ appearedAt: Infinity });
     const pending = expect(locator[method]({ timeout: 60 })).rejects.toThrow(/60ms/);
```

---

### Incident Patch 6: `d3043c8e` (2026-09-30)
**Commit Message**: [feat]: add timeout support to locator inputs, highlight & upload  (#3026)

# why
`fill()`, `type()`, `highlight()`, & `setInputFiles()` perform multiple
steps within one call. those steps need to share the caller's deadline,
including typing fallbacks, intentional delays, & file preparation.
otherwise, they can continue sending browser commands after the call
times out

# what changed
- passed the progress object downstream through `fill()`, `type()`,
`highlight()`, `setInputFiles()`, & their existing delegates
- made both fill fallbacks reuse the original deadline. timeout or
closed connection/session errors prevent fallback to typing. each
browser reference is released once, including when an early release
stalls.
- bounded text preparation & keyboard commands. typing delays use the
remaining budget & stop on expiry.
- bounded highlight setup, drawing, duration, & refresh waits.
successful `durationMs: 0` calls still leave the highlight visible.
timeout or failure triggers removal, including another removal attempt
if a draw finishes late.
- combined overlay removal & reference release into one bounded cleanup
wait. cleanup failures cannot replace the action error.
- included fi

**File**: `packages/extension/understudy/deepLocator.ts` (modified, +15/-12)
```diff
@@ -138,11 +138,11 @@ export class DeepLocatorDelegate {
   async hover(progress?: Progress) {
     return (await this.real(progress)).hover(progress);
   }
-  async fill(value: string) {
-    return (await this.real()).fill(value);
+  async fill(value: string, progress?: Progress) {
+    return (await this.real(progress)).fill(value, progress);
   }
-  async type(text: string, options?: { delay?: number }) {
-    return (await this.real()).type(text, options);
+  async type(text: string, options?: { delay?: number }, progress?: Progress) {
+    return (await this.real(progress)).type(text, options, progress);
   }
   async selectOption(values: string | string[], progress?: Progress) {
     return (await this.real(progress)).selectOption(values, progress);
@@ -174,12 +174,15 @@ export class DeepLocatorDelegate {
   async backendNodeId(progress?: Progress) {
     return (await this.real(progress)).backendNodeId(progress);
   }
-  async highlight(options?: {
-    durationMs?: number;
-    borderColor?: { r: number; g: number; b: number; a?: number };
-    contentColor?: { r: number; g: number; b: number; a?: number };
-  }) {
-    return (await this.real()).highlight(options);
+  async highlight(
+    options?: {
+      durationMs?: number;
+      borderColor?: { r: number; g: number; b: number; a?: number };
+      contentColor?: { r: number; g: number; b: number; a?: number };
+    },
+    progress?: Progress,
+  ) {
+    return (await this.real(progress)).highlight(options, progress);
   }
   async sendClickEvent(
     options?: {
@@ -192,8 +195,8 @@ export class DeepLocatorDelegate {
   ) {
     return (await this.real(progress)).sendClickEvent(options, progress);
   }
-  async setInputFiles(files: SetInputFilesArgument) {
-    return (await this.real()).setInputFiles(files);
+  async setInputFiles(files: SetInputFilesArgument, progress?: Progress) {
+    return (await this.real(progress)).setInputFiles(files, progress);
   }
   first() {
     return this.nth(0);
```

**File**: `packages/extension/understudy/frameLocator.ts` (modified, +4/-4)
```diff
@@ -132,11 +132,11 @@ class LocatorDelegate {
   async hover(progress?: Progress) {
     return (await this.real(progress)).hover(progress);
   }
-  async fill(value: string) {
-    return (await this.real()).fill(value);
+  async fill(value: string, progress?: Progress) {
+    return (await this.real(progress)).fill(value, progress);
   }
-  async type(text: string, options?: { delay?: number }) {
-    return (await this.real()).type(text, options);
+  async type(text: string, options?: { delay?: number }, progress?: Progress) {
+    return (await this.real(progress)).type(text, options, progress);
   }
   async selectOption(values: string | string[], progress?: Progress) {
     return (await this.real(progress)).selectOption(values, progress);
```

**File**: `packages/extension/understudy/locator.ts` (modified, +207/-126)
```diff
@@ -78,61 +78,68 @@ export class Locator {
    * File objects in the page. Filesystem paths are not available in workers.
    * - Passing an empty array clears the selection.
    */
-  public async setInputFiles(files: SetInputFilesArgument): Promise<void> {
+  public async setInputFiles(files: SetInputFilesArgument, progress?: Progress): Promise<void> {
     const session = this.frame.session;
-    const { objectId } = await this.resolveNode();
+    const { objectId } = await this.resolveNode(progress);
+    let completed = false;
 
     try {
       // Validate element is an <input type="file">
-      const res = await session.send<Protocol.Runtime.CallFunctionOnResponse>(
-        "Runtime.callFunctionOn",
-        {
+      const res = await runLocatorStep(progress, "validating file input", () =>
+        session.send<Protocol.Runtime.CallFunctionOnResponse>("Runtime.callFunctionOn", {
           objectId,
           functionDeclaration: ensureFileInputElement.toString(),
           returnByValue: true,
-        },
+        }),
       );
       const ok = Boolean(res.result.value);
       if (!ok) throw new TypeError('Target is not an <input type="file"> element');
 
-      const normalized = await normalizeInputFiles(files);
-
-      if (!normalized.length) {
-        await this.assignFilesViaPayloadInjection(objectId, []);
-        return;
-      }
-
-      await this.assignFilesViaPayloadInjection(objectId, normalized);
+      const normalized = await runLocatorStep(progress, "preparing file uploads", () =>
+        normalizeInputFiles(files),
+      );
+      await this.assignFilesViaPayloadInjection(objectId, normalized, progress);
+      completed = true;
     } finally {
-      await session.send<never>("Runtime.releaseObject", { objectId }).catch(() => {});
+      const release = () =>
+        session.send<never>("Runtime.releaseObject", { objectId }).catch(() => {});
+      // A failed action must reach the caller before cleanup can consume its deadline.
+      if (progress && !completed) void progress.cleanup(release);
+      else if (progress) await progress.cleanup(release);
+      else await release();
+      progress?.throwIfStopped();
     }
   }
 
   /** Build File objects inside the page and attach them via JS. */
   async assignFilesViaPayloadInjection(
     objectId: Protocol.Runtime.RemoteObjectId,
     files: NormalizedFilePayload[],
+    progress?: Progress,
   ): Promise<void> {
     const session = this.frame.session;
 
-    for (const payload of files) {
-      if (payload.bytes.length > MAX_REMOTE_UPLOAD_BYTES) {
-        throw new RangeError(
-          `setInputFiles(): file "${payload.name}" is larger than the 50MB limit for remote uploads`,
-        );
+    const serialized = await runLocatorStep(progress, "encoding file uploads", async () => {
+      for (const payload of files) {
+        if (payload.bytes.length > MAX_REMOTE_UPLOAD_BYTES) {
+          throw new RangeError(
+            `setInputFiles(): file "${payload.name}" is larger than the 50MB limit for remote uploads`,
+          );
+        }
       }
-    }
-
-    const serialized = files.map((payload) => ({
-      name: payload.name,
-      mimeType: payload.mimeType,
-      lastModified: payload.lastModified,
-      base64: bytesToBase64(payload.bytes),
-    }));
+      return files.map((payload) => {
+        progress?.throwIfStopped();
+        return {
+          name: payload.name,
+          mimeType: payload.mimeType,
+          lastModified: payload.lastModified,
+          base64: bytesToBase64(payload.bytes),
+        };
+      });
+    });
 
-    const res = await session.send<Protocol.Runtime.CallFunctionOnResponse>(
-      "Runtime.callFunctionOn",
-      {
+    const res = await runLocatorStep(progress, "assigning files", () =>
+      session.send<Protocol.Runtime.CallFunctionOnResponse>("Runtime.callFunctionOn", {
         objectId,
         functionDeclaration: assignFilePayloadsToInputElement.toString(),
         arguments: [
@@ -141,7 +148,7 @@ export class Locator {
           },
         ],
         returnByValue: true,
-      },
+      }),
     );
 
     const ok = Boolean(res.result?.value);
@@ -223,32 +230,71 @@ export class Locator {
    * - Scrolls element into view best-effort.
    * - Shows a semi-transparent overlay briefly, then hides it.
    */
-  public async highlight(options?: {
-    durationMs?: number;
-    borderColor?: { r: number; g: number; b: number; a?: number };
-    contentColor?: { r: number; g: number; b: number; a?: number };
-  }): Promise<void> {
+  public async highlight(
+    options?: {
+      durationMs?: number;
+      borderColor?: { r: number; g: number; b: number; a?: number };
+      contentColor?: { r: number; g: number; b: number; a?: number };
+    },
+    progress?: Progress,
+  ): Promise<void> {
     const session = this.frame.session;
-    const { objectId } = await this.resolveNode();
+    const { objectId } = await this.resolveNode(progress);
   
```

**File**: `packages/extension/understudy/locatorActions.test.ts` (modified, +617/-11)
```diff
@@ -1,14 +1,25 @@
 import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
 import { TimeoutError } from "../errors.js";
+import {
+  assignFilePayloadsToInputElement,
+  fillElementValue,
+  prepareElementForTyping,
+} from "../dom/locatorScripts/scripts.js";
 import type { Frame } from "./frame.js";
 import type { Page } from "./page.js";
 import { DeepLocatorDelegate } from "./deepLocator.js";
 import { frameLocatorFromFrame } from "./frameLocator.js";
 import { executionContexts } from "./executionContextRegistry.js";
 import { Locator } from "./locator.js";
+import * as fileUploads from "./fileUploadUtils.js";
 import { Progress, runWithProgress } from "./progress.js";
 
+const upload = { name: "test.txt", buffer: "abc", lastModified: 1 };
 const actions = [
+  ["highlight", [{ durationMs: 0 }]],
+  ["setInputFiles", [upload]],
+  ["fill", ["hello"]],
+  ["type", ["hello", undefined]],
   ["click", [{ button: "right", clickCount: 2 }]],
   ["hover", []],
   ["selectOption", [["first", "second"]]],
@@ -27,12 +38,20 @@ const actions = [
 type Action = (typeof actions)[number][0];
 
 function createLocator(selector = "button") {
-  const send = vi.fn(async (method: string, _params?: object): Promise<unknown> => {
+  const send = vi.fn(async (method: string, params?: object): Promise<unknown> => {
     if (method === "DOM.getBoxModel") return { model: { content: [0, 0, 10, 0, 10, 10, 0, 10] } };
     if (method === "DOM.describeNode") return { node: { backendNodeId: 1 } };
     if (method === "Runtime.evaluate")
       return { result: { value: selector.startsWith("text=") ? { count: 2 } : 2 } };
-    if (method === "Runtime.callFunctionOn") return { result: { value: "value" } };
+    if (method === "Runtime.callFunctionOn") {
+      const functionDeclaration = (params as { functionDeclaration?: string } | undefined)
+        ?.functionDeclaration;
+      return {
+        result: {
+          value: functionDeclaration === fillElementValue.toString() ? { status: "done" } : "value",
+        },
+      };
+    }
     return {};
   });
   const frame = { frameId: "root", session: { send } } as unknown as Frame;
@@ -48,12 +67,39 @@ function createLocator(selector = "button") {
   return { locator, frame, resolveNode, readiness, send };
 }
 
+function createFillLocator(legacy = false) {
+  const fixture = createLocator();
+  let nextNode = 0;
+  fixture.resolveNode.mockImplementation(async () => ({
+    objectId: `node-${++nextNode}`,
+    nodeId: nextNode,
+  }));
+  const respond = fixture.send.getMockImplementation()!;
+  fixture.send.mockImplementation((method, params) => {
+    const declaration = (params as { functionDeclaration?: string } | undefined)
+      ?.functionDeclaration;
+    if (method === "Runtime.callFunctionOn") {
+      if (declaration === fillElementValue.toString())
+        return Promise.resolve({
+          result: { value: legacy ? undefined : { status: "needsinput" } },
+        });
+      if (declaration === prepareElementForTyping.toString())
+        return Promise.resolve({ result: { value: true } });
+    }
+    return respond(method, params);
+  });
+  return fixture;
+}
+
 afterEach(() => vi.restoreAllMocks());
 
 describe.each(["direct", "deep", "frame"] as const)("%s locator progress forwarding", (kind) => {
   const supported = actions.filter(
     ([method]) =>
-      kind !== "frame" || !["sendClickEvent", "centroid", "backendNodeId"].includes(method),
+      kind !== "frame" ||
+      !["sendClickEvent", "centroid", "backendNodeId", "highlight", "setInputFiles"].includes(
+        method,
+      ),
   );
 
   it.each(supported)("passes the caller's progress through %s", async (method, args) => {
@@ -118,19 +164,29 @@ function deferred() {
 
 describe("locator action deadlines", () => {
   const contexts: Progress[] = [];
-  const createProgress = (timeout = 100) => {
-    const progress = new Progress("action", timeout);
+  const createProgress = (timeout = 100, name = "action") => {
+    const progress = new Progress(name, timeout);
     contexts.push(progress);
     return progress;
   };
-  beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] }));
+  beforeEach(() =>
+    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance", "Date"] }),
+  );
   afterEach(() => {
     contexts.splice(0).forEach((progress) => progress.dispose());
     expect(vi.getTimerCount()).toBe(0);
     vi.useRealTimers();
   });
 
   const stalledCommands: Partial<Record<Action, string[]>> = {
+    highlight: [
+      "Overlay.enable",
+      "DOM.scrollIntoViewIfNeeded",
+      "DOM.enable",
+      "DOM.describeNode",
+      "Overlay.highlightNode",
+    ],
+    type: ["Runtime.callFunctionOn", "Input.insertText"],
     click: ["DOM.scrollIntoViewIfNeeded", "DOM.getBoxModel", "Input.dispatchMouseEvent"],
     hover: ["DOM.getBoxModel", "Input.dispatchMouseEvent"],
     centroid: ["DOM.getBoxModel"],
@@ -156,12 +212,16 @@
```

---

### Incident Patch 7: `5935dca3` (2026-09-30)
**Commit Message**: [feat]: add timeout support for `locator` actions & reads (#3024)

# why
pr #3023 made locator resolution respect the caller's deadline. the
action or read that follows also needs to use the remaining time.
otherwise, a stalled browser command can keep the call waiting after its
timeout.

# what changed
- passed the same progress through direct, deep, & frame-scoped locator
methods, from finding the target through executing the action/read.
- bounded browser commands for `click()`, `hover()`, `selectOption()`,
`scrollTo()`, `sendClickEvent()`, `centroid()`, `backendNodeId()`,
counts, & element reads.
  - counts also pass progress through their separate selector helpers
- preserved timeout & closed connection/session errors in catches that
previously ignored errors or returned zero. ordinary lookup failures
keep their existing handling.
- used bounded cleanup for temporary browser references. cleanup
failures cannot replace the action's error, & cleanup crossing the
deadline cannot turn the call into success.
- kept click events in their existing order, without waiting for each
response before sending the next event. expiry prevents further
dispatch.

### note: 
progress remains opt

**File**: `packages/extension/understudy/deepLocator.ts` (modified, +36/-33)
```diff
@@ -129,50 +129,50 @@ export class DeepLocatorDelegate {
   }
 
   // Locator API delegates
-  async click(options?: { button?: MouseButton; clickCount?: number }) {
-    return (await this.real()).click(options);
+  async click(options?: { button?: MouseButton; clickCount?: number }, progress?: Progress) {
+    return (await this.real(progress)).click(options, progress);
   }
-  async count() {
-    return (await this.real()).count();
+  async count(progress?: Progress) {
+    return (await this.real(progress)).count(progress);
   }
-  async hover() {
-    return (await this.real()).hover();
+  async hover(progress?: Progress) {
+    return (await this.real(progress)).hover(progress);
   }
   async fill(value: string) {
     return (await this.real()).fill(value);
   }
   async type(text: string, options?: { delay?: number }) {
     return (await this.real()).type(text, options);
   }
-  async selectOption(values: string | string[]) {
-    return (await this.real()).selectOption(values);
+  async selectOption(values: string | string[], progress?: Progress) {
+    return (await this.real(progress)).selectOption(values, progress);
   }
-  async scrollTo(percent: number | string) {
-    return (await this.real()).scrollTo(percent);
+  async scrollTo(percent: number | string, progress?: Progress) {
+    return (await this.real(progress)).scrollTo(percent, progress);
   }
-  async isVisible() {
-    return (await this.real()).isVisible();
+  async isVisible(progress?: Progress) {
+    return (await this.real(progress)).isVisible(progress);
   }
-  async isChecked() {
-    return (await this.real()).isChecked();
+  async isChecked(progress?: Progress) {
+    return (await this.real(progress)).isChecked(progress);
   }
-  async inputValue() {
-    return (await this.real()).inputValue();
+  async inputValue(progress?: Progress) {
+    return (await this.real(progress)).inputValue(progress);
   }
-  async textContent() {
-    return (await this.real()).textContent();
+  async textContent(progress?: Progress) {
+    return (await this.real(progress)).textContent(progress);
   }
-  async innerHtml() {
-    return (await this.real()).innerHtml();
+  async innerHtml(progress?: Progress) {
+    return (await this.real(progress)).innerHtml(progress);
   }
-  async innerText() {
-    return (await this.real()).innerText();
+  async innerText(progress?: Progress) {
+    return (await this.real(progress)).innerText(progress);
   }
-  async centroid() {
-    return (await this.real()).centroid();
+  async centroid(progress?: Progress) {
+    return (await this.real(progress)).centroid(progress);
   }
-  async backendNodeId() {
-    return (await this.real()).backendNodeId();
+  async backendNodeId(progress?: Progress) {
+    return (await this.real(progress)).backendNodeId(progress);
   }
   async highlight(options?: {
     durationMs?: number;
@@ -181,13 +181,16 @@ export class DeepLocatorDelegate {
   }) {
     return (await this.real()).highlight(options);
   }
-  async sendClickEvent(options?: {
-    bubbles?: boolean;
-    cancelable?: boolean;
-    composed?: boolean;
-    detail?: number;
-  }) {
-    return (await this.real()).sendClickEvent(options);
+  async sendClickEvent(
+    options?: {
+      bubbles?: boolean;
+      cancelable?: boolean;
+      composed?: boolean;
+      detail?: number;
+    },
+    progress?: Progress,
+  ) {
+    return (await this.real(progress)).sendClickEvent(options, progress);
   }
   async setInputFiles(files: SetInputFilesArgument) {
     return (await this.real()).setInputFiles(files);
```

**File**: `packages/extension/understudy/frameLocator.ts` (modified, +25/-22)
```diff
@@ -123,44 +123,47 @@ class LocatorDelegate {
   }
 
   // Locator API delegates
-  async click(options?: { button?: "left" | "right" | "middle"; clickCount?: number }) {
-    return (await this.real()).click(options);
+  async click(
+    options?: { button?: "left" | "right" | "middle"; clickCount?: number },
+    progress?: Progress,
+  ) {
+    return (await this.real(progress)).click(options, progress);
   }
-  async hover() {
-    return (await this.real()).hover();
+  async hover(progress?: Progress) {
+    return (await this.real(progress)).hover(progress);
   }
   async fill(value: string) {
     return (await this.real()).fill(value);
   }
   async type(text: string, options?: { delay?: number }) {
     return (await this.real()).type(text, options);
   }
-  async selectOption(values: string | string[]) {
-    return (await this.real()).selectOption(values);
+  async selectOption(values: string | string[], progress?: Progress) {
+    return (await this.real(progress)).selectOption(values, progress);
   }
-  async scrollTo(percent: number | string) {
-    return (await this.real()).scrollTo(percent);
+  async scrollTo(percent: number | string, progress?: Progress) {
+    return (await this.real(progress)).scrollTo(percent, progress);
   }
-  async isVisible() {
-    return (await this.real()).isVisible();
+  async isVisible(progress?: Progress) {
+    return (await this.real(progress)).isVisible(progress);
   }
-  async isChecked() {
-    return (await this.real()).isChecked();
+  async isChecked(progress?: Progress) {
+    return (await this.real(progress)).isChecked(progress);
   }
-  async inputValue() {
-    return (await this.real()).inputValue();
+  async inputValue(progress?: Progress) {
+    return (await this.real(progress)).inputValue(progress);
   }
-  async textContent() {
-    return (await this.real()).textContent();
+  async textContent(progress?: Progress) {
+    return (await this.real(progress)).textContent(progress);
   }
-  async innerHtml() {
-    return (await this.real()).innerHtml();
+  async innerHtml(progress?: Progress) {
+    return (await this.real(progress)).innerHtml(progress);
   }
-  async innerText() {
-    return (await this.real()).innerText();
+  async innerText(progress?: Progress) {
+    return (await this.real(progress)).innerText(progress);
   }
-  async count() {
-    return (await this.real()).count();
+  async count(progress?: Progress) {
+    return (await this.real(progress)).count(progress);
   }
   first(): LocatorDelegate {
     return this.nth(0);
```

**File**: `packages/extension/understudy/locator.ts` (modified, +222/-141)
```diff
@@ -1,5 +1,6 @@
 // lib/v3/understudy/locator.ts
 import { Protocol } from "devtools-protocol";
+import { isCdpClosedError } from "./cdp.js";
 import {
   assignFilePayloadsToInputElement,
   dispatchDomClick,
@@ -153,45 +154,67 @@ export class Locator {
    * Return the DOM backendNodeId for this locator's target element.
    * Useful for identity comparisons without needing element handles.
    */
-  async backendNodeId(): Promise<Protocol.DOM.BackendNodeId> {
+  async backendNodeId(progress?: Progress): Promise<Protocol.DOM.BackendNodeId> {
     const session = this.frame.session;
-    const { objectId } = await this.resolveNode();
+    const { objectId } = await this.resolveNode(progress);
     try {
-      await session.send("DOM.enable").catch(() => {});
-      const { node } = await session.send<{ node: Protocol.DOM.Node }>("DOM.describeNode", {
-        objectId,
-      });
+      await runLocatorStep(progress, "enabling DOM", () =>
+        session.send("DOM.enable").catch((error) => {
+          progress?.throwIfStopped();
+          if (progress && isCdpClosedError(error)) throw error;
+        }),
+      );
+      const { node } = await runLocatorStep(progress, "describing element", () =>
+        session.send<{ node: Protocol.DOM.Node }>("DOM.describeNode", {
+          objectId,
+        }),
+      );
       return node.backendNodeId as Protocol.DOM.BackendNodeId;
     } finally {
-      await session.send<never>("Runtime.releaseObject", { objectId }).catch(() => {});
+      const release = () =>
+        session.send<never>("Runtime.releaseObject", { objectId }).catch(() => {});
+      if (progress) await progress.cleanup(release);
+      else await release();
+      progress?.throwIfStopped();
     }
   }
 
   /** Return how many nodes the current selector resolves to. */
-  public async count(): Promise<number> {
+  public async count(progress?: Progress): Promise<number> {
     const session = this.frame.session;
-    await session.send("Runtime.enable");
-    await session.send("DOM.enable");
-    return this.selectorResolver.count(this.selectorQuery);
+    await runLocatorStep(progress, "enabling runtime", () => session.send("Runtime.enable"));
+    await runLocatorStep(progress, "enabling DOM", () => session.send("DOM.enable"));
+    return this.selectorResolver.count(this.selectorQuery, progress);
   }
 
   /**
    * Return the center of the element's bounding box in the owning frame's viewport
    * (CSS pixels), rounded to integers. Scrolls into view best-effort.
    */
-  public async centroid(): Promise<{ x: number; y: number }> {
+  public async centroid(progress?: Progress): Promise<{ x: number; y: number }> {
     const session = this.frame.session;
-    const { objectId } = await this.resolveNode();
+    const { objectId } = await this.resolveNode(progress);
     try {
-      await session.send("DOM.scrollIntoViewIfNeeded", { objectId }).catch(() => {});
-      const box = await session.send<Protocol.DOM.GetBoxModelResponse>("DOM.getBoxModel", {
-        objectId,
-      });
+      await runLocatorStep(progress, "scrolling into view", () =>
+        session.send("DOM.scrollIntoViewIfNeeded", { objectId }).catch((error) => {
+          progress?.throwIfStopped();
+          if (progress && isCdpClosedError(error)) throw error;
+        }),
+      );
+      const box = await runLocatorStep(progress, "reading element geometry", () =>
+        session.send<Protocol.DOM.GetBoxModelResponse>("DOM.getBoxModel", {
+          objectId,
+        }),
+      );
       if (!box.model) throw new Error(`Element not visible (no box model): ${this.selector}`);
       const { cx, cy } = this.centerFromBoxContent(box.model.content);
       return { x: Math.round(cx), y: Math.round(cy) };
     } finally {
-      await session.send<never>("Runtime.releaseObject", { objectId }).catch(() => {});
+      const release = () =>
+        session.send<never>("Runtime.releaseObject", { objectId }).catch(() => {});
+      if (progress) await progress.cleanup(release);
+      else await release();
+      progress?.throwIfStopped();
     }
   }
 
@@ -271,26 +294,39 @@ export class Locator {
    * Move the mouse cursor to the element's visual center without clicking.
    * - Scrolls into view best-effort, resolves geometry, then dispatches a mouse move.
    */
-  async hover(): Promise<void> {
+  async hover(progress?: Progress): Promise<void> {
     const session = this.frame.session;
-    const { objectId } = await this.resolveNode();
+    const { objectId } = await this.resolveNode(progress);
     try {
-      await session.send("DOM.scrollIntoViewIfNeeded", { objectId }).catch(() => {});
+      await runLocatorStep(progress, "scrolling into view", () =>
+        session.send("DOM.scrollIntoViewIfNeeded", { objectId }).catch((error) => {
+          progress?.throwIfStopped();
+          if (progress && isCdpClosedError(error)) throw error;
+        }),
+      );
 
-      const box = await session.send<Protoc
```

**File**: `packages/extension/understudy/locatorActions.test.ts` (added, +364/-0)
```diff
@@ -0,0 +1,364 @@
+import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
+import { TimeoutError } from "../errors.js";
+import type { Frame } from "./frame.js";
+import type { Page } from "./page.js";
+import { DeepLocatorDelegate } from "./deepLocator.js";
+import { frameLocatorFromFrame } from "./frameLocator.js";
+import { executionContexts } from "./executionContextRegistry.js";
+import { Locator } from "./locator.js";
+import { Progress, runWithProgress } from "./progress.js";
+
+const actions = [
+  ["click", [{ button: "right", clickCount: 2 }]],
+  ["hover", []],
+  ["selectOption", [["first", "second"]]],
+  ["scrollTo", [75]],
+  ["sendClickEvent", [{ bubbles: false, detail: 2 }]],
+  ["centroid", []],
+  ["backendNodeId", []],
+  ["count", []],
+  ["isVisible", []],
+  ["isChecked", []],
+  ["inputValue", []],
+  ["innerText", []],
+  ["innerHtml", []],
+  ["textContent", []],
+] as const;
+type Action = (typeof actions)[number][0];
+
+function createLocator(selector = "button") {
+  const send = vi.fn(async (method: string, _params?: object): Promise<unknown> => {
+    if (method === "DOM.getBoxModel") return { model: { content: [0, 0, 10, 0, 10, 10, 0, 10] } };
+    if (method === "DOM.describeNode") return { node: { backendNodeId: 1 } };
+    if (method === "Runtime.evaluate")
+      return { result: { value: selector.startsWith("text=") ? { count: 2 } : 2 } };
+    if (method === "Runtime.callFunctionOn") return { result: { value: "value" } };
+    return {};
+  });
+  const frame = { frameId: "root", session: { send } } as unknown as Frame;
+  const locator = new Locator(frame, selector);
+  const resolveNode = vi
+    .spyOn(locator, "resolveNode")
+    .mockResolvedValue({ objectId: "node", nodeId: 1 });
+  const readiness = vi.spyOn(executionContexts, "waitForLocatorWorld").mockResolvedValue({
+    kind: "extension",
+    contextId: 1,
+    capabilities: { closedShadowRoots: true },
+  });
+  return { locator, frame, resolveNode, readiness, send };
+}
+
+afterEach(() => vi.restoreAllMocks());
+
+describe.each(["direct", "deep", "frame"] as const)("%s locator progress forwarding", (kind) => {
+  const supported = actions.filter(
+    ([method]) =>
+      kind !== "frame" || !["sendClickEvent", "centroid", "backendNodeId"].includes(method),
+  );
+
+  it.each(supported)("passes the caller's progress through %s", async (method, args) => {
+    const { locator, frame, resolveNode } = createLocator();
+    const delegate =
+      kind === "direct"
+        ? undefined
+        : kind === "deep"
+          ? new DeepLocatorDelegate({} as Page, frame, "button")
+          : frameLocatorFromFrame({} as Page, frame, "iframe").locator("button");
+    const real = delegate ? vi.spyOn(delegate, "real").mockResolvedValue(locator) : undefined;
+    const target: Partial<Pick<Locator, Action>> = delegate ?? locator;
+    const action = vi.spyOn(locator, method);
+    const count = vi.spyOn(locator.selectorResolver, "count");
+
+    await runWithProgress({ name: method, timeout: 1000 }, async (progress) => {
+      await Reflect.apply(target[method]!, target, [...args, progress]);
+      if (real) expect(real).toHaveBeenCalledExactlyOnceWith(progress);
+      expect(action).toHaveBeenCalledExactlyOnceWith(...args, progress);
+      if (method === "count") {
+        expect(count).toHaveBeenCalledExactlyOnceWith(locator.selectorQuery, progress);
+        expect(resolveNode).not.toHaveBeenCalled();
+      } else {
+        expect(resolveNode).toHaveBeenCalledExactlyOnceWith(progress);
+      }
+    });
+  });
+});
+
+describe("counting progress forwarding", () => {
+  it.each([
+    ["button", "countCss"],
+    ["text=button", "countText"],
+    ["xpath=//button", "countXPath"],
+  ] as const)("passes progress through %s counting & readiness", async (selector, method) => {
+    const { locator, frame, readiness } = createLocator(selector);
+    const count = vi.spyOn(locator.selectorResolver, method);
+    const evaluate = vi.spyOn(locator.selectorResolver, "evaluateCount");
+
+    await runWithProgress({ name: "count", timeout: 1000 }, async (progress) => {
+      await expect(locator.count(progress)).resolves.toBe(2);
+      expect(count).toHaveBeenCalledExactlyOnceWith(locator.selectorQuery.value, progress);
+      expect(readiness).toHaveBeenCalledExactlyOnceWith(
+        frame.session,
+        frame.frameId,
+        1000,
+        progress,
+      );
+      if (method === "countCss")
+        expect(evaluate).toHaveBeenCalledExactlyOnceWith(expect.any(String), 1, progress);
+    });
+  });
+});
+
+function deferred() {
+  let resolve!: (value: unknown) => void;
+  const promise = new Promise<unknown>((done) => {
+    resolve = done;
+  });
+  return { promise, resolve };
+}
+
+describe("locator action deadlines", () => {
+  const contexts: Progress[] = [];
+  const createProgress = (timeout = 100) => {
+    const progress = new Progress("action", timeout);
+    contexts.push(pro
```

**File**: `packages/extension/understudy/locatorResolution.test.ts` (modified, +28/-0)
```diff
@@ -245,6 +245,34 @@ describe("locator resolution deadlines", () => {
     expect(send).toHaveBeenCalledWith("Runtime.releaseObject", { objectId: "second" });
   });
 
+  it("reports expiry without waiting for a second stalled cleanup", async () => {
+    const { frame, send, respond } = createFrame("root");
+    const resolver = frame.locator("button").selectorResolver;
+    vi.spyOn(resolver, "resolveAll").mockResolvedValue([
+      { objectId: "unselected", nodeId: 1 },
+      { objectId: "selected", nodeId: 2 },
+    ]);
+    const gate = deferred();
+    send.mockImplementation((method, params) =>
+      method === "Runtime.releaseObject" ? gate.promise : respond(method, params),
+    );
+    const settled = vi.fn();
+    const pending = resolver.resolveAtIndex({ kind: "css", value: "button" }, 1, createProgress());
+    void pending.then(settled, settled);
+
+    try {
+      await vi.advanceTimersByTimeAsync(1000);
+      expect(settled).toHaveBeenCalledExactlyOnceWith(expect.any(TimeoutError));
+      expect(send.mock.calls.filter(([method]) => method === "Runtime.releaseObject")).toEqual([
+        ["Runtime.releaseObject", { objectId: "unselected" }],
+        ["Runtime.releaseObject", { objectId: "selected" }],
+      ]);
+    } finally {
+      gate.resolve({});
+      await vi.advanceTimersByTimeAsync(0);
+    }
+  });
+
   it("removes the main-world listener & timer when its caller expires", async () => {
     const { session, events } = createFrame("root", false);
     executionContexts.byFrame.delete(session);
```

**File**: `packages/extension/understudy/selectorResolver.ts` (modified, +47/-30)
```diff
@@ -84,14 +84,15 @@ export class FrameSelectorResolver {
     }
   }
 
-  public async count(query: SelectorQuery): Promise<number> {
+  public async count(query: SelectorQuery, progress?: Progress): Promise<number> {
+    progress?.throwIfStopped();
     switch (query.kind) {
       case "css":
-        return this.countCss(query.value);
+        return this.countCss(query.value, progress);
       case "text":
-        return this.countText(query.value);
+        return this.countText(query.value, progress);
       case "xpath":
-        return this.countXPath(query.value);
+        return this.countXPath(query.value, progress);
       default:
         return 0;
     }
@@ -114,7 +115,7 @@ export class FrameSelectorResolver {
       try {
         progress.throwIfStopped();
       } catch (error) {
-        if (selected) await this.releaseNodes([selected], progress);
+        if (selected) void this.releaseNodes([selected], progress);
         throw error;
       }
     }
@@ -175,37 +176,41 @@ export class FrameSelectorResolver {
       );
   }
 
-  async countCss(selector: string): Promise<number> {
+  async countCss(selector: string, progress?: Progress): Promise<number> {
     const session = this.frame.session;
     const { contextId } = await executionContexts.waitForLocatorWorld(
       session,
       this.frame.frameId,
       1000,
+      progress,
     );
 
     const primaryExpr = buildLocatorInvocation("countCssMatchesPrimary", [
       JSON.stringify(selector),
     ]);
-    return this.evaluateCount(primaryExpr, contextId);
+    return this.evaluateCount(primaryExpr, contextId, progress);
   }
 
-  async countText(value: string): Promise<number> {
+  async countText(value: string, progress?: Progress): Promise<number> {
     const session = this.frame.session;
     const { contextId: ctxId } = await executionContexts.waitForLocatorWorld(
       session,
       this.frame.frameId,
       1000,
+      progress,
     );
 
     const expr = buildLocatorInvocation("countTextMatches", [JSON.stringify(value)]);
 
     try {
-      const evalRes = await session.send<Protocol.Runtime.EvaluateResponse>("Runtime.evaluate", {
-        expression: expr,
-        contextId: ctxId,
-        returnByValue: true,
-        awaitPromise: true,
-      });
+      const evalRes = await runLocatorStep(progress, "counting elements", () =>
+        session.send<Protocol.Runtime.EvaluateResponse>("Runtime.evaluate", {
+          expression: expr,
+          contextId: ctxId,
+          returnByValue: true,
+          awaitPromise: true,
+        }),
+      );
 
       if (evalRes.exceptionDetails) {
         const details = evalRes.exceptionDetails;
@@ -227,29 +232,34 @@ export class FrameSelectorResolver {
       const num = typeof data.count === "number" ? data.count : Number(data.count);
       if (!Number.isFinite(num)) return 0;
       return Math.max(0, Math.floor(num));
-    } catch {
+    } catch (error) {
+      progress?.throwIfStopped();
+      if (progress && isCdpClosedError(error)) throw error;
       return 0;
     }
   }
 
-  async countXPath(value: string): Promise<number> {
+  async countXPath(value: string, progress?: Progress): Promise<number> {
     const session = this.frame.session;
 
     const { contextId: ctxId } = await executionContexts.waitForLocatorWorld(
       session,
       this.frame.frameId,
       1000,
+      progress,
     );
 
     const expr = buildLocatorInvocation("countXPathMatchesMainWorld", [JSON.stringify(value)]);
 
     try {
-      const evalRes = await session.send<Protocol.Runtime.EvaluateResponse>("Runtime.evaluate", {
-        expression: expr,
-        contextId: ctxId,
-        returnByValue: true,
-        awaitPromise: true,
-      });
+      const evalRes = await runLocatorStep(progress, "counting elements", () =>
+        session.send<Protocol.Runtime.EvaluateResponse>("Runtime.evaluate", {
+          expression: expr,
+          contextId: ctxId,
+          returnByValue: true,
+          awaitPromise: true,
+        }),
+      );
 
       if (evalRes.exceptionDetails) {
         return 0;
@@ -261,7 +271,9 @@ export class FrameSelectorResolver {
           : Number(evalRes.result.value);
       if (!Number.isFinite(num)) return 0;
       return Math.max(0, Math.floor(num));
-    } catch {
+    } catch (error) {
+      progress?.throwIfStopped();
+      if (progress && isCdpClosedError(error)) throw error;
       return 0;
     }
   }
@@ -289,16 +301,19 @@ export class FrameSelectorResolver {
   async evaluateCount(
     expression: string,
     contextId: Protocol.Runtime.ExecutionContextId,
+    progress?: Progress,
   ): Promise<number> {
     const session = this.frame.session;
 
     try {
-      const evalRes = await session.send<Protocol.Runtime.EvaluateResponse>("Runtime.evaluate", {
-        expression,
-        contextId,
-        returnByValue: true,
-        awaitPromise: true,
-      });
+      const evalRes = await runLocatorStep(progress, "coun
```

---

### Incident Patch 8: `9c6394d5` (2026-09-30)
**Commit Message**: [feat]: add timeout support to `locator` resolvers (#3023)

# why
resolving a the node/object ID that a `locator` points to can involve
crossing iframes, waiting for browser helpers, & looking up the element.
these steps need to share the caller's deadline so each frame or retry
cannot restart the timeout.

this pr connects that deadline to node/object ID resolution. the next PR
in this stack will connect `locator` actions & reads to these helpers.
public parameters for setting timeouts will come in a later PR.

### note:
this PR also renames `LocatorOperation` to `Progress` for clarity

# what changed
- renamed `locatorOperation.ts` to `progress.ts`, `LocatorOperation` to
`Progress`, & `runLocatorOperation()` to `runWithProgress()` because it
will be used by callers beyond locators.
- passed the same optional progress through frame traversal, element
lookup, & browser helper readiness. callers without progress keep their
existing behavior for now.
- made readiness waits, retries, & browser commands use the remaining
time. readiness can exceed the old fixed limits when the caller allows
it. passing in `0` disables the deadline.
- preserved timeout errors through retries, fallback s

**File**: `packages/extension/tests/frame-locator.test.ts` (modified, +16/-2)
```diff
@@ -152,7 +152,21 @@ describe("FrameLocator readiness", () => {
     const { locator, childFrame } = createFrameLocator(oldSession, getSessionForFrame);
 
     await expect(locator.resolveFrame()).resolves.toBe(childFrame);
-    expect(waitForLocatorWorld).toHaveBeenNthCalledWith(1, oldSession, "child", 200);
-    expect(waitForLocatorWorld).toHaveBeenNthCalledWith(2, adoptedSession, "child", 200);
+    expect(waitForLocatorWorld).toHaveBeenNthCalledWith(
+      1,
+      oldSession,
+      "child",
+      200,
+      undefined,
+      false,
+    );
+    expect(waitForLocatorWorld).toHaveBeenNthCalledWith(
+      2,
+      adoptedSession,
+      "child",
+      200,
+      undefined,
+      false,
+    );
   });
 });
```

**File**: `packages/extension/understudy/cdp.ts` (modified, +9/-0)
```diff
@@ -19,6 +19,15 @@ export interface CDPSessionLike {
   readonly id: string | null;
 }
 
+/** Closure errors emitted by this transport, not transient execution-context loss. */
+export function isCdpClosedError(error: unknown): error is Error {
+  return (
+    error instanceof Error &&
+    (error.message.startsWith("CDP connection closed:") ||
+      error.message.startsWith("No Page found for target closed before CDP "))
+  );
+}
+
 export type CdpWebSocketCloseEvent = {
   code: number;
   reason: string;
```

**File**: `packages/extension/understudy/deepLocator.test.ts` (modified, +111/-2)
```diff
@@ -1,7 +1,12 @@
-import { describe, expect, it, vi } from "vitest";
+import { afterEach, describe, expect, it, vi } from "vitest";
 import type { Frame } from "./frame.js";
 import type { Page } from "./page.js";
 import { DeepLocatorDelegate } from "./deepLocator.js";
+import { FrameLocator, frameLocatorFromFrame } from "./frameLocator.js";
+import { Locator } from "./locator.js";
+import { Progress, runWithProgress } from "./progress.js";
+import { FrameSelectorResolver } from "./selectorResolver.js";
+import { executionContexts } from "./executionContextRegistry.js";
 
 describe("DeepLocatorDelegate match selection", () => {
   const createDelegate = () => {
@@ -26,6 +31,110 @@ describe("DeepLocatorDelegate match selection", () => {
       .mockResolvedValue({ objectId: "node-1", nodeId: null });
 
     await expect(locator.resolveNode()).resolves.toEqual({ objectId: "node-1", nodeId: null });
-    expect(resolveAtIndex).toHaveBeenCalledWith(locator.selectorQuery, 0);
+    expect(resolveAtIndex).toHaveBeenCalledWith(locator.selectorQuery, 0, undefined);
+  });
+});
+
+describe("locator resolution contexts", () => {
+  afterEach(() => {
+    vi.useRealTimers();
+    vi.restoreAllMocks();
+  });
+
+  function createFrames() {
+    const send = vi.fn(async (method: string) => {
+      if (method === "DOM.describeNode") return { node: { backendNodeId: 1 } };
+      if (method === "DOM.getFrameOwner") return { backendNodeId: 1 };
+      if (method === "Runtime.evaluate") return { result: { objectId: "node" } };
+      if (method === "DOM.requestNode") return { nodeId: 1 };
+      return {};
+    });
+    const frames = ["root", "middle", "inner"].map((frameId) => {
+      const frame = {
+        frameId,
+        session: { send },
+        locator: (selector: string) => new Locator(frame, selector),
+      } as unknown as Frame;
+      return frame;
+    });
+    const [root, middle, inner] = frames;
+    const page = {
+      getFullFrameTree: () => ({
+        frame: { id: root.frameId },
+        childFrames: [
+          {
+            frame: { id: middle.frameId },
+            childFrames: [{ frame: { id: inner.frameId } }],
+          },
+        ],
+      }),
+      getSessionForFrame: () => root.session,
+      frameForId: (id: string) => frames.find((frame) => frame.frameId === id),
+    } as unknown as Page;
+    vi.spyOn(executionContexts, "waitForLocatorWorld").mockResolvedValue({
+      kind: "extension",
+      contextId: 1,
+      capabilities: { closedShadowRoots: true },
+    });
+    return { page, root, inner, send };
+  }
+
+  it.each(["hops", "xpath", "frame locator"] as const)(
+    "passes one context through nested %s resolution & preserves nth()",
+    async (kind) => {
+      vi.useFakeTimers();
+      const { page, root, inner } = createFrames();
+      const resolveFrame = vi.spyOn(FrameLocator.prototype, "resolveFrame");
+      const lookups = (["resolveCss", "resolveText", "resolveXPath"] as const).map((method) =>
+        vi.spyOn(FrameSelectorResolver.prototype, method),
+      );
+      const delegate =
+        kind === "frame locator"
+          ? frameLocatorFromFrame(page, root, "#outer")
+              .frameLocator("#inner")
+              .locator("text=target")
+          : new DeepLocatorDelegate(
+              page,
+              root,
+              kind === "hops"
+                ? "#outer >> #inner >> #target"
+                : "xpath=/html/iframe/html/iframe/html/button",
+            );
+
+      await runWithProgress({ name: "resolve", timeout: 100 }, async (progress) => {
+        const locator = await delegate.nth(1).real(progress);
+        expect(locator.getFrame()).toBe(inner);
+        expect(locator.nthIndex).toBe(1);
+        await expect(locator.resolveNode(progress)).resolves.toEqual({
+          objectId: "node",
+          nodeId: 1,
+        });
+        expect(resolveFrame.mock.calls).toEqual([[progress], [progress]]);
+        const calls = lookups.flatMap((lookup) => lookup.mock.calls);
+        expect(calls).toHaveLength(3);
+        expect(calls.every(([, , context]) => context === progress)).toBe(true);
+        expect(progress.remainingMs()).toBe(100);
+      });
+      expect(vi.getTimerCount()).toBe(0);
+    },
+  );
+
+  it("rejects an expired context before resolving a target or sending commands", async () => {
+    vi.useFakeTimers();
+    const { page, root, send } = createFrames();
+    const progress = new Progress("resolve", 100);
+    await vi.advanceTimersByTimeAsync(100);
+
+    await expect(new DeepLocatorDelegate(page, root, "#target").real(progress)).rejects.toBe(
+      progress.signal.reason,
+    );
+    await expect(frameLocatorFromFrame(page, root, "#outer").resolveFrame(progress)).rejects.toBe(
+      progress.signal.reason,
+    );
+    await expect(root.locator("#target").resolveNode(progress)).rejects.toBe(
+      progress.signal.reason,
+    );
+    expect(send).not.toHaveBeenCalled();
+    expect(vi.getTimerC
```

**File**: `packages/extension/understudy/deepLocator.ts` (modified, +14/-7)
```diff
@@ -1,4 +1,5 @@
 import { Locator } from "./locator.js";
+import type { Progress } from "./progress.js";
 import type { Frame } from "./frame.js";
 import type { Page } from "./page.js";
 import { FrameLocator, frameLocatorFromFrame } from "./frameLocator.js";
@@ -54,8 +55,9 @@ export async function deepLocatorThroughIframes(
   page: Page,
   root: Frame,
   xpathOrSelector: string,
+  progress?: Progress,
 ): Promise<Locator> {
-  const target = await resolveDeepXPathTarget(page, root, xpathOrSelector);
+  const target = await resolveDeepXPathTarget(page, root, xpathOrSelector, progress);
   return new Locator(target.frame, target.selector);
 }
 
@@ -67,7 +69,9 @@ export async function resolveLocatorTarget(
   page: Page,
   root: Frame,
   selectorRaw: string,
+  progress?: Progress,
 ): Promise<ResolvedLocatorTarget> {
+  progress?.throwIfStopped();
   const sel = selectorRaw.trim();
   const parts = sel
     .split(">>")
@@ -80,14 +84,14 @@ export async function resolveLocatorTarget(
     for (let i = 1; i < parts.length - 1; i++) {
       fl = fl.frameLocator(parts[i]!);
     }
-    const targetFrame = await fl.resolveFrame();
+    const targetFrame = await fl.resolveFrame(progress);
     return { frame: targetFrame, selector: parts[parts.length - 1]! };
   }
 
   // No hops — delegate to XPath-aware deep resolver when needed
   const isXPath = sel.startsWith("xpath=") || sel.startsWith("/");
   if (isXPath) {
-    return resolveDeepXPathTarget(page, root, sel);
+    return resolveDeepXPathTarget(page, root, sel, progress);
   }
   return { frame: root, selector: sel };
 }
@@ -96,8 +100,9 @@ export async function resolveLocatorWithHops(
   page: Page,
   root: Frame,
   selectorRaw: string,
+  progress?: Progress,
 ): Promise<Locator> {
-  const target = await resolveLocatorTarget(page, root, selectorRaw);
+  const target = await resolveLocatorTarget(page, root, selectorRaw, progress);
   return new Locator(target.frame, target.selector);
 }
 
@@ -118,8 +123,8 @@ export class DeepLocatorDelegate {
     readonly nthIndex: number = -1,
   ) {}
 
-  async real(): Promise<Locator> {
-    const base = await resolveLocatorWithHops(this.page, this.root, this.selector);
+  async real(progress?: Progress): Promise<Locator> {
+    const base = await resolveLocatorWithHops(this.page, this.root, this.selector, progress);
     return this.nthIndex < 0 ? base : base.nth(this.nthIndex);
   }
 
@@ -249,12 +254,14 @@ async function resolveDeepXPathTarget(
   page: Page,
   root: Frame,
   xpathOrSelector: string,
+  progress?: Progress,
 ): Promise<ResolvedLocatorTarget> {
+  progress?.throwIfStopped();
   const plan = planDeepXPathTarget(xpathOrSelector);
   let fl: FrameLocator | undefined;
   for (const hop of plan.frameHopSelectors) {
     fl = fl ? fl.frameLocator(hop) : frameLocatorFromFrame(page, root, hop);
   }
-  const targetFrame = fl ? await fl.resolveFrame() : root;
+  const targetFrame = fl ? await fl.resolveFrame(progress) : root;
   return { frame: targetFrame, selector: plan.finalSelector };
 }
```

**File**: `packages/extension/understudy/executionContextRegistry.ts` (modified, +119/-54)
```diff
@@ -1,5 +1,6 @@
 import type { Protocol } from "devtools-protocol";
-import type { CDPSessionLike } from "./cdp.js";
+import { type CDPSessionLike, isCdpClosedError } from "./cdp.js";
+import { type Progress, runLocatorStep } from "./progress.js";
 
 type FrameId = Protocol.Page.FrameId;
 type ExecId = Protocol.Runtime.ExecutionContextId;
@@ -90,51 +91,81 @@ export class ExecutionContextRegistry {
     return this.fallbackByFrame.get(session)?.get(frameId) ?? null;
   }
 
+  /** With progress, timeout limits each extension probe, not the whole wait.
+   * Frame traversal disables retries here so it can recheck session ownership.
+   */
   async waitForLocatorWorld(
     session: CDPSessionLike,
     frameId: FrameId,
     timeout: number = 1000,
+    progress?: Progress,
+    retryUntilDeadline = true,
   ): Promise<LocatorWorld> {
-    const extensionContextId = this.getExtensionWorld(session, frameId);
-    if (extensionContextId) return this.extensionWorld(extensionContextId);
-
-    const fallbackContextId = this.getFallbackWorld(session, frameId);
-    if (fallbackContextId) return this.fallbackWorld(fallbackContextId);
-
-    try {
-      return this.extensionWorld(await this.waitForExtensionWorld(session, frameId, timeout));
-    } catch (extensionError) {
-      if (!(await this.isFallbackEligible(session, frameId))) throw extensionError;
-      return this.fallbackWorld(await this.createFallbackWorld(session, frameId));
+    while (true) {
+      progress?.throwIfStopped();
+      const extensionContextId = this.getExtensionWorld(session, frameId);
+      if (extensionContextId) return this.extensionWorld(extensionContextId);
+
+      const fallbackContextId = this.getFallbackWorld(session, frameId);
+      if (fallbackContextId) return this.fallbackWorld(fallbackContextId);
+
+      try {
+        return this.extensionWorld(
+          await this.waitForExtensionWorld(session, frameId, timeout, progress),
+        );
+      } catch (extensionError) {
+        progress?.throwIfStopped();
+        if (progress && isCdpClosedError(extensionError)) throw extensionError;
+        if (await this.isFallbackEligible(session, frameId, progress)) {
+          // Installation is shared. Only this caller's wait belongs to its progress.
+          return this.fallbackWorld(
+            await runLocatorStep(progress, "installing locator helpers", () =>
+              this.createFallbackWorld(session, frameId),
+            ),
+          );
+        }
+        if (!progress || !retryUntilDeadline) throw extensionError;
+      }
     }
   }
 
   async waitForExtensionWorld(
     session: CDPSessionLike,
     frameId: FrameId,
     timeout: number = 1000,
+    progress?: Progress,
   ): Promise<ExecId> {
+    progress?.throwIfStopped();
     const cached = this.getExtensionWorld(session, frameId);
     if (cached) return cached;
 
-    await session.send("Runtime.enable").catch(() => {});
-    const deadline = Date.now() + timeout;
+    await runLocatorStep(progress, "enabling runtime", () =>
+      session.send("Runtime.enable").catch((error) => {
+        if (progress && isCdpClosedError(error)) throw error;
+      }),
+    );
+    const now = () => (progress ? performance.now() : Date.now());
+    const deadline = now() + Math.min(timeout, progress?.remainingMs() ?? Infinity);
     const checkedContextIds = new Set<ExecId>();
     const diagnostics = new Map<ExecId, string>();
 
-    while (Date.now() <= deadline) {
+    while (now() <= deadline) {
+      progress?.throwIfStopped();
       const candidates = this.extensionCandidates.get(session)?.get(frameId);
       for (const contextId of candidates ?? []) {
         checkedContextIds.add(contextId);
-        const diagnostic = await this.inspectExtensionWorld(session, contextId);
+        const diagnostic = await runLocatorStep(progress, "inspecting locator helpers", () =>
+          this.inspectExtensionWorld(session, contextId, progress),
+        );
         diagnostics.set(contextId, JSON.stringify(diagnostic));
         if (diagnostic.ready) {
           this.registerExtensionWorld(session, frameId, contextId);
           return contextId;
         }
       }
 
-      await new Promise((resolve) => setTimeout(resolve, 25));
+      if (progress) await progress.delay(Math.min(25, Math.max(1, deadline - now())));
+      else await new Promise((resolve) => setTimeout(resolve, 25));
     }
 
     throw new Error(
@@ -150,40 +181,61 @@ export class ExecutionContextRegistry {
     session: CDPSessionLike,
     frameId: FrameId,
     timeout: number = 800,
+    progress?: Progress,
   ): Promise<ExecId> {
+    progress?.throwIfStopped();
     const cached = this.getMainWorld(session, frameId);
     if (cached) return cached;
 
-    await session.send("Runtime.enable").catch(() => {});
+    await runLocatorStep(progress, "enabling runtime", () =>
+      session.send("Runtime.enable").catch((error) => {
+        if (progress && isCdpClosedError(error)) throw err
```

**File**: `packages/extension/understudy/frame.ts` (modified, +32/-16)
```diff
@@ -1,7 +1,8 @@
 // lib/v3/understudy/frame.ts
 import { Protocol } from "devtools-protocol";
-import type { CDPSessionLike } from "./cdp.js";
+import { type CDPSessionLike, isCdpClosedError } from "./cdp.js";
 import { Locator } from "./locator.js";
+import { type Progress, runLocatorStep } from "./progress.js";
 import { waitForScreenshot } from "./screenshotUtils.js";
 import { executionContexts } from "./executionContextRegistry.js";
 import type { StagehandLogger } from "../logger.js";
@@ -182,33 +183,48 @@ export class Frame implements FrameManager {
   }
 
   /** Evaluate an internal expression in Stagehand's selected locator world. */
-  async evaluateInLocatorWorld<R = unknown>(expression: string): Promise<R> {
-    await this.session.send("Runtime.enable").catch(() => {});
+  async evaluateInLocatorWorld<R = unknown>(expression: string, progress?: Progress): Promise<R> {
+    await runLocatorStep(progress, "enabling runtime", () =>
+      this.session.send("Runtime.enable").catch((error) => {
+        if (progress && isCdpClosedError(error)) throw error;
+      }),
+    );
     let locatorWorld = await executionContexts.waitForLocatorWorld(
       this.session,
       this.frameId,
       1000,
+      progress,
     );
 
     let response: Protocol.Runtime.EvaluateResponse;
     try {
-      response = await this.session.send<Protocol.Runtime.EvaluateResponse>("Runtime.evaluate", {
-        expression,
-        contextId: locatorWorld.contextId,
-        awaitPromise: true,
-        returnByValue: true,
-      });
+      response = await runLocatorStep(progress, "evaluating locator helper", () =>
+        this.session.send<Protocol.Runtime.EvaluateResponse>("Runtime.evaluate", {
+          expression,
+          contextId: locatorWorld.contextId,
+          awaitPromise: true,
+          returnByValue: true,
+        }),
+      );
     } catch (error) {
+      progress?.throwIfStopped();
       const message = error instanceof Error ? error.message : String(error);
       if (!message.includes("Cannot find context with specified id")) throw error;
       executionContexts.unregisterLocatorContext(this.session, locatorWorld.contextId);
-      locatorWorld = await executionContexts.waitForLocatorWorld(this.session, this.frameId, 1000);
-      response = await this.session.send<Protocol.Runtime.EvaluateResponse>("Runtime.evaluate", {
-        expression,
-        contextId: locatorWorld.contextId,
-        awaitPromise: true,
-        returnByValue: true,
-      });
+      locatorWorld = await executionContexts.waitForLocatorWorld(
+        this.session,
+        this.frameId,
+        1000,
+        progress,
+      );
+      response = await runLocatorStep(progress, "evaluating locator helper", () =>
+        this.session.send<Protocol.Runtime.EvaluateResponse>("Runtime.evaluate", {
+          expression,
+          contextId: locatorWorld.contextId,
+          awaitPromise: true,
+          returnByValue: true,
+        }),
+      );
     }
 
     if (response.exceptionDetails) {
```

**File**: `packages/extension/understudy/frameLocator.ts` (modified, +58/-21)
```diff
@@ -1,5 +1,7 @@
 import type { Protocol } from "devtools-protocol";
+import { isCdpClosedError } from "./cdp.js";
 import { Locator } from "./locator.js";
+import { type Progress, runLocatorStep } from "./progress.js";
 import type { Page } from "./page.js";
 import { Frame } from "./frame.js";
 import { executionContexts } from "./executionContextRegistry.js";
@@ -35,28 +37,34 @@ export class FrameLocator {
   }
 
   /** Resolve to the concrete Frame for this FrameLocator chain. */
-  async resolveFrame(): Promise<Frame> {
+  async resolveFrame(progress?: Progress): Promise<Frame> {
+    progress?.throwIfStopped();
     const parentFrame: Frame = this.parent
-      ? await this.parent.resolveFrame()
+      ? await this.parent.resolveFrame(progress)
       : (this.root ?? this.page.mainFrame());
 
     // Resolve the iframe element inside the parent frame
     const tmp = parentFrame.locator(this.selector);
     const parentSession = parentFrame.session;
-    const { objectId } = await tmp.resolveNode();
+    const { objectId } = await tmp.resolveNode(progress);
 
     try {
-      await parentSession.send("DOM.enable").catch(() => {});
-      const desc = await parentSession.send<Protocol.DOM.DescribeNodeResponse>("DOM.describeNode", {
-        objectId,
-      });
+      await runLocatorStep(progress, "enabling DOM", () =>
+        parentSession.send("DOM.enable").catch((error) => {
+          if (progress && isCdpClosedError(error)) throw error;
+        }),
+      );
+      const desc = await runLocatorStep(progress, "describing iframe", () =>
+        parentSession.send<Protocol.DOM.DescribeNodeResponse>("DOM.describeNode", { objectId }),
+      );
       const iframeBackendNodeId = desc.node.backendNodeId;
 
       // Find direct child frames under the parent by consulting the Page's registry
       const childIds = await listDirectChildFrameIdsFromRegistry(
         this.page,
         parentFrame.frameId,
         1000,
+        progress,
       );
 
       for (const fid of childIds) {
@@ -65,23 +73,31 @@ export class FrameLocator {
           nodeId?: Protocol.DOM.NodeId;
         };
         try {
-          owner = await parentSession.send<{
-            backendNodeId: Protocol.DOM.BackendNodeId;
-            nodeId?: Protocol.DOM.NodeId;
-          }>("DOM.getFrameOwner", { frameId: fid as Protocol.Page.FrameId });
-        } catch {
+          owner = await runLocatorStep(progress, "finding frame owner", () =>
+            parentSession.send<{
+              backendNodeId: Protocol.DOM.BackendNodeId;
+              nodeId?: Protocol.DOM.NodeId;
+            }>("DOM.getFrameOwner", { frameId: fid as Protocol.Page.FrameId }),
+          );
+        } catch (error) {
+          progress?.throwIfStopped();
+          if (progress && isCdpClosedError(error)) throw error;
           // ignore and try next
           continue;
         }
         if (owner.backendNodeId === iframeBackendNodeId) {
           // Readiness failures must propagate after the matching child is identified.
-          await ensureChildFrameReady(this.page, fid, FRAME_LOCATOR_READY_TIMEOUT_MS);
+          await ensureChildFrameReady(this.page, fid, FRAME_LOCATOR_READY_TIMEOUT_MS, progress);
           return this.page.frameForId(fid);
         }
       }
       throw new Error(`Unable to obtain a content frame for selector: ${this.selector}`);
     } finally {
-      await parentSession.send("Runtime.releaseObject", { objectId }).catch(() => {});
+      const release = () =>
+        parentSession.send("Runtime.releaseObject", { objectId }).catch(() => {});
+      if (progress) await progress.cleanup(release);
+      else await release();
+      progress?.throwIfStopped();
     }
   }
 
@@ -99,8 +115,8 @@ class LocatorDelegate {
     readonly nthIndex: number = -1,
   ) {}
 
-  async real(): Promise<Locator> {
-    const frame = await this.fl.resolveFrame();
+  async real(progress?: Progress): Promise<Locator> {
+    const frame = await this.fl.resolveFrame(progress);
     const locator = frame.locator(this.sel);
     if (this.nthIndex < 0) return locator;
     return locator.nth(this.nthIndex);
@@ -171,18 +187,24 @@ async function listDirectChildFrameIdsFromRegistry(
   page: Page,
   parentFrameId: string,
   timeout: number,
+  progress?: Progress,
 ): Promise<string[]> {
-  const deadline = Date.now() + timeout;
+  progress?.throwIfStopped();
+  const deadline = progress ? Infinity : Date.now() + timeout;
   while (true) {
+    progress?.throwIfStopped();
     try {
       const tree = page.getFullFrameTree();
       const node = findFrameNode(tree, parentFrameId);
       const ids = node?.childFrames?.map((c) => c.frame.id as string) ?? [];
       if (ids.length > 0 || Date.now() >= deadline) return ids;
-    } catch {
+    } catch (error) {
+      progress?.throwIfStopped();
+      if (progress && isCdpClosedError(error)) throw error;
       // ignore
     }
-    await new Promise((r) => setTimeout(r, 50));
+    if (pro
```

**File**: `packages/extension/understudy/locator.ts` (modified, +10/-4)
```diff
@@ -17,6 +17,7 @@ import {
   selectElementOptions,
 } from "../dom/locatorScripts/scripts.js";
 import type { Frame } from "./frame.js";
+import { type Progress, runLocatorStep } from "./progress.js";
 import { FrameSelectorResolver, type SelectorQuery } from "./selectorResolver.js";
 import { bytesToBase64, normalizeInputFiles } from "./fileUploadUtils.js";
 import type { MouseButton } from "@browserbasehq/stagehand-protocol/types";
@@ -758,17 +759,22 @@ export class Locator {
    * Resolve `this.selector` within the frame to `{ objectId, nodeId? }`:
    * Delegates to a shared selector resolver so all selector logic stays in sync.
    */
-  public async resolveNode(): Promise<{
+  public async resolveNode(progress?: Progress): Promise<{
     nodeId: Protocol.DOM.NodeId | null;
     objectId: Protocol.Runtime.RemoteObjectId;
   }> {
+    progress?.throwIfStopped();
     const session = this.frame.session;
 
-    await session.send("Runtime.enable");
-    await session.send("DOM.enable");
+    await runLocatorStep(progress, "enabling runtime", () => session.send("Runtime.enable"));
+    await runLocatorStep(progress, "enabling DOM", () => session.send("DOM.enable"));
 
     const index = this.nthIndex < 0 ? 0 : this.nthIndex;
-    const resolved = await this.selectorResolver.resolveAtIndex(this.selectorQuery, index);
+    const resolved = await this.selectorResolver.resolveAtIndex(
+      this.selectorQuery,
+      index,
+      progress,
+    );
     if (!resolved) {
       throw new Error(`Could not find an element for the given xPath(s): ${this.selector}`);
     }
```

---

### Incident Patch 9: `7a6cb5ad` (2026-09-30)
**Commit Message**: docs: fix broken links in Go, Java, and evals pages (#3076)

# why
Three links in the v3 docs are broken, and two Go code samples were
rewritten into links, so they no longer show valid Go.

# what changed
- `v3/sdk/go.mdx`: restore `param.Override[T](value)` and
`param.Override[stagehand.FooParams](12)`. Both had been turned into
links to non-existent files (`stagehand-go/blob/main/value` and `/12`).
The restored text matches the stagehand-go README.
- `v3/sdk/java.mdx`: the OkHttp logging interceptor link pointed at
`square/okhttp/tree/master`. That repo's default branch is `main`, and
`master` no longer resolves.
- `v3/basics/evals.mdx`: `evals.config.json` moved to
`packages/evals/evals.config.json`. The link used the old top-level
path.

# test plan
Checked each new target on GitHub (`packages/evals/evals.config.json` on
main, `okhttp-logging-interceptor` on okhttp main) and compared the Go
snippets against the stagehand-go README. Docs-only change, no Changeset
needed per CONTRIBUTING.md.


<!-- This is an auto-generated description by cubic. -->
---
## Summary by cubic
Fixes three broken links in the v3 docs.

- Go: the `param.Override[T](value)` and
`param.Override[stagehan

**File**: `packages/docs/v3/basics/evals.mdx` (modified, +1/-1)
```diff
@@ -131,7 +131,7 @@ evals run b:osworld -f source=Mind2Web
 
 #### Configuration Files
 
-You can view the specific evals in [`evals/tasks`](https://github.com/browserbase/stagehand/tree/main/packages/evals/tasks). Each eval is grouped into eval categories based on [`evals/evals.config.json`](https://github.com/browserbase/stagehand/blob/main/evals/evals.config.json).
+You can view the specific evals in [`evals/tasks`](https://github.com/browserbase/stagehand/tree/main/packages/evals/tasks). Each eval is grouped into eval categories based on [`evals/evals.config.json`](https://github.com/browserbase/stagehand/blob/main/packages/evals/evals.config.json).
 
 
 #### Viewing eval results
```

**File**: `packages/docs/v3/sdk/go.mdx` (modified, +2/-2)
```diff
@@ -268,7 +268,7 @@ Request structs contain a `.SetExtraFields(map[string]any)` method which can sen
 fields in the request body. Extra fields overwrite any struct fields with a matching
 key. For security reasons, only use `SetExtraFields` with trusted data.
 
-To send a custom value instead of a struct, use `param.Override[T](https://github.com/browserbase/stagehand-go/blob/main/value)`.
+To send a custom value instead of a struct, use `param.Override[T](value)`.
 
 ```go
 // In cases where the API specifies a given type,
@@ -278,7 +278,7 @@ p.SetExtraFields(map[string]any{
 })
 
 // Send a number instead of an object
-custom := param.Override[stagehand.FooParams](https://github.com/browserbase/stagehand-go/blob/main/12)
+custom := param.Override[stagehand.FooParams](12)
 ```
 
 ### Request unions
```

**File**: `packages/docs/v3/sdk/java.mdx` (modified, +1/-1)
```diff
@@ -475,7 +475,7 @@ The SDK throws custom unchecked exception types:
 
 ## Logging
 
-The SDK uses the standard [OkHttp logging interceptor](https://github.com/square/okhttp/tree/master/okhttp-logging-interceptor).
+The SDK uses the standard [OkHttp logging interceptor](https://github.com/square/okhttp/tree/main/okhttp-logging-interceptor).
 
 Enable logging by setting the `STAGEHAND_LOG` environment variable to `info`:
 
```

---

### Incident Patch 10: `4696e94a` (2026-09-30)
**Commit Message**: docs: Prose guide fix and clarify purpose of template (#3077)

# why

Fixing a prose issue surfaced in another PR, and while in there, added
clarity about the functions starter code and what could be replaced

# what changed

* Updates docs prose from "we recommend" to "Browserbase recommends"
* Specifies which node version
* Adds a note about the template code and what must stay vs be replaced

# test plan


<!-- This is an auto-generated description by cubic. -->
---
## Summary by cubic
Fixes prose in the deployment guide and clarifies that the Functions
template is starter code you replace.

- Changes "we recommend" to "Browserbase recommends" and specifies
Node.js 22.18 or later.
- Explains that the template contains a starter Function to replace, and
notes to keep the `defineFn` call and update the function name
consistently.

<sup>Written for commit 1f6ff6575b1c3c8364cc9b9621c8db8d7090763a.
Summary will update on new commits.</sup>

<a
href="https://cubic.dev/pr/browserbase/stagehand/pull/3077?utm_source=github"
target="_blank" rel="noopener noreferrer"
data-no-image-dialog="true"><picture><source
media="(prefers-color-scheme: dark)"
srcset="https://www.cubic.dev/buttons/revi

**File**: `packages/docs/v4/best-practices/deployments.mdx` (modified, +7/-5)
```diff
@@ -3,14 +3,14 @@ title: 'Deploying Stagehand'
 description: 'Deploy your AI agents and automations to the cloud'
 ---
 
-We recommend that you deploy Stagehand as a [Browserbase Function](https://docs.browserbase.com/platform/functions/quickstart). The Function runs next to its browser session on Browserbase, and it reads your API key from an encrypted project secret. You do not need a separate server, a Chrome binary, or a secrets store.
+Browserbase recommends that you deploy Stagehand as a [Browserbase Function](https://docs.browserbase.com/platform/functions/quickstart). The Function runs next to its browser session on Browserbase, and it reads your API key from an encrypted project secret. You do not need a separate server, a Chrome binary, or a secrets store.
 
 Stagehand also runs on other platforms. If Functions is not a good fit for you, see [Other deployment options](#other-deployment-options).
 
 ## Prerequisites
 
 - A Browserbase API key from [Settings](https://www.browserbase.com/settings)
-- Node.js and pnpm
+- Node.js 22.18 or later and pnpm
 - The `browse` CLI:
 
 ```bash
@@ -19,9 +19,11 @@ npm install -g browse
 
 ## Deploy a Stagehand Function
 
+These steps start from a template project. The template contains a starter Function that you replace with your own Stagehand code before you publish.
+
 <Steps>
 
-<Step title="Create the project">
+<Step title="Initialize a Functions project">
 
 ```bash
 browse functions init my-stagehand-function
@@ -44,9 +46,9 @@ In `index.ts`, replace `your-extension-id` with the `id` from the output.
 
 </Step>
 
-<Step title="Review the Function">
+<Step title="Replace the starter Function">
 
-The initializer creates this Function in `index.ts`. It connects Stagehand to the session that Browserbase creates for each invocation, then extracts the top stories from Hacker News:
+This is the starter Function in `index.ts`. Replace the template with the Stagehand code that you want to deploy. Keep the `defineFn` call. If you change the name `my-function`, use the new name in the steps that follow.
 
 ```typescript
 import { defineFn } from "@browserbasehq/sdk-functions";
```

---

### Incident Patch 11: `8308d8dc` (2026-09-30)
**Commit Message**: fix(cli): Functions CLI updates for `init` and `publish` (#3055)

# why

* Before Browserbase had secrets support, `functions init` would install
a playwright template. But now we support secrets so we can update the
starter template to showcase Stagehand.
* There were some rough edges around the `functions publish` command
related to pnpm 11. Added a few updates so that the functions CLI works
out of the box.

# what changed

# test plan

It works if nothing in this path errors:
1. [in stagehand repo] `pnpm build && cd packages/cli`
2. `alias browse-dev="node $HOME/[your dev
path]/stagehand/packages/cli/bin/run.js"` to set a local version of the
`browse` cli called `browse-dev`
3. `cd [your dev path, _not_ in stagehand repo] && browse-dev functions
init branch-test && cd branch-test`
4. `browse-dev cloud extensions upload
node_modules/@browserbasehq/stagehand/dist/assets/stagehand-extension.zip`
and then replace `your-extension-id` in `index.ts`
5. `browse-dev cloud secrets create BROWSERBASE_API_KEY --env
BROWSERBASE_API_KEY` to store your secret API key for use in the
deployed function
6. `browse-dev functions dev index.ts`
7. (in a new terminal) `curl -X POST
http://127.0.0.1:1

**File**: `.changeset/functions-init-stagehand.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"browse": patch
+---
+
+`functions init` now scaffolds a Stagehand project. It installs `@browserbasehq/stagehand` instead of `playwright-core`, installs the zod version that Stagehand uses, and writes a Stagehand starter function.
```

**File**: `.changeset/functions-lockfile-pnpm11.md` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+---
+"browse": patch
+---
+
+Fix Functions builds that failed because of how `functions publish` generated `package-lock.json` or how `functions init` set up pnpm:
+
+- `functions publish` now generates `package-lock.json` without registry URLs, so private npm registries work.
+- `functions publish` now resolves local `file:` dependencies by building `package-lock.json` from the uploaded files rather than just `package.json`.
+- `functions publish` now prints npm's error output when it can't generate `package-lock.json`.
+- `functions init` now writes a `pnpm-workspace.yaml` that allows the esbuild build script, required by pnpm 11+.
```

**File**: `packages/cli/src/lib/functions/dev.ts` (modified, +3/-1)
```diff
@@ -35,6 +35,7 @@ interface InvocationContext {
     id: string;
     connectUrl: string;
   };
+  secrets: Record<string, string>;
 }
 
 interface PendingConnection {
@@ -587,7 +588,8 @@ async function routeRequest(
     const accepted = bridge.triggerInvocation(
       functionName,
       params,
-      { session },
+      // Match production, which always sends secrets.
+      { session, secrets: {} },
       corsHeaders,
       response,
     );
```

**File**: `packages/cli/src/lib/functions/init.ts` (modified, +82/-20)
```diff
@@ -1,5 +1,5 @@
 import { spawnSync } from "node:child_process";
-import { existsSync } from "node:fs";
+import { existsSync, readFileSync } from "node:fs";
 import { mkdir, writeFile } from "node:fs/promises";
 import { join, resolve } from "node:path";
 
@@ -21,24 +21,50 @@ dist/
 `;
 
 const starterFunctionTemplate = `import { defineFn } from "@browserbasehq/sdk-functions";
-import { chromium } from "playwright-core";
-
-defineFn("my-function", async (context) => {
-  const browser = await chromium.connectOverCDP(context.session.connectUrl);
-  const page = browser.contexts()[0]!.pages()[0]!;
-
-  await page.goto("https://news.ycombinator.com");
-  await page.waitForSelector(".athing", { timeout: 30_000 });
+import { browserbase, Stagehand } from "@browserbasehq/stagehand";
+import { z } from "zod/v4";
+
+defineFn(
+  "my-function",
+  async (context) => {
+    const browser = await browserbase.connect({
+      // The local dev server has no secrets, so fall back to .env.
+      apiKey:
+        context.secrets.BROWSERBASE_API_KEY ?? process.env.BROWSERBASE_API_KEY!,
+      sessionId: context.session.id,
+    });
+    // In this example, Stagehand uses the Model Gateway where Browserbase charges for the tokens
+    const stagehand = await Stagehand.create({ browser });
+    const page = (await browser.context.activePage())!;
+
+    await page.goto("https://news.ycombinator.com");
+    const { data } = await stagehand.extract(
+      "Extract the top 3 stories with their rank, title, and link URL.",
+      z.object({
+        stories: z
+          .array(z.object({ rank: z.number(), title: z.string(), url: z.string() }))
+          .max(3),
+      }),
+    );
 
-  const titles = await page.$$eval(".athing .titleline > a", (elements) =>
-    elements.slice(0, 3).map((element) => element.textContent),
-  );
+    await stagehand.close();
+    return {
+      message: "Successfully fetched top Hacker News stories",
+      timestamp: new Date().toISOString(),
+      results: data.stories,
+    };
+  },
+  {
+    // Upload the Stagehand extension once, then paste its ID here:
+    //   browse cloud extensions upload node_modules/@browserbasehq/stagehand/dist/assets/stagehand-extension.zip
+    sessionConfig: { extensionId: "your-extension-id" },
+  },
+);
+`;
 
-  return {
-    message: "Fetched top Hacker News titles",
-    titles,
-  };
-});
+// pnpm 11 and later fail installs when esbuild's build script is not approved.
+const pnpmWorkspaceTemplate = `allowBuilds:
+  esbuild: true
 `;
 
 const tsconfigTemplate = `{
@@ -95,14 +121,27 @@ export async function initFunctionsProject({
   await writeFile(join(projectRoot, ".gitignore"), gitignoreTemplate);
   await writeFile(join(projectRoot, "index.ts"), starterFunctionTemplate);
   await writeFile(join(projectRoot, "tsconfig.json"), tsconfigTemplate);
+  if (packageManager === "pnpm") {
+    await writeFile(
+      join(projectRoot, "pnpm-workspace.yaml"),
+      pnpmWorkspaceTemplate,
+    );
+  }
 
   const install = packageManager === "pnpm" ? ["add"] : ["install"];
   const installDev =
     packageManager === "pnpm" ? ["add", "-D"] : ["install", "--save-dev"];
 
   runPackageManager(
     packageManager,
-    [...install, "@browserbasehq/sdk-functions", "playwright-core"],
+    [...install, "@browserbasehq/sdk-functions", "@browserbasehq/stagehand"],
+    projectRoot,
+  );
+  // Match Stagehand's version of zod in order to pass type checks.
+  const zodVersion = readStagehandZodVersion(projectRoot);
+  runPackageManager(
+    packageManager,
+    [...install, zodVersion ? `zod@${zodVersion}` : "zod"],
     projectRoot,
   );
   runPackageManager(
@@ -127,8 +166,11 @@ export async function initFunctionsProject({
         nextSteps: [
           `cd ${projectName}`,
           "Edit .env with your Browserbase API key",
-          packageManager === "pnpm" ? "pnpm dev" : "npm run dev",
-          packageManager === "pnpm" ? "pnpm run deploy" : "npm run deploy",
+          "browse cloud extensions upload node_modules/@browserbasehq/stagehand/dist/assets/stagehand-extension.zip",
+          "Paste the uploaded extension ID into index.ts",
+          "browse functions dev index.ts",
+          "browse functions publish index.ts",
+          "Create a BROWSERBASE_API_KEY secret with browse cloud secrets create, then attach it with browse functions secrets attach",
         ],
       },
       null,
@@ -144,6 +186,26 @@ function ensureCommand(command: string): void {
   }
 }
 
+function readStagehandZodVersion(projectRoot: string): string | undefined {
+  try {
+    const stagehandPackageJson = JSON.parse(
+      readFileSync(
+        join(
+          projectRoot,
+          "node_modules",
+          "@browserbasehq",
+          "stagehand",
+          "package.json",
+        ),
+        "utf8",
+      ),
+    ) as { dependencies?: Record<string, string> };
+    return stagehandPackageJson.dependencies?.zod;
+  } catch {
+    return undefined;
+  }
+}
+
 functi
```

**File**: `packages/cli/src/lib/functions/publish.ts` (modified, +19/-6)
```diff
@@ -215,17 +215,30 @@ function ensureArchiveLockfile(
 
   const tempDir = join(tmpdir(), `bb-functions-lockgen-${randomUUID()}`);
   mkdirSync(tempDir, { recursive: true });
-  copyFileSync(join(root, "package.json"), join(tempDir, "package.json"));
+  // Copy the files that publish uploads, so npm resolves local dependencies the same way the build does.
+  for (const entry of entries) {
+    const target = join(tempDir, entry);
+    mkdirSync(dirname(target), { recursive: true });
+    copyFileSync(join(root, entry), target);
+  }
 
-  const result = spawnSync("npm", ["install", "--package-lock-only"], {
-    cwd: tempDir,
-    stdio: "pipe",
-  });
+  // Omit resolved URLs so the builder installs from its own registry rather than the one on your machine.
+  const result = spawnSync(
+    "npm",
+    ["install", "--package-lock-only", "--omit-lockfile-registry-resolved"],
+    {
+      cwd: tempDir,
+      stdio: "pipe",
+    },
+  );
 
   if (result.status !== 0) {
     rmSync(tempDir, { recursive: true, force: true });
+    const npmOutput = result.error
+      ? result.error.message
+      : result.stderr.toString().trim();
     fail(
-      "Failed to generate package-lock.json for the Functions build archive.",
+      `Failed to generate package-lock.json for the Functions build archive.${npmOutput ? `\n${npmOutput}` : ""}`,
     );
   }
 
```

**File**: `packages/cli/tests/cli-functions-contract.test.ts` (modified, +213/-0)
```diff
@@ -157,6 +157,163 @@ describe("functions API contracts", () => {
     );
   });
 
+  itPosix(
+    "generates package-lock.json without registry resolved URLs",
+    async () => {
+      const cwd = await createFunctionFixture("functions-publish-lockgen-");
+      const argsLog = join(cwd, "npm-args.log");
+      const fakeBin = await createFakePackageManagerBin(
+        "npm",
+        `#!/bin/sh\necho "$@" > "${argsLog}"\necho '{"lockfileVersion":3}' > package-lock.json\n`,
+      );
+
+      await withServer(
+        async (request, response) => {
+          if (
+            request.method === "POST" &&
+            request.path === "/v1/functions/builds"
+          ) {
+            jsonResponse(response, 200, { id: "build_lockgen" });
+            return;
+          }
+
+          jsonResponse(response, 200, {
+            id: "build_lockgen",
+            status: "COMPLETED",
+          });
+        },
+        async ({ baseUrl }) => {
+          const result = await runCli(
+            [
+              "functions",
+              "publish",
+              "index.ts",
+              "--api-key",
+              "test-key",
+              "--base-url",
+              baseUrl,
+            ],
+            {
+              cwd,
+              env: {
+                PATH: `${fakeBin}:${process.env.PATH}`,
+              },
+            },
+          );
+
+          expect(result.exitCode).toBe(0);
+          expect(await readFile(argsLog, "utf8")).toContain(
+            "--omit-lockfile-registry-resolved",
+          );
+        },
+      );
+    },
+  );
+
+  itPosix("prints npm output when lockfile generation fails", async () => {
+    const cwd = await createFunctionFixture("functions-publish-lockgen-fail-");
+    const fakeBin = await createFakePackageManagerBin(
+      "npm",
+      "#!/bin/sh\necho 'npm error code EBADDEVENGINES' >&2\nexit 1\n",
+    );
+
+    const result = await runCli(
+      [
+        "functions",
+        "publish",
+        "index.ts",
+        "--api-key",
+        "test-key",
+        "--base-url",
+        "http://127.0.0.1:9",
+      ],
+      {
+        cwd,
+        env: {
+          PATH: `${fakeBin}:${process.env.PATH}`,
+        },
+      },
+    );
+
+    expect(result.exitCode).not.toBe(0);
+    expect(result.stderr).toContain("Failed to generate package-lock.json");
+    expect(result.stderr).toContain("EBADDEVENGINES");
+  });
+
+  itPosix(
+    "resolves local file dependencies when it generates package-lock.json",
+    async () => {
+      const cwd = await createFunctionFixture("functions-publish-local-dep-");
+      await writeFile(join(cwd, "local-sdk.tgz"), "fake tarball");
+      await writeFile(
+        join(cwd, "package.json"),
+        JSON.stringify({
+          name: "functions-fixture",
+          private: true,
+          type: "module",
+          dependencies: { "local-sdk": "file:local-sdk.tgz" },
+        }),
+      );
+      // Log outside the project so the log never lands in the publish archive.
+      const argsLog = join(
+        await createTempDir("functions-local-dep-log-"),
+        "npm-args.log",
+      );
+      // Fake npm fails unless the local dependency is next to package.json, like real npm.
+      const fakeBin = await createFakePackageManagerBin(
+        "npm",
+        `#!/bin/sh
+echo "$@" > "${argsLog}"
+test -f local-sdk.tgz || { echo "npm error ENOENT local-sdk.tgz" >&2; exit 254; }
+echo '{"lockfileVersion":3}' > package-lock.json
+`,
+      );
+
+      await withServer(
+        async (request, response) => {
+          if (
+            request.method === "POST" &&
+            request.path === "/v1/functions/builds"
+          ) {
+            jsonResponse(response, 200, { id: "build_local_dep" });
+            return;
+          }
+
+          jsonResponse(response, 200, {
+            id: "build_local_dep",
+            status: "COMPLETED",
+          });
+        },
+        async ({ baseUrl }) => {
+          const result = await runCli(
+            [
+              "functions",
+              "publish",
+              "index.ts",
+              "--api-key",
+              "test-key",
+              "--base-url",
+              baseUrl,
+            ],
+            {
+              cwd,
+              env: {
+                PATH: `${fakeBin}:${process.env.PATH}`,
+              },
+            },
+          );
+
+          expect(result.stderr).not.toContain("ENOENT");
+          expect(result.exitCode).toBe(0);
+          // Proves lockfile generation ran, so the test fails if publish ever skips it.
+          expect(await readFile(argsLog, "utf8")).toContain(
+            "--package-lock-only",
+          );
+        },
+      );
+    },
+  );
+
   itPosix("exits nonzero when a build fails", async () => {
     const cwd = await createFunctionFixture("functions-publish-fail-");
 
@@ -341,8 +498,61 @@ describe("functions scaffolding and local dev", () => {
     expect(
       await readFile(join(cwd, "d
```

---

### Incident Patch 12: `ad2bf12e` (2026-09-28)
**Commit Message**: [chore]: fix failing CI due to external website change (#3069)

# why
- example.com changed, this broke some smoke tests in our ci
# what changed
- swapped it to a hosted eval site that is similar to example.com


<!-- This is an auto-generated description by cubic. -->
---
## Summary by cubic
Fixes failing CI smoke tests by replacing `https://example.com` with a
hosted eval site that mirrors example.com across the Go, Python, and
TypeScript SDK examples and the TypeScript Browserbase smoke test.

<sup>Written for commit dfd525ef832cdfb963d3e7e2013ac834ceadd296.
Summary will update on new commits.</sup>

<a
href="https://cubic.dev/pr/browserbase/stagehand/pull/3069?utm_source=github"
target="_blank" rel="noopener noreferrer"
data-no-image-dialog="true"><picture><source
media="(prefers-color-scheme: dark)"
srcset="https://www.cubic.dev/buttons/review-in-cubic-dark.svg"><source
media="(prefers-color-scheme: light)"
srcset="https://www.cubic.dev/buttons/review-in-cubic-light.svg"><img
alt="Review in cubic"
src="https://www.cubic.dev/buttons/review-in-cubic-dark.svg"></picture></a>

<!-- End of auto-generated description by cubic. -->

**File**: `packages/sdk-go/examples/extract.go` (modified, +1/-1)
```diff
@@ -51,7 +51,7 @@ func run(ctx context.Context) (err error) {
 		return errors.New("Stagehand initialized without an active page")
 	}
 	page := pages[0]
-	if _, err := page.Goto(ctx, "https://example.com", nil); err != nil {
+	if _, err := page.Goto(ctx, "https://browserbase.github.io/stagehand-eval-sites/sites/example/", nil); err != nil {
 		return err
 	}
 
```

**File**: `packages/sdk-python/examples/extract.py` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ async def main() -> None:
             page = (await browser.context.pages())[0]
             if page is None:
                 raise RuntimeError("Stagehand initialized without an active page")
-            await page.goto("https://example.com")
+            await page.goto("https://browserbase.github.io/stagehand-eval-sites/sites/example/")
 
             result = await stagehand.extract(
                 "Extract the page heading and description",
```

**File**: `packages/sdk-ts/examples/extract.ts` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@ const stagehand = await Stagehand.create({
 });
 
 const [page] = await browser.context.pages();
-await page.goto("https://example.com");
+await page.goto("https://browserbase.github.io/stagehand-eval-sites/sites/example/");
 
 const result = await stagehand.extract(
   "Extract the page heading and description",
```

**File**: `packages/sdk-ts/tests/browser-runtime/stagehandBrowserbaseSmoke.test.ts` (modified, +4/-3)
```diff
@@ -6,6 +6,7 @@ import { browserbase, Stagehand, type StagehandBrowser } from "../../src/index.j
 
 const browserbaseApiKey = process.env.BROWSERBASE_API_KEY;
 const shouldRun = process.env.BROWSERBASE_SMOKE === "1" || Boolean(browserbaseApiKey);
+const exampleTestSite = "https://browserbase.github.io/stagehand-eval-sites/sites/example/";
 const webMCPTestSite = "https://browserbase.github.io/stagehand-eval-sites/sites/webmcp-test/";
 
 describe.runIf(shouldRun)("Stagehand TS SDK Browserbase smoke", () => {
@@ -43,9 +44,9 @@ describe.runIf(shouldRun)("Stagehand TS SDK Browserbase smoke", () => {
     const page =
       (await stagehand.browser.context.pages())[0] ?? (await stagehand.browser.context.newPage());
 
-    await page.goto("https://example.com", { waitUntil: "load" });
+    await page.goto(exampleTestSite, { waitUntil: "load" });
 
-    await expect(page.url()).resolves.toBe("https://example.com/");
+    await expect(page.url()).resolves.toBe(exampleTestSite);
     await expect(page.title()).resolves.toBe("Example Domain");
     await expect(page.locator("h1").innerText()).resolves.toBe("Example Domain");
   });
@@ -116,7 +117,7 @@ describe.runIf(shouldRun)("Stagehand TS SDK Browserbase smoke", () => {
     }
     const firstStagehand = stagehand;
     const page = (await browser.context.pages())[0] ?? (await browser.context.newPage());
-    await page.goto("https://example.com", { waitUntil: "load" });
+    await page.goto(exampleTestSite, { waitUntil: "load" });
     const pageId = page.pageId;
 
     await expect(firstStagehand.close()).resolves.toBeUndefined();
```

---

### Incident Patch 13: `163c7470` (2026-09-28)
**Commit Message**: docs: reorganize integrations and add Stripe WebMCP guide (#3011)

## Summary

Make the integrations overview a general directory for connecting
Stagehand to agents, frameworks, and application workflows. Organize the
overview and sidebar into Agent Frameworks, CLI Agents, and Automations.

- Add dedicated overviews for Agent Frameworks and CLI Agents. Cover
framework connections separately from MCP adapter setup for coding
agents, with Pi documented as a native extension.
- Update navigation and security links, and replace the removed MCP
best-practices entry with the CLI Agents guide.
- Add Stripe under Automations, documenting the Checkout sample from
https://github.com/stripe-samples/webmcp/pull/5, its setup, WebMCP flow,
and final Pay click.
- Pin the Stripe sample commit while the upstream PR is open and explain
its spending limit and result-handling limitations.

## Validation

- `mint validate`
- `mint broken-links --check-anchors --check-redirects --check-snippets`
- `mint a11y --skip-contrast`
- Formatting check for `docs.json` and `git diff --check`

All passed using Node.js 24. Checkout was not executed; the Stripe guide
was verified against the upstream sample source.


**File**: `packages/docs/docs.json` (modified, +75/-12)
```diff
@@ -53,15 +53,31 @@
             "group": "Integrations",
             "pages": [
               "v4/integrations/overview",
-              "v4/integrations/claude-code",
-              "v4/integrations/codex",
-              "v4/integrations/eve",
-              "v4/integrations/deep-agents",
-              "v4/integrations/crewai",
-              "v4/integrations/mastra",
-              "v4/integrations/fx",
-              "v4/integrations/pi",
-              "v4/integrations/vercel-ai-sdk"
+              {
+                "group": "Agent Frameworks",
+                "pages": [
+                  "v4/integrations/agent-frameworks/overview",
+                  "v4/integrations/agent-frameworks/eve",
+                  "v4/integrations/agent-frameworks/deep-agents",
+                  "v4/integrations/agent-frameworks/crewai",
+                  "v4/integrations/agent-frameworks/mastra",
+                  "v4/integrations/agent-frameworks/vercel-ai-sdk"
+                ]
+              },
+              {
+                "group": "CLI Agents",
+                "pages": [
+                  "v4/integrations/cli-agents/overview",
+                  "v4/integrations/cli-agents/claude-code",
+                  "v4/integrations/cli-agents/codex",
+                  "v4/integrations/cli-agents/fx",
+                  "v4/integrations/cli-agents/pi"
+                ]
+              },
+              {
+                "group": "Applications",
+                "pages": ["v4/integrations/applications/stripe"]
+              }
             ]
           },
           {
@@ -74,8 +90,7 @@
               "v4/best-practices/user-data",
               "v4/best-practices/speed-optimization",
               "v4/best-practices/cost-optimization",
-              "v4/best-practices/deployments",
-              "v4/best-practices/mcp-integrations"
+              "v4/best-practices/deployments"
             ]
           },
           {
@@ -519,7 +534,7 @@
     },
     {
       "source": "/best-practices/mcp-integrations",
-      "destination": "/v4/best-practices/mcp-integrations"
+      "destination": "/v4/integrations/cli-agents/overview"
     },
     {
       "source": "/best-practices/prompting-best-practices",
@@ -545,6 +560,54 @@
       "source": "/best-practices/:slug*",
       "destination": "/v3/best-practices/:slug*"
     },
+    {
+      "source": "/v4/integrations/agents",
+      "destination": "/v4/integrations/agent-frameworks/overview"
+    },
+    {
+      "source": "/v4/integrations/eve",
+      "destination": "/v4/integrations/agent-frameworks/eve"
+    },
+    {
+      "source": "/v4/integrations/deep-agents",
+      "destination": "/v4/integrations/agent-frameworks/deep-agents"
+    },
+    {
+      "source": "/v4/integrations/crewai",
+      "destination": "/v4/integrations/agent-frameworks/crewai"
+    },
+    {
+      "source": "/v4/integrations/mastra",
+      "destination": "/v4/integrations/agent-frameworks/mastra"
+    },
+    {
+      "source": "/v4/integrations/vercel-ai-sdk",
+      "destination": "/v4/integrations/agent-frameworks/vercel-ai-sdk"
+    },
+    {
+      "source": "/v4/integrations/cli-agents",
+      "destination": "/v4/integrations/cli-agents/overview"
+    },
+    {
+      "source": "/v4/integrations/claude-code",
+      "destination": "/v4/integrations/cli-agents/claude-code"
+    },
+    {
+      "source": "/v4/integrations/codex",
+      "destination": "/v4/integrations/cli-agents/codex"
+    },
+    {
+      "source": "/v4/integrations/fx",
+      "destination": "/v4/integrations/cli-agents/fx"
+    },
+    {
+      "source": "/v4/integrations/pi",
+      "destination": "/v4/integrations/cli-agents/pi"
+    },
+    {
+      "source": "/v4/integrations/stripe",
+      "destination": "/v4/integrations/applications/stripe"
+    },
     {
       "source": "/integrations/mcp/:slug*",
       "destination": "/v3/integrations/mcp/:slug*"
```

**File**: `packages/docs/v4/best-practices/mcp-integrations.mdx` (removed, +0/-124)
```diff
@@ -1,124 +0,0 @@
----
-title: "MCP integrations"
-description: "Call Model Context Protocol (MCP) servers alongside Stagehand's primitives"
----
-
-<Note>
-Stagehand v4 does not include an autonomous agent or a general-purpose MCP client. To call third-party MCP tools alongside Stagehand, orchestrate both from your own code as shown below.
-</Note>
-
-Stagehand also provides experimental [integrations](/v4/integrations/overview) that expose a persistent Stagehand browser to CrewAI, Deep Agents, Mastra, and the Vercel AI SDK over MCP. The Eve integration exposes the same tools natively.
-
-<Card title="Stagehand integrations" icon="puzzle-piece" href="/v4/integrations/overview">
-  Give an agent the `run`, `snapshot`, and `screenshot` browser tools.
-</Card>
-
-## Calling MCP servers from your code
-
-Interleave your tool results with Stagehand's primitives. Because v4 has no autonomous loop, you are already writing the orchestration, so a tool call is one more step in the sequence.
-
-<Tabs>
-<Tab title="TypeScript">
-```typescript
-// Your MCP client, your credentials, your control flow
-const searchResults = await mcpClient.callTool("web_search", {
-  query: "browserbase pricing",
-});
-
-// Hand the result to Stagehand as an ordinary instruction
-await page.goto(searchResults.topUrl);
-
-const { data } = await stagehand.extract(
-  "extract the pricing tiers",
-  z.object({ pricing: z.array(z.object({ tier: z.string(), price: z.string() })) }),
-);
-```
-</Tab>
-
-<Tab title="Python">
-```python
-# Your MCP client, your credentials, your control flow
-search_results = await mcp_client.call_tool(
-    "web_search", {"query": "browserbase pricing"}
-)
-
-# Hand the result to Stagehand as an ordinary instruction
-await page.goto(search_results["top_url"])
-
-
-class Tier(BaseModel):
-    tier: str
-    price: str
-
-
-class Pricing(BaseModel):
-    pricing: list[Tier]
-
-
-result = await stagehand.extract(
-    instruction="extract the pricing tiers",
-    schema=Pricing,
-)
-pricing = result.data
-```
-</Tab>
-
-<Tab title="Go">
-```go
-// Your MCP client, your credentials, your control flow
-searchResults, err := mcpClient.CallTool(ctx, "web_search", map[string]any{
-	"query": "browserbase pricing",
-})
-if err != nil {
-	return err
-}
-
-// Hand the result to Stagehand as an ordinary instruction
-if _, err := page.Goto(ctx, searchResults.TopURL, nil); err != nil {
-	return err
-}
-
-type tier struct {
-	Tier  string `json:"tier"`
-	Price string `json:"price"`
-}
-
-type pricing struct {
-	Pricing []tier `json:"pricing"`
-}
-
-
-extracted, err := stagehand.Extract[pricing](
-	ctx,
-	client,
-	"extract the pricing tiers",
-	nil,
-)
-if err != nil {
-	return err
-}
-
-for _, t := range extracted.Data.Pricing {
-	fmt.Println(t.Tier, t.Price)
-}
-```
-</Tab>
-</Tabs>
-
-<Tip>
-MCP is still useful on the authoring side: wire the Stagehand docs MCP server into your coding assistant so it generates correct v4 code. See [AI Rules](/v4/first-steps/ai-rules#using-mcp-servers).
-</Tip>
-
-## Next steps
-
-<CardGroup cols={3}>
-  <Card title="Act" icon="play" href="/v4/basics/act">
-    Perform a single action with natural language
-  </Card>
-  <Card title="Extract" icon="table" href="/v4/basics/extract">
-    Pull typed data out of any page
-  </Card>
-  <Card title="AI rules" icon="screwdriver-wrench" href="/v4/first-steps/ai-rules">
-    MCP servers for your coding assistant
-  </Card>
-</CardGroup>
```

**File**: `packages/docs/v4/integrations/agent-frameworks/crewai.mdx` (renamed, +1/-1)
```diff
@@ -82,7 +82,7 @@ CrewAI's current tool loop is text-only, and its standard MCP adapter drops imag
 The example opens one MCP session around the complete CrewAI run. Keep that lifetime when adapting the example: creating a new MCP process for each tool call loses the browser and invalidates prior snapshot IDs.
 
 <Warning>
-`run` executes model-authored JavaScript in the browser. Use Browserbase for untrusted tasks and review the [integration security boundary](/v4/integrations/overview#security-boundary).
+`run` executes model-authored JavaScript in the browser. Use Browserbase for untrusted tasks and review the [integration security boundary](/v4/integrations/agent-frameworks/overview#security-boundary).
 </Warning>
 
 <Card title="CrewAI integration source" icon="github" href="https://github.com/browserbase/stagehand/tree/main/packages/integrations/crewai">
```

**File**: `packages/docs/v4/integrations/agent-frameworks/deep-agents.mdx` (renamed, +1/-1)
```diff
@@ -105,7 +105,7 @@ uv run mda deploy .
 Browser state remains available while the managed worker is warm. Stagehand does not yet support durable reconnection after a worker replacement.
 
 <Warning>
-`run` executes model-authored JavaScript in the browser. Use Browserbase for untrusted tasks and review the [integration security boundary](/v4/integrations/overview#security-boundary).
+`run` executes model-authored JavaScript in the browser. Use Browserbase for untrusted tasks and review the [integration security boundary](/v4/integrations/agent-frameworks/overview#security-boundary).
 </Warning>
 
 <Card title="Deep Agents integration source" icon="github" href="https://github.com/browserbase/stagehand/tree/main/packages/integrations/deepagents">
```

**File**: `packages/docs/v4/integrations/agent-frameworks/eve.mdx` (renamed, +1/-1)
```diff
@@ -84,7 +84,7 @@ On Browserbase, the example creates a `keepAlive` session and writes its ID to a
 A Browserbase keep-alive session continues running and can continue billing until Eve reattaches it, you release it through Browserbase, or the project timeout ends it.
 </Warning>
 
-`run` executes model-authored JavaScript in the browser. For untrusted tasks, review the [integration security boundary](/v4/integrations/overview#security-boundary).
+`run` executes model-authored JavaScript in the browser. For untrusted tasks, review the [integration security boundary](/v4/integrations/agent-frameworks/overview#security-boundary).
 
 <Card title="Eve integration source" icon="github" href="https://github.com/browserbase/stagehand/tree/main/packages/integrations/eve">
   Read the native tool bindings and durable-session implementation.
```

**File**: `packages/docs/v4/integrations/agent-frameworks/mastra.mdx` (renamed, +1/-1)
```diff
@@ -70,7 +70,7 @@ The example creates one MCP client and one facade MCP server for the entire mode
 The MCP child receives only Stagehand and Browserbase configuration plus the process values required to launch Node. The host's model credential remains in the Mastra process.
 
 <Warning>
-`run` executes model-authored JavaScript in the browser. Use Browserbase for untrusted tasks and review the [integration security boundary](/v4/integrations/overview#security-boundary).
+`run` executes model-authored JavaScript in the browser. Use Browserbase for untrusted tasks and review the [integration security boundary](/v4/integrations/agent-frameworks/overview#security-boundary).
 </Warning>
 
 <Card title="Mastra integration source" icon="github" href="https://github.com/browserbase/stagehand/tree/main/packages/integrations/mastra">
```

**File**: `packages/docs/v4/integrations/agent-frameworks/overview.mdx` (added, +102/-0)
```diff
@@ -0,0 +1,102 @@
+---
+title: "Agent Frameworks"
+sidebarTitle: "Overview"
+description: "Add persistent browser tools to your agent framework through MCP or native bindings."
+---
+
+Use Stagehand as the browser layer in an agent you build with an agent framework. Your framework manages the model, instructions, and tool loop; Stagehand keeps the browser session available as the agent navigates, interacts with pages, and reads results.
+
+Choose an integration based on your framework and how it connects tools:
+
+| Framework | Connection | Guide |
+| --- | --- | --- |
+| Eve | Native TypeScript tools in the Eve process. | [Eve](/v4/integrations/agent-frameworks/eve) |
+| Deep Agents | MCP over stdio locally, or native Python tools in Managed Deep Agents. | [Deep Agents](/v4/integrations/agent-frameworks/deep-agents) |
+| CrewAI | Python agent connected to the TypeScript MCP server over stdio. | [CrewAI](/v4/integrations/agent-frameworks/crewai) |
+| Mastra | MCP tools in a Mastra agent. | [Mastra](/v4/integrations/agent-frameworks/mastra) |
+| Vercel AI SDK | MCP tools in an AI SDK tool loop. | [Vercel AI SDK](/v4/integrations/agent-frameworks/vercel-ai-sdk) |
+
+Each integration provides `run`, `snapshot`, and `screenshot`. To connect an existing coding agent instead, see [CLI Agents](/v4/integrations/cli-agents/overview).
+
+<Info>
+These integrations are experimental and run from the Stagehand repository. The adapters and shared integration package are not published as standalone packages.
+</Info>
+
+## Tool contract
+
+The agent framework integrations expose the same browser capabilities.
+
+<AccordionGroup>
+  <Accordion title="snapshot">
+    Read a compact accessibility tree for the active page. Pass the bracketed IDs on interactive elements to `run` actions.
+
+    IDs are valid only for the latest snapshot of the active page. Take another snapshot after navigation or when an ID becomes stale.
+  </Accordion>
+  <Accordion title="run">
+    Execute JavaScript against Playwright-shaped `page`, `context`, and `browser` objects, or send a batch of actions that reference snapshot IDs.
+
+    `run` accepts exactly one of `code` or `actions`. Snapshot actions support `click`, `hover`, `fill`, `type`, `press`, and `select`.
+
+```json JavaScript
+{
+  "code": "await page.goto('https://example.com'); return await page.title();"
+}
+```
+
+```json Snapshot actions
+{
+  "actions": [{ "op": "click", "id": "1-42" }]
+}
+```
+  </Accordion>
+  <Accordion title="screenshot">
+    Capture the active page as a PNG or JPEG for visual inspection. The integration adapts the image to the tool-result format supported by your framework.
+  </Accordion>
+</AccordionGroup>
+
+## How sessions work
+
+The tools share a browser for the lifetime of the integration's client session. A navigation performed by `run` is visible to the next `snapshot`, and authentication and page state remain available across calls.
+
+With MCP, keep one client connection open so the server and browser stay alive across calls. With native bindings, keep the browser runtime available for the lifetime of the agent session. Deployment-specific persistence and reconnection behavior are documented in each integration guide.
+
+<Warning>
+Do not create a new MCP process for every tool call. Doing so starts a new browser and invalidates any snapshot IDs from the previous call.
+</Warning>
+
+## Set up your framework
+
+Start with your framework's guide for its runtime requirements, installation steps, and tool registration. Integrations can connect through a stdio MCP server or bind browser tools directly in the agent process.
+
+1. Install the integration and its required runtime dependencies.
+2. Register the browser tools with your framework's agent loop.
+3. Configure the browser and the agent's model credentials.
+4. Keep the browser connection available across tool calls, and close it when the session ends.
+
+## Choose a browser
+
+Use local Chrome for development or a Browserbase session for hosted browser execution. Set the browser mode explicitly when you need predictable behavior across environments; defaults and environment-variable handling depend on the integration.
+
+For Browserbase, provide an API key and any project configuration required by the integration. For local mode, install a supported version of Chrome. See your framework's guide for the exact settings.
+
+## Configure models
+
+Your framework's agent model decides which browser tool to call and what input to send. Configure that model and its credentials through your framework.
+
+Stagehand's browser tools do not require a separate model for deterministic operations such as navigation, snapshots, and screenshots. If your integration supports Stagehand AI methods such as `act`, `extract`, or `observe`, configure a Stagehand model when using those methods.
+
+Keep the agent model and Stagehand model configuration separate. Credential forwarding and provider-key inference vary 
```

**File**: `packages/docs/v4/integrations/agent-frameworks/vercel-ai-sdk.mdx` (renamed, +2/-2)
```diff
@@ -6,7 +6,7 @@ description: "Give a Vercel AI SDK agent persistent Stagehand browser tools over
 The Vercel AI SDK integration connects an AI SDK tool loop to the Stagehand facade MCP server over MCP/stdio. One server process owns the browser, so page state survives across `run`, `snapshot`, and `screenshot` calls.
 
 <Tip>
-Building with Eve? Use the [native Eve integration](/v4/integrations/eve) to run the same tool contract in-process.
+Building with Eve? Use the [native Eve integration](/v4/integrations/agent-frameworks/eve) to run the same tool contract in-process.
 </Tip>
 
 <Note>
@@ -74,7 +74,7 @@ The example connects once with `createMCPClient`, loads the three tools, and clo
 The MCP child receives only Stagehand and Browserbase configuration plus the process values required to launch Node. The host's model credential remains in the AI SDK process.
 
 <Warning>
-`run` executes model-authored JavaScript in the browser. Use Browserbase for untrusted tasks and review the [integration security boundary](/v4/integrations/overview#security-boundary).
+`run` executes model-authored JavaScript in the browser. Use Browserbase for untrusted tasks and review the [integration security boundary](/v4/integrations/agent-frameworks/overview#security-boundary).
 </Warning>
 
 <Card title="Vercel AI SDK integration source" icon="github" href="https://github.com/browserbase/stagehand/tree/main/packages/integrations/vercel-ai">
```

---

### Incident Patch 14: `34edfa38` (2026-09-27)
**Commit Message**: feat: expose PDF rendering across Stagehand SDKs (#3030)

# why

Expose PDF rendering through the existing Stagehand SDK conventions
after the internal extension implementation is in place.

This is **PR2 of 2**, stacked directly on #3034
(`amel/pdf-render-extension`). Merge the parent first and follow the
repository's stacked-PR handoff rules when moving this PR to `main`.

# what changed

- Register the `page.pdf` protocol operation and connect the extension
router, controller, and runtime to the internal implementation from
#3034. Replace its temporary native-CDP signature with the canonical
protocol types.
- Add TypeScript and Python `page.pdf()` and Go `Page.PDF()`, returning
PDF bytes. TypeScript and Python optionally write a local file using
their existing screenshot conventions.
- Add typed print options and matching SDK response deadlines: 30
seconds for capture by default, with `timeout: 0` disabling the
deadline. Preserve error causes and include computed timeout durations
in diagnostics.
- Regenerate the protocol document, Python and Go models, and the final
embedded extension ZIP. Keep the public API documentation and release
changeset with the SDK exposure.
- Add wire

**File**: `.changeset/bright-pdfs-print.md` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+---
+"@browserbasehq/stagehand-python": minor
+"@browserbasehq/stagehand-extension": minor
+"@browserbasehq/stagehand-protocol": minor
+"@browserbasehq/stagehand-go": minor
+"@browserbasehq/stagehand": minor
+---
+
+Export browser pages as PDF bytes in TypeScript, Python, and Go, with configurable print settings and timeouts, and optional local file saving in TypeScript and Python.
```

**File**: `packages/docs/v4/reference/page.mdx` (modified, +254/-0)
```diff
@@ -586,6 +586,97 @@ const image = await page.screenshot({ fullPage: true });
   The screenshot image bytes.
 </ResponseField>
 
+## pdf()
+
+Render the current document to PDF with Chrome's print pipeline.
+
+If a running print times out, further captures on that page fail until Chrome finishes the pending
+print. Other pages remain available.
+
+```typescript
+const pdf = await page.pdf({
+  path: "page.pdf",
+  margin: { top: 0.25, bottom: 0.25 },
+  preferCSSPageSize: true,
+  printBackground: true,
+});
+```
+
+<ParamField path="options" type="PDFOptions" optional>
+  Options that configure PDF rendering. Paper sizes and margins are measured in inches.
+
+  <ParamField path="options.displayHeaderFooter" type="boolean" optional>
+    Whether to render the header and footer templates.
+  </ParamField>
+
+  <ParamField path="options.footerTemplate" type="string" optional>
+    HTML for the print footer. Chrome fills elements with `pageNumber`, `totalPages`, `date`,
+    `title`, and `url` classes.
+  </ParamField>
+
+  <ParamField path="options.outline" type="boolean" optional>
+    Whether to generate a document outline from the page structure. Defaults to `false`.
+  </ParamField>
+
+  <ParamField path="options.tagged" type="boolean" optional>
+    Whether to include document structure tags in the PDF. Defaults to `false`.
+  </ParamField>
+
+  <ParamField path="options.headerTemplate" type="string" optional>
+    HTML for the print header, with the same supported classes as `footerTemplate`.
+  </ParamField>
+
+  <ParamField path="options.landscape" type="boolean" optional>
+    Whether to use landscape orientation.
+  </ParamField>
+
+  <ParamField path="options.margin" type="PagePDFMargin" optional>
+    Non-negative page margins in inches. Each omitted side defaults to `0`.
+
+    <ParamField path="options.margin.bottom" type="number" optional />
+    <ParamField path="options.margin.left" type="number" optional />
+    <ParamField path="options.margin.right" type="number" optional />
+    <ParamField path="options.margin.top" type="number" optional />
+  </ParamField>
+
+  <ParamField path="options.pageRanges" type="string" optional>
+    Page ranges to print, such as `"1-3, 5"`.
+  </ParamField>
+
+  <ParamField path="options.height" type="number" optional>
+    The positive paper height in inches.
+  </ParamField>
+
+  <ParamField path="options.width" type="number" optional>
+    The positive paper width in inches.
+  </ParamField>
+
+  <ParamField path="options.path" type="string" optional>
+    A local file path where the PDF is also written. Node.js only.
+  </ParamField>
+
+  <ParamField path="options.preferCSSPageSize" type="boolean" optional>
+    Whether CSS `@page` sizing takes precedence over `width` and `height`.
+  </ParamField>
+
+  <ParamField path="options.printBackground" type="boolean" optional>
+    Whether to include CSS backgrounds.
+  </ParamField>
+
+  <ParamField path="options.scale" type="number" optional>
+    Render scale from `0.1` to `2`.
+  </ParamField>
+
+  <ParamField path="options.timeout" type="number" optional>
+    Maximum capture wait in milliseconds, including time queued behind another capture.
+    Defaults to `30000`; `0` disables the deadline. Must be between `0` and `2147473647`.
+  </ParamField>
+</ParamField>
+
+<ResponseField name="result" type="Promise<Uint8Array>">
+  The PDF bytes.
+</ResponseField>
+
 ## snapshot()
 
 Capture the page's accessibility-oriented DOM snapshot.
@@ -1252,6 +1343,93 @@ image = await page.screenshot(full_page=True)
   The operation result.
 </ResponseField>
 
+## pdf()
+
+Render the current document to PDF with Chrome's print pipeline.
+
+If a running print times out, further captures on that page fail until Chrome finishes the pending
+print. Other pages remain available.
+
+```python
+pdf = await page.pdf(
+    path="page.pdf",
+    margin={"top": 0.25, "bottom": 0.25},
+    prefer_css_page_size=True,
+    print_background=True,
+)
+```
+
+Paper dimensions and margins are measured in inches.
+
+<ParamField path="display_header_footer" type="bool | None" optional>
+  Whether to render the header and footer templates.
+</ParamField>
+
+<ParamField path="footer_template" type="str | None" optional>
+  HTML for the print footer. Chrome fills elements with `pageNumber`, `totalPages`, `date`,
+  `title`, and `url` classes.
+</ParamField>
+
+<ParamField path="outline" type="bool | None" optional>
+  Whether to generate a document outline from the page structure. Defaults to `False`.
+</ParamField>
+
+<ParamField path="tagged" type="bool | None" optional>
+  Whether to include document structure tags in the PDF. Defaults to `False`.
+</ParamField>
+
+<ParamField path="header_template" type="str | None" optional>
+  HTML for the print header, with the same supported classes as `footer_template`.
+</ParamField>
+
+<ParamField path="landscape" type="bool | None" optional />
+
+<ParamField path="margin" type="PagePDFMargin | None" o
```

**File**: `packages/extension/controllers/pageController.ts` (modified, +7/-0)
```diff
@@ -11,6 +11,7 @@ import type {
   PageKeyPressParams,
   PageOffParams,
   PageOnParams,
+  PagePDFParams,
   PageReloadParams,
   PageScrollParams,
   PageScreenshotParams,
@@ -123,6 +124,11 @@ export function createPageController(runtime: StagehandRuntime) {
     return runtime.pageScreenshot(params);
   }
 
+  async function pdf(params: PagePDFParams, { logger }: HandlerContext) {
+    logger.debug("page.pdf", {});
+    return runtime.pagePDF(params);
+  }
+
   async function snapshot(params: PageSnapshotParams, { logger }: HandlerContext) {
     logger.debug("page.snapshot", {});
     return runtime.pageSnapshot(params);
@@ -198,6 +204,7 @@ export function createPageController(runtime: StagehandRuntime) {
     waitForTimeout,
     waitForSelector,
     screenshot,
+    pdf,
     snapshot,
     webMCPTools,
     webMCPInvokeTool,
```

**File**: `packages/extension/rpcRouter.ts` (modified, +5/-0)
```diff
@@ -363,6 +363,11 @@ export class RPCRouter {
           parseParams(StagehandMethods.pageScreenshot, request.params),
           context,
         );
+      case "page.pdf":
+        return this.pageController.pdf(
+          parseParams(StagehandMethods.pagePDF, request.params),
+          context,
+        );
       case "page.snapshot":
         return this.pageController.snapshot(
           parseParams(StagehandMethods.pageSnapshot, request.params),
```

**File**: `packages/extension/runtime.ts` (modified, +8/-0)
```diff
@@ -74,6 +74,9 @@ import type {
   PageNavigationResult,
   PageOffParams,
   PageOnParams,
+  PagePDFOptions,
+  PagePDFParams,
+  PagePDFResult,
   PageRef,
   PageReloadParams,
   PageScrollParams,
@@ -165,6 +168,7 @@ export type UnderstudyRuntimePage = {
     options?: PageWaitForSelectorParams["options"],
   ): Promise<boolean>;
   screenshot(options?: UnderstudyRuntimeScreenshotOptions): Promise<Uint8Array>;
+  pdf(options?: PagePDFOptions): Promise<PagePDFResult>;
   snapshot(options?: PageSnapshotOptions): Promise<SnapshotResult>;
   listWebMCPTools(options?: Partial<WebMCPToolsOptions>): Promise<WebMCPToolDescriptor[]>;
   invokeWebMCPTool(
@@ -712,6 +716,10 @@ export class StagehandRuntime {
     };
   }
 
+  async pagePDF(params: PagePDFParams): Promise<PagePDFResult> {
+    return await this.resolvePage(params.pageId).pdf(params.options);
+  }
+
   async pageSnapshot(params: PageSnapshotParams): Promise<SnapshotResult> {
     return await this.resolvePage(params.pageId).snapshot(params.options);
   }
```

**File**: `packages/extension/tests/rpc-router.test.ts` (modified, +88/-0)
```diff
@@ -113,6 +113,94 @@ describe("Stagehand RPC router", () => {
     await tracing.shutdown();
   });
 
+  it.each(["success", "failure"] as const)(
+    "traces page.pdf %s through the shared RPC telemetry",
+    async (outcome) => {
+      const spans = new InMemorySpanExporter();
+      const tracing = configuredTracing(
+        createStagehandTracingRuntime(
+          { registerGlobals: false },
+          { spanProcessors: [new SimpleSpanProcessor(spans)] },
+        ),
+      );
+      const router = createRouter(tracing);
+      const pdfResult = { data: "JVBERi0xLjcK" };
+      const failure = new TypeError("Page.printToPDF failed");
+      const pdf = vi.spyOn(router.runtime, "pagePDF");
+      if (outcome === "success") pdf.mockResolvedValue(pdfResult);
+      else pdf.mockRejectedValue(failure);
+
+      try {
+        const result = router.handle(
+          request({
+            id: 20,
+            method: "page.pdf",
+            params: {
+              page_id: "page-1",
+              options: { print_background: true, prefer_css_page_size: true },
+            },
+            traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
+            tracestate: "vendor=value",
+          }),
+        );
+        if (outcome === "success") await expect(result).resolves.toBe(pdfResult);
+        else await expect(result).rejects.toBe(failure);
+        expect(pdf).toHaveBeenCalledExactlyOnceWith({
+          pageId: "page-1",
+          options: { printBackground: true, preferCSSPageSize: true },
+        });
+        await tracing.forceFlush();
+
+        const finishedSpans = spans.getFinishedSpans();
+        const requestSpans = finishedSpans.filter((span) => span.kind === SpanKind.SERVER);
+        expect(requestSpans).toHaveLength(1);
+        const requestSpan = requestSpans[0]!;
+        expect(requestSpan.name).toBe("page.pdf");
+        expect(requestSpan.attributes).toMatchObject({
+          "rpc.system.name": "jsonrpc",
+          "rpc.method": "page.pdf",
+          "jsonrpc.request.id": "20",
+        });
+        expect(requestSpan.spanContext().traceId).toBe("4bf92f3577b34da6a3ce929d0e0e4736");
+        expect(requestSpan.parentSpanContext?.spanId).toBe("00f067aa0ba902b7");
+        expect(requestSpan.parentSpanContext?.isRemote).toBe(true);
+        expect(requestSpan.parentSpanContext?.traceState?.get("vendor")).toBe("value");
+        const logSpan = finishedSpans.find(
+          (span) => span.attributes["stagehand.log.message"] === "page.pdf",
+        );
+        expect(logSpan?.spanContext().traceId).toBe(requestSpan.spanContext().traceId);
+        expect(logSpan?.parentSpanContext?.spanId).toBe(requestSpan.spanContext().spanId);
+
+        if (outcome === "failure") {
+          expect(requestSpan.status).toStrictEqual({
+            code: SpanStatusCode.ERROR,
+            message: failure.message,
+          });
+          expect(requestSpan.attributes).toMatchObject({
+            "rpc.response.status_code": "-32603",
+            "error.type": failure.name,
+          });
+          expect(requestSpan.events).toContainEqual(
+            expect.objectContaining({
+              name: "exception",
+              attributes: expect.objectContaining({
+                "exception.type": failure.name,
+                "exception.message": failure.message,
+                "exception.stacktrace": failure.stack,
+              }) as object,
+            }),
+          );
+        } else {
+          expect(requestSpan.status.code).toBe(SpanStatusCode.UNSET);
+          expect(requestSpan.attributes["error.type"]).toBeUndefined();
+          expect(requestSpan.events).toStrictEqual([]);
+        }
+      } finally {
+        await tracing.shutdown();
+      }
+    },
+  );
+
   it("ends the Stagehand close span before flushing reusable tracing", async () => {
     const lifecycle: string[] = [];
     const processor: SpanProcessor = {
```

**File**: `packages/extension/tests/stagehand-clients.test.ts` (modified, +71/-2)
```diff
@@ -24,7 +24,7 @@ import type {
   UnderstudyRuntimeScreenshotOptions,
 } from "../runtime.ts";
 import { createStagehandRuntime, type StagehandRuntimeAdapters } from "../runtime.ts";
-import { DuplicatePageEventSubscriptionError } from "../errors.ts";
+import { DuplicatePageEventSubscriptionError, TimeoutError } from "../errors.ts";
 import type { StagehandTracing } from "../tracing.ts";
 import type {
   ContextSetExtraHTTPHeadersParams,
@@ -50,6 +50,8 @@ import type {
   PageEvaluateParams,
   PageKeyPressParams,
   PageNavigationOptions,
+  PagePDFOptions,
+  PagePDFResult,
   PageReloadParams,
   PageSnapshotOptions,
   PageSetExtraHTTPHeadersParams,
@@ -238,6 +240,7 @@ class FakeUnderstudyRuntimePage implements UnderstudyRuntimePage {
     options?: PageWaitForSelectorParams["options"];
   }> = [];
   readonly screenshotCalls: Array<UnderstudyRuntimeScreenshotOptions | undefined> = [];
+  readonly pdfCalls: Array<PagePDFOptions | undefined> = [];
   readonly snapshotCalls: Array<PageSnapshotOptions | undefined> = [];
   readonly listWebMCPToolsCalls: Array<Partial<WebMCPToolsOptions> | undefined> = [];
   readonly invokeWebMCPToolCalls: Array<{
@@ -388,6 +391,11 @@ class FakeUnderstudyRuntimePage implements UnderstudyRuntimePage {
     return this.screenshotBytes;
   }
 
+  async pdf(options?: PagePDFOptions): Promise<PagePDFResult> {
+    this.pdfCalls.push(options);
+    return { data: "JVBERi0xLjc=" };
+  }
+
   async snapshot(options?: PageSnapshotOptions): Promise<SnapshotResult> {
     this.snapshotCalls.push(options);
     return this.snapshotResult;
@@ -2085,12 +2093,36 @@ describe("Stagehand worker clients", () => {
       handle({
         jsonrpc: "2.0",
         id: 31,
+        method: "page.pdf",
+        params: {
+          page_id: "page-a",
+          options: {
+            landscape: true,
+            print_background: true,
+            width: 8.5,
+            height: 11,
+            margin: { top: 0.25, bottom: 0 },
+            tagged: true,
+            outline: false,
+          },
+        },
+      }),
+    ).resolves.toStrictEqual({
+      jsonrpc: "2.0",
+      id: 31,
+      result: { data: "JVBERi0xLjc=" },
+    });
+
+    await expect(
+      handle({
+        jsonrpc: "2.0",
+        id: 32,
         method: "page.snapshot",
         params: { page_id: "page-a", options: { include_iframes: true } },
       }),
     ).resolves.toStrictEqual({
       jsonrpc: "2.0",
-      id: 31,
+      id: 32,
       result: {
         formatted_tree: "root",
         xpath_map: { frameOne: "/html/body" },
@@ -2105,9 +2137,46 @@ describe("Stagehand worker clients", () => {
         maskColor: "#000000",
       },
     ]);
+    expect(page.pdfCalls).toStrictEqual([
+      {
+        landscape: true,
+        printBackground: true,
+        width: 8.5,
+        height: 11,
+        margin: { top: 0.25, bottom: 0 },
+        tagged: true,
+        outline: false,
+      },
+    ]);
     expect(page.snapshotCalls).toStrictEqual([{ includeIframes: true }]);
   });
 
+  it("preserves the recovery message and original PDF deadline over RPC", async () => {
+    const page = new FakeUnderstudyRuntimePage("page-a", "https://example.test/current");
+    const cause = new TimeoutError("pdf", 30_000);
+    vi.spyOn(page, "pdf").mockRejectedValue(
+      new Error(`A previous capture is still recovering: ${cause.message}`, { cause }),
+    );
+    const handle = await createConfiguredHandler(new FakeBrowserSession([page]));
+
+    await expect(
+      handle({
+        jsonrpc: "2.0",
+        id: 33,
+        method: "page.pdf",
+        params: { page_id: "page-a" },
+      }),
+    ).resolves.toStrictEqual({
+      jsonrpc: "2.0",
+      id: 33,
+      error: {
+        code: -32603,
+        message: "A previous capture is still recovering: pdf timed out after 30000ms",
+        data: { name: "Error" },
+      },
+    });
+  });
+
   it("routes WebMCP discovery and invocation operations through the owning page", async () => {
     const page = new FakeUnderstudyRuntimePage("page-a", "https://example.test/current");
     const handle = await createConfiguredHandler(new FakeBrowserSession([page]));
```

**File**: `packages/extension/understudy/page.ts` (modified, +24/-5)
```diff
@@ -27,6 +27,8 @@ import type {
   PageToolsRemovedNotification,
   WebMCPToolIdentity,
   PageSnapshotOptions,
+  PagePDFOptions,
+  PagePDFResult,
   SnapshotResult,
   WebMCPAnnotation,
   WebMCPInvocationDescriptor,
@@ -1588,16 +1590,33 @@ export class Page {
   }
 
   /** Keep the PDF base64-encoded for transport; SDKs decode it to bytes. */
-  async pdf(
-    options?: Omit<Protocol.Page.PrintToPDFRequest, "transferMode"> & { timeout?: number },
-  ): Promise<Pick<Protocol.Page.PrintToPDFResponse, "data">> {
-    const { timeout = 30_000, ...printOptions } = options ?? {};
+  async pdf(options?: PagePDFOptions): Promise<PagePDFResult> {
+    const {
+      timeout = 30_000,
+      width,
+      height,
+      margin,
+      tagged = false,
+      outline = false,
+      ...printOptions
+    } = options ?? {};
     return await withScreenshotLock(
       this,
       async () => {
         const { data } = await this.mainSession.send<Protocol.Page.PrintToPDFResponse>(
           "Page.printToPDF",
-          { ...printOptions, transferMode: "ReturnAsBase64" },
+          {
+            ...printOptions,
+            paperWidth: width,
+            paperHeight: height,
+            marginTop: margin?.top ?? 0,
+            marginBottom: margin?.bottom ?? 0,
+            marginLeft: margin?.left ?? 0,
+            marginRight: margin?.right ?? 0,
+            generateTaggedPDF: tagged,
+            generateDocumentOutline: outline,
+            transferMode: "ReturnAsBase64",
+          },
         );
         return { data };
       },
```

---

### Incident Patch 15: `70f4e91f` (2026-09-26)
**Commit Message**: fix(extension): read text() from direct child text nodes (#2728) (#3052)

thanks @mikhail-koviazin for the contribution here!

## why

The composed-tree XPath parser evaluates `text()` and `.` through the
same helper, `element.textContent`. In XPath these are not the same
thing: `.` is the string-value of the element, so it covers the whole
subtree, while `text()` is the node-set of the element's **direct child
text nodes**.

This parser is not a rare path. It takes over whenever the document
contains a shadow root anywhere, so a single unrelated web component on
the page changes what a locator matches, silently and with no error.

Measured against `document.evaluate()` on a build of `main`
(`a73da68b`), fixture served over http. The only difference between a
run that matches native and a run that does not is one unrelated
`attachShadow()` call elsewhere in the same document:

| XPath | `document.evaluate()` | Stagehand |
| --- | --- | --- |
| `//button[text()='Save']` | 1 | 2 |
| `//div[text()='a']` | 1 | 0 |
| `//div[contains(text(),'b')]` | 0 | 1 |
| `//div[@id='split'][text()='y']` | 1 | 0 |
| `//div[@id='split'][contains(text(),'y')]` | 0 | 1 | |
`//div[@id='split'][normalize-

**File**: `.changeset/xpath-text-node-predicates.md` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+---
+"@browserbasehq/stagehand-extension": patch
+"@browserbasehq/stagehand-go": patch
+"@browserbasehq/stagehand": patch
+"@browserbasehq/stagehand-python": patch
+---
+
+Match native XPath semantics for `text()` predicates when a shadow root routes locators through the composed-tree parser
```

**File**: `packages/extension/dom/locatorScripts/xpathParser.ts` (modified, +56/-13)
```diff
@@ -1,3 +1,12 @@
+/**
+ * Which string a text predicate reads.
+ *
+ * `self` is `.` — the string-value of the element, i.e. its whole subtree text.
+ * `text` is `text()` — the node-set of direct child text nodes, which is not the
+ * same string and does not compare the same way (see `evaluatePredicate`).
+ */
+export type XPathTextSource = "self" | "text";
+
 export type XPathPredicate =
   | { type: "index"; index: number }
   | { type: "attrEquals"; name: string; value: string; normalize?: boolean }
@@ -14,8 +23,8 @@ export type XPathPredicate =
       value: string;
       normalize?: boolean;
     }
-  | { type: "textEquals"; value: string; normalize?: boolean }
-  | { type: "textContains"; value: string; normalize?: boolean }
+  | { type: "textEquals"; value: string; normalize?: boolean; source?: XPathTextSource }
+  | { type: "textContains"; value: string; normalize?: boolean; source?: XPathTextSource }
   | { type: "and"; predicates: XPathPredicate[] }
   | { type: "or"; predicates: XPathPredicate[] }
   | { type: "not"; predicate: XPathPredicate };
@@ -39,7 +48,8 @@ export interface XPathStep {
  *  - Attribute equality predicates (`[@attr='value']`, `[@attr="value"]`)
  *  - Attribute existence (`[@attr]`)
  *  - Attribute contains/starts-with (`contains(@attr,'v')`, `starts-with(@attr,'v')`)
- *  - Text equality/contains (`[text()='v']`, `[contains(text(),'v')]`, `[.='v']`)
+ *  - Text equality/contains (`[text()='v']`, `[contains(text(),'v')]`, `[.='v']`),
+ *    where `text()` reads direct child text nodes and `.` the whole subtree
  *  - normalize-space on text/attributes (`[normalize-space(text())='v']`)
  *  - Basic boolean predicates (`and`, `or`, `not(...)`)
  *  - Multiple predicates per step (`[@class='foo'][2]`)
@@ -211,13 +221,14 @@ function parseAtomicPredicate(input: string): XPathPredicate | null {
   }
 
   const normalizeTextMatch = input.match(
-    new RegExp(`^normalize-space\\(\\s*(?:text\\(\\)|\\.)\\s*\\)\\s*=\\s*${quoted}$`),
+    new RegExp(`^normalize-space\\(\\s*(text\\(\\)|\\.)\\s*\\)\\s*=\\s*${quoted}$`),
   );
   if (normalizeTextMatch) {
     return {
       type: "textEquals",
-      value: normalizeTextMatch[1] ?? normalizeTextMatch[2] ?? "",
+      value: normalizeTextMatch[2] ?? normalizeTextMatch[3] ?? "",
       normalize: true,
+      source: textSource(normalizeTextMatch[1]),
     };
   }
 
@@ -257,21 +268,23 @@ function parseAtomicPredicate(input: string): XPathPredicate | null {
     };
   }
 
-  const textEqualsMatch = input.match(new RegExp(`^(?:text\\(\\)|\\.)\\s*=\\s*${quoted}$`));
+  const textEqualsMatch = input.match(new RegExp(`^(text\\(\\)|\\.)\\s*=\\s*${quoted}$`));
   if (textEqualsMatch) {
     return {
       type: "textEquals",
-      value: textEqualsMatch[1] ?? textEqualsMatch[2] ?? "",
+      value: textEqualsMatch[2] ?? textEqualsMatch[3] ?? "",
+      source: textSource(textEqualsMatch[1]),
     };
   }
 
   const textContainsMatch = input.match(
-    new RegExp(`^contains\\(\\s*(?:text\\(\\)|\\.)\\s*,\\s*${quoted}\\s*\\)$`),
+    new RegExp(`^contains\\(\\s*(text\\(\\)|\\.)\\s*,\\s*${quoted}\\s*\\)$`),
   );
   if (textContainsMatch) {
     return {
       type: "textContains",
-      value: textContainsMatch[1] ?? textContainsMatch[2] ?? "",
+      value: textContainsMatch[2] ?? textContainsMatch[3] ?? "",
+      source: textSource(textContainsMatch[1]),
     };
   }
 
@@ -370,10 +383,30 @@ function hasBalancedParens(input: string): boolean {
 
 const normalizeSpace = (value: string): string => value.replace(/\s+/g, " ").trim();
 
+const TEXT_NODE = 3;
+
+function textSource(token: string | undefined): XPathTextSource {
+  return token === "text()" ? "text" : "self";
+}
+
 function textValue(element: Element): string {
   return String(element.textContent ?? "");
 }
 
+/** The node-set `text()` selects: direct child text nodes, in document order. */
+function childTextValues(element: Element): string[] {
+  const values: string[] = [];
+  for (const node of Array.from(element.childNodes)) {
+    if (node.nodeType === TEXT_NODE) values.push(String(node.nodeValue ?? ""));
+  }
+  return values;
+}
+
+/** `string(node-set)` is the string-value of its first node, or `""` when empty. */
+function firstChildTextValue(element: Element): string {
+  return childTextValues(element)[0] ?? "";
+}
+
 function normalizeMaybe(value: string, normalize?: boolean): string {
   return normalize ? normalizeSpace(value) : value;
 }
@@ -411,12 +444,22 @@ export function evaluatePredicate(element: Element, predicate: XPathPredicate):
       );
     }
     case "textEquals": {
-      const value = normalizeMaybe(textValue(element), predicate.normalize);
-      return value === normalizeMaybe(predicate.value, predicate.normalize);
+      const target = normalizeMaybe(predicate.value, predicate.normalize);
+      if (predicate.source === "text") {
+        // Comparing a node-set to a string is existential: true when any node matches.
+        // normalize-spa
```

**File**: `packages/extension/tests/xpath-text-predicates.test.ts` (added, +47/-0)
```diff
@@ -0,0 +1,47 @@
+import { describe, expect, it } from "vitest";
+import { parseXPathSteps } from "../dom/locatorScripts/xpathParser.js";
+
+function predicatesOf(xpath: string) {
+  return parseXPathSteps(xpath)[0]?.predicates;
+}
+
+describe("parseXPathSteps text predicates", () => {
+  it("keeps text() and . apart", () => {
+    expect(predicatesOf("//button[text()='Save']")).toEqual([
+      { type: "textEquals", value: "Save", source: "text" },
+    ]);
+    expect(predicatesOf("//button[.='Save']")).toEqual([
+      { type: "textEquals", value: "Save", source: "self" },
+    ]);
+  });
+
+  it("keeps them apart inside contains() and normalize-space()", () => {
+    expect(predicatesOf("//button[contains(text(),'Sa')]")).toEqual([
+      { type: "textContains", value: "Sa", source: "text" },
+    ]);
+    expect(predicatesOf("//button[contains(.,'Sa')]")).toEqual([
+      { type: "textContains", value: "Sa", source: "self" },
+    ]);
+    expect(predicatesOf("//button[normalize-space(text())='Save']")).toEqual([
+      { type: "textEquals", value: "Save", normalize: true, source: "text" },
+    ]);
+    expect(predicatesOf("//button[normalize-space(.)='Save']")).toEqual([
+      { type: "textEquals", value: "Save", normalize: true, source: "self" },
+    ]);
+  });
+
+  it("carries the source through boolean predicates", () => {
+    expect(predicatesOf("//button[text()='Save' or .='Save']")).toEqual([
+      {
+        type: "or",
+        predicates: [
+          { type: "textEquals", value: "Save", source: "text" },
+          { type: "textEquals", value: "Save", source: "self" },
+        ],
+      },
+    ]);
+    expect(predicatesOf("//button[not(text()='Save')]")).toEqual([
+      { type: "not", predicate: { type: "textEquals", value: "Save", source: "text" } },
+    ]);
+  });
+});
```

**File**: `packages/sdk-ts/tests/integration/locatorXPathTextPredicates.test.ts` (added, +73/-0)
```diff
@@ -0,0 +1,73 @@
+import { afterAll, beforeAll, describe, expect, it } from "vitest";
+import type { Stagehand } from "../../src/index.js";
+import {
+  closeStagehand,
+  createStagehand,
+  firstPage,
+  startFixtureServer,
+  type FixtureServer,
+} from "./_support.js";
+
+// A shadow root anywhere in the document routes XPath through the composed-tree parser
+// instead of document.evaluate(), and that parser is only reachable over http: data: URLs
+// keep the native engine, so these cases have to be served to exercise it at all.
+const FIXTURE = `<!doctype html>
+<html>
+  <body>
+    <button id="wrapped"><span>Save</span></button>
+    <button id="direct">Save</button>
+    <div id="mixed">a<span>b</span></div>
+    <div id="split">x<br />y</div>
+    <div id="widget"></div>
+    <script>
+      document.getElementById("widget").attachShadow({ mode: "open" }).innerHTML =
+        "<span>unrelated widget</span>";
+    </script>
+  </body>
+</html>`;
+
+describe("XPath text() predicates with a shadow root in the document", () => {
+  let fixtureServer: FixtureServer;
+  let stagehand: Stagehand;
+
+  beforeAll(async () => {
+    fixtureServer = await startFixtureServer(FIXTURE);
+    stagehand = await createStagehand();
+  });
+
+  afterAll(async () => {
+    await closeStagehand(stagehand);
+    await fixtureServer.close();
+  });
+
+  it("reads text() from direct child text nodes only", async () => {
+    const page = await firstPage(stagehand);
+    await page.goto(fixtureServer.url, { waitUntil: "load" });
+
+    // #wrapped holds its label in a <span>, so it has no direct text child to match.
+    await expect.poll(() => page.locator("xpath=//button[text()='Save']").count()).toBe(1);
+    await expect(page.locator("xpath=//button[text()='Save']").innerHtml()).resolves.toBe("Save");
+
+    // `.` is the string-value of the element, so it still sees the whole subtree.
+    await expect(page.locator("xpath=//button[.='Save']").count()).resolves.toBe(2);
+
+    await expect(page.locator("xpath=//div[text()='a']").count()).resolves.toBe(1);
+    await expect(page.locator("xpath=//div[contains(text(),'b')]").count()).resolves.toBe(0);
+  });
+
+  it("compares a node-set existentially and collapses it inside functions", async () => {
+    const page = await firstPage(stagehand);
+    await page.goto(fixtureServer.url, { waitUntil: "load" });
+
+    // #split has two text nodes, `x` and `y`: `=` holds when either one matches.
+    await expect.poll(() => page.locator("xpath=//div[@id='split'][text()='y']").count()).toBe(1);
+
+    // contains() and normalize-space() take a string, so the node-set collapses to `x`.
+    await expect(
+      page.locator("xpath=//div[@id='split'][contains(text(),'y')]").count(),
+    ).resolves.toBe(0);
+    await expect(
+      page.locator("xpath=//div[@id='split'][normalize-space(text())='x']").count(),
+    ).resolves.toBe(1);
+  });
+});
```

**File**: `scripts/test-integration.ts` (modified, +1/-0)
```diff
@@ -43,6 +43,7 @@ export const integrationTestGroups = {
     "locatorContentMethods",
     "locatorCount",
     "locatorNth",
+    "locatorXPathTextPredicates",
     "textSelectorInnermost",
   ],
   "local/locators-write": ["locatorFill", "locatorInputMethods", "locatorSelectOption"],
```

#### Recent Merged Pull Requests:
- **PR #3109** (2026-10-05): [refactor]: use `progress` tracker in `act`/`extract`/`observe` (@seanmcguire12)
- **PR #3105** (closed): evals: add a static observation fixture recorder (@alanagoyal)
- **PR #3101** (closed): chore(evals): evaluator calibration scripts and notes (@miguelg719)
- **PR #3095** (2026-10-02): docs: add Amel Bajramovic to README acknowledgements (@supremeboxlogos)
- **PR #3092** (closed): Fix Go SDK callbacks after unsubscribe and shutdown (@agocharbhatia)
- **PR #3084** (2026-10-05): chore(python): add keywords and classifiers for Pypi discoverability (@charlypoly)
- **PR #3083** (2026-10-01): [feat]: expose `timeout` param in `page.snapshot()` (@seanmcguire12)
- **PR #3082** (2026-10-01): ci: restore Browse alphas for CLI changes (@shrey150)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
