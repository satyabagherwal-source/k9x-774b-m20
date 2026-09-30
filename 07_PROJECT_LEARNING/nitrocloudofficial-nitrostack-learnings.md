# Forensic Learning Record (Deep Inspection): nitrocloudofficial/nitrostack

> **Canonical Artifact**: `07_PROJECT_LEARNING/nitrocloudofficial-nitrostack-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/nitrocloudofficial/nitrostack](https://github.com/nitrocloudofficial/nitrostack))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:46:58.999Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `nitrocloudofficial/nitrostack`
- **Description**: The full-stack TypeScript framework to build, test, and deploy production-ready MCP servers and AI-native apps.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2477 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `sample-apps/AI-Scheduler-NitroStack-Hackathon/nitro.config.ts`
```
import { defineConfig } from '@nitrostack/cli';

export default defineConfig({
  appName: 'ai-assistant',
  entry: 'src/index.ts',
  server: {
    port: 3000,
    runtime: 'node'
  },
  env: {
    MONGODB_URI: process.env.MONGODB_URI || '',
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
    GOOGLE_ACCESS_TOKEN: process.env.GOOGLE_ACCESS_TOKEN || '',
    GOOGLE_REFRESH_TOKEN: process.env.GOOGLE_REFRESH_TOKEN || '',
    JWT_SECRET: process.env.JWT_SECRET || 'dev-secret'
  }
});

```

### Core Architecture Module: `sample-apps/AI-Scheduler-NitroStack-Hackathon/src/app.module.ts`
```
import { McpApp, Module, ConfigModule } from '@nitrostack/core';
import { AssistantModule } from './modules/assistant/assistant.module.js';
import { SystemHealthCheck } from './health/system.health.js';

@McpApp({
  module: AppModule,
  server: {
    name: 'ai-assistant-server',
    version: '1.0.0'
  },
  logging: {
    level: 'info'
  }
})
@Module({
  name: 'app',
  description: 'AI personal assistant MCP server',
  imports: [
    ConfigModule.forRoot(),
    AssistantModule
  ],
  providers: [
    SystemHealthCheck
  ]
})
export class AppModule {}


```

### Core Architecture Module: `sample-apps/AI-Scheduler-NitroStack-Hackathon/src/health/system.health.ts`
```
import { HealthCheck, HealthCheckInterface, HealthCheckResult } from '@nitrostack/core';

/**
 * System Health Check
 * 
 * Monitors system resources and uptime
 */
@HealthCheck({ 
  name: 'system', 
  description: 'System resource and uptime check',
  interval: 30 // Check every 30 seconds
})
export class SystemHealthCheck implements HealthCheckInterface {
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  async check(): Promise<HealthCheckResult> {
    try {
      const memoryUsage = process.memoryUsage();
      const uptime = Date.now() - this.startTime;
      const uptimeSeconds = Math.floor(uptime / 1000);
      
      // Convert memory to MB
      const memoryUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
      const memoryTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
      
      // Consider unhealthy if memory usage is > 90%
      const memoryPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
      const isHealthy = memoryPercent < 90;
      
      return {
        status: isHealthy ? 'up' : 'degraded',
        message: isHealthy 
          ? 'System is healthy' 
          : 'High memory usage detected',
        details: {
          uptime: `${uptimeSeconds}s`,
          memory: `${memoryUsedMB}MB / ${memoryTotalMB}MB (${Math.round(memoryPercent)}%)`,
          pid: process.pid,
          nodeVersion: process.version,
        },
      };
    } catch (error: any) {
      return {
        status: 'down',
        message: 'System health check failed',
        details: error.message,
      };
    }
  }
}


```

### Core Architecture Module: `sample-apps/AI-Scheduler-NitroStack-Hackathon/src/index.ts`
```
/**
 * AI Personal Assistant MCP Server
 */

import 'dotenv/config';
import { McpApplicationFactory } from '@nitrostack/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const server = await McpApplicationFactory.create(AppModule);
  await server.start();
}

bootstrap().catch((error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});

```

### Core Architecture Module: `sample-apps/AI-Scheduler-NitroStack-Hackathon/src/models/daily-summary.model.ts`
```
export interface DailySummaryDocument {
  userId: string;
  date: string;
  metrics: {
    tasksCompleted: number;
    totalHoursLogged: number;
    expensesTotal: number;
  };
  summaryText: string;
  insights: string[];
}

export class DailySummaryModel {
  static create(summary: Partial<DailySummaryDocument>): DailySummaryDocument {
    return {
      userId: summary.userId ?? 'demo-user',
      date: summary.date ?? new Date().toISOString(),
      metrics: summary.metrics ?? {
        tasksCompleted: 0,
        totalHoursLogged: 0,
        expensesTotal: 0
      },
      summaryText: summary.summaryText ?? 'No summary available yet.',
      insights: summary.insights ?? []
    } as DailySummaryDocument;
  }
}

```

### Core Architecture Module: `sample-apps/AI-Scheduler-NitroStack-Hackathon/src/models/expense.model.ts`
```
export interface ExpenseDocument {
  userId: string;
  amount: number;
  category: string;
  description: string;
  date: string;
}

export class ExpenseModel {
  static create(expense: Partial<ExpenseDocument>): ExpenseDocument {
    return {
      userId: expense.userId ?? 'demo-user',
      amount: expense.amount ?? 0,
      category: expense.category ?? 'general',
      description: expense.description ?? 'Expense',
      date: expense.date ?? new Date().toISOString()
    } as ExpenseDocument;
  }
}

```

### Core Architecture Module: `sample-apps/AI-Scheduler-NitroStack-Hackathon/src/models/habit.model.ts`
```
export interface HabitDocument {
  userId: string;
  name: string;
  frequency: string;
  streakCount: number;
  history: Array<{ date: string; completed: boolean }>;
}

export class HabitModel {
  static create(habit: Partial<HabitDocument>): HabitDocument {
    return {
      userId: habit.userId ?? 'demo-user',
      name: habit.name ?? 'New habit',
      frequency: habit.frequency ?? 'daily',
      streakCount: habit.streakCount ?? 0,
      history: habit.history ?? []
    } as HabitDocument;
  }
}

```

### Core Architecture Module: `sample-apps/AI-Scheduler-NitroStack-Hackathon/src/models/task.model.ts`
```
export type TaskStatus = 'pending' | 'completed' | 'rescheduled';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface TaskDocument {
  userId: string;
  title: string;
  description?: string;
  category?: string;
  startTime?: string;
  endTime?: string;
  status: TaskStatus;
  priority: TaskPriority;
  googleCalendarEventId?: string;
  isTimeBlocked: boolean;
}

export class TaskModel {
  static create(task: Partial<TaskDocument>): TaskDocument {
    return {
      userId: task.userId ?? 'demo-user',
      title: task.title ?? 'Untitled task',
      description: task.description,
      category: task.category,
      startTime: task.startTime,
      endTime: task.endTime,
      status: task.status ?? 'pending',
      priority: task.priority ?? 'medium',
      googleCalendarEventId: task.googleCalendarEventId,
      isTimeBlocked: task.isTimeBlocked ?? false
    } as TaskDocument;
  }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #348** (2026-09-24): **fix(deps): pin ext-apps to 1.x so template installs stay on Zod 3**
  *Symptoms*: ## Description  This PR resolves an `ERESOLVE` dependency resolution failure across NitroStack packages and starter templates caused by the release of `@modelcontextprotocol/ext-apps@2.0.0`.  ### Root Cause Previously, `package.json` files specified `@modelcontextprotocol/ext-apps: ">=0.1.0"`. Because this range was unbounded, npm resolved to the newly released `2.0.0`, which declares peer dependencies on `zod: ^4.2.0` and `@modelcontextprotocol/core: ^2.0.0`. Since NitroStack depends on Zod 3, modern npm failed during `npm install` with an unresolvable peer dependency conflict (`ERESOLVE`).  Published `@nitrostack/core@1.0.16` and `@nitrostack/widgets@1.0.9` still declare that unbounded peer. Template roots depend on `@nitrostack/core: "^1"`, so they install the published package. A direct `@modelcontextprotocol/ext-apps: "^1.0.0"` dependency is required on those templates until `1.0.17` / `1.0.10` are published.  ## Type of Change  - [x] fix: Bug fix - [ ] feat: New feature - [ ] docs: Documentation update - [ ] refactor: Internal code change - [ ] test: Test-only changes - [ ] chore: Build, CI, or tooling changes  ## Related Issues  Resolves peer dependency conflict (`ERESOLVE`) on fresh `npm install` for `@nitrostack/core`, `@nitrostack/widgets`, and all CLI starter templates.  ## Changes Made  1. **`@nitrostack/core` (`1.0.17`)**: Removed `@modelcontextprotocol/ext-apps` from `peerDependencies`. Server-side code does not import `ext-apps`. Raised the direct `zod` depende

- **Issue #346** (2026-09-23): **fix(core): attach input to ExecutionContext for middleware and interceptors**
  *Symptoms*: ## Description  Tool arguments were never attached to ExecutionContext, so middleware and interceptors could not inspect the actual input (context.input was always undefined). This contradicts the SDK reference and Interceptor guide, both of which show context.input as the canonical way to read tool arguments in cross-cutting logic.  ## Changes Made  - Add optional `input` field to the `ExecutionContext` interface (types.ts) - Populate `context.input` with the sanitised tool arguments at both call   sites in server.ts (synchronous path and runTaskAsync) - `_meta` is excluded from input as it already lives in context.metadata  ## Type of Change  - [x] fix: Bug fix  ## Related Issues  Closes #328  ## Testing  - [x] npm test — 708 tests pass, 60 suites green - [x] Added test: verifies context.input is populated with tool args   and _meta is correctly excluded

- **Issue #344** (2026-09-07): **feat(core): implement MCP 2026-07-28 stateless protocol, task management, CIMD/OAuth 2.1 hardening, and MRTR support**
  *Symptoms*: ## Description  This PR implements the official **Model Context Protocol (MCP) `2026-07-28` specification** across `@nitrostack/core` while maintaining 100% backward compatibility for existing 2025-era sessionful servers.  It introduces a dual-adapter architecture, a robust task orchestration engine (`TaskManager` / `TaskStore`), multi-channel notification routing, hardened OAuth 2.1 & Client ID Metadata Document (CIMD) resolution, Multi-Round-Trip Requests (MRTR) for interactive elicitation, full JSON Schema 2020-12 translation, W3C trace context propagation, cache hints, and comprehensive configuration support across starter templates (including Pizza and OAuth Flight Booking templates).  ---  ## System Architecture Diagram  ```mermaid flowchart TD     subgraph Clients["MCP Clients"]         C1["Modern MCP Client (2026-07-28)\n(NitroStudio / Claude / Cursor)"]         C2["Legacy MCP Client (2025-06-18)\n(Sessionful SSE / HTTP)"]     end      subgraph Transport["Transport Layer (HTTP / STDIO)"]         TH["Streamable HTTP Transport (/mcp)"]         TS["StdIO Transport"]         SEL{"Protocol Era Selector\n(NITRO_MCP_PROTOCOL_VERSION)"}     end      subgraph Adapters["Protocol Adapters"]         MA["ModernProtocolAdapter (v2)\n(@modelcontextprotocol/server@2.0.0)\nStateless per-request dispatch"]         LA["Legacy Adapter (v1)\n(@modelcontextprotocol/sdk@1.x)\nSessionful SSE / Handshakes"]     end      subgraph Security["Auth & Interception Layer"]         OG["OAuthGuard & T

- **Issue #341** (2026-08-28): **chore(sample-apps): remove non-working and invalid sample applications**
  *Symptoms*: ## Summary Removes 8 non-working sample projects and 2 invalid/incomplete directories from `sample-apps/` that fail installation, build, or startup runtime validation.  An automated validation harness was executed across all 66 sample projects to verify dependency installation, build correctness, process execution, and runtime responsiveness. The remaining 56 sample projects have been tested and verified to be 100% working.  ---  ## Removed Projects (10)  ### Non-Working Projects (8) * **`converge`**: SDK monorepo copy missing type definitions (`jose`). * **`FlowLogix`**: Missing `warehouse-health-summary` HTML route on server start. * **`logic-loop-mcp-server-project`**: SDK monorepo copy missing type definitions (`jose`). * **`project-aegis`**: Missing `next` CLI build dependency. * **`Rightly`**: Hard failure on startup due to missing required `GOOGLE_GEMINI_API_KEY`. * **`seer`**: Fails startup due to Zod schema validation errors. * **`token-slash`**: Build failure due to missing `@types/express`. * **`trade-matcher`**: Hard failure on startup due to missing required OpenAI credentials.  ### Invalid / Incomplete Projects (2) * **`autoboardai`**: Empty directory. * **`process-workload-monitoring`**: Only contained a `readme.md` file without runnable code or configuration.  ---  ## Verification - Validated all 56 remaining sample applications via the test runner. - Every remaining project installs dependencies, compiles/builds successfully, and starts without runtime errors

- **Issue #340** (2026-08-28): **fix(sample-apps): resolve case-collision between README.md and readme.md**
  *Symptoms*: ## Summary Resolves a filename case-collision under `sample-apps/` where both `README.md` (containing stale CrisisMesh project content) and `readme.md` (containing the submission instructions) were tracked simultaneously in git.  This collision causes git clone warnings and checkout/status inconsistencies on case-insensitive filesystems (such as macOS and Windows).  ---  ## Changes - Updated `sample-apps/README.md` to contain the canonical "How to submit your project — step by step" submission guide. - Removed duplicate lowercase `sample-apps/readme.md` from git tracking. - Cleaned up stray CrisisMesh content from `sample-apps/README.md`.  ---  ## Verification - Verified with `git ls-files | tr '[:upper:]' '[:lower:]' | sort | uniq -d` that no case-insensitive collisions remain in the repository. - Verified working tree is clean and git status reports no phantom deleted files.

- **Issue #339** (2026-08-28): **feat(widgets): implement RPC methods in polyfill and enhance sendFollowUpMessage payload support**
  *Symptoms*: ## Description  This PR enhances `@nitrostack/widgets` runtime polyfill and SDK compatibility by: 1. Enabling `sendFollowUpMessage` to accept either plain string prompts or `{ prompt: string }` objects across the SDK, types, runtime, and polyfills. 2. Supporting both `openai` and `data` fields in `NITRO_INJECT_OPENAI` message payloads. 3. Implementing parent RPC messaging (`NITRO_WIDGET_RPC`) for `sendFollowUpMessage`, `openExternal`, and `requestClose` in `widget-polyfill`. 4. Gating the polyfill's ready event dispatch when `WidgetLayout` is active (`__nitroWidgetLayoutActive`) to prevent race conditions before RPC handlers are installed.  ## Type of Change  - [x] feat: New feature - [x] fix: Bug fix - [ ] docs: Documentation update - [ ] refactor: Internal code change - [ ] test: Test-only changes - [ ] chore: Build, CI, or tooling changes  ## Changes Made  - **`typescript/packages/widgets/src/types.ts`**: Updated `OpenAiAPI.sendFollowUpMessage` signature to support `(args: { prompt: string } | string) => Promise<void>`. - **`typescript/packages/widgets/src/sdk.ts`**: Normalized prompt argument in `WidgetSDK.prototype.sendFollowUpMessage` to support string or object forms. - **`typescript/packages/widgets/src/runtime/WidgetLayout.tsx`**: Updated `sendFollowUpMessage` parameter parsing and exposed it in `onReady` payload. - **`typescript/packages/widgets/src/runtime/widget-polyfill.ts`**:   - Implemented RPC postMessage dispatch for `sendFollowUpMessage`, `openExternal`, and

- **Issue #337** (2026-08-25): **fix(core): propagate HTTP Authorization header and params._meta into tool ExecutionContext**
  *Symptoms*: ## Description  Remote MCP clients (ChatGPT Apps SDK, Cursor, HTTP/SSE) authenticating with OAuth 2.1 bearer tokens always failed `OAuthGuard` with `OAuth token required`, even after a successful OAuth handshake. Two root causes in `@nitrostack/core`:  1. `StreamableHttpTransport.handleMcpRequest` delegated to the MCP SDK without bridging the HTTP `Authorization` header into the session or execution context. 2. The `tools/call` handler only read `_meta` from `request.params.arguments`, ignoring the spec-compliant `request.params._meta`, so spec-compliant clients had their metadata stripped.  As a result `ExecutionContext.metadata` was always `{}` for HTTP/SSE requests and `OAuthGuard` failed unconditionally when `OAUTH_REQUIRED=true`.  ## Type of Change  - [ ] feat: New feature - [x] fix: Bug fix - [ ] docs: Documentation update - [ ] refactor: Internal code change - [ ] test: Test-only changes - [ ] chore: Build, CI, or tooling changes  ## Related Issues  Bug report: `docs/sdk-bug/oauth-http-headers-and-metadata-loss.md` (internal report, validated against v1.0.14)  ## Changes Made  - `transports/streamable-http.ts`: added exported `SessionContext` (`{ authHeader?: string }`); `McpServerFactory` now receives it; `McpSession` carries it; `handleMcpRequest` refreshes `authHeader` from the HTTP `Authorization` header on every request (mid-session token refreshes work) - `server.ts`: `createConfiguredMcpServer` / `setupHandlersOn` accept the per-session `SessionContext`; the `to

- **Issue #306** (2026-08-06): **[Hackathon] VectorPoint - Autonomous-Medical-Imaging-Diagnosis-Clinical-Decision-Agent**
  *Symptoms*: ## Description  <!-- Explain what this PR changes and why -->  ## Type of Change  - [ ] feat: New feature - [ ] fix: Bug fix - [ ] docs: Documentation update - [ ] refactor: Internal code change - [ ] test: Test-only changes - [ ] chore: Build, CI, or tooling changes  ## Related Issues  <!-- Use closing keywords when appropriate, e.g. Closes #123 -->  ## Changes Made  -  -  -   ## Testing  - [ ] `npm run lint` - [ ] `npm test` - [ ] Manual testing performed (if applicable)  ## Screenshots / Recordings  <!-- Add screenshots or GIFs for UI/UX changes -->  ## Checklist  - [ ] I have read and followed `CONTRIBUTING.md` - [ ] I have added/updated tests where appropriate - [ ] I have updated docs where appropriate - [ ] I have kept this PR focused and scoped - [ ] I have used conventional commits 

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

### Incident Patch 1: `4c1a1c47` (2026-09-24)
**Commit Message**: Merge pull request #348 from nitrocloudofficial/fix/pin-ext-apps-peer-dependency

fix(deps): pin ext-apps to 1.x so template installs stay on Zod 3

**File**: `typescript/packages/cli/package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "@nitrostack/cli",
-  "version": "1.0.16",
+  "version": "1.0.17",
   "description": "CLI for NitroStack - Create and manage MCP server projects",
   "type": "module",
   "main": "dist/index.js",
```

**File**: `typescript/packages/cli/templates/typescript-oauth/package.json` (modified, +3/-3)
```diff
@@ -15,12 +15,12 @@
   },
   "dependencies": {
     "@nitrostack/core": "^1",
-    "zod": "^3.22.4",
+    "zod": "^3.25.0",
     "dotenv": "^16.3.1",
+    "@modelcontextprotocol/ext-apps": "^1.0.0",
     "@duffel/api": "^4.21.0",
     "axios": "^1.7.9",
-    "date-fns": "^4.1.0",
-    "@modelcontextprotocol/ext-apps": ">=0.1.0"
+    "date-fns": "^4.1.0"
   },
   "devDependencies": {
     "@nitrostack/cli": "^1",
```

**File**: `typescript/packages/cli/templates/typescript-oauth/src/widgets/package.json` (modified, +3/-1)
```diff
@@ -13,7 +13,9 @@
     "react": "^18.3.1",
     "react-dom": "^18.3.1",
     "@nitrostack/widgets": "^1",
-    "@modelcontextprotocol/ext-apps": ">=0.1.0"
+    "@modelcontextprotocol/ext-apps": "^1.0.0",
+    "@modelcontextprotocol/sdk": "^1.29.0",
+    "zod": "^3.25.0"
   },
   "devDependencies": {
     "@types/node": "^20",
```

**File**: `typescript/packages/cli/templates/typescript-pizzaz/package.json` (modified, +2/-2)
```diff
@@ -24,9 +24,9 @@
   "license": "MIT",
   "dependencies": {
     "@nitrostack/core": "^1",
-    "zod": "^3.22.4",
+    "zod": "^3.25.0",
     "dotenv": "^16.3.1",
-    "@modelcontextprotocol/ext-apps": ">=0.1.0"
+    "@modelcontextprotocol/ext-apps": "^1.0.0"
   },
   "devDependencies": {
     "@nitrostack/cli": "^1",
```

**File**: `typescript/packages/cli/templates/typescript-pizzaz/src/widgets/package.json` (modified, +3/-1)
```diff
@@ -13,7 +13,9 @@
         "react": "^18.3.1",
         "react-dom": "^18.3.1",
         "@nitrostack/widgets": "^1",
-        "@modelcontextprotocol/ext-apps": ">=0.1.0",
+        "@modelcontextprotocol/ext-apps": "^1.0.0",
+        "@modelcontextprotocol/sdk": "^1.29.0",
+        "zod": "^3.25.0",
         "mapbox-gl": "^3.0.1",
         "framer-motion": "^10.16.16",
         "lucide-react": "^0.294.0"
```

---

### Incident Patch 2: `b91780a2` (2026-09-23)
**Commit Message**: fix(deps): pin ext-apps to 1.x so template installs stay on Zod 3

Published core 1.0.16 still peers ext-apps >=0.1.0, which resolves to 2.0.0 and Zod 4. Pin the templates, mark the widgets peer optional, and bump core, widgets, and CLI.

Co-authored-by: Cursor <cursoragent@cursor.com>

**File**: `typescript/packages/cli/package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "@nitrostack/cli",
-  "version": "1.0.16",
+  "version": "1.0.17",
   "description": "CLI for NitroStack - Create and manage MCP server projects",
   "type": "module",
   "main": "dist/index.js",
```

**File**: `typescript/packages/cli/templates/typescript-oauth/package.json` (modified, +1/-0)
```diff
@@ -17,6 +17,7 @@
     "@nitrostack/core": "^1",
     "zod": "^3.25.0",
     "dotenv": "^16.3.1",
+    "@modelcontextprotocol/ext-apps": "^1.0.0",
     "@duffel/api": "^4.21.0",
     "axios": "^1.7.9",
     "date-fns": "^4.1.0"
```

**File**: `typescript/packages/cli/templates/typescript-oauth/src/widgets/package.json` (modified, +1/-0)
```diff
@@ -14,6 +14,7 @@
     "react-dom": "^18.3.1",
     "@nitrostack/widgets": "^1",
     "@modelcontextprotocol/ext-apps": "^1.0.0",
+    "@modelcontextprotocol/sdk": "^1.29.0",
     "zod": "^3.25.0"
   },
   "devDependencies": {
```

**File**: `typescript/packages/cli/templates/typescript-pizzaz/package.json` (modified, +2/-1)
```diff
@@ -25,7 +25,8 @@
   "dependencies": {
     "@nitrostack/core": "^1",
     "zod": "^3.25.0",
-    "dotenv": "^16.3.1"
+    "dotenv": "^16.3.1",
+    "@modelcontextprotocol/ext-apps": "^1.0.0"
   },
   "devDependencies": {
     "@nitrostack/cli": "^1",
```

**File**: `typescript/packages/cli/templates/typescript-pizzaz/src/widgets/package.json` (modified, +1/-0)
```diff
@@ -14,6 +14,7 @@
         "react-dom": "^18.3.1",
         "@nitrostack/widgets": "^1",
         "@modelcontextprotocol/ext-apps": "^1.0.0",
+        "@modelcontextprotocol/sdk": "^1.29.0",
         "zod": "^3.25.0",
         "mapbox-gl": "^3.0.1",
         "framer-motion": "^10.16.16",
```

---

### Incident Patch 3: `fdb33d96` (2026-09-23)
**Commit Message**: fix(deps): pin @modelcontextprotocol/ext-apps to 1.x and clean up core peer dependency

- Remove @modelcontextprotocol/ext-apps from @nitrostack/core peerDependencies
- In @nitrostack/widgets, pin @modelcontextprotocol/ext-apps to ^1.0.0 and mark optional in peerDependenciesMeta
- In CLI templates (starter, pizzaz, oauth), pin @modelcontextprotocol/ext-apps to ^1.0.0 to prevent pulling ext-apps 2.0.0 (which requires zod 4 while NitroStack relies on zod 3)

**File**: `typescript/packages/cli/templates/typescript-oauth/package.json` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@
     "@duffel/api": "^4.21.0",
     "axios": "^1.7.9",
     "date-fns": "^4.1.0",
-    "@modelcontextprotocol/ext-apps": ">=0.1.0"
+    "@modelcontextprotocol/ext-apps": "^1.0.0"
   },
   "devDependencies": {
     "@nitrostack/cli": "^1",
```

**File**: `typescript/packages/cli/templates/typescript-oauth/src/widgets/package.json` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@
     "react": "^18.3.1",
     "react-dom": "^18.3.1",
     "@nitrostack/widgets": "^1",
-    "@modelcontextprotocol/ext-apps": ">=0.1.0"
+    "@modelcontextprotocol/ext-apps": "^1.0.0"
   },
   "devDependencies": {
     "@types/node": "^20",
```

**File**: `typescript/packages/cli/templates/typescript-pizzaz/package.json` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@
     "@nitrostack/core": "^1",
     "zod": "^3.22.4",
     "dotenv": "^16.3.1",
-    "@modelcontextprotocol/ext-apps": ">=0.1.0"
+    "@modelcontextprotocol/ext-apps": "^1.0.0"
   },
   "devDependencies": {
     "@nitrostack/cli": "^1",
```

**File**: `typescript/packages/cli/templates/typescript-pizzaz/src/widgets/package.json` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@
         "react": "^18.3.1",
         "react-dom": "^18.3.1",
         "@nitrostack/widgets": "^1",
-        "@modelcontextprotocol/ext-apps": ">=0.1.0",
+        "@modelcontextprotocol/ext-apps": "^1.0.0",
         "mapbox-gl": "^3.0.1",
         "framer-motion": "^10.16.16",
         "lucide-react": "^0.294.0"
```

**File**: `typescript/packages/cli/templates/typescript-starter/package.json` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@
     "dotenv": "^16.3.1",
     "@nitrostack/core": "^1",
     "zod": "^3.22.4",
-    "@modelcontextprotocol/ext-apps": ">=0.1.0"
+    "@modelcontextprotocol/ext-apps": "^1.0.0"
   },
   "devDependencies": {
     "@nitrostack/cli": "^1",
```

---

### Incident Patch 4: `0cca3e07` (2026-09-04)
**Commit Message**: fix: update port resolution logic to prioritize process.env.PORT over oauthConfig resourceUri

**File**: `typescript/packages/core/src/core/app-decorator.ts` (modified, +16/-7)
```diff
@@ -421,13 +421,22 @@ export class McpApplicationFactory {
       // This allows Studio to connect via STDIO while exposing OAuth metadata via HTTP
       transportType = 'dual';
       
-      // Extract port from resourceUri (e.g., http://localhost:3002)
-      let port = 3000;
-      try {
-        const resourceUrl = new URL(oauthConfig.resourceUri);
-        port = resourceUrl.port ? parseInt(resourceUrl.port) : (resourceUrl.protocol === 'https:' ? 443 : 80);
-      } catch (error) {
-        logger.warn(`Failed to parse resourceUri for port, using default 3000`);
+      // Extract port: explicit config > process.env.PORT > resourceUri explicit port > default 3000
+      let port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
+      if (oauthConfig.resourceUri) {
+        try {
+          const resourceUrl = new URL(oauthConfig.resourceUri);
+          if (resourceUrl.port) {
+            port = parseInt(resourceUrl.port, 10);
+          }
+        } catch (error) {
+          logger.warn(`Failed to parse resourceUri for port, using default ${port}`);
+        }
+      }
+      
+      // Override with process.env.PORT if set (environment takes precedence over resourceUri URL)
+      if (process.env.PORT) {
+        port = parseInt(process.env.PORT, 10);
       }
       
       // Override with explicit config if provided
```

---

### Incident Patch 5: `b79ebf31` (2026-09-03)
**Commit Message**: refactor: decouple task storage by introducing a pluggable TaskStore interface and default InMemoryTaskStore implementation

**File**: `typescript/packages/core/src/core/task.ts` (modified, +100/-33)
```diff
@@ -132,51 +132,106 @@ export interface TaskEntry {
     sessionId?: string;
 }
 
+// ============================================================================
+// Pluggable Task Store Abstraction
+// ============================================================================
+
+/**
+ * TaskStore interface for abstracting task state storage.
+ * Defaults to InMemoryTaskStore and allows drop-in distributed backends (Redis, PostgreSQL, DynamoDB)
+ * to support multi-replica horizontally scaled deployments.
+ */
+export interface TaskStore {
+    get(taskId: string): TaskEntry | undefined;
+    set(taskId: string, entry: TaskEntry): void;
+    delete(taskId: string): boolean;
+    has(taskId: string): boolean;
+    list(): TaskEntry[];
+    cleanupExpired?(now: number): number;
+    destroy?(): void;
+}
+
+/**
+ * In-memory implementation of TaskStore.
+ */
+export class InMemoryTaskStore implements TaskStore {
+    private tasks: Map<string, TaskEntry> = new Map();
+
+    get(taskId: string): TaskEntry | undefined {
+        return this.tasks.get(taskId);
+    }
+
+    set(taskId: string, entry: TaskEntry): void {
+        this.tasks.set(taskId, entry);
+    }
+
+    delete(taskId: string): boolean {
+        return this.tasks.delete(taskId);
+    }
+
+    has(taskId: string): boolean {
+        return this.tasks.has(taskId);
+    }
+
+    list(): TaskEntry[] {
+        return Array.from(this.tasks.values());
+    }
+
+    cleanupExpired(now: number): number {
+        let count = 0;
+        for (const [taskId, entry] of this.tasks.entries()) {
+            if (entry.data.ttl === null) continue;
+            if (!isTerminalStatus(entry.data.status)) continue;
+            const terminalTime = new Date(entry.data.lastUpdatedAt).getTime();
+            if (now - terminalTime > entry.data.ttl) {
+                this.tasks.delete(taskId);
+                count++;
+            }
+        }
+        return count;
+    }
+
+    destroy(): void {
+        this.tasks.clear();
+    }
+}
+
 // ============================================================================
 // Task Manager
 // ============================================================================
 
+export interface TaskManagerOptions {
+    logger: Logger;
+    /** Custom pluggable task store (default: InMemoryTaskStore) */
+    store?: TaskStore;
+    /** Default TTL in ms (default: 300000 = 5 minutes) */
+    defaultTtl?: number;
+    /** Default poll interval in ms (default: 2000 = 2 seconds) */
+    defaultPollInterval?: number;
+    /** Callback fired on every status change (for notifications) */
+    onStatusChange?: (taskData: TaskData) => void;
+}
+
 /**
  * TaskManager handles the full lifecycle of MCP tasks.
  * 
  * It provides:
- * - In-memory task storage with TTL-based cleanup
+ * - Pluggable task storage (in-memory or distributed) with TTL cleanup
  * - Task creation, status updates, and result retrieval
  * - Cancellation support
  * - Status change notifications via callbacks
- * 
- * @example
- * ```typescript
- * const taskManager = new TaskManager({ logger, defaultTtl: 60000 });
- * 
- * // Create a task for a long-running operation
- * const task = taskManager.createTask({ ttl: 120000 });
- * 
- * // Update status as work progresses
- * taskManager.updateStatus(task.taskId, 'working', 'Processing step 2 of 5');
- * 
- * // Complete with result
- * taskManager.completeTask(task.taskId, { data: 'result' });
- * ```
  */
 export class TaskManager {
-    private tasks: Map<string, TaskEntry> = new Map();
+    private store: TaskStore;
     private logger: Logger;
     private defaultTtl: number;
     private defaultPollInterval: number;
     private cleanupInterval?: ReturnType<typeof setInterval>;
     private onStatusChange?: (taskData: TaskData) => void;
 
-    constructor(options: {
-        logger: Logger;
-        /** Default TTL in ms (default: 300000 = 5 minutes) */
-        defaultTtl?: number;
-        /** Default poll interval in ms (d
```

---

### Incident Patch 6: `764e5684` (2026-09-03)
**Commit Message**: fix: prevent task status updates for cancelled tasks and add integration suite for MCP tasks protocol

**File**: `typescript/packages/core/src/core/__tests__/protocol-2026/tasks.integration.test.ts` (added, +378/-0)
```diff
@@ -0,0 +1,378 @@
+/**
+ * Modern (2026-07-28) MCP Tasks Protocol Integration Test Suite.
+ *
+ * Verifies end-to-end task lifecycle, multi-tenant isolation, cooperative abort,
+ * and single-step embedded result delivery over the modern protocol adapter.
+ */
+
+import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
+import { NitroStackServer } from '../../server.js';
+import { Tool } from '../../tool.js';
+import { z } from 'zod';
+
+const MODERN = '2026-07-28';
+const META_PROTOCOL = 'io.modelcontextprotocol/protocolVersion';
+const META_CLIENT_CAPS = 'io.modelcontextprotocol/clientCapabilities';
+const META_CLIENT_INFO = 'io.modelcontextprotocol/clientInfo';
+
+interface RpcResult {
+  status: number;
+  headers: Headers;
+  body: {
+    jsonrpc?: string;
+    id?: unknown;
+    result?: Record<string, any>;
+    error?: { code: number; message: string; data?: unknown };
+  };
+}
+
+function createModernRequest(
+  method: string,
+  params: Record<string, unknown> = {},
+  options: {
+    id?: number | string;
+    clientName?: string;
+    protocolVersion?: string;
+    toolName?: string;
+    extraHeaders?: Record<string, string>;
+    auth?: { userId?: string; tenantId?: string; sessionId?: string };
+  } = {},
+): Request {
+  const envelope = {
+    [META_PROTOCOL]: options.protocolVersion ?? MODERN,
+    [META_CLIENT_CAPS]: {},
+    [META_CLIENT_INFO]: { name: options.clientName ?? 'jest-modern-task-client', version: '1.0.0' },
+  };
+
+  const body = {
+    jsonrpc: '2.0',
+    id: options.id ?? 1,
+    method,
+    params: {
+      ...params,
+      _meta: envelope,
+    },
+  };
+
+  const headers: Record<string, string> = {
+    'Content-Type': 'application/json',
+    Accept: 'application/json',
+    'MCP-Protocol-Version': options.protocolVersion ?? MODERN,
+    'Mcp-Method': method,
+    ...(options.toolName ? { 'Mcp-Name': options.toolName } : {}),
+    ...(options.auth?.sessionId ? { 'Mcp-Session-Id': options.auth.sessionId } : {}),
+    ...(options.extraHeaders ?? {}),
+  };
+
+  const req = new Request('http://localhost/mcp', {
+    method: 'POST',
+    headers,
+    body: JSON.stringify(body),
+  });
+
+  if (options.auth) {
+    (req as any).auth = {
+      userId: options.auth.userId,
+      tenantId: options.auth.tenantId,
+    };
+  }
+
+  return req;
+}
+
+async function readRpc(res: Response): Promise<RpcResult> {
+  const text = await res.text();
+  try {
+    return { status: res.status, headers: res.headers, body: JSON.parse(text) };
+  } catch {
+    return { status: res.status, headers: res.headers, body: {} };
+  }
+}
+
+describe('Modern MCP 2.0 Tasks Protocol Integration Suite', () => {
+  let server: NitroStackServer;
+  let handler: { fetch: (req: Request) => Promise<Response>; close: () => Promise<void> };
+
+  beforeAll(async () => {
+    server = new NitroStackServer({
+      name: 'modern-task-test-server',
+      version: '1.0.0',
+      protocolVersion: MODERN,
+    });
+
+    // 1. Long running task tool with progress updates
+    server.tool(
+      new Tool({
+        name: 'data_pipeline',
+        description: 'Multi-stage data pipeline',
+        inputSchema: z.object({
+          stages: z.number().default(3),
+          stageDelayMs: z.number().default(30),
+        }),
+        taskSupport: 'optional',
+        handler: async (args: any, ctx) => {
+          const totalStages = args.stages ?? 3;
+          const delay = args.stageDelayMs ?? 30;
+
+          for (let i = 1; i <= totalStages; i++) {
+            if (ctx?.task) {
+              ctx.task.throwIfCancelled();
+              await ctx.task.updateProgress(`Processing stage ${i}/${totalStages}`);
+            }
+            await new Promise((r) => setTimeout(r, delay));
+          }
+
+          return {
+            stagesCompleted: totalStages,
+            outputRecords: 42,
+          };
+        },
+      }),
+    );
+
+    // 2. Mandatory task tool
+    server.tool(
+      new Tool({
+     
```

**File**: `typescript/packages/core/src/core/protocol/modern-v2.adapter.ts` (modified, +12/-2)
```diff
@@ -772,9 +772,19 @@ export class ModernProtocolAdapter implements ProtocolAdapter {
         Promise.resolve().then(async () => {
           try {
             const toolResult = await tool.execute(params.arguments || {}, executionContext);
-            tm.completeTask(taskId, toolResult, undefined, accessContext);
+            if (tm.hasTask(taskId)) {
+              const current = tm.getTask(taskId);
+              if (current.status !== 'cancelled') {
+                tm.completeTask(taskId, toolResult, undefined, accessContext);
+              }
+            }
           } catch (err: any) {
-            tm.failTask(taskId, { code: err.code || -32603, message: err.message || String(err) }, undefined, accessContext);
+            if (tm.hasTask(taskId)) {
+              const current = tm.getTask(taskId);
+              if (current.status !== 'cancelled') {
+                tm.failTask(taskId, { code: err.code || -32603, message: err.message || String(err) }, undefined, accessContext);
+              }
+            }
           }
         });
 
```

---

### Incident Patch 7: `eebfeef3` (2026-09-01)
**Commit Message**: fix(core): match clean widget filename when resolving bundled html files

**File**: `typescript/packages/core/src/core/server.ts` (modified, +27/-32)
```diff
@@ -437,40 +437,35 @@ export class NitroStackServer {
       handler: async (uri: string, context) => {
         context.logger.info(`Serving component: ${uri}`);
 
-        // In production, serve the bundled HTML file if available
-        if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'prod') {
-          try {
-            // Check if we have a bundled file for this component
-            // The component ID usually matches the widget output name
-            const widgetId = component.id;
-            // We need to find where the widgets are located relative to the running server
-            // In production, we expect them in src/widgets/out or dist/widgets/out
-
-            // Try to find the bundled file
-            const fs = await import('fs');
-            const path = await import('path');
-
-            // Possible locations for bundled widgets
-            const possiblePaths = [
-              path.join(process.cwd(), 'src/widgets/out', `${widgetId}.html`),
-              path.join(process.cwd(), 'dist/widgets/out', `${widgetId}.html`),
-              path.join(process.cwd(), 'widgets/out', `${widgetId}.html`)
-            ];
-
-            for (const p of possiblePaths) {
-              if (fs.existsSync(p)) {
-                const html = fs.readFileSync(p, 'utf-8');
-                return {
-                  type: 'text' as const,
-                  data: html
-                };
-              }
+        // Serve the bundled HTML file if available
+        try {
+          const widgetId = component.id;
+          const cleanId = widgetId.replace(/^next-/, '');
+          const fs = await import('fs');
+          const path = await import('path');
+
+          const possiblePaths = [
+            path.join(process.cwd(), 'src/widgets/out', `${cleanId}.html`),
+            path.join(process.cwd(), 'src/widgets/out', `${widgetId}.html`),
+            path.join(process.cwd(), 'dist/widgets/out', `${cleanId}.html`),
+            path.join(process.cwd(), 'dist/widgets/out', `${widgetId}.html`),
+            path.join(process.cwd(), 'widgets/out', `${cleanId}.html`),
+            path.join(process.cwd(), 'widgets/out', `${widgetId}.html`),
+          ];
+
+          for (const p of possiblePaths) {
+            if (fs.existsSync(p)) {
+              const html = fs.readFileSync(p, 'utf-8');
+              return {
+                type: 'text' as const,
+                data: html,
+              };
             }
-
-            context.logger.warn(`Bundled widget not found for ${widgetId}, falling back to default bundle`);
-          } catch (error) {
-            context.logger.error(`Error serving bundled widget: ${error}`);
           }
+
+          context.logger.warn(`Bundled widget not found for ${widgetId} (${cleanId}), falling back to default bundle`);
+        } catch (error) {
+          context.logger.error(`Error serving bundled widget: ${error}`);
         }
 
         return {
```

---

### Incident Patch 8: `bd739c4b` (2026-09-01)
**Commit Message**: fix(core): add ping handler to modern adapter for client heartbeat and connection monitoring

**File**: `typescript/packages/core/src/core/protocol/modern-v2.adapter.ts` (modified, +35/-1)
```diff
@@ -562,12 +562,35 @@ export class ModernProtocolAdapter implements ProtocolAdapter {
   async getHttpHandler(): Promise<AnyRecord> {
     if (!this.handler) {
       const sdk = await this.loadServerSdk();
-      this.handler = sdk.createMcpHandler(() => this.buildServer(), {
+      const rawHandler = sdk.createMcpHandler(() => this.buildServer(), {
         legacy: this.options.legacyMode,
         onerror: (error: Error) => {
           this.registry.logger.error('Modern MCP handler error', { error: error.message });
         },
       });
+
+      const rawFetch = rawHandler.fetch;
+      this.handler = {
+        ...rawHandler,
+        fetch: async (request: Request, requestOptions?: AnyRecord) => {
+          if (request.headers.get('mcp-method') === 'ping') {
+            try {
+              const clone = request.clone();
+              const json = (await clone.json()) as AnyRecord;
+              return new Response(JSON.stringify({ jsonrpc: '2.0', id: json?.id ?? null, result: {} }), {
+                status: 200,
+                headers: { 'Content-Type': 'application/json' },
+              });
+            } catch {
+              return new Response(JSON.stringify({ jsonrpc: '2.0', id: null, result: {} }), {
+                status: 200,
+                headers: { 'Content-Type': 'application/json' },
+              });
+            }
+          }
+          return rawFetch(request, requestOptions);
+        },
+      };
     }
     return this.handler;
   }
@@ -589,6 +612,17 @@ export class ModernProtocolAdapter implements ProtocolAdapter {
           ? (req as AnyRecord).body
           : undefined;
 
+      // Handle ping directly for studio heartbeat / health monitoring
+      if (parsedBody && parsedBody.method === 'ping') {
+        res.setHeader('Content-Type', 'application/json');
+        res.status(200).json({
+          jsonrpc: '2.0',
+          id: parsedBody.id ?? null,
+          result: {},
+        });
+        return;
+      }
+
       Promise.resolve(nodeHandler(req, res, parsedBody)).catch((err: unknown) => {
         this.registry.logger.error('Modern MCP request failed', {
           error: err instanceof Error ? err.message : String(err),
```

---

### Incident Patch 9: `d6dde4cc` (2026-09-01)
**Commit Message**: fix(core): preserve widget metadata on modern tool registration and support custom widget resource URIs

**File**: `typescript/packages/core/src/core/protocol/modern-v2.adapter.ts` (modified, +101/-1)
```diff
@@ -126,8 +126,51 @@ export class ModernProtocolAdapter implements ProtocolAdapter {
       if (outputSchema) config.outputSchema = outputSchema;
       if (tool.annotations) config.annotations = tool.annotations;
 
+      const meta: AnyRecord = {};
       const cacheHint = resolveToolCacheHint(tool);
-      if (cacheHint) config._meta = { 'io.modelcontextprotocol/cacheHint': cacheHint };
+      if (cacheHint) meta['io.modelcontextprotocol/cacheHint'] = cacheHint;
+
+      if (tool.hasComponent && tool.hasComponent()) {
+        const component = tool.getComponent()!;
+        const resourceUri = component.getResourceUri();
+        const componentMeta = component.getResourceMetadata() as Record<string, unknown> | undefined;
+
+        meta['ui/template'] = resourceUri;
+        meta['openai/outputTemplate'] = resourceUri;
+        meta['ui'] = { resourceUri };
+        if (componentMeta) {
+          if (componentMeta['openai/widgetCSP'] !== undefined) {
+            meta['openai/widgetCSP'] = componentMeta['openai/widgetCSP'];
+          }
+          if (componentMeta['openai/widgetDescription'] !== undefined) {
+            meta['openai/widgetDescription'] = componentMeta['openai/widgetDescription'];
+          }
+          if (componentMeta['openai/widgetPrefersBorder'] !== undefined) {
+            meta['openai/widgetPrefersBorder'] = componentMeta['openai/widgetPrefersBorder'];
+          }
+          if (componentMeta['openai/widgetDomain'] !== undefined) {
+            meta['openai/widgetDomain'] = componentMeta['openai/widgetDomain'];
+          }
+        }
+      } else if (tool.widget?.route || tool.outputTemplate) {
+        const route = tool.widget?.route || tool.outputTemplate;
+        const normalized = route?.startsWith('/') ? route : `/${route}`;
+        const resourceUri = `/widgets${normalized}`;
+        meta['ui/template'] = resourceUri;
+        meta['openai/outputTemplate'] = resourceUri;
+        meta['ui'] = { resourceUri };
+      }
+
+      if (tool.examples) {
+        meta['tool/examples'] = tool.examples;
+      }
+      if (tool.isInitial) {
+        meta['tool/initial'] = true;
+      }
+
+      if (Object.keys(meta).length > 0) {
+        config._meta = meta;
+      }
 
       server.registerTool(
         tool.name,
@@ -189,6 +232,63 @@ export class ModernProtocolAdapter implements ProtocolAdapter {
         });
       }
     }
+
+    // Modern SDK v2 strictly validates URIs using `new URL(uri)`. To support custom
+    // or relative URI schemes such as `/widgets/*` used by NitroStudio and MCP Apps,
+    // attach a fallback resources/read handler on the underlying MCP server.
+    if (server.server && typeof server.server.setRequestHandler === 'function') {
+      const rawResources = this.registry.getResources();
+      server.server.setRequestHandler('resources/read', async (request: AnyRecord, ctx: AnyRecord) => {
+        const reqUri = String(request?.params?.uri ?? '');
+        // 1. Check exact match in registered resources (including path-based URIs like /widgets/...)
+        const matchingResource = rawResources.get(reqUri);
+        if (matchingResource) {
+          const resResult = await this.readResource(reqUri, matchingResource, sdk);
+          const cacheHint = resolveResourceCacheHint(matchingResource);
+          if (cacheHint) {
+            return { ...resResult, cacheHint };
+          }
+          return resResult;
+        }
+
+        // 2. Try URL parsing for standard schemes (mcp://, ui://, http://)
+        let parsedUrl: URL | undefined;
+        try {
+          parsedUrl = new URL(reqUri);
+        } catch {
+          // If not parseable as standard URL, check if any resource matches
+          for (const [uri, res] of rawResources.entries()) {
+            if (uri === reqUri || uri.endsWith(reqUri) || reqUri.endsWith(uri)) {
+              return this.readResource(reqUri, res, sdk);
+            }
+          }
+        }
+
+        if (parsedUrl) {
+   
```

---

### Incident Patch 10: `9e35ad2c` (2026-09-01)
**Commit Message**: fix(core): pass parsed req.body to modern node handler to support Express json middleware

**File**: `typescript/packages/core/src/core/protocol/modern-v2.adapter.ts` (modified, +12/-1)
```diff
@@ -478,7 +478,18 @@ export class ModernProtocolAdapter implements ProtocolAdapter {
 
     const nodeHandler = node.toNodeHandler(handler);
     return (req: ExpressRequest, res: ExpressResponse) => {
-      Promise.resolve(nodeHandler(req, res)).catch((err: unknown) => {
+      // Express bodyParser/json middleware may have already consumed the request
+      // stream and populated `req.body`. Pass `req.body` so `toWebRequest` uses
+      // the parsed body rather than reading an already-drained request stream.
+      const parsedBody =
+        (req as AnyRecord).body !== undefined &&
+        (req as AnyRecord).body !== null &&
+        typeof (req as AnyRecord).body === 'object' &&
+        Object.keys((req as AnyRecord).body).length > 0
+          ? (req as AnyRecord).body
+          : undefined;
+
+      Promise.resolve(nodeHandler(req, res, parsedBody)).catch((err: unknown) => {
         this.registry.logger.error('Modern MCP request failed', {
           error: err instanceof Error ? err.message : String(err),
         });
```

#### Recent Merged Pull Requests:
- **PR #348** (2026-09-24): fix(deps): pin ext-apps to 1.x so template installs stay on Zod 3 (@hemantj-cloud)
- **PR #346** (closed): fix(core): attach input to ExecutionContext for middleware and interceptors (@xiechimon)
- **PR #344** (2026-09-07): feat(core): implement MCP 2026-07-28 stateless protocol, task management, CIMD/OAuth 2.1 hardening, and MRTR support (@hemantj-cloud)
- **PR #341** (2026-08-28): chore(sample-apps): remove non-working and invalid sample applications (@hemantj-cloud)
- **PR #340** (2026-08-28): fix(sample-apps): resolve case-collision between README.md and readme.md (@hemantj-cloud)
- **PR #339** (2026-08-28): feat(widgets): implement RPC methods in polyfill and enhance sendFollowUpMessage payload support (@hemantj-cloud)
- **PR #337** (2026-08-25): fix(core): propagate HTTP Authorization header and params._meta into tool ExecutionContext (@hemantj-cloud)
- **PR #306** (closed): [Hackathon] VectorPoint - Autonomous-Medical-Imaging-Diagnosis-Clinical-Decision-Agent (@SouryaneelPal)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
