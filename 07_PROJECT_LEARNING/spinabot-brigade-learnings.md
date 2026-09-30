# Forensic Learning Record (Deep Inspection): spinabot/brigade

> **Canonical Artifact**: `07_PROJECT_LEARNING/spinabot-brigade-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/spinabot/brigade](https://github.com/spinabot/brigade))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:56:36.415Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `spinabot/brigade`
- **Description**: Brigade — Your personal intelligence, built enterprise-grade
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 10602 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `brigade.mjs`
```
#!/usr/bin/env node
// Brigade entry shim. The bin file is small on purpose; src/entry.ts
// (compiled to dist/entry.js) does the real work.
//
// Three responsibilities live here intentionally:
//
//   1. Reject unsupported Node versions before anything else loads. Pi SDK
//      uses `using` / `AsyncDisposable` and other 22.12+ features, and Node
//      18/20 will fail with a confusing SyntaxError far from the cause.
//
//   2. Enable Node's compile cache as early as possible to trim warm-start
//      latency for the CLI. entry.ts re-enables defensively in case this
//      shim is bypassed.
//
//   3. Filter known-noisy process warnings (DEP0040 punycode, DEP0060
//      util._extend, SQLite ExperimentalWarning) so they don't drown the
//      real signal on every invocation.
//
//   4. Dispatch to dist/entry.js with proper direct-vs-transitive
//      ERR_MODULE_NOT_FOUND distinction.
//
// dist-only by design — no tsx fallback. For dev iteration use
// `npm run dev`, which routes through scripts/run-brigade.mjs (the smart
// dev runner that builds-then-runs).

import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import { access } from "node:fs/promises";

const MIN_NODE = { major: 22, minor: 12 };

function ensureSupportedNodeVersion() {
  const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(process.versions.node);
  if (!m) return;
  const major = Number(m[1]);
  const minor = Number(m[2]);
  if (
    major > MIN_NODE.major ||
    (major === MIN_NODE.major && minor >= MIN_NODE.minor)
  ) {
    return;
  }
  process.stderr.write(
    `brigade requires Node ${MIN_NODE.major}.${MIN_NODE.minor} or newer ` +
      `(running ${process.versions.node}).\n` +
      `If you're on nvm: \`nvm install ${MIN_NODE.major}\` then \`nvm use ${MIN_NODE.major}\`.\n`,
  );
  process.exit(1);
}

ensureSupportedNodeVersion();

try {
  const mod = await import("node:module");
  if (typeof mod.enableCompileCache === "function" && !process.env.NODE_DISABLE_COMPILE_CACHE) {
    mod.enableCompileCache();
  }
} catch {
  // Older Node minors silently skip — not fatal.
}

function shouldIgnoreWarning(warning) {
  if (warning.code === "DEP0040" && warning.message?.includes("punycode")) {
    return true;
  }
  if (warning.code === "DEP0060" && warning.message?.includes("util._extend")) {
    return true;
  }
  if (
    warning.name === "ExperimentalWarning" &&
    warning.message?.includes("SQLite is an experimental feature")
  ) {
    return true;
  }
  return false;
}

function normalizeWarningArgs(args) {
  const [first, second, third] = args;
  let name;
  let code;
  let message;
  if (first instanceof Error) {
    name = first.name;
    message = first.message;
    code = first.code;
  } else if (typeof first === "string") {
    message = first;
  }
  if (second && typeof second === "object" && !Array.isArray(second)) {
    if (typeof second.type === "string") name = second.type;
    if (typeof second.code === "string") code = second.code;
  } else {
    if (typeof second === "string") name = second;
    if (typeof third === "string") code = third;
  }
  return { name, code, message };
}

function installProcessWarningFilter() {
  const original = process.emitWarning.bind(process);
  process.emitWarning = (...args) => {
    if (shouldIgnoreWarning(normalizeWarningArgs(args))) return;
    original(...args);
  };
}

installProcessWarningFilter();

const here = dirname(fileURLToPath(import.meta.url));
const distEntry = join(here, "dist", "entry.js");
const srcEntry = join(here, "src", "entry.ts");

// Distinguish "the entry file itself is missing" from "the entry loaded but
// hit ERR_MODULE_NOT_FOUND on a transitive import". Without this, a real
// dependency-resolution bug would silently turn into "missing dist" and the
// user would chase the wrong error.
function isDirectMissing(err, specifierUrl) {
  if (!err || typeof err !== "object" || err.code !== "ERR_MODULE_NOT_FOUND") {
    return false;
  }
  if (err.url === specifierUrl.href) return true;
  const expected = fileURLToPath(specifierUrl);
  const message = typeof err.message === "string" ? err.message : "";
  return (
    message.includes(`Cannot find module '${expected}'`) ||
    message.includes(`Cannot find module "${expected}"`)
  );
}

async function tryImport(filePath) {
  const url = pathToFileURL(filePath);
  try {
    await import(url.href);
    return true;
  } catch (err) {
    if (isDirectMissing(err, url)) return false;
    throw err;
  }
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function buildMissingEntryError() {
  const lines = ["brigade: missing dist/entry.js (build output)."];
  if (existsSync(srcEntry)) {
    lines.push("This install looks like an unbuilt source tree or GitHub source archive.");
    lines.push("Build locally: `npm install && npm run build`,");
    lines.push("or for development: `npm run dev <args>` (uses the smart dev runner).");
    lines.push("For releases, install from npm: `npm install -g @spinabot/brigade`.");
  } else {
    lines.push("Reinstall brigade: `npm install -g @spinabot/brigade`.");
  }
  return lines.join("\n");
}

if (await exists(distEntry)) {
  if (!(await tryImport(distEntry))) {
    process.stderr.write(`${buildMissingEntryError()}\n`);
    process.exit(1);
  }
} else {
  process.stderr.write(`${buildMissingEntryError()}\n`);
  process.exit(1);
}

```

### Core Architecture Module: `convex/_generated/api.d.ts`
```
/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as auth from "../auth.js";
import type * as blobs from "../blobs.js";
import type * as channels from "../channels.js";
import type * as collaboration from "../collaboration.js";
import type * as config from "../config.js";
import type * as cron from "../cron.js";
import type * as execApprovals from "../execApprovals.js";
import type * as extensions from "../extensions.js";
import type * as health from "../health.js";
import type * as instance from "../instance.js";
import type * as logs from "../logs.js";
import type * as memory from "../memory.js";
import type * as messages from "../messages.js";
import type * as org from "../org.js";
import type * as sessions from "../sessions.js";
import type * as skills from "../skills.js";
import type * as subagents from "../subagents.js";
import type * as whatsappAuth from "../whatsappAuth.js";
import type * as workspace from "../workspace.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  auth: typeof auth;
  blobs: typeof blobs;
  channels: typeof channels;
  collaboration: typeof collaboration;
  config: typeof config;
  cron: typeof cron;
  execApprovals: typeof execApprovals;
  extensions: typeof extensions;
  health: typeof health;
  instance: typeof instance;
  logs: typeof logs;
  memory: typeof memory;
  messages: typeof messages;
  org: typeof org;
  sessions: typeof sessions;
  skills: typeof skills;
  subagents: typeof subagents;
  whatsappAuth: typeof whatsappAuth;
  workspace: typeof workspace;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};

```

### Core Architecture Module: `convex/_generated/api.js`
```
/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import { anyApi, componentsGeneric } from "convex/server";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export const api = anyApi;
export const internal = anyApi;
export const components = componentsGeneric();

```

### Core Architecture Module: `convex/_generated/dataModel.d.ts`
```
/* eslint-disable */
/**
 * Generated data model types.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  DataModelFromSchemaDefinition,
  DocumentByName,
  TableNamesInDataModel,
  SystemTableNames,
} from "convex/server";
import type { GenericId } from "convex/values";
import schema from "../schema.js";

/**
 * The names of all of your Convex tables.
 */
export type TableNames = TableNamesInDataModel<DataModel>;

/**
 * The type of a document stored in Convex.
 *
 * @typeParam TableName - A string literal type of the table name (like "users").
 */
export type Doc<TableName extends TableNames> = DocumentByName<
  DataModel,
  TableName
>;

/**
 * An identifier for a document in Convex.
 *
 * Convex documents are uniquely identified by their `Id`, which is accessible
 * on the `_id` field. To learn more, see [Document IDs](https://docs.convex.dev/using/document-ids).
 *
 * Documents can be loaded using `db.get(tableName, id)` in query and mutation functions.
 *
 * IDs are just strings at runtime, but this type can be used to distinguish them from other
 * strings when type checking.
 *
 * @typeParam TableName - A string literal type of the table name (like "users").
 */
export type Id<TableName extends TableNames | SystemTableNames> =
  GenericId<TableName>;

/**
 * A type describing your Convex data model.
 *
 * This type includes information about what tables you have, the type of
 * documents stored in those tables, and the indexes defined on them.
 *
 * This type is used to parameterize methods like `queryGeneric` and
 * `mutationGeneric` to make them type-safe.
 */
export type DataModel = DataModelFromSchemaDefinition<typeof schema>;

```

### Core Architecture Module: `convex/_generated/server.d.ts`
```
/* eslint-disable */
/**
 * Generated utilities for implementing server-side Convex query and mutation functions.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import {
  ActionBuilder,
  HttpActionBuilder,
  MutationBuilder,
  QueryBuilder,
  GenericActionCtx,
  GenericMutationCtx,
  GenericQueryCtx,
  GenericDatabaseReader,
  GenericDatabaseWriter,
} from "convex/server";
import type { DataModel } from "./dataModel.js";

/**
 * Define a query in this Convex app's public API.
 *
 * This function will be allowed to read your Convex database and will be accessible from the client.
 *
 * @param func - The query function. It receives a {@link QueryCtx} as its first argument.
 * @returns The wrapped query. Include this as an `export` to name it and make it accessible.
 */
export declare const query: QueryBuilder<DataModel, "public">;

/**
 * Define a query that is only accessible from other Convex functions (but not from the client).
 *
 * This function will be allowed to read from your Convex database. It will not be accessible from the client.
 *
 * @param func - The query function. It receives a {@link QueryCtx} as its first argument.
 * @returns The wrapped query. Include this as an `export` to name it and make it accessible.
 */
export declare const internalQuery: QueryBuilder<DataModel, "internal">;

/**
 * Define a mutation in this Convex app's public API.
 *
 * This function will be allowed to modify your Convex database and will be accessible from the client.
 *
 * @param func - The mutation function. It receives a {@link MutationCtx} as its first argument.
 * @returns The wrapped mutation. Include this as an `export` to name it and make it accessible.
 */
export declare const mutation: MutationBuilder<DataModel, "public">;

/**
 * Define a mutation that is only accessible from other Convex functions (but not from the client).
 *
 * This function will be allowed to modify your Convex database. It will not be accessible from the client.
 *
 * @param func - The mutation function. It receives a {@link MutationCtx} as its first argument.
 * @returns The wrapped mutation. Include this as an `export` to name it and make it accessible.
 */
export declare const internalMutation: MutationBuilder<DataModel, "internal">;

/**
 * Define an action in this Convex app's public API.
 *
 * An action is a function which can execute any JavaScript code, including non-deterministic
 * code and code with side-effects, like calling third-party services.
 * They can be run in Convex's JavaScript environment or in Node.js using the "use node" directive.
 * They can interact with the database indirectly by calling queries and mutations using the {@link ActionCtx}.
 *
 * @param func - The action. It receives an {@link ActionCtx} as its first argument.
 * @returns The wrapped action. Include this as an `export` to name it and make it accessible.
 */
export declare const action: ActionBuilder<DataModel, "public">;

/**
 * Define an action that is only accessible from other Convex functions (but not from the client).
 *
 * @param func - The function. It receives an {@link ActionCtx} as its first argument.
 * @returns The wrapped function. Include this as an `export` to name it and make it accessible.
 */
export declare const internalAction: ActionBuilder<DataModel, "internal">;

/**
 * Define an HTTP action.
 *
 * The wrapped function will be used to respond to HTTP requests received
 * by a Convex deployment if the requests matches the path and method where
 * this action is routed. Be sure to route your httpAction in `convex/http.js`.
 *
 * @param func - The function. It receives an {@link ActionCtx} as its first argument
 * and a Fetch API `Request` object as its second.
 * @returns The wrapped function. Import this function from `convex/http.js` and route it to hook it up.
 */
export declare const httpAction: HttpActionBuilder;

/**
 * A set of services for use within Convex query functions.
 *
 * The query context is passed as the first argument to any Convex query
 * function run on the server.
 *
 * This differs from the {@link MutationCtx} because all of the services are
 * read-only.
 */
export type QueryCtx = GenericQueryCtx<DataModel>;

/**
 * A set of services for use within Convex mutation functions.
 *
 * The mutation context is passed as the first argument to any Convex mutation
 * function run on the server.
 */
export type MutationCtx = GenericMutationCtx<DataModel>;

/**
 * A set of services for use within Convex action functions.
 *
 * The action context is passed as the first argument to any Convex action
 * function run on the server.
 */
export type ActionCtx = GenericActionCtx<DataModel>;

/**
 * An interface to read from the database within Convex query functions.
 *
 * The two entry points are {@link DatabaseReader.get}, which fetches a single
 * document by its {@link Id}, or {@link DatabaseReader.query}, which starts
 * building a query.
 */
export type DatabaseReader = GenericDatabaseReader<DataModel>;

/**
 * An interface to read from and write to the database within Convex mutation
 * functions.
 *
 * Convex guarantees that all writes within a single mutation are
 * executed atomically, so you never have to worry about partial writes leaving
 * your data in an inconsistent state. See [the Convex Guide](https://docs.convex.dev/understanding/convex-fundamentals/functions#atomicity-and-optimistic-concurrency-control)
 * for the guarantees Convex provides your functions.
 */
export type DatabaseWriter = GenericDatabaseWriter<DataModel>;

```

### Core Architecture Module: `convex/_generated/server.js`
```
/* eslint-disable */
/**
 * Generated utilities for implementing server-side Convex query and mutation functions.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import {
  actionGeneric,
  httpActionGeneric,
  queryGeneric,
  mutationGeneric,
  internalActionGeneric,
  internalMutationGeneric,
  internalQueryGeneric,
} from "convex/server";

/**
 * Define a query in this Convex app's public API.
 *
 * This function will be allowed to read your Convex database and will be accessible from the client.
 *
 * @param func - The query function. It receives a {@link QueryCtx} as its first argument.
 * @returns The wrapped query. Include this as an `export` to name it and make it accessible.
 */
export const query = queryGeneric;

/**
 * Define a query that is only accessible from other Convex functions (but not from the client).
 *
 * This function will be allowed to read from your Convex database. It will not be accessible from the client.
 *
 * @param func - The query function. It receives a {@link QueryCtx} as its first argument.
 * @returns The wrapped query. Include this as an `export` to name it and make it accessible.
 */
export const internalQuery = internalQueryGeneric;

/**
 * Define a mutation in this Convex app's public API.
 *
 * This function will be allowed to modify your Convex database and will be accessible from the client.
 *
 * @param func - The mutation function. It receives a {@link MutationCtx} as its first argument.
 * @returns The wrapped mutation. Include this as an `export` to name it and make it accessible.
 */
export const mutation = mutationGeneric;

/**
 * Define a mutation that is only accessible from other Convex functions (but not from the client).
 *
 * This function will be allowed to modify your Convex database. It will not be accessible from the client.
 *
 * @param func - The mutation function. It receives a {@link MutationCtx} as its first argument.
 * @returns The wrapped mutation. Include this as an `export` to name it and make it accessible.
 */
export const internalMutation = internalMutationGeneric;

/**
 * Define an action in this Convex app's public API.
 *
 * An action is a function which can execute any JavaScript code, including non-deterministic
 * code and code with side-effects, like calling third-party services.
 * They can be run in Convex's JavaScript environment or in Node.js using the "use node" directive.
 * They can interact with the database indirectly by calling queries and mutations using the {@link ActionCtx}.
 *
 * @param func - The action. It receives an {@link ActionCtx} as its first argument.
 * @returns The wrapped action. Include this as an `export` to name it and make it accessible.
 */
export const action = actionGeneric;

/**
 * Define an action that is only accessible from other Convex functions (but not from the client).
 *
 * @param func - The function. It receives an {@link ActionCtx} as its first argument.
 * @returns The wrapped function. Include this as an `export` to name it and make it accessible.
 */
export const internalAction = internalActionGeneric;

/**
 * Define an HTTP action.
 *
 * The wrapped function will be used to respond to HTTP requests received
 * by a Convex deployment if the requests matches the path and method where
 * this action is routed. Be sure to route your httpAction in `convex/http.js`.
 *
 * @param func - The function. It receives an {@link ActionCtx} as its first argument
 * and a Fetch API `Request` object as its second.
 * @returns The wrapped function. Import this function from `convex/http.js` and route it to hook it up.
 */
export const httpAction = httpActionGeneric;

```

### Core Architecture Module: `convex/admin.ts`
```
// convex/admin.ts — instance-level inspect + factory reset.
//
// Single-operator deployments hold exactly one Brigade instance, so "reset
// the instance" means "delete every row in every Brigade table" (plus any
// File-Storage objects rows point at). Used by the onboarding wizard's
// "start fresh" choice and the `brigade store reset` CLI.
//
// Deletion runs SERVER-SIDE and SELF-SCHEDULES (`resetStart` → `resetWorker`):
// a long-lived instance can hold hundreds of thousands of rows (cron runs,
// session events) and a single Convex mutation has op/time/byte limits, so each
// worker deletes one small batch then reschedules itself until its table drains.
// All tables drain concurrently; the client just polls `resetStatus`. The older
// client-paced `resetPage` is kept for back-compat / tests.

import { v } from "convex/values";
import { internal } from "./_generated/api.js";
import { internalMutation, mutation, query } from "./_generated/server.js";
import type { MutationCtx } from "./_generated/server.js";

// Every table in convex/schema.ts. Kept as an explicit literal union so a
// future schema addition that forgets to extend this list fails loudly in
// review rather than silently surviving a "factory reset".
const RESETTABLE_TABLES = [
	"brigadeConfig",
	"brigadeConfigAudit",
	"brigadeConfigBackups",
	"configHealth",
	"personaFiles",
	"workspaceState",
	"memoryFacts",
	"memoryExtractCursors",
	"memoryConsolidateState",
	"memoryEvents",
	"sessions",
	"sessionTranscriptRecords",
	"sessionInboxEvents",
	"sessionEvents",
	"subsystemLog",
	"cronJobs",
	"cronRuns",
	"cronServiceState",
	"channelAccess",
	"whatsappAuthFile",
	"channelMediaBlob",
	"authProfiles",
	"profileState",
	"authFiles",
	"systemMeta",
	"whatsappAuthCreds",
	"whatsappAuthKeys",
	"execApprovals",
	"skills",
	"extensions",
	"orgDeriveAudit",
	"orgChartCache",
	"subagentRuns",
	"gatewayCoord",
	"brigadeBlobs",
	"collaborationState",
	"collaborationRooms",
	"collaborationRuns",
	"collaborationTasks",
	"collaborationAttempts",
	"collaborationHandoffs",
	"collaborationApprovals",
	"collaborationArtifacts",
	"collaborationEvents",
	"collaborationOutbox",
	"collaborationCommandReceipts",
	"collaborationRoomSequences",
] as const;

export type ResettableTable = (typeof RESETTABLE_TABLES)[number];

const TableName = v.union(
	...RESETTABLE_TABLES.map((t) => v.literal(t)),
);

// Tables whose rows can point at File-Storage objects — the object must be
// deleted BEFORE the row or it becomes an orphan (storage isn't ref-counted).
const STORAGE_SPILL_TABLES = new Set<string>([
	"channelMediaBlob",
	"whatsappAuthKeys",
	"brigadeBlobs",
]);

// High-volume session/log/run tables probed (presence only, never counted) by
// instanceSummary so the "found an existing Brigade" headline doesn't imply an
// empty backend when thousands of event/log rows are actually present.
const ACTIVITY_TABLES = [
	"sessionEvents",
	"cronRuns",
	"subsystemLog",
	"sessionInboxEvents",
	"sessionTranscriptRecords",
	"subagentRuns",
	"collaborationEvents",
] as const;

/** The list the reset client iterates — exported via query so the CLI and
 *  the server can never drift on which tables exist. */
export const listResettableTables = query({
	args: {},
	handler: async () => [...RESETTABLE_TABLES],
});

/** Headline summary for "found an existing Brigade in this backend". */
export const instanceSummary = query({
	args: {},
	handler: async (ctx) => {
		const configRow = await ctx.db.query("brigadeConfig").first();
		const memories = await ctx.db.query("memoryFacts").take(1001);
		const sessions = await ctx.db.query("sessions").take(1001);
		const cronJobs = await ctx.db.query("cronJobs").take(1001);
		const personas = await ctx.db.query("personaFiles").take(1001);
		const waCreds = await ctx.db.query("whatsappAuthCreds").take(1);
		const fp = await ctx.db
			.query("systemMeta")
			.withIndex("by_key", (q) => q.eq("key", "encryptionFingerprint"))
			.first();
		// High-volume session/log/run tables hold the bulk of a long-lived
		// instance, but their rows can be large (event payloads, transcript chunks)
		// — counting them with .take(1001) could exceed the 16 MiB query read cap.
		// So we only PROBE for presence (take(1)) to report that history exists,
		// rather than imply "0" when thousands of rows are actually there.
		let hasActivity = false;
		for (const t of ACTIVITY_TABLES) {
			if ((await ctx.db.query(t).take(1)).length > 0) {
				hasActivity = true;
				break;
			}
		}
		const cap = (n: number): number => Math.min(n, 1000);
		return {
			hasData:
				configRow !== null ||
				memories.length > 0 ||
				sessions.length > 0 ||
				cronJobs.length > 0 ||
				personas.length > 0,
			createdAtMs: configRow?._creationTime ?? null,
			counts: {
				memories: cap(memories.length),
				sessions: cap(sessions.length),
				cronJobs: cap(cronJobs.length),
				personas: cap(personas.length),
			},
			hasActivity,
			whatsappLinked: waCreds.length > 0,
			storedKeyFingerprint: (fp?.value as string | undefined) ?? null,
		};
	},
});

/** Rough byte size of a row, for read-budgeting only. The sealed ArrayBuffer
 *  columns (transcript chunks, media, auth, blobs) dominate; everything else
 *  is tiny. This drives WHEN we stop reading more pages — the actual read cost
 *  is charged by Convex on each `.take()`. */
function estimateRowBytes(row: Record<string, unknown>): number {
	let n = 64; // per-row overhead
	for (const value of Object.values(row)) {
		if (value instanceof ArrayBuffer) n += value.byteLength;
		else if (typeof value === "string") n += value.length;
		else if (typeof value === "number" || typeof value === "boolean") n += 8;
		else if (value && typeof value === "object") n += JSON.stringify(value).length;
	}
	return n;
}

/** Delete ONE bounded batch from a table (reaping File-Storage spills first).
 *  Shared by the legacy client-paced `resetPage` and the server-scheduled
 *  `resetWorker`. Returns `{ deleted, done }`; `done` is true ONLY when the
 *  table is fully drained — the caller loops/reschedules while `!done`.
 *
 *  Two caps keep every batch comfortably under Convex's per-execution ceiling:
 *  a row cap (`maxRows`) and a byte cap (`READ_CEILING`). Convex KILLS a function
 *  that exceeds its op/time/byte budget, and that kill is not catchable inside
 *  the function — so the only robust defense is to keep each batch small and let
 *  the caller chain more. Large-row tables (transcript chunks, media, auth,
 *  blobs near the 1 MiB doc limit) trip the byte cap after a handful of rows;
 *  small-row tables clear up to `maxRows`. Deleted rows drop out of the next
 *  `.take()`, so we always read from the front with no cursor. */
async function drainOneBatch(
	ctx: MutationCtx,
	table: ResettableTable,
	maxRows: number,
	readCeiling = 4 * 1024 * 1024, // conservative default; legacy resetPage passes 6 MiB
): Promise<{ deleted: number; done: boolean }> {
	const INNER = 8; // small read window; deleted rows drop out of the next take()
	let removed = 0;
	let bytesRead = 0;
	let drained = false;
	let capped = false;
	while (removed < maxRows && !capped) {
		// Never read more than the batch still wants, so `removed` can't overshoot
		// `maxRows` by up to INNER-1.
		const want = Math.min(INNER, maxRows - removed);
		const rows = await ctx.db.query(table).take(want);
		for (const row of rows) {
			bytesRead += estimateRowBytes(row as unknown as Record<string, unknown>);
			if (STORAGE_SPILL_TABLES.has(table)) {
				const storageId = (row as { storageId?: string }).storageId;
				if (storageId) {
					try {
						await ctx.storage.delete(storageId as never);
					} catch {
						// Already gone — the row delete below still proceeds.
					}
				}
			}
			await ctx.db.delete(row._id);
			removed += 1;
			// Stop the MOMENT we cross the read budget — mid-pass, so a handful of
			// ~1 MiB rows can't blow ~INNER MiB past the cap before the next check.
			if (bytesRead >= readCeiling) {
				capped = tru
```

### Core Architecture Module: `convex/auth.d.ts`
```
export declare const listProfiles: import("convex/server").RegisteredQuery<"public", {
    agentId: string;
    ownerId: string;
}, Promise<{
    _id: import("convex/values").GenericId<"authProfiles">;
    _creationTime: number;
    metadata?: any;
    alias?: string | undefined;
    expires?: number | undefined;
    keyEnc?: ArrayBuffer | undefined;
    keyRef?: {
        id: string;
        source: string;
        provider: string;
    } | undefined;
    tokenEnc?: ArrayBuffer | undefined;
    tokenRef?: {
        id: string;
        source: string;
        provider: string;
    } | undefined;
    accessEnc?: ArrayBuffer | undefined;
    refreshEnc?: ArrayBuffer | undefined;
    type: "api_key" | "oauth" | "token";
    profileId: string;
    agentId: string;
    provider: string;
    updatedAt: number;
    ownerId: string;
}[]>>;
export declare const getProfile: import("convex/server").RegisteredQuery<"public", {
    profileId: string;
    agentId: string;
    ownerId: string;
}, Promise<{
    _id: import("convex/values").GenericId<"authProfiles">;
    _creationTime: number;
    metadata?: any;
    alias?: string | undefined;
    expires?: number | undefined;
    keyEnc?: ArrayBuffer | undefined;
    keyRef?: {
        id: string;
        source: string;
        provider: string;
    } | undefined;
    tokenEnc?: ArrayBuffer | undefined;
    tokenRef?: {
        id: string;
        source: string;
        provider: string;
    } | undefined;
    accessEnc?: ArrayBuffer | undefined;
    refreshEnc?: ArrayBuffer | undefined;
    type: "api_key" | "oauth" | "token";
    profileId: string;
    agentId: string;
    provider: string;
    updatedAt: number;
    ownerId: string;
} | null>>;
export declare const upsertProfile: import("convex/server").RegisteredMutation<"public", {
    metadata?: any;
    alias?: string | undefined;
    expires?: number | undefined;
    keyEnc?: ArrayBuffer | undefined;
    keyRef?: {
        id: string;
        source: string;
        provider: string;
    } | undefined;
    tokenEnc?: ArrayBuffer | undefined;
    tokenRef?: {
        id: string;
        source: string;
        provider: string;
    } | undefined;
    accessEnc?: ArrayBuffer | undefined;
    refreshEnc?: ArrayBuffer | undefined;
    type: "api_key" | "oauth" | "token";
    profileId: string;
    agentId: string;
    provider: string;
    ownerId: string;
}, Promise<{
    profileId: string;
    updated: boolean;
}>>;
export declare const deleteProfile: import("convex/server").RegisteredMutation<"public", {
    profileId: string;
    agentId: string;
    ownerId: string;
}, Promise<{
    deleted: boolean;
}>>;
export declare const loadState: import("convex/server").RegisteredQuery<"public", {
    agentId: string;
    ownerId: string;
}, Promise<{
    _id: import("convex/values").GenericId<"profileState">;
    _creationTime: number;
    disabledUntil?: number | undefined;
    cooldownUntil?: number | undefined;
    cooldownModel?: string | undefined;
    errorCount?: number | undefined;
    lastUsed?: number | undefined;
    cooldownReason?: string | undefined;
    disabledReason?: string | undefined;
    failureCounts?: any;
    lastFailureAt?: number | undefined;
    explicitOrder?: number | undefined;
    profileId: string;
    agentId: string;
    provider: string;
    ownerId: string;
    isLastGood: boolean;
}[]>>;
export declare const readAuthFile: import("convex/server").RegisteredQuery<"public", {
    kind: "auth-state" | "profile-state" | "models";
    agentId: string;
    ownerId: string;
}, Promise<{
    _id: import("convex/values").GenericId<"authFiles">;
    _creationTime: number;
    kind: "auth-state" | "profile-state" | "models";
    agentId: string;
    payload: ArrayBuffer;
    updatedAt: number;
    ownerId: string;
} | null>>;
export declare const writeAuthFile: import("convex/server").RegisteredMutation<"public", {
    kind: "auth-state" | "profile-state" | "models";
    agentId: string;
    payload: ArrayBuffer;
    ownerId: string;
}, Promise<{
    updated: boolean;
}>>;
export declare const upsertState: import("convex/server").RegisteredMutation<"public", {
    disabledUntil?: number | undefined;
    cooldownUntil?: number | undefined;
    cooldownModel?: string | undefined;
    errorCount?: number | undefined;
    lastUsed?: number | undefined;
    cooldownReason?: string | undefined;
    disabledReason?: string | undefined;
    failureCounts?: any;
    lastFailureAt?: number | undefined;
    explicitOrder?: number | undefined;
    profileId: string;
    agentId: string;
    provider: string;
    ownerId: string;
    isLastGood: boolean;
}, Promise<{
    profileId: string;
    updated: boolean;
}>>;
//# sourceMappingURL=auth.d.ts.map
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #136** (2026-08-31): **/new not clearing the token count**
  *Symptoms*: ### What happened?  When I run `/new` it cleared the current terminal, opened a new one but the token count is still the same instead of becoming zero. Does that mean the context is being carried over to new session?  ### Steps to reproduce  1. /new in brigade tui 2. Observe the number of tokens in new session  ### Relevant logs / output  ```shell  ```  ### Brigade version  1.32.1  ### Node version  v26.7.0  ### Operating system  macOS
  **Post-Mortem & Fix Analysis**:
  > Fixed in **v1.35.1**. Thank you for filing it — and for asking the follow-up question, because that turned out to be the important part.  ## Your instinct was right about the display, and wrong about the cause — which is the good news  > Does that mean the context is being carried over to new session?  **No.** `/new` mints a genuinely fresh session key (`agent:<id>:t-<uuid>`), which has its own transcript on disk and no history. The model was never seeing the old conversation. What you were looking at was a stale *number*, not carried context.  That distinction only became true recently, though, and it is worth being precise about when.  ## Why it happened  On **1.32.1**, the version you reported against, the token totals were **process-wide scalars** — a single running count accumulated across every session the gateway had ever handled. `/new` could not have reset them, because they were never per-session in the first place.  **v1.34.0** replaced that with a per-`(agent, sessionKey)` 

- **Issue #125** (2026-08-31): **Multiple Brigade Sessions Temporarily Show the Same Live Log**
  *Symptoms*: ### What happened?  I had multiple independent sessions open under the same Brigade agent, with each session working on a different task.  Initially, every session was correctly showing its own conversation and execution logs. However, when I triggered a web-search task in one of the sessions, the other open sessions suddenly started displaying the same live log/output as the session performing the web search.  For a short period, it looked like all of the sessions had been merged or were subscribed to the same event stream.  Once the web-search task finished, the sessions appeared to return to normal and started showing their own separate logs again.  I am not sure whether the underlying session data was actually mixed or whether this was only a UI/live-stream routing issue, but from the user interface, multiple independent sessions temporarily showed the exact same activity.  ### Steps to reproduce  1. Open Brigade and use the same agent. 2. Create or open multiple separate sessions under that agent. 3. Give each session a different task. 4. Verify that each session initially shows its own conversation and execution logs. 5. In one of the sessions, start a task that triggers a web search. 6. While the web search is running, switch between the other open sessions. 7. Observe that the other sessions begin showing the same live log/output as the session running the web search. 8. Wait for the web-search task to complete. 9. Observe that the sessions eventually return to showin
  **Post-Mortem & Fix Analysis**:
  > Dug into this one — the root cause turned out to be more general than "web search" specifically, and it's a real design tension worth a maintainer call before someone (me or anyone else) sends a PR.  ## Root cause  `shouldDeliverFrame` in [`src/core/ws-subscription-filter.ts`](https://github.com/spinabot/brigade/blob/main/src/core/ws-subscription-filter.ts#L29) treats an agent-level subscription match as sufficient on its own, regardless of the session:  ```ts if (agentId && agentSubs?.has(agentId)) return true; if (sessionId && sessionSubs) { /* session-level narrowing, never reached if the agent check already returned */ } ```  This is intentional and already covered by a test (`ws-subscription-filter.test.ts`, "an agentId match wins even if sessionId mismatches") — it's what lets one operator watching an agent see everything under it (WhatsApp-routed replies, cron runs, a runaway thread they need to intervene in).  The problem is on the client side: `connect.ts`'s `applySubscription
  > Fixed in **v1.34.0**. Thanks for the unusually precise report — the "returns to normal once the task finishes" detail is what made it findable.  ## What was actually wrong  The gateway had no concept of *session*-scoped delivery. `shouldDeliverFrame` decided whether to send a frame to a connection using only the **agent** id, so every connection subscribed to an agent was eligible for every frame produced by **any** session under that agent. Two sessions under one agent were, at the transport level, subscribed to the same stream — which is exactly what you described.  It looked intermittent rather than constant because the TUI filters most frames client-side by session when it renders them. The live tool-output pane does not — it is keyed by tool-call id and painted as it streams. So a long-running tool (a web search is the common case) showed up in every session's UI for as long as it streamed, then vanished when the pane retired. Short frames were filtered and never noticed.  To your

- **Issue #28** (2026-06-23): **Brigade version inconrrect**
  *Symptoms*: ### What happened?  brigade --version is incorrect.  ### Steps to reproduce  brigade --version  ### Relevant logs / output  ```shell  ```  ### Brigade version  1.3.2  ### Node version  v24.15.0  ### Operating system  Windows
  **Post-Mortem & Fix Analysis**:
  > Fixed in 1.3.2

- **Issue #27** (2026-06-23): **Error: WebSocket was closed before the connection was established**
  *Symptoms*: ### What happened?  I am getting this error when I run `brigade tui` after starting brigade gateway  rror: WebSocket was closed before the connection was established     at WebSocket.close (C:\Users\kumar\AppData\Roaming\npm\node_modules\@spinabot\brigade\node_modules\ws\lib\websocket.js:306:7)     at finish (file:///C:/Users/XXXX/AppData/Roaming/npm/node_modules/@spinabot/brigade/dist/core/gateway-probe.js:186:20)     at Timeout._onTimeout (file:///C:/Users/XXXX/AppData/Roaming/npm/node_modules/@spinabot/brigade/dist/core/gateway-probe.js:194:13)     at listOnTimeout (node:internal/timers:605:17)     at process.processTimers (node:internal/timers:541:7) Emitted 'error' event on WebSocket instance at:     at emitErrorAndClose (C:\Users\kumar\AppData\Roaming\npm\node_modules\@spinabot\brigade\node_modules\ws\lib\websocket.js:1060:13)     at process.processTicksAndRejections (node:internal/process/task_queues:90:21)  Node.js v24.15.0  ### Steps to reproduce  1. run 'brigade gateway' 2. run brigade tui in windows 3.  ### Relevant logs / output  ```shell  ```  ### Brigade version   0.1.0  ### Node version  v24.15.0  ### Operating system  Windows
  **Post-Mortem & Fix Analysis**:
  > This has been resolved in brigade version: 1.3.2

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

### Incident Patch 1: `afcaca50` (2026-09-15)
**Commit Message**: fix(team): harden runtime and message pagination

**File**: `.gitignore` (modified, +1/-1)
```diff
@@ -58,7 +58,7 @@ skills-lock.json
 
 # Local planning docs (operator-only, not for the public repo)
 docs/web-client-plan.md
-docs/*-feature-harvest.md
+docs/aionui-feature-harvest.md
 
 # apps/ (mobile, web, …) — kept OUT of the public repo until the project gains
 # traction (target: 5k GitHub stars). Then un-ignore this + commit apps/.
```

**File**: `docs/team-mode.md` (modified, +5/-2)
```diff
@@ -263,8 +263,11 @@ appear in the operator conversation; UIs receive only the redacted Team lanes.
 After reconnecting, call `team.resume` with the last rendered `roomSeq`. The
 response contains the current room/run snapshot, authoritative metrics, the 100
 most recent public messages, and newer durable events. Page older conversation
-with `team.messages.list`; use `team.messages.search` for bounded server-side
-search. If `replayComplete` is false, render the returned snapshot as authority
+with `team.messages.list`. Prefer `beforeMessageId`/`afterMessageId` over the
+legacy timestamp cursors so messages created in the same millisecond cannot be
+skipped; the cursor must name a message in the same room. Use
+`team.messages.search` for bounded server-side search. If `replayComplete` is
+false, render the returned snapshot as authority
 instead of trying to reconstruct state from an incomplete event interval.
 
 For UI state, key transient streams by `attemptId`, render durable task state
```

**File**: `src/agents/tools/team-task-tool.ts` (modified, +6/-1)
```diff
@@ -65,8 +65,11 @@ const TeamTaskParams = Type.Object({
 	threadRootMessageId: Type.Optional(
 		Type.String({ description: "read_messages: return replies under this root message.", minLength: 1, maxLength: 128 }),
 	),
+	afterMessageId: Type.Optional(
+		Type.String({ description: "read_messages: exact forward cursor; use the last message id from the previous page.", minLength: 1, maxLength: 128 }),
+	),
 	afterCreatedAt: Type.Optional(
-		Type.Integer({ description: "read_messages: return messages newer than this timestamp.", minimum: 0 }),
+		Type.Integer({ description: "read_messages: legacy coarse cursor; afterMessageId is exact when timestamps collide.", minimum: 0 }),
 	),
 	attachments: Type.Optional(
 		Type.Array(Type.Object({
@@ -351,6 +354,7 @@ export function makeTeamTaskTool(
 					}
 					case "read_messages": {
 						const threadRootMessageId = readStringParam(args, "threadRootMessageId");
+						const afterMessageId = readStringParam(args, "afterMessageId");
 						const afterCreatedAt = readNumberParam(args, "afterCreatedAt", { integer: true, strict: true });
 						const limit = readNumberParam(args, "limit", { integer: true, strict: true }) ?? 50;
 						if (afterCreatedAt !== undefined && (!Number.isSafeInteger(afterCreatedAt) || afterCreatedAt < 0)) {
@@ -361,6 +365,7 @@ export function makeTeamTaskTool(
 						}
 						const messages = await context.readMessages({
 							...(threadRootMessageId ? { threadRootMessageId } : {}),
+							...(afterMessageId ? { afterMessageId } : {}),
 							...(afterCreatedAt !== undefined ? { afterCreatedAt } : {}),
 							limit,
 						});
```

**File**: `src/agents/tools/team-tool.test.ts` (modified, +18/-3)
```diff
@@ -19,7 +19,7 @@ describe("team", () => {
 			store,
 			now: () => 10,
 			kick: () => { kicks += 1; },
-			validateAgentId: (agentId) => ["researcher", "writer"].includes(agentId),
+			validateAgentId: (agentId) => ["main", "researcher", "writer"].includes(agentId),
 		});
 		assert.equal(tool.ownerOnly, true);
 
@@ -210,7 +210,7 @@ describe("team", () => {
 
 	it("rejects unknown room members and configured non-member task assignees", async () => {
 		const store = new InMemoryCollaborationStore();
-		const configured = new Set(["alice", "bob"]);
+		const configured = new Set(["main", "alice", "bob"]);
 		const tool = makeTeamTool({
 			agentId: "main",
 			store,
@@ -249,11 +249,26 @@ describe("team", () => {
 		assert.equal(nonMember.ok, false);
 		assert.equal(nonMember.errorCode, "AGENT_NOT_IN_ROOM");
 		assert.deepEqual(await store.listTasks("run"), []);
+		const defaulted = details(await tool.execute("default-task", {
+			action: "add_tasks",
+			runId: "run",
+			tasks: [{ id: "coordinator-task", title: "Task", instructions: "Work" }],
+		}));
+		assert.equal(defaulted.ok, true);
+		assert.equal((await store.getTask("coordinator-task"))?.assignedAgentId, "main");
 	});
 
 	it("keeps the durable success when the best-effort worker wake fails", async () => {
 		const store = new InMemoryCollaborationStore();
-		await store.createRoom({ commandId: "seed.room", roomId: "room", title: "Room", createdBy: "main", now: 1 });
+		await store.createRoom({
+			commandId: "seed.room",
+			roomId: "room",
+			title: "Room",
+			createdBy: "main",
+			members: [{ agentId: "main", role: "coordinator" }],
+			metadata: { coordinatorAgentId: "main" },
+			now: 1,
+		});
 		await store.createRun({ commandId: "seed.run", runId: "run", roomId: "room", objective: "Run", createdBy: "main", now: 2 });
 		await store.addTasks({ commandId: "seed.tasks", runId: "run", tasks: [{ id: "task", title: "Task", instructions: "Work" }], now: 3 });
 		const tool = makeTeamTool({
```

**File**: `src/agents/tools/team-tool.ts` (modified, +36/-23)
```diff
@@ -120,6 +120,11 @@ const TeamParams = Type.Object({
 	replyToMessageId: Type.Optional(Type.String({ minLength: 1, maxLength: 128 })),
 	threadRootMessageId: Type.Optional(Type.String({ minLength: 1, maxLength: 128 })),
 	pinnedOnly: Type.Optional(Type.Boolean()),
+	afterMessageId: Type.Optional(Type.String({
+		description: "list_messages: exact forward cursor; use the last message id from the previous page.",
+		minLength: 1,
+		maxLength: 128,
+	})),
 	afterCreatedAt: Type.Optional(Type.Integer({ minimum: 0 })),
 	runId: Type.Optional(Type.String({ minLength: 1, maxLength: 128 })),
 	taskId: Type.Optional(Type.String({ minLength: 1, maxLength: 128 })),
@@ -401,16 +406,24 @@ export function makeTeamTool(
 		if (!approval) return;
 		await requireRunInScope(store, approval.runId);
 	};
-	const requireTaskAssigneesInRoom = async (
+	const prepareTaskAssigneesInRoom = async (
 		store: CollaborationStore,
-		runId: string,
+		roomId: string,
 		tasks: readonly TaskDraft[],
-	): Promise<void> => {
-		const run = await requireRunInScope(store, runId);
-		if (!run) throw new CollaborationConflictError("NOT_FOUND", `Team run not found: ${runId}`);
-		const room = await store.getRoom(run.roomId);
-		if (!room) throw new CollaborationConflictError("NOT_FOUND", `Team room not found: ${run.roomId}`);
-		const assignees = tasks.flatMap((task) => task.assignedAgentId ? [task.assignedAgentId] : []);
+	): Promise<TaskDraft[]> => {
+		const room = await store.getRoom(roomId);
+		if (!room) throw new CollaborationConflictError("NOT_FOUND", `Team room not found: ${roomId}`);
+		const coordinatorAgentId = await resolveConfiguredRoomCoordinatorAgentId(room, validateAgentId);
+		if (tasks.some((task) => !task.assignedAgentId) && !coordinatorAgentId) {
+			throw new CollaborationConflictError(
+				"NO_ROOM_COORDINATOR",
+				`Team tasks require explicit assignees because room ${room.id} has no configured coordinator`,
+			);
+		}
+		const materialized = tasks.map((task) => task.assignedAgentId
+			? { ...task }
+			: { ...task, assignedAgentId: coordinatorAgentId! });
+		const assignees = materialized.map((task) => task.assignedAgentId!);
 		await requireConfiguredAgents(assignees);
 		const members = new Set(room.members.map((member) => member.agentId));
 		const nonMember = assignees.find((agentId) => !members.has(agentId));
@@ -420,6 +433,16 @@ export function makeTeamTool(
 				`Team task assignee ${nonMember} is not a member of room ${room.id}`,
 			);
 		}
+		return materialized;
+	};
+	const prepareTaskAssigneesForRun = async (
+		store: CollaborationStore,
+		runId: string,
+		tasks: readonly TaskDraft[],
+	): Promise<TaskDraft[]> => {
+		const run = await requireRunInScope(store, runId);
+		if (!run) throw new CollaborationConflictError("NOT_FOUND", `Team run not found: ${runId}`);
+		return prepareTaskAssigneesInRoom(store, run.roomId, tasks);
 	};
 	const requireConfiguredAgents = async (agentIds: readonly string[]): Promise<void> => {
 		for (const agentId of new Set(agentIds.map((value) => value.trim()))) {
@@ -496,13 +519,11 @@ export function makeTeamTool(
 					}
 					case "create_room": {
 						const title = required(args, "title");
-						if (args.members) {
-							await requireConfiguredAgents(args.members.map((member) => member.agentId));
-						}
 						const members = [...(args.members ?? [])];
 						if (!members.some((member) => member.agentId === options.agentId)) {
 							members.unshift({ agentId: options.agentId, role: "coordinator" });
 						}
+						await requireConfiguredAgents(members.map((member) => member.agentId));
 						const created = await store.createRoom({
 							commandId,
 							now,
@@ -578,6 +599,7 @@ export function makeTeamTool(
 					case "list_messages": {
 						const roomId = scopedRoomId(args, action);
 						const threadRootMessageId = readStringParam(args, "threadRootMessageId");
+						const afterMessageId = readStringParam(args, "afterMessageId");
 						const afterCreatedAt = readN
```

---

### Incident Patch 2: `0487b57d` (2026-09-10)
**Commit Message**: docs: add FitBBC to the Brigadiers wall, and fix the bot that should have

Two things, because one without the other is a workaround.

THE WALL. FitBBC's Token Market provider (#168) merged and their avatar never
appeared. The README half of this is the real generator's output, not
hand-written markup — `scripts/update-brigadiers.mjs` run against the live
contributor graph, so it is byte-identical to what the bot would have produced.

THE BOT. It regenerated the wall correctly and then could not push:

    GH013: Repository rule violations found for refs/heads/main
    - Changes must be made through a pull request.
    - 3 of 3 required status checks are expected.

A ruleset now requires pull requests on `main`, so the workflow's direct
`git push` can never land again. The failure was invisible in the worst way:
runs where the wall happened not to change still passed, so the job only broke
on the runs that mattered — the ones with a new contributor to add. Someone
merges their first PR and their avatar silently never shows up.

It now opens a PR instead, reusing one branch so weekly runs update the same PR
rather than opening a new one each time. `pull-requests: write` goes with it

**File**: `.github/workflows/brigadiers.yml` (modified, +39/-8)
```diff
@@ -14,6 +14,10 @@ on:
 
 permissions:
   contents: write
+  # Needed to OPEN the wall PR. `contents: write` alone pushes the branch and
+  # then fails on `gh pr create` — which would have replaced one silent failure
+  # with another.
+  pull-requests: write
 
 concurrency:
   group: brigadiers
@@ -34,14 +38,41 @@ jobs:
         env:
           GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
         run: node scripts/update-brigadiers.mjs
-      - name: Commit if the wall changed
+      # OPEN A PR — `main` no longer accepts a direct push.
+      #
+      # This step used to `git push` straight to main, and a ruleset requiring
+      # pull requests and status checks now rejects that:
+      #
+      #   GH013: Repository rule violations found for refs/heads/main
+      #   - Changes must be made through a pull request.
+      #
+      # The job kept passing on runs where the wall happened not to change, so
+      # the breakage only surfaced on the runs that mattered — the ones with a
+      # new contributor to add. A contributor merged their first PR and their
+      # avatar silently never appeared.
+      #
+      # Reusing ONE branch means repeated runs update the same PR instead of
+      # opening a new one each week.
+      - name: Open a PR if the wall changed
+        env:
+          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
         run: |
-          if [[ -n "$(git status --porcelain README.md)" ]]; then
-            git config user.name "github-actions[bot]"
-            git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
-            git add README.md
-            git commit -m "docs: refresh Brigadiers contributor wall [skip ci]"
-            git push
+          if [[ -z "$(git status --porcelain README.md)" ]]; then
+            echo "Brigadiers wall unchanged — nothing to do."
+            exit 0
+          fi
+          git config user.name "github-actions[bot]"
+          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
+          git checkout -B chore/brigadiers-wall
+          git add README.md
+          git commit -m "docs: refresh Brigadiers contributor wall"
+          git push --force-with-lease origin chore/brigadiers-wall
+          if [[ -z "$(gh pr list --head chore/brigadiers-wall --state open --json number -q '.[0].number')" ]]; then
+            gh pr create \
+              --base main \
+              --head chore/brigadiers-wall \
+              --title "docs: refresh Brigadiers contributor wall" \
+              --body "Regenerated from the live contributor graph by the Brigadiers workflow."
           else
-            echo "Brigadiers wall unchanged — nothing to commit."
+            echo "An open wall PR already exists — it now carries the latest wall."
           fi
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -1047,7 +1047,7 @@ A pride of contributors who make Brigade better. Thank you to everyone who has
 joined the crew!
 
 <!-- brigadiers:start -->
-<a href="https://github.com/Bhasvanth-Dev9380" title="Bhasvanth-Dev9380"><img src="https://avatars.githubusercontent.com/u/157608971?v=4&s=48" width="48" height="48" alt="Bhasvanth-Dev9380" /></a> <a href="https://github.com/Bhasvanth-Spinabot" title="Bhasvanth-Spinabot"><img src="https://avatars.githubusercontent.com/u/314351905?v=4&s=48" width="48" height="48" alt="Bhasvanth-Spinabot" /></a> <a href="https://github.com/Ranjithsingh2004" title="Ranjithsingh2004"><img src="https://avatars.githubusercontent.com/u/122562396?v=4&s=48" width="48" height="48" alt="Ranjithsingh2004" /></a> <a href="https://github.com/ssh-den" title="ssh-den"><img src="https://avatars.githubusercontent.com/u/103561857?v=4&s=48" width="48" height="48" alt="ssh-den" /></a> <a href="https://github.com/viveknadig" title="viveknadig"><img src="https://avatars.githubusercontent.com/u/96881767?v=4&s=48" width="48" height="48" alt="viveknadig" /></a> <a href="https://github.com/dulcestentaciones2920-debug" title="dulcestentaciones2920-debug"><img src="https://avatars.githubusercontent.com/u/321300431?v=4&s=48" width="48" height="48" alt="dulcestentaciones2920-debug" /></a>
+<a href="https://github.com/Bhasvanth-Dev9380" title="Bhasvanth-Dev9380"><img src="https://avatars.githubusercontent.com/u/157608971?v=4&s=48" width="48" height="48" alt="Bhasvanth-Dev9380" /></a> <a href="https://github.com/Bhasvanth-Spinabot" title="Bhasvanth-Spinabot"><img src="https://avatars.githubusercontent.com/u/314351905?v=4&s=48" width="48" height="48" alt="Bhasvanth-Spinabot" /></a> <a href="https://github.com/Ranjithsingh2004" title="Ranjithsingh2004"><img src="https://avatars.githubusercontent.com/u/122562396?v=4&s=48" width="48" height="48" alt="Ranjithsingh2004" /></a> <a href="https://github.com/FitBBC" title="FitBBC"><img src="https://avatars.githubusercontent.com/u/2372724?v=4&s=48" width="48" height="48" alt="FitBBC" /></a> <a href="https://github.com/ssh-den" title="ssh-den"><img src="https://avatars.githubusercontent.com/u/103561857?v=4&s=48" width="48" height="48" alt="ssh-den" /></a> <a href="https://github.com/viveknadig" title="viveknadig"><img src="https://avatars.githubusercontent.com/u/96881767?v=4&s=48" width="48" height="48" alt="viveknadig" /></a> <a href="https://github.com/dulcestentaciones2920-debug" title="dulcestentaciones2920-debug"><img src="https://avatars.githubusercontent.com/u/321300431?v=4&s=48" width="48" height="48" alt="dulcestentaciones2920-debug" /></a>
 <!-- brigadiers:end -->
 
 Want to join the pride? See [CONTRIBUTING.md](CONTRIBUTING.md).
```

---

### Incident Patch 3: `9175d6b2` (2026-09-09)
**Commit Message**: Merge pull request #167 from spinabot/fix/tideline-validation-quality

fix(validation): constrain provider data before saving probe evidence

**File**: `scripts/lib/tideline-live-report-validation.mjs` (added, +80/-0)
```diff
@@ -0,0 +1,80 @@
+/** Project provider metadata onto a bounded report schema before writing it. */
+// Sanity bounds for reporting; the caller separately enforces its request budget.
+const MAX_TOKENS = 2_000_000;
+const MAX_COST = 100;
+const MAX_ANSWER_LENGTH = 16_384;
+const FINISH_REASONS = ["stop", "length", "tool_calls", "function_call", "content_filter", "error"];
+
+function invalid(field) {
+  // Never put a rejected provider value in an error that the report may persist.
+  throw new TypeError(`Invalid provider report field: ${field}`);
+}
+
+function record(value, field) {
+  if (!value || typeof value !== "object" || Array.isArray(value)) invalid(field);
+  return value;
+}
+
+function amount(value, field, maximum, integer = false) {
+  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > maximum || (integer && !Number.isSafeInteger(value))) invalid(field);
+  return value;
+}
+
+function allowed(value, candidates, field) {
+  // Return the local canonical value, not an unchecked provider string.
+  const match = candidates.find(candidate => candidate === value);
+  if (match === undefined) invalid(field);
+  return match;
+}
+
+function optionalAmounts(source, fields, maximum, integer, label) {
+  const result = {};
+  for (const field of fields) {
+    if (Object.hasOwn(source, field)) result[field] = amount(source[field], `${label}.${field}`, maximum, integer);
+  }
+  return result;
+}
+
+export function validateProviderReportMetadata(data, { models, providers }) {
+  record(data, "response");
+  if (typeof data.id !== "string" || data.id.length > 128 || !/^[A-Za-z0-9]/.test(data.id) || /[^A-Za-z0-9._:-]/.test(data.id)) invalid("id");
+  const source = record(data.usage, "usage");
+  const usage = {
+    prompt_tokens: amount(source.prompt_tokens, "usage.prompt_tokens", MAX_TOKENS, true),
+    completion_tokens: amount(source.completion_tokens, "usage.completion_tokens", MAX_TOKENS, true),
+    cost: amount(source.cost, "usage.cost", MAX_COST),
+    ...optionalAmounts(source, ["total_tokens"], MAX_TOKENS, true, "usage"),
+  };
+  if (Object.hasOwn(source, "is_byok")) {
+    if (typeof source.is_byok !== "boolean") invalid("usage.is_byok");
+    usage.is_byok = source.is_byok;
+  }
+  for (const [field, keys] of [
+    ["prompt_tokens_details", ["cached_tokens", "cache_write_tokens", "audio_tokens", "video_tokens"]],
+    ["completion_tokens_details", ["reasoning_tokens", "audio_tokens", "image_tokens", "accepted_prediction_tokens", "rejected_prediction_tokens"]],
+  ]) {
+    if (Object.hasOwn(source, field)) usage[field] = optionalAmounts(record(source[field], `usage.${field}`), keys, MAX_TOKENS, true, `usage.${field}`);
+  }
+  if (Object.hasOwn(source, "cost_details")) {
+    usage.cost_details = optionalAmounts(record(source.cost_details, "usage.cost_details"),
+      ["upstream_inference_cost", "upstream_inference_prompt_cost", "upstream_inference_completions_cost"], MAX_COST, false, "usage.cost_details");
+  }
+  return {
+    generationId: data.id,
+    returnedModel: allowed(data.model, models, "model"),
+    provider: allowed(data.provider, providers, "provider"),
+    usage,
+    finishReason: allowed(data.choices?.[0]?.finish_reason, FINISH_REASONS, "finish_reason"),
+  };
+}
+
+export function validateProviderAnswerText(value) {
+  if (value === null || value === undefined) return null;
+  if (typeof value !== "string" || value.length > MAX_ANSWER_LENGTH) invalid("answer");
+  return value;
+}
+
+export function providerReportErrorCategory(error) {
+  return ["Error", "TypeError", "SyntaxError", "AbortError", "TimeoutError", "AssertionError"]
+    .find(name => name === error?.name) ?? "UnknownError";
+}
```

**File**: `scripts/test-tideline-live-convex.mjs` (modified, +24/-5)
```diff
@@ -8,7 +8,9 @@
  * TIDELINE_CONVEX_BACKEND may supply the binary instead of --backend. This does
  * not use convex:dev, contact Convex Cloud, load provider credentials, change
  * repository environment files, or retain backend data/keys. Only redacted
- * results and logs remain in the printed temporary artifact directory. This is
+ * results and logs remain in the printed temporary artifact directory. Error
+ * details are printed to the console; reports retain fixed failure categories
+ * and local operation phases only. This is
  * a correctness/recovery probe with bounded load, not a scalability benchmark.
  */
 import assert from "node:assert/strict";
@@ -69,13 +71,22 @@ let ctx;
 let resetRuntimeContext;
 let activeChild;
 let cleaning;
+let phase = "setup";
 const sensitive = () => [instanceSecret, adminKey, safeEnv.BRIGADE_ENCRYPTION_KEY].filter(Boolean);
 const redact = (value) => sensitive().reduce((out, token) => out.split(token).join("[redacted]"), String(value));
 const envFiles = [".env.local", ".env"].map((file) => path.join(ROOT, file));
 const hashEnv = () => envFiles.map((file) => fs.existsSync(file) ? createHash("sha256").update(fs.readFileSync(file)).digest("hex") : null);
 const beforeEnv = hashEnv();
 const check = (name) => { results.checks.push(name); console.log(`PASS ${name}`); };
 
+// Error messages/stacks can contain network response data. Persist only fixed
+// categories; their full redacted diagnostics remain available in the console.
+const failureCategory = (error) => {
+  if (error?.name === "AssertionError") return "assertion";
+  if (error?.name === "TimeoutError" || error?.name === "AbortError") return "timeout";
+  return "operation";
+};
+
 function platformAsset() {
   const platforms = {
     "darwin-arm64": "aarch64-apple-darwin", "darwin-x64": "x86_64-apple-darwin",
@@ -185,7 +196,9 @@ for (const [signal, code] of [["SIGINT", 130], ["SIGTERM", 143]]) {
 try {
   fs.mkdirSync(project, { recursive: true, mode: 0o700 });
   fs.mkdirSync(stateDir, { recursive: true, mode: 0o700 });
+  phase = "resolving-backend";
   await resolveBinary();
+  phase = "preparing-backend";
   fs.cpSync(path.join(ROOT, "convex"), path.join(project, "convex"), { recursive: true, filter: (source) => {
     const rel = path.relative(path.join(ROOT, "convex"), source);
     // Keep generated API bindings; omit tsc's root-level JS/declaration copies
@@ -205,6 +218,7 @@ try {
   const envFile = path.join(project, "probe.env");
   fs.writeFileSync(envFile, `CONVEX_SELF_HOSTED_URL=${url}\nCONVEX_SELF_HOSTED_ADMIN_KEY=${adminKey}\n`, { mode: 0o600 });
   await startBackend();
+  phase = "deploying-functions";
   console.log("Backend ready on isolated loopback ports; deploying current copied functions.");
   const deploy = await run(process.execPath, [path.join(ROOT, "node_modules", "convex", "bin", "main.js"), "deploy", "--yes", "--env-file", envFile, "--typecheck", "disable", "--codegen", "disable"]);
   fs.writeFileSync(path.join(WORK, "deploy.log"), deploy);
@@ -230,6 +244,7 @@ try {
   const peer = { kind: "channel", channelId: "chat", conversationId: "room", sessionKey: "session" };
   const template = seedStore.write({ content: "Amber release gate is Friday.", segment: "project", sourceType: "owner_message", createdBy: owner, metadata: { approved: "amber-proof" } });
   const rootRecord = { ...template, memoryId: "root-record" };
+  phase = "encryption-origin-isolation";
   await memory.upsertFactRecordRaw("workspace-a", rootRecord);
   await memory.upsertFactRecordRaw("workspace-a", { ...template, memoryId: "peer-record", content: "Amber private channel gate is Monday.", createdBy: peer });
   await memory.upsertFactRecordRaw("workspace-b", { ...template, memoryId: "other-workspace", content: "Amber other workspace gate is Tuesday." });
@@ -243,6 +258,7 @@ try {
   for (const field of ["channelId", "conversationId", "sessionKey"]) assert.deepEqual(await memory.listFacts({ origin: { ...peer, [field]: "other"
```

**File**: `scripts/test-tideline-live-models.mjs` (modified, +18/-13)
```diff
@@ -11,6 +11,7 @@ import fs from "node:fs";
 import os from "node:os";
 import path from "node:path";
 import { createInterface } from "node:readline";
+import { providerReportErrorCategory, validateProviderAnswerText, validateProviderReportMetadata } from "./lib/tideline-live-report-validation.mjs";
 
 const root = fs.mkdtempSync(path.join(os.tmpdir(), "tideline-live-models-"));
 const state = path.join(root, "state");
@@ -67,16 +68,18 @@ async function complete(model, messages, label, extra = {}) {
    body: JSON.stringify(request), signal: AbortSignal.timeout(55000),
   });
   const data = await response.json();
-  Object.assign(entry, { httpStatus: response.status, latencyMs: Date.now() - started, generationId: data.id,
-   returnedModel: data.model, provider: data.provider, usage: data.usage, finishReason: data.choices?.[0]?.finish_reason });
+  Object.assign(entry, { httpStatus: response.status, latencyMs: Date.now() - started });
   // Error payloads may contain provider request details; never log/store them.
-  if (!response.ok || data.error || !data.choices?.[0]?.message) throw new Error(`provider response failed (${response.status})`);
+  if (!response.ok || data?.error || !data?.choices?.[0]?.message) throw new Error(`provider response failed (${response.status})`);
+  const metadata = validateProviderReportMetadata(data, { models: supportedModels, providers: Object.values(providerNames) });
+  Object.assign(entry, metadata);
   saveReport();
-  return { message: data.choices[0].message, usage: data.usage, requestId: id, finishReason: data.choices[0].finish_reason };
+  return { message: data.choices[0].message, usage: metadata.usage, requestId: id, finishReason: metadata.finishReason };
  } catch (error) {
-  Object.assign(entry, { failed: true, error: error.name, latencyMs: Date.now() - started });
+  const category = providerReportErrorCategory(error);
+  Object.assign(entry, { failed: true, error: category, latencyMs: Date.now() - started });
   saveReport();
-  throw new Error(`Live request ${id} (${label}) failed: ${error.name}`);
+  throw new Error(`Live request ${id} (${label}) failed: ${category}`);
  }
 }
 
@@ -111,10 +114,8 @@ function normalizeAnswer(content) {
 }
 
 async function modelToolRoundTrip(model, workspace) {
- const toolStore = new FactStore(workspace);
- let memory = Tideline.over(toolStore, { threatScan: { scan: scanForThreats } });
  for (const stage of ["write", "recall"]) {
-  memory = Tideline.over(new FactStore(workspace), { threatScan: { scan: scanForThreats } });
+  const memory = Tideline.over(new FactStore(workspace), { threatScan: { scan: scanForThreats } });
   const localTools = memoryMcpTools(memory, { origin: owner });
   const name = stage === "write" ? "memory_add" : "memory_search";
   const messages = [{ role: "system", content: "Use the memory tool to complete the request. After the tool result, answer briefly using its data." },
@@ -191,8 +192,9 @@ try {
        response_format: { type: "json_schema", json_schema: { name: "memory_answer", strict: true,
         schema: { type: "object", properties: { answer: { type: "string" } }, required: ["answer"], additionalProperties: false } } },
       });
-     const actual = normalizeAnswer(answer.message.content ?? "");
-     report.answers.push({ model, caseId: fixture.id, repetition, arm, expected: fixture.answer, actual, rawAnswer: answer.message.content ?? null, correct: actual === fixture.answer && answer.finishReason === "stop", finishReason: answer.finishReason, requestId: answer.requestId, usage: answer.usage });
+     const rawAnswer = validateProviderAnswerText(answer.message.content);
+     const actual = normalizeAnswer(rawAnswer ?? "");
+     report.answers.push({ model, caseId: fixture.id, repetition, arm, expected: fixture.answer, actual, rawAnswer, correct: actual === fixture.answer && answer.finishReason === "stop", finishReason: answer.finishReason, requestId: answer.requestId, usage: answer.usage });
      sa
```

**File**: `src/agents/memory/extract.ts` (modified, +0/-1)
```diff
@@ -25,7 +25,6 @@ import type { AgentSession } from "@earendil-works/pi-coding-agent";
 
 import { createSubsystemLogger } from "../../logging/subsystem-logger.js";
 import { pickInitialThinkingLevel } from "../../core/model-caps.js";
-import { workspaceIdFromDir } from "../../storage/facts-cache.js";
 import { tryGetRuntimeContext } from "../../storage/runtime-context.js";
 import { applyPersonaOverrideToSession } from "../../system-prompt/pi-injection.js";
 import { wrapStreamFnWithPayloadMutations } from "../payload-mutators.js";
```

**File**: `src/tideline/exports/vault.ts` (modified, +0/-1)
```diff
@@ -32,7 +32,6 @@ import { renameWithRetry } from "../../infra/fs/atomic-rename.js";
 import { cosine, getDefaultEmbedder } from "../embeddings/embedder.js";
 import { linksFrom, type MemoryLink, type MemoryLinkKind } from "../graph/links.js";
 import { originBucketKey, type MemoryRecord, type MemorySegment } from "../store/records.js";
-import { tokenize } from "../retrieval/scoring.js";
 
 const PIN_OPEN = "%% pinned %%";
 const PIN_CLOSE = "%% /pinned %%";
```

---

### Incident Patch 4: `d86c113d` (2026-09-09)
**Commit Message**: test(validation): keep the network failure fixture statically defined

**File**: `src/tideline/tests/live-convex-report.test.ts` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@ test("Convex probe persists fixed failure evidence without network-controlled er
   const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tideline-convex-report-test-"));
   const networkText = "network-controlled-report-canary";
   const preload = "data:text/javascript," + encodeURIComponent(
-    `globalThis.fetch = async () => ({ ok: false, status: ${JSON.stringify(networkText)} });`,
+    'globalThis.fetch = async () => ({ ok: false, status: "network-controlled-report-canary" });',
   );
   try {
     // Download fails before any backend, imports or deployment. The injected
```

---

### Incident Patch 5: `73cc2544` (2026-09-09)
**Commit Message**: fix(validation): constrain provider data before saving probe evidence

Address review findings from the merged Tideline checkpoint without reverting the migration. Keep token and cost receipts through bounded schema validation, record fixed error categories, remove unused imports and initialization, and cover malicious network metadata in isolated regression tests.

**File**: `scripts/lib/tideline-live-report-validation.mjs` (added, +80/-0)
```diff
@@ -0,0 +1,80 @@
+/** Project provider metadata onto a bounded report schema before writing it. */
+// Sanity bounds for reporting; the caller separately enforces its request budget.
+const MAX_TOKENS = 2_000_000;
+const MAX_COST = 100;
+const MAX_ANSWER_LENGTH = 16_384;
+const FINISH_REASONS = ["stop", "length", "tool_calls", "function_call", "content_filter", "error"];
+
+function invalid(field) {
+  // Never put a rejected provider value in an error that the report may persist.
+  throw new TypeError(`Invalid provider report field: ${field}`);
+}
+
+function record(value, field) {
+  if (!value || typeof value !== "object" || Array.isArray(value)) invalid(field);
+  return value;
+}
+
+function amount(value, field, maximum, integer = false) {
+  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > maximum || (integer && !Number.isSafeInteger(value))) invalid(field);
+  return value;
+}
+
+function allowed(value, candidates, field) {
+  // Return the local canonical value, not an unchecked provider string.
+  const match = candidates.find(candidate => candidate === value);
+  if (match === undefined) invalid(field);
+  return match;
+}
+
+function optionalAmounts(source, fields, maximum, integer, label) {
+  const result = {};
+  for (const field of fields) {
+    if (Object.hasOwn(source, field)) result[field] = amount(source[field], `${label}.${field}`, maximum, integer);
+  }
+  return result;
+}
+
+export function validateProviderReportMetadata(data, { models, providers }) {
+  record(data, "response");
+  if (typeof data.id !== "string" || data.id.length > 128 || !/^[A-Za-z0-9]/.test(data.id) || /[^A-Za-z0-9._:-]/.test(data.id)) invalid("id");
+  const source = record(data.usage, "usage");
+  const usage = {
+    prompt_tokens: amount(source.prompt_tokens, "usage.prompt_tokens", MAX_TOKENS, true),
+    completion_tokens: amount(source.completion_tokens, "usage.completion_tokens", MAX_TOKENS, true),
+    cost: amount(source.cost, "usage.cost", MAX_COST),
+    ...optionalAmounts(source, ["total_tokens"], MAX_TOKENS, true, "usage"),
+  };
+  if (Object.hasOwn(source, "is_byok")) {
+    if (typeof source.is_byok !== "boolean") invalid("usage.is_byok");
+    usage.is_byok = source.is_byok;
+  }
+  for (const [field, keys] of [
+    ["prompt_tokens_details", ["cached_tokens", "cache_write_tokens", "audio_tokens", "video_tokens"]],
+    ["completion_tokens_details", ["reasoning_tokens", "audio_tokens", "image_tokens", "accepted_prediction_tokens", "rejected_prediction_tokens"]],
+  ]) {
+    if (Object.hasOwn(source, field)) usage[field] = optionalAmounts(record(source[field], `usage.${field}`), keys, MAX_TOKENS, true, `usage.${field}`);
+  }
+  if (Object.hasOwn(source, "cost_details")) {
+    usage.cost_details = optionalAmounts(record(source.cost_details, "usage.cost_details"),
+      ["upstream_inference_cost", "upstream_inference_prompt_cost", "upstream_inference_completions_cost"], MAX_COST, false, "usage.cost_details");
+  }
+  return {
+    generationId: data.id,
+    returnedModel: allowed(data.model, models, "model"),
+    provider: allowed(data.provider, providers, "provider"),
+    usage,
+    finishReason: allowed(data.choices?.[0]?.finish_reason, FINISH_REASONS, "finish_reason"),
+  };
+}
+
+export function validateProviderAnswerText(value) {
+  if (value === null || value === undefined) return null;
+  if (typeof value !== "string" || value.length > MAX_ANSWER_LENGTH) invalid("answer");
+  return value;
+}
+
+export function providerReportErrorCategory(error) {
+  return ["Error", "TypeError", "SyntaxError", "AbortError", "TimeoutError", "AssertionError"]
+    .find(name => name === error?.name) ?? "UnknownError";
+}
```

**File**: `scripts/test-tideline-live-convex.mjs` (modified, +24/-5)
```diff
@@ -8,7 +8,9 @@
  * TIDELINE_CONVEX_BACKEND may supply the binary instead of --backend. This does
  * not use convex:dev, contact Convex Cloud, load provider credentials, change
  * repository environment files, or retain backend data/keys. Only redacted
- * results and logs remain in the printed temporary artifact directory. This is
+ * results and logs remain in the printed temporary artifact directory. Error
+ * details are printed to the console; reports retain fixed failure categories
+ * and local operation phases only. This is
  * a correctness/recovery probe with bounded load, not a scalability benchmark.
  */
 import assert from "node:assert/strict";
@@ -69,13 +71,22 @@ let ctx;
 let resetRuntimeContext;
 let activeChild;
 let cleaning;
+let phase = "setup";
 const sensitive = () => [instanceSecret, adminKey, safeEnv.BRIGADE_ENCRYPTION_KEY].filter(Boolean);
 const redact = (value) => sensitive().reduce((out, token) => out.split(token).join("[redacted]"), String(value));
 const envFiles = [".env.local", ".env"].map((file) => path.join(ROOT, file));
 const hashEnv = () => envFiles.map((file) => fs.existsSync(file) ? createHash("sha256").update(fs.readFileSync(file)).digest("hex") : null);
 const beforeEnv = hashEnv();
 const check = (name) => { results.checks.push(name); console.log(`PASS ${name}`); };
 
+// Error messages/stacks can contain network response data. Persist only fixed
+// categories; their full redacted diagnostics remain available in the console.
+const failureCategory = (error) => {
+  if (error?.name === "AssertionError") return "assertion";
+  if (error?.name === "TimeoutError" || error?.name === "AbortError") return "timeout";
+  return "operation";
+};
+
 function platformAsset() {
   const platforms = {
     "darwin-arm64": "aarch64-apple-darwin", "darwin-x64": "x86_64-apple-darwin",
@@ -185,7 +196,9 @@ for (const [signal, code] of [["SIGINT", 130], ["SIGTERM", 143]]) {
 try {
   fs.mkdirSync(project, { recursive: true, mode: 0o700 });
   fs.mkdirSync(stateDir, { recursive: true, mode: 0o700 });
+  phase = "resolving-backend";
   await resolveBinary();
+  phase = "preparing-backend";
   fs.cpSync(path.join(ROOT, "convex"), path.join(project, "convex"), { recursive: true, filter: (source) => {
     const rel = path.relative(path.join(ROOT, "convex"), source);
     // Keep generated API bindings; omit tsc's root-level JS/declaration copies
@@ -205,6 +218,7 @@ try {
   const envFile = path.join(project, "probe.env");
   fs.writeFileSync(envFile, `CONVEX_SELF_HOSTED_URL=${url}\nCONVEX_SELF_HOSTED_ADMIN_KEY=${adminKey}\n`, { mode: 0o600 });
   await startBackend();
+  phase = "deploying-functions";
   console.log("Backend ready on isolated loopback ports; deploying current copied functions.");
   const deploy = await run(process.execPath, [path.join(ROOT, "node_modules", "convex", "bin", "main.js"), "deploy", "--yes", "--env-file", envFile, "--typecheck", "disable", "--codegen", "disable"]);
   fs.writeFileSync(path.join(WORK, "deploy.log"), deploy);
@@ -230,6 +244,7 @@ try {
   const peer = { kind: "channel", channelId: "chat", conversationId: "room", sessionKey: "session" };
   const template = seedStore.write({ content: "Amber release gate is Friday.", segment: "project", sourceType: "owner_message", createdBy: owner, metadata: { approved: "amber-proof" } });
   const rootRecord = { ...template, memoryId: "root-record" };
+  phase = "encryption-origin-isolation";
   await memory.upsertFactRecordRaw("workspace-a", rootRecord);
   await memory.upsertFactRecordRaw("workspace-a", { ...template, memoryId: "peer-record", content: "Amber private channel gate is Monday.", createdBy: peer });
   await memory.upsertFactRecordRaw("workspace-b", { ...template, memoryId: "other-workspace", content: "Amber other workspace gate is Tuesday." });
@@ -243,6 +258,7 @@ try {
   for (const field of ["channelId", "conversationId", "sessionKey"]) assert.deepEqual(await memory.listFacts({ origin: { ...peer, [field]: "other"
```

**File**: `scripts/test-tideline-live-models.mjs` (modified, +18/-13)
```diff
@@ -11,6 +11,7 @@ import fs from "node:fs";
 import os from "node:os";
 import path from "node:path";
 import { createInterface } from "node:readline";
+import { providerReportErrorCategory, validateProviderAnswerText, validateProviderReportMetadata } from "./lib/tideline-live-report-validation.mjs";
 
 const root = fs.mkdtempSync(path.join(os.tmpdir(), "tideline-live-models-"));
 const state = path.join(root, "state");
@@ -67,16 +68,18 @@ async function complete(model, messages, label, extra = {}) {
    body: JSON.stringify(request), signal: AbortSignal.timeout(55000),
   });
   const data = await response.json();
-  Object.assign(entry, { httpStatus: response.status, latencyMs: Date.now() - started, generationId: data.id,
-   returnedModel: data.model, provider: data.provider, usage: data.usage, finishReason: data.choices?.[0]?.finish_reason });
+  Object.assign(entry, { httpStatus: response.status, latencyMs: Date.now() - started });
   // Error payloads may contain provider request details; never log/store them.
-  if (!response.ok || data.error || !data.choices?.[0]?.message) throw new Error(`provider response failed (${response.status})`);
+  if (!response.ok || data?.error || !data?.choices?.[0]?.message) throw new Error(`provider response failed (${response.status})`);
+  const metadata = validateProviderReportMetadata(data, { models: supportedModels, providers: Object.values(providerNames) });
+  Object.assign(entry, metadata);
   saveReport();
-  return { message: data.choices[0].message, usage: data.usage, requestId: id, finishReason: data.choices[0].finish_reason };
+  return { message: data.choices[0].message, usage: metadata.usage, requestId: id, finishReason: metadata.finishReason };
  } catch (error) {
-  Object.assign(entry, { failed: true, error: error.name, latencyMs: Date.now() - started });
+  const category = providerReportErrorCategory(error);
+  Object.assign(entry, { failed: true, error: category, latencyMs: Date.now() - started });
   saveReport();
-  throw new Error(`Live request ${id} (${label}) failed: ${error.name}`);
+  throw new Error(`Live request ${id} (${label}) failed: ${category}`);
  }
 }
 
@@ -111,10 +114,8 @@ function normalizeAnswer(content) {
 }
 
 async function modelToolRoundTrip(model, workspace) {
- const toolStore = new FactStore(workspace);
- let memory = Tideline.over(toolStore, { threatScan: { scan: scanForThreats } });
  for (const stage of ["write", "recall"]) {
-  memory = Tideline.over(new FactStore(workspace), { threatScan: { scan: scanForThreats } });
+  const memory = Tideline.over(new FactStore(workspace), { threatScan: { scan: scanForThreats } });
   const localTools = memoryMcpTools(memory, { origin: owner });
   const name = stage === "write" ? "memory_add" : "memory_search";
   const messages = [{ role: "system", content: "Use the memory tool to complete the request. After the tool result, answer briefly using its data." },
@@ -191,8 +192,9 @@ try {
        response_format: { type: "json_schema", json_schema: { name: "memory_answer", strict: true,
         schema: { type: "object", properties: { answer: { type: "string" } }, required: ["answer"], additionalProperties: false } } },
       });
-     const actual = normalizeAnswer(answer.message.content ?? "");
-     report.answers.push({ model, caseId: fixture.id, repetition, arm, expected: fixture.answer, actual, rawAnswer: answer.message.content ?? null, correct: actual === fixture.answer && answer.finishReason === "stop", finishReason: answer.finishReason, requestId: answer.requestId, usage: answer.usage });
+     const rawAnswer = validateProviderAnswerText(answer.message.content);
+     const actual = normalizeAnswer(rawAnswer ?? "");
+     report.answers.push({ model, caseId: fixture.id, repetition, arm, expected: fixture.answer, actual, rawAnswer, correct: actual === fixture.answer && answer.finishReason === "stop", finishReason: answer.finishReason, requestId: answer.requestId, usage: answer.usage });
      sa
```

**File**: `src/agents/memory/extract.ts` (modified, +0/-1)
```diff
@@ -25,7 +25,6 @@ import type { AgentSession } from "@earendil-works/pi-coding-agent";
 
 import { createSubsystemLogger } from "../../logging/subsystem-logger.js";
 import { pickInitialThinkingLevel } from "../../core/model-caps.js";
-import { workspaceIdFromDir } from "../../storage/facts-cache.js";
 import { tryGetRuntimeContext } from "../../storage/runtime-context.js";
 import { applyPersonaOverrideToSession } from "../../system-prompt/pi-injection.js";
 import { wrapStreamFnWithPayloadMutations } from "../payload-mutators.js";
```

**File**: `src/tideline/exports/vault.ts` (modified, +0/-1)
```diff
@@ -32,7 +32,6 @@ import { renameWithRetry } from "../../infra/fs/atomic-rename.js";
 import { cosine, getDefaultEmbedder } from "../embeddings/embedder.js";
 import { linksFrom, type MemoryLink, type MemoryLinkKind } from "../graph/links.js";
 import { originBucketKey, type MemoryRecord, type MemorySegment } from "../store/records.js";
-import { tokenize } from "../retrieval/scoring.js";
 
 const PIN_OPEN = "%% pinned %%";
 const PIN_CLOSE = "%% /pinned %%";
```

---

### Incident Patch 6: `06937210` (2026-09-09)
**Commit Message**: Merge pull request #165 from spinabot/fix/tideline-oss-checkpoint

fix(tideline): preserve memory behavior across reusable engine boundaries

**File**: `.gitignore` (modified, +3/-0)
```diff
@@ -5,6 +5,9 @@ dist/
 # Dependencies
 node_modules/
 
+# Local read-only upstream implementation references (not product dependencies).
+/references/tideline/
+
 # Logs
 *.log
 logs/
```

**File**: `docs/tideline.md` (modified, +91/-35)
```diff
@@ -2,20 +2,70 @@
 
 Tideline is the long-term memory framework that backs Brigade. It is a
 **model-agnostic memory engine** — it works with zero embedding model, learns from
-one if you give it, and is designed to be lifted out of Brigade and published on its
-own (`brigade-tideline`).
+one if you give it, and builds independently as `brigade-tideline` from the same
+implementation used by Brigade.
 
 Where a transcript is what an agent *just said*, Tideline is what an agent *knows*:
 durable facts about you and your work, written under a trust gate, recalled by
 meaning, decayed when stale, and reconciled over time.
 
-> TL;DR — append-only facts with origin scoping, a poisoning-resistant write gate,
+> TL;DR — JSONL-backed facts with origin scoping, a provenance write gate,
 > hybrid keyword+vector recall that needs no model to run, bi-temporal decay folded
 > into one score, a typed link graph, and a nightly reflect/consolidate pass. One
 > `Tideline` facade; a small adapter SPI underneath.
 
 ---
 
+## Source ownership
+
+`src/tideline/` owns the reusable memory implementation and its core tests.
+`src/agents/memory/` owns Brigade's extraction sessions, behavioral review,
+auto-recall, extension binding and optional storage integration. Old module paths
+are compatibility re-exports (or thin host adapters), not a second engine.
+
+The engine is grouped into `api`, `store`, `ports`, `retrieval`, `graph`,
+`embeddings`, `extraction`, `lifecycle`, `governance`, `exports`, `transports/mcp`
+and `eval`. Unit tests sit with their modules; cross-cutting boundary and
+end-to-end tests live in `tests`. The [source map](../src/tideline/README.md#source-layout)
+describes each group's responsibility. The three public package entries and
+Brigade's compatibility imports stay stable across this internal reorganization.
+
+The current primitives are records and origins, source trust/write gates,
+retrieval scores, typed links, lifecycle/retention, event history, injectable
+embeddings and evaluation cases. The optional `FactStoreHostPorts` inject a
+backend and logger per store; no Convex service is required by Tideline.
+
+The legacy synchronous `StorageAdapter` and JSONL default are not a distributed
+database abstraction. No new benchmark, compression or billing improvement is
+claimed by moving the code.
+
+### Asynchronous backend readiness and durability
+
+Filesystem calls remain synchronous. When using Brigade's optional asynchronous
+backend, await `store.ready()` (or `memory.ready()`) before the first operation,
+then await `store.flush()` (or `memory.flush()`) before reporting a mutation as
+durable. Both methods are no-ops for the default filesystem implementation.
+
+```ts
+await memory.ready();
+memory.add({ content: "The staging window starts Friday.", segment: "project" });
+await memory.flush();
+```
+
+A cold synchronous read now reports pending hydration instead of pretending the
+store is empty. Failed hydration is explicit; a later `ready()` retries a bounded
+fetch cycle. Failed writes remain pending and make `flush()` reject; a later flush
+retries them without replaying a superseded update or delete. Retry state is
+process-local, not a crash-durable write-ahead log. Fact flushing does not make
+best-effort event appends atomic with facts or establish distributed cache coherence.
+
+Brigade tools, extraction, auto-recall and scheduled maintenance use these
+barriers. MCP stdio uses the asynchronous request handler and drains pending
+requests before exit. Custom asynchronous MCP transports must use `handleAsync`,
+not the compatibility synchronous `handle` method.
+
+---
+
 ## Why it exists
 
 Most "agent memory" is a vector store with a similarity search bolted on. That
@@ -61,7 +111,7 @@ Segment defaults (`SEGMENT_DEFAULTS`) seed sensible tier/importance per segment
 ### 1. Write — gated and deduped
 
 ```
-add(fact) ──▶ write-gate ──▶ same-origin dedup ──▶ FactStore (append-only JSONL)
+add(fact) ──▶ content
```

**File**: `package.json` (modified, +3/-1)
```diff
@@ -57,11 +57,13 @@
     "postbuild": "node scripts/build-done.mjs",
     "postinstall": "node scripts/brand-oauth-page.mjs",
     "build:watch": "tsc -p tsconfig.build.json --watch",
+    "build:tideline": "node scripts/build-tideline.mjs",
+    "test:tideline-package": "npm run build:tideline && node scripts/test-tideline-package.mjs",
     "clean": "node -e \"import('node:fs').then(fs => fs.rmSync('dist', { recursive: true, force: true }))\"",
     "prepack": "npm run build",
     "test": "node scripts/run-tests.mjs",
     "test:mutation": "node scripts/mutation-check.mjs",
-    "bench": "npx tsx --test src/agents/memory/eval/comparison.test.ts src/agents/memory/eval/gold-hard.test.ts src/agents/memory/eval/gold-parity.test.ts src/agents/memory/eval/asr-bench.test.ts",
+    "bench": "node --import tsx --test src/tideline/eval/comparison.test.ts src/tideline/eval/gold-hard.test.ts src/agents/memory/eval/gold-parity.test.ts src/tideline/eval/asr-bench.test.ts",
     "typecheck": "tsc -p tsconfig.json --noEmit",
     "brigade": "node brigade.mjs",
     "start": "node scripts/run-brigade.mjs",
```

**File**: `scripts/build-tideline.mjs` (modified, +116/-111)
```diff
@@ -1,124 +1,129 @@
-/**
- * Build the publishable `brigade-tideline` package.
- *
- * The in-repo extraction layer (src/tideline/) re-exports the memory core from
- * src/agents/memory/*, which reaches Brigade host code through ONE seam —
- * `agents/memory/host-ports.ts`. This build produces a self-contained npm package by:
- *   1. esbuild-bundling the 3 entries (index/advanced/eval) with that seam aliased to
- *      the filesystem-only `host-ports.standalone.ts` → self-contained ESM, zero `../` escapes.
- *   2. emitting .d.ts from a TEMP source tree where the seam is PHYSICALLY swapped, so the
- *      types are self-contained and Brigade-free too.
- *   3. writing the package.json (paths repointed at the bundles) + README.
- *
- * Output: dist/tideline/  (npm pack-able).  Run: `npm run build:tideline`.
- */
+/** Build the canonical Tideline engine, without swapping or stubbing host code. */
 import esbuild from "esbuild";
-import { execFileSync } from "node:child_process";
 import fs from "node:fs";
+import { isBuiltin } from "node:module";
+import os from "node:os";
 import path from "node:path";
+import { fileURLToPath } from "node:url";
+import ts from "typescript";
 
-const ROOT = process.cwd();
+const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
 const SRC = path.join(ROOT, "src");
-const OUT = path.join(ROOT, "dist", "tideline");
-const TMP = path.join(ROOT, "dist", ".tideline-build");
-const STANDALONE = path.join(SRC, "tideline", "host-ports.standalone.ts");
-const log = (m) => console.log(`▌ ${m}`);
-
-fs.rmSync(OUT, { recursive: true, force: true });
-fs.rmSync(TMP, { recursive: true, force: true });
-fs.mkdirSync(OUT, { recursive: true });
-
-// ── 1. bundle JS, swapping the host seam ──────────────────────────────────────
-const swap = {
-	name: "host-ports-swap",
-	setup(b) {
-		b.onResolve({ filter: /\/host-ports\.js$/ }, () => ({ path: STANDALONE }));
-	},
-};
-const entries = {
-	index: path.join(SRC, "tideline", "index.ts"),
-	advanced: path.join(SRC, "tideline", "advanced.ts"),
-	eval: path.join(SRC, "tideline", "eval.ts"),
-};
-const result = await esbuild.build({
-	entryPoints: entries,
-	outdir: OUT,
-	bundle: true,
-	format: "esm",
-	platform: "node",
-	target: "node22",
-	metafile: true,
-	plugins: [swap],
-	logLevel: "warning",
-});
-if (result.warnings.length) {
-	console.error("esbuild warnings:", result.warnings);
+const ENGINE = path.join(SRC, "tideline");
+// Brigade's normal tsc build owns dist/tideline. Never replace that directory.
+const OUT = path.join(ROOT, "dist", "packages", "tideline");
+const brigadeOutput = path.join(ROOT, "dist", "tideline");
+if (OUT === brigadeOutput || brigadeOutput.startsWith(`${OUT}${path.sep}`)) {
+	throw new Error("Standalone output must not replace Brigade's compiled engine");
 }
-log(`bundled index/advanced/eval → dist/tideline (warnings: ${result.warnings.length})`);
+const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "tideline-package-build-"));
+const staged = path.join(workDir, "package");
+const entries = Object.fromEntries(["index", "advanced", "eval"].map((name) => [name, path.join(ENGINE, `${name}.ts`)]));
 
-// ── 2. derive the exact graph source set from the metafile ────────────────────
-const inputs = Object.keys(result.metafile.inputs)
-	.map((p) => path.resolve(ROOT, p))
-	.filter((p) => p.startsWith(SRC) && p.endsWith(".ts"));
-log(`graph: ${inputs.length} source files`);
-
-// ── 3. temp tree with the seam physically swapped → emit .d.ts ────────────────
-for (const abs of inputs) {
-	if (abs === STANDALONE) continue; // becomes agents/memory/host-ports.ts below
-	const dest = path.join(TMP, path.relative(SRC, abs));
-	fs.mkdirSync(path.dirname(dest), { recursive: true });
-	fs.copyFileSync(abs, dest);
+// Shared helpers, not Brigade runtime bindings. Both runtime and erased
+// type-only dependency closures must stay inside this explicit boundary.
+const sharedHelpers = new Set([
+	path.join(SRC, "security"
```

**File**: `scripts/test-tideline-live-convex.mjs` (added, +315/-0)
```diff
@@ -0,0 +1,315 @@
+#!/usr/bin/env node
+/**
+ * Opt-in integration probe against a disposable, self-hosted Convex backend.
+ *
+ *   node --import tsx scripts/test-tideline-live-convex.mjs --backend /path/to/convex-local-backend
+ *   node --import tsx scripts/test-tideline-live-convex.mjs --download
+ *
+ * TIDELINE_CONVEX_BACKEND may supply the binary instead of --backend. This does
+ * not use convex:dev, contact Convex Cloud, load provider credentials, change
+ * repository environment files, or retain backend data/keys. Only redacted
+ * results and logs remain in the printed temporary artifact directory. This is
+ * a correctness/recovery probe with bounded load, not a scalability benchmark.
+ */
+import assert from "node:assert/strict";
+import { spawn, spawnSync } from "node:child_process";
+import { createHash, randomBytes } from "node:crypto";
+import { once } from "node:events";
+import fs from "node:fs";
+import { createRequire } from "node:module";
+import net from "node:net";
+import os from "node:os";
+import path from "node:path";
+import { Readable } from "node:stream";
+import { pipeline } from "node:stream/promises";
+import { fileURLToPath, pathToFileURL } from "node:url";
+
+const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
+const RELEASE = "precompiled-2026-06-03-7eff2e7";
+const HELP = "Usage: node --import tsx scripts/test-tideline-live-convex.mjs (--backend <binary> | --download)\nAlternatively set TIDELINE_CONVEX_BACKEND. No cloud deployment or model calls.";
+let suppliedBinary = process.env.TIDELINE_CONVEX_BACKEND;
+let download = false;
+for (let i = 2; i < process.argv.length; i++) {
+  const arg = process.argv[i];
+  if (arg === "--help" || arg === "-h") { console.log(HELP); process.exit(0); }
+  if (arg === "--backend" && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")) suppliedBinary = process.argv[++i];
+  else if (arg === "--download") download = true;
+  else throw new Error(`Unknown or incomplete argument: ${arg}\n${HELP}`);
+}
+if (Boolean(suppliedBinary) === download) throw new Error(`Choose exactly one backend source.\n${HELP}`);
+
+const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "brigade-live-convex-"));
+const RUN = path.join(WORK, "runtime");
+const project = path.join(RUN, "project");
+const stateDir = path.join(RUN, "brigade-state");
+const require = createRequire(path.join(ROOT, "package.json"));
+const results = { release: suppliedBinary ? "externally-supplied-binary" : RELEASE, started: new Date().toISOString(), checks: [], timings: {} };
+const instanceSecret = randomBytes(32).toString("hex");
+const instanceName = "brigade-memory-probe";
+// An allowlist, not a provider denylist: OPENROUTER and future provider/auth
+// variables are excluded automatically. The CLI gets an inert access-token
+// override so it never consults a user's cloud login configuration.
+const inheritedKeys = new Set(["PATH", "Path", "PATHEXT", "SYSTEMROOT", "SystemRoot", "WINDIR", "COMSPEC", "TMPDIR", "TMP", "TEMP", "LANG", "LC_ALL", "LC_CTYPE", "TZ"]);
+const safeEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => inheritedKeys.has(key)));
+Object.assign(safeEnv, {
+  CI: "1", BRIGADE_STATE_DIR: stateDir,
+  BRIGADE_ENCRYPTION_KEY: randomBytes(32).toString("hex"),
+  BRIGADE_ENCRYPTION_KEY_FILE: path.join(RUN, "unused-key"),
+  CONVEX_OVERRIDE_ACCESS_TOKEN: "isolated-self-hosted-probe-unused-token",
+  DISABLE_BEACON: "1",
+});
+let binary = suppliedBinary ? path.resolve(suppliedBinary) : undefined;
+let backend;
+let backendLog = "";
+let port;
+let sitePort;
+let adminKey;
+let url;
+let ctx;
+let resetRuntimeContext;
+let activeChild;
+let cleaning;
+const sensitive = () => [instanceSecret, adminKey, safeEnv.BRIGADE_ENCRYPTION_KEY].filter(Boolean);
+const redact = (value) => sensitive().reduce((out, token) => out.split(token).join("[redacted]"), String(value));
+const envFiles = [".env.local", ".env"].map((file) => path.join(ROOT, file))
```

---

### Incident Patch 7: `257dc4f9` (2026-09-09)
**Commit Message**: fix(tideline): preserve memory behavior across reusable engine boundaries

Keep one canonical memory engine with compatibility adapters and isolated package builds. Make backend readiness and flush failures explicit, advertise memory mutations in gateway discovery, and avoid question-scaffolding false-positive recall. Retain migration coverage and add opt-in live validation probes without private follow-on research.

**File**: `.gitignore` (modified, +3/-0)
```diff
@@ -5,6 +5,9 @@ dist/
 # Dependencies
 node_modules/
 
+# Local read-only upstream implementation references (not product dependencies).
+/references/tideline/
+
 # Logs
 *.log
 logs/
```

**File**: `docs/tideline.md` (modified, +91/-35)
```diff
@@ -2,20 +2,70 @@
 
 Tideline is the long-term memory framework that backs Brigade. It is a
 **model-agnostic memory engine** — it works with zero embedding model, learns from
-one if you give it, and is designed to be lifted out of Brigade and published on its
-own (`brigade-tideline`).
+one if you give it, and builds independently as `brigade-tideline` from the same
+implementation used by Brigade.
 
 Where a transcript is what an agent *just said*, Tideline is what an agent *knows*:
 durable facts about you and your work, written under a trust gate, recalled by
 meaning, decayed when stale, and reconciled over time.
 
-> TL;DR — append-only facts with origin scoping, a poisoning-resistant write gate,
+> TL;DR — JSONL-backed facts with origin scoping, a provenance write gate,
 > hybrid keyword+vector recall that needs no model to run, bi-temporal decay folded
 > into one score, a typed link graph, and a nightly reflect/consolidate pass. One
 > `Tideline` facade; a small adapter SPI underneath.
 
 ---
 
+## Source ownership
+
+`src/tideline/` owns the reusable memory implementation and its core tests.
+`src/agents/memory/` owns Brigade's extraction sessions, behavioral review,
+auto-recall, extension binding and optional storage integration. Old module paths
+are compatibility re-exports (or thin host adapters), not a second engine.
+
+The engine is grouped into `api`, `store`, `ports`, `retrieval`, `graph`,
+`embeddings`, `extraction`, `lifecycle`, `governance`, `exports`, `transports/mcp`
+and `eval`. Unit tests sit with their modules; cross-cutting boundary and
+end-to-end tests live in `tests`. The [source map](../src/tideline/README.md#source-layout)
+describes each group's responsibility. The three public package entries and
+Brigade's compatibility imports stay stable across this internal reorganization.
+
+The current primitives are records and origins, source trust/write gates,
+retrieval scores, typed links, lifecycle/retention, event history, injectable
+embeddings and evaluation cases. The optional `FactStoreHostPorts` inject a
+backend and logger per store; no Convex service is required by Tideline.
+
+The legacy synchronous `StorageAdapter` and JSONL default are not a distributed
+database abstraction. No new benchmark, compression or billing improvement is
+claimed by moving the code.
+
+### Asynchronous backend readiness and durability
+
+Filesystem calls remain synchronous. When using Brigade's optional asynchronous
+backend, await `store.ready()` (or `memory.ready()`) before the first operation,
+then await `store.flush()` (or `memory.flush()`) before reporting a mutation as
+durable. Both methods are no-ops for the default filesystem implementation.
+
+```ts
+await memory.ready();
+memory.add({ content: "The staging window starts Friday.", segment: "project" });
+await memory.flush();
+```
+
+A cold synchronous read now reports pending hydration instead of pretending the
+store is empty. Failed hydration is explicit; a later `ready()` retries a bounded
+fetch cycle. Failed writes remain pending and make `flush()` reject; a later flush
+retries them without replaying a superseded update or delete. Retry state is
+process-local, not a crash-durable write-ahead log. Fact flushing does not make
+best-effort event appends atomic with facts or establish distributed cache coherence.
+
+Brigade tools, extraction, auto-recall and scheduled maintenance use these
+barriers. MCP stdio uses the asynchronous request handler and drains pending
+requests before exit. Custom asynchronous MCP transports must use `handleAsync`,
+not the compatibility synchronous `handle` method.
+
+---
+
 ## Why it exists
 
 Most "agent memory" is a vector store with a similarity search bolted on. That
@@ -61,7 +111,7 @@ Segment defaults (`SEGMENT_DEFAULTS`) seed sensible tier/importance per segment
 ### 1. Write — gated and deduped
 
 ```
-add(fact) ──▶ write-gate ──▶ same-origin dedup ──▶ FactStore (append-only JSONL)
+add(fact) ──▶ content
```

**File**: `package.json` (modified, +3/-1)
```diff
@@ -57,11 +57,13 @@
     "postbuild": "node scripts/build-done.mjs",
     "postinstall": "node scripts/brand-oauth-page.mjs",
     "build:watch": "tsc -p tsconfig.build.json --watch",
+    "build:tideline": "node scripts/build-tideline.mjs",
+    "test:tideline-package": "npm run build:tideline && node scripts/test-tideline-package.mjs",
     "clean": "node -e \"import('node:fs').then(fs => fs.rmSync('dist', { recursive: true, force: true }))\"",
     "prepack": "npm run build",
     "test": "node scripts/run-tests.mjs",
     "test:mutation": "node scripts/mutation-check.mjs",
-    "bench": "npx tsx --test src/agents/memory/eval/comparison.test.ts src/agents/memory/eval/gold-hard.test.ts src/agents/memory/eval/gold-parity.test.ts src/agents/memory/eval/asr-bench.test.ts",
+    "bench": "node --import tsx --test src/tideline/eval/comparison.test.ts src/tideline/eval/gold-hard.test.ts src/agents/memory/eval/gold-parity.test.ts src/tideline/eval/asr-bench.test.ts",
     "typecheck": "tsc -p tsconfig.json --noEmit",
     "brigade": "node brigade.mjs",
     "start": "node scripts/run-brigade.mjs",
```

**File**: `scripts/build-tideline.mjs` (modified, +116/-111)
```diff
@@ -1,124 +1,129 @@
-/**
- * Build the publishable `brigade-tideline` package.
- *
- * The in-repo extraction layer (src/tideline/) re-exports the memory core from
- * src/agents/memory/*, which reaches Brigade host code through ONE seam —
- * `agents/memory/host-ports.ts`. This build produces a self-contained npm package by:
- *   1. esbuild-bundling the 3 entries (index/advanced/eval) with that seam aliased to
- *      the filesystem-only `host-ports.standalone.ts` → self-contained ESM, zero `../` escapes.
- *   2. emitting .d.ts from a TEMP source tree where the seam is PHYSICALLY swapped, so the
- *      types are self-contained and Brigade-free too.
- *   3. writing the package.json (paths repointed at the bundles) + README.
- *
- * Output: dist/tideline/  (npm pack-able).  Run: `npm run build:tideline`.
- */
+/** Build the canonical Tideline engine, without swapping or stubbing host code. */
 import esbuild from "esbuild";
-import { execFileSync } from "node:child_process";
 import fs from "node:fs";
+import { isBuiltin } from "node:module";
+import os from "node:os";
 import path from "node:path";
+import { fileURLToPath } from "node:url";
+import ts from "typescript";
 
-const ROOT = process.cwd();
+const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
 const SRC = path.join(ROOT, "src");
-const OUT = path.join(ROOT, "dist", "tideline");
-const TMP = path.join(ROOT, "dist", ".tideline-build");
-const STANDALONE = path.join(SRC, "tideline", "host-ports.standalone.ts");
-const log = (m) => console.log(`▌ ${m}`);
-
-fs.rmSync(OUT, { recursive: true, force: true });
-fs.rmSync(TMP, { recursive: true, force: true });
-fs.mkdirSync(OUT, { recursive: true });
-
-// ── 1. bundle JS, swapping the host seam ──────────────────────────────────────
-const swap = {
-	name: "host-ports-swap",
-	setup(b) {
-		b.onResolve({ filter: /\/host-ports\.js$/ }, () => ({ path: STANDALONE }));
-	},
-};
-const entries = {
-	index: path.join(SRC, "tideline", "index.ts"),
-	advanced: path.join(SRC, "tideline", "advanced.ts"),
-	eval: path.join(SRC, "tideline", "eval.ts"),
-};
-const result = await esbuild.build({
-	entryPoints: entries,
-	outdir: OUT,
-	bundle: true,
-	format: "esm",
-	platform: "node",
-	target: "node22",
-	metafile: true,
-	plugins: [swap],
-	logLevel: "warning",
-});
-if (result.warnings.length) {
-	console.error("esbuild warnings:", result.warnings);
+const ENGINE = path.join(SRC, "tideline");
+// Brigade's normal tsc build owns dist/tideline. Never replace that directory.
+const OUT = path.join(ROOT, "dist", "packages", "tideline");
+const brigadeOutput = path.join(ROOT, "dist", "tideline");
+if (OUT === brigadeOutput || brigadeOutput.startsWith(`${OUT}${path.sep}`)) {
+	throw new Error("Standalone output must not replace Brigade's compiled engine");
 }
-log(`bundled index/advanced/eval → dist/tideline (warnings: ${result.warnings.length})`);
+const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "tideline-package-build-"));
+const staged = path.join(workDir, "package");
+const entries = Object.fromEntries(["index", "advanced", "eval"].map((name) => [name, path.join(ENGINE, `${name}.ts`)]));
 
-// ── 2. derive the exact graph source set from the metafile ────────────────────
-const inputs = Object.keys(result.metafile.inputs)
-	.map((p) => path.resolve(ROOT, p))
-	.filter((p) => p.startsWith(SRC) && p.endsWith(".ts"));
-log(`graph: ${inputs.length} source files`);
-
-// ── 3. temp tree with the seam physically swapped → emit .d.ts ────────────────
-for (const abs of inputs) {
-	if (abs === STANDALONE) continue; // becomes agents/memory/host-ports.ts below
-	const dest = path.join(TMP, path.relative(SRC, abs));
-	fs.mkdirSync(path.dirname(dest), { recursive: true });
-	fs.copyFileSync(abs, dest);
+// Shared helpers, not Brigade runtime bindings. Both runtime and erased
+// type-only dependency closures must stay inside this explicit boundary.
+const sharedHelpers = new Set([
+	path.join(SRC, "security"
```

**File**: `scripts/test-tideline-live-convex.mjs` (added, +315/-0)
```diff
@@ -0,0 +1,315 @@
+#!/usr/bin/env node
+/**
+ * Opt-in integration probe against a disposable, self-hosted Convex backend.
+ *
+ *   node --import tsx scripts/test-tideline-live-convex.mjs --backend /path/to/convex-local-backend
+ *   node --import tsx scripts/test-tideline-live-convex.mjs --download
+ *
+ * TIDELINE_CONVEX_BACKEND may supply the binary instead of --backend. This does
+ * not use convex:dev, contact Convex Cloud, load provider credentials, change
+ * repository environment files, or retain backend data/keys. Only redacted
+ * results and logs remain in the printed temporary artifact directory. This is
+ * a correctness/recovery probe with bounded load, not a scalability benchmark.
+ */
+import assert from "node:assert/strict";
+import { spawn, spawnSync } from "node:child_process";
+import { createHash, randomBytes } from "node:crypto";
+import { once } from "node:events";
+import fs from "node:fs";
+import { createRequire } from "node:module";
+import net from "node:net";
+import os from "node:os";
+import path from "node:path";
+import { Readable } from "node:stream";
+import { pipeline } from "node:stream/promises";
+import { fileURLToPath, pathToFileURL } from "node:url";
+
+const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
+const RELEASE = "precompiled-2026-06-03-7eff2e7";
+const HELP = "Usage: node --import tsx scripts/test-tideline-live-convex.mjs (--backend <binary> | --download)\nAlternatively set TIDELINE_CONVEX_BACKEND. No cloud deployment or model calls.";
+let suppliedBinary = process.env.TIDELINE_CONVEX_BACKEND;
+let download = false;
+for (let i = 2; i < process.argv.length; i++) {
+  const arg = process.argv[i];
+  if (arg === "--help" || arg === "-h") { console.log(HELP); process.exit(0); }
+  if (arg === "--backend" && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")) suppliedBinary = process.argv[++i];
+  else if (arg === "--download") download = true;
+  else throw new Error(`Unknown or incomplete argument: ${arg}\n${HELP}`);
+}
+if (Boolean(suppliedBinary) === download) throw new Error(`Choose exactly one backend source.\n${HELP}`);
+
+const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "brigade-live-convex-"));
+const RUN = path.join(WORK, "runtime");
+const project = path.join(RUN, "project");
+const stateDir = path.join(RUN, "brigade-state");
+const require = createRequire(path.join(ROOT, "package.json"));
+const results = { release: suppliedBinary ? "externally-supplied-binary" : RELEASE, started: new Date().toISOString(), checks: [], timings: {} };
+const instanceSecret = randomBytes(32).toString("hex");
+const instanceName = "brigade-memory-probe";
+// An allowlist, not a provider denylist: OPENROUTER and future provider/auth
+// variables are excluded automatically. The CLI gets an inert access-token
+// override so it never consults a user's cloud login configuration.
+const inheritedKeys = new Set(["PATH", "Path", "PATHEXT", "SYSTEMROOT", "SystemRoot", "WINDIR", "COMSPEC", "TMPDIR", "TMP", "TEMP", "LANG", "LC_ALL", "LC_CTYPE", "TZ"]);
+const safeEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => inheritedKeys.has(key)));
+Object.assign(safeEnv, {
+  CI: "1", BRIGADE_STATE_DIR: stateDir,
+  BRIGADE_ENCRYPTION_KEY: randomBytes(32).toString("hex"),
+  BRIGADE_ENCRYPTION_KEY_FILE: path.join(RUN, "unused-key"),
+  CONVEX_OVERRIDE_ACCESS_TOKEN: "isolated-self-hosted-probe-unused-token",
+  DISABLE_BEACON: "1",
+});
+let binary = suppliedBinary ? path.resolve(suppliedBinary) : undefined;
+let backend;
+let backendLog = "";
+let port;
+let sitePort;
+let adminKey;
+let url;
+let ctx;
+let resetRuntimeContext;
+let activeChild;
+let cleaning;
+const sensitive = () => [instanceSecret, adminKey, safeEnv.BRIGADE_ENCRYPTION_KEY].filter(Boolean);
+const redact = (value) => sensitive().reduce((out, token) => out.split(token).join("[redacted]"), String(value));
+const envFiles = [".env.local", ".env"].map((file) => path.join(ROOT, file))
```

---

### Incident Patch 8: `18ddd51d` (2026-09-06)
**Commit Message**: Merge pull request #164 from spinabot/fix/lost-pairing-challenge

docs(readme): add Trendshift badge

**File**: `README.md` (modified, +4/-0)
```diff
@@ -44,6 +44,10 @@
   <code>brigade bloody&nbsp;benchmark</code> &nbsp;·&nbsp; <code>brigade expose</code> &nbsp;·&nbsp; <code>brigade expose stop</code> &nbsp;🩸
 </p>
 
+<p align="center">
+  <a href="https://trendshift.io/repositories/118354?utm_source=trendshift-badge&amp;utm_medium=badge&amp;utm_campaign=badge-trendshift-118354" target="_blank" rel="noopener noreferrer"><img src="https://trendshift.io/api/badge/trendshift/repositories/118354/daily?language=TypeScript" alt="spinabot/brigade on Trendshift" width="250" height="55" /></a>
+</p>
+
 <p align="center">
   <a href="https://github.com/spinabot/brigade/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/spinabot/brigade/ci.yml?branch=main&style=for-the-badge&logo=githubactions&logoColor=white&label=CI" alt="CI status"></a>
   <a href="https://www.npmjs.com/package/@spinabot/brigade"><img src="https://img.shields.io/npm/v/@spinabot/brigade?style=for-the-badge&logo=npm&logoColor=white&color=CB3837" alt="npm version"></a>
```

---

### Incident Patch 9: `d6c45586` (2026-09-02)
**Commit Message**: Merge pull request #162 from spinabot/fix/lost-pairing-challenge

fix: iMessage replies were lost, spend was wrong or invisible, and one session's context painted another's

**File**: `src/agents/channels/imessage/send.test.ts` (modified, +87/-0)
```diff
@@ -215,3 +215,90 @@ describe("sendMessageIMessage — refuses to claim an unconfirmed delivery", ()
 		assert.equal(r.messageId, "ok");
 	});
 });
+
+// ─────────────────────────────────────────────────────────────────────────
+// A reply that cannot be threaded is still a reply.
+//
+// `reply_to` needs the bridge transport; the AppleScript fallback rejects it,
+// and that used to kill the whole send. The message it cost most often is the
+// pairing challenge — the one that tells a new sender how to get authorised —
+// so losing it leaves them messaging into silence with no way to find out why.
+// Observed live: "sendText failed … reply_to requires bridge transport".
+// ─────────────────────────────────────────────────────────────────────────
+describe("sendMessageIMessage — threaded-reply fallback", () => {
+	class ReplyRejectingClient implements IMessageRpcLike {
+		attempts: Array<Record<string, unknown>> = [];
+		constructor(private readonly message: string) {}
+		async start(): Promise<void> {}
+		async stop(): Promise<void> {}
+		async request<T = unknown>(_m: string, params?: unknown): Promise<T> {
+			const p = (params ?? {}) as Record<string, unknown>;
+			// Snapshot: the sender reuses one params object across the retry, so
+			// recording the reference would show both attempts as the second one.
+			this.attempts.push({ ...p });
+			if (p.reply_to !== undefined) throw new Error(this.message);
+			return { message_id: "M-9" } as T;
+		}
+		async waitForClose(): Promise<void> {}
+	}
+
+	it("retries flat when the transport cannot thread", async () => {
+		const client = new ReplyRejectingClient(
+			"Invalid params: code=-32602 reply_to requires bridge transport; AppleScript fallback cannot send threaded replies",
+		);
+		const res = await sendMessageIMessage("+15551234567", "you need to pair", {
+			client,
+			replyToId: "p:1",
+		});
+		assert.equal(res.messageId, "M-9", "the reply still went out");
+		assert.equal(client.attempts.length, 2, "threaded first, then flat");
+		assert.equal(client.attempts[0]?.reply_to, "p:1");
+		assert.equal(client.attempts[1]?.reply_to, undefined);
+		assert.equal(client.attempts[1]?.text, "you need to pair", "same message, unthreaded");
+	});
+
+	it("does NOT retry a send the bridge refused for a real reason", async () => {
+		// Re-sending something the bridge already refused is worse than not
+		// sending it, so the fallback is narrow on purpose.
+		const client = new ReplyRejectingClient("no such handle");
+		await assert.rejects(
+			() => sendMessageIMessage("+15551234567", "hi", { client, replyToId: "p:1" }),
+			/no such handle/,
+		);
+		assert.equal(client.attempts.length, 1, "failed once, did not retry");
+	});
+
+	// Error shapes the narrow first version missed. OpenClaw's equivalent
+	// predicate matches all of these against the same `imsg` binary.
+	for (const msg of [
+		"cannot send threaded replies",
+		"threaded replies are unavailable",
+		"threaded reply not supported on this transport",
+	]) {
+		it(`recognises: ${msg}`, async () => {
+			const client = new ReplyRejectingClient(msg);
+			const res = await sendMessageIMessage("+15551234567", "hi", { client, replyToId: "p:1" });
+			assert.equal(res.messageId, "M-9", "fell back to a flat send");
+			assert.equal(client.attempts.length, 2);
+		});
+	}
+
+	it("does NOT retry an unrelated bridge-transport refusal", async () => {
+		// The shipped imsg binary contains `send.tracked requires bridge
+		// transport` — a different RPC's capability error. Matching it would
+		// re-send a message the bridge deliberately refused.
+		const client = new ReplyRejectingClient("send.tracked requires bridge transport");
+		await assert.rejects(
+			() => sendMessageIMessage("+15551234567", "hi", { client, replyToId: "p:1" }),
+			/send\.tracked/,
+		);
+		assert.equal(client.attempts.length, 1, "failed once, did not retry");
+	});
+
+	it("does not retry when there was no reply_to to drop", async () => {
+		const client =
```

**File**: `src/agents/channels/imessage/send.ts` (modified, +75/-2)
```diff
@@ -81,6 +81,46 @@ function resolveMessageId(result: unknown): string | null {
  * Send an iMessage. `to` is the target string; `opts.chatId` (when set) wins and
  * forces a `chat_id:` target. Resolves the message id (or a coarse fallback).
  */
+/**
+ * Does this error mean the transport cannot thread replies, as opposed to the
+ * send being refused for a real reason?
+ *
+ * Matched on the bridge's own wording. Deliberately narrow: a broad match here
+ * would retry sends that genuinely failed, and re-sending a message the bridge
+ * already refused is worse than not sending it.
+ */
+export function isThreadingUnsupported(err: unknown): boolean {
+	const m = err instanceof Error ? err.message : String(err);
+	// Pattern widened to match OpenClaw's `isThreadedReplyUnsupportedError`,
+	// which drives the same fallback against the same `imsg` binary and has
+	// therefore already met the error shapes this one had not. The narrower
+	// first version required the literal `reply_to`, so a bridge that said only
+	// "threaded replies are unavailable" would have been treated as a real
+	// failure and lost the message — the exact bug being fixed.
+	// MUST NAME THE REPLY/THREADING FEATURE, not just a transport requirement.
+	//
+	// OpenClaw's equivalent carries a bare `requires bridge transport`
+	// alternation, and the shipped `imsg` binary (0.14.2) contains a real,
+	// unrelated string that matches it:
+	//
+	//     send.tracked requires bridge transport
+	//
+	// That is a different RPC method than the `send` this file issues, so it is
+	// not reachable today — but a predicate one bridge release away from
+	// re-sending a message that was refused for an unrelated capability reason
+	// is not a predicate worth keeping. Requiring BOTH a reply/threading token
+	// and a refusal token keeps every intended case and drops that one.
+	//
+	// The cost of being wrong in the other direction is small: a bridge that
+	// refuses a threaded reply without naming it simply fails, as it did before
+	// this fallback existed. Not retrying is always safe; retrying a genuinely
+	// refused send is not.
+	const mentionsThreading = /reply_to|threaded repl/iu.test(m);
+	const mentionsRefusal =
+		/bridge transport|cannot send|unsupported|not supported|unavailable|requires/iu.test(m);
+	return mentionsThreading && mentionsRefusal;
+}
+
 export async function sendMessageIMessage(
 	to: string,
 	text: string,
@@ -155,9 +195,42 @@ export async function sendMessageIMessage(
 			: await createIMessageRpcClient({ cliPath, dbPath }));
 	const shouldClose = !opts.client;
 	try {
-		const result = await client.request<{ ok?: string } & Record<string, unknown>>("send", params, {
+		const requestOpts = {
 			...(opts.timeoutMs !== undefined ? { timeoutMs: opts.timeoutMs } : {}),
-		});
+		};
+		let result: ({ ok?: string } & Record<string, unknown>) | undefined;
+		try {
+			result = await client.request<{ ok?: string } & Record<string, unknown>>(
+				"send",
+				params,
+				requestOpts,
+			);
+		} catch (err) {
+			// A REPLY THAT CANNOT BE THREADED IS STILL A REPLY.
+			//
+			// `reply_to` needs the bridge transport; the AppleScript fallback
+			// rejects it outright:
+			//
+			//   "reply_to requires bridge transport; AppleScript fallback cannot
+			//    send threaded replies"
+			//
+			// That killed the whole send. Threading is a nicety — being ANSWERED
+			// is not — and the message this cost most often is the pairing
+			// challenge, which is the one that tells a new sender how to get
+			// authorised. Losing it leaves them messaging into silence with no
+			// way to discover why, which is exactly what it looks like from the
+			// other end: a bot that is simply ignoring you.
+			//
+			// So: drop the threading and send it flat. Only for this specific
+			// refusal — any other failure is still a failure.
+			if (!replyTo || !isThreadingUnsupported(err)) throw err;
+			delete params.reply_to;
+			result = await client.request<{ 
```

**File**: `src/agents/usage/ledger.ts` (modified, +95/-0)
```diff
@@ -228,6 +228,66 @@ export class UsageLedger {
 	 * Idempotent: only the FIRST seed applies, so re-attaching a live session
 	 * cannot double its history.
 	 */
+	/**
+	 * Whether this session's history has already been folded in.
+	 *
+	 * Exposed so a caller can skip the READ that produces the stats, not just
+	 * the seed. Rebuilding totals means walking a whole transcript, and on a
+	 * busy gateway `resume` is called often enough that doing it per reconnect
+	 * would be a real cost for an answer that cannot change.
+	 */
+	hasSeeded(agentId: string, sessionKey: string): boolean {
+		return this.entries.get(this.key(agentId, sessionKey))?.seeded === true;
+	}
+
+	/**
+	 * Seed from the ledger's OWN previously-persisted totals.
+	 *
+	 * Distinct from `seedFromStats` in one way that matters: this restores
+	 * `costComplete` as recorded rather than inferring it from `cost > 0`.
+	 * Inferring it turns a session that honestly rendered `≥$22.27` — because
+	 * most of its turns came back unpriced — into a confident `$22.27`, which is
+	 * precisely the "unmeasured reads as measured" failure this module exists to
+	 * refuse. Measured on a real transcript: 169 of 207 assistant turns unpriced.
+	 *
+	 * Idempotent for the same reason `seedFromStats` is: whichever seed lands
+	 * first wins, and a later one must not reset a bucket that live turns have
+	 * since moved on from.
+	 */
+	seedFromPersisted(
+		agentId: string,
+		sessionKey: string,
+		rec: {
+			input: number;
+			output: number;
+			cacheRead: number;
+			cacheWrite: number;
+			costUsd: number;
+			costComplete: boolean;
+			turns: number;
+		},
+	): void {
+		const e = this.touch(agentId, sessionKey);
+		if (e.seeded) return;
+		e.seeded = true;
+		e.committed = {
+			input: num(rec.input),
+			output: num(rec.output),
+			cacheRead: num(rec.cacheRead),
+			cacheWrite: num(rec.cacheWrite),
+			totalTokens:
+				num(rec.input) + num(rec.output) + num(rec.cacheRead) + num(rec.cacheWrite),
+			costUsd: num(rec.costUsd),
+			costComplete: rec.costComplete === true,
+		};
+		e.turns = num(rec.turns);
+	}
+
+	/** Turn count, for persisting alongside the totals. */
+	turnsFor(agentId: string, sessionKey: string): number {
+		return this.peek(agentId, sessionKey)?.turns ?? 0;
+	}
+
 	seedFromStats(
 		agentId: string,
 		sessionKey: string,
@@ -321,6 +381,41 @@ export class UsageLedger {
 		return addTotals(addTotals(e.committed, e.inFlight ?? emptyTotals()), e.outOfBand);
 	}
 
+	/**
+	 * Where a session's spend actually went.
+	 *
+	 * `outOfBandByKind` has been populated since it was introduced and read by
+	 * nothing, so the question its own doc comment poses — "where did the spend
+	 * go" — had no answer on any surface. A turn that fanned out to sub-agents
+	 * and triggered a compaction showed one total with no way to see that most
+	 * of it was not the conversation itself.
+	 *
+	 * Only non-empty kinds are returned, so a plain session stays a plain
+	 * answer rather than four zeros.
+	 */
+	breakdown(
+		agentId: string,
+		sessionKey: string,
+	): { own: UsageTotals; byKind: Partial<Record<OutOfBandKind, UsageTotals>> } {
+		const e = this.peek(agentId, sessionKey);
+		if (!e) return { own: emptyTotals(), byKind: {} };
+		const byKind: Partial<Record<OutOfBandKind, UsageTotals>> = {};
+		for (const [kind, totals] of Object.entries(e.outOfBandByKind)) {
+			if (!totals) continue;
+			if (totals.totalTokens > 0 || totals.costUsd > 0) {
+				byKind[kind as OutOfBandKind] = totals;
+			}
+		}
+		// `own` is the session's own loop — committed plus anything in flight —
+		// so `own` + the kinds always reconciles to `displayTotals`.
+		return { own: addTotals(e.committed, e.inFlight ?? emptyTotals()), byKind };
+	}
+
+	/** The LRU bound, so a caller can say whether a rollup was truncated. */
+	capacity(): number {
+		return this.maxSessions;
+	}
+
 	/** Every session this agent has a ledger for. */
 	forAgent(agentId: string): SessionUsage[] {
 		return [...th
```

**File**: `src/agents/usage/persist.test.ts` (added, +183/-0)
```diff
@@ -0,0 +1,183 @@
+import { strict as assert } from "node:assert";
+import { mkdtempSync } from "node:fs";
+import os from "node:os";
+import path from "node:path";
+import { afterEach, describe, it } from "node:test";
+
+import { upsertSessionEntry } from "../../sessions/session-store.js";
+import { UsageLedger } from "./ledger.js";
+import { persistSessionUsage, readPersistedSessionUsage } from "./persist.js";
+
+const realHome = process.env.HOME;
+const realState = process.env.BRIGADE_STATE_DIR;
+function isolate(...sessionKeys: string[]): void {
+	const d = mkdtempSync(path.join(os.tmpdir(), "brigade-usage-"));
+	process.env.HOME = d;
+	process.env.BRIGADE_STATE_DIR = d;
+	// `updateSessionEntry` deliberately refuses to CREATE an entry — persisting
+	// usage for a session the store has never heard of would invent a row. In
+	// production the entry exists long before the first `turn_end`, so the test
+	// has to establish it too.
+	for (const k of sessionKeys) upsertSessionEntry("main", k, { sessionId: `sid-${k}` });
+}
+afterEach(() => {
+	if (realHome === undefined) delete process.env.HOME;
+	else process.env.HOME = realHome;
+	if (realState === undefined) delete process.env.BRIGADE_STATE_DIR;
+	else process.env.BRIGADE_STATE_DIR = realState;
+});
+
+describe("persisted session usage", () => {
+	it("round-trips the totals a restart would otherwise lose", () => {
+		isolate("agent:main:main");
+		persistSessionUsage(
+			"main",
+			"agent:main:main",
+			{ input: 22, output: 673, cacheRead: 98560, cacheWrite: 457294, costUsd: 4.6392, costComplete: true },
+			11,
+		);
+		const back = readPersistedSessionUsage("main", "agent:main:main");
+		assert.ok(back);
+		assert.equal(back.output, 673);
+		assert.equal(back.cacheRead + back.cacheWrite, 555854);
+		assert.ok(Math.abs(back.costUsd - 4.6392) < 1e-9);
+		assert.equal(back.turns, 11);
+	});
+
+	it("preserves costComplete=false — a floor must not become a fact", () => {
+		// The failure this guards: a session whose turns came back unpriced
+		// rendered `≥$12.00`, and inferring completeness from `cost > 0` turned
+		// it into a confident `$12.00`. Measured on a real transcript: 169 of 207
+		// assistant turns unpriced.
+		isolate("s1");
+		persistSessionUsage(
+			"main",
+			"s1",
+			{ input: 1, output: 1, cacheRead: 0, cacheWrite: 0, costUsd: 12, costComplete: false },
+			3,
+		);
+		assert.equal(readPersistedSessionUsage("main", "s1")?.costComplete, false);
+	});
+
+	it("reports absent rather than zero when nothing was ever written", () => {
+		// THE DISTINCTION THAT MATTERS. Seeding a session with zeros marks it
+		// seeded, which permanently suppresses the turn-attach seed that has the
+		// real history — so "never written" must never look like "genuinely zero".
+		isolate();
+		assert.equal(readPersistedSessionUsage("main", "never-seen"), undefined);
+	});
+
+	it("treats an all-zero record as absent for the same reason", () => {
+		isolate("s2");
+		persistSessionUsage(
+			"main",
+			"s2",
+			{ input: 0, output: 0, cacheRead: 0, cacheWrite: 0, costUsd: 0, costComplete: true },
+			0,
+		);
+		assert.equal(readPersistedSessionUsage("main", "s2"), undefined);
+	});
+
+	it("keeps sessions separate", () => {
+		isolate("a", "b");
+		persistSessionUsage("main", "a", { input: 0, output: 5, cacheRead: 0, cacheWrite: 0, costUsd: 1, costComplete: true }, 1);
+		persistSessionUsage("main", "b", { input: 0, output: 9, cacheRead: 0, cacheWrite: 0, costUsd: 2, costComplete: true }, 1);
+		assert.equal(readPersistedSessionUsage("main", "a")?.output, 5);
+		assert.equal(readPersistedSessionUsage("main", "b")?.output, 9);
+	});
+});
+
+describe("ledger seeding from a persisted record", () => {
+	const rec = {
+		input: 22, output: 673, cacheRead: 98560, cacheWrite: 457294,
+		costUsd: 4.6392, costComplete: false, turns: 11,
+	};
+
+	it("restores spend before any turn runs", () => {
+		const l = new UsageLedger();
+		assert.equal(l.displayTotals("main", "s1").output, 0)
```

**File**: `src/agents/usage/persist.ts` (added, +130/-0)
```diff
@@ -0,0 +1,130 @@
+/**
+ * Durable session spend.
+ *
+ * ─────────────────────────────────────────────────────────────────────────
+ * WHY NOT REBUILD FROM THE TRANSCRIPT
+ * ─────────────────────────────────────────────────────────────────────────
+ * `UsageLedger` is in-memory, so a gateway restart zeroes every session's
+ * spend and a reconnecting client showed `0 billed` until its first turn. The
+ * obvious repair — fold the transcript's per-message `usage` on resume — was
+ * tried and rejected under review, because it creates a SECOND definition of
+ * one number, and the two disagree:
+ *
+ *   • Pi's `getSessionStats()` (what the turn-attach seed uses) counts only
+ *     messages after the last compaction's `firstKeptEntryId`; a fold over the
+ *     file counts everything. Measured on a real transcript: $18.16 vs $22.28,
+ *     22.7% apart, with WHICHEVER SEEDS FIRST winning — so the same thread
+ *     reported a different total depending on whether a client resumed or a
+ *     channel message arrived first after a restart.
+ *   • Rewind is non-destructive, so the file also holds abandoned branches.
+ *   • In Convex mode `readTranscript` defaults to the OLDEST 1000 records, so
+ *     the "uncapped" read silently truncated long threads — and because seeding
+ *     is idempotent, that undercount could never be corrected.
+ *   • It cost a second full read of a transcript that can reach 137 MB, ~480 ms
+ *     of synchronous parsing on the gateway's shared event loop.
+ *
+ * None of that is fixable by patching the fold, because the disagreement is
+ * about what the number MEANS. So the ledger's own answer is persisted instead:
+ * what is written is exactly what was displayed, including out-of-band spend
+ * (sub-agents, compaction, memory sweeps) that no transcript fold can recover,
+ * and the `costComplete` flag that says whether the total is exact or a floor.
+ *
+ * The store already exists and is already written per session — this rides
+ * alongside `leafEntryId` rather than introducing a file to keep in sync.
+ *
+ * A session last written by an older build has no record; it seeds nothing and
+ * becomes correct after its next turn. That is a one-turn migration, and it is
+ * strictly better than seeding a number known to be wrong.
+ */
+
+import { readSessionStore, updateSessionEntry } from "../../sessions/session-store.js";
+
+/** The persisted shape. Deliberately flat and boring — it is read by a future build. */
+export interface PersistedUsage {
+	input: number;
+	output: number;
+	cacheRead: number;
+	cacheWrite: number;
+	costUsd: number;
+	/** False when ANY contribution had an unknown cost, so the UI can say `≥`. */
+	costComplete: boolean;
+	/** Provider round-trips, for the turn counter. */
+	turns: number;
+	/** Epoch ms, so a stale record is recognisable. */
+	at: number;
+}
+
+function num(v: unknown): number {
+	return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0;
+}
+
+/**
+ * Persist a session's current totals.
+ *
+ * Best-effort by contract: bookkeeping must never fail a turn, so every error
+ * is swallowed. The in-memory ledger remains authoritative for this process.
+ */
+export function persistSessionUsage(
+	agentId: string,
+	sessionKey: string,
+	totals: {
+		input: number;
+		output: number;
+		cacheRead: number;
+		cacheWrite: number;
+		costUsd: number;
+		costComplete?: boolean;
+	},
+	turns: number,
+): void {
+	try {
+		const rec: PersistedUsage = {
+			input: num(totals.input),
+			output: num(totals.output),
+			cacheRead: num(totals.cacheRead),
+			cacheWrite: num(totals.cacheWrite),
+			costUsd: num(totals.costUsd),
+			costComplete: totals.costComplete === true,
+			turns: num(turns),
+			at: Date.now(),
+		};
+		updateSessionEntry(agentId, sessionKey, { usageTotals: rec });
+	} catch {
+		/* a store write must never fail a turn */
+	}
+}
+
+/**
+ * Read back a session's persisted totals, or undefined when there are none.
+ *
+ * Returns undefined
```

---

### Incident Patch 10: `16ea43ff` (2026-09-02)
**Commit Message**: fix(gateway): subscribe handed out another agent's spend with no access check

`resume`, `sessions.list`, `sessions.history` and `sessions.rewind` all run the
sessions access check. `subscribe` did not — and it is strictly more powerful
than a read: it takes an arbitrary agentId/sessionId off the wire, registers the
connection for that session's FUTURE frames, and immediately pushes a snapshot
carrying its token totals, cost, billing mode, cost-completeness, pinned
provider and model, agent name and running state.

So with `visibility: "self"` and A2A disabled, `resume` on `agent:ops:main` was
refused while `subscribe {agentId:"ops"}` returned the same agent's spend and
identity. Single-operator scope makes that a guard inconsistency rather than a
tenant break, but it is a bypass on the one surface carrying billing data, and
it is the surface third-party clients (desktop, watch, plugins) use.

The target is built explicitly rather than through
`extractSessionTargetFromParams`, which reads `sessionKey` and `agentId` but not
this method's `sessionId` — the generic helper would have guarded the agent-wide
case and silently missed the session-specific one, which is the worse of the two

**File**: `src/core/server.ts` (modified, +45/-0)
```diff
@@ -5234,6 +5234,51 @@ async function continueBoot(args: BootContinueArgs): Promise<ServerHandle> {
 					};
 				try {
 					if (reqFrame.method === "subscribe") {
+						// GUARD THE SUBSCRIPTION, NOT JUST THE READS.
+						//
+						// `resume`, `sessions.list`, `sessions.history` and
+						// `sessions.rewind` all run the sessions access check; this
+						// surface did not — and it is strictly more powerful than a
+						// read. It takes an arbitrary agentId/sessionId off the wire,
+						// registers the connection for that session's FUTURE frames,
+						// and immediately pushes a snapshot carrying its spend, cost,
+						// billing mode, pinned provider/model and agent name. With
+						// `visibility: "self"` and A2A disabled, `resume` on another
+						// agent refused while this handed back the same data.
+						//
+						// The target is built explicitly rather than via
+						// `extractSessionTargetFromParams`, which reads `sessionKey`
+						// and `agentId` but not this method's `sessionId` — so the
+						// generic helper would have guarded the agent-wide case and
+						// silently missed the session-specific one.
+						const subTarget =
+							typeof p.sessionId === "string" && p.sessionId.trim().length > 0
+								? p.sessionId.trim()
+								: typeof p.agentId === "string" && p.agentId.trim().length > 0
+									? defaultSessionKey(p.agentId.trim())
+									: undefined;
+						if (subTarget) {
+							const verdict = sessionsAccessCheck({
+								action: "list",
+								targetSessionKey: subTarget,
+							});
+							if (!verdict.allowed) {
+								const denied: Frame = {
+									type: "res",
+									id: reqFrame.id,
+									ok: false,
+									error: { code: "forbidden", message: verdict.reason ?? "forbidden" },
+								};
+								if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(denied));
+								opts.consoleStream?.wsResponse(
+									reqFrame.method,
+									reqFrame.id,
+									false,
+									Date.now() - startedAt,
+								);
+								return;
+							}
+						}
 						if (p.agentId) subscribeAgent(connId, p.agentId.trim());
 						if (p.sessionId) subscribeSession(connId, p.sessionId.trim());
 						// Full frames are the default; `deltas: true` opts a client IN
```

#### Recent Merged Pull Requests:
- **PR #172** (2026-09-15): chore(main): release brigade 1.39.0 (@github-actions[bot])
- **PR #171** (2026-09-15): feat(team): add durable collaboration mode (@Bhasvanth-Dev9380)
- **PR #170** (2026-09-10): docs: add FitBBC to the Brigadiers wall, and fix the bot that should have (@Bhasvanth-Dev9380)
- **PR #169** (2026-09-10): chore(main): release brigade 1.38.0 (@github-actions[bot])
- **PR #168** (2026-09-10): feat(providers): add Token Market (@FitBBC)
- **PR #167** (2026-09-09): fix(validation): constrain provider data before saving probe evidence (@Bhasvanth-Dev9380)
- **PR #166** (2026-09-09): chore(main): release brigade 1.37.1 (@github-actions[bot])
- **PR #165** (2026-09-09): fix(tideline): preserve memory behavior across reusable engine boundaries (@Bhasvanth-Dev9380)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
