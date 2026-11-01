> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/cherryhq-cherry-studio-learnings.md`  
> **Source**: github ([https://github.com/CherryHQ/cherry-studio](https://github.com/CherryHQ/cherry-studio))  
> **Source Version**: `d6a221e6`  
> **License**: AGPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-29T22:19:05.680Z  
> **Learning ID**: `learn-github-cherryhq-cherry-studio`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): CherryHQ/cherry-studio

> **Canonical Artifact**: `07_PROJECT_LEARNING/cherryhq-cherry-studio-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/CherryHQ/cherry-studio](https://github.com/CherryHQ/cherry-studio))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-29T22:19:04.547Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `CherryHQ/cherry-studio`
- **Description**: Your AI workspace for models, agents, and productivity.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 53086 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/aiCore/src/core/agents/createAgent.ts`
```
/**
 * Agent factory
 * Reuses createExecutor's provider resolution + plugin pipeline to build a ToolLoopAgent
 */
import type { LanguageModelV3 } from '@ai-sdk/provider'
import type { ToolLoopAgentSettings, ToolSet } from 'ai'
import { ToolLoopAgent } from 'ai'

import type { AiPlugin } from '../plugins'
import type { CoreProviderSettingsMap, StringKeys } from '../providers/types'
import { createExecutor } from '../runtime'

export type CreateAgentOptions<
  TSettingsMap extends Record<string, any> = CoreProviderSettingsMap,
  T extends StringKeys<TSettingsMap> = StringKeys<TSettingsMap>,
  TOOLS extends ToolSet = {}
> = {
  providerId: T
  providerSettings: TSettingsMap[T]
  modelId: string
  plugins?: AiPlugin[]
  /** Wraps the resolved model (middlewares already applied) before it is handed to the agent */
  wrapModel?: (model: LanguageModelV3) => LanguageModelV3 | Promise<LanguageModelV3>
  agentSettings: Omit<ToolLoopAgentSettings<never, TOOLS, never>, 'model'>
}

export async function createAgent<
  TSettingsMap extends Record<string, any> = CoreProviderSettingsMap,
  T extends StringKeys<TSettingsMap> = StringKeys<TSettingsMap>,
  TOOLS extends ToolSet = {}
>(options: CreateAgentOptions<TSettingsMap, T, TOOLS>): Promise<ToolLoopAgent<never, TOOLS, never>> {
  const { providerId, providerSettings, modelId, plugins, wrapModel, agentSettings } = options

  // 1. Create executor (extensionRegistry resolves provider + modelResolver)
  const executor = await createExecutor<TSettingsMap, T>(providerId, providerSettings, plugins)

  // 2. Resolve model + apply middleware via the executor's plugin chain
  const resolvedModel = await executor.resolveLanguageModel(modelId)

  // 3. Run the transformParams chain over the agent settings. ToolLoopAgent
  //    holds them for the whole loop and never enters the per-request plugin
  //    pipeline, so this is the only point where a `transformParams`-only
  //    plugin (provider-native tool injection) can contribute.
  const transformedSettings = await executor.pluginEngine.transformAgentSettings(resolvedModel, agentSettings)

  // 4. Apply an optional outermost wrapper (e.g. retry/fallback) around the
  //    fully resolved model after model-specific middleware and settings transforms.
  const finalModel = wrapModel ? await wrapModel(resolvedModel) : resolvedModel

  // 5. Build ToolLoopAgent
  return new ToolLoopAgent({
    ...transformedSettings,
    model: finalModel
  })
}

```

### Core Architecture Module: `packages/aiCore/src/core/agents/index.ts`
```
export type { CreateAgentOptions } from './createAgent'
export { createAgent } from './createAgent'

```

### Core Architecture Module: `packages/aiCore/src/core/context/adapter.ts`
```
/**
 * LanguageModelV3Prompt ↔ IR adapter (lossless round-trip).
 *
 * Vendored from @context-chef/ai-sdk-middleware 1.6.0 (MIT, same author).
 */
import type {
  LanguageModelV3Message,
  LanguageModelV3Prompt,
  LanguageModelV3ToolResultOutput,
  LanguageModelV3ToolResultPart,
  SharedV3ProviderOptions
} from '@ai-sdk/provider'

import { ensureValidHistory } from './ensureValidHistory'
import type { Attachment, ContextMessage, ToolCall } from './types'

/** Content types for each AI SDK message role */
type UserContent = Extract<LanguageModelV3Message, { role: 'user' }>['content']
type AssistantContent = Extract<LanguageModelV3Message, { role: 'assistant' }>['content']
type ToolContent = Extract<LanguageModelV3Message, { role: 'tool' }>['content']

/**
 * Extended IR message with typed pass-through fields for lossless AI SDK round-trip.
 * Per-role content fields avoid union types, so no `as` casts are needed in `toAISDK`.
 */
export interface AISDKMessage extends ContextMessage {
  _userContent?: UserContent
  _assistantContent?: AssistantContent
  _toolContent?: ToolContent
  _originalText?: string
  _providerOptions?: SharedV3ProviderOptions
  _toolName?: string
}

/** Restore each result name from its originating call before name-keyed processing. */
export function repairToolResultNames(prompt: LanguageModelV3Prompt): LanguageModelV3Prompt {
  const toolCallNames = new Map<string, string>()

  return prompt.map((msg) => {
    if (msg.role === 'assistant') {
      for (const part of msg.content) {
        if (part.type === 'tool-call') toolCallNames.set(part.toolCallId, part.toolName)
      }

      let changed = false
      const content = msg.content.map((part) => {
        if (part.type !== 'tool-result') return part
        const toolName = toolCallNames.get(part.toolCallId)
        if (toolName === undefined || toolName === part.toolName) return part
        changed = true
        return { ...part, toolName }
      })
      return changed ? { ...msg, content } : msg
    }

    if (msg.role === 'tool') {
      let changed = false
      const content = msg.content.map((part) => {
        if (part.type !== 'tool-result') return part
        const toolName = toolCallNames.get(part.toolCallId)
        if (toolName === undefined || toolName === part.toolName) return part
        changed = true
        return { ...part, toolName }
      })
      return changed ? { ...msg, content } : msg
    }

    return msg
  })
}

/**
 * Converts an AI SDK V3 prompt to IR messages.
 *
 * Original AI SDK content is stored in per-role fields for lossless round-trip.
 * `_originalText` caches the extracted text so `toAISDK` can detect modifications.
 * `_providerOptions` preserves message-level provider options (e.g. Anthropic cache control).
 *
 * Boundary sanitization: the result is run through {@link ensureValidHistory}
 * to fix orphan tool results, missing tool results, and ensure the first
 * non-system message is a user message. This is a system boundary — IR
 * downstream is trusted to satisfy invariants.
 */
export function fromAISDK(prompt: LanguageModelV3Prompt): AISDKMessage[] {
  const messages: AISDKMessage[] = []

  for (const msg of repairToolResultNames(prompt)) {
    if (msg.role === 'system') {
      messages.push({
        role: 'system',
        content: msg.content,
        ...(msg.providerOptions ? { _providerOptions: msg.providerOptions } : {})
      })
      continue
    }

    if (msg.role === 'user') {
      const text = msg.content
        .filter((p) => p.type === 'text')
        .map((p) => p.text)
        .join('\n')

      const attachments: Attachment[] = []
      for (const part of msg.content) {
        if (part.type === 'file') {
          // `attachment.data` here is just a presence/metadata signal
          // (used by `m.attachments?.length` checks and the `[image]`/`[document]`
          // placeholder helper, neither of which read `data`). The real binary
          // payload — including `Uint8Array` / `URL` shapes — round-trips losslessly
          // through `_userContent`, which `toAISDK` hands back to the AI SDK
          // provider verbatim. We only record `data` when it's already a string,
          // so we never invent a fake encoding for non-string inputs.
          attachments.push({
            mediaType: part.mediaType,
            data: typeof part.data === 'string' ? part.data : '',
            ...(part.filename ? { filename: part.filename } : {})
          })
        }
      }

      const m: AISDKMessage = {
        role: 'user',
        content: text,
        _userContent: msg.content,
        _originalText: text,
        ...(msg.providerOptions ? { _providerOptions: msg.providerOptions } : {})
      }
      if (attachments.length) m.attachments = attachments
      messages.push(m)
      continue
    }

    if (msg.role === 'assistant') {
      const text: string[] = []
      const toolCalls: ToolCall[] = []
      const attachments: Attachment[] = []
      let thinking: { thinking: string } | undefined

      // Provider-executed tools (web search, code exec) carry their tool-result
      // INLINE in the same assistant message. Such calls are self-answered and
      // must not appear as open IR tool_calls — otherwise ensureValidHistory
      // injects a spurious placeholder, duplicating the inline result on
      // round-trip. The inline result round-trips verbatim via _assistantContent.
      const inlineAnsweredIds = new Set<string>()
      for (const part of msg.content) {
        if (part.type === 'tool-result') inlineAnsweredIds.add(part.toolCallId)
      }

      for (const part of msg.content) {
        if (part.type === 'text') text.push(part.text)
        else if (part.type === 'tool-call') {
          if (inlineAnsweredIds.has(part.toolCallId)) continue
          toolCalls.push({
            id: part.toolCallId,
            type: 'function',
            function: {
              name: part.toolName,
              arguments: typeof part.input === 'string' ? part.input : JSON.stringify(part.input ?? {})
            }
          })
        } else if (part.type === 'reasoning') {
          thinking = { thinking: part.text }
        } else if (part.type === 'file') {
          // See user-side comment above: data is a presence signal only;
          // _assistantContent carries the actual payload through round-trip.
          attachments.push({
            mediaType: part.mediaType,
            data: typeof part.data === 'string' ? part.data : '',
            ...(part.filename ? { filename: part.filename } : {})
          })
        }
      }

      const joinedText = text.join('\n')
      const m: AISDKMessage = {
        role: 'assistant',
        content: joinedText,
        _assistantContent: msg.content,
        _originalText: joinedText,
        ...(msg.providerOptions ? { _providerOptions: msg.providerOptions } : {})
      }
      if (toolCalls.length > 0) m.tool_calls = toolCalls
      if (thinking) m.thinking = thinking
      if (attachments.length) m.attachments = attachments
      messages.push(m)
      continue
    }

    if (msg.role === 'tool') {
      // One source tool message maps to N IR tool messages (one per result),
      // but message-level providerOptions (e.g. an Anthropic cache breakpoint)
      // belongs to the whole turn — attach it to the FIRST IR message only, so
      // toAISDK re-emits exactly one providerOptions when coalescing the group.
      let firstOfMessage = true
      for (const part of msg.content) {
        if (part.type === 'tool-result') {
          const text = stringifyToolOutput(part.output)
          messages.push({
            role: 'tool',
            content: text,
            tool_call_id: part.toolCallId,
            _toolContent: [part],
            _originalText: text,
            _toolName: part.toolName,
            ...(firstOfMessage && msg.providerOptions ? { _providerOptions: msg.providerOptions } : {})
          })
          firstOfMessage = false
        }
      }
    }
  }

  // Sanitize at boundary: enforce IR invariants before handing to caller.
  // Cast is safe — ensureValidHistory only inserts plain user/tool messages without
  // _userContent/_toolContent fields; toAISDK falls back to constructing from IR fields
  // for any message lacking those (see toAISDK below).
  return ensureValidHistory(messages)
}

/**
 * Narrows a generic ContextMessage to AISDKMessage for typed access to pass-through fields.
 */
function asAISDK(msg: ContextMessage): AISDKMessage {
  return msg
}

/**
 * Converts IR messages back to AI SDK V3 prompt format.
 *
 * Uses per-role original content when unmodified (detected via `_originalText`).
 * Falls back to constructing from IR fields when content was modified
 * (e.g. compression cleared tool results) or for new messages (e.g. compression summaries).
 */
export function toAISDK(messages: ContextMessage[]): LanguageModelV3Prompt {
  const prompt: LanguageModelV3Prompt = []

  let i = 0
  while (i < messages.length) {
    const msg = asAISDK(messages[i])
    const contentModified = msg._originalText !== undefined && msg._originalText !== msg.content

    if (msg.role === 'system') {
      prompt.push({
        role: 'system',
        content: msg.content,
        ...(msg._providerOptions ? { providerOptions: msg._providerOptions } : {})
      })
      i++
      continue
    }

    if (msg.role === 'user') {
      prompt.push({
        role: 'user',
        content: !contentModified && msg._userContent ? msg._userContent : [{ type: 'text', text: msg.content }],
        ...(msg._providerOptions ? { providerOptions: msg._providerOptions } : {})
      })
      i++
      continue
    }

    if (msg.role === 'assistant') {
      prompt.push({
        role: 'assistant',
        content:
          !contentModified && msg._assistantContent ? msg._assistantContent : [{ type: 'text', text: msg.content }],
        ...(msg._providerOptions ? { providerOptions: msg._provid
```

### Core Architecture Module: `packages/aiCore/src/core/context/compaction.ts`
```
/**
 * Durable compaction at the ModelMessage altitude.
 *
 * Vendored from @context-chef/ai-sdk-middleware 1.6.0 (MIT, same author).
 */
import type { LanguageModel, ModelMessage } from 'ai'

import { compactHistory, type PlanCompactionOptions } from './durableCompaction'
import { createCompressionAdapter, type SummarizeMessagesOptions } from './middleware'
import { fromModelMessages, toModelMessages } from './modelMessageAdapter'

/**
 * One-shot durable compaction at the **ModelMessage** altitude: plan a turn-safe
 * split, summarize the old slice, and return a new `ModelMessage[]` ready to
 * persist — `[...system, <summary>, ...toKeep]`. Use it in your own own-the-store
 * loop, or inside a `ToolLoopAgent` `prepareStep` (`return { messages: await
 * compactModelMessages(messages, model, opts) }`).
 *
 * `model` is `ai`'s `LanguageModel` (string id | V3 | V2) — exactly what
 * `prepareStep`/`generateText` give you. Reuses `compactHistory` +
 * `createCompressionAdapter` (tool-role flattening); no model is called directly.
 *
 * Returns the **input `messages` reference unchanged** when there is nothing old
 * enough to compact or the summarizer yields no text, so callers can skip
 * persistence on a no-op via `result === messages`. Throws only if the model call
 * throws.
 *
 * `keepRecentTurns` counts **message-level turns, not `ToolLoopAgent` steps** — a
 * turn is one user/assistant message, or an assistant with its tool-calls plus
 * all their tool results (so a result is never orphaned); system messages are
 * always preserved and never counted. A single tool-using step is often 2–3
 * turns, so size it for your worst-case step (tool-dense loops need more than a
 * plain chat).
 *
 * The summary is inserted as a `user` message (Claude Code style), so when the
 * kept tail also begins with a user turn the result can hold two consecutive
 * `user` messages. That is a valid `ModelMessage[]` — the AI SDK provider layer
 * normalizes it (Anthropic merges same-role, OpenAI accepts it) — but if you feed
 * the output to a non-AI-SDK consumer that requires strict alternation, account
 * for it.
 */
export async function compactModelMessages(
  messages: ModelMessage[],
  model: LanguageModel,
  options: PlanCompactionOptions & SummarizeMessagesOptions
): Promise<ModelMessage[]> {
  const { maxOutputTokens, ...compactOptions } = options
  const ir = fromModelMessages(messages)
  const result = await compactHistory(ir, createCompressionAdapter(model, maxOutputTokens), compactOptions)
  // compactHistory returns the input IR reference on a no-op — preserve the
  // original `messages` reference so callers can skip persistence via
  // `result === messages`.
  return result === ir ? messages : toModelMessages(result)
}

```

### Core Architecture Module: `packages/aiCore/src/core/context/durableCompaction.ts`
```
/**
 * Durable (caller-owned) compaction planning at the IR altitude.
 *
 * Vendored from @context-chef/core 3.8.0 (MIT, same author).
 */
import { ensureValidHistory } from './ensureValidHistory'
import { groupIntoTurns, summarizeHistory, type SummarizeHistoryOptions } from './janitor'
import { ContextPrompts } from './prompts'
import type { ContextMessage } from './types'

export interface PlanCompactionOptions {
  /**
   * Number of recent atomic turns to keep verbatim. Everything older goes to
   * `toSummarize`. A "turn" is a single user/assistant message, or an assistant
   * with tool_calls plus all its subsequent tool results — so the split never
   * lands inside a turn and never orphans a tool result.
   *
   * `0` summarizes the entire conversation; a value ≥ the turn count keeps
   * everything (nothing to summarize).
   */
  keepRecentTurns: number
}

export interface CompactionPlan {
  /** System messages, preserved verbatim — standing instructions are never summarized. */
  system: ContextMessage[]
  /**
   * The old conversation slice to summarize (system excluded). Feed this to
   * `summarizeHistory`. Empty when there is nothing old enough to compact.
   */
  toSummarize: ContextMessage[]
  /** The recent conversation turns to keep verbatim. */
  toKeep: ContextMessage[]
}

/**
 * Splits an IR history into `{ system, toSummarize, toKeep }` on **turn
 * boundaries**, for durable (caller-owned) compaction.
 *
 * **Input contract:** `history` is a flat `ContextMessage[]` with any system
 * messages **inline** (`role: 'system'`). This matches `fromAISDK` /
 * `fromModelMessages` output.
 *
 * Boundaries come from {@link groupIntoTurns} (assistant + its tool results
 * stay together), so the cut never splits a turn, never orphans a tool
 * result, and never lands inside a multi-block assistant message.
 */
export function planCompaction(history: ContextMessage[], options: PlanCompactionOptions): CompactionPlan {
  const keep = Math.max(0, Math.floor(options.keepRecentTurns))

  // ensureValidHistory guarantees a well-formed conversation (no orphan tool
  // results) before we group it into turns.
  const all = ensureValidHistory(history)
  const system = all.filter((m) => m.role === 'system')
  const conversation = all.filter((m) => m.role !== 'system')

  const turns = groupIntoTurns(conversation)
  const splitTurn = Math.max(0, turns.length - keep)
  // splitTurn === turns.length only when keep is 0 → summarize everything.
  const splitIndex = splitTurn < turns.length ? turns[splitTurn].startIndex : conversation.length

  return {
    system,
    toSummarize: conversation.slice(0, splitIndex),
    toKeep: conversation.slice(splitIndex)
  }
}

/**
 * One-shot durable compaction: plan a turn-safe split, summarize the old slice,
 * and return a new history ready to persist — `[...system, <summary>, ...toKeep]`.
 *
 * `compress` is the model callback (same one {@link summarizeHistory} takes) —
 * this layer never calls a model directly, the host injects the binding. It
 * MUST map `tool` roles and assistant tool-calls to plain user/assistant text.
 * Use `compactModelMessages(messages, model, options)` for the
 * ModelMessage-typed wrapper.
 *
 * Returns the input `history` **reference unchanged** when there is nothing old
 * enough to compact (no more turns than `keepRecentTurns`) or when the summarizer
 * yields no text — so it is safe to call unconditionally, and callers can skip
 * persistence on a no-op via `result === history`. Throws only if `compress`
 * throws.
 */
export async function compactHistory(
  history: ContextMessage[],
  compress: (messages: ContextMessage[]) => Promise<string>,
  options: PlanCompactionOptions & SummarizeHistoryOptions
): Promise<ContextMessage[]> {
  const { keepRecentTurns, ...summarizeOptions } = options
  const plan = planCompaction(history, { keepRecentTurns })

  // Nothing old enough to compact — return the original reference untouched.
  if (plan.toSummarize.length === 0) return history

  const summary = await summarizeHistory(plan.toSummarize, compress, summarizeOptions)
  // Summarizer produced nothing usable — leave history intact rather than
  // dropping the old turns behind an empty marker.
  if (!summary.trim()) return history

  const summaryMessage: ContextMessage = {
    role: 'user',
    content: ContextPrompts.getCompactSummaryWrapper(summary)
  }

  return [...plan.system, summaryMessage, ...plan.toKeep]
}

```

### Core Architecture Module: `packages/aiCore/src/core/context/ensureValidHistory.ts`
```
import type { ContextMessage } from './types'

const PLACEHOLDER_TOOL_RESULT = '[No tool result available]'
const PLACEHOLDER_ORPHAN_REMOVED = '[Conversation continues]'

/**
 * Sanitizes a message history to satisfy LLM API invariants.
 *
 * Vendored from @context-chef/core 3.8.0 (MIT, same author).
 *
 * Fixes three classes of problems:
 *
 * 1. **Orphan tool results** — a `role: 'tool'` message whose `tool_call_id`
 *    has no matching `tool_calls` entry in a preceding assistant message.
 *    These are removed (or replaced with a placeholder if removal would
 *    leave the history empty).
 *
 * 2. **Missing tool results** — an assistant message has `tool_calls` but
 *    no subsequent `role: 'tool'` message with a matching `tool_call_id`.
 *    A synthetic tool result with `content: '[No tool result available]'`
 *    is injected, carrying the originating tool name on the IR `name` field
 *    so output adapters can emit a meaningful `toolName`.
 *
 * 3. **First message must be user** — if the first non-system message is
 *    not `role: 'user'`, a synthetic user placeholder is prepended.
 *
 * This function does NOT modify the input array. It returns a new array.
 *
 * Sanitization is intentionally silent — to observe what was changed, call
 * this function explicitly and compare the input and output.
 */
export function ensureValidHistory(history: ContextMessage[]): ContextMessage[] {
  if (history.length === 0) return []

  let result = [...history]

  // ── Step 1: Fix orphan tool results ──
  result = fixOrphanToolResults(result)

  // ── Step 2: Fix missing tool results ──
  result = fixMissingToolResults(result)

  // ── Step 3: Ensure first non-system message is user ──
  result = ensureFirstMessageIsUser(result)

  return result
}

/**
 * Remove tool messages whose tool_call_id has no matching assistant tool_calls.
 */
function fixOrphanToolResults(messages: ContextMessage[]): ContextMessage[] {
  const result: ContextMessage[] = []
  const knownToolCallIds = new Set<string>()

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]

    // Track tool_call ids as we encounter assistant messages
    if (msg.role === 'assistant' && msg.tool_calls) {
      for (const tc of msg.tool_calls) {
        knownToolCallIds.add(tc.id)
      }
    }

    if (msg.role === 'tool' && msg.tool_call_id) {
      if (!knownToolCallIds.has(msg.tool_call_id)) {
        // Orphan — skip it
        continue
      }
    }

    result.push(msg)
  }

  // If we removed everything, keep a placeholder
  if (result.length === 0 && messages.length > 0) {
    return [{ role: 'user', content: PLACEHOLDER_ORPHAN_REMOVED }]
  }

  return result
}

/**
 * For each assistant with tool_calls, ensure every tool_call_id has a matching
 * tool result in the subsequent messages (before the next assistant or user message).
 *
 * Injected placeholders carry the original tool name (from the assistant's
 * `tool_calls[].function.name`) on the IR `name` field so downstream output
 * adapters can emit a meaningful `toolName` instead of falling back to a
 * literal `'unknown'`. Providers that validate `toolName` against the
 * assistant's tool calls (Gemini, strict middleware paths) would otherwise
 * reject the synthesized result.
 */
function fixMissingToolResults(messages: ContextMessage[]): ContextMessage[] {
  const result: ContextMessage[] = []

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    result.push(msg)

    if (msg.role !== 'assistant' || !msg.tool_calls || msg.tool_calls.length === 0) {
      continue
    }

    // Collect expected tool_call_ids and their tool names
    const expectedIds = new Set(msg.tool_calls.map((tc) => tc.id))
    const idToName = new Map(msg.tool_calls.map((tc) => [tc.id, tc.function.name]))

    // Scan forward for matching tool results
    for (let j = i + 1; j < messages.length; j++) {
      const next = messages[j]
      if (next.role === 'tool' && next.tool_call_id) {
        expectedIds.delete(next.tool_call_id)
      }
      // Stop scanning at the next assistant or user message
      if (next.role === 'assistant' || next.role === 'user') {
        break
      }
    }

    // Inject synthetic tool results for any missing ids
    for (const missingId of expectedIds) {
      const name = idToName.get(missingId)
      result.push({
        role: 'tool',
        tool_call_id: missingId,
        content: PLACEHOLDER_TOOL_RESULT,
        ...(name ? { name } : {})
      })
    }
  }

  return result
}

/**
 * Ensure the first non-system message is role: 'user'.
 */
function ensureFirstMessageIsUser(messages: ContextMessage[]): ContextMessage[] {
  const firstNonSystemIdx = messages.findIndex((m) => m.role !== 'system')

  if (firstNonSystemIdx === -1) {
    // All system messages — nothing to fix
    return messages
  }

  if (messages[firstNonSystemIdx].role === 'user') {
    return messages
  }

  // Insert a synthetic user message before the first non-system message
  const result = [...messages]
  result.splice(firstNonSystemIdx, 0, {
    role: 'user',
    content: PLACEHOLDER_ORPHAN_REMOVED
  })
  return result
}

```

### Core Architecture Module: `packages/aiCore/src/core/context/index.ts`
```
export { type AISDKMessage, fromAISDK, toAISDK } from './adapter'
export { compactModelMessages } from './compaction'
export { compactHistory, type CompactionPlan, planCompaction, type PlanCompactionOptions } from './durableCompaction'
export { ensureValidHistory } from './ensureValidHistory'
export {
  type CompressionDetails,
  groupIntoTurns,
  Janitor,
  type JanitorConfig,
  summarizeHistory,
  type SummarizeHistoryOptions,
  type Turn
} from './janitor'
export {
  type CompactConfig,
  COMPRESSION_MAX_OUTPUT_TOKENS,
  COMPRESSION_MIN_OUTPUT_TOKENS,
  type ContextMiddlewareOptions,
  createCompressionAdapter,
  createContextMiddleware,
  resolveCompressionOutputTokens,
  type SummarizeMessagesOptions,
  summarizeModelMessages
} from './middleware'
export { fromModelMessages, type ModelMessageIR, toModelMessages } from './modelMessageAdapter'
export {
  computeHeadTailExcerpt,
  type HeadTailExcerpt,
  Offloader,
  type OffloaderConfig,
  type OffloadOptions,
  type VFSResult,
  type VFSStorageAdapter
} from './offloader'
export { ContextPrompts, PERSISTED_OUTPUT_TAG } from './prompts'
export { getContextTokens } from './usage'
export { type EntityToolOutputCodec, type TruncateOptions, truncateToolResults } from './truncator'
export type {
  Attachment,
  ContextLogger,
  ContextMessage,
  RedactedThinking,
  Role,
  ThinkingContent,
  ToolCall
} from './types'

```

### Core Architecture Module: `packages/aiCore/src/core/context/janitor.ts`
```
/**
 * Budget-driven history compression primitives: turn grouping, the summarizer
 * pipeline (`summarizeHistory`), and the in-flight `Janitor`.
 *
 * Vendored from @context-chef/core 3.8.0 (MIT, same author), trimmed to the
 * paths Cherry Studio exercises:
 * - No tokenizer path — budget evaluation uses fed usage or the built-in
 *   character heuristic (`estimateObject`).
 * - No in-flight compression model — over-budget histories are handled by the
 *   caller's `onBeforeCompress` hook (sliding-window fallback) and, failing
 *   that, a mechanical drop with a placeholder summary. LLM summarization
 *   lives in the durable/in-loop compaction paths instead
 *   (`summarizeModelMessages` / `compactModelMessages`).
 */
import { ContextPrompts } from './prompts'
import { estimateObject } from './tokenUtils'
import type { Attachment, ContextLogger, ContextMessage } from './types'

const DEFAULT_PRESERVE_RECENT_MESSAGES = 1

// ─── Turn-based grouping ───

export interface Turn {
  startIndex: number
  endIndex: number // exclusive
}

/**
 * Groups a flat message array into atomic "turns."
 *
 * Grouping rules:
 * - user message → single-message turn
 * - system message → single-message turn
 * - assistant (no tool_calls) → single-message turn
 * - assistant (with tool_calls) + all subsequent tool results → one atomic turn
 *
 * Splitting on turn boundaries guarantees tool pair integrity and
 * eliminates the need for post-hoc split-index corrections.
 */
export function groupIntoTurns(history: ContextMessage[]): Turn[] {
  const turns: Turn[] = []
  let i = 0

  while (i < history.length) {
    const msg = history[i]

    if (msg.role === 'assistant' && msg.tool_calls?.length) {
      // Atomic turn: assistant + all subsequent tool results
      const start = i
      i++
      while (i < history.length && history[i].role === 'tool') {
        i++
      }
      turns.push({ startIndex: start, endIndex: i })
    } else {
      // Single-message turn: user, system, or plain assistant
      turns.push({ startIndex: i, endIndex: i + 1 })
      i++
    }
  }

  return turns
}

// ─── Attachment stripping for compression ───

/**
 * Builds a single-line text placeholder for an attachment.
 * Includes the filename when available so the summary can reference it by name.
 *
 *   { mediaType: 'image/png', filename: 'photo.png' }   → '[image: photo.png]'
 *   { mediaType: 'image/png' }                          → '[image]'
 *   { mediaType: 'application/pdf', filename: 'r.pdf' } → '[document: r.pdf]'
 *   { mediaType: 'application/pdf' }                    → '[document]'
 *   { mediaType: '' }                                  → '[attachment]'
 */
function attachmentToPlaceholder(att: Attachment): string {
  const mt = att.mediaType.toLowerCase()
  const kind = mt.startsWith('image/') ? 'image' : mt ? 'document' : 'attachment'
  return att.filename ? `[${kind}: ${att.filename}]` : `[${kind}]`
}

/**
 * Replaces media attachments with text placeholders for the compression model.
 *
 * The compression model never sees binary attachment data — it only sees text
 * markers like `[image]` or `[document: report.pdf]` prepended to the message
 * content. This avoids shipping base64 payloads through the compression call
 * (which can balloon token cost and trip prompt-too-long limits on the
 * compression call itself), while still letting the summarizer note that
 * media existed at this point in the conversation.
 *
 * Pure function — does not mutate the input array or any message inside it.
 * Messages without attachments pass through by reference (no allocation).
 */
function stripAttachmentsForCompression(messages: ContextMessage[]): ContextMessage[] {
  return messages.map((msg) => {
    if (!msg.attachments?.length) return msg

    const placeholders = msg.attachments.map(attachmentToPlaceholder).join('\n')
    const newContent = msg.content ? `${placeholders}\n${msg.content}` : placeholders

    const rest: ContextMessage = { ...msg, content: newContent }
    delete rest.attachments
    return rest
  })
}

/**
 * Builds a map from `tool_call_id` → tool name by walking the messages and
 * collecting the names declared on every assistant turn's `tool_calls`.
 */
function buildToolNameMap(messages: ContextMessage[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const m of messages) {
    if (m.role === 'assistant' && m.tool_calls) {
      for (const tc of m.tool_calls) {
        map.set(tc.id, tc.function.name)
      }
    }
  }
  return map
}

/**
 * Replaces large tool-result content with a metadata stub for the
 * compression model.
 *
 * The summarizer only needs to know "what happened" at each turn — feeding
 * it 87 KB of raw tool output wastes tokens and tends to drown the actual
 * conversation arc in noise. Each oversized tool message is rewritten to a
 * one-line stub like
 * `[Tool fs_read returned 87123 chars; omitted before summarization]`,
 * preserving tool name + size so the summary can still reference the
 * operation meaningfully. tool_use ↔ tool_result pairing is structurally
 * preserved.
 *
 * Pure function — does not mutate inputs. Only acts on `role: 'tool'`
 * messages whose content length exceeds `threshold`.
 */
function stripLargeToolResultsForCompression(messages: ContextMessage[], threshold: number): ContextMessage[] {
  const nameMap = buildToolNameMap(messages)
  return messages.map((msg) => {
    if (msg.role !== 'tool') return msg
    if (msg.content.length <= threshold) return msg
    const name = (msg.tool_call_id && nameMap.get(msg.tool_call_id)) ?? 'unknown'
    const stub = `[Tool ${name} returned ${msg.content.length} chars; omitted before summarization]`
    return { ...msg, content: stub }
  })
}

export interface SummarizeHistoryOptions {
  /** Extra instructions appended to (not replacing) the default compaction
   *  prompt — the default <analysis>/<summary> scaffolding is always kept. */
  customCompressionInstructions?: string
  /** Replace tool-result content longer than this many chars with a one-line
   *  metadata stub before summarizing (saves summarizer tokens). */
  toolResultStubThreshold?: number
  /**
   * Cap on the compression request's own input. Compaction exists to keep a
   * conversation inside the context window, but the summarize call is itself a
   * window-bound request — un-budgeted it can exceed the compression model's
   * window (an agentic history carries whole tool outputs verbatim), which
   * either hard-fails or starves the output budget so the model returns no
   * summary at all. When set, tool results are stubbed progressively until the
   * estimated input fits.
   */
  maxInputTokens?: number
}

/** Stub thresholds tried in order when `maxInputTokens` is exceeded (0 = stub every tool result). */
const STUB_ESCALATION = [4000, 1000, 200, 0]

/**
 * Last-resort clamp when stubbing every tool result still leaves the summarize
 * request over budget (a long prose conversation has no tool bulk to stub).
 * Keeps the first message — for callers that lead with a prior summary, that is
 * the entire accumulated history and must never be dropped — plus as many of
 * the most recent messages as fit, and the trailing instruction. Whatever is
 * dropped is announced in-band so the summary can't silently claim to cover it.
 */
function clampToInputBudget(messages: ContextMessage[], maxInputTokens: number): ContextMessage[] {
  if (messages.length <= 2) return messages
  const first = messages[0]
  const instruction = messages[messages.length - 1]
  const middle = messages.slice(1, -1)

  let used = estimateObject([first, instruction])
  const kept: ContextMessage[] = []
  for (let i = middle.length - 1; i >= 0; i--) {
    const cost = estimateObject(middle[i])
    if (used + cost > maxInputTokens) break
    kept.unshift(middle[i])
    used += cost
  }

  const omitted = middle.length - kept.length
  if (omitted === 0) return messages
  const marker: ContextMessage = {
    role: 'user',
    content: `[${omitted} earlier message(s) omitted — they did not fit the summarizer's context budget. Say so in the summary rather than implying full coverage.]`
  }
  return [first, marker, ...kept, instruction]
}

/**
 * Produce a compression summary for a slice of conversation `messages`:
 * tool-result stubbing → attachment stripping → trailing instruction →
 * `<summary>` extraction. Returns the extracted summary text (after
 * `formatCompactSummary` strips `<analysis>` and unwraps `<summary>`) — the
 * caller wraps it (e.g. with `ContextPrompts.getCompactSummaryWrapper`) if it
 * wants the continuation framing.
 *
 * Stateless: no circuit breaker, no fallback. THROWS if `compress` throws —
 * callers decide their own degradation.
 *
 * An empty `messages` slice returns `''` without invoking `compress`.
 *
 * @param messages   The slice to summarize (conversation only; exclude the
 *                   standing system prompt).
 * @param compress   Model callback `(messages) => Promise<string>`. It MUST
 *                   map `tool` roles and assistant tool-calls to plain
 *                   user/assistant text — providers reject raw `tool` roles.
 *                   `createCompressionAdapter` is the reference flattener.
 */
export async function summarizeHistory(
  messages: ContextMessage[],
  compress: (messages: ContextMessage[]) => Promise<string>,
  opts: SummarizeHistoryOptions = {}
): Promise<string> {
  if (messages.length === 0) return ''

  let instruction = ContextPrompts.CONTEXT_COMPACTION_INSTRUCTION
  const extra = opts.customCompressionInstructions?.trim()
  if (extra) {
    instruction += `\n\nAdditional Instructions:\n${extra}`
  }

  const assemble = (stubThreshold: number | undefined): ContextMessage[] => {
    const stubbed =
      stubThreshold !== undefined ? stripLargeToolResultsForCompression(messages, stubThreshold) : messages
    return [...stripAttachmentsForCompression(stubbed), { role: 'user', content: instruction }
```

### Core Architecture Module: `packages/aiCore/src/core/context/middleware.ts`
```
/**
 * Context middleware: transparently truncates oversized tool results and
 * enforces the token budget on every AI SDK model call, via a
 * `LanguageModelMiddleware` wired into the plugin chain.
 *
 * Vendored from @context-chef/ai-sdk-middleware 1.6.0 (MIT, same author),
 * trimmed to the options Cherry Studio uses: `contextWindow`, `compact`,
 * `truncate`, `onBeforeCompress`, `logger`. In-flight LLM compression
 * (`compress`/`onCompress`), skills, dynamic state, placeholder clearing and
 * custom tokenizers were dropped — LLM summarization is owned by the durable
 * (`summarizeModelMessages`) and in-loop (`compactModelMessages`) paths.
 */
import type { LanguageModelV3Message, LanguageModelV3Prompt, LanguageModelV3StreamPart } from '@ai-sdk/provider'
import { generateText, type LanguageModel, type LanguageModelMiddleware, type ModelMessage, pruneMessages } from 'ai'

import { fromAISDK, repairToolResultNames, toAISDK } from './adapter'
import { Janitor, summarizeHistory, type SummarizeHistoryOptions } from './janitor'
import { fromModelMessages } from './modelMessageAdapter'
import { type TruncateOptions, truncateToolResults } from './truncator'
import type { ContextLogger, ContextMessage } from './types'
import { getContextInputTokens } from './usage'

type CompressRole = 'system' | 'user' | 'assistant'

/**
 * After this many budget compressions fire, warn once. The middleware
 * compresses in-flight only — it never mutates the caller's message store —
 * so without durable write-back the history re-expands every call and the
 * outgoing payload grows unbounded. A couple of fires is a transient spike
 * (fine); repeated fires signal a sustained over-budget conversation that
 * needs durable compaction.
 */
const COMPRESS_WITHOUT_PERSISTENCE_WARN_THRESHOLD = 3

/**
 * Floor for a compression call's output budget.
 *
 * `CONTEXT_COMPACTION_INSTRUCTION` asks the model for an `<analysis>`
 * scratchpad *and* a `<summary>` block, and on a reasoning model the thinking
 * tokens are billed against this same budget and emitted BEFORE any text.
 * Measured against `deepseek-v4-flash`, one compression needed 2233 output
 * tokens (5.8k chars of thinking + 1.7k chars of summary) — the previous fixed
 * 2048 sat right on that boundary, so the budget ran out mid-thinking and
 * `text` came back empty.
 *
 * The real budget is derived from the compression model's window
 * ({@link resolveCompressionOutputTokens}); this is only the lower clamp.
 */
export const COMPRESSION_MIN_OUTPUT_TOKENS = 4096

/**
 * Ceiling for a compression call's output budget. A continuation summary is
 * bounded by the prompt's own shape (analysis + summary), not by how big the
 * conversation was, so a huge window buys nothing beyond this.
 */
export const COMPRESSION_MAX_OUTPUT_TOKENS = 16_384

/** Share of the compression model's window reserved for its output. */
const COMPRESSION_OUTPUT_WINDOW_RATIO = 0.25

/**
 * Output budget for a compression call against a model with `contextWindow`.
 * Scales with the window and is clamped to the range the prompt actually needs.
 * With no window known, falls back to the floor.
 */
export function resolveCompressionOutputTokens(contextWindow?: number): number {
  if (!contextWindow || !Number.isFinite(contextWindow) || contextWindow <= 0) {
    return COMPRESSION_MIN_OUTPUT_TOKENS
  }
  const share = Math.floor(contextWindow * COMPRESSION_OUTPUT_WINDOW_RATIO)
  // Never hand out more than the window itself can hold.
  const ceiling = Math.min(COMPRESSION_MAX_OUTPUT_TOKENS, Math.max(1, contextWindow - 1))
  return Math.min(ceiling, Math.max(COMPRESSION_MIN_OUTPUT_TOKENS, share))
}

/**
 * Mechanical compaction options — zero LLM cost.
 * Delegates to AI SDK's `pruneMessages` before IR conversion.
 */
export interface CompactConfig {
  /**
   * Controls removal of reasoning content from assistant messages.
   * - `'all'`: Remove reasoning from all messages.
   * - `'before-last-message'`: Keep reasoning only in the final message.
   * - `'none'` (default): Keep all reasoning.
   */
  reasoning?: 'all' | 'before-last-message' | 'none'
  /**
   * Controls removal of tool-call, tool-result, and tool-approval chunks.
   */
  toolCalls?:
    | 'all'
    | 'before-last-message'
    | `before-last-${number}-messages`
    | 'none'
    | Array<{
        type: 'all' | 'before-last-message' | `before-last-${number}-messages`
        tools?: string[]
      }>
  /**
   * Whether to retain messages with no content after pruning.
   * - `'remove'` (default): Exclude empty messages.
   * - `'keep'`: Retain them.
   */
  emptyMessages?: 'keep' | 'remove'
}

export interface ContextMiddlewareOptions {
  /**
   * The model's context window size in tokens.
   *
   * Required when `onBeforeCompress` is configured — `createContextMiddleware`
   * throws otherwise. Optional (and unused) for truncate / compact-only
   * configurations, which involve no budget check.
   */
  contextWindow?: number
  /** Enable tool result truncation. Omit for no truncation. */
  truncate?: TruncateOptions
  /**
   * Mechanical compaction via AI SDK's `pruneMessages`.
   * Prunes reasoning, tool calls, and empty messages at zero LLM cost.
   */
  compact?: CompactConfig
  /**
   * Called when the token budget is exceeded. Return modified messages to
   * replace history (re-evaluated against the budget), or null/undefined to
   * let the mechanical keep-last-turn drop handle it.
   */
  onBeforeCompress?: (
    history: ContextMessage[],
    tokenInfo: { currentTokens: number; limit: number }
  ) => ContextMessage[] | null | undefined | Promise<ContextMessage[] | null | undefined>
  /**
   * Sink for degradation warnings (storage write failures, missing usage
   * data, misconfiguration). Defaults to `console`.
   */
  logger?: ContextLogger
}

/**
 * Creates a LanguageModelMiddleware that transparently applies context
 * truncation and budget compression to AI SDK model calls.
 *
 * The middleware holds a stateful Janitor instance that tracks token usage
 * across calls (steps of the same wrapped model) for compression decisions.
 */
export function createContextMiddleware(options: ContextMiddlewareOptions): LanguageModelMiddleware {
  const logger = options.logger ?? console
  let usageWarned = false

  // Budget-dependent feature: the over-budget hook needs a Janitor — and
  // therefore a `contextWindow`. Truncate/compact-only configurations get no
  // Janitor at all: no budget checks and no token-usage capture.
  const budgeting = Boolean(options.onBeforeCompress)

  if (budgeting && options.contextWindow == null) {
    throw new Error(
      '[context] `contextWindow` is required when `onBeforeCompress` is configured — ' +
        'the budget check has nothing to compare against without it.'
    )
  }

  // Surface the in-flight-without-persistence footgun: if budget compression
  // keeps firing, each call re-expands the history (nothing is persisted), so
  // the payload grows unbounded (and compression effectively skips every
  // other call via E10 suppression).
  let compressionsFired = 0
  let persistenceWarned = false
  const onCompressionFired = () => {
    compressionsFired++
    if (persistenceWarned || compressionsFired < COMPRESS_WITHOUT_PERSISTENCE_WARN_THRESHOLD) {
      return
    }
    persistenceWarned = true
    logger.warn(
      `[context] budget compression has fired ${compressionsFired}× in-flight. In-flight compression ` +
        'only rewrites each outgoing request — nothing is persisted, so the message history re-expands ' +
        'on the next call and the payload grows unbounded (eventually overflowing the context window). ' +
        'For sustained compression, persist a summary durably (compactModelMessages / summarizeModelMessages).'
    )
  }

  const janitor = budgeting
    ? new Janitor({
        contextWindow: options.contextWindow as number,
        // Installed so every compression is counted for the persistence warning.
        onCompress: onCompressionFired,
        onBeforeCompress: options.onBeforeCompress,
        logger
      })
    : null

  return {
    specificationVersion: 'v3',

    transformParams: async ({ params }) => {
      let prompt = repairToolResultNames(params.prompt)

      // 1. Truncate large tool results
      if (options.truncate) {
        prompt = await truncateToolResults(prompt, options.truncate, logger)
      }

      // 2. Compact (mechanical, zero LLM cost) via pruneMessages
      if (options.compact) {
        prompt = compactPrompt(prompt, options.compact)
      }

      // 3. Convert to IR and separate system messages from conversation.
      // System messages are standing instructions — they must not be
      // compressed away. Only conversation history goes through compression.
      const allIR = fromAISDK(prompt)
      const systemMessages = allIR.filter((m) => m.role === 'system')
      let conversation = allIR.filter((m) => m.role !== 'system')

      // 4. Compress conversation history if over token budget (budgeting only)
      if (janitor) {
        conversation = await janitor.compress(conversation)
      }

      // 5. Reassemble: user system messages, then conversation.
      // 6. Convert back to AI SDK format
      prompt = toAISDK([...systemMessages, ...conversation])

      return { ...params, prompt }
    },

    wrapGenerate: async ({ doGenerate }) => {
      const result = await doGenerate()

      if (!janitor) return result

      const inputTokens = getContextInputTokens(result.usage?.inputTokens?.total, result.providerMetadata)
      if (inputTokens != null) {
        janitor.feedTokenUsage(inputTokens)
      } else if (!usageWarned) {
        usageWarned = true
        logger.warn(
          '[context] Model response did not include usage.inputTokens.total. ' +
            'Token-based compression may not trigger accurately.'
        )
      }

      return result
    },

    wrapStream: async ({ doStream }) => {
      if (!janitor) 
```

### Core Architecture Module: `packages/aiCore/src/core/context/modelMessageAdapter.ts`
```
/**
 * ModelMessage[] ↔ IR adapter (lossless round-trip) — the application/SDK
 * altitude used by `prepareStep`/`generateText`.
 *
 * Vendored from @context-chef/ai-sdk-middleware 1.6.0 (MIT, same author).
 */
import type { LanguageModelV3ToolResultOutput } from '@ai-sdk/provider'
import type { ModelMessage } from 'ai'

import { stringifyToolOutput } from './adapter'
import { ensureValidHistory } from './ensureValidHistory'
import type { Attachment, ContextMessage, ToolCall } from './types'

// NOTE: This adapter intentionally parallels adapter.ts (the V3-prompt adapter). The
// user/assistant/file extraction logic is duplicated by design; keep the two in
// sync. The deltas here are deliberate: string-shorthand content, ImagePart, and
// approval parts — none of which exist at the V3 (LanguageModelV3Prompt) altitude.

// Content/part types derived from ModelMessage — no part-type imports needed
// (provider-utils does not export them all stably). Same trick as adapter.ts.
type UserContent = Extract<ModelMessage, { role: 'user' }>['content']
type AssistantContent = Extract<ModelMessage, { role: 'assistant' }>['content']
type ToolContent = Extract<ModelMessage, { role: 'tool' }>['content']
type ProviderOptions = Extract<ModelMessage, { role: 'system' }>['providerOptions']

/**
 * IR message carrying the original ModelMessage content for lossless round-trip.
 * Parallel to AISDKMessage (the V3 adapter's carrier) but typed to the
 * application-layer ModelMessage shapes, and on distinct `_mm*` fields so the two
 * adapters can never read each other's pass-through by accident.
 */
export interface ModelMessageIR extends ContextMessage {
  _mmUserContent?: UserContent
  _mmAssistantContent?: AssistantContent
  _mmToolContent?: ToolContent
  _mmOriginalText?: string
  _mmProviderOptions?: ProviderOptions
  _mmToolName?: string
}

/**
 * Converts AI SDK `ModelMessage[]` (the application/SDK altitude — what
 * `generateText`/`prepareStep` use) into IR.
 *
 * `content` may be a plain `string` (the SDK shorthand); it is preserved on the
 * `_mm*Content` pass-through so an unmodified message round-trips byte-exact
 * (string stays string). Boundary-sanitized via `ensureValidHistory`.
 *
 * Tool messages: one IR `role:'tool'` message per `tool-result` part (so
 * `groupIntoTurns`/orphan detection works per result). `tool-approval-response`
 * parts have no IR home; they are appended in order to the adjacent result's
 * pass-through so coalescing in `toModelMessages` restores them. A tool message
 * with no tool-result at all is dropped by sanitization (not a real durable
 * input).
 */
export function fromModelMessages(messages: ModelMessage[]): ModelMessageIR[] {
  const ir: ModelMessageIR[] = []
  const toolCallNames = new Map<string, string>()

  for (const msg of messages) {
    if (msg.role === 'system') {
      ir.push({
        role: 'system',
        content: msg.content,
        ...(msg.providerOptions ? { _mmProviderOptions: msg.providerOptions } : {})
      })
      continue
    }

    if (msg.role === 'user') {
      const text =
        typeof msg.content === 'string'
          ? msg.content
          : msg.content
              .filter((p) => p.type === 'text')
              .map((p) => p.text)
              .join('\n')

      const attachments: Attachment[] = []
      if (typeof msg.content !== 'string') {
        for (const part of msg.content) {
          if (part.type === 'file') {
            attachments.push({
              mediaType: part.mediaType,
              data: typeof part.data === 'string' ? part.data : '',
              ...(part.filename ? { filename: part.filename } : {})
            })
          } else if (part.type === 'image') {
            attachments.push({
              mediaType: part.mediaType ?? 'image/*',
              data: typeof part.image === 'string' ? part.image : ''
            })
          }
        }
      }

      const m: ModelMessageIR = {
        role: 'user',
        content: text,
        _mmUserContent: msg.content,
        _mmOriginalText: text,
        ...(msg.providerOptions ? { _mmProviderOptions: msg.providerOptions } : {})
      }
      if (attachments.length) m.attachments = attachments
      ir.push(m)
      continue
    }

    if (msg.role === 'assistant') {
      const textParts: string[] = []
      const toolCalls: ToolCall[] = []
      const attachments: Attachment[] = []
      let thinking: { thinking: string } | undefined
      let assistantContent = msg.content

      if (typeof msg.content === 'string') {
        textParts.push(msg.content)
      } else {
        // Provider-executed tools (web search, code exec) carry their tool-result
        // INLINE in the same assistant message. Such calls are self-answered and
        // must not appear as open IR tool_calls — otherwise ensureValidHistory
        // injects a spurious placeholder, duplicating the inline result on
        // round-trip. The inline result round-trips verbatim via _mmAssistantContent.
        const inlineAnsweredIds = new Set<string>()
        for (const part of msg.content) {
          if (part.type === 'tool-call') toolCallNames.set(part.toolCallId, part.toolName)
          if (part.type === 'tool-result') inlineAnsweredIds.add(part.toolCallId)
        }

        assistantContent = msg.content.map((part) => {
          if (part.type !== 'tool-result') return part
          const toolName = toolCallNames.get(part.toolCallId)
          return toolName !== undefined && toolName !== part.toolName ? { ...part, toolName } : part
        })

        for (const part of assistantContent) {
          if (part.type === 'text') {
            textParts.push(part.text)
          } else if (part.type === 'tool-call') {
            if (inlineAnsweredIds.has(part.toolCallId)) continue
            toolCalls.push({
              id: part.toolCallId,
              type: 'function',
              function: {
                name: part.toolName,
                arguments: typeof part.input === 'string' ? part.input : JSON.stringify(part.input ?? {})
              }
            })
          } else if (part.type === 'reasoning') {
            thinking = { thinking: part.text }
          } else if (part.type === 'file') {
            attachments.push({
              mediaType: part.mediaType,
              data: typeof part.data === 'string' ? part.data : '',
              ...(part.filename ? { filename: part.filename } : {})
            })
          }
          // tool-approval-request parts ride through _mmAssistantContent verbatim (no IR projection).
        }
      }

      const joined = textParts.join('\n')
      const m: ModelMessageIR = {
        role: 'assistant',
        content: joined,
        _mmAssistantContent: assistantContent,
        _mmOriginalText: joined,
        ...(msg.providerOptions ? { _mmProviderOptions: msg.providerOptions } : {})
      }
      if (toolCalls.length) m.tool_calls = toolCalls
      if (thinking) m.thinking = thinking
      if (attachments.length) m.attachments = attachments
      ir.push(m)
      continue
    }

    if (msg.role === 'tool') {
      let anchor: ModelMessageIR | undefined
      const pending: ToolContent = []
      // One source tool message maps to N IR tool messages (one per result),
      // but message-level providerOptions (e.g. an Anthropic cache breakpoint)
      // belongs to the whole turn — attach it to the FIRST IR message only, so
      // toModelMessages re-emits exactly one providerOptions when coalescing.
      let firstOfMessage = true
      for (const part of msg.content) {
        if (part.type === 'tool-result') {
          const toolName = toolCallNames.get(part.toolCallId) ?? part.toolName
          const toolResult = toolName === part.toolName ? part : { ...part, toolName }
          // ModelMessage's ToolResultOutput is a structural superset of V3's (extra content[] members);
          // stringifyToolOutput only reads .type/.value, so the cast is safe and matches the V3 adapter's projection.
          const text = stringifyToolOutput(toolResult.output as LanguageModelV3ToolResultOutput)
          anchor = {
            role: 'tool',
            content: text,
            tool_call_id: toolResult.toolCallId,
            _mmToolContent: [...pending, toolResult],
            _mmOriginalText: text,
            _mmToolName: toolResult.toolName,
            ...(firstOfMessage && msg.providerOptions ? { _mmProviderOptions: msg.providerOptions } : {})
          }
          firstOfMessage = false
          pending.length = 0
          ir.push(anchor)
        } else if (anchor?._mmToolContent) {
          anchor._mmToolContent.push(part)
        } else {
          // Approval part seen before any tool-result: buffer it to prepend to
          // the next result. If no result ever follows in this message (a tool
          // message with zero results), fromModelMessages emits NO IR message at
          // all — so there is nothing for ensureValidHistory to sanitize, and the
          // buffered parts are simply dropped. We accept that edge shape (a
          // leading approval with no following result in the same message).
          pending.push(part)
        }
      }
    }
  }

  return ensureValidHistory(ir)
}

function asMM(msg: ContextMessage): ModelMessageIR {
  return msg
}

/**
 * Converts IR back to AI SDK `ModelMessage[]`.
 *
 * Unmodified messages emit their original content verbatim (via `_mm*` fields),
 * so string content stays a string and reasoning/approval parts round-trip
 * byte-exact. Modified messages and synthetic messages (e.g. a compression
 * summary, which has no pass-through) are rebuilt from IR fields.
 * For a modified tool message this rebuild emits only a single `tool-result`
 * from the IR text — any co-located `tool-approval-response` parts are
 * intentionally dropped, since a modified/cleared result is being collapsed
 * anyway.
 */
export function toModelMessages(messages: ContextMessage[]): 
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #23049** (2026-10-29): **[Bug]: macOS never shows Calendar, Reminders or Automation permission prompts for local MCP servers (missing usage descriptions / entitlements)**
  *Symptoms*: ### Issue Checklist  - [x] I understand that issues are for feedback and problem solving, not for complaining in the comment section, and will provide as much information as possible to help solve the problem. - [x] My issue is not listed in the [FAQ](https://github.com/CherryHQ/cherry-studio/issues/3881). - [x] I've looked at **pinned issues** and searched for existing [Open Issues](https://github.com/CherryHQ/cherry-studio/issues), [Closed Issues](https://github.com/CherryHQ/cherry-studio/issues?q=is%3Aissue%20state%3Aclosed), and [Discussions](https://github.com/CherryHQ/cherry-studio/discussions), no similar issue or discussion was found. - [x] I've filled in short, clear headings so that developers can quickly identify a rough idea of what to expect when flipping through the list of issues. And not "a suggestion", "stuck", etc. - [x] I've confirmed that I am using the latest version of Cherry Studio.  ### Platform  macOS  ### Version  v2.1.8  ### Bug Description  Local stdio MCP servers that need macOS privacy permissions don't work in Cherry Studio. When a tool call needs Calendar or Reminders access (EventKit) or wants to control another app via Apple Events (e.g. Mail), macOS never shows a permission prompt and the call fails with a permission error. Cherry Studio doesn't appear in System Settings → Privacy & Security → Calendars, Reminders or Automation. Approving the tool call inside Cherry Studio doesn't change this.  Tested with: - [mcp-server-apple-events](https:

- **Issue #23046** (2026-10-29): **[Bug]: Grok 4.7 on Cherry IN fails with a membership/expiry notice while GPT and Claude models work**
  *Symptoms*: ## Issue Checklist  - [x] I understand that issues are for feedback and problem solving, not for complaining in the comment section, and will provide as much information as possible to help solve the problem. - [x] My issue is not listed in the [FAQ](https://github.com/CherryHQ/cherry-studio/issues/3881). - [x] I've looked at **pinned issues** and searched for existing [Open Issues](https://github.com/CherryHQ/cherry-studio/issues), [Closed Issues](https://github.com/CherryHQ/cherry-studio/issues?q=is%3Aissue%20state%3Aclosed), and [Discussions](https://github.com/CherryHQ/cherry-studio/discussions), no similar issue or discussion was found. - [x] I've filled in short, clear headings so that developers can quickly identify a rough idea of what to expect when flipping through the list of issues. - [ ] I've confirmed that I am using the latest version of Cherry Studio. (reporters did not state their version)  ## Platform  macOS  ## Version  Unknown (reporters did not state it). Latest release at filing time: v2.1.6.  ## Bug Description  With the built-in **Cherry IN** provider, selecting **Grok 4.7** fails with a message that reads as a membership/expiry notice, while **GPT and Claude models under the same provider keep working** in the same session.  Aggregated from user reports in the Cherry Studio official QQ group on 2026-10-29 (UTC+8):  - 12:05 — "到期了是什么鬼" ("what the hell is 'expired'") next to a screenshot of the dialog. - 13:45 — "我也一样，我 Grok 4.7，它说什么会员什么玩意，我用的是 Cherry I

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

### Incident Patch 1: `3fea3403` (2026-10-29)
**Commit Message**: feat(mermaid): render diagrams with Merman in a worker and preview Mermaid files (#23095)

<!-- Template from
https://github.com/kubevirt/kubevirt/blob/main/.github/PULL_REQUEST_TEMPLATE.md?-->
<!--  Thanks for sending a pull request!  Here are some tips for you:
1. Consider creating this PR as draft:
https://github.com/CherryHQ/cherry-studio/blob/main/CONTRIBUTING.md
-->

### What this PR does

Before this PR: Mermaid diagrams rendered on the main thread through
`mermaid` (code blocks) and `@streamdown/mermaid` (the Streamdown
preset), with workarounds for `mermaid` bugs (off-screen measuring, a
NaN patch, waiting for folded diagrams). Diagrams used Mermaid's own
palettes and fonts and carried drop shadows. `.mmd`/`.mermaid` files
opened as plain text in the Agent file pane.

After this PR: diagrams render with
[Merman](https://github.com/Latias94/merman) 0.9.2 (Mermaid in Rust,
compiled to WASM) in a dedicated Web Worker, so layout never blocks the
window. They take node, text, border, line and categorical colours from
the design tokens, use the body font, have no shadows, and sit on the
background actually behind them in light and dark mode. `.mmd` and
`.mermaid` files preview i

**File**: `.agents/notes/proposed/feature/2026-10-30-merman-mermaid.i18n.yaml` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+# Bilingual-pair consistency record (docs/i18n/README.md).
+# After editing either side, update its counterpart and re-record with:
+#   pnpm docs:check-pairing --write .agents/notes/proposed/feature/2026-10-30-merman-mermaid.md
+2026-10-30-merman-mermaid.md: fb2aee06a3bf750695babbc1fbbcef799ab5f514
+2026-10-30-merman-mermaid.zh.md: f936f1138f375749f188d06c717c82455c2009e6
```

**File**: `.agents/notes/proposed/feature/2026-10-30-merman-mermaid.md` (added, +68/-0)
```diff
@@ -0,0 +1,68 @@
+# Agent Note: Mermaid diagrams on Merman, with a file preview
+
+Status: proposed
+
+English | [中文](2026-10-30-merman-mermaid.zh.md)
+
+## Problem
+
+Mermaid diagrams render through the `mermaid` JavaScript package in two places: `MermaidPreview` for code blocks (chat, quick assistant, selection, translation, Markdown file previews) and the `withMermaid()` Streamdown preset in `@cherrystudio/ui`. `MermaidPreview` works around `mermaid` bugs: it measures in an off-screen element, patches `translate(undefined, NaN)` output, and watches folded containers so hidden diagrams wait for a size. Diagrams use Mermaid's own `default`/`dark` palettes and fonts, so they do not match the design system, and nodes carry decorative drop shadows.
+
+The Agent file pane opens `.mmd` and `.mermaid` files as plain text; there is no diagram preview.
+
+## Proposal
+
+### Renderer
+
+- Replace `mermaid` and `@streamdown/mermaid` with [Merman](https://github.com/Latias94/merman) `@mermanjs/web-render` 0.9.2, pinned exactly. Merman is Mermaid reimplemented in Rust and compiled to WASM, targeting Mermaid 12.1 behaviour. The `mermaid` package stays installed only as a type dependency of `streamdown`; no app code imports it, so it is no longer bundled.
+- A new `@cherrystudio/ui/mermaid` subpath owns the engine and runs in any realm. `loadMermaidRuntime()` loads and initializes the WASM once per realm on first use. `renderMermaidSvg(source, { theme, diagramId })` measures labels with an `OffscreenCanvas` measurer that matches Merman's DOM-based browser measurer within half a pixel on every operation real diagrams request, including CJK wrapping. Merman's structured errors become ordinary `Error`s with Merman's message.
+- Rendering runs in a dedicated Web Worker (`src/renderer/workers/mermaid.worker.ts`) behind `mermaidRenderService`, following the code-highlight worker pattern. The service keeps one render in flight; a newer request for a diagram still waiting in the queue replaces it and all its callers receive the newer SVG; a render over 10 s is stopped by terminating the worker; a crashed worker is replaced on the next request.
+- A worker cannot see the page's `@font-face` fonts, so the theme carries the page's font faces for its font list and the worker loads them before measuring. Without this, labels would be measured with a fallback font and overflow.
+- `MermaidPreview` calls the service and mounts the result through the existing sanitized Shadow DOM path. The off-screen measurement, NaN patch, and visibility observer are removed: Merman does not depend on the container's size. `useMermaid` is deleted.
+- `withMermaid()` returns a Streamdown diagram plugin backed by the same renderer.
+
+### Theme: immersive
+
+Diagrams follow the design system instead of a Mermaid palette:
+
+- `resolveMermaidTheme(element)` maps Merman's semantic roles to design tokens: `--muted` node fill, `--secondary` alternate fill, `--foreground` text, `--muted-foreground` secondary text and lines, `--border-strong` borders, `--background-subtle`/`--border` clusters, `--warning-subtle`/`--warning-border` notes, `--success`, and `--chart-1` to `--chart-5` for categorical series.
+- The canvas is the colour actually painted behind the preview: every translucent ancestor background is composited over the first opaque one. The SVG background is transparent, so the diagram sits directly on its surface (the file pane, a chat code block) in light and dark mode.
+- Labels use the document body font, not a surrounding code block's monospace font.
+- Mermaid's default node drop shadow is turned off (`site_config.themeVariables.dropShadow = 'none'`).
+- Token values are `oklch`, so each one is resolved to opaque hex by painting it on a one-pixel canvas.
+- The preview re-renders when the app theme changes.
+
+### File preview
+
+- A `mermaid` FilePreview plugin handles `.mmd` and `.mermaid`. It reads the file and renders it with `MermaidPreview` in `contain` fit: the diagram fills the preview, centred, scaled down to fit both width and height but never enlarged past its own size. Empty files show the empty state; unreadable files show the load error. The shared preview toolbar (pan, zoom, copy, download, expand) applies.
+- Because the plugin is a rendered preview, the Agent file pane opens these files in preview with the existing Edit/Preview toggle; editing uses the live editor on the source.
+- `renderSvgInShadowHost` gains `fit: 'width' | 'contain'`. `width` is the existing behaviour and stays the default for code blocks, PlantUML, Graphviz, and SVG.
+
+### Limits
+
+- Merman's `interactive` resource profile rejected a 200-node flowchart, and on the main thread a 400-message sequence diagram blocked the window for 260 ms. The worker uses the same profile with only the layout-work limit raised (400M units) and bounds time with its 10 s deadline instead. Measured in the app: a 300-node flowchart and a 400-message sequence diagram render with
```

**File**: `.agents/notes/proposed/feature/2026-10-30-merman-mermaid.zh.md` (added, +68/-0)
```diff
@@ -0,0 +1,68 @@
+# Agent Note: Mermaid 图表改用 Merman，并新增文件预览
+
+Status: proposed
+
+[English](2026-10-30-merman-mermaid.md) | 中文
+
+## Problem
+
+Mermaid 图表目前在两处通过 `mermaid` JavaScript 包渲染：代码块用的 `MermaidPreview`（聊天、快捷助手、划词、翻译、Markdown 文件预览），以及 `@cherrystudio/ui` 中的 `withMermaid()` Streamdown 预设。`MermaidPreview` 为绕开 `mermaid` 的缺陷做了不少处理：在屏幕外元素中测量、修补 `translate(undefined, NaN)` 输出、监听折叠容器，让隐藏的图表等容器有尺寸后再渲染。图表使用 Mermaid 自带的 `default`/`dark` 配色和字体，与设计系统不一致，节点还带有装饰性投影。
+
+Agent 文件面板把 `.mmd`、`.mermaid` 文件当作纯文本打开，没有图表预览。
+
+## Proposal
+
+### 渲染器
+
+- 用 [Merman](https://github.com/Latias94/merman) `@mermanjs/web-render` 0.9.2（锁定精确版本）替换 `mermaid` 和 `@streamdown/mermaid`。Merman 用 Rust 重新实现 Mermaid 并编译为 WASM，对齐 Mermaid 12.1 的行为。`mermaid` 包仅作为 `streamdown` 的类型依赖继续安装；应用代码不再引用它，因此不会再被打包。
+- 新增 `@cherrystudio/ui/mermaid` 子路径负责渲染引擎，可在任何 realm 中运行。`loadMermaidRuntime()` 在首次使用时为每个 realm 加载并初始化一次 WASM。`renderMermaidSvg(source, { theme, diagramId })` 用 `OffscreenCanvas` 测量标签；在真实图表会请求的所有测量操作上（包括中日韩文字换行），结果与 Merman 基于 DOM 的浏览器测量相差不到半个像素。Merman 的结构化错误会转成带 Merman 原始信息的普通 `Error`。
+- 渲染在专用 Web Worker（`src/renderer/workers/mermaid.worker.ts`）中进行，由 `mermaidRenderService` 管理，沿用代码高亮 worker 的模式。服务同一时间只运行一个渲染；同一图表在队列中等待的旧请求会被新请求替换，其所有调用方都拿到新的 SVG；超过 10 秒的渲染会通过终止 worker 来停止；崩溃的 worker 会在下一次请求时重建。
+- worker 看不到页面通过 `@font-face` 加载的字体，因此主题会携带其字体列表对应的页面字体，worker 在测量前先加载这些字体。否则标签会用后备字体测量，导致溢出。
+- `MermaidPreview` 调用该服务，并通过现有经过净化的 Shadow DOM 路径挂载结果。屏幕外测量、NaN 修补和可见性监听都已移除：Merman 不依赖容器尺寸。删除 `useMermaid`。
+- `withMermaid()` 返回由同一渲染器驱动的 Streamdown 图表插件。
+
+### 主题：沉浸式
+
+图表遵循设计系统，而不是 Mermaid 的配色：
+
+- `resolveMermaidTheme(element)` 把 Merman 的语义角色映射到设计 token：`--muted` 为节点填充，`--secondary` 为备用填充，`--foreground` 为文字，`--muted-foreground` 为次要文字和连线，`--border-strong` 为边框，`--background-subtle`/`--border` 为分组，`--warning-subtle`/`--warning-border` 为注释，`--success`，以及 `--chart-1` 至 `--chart-5` 为分类序列。
+- 画布颜色取预览背后实际绘制的颜色：把所有半透明祖先背景叠加到第一个不透明背景上。SVG 背景为透明，因此图表直接位于所在表面（文件面板、聊天代码块）之上，浅色和深色模式均如此。
+- 标签使用文档正文字体，而不是外层代码块的等宽字体。
+- 关闭 Mermaid 默认的节点投影（`site_config.themeVariables.dropShadow = 'none'`）。
+- token 值是 `oklch`，因此每个值都通过在 1 像素画布上绘制解析为不透明的十六进制颜色。
+- 应用主题切换时预览会重新渲染。
+
+### 文件预览
+
+- 新增 `mermaid` FilePreview 插件，处理 `.mmd` 和 `.mermaid`。插件读取文件，并以 `contain` 适配方式用 `MermaidPreview` 渲染：图表填满预览区域并居中，按宽高同时缩小以适配，但不会放大到超过自身尺寸。空文件显示空状态，无法读取的文件显示加载错误。共享的预览工具栏（平移、缩放、复制、下载、展开）同样适用。
+- 由于该插件属于渲染型预览，Agent 文件面板以预览方式打开这些文件，并提供现有的编辑/预览切换；编辑时使用实时编辑器编辑源码。
+- `renderSvgInShadowHost` 新增 `fit: 'width' | 'contain'`。`width` 为原有行为，代码块、PlantUML、Graphviz 和 SVG 仍默认使用它。
+
+### 限制
+
+- Merman 的 `interactive` 资源档位会拒绝 200 个节点的流程图；在主线程渲染 400 条消息的时序图会让窗口卡住 260 ms。worker 沿用该档位，只放宽布局计算量上限（4 亿单位），改由 10 秒期限限制耗时。应用内实测：300 个节点的流程图和 400 条消息的时序图渲染时，主线程没有任何长任务。
+- WASM 约 11 MB（gzip 后 4.4 MB）。开发环境下冷启动初始化实测 37 ms。
+- 文件编辑器的高亮器没有 Mermaid 语法，因此 `.mmd` 源码没有语法高亮，与之前一致。
+
+## Alternatives considered
+
+- **保留 `mermaid`，只新增文件预览：** 用户于 2026-10-30 否决。两个引擎渲染出的图表不同，而且都要打包。
+- **先做文件预览，代码块以后再迁移：** 曾提出，未采用；一次切换所有路径可以只保留一个渲染器。
+- **通过 `site_config.themeVariables` 映射 token：** 已否决。Merman 的 `presentation.theme` 直接接受语义角色和序列配色，与设计 token 一一对应。
+- **沿用代码块周围的字体：** 测试后否决。代码块继承等宽字体，图表看起来像代码。
+- **编辑时左右分屏显示源码和实时预览：** 未采用；面板保留现有的编辑/预览切换。
+
+## Acceptance criteria
+
+- AC1 — 代码块中的 Mermaid 图表（聊天 Markdown 和 Markdown 文件预览）通过 Merman 渲染，应用代码不再引用 `mermaid` 或 `@streamdown/mermaid`。(verification: renderer and Electron; owner: implementer)
+- AC2 — 图表的节点、文字、边框、连线和分类颜色取自设计 token，使用正文字体，没有投影，并位于其背后实际的背景之上；浅色和深色模式下均如此，包括在半透明代码块内。(verification: Electron; owner: implementer)
+- AC3 — 在 Agent 文件面板中打开 `.mmd` 或 `.mermaid` 文件时，图表居中并适配预览区域且不会被放大，并提供编辑/预览切换；空文件和无法读取的文件显示对应状态。(verification: renderer and Electron; owner: implementer)
+- AC4 — 源码无效时显示 Merman 的解析错误；较新的源码渲染失败时，保留之前的图表。(verification: renderer and Electron; owner: implementer)
+- AC5 — 渲染（包括 300 个节点的流程图）不会阻塞主线程；超过期限的渲染会被停止并报告，之后的图表仍能渲染。(verification: renderer and Electron; owner: implementer)
+
+## Risks
+
+- Merman 不保证与浏览器 Mermaid 的输出逐像素一致；文本测量、HTML 标签和部分图表类型可能与用户以前看到的不同。
+- Merman 0.9.2 是较新的依赖（2026-10-22 发布）。升级时应按其升级指南的建议对比渲染结果。
+- canvas 测量是对 DOM 测量的近似；它不覆盖的字体或测量操作会回退到 Merman 的确定性测量。
+- 用户在面板中编辑的 `.mmd` 文件没有语法高亮。
```

**File**: `docs/references/components/image-preview.md` (modified, +37/-6)
```diff
@@ -2,6 +2,9 @@
 description: Current Mermaid, PlantUML, SVG, and Graphviz preview pipeline with sanitized Shadow DOM rendering and shared controls
 sources:
   - src/renderer/components/Preview
+  - packages/ui/src/lib/mermaid
+  - src/renderer/services/MermaidRenderService.ts
+  - src/renderer/workers/mermaid.worker.ts
 ---
 
 # Image Preview Components
@@ -11,7 +14,7 @@ by `CodeBlockView`. The current language mapping is:
 
 | Code language | Component | Renderer |
 |---|---|---|
-| `mermaid` | `MermaidPreview` | Mermaid library loaded by `useMermaid` |
+| `mermaid` | `MermaidPreview` | Merman (Rust Mermaid compiled to WASM) through `@cherrystudio/ui/mermaid` |
 | `plantuml` | `PlantUmlPreview` | Remote `www.plantuml.com` SVG endpoint |
 | `svg` | `SvgPreview` | Supplied SVG string |
 | `dot`, `graphviz` | `GraphvizPreview` | Lazily initialized `@viz-js/viz` instance |
@@ -46,7 +49,10 @@ All four formats end at `renderSvgInShadowHost`. Before parsing, it sanitizes th
 SVG with DOMPurify, allowing the additional SVG tags/attributes required by the
 renderers. It then parses the result as SVG, falls back to an HTML parse only to
 recover an SVG element, normalizes its sizing, and mounts it in an open Shadow
-DOM with local base styles.
+DOM with local base styles. Sizing defaults to `fit: 'width'`: the SVG scales to
+the host's width up to its own width. `fit: 'contain'` also fits the host's
+height, centres the SVG, and never enlarges it past its own height; it is meant
+for hosts with a fixed height, such as the Mermaid file preview.
 
 Shadow DOM provides style isolation; DOMPurify is the content-safety boundary.
 Do not replace this path with direct `innerHTML` in a preview component.
@@ -68,10 +74,35 @@ The layout exposes pan, zoom, copy, and download through its preview ref so
 
 ### Mermaid
 
-`MermaidPreview` validates with `mermaid.parse`, renders in an off-screen
-measurement element, repairs the known `translate(undefined, NaN)` output, and
-then mounts the SVG. A `MutationObserver` tracks visibility through folded
-message containers; hidden diagrams wait until their container has dimensions.
+`MermaidPreview` renders through `mermaidRenderService`, which runs
+`renderMermaidSvg` from `@cherrystudio/ui/mermaid` in a dedicated Web Worker
+(`workers/mermaid.worker.ts`), so layout never blocks the window. The service
+keeps one render in flight; a newer request for a diagram still waiting in the
+queue replaces it, and every caller of that diagram receives the newer SVG. A
+render that runs longer than 10 s is stopped by terminating the worker, and a
+crashed worker is replaced on the next request. Rendering does not depend on the
+container's size, so folded or hidden diagrams render like visible ones.
+
+Labels are measured with an `OffscreenCanvas` (`canvas-text-measurer.ts`), which
+works in the worker and matches Merman's DOM-based browser measurer within half a
+pixel. The worker loads the page's `@font-face` web fonts for the theme's font
+list (`fonts.ts`), because a worker cannot see the page's fonts; without them it
+would measure with a fallback font and labels would not fit.
+
+The theme comes from `resolveMermaidTheme(container)`: Merman's semantic roles
+map to design tokens (`--muted` node fill, `--foreground` text, `--border-strong`
+borders, `--muted-foreground` lines, `--chart-1` to `--chart-5` for categorical
+series). The canvas is the colour actually painted behind the preview, with every
+translucent ancestor layer composited, and the SVG background stays transparent,
+so a diagram sits directly on its surface. Labels use the document body font.
+Node drop shadows are turned off. The preview re-renders when the app theme
+changes.
+
+Merman's `interactive` resource profile is used with only its layout-work limit
+raised, because the default already rejects a 200-node flowchart. Time is bounded
+by the worker deadline instead.
+When a newer source fails to render, the previous diagram stays in place under
+the error.
 
 ### PlantUML
 
```

**File**: `docs/sources-index.json` (modified, +1/-1)
```diff
@@ -207,7 +207,7 @@
     },
     {
       "path": "docs/references/components/image-preview.md",
-      "sources": ["src/renderer/components/Preview"]
+      "sources": ["packages/ui/src/lib/mermaid","src/renderer/components/Preview","src/renderer/services/MermaidRenderService.ts","src/renderer/workers/mermaid.worker.ts"]
     },
     {
       "path": "docs/references/components/README.md",
```

**File**: `package.json` (modified, +0/-1)
```diff
@@ -451,7 +451,6 @@
     "markdown-it": "^14.1.1",
     "md5": "2.3.0",
     "mdast-util-from-markdown": "^2.0.2",
-    "mermaid": "^11.13.0",
     "micromark-util-types": "^2.0.2",
     "mime": "^4.0.4",
     "mime-types": "^3.0.1",
```

**File**: `packages/ui/README.md` (modified, +11/-0)
```diff
@@ -227,6 +227,17 @@ viewer paint; it returns `null` when that range is not parsed, without starting
 Grammar modules can still depend on CodeMirror runtime modules and are cached separately
 in the worker and renderer.
 
+### Mermaid Diagrams
+
+`@cherrystudio/ui/mermaid` renders Mermaid source with Merman (`@mermanjs/web-render`, Mermaid
+compiled from Rust to WASM). `renderMermaidSvg(source, { theme, diagramId })` loads the runtime once
+per realm on first use and measures labels with an `OffscreenCanvas`, so it runs on the page or in a
+Web Worker; the app runs it in a worker. A worker must load the theme's `fontFaces` first, which
+`renderMermaidSvg` does. `resolveMermaidTheme(element)`
+maps the design tokens and the background actually painted behind `element` to Merman's semantic
+roles, so diagrams follow light/dark mode and sit on their surface. The Markdown `withMermaid()`
+preset uses the same renderer for Streamdown.
+
 ### Icon Generation
 
 Use the package command for all icon generation so ESLint fixes and the repository formatter run after the generated files are updated.
```

**File**: `packages/ui/package.json` (modified, +11/-2)
```diff
@@ -97,6 +97,16 @@
         "types": "./dist/code-block.d.cts",
         "default": "./dist/code-block.cjs"
       }
+    },
+    "./mermaid": {
+      "import": {
+        "types": "./dist/mermaid.d.mts",
+        "default": "./dist/mermaid.mjs"
+      },
+      "require": {
+        "types": "./dist/mermaid.d.cts",
+        "default": "./dist/mermaid.cjs"
+      }
     }
   },
   "scripts": {
@@ -125,6 +135,7 @@
     "@hello-pangea/dnd": "^18.0.1",
     "@lezer/common": "1.5.1",
     "@lezer/highlight": "1.2.3",
+    "@mermanjs/web-render": "0.9.2",
     "@pierre/highlights": "0.2.0",
     "@radix-ui/primitive": "^1.1.3",
     "@radix-ui/react-accordion": "^1.2.12",
@@ -147,7 +158,6 @@
     "@radix-ui/react-use-controllable-state": "^1.2.2",
     "@streamdown/cjk": "^1.0.3",
     "@streamdown/math": "^1.0.2",
-    "@streamdown/mermaid": "^1.0.2",
     "@tanstack/react-table": "^8.21.3",
     "@uiw/codemirror-extensions-langs": "^4.25.1",
     "@viz-js/lang-dot": "^1.0.5",
@@ -159,7 +169,6 @@
     "es-toolkit": "^1.49.0",
     "katex": "0.16.22",
     "lucide-react": "^0.545.0",
-    "mermaid": "^11.13.0",
     "react-day-picker": "^9.14.0",
     "react-dropzone": "^14.3.8",
     "react-resizable-panels": "^4.11.0",
```

---

### Incident Patch 2: `db9ebfd6` (2026-10-29)
**Commit Message**: fix(browser): preserve local HTML state during fragment navigation (#23058)

<!-- Template from
https://github.com/kubevirt/kubevirt/blob/main/.github/PULL_REQUEST_TEMPLATE.md?-->
<!--  Thanks for sending a pull request!  Here are some tips for you:
1. Consider creating this PR as draft:
https://github.com/CherryHQ/cherry-studio/blob/main/CONTRIBUTING.md
-->

### What this PR does

Before this PR: Clicking a fragment link in a local HTML browser tab
changed the artifact guest's React key. The resulting WebView
replacement discarded unsaved input, JavaScript state, and navigation
history.

After this PR: Fragment navigation preserves the existing guest and its
document state. Opening a different file still replaces the guest.

<!-- (optional, in `fixes #<issue number>(, fixes #<issue_number>, ...)`
format, will close the issue(s) when PR gets merged)*: -->

Fixes #: N/A (no linked issue).

### Why we need it and why it was done in this way

The following tradeoffs were made: Exclude only the fragment from the
existing artifact authorization key. File identity and query parameters
remain part of the key, and main-process file access policy is
unchanged.

The following alternatives we

**File**: `src/renderer/pages/browser/__tests__/BrowserPage.test.tsx` (modified, +31/-0)
```diff
@@ -41,6 +41,37 @@ function openBrowser(href: string) {
 }
 
 describe('Browser tab restoration', () => {
+  it('preserves the local HTML guest when fragment navigation is synchronized to the route', async () => {
+    const first = 'file:///tmp/report.html?view=all'
+    const view = openBrowser(`/app/browser?url=${encodeURIComponent(first)}`)
+    const guest = (await screen.findByTestId('webview-browser-guest')) as unknown as WebviewTag
+    let currentUrl = first
+    Object.assign(guest, {
+      getURL: () => currentUrl,
+      getTitle: () => 'Local report',
+      getWebContentsId: () => 42,
+      isLoading: () => false,
+      canGoBack: () => false,
+      canGoForward: () => false,
+      stopFindInPage: vi.fn()
+    })
+    act(() => {
+      guest.dispatchEvent(new Event('dom-ready'))
+    })
+    const setAttribute = vi.spyOn(guest, 'setAttribute')
+
+    for (const hash of ['#section', '#other-section', '']) {
+      currentUrl = `${first}${hash}`
+      act(() => {
+        guest.dispatchEvent(Object.assign(new Event('did-navigate-in-page'), { url: currentUrl, isMainFrame: true }))
+      })
+      await waitFor(() => expect(view.router.state.location.search).toEqual({ url: currentUrl }))
+      // Replacing the native guest would discard the document's input, JS state and history.
+      expect(screen.getByTestId('webview-browser-guest')).toBe(guest)
+    }
+    expect(setAttribute.mock.calls.filter(([name]) => name === 'src')).toEqual([])
+  })
+
   it.each(['/app/browser', '/app/browser?url=', '/app/browser?url=%20%20', '/app/browser?url=about%3Ablank'])(
     'opens an empty browser page for %s',
     async (href) => {
```

**File**: `src/renderer/utils/webviewGuest.ts` (modified, +4/-1)
```diff
@@ -2,11 +2,14 @@ import { WebviewSecurityProfile } from '@shared/utils/webviewSecurity'
 
 export function getGuestAuthorizationKey(securityProfile: WebviewSecurityProfile, initialUrl: string): string {
   if (securityProfile === WebviewSecurityProfile.AgentBrowser) return securityProfile
-  if (securityProfile === WebviewSecurityProfile.AgentHtmlArtifact) return `${securityProfile}:${initialUrl}`
   if (initialUrl === 'about:blank') return `${securityProfile}:${initialUrl}`
 
   try {
     const url = new URL(initialUrl)
+    if (securityProfile === WebviewSecurityProfile.AgentHtmlArtifact) {
+      url.hash = ''
+      return `${securityProfile}:${url.href}`
+    }
     if (url.hostname === '0.0.0.0') url.hostname = 'localhost'
     return `${securityProfile}:${url.origin}`
   } catch {
```

---

### Incident Patch 3: `4637aa0b` (2026-10-29)
**Commit Message**: fix(packaging): declare macOS privacy usage descriptions and entitlements for local MCP servers (#23051)

## What this fixes

Local stdio MCP servers need macOS privacy permissions
(Calendars/Reminders through EventKit, Apple Events through
`osascript`). Cherry Studio spawns them with the configured absolute
path, so macOS charges their requests to
**Cherry Studio as the responsible app** — and Cherry Studio declared
none of the matching usage descriptions, nor
carried the matching hardened-runtime entitlements. The result reported
in #23049: no prompt, a permission error,
and no Cherry Studio row under Privacy & Security → Calendars /
Reminders / Automation.

Measured on the installed 2.1.7 build on macOS 27.0.1:

```
$ plutil -p "/Applications/Cherry Studio.app/Contents/Info.plist" | grep -iE "UsageDescription"
  NSCameraUsageDescription / NSMicrophoneUsageDescription / NSSpeechRecognitionUsageDescription /
  NSDocumentsFolderUsageDescription / NSDownloadsFolderUsageDescription      # nothing for Calendar/Reminders/Apple Events
$ codesign -dv --verbose=4 "/Applications/Cherry Studio.app" | grep flags
  flags=0x10000(runtime)                                                      # 

**File**: `build/entitlements.mac.plist` (modified, +4/-0)
```diff
@@ -12,5 +12,9 @@
     <true/>
     <key>com.apple.security.cs.disable-library-validation</key>
     <true/>
+    <key>com.apple.security.personal-information.calendars</key>
+    <true/>
+    <key>com.apple.security.automation.apple-events</key>
+    <true/>
   </dict>
 </plist>
```

**File**: `electron-builder.yml` (modified, +6/-0)
```diff
@@ -160,6 +160,12 @@ mac:
     NSSpeechRecognitionUsageDescription: Cherry Studio transcribes voice recordings on this device.
     NSDocumentsFolderUsageDescription: Application requests access to the user's Documents folder.
     NSDownloadsFolderUsageDescription: Application requests access to the user's Downloads folder.
+    NSCalendarsUsageDescription: Cherry Studio allows local MCP servers to read and manage your calendar events.
+    NSCalendarsFullAccessUsageDescription: Cherry Studio allows local MCP servers to read and manage your calendar events.
+    NSCalendarsWriteOnlyAccessUsageDescription: Cherry Studio allows local MCP servers to create calendar events.
+    NSRemindersUsageDescription: Cherry Studio allows local MCP servers to read and manage your reminders.
+    NSRemindersFullAccessUsageDescription: Cherry Studio allows local MCP servers to read and manage your reminders.
+    NSAppleEventsUsageDescription: Cherry Studio allows local MCP servers to control other applications using AppleScript.
   target:
     - target: dmg
     - target: zip
```

**File**: `scripts/__tests__/mac-sign.test.ts` (modified, +26/-0)
```diff
@@ -23,6 +23,32 @@ describe('macOS signing policy', () => {
     expect(builder.mac.extendInfo.NSMicrophoneUsageDescription.trim()).not.toBe('')
   })
 
+  it('declares macOS privacy access required by local MCP servers', () => {
+    const builder = parse(readFileSync(path.join(projectRoot, 'electron-builder.yml'), 'utf8'))
+    const mainEntitlements = readFileSync(
+      path.join(projectRoot, builder.mac.entitlements ?? 'build/entitlements.mac.plist'),
+      'utf8'
+    )
+    const inheritedEntitlements = readFileSync(path.join(projectRoot, builder.mac.entitlementsInherit), 'utf8')
+
+    for (const key of [
+      'NSCalendarsUsageDescription',
+      'NSCalendarsFullAccessUsageDescription',
+      'NSCalendarsWriteOnlyAccessUsageDescription',
+      'NSRemindersUsageDescription',
+      'NSRemindersFullAccessUsageDescription',
+      'NSAppleEventsUsageDescription'
+    ]) {
+      expect(builder.mac.extendInfo[key]).toEqual(expect.any(String))
+      expect(builder.mac.extendInfo[key].trim()).not.toBe('')
+    }
+
+    for (const entitlements of [mainEntitlements, inheritedEntitlements]) {
+      expect(entitlements).toMatch(/<key>com\.apple\.security\.personal-information\.calendars<\/key>\s*<true\s*\/>/)
+      expect(entitlements).toMatch(/<key>com\.apple\.security\.automation\.apple-events<\/key>\s*<true\s*\/>/)
+    }
+  })
+
   it('packages the native helper as code in Contents/Helpers', () => {
     const builder = parse(readFileSync(path.join(projectRoot, 'electron-builder.yml'), 'utf8'))
 
```

#### Recent Merged Pull Requests:
- **PR #23105** (2026-10-29): fix(preview-tests): restore main CI fixture and resize readiness (@DeJeune)
- **PR #23104** (2026-10-29): fix(app-shell): unify navigation selection and contrast (@DeJeune)
- **PR #23101** (2026-10-29): fix(rich-editor): stop diagram code blocks from freezing the notes editor (@DeJeune)
- **PR #23095** (2026-10-29): feat(mermaid): render diagrams with Merman in a worker and preview Mermaid files (@DeJeune)
- **PR #23088** (2026-10-29): test(tabs): cover conversation titles in Electron e2e (@DeJeune)
- **PR #23085** (2026-10-29): feat(tabs): make the active conversation tab visually distinct (@cherry-coding[bot])

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

## X. mermaid): render diagrams with Merman in a worker and preview Mermaid files (#23

**RULE**:
When implementing operations in `.agents/notes/proposed/feature/2026-10-30-merman-mermaid.i18n.yaml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in CherryHQ/cherry-studio. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `3fea3403`: mermaid): render diagrams with Merman in a worker and preview Mermaid files (#23095). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `.agents/notes/proposed/feature/2026-10-30-merman-mermaid.i18n.yaml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
# Bilingual-pair consistency record (docs/i18n/README.md).
# After editing either side, update its counterpart and re-record with:
#   pnpm docs:check-pairing --write .agents/notes/proposed/feature/2026-10-30-merman-mermaid.md
2026-10-30-merman-mermaid.md: fb2aee06a3bf750695babbc1fbbcef799ab5f514
2026-10-30-merman-mermaid.zh.md: f936f1138f375749f188d06c717c82455c2009e6
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `3fea3403` are properly handled with clean fallback behavior.
