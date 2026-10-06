# Forensic Learning Record (Deep Inspection): SaladDay/pi-from-scratch

> **Canonical Artifact**: `07_PROJECT_LEARNING/saladday-pi-from-scratch-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/SaladDay/pi-from-scratch](https://github.com/SaladDay/pi-from-scratch))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:52:47.866Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `SaladDay/pi-from-scratch`
- **Description**: 600 行 TypeScript 写成的超级迷你版 pi，让你轻松从 0 写出属于你的 pi-agent
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 1265 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `web/next-config-utils.mjs`
```
export function parseAllowedDevOrigins(value) {
  return (
    value
      ?.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean) ?? []
  );
}

```

### Core Architecture Module: `scripts/generate-traces.ts`
```
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runAgent, type AgentEvent, type AgentTool } from '../src/agent.js'
import { builtinTools } from '../src/tools.js'
import type { Context, Model } from '../src/llm.js'
import type { TraceCase, TraceContext, TraceSource, TraceStep } from '../web/app/trace-types.js'

type SourceFile = TraceSource['file']

type CaseSpec = {
  id: string
  number: string
  title: string
  summary: string
  outcome: string
  systemPrompt: string
  prompt: (workspace: string) => string
  prepare?: (workspace: string) => Promise<void>
  tools: (workspace: string) => AgentTool[]
  maxTokens?: number
  abortAfterMs?: number
}

type CapturedEvent = {
  event: AgentEvent
  context: Context
}

const here = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(here, '..')
const outputPath = resolve(projectRoot, 'web/app/trace-data.generated.ts')

function requiredEnv(name: 'NANOPI_API_KEY' | 'NANOPI_BASE_URL'): string {
  const value = process.env[name]
  if (!value) throw new Error(`需要设置 ${name} 才能生成真实 trace。`)
  return value
}

const apiKey = requiredEnv('NANOPI_API_KEY')
const baseUrl = requiredEnv('NANOPI_BASE_URL').replace(/\/+$/, '')

const sourceFiles = Object.fromEntries(
  await Promise.all(
    (['src/llm.ts', 'src/agent.ts', 'src/tools.ts', 'src/tui.ts', 'src/cli.ts'] as SourceFile[])
      .map(async (file) => [file, await readFile(resolve(projectRoot, file), 'utf8')]),
  ),
) as Record<SourceFile, string>

function cloneContext(context: Context): TraceContext {
  return JSON.parse(JSON.stringify(context)) as TraceContext
}

function findLine(file: SourceFile, needle: string, occurrence = 0): number {
  const matches = sourceFiles[file]
    .split('\n')
    .map((line, index) => ({ line, number: index + 1 }))
    .filter((entry) => entry.line.includes(needle))
  const match = occurrence < 0 ? matches.at(occurrence) : matches[occurrence]
  if (!match) throw new Error(`找不到 trace 源码位置：${file} / ${needle}`)
  return match.number
}

function source(file: SourceFile, needle: string, occurrence = 0): TraceSource {
  return { file, line: findLine(file, needle, occurrence) }
}

function normalizeText(value: string, workspace: string): string {
  return value.split(workspace).join('/workspace')
}

function normalizeValue<T>(value: T, workspace: string): T {
  return JSON.parse(normalizeText(JSON.stringify(value), workspace)) as T
}

function messageKind(message: unknown): 'tool_result' | 'assistant' | 'other' {
  if (!message || typeof message !== 'object') return 'other'
  const item = message as { role?: string; content?: unknown }
  if (item.role === 'assistant') return 'assistant'
  if (item.role === 'user' && Array.isArray(item.content)) {
    const hasResult = item.content.some((block) => (
      block && typeof block === 'object' && (block as { type?: string }).type === 'tool_result'
    ))
    if (hasResult) return 'tool_result'
  }
  return 'other'
}

function contextStepSource(context: TraceContext): TraceSource {
  const latest = context.messages.at(-1)
  if (messageKind(latest) === 'tool_result') {
    return source('src/agent.ts', 'context.messages.push(buildToolResultMessage(results))', -1)
  }
  return source('src/agent.ts', 'context.messages.push(buildAssistantMessage(text, toolCalls))', -1)
}

function eventSource(event: AgentEvent): TraceSource {
  switch (event.type) {
    case 'assistant_text':
      return source('src/agent.ts', "yield { type: 'assistant_text', delta: ev.delta }")
    case 'tool_call':
      return source('src/agent.ts', "yield { type: 'tool_call', id: ev.id")
    case 'tool_result':
      return source('src/agent.ts', "yield { type: 'tool_result', id:", 0)
    case 'turn_end':
      if (event.stopReason === 'aborted') return source('src/agent.ts', "yield { type: 'turn_end', stopReason: 'aborted' }")
      if (event.stopReason === 'error') return source('src/agent.ts', "yield { type: 'turn_end', stopReason: 'error' }")
      return source('src/agent.ts', "yield { type: 'turn_end', stopReason: reason }")
  }
}

function eventCopy(event: AgentEvent): Record<string, unknown> {
  return JSON.parse(JSON.stringify(event)) as Record<string, unknown>
}

function eventPresentation(event: AgentEvent): Pick<TraceStep, 'label' | 'detail' | 'kind'> {
  switch (event.type) {
    case 'assistant_text':
      return {
        label: '模型流式输出文本',
        detail: 'stream() 产生 text_delta，agent 将它转成 assistant_text 发给界面。',
        kind: 'stream',
      }
    case 'tool_call':
      return {
        label: `模型调用 ${event.name}`,
        detail: 'agent 收集工具名和参数，同时发出 tool_call 事件。',
        kind: 'tool',
      }
    case 'tool_result':
      return {
        label: `${event.name} 返回结果`,
        detail: '工具已经执行完，结果先作为 AgentEvent 发出，随后写回 Context。',
        kind: event.result.startsWith('error:') ? 'error' : 'tool',
      }
    case 'turn_end':
      return {
        label: `本轮结束：${event.stopReason}`,
        detail: event.stopReason === 'aborted'
          ? '中断信号抵达当前任务，agent 清理未完成的数据后结束。'
          : event.stopReason === 'max_tokens'
            ? '模型碰到输出上限，agent 保留已收到的文本并结束本轮。'
            : event.stopReason === 'error'
              ? '请求失败，agent 发出错误事件并停止循环。'
              : '这一轮没有新的 tool_call，Agent Loop 正常退出。',
        kind: event.stopReason === 'error' ? 'error' : 'end',
      }
  }
}

function coalesceTextEvents(events: CapturedEvent[]): CapturedEvent[] {
  const result: CapturedEvent[] = []
  for (const captured of events) {
    const previous = result.at(-1)
    if (captured.event.type === 'assistant_text' && previous?.event.type === 'assistant_text') {
      previous.event = { type: 'assistant_text', delta: previous.event.delta + captured.event.delta }
      previous.context = captured.context
    } else {
      result.push(captured)
    }
  }
  return result
}

function buildSteps(initial: TraceContext, captured: CapturedEvent[], finalContext: TraceContext): TraceStep[] {
  const steps: TraceStep[] = [{
    id: 'input',
    label: '用户消息进入 Context',
    detail: 'CLI 先把这一轮输入追加到 messages，随后把 Context 交给 runAgent()。',
    kind: 'input',
    source: source('src/cli.ts', "context.messages.push({ role: 'user', content: text })"),
    context: initial,
  }]

  let visibleMessages = initial.messages.length
  let index = 1

  for (const item of coalesceTextEvents(captured)) {
    if (item.context.messages.length > visibleMessages) {
      const context = cloneContext(item.context)
      steps.push({
        id: `context-${index++}`,
        label: messageKind(context.messages.at(-1)) === 'tool_result'
          ? 'tool_result 写回 Context'
          : 'assistant message 写回 Context',
        detail: '这次修改会进入下一轮请求，也会被 session 持久化。',
        kind: 'context',
        source: contextStepSource(context),
        context,
      })
      visibleMessages = item.context.messages.length
    }

    const presentation = eventPresentation(item.event)
    steps.push({
      id: `event-${index++}`,
      ...presentation,
      source: eventSource(item.event),
      event: eventCopy(item.event),
      context: cloneContext(item.context),
    })
  }

  if (finalContext.messages.length > visibleMessages) {
    steps.push({
      id: `context-${index++}`,
      label: messageKind(finalContext.messages.at(-1)) === 'tool_result'
        ? 'tool_result 写回 Context'
        : 'assistant message 写回 Context',
      detail: '循环退出前，最后一条消息已经放回 Context。',
      kind: 'context',
      source: contextStepSource(finalContext),
      context: finalContext,
    })
  }

  return steps
}

function pickTools(...names: string[]): AgentTool[] {
  const all = builtinTools()
  return names.map((name) => {
    const tool = all.find((candidate) => candidate.name === name)
    if (!tool) throw new Error(`内置工具不存在：${name}`)
    return tool
  })
}

const cases: CaseSpec[] = [
  {
    id: 'plain-text',
    number: '01',
    title: '没有 tool_call',
    summary: '模型只返回文本，循环一轮结束。',
    outcome: '一条 assistant message，随后 end_turn。',
    systemPrompt: '你是 nanopi 的教学演示模型。严格按用户要求回答，答案保持一句话。',
    prompt: () => '只回答这一句：没有 tool_call，Agent Loop 就会结束。',
    tools: () => [],
  },
  {
    id: 'read-file',
    number: '02',
    title: '读取一个文件',
    summary: '模型调用 read_file，把结果放回 Context，再完成回答。',
    outcome: '一次工具往返，两轮 LLM 请求。',
    systemPrompt: '你是 nanopi 的教学演示模型。必须使用提供的工具完成任务，工具返回后用一句话回答。',
    prepare: async (workspace) => {
      await writeFile(join(workspace, 'hello.txt'), 'alpha\nbeta\ngamma\n', 'utf8')
    },
    prompt: (workspace) => `使用 read_file 读取 ${join(workspace, 'hello.txt')}，告诉我第一行。不要猜。`,
    tools: () => pickTools('read_file'),
  },
  {
    id: 'edit-and-check',
    number: '03',
    title: '修改并验证',
    summary: '模型先编辑文件，再读回来确认修改。',
    outcome: 'edit 和 read_file 串成一条多工具路径。',
    systemPrompt: '你是 nanopi 的教学演示模型。严格按用户指定的工具顺序执行，完成后只报告最终值。',
    prepare: async (workspace) => {
      await writeFile(join(workspace, 'config.ts'), 'export const retries = 2\n', 'utf8')
    },
    prompt: (workspace) => {
      const path = join(workspace, 'config.ts')
      return `先用 edit 把 ${path} 里的 retries = 2 改成 retries = 3，再用 read_file 读取同一文件确认。`
    },
    tools: () => pickTools('edit', 'read_file'),
  },
  {
    id: 'tool-error',
    number: '04',
    title: '工具执行失败',
    summary: '工具抛出错误，agent 把错误结果交还给模型。',
    outcome: '错误成为 tool_result，模型仍能正常收尾。',
    systemPrompt: '你是 nanopi 的教学演示模型。必须调用唯一可用的工具；失败后用一句话说明失败原因。',
    prompt: () => '查询离线包索引中 nanopi 的最新版本。',
    tools: () => [{
      name: 'lookup_package',
      description: '查询离线包索引。这个教学工具会稳定返回索引不可用错误。',
      parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
      execute: async () => { throw new Error('offline registry unavailable') },
    }],
  },
  {
    id: 'max-tokens',
    number: '05',
    title: '撞上 max_tokens',
    summary: '让长回答耗尽输出预算，观察截断后的结束事件。',
    outcome: '本轮没有工具调用，直接
```

### Core Architecture Module: `src/agent.ts`
```
// src/agent.ts
// Agent Loop —— 整个项目的灵魂：一个 while 循环。
//
// LLM 流式回复 → 有 tool_call 就执行 → 结果放回到 Context → 继续流式
// 直到模型不再调工具（end_turn / max_tokens）或被中断（aborted / error）。
//
// 直接 import stream 而非依赖注入——让学习者一眼看到"这是 LLM 交互点"。
// pi 用 StreamFn 参数注入支持替换后端，教学版省略。

import { stream, buildAssistantMessage, buildToolResultMessage, type Model, type Context } from './llm.js'

/** 工具定义：name + 描述 + JSON Schema 参数 + execute 函数 */
export type AgentTool = {
  name: string
  description: string
  parameters: object  // JSON Schema
  execute: (args: unknown, signal?: AbortSignal) => Promise<string>
}

/** agent 对外的事件流，供 UI 消费 */
export type AgentEvent =
  | { type: 'assistant_text'; delta: string }
  | { type: 'tool_call'; id: string; name: string; args: unknown }
  | { type: 'tool_result'; id: string; name: string; result: string }
  | { type: 'turn_end'; stopReason: 'end_turn' | 'max_tokens' | 'aborted' | 'error' }

/** compaction 触发阈值：消息数超过此值时压缩旧消息 */
const COMPACT_THRESHOLD = 50
/** compaction 保留近期消息数 */
const KEEP_RECENT = 20

/**
 * 对话压缩：当消息过多时，让 LLM 总结旧消息，用摘要替换。
 * 教的是"context 有上限，满了要压缩"——agent 自管理上下文的核心能力。
 * pi 的实现 970 行含 token 估算/cut point 边界/split turn 等，教学版极简为消息条数近似。
 */
async function compactContext(model: Model, context: Context, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return  // abort 时不压缩——避免空摘要损坏 context
  if (context.messages.length < COMPACT_THRESHOLD) return

  const oldMessages = context.messages.slice(0, -KEEP_RECENT)
  const recentMessages = context.messages.slice(-KEEP_RECENT)

  // 把旧消息序列化成纯文本让 LLM 总结
  const conversationText = oldMessages
    .map(m => `${m.role}: ${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`)
    .join('\n')

  // 用一轮非流式调用让 LLM 总结
  const summaryContext: Context = {
    systemPrompt: '请将以下对话总结为简洁的上下文摘要，保留关键决策、已做的工作和待办事项。',
    messages: [{ role: 'user', content: conversationText }],
  }

  let summary = ''
  let failed = false
  for await (const ev of stream(model, summaryContext, { signal })) {
    if (ev.type === 'text_delta') summary += ev.delta
    else if (ev.type === 'error' || ev.type === 'done' && ev.stopReason === 'aborted') { failed = true; break }
  }

  // 压缩失败时不替换 context——保留原始消息比空摘要更安全
  if (failed || !summary) return

  // 用摘要消息替换旧消息，保留近期消息
  context.messages = [
    { role: 'user', content: `[context summary]\n${summary}` },
    ...recentMessages,
  ]
}

/**
 * 运行 agent 循环。无 max_steps——loop 到模型说停为止。pi 同样无硬编码步数上限，但额外有 shouldStopAfterTurn 回调，教学版省略。
 *
 * @param model    模型配置
 * @param context  对话上下文（会被原地修改）
 * @param tools    工具注册表
 * @param signal   abort 信号
 */
export async function* runAgent(
  model: Model,
  context: Context,
  tools: AgentTool[],
  signal?: AbortSignal,
): AsyncGenerator<AgentEvent> {
  const toolMap = new Map(tools.map(t => [t.name, t]))
  const toolDefs = tools.map(t => ({ name: t.name, description: t.description, parameters: t.parameters }))

  while (true) {
    // 0. 对话压缩：消息过多时先压缩旧消息
    await compactContext(model, context, signal)

    // 1. 流式调用 LLM，收集文本和 tool_calls
    let text = ''
    let stopReason: 'end_turn' | 'tool_use' | 'max_tokens' | 'aborted' = 'end_turn'
    const toolCalls: { id: string; name: string; args: unknown }[] = []

    for await (const ev of stream(model, context, { tools: toolDefs, signal })) {
      if (ev.type === 'text_delta') {
        text += ev.delta
        yield { type: 'assistant_text', delta: ev.delta }
      } else if (ev.type === 'tool_call') {
        toolCalls.push({ id: ev.id, name: ev.name, args: ev.args })
        yield { type: 'tool_call', id: ev.id, name: ev.name, args: ev.args }
      } else if (ev.type === 'done') {
        stopReason = ev.stopReason
        if (ev.stopReason === 'aborted') {
          // abort 时丢弃 tool_calls（无对应 tool_result 会导致 session 恢复后 API 报错）
          context.messages.push(buildAssistantMessage(text, []))
          yield { type: 'turn_end', stopReason: 'aborted' }
          return
        }
      } else if (ev.type === 'error') {
        context.messages.push(buildAssistantMessage(text, []))
        yield { type: 'assistant_text', delta: `\n[error] ${ev.error.message}` }
        yield { type: 'turn_end', stopReason: 'error' }
        return
      }
    }

    // 2. 把 assistant 回复塞回 context
    context.messages.push(buildAssistantMessage(text, toolCalls))

    // 3. 截断处理：max_tokens 时 tool args 可能不完整，不执行，把错误放回到 Context 让模型重发
    if (stopReason === 'max_tokens' && toolCalls.length > 0) {
      const results = toolCalls.map(tc => ({
        tool_use_id: tc.id,
        content: `error: output truncated by max_tokens, tool "${tc.name}" args may be incomplete.`,
      }))
      context.messages.push(buildToolResultMessage(results))
      for (let i = 0; i < toolCalls.length; i++) {
        yield { type: 'tool_result', id: toolCalls[i].id, name: toolCalls[i].name, result: results[i].content }
      }
      continue
    }

    // 4. 没有 tool_call → 循环结束
    // 畸形 API 可能返回 tool_use 但无 tool_call delta，此时视为正常结束
    const reason = stopReason === 'tool_use' ? 'end_turn' : stopReason
    if (toolCalls.length === 0) {
      yield { type: 'turn_end', stopReason: reason }
      return
    }

    // 5. 串行执行 tool_calls（pi 有 sequential/parallel 两种模式，教学版统一串行）
    // args 未经 parameters 验证直接传入 execute（教学版简化，生产应先 validate）
    const results: { tool_use_id: string; content: string }[] = []
    for (const tc of toolCalls) {
      const tool = toolMap.get(tc.name)
      let result: string
      if (!tool) {
        result = `error: tool "${tc.name}" not found`
      } else {
        try {
          result = await tool.execute(tc.args, signal)
        } catch (e) {
          result = `error: ${(e as Error).message}`
        }
      }
      results.push({ tool_use_id: tc.id, content: result })
      yield { type: 'tool_result', id: tc.id, name: tc.name, result }
      if (signal?.aborted) break
    }

    // 6. 为被 abort 跳过的 tool_call 补上错误结果（API 要求每个 tool_call 都有对应 tool_result）
    for (const tc of toolCalls.slice(results.length)) {
      results.push({ tool_use_id: tc.id, content: 'error: aborted' })
      yield { type: 'tool_result', id: tc.id, name: tc.name, result: 'error: aborted' }
    }

    // 7. 把 tool_result 放回到 Context，进入下一轮
    context.messages.push(buildToolResultMessage(results))
  }
}

```

### Core Architecture Module: `src/cli.ts`
```
// src/cli.ts
// 拼装层 —— 把 llm / agent / tui / tools 粘起来，是唯一入口。
// session 持久化：每轮结束把 context.messages append 到 ~/.nanopi/session.jsonl。

import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { runAgent } from './agent.js'
import { Tui } from './tui.js'
import { builtinTools } from './tools.js'
import type { Model, Context, Message } from './llm.js'

const SESSION_DIR = path.join(os.homedir(), '.nanopi')
const SESSION_FILE = path.join(SESSION_DIR, 'session.jsonl')

/** 固定 system prompt */
const SYSTEM_PROMPT = '你是一个编码助手。用提供的工具读写文件和执行命令来完成任务。先阅读再修改，修改后可运行命令验证。'

// 记录已持久化的 message 数量，只 append 新增的。
// 这是 CLI 进程级状态（非 agent 状态——agent 本身无状态，context 就是状态）。
let persistedCount = 0

async function main() {
  const apiKey = process.env.NANOPI_API_KEY
  if (!apiKey) {
    console.error('请设置 NANOPI_API_KEY 环境变量')
    process.exit(1)
  }

  const model: Model = {
    apiKey,
    model: process.env.NANOPI_MODEL ?? 'glm-5.2',
    baseUrl: process.env.NANOPI_BASE_URL ?? 'https://api.openai.com/v1',
    maxTokens: 4096,
  }

  // 初始化 context：system prompt 用专用字段，messages 从 session 文件加载
  const context: Context = {
    systemPrompt: SYSTEM_PROMPT,
    messages: await loadSession(),
  }

  const tools = builtinTools()
  const tui = new Tui()

  // 每轮：用户输入 → runAgent → 事件转发到 TUI → 持久化
  tui.onPrompt(async (text) => {
    try {
      context.messages.push({ role: 'user', content: text })

      tui.setBusy(true)
      const ctrl = new AbortController()
      tui.onAbort(() => ctrl.abort())  // 每轮新建 AbortController，需重新注册回调指向新的 controller

      for await (const ev of runAgent(model, context, tools, ctrl.signal)) {
        switch (ev.type) {
          case 'assistant_text': tui.printText(ev.delta); break
          case 'tool_call': tui.printToolCall(ev.name, ev.args); break
          case 'tool_result': tui.printToolResult(ev.name, ev.result); break
          case 'turn_end':
            if (ev.stopReason === 'max_tokens') tui.printText('\n[output truncated by max_tokens]')
            if (ev.stopReason === 'error') tui.printText('\n[error occurred]')
            tui.printTurnEnd()
            break
        }
      }

      await persistSession(context.messages)
    } catch (e) {
      console.error(`\n[error] ${(e as Error).message}`)
    } finally {
      tui.setBusy(false)
    }
  })

  tui.start()

}

/** 启动时加载历史 messages，恢复上次对话（导出供测试） */
export async function loadSession(file: string = SESSION_FILE): Promise<Message[]> {
  try {
    const data = await fs.readFile(file, 'utf-8')
    const lines = data.trim().split('\n').filter(Boolean)
    // 逐行容错：跳过损坏行而非丢弃全部历史（进程崩溃可能写出半行 JSON）
    const messages = lines.flatMap(line => {
      try { return [JSON.parse(line) as Message] } catch { return [] }
    })
    persistedCount = messages.length  // 已加载的不重复写
    return messages
  } catch {
    return []  // 文件不存在，从空开始
  }
}

/** 持久化 messages 到 session 文件（导出供测试） */
export async function persistSession(messages: Message[], file: string = SESSION_FILE): Promise<void> {
  await fs.mkdir(path.dirname(file) || '.', { recursive: true })
  const newMessages = messages.slice(persistedCount)
  for (const msg of newMessages) {
    await fs.appendFile(file, JSON.stringify(msg) + '\n', 'utf-8')
  }
  persistedCount = messages.length
}

// 只在直接运行时启动（非 import 时）
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}

```

### Core Architecture Module: `src/llm.ts`
```
// src/llm.ts
// 统一 LLM API —— 把 OpenAI Completions SSE 响应解析成四种事件流。
// 教学版只支持 OpenAI 兼容格式（GLM、DeepSeek、Ollama 等均兼容）。

// ===== 类型 =====

/** 模型配置 */
export type Model = {
  apiKey: string
  model: string          // 如 "gpt-4o" 或 "glm-5.2"
  baseUrl?: string       // 默认 https://api.openai.com/v1
  maxTokens?: number     // 不设则由 API 决定默认值（cli.ts 设为 4096）
}

/**
 * content block：消息内容的结构化单元。
 * 注意：tool_result 放在 ContentBlock 里再塞进 user message，
 * pi 里它是独立的 ToolResultMessage 类型，nanopi 简化为统一结构。
 */
export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: string }

/** 消息：user / assistant 共用同一结构 */
export type Message = {
  role: 'user' | 'assistant'
  content: string | ContentBlock[]
}

/** Context：纯 JSON，可 stringify 落盘 */
export type Context = {
  systemPrompt?: string
  messages: Message[]
}

/** 流事件：llm 模块对外的统一输出 */
export type StreamEvent =
  | { type: 'text_delta'; delta: string }
  | { type: 'tool_call'; id: string; name: string; args: unknown }
  | { type: 'done'; stopReason: 'end_turn' | 'tool_use' | 'max_tokens' | 'aborted' }
  | { type: 'error'; error: Error }

/** agent 模块传入的 tool 定义格式 */
export type ToolDef = {
  name: string
  description: string
  parameters: object
}

// ===== 辅助函数 =====

/**
 * 把 nanopi Context 转成 OpenAI messages 格式。
 * 纯转换函数，不含网络逻辑。
 */
export function contextToOpenAIMessages(context: Context): object[] {
  const messages: object[] = []
  if (context.systemPrompt) messages.push({ role: 'system', content: context.systemPrompt })

  for (const msg of context.messages) {
    if (typeof msg.content === 'string') {
      messages.push({ role: msg.role, content: msg.content })
      continue
    }

    const blocks = msg.content
    if (msg.role === 'assistant') {
      const toolCalls: object[] = []
      let text = ''
      for (const b of blocks) {
        if (b.type === 'text') text += b.text
        else if (b.type === 'tool_use') {
          toolCalls.push({ id: b.id, type: 'function', function: { name: b.name, arguments: JSON.stringify(b.input) } })
        }
      }
      // OpenAI 要求 assistant 消息必须有 content（非 null）或 tool_calls。
      // 纯 tool_call 时 content 为 null；两者皆空（如 abort/error 后的无内容轮次）用空串占位，避免 API 400。
      const content = text || (toolCalls.length ? null : '')
      messages.push({ role: 'assistant', content, tool_calls: toolCalls.length ? toolCalls : undefined })
    } else {
      // user message 里的 tool_result block → OpenAI 要求独立的 role:tool 消息
      for (const b of blocks) {
        if (b.type === 'tool_result') {
          messages.push({ role: 'tool', tool_call_id: b.tool_use_id, content: b.content })
        } else if (b.type === 'text') {
          messages.push({ role: 'user', content: b.text })
        }
      }
    }
  }
  return messages
}

/** OpenAI SSE chunk 的最小类型 */
type OpenAIChunk = {
  choices: Array<{
    delta?: {
      content?: string
      tool_calls?: Array<{ index?: number; id?: string; function?: { name?: string; arguments?: string } }>
    }
    finish_reason?: string
  }>
}

/** 解析一行 SSE data，累积 tool_call，返回 text_delta 和 stop_reason */
function handleSSELine(
  data: string,
  toolCallBuffers: Map<number, { id: string; name: string; argsBuf: string }>,
): { textDelta: string | null; stopReason: 'end_turn' | 'tool_use' | 'max_tokens' | null } {
  let chunk: OpenAIChunk
  try { chunk = JSON.parse(data) as OpenAIChunk } catch { return { textDelta: null, stopReason: null } }

  const choice = chunk.choices[0]
  if (!choice) return { textDelta: null, stopReason: null }

  let textDelta: string | null = null
  let stopReason: 'end_turn' | 'tool_use' | 'max_tokens' | null = null

  if (choice.delta?.content) textDelta = choice.delta.content

  // tool_call 增量：按 index 累积 name + arguments 的 partial JSON
  if (choice.delta?.tool_calls) {
    for (const tc of choice.delta.tool_calls) {
      const idx = tc.index ?? 0
      if (!toolCallBuffers.has(idx)) {
        toolCallBuffers.set(idx, { id: tc.id ?? `call_${idx}`, name: '', argsBuf: '' })
      }
      const entry = toolCallBuffers.get(idx)!
      if (tc.id) entry.id = tc.id
      if (tc.function?.name) entry.name = tc.function.name
      if (tc.function?.arguments) entry.argsBuf += tc.function.arguments
    }
  }

  // finish_reason 映射：tool_calls → tool_use，length → max_tokens，stop → end_turn（默认值）
  if (choice.finish_reason === 'tool_calls') stopReason = 'tool_use'
  else if (choice.finish_reason === 'length') stopReason = 'max_tokens'

  return { textDelta, stopReason }
}

/** 流结束：把累积的 tool_calls 按顺序发出 */
function flushToolCalls(
  toolCallBuffers: Map<number, { id: string; name: string; argsBuf: string }>,
): { id: string; name: string; args: unknown }[] {
  const calls: { id: string; name: string; args: unknown }[] = []
  for (const [, tc] of [...toolCallBuffers].sort((a, b) => a[0] - b[0])) {
    let args: unknown = {}
    if (tc.argsBuf) {
      try { args = JSON.parse(tc.argsBuf) } catch { args = {} }
    }
    calls.push({ id: tc.id, name: tc.name, args })
  }
  return calls
}

// ===== stream 函数 =====

/**
 * 调用 OpenAI Completions API（streaming），返回统一事件流。
 *
 * @param model    模型配置
 * @param context  对话上下文
 * @param opts     tools + abort signal
 */
export async function* stream(
  model: Model,
  context: Context,
  opts: { tools?: ToolDef[]; signal?: AbortSignal } = {},
): AsyncGenerator<StreamEvent> {
  const url = `${model.baseUrl ?? 'https://api.openai.com/v1'}/chat/completions`
  const messages = contextToOpenAIMessages(context)

  const body: Record<string, unknown> = { model: model.model, stream: true, messages }
  if (model.maxTokens) body.max_tokens = model.maxTokens
  if (opts.tools?.length) {
    body.tools = opts.tools.map(t => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }))
  }

  // 发请求
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${model.apiKey}` },
      body: JSON.stringify(body),
      signal: opts.signal,
    })
  } catch (e) {
    if (opts.signal?.aborted) { yield { type: 'done', stopReason: 'aborted' }; return }
    yield { type: 'error', error: e as Error }; return
  }

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => 'unknown error')
    yield { type: 'error', error: new Error(`API ${response.status}: ${text}`) }; return
  }

  // 逐行解析 SSE
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  let stopReason: 'end_turn' | 'tool_use' | 'max_tokens' = 'end_turn'
  const toolCallBuffers = new Map<number, { id: string; name: string; argsBuf: string }>()

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })

      let nl: number
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim()
        buf = buf.slice(nl + 1)
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6)
        if (data === '[DONE]') continue

        const result = handleSSELine(data, toolCallBuffers)
        if (result.textDelta) yield { type: 'text_delta', delta: result.textDelta }
        if (result.stopReason) stopReason = result.stopReason
      }
    }
  } catch (e) {
    if (opts.signal?.aborted) { yield { type: 'done', stopReason: 'aborted' }; return }
    yield { type: 'error', error: e as Error }; return
  }

  // 发出累积的 tool_calls
  for (const tc of flushToolCalls(toolCallBuffers)) {
    yield { type: 'tool_call', id: tc.id, name: tc.name, args: tc.args }
  }
  yield { type: 'done', stopReason: opts.signal?.aborted ? 'aborted' : stopReason }
}

// ===== message 构建辅助函数 =====

/** 从一轮 stream 的事件中累积出 assistant message */
export function buildAssistantMessage(
  text: string,
  toolCalls: { id: string; name: string; args: unknown }[],
): Message {
  const content: ContentBlock[] = []
  if (text) content.push({ type: 'text', text })
  for (const tc of toolCalls) {
    content.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.args })
  }
  return { role: 'assistant', content }
}

/** 构造 tool_result user message */
export function buildToolResultMessage(
  results: { tool_use_id: string; content: string }[],
): Message {
  return {
    role: 'user',
    content: results.map(r => ({
      type: 'tool_result' as const,
      tool_use_id: r.tool_use_id,
      content: r.content,
    })),
  }
}

```

### Core Architecture Module: `src/tools.ts`
```
// src/tools.ts
// 4 个内置工具 —— 能读写改代码并执行验证的最小集。
// 每个 tool 是纯函数：async (args) => string，不碰 agent 状态。
// 注意：教学版不验证 args，生产 agent 应在 execute 前用 parameters validate 参数。

import { promises as fs } from 'node:fs'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import * as path from 'node:path'
import * as os from 'node:os'
import type { AgentTool } from './agent.js'

const execAsync = promisify(exec)

/** 工具输出截取上限（行数），超过则截取尾部并提示 */
const MAX_OUTPUT_LINES = 200

let truncateCounter = 0

/**
 * 截取工具输出：超过 maxLines 行时只保留尾部，完整输出存到临时文件。
 * 尾部优先——错误信息通常在末尾。
 */
async function truncateOutput(content: string, maxLines = MAX_OUTPUT_LINES): Promise<string> {
  const lines = content.split('\n')
  if (lines.length <= maxLines) return content
  const kept = lines.slice(-maxLines).join('\n')
  const tmpPath = path.join(os.tmpdir(), `nanopi-output-${process.pid}-${truncateCounter++}.txt`)
  await fs.writeFile(tmpPath, content, 'utf-8')
  return `[output truncated: showing last ${maxLines} of ${lines.length} lines. full output: ${tmpPath}]\n${kept}`
}

/** read_file：返回文件内容（截取尾部防止超大输出） */
const readFile: AgentTool = {
  name: 'read_file',
  description: '读取文件内容。参数：path（文件路径）。大文件截取最后 200 行。',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '要读取的文件路径' },
    },
    required: ['path'],
  },
  execute: async (args) => {
    const { path: filePath } = args as { path: string }
    const content = await fs.readFile(filePath, 'utf-8')
    return await truncateOutput(content)
  },
}

/** write_file：覆盖写入文件 */
const writeFile: AgentTool = {
  name: 'write_file',
  description: '写入文件（覆盖）。参数：path（路径）、content（内容）',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '要写入的文件路径' },
      content: { type: 'string', description: '文件内容' },
    },
    required: ['path', 'content'],
  },
  execute: async (args) => {
    const { path: filePath, content } = args as { path: string; content: string }
    await fs.mkdir(path.dirname(filePath) || '.', { recursive: true })
    await fs.writeFile(filePath, content, 'utf-8')
    return `wrote ${filePath} (${content.length} chars)`
  },
}

/** edit：局部字符串替换（精确匹配 + 唯一性校验） */
const edit: AgentTool = {
  name: 'edit',
  description: '编辑文件：精确替换一段文本。参数：path、old_string、new_string。old_string 必须在文件中唯一匹配，否则报错。',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '文件路径' },
      old_string: { type: 'string', description: '要被替换的文本（必须唯一匹配）' },
      new_string: { type: 'string', description: '替换后的文本' },
    },
    required: ['path', 'old_string', 'new_string'],
  },
  execute: async (args) => {
    const { path: filePath, old_string, new_string } = args as { path: string; old_string: string; new_string: string }
    const content = await fs.readFile(filePath, 'utf-8')
    const count = content.split(old_string).length - 1
    if (count === 0) throw new Error(`old_string not found in ${filePath}`)
    if (count > 1) throw new Error(`old_string matches ${count} places in ${filePath}, must be unique`)
    // 用函数替换避免 new_string 中的 $ 特殊字符（$& $` $' $1）被 String.replace 解释
    const newContent = content.replace(old_string, () => new_string)
    await fs.writeFile(filePath, newContent, 'utf-8')
    return `edited ${filePath}: replaced ${old_string.length} chars`
  },
}

/** run_bash：执行 shell 命令（截取尾部输出防止超大输出） */
const runBash: AgentTool = {
  name: 'run_bash',
  description: '执行 shell 命令。参数：command（命令字符串）。返回 stdout+stderr，截取最后 200 行。',
  parameters: {
    type: 'object',
    properties: {
      command: { type: 'string', description: '要执行的 shell 命令' },
    },
    required: ['command'],
  },
  execute: async (args, signal) => {
    const { command } = args as { command: string }
    try {
      const { stdout, stderr } = await execAsync(command, { maxBuffer: 1024 * 1024, timeout: 30000, signal })
      const output = stderr ? `[stderr] ${stderr}\n[stdout] ${stdout}` : stdout
      return await truncateOutput(output)
    } catch (e: unknown) {
      if (signal?.aborted) return 'aborted'
      const err = e as NodeJS.ErrnoException & { code?: number; stdout?: string; stderr?: string }
      return `[exit ${err.code}] ${err.stderr ?? ''}${err.stdout ?? ''}`
    }
  },
}

/** 返回全部内置工具 */
export function builtinTools(): AgentTool[] {
  return [readFile, writeFile, edit, runBash]
}

```

### Core Architecture Module: `src/tui.ts`
```
// src/tui.ts
// 极简终端界面 —— 单行输入 + 流式输出 + Ctrl+C 打断。
// 不做 differential renderer、不做 component 树、不做 markdown 渲染。
// 这些是"终端 UI 框架"的功课，不是"手撕 agent"的灵魂。

import * as readline from 'readline'

export class Tui {
  private rl: readline.Interface | null = null
  private onPromptCb: ((text: string) => void) | null = null
  private onAbortCb: (() => void) | null = null
  private aborted = false
  private busy = false  // agent 运行中时为 true，阻止并发输入

  /** 注册 prompt 回调 */
  onPrompt(cb: (text: string) => void): void {
    this.onPromptCb = cb
  }

  /** 注册 Ctrl+C 回调 */
  onAbort(cb: () => void): void {
    this.onAbortCb = cb
  }

  /** 启动 TUI，开始读输入 */
  start(): void {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })
    process.stdin.on('keypress', (_ch: string, key: { ctrl?: boolean; name?: string } | undefined) => {
      // 只在 agent 运行时处理 Ctrl+C，空闲时交给 readline 默认行为
      if (this.busy && key?.ctrl && key?.name === 'c' && !this.aborted) {
        this.aborted = true
        this.onAbortCb?.()
      }
    })

    this.prompt()
  }
  private prompt(): void {
    if (!this.rl) return
    if (this.busy) return  // agent 运行中，不显示 prompt
    this.aborted = false
    this.rl.question('> ', (answer) => {
      const text = answer.trim()
      if (text) {
        this.onPromptCb?.(text)
        // 不立即递归 prompt()——等 setBusy(false) 时再调
      } else {
        this.prompt()  // 空输入：重新提示，不触发回调
      }
    })
  }

  /** agent 开始运行时调用，阻止新输入 */
  setBusy(busy: boolean): void {
    this.busy = busy
    if (!busy) this.prompt()  // agent 结束，恢复输入
  }

  /** 流式打印 assistant 文本 delta */
  printText(delta: string): void {
    process.stdout.write(delta)
  }

  /** 打印 tool 调用 */
  printToolCall(name: string, args: unknown): void {
    process.stdout.write(`\n[tool: ${name}] ${JSON.stringify(args)}\n`)
  }

  /** 打印 tool 结果 */
  printToolResult(name: string, result: string): void {
    process.stdout.write(`[result: ${name}] ${result}\n`)
  }

  /** 回合结束：换行 */
  printTurnEnd(): void {
    process.stdout.write('\n')
  }

  /** 停止 TUI，清理监听器 */
  stop(): void {
    this.rl?.close()
    this.rl = null
    process.stdin.removeAllListeners('keypress')
  }
}

```

### Core Architecture Module: `web/app/NudgeCounter.tsx`
```
"use client";

import { useEffect, useRef, useState } from "react";
import BellRing from "lucide-react/dist/esm/icons/bell-ring.mjs";

const counterApi = "https://countapi.mileshilliard.com/api/v1";
const counterKey = "pi_from_scratch_future_articles_nudge_v1";

type CounterResponse = {
  value?: number | string;
};

function countLabel(count: number | null): string {
  if (count === null) return "正在读取大家留下的催更…";
  if (count < 10) return "每一下都会留在这里";
  if (count < 50) return "作者已经听见敲桌声了";
  if (count < 100) return "键盘开始有点烫了";
  return "这个数字已经没法装没看见了";
}

async function readCount(increment: boolean): Promise<number> {
  const operation = increment ? "hit" : "get";
  const url = `${counterApi}/${operation}/${counterKey}`;
  const response = await fetch(url, { cache: "no-store" });
  if (!increment && response.status === 404) return 0;
  if (!response.ok) throw new Error("counter request failed");
  const data = await response.json() as CounterResponse;
  const value = Number(data.value);
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("invalid counter response");
  return value;
}

export default function NudgeCounter() {
  const [count, setCount] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const bellRef = useRef<SVGSVGElement>(null);
  const plusRef = useRef<HTMLSpanElement>(null);
  const bellAnimationRef = useRef<Animation | null>(null);
  const plusAnimationRef = useRef<Animation | null>(null);

  useEffect(() => {
    let alive = true;
    readCount(false)
      .then((value) => {
        if (alive) setCount(value);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
      bellAnimationRef.current?.cancel();
      plusAnimationRef.current?.cancel();
    };
  }, []);

  const playFeedback = () => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    bellAnimationRef.current?.cancel();
    plusAnimationRef.current?.cancel();
    bellAnimationRef.current = bellRef.current?.animate(
      [
        { transform: "rotate(0deg)" },
        { transform: "rotate(-18deg)", offset: .3 },
        { transform: "rotate(14deg)", offset: .58 },
        { transform: "rotate(-7deg)", offset: .82 },
        { transform: "rotate(0deg)" },
      ],
      { duration: 360, easing: "cubic-bezier(.16, 1, .3, 1)" },
    ) ?? null;
    plusAnimationRef.current = plusRef.current?.animate(
      [
        { opacity: 0, transform: "translateY(5px) scale(.8)" },
        { opacity: 1, transform: "translateY(0) scale(1)", offset: .24 },
        { opacity: 0, transform: "translateY(-12px) scale(1.05)" },
      ],
      { duration: 520, easing: "cubic-bezier(.16, 1, .3, 1)" },
    ) ?? null;
  };

  const nudge = () => {
    playFeedback();
    setFailed(false);
    readCount(true)
      .then((value) => setCount((current) => current === null ? value : Math.max(current, value)))
      .catch(() => setFailed(true));
  };

  const formattedCount = count === null
    ? "—"
    : new Intl.NumberFormat("zh-CN", count >= 10_000
      ? { notation: "compact", maximumFractionDigits: 1 }
      : undefined).format(count);

  return (
    <aside className="nudge-card" aria-labelledby="nudge-title">
      <div className="nudge-copy">
        <span className="nudge-kicker">想看下一篇？</span>
        <p id="nudge-title"><strong>{formattedCount}</strong><span> 次催更留在了这里</span></p>
        <small>{failed ? "刚才那一下没记上，再试试" : countLabel(count)}</small>
      </div>
      <button className="nudge-button" type="button" onClick={nudge}>
        <BellRing ref={bellRef} size={17} aria-hidden="true" />
        <span>{count === null || count === 0 ? "催一下" : "再催一下"}</span>
        <span ref={plusRef} className="nudge-plus" aria-hidden="true">+1</span>
      </button>
      <span className="sr-only" aria-live="polite">
        {failed ? "催更没有记录成功" : count === null ? "正在读取催更次数" : `当前共有 ${count} 次催更`}
      </span>
    </aside>
  );
}

```

### Core Architecture Module: `web/app/Reader.tsx`
```
"use client";

import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { marked } from "marked";
import hljs from "highlight.js/lib/core";
import typescript from "highlight.js/lib/languages/typescript";
import json from "highlight.js/lib/languages/json";
import bash from "highlight.js/lib/languages/bash";
import Check from "lucide-react/dist/esm/icons/check.mjs";
import Code2 from "lucide-react/dist/esm/icons/code-2.mjs";
import FileCode2 from "lucide-react/dist/esm/icons/file-code-2.mjs";
import Folder from "lucide-react/dist/esm/icons/folder.mjs";
import Lock from "lucide-react/dist/esm/icons/lock.mjs";
import LockOpen from "lucide-react/dist/esm/icons/lock-open.mjs";
import Menu from "lucide-react/dist/esm/icons/menu.mjs";
import Moon from "lucide-react/dist/esm/icons/moon.mjs";
import PanelRightOpen from "lucide-react/dist/esm/icons/panel-right-open.mjs";
import Sun from "lucide-react/dist/esm/icons/sun.mjs";
import X from "lucide-react/dist/esm/icons/x.mjs";
import { fullRepo, lessons, type Lesson } from "./lesson-data";
import NudgeCounter from "./NudgeCounter";
import TraceLab from "./TraceLab";

hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("ts", typescript);
hljs.registerLanguage("json", json);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("shell", bash);

type Screen = Lesson["id"] | "trace";

function GitHubMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M12 .7a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2.23c-3.22.7-3.9-1.37-3.9-1.37-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.17.08 1.78 1.2 1.78 1.2 1.04 1.78 2.72 1.27 3.38.97.1-.75.4-1.27.74-1.56-2.57-.29-5.27-1.28-5.27-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.47.11-3.05 0 0 .97-.31 3.16 1.18a10.94 10.94 0 0 1 5.76 0c2.2-1.49 3.16-1.18 3.16-1.18.63 1.58.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.71 5.38-5.29 5.67.42.36.79 1.07.79 2.16v3.2c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .7Z" />
    </svg>
  );
}

function XMark() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M18.24 2h3.31l-7.23 8.26L22.82 22h-6.66l-5.21-6.82L4.98 22H1.67l7.73-8.84L1.25 2h6.83l4.71 6.23L18.24 2Zm-1.16 17.93h1.83L7.08 3.96H5.11l11.97 15.97Z" />
    </svg>
  );
}

const figureDimensions: Record<string, [number, number]> = {
  "/figures/agent-data-flow.png": [1536, 1024],
  "/figures/agent-loop.png": [1536, 1024],
  "/figures/event-consumers.png": [1536, 1024],
  "/figures/full-roundtrip.png": [1536, 1024],
  "/figures/module-architecture.png": [1536, 1024],
  "/figures/task-sequence.png": [1774, 887],
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderMarkdown(markdown: string): string {
  const withAnchors = markdown
    .replace(
      /<!--\s*checkpoint:\s*([a-z0-9-]+)\s*-->/g,
      '<div class="checkpoint-anchor" data-checkpoint="$1" aria-hidden="true"></div>',
    )
    .replace(/^\[图：(.*)\]$/gm, (_, caption: string) => {
      return `<figure class="concept-figure"><div class="concept-mark"><span></span><span></span><span></span></div><figcaption>${escapeHtml(caption)}</figcaption></figure>`;
    });

  const renderer = new marked.Renderer();
  renderer.code = ({ text, lang }) => {
    const language = lang && hljs.getLanguage(lang) ? lang : "typescript";
    const highlighted = hljs.highlight(text, { language, ignoreIllegals: true }).value;
    return `<pre class="article-code" data-language="${escapeHtml(lang || "code")}"><code>${highlighted}</code></pre>`;
  };
  renderer.link = ({ href, title, tokens }) => {
    const text = renderer.parser.parseInline(tokens);
    const external = /^https?:\/\//.test(href);
    const attrs = external ? ' target="_blank" rel="noreferrer"' : "";
    return `<a href="${escapeHtml(href)}"${title ? ` title="${escapeHtml(title)}"` : ""}${attrs}>${text}</a>`;
  };
  renderer.image = ({ href, title, text }) => {
    const caption = escapeHtml(text);
    const [width, height] = figureDimensions[href] ?? [1536, 1024];
    return `<figure class="lesson-figure"><img src="${escapeHtml(href)}" alt="${caption}" width="${width}" height="${height}"${title ? ` title="${escapeHtml(title)}"` : ""} loading="lazy" decoding="async"><figcaption>${caption}</figcaption></figure>`;
  };

  return marked.parse(withAnchors, { gfm: true, renderer }) as string;
}

const ArticleBody = memo(function ArticleBody({ before, after }: { before: string; after: string | null }) {
  return (
    <div className="article-body">
      <div className="article-fragment" dangerouslySetInnerHTML={{ __html: before }} />
      {after !== null && <NudgeCounter />}
      {after !== null && <div className="article-fragment" dangerouslySetInnerHTML={{ __html: after }} />}
    </div>
  );
});

function addedLines(previous: string, current: string): Set<number> {
  const before = previous.split("\n");
  const after = current.split("\n");
  if (!previous) return new Set(after.map((_, index) => index + 1));

  const matrix = Array.from({ length: before.length + 1 }, () => new Uint16Array(after.length + 1));
  for (let i = 1; i <= before.length; i += 1) {
    for (let j = 1; j <= after.length; j += 1) {
      matrix[i][j] = before[i - 1] === after[j - 1]
        ? matrix[i - 1][j - 1] + 1
        : Math.max(matrix[i - 1][j], matrix[i][j - 1]);
    }
  }

  const matched = new Set<number>();
  let i = before.length;
  let j = after.length;
  while (i > 0 && j > 0) {
    if (before[i - 1] === after[j - 1]) {
      matched.add(j);
      i -= 1;
      j -= 1;
    } else if (matrix[i - 1][j] >= matrix[i][j - 1]) {
      i -= 1;
    } else {
      j -= 1;
    }
  }

  return new Set(after.map((_, index) => index + 1).filter((line) => !matched.has(line)));
}

function highlightedLine(line: string): string {
  if (!line) return "&nbsp;";
  return hljs.highlight(line, { language: "typescript", ignoreIllegals: true }).value;
}

function Header({ screen, navigate }: { screen: Screen; navigate: (screen: Screen) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);

  useLayoutEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = (prefersDark: boolean) => {
      let savedTheme: string | null = null;
      try {
        savedTheme = localStorage.getItem("pi-from-scratch-theme");
      } catch {
        savedTheme = null;
      }
      const theme = savedTheme === "light" || savedTheme === "dark"
        ? savedTheme
        : prefersDark ? "dark" : "light";
      document.documentElement.dataset.theme = theme;
      document.documentElement.style.colorScheme = theme;
    };
    const followSystemTheme = (event: MediaQueryListEvent) => applyTheme(event.matches);

    applyTheme(media.matches);
    media.addEventListener("change", followSystemTheme);
    return () => media.removeEventListener("change", followSystemTheme);
  }, []);

  const go = (next: Screen) => {
    setMenuOpen(false);
    navigate(next);
  };

  const toggleTheme = () => {
    const root = document.documentElement;
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    root.style.colorScheme = next;
    try {
      localStorage.setItem("pi-from-scratch-theme", next);
    } catch {
      return;
    }
  };

  return (
    <header className="site-header">
      <button className="brand" onClick={() => go("chapter1")} aria-label="返回先导">
        <span className="brand-mark">π</span>
        <strong>PI from Scratch</strong>
      </button>
      <nav className={`chapter-nav ${menuOpen ? "is-open" : ""}`} aria-label="课程章节">
        <button className={screen === "chapter1" ? "is-active" : ""} onClick={() => go("chapter1")}>先导</button>
        <button className={screen === "chapter2" ? "is-active" : ""} onClick={() => go("chapter2")}>创造你的 nano-pi</button>
        <button className={screen === "trace" ? "is-active" : ""} onClick={() => go("trace")}>trace 跟踪</button>
      </nav>
      <div className="header-actions">
        <a
          className="repo-link"
          href="https://github.com/SaladDay/pi-from-scratch"
          target="_blank"
          rel="noreferrer"
          aria-label="打开 GitHub 仓库"
          title="GitHub"
        >
          <GitHubMark />
        </a>
        <a
          className="repo-link"
          href="https://x.com/saladdayyy"
          target="_blank"
          rel="noreferrer"
          aria-label="打开 SaladDay 的 X 账号"
          title="X / @saladdayyy"
        >
          <XMark />
        </a>
        <button className="theme-toggle" onClick={toggleTheme} aria-label="切换浅色或深色模式" title="切换显示模式">
          <Moon className="theme-icon theme-icon-moon" size={16} />
          <Sun className="theme-icon theme-icon-sun" size={16} />
        </button>
        <button
          className="menu-button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "关闭章节菜单" : "打开章节菜单"}
        >
          {menuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>
    </header>
  );
}

function CodePanel({
  lesson,
  activeIndex,
  panelRef,
  openFiles,
  setOpenFiles,
  navigationLocked,
  setNavigationLocked,
}: {
  lesson: Lesson;
  activeIndex: number;
  panelRef: React.RefObject<HTMLDivElement | null>;
  openFiles: string[];
  setOpenFiles: React.Dispatch<React.SetStateAction<string[]>>;
  navigationLocked: boolean;
  setNavigationLocked: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const checkpoint = activeIndex >= 0 ? lesson.checkpoints[activeIndex] : null;
  const previous = activeIndex > 0 ? lesson.checkpoints[activeIndex - 1] : null;
  const initialRepo = lesson.initialRepo ?? {};
  c
```

### Core Architecture Module: `web/app/TraceLab.tsx`
```
"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import hljs from "highlight.js/lib/core";
import typescript from "highlight.js/lib/languages/typescript";
import ChevronLeft from "lucide-react/dist/esm/icons/chevron-left.mjs";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right.mjs";
import FileCode2 from "lucide-react/dist/esm/icons/file-code-2.mjs";
import Folder from "lucide-react/dist/esm/icons/folder.mjs";
import Play from "lucide-react/dist/esm/icons/play.mjs";
import RotateCcw from "lucide-react/dist/esm/icons/rotate-ccw.mjs";
import { fullRepo } from "./lesson-data";
import { traceCases } from "./trace-data.generated";
import { buildDebugFrames } from "./trace-debugger";
import type { TraceSource } from "./trace-types";

if (!hljs.getLanguage("typescript")) hljs.registerLanguage("typescript", typescript);

const sourceOrder: TraceSource["file"][] = [
  "src/cli.ts",
  "src/agent.ts",
  "src/llm.ts",
  "src/tools.ts",
  "src/tui.ts",
];

function highlightLine(line: string): string {
  if (!line) return "&nbsp;";
  return hljs.highlight(line, { language: "typescript", ignoreIllegals: true }).value;
}

function breakpointKey(source: TraceSource): string {
  return `${source.file}:${source.line}`;
}

function formatDebugValue(value: unknown): string {
  return JSON.stringify(value, null, 2) ?? String(value);
}

export default function TraceLab() {
  const [caseIndex, setCaseIndex] = useState(0);
  const [frameIndex, setFrameIndex] = useState(0);
  const [breakpoints, setBreakpoints] = useState<ReadonlySet<string>>(() => new Set());
  const [selectedFile, setSelectedFile] = useState<TraceSource["file"]>("src/tui.ts");
  const codeScrollRef = useRef<HTMLDivElement>(null);

  const traceCase = traceCases[caseIndex] ?? null;
  const debugFrames = useMemo(() => traceCase ? buildDebugFrames(traceCase) : [], [traceCase]);
  const frame = debugFrames[frameIndex] ?? null;
  const sourceCode = fullRepo[selectedFile] ?? "";
  const sourceLines = useMemo(() => sourceCode.split("\n"), [sourceCode]);
  const executableLines = useMemo(() => new Set(
    debugFrames
      .filter((item) => item.source.file === selectedFile)
      .map((item) => item.source.line),
  ), [debugFrames, selectedFile]);

  const selectCase = (nextIndex: number) => {
    setCaseIndex(nextIndex);
    setFrameIndex(0);
    const first = traceCases[nextIndex] ? buildDebugFrames(traceCases[nextIndex])[0] : null;
    if (first) setSelectedFile(first.source.file);
  };

  const goToFrame = (next: number) => {
    if (!debugFrames.length) return;
    const bounded = Math.max(0, Math.min(debugFrames.length - 1, next));
    setFrameIndex(bounded);
    setSelectedFile(debugFrames[bounded].source.file);
  };

  const continueToBreakpoint = () => {
    if (!debugFrames.length || frameIndex >= debugFrames.length - 1) return;
    const nextHit = debugFrames.findIndex((item, index) => (
      index > frameIndex && breakpoints.has(breakpointKey(item.source))
    ));
    goToFrame(nextHit >= 0 ? nextHit : debugFrames.length - 1);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select")) return;
      if (event.key === "F10") {
        event.preventDefault();
        goToFrame(frameIndex + 1);
      } else if (event.key === "F5") {
        event.preventDefault();
        continueToBreakpoint();
      } else if (!target?.closest("button, a") && event.key === "ArrowRight") {
        event.preventDefault();
        goToFrame(frameIndex + 1);
      } else if (!target?.closest("button, a") && event.key === "ArrowLeft") {
        event.preventDefault();
        goToFrame(frameIndex - 1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  useLayoutEffect(() => {
    const scroller = codeScrollRef.current;
    if (!scroller || !frame || selectedFile !== frame.source.file) return;
    const line = scroller.querySelector<HTMLElement>(`[data-trace-line="${frame.source.line}"]`);
    if (!line) return;
    scroller.scrollTo({
      top: Math.max(0, line.offsetTop - scroller.clientHeight * 0.38),
      behavior: "auto",
    });
  }, [frame, selectedFile]);

  const toggleBreakpoint = (line: number) => {
    if (!executableLines.has(line)) return;
    const key = breakpointKey({ file: selectedFile, line });
    setBreakpoints((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (!traceCase || !frame) {
    return (
      <main className="trace-shell trace-empty">
        <p>trace 尚未生成。</p>
      </main>
    );
  }

  const eventJson = frame.event ? JSON.stringify(frame.event, null, 2) : null;
  const progress = ((frameIndex + 1) / debugFrames.length) * 100;

  return (
    <main className="trace-shell">
      <section className="trace-workspace">
        <nav className="trace-case-sidebar" aria-label="trace 案例">
          <header className="trace-pane-heading">
            <strong>cases</strong>
            <span>{traceCases.length}</span>
          </header>
          <div className="trace-case-list">
            {traceCases.map((item, index) => (
              <button
                key={item.id}
                className={index === caseIndex ? "is-active" : ""}
                onClick={() => selectCase(index)}
              >
                <span>{item.number}</span>
                {item.title}
              </button>
            ))}
          </div>
        </nav>

        <div className="trace-code-pane">
          <header className="trace-pane-heading">
            <strong>nanopi /</strong>
            <span>{selectedFile}</span>
          </header>
          <div className="trace-repo-workspace">
            <nav className="trace-file-tree" aria-label="trace 源文件">
              <div className="tree-root"><Folder size={14} /> src</div>
              {sourceOrder.map((file) => (
                <button
                  key={file}
                  className={selectedFile === file ? "is-active" : ""}
                  onClick={() => setSelectedFile(file)}
                >
                  <FileCode2 size={14} />
                  <span>{file.replace("src/", "")}</span>
                </button>
              ))}
            </nav>
            <div className="trace-source-stage">
              <div className="code-tab"><FileCode2 size={13} />{selectedFile.replace("src/", "")}</div>
              <div className="trace-code-scroll" ref={codeScrollRef}>
                {sourceLines.map((line, index) => {
                  const lineNumber = index + 1;
                  const lineSource = { file: selectedFile, line: lineNumber };
                  const hasBreakpoint = breakpoints.has(breakpointKey(lineSource));
                  const isExecutable = executableLines.has(lineNumber);
                  const isCurrent = selectedFile === frame.source.file && lineNumber === frame.source.line;
                  return (
                    <div
                      className={`trace-code-line ${isCurrent ? "is-current" : ""} ${isExecutable ? "is-executable" : ""}`}
                      data-trace-line={lineNumber}
                      key={`${lineNumber}-${line}`}
                    >
                      <button
                        className={hasBreakpoint ? "has-breakpoint" : ""}
                        onClick={() => toggleBreakpoint(lineNumber)}
                        disabled={!isExecutable}
                        aria-label={`${hasBreakpoint ? "移除" : "设置"} ${selectedFile} 第 ${lineNumber} 行断点`}
                      >
                        {lineNumber}
                      </button>
                      <code dangerouslySetInnerHTML={{ __html: highlightLine(line) }} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <aside className="trace-inspector" aria-label="当前 trace 状态">
          <header className="trace-pane-heading">
            <strong>{String(frameIndex + 1).padStart(2, "0")} / {String(debugFrames.length).padStart(2, "0")}</strong>
            <span>{frame.source.file}:{frame.source.line}</span>
          </header>

          <section className="trace-prompt-panel">
            <h3>prompt</h3>
            <p>{traceCase.prompt}</p>
          </section>

          <div className="trace-inspector-scroll">
            <section className="trace-variable-panel" aria-live="polite">
              <header><h3>Core State</h3><span>{frame.label}</span></header>
              <dl>
                {Object.entries(frame.variables).map(([name, value]) => (
                  <div key={name}>
                    <dt>{name}</dt>
                    <dd><pre>{formatDebugValue(value)}</pre></dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="trace-stack-panel">
              <h3>Call Stack</h3>
              {frame.callStack.map((item, index) => (
                <button key={`${item.name}-${index}`} onClick={() => setSelectedFile(item.source.file)}>
                  <span>{item.name}</span>
                  <i>{item.source.file}:{item.source.line}</i>
                </button>
              ))}
            </section>

            {eventJson && (
              <section className="trace-event-panel">
                <h3>Event</h3>
                <pre>{eventJson}</pre>
              </section>
            )}

            <section className="trace-context-panel">
              <header><h3>Context</h3><span>{frame.context.messages.length} messages</span></header>
              {frame.context.systemPrompt && (
                <article className="trace-message trace-system-message">
                  <span>system</sp
```

### Core Architecture Module: `web/app/content.generated.ts`
```
// Generated from ../docs and ../src. Do not edit by hand.

export const lessonMarkdown = {
  "outline": "# PI from Scratch\n\n> 从零手撕一个 AI Coding Agent\n\n## 全书结构\n\n### 第一章：五个文件，各管各的\n\n**目标**：读完知道每个模块是干嘛的，脑子里有张地图。\n\n**内容**：\n1. 先看全貌：总共 5 个文件，~750 行，对标 pi 上万行\n2. 每个模块一段话讲清楚\"做什么\"和\"不做什么\"：\n   - `llm.ts`：跟 LLM API 说话的翻译官，进去是 Context，出来是 4 种事件流\n   - `agent.ts`：整个项目的灵魂，就一个 while 循环\n   - `tools.ts`：4 个纯函数，能读能写能改能跑命令\n   - `tui.ts`：最糙的终端界面，能打字能看输出能 Ctrl+C\n   - `cli.ts`：胶水层，把上面四个粘起来，顺便存个盘\n3. 跟 pi 的对应关系，砍了什么、为什么砍\n4. 一张架构图（文字版，不依赖 mermaid 渲染）\n\n**篇幅**：~1500 字\n\n\n### 第二章：从一个 while 循环开始\n\n**目标**：从数据流出发，一步步拼出完整代码。不是\"我给你看代码\"，是\"我们需要什么，就造什么\"。\n\n**行文线索**：\n\n1. **起点：agent 到底是什么？**\n   - 一句话定义：能调工具的 LLM，自己决定下一步做什么\n   - 那核心就是一个循环：问 LLM → LLM 说要调工具 → 调完把结果喂回去 → 再问\n   - 先写出最简版伪代码（10 行以内），把骨架亮出来\n\n2. **第一个问题：怎么跟 LLM 说话？**\n   - 引出 `llm.ts` 的 `stream()` 函数\n   - 先讲 Context 是什么（就是聊天记录，纯 JSON）\n   - 再讲 SSE 流式响应怎么解析成 4 种事件\n   - 对比 pi 的 pi-ai：我们只做单 provider，把\"脏活\"砍干净\n   - 讲 `contextToOpenAIMessages`：为什么要做格式转换（nanopi 内部格式 vs OpenAI 格式）\n\n3. **第二个问题：LLM 要调工具，工具哪来？**\n   - 引出 `tools.ts`\n   - 4 个工具的设计：为什么是这四个（读/写/改/跑，最小完备集）\n   - `edit` 为什么用字符串匹配而不是行号\n   - 输出截取：工具输出可能巨大，得截\n\n4. **把循环补完整：agent loop**\n   - 回到第 1 步的伪代码，把真实代码填进去\n   - `runAgent()` 逐段讲解：\n     - 流式收集 text 和 tool_calls\n     - 没有 tool_call？循环结束，模型说完了\n     - 有 tool_call？执行，结果塞回 context，继续循环\n   - 两个边界情况：\n     - `max_tokens` 截断：tool 参数可能是半截 JSON，别执行，告诉模型重发\n     - `aborted`：用户按了 Ctrl+C，丢掉 tool_calls，收工\n\n5. **context 会撑爆的：compaction**\n   - 聊久了消息越来越多，context 有上限\n   - 最简方案：消息超过 50 条，让 LLM 总结旧的，用摘要替换\n   - 对比 pi：原版 970 行做精确 token 估算，我们用消息条数近似\n\n6. **得有个界面吧：tui**\n   - 引出 `tui.ts`\n   - readline 读输入，process.stdout.write 流式输出\n   - Ctrl+C 的处理：busy 状态下才拦截，否则交给系统\n   - 对比 pi 的 pi-tui：differential renderer 是什么，为什么不碰\n   - **关键洞察：UI 只是 AgentEvent 的消费者**\n     - `runAgent()` 吐出的是一串结构化事件（assistant_text / tool_call / tool_result / turn_end）\n     - tui 只是用 `process.stdout.write` 消费它，但这不是唯一方式\n     - 这个结构跟前后端分离一模一样：agent 是后端 API，UI 是前端，中间靠事件协议通信\n   - **范例：换个\"前端\"**\n     - 写一个 20 行的 HTTP server，把 AgentEvent 用 SSE 推给浏览器\n     - 或者更简单：写个函数把 AgentEvent 攒成纯 JSON 返回，模拟 REST API\n     - 重点不是这个 demo 本身，而是让读者看到：agent 核心逻辑一行没动，只是换了个消费端\n     - 这也是 pi 的架构哲学：pi-agent-core 完全不知道 pi-tui 的存在\n\n7. **最后把它们粘起来：cli**\n   - 引出 `cli.ts` 的 `main()` 函数\n   - 事件转发：agent 的 AgentEvent → tui 的 print 方法，一个 switch 搞定\n   - session 持久化：每轮结束 append 到 JSONL，下次启动加载回来\n   - 整个数据流走一遍：用户输入 → context → LLM → tool → context → LLM → ... → 屏幕\n\n**篇幅**：~5000 字\n\n\n### 第三章：跑起来看看（可选）\n\n**目标**：实际跑一遍，看数据怎么流的。\n\n**内容**：\n1. 环境准备：npm install，设 API key\n2. 跑一个简单任务：\"把 hello.txt 改成大写\"\n3. 逐步看终端输出，对应到代码里的每个环节\n4. 看 session.jsonl 里存了什么\n\n**篇幅**：~1000 字\n\n\n## 写作约束\n\n- 中文为主，技术术语保留英文（Context、stream、tool_call 等）\n- 不用破折号（——），用逗号或句号断句\n- 禁止翻案腔：\"不是A而是B\"、\"不在于A在于B\"、\"与其说A不如说B\"、\"看似A实则B\"。判断从正面下，直接说结论\n- 避免 AI 味的总结句、过渡句和元叙述（\"让我们来看看\"、\"总结一下\"、\"接下来\"、\"用大白话说就是\"、\"简单来说\"、\"先把这件事说清楚\"之类，直接说事情本身，别加\"我要用什么方式跟你说\"或\"我要把什么搞清楚\"这种框）\n- 语气像在跟朋友讲，偶尔可以粗一点（\"这破玩意儿\"、\"别管那些花里胡哨的\"）\n- 代码块只放关键片段，不贴完整文件（完整代码让读者自己去看 src/）\n- 每引入一个新概念前，先用一句话说清楚\"为什么需要它\"\n- 不要反复说同一件事。一个信息在最合适的地方讲一次就够了。\"600 行\"、\"砍了什么\"这类标签说一次就行，翻来覆去讲读者会烦\n- 不要提前透露后面章节才展开的设计细节。第一章只说\"是什么\"，不展开\"怎么做的\"\n- 段落式写法为主，少用列表。要讲三件事就写三段话，别上来就 1. 2. 3.\n- 适当用图辅助理解（架构图、数据流图、时序图等），先用 `[图：xxx]` 占位描述，后续替换为正式图\n- 专业术语首次出现时用 `>` 引用块加注释，用一两句大白话解释清楚。比如 SSE、async generator、context window、JSON Schema 这类词，不能假设读者都知道\n",
  "chapter1": "\"What I cannot create, I do not understand.\" Richard Feynman 去世时，黑板上留着这句话。\n\n[pi](https://github.com/earendil-works/pi) 是一个上万行的生产级 AI coding agent。nanopi 是它的教学版，600 行代码。\n\n这篇文章的食用方式很简单。我们写的时候采用的方案是跟着数据流走、需要什么就写什么，每个模块的出现都是直觉的。右侧有一个编辑器，你读到哪一块，那一块的代码就会浮现出来。读完整篇文章，nanopi 的源码就全都完整了。\n\n> 如果你不想编辑器随着文章滚动动来动去，编辑器右上角有个锁，打开它。\n\n放轻松，这是一篇文章，不是一本书，而且是给初学者写的，你会很容易看懂。同时，我们有一个“语法扫盲块“，不用担心TS的语法看不懂。\n\n> BTW，现在是一篇文章，后续可能会变成很多篇。pi 里还有不少 nano-pi 没覆盖的东西值得单独写，比如精确的 token 估算和 compaction 切割策略、TypeScript 扩展系统（extensions / skills）、多 provider 适配和 model routing、session branching、以及 pi-tui 的 differential renderer【这些词是什么意思都不用管，只是预告一下】。方便的话，或许能给 [github仓库](https://github.com/SaladDay/pi-from-scratch) 点点star，这给我提供了继续更新下去的动力🤗。\n\n<!-- nudge-counter -->\n\n## 让我们开始吧。\n\nnanopi 整个项目就五个 TypeScript 文件。在开始跟着数据流造代码之前，先花两分钟记住这五个文件做什么、不做什么、对外暴露什么。\n\n## llm.ts\n\n跟具体的不同厂家的 LLM API 通信。输入 Context（聊天记录，纯 JSON），输出一串流式事件（StreamEvent）。四种事件：`text_delta`（模型吐了一段文字）、`tool_call`（模型想调工具）、`done`（这轮结束了）、`error`（炸了）。HTTP 怎么发、SSE 怎么解析、tool_call 的分片参数怎么拼，全是他的工作，上层不用管，只需要处理他输出的流式事件。\n\nContext 定义在这个文件里，因为 Context 本质上就是\"喂给 LLM 的东西\"，归 LLM 层管。pi 也是同样的做法。Context 的结构很简单，一个 `systemPrompt` 加一个 `messages` 数组，纯 JSON，可以直接 `JSON.stringify` 存到文件里，下次load回来就可以继续聊天了。\n\n对外暴露 `stream()` 函数，以及 Context、Message、StreamEvent 等类型定义。pi 里对应 `pi-ai` 包，pi-ai 要适配十几个 provider，nanopi 只支持 OpenAI 兼容格式。\n\n> 最草履虫的理解，上游有很多模型，有各种乱七八糟的细节，llm.ts（也就是pi中pi-ai包）负责接收context，转化成乱七八糟的格式转交给供应商的模型，然后将乱七八糟的格式整理好，对外持续输出流式的事件。\n\n\n## agent.ts\n\nagent 的循环，整个项目的核心。调 `llm.ts` 的 `stream()` 问模型，模型说要调工具就调，调完把结果塞回 Context 再问，持续这个过程，直到模型说“好了好了，我要结束了“。\n\n对外暴露 `runAgent()` 函数，往外吐 AgentEvent（assistant_text / tool_call / tool_result / turn_end）。AgentEvent 跟 llm 层的 StreamEvent 不是一套，语义更高级。这两层事件的分离是有意的，UI 层只需要认识 AgentEvent，不用关心 LLM 的具体响应是什么。\n\npi 里对应 `pi-agent-core`。\n\n> 最草履虫的理解又来了，这里是维护了agent最核心的循环：模型思考决策，环境反馈；持续循环，不停转转转。对外也输出一些流式的事件，为什么要输出事件？？因为外部可以消费这些事件，就知道模型现在的干嘛，也就是你能看到模型在“thinking“、“tool-calling“....\n\n\n## tools.ts\n\n四个工具：`read_file`、`write_file`、`edit`、`run_bash`。pi 的 agent-core 层也是这四个。\n\n每个工具是一个纯函数，接收参数返回字符串结果。它们不碰 agent 状态，不知道 Context 的存在，甚至不知道自己是被 agent 调用的。这样设计的好处是工具可以独立测试、独立替换，加一个新工具也不需要改 agent 的任何代码。\n\n对外暴露 `builtinTools()` 函数，返回四个工具的数组。\n\n\n## tui.ts\n\n终端界面。用 `readline` 读用户输入，用 `process.stdout.write` 流式打印模型回复，监听 Ctrl+C 触发 abort。\n\n`tui.ts` 不知道 LLM 的存在，也不知道工具怎么执行。它只认识 AgentEvent，来什么事件就打印什么内容。换成 Web 前端或者别的什么东西，agent 代码一行不用动。这跟 Web 开发里的前后端分离一个道理：agent 是后端，UI 是前端，AgentEvent 是它们之间的协议（类似于前后端中的restAPI、RPC等等）。\n\n对外暴露 `Tui` 类，提供 `onPrompt()`、`onAbort()`、`printText()`、`printToolCall()`、`printToolResult()` 等方法。\n\n`runAgent()` 往外吐 AgentEvent。在nanopi 里由 CLI 接收这些事件，再给 Tui 、让他渲染出来；换成 Web 应用时，可以让 HTTP server 接收同一条事件流，再通过 SSE 发给浏览器、让浏览器渲染结果。nanopi 自带的是左边那个 tui，但你随时可以换成别的。\n\n![同一个 AgentEvent 流可以被不同界面消费](/figures/event-consumers.png)\n\n\n## cli.ts\n\n胶水。读配置，造 Model，拿到工具和TUI，监听输入，把 AgentEvent 转发给 TUI 显示。每轮结束把消息 append 到 `~/.nanopi/session.jsonl`。\n\npi 里对应 `pi-coding-agent`【碎碎念，在我们这可能比较简单，在pi中包括了各种前置后置检查hook等，还是有复杂度的】。\n\n\n## 它们怎么协作\n\n五个模块拼起来以后，数据流长这样。\n\n用户输入从 tui 出发，cli 把它塞进 Context 交给 agent。agent 调 llm 的 `stream()` 问模型，模型回复（可能带着 tool_call）通过 agent 转发给 tui 显示。有 tool_call 就找 tools 执行，把结果放回到 Context，再问。没 tool_call 就等用户下一轮输入。每轮结束 cli 把新增的消息持久化到 `~/.nanopi/session.jsonl`。\n\n![nanopi 一轮完整的数据流](/figures/full-roundtrip.png)\n\n换个角度，看依赖关系。llm 不知道 agent 的存在，agent 不知道 tui 长什么样，tools 不知道自己被谁调用，tui 只认识 AgentEvent。cli 是唯一知道所有人的那个，它的工作就是把它们粘在一起。这种单向依赖让每个模块都可以独立替换，换掉 tui、换掉 tools、甚至换掉 llm 的 provider，上下游都不用改。\n\n![nanopi 五模块依赖关系](/figures/module-architecture.png)\n\n\n**好了，现在已经知道有哪些模块了，我已经迫不及待想开始写代码了！**\n",
  "chapter2": "第一章看了地图，知道五个文件各管什么。右侧现在已经有五个空文件。这一章跟着数据流一步步把它们填起来，需要什么，就写什么。\n\n\n## agent 到底是什么\n\n一个普通的 LLM 聊天程序，你问一句它答一句。agent 多了一个能力：LLM 可以调工具。它读到你的问题，觉得需要先看看某个文件，发出一个 tool_call，程序帮它执行完，把结果喂回去，它再接着想。反复这个过程，直到它觉得事情做完了，直接回复你。\n\n<!-- checkpoint: pseudo-loop -->\n\n先不管细节，只把循环的几个位置摆出来。右侧的 `src/agent.ts` 现在只有一副骨架：准备本轮数据、问 LLM、判断要不要停、执行工具、把结果放回 Context。循环内部还是空的，后面会一段一段填上。\n\n<details class=\"syntax-block\">\n<summary class=\"syntax-toggle\">语法速查</summary>\n<div class=\"syntax-body\">\n\n**`export`** — 标记\"这个函数可以被其他文件引用\"。不写 `export` 的东西只在当前文件内部可见。\n\n**`async`** — 函数里需要等待异步操作（比如网络请求），程序不会卡住。\n\n**`: Context`** — 冒号后面是参数的类型。这里先写下 `Context` 这个名字，稍后在 `llm.ts` 里定义它的具体形状。\n\n</div>\n</details>\n\n这副骨架暂时还不能运行，`Model`、`Context`、`AgentTool` 和 `AgentEvent` 也都还没定义。注释编号暂时不连续，空着的 0、3、6 是后面才会插入的小细节。现在只需要记住数据流的顺序，后面每一轮出现的代码都会回填这些位置。\n\n\n## 怎么跟 LLM 说话\n\n骨架里的第一件事是\"问 LLM\"。怎么问？LLM 的 API 就是一个 HTTP 接口，你 POST 一段聊天记录过去，它返回模型的回复。但发 HTTP 请求、处理网络错误这些脏活不该散落在代码各处，集中封一个函数比较好。\n\n> 如果你正在寻找稳定可靠、模型选择丰富的 AI API，可以试试 [OpenModel](https://www.openmodel.ai?ref=JGDNqZl8)。一个接口即可调用 50+ 主流模型，并提供生产级 SLA 保障，省去频繁切换平台的麻烦。\n\n这时候聪明的读者想起了第一章中的llm.ts，他就是做这个的。\n\n<!-- checkpoint: llm-types -->\n\n造这个函数之前先定义几种数据形状。函数需要知道往哪发（Model 配置）、发什么（Context），它吐出来的东西也得有个统一格式（StreamEvent）。回复里可能同时包含文本和 tool_call，所以单条消息还得拆成更细的 ContentBlock。这些类型全部放在 `llm.ts` 的最前面。\n\nContext 的结构很简单，一个 `systemPrompt` 加一个 `messages` 数组，纯 JSON。\n\n```json\n{\n  \"systemPrompt\": \"你是一个编码助手。\",\n  \"messages\": [\n    { \"role\": \"user\", \"content\": \"读一下 hello.txt\" },\n    { \"role\": \"assistant\", \"content\": [\n      { \"type\": \"text\", \"text\": \"我来读取这个文件。\" },\n      { \"type\": \"tool_use\", \"id\": \"call_1\", \"name\": \"read_file\", \"input\": {\"path\": \"hello.txt\"} }\n    ]},\n    { \"role\": \"user\", \"content\": [\n      { \"type\": \"tool_result\", \"tool_use_id\": \"call_1\", \"content\": \"hello world\" }\n    ]}\n  ]\n}\n```\n\n`tool_result` 嵌在 user message 里作为 content 的一部分，整个数组可以直接 `JSON.stringify` 保存。\n\n最后一个 `ToolDef` 是交给 LLM API 的精简工具描述，只保留 name、description 和 parameters，不包含真正执行代码的 execute。\n\n<details class=\"syntax-block\">\n<summary class=\"syntax-toggle\">语法速查</summary>\n<div class=\"syntax-body\">\n\n**`type`** — 可以理解成class、结构体等。`type Model = { apiKey: string; model: string }` 说的是\"Model 对象里必须有 apiKey 和 model 两个字符串字段\"。\n\n**`|`（联合类型）** — `A | B | C` 表示\"这个变量可能是 A，也可能是 B，也可能是 C\"。\n\n**`?`（可选属性）** — `baseUrl?: string` 的 `?` 表示这个字段可以不填。\n\n</div>\n</details>\n\n<!-- checkpoint: llm-stream -->\n\n类型定义好以后，`stream()` 的签名就很自然了。右侧的 `src/llm.ts` 里现在有了这些类型加上一个函数骨架。\n\n```typescript\nasync function* stream(model, context, opts): AsyncGenerator<StreamEvent>\n```\n\n它是个异步生成器，调用方用 `for await` 一个一个收事件。\n\n<details class=\"syntax-block\">\n<summary class=\"syntax-toggle\">语法速查</summary>\n<div class=\"syntax-body\">\n\n**`async function*`** — 异步生成器。比普通 `async function` 多一个 `*`，调用方用 `for await...of` 一个个收。\n\n</div>\n</details>\n\nLLM 的回复是流式的，用的是 SSE 协议。服务器不是一口气返回全部内容，而是一行一行往回推数据，每行以 `data: ` 开头，LLM 的\"打字机效果
```

### Core Architecture Module: `web/app/layout.tsx`
```
import type { Metadata } from "next";
import "./globals.css";

const deploymentHost = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.NEXT_PUBLIC_SITE_URL;
const origin = deploymentHost
  ? deploymentHost.startsWith("http") ? deploymentHost : `https://${deploymentHost}`
  : "http://localhost:3000";
const title = "PI from Scratch · 创造属于你的pi-agent";
const description = "沿着数据流读懂五个 TypeScript 文件，从零写出 Agent Loop，并用断点回放真实 trace。";

export const metadata: Metadata = {
  metadataBase: new URL(origin),
  title,
  description,
  keywords: ["AI agent", "coding agent", "agent loop", "tool calling", "TypeScript", "pi"],
  alternates: { canonical: origin },
  openGraph: {
    title,
    description,
    type: "website",
    images: [{ url: "/og.png", width: 1731, height: 909, alt: title }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #7** (2026-09-12): **Add OrcaRouter as an optional AI provider**
  *Symptoms*: Hi maintainers,  We'd like to propose adding [OrcaRouter](https://www.orcarouter.ai) as an optional AI provider alongside the providers already supported by the project.  OrcaRouter exposes an OpenAI-compatible API and uses standard API-key authentication, so the integration should be able to reuse the project's existing OpenAI/provider abstraction with minimal changes.  ## What this would add  - Access to multiple chat, reasoning, image, and video models through one endpoint - Automatic model routing and provider failover - Standard API-key authentication - Prompt caching - Usage tracking, budgets, and team access controls  The integration would not replace or modify any existing provider. OrcaRouter would simply appear as another provider option that users can configure with their own API key.  ## Existing OSS ecosystem  OrcaRouter is already integrated with or available across a growing open-source ecosystem, including RAGFlow, Dify, goose, promptfoo, NocoBase, DB-GPT, CAMEL, and models.dev / OpenCode.  ## Partner program disclosure  OrcaRouter operates an optional open-source partner program. Approved OSS projects can receive a 5% revenue share from OrcaRouter usage attributed to their integration.  Participation in the partner program is not required for the provider integration, and we're happy to follow any disclosure or governance requirements maintained by the project.  More information:  https://www.orcarouter.ai/built-with  If this sounds useful, we'd be happy to d

- **Issue #5** (2026-08-18): **fix(docs): correct compaction message count**
  *Symptoms*: ## 修改内容  - 将第二章 compaction 示例中压缩后的消息数从 36 条修正为 21 条。 - 将压缩后最后一条消息的数组索引从 `messages[35]` 修正为 `messages[20]`。 - 同步更新仓库中提交的 Web 生成内容，确保与 Markdown 源文档一致。  ## 修改原因  示例最初有 55 条消息，将前 35 条替换为 1 条摘要，并保留最近 20 条消息。因此压缩后应该共有 21 条消息（`1 + 20`），数组索引范围为 0 到 20。代码实现本身已经符合这一行为，错误仅存在于文档示例中。  ## 验证  - `npm test`（25 个测试通过） - `npm run build` - `cd web && npm run lint` - `cd web && npm test`（生产构建及 2 个 HTML 渲染测试通过） 
  **Post-Mortem & Fix Analysis**:
  > Someone is attempting to deploy a commit to the **saladday's projects** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=saladday's%20projects&slug=saladdays-projects&teamId=team_jnjeHHjGtV7ouO0PEwJGNBfy&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%2227e7d3a746f6901287e36815fb1eec13bf83b861%22%7D%2C%22id%22%3A%22QmW9qsfy2VZVgSCK8wbXpZ7GbfXbQn9YpypQuT4MAQdk1N%22%2C%22org%22%3A%22SaladDay%22%2C%22prId%22%3A5%2C%22repo%22%3A%22pi-from-scratch%22%7D).  

- **Issue #4** (2026-08-18): **网站无法访问**
  *Symptoms*: 如题
  **Post-Mortem & Fix Analysis**:
  > 网站是好的，https://pi-from-scratch.vercel.app/

- **Issue #3** (2026-08-18): **fix(web): 支持配置局域网开发来源**
  *Symptoms*: ## 修改内容  - 通过 `NEXT_ALLOWED_DEV_ORIGINS` 配置 Next.js `allowedDevOrigins` - 支持逗号分隔的多个开发 hostname，并忽略空值 - 在 `web/README.md` 中补充通过局域网 `Network` 地址访问时的配置说明 - 添加配置解析测试，并让现有 `npm test` 覆盖 `tests/*.test.mjs`  ## 原因  通过 `next dev` 输出的局域网 `Network` 地址访问教学站时，Next.js 可能会阻止来自该 hostname 的开发资源请求（包括 HMR），导致页面能显示但客户端交互没有正常初始化。  这个实现不硬编码任何局域网 IP，而是让开发者按自己的网络环境显式配置允许的 hostname。  ## 验证  - `npm test` ✅ — 4 tests passed, 0 failed - `npm run lint` ✅ — no lint errors - 已检查分支相对 `main` 仅包含本 Issue 相关的 5 个文件改动  Fixes #2
  **Post-Mortem & Fix Analysis**:
  > @OliverBennettdev is attempting to deploy a commit to the **saladday's projects** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=saladday's%20projects&slug=saladdays-projects&teamId=team_jnjeHHjGtV7ouO0PEwJGNBfy&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%224c18251fbf5d257b83ac425d6368f76182203a0d%22%7D%2C%22id%22%3A%22Qmd4kpQBZSLSbt7akUP8DAMJf5poUsomUkhFhvHdUE9KMe%22%2C%22org%22%3A%22SaladDay%22%2C%22prId%22%3A3%2C%22repo%22%3A%22pi-from-scratch%22%7D).  

- **Issue #2** (2026-08-18): **本地教学站通过局域网 IP 访问时交互失效（Next.js 阻止开发资源）**
  *Symptoms*: ## 问题描述  在本机启动 `web` 教学站后，如果使用 Next.js 输出的局域网地址（例如 `http://192.168.31.245:3000/`）从浏览器访问，页面内容可以正常显示，但页面上的交互控件可能没有响应。  本次复现中，滚动到“先导”页面底部后点击“创造你的 nano-pi”，页面没有切换到下一章；地址也没有变为 `#chapter2`。这容易让使用者误以为按钮本身未实现。  ## 复现步骤  1. 进入 Web 项目：     ```bash    cd web    npm install    npm run dev    ```  2. Next.js 启动后会输出类似地址：     ```text    Local:   http://localhost:3000    Network: http://192.168.31.245:3000    ```  3. 使用浏览器打开 `Network` 地址，而不是 `localhost`。 4. 滚动到“先导”页面底部。 5. 点击“创造你的 nano-pi”。  ## 实际结果  - 页面正文能够渲染； - 点击“创造你的 nano-pi”等交互控件没有反应； - 开发服务器日志出现：    ```text   Blocked cross-origin request to Next.js dev resource /_next/webpack-hmr   from "192.168.31.245".    To allow this host in development, add it to "allowedDevOrigins"   in next.config.js and restart the dev server.   ```  这会造成一种“页面是正常的静态页面，但客户端交互没有正常初始化”的表现。  ## 期望结果  使用 Next.js 启动日志中给出的 `Network` 地址访问时，教学站应能正常加载开发资源，章节导航和底部“下一章”按钮应可点击。  ## 复现环境  - macOS / Apple Silicon（arm64） - Node.js 23.6.1 - npm 10.9.2 - Next.js 16.2.6 - Webpack 开发模式（`next dev --webpack`）  > Node.js 23 不是部分工具链推荐的版本，但本问题的直接证据是 Next.js 对局域网来源的开发资源拦截。  ## 初步原因  当前 `web/next.config.ts` 未配置 `allowedDevOrigins`。通过非默认 hostname 的局域网 IP 访问开发服务器时，Next.js 16 会阻止相关开发资源请求。  本地验证加入以下配置并重启开发服务器后，带局域网 `Origin` 请求的主要前端脚本均恢复为 HTTP 200，日志不再出现上述拦截：  ```ts const nextConfig: NextConfig = {   distDir: process.env.NEXT_DIST_DIR ?? ".next",   allowedDevOrigins: ["192.168.31.245"], }; ```  ## 建议方案  不建议在仓库中固定某一台机器的 IP。可以考虑：  1. 通过环境变量配置允许的开发 hostname，并在 `next.config.ts` 中生成 `allowedDevOr
  **Post-Mortem & Fix Analysis**:
  > Hi! I'd like to work on this. I plan to make `allowedDevOrigins` configurable via an environment variable (rather than hard-coding a LAN IP), document the setup in `web/README.md`, and add a small configuration test. I'll keep the change scoped to development access over a LAN.

- **Issue #1** (2026-08-12): **修复对话返回API 400报错问题**
  *Symptoms*: 修复测试报错： ``` > pi-from-scratch@0.1.0 dev > tsx src/cli.ts > 把 hello.md 内容换成大写  [error] API 400: {"error":{"message":"Invalid assistant message: content or tool_calls must be set","type":"invalid_request_error","param":null,"code":"invalid_request_error"}} [error occurred] ```
  **Post-Mortem & Fix Analysis**:
  > Someone is attempting to deploy a commit to the **saladday's projects** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=saladday's%20projects&slug=saladdays-projects&teamId=team_jnjeHHjGtV7ouO0PEwJGNBfy&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%2230df9d482cda8b0a0cf9cc8bc293f2a1929aaa77%22%7D%2C%22id%22%3A%22QmXkQKduCgzkDHxE8RaneJyRb8NxXpyvFZpiqvK4w81KDz%22%2C%22org%22%3A%22SaladDay%22%2C%22prId%22%3A1%2C%22repo%22%3A%22pi-from-scratch%22%7D).  
  > Thanks for the fix. The change looks good. Please also update web/app/content.generated.ts so the tutorial site stays in sync. Then this should be ready to merge.
  > > Thanks for the fix. The change looks good. Please also update web/app/content.generated.ts so the tutorial site stays in sync. Then this should be ready to merge.  done

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

### Incident Patch 1: `599d0ba6` (2026-08-18)
**Commit Message**: fix(docs): correct compaction message count (#5)

Co-authored-by: zhuoyan <[REDACTED_EMAIL]>

**File**: `docs/ch02-loop.md` (modified, +2/-2)
```diff
@@ -474,13 +474,13 @@ messages[35]  user: "再加个 README"
 messages[54]  assistant: "README 写好了。"
 ```
 
-压缩后变成 36 条。前 35 条被一条摘要替换，最近 20 条原样保留：
+压缩后变成 21 条。前 35 条被一条摘要替换，最近 20 条原样保留：
 
 ```
 messages[0]   user: "[context summary]\n用户要求建一个项目，已完成目录结构、package.json、核心模块和测试..."
 messages[1]   user: "再加个 README"     ← 第 36 条，最近 20 条的起点
 ...
-messages[35]  assistant: "README 写好了。"
+messages[20]  assistant: "README 写好了。"
 ```
 
 模型下一轮看到的是摘要加上最近的对话，足以理解当前工作状态，而 context 的体积缩了一大截。
```

**File**: `web/app/content.generated.ts` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@
 export const lessonMarkdown = {
   "outline": "# PI from Scratch\n\n> 从零手撕一个 AI Coding Agent\n\n## 全书结构\n\n### 第一章：五个文件，各管各的\n\n**目标**：读完知道每个模块是干嘛的，脑子里有张地图。\n\n**内容**：\n1. 先看全貌：总共 5 个文件，~750 行，对标 pi 上万行\n2. 每个模块一段话讲清楚\"做什么\"和\"不做什么\"：\n   - `llm.ts`：跟 LLM API 说话的翻译官，进去是 Context，出来是 4 种事件流\n   - `agent.ts`：整个项目的灵魂，就一个 while 循环\n   - `tools.ts`：4 个纯函数，能读能写能改能跑命令\n   - `tui.ts`：最糙的终端界面，能打字能看输出能 Ctrl+C\n   - `cli.ts`：胶水层，把上面四个粘起来，顺便存个盘\n3. 跟 pi 的对应关系，砍了什么、为什么砍\n4. 一张架构图（文字版，不依赖 mermaid 渲染）\n\n**篇幅**：~1500 字\n\n\n### 第二章：从一个 while 循环开始\n\n**目标**：从数据流出发，一步步拼出完整代码。不是\"我给你看代码\"，是\"我们需要什么，就造什么\"。\n\n**行文线索**：\n\n1. **起点：agent 到底是什么？**\n   - 一句话定义：能调工具的 LLM，自己决定下一步做什么\n   - 那核心就是一个循环：问 LLM → LLM 说要调工具 → 调完把结果喂回去 → 再问\n   - 先写出最简版伪代码（10 行以内），把骨架亮出来\n\n2. **第一个问题：怎么跟 LLM 说话？**\n   - 引出 `llm.ts` 的 `stream()` 函数\n   - 先讲 Context 是什么（就是聊天记录，纯 JSON）\n   - 再讲 SSE 流式响应怎么解析成 4 种事件\n   - 对比 pi 的 pi-ai：我们只做单 provider，把\"脏活\"砍干净\n   - 讲 `contextToOpenAIMessages`：为什么要做格式转换（nanopi 内部格式 vs OpenAI 格式）\n\n3. **第二个问题：LLM 要调工具，工具哪来？**\n   - 引出 `tools.ts`\n   - 4 个工具的设计：为什么是这四个（读/写/改/跑，最小完备集）\n   - `edit` 为什么用字符串匹配而不是行号\n   - 输出截取：工具输出可能巨大，得截\n\n4. **把循环补完整：agent loop**\n   - 回到第 1 步的伪代码，把真实代码填进去\n   - `runAgent()` 逐段讲解：\n     - 流式收集 text 和 tool_calls\n     - 没有 tool_call？循环结束，模型说完了\n     - 有 tool_call？执行，结果塞回 context，继续循环\n   - 两个边界情况：\n     - `max_tokens` 截断：tool 参数可能是半截 JSON，别执行，告诉模型重发\n     - `aborted`：用户按了 Ctrl+C，丢掉 tool_calls，收工\n\n5. **context 会撑爆的：compaction**\n   - 聊久了消息越来越多，context 有上限\n   - 最简方案：消息超过 50 条，让 LLM 总结旧的，用摘要替换\n   - 对比 pi：原版 970 行做精确 token 估算，我们用消息条数近似\n\n6. **得有个界面吧：tui**\n   - 引出 `tui.ts`\n   - readline 读输入，process.stdout.write 流式输出\n   - Ctrl+C 的处理：busy 状态下才拦截，否则交给系统\n   - 对比 pi 的 pi-tui：differential renderer 是什么，为什么不碰\n   - **关键洞察：UI 只是 AgentEvent 的消费者**\n     - `runAgent()` 吐出的是一串结构化事件（assistant_text / tool_call / tool_result / turn_end）\n     - tui 只是用 `process.stdout.write` 消费它，但这不是唯一方式\n     - 这个结构跟前后端分离一模一样：agent 是后端 API，UI 是前端，中间靠事件协议通信\n   - **范例：换个\"前端\"**\n     - 写一个 20 行的 HTTP server，把 AgentEvent 用 SSE 推给浏览器\n     - 或者更简单：写个函数把 AgentEvent 攒成纯 JSON 返回，模拟 REST API\n     - 重点不是这个 demo 本身，而是让读者看到：agent 核心逻辑一行没动，只是换了个消费端\n     - 这也是 pi 的架构哲学：pi-agent-core 完全不知道 pi-tui 的存在\n\n7. **最后把它们粘起来：cli**\n   - 引出 `cli.ts` 的 `main()` 函数\n   - 事件转发：agent 的 AgentEvent → tui 的 print 方法，一个 switch 搞定\n   - session 持久化：每轮结束 append 到 JSONL，下次启动加载回来\n   - 整个数据流走一遍：用户输入 → context → LLM → tool → context → LLM → ... → 屏幕\n\n**篇幅**：~5000 字\n\n\n### 第三章：跑起来看看（可选）\n\n**目标**：实际跑一遍，看数据怎么流的。\n\n**内容**：\n1. 环境准备：npm install，设 API key\n2. 跑一个简单任务：\"把 hello.txt 改成大写\"\n3. 逐步看终端输出，对应到代码里的每个环节\n4. 看 session.jsonl 里存了什么\n\n**篇幅**：~1000 字\n\n\n## 写作约束\n\n- 中文为主，技术术语保留英文（Context、stream、tool_call 等）\n- 不用破折号（——），用逗号或句号断句\n- 禁止翻案腔：\"不是A而是B\"、\"不在于A在于B\"、\"与其说A不如说B\"、\"看似A实则B\"。判断从正面下，直接说结论\n- 避免 AI 味的总结句、过渡句和元叙述（\"让我们来看看\"、\"总结一下\"、\"接下来\"、\"用大白话说就是\"、\"简单来说\"、\"先把这件事说清楚\"之类，直接说事情本身，别加\"我要用什么方式跟你说\"或\"我要把什么搞清楚\"这种框）\n- 语气像在跟朋友讲，偶尔可以粗一点（\"这破玩意儿\"、\"别管那些花里胡哨的\"）\n- 代码块只放关键片段，不贴完整文件（完整代码让读者自己去看 src/）\n- 每引入一个新概念前，先用一句话说清楚\"为什么需要它\"\n- 不要反复说同一件事。一个信息在最合适的地方讲一次就够了。\"600 行\"、\"砍了什么\"这类标签说一次就行，翻来覆去讲读者会烦\n- 不要提前透露后面章节才展开的设计细节。第一章只说\"是什么\"，不展开\"怎么做的\"\n- 段落式写法为主，少用列表。要讲三件事就写三段话，别上来就 1. 2. 3.\n- 适当用图辅助理解（架构图、数据流图、时序图等），先用 `[图：xxx]` 占位描述，后续替换为正式图\n- 专业术语首次出现时用 `>` 引用块加注释，用一两句大白话解释清楚。比如 SSE、async generator、context window、JSON Schema 这类词，不能假设读者都知道\n",
   "chapter1": "\"What I cannot create, I do not understand.\" Richard Feynman 去世时，黑板上留着这句话。\n\n[pi](https://github.com/earendil-works/pi) 是一个上万行的生产级 AI coding agent。nanopi 是它的教学版，600 行代码。\n\n这篇文章的食用方式很简单。我们写的时候采用的方案是跟着数据流走、需要什么就写什么，每个模块的出现都是直觉的。右侧有一个编辑器，你读到哪一块，那一块的代码就会浮现出来。读完整篇文章，nanopi 的源码就全都完整了。\n\n> 如果你不想编辑器随着文章滚动动来动去，编辑器右上角有个锁，打开它。\n\n放轻松，这是一篇文章，不是一本书，而且是给初学者写的，你会很容易看懂。同时，我们有一个“语法扫盲块“，不用担心TS的语法看不懂。\n\n> BTW，现在是一篇文章，后续可能会变成很多篇。pi 里还有不少 nano-pi 没覆盖的东西值得单独写，比如精确的 token 估算和 compaction 切割策略、TypeScript 扩展系统（extensions / skills）、多 provider 适配和 model routing、session branching、以及 pi-tui 的 differential renderer【这些词是什么意思都不用管，只是预告一下】。方便的话，或许能给 [github仓库](https://github.com/SaladDay/pi-from-scratch) 点点star，这给我提供了继续更新下去的动力🤗。\n\n<!-- nudge-counter -->\n\n## 让我们开始吧。\n\nnanopi 整个项目就五个 TypeScript 文件。在开始跟着数据流造代码之前，先花两分钟记住这五个文件做什么、不做什么、对外暴露什么。\n\n## llm.ts\n\n跟具体的不同厂家的 LLM API 通信。输入 Context（聊天记录，纯 JSON），输出一串流式事件（StreamEvent）。四种事件：`text_delta`（模型吐了一段文字）、`tool_call`（模型想调工具）、`done`（这轮结束了）、`error`（炸了）。HTTP 怎么发、SSE 怎么解析、tool_call 的分片参数怎么拼，全是他的工作，上层不用管，只需要处理他输出的流式事件。\n\nContext 定义在这个文件里，因为 Context 本质上就是\"喂给 LLM 的东西\"，归 LLM 层管。pi 也是同样的做法。Context 的结构很简单，一个 `systemPrompt` 加一个 `messages` 数组，纯 JSON，可以直接 `JSON.stringify` 存到文件里，下次load回来就可以继续聊天了。\n\n对外暴露 `stream()` 函数，以及 Context、Message、StreamEvent 等类型定义。pi 里对应 `pi-ai` 包，pi-ai 要适配十几个 provider，nanopi 只支持 OpenAI 兼容格式。\n\n> 最草履虫的理解，上游有很多模型，有各种乱七八糟的细节，llm.ts（也就是pi中pi-ai包）负责接收context，转化成乱七八糟的格式转交给供应商的模型，然后将乱七八糟的格式整理好，对外持续输出流式的事件。\n\n\n## agent.ts\n\nagent 的循环，整个项目的核心。调 `llm.ts` 的 `stream()` 问模型，模型说要调工具就调，调完把结果塞回 Context 再问，持续这个过程，直到模型说“好了好了，我要结束了“。\n\n对外暴露 `runAgent()` 函数，往
```

---

### Incident Patch 2: `8bc31fa7` (2026-08-18)
**Commit Message**: fix(web): allow configured LAN dev origins (#3)

**File**: `web/README.md` (modified, +14/-0)
```diff
@@ -7,6 +7,20 @@ npm install
 npm run dev
 ```
 
+如果通过 `npm run dev` 输出的局域网 `Network` 地址访问开发站点，需要允许对应的 hostname，否则 Next.js 可能会阻止开发资源（包括 HMR），导致页面交互失效。例如：
+
+```bash
+NEXT_ALLOWED_DEV_ORIGINS=192.168.31.245 npm run dev
+```
+
+多个 hostname 可以用逗号分隔：
+
+```bash
+NEXT_ALLOWED_DEV_ORIGINS=192.168.31.245,my-dev-host.local npm run dev
+```
+
+修改配置后需要重启开发服务器。
+
 生产构建：
 
 ```bash
```

**File**: `web/next-config-utils.mjs` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+export function parseAllowedDevOrigins(value) {
+  return (
+    value
+      ?.split(",")
+      .map((origin) => origin.trim())
+      .filter(Boolean) ?? []
+  );
+}
```

**File**: `web/next.config.ts` (modified, +6/-0)
```diff
@@ -1,7 +1,13 @@
 import type { NextConfig } from "next";
+import { parseAllowedDevOrigins } from "./next-config-utils.mjs";
+
+const allowedDevOrigins = parseAllowedDevOrigins(
+  process.env.NEXT_ALLOWED_DEV_ORIGINS,
+);
 
 const nextConfig: NextConfig = {
   distDir: process.env.NEXT_DIST_DIR ?? ".next",
+  ...(allowedDevOrigins.length > 0 ? { allowedDevOrigins } : {}),
 };
 
 export default nextConfig;
```

**File**: `web/package.json` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@
     "prebuild": "npm run generate:content",
     "build": "next build --webpack",
     "start": "next start",
-    "test": "NEXT_DIST_DIR=.next-test npm run build && node --test tests/rendered-html.test.mjs",
+    "test": "NEXT_DIST_DIR=.next-test npm run build && node --test \"tests/*.test.mjs\"",
     "lint": "eslint . --ignore-pattern dist --ignore-pattern .next --ignore-pattern .next-test"
   },
   "dependencies": {
```

**File**: `web/tests/next-config.test.mjs` (added, +15/-0)
```diff
@@ -0,0 +1,15 @@
+import assert from "node:assert/strict";
+import test from "node:test";
+
+import { parseAllowedDevOrigins } from "../next-config-utils.mjs";
+
+test("parseAllowedDevOrigins returns no origins when unset", () => {
+  assert.deepEqual(parseAllowedDevOrigins(undefined), []);
+});
+
+test("parseAllowedDevOrigins parses comma-separated hostnames", () => {
+  assert.deepEqual(
+    parseAllowedDevOrigins("192.168.31.245, my-dev-host.local ,,"),
+    ["192.168.31.245", "my-dev-host.local"],
+  );
+});
```

---

### Incident Patch 3: `8c142b41` (2026-08-10)
**Commit Message**: docs: fix and resize the star history chart

**File**: `README.md` (modified, +5/-1)
```diff
@@ -50,7 +50,11 @@ cd web && npm test
 
 ## Star History
 
-[![Star History Chart](https://api.star-history.com/svg?repos=SaladDay/pi-from-scratch&type=Date)](https://www.star-history.com/#SaladDay/pi-from-scratch&Date)
+<p align="center">
+  <a href="https://www.star-history.com/#SaladDay/pi-from-scratch&amp;Date">
+    <img src="https://api.star-history.com/chart?repos=SaladDay%2Fpi-from-scratch&amp;type=date&amp;legend=top-left&amp;sealed_token=zEX_hDx767RuvD8h02AAC8PQvRcc5HyRIrKXaM5IoysJtPVPUhY8x-JjF6a1XFnUN1acFyB111JWBmLFh6yzfhmk6sbPo3EXlz2VPf6UXxM7iUtALO3wYvU3zj9u3Xmj8CleWffL6e7wzGJ7k7K2kOHcAzc8gOTwZqmrxObgmuKUJC2aEV1vygRPnnwP" width="560" alt="Star History Chart">
+  </a>
+</p>
 
 ## Thanks
 
```

---

### Incident Patch 4: `dcd41cfb` (2026-08-10)
**Commit Message**: docs: refine the agent loop walkthrough

**File**: `docs/ch02-loop.md` (modified, +10/-9)
```diff
@@ -22,7 +22,7 @@
 </div>
 </details>
 
-这副骨架暂时还不能运行，`Model`、`Context`、`AgentTool` 和 `AgentEvent` 也都还没定义。注释编号暂时不连续，空着的 0、3、6 是后面才会插入的压缩、截断和中断处理。现在只需要记住数据流的顺序，后面每一轮出现的代码都会落回这些位置。
+这副骨架暂时还不能运行，`Model`、`Context`、`AgentTool` 和 `AgentEvent` 也都还没定义。注释编号暂时不连续，空着的 0、3、6 是后面才会插入的小细节。现在只需要记住数据流的顺序，后面每一轮出现的代码都会回填这些位置。
 
 
 ## 怎么跟 LLM 说话
@@ -115,7 +115,7 @@ data: [DONE]
 
 <!-- checkpoint: llm-sse-parse -->
 
-### 先翻译一个 chunk
+### API响应后，先翻译一个 chunk
 
 一行 SSE 去掉 `data: ` 以后就是一个 JSON chunk。`handleSSELine()` 负责翻译这一行：有 `delta.content` 就取出文本，有 tool_call 分片就按 index 累积 name 和 arguments。
 
@@ -125,15 +125,15 @@ tool_call 的参数也是 JSON，但分片到达时不一定刚好是完整的
 
 <!-- checkpoint: llm-stream-read -->
 
-### 再把整条流读完
+### chunk 翻译完了，再把整条流读完
 
 现在把单行解析接回 `stream()`。`reader.read()` 不断拿网络数据，`TextDecoder` 把字节变成文字，`buf` 留住末尾还没凑成完整一行的部分。每找到一个换行，就取出一条 `data: ` 交给 `handleSSELine()`。
 
 文本片段立即 `yield text_delta`。流结束以后，再把缓存的 tool_calls 逐个发出，最后发一个 `done`。到这里，一条原始 SSE 响应就被翻译成了 `text_delta`、`tool_call`、`done` 或 `error`。
 
 <!-- checkpoint: llm-helpers -->
 
-nanopi 内部的消息格式跟 OpenAI API 要求的格式有差异。比如 tool_result 在 nanopi 里嵌在 user message 内部，OpenAI 要求拆成独立的 `role: "tool"` 消息。`contextToOpenAIMessages()` 在发请求前逐条转换：普通文本保留 user 或 assistant，tool_use 变成 `tool_calls`，tool_result 变成 `role: "tool"`。
+nanopi 内部的消息格式跟 OpenAI API 要求的格式有差异。比如 tool_result 在 nano-pi 里嵌在 user message 内部，OpenAI 要求拆成独立的 `role: "tool"` 消息。`contextToOpenAIMessages()` 在发请求前逐条转换：普通文本保留 user 或 assistant，tool_use 变成 `tool_calls`，tool_result 变成 `role: "tool"`。不过这都是一些小细节，我们为什么不保持和openai api格式一样呢？其实很好理解，因为我们要兼容很多provider，无论和谁的格式一样，最后都会和另一家有所差异，那不然就用我们最顺手的数据结构。
 
 <!-- checkpoint: llm-message-builders -->
 
@@ -142,8 +142,6 @@ API 回复也要装回 nanopi 自己的 Context。`buildAssistantMessage()` 把
 下一节写 agent loop 时会直接调用这两个函数。
 
 
-
-
 ## LLM 要调工具，工具哪来
 
 骨架里还有一个"执行工具"的位置。工具得有人定义。
@@ -249,7 +247,7 @@ async function* runAgent(model, context, tools, signal): AsyncGenerator<AgentEve
 
 等这轮 stream 结束，需要把模型的回复塞回 context。怎么塞？`llm.ts` 导出了 `buildAssistantMessage()`，把这一轮收集到的文本和 tool_calls 打包成一条 assistant message 就行。
 
-然后看 tool_calls 数组。空的，循环结束。不为空，挨个执行，每执行完一个就 yield 一个 `tool_result` 事件出去。工具名不存在，或者 execute 抛出异常，都转换成 `error: ...` 字符串，仍然作为一条工具结果放回到 Context。
+然后看 tool_calls 数组。空的，循环结束。不为空，挨个执行，每执行完一个就 yield 一个 `tool_result` 事件出去。工具名不存在，或者 execute 抛出异常，都转换成 `error: ...` 字符串，仍然作为一条工具结果放回到 Context【错误也是一种值得被LLM读的信息，也是重要的上下文】。
 
 全部执行完，结果也要塞回 context，用的是 `llm.ts` 的另一个辅助函数 `buildToolResultMessage()`，把结果打包成一条带 tool_result 的 user message。塞完，进入下一轮循环。API 偶尔会给出 `tool_use` stopReason 却没有任何 tool_call，这种畸形回复按普通的 `end_turn` 结束。
 
@@ -352,7 +350,10 @@ context 就是这么一条一条长起来的。每轮 stream 加一条 assistant
 
 数据闭环在 Context、stream、agent 和 tool。UI 挂在循环外面，换成终端、网页或者日志记录器，都不会改动 agent loop。
 
-图里画的是一轮顺利跑完的情况。真实 API 也会在半路停下来，agent 必须先判断手里的数据是否完整，再决定能不能继续执行工具。先看最常见的一种：回复撞上了长度上限。
+图里画的是一轮顺利跑完的情况。真实 API 也会在半路停下来，agent 必须先判断手里的数据是否完整，再决定能不能继续执行工具。
+
+
+先看最常见的一种：回复撞上了长度上限。
 
 
 <!-- checkpoint: agent-max-tokens -->
@@ -533,7 +534,7 @@ tui 最重要的特点是它完全不知道 LLM 和 tool 的存在。它只认
 
 ### 换个"前端"
 
-为了让这层解耦变得直观，我们写一个小实验。不动 agent 的任何代码，把 tui 换成一个 HTTP server，让浏览器来消费 AgentEvent。
+为了让这层解耦变得直观，我们可以写一个小实验。不动 agent 的任何代码，把 tui 换成一个 HTTP server，让浏览器来消费 AgentEvent。
 
 ```typescript
 import { createServer } from 'node:http'
```

---

### Incident Patch 5: `8995960b` (2026-08-09)
**Commit Message**: fix: align the course site with Vercel

**File**: `.gitignore` (modified, +1/-0)
```diff
@@ -6,3 +6,4 @@ dist/
 !.env.example
 *.log
 tmp.md
+.vercel
```

**File**: `.vercelignore` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+node_modules
+web/node_modules
+web/.next
+web/.next-test
+web/.vinext
+web/dist
+web/.wrangler
+web/coverage
+.DS_Store
+*.log
```

**File**: `README.md` (modified, +49/-26)
```diff
@@ -1,22 +1,48 @@
+<img src="web/app/icon.svg" width="48" alt="PI from Scratch 图标">
+
 # PI from Scratch
 
-从零手写一个能读文件、改代码、执行命令的 TypeScript coding agent。
+600 行 TypeScript 写成的超级迷你版 pi。顺着数据流往下走，你可以从 0 写出一个能读文件、改代码、执行命令的 pi-agent。
 
-项目沿着 [pi](https://github.com/earendil-works/pi) 的数据流拆解，需要什么、我们造什么，所有组件都是符合直觉的。
+它保留了 pi 最关键的东西：Context、流式 LLM、tool call、Agent Loop、session 和中断处理，只是把它们压缩到了五个文件里。配套网站把文章和代码编辑器放在一起；往下读，右边的代码会一点点长出来，整篇读完，nano-pi 也就写完了。
 
-删除 pi 的工程细节，留下 pi 的核心思想。
+[在线阅读](https://pi-from-scratch.vercel.app) · [直接看源码](src/) · [从模块地图开始](docs/ch01-modules.md)
 
-放轻松，这是一篇文章，不是一本书，你会很容易看懂。
+## 怎么读
 
-网站把文章和源码放在一起。阅读推进时，右侧编辑器会逐步补全代码，当你看完的时候，nano-pi 的代码也会全部呈现在编辑器中。
+| 章节 | 你会看到什么 |
+| --- | --- |
+| 模块地图 | 先认清 `llm`、`agent`、`tools`、`tui`、`cli` 各管什么 |
+| nano-pi | 沿着数据流，把五个文件一步步补完整 |
+| trace 跟踪 | 像在 VS Code 里调试一样，单步回放六种典型路径，随时看核心数据 |
 
-同时设计了一个 Trace 跟踪，可以打断点逐行过代码，希望能帮助大家理解代码执行流。
+正文也可以直接在仓库里读：
 
-[在线阅读 PI from Scratch](https://nanopi-from-scratch.garden-grove-1110.chatgpt.site)
+- [第一章：五个模块](docs/ch01-modules.md)
+- [第二章：nano-pi](docs/ch02-loop.md)
 
-> 文章保留古法手敲，尽可能没有ai味，希望大家读的开心。
+## 五个文件
 
-## 运行 nano-pi
+| 文件 | 管什么 |
+| --- | --- |
+| [`src/llm.ts`](src/llm.ts) | 请求 OpenAI 兼容 API，把 SSE 解析成统一事件流 |
+| [`src/agent.ts`](src/agent.ts) | 维护 Agent Loop、Context、工具执行和终止条件 |
+| [`src/tools.ts`](src/tools.ts) | 提供 `read_file`、`write_file`、`edit`、`run_bash` |
+| [`src/tui.ts`](src/tui.ts) | 读取输入、打印流式输出、处理 Ctrl+C |
+| [`src/cli.ts`](src/cli.ts) | 把前面四个模块接起来，再把 session 存下来 |
+
+项目结构也很简单：
+
+```text
+pi-from-scratch/
+├── src/       nano-pi 的完整源码
+├── docs/      两章教学文章
+├── scripts/   离线 trace 生成脚本
+├── test/      nano-pi 测试
+└── web/       交互式阅读网站
+```
+
+## 跑起来
 
 需要 Node.js 22 或更高版本，以及一个 OpenAI 兼容 API。
 
@@ -26,38 +52,35 @@ export NANOPI_API_KEY=your-api-key
 npm run dev
 ```
 
-可选环境变量：
-
-- `NANOPI_MODEL`：模型名
-- `NANOPI_BASE_URL`：OpenAI 兼容接口地址，默认 `https://api.openai.com/v1`
+默认模型是 `glm-5.2`。如果你用别的模型或接口，可以再设置：
 
-API Key 只从环境变量读取，不会写进源码或网站。线上 trace 是预先生成的静态数据，浏览网站不会发起模型请求。
+```bash
+export NANOPI_MODEL=your-model
+export NANOPI_BASE_URL=https://your-api.example/v1
+```
 
-## 五个文件
+API Key 只会从环境变量读取，不会写进源码。网站里的六组 trace 是提前生成的离线数据，打开网页不会偷偷请求模型。
 
-| 文件 | 职责 |
-| --- | --- |
-| `src/llm.ts` | 请求 OpenAI 兼容 API，把 SSE 转成统一事件流 |
-| `src/agent.ts` | 维护 Agent Loop、Context、工具执行与终止条件 |
-| `src/tools.ts` | `read_file`、`write_file`、`edit`、`run_bash` |
-| `src/tui.ts` | 读取输入、打印流式输出、处理 Ctrl+C |
-| `src/cli.ts` | 组装模块并持久化 session |
-
-## 本地运行教学网站
+## 在本地打开教学网站
 
 ```bash
 cd web
 npm install
 npm run dev
 ```
 
+然后打开 [http://localhost:3000](http://localhost:3000)。
+
 ## 测试
 
 ```bash
 npm test
 cd web && npm test
 ```
 
-## License
+这个项目从 [pi](https://github.com/earendil-works/pi) 出发。如果你已经用过 pi，可以把 nano-pi 当成一张摊开的结构图；如果还没用过，也没关系，从模块地图开始就行。
+
+## Thanks
 
-[MIT](LICENSE)
+- [LINUX DO](https://linux.do/) 社区
+- [pi-book](https://github.com/antinomie-lab/pi-book)
```

**File**: `docs/ch01-modules.md` (modified, +4/-6)
```diff
@@ -3,15 +3,13 @@
 
 [pi](https://github.com/earendil-works/pi) 是一个上万行的生产级 AI coding agent。nanopi 是它的教学版，600 行代码。
 
-Mario Zechner 造 pi 的时候说过一句话："your biggest enemy is still complexity. it's also your agent's biggest enemy." pi 的整个设计押在一个判断上：agent 需要的是四个工具（read, write, edit, bash）加一份不到 1000 token 的 system prompt，其他全部 opt-in。功能越多 agent 行为越不可预测，所以 pi 的策略是尽可能少加功能，提供原语，给模型足够的自主性。
-
-> **原语 \ 功能**：功能可以理解成"做汉堡"按钮，按一下汉堡就出来了，但你想换个酱料或者不要生菜就得去改这个按钮的内部逻辑。原语是烤肉饼、切面包、挤酱料这些最小操作，你自己决定怎么组合。pi 给你的是 read、write、edit、bash 这四个原语，想要什么工作流，自己用这几块拼。
-
 这篇文章的食用方式很简单。我们写的时候采用的方案是跟着数据流走、需要什么就写什么，每个模块的出现都是直觉的。右侧有一个编辑器，你读到哪一块，那一块的代码就会浮现出来。读完整篇文章，nanopi 的源码就全都完整了。
 
+> 如果你不想编辑器随着文章滚动动来动去，编辑器右上角有个锁，打开它。
+
 放轻松，这是一篇文章，不是一本书，而且是给初学者写的，你会很容易看懂。同时，我们有一个“语法扫盲块“，不用担心TS的语法看不懂。
 
-> 现在是一篇文章，后续可能会变成很多篇。pi 里还有不少 nanopi 没覆盖的东西值得单独写，比如精确的 token 估算和 compaction 切割策略、TypeScript 扩展系统（extensions / skills）、多 provider 适配和 model routing、session branching、以及 pi-tui 的 differential renderer。【这些词是什么意思你都不用管，只是预告一下】
+> BTW，现在是一篇文章，后续可能会变成很多篇。pi 里还有不少 nano-pi 没覆盖的东西值得单独写，比如精确的 token 估算和 compaction 切割策略、TypeScript 扩展系统（extensions / skills）、多 provider 适配和 model routing、session branching、以及 pi-tui 的 differential renderer。【这些词是什么意思你都不用管，只是预告一下】
 
 ## 让我们开始吧。
 
@@ -56,7 +54,7 @@ pi 里对应 `pi-agent-core`。
 
 对外暴露 `Tui` 类，提供 `onPrompt()`、`onAbort()`、`printText()`、`printToolCall()`、`printToolResult()` 等方法。
 
-下面这张图画的就是这个意思。agent 往外吐同一串 AgentEvent，左边接一个终端 tui 就是命令行工具，右边接一个 HTTP server 就变成 Web 应用，agent 本身的代码完全不用动。nanopi 自带的是左边那个 tui，但你随时可以换成别的。
+`runAgent()` 往外吐 AgentEvent。在nanopi 里由 CLI 接收这些事件，再给 Tui 、让他渲染出来；换成 Web 应用时，可以让 HTTP server 接收同一条事件流，再通过 SSE 发给浏览器、让浏览器渲染结果。nanopi 自带的是左边那个 tui，但你随时可以换成别的。
 
 ![同一个 AgentEvent 流可以被不同界面消费](/figures/event-consumers.png)
 
```

**File**: `docs/ch02-loop.md` (modified, +1/-1)
```diff
@@ -619,7 +619,7 @@ async function main() {
 每轮结束后调 `persistSession()`，把 context 里新增的消息 append 到 `~/.nanopi/session.jsonl`。下次启动时 `loadSession()` 把它们读回来，context 就恢复了。JSONL 格式是每行一个 JSON 对象，写起来简单（直接 appendFile），读起来也容错（某一行 JSON 坏了跳过，不影响其他行）。
 
 
-一个能读能写能改代码能跑命令的 coding agent，就做好了。
+一个能读能写能改代码能跑命令的 coding agent 就做好了。模块地图
 
 这时候你可以自己去跑跑看src下面的代码，我相信运行起来对你来说不是难事。
 
```

**File**: `package.json` (modified, +5/-2)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "pi-from-scratch",
   "version": "0.1.0",
-  "description": "Build a minimal coding agent from scratch in TypeScript.",
+  "description": "A 600-line TypeScript guide to building your own pi-agent from scratch.",
   "license": "MIT",
   "repository": {
     "type": "git",
@@ -13,7 +13,10 @@
     "agent-loop",
     "llm",
     "tool-calling",
-    "typescript"
+    "typescript",
+    "pi-agent",
+    "llm-agent",
+    "typescript-tutorial"
   ],
   "type": "module",
   "bin": { "pi-from-scratch": "./dist/cli.js" },
```

**File**: `web/.gitignore` (modified, +1/-0)
```diff
@@ -15,6 +15,7 @@
 
 # next.js
 /.next/
+/.next-test/
 /.vinext/
 /out/
 
```

**File**: `web/.openai/hosting.json` (removed, +0/-5)
```diff
@@ -1,5 +0,0 @@
-{
-  "project_id": "appgprj_6a7764c393448191b30bfb767da9fa6c",
-  "d1": null,
-  "r2": null
-}
```

#### Recent Merged Pull Requests:
- **PR #5** (2026-08-18): fix(docs): correct compaction message count (@JPlay)
- **PR #3** (2026-08-18): fix(web): 支持配置局域网开发来源 (@OliverBennettdev)
- **PR #1** (2026-08-12): 修复对话返回API 400报错问题 (@aaronshan)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
