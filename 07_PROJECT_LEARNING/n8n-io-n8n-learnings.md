# Forensic Learning Record (Deep Inspection): n8n-io/n8n

> **Canonical Artifact**: `07_PROJECT_LEARNING/n8n-io-n8n-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/n8n-io/n8n](https://github.com/n8n-io/n8n))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-29T21:27:52.792Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `n8n-io/n8n`
- **Description**: Fair-code workflow automation platform with native AI capabilities. Combine visual building with custom code, self-host or cloud, 400+ integrations.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 206299 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.claude/plugins/n8n/scripts/track-skill-usage.mjs`
```
#!/usr/bin/env node

// Tracks n8n plugin skill usage by sending anonymized analytics.
// Called as a PostToolUse hook for the Skill tool.
// Receives JSON on stdin: { "tool_name": "Skill", "tool_input": { "skill": "n8n:foo", ... }, "tool_response": ... }

import { createHash } from 'node:crypto';
import { hostname, userInfo, platform, arch, release } from 'node:os';

const TELEMETRY_HOST = 'https://telemetry.n8n.io';
const TELEMETRY_WRITE_KEY = '1zPn7YoGC3ZXE9zLeTKLuQCB4F6';

const input = await new Promise((resolve) => {
	let data = '';
	process.stdin.on('data', (chunk) => (data += chunk));
	process.stdin.on('end', () => resolve(data));
});

const { tool_input: toolInput } = JSON.parse(input);
const skillName = toolInput?.skill;

// Only track n8n-namespaced skills ("n8n-foo" or "n8n:foo")
const isN8nSkill = skillName.startsWith('n8n:') || skillName.startsWith('n8n-');
if (!skillName || !isN8nSkill) {
	process.exit(0);
}

// Generate anonymized user ID: SHA-256 of (username + hostname + OS + arch + release)
const raw = `${userInfo().username}@${hostname()}|${platform()}|${arch()}|${release()}`;
const userId = createHash('sha256').update(raw).digest('hex');

const payload = JSON.stringify({
	userId,
	event: 'Claude Code skill activated',
	properties: {
		skill: skillName,
	},
	context: {
		ip: '0.0.0.0',
	},
});

// Send to telemetry HTTP Track API (fire-and-forget, never block the user)
try {
	await fetch(`${TELEMETRY_HOST}/v1/track`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Basic ${Buffer.from(`${TELEMETRY_WRITE_KEY}:`).toString('base64')}`,
		},
		body: payload,
	});
} catch {
	// Silently ignore network errors
}

```

### Core Architecture Module: `.devcontainer/codespaces/agent-worker.mjs`
```
#!/usr/bin/env node
// GitHub keeps Codespaces ports private, so inbound delivery is not available.
import { spawn } from 'node:child_process';
import { resolve as resolvePath, sep } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

import { codespaceEnv } from '../../scripts/codespace-env.mjs';

const DEQUEUE_URL = process.env.N8N_DEQUEUE_URL;
const TOKEN = process.env.AGENT_WORKER_TOKEN;
const SLACK_TOKEN = process.env.SLACK_BOT_TOKEN;
// tmux can retain empty identity values, but the Codespaces files stay current.
const GITHUB_USER = codespaceEnv('GITHUB_USER');
const BOX_ID = codespaceEnv('CODESPACE_NAME');
const ROOT = '/workspaces';

const INITIAL_POLL_INTERVAL_MS = 3000;
const MAX_POLL_INTERVAL_MS = 30_000;
const SLACK_UPDATE_INTERVAL_MS = 1500;
const SLACK_TEXT_LIMIT = 3900;

export function openCodeConfig(environment) {
	const config = {
		provider: { openrouter: { options: { apiKey: '{env:OPENROUTER_API_KEY}' } } },
	};
	if (environment.FLAKY_MCP_URL && environment.FLAKY_MCP_TOKEN) {
		config.mcp = {
			flaky: {
				type: 'remote',
				url: environment.FLAKY_MCP_URL,
				enabled: true,
				oauth: false,
				headers: { Authorization: 'Bearer {env:FLAKY_MCP_TOKEN}' },
			},
		};
	}
	return config;
}

function posNum(name, fallback) {
	const raw = process.env[name];
	if (raw === undefined) return fallback;
	const n = Number(raw);
	if (Number.isFinite(n) && n > 0) return n;
	console.error(`${name} is not a positive number ("${raw}"); using ${fallback}.`);
	return fallback;
}

function nextIdlePollInterval(interval) {
	return Math.min(interval * 2, MAX_POLL_INTERVAL_MS);
}

export async function pollOnce(
	interval,
	{ dequeueTurn = dequeue, handleTurn = handle, wait = sleep, logError = console.error } = {},
) {
	let turn;
	try {
		turn = await dequeueTurn();
	} catch (error) {
		logError(`poll error: ${error.message}`);
		await wait(interval);
		return nextIdlePollInterval(interval);
	}
	if (!turn) {
		await wait(interval);
		return nextIdlePollInterval(interval);
	}
	try {
		await handleTurn(turn);
		return INITIAL_POLL_INTERVAL_MS;
	} catch (error) {
		logError(`poll error: ${error.message}`);
		await wait(INITIAL_POLL_INTERVAL_MS);
		return nextIdlePollInterval(INITIAL_POLL_INTERVAL_MS);
	}
}

// This limit expires before n8n's Wait node so that the user receives a specific error.
const TURN_TIMEOUT_MS = posNum('TURN_TIMEOUT_MS', 25 * 60_000);
function turnTimeoutMessage(timeou
```

### Core Architecture Module: `.devcontainer/codespaces/fake-bin.mjs`
```
// Fake executables for tests. Each shim is a Node script. It receives `args`, `root`,
// `file(name)` under the root, and `log(event)`, which appends to calls.jsonl in the root.
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const COMMON = `
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
const root = process.env.TEST_ROOT;
const file = (name) => path.join(root, name);
const log = (event) => fs.appendFileSync(file('calls.jsonl'), JSON.stringify(event) + '\\n');
`;

export function fakeBinaries(prefix) {
	const root = mkdtempSync(join(tmpdir(), prefix));
	const binDir = join(root, 'bin');
	mkdirSync(binDir);
	const logFile = join(root, 'calls.jsonl');
	writeFileSync(logFile, '');
	return {
		root,
		env: { PATH: `${binDir}:${process.env.PATH}`, TEST_ROOT: root },
		bin: (name, body) =>
			writeFileSync(join(binDir, name), `#!${process.execPath}\n${COMMON}\n${body}`, {
				mode: 0o755,
			}),
		calls: () =>
			readFileSync(logFile, 'utf8')
				.trim()
				.split('\n')
				.filter(Boolean)
				.map((line) => JSON.parse(line)),
	};
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #39686** (2026-09-29): **fix(Email Trigger (IMAP) Node): Stop polling indefinitely when a full batch has no new emails**
  *Symptoms*: ## Summary  The pagination loop in the Email Trigger (IMAP) node's `getNewEmails()` only checked `results.length >= EMAIL_BATCH_SIZE` before fetching the next page. The search criteria only change once `maxUid` advances, so when a full batch holds no new messages — every message at or below the `lastMessageUid` watermark — the same batch was refetched forever, running the full poll cycle on every pass (the reporting user's runaway-memory scenario from #39683).  This PR captures `maxUid` at the start of each pass and requires forward progress before searching again.  ## How to test  Added `stop
  **Post-Mortem & Fix Analysis**:
  > <!-- n8n-cla-check --> ✅ **CLA Check passed.** All contributors on this PR have signed the n8n CLA — thank you!
  > /cla-check

- **Issue #39126** (2026-09-20): **feat: add NEXA mock monitoring workflows (no-changelog)**
  *Symptoms*: ## Summary  Adds five inactive, importable n8n workflow definitions and documentation for the NEXA Trade monitoring design. The workflows use synthetic data only and enforce the PAPER-only, read-only safety boundary. They do not connect to production systems, use credentials, submit orders, change risk controls, or reset the Kill Switch.  ## How to test  Validated locally with the following checks:  - Parsed all five workflow exports as JSON. - Compiled every Code node script. - Executed each mock workflow chain. - Confirmed every workflow has `active: false`. - Confirmed no mock order or cont
  **Post-Mortem & Fix Analysis**:
  > Hey @abdulmalikhamid6-svg,  Thank you for your contribution. We appreciate the time and effort you’ve taken to submit this pull request.  Before we can proceed, please ensure the following: • Your PR references the GitHub issue it fixes (or, for feature requests, a link to the corresponding community forum post). • Tests are included for any new functionality, logic changes or bug fixes. • The PR 
  > @n8n-assistant[bot] I reviewed the contribution as documentation and five inactive synthetic mock exports, not a new core node or production integration. No source GitHub issue or forum post was provided to link; I made no code change, and focused validation confirmed all five exports are valid JSON, inactive, credential-free, and contain nodes.

- **Issue #38969** (2026-09-17): **Update Node.js to latest versions in base image (1/3)**
  *Symptoms*: ## Summary  This updates the base dhi image in the n8nio/base image.  Fixes #38977  This is part 1 of 3 commits: - update base image and publish #38969 - update node-pc image and publish (needs published base image) #38970 - update all the rest of the images (needs published base and node-pc) #38971  ## How to test  Run integrated tests  ## Review / Merge checklist  - [x] I have seen this code, I have run this code, and I take responsibility for this code. - [x] PR title and summary are descriptive. ([conventions](../blob/master/.github/pull_request_title_conventions.md)) <!-
  **Post-Mortem & Fix Analysis**:
  > <!-- n8n-cla-check --> ✅ **CLA Check passed.** All contributors on this PR have signed the n8n CLA — thank you!
  > Hey @danez,  Thank you for your contribution. We appreciate the time and effort you’ve taken to submit this pull request.  Before we can proceed, please ensure the following: • Your PR references the GitHub issue it fixes (or, for feature requests, a link to the corresponding community forum post). • Tests are included for any new functionality, logic changes or bug fixes. • The PR aligns with our

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

### Incident Patch 1: `31b6649d` (2026-09-29)
**Commit Message**: fix(core): Check credential types that HTTP Request names by parameter (no-changelog) (#39429)

Co-authored-by: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `packages/cli/src/modules/type-availability-policies/__tests__/credential-type-policy.check.test.ts` (modified, +129/-1)
```diff
@@ -7,6 +7,8 @@ import type {
 import type { INode } from 'n8n-workflow';
 import { mock } from 'vitest-mock-extended';
 
+import type { NodeTypes } from '@/node-types';
+
 import { CredentialTypePolicyCheck } from '../credential-type-policy.check';
 import type {
 	ComposedTypeEvaluation,
@@ -85,7 +87,8 @@ const versions: ComposedTypeEvaluation['versions'] = [
 describe('CredentialTypePolicyCheck', () => {
 	const service = mock<TypeAvailabilityPolicyService>();
 	const licenseState = mock<LicenseState>();
-	const check = new CredentialTypePolicyCheck(service, licenseState);
+	const nodeTypes = mock<NodeTypes>();
+	const check = new CredentialTypePolicyCheck(service, licenseState, nodeTypes);
 
 	/** Denies whichever of the requested types are in `deniedTypes`. */
 	const denying = (deniedTypes: string[], verdictOverrides: Partial<ComposedTypeVerdict> = {}) =>
@@ -218,6 +221,131 @@ describe('CredentialTypePolicyCheck', () => {
 		});
 	});
 
+	describe('a credential type named by parameter', () => {
+		// Mirrors HTTP Request: the selector only counts while its auth mode is chosen.
+		const httpRequestDescription = {
+			credentials: [],
+			properties: [
+				{
+					name: 'nodeCredentialType',
+					type: 'credentialsSelect',
+					displayOptions: { show: { authentication: ['predefinedCredentialType'] } },
+				},
+				{
+					name: 'genericAuthType',
+					type: 'credentialsSelect',
+					displayOptions: { show: { authentication: ['genericCredentialType'] } },
+				},
+		
```

**File**: `packages/cli/src/modules/type-availability-policies/credential-type-policy.check.ts` (modified, +49/-17)
```diff
@@ -14,6 +14,10 @@ import type {
 	WorkflowTransferContext,
 } from '@n8n/decorators';
 import { PolicyCheck } from '@n8n/decorators';
+import type { INode, INodeTypeDescription } from 'n8n-workflow';
+import { getActiveCredentialTypes } from 'n8n-workflow';
+
+import { NodeTypes } from '@/node-types';
 
 import { CREDENTIAL_TYPES_KIND } from './constants';
 import {
@@ -26,21 +30,7 @@ const NO_VIOLATIONS: PolicyCheckResult = { violations: [] };
 /** Nothing to grandfather, for the points that report the full list. */
 const NOTHING_GRANDFATHERED: ReadonlySet<string> = new Set();
 
-/**
- * The credential types a workflow's nodes ask for, which are the keys of each node's
- * `credentials` map. A node that names a type without selecting a credential still counts:
- * the workflow is built around a type the policy refuses.
- */
-function distinctCredentialTypes(nodes: PolicedWorkflow['nodes']): string[] {
-	// A Set keeps first-encounter order, so violations and audit lines stay deterministic.
-	const types = new Set<string>();
-
-	for (const node of nodes) {
-		for (const type of Object.keys(node.credentials ?? {})) types.add(type);
-	}
-
-	return [...types];
-}
+const CREDENTIAL_TYPE_PARAMETERS = ['nodeCredentialType', 'genericAuthType'] as const;
 
 function toViolation(checkId: string, verdict: ComposedTypeVerdict): PolicyViolation {
 	const by = verdict.scope === 'instance' ? 'an instance policy' : "this project's policy";
@@ -75,6 +65,7 @@ export class CredentialTypePoli
```

---

### Incident Patch 2: `6918fda0` (2026-09-29)
**Commit Message**: fix(API): Emit valid schemas for untyped values in the Public API spec (#39884)

Co-authored-by: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `packages/cli/src/public-api/v1/handlers/audit/spec/paths/generateAudit.generated.yml` (modified, +6/-12)
```diff
@@ -131,8 +131,7 @@ responses:
                                     - filePath
                           settings:
                             type: object
-                            additionalProperties:
-                              nullable: true
+                            additionalProperties: {}
                           nextVersions:
                             type: array
                             items:
@@ -247,8 +246,7 @@ responses:
                                     - filePath
                           settings:
                             type: object
-                            additionalProperties:
-                              nullable: true
+                            additionalProperties: {}
                           nextVersions:
                             type: array
                             items:
@@ -366,8 +364,7 @@ responses:
                                     - filePath
                           settings:
                             type: object
-                            additionalProperties:
-                              nullable: true
+                            additionalProperties: {}
                           nextVersions:
                             type: array
                             items:
@@ -485,8 +482,7 @@ responses:
                                     - filePath
                           settings:
                             type: object
-                            additionalProperties:
-         
```

**File**: `packages/cli/src/public-api/v1/handlers/credentials/spec/paths/createCredential.generated.yml` (modified, +1/-2)
```diff
@@ -35,8 +35,7 @@ requestBody:
             example: githubApi
           data:
             type: object
-            additionalProperties:
-              nullable: true
+            additionalProperties: {}
             writeOnly: true
             example:
               accessToken: ada612vad6fa5df4adf5a5dsf4389adsf76da7s
```

**File**: `packages/cli/src/public-api/v1/handlers/credentials/spec/paths/getCredentialType.generated.yml` (modified, +2/-4)
```diff
@@ -30,8 +30,7 @@ responses:
                 - object
             properties:
               type: object
-              additionalProperties:
-                nullable: true
+              additionalProperties: {}
               description: JSON Schema fragment for each of the credential type's fields, keyed by field name.
               example:
                 apiKey:
@@ -48,8 +47,7 @@ responses:
                 - domain
             allOf:
               type: array
-              items:
-                nullable: true
+              items: {}
           required:
             - additionalProperties
             - type
```

---

### Incident Patch 3: `d69b52e2` (2026-09-29)
**Commit Message**: fix(editor): Keep credentials unchanged on read-only canvases (#39889)

Co-authored-by: n8n-cat-bot[bot] <n8n-cat-bot[bot]@users.noreply.github.com>
Co-authored-by: Svetoslav Dekov <svetoslav.dekov@n8n.io>
Co-authored-by: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `packages/frontend/editor-ui/src/app/composables/useWorkflowSaving.test.ts` (modified, +2/-3)
```diff
@@ -2046,9 +2046,8 @@ describe('useWorkflowSaving', () => {
 
 	describe('autosave on a read-only preview canvas', () => {
 		// Preview hosts (template, workflow history, execution) mount the real
-		// NodeView and supersede the editor context with `readOnly: true`. Opening a
-		// node there auto-selects a credential, which marks the document dirty and
-		// reaches this composable — so the read-only signal has to stop the write.
+		// NodeView and supersede the editor context with `readOnly: true`. The
+		// read-only signal must stop writes if another path marks the document dirty.
 		// Regression cover for ADO-5764.
 		const PREVIEW_FEATURES: EditorEnabledFeatures = {
 			readOnly: true,
```

**File**: `packages/frontend/editor-ui/src/features/credentials/components/NodeCredentials.test.ts` (modified, +52/-1)
```diff
@@ -27,7 +27,11 @@ import { useUsersStore } from '@n8n/stores/users.store';
 import type { IUser } from '@n8n/rest-api-client/api/users';
 import { useAiGateway } from '@/app/composables/useAiGateway';
 import { AI_GATEWAY_TOP_UP_MODAL_KEY } from '@/app/constants';
-import { ChatHubToolContextKey, WorkflowDocumentStoreKey } from '@/app/constants/injectionKeys';
+import {
+	ChatHubToolContextKey,
+	EditorEnabledFeaturesKey,
+	WorkflowDocumentStoreKey,
+} from '@/app/constants/injectionKeys';
 import {
 	useWorkflowDocumentStore,
 	createWorkflowDocumentId,
@@ -1718,6 +1722,53 @@ describe('NodeCredentials', () => {
 	});
 
 	describe('credential auto-select', () => {
+		// ADO-5791: Preview canvases open the NDV in read-only mode.
+		it.each([
+			{ source: 'the readonly prop', readonly: true, editorReadOnly: false },
+			{ source: 'the editor context', readonly: false, editorReadOnly: true },
+		])(
+			'does not assign a credential on a read-only canvas set by $source',
+			({ readonly, editorReadOnly }) => {
+				const nodeWithoutCredentials: INodeUi = { ...openAiNodeNoCreds, credentials: {} };
+				mockedStore(useNodeTypesStore).setNodeTypes([
+					{
+						name: nodeWithoutCredentials.type,
+						displayName: 'OpenAI',
+						version: nodeWithoutCredentials.typeVersion,
+						group: ['transform'],
+						description: '',
+						defaults: { name: 'OpenAI' },
+						inputs: [NodeConnectionTypes.Main],
+						outputs: [NodeConnectionTypes.Main],
+						credentials: [{ name
```

**File**: `packages/frontend/editor-ui/src/features/credentials/components/NodeCredentials.vue` (modified, +2/-2)
```diff
@@ -157,7 +157,7 @@ const NEW_CREDENTIALS_TEXT = i18n.baseText('nodeCredentials.createNew');
 const N8N_CREDITS_LABEL = i18n.baseText('aiGateway.credentialMode.n8nConnect.title');
 
 const instanceAiCapability = useInstanceAiEditorCapability();
-const { instanceAi } = useEditorContext();
+const { instanceAi, readOnly } = useEditorContext();
 const isToolContext = inject(ChatHubToolContextKey, false);
 
 // The host's credential-help behavior, handed to the (teleported) credential
@@ -423,7 +423,7 @@ let hasEvaluatedCredentials = false;
 watch(
 	credentialTypesNodeDescriptionDisplayed,
 	(types) => {
-		if (props.skipAutoSelect) return;
+		if (props.skipAutoSelect || props.readonly || readOnly.value) return;
 		if (types.length === 0) return;
 		// Before the scoped fetch lands there are no options to pick from, which would
 		// read as "no credentials exist" and auto-enable the AI Gateway below. The
```

---

### Incident Patch 4: `e13c4806` (2026-09-29)
**Commit Message**: fix(core): Apply MCP availability rules to error workflow settings (#39885)

Co-authored-by: n8n-cat-bot[bot] <n8n-cat-bot[bot]@users.noreply.github.com>
Co-authored-by: Svetoslav Dekov <svetoslav.dekov@n8n.io>
Co-authored-by: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `packages/cli/src/modules/mcp/__tests__/update-workflow.tool.test.ts` (modified, +38/-0)
```diff
@@ -2075,6 +2075,42 @@ describe('update-workflow MCP tool', () => {
 				);
 			});
 
+			// Ref: ADO-5928. Error workflow references must respect MCP availability.
+			test('rejects an error workflow that is not available in MCP', async () => {
+				findWorkflowMock.mockImplementation(async (id: string) =>
+					id === 'err-wf'
+						? Object.assign(errorHandlerWorkflow(), { settings: { availableInMCP: false } })
+						: buildExistingWorkflow(),
+				);
+
+				const result = await callHandler({
+					workflowId: 'wf-1',
+					operations: [{ type: 'setWorkflowSettings', settings: { errorWorkflow: 'err-wf' } }],
+				});
+
+				expect(result.isError).toBe(true);
+				expect(parseResult(result).error).toContain('not available in MCP');
+				expect(parseResult(result).error).toContain('/workflow/err-wf?settings=true');
+				expect(workflowService.update).not.toHaveBeenCalled();
+			});
+
+			test('rejects an archived error workflow', async () => {
+				findWorkflowMock.mockImplementation(async (id: string) =>
+					id === 'err-wf'
+						? Object.assign(errorHandlerWorkflow(), { isArchived: true })
+						: buildExistingWorkflow(),
+				);
+
+				const result = await callHandler({
+					workflowId: 'wf-1',
+					operations: [{ type: 'setWorkflowSettings', settings: { errorWorkflow: 'err-wf' } }],
+				});
+
+				expect(result.isError).toBe(true);
+				expect(parseResult(result).error).toContain("Workflow 'err-wf' is archived");
+				expect(workflowService.update).not.toHaveBee
```

**File**: `packages/cli/src/modules/mcp/tools/workflow-builder/update-workflow.tool.ts` (modified, +4/-1)
```diff
@@ -62,7 +62,7 @@ import {
 } from './workflow-operations';
 import { USER_CALLED_MCP_TOOL_EVENT } from '../../mcp.constants';
 import type { ToolDefinition, UserCalledMCPToolEventPayload } from '../../mcp.types';
-import { getMcpWorkflow } from '../workflow-validation.utils';
+import { getMcpWorkflow, validateMcpWorkflow } from '../workflow-validation.utils';
 
 const MAX_OPERATIONS_PER_CALL = 100;
 
@@ -370,6 +370,8 @@ type UpdateWorkflowOutput = z.infer<z.ZodObject<typeof outputSchema>>;
  * Trigger node, or cannot be called by this workflow due to its sub-workflow
  * caller policy — each of which would otherwise silently prevent the error
  * workflow from running on failure. A 'DEFAULT' / cleared value skips the check.
+ * An archived target, or one that is not available in MCP, is rejected like in
+ * the by-id MCP tools.
  */
 async function assertErrorWorkflowIsUsable({
 	errorWorkflowId,
@@ -417,6 +419,7 @@ async function assertErrorWorkflowIsUsable({
 			`Error workflow '${errorWorkflowId}' was not found or you do not have access to it. Find a valid workflow ID with search_workflows, or create an error-handler workflow first.`,
 		);
 	}
+	validateMcpWorkflow(errorWorkflow);
 
 	// Runtime runs the PUBLISHED version of the error workflow, not its draft, and
 	// resolves it differently depending on the publication service flag — mirror
```

---

### Incident Patch 5: `7204df60` (2026-09-29)
**Commit Message**: fix(editor): Do not run the workflow when the save before execute fails (#39763)

**File**: `packages/frontend/editor-ui/src/app/composables/useRunWorkflow.test.ts` (modified, +31/-0)
```diff
@@ -466,6 +466,22 @@ describe('useRunWorkflow({ router })', () => {
 				await runWorkflow({});
 
 				expect(workflowSaving.saveCurrentWorkflow).toHaveBeenCalledTimes(1);
+				expect(workflowsStore.runWorkflow).toHaveBeenCalledTimes(1);
+			});
+
+			it('should not run when the save before execute fails with autosave enabled', async () => {
+				vi.spyOn(settingsStore, 'isAutosaveEnabled', 'get').mockReturnValue(true);
+				vi.mocked(uiStore).stateIsDirty = true;
+				vi.mocked(workflowsStore).isWorkflowSaved = { '123': true };
+
+				const workflowSaving = useWorkflowSaving({ router });
+				vi.mocked(workflowSaving.saveCurrentWorkflow).mockResolvedValueOnce(false);
+				const { runWorkflow } = useRunWorkflow({ router });
+				const result = await runWorkflow({});
+
+				expect(workflowSaving.saveCurrentWorkflow).toHaveBeenCalledTimes(1);
+				expect(workflowsStore.runWorkflow).not.toHaveBeenCalled();
+				expect(result).toBeUndefined();
 			});
 
 			it('should prompt the user and save when they confirm if autosave is disabled and state is dirty (ADO-5328)', async () => {
@@ -515,6 +531,21 @@ describe('useRunWorkflow({ router })', () => {
 
 				expect(workflowSaving.saveCurrentWorkflow).toHaveBeenCalledTimes(1);
 			});
+
+			it('should not run a new workflow when its first save fails', async () => {
+				vi.spyOn(settingsStore, 'isAutosaveEnabled', 'get').mockReturnValue(false);
+				vi.mocked(uiStore).stateIsDirty = false;
+				vi.mocked(workflowsStore).isWorkflowSaved 
```

**File**: `packages/frontend/editor-ui/src/app/composables/useRunWorkflow.ts` (modified, +2/-2)
```diff
@@ -175,15 +175,15 @@ export function useRunWorkflow(useRunWorkflowOpts: {
 				if (response !== MODAL_CONFIRM) {
 					return undefined;
 				}
+			}
 
+			if (isNewWorkflow || uiStore.stateIsDirty) {
 				const saved = await workflowSaving.saveCurrentWorkflow({
 					id: workflowDocumentStore.value.workflowId,
 				});
 				if (!saved) {
 					return undefined;
 				}
-			} else if (isNewWorkflow || (uiStore.stateIsDirty && settingsStore.isAutosaveEnabled)) {
-				await workflowSaving.saveCurrentWorkflow({ id: workflowDocumentStore.value.workflowId });
 			}
 
 			const workflowData = workflowDocumentStore.value.serialize();
```

**File**: `packages/frontend/editor-ui/src/features/execution/logs/components/LogsOverviewPanel.test.ts` (modified, +1/-0)
```diff
@@ -319,6 +319,7 @@ describe('LogsOverviewPanel', () => {
 
 	it('should trigger partial execution if the button is clicked', async () => {
 		const spyRun = vi.spyOn(workflowsStore, 'runWorkflow');
+		workflowsStore.isWorkflowSaved = { 'test-workflow-id': true };
 
 		const logs = createLogTree(
 			createTestWorkflowObject(aiManualWorkflow),
```

#### Recent Merged Pull Requests:
- **PR #39917** (2026-09-29): fix(API): Emit valid schemas for untyped values in the Public API spec (backport to release-candidate/2.42.x) (@n8n-assistant[bot])
- **PR #39914** (2026-09-29): feat(editor): Show n8n logo on canvas in canvas-only mode (backport to release-candidate/2.42.x) (@n8n-assistant[bot])
- **PR #39912** (2026-09-29): fix(editor): Show remaining credits on Assistant banner for Cloud UBB (backport to release-candidate/2.41.x) (@n8n-assistant[bot])
- **PR #39911** (2026-09-29): fix(editor): Show remaining credits on Assistant banner for Cloud UBB (backport to release-candidate/2.42.x) (@n8n-assistant[bot])
- **PR #39906** (2026-09-29): test: Stabilize the project move-resources spec (no-changelog) (@sychovSaveliy)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
