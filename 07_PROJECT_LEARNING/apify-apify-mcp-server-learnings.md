# Forensic Learning Record (Deep Inspection): apify/apify-mcp-server

> **Canonical Artifact**: `07_PROJECT_LEARNING/apify-apify-mcp-server-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/apify/apify-mcp-server](https://github.com/apify/apify-mcp-server))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:22:21.631Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `apify/apify-mcp-server`
- **Description**: The Apify MCP server enables your AI agents to extract data from social media, search engines, maps, e-commerce sites, or any other website using thousands of ready-made scrapers, crawlers, and automation tools available on the Apify Store.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 9765 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/mcp/stateless_server.ts`
```
/**
 * Adapter for the MCP 2026-07-28 protocol revision
 * (https://modelcontextprotocol.io/specification/2026-07-28), served via the v2 SDK
 * (`@modelcontextprotocol/server`). {@link createStatelessServer} (re-exported from
 * `src/index.ts`) builds one SDK `Server` per request, reading shared Apify state through
 * {@link StatelessMcpServerHost}. Sibling of `legacy_server.ts` (the 2025-era adapter on
 * `@modelcontextprotocol/sdk`), not a layer on top of it.
 *
 * This protocol revision has no `initialize` handshake: every request carries its own `_meta`
 * envelope (protocol version, client info, capabilities), so client identity — and with it
 * `'auto'` mode resolution — is resolved per request instead of from session state.
 */

import type { ServerNotification } from '@modelcontextprotocol/sdk/types.js';
import type { CallToolResult, ListToolsResult, Notification, ServerContext } from '@modelcontextprotocol/server';
import {
    CLIENT_CAPABILITIES_META_KEY,
    CLIENT_INFO_META_KEY,
    PROTOCOL_VERSION_META_KEY,
    ProtocolError,
    ProtocolErrorCode,
    Server,
} from '@modelcontextprotocol/server';

import log from '@apify/log';

import type { ApifyClient } from '../apify_client.js';
import { TOOL_STATUS } from '../const.js';
import type { createPromptService } from '../prompts/prompt_service.js';
import type { createResourceService } from '../resources/resource_service.js';
import { getServerInfo } from '../server_card.js';
import type {
    ActorsMcpServerOptions,
    ActorStore,
    ApifyRequestParams,
    CallDiagnostics,
    SERVER_MODE,
    TelemetryEnv,
    ToolEntry,
    ToolStatus,
} from '../types.js';
import { isMcpError } from '../utils/tool_status.js';
import { getToolFullName, getToolPublicFieldOnly } from '../utils/tools.js';
import { buildMcpClientContext } from './client_context.js';
import type { McpClientContext } from './client_context.js';
import { InternalError, InvalidParamsError } from './errors.js';
import { classifyToolCallError, executeSyncToolCall, prepareToolCall, resolveToolEntry } from './tool_call_engine.js';
import { logToolCallAndTelemetry, prepareTelemetryData } from './tool_call_telemetry.js';

/**
 * Everything one 2026-07-28 request is served from, derived once from the shared facade and never
 * mutated afterwards. Concurrent requests with different identities get separate snapshots.
 */
export type StatelessRequestSnapshot = {
    readonly serverMode: SERVER_MODE;
    readonly clientContext: McpClientContext | undefined;
    readonly tools: Map<string, ToolEntry>;
    readonly resourceService: ReturnType<typeof createResourceService>;
    /**
     * Token-scoped Apify client for `resources/read`; `undefined` without a token. Bound by the
     * facade so the adapter stays off the Apify API-client layer.
     */
    readonly createApifyClient: (token: string | undefined) => ApifyClient | undefined;
};

/**
 * Read-facing view of the shared `ActorsMcpServer` facade (sibling of `LegacyMcpServerHost`).
 * Request-scoped state arrives through `createRequestSnapshot`; the rest is construction-time
 * configuration safe to share across requests.
 */
export interface StatelessMcpServerHost {
    readonly actorStore?: ActorStore;
    readonly telemetryEnabled: boolean;
    readonly telemetryEnv: TelemetryEnv;
    readonly options: ActorsMcpServerOptions;
    readonly promptService: ReturnType<typeof createPromptService>;
    resolveApifyToken(meta?: ApifyRequestParams['_meta']): string | undefined;
    getStatelessServerInstructions(requestUrl?: string): string;
    createRequestSnapshot(clientContext: McpClientContext | undefined): Promise<StatelessRequestSnapshot>;
}

/**
 * Map a domain or v1 `McpError` to a v2 `ProtocolError` with the same code/message/data.
 * Any other error is returned unchanged for the caller to rethrow.
 */
function toStatelessProtocolError(error: unknown): unknown {
    if (error instanceof InvalidParamsError) {
        return new ProtocolError(ProtocolErrorCode.InvalidParams, error.message, error.data);
    }
    if (error instanceof InternalError) {
        return new ProtocolError(ProtocolErrorCode.InternalError, error.message, error.data);
    }
    if (isMcpError(error)) {
        return new ProtocolError(error.code, error.message, error.data);
    }
    return error;
}

/** Whether an error must stay a JSON-RPC error response instead of becoming a tool result. */
function isProtocolLevelError(error: unknown): boolean {
    return error instanceof ProtocolError || isMcpError(error);
}

/** Client identity from the request's validated `_meta` envelope. */
function buildClientContextFromEnvelope(envelope: Record<string, unknown> | undefined): McpClientContext | undefined {
    if (!envelope) return undefined;
    // Same wire shapes as `initialize` carries; the cast only crosses the v2/v1 type boundary.
    return buildMcpClientContext({
        protocolVersion: envelope[PROTOCOL_VERSION_META_KEY],
        clientInfo: envelope[CLIENT_INFO_META_KEY],
        capabilities: envelope[CLIENT_CAPABILITIES_META_KEY],
    } as Parameters<typeof buildMcpClientContext>[0]);
}

/**
 * v2 SDK adapter. One per request: `createMcpHandler` calls its factory for every incoming request
 * and discards the instance afterwards.
 */
class StatelessMcpServer {
    public readonly server: Server;
    private readonly host: StatelessMcpServerHost;
    /**
     * The request's snapshot, memoized as a promise so every handler awaits the same composition.
     * Built lazily by whichever handler runs first — there is no `initialize` to hook.
     */
    private snapshot: Promise<StatelessRequestSnapshot> | undefined;

    constructor(host: StatelessMcpServerHost, requestUrl?: string) {
        this.host = host;
        this.server = new Server(getServerInfo(), {
            capabilities: {
                // Deliberately no `tasks` (tasks/* → method-not-found), no `logging` (deprecated by SEP-2577), no
                // `tools.listChanged` (never originated; `tool_dispatch.ts` only relays a proxied Actor-MCP server's).
                // TODO: the SDK answers `subscriptions/listen` upstream of our handlers and opens a
                // stream that can never emit; the dev server closes it per request, a long-lived
                // host does not. Refusing the method outright is a follow-up.
                tools: {},
                resources: {},
                prompts: {},
            },
            instructions: this.host.getStatelessServerInstructions(requestUrl),
        });
        this.setupToolHandlers();
        this.setupResourceHandlers();
        this.setupPromptHandlers();
    }

    /** Snapshot for this request, resolved from the identity the request itself declared. */
    private async resolveSnapshot(ctx: ServerContext): Promise<StatelessRequestSnapshot> {
        this.snapshot ??= this.host.createRequestSnapshot(
            buildClientContextFromEnvelope(ctx.mcpReq.envelope as Record<string, unknown> | undefined),
        );
        return await this.snapshot;
    }

    /**
     * Token precedence: server-validated `authInfo` from the serving entry, then the facade's own
     * chain (`_meta.apifyToken` > `options.token`).
     */
    private resolveRequestToken(ctx: ServerContext, meta?: ApifyRequestParams['_meta']): string | undefined {
        return ctx.http?.authInfo?.token || this.host.resolveApifyToken(meta);
    }

    private setupToolHandlers(): void {
        this.server.setRequestHandler('tools/list', async (_request, ctx) => {
            const snapshot = await this.resolveSnapshot(ctx);
            const presentTools = new Set(snapshot.tools.keys());
            const tools = Array.from(snapshot.tools.values()).map((tool) =>
                getToolPublicFieldOnly(tool, { mode: snapshot.serverMode, filterWidgetMeta: true, presentTools }),
            );
            // Tool entries carry the same public fields as the SDK's `Tool`; type-boundary cast only.
            return { tools } as unknown as ListToolsResult;
        });

        this.server.setRequestHandler('tools/call', async (request, ctx) => {
            const params = request.params as ApifyRequestParams & { name: string; arguments?: Record<string, unknown> };
            // Keep telemetry on the decoded arguments.
            const { name, arguments: initialArgs, _meta: meta } = params;
            let args = initialArgs;
            const progressToken = meta?.progressToken;
            const snapshot = await this.resolveSnapshot(ctx);
            const apifyToken = this.resolveRequestToken(ctx, meta) as string;
            // No session on this path; logs and telemetry report the id empty.
            const mcpSessionId = undefined;
            const startTime = Date.now();
            let toolStatus: ToolStatus = TOOL_STATUS.SUCCEEDED;
            let callDiagnostics: CallDiagnostics = {};
            let resolvedToolName = name;
            let toolResult: unknown = null;
            let actorName: string | undefined;
            let actorId: string | undefined;
            // Resolved up front (same rule as `prepareToolCall`) so every return path — including
            // pre-dispatch failures — projects with the schema this request advertised. Only this
            // call shell projects results. This is inert today: the 2026-07-28 codec discards the
            // schema, while the codec that reads it only re-wraps non-object structured content,
            // which no tool emits.
            const outputSchema = resolveToolEntry(name, snapshot.tools)?.outputSchema;
            const { clientContext } = snapshot;
            const { paymentProvider, allowUnauthMode } = this.host.options;
            const { signal } = ctx.mcpReq;

            // Start with the raw name so early failures still have telemetry.
            const { telemetryData, userId } = await prepareTelemetryData({
                toolName: name,
                mcpSessionId,
           
```

### Core Architecture Module: `src/mcp/tool_call_engine.ts`
```
/**
 * Shared tools/call spine: gate, resolve, prepare payment/validation context, then dispatch.
 * Returns neutral outcomes; the shell constructs protocol errors and side-channel notifications.
 */

import type { ServerNotification } from '@modelcontextprotocol/sdk/types.js';
import dedent from 'dedent';

import log from '@apify/log';

import type { ApifyClient } from '../apify_client.js';
import { ALLOWED_TASK_TOOL_EXECUTION_MODES, FAILURE_CATEGORY, HELPER_TOOLS, TOOL_STATUS } from '../const.js';
import { prepareToolCallContext } from '../payments/helpers.js';
import type { PaymentMeta, PaymentProvider, RequestHeaders } from '../payments/types.js';
import { decodeDotPropertyNames } from '../tools/actor_input_schema.js';
import { legacyToolNameToNew } from '../tools/actor_tool_naming.js';
import { checkPaymentProviderStandbyConflict } from '../tools/actors/call_actor.js';
import { withReportProblemNudge } from '../tools/dev/report_problem.js';
import type { ActorStore, CallDiagnostics, ToolCallTelemetryProperties, ToolEntry, ToolStatus } from '../types.js';
import { TOOL_TYPE } from '../types.js';
import { logHttpError } from '../utils/logging.js';
import { respondOk } from '../utils/mcp.js';
import { getRequestOriginForClient } from '../utils/mcp_clients.js';
import type { buildPaymentRequiredResponse } from '../utils/payment_errors.js';
import { createProgressTracker } from '../utils/progress.js';
import { extractAjvErrorDetails, isMcpError } from '../utils/tool_status.js';
import { buildActorFields, extractActorId, extractActorName, getToolFullName } from '../utils/tools.js';
import type { McpClientContext } from './client_context.js';
import { buildToolCallErrorResult, TOOL_CALL_ERROR_KIND } from './tool_call_error_mapper.js';
import type { ToolCallErrorResult } from './tool_call_error_mapper.js';
import { dispatchToolCall } from './tool_dispatch.js';

/** INTERNAL tools that wait synchronously and emit progress meanwhile: call-actor's start and wait, get-actor-run, get-actor-build and build-actor with waitSecs > 0. */
const PROGRESS_TRACKER_INTERNAL_TOOLS = new Set<string>([
    HELPER_TOOLS.ACTOR_CALL,
    HELPER_TOOLS.ACTOR_RUNS_GET,
    HELPER_TOOLS.ACTOR_BUILD_GET,
    HELPER_TOOLS.ACTOR_BUILD,
]);

/** A pre-dispatch failure that the shell converts to v1's protocol-error sequence. */
export type InvalidToolCall = {
    message: string;
    toolStatus: ToolStatus;
    callDiagnostics: CallDiagnostics;
    logFields?: Record<string, unknown>;
    // Set after resolution so the shell preserves v1 telemetry on validation failures.
    resolvedToolName?: string;
    // Set after decoding so the shell preserves v1's decoded-argument telemetry.
    decodedArgs?: Record<string, unknown>;
};

/** Successful preparation output for the task and synchronous paths. */
export type PreparedCall = {
    tool: ToolEntry;
    toolArgs: Record<string, unknown>;
    logSafeArgs: unknown;
    apifyClient: ApifyClient;
    actorName: string | undefined;
    actorId: string | undefined;
    standbyRejection: Record<string, unknown> | null;
    paymentRequiredResult: ReturnType<typeof buildPaymentRequiredResponse> | undefined;
    // The shell uses this decoded copy for telemetry.
    decodedArgs: Record<string, unknown>;
};

/** Result of the synchronous dispatch tail, including the exact wire payload. */
export type ToolCallOutcome = {
    result: Record<string, unknown>;
    toolStatus: ToolStatus;
    callDiagnostics: CallDiagnostics;
};

/** Classified non-protocol failure after resolution, retaining v1 actor telemetry context. */
export type PreparedCallError = ToolCallOutcome & {
    resolvedToolName: string;
    decodedArgs: Record<string, unknown>;
};

/** Builds the pre-flight result; standby rejection takes precedence over 402. */
export function buildPreflightFailureOutcome(
    standbyRejection: Record<string, unknown> | null,
    paymentRequiredResult: ReturnType<typeof buildPaymentRequiredResponse> | undefined,
    actorName: string | undefined,
    actorId: string | undefined,
): {
    toolStatus: ToolStatus;
    callDiagnostics: CallDiagnostics;
    result: Record<string, unknown> | ReturnType<typeof buildPaymentRequiredResponse>;
} {
    return {
        toolStatus: TOOL_STATUS.SOFT_FAIL,
        callDiagnostics: {
            failure_category: FAILURE_CATEGORY.INVALID_INPUT,
            ...(standbyRejection ? {} : { failure_http_status: 402 }),
            ...buildActorFields(actorName, actorId),
        },
        result: (standbyRejection ?? paymentRequiredResult)!,
    };
}

/**
 * The tool a `tools/call` names, accepting a legacy alias or an Actor's full name. The single
 * resolution rule: a shell that needs the tool before {@link prepareToolCall} returns (e.g. for its
 * `outputSchema`) must resolve it the same way, or the two can disagree about which tool was called.
 */
export function resolveToolEntry(name: string, tools: Map<string, ToolEntry>): ToolEntry | undefined {
    const newName = legacyToolNameToNew(name) ?? name;
    return Array.from(tools.values()).find((tool) => tool.name === newName || getToolFullName(tool) === newName);
}

/** Prepares a call; protocol errors are left to the shell. */
export async function prepareToolCall(params: {
    apifyToken: string;
    name: string;
    args: Record<string, unknown> | undefined;
    meta: PaymentMeta;
    requestHeaders: RequestHeaders;
    isTaskRequest: boolean;
    mcpSessionId: string | undefined;
    telemetryData: ToolCallTelemetryProperties | null;
    clientContext: McpClientContext | undefined;
    tools: Map<string, ToolEntry>;
    paymentProvider?: PaymentProvider;
    allowUnauthMode?: boolean;
    // Used to preserve abort status for a post-resolution classified failure.
    signal?: AbortSignal;
}): Promise<PreparedCall | InvalidToolCall | PreparedCallError> {
    const {
        apifyToken,
        name,
        meta,
        requestHeaders,
        isTaskRequest,
        telemetryData,
        clientContext,
        tools,
        paymentProvider,
        allowUnauthMode,
    } = params;
    let { args } = params;

    if (!apifyToken && !paymentProvider?.allowsUnauthenticated && !allowUnauthMode) {
        return {
            message: dedent`
                Apify API token is required but was not provided.
                Please set the APIFY_TOKEN environment variable or pass it as a parameter in the request header as Authorization Bearer <token>.
                You can get your Apify token from https://console.apify.com/account/integrations.
            `,
            toolStatus: TOOL_STATUS.SOFT_FAIL,
            callDiagnostics: { failure_category: FAILURE_CATEGORY.AUTH },
        };
    }

    const toolEntry = resolveToolEntry(name, tools);

    if (!toolEntry) {
        const availableTools = Array.from(tools.keys());
        return {
            message: dedent`
                Tool "${name}" was not found.
                Available tools: ${availableTools.length > 0 ? availableTools.join(', ') : 'none'}.
                Please verify the tool name is correct. You can list all available tools using the tools/list request.
            `,
            toolStatus: TOOL_STATUS.SOFT_FAIL,
            callDiagnostics: { failure_category: FAILURE_CATEGORY.INVALID_INPUT },
        };
    }

    const tool = toolEntry;
    const resolvedToolName = getToolFullName(tool);
    if (telemetryData) {
        telemetryData.tool_name = resolvedToolName;
    }

    const actorName = extractActorName(tool, args as Record<string, unknown>);
    const actorId = extractActorId(tool);

    if (!args) {
        return {
            message: dedent`
                Missing arguments for tool "${name}".
                Please provide the required arguments for this tool. Check the tool's input schema using ${HELPER_TOOLS.ACTOR_GET_DETAILS} tool to see what parameters are required.
            `,
            toolStatus: TOOL_STATUS.SOFT_FAIL,
            callDiagnostics: {
                failure_category: FAILURE_CATEGORY.INVALID_INPUT,
                ...buildActorFields(actorName, actorId),
            },
            resolvedToolName,
        };
    }

    // Preserve the raw value if decoding throws before reassignment.
    let decodedArgs = args as Record<string, unknown>;

    // v1 captured actor context before these operations; retain it when classifying their failures.
    try {
        // Validation expects decoded property names.
        args = decodeDotPropertyNames(args as Record<string, unknown>) as Record<string, unknown>;
        decodedArgs = args as Record<string, unknown>;

        const {
            toolArgsWithoutPayment: toolArgs,
            toolArgsRedacted: logSafeArgs,
            apifyClient,
            paymentRequiredResult,
        } = prepareToolCallContext({
            provider: paymentProvider,
            tool,
            args: args as Record<string, unknown>,
            apifyToken,
            meta,
            requestHeaders,
            requestOrigin: getRequestOriginForClient(clientContext),
        });

        log.debug('Validate arguments for tool', {
            toolName: tool.name,
            mcpSessionId: params.mcpSessionId,
            input: logSafeArgs,
        });
        if (!tool.ajvValidate(toolArgs)) {
            const errors = tool.ajvValidate.errors || [];
            const ajvErrorDetails = extractAjvErrorDetails(errors);
            const errorMessages = errors
                .map(
                    (e: { message?: string; instancePath?: string }) =>
                        `${e.instancePath || 'root'}: ${e.message || 'validation error'}`,
                )
                .join('; ');
            return {
                message: dedent`
                    Invalid arguments for tool "${tool.name}".
                    Validation errors: ${errorMessages}.
                    Please check the tool's input schema using ${HELPER_TOOLS.ACTOR_GET_DETAILS} tool and ensure all r
```

### Core Architecture Module: `src/mcp/utils.ts`
```
import { parse } from 'node:querystring';

import type { TaskStore } from '@modelcontextprotocol/sdk/experimental/tasks/interfaces.js';
import type { ApifyClient } from 'apify-client';

import log from '@apify/log';

import { processInput } from '../input.js';
import type { ActorStore, Input } from '../types.js';
import { SERVER_MODE } from '../types.js';
import { loadToolsFromInput } from '../utils/tools_loader.js';

/**
 * If the URL contains an `actors` query parameter, returns tools for those Actors; otherwise null.
 * @param url The URL to process
 * @param apifyClient The Apify client instance
 * @param mode Server mode for tool variant resolution
 * @param actorStore Optional store used to enrich direct actor tools' outputSchema with per-Actor itemsSchema.
 */
export async function processParamsGetTools(
    url: string,
    apifyClient: ApifyClient,
    mode: SERVER_MODE = SERVER_MODE.DEFAULT,
    actorStore?: ActorStore,
) {
    const input = parseInputParamsFromUrl(url);
    return await loadToolsFromInput(input, apifyClient, mode, actorStore);
}

export function parseInputParamsFromUrl(url: string): Input {
    const query = url.split('?')[1] || '';
    const params = parse(query);
    delete params.enableAddingActors;
    delete params.enableActorAutoLoading;
    return processInput(params as unknown as Input);
}

/**
 * Detects the task store's "task is gone" error. A long-running task whose TTL elapsed before its
 * result could be stored makes `storeTaskResult`/`updateTaskStatus` throw — the in-memory SDK store
 * says "Task with ID <id> not found", the hosted RedisTaskStore appends " or expired". This is a
 * benign terminal condition (the client gave up before we finished), not an unexpected failure.
 */
export function isTaskNotFoundError(error: unknown): boolean {
    return error instanceof Error && /^Task with ID .+ not found/.test(error.message);
}

/**
 * Stores a task result, skipping the store if the task expired before storage. On an expired/gone
 * task the store throws {@link isTaskNotFoundError}; that is benign (the client gave up), so it is
 * logged as softFail and swallowed instead of propagating. The caller can then still finish its
 * telemetry. Any other store error is rethrown.
 */
export async function storeTaskResultOrSkipIfExpired(
    taskStore: TaskStore,
    toolName: string,
    taskId: Parameters<TaskStore['storeTaskResult']>[0],
    status: Parameters<TaskStore['storeTaskResult']>[1],
    result: Parameters<TaskStore['storeTaskResult']>[2],
    mcpSessionId?: Parameters<TaskStore['storeTaskResult']>[3],
): Promise<void> {
    try {
        await taskStore.storeTaskResult(taskId, status, result, mcpSessionId);
    } catch (error) {
        if (!isTaskNotFoundError(error)) throw error;
        log.softFail('Task expired before its result could be stored', { taskId, toolName, mcpSessionId });
    }
}

/**
 * Checks if a task was cancelled, preventing state transitions from terminal states.
 * Critical for task execution: prevents SDK errors when trying to transition from 'cancelled' to 'working'.
 * @param taskId - The task identifier
 * @param mcpSessionId - The MCP session ID
 * @param taskStore - The task store instance
 * @returns true if task is cancelled, false otherwise
 */
export async function isTaskCancelled(
    taskId: string,
    mcpSessionId: string | undefined,
    taskStore: TaskStore,
): Promise<boolean> {
    const task = await taskStore.getTask(taskId, mcpSessionId);
    return task?.status === 'cancelled';
}

/**
 * Polls the TaskStore and returns a signal that aborts only when an MCP task
 * is cancelled via `tasks/cancel`. Caller MUST invoke `dispose()` once the
 * tool handler returns or the polling interval leaks.
 *
 * The SDK's `tasks/cancel` handler only writes `status='cancelled'` to the store — it does not
 * abort the in-flight request's `AbortController`. Without this watcher the Actor run keeps
 * consuming compute until it finishes naturally. The signal reaches `waitForRunWithProgress`,
 * whose `raceAbort` invokes `abortRunOnSignal` → `apifyClient.run(runId).abort()`.
 *
 * Two deliberate choices:
 *
 * - **The request's `extra.signal` is NOT chained.** Per the tasks spec a task's lifetime is
 *   decoupled from the request that created it: client disconnect, transport close, or
 *   `notifications/cancelled` on the original request MUST NOT cancel the task. Only
 *   `tasks/cancel` may. Regression guard: the `does not abort when an unrelated AbortSignal
 *   fires` case in `tests/unit/mcp.utils.test.ts`.
 * - **Polling, not a callback.** In multi-node deployments `tasks/cancel` can land on a
 *   different pod than the one running the handler; the `AbortController` lives in that pod's
 *   memory. The shared TaskStore is the only signal the executing pod can observe, so it must
 *   poll. 500 ms trades cancel latency against store load.
 */
export function createTaskCancellationWatcher(opts: {
    taskId: string;
    mcpSessionId: string | undefined;
    taskStore: TaskStore;
    pollIntervalMs?: number;
}): { signal: AbortSignal; dispose: () => void } {
    const { taskId, mcpSessionId, taskStore, pollIntervalMs = 500 } = opts;
    const controller = new AbortController();

    // Prevents tick overlap when `getTask` is slower than the poll interval (Redis tail
    // latency, cluster reslot). Without it, ticks pile up and amplify backend load right
    // when the backend is struggling.
    let tickInProgress = false;
    const interval = setInterval(() => {
        if (tickInProgress || controller.signal.aborted) return;
        tickInProgress = true;
        void (async () => {
            try {
                if (await isTaskCancelled(taskId, mcpSessionId, taskStore)) {
                    // Stop the timer immediately rather than relying on dispose() —
                    // otherwise ticks keep firing as no-ops until the caller's
                    // finally block runs.
                    clearInterval(interval);
                    controller.abort();
                }
            } catch {
                // In production `taskStore.getTask` hits Redis. Swallow transient failures so they don't crash the pod via
                // unhandled rejection; the next successful tick will still detect cancellation. Not logged: under sustained Redis
                // degradation this fires every pollIntervalMs per task and would flood logs.
            } finally {
                tickInProgress = false;
            }
        })();
    }, pollIntervalMs);

    return {
        signal: controller.signal,
        dispose: () => clearInterval(interval),
    };
}

```

### Core Architecture Module: `src/state.ts`
```
import type { ActorDefinitionWithInfo, ApifyDocsSearchResult } from './types.js';
import { TTLLRUCache } from './utils/ttl_lru.js';

const ACTOR_CACHE_MAX_SIZE = 500;
const ACTOR_CACHE_TTL_SECS = 30 * 60; // 30 minutes
const APIFY_DOCS_CACHE_MAX_SIZE = 500;
const APIFY_DOCS_CACHE_TTL_SECS = 60 * 60; // 1 hour

export const actorDefinitionCache = new TTLLRUCache<ActorDefinitionWithInfo>(
    ACTOR_CACHE_MAX_SIZE,
    ACTOR_CACHE_TTL_SECS,
);
export const searchApifyDocsCache = new TTLLRUCache<ApifyDocsSearchResult[]>(
    APIFY_DOCS_CACHE_MAX_SIZE,
    APIFY_DOCS_CACHE_TTL_SECS,
);
/** Stores processed Markdown content */
export const fetchApifyDocsCache = new TTLLRUCache<string>(APIFY_DOCS_CACHE_MAX_SIZE, APIFY_DOCS_CACHE_TTL_SECS);

```

### Core Architecture Module: `src/utils/actor.ts`
```
import type { ApifyClient } from '../apify_client.js';
import { getActorMCPServerPath, getActorMCPServerURL } from '../mcp/actors.js';
import { actorDefinitionCache } from '../state.js';
import { resolveActorToolMode } from '../tools/actor_tool_naming.js';
import { getActorDefinition } from '../tools/actors/actor_definition.js';
import type { ActorDefinitionWithInfo, ActorToolResolutionResult } from '../types.js';
import { ACTOR_TOOL_MODE } from '../types.js';
import { getUserInfoCached } from './userid_cache.js';

/**
 * `actorDefinitionCache` is process-wide, so a private Actor's definition must never be served from it to
 * anyone but its owner — else another token on the same process reads it with no auth check. Two invariants
 * keep this gate from inverting into a leak:
 *   1. `info.userId` is the platform-set OWNER, not the fetching token — so a non-owner's re-fetch can't
 *      overwrite the cached ownership.
 *   2. The caller is identified by `user('me')` under their own token (the same identity the platform
 *      authorizes with) and `null` is the sole non-identity sentinel — so a hit grants no more than a bare
 *      re-fetch would. Don't drop the `!== null` guard or swap in a cheaper identity source.
 *  Trade-off: an org-owned private Actor is cached under the org's userId, so an org member
 *  calling with a personal token never matches and re-fetches every time.
 *  Fail-safe (no leak), just uncached for members - accepted over an org-membership lookup
 *   that would put a per-call API round trip back on * this path.
 */
async function callerMaySeeCachedActor(cached: ActorDefinitionWithInfo, apifyClient: ApifyClient): Promise<boolean> {
    if (cached.info.isPublic) return true;
    const { userId } = await getUserInfoCached(apifyClient.token, apifyClient);
    return userId !== null && userId === cached.info.userId;
}

/**
 * Returns the cached Actor definition + info, fetching from the platform on miss
 * and populating the cache on the way back.
 *
 * Returns `null` if the Actor does not exist (404 / 400 from the platform).
 * Non-404 errors propagate to the caller.
 */
export async function getActorDefinitionCached(
    actorIdOrName: string,
    apifyClient: ApifyClient,
): Promise<ActorDefinitionWithInfo | null> {
    const cached = actorDefinitionCache.get(actorIdOrName);
    if (cached && (await callerMaySeeCachedActor(cached, apifyClient))) return cached;
    const fetched = await getActorDefinition(actorIdOrName, apifyClient);
    if (fetched) actorDefinitionCache.set(actorIdOrName, fetched);
    return fetched;
}

/**
 * Resolve how an Actor is exposed as a tool at call time, by name. The only place `resolveActorToolMode`
 * is consulted outside the tool-loading factory, so `call-actor` routing and tool loading share one rule.
 *
 * Returns `null` when there is no definition to classify (unknown Actor). The URL is a pure function of
 * the definition (`getActorMCPServerURL` does no I/O), so this rides the authorization-gated
 * `getActorDefinitionCached` instead of a separate cache that would leak a private Actor's URL across tenants.
 */
export async function getActorToolResolutionCached(
    actorIdOrName: string,
    apifyClient: ApifyClient,
): Promise<ActorToolResolutionResult | null> {
    const cached = await getActorDefinitionCached(actorIdOrName, apifyClient);
    if (!cached) return null;

    const webServerMcpPath = getActorMCPServerPath(cached.definition);
    const toolMode = resolveActorToolMode({
        definition: cached.definition,
        actor: cached.info,
        webServerMcpPath,
    });
    const { actorFullName } = cached.definition;
    // `resolveActorToolMode` returns MCP only when `webServerMcpPath` is set.
    if (toolMode === ACTOR_TOOL_MODE.MCP) {
        return {
            toolMode,
            mcpServerUrl: await getActorMCPServerURL(cached.definition.id, webServerMcpPath!),
            actorFullName,
        };
    }
    return { toolMode, actorFullName };
}

```

### Core Architecture Module: `src/utils/actor_card.ts`
```
import { APIFY_STORE_URL, MAX_INPUT_FIELDS_IN_ACTOR_CARD, OFFICIAL_APIFY_USERNAMES } from '../const.js';
import type { Actor, ActorCardOptions, ActorStoreInputSchema, ActorStoreList, StructuredActorCard } from '../types.js';
import { buildConsoleActorUrl } from './console_link.js';
import {
    getCurrentPricingInfo,
    type PricingInfo,
    pricingInfoToSimplifiedString,
    pricingInfoToSimplifiedStructured,
    pricingInfoToString,
    pricingInfoToStructured,
    type PricingTier,
    type StructuredPricingInfo,
} from './pricing_info.js';

function getInputSchema(actor: Actor | ActorStoreList): ActorStoreInputSchema | undefined {
    return 'inputSchema' in actor ? actor.inputSchema : undefined;
}

/** Caps an Actor input schema at {@link MAX_INPUT_FIELDS_IN_ACTOR_CARD} fields — single truncation point for both the text and structured Actor cards. */
function truncateInputSchema(inputSchema: ActorStoreInputSchema): ActorStoreInputSchema {
    const entries = Object.entries(inputSchema.properties);
    if (entries.length <= MAX_INPUT_FIELDS_IN_ACTOR_CARD) return inputSchema;

    const shownEntries = entries.slice(0, MAX_INPUT_FIELDS_IN_ACTOR_CARD);
    const shownPropertyNames = new Set(shownEntries.map(([name]) => name));

    return {
        ...inputSchema,
        properties: Object.fromEntries(shownEntries) as ActorStoreInputSchema['properties'],
        required: inputSchema.required?.filter((name) => shownPropertyNames.has(name)),
    };
}

function inputFieldsToString(inputSchema: ActorStoreInputSchema): string | null {
    const truncated = truncateInputSchema(inputSchema);
    const entries = Object.entries(truncated.properties);
    if (entries.length === 0) return null;

    const requiredSet = new Set(truncated.required ?? []);
    const fields = entries
        .map(
            ([name, prop]) =>
                `${name}${requiredSet.has(name) ? '' : '?'}: ${Array.isArray(prop.type) ? prop.type.join('|') : prop.type}`,
        )
        .join(', ');
    const overflow = Object.keys(inputSchema.properties).length - entries.length;
    const suffix = overflow > 0 ? ` ... (+${overflow} more)` : '';

    return `- **Input fields:** ${fields}${suffix}`;
}

function formatCategories(categories?: string[]): string[] {
    if (!categories) return [];

    return categories.map((category) => {
        const formatted = category
            .toLowerCase()
            .split('_')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        // Special case for MCP server, AI, and SEO tools
        return formatted.replace('Mcp Server', 'MCP Server').replace('Ai', 'AI').replace('Seo', 'SEO');
    });
}

/**
 * Resolves pricing info from either ActorStoreList (has currentPricingInfo)
 * or Actor (has pricingInfos array).
 */
function getActorPricingInfo(actor: Actor | ActorStoreList): PricingInfo | null {
    if ('currentPricingInfo' in actor) {
        return actor.currentPricingInfo;
    }
    return getCurrentPricingInfo(actor.pricingInfos || [], new Date());
}

export const DEFAULT_CARD_OPTIONS: ActorCardOptions = {
    includeDescription: true,
    includeStats: true,
    includePricing: true,
    includeRating: true,
    includeMetadata: true,
};

/**
 * Private intermediate representation holding all extracted actor data.
 * Preserves raw PricingInfo so both markdown (pricingInfoToString) and
 * structured (pricingInfoToStructured) conversions produce correct output.
 */
type ExtractedActorData = {
    actorFullName: string;
    actorUrl: string;
    title?: string;
    pictureUrl?: string;
    description: string;
    pricingInfo: PricingInfo | null;
    stats?: {
        totalUsers: number;
        monthlyUsers: number;
        bookmarks?: number;
    };
    rating?: {
        average: number;
        count: number;
    };
    developer: {
        username: string;
        isOfficialApify: boolean;
        url: string;
    };
    categories: string[];
    modifiedAt?: string;
    isDeprecated: boolean;
};

/**
 * Extracts all actor data into a normalized intermediate form.
 * Both formatActorToActorCard and formatActorToStructuredCard consume this.
 */
function extractActorData(actor: Actor | ActorStoreList, options: ActorCardOptions): ExtractedActorData {
    const actorFullName = `${actor.username}/${actor.name}`;
    const actorUrl = buildConsoleActorUrl(options.linkContext, actor.id) ?? `${APIFY_STORE_URL}/${actorFullName}`;

    const data: ExtractedActorData = {
        actorFullName,
        actorUrl,
        title: actor.title,
        pictureUrl: actor.pictureUrl || undefined,
        description: options.includeDescription ? actor.description || 'No description provided.' : '',
        pricingInfo: options.includePricing ? getActorPricingInfo(actor) : null,
        developer: { username: '', isOfficialApify: false, url: '' },
        categories: [],
        isDeprecated: false,
    };

    // Extract stats — each field checked independently to match original markdown behavior
    if (options.includeStats && 'stats' in actor) {
        const { stats } = actor;

        if ('totalUsers' in stats && 'totalUsers30Days' in stats) {
            data.stats = {
                totalUsers: stats.totalUsers,
                monthlyUsers: stats.totalUsers30Days,
            };
        }

        const bookmarkCount =
            ('bookmarkCount' in actor && actor.bookmarkCount) || ('bookmarkCount' in stats && stats.bookmarkCount);
        if (bookmarkCount) {
            data.stats ??= { totalUsers: 0, monthlyUsers: 0 };
            data.stats.bookmarks = Number(bookmarkCount);
        }
    }

    // Extract rating — only actorReviewRating is required (count is optional)
    if (options.includeRating) {
        const actorReviewRating =
            ('actorReviewRating' in actor && actor.actorReviewRating) ||
            ('stats' in actor && actor.stats && 'actorReviewRating' in actor.stats && actor.stats.actorReviewRating);
        if (actorReviewRating) {
            const actorReviewCount =
                ('actorReviewCount' in actor && actor.actorReviewCount) ||
                ('stats' in actor && actor.stats && 'actorReviewCount' in actor.stats && actor.stats.actorReviewCount);
            data.rating = {
                average: Number(Number(actorReviewRating).toFixed(2)),
                count: actorReviewCount ? Number(actorReviewCount) : 0,
            };
        }
    }

    // Extract metadata
    if (options.includeMetadata) {
        data.developer = {
            username: actor.username,
            isOfficialApify: OFFICIAL_APIFY_USERNAMES.has(actor.username),
            url: `${APIFY_STORE_URL}/${actor.username}`,
        };
        data.categories = formatCategories('categories' in actor ? actor.categories : undefined);
        if ('modifiedAt' in actor && actor.modifiedAt) {
            data.modifiedAt = actor.modifiedAt.toISOString();
        }
        data.isDeprecated = ('isDeprecated' in actor && actor.isDeprecated) || false;
    }

    return data;
}

/**
 * Formats Actor details into a markdown Actor card.
 * Used in both default (text-only) and OpenAI (widget) modes as the LLM-facing text content.
 */
export function formatActorToActorCard(
    actor: Actor | ActorStoreList,
    options: ActorCardOptions = DEFAULT_CARD_OPTIONS,
): string {
    const data = extractActorData(actor, options);
    const userTier = options.userTier ?? 'FREE';

    const markdownLines = [
        `## [${data.title}](${data.actorUrl}) (\`${data.actorFullName}\`)`,
        `- **URL:** ${data.actorUrl}`,
    ];

    if (options.includeDescription) {
        markdownLines.push(`- **Description:** ${data.description}`);
    }

    if (options.includePricing) {
        const pricingString = options.simplifyPricingForUserTier
            ? pricingInfoToSimplifiedString(data.pricingInfo, userTier)
            : pricingInfoToString(data.pricingInfo);
        // Console has no /pricing sub-page — link to the Actor detail page instead.
        const pricingUrl = options.linkContext ? data.actorUrl : `${data.actorUrl}/pricing`;
        markdownLines.push(`- **[Pricing](${pricingUrl}):** ${pricingString}`);
    }

    if (data.stats) {
        const statsParts = [
            `${data.stats.totalUsers.toLocaleString()} total users, ${data.stats.monthlyUsers.toLocaleString()} monthly users`,
        ];
        if (data.stats.bookmarks) {
            statsParts.push(`${data.stats.bookmarks} bookmarks`);
        }
        markdownLines.push(`- **Stats:** ${statsParts.join(', ')}`);
    }

    if (data.rating) {
        markdownLines.push(`- **Rating:** ${data.rating.average.toFixed(2)} out of 5`);
    }

    if (options.includeMetadata) {
        markdownLines.push(
            `- **Developed by:** [${data.developer.username}](${data.developer.url}) ${data.developer.isOfficialApify ? '(Apify)' : '(community)'}`,
        );
        markdownLines.push(
            `- **Categories:** ${data.categories.length ? data.categories.join(', ') : 'Uncategorized'}`,
        );
        if (data.modifiedAt) {
            markdownLines.push(`- **Last modified:** ${data.modifiedAt}`);
        }
        if (data.isDeprecated) {
            markdownLines.push('\n>This Actor is deprecated and may not be maintained anymore.');
        }
    }
    const inputSchema = getInputSchema(actor);
    if (inputSchema) {
        const line = inputFieldsToString(inputSchema);
        if (line) markdownLines.push(line);
    }
    return markdownLines.join('\n');
}

/**
 * Extracts structured Actor data for programmatic use.
 * Used in both default (text-only) and OpenAI (widget) modes as the structured content in MCP responses.
 */
export function formatActorToStructuredCard(
    actor: Actor | ActorStoreList,
    options: ActorCardOptions = DEFAULT_CARD_OPTIONS,
): StructuredActorCard {
    const data = extractActorData(actor, options);
    const userTier = options.userTier ?? 'FREE';

    co
```

### Core Architecture Module: `src/utils/actor_details.ts`
```
import type { Build } from 'apify-client';

import type { ApifyClient } from '../apify_client.js';
import { CODE_RUNTIME_ACTOR_NAME } from '../const.js';
import { ActorLoadError } from '../errors.js';
import { connectMCPClient } from '../mcp/client.js';
import type { PaymentProvider } from '../payments/types.js';
import { filterSchemaProperties, shortenProperties } from '../tools/actor_input_schema.js';
import type { Actor, ActorCardOptions, ActorInputSchema, ActorStoreList, StructuredActorCard } from '../types.js';
import { ACTOR_TOOL_MODE } from '../types.js';
import { getActorToolResolutionCached } from './actor.js';
import { formatActorForWidget, formatActorToActorCard, formatActorToStructuredCard } from './actor_card.js';
import { searchActorsByKeywords } from './actor_search.js';
import { getHttpStatusCode, logHttpError } from './logging.js';
import type { PricingTier } from './pricing_info.js';

const ACTOR_DETAILS_PICTURE_SEARCH_LIMIT = 5;

/**
 * Convert a type object to TypeScript-like string representation.
 * Used for human-readable text output.
 *
 * Example:
 * Input:  { first_number: "number", tags: ["string"], user: { name: "string" } }
 * Output: "{ first_number: number, tags: string[], user: { name: string } }"
 *
 * Values that are not string / object / array are skipped (not rendered) at every nesting level.
 */
export function typeObjectToString(obj: Record<string, unknown>): string {
    const pairs = Object.entries(obj)
        .filter(([, v]) => Array.isArray(v) || (v !== null && typeof v === 'object') || typeof v === 'string')
        .map(([k, v]) => `${k}: ${typeValueToString(v)}`);
    return `{ ${pairs.join(', ')} }`;
}

function typeValueToString(value: unknown): string {
    if (Array.isArray(value)) return `${typeValueToString(value[0])}[]`;
    if (value !== null && typeof value === 'object') return typeObjectToString(value as Record<string, unknown>);
    if (typeof value === 'string') return value;
    return 'unknown';
}

/**
 * Resolve README content with fallback: prefer readmeSummary, fall back to full readme.
 * Returns the content string and appropriate heading for text output.
 *
 * apify/code-runtime is hardcoded to always get its full README (see CODE_RUNTIME_ACTOR_NAME) —
 * its README documents an exact API contract (method names/shapes) that the auto-generated
 * summary can omit, and there's no per-call way to request the raw text otherwise.
 */
export function resolveReadmeContent(details: {
    actorInfo: { username: string; name: string };
    readmeSummary?: string;
    readme: string;
}): {
    content: string;
    heading: string;
} {
    const actorName = `${details.actorInfo.username}/${details.actorInfo.name}`;
    if (actorName === CODE_RUNTIME_ACTOR_NAME) {
        return { content: details.readme, heading: '# README' };
    }
    if (details.readmeSummary?.trim()) {
        return { content: details.readmeSummary, heading: '# README summary' };
    }
    return { content: details.readme, heading: '# README' };
}

// Keep the type here since it is a self-contained module
export type ActorDetailsResult = {
    actorInfo: Actor;
    buildInfo: Build;
    actorCard: string;
    actorCardStructured: StructuredActorCard;
    inputSchema: ActorInputSchema;
    readme: string;
    readmeSummary?: string;
};

export async function fetchActorDetails(
    apifyClient: ApifyClient,
    actorName: string,
    cardOptions?: ActorCardOptions,
): Promise<ActorDetailsResult | null> {
    try {
        // Use only the actor name part (after '/') for better keyword search relevance —
        // "apify/instagram-scraper" returns unrelated results, while "instagram-scraper" finds the correct actor.
        const actorSlug = actorName.split('/').pop() || actorName;
        const actor = apifyClient.actor(actorName);
        const [actorInfo, buildInfo, storeActors]: [Actor | undefined, Build | undefined, ActorStoreList[]] =
            await Promise.all([
                actor.get(),
                actor.defaultBuild().then(async (build) => build.get()),
                searchActorsByKeywords({
                    search: actorSlug,
                    apifyClient,
                    limit: ACTOR_DETAILS_PICTURE_SEARCH_LIMIT,
                }).catch(() => []),
            ]);
        if (!actorInfo || !buildInfo || !buildInfo.actorDefinition) return null;

        const storeActor = storeActors?.find((item) => item.id === actorInfo.id);
        const pictureUrl = storeActor?.pictureUrl;
        const actorInfoWithPicture = { ...actorInfo, pictureUrl: pictureUrl || actorInfo.pictureUrl } as Actor & {
            pictureUrl?: string;
        };

        const inputSchema = (buildInfo.actorDefinition.input || {
            type: 'object',
            properties: {},
        }) as ActorInputSchema;
        inputSchema.properties = filterSchemaProperties(inputSchema.properties);
        inputSchema.properties = shortenProperties(inputSchema.properties);
        const actorCard = formatActorToActorCard(actorInfoWithPicture, cardOptions);
        const actorCardStructured = formatActorToStructuredCard(actorInfoWithPicture, cardOptions);
        return {
            actorInfo: actorInfoWithPicture,
            buildInfo,
            actorCard,
            actorCardStructured,
            inputSchema,
            readme: buildInfo.actorDefinition.readme || 'No README provided.',
            readmeSummary: actorInfo.readmeSummary,
        };
    } catch (error) {
        // 404/400 is a genuine "Actor doesn't exist" — same treatment as the not-found check
        // above. Anything else (401/403/5xx) must propagate: it's a different failure class
        // (e.g. invalid token) the caller should surface as such, not as "not found".
        const statusCode = getHttpStatusCode(error);
        if (statusCode === 404 || statusCode === 400) {
            logHttpError(error, `Failed to fetch actor details for '${actorName}'`, { actorName });
            return null;
        }
        throw error;
    }
}

/**
 * Build the widget actor-details payload for the apps variant.
 * Returns the Actor URL and the structured `actorDetails` object.
 */
export function buildActorDetailsForWidget(details: ActorDetailsResult, userTier: PricingTier) {
    const actorUrl = `https://apify.com/${details.actorInfo.username}/${details.actorInfo.name}`;
    const formattedReadme = details.readme.replace(/^# /, `# [README](${actorUrl}/readme): `);
    return {
        actorUrl,
        actorDetails: {
            actorInfo: formatActorForWidget(details.actorInfo, userTier),
            actorCard: details.actorCard,
            readme: formattedReadme,
            inputSchema: details.inputSchema,
        },
    };
}

/**
 * Gets MCP tools information for an Actor.
 * Returns a message about available tools, error, or that the Actor is not an MCP server.
 */
export async function getMcpToolsMessage(
    actorName: string,
    apifyClient: ApifyClient,
    apifyToken: string,
    paymentProvider?: PaymentProvider,
    mcpSessionId?: string,
): Promise<string> {
    const resolution = await getActorToolResolutionCached(actorName, apifyClient);

    // Same canonical wording call-actor rejects with, so an agent gets one consistent reason
    // for this Actor regardless of which tool it asked.
    if (resolution?.toolMode === ACTOR_TOOL_MODE.STANDBY_WITHOUT_MCP) {
        return ActorLoadError.standbyWithoutMcpNotSupported(resolution.actorFullName).message;
    }

    // Early return: not an MCP server
    if (resolution?.toolMode !== ACTOR_TOOL_MODE.MCP) {
        return `Note: This Actor is not an MCP server and does not expose MCP tools.`;
    }

    // Early return: Payment provider restriction
    if (paymentProvider) {
        return `This Actor is an MCP server and cannot be accessed using a third-party payment provider.`;
    }

    // Connect and list tools
    const client = await connectMCPClient(resolution.mcpServerUrl, apifyToken, mcpSessionId);
    if (!client) {
        return `Failed to connect to MCP server for Actor '${actorName}'.`;
    }

    try {
        const toolsResponse = await client.listTools();
        const mcpToolsInfo = toolsResponse.tools
            .map((tool) =>
                [
                    `**${tool.name}**`,
                    tool.description || 'No description',
                    'Input schema:',
                    '```json',
                    JSON.stringify(tool.inputSchema),
                    '```',
                ].join('\n'),
            )
            .join('\n\n');

        return [
            '# Available MCP Tools',
            `This Actor is an MCP server with ${toolsResponse.tools.length} tools.`,
            `To call a tool, use: "${actorName}:{toolName}"`,
            '',
            mcpToolsInfo,
        ].join('\n');
    } catch (error) {
        logHttpError(error, `Failed to list MCP tools for Actor '${actorName}'`, { actorName });
        return `Failed to retrieve MCP tools for Actor '${actorName}'. The MCP server may be temporarily unavailable.`;
    } finally {
        await client.close();
    }
}

/**
 * Build card options from resolved output flags.
 * Maps boolean output flags to card rendering options (explicit true required).
 * Caller adds `userTier` if needed — this helper stays focused on flags.
 */
export function buildCardOptions(output: {
    description: boolean;
    stats: boolean;
    pricing: boolean;
    rating: boolean;
    metadata: boolean;
}): ActorCardOptions {
    return {
        includeDescription: output.description,
        includeStats: output.stats,
        includePricing: output.pricing,
        includeRating: output.rating,
        includeMetadata: output.metadata,
    };
}

```

### Core Architecture Module: `src/utils/actor_search.ts`
```
/**
 * Shared utility for searching Actors via `GET /v2/store`.
 *
 * `GET /v2/store` returns only `[FREE, PAY_PER_EVENT]` Actors by default
 * (apify-core's `AGENT_SAFE_PRICING_MODELS`) and additionally drops Actors
 * that fail safety checks (KYC, full-permission low-usage, etc.) — so no
 * MCP-side rental over-fetch / filter is needed.
 */

import type { ApifyClient } from '../apify_client.js';
import type { PaymentProvider } from '../payments/types.js';
import type { ActorStoreList } from '../types.js';

export type SearchActorsByKeywordsOptions = {
    search: string;
    /** Caller's already-configured client — reused so the request-origin header stays correct. */
    apifyClient: ApifyClient;
    limit: number;
    offset?: number;
    allowsAgenticUsers?: boolean;
    /** API rejects values above `MAX_LIMIT_WITH_INPUT_SCHEMA` (apify-core cap). */
    includeInputSchema?: boolean;
};

export type SearchAgentSafeActorsOptions = {
    keywords: string;
    apifyClient: ApifyClient;
    limit: number;
    offset: number;
    paymentProvider?: PaymentProvider;
};

export async function searchActorsByKeywords(options: SearchActorsByKeywordsOptions): Promise<ActorStoreList[]> {
    const { search, apifyClient, limit, offset, allowsAgenticUsers, includeInputSchema } = options;
    const storeClient = apifyClient.store();
    if (allowsAgenticUsers !== undefined) storeClient.params = { ...storeClient.params, allowsAgenticUsers };
    if (includeInputSchema !== undefined) storeClient.params = { ...storeClient.params, includeInputSchema };

    const results = await storeClient.list({ search, limit, offset });
    return results.items as ActorStoreList[];
}

/**
 * Preset around `searchActorsByKeywords` for the agent-facing search tool:
 * always sets `includeInputSchema=true` and forwards `allowsAgenticUsers`
 * when a `paymentProvider` is in play. The public arg schema caps `limit`
 * at apify-core's hard cap (`MAX_LIMIT_WITH_INPUT_SCHEMA`).
 */
export async function searchAgentSafeActors(options: SearchAgentSafeActorsOptions): Promise<ActorStoreList[]> {
    const { keywords, apifyClient, limit, offset, paymentProvider } = options;

    return searchActorsByKeywords({
        search: keywords,
        apifyClient,
        limit,
        offset,
        allowsAgenticUsers: paymentProvider ? true : undefined,
        includeInputSchema: true,
    });
}

```

### Core Architecture Module: `src/utils/ajv.ts`
```
import type { ValidateFunction } from 'ajv';
import Ajv from 'ajv';

export const ajv = new Ajv({ coerceTypes: 'array', strict: false, removeAdditional: true });

// `pattern`/`patternProperties` compile a RegExp from untrusted Actor / proxied-MCP input schemas;
// a catastrophic-backtracking pattern freezes the single-threaded event loop (ReDoS). `format` is
// inert today (ajv-formats is not registered) but would arm the same vector if it ever were. This
// layer only sanitizes LLM args — the Actor re-validates its real input on the run — so dropping
// regex enforcement removes the DoS surface with no loss of protection. Consequence for `src/`
// schemas: a `.regex()` on a Zod field is NOT enforced here. It still reaches `tools/list` and still
// fires in a tool body's `parse()`, where it throws a raw ZodError at the client instead of a
// readable error — so rely on the API's own validation rather than adding one. `taskNameSchema`
// (`tools/tasks/task_helpers.ts`) still carries one and predates this note.
ajv.removeKeyword('pattern');
ajv.removeKeyword('patternProperties');
ajv.removeKeyword('format');

/**
 * Removes the `$schema` property and drops fields with real `default` values from `required`.
 *
 * Per Apify's input-schema spec, "Default + Required doesn't make sense" — a field with a
 * default is effectively optional because the platform fills it in. Zod 4.x `toJSONSchema()`
 * has the same issue: it lists `.default()` fields as required and emits `$schema` that
 * breaks AJV compilation.
 *
 * Uses a value-check (`field.default !== undefined`), not key-presence (`'default' in field`):
 * `default: undefined` must mean "no default" regardless of producer. `filterSchemaProperties()`
 * no longer emits it (#675), but hand-built schemas and future call sites still can — apify-core's
 * equivalent (`getAjvValidator`, `input_schema.both.ts`) applies the same value-check rule.
 *
 * @see https://github.com/apify/apify-mcp-server/issues/637
 */
export function fixZodSchemaRequired(schema: Record<string, unknown>): Record<string, unknown> {
    const cleaned = { ...schema };
    delete cleaned.$schema;

    if (Array.isArray(cleaned.required) && typeof cleaned.properties === 'object' && cleaned.properties !== null) {
        const properties = cleaned.properties as Record<string, unknown>;
        cleaned.required = (cleaned.required as string[]).filter((fieldName) => {
            const fieldSchema = properties[fieldName];
            if (typeof fieldSchema !== 'object' || fieldSchema === null) return true;
            return (fieldSchema as { default?: unknown }).default === undefined;
        });
    }

    return cleaned;
}

/**
 * Compiles a JSON schema with AJV, automatically cleaning the $schema property
 * and fixing the required array.
 *
 * **Unknown properties are silently stripped** by the AJV `removeAdditional: true` option
 * (set on the shared `ajv` instance). MCP / LLM clients regularly send extra top-level keys
 * (client metadata, duplicated hints, transport leftovers) that would otherwise cause validation
 * failures. Stripping them is safer than allowing them through with `additionalProperties: true`,
 * because no downstream code should rely on undeclared properties.
 *
 * **Payment fields** (e.g. Skyfire's `skyfire-pay-id`) are removed by the payment provider's
 * `removePaymentFields()` *before* AJV validation runs (see `prepareToolCallContext()`),
 * so they are never subject to this stripping.
 */
export function compileSchema(schema: Record<string, unknown>): ValidateFunction {
    return ajv.compile(fixZodSchemaRequired(schema));
}

```

### Core Architecture Module: `src/utils/apify_errors.ts`
```
import { ApifyApiError } from 'apify-client';

import {
    APIFY_ERROR_TYPE_CANNOT_PUBLISH_ACTOR_TASK,
    APIFY_ERROR_TYPE_CANNOT_START_ACTOR_RUNS,
    APIFY_ERROR_TYPE_FULL_PERMISSION_NOT_APPROVED,
    APIFY_ERROR_TYPE_INVALID_INPUT,
    APIFY_ERROR_TYPE_MEMORY_LIMIT_EXCEEDED,
} from '../const.js';

// Helpers that read or classify an error received from the Apify API by its `type`. Kept in one leaf
// module (imports only const + apify-client) so logging, telemetry, payments, and the tool layer
// can share them without import cycles.

/** The API's machine-readable error type (e.g. `actor-task-name-not-unique`), if the error carries one. */
export function getApifyErrorType(error: unknown): string | undefined {
    return error instanceof ApifyApiError ? error.type : undefined;
}

/** True when an Actor requires full-permission approval the user has not granted. */
export function isPermissionApprovalError(error: unknown): error is ApifyApiError {
    return error instanceof ApifyApiError && error.type === APIFY_ERROR_TYPE_FULL_PERMISSION_NOT_APPROVED;
}

/** True when an Actor run is rejected because the account memory quota is exceeded. */
export function isMemoryQuotaError(error: unknown): error is ApifyApiError {
    return error instanceof ApifyApiError && error.type === APIFY_ERROR_TYPE_MEMORY_LIMIT_EXCEEDED;
}

/** True when the API rejects a supplied `publicConfig` field or a request to publish the task. */
export function isCannotPublishTaskError(error: unknown): error is ApifyApiError {
    return error instanceof ApifyApiError && error.type === APIFY_ERROR_TYPE_CANNOT_PUBLISH_ACTOR_TASK;
}

/**
 * True when the platform rejected `actor.start()` because the input fails the Actor's real
 * schema — a stricter, server-side check than our own AJV gate's derived/shortened copy.
 */
export function isActorInputValidationError(error: unknown): error is ApifyApiError {
    return error instanceof ApifyApiError && error.type === APIFY_ERROR_TYPE_INVALID_INPUT;
}

/**
 * The Apify platform refuses to start a run when the user hits their concurrent-run / usage limit.
 * A direct Actor run surfaces it as an `ApifyApiError` whose `type` is `cannot-start-actor-runs`;
 * a remote MCP-server Actor wraps it as an HTTP 500 whose body carries that same type string.
 * Either way it's a user billing condition, not a server fault — hence the duck-typed `type` check
 * plus a message-substring fallback (the wrapped case is a plain Error, not an `ApifyApiError`).
 */
export function isActorRunLimitError(error: unknown): boolean {
    if (
        typeof error === 'object' &&
        error !== null &&
        (error as { type?: unknown }).type === APIFY_ERROR_TYPE_CANNOT_START_ACTOR_RUNS
    ) {
        return true;
    }
    const message = error instanceof Error ? error.message : String(error);
    return message.includes(APIFY_ERROR_TYPE_CANNOT_START_ACTOR_RUNS);
}

/** User-facing message shown when an Actor run is rejected for hitting the concurrent-run limit. */
export const ACTOR_RUN_LIMIT_MESSAGE =
    'You have reached your account limit for concurrent Actor runs. ' +
    'Wait for running Actors to finish, or upgrade your plan at https://console.apify.com/billing/subscription.';

/** User-facing detail appended to a failed remote MCP-server tool call message. */
export function remoteMcpFailureDetail(error: unknown): string {
    if (isActorRunLimitError(error)) return ACTOR_RUN_LIMIT_MESSAGE;
    const message = error instanceof Error ? error.message : String(error);
    return `${message}. The MCP server may be temporarily unavailable.`;
}

```

### Core Architecture Module: `src/utils/apify_properties.ts`
```
import type { SchemaProperties } from '../types.js';

const USER_DATA_DESCRIPTION = `User data object. A JSON object with custom user data that will be passed in the userData property of the Request object for each URL`;
const HEADERS_DESCRIPTION = `Headers object. A JSON object whose properties and values contain HTTP headers that will sent with the request.`;

/**
 * Adds resource picker schema structure to array properties with editor === 'resourcePicker'.
 * The resource picker allows users to select resources from their Apify account.
 */
export function addResourcePickerProperties(property: SchemaProperties): SchemaProperties {
    return {
        ...property,
        items: {
            ...property.items,
            type: 'string',
            title: 'Resource ID',
            description: 'Resource ID, either Apify Dataset, Key-Value Store, or Request List identifier',
        },
    };
}

/**
 * Adds key-value schema structure to array properties with editor === 'keyValue'.
 */
export function addKeyValueProperties(property: SchemaProperties): SchemaProperties {
    return {
        ...property,
        items: {
            ...property.items,
            type: 'object',
            title: 'Key-Value Pair',
            description: 'Key-value pair definition',
            properties: {
                key: {
                    type: 'string',
                    title: 'Key',
                    description: 'Key string',
                },
                value: {
                    type: 'string',
                    title: 'Value',
                    description: 'Value string',
                },
            },
        },
    };
}

/**
 * Adds globs schema structure to array properties with editor === 'globs'.
 */
export function addGlobsProperties(property: SchemaProperties): SchemaProperties {
    return {
        ...property,
        items: {
            ...property.items,
            type: 'object',
            title: 'Glob',
            description: 'Glob pattern definition',
            properties: {
                glob: {
                    type: 'string',
                    title: 'Glob',
                    description: `Glob pattern string. Globs are patterns that specify sets of URLs using wildcards, such as * (matches any character except / one or more times), ** (matches any character one or more times), ? (matches any character), or [abc] (matches selected characters).`,
                    examples: ['http://www.example.com/pages/*'],
                },
                method: {
                    type: 'string',
                    title: 'HTTP Method',
                    description: 'HTTP method for the request',
                    enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS', 'CONNECT', 'TRACE'],
                    default: 'GET',
                },
                payload: {
                    type: 'string',
                    title: 'Payload',
                    description: 'Payload for the request',
                },
                userData: {
                    type: 'object',
                    title: 'User Data',
                    description: USER_DATA_DESCRIPTION,
                    properties: {},
                },
                headers: {
                    type: 'object',
                    title: 'Headers',
                    description: HEADERS_DESCRIPTION,
                    properties: {},
                },
            },
        },
    };
}

/**
 * Adds pseudoUrls schema structure to array properties with items.editor === 'pseudoUrls'.
 */
export function addPseudoUrlsProperties(property: SchemaProperties): SchemaProperties {
    return {
        ...property,
        items: {
            ...property.items,
            type: 'object',
            title: 'PseudoUrl',
            description: `PseudoUrl definition. Represents a pseudo-URL (PURL) - an URL pattern used by web crawlers to specify which URLs should the crawler visit.
            A PURL is simply a URL with special directives enclosed in [] brackets. Currently, the only supported directive is [RegExp], which defines a JavaScript-style regular expression to match against the URL.`,
            properties: {
                purl: {
                    type: 'string',
                    title: 'PseudoUrl',
                    description: `PseudoUrl pattern string. Be careful to correctly escape special characters in the pseudo-URL string. If either [ or ] is part of the normal query string, it must be encoded as [\\x5B] or [\\x5D], respectively`,
                    examples: ['http://www.example.com/pages/[(\\w|-)*]'],
                },
                method: {
                    type: 'string',
                    title: 'HTTP Method',
                    description: 'HTTP method for the request',
                    enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS', 'CONNECT', 'TRACE'],
                    default: 'GET',
                },
                payload: {
                    type: 'string',
                    title: 'Payload',
                    description: 'Payload for the request',
                },
                userData: {
                    type: 'object',
                    title: 'User Data',
                    description: USER_DATA_DESCRIPTION,
                    properties: {},
                },
                headers: {
                    type: 'object',
                    title: 'Headers',
                    description: HEADERS_DESCRIPTION,
                    properties: {},
                },
            },
        },
    };
}

/**
 * Adds Apify proxy-specific properties to a proxy object property.
 */
export function addProxyProperties(property: SchemaProperties): SchemaProperties {
    return {
        ...property,
        properties: {
            ...property.properties,
            /**
             * We are not adding the Apify proxy country list field since that requires a MongoDB connection,
             * which is not possible for the local stdio server, and an API endpoint for that is not available.
             * So currently, there is no way for the user to select countries for the Apify proxy.
             */
            useApifyProxy: {
                title: 'Use Apify Proxy',
                type: 'boolean',
                description: 'Whether to use Apify Proxy. Set this to false when you want to use custom proxy URLs.',
                default: true,
            },
            apifyProxyGroups: {
                title: 'Apify Proxy Groups',
                type: 'array',
                description: `Select specific Apify Proxy groups to use (e.g., RESIDENTIAL, DATACENTER).
**DATACENTER:**
The fastest and cheapest option. It uses datacenters to change your IP address. Note that there is a chance of being blocked because of the activity of other users.

**RESIDENTIAL:**
IP addresses located in homes and offices around the world. These IPs are the least likely to be blocked.`,
                items: {
                    type: 'string',
                    title: 'Proxy group name',
                    description: 'Proxy group name',
                    enum: ['RESIDENTIAL', 'DATACENTER'],
                },
            },
            proxyUrls: {
                title: 'Proxy URLs',
                type: 'array',
                description: 'List of custom proxy URLs to be used instead of the Apify Proxy.',
                items: {
                    type: 'string',
                    title: 'Custom proxy URL',
                    description: 'Custom proxy URL',
                },
            },
        },
        required: ['useApifyProxy'],
    };
}

/**
 * Adds request list source structure to array properties with editor 'requestListSources'.
 */
export function addRequestListSourcesProperties(property: SchemaProperties): SchemaProperties {
    return {
        ...property,
        items: {
            ...property.items,
            type: 'object',
            title: 'Request list source',
            description: 'Request list source',
            properties: {
                url: {
                    title: 'URL',
                    type: 'string',
                    description: 'URL of the request list source',
                },
                method: {
                    title: 'HTTP Method',
                    type: 'string',
                    description: 'HTTP method for the request list source',
                    enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS', 'CONNECT', 'TRACE'],
                    default: 'GET',
                },
                payload: {
                    title: 'Payload',
                    type: 'string',
                    description: 'Payload for the request list source',
                },
                userData: {
                    type: 'object',
                    title: 'User Data',
                    description: USER_DATA_DESCRIPTION,
                    properties: {},
                },
                headers: {
                    type: 'object',
                    title: 'Headers',
                    description: HEADERS_DESCRIPTION,
                    properties: {},
                },
            },
        },
    };
}

```

### Core Architecture Module: `src/utils/auth.ts`
```
import { RETIRED_SELECTOR_NAMES } from '../const.js';
import { getUnauthEnabledToolCategories, unauthEnabledTools } from '../tools/index.js';
import type { ToolCategory } from '../types.js';

/**
 * Determines if an API token is required based on requested tools and actors.
 * Tool names and category membership are identical across all server modes,
 * so no mode parameter is needed.
 */
export function isApiTokenRequired(params: { toolCategoryKeys?: string[]; actorList?: string[] }): boolean {
    const { toolCategoryKeys, actorList } = params;

    // Retired selectors (add-actor, experimental, preview) are inert no-ops — strip them before
    // judging emptiness so an all-retired request is judged the same as an explicitly empty one.
    const activeToolKeys = toolCategoryKeys?.filter((key) => !RETIRED_SELECTOR_NAMES.has(key));

    // If no tools/categories specified, or only retired/no-op ones, default to requiring a token
    // (this matches the current requirement for a full server start).
    if (!activeToolKeys || activeToolKeys.length === 0) {
        return true;
    }

    const unauthTokenSet = new Set(unauthEnabledTools);
    // Convert ToolCategory[] to Set<string> for comparison with string keys
    const unauthCategorySet = new Set<string>(getUnauthEnabledToolCategories() as ToolCategory[]);

    // Safe only if the key is an unauth-enabled category or tool. Anything else — a
    // token-gated category, or an Actor name (which isn't in either set) — is unsafe.
    const areAllToolsSafe = activeToolKeys.every((key) => unauthCategorySet.has(key) || unauthTokenSet.has(key));

    const isActorsEmpty = !actorList || actorList.length === 0;

    // Only bypass token if all requested tools are public AND no specific actors requested.
    if (areAllToolsSafe && isActorsEmpty) {
        return false;
    }

    return true;
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1345** (2026-09-08): **[Bug]: OAuth authorization succeeds but connector fails with "no MCP server found"**
  *Symptoms*: ### Server type  Local (stdio via npx @apify/actors-mcp-server)  ### MCP Client  Claude Desktop  ### Operating System  None  ### What happened?  When adding the Apify MCP connector to Claude.ai via Settings → Connectors → Add custom connector, the OAuth authorization flow completes successfully (Apify shows "Claude" under Third-party apps & services with access to my account, with a valid "Last used" timestamp). However, immediately after authorization, Claude reports:  "Your account was authorized, but no MCP server was found at the provided URL, or your account doesn't have access to it."  ### Steps to reproduce  Go to Claude.ai → Settings → Connectors → Add custom connector Name: Apify, URL: https://mcp.apify.com/sse (or /mcp) Continue → server auto-check returns 404 "Not found" → click Next to configure manually Authentication: "Always required"; OAuth client: "Use Anthropic's hosted client metadata" Click Add → redirected to Apify's authorization screen → click Authorize Redirected back to Claude.ai → connector shows "Connection issue: Couldn't connect to the server  ### Node.js version  _No response_  ### Apify MCP Server version  _No response_  ### MCP server configuration  ```json {      "mcpServers": {        "apify": {          "command": "npx",          "args": ["-y", "@apify/actors-mcp-server"],          "env": {            "APIFY_TOKEN": "<REMOVED>"          }        }      }    } ```  ### Error logs  ```text  ```
  **Post-Mortem & Fix Analysis**:
  > The URL is the problem. `https://mcp.apify.com/sse` and `https://mcp.apify.com/mcp` both return 404 — the SSE endpoint was removed on 1 April 2026, and there is no `/mcp` path. The server is served from the root:  `https://mcp.apify.com`  Add the custom connector with exactly that URL (no path) and re-run the OAuth flow. That also explains the sequence you saw: OAuth completed against the domain, but there was nothing to talk to at `/sse`, so Claude reported no server.  Verified just now: root → 401 (auth challenge, expected), `/sse` → 404, `/mcp` → 404.  Setup docs: https://docs.apify.com/platform/integrations/mcp  Side note: the config you pasted is the local stdio setup (`npx @apify/actors-mcp-server`), which isn't part of the custom-connector flow. It's fine on its own if you also want a local server.  Closing as a configuration issue — reopen if the root URL fails too. 

- **Issue #1197** (2026-08-05): **fix: Stop reporting a cancelled Actor-MCP call as a failure**
  *Symptoms*: ## Why  Cancelling an Actor-MCP tool call is reported as a failure. Probed against a local MCP server: an error result body and `failure_category: INTERNAL_ERROR`, plus a failure log. (`tool_status` was already `ABORTED` — `buildExecutionDiagnostics` derives it from `isAborted` — so the status was never the problem.)  An abort mid-call throws `McpError(-32001)`, which is in `SOFT_MCP_ERROR_CODES`, so `log.softFail`. An abort that lands while `connectMCPClient` is in flight is worse: `connectMCPClient` itself never throws on abort, but the subsequent `client.callTool` calls `signal.throwIfAborted()` and raises a bare `DOMException` (`AbortError`, `code: 20`) that no `logHttpError` branch matches — 20 is outside 100–600 and −32768..−32000, and "This operation was aborted" fits neither transient pattern — so it reaches the final `log.error`. Alert level, on a user pressing cancel.  Reachable since #1185 started passing the abort signal into `client.callTool()`. In `@apify/actors-mcp-server 0.14.2-beta.2`; `latest` is still `0.14.1`.  ## What changed  Before: an aborted `ACTOR_MCP` call fell through the generic catch to `buildExecutionDiagnostics` and `logHttpError`.  Now: it returns `result = {}` and breaks, matching the `ACTOR` branch. `tool_status` stays `ABORTED`; the error body, the `failure_*` fields and the log go away.  Also updated two comments in the same file that described the catch as always producing a soft-fail `isError` body.  ## Notes for reviewers  The one decis

- **Issue #1183** (2026-08-25): **abort-actor-run summary says "Dataset metadata unavailable" even when the dataset has items**
  *Symptoms*: ## Summary  `abort-actor-run` always reports `"Dataset metadata unavailable"` in its summary for a run that has a default dataset — even when that dataset has items. The wording implies a fetch was attempted and failed; in reality `abort-actor-run` never attempts the fetch at all.  ## Root cause  `src/tools/runs/abort_actor_run.ts:52` builds the dataset entry as an id-only stub, by design (keeps the abort call cheap):  ```ts const dataset = run.defaultDatasetId ? { id: run.defaultDatasetId } : undefined; ```  That flows into the shared `buildSucceededSummaryNextStep()` (`src/tools/actors/actor_run_response.ts:493-499`), whose comment documents a different assumption:  ```ts // datasetId known but metadata unavailable (transient fetch failure on a terminal run). Don't // claim "no output found" — point the agent at dataset items so they can verify directly. if (itemCount === undefined && datasetId) {     return {         summary: `SUCCEEDED in ${runTimeSecs}s. Dataset metadata unavailable.${statusMessageLine(statusMessage)}${kv.summarySuffix}`,         ...     }; } ```  This branch was written for `get-actor-run`/`call-actor`, where `itemCount === undefined` really does mean a metadata fetch was attempted and failed transiently. `abort-actor-run` hits the same branch on every single call that targets a run with a dataset, because it never fetches metadata in the first place — so "unavailable" is guaranteed, not transient.  ## Observed  ``` call-actor(actor: "apify/hello-world"

- **Issue #1007** (2026-06-22): **[Bug]: Fix `abort-actor-run` and `get-dataset-items` from external review**
  *Symptoms*: ### Server type  Hosted (mcp.apify.com)  ### MCP Client  Claude.ai (web)  ### Operating System  None  ### What happened?  We got this feedback from external testing:  <img width="1053" height="88" alt="Image" src="https://github.com/user-attachments/assets/d6c183d2-eaf6-4d8e-ad6e-089e438c2bdc" />  BTW the OpenAI directory submission also didn't like the abort tools:  <img width="1636" height="808" alt="Image" src="https://github.com/user-attachments/assets/a39d5992-c4d0-422d-bbea-4475f3c4c2bb" />  ### Steps to reproduce  N/A  ### Node.js version  _No response_  ### Apify MCP Server version  _No response_  ### MCP server configuration  ```json N/A ```  ### Error logs  ```text  ```

- **Issue #994** (2026-07-02): **DCR auto-detection fails on RFC-compliant MCP servers (Royal MCP / WordPress)**
  *Symptoms*: ## Summary  The "Add new MCP connector" dialog in Apify Console greys out the OAuth radio with the message "This server doesn't support dynamic client registration. Your own OAuth client is recommended." for a server that does implement DCR (RFC 7591) plus the full RFC 8414 + RFC 9728 discovery chain.  Reproducer below uses a public Royal MCP install at `https://demo.royalplugins.com`.  ## Expected  Apify Console reads `WWW-Authenticate: Bearer resource_metadata="..."` from the 401 → fetches `/.well-known/oauth-protected-resource` → resolves the auth-server URL → fetches `/.well-known/oauth-authorization-server` → sees `registration_endpoint` → offers the OAuth (DCR) radio in the dialog.  ## Observed  OAuth radio is greyed out with the "doesn't support DCR" message. API-key auth still works; "Your own OAuth client" also works if a `client_id` is registered manually.  ## Reproduction probes  ```bash # 1. RFC 9728 WWW-Authenticate on 401 curl -i -X POST 'https://demo.royalplugins.com/wp-json/royal-mcp/v1/mcp' \   -H 'Content-Type: application/json' \   -H 'Accept: application/json, text/event-stream' \   -d '{"jsonrpc":"2.0","id":1,"method":"initialize"}' # → 401 + WWW-Authenticate: Bearer resource_metadata="https://demo.royalplugins.com/.well-known/oauth-protected-resource"  # 2. RFC 9728 protected resource metadata curl 'https://demo.royalplugins.com/.well-known/oauth-protected-resource' # → {"resource":"https://demo.royalplugins.com/wp-json/royal-mcp/v1", #    "authorization
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed probes. This isn't actually `apify-mcp-server` — the connector dialog and DCR auto-detection live in our Console codebase, so we'll move the issue there.  On your guesses: - **`client_secret` required** — not it; we treat it as optional and honor `token_endpoint_auth_method: none`. - **Not following `issuer`** — partially real: we follow protected-resource → `authorization_servers[0]`, but discard any path on the issuer when building the well-known URL. Doesn't affect your root-based server, but it's a bug we'll fix. - **Not parsing `resource_metadata`** — correct, we guess the root path instead. Happens to match your server, but a real gap.  Given your responses, discovery *should* succeed, which points your failure at our outbound fetch layer (request timeout / response-size cap / IP-pinned TLS) rather than the discovery logic. We'll reproduce against your demo and report back. Thanks for the writeup.  --- _Generated by [Claude Code](https://claude.ai/code)_
  > @valekjo @MQ37 is this something you can look into?
  > I've taken a look and it seems this works in the Console.  I don't have an account at royal MCP, but the client got registered through DCR.

- **Issue #933** (2026-06-20): **[Bug]: Cannot connect to Apify MCP server from Claude.ai on Windows 11**
  *Symptoms*: ### Server type  Local (stdio via npx @apify/actors-mcp-server)  ### MCP Client  Claude Desktop  ### Operating System  Windows  ### What happened?  The Apify MCP connector in Claude.ai Desktop keeps showing  "Could not attach to MCP server Apify" and "Unable to connect  to extension server" despite all requirements being met.  Steps taken: - Node.js v24.16.0 installed and working - Fresh API tokens generated multiple times - Connector uninstalled and reinstalled multiple times - mcp.apify.com loads correctly in browser - Connector shows "All requirements met" - Enabled tools set correctly as: actors,docs,apify/rag-web-browser  OS: Windows 11 Claude Desktop version: latest Apify connector version: 0.9.17  Error: "Could not attach to MCP server Apify"  ### Steps to reproduce  1. Open Claude Desktop on Windows 11 2. Go to Settings → Extensions → apify-mcp-server 3. Enter valid Apify API token and save 4. Enable the connector 5. Error immediately appears: "Could not attach to MCP server Apify" 6. Bottom of page shows: "Unable to connect to extension server"  ### Node.js version  v24.16.0  ### Apify MCP Server version  _No response_  ### MCP server configuration  ```json {   "mcpServers": {     "apify": {       "command": "npx",       "args": ["-y", "@apify/actors-mcp-server"],       "env": {         "APIFY_TOKEN": "<REMOVED>"       }     }   } } ```  ### Error logs  ```text Could not attach to MCP server Apify Unable to connect to extension server.  Please try disabling and re-en
  **Post-Mortem & Fix Analysis**:
  > I am having same bug and took same steps, I dont know how to enter server configuration to see code. Just posted this on discord as well. Thanks
  > I’ve created custom connector using https://mcp.apify.com/ 
  > Thanks for the report. "Unable to connect to extension server" on Windows with the local stdio (`npx`) setup is almost always a corrupted npx cache, Node not on the GUI app's PATH, or Claude Desktop silently downgrading the connector.  The reliable fix is to skip local stdio and use our hosted server as a custom connector (as @juliazmacha did above): 1. Claude Desktop → Settings → Connectors → Add custom connector 2. URL: `https://mcp.apify.com` 3. Complete the OAuth flow — no API token needed in config  If you want to keep the local setup, clear the npx cache first: `rmdir /s /q %LOCALAPPDATA%\npm-cache\_npx`, then re-add the connector. Troubleshooting: https://docs.apify.com/platform/integrations/claude-desktop#troubleshooting

- **Issue #917** (2026-06-08): **fix: x402 PaymentRequired structuredContent clashes with call-actor outputSchema**
  *Symptoms*: ## Problem  `call-actor` (and other paid tools) declare `outputSchema: getActorRunOutputSchema` (`runId`, `status`, `storages`, …).  On x402 sessions without a payment signature, `buildPaymentRequiredResponse()` puts the x402 `PaymentRequired` payload (`x402Version`, `accepts[]`) into `structuredContent`.  Strict MCP clients (e.g. Cursor) validate `structuredContent` against the tool `outputSchema` and fail before the agent sees the payment hint.  Standby rejection and Skyfire missing-pay-id errors work because they return text-only (`structuredContent` omitted).  ## Examples  **Works (standby, x402 session):** ``` call-actor → actor: apify/actors-mcp-server → "Actor … is a standby Actor, which is not supported in agentic payment mode." ```  **Fails (non-standby, x402 session, no signature):** ``` call-actor → actor: jkuzz/ppe-test-charging → MCP -32602: Structured content does not match the tool's output schema:    data must have required property 'runId' … ```  **Works (same call, Skyfire session):** ``` → "Missing required skyfire-pay-id field." ```
  **Post-Mortem & Fix Analysis**:
  > Sharing a reference design from a production x402 gateway in case it's useful for this discussion.  **LemonCake** (https://lemoncake.xyz) ships an x402-native gateway at `/g/<id>` for AI agents. The relevant design choices we landed on:  - **Two-layer credential split**:   - `bk_…` Buyer Key — long-lived, hashed at rest, scoped to one seller, with hard caps (per-mint / daily / monthly)   - `pt_…` Pay Token (JWT) — short-lived, single-use, embedded budget + expiry, presented as `Bearer` - **402 challenge body**: `accepts[]` returns both a `buyUrl` (human checkout) and a `mintUrl` (machine — agent calls this directly with its Buyer Key) - **Settlement ordering**: charge is committed to `lc_agent_charges` (with unique `charge_ref` for idempotency) *before* the Pay Token is issued. Agents only ever see a JWT that is already paid; gateway pass is JWT verification only — no settlement check at request time. - **Custody-free**: virtual balance = sum of unused Pay Tokens. No pool. The agent's 
  > The fix is to keep x402 `PaymentRequired` payloads out of `structuredContent` entirely. `structuredContent` is schema-validated by strict MCP clients against the tool's declared `outputSchema` -- putting a payment challenge object there will always fail for tools that declare a non-payment output schema.  The correct shape for an x402 response in MCP is text-only content carrying the payment hint, with the MCP result structured as an error or a content block that does not touch `structuredContent`. The `structuredContent` field should only contain the tool's declared output when payment succeeds and the actual result is available.  AlgoVoi's MCP server (29 tools, `@algovoi/mcp-server` on npm, `algovoi-mcp` on PyPI) handles this by returning x402 payment challenges in the text content block with a clear payment-required signal, leaving `structuredContent` absent on non-success responses. That's what lets it work cleanly with Cursor and other strict MCP clients.  The pattern generalises:

- **Issue #889** (2026-06-29): **[Bug]: Inconsistent `search-actors` schema and results**
  *Symptoms*: ### Server type  Hosted (mcp.apify.com)  ### MCP Client  Other (specify in description)  ### Operating System  Linux  ### What happened?  The schema in `mcpc @apify-bearer tools-get search-actors --json` is not consistent with `mcpc @apify-bearer tools-call search-actors`:  For example, see the `pictureUrl` - it's missing in schema. The schema has tiered pricing and a lot of other redundant content.  `mcpc @apify-bearer tools-get search-actors --json`:  ```   "outputSchema": {     "type": "object",     "properties": {       "actors": {         "type": "array",         "items": {           "type": "object",           "properties": {             "title": {               "type": "string",               "description": "Actor title"             },             "url": {               "type": "string",               "description": "Actor URL"             },             "id": {               "type": "string",               "description": "Actor ID"             },             "fullName": {               "type": "string",               "description": "Full Actor name (username/name)"             },             "developer": {               "type": "object",               "properties": {                 "username": {                   "type": "string",                   "description": "Developer username"                 },                 "isOfficialApify": {                   "type": "boolean",                   "description": "Whether the actor is developed by Apify"                 },
  **Post-Mortem & Fix Analysis**:
  > Implemented in https://github.com/apify/apify-mcp-server/pull/1036 - adds the missing optional `pictureUrl` property to the shared `actorInfoSchema` so the search-actors output schema matches the structured cards it returns.
  > Cool, pls let me know once this is deployed, happy to test it

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

### Incident Patch 1: `143b1bca` (2026-10-05)
**Commit Message**: fix(actors): Match TIP pilot by Actor full name across environments (#1476)

TIP pilot matched only the production Actor ID, so staging (different
ID, same `apify/rag-web-browser`) never loaded tips.

- Also match on full name `apify/rag-web-browser` (clones still
excluded)

---------

Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `src/tools/actors/actor_run_response.ts` (modified, +2/-4)
```diff
@@ -8,6 +8,7 @@ import {
     HELPER_TOOLS,
     KV_KEYS_LIMIT,
     NARROW_OUTPUT_HINT,
+    RAG_WEB_BROWSER,
     TIP_MESSAGE_LIMIT,
 } from '../../const.js';
 import { buildActorRunWidgetMeta } from '../../resources/widgets.js';
@@ -27,9 +28,6 @@ import { DEFAULT_DATASET_ITEMS_LIMIT } from '../storage/get_dataset_items.js';
 /** Reserved key-value store key some Actors use to advertise advisory guidance about the run. */
 const TIP_KVS_KEY = 'TIP';
 
-/** Limit the TIP pilot to RAG Web Browser, including calls made by Actor ID. */
-const RAG_WEB_BROWSER_ID = '3ox4R101TgZz67sLr';
-
 /** nextStep text for widget-rendered responses: suppresses LLM polling. */
 export const WIDGET_NO_POLL_NEXT_STEP =
     'Widget is rendering live progress. Do NOT poll — the widget self-updates until completion.';
@@ -974,7 +972,7 @@ export async function fetchActorRunData(params: {
 
     const defaultKv = keyValueStores?.default;
     const tip =
-        isTerminal && run.actId === RAG_WEB_BROWSER_ID && defaultKv
+        isTerminal && defaultKv && actorName === RAG_WEB_BROWSER
             ? await fetchRunTip(client, defaultKv, mcpSessionId)
             : undefined;
 
```

---

### Incident Patch 2: `88cbc3e1` (2026-10-05)
**Commit Message**: fix(ci): Wait until npm serves the version before finishing publish (#1474)

## Why

Every stable release since 0.17.0 has needed a manual re-run (latest:
[run
37278956927](https://github.com/apify/apify-mcp-server/actions/runs/37278956927)).
"Smoke test published package" and "Bump dependency in
apify-mcp-server-internal" fail with `No matching version found for
@apify/actors-mcp-server@0.17.2`.

Since 2026-09-21, npm makes a version installable 1–4 min after `pnpm
publish` returns; before that it was immediate. Both jobs install the
version as soon as the publish job ends, and give up about 75 s later (3
attempts, 30 s apart).

Delay between the end of the publish step and the version's `time` entry
on npm:

| Versions | Delay |
|---|---|
| 0.15.5 … 0.16.0 (2026-09-09 → 09-17) | ~0 s |
| 0.16.1-beta.0 … 0.17.2 (2026-09-21 → 10-05) | 76–248 s |

## What changed

Before: the publish workflow finished as soon as `pnpm publish`
returned.
Now: after publishing, it checks `registry.npmjs.org` for the version
every 15 s for up to 20 min, and fails if the version never shows up.
The 20 min limit leaves room above npm's "up to 15 minutes or more"; our
worst case so far was about 4 min. St

**File**: `.github/workflows/manual_publish_to_npm.yaml` (modified, +13/-0)
```diff
@@ -57,3 +57,16 @@ jobs:
                 # `--no-git-checks` skips pnpm's working-tree/branch guards — release
                 # tags & branches are validated upstream by the release workflow.
                 run: pnpm publish --tag ${{ inputs.tag }} --no-git-checks
+            -   name: Wait until the version is on the registry
+                # npm scans each version before it becomes installable: "typically around five
+                # minutes ... up to 15 minutes or more" (https://github.blog/changelog/2026-07-28-npm-publish-time-malware-scanning-and-dual-use-metadata/).
+                # Jobs that run after this workflow (smoke test, internal repo bump) install
+                # the version right away, so don't finish until the registry serves it.
+                run: |
+                    version=$(jq -r '.version' package.json)
+                    for _ in $(seq 1 80); do
+                        curl -sf -o /dev/null "https://registry.npmjs.org/@apify%2factors-mcp-server/$version" && exit 0
+                        sleep 15
+                    done
+                    echo "::error::@apify/actors-mcp-server@$version is not on the registry after 20 minutes"
+                    exit 1
```

---

### Incident Patch 3: `fb731c54` (2026-10-01)
**Commit Message**: fix(actors): limit and validate the RAG Web Browser TIP pilot (#1468)

Follow-up to #1363, based on `feat/surface-actor-tip`, for the TIP
behavior requested in #1361. The pilot is limited to RAG Web Browser, as
discussed in apify/ai-team#328. An Actor-authored `recommendedActorId`
accepted arbitrary strings: a 100,000-character value produced a
201,249-byte serialized response and entered recommendation telemetry
unchanged.

**File**: `src/tools/AGENTS.md` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ direct actor tools, `search-actors`, `fetch-actor-details`) is mode-agnostic.
     the one canonical run shape `call-actor` and `get-actor-run` share across sync, task
     and wait-timeout modes: storage IDs plus a `summary` (past) / `nextStep` (one primary
     action) pair, never inline dataset items or KV bodies — except the reserved `TIP` key,
-    inlined as `tip` on terminal runs.
+    inlined as `tip` on terminal RAG Web Browser runs only.
   - `runs/` — get/abort runs, run logs, run list.
   - `storage/` — dataset and key-value-store tools plus `storage_helpers.ts`.
   - `tasks/` — Actor task create/get/update plus publish/unpublish of the task's public
```

**File**: `src/tools/actors/actor_run_response.ts` (modified, +25/-16)
```diff
@@ -27,8 +27,8 @@ import { DEFAULT_DATASET_ITEMS_LIMIT } from '../storage/get_dataset_items.js';
 /** Reserved key-value store key some Actors use to advertise advisory guidance about the run. */
 const TIP_KVS_KEY = 'TIP';
 
-/** Page size for the targeted `TIP` key lookup (server-side `prefix` filter, not pagination). */
-const TIP_SEARCH_LIMIT = 1000;
+/** Limit the TIP pilot to RAG Web Browser, including calls made by Actor ID. */
+const RAG_WEB_BROWSER_ID = '3ox4R101TgZz67sLr';
 
 /** nextStep text for widget-rendered responses: suppresses LLM polling. */
 export const WIDGET_NO_POLL_NEXT_STEP =
@@ -339,15 +339,18 @@ function parseActorTip(value: unknown): RunResponse['tip'] {
     return {
         message: truncated,
         ...(level === 'info' || level === 'warning' ? { level } : {}),
-        ...(typeof recommendedActorId === 'string' && recommendedActorId ? { recommendedActorId } : {}),
+        ...(typeof recommendedActorId === 'string' &&
+        recommendedActorId.length === 17 &&
+        /^[a-zA-Z0-9]{17}$/.test(recommendedActorId)
+            ? { recommendedActorId }
+            : {}),
     };
 }
 
-/** Targeted `TIP` key lookup via the API's `prefix` filter — works for stores of any size, one request. */
+/** Check the exact `TIP` key without fetching another page of keys. */
 async function keyValueStoreHasTipKey(client: ApifyClient, id: string, mcpSessionId?: string): Promise<boolean> {
     try {
-        const page = await client.keyValueStore(id).listKeys({ prefix: TIP_KVS_KEY, limit: TIP_SEARCH_LIMIT });
-        return page.items.some((item) => item.key === TIP_KVS_KEY);
+        return await client.keyValueStore(id).recordExists(TIP_KVS_KEY);
     } catch (error) {
         log.warning('Failed to look up Actor tip key', {
             keyValueStoreId: id,
@@ -373,6 +376,18 @@ async function fetchActorTip(
     }
 }
 
+/** Fetch the run's tip; looks the key up separately only when the listed keys are truncated. */
+async function fetchRunTip(
+    client: ApifyClient,
+    { id, keys = [], keyCount }: RunKeyValueStore,
+    mcpSessionId?: string,
+): Promise<RunResponse['tip']> {
+    const isTruncated = keyCount === undefined && keys.length === KV_KEYS_LIMIT;
+    const hasTipKey =
+        keys.includes(TIP_KVS_KEY) || (isTruncated && (await keyValueStoreHasTipKey(client, id, mcpSessionId)));
+    return hasTipKey ? fetchActorTip(client, id, mcpSessionId) : undefined;
+}
+
 /**
  * For Console UI token sessions, sets the Apify Console `apifyConsoleUrl` on the run and its default
  * storages and returns the narrative suffix (the links + the verbatim nudge) in a single pass.
@@ -957,17 +972,11 @@ export async function fetchActorRunData(params: {
         keyValueStore: keyValueStores?.default,
     });
 
-    // Targeted lookup only when the displayed (KV_KEYS_LIMIT-capped) page is truncated and lacks TIP —
-    // avoids an extra round trip in the common case while still catching TIP beyond that page.
     const defaultKv = keyValueStores?.default;
-    const displayedKeys = defaultKv?.keys ?? [];
-    const kvTruncated = defaultKv?.keyCount === undefined && displayedKeys.length === KV_KEYS_LIMIT;
-    const hasTipKey =
-        isTerminal && defaultKv
-            ? displayedKeys.includes(TIP_KVS_KEY) ||
-              (kvTruncated && (await keyValueStoreHasTipKey(client, defaultKv.id, mcpSessionId)))
-            : false;
-    const tip = hasTipKey && defaultKv ? await fetchActorTip(client, defaultKv.id, mcpSessionId) : undefined;
+    const tip =
+        isTerminal && run.actId === RAG_WEB_BROWSER_ID && defaultKv
+            ? await fetchRunTip(client, defaultKv, mcpSessionId)
+            : undefined;
 
     const structuredContent: RunResponse = {
         runId: run.id,
```

**File**: `src/tools/structured_output_schemas.ts` (modified, +1/-1)
```diff
@@ -698,7 +698,7 @@ export const actorRunOutputSchema = {
         },
         tip: {
             type: 'object' as const,
-            description: 'Advisory guidance an Actor wrote to its key-value store under the reserved "TIP" key',
+            description: 'Advisory guidance RAG Web Browser wrote to its key-value store under the reserved "TIP" key',
             properties: {
                 message: {
                     type: 'string',
```

**File**: `tests/unit/tools.get_actor_run.response.test.ts` (modified, +60/-20)
```diff
@@ -25,7 +25,7 @@ vi.mock('../../src/utils/userid_cache.js', () => ({
 
 /**
  * Default mode `get-actor-run` returns: runId, actorId, status, storages, summary, nextStep
- * — with no inlined dataset items or KV record bodies, except the reserved `TIP` key.
+ * — with no inlined dataset items or KV record bodies, except RAG Web Browser's reserved `TIP` key.
  * Tests cover shape invariants and the branching status templates (SUCCEEDED, TIMED-OUT).
  * Pure-template states (READY, RUNNING, TIMING-OUT, ABORTING, FAILED, ABORTED) are intentionally
  * not asserted here — see the comment above `describe('buildStatusTemplate', ...)` below.
@@ -513,24 +513,25 @@ describe('get-actor-run default response', () => {
         });
     });
 
-    /** Stubs `listKeys`, branching on `prefix` to serve the display page vs. the targeted TIP lookup. */
     function makeKvStoreClient(opts: {
         displayedKeys: { key: string }[];
         displayTruncated?: boolean;
-        prefixLookupItems?: { key: string }[];
+        hasTipKey?: boolean;
         tipRecordValue?: unknown;
     }) {
         let getRecordCalls = 0;
-        const listKeysCalls: { limit: number; prefix?: string }[] = [];
+        const listKeysCalls: { limit: number }[] = [];
+        const recordExistsCalls: string[] = [];
         return {
             client: {
                 keyValueStore: (_id: string) => ({
-                    listKeys: async (listOpts: { limit: number; prefix?: string }) => {
+                    listKeys: async (listOpts: { limit: number }) => {
                         listKeysCalls.push(listOpts);
-                        if (listOpts.prefix === undefined) {
-                            return { items: opts.displayedKeys, isTruncated: opts.displayTruncated ?? false };
-                        }
-                        return { items: opts.prefixLookupItems ?? [], isTruncated: false };
+                        return { items: opts.displayedKeys, isTruncated: opts.displayTruncated ?? false };
+                    },
+                    recordExists: async (key: string) => {
+                        recordExistsCalls.push(key);
+                        return key === 'TIP' && (opts.hasTipKey ?? false);
                     },
                     getRecord: async (key: string) => {
                         getRecordCalls += 1;
@@ -542,14 +543,15 @@ describe('get-actor-run default response', () => {
             } as unknown as InternalToolArgs['apifyClient'],
             getRecordCalls: () => getRecordCalls,
             listKeysCalls: () => listKeysCalls,
+            recordExistsCalls: () => recordExistsCalls,
         };
     }
 
-    function makeRunClient(kvStoreClient: unknown) {
-        const run = mockSucceededRun();
+    function makeRunClient(kvStoreClient: unknown, actorId = '3ox4R101TgZz67sLr', actor = ACTOR) {
+        const run = mockSucceededRun({ actId: actorId });
         return {
             run: (_id: string) => ({ get: async () => run, waitForFinish: async () => run }),
-            actor: (_id: string) => ({ get: async () => ACTOR }),
+            actor: (_id: string) => ({ get: async () => actor }),
             dataset: (_id: string) => ({
                 get: async () => mockDataset(),
                 listItems: async () => ({ items: [], total: 0 }),
@@ -578,6 +580,36 @@ describe('get-actor-run default response', () => {
         expect(listKeysCalls()).toHaveLength(1);
     });
 
+    it.each([false, true])(
+        'skips TIP reads for another Actor when the key page is truncated=%s',
+        async (isTruncated) => {
+            const { client, getRecordCalls, recordExistsCalls } = makeKvStoreClient({
+                displayedKeys: isTruncated
+                    ? Array.from({ length: 50 }, (_, i) => ({ key: `KEY_${i}` }))
+                    : [{ key: 'TIP' }],
+                displayTruncated: isTruncated,
+                hasTipKey: true,
+                tipRecordValue: { message: 'Use a specialized Actor.', level: 'info' },
+            });
+
+            const result = await (getActorRun as HelperTool).call(
+                stubToolCallContext(
+                    { runId: 'run-1', waitSecs: 0 },
+                    makeRunClient(client, 'shu8hvrXbJbY3Eb9W', { username: 'another-user', name: 'rag-web-browser' }),
+                ),
+            );
+            const { structuredContent, content } = result as {
+                structuredContent: RunResponse;
+                content: { type: string; text: string }[];
+            };
+
+            expect(structuredContent.tip).toBeUndefined();
+            expect(content[1].text).not.toContain('Tip from Actor');
+            expect(getRecordCalls()).toBe(0);
+            expect(recordExistsCalls()).toEqual([]);
+        },
+    );
+
     it('omits tip and never fetches the TIP record when a non-truncated store does not have it', async () => {
         const { client, getRecordCalls, listKeysCalls } = makeKvStoreClient({
  
```

---

### Incident Patch 4: `9b2a34c7` (2026-09-30)
**Commit Message**: fix: Move get-actor-list out of the default actors category (#1465)

## Why

Closes #1464

Since 0.17.0 `get-actor-list` was in the default `actors` category). It
overlaps with `search-actors` for "find my Actor" requests and it was
published without proper evals (my bad)

**This is a temporary solution until we have evals** for the tool; then
it goes back into a category.

## What changed

Before: `get-actor-list` in `actors`, so in the default set and in
`tools=actors`.
Now: in no category. Served only when named: `tools=get-actor-list`.

## Proof it works

mcpc against the built stdio server:

| Case | Result |
|---|---|
| default session | no `get-actor-list`; `search-actors` has no hint |
| `--tools=get-actor-list` | tools/list = `["get-actor-list"]`; no Actor
fetch, no run tools |
| `tools-call get-actor-list` | `isError: false`, `structuredContent`
with the account's Actors |
| `--tools=actors,get-actor-list` | actors tools + 4 auto-injected +
`get-actor-list`; hint present |

---
_Generated by [Claude
Code](https://claude.ai/code/session_015XEmPf5S4N6UyYthDCbLmz)_

---------

Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +1/-1)
```diff
@@ -264,7 +264,6 @@ Legend for the **Enabled by default** column:
 | `search-actors` | actors | Search for Actors in Apify Store. | ✅ |
 | `fetch-actor-details` | actors | Retrieve detailed information about a specific Actor, including its input schema, README (summary when available, full otherwise), pricing, and Actor output schema. | ✅ |
 | `call-actor` | actors | Call an Actor and get its run results. Use fetch-actor-details first to get the Actor's input schema. | ✅ |
-| `get-actor-list` | actors | List the Actors you own and those shared with you, including private ones. | ✅ |
 | `get-actor-run` | runs | Get detailed information about a specific Actor run. | ⚡ |
 | `get-dataset-items` | storage | Retrieve items from a dataset with support for filtering and pagination. | ⚡ |
 | `get-key-value-store-record`| storage | Get the value associated with a specific key in a key-value store. | ⚡ |
@@ -274,6 +273,7 @@ Legend for the **Enabled by default** column:
 | [`apify--rag-web-browser`](https://apify.com/apify/rag-web-browser) | Actor (see [tool configuration](#tools-configuration)) | An Actor tool to browse the web. | ✅ |
 | [`apify--web-fetch`](https://apify.com/apify/web-fetch) | Actor (see [tool configuration](#tools-configuration)) | An Actor tool to fetch a URL and return its content. | ✅ |
 | `report-problem` | dev | Report a problem with an Apify tool or Actor to the Apify team. | ✅¹ |
+| `get-actor-list` | none (select by name: `tools=get-actor-list`) | List the Actors you own and those shared with you, including private ones. |  |
 | `get-actor-run-list` | runs | Get a list of Actor runs, filterable by Actor and status. |  |
 | `get-actor-run-log` | runs | Retrieve the logs for a specific Actor run. |  |
 | `get-dataset` | storage | Get metadata about a specific dataset. |  |
```

**File**: `src/index_internals_test_kit.ts` (modified, +2/-0)
```diff
@@ -9,6 +9,7 @@ import { SKYFIRE_ENABLED_TOOLS } from './payments/const.js';
 import { RESOURCE_MIME_TYPE } from './resources/widgets.js';
 import { CALL_ACTOR_MCP_MISSING_TOOL_NAME_MSG } from './tools/actors/call_actor.js';
 import { toolCategoriesEnabledByDefault } from './tools/index.js';
+import { UNCATEGORIZED_TOOLS } from './tools/registry.js';
 import { actorRunOutputSchema } from './tools/structured_output_schemas.js';
 import type { SERVER_MODE, TelemetryEnv, ToolEntry } from './types.js';
 import { APIFY_ACTOR_RUN_META_KEY } from './utils/mcp.js';
@@ -22,6 +23,7 @@ export {
     RESOURCE_MIME_TYPE,
     CALL_ACTOR_MCP_MISSING_TOOL_NAME_MSG,
     toolCategoriesEnabledByDefault,
+    UNCATEGORIZED_TOOLS,
     actorRunOutputSchema,
     type SERVER_MODE,
     type TelemetryEnv,
```

**File**: `src/tools/AGENTS.md` (modified, +2/-1)
```diff
@@ -10,7 +10,8 @@ direct actor tools, `search-actors`, `fetch-actor-details`) is mode-agnostic.
 
 ## Files
 
-- `registry.ts` — tool categories and the tools in each (`index.ts` re-exports them).
+- `registry.ts` — tool categories and the tools in each (`index.ts` re-exports them), plus tools in no
+  category (`ALL_WIDGET_TOOLS`, `UNCATEGORIZED_TOOLS`).
 - `structured_output_schemas.ts` — shared JSON-schema definitions for structured
   output across tools.
 - `utils.ts` — shared tool helpers (schema property shaping, AJV compile).
```

**File**: `src/tools/registry.ts` (modified, +7/-1)
```diff
@@ -56,7 +56,7 @@ import { searchActorsWidget } from './widgets/search_actors_widget.js';
 
 /** Unified tool category definitions — single source of truth. */
 export const toolCategories = {
-    actors: [searchActors, fetchActorDetails, callActor, getActorList],
+    actors: [searchActors, fetchActorDetails, callActor],
     docs: [searchApifyDocs, fetchApifyDocs],
     runs: [getActorRun, getActorRunList, getActorRunLog, abortActorRun],
     storage: [
@@ -101,6 +101,12 @@ export const ALL_WIDGET_TOOLS: readonly ToolEntry[] = [
     getActorRunWidget,
 ];
 
+/**
+ * Non-widget tools in no category: never served by default or by a category, only when named in
+ * `tools=`, in every mode. Temporary: `get-actor-list` returns to a category once evals cover it.
+ */
+export const UNCATEGORIZED_TOOLS: readonly ToolEntry[] = [getActorList];
+
 /**
  * Apps-mode auto-pairing: a widget is added iff its base tool is present — see
  * `getToolsForServerMode` in tools_loader.ts. `call-actor`/`get-actor-run` widgets don't pair (low
```

**File**: `src/utils/tools_loader.ts` (modified, +3/-0)
```diff
@@ -18,6 +18,7 @@ import {
     CATEGORY_NAMES,
     getCategoryTools,
     toolCategoriesEnabledByDefault,
+    UNCATEGORIZED_TOOLS,
     WIDGET_BY_BASE_TOOL,
 } from '../tools/registry.js';
 import { abortActorRun } from '../tools/runs/abort_actor_run.js';
@@ -48,6 +49,7 @@ const ALL_INTERNAL_TOOL_NAMES: Set<string> = (() => {
     for (const name of CATEGORY_NAMES) {
         for (const tool of categories[name]) names.add(tool.name);
     }
+    for (const tool of UNCATEGORIZED_TOOLS) names.add(tool.name);
     // Widgets live in no category — ALL_WIDGET_TOOLS covers every widget, paired or not.
     for (const widget of ALL_WIDGET_TOOLS) names.add(widget.name);
     return names;
@@ -208,6 +210,7 @@ export function getToolsForServerMode(
             toolsByName.set(tool.name, tool);
         }
     }
+    for (const tool of UNCATEGORIZED_TOOLS) toolsByName.set(tool.name, tool);
     // Widgets are apps-only and not in any category; include every widget (paired or not) for
     // direct `?tools=` selection.
     if (mode === SERVER_MODE.APPS) {
```

**File**: `tests/test_kit/cases/registration.cases.ts` (modified, +2/-2)
```diff
@@ -83,7 +83,7 @@ export const registrationCases: Case[] = [
             const names = getToolNames(tools);
 
             // Equivalent to tools=actors,docs,apify/rag-web-browser,apify/web-fetch (no widgets outside apps).
-            const expectedActorsTools = ['fetch-actor-details', 'search-actors', 'call-actor', 'get-actor-list'];
+            const expectedActorsTools = ['fetch-actor-details', 'search-actors', 'call-actor'];
             const expectedDocsTools = ['search-apify-docs', 'fetch-apify-docs'];
             const expectedActors = [
                 actorNameToToolName('apify/rag-web-browser'),
@@ -103,7 +103,7 @@ export const registrationCases: Case[] = [
         isDeploymentTest: true,
         run: withClient({ telemetry: { enabled: true } }, async (client) => {
             const names = getToolNames(await client.listTools());
-            expect(names).toHaveLength(9 + AUTO_INJECTED_TOOL_NAMES.length);
+            expect(names).toHaveLength(8 + AUTO_INJECTED_TOOL_NAMES.length);
             expect(names).toContain(HELPER_TOOLS.PROBLEM_REPORT);
         }),
     },
```

**File**: `tests/test_kit/helpers.ts` (modified, +2/-1)
```diff
@@ -17,6 +17,7 @@ import {
     AUTO_INJECTED_TOOLS,
     HELPER_TOOLS,
     toolCategoriesEnabledByDefault,
+    UNCATEGORIZED_TOOLS,
 } from '@apify/actors-mcp-server/internals/test-kit.js';
 
 import type { CaseCtx, SuiteClient, Transport } from './types.js';
@@ -128,7 +129,7 @@ export function findToolByName(name: string, mode: SERVER_MODE): ToolEntry | und
         const tool = tools.find((t) => t.name === name);
         if (tool) return tool;
     }
-    return undefined;
+    return UNCATEGORIZED_TOOLS.find((t) => t.name === name);
 }
 
 export function validateStructuredOutputForTool(result: unknown, toolName: string, mode: SERVER_MODE): void {
```

**File**: `tests/unit/server_card.test.ts` (modified, +0/-1)
```diff
@@ -33,7 +33,6 @@ const EXPECTED_TOOL_NAMES = [
     'get-dataset-items',
     'get-key-value-store-record',
     'abort-actor-run',
-    'get-actor-list',
     'search-apify-docs',
     'fetch-apify-docs',
 ];
```

---

### Incident Patch 5: `1435ec6f` (2026-09-29)
**Commit Message**: feat: Add get-actor-build-list tool (#1431)

**File**: `README.md` (modified, +2/-1)
```diff
@@ -248,7 +248,7 @@ Here are some special MCP operations and how the Apify MCP Server supports them:
 - **Apify storage**: Access data from your datasets and key-value stores.
 - **Actor tasks**: Create, inspect, and update your saved Actor tasks, and publish or unpublish their public landing pages.
 - **Schedules**: Create, inspect, update, and delete schedules that run your Actors and tasks automatically.
-- **Builds**: Build an Actor version, check the status of a build, and retrieve its build log.
+- **Builds**: Build an Actor version, list builds, check the status of a build, and retrieve its build log.
 
 ### Overview of available tools
 
@@ -292,6 +292,7 @@ Legend for the **Enabled by default** column:
 | `delete-schedule` | schedules | Delete a schedule. |  |
 | `get-actor-build` | builds | Get an Actor build's status. |  |
 | `get-actor-build-log` | builds | Retrieve the logs for a specific Actor build. |  |
+| `get-actor-build-list` | builds | List the account's builds, or one Actor's, in every status, newest first. |  |
 | `build-actor` | builds | Build an Actor version and wait a bounded time for the build to finish. |  |
 
 > **Note:**
```

**File**: `src/const.ts` (modified, +1/-0)
```diff
@@ -43,6 +43,7 @@ export const HELPER_TOOLS = {
     ACTOR_BUILD: 'build-actor',
     ACTOR_BUILD_GET: 'get-actor-build',
     ACTOR_BUILD_LOG: 'get-actor-build-log',
+    ACTOR_BUILD_LIST_GET: 'get-actor-build-list',
     ACTOR_CALL: 'call-actor',
     ACTOR_CALL_WIDGET: 'call-actor-widget',
     ACTOR_GET_DETAILS: 'fetch-actor-details',
```

**File**: `src/tools/AGENTS.md` (modified, +3/-2)
```diff
@@ -28,8 +28,9 @@ direct actor tools, `search-actors`, `fetch-actor-details`) is mode-agnostic.
   - `schedules/` — schedule create/get/update/delete for Actors and tasks; `schedule_helpers.ts`
     converts the flat action shape to the API shape and back, and reuses the id helpers from
     `tasks/task_helpers.ts`.
-  - `builds/` — `get-actor-build` (build status), `get-actor-build-log` (build log tail) and
-    `build-actor` (start a build of one version and wait for it); `build_helpers.ts` holds the
+  - `builds/` — `get-actor-build` (build status), `get-actor-build-log` (build log tail),
+    `get-actor-build-list` (the account's builds, or one Actor's with `actorId`, in every status, newest
+    first, pointing at the newest failed one) and `build-actor` (start a build of one version and wait for it); `build_helpers.ts` holds the
     allowlisted build result shape, the build start and wait calls (the wait reports progress), the
     shared `waitSecs` field, the shared build response and the by-status next-step text.
   - `docs/` — search and fetch Apify docs.
```

**File**: `src/tools/builds/build_helpers.ts` (modified, +15/-3)
```diff
@@ -40,10 +40,12 @@ export function buildWaitSecsField(zeroMeans: string) {
 
 /**
  * The build subset returned by the build tools. Allowlisted so internal fields on the API
- * document (userId, meta, options, inspectorId) never reach the client.
- * `apifyConsoleUrl` is set only for Console UI token sessions (see `getConsoleLinkContext`).
+ * document (userId, meta, options, inspectorId) never reach the client. get-actor-build-list returns
+ * it as is; get-actor-build and build-actor add the Console link (`toBuildResult`).
  */
-export function toBuildResult(build: Build, linkContext: ConsoleLinkContext | undefined) {
+export function toBuildItem(
+    build: Pick<Build, 'id' | 'actId' | 'buildNumber' | 'status' | 'startedAt' | 'finishedAt'>,
+) {
     return {
         id: build.id,
         actorId: build.actId,
@@ -52,6 +54,16 @@ export function toBuildResult(build: Build, linkContext: ConsoleLinkContext | un
         // Normalized because the client parses these into `Date` objects; the output schema promises strings.
         startedAt: toIsoString(build.startedAt) ?? null,
         finishedAt: toIsoString(build.finishedAt) ?? null,
+    };
+}
+
+/**
+ * `toBuildItem` plus `apifyConsoleUrl`, which is set only for Console UI token sessions
+ * (see `getConsoleLinkContext`).
+ */
+export function toBuildResult(build: Build, linkContext: ConsoleLinkContext | undefined) {
+    return {
+        ...toBuildItem(build),
         apifyConsoleUrl: buildConsoleBuildUrl(linkContext, build.actId, build.buildNumber),
     };
 }
```

**File**: `src/tools/builds/get_actor_build_list.ts` (added, +142/-0)
```diff
@@ -0,0 +1,142 @@
+import type { Build, BuildCollectionClientListItem } from 'apify-client';
+import { z } from 'zod';
+
+import { HELPER_TOOLS } from '../../const.js';
+import type { InternalToolArgs, ToolDescriptionContext, ToolEntry, ToolInputSchema } from '../../types.js';
+import { ALL_TOOLS_PRESENT, TOOL_TYPE } from '../../types.js';
+import { compileSchema, fixZodSchemaRequired } from '../../utils/ajv.js';
+import { respondOk, respondUserError } from '../../utils/mcp.js';
+import { catchNotFound } from '../storage/storage_helpers.js';
+import { getActorBuildListToolOutputSchema } from '../structured_output_schemas.js';
+import { toBuildItem } from './build_helpers.js';
+
+const getActorBuildListArgs = z.object({
+    actorId: z
+        .string()
+        .min(1)
+        .optional()
+        .describe(
+            'Only list builds of this Actor: its ID, or its full name as username/name or username~name. A name without the username is not enough.',
+        ),
+    offset: z.number().int().min(0).describe('Number of builds to skip at the start. Default: 0.').default(0),
+    limit: z
+        .number()
+        .int()
+        .min(1)
+        .max(20)
+        .describe('Maximum number of builds to return. Default is 10. Maximum is 20.')
+        .default(10),
+    // Newest first by default, unlike get-actor-run-list, because the build a caller looks for is
+    // usually the latest one (#1407).
+    desc: z
+        .boolean()
+        .describe('If true, the builds are sorted by startedAt, newest first; false sorts oldest first. Default: true.')
+        .default(true),
+});
+
+/**
+ * One build as the list endpoint returns it (OpenAPI `BuildShort`). The client's item type leaves out
+ * `actId` and `buildNumber`, which the API does send.
+ */
+type BuildListItem = BuildCollectionClientListItem & Pick<Build, 'actId' | 'buildNumber'>;
+
+/** Statuses of a build that ended without succeeding; the next step points at the newest one's log. */
+const FAILED_BUILD_STATUSES: ReadonlySet<string> = new Set(['FAILED', 'TIMED-OUT', 'ABORTED']);
+
+/**
+ * The one next step after a page of builds. A failed build is the usual reason to list builds, so the
+ * newest failed build on the page wins. Sibling tools are named only when the session was served them.
+ */
+function buildNextStepForBuildList(
+    builds: BuildListItem[],
+    desc: boolean,
+    loadedToolNames: readonly string[],
+): string | undefined {
+    const failedBuilds = builds.filter((build) => FAILED_BUILD_STATUSES.has(build.status));
+    // The API sorts by startedAt, so the newest failed build leads a descending page and ends an ascending one.
+    const newestFailedBuild = desc ? failedBuilds[0] : failedBuilds.at(-1);
+    if (newestFailedBuild) {
+        return loadedToolNames.includes(HELPER_TOOLS.ACTOR_BUILD_LOG)
+            ? `Read why build ${newestFailedBuild.buildNumber} failed with ${HELPER_TOOLS.ACTOR_BUILD_LOG} using buildId ${newestFailedBuild.id}.`
+            : `Read the log of build ${newestFailedBuild.buildNumber} (ID ${newestFailedBuild.id}) to see why it failed.`;
+    }
+    // An empty page has no build to check.
+    if (builds.length > 0 && loadedToolNames.includes(HELPER_TOOLS.ACTOR_BUILD_GET)) {
+        return `Check a build with ${HELPER_TOOLS.ACTOR_BUILD_GET} using its buildId.`;
+    }
+    return undefined;
+}
+
+function buildDescription({ hasTool }: ToolDescriptionContext): string {
+    return `List the Actor builds of the account, newest first by default. Pass actorId to list only the builds of one Actor, for example to find why its latest build failed. Lists builds in every status; there is no status filter.
+Read-only. Returns total, count, offset, limit, desc and items (id, actorId, buildNumber, status, startedAt, finishedAt)
+and a summary with at most one next step.${
+        hasTool(HELPER_TOOLS.ACTOR_BUILD_GET)
+            ? ` Check a build with ${HELPER_TOOLS.ACTOR_BUILD_GET} by passing its id as buildId.`
+            : ''
+    }${
+        hasTool(HELPER_TOOLS.ACTOR_BUILD_LOG)
+            ? ` Read why a build failed with ${HELPER_TOOLS.ACTOR_BUILD_LOG} by passing its id as buildId.`
+            : ''
+    }
+
+USAGE:
+- Use to find the ID of a build that failed or that no run references.
+- Use to see recent builds and their statuses, of one Actor or across the account.
+
+USAGE EXAMPLES:
+- user_input: Why did the last build of my-actor fail?
+- user_input: List the builds of john/my-actor`;
+}
+
+/**
+ * https://docs.apify.com/api/v2/actor-builds-get (all builds of the user)
+ * https://docs.apify.com/api/v2/act-builds-get (builds of one Actor, when `actorId` is given)
+ *
+ * Mirrors get-actor-run-list: `actorId` is an optional filter, not a required argument.
+ */
+export const getActorBuildList: ToolEntry = Object.freeze({
+    type: TOOL_TYPE.INTERNAL,
+    name: HELPER_TOOLS.ACTOR_BUILD_LIST_GET,
+    title: 'Get Actor build list',
+    description: buildDescription(ALL_TOOLS_P
```

**File**: `src/tools/registry.ts` (modified, +2/-1)
```diff
@@ -22,6 +22,7 @@ import { fetchActorDetails } from './actors/fetch_actor_details.js';
 import { searchActors } from './actors/search_actors.js';
 import { buildActor } from './builds/build_actor.js';
 import { getActorBuild } from './builds/get_actor_build.js';
+import { getActorBuildList } from './builds/get_actor_build_list.js';
 import { getActorBuildLog } from './builds/get_actor_build_log.js';
 import { reportProblem } from './dev/report_problem.js';
 import { fetchApifyDocs } from './docs/fetch_apify_docs.js';
@@ -69,7 +70,7 @@ export const toolCategories = {
     ],
     tasks: [createActorTask, getActorTask, updateActorTask, publishActorTask, unpublishActorTask],
     schedules: [createSchedule, getSchedule, updateSchedule, deleteSchedule],
-    builds: [getActorBuild, getActorBuildLog, buildActor],
+    builds: [getActorBuild, getActorBuildLog, getActorBuildList, buildActor],
     dev: [reportProblem],
 } satisfies Record<string, ToolEntry[]>;
 
```

**File**: `src/tools/runs/get_actor_run_list.ts` (modified, +3/-1)
```diff
@@ -13,7 +13,9 @@ const getUserRunsListArgs = z.object({
         .string()
         .min(1)
         .optional()
-        .describe('Only list runs of this Actor; accepts an Actor ID or username/name.'),
+        .describe(
+            'Only list runs of this Actor: its ID, or its full name as username/name or username~name. A name without the username is not enough.',
+        ),
     offset: z
         .number()
         .describe('Number of array elements that should be skipped at the start. The default value is 0.')
```

**File**: `src/tools/structured_output_schemas.ts` (modified, +23/-11)
```diff
@@ -486,27 +486,33 @@ export const getActorBuildLogToolOutputSchema = {
     required: ['log'],
 };
 
-/**
- * Schema for get-actor-build: the allowlisted build subset (`toBuildResult`).
- */
+/** Schema for one build: the allowlisted build subset (`toBuildItem`), as get-actor-build-list returns it. */
+const actorBuildItemSchema = {
+    type: 'object' as const,
+    properties: {
+        id: { type: 'string', description: 'Build ID' },
+        actorId: { type: 'string', description: 'ID of the Actor the build belongs to' },
+        buildNumber: { type: 'string', description: 'Build number, e.g. 0.1.12' },
+        status: { type: 'string', description: 'Build status, e.g. RUNNING, SUCCEEDED, FAILED' },
+        startedAt: { type: ['string', 'null'], description: 'ISO timestamp' },
+        finishedAt: { type: ['string', 'null'], description: 'ISO timestamp; null while the build is running' },
+    },
+    required: ['id', 'actorId', 'buildNumber', 'status', 'startedAt', 'finishedAt'],
+};
+
+/** Schema for get-actor-build: one build with its Console link (`toBuildResult`). */
 export const getActorBuildToolOutputSchema = {
     type: 'object' as const,
     properties: {
         build: {
-            type: 'object',
+            ...actorBuildItemSchema,
             properties: {
-                id: { type: 'string', description: 'Build ID' },
-                actorId: { type: 'string', description: 'ID of the Actor the build belongs to' },
-                buildNumber: { type: 'string', description: 'Build number, e.g. 0.1.12' },
-                status: { type: 'string', description: 'Build status, e.g. RUNNING, SUCCEEDED, FAILED' },
-                startedAt: { type: ['string', 'null'], description: 'ISO timestamp' },
-                finishedAt: { type: ['string', 'null'], description: 'ISO timestamp; null while the build is running' },
+                ...actorBuildItemSchema.properties,
                 apifyConsoleUrl: {
                     type: 'string',
                     description: 'Personalized Apify Console link to the build; present only for Console sessions',
                 },
             },
-            required: ['id', 'actorId', 'buildNumber', 'status', 'startedAt', 'finishedAt'],
         },
     },
     required: ['build'],
@@ -734,6 +740,12 @@ const actorRunListItemSchema = {
 /** Schema for get-actor-run-list output (paginated list of runs). */
 export const actorRunListOutputSchema = paginatedListOutputSchema(actorRunListItemSchema, 'Actor runs.');
 
+/** Schema for get-actor-build-list output (paginated list of builds). */
+export const getActorBuildListToolOutputSchema = paginatedListOutputSchema(
+    actorBuildItemSchema,
+    'Builds, newest first by default.',
+);
+
 /**
  * Schema for dataset items retrieval tools (get-dataset-items).
  * Contains dataset items with pagination and count information.
```

---

### Incident Patch 6: `624dbd1d` (2026-09-24)
**Commit Message**: feat: Add build-actor tool (#1332)

**File**: `README.md` (modified, +2/-1)
```diff
@@ -248,7 +248,7 @@ Here are some special MCP operations and how the Apify MCP Server supports them:
 - **Apify storage**: Access data from your datasets and key-value stores.
 - **Actor tasks**: Create, inspect, and update your saved Actor tasks, and publish or unpublish their public landing pages.
 - **Schedules**: Create, inspect, update, and delete schedules that run your Actors and tasks automatically.
-- **Builds**: Check the status of an Actor build and retrieve its build log.
+- **Builds**: Build an Actor version, check the status of a build, and retrieve its build log.
 
 ### Overview of available tools
 
@@ -292,6 +292,7 @@ Legend for the **Enabled by default** column:
 | `delete-schedule` | schedules | Delete a schedule. |  |
 | `get-actor-build` | builds | Get an Actor build's status. |  |
 | `get-actor-build-log` | builds | Retrieve the logs for a specific Actor build. |  |
+| `build-actor` | builds | Build an Actor version and wait a bounded time for the build to finish. |  |
 
 > **Note:**
 >
```

**File**: `src/const.ts` (modified, +1/-0)
```diff
@@ -40,6 +40,7 @@ export const SERVER_MODE_AUTO_DETECTION_ENABLED = true;
 export const SERVER_NAME = 'apify-mcp-server';
 export const SERVER_TITLE = 'Apify MCP Server';
 export const HELPER_TOOLS = {
+    ACTOR_BUILD: 'build-actor',
     ACTOR_BUILD_GET: 'get-actor-build',
     ACTOR_BUILD_LOG: 'get-actor-build-log',
     ACTOR_CALL: 'call-actor',
```

**File**: `src/mcp/tool_call_engine.ts` (modified, +2/-1)
```diff
@@ -30,11 +30,12 @@ import { buildToolCallErrorResult, TOOL_CALL_ERROR_KIND } from './tool_call_erro
 import type { ToolCallErrorResult } from './tool_call_error_mapper.js';
 import { dispatchToolCall } from './tool_dispatch.js';
 
-/** INTERNAL tools that wait synchronously and emit progress meanwhile: call-actor's start and wait, get-actor-run and get-actor-build with waitSecs > 0. */
+/** INTERNAL tools that wait synchronously and emit progress meanwhile: call-actor's start and wait, get-actor-run, get-actor-build and build-actor with waitSecs > 0. */
 const PROGRESS_TRACKER_INTERNAL_TOOLS = new Set<string>([
     HELPER_TOOLS.ACTOR_CALL,
     HELPER_TOOLS.ACTOR_RUNS_GET,
     HELPER_TOOLS.ACTOR_BUILD_GET,
+    HELPER_TOOLS.ACTOR_BUILD,
 ]);
 
 /** A pre-dispatch failure that the shell converts to v1's protocol-error sequence. */
```

**File**: `src/payments/const.ts` (modified, +1/-0)
```diff
@@ -24,6 +24,7 @@ export const SKYFIRE_ENABLED_TOOLS = new Set<HelperToolName>([
     HELPER_TOOLS.ACTOR_RUNS_ABORT,
     HELPER_TOOLS.ACTOR_BUILD_GET,
     HELPER_TOOLS.ACTOR_BUILD_LOG,
+    HELPER_TOOLS.ACTOR_BUILD,
     HELPER_TOOLS.DATASET_GET,
     HELPER_TOOLS.DATASET_GET_ITEMS,
     HELPER_TOOLS.DATASET_SCHEMA_GET,
```

**File**: `src/tools/AGENTS.md` (modified, +4/-2)
```diff
@@ -28,8 +28,10 @@ direct actor tools, `search-actors`, `fetch-actor-details`) is mode-agnostic.
   - `schedules/` — schedule create/get/update/delete for Actors and tasks; `schedule_helpers.ts`
     converts the flat action shape to the API shape and back, and reuses the id helpers from
     `tasks/task_helpers.ts`.
-  - `builds/` — `get-actor-build` (build status) and `get-actor-build-log` (build log tail);
-    `build_helpers.ts` holds the allowlisted build result shape and the by-status next-step text.
+  - `builds/` — `get-actor-build` (build status), `get-actor-build-log` (build log tail) and
+    `build-actor` (start a build of one version and wait for it); `build_helpers.ts` holds the
+    allowlisted build result shape, the build start and wait calls (the wait reports progress), the
+    shared `waitSecs` field, the shared build response and the by-status next-step text.
   - `docs/` — search and fetch Apify docs.
   - `dev/` — the `report-problem` tool for reporting a problem with a tool or Actor.
   - `widgets/` — the `*-widget` tool variants (apps mode only).
```

**File**: `src/tools/builds/build_actor.ts` (added, +110/-0)
```diff
@@ -0,0 +1,110 @@
+import { z } from 'zod';
+
+import { HELPER_TOOLS } from '../../const.js';
+import type { InternalToolArgs, ToolDescriptionContext, ToolEntry, ToolInputSchema } from '../../types.js';
+import { ALL_TOOLS_PRESENT, TOOL_TYPE } from '../../types.js';
+import { compileSchema, fixZodSchemaRequired } from '../../utils/ajv.js';
+import { getConsoleLinkContext } from '../../utils/console_link.js';
+import { respondAborted, respondUserError } from '../../utils/mcp.js';
+import { ABORT } from '../actors/actor_run_response.js';
+import { buildActorToolOutputSchema } from '../structured_output_schemas.js';
+import {
+    buildNextStepForBuild,
+    buildWaitSecsField,
+    listVersionNumbers,
+    respondWithBuild,
+    startBuild,
+    toBuildResult,
+} from './build_helpers.js';
+
+const buildActorArgs = z.object({
+    actor: z.string().min(1).describe('Actor ID or username/name'),
+    // Format is not enforced by a regex: AJV here drops `pattern`, and the lookup against the Actor's
+    // versions below rejects anything that is not an existing MAJOR.MINOR version with a soft fail.
+    versionNumber: z
+        .string()
+        .optional()
+        .describe('Version to build in MAJOR.MINOR form; defaults to the only version when the Actor has exactly one'),
+    tag: z.string().optional().describe('Build tag to assign, for example latest'),
+    useCache: z.boolean().default(true).describe('Reuse the Docker layer cache from the previous build'),
+    waitSecs: buildWaitSecsField('0 starts the build and returns right away.'),
+});
+
+function buildDescription({ hasTool }: ToolDescriptionContext): string {
+    return `Build an Actor version on the Apify platform and wait a bounded time for the build to finish.
+Returns the build (id, actorId, buildNumber, status, startedAt, finishedAt) and a summary with one next step.
+Use after the Actor's source changed so runs pick up the new code.${
+        hasTool(HELPER_TOOLS.ACTOR_BUILD_GET)
+            ? ` If the build is still running when the wait ends, check it with ${HELPER_TOOLS.ACTOR_BUILD_GET}.`
+            : ''
+    }
+
+USAGE:
+- Use to rebuild an Actor after changing its source.
+- Use to build a specific version and tag it, for example as latest.
+
+USAGE EXAMPLES:
+- user_input: Rebuild my-actor
+- user_input: Build version 0.2 of john/my-actor and tag it latest`;
+}
+
+/**
+ * https://docs.apify.com/api/v2/actors-builds-post
+ *  /v2/acts/{actorId}/builds
+ */
+export const buildActor: ToolEntry = Object.freeze({
+    type: TOOL_TYPE.INTERNAL,
+    name: HELPER_TOOLS.ACTOR_BUILD,
+    title: 'Build Actor',
+    description: buildDescription(ALL_TOOLS_PRESENT),
+    buildDescription,
+    // `fixZodSchemaRequired` strips `useCache` and `waitSecs` from `required` because they have defaults.
+    inputSchema: fixZodSchemaRequired(z.toJSONSchema(buildActorArgs)) as ToolInputSchema,
+    outputSchema: buildActorToolOutputSchema,
+    ajvValidate: compileSchema(z.toJSONSchema(buildActorArgs)),
+    paymentRequired: true,
+    annotations: {
+        title: 'Build Actor',
+        readOnlyHint: false,
+        // `tag` re-points an existing tag, `latest` included, to this build, which changes what runs by default.
+        destructiveHint: true,
+        idempotentHint: false,
+        openWorldHint: true,
+    },
+    call: async (toolArgs: InternalToolArgs) => {
+        const { args, apifyClient: client, apifyToken, loadedToolNames, signal, progressTracker } = toolArgs;
+        const parsed = buildActorArgs.parse(args);
+        const actor = await client.actor(parsed.actor).get();
+        if (!actor) {
+            return respondUserError(`Actor '${parsed.actor}' not found.`);
+        }
+        const versionNumbers = listVersionNumbers(actor);
+        if (versionNumbers.length === 0) {
+            return respondUserError(`Actor '${parsed.actor}' has no versions to build.`);
+        }
+        if (parsed.versionNumber !== undefined && !versionNumbers.includes(parsed.versionNumber)) {
+            return respondUserError(
+                `Actor '${parsed.actor}' has no version ${parsed.versionNumber}; available versions: ${versionNumbers.join(', ')}.`,
+            );
+        }
+        if (parsed.versionNumber === undefined && versionNumbers.length !== 1) {
+            return respondUserError(`Specify versionNumber; this Actor has versions: ${versionNumbers.join(', ')}.`);
+        }
+        const versionNumber = parsed.versionNumber ?? versionNumbers[0];
+        // Race the wait against the request signal so a cancelled call returns promptly instead of
+        // blocking up to `waitSecs`. Per MCP spec, receivers SHOULD NOT respond to a cancelled request.
+        const build = await startBuild(client, actor.id, versionNumber, {
+            tag: parsed.tag,
+            useCache: parsed.useCache,
+            waitSecs: parsed.waitSecs,
+            signal,
+            progressTracker,
+        });
+        if (build === AB
```

**File**: `src/tools/builds/build_helpers.ts` (modified, +62/-6)
```diff
@@ -1,17 +1,23 @@
-import type { Build } from 'apify-client';
+import type { Actor, ActorBuildOptions, Build } from 'apify-client';
 import { z } from 'zod';
 
 import type { ApifyClient } from '../../apify_client.js';
 import { HELPER_TOOLS } from '../../const.js';
 import type { ConsoleLinkContext } from '../../types.js';
 import { buildConsoleBuildUrl } from '../../utils/console_link.js';
+import { logHttpError } from '../../utils/logging.js';
 import type { ToolResponse } from '../../utils/mcp.js';
 import { respondOk } from '../../utils/mcp.js';
 import type { ProgressTracker } from '../../utils/progress.js';
 import { formatBuildStatusMessage, TERMINAL_RUN_STATUSES } from '../../utils/progress.js';
 import { ABORT, raceAbort, toIsoString, WAIT_SECS_MAX } from '../actors/actor_run_response.js';
 import { apifyConsoleLinkText } from '../storage/storage_helpers.js';
 
+/** The MAJOR.MINOR numbers of the Actor's versions; a version document without one is skipped. */
+export function listVersionNumbers(actor: Pick<Actor, 'versions'>): string[] {
+    return actor.versions.flatMap((version) => version.versionNumber ?? []);
+}
+
 /** The build tools wait this long by default, the same as `get-actor-run` and `call-actor`, so a loop of build and run calls behaves alike. */
 export const BUILD_WAIT_SECS_DEFAULT = 30;
 
@@ -50,17 +56,64 @@ export function toBuildResult(build: Build, linkContext: ConsoleLinkContext | un
     };
 }
 
+/**
+ * Aborts a build the tool started when the client cancels the request, the way `call-actor` aborts its
+ * run. Failures are logged and swallowed so a transient API error does not override the cancellation.
+ */
+async function abortBuildOnSignal(buildId: string, client: ApifyClient): Promise<void> {
+    await client
+        .build(buildId)
+        .abort()
+        .catch((error: unknown) => {
+            logHttpError(error, 'Error aborting Actor build', { buildId });
+        });
+}
+
+/**
+ * Starts a build of an Actor version and waits up to `waitSecs` for it to finish, reporting progress
+ * meanwhile. The wait is raced against `signal`; a cancelled request aborts the build it started and
+ * resolves to {@link ABORT}, so a build nobody waits for does not run on, the same as `call-actor`
+ * does with its run.
+ */
+export async function startBuild(
+    client: ApifyClient,
+    actorId: string,
+    versionNumber: string,
+    options: {
+        tag?: string;
+        useCache: boolean;
+        waitSecs: number;
+        signal?: AbortSignal;
+        progressTracker?: ProgressTracker | null;
+    },
+): Promise<Build | typeof ABORT> {
+    const { tag, useCache, waitSecs, signal, progressTracker } = options;
+    const started = await client
+        .actor(actorId)
+        .build(versionNumber, { ...(tag !== undefined && { tag }), useCache } satisfies ActorBuildOptions);
+    // The cancel can arrive while the start call is in flight; the build exists by then.
+    if (signal?.aborted) {
+        await abortBuildOnSignal(started.id, client);
+        return ABORT;
+    }
+    if (waitSecs === 0) return started;
+    const finished = await waitForBuild(client, started, { waitSecs, signal, progressTracker });
+    if (finished === ABORT) await abortBuildOnSignal(started.id, client);
+    return finished;
+}
+
 /**
  * The one next step after a build reaches `status`, shared by every tool that reports a build.
  * Sibling tools are named only when the session was served them (`loadedToolNames`), and each hint
- * keeps a fallback so the text is never a dead end. `nonTerminalNextStep` comes from the caller
- * because only the calling tool may name itself ("call this tool again").
+ * keeps a fallback so the text is never a dead end. A still-running build points at get-actor-build;
+ * only get-actor-build itself passes `nonTerminalNextStep`, because only the calling tool may name
+ * itself ("call this tool again").
  */
 export function buildNextStepForBuild(
     build: Pick<Build, 'id' | 'buildNumber' | 'status'>,
-    options: { loadedToolNames: readonly string[]; nonTerminalNextStep: string },
+    options: { loadedToolNames: readonly string[]; nonTerminalNextStep?: string },
 ): string {
-    const { loadedToolNames, nonTerminalNextStep } = options;
+    const { loadedToolNames } = options;
     if (build.status === 'SUCCEEDED') {
         return loadedToolNames.includes(HELPER_TOOLS.ACTOR_CALL)
             ? `Run the Actor with ${HELPER_TOOLS.ACTOR_CALL} and set callOptions.build to ${build.buildNumber}.`
@@ -71,7 +124,10 @@ export function buildNextStepForBuild(
             ? `Read the build log with ${HELPER_TOOLS.ACTOR_BUILD_LOG} using buildId ${build.id}; pass lines 0 for the whole log.`
             : 'Read the build log for the error, fix the source, and build again.';
     }
-    return nonTerminalNextStep;
+    if (options.nonTerminalNextStep !== undefined) return options.nonTerminalNextStep;
+    return loadedToolNames.includes(HELPER_TOOLS.ACTOR
```

**File**: `src/tools/registry.ts` (modified, +2/-1)
```diff
@@ -20,6 +20,7 @@ import { SERVER_MODE } from '../types.js';
 import { callActor } from './actors/call_actor.js';
 import { fetchActorDetails } from './actors/fetch_actor_details.js';
 import { searchActors } from './actors/search_actors.js';
+import { buildActor } from './builds/build_actor.js';
 import { getActorBuild } from './builds/get_actor_build.js';
 import { getActorBuildLog } from './builds/get_actor_build_log.js';
 import { reportProblem } from './dev/report_problem.js';
@@ -68,7 +69,7 @@ export const toolCategories = {
     ],
     tasks: [createActorTask, getActorTask, updateActorTask, publishActorTask, unpublishActorTask],
     schedules: [createSchedule, getSchedule, updateSchedule, deleteSchedule],
-    builds: [getActorBuild, getActorBuildLog],
+    builds: [getActorBuild, getActorBuildLog, buildActor],
     dev: [reportProblem],
 } satisfies Record<string, ToolEntry[]>;
 
```

---

### Incident Patch 7: `18d3a24b` (2026-09-22)
**Commit Message**: fix: state the new published task limits in publish-actor-task (#1404)

Part of apify/apify-core#30452.
The platform limits change in apify/apify-core#30442: 10 published tasks
per Actor (was 50) and a new limit of 100 published tasks per account.

The `publish-actor-task` tool description told agents "At most 50 tasks
can be published per Actor", which would make them retry into a 400.

Merge only after the apify-core change ships.

Co-authored-by: Claude Opus 5 (1M context) <[REDACTED_EMAIL]>

**File**: `src/tools/tasks/publish_actor_task.ts` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@ reliable, and specific use case. Not every saved task needs to be public.
 The task's Actor must be public and the task must have its public display configuration set up:
 at least \`publicConfig.inputSchemaFields\`, \`publicConfig.datasetView\`, and \`publicConfig.seoDescription\`. \
 If publishing fails, follow the API reason${hasTool(HELPER_TOOLS.ACTOR_TASK_UPDATE) ? `; update these fields with ${HELPER_TOOLS.ACTOR_TASK_UPDATE} only when the reason identifies them` : ''}.
-At most 50 tasks can be published per Actor.
+At most 10 tasks can be published per Actor, and at most 100 per account.
 Publishing an already published task has no effect.
 Requires write access to both the task and its Actor.
 ${hasTool(HELPER_TOOLS.ACTOR_TASK_UNPUBLISH) ? `Use ${HELPER_TOOLS.ACTOR_TASK_UNPUBLISH} to take the page down again.\n` : ''}
```

---

### Incident Patch 8: `3c1744bb` (2026-09-22)
**Commit Message**: feat: Add get-actor-build and get-actor-build-log tools (#1331)

**File**: `README.md` (modified, +3/-0)
```diff
@@ -248,6 +248,7 @@ Here are some special MCP operations and how the Apify MCP Server supports them:
 - **Apify storage**: Access data from your datasets and key-value stores.
 - **Actor tasks**: Create, inspect, and update your saved Actor tasks, and publish or unpublish their public landing pages.
 - **Schedules**: Create, inspect, update, and delete schedules that run your Actors and tasks automatically.
+- **Builds**: Check the status of an Actor build and retrieve its build log.
 
 ### Overview of available tools
 
@@ -289,6 +290,8 @@ Legend for the **Enabled by default** column:
 | `get-schedule` | schedules | Get a schedule, its cron expression, state, and the actions it runs. |  |
 | `update-schedule` | schedules | Update a schedule: cron expression, time zone, enabled state, or actions. |  |
 | `delete-schedule` | schedules | Delete a schedule. |  |
+| `get-actor-build` | builds | Get an Actor build's status. |  |
+| `get-actor-build-log` | builds | Retrieve the logs for a specific Actor build. |  |
 
 > **Note:**
 >
```

**File**: `src/const.ts` (modified, +2/-0)
```diff
@@ -40,6 +40,8 @@ export const SERVER_MODE_AUTO_DETECTION_ENABLED = true;
 export const SERVER_NAME = 'apify-mcp-server';
 export const SERVER_TITLE = 'Apify MCP Server';
 export const HELPER_TOOLS = {
+    ACTOR_BUILD_GET: 'get-actor-build',
+    ACTOR_BUILD_LOG: 'get-actor-build-log',
     ACTOR_CALL: 'call-actor',
     ACTOR_CALL_WIDGET: 'call-actor-widget',
     ACTOR_GET_DETAILS: 'fetch-actor-details',
```

**File**: `src/mcp/tool_call_engine.ts` (modified, +10/-5)
```diff
@@ -30,6 +30,13 @@ import { buildToolCallErrorResult, TOOL_CALL_ERROR_KIND } from './tool_call_erro
 import type { ToolCallErrorResult } from './tool_call_error_mapper.js';
 import { dispatchToolCall } from './tool_dispatch.js';
 
+/** INTERNAL tools that wait synchronously and emit progress meanwhile: call-actor's start and wait, get-actor-run and get-actor-build with waitSecs > 0. */
+const PROGRESS_TRACKER_INTERNAL_TOOLS = new Set<string>([
+    HELPER_TOOLS.ACTOR_CALL,
+    HELPER_TOOLS.ACTOR_RUNS_GET,
+    HELPER_TOOLS.ACTOR_BUILD_GET,
+]);
+
 /** A pre-dispatch failure that the shell converts to v1's protocol-error sequence. */
 export type InvalidToolCall = {
     message: string;
@@ -346,13 +353,11 @@ export async function executeSyncToolCall(
         };
     }
 
-    // Progress tracker: opt in for the two INTERNAL tools that emit during a sync wait
-    // (call-actor start+waitForFinish, get-actor-run when waitSecs > 0), and unconditionally
-    // for ACTOR tools. ACTOR_MCP forwards notifications directly, not via a tracker.
+    // Progress tracker: opt in for the INTERNAL tools that emit during a sync wait, and
+    // unconditionally for ACTOR tools. ACTOR_MCP forwards notifications directly, not via a tracker.
     const progressTrackerOptIn =
         tool.type === TOOL_TYPE.ACTOR ||
-        (tool.type === TOOL_TYPE.INTERNAL &&
-            (tool.name === HELPER_TOOLS.ACTOR_CALL || tool.name === HELPER_TOOLS.ACTOR_RUNS_GET));
+        (tool.type === TOOL_TYPE.INTERNAL && PROGRESS_TRACKER_INTERNAL_TOOLS.has(tool.name));
     const progressTracker = progressTrackerOptIn ? createProgressTracker(progressToken, sendNotification) : null;
 
     try {
```

**File**: `src/payments/const.ts` (modified, +3/-1)
```diff
@@ -15,13 +15,15 @@ export const SKYFIRE_README_CONTENT = `The Apify MCP Server allows clients to in
 
 /**
  * Set of internal tool names that require Skyfire PAY token ID in Skyfire mode.
- * These tools interact with Actor runs, datasets, or key-value stores and need billing support.
+ * These tools interact with Actor runs, builds, datasets, or key-value stores and need billing support.
  */
 export const SKYFIRE_ENABLED_TOOLS = new Set<HelperToolName>([
     HELPER_TOOLS.ACTOR_CALL,
     HELPER_TOOLS.ACTOR_RUNS_GET,
     HELPER_TOOLS.ACTOR_RUNS_LOG,
     HELPER_TOOLS.ACTOR_RUNS_ABORT,
+    HELPER_TOOLS.ACTOR_BUILD_GET,
+    HELPER_TOOLS.ACTOR_BUILD_LOG,
     HELPER_TOOLS.DATASET_GET,
     HELPER_TOOLS.DATASET_GET_ITEMS,
     HELPER_TOOLS.DATASET_SCHEMA_GET,
```

**File**: `src/tools/AGENTS.md` (modified, +2/-0)
```diff
@@ -28,6 +28,8 @@ direct actor tools, `search-actors`, `fetch-actor-details`) is mode-agnostic.
   - `schedules/` — schedule create/get/update/delete for Actors and tasks; `schedule_helpers.ts`
     converts the flat action shape to the API shape and back, and reuses the id helpers from
     `tasks/task_helpers.ts`.
+  - `builds/` — `get-actor-build` (build status) and `get-actor-build-log` (build log tail);
+    `build_helpers.ts` holds the allowlisted build result shape and the by-status next-step text.
   - `docs/` — search and fetch Apify docs.
   - `dev/` — the `report-problem` tool for reporting a problem with a tool or Actor.
   - `widgets/` — the `*-widget` tool variants (apps mode only).
```

**File**: `src/tools/actors/actor_run_response.ts` (modified, +5/-2)
```diff
@@ -44,13 +44,16 @@ const ITEM_COUNT_PROBE_LIMIT = 1;
 const ITEM_COUNT_PROBE_DELAYS_MS = [0, 1000, 2000, 2000] as const;
 
 /** Sentinel used by `raceAbort` to signal that the abort signal won the race. */
-const ABORT = Symbol('ABORT');
+export const ABORT = Symbol('ABORT');
 
 /**
  * Race a promise against an abort signal. Returns the resolved value, or {@link ABORT} if the
  * signal fires first. Cleans up its abort listener on either branch so callers never leak.
  */
-async function raceAbort<T>(promise: Promise<T>, abortSignal: AbortSignal | undefined): Promise<T | typeof ABORT> {
+export async function raceAbort<T>(
+    promise: Promise<T>,
+    abortSignal: AbortSignal | undefined,
+): Promise<T | typeof ABORT> {
     if (!abortSignal) return promise;
     // Already aborted: `addEventListener('abort', ...)` won't fire (the event has passed), so the
     // listener would never resolve and the race would block on `promise`.
```

**File**: `src/tools/builds/build_helpers.ts` (added, +126/-0)
```diff
@@ -0,0 +1,126 @@
+import type { Build } from 'apify-client';
+import { z } from 'zod';
+
+import type { ApifyClient } from '../../apify_client.js';
+import { HELPER_TOOLS } from '../../const.js';
+import type { ConsoleLinkContext } from '../../types.js';
+import { buildConsoleBuildUrl } from '../../utils/console_link.js';
+import type { ToolResponse } from '../../utils/mcp.js';
+import { respondOk } from '../../utils/mcp.js';
+import type { ProgressTracker } from '../../utils/progress.js';
+import { formatBuildStatusMessage, TERMINAL_RUN_STATUSES } from '../../utils/progress.js';
+import { ABORT, raceAbort, toIsoString, WAIT_SECS_MAX } from '../actors/actor_run_response.js';
+import { apifyConsoleLinkText } from '../storage/storage_helpers.js';
+
+/** The build tools wait this long by default, the same as `get-actor-run` and `call-actor`, so a loop of build and run calls behaves alike. */
+export const BUILD_WAIT_SECS_DEFAULT = 30;
+
+/**
+ * The `waitSecs` field shared by the tools that report a build, so they agree on the cap and the
+ * default. `zeroMeans` says what a caller gets back with 0: the current status, or a build just started.
+ */
+export function buildWaitSecsField(zeroMeans: string) {
+    return z
+        .number()
+        .int()
+        .min(0)
+        .max(WAIT_SECS_MAX)
+        .optional()
+        .default(BUILD_WAIT_SECS_DEFAULT)
+        .describe(
+            `Maximum seconds to wait for the build to reach a terminal state (SUCCEEDED, FAILED, ABORTED, TIMED-OUT). ${zeroMeans} Cap: ${WAIT_SECS_MAX}. Default: ${BUILD_WAIT_SECS_DEFAULT}.`,
+        );
+}
+
+/**
+ * The build subset returned by the build tools. Allowlisted so internal fields on the API
+ * document (userId, meta, options, inspectorId) never reach the client.
+ * `apifyConsoleUrl` is set only for Console UI token sessions (see `getConsoleLinkContext`).
+ */
+export function toBuildResult(build: Build, linkContext: ConsoleLinkContext | undefined) {
+    return {
+        id: build.id,
+        actorId: build.actId,
+        buildNumber: build.buildNumber,
+        status: build.status,
+        // Normalized because the client parses these into `Date` objects; the output schema promises strings.
+        startedAt: toIsoString(build.startedAt) ?? null,
+        finishedAt: toIsoString(build.finishedAt) ?? null,
+        apifyConsoleUrl: buildConsoleBuildUrl(linkContext, build.actId, build.buildNumber),
+    };
+}
+
+/**
+ * The one next step after a build reaches `status`, shared by every tool that reports a build.
+ * Sibling tools are named only when the session was served them (`loadedToolNames`), and each hint
+ * keeps a fallback so the text is never a dead end. `nonTerminalNextStep` comes from the caller
+ * because only the calling tool may name itself ("call this tool again").
+ */
+export function buildNextStepForBuild(
+    build: Pick<Build, 'id' | 'buildNumber' | 'status'>,
+    options: { loadedToolNames: readonly string[]; nonTerminalNextStep: string },
+): string {
+    const { loadedToolNames, nonTerminalNextStep } = options;
+    if (build.status === 'SUCCEEDED') {
+        return loadedToolNames.includes(HELPER_TOOLS.ACTOR_CALL)
+            ? `Run the Actor with ${HELPER_TOOLS.ACTOR_CALL} and set callOptions.build to ${build.buildNumber}.`
+            : `The Actor is ready to run with build ${build.buildNumber}.`;
+    }
+    if (TERMINAL_RUN_STATUSES.has(build.status)) {
+        return loadedToolNames.includes(HELPER_TOOLS.ACTOR_BUILD_LOG)
+            ? `Read the build log with ${HELPER_TOOLS.ACTOR_BUILD_LOG} using buildId ${build.id}; pass lines 0 for the whole log.`
+            : 'Read the build log for the error, fix the source, and build again.';
+    }
+    return nonTerminalNextStep;
+}
+
+/**
+ * The response every tool that reports a build returns: the JSON first, then the summary with
+ * its one next step, then the Console link when the session has one. Shared so the tools cannot drift
+ * in ordering or in how they treat the link.
+ */
+export function respondWithBuild(params: {
+    structuredContent: Record<string, unknown> & { build?: { apifyConsoleUrl?: string } };
+    summary: string;
+    nextStep: string;
+}): ToolResponse {
+    const { structuredContent, summary, nextStep } = params;
+    const consoleLinkText = apifyConsoleLinkText(structuredContent.build?.apifyConsoleUrl);
+    return respondOk(
+        [JSON.stringify(structuredContent), `${summary}\n${nextStep}`, ...(consoleLinkText ? [consoleLinkText] : [])],
+        { structuredContent },
+    );
+}
+
+/** The subject the progress notifications lead with, the same one the summary lines use. */
+function formatBuildLabel(build: Pick<Build, 'buildNumber' | 'actId'>): string {
+    return `Build ${build.buildNumber} of Actor ${build.actId}`;
+}
+
+/**
+ * Waits up to `waitSecs` for an unfinished build, emitting its status changes as progress notifications
+ * while it does, the way the run tools do; the wait is race
```

**File**: `src/tools/builds/get_actor_build.ts` (added, +84/-0)
```diff
@@ -0,0 +1,84 @@
+import { z } from 'zod';
+
+import { HELPER_TOOLS } from '../../const.js';
+import type { InternalToolArgs, ToolEntry, ToolInputSchema } from '../../types.js';
+import { TOOL_TYPE } from '../../types.js';
+import { compileSchema, fixZodSchemaRequired } from '../../utils/ajv.js';
+import { getConsoleLinkContext } from '../../utils/console_link.js';
+import { respondAborted, respondUserError } from '../../utils/mcp.js';
+import { TERMINAL_RUN_STATUSES } from '../../utils/progress.js';
+import { ABORT, raceAbort, WAIT_SECS_MAX } from '../actors/actor_run_response.js';
+import { getActorBuildToolOutputSchema } from '../structured_output_schemas.js';
+import {
+    BUILD_WAIT_SECS_DEFAULT,
+    buildNextStepForBuild,
+    buildWaitSecsField,
+    respondWithBuild,
+    toBuildResult,
+    waitForBuild,
+} from './build_helpers.js';
+
+const getActorBuildArgs = z.object({
+    buildId: z.string().min(1).describe('Build ID, as returned when a build is started'),
+    waitSecs: buildWaitSecsField('0 returns immediately with the current status.'),
+});
+
+/**
+ * https://docs.apify.com/api/v2/actor-build-get
+ *  /v2/actor-builds/{buildId}
+ */
+export const getActorBuild: ToolEntry = Object.freeze({
+    type: TOOL_TYPE.INTERNAL,
+    name: HELPER_TOOLS.ACTOR_BUILD_GET,
+    title: 'Get Actor build',
+    description: `Get the status of an Actor build.
+Read-only. Returns the build (id, actorId, buildNumber, status, startedAt, finishedAt)
+and a summary with one next step.
+- waitSecs (0–${WAIT_SECS_MAX}, default ${BUILD_WAIT_SECS_DEFAULT}) waits up to that many seconds for terminal status before returning.
+
+USAGE:
+- Use to check whether a build has finished and whether it succeeded.
+- Pass waitSecs > 0 to block until terminal (or until the cap elapses).
+
+USAGE EXAMPLES:
+- user_input: Did build 7aB3xYz9Kq finish?
+- user_input: Wait for build 7aB3xYz9Kq to finish`,
+    // `fixZodSchemaRequired` strips fields with a real `default` from `required` so MCP clients
+    // that read `tools/list` see `waitSecs` as optional (matching its runtime behavior).
+    inputSchema: fixZodSchemaRequired(z.toJSONSchema(getActorBuildArgs)) as ToolInputSchema,
+    outputSchema: getActorBuildToolOutputSchema,
+    ajvValidate: compileSchema(z.toJSONSchema(getActorBuildArgs)),
+    paymentRequired: true,
+    annotations: {
+        title: 'Get Actor build',
+        readOnlyHint: true,
+        destructiveHint: false,
+        idempotentHint: true,
+        openWorldHint: false,
+    },
+    call: async (toolArgs: InternalToolArgs) => {
+        const { args, apifyClient: client, apifyToken, loadedToolNames, signal, progressTracker } = toolArgs;
+        const parsed = getActorBuildArgs.parse(args);
+        // Fetched before any wait, like get-actor-run, so a finished build returns at once and an
+        // unfinished one seeds the progress notifications. Races are against the request signal so a
+        // cancelled call returns promptly; per MCP spec, receivers SHOULD NOT respond to a cancelled request.
+        const current = await raceAbort(client.build(parsed.buildId).get(), signal);
+        if (current === ABORT) return respondAborted();
+        if (!current) {
+            return respondUserError(`Build with ID '${parsed.buildId}' not found.`);
+        }
+        const build =
+            parsed.waitSecs > 0 && !TERMINAL_RUN_STATUSES.has(current.status)
+                ? await waitForBuild(client, current, { waitSecs: parsed.waitSecs, signal, progressTracker })
+                : current;
+        if (build === ABORT) return respondAborted();
+        const linkContext = await getConsoleLinkContext(apifyToken, client);
+        const structuredContent = { build: toBuildResult(build, linkContext) };
+        const summary = `Build ${build.buildNumber} of Actor ${build.actId} is ${build.status}.`;
+        const nextStep = buildNextStepForBuild(build, {
+            loadedToolNames,
+            nonTerminalNextStep: `Call this tool again with waitSecs ${WAIT_SECS_MAX} to keep waiting.`,
+        });
+        return respondWithBuild({ structuredContent, summary, nextStep });
+    },
+} as const);
```

---

### Incident Patch 9: `d88568c1` (2026-09-17)
**Commit Message**: fix(evals): Stop the add-action eval case editing the read-only fixture (#1384)

Fixes a case fault introduced in #1383. Needs a quick review: the
Langfuse half of this change is already live, so master is briefly
inconsistent until this merges.

## What was wrong

`merge/schedules/add-action-medium-1` added an Actor action to
`eval-nightly-sum`, which is the fixture the pure read cases assert on.
Items run 8 at a time against one account, so whether
`merge/schedules/get-easy-1` saw one action or two came down to which
item finished first.

It passed locally and failed on the first master run ([run
35014680476](https://github.com/apify/apify-mcp-server/actions/runs/35014680476),
60/70, above the 0.6 gate so the run was still green):

## Verification

Run locally against a live account, concurrency 8, `--subscription
--claude-judge`:

| Check | Result |
| --- | --- |
| `get-easy-1`, 3 trials | 3/3 |
| Whole schedules family, both cases in one concurrent run | 10/10 |

Only two cases now name `eval-nightly-sum` and both only read it.
`collision-hard-1` tries to create a duplicate of that name, and its
reference already fails any update or delete of it.

Co-authored-by: Claude Opus 5 

**File**: `evals/mcp_agent/README.md` (modified, +9/-2)
```diff
@@ -97,8 +97,15 @@ single red run, and blame a tool description only after checking the case still
 The schedules family (`merge/schedules/*`, 10 items: 7 proper + 3 with `expectedErrors`) covers the
 schedule tools: create for a task and for an Actor, cron and time-zone translation from user language,
 pausing, adding an action (an update replaces the whole list), deleting, a name collision, and a
-not-found read. It uses fixed `eval-sched-*` names plus one permanent, disabled fixture schedule
-`eval-nightly-sum` that runs the `eval-sum-nightly` task fixture. Run
+not-found read. It uses fixed `eval-sched-*` names plus two permanent, disabled fixture schedules that
+run the `eval-sum-nightly` task fixture: `eval-nightly-sum`, which the pure read cases assert on and no
+case may modify, and `eval-sched-target`, which the add-an-action case edits. They are separate because
+items run concurrently against one account — a case that edits the schedule a read case asserts on makes
+that read pass or fail depending on which item finished first. For the same reason,
+`merge/schedules/add-action-medium-1` is not safe under `--iterations N` above 1 unless you also pass
+`--concurrency 1`: its trials all edit `eval-sched-target`, so a trial can read the schedule after
+another trial has already added to it and get judged against a starting state that is no longer there.
+CI runs each item once, so this affects local repeat runs only. Run
 `pnpm run evals:mcp-agent:tasks-fixtures && pnpm run evals:mcp-agent:schedules-fixtures` before every
 run: the second script deletes leftover `eval-*` schedules and resets the fixture (disabled, `0 3 * * *`
 UTC, one task action), since an eval agent may have enabled it or replaced its actions. The fixture stays
```

**File**: `evals/mcp_agent/schedules_fixtures.ts` (modified, +35/-17)
```diff
@@ -24,14 +24,23 @@ sanitizeProcessEnv();
 /** Only schedules with this prefix are ever deleted. */
 const EVAL_SCHEDULE_PREFIX = 'eval-';
 
-/** Permanent read-only fixture, target of pure get-schedule cases. Never deleted, reset every run. */
-const FIXTURE_SCHEDULE_NAME = 'eval-nightly-sum';
-/** The task fixture seeded by `tasks_fixtures.ts`; the fixture schedule's only action. */
+/**
+ * Two permanent fixtures, both reset every run, neither ever deleted. They are separate because the
+ * items run concurrently against one account: a case that edits a schedule must not edit the one the
+ * pure read cases assert on, or the read fails depending on which item finished first.
+ */
+const FIXTURE_SCHEDULE_NAMES = {
+    /** Target of pure get-schedule cases. No case may modify it. */
+    readOnly: 'eval-nightly-sum',
+    /** Target of cases that add or replace actions. Reset to one task action every run. */
+    mutable: 'eval-sched-target',
+} as const;
+
+/** The task fixture seeded by `tasks_fixtures.ts`; the only action on both fixture schedules. */
 const FIXTURE_TASK_NAME = 'eval-sum-nightly';
+
 /** Disabled on purpose: an enabled fixture would start a run on the eval account every night. */
 const FIXTURE_SCHEDULE = {
-    title: 'Eval fixture (read-only)',
-    description: 'Permanent fixture for schedule-tool MCP agent evals. Do not modify or delete.',
     cronExpression: '0 3 * * *',
     timezone: 'UTC' as const,
     isEnabled: false,
@@ -72,10 +81,11 @@ async function main() {
     const schedules = [];
     for await (const schedule of client.schedules().list()) schedules.push(schedule);
 
-    let fixture;
+    const fixtureNames: string[] = Object.values(FIXTURE_SCHEDULE_NAMES);
+    const fixtures = new Map<string, string>();
     for (const schedule of schedules) {
-        if (schedule.name === FIXTURE_SCHEDULE_NAME) {
-            fixture = schedule;
+        if (fixtureNames.includes(schedule.name)) {
+            fixtures.set(schedule.name, schedule.id);
             continue;
         }
         if (schedule.name.startsWith(EVAL_SCHEDULE_PREFIX)) {
@@ -84,15 +94,23 @@ async function main() {
         }
     }
 
-    if (fixture) {
-        // Reset everything an eval agent may have changed: enabled state, cadence, actions.
-        if (!IS_DRY_RUN) await client.schedule(fixture.id).update({ ...FIXTURE_SCHEDULE, actions });
-        console.log(`♻️  ${DRY}Reset fixture schedule "${fixture.name}" (${fixture.id})`);
-    } else if (IS_DRY_RUN) {
-        console.log(`🌱 ${DRY}Created fixture schedule "${FIXTURE_SCHEDULE_NAME}"`);
-    } else {
-        const schedule = await client.schedules().create({ ...FIXTURE_SCHEDULE, name: FIXTURE_SCHEDULE_NAME, actions });
-        console.log(`🌱 Created fixture schedule "${schedule.name}" (${schedule.id})`);
+    for (const name of fixtureNames) {
+        const title = name === FIXTURE_SCHEDULE_NAMES.readOnly ? 'Eval fixture (read-only)' : 'Eval fixture (editable)';
+        const description = `Permanent fixture for schedule-tool MCP agent evals. Do not delete; ${
+            name === FIXTURE_SCHEDULE_NAMES.readOnly ? 'do not modify' : 'reset every run'
+        }.`;
+        const fields = { ...FIXTURE_SCHEDULE, title, description, actions };
+        const existingId = fixtures.get(name);
+        if (existingId) {
+            // Reset everything an eval agent may have changed: enabled state, cadence, actions.
+            if (!IS_DRY_RUN) await client.schedule(existingId).update(fields);
+            console.log(`♻️  ${DRY}Reset fixture schedule "${name}" (${existingId})`);
+        } else if (IS_DRY_RUN) {
+            console.log(`🌱 ${DRY}Created fixture schedule "${name}"`);
+        } else {
+            const schedule = await client.schedules().create({ ...fields, name });
+            console.log(`🌱 Created fixture schedule "${schedule.name}" (${schedule.id})`);
+        }
     }
 
     console.log(IS_DRY_RUN ? '✅ Dry run complete, nothing changed' : '✅ Schedule fixtures ready');
```

---

### Incident Patch 10: `bb123ff1` (2026-09-15)
**Commit Message**: chore(evals): Add schedule fixtures and wire the schedules eval family (#1383)

Follow-up to #1372. Eval coverage for the schedule tools.

The 20 test cases are already live in Langfuse: 10 tool-call cases in
`mcp-server-evals-pr`, 10 agent cases in `mcp-server-evals-merge`.

## What this adds

- `evals/mcp_agent/schedules_fixtures.ts` — deletes leftover `eval-*`
schedules, creates or resets the permanent fixture `eval-nightly-sum`
(disabled, `0 3 * * *`, one action running the `eval-sum-nightly` task).
Same shape as `tasks_fixtures.ts`. Run it after the task fixtures, since
it needs that task.
- `evals:mcp-agent:schedules-fixtures` in `package.json`.
- A seed step in `_evaluations.yaml`, merge tier only, after the task
fixtures step.
- A family paragraph in `evals/mcp_agent/README.md`.

## Calibration

Live account, `--subscription --claude-judge`.

| Tier | Model | Result |
| --- | --- | --- |
| pr, 10 cases | `claude-haiku-4-5` | 10/10 |
| merge, 10 cases | `claude-opus-5` | 10/10 |
| merge, 10 cases | `claude-haiku-4-5` | 10/10 |

Three test cases needed fixing during calibration. In each one the agent
behaved sensibly and my test expected the wrong thing, so the fix was to
the

**File**: `.github/workflows/_evaluations.yaml` (modified, +15/-0)
```diff
@@ -59,6 +59,12 @@ jobs:
                 env:
                     APIFY_TOKEN: ${{ secrets.APIFY_TOKEN }}
 
+            -   name: Seed schedule fixtures (merge tier only)
+                if: inputs.tier == 'merge'
+                run: pnpm run evals:mcp-agent:schedules-fixtures
+                env:
+                    APIFY_TOKEN: ${{ secrets.APIFY_TOKEN }}
+
             # Floor of three local runs was 0.93; a hosted runner measured 0.97 (111/115).
             # `--claude-judge` avoids the OpenRouter requirement; tool-call items are not judged.
             -   name: Run pr-tier evals
@@ -91,3 +97,12 @@ jobs:
                     APIFY_TOKEN: ${{ secrets.APIFY_TOKEN }}
                     OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
                     OPENROUTER_BASE_URL: ${{ secrets.OPENROUTER_BASE_URL }}
+
+            # The schedule cases leave enabled schedules behind, and an enabled schedule keeps firing
+            # on the eval account until something deletes it. Seeding at the start of the next run is
+            # too late, so tear them down here — `always()` so a failed or cancelled run still cleans up.
+            -   name: Tear down schedule fixtures (merge tier only)
+                if: always() && inputs.tier == 'merge'
+                run: pnpm run evals:mcp-agent:schedules-fixtures
+                env:
+                    APIFY_TOKEN: ${{ secrets.APIFY_TOKEN }}
```

**File**: `evals/mcp_agent/README.md` (modified, +16/-0)
```diff
@@ -94,6 +94,21 @@ Actor exactly retired that failure mode along with the 5/8 ratio, so re-measure
 run as a regression. The lesson that outlived it: treat a shift in the ratio as the signal rather than a
 single red run, and blame a tool description only after checking the case still passes on Sonnet.
 
+The schedules family (`merge/schedules/*`, 10 items: 7 proper + 3 with `expectedErrors`) covers the
+schedule tools: create for a task and for an Actor, cron and time-zone translation from user language,
+pausing, adding an action (an update replaces the whole list), deleting, a name collision, and a
+not-found read. It uses fixed `eval-sched-*` names plus one permanent, disabled fixture schedule
+`eval-nightly-sum` that runs the `eval-sum-nightly` task fixture. Run
+`pnpm run evals:mcp-agent:tasks-fixtures && pnpm run evals:mcp-agent:schedules-fixtures` before every
+run: the second script deletes leftover `eval-*` schedules and resets the fixture (disabled, `0 3 * * *`
+UTC, one task action), since an eval agent may have enabled it or replaced its actions. The fixture stays
+disabled on purpose; an enabled one would start a run on the eval account every night.
+
+Run `evals:mcp-agent:schedules-fixtures` again **after** a run as well. The create cases leave enabled
+schedules behind, and an enabled schedule keeps firing on the eval account until something deletes it —
+seeding at the start of the next run is too late. CI does this in a `Tear down schedule fixtures` step
+guarded by `always()`, so a failed or cancelled run still cleans up.
+
 The web-fetch family (`merge/web-fetch/*`, 11 items: 8 proper + 3 with `expectedErrors`) covers the
 `apify/web-fetch` default Actor tool: fetching, output formats, HTTP status reporting, tool
 selection among the defaults, and multi-fetch chains. They create no named account state, so
@@ -312,6 +327,7 @@ experiment-item-run     Langfuse SDK, holds the scores
 - `run_mcp_agent_evals.ts` - Main CLI entry
 - `export_dataset.ts` - Snapshot CLI entry (`pnpm run evals:mcp-agent:export-dataset`)
 - `tasks_fixtures.ts` - Task-suite fixture CLI entry (`pnpm run evals:mcp-agent:tasks-fixtures`)
+- `schedules_fixtures.ts` - Schedule-suite fixture CLI entry (`pnpm run evals:mcp-agent:schedules-fixtures`)
 - `dataset_snapshot_<dataset>.json` - Local export of a dataset, not read at runtime and gitignored
 
 ## Configuration
```

**File**: `evals/mcp_agent/schedules_fixtures.ts` (added, +101/-0)
```diff
@@ -0,0 +1,101 @@
+#!/usr/bin/env node
+/* eslint-disable no-console */
+/**
+ * Fixtures for the `merge/schedules/*` agent evals (schedule-tool cases).
+ *
+ * Deletes schedules named `eval-*` left behind by previous runs, except the one permanent
+ * read-only fixture schedule, which it creates if missing and resets otherwise (an eval agent
+ * may have enabled it or replaced its actions). Schedule names are unique per account, so the
+ * fixed-name create cases collide with leftovers on the next run without this.
+ *
+ * The fixture schedule runs the task fixture from `tasks_fixtures.ts`, so run that first:
+ *   pnpm run evals:mcp-agent:tasks-fixtures && pnpm run evals:mcp-agent:schedules-fixtures [--dry-run]
+ */
+
+import 'dotenv/config';
+
+import { ApifyClient, type ScheduleCreateOrUpdateData, ScheduleActions } from 'apify-client';
+
+import { findMissingEnvVars } from '../shared/config.js';
+import { sanitizeProcessEnv } from './config.js';
+
+sanitizeProcessEnv();
+
+/** Only schedules with this prefix are ever deleted. */
+const EVAL_SCHEDULE_PREFIX = 'eval-';
+
+/** Permanent read-only fixture, target of pure get-schedule cases. Never deleted, reset every run. */
+const FIXTURE_SCHEDULE_NAME = 'eval-nightly-sum';
+/** The task fixture seeded by `tasks_fixtures.ts`; the fixture schedule's only action. */
+const FIXTURE_TASK_NAME = 'eval-sum-nightly';
+/** Disabled on purpose: an enabled fixture would start a run on the eval account every night. */
+const FIXTURE_SCHEDULE = {
+    title: 'Eval fixture (read-only)',
+    description: 'Permanent fixture for schedule-tool MCP agent evals. Do not modify or delete.',
+    cronExpression: '0 3 * * *',
+    timezone: 'UTC' as const,
+    isEnabled: false,
+    isExclusive: true,
+};
+
+/** `--dry-run` prints what the run would change and writes nothing. */
+const IS_DRY_RUN = process.argv.includes('--dry-run');
+/** Marks every line of a dry run, so its output cannot be read as changes that happened. */
+const DRY = IS_DRY_RUN ? '[dry run] ' : '';
+
+async function main() {
+    const missing = findMissingEnvVars(['APIFY_TOKEN']);
+    if (missing.length > 0) {
+        console.error(`❌ Error: missing environment variable(s): ${missing.join(', ')}`);
+        process.exit(1);
+    }
+    const client = new ApifyClient({ token: process.env.APIFY_TOKEN });
+
+    // The deletes below hit whatever account APIFY_TOKEN points at, so name it first.
+    console.log(`👤 ${DRY}Account: ${(await client.user('me').get()).username ?? 'unknown'}`);
+
+    const fixtureTask = await client.task(`~${FIXTURE_TASK_NAME}`).get();
+    if (!fixtureTask) {
+        console.error(
+            `❌ Error: fixture task "${FIXTURE_TASK_NAME}" not found; run evals:mcp-agent:tasks-fixtures first`,
+        );
+        process.exit(1);
+    }
+    // Annotated, not inferred: an array literal widens `type` to the whole enum, which the
+    // client's discriminated action union rejects.
+    const actions: ScheduleCreateOrUpdateData['actions'] = [
+        { type: ScheduleActions.RunActorTask, actorTaskId: fixtureTask.id },
+    ];
+
+    // Read every page before deleting anything: offset paging skips entries when the
+    // collection shrinks underneath it, and a missed leftover fails the next run.
+    const schedules = [];
+    for await (const schedule of client.schedules().list()) schedules.push(schedule);
+
+    let fixture;
+    for (const schedule of schedules) {
+        if (schedule.name === FIXTURE_SCHEDULE_NAME) {
+            fixture = schedule;
+            continue;
+        }
+        if (schedule.name.startsWith(EVAL_SCHEDULE_PREFIX)) {
+            if (!IS_DRY_RUN) await client.schedule(schedule.id).delete();
+            console.log(`🗑️  ${DRY}Deleted leftover schedule "${schedule.name}" (${schedule.id})`);
+        }
+    }
+
+    if (fixture) {
+        // Reset everything an eval agent may have changed: enabled state, cadence, actions.
+        if (!IS_DRY_RUN) await client.schedule(fixture.id).update({ ...FIXTURE_SCHEDULE, actions });
+        console.log(`♻️  ${DRY}Reset fixture schedule "${fixture.name}" (${fixture.id})`);
+    } else if (IS_DRY_RUN) {
+        console.log(`🌱 ${DRY}Created fixture schedule "${FIXTURE_SCHEDULE_NAME}"`);
+    } else {
+        const schedule = await client.schedules().create({ ...FIXTURE_SCHEDULE, name: FIXTURE_SCHEDULE_NAME, actions });
+        console.log(`🌱 Created fixture schedule "${schedule.name}" (${schedule.id})`);
+    }
+
+    console.log(IS_DRY_RUN ? '✅ Dry run complete, nothing changed' : '✅ Schedule fixtures ready');
+}
+
+void main();
```

**File**: `package.json` (modified, +2/-1)
```diff
@@ -144,7 +144,8 @@
     "evals:run": "tsx evals/run_evaluation.ts",
     "evals:mcp-agent": "pnpm run build && tsx evals/mcp_agent/run_mcp_agent_evals.ts",
     "evals:mcp-agent:export-dataset": "tsx evals/mcp_agent/export_dataset.ts",
-    "evals:mcp-agent:tasks-fixtures": "tsx evals/mcp_agent/tasks_fixtures.ts"
+    "evals:mcp-agent:tasks-fixtures": "tsx evals/mcp_agent/tasks_fixtures.ts",
+    "evals:mcp-agent:schedules-fixtures": "tsx evals/mcp_agent/schedules_fixtures.ts"
   },
   "author": "Apify",
   "license": "MIT"
```

---

### Incident Patch 11: `a4dafc4a` (2026-09-11)
**Commit Message**: fix: Let explicit report-problem selection bypass the client blocklist (#1368)

## What

`report-problem` is hidden from Anthropic-named clients (`claude`,
`anthropic`, `local-agent-mode-apify` substring match on
`clientInfo.name`) regardless of whether the tool was explicitly
requested via `?tools=report-problem` (or `?tools=dev`, its sole
category). A new `isReportProblemExplicitlySelected` check bypasses the
client-name blocklist specifically when the tool was explicitly named —
telemetry-off and unknown-client-identity remain unconditional guards
either way. Session recovery (`loadToolsByName`) counts as explicit too,
since it can only restore tools the session was already legitimately
serving.

## Why

A Claude connector configuration that deliberately lists
`report-problem` in its pinned `?tools=` URL still silently lost the
tool for any real Claude client, since the blocklist applied
unconditionally. `?client=claude+connector` (a Segment attribution tag)
was never the gate — the real gate is `clientInfo.name` from the MCP
handshake, which the URL tag doesn't affect.

## Testing

`type-check`, `lint`, `format`, `check:agents`, full `test:unit` all
green (1682/1683, 1 pre-exis

**File**: `README.md` (modified, +1/-1)
```diff
@@ -255,7 +255,7 @@ Here is an overview list of all the tools provided by the Apify MCP Server.
 Legend for the **Enabled by default** column:
 - ✅ — in the default tool set.
 - ⚡ — auto-injected when `call-actor`, an Actor tool, or `get-actor-run` is present (which is true in the default configuration).
-- ✅¹ — served by default, but only when telemetry is enabled and the client is not withheld: Anthropic surfaces (Claude.ai / Claude Desktop / Claude Code) or `local-agent-mode-apify`. To disable, pass an explicit `tools=` list that omits it.
+- ✅¹ — served by default, but only when telemetry is enabled and the client is not withheld: Anthropic surfaces (Claude.ai / Claude Desktop / Claude Code) or `local-agent-mode-apify`. To disable, pass an explicit `tools=` list that omits it. Explicitly selecting it (`tools=report-problem` or `tools=dev`) serves it regardless of client — telemetry still must be enabled.
 
 | Tool name | Category | Description | Enabled by default |
 | :--- | :--- | :--- | :---: |
```

**File**: `src/const.ts` (modified, +1/-1)
```diff
@@ -85,7 +85,7 @@ export const RETIRED_SELECTOR_NAMES: ReadonlySet<string> = new Set(['add-actor',
  * connection on the 2025 path, per request on the 2026-07-28 one. Stateless `client-info` is
  * optional; a request declaring no client name matches no blocked substring and is served the tool
  * by policy. Substring matching covers new client builds without a maintained allowlist;
- * over-matching only hides an optional tool.
+ * over-matching only hides an optional tool. Bypassed by explicit `?tools=report-problem`/`dev`.
  */
 export const REPORT_PROBLEM_BLOCKED_CLIENTS: string[] = ['claude', 'anthropic', 'local-agent-mode-apify'];
 
```

**File**: `src/mcp/server.ts` (modified, +10/-6)
```diff
@@ -35,6 +35,7 @@ import { parseServerMode, resolveServerMode } from '../utils/server_mode.js';
 import {
     getActors,
     getToolsForServerMode,
+    isReportProblemExplicitlySelected,
     resolveToolNamesFromInput,
     toolNamesToInput,
 } from '../utils/tools_loader.js';
@@ -290,7 +291,8 @@ export class ActorsMcpServer implements LegacyMcpServerHost, StatelessMcpServerH
      *
      * `requestUrl`, when given, resolves cross-tool mentions from `?tools=`/`?actors=` with no fetch;
      * omit it for the same "everything but report-problem" fallback. `report-problem` is always
-     * excluded — its servability is per-request-identity-dependent, not derivable from the URL.
+     * excluded here even when explicitly selected — telemetry state (the other bypass guard) isn't
+     * known yet at `server/discover` time, only at request time.
      */
     public getStatelessServerInstructions(requestUrl?: string): string {
         const mode = resolveServerMode(this.serverModeOption, false);
@@ -351,10 +353,11 @@ export class ActorsMcpServer implements LegacyMcpServerHost, StatelessMcpServerH
      * report-problem unless servable for that view ({@link isReportProblemServable}). Load paths
      * and the initialize flush pass the instance's own {@link servingContext};
      * {@link createRequestSnapshot} passes a view derived from one stateless request.
+     * An explicit opt-in in `source.input` applies to every request reusing this retained source.
      */
     private composeToolsForClient(source: ToolSource, view: ServingContext): ToolEntry[] {
         const tools = getToolsForServerMode(source.input, source.actorTools, view.serverMode);
-        if (this.isReportProblemServable(view)) return tools;
+        if (this.isReportProblemServable(view, source.input)) return tools;
         return tools.filter((tool) => tool.name !== HELPER_TOOLS.PROBLEM_REPORT);
     }
 
@@ -363,14 +366,15 @@ export class ActorsMcpServer implements LegacyMcpServerHost, StatelessMcpServerH
      * would vanish into the void) and never before a client context exists — on a stateful
      * connection the initialize flush re-adds it once the handshake supplies one.
      *
+     * Explicit selection ({@link isReportProblemExplicitlySelected}) bypasses the blocklist only.
+     *
      * The stateless envelope requires protocol and capability metadata but not `clientInfo`. A
      * request declaring no client name matches no blocked substring and is served the tool by
      * policy.
      */
-    private isReportProblemServable(view: ServingContext): boolean {
-        return (
-            this.telemetryEnabled && view.clientContext != null && !isReportProblemBlockedForClient(view.clientContext)
-        );
+    private isReportProblemServable(view: ServingContext, input: Input): boolean {
+        if (!this.telemetryEnabled || view.clientContext == null) return false;
+        return isReportProblemExplicitlySelected(input) || !isReportProblemBlockedForClient(view.clientContext);
     }
 
     private composePendingToolsForClient(): void {
```

**File**: `src/utils/tools_loader.ts` (modified, +12/-0)
```diff
@@ -83,6 +83,18 @@ function normalizeInput(input: Input): NormalizedInput {
     };
 }
 
+/** report-problem's only category — selecting it is the same opt-in as the literal name. */
+const REPORT_PROBLEM_CATEGORY = 'dev' satisfies ToolCategory;
+
+/**
+ * True when `input` explicitly names report-problem or `dev` — lifts the client blocklist below.
+ * A `toolNamesToInput` restore counts: it can only list tools the session was already served.
+ */
+export function isReportProblemExplicitlySelected(input: Input): boolean {
+    const { selectors } = normalizeInput(input);
+    return selectors?.some((sel) => sel === HELPER_TOOLS.PROBLEM_REPORT || sel === REPORT_PROBLEM_CATEGORY) ?? false;
+}
+
 /**
  * Resolve the list of Actor names (`username/name`) to fetch from the input.
  *
```

**File**: `tests/test_kit/cases/registration.cases.ts` (modified, +2/-0)
```diff
@@ -65,9 +65,11 @@ const CLAUDE_CONNECTOR_EXPECTED_TOOL_NAMES = CLAUDE_CONNECTOR_TOOLS.map((selecto
     selector.includes('/') ? actorNameToToolName(selector) : selector,
 );
 // telemetry: true is explicit — the deployed target defaults it off, unlike this package's own default.
+// clientName: real Claude handshake name — exercises the blocklist bypass (client= URL tag doesn't gate it).
 const CLAUDE_CONNECTOR_CLIENT_OPTIONS: SuiteClientOptions = {
     tools: CLAUDE_CONNECTOR_TOOLS,
     client: 'claude connector',
+    clientName: 'claude-ai',
     telemetry: { enabled: true },
 };
 
```

**File**: `tests/unit/mcp.server.report_problem_gating.test.ts` (modified, +22/-8)
```diff
@@ -1,12 +1,20 @@
 import { InMemoryTaskStore } from '@modelcontextprotocol/sdk/experimental/tasks/stores/in-memory.js';
 import type { InitializeRequest } from '@modelcontextprotocol/sdk/types.js';
-import { afterEach, describe, expect, it } from 'vitest';
+import { afterEach, describe, expect, it, vi } from 'vitest';
 
 import { HELPER_TOOLS } from '../../src/const.js';
 import { ActorsMcpServer } from '../../src/mcp/server.js';
 import { SERVER_MODE } from '../../src/types.js';
+import type * as ToolsLoaderModule from '../../src/utils/tools_loader.js';
 import { getLegacyServer } from './helpers/mcp_server.js';
 
+// Stub getActors so default-injection seeding needs no network.
+// Default-resolves to [] so tests that never call loadReportProblemByDefault still get a valid array.
+vi.mock('../../src/utils/tools_loader.js', async (importOriginal) => {
+    const actual = await importOriginal<typeof ToolsLoaderModule>();
+    return { ...actual, getActors: vi.fn().mockResolvedValue([]) };
+});
+
 type InitHandler = (req: InitializeRequest, ctx: unknown) => Promise<unknown>;
 
 function makeServer(telemetryEnabled = true, initializeRequestData?: InitializeRequest): ActorsMcpServer {
@@ -42,12 +50,16 @@ async function dispatchInitialize(server: ActorsMcpServer, clientName: string):
     await handler(makeInitializeRequest(clientName), {});
 }
 
-// report-problem carries no actor name, so getActors short-circuits and never touches the client —
-// this drives the real compose path (getToolsForServerMode + blocklist filter) without any network.
+// Restoring by name is explicit (toolNamesToInput builds {tools:[...]}) — bypasses the blocklist.
 async function loadReportProblemByName(server: ActorsMcpServer): Promise<void> {
     await server.loadToolsByName([HELPER_TOOLS.PROBLEM_REPORT], {} as never);
 }
 
+// Default (no tools=) injection — not an explicit opt-in, so the client blocklist still applies.
+async function loadReportProblemByDefault(server: ActorsMcpServer): Promise<void> {
+    await server.loadToolsFromInput({}, {} as never);
+}
+
 describe('report-problem client gating', () => {
     const servers: ActorsMcpServer[] = [];
 
@@ -66,8 +78,8 @@ describe('report-problem client gating', () => {
 
     it('hides report-problem from an Anthropic client when composed before initialize', async () => {
         const server = track(makeServer());
-        // Fixed mode: tools are requested before the client is known — they must wait for initialize.
-        await loadReportProblemByName(server);
+        // Default (non-explicit) seeding — blocklist still applies.
+        await loadReportProblemByDefault(server);
         expect(server.tools.has(HELPER_TOOLS.PROBLEM_REPORT)).toBe(false);
 
         await dispatchInitialize(server, 'claude-ai');
@@ -84,13 +96,14 @@ describe('report-problem client gating', () => {
         expect(server.tools.has(HELPER_TOOLS.PROBLEM_REPORT)).toBe(true);
     });
 
-    it('hides report-problem from an Anthropic client loaded after initialize (recovery path)', async () => {
+    it('serves report-problem to an Anthropic client restored after initialize (recovery path)', async () => {
+        // Recovery counts as explicit — the session already had this tool.
         const server = track(makeServer());
         await dispatchInitialize(server, 'claude-ai');
 
         await loadReportProblemByName(server);
 
-        expect(server.tools.has(HELPER_TOOLS.PROBLEM_REPORT)).toBe(false);
+        expect(server.tools.has(HELPER_TOOLS.PROBLEM_REPORT)).toBe(true);
     });
 
     it('serves report-problem to a non-Anthropic client loaded after initialize', async () => {
@@ -102,9 +115,10 @@ describe('report-problem client gating', () => {
         expect(server.tools.has(HELPER_TOOLS.PROBLEM_REPORT)).toBe(true);
     });
 
+    // Recovery is explicit — same reasoning as above.
     it.each([
         { clientName: 'test-client', isAvailable: true },
-        { clientName: 'claude-ai', isAvailable: false },
+        { clientName: 'claude-ai', isAvailable: true },
     ])(
         'uses constructor recovery data for client gating: $clientName available=$isAvailable',
         async ({ clientName, isAvailable }) => {
```

**File**: `tests/unit/mcp.stateless.request_context.test.ts` (modified, +18/-5)
```diff
@@ -292,10 +292,11 @@ describe('createStatelessServer() request context', () => {
             );
         });
 
-        it('hides report-problem from a blocklisted client', async () => {
+        it('hides report-problem from a blocklisted client when served via default injection (not explicit)', async () => {
             await withStatelessServer(
                 async ({ server, call }) => {
-                    await loadSource(server, [], { tools: [HELPER_TOOLS.PROBLEM_REPORT] });
+                    // Default (no tools=) injection, not an explicit opt-in — the blocklist applies.
+                    await loadSource(server, [], {});
 
                     const response = await call('tools/list', {}, { client: { name: 'claude-ai' } });
 
@@ -305,6 +306,19 @@ describe('createStatelessServer() request context', () => {
             );
         });
 
+        it('serves report-problem to a blocklisted client when explicitly selected via tools=', async () => {
+            await withStatelessServer(
+                async ({ server, call }) => {
+                    await loadSource(server, [], { tools: [HELPER_TOOLS.PROBLEM_REPORT] });
+
+                    const response = await call('tools/list', {}, { client: { name: 'claude-ai' } });
+
+                    expect(toolNames(response.result)).toContain(HELPER_TOOLS.PROBLEM_REPORT);
+                },
+                { telemetry: { enabled: true } },
+            );
+        });
+
         // `client-info` is optional in the stateless envelope. A request declaring no client name
         // matches no blocked substring and is served the tool by policy.
         it('serves report-problem to a request whose envelope declares no client', async () => {
@@ -437,9 +451,8 @@ describe('createStatelessServer() request context', () => {
         it('resolves each concurrent request from its own declared identity only', async () => {
             await withStatelessServer(
                 async ({ server, call }) => {
-                    await loadSource(server, [], {
-                        tools: [HELPER_TOOLS.STORE_SEARCH, HELPER_TOOLS.PROBLEM_REPORT],
-                    });
+                    // Default injection, not explicit — blocklist still applies here.
+                    await loadSource(server, [], {});
 
                     const [uiClient, blockedClient] = await Promise.all([
                         call('tools/list', {}, { client: { name: 'ui-client', supportsUi: true } }),
```

**File**: `tests/unit/utils.tools_loader.test.ts` (modified, +27/-0)
```diff
@@ -7,13 +7,40 @@ import { TOOL_TYPE } from '../../src/types.js';
 import {
     AUTO_INJECTED_TOOLS,
     getToolsForServerMode,
+    isReportProblemExplicitlySelected,
     loadToolsFromInput,
     resolveToolNamesFromInput,
     toolNamesToInput,
 } from '../../src/utils/tools_loader.js';
 
 const AUTO_INJECTED_TOOL_NAMES = AUTO_INJECTED_TOOLS.map((t) => t.name);
 
+describe('isReportProblemExplicitlySelected()', () => {
+    it('is true for the literal tool name', () => {
+        expect(isReportProblemExplicitlySelected({ tools: [HELPER_TOOLS.PROBLEM_REPORT] })).toBe(true);
+    });
+
+    it('is true for the tool name given as a plain string (not an array)', () => {
+        expect(isReportProblemExplicitlySelected({ tools: HELPER_TOOLS.PROBLEM_REPORT })).toBe(true);
+    });
+
+    it('is true for the dev category, its only member', () => {
+        expect(isReportProblemExplicitlySelected({ tools: ['dev'] })).toBe(true);
+    });
+
+    it('is false for an un-split comma-joined string — selector composition never sees it as one name', () => {
+        expect(isReportProblemExplicitlySelected({ tools: 'storage,report-problem' })).toBe(false);
+    });
+
+    it('is false when tools is absent (default injection, not an explicit opt-in)', () => {
+        expect(isReportProblemExplicitlySelected({})).toBe(false);
+    });
+
+    it('is false for an unrelated selector', () => {
+        expect(isReportProblemExplicitlySelected({ tools: ['actors'] })).toBe(false);
+    });
+});
+
 describe('loadToolsFromInput explicit-empty semantics', () => {
     const apifyClient = new ApifyClient({ token: 'test-token' });
 
```

---

### Incident Patch 12: `63557245` (2026-09-10)
**Commit Message**: fix: Stop pairing call-actor-widget and get-actor-run-widget (#1357)

Stacked on #1344, which is stacked on #1327, which is stacked on #1326,
which is stacked on #1334 — base branch is #1344's, not master; diff
here is just this PR's own commits.

## What

`WIDGET_BY_BASE_TOOL` no longer auto-pairs `call-actor`/`get-actor-run`
with `call-actor-widget`/`get-actor-run-widget`. Only
`search-actors`/`fetch-actor-details` keep auto-pairing.

Both dropped widgets stay fully selectable standalone via
`?tools=call-actor-widget` / `?tools=get-actor-run-widget` — widget tool
implementations, the shared React bundle, and the
`ui://widget/actor-run.html` resource are untouched; only automatic
pairing goes away.

- New `ALL_WIDGET_TOOLS` (`tools/registry.ts`) splits the map's two
overloaded jobs apart: it now sources `?tools=` name classification and
direct selection (all 4 widgets), while `WIDGET_BY_BASE_TOOL` (2
entries) stays sole source for auto-pairing. Trimming the shared map to
2 entries earlier had silently broken classification too —
`?tools=call-actor-widget` was misclassified as an Actor ID and
triggered a live 404 API lookup.
- Auto-injected run-workflow helpers (`get-dataset-items`

**File**: `src/tools/actors/call_actor.ts` (modified, +29/-48)
```diff
@@ -112,16 +112,19 @@ function buildCallFailureRecoveryHint(loadedToolNames: readonly string[]): strin
     return hints.length ? `You can ${hints.join(', or ')}.` : '';
 }
 
-// call-actor-widget needs no hasTool gate: apps mode appends it whenever call-actor is served.
+// call-actor-widget is not auto-paired (see WIDGET_BY_BASE_TOOL) but stays directly selectable via
+// ?tools=call-actor-widget — gate strictly on its own presence, never on apps mode alone.
 function buildWidgetAddendum({ hasTool }: ToolDescriptionContext): string {
+    // Requires both search-actors and its widget — avoids naming the widget off the base tool alone.
+    const hasSearchPair = hasTool(HELPER_TOOLS.STORE_SEARCH) && hasTool(HELPER_TOOLS.STORE_SEARCH_WIDGET);
     return dedent`
         WIDGET ALTERNATIVE (apps mode):
         - If the user explicitly asks to see live progress, call ${HELPER_TOOLS.ACTOR_CALL_WIDGET} instead — it renders an interactive UI that tracks the run.
-        ${hasTool(HELPER_TOOLS.STORE_SEARCH) ? `- For silent name resolution before this call, use ${HELPER_TOOLS.STORE_SEARCH} (not ${HELPER_TOOLS.STORE_SEARCH_WIDGET}, which renders UI).` : ''}
+        ${hasSearchPair ? `- For silent name resolution before this call, use ${HELPER_TOOLS.STORE_SEARCH} (not ${HELPER_TOOLS.STORE_SEARCH_WIDGET}, which renders UI).` : ''}
     `;
 }
 
-function buildCallActorDescriptionSections(includeWidget: boolean, ctx: ToolDescriptionContext): string {
+export function buildCallActorDescription(ctx: ToolDescriptionContext = ALL_TOOLS_PRESENT): string {
     const { hasTool } = ctx;
     const workflowSection = [
         'WORKFLOW:',
@@ -155,19 +158,11 @@ function buildCallActorDescriptionSections(includeWidget: boolean, ctx: ToolDesc
         CALL_ACTOR_EXAMPLES_SECTION,
     ];
 
-    if (includeWidget) sections.push(buildWidgetAddendum(ctx));
+    if (hasTool(HELPER_TOOLS.ACTOR_CALL_WIDGET)) sections.push(buildWidgetAddendum(ctx));
 
     return sections.join('\n\n');
 }
 
-export function buildCallActorDescription(ctx: ToolDescriptionContext = ALL_TOOLS_PRESENT): string {
-    return buildCallActorDescriptionSections(false, ctx);
-}
-
-export function buildCallActorAppsDescription(ctx: ToolDescriptionContext = ALL_TOOLS_PRESENT): string {
-    return buildCallActorDescriptionSections(true, ctx);
-}
-
 /**
  * Rejection for an Actor whose standby configuration `call-actor` cannot serve. softFail, not
  * logHttpError: the caller asked for an Actor we cannot expose, so this is a client fault and
@@ -724,40 +719,26 @@ export async function executeCallActor(toolArgs: InternalToolArgs): Promise<Tool
     }
 }
 
-/**
- * Single call-actor definition shared by both modes — only the description differs
- * (apps mode appends a widget addendum).
- */
-function createCallActorTool(buildDescription: (ctx: ToolDescriptionContext) => string): ToolEntry {
-    return Object.freeze({
-        type: TOOL_TYPE.INTERNAL,
-        name: HELPER_TOOLS.ACTOR_CALL,
+/** Mode-agnostic — the widget addendum renders only when call-actor-widget is actually in this session (`hasTool`), not from a mode check. */
+export const callActor: ToolEntry = Object.freeze({
+    type: TOOL_TYPE.INTERNAL,
+    name: HELPER_TOOLS.ACTOR_CALL,
+    title: 'Call Actor',
+    description: buildCallActorDescription(ALL_TOOLS_PRESENT),
+    buildDescription: buildCallActorDescription,
+    inputSchema: callActorInputSchema,
+    outputSchema: actorRunOutputSchema,
+    ajvValidate: callActorAjvValidate,
+    paymentRequired: true,
+    annotations: {
         title: 'Call Actor',
-        description: buildDescription(ALL_TOOLS_PRESENT),
-        buildDescription,
-        inputSchema: callActorInputSchema,
-        outputSchema: actorRunOutputSchema,
-        ajvValidate: callActorAjvValidate,
-        paymentRequired: true,
-        annotations: {
-            title: 'Call Actor',
-            readOnlyHint: false,
-            destructiveHint: true,
-            idempotentHint: false,
-            openWorldHint: true,
-        },
-        execution: {
-            taskSupport: 'optional',
-        },
-        call: async (toolArgs: InternalToolArgs) => executeCallActor(toolArgs),
-    } as const);
-}
-
-/** Default mode call-actor tool. */
-export const callActorDefault: ToolEntry = createCallActorTool(buildCallActorDescription);
-
-/**
- * Apps mode call-actor tool.
- * Renders no widget; for a live progress UI, use the call-actor-widget sibling.
- */
-export const callActorApps: ToolEntry = createCallActorTool(buildCallActorAppsDescription);
+        readOnlyHint: false,
+        destructiveHint: true,
+        idempotentHint: false,
+        openWorldHint: true,
+    },
+    execution: {
+        taskSupport: 'optional',
+    },
+    call: async (toolArgs: InternalToolArgs) => executeCallActor(toolArgs),
+} as const);
```

**File**: `src/tools/registry.ts` (modified, +19/-74)
```diff
@@ -8,11 +8,6 @@
  * The final tool ordering presented to MCP clients is determined by tools-loader.ts,
  * which also auto-injects run/storage tools (AUTO_INJECTED_TOOLS) right after call-actor.
  *
- * Each tool entry can be:
- * - A plain ToolEntry — mode-independent, always included
- * - A mode map (e.g. { default: ToolEntry, apps: ToolEntry }) — resolver picks entry[mode]
- * - A partial mode map (e.g. { apps: ToolEntry }) — included only for listed modes
- *
  * Apps vs default mode invariant:
  * Only `*-widget` tools differ between modes — they live in `tools/widgets/` and render an
  * interactive UI element. All non-widget tools (`call-actor`, `get-actor-run`, direct actor
@@ -22,7 +17,7 @@
 import { HELPER_TOOLS, type HelperToolName } from '../const.js';
 import type { ToolEntry } from '../types.js';
 import { SERVER_MODE } from '../types.js';
-import { callActorApps, callActorDefault } from './actors/call_actor.js';
+import { callActor } from './actors/call_actor.js';
 import { fetchActorDetails } from './actors/fetch_actor_details.js';
 import { searchActors } from './actors/search_actors.js';
 import { reportProblem } from './dev/report_problem.js';
@@ -50,31 +45,9 @@ import { fetchActorDetailsWidget } from './widgets/fetch_actor_details_widget.js
 import { getActorRunWidget } from './widgets/get_actor_run_widget.js';
 import { searchActorsWidget } from './widgets/search_actors_widget.js';
 
-type ModeMap = Partial<Record<SERVER_MODE, ToolEntry>>;
-
-/** A category tool entry: plain ToolEntry (mode-independent) or a mode map. */
-type CategoryToolEntry = ToolEntry | ModeMap;
-
-/** A plain ToolEntry always has a `name` property; mode maps never do. */
-function isModeMap(entry: CategoryToolEntry): entry is ModeMap {
-    return !('name' in entry);
-}
-
-/**
- * Unified tool category definitions — single source of truth.
- *
- * Each entry is either a plain ToolEntry (mode-independent) or a mode map
- * with SERVER_MODE keys mapping to their ToolEntry variant.
- *
- * Use {@link getCategoryTools} to resolve entries into concrete ToolEntry arrays for a given mode.
- */
+/** Unified tool category definitions — single source of truth. */
 export const toolCategories = {
-    actors: [
-        searchActors,
-        fetchActorDetails,
-        // call-actor is identical between modes; apps mode appends a widget addendum to the description.
-        { default: callActorDefault, apps: callActorApps },
-    ],
+    actors: [searchActors, fetchActorDetails, callActor],
     docs: [searchApifyDocs, fetchApifyDocs],
     runs: [getActorRun, getActorRunList, getActorRunLog, abortActorRun],
     storage: [
@@ -89,7 +62,7 @@ export const toolCategories = {
     ],
     tasks: [createActorTask, getActorTask, updateActorTask, publishActorTask, unpublishActorTask],
     dev: [reportProblem],
-} satisfies Record<string, CategoryToolEntry[]>;
+} satisfies Record<string, ToolEntry[]>;
 
 /**
  * Canonical list of all tool category names, derived from toolCategories keys.
@@ -102,57 +75,29 @@ export const CATEGORY_NAME_SET: ReadonlySet<string> = new Set<string>(CATEGORY_N
 /** Map from category name to an array of resolved tool entries. */
 export type ToolCategoryMap = Record<(typeof CATEGORY_NAMES)[number], ToolEntry[]>;
 
-/**
- * Resolve a single category's tool entries for the given server mode.
- *
- * For each entry:
- * - Plain ToolEntry (has `name`) → always included, mode-independent
- * - ModeMap → look up `entry[mode]`; included only if the mode key exists
- */
-function resolveCategoryEntries(entries: readonly CategoryToolEntry[], mode: SERVER_MODE): ToolEntry[] {
-    const result: ToolEntry[] = [];
-    for (const entry of entries) {
-        if (isModeMap(entry)) {
-            const tool = entry[mode];
-            if (tool) {
-                result.push(tool);
-            }
-        } else {
-            result.push(entry);
-        }
-    }
-    return result;
-}
-
-/**
- * Resolve tool categories for a given server mode.
- *
- * Returns mode-resolved tool variants: apps mode gets MCP-Apps-specific implementations
- * (async execution, widget metadata), default mode gets standard implementations.
- * Apps-only tools are excluded in default mode.
- *
- * @param mode - Optional. Use `'default'` or `'apps'`. Defaults to `SERVER_MODE.DEFAULT` when omitted.
- */
-export function getCategoryTools(mode: SERVER_MODE = SERVER_MODE.DEFAULT): ToolCategoryMap {
-    return Object.fromEntries(
-        CATEGORY_NAMES.map((name) => [name, resolveCategoryEntries(toolCategories[name], mode)]),
-    ) as ToolCategoryMap;
+/** Fresh copy of every category's tools. `mode` is unused (no category tool varies by mode) but stays in the `internals.js` signature. */
+export function getCategoryTools(_mode: SERVER_MODE = SERVER_MODE.DEFAULT): ToolCategoryMap {
+    return Object.fromEntries(CATEGORY_NAMES.map((name) => [name, [...toolCategories[name]]])) as ToolCategoryMap;
 }
 
 export const toolCategoriesEnabledByD
```

**File**: `src/utils/server-instructions/index.ts` (modified, +80/-24)
```diff
@@ -1,10 +1,11 @@
 /**
  * Server instructions — mode-aware text served to clients.
  *
- * Apps-only sections (widget workflow, widget tool disambiguation) are included
- * only when the resolved server mode is `'apps'`. Default-mode clients never
- * see widget tool names like `search-actors-widget` or `fetch-actor-details-widget`,
- * avoiding hallucinated calls to tools absent from `tools/list`.
+ * Widget-related sections render only when the specific widget they name is actually in this
+ * session's tools/list — never from apps mode alone, never from the base tool's presence alone.
+ * Widget pairing with a base tool is optional (see `WIDGET_BY_BASE_TOOL` in `tools/registry.ts`):
+ * a widget can be loaded standalone via explicit `?tools=`, so every clause here is gated on the
+ * exact tool name it mentions.
  */
 
 import { getApifyAPIBaseUrl } from '../../apify_client.js';
@@ -17,6 +18,48 @@ import { ALL_TOOLS_PRESENT, SERVER_MODE } from '../../types.js';
 const RAG_WEB_BROWSER_TOOL = actorNameToToolName(RAG_WEB_BROWSER);
 const WEB_FETCH_TOOL = actorNameToToolName(WEB_FETCH);
 
+const asCodeList = (names: string[]): string => names.map((n) => `\`${n}\``).join(' or ');
+
+/**
+ * Apps-mode widget workflow section. call-actor-widget/get-actor-run-widget are not auto-paired
+ * with their base tool, so every name is gated on its own presence. Empty when there is nothing
+ * actionable to say (e.g. call-actor-widget alone).
+ */
+function buildWidgetWorkflowSection({
+    hasCall,
+    hasRunsGet,
+    hasCallWidget,
+    hasRunsGetWidget,
+}: Record<'hasCall' | 'hasRunsGet' | 'hasCallWidget' | 'hasRunsGetWidget', boolean>): string {
+    const renderers: string[] = [];
+    if (hasCallWidget) renderers.push(HELPER_TOOLS.ACTOR_CALL_WIDGET);
+    if (hasRunsGetWidget) renderers.push(HELPER_TOOLS.ACTOR_RUNS_GET_WIDGET);
+    const dontCallAgain: string[] = [];
+    if (hasRunsGet) dontCallAgain.push(HELPER_TOOLS.ACTOR_RUNS_GET);
+    if (hasRunsGetWidget) dontCallAgain.push(HELPER_TOOLS.ACTOR_RUNS_GET_WIDGET);
+    if (renderers.length === 0) return '';
+
+    const pollsItself =
+        renderers.length > 1
+            ? 'Both widgets render live progress and poll themselves'
+            : 'It renders live progress and polls itself';
+    const dupWarning =
+        dontCallAgain.length > 0
+            ? `- **After ${asCodeList(renderers)}, never call ${asCodeList(dontCallAgain)} for the same run.** ${pollsItself} — stop after the widget response and defer to it for run status.${hasRunsGetWidget ? ` Re-rendering the same run via \`${HELPER_TOOLS.ACTOR_RUNS_GET_WIDGET}\` is a duplicate.` : ''}\n`
+            : '';
+    const pollOkLine =
+        hasCall && hasRunsGet
+            ? `- Polling \`${HELPER_TOOLS.ACTOR_RUNS_GET}\` after \`${HELPER_TOOLS.ACTOR_CALL}\` is fine — that tool renders no UI, so polling is expected when the run is non-terminal and you need the latest status.\n`
+            : '';
+    if (dupWarning === '' && pollOkLine === '') return '';
+
+    return `
+## Widget workflow (applies when tool responses include widget metadata)
+Some clients render widget-backed Actor tools: the response includes a live UI that automatically polls run status. When a widget is rendered, follow-up status polling by the model is a forbidden duplicate.
+
+${dupWarning}${pollOkLine}`;
+}
+
 /** Every cross-tool mention gates on `ctx.hasTool(...)`, so a session missing a tool is never told to call it. */
 export function getServerInstructions(
     mode: SERVER_MODE = SERVER_MODE.DEFAULT,
@@ -31,23 +74,12 @@ export function getServerInstructions(
     const hasDetails = hasTool(HELPER_TOOLS.ACTOR_GET_DETAILS);
     const hasCall = hasTool(HELPER_TOOLS.ACTOR_CALL);
     const hasRunsGet = hasTool(HELPER_TOOLS.ACTOR_RUNS_GET);
+    const hasCallWidget = hasTool(HELPER_TOOLS.ACTOR_CALL_WIDGET);
+    const hasRunsGetWidget = hasTool(HELPER_TOOLS.ACTOR_RUNS_GET_WIDGET);
 
-    // get-actor-run-widget auto-loads with get-actor-run in apps mode; gating the base tool suffices.
-    const widgetWorkflowSection =
-        isApps && hasRunsGet
-            ? `
-## Widget workflow (applies when tool responses include widget metadata)
-Some clients render widget-backed Actor tools: the response includes a live UI that automatically polls run status. When a widget is rendered, follow-up status polling by the model is a forbidden duplicate.
-
-${
-    hasCall
-        ? `- **After \`${HELPER_TOOLS.ACTOR_CALL_WIDGET}\` or \`${HELPER_TOOLS.ACTOR_RUNS_GET_WIDGET}\`, never call \`${HELPER_TOOLS.ACTOR_RUNS_GET}\` or \`${HELPER_TOOLS.ACTOR_RUNS_GET_WIDGET}\` for the same run.** Both widgets render live progress and poll themselves — stop after the widget response and defer to it for run status. Re-rendering the same run via \`${HELPER_TOOLS.ACTOR_RUNS_GET_WIDGET}\` is a duplicate.
-- Polling \`${HELPER_TOOLS.ACTOR_RUNS_GET}\` after \`${HELPER_TOOLS.ACTOR_CALL}\` is fine — that tool renders no UI, so polling is expected
```

**File**: `src/utils/tools_loader.ts` (modified, +30/-24)
```diff
@@ -13,6 +13,7 @@ import { actorNameToToolName } from '../tools/actor_tool_naming.js';
 import { reportProblem } from '../tools/dev/report_problem.js';
 import { getActorsAsTools } from '../tools/index.js';
 import {
+    ALL_WIDGET_TOOLS,
     CATEGORY_NAME_SET,
     CATEGORY_NAMES,
     getCategoryTools,
@@ -24,7 +25,7 @@ import { getActorRun } from '../tools/runs/get_actor_run.js';
 import { getDatasetItems } from '../tools/storage/get_dataset_items.js';
 import { getKeyValueStoreRecord } from '../tools/storage/get_key_value_store_record.js';
 import type { ActorStore, Input, ToolCategory, ToolEntry } from '../types.js';
-import { SERVER_MODES, SERVER_MODE, TOOL_TYPE } from '../types.js';
+import { SERVER_MODE, TOOL_TYPE } from '../types.js';
 
 /**
  * Tools auto-injected alongside any actor-running tool (call-actor / direct
@@ -40,20 +41,15 @@ export const AUTO_INJECTED_TOOLS: readonly ToolEntry[] = [
 
 const ACTOR_PLACEHOLDER_NAME = '__actor-placeholder__';
 
-// All internal tool names across all modes. Selectors matching these are not treated as Actor IDs.
-// Built eagerly at module load; inputs (SERVER_MODES, getCategoryTools, CATEGORY_NAMES,
-// WIDGET_BY_BASE_TOOL) are module-level constants available at import time.
+// All internal tool names. Selectors matching these are not treated as Actor IDs.
 const ALL_INTERNAL_TOOL_NAMES: Set<string> = (() => {
     const names = new Set<string>();
-    // Collect tool names from both modes to ensure complete classification
-    for (const mode of SERVER_MODES) {
-        const categories = getCategoryTools(mode);
-        for (const name of CATEGORY_NAMES) {
-            for (const tool of categories[name]) names.add(tool.name);
-        }
+    const categories = getCategoryTools();
+    for (const name of CATEGORY_NAMES) {
+        for (const tool of categories[name]) names.add(tool.name);
     }
-    // Widgets live only in WIDGET_BY_BASE_TOOL, not in any category
-    for (const widget of WIDGET_BY_BASE_TOOL.values()) names.add(widget.name);
+    // Widgets live in no category — ALL_WIDGET_TOOLS covers every widget, paired or not.
+    for (const widget of ALL_WIDGET_TOOLS) names.add(widget.name);
     return names;
 })();
 
@@ -200,9 +196,10 @@ export function getToolsForServerMode(
             toolsByName.set(tool.name, tool);
         }
     }
-    // Widgets are apps-only and not in any category; include it for direct selection
+    // Widgets are apps-only and not in any category; include every widget (paired or not) for
+    // direct `?tools=` selection.
     if (mode === SERVER_MODE.APPS) {
-        for (const widget of WIDGET_BY_BASE_TOOL.values()) {
+        for (const widget of ALL_WIDGET_TOOLS) {
             toolsByName.set(widget.name, widget);
         }
     }
@@ -264,17 +261,26 @@ export function getToolsForServerMode(
      * get-key-value-store-record → abort-actor-run. If the user explicitly selected these tools
      * via category before `actors`, the de-dup pass below preserves their selector order.
      */
-    const hasCallActor = result.some((entry) => entry.name === HELPER_TOOLS.ACTOR_CALL);
+    const resultNames = new Set(result.map((entry) => entry.name));
     const hasActorTools = result.some((entry) => entry.type === TOOL_TYPE.ACTOR);
-    // `get-actor-run`'s nextStep templates point at `get-dataset-items` / `get-key-value-store-record`,
-    // and the apps-mode widget calls `get-dataset-items` to fetch its preview. A runs-only session
-    // (e.g. `tools: ['runs']`) would otherwise land on an unrecommendable tool / empty widget.
-    const hasGetActorRun = result.some((entry) => entry.name === HELPER_TOOLS.ACTOR_RUNS_GET);
-
-    // Inject run-workflow helpers whenever any actor-running entrypoint is present; de-dup pass below drops repeats.
-    const toolsToInject: ToolEntry[] = [];
-    if (hasCallActor || hasActorTools || hasGetActorRun) {
-        toolsToInject.push(...AUTO_INJECTED_TOOLS);
+    // get-actor-run's nextStep templates point at get-dataset-items/get-key-value-store-record.
+    const hasGetActorRun = resultNames.has(HELPER_TOOLS.ACTOR_RUNS_GET);
+    // call-actor-widget starts a run, same as call-actor, so it also wants the bundle.
+    const hasCallActorWidget = resultNames.has(HELPER_TOOLS.ACTOR_CALL_WIDGET);
+    // get-actor-run-widget calls get-dataset-items internally for its own preview fetch.
+    const hasGetActorRunWidget = resultNames.has(HELPER_TOOLS.ACTOR_RUNS_GET_WIDGET);
+
+    // call-actor, direct Actor tools and get-actor-run are the non-widget run tools; any of them
+    // justifies the full bundle. get-actor-run-widget alone skips get-actor-run (it polls itself);
+    // call-actor-widget alone still gets it.
+    const hasNonWidgetRunTool = resultNames.has(HELPER_TOOLS.ACTOR_CALL) || hasActorTools || hasGetActorRun;
+    let toolsToInject: readonly ToolEntry[] = [];
+    if (hasNonWidgetRunTool) {
+        toolsToInject = AUTO_INJECTED_TOOLS;
+    } else if (hasGetActo
```

**File**: `tests/e2e/cases.json` (modified, +0/-41)
```diff
@@ -955,47 +955,6 @@
       ],
       "assert": ".isError != true and (._meta | has(\"ui\")) and (.structuredContent | has(\"actorDetails\"))"
     },
-    {
-      "id": "calls the call-actor widget",
-      "configs": [
-        "full-apps"
-      ],
-      "args": [
-        "tools-call",
-        "call-actor-widget",
-        "actor:=\"apify/normal-mode-test-actor\"",
-        "input:={\"firstNumber\":1,\"secondNumber\":2}"
-      ],
-      "capture": {
-        "widgetRunId": ".structuredContent.runId"
-      },
-      "assert": ".isError != true and (._meta | has(\"ui\")) and (.structuredContent | has(\"runId\") and has(\"status\"))"
-    },
-    {
-      "id": "waits for the widget run to finish",
-      "configs": [
-        "full-apps"
-      ],
-      "args": [
-        "tools-call",
-        "get-actor-run",
-        "runId:=\"{{widgetRunId}}\"",
-        "waitSecs:=45"
-      ],
-      "assert": ".isError != true and .structuredContent.status == \"SUCCEEDED\""
-    },
-    {
-      "id": "calls the get-actor-run widget",
-      "configs": [
-        "full-apps"
-      ],
-      "args": [
-        "tools-call",
-        "get-actor-run-widget",
-        "runId:=\"{{widgetRunId}}\""
-      ],
-      "assert": ".isError != true and (._meta | has(\"ui\")) and .structuredContent.status == \"SUCCEEDED\""
-    },
     {
       "id": "calls report-problem",
       "configs": [
```

**File**: `tests/test_kit/cases/apps.cases.ts` (modified, +64/-0)
```diff
@@ -140,4 +140,68 @@ export const appsCases: Case[] = [
             expect(details.actorInfo).toHaveProperty('description');
         }),
     },
+    {
+        // call-actor-widget/get-actor-run-widget are not auto-paired (unlike search/details); confirm
+        // each still loads and renders its instruction text via explicit ?tools= selection alone.
+        name: '?tools=get-actor-run-widget alone: widget tool loads, server instructions carry its paragraph',
+        isDeploymentTest: false,
+        run: withClient({ tools: ['get-actor-run-widget'], serverMode: 'apps' }, async (client) => {
+            const toolNames = getToolNames(await client.listTools());
+            expect(toolNames).toContain(HELPER_TOOLS.ACTOR_RUNS_GET_WIDGET);
+            expect(toolNames).not.toContain(HELPER_TOOLS.ACTOR_RUNS_GET); // widget-only, no base auto-added
+
+            const instructions = client.getInstructions();
+            expect(instructions).toContain('Widget workflow');
+            expect(instructions).toContain(HELPER_TOOLS.ACTOR_RUNS_GET_WIDGET);
+        }),
+    },
+    {
+        name: '?tools=call-actor,call-actor-widget: call-actor description carries the WIDGET ALTERNATIVE text',
+        isDeploymentTest: false,
+        run: withClient({ tools: ['call-actor', 'call-actor-widget'], serverMode: 'apps' }, async (client) => {
+            const tools = await client.listTools();
+            const toolNames = getToolNames(tools);
+            expect(toolNames).toContain(HELPER_TOOLS.ACTOR_CALL);
+            expect(toolNames).toContain(HELPER_TOOLS.ACTOR_CALL_WIDGET);
+
+            const callActorTool = tools.tools.find((t) => t.name === HELPER_TOOLS.ACTOR_CALL);
+            expect(callActorTool?.description).toContain('WIDGET ALTERNATIVE');
+            expect(callActorTool?.description).toContain(HELPER_TOOLS.ACTOR_CALL_WIDGET);
+        }),
+    },
+    {
+        name: '?tools=call-actor-widget alone: call-actor absent, widget tool still selectable and functional-shaped',
+        isDeploymentTest: false,
+        run: withClient({ tools: ['call-actor-widget'], serverMode: 'apps' }, async (client) => {
+            const toolNames = getToolNames(await client.listTools());
+            expect(toolNames).toContain(HELPER_TOOLS.ACTOR_CALL_WIDGET);
+            expect(toolNames).not.toContain(HELPER_TOOLS.ACTOR_CALL); // widget-only, no base auto-added
+
+            const instructions = client.getInstructions();
+            expect(instructions).not.toContain('WIDGET ALTERNATIVE'); // that bullet lives on call-actor's own description, absent here
+        }),
+    },
+    {
+        // Regression: call-actor-widget's own bundle claim used to short-circuit past
+        // get-actor-run-widget's exclusion, silently adding get-actor-run to this exact combination.
+        name: '?tools=call-actor-widget,get-actor-run-widget: neither base auto-added, run-workflow helpers still load',
+        isDeploymentTest: false,
+        run: withClient(
+            { tools: ['call-actor-widget', 'get-actor-run-widget'], serverMode: 'apps' },
+            async (client) => {
+                const toolNames = getToolNames(await client.listTools());
+                expect(toolNames).toContain(HELPER_TOOLS.ACTOR_CALL_WIDGET);
+                expect(toolNames).toContain(HELPER_TOOLS.ACTOR_RUNS_GET_WIDGET);
+                expect(toolNames).not.toContain(HELPER_TOOLS.ACTOR_CALL);
+                expect(toolNames).not.toContain(HELPER_TOOLS.ACTOR_RUNS_GET);
+                expect(toolNames).toContain(HELPER_TOOLS.DATASET_GET_ITEMS);
+                expect(toolNames).toContain(HELPER_TOOLS.KEY_VALUE_STORE_RECORD_GET);
+                expect(toolNames).toContain(HELPER_TOOLS.ACTOR_RUNS_ABORT);
+
+                const instructions = client.getInstructions();
+                expect(instructions).toContain(HELPER_TOOLS.ACTOR_CALL_WIDGET);
+                expect(instructions).toContain(HELPER_TOOLS.ACTOR_RUNS_GET_WIDGET);
+            },
+        ),
+    },
 ];
```

**File**: `tests/test_kit/cases/registration.cases.ts` (modified, +34/-30)
```diff
@@ -26,42 +26,50 @@ import {
     skipUnlessStdio,
     withClient,
 } from '../helpers.js';
+import { buildClientUrl, type SuiteClientOptions } from '../mcp_client.js';
 import type { Case } from '../types.js';
 
 const TWO_TEST_ACTORS = ['apify/python-example', 'apify/rag-web-browser'];
 const SINGLE_NORMAL_MODE_ACTOR = [ACTOR_NORMAL_MODE];
 const DOCS_CATEGORY = ['docs'] as ToolCategory[];
 const DOCS_RUNS_STORAGE_CATEGORIES = ['docs', 'runs', 'storage'] as ToolCategory[];
 
-// Claude-connector `?tools=` allowlist. No call-actor. Actor entries use their slash name here;
-// served tool names differ — see CLAUDE_CONNECTOR_EXPECTED_TOOL_NAMES.
-// NOTE: hypothetical selection, not the actual reviewed connector URL (ai-team#214).
-// get-actor-run-widget omitted deliberately: apps mode auto-pairs it with get-actor-run regardless of ?tools= (tools_loader.ts).
+// Claude-connector `?tools=` allowlist (ai-team#214/#229). No call-actor. Duplicated in
+// tests/unit/helpers/claude_connector_tools.ts, not imported from there: tests/test_kit is its own
+// `tsc -b` project (see its tsconfig's `rootDir`) and cannot import outside itself.
 const CLAUDE_CONNECTOR_TOOLS = [
-    'search-actors',
-    'search-actors-widget',
-    'fetch-actor-details',
-    'fetch-actor-details-widget',
-    'search-apify-docs',
-    'fetch-apify-docs',
-    'get-actor-run',
-    'get-actor-run-widget',
-    'get-actor-run-list',
-    'get-actor-log',
-    'abort-actor-run',
-    'get-dataset-list',
-    'get-dataset',
-    'get-dataset-items',
-    'get-key-value-store-list',
-    'get-key-value-store',
-    'get-key-value-store-record',
+    HELPER_TOOLS.STORE_SEARCH,
+    HELPER_TOOLS.STORE_SEARCH_WIDGET,
+    HELPER_TOOLS.ACTOR_GET_DETAILS,
+    HELPER_TOOLS.ACTOR_GET_DETAILS_WIDGET,
+    HELPER_TOOLS.DOCS_SEARCH,
+    HELPER_TOOLS.DOCS_FETCH,
+    HELPER_TOOLS.ACTOR_RUNS_GET,
+    HELPER_TOOLS.ACTOR_RUN_LIST_GET,
+    HELPER_TOOLS.ACTOR_RUNS_LOG,
+    HELPER_TOOLS.ACTOR_RUNS_ABORT,
+    HELPER_TOOLS.DATASET_GET,
+    HELPER_TOOLS.DATASET_GET_ITEMS,
+    HELPER_TOOLS.DATASET_SCHEMA_GET,
+    HELPER_TOOLS.DATASET_LIST_GET,
+    HELPER_TOOLS.KEY_VALUE_STORE_GET,
+    HELPER_TOOLS.KEY_VALUE_STORE_KEYS_GET,
+    HELPER_TOOLS.KEY_VALUE_STORE_RECORD_GET,
+    HELPER_TOOLS.KEY_VALUE_STORE_LIST_GET,
     'apify/rag-web-browser',
     'apify/web-fetch',
     HELPER_TOOLS.PROBLEM_REPORT,
 ];
+// Served tool names differ from CLAUDE_CONNECTOR_TOOLS's Actor selectors — map them here.
 const CLAUDE_CONNECTOR_EXPECTED_TOOL_NAMES = CLAUDE_CONNECTOR_TOOLS.map((selector) =>
     selector.includes('/') ? actorNameToToolName(selector) : selector,
 );
+// telemetry: true is explicit — the deployed target defaults it off, unlike this package's own default.
+const CLAUDE_CONNECTOR_CLIENT_OPTIONS: SuiteClientOptions = {
+    tools: CLAUDE_CONNECTOR_TOOLS,
+    client: 'claude connector',
+    telemetry: { enabled: true },
+};
 
 /** Tool/Actor selection, categories, env loading, auto-inject, server mode. */
 export const registrationCases: Case[] = [
@@ -107,25 +115,24 @@ export const registrationCases: Case[] = [
     },
     {
         // Pinned ?tools= wins for call-actor even with report-problem auto-inject live.
-        // telemetry: true is explicit — the deployed target defaults it off (confirmed by CI), unlike this package's own default.
         // No ?ui=: apps mode comes from the client's own UI-capability advertisement (serverMode 'auto'), not a URL override.
         name: 'Claude connector: pinned tool surface excludes call-actor, includes report-problem, tagged ?client=claude+connector',
         isDeploymentTest: true,
         skipIf: () => !SERVER_MODE_AUTO_DETECTION_ENABLED,
         run: withClient(
             {
-                tools: CLAUDE_CONNECTOR_TOOLS,
-                client: 'claude connector',
-                telemetry: { enabled: true },
+                ...CLAUDE_CONNECTOR_CLIENT_OPTIONS,
                 clientCapabilities: {
                     extensions: { 'io.modelcontextprotocol/ui': { mimeTypes: [RESOURCE_MIME_TYPE] } },
                 },
             },
             async (client) => {
                 const names = getToolNames(await client.listTools());
-                expect(names).toContain(HELPER_TOOLS.PROBLEM_REPORT);
-                expect(names).not.toContain(HELPER_TOOLS.ACTOR_CALL);
+                // Exact set, not superset: this pinned URL serves these tools and nothing else.
                 expect(new Set(names)).toEqual(new Set(CLAUDE_CONNECTOR_EXPECTED_TOOL_NAMES));
+
+                const url = buildClientUrl('http://placeholder/', CLAUDE_CONNECTOR_CLIENT_OPTIONS);
+                expect(url.search.endsWith('client=claude+connector')).toBe(true);
             },
         ),
     },
@@ -464,7 +471,6 @@ export const registrationCases: Case[] = [
                 // Verify that apps-only internal tools are present in apps mode
                 expect(toolNames).toContain(HELPER_TOOLS.ACTO
```

**File**: `tests/test_kit/helpers.ts` (modified, +1/-6)
```diff
@@ -142,12 +142,7 @@ export function expectReadmeInStructuredContent(result: unknown, expectedActorFu
 
 /** Assert apps-mode widget tools carry MCP Apps `_meta.ui` (SEP-1865). */
 export function expectWidgetToolMeta(tools: { tools: { name: string; _meta?: Record<string, unknown> }[] }): void {
-    const toolNames = [
-        HELPER_TOOLS.STORE_SEARCH_WIDGET,
-        HELPER_TOOLS.ACTOR_GET_DETAILS_WIDGET,
-        HELPER_TOOLS.ACTOR_CALL_WIDGET,
-        HELPER_TOOLS.ACTOR_RUNS_GET_WIDGET,
-    ];
+    const toolNames = [HELPER_TOOLS.STORE_SEARCH_WIDGET, HELPER_TOOLS.ACTOR_GET_DETAILS_WIDGET];
     for (const toolName of toolNames) {
         const tool = tools.tools.find((t) => t.name === toolName);
         expect(tool).toBeDefined();
```

---

### Incident Patch 13: `aa9f7b37` (2026-09-10)
**Commit Message**: fix: Gate call-actor mentions when the tool is absent from the session (#1326)

Closes apify/ai-team#232

Stacked on #1334 — base branch is that PR's, not master; diff here is
just this PR's own commits. Server-instructions.ts's own gating logic
moved to #1334 so it's reviewable and testable on its own.

## What
Gates every unconditional `call-actor` (and
`apify/rag-web-browser`/`apify/web-fetch`) mention behind the session's
actual tool set, in both protocol eras.

## Why
A session whose `?tools=`/`?actors=` selection omits `call-actor` still
got told to use it — in dedicated Actor tool descriptions, and (via
#1334) in the server-wide instructions block. A tool name the client
never received in `tools/list` invites a hallucinated call.

- `actor_tools_factory.ts`: dedicated Actor tool descriptions now gate
the call-actor line via the existing `hasTool` pattern used everywhere
else in this codebase.
- Legacy/stdio protocol: passes the real, final per-session tool set
(unchanged mechanism, already proven by report-problem gating) into
#1334's `getServerInstructions`.
- Stateless (2026-07-28) protocol: resolves call-actor presence from the
request URL with zero network calls — its pr

**File**: `src/dev_server.ts` (modified, +1/-1)
```diff
@@ -197,7 +197,7 @@ async function serveStatelessRequest(req: Request, res: Response, taskStore: InM
             if (!isDiscoverProbe) {
                 await mcpServer.loadToolsFromUrl(req.url, new ApifyClient({ token: apifyToken }));
             }
-            return createStatelessServer(mcpServer);
+            return createStatelessServer(mcpServer, req.url);
         },
         {
             legacy: 'reject',
```

**File**: `src/mcp/AGENTS.md` (modified, +1/-1)
```diff
@@ -25,7 +25,7 @@ Two MCP protocol revisions are served, each by its own adapter:
 - `legacy_server.ts` — package-private v1 SDK adapter for handlers, Tasks, errors,
   notifications, logging, and transport lifecycle. It reads shared state through
   `LegacyMcpServerHost`.
-- `stateless_server.ts` — `createStatelessServer(host)`: the 2026-07-28 (v2 SDK) adapter,
+- `stateless_server.ts` — `createStatelessServer(host, requestUrl?)`: the 2026-07-28 (v2 SDK) adapter,
   one `Server` per request, reading shared state through `StatelessMcpServerHost`. Serves
   `tools/*`, `resources/*` and `prompts/*`; registers no Tasks (the SDK answers
   method-not-found) and declares no `logging`.
```

**File**: `src/mcp/server.ts` (modified, +20/-8)
```diff
@@ -32,7 +32,12 @@ import { SERVER_MODE, TOOL_TYPE } from '../types.js';
 import { getRequestOriginForClient, isReportProblemBlockedForClient } from '../utils/mcp_clients.js';
 import { getServerInstructions } from '../utils/server-instructions/index.js';
 import { parseServerMode, resolveServerMode } from '../utils/server_mode.js';
-import { getActors, getToolsForServerMode, toolNamesToInput } from '../utils/tools_loader.js';
+import {
+    getActors,
+    getToolsForServerMode,
+    resolveToolNamesFromInput,
+    toolNamesToInput,
+} from '../utils/tools_loader.js';
 import { buildMcpClientContext, isUiSupportedByClient } from './client_context.js';
 import type { McpClientContext } from './client_context.js';
 import { LegacyMcpServer } from './legacy_server.js';
@@ -279,15 +284,22 @@ export class ActorsMcpServer implements LegacyMcpServerHost, StatelessMcpServerH
     }
 
     /**
-     * Instructions for a stateless serving unit. The SDK answers `server/discover` from them before
-     * any request's envelope is seen, so they are configuration-level: no report-problem mention
-     * (that tool's presence is decided per request) and the configured mode only. Reads
-     * `serverModeOption`, never `_serverMode` — one facade serves both eras, and a legacy
-     * `initialize` rewrites `_serverMode`, which must not leak into later stateless requests.
+     * Instructions for a stateless serving unit, answered from `server/discover` before any request is
+     * seen — configuration-level only, reading `serverModeOption` (never `_serverMode`, so a legacy
+     * `initialize` can't leak its mode into stateless requests).
+     *
+     * `requestUrl`, when given, resolves cross-tool mentions from `?tools=`/`?actors=` with no fetch;
+     * omit it for the same "everything but report-problem" fallback. `report-problem` is always
+     * excluded — its servability is per-request-identity-dependent, not derivable from the URL.
      */
-    public getStatelessServerInstructions(): string {
+    public getStatelessServerInstructions(requestUrl?: string): string {
+        const mode = resolveServerMode(this.serverModeOption, false);
         const notReportProblem = (name: string) => name !== HELPER_TOOLS.PROBLEM_REPORT;
-        return getServerInstructions(resolveServerMode(this.serverModeOption, false), { hasTool: notReportProblem });
+        if (requestUrl === undefined) {
+            return getServerInstructions(mode, { hasTool: notReportProblem });
+        }
+        const toolNames = resolveToolNamesFromInput(parseInputParamsFromUrl(requestUrl), mode);
+        return getServerInstructions(mode, { hasTool: (name) => notReportProblem(name) && toolNames.has(name) });
     }
 
     /**
```

**File**: `src/mcp/stateless_server.ts` (modified, +8/-5)
```diff
@@ -75,7 +75,7 @@ export interface StatelessMcpServerHost {
     readonly options: ActorsMcpServerOptions;
     readonly promptService: ReturnType<typeof createPromptService>;
     resolveApifyToken(meta?: ApifyRequestParams['_meta']): string | undefined;
-    getStatelessServerInstructions(): string;
+    getStatelessServerInstructions(requestUrl?: string): string;
     createRequestSnapshot(clientContext: McpClientContext | undefined): Promise<StatelessRequestSnapshot>;
 }
 
@@ -125,7 +125,7 @@ class StatelessMcpServer {
      */
     private snapshot: Promise<StatelessRequestSnapshot> | undefined;
 
-    constructor(host: StatelessMcpServerHost) {
+    constructor(host: StatelessMcpServerHost, requestUrl?: string) {
         this.host = host;
         this.server = new Server(getServerInfo(), {
             capabilities: {
@@ -138,7 +138,7 @@ class StatelessMcpServer {
                 resources: {},
                 prompts: {},
             },
-            instructions: this.host.getStatelessServerInstructions(),
+            instructions: this.host.getStatelessServerInstructions(requestUrl),
         });
         this.setupToolHandlers();
         this.setupResourceHandlers();
@@ -391,7 +391,10 @@ async function emitLogServerSide(msg: { level: string; data?: unknown }): Promis
  * ```ts
  * const handler = createMcpHandler(() => createStatelessServer(actorsMcpServer), { legacy: 'reject' });
  * ```
+ *
+ * `requestUrl` sharpens the served instructions' cross-tool mentions (`call-actor`, Actor tools);
+ * omit it for the same, tool-blind fallback.
  */
-export function createStatelessServer(host: StatelessMcpServerHost): Server {
-    return new StatelessMcpServer(host).server;
+export function createStatelessServer(host: StatelessMcpServerHost, requestUrl?: string): Server {
+    return new StatelessMcpServer(host, requestUrl).server;
 }
```

**File**: `src/tools/actor_tool_naming.ts` (modified, +3/-2)
```diff
@@ -55,15 +55,16 @@ export function parseActorFullName(actorFullName: string): { escapedUsername: st
 }
 
 export function actorNameToToolName(actorFullName: string): string {
-    const { escapedUsername, actorName } = parseActorFullName(actorFullName);
+    const normalizedActorFullName = actorFullName.replace(/^([^~]+)~/, '$1/');
+    const { escapedUsername, actorName } = parseActorFullName(normalizedActorFullName);
     const fullName = escapedUsername === null ? actorName : `${escapedUsername}--${actorName}`;
 
     if (fullName.length <= MAX_TOOL_NAME_LENGTH) {
         return fullName;
     }
 
     // Truncate and add hash for uniqueness
-    const hash = createHash('sha256').update(actorFullName).digest('hex').slice(0, TOOL_NAME_HASH_LENGTH);
+    const hash = createHash('sha256').update(normalizedActorFullName).digest('hex').slice(0, TOOL_NAME_HASH_LENGTH);
     return `${fullName.slice(0, MAX_TOOL_NAME_LENGTH - TOOL_NAME_HASH_LENGTH - 1)}-${hash}`;
 }
 
```

**File**: `src/tools/actors/actor_tools_factory.ts` (modified, +18/-10)
```diff
@@ -23,9 +23,11 @@ import {
     type ActorStore,
     type ActorTool,
     type ApifyToken,
+    type ToolDescriptionContext,
     type ToolEntry,
     type ToolInputSchema,
     ACTOR_TOOL_MODE,
+    ALL_TOOLS_PRESENT,
     TOOL_TYPE,
 } from '../../types.js';
 import { getActorDefinitionCached } from '../../utils/actor.js';
@@ -115,7 +117,9 @@ export async function getNormalActorsAsTools(
 
         if (!definition) continue;
 
-        const isRag = definition.actorFullName === RAG_WEB_BROWSER;
+        const { actorFullName, description: actorDescription } = definition;
+        const isRag = actorFullName === RAG_WEB_BROWSER;
+        const isWebFetch = actorFullName === WEB_FETCH;
         const { inputSchema } = buildActorInputSchema(definition.actorFullName, definition.input, isRag);
 
         // Inject the MCP-only `waitSecs` opt-in before AJV compile so the LLM can cap the wait.
@@ -125,14 +129,17 @@ export async function getNormalActorsAsTools(
             waitSecs: WAIT_SECS_INPUT_PROPERTY,
         };
 
-        let description = `This tool calls the Actor "${definition.actorFullName}" and retrieves its output results.
-Use this tool instead of the "${HELPER_TOOLS.ACTOR_CALL}" if user requests this specific Actor.
-Actor description: ${definition.description}`;
-        if (isRag) {
-            description += `\n\n${RAG_WEB_BROWSER_ADDITIONAL_DESC}`;
-        } else if (definition.actorFullName === WEB_FETCH) {
-            description += `\n\n${WEB_FETCH_ADDITIONAL_DESC}`;
-        }
+        // Names call-actor only when the session actually has it.
+        const buildDescription = ({ hasTool }: ToolDescriptionContext): string => {
+            let description = `This tool calls the Actor "${actorFullName}" and retrieves its output results.
+${hasTool(HELPER_TOOLS.ACTOR_CALL) ? `Use this tool instead of the "${HELPER_TOOLS.ACTOR_CALL}" if user requests this specific Actor.\n` : ''}Actor description: ${actorDescription}`;
+            if (isRag) {
+                description += `\n\n${RAG_WEB_BROWSER_ADDITIONAL_DESC}`;
+            } else if (isWebFetch) {
+                description += `\n\n${WEB_FETCH_ADDITIONAL_DESC}`;
+            }
+            return description;
+        };
 
         const memoryMbytes = Math.min(
             definition.defaultRunOptions?.memoryMbytes || ACTOR_MAX_MEMORY_MBYTES,
@@ -160,7 +167,8 @@ Actor description: ${definition.description}`;
             title: definition.actorFullName,
             actorId: definition.id,
             actorFullName: definition.actorFullName,
-            description,
+            description: buildDescription(ALL_TOOLS_PRESENT),
+            buildDescription,
             inputSchema: inputSchema as ToolInputSchema,
             // Canonical RunResponse shape — same as call-actor and get-actor-run.
             outputSchema: actorRunOutputSchema,
```

**File**: `src/utils/tools_loader.ts` (modified, +19/-1)
```diff
@@ -9,6 +9,7 @@ import log from '@apify/log';
 
 import { defaults, HELPER_TOOLS, type HelperToolName, RETIRED_SELECTOR_NAMES } from '../const.js';
 import type { PaymentProvider } from '../payments/types.js';
+import { actorNameToToolName } from '../tools/actor_tool_naming.js';
 import { reportProblem } from '../tools/dev/report_problem.js';
 import { getActorsAsTools } from '../tools/index.js';
 import {
@@ -37,6 +38,8 @@ export const AUTO_INJECTED_TOOLS: readonly ToolEntry[] = [
     abortActorRun,
 ] as const;
 
+const ACTOR_PLACEHOLDER_NAME = '__actor-placeholder__';
+
 // All internal tool names across all modes. Selectors matching these are not treated as Actor IDs.
 // Built eagerly at module load; inputs (SERVER_MODES, getCategoryTools, CATEGORY_NAMES,
 // WIDGET_BY_BASE_TOOL) are module-level constants available at import time.
@@ -99,7 +102,7 @@ function normalizeInput(input: Input): NormalizedInput {
  * If no selectors / no explicit actors: the defaults apply (or empty when
  * `actors` was explicitly set to empty).
  */
-function resolveActorsToLoad(input: Input): string[] {
+export function resolveActorsToLoad(input: Input): string[] {
     const { selectors, actorsExplicitlyEmpty } = normalizeInput(input);
 
     // Selectors that aren't retired, categories, or internal tools in any mode → Actor names.
@@ -299,6 +302,21 @@ export function getToolsForServerMode(
     return result.filter((entry) => !seen.has(entry.name) && seen.add(entry.name));
 }
 
+/** Resolve the tool names composition will serve without fetching Actor metadata. */
+export function resolveToolNamesFromInput(input: Input, mode: SERVER_MODE = SERVER_MODE.DEFAULT): Set<string> {
+    const actorNames = resolveActorsToLoad(input);
+    // Composition reads only type and name from Actor entries; the placeholder triggers its shared injection rules.
+    const actorTools =
+        actorNames.length > 0 ? ([{ type: TOOL_TYPE.ACTOR, name: ACTOR_PLACEHOLDER_NAME }] as ToolEntry[]) : [];
+    const toolNames = new Set(getToolsForServerMode(input, actorTools, mode).map((tool) => tool.name));
+    toolNames.delete(ACTOR_PLACEHOLDER_NAME);
+
+    for (const actorName of actorNames) {
+        if (actorName.indexOf('/') > 0 || actorName.indexOf('~') > 0) toolNames.add(actorNameToToolName(actorName));
+    }
+    return toolNames;
+}
+
 /** Convenience wrapper: {@link getActors} + {@link getToolsForServerMode} in sequence. */
 export async function loadToolsFromInput(
     input: Input,
```

**File**: `tests/test_kit/cases/registration.cases.ts` (modified, +40/-0)
```diff
@@ -29,6 +29,32 @@ const SINGLE_NORMAL_MODE_ACTOR = [ACTOR_NORMAL_MODE];
 const DOCS_CATEGORY = ['docs'] as ToolCategory[];
 const DOCS_RUNS_STORAGE_CATEGORIES = ['docs', 'runs', 'storage'] as ToolCategory[];
 
+// Claude-connector `?tools=` allowlist (no call-actor); Actor entries use slash names, served names differ — see CLAUDE_CONNECTOR_EXPECTED_TOOL_NAMES.
+const CLAUDE_CONNECTOR_TOOLS = [
+    'search-actors',
+    'search-actors-widget',
+    'fetch-actor-details',
+    'fetch-actor-details-widget',
+    'search-apify-docs',
+    'fetch-apify-docs',
+    'get-actor-run',
+    'get-actor-run-widget',
+    'get-actor-run-list',
+    'get-actor-log',
+    'abort-actor-run',
+    'get-dataset-list',
+    'get-dataset',
+    'get-dataset-items',
+    'get-key-value-store-list',
+    'get-key-value-store',
+    'get-key-value-store-record',
+    'apify/rag-web-browser',
+    'apify/web-fetch',
+];
+const CLAUDE_CONNECTOR_EXPECTED_TOOL_NAMES = CLAUDE_CONNECTOR_TOOLS.map((selector) =>
+    selector.includes('/') ? actorNameToToolName(selector) : selector,
+);
+
 /** Tool/Actor selection, categories, env loading, auto-inject, server mode. */
 export const registrationCases: Case[] = [
     {
@@ -71,6 +97,20 @@ export const registrationCases: Case[] = [
             expect(names).not.toContain(HELPER_TOOLS.PROBLEM_REPORT);
         }),
     },
+    {
+        // Pinned ?tools= wins even with telemetry on, which would otherwise auto-inject report-problem.
+        name: 'Claude connector: pinned tool surface excludes call-actor and report-problem even with telemetry enabled',
+        isDeploymentTest: true,
+        run: withClient(
+            { tools: CLAUDE_CONNECTOR_TOOLS, serverMode: 'apps', telemetry: { enabled: true } },
+            async (client) => {
+                const names = getToolNames(await client.listTools());
+                expect(names).not.toContain(HELPER_TOOLS.PROBLEM_REPORT);
+                expect(names).not.toContain(HELPER_TOOLS.ACTOR_CALL);
+                expect(new Set(names)).toEqual(new Set(CLAUDE_CONNECTOR_EXPECTED_TOOL_NAMES));
+            },
+        ),
+    },
     {
         // isDeploymentTest: default tool/Actor set.
         name: 'should list all default tools and Actors',
```

---

### Incident Patch 14: `49243e97` (2026-09-10)
**Commit Message**: fix: Gate every cross-tool mention in server instructions behind the session's tool set (#1334)

Closes apify/ai-team#266 — split out of apify/ai-team#232, which #1326
(stacked on top) closes.

Split out of #1326/#1327 — this is the one self-contained piece both
depend on: `server-instructions.ts`'s own gating logic, generic over any
tool set, needing zero wiring changes to test.

## What
Server instructions unconditionally named `call-actor`,
`apify/rag-web-browser`, `apify/web-fetch`, `report-problem`, and
several apps-mode widget/disambiguation tools regardless of whether the
session actually loaded them.

## Why
A tool name the client never received in `tools/list` invites a
hallucinated call.

- `getServerInstructions` now takes a `ToolDescriptionContext` (the same
gating mechanism already used for per-tool descriptions, e.g.
report-problem's own gating) instead of a bare `reportProblemAvailable`
boolean, and gates every cross-tool mention through it — call-actor,
rag-web-browser, web-fetch, report-problem, plus 4 more spots found
during review: the apps-mode widget-workflow block, the
search-actors-vs-fetch-actor-details disambiguation, the apps-mode
data-vs-widget bullets, a

**File**: `src/mcp/legacy_server.ts` (modified, +3/-2)
```diff
@@ -34,7 +34,7 @@ import {
 import log from '@apify/log';
 
 import type { ApifyClient } from '../apify_client.js';
-import { FAILURE_CATEGORY, TOOL_STATUS } from '../const.js';
+import { FAILURE_CATEGORY, HELPER_TOOLS, TOOL_STATUS } from '../const.js';
 import type { createPromptService } from '../prompts/prompt_service.js';
 import type { createResourceService } from '../resources/resource_service.js';
 import { getServerInfo } from '../server_card.js';
@@ -138,7 +138,8 @@ export class LegacyMcpServer {
                 prompts: {},
                 logging: {},
             },
-            instructions: getServerInstructions(),
+            // Placeholder overwritten below once the real tool set is known; matches the pre-gating default (all but report-problem).
+            instructions: getServerInstructions(undefined, { hasTool: (name) => name !== HELPER_TOOLS.PROBLEM_REPORT }),
         });
         this.setupInitializeHandler();
         this.setupLoggingProxy();
```

**File**: `src/mcp/server.ts` (modified, +4/-3)
```diff
@@ -271,11 +271,11 @@ export class ActorsMcpServer implements LegacyMcpServerHost, StatelessMcpServerH
     }
 
     /**
-     * Server instructions for the current connection: mode plus whether report-problem is loaded.
+     * Server instructions for the current connection: mode plus the session's real tool set.
      * Read by the legacy adapter after `applyInitialize`, when the tool set is final.
      */
     public getServerInstructions(): string {
-        return getServerInstructions(this.serverMode, this.tools.has(HELPER_TOOLS.PROBLEM_REPORT));
+        return getServerInstructions(this.serverMode, { hasTool: (name) => this.tools.has(name) });
     }
 
     /**
@@ -286,7 +286,8 @@ export class ActorsMcpServer implements LegacyMcpServerHost, StatelessMcpServerH
      * `initialize` rewrites `_serverMode`, which must not leak into later stateless requests.
      */
     public getStatelessServerInstructions(): string {
-        return getServerInstructions(resolveServerMode(this.serverModeOption, false));
+        const notReportProblem = (name: string) => name !== HELPER_TOOLS.PROBLEM_REPORT;
+        return getServerInstructions(resolveServerMode(this.serverModeOption, false), { hasTool: notReportProblem });
     }
 
     /**
```

**File**: `src/utils/server-instructions/index.ts` (modified, +113/-57)
```diff
@@ -9,23 +9,120 @@
 
 import { getApifyAPIBaseUrl } from '../../apify_client.js';
 import { HELPER_TOOLS, RAG_WEB_BROWSER, WEB_FETCH } from '../../const.js';
-import { SERVER_MODE } from '../../types.js';
+import { actorNameToToolName } from '../../tools/actor_tool_naming.js';
+import type { ToolDescriptionContext } from '../../types.js';
+import { ALL_TOOLS_PRESENT, SERVER_MODE } from '../../types.js';
 
-/**
- * Build server instructions for the given mode.
- *
- * Apps-only sections are omitted in default mode to prevent models from
- * attempting to call widget tools that are not registered. The report-problem line is
- * emitted only when `reportProblemAvailable` is true — i.e. `report-problem` is actually
- * served — so clients that never receive the tool (Anthropic surfaces, telemetry off, or a
- * `tools=` selection that omits report-problem) are not told to call it.
- */
-export function getServerInstructions(mode: SERVER_MODE = SERVER_MODE.DEFAULT, reportProblemAvailable = false): string {
+// hasTool checks registered tool names, not Actor full names — see call_actor.ts's RAG_WEB_BROWSER_TOOL.
+const RAG_WEB_BROWSER_TOOL = actorNameToToolName(RAG_WEB_BROWSER);
+const WEB_FETCH_TOOL = actorNameToToolName(WEB_FETCH);
+
+/** Every cross-tool mention gates on `ctx.hasTool(...)`, so a session missing a tool is never told to call it. */
+export function getServerInstructions(
+    mode: SERVER_MODE = SERVER_MODE.DEFAULT,
+    { hasTool }: ToolDescriptionContext = ALL_TOOLS_PRESENT,
+): string {
     const isApps = mode === SERVER_MODE.APPS;
     // Derive the API base from config so examples match the gate/templates under an
     // APIFY_API_BASE_URL / staging override, instead of a hardcoded api.apify.com.
     const apiBaseUrl = getApifyAPIBaseUrl();
 
+    const hasSearch = hasTool(HELPER_TOOLS.STORE_SEARCH);
+    const hasDetails = hasTool(HELPER_TOOLS.ACTOR_GET_DETAILS);
+    const hasCall = hasTool(HELPER_TOOLS.ACTOR_CALL);
+    const hasRunsGet = hasTool(HELPER_TOOLS.ACTOR_RUNS_GET);
+
+    // get-actor-run-widget auto-loads with get-actor-run in apps mode; gating the base tool suffices.
+    const widgetWorkflowSection =
+        isApps && hasRunsGet
+            ? `
+## Widget workflow (applies when tool responses include widget metadata)
+Some clients render widget-backed Actor tools: the response includes a live UI that automatically polls run status. When a widget is rendered, follow-up status polling by the model is a forbidden duplicate.
+
+${
+    hasCall
+        ? `- **After \`${HELPER_TOOLS.ACTOR_CALL_WIDGET}\` or \`${HELPER_TOOLS.ACTOR_RUNS_GET_WIDGET}\`, never call \`${HELPER_TOOLS.ACTOR_RUNS_GET}\` or \`${HELPER_TOOLS.ACTOR_RUNS_GET_WIDGET}\` for the same run.** Both widgets render live progress and poll themselves — stop after the widget response and defer to it for run status. Re-rendering the same run via \`${HELPER_TOOLS.ACTOR_RUNS_GET_WIDGET}\` is a duplicate.
+- Polling \`${HELPER_TOOLS.ACTOR_RUNS_GET}\` after \`${HELPER_TOOLS.ACTOR_CALL}\` is fine — that tool renders no UI, so polling is expected when the run is non-terminal and you need the latest status.
+`
+        : `- **After \`${HELPER_TOOLS.ACTOR_RUNS_GET_WIDGET}\`, never call \`${HELPER_TOOLS.ACTOR_RUNS_GET}\` or \`${HELPER_TOOLS.ACTOR_RUNS_GET_WIDGET}\` for the same run.** It renders live progress and polls itself — stop after the widget response and defer to it for run status. Re-rendering the same run via \`${HELPER_TOOLS.ACTOR_RUNS_GET_WIDGET}\` is a duplicate.
+`
+}`
+            : '';
+
+    const toolDependencies = hasCall
+        ? `### Tool dependencies
+- \`${HELPER_TOOLS.ACTOR_CALL}\`:
+  - ${hasDetails ? `Use \`${HELPER_TOOLS.ACTOR_GET_DETAILS}\` first to obtain the Actor's input schema.` : `Check the Actor's input schema first.`}
+  - Then call with proper input to execute the Actor.
+  - For MCP server Actors, use format "actorName:toolName" to call specific tools.
+  - Supports a \`waitSecs\` parameter (default 30, max 45):
+    - \`waitSecs: 0\`: fire-and-forget — starts the run and returns immediately with a runId.
+    - \`waitSecs > 0\`: waits up to that many seconds for the run to complete, then returns its current status and storage IDs (never the output rows — fetch those with \`${HELPER_TOOLS.DATASET_GET_ITEMS}\`).
+`
+        : '';
+
+    // Compares both when loaded; names whichever one is loaded alone otherwise.
+    const searchVsDetailsDisambiguation =
+        hasSearch && hasDetails
+            ? `### Tool disambiguation
+- **\`${HELPER_TOOLS.STORE_SEARCH}\` vs \`${HELPER_TOOLS.ACTOR_GET_DETAILS}\`:**
+  \`${HELPER_TOOLS.STORE_SEARCH}\` finds Actors; \`${HELPER_TOOLS.ACTOR_GET_DETAILS}\` retrieves detailed info, README, and schema for a specific Actor.
+`
+            : hasSearch
+              ? `### Tool disambiguation
+- \`${HELPER_TOOLS.STORE_SEARCH}\` finds Actors by keyword.
+`
+              : hasDetails
+                ? `### Tool disambiguation
+- \`${HELPER_TOOLS.ACTOR_GET
```

**File**: `tests/unit/mcp.stateless.request_context.test.ts` (modified, +8/-0)
```diff
@@ -389,6 +389,14 @@ describe('createStatelessServer() request context', () => {
                 );
             },
         );
+
+        // Regression: pre-gating default is "all but report-problem", not "nothing" — must still mention call-actor.
+        it('mentions call-actor unconditionally, before any request establishes the real tool set', async () => {
+            await withStatelessServer(async ({ call }) => {
+                const discovered = await call('server/discover', {}, { client: { name: 'test-client' } });
+                expect(discovered.result?.instructions).toContain(HELPER_TOOLS.ACTOR_CALL);
+            });
+        });
     });
 
     describe('retained tool sources', () => {
```

**File**: `tests/unit/server-instructions.test.ts` (modified, +170/-9)
```diff
@@ -1,27 +1,188 @@
 import { describe, expect, it } from 'vitest';
 
-import { HELPER_TOOLS } from '../../src/const.js';
-import { SERVER_MODE } from '../../src/types.js';
+import { HELPER_TOOLS, RAG_WEB_BROWSER, WEB_FETCH } from '../../src/const.js';
+import { parseInputParamsFromUrl } from '../../src/mcp/utils.js';
+import { actorNameToToolName } from '../../src/tools/actor_tool_naming.js';
+import type { ToolDescriptionContext } from '../../src/types.js';
+import { ALL_TOOLS_PRESENT, SERVER_MODE } from '../../src/types.js';
 import { getServerInstructions } from '../../src/utils/server-instructions/index.js';
+import { getToolsForServerMode } from '../../src/utils/tools_loader.js';
+
+/** Context reporting every named tool present, everything else absent. */
+function only(...present: string[]): ToolDescriptionContext {
+    const set = new Set(present);
+    return { hasTool: (name) => set.has(name) };
+}
 
 describe('getServerInstructions()', () => {
+    it('defaults to ALL_TOOLS_PRESENT — no regression for the common case (every tool loaded)', () => {
+        expect(getServerInstructions(SERVER_MODE.DEFAULT)).toBe(
+            getServerInstructions(SERVER_MODE.DEFAULT, ALL_TOOLS_PRESENT),
+        );
+    });
+
     it('mentions report-problem with a gentle, non-mandatory nudge when feedback is available', () => {
-        const instructions = getServerInstructions(SERVER_MODE.DEFAULT, true);
+        const instructions = getServerInstructions(SERVER_MODE.DEFAULT, ALL_TOOLS_PRESENT);
         expect(instructions).toContain(HELPER_TOOLS.PROBLEM_REPORT);
         expect(instructions).toContain('you can report it');
         // No hard directive — the directory review rejects MUST-style solicitation.
         expect(instructions).not.toContain('MUST');
         expect(instructions).not.toContain('Reporting problems and feedback');
     });
 
-    it('omits report-problem by default', () => {
-        expect(getServerInstructions()).not.toContain(HELPER_TOOLS.PROBLEM_REPORT);
-    });
-
     it('describes a capped wait as returning the current run status', () => {
-        const instructions = getServerInstructions();
-
+        const instructions = getServerInstructions(SERVER_MODE.DEFAULT, ALL_TOOLS_PRESENT);
         expect(instructions).toContain('returns its current status and storage IDs');
         expect(instructions).not.toContain('returns its final status and storage IDs');
     });
+
+    it('mentions call-actor, apify/rag-web-browser and apify/web-fetch when all are loaded', () => {
+        const instructions = getServerInstructions(SERVER_MODE.DEFAULT, ALL_TOOLS_PRESENT);
+        expect(instructions).toContain(HELPER_TOOLS.ACTOR_CALL);
+        expect(instructions).toContain(RAG_WEB_BROWSER);
+        expect(instructions).toContain(WEB_FETCH);
+    });
+
+    it('omits every call-actor mention when call-actor is absent from the session', () => {
+        const instructions = getServerInstructions(SERVER_MODE.DEFAULT, only(HELPER_TOOLS.STORE_SEARCH));
+        expect(instructions).not.toContain(HELPER_TOOLS.ACTOR_CALL);
+        expect(instructions).toContain(HELPER_TOOLS.STORE_SEARCH); // no dead end
+    });
+
+    it('omits the apps-mode widget-disambiguation call-actor line when call-actor is absent', () => {
+        const instructions = getServerInstructions(SERVER_MODE.APPS, only(HELPER_TOOLS.STORE_SEARCH));
+        expect(instructions).not.toContain(HELPER_TOOLS.ACTOR_CALL);
+    });
+
+    it('omits report-problem when it is absent from the session', () => {
+        const instructions = getServerInstructions(SERVER_MODE.DEFAULT, only(HELPER_TOOLS.ACTOR_CALL));
+        expect(instructions).not.toContain(HELPER_TOOLS.PROBLEM_REPORT);
+        expect(instructions).toContain(HELPER_TOOLS.ACTOR_CALL); // no dead end
+    });
+
+    it('omits apify/rag-web-browser and apify/web-fetch mentions when both are absent', () => {
+        const instructions = getServerInstructions(SERVER_MODE.DEFAULT, only(HELPER_TOOLS.ACTOR_CALL));
+        expect(instructions).not.toContain(RAG_WEB_BROWSER);
+        expect(instructions).not.toContain(WEB_FETCH);
+        expect(instructions).toContain('Prefer dedicated tools when available'); // no dead end
+    });
+
+    // Regression: hasTool must match the registered tool name, not the Actor full name used for display text.
+    it('keeps the rag-web-browser/web-fetch comparisons when their real tool names are present', () => {
+        const instructions = getServerInstructions(
+            SERVER_MODE.DEFAULT,
+            only(HELPER_TOOLS.ACTOR_CALL, actorNameToToolName(RAG_WEB_BROWSER), actorNameToToolName(WEB_FETCH)),
+        );
+        expect(instructions).toContain(RAG_WEB_BROWSER);
+        expect(instructions).toContain(WEB_FETCH);
+    });
+
+    it('omits the search-vs-details disambiguation when only one side is loaded, but still names it', () => {
+        const searchOnly = getServerInstructions(SERVER_MODE.DEFAULT, only(HELPER_TOO
```

---

### Incident Patch 15: `38432458` (2026-09-09)
**Commit Message**: fix: Stop enforcing enum values dropped by input-schema truncation (#1258)

## What
Reworked per review: instead of a separate AJV-only validation schema,
the shared `shortenProperties()` now handles an oversized
`enum`/`items.enum` itself — kept in full when it fits
`ACTOR_ENUM_MAX_LENGTH` (no duplicate "Possible values" text, the `enum`
field already carries it), dropped entirely (not partially truncated)
when it doesn't, with a note + a few example values appended to the
description instead. One schema, no divergence between what the LLM sees
and what AJV validates, across all three consumers that share this path:
direct Actor tools, `call-actor`, and `fetch-actor-details`. When the
session's `tools/list` happens to include `fetch-actor-details`, the
dropped-enum note additionally points to it for more context on the
Actor — via a new per-session `buildInputSchema(ctx)` render on
`ToolBase` (mirrors the existing `buildDescription(ctx)` convention),
since a bare tool name can't be hardcoded into Actor input-schema text
without knowing whether that tool is actually loaded in a given session.

## Why
Closes #1253. Reviewer (jirispilka) asked for the enum keyword to be
removed entir

**File**: `README.md` (modified, +2/-2)
```diff
@@ -541,8 +541,8 @@ For step-by-step troubleshooting, see the [Claude Desktop integration guide](htt
 ## 💡 Limitations
 
 The Actor input schema is processed to be compatible with most MCP clients while adhering to [JSON Schema](https://json-schema.org/) standards. The processing includes:
-- **Descriptions** are truncated to 500 characters (as defined in `MAX_DESCRIPTION_LENGTH`).
-- **Enum fields** are truncated to a maximum combined length of 2000 characters for all elements (as defined in `ACTOR_ENUM_MAX_LENGTH`).
+- **Descriptions** longer than 500 characters (as defined in `ACTOR_MAX_DESCRIPTION_LENGTH`) are cut at the last complete sentence in that window, or the last complete word if there is no sentence break, and marked `[Description truncated]`.
+- **Enum fields** that fit within 2000 combined characters (as defined in `ACTOR_ENUM_MAX_LENGTH`) are kept in full; larger enums are omitted, with a short note and a few example values in the description instead.
 - **Required fields** are explicitly marked with a `REQUIRED` prefix in their descriptions for compatibility with frameworks that may not handle the JSON schema properly.
 - **Nested properties** are built for special cases like proxy configuration and request list sources to ensure the correct input structure.
 - **Array item types** are inferred when not explicitly defined in the schema, using a priority order: explicit type in items > prefill type > default value type > editor type.
```

**File**: `src/const.ts` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 // Actor input const
 export const ACTOR_README_MAX_LENGTH = 5_000;
-// Actor enum property max length, we need to make sure that most of the enum values fit into the input (such as geocodes)
+// Max total chars for an enum/items.enum to show in full; over this it's dropped entirely.
 export const ACTOR_ENUM_MAX_LENGTH = 2000;
 export const ACTOR_MAX_DESCRIPTION_LENGTH = 500;
 
```

**File**: `src/tools/actor_input_schema.ts` (modified, +55/-36)
```diff
@@ -267,21 +267,14 @@ export function inferArrayItemType(property: SchemaProperties): string | null {
 }
 
 /**
- * Add enum values as string to property descriptions, guarding against libraries/agent
- * frameworks that don't handle enums or examples via JSON Schema annotations.
- *
- * https://json-schema.org/understanding-json-schema/reference/enum
- * https://json-schema.org/understanding-json-schema/reference/annotations
- *
- * @param properties
+ * Adds prefill/default values to descriptions as examples, for clients that ignore JSON Schema
+ * `examples`. Never duplicates `enum` here — a kept enum already carries its values in the
+ * schema; only `shortenProperties()`'s dropped-enum note needs to spell them out in text.
  */
-export function addEnumsToDescriptionsWithExamples(
+export function addExampleValuesToDescriptions(
     properties: Record<string, SchemaProperties>,
 ): Record<string, SchemaProperties> {
     for (const property of Object.values(properties)) {
-        if (property.enum && property.enum.length > 0) {
-            property.description = `${property.description}\nPossible values: ${property.enum.slice(0, 20).join(',')}`;
-        }
         const value = property.prefill ?? property.default;
         if (value && !(Array.isArray(value) && value.length === 0)) {
             property.examples = Array.isArray(value) ? value : [value];
@@ -291,44 +284,70 @@ export function addEnumsToDescriptionsWithExamples(
     return properties;
 }
 
-/**
- * Helper function to filter and shorten the enum list.
- * Removes empty strings and truncates if the total character count exceeds the limit.
- *
- * @param {string[]} enumList - The list of enum values to be filtered and shortened.
- * @returns {string[] | undefined} - The filtered and shortened enum list or undefined if the list is too long.
- */
-export function filterAndShortenEnum(enumList: string[]): string[] | undefined {
-    let charCount = 0;
-    const resultEnumList = enumList.filter((enumValue) => {
-        if (enumValue === '') return false;
-        charCount += enumValue.length;
-        return charCount <= ACTOR_ENUM_MAX_LENGTH;
-    });
-
-    return resultEnumList.length > 0 ? resultEnumList : undefined;
+const ENUM_DROPPED_NOTE_EXAMPLE_COUNT = 10;
+const ENUM_DROPPED_NOTE_EXAMPLE_MAX_LENGTH = 60;
+
+/** Note for a dropped enum, with complete examples that remain valid inputs. */
+function buildEnumDroppedNote(rawValues: string[]): string {
+    const examples = rawValues
+        .filter((value) => value !== '' && value.length <= ENUM_DROPPED_NOTE_EXAMPLE_MAX_LENGTH)
+        .slice(0, ENUM_DROPPED_NOTE_EXAMPLE_COUNT);
+    const exampleText = examples.length > 0 ? ` Examples: ${examples.join(', ')}.` : '';
+    return `\n\nThe complete list of accepted values is too long to include.${exampleText}`;
 }
 
 /**
- * Shortens the description, enum, and items.enum properties of the schema properties.
- * This is mostly problem with compass/crawler-google-places, which has large number of categories
- * such as ( 'abbey', 'accountant', 'accounting',  'acupuncturist', .... )
- * @param properties
+ * Blanks removed, kept whole if it fits ACTOR_ENUM_MAX_LENGTH; otherwise dropped entirely
+ * — a partially-cut enum falsely implies exhaustiveness to both the LLM and AJV.
  */
+function getEnumIfFits(enumList: string[]): string[] | undefined {
+    const nonEmpty = enumList.filter((value) => value !== '');
+    if (nonEmpty.length === 0) return undefined;
+    const charCount = nonEmpty.reduce((sum, value) => sum + value.length, 0);
+    return charCount <= ACTOR_ENUM_MAX_LENGTH ? nonEmpty : undefined;
+}
+
+/** Cut at the last complete sentence in the cap, or the last complete word if there is none. */
+function shortenDescription(description: string): string {
+    const truncated = description.slice(0, ACTOR_MAX_DESCRIPTION_LENGTH);
+    const remainder = description.slice(ACTOR_MAX_DESCRIPTION_LENGTH);
+    const sentenceEnd =
+        [...truncated.matchAll(/[.!?](?=\s)/g)].at(-1)?.index ??
+        (/[.!?]$/.test(truncated) && /^\s/.test(remainder) ? truncated.length - 1 : undefined);
+    const shortened =
+        sentenceEnd === undefined
+            ? `${/^\s/.test(remainder) ? truncated.trimEnd() : truncated.replace(/\s+\S*$/, '')}…`
+            : truncated.slice(0, sentenceEnd + 1);
+    return `${shortened}\n\n[Description truncated]`;
+}
+
+function applyEnumLimit(holder: { enum?: string[] }, descriptionHost: SchemaProperties, rawEnum: string[]): void {
+    const enumValues = getEnumIfFits(rawEnum);
+    if (enumValues) {
+        holder.enum = enumValues;
+        return;
+    }
+    delete holder.enum;
+    if (rawEnum.some((value) => value !== '')) {
+        descriptionHost.description += buildEnumDroppedNote(rawEnum);
+    }
+}
+
+/** Caps description length; drops (not truncates) an oversized enum/items.enum, noting examples instead. */
 export function shortenProperties(properties: { [key: string]: Schema
```

**File**: `src/tools/actors/actor_tools_factory.ts` (modified, +1/-1)
```diff
@@ -97,7 +97,7 @@ export async function enrichActorToolOutputSchemas(tools: ToolEntry[], actorStor
  * 2. Nested properties are built by analyzing editor type (proxy, requestListSources) using buildNestedProperties()
  * 3. Properties are filtered using filterSchemaProperties()
  * 4. Properties are shortened using shortenProperties()
- * 5. Enums are added to descriptions with examples using addEnumsToDescriptionsWithExamples()
+ * 5. Prefill/default values are added to descriptions as examples using addExampleValuesToDescriptions()
  *
  * @param {ActorInfo[]} actorsInfo - An array of ActorInfo objects with webServerMcpPath, definition, and Actor.
  * @param options - Optional settings: mcpSessionId for telemetry correlation, actorStore for per-Actor itemsSchema enrichment.
```

**File**: `tests/unit/tools.utils.test.ts` (modified, +188/-62)
```diff
@@ -7,7 +7,6 @@ import {
     buildApifySpecificProperties,
     decodeDotPropertyNames,
     encodeDotPropertyNames,
-    filterAndShortenEnum,
     fixedAjvCompile,
     inferArrayItemsTypeIfMissing,
     inferArrayItemType,
@@ -355,9 +354,55 @@ describe('shortenProperties', () => {
 
         const result = shortenProperties(properties);
 
-        // Check that description was truncated
-        expect(result.prop1.description.length).toBeLessThanOrEqual(ACTOR_MAX_DESCRIPTION_LENGTH + 3); // +3 for "..."
-        expect(result.prop1.description.endsWith('...')).toBe(true);
+        expect(result.prop1.description.endsWith('…\n\n[Description truncated]')).toBe(true);
+    });
+
+    it('keeps the last complete sentence before a partial URL', () => {
+        const properties: Record<string, SchemaProperties> = {
+            prop1: {
+                type: 'string',
+                title: 'Property 1',
+                description: `Complete sentence. ${'https://example.com/path?query=value'.repeat(20)}`,
+            },
+        };
+
+        const result = shortenProperties(properties);
+
+        expect(result.prop1.description).toBe('Complete sentence.\n\n[Description truncated]');
+    });
+
+    it('keeps a complete last word when the overflow is the next word', () => {
+        const description = `${'x'.repeat(494)} hello more`;
+        const properties: Record<string, SchemaProperties> = {
+            prop1: {
+                type: 'string',
+                title: 'Property 1',
+                description,
+            },
+        };
+
+        const result = shortenProperties(properties);
+
+        expect(result.prop1.description).toContain('hello');
+        expect(result.prop1.description).not.toContain('more');
+        expect(result.prop1.description.endsWith('…\n\n[Description truncated]')).toBe(true);
+    });
+
+    it('keeps a sentence that ends at the exact cap', () => {
+        const description = `${'x'.repeat(ACTOR_MAX_DESCRIPTION_LENGTH - 1)}. more text that exceeds the cap`;
+        const properties: Record<string, SchemaProperties> = {
+            prop1: {
+                type: 'string',
+                title: 'Property 1',
+                description,
+            },
+        };
+
+        const result = shortenProperties(properties);
+
+        expect(result.prop1.description).toBe(
+            `${'x'.repeat(ACTOR_MAX_DESCRIPTION_LENGTH - 1)}.\n\n[Description truncated]`,
+        );
     });
 
     it('should not modify descriptions that are within limits', () => {
@@ -376,13 +421,74 @@ describe('shortenProperties', () => {
         expect(result.prop1.description).toBe(description);
     });
 
-    it('should shorten enum values if they exceed the limit', () => {
+    it('keeps the enum in full, with no note, when every value fits under the cap', () => {
+        const properties: Record<string, SchemaProperties> = {
+            prop1: {
+                type: 'string',
+                title: 'Property 1',
+                description: 'Property with enum',
+                enum: ['a', '', 'b', 'c'],
+            },
+        };
+
+        const result = shortenProperties(properties);
+
+        expect(result.prop1.enum).toEqual(['a', 'b', 'c']);
+        expect(result.prop1.description).toBe('Property with enum');
+    });
+
+    it('deletes an all-blank enum without adding a dropped-enum note', () => {
+        const properties: Record<string, SchemaProperties> = {
+            prop1: {
+                type: 'string',
+                title: 'Property 1',
+                description: 'Property with blank enum',
+                enum: ['', ''],
+            },
+        };
+
+        const result = shortenProperties(properties);
+
+        expect(result.prop1).not.toHaveProperty('enum');
+        expect(result.prop1.description).toBe('Property with blank enum');
+    });
+
+    it('drops the enum entirely (not partially) when the values don\u2019t fit the cap as a whole, noting a few examples', () => {
         // Create an enum with many values to exceed the character limit
         const value = 'enum-value-';
+        const description =
+            'You can limit the places that are scraped based on the Category filter; you can choose as many categories ' +
+            'for one flat fee for the whole field. ⚠️ Using categories can sometimes lead to false negatives, as many ' +
+            "places do not properly categorize themselves, and there are over <a href='https://api.apify.com/v2/" +
+            "key-value-stores/epxZwNRgmnzzBpNJd/records/categories'> 4,000</a> available categories which Google Maps " +
+            'has. Using categories might filter out places that you’d like to scrape. To avoid this problem, use categories carefully.';
         const enumValues = Array.from(
             { length: Math.ceil(ACTOR_ENUM_MAX_LENGTH / value.length) + 1 },
             (_, i) => `${value}${i}`,
         );
+        const properties: Record<string
```

#### Recent Merged Pull Requests:
- **PR #1476** (2026-10-05): fix(actors): Match TIP pilot by Actor full name across environments (@jirispilka)
- **PR #1474** (2026-10-05): fix(ci): Wait until npm serves the version before finishing publish (@jirispilka)
- **PR #1473** (2026-10-05): feat(telemetry): Add payment_provider to the tool-call Segment event (@MQ37)
- **PR #1468** (2026-10-01): fix(actors): limit and validate the RAG Web Browser TIP pilot (@jirispilka)
- **PR #1465** (2026-09-30): fix: Move get-actor-list out of the default actors category (@jirispilka)
- **PR #1458** (2026-09-29): refactor(x402)!: drop flat back-compat fields from _meta.x402 (@MQ37)
- **PR #1450** (2026-10-01): feat: Add get-actor-version tool (@DaveHanns)
- **PR #1449** (2026-09-29): test: Tighten unit-test coverage and reliability (@jirispilka)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
