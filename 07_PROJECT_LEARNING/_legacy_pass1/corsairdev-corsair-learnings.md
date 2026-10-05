# Forensic Learning Record (Deep Inspection): corsairdev/corsair

> **Canonical Artifact**: `07_PROJECT_LEARNING/corsairdev-corsair-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/corsairdev/corsair](https://github.com/corsairdev/corsair))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:24:47.098Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `corsairdev/corsair`
- **Description**: Connect your users to their apps
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 13352 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `adapters/langchain/src/index.check.ts`
```
import assert from 'node:assert/strict';
import { z } from 'zod';
import { corsairTools } from './index.js';

// Offline fake instance — no DB or network (mirrors tests/adapters.test.ts).
const CORSAIR_INTERNAL = Symbol.for('corsair:internal');
// Recorded tool args: already validated by each tool's Zod schema, shape is
// arbitrary per operation, so Record<string, unknown> is the honest type here.
const calls: Record<string, unknown>[] = [];
const plugin = {
	id: 'demo',
	endpoints: { channels: { list: () => {} } },
	endpointMeta: {
		'channels.list': { riskLevel: 'low', description: 'List channels' },
	},
	endpointSchemas: {
		'channels.list': {
			input: z.object({ channel: z.string() }),
			output: z.object({ ok: z.boolean() }),
		},
	},
};
const instance = {
	[CORSAIR_INTERNAL]: { plugins: [plugin] },
	demo: {
		api: {
			channels: {
				list: async (args: Record<string, unknown>) => {
					calls.push(args);
					return { ok: true, args };
				},
			},
		},
	},
};

const tools = await corsairTools({
	corsair: instance as never,
	operations: ['demo.api.channels.list'],
});
assert.equal(tools.length, 1);
const [list] = tools;
assert.ok(list);
assert.equal(list.name, 'demo_api_channels_list');
assert.equal(list.description, 'List channels');

// The tool validates args against the schema, invokes the operation, and returns
// the JSON-encoded result as model-visible content.
const out = await list.invoke({ channel: 'C1' });
assert.deepEqual(calls, [{ channel: 'C1' }]);
assert.equal(out, JSON.stringify({ ok: true, args: { channel: 'C1' } }));

// A bad arg is rejected by the schema before the operation runs.
await assert.rejects(() => list.invoke({} as never));
assert.deepEqual(calls, [{ channel: 'C1' }]);

console.log('ok: @corsair-dev/langchain');

```

### Core Architecture Module: `adapters/langchain/src/index.ts`
```
/** @packageDocumentation */

import type { DynamicStructuredTool } from '@langchain/core/tools';
import type { AnyCorsairInstance, BuildCorsairToolsOptions } from 'corsair';
import { buildCorsairTools } from 'corsair';

export interface CorsairToolsOptions extends BuildCorsairToolsOptions {
	/** The value returned by `createCorsair()` (or `corsair.withTenant(...)`). */
	corsair: AnyCorsairInstance;
}

/**
 * Builds LangChain tools for a Corsair instance's API operations — one tool per
 * operation — ready to hand to `createAgent({ tools })` or `model.bindTools(...)`.
 * Scope which operations with `plugin`, `operations`, and `tenantId`.
 *
 * @example
 * ```ts
 * import { createAgent } from 'langchain';
 * import { corsairTools } from '@corsair-dev/langchain';
 *
 * const tools = await corsairTools({ corsair, plugin: 'slack' });
 * const agent = createAgent({ model: 'openai:gpt-5.4-mini', tools });
 * ```
 */
export async function corsairTools(
	options: CorsairToolsOptions,
): Promise<DynamicStructuredTool[]> {
	const { corsair, ...build } = options;
	// Dynamic import keeps the optional peer out of the static graph, so this
	// package can be re-exported without forcing @langchain/core on every consumer.
	const { tool } = await import('@langchain/core/tools').catch((err) => {
		throw new Error(
			'@corsair-dev/langchain needs "@langchain/core" installed as a peer dependency.',
			{ cause: err },
		);
	});
	return buildCorsairTools(corsair, build).map((op) =>
		tool(
			// LangChain validates against op.schema before calling; arg shape is arbitrary here
			async (args: Record<string, unknown>) =>
				toContent(await op.execute(args)),
			{
				name: op.name,
				description: op.description,
				schema: op.schema,
			},
		),
	) as DynamicStructuredTool[]; // op.schema is ZodTypeAny; inference can't resolve DynamicStructuredTool
}

/**
 * LangChain tool content is model-visible text; non-string results are JSON-encoded.
 * `result` is `unknown` because Corsair operation return shapes vary per plugin.
 */
function toContent(result: unknown): string {
	if (typeof result === 'string') return result;
	return JSON.stringify(result) ?? String(result); // JSON.stringify(undefined) is undefined
}

```

### Core Architecture Module: `adapters/langchain/tsup.config.ts`
```
import { defineConfig } from 'tsup';

export default defineConfig({
	entry: ['src/index.ts'],
	format: ['esm'],
	target: 'esnext',
	platform: 'node',
	dts: false,
	clean: true,
	outDir: 'dist',
	external: ['corsair', '@langchain/core'],
});

```

### Core Architecture Module: `adapters/llamaindex/src/index.check.ts`
```
import assert from 'node:assert/strict';
import { z } from 'zod';
import { corsairTools } from './index.js';

// Offline fake instance — no DB or network (mirrors tests/adapters.test.ts).
const CORSAIR_INTERNAL = Symbol.for('corsair:internal');
// Recorded tool args: already validated by each tool's Zod schema, shape is
// arbitrary per operation, so Record<string, unknown> is the honest type here.
const calls: Record<string, unknown>[] = [];
const plugin = {
	id: 'demo',
	endpoints: { channels: { list: () => {} } },
	endpointMeta: {
		'channels.list': { riskLevel: 'low', description: 'List channels' },
	},
	endpointSchemas: {
		'channels.list': {
			input: z.object({ channel: z.string() }),
			output: z.object({ ok: z.boolean() }),
		},
	},
};
const instance = {
	[CORSAIR_INTERNAL]: { plugins: [plugin] },
	demo: {
		api: {
			channels: {
				list: async (args: Record<string, unknown>) => {
					calls.push(args);
					return { ok: true, args };
				},
			},
		},
	},
};

const tools = await corsairTools({
	corsair: instance as never,
	operations: ['demo.api.channels.list'],
});
assert.equal(tools.length, 1);
const [list] = tools;
assert.ok(list);
assert.equal(list.metadata.name, 'demo_api_channels_list');
assert.equal(list.metadata.description, 'List channels');

// The tool invokes the operation and returns the JSON-encoded result as content.
const out = await list.call({ channel: 'C1' });
assert.deepEqual(calls, [{ channel: 'C1' }]);
assert.equal(out, JSON.stringify({ ok: true, args: { channel: 'C1' } }));

// A bad arg is rejected by the schema before the operation runs.
await assert.rejects(async () => list.call({} as never));
assert.deepEqual(calls, [{ channel: 'C1' }]);

console.log('ok: @corsair-dev/llamaindex');

```

### Core Architecture Module: `adapters/llamaindex/src/index.ts`
```
/** @packageDocumentation */

import type { BaseToolWithCall } from '@llamaindex/core/llms';
import type { AnyCorsairInstance, BuildCorsairToolsOptions } from 'corsair';
import { buildCorsairTools } from 'corsair';

export interface CorsairToolsOptions extends BuildCorsairToolsOptions {
	/** The value returned by `createCorsair()` (or `corsair.withTenant(...)`). */
	corsair: AnyCorsairInstance;
}

/**
 * Builds LlamaIndex tools for a Corsair instance's API operations — one tool per
 * operation — ready to hand to `agent({ tools })`. Scope which operations with
 * `plugin`, `operations`, and `tenantId`.
 *
 * @example
 * ```ts
 * import { agent } from '@llamaindex/workflow';
 * import { openai } from '@llamaindex/openai';
 * import { corsairTools } from '@corsair-dev/llamaindex';
 *
 * const tools = await corsairTools({ corsair, plugin: 'slack' });
 * const slackAgent = agent({ tools, llm: openai({ model: 'gpt-4.1-mini' }) });
 * ```
 */
export async function corsairTools(
	options: CorsairToolsOptions,
): Promise<BaseToolWithCall[]> {
	const { corsair, ...build } = options;
	// Dynamic import keeps the optional peer out of the static graph, so this
	// package can be re-exported without forcing @llamaindex/core on every consumer.
	const { tool } = await import('@llamaindex/core/tools').catch((err) => {
		throw new Error(
			'@corsair-dev/llamaindex needs "@llamaindex/core" installed as a peer dependency.',
			{ cause: err },
		);
	});
	return buildCorsairTools(corsair, build).map((op) =>
		tool({
			name: op.name,
			description: op.description,
			// Corsair is on Zod v4, which @llamaindex/core accepts directly.
			parameters: op.schema,
			// args is typed as unknown by the LlamaIndex tool callback signature;
			// parse through op.schema so invalid model-generated inputs are rejected
			// before reaching the Corsair operation.
			execute: async (args: unknown) => {
				// ZodTypeAny.parse() returns unknown; safe to cast because all op
				// schemas are z.object(...) at the top level.
				const parsed = op.schema.parse(args ?? {}) as Record<string, unknown>;
				return toContent(await op.execute(parsed));
			},
		}),
	);
}

/**
 * LlamaIndex tool output is model-visible; non-string results are JSON-encoded.
 * `result` is `unknown` because Corsair operation return shapes vary per plugin.
 */
function toContent(result: unknown): string {
	if (typeof result === 'string') return result;
	return JSON.stringify(result) ?? String(result); // JSON.stringify(undefined) is undefined
}

```

### Core Architecture Module: `adapters/llamaindex/tsup.config.ts`
```
import { defineConfig } from 'tsup';

export default defineConfig({
	entry: ['src/index.ts'],
	format: ['esm'],
	target: 'esnext',
	platform: 'node',
	dts: false,
	clean: true,
	outDir: 'dist',
	external: ['corsair', '@llamaindex/core'],
});

```

### Core Architecture Module: `adapters/mastra/src/corsair-tool-provider.check.ts`
```
import assert from 'node:assert/strict';
import type { CorsairToolProviderConfig } from './corsair-tool-provider.js';
import {
	CorsairToolProvider,
	decodeConnectionId,
	encodeConnectionId,
	mapAuthStatus,
	parseOperationPaths,
} from './corsair-tool-provider.js';

// connectionId encodes (tenant, toolkit) and round-trips
const id = encodeConnectionId('acme', 'github');
assert.deepEqual(decodeConnectionId(id), {
	tenantId: 'acme',
	toolkit: 'github',
});

// tenants with awkward characters survive the round-trip
const weird = encodeConnectionId('tenant:with:colons', 'slack');
assert.deepEqual(decodeConnectionId(weird), {
	tenantId: 'tenant:with:colons',
	toolkit: 'slack',
});

// garbage decodes to null, not a throw
assert.equal(decodeConnectionId('not-base64url-json'), null);
assert.equal(decodeConnectionId(''), null);

// auth status mapping: only a live credential completes the flow; everything
// else stays pending so an in-progress authorize poll is not aborted.
assert.equal(mapAuthStatus('connected'), 'completed');
assert.equal(mapAuthStatus('missing_credentials'), 'pending');
assert.equal(mapAuthStatus('not_connected'), 'pending');
assert.equal(mapAuthStatus(undefined), 'pending');

// operation-path parsing tolerates blank lines and whitespace
assert.deepEqual(
	parseOperationPaths('github.api.repos.list\n\n  github.api.issues.list  \n'),
	['github.api.repos.list', 'github.api.issues.list'],
);
assert.deepEqual(parseOperationPaths(''), []);

// ── resolveTenant precedence (tenant isolation) ─────────────────────────────
// A stub Corsair whose management methods record the tenant they were called
// with, so we can assert which tenant each request resolved to.
function providerWith(
	tenantId: CorsairToolProviderConfig['tenantId'],
	seen: { tenant?: string },
) {
	const corsair = {
		manage: {
			connect: {
				createLink: async ({ tenantId }: { tenantId?: string }) => {
					seen.tenant = tenantId;
					return { connectUrl: 'https://connect.example', tenantId };
				},
			},
			connectionStatus: {
				get: async ({ tenantId }: { tenantId?: string }) => {
					seen.tenant = tenantId;
					return {};
				},
			},
		},
	};
	return new CorsairToolProvider({
		// Test double implementing only the `manage` methods this check exercises.
		corsair: corsair as unknown as CorsairToolProviderConfig['corsair'],
		tenantId,
	});
}

// A pinned tenant wins: a connectionId claiming another tenant cannot override it.
{
	const seen: { tenant?: string } = {};
	await providerWith('acme', seen).getConnectionStatus({
		items: [
			{ connectionId: encodeConnectionId('victim', 'slack'), toolkit: 'slack' },
		],
	});
	assert.equal(seen.tenant, 'acme');
}

// Caller known + connectionId for a different tenant → rejected (no cross-tenant).
await assert.rejects(
	providerWith(undefined, {}).resolveToolsVNext({
		toolSlugs: ['slack.api.channels.list'],
		authorId: 'alice',
		connectionId: encodeConnectionId('bob', 'slack'),
		toolkit: 'slack',
		toolMeta: {},
	}),
	/cross-tenant/,
);

// Fresh connection + function resolver + no context → throws, never silently
// opens OAuth under a fallback tenant. (A fresh authorize carries an opaque
// connectionId Mastra minted, which does not decode to our tenant format.)
await assert.rejects(
	providerWith(() => 'x', {}).authorize({
		toolkit: 'slack',
		connectionId: 'fresh-opaque-connection',
	}),
	/cannot resolve a tenant for a new connection/,
);

// Pinned happy path: authorize uses the pin and mints a matching authId.
{
	const seen: { tenant?: string } = {};
	const res = await providerWith('acme', seen).authorize({
		toolkit: 'slack',
		connectionId: 'fresh-opaque-connection',
	});
	assert.equal(seen.tenant, 'acme');
	assert.equal(res.authId, encodeConnectionId('acme', 'slack'));
}

// No caller context (getConnectionStatus): the connectionId is the tenant source
// even when a function resolver is configured.
{
	const seen: { tenant?: string } = {};
	await providerWith(() => 'ignored', seen).getConnectionStatus({
		items: [
			{ connectionId: encodeConnectionId('real', 'slack'), toolkit: 'slack' },
		],
	});
	assert.equal(seen.tenant, 'real');
}

// resolveToolsVNext refuses a slug that is not an exposed API operation, so a
// caller cannot execute a management/non-API path (CWE-470). An instance with
// no plugins exposes no operations, so every slug is out of the allowed set.
{
	const emptyInstance = {
		[Symbol.for('corsair:internal')]: { plugins: [] },
	} as unknown as CorsairToolProviderConfig['corsair'];
	await assert.rejects(
		new CorsairToolProvider({
			corsair: emptyInstance,
			tenantId: 'acme',
		}).resolveToolsVNext({
			toolSlugs: ['manage.disconnect'],
			connectionId: encodeConnectionId('acme', 'slack'),
			toolkit: 'slack',
			toolMeta: {},
		}),
		/not an exposed API operation/,
	);
}

console.log('corsair-tool-provider.check: all assertions passed');

```

### Core Architecture Module: `adapters/mastra/src/corsair-tool-provider.live.check.ts`
```
import assert from 'node:assert/strict';
import { createCorsair } from 'corsair/core';
import { createTestDatabase } from 'corsair/tests';
import {
	CorsairToolProvider,
	encodeConnectionId,
} from './corsair-tool-provider.js';

// Runs against a REAL corsair instance (not a hand-written stub), so the
// provider's assumptions about corsair.manage are checked against the actual
// namespace. A stubbed manage previously hid a `manage.status` vs
// `manage.connectionStatus` mismatch that only surfaced on a live authorize poll.
const testDb = createTestDatabase();
const corsair = createCorsair({
	plugins: [],
	database: testDb.db,
	kek: 'test-kek-12345678901234567890123456789012',
});
const provider = new CorsairToolProvider({
	corsair,
	tenantId: 'dev',
});

const cid = encodeConnectionId('dev', 'github');

// The three methods that go through corsair.manage.connectionStatus.
const cs = await provider.getConnectionStatus({
	items: [{ connectionId: cid, toolkit: 'github' }],
});
assert.deepEqual(cs, { [cid]: { connected: false } });

assert.equal(await provider.getAuthStatus(cid), 'pending');

// getToolSchema returns null (not a throw) for an operation the instance
// doesn't expose; the JSON-schema path is exercised live via the editor.
assert.equal(await provider.getToolSchema('github.api.repos.list'), null);

// revokeConnection is idempotent: an unreadable connectionId is a no-op, not a
// throw (the real disconnect path is covered by corsair's disconnect.test.ts).
await provider.revokeConnection('not-a-valid-connection-id');

const conns = await provider.listConnections({
	userId: 'dev',
	toolkit: 'github',
});
assert.equal(conns.items.length, 0);

// P1 regression: an existing connectionId is authoritative over a function
// tenantId resolver, so a connection stays on the tenant it was created for
// (authorize and resolveToolsVNext cannot diverge). The throwing resolver would
// run only if connectionId precedence were lost.
const fnProvider = new CorsairToolProvider({
	corsair,
	tenantId: () => {
		throw new Error('resolver must not run when a connectionId is present');
	},
});
const boundId = encodeConnectionId('bound-tenant', 'github');
const bound = await fnProvider.getConnectionStatus({
	items: [{ connectionId: boundId, toolkit: 'github' }],
});
assert.deepEqual(bound, { [boundId]: { connected: false } });

testDb.cleanup();
console.log('corsair-tool-provider.live.check.ts passed');

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1784** (2026-09-29): **Skill docs list an invalid npm corsair command**
  *Symptoms*: `skills/corsair/SKILL.md:162` tells users to run `npm corsair list`, with two more variants on the next lines. Npm has no `corsair` subcommand, so that fails with Unknown command. The CLI package in `packages/cli/package.json:9` exposes a `corsair` bin meant to run through `npx corsair` or the package manager exec, as `packages/cli/README.md:17` shows. Anyone following the skill verbatim stalls at verification. Change the three run lines to `npx corsair` and the docs match the actual install model.    This one is reserved for first-time contributors. Returning contributors, please try one of the other medium issues instead.

- **Issue #1783** (2026-09-30): **formatRelativeTime renders NaNmo ago and never shows years**
  *Symptoms*: `formatRelativeTime` in `www/src/app/oss/relative-time.ts:9` builds seconds with `Math.max` over a date subtraction. Any `Math.max` with `NaN` returns `NaN`, so an invalid date fails every unit check and falls through to the months fallback as literal `NaNmo ago`. There is no year unit, so 800 days renders as months, and the `Math.max` with 1 forces brand new and future timestamps to `1s ago`. Callers in `www/src/app/oss/activity-feed.tsx:42` and claim timeline pass stored strings straight through. Guard invalid dates, add a year unit, and handle the just now case, with the first unit test file for this util.    This one is reserved for first-time contributors. Returning contributors, please try one of the other medium issues instead.
  **Post-Mortem & Fix Analysis**:
  > @ambikeesshh can you assign me this issue 
  > @MauryaQbit assigned

- **Issue #1781** (2026-09-30): **Twilio credential split truncates tokens with colons**
  *Symptoms*: Six call sites in `packages/twilio/endpoints/messages.ts:12` and `packages/twilio/endpoints/calls.ts:12` split the stored key on every colon and take index 1 as the token. A token that itself contains colons loses everything after the second colon, so a correct stored key produces wrong basic auth and a 401. The fix is to split on the first colon only with `indexOf` plus `slice`, move that into one shared helper, and replace all six sites. Unit tests should cover plain token, sid plus token, and token with extra colons.    This one is reserved for first-time contributors. Returning contributors, please try one of the other medium issues instead.
  **Post-Mortem & Fix Analysis**:
  > Hi! I'd like to take this one — it would be my first contribution to Corsair.  Plan: - Add a shared helper in `packages/twilio` (e.g. `parseTwilioKey(key)`) that splits on the **first** colon only (`indexOf` + `slice`), returning `{ accountSid, authToken }`, with a plain token (no colon) returned as-is. - Replace the 5 call sites in `endpoints/messages.ts` (3) and `endpoints/calls.ts` (2) that currently use `split(':')[1]` — the issue mentions 6, I found 5, happy to be corrected. - Add unit tests for: plain token, `sid:token`, and a token that itself contains colons.  Could you assign it to me? 

- **Issue #1780** (2026-09-29): **Twilio keyBuilder returns empty string on missing auth**
  *Symptoms*: `keyBuilder` in `packages/twilio/index.ts:275` returns empty string at four sites when credentials are absent. Other plugins throw `AuthMissingError` in that case, and this file never imports that error. An empty key flows into endpoint URL building as `Accounts//Messages.json` with bogus basic auth, so users see a confusing transport 401 instead of a clear auth missing error. The openai pattern in `packages/openai/index.ts:1308` shows the intended behavior. Throw `AuthMissingError` for twilio api_key at those sites and add a unit test for the empty keystore case.    This one is reserved for first-time contributors. Returning contributors, please try one of the other medium issues instead.
  **Post-Mortem & Fix Analysis**:
  > Opened a PR for this: https://github.com/corsairdev/corsair/pull/1793

- **Issue #712** (2026-08-18): **fix(vercel): fail closed when webhook secret is empty**
  *Symptoms*: ## What's wrong  `verifyVercelWebhookSignature` in `packages/vercel/webhooks/types.ts` will `createHmac('sha1', secret)` even if `secret` is `''`.  ## Change  Add `if (!secret) return false;` before the HMAC. This helper returns a boolean, so no error string.  Leave the existing signature-header and `timingSafeEqual` logic alone.  ## Check  Empty secret returns `false`. A matching signature with a real secret still returns `true`. `rg 'if \(!secret\)' packages/vercel/webhooks/types.ts` 
  **Post-Mortem & Fix Analysis**:
  > hi @ambikeesshh want to work on this 

- **Issue #711** (2026-08-18): **fix(intercom): return error when webhook secret is missing**
  *Symptoms*: ## What's wrong  `verifyIntercomWebhookSignature` in `packages/intercom/webhooks/types.ts` has no empty-secret guard. Compare is already `timingSafeEqual`.  ## Change  Fail closed when `secret` is missing:  ```ts if (!secret) {   return { valid: false, error: 'Missing webhook secret' }; } ```  Leave the HMAC path alone.  ## Check  Missing/empty secret returns that error. A correct signature with a real secret still passes. `rg -A3 'if \(!secret\)' packages/intercom/webhooks/types.ts` 
  **Post-Mortem & Fix Analysis**:
  > hi @ambikeesshh  back after a week , want to work on this :)

- **Issue #710** (2026-08-18): **fix(fireflies): return error when webhook secret is missing**
  *Symptoms*: ## What's wrong  `verifyFirefliesWebhookSignature` in `packages/fireflies/webhooks/types.ts` jumps straight to the signature header and HMAC. No empty-secret guard.  ## Change  Add `if (!secret) return { valid: false, error: 'Missing webhook secret' };` at the top of the function.  Do not rewrite the rest of the verifier.  ## Check  Missing/empty secret returns that error. A correct signature with a real secret still passes. `rg -A3 'if \(!secret\)' packages/fireflies/webhooks/types.ts` 

- **Issue #709** (2026-08-21): **fix(asana): return error when webhook secret is missing**
  *Symptoms*: ## What's wrong  `verifyAsanaWebhookSignature` in `packages/asana/webhooks/types.ts` never checks `secret` before it HMACs. An empty configured secret just hashes with an empty key.  ## Change  Guard at the top of the function:  ```ts if (!secret) {   return { valid: false, error: 'Missing webhook secret' }; } ```  Do not rewrite the HMAC compare. That part already uses `timingSafeEqual`.  ## Check  Missing/empty secret returns `{ valid: false, error: 'Missing webhook secret' }`. A correct signature with a real secret still passes. `rg -A3 'if \(!secret\)' packages/asana/webhooks/types.ts` 
  **Post-Mortem & Fix Analysis**:
  > Hey @ambikeesshh . I want to work on this can you assign me ??

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

### Incident Patch 1: `b3f1c2b6` (2026-09-30)
**Commit Message**: fix(twilio): split stored key on first colon only (#1792)

Co-authored-by: Maros Mamrak <maros.mamrak@eurowag.com>

**File**: `packages/twilio/client.test.ts` (added, +15/-0)
```diff
@@ -0,0 +1,15 @@
+import { getTwilioAuthToken } from './client';
+
+describe('getTwilioAuthToken', () => {
+	it('returns a plain token unchanged', () => {
+		expect(getTwilioAuthToken('token123')).toBe('token123');
+	});
+
+	it('returns the token part of sid:token', () => {
+		expect(getTwilioAuthToken('AC123:token123')).toBe('token123');
+	});
+
+	it('keeps colons inside the token', () => {
+		expect(getTwilioAuthToken('AC123:tok:en:123')).toBe('tok:en:123');
+	});
+});
```

**File**: `packages/twilio/client.ts` (modified, +10/-0)
```diff
@@ -14,6 +14,16 @@ export class TwilioAPIError extends Error {
 
 const TWILIO_API_BASE = 'https://api.twilio.com/2010-04-01';
 
+/**
+ * Extracts the auth token from a stored key, which is either a bare token or
+ * `accountSid:authToken`. Splits on the first colon only, so tokens that
+ * themselves contain colons are preserved.
+ */
+export function getTwilioAuthToken(key: string): string {
+	const separator = key.indexOf(':');
+	return separator === -1 ? key : key.slice(separator + 1);
+}
+
 export async function makeTwilioRequest<T>(
 	endpoint: string,
 	accountSid: string,
```

**File**: `packages/twilio/endpoints/auth-token.test.ts` (added, +78/-0)
```diff
@@ -0,0 +1,78 @@
+import * as client from '../client';
+import { Calls, Messages } from './index';
+
+jest.mock('corsair/core', () => {
+	const actual =
+		jest.requireActual<typeof import('corsair/core')>('corsair/core');
+
+	return {
+		...actual,
+		logEventFromContext: jest.fn().mockResolvedValue(null),
+	};
+});
+
+jest.mock('../client', () => ({
+	...jest.requireActual<typeof import('../client')>('../client'),
+	makeTwilioRequest: jest.fn(),
+}));
+
+const mockedRequest = client.makeTwilioRequest as jest.MockedFunction<
+	typeof client.makeTwilioRequest
+>;
+
+const TOKEN_WITH_COLONS = 'tok:en:123';
+
+/**
+ * Minimal endpoint context. The six endpoints under test only read ctx.key,
+ * ctx.options, ctx.keys.get_accountSid, and ctx.db, so the stub provides
+ * exactly those. The full endpoint context type additionally carries
+ * database clients and key managers, hence the any below keeps this
+ * token-focused test decoupled from unrelated infrastructure types.
+ */
+const ctx = {
+	key: `AC123:${TOKEN_WITH_COLONS}`,
+	options: {},
+	keys: { get_accountSid: jest.fn().mockResolvedValue(null) },
+	db: {},
+} as any;
+
+// Inputs carry only the fields each handler reads. Full zod-valid inputs
+// would couple this token test to unrelated endpoint validation, hence any.
+// Each case is an opaque invocation thunk: only the arguments it records
+// on the mocked request matter, so the resolved payload stays unknown.
+const cases: [string, () => Promise<unknown>][] = [
+	[
+		'messages.send',
+		() => Messages.send(ctx, { To: '+1', From: '+2', Body: 'hi' } as any),
+	],
+	['messages.get', () => Messages.get(ctx, { messageSid: 'SM1' } as any)],
+	['messages.list', () => Messages.list(ctx, {} as any)],
+	['calls.create', () => Calls.create(ctx, { To: '+1', From: '+2' } as any)],
+	['calls.get', () => Calls.get(ctx, { callSid: 'CA1' } as any)],
+	['calls.list', () => Calls.list(ctx, {} as any)],
+];
+
+describe('Twilio endpoints auth token', () => {
+	beforeEach(() => {
+		jest.clearAllMocks();
+		// Outputs are irrelevant here: assertions target the request
+		// arguments, so the mocked response is an empty payload cast onward.
+		mockedRequest.mockResolvedValue({} as never);
+	});
+
+	it.each(cases)(
+		'%s sends the full token when it contains colons',
+		async (_, call) => {
+			await call();
+
+			expect(mockedRequest).toHaveBeenCalledTimes(1);
+			const recorded = mockedRequest.mock.calls[0];
+			if (!recorded) {
+				throw new Error('expected makeTwilioRequest to be called once');
+			}
+			const [, accountSid, authToken] = recorded;
+			expect(accountSid).toBe('AC123');
+			expect(authToken).toBe(TOKEN_WITH_COLONS);
+		},
+	);
+});
```

**File**: `packages/twilio/endpoints/calls.ts` (modified, +4/-4)
```diff
@@ -1,5 +1,5 @@
 import { logEventFromContext } from 'corsair/core';
-import { makeTwilioRequest } from '../client';
+import { getTwilioAuthToken, makeTwilioRequest } from '../client';
 import type { TwilioEndpoints } from '../index';
 import type { TwilioEndpointOutputs } from './types';
 
@@ -9,7 +9,7 @@ export const create: TwilioEndpoints['callsCreate'] = async (ctx, input) => {
 		(await ctx.keys.get_accountSid()) ??
 		ctx.key.split(':')[0] ??
 		'';
-	const authToken = ctx.key.includes(':') ? ctx.key.split(':')[1]! : ctx.key;
+	const authToken = getTwilioAuthToken(ctx.key);
 
 	const response = await makeTwilioRequest<
 		TwilioEndpointOutputs['callsCreate']
@@ -53,7 +53,7 @@ export const get: TwilioEndpoints['callsGet'] = async (ctx, input) => {
 		(await ctx.keys.get_accountSid()) ??
 		ctx.key.split(':')[0] ??
 		'';
-	const authToken = ctx.key.includes(':') ? ctx.key.split(':')[1]! : ctx.key;
+	const authToken = getTwilioAuthToken(ctx.key);
 
 	const response = await makeTwilioRequest<TwilioEndpointOutputs['callsGet']>(
 		`Accounts/${accountSid}/Calls/${input.callSid}.json`,
@@ -72,7 +72,7 @@ export const list: TwilioEndpoints['callsList'] = async (ctx, input) => {
 		(await ctx.keys.get_accountSid()) ??
 		ctx.key.split(':')[0] ??
 		'';
-	const authToken = ctx.key.includes(':') ? ctx.key.split(':')[1]! : ctx.key;
+	const authToken = getTwilioAuthToken(ctx.key);
 
 	const response = await makeTwilioRequest<TwilioEndpointOutputs['callsList']>(
 		`Accounts/${accountSid}/Calls.json`,
```

**File**: `packages/twilio/endpoints/messages.ts` (modified, +4/-4)
```diff
@@ -1,5 +1,5 @@
 import { logEventFromContext } from 'corsair/core';
-import { makeTwilioRequest } from '../client';
+import { getTwilioAuthToken, makeTwilioRequest } from '../client';
 import type { TwilioEndpoints } from '../index';
 import type { TwilioEndpointOutputs } from './types';
 
@@ -9,7 +9,7 @@ export const send: TwilioEndpoints['messagesSend'] = async (ctx, input) => {
 		(await ctx.keys.get_accountSid()) ??
 		ctx.key.split(':')[0] ??
 		'';
-	const authToken = ctx.key.includes(':') ? ctx.key.split(':')[1]! : ctx.key;
+	const authToken = getTwilioAuthToken(ctx.key);
 
 	const response = await makeTwilioRequest<
 		TwilioEndpointOutputs['messagesSend']
@@ -52,7 +52,7 @@ export const get: TwilioEndpoints['messagesGet'] = async (ctx, input) => {
 		(await ctx.keys.get_accountSid()) ??
 		ctx.key.split(':')[0] ??
 		'';
-	const authToken = ctx.key.includes(':') ? ctx.key.split(':')[1]! : ctx.key;
+	const authToken = getTwilioAuthToken(ctx.key);
 
 	const response = await makeTwilioRequest<
 		TwilioEndpointOutputs['messagesGet']
@@ -78,7 +78,7 @@ export const list: TwilioEndpoints['messagesList'] = async (ctx, input) => {
 		(await ctx.keys.get_accountSid()) ??
 		ctx.key.split(':')[0] ??
 		'';
-	const authToken = ctx.key.includes(':') ? ctx.key.split(':')[1]! : ctx.key;
+	const authToken = getTwilioAuthToken(ctx.key);
 
 	const response = await makeTwilioRequest<
 		TwilioEndpointOutputs['messagesList']
```

---

### Incident Patch 2: `003e9fd5` (2026-09-30)
**Commit Message**: fix(www): guard invalid dates and add year unit to formatRelativeTime (#1801)

**File**: `www/src/app/oss/relative-time.test.ts` (added, +53/-0)
```diff
@@ -0,0 +1,53 @@
+import assert from 'node:assert/strict';
+import { describe, it } from 'node:test';
+
+import { formatRelativeTime } from './relative-time';
+
+const NOW = Date.parse('2026-09-29T12:00:00.000Z');
+
+function secondsAgo(seconds: number): string {
+	return new Date(NOW - seconds * 1000).toISOString();
+}
+
+describe('formatRelativeTime', () => {
+	it('renders an em dash for invalid dates instead of NaNmo ago', () => {
+		assert.equal(formatRelativeTime('not-a-date', NOW), '—');
+		assert.equal(formatRelativeTime('', NOW), '—');
+		assert.equal(formatRelativeTime('2026-13-45', NOW), '—');
+	});
+
+	it('says just now for brand new and future timestamps', () => {
+		assert.equal(formatRelativeTime(secondsAgo(0), NOW), 'just now');
+		assert.equal(formatRelativeTime(secondsAgo(-5), NOW), 'just now');
+		assert.equal(
+			formatRelativeTime(new Date(NOW + 86_400_000).toISOString(), NOW),
+			'just now',
+		);
+	});
+
+	it('steps through each unit at its boundary', () => {
+		assert.equal(formatRelativeTime(secondsAgo(1), NOW), '1s ago');
+		assert.equal(formatRelativeTime(secondsAgo(59), NOW), '59s ago');
+		assert.equal(formatRelativeTime(secondsAgo(60), NOW), '1m ago');
+		assert.equal(formatRelativeTime(secondsAgo(3599), NOW), '59m ago');
+		assert.equal(formatRelativeTime(secondsAgo(3600), NOW), '1h ago');
+		assert.equal(formatRelativeTime(secondsAgo(86_399), NOW), '23h ago');
+		assert.equal(formatRelativeTime(secondsAgo(86_400), NOW), '1d ago');
+		assert.equal(formatRelativeTime(secondsAgo(604_799), NOW), '6d ago');
+		assert.equal(formatRelativeTime(secondsAgo(604_800), NOW), '1w ago');
+		assert.equal(formatRelativeTime(secondsAgo(2_629_799), NOW), '4w ago');
+		assert.equal(formatRelativeTime(secondsAgo(2_629_800), NOW), '1mo ago');
+		assert.equal(formatRelativeTime(secondsAgo(31_535_999), NOW), '11mo ago');
+		assert.equal(formatRelativeTime(secondsAgo(31_536_000), NOW), '1y ago');
+	});
+
+	it('renders years for old timestamps instead of runaway months', () => {
+		assert.equal(formatRelativeTime(secondsAgo(800 * 86_400), NOW), '2y ago');
+		assert.equal(formatRelativeTime(secondsAgo(365 * 86_400), NOW), '1y ago');
+	});
+
+	it('keeps using the default clock when now is omitted', (t) => {
+		t.mock.method(Date, 'now', () => NOW);
+		assert.equal(formatRelativeTime(secondsAgo(30)), '30s ago');
+	});
+});
```

**File**: `www/src/app/oss/relative-time.ts` (modified, +16/-7)
```diff
@@ -1,22 +1,31 @@
+const MONTH_SECONDS = 2_629_800; // average Gregorian month (30.44 days)
+const YEAR_SECONDS = 31_536_000; // 365 days
+
 const UNITS: Array<{ limit: number; divisor: number; suffix: string }> = [
 	{ limit: 60, divisor: 1, suffix: 's' },
 	{ limit: 3600, divisor: 60, suffix: 'm' },
 	{ limit: 86400, divisor: 3600, suffix: 'h' },
 	{ limit: 604800, divisor: 86400, suffix: 'd' },
-	{ limit: 2629800, divisor: 604800, suffix: 'w' },
+	{ limit: MONTH_SECONDS, divisor: 604800, suffix: 'w' },
+	{ limit: YEAR_SECONDS, divisor: MONTH_SECONDS, suffix: 'mo' },
 ];
 
 export function formatRelativeTime(iso: string, now = Date.now()): string {
-	const seconds = Math.max(
-		0,
-		Math.floor((now - new Date(iso).getTime()) / 1000),
-	);
+	const timestamp = new Date(iso).getTime();
+	if (!Number.isFinite(timestamp)) {
+		return '—';
+	}
+
+	const seconds = Math.floor((now - timestamp) / 1000);
+	if (seconds < 1) {
+		return 'just now';
+	}
 
 	for (const unit of UNITS) {
 		if (seconds < unit.limit) {
-			return `${Math.max(1, Math.floor(seconds / unit.divisor))}${unit.suffix} ago`;
+			return `${Math.floor(seconds / unit.divisor)}${unit.suffix} ago`;
 		}
 	}
 
-	return `${Math.floor(seconds / 2629800)}mo ago`;
+	return `${Math.floor(seconds / YEAR_SECONDS)}y ago`;
 }
```

---

### Incident Patch 3: `2576d96c` (2026-09-29)
**Commit Message**: fix(twilio): throw AuthMissingError when credentials are missing (#1793)

**File**: `packages/twilio/index.ts` (modified, +11/-4)
```diff
@@ -14,6 +14,7 @@ import type {
 	RequiredPluginEndpointSchemas,
 	RequiredPluginWebhookSchemas,
 } from 'corsair/core';
+import { AuthMissingError } from 'corsair/core';
 import { Calls, Messages } from './endpoints';
 import type {
 	TwilioEndpointInputs,
@@ -286,9 +287,12 @@ export function twilio<const T extends TwilioPluginOptions>(
 				}
 				if (ctx.authType === 'api_key') {
 					const apiKey = await ctx.keys.get_api_key();
-					return apiKey ?? '';
+					if (!apiKey) {
+						throw new AuthMissingError('twilio', 'api_key');
+					}
+					return apiKey;
 				}
-				return '';
+				throw new AuthMissingError('twilio', 'api_key');
 			}
 
 			if (source === 'endpoint' && options.key) {
@@ -297,10 +301,13 @@ export function twilio<const T extends TwilioPluginOptions>(
 
 			if (source === 'endpoint' && ctx.authType === 'api_key') {
 				const res = await ctx.keys.get_api_key();
-				return res ?? '';
+				if (!res) {
+					throw new AuthMissingError('twilio', 'api_key');
+				}
+				return res;
 			}
 
-			return '';
+			throw new AuthMissingError('twilio', 'api_key');
 		},
 	} satisfies InternalTwilioPlugin;
 }
```

**File**: `packages/twilio/key-builder.test.ts` (added, +144/-0)
```diff
@@ -0,0 +1,144 @@
+import { AuthMissingError } from 'corsair/core';
+import type { TwilioKeyBuilderContext, TwilioPluginOptions } from './index';
+import { twilio } from './index';
+
+type KeySource = 'endpoint' | 'webhook';
+
+/** Minimal in-memory credential values backing the stub key manager. */
+type KeyStore = {
+	apiKey: string | null;
+	webhookSignature: string | null;
+};
+
+const emptyStore = (): KeyStore => ({ apiKey: null, webhookSignature: null });
+
+/**
+ * Stub account key manager. keyBuilder only reads get_api_key and
+ * get_webhook_signature; the remaining methods satisfy the typed
+ * manager contract so no cast is needed.
+ */
+function stubKeys(store: KeyStore): TwilioKeyBuilderContext['keys'] {
+	const ignoreSetter = async (): Promise<void> => undefined;
+	return {
+		get_dek: async () => 'test-dek',
+		issue_new_dek: async () => 'test-dek',
+		get_api_key: async () => store.apiKey,
+		set_api_key: ignoreSetter,
+		get_webhook_signature: async () => store.webhookSignature,
+		set_webhook_signature: ignoreSetter,
+		get_accountSid: async () => null,
+		set_accountSid: ignoreSetter,
+	};
+}
+
+/** Minimal keyBuilder context: api_key auth, default tenant, stubbed keys. */
+function stubCtx(
+	store: KeyStore,
+	options: TwilioPluginOptions = {},
+): TwilioKeyBuilderContext {
+	return {
+		authType: 'api_key',
+		options,
+		keys: stubKeys(store),
+		tenantId: 'default',
+	};
+}
+
+async function resolveKey(
+	plugin: ReturnType<typeof twilio>,
+	ctx: TwilioKeyBuilderContext,
+	source: KeySource,
+): Promise<string> {
+	const build = plugin.keyBuilder;
+	if (!build) {
+		throw new Error('twilio plugin must define keyBuilder');
+	}
+	return build(ctx, source);
+}
+
+describe('twilio keyBuilder authentication', () => {
+	const plugin = twilio();
+
+	it('throws AuthMissingError for endpoint source when api key is absent', async () => {
+		await expect(
+			resolveKey(plugin, stubCtx(emptyStore()), 'endpoint'),
+		).rejects.toBeInstanceOf(AuthMissingError);
+	});
+
+	it('throws AuthMissingError for webhook source when credentials are absent', async () => {
+		await expect(
+			resolveKey(plugin, stubCtx(emptyStore()), 'webhook'),
+		).rejects.toBeInstanceOf(AuthMissingError);
+	});
+
+	it('never returns an empty key — that would build Accounts//Messages.json', async () => {
+		// Regression guard for the original bug: an empty string flowed into
+		// endpoint URL building and produced a confusing transport 401.
+		const out = await resolveKey(
+			plugin,
+			stubCtx(emptyStore()),
+			'endpoint',
+		).then(
+			(key) => key,
+			() => null,
+		);
+		expect(out).not.toBe('');
+	});
+
+	it('reports twilio / api_key on the thrown error', async () => {
+		// The rejection value carries no static type, so it stays unknown
+		// here until instanceof narrows it to AuthMissingError below.
+		const err: unknown = await resolveKey(
+			plugin,
+			stubCtx(emptyStore()),
+			'endpoint',
+		).catch((e: unknown) => e);
+
+		expect(err).toBeInstanceOf(AuthMissingError);
+		if (!(err instanceof AuthMissingError)) {
+			throw new Error('expected AuthMissingError');
+		}
+		expect(err.pluginId).toBe('twilio');
+		expect(err.authType).toBe('api_key');
+	});
+
+	it('returns options.key for endpoint source', async () => {
+		const withOptionsKey = twilio({ key: 'test-auth-token' });
+		const out = await resolveKey(
+			withOptionsKey,
+			stubCtx(emptyStore()),
+			'endpoint',
+		);
+		expect(out).toBe('test-auth-token');
+	});
+
+	it('reads api key from the key manager for endpoint source', async () => {
+		const ctx = stubCtx({ apiKey: 'test-api-key', webhookSignature: null });
+
+		await expect(resolveKey(plugin, ctx, 'endpoint')).resolves.toBe(
+			'test-api-key',
+		);
+	});
+
+	it('prefers options.webhookSecret for webhook source', async () => {
+		const withSecret = twilio({ webhookSecret: 'test-webhook-secret' });
+		const out = await resolveKey(withSecret, stubCtx(emptyStore()), 'webhook');
+		expect(out).toBe('test-web
```

---

### Incident Patch 4: `6b913c3b` (2026-09-28)
**Commit Message**: fix(google): request least-privilege oauth scopes (#1767)

**File**: `docs/guides/plugin-credentials.mdx` (modified, +0/-3)
```diff
@@ -305,10 +305,7 @@ The Gmail plugin uses OAuth 2.0 authentication exclusively.
      - User support email
      - Developer contact information
    - Add scopes:
-     - `https://www.googleapis.com/auth/gmail.readonly`
-     - `https://www.googleapis.com/auth/gmail.send`
      - `https://www.googleapis.com/auth/gmail.modify`
-     - `https://www.googleapis.com/auth/gmail.compose`
    - Add test users (for testing)
    - Click **Save and Continue** through all steps
 4. Back in **Credentials**, click **Create Credentials** > **OAuth client ID**
```

**File**: `docs/plugins/gmail/get-credentials.mdx` (modified, +0/-3)
```diff
@@ -38,10 +38,7 @@ The Gmail plugin uses OAuth 2.0 authentication exclusively.
      - User support email
      - Developer contact information
    - Add scopes:
-     - `https://www.googleapis.com/auth/gmail.readonly`
-     - `https://www.googleapis.com/auth/gmail.send`
      - `https://www.googleapis.com/auth/gmail.modify`
-     - `https://www.googleapis.com/auth/gmail.compose`
    - Add test users (for testing)
    - Click **Save and Continue** through all steps
 4. Back in **Credentials**, click **Create Credentials** → **OAuth client ID**
```

**File**: `docs/plugins/googlecalendar/get-credentials.mdx` (modified, +2/-1)
```diff
@@ -38,7 +38,8 @@ The Google Calendar plugin uses OAuth 2.0 authentication exclusively.
      - User support email
      - Developer contact information
    - Add scopes:
-     - `https://www.googleapis.com/auth/calendar`
+     - `https://www.googleapis.com/auth/calendar.events`
+     - `https://www.googleapis.com/auth/calendar.freebusy`
    - Add test users (for testing)
    - Click **Save and Continue** through all steps
 4. Select **Web application**
```

**File**: `docs/plugins/googlesheets/get-credentials.mdx` (modified, +1/-0)
```diff
@@ -39,6 +39,7 @@ The Google Sheets plugin uses OAuth 2.0 authentication exclusively.
      - Developer contact information
    - Add scopes:
      - `https://www.googleapis.com/auth/spreadsheets`
+     - `https://www.googleapis.com/auth/drive`
    - Add test users (for testing)
    - Click **Save and Continue** through all steps
 4. Select **Web application**
```

**File**: `packages/gmail/README.md` (modified, +0/-2)
```diff
@@ -24,14 +24,12 @@ pnpm add @corsair-dev/gmail
 | `labels.list` | `gmail.api.labels.list` | `read` | List all labels in the mailbox |
 | `labels.update` | `gmail.api.labels.update` | `write` | Update an existing label |
 | `messages.batchModify` | `gmail.api.messages.batchModify` | `write` | Add or remove labels from multiple messages in bulk |
-| `messages.delete` | `gmail.api.messages.delete` | `destructive` | Permanently delete a message [DESTRUCTIVE · IRREVERSIBLE] |
 | `messages.get` | `gmail.api.messages.get` | `read` | Get a specific message |
 | `messages.list` | `gmail.api.messages.list` | `read` | List messages in a mailbox |
 | `messages.modify` | `gmail.api.messages.modify` | `write` | Add or remove labels from a message |
 | `messages.send` | `gmail.api.messages.send` | `write` | Send an email to one or more recipients |
 | `messages.trash` | `gmail.api.messages.trash` | `write` | Move a message to the trash |
 | `messages.untrash` | `gmail.api.messages.untrash` | `write` | Restore a message from the trash |
-| `threads.delete` | `gmail.api.threads.delete` | `destructive` | Permanently delete a thread [DESTRUCTIVE · IRREVERSIBLE] |
 | `threads.get` | `gmail.api.threads.get` | `read` | Get a specific thread |
 | `threads.list` | `gmail.api.threads.list` | `read` | List threads in the mailbox |
 | `threads.modify` | `gmail.api.threads.modify` | `write` | Add or remove labels from a thread |
```

---

### Incident Patch 5: `d52cac39` (2026-09-24)
**Commit Message**: fix: update google docs to add sheets readonly endpoint

**File**: `packages/googledocs/README.md` (modified, +3/-1)
```diff
@@ -18,17 +18,19 @@ The plugin uses **OAuth 2.0** (`oauth_2`) against Google.
    these scopes:
    - `https://www.googleapis.com/auth/documents`
    - `https://www.googleapis.com/auth/drive`
+   - `https://www.googleapis.com/auth/spreadsheets.readonly` (Sheets reads under `sheets.*` and chart listing)
 
 Access tokens are refreshed automatically before expiry and requests are
 retried once on 401.
 
 ## Endpoints
 
-35 operations across these domains:
+36 operations across these domains:
 
 | Domain      | Operations                                                                                                                                                                                                                                                                                                                     |
 | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
 | `documents` | `createDocument`, `createBlankDocument`, `createDocumentMarkdown`, `copyDocument`, `getDocument`, `getDocumentPlaintext`, `updateDocumentMarkdown`, `updateDocumentSectionMarkdown`, `updateDocumentStyle`, `updateExistingDocument`, `updateDocumentBatch`, `exportDocumentAsPdf`, `searchDocuments`, `listSpreadsheetCharts` |
+| `sheets`    | `readValues` (Sheets API `spreadsheets.values.get` via the googledocs OAuth token)                                                                                                                                                                                                                                               |
 | `text`      | `insertText`, `replaceAllText`, `deleteContentRange`, `insertInlineImage`, `replaceImage`, `insertPageBreak`                                                                                                                                                                                                                   |
 | `structure` | `createHeader`, `createFooter`, `createFootnote`, `createNamedRange`, `createParagraphBullets`, `deleteParagraphBullets`, `deleteHeader`, `deleteFooter`, `deleteNamedRange`                                                                                                                                                   |
 | `tables`    | `insertTable`, `insertTableColumn`, `deleteTableColumn`, `deleteTableRow`, `unmergeTableCells`, `updateTableRowStyle`                                                                                                                                                                                                          |
```

**File**: `packages/googledocs/api.test.ts` (modified, +26/-4)
```diff
@@ -3,6 +3,7 @@ import { request } from 'corsair/http';
 import { makeGoogleDocsRequest, makeGoogleDriveRequest } from './client';
 import {
 	DocumentsEndpoints,
+	SheetsEndpoints,
 	StructureEndpoints,
 	TablesEndpoints,
 	TextEndpoints,
@@ -63,13 +64,13 @@ function countLeaves(tree: Record<string, unknown>): number {
 }
 
 describe('Google Docs plugin shape', () => {
-	it('exposes all 35 operations with schemas and meta in lockstep', () => {
+	it('exposes all 36 operations with schemas and meta in lockstep', () => {
 		const plugin = googledocs();
 		const endpoints = plugin.endpoints as unknown as Record<string, unknown>;
 
-		expect(countLeaves(endpoints)).toBe(35);
-		expect(Object.keys(plugin.endpointMeta ?? {})).toHaveLength(35);
-		expect(Object.keys(googledocsEndpointSchemas)).toHaveLength(35);
+		expect(countLeaves(endpoints)).toBe(36);
+		expect(Object.keys(plugin.endpointMeta ?? {})).toHaveLength(36);
+		expect(Object.keys(googledocsEndpointSchemas)).toHaveLength(36);
 	});
 
 	it('requests the documents, drive, and sheets-read OAuth scopes', () => {
@@ -326,6 +327,27 @@ describe('Google Docs endpoint routing (mocked HTTP)', () => {
 			});
 		});
 
+		it('readValues GETs spreadsheets.values with default range', async () => {
+			mockRequest.mockResolvedValue({
+				range: 'Sheet1!A:Z',
+				values: [['a', 'b']],
+			});
+			await SheetsEndpoints.readValues(ctx, {
+				spreadsheetId: 'sheet1',
+			});
+
+			const { config, options } = lastCall();
+			expect(config.BASE).toBe(SHEETS_BASE);
+			expect(options).toMatchObject({
+				method: 'GET',
+				url: '/spreadsheets/sheet1/values/Sheet1!A:Z',
+				query: {
+					valueRenderOption: 'FORMATTED_VALUE',
+					dateTimeRenderOption: 'FORMATTED_STRING',
+				},
+			});
+		});
+
 		it('exportDocumentAsPdf fetches the Drive export URL and base64-encodes', async () => {
 			const pdfBytes = Buffer.from('pdf-data');
 			const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
```

**File**: `packages/googledocs/endpoints/index.ts` (modified, +5/-0)
```diff
@@ -1,4 +1,5 @@
 import * as Documents from './documents';
+import * as Sheets from './sheets';
 import * as Structure from './structure';
 import * as Tables from './tables';
 import * as Text from './text';
@@ -50,4 +51,8 @@ export const TablesEndpoints = {
 	updateTableRowStyle: Tables.updateTableRowStyle,
 };
 
+export const SheetsEndpoints = {
+	readValues: Sheets.readValues,
+};
+
 export * from './types';
```

**File**: `packages/googledocs/endpoints/sheets.ts` (added, +51/-0)
```diff
@@ -0,0 +1,51 @@
+import { logEventFromContext } from 'corsair/core';
+import { makeAuthenticatedGoogleRequest, SHEETS_API_BASE } from '../client';
+import type { GoogleDocsEndpoints } from '../index';
+import type { GoogleDocsEndpointOutputs } from './types';
+
+/**
+ * Read cell values from a spreadsheet via the Sheets API, using the googledocs
+ * OAuth connection (spreadsheets.readonly scope).
+ */
+export const readValues: GoogleDocsEndpoints['readValues'] = async (
+	ctx,
+	input,
+) => {
+	const range = input.range ?? `${input.sheetName ?? 'Sheet1'}!A:Z`;
+
+	const query: Record<string, string | undefined> = {
+		valueRenderOption: input.valueRenderOption ?? 'FORMATTED_VALUE',
+		dateTimeRenderOption: input.dateTimeRenderOption ?? 'FORMATTED_STRING',
+	};
+	if (input.majorDimension) {
+		query.majorDimension = input.majorDimension;
+	}
+
+	const result = await makeAuthenticatedGoogleRequest<
+		GoogleDocsEndpointOutputs['readValues']
+	>(
+		SHEETS_API_BASE,
+		`/spreadsheets/${input.spreadsheetId}/values/${range}`,
+		ctx,
+		{
+			method: 'GET',
+			query,
+		},
+	);
+
+	await logEventFromContext(
+		ctx,
+		'googledocs.sheets.readValues',
+		{
+			spreadsheetId: input.spreadsheetId,
+			range: result.range ?? range,
+		},
+		'completed',
+	);
+
+	return result;
+};
+
+export const SheetsEndpoints = {
+	readValues,
+};
```

**File**: `packages/googledocs/endpoints/types.ts` (modified, +32/-0)
```diff
@@ -5,6 +5,7 @@ import type {
 	DriveFile,
 	DriveFileList,
 	SpreadsheetChartsResponse,
+	ValueRange,
 } from '../types';
 
 // ─────────────────────────────────────────────────────────────────────────────
@@ -115,6 +116,24 @@ const ListSpreadsheetChartsInputSchema = z.object({
 	spreadsheetId: z.string(),
 });
 
+const ReadSpreadsheetValuesInputSchema = z.object({
+	spreadsheetId: z.string(),
+	sheetName: z.string().optional(),
+	range: z
+		.string()
+		.optional()
+		.describe(
+			'A1 notation range (e.g. "Sheet1!A1:D10"). When omitted, defaults to sheetName!A:Z or Sheet1!A:Z.',
+		),
+	valueRenderOption: z
+		.enum(['FORMATTED_VALUE', 'UNFORMATTED_VALUE', 'FORMULA'])
+		.optional(),
+	dateTimeRenderOption: z
+		.enum(['SERIAL_NUMBER', 'FORMATTED_STRING'])
+		.optional(),
+	majorDimension: z.enum(['ROWS', 'COLUMNS']).optional(),
+});
+
 const InsertTextInputSchema = z.object({
 	documentId: z.string(),
 	text: z.string(),
@@ -282,6 +301,7 @@ export const GoogleDocsEndpointInputSchemas = {
 	exportDocumentAsPdf: ExportDocumentAsPdfInputSchema,
 	searchDocuments: SearchDocumentsInputSchema,
 	listSpreadsheetCharts: ListSpreadsheetChartsInputSchema,
+	readValues: ReadSpreadsheetValuesInputSchema,
 	insertText: InsertTextInputSchema,
 	replaceAllText: ReplaceAllTextInputSchema,
 	deleteContentRange: DeleteContentRangeInputSchema,
@@ -370,6 +390,16 @@ const SpreadsheetChartsResponseSchema = z.object({
 	sheets: z.array(z.unknown()).optional(),
 });
 
+const ValueRangeSchema = z.object({
+	range: z.string().optional(),
+	majorDimension: z
+		.enum(['ROWS', 'COLUMNS', 'DIMENSION_UNSPECIFIED'])
+		.optional(),
+	values: z
+		.array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])))
+		.optional(),
+});
+
 const PlaintextResultSchema = z.object({
 	documentId: z.string(),
 	title: z.string().optional(),
@@ -398,6 +428,7 @@ export const GoogleDocsEndpointOutputSchemas = {
 	exportDocumentAsPdf: ExportResultSchema,
 	searchDocuments: DriveFileListSchema,
 	listSpreadsheetCharts: SpreadsheetChartsResponseSchema,
+	readValues: ValueRangeSchema,
 	insertText: BatchUpdateResponseSchema,
 	replaceAllText: BatchUpdateResponseSchema,
 	deleteContentRange: BatchUpdateResponseSchema,
@@ -439,6 +470,7 @@ export type GoogleDocsEndpointOutputs = {
 	exportDocumentAsPdf: ExportResult;
 	searchDocuments: DriveFileList;
 	listSpreadsheetCharts: SpreadsheetChartsResponse;
+	readValues: ValueRange;
 	insertText: BatchUpdateResponse;
 	replaceAllText: BatchUpdateResponse;
 	deleteContentRange: BatchUpdateResponse;
```

---

### Incident Patch 6: `d4a2f2fc` (2026-09-24)
**Commit Message**: fix(ci): skip zod missing as not installed in readme check (#1763)

* fix(ci): skip zod missing as not installed in readme check

* fix(ci): make readme skip lane aware via node_modules

* fix(ci): only skip readme check for plugins with no node_modules

**File**: `scripts/generate-plugin-readmes.test.ts` (modified, +128/-36)
```diff
@@ -1,4 +1,7 @@
 import assert from 'node:assert/strict';
+import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
+import { tmpdir } from 'node:os';
+import { join } from 'node:path';
 import { test } from 'node:test';
 import type { PluginDocsIntrospection } from '../packages/corsair/core/inspect/index.ts';
 import {
@@ -7,6 +10,7 @@ import {
 	isWorkspaceNotInstalledError,
 	MISSING_METADATA_FIELDS,
 	missingMetadataFields,
+	missingPackageName,
 	renderPluginReadme,
 	summarizeCheckResults,
 } from './generate-plugin-readmes.ts';
@@ -144,70 +148,158 @@ test('missingMetadataFields detects gaps for --check', () => {
 	}
 });
 
+/** Temp repo root where each listed plugin dir has a populated node_modules. */
+function withRepoRoot(installed: string[], fn: (root: string) => void) {
+	const root = mkdtempSync(join(tmpdir(), 'readmes-root-'));
+	try {
+		for (const dir of installed) {
+			mkdirSync(join(root, 'packages', dir, 'node_modules', 'jest'), {
+				recursive: true,
+			});
+		}
+		fn(root);
+	} finally {
+		rmSync(root, { recursive: true, force: true });
+	}
+}
+
+const missing = (pkg: string, dir: string) =>
+	`import failed: Cannot find package '${pkg}' imported from '/repo/packages/${dir}/index.ts'`;
+
 test('isWorkspaceNotInstalledError detects lane-scoped missing installs', () => {
+	withRepoRoot([], (root) => {
+		assert.equal(
+			isWorkspaceNotInstalledError(missing('corsair', 'acme'), 'acme', root),
+			true,
+		);
+		assert.equal(
+			isWorkspaceNotInstalledError(
+				missing('zod', 'zohobigin'),
+				'zohobigin',
+				root,
+			),
+			true,
+		);
+		assert.equal(
+			isWorkspaceNotInstalledError(missing('lodash', 'acme'), 'acme', root),
+			false,
+		);
+		assert.equal(
+			isWorkspaceNotInstalledError('factory() threw: boom', 'acme', root),
+			false,
+		);
+		assert.equal(
+			isWorkspaceNotInstalledError('no factory export "acme"', 'acme', root),
+			false,
+		);
+	});
+});
+
+test('missingPackageName extracts the package from import failures', () => {
 	assert.equal(
-		isWorkspaceNotInstalledError(
-			"import failed: Cannot find package 'corsair' imported from '/repo/packages/acme/index.ts'",
+		missingPackageName(
+			"import failed: Cannot find package 'zod' imported from '/repo/packages/zohobigin/index.ts'",
 		),
-		true,
+		'zod',
 	);
 	assert.equal(
-		isWorkspaceNotInstalledError(
-			"import failed: Cannot find package 'zod' imported from '/repo/packages/acme/index.ts'",
+		missingPackageName(
+			"import failed: Cannot find package 'corsair' imported from '/repo/packages/acme/index.ts'",
 		),
-		false,
+		'corsair',
 	);
-	assert.equal(isWorkspaceNotInstalledError('factory() threw: boom'), false);
-	assert.equal(isWorkspaceNotInstalledError('no factory export "acme"'), false);
+	assert.equal(missingPackageName('factory() threw: boom'), undefined);
+});
+
+test('isWorkspaceNotInstalledError is lane aware via the plugin node_modules', () => {
+	withRepoRoot(['acme'], (root) => {
+		assert.equal(
+			isWorkspaceNotInstalledError(missing('zod', 'acme'), 'acme', root),
+			false,
+		);
+		assert.equal(
+			isWorkspaceNotInstalledError(missing('corsair', 'acme'), 'acme', root),
+			false,
+		);
+		assert.equal(
+			isWorkspaceNotInstalledError(missing('zod', 'other'), 'other', root),
+			true,
+		);
+	});
 });
 
 test('summarizeCheckResults skips uninstalled plugins but fails on gaps', () => {
 	const results = [
 		{ dir: 'acme', gaps: [], error: undefined },
+		{ dir: 'beta', gaps: [], error: missing('corsair', 'beta') },
+	];
+	withRepoRoot(['acme'], (root) => {
+		const summary = summarizeCheckResults(results, root);
+		assert.equal(summary.ok, true);
+		assert.deepEqual(summary.skipped, ['beta']);
+		assert.deepEqual(summary.offenders, []);
+		assert.deepEqual(summary.errored, []);
+	});
+});
+
+test('summarizeCheckResults skips both corsair and zod missing, but not other packages', () => {
+	const results = [
+		{ dir: 'finerworks', gaps: [], error: undefined },
+		{ dir: 'zohobigin', gaps
```

**File**: `scripts/generate-plugin-readmes.ts` (modified, +43/-12)
```diff
@@ -311,12 +311,39 @@ const FACTORY_OPTIONS: Record<string, Record<string, unknown>> = {
 };
 
 /**
- * True when a plugin failed to load only because the `corsair` workspace
- * dependency is not installed — the signature of a lane-scoped CI install
- * (the plugin lane installs just the PR's plugin), not a broken plugin.
+ * Extracts the missing package name from a loadPlugin import failure, e.g.
+ * "import failed: Cannot find package 'zod' ..." -> "zod".
  */
-export function isWorkspaceNotInstalledError(error: string): boolean {
-	return error.startsWith("import failed: Cannot find package 'corsair'");
+export function missingPackageName(error: string): string | undefined {
+	const match = error.match(/^import failed: Cannot find package '([^']+)'/);
+	return match?.[1];
+}
+
+/**
+ * True when a plugin failed to load only because workspace dependencies are
+ * not installed — the signature of a lane-scoped CI install (the plugin lane
+ * installs just the PR's plugin), not a broken plugin.
+ *
+ * Every plugin depends on `corsair` (workspace:*) and `zod`. Either missing
+ * can mean not-installed. Both are needed because import order differs per
+ * plugin: e.g. zohobigin has only `import type ... from 'corsair/core'`
+ * (erased at runtime) followed by runtime `import { z } from 'zod'`, so its
+ * first runtime failure is `zod`, while plugins with a runtime
+ * `from 'corsair/core'` value import fail on `corsair` first.
+ *
+ * Only a plugin with no `packages/<dir>/node_modules` at all counts as not
+ * installed. An installed plugin that still cannot resolve `corsair` or
+ * `zod` (e.g. it never declared the dependency) is genuine breakage, so the
+ * full lane cannot pass silently.
+ */
+export function isWorkspaceNotInstalledError(
+	error: string,
+	dir: string,
+	root: string,
+): boolean {
+	const pkg = missingPackageName(error);
+	if (pkg !== 'corsair' && pkg !== 'zod') return false;
+	return !existsSync(join(root, 'packages', dir, 'node_modules'));
 }
 
 export type CheckResultSummary = {
@@ -329,16 +356,22 @@ export type CheckResultSummary = {
 /**
  * Decide a `--check` run: gaps and real load errors fail, uninstalled
  * plugins are skipped, and a run that introspected nothing fails so a
- * broken install can never pass vacuously.
+ * broken install can never pass vacuously. `root` is the repo root, used to
+ * tell uninstalled plugins apart via `packages/<dir>/node_modules`.
  */
 export function summarizeCheckResults(
 	results: { dir: string; gaps: string[]; error?: string }[],
+	root: string,
 ): CheckResultSummary {
 	const skipped = results
-		.filter((r) => r.error && isWorkspaceNotInstalledError(r.error))
+		.filter(
+			(r) => r.error && isWorkspaceNotInstalledError(r.error, r.dir, root),
+		)
 		.map((r) => r.dir);
 	const errored = results
-		.filter((r) => r.error && !isWorkspaceNotInstalledError(r.error))
+		.filter(
+			(r) => r.error && !isWorkspaceNotInstalledError(r.error, r.dir, root),
+		)
 		.map((r) => r.dir);
 	const offenders = results
 		.filter((r) => !r.error && r.gaps.length > 0)
@@ -539,11 +572,9 @@ async function main() {
 	const errored = results.filter((r) => r.error);
 
 	if (check) {
-		const summary = summarizeCheckResults(results);
+		const summary = summarizeCheckResults(results, root);
 		for (const dir of summary.skipped) {
-			console.warn(
-				`[${dir}] skipped: 'corsair' workspace dependency not installed`,
-			);
+			console.warn(`[${dir}] skipped: workspace dependency not installed`);
 		}
 		for (const dir of summary.errored) {
 			console.error(`[${dir}] ${results.find((r) => r.dir === dir)?.error}`);
```

---

### Incident Patch 7: `03497013` (2026-09-24)
**Commit Message**: fix: update combo integration pages on www

**File**: `www/src/components/integrations/combo/combo-hub-cta.tsx` (added, +35/-0)
```diff
@@ -0,0 +1,35 @@
+import { ArrowRight } from '@phosphor-icons/react/dist/ssr';
+
+import type { ComboData } from '@/lib/combo-types';
+import { hubWwwPluginsLoginUrl } from '@/lib/site-links';
+
+export function ComboHubCta({ combo }: { combo: ComboData }) {
+	const href = hubWwwPluginsLoginUrl([combo.slugA, combo.slugB]);
+	const label = `${combo.displayA} and ${combo.displayB}`;
+
+	return (
+		<section className="pb-4 pt-2 md:pb-5 md:pt-3">
+			<div className="mx-auto max-w-[960px] px-4 sm:px-6 md:px-10">
+				<a
+					href={href}
+					target="_blank"
+					rel="noopener noreferrer"
+					className="flex flex-col gap-4 rounded-lg border border-[#1c1c1c]/10 bg-white px-6 py-6 no-underline shadow-[0_8px_32px_rgba(28,28,28,0.06)] sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-8 sm:py-7"
+				>
+					<div className="min-w-0">
+						<p className="text-xl font-medium tracking-[-0.02em] text-[#1c1c1c] sm:text-2xl">
+							Get started with {label} on Corsair Hub
+						</p>
+						<p className="mt-2 text-base leading-relaxed text-[#1c1c1c99]">
+							Complete your first operation in {'<1 min'}
+						</p>
+					</div>
+					<span className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[#4a38f5] px-6 py-3.5 text-sm font-medium text-white transition-colors hover:bg-[#3d2ee0] sm:px-7 sm:py-4 sm:text-base">
+						Get started
+						<ArrowRight size={18} weight="bold" aria-hidden />
+					</span>
+				</a>
+			</div>
+		</section>
+	);
+}
```

**File**: `www/src/components/integrations/combo/combo-page.tsx` (modified, +2/-0)
```diff
@@ -2,6 +2,7 @@ import { IntegrationFaqAccordion } from '@/components/integrations/detail/integr
 import { getComboCanonical } from '@/lib/combined-integrations';
 import type { ComboData } from '@/lib/combo-types';
 import { ComboHero } from './combo-hero';
+import { ComboHubCta } from './combo-hub-cta';
 import { AppDetails } from './combo-sections';
 import { ComboWorkflows } from './combo-workflows';
 import { KbDemo } from './kb-demo';
@@ -71,6 +72,7 @@ export function ComboPage({ combo }: { combo: ComboData }) {
 			<ComboJsonLd combo={combo} />
 			<ComboHero combo={combo} />
 			<WorkflowBuilder key={`builder-${key}`} combo={combo} />
+			<ComboHubCta combo={combo} />
 			<ComboWorkflows combo={combo} />
 			<KbDemo key={`kb-${key}`} combo={combo} />
 			<AppDetails combo={combo} />
```

**File**: `www/src/components/integrations/combo/combo-workflows.tsx` (modified, +8/-3)
```diff
@@ -1,17 +1,20 @@
 import type { ComboData } from '@/lib/combo-types';
+import { hubWwwPluginsLoginUrl } from '@/lib/site-links';
 import { cn } from '@/lib/utils';
 import { WorkflowNodePair } from './workflow-nodes';
 
 export function ComboWorkflows({ combo }: { combo: ComboData }) {
+	const tryItHref = hubWwwPluginsLoginUrl([combo.slugA, combo.slugB]);
+
 	return (
 		<section id="workflows" className="py-10 md:py-12">
 			<div className="mx-auto max-w-[960px] px-4 sm:px-6 md:px-10">
 				<h2 className="text-center font-[family-name:var(--landing-font-serif)] text-[clamp(1.5rem,3vw,2rem)] font-light tracking-[-0.03em] text-[#1c1c1c]">
 					Popular {combo.displayA} and {combo.displayB} workflows
 				</h2>
 				<p className="mx-auto mt-2 max-w-2xl text-center text-[15px] leading-relaxed text-[#1c1c1c99]">
-					When this happens in one app, do this in the other. Open a card in the
-					builder to try the pair.
+					When this happens in one app, do this in the other. Try it on Hub to
+					connect both apps and run the pair.
 				</p>
 				<div className="mt-7 grid gap-3 md:grid-cols-2 md:items-stretch">
 					{combo.workflows.map((w, i) => (
@@ -49,7 +52,9 @@ export function ComboWorkflows({ combo }: { combo: ComboData }) {
 									{w.trigger.appLabel} + {w.action.appLabel}
 								</span>
 								<a
-									href={`#builder?pair=${w.trigger.app}.${w.trigger.id}+${w.action.app}.${w.action.id}`}
+									href={tryItHref}
+									target="_blank"
+									rel="noopener noreferrer"
 									className="-my-1 shrink-0 touch-manipulation py-2 text-[13px] font-medium text-[#4a38f5] no-underline hover:underline"
 								>
 									Try it →
```

**File**: `www/src/lib/site-links.ts` (modified, +9/-2)
```diff
@@ -5,14 +5,21 @@ export const GITHUB_LICENSE_URL = `${GITHUB_URL}/blob/main/LICENSE`;
 export const APP_URL = 'https://hub.corsair.dev';
 
 /** Hub login from www integration pages (plugin-aware copy on the login card). */
-export function hubWwwPluginLoginUrl(pluginId: string): string {
+export function hubWwwPluginsLoginUrl(pluginIds: readonly string[]): string {
+	const plugins = [
+		...new Set(pluginIds.map((id) => id.trim().toLowerCase()).filter(Boolean)),
+	].join(',');
 	const params = new URLSearchParams({
 		title: 'app',
 		mode: 'www',
-		plugins: pluginId,
+		plugins,
 	});
 	return `${APP_URL}/login?${params.toString()}`;
 }
+
+export function hubWwwPluginLoginUrl(pluginId: string): string {
+	return hubWwwPluginsLoginUrl([pluginId]);
+}
 export const TWITTER_URL = 'https://x.com/corsairdotdev';
 export const DISCORD_URL = 'https://discord.com/invite/uNgCP3mSzU';
 export const ENTERPRISE_CONTACT_URL = '';
```

---

### Incident Patch 8: `22a88294` (2026-09-23)
**Commit Message**: fix: resync plugin catalog

**File**: `docs/docs.json` (modified, +429/-0)
```diff
@@ -507,6 +507,14 @@
                   "plugins/appointo/database"
                 ]
               },
+              {
+                "group": "Aryn",
+                "pages": [
+                  "plugins/aryn/overview",
+                  "plugins/aryn/api",
+                  "plugins/aryn/database"
+                ]
+              },
               {
                 "group": "Asana",
                 "pages": [
@@ -641,6 +649,14 @@
                   "plugins/beaconstac/database"
                 ]
               },
+              {
+                "group": "Beamer",
+                "pages": [
+                  "plugins/beamer/overview",
+                  "plugins/beamer/api",
+                  "plugins/beamer/database"
+                ]
+              },
               {
                 "group": "Beeminder",
                 "pages": [
@@ -713,6 +729,14 @@
                   "plugins/bigml/database"
                 ]
               },
+              {
+                "group": "BigPicture.io",
+                "pages": [
+                  "plugins/bigpictureio/overview",
+                  "plugins/bigpictureio/api",
+                  "plugins/bigpictureio/database"
+                ]
+              },
               {
                 "group": "Bitbucket",
                 "pages": [
@@ -793,6 +817,14 @@
                   "plugins/bookingmood/database"
                 ]
               },
+              {
+                "group": "Booqable",
+                "pages": [
+                  "plugins/booqable/overview",
+                  "plugins/booqable/api",
+                  "plugins/booqable/database"
+                ]
+              },
               {
                 "group": "Borneo",
                 "pages": [
@@ -947,6 +979,14 @@
                   "plugins/bunnycdn/database"
                 ]
               },
+              {
+                "group": "ByteForms",
+                "pages": [
+                  "plugins/byteforms/overview",
+                  "plugins/byteforms/api",
+                  "plugins/byteforms/database"
+                ]
+              },
               {
                 "group": "Cal.com",
                 "pages": [
@@ -967,6 +1007,14 @@
                   "plugins/calendly/webhooks"
                 ]
               },
+              {
+                "group": "CampaignCleaner",
+                "pages": [
+                  "plugins/campaigncleaner/overview",
+                  "plugins/campaigncleaner/api",
+                  "plugins/campaigncleaner/database"
+                ]
+              },
               {
                 "group": "Campayn",
                 "pages": [
@@ -975,6 +1023,15 @@
                   "plugins/campayn/database"
                 ]
               },
+              {
+                "group": "Canny",
+                "pages": [
+                  "plugins/canny/overview",
+                  "plugins/canny/api",
+                  "plugins/canny/database",
+                  "plugins/canny/webhooks"
+                ]
+              },
               {
                 "group": "Canva",
                 "pages": [
@@ -1032,6 +1089,14 @@
                   "plugins/certifier/database"
                 ]
               },
+              {
+                "group": "Chaser",
+                "pages": [
+                  "plugins/chaser/overview",
+                  "plugins/chaser/api",
+                  "plugins/chaser/database"
+                ]
+              },
               {
                 "group": "ChatBotKit",
                 "pages": [
@@ -1056,6 +1121,14 @@
                   "plugins/chmeetings/database"
                 ]
               },
+              {
+                "group": "Cincopa",
+                "pages": [
+                  "plugins/cincopa/overview",
+                  "plugins/cincopa/api",
+                  "plugins/cincopa/database"
+                ]
+              },
               {
  
```

**File**: `docs/plugins/amara/api.mdx` (modified, +728/-0)
```diff
@@ -212,6 +212,137 @@ await corsair.amara.api.messages.send({});
 
 ## Teams
 
+### addMember
+
+`teams.addMember`
+
+Add a new member to a team
+
+**Risk:** `write`
+
+```ts
+await corsair.amara.api.teams.addMember({});
+```
+
+**Input**
+
+| Name | Type | Required | Description |
+|------|------|----------|-------------|
+| `team_slug` | `string` | Yes | — |
+| `user` | `string` | Yes | — |
+| `role` | `owner \| admin \| manager \| contributor \| proj_lang_manager \| limited_contributor` | No | — |
+
+
+
+**Output**
+
+| Name | Type | Required | Description |
+|------|------|----------|-------------|
+| `user` | `object` | No | — |
+| `role` | `string` | No | — |
+| `languages_managed` | `string[]` | No | — |
+| `resource_uri` | `string` | No | — |
+
+<AccordionGroup>
+<Accordion title="user full type">
+
+```ts
+{
+  username?: string | null,
+  id?: string,
+  full_name?: string | null,
+  first_name?: string | null,
+  last_name?: string | null,
+  biography?: string | null,
+  homepage?: string | null,
+  avatar?: string | null,
+  languages?: string[],
+  num_videos?: number,
+  resource_uri?: string,
+  created_by?: string | null,
+  is_partner?: boolean,
+  activity_uri?: string
+} | string
+```
+</Accordion>
+</AccordionGroup>
+
+
+
+---
+
+### createProject
+
+`teams.createProject`
+
+Create a new project in a team
+
+**Risk:** `write`
+
+```ts
+await corsair.amara.api.teams.createProject({});
+```
+
+**Input**
+
+| Name | Type | Required | Description |
+|------|------|----------|-------------|
+| `team_slug` | `string` | Yes | — |
+| `name` | `string` | Yes | — |
+| `slug` | `string` | Yes | — |
+| `description` | `string` | No | — |
+| `guidelines` | `string` | No | — |
+
+
+
+**Output**
+
+| Name | Type | Required | Description |
+|------|------|----------|-------------|
+| `name` | `string` | No | — |
+| `slug` | `string` | No | — |
+| `description` | `string` | No | — |
+| `guidelines` | `string` | No | — |
+| `created` | `string` | No | — |
+| `modified` | `string` | No | — |
+| `workflow_enabled` | `boolean` | No | — |
+| `resource_uri` | `string` | No | — |
+
+
+
+---
+
+### deleteProject
+
+`teams.deleteProject`
+
+Delete a project from a team
+
+**Risk:** `write`
+
+```ts
+await corsair.amara.api.teams.deleteProject({});
+```
+
+**Input**
+
+| Name | Type | Required | Description |
+|------|------|----------|-------------|
+| `team_slug` | `string` | Yes | — |
+| `project_slug` | `string` | Yes | — |
+
+
+
+**Output**
+
+| Name | Type | Required | Description |
+|------|------|----------|-------------|
+| `ok` | `true` | No | — |
+
+
+
+---
+
 ### getDetails
 
 `teams.getDetails`
@@ -286,6 +417,166 @@ await corsair.amara.api.teams.getLanguages({});
 
 
 
+---
+
+### getMember
+
+`teams.getMember`
+
+Get details for a specific team member
+
+**Risk:** `read`
+
+```ts
+await corsair.amara.api.teams.getMember({});
+```
+
+**Input**
+
+| Name | Type | Required | Description |
+|------|------|----------|-------------|
+| `team_slug` | `string` | Yes | — |
+| `username` | `string` | Yes | — |
+
+
+
+**Output**
+
+| Name | Type | Required | Description |
+|------|------|----------|-------------|
+| `user` | `object` | No | — |
+| `role` | `string` | No | — |
+| `languages_managed` | `string[]` | No | — |
+| `resource_uri` | `string` | No | — |
+
+<AccordionGroup>
+<Accordion title="user full type">
+
+```ts
+{
+  username?: string | null,
+  id?: string,
+  full_name?: string | null,
+  first_name?: string | null,
+  last_name?: string | null,
+  biography?: string | null,
+  homepage?: string | null,
+  avatar?: string | null,
+  languages?: string[],
+  num_videos?: number,
+  resource_uri?: string,
+  created_by?: string | null,
+  is_partner?: boolean,
+  activity_uri?: string
+} | string
+```
+</Accordion>
+</AccordionGroup>
+
+
+
+---
+
+### getProject
+
+`teams.getProject`
+
+Get details for a specific team project
+
+**Risk:** `read`
+
+```ts
+await corsair.amara.api.teams.getProject({});
+```
+
+**Input
```

**File**: `docs/plugins/amara/overview.mdx` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@ Use **Amara** through Corsair: one client, typed API calls, local DB sync.
 
 **What you get:**
 
-- 30 typed API operations
+- 43 typed API operations
 - 3 synced entities (`teams`, `users`, `videos`) for fast `.search()` / `.list()`
 
 ## Setup
```

**File**: `docs/plugins/aryn/api.mdx` (added, +505/-0)
```diff
@@ -0,0 +1,505 @@
+---
+title: API
+description: "API reference for Aryn: every `aryn.api.*` operation with input and output types."
+---
+
+Every `aryn.api.*` operation is listed below with parameter shapes and return types from the plugin Zod schemas.
+
+<Info>
+**New to Corsair?** See [API access](/concepts/api), [authentication](/concepts/auth), and [error handling](/concepts/error-handling).
+</Info>
+
+## Async Tasks
+
+### list
+
+`asyncTasks.list`
+
+List async partitioning tasks
+
+**Risk:** `read`
+
+```ts
+await corsair.aryn.api.asyncTasks.list({});
+```
+
+**Input**
+
+| Name | Type | Required | Description |
+|------|------|----------|-------------|
+| `path_filter` | `string` | No | — |
+
+
+
+**Output**
+
+| Name | Type | Required | Description |
+|------|------|----------|-------------|
+| `tasks` | `object` | Yes | — |
+
+<AccordionGroup>
+<Accordion title="tasks full type">
+
+```ts
+{
+}
+```
+</Accordion>
+</AccordionGroup>
+
+
+
+---
+
+## Docset
+
+### create
+
+`docset.create`
+
+Create a new DocSet
+
+**Risk:** `write`
+
+```ts
+await corsair.aryn.api.docset.create({});
+```
+
+**Input**
+
+| Name | Type | Required | Description |
+|------|------|----------|-------------|
+| `name` | `string` | Yes | — |
+| `schema` | `any` | No | — |
+| `properties` | `object` | No | — |
+| `prompts` | `object` | No | — |
+
+<AccordionGroup>
+<Accordion title="properties full type">
+
+```ts
+{
+}
+```
+</Accordion>
+
+<Accordion title="prompts full type">
+
+```ts
+{
+}
+```
+</Accordion>
+</AccordionGroup>
+
+
+
+**Output**
+
+| Name | Type | Required | Description |
+|------|------|----------|-------------|
+| `docset_id` | `string` | Yes | — |
+| `name` | `string` | Yes | — |
+| `readonly` | `boolean` | Yes | — |
+| `properties` | `object` | No | — |
+| `schema` | `any` | No | — |
+| `size` | `number` | No | — |
+
+<AccordionGroup>
+<Accordion title="properties full type">
+
+```ts
+{
+}
+```
+</Accordion>
+</AccordionGroup>
+
+
+
+---
+
+### delete
+
+`docset.delete`
+
+Delete a DocSet
+
+**Risk:** `destructive`
+
+```ts
+await corsair.aryn.api.docset.delete({});
+```
+
+**Input**
+
+| Name | Type | Required | Description |
+|------|------|----------|-------------|
+| `docset_id` | `string` | Yes | — |
+
+
+
+**Output**
+
+| Name | Type | Required | Description |
+|------|------|----------|-------------|
+| `docset_id` | `string` | Yes | — |
+| `name` | `string` | Yes | — |
+| `readonly` | `boolean` | Yes | — |
+| `properties` | `object` | No | — |
+| `schema` | `any` | No | — |
+| `size` | `number` | No | — |
+
+<AccordionGroup>
+<Accordion title="properties full type">
+
+```ts
+{
+}
+```
+</Accordion>
+</AccordionGroup>
+
+
+
+---
+
+### get
+
+`docset.get`
+
+Get DocSet metadata
+
+**Risk:** `read`
+
+```ts
+await corsair.aryn.api.docset.get({});
+```
+
+**Input**
+
+| Name | Type | Required | Description |
+|------|------|----------|-------------|
+| `docset_id` | `string` | Yes | — |
+
+
+
+**Output**
+
+| Name | Type | Required | Description |
+|------|------|----------|-------------|
+| `docset_id` | `string` | Yes | — |
+| `name` | `string` | Yes | — |
+| `readonly` | `boolean` | Yes | — |
+| `properties` | `object` | No | — |
+| `schema` | `any` | No | — |
+| `size` | `number` | No | — |
+
+<AccordionGroup>
+<Accordion title="properties full type">
+
+```ts
+{
+}
+```
+</Accordion>
+</AccordionGroup>
+
+
+
+---
+
+## Document
+
+### get
+
+`document.get`
+
+Get a document by ID
+
+**Risk:** `read`
+
+```ts
+await corsair.aryn.api.document.get({});
+```
+
+**Input**
+
+| Name | Type | Required | Description |
+|------|------|----------|-------------|
+| `docset_id` | `string` | Yes | — |
+| `doc_id` | `string` | Yes | — |
+| `include_elements` | `boolean` | No | — |
+| `include_binary` | `boolean` | No | — |
+| `include_original_elements` | `boolean` | No | — |
+
+
+
+**Output**
+
+| Name | Type | Required | Description |
+|------|------|----------|-------------|
+| `id` | `string` | Yes | — |
+| `element
```

**File**: `docs/plugins/aryn/database.mdx` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+---
+title: Database
+description: "Aryn local sync: searchable entities, `.search()` filters, and operators."
+---
+
+The Aryn plugin syncs data locally. Use `corsair.aryn.db.<entity>.search({ data, limit?, offset? })` with the filters listed per entity.
+
+<Info>
+**New to Corsair?** See [database operations](/concepts/database), [data synchronization](/concepts/integrations), and [multi-tenancy](/concepts/multi-tenancy).
+</Info>
+
+
```

---

### Incident Patch 9: `d7e06793` (2026-09-22)
**Commit Message**: fix: update integration listings

**File**: `docs/plugins/filevine/api.mdx` (modified, +5/-1)
```diff
@@ -1047,7 +1047,11 @@ Create a webhook subscription
 **Risk:** `write`
 
 ```ts
-await corsair.filevine.api.webhooks.create({ name: 'Hook', endpoint: 'https://example.com/hook', events: ['project.created'] });
+await corsair.filevine.api.webhooks.create({
+	name: 'Hook',
+	endpoint: 'https://example.com/hook',
+	events: ['project.created'],
+});
 ```
 
 **Input**
```

**File**: `docs/plugins/filevine/overview.mdx` (modified, +2/-2)
```diff
@@ -1,14 +1,14 @@
 ---
 title: Overview
-description: "Filevine plugin for Corsair"
+description: "Legal case management platform for projects, contacts, documents, tasks, and deadlines."
 ---
 
 Use **Filevine** through Corsair: one client, typed API calls, local DB sync.
 
 **What you get:**
 
 - 24 typed API operations
-- 7 synced entities (`contacts`, `deadlines`, `documents`, `notes`, `projects`, `subscriptions`, `tasks`) for fast `.search()` / `.list()`
+- 7 synced entities (`contacts`, `deadlines`, `documents`, `notes`, `projects`, `subscriptions`, and 1 more) for fast `.search()` / `.list()`
 
 ## Setup
 
```

**File**: `explorer/data/catalog.json` (modified, +871/-3)
```diff
@@ -1,6 +1,6 @@
 {
-  "generatedAt": "2026-09-08T17:15:47.532Z",
-  "corsairVersion": "0.1.128",
+  "generatedAt": "2026-09-22T19:27:40.903Z",
+  "corsairVersion": "0.1.137",
   "catalogVersion": 2,
   "plugins": [
     {
@@ -1823,6 +1823,21 @@
         "db": 4
       }
     },
+    {
+      "id": "cosmic",
+      "displayName": "Cosmic",
+      "description": "Cosmic plugin for Corsair",
+      "npmPackageName": "@corsair-dev/cosmic",
+      "authTypes": [
+        "api_key"
+      ],
+      "defaultAuthType": "api_key",
+      "counts": {
+        "api": 20,
+        "webhooks": 0,
+        "db": 0
+      }
+    },
     {
       "id": "countdownapi",
       "displayName": "CountdownApi",
@@ -2140,6 +2155,21 @@
         "db": 4
       }
     },
+    {
+      "id": "emelia",
+      "displayName": "Emelia",
+      "description": "Emelia plugin for Corsair",
+      "npmPackageName": "@corsair-dev/emelia",
+      "authTypes": [
+        "api_key"
+      ],
+      "defaultAuthType": "api_key",
+      "counts": {
+        "api": 28,
+        "webhooks": 0,
+        "db": 2
+      }
+    },
     {
       "id": "epicgames",
       "displayName": "Epic Games",
@@ -2230,6 +2260,22 @@
         "db": 5
       }
     },
+    {
+      "id": "filevine",
+      "displayName": "Filevine",
+      "description": "Legal case management platform for projects, contacts, documents, tasks, and deadlines.",
+      "npmPackageName": "@corsair-dev/filevine",
+      "authTypes": [
+        "api_key",
+        "oauth_2"
+      ],
+      "defaultAuthType": "api_key",
+      "counts": {
+        "api": 24,
+        "webhooks": 0,
+        "db": 7
+      }
+    },
     {
       "id": "filloutforms",
       "displayName": "Fillout",
@@ -2332,7 +2378,7 @@
       ],
       "defaultAuthType": "api_key",
       "counts": {
-        "api": 52,
+        "api": 53,
         "webhooks": 100,
         "db": 11
       }
@@ -2823,6 +2869,21 @@
         "db": 4
       }
     },
+    {
+      "id": "kibana",
+      "displayName": "Kibana",
+      "description": "Kibana plugin for Corsair",
+      "npmPackageName": "@corsair-dev/kibana",
+      "authTypes": [
+        "api_key"
+      ],
+      "defaultAuthType": "api_key",
+      "counts": {
+        "api": 55,
+        "webhooks": 0,
+        "db": 3
+      }
+    },
     {
       "id": "linear",
       "displayName": "Linear",
@@ -3990,6 +4051,21 @@
         "db": 6
       }
     },
+    {
+      "id": "veriphone",
+      "displayName": "Veriphone",
+      "description": "Veriphone plugin for Corsair",
+      "npmPackageName": "@corsair-dev/veriphone",
+      "authTypes": [
+        "api_key"
+      ],
+      "defaultAuthType": "api_key",
+      "counts": {
+        "api": 4,
+        "webhooks": 0,
+        "db": 0
+      }
+    },
     {
       "id": "vestaboard",
       "displayName": "Vestaboard",
@@ -34572,6 +34648,126 @@
       "shortPath": "widget.updateV2",
       "haystack": "widget.updatev2 convoloai.api.widget.updatev2 update a widget via the v2 endpoint write"
     },
+    {
+      "pluginId": "cosmic",
+      "kind": "api",
+      "shortPath": "media.delete",
+      "haystack": "media.delete cosmic.api.media.delete delete media by id write"
+    },
+    {
+      "pluginId": "cosmic",
+      "kind": "api",
+      "shortPath": "media.find",
+      "haystack": "media.find cosmic.api.media.find list media in a bucket read"
+    },
+    {
+      "pluginId": "cosmic",
+      "kind": "api",
+      "shortPath": "media.findOne",
+      "haystack": "media.findone cosmic.api.media.findone get a single media item by name read"
+    },
+    {
+      "pluginId": "cosmic",
+      "kind": "api",
+      "shortPath": "media.insert",
+      "haystack": "media.insert cosmic.api.media.insert upload media to a bucket write"
+    },
+    {
+      "pluginId": "cosmic",
+      "kind": "api",
+      "shortPath": "media.update",
+      "haystack": "media.update cosmic.api.media.update update media metadata by id write"
+    },
+    
```

**File**: `explorer/data/icon-manifest.json` (modified, +14/-4)
```diff
@@ -1,11 +1,11 @@
 {
-  "generatedAt": "2026-09-18T04:29:42.582Z",
+  "generatedAt": "2026-09-22T19:16:21.825Z",
   "primarySource": "https://twenty-icons.com",
   "fallbackSource": "https://www.google.com/s2/favicons",
   "size": 128,
   "format": "png",
-  "total": 283,
-  "succeeded": 283,
+  "total": 288,
+  "succeeded": 288,
   "failed": 0,
   "domains": {
     "ably": "ably.io",
@@ -129,6 +129,7 @@
     "contentfulgraphql": "contentful.com",
     "contextsevenmcp": "contextsevenmcp.com",
     "convoloai": "brightcall.ai",
+    "cosmic": "cosmicjs.com",
     "countdownapi": "countdownapi.com",
     "crowterminal": "crowterminal.com",
     "cursor": "cursor.com",
@@ -150,12 +151,14 @@
     "dropbox": "dropbox.com",
     "dropboxsign": "dropboxsign.com",
     "dynapictures": "dynapictures.com",
+    "emelia": "emelia.io",
     "epicgames": "epicgames.com",
     "exa": "exa.ai",
     "exist": "exist.com",
     "facebook": "facebook.com",
     "faraday": "faraday.com",
     "figma": "figma.com",
+    "filevine": "filevine.com",
     "filloutforms": "filloutforms.com",
     "firecrawl": "firecrawl.dev",
     "fireflies": "fireflies.ai",
@@ -195,6 +198,7 @@
     "jigsawstack": "jigsawstack.com",
     "jira": "atlassian.com",
     "kaggle": "kaggle.com",
+    "kibana": "elastic.co",
     "linear": "linear.app",
     "linkedin": "linkedin.com",
     "loyverse": "loyverse.com",
@@ -272,6 +276,7 @@
     "uploadcare": "uploadcare.com",
     "vapi": "vapi.ai",
     "vercel": "vercel.com",
+    "veriphone": "veriphone.io",
     "vestaboard": "vestaboard.com",
     "wakatime": "wakatime.com",
     "webflow": "webflow.com",
@@ -293,7 +298,11 @@
     "zoominfo": "zoominfo.com"
   },
   "sources": {
-    "googledocs": "url-override",
+    "filevine": "url-override",
+    "kibana": "twenty-icons",
+    "veriphone": "twenty-icons",
+    "emelia": "twenty-icons",
+    "cosmic": "twenty-icons",
     "ably": "twenty-icons",
     "abstract": "twenty-icons",
     "abuseipdb": "twenty-icons",
@@ -457,6 +466,7 @@
     "googlebigquery": "twenty-icons",
     "googlecalendar": "twenty-icons",
     "googlecloudvision": "twenty-icons",
+    "googledocs": "url-override",
     "googledrive": "twenty-icons",
     "googlemaps": "twenty-icons",
     "googlemeet": "twenty-icons",
```

**File**: `explorer/data/plugins/cosmic.json` (added, +994/-0)
```diff
@@ -0,0 +1,994 @@
+{
+  "id": "cosmic",
+  "displayName": "Cosmic",
+  "description": "Cosmic plugin for Corsair",
+  "npmPackageName": "@corsair-dev/cosmic",
+  "authTypes": ["api_key"],
+  "defaultAuthType": "api_key",
+  "counts": {
+    "api": 20,
+    "webhooks": 0,
+    "db": 0
+  },
+  "auth": [
+    {
+      "authType": "api_key",
+      "integrationFields": [],
+      "accountFields": ["api_key", "webhook_signature", "bucket_slug"]
+    }
+  ],
+  "api": [
+    {
+      "path": "cosmic.api.media.delete",
+      "shortPath": "media.delete",
+      "description": "Delete Media by id",
+      "riskLevel": "write",
+      "input": {
+        "kind": "object",
+        "fields": [
+          {
+            "key": "bucketSlug",
+            "optional": true,
+            "type": "string"
+          },
+          {
+            "key": "id",
+            "optional": false,
+            "type": "string"
+          },
+          {
+            "key": "trigger_webhook",
+            "optional": true,
+            "type": "boolean"
+          }
+        ]
+      },
+      "output": {
+        "kind": "object",
+        "fields": [
+          {
+            "key": "message",
+            "optional": false,
+            "type": "string"
+          }
+        ]
+      }
+    },
+    {
+      "path": "cosmic.api.media.find",
+      "shortPath": "media.find",
+      "description": "List Media in a Bucket",
+      "riskLevel": "read",
+      "input": {
+        "kind": "object",
+        "fields": [
+          {
+            "key": "bucketSlug",
+            "optional": true,
+            "type": "string"
+          },
+          {
+            "key": "query",
+            "optional": true,
+            "type": "{}"
+          },
+          {
+            "key": "props",
+            "optional": true,
+            "type": "string"
+          },
+          {
+            "key": "sort",
+            "optional": true,
+            "type": "string"
+          },
+          {
+            "key": "limit",
+            "optional": true,
+            "type": "number"
+          },
+          {
+            "key": "skip",
+            "optional": true,
+            "type": "number"
+          }
+        ]
+      },
+      "output": {
+        "kind": "object",
+        "fields": [
+          {
+            "key": "media",
+            "optional": false,
+            "type": "{ id: string, name: string, original_name?: string, url?: string, imgix_url?: string, folder?: string, alt_text?: string, width?: number, height?: number, size?: number | string, type?: string, bucket?: string, created_at?: string, metadata?: {} }[]"
+          },
+          {
+            "key": "total",
+            "optional": false,
+            "type": "number"
+          },
+          {
+            "key": "limit",
+            "optional": true,
+            "type": "number"
+          }
+        ]
+      }
+    },
+    {
+      "path": "cosmic.api.media.findOne",
+      "shortPath": "media.findOne",
+      "description": "Get a single Media item by name",
+      "riskLevel": "read",
+      "input": {
+        "kind": "object",
+        "fields": [
+          {
+            "key": "bucketSlug",
+            "optional": true,
+            "type": "string"
+          },
+          {
+            "key": "name",
+            "optional": false,
+            "type": "string"
+          },
+          {
+            "key": "props",
+            "optional": true,
+            "type": "string"
+          }
+        ]
+      },
+      "output": {
+        "kind": "object",
+        "fields": [
+          {
+            "key": "media",
+            "optional": false,
+            "type": "{ id: string, name: string, original_name?: string, url?: string, imgix_url?: string, folder?: string, alt_text?: string, width?: number, height?: number, size?: number | string, type?: string, bucket?: string, created_at?: string, metadata?: {} }"
+          }
+        ]
+      }
+    },
+    {
```

---

### Incident Patch 10: `73c7fb11` (2026-09-21)
**Commit Message**: fix: update icon manifest

**File**: `explorer/data/icon-manifest.json` (modified, +2/-2)
```diff
@@ -1,5 +1,5 @@
 {
-  "generatedAt": "2026-09-18T04:26:15.850Z",
+  "generatedAt": "2026-09-18T04:29:42.582Z",
   "primarySource": "https://twenty-icons.com",
   "fallbackSource": "https://www.google.com/s2/favicons",
   "size": 128,
@@ -293,7 +293,7 @@
     "zoominfo": "zoominfo.com"
   },
   "sources": {
-    "googledocs": "twenty-icons",
+    "googledocs": "url-override",
     "ably": "twenty-icons",
     "abstract": "twenty-icons",
     "abuseipdb": "twenty-icons",
```

**File**: `packages/agiled/readme.md` (modified, +24/-6)
```diff
@@ -1,13 +1,31 @@
-# Agiled Integration
+# @corsair-dev/agiled
 
-This plugin integrates the [Agiled API](https://docs.agiled.app/docs/developers/api-keys/) with Corsair. It enables programmatic management of business operations such as CRM, HR, and project management.
+Agiled plugin for Corsair.
 
-## Authentication
+## Install
 
-This integration uses the `api_key` authentication method. You must provide an Agiled API Key, which you can generate from your workspace under **Settings > API Settings**.
+```bash
+pnpm add @corsair-dev/agiled
+```
 
 ## Endpoints
 
-Currently supported endpoints:
+| Operation | Operation ID | Risk | Description |
+|-----------|--------------|------|-------------|
+| `contacts.list` | `agiled.api.contacts.list` | `read` | List contacts from an Agiled workspace |
 
-- `contacts.list`: Fetch a list of contacts from your Agiled CRM.
+## Auth
+
+Auth: API key. Corsair prompts your tenant for credentials on first use.
+
+## Webhooks
+
+No webhooks.
+
+## Reference
+
+Full docs, types, and examples: https://docs.corsair.dev/plugins/agiled
+
+## License
+
+Apache-2.0
```

**File**: `scripts/fetch-plugin-icons.ts` (modified, +41/-2)
```diff
@@ -29,7 +29,13 @@ const CONCURRENCY = 12;
 
 const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
 
-type IconSource = 'twenty-icons' | 'google-favicon';
+type IconSource = 'twenty-icons' | 'google-favicon' | 'url-override';
+
+/** Product marks twenty-icons can't distinguish (Docs vs Sheets on docs.google.com). */
+const PLUGIN_ICON_URL_OVERRIDES: Record<string, string> = {
+	googledocs:
+		'https://www.gstatic.com/images/branding/product/2x/docs_2020q4_96dp.png',
+};
 
 type FetchResult =
 	| { ok: true; bytes: Buffer; source: IconSource }
@@ -73,6 +79,39 @@ function isPng(bytes: Buffer): boolean {
 	);
 }
 
+async function fetchDirectIcon(url: string): Promise<FetchResult> {
+	try {
+		const response = await fetch(url, {
+			headers: { 'User-Agent': 'corsair-plugin-icon-fetch/1.0' },
+		});
+		if (!response.ok) {
+			return {
+				ok: false,
+				error: `url-override HTTP ${response.status}`,
+			};
+		}
+		const bytes = Buffer.from(await response.arrayBuffer());
+		if (bytes.length === 0 || !isPng(bytes)) {
+			return { ok: false, error: 'url-override returned no PNG' };
+		}
+		return { ok: true, bytes, source: 'url-override' };
+	} catch (error) {
+		const message = error instanceof Error ? error.message : String(error);
+		return { ok: false, error: `url-override failed: ${message}` };
+	}
+}
+
+async function fetchPluginIcon(
+	pluginId: string,
+	domain: string,
+): Promise<FetchResult> {
+	const overrideUrl = PLUGIN_ICON_URL_OVERRIDES[pluginId];
+	if (overrideUrl) {
+		return fetchDirectIcon(overrideUrl);
+	}
+	return fetchIcon(domain);
+}
+
 async function fetchIcon(domain: string): Promise<FetchResult> {
 	const primaryUrl = `${PRIMARY_SOURCE}/${domain}`;
 
@@ -193,7 +232,7 @@ async function main(): Promise<void> {
 
 		await mapWithConcurrency(targets, CONCURRENCY, async (pluginId) => {
 			const domain = domains[pluginId] ?? resolvePluginDomain(pluginId);
-			const result = await fetchIcon(domain);
+			const result = await fetchPluginIcon(pluginId, domain);
 
 			if (!result.ok) {
 				failures.push({ id: pluginId, domain, error: result.error });
```

#### Recent Merged Pull Requests:
- **PR #1801** (2026-09-30): fix(www): guard invalid dates and add year unit to formatRelativeTime (@MauryaQbit)
- **PR #1794** (closed): feat(updownio): add integration plugin (@yuvrxj-afk)
- **PR #1793** (2026-09-29): fix(twilio): throw AuthMissingError when credentials are missing (@scs0209)
- **PR #1792** (2026-09-30): fix(twilio): split stored key on first colon only (@marosmamrak)
- **PR #1790** (closed): fix(twilio): preserve colons in auth token when splitting key (@MauryaQbit)
- **PR #1789** (closed): fix(twilio): preserve colons in auth token when splitting key (@MauryaQbit)
- **PR #1788** (closed): fix(twilio): preserve colons in auth token when splitting key (@MauryaQbit)
- **PR #1785** (2026-09-29): docs(skill): use npx corsair instead of invalid npm corsair commands (@kirtanparikh)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
