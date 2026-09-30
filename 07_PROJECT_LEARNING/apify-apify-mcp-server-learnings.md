# Forensic Learning Record (Deep Inspection): apify/apify-mcp-server

> **Canonical Artifact**: `07_PROJECT_LEARNING/apify-apify-mcp-server-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/apify/apify-mcp-server](https://github.com/apify/apify-mcp-server))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:39:29.259Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `apify/apify-mcp-server`
- **Description**: The Apify MCP server enables your AI agents to extract data from social media, search engines, maps, e-commerce sites, or any other website using thousands of ready-made scrapers, crawlers, and automation tools available on the Apify Store.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 9125 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `evals/agent/claude_agent.ts`
```
/**
 * The agent under test: Claude Code, driven headlessly through the Claude Agent SDK.
 *
 * Each run spawns its own Apify MCP server from `dist/stdio.js` (fresh state per test)
 * and drives it with Claude Code's own system prompt and tool set, so the eval exercises
 * the server the way a real Claude Code user does. The SDK owns the MCP handshake and
 * shuts the subprocess down when the query ends.
 */

import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import type { HookCallbackMatcher, HookInput, Options, SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { query } from '@anthropic-ai/claude-agent-sdk';

import { REPORT_PROBLEM_NUDGE } from '../../src/tools/dev/report_problem.js';
import { MCP_SERVER_NAME, stripToolPrefix } from '../config.js';
import type { AttemptedToolCall } from '../runner/tool_call_mode.js';
import { TOOL_CALL_DENY_REASON, TOOL_CALL_MAX_TURNS } from '../runner/tool_call_mode.js';
import type { AdaptedConversation } from './conversation_adapter.js';
import { adaptSdkConversation } from './conversation_adapter.js';

/**
 * Maximum number of conversation turns before the agent query stops
 * (mapped onto the Agent SDK's `maxTurns` option).
 */
export const MAX_CONVERSATION_TURNS = 10;

export type AgentRunOptions = {
    prompt: string;
    model: string;
    apifyToken: string;
    /** Tools to enable on the MCP server, e.g. ["actors", "docs"]. Server default when omitted. */
    tools?: string[];
    /** Tools the harness refuses via a PreToolUse deny with a failure message. See denyToolsHook(). */
    failTools?: string[];
    maxTurns?: number;
    toolTimeoutSeconds: number;
    /** Restrict the agent to MCP tools only, dropping Claude Code's built-in toolset. */
    mcpToolsOnly: boolean;
    /** `kind: "tool-call"` items: deny every tool call and record the attempts, nothing executes. */
    isToolCallMode?: boolean;
};

/** Folded conversation and attempted tool calls. */
export type AgentRunResult = AdaptedConversation & {
    /** Calls the deny-all hook recorded. Empty for a `kind: "agent"` item; only the tool-call hook records. */
    attemptedCalls: AttemptedToolCall[];
};

const STDIO_BIN_PATH = resolve(process.cwd(), 'dist/stdio.js');

/** Number of trailing non-empty stderr lines kept to append to a thrown error. */
const MAX_APPENDED_STDERR_LINES = 5;

/** Throw with the fix if the MCP server has not been built yet. */
export function assertStdioBinExists(): void {
    if (!existsSync(STDIO_BIN_PATH)) {
        throw new Error(`MCP server binary not found at ${STDIO_BIN_PATH}. Run "pnpm run build" first.`);
    }
}

/** Creates a `PreToolUse` hook. A reason denies the call; `undefined` allows it. */
function preToolUseHook(decide: (toolName: string, toolInput: unknown) => string | undefined): HookCallbackMatcher[] {
    return [
        {
            hooks: [
                async (input: HookInput) => {
                    if (input.hook_event_name !== 'PreToolUse') return { continue: true };
                    const reason = decide(input.tool_name, input.tool_input);
                    if (reason === undefined) return { continue: true };

                    return {
                        hookSpecificOutput: {
                            hookEventName: 'PreToolUse',
                            permissionDecision: 'deny',
                            permissionDecisionReason: reason,
                        },
                    };
                },
            ],
        },
    ];
}

/**
 * Force-fails selected tools with the server's report-problem nudge so error-path cases do
 * not depend on a live server failure.
 */
export function denyToolsHook(failTools: string[]): HookCallbackMatcher[] {
    const failing = new Set(failTools);

    return preToolUseHook((toolName) => {
        const stripped = stripToolPrefix(toolName);
        if (!failing.has(stripped)) return undefined;
        return `The ${stripped} tool failed with an internal error.\n\n${REPORT_PROBLEM_NUDGE}`;
    });
}

/** Denies and records every tool call in tool-call mode. The scorer skips `ToolSearch` later. */
function toolCallDenyAllHook(attemptedCalls: AttemptedToolCall[]): HookCallbackMatcher[] {
    return preToolUseHook((toolName, toolInput) => {
        attemptedCalls.push({ toolName, input: toolInput });
        return TOOL_CALL_DENY_REASON;
    });
}

/** Run one test case to completion and fold the whole SDK stream into the judge's shape. */
export async function runAgentConversation(options: AgentRunOptions): Promise<AgentRunResult> {
    const { prompt, model, apifyToken, tools, failTools, maxTurns, toolTimeoutSeconds, mcpToolsOnly, isToolCallMode } =
        options;

    const serverArgs = [STDIO_BIN_PATH];
    if (tools && tools.length > 0) {
        serverArgs.push(`--tools=${tools.join(',')}`);
    }

    // Tears down the Claude Code + MCP-server subprocesses.
    const abortController = new AbortController();

    const attemptedCalls: AttemptedToolCall[] = [];

    // Append recent stderr lines so opaque subprocess failures retain the CLI's message.
    const stderrLines: string[] = [];

    const sdkOptions: Options = {
        model,
        systemPrompt: { type: 'preset', preset: 'claude_code' },
        tools: mcpToolsOnly ? [] : { type: 'preset', preset: 'claude_code' },
        mcpServers: {
            [MCP_SERVER_NAME]: {
                type: 'stdio',
                command: 'node',
                args: serverArgs,
                env: { ...process.env, APIFY_TOKEN: apifyToken },
                timeout: toolTimeoutSeconds * 1000,
                // Keep the server's tools in the prompt instead of behind tool search, or the
                // eval measures tool search rather than our tool descriptions.
                alwaysLoad: true,
            },
        },
        // Allow every call so nothing prompts; `bypassPermissions` is not an option because the
        // CLI refuses it under root. A tool-call item's deny-all hook still fires before this.
        canUseTool: async (_toolName, input) => ({ behavior: 'allow', updatedInput: input }),
        // Isolation: ignore this repo's settings and .mcp.json; configure everything in code.
        settingSources: [],
        strictMcpConfig: true,
        maxTurns: isToolCallMode ? TOOL_CALL_MAX_TURNS : (maxTurns ?? MAX_CONVERSATION_TURNS),
        // Away from the repo: the built-in tools must not read or write this checkout.
        cwd: tmpdir(),
        abortController,
        stderr: (data: string) => {
            for (const line of data.split('\n')) {
                if (!line.trim()) continue;
                // eslint-disable-next-line no-console
                console.error(`[claude-stderr] ${line}`);
                stderrLines.push(line);
                if (stderrLines.length > MAX_APPENDED_STDERR_LINES) stderrLines.shift();
            }
        },
        ...(isToolCallMode
            ? { hooks: { PreToolUse: toolCallDenyAllHook(attemptedCalls) } }
            : failTools && failTools.length > 0
              ? { hooks: { PreToolUse: denyToolsHook(failTools) } }
              : {}),
    };

    const messages: SDKMessage[] = [];
    // Arrival times, so the tool spans have real durations. The SDK stream carries no
    // timestamps and the messages are only folded once the run is over.
    const receivedAt: number[] = [];
    try {
        for await (const message of query({ prompt, options: sdkOptions })) {
            messages.push(message);
            receivedAt.push(Date.now());
        }
        return { ...adaptSdkConversation(prompt, messages, receivedAt), attemptedCalls };
    } catch (error) {
        // On error_max_turns the CLI exits non-zero after streaming its result message, and
        // the SDK rethrows that exit as "Claude Code returned an error result". The run is
        // complete from the model's side, so fold what arrived: the adapter keeps a
```

### Core Architecture Module: `evals/agent/conversation_adapter.ts`
```
/**
 * Folds the Claude Agent SDK's message stream into what the eval reads: the judge's
 * `ConversationHistory`, the tool invocations, the transcript, and the run metrics.
 *
 * The stream is an `init` system message, `assistant` messages (one frame per content
 * block, sharing `message.id` within a model turn), `user` messages carrying tool
 * results, and a final `result` message.
 */

import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';

import { isMcpToolName, stripToolPrefix } from '../config.js';

export type McpToolResult = {
    toolName: string;
    success: boolean;
    /** Result data if successful, error message if failed */
    result?: unknown;
    /** Error message if execution failed */
    error?: string;
    /** UTF-8 byte size of the serialized content the agent receives (set when the result is fed to the LLM) */
    resultBytes?: number;
};

export type ConversationTurn = {
    toolCalls: {
        name: string;
        arguments: Record<string, unknown>;
    }[];
    /** Agent text, set only on a turn that made no tool calls */
    finalResponse?: string;
};

/**
 * The conversation as the judge and the scores read it
 */
export type ConversationHistory = {
    userPrompt: string;
    turns: ConversationTurn[];
    /** Agent tokens across the conversation (prompt + completion); scored in Langfuse */
    totalTokens?: number;
};

/** One paired tool call + result, logged as a tool span under the item's trace. */
export type ToolInvocation = {
    name: string;
    arguments: unknown;
    result: McpToolResult;
    /** False for Claude Code's built-in tools, whose failures are not failures of the server. */
    isMcpTool: boolean;
    /** Epoch ms the call and its result were streamed, when the caller timed the stream */
    startedAt?: number;
    endedAt?: number;
};

/** A compact record of agent narration + thinking, logged to the item's trace (never judged). */
export type TranscriptEntry = {
    role: 'assistant';
    text?: string;
    thinking?: string;
    toolCalls?: string[];
};

/** Per-case metrics reconstructed from the SDK stream. */
export type ConversationMetrics = {
    resultBytes: number;
    turns: number;
    promptTokens?: number;
    completionTokens?: number;
    /** The share of promptTokens the API billed as cache reads / cache writes. */
    cacheReadTokens?: number;
    cacheCreationTokens?: number;
    totalCostUsd?: number;
    durationMs?: number;
};

export type AdaptedConversation = {
    conversation: ConversationHistory;
    toolInvocations: ToolInvocation[];
    metrics: ConversationMetrics;
    /**
     * Whether the run stopped on the turn limit instead of reaching a final answer. The
     * only non-success outcome that gets this far: every other subtype throws below.
     */
    hitMaxTurns: boolean;
    /**
     * Epoch ms the final model turn opened, when the caller timed the stream. The usage
     * generation is windowed to it rather than to the whole run.
     */
    finalTurnStartedAt?: number;
    /** Claude Code runtime version from the `init` message. */
    claudeCodeVersion?: string;
    /** Agent narration + thinking, for the item's trace. Not shown to the judge. */
    transcript: TranscriptEntry[];
};

/**
 * Block shapes the adapter reads. Every other type the SDK emits (images, redacted
 * thinking, ...) lands in `unread` and is skipped.
 */
type ContentBlock =
    | { type: 'text'; text: string }
    | { type: 'thinking'; thinking: string }
    | { type: 'tool_use'; id: string; name: string; input: unknown }
    | { type: 'tool_result'; tool_use_id: string; content: unknown; is_error?: boolean }
    | { type: 'unread' };

/** SDK message content is `string | Block[]`; normalize to the blocks we care about. */
function blocksOf(content: unknown): ContentBlock[] {
    return Array.isArray(content) ? (content as ContentBlock[]) : [];
}

/**
 * Error text as the model saw it. A failed result is usually a string or text blocks;
 * `JSON.stringify` on those would quote and escape them, which is what Langfuse then shows
 * as one `\n`-riddled line instead of a readable message.
 */
function errorTextOf(content: unknown): string {
    if (typeof content === 'string') return content;

    const texts = blocksOf(content)
        .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
        .map((block) => block.text);

    return texts.length > 0 ? texts.join('\n') : JSON.stringify(content ?? null, null, 4);
}

/** A tool_use awaiting its result, so the two can be paired. */
type PendingToolUse = {
    name: string;
    arguments: unknown;
    isMcpTool: boolean;
    startedAt?: number;
};

/**
 * `receivedAt` holds the epoch ms each message arrived, one per entry in `messages`. The
 * SDK stream carries no timestamps of its own, so this is the only way tool spans get a
 * real duration instead of collapsing to the moment the tree is emitted.
 */
export function adaptSdkConversation(
    userPrompt: string,
    messages: SDKMessage[],
    receivedAt?: readonly number[],
): AdaptedConversation {
    const turns: ConversationTurn[] = [];
    const toolInvocations: ToolInvocation[] = [];
    const transcript: TranscriptEntry[] = [];
    const pendingToolUses = new Map<string, PendingToolUse>();
    let totalResultBytes = 0;
    let claudeCodeVersion: string | undefined;
    let finalTurnStartedAt: number | undefined;

    let numTurns: number | undefined;
    let usage:
        | { promptTokens: number; completionTokens: number; cacheReadTokens: number; cacheCreationTokens: number }
        | undefined;
    let totalCostUsd: number | undefined;
    let durationMs: number | undefined;
    let resultSubtype: string | undefined;
    let resultErrors: string[] = [];
    let finalResultText = '';
    /**
     * The CLI splits every assistant turn into one wire frame per content block, all
     * sharing `message.id`, so consecutive frames with the same id fold into one turn.
     * Without this, narration that accompanies a tool call becomes its own text-only turn
     * and leaks to the judge as an AGENT: line, and turn counts inflate.
     */
    let openAssistantId: string | undefined;

    for (const [messageIndex, message] of messages.entries()) {
        const messageTime = receivedAt?.[messageIndex];

        // Ignore subagent activity so the transcript reflects the main agent.
        if ((message.type === 'assistant' || message.type === 'user') && message.parent_tool_use_id !== null) {
            continue;
        }

        if (message.type === 'system' && message.subtype === 'init') {
            claudeCodeVersion = message.claude_code_version;
            continue;
        }

        if (message.type === 'assistant') {
            const blocks = blocksOf(message.message.content);
            const messageId = message.message.id;
            const merging = messageId !== undefined && messageId === openAssistantId;
            openAssistantId = messageId;

            const textParts: string[] = [];
            const thinkingParts: string[] = [];
            const toolCalls: { name: string; arguments: Record<string, unknown> }[] = [];

            for (const block of blocks) {
                if (block.type === 'text') {
                    textParts.push(block.text);
                } else if (block.type === 'thinking') {
                    thinkingParts.push(block.thinking);
                } else if (block.type === 'tool_use') {
                    const name = stripToolPrefix(block.name);
                    toolCalls.push({ name, arguments: (block.input ?? {}) as Record<string, unknown> });
                    pendingToolUses.set(block.id, {
                        name,
                        arguments: block.input,
                        isMcpTool: isMcpToolName(block.name),
                        startedAt: messageTime,
                    });
                }
            }

            const text = textParts.join('\n').t
```

### Core Architecture Module: `evals/config.ts`
```
/**
 * Configuration shared across the eval harness's responsibilities.
 *
 * The agent's system prompt and tools come from the SDK's `claude_code` presets, so
 * nothing here defines them. The judge runs on OpenRouter (temperature 0.15, see
 * judge/openrouter_client.ts) by default, or on the Claude Agent SDK with
 * `--claude-judge` (see judge/claude_client.ts).
 */

/** Name the Claude Agent SDK registers the Apify MCP server under. */
export const MCP_SERVER_NAME = 'apify';

const MCP_TOOL_PREFIX = `mcp__${MCP_SERVER_NAME}__`;

/** Whether the SDK tool name belongs to the Apify MCP server rather than Claude Code's built-ins. */
export function isMcpToolName(name: string): boolean {
    return name.startsWith(MCP_TOOL_PREFIX);
}

/** Strip the SDK's `mcp__<server>__` prefix; built-in tool names pass through unchanged. */
export function stripToolPrefix(name: string): string {
    return isMcpToolName(name) ? name.slice(MCP_TOOL_PREFIX.length) : name;
}

/**
 * Default model configuration for agent and judge
 * These can be overridden via CLI arguments:
 *   --agent-model <model>
 *   --judge-model <model>
 */
export const MODELS = {
    // Agent model - an Anthropic model ID for the Claude Agent SDK. A weaker model on
    // purpose: it is a more sensitive probe of tool descriptions.
    agent: 'claude-haiku-4-5',

    // Judge model - evaluates conversation quality
    judge: 'deepseek/deepseek-v4-flash',

    // Judge model when the judge runs on the Claude Agent SDK (--claude-judge).
    claudeJudge: 'claude-sonnet-5',
};

```

### Core Architecture Module: `evals/environment.ts`
```
/**
 * Env var sanitization and missing-var reporting for the eval harness.
 */

/**
 * Strips control characters, trims whitespace, and removes surrounding double quotes.
 * CI secrets often contain trailing newlines or invisible control chars that break HTTP headers.
 */
export function sanitizeEnvValue(value?: string): string | undefined {
    if (value == null) return value;
    return (
        value
            // eslint-disable-next-line no-control-regex
            .replace(/[\x00-\x08\x0a-\x1f\x7f]/g, '')
            .trim()
            .replace(/^"|"$/g, '')
    );
}

/** Environment variables the Langfuse SDK reads to authenticate. */
export const LANGFUSE_ENV_VARS = ['LANGFUSE_PUBLIC_KEY', 'LANGFUSE_SECRET_KEY', 'LANGFUSE_BASE_URL'] as const;

/**
 * Env vars used in HTTP headers (API keys, tokens, URLs).
 *
 * Why in-place? The Langfuse SDK reads these directly from
 * process.env and passes them to node:http, which throws
 * ERR_INVALID_CHAR on any control characters. We can't intercept those reads, so
 * we sanitize process.env itself before any library loads.
 */
export const ENV_KEYS_TO_SANITIZE = ['APIFY_TOKEN', 'ANTHROPIC_API_KEY', 'OPENROUTER_API_KEY', ...LANGFUSE_ENV_VARS];

/**
 * Names of the given env vars that are unset or sanitize to empty (whitespace,
 * control chars, quotes only), so an entry point can report every missing one at
 * once up front instead of failing later with an opaque exporter error.
 */
export function findMissingEnvVars(keys: readonly string[]): string[] {
    return keys.filter((key) => !sanitizeEnvValue(process.env[key]));
}

/**
 * Redact a value for safe logging. Values longer than 12 chars show their first 3 and
 * last 3 chars, so at least 7 chars stay hidden; shorter values are masked entirely.
 * Returns '(empty)' for empty strings, '(unset)' for undefined/null.
 */
function redact(value?: string | null): string {
    if (value == null) return '(unset)';
    if (value.length === 0) return '(empty)';
    if (value.length <= 12) return `*** (${value.length} chars)`;
    return `${value.slice(0, 3)}***${value.slice(-3)} (${value.length} chars)`;
}

/**
 * Sanitize env vars in-place on process.env and log redacted values for CI debugging.
 * Must be called before constructing any client that reads them.
 */
export function sanitizeProcessEnv(): void {
    for (const key of ENV_KEYS_TO_SANITIZE) {
        const raw = process.env[key];
        if (raw != null) {
            const sanitized = sanitizeEnvValue(raw)!;
            const changed = raw !== sanitized;
            process.env[key] = sanitized;
            // eslint-disable-next-line no-console
            console.log(`env ${key}: ${redact(sanitized)}${changed ? ' (sanitized)' : ''}`);
        } else {
            // eslint-disable-next-line no-console
            console.log(`env ${key}: ${redact(raw)}`);
        }
    }
}

```

### Core Architecture Module: `evals/judge/claude_client.ts`
```
/**
 * Judge LLM client backed by the Claude Agent SDK, for runs without an OpenRouter key.
 *
 * Selected with `--claude-judge`. Each call spawns a short-lived Claude Code subprocess
 * (no tools, one turn) that authenticates like the `--subscription` agent does: local
 * Claude Code login, or whatever provider the environment supplies. The SDK exposes no
 * temperature control, so verdicts are less deterministic than OpenRouter's 0.15 — the
 * structured verdict schema keeps that from mattering in practice.
 */

import { tmpdir } from 'node:os';

import { query } from '@anthropic-ai/claude-agent-sdk';
import { startActiveObservation } from '@langfuse/tracing';
// eslint-disable-next-line import/extensions
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
// eslint-disable-next-line import/extensions
import type { ResponseFormatJSONSchema } from 'openai/resources/shared';

import { type JudgeClient, type LlmResponse, type LlmUsage, toUsageDetails } from './client.js';

/**
 * The model's answer may wrap the verdict JSON in code fences or prose. Return the JSON
 * object substring (first '{' to last '}'), or the input unchanged when there is none —
 * the caller's JSON parse then fails with the raw text in the error.
 */
export function extractJsonObject(text: string): string {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end <= start) return text;
    return text.slice(start, end + 1);
}

/** Flatten chat messages into one prompt; the judge sends a single user message. */
function messagesToPrompt(messages: ChatCompletionMessageParam[]): string {
    return messages
        .map((message) => (typeof message.content === 'string' ? message.content : JSON.stringify(message.content)))
        .join('\n\n');
}

export class ClaudeJudgeClient implements JudgeClient {
    /**
     * Same surface as `OpenRouterClient.callLlm`: `responseFormat` is enforced by
     * instruction + extraction rather than by the API. Traced as a Langfuse generation
     * like the OpenRouter client.
     */
    async callLlm(
        messages: ChatCompletionMessageParam[],
        model: string,
        responseFormat?: ResponseFormatJSONSchema,
    ): Promise<LlmResponse> {
        let prompt = messagesToPrompt(messages);
        if (responseFormat) {
            prompt +=
                `\n\nRespond with a single JSON object only - no prose, no code fences - ` +
                `matching this JSON schema:\n${JSON.stringify(responseFormat.json_schema.schema)}`;
        }

        return startActiveObservation(
            model,
            async (generation) => {
                generation.update({ model, input: messages });
                const llmResponse = await this.sendRequest(prompt, model);
                if (responseFormat && llmResponse.content) {
                    llmResponse.content = extractJsonObject(llmResponse.content);
                }
                generation.update({
                    output: llmResponse.content,
                    ...toUsageDetails(llmResponse.usage),
                });
                return llmResponse;
            },
            { asType: 'generation' },
        );
    }

    /** One single-turn, tool-less Claude Code run; its result text is the LLM response. */
    private async sendRequest(prompt: string, model: string): Promise<LlmResponse> {
        // No tools and one turn: nothing needs permissions, so the default permission mode
        // works everywhere (bypassPermissions would refuse to run as root without a sandbox).
        for await (const message of query({
            prompt,
            options: {
                model,
                maxTurns: 1,
                tools: [],
                settingSources: [],
                cwd: tmpdir(),
            },
        })) {
            if (message.type !== 'result') continue;
            if (message.subtype !== 'success') {
                const detail = message.errors.join('; ') || 'no error detail';
                throw new Error(`Claude judge run ended with "${message.subtype}": ${detail}`);
            }
            let usage: LlmUsage | undefined;
            if (message.usage) {
                // Cached input tokens count as prompt tokens, like OpenRouter reports them.
                const promptTokens =
                    message.usage.input_tokens +
                    (message.usage.cache_read_input_tokens ?? 0) +
                    (message.usage.cache_creation_input_tokens ?? 0);
                usage = {
                    promptTokens,
                    completionTokens: message.usage.output_tokens,
                    totalTokens: promptTokens + message.usage.output_tokens,
                };
            }
            return { content: message.result, usage };
        }
        throw new Error('Claude judge run produced no result message');
    }
}

```

### Core Architecture Module: `evals/judge/client.ts`
```
/**
 * The LLM contract the judge calls through, shared by the OpenRouter client
 * (default) and the Claude Agent SDK client (`--claude-judge`).
 */

// eslint-disable-next-line import/extensions
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
// eslint-disable-next-line import/extensions
import type { ResponseFormatJSONSchema } from 'openai/resources/shared';

/**
 * Token usage reported by the LLM API for a single call
 */
export type LlmUsage = {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
};

export type LlmResponse = {
    content: string | null;
    /** Token usage for this call (undefined if the provider did not report it) */
    usage?: LlmUsage;
};

/**
 * What the judge needs from an LLM client. Implemented by `OpenRouterClient`
 * and `ClaudeJudgeClient` (Claude Agent SDK, `--claude-judge`).
 */
export interface JudgeClient {
    callLlm(
        messages: ChatCompletionMessageParam[],
        model: string,
        responseFormat?: ResponseFormatJSONSchema,
    ): Promise<LlmResponse>;
}

/** Langfuse generation-update fields for a usage report; empty when the provider sent none. */
export function toUsageDetails(usage?: LlmUsage): { usageDetails?: { input: number; output: number; total: number } } {
    if (!usage) return {};
    return {
        usageDetails: {
            input: usage.promptTokens,
            output: usage.completionTokens,
            total: usage.totalTokens,
        },
    };
}

```

### Core Architecture Module: `evals/judge/judge.ts`
```
/**
 * LLM Judge for evaluating conversation quality
 * Uses structured output (JSON schema) for robust parsing
 */

// eslint-disable-next-line import/extensions
import type { ResponseFormatJSONSchema } from 'openai/resources/shared';
import { z } from 'zod';

import type { ConversationHistory } from '../agent/conversation_adapter.js';
import { MODELS } from '../config.js';
import type { JudgeClient } from './client.js';

/**
 * Judge prompt template for evaluating conversations
 * Uses structured output (JSON schema) - no format instructions needed
 *
 * Variables:
 * - {{reference}}: The requirements the agent should meet
 * - {{conversation}}: The formatted conversation to evaluate
 */
export const JUDGE_PROMPT_TEMPLATE = `You are evaluating whether an AI agent successfully completed a user's task using available tools.

TASK REQUIREMENTS:
{{reference}}

AGENT CONVERSATION:
{{conversation}}

Your task is to evaluate if the agent met ALL the requirements listed above.

Evaluation criteria:
1. Did the agent use appropriate tools to accomplish the task?
2. Were the tool calls made with correct arguments?
3. Did the agent provide a clear, helpful final response to the user?
4. Did the agent fully address all requirements?

Important notes:
- Focus on whether requirements were met, not on writing style
- The agent may use different tools than expected if they accomplish the same goal
- Tool results are not shown (only tool calls and agent responses)
- Minor inefficiencies are acceptable if the task was completed

Provide your evaluation with a verdict (PASS or FAIL) and a brief explanation (1-2 sentences).`;

export type JudgeResult = {
    verdict: 'PASS' | 'FAIL';
    reason: string;
    /** Kept for debugging via the Langfuse task output; nothing in evals/ reads it. */
    rawResponse: string;
};

/** Judge calls per item before the parse failure is fatal. */
const JUDGE_PARSE_ATTEMPTS = 2;

/**
 * JSON schema for structured judge output
 * Guarantees the LLM returns valid JSON matching this schema
 */
const JUDGE_RESPONSE_SCHEMA: ResponseFormatJSONSchema = {
    type: 'json_schema',
    json_schema: {
        name: 'judge_evaluation',
        strict: true,
        schema: {
            type: 'object',
            properties: {
                verdict: {
                    type: 'string',
                    enum: ['PASS', 'FAIL'],
                    description: 'Whether the agent passed or failed the evaluation',
                },
                reason: {
                    type: 'string',
                    description: 'Brief explanation in 1-2 sentences explaining why the agent passed or failed',
                },
            },
            required: ['verdict', 'reason'],
            additionalProperties: false,
        },
    },
};

/**
 * Judge sees tool calls + arguments + final responses, NOT tool results: the judge grades
 * agent behavior (tool selection, arguments) and the agent's own summary of the results;
 * raw results are long and noisy and would drown the transcript.
 */
function formatConversationForJudge(conversation: ConversationHistory): string {
    const lines: string[] = [];

    // User prompt
    lines.push(`USER: ${conversation.userPrompt}`);
    lines.push('');

    // Each turn
    for (const turn of conversation.turns) {
        // Show tool calls (if any)
        if (turn.toolCalls.length > 0) {
            for (const toolCall of turn.toolCalls) {
                lines.push(`AGENT: [Called tool: ${toolCall.name} with args: ${JSON.stringify(toolCall.arguments)}]`);
            }
        }

        // Show final response (if present)
        if (turn.finalResponse) {
            lines.push(`AGENT: ${turn.finalResponse}`);
        }

        lines.push('');
    }

    return lines.join('\n').trim();
}

/**
 * Judge output as it comes back over the wire. JUDGE_RESPONSE_SCHEMA asks for a strict
 * schema, but that is only honoured by some OpenRouter providers, so normalize the
 * casing the judge actually reached a verdict in rather than discard the item.
 * Structure only: an unrecognized verdict stays an error, never a guess.
 */
const JudgeResponseValidator = z.object({
    verdict: z
        .string()
        .trim()
        .toUpperCase()
        .pipe(z.enum(['PASS', 'FAIL'])),
    reason: z.string().min(1),
});

/**
 * Some providers answer in prose that still opens with the verdict ("FAIL. The agent ...").
 * Recover the verdict and use the rest as the reason before spending a retry call on it.
 * Anything not opening with PASS/FAIL stays unparsed.
 */
const PROSE_VERDICT_PATTERN = /^\s*(PASS|FAIL)\b[.:!-]?\s*(.*)$/is;

/**
 * Parse the judge response: strict JSON first, prose-verdict fallback second.
 */
export function parseJudgeResponse(response: string): { verdict: 'PASS' | 'FAIL'; reason: string } {
    try {
        return JudgeResponseValidator.parse(JSON.parse(response));
    } catch (error) {
        const prose = PROSE_VERDICT_PATTERN.exec(response);
        if (prose) {
            return JudgeResponseValidator.parse({ verdict: prose[1], reason: prose[2].trim() || 'no reason given' });
        }
        // No raw response here: the retry loop's final throw already carries it.
        throw new Error(
            `Failed to parse judge JSON response: ${error instanceof Error ? error.message : String(error)}`,
        );
    }
}

export async function evaluateConversation(
    reference: string,
    conversation: ConversationHistory,
    llmClient: JudgeClient,
    judgeModel: string = MODELS.judge,
): Promise<JudgeResult> {
    // Format conversation for judge
    const formattedConversation = formatConversationForJudge(conversation);

    // Create judge prompt using reference field. Both values are substituted through a
    // function so `$&`, `$'`, `` $` `` and `$$` (routine in Bash commands the agent runs)
    // are inserted literally instead of being read as replacement patterns.
    const judgePrompt = JUDGE_PROMPT_TEMPLATE.replace('{{reference}}', () => reference).replace(
        '{{conversation}}',
        () => formattedConversation,
    );

    // parseJudgeResponse already recovers a prose verdict (e.g. "PASS: ..."); this retry
    // is for answers that carry no parsable verdict at all. One fresh judge call recovers
    // those without rerunning the far more expensive agent conversation; a second
    // malformed answer still throws.
    let lastError: unknown;
    let lastRawResponse = '';
    for (let attempt = 1; attempt <= JUDGE_PARSE_ATTEMPTS; attempt++) {
        const response = await llmClient.callLlm(
            [{ role: 'user', content: judgePrompt }],
            judgeModel,
            JUDGE_RESPONSE_SCHEMA,
        );
        lastRawResponse = response.content || '';

        try {
            return { ...parseJudgeResponse(lastRawResponse), rawResponse: lastRawResponse };
        } catch (error) {
            lastError = error;
        }
    }
    // The raw answer is the only evidence of what the judge actually said; without it the
    // failure is undebuggable.
    throw new Error(
        `Failed to parse judge response after ${JUDGE_PARSE_ATTEMPTS} attempts: ` +
            `${lastError instanceof Error ? lastError.message : String(lastError)}\n` +
            `Last raw response: ${lastRawResponse}`,
    );
}

```

### Core Architecture Module: `evals/judge/openrouter_client.ts`
```
/**
 * LLM client for calling OpenRouter API
 */

import { startActiveObservation } from '@langfuse/tracing';
import OpenAI from 'openai';
// eslint-disable-next-line import/extensions
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
// eslint-disable-next-line import/extensions
import type { ResponseFormatJSONSchema } from 'openai/resources/shared';

import { sanitizeEnvValue } from '../environment.js';
import { type JudgeClient, type LlmResponse, type LlmUsage, toUsageDetails } from './client.js';

/** OpenRouter API configuration */
export const OPENROUTER_CONFIG = {
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: sanitizeEnvValue(process.env.OPENROUTER_API_KEY) || '',
};

/** Low temperature for deterministic evaluation results. */
const TEMPERATURE = 0.15;

export class OpenRouterClient implements JudgeClient {
    private openai: OpenAI;

    constructor() {
        if (!OPENROUTER_CONFIG.apiKey) {
            throw new Error('OPENROUTER_API_KEY environment variable is required');
        }

        this.openai = new OpenAI({
            baseURL: OPENROUTER_CONFIG.baseURL,
            apiKey: OPENROUTER_CONFIG.apiKey,
        });
    }

    /**
     * Traced as a Langfuse generation, nested under whichever observation is active at the
     * call site: inside the experiment task that is the item's trace, so a judge call shows
     * up with its prompt, verdict, tokens, and cost.
     */
    async callLlm(
        messages: ChatCompletionMessageParam[],
        model: string,
        responseFormat?: ResponseFormatJSONSchema,
    ): Promise<LlmResponse> {
        return startActiveObservation(
            model,
            async (generation) => {
                generation.update({ model, input: messages, modelParameters: { temperature: TEMPERATURE } });
                const llmResponse = await this.sendRequest(messages, model, responseFormat);
                generation.update({
                    output: llmResponse.content,
                    ...toUsageDetails(llmResponse.usage),
                });
                return llmResponse;
            },
            { asType: 'generation' },
        );
    }

    /** The request itself, untraced. */
    private async sendRequest(
        messages: ChatCompletionMessageParam[],
        model: string,
        responseFormat?: ResponseFormatJSONSchema,
    ): Promise<LlmResponse> {
        const response = await this.openai.chat.completions.create({
            model,
            messages,
            temperature: TEMPERATURE,
            ...(responseFormat ? { response_format: responseFormat } : {}),
        });

        const message = response.choices[0]?.message;

        if (!message) {
            throw new Error('LLM returned no message');
        }

        const usage: LlmUsage | undefined = response.usage
            ? {
                  promptTokens: response.usage.prompt_tokens,
                  completionTokens: response.usage.completion_tokens,
                  totalTokens: response.usage.total_tokens,
              }
            : undefined;

        return {
            content: message.content || null,
            usage,
        };
    }
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

### Incident Patch 1: `9b2a34c7` (2026-09-30)
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

Co-authored-by: Claude <noreply@anthropic.com>

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

---

### Incident Patch 2: `18d3a24b` (2026-09-22)
**Commit Message**: fix: state the new published task limits in publish-actor-task (#1404)

Part of apify/apify-core#30452.
The platform limits change in apify/apify-core#30442: 10 published tasks
per Actor (was 50) and a new limit of 100 published tasks per account.

The `publish-actor-task` tool description told agents "At most 50 tasks
can be published per Actor", which would make them retry into a 400.

Merge only after the apify-core change ships.

Co-authored-by: Claude Opus 5 (1M context) <noreply@anthropic.com>

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

### Incident Patch 3: `d88568c1` (2026-09-17)
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
 
     console.log(IS_DRY_RUN ? '✅ Dry run complete, nothing chang
```

---

### Incident Patch 4: `bb123ff1` (2026-09-15)
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
+        if (!IS_DRY_RUN) await client.sch
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

### Incident Patch 5: `a4dafc4a` (2026-09-11)
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

---

### Incident Patch 6: `63557245` (2026-09-10)
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
-            idempotentHint
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
- * Resolve tool categories for a given s
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
 
-    // get-actor-run-widget auto-loads with get-ac
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
+    // get-actor-run's nextStep t
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

---

### Incident Patch 7: `aa9f7b37` (2026-09-10)
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

---

### Incident Patch 8: `49243e97` (2026-09-10)
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
+  - Supports a \`waitSecs\` parameter (default 30, max
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
+        const instructions = getServerInstructions(SERVER_MODE.DEFAULT, only(HE
```

---

### Incident Patch 9: `38432458` (2026-09-09)
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
+        [...trun
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
+    it('drops the enum entirely (not partially) when the values don\u2019t fit the cap as a whole, noting 
```

---

### Incident Patch 10: `2d1c6dca` (2026-09-03)
**Commit Message**: fix: Use canonical Apify docs MCP URL in server card (#1325)

<!-- A PR that is hard to review is not ready for review. One concern
per PR, clean diff (no debug logs, formatting noise, commented-out
code). -->

<!-- AI agents: fill in Why, What changed, and Proof it works. Leave
"Notes for reviewers" empty — it belongs to the human author. No file
lists, no restating the diff, no praising the change. -->

<!-- Human author: an AI draft is a draft, not a description. Before
requesting review: (1) self-review your own diff in the GitHub UI, (2)
check every claim below against the diff and cut what you wouldn't say
yourself, (3) write "Notes for reviewers" in your own words. -->

> **Outside contributors:** maintainers implement unassigned issues.
Unless this is a documentation fix or a maintainer asked you to write
it, close this and [open an
issue](https://github.com/apify/apify-mcp-server/issues) instead. A
reproduction is more useful than a patch. See [Before you write
code](https://github.com/apify/apify-mcp-server/blob/master/CONTRIBUTING.md#before-you-write-code).
Using AI? [Disclose it and show
proof](https://github.com/apify/apify-mcp-server/blob/master/CONTRIBUTING.md#ai-ass

**File**: `src/const.ts` (modified, +1/-1)
```diff
@@ -241,7 +241,7 @@ export const STAGING_MCP_HOSTNAME = 'mcp-securitybyobscurity.apify.com';
 export const APIFY_FAVICON_URL = `${APIFY_STORE_URL}/favicon.ico`;
 export const APIFY_LOGO_URL = `${APIFY_STORE_URL}/apple-icon.png`;
 export const APIFY_MCP_URL = 'https://mcp.apify.com';
-export const APIFY_DOCS_MCP_URL = 'https://docs.apify.com/platform/integrations/mcp';
+export const APIFY_DOCS_MCP_URL = 'https://docs.apify.com/integrations/mcp';
 
 // Telemetry
 export const TELEMETRY_ENV = {
```

**File**: `tests/unit/server_card.test.ts` (modified, +1/-1)
```diff
@@ -125,7 +125,7 @@ describe('getServerCard()', () => {
         it('includes documentation URL', () => {
             const card = getServerCard();
 
-            expect(card.documentationUrl).toBe('https://docs.apify.com/platform/integrations/mcp');
+            expect(card.documentationUrl).toBe('https://docs.apify.com/integrations/mcp');
         });
     });
 
```

#### Recent Merged Pull Requests:
- **PR #1465** (2026-09-30): fix: Move get-actor-list out of the default actors category (@jirispilka)
- **PR #1458** (2026-09-29): refactor(x402)!: drop flat back-compat fields from _meta.x402 (@MQ37)
- **PR #1449** (2026-09-29): test: Tighten unit-test coverage and reliability (@jirispilka)
- **PR #1434** (2026-09-29): feat: Add get-actor-list tool (@DaveHanns)
- **PR #1431** (2026-09-29): feat: Add get-actor-build-list tool (@DaveHanns)
- **PR #1422** (2026-09-22): feat: Run against a non-production platform with matching links (@mfori)
- **PR #1406** (2026-09-22): docs: Say call-actor's actor parameter takes an ID or a name (@DaveHanns)
- **PR #1405** (2026-09-22): ci: bump pr-title-check action to v1.6.1 (@janbuchar)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
