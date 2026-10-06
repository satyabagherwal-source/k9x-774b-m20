# Forensic Learning Record (Deep Inspection): EKKOLearnAI/ekko-studio

> **Canonical Artifact**: `07_PROJECT_LEARNING/ekkolearnai-ekko-studio-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/EKKOLearnAI/ekko-studio](https://github.com/EKKOLearnAI/ekko-studio))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:53:43.543Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `EKKOLearnAI/ekko-studio`
- **Description**: Ekko Studio is a local-first AI workspace for multi-agent chat, coding, and visual workflows, available on desktop and the web.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 11301 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/client/src/api/studio/chat-webhooks.ts`
```
import { request } from '../client'

export type ChatWebhookEventType =
  | 'chat.message.created'
  | 'chat.run.queued'
  | 'chat.run.started'
  | 'chat.tool.started'
  | 'chat.tool.completed'
  | 'chat.tool.failed'
  | 'chat.approval.requested'
  | 'chat.approval.resolved'
  | 'chat.clarification.requested'
  | 'chat.clarification.resolved'
  | 'chat.run.completed'
  | 'chat.run.failed'
  | 'group.message.created'
  | 'group.run.failed'
  | 'group.approval.requested'
  | 'group.approval.resolved'
  | 'group.clarification.requested'
  | 'group.clarification.resolved'
  | 'workflow.run.completed'
  | 'workflow.run.failed'
  | 'chat.run.updated'
  | 'group.run.updated'
  | 'workflow.run.updated'
  | 'chat.plan.updated'
  | 'group.plan.updated'
  | 'workflow.plan.updated'

export type ChatWebhookRuntimeState =
  | 'idle'
  | 'delivering'
  | 'retrying'
  | 'success'
  | 'failed'
  | 'dropped'

export interface ChatWebhookRuntimeStatus {
  state: ChatWebhookRuntimeState
  queued: number
  active: number
  delivered: number
  failed: number
  dropped: number
  last_status: number | null
  last_error: string | null
  last_attempt_at: number | null
  last_success_at: number | null
}

export interface ChatWebhookEndpoint {
  id: string
  name: string
  url: string
  has_secret: boolean
  event_types: ChatWebhookEventType[]
  profiles: string[]
  enabled: boolean
  include_content: boolean
  include_user_content: boolean
  allow_private_network: boolean
  max_retries: number
  created_at: number
  updated_at: number
  runtime: ChatWebhookRuntimeStatus
}

export interface ChatWebhookEndpointInput {
  name: string
  url: string
  secret?: string
  event_types: ChatWebhookEventType[]
  profiles: string[]
  enabled: boolean
  include_content: boolean
  include_user_content: boolean
  allow_private_network: boolean
  max_retries: number
  clear_secret?: boolean
}

export interface ChatWebhookTestResult {
  ok: boolean
  status: number
  error?: string
}

export interface LocalChatWebhookTestTarget {
  url: string
  allow_private_network: true
}

export interface LocalChatWebhookTestEvent {
  received_at: string
  event: string
  event_id: string
  delivery_id: string
  timestamp: string
  payload: Record<string, unknown>
}

export async function fetchChatWebhookEndpoints(): Promise<ChatWebhookEndpoint[]> {
  const result = await request<{ endpoints: ChatWebhookEndpoint[] }>('/api/studio/webhooks/endpoints')
  return result.endpoints
}

export async function createChatWebhookEndpoint(
  input: ChatWebhookEndpointInput,
): Promise<ChatWebhookEndpoint> {
  const result = await request<{ endpoint: ChatWebhookEndpoint }>('/api/studio/webhooks/endpoints', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return result.endpoint
}

export async function updateChatWebhookEndpoint(
  id: string,
  input: Partial<ChatWebhookEndpointInput>,
): Promise<ChatWebhookEndpoint> {
  const result = await request<{ endpoint: ChatWebhookEndpoint }>(
    `/api/studio/webhooks/endpoints/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  )
  return result.endpoint
}

export async function deleteChatWebhookEndpoint(id: string): Promise<void> {
  await request(`/api/studio/webhooks/endpoints/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function testChatWebhookEndpoint(id: string): Promise<ChatWebhookTestResult> {
  return request<ChatWebhookTestResult>(
    `/api/studio/webhooks/endpoints/${encodeURIComponent(id)}/test`,
    { method: 'POST' },
  )
}

export async function fetchLocalChatWebhookTestTarget(): Promise<LocalChatWebhookTestTarget> {
  return request<LocalChatWebhookTestTarget>('/api/studio/webhooks/local-test-target')
}

export async function fetchLocalChatWebhookTestEvents(): Promise<LocalChatWebhookTestEvent[]> {
  const result = await request<{ events: LocalChatWebhookTestEvent[] }>(
    '/api/studio/webhooks/local-test-events',
  )
  return result.events
}

export async function clearLocalChatWebhookTestEvents(): Promise<void> {
  await request('/api/studio/webhooks/local-test-events', { method: 'DELETE' })
}

```

### Core Architecture Module: `packages/client/src/api/studio/pet-state.ts`
```
import { io, type Socket } from 'socket.io-client'
import { getActiveProfileName, getApiKey, getBaseUrlValue } from '@/api/client'

export interface PetActivity {
  busy?: boolean
  reasoning?: boolean
  toolRunning?: boolean
  awaitingInput?: boolean
  error?: boolean
  justCompleted?: boolean
  celebrate?: boolean
}

export type PetState = 'idle' | 'run' | 'review' | 'failed' | 'wave' | 'jump' | 'waiting'

export interface PetStateSnapshot {
  profile: string
  state: PetState
  activity: PetActivity
  updatedAt: number
  sessionId?: string
  runId?: string
  activeTools: string[]
  awaiting: Array<'approval' | 'clarify' | 'input'>
}

let socket: Socket | null = null
let socketProfile: string | null = null

function activeProfile(profile?: string | null): string {
  return profile || getActiveProfileName() || 'default'
}

export function connectPetStateSocket(profile?: string | null): Socket {
  const nextProfile = activeProfile(profile)
  if (socket && socketProfile === nextProfile) return socket
  if (socket) {
    socket.disconnect()
    socket = null
  }

  socketProfile = nextProfile
  socket = io(`${getBaseUrlValue()}/pet-state`, {
    auth: { token: getApiKey() },
    query: { profile: nextProfile },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
    randomizationFactor: 0.5,
    timeout: 30000,
  })
  return socket
}

export function disconnectPetStateSocket(): void {
  socket?.disconnect()
  socket = null
  socketProfile = null
}

export function onPetStateSnapshot(
  handler: (snapshot: PetStateSnapshot) => void,
  profile?: string | null,
): () => void {
  const activeSocket = connectPetStateSocket(profile)
  activeSocket.on('pet.state.snapshot', handler)
  activeSocket.on('pet.state.updated', handler)
  return () => {
    activeSocket.off('pet.state.snapshot', handler)
    activeSocket.off('pet.state.updated', handler)
  }
}

export function requestPetStateSnapshot(profile?: string | null): Promise<PetStateSnapshot> {
  const activeSocket = connectPetStateSocket(profile)
  return new Promise((resolve, reject) => {
    activeSocket.timeout(10000).emit('pet.state.get', (err: Error | null, snapshot: PetStateSnapshot) => {
      if (err) {
        reject(err)
        return
      }
      resolve(snapshot)
    })
  })
}

```

### Core Architecture Module: `packages/client/src/components/hermes/chat/mermaidRenderer.ts`
```
const MERMAID_LANGUAGE = 'mermaid'

export const MERMAID_MAX_DIAGRAMS_PER_MESSAGE = 4
export const MERMAID_MAX_SOURCE_LENGTH = 20_000
export const MERMAID_RENDER_TIMEOUT_MS = 5_000
export const SUPPORT_PREVIEW_FILE_TYPES = ['txt', 'md', 'json', 'csv', 'log', 'py', 'yaml', 'yml', 'toml', 'sh', 'xml', 'html', 'css', 'js', 'ts', 'rs', 'go', 'java', 'c', 'cpp', 'h']
      
function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function getFenceLanguage(info: string | undefined): string {
  return info?.trim().split(/\s+/)[0]?.toLowerCase() || ''
}

export function isMermaidFence(info: string | undefined): boolean {
  return getFenceLanguage(info) === MERMAID_LANGUAGE
}

export function encodeMermaidSource(source: string): string {
  return encodeURIComponent(source)
}

export function decodeMermaidSource(encoded: string | null | undefined): string {
  if (!encoded) return ''

  try {
    return decodeURIComponent(encoded)
  } catch {
    return ''
  }
}

export function renderMermaidPlaceholder(source: string): string {
  return [
    '<div class="mermaid-diagram" data-mermaid-pending="true"',
    ` data-mermaid-source="${escapeHtml(encodeMermaidSource(source))}">`,
    '<div class="mermaid-loading">Rendering Mermaid diagram…</div>',
    '</div>',
  ].join('')
}

```

### Core Architecture Module: `packages/client/src/components/hermes/files/xlsx-preview.worker.ts`
```
/// <reference lib="webworker" />
import readXlsxFile, { readSheetNames } from 'read-excel-file/web-worker'
import { limitTabularRows } from '@/utils/hermes/tabular-preview'
import { assertBoundedOoxmlArchive } from '@/utils/hermes/ooxml-archive'

let workbookBlob: Blob | null = null
let workbookSheetNames: string[] = []

self.onmessage = async (event: MessageEvent<{ type: 'open' | 'sheet'; data?: ArrayBuffer; sheet?: string }>) => {
  try {
    if (event.data.type === 'open') {
      if (!event.data.data) throw new Error('Workbook data is missing')
      assertBoundedOoxmlArchive(event.data.data)
      workbookBlob = new Blob([event.data.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      workbookSheetNames = await readSheetNames(workbookBlob)
      const visibleSheetNames = workbookSheetNames.slice(0, 50)
      if (!visibleSheetNames.length) throw new Error('Workbook does not contain worksheets')
      const rows = await readXlsxFile(workbookBlob, { sheet: visibleSheetNames[0] })
      self.postMessage({ type: 'loaded', sheetNames: visibleSheetNames, activeSheet: visibleSheetNames[0], ...limitTabularRows(rows) })
      return
    }
    if (!workbookBlob || !event.data.sheet || !workbookSheetNames.includes(event.data.sheet)) {
      throw new Error('Workbook is not loaded')
    }
    const rows = await readXlsxFile(workbookBlob, { sheet: event.data.sheet })
    self.postMessage({ type: 'sheet', activeSheet: event.data.sheet, ...limitTabularRows(rows) })
  } catch (error) {
    self.postMessage({ type: 'error', error: error instanceof Error ? error.message : String(error) })
  }
}

export {}

```

### Core Architecture Module: `packages/client/src/stores/hermes/pet-state.ts`
```
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  connectPetStateSocket,
  disconnectPetStateSocket,
  onPetStateSnapshot,
  requestPetStateSnapshot,
  type PetActivity,
  type PetState,
  type PetStateSnapshot,
} from '@/api/studio/pet-state'

function emptySnapshot(profile = 'default'): PetStateSnapshot {
  return {
    profile,
    state: 'idle',
    activity: {},
    updatedAt: Date.now(),
    activeTools: [],
    awaiting: [],
  }
}

export const usePetStateStore = defineStore('petState', () => {
  const snapshot = ref<PetStateSnapshot>(emptySnapshot())
  const connected = ref(false)
  const error = ref('')
  let unsubscribe: (() => void) | null = null

  const state = computed<PetState>(() => snapshot.value.state)
  const activity = computed<PetActivity>(() => snapshot.value.activity)

  async function connect(profile?: string | null): Promise<void> {
    disconnect()
    error.value = ''
    const socket = connectPetStateSocket(profile)
    socket.on('connect', () => {
      connected.value = true
      error.value = ''
    })
    socket.on('disconnect', () => {
      connected.value = false
    })
    socket.on('connect_error', (err: Error) => {
      connected.value = false
      error.value = err.message
    })
    unsubscribe = onPetStateSnapshot(next => {
      snapshot.value = next
    }, profile)
    try {
      snapshot.value = await requestPetStateSnapshot(profile)
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
    }
  }

  function disconnect(): void {
    unsubscribe?.()
    unsubscribe = null
    disconnectPetStateSocket()
    connected.value = false
  }

  return {
    activity,
    connect,
    connected,
    disconnect,
    error,
    snapshot,
    state,
  }
})

```

### Core Architecture Module: `packages/client/src/utils/agent-catalog.ts`
```
import catalog from '../../../../config/agents.json'
import type { CodingAgentId } from '@/api/coding-agents'

export const NATIVE_CODING_AGENT_IDS = ['qwen', 'kimi', 'codebuddy', 'qoder', 'copilot', 'zcode'] as const
export function isNativeCodingAgent(value: unknown): value is typeof NATIVE_CODING_AGENT_IDS[number] {
  return typeof value === 'string' && (NATIVE_CODING_AGENT_IDS as readonly string[]).includes(value)
}
export function agentMetadata(value: string) {
  return catalog.agents.find(agent => agent.id === value || agent.sessionId === value || agent.groupId === value)
}
export function isGlobalOnlyCodingAgent(value: unknown): boolean {
  const agent = agentMetadata(String(value || ''))
  return agent?.kind === 'coding-agent' && agent.modes.length === 1 && agent.modes[0] === 'global'
}
export function isCatalogCodingAgent(value: unknown): value is CodingAgentId {
  return agentMetadata(String(value || ''))?.kind === 'coding-agent'
}

```

### Core Architecture Module: `packages/client/src/utils/agent-options.ts`
```
// Keep every Agent picker in the same order as single chat.
export const AGENT_OPTIONS = [
  { label: 'Ekko', value: 'ekko-agent' },
  { label: 'Hermes', value: 'hermes' },
  { label: 'Claude', value: 'claude-code' },
  { label: 'Codex', value: 'codex' },
  { label: 'Pi', value: 'pi' },
  { label: 'Grok', value: 'grok' },
  { label: 'OpenCode', value: 'opencode' },
  { label: 'DeepSeek Harness', value: 'dsh' },
  { label: 'Cursor', value: 'cursor' },
  { label: 'Antigravity', value: 'antigravity' },
  { label: 'Qwen Code', value: 'qwen' },
  { label: 'Kimi Code', value: 'kimi' },
  { label: 'CodeBuddy', value: 'codebuddy' },
  { label: 'Qoder', value: 'qoder' },
  { label: 'GitHub Copilot', value: 'copilot' },
  { label: 'ZCode', value: 'zcode' },

] as const

export const GROUP_AGENT_OPTIONS = AGENT_OPTIONS.map(option => ({
  label: option.label,
  value: option.value === 'ekko-agent' ? 'ekko' as const
    : option.value === 'claude-code' ? 'claude' as const
      : option.value,
}))

```

### Core Architecture Module: `packages/client/src/utils/browser-annotation-submit.ts`
```
import type { Attachment } from '@/stores/hermes/chat'

export interface BrowserAnnotationSubmission {
  file: File
  context: string
}

export function createBrowserAnnotationAttachment(
  submission: BrowserAnnotationSubmission,
): Attachment {
  const file = submission.file
  return {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    name: file.name,
    type: file.type,
    size: file.size,
    url: URL.createObjectURL(file),
    file,
    ...(submission.context.trim() ? { context: submission.context.trim() } : {}),
  }
}

```

### Core Architecture Module: `packages/client/src/utils/chat-agent-avatar.ts`
```
export interface ChatAgentAvatar {
  label: 'Hermes' | 'Ekko' | 'Claude' | 'Codex' | 'Pi' | 'Grok' | 'OpenCode' | 'DeepSeek Harness' | 'Cursor' | 'Antigravity' | 'Qwen Code' | 'Kimi Code' | 'CodeBuddy' | 'Qoder' | 'GitHub Copilot' | 'ZCode'
  src: string
}

interface ChatAgentSessionIdentity {
  source?: string
  agent?: string
  codingAgentId?: string
}

const AGENT_AVATARS = {
  hermes: { label: 'Hermes', src: '/coding-agents/hermes.png' },
  'ekko-agent': { label: 'Ekko', src: '/coding-agents/ekko-agent.png' },
  'claude-code': { label: 'Claude', src: '/coding-agents/claude-code.svg' },
  codex: { label: 'Codex', src: '/coding-agents/codex-openai.png' },
  pi: { label: 'Pi', src: '/coding-agents/pi.svg' },
  grok: { label: 'Grok', src: '/coding-agents/grok.svg' },
  opencode: { label: 'OpenCode', src: '/coding-agents/opencode.png' },
  dsh: { label: 'DeepSeek Harness', src: '/coding-agents/deepseek.svg' },
  cursor: { label: 'Cursor', src: '/coding-agents/cursor-logo.png' },
  qwen: { label: 'Qwen Code', src: '/coding-agents/qwen-logo.svg' },
  kimi: { label: 'Kimi Code', src: '/coding-agents/kimi-logo.png' },
  codebuddy: { label: 'CodeBuddy', src: '/coding-agents/codebuddy-logo.svg' },
  qoder: { label: 'Qoder', src: '/coding-agents/qoder-logo.svg' },
  copilot: { label: 'GitHub Copilot', src: '/coding-agents/copilot-logo.svg' },
  zcode: { label: 'ZCode', src: '/coding-agents/zcode-logo.png' },
  antigravity: { label: 'Antigravity', src: '/coding-agents/antigravity.png' },
} as const satisfies Record<string, ChatAgentAvatar>

export function chatSessionAgentAvatar(session?: ChatAgentSessionIdentity | null): ChatAgentAvatar {
  if (!session) return AGENT_AVATARS['ekko-agent']
  const runtime = String(session?.codingAgentId || session?.agent || '').trim().toLowerCase()
  if (runtime === 'ekko-agent' || runtime === 'ekko_agent' || runtime === 'ekko') return AGENT_AVATARS['ekko-agent']
  if (runtime === 'claude' || runtime === 'claude-code') return AGENT_AVATARS['claude-code']
  if (runtime === 'codex') return AGENT_AVATARS.codex
  if (runtime === 'pi') return AGENT_AVATARS.pi
  if (runtime === 'grok') return AGENT_AVATARS.grok
  if (runtime === 'dsh') return AGENT_AVATARS.dsh
  if (runtime === 'opencode') return AGENT_AVATARS.opencode
  if (runtime === 'antigravity') return AGENT_AVATARS.antigravity
  if (runtime === 'qwen') return AGENT_AVATARS.qwen
  if (runtime === 'kimi') return AGENT_AVATARS.kimi
  if (runtime === 'codebuddy') return AGENT_AVATARS.codebuddy
  if (runtime === 'qoder') return AGENT_AVATARS.qoder
  if (runtime === 'copilot') return AGENT_AVATARS.copilot
  if (runtime === 'zcode') return AGENT_AVATARS.zcode
  if (runtime === 'cursor') return AGENT_AVATARS.cursor
  if (session?.source === 'coding_agent') return AGENT_AVATARS['claude-code']
  return AGENT_AVATARS.hermes
}

```

### Core Architecture Module: `packages/client/src/utils/chat-input-height.ts`
```
export const CHAT_INPUT_MOBILE_BREAKPOINT = 768
export const MIN_CHAT_INPUT_HEIGHT = 48
export const MAX_CHAT_INPUT_HEIGHT = 400

export function clampChatInputHeight(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null

  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return null

  return Math.min(MAX_CHAT_INPUT_HEIGHT, Math.max(MIN_CHAT_INPUT_HEIGHT, Math.round(numericValue)))
}

export function isMobileChatInputViewport(width: number): boolean {
  return width <= CHAT_INPUT_MOBILE_BREAKPOINT
}
```

### Core Architecture Module: `packages/client/src/utils/chat-timestamp.ts`
```
export function isSameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
}

export function formatChatTimestamp(
  timestamp: number | string | Date,
  options: { now?: Date; locale?: string | string[] } = {},
): string {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ''

  const now = options.now || new Date()
  const locale = options.locale
  const timeOptions: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' }

  if (isSameLocalDay(date, now)) {
    return date.toLocaleTimeString(locale, timeOptions)
  }

  const dateOptions: Intl.DateTimeFormatOptions = date.getFullYear() === now.getFullYear()
    ? { month: '2-digit', day: '2-digit', ...timeOptions }
    : { year: 'numeric', month: '2-digit', day: '2-digit', ...timeOptions }

  return date.toLocaleString(locale, dateOptions)
}

```

### Core Architecture Module: `packages/client/src/utils/client-random.ts`
```
export function generateClientUuid(): string {
    const webCrypto = globalThis.crypto
    if (typeof webCrypto?.randomUUID === 'function') {
        return webCrypto.randomUUID()
    }
    if (typeof webCrypto?.getRandomValues !== 'function') {
        throw new Error('Secure random number generation is unavailable')
    }

    const bytes = webCrypto.getRandomValues(new Uint8Array(16))
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3219** (2026-09-28): **Hermes不可用了，回退版本也不行了**
  *Symptoms*: ### Ekko Studio Version  7.24-7.25  ### Agent Runtime and Version (if applicable)  _No response_  ### Bug Description  Error: Hermes Runtime is unavailable: Runtime "/Users/jarhead/.hermes-web-ui/desktop-runtime/hermes/0.20.6/mac-arm64" failed: Python executable is missing: /Users/jarhead/.hermes-web-ui/desktop-runtime/hermes/0.20.6/mac-arm64/python/bin/python3; Hermes executable is missing: /Users/jarhead/.hermes-web-ui/desktop-runtime/hermes/0.20.6/mac-arm64/python/bin/hermes; Node executable is missing: /Users/jarhead/.hermes-web-ui/desktop-runtime/hermes/0.20.6/mac-arm64/node/bin/node No usable installed Runtime was found.  ### Steps to Reproduce  1  ### Expected Behavior  1  ### Actual Behavior  1  ### Logs / Error Messages  ```shell  ```  ### Environment  macOS  ### Node Version  _No response_  ### Additional Context  _No response_

- **Issue #3172** (2026-09-25): **[Bug]: 安卓 app 端，执行任务卡死**
  *Symptoms*: ### Ekko Studio Version  v1.0.4  ### Agent Runtime and Version (if applicable)  Hermes Agent v0.20  ### Bug Description  在APP端提交任务后，任务长时运行会导致整个app卡死，怀疑是下方的思考内容持续滚动导致的，当然也不一定是光有思考内容，甚至工具调用，它全部会在输入框上面一行的位置一直在滚动。  ### Steps to Reproduce  打开APP端新建会话，提交任意复杂任务。等候数分钟，APP端彻底卡死。**怀疑** 是思考内容或工具调用的内容一直在输入框上方一栏一直滚动导致。  ### Expected Behavior  任务正常运行，app内所有功能均可操作，正常输出结果  ### Actual Behavior  app未输出结果，并且直接卡死，只能 kill 掉，重新进入  ### Logs / Error Messages  ```shell  ```  ### Environment  WSL  ### Node Version  _No response_  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > > 

- **Issue #2943** (2026-09-08): **[Bug]: 0.7.18 最新版的mac app 不能配置频道了！！**
  *Symptoms*: ### Hermes Web UI Version  0.7.18  ### Hermes Agent Version  0.7.18  ### Bug Description  如题  ### Steps to Reproduce  升级最新版  ### Expected Behavior  升级最新版  ### Actual Behavior  升级最新版  ### Logs / Error Messages  ```shell  ```  ### Environment  macOS  ### Node Version  _No response_  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > agent管理 设置

- **Issue #2878** (2026-09-08): **[Bug]: OpenAI Codex provider missing for named profiles using inherited root OAuth credentials**
  *Symptoms*: ### Hermes Web UI Version  v0.7.15  ### Hermes Agent Version  v0.21.0  ### Bug Description  OpenAI Codex is missing from the model provider list in Hermes Web UI when using a named Hermes profile that inherits its OAuth credentials from the root Hermes auth store.  This appears to be a compatibility issue with a recent Hermes Agent authentication change. Hermes Agent now intentionally keeps single-use OAuth grants such as OpenAI Codex in the root auth store and allows named profiles to borrow/inherit those credentials instead of copying them into each profile's auth.json.  The named profile works correctly through Hermes CLI:  - Its configured provider is `openai-codex`. - Its model is configured correctly. - `hermes -p <profile> auth list openai-codex` finds the inherited OAuth credentials. - A real model request using `openai-codex` succeeds.  However, Hermes Web UI does not show the OpenAI Codex provider for that profile. The default/root profile displays it correctly.  It appears that Hermes Web UI determines provider availability only from the named profile's local auth.json and does not account for the root OAuth credential fallback implemented by Hermes Agent.   ### Steps to Reproduce  1. Authenticate OpenAI Codex in the root/default Hermes profile:     hermes auth add openai-codex  2. Create or use a named Hermes profile.  3. Configure the named profile through:     hermes -p <profile> setup model  4. Select OpenAI Codex and a supported Codex model.  5. Confirm that t

- **Issue #2826** (2026-09-01): **[Bug]: 普通管理员账号突然无法新建会话了，提示无资源访问权限，这个变故发生在reload skill之后**
  *Symptoms*: ### Hermes Web UI Version  0.7.1  ### Hermes Agent Version  0.20.6  ### Bug Description  普通管理员账号突然无法新建会话了，提示无资源访问权限  ### Steps to Reproduce    这个变故发生在reload skill之后。 发生情况是先新建了一个skill 然后通过/skill 技能名的方式使用提示/ not a supported bridge command: /技能名 执行reload skill后，突然就发现正聊着的普通管理员账号无法创建新会话了。 /reload skill这个操作在超级管理员下也执行了一次。 执行前普通管理员账号还在新建会话测试该技能有没有生效，提示错误才执行的重载技能  ### Expected Behavior   上面已说明  ### Actual Behavior    上面已说明  ### Logs / Error Messages  ```shell  ```  ### Environment  Docker  ### Node Version  _No response_  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > 更新到0.7.13版本问题解决了。不知道是什么原因造成的。之前重启docker也无法解决

- **Issue #2813** (2026-09-02): **[Bug]: 更新最新版以后，mac端打开桌面端会疯狂打开Hermes studio**
  *Symptoms*: ### Hermes Web UI Version  0.7.13  ### Hermes Agent Version  0.7.13  ### Bug Description  更新最新版以后，mac端打开桌面端会疯狂打开Hermes studio  ### Steps to Reproduce  更新最新版以后，mac端打开桌面端会疯狂打开Hermes studio  ### Expected Behavior  更新最新版以后，mac端打开桌面端会疯狂打开Hermes studio  ### Actual Behavior  更新最新版以后，mac端打开桌面端会疯狂打开Hermes studio  ### Logs / Error Messages  ```shell  ```  ### Environment  macOS  ### Node Version  _No response_  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > i meet it 
  > Same here. That thing acts like a rogue program—it forces itself to stay on top, and the issue still hasn't been resolved.
  > +1

- **Issue #2784** (2026-09-08): **[Bug]: Profile “Restart Configuration” always fails with Agent bridge request timed out after 5000ms**
  *Symptoms*: ### Hermes Web UI Version  0.6.47  ### Hermes Agent Version  0.20.6  ### Bug Description  Title: Profile “Restart Configuration” always fails with Agent bridge request timed out after 5000ms  Environment: - hermes-web-ui: v0.6.47 - Hermes Agent: v0.20.6 - Linux / systemd - Two profiles: default and newbaby - HERMES_WEB_UI_MANAGED_GATEWAY=0  Observed: Clicking “Restart Configuration” for either profile returns:  API Error 500: Agent bridge request timed out after 5000ms  The gateway itself remains running.  Root cause found in bundled server code:  var dA=()=>new Vt({connectRetryMs:0,timeoutMs:5e3})  Restart Configuration calls:  await dA().destroyProfile(profile)  The Python bridge does support destroy_profile. It synchronously: 1. Enumerates workers for the profile. 2. Calls worker.request({"action": "destroy_all"}). 3. Stops every worker. 4. Destroys sessions, interrupts active agents, and waits on session locks.  This cannot reliably complete within 5 seconds.  Expected: - Make this timeout configurable, preferably through an environment variable. - Or use HERMES_AGENT_BRIDGE_TIMEOUT_MS. - Or make destroy_profile cleanup asynchronous and return immediately.  ### Steps to Reproduce  1. Enumerates workers for the profile. 2. Calls worker.request({"action": "destroy_all"}). 3. Stops every worker. 4. Destroys sessions, interrupts active agents, and waits on session locks.   ### Expected Behavior  Expected: - Make this timeout configurable, preferably through an environment var

- **Issue #2653** (2026-08-21): **test: eliminate Node 24 Vitest IPC channel failures**
  *Symptoms*: ## Problem  A clean Node 24 coverage classification run for the immutable integration candidate terminated non-zero before Vitest emitted its normal coverage summary:  ```text ERR_IPC_CHANNEL_CLOSED: Channel closed ```  Observed stack ownership was Vitest/tinypool IPC. The run used an exact-HEAD `git archive`, a fresh `npm ci --include=dev`, no bind mount, no `HERMES_*`, and no Hermes runtime fallback. The same integration candidate does not change `package.json`, `package-lock.json`, `vitest.config.ts`, or `.github/workflows/build.yml` relative to its base.  This failure does **not** prove a product-code defect, but it makes the canonical `npm run test:coverage` gate non-authoritative because the run exits before a complete summary.  Related upstream report: vitest-dev/vitest#8201.  ## Scope  - Reproduce and classify the Node 24 Vitest/tinypool IPC shutdown failure on latest `main`. - Determine whether the underlying cause is a Vitest/tinypool regression, a child-worker/native crash, an unfinished async task, resource pressure, or another repository-specific test-harness defect. - Apply the smallest root-cause fix in test infrastructure/dependency/configuration. - Preserve the canonical command: `npm run test:coverage`.  ## Acceptance  1. A deterministic RED reproduction or bounded stress harness demonstrates the pre-fix failure mode, including the responsible worker/test when identifiable. 2. The fix prevents `ERR_IPC_CHANNEL_CLOSED` without swallowing unhandled rejections,

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

### Incident Patch 1: `c204d59b` (2026-10-05)
**Commit Message**: [codex] release 0.7.30 and fix Copilot custom tool requests (#3289)

* prepare 0.7.30 and retain three changelog versions

* fix Copilot custom tools through the Responses gateway

**File**: `docs/openapi.json` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@
   "info": {
     "title": "Ekko Studio API",
     "description": "Ekko Studio API — chat sessions, scheduled jobs, platform channels, model management, skills, memory, logs, file browser, group chat, and terminal.",
-    "version": "0.7.29"
+    "version": "0.7.30"
   },
   "servers": [
     {
```

**File**: `package-lock.json` (modified, +2/-2)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "ekko-studio",
-  "version": "0.7.29",
+  "version": "0.7.30",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "ekko-studio",
-      "version": "0.7.29",
+      "version": "0.7.30",
       "license": "BSL-1.1",
       "dependencies": {
         "@audio/decode-mp3": "^1.1.0",
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "ekko-studio",
-  "version": "0.7.29",
+  "version": "0.7.30",
   "description": "Ekko Studio is a local-first AI workspace for multi-agent chat, coding, and visual workflows, available on desktop and the web.",
   "repository": {
     "type": "git",
```

**File**: `packages/client/src/data/changelog.ts` (modified, +14/-249)
```diff
@@ -5,6 +5,20 @@ export interface ChangelogEntry {
 }
 
 export const changelog: ChangelogEntry[] = [
+  {
+    version: '0.7.30',
+    date: '2026-10-05',
+    changes: [
+      'changelog.new_0_7_30_1',
+      'changelog.new_0_7_30_2',
+      'changelog.new_0_7_30_3',
+      'changelog.new_0_7_30_4',
+      'changelog.new_0_7_30_5',
+      'changelog.new_0_7_30_6',
+      'changelog.new_0_7_30_7',
+      'changelog.new_0_7_30_8',
+    ],
+  },
   {
     version: '0.7.29',
     date: '2026-10-03',
@@ -25,253 +39,4 @@ export const changelog: ChangelogEntry[] = [
       'changelog.new_0_7_28_6',
     ],
   },
-  {
-    version: '0.7.27',
-    date: '2026-10-02',
-    changes: [
-      'changelog.new_0_7_27_1',
-      'changelog.new_0_7_27_2',
-      'changelog.new_0_7_27_3',
-      'changelog.new_0_7_27_4',
-      'changelog.new_0_7_27_5',
-      'changelog.new_0_7_27_6',
-      'changelog.new_0_7_27_7',
-      'changelog.new_0_7_27_8',
-    ],
-  },
-  {
-    version: '0.7.26',
-    date: '2026-09-30',
-    changes: [
-      'changelog.new_0_7_26_1',
-      'changelog.new_0_7_26_2',
-      'changelog.new_0_7_26_3',
-      'changelog.new_0_7_26_4',
-      'changelog.new_0_7_26_5',
-      'changelog.new_0_7_26_6',
-      'changelog.new_0_7_26_7',
-      'changelog.new_0_7_26_8',
-    ],
-  },
-  {
-    version: '0.7.25',
-    date: '2026-09-28',
-    changes: [
-      'changelog.new_0_7_25_1',
-      'changelog.new_0_7_25_2',
-      'changelog.new_0_7_25_3',
-      'changelog.new_0_7_25_4',
-      'changelog.new_0_7_25_5',
-      'changelog.new_0_7_25_6',
-      'changelog.new_0_7_25_7',
-      'changelog.new_0_7_25_8',
-      'changelog.new_0_7_25_9',
-      'changelog.new_0_7_25_10',
-    ],
-  },
-  {
-    version: '0.7.24',
-    date: '2026-09-22',
-    changes: [
-      'changelog.new_0_7_24_1',
-      'changelog.new_0_7_24_2',
-      'changelog.new_0_7_24_3',
-      'changelog.new_0_7_24_4',
-      'changelog.new_0_7_24_5',
-      'changelog.new_0_7_24_6',
-      'changelog.new_0_7_24_7',
-      'changelog.new_0_7_24_8',
-    ],
-  },
-  {
-    version: '0.7.23',
-    date: '2026-09-18',
-    changes: [
-      'changelog.new_0_7_23_1',
-      'changelog.new_0_7_23_2',
-      'changelog.new_0_7_23_3',
-      'changelog.new_0_7_23_4',
-      'changelog.new_0_7_23_5',
-      'changelog.new_0_7_23_6',
-      'changelog.new_0_7_23_7',
-      'changelog.new_0_7_23_8',
-    ],
-  },
-  {
-    version: '0.7.22',
-    date: '2026-09-16',
-    changes: [
-      'changelog.new_0_7_22_1',
-      'changelog.new_0_7_22_2',
-      'changelog.new_0_7_22_3',
-      'changelog.new_0_7_22_4',
-      'changelog.new_0_7_22_5',
-      'changelog.new_0_7_22_6',
-      'changelog.new_0_7_22_7',
-      'changelog.new_0_7_22_8',
-      'changelog.new_0_7_22_9',
-      'changelog.new_0_7_22_10',
-    ],
-  },
-  {
-    version: '0.7.21',
-    date: '2026-09-12',
-    changes: [
-      'changelog.new_0_7_21_1',
-      'changelog.new_0_7_21_2',
-    ],
-  },
-  {
-    version: '0.7.20',
-    date: '2026-09-12',
-    changes: [
-      'changelog.new_0_7_20_1',
-      'changelog.new_0_7_20_2',
-      'changelog.new_0_7_20_3',
-      'changelog.new_0_7_20_4',
-      'changelog.new_0_7_20_5',
-      'changelog.new_0_7_20_6',
-      'changelog.new_0_7_20_7',
-      'changelog.new_0_7_20_8',
-      'changelog.new_0_7_20_9',
-      'changelog.new_0_7_20_10',
-      'changelog.new_0_7_20_11',
-      'changelog.new_0_7_20_12',
-    ],
-  },
-  {
-    version: '0.7.19',
-    date: '2026-09-10',
-    changes: [
-      'changelog.new_0_7_19_1',
-      'changelog.new_0_7_19_2',
-      'changelog.new_0_7_19_3',
-      'changelog.new_0_7_19_4',
-      'changelog.new_0_7_19_5',
-      'changelog.new_0_7_19_6',
-      'changelog.new_0_7_19_7',
-      'changelog.new_0_7_19_8',
-      'changelog.new_0_7_19_9',
-      'changelog.new_0_7_19_10',
-      'changelog.new_0_7_19_11',
-      'changelog.new_0_7_19_12',
-      'changelog.new_0_7_19_13',
-      'changelog.new_0_7_19_14',
-      'changelog.new_0_7_19_15',
-      'changelog.new_0_7_19_16',
-    ],
-  },
-  {
-    version: '0.7.18',
-    date: '2026-09-06',
-    changes: [
-      'changelog.new_0_7_18_1',
-      'changelog.new_0_7_18_2',
-      'changelog.new_0_7_18_3',
-      'changelog.new_0_7_18_4',
-      'changelog.new_0_7_18_5',
-      'changelog.new_0_7_18_6',
-      'changelog.new_0_7_18_7',
-      'changelog.new_0_7_18_8',
-      'changelog.new_0_7_18_9',
-      'changelog.new_0_7_18_10',
-    ],
-  },
-  {
-    version: '0.7.17',
-    date: '2026-09-04',
-    changes: [
-      'changelog.new_0_7_17_1',
-      'changelog.new_0_7_17_2',
-      'changelog.new_0_7_17_3',
-      'changelog.new_0_7_17_4',
-      'changelog.new_0_7_17_5',
-      'changelog.new_0_7_17_6',
-      'changelog.new_0_7_17_7',
-    ],
-  },
-  {
-    version: '0.7.16',
-    date: '2026-09-02',
-    changes: [
-      'changelog.new_0_7_16_1',
-      'changelog.new_0_7_16_2',
-      'changelog.new_0_7_16_3',
-      'cha
```

**File**: `packages/client/src/i18n/locales/ar.ts` (modified, +8/-135)
```diff
@@ -3731,6 +3731,14 @@ export default {
 
   // Changelog
   changelog: {
+    new_0_7_30_1: 'أُضيف Qwen Code وKimi Code وCodeBuddy وQoder وGitHub Copilot وZCode للمحادثات والمحادثات الجماعية وسير العمل؛ يستخدم Qoder الوضع العام وتدعم الأدوات الخمس الأخرى أيضاً النماذج ذات الإعدادات المستقلة (#3280)',
+    new_0_7_30_2: 'تُصنّف محادثات Ekko ضمن Agent المدمج في السجل والبحث، مع دعم أوامر /context و/usage و/status و/compact (#3276)',
+    new_0_7_30_3: 'تختار المحادثات الجديدة Ekko افتراضياً وتعرض Agents المثبتة دون فحص CLI؛ لم يعد فتح محادثة لم تُرسل فيها رسائل ينتظر سجلاً غير موجود (#3284, #3288)',
+    new_0_7_30_4: 'حُسّن إدخال الصور إلى Coding Agents وفق قدراتها الأصلية، مع دعم المطالبات الطويلة ومتعددة الأسطر على Windows (#3285)',
+    new_0_7_30_5: 'حُسّنت فحوص متطلبات تشغيل Agents على Windows واكتشاف CLI لتطبيق ZCode المكتبي، مع إصلاح التشغيل من المسارات التي تحتوي على مسافات أو أحرف غير ASCII (#3281)',
+    new_0_7_30_6: 'أُصلح نقص معاملات أدوات Copilot أثناء البث عبر Responses API (#3286)',
+    new_0_7_30_7: 'أُصلح تنفيذ أدوات Claude دون تأكيد عند التشغيل بصلاحيات root، مع توحيد أذونات التشغيل في الوضعين العام والمستقل (#3287)',
+    new_0_7_30_8: 'أُزيل مزود OpenCode Free المتوقف ومداخل نماذجه (#3277)',
     new_0_7_29_1: 'استُعيد تنزيل الملفات من قوائم شجرة الملفات وأشرطة أدوات الفروق في مساحات عمل المحادثات والمحادثات الجماعية (#3268)',
     new_0_7_29_2: 'أُصلح ظهور Antigravity باسم Ekko بالخطأ في إشعارات النشاط المباشر (#3272)',
     new_0_7_28_1: 'أُضيف Antigravity CLI للمحادثات والمحادثات الجماعية وسير العمل في الوضعين العام والمعزول، مع الإعدادات الأصلية وMCP وإدارة المهارات (#3256)',
@@ -3739,140 +3747,5 @@ export default {
     new_0_7_28_4: 'أُصلح الإنهاء المبكر والنص المفقود والردود المكررة في Claude، مع حفظ الناتج النهائي بالكامل (#3260, #3263)',
     new_0_7_28_5: 'أُصلح الوصول إلى بيانات تسجيل الدخول الأصلية في الوضع العام لـ Antigravity على macOS وصُحّحت إرشادات تسجيل الدخول (#3266)',
     new_0_7_28_6: 'حُدّثت أيقونة اتصالات الأجهزة إلى شاشة وهاتف لتوضيح مدخل الاتصالات في التنقل (#3262)',
-    new_0_7_27_1: 'أُضيفت بطاقات استخدام محفوظة لكل جولة تعرض الرموز وإصابات التخزين المؤقت والتكاليف وسرعة الإخراج (#3241)',
-    new_0_7_27_2: 'أُصلح إسناد استخدام Coding Agents وتكاليف كل استدعاء والإجماليات التراكمية، مع حفظ استخدام المهام المتوقفة وتحديث الإحصاءات المتأخرة (#3246)',
-    new_0_7_27_3: 'أُضيفت بطاقات استخدام لكل جولة داخل فقاعات ردود المحادثات الجماعية، وتُستعاد عند تحميل السجل (#3248)',
-    new_0_7_27_4: 'أُضيف اختيار المزودين والنماذج المهيأة للأسعار المخصصة، مع إدخال المعرّفات يدويًا ورسائل أوضح لأخطاء التحميل (#3253)',
-    new_0_7_27_5: 'أُصلح استرداد جلسات Codex بعد تجاوز حد السياق؛ تستخدم الرسالة التالية سياقًا جديدًا مع الاحتفاظ بسجل Studio ومساحة العمل (#3204)',
-    new_0_7_27_6: 'أُصلح توافق أدوار رسائل Grok عند استخدام DeepSeek Chat Completions (#3244)',
-    new_0_7_27_7: 'أُصلح ظهور سجل المحادثة فارغًا عند تبديل Profile ضمن الاتصال نفسه (#3242)',
-    new_0_7_27_8: 'وُحّدت أحجام لوحات Studio وتخطيطات اختيار مساحة العمل، وأُصلحت طبقات إعدادات Agents في المجموعات وتحميلها، ومُنع تغيير اسم الجلسة بالخطأ عند الضغط على Enter (#3247)',
-    new_0_7_26_1: 'وُحّدت عناصر التنقل وعناوين الصفحات وإجراءات القوائم في Studio، مع تحسين تخطيط الأجهزة المحمولة (#3232)',
-    new_0_7_26_2: 'وُحّدت مؤشرات تحميل الصفحات وحُسّنت رؤية شعار التحميل، بما في ذلك وضع تقليل الحركة (#3232, #3236)',
-    new_0_7_26_3: 'حُسّنت الخلفيات المخصصة والطبقات الزجاجية، وأُصلحت حواف النوافذ وزواياها المستديرة، وأصبحت أزرار الميكروفون تتبع ألوان السمة (#3236)',
-    new_0_7_26_4: 'عُدّل موضع أزرار التحكم بالنوافذ ومظهرها حسب المنصة مع الحفاظ على زوايا Windows المستديرة الأصلية (#3234, #3235)',
-    new_0_7_26_5: 'أصبح التشغيل التلقائي لـ Gateway يتطلب تفعيلًا صريحًا، ولم يعد تحميل قائمة ملفات التعريف ينتظر فحوصات CLI، وأُصلح العرض الأولي لفقاعات الرسائل (#3233)',
-    new_0_7_26_6: 'أُضيف تسجيل تكاليف الاستخدام وأسعار مخصصة للنماذج، مع تقديرات من كتالوج النماذج المحلي وتحسين مطابقة حدود السياق (#3226)',
-    new_0_7_26_7: 'أُضيف التوافق مع إعدادات سجل DSH المسبقة وتهيئة الإضافات الأصلية، وأُصلحت صفحات الإضافات التي لم تكن تملأ المساحة المتاحة (#3218)',
-    new_0_7_26_8: 'أُصلحت رؤية شعار Cursor على البطاقات الفاتحة في مدير الوكلاء (#3222)',
-    new_0_7_25_1: 'أضيف دعم Cursor CLI للمحادثات والمجموعات وسير العمل، مع الإعدادات الأصلية وإدارة المهارات وإعدادات Studio MCP المعزولة (#3110)',
-    new_0_7_25_2: 'أضيفت وظائف JEV قابلة للضبط لاسترجاع الذاكرة وتصفية الصلة ومراجعة الكتابة ومطابقة المهارات والفحص المسبق للتعلم (#3159، #3161، #3169)',
-    new_0_7_25_3: 'أضيفت فحوص JEV اختيارية لمطابقة أهداف المتصفح والتحقق من الإجراءات ومراجعة ملخصات المجموعات وتوجيه الرسائل وجودة سير العمل (#3208، #3211)',
-    new_0_7_25_4: 'حُسنت أتمتة المتصفح بدفعات إجراءات متسلسلة ودعم ما يصل إلى 12 علامة تبويب والصفحات الكبيرة ونتائج أوضح للإجراءات (#3206، #3207، #3212، #3215)',
-    new_0_7_25_5: 'أضيف عرض تقدم تنزيل تحديثات سطح المكتب وبناء نسخ معزولة لاختبار التحديثات على macOS وWindows وLinux (#3176، #3177)',
-    n
```

**File**: `packages/client/src/i18n/locales/de.ts` (modified, +8/-135)
```diff
@@ -3332,6 +3332,14 @@ jobTriggered: 'Job ausgelost',
   },
 
   changelog: {
+    new_0_7_30_1: 'Qwen Code, Kimi Code, CodeBuddy, Qoder, GitHub Copilot und ZCode für Chats, Gruppenchats und Workflows ergänzt; Qoder nutzt den globalen Modus, die anderen fünf unterstützen auch separat konfigurierte Modelle (#3280)',
+    new_0_7_30_2: 'Ekko-Chats werden in Verlauf und Suche als integrierter Agent eingeordnet und unterstützen /context, /usage, /status und /compact (#3276)',
+    new_0_7_30_3: 'Neue Chats wählen standardmäßig Ekko und zeigen installierte Agents ohne CLI-Abfragen; beim erneuten Öffnen ungesendeter Chats wird nicht mehr auf einen nicht vorhandenen Verlauf gewartet (#3284, #3288)',
+    new_0_7_30_4: 'Bildeingaben für Coding Agents entsprechend ihren nativen Fähigkeiten verbessert und lange sowie mehrzeilige Prompts unter Windows unterstützt (#3285)',
+    new_0_7_30_5: 'Windows-Voraussetzungen für Agents und die Erkennung der ZCode-Desktop-CLI verbessert; zuverlässiger Start aus Pfaden mit Leerzeichen oder Nicht-ASCII-Zeichen (#3281)',
+    new_0_7_30_6: 'Unvollständige Copilot-Werkzeugargumente beim Streaming über die Responses API behoben (#3286)',
+    new_0_7_30_7: 'Claude-Werkzeugausführung ohne Bestätigung als root korrigiert und Startberechtigungen im globalen und isolierten Modus vereinheitlicht (#3287)',
+    new_0_7_30_8: 'Den eingestellten OpenCode-Free-Anbieter und seine Modelleinträge entfernt (#3277)',
     new_0_7_29_1: 'Dateidownloads über Dateibaum-Menüs und Diff-Werkzeugleisten in den Arbeitsbereichen von Chats und Gruppenchats wiederhergestellt (#3268)',
     new_0_7_29_2: 'Falsche Anzeige von Antigravity als Ekko in Live-Aktivitätsbenachrichtigungen behoben (#3272)',
     new_0_7_28_1: 'Antigravity CLI für Chats, Gruppenchats und Workflows im globalen und isolierten Modus ergänzt, mit nativen Einstellungen, MCP und Skill-Verwaltung (#3256)',
@@ -3340,140 +3348,5 @@ jobTriggered: 'Job ausgelost',
     new_0_7_28_4: 'Vorzeitigen Abschluss, fehlenden Text und doppelte Claude-Antworten behoben; die vollständige finale Ausgabe wird gespeichert (#3260, #3263)',
     new_0_7_28_5: 'Zugriff auf native Anmeldedaten für Antigravity im globalen Modus unter macOS wiederhergestellt und den Anmeldehinweis korrigiert (#3266)',
     new_0_7_28_6: 'Navigation zu Geräteverbindungen mit einem Monitor-und-Smartphone-Symbol zur klareren Kennzeichnung aktualisiert (#3262)',
-    new_0_7_27_1: 'Dauerhaft gespeicherte Nutzungskarten pro Gesprächsrunde mit Tokens, Cache-Treffern, Kosten und Ausgabegeschwindigkeit ergänzt (#3241)',
-    new_0_7_27_2: 'Zuordnung der Coding-Agent-Nutzung, Kosten pro Aufruf und Gesamtsummen korrigiert; Nutzung unterbrochener Läufe bleibt erhalten und verspätete Daten werden nachgetragen (#3246)',
-    new_0_7_27_3: 'Nutzungskarten pro Runde in den Antwortblasen von Gruppenchats ergänzt und beim Laden des Verlaufs wiederhergestellt (#3248)',
-    new_0_7_27_4: 'Auswahl konfigurierter Anbieter und Modelle für benutzerdefinierte Preise ergänzt, mit manueller ID-Eingabe und klareren Ladefehlern (#3253)',
-    new_0_7_27_5: 'Wiederherstellung nach Überschreiten des Codex-Kontextlimits korrigiert: Die nächste Nachricht nutzt einen neuen Kontext, während Studio-Verlauf und Arbeitsbereich erhalten bleiben (#3204)',
-    new_0_7_27_6: 'Kompatibilität der Grok-Nachrichtenrollen mit DeepSeek Chat Completions korrigiert (#3244)',
-    new_0_7_27_7: 'Leeren Gesprächsverlauf nach einem Profile-Wechsel innerhalb derselben Verbindung korrigiert (#3242)',
-    new_0_7_27_8: 'Studio-Seitenpanelgrößen und Arbeitsbereichsauswahl vereinheitlicht, Überlagerung und Laden der Gruppen-Agent-Einstellungen korrigiert sowie versehentliches Umbenennen mit Enter verhindert (#3247)',
-    new_0_7_26_1: 'Studio-Navigation, Seitenkopfzeilen und Listenaktionen vereinheitlicht sowie mobile Layouts verbessert (#3232)',
-    new_0_7_26_2: 'Ladeanzeigen der Seiten vereinheitlicht und die Sichtbarkeit des Ladelogos auch bei reduzierten Animationen verbessert (#3232, #3236)',
-    new_0_7_26_3: 'Benutzerdefinierte Hintergründe und Glasebenen verbessert, Fensterränder und abgerundete Ecken korrigiert sowie Mikrofontasten an die Theme-Farben angepasst (#3236)',
-    new_0_7_26_4: 'Position und Stil der Fenstersteuerung je nach Plattform angepasst und native abgerundete Windows-Fensterecken beibehalten (#3234, #3235)',
-    new_0_7_26_5: 'Gateway-Autostart erfordert jetzt eine ausdrückliche Aktivierung; Profillisten laden ohne CLI-Prüfungen, und die erste Darstellung von Nachrichtenblasen wurde korrigiert (#3233)',
-    new_0_7_26_6: 'Kostenerfassung und benutzerdefinierte Modellpreise ergänzt, mit Schätzungen aus dem lokalen Modellkatalog und verbessertem Abgleich der Kontextlimits (#3226)',
-    new_0_7_26_7: 'Kompatibilität mit DSH-Registry-Voreinstellungen und nativer Plugin-Konfiguration ergänzt; Plugin-Seiten nutzen nun den verfügbaren Platz vollständig (#3218)',
-    new_0_7_26_8: 'Sichtbarkeit des Cursor-
```

**File**: `packages/client/src/i18n/locales/en.ts` (modified, +8/-135)
```diff
@@ -3750,6 +3750,14 @@ export default {
 
   // Changelog
   changelog: {
+    new_0_7_30_1: 'Added Qwen Code, Kimi Code, CodeBuddy, Qoder, GitHub Copilot, and ZCode for chats, group chats, and workflows; Qoder uses global mode, while the other five also support scoped models (#3280)',
+    new_0_7_30_2: 'Ekko chats now appear under Built-in Agent in history and search, with /context, /usage, /status, and /compact commands (#3276)',
+    new_0_7_30_3: 'New chats default to Ekko and show installed Agents without CLI probes; reopening unsent chats no longer waits for nonexistent history (#3284, #3288)',
+    new_0_7_30_4: 'Improved Coding Agent image input according to native capabilities, with long and multiline prompt support on Windows (#3285)',
+    new_0_7_30_5: 'Improved Windows Agent prerequisite checks and ZCode desktop CLI detection, with reliable launches from paths containing spaces or non-ASCII characters (#3281)',
+    new_0_7_30_6: 'Fixed incomplete Copilot tool arguments when streaming through the Responses API (#3286)',
+    new_0_7_30_7: 'Fixed Claude tool execution without confirmation when running as root, with consistent launch permissions in global and scoped modes (#3287)',
+    new_0_7_30_8: 'Removed the retired OpenCode Free provider and its model entry points (#3277)',
     new_0_7_29_1: 'Restored file downloads from workspace tree menus and diff toolbars in chats and group chats (#3268)',
     new_0_7_29_2: 'Fixed Antigravity being mislabeled as Ekko in Live Activity notifications (#3272)',
     new_0_7_28_1: 'Added Antigravity CLI for chat, group chats, and workflows in global and scoped modes, with native settings, MCP, and skills management (#3256)',
@@ -3758,140 +3766,5 @@ export default {
     new_0_7_28_4: 'Fixed early completion, missing text, and duplicate Claude replies, preserving the complete final output (#3260, #3263)',
     new_0_7_28_5: 'Fixed native login credential access for Antigravity global mode on macOS and corrected the sign-in hint (#3266)',
     new_0_7_28_6: 'Updated Device Connections navigation to a monitor and phone icon for a clearer connection entry point (#3262)',
-    new_0_7_27_1: 'Added persisted per-turn usage cards showing tokens, cache hits, costs, and token speed (#3241)',
-    new_0_7_27_2: 'Fixed Coding Agent usage attribution, per-call costs, and cumulative totals; retained interrupted-run usage and updated late accounting (#3246)',
-    new_0_7_27_3: 'Added per-turn usage cards inside group chat reply bubbles, with usage restored when loading history (#3248)',
-    new_0_7_27_4: 'Added configured provider and model selection for custom pricing, with manual ID entry and clearer loading errors (#3253)',
-    new_0_7_27_5: 'Recovered Codex sessions after context overflow: the next message starts with fresh context while keeping Studio history and the workspace (#3204)',
-    new_0_7_27_6: 'Fixed Grok message role compatibility when using DeepSeek Chat Completions (#3244)',
-    new_0_7_27_7: 'Fixed blank conversation history when switching profiles on the same connection (#3242)',
-    new_0_7_27_8: 'Unified Studio drawer sizes and workspace picker layouts, fixed group Agent settings drawer layering and loading, and prevented accidental session renaming with Enter (#3247)',
-    new_0_7_26_1: 'Unified Studio navigation, page headers, and list actions, with improved mobile layouts (#3232)',
-    new_0_7_26_2: 'Unified page loading feedback and improved logo loading visibility, including reduced-motion mode (#3232, #3236)',
-    new_0_7_26_3: 'Improved custom backgrounds and glass layers, fixed window edges and rounded corners, and made microphone buttons follow theme colors (#3236)',
-    new_0_7_26_4: 'Adjusted desktop window control placement and styling by platform while preserving native Windows rounded corners (#3234, #3235)',
-    new_0_7_26_5: 'Made Gateway auto-start opt-in, removed CLI checks from Profile list loading, and fixed initial message bubble rendering (#3233)',
-    new_0_7_26_6: 'Added usage cost recording and custom model pricing, with estimates from the local model catalog and improved context-limit matching (#3226)',
-    new_0_7_26_7: 'Added compatibility with DSH registry presets and native plugin configuration, and fixed plugin pages not filling the available space (#3218)',
-    new_0_7_26_8: 'Fixed Cursor logo visibility on light Agent Manager cards (#3222)',
-    new_0_7_25_1: 'Added Cursor CLI support for chat, group chats, and workflows, with native settings, skills management, and isolated Studio MCP (#3110)',
-    new_0_7_25_2: 'Added configurable JEV memory recall, relevance filtering, write review, skill matching, and learning preflight (#3159, #3161, #3169)',
-    new_0_7_25_3: 'Added optional JEV browser target matching and action verification, group summary review and message routing, and workflow quality checks (#3208, #3211)',
-    new_0_7_25_4: 'Improved browser automation with sequential action batches, 
```

**File**: `packages/client/src/i18n/locales/es.ts` (modified, +8/-135)
```diff
@@ -3332,6 +3332,14 @@ jobTriggered: 'Job ejecutado',
   },
 
   changelog: {
+    new_0_7_30_1: 'Añadidos Qwen Code, Kimi Code, CodeBuddy, Qoder, GitHub Copilot y ZCode a chats, chats de grupo y flujos de trabajo; Qoder usa el modo global y los otros cinco también admiten modelos configurados por separado (#3280)',
+    new_0_7_30_2: 'Las conversaciones de Ekko se clasifican como Agent integrado en el historial y la búsqueda, con los comandos /context, /usage, /status y /compact (#3276)',
+    new_0_7_30_3: 'Los nuevos chats seleccionan Ekko por defecto y muestran los Agents instalados sin sondear sus CLI; reabrir chats sin mensajes enviados ya no espera un historial inexistente (#3284, #3288)',
+    new_0_7_30_4: 'Mejorada la entrada de imágenes de Coding Agents según sus capacidades nativas, con soporte para prompts largos y de varias líneas en Windows (#3285)',
+    new_0_7_30_5: 'Mejoradas las comprobaciones de requisitos de los Agents en Windows y la detección del CLI de ZCode Desktop, con inicio fiable desde rutas con espacios o caracteres no ASCII (#3281)',
+    new_0_7_30_6: 'Corregidos los argumentos incompletos de herramientas de Copilot al transmitir mediante la API Responses (#3286)',
+    new_0_7_30_7: 'Corregida la ejecución de herramientas de Claude sin confirmación como root, con permisos de inicio uniformes en los modos global y aislado (#3287)',
+    new_0_7_30_8: 'Eliminados el proveedor OpenCode Free retirado y sus entradas de modelos (#3277)',
     new_0_7_29_1: 'Restaurada la descarga de archivos desde los menús del árbol de archivos y las barras de diferencias en los espacios de trabajo de chats y chats de grupo (#3268)',
     new_0_7_29_2: 'Corregida la identificación errónea de Antigravity como Ekko en las notificaciones de actividad en directo (#3272)',
     new_0_7_28_1: 'Añadido Antigravity CLI para chats, chats de grupo y flujos de trabajo en modos global y aislado, con ajustes nativos, MCP y gestión de habilidades (#3256)',
@@ -3340,140 +3348,5 @@ jobTriggered: 'Job ejecutado',
     new_0_7_28_4: 'Corregidos la finalización anticipada, el texto faltante y las respuestas duplicadas de Claude, conservando la salida final completa (#3260, #3263)',
     new_0_7_28_5: 'Corregido el acceso a las credenciales nativas en el modo global de Antigravity en macOS y la indicación de inicio de sesión (#3266)',
     new_0_7_28_6: 'Actualizada la navegación de conexiones de dispositivos con un icono de monitor y teléfono para identificar mejor el acceso (#3262)',
-    new_0_7_27_1: 'Añadidas tarjetas persistentes por turno con tokens, aciertos de caché, costes y velocidad de salida (#3241)',
-    new_0_7_27_2: 'Corregidas la atribución del uso de Coding Agents, los costes por llamada y los totales acumulados; se conserva el uso de ejecuciones interrumpidas y se actualizan los datos tardíos (#3246)',
-    new_0_7_27_3: 'Añadidas tarjetas de uso por turno dentro de las respuestas del chat grupal, que se restauran al cargar el historial (#3248)',
-    new_0_7_27_4: 'Añadida la selección de proveedores y modelos configurados para precios personalizados, con entrada manual de ID y errores de carga más claros (#3253)',
-    new_0_7_27_5: 'Corregida la recuperación de Codex tras exceder el contexto: el siguiente mensaje continúa con un contexto nuevo y conserva el historial de Studio y el espacio de trabajo (#3204)',
-    new_0_7_27_6: 'Corregida la compatibilidad de los roles de los mensajes de Grok con DeepSeek Chat Completions (#3244)',
-    new_0_7_27_7: 'Corregido el historial de conversación vacío al cambiar de Profile en la misma conexión (#3242)',
-    new_0_7_27_8: 'Unificados los tamaños de los paneles de Studio y el diseño del selector de espacio de trabajo, corregidas la superposición y carga de los ajustes de Agents de grupo, y evitados los cambios de nombre accidentales con Intro (#3247)',
-    new_0_7_26_1: 'Unificadas la navegación, las cabeceras y las acciones de listas de Studio, con mejoras en los diseños para móviles (#3232)',
-    new_0_7_26_2: 'Unificados los indicadores de carga y mejorada la visibilidad del logotipo de carga, también en el modo de movimiento reducido (#3232, #3236)',
-    new_0_7_26_3: 'Mejorados los fondos personalizados y las capas translúcidas, corregidos los bordes y las esquinas redondeadas, y adaptados los botones de micrófono a los colores del tema (#3236)',
-    new_0_7_26_4: 'Ajustadas la posición y la apariencia de los controles de ventana según la plataforma, conservando las esquinas redondeadas nativas de Windows (#3234, #3235)',
-    new_0_7_26_5: 'El inicio automático de Gateway ahora requiere activación explícita; los perfiles se cargan sin esperar las comprobaciones de CLI y se corrige el renderizado inicial de las burbujas de mensajes (#3233)',
-    new_0_7_26_6: 'Añadidos el registro de costes y las tarifas personalizadas por modelo, con estimaciones del catálogo local y mejoras en la correspondencia de los límites de contexto (#3226)',
-   
```

---

### Incident Patch 2: `a8b15c6b` (2026-10-04)
**Commit Message**: fix(coding-agents): launch Claude with sandbox permission bypass (#3287)

Co-authored-by: Lux <[REDACTED_EMAIL]>

**File**: `packages/server/src/modules/coding-agents/services/index.ts` (modified, +4/-20)
```diff
@@ -68,13 +68,6 @@ const NODE_ENVIRONMENT_MISSING_CODE = 'node_environment_missing'
 const POSIX_LAUNCHER_FILE = 'launch.sh'
 const WINDOWS_LAUNCHER_FILE = 'launch.ps1'
 const CLAUDE_CODE_SKIP_PERMISSIONS_ARGS = ['--dangerously-skip-permissions']
-const CLAUDE_CODE_TASK_PLAN_TOOL = 'mcp__ekko-studio-interaction__ekko_studio_update_plan'
-const CLAUDE_CODE_ROOT_PERMISSION_ARGS = [
-  '--permission-mode',
-  'auto',
-  '--allowedTools',
-  CLAUDE_CODE_TASK_PLAN_TOOL,
-]
 const PI_MCP_ADAPTER_PACKAGE = 'pi-mcp-adapter'
 const OFFICIAL_NPM_REGISTRY = 'https://registry.npmjs.org'
 const PI_PROVIDER_ID = 'hermes-studio'
@@ -948,17 +941,6 @@ function buildCodexModelCatalog(input: {
   }
 }
 
-function hasRootPrivileges(): boolean {
-  if (process.platform === 'win32') return false
-  const uid = typeof process.getuid === 'function' ? process.getuid() : null
-  const euid = typeof process.geteuid === 'function' ? process.geteuid() : null
-  return uid === 0 || euid === 0
-}
-
-function claudeCodePermissionArgs(): string[] {
-  return hasRootPrivileges() ? CLAUDE_CODE_ROOT_PERMISSION_ARGS : CLAUDE_CODE_SKIP_PERMISSIONS_ARGS
-}
-
 function expandHomePath(path: string): string {
   if (path === '~') return getGlobalConfigHome()
   if (path.startsWith('~/')) return join(getGlobalConfigHome(), path.slice(2))
@@ -3054,7 +3036,8 @@ export async function prepareCodingAgentLaunch(id: string, input: CodingAgentLau
         { key: 'prompt', path: 'hermes-rules.md', absolutePath: promptFile },
         { key: 'mcp', path: 'mcp.json', absolutePath: mcpPath },
       ]
-      args = ['--append-system-prompt-file', promptFile, '--mcp-config', mcpPath, ...claudeCodePermissionArgs()]
+      env = { IS_SANDBOX: '1' }
+      args = ['--append-system-prompt-file', promptFile, '--mcp-config', mcpPath, ...CLAUDE_CODE_SKIP_PERMISSIONS_ARGS]
     } else if (tool.id === 'codex') {
       promptFile = await prepareGlobalCodexShadowHome(rootDir, systemPrompt, scope.profile, input.studioMcpTokenFile)
       files = [
@@ -3270,6 +3253,7 @@ export async function prepareCodingAgentLaunch(id: string, input: CodingAgentLau
       model,
       env: {
         ...inheritedEnv,
+        IS_SANDBOX: '1',
         ...(claudeApiKey ? { ANTHROPIC_API_KEY: claudeApiKey } : {}),
         ...(claudeBaseUrl ? { ANTHROPIC_BASE_URL: claudeBaseUrl } : {}),
         ANTHROPIC_MODEL: model,
@@ -3310,7 +3294,7 @@ export async function prepareCodingAgentLaunch(id: string, input: CodingAgentLau
       mcpPath,
       '--append-system-prompt-file',
       promptPath,
-      ...claudeCodePermissionArgs(),
+      ...CLAUDE_CODE_SKIP_PERMISSIONS_ARGS,
     ]
   } else if (tool.id === 'codex') {
     if (apiMode !== 'chat_completions' && apiMode !== 'codex_responses' && apiMode !== 'anthropic_messages') {
```

**File**: `tests/server/coding-agents-launch.test.ts` (modified, +23/-21)
```diff
@@ -1355,8 +1355,8 @@ describe('coding agent launch preparation', () => {
       workspaceDir,
       command: 'claude',
       args,
-      env: {},
-      shellCommand: shellCommandFor(workspaceDir, 'claude', args),
+      env: { IS_SANDBOX: '1' },
+      shellCommand: shellCommandFor(workspaceDir, 'claude', args, { IS_SANDBOX: '1' }),
       files: [{
         key: 'prompt',
         path: 'hermes-rules.md',
@@ -1370,8 +1370,8 @@ describe('coding agent launch preparation', () => {
     expect(existsSync(join(home, 'global-home', '.claude', 'hermes-rules.md'))).toBe(false)
   })
 
-  it('uses Claude Code auto permission mode instead of dangerous bypass when running as root', async () => {
-    mockProcessUid(0)
+  it.each([0, 1000])('uses sandbox permission bypass for global Claude Code with uid %s', async (uid) => {
+    mockProcessUid(uid)
     const home = makeHome()
 
     const result = await prepareCodingAgentLaunch('claude-code', {
@@ -1382,14 +1382,11 @@ describe('coding agent launch preparation', () => {
     const rootDir = join(home, 'coding-agent', 'model', 'default', 'global', 'claude-code')
     const workspaceDir = join(home, 'coding-agent', 'workspace', 'default', 'global')
     const promptPath = join(rootDir, 'hermes-rules.md')
-    const usesUnixRootPermissions = process.platform !== 'win32'
     const args = [
       '--append-system-prompt-file',
       promptPath,
       '--mcp-config', join(rootDir, 'mcp.json'),
-      ...(usesUnixRootPermissions
-        ? ['--permission-mode', 'auto', '--allowedTools', 'mcp__ekko-studio-interaction__ekko_studio_update_plan']
-        : ['--dangerously-skip-permissions']),
+      '--dangerously-skip-permissions',
     ]
 
     expect(result).toMatchObject({
@@ -1398,7 +1395,8 @@ describe('coding agent launch preparation', () => {
       rootDir,
       command: 'claude',
       args,
-      shellCommand: shellCommandFor(workspaceDir, 'claude', args),
+      env: { IS_SANDBOX: '1' },
+      shellCommand: shellCommandFor(workspaceDir, 'claude', args, { IS_SANDBOX: '1' }),
     })
   })
 
@@ -2237,9 +2235,14 @@ describe('coding agent launch preparation', () => {
     ))).toBe(false)
   })
 
-  it('uses Claude Code auto permission mode for scoped root launches', async () => {
-    mockProcessUid(0)
+  it.each([0, 1000])('uses sandbox permission bypass for scoped Claude Code with uid %s', async (uid) => {
+    mockProcessUid(uid)
     const home = makeHome()
+    vi.stubEnv('IS_SANDBOX', '0')
+    const globalSettingsPath = join(home, 'global-home', '.claude', 'settings.json')
+    mkdirSync(dirname(globalSettingsPath), { recursive: true })
+    const globalSettings = JSON.stringify({ env: { IS_SANDBOX: '0' } })
+    writeFileSync(globalSettingsPath, globalSettings)
 
     const result = await prepareCodingAgentLaunch('claude-code', {
       profile: 'default',
@@ -2250,9 +2253,7 @@ describe('coding agent launch preparation', () => {
       isolateSettings: true,
     })
 
-    const permissionArgs = process.platform === 'win32'
-      ? ['--dangerously-skip-permissions']
-      : ['--permission-mode', 'auto', '--allowedTools', 'mcp__ekko-studio-interaction__ekko_studio_update_plan']
+    const permissionArgs = ['--dangerously-skip-permissions']
     expect(result.args).toEqual([
       '--settings',
       join(result.rootDir, 'settings.json'),
@@ -2265,13 +2266,14 @@ describe('coding agent launch preparation', () => {
       ...permissionArgs,
     ])
     const launcher = readFileSync(launcherFile(result.rootDir), 'utf-8')
-    if (process.platform === 'win32') {
-      expectLauncherFragment(launcher, '--dangerously-skip-permissions')
-    } else {
-      expectLauncherFragment(launcher, '--permission-mode auto')
-      expectLauncherFragment(launcher, '--allowedTools mcp__ekko-studio-interaction__ekko_studio_update_plan')
-      expect(launcher).not.toContain('--dangerously-skip-permissions')
-    }
+    expectLauncherFragment(launcher, '--dangerously-skip-permissions')
+    expect(launcher).not.toContain('--permission-mode')
+    expect(launcher).not.toContain('--allowedTools')
+    expect(result.env.IS_SANDBOX).toBe('1')
+    const settings = JSON.parse(readFileSync(join(result.rootDir, 'settings.json'), 'utf-8'))
+    expect(settings.env.IS_SANDBOX).toBe('1')
+    expect(readFileSync(globalSettingsPath, 'utf-8')).toBe(globalSettings)
+    expect(launcher).toContain(process.platform === 'win32' ? "$env:IS_SANDBOX = '1'" : 'export IS_SANDBOX=1')
     expect(result.rootDir).toBe(join(home, 'coding-agent', 'model', 'default', 'openrouter', 'claude-code'))
   })
 
```

---

### Incident Patch 3: `521c36a3` (2026-10-04)
**Commit Message**: fix Copilot streamed tool arguments (#3286)

**File**: `packages/server/src/modules/coding-agents/protocol/adapters/responses.ts` (modified, +3/-1)
```diff
@@ -534,7 +534,9 @@ export function responseToolNamespaceForName(name: unknown): string | undefined
 
 export function normalizeResponseFunctionCall(name: unknown, argumentsValue: unknown): { name: string; arguments: string; namespace?: string } {
   const rawName = String(name || 'tool')
-  const rawArguments = String(argumentsValue || '{}')
+  // An empty string starts streamed arguments; adding {} would corrupt the
+  // JSON when the client appends subsequent argument deltas.
+  const rawArguments = String(argumentsValue ?? '{}')
   const namespace = normalizedNamespaceName(rawName)
   if (namespace.startsWith('mcp__')) {
     const parsed = safeJsonParse(rawArguments)
```

**File**: `tests/server/copilot-scoped-real.test.ts` (modified, +53/-15)
```diff
@@ -47,48 +47,73 @@ describeReal('real Copilot scoped ACP', () => {
     ['glm-5.3-flash', 'codex_responses'],
     ['glm-5.3-flash', 'anthropic_messages'],
     ['claude-sonnet-4-6', 'anthropic_messages'],
-  ] as const)('keeps %s on the selected %s upstream without token-count warnings', async (model, apiMode) => {
+  ] as const)('executes a command with %s on the selected %s upstream', async (model, apiMode) => {
     const requests: Array<{ path: string; body: any }> = []
+    const toolInput = { command: 'printf SCOPED_TOOL_OK', description: 'Print verification marker', initial_wait: 1 }
+    const toolArguments = JSON.stringify(toolInput)
+    let inferenceCount = 0
     const upstream = new Koa()
     upstream.use(createRequestBodyParser())
     upstream.use(ctx => {
       const body = ctx.request.body as any
       requests.push({ path: ctx.path, body })
+      if (ctx.path.endsWith('/count_tokens')) { ctx.body = { input_tokens: 10 }; return }
+      const callTool = inferenceCount++ === 0
       const response = { id: 'response-mock', object: 'response', status: 'completed', model: body.model,
-        output: [{ id: 'message-mock', type: 'message', role: 'assistant', status: 'completed',
-          content: [{ type: 'output_text', text: 'SCOPED_OK', annotations: [] }] }],
+        output: callTool ? [{ id: 'tool-mock', type: 'function_call', call_id: 'call-bash', name: 'bash',
+          arguments: toolArguments, status: 'completed' }] : [{ id: 'message-mock', type: 'message', role: 'assistant',
+          status: 'completed', content: [{ type: 'output_text', text: 'SCOPED_OK', annotations: [] }] }],
         usage: { input_tokens: 10, output_tokens: 3, total_tokens: 13 } }
       const chat = { id: 'chat-mock', object: 'chat.completion', model: body.model,
-        choices: [{ index: 0, message: { role: 'assistant', content: 'SCOPED_OK' }, finish_reason: 'stop' }],
+        choices: [{ index: 0, message: callTool ? { role: 'assistant', content: null,
+          tool_calls: [{ id: 'call-bash', type: 'function', function: { name: 'bash', arguments: toolArguments } }] }
+          : { role: 'assistant', content: 'SCOPED_OK' }, finish_reason: callTool ? 'tool_calls' : 'stop' }],
         usage: { prompt_tokens: 10, completion_tokens: 3, total_tokens: 13 } }
       const message = { id: 'message-mock', type: 'message', role: 'assistant', model: body.model,
-        content: [{ type: 'text', text: 'SCOPED_OK' }], stop_reason: 'end_turn', stop_sequence: null,
+        content: callTool ? [{ type: 'tool_use', id: 'call-bash', name: 'bash', input: toolInput }]
+          : [{ type: 'text', text: 'SCOPED_OK' }], stop_reason: callTool ? 'tool_use' : 'end_turn', stop_sequence: null,
         usage: { input_tokens: 10, output_tokens: 3 } }
-      if (ctx.path.endsWith('/count_tokens')) { ctx.body = { input_tokens: 10 }; return }
       if (!body.stream) {
         ctx.body = apiMode === 'chat_completions' ? chat : apiMode === 'codex_responses' ? response : message
         return
       }
       ctx.set('Content-Type', 'text/event-stream')
       if (apiMode === 'chat_completions') {
+        const deltas = callTool ? [
+          { tool_calls: [{ index: 0, id: 'call-bash', type: 'function', function: { name: 'bash', arguments: toolArguments.slice(0, 2) } }] },
+          { tool_calls: [{ index: 0, function: { arguments: toolArguments.slice(2) } }] },
+        ] : [{ role: 'assistant', content: 'SCOPED_OK' }]
         ctx.body = Readable.from([
+          ...deltas.map(delta =>
+            `data: ${JSON.stringify({ ...chat, object: 'chat.completion.chunk', choices: [{ index: 0,
+              delta, finish_reason: null }] })}\n\n`),
           `data: ${JSON.stringify({ ...chat, object: 'chat.completion.chunk', choices: [{ index: 0,
-            delta: { role: 'assistant', content: 'SCOPED_OK' }, finish_reason: null }] })}\n\n`,
-          `data: ${JSON.stringify({ ...chat, object: 'chat.completion.chunk', choices: [{ index: 0,
-            delta: {}, finish_reason: 'stop' }] })}\n\n`,
+            delta: {}, finish_reason: callTool ? 'tool_calls' : 'stop' }] })}\n\n`,
           'data: [DONE]\n\n',
         ])
       } else {
         const events = apiMode === 'codex_responses' ? [
           { type: 'response.created', response: { ...response, status: 'in_progress', output: [] } },
-          { type: 'response.output_text.delta', item_id: 'message-mock', output_index: 0, content_index: 0, delta: 'SCOPED_OK' },
+          ...(callTool ? [
+            { type: 'response.output_item.added', output_index: 0,
+              item: { ...response.output[0], arguments: '', status: 'in_progress' } },
+            { type: 'response.function_call_arguments.delta', item_id: 'tool-mock', output_index: 0, delta: toolArguments.slice(0, 2) },
+            { type: 'response.function_call_arguments.delta', item_id: 'tool-mock', output_index: 0, delta: toolArguments.slice(2) },
+            { type: 'response.output_item.done
```

**File**: `tests/server/native-scoped-proxy.test.ts` (modified, +61/-0)
```diff
@@ -94,6 +94,67 @@ describe('native scoped model gateway', () => {
     expect(codingAgentRunManager.handleResponseEvent).not.toHaveBeenCalled()
   })
 
+  it.each(['codebuddy', 'copilot'].flatMap(agentId =>
+    ['chat_completions', 'codex_responses', 'anthropic_messages'].map(apiMode => [agentId, apiMode] as const)))
+  ('preserves %s streamed tool JSON through the %s upstream', async (agentId, apiMode) => {
+    const target = registerCodexProxyTarget({ profile: 'research', provider: 'custom:test', model: 'selected-model',
+      baseUrl: 'https://provider.example/v1', apiKey: 'sk-upstream', apiMode: apiMode as any,
+      agentId, agentSessionId: `tools-${agentId}-${apiMode}` })
+    const calls = [
+      { id: 'call-bash', name: 'bash', arguments: JSON.stringify({ command: 'printf "厦门天气 ☀️"', description: 'Print weather' }) },
+      { id: 'call-mcp', name: 'ekko_studio_browser_toolset', arguments: JSON.stringify({ action: 'list' }) },
+      { id: 'call-empty', name: 'no_arguments', arguments: '{}' },
+    ]
+    const fragments = calls.map(call => [call.arguments.slice(0, 2), call.arguments.slice(2)])
+    let upstream: string
+    if (apiMode === 'chat_completions') {
+      const deltas = [
+        { tool_calls: calls.map((call, index) => ({ index, id: call.id, type: 'function',
+          function: { name: call.name, arguments: fragments[index][0] } })) },
+        { tool_calls: calls.map((_, index) => ({ index, function: { arguments: fragments[index][1] } })) },
+      ]
+      upstream = deltas.map(delta => `data: ${JSON.stringify({ choices: [{ index: 0, delta, finish_reason: null }] })}\n\n`).join('')
+        + `data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }] })}\n\n`
+        + 'data: [DONE]\n\n'
+    } else {
+      const events = apiMode === 'codex_responses' ? [
+        { type: 'response.created', response: { id: 'response-tools' } },
+        ...calls.map((call, output_index) => ({ type: 'response.output_item.added', output_index,
+          item: { type: 'function_call', id: call.id, call_id: call.id, name: call.name, arguments: '' } })),
+        ...[0, 1].flatMap(fragment => calls.map((call, output_index) => ({ type: 'response.function_call_arguments.delta',
+          item_id: call.id, output_index, delta: fragments[output_index][fragment] }))),
+        { type: 'response.completed', response: { id: 'response-tools', status: 'completed',
+          output: calls.map(call => ({ type: 'function_call', call_id: call.id, ...call })) } },
+      ] : [
+        { type: 'message_start', message: { id: 'message-tools', content: [] } },
+        ...calls.map((call, index) => ({ type: 'content_block_start', index,
+          content_block: { type: 'tool_use', id: call.id, name: call.name, input: {} } })),
+        ...[0, 1].flatMap(fragment => calls.map((_, index) => ({ type: 'content_block_delta', index,
+          delta: { type: 'input_json_delta', partial_json: fragments[index][fragment] } }))),
+        ...calls.map((_, index) => ({ type: 'content_block_stop', index })),
+        { type: 'message_delta', delta: { stop_reason: 'tool_use' } },
+        { type: 'message_stop' },
+      ]
+      upstream = events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join('')
+    }
+    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(upstream, { headers: { 'content-type': 'text/event-stream' } }))
+    const ctx = context(target, { stream: true, messages: [{ role: 'user', content: 'use tools' }] })
+    await codingAgentProxyChatCompletions(ctx)
+    const frames = (await read(ctx.body)).split('\n\n').filter(frame => frame.startsWith('data: {'))
+      .map(frame => JSON.parse(frame.slice(6)))
+    const accumulated = new Map<number, { id: string; name: string; arguments: string }>()
+    for (const frame of frames) for (const call of frame.choices?.[0]?.delta?.tool_calls || []) {
+      const current = accumulated.get(call.index) || { id: '', name: '', arguments: '' }
+      current.id += call.id || ''
+      current.name += call.function?.name || ''
+      current.arguments += call.function?.arguments || ''
+      accumulated.set(call.index, current)
+    }
+    expect([...accumulated.values()]).toEqual(calls)
+    for (const call of accumulated.values()) expect(() => JSON.parse(call.arguments)).not.toThrow()
+    expect(frames.at(-1).choices[0].finish_reason).toBe('tool_calls')
+  })
+
   it('preserves function selection and output limits and refuses truncated streams', async () => {
     expect(chatCompletionsToResponses({ messages: [], max_tokens: 32,
       tool_choice: { type: 'function', function: { name: 'read' } } })).toMatchObject({ max_output_tokens: 32, tool_choice: { type: 'function', name: 'read' } })
```

---

### Incident Patch 4: `637a6fbb` (2026-10-03)
**Commit Message**: feat(studio): classify Ekko direct chats as built-in (#3276)

**File**: `config/agents.json` (added, +304/-0)
```diff
@@ -0,0 +1,304 @@
+{
+  "schemaVersion": 1,
+  "revision": "2026-10-03.1",
+  "agents": [
+    {
+      "id": "hermes",
+      "name": "Hermes",
+      "kind": "hermes",
+      "aliases": [],
+      "sessionId": "hermes",
+      "groupId": "hermes",
+      "icon": "/static/hermes.png",
+      "modes": [
+        "scoped"
+      ],
+      "installation": {
+        "method": "builtin",
+        "updates": false,
+        "remove": false
+      },
+      "config": {
+        "skillsTarget": "hermes",
+        "skillsWritable": true,
+        "mcp": true,
+        "settings": "settings",
+        "memory": "memory"
+      },
+      "capabilities": {
+        "context": true,
+        "compact": true,
+        "serverManagedAuth": false
+      }
+    },
+    {
+      "id": "ekko-agent",
+      "name": "Ekko",
+      "kind": "built-in",
+      "aliases": [],
+      "sessionId": "ekko-agent",
+      "groupId": "ekko",
+      "icon": "/static/agents/ekko.png",
+      "modes": [
+        "scoped"
+      ],
+      "installation": {
+        "method": "builtin",
+        "updates": false,
+        "remove": false
+      },
+      "config": {
+        "skillsTarget": "ekko",
+        "skillsWritable": true,
+        "mcp": true,
+        "settings": "settings",
+        "memory": "memory"
+      },
+      "capabilities": {
+        "context": true,
+        "compact": true,
+        "serverManagedAuth": true
+      }
+    },
+    {
+      "id": "claude-code",
+      "name": "Claude",
+      "kind": "coding-agent",
+      "aliases": [],
+      "sessionId": "claude",
+      "groupId": "claude",
+      "icon": "/static/agents/claude.svg",
+      "modes": [
+        "scoped",
+        "global"
+      ],
+      "installation": {
+        "method": "npm",
+        "updates": true,
+        "remove": true
+      },
+      "config": {
+        "skillsTarget": "claude",
+        "skillsWritable": false,
+        "mcp": true,
+        "settings": "settings",
+        "memory": "memory"
+      },
+      "capabilities": {
+        "context": true,
+        "compact": true,
+        "serverManagedAuth": false
+      }
+    },
+    {
+      "id": "codex",
+      "name": "Codex",
+      "kind": "coding-agent",
+      "aliases": [],
+      "sessionId": "codex",
+      "groupId": "codex",
+      "icon": "/static/agents/codex.png",
+      "modes": [
+        "scoped",
+        "global"
+      ],
+      "installation": {
+        "method": "npm",
+        "updates": true,
+        "remove": true
+      },
+      "config": {
+        "skillsTarget": "codex",
+        "skillsWritable": false,
+        "mcp": true,
+        "settings": "config",
+        "memory": "agents"
+      },
+      "capabilities": {
+        "context": true,
+        "compact": true,
+        "serverManagedAuth": false
+      }
+    },
+    {
+      "id": "pi",
+      "name": "Pi",
+      "kind": "coding-agent",
+      "aliases": [],
+      "sessionId": "pi",
+      "groupId": "pi",
+      "icon": "/static/agents/pi.svg",
+      "modes": [
+        "scoped",
+        "global"
+      ],
+      "installation": {
+        "method": "npm",
+        "updates": true,
+        "remove": true
+      },
+      "config": {
+        "skillsTarget": "pi",
+        "skillsWritable": false,
+        "mcp": true,
+        "settings": "settings",
+        "memory": "agents"
+      },
+      "capabilities": {
+        "context": true,
+        "compact": true,
+        "serverManagedAuth": false
+      }
+    },
+    {
+      "id": "grok",
+      "name": "Grok",
+      "kind": "coding-agent",
+      "aliases": [],
+      "sessionId": "grok",
+      "groupId": "grok",
+      "icon": "/static/agents/grok.svg",
+      "modes": [
+        "scoped",
+        "global"
+      ],
+      "installation": {
+        "method": "npm",
+        "updates": true,
+        "remove": true
+      },
+      "config": {
+        "skillsTarget": "grok",
+        "skillsWritable": false,
+        "mcp": true,
+        "settings": "settings",
+        "memory": "agents"
+      },
+      "capabilities": {
+        "context": true,
+        "compact": true,
+        "serverManagedAuth": false
+      }
+    },
+    {
+      "id": "opencode",
+      "name": "OpenCode",
+      "kind": "coding-agent",
+      "aliases": [],
+      "sessionId": "opencode",
+      "groupId": "opencode",
+      "icon": "/static/agents/opencode.svg",
+      "modes": [
+        "scoped",
+        "global"
+      ],
+      "installation": {
+        "method": "npm",
+        "updates": true,
+        "remove": true
+      },
+      "config": {
+        "skillsTarget": "opencode",
+        "skillsWritable": false,
+        "mcp": true,
+        "settings": "settings",
+        "memory": "memory"
+      },
+      "capabilities": {
+        "context": true,
+        "compact": false,
+        "serverManagedAuth": false
+      }
+    },
+    {
+      "id": "dsh",
+      "name": "DeepSeek Harness",
+      "kind": "coding-agent",
+      "al
```

**File**: `docs/app-agent-catalog.md` (added, +56/-0)
```diff
@@ -0,0 +1,56 @@
+# App agent catalog
+
+`config/agents.json` is the canonical public catalog. The website build copies it
+to `https://ekkostudio.xyz/agents.json`; App loads that URL once on process launch.
+App first uses the last valid local cache, then the bundled fallback. A failed
+request, incompatible schema or invalid document leaves the current catalog intact.
+The catalog contains public metadata only, never credentials or executable commands.
+
+When adding a Studio runtime, add its metadata here and change `revision`. The
+website deployment workflow checks out this Studio repository and copies the
+catalog, so App does not need a new release for ordinary runtime additions.
+Publish the website/catalog after the Studio change is merged. Existing App
+installations receive it on their next launch. This implementation itself needs
+one App release, and does not install or implement the six proposed runtimes.
+
+## Schema version 1
+
+| Field | Meaning |
+| --- | --- |
+| `id` | Studio `/api/coding-agents/:id` runtime ID |
+| `name` | Public display name |
+| `kind` | `hermes`, `built-in`, or `coding-agent` |
+| `aliases` | Additional accepted historical IDs |
+| `sessionId` / `groupId` | IDs used in chat sessions and group agents |
+| `icon` | Existing App `/static/` asset, or an HTTPS image for a new agent |
+| `modes` | Explicit supported modes; first entry is the fallback mode |
+| `installation.method` | Installation/management mechanism: `builtin` means Studio owns the entry, `npm` installs a CLI package, and `manual` opens an installation guide. It does not define the Agent family. |
+| `installation.docsUrl` | HTTPS installation guide, required for manual installs |
+| `installation.updates` / `remove` | Enable Studio-managed update/removal controls |
+| `config.skillsTarget` | Skills API target; omit if unsupported |
+| `config.skillsWritable` | Enable skill editing/removal; content permissions still apply |
+| `config.mcp` | Enable MCP configuration entry |
+| `config.memory` / `settings` | Config-file API keys; omit unsupported files |
+| `capabilities.context` / `compact` | Enable the respective session commands |
+| `capabilities.serverManagedAuth` | Allow Studio-managed OAuth model providers in scoped mode |
+
+IDs and API keys are lowercase identifiers with hyphens, up to 64 characters.
+Every agent identity must be unambiguous. Required boolean capability fields must
+be present. New agent icons must use HTTPS because older Apps cannot contain new
+bundled assets. An unknown agent is displayed with its ID and a generic icon.
+Single chat, group chat and workflow availability also require the connected Studio to report
+the runtime as installed; adding metadata cannot create a runtime on an old Studio.
+
+For a local website build, the script detects the sibling Studio checkout.
+CI uses `AGENT_CATALOG_SOURCE` pointing to the checked-out Studio file. A standalone
+website checkout can build from its last copied public catalog. Production should
+serve `/agents.json` with `Content-Type: application/json`, a short cache lifetime
+or revalidation, and `Access-Control-Allow-Origin: *` for the H5 App. Native uni-app
+requests do not depend on browser CORS. Deployments must verify the served JSON,
+not an SPA fallback page.
+
+The website repository includes `website/nginx-agent-catalog.conf` as an exact
+location snippet for the existing server block. Apply it when enabling H5 access.
+The website deployment verifies that the published response matches the release
+file; a status-200 HTML fallback fails that check. App requests include a startup
+query value to bypass cached copies of an earlier website response.
```

**File**: `docs/ekko-session-commands.md` (added, +54/-0)
```diff
@@ -0,0 +1,54 @@
+# Ekko built-in session commands
+
+Ekko belongs to the `ekko` agent family and is published as `kind: built-in` in
+the agent catalog. It runs inside Studio and does not require an external CLI.
+Studio and App classify it by agent identity before inspecting legacy session
+source fields. Hermes keeps its existing command list; external CLI agents keep
+their own command restrictions. Command lists remain local to the clients.
+
+Group-chat and workflow task inputs bypass the single-chat command parser, even
+when they use the legacy coding-agent transport. Slash-prefixed task content is
+passed to the native Agent; the persisted session source also guards this boundary.
+
+| Command | Behavior |
+| --- | --- |
+| `/context` | Estimates the complete snapshot-aware conversation plus the cached Ekko system/tool context, using the configured model limit. |
+| `/usage` | Reads cumulative recorded Ekko usage, including cache tokens; missing usage is shown as unknown. |
+| `/status` | Reports the native Ekko runtime's working state and queued message count. |
+| `/compact` | Manually summarizes context with the shared Studio compressor and persists the same snapshot used by automatic compression. |
+
+`/compress` remains an alias for `/compact`. Compression requires an idle session.
+The session is reserved while compression runs; incoming messages queue and resume
+afterward. A summarizer failure leaves the previous snapshot intact, reports an
+error, releases the reservation and resumes queued work. Ekko compression never
+falls back to a Hermes process or an external Coding Agent run manager.
+
+Released clients and persisted sessions may still use `source: coding_agent`
+and `coding_agent_id: ekko-agent`. These are compatibility transport fields, not
+agent-family definitions. They continue to carry model/provider settings and
+scoped authentication. Restoring such sessions reads the `ekko_agent` usage ledger.
+Native direct chats now persist source: builtin_agent and agent: ekko-agent.
+At Studio startup, an idempotent migration updates old Ekko direct-chat source
+and agent fields only; messages, profile, pins, archive state and timestamps
+remain unchanged. Group-chat, workflow and global-agent sources are preserved.
+
+History and search display native Ekko sessions under **Built-in Agent**, deriving
+the family from the `ekko`, `ekko-agent` and `ekko_agent` identities. CLI, API and
+legacy coding-agent sources are supported; workflow/group/global surfaces retain
+their original buckets. Opening history/search preserves the native runtime IDs
+and scoped mode.
+
+Updated clients request `agent_groups=1` on `/api/studio/sessions/hermes/groups`
+and `/api/studio/sessions/hermes`. `builtin_agent` is the actual native direct-chat
+source; this opt-in also recognizes legacy rows before grouping and paging. Filtering happens before pagination, with separate
+native/external cursors; pinned and explicitly included sessions do not advance
+these cursors. Default history and search APIs also include physically stored builtin_agent rows.
+New clients send source: builtin_agent and agent_id: ekko-agent; old coding-agent
+requests continue to route to Ekko and are normalized before queueing and running.
+With an older Studio, updated clients derive labels and buckets locally; additional
+raw-source pages still load through the original source group until Studio is updated.
+
+The cached system/tool context is available after a run in the current Studio
+process. After a restart, `/context` remains an estimate of local assembled history
+until the next run refreshes that overhead. It does not present token accounting
+as an exact measurement of the provider's current context.
```

**File**: `docs/openapi.json` (modified, +48/-8)
```diff
@@ -13185,15 +13185,20 @@
                     "type": "string",
                     "enum": [
                       "cli",
+                      "builtin_agent",
                       "coding_agent",
-                      "global_agent"
+                      "global_agent",
+                      "workflow",
+                      "group_chat"
                     ],
-                    "description": "Run backend source. Use cli for Hermes bridge runs, coding_agent for Claude Code/Codex, or global_agent for global-agent sessions. Omit source for normal Hermes chat runs; do not use the legacy api_server source."
+                    "description": "Session source. Use cli for Hermes bridge runs, builtin_agent for native Ekko direct chats, coding_agent for external CLIs, or the matching group_chat/workflow/global_agent surface. Omit source for normal Hermes chat runs; do not use the legacy api_server source."
                   },
                   "session_source": {
                     "type": "string",
                     "enum": [
-                      "global_agent"
+                      "global_agent",
+                      "workflow",
+                      "group_chat"
                     ],
                     "description": "Marks a coding-agent or bridge session as launched from the global agent."
                   },
@@ -13220,7 +13225,7 @@
                       "opencode",
                       "ekko-agent"
                     ],
-                    "description": "Coding agent id when source is coding_agent."
+                    "description": "External coding-agent runtime id. ekko-agent is accepted for legacy clients; new native Ekko requests use agent_id."
                   },
                   "agent_id": {
                     "type": "string",
@@ -13232,7 +13237,7 @@
                       "opencode",
                       "ekko-agent"
                     ],
-                    "description": "Alias for coding_agent_id."
+                    "description": "Runtime id. Use ekko-agent for native Ekko with source=builtin_agent; external CLI ids remain accepted."
                   },
                   "mode": {
                     "type": "string",
@@ -19714,6 +19719,20 @@
           }
         },
         "parameters": [
+          {
+            "name": "agent_groups",
+            "in": "query",
+            "required": false,
+            "schema": {
+              "type": "string",
+              "enum": [
+                "0",
+                "1"
+              ],
+              "default": "0"
+            },
+            "description": "Set to 1 to include legacy native Ekko identities in the builtin_agent history group. Native direct chats are stored as builtin_agent."
+          },
           {
             "name": "limit",
             "in": "query",
@@ -19736,7 +19755,8 @@
             "required": false,
             "schema": {
               "type": "string"
-            }
+            },
+            "description": "History source to page. With agent_groups=1, builtin_agent selects native Ekko and coding_agent excludes it. Other sources retain their names."
           }
         ]
       }
@@ -19766,13 +19786,33 @@
           }
         },
         "parameters": [
+          {
+            "name": "agent_groups",
+            "in": "query",
+            "required": false,
+            "schema": {
+              "type": "string",
+              "enum": [
+                "0",
+                "1"
+              ],
+              "default": "0"
+            },
+            "description": "Set to 1 to include legacy native Ekko identities in the builtin_agent history group. Native direct chats are stored as builtin_agent."
+          },
           {
             "name": "include",
             "in": "query",
             "required": false,
             "schema": {
-              "type": "string"
-            }
+              "type": "array",
+              "items": {
+                "type": "string"
+              }
+            },
+            "style": "form",
+            "explode": true,
+            "description": "Repeat for each deep-linked session ID. Included and pinned sessions do not advance group pagination cursors."
           },
           {
             "name": "limit",
```

**File**: `packages/client/src/api/studio/chat.ts` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@ export interface StartRunRequest {
   provider?: string
   model_groups?: Array<{ provider: string; models: string[] }>
   queue_id?: string
-  source?: 'api_server' | 'cli' | 'coding_agent' | 'global_agent' | 'workflow' | 'group_chat'
+  source?: 'api_server' | 'cli' | 'coding_agent' | 'builtin_agent' | 'global_agent' | 'workflow' | 'group_chat'
   session_source?: 'global_agent' | 'workflow' | 'group_chat'
   coding_agent_id?: ChatCodingAgentId
   agent_preset?: string
```

**File**: `packages/client/src/api/studio/sessions.ts` (modified, +2/-1)
```diff
@@ -371,7 +371,7 @@ export async function fetchHermesSessionGroups(
   profile?: string | null,
   includedSessionIds: string[] = [],
 ): Promise<HermesSessionGroupsResult> {
-  const params = new URLSearchParams({ limit: String(limit) })
+  const params = new URLSearchParams({ limit: String(limit), agent_groups: '1' })
   if (profile) params.set('profile', profile)
   for (const sessionId of includedSessionIds) params.append('include', sessionId)
   return request<HermesSessionGroupsResult>(`/api/studio/sessions/hermes/groups?${params}`)
@@ -387,6 +387,7 @@ export async function fetchHermesSessionPage(
     source,
     offset: String(offset),
     limit: String(limit),
+    agent_groups: '1',
   })
   if (profile) params.set('profile', profile)
   return request<HermesSessionPage>(`/api/studio/sessions/hermes?${params}`)
```

**File**: `packages/client/src/components/hermes/chat/ChatInput.vue` (modified, +11/-22)
```diff
@@ -1,4 +1,6 @@
 <script setup lang="ts">
+import { isBuiltinEkkoSession, isExternalCodingAgentSession } from '@/utils/hermes/session-agent'
+import { EKKO_SESSION_COMMAND_DEFINITIONS } from '@/utils/hermes/bridge-session-commands'
 import type { Attachment } from '@/stores/hermes/chat'
 import { useChatStore } from '@/stores/hermes/chat'
 import { useAppStore } from '@/stores/hermes/app'
@@ -230,28 +232,13 @@ let bundlesLoadRequestKey = ''
 const isBridgeSession = computed(() => {
   const session = chatStore.activeSession
   if (!session) return chatStore.runtimeMode !== 'global_agent'
-  return session.source === 'cli'
-})
-const isCodingAgentSession = computed(() => {
-  const session = chatStore.activeSession
-  return !!session && (
-    session.source === 'coding_agent'
-    || !!session.codingAgentId
-    || session.agent === 'claude'
-    || session.agent === 'codex'
-    || session.agent === 'claude-code'
-    || session.agent === 'pi'
-    || session.agent === 'grok'
-    || session.agent === 'opencode'
-    || (session.agent === 'cursor' || session.agent === 'antigravity')
-  )
+  return session.source === 'cli' && !isBuiltinEkkoSession(session)
 })
+const isEkkoSession = computed(() => isBuiltinEkkoSession(chatStore.activeSession))
+const isCodingAgentSession = computed(() => isExternalCodingAgentSession(chatStore.activeSession))
 const isCursorSession = computed(() => (chatStore.activeSession?.codingAgentId === 'cursor' || chatStore.activeSession?.codingAgentId === 'antigravity') || (chatStore.activeSession?.agent === 'cursor' || chatStore.activeSession?.agent === 'antigravity'))
-const showSessionUsage = computed(() => {
-  const session = chatStore.activeSession
-  return isCodingAgentSession.value && session?.codingAgentId !== 'ekko-agent' && session?.agent !== 'ekko-agent'
-})
-const isForkCommandSession = computed(() => !!chatStore.activeSession && chatStore.activeSession.source !== 'coding_agent')
+const showSessionUsage = computed(() => isCodingAgentSession.value)
+const isForkCommandSession = computed(() => !!chatStore.activeSession && !isEkkoSession.value && !isCodingAgentSession.value)
 const skillPickerItems = computed(() => {
   const byName = new Map<string, SkillInfo>()
   for (const category of skillCategories.value) {
@@ -272,7 +259,9 @@ const skillPickerItems = computed(() => {
 })
 const filteredBridgeCommands = computed(() => {
   const query = slashQuery.value.trim().toLowerCase()
-  const commands = isBridgeSession.value
+  const commands = isEkkoSession.value
+    ? EKKO_SESSION_COMMAND_DEFINITIONS.map(command => ({ ...command, args: command.args || '', description: t(command.descriptionKey) }))
+    : isBridgeSession.value
     ? bridgeCommands.value
     : isCodingAgentSession.value
       ? bridgeCommands.value.filter(command => CODING_AGENT_SLASH_COMMANDS.includes(command.name)
@@ -586,7 +575,7 @@ function scrollCommandIntoView() {
 }
 
 function updateSlashState() {
-  if (!isBridgeSession.value && !isCodingAgentSession.value && !isForkCommandSession.value) {
+  if (!isEkkoSession.value && !isBridgeSession.value && !isCodingAgentSession.value && !isForkCommandSession.value) {
     slashActive.value = false
     return
   }
```

**File**: `packages/client/src/components/hermes/chat/ChatPanel.vue` (modified, +6/-5)
```diff
@@ -1326,7 +1326,7 @@ async function confirmNewChat() {
   }
 
   const group = selectedNewChatProviderGroup.value;
-  const source = newChatAgent.value === "hermes" ? "cli" : "coding_agent";
+  const source = newChatAgent.value === "hermes" ? "cli" : newChatAgent.value === "ekko-agent" ? "builtin_agent" : "coding_agent";
   const codingAgentMode = effectiveNewChatAgentMode.value;
   const isGlobalCodingAgent = source === "coding_agent" && codingAgentMode === "global";
   const agent = newChatAgent.value === "codex"
@@ -1351,12 +1351,12 @@ async function confirmNewChat() {
     source,
     agent,
     codingAgentId: newChatAgent.value === "hermes" ? undefined : newChatAgent.value,
-    codingAgentMode: source === "coding_agent" ? codingAgentMode : undefined,
+    codingAgentMode: source === "coding_agent" || source === "builtin_agent" ? codingAgentMode : undefined,
     agentPreset: newChatAgent.value === "dsh" ? newChatAgentPreset.value : undefined,
     workspace: newChatWorkspace.value || null,
     categoryId: newChatCategoryId.value,
-    baseUrl: source === "coding_agent" && !isGlobalCodingAgent ? group?.base_url || newChatBaseUrl.value.trim() || undefined : undefined,
-    apiKey: source === "coding_agent" && !isGlobalCodingAgent && !newChatUsesKeylessProvider.value ? group?.api_key || newChatApiKey.value.trim() || undefined : undefined,
+    baseUrl: (source === "coding_agent" || source === "builtin_agent") && !isGlobalCodingAgent ? group?.base_url || newChatBaseUrl.value.trim() || undefined : undefined,
+    apiKey: (source === "coding_agent" || source === "builtin_agent") && !isGlobalCodingAgent && !newChatUsesKeylessProvider.value ? group?.api_key || newChatApiKey.value.trim() || undefined : undefined,
     apiMode: isNewChatCodingAgent.value && !isGlobalCodingAgent ? newChatApiMode.value : undefined,
   });
   // Record workspace to recent list
@@ -1773,6 +1773,7 @@ async function handleDeleteCategoryConfirm() {
 
 const canSetContextSessionModel = computed(() =>
   contextSession.value?.source === "cli" ||
+  contextSession.value?.source === "builtin_agent" ||
   (contextSession.value?.source === "coding_agent" && contextSession.value?.codingAgentMode !== "global"),
 );
 
@@ -2084,7 +2085,7 @@ const sessionModelSession = computed(() =>
 );
 
 const isSessionModelScopedCodingAgent = computed(() =>
-  sessionModelSession.value?.source === "coding_agent" &&
+  (sessionModelSession.value?.source === "coding_agent" || sessionModelSession.value?.source === "builtin_agent") &&
   sessionModelSession.value?.codingAgentMode !== "global",
 );
 const sessionModelCodingAgentId = computed<ChatCodingAgentId | undefined>(() =>
```

---

### Incident Patch 5: `49909062` (2026-10-03)
**Commit Message**: fix: preserve Antigravity identity in Live Activity pushes (#3272)

**File**: `packages/server/src/modules/studio/services/notifications/live-activity.ts` (modified, +1/-1)
```diff
@@ -51,7 +51,7 @@ function agent(event: BusinessEvent): string {
   const raw = bounded(event.chat?.agent || (runKind(event) === 'chat' ? getSession(event.subject.session_id || '')?.agent : ''), 32).toLowerCase()
   const aliases: Record<string, string> = { 'claude-code': 'claude', 'ekko-agent': 'ekko', bridge: 'hermes', dsh: 'deepseek' }
   const normalized = aliases[raw] || raw
-  return ['claude', 'codex', 'hermes', 'ekko', 'pi', 'grok', 'opencode', 'deepseek', 'cursor'].includes(normalized) ? normalized : 'ekko'
+  return ['claude', 'codex', 'hermes', 'ekko', 'pi', 'grok', 'opencode', 'deepseek', 'cursor', 'antigravity'].includes(normalized) ? normalized : 'ekko'
 }
 function title(event: BusinessEvent): string {
   if (runKind(event) === 'chat') {
```

**File**: `tests/server/live-activity.test.ts` (modified, +11/-0)
```diff
@@ -57,6 +57,16 @@ describe('Studio Live Activity orchestration', () => {
 
  it('persists an encrypted destination and emits ordered start update end without exposing credentials',async()=>{const consume=await setup();await consume(event('chat.plan.updated'));await consume(event('chat.plan.updated',2,'completed'));await consume(event('chat.run.completed',3));expect(fetchMock).toHaveBeenCalledTimes(3);const bodies=fetchMock.mock.calls.map(([,r])=>JSON.parse(r.body));expect(bodies.map(b=>b.event)).toEqual(['start','update','end']);expect(bodies.map(b=>b.revision)).toEqual([1,2,3]);expect(bodies.every(b=>b.content_state.agent==='codex')).toBe(true);expect(bodies[0].ekko_run).toMatchObject({session_id:'session-a',studio_device_id:'studio-a',cloud_user_id:107});expect(JSON.stringify(bodies)).not.toContain('push_')})
  it('preserves Pi runtime identity instead of the default session agent',async()=>{const consume=await setup();const e=event('chat.plan.updated');e.chat.agent='pi';await consume(e);expect(JSON.parse(fetchMock.mock.calls[0][1].body).content_state.agent).toBe('pi')})
+ it('preserves Antigravity through start update and end with session fallback',async()=>{
+  vi.doMock('../../packages/server/src/modules/studio/repositories/session-store',()=>({getSession:()=>({title:'Build App',profile:'default',user_id:7,agent:'antigravity'}),getSessionNotificationPreview:()=>({})}))
+  const consume=await setup(),start=event('chat.plan.updated'),update=event('chat.plan.updated',2,'completed')
+  start.source='coding_agent';start.chat.agent='antigravity'
+  update.source='coding_agent';update.chat.agent='antigravity'
+  await consume(start);await consume(update);await consume(event('chat.run.completed',3))
+  const bodies=fetchMock.mock.calls.map(([,request])=>JSON.parse(request.body))
+  expect(bodies.map(body=>body.event)).toEqual(['start','update','end'])
+  expect(bodies.map(body=>body.content_state.agent)).toEqual(['antigravity','antigravity','antigravity'])
+ })
  it('reports rejected start without logging credentials or task text',async()=>{const log=vi.spyOn(console,'info').mockImplementation(()=>{});try{const consume=await setup();fetchMock.mockResolvedValueOnce({status:403,json:async()=>({error:'grant_revoked'}),body:null});await consume(event('chat.plan.updated'));expect(log).toHaveBeenCalledWith('[live-activity] delivery',expect.objectContaining({connection:1,action:'start',http:403,error:'grant_revoked'}));expect(JSON.stringify(log.mock.calls)).not.toContain('push_');expect(JSON.stringify(log.mock.calls)).not.toContain('Build App')}finally{log.mockRestore()}})
 
  it('uses the bounded notification title when the saved session title is absent',async()=>{
@@ -77,6 +87,7 @@ describe('Studio Live Activity orchestration', () => {
   ['coding_agent','pi','pi'],['coding_agent','grok','grok'],
   ['coding_agent','opencode','opencode'],['coding_agent','dsh','deepseek'],
   ['coding_agent','cursor','cursor'],
+  ['coding_agent','antigravity','antigravity'],['coding_agent',' Antigravity ','antigravity'],
   ['chat','bridge','hermes'],['chat','ekko-agent','ekko'],
  ])('preserves title and normalized agent for %s / %s',async(source,runtime,expected)=>{
   const consume=await setup(), e=event('chat.plan.updated')
```

---

### Incident Patch 6: `c1505041` (2026-10-02)
**Commit Message**: fix(files): restore workspace downloads in tree menu and diff toolbar (#3268)

Co-authored-by: Lux <[REDACTED_EMAIL]>

**File**: `packages/client/src/components/hermes/files/FileContextMenu.vue` (modified, +9/-5)
```diff
@@ -3,6 +3,8 @@ import { ref, nextTick } from 'vue'
 import { NDropdown, useMessage, useDialog } from 'naive-ui'
 import { useI18n } from 'vue-i18n'
 import { useFilesStore, isTextFile, isPreviewableFile } from '@/stores/hermes/files'
+import { downloadSessionWorkspaceFile } from '@/api/studio/sessions'
+import { downloadGroupWorkspaceFile } from '@/api/studio/group-chat'
 import { downloadFile } from '@/api/studio/download'
 import type { FileEntry } from '@/api/studio/files'
 import { copyToClipboard } from '@/utils/clipboard'
@@ -55,9 +57,7 @@ function getOptions() {
     if (isPreviewableFile(entry.name)) {
       options.push({ label: t('files.preview'), key: 'preview' })
     }
-    if (!filesStore.currentWorkspaceSessionId && !filesStore.currentWorkspaceRoomId) {
-      options.push({ label: t('files.download'), key: 'download' })
-    }
+    options.push({ label: t('files.download'), key: 'download' })
   }
   options.push({ type: 'divider', key: 'd1' })
   options.push({ label: t('files.copyPath'), key: 'copyPath' })
@@ -87,8 +87,12 @@ async function handleSelect(key: string) {
       try { await filesStore.openPreview(entry) } catch { message.error(t('files.backendError')) }
       break
     case 'download':
-      if (filesStore.currentWorkspaceSessionId || filesStore.currentWorkspaceRoomId) return
-      try { await downloadFile(entry.path, entry.name, filesStore.currentProfile) } catch (err: any) { message.error(err.message) }
+      if (entry.isDir) return
+      try {
+        if (filesStore.currentWorkspaceRoomId) await downloadGroupWorkspaceFile(filesStore.currentWorkspaceRoomId, entry.path, entry.name)
+        else if (filesStore.currentWorkspaceSessionId) await downloadSessionWorkspaceFile(filesStore.currentWorkspaceSessionId, entry.path, entry.name)
+        else await downloadFile(entry.path, entry.name, filesStore.currentProfile)
+      } catch (err: any) { message.error(err.message) }
       break
     case 'copyPath': {
       const ok = await copyToClipboard(getClipboardPathForEntry(entry))
```

**File**: `packages/client/src/components/hermes/files/WorkspaceFileDiff.vue` (modified, +22/-2)
```diff
@@ -4,8 +4,8 @@ import { computed, defineAsyncComponent, ref, watch } from 'vue'
 
 import { useI18n } from 'vue-i18n'
 import type { FileEntry, WorkspaceFileDiff } from '@/api/studio/files'
-import { fetchSessionWorkspaceFileDiff, readSessionWorkspaceFile } from '@/api/studio/sessions'
-import { fetchGroupWorkspaceFileDiff, readGroupWorkspaceFile } from '@/api/studio/group-chat'
+import { fetchSessionWorkspaceFileDiff, readSessionWorkspaceFile, downloadSessionWorkspaceFile } from '@/api/studio/sessions'
+import { fetchGroupWorkspaceFileDiff, readGroupWorkspaceFile, downloadGroupWorkspaceFile } from '@/api/studio/group-chat'
 import { getLanguageFromPath, isMarkdownFile, useFilesStore } from '@/stores/hermes/files'
 import { handleCodeBlockCopyClick, renderHighlightedCodeBlock } from '@/components/hermes/chat/highlight'
 import FileTreeToggle from './FileTreeToggle.vue'
@@ -31,6 +31,17 @@ const { t } = useI18n()
 const message = useMessage()
 const filesStore = useFilesStore()
 const loading = ref(false)
+const downloading = ref(false)
+async function downloadCurrentFile() {
+  if (downloading.value || props.entry.isDir) return
+  downloading.value = true
+  try {
+    if (props.workspaceRoomId) await downloadGroupWorkspaceFile(props.workspaceRoomId, props.entry.path, props.entry.name)
+    else if (props.workspaceSessionId) await downloadSessionWorkspaceFile(props.workspaceSessionId, props.entry.path, props.entry.name)
+    else throw new Error(t('files.backendError'))
+  } catch (error) { message.error(error instanceof Error ? error.message : t('download.downloadFailed')) }
+  finally { downloading.value = false }
+}
 const error = ref('')
 const diff = ref<WorkspaceFileDiff | null>(null)
 const fileContent = ref<string | null>(null)
@@ -133,6 +144,15 @@ watch(
         </span>
       </div>
       <div class="diff-actions">
+        <NTooltip trigger="hover">
+          <template #trigger>
+            <NButton class="diff-action-button" size="small" quaternary circle :loading="downloading"
+              :aria-label="t('files.download')" @click="downloadCurrentFile">
+              <template #icon><svg data-icon="download" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M5 17v4h14v-4" /></svg></template>
+            </NButton>
+          </template>
+          {{ t('files.download') }}
+        </NTooltip>
         <NTooltip trigger="hover">
           <template #trigger>
             <NButton
```

**File**: `tests/client/file-context-menu.test.ts` (modified, +16/-0)
```diff
@@ -13,6 +13,10 @@ const mockDialog = vi.hoisted(() => ({
   warning: vi.fn(),
 }))
 
+const downloadSessionMock = vi.hoisted(() => vi.fn())
+const downloadGroupMock = vi.hoisted(() => vi.fn())
+vi.mock('@/api/studio/sessions', () => ({ downloadSessionWorkspaceFile: downloadSessionMock }))
+vi.mock('@/api/studio/group-chat', () => ({ downloadGroupWorkspaceFile: downloadGroupMock }))
 const downloadFileMock = vi.hoisted(() => vi.fn())
 const copyToClipboardMock = vi.hoisted(() => vi.fn())
 
@@ -152,4 +156,16 @@ describe('FileContextMenu', () => {
 
     expect(workspaceWrapper.emitted('attach')).toEqual([[entry]])
   })
+  it.each(['session', 'group'] as const)('downloads %s workspace files with the authorized scoped API', async scope => {
+    const store = useFilesStore()
+    if (scope === 'group') store.currentWorkspaceRoomId = 'room-1'
+    else store.currentWorkspaceSessionId = 'session-1'
+    const wrapper = mount(FileContextMenu)
+    const entry = { name: 'page.html', path: 'tools/page.html', isDir: false, size: 10, modTime: '' }
+    await showMenu(wrapper, entry)
+    await wrapper.get('[data-key="download"]').trigger('click'); await flushPromises()
+    expect(scope === 'group' ? downloadGroupMock : downloadSessionMock).toHaveBeenCalledWith(scope === 'group' ? 'room-1' : 'session-1', entry.path, entry.name)
+    expect(downloadFileMock).not.toHaveBeenCalled()
+  })
+
 })
```

**File**: `tests/client/workspace-file-diff.test.ts` (modified, +9/-0)
```diff
@@ -6,6 +6,7 @@ import { defineComponent } from 'vue'
 
 const workspaceMocks = vi.hoisted(() => ({
   fetchSessionWorkspaceFileDiff: vi.fn(),
+  downloadSessionWorkspaceFile: vi.fn(),
   readSessionWorkspaceFile: vi.fn(),
 }))
 
@@ -29,6 +30,7 @@ vi.mock('@/api/studio/sessions', async importOriginal => {
   return {
     ...actual,
     fetchSessionWorkspaceFileDiff: workspaceMocks.fetchSessionWorkspaceFileDiff,
+    downloadSessionWorkspaceFile: workspaceMocks.downloadSessionWorkspaceFile,
     readSessionWorkspaceFile: workspaceMocks.readSessionWorkspaceFile,
   }
 })
@@ -100,4 +102,11 @@ describe('WorkspaceFileDiff', () => {
     expect(editButton.find('svg[data-icon="edit"]').exists()).toBe(true)
     expect(closeButton.find('svg[data-icon="close"]').exists()).toBe(true)
   })
+  it('offers a scoped download in the HTML Diff toolbar', async () => {
+    const wrapper = mount(WorkspaceFileDiff, { props: { entry: { ...markdownEntry, name: 'page.html', path: 'page.html' }, workspaceSessionId: 'session-1' } })
+    await flushPromises()
+    await wrapper.get('button[aria-label="files.download"]').trigger('click'); await flushPromises()
+    expect(workspaceMocks.downloadSessionWorkspaceFile).toHaveBeenCalledWith('session-1', 'page.html', 'page.html')
+  })
+
 })
```

**File**: `tests/e2e/workspace-file-download.spec.ts` (added, +113/-0)
```diff
@@ -0,0 +1,113 @@
+import { expect, test, type Page } from '@playwright/test'
+import { authenticate, mockChatSocket, mockHermesApi, TEST_ACCESS_KEY } from './fixtures'
+
+const sessionId = 'session-file-tree-collapse'
+const sessionWorkspace = '/tmp/file-tree-collapse'
+
+const session = {
+  id: sessionId,
+  profile: 'research',
+  source: 'webui',
+  model: 'test-model',
+  provider: 'test-provider',
+  title: 'File tree collapse',
+  preview: 'File tree collapse',
+  started_at: 1_790_000_000,
+  ended_at: null,
+  last_active: 1_790_000_100,
+  message_count: 0,
+  tool_call_count: 0,
+  input_tokens: 0,
+  output_tokens: 0,
+  cache_read_tokens: 0,
+  cache_write_tokens: 0,
+  reasoning_tokens: 0,
+  billing_provider: null,
+  estimated_cost_usd: 0,
+  actual_cost_usd: null,
+  cost_status: '',
+  workspace: sessionWorkspace,
+}
+
+const entries = [
+  { name: 'src', path: 'src', isDir: true, size: 0, modTime: '2026-09-08T00:00:00.000Z' },
+  { name: 'README.md', path: 'README.md', isDir: false, size: 88, modTime: '2026-09-08T00:00:00.000Z' },
+  { name: 'package.json', path: 'package.json', isDir: false, size: 120, modTime: '2026-09-08T00:00:00.000Z' },
+]
+
+async function captureEvidence(page: Page, name: string) {
+  const evidenceDir = process.env.HERMES_VISUAL_EVIDENCE_DIR
+  if (evidenceDir) {
+    await page.screenshot({ path: `${evidenceDir}/${name}.png`, animations: 'disabled' })
+  }
+}
+
+test('downloads workspace files from Diff and file-tree menu', async ({ page }) => {
+  await page.setViewportSize({ width: 1440, height: 900 })
+  await authenticate(page, TEST_ACCESS_KEY, 'research')
+  await page.addInitScript(() => window.localStorage.setItem('hermes_locale', 'en'))
+  await page.addInitScript(id => {
+    ;(window as any).__PW_CHAT_SOCKET_RESUMES__ = {
+      [id]: { session_id: id, messages: [], isWorking: false, events: [] },
+    }
+  }, sessionId)
+  const api = await mockHermesApi(page, { sessions: [session] })
+
+  await page.route(`**/api/studio/sessions/${sessionId}/workspace-files/list**`, async route => {
+    const url = new URL(route.request().url())
+    await route.fulfill({
+      status: 200,
+      contentType: 'application/json',
+      body: JSON.stringify({ entries, path: url.searchParams.get('path') || '', absolutePath: sessionWorkspace }),
+    })
+  })
+  await page.route(`**/api/studio/sessions/${sessionId}/workspace-file/diff**`, async route => {
+    await route.fulfill({
+      status: 200,
+      contentType: 'application/json',
+      body: JSON.stringify({ patch: '', additions: 0, deletions: 0, binary: false, truncated: false }),
+    })
+  })
+  await page.route(`**/api/studio/sessions/${sessionId}/workspace-file/read**`, async route => {
+    await route.fulfill({
+      status: 200,
+      contentType: 'application/json',
+      body: JSON.stringify({
+        path: 'README.md',
+        size: 88,
+        content: '# File tree collapse demo\n\nThe file preview stays available while the file tree changes.\n',
+      }),
+    })
+  })
+  let downloadRequests = 0
+  await page.route(`**/api/studio/sessions/${sessionId}/workspace-file/content**`, async route => {
+    downloadRequests += 1
+    await route.fulfill({ status: 200, contentType: 'application/octet-stream', headers: { 'Content-Disposition': 'attachment; filename="README.md"' }, body: '# Download check' })
+  })
+  await mockChatSocket(page)
+
+  await page.goto(`/#/hermes/session/${sessionId}`)
+  await page.locator('.header-tool-toggle').click()
+
+  const panel = page.locator('.chat-tool-panel')
+  const tree = panel.locator('.files-tree-panel')
+  await expect(tree).toBeVisible()
+  await expect(panel.locator('.explorer-resize-handle .file-tree-toggle')).toHaveCount(0)
+  await expect(panel.getByText('README.md', { exact: true })).toBeVisible()
+  await captureEvidence(page, '01-expanded-tree')
+
+  await panel.getByText('README.md', { exact: true }).click()
+  await expect(panel.locator('.workspace-file-diff')).toBeVisible()
+  await expect(panel.locator('.diff-file-name')).toHaveText('README.md')
+  await expect(panel.locator('.workspace-markdown-preview')).toContainText('The file preview stays available')
+  await expect(panel.locator('.workspace-file-diff .file-tree-toggle')).toBeVisible()
+  await expect(panel.getByRole('button', { name: 'Collapse file tree', exact: true })).toHaveAttribute('aria-expanded', 'true')
+  const firstDownload = page.waitForEvent('download')
+  await panel.getByRole('button', { name: 'Download', exact: true }).click()
+  expect((await firstDownload).suggestedFilename()).toBe('README.md')
+  await panel.getByText('README.md', { exact: true }).first().click({ button: 'right' })
+  const secondDownload = page.waitForEvent('download')
+  await page.getByText('Download', { exact: true }).last().click()
+  expect((await secondDownload).suggestedFilename()).toBe('README.md')
+  expect(downloadRequests).toBe(2)
+})
```

---

### Incident Patch 7: `78b71bf5` (2026-10-02)
**Commit Message**: fix(antigravity): preserve macOS keychain access in global mode (#3266)

**File**: `docs/antigravity-cli.md` (modified, +16/-5)
```diff
@@ -32,13 +32,16 @@ Private skills: `~/.gemini/config/skills`; shared Studio skills: `~/.agents/skil
 Each Studio runtime gets a shadow HOME under its own runtime directory. User
 settings are copied, Studio MCP definitions are merged into a private MCP file,
 and skills/native state are linked. Native authentication and session state stay
-owned by the official CLI. User settings, MCP and permission files are not mutated
+owned by the official CLI. Global mode on macOS links `Library/Keychains` and
+`Library/Preferences/com.apple.security.plist` into the shadow HOME so native
+`security` lookups retain the login keychain. Credentials are not copied, and
+external-provider mode does not add these links. User settings, MCP and permission files are not mutated
 by launch. Studio MCP servers receive explicit `ELECTRON_RUN_AS_NODE=1` and the
 current turn credential file. Only Studio's injected MCP servers are added to the
 shadow permissions allow list; user permission files remain unchanged, but CLI permission prompts are bypassed by the launch flag. Antigravity launches use `--dangerously-skip-permissions` by explicit user-selected policy.
 
-Google keyring authentication with shadow HOME, Windows link privileges and
-native state compatibility still require real-platform acceptance testing.
+Windows/Linux native credential access, Windows link privileges and native state
+compatibility still require real-platform acceptance testing.
 
 ## Wire protocol and lifecycle
 
@@ -72,11 +75,19 @@ global/scoped picker and continuing unloaded search results with the same agent.
 and harness checks cover the server and Web/Electron client. App Node tests cover
 its source/runtime contracts, not an APK/IPA build.
 
-No Google login, paid inference, real workspace coding turn, native keyring or
-cross-platform packaging acceptance was performed. A release must additionally
+Initial integration testing did not include Google login, paid inference, a real
+workspace coding turn, native keyring or cross-platform packaging acceptance.
+A release must additionally
 verify login, two-turn restart/resume, actual MCP plan+clarify, stop during a tool,
 permission denial, workspace diff, and App/server version compatibility.
 
+On 2026-10-02, an actual macOS host reproduced authentication failure with the
+shadow HOME: `security default-keychain -d user` could not find the default
+keychain. Linking both native paths restored that lookup and `agy models` returned
+the model list. A headless turn using native authentication reached Google but
+returned HTTP 403 with a location eligibility error; model-list success does not
+establish that the account can run inference. This is not cross-platform acceptance.
+
 ## Feedback fixes
 
 The initial LPK had a value-taking `-p` flag followed by `--output-format`; official
```

**File**: `packages/server/src/modules/coding-agents/services/antigravity/config.ts` (modified, +2/-0)
```diff
@@ -1,6 +1,7 @@
 import { mkdir, readdir, readFile, symlink, writeFile, rm } from 'node:fs/promises'
 import { join } from 'node:path'
 import { writeManagedPromptFile } from '../prompt-file'
+import { linkAntigravityNativeKeychain } from './native-keychain'
 
 export const ANTIGRAVITY_INSTALL_URL = 'https://antigravity.google/docs/cli/install'
 export const ANTIGRAVITY_DEFAULT_SETTINGS = '{\n  "toolPermission": "request-review"\n}\n'
@@ -31,6 +32,7 @@ export async function prepareAntigravityRuntime(input: {
   const source = join(input.home, '.gemini')
   const shadow = join(input.rootDir, '.gemini')
   await mkdir(shadow, { recursive: true })
+  if (!input.externalModel) await linkAntigravityNativeKeychain(input.home, input.rootDir)
   // Remove only the obsolete Studio-owned hook in generated runtime state.
   // Otherwise a reused session can keep prompting after the policy changes.
   const obsoleteHook = join(shadow, 'antigravity-cli', 'hooks.json')
```

**File**: `packages/server/src/modules/coding-agents/services/antigravity/native-keychain.ts` (added, +30/-0)
```diff
@@ -0,0 +1,30 @@
+import { lstat, mkdir, symlink } from 'node:fs/promises'
+import { dirname, join } from 'node:path'
+
+export async function linkAntigravityNativeKeychain(
+  home: string,
+  rootDir: string,
+  platform: NodeJS.Platform = process.platform,
+): Promise<void> {
+  if (platform !== 'darwin') return
+  // go-keyring invokes /usr/bin/security, which resolves both its preferences
+  // and login keychain relative to HOME. Keep those native while MCP/settings
+  // use the per-run HOME; credentials stay in the OS keychain rather than copies.
+  const entries = [
+    { path: join('Library', 'Keychains'), type: 'dir' as const },
+    { path: join('Library', 'Preferences', 'com.apple.security.plist'), type: 'file' as const },
+  ]
+  for (const entry of entries) {
+    const source = join(home, entry.path)
+    const exists = await lstat(source).catch((error: NodeJS.ErrnoException) => {
+      if (error.code === 'ENOENT') return undefined
+      throw error
+    })
+    if (!exists) continue
+    const target = join(rootDir, entry.path)
+    await mkdir(dirname(target), { recursive: true })
+    await symlink(source, target, entry.type).catch((error: NodeJS.ErrnoException) => {
+      if (error.code !== 'EEXIST') throw error
+    })
+  }
+}
```

**File**: `packages/server/src/modules/coding-agents/services/runtime/run-manager.ts` (modified, +1/-1)
```diff
@@ -2768,7 +2768,7 @@ export class CodingAgentRunManager {
     if (run.printCompleted) return
     const safeMessage = sanitizeCodingAgentTerminalOutput(message)
     const guidance = /authentication|not logged|log in/i.test(safeMessage)
-      ? `${safeMessage}\nAntigravity CLI authentication is unavailable to this Studio runtime. Complete agy login on the Studio host; if already logged in, verify native credential access from the isolated runtime.`
+      ? `${safeMessage}\nAntigravity CLI authentication is unavailable to this Studio runtime. Run agy interactively on the Studio host to complete sign-in; if already signed in, verify native credential access from the isolated runtime.`
       : safeMessage
     // Persist visible failure text before the failed terminal event. Otherwise
     // refresh leaves an empty assistant row with only a zero-token usage card.
```

**File**: `tests/server/antigravity-native-keychain.test.ts` (added, +65/-0)
```diff
@@ -0,0 +1,65 @@
+import { afterEach, describe, expect, it } from 'vitest'
+import { lstat, mkdir, mkdtemp, readFile, readlink, rm, writeFile } from 'node:fs/promises'
+import { tmpdir } from 'node:os'
+import { join } from 'node:path'
+import { linkAntigravityNativeKeychain } from '../../packages/server/src/modules/coding-agents/services/antigravity/native-keychain'
+import { prepareAntigravityRuntime } from '../../packages/server/src/modules/coding-agents/services/antigravity/config'
+
+const roots: string[] = []
+afterEach(async () => {
+  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true })
+})
+
+async function fixture() {
+  const root = await mkdtemp(join(tmpdir(), 'studio-agy-keychain-'))
+  roots.push(root)
+  const home = join(root, 'home'), runtime = join(root, 'runtime')
+  await mkdir(join(home, 'Library', 'Keychains'), { recursive: true })
+  await mkdir(join(home, 'Library', 'Preferences'), { recursive: true })
+  await writeFile(join(home, 'Library', 'Keychains', 'login.keychain-db'), 'native keychain fixture')
+  await writeFile(join(home, 'Library', 'Preferences', 'com.apple.security.plist'), 'native search preferences')
+  return { home, runtime }
+}
+
+describe('Antigravity native keychain with a per-run HOME', () => {
+  it('links both the keychain and its search preferences without copying native state', async () => {
+    const { home, runtime } = await fixture()
+    await linkAntigravityNativeKeychain(home, runtime, 'darwin')
+    for (const relative of ['Library/Keychains', 'Library/Preferences/com.apple.security.plist']) {
+      expect((await lstat(join(runtime, relative))).isSymbolicLink()).toBe(true)
+      expect(await readlink(join(runtime, relative))).toBe(join(home, relative))
+    }
+    await writeFile(join(home, 'Library', 'Keychains', 'login.keychain-db'), 'updated native state')
+    expect(await readFile(join(runtime, 'Library', 'Keychains', 'login.keychain-db'), 'utf8')).toBe('updated native state')
+    expect(await readFile(join(home, 'Library', 'Preferences', 'com.apple.security.plist'), 'utf8')).toBe('native search preferences')
+    await expect(linkAntigravityNativeKeychain(home, runtime, 'darwin')).resolves.toBeUndefined()
+  })
+
+  it.each(['linux', 'win32'] as const)('does not add macOS state on %s', async platform => {
+    const { home, runtime } = await fixture()
+    await linkAntigravityNativeKeychain(home, runtime, platform)
+    await expect(lstat(join(runtime, 'Library'))).rejects.toMatchObject({ code: 'ENOENT' })
+  })
+
+  it('allows hosts without native keychain paths and preserves existing runtime files', async () => {
+    const { home, runtime } = await fixture()
+    await expect(linkAntigravityNativeKeychain(join(home, 'missing'), runtime, 'darwin')).resolves.toBeUndefined()
+    await mkdir(join(runtime, 'Library', 'Preferences'), { recursive: true })
+    const preferences = join(runtime, 'Library', 'Preferences', 'com.apple.security.plist')
+    await writeFile(preferences, 'existing runtime preferences')
+    await linkAntigravityNativeKeychain(home, runtime, 'darwin')
+    expect(await readFile(preferences, 'utf8')).toBe('existing runtime preferences')
+    expect(await readFile(join(home, 'Library', 'Preferences', 'com.apple.security.plist'), 'utf8')).toBe('native search preferences')
+  })
+
+  it.skipIf(process.platform !== 'darwin')('keeps native authentication in global mode and excludes it from external-provider mode', async () => {
+    const { home, runtime } = await fixture()
+    const global = await prepareAntigravityRuntime({ home, rootDir: runtime, systemPrompt: 'rules', managedMcp: {} })
+    expect(global.env.HOME).toBe(runtime)
+    expect((await lstat(join(runtime, 'Library', 'Keychains'))).isSymbolicLink()).toBe(true)
+    expect((await lstat(join(runtime, '.gemini', 'antigravity-cli', 'settings.json'))).isSymbolicLink()).toBe(false)
+    const external = join(runtime, 'external')
+    await prepareAntigravityRuntime({ home, rootDir: external, systemPrompt: 'rules', managedMcp: {}, externalModel: { baseUrl: 'http://127.0.0.1', token: 'fixture-token' } })
+    await expect(lstat(join(external, 'Library'))).rejects.toMatchObject({ code: 'ENOENT' })
+  })
+})
```

---

### Incident Patch 8: `ea5bcb9f` (2026-10-02)
**Commit Message**: fix(agent-updates): refresh manual update state and guard active sessions (#3261)

* fix(agent-updates): publish manual checks and lock manual installs

* fix(agent-updates): prefer updated managed npm CLI over system copies

---------

Co-authored-by: Lux <[REDACTED_EMAIL]>

**File**: `packages/client/src/views/hermes/AgentManagerView.vue` (modified, +6/-0)
```diff
@@ -438,6 +438,12 @@ async function handleCheckUpdate(id: CodingAgentId) {
     if (!result.success) throw new Error(result.message || t('codingAgents.checkUpdateFailed'))
     replaceTool(result.tool)
     updateInfo.value[id] = result
+    const previous = updatePolicies.value[id]
+    if (previous) updatePolicies.value[id] = {
+      ...previous, currentVersion: result.tool.version, latestVersion: result.latestVersion,
+      checkedAt: new Date().toISOString(),
+      status: result.tool.installed && result.updateAvailable ? 'available' : 'current', error: undefined,
+    }
   } catch (error) {
     message.error(errorMessage(error))
   } finally {
```

**File**: `packages/server/src/modules/coding-agents/services/index.ts` (modified, +2/-0)
```diff
@@ -1,3 +1,4 @@
+import { prioritizeManagedNpmBin } from './managed-command-path'
 import { readTomlAssignment } from './toml-assignment'
 import { studioMcpCapabilities } from '../../studio/public/runs/mcp-capabilities'
 import { prepareDshRuntime, DSH_API_KEY_ENV } from './dsh/runtime-config'
@@ -2811,6 +2812,7 @@ async function commandEnv(): Promise<NodeJS.ProcessEnv> {
     ...(loginShellPath ? loginShellPath.split(':') : []),
     ...getDesktopCommonBinPaths(),
   ])
+  prioritizeManagedNpmBin(env, npmBin)
   return env
 }
 
```

**File**: `packages/server/src/modules/coding-agents/services/managed-command-path.ts` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+import { delimiter } from 'node:path'
+
+/** npm install -g writes to this prefix. Promote it even when it already
+ * exists later in PATH; otherwise an older system CLI shadows the update. */
+export function prioritizeManagedNpmBin(env: NodeJS.ProcessEnv, npmBin: string | null): void {
+  if (!npmBin) return
+  const key = Object.keys(env).find(key => key.toLowerCase() === 'path') || 'PATH'
+  const entries = (env[key] || '').split(delimiter).filter(Boolean)
+  const identity = (value: string) => process.platform === 'win32' ? value.toLowerCase() : value
+  env[key] = [npmBin, ...entries.filter(entry => identity(entry) !== identity(npmBin))].join(delimiter)
+}
```

**File**: `packages/server/src/modules/coding-agents/services/update-manager.ts` (modified, +7/-1)
```diff
@@ -35,5 +35,11 @@ export async function getAgentUpdateManager():Promise<AgentUpdatePolicy>{
 
 export async function installAgentAndPublish(id: string) {
   await loadPolicy()
-  return policy.installAndRefresh(id, () => installCodingAgent(id))
+  return policy.installAndRefresh(id, async () => {
+    const release = lockAgentUpdate(id)
+    try {
+      if (codingAgentRunManager.isAgentBusyForUpdate(id)) throw Object.assign(new Error('Agent session is active; stop it before updating'), { status: 409 })
+      return await installCodingAgent(id)
+    } finally { release() }
+  })
 }
```

**File**: `tests/e2e/agent-manager-updates.spec.ts` (modified, +20/-0)
```diff
@@ -91,3 +91,23 @@ test('shows disabled Cursor updates without stale failures and preserves support
   await expect(cursorSwitch).toHaveClass(/n-switch--disabled/)
   await expect(cursor.locator('.agent-update-error')).toHaveCount(0)
 })
+
+
+test('manual check reveals an available update even when the last policy poll was current', async ({ page }) => {
+  await authenticate(page)
+  await mockHermesApi(page)
+  await page.route('**/api/agents/status', route => route.fulfill({ json: { revision: 1, agents: [
+    { id: 'grok', installed: true, source: 'user-cli', version: '1.0.30', path: '/test/grok' },
+    { id: 'cursor', installed: true, source: 'user-cli', version: '1', path: '/test/agent' },
+  ] } }))
+  await page.route('**/api/coding-agents/update-policies', route => route.fulfill({ json: { agents: {
+    grok: { autoUpdate: false, autoUpdateSupported: true, status: 'current', currentVersion: '1.0.30', latestVersion: '1.0.30' },
+  } } }))
+  await page.route('**/api/coding-agents/grok/check-update', route => route.fulfill({ json: {
+    success: true, tool: { id: 'grok', installed: true, version: '1.0.30' }, latestVersion: '1.0.46', updateAvailable: true,
+  } }))
+  await page.goto('/#/studio/agents')
+  const card = page.getByTestId('agent-card-grok')
+  await card.getByRole('button', { name: 'Check for update', exact: true }).click()
+  await expect(card.getByRole('button', { name: /1.0.46/ })).toBeVisible()
+})
```

**File**: `tests/server/agent-update-policy-layout.test.ts` (modified, +6/-0)
```diff
@@ -16,3 +16,9 @@ it('update button formats target version with the same v prefix as installed ver
  expect(s).toContain('version: formatVersion(availableUpdateVersion(agent.id))')
  expect(s).toContain('if (result.updateState) updatePolicies.value[id] = result.updateState')
 })
+
+it('manual version checks update the policy used to render the update button', () => {
+ const source = readFileSync('packages/client/src/views/hermes/AgentManagerView.vue', 'utf8')
+ expect(source).toContain('latestVersion: result.latestVersion')
+ expect(source).toContain("status: result.tool.installed && result.updateAvailable ? 'available' : 'current'")
+})
```

**File**: `tests/server/managed-command-path.test.ts` (added, +24/-0)
```diff
@@ -0,0 +1,24 @@
+import { delimiter } from 'node:path'
+import { describe, expect, it } from 'vitest'
+import { prioritizeManagedNpmBin } from '../../packages/server/src/modules/coding-agents/services/managed-command-path'
+
+describe('managed npm CLI priority', () => {
+  it('promotes a managed bin already shadowed by an older system installation', () => {
+    const env = { PATH: ['/usr/local/bin', '/home/user/.local/bin', '/studio/npm/bin', '/usr/bin'].join(delimiter) }
+    prioritizeManagedNpmBin(env, '/studio/npm/bin')
+    expect(env.PATH.split(delimiter)).toEqual(['/studio/npm/bin', '/usr/local/bin', '/home/user/.local/bin', '/usr/bin'])
+  })
+  it('deduplicates the promoted path and remains stable across repeated calls', () => {
+    const env = { PATH: ['/system', '/managed', '/managed'].join(delimiter) }
+    prioritizeManagedNpmBin(env, '/managed'); prioritizeManagedNpmBin(env, '/managed')
+    expect(env.PATH.split(delimiter)).toEqual(['/managed', '/system'])
+  })
+  it('preserves path casing and leaves missing prefixes alone', () => {
+    const env = { Path: ['/system', '/managed'].join(delimiter) }
+    prioritizeManagedNpmBin(env, '/managed')
+    expect(env.Path.split(delimiter)[0]).toBe('/managed')
+    const before = env.Path
+    prioritizeManagedNpmBin(env, null)
+    expect(env.Path).toBe(before)
+  })
+})
```

---

### Incident Patch 9: `d8c7b5e0` (2026-10-02)
**Commit Message**: fix(claude): reconcile text snapshots by message instead of block index (#3263)

Co-authored-by: Lux <[REDACTED_EMAIL]>

**File**: `packages/server/src/modules/coding-agents/services/runtime/run-manager.ts` (modified, +16/-14)
```diff
@@ -201,7 +201,7 @@ export interface ManagedCodingAgentRun {
   printText?: string
   claudeResultUsage?: any
   claudeStreamMessageId?: string
-  claudeTextBlocks?: Map<string, string>
+  claudeMessageText?: Map<string, string>
   printCompleted?: boolean
   responseStartEmitted?: boolean
   terminalEventHandled?: boolean
@@ -2026,7 +2026,7 @@ export class CodingAgentRunManager {
     run.printToolBlocks = new Map()
     run.claudeResultUsage = undefined
     run.claudeStreamMessageId = undefined
-    run.claudeTextBlocks = new Map()
+    run.claudeMessageText = new Map()
     run.currentChildStderr = ''
     run.runMarker = undefined
     run.memoryExportStarted = false
@@ -2257,16 +2257,18 @@ export class CodingAgentRunManager {
     if (!content.length) return
 
     if (role === 'assistant') {
+      // Native snapshots may remove thinking/redacted blocks and reindex text.
+      // Reconcile the complete message's text, not provider block positions.
+      const messageId = String(message.id || run.claudeStreamMessageId || run.printMessageId)
+      const text = content.filter((block: any) => block?.type === 'text')
+        .map((block: any) => String(block.text || '')).join('')
+      run.claudeMessageText ??= new Map()
+      const previous = run.claudeMessageText.get(messageId) || ''
+      if (text.startsWith(previous)) {
+        this.appendClaudeText(run, text.slice(previous.length))
+        run.claudeMessageText.set(messageId, text)
+      }
       for (const [index, block] of content.entries()) {
-        if (block?.type === 'text') {
-          const key = `${message.id || run.claudeStreamMessageId || run.printMessageId}:${index}`
-          const text = String(block.text || '')
-          run.claudeTextBlocks ??= new Map()
-          const previous = run.claudeTextBlocks.get(key) || ''
-          if (text.startsWith(previous)) this.appendClaudeText(run, text.slice(previous.length))
-          run.claudeTextBlocks.set(key, text)
-          continue
-        }
         if (block?.type !== 'tool_use') continue
         const toolBlock = {
           id: String(block.id || `toolu_${index}`),
@@ -2399,9 +2401,9 @@ export class CodingAgentRunManager {
       if (delta.type === 'text_delta' && delta.text) {
         this.ensureClaudePrintText(run)
         const text = String(delta.text)
-        const key = `${run.claudeStreamMessageId || run.printMessageId}:${index}`
-        run.claudeTextBlocks ??= new Map()
-        run.claudeTextBlocks.set(key, `${run.claudeTextBlocks.get(key) || ''}${text}`)
+        const key = String(run.claudeStreamMessageId || run.printMessageId)
+        run.claudeMessageText ??= new Map()
+        run.claudeMessageText.set(key, `${run.claudeMessageText.get(key) || ''}${text}`)
         this.appendClaudeText(run, text)
         return
       }
```

**File**: `tests/server/agent-runner-utils.test.ts` (modified, +54/-1)
```diff
@@ -2791,7 +2791,7 @@ describe('Claude Code stream-json mapping', () => {
       state: { messages: [], isWorking: false, events: [], queue: [] },
       currentChild: { exitCode: null, signalCode: null, killed: false },
       printText: '', printTextStarted: false, printCompleted: false,
-      printToolBlocks: new Map(), claudeTextBlocks: new Map(),
+      printToolBlocks: new Map(), claudeMessageText: new Map(),
     }
     ;(manager as any).runs.set(run.id, run)
     const line = (event: any) => (manager as any).handleClaudePrintLine(run, JSON.stringify(event))
@@ -2812,6 +2812,59 @@ describe('Claude Code stream-json mapping', () => {
     expect(run.terminalEventHandled).not.toBe(true)
   })
 
+  it.each([1, 2])('deduplicates full text when native snapshot omits %s preceding non-text blocks', (textIndex) => {
+    const manager = new CodingAgentRunManager()
+    const emitted = vi.fn()
+    ;(manager as any).emitToChat = emitted
+    ;(manager as any).ensureDbSession = () => {}
+    ;(manager as any).touch = () => {}
+    const run: any = {
+      id: 'claude-reindexed', launch: { agentId: 'claude-code', sessionId: 'claude-reindexed', profile: 'default' },
+      state: { messages: [], isWorking: false, events: [], queue: [] },
+      currentChild: { exitCode: null, signalCode: null }, printText: '', printTextStarted: false,
+      claudeMessageText: new Map(), printToolBlocks: new Map(),
+    }
+    ;(manager as any).runs.set(run.id, run)
+    const line = (event: any) => (manager as any).handleClaudePrintLine(run, JSON.stringify(event))
+    const stream = (event: any) => line({ type: 'stream_event', event })
+    stream({ type: 'message_start', message: { id: 'msg-reindexed' } })
+    stream({ type: 'content_block_delta', index: textIndex, delta: { type: 'text_delta', text: 'GitHub is ready.' } })
+    line({ type: 'assistant', message: { id: 'msg-reindexed', role: 'assistant', content: [
+      { type: 'text', text: 'GitHub is ready.' },
+    ] } })
+    line({ type: 'result', result: 'GitHub is ready.' })
+    expect(run.printText).toBe('GitHub is ready.')
+    expect(run.state.messages.at(-1)?.content).toBe('GitHub is ready.')
+    expect(emitted.mock.calls.filter(c => c[1] === 'message.delta').map(c => c[2].delta).join('')).toBe('GitHub is ready.')
+  })
+
+  it('reconciles multiple text blocks and preserves identical text in different messages', () => {
+    const manager = new CodingAgentRunManager()
+    ;(manager as any).emitToChat = () => {}
+    ;(manager as any).ensureDbSession = () => {}
+    ;(manager as any).touch = () => {}
+    const run: any = {
+      id: 'claude-multi', launch: { agentId: 'claude-code', sessionId: 'claude-multi', profile: 'default' },
+      state: { messages: [], isWorking: false, events: [], queue: [] },
+      currentChild: { exitCode: null, signalCode: null }, printText: '',
+      claudeMessageText: new Map(), printToolBlocks: new Map(),
+    }
+    ;(manager as any).runs.set(run.id, run)
+    const line = (event: any) => (manager as any).handleClaudePrintLine(run, JSON.stringify(event))
+    line({ type: 'stream_event', event: { type: 'message_start', message: { id: 'first' } } })
+    line({ type: 'stream_event', event: { type: 'content_block_delta', index: 2,
+      delta: { type: 'text_delta', text: 'Same ' } } })
+    const snapshot = (id: string) => ({ type: 'assistant', message: { id, role: 'assistant', content: [
+      { type: 'text', text: 'Same ' }, { type: 'text', text: 'answer.' },
+    ] } })
+    line(snapshot('first'))
+    line(snapshot('first'))
+    expect(run.printText).toBe('Same answer.')
+    // Repeated content in a different model message is not a transport duplicate.
+    line(snapshot('second'))
+    expect(run.printText).toBe('Same answer.Same answer.')
+  })
+
   it('recovers result-only text after an empty started text block', () => {
     const manager = new CodingAgentRunManager()
     ;(manager as any).emitToChat = () => {}
```

---

### Incident Patch 10: `8564948c` (2026-10-02)
**Commit Message**: fix(claude): drain native stdout before persisting turn completion (#3260)

Co-authored-by: Lux <[REDACTED_EMAIL]>

**File**: `packages/server/src/modules/coding-agents/services/runtime/run-manager.ts` (modified, +47/-26)
```diff
@@ -199,6 +199,9 @@ export interface ManagedCodingAgentRun {
   printMessageId?: string
   printTextStarted?: boolean
   printText?: string
+  claudeResultUsage?: any
+  claudeStreamMessageId?: string
+  claudeTextBlocks?: Map<string, string>
   printCompleted?: boolean
   responseStartEmitted?: boolean
   terminalEventHandled?: boolean
@@ -2021,6 +2024,9 @@ export class CodingAgentRunManager {
     run.responseStartEmitted = false
     run.terminalEventHandled = false
     run.printToolBlocks = new Map()
+    run.claudeResultUsage = undefined
+    run.claudeStreamMessageId = undefined
+    run.claudeTextBlocks = new Map()
     run.currentChildStderr = ''
     run.runMarker = undefined
     run.memoryExportStarted = false
@@ -2123,7 +2129,7 @@ export class CodingAgentRunManager {
         return
       }
       if (code === 0) {
-        this.completeClaudePrintTurn(run)
+        this.completeClaudePrintTurn(run, run.claudeResultUsage)
         return
       }
       this.handleClaudePrintResponseEvent(run, {
@@ -2216,21 +2222,20 @@ export class CodingAgentRunManager {
     if (event.type === 'result') {
       if (run.printCompleted) return
       const resultText = String(event.result || '')
-      if (resultText && !run.printTextStarted) {
-        this.ensureClaudePrintText(run)
-        run.printText = `${run.printText || ''}${resultText}`
-        this.handleClaudePrintResponseEvent(run, {
-          type: 'response.output_text.delta',
-          data: {
-            type: 'response.output_text.delta',
-            item_id: run.printMessageId,
-            output_index: 0,
-            content_index: 0,
-            delta: resultText,
-          },
-        })
+      // The process can still emit native messages after a result (for example
+      // resumed background notifications). Do not latch printCompleted until
+      // close has drained stdout; otherwise all subsequent records are lost.
+      if (resultText && !(run.printText || '').endsWith(resultText)) {
+        const delta = appendedTextDelta(run.printText || '', resultText)
+        this.appendClaudeText(run, delta)
       }
-      this.completeClaudePrintTurn(run, event.usage)
+      run.claudeResultUsage = event.usage ?? run.claudeResultUsage
+      logger.debug({
+        runId: run.id, sessionId: run.launch.sessionId,
+        subtype: event.subtype, textChars: (run.printText || '').length,
+        waitingForClose: Boolean(run.currentChild),
+      }, '[coding-agent-run] Claude result received; waiting for stdout close')
+      if (!run.currentChild) this.completeClaudePrintTurn(run, run.claudeResultUsage)
     }
   }
 
@@ -2253,6 +2258,15 @@ export class CodingAgentRunManager {
 
     if (role === 'assistant') {
       for (const [index, block] of content.entries()) {
+        if (block?.type === 'text') {
+          const key = `${message.id || run.claudeStreamMessageId || run.printMessageId}:${index}`
+          const text = String(block.text || '')
+          run.claudeTextBlocks ??= new Map()
+          const previous = run.claudeTextBlocks.get(key) || ''
+          if (text.startsWith(previous)) this.appendClaudeText(run, text.slice(previous.length))
+          run.claudeTextBlocks.set(key, text)
+          continue
+        }
         if (block?.type !== 'tool_use') continue
         const toolBlock = {
           id: String(block.id || `toolu_${index}`),
@@ -2322,6 +2336,7 @@ export class CodingAgentRunManager {
     if (type === 'message_start') {
       run.usagePendingClaudeTools = new Set()
       const id = String(event?.message?.id || run.printResponseId || `resp_${Date.now()}`)
+      run.claudeStreamMessageId = id
       run.printResponseId = id
       run.printMessageId = `msg_${id}`
       return
@@ -2384,17 +2399,10 @@ export class CodingAgentRunManager {
       if (delta.type === 'text_delta' && delta.text) {
         this.ensureClaudePrintText(run)
         const text = String(delta.text)
-        run.printText = `${run.printText || ''}${text}`
-        this.handleClaudePrintResponseEvent(run, {
-          type: 'response.output_text.delta',
-          data: {
-            type: 'response.output_text.delta',
-            item_id: run.printMessageId,
-            output_index: 0,
-            content_index: 0,
-            delta: text,
-          },
-        })
+        const key = `${run.claudeStreamMessageId || run.printMessageId}:${index}`
+        run.claudeTextBlocks ??= new Map()
+        run.claudeTextBlocks.set(key, `${run.claudeTextBlocks.get(key) || ''}${text}`)
+        this.appendClaudeText(run, text)
         return
       }
       if (delta.type === 'input_json_delta' && delta.partial_json) {
@@ -2441,6 +2449,19 @@ export class CodingAgentRunManager {
     }
   }
 
+  private appendClaudeText(run: ManagedCodingAgentRun, text: string) {
+    if (!text) return
+    this.ensureClaudePrintText(run)
+    run.printText = `${run.printText || ''}${text}`
+    this.handleClaudePrintResponseEvent(run, {
+    
```

**File**: `tests/server/agent-runner-utils.test.ts` (modified, +100/-0)
```diff
@@ -249,6 +249,54 @@ describe('coding agent completion errors', () => {
     manager.shutdown()
   })
 
+  it('keeps consuming Claude stdout after an early empty result and persists the later answer', async () => {
+    initAllHermesTables()
+    const fixtureDir = mkdtempSync(join(tmpdir(), 'claude-early-result-'))
+    const fixturePath = join(fixtureDir, 'stream.cjs')
+    const records = [
+      { type: 'result', result: '', usage: { input_tokens: 1, output_tokens: 0 } },
+      { type: 'assistant', message: { id: 'msg-tool', role: 'assistant', content: [
+        { type: 'tool_use', id: 'tool-late', name: 'Bash', input: { command: 'pwd' } },
+      ] } },
+      { type: 'user', message: { role: 'user', content: [
+        { type: 'tool_result', tool_use_id: 'tool-late', content: '/tmp/fixture' },
+      ] } },
+      { type: 'assistant', message: { id: 'msg-answer', role: 'assistant', content: [
+        { type: 'text', text: 'The complete answer.' },
+      ] } },
+      { type: 'result', result: 'The complete answer.' },
+    ]
+    writeFileSync(fixturePath, `process.stdin.resume(); process.stdin.on('end', () => {
+      process.stdout.write(${JSON.stringify(JSON.stringify(records[0]) + '\n')});
+      setTimeout(() => { process.stdout.write(${JSON.stringify(records.slice(1).map(r => JSON.stringify(r)).join('\n') + '\n')}); }, 80);
+    });`)
+    const manager = new CodingAgentRunManager()
+    const sessionId = `claude-early-result-${Date.now()}`
+    const emitted = vi.fn()
+    ;(manager as any).emitToChat = emitted
+    ;(manager as any).refreshCodingAgentUsage = async () => {}
+    try {
+      manager.start({ agentSessionId: sessionId, sessionId, agentId: 'claude-code', mode: 'scoped',
+        profile: 'default', provider: 'test', model: 'test', command: process.execPath,
+        args: [fixturePath], shellCommand: process.execPath, workspaceDir: fixtureDir,
+        state: { messages: [], isWorking: false, events: [], queue: [] } })
+      manager.send(sessionId, 'test')
+      const run = (manager as any).runs.get(sessionId)
+      await vi.waitFor(() => expect(run.claudeResultUsage).toEqual({ input_tokens: 1, output_tokens: 0 }), { interval: 5 })
+      expect(run.printCompleted).toBe(false)
+      expect(run.terminalEventHandled).toBe(false)
+      expect(emitted.mock.calls.filter(call => call[1] === 'run.completed')).toHaveLength(0)
+      await vi.waitFor(() => expect(emitted).toHaveBeenCalledWith(sessionId, 'run.completed', expect.anything()))
+      const messages = getSessionDetail(sessionId)?.messages || []
+      expect(messages.at(-1)?.content).toBe('The complete answer.')
+      expect(messages.some(m => m.role === 'tool' && m.content === '/tmp/fixture')).toBe(true)
+      expect(emitted.mock.calls.filter(call => call[1] === 'run.completed')).toHaveLength(1)
+    } finally {
+      manager.shutdown()
+      rmSync(fixtureDir, { recursive: true, force: true })
+    }
+  })
+
   it('waits for Claude stdout to close before settling a zero-exit child', async () => {
     initAllHermesTables()
     const fixtureDir = mkdtempSync(join(tmpdir(), 'claude-api-error-close-'))
@@ -2728,6 +2776,58 @@ describe('Claude Code stream-json mapping', () => {
     }))
   })
 
+  it.each([
+    ['complete-only', []],
+    ['partial', ['The ']],
+    ['streamed', ['The ', 'complete answer.']],
+  ])('reconciles %s assistant text without duplicating stream or result text', (_name, chunks) => {
+    const manager = new CodingAgentRunManager()
+    const emitted = vi.fn()
+    ;(manager as any).emitToChat = emitted
+    ;(manager as any).ensureDbSession = () => {}
+    ;(manager as any).touch = () => {}
+    const run: any = {
+      id: 'claude-text', launch: { agentId: 'claude-code', sessionId: 'claude-text', profile: 'default' },
+      state: { messages: [], isWorking: false, events: [], queue: [] },
+      currentChild: { exitCode: null, signalCode: null, killed: false },
+      printText: '', printTextStarted: false, printCompleted: false,
+      printToolBlocks: new Map(), claudeTextBlocks: new Map(),
+    }
+    ;(manager as any).runs.set(run.id, run)
+    const line = (event: any) => (manager as any).handleClaudePrintLine(run, JSON.stringify(event))
+    const stream = (event: any) => line({ type: 'stream_event', event })
+    stream({ type: 'message_start', message: { id: 'msg-answer' } })
+    // Even an empty text block must not suppress full-message/result fallback.
+    stream({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } })
+    for (const text of chunks) stream({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } })
+    const answer = { type: 'assistant', message: { id: 'msg-answer', role: 'assistant', content: [
+      { type: 'text', text: 'The complete answer.' },
+    ] } }
+    line(answer)
+    line(answer)
+    line({ type: 'result', result: 'The complete answer.' })
+    expect(run.printText).toBe('The complete answer
```

---

### Incident Patch 11: `2c27ee49` (2026-10-02)
**Commit Message**: fix(navigation): distinguish device connections with monitor and phone icon (#3262)

Co-authored-by: Lux <[REDACTED_EMAIL]>

**File**: `packages/client/src/components/layout/PageSidebarNav.vue` (modified, +1/-4)
```diff
@@ -131,10 +131,7 @@ function openApiRelay() {
           stroke-linejoin="round"
           aria-hidden="true"
         >
-          <circle cx="18" cy="5" r="2.5" />
-          <circle cx="6" cy="12" r="2.5" />
-          <circle cx="18" cy="19" r="2.5" />
-          <path d="m8.2 10.7 7.6-4.4M8.2 13.3l7.6 4.4" />
+          <path d="M3 4h14a1 1 0 0 1 1 1v4M3 4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h9M7 16v4M5 20h7M15 9h6a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1M17 18h2" />
         </svg>
         <span>{{ t('sidebar.connections') }}</span>
       </button>
```

**File**: `packages/client/src/components/layout/StudioNavigationRail.vue` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@ const entries = computed(() => [
   { key: 'group', route: 'hermes.groupChat', label: 'sidebar.groupChat', path: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' },
   { key: 'workflow', route: 'hermes.workflow', label: 'sidebar.workflow', path: 'M8 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0M22 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0M22 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0M8 12h3a4 4 0 0 0 4-4V6M8 12h3a4 4 0 0 1 4 4v2' },
   { key: 'history', route: 'hermes.history', label: 'sidebar.history', path: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M12 7v5l3 2' },
-  { key: 'connections', route: 'hermes.connections', label: 'sidebar.connections', path: 'M20.5 5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0M8.5 12a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0M20.5 19a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0M8.2 10.7l7.6-4.4M8.2 13.3l7.6 4.4' },
+  { key: 'connections', route: 'hermes.connections', label: 'sidebar.connections', path: 'M3 4h14a1 1 0 0 1 1 1v4M3 4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h9M7 16v4M5 20h7M15 9h6a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1M17 18h2' },
   ...(canManageAgents.value ? [{ key: 'agents', route: 'hermes.agentManager', label: 'sidebar.agentManager', path: 'M12 8V4H8M7 8h10a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3M2 14h2M20 14h2M9 13v2M15 13v2' }] : []),
   { key: 'models', route: 'hermes.models', label: 'sidebar.models', path: 'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1' },
 ])
```

**File**: `tests/client/device-connections-icon.test.ts` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+import { readFileSync } from 'node:fs'
+import { describe, expect, it } from 'vitest'
+
+// Keep both desktop rail and the compact sidebar on the same device metaphor.
+const path = 'M3 4h14a1 1 0 0 1 1 1v4M3 4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h9M7 16v4M5 20h7M15 9h6a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1M17 18h2'
+describe('Device connections icon', () => {
+  it('uses the same monitor + phone outline in both navigation surfaces', () => {
+    for (const file of ['StudioNavigationRail.vue', 'PageSidebarNav.vue']) {
+      const source = readFileSync(`packages/client/src/components/layout/${file}`, 'utf8')
+      expect(source).toContain(path)
+
+    }
+  })
+  it('keeps the workflow branch icon distinct', () => {
+    const source = readFileSync('packages/client/src/components/layout/StudioNavigationRail.vue', 'utf8')
+    const workflow = source.split("key: 'workflow'")[1].split('\n')[0]
+    const connections = source.split("key: 'connections'")[1].split('\n')[0]
+    expect(workflow).not.toContain(path)
+    expect(connections).toContain(path)
+  })
+})
```

---

### Incident Patch 12: `3a247543` (2026-10-01)
**Commit Message**: [codex] fix Studio drawers and workspace picker UI (#3247)

* fix group Agent drawer layering, loading and preset focus

* remove Enter submission from session rename input

* unify Studio drawer dimensions and workspace picker UI

* test: align mobile history sidebar with shared drawer width

* test: tolerate subpixel rounding in mobile drawer layout checks

**File**: `packages/client/src/components/common/FolderIcon.vue` (added, +13/-0)
```diff
@@ -0,0 +1,13 @@
+<script setup lang="ts">
+defineProps<{ open?: boolean }>()
+</script>
+
+<template>
+  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
+    <template v-if="open">
+      <path d="M3 12V6a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v3" />
+      <path d="M3 12h18l-3 8H5l-2-8Z" />
+    </template>
+    <path v-else d="M20 20H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2Z" />
+  </svg>
+</template>
```

**File**: `packages/client/src/components/hermes/chat/ChatPanel.vue` (modified, +2/-3)
```diff
@@ -2705,7 +2705,6 @@ async function handleSessionModelCustomSubmit() {
         ref="renameInputRef"
         v-model:value="renameValue"
         :placeholder="t('chat.enterNewTitle')"
-        @keydown.enter="handleRenameConfirm"
       />
     </NModal>
 
@@ -2715,7 +2714,7 @@ async function handleSessionModelCustomSubmit() {
       :title="t('chat.setWorkspaceTitle')"
       :positive-text="t('common.ok')"
       :negative-text="t('common.cancel')"
-      style="width: 520px"
+      style="width: var(--studio-workspace-picker-width)"
       @positive-click="handleWorkspaceConfirm"
     >
       <FolderPicker v-model="workspaceValue" />
@@ -2904,7 +2903,7 @@ async function handleSessionModelCustomSubmit() {
       v-model:show="showNewChatModal"
       class="new-chat-drawer"
       placement="right"
-      width="min(440px, 100vw)"
+      width="var(--studio-drawer-width)"
       :mask-closable="true"
     >
       <NDrawerContent :title="t('chat.newChat')" closable>
```

**File**: `packages/client/src/components/hermes/chat/DrawerPanel.vue` (modified, +11/-5)
```diff
@@ -50,7 +50,7 @@ function handleClose() {
             {{ t('drawer.terminal') }}
           </button>
         </div>
-        <button class="close-button" @click="handleClose">
+        <button class="close-button" type="button" :aria-label="t('common.close')" @click="handleClose">
           <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
             <line x1="18" y1="6" x2="6" y2="18" />
             <line x1="6" y1="6" x2="18" y2="18" />
@@ -86,11 +86,13 @@ function handleClose() {
 .drawer-panel {
   position: fixed;
   top: 0;
-  right: min(-1180px, -88vw);
-  width: min(1180px, 88vw);
+  right: calc(0px - var(--studio-drawer-width));
+  width: var(--studio-drawer-width);
   height: calc(100 * var(--vh));
   max-height: calc(100 * var(--vh));
   background: $bg-card;
+  border-radius: 5px 0 0 5px;
+  overflow: hidden;
   box-shadow: -2px 0 8px rgba(0, 0, 0, 0.15);
   display: flex;
   flex-direction: column;
@@ -153,7 +155,7 @@ function handleClose() {
 .close-button {
   padding: 8px;
   border: none;
-  background: rgba(var(--accent-primary-rgb), 0.08);
+  background: transparent;
   color: $text-secondary;
   cursor: pointer;
   border-radius: $radius-sm;
@@ -165,7 +167,11 @@ function handleClose() {
 
   &:hover {
     color: $text-primary;
-    background: rgba(var(--accent-primary-rgb), 0.15);
+  }
+
+  &:focus-visible {
+    outline: 2px solid $accent-primary;
+    outline-offset: 2px;
   }
 }
 
```

**File**: `packages/client/src/components/hermes/chat/FolderPicker.vue` (modified, +220/-97)
```diff
@@ -5,6 +5,7 @@ import { useI18n } from 'vue-i18n'
 import { request } from '@/api/client'
 import { copyToClipboard } from '@/utils/clipboard'
 import StarIcon from '@/components/common/StarIcon.vue'
+import FolderIcon from '@/components/common/FolderIcon.vue'
 
 interface FolderEntry {
   name: string
@@ -311,68 +312,94 @@ const flatNodes = computed<FlatNode[]>(() => {
 
 <template>
   <div class="folder-picker">
-    <NInput
-      :value="selectedPath"
-      :placeholder="t('chat.workspacePlaceholder')"
-      clearable
-      size="small"
-      class="folder-path-input"
-      @update:value="updateSelectedPath"
-    />
+    <div class="folder-path-bar">
+      <NInput
+        :value="selectedPath"
+        :placeholder="t('chat.workspacePlaceholder')"
+        :input-props="{ 'aria-label': t('chat.workspacePlaceholder') }"
+        clearable
+        class="folder-path-input"
+        @update:value="updateSelectedPath"
+      >
+        <template #prefix><FolderIcon class="folder-path-icon" /></template>
+      </NInput>
+    </div>
     <div v-if="loading" class="folder-picker-loading">
       <NSpin size="small" />
+      <span>{{ t('common.loading') }}</span>
     </div>
     <div v-else class="folder-tree">
-      <!-- Base path as root -->
-      <div
+      <button
         v-if="basePath"
         class="folder-item root"
+        type="button"
         :class="{ selected: selectedPath === basePath }"
+        :aria-pressed="selectedPath === basePath"
+        :title="basePath"
         @click="selectBase"
         @contextmenu="showContextMenu($event, null)"
       >
-        <span class="folder-icon">📂</span>
-        <span class="folder-name">{{ basePath || '/' }}</span>
-      </div>
-
-      <!-- Flat rendered tree -->
-      <div
-        v-for="node in flatNodes"
-        :key="node.folder.path"
-        class="folder-item"
-        :class="{ selected: selectedPath === node.folder.fullPath }"
-        :style="{ paddingLeft: `${12 + node.depth * 16}px` }"
-        @click="selectFolder(node.folder)"
-        @contextmenu="showContextMenu($event, node.folder)"
-      >
-        <span class="folder-expand" @click.stop="toggleExpand(node.folder)">
-          <NSpin v-if="node.isLoading" :size="16" />
-          <template v-else>{{ node.isExpanded ? '▼' : '▶' }}</template>
-        </span>
-        <span class="folder-icon">📁</span>
-        <span class="folder-name">{{ node.folder.name }}</span>
-      </div>
+        <FolderIcon class="folder-icon" open />
+        <span class="folder-name">{{ basePath }}</span>
+        <svg v-if="selectedPath === basePath" class="folder-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
+          <path d="m5 12 4 4L19 6" />
+        </svg>
+      </button>
 
-      <!-- Empty children indicator for expanded folders with no children -->
-      <template v-for="node in flatNodes" :key="'empty-' + node.folder.path">
+      <template v-for="node in flatNodes" :key="node.folder.path">
+        <div
+          class="folder-item"
+          :class="{ selected: selectedPath === node.folder.fullPath }"
+          :style="{ paddingInlineStart: `${4 + node.depth * 20}px` }"
+          @contextmenu="showContextMenu($event, node.folder)"
+        >
+          <button
+            class="folder-expand"
+            type="button"
+            :aria-label="`${t(node.isExpanded ? 'common.collapse' : 'common.expand')}: ${node.folder.name}`"
+            :aria-expanded="node.isExpanded"
+            :aria-busy="node.isLoading"
+            @click.stop="toggleExpand(node.folder)"
+          >
+            <NSpin v-if="node.isLoading" :size="14" />
+            <svg v-else class="folder-chevron" :class="{ expanded: node.isExpanded }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
+              <path d="m9 5 7 7-7 7" />
+            </svg>
+          </button>
+          <button
+            class="folder-select"
+            type="button"
+            :aria-pressed="selectedPath === node.folder.fullPath"
+            :title="node.folder.fullPath"
+            @click="selectFolder(node.folder)"
+          >
+            <FolderIcon class="folder-icon" :open="node.isExpanded" />
+            <span class="folder-name">{{ node.folder.name }}</span>
+            <svg v-if="selectedPath === node.folder.fullPath" class="folder-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
+              <path d="m5 12 4 4L19 6" />
+            </svg>
+          </button>
+        </div>
         <div
           v-if="node.isExpanded && !node.isLoading && node.hasChildren === false"
           class="folder-item empty"
-          :style="{ paddin
```

**File**: `packages/client/src/components/hermes/group-chat/GroupChatPanel.vue` (modified, +90/-50)
```diff
@@ -132,7 +132,10 @@ const manualRoomLinkInput = ref<HTMLInputElement | null>(null)
 const showMemberRail = ref(true)
 const editingAgent = ref<RoomAgent | null>(null)
 const isSavingAgent = ref(false)
+const isLoadingAgentForm = ref(false)
+let agentDrawerLoadSequence = 0
 const agentStatusSnapshot = ref<AgentStatusSnapshot | null>(null)
+let agentStatusRequest: Promise<void> | null = null
 const showRoomSettingsModal = ref(false)
 const showUserProfileModal = ref(false)
 const userProfileName = ref('')
@@ -282,12 +285,16 @@ function warnAgentUnavailable(agent: GroupAgentType) {
     message.warning(t('codingAgents.installRequired', { agent: groupAgentDisplayName(agent) }))
 }
 
-async function refreshAgentAvailability() {
-    try {
-        agentStatusSnapshot.value = await fetchAgentStatusSnapshot()
-    } catch {
-        agentStatusSnapshot.value = null
-    }
+function refreshAgentAvailability(): Promise<void> {
+    if (agentStatusRequest) return agentStatusRequest
+    agentStatusRequest = (async () => {
+        try {
+            agentStatusSnapshot.value = await fetchAgentStatusSnapshot()
+        } catch {
+            agentStatusSnapshot.value = null
+        }
+    })().finally(() => { agentStatusRequest = null })
+    return agentStatusRequest
 }
 
 function getAgentModelGroups(profile: string) {
@@ -499,6 +506,7 @@ const agentAvatarPreview = computed(() =>
 
 const canConfirmAddAgent = computed(() =>
     Boolean(
+        !isLoadingAgentForm.value &&
         isGroupAgentAvailable(selectedAgentType.value) &&
         (selectedAgentType.value !== 'dsh' || (selectedRuntimePreset.value && selectedRuntimePresetReady.value)) &&
         selectedProfile.value &&
@@ -1361,6 +1369,7 @@ function currentAgentPresetInput(): GroupAgentPresetInput | null {
 }
 
 async function loadAgentPresets() {
+    if (isLoadingAgentPresets.value) return
     isLoadingAgentPresets.value = true
     agentPresetLoadError.value = ''
     try {
@@ -1378,13 +1387,15 @@ function openAgentPresetSelection() {
     pendingAgentPresetId.value = selectedAgentPresetId.value
     agentPresetSearch.value = ''
     showAgentPresetDialog.value = true
+    void loadAgentPresets()
 }
 
 function openAgentPresetManager() {
     agentPresetDialogMode.value = 'manage'
     pendingAgentPresetId.value = null
     agentPresetSearch.value = ''
     showAgentPresetDialog.value = true
+    void loadAgentPresets()
 }
 
 function closeAgentPresetDialog() {
@@ -1399,6 +1410,7 @@ function selectAgentPresetForDialog(preset: GroupAgentPreset) {
 }
 
 function confirmAgentPresetSelection() {
+    if (isLoadingAgentForm.value || isLoadingAgentPresets.value) return
     const preset = pendingAgentPreset.value
     if (!preset?.available) return
     applyAgentPreset(preset.id)
@@ -1483,33 +1495,48 @@ async function deleteAgentPreset() {
 }
 
 function closeAgentDrawer() {
+    agentDrawerLoadSequence++
+    isLoadingAgentForm.value = false
     closeAgentPresetDialog()
     showAddAgentDrawer.value = false
     editingAgent.value = null
     resetAgentForm()
 }
 
-async function handleAddAgent() {
-    if (!currentRoomCanManage.value) return
-    await Promise.all([
-        profilesStore.fetchProfiles(),
-        appStore.loadModels(),
-        loadAgentPresets(),
-        refreshAgentAvailability(),
-    ])
-    editingAgent.value = null
-    resetAgentForm()
-    selectedRuntimePreset.value = undefined
-    selectedRuntimePresetReady.value = false
+function initializeNewAgentSelection() {
     selectedAgentType.value = firstAvailableGroupAgentType.value || 'hermes'
     selectedProfile.value =
         profilesStore.activeProfileName ||
         profilesStore.profiles.find(profile => profile.active)?.name ||
         profilesStore.profiles[0]?.name ||
         'default'
     syncAgentModelSelection(selectedProfile.value)
-    selectedAgentReasoningEffort.value = ''
+}
+
+async function loadAgentFormOptions() {
+    const sequence = ++agentDrawerLoadSequence
+    const roomId = store.currentRoomId
+    isLoadingAgentForm.value = true
+    try {
+        await Promise.all([
+            profilesStore.fetchProfiles(),
+            appStore.loadModels(),
+            refreshAgentAvailability(),
+        ])
+        if (sequence !== agentDrawerLoadSequence || !showAddAgentDrawer.value || roomId !== store.currentRoomId) return
+        if (!editingAgent.value) initializeNewAgentSelection()
+    } finally {
+        if (sequence === agentDrawerLoadSequence) isLoadingAgentForm.value = false
+    }
+}
+
+function handleAddAgent() {
+    if (!currentRoomCanManage.value || showAddAgentDrawer.value) return
+    editingAgent.value = null
+    resetAgentForm()
+    initializeNewAgentSelection()
     showAddAgentDrawer.value = true
+    void loadAgentFormOptions()
 }
 
 function randomAgentAvatarSeed() {
@@ -1554,15 +1581,9 @@ async function handleAgentAvatarFileChange(event: Event) {
     }
 }
 
-async function handleEditAgent(agent: RoomAgent) {
-    if (!curr
```

**File**: `packages/client/src/components/hermes/kanban/KanbanTaskDrawer.vue` (modified, +1/-1)
```diff
@@ -441,7 +441,7 @@ function handleNavigateTask(taskId: string) {
 </script>
 
 <template>
-  <NDrawer :show="!!taskId" :width="420" placement="right" @update:show="(v: boolean) => { if (!v) emit('close') }">
+  <NDrawer :show="!!taskId" width="var(--studio-drawer-width)" placement="right" @update:show="(v: boolean) => { if (!v) emit('close') }">
     <NDrawerContent :title="detail?.task.title || ''" closable>
       <NSpin :show="loading">
         <template v-if="detail">
```

**File**: `packages/client/src/components/hermes/settings/voice/VoiceApiConfigurator.vue` (modified, +1/-1)
```diff
@@ -212,7 +212,7 @@ function handleDoubaoVoiceUpdate(value: string) {
 </script>
 
 <template>
-  <NDrawer :show="show" :width="400" @update:show="emit('close')">
+  <NDrawer :show="show" width="var(--studio-drawer-width)" @update:show="emit('close')">
     <NDrawerContent :title="connection?.label" closable>
       <NForm label-placement="top" v-if="connection">
         <NFormItem v-if="!connection.isBuiltin" :label="t('settings.voice.apiKey')">
```

**File**: `packages/client/src/components/layout/MobileNavigationDrawer.vue` (modified, +5/-2)
```diff
@@ -14,7 +14,7 @@ const { t } = useI18n()
 <template>
   <NDrawer
     :show="show"
-    :width="hasSidebar ? 'min(360px, calc(100vw - 24px))' : 64"
+    :width="hasSidebar ? 'var(--studio-drawer-width)' : 64"
     placement="left"
     display-directive="show"
     class="studio-mobile-drawer"
@@ -40,6 +40,9 @@ const { t } = useI18n()
   height: 100%;
   min-height: 0;
   background: $bg-sidebar-surface;
+  border-top-right-radius: 5px;
+  border-bottom-right-radius: 5px;
+  overflow: hidden;
 
   :deep(.studio-navigation-rail) {
     padding-top: max(12px, env(safe-area-inset-top, 0px));
@@ -71,7 +74,7 @@ const { t } = useI18n()
   background: transparent;
   cursor: pointer;
 
-  &:hover { background: rgba(var(--accent-primary-rgb), 0.08); }
+  &:hover { color: $text-primary; }
   &:focus-visible { outline: 2px solid $accent-primary; }
 }
 .studio-mobile-navigation .studio-mobile-navigation__content {
```

---

### Incident Patch 13: `1ecc1115` (2026-10-01)
**Commit Message**: fix(chat-run): allow reading a session owned by another profile on the same socket (#3242)

* fix(chat-run): allow reading a session owned by another profile on the same socket

* test(chat-run): cover cross-profile session resume

**File**: `packages/server/src/modules/studio/sockets/chat-run.ts` (modified, +19/-2)
```diff
@@ -870,6 +870,23 @@ export class ChatRunSocket {
       }
       return sessionProfile
     }
+    // Read-only access to a session. A connection may read sessions from any profile the
+    // user can access: the UI switches between profiles without always reconnecting (see
+    // #1884), so pinning every read to the handshake profile made `resume` fail and left
+    // the conversation permanently blank. Mutating operations keep the stricter
+    // connection-scoped check above (see the attachment provenance boundary in `run`).
+    const requireSocketSessionReadAccess = (sessionId: string) => {
+      const session = getSession(sessionId)
+      if (!session) throw new Error('Session not found')
+      const sessionProfile = String(session.profile || 'default').trim() || 'default'
+      if (!profileExists(sessionProfile)) {
+        throw new Error(`Profile "${sessionProfile}" does not exist`)
+      }
+      if (socketUser && !this.canAccessProfile(socketUser, sessionProfile)) {
+        throw new Error(`Profile "${sessionProfile}" is not available for this user`)
+      }
+      return sessionProfile
+    }
 
     socket.on('run', async (data: {
       push_snapshot?: unknown
@@ -1140,7 +1157,7 @@ export class ChatRunSocket {
       if (!data.session_id) return
       const sid = data.session_id
       try {
-        requireSocketSessionAccess(sid)
+        requireSocketSessionReadAccess(sid)
       } catch (err) {
         socket.emit('run.failed', {
           event: 'run.failed',
@@ -1157,7 +1174,7 @@ export class ChatRunSocket {
       if (!data.session_id || typeof data.id !== 'string' || data.id.length > 128) return
       const sid = data.session_id
       try {
-        requireSocketSessionAccess(sid)
+        requireSocketSessionReadAccess(sid)
       } catch (err) {
         socket.emit('run.failed', {
           event: 'run.failed',
```

**File**: `tests/server/chat-run-bridge-readiness.test.ts` (modified, +44/-0)
```diff
@@ -1204,3 +1204,47 @@ describe('session upload provenance at the socket boundary', () => {
     expect((server as any).sessionMap.get('session-1').queue).toHaveLength(1)
   })
 })
+
+
+describe('cross-profile session resume', () => {
+  beforeEach(() => {
+    vi.clearAllMocks()
+    getSessionMock.mockImplementation((sessionId?: string) => sessionId
+      ? { id: sessionId, profile: 'research', source: 'cli', model: 'gpt-test', provider: 'openai' }
+      : undefined)
+  })
+
+  it('resumes a session owned by another profile the user can access', async () => {
+    const { ChatRunSocket } = await import('../../packages/server/src/modules/studio/sockets/chat-run')
+    const { handlers, io, socket } = makeServerHarness()
+    const server = new ChatRunSocket(io as any)
+    const resumeSession = vi.spyOn(server as any, 'resumeSession').mockResolvedValue(undefined)
+
+    ;(server as any).onConnection(socket)
+    await handlers.get('resume')!({ session_id: 'research-session' })
+
+    // The connection was handshaked as `default`, but reading a session the user can
+    // access must not be pinned to the handshake profile: otherwise the client gets
+    // `run.failed` instead of `resumed` and the conversation stays blank.
+    expect(socket.emit).not.toHaveBeenCalledWith('run.failed', expect.anything())
+    expect(socket.join).toHaveBeenCalledWith('session:research-session')
+    expect(resumeSession).toHaveBeenCalledWith(socket, 'research-session')
+  })
+
+  it('still rejects a session from a profile the user cannot access', async () => {
+    const { ChatRunSocket } = await import('../../packages/server/src/modules/studio/sockets/chat-run')
+    const { handlers, io, socket } = makeServerHarness()
+    socket.data = { user: { id: 7, role: 'user' } as any }
+    userCanAccessProfileMock.mockReturnValueOnce(false)
+    const server = new ChatRunSocket(io as any)
+    const resumeSession = vi.spyOn(server as any, 'resumeSession').mockResolvedValue(undefined)
+
+    ;(server as any).onConnection(socket)
+    await handlers.get('resume')!({ session_id: 'research-session' })
+
+    expect(socket.emit).toHaveBeenCalledWith('run.failed', expect.objectContaining({
+      error: 'Profile "research" is not available for this user',
+    }))
+    expect(resumeSession).not.toHaveBeenCalled()
+  })
+})
```

---

### Incident Patch 14: `97203089` (2026-10-01)
**Commit Message**: fix coding agent context overflow recovery (#3204)

Co-authored-by: Lux <[REDACTED_EMAIL]>

**File**: `docs/chat-chain-changes/2026-09-27-coding-agent-context-overflow-recovery.md` (added, +26/-0)
```diff
@@ -0,0 +1,26 @@
+---
+date: 2026-09-27
+pr: pending
+feature: Recover coding-agent sessions after normal Codex turns exceed context
+impact: Keep Studio history and workspace usable instead of repeatedly resuming an oversized native Codex thread.
+---
+
+When a normal scoped Codex turn fails with a recognized context-window error,
+Studio now detaches the oversized native session, marks the in-memory runner for
+disposal after the failed turn is persisted, and tells the user that the next
+message will continue in a fresh Codex context. The visible Studio Session,
+history, selected provider/model/API mode, and workspace remain unchanged.
+
+This extends the existing native `/compact` overflow recovery to the regular
+turn-failure path. Recoverable Codex stream errors remain provisional until the
+child exits non-zero; successful retries keep the original native session.
+Non-context failures and sessions without a persisted native ID are unchanged.
+
+Regression coverage verifies that an authoritative non-zero Codex exit with
+`context_length_exceeded` clears both the persisted and in-memory native IDs,
+disables resume, disposes the stale runner after terminal persistence, emits the
+recovery notice, and still records the failed turn. It also verifies that a
+provisional context error followed by exit code `0` keeps the native session.
+
+Validation: 120 focused coding-agent tests, `npm run harness:check`, and
+`npm run build` passed.
```

**File**: `packages/server/src/modules/coding-agents/services/context-recovery.ts` (modified, +4/-0)
```diff
@@ -44,6 +44,10 @@ export function nativeContextRecoveryMessage(agentName: string): string {
   return `${agentName} compaction could not fit inside the model context window. Studio kept the visible conversation and workspace, then detached the oversized native session. Send the next message to continue in a fresh ${agentName} context.`
 }
 
+export function nativeTurnContextRecoveryMessage(agentName: string): string {
+  return `${agentName} exceeded the model context window. Studio kept the visible conversation and workspace, then detached the oversized native session. Send the next message to continue in a fresh ${agentName} context.`
+}
+
 function errorText(error: unknown): string {
   if (error instanceof Error) {
     const cause = 'cause' in error ? error.cause : undefined
```

**File**: `packages/server/src/modules/coding-agents/services/runtime/run-manager.ts` (modified, +38/-11)
```diff
@@ -37,7 +37,12 @@ import { RunToolTiming } from './tool-timing'
 import { readOpenCodeMessageModel } from './native-model'
 import { readCodexTurnAccounting } from './codex-usage'
 import { getCodingAgentGlobalHome } from '../../../studio/public/coding-agent-global-home'
-import { isContextWindowExceededError, nativeContextRecoveryMessage, resetNativeSessionAfterContextOverflow } from '../context-recovery'
+import {
+  isContextWindowExceededError,
+  nativeContextRecoveryMessage,
+  nativeTurnContextRecoveryMessage,
+  resetNativeSessionAfterContextOverflow,
+} from '../context-recovery'
 
 export { isolatedCodingAgentChildEnv } from './child-env'
 
@@ -2459,24 +2464,41 @@ export class CodingAgentRunManager {
   private recoverFailedNativeCompact(run: ManagedCodingAgentRun, error: unknown) {
     if (!run.nativeCompactCommandActive) return
     run.nativeCompactCommandActive = false
-    if (!isContextWindowExceededError(error)) return
+    this.recoverNativeSessionAfterContextOverflow(run, error, 'compact')
+  }
+
+  private recoverNativeSessionAfterContextOverflow(
+    run: ManagedCodingAgentRun,
+    error: unknown,
+    action: 'compact' | 'recover',
+  ): boolean {
+    if (!isContextWindowExceededError(error)) return false
     const recovery = resetNativeSessionAfterContextOverflow(run.launch.sessionId, run.launch.agentId)
-    if (!recovery.reset) return
+    if (!recovery.reset) return false
     run.launch.agentNativeSessionId = ''
     run.nativeResumeReady = false
     run.disposeAfterTurn = true
-    const agentName = run.launch.agentId === 'grok' ? 'Grok' : 'Claude Code'
+    const agentName = run.launch.agentId === 'codex'
+      ? 'Codex'
+      : run.launch.agentId === 'grok'
+        ? 'Grok'
+        : run.launch.agentId === 'pi'
+          ? 'Pi'
+          : 'Claude Code'
     this.emitToChat(run.launch.sessionId, 'session.command', {
       event: 'session.command',
       session_id: run.launch.sessionId,
-      command: 'compact',
-      action: 'compact',
+      command: action,
+      action,
       ok: true,
       terminal: true,
       compacted: false,
       resetNativeThread: true,
-      message: nativeContextRecoveryMessage(agentName),
+      message: action === 'compact'
+        ? nativeContextRecoveryMessage(agentName)
+        : nativeTurnContextRecoveryMessage(agentName),
     })
+    return true
   }
 
   private failClaudePrintTurn(run: ManagedCodingAgentRun, errorText: string) {
@@ -3197,6 +3219,8 @@ export class CodingAgentRunManager {
       this.completeCodexExecTurn(run, run.codexPendingUsage)
       return
     }
+    const error = run.codexPendingError || exitErrorMessage('Codex', code, run.currentChildStderr)
+    this.recoverNativeSessionAfterContextOverflow(run, error, 'recover')
     this.handleClaudePrintResponseEvent(run, {
       type: 'response.failed',
       data: {
@@ -3206,7 +3230,7 @@ export class CodingAgentRunManager {
           object: 'response',
           status: 'failed',
           model: run.launch.model,
-          error: { message: run.codexPendingError || exitErrorMessage('Codex', code, run.currentChildStderr) },
+          error: { message: error },
           output: [],
           usage: run.codexPendingUsage,
         },
@@ -3319,16 +3343,19 @@ export class CodingAgentRunManager {
 
   private deferCodexExecError(run: ManagedCodingAgentRun, message: string) {
     // Codex emits broad `error` events for recoverable stream retries as well as
-    // failures. Let the native process exit status arbitrate the turn: exit 0
-    // discards this provisional error, while a non-zero exit reports it.
-    if (childIsRunning(run.currentChild) || (run.launch.mode === 'global' && run.currentChild)) {
+    // failures. Keep errors provisional while the child reference still exists,
+    // including final buffered JSONL parsed after the child has exited. The exit
+    // status then arbitrates the turn: exit 0 discards the error, while a non-zero
+    // exit reports it.
+    if (run.currentChild) {
       run.codexPendingError = message
       return
     }
     this.failCodexExecTurn(run, message, run.codexPendingUsage)
   }
 
   private failCodexExecTurn(run: ManagedCodingAgentRun, message: string, usage?: unknown) {
+    this.recoverNativeSessionAfterContextOverflow(run, message, 'recover')
     this.handleClaudePrintResponseEvent(run, {
       type: 'response.failed',
       data: {
```

**File**: `tests/server/agent-runner-utils.test.ts` (modified, +129/-0)
```diff
@@ -912,6 +912,71 @@ describe('coding agent run state', () => {
     manager.shutdown()
   })
 
+  it('keeps a native Codex session when a final buffered context error exits zero', async () => {
+    initAllHermesTables()
+    const manager = new CodingAgentRunManager()
+    const emitted = vi.fn()
+    const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
+    const sessionId = `chat-codex-final-buffer-retry-${suffix}`
+    const nativeSessionId = `native-${suffix}`
+    createSession({
+      id: sessionId,
+      profile: 'default',
+      source: 'coding_agent',
+      agent: 'codex',
+      agent_session_id: `agent-${suffix}`,
+      agent_native_session_id: nativeSessionId,
+      model: 'test-model',
+      provider: 'test-provider',
+      api_mode: 'chat_completions',
+      reasoning_effort: '',
+      agent_preset: '',
+      title: '',
+      workspace: process.cwd(),
+    })
+    ;(manager as any).emitToChat = emitted
+    ;(manager as any).refreshCodingAgentUsage = async () => {}
+    manager.start({
+      agentSessionId: `agent-${suffix}`,
+      agentId: 'codex',
+      mode: 'scoped',
+      profile: 'default',
+      provider: 'test-provider',
+      model: 'test-model',
+      apiMode: 'chat_completions',
+      sessionId,
+      command: 'codex',
+      args: [],
+      shellCommand: 'codex',
+      workspaceDir: process.cwd(),
+      agentNativeSessionId: nativeSessionId,
+      nativeResume: true,
+      state: { messages: [], isWorking: true, events: [], queue: [] } as any,
+    })
+    const run = (manager as any).runs.get(`agent-${suffix}`)
+    run.currentChild = { exitCode: 0, signalCode: null, killed: false }
+
+    ;(manager as any).handleCodexExecLine(run, JSON.stringify({
+      type: 'error',
+      message: 'context_length_exceeded: retry recovered before process exit',
+    }))
+    ;(manager as any).appendCodexFinalText(run, 'recovered final answer')
+    run.currentChild = undefined
+    ;(manager as any).finishCodexExecTurn(run, 0)
+    await new Promise(resolve => setTimeout(resolve, 0))
+
+    expect(getSession(sessionId)?.agent_native_session_id).toBe(nativeSessionId)
+    expect(run.launch.agentNativeSessionId).toBe(nativeSessionId)
+    expect(run.disposeAfterTurn).not.toBe(true)
+    expect(emitted).toHaveBeenCalledWith(sessionId, 'run.completed', expect.objectContaining({
+      output: 'recovered final answer',
+    }))
+    expect(emitted).not.toHaveBeenCalledWith(sessionId, 'session.command', expect.objectContaining({
+      resetNativeThread: true,
+    }))
+    manager.shutdown()
+  })
+
   it('reports a provisional native Codex error when the child exits non-zero', async () => {
     initAllHermesTables()
     const manager = new CodingAgentRunManager()
@@ -954,6 +1019,70 @@ describe('coding agent run state', () => {
     manager.shutdown()
   })
 
+  it('detaches an oversized Codex native session after a normal turn overflows', async () => {
+    initAllHermesTables()
+    const manager = new CodingAgentRunManager()
+    const emitted = vi.fn()
+    const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
+    const sessionId = `chat-codex-turn-overflow-${suffix}`
+    const nativeSessionId = `native-${suffix}`
+    createSession({
+      id: sessionId,
+      profile: 'default',
+      source: 'coding_agent',
+      agent: 'codex',
+      agent_session_id: `agent-${suffix}`,
+      agent_native_session_id: nativeSessionId,
+      model: 'test-model',
+      provider: 'test-provider',
+      api_mode: 'chat_completions',
+      reasoning_effort: '',
+      agent_preset: '',
+      title: '',
+      workspace: process.cwd(),
+    })
+    ;(manager as any).emitToChat = emitted
+    ;(manager as any).refreshCodingAgentUsage = async () => {}
+    manager.start({
+      agentSessionId: `agent-${suffix}`,
+      agentId: 'codex',
+      mode: 'scoped',
+      profile: 'default',
+      provider: 'test-provider',
+      model: 'test-model',
+      apiMode: 'chat_completions',
+      sessionId,
+      command: 'codex',
+      args: [],
+      shellCommand: 'codex',
+      workspaceDir: process.cwd(),
+      agentNativeSessionId: nativeSessionId,
+      nativeResume: true,
+      state: { messages: [], isWorking: true, events: [], queue: [] } as any,
+    })
+    const run = (manager as any).runs.get(`agent-${suffix}`)
+    run.currentChild = undefined
+    run.codexPendingError = 'context_length_exceeded: Your input exceeds the context window of this model.'
+
+    ;(manager as any).finishCodexExecTurn(run, 1)
+    await new Promise(resolve => setTimeout(resolve, 0))
+
+    expect(getSession(sessionId)?.agent_native_session_id).toBe('')
+    expect(run.launch.agentNativeSessionId).toBe('')
+    expect(run.nativeResumeReady).toBe(false)
+    expect(run.disposeAfterTurn).toBe(true)
+    expect(emitted).toHaveBeenCalledWith(sessionId, 'session.command', expect.objectContaining({
+      action: 'recover',
+      ok: true,
+      rese
```

---

### Incident Patch 15: `96469c57` (2026-10-01)
**Commit Message**: Fix agent usage attribution, interrupted cards and cumulative totals (#3246)

* fix coding agent usage attribution and per-call costs

* isolate usage failures from coding agent chat lifecycle

* isolate native usage fixtures from live model pricing

* set run usage card minimum width to 200px

* include cumulative Pi usage in terminal chat events

* preserve interrupted run usage and publish late accounting updates

* refresh cumulative coding usage when stopped requests arrive late

* fix bridge retry test port collision

**File**: `docs/harness/usage-cost.md` (modified, +84/-0)
```diff
@@ -65,6 +65,90 @@ selected context threshold. `cost_source` remains `estimated`, so existing
 Studio/App coverage and total-cost displays work without a new API contract.
 Catalog refreshes never reprice previously stored records.
 
+## Coding Agent accounting boundaries
+
+Every scoped agent uses the provider proxy's measured terminal usage, including
+failed/incomplete responses that contain counters. Native events must never add
+a second ledger entry to those calls. In global mode, the adapters use:
+
+| Agent | Authoritative boundary | Deduplication / fallback |
+| --- | --- | --- |
+| Codex | Rollout `token_usage_record` for this thread and turn, including compaction | Native response ID; validate the per-turn total. Older rollouts use distinct `token_count.last_token_usage` records. Resumed CLI cumulative totals are never inserted as a new turn. |
+| Claude Code | Native result usage and USD estimate, with streamed assistant message counters | One result per turn; complete message counters survive cancellation. Per-message pricing when the final counters match and no native cost is available. |
+| Grok | Native turn/model cost, otherwise distinct response usage | Message ID; price individual calls only when they reconcile with the final aggregate. |
+| Cursor | Current invocation's result usage (disjoint input/cache), including explicit native USD fields | One result per turn; older versions without usage stay unknown. |
+| Pi | Assistant `message_end` usage | Native message ID or stable message hash; repeated terminal messages are excluded. |
+| OpenCode | `step_finish` part tokens/cost plus its exact assistant message model | Native part ID; ordinary input/cache are disjoint and reasoning is added to output once. |
+| DSH | Private ACP plugin's `llm/stream` usage chunk for each model call, including compaction and child calls | Generated request ID; record before turn completion. The context-window `usage_update` is not billing usage. |
+
+Persisted `parent_run_id` connects each request to its Studio run. Native Codex
+request timestamps preserve daily attribution. Session totals sum the same
+ledger that populates completed run cards; a run's cost stays NULL if any of its
+recorded calls has no price. Cancellation retains measured completed calls,
+but tokens not reported by an interrupted upstream cannot be reconstructed.
+Separate native threads are not charged merely because they appear nearby in
+a file; they need an identified accounting owner.
+
+Accounting is isolated from chat lifecycle errors: native/proxy usage failures
+must not suppress text, tool results, terminal events or cancellation cleanup.
+DSH usage notification/callback failures must not replace the model's original
+result/error or dispose the ACP connection. Codex's end-of-turn discovery and
+file reads share a two-second wait budget; on timeout the run settles with
+available/unknown accounting and releases the next input. Fault-injection tests
+exercise these guarantees alongside resume and queue-interruption tests.
+
+Terminal events carry the recorded session totals as well as the per-run card.
+This keeps Pi's cumulative display current before the client releases its run
+listeners; its deferred usage/context refresh does not delay completion. Error,
+cancellation and queue-interruption events retain already measured usage, while
+a session without ledger entries leaves cumulative usage unknown.
+
+Interrupted turns are finalized through their owning runtime before
+`abort.completed` releases the UI listener. The summary is attached to a persisted
+assistant message, including reasoning-only and empty replies, so resume keeps
+the same card. Codex queue insertion waits for the bounded native accounting
+read after process close. Late request usage and price fills publish
+`run.usage.updated` with the exact run/message IDs; the client updates that card
+independently of the active turn. Hermes and Ekko cancellation use the same
+persisted summary contract. Missing native measurements remain unknown.
+Late Coding Agent updates also carry current ledger totals for the session and
+refresh cached resume counters, without changing the active run or its context.
+
+Native USD catalog estimates remain estimates. Aggregate-only CLI versions
+cannot supply per-request context tiers; missing model/provider/price metadata
+remains unknown. Configure exact provider/model manual rates where appropriate.
+Do not infer a zero, official-provider price or account invoice from missing data.
+
+## Explicit legacy Codex repair
+
+`scripts/repair-codex-usage.ts` is an offline maintenance command. It defaults to
+a read-only preview, does not fetch prices, and never runs on server startup.
+Use an explicit database path, Studio session ID and the native CODEX_HOME for
+that session. Start with a SQLite backup/copy; close the app before applying to
+its database. The catalog is optional: without known rates, costs stay NULL.
+
+```bash
+npx 
```

**File**: `packages/client/src/api/studio/chat.ts` (modified, +12/-0)
```diff
@@ -261,6 +261,17 @@ const sessionCommandHandlers = new Set<(event: RunEvent) => void>()
 const sessionTitleUpdatedHandlers = new Set<(event: RunEvent) => void>()
 const sessionWorkspaceUpdatedHandlers = new Set<(event: RunEvent) => void>()
 const sessionSettingsUpdatedHandlers = new Set<(event: RunEvent) => void>()
+const runUsageUpdatedHandlers = new Set<(event: RunEvent) => void>()
+
+export function onRunUsageUpdated(handler: (event: RunEvent) => void): () => void {
+  runUsageUpdatedHandlers.add(handler)
+  return () => { runUsageUpdatedHandlers.delete(handler) }
+}
+
+function globalRunUsageUpdatedHandler(event: RunEvent): void {
+  if (!event.session_id) return
+  for (const handler of runUsageUpdatedHandlers) handler(event)
+}
 
 /**
  * Global message.delta event handler
@@ -872,6 +883,7 @@ export function connectChatRun(requestedProfile?: string | null, transport: Chat
 
     // Usage and task-plan events
     on('usage.updated', globalUsageUpdatedHandler)
+    on('run.usage.updated', globalRunUsageUpdatedHandler)
     on('plan.updated', globalAgentEventHandler)
     on('agent.event', globalAgentEventHandler)
     on('run.reattach_failed', globalRunReattachFailedHandler)
```

**File**: `packages/client/src/components/hermes/chat/RunUsageCard.vue` (modified, +1/-0)
```diff
@@ -40,6 +40,7 @@ const { t } = useI18n()
 .run-usage-card {
   box-sizing: border-box;
   width: 100%;
+  min-width: 200px;
   margin-top: 12px;
   padding: 12px 14px;
   display: grid;
```

**File**: `packages/client/src/stores/hermes/chat.ts` (modified, +36/-2)
```diff
@@ -1,6 +1,6 @@
 import { normalizeRunUsage, type RunUsageSummary } from '@/utils/run-usage'
 import { mergeTaskPlanMessages, type TaskPlanSnapshot } from '@/utils/task-plan'
-import { startRunViaSocket, resumeSession, registerSessionHandlers, unregisterSessionHandlers, getChatRunSocket, respondToolApproval, onPeerUserMessage, onSessionCommand, onSessionTitleUpdated, onSessionWorkspaceUpdated, onSessionSettingsUpdated, respondClarify, type ChatRunTransport, type RunEvent, type ResumeSessionPayload, type StartRunRequest, type ContentBlock as ContentBlockImport } from '@/api/studio/chat'
+import { startRunViaSocket, resumeSession, registerSessionHandlers, unregisterSessionHandlers, getChatRunSocket, respondToolApproval, onPeerUserMessage, onSessionCommand, onSessionTitleUpdated, onSessionWorkspaceUpdated, onSessionSettingsUpdated, onRunUsageUpdated, respondClarify, type ChatRunTransport, type RunEvent, type ResumeSessionPayload, type StartRunRequest, type ContentBlock as ContentBlockImport } from '@/api/studio/chat'
 import { archiveSession as archiveSessionApi, deleteSession as deleteSessionApi, fetchSessionMessagesPage, fetchSessions, fetchWorkspaceRunChangeFile, setSessionModel, setSessionPushEnabled as persistSessionPushEnabled, setSessionReasoningEffort as persistSessionReasoningEffort, type HermesMessage, type SessionSummary, type WorkspaceRunChangeFileDetail, type WorkspaceRunChangeSummary } from '@/api/studio/sessions'
 import { getActiveProfileName } from '@/api/client'
 import { onAuthInvalidated } from '@/api/auth-invalidation'
@@ -1545,6 +1545,7 @@ export const useChatStore = defineStore('chat', () => {
     runtimeGeneration += 1
     clearBackgroundObservers()
     sessions.value = []
+    pendingRunUsage.clear()
     completedUnreadSessions.value = new Set()
     queueLengths.value = new Map()
     queuedUserMessages.value = new Map()
@@ -1726,6 +1727,8 @@ export const useChatStore = defineStore('chat', () => {
     return alignedAssistantMessageId
   }
 
+  const pendingRunUsage = new Map<string, Map<string, NonNullable<ReturnType<typeof normalizeRunUsage>>>>()
+
   function handleTerminalWorkspaceRunChange(
     sessionId: string,
     evt: any,
@@ -1735,7 +1738,12 @@ export const useChatStore = defineStore('chat', () => {
     const target = sessions.value.find(session => session.id === sessionId)
     if (target) alignWorkspaceChangeAssistantMessage(target.messages, change, assistantMessageId)
     upsertWorkspaceRunChange(sessionId, change)
-    const summary = normalizeRunUsage(evt?.run_usage)
+    const originalSummary = normalizeRunUsage(evt?.run_usage)
+    const summary = originalSummary && (pendingRunUsage.get(sessionId)?.get(originalSummary.runId) || originalSummary)
+    if (summary) {
+      pendingRunUsage.get(sessionId)?.delete(summary.runId)
+      if (!pendingRunUsage.get(sessionId)?.size) pendingRunUsage.delete(sessionId)
+    }
     if (target && summary) {
       let message = target.messages.find(m => m.role === 'assistant' && m.id === summary.assistantMessageId)
         || target.messages.find(m => m.role === 'assistant' && m.id === assistantMessageId)
@@ -4105,6 +4113,10 @@ export const useChatStore = defineStore('chat', () => {
               setAbortState(sid, { aborting: false, synced: (evt as any).synced ?? false })
               settleInterruptedSubagents(sid)
               clearPendingInteractions(sid)
+              const abortedAssistant = getSessionMsgs(sid).find(message => message.id === activeAssistantMessageId)
+                || [...getSessionMsgs(sid)].reverse().find(message => message.role === 'assistant' && message.isStreaming)
+              handleTerminalWorkspaceRunChange(sid, evt, abortedAssistant?.id)
+              if (abortedAssistant) updateMessage(sid, abortedAssistant.id, { isStreaming: false })
               if ((evt as any).queue_length > 0) {
                 queueLengths.value.set(sid, (evt as any).queue_length)
                 setAbortState(sid, null)
@@ -4770,6 +4782,10 @@ export const useChatStore = defineStore('chat', () => {
           setAbortState(sid, { aborting: false, synced: (evt as any).synced ?? false })
           settleInterruptedSubagents(sid)
           clearPendingInteractions(sid)
+          const abortedAssistant = getSessionMsgs(sid).find(message => message.id === activeAssistantMessageId)
+            || [...getSessionMsgs(sid)].reverse().find(message => message.role === 'assistant' && message.isStreaming)
+          handleTerminalWorkspaceRunChange(sid, evt, abortedAssistant?.id)
+          if (abortedAssistant) updateMessage(sid, abortedAssistant.id, { isStreaming: false })
           if ((evt as any).queue_length > 0) {
             queueLengths.value.set(sid, (evt as any).queue_length)
             setAbortState(sid, null)
@@ -5300,6 +5316,24 @@ export const useChatStore = defineStore('chat', () => {
   onSessionTitleUpdated(applyGeneratedSessionTitle)
   onSessionWorkspaceUpdated(applySessionWorkspaceUpdate)

```

**File**: `packages/server/src/modules/coding-agents/services/cursor/stream-json.ts` (modified, +5/-0)
```diff
@@ -1,3 +1,5 @@
+import { normalizeUsageCost } from '../../../studio/public/usage'
+
 export type CursorStreamEvent =
   | { type: 'session'; sessionId: string; model?: string }
   | { type: 'text'; data: string }
@@ -79,6 +81,9 @@ function usageFromResult(event: any): unknown {
     : {}
   if (event.duration_ms != null) usage.duration_ms = event.duration_ms
   if (event.duration_api_ms != null) usage.duration_api_ms = event.duration_api_ms
+  const cost = normalizeUsageCost(event, 'estimated')
+  if (cost) Object.assign(usage, cost)
+  if (cost?.costSource === 'reported') usage.actual_cost_usd = cost.costUsd
   return Object.keys(usage).length > 0 ? usage : undefined
 }
 
```

**File**: `packages/server/src/modules/coding-agents/services/dsh/acp-turn.ts` (modified, +7/-2)
```diff
@@ -3,7 +3,8 @@ import { readFileSync } from 'node:fs'
 import { StringDecoder } from 'node:string_decoder'
 import type { CodingAgentImageInput } from '../../protocol/types'
 import { dshReasoningEffort } from './runtime-config'
-import { DSH_STREAM_METHOD } from './stream-plugin'
+import { DSH_STREAM_METHOD, DSH_USAGE_METHOD } from './stream-plugin'
+import { logger } from '../../../studio/public/logging'
 
 interface StreamedText { agent_message_chunk: string; agent_thought_chunk: string }
 
@@ -28,6 +29,7 @@ export class DshAcpTurn {
     update(update: any): void
     session(id: string): void
     config(options: any[]): void
+    usage?(event: any): void
     permissionRequired?: boolean
   }) {
     child.stdout?.on('data', (chunk: Buffer) => {
@@ -72,7 +74,10 @@ export class DshAcpTurn {
   private receive(message: any) {
     if (this.closed) return
     if (message.method) {
-      if (message.method === 'session/update' && message.params?.sessionId === this.sessionId) {
+      if (message.method === DSH_USAGE_METHOD && this.sessionId) {
+        try { this.callbacks.usage?.(message.params) }
+        catch (err) { logger.warn({ err }, '[dsh] failed to record native usage') }
+      } else if (message.method === 'session/update' && message.params?.sessionId === this.sessionId) {
         this.receiveUpdate(message.params.update)
       } else if (message.method === DSH_STREAM_METHOD && message.params?.sessionId === this.sessionId) {
         this.receiveStream(message.params.frame)
```

**File**: `packages/server/src/modules/coding-agents/services/dsh/chat-turn.ts` (modified, +15/-0)
```diff
@@ -7,6 +7,7 @@ import { updateManagedPromptFileSync } from '../prompt-file'
 import { isolatedCodingAgentChildEnv } from '../runtime/child-env'
 import { DshAcpTurn } from './acp-turn'
 import { DSH_MODEL_PROVIDER } from './runtime-config'
+import { normalizeTokenUsage, recordSessionUsage } from '../../../studio/public/usage'
 
 export interface DshTurnHost {
   spawn(command: string, args: string[], options: { cwd: string; pipeStdin: boolean; env: NodeJS.ProcessEnv }): ChildProcess
@@ -50,6 +51,20 @@ export function startDshChatTurn(run: ManagedCodingAgentRun, input: string, syst
   run.currentChild = child
   const turn = new DshAcpTurn(child, {
     permissionRequired: run.launch.approvalRequired,
+    usage: event => {
+      // Scoped calls are already owned by the provider proxy ledger.
+      if (run.launch.mode !== 'global' || !event || typeof event.requestId !== 'string' || !event.requestId) return
+      const usage = normalizeTokenUsage(event.usage)
+      if (usage.isEstimated) return
+      recordSessionUsage({
+        sessionId: run.launch.sessionId, runId: `dsh:${event.requestId}`,
+        parentRunId: run.usageRunId || run.id, source: 'coding_agent', agent: 'dsh',
+        profile: run.launch.profile, usageScope: 'model_call', apiCalls: 1,
+        apiDuration: event.apiDuration, usage,
+        model: typeof event.model === 'string' ? event.model : '',
+        provider: typeof event.provider === 'string' ? event.provider : '', isEstimated: false,
+      })
+    },
     session: id => {
       run.launch.agentNativeSessionId = id
       run.nativeResumeReady = true
```

**File**: `packages/server/src/modules/coding-agents/services/dsh/stream-plugin.ts` (modified, +27/-0)
```diff
@@ -1,9 +1,36 @@
 export const DSH_STREAM_METHOD = '_ekko/assistant_stream'
+export const DSH_USAGE_METHOD = '_ekko/model_usage'
 
 /** Loaded only in Studio's private ACP profile, never in the user's DSH install. */
 export const DSH_STREAM_PLUGIN = `
+import { randomUUID } from 'node:crypto'
 export const name = 'ekko-studio-assistant-stream'
 export function apply(ctx) {
+  // Includes compaction and child model calls, with the same disjoint buckets
+  // as DSH's TokenUsage contract. Never forward prompts, content or credentials.
+  ctx.on('llm/stream', async function* (options, next) {
+    const requestId = randomUUID()
+    const started = performance.now()
+    let usage
+    try {
+      for await (const chunk of next()) {
+        if (chunk.type === 'usage') usage = chunk.usage
+        yield chunk
+      }
+    } finally {
+      // Accounting must not turn a successful model stream into a failure, or
+      // replace its original error if serialization/the notification fails.
+      try { if (usage) process.stdout.write(JSON.stringify({
+        jsonrpc: '2.0', method: '${DSH_USAGE_METHOD}', params: {
+          requestId, sessionId: options.sessionId, model: options.model, provider: options.provider,
+          usage: { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens,
+            cacheReadTokens: usage.cacheReadTokens, cacheWriteTokens: usage.cacheWriteTokens,
+            reasoningTokens: usage.reasoningTokens },
+          apiDuration: (performance.now() - started) / 1000,
+        },
+      }) + '\\n') } catch { /* Usage stays unknown when reporting fails. */ }
+    }
+  })
   const attempts = new WeakMap()
   const notify = (session, frame) => process.stdout.write(JSON.stringify({
     jsonrpc: '2.0', method: '${DSH_STREAM_METHOD}',
```

#### Recent Merged Pull Requests:
- **PR #3292** (2026-10-05): [codex] bind P2P sockets to uplinks and publish Docker UDP ports (@EKKOLearnAI)
- **PR #3290** (2026-10-05): [codex] add authenticated direct App transport with relay fallback (@EKKOLearnAI)
- **PR #3289** (2026-10-05): [codex] release 0.7.30 and fix Copilot custom tool requests (@EKKOLearnAI)
- **PR #3288** (2026-10-04): [codex] avoid history loading for unsent chats (@EKKOLearnAI)
- **PR #3287** (2026-10-04): fix(coding-agents): launch Claude with IS_SANDBOX permission bypass (@wtj-0527)
- **PR #3286** (2026-10-04): [codex] fix Copilot streamed tool argument JSON (@EKKOLearnAI)
- **PR #3285** (2026-10-04): [codex] support coding agent images and Windows long prompts (@EKKOLearnAI)
- **PR #3284** (2026-10-04): [codex] default chats to Ekko and avoid CLI probes during creation (@EKKOLearnAI)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
