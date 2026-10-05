# Forensic Learning Record (Deep Inspection): iii-hq/iii

> **Canonical Artifact**: `07_PROJECT_LEARNING/iii-hq-iii-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/iii-hq/iii](https://github.com/iii-hq/iii))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:20:47.873Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `iii-hq/iii`
- **Description**: Effortlessly compose, extend, and observe every service in real-time for the first time ever.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md
- **Stars / Engagement**: 18825 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `console/packages/console-frontend/src/api/queues/index.ts`
```
export * from './queues'

```

### Core Architecture Module: `console/packages/console-frontend/src/api/queues/queues.ts`
```
import { getDevtoolsApi } from '../config'
import { unwrapResponse } from '../utils'

export interface QueueTopic {
  name: string
  broker_type: string
  subscriber_count: number
}

export interface QueueStats {
  depth: number
  consumer_count: number
  dlq_depth: number
  config: Record<string, unknown> | null
}

export interface QueueDetail {
  topic: string
  stats: QueueStats
}

export interface DlqTopic {
  topic: string
  broker_type: string
  message_count: number
}

export interface DlqMessage {
  id: string
  payload: unknown
  error: string
  failed_at: number
  retries: number
  size_bytes: number
}

export async function fetchQueues(): Promise<{ queues: QueueTopic[] }> {
  const res = await fetch(`${getDevtoolsApi()}/queues`)
  return unwrapResponse(res)
}

export async function fetchQueueDetail(topic: string): Promise<QueueDetail> {
  const res = await fetch(`${getDevtoolsApi()}/queues/${encodeURIComponent(topic)}`)
  return unwrapResponse(res)
}

export async function publishToQueue(topic: string, data: unknown): Promise<void> {
  const res = await fetch(`${getDevtoolsApi()}/queues/${encodeURIComponent(topic)}/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data }),
  })
  return unwrapResponse(res)
}

export async function fetchDlqTopics(): Promise<{ topics: DlqTopic[] }> {
  const res = await fetch(`${getDevtoolsApi()}/dlq`)
  return unwrapResponse(res)
}

export async function fetchDlqMessages(
  topic: string,
  offset = 0,
  limit = 50,
): Promise<{ topic: string; messages: DlqMessage[] }> {
  const res = await fetch(`${getDevtoolsApi()}/dlq/${encodeURIComponent(topic)}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ offset, limit }),
  })
  return unwrapResponse(res)
}

export async function redriveDlq(topic: string): Promise<{ queue: string; redriven: number }> {
  const res = await fetch(`${getDevtoolsApi()}/dlq/${encodeURIComponent(topic)}/redrive`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  return unwrapResponse(res)
}

export async function discardMessage(
  topic: string,
  messageId: string,
): Promise<{ queue: string; redriven: number }> {
  const res = await fetch(
    `${getDevtoolsApi()}/dlq/${encodeURIComponent(topic)}/messages/${encodeURIComponent(messageId)}/discard`,
    { method: 'DELETE' },
  )
  return unwrapResponse(res)
}

export async function redriveMessage(
  topic: string,
  messageId: string,
): Promise<{ queue: string; redriven: number }> {
  const res = await fetch(
    `${getDevtoolsApi()}/dlq/${encodeURIComponent(topic)}/messages/${encodeURIComponent(messageId)}/redrive`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    },
  )
  return unwrapResponse(res)
}

```

### Core Architecture Module: `console/packages/console-frontend/src/api/state/state.ts`
```
import { getDevtoolsApi } from '../config'
import { unwrapResponse } from '../utils'

// ============================================================================
// State Types
// ============================================================================

export interface StateItem {
  groupId: string
  key: string
  value: unknown
  type: string
  timestamp?: number
}

export interface StateGroup {
  id: string
  count: number
}

// ============================================================================
// State Functions (used functions only)
// ============================================================================

export async function fetchStateItems(
  groupId: string,
): Promise<{ items: StateItem[]; count: number }> {
  const res = await fetch(`${getDevtoolsApi()}/states/group`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scope: groupId }),
  })
  if (!res.ok) throw new Error('Failed to fetch state items')
  const data = await unwrapResponse<{ items: unknown[] }>(res)
  const items: StateItem[] = (data.items || []).map((item: unknown, index: number) => {
    const typedItem = item as Record<string, unknown>
    return {
      groupId,
      key: (typedItem.id as string) || `item-${index}`,
      value: item,
      type: typeof item === 'object' ? 'object' : typeof item,
      timestamp: Date.now(),
    }
  })
  return { items, count: items.length }
}

export async function fetchStateGroups(): Promise<{
  groups: StateGroup[]
  count: number
}> {
  const res = await fetch(`${getDevtoolsApi()}/states/groups`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) throw new Error('Failed to fetch state groups')
  const data = await unwrapResponse<{ groups: StateGroup[] }>(res)
  return { groups: data.groups || [], count: (data.groups || []).length }
}

export async function setStateItem(groupId: string, key: string, value: unknown): Promise<void> {
  const res = await fetch(`${getDevtoolsApi()}/states/${encodeURIComponent(groupId)}/item`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value }),
  })
  if (!res.ok) throw new Error('Failed to set state item')
}

export async function deleteStateItem(groupId: string, key: string): Promise<void> {
  const res = await fetch(
    `${getDevtoolsApi()}/states/${encodeURIComponent(groupId)}/item/${encodeURIComponent(key)}`,
    {
      method: 'DELETE',
    },
  )
  if (!res.ok) throw new Error('Failed to delete state item')
}

```

### Core Architecture Module: `console/packages/console-frontend/src/api/state/streams.ts`
```
import { getConfig, getDevtoolsApi } from '../config'
import { unwrapResponse } from '../utils'

// ============================================================================
// Stream Types
// ============================================================================

export interface StreamInfo {
  id: string
  type: string
  description: string
  groups: string[]
  status: string
  internal?: boolean
}

// ============================================================================
// Stream Functions (used functions only)
// ============================================================================

export async function fetchStreams(): Promise<{
  streams: StreamInfo[]
  count: number
  websocket_port: number
}> {
  console.log('[Streams API] Starting fetch from:', `${getDevtoolsApi()}/streams/list`)
  try {
    const res = await fetch(`${getDevtoolsApi()}/streams/list`, {
      method: 'GET',
    })

    if (!res.ok) {
      throw new Error(`Failed to fetch streams: ${res.statusText}`)
    }

    const data = await unwrapResponse(res)
    return data as {
      streams: StreamInfo[]
      count: number
      websocket_port: number
    }
  } catch (error) {
    console.error('[Streams API] ERROR:', error)
    // Fallback to empty list on error
    return {
      streams: [],
      count: 0,
      websocket_port: getConfig().wsPort,
    }
  }
}

```

### Core Architecture Module: `console/packages/console-frontend/src/api/system/workers.ts`
```
import { getDevtoolsApi } from '../config'
import { unwrapResponse } from '../utils'

export interface WorkerMetrics {
  cpu_percent: number
  cpu_system_micros: number
  cpu_user_micros: number
  event_loop_lag_ms: number
  memory_external: number
  memory_heap_total: number
  memory_heap_used: number
  memory_rss: number
  runtime: string
  timestamp_ms: number
  uptime_seconds: number
}

export interface WorkerTelemetry {
  language: string | null
  project_name: string | null
  framework: string | null
}

export interface WorkerInfo {
  id: string
  name: string | null
  runtime: string | null
  version: string | null
  os: string | null
  ip_address: string
  status: string
  connected_at_ms: number
  function_count: number
  functions: string[]
  active_invocations: number
  latest_metrics: WorkerMetrics | null
  pid: number | null
  isolation: string | null
  telemetry: WorkerTelemetry | null
  internal?: boolean
}

export async function fetchWorkers(): Promise<{
  workers: WorkerInfo[]
  count: number
  timestamp: number
}> {
  const res = await fetch(`${getDevtoolsApi()}/workers`)
  if (!res.ok) throw new Error('Failed to fetch workers')
  const data = await unwrapResponse<{ workers: WorkerInfo[]; timestamp: number }>(res)
  // In-process/built-in workers (configuration, iii-telemetry, etc.) are reported
  // with `function_count` but no `functions` array. Normalize so the non-optional
  // `functions: string[]` contract holds for every consumer (e.g. the worker
  // detail page reads `worker.functions.length`).
  const workers = (data.workers || []).map((worker) => ({
    ...worker,
    functions: worker.functions ?? [],
  }))
  return {
    workers,
    count: workers.length,
    timestamp: data.timestamp,
  }
}

```

### Core Architecture Module: `console/packages/console-frontend/src/api/utils.ts`
```
import { getDevtoolsApi } from './config'

interface WrappedResponse<T> {
  status_code: number
  headers: [string, string][]
  body: T
}

const CORS_ERROR_MESSAGE =
  'Connection blocked by CORS. Check iii-engine CORS settings for this console origin.'

async function unwrapResponse<T>(res: Response): Promise<T> {
  const data = await res.json()

  if (data && typeof data === 'object' && 'status_code' in data && 'body' in data) {
    const wrapped = data as WrappedResponse<T>
    if (wrapped.status_code !== 200) {
      throw new Error(`API Error: ${JSON.stringify(wrapped.body)}`)
    }
    return wrapped.body
  }

  return data as T
}

export function isCorsLikeFetchError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  if (error.name === 'AbortError') {
    return false
  }

  const message = error.message.toLowerCase()

  return (
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('cors') ||
    message.includes('cross-origin') ||
    message.includes('access-control-allow-origin')
  )
}

export function getConnectionErrorMessage(error: unknown, fallback = 'Network error'): string {
  if (isCorsLikeFetchError(error)) {
    return CORS_ERROR_MESSAGE
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallback
}

export async function fetchWithFallback<T>(
  devtoolsPath: string,
  _managementPath?: string,
  options?: RequestInit,
): Promise<T> {
  try {
    const res = await fetch(`${getDevtoolsApi()}${devtoolsPath}`, options)
    if (!res.ok) {
      throw new Error(`Failed to fetch from ${devtoolsPath}: ${res.status}`)
    }
    return await unwrapResponse<T>(res)
  } catch (error) {
    throw new Error(getConnectionErrorMessage(error))
  }
}

export type { WrappedResponse }
export { CORS_ERROR_MESSAGE, unwrapResponse }

```

### Core Architecture Module: `console/packages/console-frontend/src/components/flow/nodes/queue-node.tsx`
```
import { ListOrdered } from 'lucide-react'
import type { NodeData } from '../../../api/flows/types'
import { BaseNode } from './base-node'

export function QueueFlowNode({ data }: { data: NodeData }) {
  const queueTrigger = data.triggers?.find((t) => t.type === 'durable:subscriber')

  return (
    <BaseNode
      data={data}
      variant="durable:subscriber"
      title={data.name}
      subtitle={data.description}
      disableSourceHandle={!data.emits?.length && !data.virtualEmits?.length}
      disableTargetHandle={!data.subscribes?.length && !data.virtualSubscribes?.length}
    >
      {queueTrigger?.topic && (
        <div className="text-[10px] text-[#9CA3AF] flex items-center gap-1.5 font-mono">
          <ListOrdered className="w-3 h-3" /> {queueTrigger.topic}
        </div>
      )}
    </BaseNode>
  )
}

```

### Core Architecture Module: `console/packages/console-frontend/src/components/flow/nodes/state-node.tsx`
```
import type { NodeData } from '../../../api/flows/types'
import { BaseNode } from './base-node'

export function StateFlowNode({ data }: { data: NodeData }) {
  return (
    <BaseNode
      data={data}
      variant="state"
      title={data.name}
      subtitle={data.description}
      disableSourceHandle={!data.emits?.length && !data.virtualEmits?.length}
      disableTargetHandle={!data.subscribes?.length && !data.virtualSubscribes?.length}
    />
  )
}

```

### Core Architecture Module: `console/packages/console-frontend/src/components/flow/use-flow-state.ts`
```
import {
  type Edge,
  type Node,
  type OnNodesChange,
  useEdgesState,
  useNodesState,
} from '@xyflow/react'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { saveFlowConfig } from '../../api/flows/flows'
import type { FlowConfigResponse, FlowResponse, NodeConfig, NodeData } from '../../api/flows/types'
import { ApiFlowNode } from './nodes/api-node'
import { CronFlowNode } from './nodes/cron-node'
import { EventFlowNode } from './nodes/event-node'
import { NoopFlowNode } from './nodes/noop-node'
import { QueueFlowNode } from './nodes/queue-node'
import { StateFlowNode } from './nodes/state-node'

const DEFAULT_CONFIG: NodeConfig = { x: 0, y: 0 }

const NODE_TYPES = {
  event: EventFlowNode,
  http: ApiFlowNode,
  api: ApiFlowNode, // fallback
  noop: NoopFlowNode,
  cron: CronFlowNode,
  queue: QueueFlowNode, // fallback
  'durable:subscriber': QueueFlowNode,
  state: StateFlowNode,
}

function buildNodes(flow: FlowResponse, flowConfig: FlowConfigResponse): Node<NodeData>[] {
  return flow.steps.map((step) => {
    const cfg = step.filePath
      ? (flowConfig?.config[step.filePath] ?? DEFAULT_CONFIG)
      : DEFAULT_CONFIG
    return {
      id: step.id,
      type: step.type,
      position: { x: cfg.x, y: cfg.y },
      data: { ...step, nodeConfig: cfg },
    }
  })
}

function buildEdges(flow: FlowResponse): Edge[] {
  return flow.edges.map((edge) => ({
    ...edge,
    type: 'base',
  }))
}

export function useFlowState(flow: FlowResponse, flowConfig: FlowConfigResponse) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<NodeData>>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastSyncKeyRef = useRef<string>('')
  const isUserDragRef = useRef(false)

  const savePositions = useCallback(() => {
    setNodes((currentNodes) => {
      const config = currentNodes.reduce<FlowConfigResponse['config']>((acc, node) => {
        const data = node.data as NodeData
        if (data.filePath) {
          acc[data.filePath] = {
            x: Math.round(node.position.x),
            y: Math.round(node.position.y),
          }
          if (data.nodeConfig?.sourceHandlePosition) {
            acc[data.filePath].sourceHandlePosition = data.nodeConfig.sourceHandlePosition
          }
          if (data.nodeConfig?.targetHandlePosition) {
            acc[data.filePath].targetHandlePosition = data.nodeConfig.targetHandlePosition
          }
        }
        return acc
      }, {})

      saveFlowConfig(flow.id, { id: flow.id, config }).catch((err) =>
        console.error('Failed to save flow config:', err),
      )

      return currentNodes
    })
  }, [flow.id, setNodes])

  // Memoize config serialization -- only recomputes when flowConfig reference changes
  const configStr = useMemo(() => JSON.stringify(flowConfig?.config ?? {}), [flowConfig])

  // Sync nodes/edges from flow data - only when data actually changes
  useEffect(() => {
    if (!flow) return

    const syncKey = `${flow.id}:${flow.steps.length}:${flow.edges.length}:${configStr}`
    if (syncKey === lastSyncKeyRef.current) return
    lastSyncKeyRef.current = syncKey

    setNodes(buildNodes(flow, flowConfig))
    setEdges(buildEdges(flow))
  }, [flow, flowConfig, configStr, setNodes, setEdges])

  // Wrap onNodesChange to detect user-initiated drags
  const handleNodesChange: OnNodesChange<Node<NodeData>> = useCallback(
    (changes) => {
      const hasDrag = changes.some((c) => c.type === 'position' && c.dragging)
      const hasDragEnd = changes.some((c) => c.type === 'position' && !c.dragging)

      if (hasDrag) {
        isUserDragRef.current = true
      }

      onNodesChange(changes)

      // Save config only after user finishes dragging
      if (hasDragEnd && isUserDragRef.current) {
        isUserDragRef.current = false

        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
        saveTimeoutRef.current = setTimeout(() => savePositions(), 300)
      }
    },
    [onNodesChange, savePositions],
  )

  // Cleanup timeout on unmount -- flush pending save
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
        savePositions()
      }
    }
  }, [savePositions])

  return useMemo(
    () => ({
      nodes,
      edges,
      setNodes,
      onNodesChange: handleNodesChange,
      onEdgesChange,
      nodeTypes: NODE_TYPES,
      savePositions,
    }),
    [nodes, edges, setNodes, handleNodesChange, onEdgesChange, savePositions],
  )
}

```

### Core Architecture Module: `console/packages/console-frontend/src/components/queues/QueueDlqTab.tsx`
```
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  Inbox,
  RotateCcw,
  Trash2,
  XCircle,
} from 'lucide-react'
import { useState } from 'react'
import { dlqMessagesQuery } from '@/api/queries'
import type { DlqMessage, DlqTopic } from '@/api/queues/queues'
import { discardMessage, redriveDlq, redriveMessage } from '@/api/queues/queues'
import { Badge, Button } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { JsonViewer } from '@/components/ui/json-viewer'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip } from '@/components/ui/tooltip'
import { extractErrorMessage } from './dlq-error'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

interface QueueDlqTabProps {
  topic: string
  dlqEntry: DlqTopic | undefined
}

export function QueueDlqTab({ topic, dlqEntry }: QueueDlqTabProps) {
  const [expandedMessage, setExpandedMessage] = useState<string | null>(null)
  const [confirmDiscard, setConfirmDiscard] = useState<string | null>(null)
  const [redriveSuccess, setRedriveSuccess] = useState<string | null>(null)
  const [redriveError, setRedriveError] = useState<string | null>(null)
  const [confirmRedriveAll, setConfirmRedriveAll] = useState(false)

  const queryClient = useQueryClient()
  const { data: messagesData, isLoading } = useQuery({
    ...dlqMessagesQuery(topic),
    refetchInterval: 3000,
  })

  const messages = messagesData?.messages ?? []
  const expandedMsg = messages.find((m) => m.id === expandedMessage)

  const bulkRedriveMutation = useMutation({
    mutationFn: () => redriveDlq(topic),
    onSuccess: (data) => {
      setRedriveError(null)
      setRedriveSuccess(`Redrived ${data.redriven} messages to ${data.queue}`)
      setExpandedMessage(null)
      queryClient.invalidateQueries({ queryKey: ['dlq-topics'] })
      queryClient.invalidateQueries({ queryKey: ['dlq-messages'] })
      queryClient.invalidateQueries({ queryKey: ['queue-detail', topic] })
      setTimeout(() => setRedriveSuccess(null), 4000)
    },
    onError: (e: Error) => {
      setRedriveError(`Redrive failed: ${e.message}`)
      setTimeout(() => setRedriveError(null), 6000)
    },
  })

  const messageRedriveMutation = useMutation({
    mutationFn: (messageId: string) => redriveMessage(topic, messageId),
    onMutate: async (messageId) => {
      await queryClient.cancelQueries({ queryKey: ['dlq-messages', topic, 0, 50] })
      const prev = queryClient.getQueryData<{ topic: string; messages: DlqMessage[] }>([
        'dlq-messages',
        topic,
        0,
        50,
      ])
      if (prev) {
        queryClient.setQueryData(['dlq-messages', topic, 0, 50], {
          ...prev,
          messages: prev.messages.filter((m) => m.id !== messageId),
        })
      }
      if (expandedMessage === messageId) setExpandedMessage(null)
      return { prev }
    },
    onError: (_err, _messageId, context) => {
      if (context?.prev) {
        queryClient.setQueryData(['dlq-messages', topic, 0, 50], context.prev)
      }
      setRedriveError('Message redrive failed')
      setTimeout(() => setRedriveError(null), 4000)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['dlq-messages'] })
      queryClient.invalidateQueries({ queryKey: ['dlq-topics'] })
      queryClient.invalidateQueries({ queryKey: ['queue-detail', topic] })
    },
  })

  const discardMutation = useMutation({
    mutationFn: (messageId: string) => discardMessage(topic, messageId),
    onMutate: async (messageId) => {
      await queryClient.cancelQueries({ queryKey: ['dlq-messages', topic, 0, 50] })
      const prev = queryClient.getQueryData<{ topic: string; messages: DlqMessage[] }>([
        'dlq-messages',
        topic,
        0,
        50,
      ])
      if (prev) {
        queryClient.setQueryData(['dlq-messages', topic, 0, 50], {
          ...prev,
          messages: prev.messages.filter((m) => m.id !== messageId),
        })
      }
      if (expandedMessage === messageId) setExpandedMessage(null)
      return { prev }
    },
    onError: (_err, _messageId, context) => {
      if (context?.prev) {
        queryClient.setQueryData(['dlq-messages', topic, 0, 50], context.prev)
      }
      setRedriveError('Discard failed')
      setTimeout(() => setRedriveError(null), 4000)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['dlq-messages'] })
      queryClient.invalidateQueries({ queryKey: ['dlq-topics'] })
      queryClient.invalidateQueries({ queryKey: ['queue-detail', topic] })
    },
  })

  // Celebration only when DLQ entry explicitly has 0 messages (after redrive)
  // NOT when messages haven't loaded yet or API returned empty despite having a count
  const hasDlqEntry = dlqEntry !== undefined
  const isDlqCleared = hasDlqEntry && dlqEntry.message_count === 0

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {(['dlq-sk-0', 'dlq-sk-1', 'dlq-sk-2', 'dlq-sk-3', 'dlq-sk-4'] as const).map((sk) => (
          <div key={sk} className="flex items-center gap-4 px-4 py-3">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-8" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header with redrive + feedback */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-dark-gray/30">
        <div className="flex items-center gap-2 min-w-0">
          {redriveSuccess && (
            <div className="flex items-center gap-1.5 text-[10px] text-success font-mono animate-trace-flash">
              <CheckCircle className="w-3 h-3" />
              {redriveSuccess}
            </div>
          )}
          {redriveError && (
            <div className="flex items-center gap-1.5 text-[10px] text-error font-mono">
              <XCircle className="w-3 h-3" />
              {redriveError}
            </div>
          )}
        </div>
        {confirmRedriveAll ? (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-muted font-mono">
              Redrive all {messages.length} messages?
            </span>
            <Button
              variant="accent"
              size="sm"
              onClick={() => {
                bulkRedriveMutation.mutate()
                setConfirmRedriveAll(false)
              }}
              disabled={bulkRedriveMutation.isPending}
              className="h-7 text-xs gap-1.5"
            >
              Confirm
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmRedriveAll(false)}
              className="h-7 text-xs"
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="accent"
            size="sm"
            onClick={() => setConfirmRedriveAll(true)}
            disabled={bulkRedriveMutation.isPending || messages.length === 0}
            className="gap-1.5 shrink-0"
          >
            <RotateCcw
              className={`w-3 h-3 ${bulkRedriveMutation.isPending ? 'animate-spin' : ''}`}
            />
            Redrive All
          </Button>
        )}
      </div>

      {/* Message list or empty state */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {messages.length === 0 ? (
          isDlqCleared ? (
            <EmptyState
              icon={CheckCircle}
              variant="success"
              title="All clear"
              description="No dead letters for this queue"
            />
          ) : (
            <EmptyState
              icon={AlertTriangle}
              title="No failed messages"
              description="Messages that fail processing will appear here"
            />
          )
        ) : (
          <div className="divide-y divide-border/50">
            {messages.map((m) => {
              const isExpanded = m.id === expandedMessage
              const errorMsg = extractErrorMessage(m.error)

              return (
                <div key={m.id} className="group/row">
                  {/* Row */}
                  <div
                    className={`relative flex items-center transition-colors ${
                      isExpanded
                        ? 'bg-error/5 border-l-2 border-l-error'
                        : 'hover:bg-dark-gray/30 border-l-2 border-l-transparent'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedMessage(isExpanded ? null : m.id)}
                      className="flex-1 flex items-center gap-3 px-4 py-3 cursor-pointer text-left min-w-0"
                    >
                      <ChevronRight
                        className={`w-3.5 h-3.5 shrink-0 text-muted transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[13px] text-foreground truncate">
                            {m.id}
                          </span>
                          <Badge
                            variant={m.retries > 2 ? 'warning' : 'default'}
                            className="text-[10px] shrink-0"
                          >
                            {m.retries}x
                          </Badge>
                          <span className="font-mono text-[11px] text-muted shrink-0">
        
```

### Core Architecture Module: `console/packages/console-frontend/src/components/queues/QueueOverviewTab.tsx`
```
import { AlertTriangle, Inbox, Send, Settings, Users } from 'lucide-react'
import { useState } from 'react'
import type { QueueStats } from '@/api/queues/queues'
import { Button } from '@/components/ui/card'
import { JsonViewer } from '@/components/ui/json-viewer'

interface QueueOverviewTabProps {
  stats: QueueStats | undefined
  onPublish: (json: string) => void
  isPublishing: boolean
  publishError: string | null
  onClearPublishError: () => void
}

export function QueueOverviewTab({
  stats,
  onPublish,
  isPublishing,
  publishError,
  onClearPublishError,
}: QueueOverviewTabProps) {
  const [showPublish, setShowPublish] = useState(false)
  const [publishJson, setPublishJson] = useState('')

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-[var(--radius-lg)] bg-elevated border border-border-subtle p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Inbox className="w-3 h-3 text-muted" />
            <span className="font-sans font-semibold text-xs uppercase tracking-[0.04em] text-muted">
              Depth
            </span>
          </div>
          <div className="text-lg font-mono text-foreground">{stats?.depth ?? 0}</div>
        </div>
        <div className="rounded-[var(--radius-lg)] bg-elevated border border-border-subtle p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Users className="w-3 h-3 text-muted" />
            <span className="font-sans font-semibold text-xs uppercase tracking-[0.04em] text-muted">
              Consumers
            </span>
          </div>
          <div className="text-lg font-mono text-foreground">{stats?.consumer_count ?? 0}</div>
        </div>
        <div className="rounded-[var(--radius-lg)] bg-elevated border border-border-subtle p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <AlertTriangle
              className={`w-3 h-3 ${(stats?.dlq_depth ?? 0) > 0 ? 'text-error' : 'text-muted'}`}
            />
            <span className="font-sans font-semibold text-xs uppercase tracking-[0.04em] text-muted">
              DLQ
            </span>
          </div>
          <div
            className={`text-lg font-mono ${(stats?.dlq_depth ?? 0) > 0 ? 'text-error' : 'text-foreground'}`}
          >
            {stats?.dlq_depth ?? 0}
          </div>
        </div>
      </div>

      {/* Config */}
      {stats?.config && (
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Settings className="w-3 h-3 text-muted" />
            <span className="font-sans font-semibold text-xs uppercase tracking-[0.04em] text-muted">
              Configuration
            </span>
          </div>
          <div className="rounded-[var(--radius-lg)] bg-elevated border border-border-subtle p-3 overflow-x-auto max-h-64 overflow-y-auto">
            <JsonViewer data={stats.config} collapsed={true} maxDepth={4} />
          </div>
        </div>
      )}

      {/* Publish */}
      <div className="space-y-3">
        {!showPublish ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPublish(true)}
            className="w-full gap-2"
          >
            <Send className="w-3.5 h-3.5" />
            Publish Message
          </Button>
        ) : (
          <div className="space-y-3">
            <div>
              <div className="font-sans font-semibold text-xs uppercase tracking-[0.04em] text-muted mb-1.5">
                Payload
              </div>
              <div className="text-[10px] text-secondary mb-1">
                Type the JSON your subscriber will receive. The console wraps it in{' '}
                <code className="text-muted">{'{ data: ... }'}</code> automatically.
              </div>
              <textarea
                value={publishJson}
                onChange={(e) => {
                  setPublishJson(e.target.value)
                  onClearPublishError()
                }}
                className="w-full h-32 text-xs font-mono bg-black/40 text-foreground px-3 py-2 rounded border border-border focus:border-accent resize-none transition-colors"
                style={{ outline: 'none' }}
                placeholder='{"key": "value"}'
              />
            </div>
            {publishError && (
              <div className="flex items-center gap-2 text-[11px] text-error bg-error/10 border border-error/20 rounded px-3 py-2">
                <AlertTriangle className="w-3 h-3 shrink-0" />
                {publishError}
              </div>
            )}
            <div className="flex gap-2">
              <Button
                variant="accent"
                size="sm"
                onClick={() => onPublish(publishJson)}
                disabled={isPublishing}
                className="flex-1"
              >
                {isPublishing ? 'Publishing...' : 'Publish'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowPublish(false)
                  onClearPublishError()
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

```

### Core Architecture Module: `console/packages/console-frontend/src/components/queues/dlq-error.ts`
```
/**
 * Extract a human-readable message from the Rust `ErrorBody` debug format:
 * 'ErrorBody { code: "invocation_failed", message: "Simulated failure", stacktrace: ... }'
 *
 * The message may contain escaped quotes — worker-op errors embed a JSON
 * envelope like {"type":"WorkerOpError","code":"W105","message":"..."} — so
 * the regex matches escaped sequences instead of stopping at the first inner
 * quote, and JSON envelopes are unwrapped to `code: message`.
 */
/** DLQ error strings are worker/handler-supplied and render one per row, so
 * every path is length-capped to keep an oversized message out of the DOM. */
const MAX_ERROR_LEN = 100

function truncate(s: string): string {
  return s.length > MAX_ERROR_LEN ? `${s.slice(0, MAX_ERROR_LEN)}...` : s
}

export function extractErrorMessage(error: string): string {
  const msgMatch = error.match(/message:\s*"((?:[^"\\]|\\.)*)"/)
  if (msgMatch) {
    return truncate(humanizeEnvelope(unescapeJsonString(msgMatch[1])))
  }
  // The error may already be the bare JSON envelope (no Debug wrapper).
  const direct = humanizeEnvelope(error)
  if (direct !== error) return truncate(direct)
  // Fallback: a plain string, returned as-is (capped).
  return truncate(error)
}

/**
 * Decode the escape sequences captured from the Rust Debug `message: "..."`
 * field. The capture is the raw inner content (escapes intact), so parsing it
 * as a JSON string preserves `\n`, `\t`, `\uXXXX` instead of stripping the
 * backslash from every escape. Malformed input falls back to a minimal
 * quote-unescape so we never throw on worker-supplied text.
 */
function unescapeJsonString(inner: string): string {
  try {
    return JSON.parse(`"${inner}"`) as string
  } catch {
    return inner.replace(/\\"/g, '"')
  }
}

/** If `raw` is a worker-op JSON envelope, surface `code: message`; otherwise return it unchanged. */
function humanizeEnvelope(raw: string): string {
  if (!raw.startsWith('{')) return raw
  try {
    const parsed = JSON.parse(raw) as { code?: unknown; message?: unknown }
    if (typeof parsed.message === 'string') {
      return typeof parsed.code === 'string' ? `${parsed.code}: ${parsed.message}` : parsed.message
    }
  } catch {
    // not JSON — fall through
  }
  return raw
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1884** (2026-07-16): **Generated docker-compose .env not forwarded to engine; ${RABBITMQ_USER} unset at runtime**
  *Symptoms*: ## Summary  The generated `docker-compose.yml` does not forward the generated `.env` into the engine container, so `${VAR}` placeholders in `config.yaml` (for example the RabbitMQ credentials) are unset at runtime and the engine fails to boot once a user switches a worker to a remote adapter.  Tested on Linux with engine `0.19.4`.  ## Reproduction  1. `iii project init --docker` (generates `.env` with `RABBITMQ_USER=iii` / `RABBITMQ_PASS=...`). 2. Uncomment the `rabbitmq` service in `docker-compose.yml` and switch `iii-queue` to the `rabbitmq` adapter with `amqp://${RABBITMQ_USER}:${RABBITMQ_PASS}@rabbitmq:5672` in `config.yaml`. 3. `docker compose up`.  ## Actual  ``` Environment variable 'RABBITMQ_USER' not set ```  ## Expected  The credentials the generator wrote to `.env` should be available to the engine's `${VAR}` expansion.  ## Root cause  - The generator writes `.env` with the RabbitMQ creds: `engine/src/cli/project/mod.rs:390-402`. - `${VAR}` in `config.yaml` is expanded by the **engine process**, so the variable must be in the **container's** environment. - Docker Compose only uses `.env` to substitute the compose file itself; it does **not** inject those variables into the container unless the service declares `env_file:` (or an explicit `environment:` list). The generated `iii` service declares neither (templates in `iii-hq/templates`; mirrored at `engine/tests/fixtures/templates/docker/docker-compose.yml`).  ## Proposed fix  Add `env_file: .env` to the generated 
  **Post-Mortem & Fix Analysis**:
  > Fixed by https://github.com/iii-hq/iii/pull/1946 
  > The fix was released at 0.21.4 <img width="4146" height="2540" alt="Image" src="https://github.com/user-attachments/assets/e88519e9-33bc-46f8-a633-40bcb70fde45" /> 

- **Issue #1883** (2026-07-06): **docker compose up crash-loops on Linux: configuration worker can't create ./data (permission denied)**
  *Symptoms*: ## Summary  `iii project init --docker && docker compose up` crash-loops on a **Linux host** because the `configuration` worker cannot create its data directory. The generated `docker-compose.yml` mounts no writable data volume, and the published image runs as a non-root user (`65532`) with no writable `./data`.  Tested on Linux with engine `0.19.4`. (Often not reproducible on macOS Docker Desktop, whose file-sharing layer ignores UID ownership.)  ## Reproduction  ```bash iii project init --docker docker compose up ```  ## Actual  The engine exits on boot:  ``` failed to create configuration directory './data/configuration': Permission denied ```  …and restarts in a loop.  ## Expected  A fresh `init --docker` + `up` should boot and persist state with no manual edits.  ## Root cause  1. The `configuration` worker's `fs` adapter defaults to `./data/configuration`:     `engine/src/workers/configuration/adapters/fs.rs:38`    ```rust    pub(crate) const DEFAULT_DIRECTORY: &str = "./data/configuration";    ```    With `WORKDIR /app` (set by the generated Dockerfile), this resolves to `/app/data/configuration`.  2. `/app` is owned by root and the image runs as UID `65532` (base: `gcr.io/distroless/cc-debian12:nonroot`, `engine/Dockerfile`). The non-root user cannot create `/app/data`.  3. The generated compose mounts only `./config.yaml:ro` — there is **no writable data volume** (templates live in `iii-hq/templates`; mirrored at `engine/tests/fixtures/templates/docker/docker-compose

- **Issue #1752** (2026-06-23): **[Bug]: WebSocket connection for stream subscription returns 404 Not Found (v0.18.0, v0.11.2)**
  *Symptoms*: ### Description According to the `iii-stream` documentation, clients should be able to connect via WebSocket to receive real-time updates using the URL format `ws://host:3112/stream/<stream_name>/<group_id>/`. However, attempting to connect to this endpoint consistently returns a `404 Not Found` error.   ### Steps to Reproduce 1. Configure and run the `iii-stream` worker. 2. Attempt to establish a WebSocket connection using a client to: `ws://localhost:3112/stream/presence/room-1/` (as demonstrated in the usage example). 3. Observe the connection failure.  ### Expected Behavior The WebSocket connection should be successfully established, and the client should receive real-time updates when items in the stream change.   As stated in the official documentation: > "Clients connect via WebSocket to `ws://host:3112/stream/presence/room-1/` and receive real-time updates when items change."  ### Actual Behavior The server rejects the WebSocket connection and returns an HTTP `404 Not Found` error.  ### Environment - **iii-stream versions tested:** `v0.18.0` and `v0.11.2` - **Adapter:** redis  ### Additional Context Could you please clarify if the WebSocket routing URL has been updated in recent versions, or if there is an additional configuration required to expose this endpoint that is missing from the documentation?
  **Post-Mortem & Fix Analysis**:
  > hey, thanks for reporting. We'll try to reproduce this today and discuss the fix.
  > Hey @jarvisaoieong   That looks like an error in our documentation. You just need `hostname:3112` to connect to a websocket, no path.  What client are you using with it? The SDKs themselves can all register with the `stream` trigger like in this example using our browser SDK: https://iii.dev/docs/tutorials/linkly/frontend#subscribe-to-clicks . They'll then consume the stream without any additional work on your end. Other than syntax the process is the same across languages.  If you're using another websocket client then let me know and I can grab some instructions for you. This is overall a documentation gap though that we will address more extensively.  Also if you are still experiencing the issue can you share your iii-stream config and a code sample that reproduces the issue?
  > Hey @anthonyiscoding, thanks for getting back to me and for the clarification!  To answer your question: yes, I actually followed the tutorial for [using iii in the browser](https://iii.dev/docs/0-11-0/how-to/use-iii-in-the-browser). I implemented function_registration_prefix to give the worker functions registered by the frontend an independent namespace. That entire flow works smoothly without any issues.  However, my main concern is about scalability and stability. As our user base grows, the number of registered functions will become quite large. Furthermore, since these frontend functions will be frequently registered and unregistered, I'm worried that this constant churn might impact the stability or performance of the core iii engine.  Because of these concerns, I wanted to try connecting directly to the stream worker via WebSocket to evaluate the pros and cons of this approach as a potentially more stable alternative for our specific use case.  I will try connecting directly to

- **Issue #1513** (2026-04-21): **Quickstart failing**
  *Symptoms*: Following the quickstart documentation , the worker just die.  **System:**  ``` uname -a Linux jcatadev 6.17.0-20-generic #20~24.04.1-Ubuntu SMP PREEMPT_DYNAMIC Thu Mar 19 01:28:37 UTC 2 x86_64 x86_64 x86_64 GNU/Linux jcataluna@jcatadev:~/tmp/new-sapiens-api/quickstart$ lsb_release -a No LSB modules are available. Distributor ID: Ubuntu Description:    Ubuntu 24.04.4 LTS Release:        24.04 Codename:       noble jcataluna@jcatadev:~/tmp/new-sapiens-api/quickstart$ node --version v24.11.0 jcataluna@jcatadev:~/tmp/new-sapiens-api/quickstart$ python3 --version Python 3.12.3 jcataluna@jcatadev:~/tmp/new-sapiens-api/quickstart$ iii --version 0.11.1  ```  **iii start**  > iii --config config.yaml Initializing logging from config file: config.yaml Parsed config file: config.yaml Log level from config: info, Log format: default, OTel enabled: true OpenTelemetry initialized: exporter=memory (max_spans=10000), service_name=iii, sampling_ratio=1 [07:47:14.068 PM] [INFO] opentelemetry Global meter provider is set. Meters can now be created using global::meter() or global::meter_with_scope().     └ name: "MeterProvider.GlobalSet" [07:47:14.068 PM] [INFO] iii::workers::config Building engine with 3 workers [07:47:14.068 PM] [INFO] iii::workers::worker Initializing WorkerManager [07:47:14.069 PM] [INFO] opentelemetry_sdk Last reference of MeterProvider dropped, initiating shutdown.     └ name: "MeterProvider.Drop" [07:47:14.069 PM] [INFO] opentelemetry Global meter provider is set. Meters
  **Post-Mortem & Fix Analysis**:
  > Thanks for opening. We will look into this issue now.
  > just trying to debug it. double checking permissions on kvm       jcataluna@jcatadev:~/tmp/new-sapiens-api/quickstart$ ls -l /dev/kvm     crw-rw----+ 1 root kvm 10, 232 Apr 20 20:31 /dev/kvm     jcataluna@jcatadev:~/tmp/new-sapiens-api/quickstart$ groups     kvm adm cdrom sudo dip plugdev users lpadmin vboxusers ollama docker jcataluna  Error still there      jcataluna@jcatadev:~/tmp/new-sapiens-api/quickstart$ iii worker logs math-worker -f       Booting VM (2 vCPUs, 2048 MiB RAM)...      started (pid: 3029088)       ✓ source watcher online (pid: 3029089)     mount: /workspace/node_modules: must be superuser to use mount.            dmesg(1) may have more information after failed mount system call.
  > I think ive found something...  When the managed/math-worker files are created, they are created with my user default group, in my case: jcataluna:jcataluna. The kvm group must be the group owner of these files not my user group :jcataluna  if i execute:  1. stop iii 2. sudo chown -R jcataluna:kvm ~/.iii/managed/math-worker/ 3. delete worker entry on config.yaml 4. iii --config config.yaml 5. iii worker add ./workers/math-worker  this finally works!!!!    iii worker add ./workers/math-worker        → Adding math-worker (local)...        ✓ math-worker ready (pid 3133615)           engine:  running        config:  present type=local (/home/jcataluna/tmp/new-sapiens-api/quickstart/workers/math-worker)       sandbox:  prepared (rootfs + deps cached)       process:  alive pid=3133615          logs:  available (tail with `iii worker logs math-worker -f`)        ✓ ready in 6.0s

- **Issue #1508** (2026-04-21): **function.unregister() operation fails when using function_registration_prefix**
  *Symptoms*: After using Worker RBAC and setting `function_registration_prefix`, the frontend connects to the worker endpoint and successfully registers the function and trigger; all functionalities run normally. Only the `function.unregister()` operation fails, while `trigger.unregister()` works correctly.   I suspect that `function_registration_prefix` is not taking effect when calling `function.unregister()`.  iii version 0.11.0
  **Post-Mortem & Fix Analysis**:
  > @jarvisaoieong Thanks for the report! Do let us know if this fixed your bug. If not feel free to open a new issue.
  > It works. Thank you for the quick fix. It is an awesome framework.

- **Issue #1407** (2026-04-21): **Worker pool naming and count issue**
  *Symptoms*: There are two problems:   1. When start III engine clean, and then start III console. It register  two workers. e.g.  ``` [01:48:28.867 PM] [INFO] iii::workers Worker registered     ├ worker_id: dfcce8fa-9e64-47bd-a7f5-c7c8993ab444     └ ip_address: Some("192.168.64.1")  [01:48:28.868 PM] [INFO] iii::workers Worker registered     ├ worker_id: f988571d-c082-4ddc-8f15-a84fc7ee9336     └ ip_address: Some("192.168.64.1") ```  <img width="1626" height="721" alt="Image" src="https://github.com/user-attachments/assets/5a22c117-f6a7-439d-b048-1ae61be0b51d" />  In console, it shows as two worker pools, one of which is `unknown`. Can we please have a better name for console?   2. Once an extra nodejs worker connects to III engine, it shows as two worker pools   - node   - unknown  <img width="1630" height="139" alt="Image" src="https://github.com/user-attachments/assets/0c35ac19-f843-43a9-aaae-6e7f9b0ccb83" />  So now, there are 4 workers. This is very confusing.
  **Post-Mortem & Fix Analysis**:
  > Fixed in #1492, released in `iii/v0.11.2`.

- **Issue #1206** (2026-04-20): **flows defined in python are not shown in iii-console**
  *Symptoms*: ### Environment  iii-sdk==0.2.0;  motia[otel]==1.0.0rc17; python 3.12  ### Steps to Reproduce  1. define a python step, specify a flow in the config; make sure the flow only in python codes. 2. start the service 3. in iii-console, the python flow does not show in the 'flow' panel, only the flows configured in the ts steps shown.  ### Expected Behavior  all flows should show  ### Actual Behavior  only flows defined in ts steps show.  Why you only see hello-world-flow The console builds flows from /_console/functions. That endpoint only includes functions with metadata (specifically filePath, flows, etc.). Right now: - Node steps include metadata → show up in flows - Python steps register functions without metadata → console ignores them - So the console only renders hello-world-flow I verified this by calling /_console/functions and /_console/triggers: - /_console/triggers does include all Python triggers and shows flows: ["english-new-word-flow"] - /_console/functions does not include metadata for Python functions (only the two TS steps have metadata) This is a limitation of the current Python SDK (motia + iii-sdk 0.2.0). The Python SDK’s register_function doesn’t support metadata, so the engine never receives it. What you can do 1) Wait for a Python SDK update that supports function metadata and upgrade motia/iii-sdk together.   2) Live with Node‑only flows in the console for now (Python triggers still run fine).   3) Workaround: create TS “proxy” steps for visualization onl
  **Post-Mortem & Fix Analysis**:
  > Thanks for the issue! As an early tester, this helps a lot.
  > Hi 👋 I’ve reproduced the issue and traced it into the Python runtime implementation.  All step types (API, queue, cron, state, stream, join/leave, etc.) eventually call:      get_instance().register_function(function_id, handler)  The current `register_function` signature does not accept or forward any metadata (e.g., `flows`, `filePath`). As a result, when the console builds flows from `/_console/functions`, Python-registered functions are missing the required metadata and therefore do not appear in the Flow panel.  In contrast, the TypeScript SDK includes metadata during function registration, which is why TS flows render correctly.  ### Proposed Fix  1. Extend `register_function` in the Python runtime to accept optional metadata:            def register_function(self, function_id, handler, metadata: Optional[Dict] = None):  2. Propagate step-level metadata (flows, filePath, etc.) from the step registration layer (`add_step` / setup layer) into `register_function`.  3. Include metad
  > Closing as part of the Motia becomes iii now. This issue references the legacy motia package/CLI/branding, which has been removed from the repository. If the underlying problem still reproduces against the current iii codebase, please open a new issue with updated reproduction steps referencing the current tooling. Thanks for the original report!  Migration guides: - Node.js: https://iii.dev/docs/changelog/0-11-0/migrating-from-motia-js - Python: https://iii.dev/docs/changelog/0-11-0/migrating-from-motia-py

- **Issue #1203** (2026-04-20): **Could not resolve "bun"**
  *Symptoms*: ### Environment  Windows 11 Bun 1.3.9  ### Steps to Reproduce  In step code  ``` import { SQL } from 'bun' ```  ```   - class: modules::shell::ExecModule     config:       watch:         - src/**/*.ts       exec:         - bun motia dev         - bun dist/index-dev.js ```  run `iii`, or just run `motia typegen`    ### Expected Behavior  Bun runtime without error  ### Actual Behavior  ``` [04:54:56.753 PM] [INFO] iii::modules::shell::exec Starting process: bun motia dev X [ERROR] Could not resolve "bun"      ./db/index.ts:2:20:       2 │ import { SQL } from 'bun'         ╵                     ~~~~~    You can mark the path "bun" as external to exclude it from the bundle,    which will remove this error and leave the unresolved path in the         bundle. ```  ### Relevant Logs/Console Output  ```shell  ```  ### Screenshots  _No response_  ### Motia Version  1.0.0-rc.25  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > @ #1238 
  > Closing as part of the Motia becomes iii now. This issue references the legacy motia package/CLI/branding, which has been removed from the repository. If the underlying problem still reproduces against the current iii codebase, please open a new issue with updated reproduction steps referencing the current tooling. Thanks for the original report!  Migration guides: - Node.js: https://iii.dev/docs/changelog/0-11-0/migrating-from-motia-js - Python: https://iii.dev/docs/changelog/0-11-0/migrating-from-motia-py

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

### Incident Patch 1: `4318fbfb` (2026-10-02)
**Commit Message**: fix(engine): reduce KV allocations and decouple heap maintenance (#2261)

**File**: `engine/Cargo.toml` (modified, +1/-1)
```diff
@@ -105,7 +105,7 @@ axum = { version = "0.8", features = ["ws", "macros"] }
 # sockets would otherwise leak fds.
 hyper = { version = "1", features = ["http1", "server"] }
 hyper-util = { version = "0.1", features = ["tokio", "service"] }
-serde = { version = "1", features = ["derive"] }
+serde = { version = "1", features = ["derive", "rc"] }
 serde_json = "1"
 rusqlite = { version = "0.40.2", features = ["bundled", "hooks"] }
 schemars = "0.8"
```

**File**: `engine/src/builtins/kv.rs` (modified, +133/-112)
```diff
@@ -22,6 +22,11 @@ use tokio::sync::RwLock;
 
 const KEY_FILE_EXTENSION: &str = "bin";
 
+// Immutable entries let persistence retain a consistent view without copying
+// each JSON tree. Public operations still return owned Values in insertion order.
+type Scope = IndexMap<String, Arc<Value>>;
+type Store = Arc<RwLock<HashMap<String, Scope>>>;
+
 /// Default persistence flush cadence (ms) for file-backed stores. Used when no
 /// `save_interval_ms` is configured at construction.
 const DEFAULT_SAVE_INTERVAL_MS: u64 = 5000;
@@ -92,7 +97,7 @@ fn index_from_path(path: &Path) -> Option<String> {
     decode_index(file_name)
 }
 
-fn load_store_from_dir(dir: &Path) -> HashMap<String, IndexMap<String, Value>> {
+fn load_store_from_dir(dir: &Path) -> HashMap<String, Scope> {
     let mut store = HashMap::new();
     let entries = match std::fs::read_dir(dir) {
         Ok(entries) => entries,
@@ -124,14 +129,14 @@ fn load_store_from_dir(dir: &Path) -> HashMap<String, IndexMap<String, Value>> {
                 continue;
             }
         };
-        let storage = match rkyv::from_bytes::<KeyStorage, rkyv::rancor::Error>(&bytes) {
+        let storage = match rkyv::access::<ArchivedKeyStorage, rkyv::rancor::Error>(&bytes) {
             Ok(storage) => storage,
             Err(err) => {
                 tracing::warn!(error = ?err, path = %path.display(), "failed to parse index file");
                 continue;
             }
         };
-        let value = match serde_json::from_str::<IndexMap<String, Value>>(&storage.0) {
+        let value = match serde_json::from_str::<Scope>(storage.0.as_str()) {
             Ok(value) => value,
             Err(err) => {
                 tracing::warn!(error = ?err, path = %path.display(), "failed to decode index value");
@@ -144,39 +149,42 @@ fn load_store_from_dir(dir: &Path) -> HashMap<String, IndexMap<String, Value>> {
     store
 }
 
-async fn persist_index_to_disk(
-    dir: &Path,
-    index: &str,
-    value: &IndexMap<String, Value>,
-) -> anyhow::Result<()> {
-    if let Err(err) = tokio::fs::create_dir_all(dir).await {
-        tracing::error!(error = ?err, path = %dir.display(), "failed to create storage directory");
-        return Err(err.into());
-    }
-
+// The blocking flush owns all disk/CPU work. Keep the existing archive format
+// and temporary-file/rename contract, without an additional full binary buffer.
+fn persist_index_to_disk(dir: &Path, index: &str, value: &Scope) -> anyhow::Result<()> {
+    use std::io::Write;
+    std::fs::create_dir_all(dir)?;
     let file_name = index_file_name(index);
     let path = dir.join(&file_name);
     let temp_path = dir.join(format!("{}.tmp", file_name));
     let json = serde_json::to_string(value)?;
-    let bytes = rkyv::to_bytes::<rkyv::rancor::Error>(&KeyStorage(json))?;
-
-    tokio::fs::write(&temp_path, bytes).await?;
-    tokio::fs::rename(&temp_path, &path).await?;
-
+    let file = std::fs::File::create(&temp_path)?;
+    let writer = rkyv::ser::writer::IoWriter::new(std::io::BufWriter::new(file));
+    let writer = rkyv::api::high::to_bytes_in::<_, rkyv::rancor::Error>(&KeyStorage(json), writer)?;
+    let mut buffered = writer.into_inner();
+    // Propagate write failures before rename (BufWriter::drop would hide them).
+    buffered.flush()?;
+    drop(buffered);
+    std::fs::rename(&temp_path, &path)?;
     Ok(())
 }
 
-async fn delete_index_from_disk(dir: &Path, index: &str) -> anyhow::Result<()> {
+fn delete_index_from_disk(dir: &Path, index: &str) -> anyhow::Result<()> {
     let path = dir.join(index_file_name(index));
-    match tokio::fs::remove_file(&path).await {
+    match std::fs::remove_file(&path) {
         Ok(()) => Ok(()),
         Err(err) if err.kind() == ErrorKind::NotFound => Ok(()),
         Err(err) => Err(err.into()),
     }
 }
 
+fn requeue(dirty: &Arc<RwLock<HashMap<String, DirtyOp>>>, index: String, op: DirtyOp) {
+    // A failed older write must never overwrite a newer mutation's intent.
+    dirty.blocking_write().entry(index).or_insert(op);
+}
+
 pub struct BuiltinKvStore {
-    store: Arc<RwLock<HashMap<String, IndexMap<String, Value>>>>,
+    store: Store,
     file_store_dir: Option<PathBuf>,
     dirty: Arc<RwLock<HashMap<String, DirtyOp>>>,
     /// Stop signal for the current save-loop instance. Replaced (and the prior
@@ -189,6 +197,9 @@ pub struct BuiltinKvStore {
     /// default, so clearing the runtime knob restores the adapter's configured
     /// cadence instead of silently dropping to 5000.
     default_interval: u64,
+    /// Shared by all save-loop generations. Owned by blocking disk work so an
+    /// aborted caller or hot reconfiguration cannot overlap temporary-file writes.
+    flush_lock: Arc<tokio::sync::Mutex<()>>,
 }
 
 impl BuiltinKvStore {
@@ -253,6 +264,7 @@ impl BuiltinKvStore {
             dirty,
             save_loop_stop: Arc::new(std::sync::Mutex::new(None)),
             default_interval: interval,
+            flush_lock:
```

**File**: `engine/src/builtins/kv_memory_tests.rs` (added, +492/-0)
```diff
@@ -0,0 +1,492 @@
+// Copyright Motia LLC and/or licensed to Motia LLC under one or more
+// contributor license agreements. Licensed under the Elastic License 2.0;
+// you may not use this file except in compliance with the Elastic License 2.0.
+// This software is patent protected. We welcome discussions - reach out at team@iii.dev
+// See LICENSE and PATENTS files for details.
+
+//! Regression coverage for shared snapshots and cancellation-safe persistence.
+use super::*;
+
+fn in_memory_store() -> BuiltinKvStore {
+    BuiltinKvStore::new(None)
+}
+use std::time::Duration;
+
+fn directory() -> PathBuf {
+    std::env::temp_dir().join(format!("builtin-kv-memory-{}", uuid::Uuid::new_v4()))
+}
+
+// Explicit flush tests own the lifecycle; no immediate background tick races them.
+fn manual_store(dir: &Path) -> BuiltinKvStore {
+    BuiltinKvStore {
+        store: Arc::new(RwLock::new(HashMap::new())),
+        file_store_dir: Some(dir.to_path_buf()),
+        dirty: Arc::new(RwLock::new(HashMap::new())),
+        save_loop_stop: Arc::new(std::sync::Mutex::new(None)),
+        flush_lock: Arc::new(tokio::sync::Mutex::new(())),
+        default_interval: 60_000,
+    }
+}
+
+async fn flush(store: &BuiltinKvStore) -> anyhow::Result<()> {
+    match &store.file_store_dir {
+        Some(dir) => {
+            BuiltinKvStore::flush_dirty(&store.store, &store.dirty, &store.flush_lock, dir).await
+        }
+        None => Ok(()),
+    }
+}
+
+fn read_legacy(dir: &Path, index: &str) -> IndexMap<String, Value> {
+    let bytes = std::fs::read(dir.join(index_file_name(index))).unwrap();
+    let value = rkyv::from_bytes::<KeyStorage, rkyv::rancor::Error>(&bytes).unwrap();
+    serde_json::from_str(&value.0).unwrap()
+}
+
+#[tokio::test]
+async fn shared_snapshot_survives_replacement_and_delete() {
+    let store = in_memory_store();
+    let initial = serde_json::json!({"payload":"x".repeat(65536)});
+    store.set("s".into(), "a".into(), initial.clone()).await;
+    store.set("s".into(), "b".into(), Value::Bool(true)).await;
+    let snapshot = store.store.read().await["s"].clone();
+    {
+        let live = store.store.read().await;
+        assert!(Arc::ptr_eq(&snapshot["a"], &live["s"]["a"]));
+    }
+    let result = store.set("s".into(), "a".into(), Value::Null).await;
+    assert_eq!(result.old_value, Some(initial.clone()));
+    assert_eq!(result.new_value, Value::Null);
+    store.delete("s".into(), "a".into()).await;
+    assert_eq!(snapshot["a"].as_ref(), &initial);
+    assert_eq!(store.list("s".into()).await, vec![Value::Bool(true)]);
+    let dir = directory();
+    persist_index_to_disk(&dir, "snapshot", &snapshot).unwrap();
+    assert_eq!(read_legacy(&dir, "snapshot")["a"], initial);
+    std::fs::remove_dir_all(dir).unwrap();
+}
+
+#[test]
+fn archive_is_byte_compatible_with_legacy_and_load_validates() {
+    let dir = directory();
+    let fixtures = [
+        IndexMap::<String, Value>::new(),
+        IndexMap::from([
+            (
+                "first".into(),
+                serde_json::json!({"s":"中文\n\\\"", "n":18446744073709551615u64}),
+            ),
+            (
+                "second".into(),
+                serde_json::json!([null,true,-7,1.25,{"payload":"x".repeat(8192)}]),
+            ),
+        ]),
+    ];
+    for (i, data) in fixtures.into_iter().enumerate() {
+        let legacy = rkyv::to_bytes::<rkyv::rancor::Error>(&KeyStorage(
+            serde_json::to_string(&data).unwrap(),
+        ))
+        .unwrap();
+        let shared: Scope = data
+            .iter()
+            .map(|(k, v)| (k.clone(), Arc::new(v.clone())))
+            .collect();
+        let index = format!("scope:{i}/中文");
+        persist_index_to_disk(&dir, &index, &shared).unwrap();
+        assert_eq!(
+            std::fs::read(dir.join(index_file_name(&index))).unwrap(),
+            legacy.as_slice()
+        );
+        assert_eq!(read_legacy(&dir, &index), data);
+        assert_eq!(load_store_from_dir(&dir)[&index], shared);
+        std::fs::write(dir.join(index_file_name(&format!("legacy-{i}"))), legacy).unwrap();
+        assert_eq!(load_store_from_dir(&dir)[&format!("legacy-{i}")], shared);
+    }
+    std::fs::write(dir.join("broken.bin"), b"broken").unwrap();
+    assert!(!load_store_from_dir(&dir).contains_key("broken"));
+    std::fs::remove_dir_all(dir).unwrap();
+}
+
+#[test]
+fn moved_array_preserves_json_contract() {
+    for items in [
+        vec![],
+        vec![Value::Null, serde_json::json!({"a":[1,true,"text"]})],
+    ] {
+        let old = serde_json::to_value(&items).unwrap();
+        let moved = Value::Array(items);
+        assert_eq!(old, moved);
+        assert_eq!(
+            serde_json::to_vec(&old).unwrap(),
+            serde_json::to_vec(&moved).unwrap()
+        );
+    }
+}
+
+#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
+async fn cancelled_flush_keeps_writer_exclusion_until_disk_work_finishes() {
+    let dir = directory();
+  
```

**File**: `engine/src/memory.rs` (modified, +215/-10)
```diff
@@ -6,14 +6,10 @@
 
 //! Give freed heap back to the operating system.
 //!
-//! glibc malloc keeps freed chunks inside its per-thread arenas and only
-//! returns the top of the main arena on its own. After a burst of small
-//! allocations, such as a span storm churning through the bounded hot span
-//! cache, the process keeps its peak RSS long after the live data is back
-//! under its cap: one Linkly run left the engine at 14 GB with 236 MB of
-//! spans in memory (MOT-4733). `malloc_trim(0)` walks every arena and
-//! `madvise`s the freed pages away, so the observability sweep calls
-//! [`release_freed_memory`] once a minute.
+//! glibc may retain freed pages inside allocator arenas after allocation bursts.
+//! The engine service owns one periodic maintenance task, independently of
+//! worker registration, observability configuration and worker reloads. This
+//! reclaims eligible pages; it neither limits live allocations nor prevents OOM.
 
 /// Resident set size of this process in bytes, read from `/proc/self/statm`.
 /// `None` where that file does not exist.
@@ -36,8 +32,8 @@ fn page_size() -> u64 {
 }
 
 /// Return freed heap pages to the OS. Returns the RSS before and after the
-/// trim, in bytes, on Linux with glibc; `None` where the allocator already
-/// releases memory on its own (musl, macOS, Windows) or RSS cannot be read.
+/// trim, in bytes, on Linux with glibc; `None` on unsupported targets or when
+/// RSS cannot be read. Other allocators may have different retention policies.
 ///
 /// Cheap on a small heap. On a heap that just churned through gigabytes it
 /// takes an arena lock at a time while it `madvise`s, so call it off the
@@ -59,3 +55,212 @@ pub fn release_freed_memory() -> Option<(u64, u64)> {
         None
     }
 }
+
+/// One task per EngineBuilder::serve lifetime, not per worker. Dropping the
+/// guard stops scheduling, including if serve is cancelled or returns early.
+pub(crate) struct HeapMaintenance {
+    shutdown: tokio::sync::watch::Sender<bool>,
+    task: Option<tokio::task::JoinHandle<()>>,
+}
+
+impl HeapMaintenance {
+    pub(crate) fn start() -> Self {
+        let (shutdown, rx) = tokio::sync::watch::channel(false);
+        #[cfg(all(target_os = "linux", target_env = "gnu"))]
+        let task = Some(tokio::spawn(run_maintenance(
+            rx,
+            std::time::Duration::from_secs(60),
+            std::sync::Arc::new(|| {
+                if let Some((before, after)) = release_freed_memory() {
+                    let released = before.saturating_sub(after);
+                    if released >= 64 << 20 {
+                        tracing::info!(
+                            released_mb = released >> 20,
+                            rss_mb = after >> 20,
+                            "returned freed heap to the OS"
+                        );
+                    }
+                }
+            }),
+        )));
+        #[cfg(not(all(target_os = "linux", target_env = "gnu")))]
+        let task = {
+            drop(rx);
+            None
+        };
+        Self { shutdown, task }
+    }
+
+    pub(crate) async fn stop(mut self) {
+        let _ = self.shutdown.send(true);
+        if let Some(task) = self.task.take()
+            && let Err(error) = task.await
+        {
+            tracing::warn!(%error, "heap maintenance task failed during shutdown");
+        }
+    }
+}
+
+impl Drop for HeapMaintenance {
+    fn drop(&mut self) {
+        // spawn_blocking cannot be aborted after starting. Let any current trim
+        // finish; the task checks this flag before scheduling another one.
+        let _ = self.shutdown.send(true);
+    }
+}
+
+#[cfg(any(test, all(target_os = "linux", target_env = "gnu")))]
+async fn run_maintenance(
+    mut shutdown: tokio::sync::watch::Receiver<bool>,
+    period: std::time::Duration,
+    sweep: std::sync::Arc<dyn Fn() + Send + Sync>,
+) {
+    let mut interval = tokio::time::interval(period);
+    interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
+    loop {
+        if *shutdown.borrow() {
+            break;
+        }
+        tokio::select! {
+            biased;
+            changed = shutdown.changed() => {
+                if changed.is_err() || *shutdown.borrow() { break; }
+            }
+            _ = interval.tick() => {
+                if *shutdown.borrow() { break; }
+                let sweep = sweep.clone();
+                if let Err(error) = tokio::task::spawn_blocking(move || sweep()).await {
+                    tracing::warn!(%error, "heap maintenance sweep failed");
+                }
+            }
+        }
+    }
+}
+
+#[cfg(test)]
+mod maintenance_tests {
+    use super::*;
+    use std::{
+        sync::{
+            Arc,
+            atomic::{AtomicUsize, Ordering},
+        },
+        time::Duration,
+    };
+
+    #[tokio::test]
+    async fn shutdown_before_start_never_sweeps() {
+        let (tx, rx) = tokio::sync::watch::channel(true);
+  
```

**File**: `engine/src/workers/config.rs` (modified, +6/-0)
```diff
@@ -980,6 +980,10 @@ impl EngineBuilder {
         // watcher's sender is the only one left (and it's dropped on exit).
         drop(config_change_tx);
 
+        // Process heap maintenance belongs to the engine, not any worker's
+        // enabled flag or reload lifecycle. Start only after fallible setup.
+        let heap_maintenance = crate::memory::HeapMaintenance::start();
+
         // Track fatal reload errors so we can exit with non-zero after teardown.
         let mut reload_error: Option<anyhow::Error> = None;
 
@@ -1013,6 +1017,8 @@ impl EngineBuilder {
         // a signal-triggered shutdown).
         let _ = global_shutdown_tx.send(true);
 
+        heap_maintenance.stop().await;
+
         // Teardown -- inline version of the old `destroy()`. Operates on the
         // local `running` Vec directly so we don't have to reconstruct `self`.
         tracing::warn!("Shutting down engine and destroying workers");
```

**File**: `engine/src/workers/observability/mod.rs` (modified, +1/-15)
```diff
@@ -4147,21 +4147,7 @@ impl Worker for ObservabilityWorker {
                                 archive.mark_degraded(error);
                             }
                         }
-                        // The hot cache is bounded, but glibc keeps the pages
-                        // its churn freed. Hand them back so RSS follows the
-                        // cache instead of the last burst (MOT-4733).
-                        if let Ok(Some((before, after))) =
-                            tokio::task::spawn_blocking(crate::memory::release_freed_memory).await
-                        {
-                            let released = before.saturating_sub(after);
-                            if released >= 64 << 20 {
-                                tracing::info!(
-                                    released_mb = released >> 20,
-                                    rss_mb = after >> 20,
-                                    "returned freed heap to the OS"
-                                );
-                            }
-                        }
+
                     }
                 }
             }
```

**File**: `engine/src/workers/stream/adapters/kv_store.rs` (modified, +1/-4)
```diff
@@ -84,10 +84,7 @@ impl StreamAdapter for BuiltinKvStoreAdapter {
         data: Value,
     ) -> anyhow::Result<StreamSetResult> {
         let index = self.gen_key(stream_name, group_id);
-        let result = self
-            .storage
-            .set(index, item_id.to_string(), data.clone())
-            .await;
+        let result = self.storage.set(index, item_id.to_string(), data).await;
 
         Ok(result)
     }
```

**File**: `engine/src/workers/stream/stream.rs` (modified, +30/-1)
```diff
@@ -1251,7 +1251,7 @@ impl StreamWorker {
                 }
             }
             None => match adapter.get_group(&stream_name, &group_id).await {
-                Ok(values) => FunctionResult::Success(serde_json::to_value(values).ok()),
+                Ok(values) => FunctionResult::Success(Some(Value::Array(values))),
                 Err(e) => {
                     tracing::error!(error = %e, "Failed to get group from stream");
                     FunctionResult::Failure(ErrorBody {
@@ -2815,4 +2815,33 @@ mod tests {
         assert!(message.contains(&format!("127.0.0.1:{port}")));
         assert!(message.contains("already in use"));
     }
+
+    #[tokio::test]
+    async fn list_preserves_complete_json_array_contract() {
+        // The public contract remains an array, including null, numeric and
+        // Unicode values and the empty case; allocation behavior is benchmarked.
+        let adapter = Arc::new(FakeStreamAdapter::default());
+        let expected = vec![
+            Value::Null,
+            serde_json::json!({"text":"中文\n\\\"","n":18446744073709551615u64}),
+            serde_json::json!([true, -7, 1.25]),
+        ];
+        *adapter.get_group_result.lock().unwrap() = Ok(expected.clone());
+        let worker = create_module_with_adapter(adapter.clone());
+        match worker
+            .list(StreamListInput {
+                stream_name: "s".into(),
+                group_id: "g".into(),
+            })
+            .await
+        {
+            FunctionResult::Success(Some(Value::Array(values))) => assert_eq!(values, expected),
+            _ => panic!("legacy list must remain a complete JSON array"),
+        }
+        *adapter.get_group_result.lock().unwrap() = Ok(Vec::new());
+        assert!(
+            matches!(worker.list(StreamListInput {stream_name:"s".into(),group_id:"g".into()}).await,
+            FunctionResult::Success(Some(Value::Array(values))) if values.is_empty())
+        );
+    }
 }
```

---

### Incident Patch 2: `101a4afc` (2026-10-02)
**Commit Message**: (MOT-4987) fix(observability): release capacity of truncated span attributes (#2264)

**File**: `engine/src/workers/observability/otel.rs` (modified, +52/-2)
```diff
@@ -615,9 +615,15 @@ fn sanitize_attributes(attributes: &mut [(String, String)]) {
 const PAYLOAD_ATTRIBUTE_KEY: &str = "iii.payload.json";
 const PAYLOAD_TRUNCATED_KEY: &str = "iii.payload.truncated";
 
+/// Marker appended to a cut attribute value: `…[truncated <N> bytes]`.
+const TRUNCATION_PREFIX: &str = "…[truncated ";
+const TRUNCATION_SUFFIX: &str = " bytes]";
+
 /// Cut `value` down to `max_bytes` on a char boundary and say how much went.
 /// Returns whether anything was cut. Zero disables the cap.
 fn truncate_attribute_value(value: &mut String, max_bytes: usize) -> bool {
+    use std::fmt::Write as _;
+
     if max_bytes == 0 || value.len() <= max_bytes {
         return false;
     }
@@ -626,11 +632,27 @@ fn truncate_attribute_value(value: &mut String, max_bytes: usize) -> bool {
         cut -= 1;
     }
     let removed = value.len() - cut;
-    value.truncate(cut);
-    value.push_str(&format!("…[truncated {removed} bytes]"));
+    let marker_len = TRUNCATION_PREFIX.len() + decimal_digits(removed) + TRUNCATION_SUFFIX.len();
+    // Build the result in an exact-size String: `String::truncate` would keep
+    // the source value's full capacity alive (MOT-4987).
+    let mut truncated = String::with_capacity(cut + marker_len);
+    truncated.push_str(&value[..cut]);
+    truncated.push_str(TRUNCATION_PREFIX);
+    write!(truncated, "{removed}").expect("writing to a String cannot fail");
+    truncated.push_str(TRUNCATION_SUFFIX);
+    *value = truncated;
     true
 }
 
+fn decimal_digits(mut value: usize) -> usize {
+    let mut digits = 1;
+    while value >= 10 {
+        value /= 10;
+        digits += 1;
+    }
+    digits
+}
+
 fn truncate_attributes(attributes: &mut Vec<(String, String)>, max_bytes: usize) {
     if max_bytes == 0 {
         return;
@@ -6502,6 +6524,26 @@ mod tests {
         assert_eq!(storage.dirty_len(), 1, "the post-clear span is still dirty");
     }
 
+    #[test]
+    fn truncated_attribute_value_releases_source_capacity() {
+        // Ingested values come from `to_string()`, so capacity == len. Cutting a
+        // 1 MiB value to the cap must not keep the 1 MiB buffer alive: the hot
+        // cache accounts `len()`, so retained capacity is invisible to its limit.
+        let mut value = "x".repeat(1024 * 1024);
+        assert!(value.capacity() >= 1024 * 1024);
+        assert!(truncate_attribute_value(&mut value, 64 * 1024));
+        assert_eq!(
+            value,
+            format!("{}…[truncated {} bytes]", "x".repeat(64 * 1024), 960 * 1024)
+        );
+        assert!(
+            value.capacity() <= value.len() + 64,
+            "retained capacity {} for len {}",
+            value.capacity(),
+            value.len()
+        );
+    }
+
     #[test]
     fn long_attribute_values_are_truncated_and_flagged() {
         let storage = InMemorySpanStorage::new(10);
@@ -6527,6 +6569,10 @@ mod tests {
             .find(|(key, _)| key == "big")
             .expect("big attribute")
             .1;
+        assert_eq!(
+            big,
+            &format!("{}…[truncated 139264 bytes]", "é".repeat(32 * 1024))
+        );
         assert!(big.len() <= 64 * 1024 + 40, "{} bytes", big.len());
         assert!(big.ends_with("bytes]"), "{}", &big[big.len() - 40..]);
         let event = &stored.events[0];
@@ -6536,6 +6582,10 @@ mod tests {
             .find(|(key, _)| key == "iii.payload.json")
             .expect("payload attribute")
             .1;
+        assert_eq!(
+            payload,
+            &format!("{}…[truncated 139264 bytes]", "x".repeat(64 * 1024))
+        );
         assert!(payload.len() <= 64 * 1024 + 40);
         assert!(payload.contains("…[truncated"));
         assert_eq!(
```

---

### Incident Patch 3: `8789bb92` (2026-10-02)
**Commit Message**: fix(sdk-rust): update async-trait for Rust 1.99 (#2266)

**File**: `Cargo.lock` (modified, +3/-3)
```diff
@@ -401,13 +401,13 @@ checksum = "8b75356056920673b02621b35afd0f7dda9306d03c79a30f5c56c44cf256e3de"
 
 [[package]]
 name = "async-trait"
-version = "0.1.89"
+version = "0.1.92"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "9035ad2d096bed7955a320ee7e2230574d28fd3c3a0f186cbea1ff3c7eed5dbb"
+checksum = "82f6aeea286b8eb4dd3431a1be1b59d290ace00f5bfd8e2a159bc2a05e2c1667"
 dependencies = [
  "proc-macro2",
  "quote",
- "syn 2.0.117",
+ "syn 3.0.6",
 ]
 
 [[package]]
```

**File**: `sdk/packages/rust/iii/Cargo.toml` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@ name = "iii_sdk"
 path = "src/lib.rs"
 
 [dependencies]
-async-trait = "0.1"
+async-trait = "0.1.92"
 futures-util = "0.3"
 hostname = "0.4"
 serde = { version = "1", features = ["derive"] }
```

---

### Incident Patch 4: `2c8976b2` (2026-09-30)
**Commit Message**: (MOT-4947) feat(engine): let engine::traces::spans leave out span events and links (#2259)

**File**: `engine/src/workers/observability/README.md` (modified, +1/-1)
```diff
@@ -221,7 +221,7 @@ All logging functions accept: `message` (string, required), `data` (object), `tr
 | Function                 | Description                                                                                                                                                                                                                                                                               |
 | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
 | `engine::traces::list`   | List one compact summary per trace. Child spans contribute aggregate status/counts and can be searched with `search_all_spans`; `attribute_projection` returns only requested arbitrary attributes. Supports the standard trace filters, sort, `offset`, and `limit`.                       |
-| `engine::traces::spans`  | List full stored span records, including attributes, events, and links. Accepts the same filters and pagination as the former span-list contract; use this only for detail/timeline consumers that need complete span payloads.                                                             |
+| `engine::traces::spans`  | List full stored span records, including attributes, events, and links. Accepts the same filters and pagination as the former span-list contract; use this only for detail/timeline consumers that need complete span payloads. `include_events: false` drops each span's events and links, which carry the invocation payloads, for a view that only draws spans.                                                             |
 | `engine::traces::tree`   | Retrieve a trace as a hierarchical span tree. Parameters: `trace_id` (required).                                                                                                                                                                                                          |
 | `engine::traces::clear`  | Clear all stored trace spans from memory.                                                                                                                                                                                                                                                 |
 
```

**File**: `engine/src/workers/observability/mod.rs` (modified, +81/-1)
```diff
@@ -94,6 +94,11 @@ pub struct TracesListInput {
     /// `engine::traces::spans` and `engine::traces::tree`.
     #[serde(default)]
     attribute_projection: Option<Vec<String>>,
+    /// `engine::traces::spans` only: `false` returns each span without its
+    /// `events` and `links`, where invocation payloads ride, for views that
+    /// draw spans without opening one. Defaults to true.
+    #[serde(default)]
+    include_events: Option<bool>,
 }
 
 #[derive(Serialize, Deserialize, Default, JsonSchema)]
@@ -2934,9 +2939,14 @@ impl ObservabilityWorker {
                     };
                 let tag_elapsed = tag_started.elapsed();
                 let serialization_started = Instant::now();
+                let include_events = input.include_events.unwrap_or(true);
                 let result_spans: Vec<Value> = spans
                     .into_iter()
-                    .map(|s| {
+                    .map(|mut s| {
+                        if !include_events {
+                            s.events.clear();
+                            s.links.clear();
+                        }
                         let tags = tags_by_trace_id
                             .get(&s.trace_id)
                             .cloned()
@@ -8013,6 +8023,7 @@ mod tests {
             include_internal: Some(false),
             search_all_spans: None,
             attribute_projection: None,
+            include_events: None,
         };
 
         let spans = match module.list_trace_spans(input).await {
@@ -8098,6 +8109,7 @@ mod tests {
             include_internal: Some(false),
             search_all_spans: None,
             attribute_projection: None,
+            include_events: None,
         };
 
         let order = |result: FunctionResult<TracesSpansResult, ErrorBody>| -> Vec<String> {
@@ -8227,6 +8239,7 @@ mod tests {
                 include_internal: Some(false),
                 search_all_spans: None,
                 attribute_projection: None,
+                include_events: None,
             })
             .await;
 
@@ -8451,6 +8464,7 @@ mod tests {
                 include_internal: Some(true),
                 search_all_spans: Some(true),
                 attribute_projection: None,
+                include_events: None,
             })
             .await;
 
@@ -8532,6 +8546,7 @@ mod tests {
                 include_internal: Some(true),
                 search_all_spans: Some(false),
                 attribute_projection: None,
+                include_events: None,
             })
             .await;
         match result_root_only {
@@ -8564,6 +8579,7 @@ mod tests {
                 include_internal: Some(true),
                 search_all_spans: Some(true),
                 attribute_projection: None,
+                include_events: None,
             })
             .await;
         match result_all {
@@ -8640,6 +8656,7 @@ mod tests {
                 include_internal: Some(true),
                 search_all_spans: Some(false),
                 attribute_projection: None,
+                include_events: None,
             })
             .await;
 
@@ -9116,6 +9133,7 @@ mod tests {
                 include_internal: Some(true),
                 search_all_spans: None,
                 attribute_projection: None,
+                include_events: None,
             })
             .await;
 
@@ -9137,6 +9155,66 @@ mod tests {
         }
     }
 
+    #[tokio::test]
+    #[serial]
+    async fn test_trace_spans_without_events_keep_everything_else() {
+        reset_observability_test_state();
+
+        let module = make_test_module(Arc::new(Engine::new()));
+        let span_storage = otel::get_span_storage().expect("span storage should exist");
+        span_storage.clear();
+        let mut span = make_span(
+            "t-1",
+            "s-1",
+            None,
+            "call tool",
+            "svc",
+            1,
+            2,
+            "ok",
+            vec![("iii.session.id", "s1")],
+        );
+        span.events = vec![otel::StoredSpanEvent {
+            name: "invocation".to_string(),
+            timestamp_unix_nano: 1,
+            attributes: vec![("iii.payload.json".to_string(), "{\"big\":true}".to_string())],
+        }];
+        span.links = vec![otel::StoredSpanLink {
+            trace_id: "t-0".to_string(),
+            span_id: "s-0".to_string(),
+            trace_state: None,
+            attributes: vec![],
+        }];
+        span_storage.add_spans(vec![span]);
+
+        let spans = |include_events: Option<bool>| {
+            module.list_trace_spans(TracesListInput {
+                trace_ids: Some(vec!["t-1".to_string()]),
+                include_events,
+                ..Default::default()
+            })
+        };
+        let only = |result: FunctionResult<TracesSpansResult, ErrorBody>| match result {
+            FunctionResult::Success(value) => {
+                assert_eq!(value.spans.len(), 1);
+                value.spans[0].clon
```

---

### Incident Patch 5: `62db0b60` (2026-09-30)
**Commit Message**: (MOT-4946) fix(engine): narrow filtered engine::traces::list through root keys and the attribute index (#2258)

**File**: `engine/src/workers/observability/mod.rs` (modified, +549/-79)
```diff
@@ -739,22 +739,111 @@ fn span_matches_attribute_pairs(span: &otel::StoredSpan, pairs: &[Vec<String>])
     })
 }
 
-/// Apply filters whose trace-summary semantics are determined entirely by the
-/// representative root. Returning `true` only means that the trace remains a
-/// candidate: aggregate status, duration/time and child-span searches are
-/// still evaluated after the candidate traces have been loaded in full.
+/// What a filtered trace list learns from the attribute index and the span
+/// names, before any payload is decoded.
+#[derive(Default)]
+struct IndexedListFilters {
+    /// Traces that can satisfy the `search_all_spans` name and attribute
+    /// filters; `None` leaves every trace a candidate.
+    traces: Option<HashSet<String>>,
+    /// Spans carrying every `attributes` pair, when the pairs apply to the
+    /// representative root alone (`search_all_spans` off).
+    representative_attributes: Option<HashSet<(String, String)>>,
+    /// Spans carrying any `exclude_attributes` pair.
+    excluded: HashSet<(String, String)>,
+}
+
+impl IndexedListFilters {
+    fn load(input: &TracesListInput) -> Self {
+        let search_all = input.search_all_spans.unwrap_or(false);
+        // Spans carrying every pair. A malformed pair matches no span, as in
+        // `span_matches_attribute_pairs`; no pairs match every span.
+        let with_attributes = input
+            .attributes
+            .as_deref()
+            .filter(|pairs| !pairs.is_empty())
+            .map(|pairs| {
+                let mut sets = pairs.iter().map(|pair| match pair.as_slice() {
+                    [key, value] => otel::get_query_span_keys_with_attribute(key, value),
+                    _ => HashSet::new(),
+                });
+                let first = sets.next().unwrap_or_default();
+                sets.fold(first, |mut all, set| {
+                    all.retain(|key| set.contains(key));
+                    all
+                })
+            });
+        let excluded = input
+            .exclude_attributes
+            .iter()
+            .flatten()
+            .filter_map(|pair| match pair.as_slice() {
+                [key, value] => Some(otel::get_query_span_keys_with_attribute(key, value)),
+                _ => None,
+            })
+            .flatten()
+            .collect();
+        if !search_all {
+            return Self {
+                traces: None,
+                representative_attributes: with_attributes,
+                excluded,
+            };
+        }
+
+        let attribute_traces: Option<HashSet<String>> =
+            with_attributes.map(|spans| spans.into_iter().map(|(trace_id, _)| trace_id).collect());
+        let named_traces = input
+            .name
+            .as_deref()
+            .map(|name| otel::get_query_trace_ids_with_span_name(&name.to_lowercase()));
+        let traces = match (attribute_traces, named_traces) {
+            (Some(mut attributed), Some(named)) => {
+                attributed.retain(|trace_id| named.contains(trace_id));
+                Some(attributed)
+            }
+            (attributed, named) => attributed.or(named),
+        };
+        Self {
+            traces,
+            representative_attributes: None,
+            excluded,
+        }
+    }
+}
+
+/// Apply the filters that the root keys and the attribute index decide,
+/// before any payload is decoded. Returning `true` only means that the trace
+/// remains a candidate: aggregate status, duration/time and the exact child
+/// span matches are still evaluated after the candidate traces have been
+/// loaded in full.
 fn trace_might_match_root_filters(
-    root_spans: &[otel::StoredSpan],
+    roots: &[trace_store::RootSpanKey],
     input: &TracesListInput,
     include_internal: bool,
+    indexed: &IndexedListFilters,
 ) -> bool {
-    let Some(representative) = representative_trace_span(root_spans) else {
+    let Some(representative) = roots.iter().min_by(|a, b| {
+        a.start_time_ns
+            .cmp(&b.start_time_ns)
+            .then_with(|| a.span_id.cmp(&b.span_id))
+    }) else {
         return false;
     };
 
+    // Search-all matches cover every span, internal ones included, so they
+    // hold whichever span ends up representing the trace.
+    if indexed
+        .traces
+        .as_ref()
+        .is_some_and(|traces| !traces.contains(&representative.trace_id))
+    {
+        return false;
+    }
+
     // After internal rows are removed, a non-internal child can become the
     // representative root. Keep these traces for the exact post-load pass.
-    if !include_internal && is_internal_span(representative) {
+    if !include_internal && representative.is_internal {
         return true;
     }
 
@@ -767,36 +856,28 @@ fn trace_might_match_root_filters(
         return false;
     }
 
-    let search_all = input.search_all_spans.unwrap_or(false);
-    if !search_all {
-        if let Some(name) = input.name.as_deref()
-      
```

**File**: `engine/src/workers/observability/otel.rs` (modified, +64/-0)
```diff
@@ -1005,6 +1005,14 @@ impl InMemorySpanStorage {
             .collect()
     }
 
+    /// Visit every hot span under the read lock without cloning it, for a
+    /// scan that keeps a few ids out of a cache of full payloads.
+    pub fn for_each_span(&self, mut visit: impl FnMut(&StoredSpan)) {
+        for slot in self.read().slots.values() {
+            visit(&slot.span);
+        }
+    }
+
     pub fn get_spans_by_trace_id(&self, trace_id: &str) -> Vec<StoredSpan> {
         let cache = self.read();
         match cache.by_trace.get(trace_id) {
@@ -1529,6 +1537,8 @@ pub(crate) fn get_query_root_span_keys() -> Vec<super::trace_store::RootSpanKey>
                     trace_id: span.trace_id,
                     span_id: span.span_id,
                     parent_span_id: span.parent_span_id,
+                    name: span.name,
+                    service_name: span.service_name,
                     start_time_ns: span.start_time_unix_nano,
                 },
             );
@@ -1564,6 +1574,60 @@ pub(crate) fn get_query_root_span_keys() -> Vec<super::trace_store::RootSpanKey>
     keys
 }
 
+/// `(trace_id, span_id)` of the spans carrying `key = value` in the hot +
+/// durable view, without decoding a payload. A hot row replaces its archived
+/// copy, as in every merged view, so a filter may reject on it.
+pub(crate) fn get_query_span_keys_with_attribute(
+    key: &str,
+    value: &str,
+) -> HashSet<(String, String)> {
+    let mut hot_keys = HashSet::new();
+    let mut matched = HashSet::new();
+    if let Some(storage) = get_span_storage() {
+        storage.for_each_span(|span| {
+            let span_key = (span.trace_id.clone(), span.span_id.clone());
+            if span
+                .attributes
+                .iter()
+                .any(|(candidate, found)| candidate == key && found == value)
+            {
+                matched.insert(span_key.clone());
+            }
+            hot_keys.insert(span_key);
+        });
+    }
+    if let Some(archive) = get_trace_disk_storage() {
+        match archive.span_keys_with_attribute(key, value) {
+            Ok(keys) => matched.extend(keys.into_iter().filter(|key| !hot_keys.contains(key))),
+            Err(error) => archive.mark_degraded(error),
+        }
+    }
+    matched
+}
+
+/// Trace ids with a span whose lowercased name contains `needle` (already
+/// lowercased), in the hot or the durable view, without decoding a payload.
+/// A superset: a trace counts when either copy of a span matches, so callers
+/// only narrow candidates with it.
+pub(crate) fn get_query_trace_ids_with_span_name(needle: &str) -> HashSet<String> {
+    let matches = |name: &str| name.to_lowercase().contains(needle);
+    let mut trace_ids = HashSet::new();
+    if let Some(storage) = get_span_storage() {
+        storage.for_each_span(|span| {
+            if matches(&span.name) {
+                trace_ids.insert(span.trace_id.clone());
+            }
+        });
+    }
+    if let Some(archive) = get_trace_disk_storage() {
+        match archive.trace_ids_with_span_name(matches) {
+            Ok(archived) => trace_ids.extend(archived),
+            Err(error) => archive.mark_degraded(error),
+        }
+    }
+    trace_ids
+}
+
 /// Parents of hot spans that are missing from the merged root-key view but
 /// stored in the archive. The archive side of that view holds only roots, so a
 /// hot child of an archived non-root span would otherwise pass as a dangling
```

**File**: `engine/src/workers/observability/trace_store.rs` (modified, +137/-5)
```diff
@@ -13,7 +13,7 @@
 use super::{config::TraceStorageConfig, otel::InMemorySpanStorage};
 use rusqlite::{Connection, ToSql, params, params_from_iter};
 use std::{
-    collections::{BTreeMap, HashSet},
+    collections::{BTreeMap, HashMap, HashSet},
     fs,
     path::{Path, PathBuf},
     sync::{
@@ -132,6 +132,8 @@ pub(crate) struct RootSpanKey {
     pub trace_id: String,
     pub span_id: String,
     pub parent_span_id: Option<String>,
+    pub name: String,
+    pub service_name: String,
     pub start_time_ns: u64,
     pub is_internal: bool,
 }
@@ -421,8 +423,8 @@ impl TraceDiskStore {
             .map_err(|err| database_error(&self.database_path, "root keys initialization", err))?;
         let epoch = self.epoch.load(Ordering::Acquire) as i64;
         let query = format!(
-            "SELECT s.trace_id, s.span_id, s.parent_span_id, s.start_time_ns,
-                    {INTERNAL_SPAN_PREDICATE_SQL} AS is_internal
+            "SELECT s.trace_id, s.span_id, s.parent_span_id, s.name, s.service_name,
+                    s.start_time_ns, {INTERNAL_SPAN_PREDICATE_SQL} AS is_internal
              FROM spans s
              WHERE s.epoch = ?1
                AND {ROOT_SPAN_PREDICATE_SQL}"
@@ -436,15 +438,92 @@ impl TraceDiskStore {
                     trace_id: row.get(0)?,
                     span_id: row.get(1)?,
                     parent_span_id: row.get(2)?,
-                    start_time_ns: row.get::<_, i64>(3)?.max(0) as u64,
-                    is_internal: row.get::<_, i64>(4)? != 0,
+                    name: row.get(3)?,
+                    service_name: row.get(4)?,
+                    start_time_ns: row.get::<_, i64>(5)?.max(0) as u64,
+                    is_internal: row.get::<_, i64>(6)? != 0,
                 })
             })
             .map_err(|err| format!("cannot query root keys: {err}"))?
             .collect::<Result<Vec<_>, _>>()
             .map_err(|err| format!("cannot read root key row: {err}"))
     }
 
+    /// `(trace_id, span_id)` of every archived span carrying `key = value`.
+    /// `span_attributes_lookup_idx` answers it without reading a payload.
+    pub(crate) fn span_keys_with_attribute(
+        &self,
+        key: &str,
+        value: &str,
+    ) -> Result<HashSet<(String, String)>, String> {
+        let mut connection = Connection::open(&self.database_path)
+            .map_err(|err| database_error(&self.database_path, "attribute lookup open", err))?;
+        configure_read_connection(&mut connection).map_err(|err| {
+            database_error(&self.database_path, "attribute lookup initialization", err)
+        })?;
+        let epoch = self.epoch.load(Ordering::Acquire) as i64;
+        let mut statement = connection
+            .prepare(
+                "SELECT trace_id, span_id FROM span_attributes
+                 WHERE epoch = ?1 AND key = ?2 AND value = ?3",
+            )
+            .map_err(|err| format!("cannot prepare attribute lookup: {err}"))?;
+        statement
+            .query_map(params![epoch, key, value], |row| {
+                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
+            })
+            .map_err(|err| format!("cannot query attribute lookup: {err}"))?
+            .collect::<Result<HashSet<_>, _>>()
+            .map_err(|err| format!("cannot read attribute lookup row: {err}"))
+    }
+
+    /// Trace ids of the archived spans whose name satisfies `matches`, read
+    /// from the `name` column ahead of `payload`, so no JSON is decoded and no
+    /// overflow page is read. Each distinct name is tested once.
+    pub(crate) fn trace_ids_with_span_name(
+        &self,
+        matches: impl Fn(&str) -> bool,
+    ) -> Result<HashSet<String>, String> {
+        let mut connection = Connection::open(&self.database_path)
+            .map_err(|err| database_error(&self.database_path, "span name scan open", err))?;
+        configure_read_connection(&mut connection).map_err(|err| {
+            database_error(&self.database_path, "span name scan initialization", err)
+        })?;
+        let epoch = self.epoch.load(Ordering::Acquire) as i64;
+        let mut statement = connection
+            .prepare("SELECT trace_id, name FROM spans WHERE epoch = ?1")
+            .map_err(|err| format!("cannot prepare span name scan: {err}"))?;
+        let mut rows = statement
+            .query(params![epoch])
+            .map_err(|err| format!("cannot query span name scan: {err}"))?;
+        let mut verdicts = HashMap::<String, bool>::new();
+        let mut trace_ids = HashSet::new();
+        while let Some(row) = rows
+            .next()
+            .map_err(|err| format!("cannot read span name scan row: {err}"))?
+        {
+            let name = row
+                .get_ref(1)
+                .and_then(|value| value.as_str().map_err(Into::into))
+                .map_err(|err| format!("cannot read span name: {err}"))?;
+            let matched = match verdicts.get(name) {
+          
```

---

### Incident Patch 6: `53a9ddf9` (2026-09-30)
**Commit Message**: (MOT-4941) fix(engine): page engine::traces::list over root keys instead of decoding every root (#2256)

**File**: `engine/src/workers/observability/mod.rs` (modified, +198/-6)
```diff
@@ -2415,26 +2415,29 @@ impl ObservabilityWorker {
                 let query_input = input.clone();
                 let query_view = run_blocking_query("traces::list summary view", move || {
                     if unfiltered {
-                        let mut roots = otel::get_query_root_spans();
+                        // Keys only: sorting and paging never decode a
+                        // payload, so the cost tracks the root count rather
+                        // than the size of the stored history.
+                        let mut roots = otel::get_query_root_span_keys();
                         if !include_internal {
-                            roots.retain(|span| !is_internal_span(span));
+                            roots.retain(|root| !root.is_internal);
                         }
                         roots.sort_by(|a, b| {
                             let cmp = a
-                                .start_time_unix_nano
-                                .cmp(&b.start_time_unix_nano)
+                                .start_time_ns
+                                .cmp(&b.start_time_ns)
                                 .then_with(|| a.trace_id.cmp(&b.trace_id))
                                 .then_with(|| a.span_id.cmp(&b.span_id));
                             if sort_order_asc { cmp } else { cmp.reverse() }
                         });
                         let mut seen = HashSet::new();
-                        roots.retain(|span| seen.insert(span.trace_id.clone()));
+                        roots.retain(|root| seen.insert(root.trace_id.clone()));
                         let total = roots.len();
                         let trace_ids: Vec<String> = roots
                             .into_iter()
                             .skip(offset)
                             .take(limit)
-                            .map(|span| span.trace_id)
+                            .map(|root| root.trace_id)
                             .collect();
                         (otel::get_query_spans_by_trace_ids(&trace_ids), Some(total))
                     } else if let Some(trace_id) = query_trace_id {
@@ -9339,6 +9342,195 @@ mod tests {
         }
     }
 
+    #[tokio::test]
+    #[serial]
+    async fn test_trace_summaries_page_archived_roots_from_keys_one_row_per_trace() {
+        reset_observability_test_state();
+        let directory = tempfile::tempdir().expect("temp trace directory");
+        let _guard = attach_test_archive(directory.path());
+
+        let module = make_test_module(Arc::new(Engine::new()));
+        let span_storage = otel::get_span_storage().expect("span storage should exist");
+        span_storage.clear();
+        span_storage.add_spans(vec![
+            make_span("t-1", "r-1", None, "one", "svc", 1, 10, "ok", vec![]),
+            make_span(
+                "t-1",
+                "c-1",
+                Some("r-1"),
+                "one child",
+                "svc",
+                2,
+                9,
+                "ok",
+                vec![],
+            ),
+            // A second dangling root of the same distributed trace.
+            make_span(
+                "t-1",
+                "r-remote",
+                Some("remote-parent"),
+                "remote branch",
+                "svc",
+                3,
+                8,
+                "ok",
+                vec![],
+            ),
+            make_span("t-2", "r-2", None, "two", "svc", 20, 30, "ok", vec![]),
+            make_span(
+                "t-int",
+                "r-int",
+                None,
+                "internal",
+                "svc",
+                25,
+                26,
+                "ok",
+                vec![("function_id", "engine::traces::list")],
+            ),
+        ]);
+        flush_test_archive();
+        span_storage.clear();
+        // Hot-only: the newest trace, not archived yet.
+        span_storage.add_spans(vec![make_span(
+            "t-3",
+            "r-3",
+            None,
+            "three",
+            "svc",
+            40,
+            50,
+            "ok",
+            vec![],
+        )]);
+
+        let page = |offset: usize, limit: usize, order: &str, include_internal: bool| {
+            module.list_traces(TracesListInput {
+                offset: Some(offset),
+                limit: Some(limit),
+                sort_order: Some(order.to_string()),
+                include_internal: Some(include_internal),
+                ..Default::default()
+            })
+        };
+        let ids = |value: &TracesListResult| {
+            value
+                .traces
+                .iter()
+                .map(|trace| trace.trace_id.clone())
+                .collect::<Vec<_>>()
+        };
+
+        match page(0, 1, "asc", false).await {
+            FunctionResult::Success(value) => {
+                assert_eq!(value.total, 3, "one row per trace, internal excluded");
+                assert_eq!(ids(&
```

**File**: `engine/src/workers/observability/otel.rs` (modified, +100/-0)
```diff
@@ -1496,6 +1496,106 @@ pub fn get_query_root_spans() -> Vec<StoredSpan> {
     spans
 }
 
+/// `get_query_root_spans` without the payloads: the same hot overlay and
+/// dangling-parent rule over lightweight keys, for a listing that only sorts,
+/// dedupes and pages roots before reading the spans of one page. Decoding
+/// every archived root payload made each call cost the whole history.
+pub(crate) fn get_query_root_span_keys() -> Vec<super::trace_store::RootSpanKey> {
+    let started = Instant::now();
+    let mut merged = HashMap::<(String, String), super::trace_store::RootSpanKey>::new();
+    let mut archive_count = 0;
+    if let Some(archive) = get_trace_disk_storage() {
+        match archive.get_root_span_keys() {
+            Ok(keys) => {
+                archive_count = keys.len();
+                for key in keys {
+                    merged.insert((key.trace_id.clone(), key.span_id.clone()), key);
+                }
+            }
+            Err(error) => archive.mark_degraded(error),
+        }
+    }
+    let mut hot_count = 0;
+    let mut hot_keys = HashSet::new();
+    if let Some(storage) = get_span_storage() {
+        let hot = storage.get_spans();
+        hot_count = hot.len();
+        for span in hot {
+            hot_keys.insert((span.trace_id.clone(), span.span_id.clone()));
+            merged.insert(
+                (span.trace_id.clone(), span.span_id.clone()),
+                super::trace_store::RootSpanKey {
+                    is_internal: is_internal_span(&span.attributes),
+                    trace_id: span.trace_id,
+                    span_id: span.span_id,
+                    parent_span_id: span.parent_span_id,
+                    start_time_ns: span.start_time_unix_nano,
+                },
+            );
+        }
+    }
+
+    let present_span_ids: HashSet<String> =
+        merged.values().map(|key| key.span_id.clone()).collect();
+    let archived_parents = archived_parents_of_hot_spans(
+        merged
+            .values()
+            .map(|key| (&key.trace_id, &key.span_id, key.parent_span_id.as_ref())),
+        &hot_keys,
+        &present_span_ids,
+    );
+    let keys: Vec<_> = merged
+        .into_values()
+        .filter(|key| {
+            key.parent_span_id.as_ref().is_none_or(|parent| {
+                !present_span_ids.contains(parent)
+                    && !archived_parents.contains(&(key.trace_id.clone(), parent.clone()))
+            })
+        })
+        .collect();
+    tracing::debug!(
+        query_view = "root_span_keys",
+        archive_roots = archive_count,
+        hot_spans = hot_count,
+        result_roots = keys.len(),
+        elapsed_ms = started.elapsed().as_secs_f64() * 1_000.0,
+        "trace query view materialized"
+    );
+    keys
+}
+
+/// Parents of hot spans that are missing from the merged root-key view but
+/// stored in the archive. The archive side of that view holds only roots, so a
+/// hot child of an archived non-root span would otherwise pass as a dangling
+/// root and could stand for its trace in the list (a later start, or the one
+/// visible root of a trace whose real root is internal). Archived roots were
+/// already vetted by the SQL root predicate, so only hot spans are looked up.
+fn archived_parents_of_hot_spans<'a>(
+    spans: impl Iterator<Item = (&'a String, &'a String, Option<&'a String>)>,
+    hot_keys: &HashSet<(String, String)>,
+    present_span_ids: &HashSet<String>,
+) -> HashSet<(String, String)> {
+    let unresolved: Vec<(String, String)> = spans
+        .filter(|(trace_id, span_id, _)| {
+            hot_keys.contains(&((*trace_id).clone(), (*span_id).clone()))
+        })
+        .filter_map(|(trace_id, _, parent)| {
+            parent
+                .filter(|parent| !present_span_ids.contains(*parent))
+                .map(|parent| (trace_id.clone(), parent.clone()))
+        })
+        .collect();
+    match get_trace_disk_storage() {
+        Some(archive) => archive
+            .existing_span_keys(&unresolved)
+            .unwrap_or_else(|error| {
+                archive.mark_degraded(error);
+                HashSet::new()
+            }),
+        None => HashSet::new(),
+    }
+}
+
 /// The in-memory internal-span rule; must stay in lockstep with
 /// `INTERNAL_SPAN_PREDICATE_SQL` in the trace store.
 fn is_internal_span(attributes: &[(String, String)]) -> bool {
```

**File**: `engine/src/workers/observability/trace_store.rs` (modified, +107/-0)
```diff
@@ -124,6 +124,18 @@ impl TraceGroupRow {
     }
 }
 
+/// Identity and list order of one trace root, read without its payload: what
+/// `engine::traces::list` sorts, dedupes and filters on before it reads the
+/// spans of the page it returns.
+#[derive(Debug, Clone, PartialEq)]
+pub(crate) struct RootSpanKey {
+    pub trace_id: String,
+    pub span_id: String,
+    pub parent_span_id: Option<String>,
+    pub start_time_ns: u64,
+    pub is_internal: bool,
+}
+
 /// A trace tag attribute with just enough ordering metadata to reconstruct
 /// the existing "newest span wins" rule without deserializing span payloads.
 #[derive(Debug, Clone)]
@@ -398,6 +410,41 @@ impl TraceDiskStore {
         Ok(self.decode_payloads(rows))
     }
 
+    /// Every archived root's key, with root and internal detection in SQL.
+    /// Selects only columns stored ahead of `payload`, so no JSON is decoded
+    /// and no payload overflow page is read: the cost tracks the number of
+    /// roots, not the size of the history.
+    pub(crate) fn get_root_span_keys(&self) -> Result<Vec<RootSpanKey>, String> {
+        let mut connection = Connection::open(&self.database_path)
+            .map_err(|err| database_error(&self.database_path, "root keys open", err))?;
+        configure_read_connection(&mut connection)
+            .map_err(|err| database_error(&self.database_path, "root keys initialization", err))?;
+        let epoch = self.epoch.load(Ordering::Acquire) as i64;
+        let query = format!(
+            "SELECT s.trace_id, s.span_id, s.parent_span_id, s.start_time_ns,
+                    {INTERNAL_SPAN_PREDICATE_SQL} AS is_internal
+             FROM spans s
+             WHERE s.epoch = ?1
+               AND {ROOT_SPAN_PREDICATE_SQL}"
+        );
+        let mut statement = connection
+            .prepare(&query)
+            .map_err(|err| format!("cannot prepare root key read: {err}"))?;
+        statement
+            .query_map(params![epoch], |row| {
+                Ok(RootSpanKey {
+                    trace_id: row.get(0)?,
+                    span_id: row.get(1)?,
+                    parent_span_id: row.get(2)?,
+                    start_time_ns: row.get::<_, i64>(3)?.max(0) as u64,
+                    is_internal: row.get::<_, i64>(4)? != 0,
+                })
+            })
+            .map_err(|err| format!("cannot query root keys: {err}"))?
+            .collect::<Result<Vec<_>, _>>()
+            .map_err(|err| format!("cannot read root key row: {err}"))
+    }
+
     /// Read a chronological window of trace roots without decoding rows
     /// outside the window. Root and internal filtering happen in SQL so the
     /// default list view never materializes the full archive; callers merge
@@ -1937,6 +1984,66 @@ mod tests {
         store.shutdown();
     }
 
+    #[test]
+    fn root_keys_match_the_full_root_query_without_payloads() {
+        let directory = tempfile::tempdir().expect("temp trace directory");
+        let config = test_config(directory.path());
+        let store = TraceDiskStore::open(&config).expect("open trace store");
+        let hot = Arc::new(InMemorySpanStorage::new_with_limits(32, 1_000_000));
+        store.attach_hot_storage(&hot);
+
+        let mut root_a = test_span("trace-a", "root-a", "a");
+        root_a.start_time_unix_nano = 1_000;
+        let mut child_a = test_span("trace-a", "child-a", "a-child");
+        child_a.parent_span_id = Some("root-a".to_string());
+        child_a.start_time_unix_nano = 1_500;
+        // A second, dangling root of the same distributed trace.
+        let mut remote_a = test_span("trace-a", "remote-a", "a-remote");
+        remote_a.parent_span_id = Some("remote-span".to_string());
+        remote_a.start_time_unix_nano = 1_700;
+        let mut internal = test_span("trace-c", "root-c", "c");
+        internal.start_time_unix_nano = 3_000;
+        internal
+            .attributes
+            .push(("iii.function.kind".to_string(), "internal".to_string()));
+        hot.add_spans(vec![root_a, child_a, remote_a, internal]);
+        store.flush().expect("flush trace store");
+
+        let mut keys = store.get_root_span_keys().expect("read root keys");
+        keys.sort_by(|a, b| a.span_id.cmp(&b.span_id));
+        assert_eq!(
+            keys,
+            vec![
+                RootSpanKey {
+                    trace_id: "trace-a".to_string(),
+                    span_id: "remote-a".to_string(),
+                    parent_span_id: Some("remote-span".to_string()),
+                    start_time_ns: 1_700,
+                    is_internal: false,
+                },
+                RootSpanKey {
+                    trace_id: "trace-a".to_string(),
+                    span_id: "root-a".to_string(),
+                    parent_span_id: None,
+                    start_time_ns: 1_000,
+                    is_internal: false,
+                },
+                RootSpanKey {
+                    trace_id: "trace
```

---

### Incident Patch 7: `45ba3e41` (2026-09-29)
**Commit Message**: fix(compose): ignore empty shipped config defaults (#2252)

**File**: `crates/iii-compose/src/lifecycle.rs` (modified, +90/-14)
```diff
@@ -1358,6 +1358,34 @@ pub struct ResolvedConfig {
     pub name: String,
 }
 
+fn resolve_config_value(
+    shipped: Option<serde_yaml::Value>,
+    fetched: Option<serde_yaml::Value>,
+    overrides: Option<serde_yaml::Value>,
+) -> Option<serde_yaml::Value> {
+    // An empty published mapping means the package has no public default. Do
+    // not inject it before the worker can register its own runtime default.
+    let mut value = shipped.filter(
+        |value| !matches!(value, serde_yaml::Value::Mapping(mapping) if mapping.is_empty()),
+    );
+
+    if let Some(fetched) = fetched {
+        value = Some(match value {
+            Some(base) => merge(base, fetched),
+            None => fetched,
+        });
+    }
+
+    if let Some(overrides) = overrides {
+        value = Some(match value {
+            Some(base) => merge(base, overrides),
+            None => overrides,
+        });
+    }
+
+    value
+}
+
 /// Resolves the identity and merges package defaults, current values, and overrides.
 /// Injects the execution value into the service without persisting it, while
 /// service failures propagate rather than silently starting with stale defaults.
@@ -1388,20 +1416,8 @@ async fn resolve_config(
     }
     // Lowest to highest: package defaults, current active value, compose override.
     // NOT_FOUND contributes nothing; transport/service failures still fail boot.
-    let mut value = shipped;
-    if let Some(fetched) = ctx.engine.fetch_config(&name).await? {
-        value = Some(match value {
-            Some(base) => merge(base, fetched),
-            None => fetched,
-        });
-    }
-
-    if let Some(overrides) = &container.config_override {
-        value = Some(match value {
-            Some(base) => merge(base, overrides.clone()),
-            None => overrides.clone(),
-        });
-    }
+    let fetched = ctx.engine.fetch_config(&name).await?;
+    let value = resolve_config_value(shipped, fetched, container.config_override.clone());
 
     // GET supplies the current active value, not a forced reload from disk.
     // Omitting an override keeps that value, including after a worker restart.
@@ -1513,6 +1529,66 @@ containers:
         assert_eq!(err.code(), "UNKNOWN_CONTAINER");
     }
 
+    fn yaml(text: &str) -> serde_yaml::Value {
+        serde_yaml::from_str(text).expect("fixture should parse")
+    }
+
+    #[test]
+    fn an_empty_shipped_default_without_other_layers_is_not_injected() {
+        assert_eq!(resolve_config_value(Some(yaml("{}")), None, None), None);
+    }
+
+    #[test]
+    fn a_null_shipped_default_is_not_normalized() {
+        assert_eq!(
+            resolve_config_value(Some(serde_yaml::Value::Null), None, None),
+            Some(serde_yaml::Value::Null)
+        );
+    }
+    #[test]
+    fn an_empty_shipped_default_preserves_the_active_configuration() {
+        assert_eq!(
+            resolve_config_value(Some(yaml("{}")), Some(yaml("port: 5432")), None),
+            Some(yaml("port: 5432"))
+        );
+    }
+
+    #[test]
+    fn an_empty_shipped_default_preserves_the_compose_override() {
+        assert_eq!(
+            resolve_config_value(Some(yaml("{}")), None, Some(yaml("port: 6432"))),
+            Some(yaml("port: 6432"))
+        );
+    }
+
+    #[test]
+    fn a_real_shipped_default_preserves_layer_precedence() {
+        assert_eq!(
+            resolve_config_value(
+                Some(yaml("host: package\nport: 1111\n")),
+                Some(yaml("port: 2222\n")),
+                Some(yaml("port: 3333\n")),
+            ),
+            Some(yaml("host: package\nport: 3333\n"))
+        );
+    }
+
+    #[test]
+    fn an_explicit_empty_active_configuration_is_not_normalized() {
+        assert_eq!(
+            resolve_config_value(Some(yaml("{}")), Some(yaml("{}")), None),
+            Some(yaml("{}"))
+        );
+    }
+
+    #[test]
+    fn an_explicit_empty_override_is_not_normalized() {
+        assert_eq!(
+            resolve_config_value(Some(yaml("{}")), None, Some(yaml("{}"))),
+            Some(yaml("{}"))
+        );
+    }
+
     #[test]
     fn on_failure_does_not_retry_a_clean_exit_before_ready() {
         let error = ComposeError::ChildExitedBeforeReady {
```

**File**: `docs/next/cli-reference/index.mdx` (modified, +4/-6)
```diff
@@ -210,12 +210,10 @@ The engine sends anonymous usage data by default. This data helps to improve iii
 
 To turn the usage data off, do one of these:
 
-- Set `III_TELEMETRY_ENABLED` to `false`, `0`, `no`, or `off` before you start `iii`. Letter case does not matter, and leading or trailing spaces are ignored. Any other value, or no value, keeps the usage data on.
-- Create the file `~/.iii/telemetry_dev_optout`. The engine reads this file whenever the process starts.
-- Set `telemetry.enabled: false` in the engine configuration.
+- Set `III_TELEMETRY_ENABLED` to `false`, `0`, `no`, or `off` before you start `iii`. Letter case does not matter, and leading or trailing spaces are ignored. Any other value, or no value, keeps the usage data on. This disables both engine and `iii compose` product-usage reports.
+- Create the file `~/.iii/telemetry_dev_optout`. The engine and `iii compose` read this marker whenever the process starts.
+- Set `telemetry.enabled: false` in the engine configuration. This setting applies only to engine telemetry.
 
-The engine also turns the usage data off automatically if it detects that it is in a CICD environment.
-
-The `III_TELEMETRY_ENABLED` variable, the `~/.iii/telemetry_dev_optout` file, and CICD detection also turn off the usage data that `iii compose` sends. The `telemetry.enabled` engine setting applies only to the engine. When the engine's usage data is off, the engine discards usage reports from workers instead of storing them.
+The engine and `iii compose` also turn their product-usage data off automatically if they detect that they are running in a CICD environment. When engine telemetry is off, the engine discards usage reports from workers instead of storing them.
 
 This setting controls anonymous product-usage data only. It does not change OpenTelemetry observability (traces, metrics, and logs) for your own monitoring of your iii system.
```

**File**: `docs/next/cli-reference/index.mdx.skill.md` (modified, +4/-6)
```diff
@@ -208,12 +208,10 @@ The engine sends anonymous usage data by default. This data helps to improve iii
 
 To turn the usage data off, do one of these:
 
-- Set `III_TELEMETRY_ENABLED` to `false`, `0`, `no`, or `off` before you start `iii`. Letter case does not matter, and leading or trailing spaces are ignored. Any other value, or no value, keeps the usage data on.
-- Create the file `~/.iii/telemetry_dev_optout`. The engine reads this file whenever the process starts.
-- Set `telemetry.enabled: false` in the engine configuration.
+- Set `III_TELEMETRY_ENABLED` to `false`, `0`, `no`, or `off` before you start `iii`. Letter case does not matter, and leading or trailing spaces are ignored. Any other value, or no value, keeps the usage data on. This disables both engine and `iii compose` product-usage reports.
+- Create the file `~/.iii/telemetry_dev_optout`. The engine and `iii compose` read this marker whenever the process starts.
+- Set `telemetry.enabled: false` in the engine configuration. This setting applies only to engine telemetry.
 
-The engine also turns the usage data off automatically if it detects that it is in a CICD environment.
-
-The `III_TELEMETRY_ENABLED` variable, the `~/.iii/telemetry_dev_optout` file, and CICD detection also turn off the usage data that `iii compose` sends. The `telemetry.enabled` engine setting applies only to the engine. When the engine's usage data is off, the engine discards usage reports from workers instead of storing them.
+The engine and `iii compose` also turn their product-usage data off automatically if they detect that they are running in a CICD environment. When engine telemetry is off, the engine discards usage reports from workers instead of storing them.
 
 This setting controls anonymous product-usage data only. It does not change OpenTelemetry observability (traces, metrics, and logs) for your own monitoring of your iii system.
```

**File**: `scripts/generate-cli-docs.sh` (modified, +6/-9)
```diff
@@ -32,8 +32,8 @@ SKIP_FRONTEND_BUILD=1 cargo run --quiet -p iii-console -- gen-cli-docs --out "$T
 mkdir -p "$OUT_DIR"
 # The Telemetry section is hand-authored prose, not a clap tree, so it is
 # appended here after both generated fragments to sit at the bottom of the
-# page. Keep it in sync with the CLI's opt-out gate
-# (iii::workers::telemetry::environment::env_opt_out).
+# page. Keep it in sync with the engine and CLI/Compose product-usage gates
+# (`workers::telemetry::check_disabled` and `cli::telemetry::is_telemetry_disabled`).
 {
   cat "$TMP/iii.mdx"
   echo
@@ -48,18 +48,15 @@ The engine sends anonymous usage data by default. This data helps to improve iii
 
 To turn the usage data off, do one of these:
 
-- Set `III_TELEMETRY_ENABLED` to `false`, `0`, `no`, or `off` before you start `iii`. Letter case does not matter, and leading or trailing spaces are ignored. Any other value, or no value, keeps the usage data on.
-- Create the file `~/.iii/telemetry_dev_optout`. The engine reads this file whenever the process starts.
-- Set `telemetry.enabled: false` in the engine configuration.
+- Set `III_TELEMETRY_ENABLED` to `false`, `0`, `no`, or `off` before you start `iii`. Letter case does not matter, and leading or trailing spaces are ignored. Any other value, or no value, keeps the usage data on. This disables both engine and `iii compose` product-usage reports.
+- Create the file `~/.iii/telemetry_dev_optout`. The engine and `iii compose` read this marker whenever the process starts.
+- Set `telemetry.enabled: false` in the engine configuration. This setting applies only to engine telemetry.
 
-The engine also turns the usage data off automatically if it detects that it is in a CICD environment.
-
-The `III_TELEMETRY_ENABLED` variable, the `~/.iii/telemetry_dev_optout` file, and CICD detection also turn off the usage data that `iii compose` sends. The `telemetry.enabled` engine setting applies only to the engine. When the engine's usage data is off, the engine discards usage reports from workers instead of storing them.
+The engine and `iii compose` also turn their product-usage data off automatically if they detect that they are running in a CICD environment. When engine telemetry is off, the engine discards usage reports from workers instead of storing them.
 
 This setting controls anonymous product-usage data only. It does not change OpenTelemetry observability (traces, metrics, and logs) for your own monitoring of your iii system.
 TELEMETRY_MDX
 } > "$OUT_FILE"
-
 # Re-render the per-doc skill artifact (<page>.mdx.skill.md) that the
 # skill-check workflow verifies. Optional locally; CI's skill-check job is
 # the authority.
```

---

### Incident Patch 8: `ac897d96` (2026-09-29)
**Commit Message**: fix(compose): plan compose::update with the shared dependency planner (#2249)

**File**: `crates/iii-compose/src/daemon.rs` (modified, +584/-183)
```diff
@@ -23,8 +23,6 @@ use std::{
     time::Duration,
 };
 
-use futures::StreamExt;
-
 use tokio::sync::{Mutex, OnceCell};
 
 use crate::{
@@ -184,15 +182,6 @@ fn update_selector(explicit: Option<&str>, current: &str) -> String {
     explicit.unwrap_or(current).to_string()
 }
 
-fn graph_members(containers: &[crate::edit::NewContainer]) -> BTreeSet<String> {
-    containers
-        .iter()
-        .flat_map(|container| {
-            std::iter::once(container.key.clone()).chain(container.start_after.iter().cloned())
-        })
-        .collect()
-}
-
 /// Returns one root's reachable declarations after alias and instance reuse.
 fn graph_members_for_root(
     containers: &[crate::edit::NewContainer],
@@ -234,10 +223,67 @@ fn stale_graph_members(
         .collect()
 }
 
+/// Containers `compose::add` wrote as dependencies of another request.
+///
+/// `compose::add` marks every container it writes, including the worker that
+/// was asked for. That worker is a graph root in the lock and belongs to the
+/// operator like a hand-written declaration, so only marked containers that
+/// are not graph roots count as generated.
+fn generated_dependencies(
+    text: &str,
+    compose: &crate::ComposeFile,
+    graphs: &BTreeMap<String, BTreeSet<String>>,
+) -> Result<BTreeSet<String>> {
+    let mut generated = BTreeSet::new();
+    for (key, container) in &compose.containers {
+        if matches!(
+            container.worker,
+            crate::config::WorkerSource::Package { .. }
+        ) && !graphs.contains_key(key)
+            && crate::edit::is_generated_container(text, key)?
+        {
+            generated.insert(key.clone());
+        }
+    }
+    Ok(generated)
+}
+
+/// Every container one package brings up: its locked graph plus the
+/// dependencies the declarations name, transitively. The package is excluded.
+fn reached_from(
+    compose: &crate::ComposeFile,
+    graphs: &BTreeMap<String, BTreeSet<String>>,
+    root: &str,
+) -> BTreeSet<String> {
+    let mut visit: Vec<String> = compose
+        .containers
+        .get(root)
+        .map(|container| container.start_after.clone())
+        .unwrap_or_default();
+    visit.extend(graphs.get(root).into_iter().flatten().cloned());
+    let mut reached = BTreeSet::new();
+    while let Some(key) = visit.pop() {
+        if key == root || !reached.insert(key.clone()) {
+            continue;
+        }
+        if let Some(container) = compose.containers.get(&key) {
+            visit.extend(container.start_after.iter().cloned());
+        }
+    }
+    reached
+}
+
 /// Select declared packages when no worker specs were supplied.
+///
+/// Every package moves to its latest release, except a generated dependency
+/// another declared package reaches: it follows that package's graph, so the
+/// update cannot pull it past a release its dependents accept. A generated
+/// container nothing reaches is selected like any other package.
 fn workers_to_update(
     compose: &crate::ComposeFile,
     workers: &[String],
+    generated: &BTreeSet<String>,
+    graphs: &BTreeMap<String, BTreeSet<String>>,
 ) -> Result<Vec<crate::edit::NewContainer>> {
     if !workers.is_empty() {
         return workers
@@ -246,9 +292,23 @@ fn workers_to_update(
             .collect();
     }
 
+    let followers = compose
+        .containers
+        .iter()
+        .filter(|(_, container)| {
+            matches!(
+                container.worker,
+                crate::config::WorkerSource::Package { .. }
+            )
+        })
+        .flat_map(|(key, _)| reached_from(compose, graphs, key))
+        .filter(|key| generated.contains(key))
+        .collect::<BTreeSet<_>>();
+
     Ok(compose
         .containers
         .iter()
+        .filter(|(key, _)| !followers.contains(*key))
         .filter_map(|(key, container)| match &container.worker {
             crate::config::WorkerSource::Package { reference } => Some(crate::edit::NewContainer {
                 key: key.clone(),
@@ -264,6 +324,145 @@ fn workers_to_update(
         .collect())
 }
 
+/// Builds the registry roots of an update. The flag is true when every root is
+/// an explicit exact version the file already declares, so nothing resolves.
+fn update_roots(
+    compose: &crate::ComposeFile,
+    asked: &[crate::edit::NewContainer],
+) -> Result<(Vec<crate::edit::NewContainer>, bool)> {
+    let mut roots = Vec::with_capacity(asked.len());
+    let mut all_explicit_exact_unchanged = true;
+    for worker in asked {
+        let crate::edit::Source::Package { version, .. } = &worker.source else {
+            return Err(ComposeError::NotAPackageContainer {
+                container: worker.key.clone(),
+                kind: "path".to_string(),
+            });
+        };
+        let Some(container) = compose.containers.get(&worker.key) else {
+            return Err(ComposeError::UnknownContainer {
+                container: worker.key.clone(),
+            });
+        };
+    
```

**File**: `crates/iii-compose/src/dependencies.rs` (modified, +831/-71)
```diff
@@ -36,6 +36,9 @@ impl Package {
 struct Candidate {
     declaration: NewContainer,
     package: Option<Package>,
+    /// The worker a request named, rather than a node reached through the
+    /// graph of another request.
+    root: bool,
 }
 
 #[derive(Debug)]
@@ -53,9 +56,162 @@ pub(crate) struct Plan {
     pub selected_versions: BTreeMap<String, String>,
 }
 
+/// How a plan treats dependencies the compose file already declares.
+#[derive(Debug, Clone, Default)]
+pub(crate) enum Policy {
+    /// `compose::add`: a declared dependency keeps its declaration and pin;
+    /// the new worker only reuses its container.
+    #[default]
+    Add,
+    /// `compose::update`: declared dependencies follow the resolved graph.
+    /// Containers written by `compose::add` (`generated`) move to the exact
+    /// resolved version; an operator's selector is kept while the lock moves.
+    Update { generated: BTreeSet<String> },
+}
+
+/// The declarations an update may move, as written in the compose file.
+struct UpdateScope {
+    declared: BTreeMap<String, Source>,
+    generated: BTreeSet<String>,
+}
+
+impl UpdateScope {
+    /// How a declared dependency follows the release its graph selected: the
+    /// declaration to write and the exact version to lock, if the lock moves.
+    fn follow(
+        &self,
+        key: &str,
+        current: &Package,
+        resolved: &Package,
+    ) -> Result<(Source, Option<String>)> {
+        let version = &resolved.node.version;
+        let Some(Source::Package {
+            reference,
+            version: selector,
+        }) = self.declared.get(key)
+        else {
+            return Err(conflict(
+                key,
+                "the declared dependency is not a registry package",
+            ));
+        };
+        let selector_text = selector.as_deref().unwrap_or("*");
+        let exact = semver::Version::parse(selector_text).is_ok();
+        // compose::add pins every dependency it writes to an exact version. A
+        // generated container whose selector now reads as a tag or a range
+        // was changed by the operator, and that choice is kept below.
+        if exact && self.generated.contains(key) {
+            return Ok((
+                Source::Package {
+                    reference: reference.clone(),
+                    version: Some(version.clone()),
+                },
+                Some(version.clone()),
+            ));
+        }
+
+        let declared = Source::Package {
+            reference: reference.clone(),
+            version: selector.clone(),
+        };
+        let unchanged = current.node.same_release(&resolved.node);
+        let selector = selector_text;
+        if exact {
+            if unchanged {
+                return Ok((declared, None));
+            }
+            let reason = if current.node.version == *version {
+                format!(
+                    "the compose file pins '{key}' to {selector}, but the updated dependency graph needs \
+                     another artifact or default configuration of {version}. Run compose::update worker={key} first"
+                )
+            } else {
+                format!(
+                    "the compose file pins '{key}' to {selector}, but the updated dependency graph needs {version}. \
+                     Run compose::update worker={key}@{version} first"
+                )
+            };
+            return Err(conflict(key, &reason));
+        }
+        let requirement = semver::VersionReq::parse(selector).ok();
+        // A prerelease is compared as the release it leads to, so `^1.0`
+        // accepts `1.1.0-rc.1` and still refuses `2.0.0-rc.1`.
+        if let Some(requirement) = &requirement
+            && let Ok(parsed) = semver::Version::parse(version)
+            && !requirement.matches(&semver::Version::new(
+                parsed.major,
+                parsed.minor,
+                parsed.patch,
+            ))
+        {
+            return Err(conflict(
+                key,
+                &format!(
+                    "the compose file declares '{key}' as {selector}, but the updated dependency graph needs {version}. \
+                     Change the selector or run compose::update worker={key}@{version} first"
+                ),
+            ));
+        }
+        if unchanged {
+            return Ok((declared, None));
+        }
+        if requirement.is_none() {
+            crate::report::daemon_line(
+                &format!(
+                    "{key}: locked to {version}, the release the updated dependency graph needs; \
+                     its declared selector '{selector}' is kept"
+                ),
+                true,
+            );
+        }
+        Ok((declared, Some(version.clone())))
+    }
+}
+
+/// The package a reference names: its last path segment.
+fn package_name(reference: &str) -> &str {
+    reference
+        .rsplit_once('/')
+        .map_or(reference, |(_, name)|
```

**File**: `docs/using-iii/compose.mdx` (modified, +29/-3)
```diff
@@ -408,6 +408,10 @@ approximately the equivalent of `compose::down` followed by `compose::up`.
 
 `compose::update` without `worker` or `workers` updates every declared `package://` worker to its
 registry's latest version. It keeps each worker's registry reference and skips `path://` workers.
+A dependency that Compose generated for another declared package does not move to `latest` on its
+own. It follows the version that package's dependency graph selects. If no updated graph includes it
+any more but a worker outside the updated plan still lists it in `start_after`, Compose leaves it
+unchanged and prints a warning.
 
 ```bash
 iii trigger compose::update
@@ -419,9 +423,31 @@ iii trigger compose::update file=worker-compose.yaml
 `worker=state@<selector>` to change the selector. For example, use `worker=state@latest` to move an
 exact version to the registry's latest channel.
 
-Update resolves the complete dependency graph. It adds new dependencies, updates changed
-dependencies, and removes stale dependencies that Compose generated and no remaining package root
-uses. Manually declared workers are not removed.
+Update resolves the dependency graphs of all selected workers together, with the same planner as
+`compose::add`. A selected worker that another selected worker also needs is declared once, with the
+selector of its own update, and both graphs must agree on its release. Update adds new dependencies,
+updates changed dependencies, and removes stale dependencies that Compose generated when no updated
+graph includes them and no worker outside the updated graphs lists them in `start_after`. Removing a
+dependency also removes the `start_after` entries that point to it. Manually declared workers are not
+removed.
+
+Compose does not track ownership of individual `start_after` entries. An old edge on a container
+being updated does not protect a generated dependency that its new registry graph no longer needs;
+cleanup removes both that generated container and references to it. To keep a dependency independently
+of the registry graph, remove the `# added by compose::add` comment immediately above its container
+block before updating. Compose then treats that block as operator-owned and does not remove it as a
+stale generated dependency. Its `start_after` references remain intact.
+
+A declared dependency of a selected worker that is not selected itself follows the resolved graph:
+
+- A dependency that Compose generated with an exact version moves to the version the graph selects.
+- A dependency with a tag such as `latest`, or without a version, keeps its selector. The lock
+  records the version the graph selects.
+- A dependency with a range keeps it when the selected version satisfies the range. Otherwise the
+  update fails and names the version the graph needs.
+- A dependency that you pinned to an exact version stays pinned. If the graph needs another
+  version, the update fails and names the `compose::update worker=<name>@<version>` call that
+  moves it.
 
 Compose downloads and verifies the new artifact before it changes the lock or stops a worker. A
 failed resolve or download leaves the prior lock and running workers unchanged. If the resolved
```

**File**: `docs/using-iii/compose.mdx.skill.md` (modified, +29/-3)
```diff
@@ -402,6 +402,10 @@ approximately the equivalent of `compose::down` followed by `compose::up`.
 
 `compose::update` without `worker` or `workers` updates every declared `package://` worker to its
 registry's latest version. It keeps each worker's registry reference and skips `path://` workers.
+A dependency that Compose generated for another declared package does not move to `latest` on its
+own. It follows the version that package's dependency graph selects. If no updated graph includes it
+any more but a worker outside the updated plan still lists it in `start_after`, Compose leaves it
+unchanged and prints a warning.
 
 ```bash
 iii trigger compose::update
@@ -413,9 +417,31 @@ iii trigger compose::update file=worker-compose.yaml
 `worker=state@<selector>` to change the selector. For example, use `worker=state@latest` to move an
 exact version to the registry's latest channel.
 
-Update resolves the complete dependency graph. It adds new dependencies, updates changed
-dependencies, and removes stale dependencies that Compose generated and no remaining package root
-uses. Manually declared workers are not removed.
+Update resolves the dependency graphs of all selected workers together, with the same planner as
+`compose::add`. A selected worker that another selected worker also needs is declared once, with the
+selector of its own update, and both graphs must agree on its release. Update adds new dependencies,
+updates changed dependencies, and removes stale dependencies that Compose generated when no updated
+graph includes them and no worker outside the updated graphs lists them in `start_after`. Removing a
+dependency also removes the `start_after` entries that point to it. Manually declared workers are not
+removed.
+
+Compose does not track ownership of individual `start_after` entries. An old edge on a container
+being updated does not protect a generated dependency that its new registry graph no longer needs;
+cleanup removes both that generated container and references to it. To keep a dependency independently
+of the registry graph, remove the `# added by compose::add` comment immediately above its container
+block before updating. Compose then treats that block as operator-owned and does not remove it as a
+stale generated dependency. Its `start_after` references remain intact.
+
+A declared dependency of a selected worker that is not selected itself follows the resolved graph:
+
+- A dependency that Compose generated with an exact version moves to the version the graph selects.
+- A dependency with a tag such as `latest`, or without a version, keeps its selector. The lock
+  records the version the graph selects.
+- A dependency with a range keeps it when the selected version satisfies the range. Otherwise the
+  update fails and names the version the graph needs.
+- A dependency that you pinned to an exact version stays pinned. If the graph needs another
+  version, the update fails and names the `compose::update worker=<name>@<version>` call that
+  moves it.
 
 Compose downloads and verifies the new artifact before it changes the lock or stops a worker. A
 failed resolve or download leaves the prior lock and running workers unchanged. If the resolved
```

---

### Incident Patch 9: `f4c1ebcf` (2026-09-29)
**Commit Message**: (MOT-4927) fix(compose): let the musl build install glibc-only workers on a glibc host (#2250)

**File**: `crates/iii-compose/src/lockfile.rs` (modified, +60/-9)
```diff
@@ -431,17 +431,22 @@ fn package_declarations(compose: &ComposeFile) -> Vec<(String, String, String)>
 
 /// Compares the package fields that can change worker runtime behavior.
 fn runtime_package_changed(previous: &ResolvedPackage, next: &ResolvedPackage) -> bool {
-    let target = crate::registry::host_target();
+    runtime_package_changed_for(crate::registry::host_targets(), previous, next)
+}
+
+/// Each side's build is selected on its own: a lock that drops the musl
+/// build a musl host was running switches the worker to the glibc one, even
+/// when that glibc build did not change.
+fn runtime_package_changed_for(
+    candidates: &[&str],
+    previous: &ResolvedPackage,
+    next: &ResolvedPackage,
+) -> bool {
+    use crate::registry::selected_artifact;
     previous.kind != next.kind
         || previous.default_config != next.default_config
-        || previous
-            .artifacts
-            .get(target)
-            .map(|artifact| artifact.sha256.to_ascii_lowercase())
-            != next
-                .artifacts
-                .get(target)
-                .map(|artifact| artifact.sha256.to_ascii_lowercase())
+        || selected_artifact(candidates, &previous.artifacts)
+            != selected_artifact(candidates, &next.artifacts)
 }
 
 /// The lock sits beside its compose file and replaces the YAML extension.
@@ -762,6 +767,52 @@ mod tests {
         assert!(!runtime_package_changed(&previous, &next));
     }
 
+    #[test]
+    fn a_switch_between_host_builds_changes_runtime_content() {
+        const MUSL: &str = "x86_64-unknown-linux-musl";
+        const GNU: &str = "x86_64-unknown-linux-gnu";
+        let package = |builds: &[(&str, char)]| ResolvedPackage {
+            artifacts: builds
+                .iter()
+                .map(|(target, digest)| {
+                    (
+                        target.to_string(),
+                        RegistryArtifact {
+                            url: "https://example.com/state.tar.gz".to_string(),
+                            sha256: digest.to_string().repeat(64),
+                        },
+                    )
+                })
+                .collect(),
+            ..lock().containers.remove("state").unwrap().resolved
+        };
+        let both = package(&[(MUSL, 'a'), (GNU, 'b')]);
+        let glibc_only = package(&[(GNU, 'b')]);
+        let musl_on_glibc = [MUSL, GNU];
+
+        // A musl host ran musl A; the next lock has only the unchanged glibc
+        // build B, so the worker moves from A to B, and back again.
+        assert!(runtime_package_changed_for(
+            &musl_on_glibc,
+            &both,
+            &glibc_only
+        ));
+        assert!(runtime_package_changed_for(
+            &musl_on_glibc,
+            &glibc_only,
+            &both
+        ));
+        // A new build this host does not run changes nothing it runs.
+        let new_glibc = package(&[(MUSL, 'a'), (GNU, 'c')]);
+        assert!(!runtime_package_changed_for(
+            &musl_on_glibc,
+            &both,
+            &new_glibc
+        ));
+        // A glibc host ran B all along.
+        assert!(!runtime_package_changed_for(&[GNU], &both, &glibc_only));
+    }
+
     #[tokio::test]
     async fn metadata_resolution_overlaps_requests_with_the_compose_limit() {
         use std::cell::Cell;
```

**File**: `crates/iii-compose/src/registry.rs` (modified, +251/-28)
```diff
@@ -214,6 +214,68 @@ pub fn host_target() -> &'static str {
     }
 }
 
+/// The x86_64 glibc and musl dynamic loaders. A glibc distribution has the
+/// first. A musl one (Alpine) has the second, and may have the first too as a
+/// compatibility link to itself (libc6-compat, gcompat), so the musl loader
+/// decides, as it does for `iii-worker`'s own binary and the installer.
+const GLIBC_LOADER: &str = "/lib64/ld-linux-x86-64.so.2";
+const MUSL_LOADER: &str = "/lib/ld-musl-x86_64.so.1";
+
+/// Every triple this host can run, preferred first: [`host_target`], then,
+/// for the static musl build on a glibc machine, the glibc one. That machine
+/// runs both, and some workers publish only glibc builds (a C++ dependency
+/// with no musl toolchain, or backends loaded as shared libraries).
+pub fn host_targets() -> &'static [&'static str] {
+    static TARGETS: std::sync::OnceLock<Vec<&'static str>> = std::sync::OnceLock::new();
+    TARGETS.get_or_init(|| {
+        let glibc_host = Path::new(GLIBC_LOADER).exists() && !Path::new(MUSL_LOADER).exists();
+        runnable_targets(host_target(), glibc_host)
+    })
+}
+
+fn runnable_targets(native: &'static str, glibc_host: bool) -> Vec<&'static str> {
+    let mut targets = vec![native];
+    if native == "x86_64-unknown-linux-musl" && glibc_host {
+        targets.push("x86_64-unknown-linux-gnu");
+    }
+    targets
+}
+
+/// The first of `candidates` that `artifacts` has a build for.
+fn first_available<'a, T>(
+    candidates: &[&'a str],
+    artifacts: &std::collections::BTreeMap<String, T>,
+) -> Option<&'a str> {
+    candidates
+        .iter()
+        .copied()
+        .find(|target| artifacts.contains_key(*target))
+}
+
+/// The triple whose build this host installs out of `artifacts`: the first of
+/// [`host_targets`] it has, else [`host_target`] (so the error names it).
+pub(crate) fn runnable_target<T>(
+    artifacts: &std::collections::BTreeMap<String, T>,
+) -> &'static str {
+    first_available(host_targets(), artifacts).unwrap_or(host_target())
+}
+
+/// The build a host with `candidates` (see [`host_targets`]) runs out of
+/// `artifacts`, as its triple and lowercase digest: the first candidate it
+/// has, else the first candidate with no digest.
+pub(crate) fn selected_artifact<'a>(
+    candidates: &[&'a str],
+    artifacts: &std::collections::BTreeMap<String, RegistryArtifact>,
+) -> (&'a str, Option<String>) {
+    let target = first_available(candidates, artifacts).unwrap_or(candidates[0]);
+    (
+        target,
+        artifacts
+            .get(target)
+            .map(|artifact| artifact.sha256.to_ascii_lowercase()),
+    )
+}
+
 /// Splits `workers.iii.dev/state` into its registry base and worker name. A
 /// reference with no host uses [`DEFAULT_REGISTRY`].
 pub(crate) fn split_reference(reference: &str) -> (String, String) {
@@ -244,9 +306,8 @@ async fn install_from_registry(
     version_range: &str,
     cache_root: &Path,
 ) -> Result<InstalledPackage> {
-    let target = host_target();
-    let worker = resolve(container, registry, name, version_range, target).await?;
-    let resolved = into_resolved_package(container, registry, worker, target)?;
+    let worker = resolve(container, registry, name, version_range, host_targets()).await?;
+    let resolved = into_resolved_package(container, registry, worker, host_target())?;
     install_resolved(container, &resolved, cache_root).await
 }
 
@@ -258,9 +319,8 @@ pub async fn resolve_package(
     version_range: &str,
 ) -> Result<ResolvedPackage> {
     let (registry, name) = split_reference(reference);
-    let target = host_target();
-    let worker = resolve(container, &registry, &name, version_range, target).await?;
-    into_resolved_package(container, &registry, worker, target)
+    let worker = resolve(container, &registry, &name, version_range, host_targets()).await?;
+    into_resolved_package(container, &registry, worker, host_target())
 }
 
 /// Converts and validates one registry response for lock persistence.
@@ -332,7 +392,7 @@ pub async fn install_resolved(
     resolved: &ResolvedPackage,
     cache_root: &Path,
 ) -> Result<InstalledPackage> {
-    let target = host_target();
+    let target = runnable_target(&resolved.artifacts);
     let cache_root = if resolved.registry == DEFAULT_REGISTRY {
         cache_root.to_path_buf()
     } else {
@@ -424,7 +484,7 @@ impl From<ResolvedWorker> for Node {
         } else {
             worker
                 .binaries
-                .get(host_target())
+                .get(runnable_target(&worker.binaries))
                 .map(|artifact| artifact.sha256.as_str())
         }
         .map(str::to_ascii_lowercase);
@@ -448,7 +508,7 @@ impl From<&ResolvedPackage> for Node {
             kind: package.kind.clone(),
             artifact_digest: package
                 .artifacts
-                .get(host_target())
+                .get(runnable_target(&package.artifacts))
                 .map(|artifact| 
```

---

### Incident Patch 10: `4faa8e0c` (2026-09-29)
**Commit Message**: (MOT-4927) fix(docs): keep the CLI telemetry section in its generator (#2251)

**File**: `docs/next/cli-reference/index.mdx` (modified, +2/-1)
```diff
@@ -211,10 +211,11 @@ The engine sends anonymous usage data by default. This data helps to improve iii
 To turn the usage data off, do one of these:
 
 - Set `III_TELEMETRY_ENABLED` to `false`, `0`, `no`, or `off` before you start `iii`. Letter case does not matter, and leading or trailing spaces are ignored. Any other value, or no value, keeps the usage data on.
+- Create the file `~/.iii/telemetry_dev_optout`. The engine reads this file whenever the process starts.
 - Set `telemetry.enabled: false` in the engine configuration.
 
 The engine also turns the usage data off automatically if it detects that it is in a CICD environment.
 
-The `III_TELEMETRY_ENABLED` variable and CICD detection also turn off the usage data that `iii compose` sends. The `telemetry.enabled` engine setting applies only to the engine. When the engine's usage data is off, the engine discards usage reports from workers instead of storing them.
+The `III_TELEMETRY_ENABLED` variable, the `~/.iii/telemetry_dev_optout` file, and CICD detection also turn off the usage data that `iii compose` sends. The `telemetry.enabled` engine setting applies only to the engine. When the engine's usage data is off, the engine discards usage reports from workers instead of storing them.
 
 This setting controls anonymous product-usage data only. It does not change OpenTelemetry observability (traces, metrics, and logs) for your own monitoring of your iii system.
```

**File**: `docs/next/cli-reference/index.mdx.skill.md` (modified, +2/-1)
```diff
@@ -209,10 +209,11 @@ The engine sends anonymous usage data by default. This data helps to improve iii
 To turn the usage data off, do one of these:
 
 - Set `III_TELEMETRY_ENABLED` to `false`, `0`, `no`, or `off` before you start `iii`. Letter case does not matter, and leading or trailing spaces are ignored. Any other value, or no value, keeps the usage data on.
+- Create the file `~/.iii/telemetry_dev_optout`. The engine reads this file whenever the process starts.
 - Set `telemetry.enabled: false` in the engine configuration.
 
 The engine also turns the usage data off automatically if it detects that it is in a CICD environment.
 
-The `III_TELEMETRY_ENABLED` variable and CICD detection also turn off the usage data that `iii compose` sends. The `telemetry.enabled` engine setting applies only to the engine. When the engine's usage data is off, the engine discards usage reports from workers instead of storing them.
+The `III_TELEMETRY_ENABLED` variable, the `~/.iii/telemetry_dev_optout` file, and CICD detection also turn off the usage data that `iii compose` sends. The `telemetry.enabled` engine setting applies only to the engine. When the engine's usage data is off, the engine discards usage reports from workers instead of storing them.
 
 This setting controls anonymous product-usage data only. It does not change OpenTelemetry observability (traces, metrics, and logs) for your own monitoring of your iii system.
```

**File**: `scripts/generate-cli-docs.sh` (modified, +5/-1)
```diff
@@ -42,7 +42,9 @@ mkdir -p "$OUT_DIR"
 
 ## Telemetry
 
-The engine sends anonymous usage data by default. This data helps to improve iii and contains no personal information.
+The engine sends anonymous usage data by default. This data helps to improve iii. It contains no personal information unless you choose to enter your email address when you sign up. In that case, the engine attaches that email address to your usage profile.
+
+`iii compose` also reports its own usage data, such as whether a run succeeded, how long it took, how many containers it managed, and a fixed error code if it failed. These reports never include file paths, container names, worker references, or error messages.
 
 To turn the usage data off, do one of these:
 
@@ -52,6 +54,8 @@ To turn the usage data off, do one of these:
 
 The engine also turns the usage data off automatically if it detects that it is in a CICD environment.
 
+The `III_TELEMETRY_ENABLED` variable, the `~/.iii/telemetry_dev_optout` file, and CICD detection also turn off the usage data that `iii compose` sends. The `telemetry.enabled` engine setting applies only to the engine. When the engine's usage data is off, the engine discards usage reports from workers instead of storing them.
+
 This setting controls anonymous product-usage data only. It does not change OpenTelemetry observability (traces, metrics, and logs) for your own monitoring of your iii system.
 TELEMETRY_MDX
 } > "$OUT_FILE"
```

---

### Incident Patch 11: `fc19018a` (2026-09-29)
**Commit Message**: feat(ci): run the Harness E2E pr suite on each published release (#2253)

**File**: `.github/workflows/release-iii.yml` (modified, +95/-0)
```diff
@@ -734,6 +734,101 @@ jobs:
           gh workflow run quickstart-validate.yml \
             --repo iii-hq/quickstart-validator --ref main -f channel="$CHANNEL"
 
+  # ──────────────────────────────────────────────────────────────
+  # Harness E2E on the release just published
+  #
+  # Installs this exact version and runs the E2E `pr` suite on it, then
+  # answers in the release's Slack thread. It warns and never gates: the job
+  # turns red when the stack did not pass, and it stays out of
+  # `notify-complete`, whose colour is about publishing. The verdict comes
+  # from the run's summary, not its conclusion.
+  #
+  # When E2E executions go through Release Control's ledger, its own Slack
+  # message replaces this reply and the Slack steps below should go.
+  # ──────────────────────────────────────────────────────────────
+
+  verify-e2e:
+    name: Harness E2E on the release
+    needs:
+      - setup
+      - engine-release
+      - worker-release
+      - console-release
+      - sdk-npm
+      - sdk-npm-browser
+      - sdk-py
+      - sdk-rust
+      - sdk-go
+      - observability-npm
+      - observability-py
+      - observability-rust
+      - publish-builtin-workers
+      - publish-worker-skills
+    if: ${{ !cancelled() && !failure() && needs.setup.outputs.dry_run != 'true' }}
+    runs-on: ubuntu-latest
+    timeout-minutes: 60
+    steps:
+      - name: Generate token
+        id: generate_token
+        uses: actions/create-github-app-token@v2
+        with:
+          app-id: ${{ secrets.III_CI_APP_ID }}
+          private-key: ${{ secrets.III_CI_APP_PRIVATE_KEY }}
+          owner: iii-hq
+          repositories: harness-e2e
+          permission-actions: write
+
+      - name: Run the pr suite on this release
+        id: e2e
+        uses: iii-hq/harness-e2e/.github/actions/verify-stack@e13e884fb6c292e5796e445be67157ef4bfce04e
+        with:
+          token: ${{ steps.generate_token.outputs.token }}
+          iii: ${{ needs.setup.outputs.version }}
+
+      # Built with jq so a scenario name or an error message cannot break the
+      # payload, and escaped the way Slack's mrkdwn asks.
+      - name: Compose the Slack reply
+        id: message
+        if: always() && needs.setup.outputs.slack_ts != ''
+        env:
+          STATUS: ${{ steps.e2e.outputs.status }}
+          SUMMARY: ${{ steps.e2e.outputs.summary }}
+          RUN_URL: ${{ steps.e2e.outputs.run_url }}
+          VERSION: ${{ needs.setup.outputs.version }}
+          CHANNEL_ID: ${{ secrets.SLACK_CHANNEL_ID }}
+          THREAD_TS: ${{ needs.setup.outputs.slack_ts }}
+        run: |
+          case "$STATUS" in
+            passed) icon=":large_green_circle:" ;;
+            failed) icon=":red_circle:" ;;
+            *) icon=":large_yellow_circle:"; STATUS=not_measured ;;
+          esac
+          SUMMARY=${SUMMARY:-the verification did not run; see the workflow}
+          jq -n --arg channel "$CHANNEL_ID" --arg ts "$THREAD_TS" --arg icon "$icon" \
+            --arg version "$VERSION" --arg status "$STATUS" --arg summary "$SUMMARY" --arg url "$RUN_URL" '
+            def mrkdwn: gsub("&"; "&amp;") | gsub("<"; "&lt;") | gsub(">"; "&gt;");
+            {channel: $channel, thread_ts: $ts, text: "Harness E2E \($status)",
+             blocks: [{type: "section", text: {type: "mrkdwn",
+               text: "\($icon) *Harness E2E* on iii v\($version | mrkdwn)\n\($summary | mrkdwn)\(if $url != "" then "\n<\($url)|View run>" else "" end)"}}]}
+          ' > "$RUNNER_TEMP/e2e-slack.json"
+
+      - name: Reply in the release thread
+        if: always() && steps.message.outcome == 'success'
+        continue-on-error: true
+        uses: slackapi/slack-github-action@v2.0.0
+        with:
+          method: chat.postMessage
+          token: ${{ secrets.SLACK_BOT_TOKEN }}
+          payload-file-path: ${{ runner.temp }}/e2e-slack.json
+
+      - name: Turn red when the stack did not pass
+        if: always() && steps.e2e.outputs.status != 'passed' && steps.e2e.outputs.status != 'skipped'
+        env:
+          SUMMARY: ${{ steps.e2e.outputs.summary }}
+        run: |
+          echo "::warning::Harness E2E: ${SUMMARY:-no verdict}"
+          exit 1
+
   # ──────────────────────────────────────────────────────────────
   # Notification: Complete
   # ──────────────────────────────────────────────────────────────
```

---

### Incident Patch 12: `05b72029` (2026-09-28)
**Commit Message**: fix(sdk-python): reconnect after a normal WebSocket close (iii#2180) (#2243)

**File**: `sdk/packages/python/iii/src/iii/iii.py` (modified, +93/-38)
```diff
@@ -417,12 +417,14 @@ async def shutdown_async(self) -> None:
         self._loop.call_soon(self._loop.stop)
 
     async def _do_connect(self) -> None:
+        ws: ClientConnection | None = None
         try:
             log.debug(f"Connecting to {self._address}")
-            self._ws = await websockets.connect(
+            ws = await websockets.connect(
                 self._address,
                 additional_headers=self._options.headers,
             )
+            self._ws = ws
             log.info(f"Connected to {self._address}")
             await self._on_connected()
         except Exception as e:
@@ -437,6 +439,19 @@ async def _do_connect(self) -> None:
             # a zombie with zero retries. CancelledError is BaseException,
             # so shutdown cancellation still propagates.
             log.warning(f"Connection failed: {type(e).__name__}: {e}")
+            if ws is not None and self._ws is ws:
+                # The socket failed after the handshake, before the receive
+                # loop started (e.g. a proxy reload closed it while the
+                # registrations were replayed). Keeping it in `_ws` would end
+                # the reconnect loop (`while not self._ws`) with no receiver:
+                # the same zombie as iii-hq/iii#2180.
+                self._ws = None
+                if self._fatal_error is None:
+                    self._set_connection_state("disconnected")
+                try:
+                    await ws.close()
+                except Exception as close_error:
+                    log.debug(f"Closing the failed socket raised: {close_error!r}")
             if self._running:
                 self._schedule_reconnect()
 
@@ -474,7 +489,6 @@ async def _reconnect_loop(self) -> None:
             await self._do_connect()
 
     async def _on_connected(self) -> None:
-        self._reconnect_attempt = 0
         self._set_connection_state("connected")
         # Reconnect: present the previous engine-assigned identity BEFORE the
         # registration replay so the engine retires the old connection and the
@@ -506,23 +520,52 @@ async def _on_connected(self) -> None:
         self._register_worker_metadata()
 
         self._receiver_task = asyncio.create_task(self._receive_loop())
+        # Reset the backoff only once setup succeeded: a failure inside
+        # _on_connected counts as an attempt (and against max_retries). A
+        # connection that closes after setup restarts the backoff, as in the
+        # Node SDK.
+        self._reconnect_attempt = 0
 
     async def _receive_loop(self) -> None:
-        if not self._ws:
+        ws = self._ws
+        if not ws:
             return
         try:
-            async for msg in self._ws:
-                await self._handle_message(msg)
+            async for msg in ws:
+                try:
+                    await self._handle_message(msg)
+                except Exception:
+                    # One bad frame must not end the loop: the socket would stay
+                    # open with nobody reading it, so the worker keeps reporting
+                    # `connected` while it never answers again. The Node SDK
+                    # logs and drops unparseable frames; this also contains
+                    # errors raised while dispatching a parsed message.
+                    log.exception("Failed to handle incoming message")
         except websockets.ConnectionClosed:
-            log.debug("Connection closed")
-            self._ws = None
-            # A fatal registration rejection already set the terminal `failed`
-            # state and cleared `_running`; the socket close it triggers must not
-            # regress the state back to `disconnected`.
-            if self._fatal_error is None:
-                self._set_connection_state("disconnected")
-            if self._running:
-                self._schedule_reconnect()
+            pass
+        # Reached on every close. A normal close (1000/1001, e.g. an engine
+        # restart seen through a reverse proxy) ends `async for` quietly,
+        # because websockets swallows ConnectionClosedOK; an abnormal one
+        # raises ConnectionClosed above (iii-hq/iii#2180). Not a `finally`:
+        # shutdown cancels this task and must still find `_ws` to close it.
+        if self._ws is not ws:
+            # A stale loop: shutdown or a newer connection already owns `_ws`.
+            log.debug("Stale connection closed")
+            return
+        self._ws = None
+        # INFO with the close code: a proxy-initiated close (e.g. 1001 on a
+        # reload) followed by a reconnect should be visible without debug logs.
+        log.info(
+            f"Connection closed (code={getattr(ws, 'close_code', None)}, "
+            f"reason={getattr(ws, 'close_reason', None)!r})"
+        )
+        # A fatal registration rejection already set the terminal `failed`
+        # state and cleared `_running`; the socket close it t
```

**File**: `sdk/packages/python/iii/tests/test_connection_state_listener.py` (modified, +5/-0)
```diff
@@ -1,5 +1,6 @@
 """Unit tests for III.add_connection_state_listener (no live engine needed)."""
 
+import asyncio
 import time
 from types import SimpleNamespace
 from typing import Any
@@ -16,17 +17,21 @@
 class FakeWebSocket:
     def __init__(self) -> None:
         self.state = SimpleNamespace(name="OPEN")
+        self._closed = asyncio.Event()
 
     async def send(self, payload: str) -> None:
         pass
 
     async def close(self) -> None:
         self.state = SimpleNamespace(name="CLOSED")
+        self._closed.set()
 
     def __aiter__(self) -> "FakeWebSocket":
         return self
 
     async def __anext__(self) -> Any:
+        # Like a real socket: iteration blocks while open and ends on close.
+        await self._closed.wait()
         raise StopAsyncIteration
 
 
```

**File**: `sdk/packages/python/iii/tests/test_helpers.py` (modified, +5/-0)
```diff
@@ -2,6 +2,7 @@
 
 from __future__ import annotations
 
+import asyncio
 import inspect
 import json
 from types import SimpleNamespace
@@ -18,17 +19,21 @@ class FakeWebSocket:
     def __init__(self) -> None:
         self.sent: list[dict[str, Any]] = []
         self.state = SimpleNamespace(name="OPEN")
+        self._closed = asyncio.Event()
 
     async def send(self, payload: str) -> None:
         self.sent.append(json.loads(payload))
 
     async def close(self) -> None:
         self.state = SimpleNamespace(name="CLOSED")
+        self._closed.set()
 
     def __aiter__(self) -> "FakeWebSocket":
         return self
 
     async def __anext__(self) -> Any:
+        # Like a real socket: iteration blocks while open and ends on close.
+        await self._closed.wait()
         raise StopAsyncIteration
 
 
```

**File**: `sdk/packages/python/iii/tests/test_http_external_functions_integration.py` (modified, +7/-0)
```diff
@@ -128,6 +128,7 @@ async def wait_for_webhook_or_none(self, timeout: float = 2.0) -> dict[str, Any]
 
 def _make_fake_ws_env(monkeypatch: pytest.MonkeyPatch) -> list[dict[str, Any]]:
     """Set up a FakeWs monkeypatch and return the list that collects sent messages."""
+    import asyncio
     from types import SimpleNamespace
 
     import iii.iii as iii_module
@@ -137,16 +138,22 @@ def _make_fake_ws_env(monkeypatch: pytest.MonkeyPatch) -> list[dict[str, Any]]:
     class FakeWs:
         state = SimpleNamespace(name="OPEN")
 
+        def __init__(self) -> None:
+            self._closed = asyncio.Event()
+
         async def send(self, payload: str) -> None:
             sent.append(json.loads(payload))
 
         async def close(self) -> None:
             self.state = SimpleNamespace(name="CLOSED")
+            self._closed.set()
 
         def __aiter__(self):
             return self
 
         async def __anext__(self):
+            # Like a real socket: iteration blocks while open and ends on close.
+            await self._closed.wait()
             raise StopAsyncIteration
 
     async def fake_connect(_: str, **kwargs: object) -> FakeWs:
```

**File**: `sdk/packages/python/iii/tests/test_iii_registration_dedup.py` (modified, +4/-0)
```diff
@@ -49,17 +49,21 @@ class FakeWebSocket:
     def __init__(self) -> None:
         self.sent: list[dict[str, Any]] = []
         self.state = SimpleNamespace(name="OPEN")
+        self._closed = asyncio.Event()
 
     async def send(self, payload: str) -> None:
         self.sent.append(json.loads(payload))
 
     async def close(self) -> None:
         self.state = SimpleNamespace(name="CLOSED")
+        self._closed.set()
 
     def __aiter__(self) -> "FakeWebSocket":
         return self
 
     async def __anext__(self) -> Any:
+        # Like a real socket: iteration blocks while open and ends on close.
+        await self._closed.wait()
         raise StopAsyncIteration
 
 
```

**File**: `sdk/packages/python/iii/tests/test_receive_loop_resilience.py` (added, +450/-0)
```diff
@@ -0,0 +1,450 @@
+"""iii-hq/iii#2180 regressions: the receive loop must never leave a zombie worker.
+
+* A normal close (1000, 1001, or a close frame without a code, 1005: e.g. a
+  reverse proxy reload, or the engine rejecting a session) ends ``async for``
+  over the socket quietly, because websockets swallows ``ConnectionClosedOK``.
+  The cleanup and reconnect lived only in ``except ConnectionClosed``, so the
+  worker kept reporting ``connected`` and never reconnected.
+* Any other exception raised while handling one frame (malformed JSON, a
+  non-object frame, a result for an invocation whose caller already gave up)
+  ended the loop with the socket still open: the worker stayed ``connected``
+  but never read another message.
+
+Most tests run a real ``III`` client against an in-process websockets server
+that plays the engine; fixtures tear both down even when a test fails.
+"""
+
+import asyncio
+import json
+import threading
+import time
+from collections.abc import Awaitable, Callable, Iterator
+from types import SimpleNamespace
+from typing import Any
+
+import pytest
+import websockets
+from iii_helpers.observability import ReconnectionConfig
+from websockets.frames import Close
+
+import iii.iii as iii_module
+from iii.iii import III, _PendingInvocation
+from iii.iii_constants import InitOptions
+
+Frames = list[dict[str, Any]]
+OnFirst = Callable[[Any, Frames], Awaitable[None]]
+
+
+class _FakeEngine:
+    """Records every JSON frame per connection; ``on_first`` scripts what the
+    engine does to the first connection. ``stop`` closes the server and joins
+    its thread."""
+
+    def __init__(self, on_first: OnFirst | None = None) -> None:
+        self.connections: list[Frames] = []
+        self.close_codes: dict[int, int | None] = {}
+        self.port = 0
+        self._on_first = on_first
+        self._changed = threading.Condition()
+        self._loop: asyncio.AbstractEventLoop | None = None
+        self._stop: asyncio.Event | None = None
+        started = threading.Event()
+        self._thread = threading.Thread(target=self._run, args=(started,), daemon=True)
+        self._thread.start()
+        assert started.wait(5), "fake engine did not start"
+
+    def _run(self, started: threading.Event) -> None:
+        async def main() -> None:
+            self._loop = asyncio.get_running_loop()
+            self._stop = asyncio.Event()
+            server = await websockets.serve(self._handler, "127.0.0.1", 0)
+            self.port = next(iter(server.sockets)).getsockname()[1]
+            started.set()
+            await self._stop.wait()
+            server.close()
+            try:
+                await asyncio.wait_for(server.wait_closed(), 5)
+            except asyncio.TimeoutError:
+                pass  # asyncio.run cancels any handler still running
+
+        asyncio.run(main())
+
+    def stop(self) -> None:
+        if self._thread.is_alive() and self._loop is not None and self._stop is not None:
+            self._loop.call_soon_threadsafe(self._stop.set)
+        self._thread.join(10)
+        assert not self._thread.is_alive(), "fake engine thread did not stop"
+
+    def _notify(self) -> None:
+        with self._changed:
+            self._changed.notify_all()
+
+    def wait_for(self, predicate: Callable[[], bool], timeout: float = 10.0) -> bool:
+        with self._changed:
+            return self._changed.wait_for(predicate, timeout)
+
+    async def _read(self, ws: Any, frames: Frames) -> None:
+        try:
+            async for raw in ws:
+                frames.append(json.loads(raw))
+                self._notify()
+        except websockets.ConnectionClosed:
+            pass
+
+    async def _handler(self, ws: Any) -> None:
+        idx = len(self.connections)
+        frames: Frames = []
+        self.connections.append(frames)
+        self._notify()
+        reader = asyncio.ensure_future(self._read(ws, frames))
+        if idx == 0 and self._on_first is not None:
+            await self._on_first(ws, frames)
+        await reader
+        self.close_codes[idx] = ws.close_code
+        self._notify()
+
+
+def _registered(frames: Frames, function_id: str) -> bool:
+    return any(
+        f.get("type") == "registerfunction" and function_id in (f.get("id"), f.get("function_id")) for f in frames
+    )
+
+
+def _answered(frames: Frames, invocation_id: str) -> bool:
+    return any(f.get("type") == "invocationresult" and f.get("invocation_id") == invocation_id for f in frames)
+
+
+async def _until(predicate: Callable[[], Any], timeout: float = 10.0) -> Any:
+    deadline = time.monotonic() + timeout
+    while not (value := predicate()):
+        if time.monotonic() > deadline:
+            raise TimeoutError("fake engine script timed out")
+        await asyncio.sleep(0.01)
+    return value
+
+
+def _probe(invocation_id: str = "probe-1") -> str:
+    return json.dumps(
+        {
+            "type": "invokefunction",
+            "invocation_id
```

**File**: `sdk/packages/python/iii/tests/test_register_function_args.py` (modified, +5/-0)
```diff
@@ -1,5 +1,6 @@
 """Tests for the string-id register_function() public API."""
 
+import asyncio
 import json
 import time
 from collections.abc import Callable
@@ -25,17 +26,21 @@ class FakeWebSocket:
     def __init__(self) -> None:
         self.sent: list[dict[str, Any]] = []
         self.state = SimpleNamespace(name="OPEN")
+        self._closed = asyncio.Event()
 
     async def send(self, payload: str) -> None:
         self.sent.append(json.loads(payload))
 
     async def close(self) -> None:
         self.state = SimpleNamespace(name="CLOSED")
+        self._closed.set()
 
     def __aiter__(self) -> "FakeWebSocket":
         return self
 
     async def __anext__(self) -> Any:
+        # Like a real socket: iteration blocks while open and ends on close.
+        await self._closed.wait()
         raise StopAsyncIteration
 
 
```

**File**: `sdk/packages/python/iii/tests/test_sync_api.py` (modified, +5/-0)
```diff
@@ -1,5 +1,6 @@
 """Tests for the synchronous public API."""
 
+import asyncio
 import json
 import time
 from types import SimpleNamespace
@@ -19,17 +20,21 @@ class FakeWebSocket:
     def __init__(self) -> None:
         self.sent: list[dict[str, Any]] = []
         self.state = SimpleNamespace(name="OPEN")
+        self._closed = asyncio.Event()
 
     async def send(self, payload: str) -> None:
         self.sent.append(json.loads(payload))
 
     async def close(self) -> None:
         self.state = SimpleNamespace(name="CLOSED")
+        self._closed.set()
 
     def __aiter__(self) -> "FakeWebSocket":
         return self
 
     async def __anext__(self) -> Any:
+        # Like a real socket: iteration blocks while open and ends on close.
+        await self._closed.wait()
         raise StopAsyncIteration
 
 
```

---

### Incident Patch 13: `75079c4f` (2026-09-28)
**Commit Message**: feat(website): replace the Astro site with the Next.js rebuild of iii.dev (#2239)

Co-authored-by: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `website/.env.example` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+# Copy to .env.local for local work, or set these on the hosting project.
+# Both are optional and public (client-side values, no secrets).
+
+# GTM (GTM-N8DCTFB8), PostHog (us.i.posthog.com) and Common Room signals, all behind the
+# cookie banner. Default: on in production builds, off in `next dev`.
+# Set to false on preview/demo deployments so their traffic stays out of the dashboards.
+# NEXT_PUBLIC_ENABLE_ANALYTICS=false
+
+# Mailmodo endpoint for the "Follow development" email form.
+# Default: the production form in production builds, nothing in `next dev`.
+# Set to an empty string on preview/demo deployments so test signups never reach the list.
+# NEXT_PUBLIC_MAILMODO_FORM_URL=
```

**File**: `website/.gitignore` (modified, +9/-5)
```diff
@@ -1,9 +1,13 @@
 node_modules/
 dist/
-.astro/
-.vite/
+.next/
 *.tsbuildinfo
+next-env.d.ts
 .DS_Store
-.env
-.env.local
-ds-bundle/
+.env*
+!.env.example
+.vercel
+# generated before every build/dev by scripts/generate-roadmap-manifest.ts
+roadmap/generated/
+# playwright-cli scratch (screenshots, console logs)
+.playwright-cli/
```

**File**: `website/README.md` (modified, +60/-80)
```diff
@@ -1,105 +1,85 @@
 # iii.dev website
 
-One [Astro](https://astro.build) project (the Vite-based static-site generator)
-that builds **all of iii.dev** into `dist/` — fully static, prerendered HTML,
-nothing rendered at request time:
+One [Next.js](https://nextjs.org) app (App Router, static export) that builds **all of iii.dev** into `dist/`:
+prerendered HTML, nothing rendered at request time. Deployed to S3 + CloudFront by
+`.github/workflows/deploy-website.yml`; Vercel builds previews from the same `pnpm build`.
 
 | URL | Source |
 | --- | --- |
-| `/` | `src/pages/index.astro` — the landing page |
-| `/manifesto`, `/privacy-policy` | `src/pages/{manifesto,privacy-policy}.astro` |
-| `/blog/`, `/blog/<slug>/`, `/blog/rss.xml` | markdown posts in `src/content/blog/` |
-| `/roadmap/`, `/roadmap/<slug>/` | `src/pages/roadmap/` — gallery + one page per tech spec, rendering the deck React islands from `roadmap/` ([roadmap/README.md](./roadmap/README.md)) |
-| `/sitemap.xml`, `/llms.txt`, `/AGENTS.md` | generated into `dist/` by `scripts/` at build time |
-| `/robots.txt`, `/fonts/*`, `/favicon.svg`, `/og-image.png`, `/posthog-consent.js` | `public/` (copied verbatim) |
+| `/` | `src/app/(site)/page.tsx` and `src/components/landing/` |
+| `/manifesto`, `/privacy-policy` | `src/app/(site)/{manifesto,privacy-policy}/` (copy in the sibling `*-data.ts`) |
+| `/blog/`, `/blog/<slug>/`, `/blog/rss.xml`, `/blog/<slug>.md`, `/blog/index.md` | markdown posts in `src/content/blog/`; the `.md` twins are written by `scripts/generate-blog-md.ts` |
+| `/roadmap/`, `/roadmap/<slug>/`, `/roadmap/<slug>/<file>.md`, `/roadmap/index.json` | tech specs read from `../tech-specs/` (markdown only, frontmatter in each `README.md`) |
+| `/roadmap/<slug>/deck/` | the interactive presentation for a spec, from `roadmap/<slug>/src/App.tsx` ([roadmap/README.md](./roadmap/README.md)) |
+| `/sitemap.xml`, `/llms.txt`, `/AGENTS.md` | generated into `dist/` by `scripts/` after the Next build |
+| `/robots.txt`, `/favicon.svg`, `/og-image.png`, `/posthog-consent.js`, `/blog/<slug>/*`, `/console-demo/*`, `/fonts/*` | `public/` (copied verbatim) |
 
 ## Local development
 
 ```bash
 pnpm install            # repo root (workspace)
-pnpm dev                # THE dev server at :4321 — the whole site, one origin, HMR everywhere
-pnpm build              # the full site → dist/  (roadmap contract checks → astro build →
-                        #   llms/AGENTS → sitemap)
+pnpm dev                # http://localhost:3100 (regenerates the roadmap manifest first)
+pnpm build              # the full site → dist/ (roadmap checks → manifest → next build →
+                        #   dist shaping → blog .md → llms/AGENTS → sitemap)
 pnpm preview            # serve dist/ at :4321
 pnpm test               # script unit tests + CloudFront function tests (no build needed)
 pnpm test:dist          # post-build contract for the whole dist/ tree (run after pnpm build)
-pnpm type-check         # strict TS over the roadmap tree (shared lib + every deck)
+pnpm type-check         # tsc over the site and the roadmap decks
+pnpm lint               # biome
 ```
 
-From the repo root, prefix with `pnpm --filter iii-website <script>` (or use
-`pnpm dev:website`).
+From the repo root: `pnpm --filter iii-website <script>`, or `pnpm dev:website`.
+
+## How the export is shaped
+
+Next writes every page as `<route>.html`. `scripts/finalize-dist.ts` then moves the pages under `blog/` and
+`roadmap/` into `<route>/index.html`, because the CloudFront edge function
+(`infra/terraform/website/cloudfront_functions/redirects.js`) serves those two prefixes as directory sites with
+trailing-slash canonical URLs. Top-level pages stay `manifesto.html`, `privacy-policy.html`: the deploy syncs the
+`/<page>` → `/<page>.html` map into a CloudFront KeyValueStore from `scripts/routes-kvs.ts`. Adding a page is a
+content-only change. Do not change these shapes; they are the site's canonical URLs.
 
 ## Writing a blog post
 
-Add a markdown file at `src/content/blog/<slug>.md` — the filename is the URL
-(`/blog/<slug>/`):
+Add a markdown file at `src/content/blog/<slug>.md`; the filename is the URL (`/blog/<slug>/`). Frontmatter:
 
 ```yaml
 ---
 title: 'The Harness Is the Backend'
-description: 'One-or-two-sentence summary; becomes the meta description and RSS blurb.'
-pubDate: 2026-04-28
-author: 'Mike Piccolo, Founder & CEO of iii'   # optional
-tags: ['agents', 'architecture']               # optional
-updatedDate: 2026-05-02                        # optional
-draft: true                                    # optional — hides from build, sitemap, RSS
+description: 'One or two sentences; becomes the meta description and RSS blurb.'
+pubDate: 2026-05-07
+updatedDate: 2026-05-09      # optional
+ogImage: ../../assets/blog/<slug>/banner.png   # optional; the file lives in public/blog/<slug>/
+tags: [agents, architecture]
+draft: false
 ---
-
-Post body in markdown (MDX also works).
 ```
 
-Image
```

**File**: `website/astro.config.mjs` (removed, +0/-51)
```diff
@@ -1,51 +0,0 @@
-import { fileURLToPath } from 'node:url'
-import mdx from '@astrojs/mdx'
-import react from '@astrojs/react'
-import tailwindcss from '@tailwindcss/vite'
-import { defineConfig } from 'astro/config'
-import { specManifestPlugin } from './roadmap/scripts/manifest.mjs'
-
-// One static site for all of iii.dev — one dev server, one build — deployed
-// to S3 + CloudFront by .github/workflows/deploy-website.yml. URL shapes are
-// load-bearing SEO contracts enforced by build.format 'preserve':
-//   /            ← src/pages/index.astro            → dist/index.html
-//   /manifesto   ← src/pages/manifesto.astro        → dist/manifesto.html
-//                  (extensionless URL resolved by the CloudFront KVS route map)
-//   /blog/<x>/   ← src/pages/blog/[...slug]/index.astro → dist/blog/<x>/index.html
-//                  (directory URL resolved by the CloudFront redirects function)
-//   /roadmap/*   ← src/pages/roadmap/* — the gallery and each tech-spec deck
-//                  as React islands over the shared library in roadmap/src
-//                  (@lib), specs discovered via roadmap/scripts/manifest.mjs
-// Changing the format changes every canonical URL — don't.
-export default defineConfig({
-  site: 'https://iii.dev',
-  trailingSlash: 'ignore',
-  // The landing page ships hand-tuned markup; keep output whitespace as
-  // authored so the built HTML stays diffable against its source fragments.
-  compressHTML: false,
-  build: {
-    format: 'preserve',
-  },
-  markdown: {
-    syntaxHighlight: 'shiki',
-    shikiConfig: {
-      theme: 'github-dark-dimmed',
-      wrap: false,
-    },
-  },
-  integrations: [mdx(), react()],
-  vite: {
-    // Tailwind processes roadmap/src/index.css; the spec-manifest plugin
-    // resolves virtual:spec-manifest (the gallery's data source) and reloads
-    // on tech-specs/ edits in dev.
-    plugins: [tailwindcss(), specManifestPlugin()],
-    resolve: {
-      alias: {
-        '@lib': fileURLToPath(new URL('./roadmap/src', import.meta.url)),
-      },
-    },
-    // Deck spec pages bundle ../../../../tech-specs/<slug>/*.md, which sits
-    // outside the website root — let the dev server read from the repo root.
-    server: { fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] } },
-  },
-})
```

**File**: `website/biome.json` (added, +40/-0)
```diff
@@ -0,0 +1,40 @@
+{
+  "$schema": "https://biomejs.dev/schemas/2.3.10/schema.json",
+  "root": false,
+  "extends": "//",
+  "files": {
+    "includes": ["**", "!.next", "!public/console-demo", "!public/posthog-consent.js"]
+  },
+  "javascript": {
+    "formatter": {
+      "quoteStyle": "double",
+      "semicolons": "asNeeded"
+    }
+  },
+  "css": {
+    "parser": {
+      "tailwindDirectives": true,
+      "cssModules": true
+    }
+  },
+  "overrides": [
+    {
+      "includes": ["roadmap/**"],
+      "linter": {
+        "rules": {
+          "a11y": {
+            "useAriaPropsSupportedByRole": "off"
+          },
+          "correctness": {
+            "useUniqueElementIds": "off"
+          },
+          "suspicious": {
+            "noCommentText": "off",
+            "noArrayIndexKey": "off",
+            "noThenProperty": "off"
+          }
+        }
+      }
+    }
+  ]
+}
```

**File**: `website/components.json` (added, +27/-0)
```diff
@@ -0,0 +1,27 @@
+{
+  "$schema": "https://ui.shadcn.com/schema.json",
+  "style": "base-nova",
+  "rsc": true,
+  "tsx": true,
+  "tailwind": {
+    "config": "",
+    "css": "src/app/globals.css",
+    "baseColor": "neutral",
+    "cssVariables": true,
+    "prefix": ""
+  },
+  "iconLibrary": "lucide",
+  "rtl": false,
+  "aliases": {
+    "components": "@/components",
+    "utils": "@/lib/utils",
+    "ui": "@/components/ui",
+    "lib": "@/lib",
+    "hooks": "@/hooks"
+  },
+  "menuColor": "default",
+  "menuAccent": "subtle",
+  "registries": {
+    "@magicui": "https://magicui.design/r/{name}"
+  }
+}
```

**File**: `website/doctor.config.jsonc` (added, +17/-0)
```diff
@@ -0,0 +1,17 @@
+{
+  "$schema": "https://react.doctor/schema/config.json",
+  "ignore": {
+    // public/console-demo is the prebuilt console demo copied from the Astro site (a minified vendor
+    // bundle), not source maintained here. Everything under src/ is scanned.
+    "files": ["public/**"],
+    "overrides": [
+      {
+        // The console demo iframe is our own same-origin page that the frame scripts into (site fonts,
+        // wheel hand-off, play/pause messages), so its sandbox has to allow scripts and same-origin.
+        // The attribute is set; the curated value is the point, and the rule cannot see that.
+        "files": ["src/components/landing/console-live/console-frame.tsx"],
+        "rules": ["react-doctor/iframe-missing-sandbox"]
+      }
+    ]
+  }
+}
```

**File**: `website/next.config.ts` (added, +20/-0)
```diff
@@ -0,0 +1,20 @@
+import type { NextConfig } from "next"
+
+const nextConfig: NextConfig = {
+  // The whole site is prerendered into dist/ and served from S3 + CloudFront
+  // (.github/workflows/deploy-website.yml). scripts/finalize-dist.ts then gives
+  // the /blog and /roadmap pages the directory shape the edge function expects.
+  output: "export",
+  distDir: "dist",
+  // No image server in a static export; the banners are already sized in public/.
+  images: { unoptimized: true },
+  turbopack: {
+    resolveAlias: {
+      // The roadmap decks read the spec list from a module generated before the
+      // build (scripts/generate-roadmap-manifest.ts), the way their Vite plugin did.
+      "virtual:spec-manifest": "./roadmap/generated/spec-manifest.ts",
+    },
+  },
+}
+
+export default nextConfig
```

---

### Incident Patch 14: `6fc6c3f8` (2026-09-24)
**Commit Message**: fix(compose): deliver runtime overrides through the configuration service (#2231)

**File**: `crates/iii-compose/src/config.rs` (modified, +12/-0)
```diff
@@ -554,6 +554,12 @@ fn validate_container(
     // user-supplied III_URL would look like it took effect.
     let mut environment = BTreeMap::new();
     for (name, value) in &raw.environment {
+        if crate::spawn::is_retired_config_env(name) {
+            return Err(ComposeError::RetiredConfigEnv {
+                container: key.to_string(),
+                name: name.clone(),
+            });
+        }
         if is_reserved_env(name.as_str()) {
             return Err(ComposeError::ReservedEnvOverride {
                 container: key.to_string(),
@@ -656,6 +662,12 @@ impl Container {
                 source,
             })?;
             for (name, value) in parse_env_file(&text) {
+                if crate::spawn::is_retired_config_env(&name) {
+                    return Err(ComposeError::RetiredConfigEnv {
+                        container: container_key.to_string(),
+                        name,
+                    });
+                }
                 if is_reserved_env(name.as_str()) {
                     return Err(ComposeError::ReservedEnvOverride {
                         container: container_key.to_string(),
```

**File**: `crates/iii-compose/src/configuration.rs` (modified, +5/-135)
```diff
@@ -6,17 +6,10 @@
 
 //! Configuration merge and delivery.
 //!
-//! Config is resolved by the daemon *before* the child starts and handed over as
-//! a file path in `III_CONFIG`, so a worker never needs credentials to fetch its
-//! own configuration and the daemon can fail a container before spawning it.
-//!
-//! `III_CONFIG_NAME` identifies the persistent base. Runtime overrides belong
-//! only to `III_CONFIG`; they must never be registered back into the store.
-
-use std::{
-    io::Write,
-    path::{Path, PathBuf},
-};
+//! Compose resolves defaults, the current configuration and overrides before spawn,
+//! then injects the execution value into the configuration service in memory.
+//! `III_CONFIG_NAME` identifies the entry workers read; only explicit saves
+//! persist the active value. No execution snapshot file is created.
 
 use sha2::{Digest, Sha256};
 
@@ -73,7 +66,7 @@ pub fn merge(base: serde_yaml::Value, override_value: serde_yaml::Value) -> serd
         (serde_yaml::Value::Mapping(mut base), serde_yaml::Value::Mapping(overrides)) => {
             for (key, value) in overrides {
                 // Merged in place so an override never reshuffles the document:
-                // the delivered file stays diffable against the base.
+                // the delivered value stays diffable against the base.
                 match base.get_mut(&key) {
                     Some(slot) => {
                         let existing = std::mem::replace(slot, serde_yaml::Value::Null);
@@ -105,80 +98,6 @@ fn picks_another_variant(base: &serde_yaml::Mapping, overrides: &serde_yaml::Map
     )
 }
 
-/// A resolved configuration file owned by the daemon.
-///
-/// Created `0600` because resolved configuration routinely contains secrets:
-/// the child reads it, nothing else on the host should.
-#[derive(Debug)]
-pub struct ConfigFile {
-    path: PathBuf,
-}
-
-impl ConfigFile {
-    pub fn write(dir: &Path, container_key: &str, value: &serde_yaml::Value) -> Result<Self> {
-        std::fs::create_dir_all(dir).map_err(|source| ComposeError::Io {
-            path: dir.to_path_buf(),
-            source,
-        })?;
-        // `create_dir_all` takes the process umask, which is usually 0755. The
-        // files inside are 0600, but a directory anyone can list and enter is
-        // half a boundary — and compose publishes this directory into a bundle
-        // VM, so its mode travels with it.
-        #[cfg(unix)]
-        {
-            use std::os::unix::fs::PermissionsExt;
-            std::fs::set_permissions(dir, std::fs::Permissions::from_mode(0o700)).map_err(
-                |source| ComposeError::Io {
-                    path: dir.to_path_buf(),
-                    source,
-                },
-            )?;
-        }
-
-        let path = dir.join(format!("{container_key}.yaml"));
-        let text = serde_yaml::to_string(value).map_err(|err| ComposeError::Yaml {
-            path: path.clone(),
-            message: err.to_string(),
-        })?;
-
-        let mut options = std::fs::OpenOptions::new();
-        options.write(true).create(true).truncate(true);
-        #[cfg(unix)]
-        {
-            use std::os::unix::fs::OpenOptionsExt;
-            options.mode(0o600);
-        }
-        let mut file = options.open(&path).map_err(|source| ComposeError::Io {
-            path: path.clone(),
-            source,
-        })?;
-        // `mode` above applies to a file this call creates. One already there
-        // keeps whatever it had, so a run that wrote it under a looser umask
-        // would leave resolved secrets readable. Set it on the handle every
-        // time, before anything is written into it.
-        #[cfg(unix)]
-        {
-            use std::os::unix::fs::PermissionsExt;
-            file.set_permissions(std::fs::Permissions::from_mode(0o600))
-                .map_err(|source| ComposeError::Io {
-                    path: path.clone(),
-                    source,
-                })?;
-        }
-        file.write_all(text.as_bytes())
-            .map_err(|source| ComposeError::Io {
-                path: path.clone(),
-                source,
-            })?;
-
-        Ok(Self { path })
-    }
-
-    pub fn path(&self) -> &Path {
-        &self.path
-    }
-}
-
 #[cfg(test)]
 mod tests {
     use super::*;
@@ -317,53 +236,4 @@ mod tests {
         assert_eq!(keys, vec!["a", "b", "c"]);
         assert_eq!(merged, yaml("a: 1\nb: 20\nc: 3\n"));
     }
-
-    #[test]
-    fn the_written_file_is_owner_only() {
-        let tmp = tempfile::tempdir().unwrap();
-        let file = ConfigFile::write(
-            &tmp.path().join("state"),
-            "api",
-            &yaml("server:\n  port: 3000\n"),
-        )
-        .unwrap();
-
-        assert_eq!(
-            std::fs::read_to_string(file.path()).unwrap(),
-            "server:\n  port: 3000\n"
-        );
-        #[cfg(unix)]
-        {
-            use std::os::unix::fs::PermissionsExt;
-    
```

**File**: `crates/iii-compose/src/engine.rs` (modified, +25/-6)
```diff
@@ -182,12 +182,7 @@ impl EngineClient {
             .trigger(
                 TriggerRequest {
                     function_id: "configuration::get".to_string(),
-                    // Raw, so `${VAR}` placeholders survive the round trip. The
-                    // worker pushes this value back into the store at boot, and an
-                    // expanded fetch would persist the secret a lazy reference was
-                    // there to avoid — turning `password: ${DB_PASSWORD}` into the
-                    // password, permanently. Expansion belongs to the read that
-                    // uses the value, not to a copy passing through.
+                    // Use the current configuration, preserving raw env placeholders.
                     payload: json!({ "id": name, "raw": true }),
                     action: None,
                     timeout_ms: Some(CALL_TIMEOUT_MS),
@@ -217,6 +212,30 @@ impl EngineClient {
             })
     }
 
+    /// Update active configuration before spawn without touching persistent storage.
+    pub async fn set_config(&self, name: &str, value: serde_yaml::Value) -> Result<()> {
+        let value = serde_json::to_value(value).map_err(|err| ComposeError::ConfigFetchFailed {
+            name: name.into(),
+            message: err.to_string(),
+        })?;
+        self.client
+            .trigger(
+                TriggerRequest {
+                    function_id: "configuration::set".into(),
+                    payload: json!({"id": name, "value": value, "flush": false}),
+                    action: None,
+                    timeout_ms: Some(CALL_TIMEOUT_MS),
+                }
+                .namespace(DEFAULT_NAMESPACE),
+            )
+            .await
+            .map_err(|err| ComposeError::ConfigFetchFailed {
+                name: name.into(),
+                message: format!("runtime configuration injection failed: {err}"),
+            })?;
+        Ok(())
+    }
+
     /// Ask the configuration authority to migrate the exact previous default.
     /// Returns true only when both source and destination are missing.
     /// A missing function is an upgrade error, never permission to reset defaults.
```

**File**: `crates/iii-compose/src/error.rs` (modified, +6/-0)
```diff
@@ -319,6 +319,11 @@ pub enum ComposeError {
     )]
     ReservedEnvOverride { container: String, name: String },
 
+    #[error(
+        "container '{container}': '{name}' is retired and cannot be set by environment or env_file; use config_override and III_CONFIG_NAME with the configuration service instead"
+    )]
+    RetiredConfigEnv { container: String, name: String },
+
     #[error(
         "generated configuration id '{name}' must match [a-z0-9_-]{{1,64}}; set an explicit config_name instead of relying on sanitization or truncation"
     )]
@@ -605,6 +610,7 @@ impl ComposeError {
             Self::PackageDigestMismatch { .. } => "PACKAGE_DIGEST_MISMATCH",
             Self::PackageArtifactEmpty { .. } => "PACKAGE_ARTIFACT_EMPTY",
             Self::ReservedEnvOverride { .. } => "RESERVED_ENV_OVERRIDE",
+            Self::RetiredConfigEnv { .. } => "RETIRED_CONFIG_ENV",
             Self::InvalidConfigName { .. } => "INVALID_CONFIG_NAME",
             Self::ConfigNameCollision { .. } => "CONFIG_NAME_COLLISION",
             Self::ConfigMigrationFailed { .. } => "CONFIG_MIGRATION_FAILED",
```

**File**: `crates/iii-compose/src/lifecycle.rs` (modified, +18/-70)
```diff
@@ -29,7 +29,7 @@ use serde::Serialize;
 
 use crate::{
     config::{ComposeFile, Container, RestartPolicy},
-    configuration::{ConfigFile, merge},
+    configuration::merge,
     dag,
     engine::EngineClient,
     error::{ComposeError, Result},
@@ -107,8 +107,6 @@ pub struct LifecycleCtx<'a> {
     /// Namespace the *children* register in — not the daemon's own.
     pub project_namespace: &'a str,
     pub engine_url: &'a str,
-    /// Directory for resolved config files, owner-only.
-    pub config_dir: &'a std::path::Path,
     /// Where installed packages live, shared across projects on this machine.
     pub package_cache: &'a std::path::Path,
     /// Persistent, bounded stdout and stderr for every project worker.
@@ -1020,7 +1018,6 @@ async fn start_one_until_shutdown(
         compose_file: &ctx.file.path,
         container_key: key,
         start: &start,
-        config_path: config.file.as_ref().map(ConfigFile::path),
         config_name: Some(&config.name),
         working_dir: &working_dir,
         user_env: &user_env,
@@ -1058,12 +1055,12 @@ async fn start_one_until_shutdown(
                     .emit(Some(key), "preparing", "preparing VM runtime")
                     .await;
             }
-            wait_or_interrupt!(vm_command(ctx, key, &start, &plan, config.file.as_ref())).map_err(
-                |message| ComposeError::SpawnFailed {
+            wait_or_interrupt!(vm_command(ctx, key, &start, &plan)).map_err(|message| {
+                ComposeError::SpawnFailed {
                     container: key.to_string(),
                     message,
-                },
-            )?
+                }
+            })?
         }
     };
 
@@ -1137,17 +1134,13 @@ async fn start_one_until_shutdown(
 /// which is the same split the installer makes by shipping `iii-worker` as its
 /// own asset.
 ///
-/// The environment sent is the one a host container would get, with one
-/// substitution: `III_CONFIG` names a host path, and the guest cannot open it.
-/// The container's config directory is published into the VM and the variable
-/// is repointed at the file inside it, so a worker reads its configuration the
-/// same way whichever side of the boundary it runs on.
+/// Uses the host container environment. Configuration is served by the engine,
+/// not mounted into the guest.
 async fn vm_command(
     ctx: &LifecycleCtx<'_>,
     key: &str,
     start: &StartSpec,
     plan: &crate::spawn::SpawnPlan,
-    config: Option<&ConfigFile>,
 ) -> std::result::Result<tokio::process::Command, String> {
     let (worker_dir, run_override, prepare_command) = match start {
         StartSpec::Vm(VmSpec::Bundle { install_dir }) => (install_dir, None, "__bundle-prepare"),
@@ -1158,47 +1151,13 @@ async fn vm_command(
         _ => return Err("not a VM container".to_string()),
     };
 
-    let mut env: BTreeMap<String, String> = plan.env.clone();
-    let config_dir = match config {
-        Some(config) => {
-            // Published through a directory of this container's own, not the
-            // project's `config/`. virtiofs shares a whole tree, so mounting
-            // the shared one would put every sibling's resolved secrets inside
-            // this guest. Beside the rootfs rather than inside it: the rootfs
-            // is the guest's `/`, and a `config` directory there would collide
-            // with whatever the image already has.
-            let path = config.path();
-            let Some(name) = path.file_name() else {
-                return Err(format!("config file has no name: {}", path.display()));
-            };
-            let dir = ctx.vm_dir.join(format!("{key}-config"));
-            std::fs::create_dir_all(&dir)
-                .map_err(|err| format!("cannot make {}: {err}", dir.display()))?;
-            let published = dir.join(name);
-            std::fs::copy(path, &published)
-                .map_err(|err| format!("cannot publish the config for the VM: {err}"))?;
-            #[cfg(unix)]
-            {
-                use std::os::unix::fs::PermissionsExt;
-                let _ =
-                    std::fs::set_permissions(&published, std::fs::Permissions::from_mode(0o600));
-            }
-            env.insert(
-                "III_CONFIG".to_string(),
-                format!("{GUEST_CONFIG_DIR}/{}", name.to_string_lossy()),
-            );
-            Some(dir)
-        }
-        None => None,
-    };
-
+    let env: BTreeMap<String, String> = plan.env.clone();
     let request = serde_json::json!({
         "worker_name": key,
         "worker_dir": worker_dir,
         "state_dir": ctx.vm_dir.join(key),
         "engine_url": ctx.engine_url,
         "extra_env": env,
-        "config_dir": config_dir,
         "run_override": run_override,
     });
 
@@ -1217,10 +1176,6 @@ async fn vm_command(
     Ok(command)
 }
 
-/// Where a container's config directory appears inside the guest. The same
-/// constant `iii-worker` mounts it at; 
```

**File**: `crates/iii-compose/src/manifest.rs` (modified, +6/-0)
```diff
@@ -277,6 +277,12 @@ fn check_env_files(key: &str, container: &Container) -> Result<()> {
             source,
         })?;
         for (name, _) in crate::config::parse_env_file(&text) {
+            if crate::spawn::is_retired_config_env(&name) {
+                return Err(ComposeError::RetiredConfigEnv {
+                    container: key.to_string(),
+                    name,
+                });
+            }
             if crate::spawn::is_reserved_env(&name) {
                 return Err(ComposeError::ReservedEnvOverride {
                     container: key.to_string(),
```

**File**: `crates/iii-compose/src/project.rs` (modified, +0/-15)
```diff
@@ -803,10 +803,6 @@ impl Project {
         self.store.dir()
     }
 
-    fn config_dir(&self) -> PathBuf {
-        self.store.dir().join("config")
-    }
-
     /// Per-container VM state: rootfs, boot script, pid file. Keyed by project
     /// rather than by worker name, so two projects using the same container key
     /// stay apart.
@@ -835,7 +831,6 @@ impl Project {
         shutdown: crate::shutdown::ShutdownSignal,
     ) -> Option<OpResult> {
         let shutdown = shutdown.or(self.shutdown.signal());
-        let config_dir = self.config_dir();
         let package_cache = self.package_cache();
         let vm_dir = self.vm_dir();
         let mut inner = shutdown.run(self.inner.lock()).await?;
@@ -853,7 +848,6 @@ impl Project {
             compose_namespace: &self.compose_namespace,
             project_namespace: &self.project_namespace,
             engine_url: &self.engine_url,
-            config_dir: &config_dir,
             logs: &self.logs,
             package_cache: &package_cache,
             vm_dir: &vm_dir,
@@ -885,7 +879,6 @@ impl Project {
         restart: &[String],
         operation_id: String,
     ) -> (Vec<OpResult>, OpResult, bool) {
-        let config_dir = self.config_dir();
         let package_cache = self.package_cache();
         let vm_dir = self.vm_dir();
         let mut inner = self.inner.lock().await;
@@ -907,7 +900,6 @@ impl Project {
             compose_namespace: &self.compose_namespace,
             project_namespace: &self.project_namespace,
             engine_url: &self.engine_url,
-            config_dir: &config_dir,
             logs: &self.logs,
             package_cache: &package_cache,
             vm_dir: &vm_dir,
@@ -975,7 +967,6 @@ impl Project {
         removed: &[String],
         operation_id: String,
     ) -> (Vec<OpResult>, OpResult) {
-        let config_dir = self.config_dir();
         let package_cache = self.package_cache();
         let vm_dir = self.vm_dir();
         let mut inner = self.inner.lock().await;
@@ -996,7 +987,6 @@ impl Project {
                 compose_namespace: &self.compose_namespace,
                 project_namespace: &self.project_namespace,
                 engine_url: &self.engine_url,
-                config_dir: &config_dir,
                 logs: &self.logs,
                 package_cache: &package_cache,
                 vm_dir: &vm_dir,
@@ -1031,7 +1021,6 @@ impl Project {
             compose_namespace: &self.compose_namespace,
             project_namespace: &self.project_namespace,
             engine_url: &self.engine_url,
-            config_dir: &config_dir,
             logs: &self.logs,
             package_cache: &package_cache,
             vm_dir: &vm_dir,
@@ -1074,7 +1063,6 @@ impl Project {
         operation_id: String,
         supervised_attempt: Option<(u32, u32)>,
     ) -> OpResult {
-        let config_dir = self.config_dir();
         let package_cache = self.package_cache();
         let vm_dir = self.vm_dir();
         let Inner {
@@ -1089,7 +1077,6 @@ impl Project {
             compose_namespace: &self.compose_namespace,
             project_namespace: &self.project_namespace,
             engine_url: &self.engine_url,
-            config_dir: &config_dir,
             logs: &self.logs,
             package_cache: &package_cache,
             vm_dir: &vm_dir,
@@ -1112,7 +1099,6 @@ impl Project {
     }
 
     pub async fn down(&self, target: Option<&str>, operation_id: String) -> OpResult {
-        let config_dir = self.config_dir();
         let package_cache = self.package_cache();
         let vm_dir = self.vm_dir();
         let mut inner = self.inner.lock().await;
@@ -1130,7 +1116,6 @@ impl Project {
             compose_namespace: &self.compose_namespace,
             project_namespace: &self.project_namespace,
             engine_url: &self.engine_url,
-            config_dir: &config_dir,
             logs: &self.logs,
             package_cache: &package_cache,
             vm_dir: &vm_dir,
```

**File**: `crates/iii-compose/src/spawn.rs` (modified, +51/-28)
```diff
@@ -24,10 +24,10 @@ use crate::manifest::StartSpec;
 /// Environment variables the daemon owns for every child.
 ///
 /// Not because static configuration outranks an environment variable, which
-/// would be the wrong way round for most settings. Because each of these eight
+/// would be the wrong way round for most settings. Because each of these seven
 /// is already declared in the compose file, and a second declaration of the
 /// same thing is a disagreement nobody resolves. Each earns its place
-/// separately, so adding a ninth is a decision, not a habit:
+/// separately, so adding an eighth is a decision, not a habit:
 ///
 /// - `III_URL` is the daemon's own connection. Readiness is observed over it,
 ///   so a container pointed at another engine is invisible to the daemon that
@@ -44,17 +44,14 @@ use crate::manifest::StartSpec;
 ///   and one daemon may own several compose files, so the namespace and file
 ///   are required for an unambiguous control-plane call. The directory is the
 ///   canonical parent of that file.
-/// - `III_CONFIG` and `III_CONFIG_NAME` are two halves of one delivery: the
-///   merged value is written to the file and published to the entry. Pointing
-///   the child at a different file leaves it reading one value while the
-///   configuration worker holds another.
-pub const RESERVED_ENV: [&str; 8] = [
+/// - `III_CONFIG_NAME` identifies the configuration service entry. Compose
+///   injects the merged execution value there without persisting overrides.
+pub const RESERVED_ENV: [&str; 7] = [
     "III_URL",
     "III_NAMESPACE",
     "III_COMPOSE_NAMESPACE",
     "III_COMPOSE_FILE",
     "III_COMPOSE_DIR",
-    "III_CONFIG",
     "III_CONFIG_NAME",
     "III_WORKER_NAME",
 ];
@@ -71,6 +68,18 @@ pub(crate) fn is_reserved_env(name: &str) -> bool {
     }
 }
 
+/// Retired snapshot key, matched using native environment name semantics.
+pub(crate) fn is_retired_config_env(name: &str) -> bool {
+    #[cfg(windows)]
+    {
+        windows_env_key_eq(name, "III_CONFIG")
+    }
+    #[cfg(not(windows))]
+    {
+        name == "III_CONFIG"
+    }
+}
+
 /// Cloneable so hooks can reuse a container's context with a different command.
 #[derive(Debug, Clone)]
 pub struct SpawnCtx<'a> {
@@ -80,8 +89,6 @@ pub struct SpawnCtx<'a> {
     pub compose_file: &'a Path,
     pub container_key: &'a str,
     pub start: &'a StartSpec,
-    /// Path of the resolved configuration file, when the container has config.
-    pub config_path: Option<&'a Path>,
     /// Which configuration entry this container's value was written to, and
     /// therefore the one it should read from.
     ///
@@ -224,18 +231,8 @@ fn spawn_plan_with_env(ctx: &SpawnCtx<'_>, mut env: BTreeMap<String, String>) ->
         env.insert(HOST_USER_ID_ENV.to_string(), device_id);
     }
     env.insert("III_WORKER_NAME".to_string(), ctx.container_key.to_string());
-    match ctx.config_path {
-        Some(config_path) => {
-            env.insert(
-                "III_CONFIG".to_string(),
-                config_path.to_string_lossy().to_string(),
-            );
-        }
-        // No config for this container: the key must be absent, not stale.
-        None => {
-            env.remove("III_CONFIG");
-        }
-    }
+    // Retired delivery channel: do not inherit a stale snapshot from the host.
+    env.retain(|name, _| !is_retired_config_env(name));
     match ctx.config_name {
         Some(name) => {
             env.insert("III_CONFIG_NAME".to_string(), name.to_string());
@@ -318,7 +315,7 @@ mod tests {
 
     fn ctx<'a>(
         start: &'a StartSpec,
-        config: Option<&'a Path>,
+        _config: Option<&'a Path>,
         user_env: &'a BTreeMap<String, String>,
     ) -> SpawnCtx<'a> {
         SpawnCtx {
@@ -328,7 +325,6 @@ mod tests {
             compose_file: Path::new("/srv/app/worker-compose.yaml"),
             container_key: "api",
             start,
-            config_path: config,
             config_name: None,
             working_dir: Path::new("/srv/app/workers/api"),
             user_env,
@@ -447,13 +443,40 @@ mod tests {
     }
 
     #[test]
-    fn config_path_becomes_iii_config() {
+    fn retired_snapshot_variable_is_not_inherited() {
         let start = StartSpec::Shell("cargo run".to_string());
-        let config = PathBuf::from("/run/iii/compose/api.yaml");
         let user_env = BTreeMap::new();
-        let plan = spawn_plan(&ctx(&start, Some(&config), &user_env));
+        let plan = spawn_plan_with_env(
+            &ctx(&start, None, &user_env),
+            env_of(&[("III_CONFIG", "/stale/snapshot.yaml")]),
+        );
+        assert!(!plan.env.contains_key("III_CONFIG"));
+    }
 
-        assert_eq!(plan.env["III_CONFIG"], "/run/iii/compose/api.yaml");
+    #[test]
+    fn retired_config_filter_respects_platform_environment_names() {
+        let start = StartSpec::Shell("cargo run".to_string());
+        let explicit = if cfg!(windows) {
+            BTreeMap
```

---

### Incident Patch 15: `feaa28b9` (2026-09-24)
**Commit Message**: fix(compose): tie managed engine lifetime to compose (#2227)

**File**: `crates/iii-compose/src/managed_engine.rs` (modified, +22/-4)
```diff
@@ -19,7 +19,7 @@ use tokio::io::AsyncReadExt;
 use crate::{
     config::{CONFIGURABLE_ENGINE_WORKERS, EngineSpec},
     error::{ComposeError, Result},
-    process::{ChildOutput, DEFAULT_STOP_GRACE, Supervised, spawn_supervised_piped},
+    process::{ChildOutput, DEFAULT_STOP_GRACE, Supervised},
     state::StateStore,
 };
 
@@ -30,6 +30,9 @@ const ENGINE_LOG_ARCHIVES: usize = 3;
 const ENGINE_LOCK_FILE: &str = "engine.lock";
 const ENGINE_CONFIG_FILE: &str = "engine-config.yaml";
 const DEFAULT_WORKER_MANAGER_HOST: &str = "0.0.0.0";
+
+/// Private marker enabling the managed engine's stdin lifeline.
+const ENGINE_LIFELINE_STDIN_ENV: &str = "III_COMPOSE_ENGINE_LIFELINE_STDIN";
 const DEFAULT_WORKER_MANAGER_PORT: u16 = 49134;
 
 /// The engine process owned by one foreground compose invocation.
@@ -39,6 +42,7 @@ pub struct ManagedEngine {
     config_path: PathBuf,
     log_path: PathBuf,
     remove_config_on_stop: bool,
+    _lifeline: EngineLifeline,
     _namespace_lock: Option<NamespaceLock>,
 }
 
@@ -140,7 +144,8 @@ impl ManagedEngine {
         command
             .arg("--config")
             .arg(config_path)
-            .stdin(Stdio::null());
+            .env(ENGINE_LIFELINE_STDIN_ENV, "1")
+            .stdin(Stdio::piped());
         #[cfg(target_os = "linux")]
         {
             use std::os::unix::process::CommandExt;
@@ -155,8 +160,8 @@ impl ManagedEngine {
         #[cfg(not(target_os = "linux"))]
         let _ = namespace;
 
-        let (process, output) =
-            spawn_supervised_piped(command).map_err(|err| ComposeError::EngineSpawnFailed {
+        let (process, output, lifeline) =
+            spawn_managed_engine(command).map_err(|err| ComposeError::EngineSpawnFailed {
                 message: format!("could not start {}: {err}", executable.display()),
             })?;
         let logs = capture_output(output, log);
@@ -167,6 +172,7 @@ impl ManagedEngine {
             config_path: config_path.to_path_buf(),
             log_path: log_path.to_path_buf(),
             remove_config_on_stop: false,
+            _lifeline: lifeline,
             _namespace_lock: None,
         })
     }
@@ -221,6 +227,18 @@ impl ManagedEngine {
     }
 }
 
+/// The Compose-owned endpoint whose lifetime governs only the managed engine.
+struct EngineLifeline {
+    _stdin: tokio::process::ChildStdin,
+}
+
+fn spawn_managed_engine(
+    command: tokio::process::Command,
+) -> std::io::Result<(Supervised, ChildOutput, EngineLifeline)> {
+    let (process, output, stdin) = crate::process::spawn_supervised_piped_with_stdin(command)?;
+    Ok((process, output, EngineLifeline { _stdin: stdin }))
+}
+
 #[derive(Serialize)]
 struct MaterializedEngineConfig<'a> {
     #[serde(skip_serializing_if = "Option::is_none")]
```

**File**: `crates/iii-compose/src/process/mod.rs` (modified, +8/-2)
```diff
@@ -24,9 +24,15 @@ pub mod unix;
 pub mod windows;
 
 #[cfg(unix)]
-pub use unix::{ChildOutput, Supervised, spawn_supervised, spawn_supervised_piped};
+pub use unix::{
+    ChildOutput, Supervised, spawn_supervised, spawn_supervised_piped,
+    spawn_supervised_piped_with_stdin,
+};
 #[cfg(windows)]
-pub use windows::{ChildOutput, Supervised, spawn_supervised, spawn_supervised_piped};
+pub use windows::{
+    ChildOutput, Supervised, spawn_supervised, spawn_supervised_piped,
+    spawn_supervised_piped_with_stdin,
+};
 
 /// Fingerprint that distinguishes a live process from a recycled PID.
 ///
```

**File**: `crates/iii-compose/src/process/unix.rs` (modified, +19/-4)
```diff
@@ -52,7 +52,7 @@ const SWEEP_POLL_INTERVAL: Duration = Duration::from_millis(50);
 /// function owns the reaping so that `stop` and `exit_watch` observe the same
 /// event.
 pub fn spawn_supervised(command: tokio::process::Command) -> std::io::Result<Supervised> {
-    spawn_supervised_inner(command, false).map(|(child, _)| child)
+    spawn_supervised_inner(command, false, false).map(|(child, _, _)| child)
 }
 
 /// Same, but with the child's stdout and stderr piped back instead of inherited.
@@ -62,7 +62,17 @@ pub fn spawn_supervised(command: tokio::process::Command) -> std::io::Result<Sup
 pub fn spawn_supervised_piped(
     command: tokio::process::Command,
 ) -> std::io::Result<(Supervised, ChildOutput)> {
-    spawn_supervised_inner(command, true)
+    spawn_supervised_inner(command, true, false).map(|(child, output, _)| (child, output))
+}
+
+/// Same, but preserves a caller-configured piped stdin and returns its writer.
+/// Used only by the managed engine; worker spawns retain null stdin.
+pub fn spawn_supervised_piped_with_stdin(
+    command: tokio::process::Command,
+) -> std::io::Result<(Supervised, ChildOutput, tokio::process::ChildStdin)> {
+    let (child, output, stdin) = spawn_supervised_inner(command, true, true)?;
+    let stdin = stdin.ok_or_else(|| std::io::Error::other("managed engine stdin was not piped"))?;
+    Ok((child, output, stdin))
 }
 
 /// The child's output streams, when they were piped.
@@ -75,14 +85,17 @@ pub struct ChildOutput {
 fn spawn_supervised_inner(
     mut command: tokio::process::Command,
     piped: bool,
-) -> std::io::Result<(Supervised, ChildOutput)> {
+    preserve_stdin: bool,
+) -> std::io::Result<(Supervised, ChildOutput, Option<tokio::process::ChildStdin>)> {
     // Group leader: killpg then reaches the worker and everything it spawns.
     command.process_group(0);
     // Workers are background process-group leaders. Inheriting the daemon's
     // terminal stdin lets a read trigger SIGTTIN, leaving the child stopped in
     // `T` state while readiness waits forever. Workers communicate through iii,
     // never through Compose's controlling terminal.
-    command.stdin(std::process::Stdio::null());
+    if !preserve_stdin {
+        command.stdin(std::process::Stdio::null());
+    }
     if piped {
         command
             .stdout(std::process::Stdio::piped())
@@ -94,6 +107,7 @@ fn spawn_supervised_inner(
         stdout: child.stdout.take(),
         stderr: child.stderr.take(),
     };
+    let stdin = child.stdin.take();
     let pid = child
         .id()
         .ok_or_else(|| std::io::Error::other("child exited before its pid could be read"))?;
@@ -114,6 +128,7 @@ fn spawn_supervised_inner(
             exit: ExitSource::Reaped(exit),
         },
         output,
+        stdin,
     ))
 }
 
```

**File**: `crates/iii-compose/src/process/windows.rs` (modified, +22/-9)
```diff
@@ -11,10 +11,9 @@
 //! console process group, so a graceful `CTRL_BREAK` can be delivered before the
 //! job is terminated outright.
 //!
-//! `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE` is deliberately **not** set. It would
-//! kill every child the moment the daemon exits, and compose requires the
-//! opposite: children survive a daemon crash and are re-adopted on restart
-//! (see [`crate::state`]).
+//! Jobs deliberately do not use `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`: workers
+//! survive a daemon crash and are re-adopted on restart (see [`crate::state`]).
+//! The managed engine uses a separate stdin lifeline instead.
 
 use std::{process::ExitStatus, time::Duration};
 
@@ -79,15 +78,25 @@ const ADOPTED_POLL_INTERVAL: Duration = Duration::from_millis(100);
 /// Spawns `command` in its own job and console process group, and starts
 /// reaping it.
 pub fn spawn_supervised(command: tokio::process::Command) -> std::io::Result<Supervised> {
-    spawn_supervised_inner(command, false).map(|(child, _)| child)
+    spawn_supervised_inner(command, false, false).map(|(child, _, _)| child)
 }
 
 /// Same, but with the child's stdout and stderr piped back instead of inherited,
 /// so compose can own the `[container]` tag on its output.
 pub fn spawn_supervised_piped(
     command: tokio::process::Command,
 ) -> std::io::Result<(Supervised, ChildOutput)> {
-    spawn_supervised_inner(command, true)
+    spawn_supervised_inner(command, true, false).map(|(child, output, _)| (child, output))
+}
+
+/// Same, but preserves a caller-configured piped stdin and returns its writer.
+/// Used only by the managed engine; worker spawns retain null stdin.
+pub fn spawn_supervised_piped_with_stdin(
+    command: tokio::process::Command,
+) -> std::io::Result<(Supervised, ChildOutput, tokio::process::ChildStdin)> {
+    let (child, output, stdin) = spawn_supervised_inner(command, true, true)?;
+    let stdin = stdin.ok_or_else(|| std::io::Error::other("managed engine stdin was not piped"))?;
+    Ok((child, output, stdin))
 }
 
 /// The child's output streams, when they were piped.
@@ -100,13 +109,16 @@ pub struct ChildOutput {
 fn spawn_supervised_inner(
     mut command: tokio::process::Command,
     piped: bool,
-) -> std::io::Result<(Supervised, ChildOutput)> {
+    preserve_stdin: bool,
+) -> std::io::Result<(Supervised, ChildOutput, Option<tokio::process::ChildStdin>)> {
     // Its own console group: CTRL_BREAK can then be aimed at the child alone,
     // rather than at every process sharing the daemon's console.
     command.creation_flags(CREATE_NEW_PROCESS_GROUP);
     // A worker is not an interactive child of Compose. Inheriting stdin can
     // block startup indefinitely and differs from daemon/service semantics.
-    command.stdin(std::process::Stdio::null());
+    if !preserve_stdin {
+        command.stdin(std::process::Stdio::null());
+    }
     if piped {
         command
             .stdout(std::process::Stdio::piped())
@@ -118,6 +130,7 @@ fn spawn_supervised_inner(
         stdout: child.stdout.take(),
         stderr: child.stderr.take(),
     };
+    let stdin = child.stdin.take();
     let pid = child
         .id()
         .ok_or_else(|| std::io::Error::other("child exited before its pid could be read"))?;
@@ -130,7 +143,6 @@ fn spawn_supervised_inner(
         return Err(kill_and_reap(child, err));
     }
     let job = OwnedHandle(job);
-
     let Some(handle) = child.raw_handle() else {
         let err = std::io::Error::other("child handle disappeared before job assignment");
         return Err(kill_and_reap(child, err));
@@ -154,6 +166,7 @@ fn spawn_supervised_inner(
             exit: ExitSource::Reaped(exit),
         },
         output,
+        stdin,
     ))
 }
 
```

**File**: `crates/iii-compose/src/shutdown.rs` (modified, +13/-0)
```diff
@@ -76,11 +76,18 @@ impl ShutdownSignal {
             // listener task gets its first poll.
             let mut interrupted = signal(SignalKind::interrupt()).map_err(signal_error)?;
             let mut terminated = signal(SignalKind::terminate()).map_err(signal_error)?;
+            // A closed terminal window or a dropped SSH session delivers
+            // SIGHUP. Its default action would end the daemon before the
+            // teardown below runs, and the managed engine, which lives in
+            // its own process group precisely so it is not signalled with
+            // us, would keep serving on its port with nobody owning it.
+            let mut hung_up = signal(SignalKind::hangup()).map_err(signal_error)?;
             tokio::spawn(async move {
                 loop {
                     let exit_code = tokio::select! {
                         Some(()) = interrupted.recv() => 130,
                         Some(()) = terminated.recv() => 143,
+                        Some(()) = hung_up.recv() => 129,
                     };
                     request_shutdown(&sender, exit_code);
                 }
@@ -303,6 +310,12 @@ mod tests {
         assert_second_signal_exits(nix::sys::signal::Signal::SIGTERM).await;
     }
 
+    #[cfg(unix)]
+    #[tokio::test]
+    async fn hangup_requests_graceful_shutdown_like_sigterm() {
+        assert_second_signal_exits(nix::sys::signal::Signal::SIGHUP).await;
+    }
+
     #[cfg(unix)]
     async fn assert_second_signal_exits(first: nix::sys::signal::Signal) {
         use nix::{
```

**File**: `engine/Cargo.toml` (modified, +1/-1)
```diff
@@ -138,7 +138,7 @@ rand = "0.8"
 rkyv = "0.8.12"
 nix = { version = "0.30.1", features = ["signal", "process", "term"] }
 libc = "0.2"
-winapi = { version = "0.3.9", features = ["minwindef", "wincon", "winbase", "consoleapi"] }
+winapi = { version = "0.3.9", features = ["minwindef", "wincon", "winbase", "consoleapi", "handleapi"] }
 dirs = "6"
 machineid-rs = "1.2"
 sha2 = "0.10"
```

**File**: `engine/src/main.rs` (modified, +55/-0)
```diff
@@ -233,6 +233,59 @@ fn cli_usage_command_path(cli: &Cli) -> String {
     }
 }
 
+fn arm_compose_engine_lifeline() -> anyhow::Result<()> {
+    use std::io::Read;
+
+    const ENV: &str = "III_COMPOSE_ENGINE_LIFELINE_STDIN";
+    if std::env::var_os(ENV).is_none() {
+        return Ok(());
+    }
+    // This runs after the Linux process-title re-exec but before the async
+    // runtime or any worker exists. Descendants must not inherit the marker or
+    // consume or propagate the engine's private stdin lifeline.
+    unsafe { std::env::remove_var(ENV) };
+    make_stdin_non_inheritable()?;
+
+    std::thread::Builder::new()
+        .name("compose-engine-lifeline".to_string())
+        .spawn(|| {
+            let mut stdin = std::io::stdin().lock();
+            let mut byte = [0_u8; 1];
+            loop {
+                match stdin.read(&mut byte) {
+                    Ok(0) => std::process::exit(0),
+                    Ok(_) => continue,
+                    Err(error) if error.kind() == std::io::ErrorKind::Interrupted => continue,
+                    Err(_) => std::process::exit(1),
+                }
+            }
+        })?;
+    Ok(())
+}
+
+#[cfg(unix)]
+fn make_stdin_non_inheritable() -> std::io::Result<()> {
+    let flags = unsafe { libc::fcntl(libc::STDIN_FILENO, libc::F_GETFD) };
+    if flags == -1
+        || unsafe { libc::fcntl(libc::STDIN_FILENO, libc::F_SETFD, flags | libc::FD_CLOEXEC) } == -1
+    {
+        return Err(std::io::Error::last_os_error());
+    }
+    Ok(())
+}
+
+#[cfg(windows)]
+fn make_stdin_non_inheritable() -> std::io::Result<()> {
+    use std::os::windows::io::AsRawHandle;
+    use winapi::um::{handleapi::SetHandleInformation, winbase::HANDLE_FLAG_INHERIT};
+
+    let stdin = std::io::stdin();
+    if unsafe { SetHandleInformation(stdin.as_raw_handle().cast(), HANDLE_FLAG_INHERIT, 0) } == 0 {
+        return Err(std::io::Error::last_os_error());
+    }
+    Ok(())
+}
+
 /// Make sure the config file exists before the engine loads it.
 ///
 /// Missing file: on an interactive terminal, ask before writing (running
@@ -386,6 +439,8 @@ fn main() -> anyhow::Result<()> {
         }
     }
 
+    arm_compose_engine_lifeline()?;
+
     run(cli_args)
 }
 
```

**File**: `engine/tests/compose_managed_engine_e2e.rs` (modified, +421/-2)
```diff
@@ -59,6 +59,244 @@ fn wait_for_exit(child: &mut std::process::Child, timeout: Duration) {
     panic!("compose did not exit after the shutdown signal");
 }
 
+#[cfg(target_os = "linux")]
+#[derive(Clone, Copy)]
+struct ProcessIdentity {
+    pid: i32,
+    start_time: u64,
+}
+
+#[cfg(target_os = "linux")]
+fn process_status(pid: i32) -> Option<(char, u64)> {
+    let stat = std::fs::read_to_string(format!("/proc/{pid}/stat")).ok()?;
+    let mut fields = stat[stat.rfind(')')? + 1..].split_whitespace();
+    let state = fields.next()?.chars().next()?;
+    let start_time = fields.nth(18)?.parse().ok()?;
+    Some((state, start_time))
+}
+
+#[cfg(target_os = "linux")]
+fn process_identity(pid: i32) -> Option<ProcessIdentity> {
+    process_status(pid).map(|(_, start_time)| ProcessIdentity { pid, start_time })
+}
+
+#[cfg(target_os = "linux")]
+fn process_has_terminated(identity: ProcessIdentity) -> bool {
+    match process_status(identity.pid) {
+        None => true,
+        Some((state, start_time)) => {
+            start_time != identity.start_time || matches!(state, 'Z' | 'X')
+        }
+    }
+}
+
+#[cfg(target_os = "linux")]
+fn wait_for_process_exit(identity: ProcessIdentity, timeout: Duration) -> bool {
+    let deadline = Instant::now() + timeout;
+    while Instant::now() < deadline {
+        if process_has_terminated(identity) {
+            return true;
+        }
+        std::thread::sleep(Duration::from_millis(50));
+    }
+    process_has_terminated(identity)
+}
+
+#[cfg(target_os = "linux")]
+fn wait_for_child_identity(parent_pid: u32, timeout: Duration) -> Option<ProcessIdentity> {
+    let children = format!("/proc/{parent_pid}/task/{parent_pid}/children");
+    let deadline = Instant::now() + timeout;
+    loop {
+        if let Ok(contents) = std::fs::read_to_string(&children) {
+            for pid in contents
+                .split_whitespace()
+                .filter_map(|pid| pid.parse().ok())
+            {
+                if let Some(identity) = process_identity(pid) {
+                    return Some(identity);
+                }
+            }
+        }
+        if Instant::now() >= deadline {
+            return None;
+        }
+        std::thread::sleep(Duration::from_millis(10));
+    }
+}
+
+#[cfg(target_os = "linux")]
+fn signal_same_process(identity: ProcessIdentity, signal: nix::sys::signal::Signal) {
+    if process_identity(identity.pid)
+        .is_some_and(|current| current.start_time == identity.start_time)
+    {
+        let _ = nix::sys::signal::kill(nix::unistd::Pid::from_raw(identity.pid), signal);
+    }
+}
+
+#[cfg(target_os = "linux")]
+fn ptrace_call(request: libc::c_uint, pid: i32, data: usize) -> std::io::Result<()> {
+    let result = unsafe {
+        libc::ptrace(
+            request,
+            pid,
+            std::ptr::null_mut::<libc::c_void>(),
+            data as *mut libc::c_void,
+        )
+    };
+    if result == -1 {
+        Err(std::io::Error::last_os_error())
+    } else {
+        Ok(())
+    }
+}
+
+#[cfg(target_os = "linux")]
+fn seize_fork_events(pid: i32) -> std::io::Result<()> {
+    ptrace_call(
+        libc::PTRACE_SEIZE,
+        pid,
+        (libc::PTRACE_O_TRACEFORK | libc::PTRACE_O_TRACEVFORK) as usize,
+    )
+}
+
+#[cfg(target_os = "linux")]
+fn wait_for_fork_event(pid: i32, timeout: Duration) -> std::io::Result<i32> {
+    let deadline = Instant::now() + timeout;
+    while Instant::now() < deadline {
+        let mut status = 0;
+        let waited = unsafe { libc::waitpid(pid, &mut status, libc::WNOHANG | libc::__WALL) };
+        if waited == 0 {
+            std::thread::sleep(Duration::from_millis(10));
+            continue;
+        }
+        if waited == -1 {
+            return Err(std::io::Error::last_os_error());
+        }
+        if libc::WIFEXITED(status) || libc::WIFSIGNALED(status) {
+            return Err(std::io::Error::other(
+                "Compose exited before spawning its managed engine",
+            ));
+        }
+        if !libc::WIFSTOPPED(status) {
+            continue;
+        }
+
+        let event = status >> 16;
+        if event == libc::PTRACE_EVENT_FORK || event == libc::PTRACE_EVENT_VFORK {
+            let mut child_pid = 0_usize;
+            let result = unsafe {
+                libc::ptrace(
+                    libc::PTRACE_GETEVENTMSG,
+                    pid,
+                    std::ptr::null_mut::<libc::c_void>(),
+                    &mut child_pid as *mut usize as *mut libc::c_void,
+                )
+            };
+            if result == -1 {
+                return Err(std::io::Error::last_os_error());
+            }
+            return Ok(child_pid as i32);
+        }
+        ptrace_call(libc::PTRACE_CONT, pid, 0)?;
+    }
+    Err(std::io::Error::new(
+        std::io::ErrorKind::TimedOut,
+        "Compose did not spawn its managed engine",
+    ))
+}
+
+#[cfg(target_os = "linux")]
+fn wait_for_ptrace_stop(pid: i32, timeout: Duration) ->
```

#### Recent Merged Pull Requests:
- **PR #2268** (2026-10-02): feat(go-sdk): expose schemas for custom trigger types (@andersonleal)
- **PR #2267** (2026-10-02): docs: add 0.24.4 changelog (@guibeira)
- **PR #2266** (2026-10-02): fix(sdk-rust): update async-trait for Rust 1.99 (@guibeira)
- **PR #2264** (2026-10-02): (MOT-4987) fix(observability): release capacity of truncated span attributes (@guibeira)
- **PR #2261** (2026-10-02): fix(engine): reduce KV allocations and decouple heap maintenance (@guibeira)
- **PR #2260** (2026-09-30): (MOT-4949) test(sdk-node): shut down the workers env-contract.test.ts creates (@andersonleal)
- **PR #2259** (2026-09-30): (MOT-4947) feat(engine): let engine::traces::spans leave out span events and links (@andersonleal)
- **PR #2258** (2026-09-30): (MOT-4946) fix(engine): narrow filtered engine::traces::list through root keys and the attribute index (@andersonleal)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
