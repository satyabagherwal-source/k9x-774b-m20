# Forensic Learning Record (Deep Inspection): BrowserMCP/mcp

> **Canonical Artifact**: `07_PROJECT_LEARNING/browsermcp-mcp-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/BrowserMCP/mcp](https://github.com/BrowserMCP/mcp))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:24:23.414Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `BrowserMCP/mcp`
- **Description**: Browser MCP is a Model Context Provider (MCP) server that allows AI applications to control your browser
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 7159 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/utils/aria-snapshot.ts`
```
import { Context } from "@/context";
import { ToolResult } from "@/tools/tool";

export async function captureAriaSnapshot(
  context: Context,
  status: string = "",
): Promise<ToolResult> {
  const url = await context.sendSocketMessage("getUrl", undefined);
  const title = await context.sendSocketMessage("getTitle", undefined);
  const snapshot = await context.sendSocketMessage("browser_snapshot", {});
  return {
    content: [
      {
        type: "text",
        text: `${status ? `${status}\n` : ""}
- Page URL: ${url}
- Page Title: ${title}
- Page Snapshot
\`\`\`yaml
${snapshot}
\`\`\`
`,
      },
    ],
  };
}

```

### Core Architecture Module: `src/utils/log.ts`
```
/**
 * Logs a message to the console
 *
 * `console.error` is used since standard input/output is used as transport for MCP
 */
export const debugLog: typeof console.error = (...args) => {
  console.error(...args);
};

```

### Core Architecture Module: `src/utils/port.ts`
```
import { execSync } from "node:child_process";
import net from "node:net";

export async function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(true)); // Port is still in use
    server.once("listening", () => {
      server.close(() => resolve(false)); // Port is free
    });
    server.listen(port);
  });
}

export function killProcessOnPort(port: number) {
  try {
    if (process.platform === "win32") {
      execSync(
        `FOR /F "tokens=5" %a in ('netstat -ano ^| findstr :${port}') do taskkill /F /PID %a`,
      );
    } else {
      execSync(`lsof -ti:${port} | xargs kill -9`);
    }
  } catch (error) {
    console.error(`Failed to kill process on port ${port}:`, error);
  }
}

```

### Core Architecture Module: `src/context.ts`
```
import { createSocketMessageSender } from "@r2r/messaging/ws/sender";
import { WebSocket } from "ws";

import { mcpConfig } from "@repo/config/mcp.config";
import { MessagePayload, MessageType } from "@repo/messaging/types";
import { SocketMessageMap } from "@repo/types/messages/ws";

const noConnectionMessage = `No connection to browser extension. In order to proceed, you must first connect a tab by clicking the Browser MCP extension icon in the browser toolbar and clicking the 'Connect' button.`;

export class Context {
  private _ws: WebSocket | undefined;

  get ws(): WebSocket {
    if (!this._ws) {
      throw new Error(noConnectionMessage);
    }
    return this._ws;
  }

  set ws(ws: WebSocket) {
    this._ws = ws;
  }

  hasWs(): boolean {
    return !!this._ws;
  }

  async sendSocketMessage<T extends MessageType<SocketMessageMap>>(
    type: T,
    payload: MessagePayload<SocketMessageMap, T>,
    options: { timeoutMs?: number } = { timeoutMs: 30000 },
  ) {
    const { sendSocketMessage } = createSocketMessageSender<SocketMessageMap>(
      this.ws,
    );
    try {
      return await sendSocketMessage(type, payload, options);
    } catch (e) {
      if (e instanceof Error && e.message === mcpConfig.errors.noConnectedTab) {
        throw new Error(noConnectionMessage);
      }
      throw e;
    }
  }

  async close() {
    if (!this._ws) {
      return;
    }
    await this._ws.close();
  }
}

```

### Core Architecture Module: `src/index.ts`
```
#!/usr/bin/env node
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { program } from "commander";

import { appConfig } from "@repo/config/app.config";

import type { Resource } from "@/resources/resource";
import { createServerWithTools } from "@/server";
import * as common from "@/tools/common";
import * as custom from "@/tools/custom";
import * as snapshot from "@/tools/snapshot";
import type { Tool } from "@/tools/tool";

import packageJSON from "../package.json";

function setupExitWatchdog(server: Server) {
  process.stdin.on("close", async () => {
    setTimeout(() => process.exit(0), 15000);
    await server.close();
    process.exit(0);
  });
}

const commonTools: Tool[] = [common.pressKey, common.wait];

const customTools: Tool[] = [custom.getConsoleLogs, custom.screenshot];

const snapshotTools: Tool[] = [
  common.navigate(true),
  common.goBack(true),
  common.goForward(true),
  snapshot.snapshot,
  snapshot.click,
  snapshot.hover,
  snapshot.type,
  snapshot.selectOption,
  ...commonTools,
  ...customTools,
];

const resources: Resource[] = [];

async function createServer(): Promise<Server> {
  return createServerWithTools({
    name: appConfig.name,
    version: packageJSON.version,
    tools: snapshotTools,
    resources,
  });
}

/**
 * Note: Tools must be defined *before* calling `createServer` because only declarations are hoisted, not the initializations
 */
program
  .version("Version " + packageJSON.version)
  .name(packageJSON.name)
  .action(async () => {
    const server = await createServer();
    setupExitWatchdog(server);

    const transport = new StdioServerTransport();
    await server.connect(transport);
  });
program.parse(process.argv);

```

### Core Architecture Module: `src/resources/resource.ts`
```
import type { Context } from "../context";

export type ResourceSchema = {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
};

export type ResourceResult = {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string;
};

export type Resource = {
  schema: ResourceSchema;
  read: (context: Context, uri: string) => Promise<ResourceResult[]>;
};

```

### Core Architecture Module: `src/server.ts`
```
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { Context } from "@/context";
import type { Resource } from "@/resources/resource";
import type { Tool } from "@/tools/tool";
import { createWebSocketServer } from "@/ws";

type Options = {
  name: string;
  version: string;
  tools: Tool[];
  resources: Resource[];
};

export async function createServerWithTools(options: Options): Promise<Server> {
  const { name, version, tools, resources } = options;
  const context = new Context();
  const server = new Server(
    { name, version },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    },
  );

  const wss = await createWebSocketServer();
  wss.on("connection", (websocket) => {
    // Close any existing connections
    if (context.hasWs()) {
      context.ws.close();
    }
    context.ws = websocket;
  });

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: tools.map((tool) => tool.schema) };
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return { resources: resources.map((resource) => resource.schema) };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = tools.find((tool) => tool.schema.name === request.params.name);
    if (!tool) {
      return {
        content: [
          { type: "text", text: `Tool "${request.params.name}" not found` },
        ],
        isError: true,
      };
    }

    try {
      const result = await tool.handle(context, request.params.arguments);
      return result;
    } catch (error) {
      return {
        content: [{ type: "text", text: String(error) }],
        isError: true,
      };
    }
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const resource = resources.find(
      (resource) => resource.schema.uri === request.params.uri,
    );
    if (!resource) {
      return { contents: [] };
    }

    const contents = await resource.read(context, request.params.uri);
    return { contents };
  });

  server.close = async () => {
    await server.close();
    await wss.close();
    await context.close();
  };

  return server;
}

```

### Core Architecture Module: `src/tools/common.ts`
```
import { zodToJsonSchema } from "zod-to-json-schema";

import {
  GoBackTool,
  GoForwardTool,
  NavigateTool,
  PressKeyTool,
  WaitTool,
} from "@repo/types/mcp/tool";

import { captureAriaSnapshot } from "@/utils/aria-snapshot";

import type { Tool, ToolFactory } from "./tool";

export const navigate: ToolFactory = (snapshot) => ({
  schema: {
    name: NavigateTool.shape.name.value,
    description: NavigateTool.shape.description.value,
    inputSchema: zodToJsonSchema(NavigateTool.shape.arguments),
  },
  handle: async (context, params) => {
    const { url } = NavigateTool.shape.arguments.parse(params);
    await context.sendSocketMessage("browser_navigate", { url });
    if (snapshot) {
      return captureAriaSnapshot(context);
    }
    return {
      content: [
        {
          type: "text",
          text: `Navigated to ${url}`,
        },
      ],
    };
  },
});

export const goBack: ToolFactory = (snapshot) => ({
  schema: {
    name: GoBackTool.shape.name.value,
    description: GoBackTool.shape.description.value,
    inputSchema: zodToJsonSchema(GoBackTool.shape.arguments),
  },
  handle: async (context) => {
    await context.sendSocketMessage("browser_go_back", {});
    if (snapshot) {
      return captureAriaSnapshot(context);
    }
    return {
      content: [
        {
          type: "text",
          text: "Navigated back",
        },
      ],
    };
  },
});

export const goForward: ToolFactory = (snapshot) => ({
  schema: {
    name: GoForwardTool.shape.name.value,
    description: GoForwardTool.shape.description.value,
    inputSchema: zodToJsonSchema(GoForwardTool.shape.arguments),
  },
  handle: async (context) => {
    await context.sendSocketMessage("browser_go_forward", {});
    if (snapshot) {
      return captureAriaSnapshot(context);
    }
    return {
      content: [
        {
          type: "text",
          text: "Navigated forward",
        },
      ],
    };
  },
});

export const wait: Tool = {
  schema: {
    name: WaitTool.shape.name.value,
    description: WaitTool.shape.description.value,
    inputSchema: zodToJsonSchema(WaitTool.shape.arguments),
  },
  handle: async (context, params) => {
    const { time } = WaitTool.shape.arguments.parse(params);
    await context.sendSocketMessage("browser_wait", { time });
    return {
      content: [
        {
          type: "text",
          text: `Waited for ${time} seconds`,
        },
      ],
    };
  },
};

export const pressKey: Tool = {
  schema: {
    name: PressKeyTool.shape.name.value,
    description: PressKeyTool.shape.description.value,
    inputSchema: zodToJsonSchema(PressKeyTool.shape.arguments),
  },
  handle: async (context, params) => {
    const { key } = PressKeyTool.shape.arguments.parse(params);
    await context.sendSocketMessage("browser_press_key", { key });
    return {
      content: [
        {
          type: "text",
          text: `Pressed key ${key}`,
        },
      ],
    };
  },
};

```

### Core Architecture Module: `src/tools/custom.ts`
```
import { zodToJsonSchema } from "zod-to-json-schema";

import { GetConsoleLogsTool, ScreenshotTool } from "@repo/types/mcp/tool";

import { Tool } from "./tool";

export const getConsoleLogs: Tool = {
  schema: {
    name: GetConsoleLogsTool.shape.name.value,
    description: GetConsoleLogsTool.shape.description.value,
    inputSchema: zodToJsonSchema(GetConsoleLogsTool.shape.arguments),
  },
  handle: async (context, _params) => {
    const consoleLogs = await context.sendSocketMessage(
      "browser_get_console_logs",
      {},
    );
    const text: string = consoleLogs
      .map((log) => JSON.stringify(log))
      .join("\n");
    return {
      content: [{ type: "text", text }],
    };
  },
};

export const screenshot: Tool = {
  schema: {
    name: ScreenshotTool.shape.name.value,
    description: ScreenshotTool.shape.description.value,
    inputSchema: zodToJsonSchema(ScreenshotTool.shape.arguments),
  },
  handle: async (context, _params) => {
    const screenshot = await context.sendSocketMessage(
      "browser_screenshot",
      {},
    );
    return {
      content: [
        {
          type: "image",
          data: screenshot,
          mimeType: "image/png",
        },
      ],
    };
  },
};

```

### Core Architecture Module: `src/tools/snapshot.ts`
```
import zodToJsonSchema from "zod-to-json-schema";

import {
  ClickTool,
  DragTool,
  HoverTool,
  SelectOptionTool,
  SnapshotTool,
  TypeTool,
} from "@repo/types/mcp/tool";

import type { Context } from "@/context";
import { captureAriaSnapshot } from "@/utils/aria-snapshot";

import type { Tool } from "./tool";

export const snapshot: Tool = {
  schema: {
    name: SnapshotTool.shape.name.value,
    description: SnapshotTool.shape.description.value,
    inputSchema: zodToJsonSchema(SnapshotTool.shape.arguments),
  },
  handle: async (context: Context) => {
    return await captureAriaSnapshot(context);
  },
};

export const click: Tool = {
  schema: {
    name: ClickTool.shape.name.value,
    description: ClickTool.shape.description.value,
    inputSchema: zodToJsonSchema(ClickTool.shape.arguments),
  },
  handle: async (context: Context, params) => {
    const validatedParams = ClickTool.shape.arguments.parse(params);
    await context.sendSocketMessage("browser_click", validatedParams);
    const snapshot = await captureAriaSnapshot(context);
    return {
      content: [
        {
          type: "text",
          text: `Clicked "${validatedParams.element}"`,
        },
        ...snapshot.content,
      ],
    };
  },
};

export const drag: Tool = {
  schema: {
    name: DragTool.shape.name.value,
    description: DragTool.shape.description.value,
    inputSchema: zodToJsonSchema(DragTool.shape.arguments),
  },
  handle: async (context: Context, params) => {
    const validatedParams = DragTool.shape.arguments.parse(params);
    await context.sendSocketMessage("browser_drag", validatedParams);
    const snapshot = await captureAriaSnapshot(context);
    return {
      content: [
        {
          type: "text",
          text: `Dragged "${validatedParams.startElement}" to "${validatedParams.endElement}"`,
        },
        ...snapshot.content,
      ],
    };
  },
};

export const hover: Tool = {
  schema: {
    name: HoverTool.shape.name.value,
    description: HoverTool.shape.description.value,
    inputSchema: zodToJsonSchema(HoverTool.shape.arguments),
  },
  handle: async (context: Context, params) => {
    const validatedParams = HoverTool.shape.arguments.parse(params);
    await context.sendSocketMessage("browser_hover", validatedParams);
    const snapshot = await captureAriaSnapshot(context);
    return {
      content: [
        {
          type: "text",
          text: `Hovered over "${validatedParams.element}"`,
        },
        ...snapshot.content,
      ],
    };
  },
};

export const type: Tool = {
  schema: {
    name: TypeTool.shape.name.value,
    description: TypeTool.shape.description.value,
    inputSchema: zodToJsonSchema(TypeTool.shape.arguments),
  },
  handle: async (context: Context, params) => {
    const validatedParams = TypeTool.shape.arguments.parse(params);
    await context.sendSocketMessage("browser_type", validatedParams);
    const snapshot = await captureAriaSnapshot(context);
    return {
      content: [
        {
          type: "text",
          text: `Typed "${validatedParams.text}" into "${validatedParams.element}"`,
        },
        ...snapshot.content,
      ],
    };
  },
};

export const selectOption: Tool = {
  schema: {
    name: SelectOptionTool.shape.name.value,
    description: SelectOptionTool.shape.description.value,
    inputSchema: zodToJsonSchema(SelectOptionTool.shape.arguments),
  },
  handle: async (context: Context, params) => {
    const validatedParams = SelectOptionTool.shape.arguments.parse(params);
    await context.sendSocketMessage("browser_select_option", validatedParams);
    const snapshot = await captureAriaSnapshot(context);
    return {
      content: [
        {
          type: "text",
          text: `Selected option in "${validatedParams.element}"`,
        },
        ...snapshot.content,
      ],
    };
  },
};

```

### Core Architecture Module: `src/tools/tool.ts`
```
import type {
  ImageContent,
  TextContent,
} from "@modelcontextprotocol/sdk/types.js";
import type { JsonSchema7Type } from "zod-to-json-schema";

import type { Context } from "@/context";

export type ToolSchema = {
  name: string;
  description: string;
  inputSchema: JsonSchema7Type;
};

export type ToolResult = {
  content: (ImageContent | TextContent)[];
  isError?: boolean;
};

export type Tool = {
  schema: ToolSchema;
  handle: (
    context: Context,
    params?: Record<string, any>,
  ) => Promise<ToolResult>;
};

export type ToolFactory = (snapshot: boolean) => Tool;

```

### Core Architecture Module: `src/ws.ts`
```
import { WebSocketServer } from "ws";

import { mcpConfig } from "@repo/config/mcp.config";
import { wait } from "@repo/utils";

import { isPortInUse, killProcessOnPort } from "@/utils/port";

export async function createWebSocketServer(
  port: number = mcpConfig.defaultWsPort,
): Promise<WebSocketServer> {
  killProcessOnPort(port);
  // Wait until the port is free
  while (await isPortInUse(port)) {
    await wait(100);
  }
  return new WebSocketServer({ port });
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #208** (2026-10-04): **fix: avoid infinite recursion in server.close override**
  *Symptoms*: ## Problem  In `src/server.ts`, `server.close` is overridden like this:  ```ts server.close = async () => {   await server.close();   // resolves to this same override   await wss.close();   await context.close(); }; ```  At call time `server.close` is the override itself, so it recurses forever. When the MCP client closes stdin, `setupExitWatchdog` calls `server.close()`, which throws `RangeError: Maximum call stack size exceeded`. The rejection is unhandled, so Node exits with code 1, and `wss.close()` and `context.close()` never run. The same code is in the published `@browsermcp/mcp@0.1.3` `dist/index.js` (lines 248-252).  ## Fix  Keep a bound reference to the SDK's original `close` and call that from the override.  ## Verification  I ran the published 0.1.3 `dist/index.js` with its runtime deps (WS port changed to avoid clashing with a live instance), piped `sleep 2 |` into it so stdin closes after about 2s, and compared it with the same build plus this change:  | build | exit code | stderr | |---|---|---| | 0.1.3 as published | 1 | `RangeError: Maximum call stack size exceeded` at `server.close` | | with this fix | 0 | clean |  Note: this repo can't be built standalone (workspace deps), so I applied the equivalent edit to the bundled dist for the test.  Related: #207. This does not fix the click issue there; it's a separate bug I found while reading the code.  🤖 Generated with [Claude Code](https://claude.com/claude-code) 

- **Issue #204** (2026-10-02): **Add opt-out for killing an existing WebSocket server**
  *Symptoms*: ## Summary  - add a `--no-kill-existing` CLI option - propagate the option to WebSocket server startup - fail with an actionable error when port 9009 is occupied instead of terminating its owner - document the option for MCP clients that start temporary duplicate instances  The default remains unchanged, so existing clients that rely on automatic port takeover keep their current behavior.  ## Motivation  BrowserMCP currently runs `lsof -ti:<port> | xargs kill -9` unconditionally. Some MCP clients can briefly start a second server while refreshing their tool catalog. That second process kills the healthy primary BrowserMCP process, then exits, leaving the registered tools with a closed stdio transport.  This opt-in mode lets the duplicate fail without disrupting the already-running server. It also avoids terminating an unrelated process that happens to own the configured port.  Related: #113, #151.  ## Validation  - confirmed the new option appears in `--help` - started BrowserMCP on port 9009, then launched a second instance with `--no-kill-existing` - confirmed the second instance exited with the expected occupied-port error - confirmed the original PID remained alive and retained port 9009 - confirmed the Chrome extension kept an established WebSocket connection - confirmed a real `browser_snapshot` MCP call succeeded after the duplicate startup attempt - `git diff --check` passes  Tested on Arch Linux with Node.js 26.3.1 and Codex CLI 0.157.1. The repository currently cann
  **Post-Mortem & Fix Analysis**:
  > Superseded by a follow-up implementation that removes destructive port takeover and automatically relays additional MCP clients through the existing local Browser MCP process. This keeps every client's stdio tool connection usable without requiring a flag. I will link the replacement PR here once it is opened.
  > Replacement opened as #206: https://github.com/BrowserMCP/mcp/pull/206

- **Issue #177** (2026-07-04): **fix: add MCP tool annotations**
  *Symptoms*: ## Summary  Adds MCP tool annotations to BrowserMCP tool definitions so clients can distinguish read-only inspection tools from browser actions that can change page state.  ## Changes  - Extends the local tool schema with optional MCP annotations. - Marks snapshot, hover, wait, console logs, and screenshot tools as read-only. - Marks click, drag, type, select option, and press key tools as destructive. - Marks browser navigation history tools as non-destructive navigation actions.  Fixes #162.  ## Validation  - `git diff --check` - Could not run the package typecheck in this standalone checkout because `package.json` references workspace packages via `workspace:*`.

- **Issue #173** (2026-04-08): **ci: add HOL skill-publish validate workflow**
  *Symptoms*: I opened this as a small validate-only check for the skill metadata in the repo.  A couple of repo-specific details I checked first: - Browser MCP is a Model Context Provider (MCP) server that allows AI applications to control your browser - Browser MCP is an MCP server + Chrome extension that allows you to automate your browser using AI applications like VS Code, Claude, Cursor, and Windsurf - ⚡ Fast: Automation happens locally on your machine, resulting in better performance without network latency  This adds one workflow for `.` and leaves the runtime code alone. It only runs the schema and trust checks for the skill metadata in validate mode.  If you would rather place the workflow under a different filename or point it at a different skill directory, I can adjust the branch.

- **Issue #172** (2026-04-04): **Security Layer for MCP Agents - Vedis**
  *Symptoms*: # Security Layer for MCP Agents  I built **Vedis** - a security layer for MCP agents that addresses common security concerns when building AI agents.  ## What Vedis Does  Vedis sits between your MCP server and the outside world:  ✅ **Prompt injection detection** - Blocks malicious prompts before they reach your agent ✅ **PII filtering** - Emails, phone numbers, SSNs, credit cards ✅ **Secret scanning** - AWS keys, GitHub tokens, Stripe keys, JWTs, PEM certificates ✅ **Tool policy enforcement** - Control what tools your agents can access  ## Why This Matters  When building AI agents with MCP, security is critical: - Prompt injection attacks are real and can cause data leaks - Agents might output API keys, passwords, or user data - Manual filtering is impossible at scale  ## How It Works  One config change, zero code changes:  ```yaml vedis:   enabled: true   block_pii: true   block_secrets: true   max_tokens: 1000 ```  ## Get Started  https://vedis-4nexxwa4vq-as.a.run.app  ## Pricing  - **Free**: Basic protection - **$49/mo**: Starter (up to 10 agents) - **$199/mo**: Pro (unlimited agents + priority support)  Would love feedback from the MCP community on security features you need for your AI agents! 
  **Post-Mortem & Fix Analysis**:
  > Closing - posted without approval

- **Issue #169** (2026-04-03): **Add Codex plugin quality gate CI**
  *Symptoms*: Adds a CI workflow to validate Codex plugin manifests using the [HOL Codex Plugin Scanner](https://github.com/hashgraph-online/codex-plugin-scanner).  This workflow runs automatically on any PR that modifies plugin files (\.codex-plugin/, skills/, .mcp.json) and ensures: - Manifest structure is valid - Skills are properly defined - MCP configuration is correct - Quality score meets the minimum threshold (80/100)  **Scanner:** [codex-plugin-scanner](https://github.com/hashgraph-online/codex-plugin-scanner) | [awesome-codex-plugins](https://github.com/internet-dot/awesome-codex-plugins)

- **Issue #166** (2026-07-21): **Add AEO quality badge to README — show your MCP server score**
  *Symptoms*: Hi! 👋  I'm from [Clarvia](https://clarvia.art) — an AI tool discovery platform that indexes and scores 27,906+ MCP servers for **Agent Engine Optimization (AEO)** quality.  Add this badge to your README to show your MCP server's discoverability score:  ```markdown [![AEO Score](https://clarvia.art/api/badge/BrowserMCP%2Fmcp)](https://clarvia.art/tool/BrowserMCP%2Fmcp) ```  The AEO score reflects how well AI agents can discover, understand, and effectively use your MCP server. The badge auto-updates as your server improves.  Check your full profile: https://clarvia.art/tool/BrowserMCP%2Fmcp  Happy to close if this isn't relevant. Thanks! 🙏

- **Issue #164** (2026-05-24): **docs: add Fronteir AI hosted deployment option**
  *Symptoms*: Love the project!  Adds a short note in the README that a hosted deployment is available on [Fronteir AI](https://fronteir.ai/mcp/browsermcp-mcp)

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

### Incident Patch 1: `9db12f2b` (2025-04-24)
**Commit Message**: chore: version 0.1.3

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "@browsermcp/mcp",
-  "version": "0.1.0",
+  "version": "0.1.3",
   "description": "MCP server for browser automation using Browser MCP",
   "author": "Browser MCP",
   "homepage": "https://browsermcp.io",
```

**File**: `src/context.ts` (modified, +2/-2)
```diff
@@ -28,10 +28,10 @@ export class Context {
   async sendSocketMessage<T extends MessageType<SocketMessageMap>>(
     type: T,
     payload: MessagePayload<SocketMessageMap, T>,
-    options: { timeoutMs?: number } = { timeoutMs: 30000 }
+    options: { timeoutMs?: number } = { timeoutMs: 30000 },
   ) {
     const { sendSocketMessage } = createSocketMessageSender<SocketMessageMap>(
-      this.ws
+      this.ws,
     );
     try {
       return await sendSocketMessage(type, payload, options);
```

**File**: `src/index.ts` (modified, +1/-1)
```diff
@@ -24,7 +24,7 @@ function setupExitWatchdog(server: Server) {
 
 const commonTools: Tool[] = [common.pressKey, common.wait];
 
-const customTools: Tool[] = [custom.getConsoleLogs];
+const customTools: Tool[] = [custom.getConsoleLogs, custom.screenshot];
 
 const snapshotTools: Tool[] = [
   common.navigate(true),
```

**File**: `src/tools/custom.ts` (modified, +24/-1)
```diff
@@ -1,6 +1,6 @@
 import { zodToJsonSchema } from "zod-to-json-schema";
 
-import { GetConsoleLogsTool } from "@repo/types/mcp/tool";
+import { GetConsoleLogsTool, ScreenshotTool } from "@repo/types/mcp/tool";
 
 import { Tool } from "./tool";
 
@@ -23,3 +23,26 @@ export const getConsoleLogs: Tool = {
     };
   },
 };
+
+export const screenshot: Tool = {
+  schema: {
+    name: ScreenshotTool.shape.name.value,
+    description: ScreenshotTool.shape.description.value,
+    inputSchema: zodToJsonSchema(ScreenshotTool.shape.arguments),
+  },
+  handle: async (context, _params) => {
+    const screenshot = await context.sendSocketMessage(
+      "browser_screenshot",
+      {},
+    );
+    return {
+      content: [
+        {
+          type: "image",
+          data: screenshot,
+          mimeType: "image/png",
+        },
+      ],
+    };
+  },
+};
```

**File**: `src/utils/port.ts` (modified, +10/-6)
```diff
@@ -13,11 +13,15 @@ export async function isPortInUse(port: number): Promise<boolean> {
 }
 
 export function killProcessOnPort(port: number) {
-  if (process.platform === "win32") {
-    execSync(
-      `FOR /F "tokens=5" %a in ('netstat -ano ^| findstr :${port}') do taskkill /F /PID %a`,
-    );
-  } else {
-    execSync(`lsof -ti:${port} | xargs kill -9`);
+  try {
+    if (process.platform === "win32") {
+      execSync(
+        `FOR /F "tokens=5" %a in ('netstat -ano ^| findstr :${port}') do taskkill /F /PID %a`,
+      );
+    } else {
+      execSync(`lsof -ti:${port} | xargs kill -9`);
+    }
+  } catch (error) {
+    console.error(`Failed to kill process on port ${port}:`, error);
   }
 }
```

---

### Incident Patch 2: `31baf72b` (2025-04-24)
**Commit Message**: chore: update readme

**File**: `README.md` (modified, +25/-5)
```diff
@@ -1,12 +1,32 @@
-# Browser MCP
+<a href="https://browsermcp.io">
+  <img src="./.github/images/banner.png" alt="Browser MCP banner">
+</a>
 
-MCP server for Browser MCP.
+<h3 align="center">Browser MCP</h3>
 
-- Website: https://browsermcp.io
-- Docs: https://docs.browsermcp.io
+<p align="center">
+  Automate your browser with AI.
+  <br />
+  <a href="https://browsermcp.io"><strong>Website</strong></a> 
+  •
+  <a href="https://docs.browsermcp.io"><strong>Docs</strong></a>
+</p>
+
+## About
+
+Browser MCP is an MCP server + Chrome extension that allows you to automate your browser using AI applications like VS Code, Claude, Cursor, and Windsurf.
+
+## Features
+
+- ⚡ Fast: Automation happens locally on your machine, resulting in better performance without network latency.
+- 🔒 Private: Since automation happens locally, your browser activity stays on your device and isn't sent to remote servers.
+- 👤 Logged In: Uses your existing browser profile, keeping you logged into all your services.
+- 🥷🏼 Stealth: Avoids basic bot detection and CAPTCHAs by using your real browser fingerprint.
+
+## Contributing
 
 This repo contains all the core MCP code for Browser MCP, but currently cannot yet be built on its own due to dependencies on utils and types from the monorepo where it's developed.
 
-### Credits
+## Credits
 
 Browser MCP was adapted from the [Playwright MCP server](https://github.com/microsoft/playwright-mcp) in order to automate the user's browser rather than creating new browser instances. This allows using the user's existing browser profile to use logged-in sessions and avoid bot detection mechanisms that commonly block automated browser use.
```

---

### Incident Patch 3: `3e6824de` (2025-04-07)
**Commit Message**: chore: add license

**File**: `LICENSE` (added, +202/-0)
```diff
@@ -0,0 +1,202 @@
+                                 Apache License
+                           Version 2.0, January 2004
+                        http://www.apache.org/licenses/
+
+TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION
+
+1.  Definitions.
+
+    "License" shall mean the terms and conditions for use, reproduction,
+    and distribution as defined by Sections 1 through 9 of this document.
+
+    "Licensor" shall mean the copyright owner or entity authorized by
+    the copyright owner that is granting the License.
+
+    "Legal Entity" shall mean the union of the acting entity and all
+    other entities that control, are controlled by, or are under common
+    control with that entity. For the purposes of this definition,
+    "control" means (i) the power, direct or indirect, to cause the
+    direction or management of such entity, whether by contract or
+    otherwise, or (ii) ownership of fifty percent (50%) or more of the
+    outstanding shares, or (iii) beneficial ownership of such entity.
+
+    "You" (or "Your") shall mean an individual or Legal Entity
+    exercising permissions granted by this License.
+
+    "Source" form shall mean the preferred form for making modifications,
+    including but not limited to software source code, documentation
+    source, and configuration files.
+
+    "Object" form shall mean any form resulting from mechanical
+    transformation or translation of a Source form, including but
+    not limited to compiled object code, generated documentation,
+    and conversions to other media types.
+
+    "Work" shall mean the work of authorship, whether in Source or
+    Object form, made available under the License, as indicated by a
+    copyright notice that is included in or attached to the work
+    (an example is provided in the Appendix below).
+
+    "Derivative Works" shall mean any work, whether in Source or Object
+    form, that is based on (or derived from) the Work and for which the
+    editorial revisions, annotations, elaborations, or other modifications
+    represent, as a whole, an original work of authorship. For the purposes
+    of this License, Derivative Works shall not include works that remain
+    separable from, or merely link (or bind by name) to the interfaces of,
+    the Work and Derivative Works thereof.
+
+    "Contribution" shall mean any work of authorship, including
+    the original version of the Work and any modifications or additions
+    to that Work or Derivative Works thereof, that is intentionally
+    submitted to Licensor for inclusion in the Work by the copyright owner
+    or by an individual or Legal Entity authorized to submit on behalf of
+    the copyright owner. For the purposes of this definition, "submitted"
+    means any form of electronic, verbal, or written communication sent
+    to the Licensor or its representatives, including but not limited to
+    communication on electronic mailing lists, source code control systems,
+    and issue tracking systems that are managed by, or on behalf of, the
+    Licensor for the purpose of discussing and improving the Work, but
+    excluding communication that is conspicuously marked or otherwise
+    designated in writing by the copyright owner as "Not a Contribution."
+
+    "Contributor" shall mean Licensor and any individual or Legal Entity
+    on behalf of whom a Contribution has been received by Licensor and
+    subsequently incorporated within the Work.
+
+2.  Grant of Copyright License. Subject to the terms and conditions of
+    this License, each Contributor hereby grants to You a perpetual,
+    worldwide, non-exclusive, no-charge, royalty-free, irrevocable
+    copyright license to reproduce, prepare Derivative Works of,
+    publicly display, publicly perform, sublicense, and distribute the
+    Work and such Derivative Works in Source or Object form.
+
+3.  Grant of Patent License. Subject to the terms and conditions of
+    this License, each Contributor hereby grants to You a perpetual,
+    worldwide, non-exclusive, no-charge, royalty-free, irrevocable
+    (except as stated in this section) patent license to make, have made,
+    use, offer to sell, sell, import, and otherwise transfer the Work,
+    where such license applies only to those patent claims licensable
+    by such Contributor that are necessarily infringed by their
+    Contribution(s) alone or by combination of their Contribution(s)
+    with the Work to which such Contribution(s) was submitted. If You
+    institute patent litigation against any entity (including a
+    cross-claim or counterclaim in a lawsuit) alleging that the Work
+    or a Contribution incorporated within the Work constitutes direct
+    or contributory patent infringement, then any patent licenses
+    granted to You under this License for that Work shall terminate
+    as of the date such litigation is filed.
+
+4.  Redistribution. You may reproduce and distribute copies of the
+    Work or 
```

---

### Incident Patch 4: `1e92edbf` (2025-04-07)
**Commit Message**: docs: update readme

**File**: `README.md` (modified, +5/-1)
```diff
@@ -5,4 +5,8 @@ MCP server for Browser MCP.
 - Website: https://browsermcp.io
 - Docs: https://docs.browsermcp.io
 
-This repo contains all the core MCP code for Browser MCP, but currently cannot be built on its own due to dependencies on utils and types from the monorepo where it's developed.
+This repo contains all the core MCP code for Browser MCP, but currently cannot yet be built on its own due to dependencies on utils and types from the monorepo where it's developed.
+
+### Credits
+
+Browser MCP was adapted from the [Playwright MCP server](https://github.com/microsoft/playwright-mcp) in order to automate the user's browser rather than creating new browser instances. This allows using the user's existing browser profile to use logged-in sessions and avoid bot detection mechanisms that commonly block automated browser use.
```

---

### Incident Patch 5: `6d766265` (2025-03-28)
**Commit Message**: extract mcp server from monorepo

**File**: `.gitignore` (added, +36/-0)
```diff
@@ -0,0 +1,36 @@
+# See https://help.github.com/articles/ignoring-files/ for more about ignoring files.
+
+# Dependencies
+node_modules
+.pnp
+.pnp.js
+
+# Local env files
+.env.local
+.env.development.local
+.env.test.local
+.env.production.local
+
+# Testing
+coverage
+
+# Turbo
+.turbo
+
+# Vercel
+.vercel
+
+# Build Outputs
+.next/
+out/
+build
+dist
+
+# Debug
+npm-debug.log*
+yarn-debug.log*
+yarn-error.log*
+
+# Misc
+.DS_Store
+*.pem
```

**File**: `README.md` (modified, +8/-2)
```diff
@@ -1,2 +1,8 @@
-# mcp
-Autobrowser MCP is a Model Context Provider (MCP) server that allows AI applications to control your browser
+# Browser MCP
+
+MCP server for Browser MCP.
+
+- Website: https://browsermcp.io
+- Docs: https://docs.browsermcp.io
+
+This repo contains all the core MCP code for Browser MCP, but currently cannot be built on its own due to dependencies on utils and types from the monorepo where it's developed.
```

**File**: `package.json` (added, +40/-0)
```diff
@@ -0,0 +1,40 @@
+{
+  "name": "@browsermcp/mcp",
+  "version": "0.1.0",
+  "description": "MCP server for browser automation using Browser MCP",
+  "author": "Browser MCP",
+  "homepage": "https://browsermcp.io",
+  "bugs": "https://github.com/browsermcp/mcp/issues",
+  "type": "module",
+  "bin": {
+    "mcp-server-browsermcp": "dist/index.js"
+  },
+  "files": [
+    "dist"
+  ],
+  "scripts": {
+    "typecheck": "tsc --noEmit",
+    "build": "tsup src/index.ts --format esm && shx chmod +x dist/*.js",
+    "prepare": "npm run build",
+    "watch": "tsup src/index.ts --format esm --watch ",
+    "inspector": "CLIENT_PORT=9001 SERVER_PORT=9002 pnpx @modelcontextprotocol/inspector node dist/index.js"
+  },
+  "dependencies": {
+    "@modelcontextprotocol/sdk": "^1.8.0",
+    "commander": "^13.1.0",
+    "ws": "^8.18.1",
+    "zod": "^3.24.2",
+    "zod-to-json-schema": "^3.24.3"
+  },
+  "devDependencies": {
+    "@r2r/messaging": "workspace:*",
+    "@repo/config": "workspace:*",
+    "@repo/messaging": "workspace:*",
+    "@repo/types": "workspace:*",
+    "@repo/utils": "workspace:*",
+    "@types/ws": "^8.18.0",
+    "shx": "^0.3.4",
+    "tsup": "^8.4.0",
+    "typescript": "^5.6.2"
+  }
+}
```

**File**: `src/context.ts` (added, +52/-0)
```diff
@@ -0,0 +1,52 @@
+import { createSocketMessageSender } from "@r2r/messaging/ws/sender";
+import { WebSocket } from "ws";
+
+import { mcpConfig } from "@repo/config/mcp.config";
+import { MessagePayload, MessageType } from "@repo/messaging/types";
+import { SocketMessageMap } from "@repo/types/messages/ws";
+
+const noConnectionMessage = `No connection to browser extension. In order to proceed, you must first connect a tab by clicking the Browser MCP extension icon in the browser toolbar and clicking the 'Connect' button.`;
+
+export class Context {
+  private _ws: WebSocket | undefined;
+
+  get ws(): WebSocket {
+    if (!this._ws) {
+      throw new Error(noConnectionMessage);
+    }
+    return this._ws;
+  }
+
+  set ws(ws: WebSocket) {
+    this._ws = ws;
+  }
+
+  hasWs(): boolean {
+    return !!this._ws;
+  }
+
+  async sendSocketMessage<T extends MessageType<SocketMessageMap>>(
+    type: T,
+    payload: MessagePayload<SocketMessageMap, T>,
+    options: { timeoutMs?: number } = { timeoutMs: 30000 }
+  ) {
+    const { sendSocketMessage } = createSocketMessageSender<SocketMessageMap>(
+      this.ws
+    );
+    try {
+      return await sendSocketMessage(type, payload, options);
+    } catch (e) {
+      if (e instanceof Error && e.message === mcpConfig.errors.noConnectedTab) {
+        throw new Error(noConnectionMessage);
+      }
+      throw e;
+    }
+  }
+
+  async close() {
+    if (!this._ws) {
+      return;
+    }
+    await this._ws.close();
+  }
+}
```

**File**: `src/index.ts` (added, +66/-0)
```diff
@@ -0,0 +1,66 @@
+#!/usr/bin/env node
+import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
+import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
+import { program } from "commander";
+
+import { appConfig } from "@repo/config/app.config";
+
+import type { Resource } from "@/resources/resource";
+import { createServerWithTools } from "@/server";
+import * as common from "@/tools/common";
+import * as custom from "@/tools/custom";
+import * as snapshot from "@/tools/snapshot";
+import type { Tool } from "@/tools/tool";
+
+import packageJSON from "../package.json";
+
+function setupExitWatchdog(server: Server) {
+  process.stdin.on("close", async () => {
+    setTimeout(() => process.exit(0), 15000);
+    await server.close();
+    process.exit(0);
+  });
+}
+
+const commonTools: Tool[] = [common.pressKey, common.wait];
+
+const customTools: Tool[] = [custom.getConsoleLogs];
+
+const snapshotTools: Tool[] = [
+  common.navigate(true),
+  common.goBack(true),
+  common.goForward(true),
+  snapshot.snapshot,
+  snapshot.click,
+  snapshot.hover,
+  snapshot.type,
+  snapshot.selectOption,
+  ...commonTools,
+  ...customTools,
+];
+
+const resources: Resource[] = [];
+
+async function createServer(): Promise<Server> {
+  return createServerWithTools({
+    name: appConfig.name,
+    version: packageJSON.version,
+    tools: snapshotTools,
+    resources,
+  });
+}
+
+/**
+ * Note: Tools must be defined *before* calling `createServer` because only declarations are hoisted, not the initializations
+ */
+program
+  .version("Version " + packageJSON.version)
+  .name(packageJSON.name)
+  .action(async () => {
+    const server = await createServer();
+    setupExitWatchdog(server);
+
+    const transport = new StdioServerTransport();
+    await server.connect(transport);
+  });
+program.parse(process.argv);
```

**File**: `src/resources/resource.ts` (added, +20/-0)
```diff
@@ -0,0 +1,20 @@
+import type { Context } from "../context";
+
+export type ResourceSchema = {
+  uri: string;
+  name: string;
+  description?: string;
+  mimeType?: string;
+};
+
+export type ResourceResult = {
+  uri: string;
+  mimeType?: string;
+  text?: string;
+  blob?: string;
+};
+
+export type Resource = {
+  schema: ResourceSchema;
+  read: (context: Context, uri: string) => Promise<ResourceResult[]>;
+};
```

**File**: `src/server.ts` (added, +92/-0)
```diff
@@ -0,0 +1,92 @@
+import { Server } from "@modelcontextprotocol/sdk/server/index.js";
+import {
+  CallToolRequestSchema,
+  ListResourcesRequestSchema,
+  ListToolsRequestSchema,
+  ReadResourceRequestSchema,
+} from "@modelcontextprotocol/sdk/types.js";
+
+import { Context } from "@/context";
+import type { Resource } from "@/resources/resource";
+import type { Tool } from "@/tools/tool";
+import { createWebSocketServer } from "@/ws";
+
+type Options = {
+  name: string;
+  version: string;
+  tools: Tool[];
+  resources: Resource[];
+};
+
+export async function createServerWithTools(options: Options): Promise<Server> {
+  const { name, version, tools, resources } = options;
+  const context = new Context();
+  const server = new Server(
+    { name, version },
+    {
+      capabilities: {
+        tools: {},
+        resources: {},
+      },
+    },
+  );
+
+  const wss = await createWebSocketServer();
+  wss.on("connection", (websocket) => {
+    // Close any existing connections
+    if (context.hasWs()) {
+      context.ws.close();
+    }
+    context.ws = websocket;
+  });
+
+  server.setRequestHandler(ListToolsRequestSchema, async () => {
+    return { tools: tools.map((tool) => tool.schema) };
+  });
+
+  server.setRequestHandler(ListResourcesRequestSchema, async () => {
+    return { resources: resources.map((resource) => resource.schema) };
+  });
+
+  server.setRequestHandler(CallToolRequestSchema, async (request) => {
+    const tool = tools.find((tool) => tool.schema.name === request.params.name);
+    if (!tool) {
+      return {
+        content: [
+          { type: "text", text: `Tool "${request.params.name}" not found` },
+        ],
+        isError: true,
+      };
+    }
+
+    try {
+      const result = await tool.handle(context, request.params.arguments);
+      return result;
+    } catch (error) {
+      return {
+        content: [{ type: "text", text: String(error) }],
+        isError: true,
+      };
+    }
+  });
+
+  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
+    const resource = resources.find(
+      (resource) => resource.schema.uri === request.params.uri,
+    );
+    if (!resource) {
+      return { contents: [] };
+    }
+
+    const contents = await resource.read(context, request.params.uri);
+    return { contents };
+  });
+
+  server.close = async () => {
+    await server.close();
+    await wss.close();
+    await context.close();
+  };
+
+  return server;
+}
```

**File**: `src/tools/common.ts` (added, +120/-0)
```diff
@@ -0,0 +1,120 @@
+import { zodToJsonSchema } from "zod-to-json-schema";
+
+import {
+  GoBackTool,
+  GoForwardTool,
+  NavigateTool,
+  PressKeyTool,
+  WaitTool,
+} from "@repo/types/mcp/tool";
+
+import { captureAriaSnapshot } from "@/utils/aria-snapshot";
+
+import type { Tool, ToolFactory } from "./tool";
+
+export const navigate: ToolFactory = (snapshot) => ({
+  schema: {
+    name: NavigateTool.shape.name.value,
+    description: NavigateTool.shape.description.value,
+    inputSchema: zodToJsonSchema(NavigateTool.shape.arguments),
+  },
+  handle: async (context, params) => {
+    const { url } = NavigateTool.shape.arguments.parse(params);
+    await context.sendSocketMessage("browser_navigate", { url });
+    if (snapshot) {
+      return captureAriaSnapshot(context);
+    }
+    return {
+      content: [
+        {
+          type: "text",
+          text: `Navigated to ${url}`,
+        },
+      ],
+    };
+  },
+});
+
+export const goBack: ToolFactory = (snapshot) => ({
+  schema: {
+    name: GoBackTool.shape.name.value,
+    description: GoBackTool.shape.description.value,
+    inputSchema: zodToJsonSchema(GoBackTool.shape.arguments),
+  },
+  handle: async (context) => {
+    await context.sendSocketMessage("browser_go_back", {});
+    if (snapshot) {
+      return captureAriaSnapshot(context);
+    }
+    return {
+      content: [
+        {
+          type: "text",
+          text: "Navigated back",
+        },
+      ],
+    };
+  },
+});
+
+export const goForward: ToolFactory = (snapshot) => ({
+  schema: {
+    name: GoForwardTool.shape.name.value,
+    description: GoForwardTool.shape.description.value,
+    inputSchema: zodToJsonSchema(GoForwardTool.shape.arguments),
+  },
+  handle: async (context) => {
+    await context.sendSocketMessage("browser_go_forward", {});
+    if (snapshot) {
+      return captureAriaSnapshot(context);
+    }
+    return {
+      content: [
+        {
+          type: "text",
+          text: "Navigated forward",
+        },
+      ],
+    };
+  },
+});
+
+export const wait: Tool = {
+  schema: {
+    name: WaitTool.shape.name.value,
+    description: WaitTool.shape.description.value,
+    inputSchema: zodToJsonSchema(WaitTool.shape.arguments),
+  },
+  handle: async (context, params) => {
+    const { time } = WaitTool.shape.arguments.parse(params);
+    await context.sendSocketMessage("browser_wait", { time });
+    return {
+      content: [
+        {
+          type: "text",
+          text: `Waited for ${time} seconds`,
+        },
+      ],
+    };
+  },
+};
+
+export const pressKey: Tool = {
+  schema: {
+    name: PressKeyTool.shape.name.value,
+    description: PressKeyTool.shape.description.value,
+    inputSchema: zodToJsonSchema(PressKeyTool.shape.arguments),
+  },
+  handle: async (context, params) => {
+    const { key } = PressKeyTool.shape.arguments.parse(params);
+    await context.sendSocketMessage("browser_press_key", { key });
+    return {
+      content: [
+        {
+          type: "text",
+          text: `Pressed key ${key}`,
+        },
+      ],
+    };
+  },
+};
```

---

### Incident Patch 6: `92b9eecd` (2025-03-28)
**Commit Message**: Initial commit

**File**: `README.md` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+# mcp
+Autobrowser MCP is a Model Context Provider (MCP) server that allows AI applications to control your browser
```

#### Recent Merged Pull Requests:
- **PR #208** (closed): fix: avoid infinite recursion in server.close override (@a0972199950)
- **PR #204** (closed): Add opt-out for killing an existing WebSocket server (@seryogakovalyov)
- **PR #177** (closed): fix: add MCP tool annotations (@zxyasfas)
- **PR #173** (closed): ci: add HOL skill-publish validate workflow (@internet-dot)
- **PR #169** (closed): Add Codex plugin quality gate CI (@internet-dot)
- **PR #164** (closed): docs: add Fronteir AI hosted deployment option (@ElishaKay)
- **PR #104** (closed): feat: 完整 DevTools 功能支援 (@gowerlin)
- **PR #103** (closed): fix: Add cross-platform compatibility for Windows Git Bash (@gowerlin)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
