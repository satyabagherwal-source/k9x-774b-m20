# Forensic Learning Record (Deep Inspection): browseros-ai/BrowserOS

> **Canonical Artifact**: `07_PROJECT_LEARNING/browseros-ai-browseros-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/browseros-ai/BrowserOS](https://github.com/browseros-ai/BrowserOS))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:56:44.661Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `browseros-ai/BrowserOS`
- **Description**: 🌐 The open-source Agentic browser; alternative to ChatGPT Atlas, Perplexity Comet, Dia.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 13824 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/browseros-agent/apps/app-onboard/src/lib/utils.ts`
```
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

```

### Core Architecture Module: `packages/browseros-agent/apps/app/components/ai-elements/queue.tsx`
```
'use client'

import { ChevronDownIcon, PaperclipIcon } from 'lucide-react'
import type { ComponentProps } from 'react'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

export type QueueMessagePart = {
  type: string
  text?: string
  url?: string
  filename?: string
  mediaType?: string
}

export type QueueMessage = {
  id: string
  parts: QueueMessagePart[]
}

export type QueueTodo = {
  id: string
  title: string
  description?: string
  status?: 'pending' | 'completed'
}

export type QueueItemProps = ComponentProps<'li'>

/** @public */
export const QueueItem = ({ className, ...props }: QueueItemProps) => (
  <li
    className={cn(
      'group flex flex-col gap-1 rounded-md px-3 py-1 text-sm transition-colors hover:bg-muted',
      className,
    )}
    {...props}
  />
)

export type QueueItemIndicatorProps = ComponentProps<'span'> & {
  completed?: boolean
}

/** @public */
export const QueueItemIndicator = ({
  completed = false,
  className,
  ...props
}: QueueItemIndicatorProps) => (
  <span
    className={cn(
      'mt-0.5 inline-block size-2.5 rounded-full border',
      completed
        ? 'border-muted-foreground/20 bg-muted-foreground/10'
        : 'border-muted-foreground/50',
      className,
    )}
    {...props}
  />
)

export type QueueItemContentProps = ComponentProps<'span'> & {
  completed?: boolean
}

/** @public */
export const QueueItemContent = ({
  completed = false,
  className,
  ...props
}: QueueItemContentProps) => (
  <span
    className={cn(
      'line-clamp-1 grow break-words',
      completed
        ? 'text-muted-foreground/50 line-through'
        : 'text-muted-foreground',
      className,
    )}
    {...props}
  />
)

export type QueueItemDescriptionProps = ComponentProps<'div'> & {
  completed?: boolean
}

/** @public */
export const QueueItemDescription = ({
  completed = false,
  className,
  ...props
}: QueueItemDescriptionProps) => (
  <div
    className={cn(
      'ml-6 text-xs',
      completed
        ? 'text-muted-foreground/40 line-through'
        : 'text-muted-foreground',
      className,
    )}
    {...props}
  />
)

export type QueueItemActionsProps = ComponentProps<'div'>

/** @public */
export const QueueItemActions = ({
  className,
  ...props
}: QueueItemActionsProps) => (
  <div className={cn('flex gap-1', className)} {...props} />
)

export type QueueItemActionProps = Omit<
  ComponentProps<typeof Button>,
  'variant' | 'size'
>

/** @public */
export const QueueItemAction = ({
  className,
  ...props
}: QueueItemActionProps) => (
  <Button
    className={cn(
      'size-auto rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted-foreground/10 hover:text-foreground group-hover:opacity-100',
      className,
    )}
    size="icon"
    type="button"
    variant="ghost"
    {...props}
  />
)

export type QueueItemAttachmentProps = ComponentProps<'div'>

/** @public */
export const QueueItemAttachment = ({
  className,
  ...props
}: QueueItemAttachmentProps) => (
  <div className={cn('mt-1 flex flex-wrap gap-2', className)} {...props} />
)

export type QueueItemImageProps = ComponentProps<'img'>

/** @public */
export const QueueItemImage = ({
  className,
  ...props
}: QueueItemImageProps) => (
  <img
    alt=""
    className={cn('h-8 w-8 rounded border object-cover', className)}
    height={32}
    width={32}
    {...props}
  />
)

export type QueueItemFileProps = ComponentProps<'span'>

/** @public */
export const QueueItemFile = ({
  children,
  className,
  ...props
}: QueueItemFileProps) => (
  <span
    className={cn(
      'flex items-center gap-1 rounded border bg-muted px-2 py-1 text-xs',
      className,
    )}
    {...props}
  >
    <PaperclipIcon size={12} />
    <span className="max-w-[100px] truncate">{children}</span>
  </span>
)

export type QueueListProps = ComponentProps<typeof ScrollArea>

/** @public */
export const QueueList = ({
  children,
  className,
  ...props
}: QueueListProps) => (
  <ScrollArea className={cn('mt-2 -mb-1', className)} {...props}>
    <div className="max-h-40 pr-4">
      <ul>{children}</ul>
    </div>
  </ScrollArea>
)

// QueueSection - collapsible section container
export type QueueSectionProps = ComponentProps<typeof Collapsible>

/** @public */
export const QueueSection = ({
  className,
  defaultOpen = true,
  ...props
}: QueueSectionProps) => (
  <Collapsible className={cn(className)} defaultOpen={defaultOpen} {...props} />
)

// QueueSectionTrigger - section header/trigger
export type QueueSectionTriggerProps = ComponentProps<'button'>

/** @public */
export const QueueSectionTrigger = ({
  children,
  className,
  ...props
}: QueueSectionTriggerProps) => (
  <CollapsibleTrigger asChild>
    <button
      className={cn(
        'group flex w-full items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-left font-medium text-muted-foreground text-sm transition-colors hover:bg-muted',
        className,
      )}
      type="button"
      {...props}
    >
      {children}
    </button>
  </CollapsibleTrigger>
)

// QueueSectionLabel - label content with icon and count
export type QueueSectionLabelProps = ComponentProps<'span'> & {
  count?: number
  label: string
  icon?: React.ReactNode
}

/** @public */
export const QueueSectionLabel = ({
  count,
  label,
  icon,
  className,
  ...props
}: QueueSectionLabelProps) => (
  <span className={cn('flex items-center gap-2', className)} {...props}>
    <ChevronDownIcon className="size-4 transition-transform group-data-[state=closed]:-rotate-90" />
    {icon}
    <span>
      {count} {label}
    </span>
  </span>
)

// QueueSectionContent - collapsible content area
export type QueueSectionContentProps = ComponentProps<typeof CollapsibleContent>

/** @public */
export const QueueSectionContent = ({
  className,
  ...props
}: QueueSectionContentProps) => (
  <CollapsibleContent className={cn(className)} {...props} />
)

export type QueueProps = ComponentProps<'div'>

/** @public */
export const Queue = ({ className, ...props }: QueueProps) => (
  <div
    className={cn(
      'flex flex-col gap-2 rounded-xl border border-border bg-background px-3 pt-2 pb-2 shadow-xs',
      className,
    )}
    {...props}
  />
)

```

### Core Architecture Module: `packages/browseros-agent/apps/app/components/elements/available-tabs.hooks.ts`
```
import { useEffect, useMemo, useState } from 'react'

export interface UseAvailableTabsOptions {
  enabled: boolean
  filterText?: string
}

export interface UseAvailableTabsResult {
  tabs: chrome.tabs.Tab[]
  allTabs: chrome.tabs.Tab[]
  isLoading: boolean
}

export function useAvailableTabs({
  enabled,
  filterText = '',
}: UseAvailableTabsOptions): UseAvailableTabsResult {
  const [allTabs, setAllTabs] = useState<chrome.tabs.Tab[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    setIsLoading(true)

    chrome.tabs
      .query({ currentWindow: true })
      .then((currentWindowTabs) => {
        if (cancelled) return
        const httpTabs = currentWindowTabs
          .filter((tab) => tab.url?.startsWith('http'))
          .sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0))
        setAllTabs(httpTabs)
        setIsLoading(false)
      })
      .catch((_error) => {
        if (cancelled) return
        setAllTabs([])
        setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [enabled])

  const tabs = useMemo(() => {
    if (!filterText) return allTabs
    const search = filterText.toLowerCase()
    return allTabs.filter(
      (tab) =>
        tab.title?.toLowerCase().includes(search) ||
        tab.url?.toLowerCase().includes(search),
    )
  }, [allTabs, filterText])

  return { tabs, allTabs, isLoading }
}

```

### Core Architecture Module: `packages/browseros-agent/apps/app/hooks/use-mobile.ts`
```
import * as React from 'react'

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener('change', onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return !!isMobile
}

```

### Core Architecture Module: `packages/browseros-agent/apps/app/lib/utils.ts`
```
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * @public
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

```

### Core Architecture Module: `packages/browseros-agent/apps/app/modules/agents/acp-agent-probe.hooks.ts`
```
import { useMutation, useQuery } from '@tanstack/react-query'
import { useAgentServerUrl } from '@/modules/browseros/agent-server-url.hooks'
import type { AcpAgentType, AcpProbeResult } from './acp-agent-types'

export interface ProbeCustomAgentInput {
  command: string
  env?: Record<string, string>
  cwd?: string
}

/**
 * Probe a not-yet-saved custom agent by its command. Manual (mutation) rather
 * than a query so the settings "Test connection" button drives it.
 */
export function useProbeCustomAgent() {
  const { baseUrl } = useAgentServerUrl()

  return useMutation<AcpProbeResult, Error, ProbeCustomAgentInput>({
    mutationFn: async ({ command, env, cwd }) => {
      if (!baseUrl) throw new Error('BrowserOS agent server URL is not ready')
      const response = await fetch(`${baseUrl}/acpx/probe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'custom',
          command,
          ...(env && Object.keys(env).length > 0 ? { env } : {}),
          ...(cwd ? { cwd } : {}),
        }),
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: { message?: string }
        }
        throw new Error(body.error?.message ?? 'Agent probe failed')
      }
      return response.json() as Promise<AcpProbeResult>
    },
  })
}

export function useAcpAgentProbe(
  type: AcpAgentType | undefined,
  enabled = true,
) {
  const { baseUrl } = useAgentServerUrl()

  return useQuery<AcpProbeResult>({
    queryKey: ['acp-agent-probe', type, baseUrl],
    enabled: enabled && Boolean(type && baseUrl),
    staleTime: 0,
    queryFn: async () => {
      const response = await fetch(`${baseUrl}/acpx/probe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: { message?: string }
        }
        throw new Error(body.error?.message ?? 'Agent probe failed')
      }
      return response.json() as Promise<AcpProbeResult>
    },
  })
}

```

### Core Architecture Module: `packages/browseros-agent/apps/app/modules/agents/agents.hooks.ts`
```
import type { AgentRoutes } from '@browseros/server'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { hc } from 'hono/client'
import { Feature } from '@/lib/browseros/capabilities'
import { useAgentServerUrl } from '@/modules/browseros/agent-server-url.hooks'
import { useCapabilities } from '@/modules/browseros/capabilities.hooks'
import type { AcpAgentType, CustomAcpAgentConfig } from './acp-agent-types'
import { computeAgentsSettled } from './agents.helpers'

interface CreateAcpAgentInput {
  name: string
  type: AcpAgentType
  modelId?: string
  reasoningEffort?: string
  workingDirectory?: string
  customConfig?: CustomAcpAgentConfig
}

interface UpdateAcpAgentInput {
  agentId: string
  patch: {
    name?: string
    modelId?: string | null
    reasoningEffort?: string | null
    workingDirectory?: string | null
    customConfig?: CustomAcpAgentConfig
  }
}

const AGENTS_QUERY_KEY = 'acp-agents'

function agentsClient(baseUrl: string) {
  return hc<AgentRoutes>(`${baseUrl}/agents`)
}

// Accept the minimal shape this reads rather than the full `Response`: the Hono
// client returns a `ClientResponse`, which is not structurally the global
// `Response` under the current lib types.
async function agentRequestError(response: {
  status: number
  json: () => Promise<unknown>
}): Promise<Error> {
  const body = (await response.json().catch(() => ({}))) as { error?: string }
  return new Error(
    body.error ?? `Request failed with status ${response.status}`,
  )
}

export function useAcpAgents(enabled = true) {
  const { supports, isLoading: capabilitiesLoading } = useCapabilities()
  const agentsSupported = supports(Feature.AGENT_HARNESS_SUPPORT)
  const {
    baseUrl,
    isLoading: urlLoading,
    error: urlError,
  } = useAgentServerUrl()
  const query = useQuery({
    queryKey: [AGENTS_QUERY_KEY, baseUrl],
    queryFn: async () => {
      const response = await agentsClient(baseUrl as string).index.$get()
      if (!response.ok) throw await agentRequestError(response)
      return response.json()
    },
    enabled: Boolean(baseUrl) && !urlLoading && enabled && agentsSupported,
  })

  return {
    agents: agentsSupported ? (query.data?.agents ?? []) : [],
    loading:
      capabilitiesLoading ||
      (agentsSupported && (query.isLoading || urlLoading)),
    // `loading` (via query.isLoading) briefly reads false on the render the
    // query flips enabled, while `agents` is still empty. `settled` instead
    // stays false until the fetch has succeeded, so callers can tell a
    // not-yet-loaded (or failed) agent list from a genuinely absent one.
    settled: computeAgentsSettled({
      capabilitiesLoading,
      agentsSupported,
      urlLoading,
      agentsQuerySucceeded: query.isSuccess,
    }),
    error: agentsSupported ? (query.error ?? urlError) : null,
    refetch: query.refetch,
  }
}

export function useCreateAcpAgent() {
  const { baseUrl, isLoading } = useAgentServerUrl()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateAcpAgentInput) => {
      if (!baseUrl || isLoading) {
        throw new Error('BrowserOS agent server URL is not ready')
      }
      const response = await agentsClient(baseUrl).index.$post({ json: input })
      if (!response.ok) throw await agentRequestError(response)
      const result = await response.json()
      return result.agent
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: [AGENTS_QUERY_KEY] }),
  })
}

export function useUpdateAcpAgent() {
  const { baseUrl, isLoading } = useAgentServerUrl()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ agentId, patch }: UpdateAcpAgentInput) => {
      if (!baseUrl || isLoading) {
        throw new Error('BrowserOS agent server URL is not ready')
      }
      const response = await agentsClient(baseUrl)[':agentId'].$put({
        param: { agentId },
        json: patch,
      })
      if (!response.ok) throw await agentRequestError(response)
      const result = await response.json()
      return result.agent
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: [AGENTS_QUERY_KEY] }),
  })
}

export function useDeleteAcpAgent() {
  const { baseUrl, isLoading } = useAgentServerUrl()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (agentId: string) => {
      if (!baseUrl || isLoading) {
        throw new Error('BrowserOS agent server URL is not ready')
      }
      const response = await agentsClient(baseUrl)[':agentId'].$delete({
        param: { agentId },
      })
      if (!response.ok) throw await agentRequestError(response)
      return response.json()
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: [AGENTS_QUERY_KEY] }),
  })
}

```

### Core Architecture Module: `packages/browseros-agent/apps/app/modules/browseros/agent-server-url.hooks.ts`
```
import { useEffect, useState } from 'react'
import { resolveAgentServerUrl } from './agent-server-url.helpers'

export type UseAgentServerUrlResult =
  | { baseUrl: string; isLoading: false; error: null }
  | { baseUrl?: never; isLoading: true; error: null }
  | { baseUrl?: never; isLoading: false; error: Error }

/** Resolves the local BrowserOS server URL used by React surfaces. */
export function useAgentServerUrl(): UseAgentServerUrlResult {
  const [state, setState] = useState<UseAgentServerUrlResult>({
    isLoading: true,
    error: null,
  })

  useEffect(() => {
    let cancelled = false

    async function loadUrl() {
      try {
        const url = await resolveAgentServerUrl()
        if (!cancelled) {
          setState({ baseUrl: url, isLoading: false, error: null })
        }
      } catch (e) {
        if (!cancelled) {
          setState({
            isLoading: false,
            error: e instanceof Error ? e : new Error(String(e)),
          })
        }
      }
    }

    void loadUrl()

    return () => {
      cancelled = true
    }
  }, [])

  return state
}

```

### Core Architecture Module: `packages/browseros-agent/apps/app/modules/browseros/capabilities.hooks.ts`
```
import { useCallback, useEffect, useState } from 'react'
import { Capabilities, Feature } from '@/lib/browseros/capabilities'

interface CapabilitiesState {
  browserOSVersion: string | null
  serverVersion: string | null
  supportedFeatures: Map<Feature, boolean>
}

export interface UseCapabilitiesResult {
  supports: (feature: Feature) => boolean
  isLoading: boolean
  browserOSVersion: string | null
  serverVersion: string | null
}

function getInitialSupportedFeatures(): Map<Feature, boolean> {
  return new Map(
    Object.values(Feature)
      .filter((value) => typeof value === 'string')
      .flatMap((feature) => {
        const supported = Capabilities.getStaticSupport(feature as Feature)
        return supported === null
          ? []
          : ([[feature as Feature, supported]] as const)
      }),
  )
}

/**
 * React hook for version-gated feature checks.
 * Auto-initializes Capabilities and caches feature support results.
 *
 * @example
 * const { supports, isLoading } = useCapabilities()
 *
 * if (isLoading) return <Spinner />
 * if (supports(Feature.NEW_SIDEBAR)) return <NewSidebar />
 *
 * @public
 */
export function useCapabilities(): UseCapabilitiesResult {
  const [isLoading, setIsLoading] = useState(true)
  const [state, setState] = useState<CapabilitiesState>(() => ({
    browserOSVersion: null,
    serverVersion: null,
    supportedFeatures: getInitialSupportedFeatures(),
  }))

  useEffect(() => {
    let cancelled = false

    async function init() {
      const [browserOSVersion, serverVersion] = await Promise.all([
        Capabilities.getBrowserOSVersion(),
        Capabilities.getServerVersion(),
      ])

      // Pre-check all features
      const featureChecks = await Promise.all(
        Object.values(Feature)
          .filter((v) => typeof v === 'string')
          .map(async (feature) => {
            const supported = await Capabilities.supports(feature as Feature)
            return [feature as Feature, supported] as const
          }),
      )

      if (!cancelled) {
        setState({
          browserOSVersion,
          serverVersion,
          supportedFeatures: new Map(featureChecks),
        })
        setIsLoading(false)
      }
    }

    init()

    return () => {
      cancelled = true
    }
  }, [])

  const supports = useCallback(
    (feature: Feature): boolean => {
      return state.supportedFeatures.get(feature) ?? false
    },
    [state.supportedFeatures],
  )

  return {
    supports,
    isLoading,
    browserOSVersion: state.browserOSVersion,
    serverVersion: state.serverVersion,
  }
}

```

### Core Architecture Module: `packages/browseros-agent/apps/app/modules/chat-actions/chat-actions.hooks.ts`
```
import { useEffect, useState } from 'react'
import { createBrowserOSAction } from '@/lib/chat-actions/types'
import { track } from '@/lib/metrics/track'
import { useChatSessionContext } from '@/modules/chat/chat-session-context'
import type { ChatMode } from '@/modules/chat/chat-types'

export interface ChatActionsConfig {
  /** Analytics event names scoped to the origin */
  events: {
    modeChanged: string
    stopClicked: string
    suggestionClicked: string
    tabToggled: string
    tabRemoved: string
    aiTriggered: string
  }
  /** Auto-attach current active tab on mount (sidepanel only) */
  autoAttachActiveTab?: boolean
}

export function useChatActions(config: ChatActionsConfig) {
  const session = useChatSessionContext()
  const { mode, setMode, sendMessage, stop, messages } = session

  const [input, setInput] = useState('')
  const [attachedTabs, setAttachedTabs] = useState<chrome.tabs.Tab[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Auto-attach current tab on mount (sidepanel)
  useEffect(() => {
    if (!config.autoAttachActiveTab) return
    ;(async () => {
      const currentTab = (
        await chrome.tabs.query({ active: true, currentWindow: true })
      ).filter((tab) => tab.url?.startsWith('http'))
      setAttachedTabs(currentTab)
    })()
  }, [config.autoAttachActiveTab])

  const handleModeChange = (newMode: ChatMode) => {
    track(config.events.modeChanged, { from: mode, to: newMode })
    setMode(newMode)
  }

  const handleStop = () => {
    track(config.events.stopClicked)
    stop()
  }

  const toggleTabSelection = (tab: chrome.tabs.Tab) => {
    setAttachedTabs((prev) => {
      const isSelected = prev.some((t) => t.id === tab.id)
      track(config.events.tabToggled, {
        action: isSelected ? 'removed' : 'added',
      })
      if (isSelected) {
        return prev.filter((t) => t.id !== tab.id)
      }
      return [...prev, tab]
    })
  }

  const removeTab = (tabId?: number) => {
    track(config.events.tabRemoved)
    setAttachedTabs((prev) => prev.filter((t) => t.id !== tabId))
  }

  const executeMessage = (customMessageText?: string) => {
    const messageText = customMessageText ? customMessageText : input.trim()
    if (!messageText) return

    const sent = attachedTabs.length
      ? sendMessage({
          text: messageText,
          action: createBrowserOSAction({
            mode,
            message: messageText,
            tabs: attachedTabs,
          }),
        })
      : sendMessage({ text: messageText })

    // Keep the draft when the send did not happen, so a refusal does not cost
    // the user what they typed.
    if (!sent) return
    setInput('')
    setAttachedTabs([])
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (messages.length === 0) {
      track(config.events.aiTriggered, {
        mode,
        tabs_count: attachedTabs.length,
      })
    }
    executeMessage()
  }

  const handleSuggestionClick = (suggestion: string) => {
    track(config.events.suggestionClicked, { mode })
    executeMessage(suggestion)
  }

  const { stop: _stop, ...restSession } = session

  return {
    ...restSession,
    input,
    setInput,
    attachedTabs,
    setAttachedTabs,
    mounted,
    handleModeChange,
    handleStop,
    toggleTabSelection,
    removeTab,
    executeMessage,
    handleSubmit,
    handleSuggestionClick,
  }
}

```

### Core Architecture Module: `packages/browseros-agent/apps/app/modules/chat/chat-refs.hooks.ts`
```
import { useEffect, useRef } from 'react'
import useDeepCompareEffect from 'use-deep-compare-effect'
import { type McpServer, useMcpServers } from '@/lib/mcp/mcpServerStorage'
import { usePersonalization } from '@/lib/personalization/personalizationStorage'
import { useChatTargetSelection } from './use-chat-target-selection'

const constructMcpServers = (servers: McpServer[]) => {
  return servers
    .filter((eachServer) => eachServer.type === 'managed')
    .map((each) => each.managedServerName)
}

const constructCustomServers = (servers: McpServer[]) => {
  return servers
    .filter((eachServer) => eachServer.type === 'custom')
    .map((each) => ({
      name: each.displayName,
      url: each.config?.url,
    }))
}

export const useChatRefs = () => {
  const selection = useChatTargetSelection()
  const { servers: mcpServers } = useMcpServers()
  const { personalization } = usePersonalization()

  const enabledMcpServersRef = useRef(constructMcpServers(mcpServers))
  const enabledCustomServersRef = useRef(constructCustomServers(mcpServers))
  const personalizationRef = useRef(personalization)

  useDeepCompareEffect(() => {
    enabledMcpServersRef.current = constructMcpServers(mcpServers)
    enabledCustomServersRef.current = constructCustomServers(mcpServers)
  }, [mcpServers])

  useEffect(() => {
    personalizationRef.current = personalization
  }, [personalization])

  return {
    ...selection,
    enabledMcpServersRef,
    enabledCustomServersRef,
    personalizationRef,
  }
}

```

### Core Architecture Module: `packages/browseros-agent/apps/app/modules/chat/chat-session.hooks.ts`
```
import { useChat } from '@ai-sdk/react'
import { useQueryClient } from '@tanstack/react-query'
import { DefaultChatTransport, type FileUIPart, type UIMessage } from 'ai'
import { compact } from 'es-toolkit/array'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import useDeepCompareEffect from 'use-deep-compare-effect'
import type { Provider } from '@/components/chat/chatComponentTypes'
import {
  conversationForTab,
  conversationPanelViewsStorage,
} from '@/lib/browseros/conversationPanelStorage'
import { isIncognitoWindow } from '@/lib/browseros/incognito'
import { resolvePanelTabId } from '@/lib/browseros/panelTab'
import type { ChatAction } from '@/lib/chat-actions/types'
import {
  CONVERSATION_RESET_EVENT,
  GLOW_STOP_CLICKED_EVENT,
  MESSAGE_DISLIKE_EVENT,
  MESSAGE_LIKE_EVENT,
  MESSAGE_SENT_EVENT,
  PROVIDER_SELECTED_EVENT,
} from '@/lib/constants/analyticsEvents'
import { formatConversationHistory } from '@/lib/conversations/formatConversationHistory'
import { declinedAppsStorage } from '@/lib/declined-apps/storage'
import { resolveChatProvider } from '@/lib/llm-providers/provider-runtime'
import type { ChatRequestBrowserContext } from '@/lib/messaging/server/buildChatRequestBody'
import { track } from '@/lib/metrics/track'
import { searchActionsStorage } from '@/lib/search-actions/searchActionsStorage'
import { selectedTextStorage } from '@/lib/selected-text/selectedTextStorage'
import { sentry } from '@/lib/sentry/sentry'
import { stopAgentStorage } from '@/lib/stop-agent/stop-agent-storage'
import { selectedWorkspaceStorage } from '@/lib/workspace/workspace-storage'
import { resolveAgentServerUrl } from '@/modules/browseros/agent-server-url.helpers'
import { useAgentServerUrl } from '@/modules/browseros/agent-server-url.hooks'
import {
  fetchServerConversation,
  SERVER_CONVERSATIONS_QUERY_KEY,
} from '@/modules/conversations/conversations.hooks'
import { useChatRefs } from './chat-refs.hooks'
import { decideChatSend, drainPendingSends } from './chat-send-decision'
import {
  didStreamingTurnFinish,
  getPersistableMessages,
  shouldPersistHistory,
} from './chat-session-persistence'
import {
  prepareSidepanelSendMessagesRequest,
  toProviderOption,
} from './chat-session-request'
import {
  resolveRestoredChatTarget,
  restoreServerConversation,
} from './chat-session-restore'
import type { ChatMode } from './chat-types'
import { addContentFilterNotice } from './content-filter-notice'
import {
  conversationReconnectUrl,
  fetchConversationRunState,
} from './conversation-run-client'
import { useExecutionHistoryTracker } from './execution-history-tracker.hooks'
import { PanelConversationAttachment } from './panel-conversation-attachment'
import { toLlmProviderConfig } from './sidepanel-chat-targets'
import { stripImageToolOutputs } from './tool-output-strip'

const getLastMessageText = (messages: UIMessage[]) => {
  const lastMessage = messages[messages.length - 1]
  if (!lastMessage) return ''
  return lastMessage.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('')
}

const getLastUserMessageText = (messages: UIMessage[]) => {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === 'user') {
      return getLastMessageText([messages[i]])
    }
  }
  return ''
}

const getLastUserMessageFiles = (messages: UIMessage[]) => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message?.role === 'user') {
      return message.parts.filter((part) => part.type === 'file')
    }
  }
  return []
}

const getResponseAndQueryFromMessageId = (
  messages: UIMessage[],
  messageId: string,
) => {
  const messageIndex = messages.findIndex((each) => each.id === messageId)
  const response = messages?.[messageIndex] ?? []
  const query = messages?.[messageIndex - 1] ?? []
  const responseText = response.parts
    .filter((each) => each.type === 'text')
    .map((each) => each.text)
    .join('\n\n')
  const queryText = query.parts
    .filter((each) => each.type === 'text')
    .map((each) => each.text)
    .join('\n')

  return {
    responseText,
    queryText,
  }
}

export type ChatOrigin = 'sidepanel' | 'newtab'

export interface ChatSessionOptions {
  origin?: ChatOrigin
  /** When false, messages are queued until integrations finish syncing. */
  isIntegrationsSynced?: boolean
}

const NEWTAB_SYSTEM_PROMPT = `IMPORTANT: The user is chatting from the New Tab page. When performing browser actions, ALWAYS open content in a NEW TAB rather than navigating the current tab. The user's new tab page should remain accessible.`

const getUserSystemPrompt = (
  origin: ChatOrigin | undefined,
  personalization: string,
) =>
  origin === 'newtab'
    ? [personalization, NEWTAB_SYSTEM_PROMPT].filter(Boolean).join('\n\n')
    : personalization

const buildRequestBrowserContext = ({
  activeTab,
  action,
  enabledMcpServers,
  customMcpServers,
}: {
  activeTab?: chrome.tabs.Tab
  action?: ChatAction
  enabledMcpServers: Array<string | undefined>
  customMcpServers: {
    name: string
    url?: string
  }[]
}): ChatRequestBrowserContext | undefined => {
  const browserContext: ChatRequestBrowserContext = {}

  if (activeTab) {
    browserContext.windowId = activeTab.windowId
    browserContext.activeTab = {
      id: activeTab.id,
      url: activeTab.url,
      title: activeTab.title,
    }
  }

  if (action?.tabs?.length) {
    browserContext.selectedTabs = action.tabs.map((tab) => ({
      id: tab.id,
      url: tab.url,
      title: tab.title,
    }))
  }

  const managedMcpServers = compact(enabledMcpServers)
  if (managedMcpServers.length) {
    browserContext.enabledMcpServers = managedMcpServers
  }

  if (customMcpServers.length) {
    browserContext.customMcpServers = customMcpServers
  }

  return Object.keys(browserContext).length ? browserContext : undefined
}

export const useChatSession = (options?: ChatSessionOptions) => {
  const {
    selectedLlmProviderRef,
    selectedChatTargetRef,
    enabledMcpServersRef,
    enabledCustomServersRef,
    personalizationRef,
    chatTargets,
    selectedChatTarget,
    selectChatTarget,
    selectedLlmProvider,
    isLoadingProviders,
    hasAnyTarget,
    isSettled,
  } = useChatRefs()
  const queryClient = useQueryClient()

  // Incognito chats are never written to history or the cloud (#1189). Resolved
  // from the hosting window on mount (chrome.extension.inIncognitoContext is
  // false for a side panel in spanning mode). This settles long before any turn
  // ends, so the turn-end save always sees the correct value.
  const [isIncognito, setIsIncognito] = useState(false)
  useEffect(() => {
    let cancelled = false
    isIncognitoWindow().then((incognito) => {
      if (!cancelled) setIsIncognito(incognito)
    })
    return () => {
      cancelled = true
    }
  }, [])
  const persistHistory = shouldPersistHistory(isIncognito)

  const {
    baseUrl: agentServerUrl,
    isLoading: isLoadingAgentUrl,
    error: agentUrlError,
  } = useAgentServerUrl()

  const [searchParams, setSearchParams] = useSearchParams()
  const setSearchParamsRef = useRef(setSearchParams)
  setSearchParamsRef.current = setSearchParams
  const conversationIdParam = searchParams.get('conversationId')
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const [restoreAttempt, setRestoreAttempt] = useState(0)
  const [restoredConversationId, setRestoredConversationId] = useState<
    string | null
  >(null)
  const isRestoringConversation =
    !!conversationIdParam && restoredConversationId !== conversationIdParam

  // Read via a ref because the transport closure below is created only once.
  const persistRef = useRef(persistHistory)
  useEffect(() => {
    persistRef.current = persistHistory
  }, [persistHistory])

  const agentUrlRef = useRef(agentServerUrl)

  useEffect(() => {
    agentUrlRef.current = agentServerUrl
  }, [agentServerUrl])

  // Read through a ref because the search-action watcher below installs once
  // and would otherwise keep the value from first render, when nothing has
  // loaded yet and every send would look unsendable.
  const hasAnyTargetRef = useRef(hasAnyTarget)
  const isSettledRef = useRef(isSettled)

  useEffect(() => {
    hasAnyTargetRef.current = hasAnyTarget
  }, [hasAnyTarget])

  useEffect(() => {
    isSettledRef.current = isSettled
  }, [isSettled])

  const [sendAttemptBlocked, setSendAttemptBlocked] = useState(false)
  // Derived rather than cleared in an effect: connecting a provider makes this
  // false on the next render on its own.
  const sendBlocked = sendAttemptBlocked && !hasAnyTarget

  const canSend =
    !isLoadingAgentUrl &&
    !agentUrlError &&
    !!agentServerUrl &&
    !isRestoringConversation &&
    !restoreError

  const providers: Provider[] = chatTargets.map(toProviderOption)

  const [mode, setMode] = useState<ChatMode>('agent')
  const [textToAction, setTextToAction] = useState<Map<string, ChatAction>>(
    new Map(),
  )
  const [liked, setLiked] = useState<Record<string, boolean>>({})
  const [disliked, setDisliked] = useState<Record<string, boolean>>({})
  const [conversationId, setConversationId] = useState(crypto.randomUUID())
  const conversationIdRef = useRef(conversationId)
  const optionsRef = useRef(options)
  const panelTabRef = useRef<Promise<number | undefined> | undefined>(undefined)
  const attachmentRef = useRef<PanelConversationAttachment | undefined>(
    undefined,
  )
  const localStreamConversationRef = useRef<string | undefined>(undefined)
  const localStreamRunRef = useRef<string | undefined>(undefined)
  const streamRequestRef = useRef<Promise<void> | undefined>(undefined)
  const viewTransitionRef = useRef<Promise<void>>(Promise.resolve())
  const owningTab = () => {
    panelTabRef.current ??= resolvePanelTabId()
    return panelTabRef.current
  }

  useEffect(() => {
    optio
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2762** (2026-09-30): **Daily credits stay at 0/10 and do not reset**
  *Symptoms*: ### Issue Type  Agent Issue  ### Operating System  Windows  ### Description of the bug  My BrowserOS daily credits are stuck at 0/10 and are not resetting at midnight UTC. This problem has continued for many days. When I try to use the BrowserOS hosted model, I get "Daily limit reached / Credits exhausted". Please check and reset/fix my daily credits.  ### Steps to Reproduce  1. Open BrowserOS. 2. Open BrowserOS Assistant/Chat. 3. Select the BrowserOS hosted model. 4. Send any message. 5. The error "Daily limit reached / Credits exhausted" appears. 6. Daily credits stay at 0/10 and do not reset even after midnight UTC.  ### Screenshots / Videos  <img width="1082" height="708" alt="Image" src="https://github.com/user-attachments/assets/108f340d-9f25-4c83-803d-dfd21c04efff" />  ### BrowserOS Version  _No response_  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > Could you share your exact BrowserOS version, whether you are signed in when using the hosted model, and the approximate UTC date/time when you last saw the credits remain at 0/10 after midnight? Does the same counter remain after fully quitting and reopening BrowserOS? Please do not post passwords, API keys, tokens, or other account credentials here.
  > Unfortunately, we're deprecating the free usage tokens and will be removing them in the next release. We're closing this issue because we won't be restoring the daily free-token allowance. Thank you for reporting this, and we're sorry for the inconvenience.

- **Issue #2673** (2026-09-15): **Unable to Open Recent Agent Chat**
  *Symptoms*: ### Issue Type  Agent Issue  ### Operating System  macOS  ### Description of the bug  I like to resume to my previous conversation lots of times and when my computer restarts or when i close my browser and come back, it as usual will show that the chat exist, so i click on it but then it returns to the original default agent panel screen.   <img width="596" height="228" alt="Image" src="https://github.com/user-attachments/assets/ca1ae353-ca3a-4c51-9b0d-dc3d9611fd5c" />  For example here I'll click on one of them, but then it will take me back to the default landing page:   <img width="442" height="513" alt="Image" src="https://github.com/user-attachments/assets/5ca069a3-55b7-42d0-b8df-048e104bb1a5" />  ### Steps to Reproduce  Mentioned above.  ### Screenshots / Videos  _No response_  ### BrowserOS Version  151.0.8160.137  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > a fix has been merged in https://github.com/browseros-ai/BrowserOS/pull/2667 - this will be published in the next update

- **Issue #2479** (2026-09-08): **MCP Tool Schema Pydantic Validation Failure (enum.3)**
  *Symptoms*: ### Issue Type  Both / Not sure  ### Operating System  macOS  ### Description of the bug  Bug Report: The MCP client fails during tool schema decoding when encountering a null (None) value inside a string enumeration array (enum.3) provided by the BrowserOS neo MCP server. Pydantic v2 strict typing expects all enum elements to be valid strings, resulting in a ValidationError.  dcode version : v0.1.65  langchain deepagent dcode  " Error: Agent error: ValidationError: 1 validation error for Schema enum.3   Input should be a valid string [type=string_type, input_value=None, input_type=NoneType]     For further information visit https://errors.pydantic.dev/2.13/v/string_type "  ### Steps to Reproduce  1- set up browseros-neo. "     "browseros-neo": {       "type": "http",       "url": "http://127.0.0.1:9010/mcp"     }, " 2- run  'dcode '. langraph deepagent dcode version : v0.1.65 3- dcode tui result error on any prompt executed: " Error: Agent error: ValidationError: 1 validation error for Schema enum.3   Input should be a valid string [type=string_type, input_value=None, input_type=NoneType]     For further information visit https://errors.pydantic.dev/2.13/v/string_type "  ### Screenshots / Videos  <img width="1016" height="605" alt="Image" src="https://github.com/user-attachments/assets/b1c4b964-5101-4f1c-a32c-c248604eeda6" />  ### BrowserOS Version  BrowserOS - 0.49.5.0  ### Additional Context  works on most  other harnesses; opencode, vscode, antigravity, custom harness.
  **Post-Mortem & Fix Analysis**:
  > The fix is merged and will be released in the next update.  Thanks @avinashgola for the PR!

- **Issue #2436** (2026-09-26): **[macOS] WebAuthn platform authenticator unavailable because app entitlements omit Touch ID keychain groups**
  *Symptoms*: ### Issue Type  Browser Issue  ### Operating System  macOS  ### Description of the bug  BrowserOS on macOS reports that no user-verifying platform authenticator is available for WebAuthn. As a result, websites cannot start passkey/Touch ID authentication.  This is reproducible even when macOS Touch ID is enabled and a fingerprint is enrolled:  - `bioutil -r` reports that biometrics for unlock are enabled. - `bioutil -c` reports an enrolled biometric template. - `PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()` resolves to `false` in BrowserOS.  The installed BrowserOS app's code signature contains device entitlements, but does not contain the WebAuthn-related entitlements:  - `keychain-access-groups` - `com.apple.developer.web-browser.public-key-credential` - a `.webauthn` keychain access group  This appears to be a packaging/signing issue rather than a missing macOS Touch ID setting.  ### Steps to Reproduce  1. Install BrowserOS `0.48.2` on macOS. 2. Open any WebAuthn/passkey relying party that supports a platform authenticator. 3. Run `PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()` in the page context, or attempt a Touch ID/passkey sign-in. 4. Observe that the API returns `false` and the platform authenticator is reported as unavailable.  ### Expected  BrowserOS should report a macOS platform authenticator when Touch ID is enabled, and WebAuthn should be able to invoke Touch ID for passkey operations.  ### Actual  BrowserOS reports 
  **Post-Mortem & Fix Analysis**:
  > The signing code changes landed in #2487, but this isn't fixed in the published 0.50.3 macOS app yet. I checked the arm64 release DMG: there's no embedded provisioning profile, keychain-access-groups entitlement, or com.apple.developer.web-browser.public-key-credential entitlement.  The [release build](https://github.com/browseros-ai/BrowserOS/actions/runs/34011734605/job/101429999474) also explicitly says it signed without macOS platform passkeys because the profile wasn't configured. Keeping this open until a correctly provisioned release ships and the platform-authenticator check is verified. Thanks for identifying the signing requirements. 
  > 不再跟进此问题，关闭。

- **Issue #2423** (2026-09-07): **MCP `run` tool fails with -32600 structuredContent on every success**
  *Symptoms*: ### Issue Type  Both / Not sure  ### Operating System  Linux  ### Description of the bug  `BrowserOS Neo` MCP (`http://localhost:9010/mcp`) — the `run` tool always returns:  MCP error -32600: Tool run has an output schema but did not return structured content  on every successful execution, regardless of payload (`return "hello"`, `console.log`, `browser.pages.list()`, `browser.pages.newPage(...)`).  Side-effects DO execute (e.g. `browser.pages.newPage("https://www.detik.com")` creates a new tab visible via `tabs list`), but the success response is empty.  Error path DOES work — `throw new Error(...)` correctly returns the message. So the bug is success path not populating `structuredContent` despite declaring an `outputSchema`.  Expected: `run` should return `structuredContent`/`content` wrapping the `return` value and `console.log` output.  Granular tools (`tabs`, `snapshot`, `grep`, `screenshot`, `evaluate`) all work fine on same server.  <img width="682" height="637" alt="Image" src="https://github.com/user-attachments/assets/5f9d52ad-2064-4dfe-bd37-0bb41be190d1" />  ### Steps to Reproduce  1. Configure MCP as `"BrowserOS Neo": {"type":"remote","url":"http://localhost:9010/mcp","enabled":true}` in `~/.config/opencode/opencode.jsonc` and restart opencode. 2. Call `run` with `code: 'return "hello";'` → observe `-32600`. 3. Call `run` with `code: 'const p=await browser.pages.newPage("https://example.com"); return "ok";'` → same `-32600`, but `tabs list` shows the new page wa
  **Post-Mortem & Fix Analysis**:
  > This is fixed in [neo server 0.0.50](https://github.com/browseros-ai/BrowserOS/releases/tag/claw-server/v0.0.50), which is on the production server update feed. #2513 preserves structuredContent for tools that declare an output schema, including run, so successful results no longer fail MCP validation.  Thanks for the minimal repro and for distinguishing successful side effects from the broken response. Closing as fixed. The relevant update is neo's server update, separate from the BrowserOS 0.50.3 desktop release. 

- **Issue #2417** (2026-09-07): **Agent Mode Query Fails Midway**
  *Symptoms*: ### Issue Type  Agent Issue  ### Operating System  Windows  ### Description of the bug  I'm encountering an error when using agent mode. Whenever I submit a query, the response stops midway and throws an error message saying “something went wrong.” I tested this with different AI setups, including BrowserOS and OpenAI-compatible APIs, but the issue persists across all of them.  ### Steps to Reproduce  1. open Browser os and Enable Agent Mode 2. Submit a Query 3. Watched the response fail midway with the error.  ### Screenshots / Videos  <img width="468" height="927" alt="Image" src="https://github.com/user-attachments/assets/bb520ab7-2194-470b-b541-487e35dfd6cd" />  ### BrowserOS Version  148.0.7966.97  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > This should be fixed in [BrowserOS 0.50.3](https://github.com/browseros-ai/BrowserOS/releases/tag/v0.50.3), which includes the redesigned agent and updated provider integration. Please update to 0.50.3. Closing this older report; if a task still fails midway, please open a new issue with the current provider/model and the detailed error now shown by the app. Thanks for reporting this.

- **Issue #2279** (2026-08-21): **Bug: Claude Code provider always fails via malformed Windows path for CLAUDE.md.browseros-tmp**
  *Symptoms*: ### Issue Type  Agent Issue  ### Operating System  Windows  ### Description of the bug  Give me a write up for a bug ticket  **Environment** - BrowserOS version: `148.0.7966.97` - OS: Windows (paths use drive-letter format, e.g. `C:\Users\...`) - Provider affected: `claude-code` (via `@agentclientprotocol/claude-agent-acp@0.31.4`) - Claude Code CLI/SDK: `2.1.121`, entrypoint `sdk-ts`  **Summary** Every chat request using the `claude-code` provider fails with a generic `"An error occurred."` toast in the UI, even though the underlying Claude Code ACP subprocess and Anthropic account/auth are fully functional. The root cause is a malformed file path — built by concatenating two absolute paths instead of joining directory + filename — that BrowserOS uses when writing the `CLAUDE.md` workspace-instructions file. Because the resulting path embeds a second drive letter (`C:`) mid-path, it is invalid on Windows and the write fails every single time.  **Steps to reproduce** 1. On Windows, open BrowserOS and start a chat using the `claude-code` provider. 2. Send any message. 3. Observe the UI show "Something went wrong / An error occurred" with a "Try again" button. 4. Network tab shows a 200 response whose SSE body is `{"type":"start"}` followed almost immediately by `{"type":"error","errorText":"An error occurred."}`.  **Relevant log lines** (`%LOCALAPPDATA%\BrowserOS\User Data\.browseros\browseros-server.log`) ```json {"providerType":"claude-code","workspacePath":"C:\\Users\\Triss\
  **Post-Mortem & Fix Analysis**:
  > Update, I'm seeing this event stream with a 200 response on the chat request:   <img width="893" height="961" alt="Image" src="https://github.com/user-attachments/assets/66c503b4-ae4c-455b-bf1d-0087d78c115c" />
  > Thanks for the detailed report!   This is already fixed in https://github.com/browseros-ai/BrowserOS/pull/2099 - the latest update will carry the fix for the problem
  > Duplicate of #1595  The same Windows ACP instruction-file path bug affects CLAUDE.md and AGENTS.md. #1595 contains the original path analysis; both are addressed by #2099.

- **Issue #2168** (2026-08-13): **MCP server incompatible with modern clients (protocol 2026-07-28): "Version negotiation failed" — proposes dual-era support**
  *Symptoms*: ### Issue Type  Browser Issue  ### Operating System  Linux  ### Description of the bug  BrowserOS MCP server (v0.0.127) cannot be used from MCP clients that implement the modern protocol revision 2026-07-28 (per-request _meta, server/discover method). The most common modern client today is ZCode, which reports: "Version negotiation probe failed: the server answered the probe with HTTP 500".  The same BrowserOS instance connects fine from Claude Code, which still speaks the legacy initialize handshake.  This is a protocol-version era mismatch, not a config or header problem. Per the MCP spec (https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning#backward-compatibility-with-initialization-based-versions): modern clients (2026-07-28+) are stateless and probe the server with server/discover, while legacy servers (2025-11-25 and earlier) only understand the initialize handshake. The compatibility matrix is explicit: "Modern client -> Legacy server: Fails."  Even if discovery were bypassed, BrowserOS's JSON-RPC result objects do not include the fields a modern validator requires (resultType, ttlMs, cacheScope, _meta.io.modelcontextprotocol/serverInfo), so subsequent calls like tools/list fail validation: "Invalid result for tools/list: missing required resultType".  Workaround: I wrote a small Python proxy that acts as a dual-era server in front of BrowserOS MCP. Source + install: https://github.com/111blackeagle111/zcode-browseros-mcp-proxy  ### Steps to Reprod
  **Post-Mortem & Fix Analysis**:
  > I wouldn't patch `resultType` / `ttlMs` into each handler. Negotiate the era once at the transport boundary (`server/discover` vs `initialize`), then send every result through a legacy or modern encoder. Otherwise tools, resources, and prompts will drift at different rates.  I work on BitFun; we keep MCP wire mapping isolated for the same reason. The proxy already gives you a nice two-column conformance suite: legacy handshake, modern discovery, then the same list/call cases through both.
  > Thanks, this is a really useful report. We'll fix the error handling so the MCP endpoint returns a proper JSON-RPC / HTTP error for modern probes instead of a 500.  Full stateless 2026-07-28 support is a larger migration to the new MCP SDK line; it's on our radar now that the spec and SDK are stable!
  > The fix is merged to main & the version negotiation should pass once we release the new update!

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

### Incident Patch 1: `671b9a95` (2026-10-05)
**Commit Message**: fix(browser): resolve actual tab owner after popup navigation

## Summary

Fix `Browser.createTab` aborting when its requested window is a popup. Chromium can place the new tab in a normal window; resolve that actual owner and valid strip index before pinning or building the response. Reuse the same lookup for target IDs and preserve the protocol and focus policy.

```text
create tab -> resolve actual owner and valid index -> pin if requested -> report final location
```

## Evidence

- **Before:** prepared Chromium 155 aborted at `IsTabPinned(-1)` in the original replay and the new assertion harness.
- **After:** original replay succeeds; 10/10 isolated headless cases pass for explicit/implicit popup selection, default/background/foreground creation, pinning/reordering, and normal-window controls. Returned identity, owner, index, and pin state agree with both identifier reads and tab lists; headless focus bookkeeping is preserved.
- `autoninja -C out/Default_browseros_arm64 chrome` passed. No Chromium unit/browser test targets were run.
- Independent read-only review: clean across correctness, standards, and source requirements (0 findings). The one cumulative patch byte-matches t

**File**: `packages/browseros/chromium_patches/chrome/browser/devtools/protocol/browser_handler.cc` (modified, +43/-31)
```diff
@@ -1,5 +1,5 @@
 diff --git a/chrome/browser/devtools/protocol/browser_handler.cc b/chrome/browser/devtools/protocol/browser_handler.cc
-index 6af060d287872bf2ae881ff013c124eb7508c839..f2de902c3451c2822aaacc633c6c1a2889fbc5d3 100644
+index 6af060d287872bf2ae881ff013c124eb7508c839..ba4b83551d3cfaf6ff3261a43524edbdd620a2d6 100644
 --- a/chrome/browser/devtools/protocol/browser_handler.cc
 +++ b/chrome/browser/devtools/protocol/browser_handler.cc
 @@ -4,24 +4,39 @@
@@ -62,7 +62,7 @@ index 6af060d287872bf2ae881ff013c124eb7508c839..f2de902c3451c2822aaacc633c6c1a28
  BrowserWindow* GetBrowserWindow(int window_id) {
    BrowserWindow* result = nullptr;
    ForEachCurrentBrowserWindowInterfaceOrderedByActivation(
-@@ -76,6 +104,398 @@ std::unique_ptr<protocol::Browser::Bounds> GetBrowserWindowBounds(
+@@ -76,6 +104,404 @@ std::unique_ptr<protocol::Browser::Bounds> GetBrowserWindowBounds(
        .Build();
  }
  
@@ -200,12 +200,39 @@ index 6af060d287872bf2ae881ff013c124eb7508c839..f2de902c3451c2822aaacc633c6c1a28
 +  return info;
 +}
 +
++// A tab's contents, owning window, and valid strip index for synchronous use.
++// Tab mutations can invalidate the index; pinning returns its new location.
 +struct TabLookupResult {
 +  raw_ptr<content::WebContents> web_contents = nullptr;
 +  raw_ptr<BrowserWindowInterface> bwi = nullptr;
 +  int tab_index = -1;
 +};
 +
++Response ResolveTabLocation(content::WebContents* wc, TabLookupResult* result) {
++  BrowserWindowInterface* found_bwi = nullptr;
++  int found_index = TabStripModel::kNoTab;
++  ForEachCurrentBrowserWindowInterfaceOrderedByActivation(
++      [wc, &found_bwi, &found_index](BrowserWindowInterface* bwi) {
++        TabStripModel* tab_strip = bwi->GetTabStripModel();
++        int index = tab_strip->GetIndexOfWebContents(wc);
++        if (tab_strip->ContainsIndex(index)) {
++          found_bwi = bwi;
++          found_index = index;
++          return false;
++        }
++        return true;
++      });
++
++  if (!found_bwi) {
++    return Response::ServerError("No tab with given id");
++  }
++
++  result->web_contents = wc;
++  result->bwi = found_bwi;
++  result->tab_index = found_index;
++  return Response::Success();
++}
++
 +Response ResolveTabIdentifier(std::optional<std::string> target_id,
 +                              std::optional<int> tab_id,
 +                              TabLookupResult* result) {
@@ -228,28 +255,7 @@ index 6af060d287872bf2ae881ff013c124eb7508c839..f2de902c3451c2822aaacc633c6c1a28
 +      return Response::ServerError("No web contents in the target");
 +    }
 +
-+    BrowserWindowInterface* found_bwi = nullptr;
-+    int found_index = -1;
-+    ForEachCurrentBrowserWindowInterfaceOrderedByActivation(
-+        [wc, &found_bwi, &found_index](BrowserWindowInterface* bwi) {
-+          TabStripModel* tab_strip = bwi->GetTabStripModel();
-+          int idx = tab_strip->GetIndexOfWebContents(wc);
-+          if (idx != TabStripModel::kNoTab) {
-+            found_bwi = bwi;
-+            found_index = idx;
-+            return false;
-+          }
-+          return true;
-+        });
-+
-+    if (!found_bwi) {
-+      return Response::ServerError("No tab with given id");
-+    }
-+
-+    result->web_contents = wc;
-+    result->bwi = found_bwi;
-+    result->tab_index = found_index;
-+    return Response::Success();
++    return ResolveTabLocation(wc, result);
 +  }
 +
 +  // tab_id provided
@@ -461,7 +467,7 @@ index 6af060d287872bf2ae881ff013c124eb7508c839..f2de902c3451c2822aaacc633c6c1a28
  }  // namespace
  
  BrowserHandler::BrowserHandler(protocol::UberDispatcher* dispatcher,
-@@ -126,6 +546,67 @@ Response BrowserHandler::GetWindowForTarget(
+@@ -126,6 +552,67 @@ Response BrowserHandler::GetWindowForTarget(
    return Response::Success();
  }
  
@@ -529,7 +535,7 @@ index 6af060d287872bf2ae881ff013c124eb7508c839..f2de902c3451c2822aaacc633c6c1a28
  Response BrowserHandler::GetWindowBounds(
      int window_id,
      std::unique_ptr<protocol::Browser::Bounds>* out_bounds) {
-@@ -305,3 +786,666 @@ protocol::Response BrowserHandler::AddPrivacySandboxEnrollmentOverride(
+@@ -305,3 +792,672 @@ protocol::Response BrowserHandler::AddPrivacySandboxEnrollmentOverride(
        net::SchemefulSite(url_to_add));
    return Response::Success();
  }
@@ -775,14 +781,20 @@ index 6af060d287872bf2ae881ff013c124eb7508c839..f2de902c3451c2822aaacc633c6c1a28
 +    return Response::ServerError("Failed to create tab");
 +  }
 +
-+  TabStripModel* tab_strip = bwi->GetTabStripModel();
-+  int new_index = tab_strip->GetIndexOfWebContents(new_wc);
++  // Navigation can reroute a popup request into a normal window. Resolve the
++  // actual owner and a valid strip index before pinning or serializing the tab.
++  TabLookupResult lookup;
++  Response response = ResolveTabLocation(new_wc, &lookup);
++  if (!response.IsSuccess()) {
++    return response;
++  }
 +
-+  if (pinned.value_or(false) && new_index != TabStripModel::kNoTab) {
-+    new_index = tab_st
```

---

### Incident Patch 2: `0e0f22f8` (2026-10-05)
**Commit Message**: docs: add Neo Linux downloads to README (#2861)

**File**: `README.md` (modified, +4/-2)
```diff
@@ -15,6 +15,8 @@
 
 <a href="https://cdn.browseros.com/download/BrowserOS_neo.dmg"><img src="https://img.shields.io/badge/Download-macOS-black?style=for-the-badge&logo=apple&logoColor=white" alt="Download for macOS" /></a>
 <a href="https://cdn.browseros.com/download/BrowserOS_neo_installer.exe"><img src="https://img.shields.io/badge/Download-Windows-0078D4?style=for-the-badge&logo=windows&logoColor=white" alt="Download for Windows" /></a>
+<a href="https://cdn.browseros.com/download/BrowserOS_neo.AppImage"><img src="https://img.shields.io/badge/Download-Linux_AppImage-FCC624?style=for-the-badge&logo=linux&logoColor=black" alt="Download for Linux (x64 AppImage)" /></a>
+<a href="https://cdn.browseros.com/download/BrowserOS_neo.deb"><img src="https://img.shields.io/badge/Download-Linux_DEB-D70A53?style=for-the-badge&logo=debian&logoColor=white" alt="Download for Linux (amd64 DEB)" /></a>
 
 **[Website](https://www.browseros.com)** · **[Docs](https://docs.browseros.com)** · **[Enterprise](mailto:founders@browseros.com?subject=Enterprise%3A%20BrowserOS%20neo&body=Hi%2C%0A%0AWe%27re%20looking%20at%20BrowserOS%20neo%20for%20our%20team.%0A%0ACompany%3A%0ATeam%20size%3A%0AWhat%20we%20want%20to%20automate%3A)**
 
@@ -35,7 +37,7 @@ brew tap browseros-ai/tap
 brew install --cask browseros-neo
 ```
 
-Prefer a direct download? Grab it for [macOS](https://cdn.browseros.com/download/BrowserOS_neo.dmg) or [Windows](https://cdn.browseros.com/download/BrowserOS_neo_installer.exe).
+Prefer a direct download? Grab it for [macOS](https://cdn.browseros.com/download/BrowserOS_neo.dmg), [Windows](https://cdn.browseros.com/download/BrowserOS_neo_installer.exe), or Linux x64 ([AppImage](https://cdn.browseros.com/download/BrowserOS_neo.AppImage) · [DEB](https://cdn.browseros.com/download/BrowserOS_neo.deb)).
 
 ### 2. Import from Chrome
 
@@ -135,7 +137,7 @@ Your sessions, screenshots, history, and settings live under `~/.browserclaw/` a
 Yes. Both browsers are Chromium forks, so Chrome extensions work and your bookmarks, passwords, and settings import in one click.
 
 **What platforms are supported?**
-BrowserOS neo runs on macOS and Windows. BrowserOS runs on macOS, Windows, and Linux. System requirements match Google Chrome.
+BrowserOS neo and BrowserOS run on macOS, Windows, and Linux. Neo's Linux builds are x64. System requirements match Google Chrome.
 
 ## Get help
 
```

---

### Incident Patch 3: `b56f75d0` (2026-10-03)
**Commit Message**: fix(claw): bring the feedback invite back 3 days after it is booked or dismissed (#2822)

* fix(claw): bring the feedback invite back 3 days after it is booked or dismissed

* fix(claw): let an open cockpit show the invite again after its snooze

* fix(claw): fence the feedback invite on when its request started

---------

Co-authored-by: capy-ai[bot] <230910855+capy-ai[bot]@users.noreply.github.com>

**File**: `packages/browseros-agent/apps/claw-app/components/cockpit/FeedbackInviteCard.test.tsx` (modified, +46/-37)
```diff
@@ -4,7 +4,7 @@ import { act } from 'react'
 import type { Root } from 'react-dom/client'
 
 interface HookState {
-  invitation: { eligible: boolean; bookUrl?: string }
+  invitation: { eligible: boolean; bookUrl?: string; requestedAt?: number }
   invitationUpdatedAt: number
   recorded: string[]
   recordSucceeds: boolean
@@ -276,22 +276,27 @@ describe('FeedbackInviteCard', () => {
     ])
   })
 
-  /// Taking the card away on booking would punish the reader for accepting: they
-  /// land on a booking page, and if they come back to finish later the invitation
-  /// they agreed to has gone. Only declining removes it.
-  it('stays on screen after booking', async () => {
+  /// Booking puts the card away like declining does. The server brings it back
+  /// after its snooze, since opening the booking page is not the same as booking.
+  it('puts the card away after booking, in this tab and others', async () => {
     state.invitation = eligible
     await render()
 
     await click(buttonWithText('Book a 15 minute chat'))
+    expect(container.innerHTML).toBe('')
+    expect(storage['feedbackInviteDismissedAt:v1']).toBeDefined()
 
-    expect(container.textContent).toContain(
-      "You're one of our most active users",
-    )
-    expect(buttonWithText('Book a 15 minute chat')).toBeDefined()
+    state.recorded = []
+    await act(async () => root.unmount())
+    const { createRoot } = await import('react-dom/client')
+    root = createRoot(container)
+    await render()
+
+    expect(container.innerHTML).toBe('')
+    expect(state.recorded).toEqual([])
   })
 
-  /// The card returns on every cockpit load until it is dismissed, and the cockpit is the
+  /// The card returns on every cockpit load outside a snooze, and the cockpit is the
   /// new tab page. Counting every appearance would report thousands of impressions for one
   /// reader and leave the funnel without a usable denominator.
   it('counts the impression once per profile but still shows the card', async () => {
@@ -335,7 +340,7 @@ describe('FeedbackInviteCard', () => {
     expect(storage.feedbackInviteShownTracked).toBe('true')
   })
 
-  /// The card returns on every load until dismissed, so a dismissal in one tab has to reach
+  /// The card returns on every load outside a snooze, so a dismissal in one tab has to reach
   /// the tabs the reader already has open rather than leaving them still offering it.
   it('stays away in another tab once dismissed', async () => {
     state.invitation = eligible
@@ -356,6 +361,25 @@ describe('FeedbackInviteCard', () => {
     expect(state.recorded).toEqual([])
   })
 
+  /// The cockpit can stay open for days. Once the server offers the card again
+  /// after its snooze, the same mount shows it without a reload.
+  it('comes back on the same mount when a newer server answer is eligible', async () => {
+    state.invitation = eligible
+    await render()
+    await click(buttonWithText('No thanks'))
+    expect(container.innerHTML).toBe('')
+
+    state.recorded = []
+    state.invitationUpdatedAt =
+      Number(storage['feedbackInviteDismissedAt:v1']) + 1
+    await render()
+
+    expect(container.textContent).toContain(
+      "You're one of our most active users",
+    )
+    expect(state.recorded).toEqual(['shown'])
+  })
+
   it('does not persist a browser dismissal when the server write fails', async () => {
     state.invitation = eligible
     state.recordSucceeds = false
@@ -393,41 +417,26 @@ describe('FeedbackInviteCard', () => {
     )
   })
 
-  it('hides an already-visible card when another tab confirms dismissal', async () => {
-    state.invitation = eligible
-    state.invitationUpdatedAt = 1_000
-    await render()
-
-    await publishDismissal(2_000)
-
-    expect(container.innerHTML).toBe('')
-  })
+  /// A request that was already in flight when another tab saved its answer
+  /// lands after that answer, but it was asked before the snooze existed.
+  it('ignores an eligible answer that was requested before the dismissal', async () => {
+    state.invitation = { ...eligible, requestedAt: 1_500 }
+    storage['feedbackInviteDismissedAt:v1'] = '2000'
+    state.invitationUpdatedAt = 3_000
 
-  it('reopens the link on a second click without reporting it twice', async () => {
-    state.invitation = eligible
     await render()
 
-    await click(buttonWithText('Book a 15 minute chat'))
-    await click(buttonWithText('Book a 15 minute chat'))
-
-    expect(state.opened).toEqual([
-      'https://cal.test/book',
-      'https://cal.test/book',
-    ])
-    expect(state.recorded).toEqual(['shown', 'clicked'])
-    expect(
-      state.tracked.filter((event) => event === 'feedback_invite_clicked'),
-    ).toHaveLength(1)
+    expect(container.innerHTML).toBe('')
+    expect(state.recorded).toEqual([])
   })
 
-  it('can still be dismissed after booking', async () => {
+  it('hides an already-visible card when another tab confirms dismissal', async () => {
     state.invitation = 
```

**File**: `packages/browseros-agent/apps/claw-app/components/cockpit/FeedbackInviteCard.tsx` (modified, +44/-49)
```diff
@@ -4,8 +4,8 @@
  * SPDX-License-Identifier: AGPL-3.0-or-later
  *
  * Invites the most active installations to a feedback call. The server decides
- * who is eligible and keeps the invitation open until dismissal; the card
- * asks, shows, and reports back what happened.
+ * who is eligible and snoozes the invitation for a few days after the reader
+ * books or declines; the card asks, shows, and reports back what happened.
  */
 
 import { useQueryClient } from '@tanstack/react-query'
@@ -32,32 +32,35 @@ import {
 const SHOWN_TRACKED_KEY = 'feedbackInviteShownTracked'
 
 /**
- * Fences stale eligible query results after a server-confirmed dismissal. The
- * timestamp is compared with React Query's dataUpdatedAt, so a newer server
- * answer always wins and browser storage never becomes an eligibility source.
+ * Fences stale eligible query results after a server-confirmed answer. The
+ * timestamp is compared with when the query's request started, so a request
+ * already in flight when the answer was saved cannot bring the card back, while
+ * any request made afterwards is the server's word and always wins. Browser
+ * storage never becomes an eligibility source, which is also what lets the card
+ * return once the server's snooze runs out.
  */
-const DISMISSED_AT_KEY = 'feedbackInviteDismissedAt:v1'
+const ANSWERED_AT_KEY = 'feedbackInviteDismissedAt:v1'
 
-function readDismissedAt(): number | null {
+function readAnsweredAt(): number | null {
   try {
-    const value = Number(localStorage.getItem(DISMISSED_AT_KEY))
+    const value = Number(localStorage.getItem(ANSWERED_AT_KEY))
     return Number.isFinite(value) && value > 0 ? value : null
   } catch {
     return null
   }
 }
 
-function rememberDismissal(): void {
+function rememberAnswer(): void {
   try {
-    localStorage.setItem(DISMISSED_AT_KEY, String(Date.now()))
+    localStorage.setItem(ANSWERED_AT_KEY, String(Date.now()))
   } catch {
-    // The server still holds the durable dismissal when storage is unavailable.
+    // The server still holds the snooze when storage is unavailable.
   }
 }
 
-function subscribeToDismissals(listener: () => void): () => void {
+function subscribeToAnswers(listener: () => void): () => void {
   const onStorage = (event: StorageEvent) => {
-    if (event.key === DISMISSED_AT_KEY) listener()
+    if (event.key === ANSWERED_AT_KEY) listener()
   }
   window.addEventListener('storage', onStorage)
   return () => window.removeEventListener('storage', onStorage)
@@ -82,20 +85,20 @@ function rememberImpression(): void {
 /**
  * What this page load has decided to show. The card is copied here once so it
  * cannot be pulled out from under the reader by the query answering again
- * mid-view; it lives on that until they dismiss it.
+ * mid-view; it lives on that until they book or decline.
  */
 type InviteState =
   | { phase: 'waiting' }
   | { phase: 'showing'; bookUrl: string }
-  | { phase: 'dismissed' }
+  | { phase: 'answered' }
 
 export function FeedbackInviteCard() {
   const queryClient = useQueryClient()
   const invitation = useFeedbackInvitation()
   const record = useRecordFeedbackInvite()
-  const dismissedAt = useSyncExternalStore(
-    subscribeToDismissals,
-    readDismissedAt,
+  const answeredAt = useSyncExternalStore(
+    subscribeToAnswers,
+    readAnsweredAt,
     () => null,
   )
   const capturing = useSyncExternalStore(
@@ -105,21 +108,20 @@ export function FeedbackInviteCard() {
   )
   const [state, setState] = useState<InviteState>({ phase: 'waiting' })
   const appeared = useRef(false)
-  const booked = useRef(false)
 
-  const fencedByNewerDismissal =
-    dismissedAt !== null && dismissedAt >= invitation.dataUpdatedAt
+  const askedAt = invitation.data?.requestedAt ?? invitation.dataUpdatedAt
+  const fencedByNewerAnswer = answeredAt !== null && answeredAt >= askedAt
   const offered =
-    invitation.data?.eligible === true && !fencedByNewerDismissal
+    invitation.data?.eligible === true && !fencedByNewerAnswer
       ? invitation.data.bookUrl
       : undefined
   const report = record.mutate
 
   // The impression belongs to the card appearing, and there is no user action
   // to hang that on. The ref keeps it to the first appearance in this page.
   //
-  // The card now returns on every cockpit load until it is dismissed, and the
-  // cockpit is the new tab page, so tracking every appearance would report
+  // The card returns on every cockpit load outside a snooze, and the cockpit is
+  // the new tab page, so tracking every appearance would report
   // thousands of impressions for one reader and make the funnel's denominator
   // meaningless. The analytics event is counted once per profile; the server is
   // told every time, because it is what holds the first-seen timestamp.
@@ -141,53 +143,46 @@ export function FeedbackInviteCard() {
     track(AnalyticsEvent.FeedbackInviteShown)
   }, [capturing, state.phase])
 
-  if (state.phase !== 'showing' || fencedByNew
```

**File**: `packages/browseros-agent/apps/claw-app/modules/api/feedback.hooks.test.ts` (modified, +31/-2)
```diff
@@ -1,5 +1,17 @@
-import { describe, expect, it } from 'bun:test'
-import { useFeedbackInvitation } from './feedback.hooks'
+import { describe, expect, it, mock } from 'bun:test'
+
+let resolveInvitation: (value: { eligible: boolean }) => void = () => {}
+
+mock.module('./client', () => ({
+  apiClient: async () => ({
+    getFeedbackInvitation: () =>
+      new Promise<{ eligible: boolean }>((resolve) => {
+        resolveInvitation = resolve
+      }),
+  }),
+}))
+
+const { useFeedbackInvitation } = await import('./feedback.hooks')
 
 describe('feedback invitation query', () => {
   it('always refreshes the server authority when the card remounts', () => {
@@ -8,4 +20,21 @@ describe('feedback invitation query', () => {
     expect(options.staleTime).toBe(30_000)
     expect(options.refetchOnMount).toBe('always')
   })
+
+  it('stamps the answer with when it was requested, not when it landed', async () => {
+    const before = Date.now()
+    const fetcher = useFeedbackInvitation.fetcher
+    const pending = fetcher(
+      // biome-ignore lint/suspicious/noExplicitAny: the fetcher ignores its context
+      {} as any,
+    )
+    const requestedBy = Date.now()
+    await new Promise((resolve) => setTimeout(resolve, 5))
+    resolveInvitation({ eligible: true })
+    const answer = await pending
+
+    expect(answer.eligible).toBe(true)
+    expect(answer.requestedAt).toBeGreaterThanOrEqual(before)
+    expect(answer.requestedAt).toBeLessThanOrEqual(requestedBy)
+  })
 })
```

**File**: `packages/browseros-agent/apps/claw-app/modules/api/feedback.hooks.ts` (modified, +20/-6)
```diff
@@ -4,8 +4,8 @@
  * SPDX-License-Identifier: AGPL-3.0-or-later
  *
  * The feedback call invitation shown to the most active installations. The
- * server decides who is eligible and keeps an invitation open until dismissal;
- * this only asks and reports back.
+ * server decides who is eligible and snoozes the invitation for a few days
+ * after it is booked or declined; this only asks and reports back.
  */
 
 import type {
@@ -17,16 +17,30 @@ import { apiClient } from './client'
 
 const FEEDBACK_INVITATION_STALE_TIME_MS = 30_000
 
-export const useFeedbackInvitation = createQuery<FeedbackInvitation>({
+/**
+ * The server's answer, stamped with when it was asked for. An answer recorded
+ * after `requestedAt` may not be reflected in it, so the card fences on this
+ * rather than on when the response landed. Answers written straight into the
+ * cache after an outcome come from after the write and carry no stamp.
+ */
+export type StampedFeedbackInvitation = FeedbackInvitation & {
+  requestedAt?: number
+}
+
+export const useFeedbackInvitation = createQuery<StampedFeedbackInvitation>({
   queryKey: ['api', 'feedback', 'invitation'],
-  fetcher: async () => (await apiClient()).getFeedbackInvitation(),
+  fetcher: async () => {
+    const requestedAt = Date.now()
+    const invitation = await (await apiClient()).getFeedbackInvitation()
+    return { ...invitation, requestedAt }
+  },
   staleTime: FEEDBACK_INVITATION_STALE_TIME_MS,
   refetchOnMount: 'always',
 })
 
 // Mutations default to no retries. A lost outcome is not free here: the
-// impression would be counted again on the next cockpit load, and a declined
-// invitation would come back, because the server is the authority on both and
+// impression would be counted again on the next cockpit load, and a booked or
+// declined invitation would come back before its snooze, because the server is the authority on both and
 // never heard. Every outcome write is idempotent, so retrying is safe.
 export const useRecordFeedbackInvite = createMutation<
   FeedbackInvitation,
```

**File**: `packages/browseros-agent/apps/claw-server-rust/src/api/http/feedback.rs` (modified, +15/-10)
```diff
@@ -54,8 +54,8 @@ pub(super) async fn respond(
     record(&state, to_outcome(payload.outcome))
         .await
         .map_err(|source| internal(&request_id, source))?;
-    // The answer a fresh page load would now get, which is still eligible for an impression
-    // or a click and only refused once dismissed. Returning a blanket refusal here would
+    // The answer a fresh page load would now get, which is still eligible after an
+    // impression and refused while a click or dismissal snoozes the card. Returning a blanket refusal here would
     // make the caller's cache disagree with the next load.
     decide(&state)
         .await
@@ -74,12 +74,17 @@ async fn decide(state: &AppState) -> AppResult<FeedbackInvitation> {
     else {
         return Ok(not_eligible());
     };
-    // The card stays available until the reader dismisses it. An impression used to spend
-    // the invitation, which meant one appearance per installation ever, whether or not
-    // anyone read it: the overwhelming majority of a new tab's openings are incidental, so
-    // spending the offer on the first paint threw away nearly all of its reach. Booking is
-    // not an answer either, since opening the booking page is not the same as booking.
-    if state.feedback_invites.has_dismissed(&install_id).await? {
+    // The card stays available except for a few days after the reader books or declines.
+    // An impression used to spend the invitation, which meant one appearance per
+    // installation ever, whether or not anyone read it: the overwhelming majority of a new
+    // tab's openings are incidental, so spending the offer on the first paint threw away
+    // nearly all of its reach. No answer is final either: opening the booking page is not
+    // the same as booking, and a decline is a "not now".
+    if state
+        .feedback_invites
+        .is_snoozed(&install_id, now_ms())
+        .await?
+    {
         return Ok(not_eligible());
     }
     let mut invitation = FeedbackInvitation::new(true);
@@ -104,8 +109,8 @@ async fn record(state: &AppState, outcome: InviteOutcome) -> AppResult<()> {
 ///
 /// An outcome must only ever spend an invitation the installation was actually offered.
 /// Anything able to reach the loopback server can POST here, so without this an unrelated
-/// page or local process could burn an installation's single invitation before it had ever
-/// been shown one, and the row is permanent.
+/// page or local process could snooze an installation's invitation before it had ever been
+/// shown one.
 ///
 /// A row that already exists is updated without consulting the cohort, on purpose: that
 /// invitation was granted by an earlier decision, and a refresh between the card appearing
```

**File**: `packages/browseros-agent/apps/claw-server-rust/src/db/entities/feedback_invite.rs` (modified, +4/-1)
```diff
@@ -12,8 +12,11 @@ pub struct Model {
     pub shown_at_ms: i64,
     pub outcome: String,
     pub settled_at_ms: Option<i64>,
-    /// Set once the reader asks to stop seeing the card. Never cleared.
+    /// The first time the reader declined. Never moved or cleared.
     pub dismissed_at_ms: Option<i64>,
+    /// The latest time the reader booked or declined. The card stays away until
+    /// [`crate::db::feedback_invite::SNOOZE_MS`] has passed since then.
+    pub snoozed_at_ms: Option<i64>,
 }
 
 #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
```

**File**: `packages/browseros-agent/apps/claw-server-rust/src/db/feedback_invite.rs` (modified, +58/-34)
```diff
@@ -12,6 +12,11 @@
 use crate::{db::Database, error::AppResult};
 use sea_orm::{ConnectionTrait, DatabaseBackend, Statement, Value};
 
+/// How long the card stays away after the reader books or declines. Neither answer is
+/// final: opening the booking page is not the same as booking, and a decline is a "not
+/// now", so the card comes back once this has passed since the latest answer.
+pub const SNOOZE_MS: i64 = 3 * 24 * 60 * 60 * 1_000;
+
 #[derive(Clone)]
 pub struct FeedbackInviteRepository {
     db: Database,
@@ -83,18 +88,20 @@ impl FeedbackInviteRepository {
     ) -> AppResult<()> {
         let connection = self.db.connection();
         let dismissed_at = (outcome == InviteOutcome::Dismissed).then_some(now_ms);
+        let snoozed_at = outcome.is_response().then_some(now_ms);
         connection
             .execute(Statement::from_sql_and_values(
                 DatabaseBackend::Sqlite,
                 "INSERT INTO feedback_invite \
-                 (install_id, shown_at_ms, outcome, settled_at_ms, dismissed_at_ms) \
-                 VALUES (?, ?, ?, ?, ?) ON CONFLICT(install_id) DO NOTHING",
+                 (install_id, shown_at_ms, outcome, settled_at_ms, dismissed_at_ms, snoozed_at_ms) \
+                 VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(install_id) DO NOTHING",
                 [
                     Value::from(install_id.to_owned()),
                     Value::from(now_ms),
                     Value::from(outcome.as_str().to_owned()),
                     Value::from(outcome.is_response().then_some(now_ms)),
                     Value::from(dismissed_at),
+                    Value::from(snoozed_at),
                 ],
             ))
             .await?;
@@ -104,9 +111,9 @@ impl FeedbackInviteRepository {
         // dismissed while the gate stayed null, and the card would come back after a
         // restart with no migration left to repair it.
         //
-        // Each column carries its own guard. The outcome only ever rises, by rank. The gate
-        // is only ever set, never moved or cleared, so the first dismissal is the one that
-        // stands and a later click cannot reopen it.
+        // Each column carries its own guard. The outcome only ever rises, by rank. The first
+        // dismissal's time is kept for the funnel. The snooze only ever moves forward, so
+        // the latest answer starts the wait and a retried older one cannot shorten it.
         connection
             .execute(Statement::from_sql_and_values(
                 DatabaseBackend::Sqlite,
@@ -117,14 +124,17 @@ impl FeedbackInviteRepository {
                    settled_at_ms = CASE WHEN ? > (CASE outcome \
                      WHEN 'clicked' THEN 2 WHEN 'dismissed' THEN 1 ELSE 0 END) \
                      THEN ? ELSE settled_at_ms END, \
-                   dismissed_at_ms = COALESCE(dismissed_at_ms, ?) \
+                   dismissed_at_ms = COALESCE(dismissed_at_ms, ?), \
+                   snoozed_at_ms = COALESCE(MAX(snoozed_at_ms, ?), snoozed_at_ms, ?) \
                  WHERE install_id = ?",
                 [
                     Value::from(outcome.rank()),
                     Value::from(outcome.as_str().to_owned()),
                     Value::from(outcome.rank()),
                     Value::from(outcome.is_response().then_some(now_ms)),
                     Value::from(dismissed_at),
+                    Value::from(snoozed_at),
+                    Value::from(snoozed_at),
                     Value::from(install_id.to_owned()),
                 ],
             ))
@@ -135,21 +145,22 @@ impl FeedbackInviteRepository {
     /// Whether this installation has already been offered an invitation.
     ///
     /// Only says the card has been on screen before. It does not gate anything: the card
-    /// keeps appearing until the reader dismisses it, so use [`Self::has_dismissed`] for
-    /// that question.
+    /// keeps appearing outside a snooze, so use [`Self::is_snoozed`] for that question.
     pub async fn already_invited(&self, install_id: &str) -> AppResult<bool> {
         Ok(self.outcome_of(install_id).await?.is_some())
     }
 
-    /// Whether the reader has asked to stop seeing the card. Final once true.
-    pub async fn has_dismissed(&self, install_id: &str) -> AppResult<bool> {
+    /// Whether the reader booked or declined within the last [`SNOOZE_MS`]. Never final:
+    /// once the snooze runs out the card is offered again.
+    pub async fn is_snoozed(&self, install_id: &str, now_ms: i64) -> AppResult<bool> {
         use crate::db::entities::prelude::FeedbackInvite;
         use sea_orm::EntityTrait;
 
         Ok(FeedbackInvite::find_by_id(install_id.to_owned())
             .one(self.db.connection())
             .await?
-            .is_some_and(|row| row.dismissed_at_ms.is_some()))
+            .and_then(|row| row.snoozed_at_ms)
+            .is_some_and(|snoozed_at| now_ms < snoozed_at.saturating_add(SNOOZE_MS)))
     }
 
     /// The re
```

**File**: `packages/browseros-agent/apps/claw-server-rust/src/db/migration.rs` (modified, +63/-0)
```diff
@@ -26,6 +26,7 @@ impl MigratorTrait for Migrator {
             Box::new(m0017_add_run_error_budget::Migration),
             Box::new(m0018_add_feedback_invite::Migration),
             Box::new(m0019_add_feedback_invite_dismissal::Migration),
+            Box::new(m0020_add_feedback_invite_snooze::Migration),
         ]
     }
 }
@@ -2302,3 +2303,65 @@ mod m0019_add_feedback_invite_dismissal {
         DismissedAtMs,
     }
 }
+
+mod m0020_add_feedback_invite_snooze {
+    use super::*;
+
+    pub struct Migration;
+
+    impl MigrationName for Migration {
+        fn name(&self) -> &str {
+            "m0020_add_feedback_invite_snooze"
+        }
+    }
+
+    #[async_trait::async_trait]
+    impl MigrationTrait for Migration {
+        async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
+            // Booking and declining no longer end the invitation; each puts the card away
+            // for a few days from the latest answer. `dismissed_at_ms` keeps the first
+            // decline, so the moving time needs its own column.
+            manager
+                .alter_table(
+                    Table::alter()
+                        .table(FeedbackInvite::Table)
+                        .add_column_if_not_exists(
+                            ColumnDef::new(FeedbackInvite::SnoozedAtMs)
+                                .big_integer()
+                                .null(),
+                        )
+                        .to_owned(),
+                )
+                .await?;
+            // Earlier answers start their snooze from when they were given, so a reader
+            // who declined or booked more than a snooze ago sees the card again.
+            manager
+                .get_connection()
+                .execute_unprepared(
+                    "UPDATE feedback_invite SET snoozed_at_ms = \
+                       MAX(COALESCE(dismissed_at_ms, settled_at_ms), COALESCE(settled_at_ms, dismissed_at_ms)) \
+                     WHERE snoozed_at_ms IS NULL",
+                )
+                .await?;
+            Ok(())
+        }
+
+        async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
+            manager
+                .alter_table(
+                    Table::alter()
+                        .table(FeedbackInvite::Table)
+                        .drop_column(FeedbackInvite::SnoozedAtMs)
+                        .to_owned(),
+                )
+                .await?;
+            Ok(())
+        }
+    }
+
+    #[derive(DeriveIden)]
+    enum FeedbackInvite {
+        Table,
+        SnoozedAtMs,
+    }
+}
```

---

### Incident Patch 4: `c83de8f0` (2026-10-03)
**Commit Message**: fix(build): align source reset with depot_tools Git policy (#2835)

Match depot_tools Git LFS defaults for direct source commands, preserving explicit overrides and hook environments. Honor explicit reset with forced checkout so gclient can reconcile gitlink-to-vendored transitions.

Verified with real Git/LFS/depot_tools failure reproductions and full pin/reset/sync fixtures, clean independent Astra xhigh review, and green PR CI.

**File**: `packages/browseros/bos_build/ci_workflow_test.py` (modified, +3/-1)
```diff
@@ -2358,7 +2358,9 @@ def test_setup_refreshes_base_when_not_at_pinned_chromium_tag(self):
 
         self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
         self.assertEqual(self._outputs()["base_head"], "b" * 40)
-        self.assertIn("checkout --detach refs/tags/1.2.3.4", self.git_log.read_text())
+        self.assertIn(
+            "checkout --force --detach refs/tags/1.2.3.4", self.git_log.read_text()
+        )
         self.assertTrue(self._workspace_root().exists())
 
     def test_setup_repairs_base_with_tracked_changes(self):
```

**File**: `packages/browseros/bos_build/steps/source/provision.py` (modified, +16/-2)
```diff
@@ -40,6 +40,12 @@
 
 def run(cmd, cwd: Path, env: Optional[dict] = None) -> None:
     log_info(f"[source] $ {' '.join(str(c) for c in cmd)}  (cwd={cwd})")
+    if cmd[0] == "git":
+        # Match depot_tools' Git-on-Borg policy: Googlesource does not serve LFS
+        # objects. Inherit this default through recursive Git children, while
+        # preserving explicit overrides and leaving gclient's hooks unchanged.
+        env = dict(os.environ if env is None else env)
+        env.setdefault("GIT_LFS_SKIP_SMUDGE", "1")
     subprocess.run(cmd, cwd=cwd, env=env, check=True)
 
 
@@ -395,10 +401,18 @@ def checkout(
     tag_ref = f"refs/tags/{version}"
     if reset and _git_output(["rev-parse", "--verify", "HEAD"], cwd=src):
         reset_source(src)
+    args = ["git", "checkout"]
+    if reset:
+        # A former DEPS gitlink may now be a tracked directory. Resetting its
+        # old HEAD does not remove the files obstructing checkout; explicit
+        # reset permits replacing them. The final gclient sync backs up the
+        # obsolete repository metadata and cleans stale dependency files.
+        args += ["--force"]
     if branch:
-        run(["git", "checkout", "-B", branch, tag_ref], cwd=src)
+        args += ["-B", branch, tag_ref]
     else:
-        run(["git", "checkout", "--detach", tag_ref], cwd=src)
+        args += ["--detach", tag_ref]
+    run(args, cwd=src)
     return src
 
 
```

---

### Incident Patch 5: `981bfc38` (2026-10-03)
**Commit Message**: fix(build): provision the pinned Windows SDK before Chromium patches (#2830)

* fix(build): provision pinned Windows SDK on managed CI

* fix(build): preserve local SDK architectures and correct CI context

* fix(build): isolate PowerShell SDK checks and verify debugger versions

* fix(build): share isolated PowerShell host for all SDK checks

* chore(ci): restore build-system workflow after SDK smoke dispatch

* fix(ci): retain Windows SDK installer diagnostics after failures

**File**: `.github/workflows/build-browseros.yml` (modified, +14/-0)
```diff
@@ -137,6 +137,9 @@ jobs:
       # build CLI with UnicodeEncodeError; force UTF-8 for python and all
       # its subprocesses (gclient, hooks). No-op on Linux/macOS.
       PYTHONUTF8: "1"
+      # This ephemeral CI host may install the SDK required by the selected
+      # Chromium pin. Local builds only validate; the module never elevates.
+      BROWSEROS_INSTALL_WINDOWS_SDK: ${{ inputs.platform == 'windows' && '1' || '0' }}
     steps:
       - name: Validate inputs
         env:
@@ -460,6 +463,17 @@ jobs:
           overwrite: true
           retention-days: 30
 
+      # SDK setup can fail before browser artifacts exist. Preserve the native
+      # installer diagnostics before the ephemeral Windows runner is destroyed.
+      - name: Upload Windows SDK installer logs
+        if: always() && inputs.platform == 'windows'
+        uses: actions/upload-artifact@v7
+        with:
+          name: windows-sdk-logs-${{ inputs.product }}-${{ inputs.arch }}
+          path: ${{ runner.temp }}/browseros-windows-sdk-*/*.log
+          if-no-files-found: ignore
+          retention-days: 14
+
       - name: Report disk usage
         if: always()
         run: df -h || true
```

**File**: `packages/browseros/bos_build/core/planner.py` (modified, +6/-2)
```diff
@@ -227,7 +227,9 @@ def _plan_release(switches: Switches, platform: str) -> List[str]:
         # needs the vendored library whether or not the build is signed
         # (ninja: 'third_party/winsparkle/x64/Release/WinSparkle.dll'
         # missing and no known rule to make it).
-        steps.append("winsparkle_setup")
+        # Requirements come from the selected source, after provisioning and
+        # before resources/patches. Prepared CI (provision=none) checks too.
+        steps.extend(["windows_sdk", "winsparkle_setup"])
 
     if switches.resource_mode == "source":
         steps.extend(["prepare_common_resources", "prepare_server_resources"])
@@ -264,7 +266,9 @@ def _plan_debug(switches: Switches, platform: str) -> List[str]:
     steps: List[str] = []
     steps.extend(_provision_steps(switches))
     if platform == "windows":
-        steps.append("winsparkle_setup")
+        # Requirements come from the selected source, after provisioning and
+        # before resources/patches. Prepared CI (provision=none) checks too.
+        steps.extend(["windows_sdk", "winsparkle_setup"])
     if switches.resource_mode == "source":
         steps.extend(["prepare_common_resources", "prepare_server_resources"])
     elif switches.download:
```

**File**: `packages/browseros/bos_build/core/planner_test.py` (modified, +3/-0)
```diff
@@ -54,6 +54,7 @@ def test_windows_signed(self):
             [
                 "clean",
                 "git_setup",
+                "windows_sdk",
                 "winsparkle_setup",
                 "download_resources",
                 "resources",
@@ -185,6 +186,7 @@ def test_windows_ci_swaps_sign_for_mini_installer(self):
         self.assertEqual(
             plan(CI, "x64", "windows"),
             [
+                "windows_sdk",
                 "winsparkle_setup",
                 "download_resources",
                 "resources",
@@ -248,6 +250,7 @@ def test_debug_windows_builds_installer_before_packaging(self):
             plan(Switches(preset="debug"), "x64", "windows"),
             [
                 "git_setup",
+                "windows_sdk",
                 "winsparkle_setup",
                 "download_resources",
                 "resources",
```

**File**: `packages/browseros/bos_build/core/step_test.py` (modified, +2/-1)
```diff
@@ -24,6 +24,7 @@ def test_all_pipeline_steps_registered(self):
                 "git_setup",
                 "sparkle_setup",
                 "winsparkle_setup",
+                "windows_sdk",
                 "download_resources",
                 "prepare_common_resources",
                 "prepare_server_resources",
@@ -72,7 +73,7 @@ def test_phase_order_matches_legacy_execution_order_macos(self):
     def test_platform_filtering_windows_and_linux(self):
         self.assertEqual(
             phase_steps("setup", "windows"),
-            ["clean", "git_setup", "winsparkle_setup"],
+            ["clean", "git_setup", "winsparkle_setup", "windows_sdk"],
         )
         self.assertEqual(phase_steps("setup", "linux"), ["clean", "git_setup"])
         self.assertEqual(phase_steps("sign", "windows"), ["sign_windows"])
```

**File**: `packages/browseros/bos_build/docs/windows-sdk-setup.md` (added, +22/-0)
```diff
@@ -0,0 +1,22 @@
+# Windows SDK setup
+
+Windows release/debug plans run `windows_sdk` after source preparation and before product resources and patches. It also runs for prepared CI checkouts (`--provision none`). Planning with `--show-plan` does not inspect source or install anything.
+
+The selected Chromium tag supplies both SDK directory pins (`build/vs_toolchain.py` and `build/toolchain/win/setup_toolchain.py`) and the package requirement (`docs/windows_build_instructions.md`). For example, SDK package `10.0.28000.2270` installs into directory `10.0.28000.0`. An older source checkout or conflicting requirements fail before installation.
+
+To check an already prepared checkout without building:
+
+```powershell
+uv run --project packages/browseros browseros build --modules windows_sdk `
+  --chromium-src C:/chromium/src --arch x64 --build-type release
+```
+
+Local builds only check. When prerequisites are missing, install the package requested by the pinned Chromium documentation from [Microsoft's SDK downloads](https://learn.microsoft.com/en-us/windows/apps/windows-sdk/downloads), selecting Desktop C++ x86/x64 and Debugging Tools for Windows, then rerun. ARM64 builds additionally need their existing target libraries and debugging tools; automatic installation is currently scoped to the x64 CI lane.
+
+The reusable Windows build explicitly sets `BROWSEROS_INSTALL_WINDOWS_SDK=1`. Installation additionally requires `GITHUB_ACTIONS=true` and an already elevated process. The module never opens a UAC prompt or requests a restart. It resolves the exact package from Microsoft's supported downloads table and validates its Microsoft Authenticode signature before launching the quiet installer. Installation is machine-wide; `WINDOWSSDKDIR`, when set, selects the same root used by Chromium.
+
+Every invocation verifies nonempty headers, libraries, resource/manifest/IDL tools, and debugging DLLs, plus machine registration at or above the required servicing version in the same SDK family. It then runs the pinned Chromium `vs_toolchain.py get_toolchain_dir` and `setup_toolchain.py` for x86/x64 (and ARM64 when requested). The environment-block argument is `none`, so these checks generate no environment files, GN files, or Ninja files.
+
+An installer failure leaves logs in the printed `browseros-windows-sdk-*` directory under `RUNNER_TEMP` on managed CI. The reusable workflow uploads those logs as `windows-sdk-logs-<product>-<arch>` even if the build fails, retaining them for 14 days. Only the transient “another installation is running” result is automatically retried, up to three attempts. Other failures stop the build and can be retried after fixing the reported cause; there is no completion marker that could conceal a partial installation. A successful installer result still requires the file and Chromium environment checks to pass. A reboot-required result is reported, then accepted only if those checks succeed immediately.
+
+Microsoft's [runner image installation script](https://github.com/actions/runner-images/blob/main/images/windows/scripts/build/Install-VisualStudio.ps1) documents the SDK feature selection and quiet/no-restart pattern; [Windows Installer error codes](https://learn.microsoft.com/en-us/windows/win32/msi/error-codes) describe the busy and reboot results. A passing SDK check establishes SDK environment readiness, not a complete Chromium build or release.
```

**File**: `packages/browseros/bos_build/steps/__init__.py` (modified, +2/-0)
```diff
@@ -8,6 +8,7 @@
 from .source.provision import SourceCheckoutModule, SourceSyncModule
 from .setup.clean import CleanModule
 from .setup.git import GitSetupModule, SparkleSetupModule, WinSparkleSetupModule
+from .setup.windows_sdk import WindowsSDKModule
 from .storage.download import DownloadResourcesModule
 from .resources.source import PrepareCommonResourcesModule, PrepareServerResourcesModule
 from .resources.resources import ResourcesModule
@@ -35,6 +36,7 @@
     "GitSetupModule",
     "SparkleSetupModule",
     "WinSparkleSetupModule",
+    "WindowsSDKModule",
     "DownloadResourcesModule",
     "PrepareCommonResourcesModule",
     "PrepareServerResourcesModule",
```

**File**: `packages/browseros/bos_build/steps/setup/windows_sdk.py` (added, +473/-0)
```diff
@@ -0,0 +1,473 @@
+"""Satisfy the selected Chromium pin's host Windows SDK before product work.
+
+Source preparation owns checkout/sync; this module owns the machine prerequisite.
+Local builds only inspect it. Explicitly opted-in, elevated GitHub runners may
+install Microsoft's SDK, then prove Chromium can load both x86 and x64 tools.
+"""
+
+import ast
+import ctypes
+import json
+import os
+import re
+import shutil
+import subprocess
+import sys
+import tempfile
+import time
+import urllib.request
+from dataclasses import dataclass
+from html.parser import HTMLParser
+from pathlib import Path
+from urllib.parse import urlparse
+
+from ...core.context import Context
+from ...core.step import Step, ValidationError, step
+from ...lib.utils import log_info, log_success, log_warning
+
+_DOWNLOADS = "https://learn.microsoft.com/en-us/windows/apps/windows-sdk/downloads"
+_FEATURES = (
+    "OptionId.DesktopCPPx86",
+    "OptionId.DesktopCPPx64",
+    "OptionId.WindowsDesktopDebuggers",
+)
+_VERSION = r"\d+\.\d+\.\d+\.\d+"
+
+
+@dataclass(frozen=True)
+class _Requirement:
+    """Keep the installer servicing version distinct from the SDK folder pin."""
+
+    directory: str
+    package: str
+    debugger: str
+
+
+def _requirement(ctx: Context) -> _Requirement:
+    # Do this just-in-time, never during whole-plan preflight: provisioning may
+    # replace a cached older checkout earlier in this very pipeline.
+    head = _capture(["git", "rev-parse", "HEAD"], ctx.chromium_src).strip()
+    pin = _capture(
+        ["git", "rev-parse", f"refs/tags/{ctx.chromium_version}^{{commit}}"],
+        ctx.chromium_src,
+    ).strip()
+    if head != pin:
+        raise ValidationError(
+            f"Windows SDK check requires prepared Chromium {ctx.chromium_version}; "
+            f"HEAD is {head}, expected {pin}. Run source preparation first."
+        )
+    versions = []
+    for relative in ("build/vs_toolchain.py", "build/toolchain/win/setup_toolchain.py"):
+        path = ctx.chromium_src / relative
+        tree = ast.parse(path.read_text(encoding="utf-8"))
+        values = [
+            node.value.value
+            for node in tree.body
+            if isinstance(node, ast.Assign)
+            and any(
+                isinstance(t, ast.Name) and t.id == "SDK_VERSION" for t in node.targets
+            )
+            and isinstance(node.value, ast.Constant)
+            and isinstance(node.value.value, str)
+        ]
+        if len(values) != 1 or not re.fullmatch(_VERSION, values[0]):
+            raise ValidationError(f"Cannot read Chromium SDK_VERSION from {path}")
+        versions.append(values[0])
+    if versions[0] != versions[1]:
+        raise ValidationError(f"Chromium SDK pins disagree: {versions}")
+    instructions = (ctx.chromium_src / "docs/windows_build_instructions.md").read_text(
+        encoding="utf-8"
+    )
+    match = re.search(
+        r"\[Windows (?:10|11) SDK\]\([^\n]+\)\s*version\s+(" + _VERSION + r")",
+        instructions,
+    )
+    if not match or match[1].split(".")[:3] != versions[0].split(".")[:3]:
+        raise ValidationError(
+            "Cannot reconcile the Windows SDK package in pinned Chromium docs "
+            "with SDK_VERSION; update the SDK requirement reader for this pin."
+        )
+    debugger = re.search(r"SDK Debugging Tools\s+(" + _VERSION + r")", instructions)
+    if not debugger:
+        raise ValidationError(
+            "Cannot read the debugging tools requirement from pinned Chromium docs"
+        )
+    return _Requirement(versions[0], match[1], debugger[1])
+
+
+def _sdk_root() -> Path:
+    # Match vs_toolchain.py's host-SDK lookup, including an explicit local override.
+    return Path(
+        os.environ.get("WINDOWSSDKDIR")
+        or (
+            Path(os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)"))
+            / "Windows Kits"
+            / "10"
+        )
+    )
+
+
+def _required_files(root: Path, version: str, target: str) -> list[Path]:
+    headers = [
+        "um/windows.h",
+        "shared/sdkddkver.h",
+        "ucrt/stdio.h",
+        "winrt/windows.foundation.h",
+        "cppwinrt/winrt/base.h",
+    ]
+    files = [root / "Include" / version / name for name in headers]
+    for arch in ("x86", "x64"):
+        files.extend(
+            [
+                root / "Lib" / version / "um" / arch / "kernel32.lib",
+                root / "Lib" / version / "ucrt" / arch / "ucrt.lib",
+                root / "Debuggers" / arch / "dbghelp.dll",
+            ]
+        )
+        files.extend(
+            root / "bin" / version / arch / tool
+            for tool in ("rc.exe", "mt.exe", "midl.exe", "d3dcompiler_47.dll")
+        )
+    # Cross-compiling ARM64 still uses x64-hosted tools. Keep that existing
+    # local flow checkable without adding ARM provisioning to the CI image.
+    if target == "arm64":
+        files.extend(
+            [
+                root / "Lib" / version / "um" / "arm6
```

---

### Incident Patch 6: `67b11e13` (2026-10-03)
**Commit Message**: fix(build): prepare Chromium source before macOS workspace copies (#2828)

Share exact-pin source preparation across local builds, cloud caches, and macOS workspace preparation. Refresh the locked persistent macOS base once and copy isolated product workspaces before patching. Preserve no-clean behavior, custom configuration, checkout identity, and lock ownership.

Verified with independent review, real Git/depot_tools and APFS exercises, and green build-system, Windows bootstrap, and release CI.

**File**: `.github/scripts/macos-chromium-workspace.sh` (modified, +29/-420)
```diff
@@ -1,434 +1,43 @@
 #!/usr/bin/env bash
 set -Eeuo pipefail
 
-state_path=""
-marker_name=".browseros-workspace-state.env"
-workspace_parent_name="browseros-ci-apfs-workspaces"
-workspace_prefix="browseros-ci-chromium-"
-setup_cleanup_active=0
-
-die() {
-  echo "::error::$*" >&2
+# Python owns the whole prepare-and-copy transaction. In particular, a shell
+# `source ensure; cp` sequence would release the base lock before copying it.
+script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
+repo_root="$(cd "$script_dir/../.." && pwd -P)"
+package_root="$repo_root/packages/browseros"
+run_tag="${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}"
+
+if [ -z "${RUNNER_TEMP:-}" ]; then
+  echo "::error::RUNNER_TEMP is required for owned workspace recovery" >&2
   exit 1
-}
-
-warn() {
-  echo "::warning::$*" >&2
-}
-
-append_env() {
-  local path="$1"
-  local name="$2"
-  local value="$3"
-  if [ -n "$path" ]; then
-    printf '%s=%s\n' "$name" "$value" >> "$path"
-  fi
-}
-
-run_tag() {
-  printf '%s-%s\n' "${GITHUB_RUN_ID:-local}" "${GITHUB_RUN_ATTEMPT:-1}"
-}
-
-default_state_path() {
-  [ -n "${RUNNER_TEMP:-}" ] || return 1
-  printf '%s/browseros-ci-chromium-workspace-%s.env\n' "$RUNNER_TEMP" "$(run_tag)"
-}
-
-resolve_state_path() {
-  if [ -n "${MACOS_CHROMIUM_WORKSPACE_STATE_PATH:-}" ]; then
-    state_path="$MACOS_CHROMIUM_WORKSPACE_STATE_PATH"
-    return 0
-  fi
-  state_path="$(default_state_path)"
-}
-
-owned_state_path() {
-  local expected
-  expected="$(default_state_path 2>/dev/null)" || return 1
-  [ "$1" = "$expected" ]
-}
-
-require_owned_state_path() {
-  if ! owned_state_path "$state_path"; then
-    die "Unexpected macOS Chromium workspace state path: $state_path"
-  fi
-}
-
-expand_home() {
-  local path="$1"
-  printf '%s\n' "${path/#\~/$HOME}"
-}
-
-resolve_existing_dir() {
-  local path
-  path="$(expand_home "$1")"
-  [ -d "$path" ] || return 1
-  (cd "$path" && pwd -P)
-}
-
-stat_device() {
-  stat -f '%d' "$1"
-}
-
-read_chromium_version() {
-  local version_file="$1"
-  awk -F= '
-    $1 == "MAJOR" { major=$2 }
-    $1 == "MINOR" { minor=$2 }
-    $1 == "BUILD" { build=$2 }
-    $1 == "PATCH" { patch=$2 }
-    END {
-      if (major == "" || minor == "" || build == "" || patch == "") {
-        exit 1
-      }
-      printf "%s.%s.%s.%s\n", major, minor, build, patch
-    }
-  ' "$version_file"
-}
-
-default_version_file() {
-  local script_dir repo_root
-  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
-  repo_root="$(cd "$script_dir/../.." && pwd -P)"
-  printf '%s/packages/browseros/CHROMIUM_VERSION\n' "$repo_root"
-}
-
-write_workspace_state() {
-  local path="$1"
-  {
-    printf 'workspace_parent=%s\n' "$workspace_parent"
-    printf 'workspace_root=%s\n' "$workspace_root"
-    printf 'workspace_src=%s\n' "$workspace_src"
-    printf 'base_root=%s\n' "$base_root"
-    printf 'base_src=%s\n' "$base_src"
-    printf 'base_head=%s\n' "$base_head"
-    printf 'chromium_version=%s\n' "$chromium_version"
-    printf 'run_tag=%s\n' "$tag"
-  } > "$path"
-}
-
-read_state_file() {
-  workspace_parent=""
-  workspace_root=""
-  workspace_src=""
-  base_root=""
-  base_src=""
-  base_head=""
-  chromium_version=""
-  tag=""
-
-  local state_line
-  while IFS= read -r state_line; do
-    case "$state_line" in
-      workspace_parent=*) workspace_parent="${state_line#workspace_parent=}" ;;
-      workspace_root=*) workspace_root="${state_line#workspace_root=}" ;;
-      workspace_src=*) workspace_src="${state_line#workspace_src=}" ;;
-      base_root=*) base_root="${state_line#base_root=}" ;;
-      base_src=*) base_src="${state_line#base_src=}" ;;
-      base_head=*) base_head="${state_line#base_head=}" ;;
-      chromium_version=*) chromium_version="${state_line#chromium_version=}" ;;
-      run_tag=*) tag="${state_line#run_tag=}" ;;
-    esac
-  done < "$1"
-}
-
-owned_workspace_path() {
-  local path="$1"
-  local parent="$2"
-
-  [ -n "$path" ] || return 1
-  [ -n "$parent" ] || return 1
-  [ "$path" != "/" ] || return 1
-  [ "$path" != "${HOME:-}" ] || return 1
-  case "$path" in
-    "$parent"/"$workspace_prefix"*) return 0 ;;
-    *) return 1 ;;
-  esac
-}
-
-marker_matches_workspace() {
-  local marker="$1"
-  local expected_workspace="$2"
-  local expected_base="${3:-}"
-  local marker_workspace=""
-  local marker_base=""
-  local line
-
-  [ -f "$marker" ] || return 1
-  while IFS= read -r line; do
-    case "$line" in
-      workspace_root=*) marker_workspace="${line#workspace_root=}" ;;
-      base_root=*) marker_base="${line#base_root=}" ;;
-    esac
-  done < "$marker"
-
-  [ "$marker_workspace" = "$expected_workspace" ] || return 1
-  [ -z "$expected_base" ] || [ "$marker_base" = "$expected_base" ]
-}
-
-cleanup_workspace_path() {
-  local target="$1"
-  local parent="$2"
-  local expected_base="${3:-}"
-  local resolved_target resolved_parent marker
-
-  [ -n "$target" ] || return 0
-  [ -e "$target" ] || return 0
-  [ -d "$target" ] || {
-    warn "Ig
```

**File**: `.github/workflows/build-browseros.yml` (modified, +8/-17)
```diff
@@ -310,33 +310,24 @@ jobs:
             --key "${{ steps.pin.outputs.cache_key }}" \
             --root "$CHROMIUM_ROOT"
 
-      - name: Ensure chromium checkout at pinned tag
+      - name: Prepare chromium source and dependencies
         run: |
           set -euo pipefail
           uv run --project packages/browseros browseros source ensure \
-            --root "$CHROMIUM_ROOT" --step checkout \
+            --root "$CHROMIUM_ROOT" --reset \
             --repair-cached-depot-tools
 
-      - name: Reset chromium tree (clean module)
+      - name: Clean cached product outputs and resources
         working-directory: packages/browseros
         run: |
           set -euo pipefail
-          uv run browseros build --modules clean \
-            --chromium-src "$CHROMIUM_SRC" \
-            --build-type release \
-            --arch "${{ inputs.arch }}" \
+          # Output-only cleanup preserves the toolchains restored by sync.
+          uv run browseros source clean-outputs --root "$CHROMIUM_ROOT" \
+            --all-products --arch "${{ inputs.arch }}" \
             --product "${{ inputs.product }}"
 
-      - name: Sync chromium dependencies (gclient)
-        run: |
-          set -euo pipefail
-          uv run --project packages/browseros browseros source ensure \
-            --root "$CHROMIUM_ROOT" --step sync \
-            --repair-cached-depot-tools
-
-      # Save immediately after sync: the tree is pristine (no BrowserOS or
-      # BrowserClaw patches, no out/ dir), which keeps the cache deterministic
-      # and as small as possible.
+      # Save only after successful preparation and output cleanup, before
+      # product patches/resources. The root is exclusive to this hosted job.
       - name: Save chromium checkout (WarpCache)
         if: runner.os != 'Windows' && steps.warpcache.outputs.cache-hit != 'true'
         uses: WarpBuilds/cache/save@v1
```

**File**: `.github/workflows/release-macos.yml` (modified, +18/-5)
```diff
@@ -266,7 +266,8 @@ jobs:
         id: chromium_workspace
         working-directory: ${{ steps.inputs.outputs.browseros_repo }}
         shell: bash
-        run: bash .github/scripts/macos-chromium-workspace.sh setup "${{ steps.inputs.outputs.chromium_src }}"
+        # Prepare once and copy every product before either build applies patches.
+        run: bash .github/scripts/macos-chromium-workspace.sh setup "${{ steps.inputs.outputs.chromium_src }}" "${{ steps.inputs.outputs.products }}"
 
       - name: Setup Bun
         if: steps.inputs.outputs.resource_mode == 'source' && steps.inputs.outputs.products == 'browseros'
@@ -348,6 +349,8 @@ jobs:
         working-directory: ${{ steps.inputs.outputs.browseros_repo }}/packages/browseros
         env:
           BROWSEROS_BUILD_SOURCE_SHA: ${{ steps.sync.outputs.source_sha }}
+          BROWSEROS_CHROMIUM_SRC: ${{ steps.chromium_workspace.outputs.browseros_chromium_src }}
+          BROWSERCLAW_CHROMIUM_SRC: ${{ steps.chromium_workspace.outputs.browserclaw_chromium_src }}
           BROWSEROS_SERVER_RESOURCE_VERSION: ${{ steps.inputs.outputs.products == 'browseros' && inputs.server_version || '' }}
           BROWSERCLAW_SERVER_RESOURCE_VERSION: ${{ steps.inputs.outputs.products == 'browserclaw' && inputs.server_version || '' }}
           ONBOARDING_RESOURCE_VERSION: ${{ inputs.onboarding_version }}
@@ -373,12 +376,24 @@ jobs:
         run: |
           set -euo pipefail
           for product in ${{ steps.inputs.outputs.product_ids }}; do
+            case "$product" in
+              browseros) chromium_src="$BROWSEROS_CHROMIUM_SRC" ;;
+              browserclaw) chromium_src="$BROWSERCLAW_CHROMIUM_SRC" ;;
+              *) echo "::error::Unknown product: $product"; exit 1 ;;
+            esac
+            test -n "$chromium_src"
+            # Prune persistent BrowserOS resource leftovers without resetting
+            # the prepared source. Universal retains this copy for both arches.
+            uv run browseros source clean-outputs \
+              --root "$(dirname "$chromium_src")" \
+              --product "$product" \
+              --arch "${{ steps.inputs.outputs.arch }}"
             args=(
-              --preset release
+              --profile release-ci
               --product "$product"
               --arch "${{ steps.inputs.outputs.arch }}"
               --resource-mode "${{ steps.inputs.outputs.resource_mode }}"
-              --chromium-src "${{ steps.chromium_workspace.outputs.chromium_src }}"
+              --chromium-src "$chromium_src"
             )
             if [ "${{ steps.inputs.outputs.upload_to_r2 }}" != "true" ]; then
               args+=(--no-upload)
@@ -396,8 +411,6 @@ jobs:
 
       - name: Clean up disposable Chromium workspace
         if: always()
-        env:
-          MACOS_CHROMIUM_WORKSPACE_STATE_PATH: ${{ steps.chromium_workspace.outputs.state_path }}
         shell: bash
         run: |
           set -euo pipefail
```

**File**: `.github/workflows/reusable-build-macos-nightly.yml` (modified, +7/-3)
```diff
@@ -173,7 +173,7 @@ jobs:
         id: chromium_workspace
         working-directory: ${{ steps.inputs.outputs.browseros_repo }}
         shell: bash
-        run: bash .github/scripts/macos-chromium-workspace.sh setup "${{ steps.inputs.outputs.chromium_src }}"
+        run: bash .github/scripts/macos-chromium-workspace.sh setup "${{ steps.inputs.outputs.chromium_src }}" "${{ inputs.product }}"
 
       - name: Verify shared browser version
         env:
@@ -238,6 +238,12 @@ jobs:
         run: |
           set -euo pipefail
           cd "$BROWSEROS_REPO/packages/browseros"
+          # Resource caches live outside Chromium. Prune those leftovers while
+          # retaining the synchronized source and its hook-managed toolchains.
+          uv run browseros source clean-outputs \
+            --root "$(dirname "$CHROMIUM_SRC")" \
+            --product "$PRODUCT" \
+            --arch arm64
           uv run browseros build \
             --profile nightly-macos \
             --product "$PRODUCT" \
@@ -249,8 +255,6 @@ jobs:
       # this job; leaking either resource poisons the next queued product build.
       - name: Clean up disposable Chromium workspace
         if: always()
-        env:
-          MACOS_CHROMIUM_WORKSPACE_STATE_PATH: ${{ steps.chromium_workspace.outputs.state_path }}
         shell: bash
         run: |
           set -euo pipefail
```

**File**: `packages/browseros/bos_build/README.md` (modified, +7/-4)
```diff
@@ -130,12 +130,15 @@ Profiles are saved switch sets in `profiles/`:
 
 | Profile | Used by | What it sets |
 | --- | --- | --- |
-| `release-ci` | `build-browseros.yml`, the reusable Linux/Windows lane | `preset: release`, `clean: false`, `provision: none` — the workflow provisions and caches Chromium itself |
+| `release-ci` | `build-browseros.yml` and macOS release lanes | `preset: release`, `clean: false`, `provision: none` — the workflow provisions and caches Chromium itself |
 | `nightly-ci` | unsigned cloud nightlies | the same, plus `sign: false`, `upload: false` |
-| `nightly-macos` | both products in the signed family nightly | `preset: release`, `resource_mode: published` |
+| `nightly-macos` | both products in the signed family nightly | `preset: release`, `resource_mode: published`, `clean: false`, `provision: none` |
 
-`release-macos.yml` runs `--preset release` against the persistent checkout on
-the self-hosted Mac and receives source or published mode from its caller.
+`release-macos.yml` refreshes the infrastructure-owned Chromium base to the exact
+pin, then APFS-copies it into independent product workspaces while holding the
+base lock. Builds consume those copies through `release-ci`; a universal build
+keeps one copy across both architectures. The caller selects source or published
+resources. Ordinary local `--preset release` still cleans and provisions source.
 
 Deeper flag semantics — `--skip`, `--from`, `--gn-arg`, `modules:` profiles,
 ephemeral runners — live in [`docs/build-cli.md`](docs/build-cli.md).
```

**File**: `packages/browseros/bos_build/ci_workflow_test.py` (modified, +119/-69)
```diff
@@ -394,9 +394,8 @@ def test_git_bootstrap_precedes_every_chromium_lifecycle_phase(self):
             "Resolve chromium pin and paths",
             "Restore chromium checkout (WarpCache)",
             "Restore chromium checkout (R2)",
-            "Ensure chromium checkout at pinned tag",
-            "Reset chromium tree (clean module)",
-            "Sync chromium dependencies (gclient)",
+            "Prepare chromium source and dependencies",
+            "Clean cached product outputs and resources",
         ):
             with self.subTest(phase=phase):
                 self.assertLess(bootstrap_index, indexes[phase])
@@ -405,8 +404,7 @@ def test_source_ensure_explicitly_repairs_disposable_depot_tools_cache(self):
         steps = self.build_steps()
 
         for phase in (
-            "Ensure chromium checkout at pinned tag",
-            "Sync chromium dependencies (gclient)",
+            "Prepare chromium source and dependencies",
         ):
             with self.subTest(phase=phase):
                 step = next(step for step in steps if step.get("name") == phase)
@@ -1474,19 +1472,25 @@ def test_macos_release_builds_inside_disposable_chromium_workspace(self):
         )
         self.assertIn("macos-chromium-workspace.sh setup", setup["run"])
         self.assertIn("${{ steps.inputs.outputs.chromium_src }}", setup["run"])
+        self.assertIn("${{ steps.inputs.outputs.products }}", setup["run"])
         self.assertIn(
-            '--chromium-src "${{ steps.chromium_workspace.outputs.chromium_src }}"',
+            '--chromium-src "$chromium_src"',
             build["run"],
         )
+        for product in ("browseros", "browserclaw"):
+            self.assertEqual(
+                build["env"][f"{product.upper()}_CHROMIUM_SRC"],
+                "${{ steps.chromium_workspace.outputs." + product + "_chromium_src }}",
+            )
+        self.assertIn("--profile release-ci", build["run"])
+        self.assertIn("browseros source clean-outputs", build["run"])
+        self.assertNotIn("--modules clean", build["run"])
         self.assertNotIn(
             '--chromium-src "${{ steps.inputs.outputs.chromium_src }}"',
             build["run"],
         )
         self.assertEqual(workspace_cleanup["if"], "always()")
-        self.assertEqual(
-            workspace_cleanup["env"]["MACOS_CHROMIUM_WORKSPACE_STATE_PATH"],
-            "${{ steps.chromium_workspace.outputs.state_path }}",
-        )
+        self.assertNotIn("MACOS_CHROMIUM_WORKSPACE_STATE_PATH", workspace_cleanup.get("env", {}))
         self.assertIn("macos-chromium-workspace.sh", workspace_cleanup["run"])
         self.assertIn(" cleanup", workspace_cleanup["run"])
         self.assertEqual(keychain_cleanup["if"], "always()")
@@ -1961,13 +1965,17 @@ def test_internal_builder_uses_reservation_and_frozen_artifact_source(self):
             "--resource-mode published",
         ):
             self.assertIn(token, build["run"])
+        self.assertIn("browseros source clean-outputs", build["run"])
+        self.assertNotIn("--modules clean", build["run"])
+        workspace_setup = self.named_step(workflow, "build", "Setup disposable Chromium workspace")
+        self.assertIn("${{ inputs.product }}", workspace_setup["run"])
         self.assertIn("Clean up disposable Chromium workspace", text)
         self.assertIn("Clean up macOS signing keychain", text)
         self.assertIn("actions/upload-artifact@v7", text)
         self.assertIn("release.json", text)
         self.assertNotIn("gh release create", text)
 
-@unittest.skipIf(os.name == "nt", "macOS signing helper shell tests run on POSIX")
+@unittest.skipIf(os.name == "nt", "macOS workspace helper shell tests run on POSIX")
 class MacOSChromiumWorkspaceHelperTest(unittest.TestCase):
     def setUp(self):
         self.tmp = tempfile.TemporaryDirectory()
@@ -1994,38 +2002,47 @@ def setUp(self):
         self.base_root_resolved = self.base_root.resolve()
         self.base_src_resolved = self.base_src.resolve()
         self.head = "a" * 40
-        self._write_fake_uname()
-        self._write_fake_stat()
+        self._write_fake_uv()
         self._write_fake_git()
         self._write_fake_cp()
+        depot_tools = self.base_root / "depot_tools"
+        (depot_tools / ".git").mkdir(parents=True)
+        gclient = depot_tools / "gclient"
+        gclient.write_text("#!/usr/bin/env bash\nset -euo pipefail\nprintf '%s\\n' \"$*\" >> \"$GCLIENT_LOG\"\n")
+        gclient.chmod(0o755)
 
     def tearDown(self):
         self.tmp.cleanup()
 
-    def _write_fake_uname(self):
-        uname = self.bin_dir / "uname"
-        uname.write_text(
-            """#!/usr/bin/env bash
-set -euo pipefail
-printf '%s\\n' "${UNAME_VALUE:-Darwin}"
-"""
-        )
-        uname.chmod(0o755)
+    def _write_fake_uv(self):
+        import sys
 
-    def _write_fake_stat(self):
-        stat = self.bin_dir / "stat"
-        stat.write_text(
-            """#!/usr/bin/env bash
-
```

**File**: `packages/browseros/bos_build/cli/source.py` (modified, +109/-19)
```diff
@@ -1,21 +1,19 @@
 #!/usr/bin/env python3
-"""Source CLI - Chromium checkout provisioning and caching.
+"""Source lifecycle CLI: hold checkout ownership across each complete mutation.
 
-On a fresh remote runner the whole provisioning story is:
-
-    browseros source ensure --root /work/chromium --step checkout
-    browseros build --modules clean --chromium-src /work/chromium/src ...
-    browseros source ensure --root /work/chromium --step sync
-
-(checkout and sync are split so clean can run between them; clean
-deletes hook-managed toolchains that sync restores.)
+CI normally uses `source ensure --root ... --reset`. Legacy split checkout/sync
+commands remain available, but only the complete operation prepares source.
 """
 
 from pathlib import Path
 from typing import Optional
 
 import typer
 
+from ..core.checkout_lock import ChromiumCheckoutLock
+from ..core.context import Context
+from ..core.products import get_product_descriptor
+from ..steps.setup.clean import CleanModule, clean_ci_outputs
 from ..lib.paths import get_package_root
 from ..lib.utils import log_error, log_info
 from ..steps.source import cache as source_cache
@@ -52,13 +50,19 @@ def ensure_cmd(
     step: str = typer.Option(
         "all",
         "--step",
-        help="checkout, sync, or all (split so clean can run between)",
+        help="all prepares source; checkout/sync are legacy partial operations",
     ),
     version_file: Optional[Path] = typer.Option(
         None,
         "--version-file",
         help="CHROMIUM_VERSION pin file (default: package root)",
     ),
+    reset: bool = typer.Option(
+        False, "--reset", help="Discard source and dependency changes before syncing"
+    ),
+    lock_wait: bool = typer.Option(
+        False, "--lock-wait", help="Wait for the checkout owner"
+    ),
     repair_cached_depot_tools: bool = typer.Option(
         False,
         "--repair-cached-depot-tools",
@@ -86,25 +90,110 @@ def ensure_cmd(
     log_info(f"Chromium root: {root.resolve()}")
 
     try:
-        ensure(
-            root.resolve(),
-            version,
-            strategy=strategy,
-            step_name=step,
-            repair_cached_depot_tools=repair_cached_depot_tools,
-        )
+        # Build adapters already hold this same lock. The source-only CLI owns
+        # it here so stale-cache repair cannot race a build or another prepare.
+        with ChromiumCheckoutLock(root / "src", product="source", wait=lock_wait):
+            ensure(
+                root.expanduser().resolve(),
+                version,
+                strategy=strategy,
+                step_name=step,
+                repair_cached_depot_tools=repair_cached_depot_tools,
+                reset=reset,
+            )
     except Exception as e:
         log_error(f"Provisioning failed: {e}")
         raise typer.Exit(1)
 
 
+@app.command("clean-outputs")
+def clean_outputs_cmd(
+    root: Path = typer.Option(..., "--root", help="gclient root"),
+    product: str = typer.Option("browseros", "--product"),
+    arch: str = typer.Option("arm64", "--arch"),
+    all_products: bool = typer.Option(
+        False, "--all-products", help="Remove known CI product outputs and checkpoints"
+    ),
+    lock_wait: bool = typer.Option(False, "--lock-wait"),
+):
+    """Clean product output/resource state while preserving synchronized source."""
+    src = root.expanduser().resolve() / "src"
+    try:
+        if arch not in ("arm64", "x64", "universal"):
+            raise ValueError(f"Unsupported architecture: {arch}")
+        ctx = Context(
+            chromium_src=src,
+            product=get_product_descriptor(product),
+            build_type="release",
+            architecture="arm64" if arch == "universal" else arch,
+            plan_architectures=(arch,),
+        )
+        with ChromiumCheckoutLock(src, product=product, wait=lock_wait):
+            if all_products:
+                clean_ci_outputs(src)
+            # Orphan resources live in the BrowserOS repository, outside the
+            # Chromium cache; product context preserves the existing pruning.
+            CleanModule().clean_outputs(ctx)
+    except Exception as exc:
+        log_error(f"Output cleanup failed: {exc}")
+        raise typer.Exit(1)
+
+
+def _products(value: str) -> tuple[str, ...]:
+    if value == "all":
+        return ("browseros", "browserclaw")
+    if value in ("browseros", "browserclaw"):
+        return (value,)
+    raise ValueError(f"Unknown product set: {value}")
+
+
+@app.command("workspace")
+def workspace_cmd(
+    base_src: Path = typer.Option(..., "--base-src"),
+    products: str = typer.Option("browseros", "--products"),
+    version_file: Optional[Path] = typer.Option(None, "--version-file"),
+    runner_temp: Path = typer.Option(..., "--runner-temp"),
+    run_tag: str = typer.Option(..., "--run-tag"),
+):
+    """Refresh the CI base once and copy every product before handing off."""
+    from ..steps.source.
```

**File**: `packages/browseros/bos_build/core/planner_test.py` (modified, +2/-2)
```diff
@@ -578,8 +578,8 @@ def test_nightly_macos_profile_keeps_signed_published_defaults(self):
         )
         switches = load_profile(profile_path).switches.resolved()
 
-        self.assertTrue(switches.clean)
-        self.assertEqual("full", switches.provision)
+        self.assertFalse(switches.clean)
+        self.assertEqual("none", switches.provision)
         self.assertTrue(switches.download)
         self.assertTrue(switches.sign)
         self.assertTrue(switches.upload)
```

---

### Incident Patch 7: `814f171c` (2026-10-03)
**Commit Message**: fix(build): align patch consistency checks with Chromium 155 (#2829)

**File**: `packages/browseros/bos_build/steps/patches/fixtures/LICENSE` (added, +27/-0)
```diff
@@ -0,0 +1,27 @@
+// Copyright 2015 The Chromium Authors
+//
+// Redistribution and use in source and binary forms, with or without
+// modification, are permitted provided that the following conditions are
+// met:
+//
+//    * Redistributions of source code must retain the above copyright
+// notice, this list of conditions and the following disclaimer.
+//    * Redistributions in binary form must reproduce the above
+// copyright notice, this list of conditions and the following disclaimer
+// in the documentation and/or other materials provided with the
+// distribution.
+//    * Neither the name of Google LLC nor the names of its
+// contributors may be used to endorse or promote products derived from
+// this software without specific prior written permission.
+//
+// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
+// "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
+// LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
+// A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
+// OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
+// SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
+// LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
+// DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
+// THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
+// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
+// OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

**File**: `packages/browseros/bos_build/steps/patches/fixtures/README.md` (added, +25/-0)
```diff
@@ -0,0 +1,25 @@
+# Windows install identity fixture
+
+`chromium_install_modes.h.txt` is the byte-for-byte upstream header from Chromium
+155.0.8059.26, commit `16c3e55476d3564bea713314b2fff638749ce3e6`:
+
+- [Original header](https://chromium.googlesource.com/chromium/src/+/16c3e55476d3564bea713314b2fff638749ce3e6/chrome/install_static/chromium_install_modes.h)
+- Git blob: `a6d969df56d13d94eaa968934f909d6fd23b5f2f`
+- [Tracing interface definition](https://chromium.googlesource.com/chromium/src/+/16c3e55476d3564bea713314b2fff638749ce3e6/chrome/windows_services/elevated_tracing_service/tracing_service_idl.idl#57)
+
+The existing product identity assertions apply the actual BrowserOS patch to this
+fixture using Git in a temporary directory. This covers complete shared COM
+initializers even when they fall outside the patch's context lines. The fixture
+must match the patch's preimage blob; mismatches fail with a refresh instruction.
+No network or Chromium checkout is used during validation.
+
+When upgrading the patch base, download the new upstream header with Gitiles
+`?format=TEXT`, base64-decode it without newline conversion, and update these
+source references. Verify any changed IID against the corresponding upstream
+IDL before updating expectations. Do not replace upstream values with product
+CLSIDs: the products register separate classes implementing shared interfaces.
+
+Chromium 155 uses `E0B03E2D-7682-4D83-B9FF-4574AF720500` for
+`ISystemTraceSessionChromium`. The prior IID
+`A3FD580A-FFD4-4075-9174-75D0B199D3CB` remains in `kOldTracingServiceIids`
+for cleanup, not as the active interface. The upstream license is in `LICENSE`.
```

**File**: `packages/browseros/bos_build/steps/patches/fixtures/chromium_install_modes.h.txt` (added, +120/-0)
```diff
@@ -0,0 +1,120 @@
+// Copyright 2016 The Chromium Authors
+// Use of this source code is governed by a BSD-style license that can be
+// found in the LICENSE file.
+
+// Brand-specific types and constants for Chromium.
+
+#ifndef CHROME_INSTALL_STATIC_CHROMIUM_INSTALL_MODES_H_
+#define CHROME_INSTALL_STATIC_CHROMIUM_INSTALL_MODES_H_
+
+#include <array>
+
+#include "chrome/app/chrome_dll_resource.h"
+#include "chrome/common/chrome_icon_resources_win.h"
+#include "chrome/install_static/install_constants.h"
+
+namespace install_static {
+
+// The brand-specific company name to be included as a component of the install
+// and user data directory paths. May be empty if no such dir is to be used.
+inline constexpr wchar_t kCompanyPathName[] = L"";
+
+// The brand-specific product name to be included as a component of the install
+// and user data directory paths.
+inline constexpr wchar_t kProductPathName[] = L"Chromium";
+
+// The brand-specific safe browsing client name.
+inline constexpr char kSafeBrowsingName[] = "chromium";
+
+// Note: This list of indices must be kept in sync with the brand-specific
+// resource strings in chrome/installer/util/prebuild/create_string_rc.
+enum InstallConstantIndex {
+  CHROMIUM_INDEX,
+  NUM_INSTALL_MODES,
+};
+
+inline constexpr auto kOldTracingServiceIids = std::to_array<IID>({
+    // Replaced in 2026-09. Delete after 2028-09.
+    // {A3FD580A-FFD4-4075-9174-75D0B199D3CB}
+    {0xa3fd580a,
+     0xffd4,
+     0x4075,
+     {0x91, 0x74, 0x75, 0xd0, 0xb1, 0x99, 0xd3, 0xcb}},
+});
+
+inline constexpr auto kInstallModes = std::to_array<InstallConstants>({
+    // The primary (and only) install mode for Chromium.
+    {
+        .size = sizeof(InstallConstants),
+        .index = CHROMIUM_INDEX,  // The one and only mode for Chromium.
+        .install_switch =
+            "",  // No install switch for the primary install mode.
+        .install_suffix =
+            L"",  // Empty install_suffix for the primary install mode.
+        .logo_suffix = L"",  // No logo suffix for the primary install mode.
+        .app_guid =
+            L"",  // Empty app_guid since no integration with Google Update.
+        .base_app_name = L"Chromium",              // A distinct base_app_name.
+        .base_app_id = L"Chromium",                // A distinct base_app_id.
+        .browser_prog_id_prefix = L"ChromiumHTM",  // Browser ProgID prefix.
+        .browser_prog_id_description =
+            L"Chromium HTML Document",  // Browser ProgID description.
+        .direct_launch_url_scheme = "chromium",
+        .pdf_prog_id_prefix = L"ChromiumPDF",  // PDF ProgID prefix.
+        .pdf_prog_id_description =
+            L"Chromium PDF Document",  // PDF ProgID description.
+        .active_setup_guid =
+            L"{7D2B3E1D-D096-4594-9D8F-A6667F12E0AC}",  // Active Setup
+                                                        // GUID.
+        .toast_activator_clsid = {0x635EFA6F,
+                                  0x08D6,
+                                  0x4EC9,
+                                  {0xBD, 0x14, 0x8A, 0x0F, 0xDE, 0x97, 0x51,
+                                   0x59}},  // Toast Activator CLSID.
+        .elevator_clsid = {0xD133B120,
+                           0x6DB4,
+                           0x4D6B,
+                           {0x8B, 0xFE, 0x83, 0xBF, 0x8C, 0xA1, 0xB1,
+                            0xB0}},  // Elevator CLSID.
+        .elevator_iid = {0xbb19a0e5,
+                         0xc6,
+                         0x4966,
+                         {0x94, 0xb2, 0x5a, 0xfe, 0xc6, 0xfe, 0xd9,
+                          0x3a}},  // IElevator IID and TypeLib
+        // {BB19A0E5-00C6-4966-94B2-5AFEC6FED93A}.
+        .old_elevator_iids = {},
+        .tracing_service_clsid = {0x83f69367,
+                                  0x442d,
+                                  0x447f,
+                                  {0x8b, 0xcc, 0x0e, 0x3f, 0x97, 0xbe, 0x9c,
+                                   0xf2}},  // SystemTraceSession CLSID.
+        .tracing_service_iid = {0xe0b03e2d,
+                                0x7682,
+                                0x4d83,
+                                {0xb9, 0xff, 0x45, 0x74, 0xaf, 0x72, 0x05,
+                                 0x00}},  // ISystemTraceSessionChromium IID and
+                                          // TypeLib
+        .old_tracing_service_iids = kOldTracingServiceIids,
+        .default_channel_name =
+            L"",  // Empty default channel name since no update integration.
+        .channel_strategy = ChannelStrategy::UNSUPPORTED,
+        .supports_system_level = true,  // Supports system-level installs.
+        .supports_set_as_default_browser =
+            true,  // Supports in-product set as default browser UX.
+        .app_icon_resource_index =
+            icon_resources::kApplicationIndex,  // App icon resource index.
+        .app_icon_resource_id = IDR_MAINFRAME,  // App icon resource id.
+        
```

**File**: `packages/browseros/bos_build/steps/patches/product_user_data_dir_test.py` (modified, +49/-31)
```diff
@@ -1,8 +1,12 @@
 #!/usr/bin/env python3
 """Tests for product user-data directory patches."""
 
+import hashlib
 import re
+import subprocess
+import tempfile
 import unittest
+from pathlib import Path
 
 from ...lib.paths import get_package_root
 
@@ -14,24 +18,44 @@ def _patch(relative_path: str) -> str:
     return (PATCHES / relative_path).read_text()
 
 
-def _patched_source(relative_path: str) -> str:
-    """Reconstruct the changed source regions from a unified diff."""
-    source_lines: list[str] = []
-    in_hunk = False
-
-    for line in _patch(relative_path).splitlines():
-        if line.startswith("@@"):
-            in_hunk = True
-            continue
-        if not in_hunk:
-            continue
-        if line.startswith("diff --git "):
-            in_hunk = False
-            continue
-        if line.startswith(("+", " ")):
-            source_lines.append(line[1:])
-
-    return "\n".join(source_lines)
+def _patched_install_modes() -> str:
+    """Apply the real identity patch to its pinned upstream fixture, offline.
+
+    Unified-diff context can truncate unchanged COM initializers. Validate the
+    complete resulting header so shared upstream IIDs remain covered alongside
+    product-specific registrations, regardless of hunk boundaries.
+    """
+    relative_path = "chrome/install_static/chromium_install_modes.h"
+    patch = _patch(relative_path)
+    fixture = Path(__file__).with_name("fixtures") / "chromium_install_modes.h.txt"
+    # Git may check out text with CRLF on Windows; blob IDs describe LF bytes.
+    upstream = fixture.read_text(encoding="utf-8").encode("utf-8")
+    # Bind the fixture to the patch preimage, so an upstream refresh cannot
+    # silently validate against an older header that still happens to apply.
+    blob = hashlib.sha1(
+        b"blob " + str(len(upstream)).encode() + b"\0" + upstream,
+        usedforsecurity=False,
+    ).hexdigest()
+    if f"\nindex {blob}.." not in patch:
+        raise AssertionError("refresh the install modes fixture for this patch base")
+
+    # Only this disposable directory is writable; no Chromium checkout or
+    # network is needed by the existing identity assertions.
+    with tempfile.TemporaryDirectory() as temporary:
+        destination = Path(temporary) / relative_path
+        destination.parent.mkdir(parents=True)
+        destination.write_bytes(upstream)
+        result = subprocess.run(
+            ["git", "apply", "-"],
+            input=patch.encode("utf-8"),
+            cwd=temporary,
+            capture_output=True,
+        )
+        if result.returncode:
+            raise AssertionError(
+                f"install identity patch failed: {result.stderr.decode('utf-8')}"
+            )
+        return destination.read_text()
 
 
 def _product_identity_branches(source: str) -> tuple[str, str]:
@@ -119,9 +143,7 @@ def test_linux_profile_roots_are_product_specific(self) -> None:
         )
 
     def test_windows_profile_roots_are_product_specific(self) -> None:
-        install_modes = _patched_source(
-            "chrome/install_static/chromium_install_modes.h"
-        )
+        install_modes = _patched_install_modes()
         browserclaw, browseros = _product_identity_branches(install_modes)
 
         self.assertEqual(
@@ -139,9 +161,7 @@ def test_windows_profile_roots_are_product_specific(self) -> None:
         self.assertNotIn("browseros_product.h", install_modes)
 
     def test_windows_install_identity_branches_are_complete(self) -> None:
-        install_modes = _patched_source(
-            "chrome/install_static/chromium_install_modes.h"
-        )
+        install_modes = _patched_install_modes()
         browserclaw, browseros = _product_identity_branches(install_modes)
         identity_struct = re.search(
             r"struct ProductInstallIdentity \{(?P<body>.*?)\n\};",
@@ -217,9 +237,7 @@ def test_windows_install_identity_branches_are_complete(self) -> None:
             self.assertIn(f"kProductInstallIdentity.{field}", install_modes)
 
     def test_windows_install_clsids_are_product_specific(self) -> None:
-        install_modes = _patched_source(
-            "chrome/install_static/chromium_install_modes.h"
-        )
+        install_modes = _patched_install_modes()
         browserclaw, browseros = _product_identity_branches(install_modes)
         guid_fields = (
             "active_setup_guid",
@@ -266,9 +284,7 @@ def test_windows_install_clsids_are_product_specific(self) -> None:
     def test_windows_install_shared_identity_matches_implemented_interfaces(
         self,
     ) -> None:
-        install_modes = _patched_source(
-            "chrome/install_static/chromium_install_modes.h"
-        )
+        install_modes = _patched_install_modes()
         browserclaw, browseros = _product_identity_branches(install_modes)
 
         self.assertEqual(install_modes.count('.app_guid = L"",'), 1)
@@ -280,7 +296,9 @@ def test_windows_install_shared_identity_matches
```

**File**: `packages/browseros/chromium_patches/.features.yaml` (modified, +2/-2)
```diff
@@ -39,7 +39,6 @@ features:
       - chrome/app/chrome_command_ids.h
       - chrome/browser/ui/actions/chrome_action_id.h
       - chrome/browser/ui/browser_actions.cc
-      - chrome/browser/ui/browser.cc
       - chrome/browser/ui/browser_command_controller.cc
       # Shared keyboard shortcut infra (llm-chat + keyboard-shortcuts)
       - chrome/browser/global_keyboard_shortcuts_mac.mm
@@ -48,6 +47,7 @@ features:
       # Shared pinned button (pin-chat)
       - chrome/browser/ui/views/toolbar/pinned_action_toolbar_button.cc
 
+      # Chromium 155 moved the former browser.cc customizations here.
       - "chrome/browser/ui/browser_web_contents_delegate/browser_web_contents_delegate.cc"
       - "chrome/browser/ui/bookmarks/bookmark_bar_controller.cc"
       - "chrome/browser/ui/browser_web_contents_delegate/BUILD.gn"
@@ -347,7 +347,7 @@ features:
     description: "feat: vertical tab strip"
     files:
       - chrome/browser/ui/tabs/BUILD.gn
-      - chrome/browser/ui/tabs/features.cc
+      # Chromium 155 removed the kVerticalTabs feature gate; retain pref sync.
       - chrome/browser/ui/tabs/vertical_tab_strip_state_controller.cc
       - chrome/browser/ui/views/frame/layout/browser_view_tabbed_layout_impl.cc
 
```

---

### Incident Patch 8: `c216e8a7` (2026-10-03)
**Commit Message**: docs(build): record automatic release preparation plan (#2827)

**File**: `packages/browseros/bos_build/docs/source-preparation-plan.md` (added, +76/-0)
```diff
@@ -0,0 +1,76 @@
+# Automatic release build preparation
+
+Chromium upgrades must not require an operator to repair each release runner.
+The selected BrowserOS checkout's `CHROMIUM_VERSION` is the source of truth.
+Bring stale checkouts to that exact tag, finish cleanup, synchronize dependencies
+and hooks, then build from a prepared workspace.
+
+## Source preparation and macOS workspace ownership
+
+One source-preparation implementation in `bos_build` owns reset, exact-tag
+acquisition, checkout alignment, `.gclient` preservation, and dependency sync.
+`git_setup` remains its local-build adapter; `source ensure` is its provisioning
+adapter. Preserve the existing explicit clean commands and local no-clean
+behavior. Source reset must account for gclient-managed repositories, which are
+not necessarily Git submodules.
+
+The macOS persistent base is infrastructure-owned cache state. Refresh it before
+APFS copying and hold the existing checkout lock through preparation and copy.
+Each product receives an independent disposable workspace; a universal build
+prepares once and retains its workspace through both architectures. Product-
+qualified workspace markers and state files must survive multiple requested
+copies and support complete cleanup after partial failure.
+
+All cleanup that can delete dependency toolchains must finish before the final
+sync. Builds consuming prepared copies skip source cleanup and provisioning,
+but retain output/checkpoint cleanup and pruning of stale resource families in
+the separate persistent BrowserOS repository. Source cache publication remains
+after successful sync and output cleanup, before product patches and resources.
+
+Do not use a moving upstream branch, fetch every Chromium tag, overwrite custom
+`.gclient` settings, or interpret matching HEAD as proof that sync succeeded.
+Keep this focused; no general workspace-provider framework is needed.
+
+## Windows host prerequisites
+
+The build currently selects the locally installed Windows toolchain through
+`DEPOT_TOOLS_WIN_TOOLCHAIN=0`. Git and gclient cannot install a missing Windows
+SDK in that mode. A separate setup module must determine the SDK required by the
+selected Chromium source, ensure the exact supported SDK is installed on the CI
+host, and verify its required headers/libraries/tools before configuration.
+
+The Chromium 155 release failed because its required SDK directory
+`10.0.28000.0` was absent. Official installation instructions specify SDK package
+`10.0.28000.2270`. Resolve this through supported Microsoft provisioning and
+explicit installed-file verification; do not change Chromium's SDK pin to an
+older installed version.
+
+## Implementation ownership
+
+| Piece | Owned code | Integration contract |
+| --- | --- | --- |
+| Source preparation | `steps/source/provision.py`, `steps/setup/git.py`, `steps/setup/clean.py`, `cli/source.py`, source/workspace helpers, macOS workspace script and its release/nightly callers; source preparation block in `build-browseros.yml` | Preserve planner/step names where practical; communicate any shared registration changes before editing |
+| Windows SDK | New Windows SDK setup module; its Windows-only registrations/planner integration; Windows prerequisite workflow block if needed | Do not change source-preparation blocks, Chromium patches, GN files, or the Chromium pin |
+| Integration and release | Combined main review, full Neo workflow dispatch, run/artifact verification, delegated repairs for additional failures | Merge both implementations before dispatch; a queued or component-only success does not prove full-release success |
+
+The two implementation pieces have independent interfaces, so empty skeleton
+modules are unnecessary. Each worker uses an isolated worktree, designs the
+details, completes independent review, and merges its scoped PR. Preserve both
+intentions when integrating current main; never force-push.
+
+## Acceptance
+
+Exercise preparation using real disposable checkouts: missing tag, old HEAD,
+dirty source and dependency repositories, interrupted sync, preserved developer
+changes and `.gclient` configuration, checkout locking, multi-product copies,
+and universal ordering. Verify Windows setup on a real Windows runner; Python
+syntax or mocked installation alone is not evidence of SDK readiness.
+
+The owner's Chromium constraints apply: no GN generation or cleanup and no
+Chromium unit/browser test targets. Any Chromium source change requires the
+specified `autoninja -C out/Default_browseros_arm64 chrome` build gate.
+
+Completion requires merged changes and a successful full BrowserOS Neo release
+workflow, including server, extension, Linux, Windows, macOS universal, and
+browser draft creation. Verify the expected browser artifacts and source
+identity. Production promotion remains a separate request.
```

---

### Incident Patch 9: `7d14eb7d` (2026-10-03)
**Commit Message**: chore: bump build offset

**File**: `packages/browseros/bos_build/config/BROWSEROS_BUILD_OFFSET` (modified, +1/-1)
```diff
@@ -1 +1 @@
-240
+250
```

---

### Incident Patch 10: `fed4d203` (2026-10-03)
**Commit Message**: fix(claw-app): rename Tasks to Skills in Neo UI (#2821)

Co-authored-by: capy-ai[bot] <230910855+capy-ai[bot]@users.noreply.github.com>

**File**: `packages/browseros-agent/apps/claw-app/components/sidebar/SidebarNavigation.tsx` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ interface NavItem {
 const navItems: NavItem[] = [
   { name: 'Cockpit', to: '/', icon: LayoutDashboard },
   { name: 'MCP', to: '/mcp', icon: PlugZap },
-  { name: 'Tasks', to: '/skills', icon: Repeat },
+  { name: 'Skills', to: '/skills', icon: Repeat },
   { name: 'Audit', to: '/audit', icon: ScrollText },
 ]
 
```

**File**: `packages/browseros-agent/apps/claw-app/components/skills/DeleteSkillDialog.tsx` (modified, +5/-3)
```diff
@@ -44,7 +44,7 @@ export function DeleteSkillDialog({
       {
         loading: `Deleting ${name}…`,
         success: `Deleted ${name}`,
-        error: 'Could not delete the task',
+        error: 'Could not delete the skill',
       },
     )
   }
@@ -62,15 +62,17 @@ export function DeleteSkillDialog({
       />
       <AlertDialogContent>
         <AlertDialogHeader>
-          <AlertDialogTitle>Delete this task?</AlertDialogTitle>
+          <AlertDialogTitle>Delete this skill?</AlertDialogTitle>
           <AlertDialogDescription>
             This removes {name} and unlinks its skill from your coding agents.
             Its run history is discarded.
           </AlertDialogDescription>
         </AlertDialogHeader>
         <AlertDialogFooter>
           <AlertDialogCancel>Cancel</AlertDialogCancel>
-          <AlertDialogAction onClick={onConfirm}>Delete task</AlertDialogAction>
+          <AlertDialogAction onClick={onConfirm}>
+            Delete skill
+          </AlertDialogAction>
         </AlertDialogFooter>
       </AlertDialogContent>
     </AlertDialog>
```

**File**: `packages/browseros-agent/apps/claw-app/components/skills/RunSkillButton.tsx` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ export function RunSkillButton({ name, size = 'sm' }: RunSkillButtonProps) {
     }
     void navigator.clipboard.writeText(skillCommand(name)).then(() => {
       toast.success(`Copied ${skillCommand(name)}`, {
-        description: 'Paste it into your coding agent to run this task.',
+        description: 'Paste it into your coding agent to run this skill.',
       })
     })
   }
```

**File**: `packages/browseros-agent/apps/claw-app/components/skills/SkillFormDialog.tsx` (modified, +6/-7)
```diff
@@ -131,9 +131,9 @@ function CreateForm({ onClose }: { onClose: () => void }) {
           onClose()
         }),
       {
-        loading: 'Saving the task…',
+        loading: 'Saving the skill…',
         success: `Saved /${name}`,
-        error: 'Could not save the task',
+        error: 'Could not save the skill',
       },
     )
   })
@@ -142,10 +142,9 @@ function CreateForm({ onClose }: { onClose: () => void }) {
     <Form {...form}>
       <form onSubmit={onSubmit} className="flex flex-col gap-4">
         <DialogHeader>
-          <DialogTitle>New task</DialogTitle>
+          <DialogTitle>New skill</DialogTitle>
           <DialogDescription>
-            A task is a skill BrowserOS neo links into your agents and you
-            re-run by name.
+            A skill BrowserOS neo links into your agents and you re-run by name.
           </DialogDescription>
         </DialogHeader>
         <FormField
@@ -239,7 +238,7 @@ function CreateForm({ onClose }: { onClose: () => void }) {
             }
           />
           <Button type="submit" disabled={create.isPending}>
-            Save task
+            Save skill
           </Button>
         </DialogFooter>
       </form>
@@ -290,7 +289,7 @@ function EditForm({
       {
         loading: 'Saving…',
         success: `Saved /${name}`,
-        error: 'Could not save the task',
+        error: 'Could not save the skill',
       },
     )
   })
```

**File**: `packages/browseros-agent/apps/claw-app/screens/skills/SkillDetail.test.tsx` (modified, +2/-2)
```diff
@@ -1,5 +1,5 @@
 /**
- * Static-markup checks for the task detail stat cards.
+ * Static-markup checks for the skill detail stat cards.
  * Stubs the data hook so no backend is needed.
  */
 
@@ -63,7 +63,7 @@ function renderApp(): string {
   )
 }
 
-describe('Task detail stat cards', () => {
+describe('Skill detail stat cards', () => {
   it('shows Tokens saved with the saved total and the other-browsers comparison', () => {
     dataOverride = { ...dataOverride, detail: detail() }
     const html = renderApp()
```

**File**: `packages/browseros-agent/apps/claw-app/screens/skills/SkillDetail.tsx` (modified, +4/-4)
```diff
@@ -39,7 +39,7 @@ function agentLabel(id: string): string {
   return AGENT_LABELS[id] ?? id
 }
 
-/** Shows the task's SKILL.md, token savings, linked coding agents, and run history. */
+/** Shows the skill's SKILL.md, token savings, linked coding agents, and run history. */
 export function SkillDetail() {
   const { detail, isLoading, isError } = useSkillDetailData()
   const navigate = useNavigate()
@@ -52,12 +52,12 @@ export function SkillDetail() {
         className="inline-flex w-fit items-center gap-1.5 font-medium text-[13px] text-ink-2 transition-colors hover:text-ink"
       >
         <ArrowLeft className="size-3.5" />
-        Tasks
+        Skills
       </button>
 
       {isError ? (
         <Notice>
-          Could not load this task. Check that BrowserOS neo is running and try
+          Could not load this skill. Check that BrowserOS neo is running and try
           again.
         </Notice>
       ) : isLoading || !detail ? (
@@ -209,7 +209,7 @@ function RunHistory({ runs }: { runs: SkillRun[] }) {
       <h2 className="font-semibold text-ink text-sm">Run history</h2>
       {runs.length === 0 ? (
         <div className="rounded-9 border border-ledger-border bg-card px-6 py-8 text-center text-ink-2 text-sm">
-          This task has not run yet.
+          This skill has not run yet.
         </div>
       ) : (
         <div className="overflow-clip rounded-9 border border-ledger-border bg-card">
```

**File**: `packages/browseros-agent/apps/claw-app/screens/skills/Skills.test.tsx` (modified, +5/-5)
```diff
@@ -1,5 +1,5 @@
 /**
- * Static-markup checks for the Tasks list screen. Stubs the data hook so the
+ * Static-markup checks for the Skills list screen. Stubs the data hook so the
  * test does not need a running backend.
  */
 
@@ -56,15 +56,15 @@ const sampleSkill: Skill = {
   },
 }
 
-describe('Tasks list screen', () => {
+describe('Skills list screen', () => {
   it('renders the header', () => {
     dataOverride = { ...baseData }
-    expect(renderApp()).toContain('Tasks')
+    expect(renderApp()).toContain('Skills')
   })
 
-  it('shows the empty state when there are no tasks', () => {
+  it('shows the empty state when there are no skills', () => {
     dataOverride = { ...baseData }
-    expect(renderApp()).toContain('No tasks yet')
+    expect(renderApp()).toContain('No skills yet')
   })
 
   it('shows skeleton loading rows while the first page is pending', () => {
```

**File**: `packages/browseros-agent/apps/claw-app/screens/skills/Skills.tsx` (modified, +8/-8)
```diff
@@ -27,7 +27,7 @@ import { formatTokens, skillCommand } from './skills.helpers'
 const CELL_PADDING = 'px-2 py-3 first:pl-4 last:pr-4'
 
 /**
- * Tasks list. A task is a skill BrowserOS neo linked into the connected coding
+ * Skills list. A skill is one BrowserOS neo linked into the connected coding
  * agents; each row shows its run count and token savings. Row click opens
  * the SKILL.md and run history.
  */
@@ -46,7 +46,7 @@ export function Skills() {
       <header className="flex items-start justify-between gap-4">
         <div className="flex flex-col gap-1">
           <h1 className="font-extrabold text-3xl leading-tight tracking-tight md:text-4xl">
-            Tasks
+            Skills
           </h1>
           <p className="text-ink-2 text-sm">
             Skills BrowserOS neo linked into your coding agents. Re-run one by
@@ -58,16 +58,16 @@ export function Skills() {
           trigger={
             <Button size="sm" className="rounded-9">
               <Plus />
-              New task
+              New skill
             </Button>
           }
         />
       </header>
 
       {isError ? (
         <SkillsNotice>
-          Could not load your tasks. Check that BrowserOS neo is running and try
-          again.
+          Could not load your skills. Check that BrowserOS neo is running and
+          try again.
         </SkillsNotice>
       ) : isLoading ? (
         <SkillsSkeleton />
@@ -84,7 +84,7 @@ export function Skills() {
                     'h-auto font-medium text-[12px] text-ledger-head-ink',
                   )}
                 >
-                  Task
+                  Skill
                 </TableHead>
                 <TableHead
                   className={cn(
@@ -210,7 +210,7 @@ function SkillsEmpty() {
   return (
     <div className="flex flex-col items-center gap-4 rounded-9 border border-ledger-border border-dashed bg-card px-6 py-16 text-center">
       <div className="flex flex-col gap-1">
-        <p className="font-semibold text-base text-ink">No tasks yet</p>
+        <p className="font-semibold text-base text-ink">No skills yet</p>
         <p className="mx-auto max-w-md text-ink-2 text-sm">
           When your coding agent saves a repeatable browser task with BrowserOS
           neo, it shows up here, linked into your agents and re-runnable by
@@ -222,7 +222,7 @@ function SkillsEmpty() {
         trigger={
           <Button size="sm" className="rounded-9">
             <Plus />
-            New task
+            New skill
           </Button>
         }
       />
```

---

### Incident Patch 11: `83957932` (2026-10-02)
**Commit Message**: feat(chromium): add a 30-minute fresh bundle update grace (#2820)

* fix(chromium): restore immediate product extension updates

* feat(chromium): add fresh bundled extension update grace

**File**: `packages/browseros/chromium_patches/.features.yaml` (modified, +1/-0)
```diff
@@ -227,6 +227,7 @@ features:
       - chrome/browser/extensions/updater/extension_updater.h
       - chrome/browser/ui/extensions/settings_overridden_params_providers.cc
 
+      - "chrome/browser/extensions/chrome_extension_system.cc"
   chrome-importer:
     description: "feat: chrome importer"
     files:
```

**File**: `packages/browseros/chromium_patches/chrome/browser/browseros/core/browseros_prefs.cc` (modified, +3/-2)
```diff
@@ -1,9 +1,9 @@
 diff --git a/chrome/browser/browseros/core/browseros_prefs.cc b/chrome/browser/browseros/core/browseros_prefs.cc
 new file mode 100644
-index 0000000000000000000000000000000000000000..68597d68ae413015f8783404d822d8a3f7dacb44
+index 0000000000000000000000000000000000000000..f09b13c6c45676dc7ed83f51ff28aaa8bd202b50
 --- /dev/null
 +++ b/chrome/browser/browseros/core/browseros_prefs.cc
-@@ -0,0 +1,133 @@
+@@ -0,0 +1,134 @@
 +// Copyright 2025 The Chromium Authors
 +// Use of this source code is governed by a BSD-style license that can be
 +// found in the LICENSE file.
@@ -39,6 +39,7 @@ index 0000000000000000000000000000000000000000..68597d68ae413015f8783404d822d8a3
 +
 +  registry->RegisterBooleanPref(prefs::kNtpFocusContent, false);
 +  registry->RegisterBooleanPref(prefs::kOnboardingCompleted, false);
++  registry->RegisterDictionaryPref(prefs::kExtensionInstallGrace);
 +  // BrowserClaw is a browser for agents: they work in the background by
 +  // default. BrowserOS keeps stock focus behaviour.
 +  registry->RegisterBooleanPref(prefs::kAutomationNeverStealsFocus,
```

**File**: `packages/browseros/chromium_patches/chrome/browser/browseros/core/browseros_prefs.h` (modified, +11/-2)
```diff
@@ -1,9 +1,9 @@
 diff --git a/chrome/browser/browseros/core/browseros_prefs.h b/chrome/browser/browseros/core/browseros_prefs.h
 new file mode 100644
-index 0000000000000000000000000000000000000000..893ade589e58d07c85848b790079481c2452b9e7
+index 0000000000000000000000000000000000000000..19e8b58261088485efa15d05db4819df283d81a7
 --- /dev/null
 +++ b/chrome/browser/browseros/core/browseros_prefs.h
-@@ -0,0 +1,125 @@
+@@ -0,0 +1,134 @@
 +// Copyright 2025 The Chromium Authors
 +// Use of this source code is governed by a BSD-style license that can be
 +// found in the LICENSE file.
@@ -58,6 +58,15 @@ index 0000000000000000000000000000000000000000..893ade589e58d07c85848b790079481c
 +
 +inline constexpr char kOnboardingCompleted[] = "browseros.onboarding_completed";
 +
++// Local-only first-install records keyed by active product extension ID. An
++// empty record is eligible; discovery adds the bundled version, then READY adds
++// a fixed deadline. Expiry marks the record released until that bundled version
++// is replaced, covering installers that finish after the timer. Retaining the
++// user-set dictionary (even empty) prevents re-enrollment after expiry,
++// recovery, or a browser restart.
++inline constexpr char kExtensionInstallGrace[] =
++    "browseros.extension_install_grace";
++
 +// Boolean: Automation-driven tabs never pull the user's attention. A tab counts
 +// as automation-driven while a DevTools client is attached to it, which is
 +// every tab the claw-server (or any CDP client) acts on. With the pref on such
```

**File**: `packages/browseros/chromium_patches/chrome/browser/browseros/extensions/browseros_extension_loader.cc` (modified, +193/-4)
```diff
@@ -1,28 +1,34 @@
 diff --git a/chrome/browser/browseros/extensions/browseros_extension_loader.cc b/chrome/browser/browseros/extensions/browseros_extension_loader.cc
 new file mode 100644
-index 0000000000000000000000000000000000000000..f687bc2c1a5353117d53dfbd56e85ef95c32d6b8
+index 0000000000000000000000000000000000000000..c7fb41d2ca313acc489b49396a4116659ae3eb7e
 --- /dev/null
 +++ b/chrome/browser/browseros/extensions/browseros_extension_loader.cc
-@@ -0,0 +1,456 @@
+@@ -0,0 +1,645 @@
 +// Copyright 2024 The Chromium Authors
 +// Use of this source code is governed by a BSD-style license that can be
 +// found in the LICENSE file.
 +
 +#include "chrome/browser/browseros/extensions/browseros_extension_loader.h"
 +
++#include <optional>
 +#include <utility>
 +
 +#include "base/feature_list.h"
 +#include "base/functional/bind.h"
++#include "base/json/values_util.h"
 +#include "base/logging.h"
 +#include "base/supports_user_data.h"
 +#include "base/task/single_thread_task_runner.h"
 +#include "base/version.h"
 +#include "chrome/browser/browser_features.h"
 +#include "chrome/browser/browseros/core/browseros_constants.h"
++#include "chrome/browser/browseros/core/browseros_prefs.h"
 +#include "chrome/browser/extensions/external_provider_impl.h"
++#include "chrome/browser/extensions/updater/extension_updater.h"
 +#include "chrome/browser/profiles/profile.h"
++#include "components/prefs/scoped_user_pref_update.h"
 +#include "content/public/browser/browser_thread.h"
++#include "extensions/browser/delayed_install_manager.h"
 +#include "extensions/browser/disable_reason.h"
 +#include "extensions/browser/extension_prefs.h"
 +#include "extensions/browser/extension_registrar.h"
@@ -36,6 +42,10 @@ index 0000000000000000000000000000000000000000..f687bc2c1a5353117d53dfbd56e85ef9
 +constexpr char kLoaderReferenceKey[] = "browseros.extension_loader";
 +constexpr base::TimeDelta kReadinessTimeout = base::Seconds(45);
 +constexpr base::TimeDelta kMaintenanceInterval = base::Minutes(15);
++constexpr base::TimeDelta kInstallGracePeriod = base::Minutes(30);
++constexpr char kGraceVersion[] = "version";
++constexpr char kGraceDeadline[] = "deadline";
++constexpr char kGraceReleased[] = "released";
 +
 +// The external provider retains ownership. Profile data is only a weak lookup
 +// for native callers, and never extends a provider or profile's lifetime.
@@ -67,6 +77,11 @@ index 0000000000000000000000000000000000000000..f687bc2c1a5353117d53dfbd56e85ef9
 +      kLoaderReferenceKey,
 +      std::make_unique<LoaderReference>(weak_ptr_factory_.GetWeakPtr()));
 +  profile_observation_.Observe(profile_);
++  // Observe before InstalledLoader runs: READY may precede our asynchronous
++  // bundle discovery, and secondary bundles can become ready after the primary.
++  registry_observation_.Observe(extensions::ExtensionRegistry::Get(profile_));
++  InitializeInstallGrace();
++  ScheduleInstallGraceExpiry();
 +}
 +
 +BrowserOSExtensionLoader::~BrowserOSExtensionLoader() {
@@ -91,6 +106,176 @@ index 0000000000000000000000000000000000000000..f687bc2c1a5353117d53dfbd56e85ef9
 +  config_url_ = url;
 +}
 +
++// static
++BrowserOSExtensionLoader::UpdateInstallPolicy
++BrowserOSExtensionLoader::GetUpdateInstallPolicy(Profile* profile,
++                                                 const std::string& id) {
++  DCHECK_CURRENTLY_ON(content::BrowserThread::UI);
++  if (!IsActiveBrowserOSExtension(id)) {
++    return UpdateInstallPolicy::kNormal;
++  }
++  profile = profile->GetOriginalProfile();
++  const auto* record =
++      profile->GetPrefs()->GetDict(prefs::kExtensionInstallGrace).FindDict(id);
++  const auto* installed =
++      extensions::ExtensionRegistry::Get(profile)->enabled_extensions().GetByID(
++          id);
++  if (!record || !installed) {
++    // Missing, disabled/corrupt, or terminated: allow recovery.
++    return UpdateInstallPolicy::kNormal;
++  }
++  const auto* version = record->FindString(kGraceVersion);
++  const auto deadline = base::ValueToTime(record->Find(kGraceDeadline));
++  if (!version || *version != installed->version().GetString() || !deadline) {
++    return UpdateInstallPolicy::kNormal;
++  }
++  // Release is one-way even if the wall clock is subsequently moved backwards.
++  return record->FindBool(kGraceReleased).value_or(false) ||
++                 *deadline <= base::Time::Now()
++             ? UpdateInstallPolicy::kInstallImmediately
++             : UpdateInstallPolicy::kDefer;
++}
++
++void BrowserOSExtensionLoader::InitializeInstallGrace() {
++  auto* pref_service = profile_->GetPrefs();
++  if (pref_service->GetUserPrefValue(prefs::kExtensionInstallGrace)) {
++    return;
++  }
++  base::DictValue records;
++  // Absence of a new pref is not proof of a new user. Freeze eligibility once,
++  // before discovery/install, so a restart cannot enroll an existing profile
++  // or restart a deadline. An already installed ID is never a fresh bundle.
++  if (profile_->IsNewProfile() &&
++      !pref_
```

**File**: `packages/browseros/chromium_patches/chrome/browser/browseros/extensions/browseros_extension_loader.h` (modified, +19/-2)
```diff
@@ -1,9 +1,9 @@
 diff --git a/chrome/browser/browseros/extensions/browseros_extension_loader.h b/chrome/browser/browseros/extensions/browseros_extension_loader.h
 new file mode 100644
-index 0000000000000000000000000000000000000000..14982f96c6dc7545680517da758b5b7b05ba82ef
+index 0000000000000000000000000000000000000000..d552dedddb9ef13569fc18b00b604e04728e3d2f
 --- /dev/null
 +++ b/chrome/browser/browseros/extensions/browseros_extension_loader.h
-@@ -0,0 +1,118 @@
+@@ -0,0 +1,135 @@
 +// Copyright 2024 The Chromium Authors
 +// Use of this source code is governed by a BSD-style license that can be
 +// found in the LICENSE file.
@@ -19,6 +19,7 @@ index 0000000000000000000000000000000000000000..14982f96c6dc7545680517da758b5b7b
 +#include "base/memory/weak_ptr.h"
 +#include "base/scoped_observation.h"
 +#include "base/timer/timer.h"
++#include "base/timer/wall_clock_timer.h"
 +#include "chrome/browser/browseros/extensions/browseros_extension_installer.h"
 +#include "chrome/browser/browseros/extensions/browseros_extension_maintainer.h"
 +#include "chrome/browser/extensions/external_loader.h"
@@ -52,6 +53,15 @@ index 0000000000000000000000000000000000000000..14982f96c6dc7545680517da758b5b7b
 +  // The profile must be the browsing profile, not the onboarding picker.
 +  static void EnsurePrimaryExtensionReady(Profile* profile,
 +                                          ReadyCallback callback);
++
++  enum class UpdateInstallPolicy { kNormal, kDefer, kInstallImmediately };
++
++  // The Chrome install gate queries persisted policy even before discovery on
++  // restart. Only replacement of a healthy, fresh bundled version is held;
++  // after expiry it can activate despite open pages, including a download that
++  // finishes after the timer. Initial installs/recovery use normal policy.
++  static UpdateInstallPolicy GetUpdateInstallPolicy(Profile* profile,
++                                                    const std::string& id);
 +  void CheckForUpdates();
 +  void SetConfigUrl(const GURL& url);
 +
@@ -77,6 +87,11 @@ index 0000000000000000000000000000000000000000..14982f96c6dc7545680517da758b5b7b
 +  void OnReadinessTimeout();
 +  void RestorePrimaryExtension();
 +  void MaintainInstalledExtensions();
++  void InitializeInstallGrace();
++  void RecordBundledVersions();
++  void StartInstallGraceIfReady(const std::string& id);
++  void ScheduleInstallGraceExpiry();
++  void OnInstallGraceExpired();
 +  void Shutdown();
 +
 +  void OnExtensionReady(content::BrowserContext* context,
@@ -106,6 +121,8 @@ index 0000000000000000000000000000000000000000..14982f96c6dc7545680517da758b5b7b
 +  std::vector<ReadyCallback> ready_callbacks_;
 +  base::OneShotTimer readiness_timer_;
 +  base::RepeatingTimer maintenance_timer_;
++  // Recompute remaining wall time after suspend; sleep must not extend grace.
++  base::WallClockTimer install_grace_timer_;
 +
 +  std::unique_ptr<BrowserOSExtensionInstaller> installer_;
 +  std::unique_ptr<BrowserOSExtensionMaintainer> maintainer_;
```

**File**: `packages/browseros/chromium_patches/chrome/browser/extensions/chrome_extension_system.cc` (added, +67/-0)
```diff
@@ -0,0 +1,67 @@
+diff --git a/chrome/browser/extensions/chrome_extension_system.cc b/chrome/browser/extensions/chrome_extension_system.cc
+index c31a741d21e0206ee73860aa4cf7c643125f4c04..a5e396187dbcee97ee5cecc5ca1c66ff8c5c2447 100644
+--- a/chrome/browser/extensions/chrome_extension_system.cc
++++ b/chrome/browser/extensions/chrome_extension_system.cc
+@@ -18,6 +18,7 @@
+ #include "build/build_config.h"
+ #include "build/chromeos_buildflags.h"
+ #include "chrome/browser/browser_process.h"
++#include "chrome/browser/browseros/extensions/browseros_extension_loader.h"
+ #include "chrome/browser/extensions/blocklist_factory.h"
+ #include "chrome/browser/extensions/chrome_content_verifier_delegate.h"
+ #include "chrome/browser/extensions/chrome_extension_system_factory.h"
+@@ -64,6 +65,7 @@
+ #include "extensions/browser/user_script_manager.h"
+ #include "extensions/buildflags/buildflags.h"
+ #include "extensions/common/constants.h"
++#include "extensions/common/extension.h"
+ #include "extensions/common/features/feature_channel.h"
+ #include "extensions/common/manifest_handlers/manifest_url_handlers.h"
+ #include "ui/message_center/public/cpp/notifier_id.h"
+@@ -96,6 +98,37 @@ namespace extensions {
+ 
+ namespace {
+ 
++// Keep product policy in the Chrome layer and leave the generic idle gate
++// unchanged. Both downloaded installs and startup-delayed installs cross this
++// seam; checking before the base gate prevents its immediate/startup exemptions
++// from replacing a working fresh bundle during the persisted grace period.
++class BrowserOSUpdateInstallGate : public UpdateInstallGate {
++ public:
++  explicit BrowserOSUpdateInstallGate(Profile* profile)
++      : UpdateInstallGate(profile), profile_(profile) {}
++
++  Action ShouldDelay(const Extension* extension,
++                     bool install_immediately) override {
++    using Policy = browseros::BrowserOSExtensionLoader::UpdateInstallPolicy;
++    switch (browseros::BrowserOSExtensionLoader::GetUpdateInstallPolicy(
++        profile_, extension->id())) {
++      case Policy::kDefer:
++        return DELAY;
++      case Policy::kInstallImmediately:
++        // The download may finish after expiry's one-time release attempt.
++        // Override only idleness; the manager still runs its other gates.
++        install_immediately = true;
++        break;
++      case Policy::kNormal:
++        break;
++    }
++    return UpdateInstallGate::ShouldDelay(extension, install_immediately);
++  }
++
++ private:
++  const raw_ptr<Profile> profile_;
++};
++
+ // Helper to serve as an UninstallPingSender::Filter callback.
+ UninstallPingSender::FilterResult ShouldSendUninstallPing(
+     Profile* profile,
+@@ -194,7 +227,7 @@ void ChromeExtensionSystem::Shared::RegisterManagementPolicyProviders() {
+ }
+ 
+ void ChromeExtensionSystem::Shared::InitInstallGates() {
+-  update_install_gate_ = std::make_unique<UpdateInstallGate>(profile_);
++  update_install_gate_ = std::make_unique<BrowserOSUpdateInstallGate>(profile_);
+   auto* delayed_install_manager = DelayedInstallManager::Get(profile_);
+   delayed_install_manager->RegisterInstallGate(
+       ExtensionPrefs::DelayReason::kWaitForIdle, update_install_gate_.get());
```

**File**: `packages/browseros/chromium_patches/chrome/browser/extensions/external_provider_manager.cc` (modified, +42/-2)
```diff
@@ -1,12 +1,52 @@
 diff --git a/chrome/browser/extensions/external_provider_manager.cc b/chrome/browser/extensions/external_provider_manager.cc
-index 80ac525552c03f173ae13812bce4dc57222dec53..104131b75e62952b1ca0434d943990495455f5b3 100644
+index 80ac525552c03f173ae13812bce4dc57222dec53..32c79687cabc0bb685a99128549a29a6355d1d10 100644
 --- a/chrome/browser/extensions/external_provider_manager.cc
 +++ b/chrome/browser/extensions/external_provider_manager.cc
-@@ -291,6 +291,7 @@ bool ExternalProviderManager::OnExternalExtensionFileFound(
+@@ -4,6 +4,7 @@
+ 
+ #include "chrome/browser/extensions/external_provider_manager.h"
+ 
++#include <algorithm>
+ #include <cstddef>
+ 
+ #include "base/check.h"
+@@ -14,6 +15,7 @@
+ #include "base/trace_event/trace_event.h"
+ #include "base/version.h"
+ #include "build/build_config.h"
++#include "chrome/browser/browseros/core/browseros_constants.h"
+ #include "chrome/browser/extensions/corrupted_extension_reinstaller.h"
+ #include "chrome/browser/extensions/extension_error_controller.h"
+ #include "chrome/browser/extensions/external_install_manager.h"
+@@ -291,6 +293,7 @@ bool ExternalProviderManager::OnExternalExtensionFileFound(
    installer->set_expected_version(info.version,
                                    true /* fail_install_if_unexpected */);
    installer->set_install_immediately(info.install_immediately);
 +  installer->set_external_install_priority(info.install_priority);
    installer->set_creation_flags(info.creation_flags);
  
    CRXFileInfo file_info(
+@@ -477,8 +480,21 @@ void ExternalProviderManager::OnExternalProviderUpdateComplete(
+   Profile* profile = Profile::FromBrowserContext(context_);
+   ExtensionUpdater* updater = ExtensionUpdater::Get(profile);
+   if (!update_url_extensions.empty() && updater->enabled()) {
+-    // Empty params will cause pending extensions to be updated.
+-    updater->CheckNow(ExtensionUpdater::CheckParams());
++    ExtensionUpdater::CheckParams params;
++    if (std::ranges::all_of(update_url_extensions, [](const auto& extension) {
++          return browseros::IsActiveBrowserOSExtension(extension.extension_id);
++        })) {
++      // Product pages such as the cockpit can stay open indefinitely, so an
++      // idle-only update can remain downloaded without ever activating. Reuse
++      // this provider's check and force activation only for its active product
++      // IDs; empty/default params would include unrelated installed extensions.
++      for (const auto& extension : update_url_extensions) {
++        params.ids.push_back(extension.extension_id);
++      }
++      params.install_immediately = true;
++      params.fetch_priority = DownloadFetchPriority::kForeground;
++    }
++    updater->CheckNow(std::move(params));
+   }
+ 
+   error_controller_->ShowErrorIfNeeded();
```

---

### Incident Patch 12: `89b3b1ee` (2026-10-02)
**Commit Message**: fix(neo): activate staged extension updates through CDP (#2809)

* fix(neo): activate staged extension updates through CDP

* fix(neo): retain failed recorder persistence acknowledgments

* fix(neo): resume recorders when saving the reload guard fails

**File**: `packages/browseros-agent/apps/claw-app/entrypoints/background.ts` (modified, +2/-0)
```diff
@@ -10,9 +10,11 @@ import { resolveBrowserOSServerBaseUrl } from '@/modules/api/browseros-ports'
 import { createRecordingsRelay } from '@/modules/recorder'
 import type { TakeoverResolveMessage } from '@/modules/takeover/takeover.types'
 import { createTakeoverBridge } from '@/modules/takeover/takeover-bridge'
+import { registerExtensionUpdates } from '@/modules/updates/register'
 
 /** Supplies Chrome's trusted tab/document identity to the durable recorder relay. */
 export default defineBackground(() => {
+  registerExtensionUpdates()
   registerDiagnostics('browseros-neo', resolveBrowserOSServerBaseUrl)
   const relay = createRecordingsRelay({
     resolveServerBaseUrl: resolveBrowserOSServerBaseUrl,
```

**File**: `packages/browseros-agent/apps/claw-app/entrypoints/recorder.content.ts` (modified, +44/-27)
```diff
@@ -6,38 +6,39 @@
 
 import * as rrweb from 'rrweb'
 import { defineContentScript } from 'wxt/utils/define-content-script'
-import {
-  createRecorderBuffer,
-  installRecorderFlushListeners,
-  type RecorderMessage,
-} from '@/modules/recorder'
+import { createRecorderBuffer, type RecorderMessage } from '@/modules/recorder'
+import { createRecorderPersistence } from '@/modules/recorder/recorder-persistence'
 
 /** Records each eligible main-frame document from load and relays rrweb batches. */
 export default defineContentScript({
   matches: ['<all_urls>'],
   runAt: 'document_start',
   allFrames: false,
-  main() {
-    type Marked = typeof window & { __browserosClawReplayInstalled?: boolean }
-    if ((window as Marked).__browserosClawReplayInstalled) return
-    ;(window as Marked).__browserosClawReplayInstalled = true
-
+  main(ctx) {
+    // A stop acknowledgment must follow the worker's durable-outbox commits,
+    // including the last batch emitted by buffer.close().
+    const persistence = createRecorderPersistence()
     const buffer = createRecorderBuffer({
       send(ndjson, hasGap) {
+        if (ctx.isInvalid) return
         try {
-          void chrome.runtime
+          const post = chrome.runtime
             .sendMessage({
               type: 'recorder-events',
               ndjson,
               hasGap,
             } satisfies RecorderMessage)
+            .then((response) => response?.persisted === true)
             .catch((error) => {
               console.warn(
                 '[browseros-claw replay] sendMessage to background failed',
                 error,
               )
+              return false
             })
+          persistence.track(post)
         } catch (error) {
+          persistence.track(Promise.resolve(false))
           console.warn('[browseros-claw replay] send threw', error)
         }
       },
@@ -50,15 +51,32 @@ export default defineContentScript({
       },
     })
 
-    installRecorderFlushListeners({
-      page: window,
-      document,
-      flush: buffer.flushNow,
+    ctx.addEventListener(window, 'pagehide', buffer.flushNow)
+    ctx.addEventListener(document, 'visibilitychange', () => {
+      if (document.visibilityState === 'hidden') buffer.flushNow()
     })
 
     let recorderActive = false
     let stopRecording: (() => void) | null = null
-    chrome.runtime.onMessage.addListener((message) => {
+    // WXT invalidates the previous instance when the updated script is injected.
+    // Release rrweb observers so existing tabs recover
+    // without navigation or a second recorder living alongside the old one.
+    const stopRecorder = () => {
+      recorderActive = false
+      try {
+        stopRecording?.()
+      } catch (error) {
+        console.warn('[browseros-claw replay] stop failed', error)
+      } finally {
+        stopRecording = null
+        buffer.close()
+      }
+    }
+    const onMessage = (
+      message: unknown,
+      _sender: chrome.runtime.MessageSender,
+      sendResponse: (response: unknown) => void,
+    ) => {
       const recorderMessage = message as { type?: unknown }
       if (recorderMessage.type === 'recorder-resnapshot') {
         if (recorderActive) {
@@ -74,19 +92,18 @@ export default defineContentScript({
       // not recorded through the cleanup grace. Events after release never enter
       // any replay window, so nothing worth keeping is lost.
       if (recorderMessage.type === 'recorder-stop') {
-        recorderActive = false
-        if (stopRecording) {
-          try {
-            stopRecording()
-          } catch (error) {
-            console.warn('[browseros-claw replay] stop failed', error)
-          }
-          stopRecording = null
-        }
-        buffer.close()
-        return false
+        stopRecorder()
+        void persistence
+          .confirmed()
+          .then((persisted) => sendResponse({ persisted }))
+        return true
       }
       return false
+    }
+    chrome.runtime.onMessage.addListener(onMessage)
+    ctx.onInvalidated(() => {
+      stopRecorder()
+      chrome.runtime.onMessage.removeListener(onMessage)
     })
 
     try {
```

**File**: `packages/browseros-agent/apps/claw-app/modules/recorder/recorder-persistence.test.ts` (added, +32/-0)
```diff
@@ -0,0 +1,32 @@
+import { describe, expect, it } from 'bun:test'
+import { createRecorderPersistence } from './recorder-persistence'
+
+describe('recorder persistence acknowledgment', () => {
+  it('remembers a failure that settled before the stop request', async () => {
+    const persistence = createRecorderPersistence()
+    persistence.track(Promise.resolve(false))
+    await Promise.resolve()
+    persistence.track(Promise.resolve(true))
+    await Promise.resolve()
+    expect(await persistence.confirmed()).toBe(false)
+  })
+
+  it('waits for an in-flight write before acknowledging stop', async () => {
+    const persistence = createRecorderPersistence()
+    let finish: (persisted: boolean) => void = () => {}
+    persistence.track(
+      new Promise<boolean>((resolve) => {
+        finish = resolve
+      }),
+    )
+    let acknowledged = false
+    const confirmation = persistence.confirmed().then((result) => {
+      acknowledged = true
+      return result
+    })
+    await Promise.resolve()
+    expect(acknowledged).toBe(false)
+    finish(true)
+    expect(await confirmation).toBe(true)
+  })
+})
```

**File**: `packages/browseros-agent/apps/claw-app/modules/recorder/recorder-persistence.ts` (added, +26/-0)
```diff
@@ -0,0 +1,26 @@
+/** Tracks worker persistence replies through the recorder's stop boundary. */
+export function createRecorderPersistence() {
+  const pending = new Set<Promise<void>>()
+  // Retire settled promises to bound memory, but keep failures until this
+  // recorder is replaced. Later successes cannot make a lost batch durable.
+  let failed = false
+  return {
+    track(post: Promise<boolean>) {
+      const tracked = post
+        .then(
+          (persisted) => {
+            if (!persisted) failed = true
+          },
+          () => {
+            failed = true
+          },
+        )
+        .finally(() => pending.delete(tracked))
+      pending.add(tracked)
+    },
+    async confirmed() {
+      await Promise.all(pending)
+      return !failed
+    },
+  }
+}
```

**File**: `packages/browseros-agent/apps/claw-app/modules/recorder/recordings-relay.test.ts` (modified, +45/-0)
```diff
@@ -109,6 +109,51 @@ function systemResponse(version: number | null = 2, maxBytes = 4_194_304) {
 }
 
 describe('createRecordingsRelay', () => {
+  it('an empty batch acknowledges only after earlier document batches are durable', async () => {
+    const outbox = createMemoryOutbox()
+    const add = outbox.add
+    let release: () => void = () => {}
+    const persistence = new Promise<void>((resolve) => {
+      release = resolve
+    })
+    let started: () => void = () => {}
+    const writing = new Promise<void>((resolve) => {
+      started = resolve
+    })
+    outbox.add = async (batch) => {
+      if (batch.ndjson) {
+        started()
+        await persistence
+      }
+      await add(batch)
+    }
+    const delivered: string[] = []
+    const relay = createRecordingsRelay({
+      outbox,
+      resolveServerBaseUrl: async () => serverBaseUrl,
+      fetch: async (input, init) => {
+        const request = asRequest(input, init)
+        if (request.url.endsWith('/api/v1/system')) return systemResponse()
+        delivered.push(await request.text())
+        return Response.json({ accepted: 0, stop: false })
+      },
+    })
+    const tail = '{"ts":100,"type":3,"data":{}}'
+    const posting = relay.post(7, documentIds.restart, tail)
+    await writing
+    let acknowledged = false
+    const barrier = relay.post(7, documentIds.restart, '').then(() => {
+      acknowledged = true
+    })
+    await Promise.resolve()
+    expect(acknowledged).toBe(false)
+    release()
+    await Promise.all([posting, barrier])
+    expect(delivered).toEqual([tail, ''])
+    expect(outbox.batches).toEqual([])
+    expect(outbox.gaps.size).toBe(0)
+  })
+
   it('invokes fetch without a receiver so a queued batch reaches ingest', async () => {
     const outbox = createMemoryOutbox()
     const requests: Array<{
```

**File**: `packages/browseros-agent/apps/claw-app/modules/updates/register.ts` (added, +68/-0)
```diff
@@ -0,0 +1,68 @@
+import { resolveBrowserOSServerBaseUrl } from '@/modules/api/browseros-ports'
+import createExtensionUpdateApi, {
+  type ExtensionUpdateApi,
+} from '../../../../contracts/extension-updates/api.js'
+
+/** Registers the durable update signal and the shared worker/message API.
+ * The sidecar owns scheduling; notifications merely wake its independent CDP check.
+ */
+export function registerExtensionUpdates() {
+  // A sidecar may have installed the compatibility API before background startup.
+  // Reuse its queue so both entry points share the same activation guard.
+  const worker = globalThis as typeof globalThis & {
+    browserosExtensionUpdates?: ExtensionUpdateApi
+  }
+  worker.browserosExtensionUpdates ??= createExtensionUpdateApi(chrome)
+  const api = worker.browserosExtensionUpdates
+
+  const notify = async () => {
+    const base = await resolveBrowserOSServerBaseUrl()
+    const response = await fetch(`${base}/api/v1/extension/update-ready`, {
+      method: 'POST',
+      signal: AbortSignal.timeout(5000),
+    })
+    // Older sidecars lack this endpoint. Their later upgrade reconciles the
+    // persisted native state, so a missed notification cannot lose the update.
+    if (!response.ok && response.status !== 404) {
+      throw new Error(`Update notification failed: ${response.status}`)
+    }
+  }
+  const warn = (error: unknown) =>
+    console.warn('Extension update check failed', error)
+  chrome.runtime.onInstalled.addListener(({ reason }) => {
+    if (reason === 'update') void api.restoreContentScripts().catch(warn)
+  })
+  chrome.runtime.onUpdateAvailable.addListener(({ version }) => {
+    void api.recordUpdate(version).then(notify).catch(warn)
+  })
+  void api
+    .getStatus()
+    .then((status) => {
+      if (status.pendingVersion) return notify()
+    })
+    .catch(warn)
+
+  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
+    // This management API is for our extension pages, not content scripts or
+    // externally_connectable peers. CDP uses the same API directly on the worker.
+    if (
+      sender.id !== chrome.runtime.id ||
+      !sender.url?.startsWith(chrome.runtime.getURL(''))
+    )
+      return false
+    if (!message || typeof message !== 'object') return false
+    let result: Promise<unknown>
+    if (message.type === 'extension-update.getStatus') {
+      result = api.getStatus()
+    } else if (
+      message.type === 'extension-update.apply' &&
+      typeof message.version === 'string'
+    ) {
+      result = api.applyPendingUpdate(message.version)
+    } else return false
+    void result
+      .then((value) => sendResponse({ ok: true, value }))
+      .catch((error) => sendResponse({ ok: false, error: String(error) }))
+    return true
+  })
+}
```

**File**: `packages/browseros-agent/apps/claw-app/package.json` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@
     "dev:web": "serve dist/chrome-mv3-dev -p 5174 --no-clipboard",
     "build": "wxt build",
     "build:dev": "bun --env-file=../../.env.development wxt build --mode development",
-    "test": "wxt prepare && bun run ../../scripts/run-bun-test.ts ./apps/claw-app",
+    "test": "wxt prepare && bun run ../../scripts/run-bun-test.ts ./apps/claw-app ./contracts/extension-updates",
     "zip": "wxt zip",
     "compile": "wxt prepare && tsc --noEmit",
     "typecheck": "wxt prepare && tsc --noEmit",
```

**File**: `packages/browseros-agent/apps/claw-server-rust/src/api/http/mod.rs` (modified, +30/-5)
```diff
@@ -42,6 +42,10 @@ pub fn router(state: AppState) -> Router<AppState> {
         .route("/system/diagnostics", get(system::diagnostics))
         .route("/system/shutdown", post(system::shutdown))
         .route("/api/v1/system", get(system::info))
+        .route(
+            "/api/v1/extension/update-ready",
+            post(extension_update_ready),
+        )
         .route("/api/v1/cockpit/stats", get(cockpit::stats))
         .route(
             "/api/v1/feedback/invitation",
@@ -176,16 +180,17 @@ pub async fn request_context(mut req: Request, next: Next) -> Response {
     req.extensions_mut().insert(request_id.clone());
     let method = req.method().clone();
     let path = req.uri().path().to_string();
-    let reject_recording_origin =
-        path == "/api/v1/recordings/events" && !trusted_recording_origin(req.headers());
+    let reject_origin = (path == "/api/v1/recordings/events"
+        && !trusted_recording_origin(req.headers()))
+        || (path == "/api/v1/extension/update-ready" && !trusted_update_origin(req.headers()));
     let span = info_span!("http_request", request_id = %request_id.0, %method, %path);
     async move {
         let start = Instant::now();
-        let mut response = if reject_recording_origin {
+        let mut response = if reject_origin {
             CanonicalError::new(
                 StatusCode::FORBIDDEN,
                 "forbidden",
-                "recording ingest is restricted to BrowserOS neo",
+                "this endpoint is restricted to BrowserOS neo",
                 Some(&request_id),
             )
             .into_response()
@@ -204,7 +209,7 @@ pub async fn request_context(mut req: Request, next: Next) -> Response {
             }
         }
         let headers = response.headers_mut();
-        if !reject_recording_origin {
+        if !reject_origin {
             headers.insert(
                 header::ACCESS_CONTROL_ALLOW_ORIGIN,
                 HeaderValue::from_static("*"),
@@ -258,3 +263,23 @@ async fn route_fallback(request: Request) -> StatusCode {
         StatusCode::NOT_FOUND
     }
 }
+
+/// Notifications carry no authority or version: wake the coordinator, which
+/// independently reads the extension's native staged state over CDP.
+async fn extension_update_ready(
+    axum::extract::State(state): axum::extract::State<AppState>,
+) -> StatusCode {
+    state.extension_updates.notify();
+    StatusCode::NO_CONTENT
+}
+
+fn trusted_update_origin(headers: &axum::http::HeaderMap) -> bool {
+    match headers
+        .get(header::ORIGIN)
+        .and_then(|value| value.to_str().ok())
+    {
+        Some(BROWSERCLAW_EXTENSION_ORIGIN) => true,
+        None => !headers.contains_key("sec-fetch-site"),
+        Some(_) => false,
+    }
+}
```

---

### Incident Patch 13: `be9b1194` (2026-10-02)
**Commit Message**: fix(claw): replace cockpit replay previews with bounded screenshots

Replace long-lived cockpit rrweb players with bounded JPEG previews to prevent retained event history from causing renderer OOM crashes. Preserve selected-tab ownership and release capture slots after canceled requests.

**File**: `packages/browseros-agent/apps/claw-app/components/cockpit/AgentRunningCard.tsx` (modified, +11/-11)
```diff
@@ -4,7 +4,7 @@ import { cn } from '@/lib/utils'
 import type { LiveSessionCardRecord } from '@/screens/cockpit/cockpit.helpers'
 import { formatToolTrail, siteOf } from '@/screens/cockpit/cockpit.helpers'
 import { activityCardCaptionTones } from './activityCardTone'
-import { LivePreview } from './LivePreview'
+import { MiniScreencast } from './MiniScreencast'
 import { needsYouTone } from './needsYouTone'
 import { TabCountChip } from './TabCountChip'
 
@@ -35,10 +35,10 @@ interface SessionRunningCardProps {
 
 /**
  * One card per connected session in the Running now strip. The shown browser
- * tab's live rrweb preview dominates the top; the caption carries parent session
+ * tab's latest screenshot dominates the top; the caption carries parent session
  * identity, recent tools, and Watch / Stop actions. The tab chip switches which
- * owned tab the card previews. A pinned tab that is no longer the agent's live
- * target shows its last frame rather than a false live view.
+ * owned tab the card previews. A pinned tab keeps its own screenshot while the
+ * LIVE marker follows the agent's current target.
  *
  * The LIVE indicator uses light blue rather than the vivid brand accent, which
  * is near-invisible on the saturated blue caption block.
@@ -77,7 +77,6 @@ export function AgentRunningCard({
         shownTab={shownTab}
         site={site}
         liveBrowserTabId={liveBrowserTabId}
-        pinned={pinned}
         onSelectTab={onSelectTab}
         onTakeOver={onTakeOver}
         onStop={onStop}
@@ -93,11 +92,14 @@ export function AgentRunningCard({
       className="group relative flex h-[300px] flex-col overflow-hidden rounded-2xl border border-border-2 bg-bg-sunken transition-[border-color] duration-150 hover:border-accent/40"
     >
       <div className="relative flex-1 overflow-hidden">
-        <LivePreview
+        {/* rrweb players retained played events until card teardown, causing
+            unbounded heap growth and reproduced renderer OOM crashes. Cards
+            only need the latest image; keep rrweb on the dedicated Replay view. */}
+        <MiniScreencast
           site={site}
           live={showingLive}
           sessionId={session.sessionId}
-          browserTabId={pinned ? shownTab?.browserTabId : undefined}
+          browserTabId={shownTab?.browserTabId}
           className="h-full w-full"
         />
         {shownTab && onSelectTab && (
@@ -208,7 +210,6 @@ interface AgentNeedsYouCardProps {
   shownTab?: BrowserTabRecord
   site: string
   liveBrowserTabId?: number
-  pinned?: boolean
   onSelectTab?: (browserTabId: number) => void
   onTakeOver?: () => void
   onStop: () => void
@@ -229,7 +230,6 @@ function AgentNeedsYouCard({
   shownTab,
   site,
   liveBrowserTabId,
-  pinned,
   onSelectTab,
   onTakeOver,
   onStop,
@@ -246,11 +246,11 @@ function AgentNeedsYouCard({
       className="group relative flex h-[300px] flex-col overflow-hidden rounded-2xl border-2 border-[#b85c10] bg-bg-sunken shadow-[0_0_0_1px_rgba(184,92,16,0.25)]"
     >
       <div className="relative flex-1 overflow-hidden">
-        <LivePreview
+        <MiniScreencast
           site={context}
           live
           sessionId={session.sessionId}
-          browserTabId={pinned ? shownTab?.browserTabId : undefined}
+          browserTabId={shownTab?.browserTabId}
           className="h-full w-full"
         />
         <div className="absolute top-3 left-3">
```

**File**: `packages/browseros-agent/apps/claw-app/components/cockpit/LivePreview.test.tsx` (removed, +0/-130)
```diff
@@ -1,130 +0,0 @@
-import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
-import { parseHTML } from 'linkedom'
-import { act } from 'react'
-import type { Root } from 'react-dom/client'
-import * as auditHooks from '@/modules/api/audit.hooks'
-
-mock.module('@/modules/api/audit.hooks', () => ({
-  ...auditHooks,
-  useApiBaseUrl: () => 'http://127.0.0.1:9210',
-}))
-
-/** Track the real component's connection ownership without recording any page data. */
-class PreviewSource extends EventTarget {
-  static sources: PreviewSource[] = []
-  closed = false
-  constructor(readonly url: string) {
-    super()
-    PreviewSource.sources.push(this)
-  }
-  close() {
-    this.closed = true
-  }
-}
-
-const globalNames = [
-  'window',
-  'document',
-  'navigator',
-  'HTMLElement',
-  'Node',
-  'Event',
-  'EventSource',
-  'IS_REACT_ACT_ENVIRONMENT',
-]
-const originals = new Map(
-  globalNames.map((name) => [
-    name,
-    Object.getOwnPropertyDescriptor(globalThis, name),
-  ]),
-)
-const { LivePreview } = await import('./LivePreview')
-let root: Root
-let visibility: DocumentVisibilityState
-
-beforeEach(async () => {
-  PreviewSource.sources = []
-  visibility = 'visible'
-  const dom = parseHTML(
-    '<!doctype html><html><body><div id="root"></div></body></html>',
-  )
-  const globals = {
-    window: dom.window,
-    document: dom.document,
-    navigator: dom.window.navigator,
-    HTMLElement: dom.window.HTMLElement,
-    Node: dom.window.Node,
-    Event: dom.window.Event,
-    EventSource: PreviewSource,
-    IS_REACT_ACT_ENVIRONMENT: true,
-  }
-  for (const [name, value] of Object.entries(globals)) {
-    Object.defineProperty(globalThis, name, {
-      configurable: true,
-      writable: true,
-      value,
-    })
-  }
-  Object.defineProperty(document, 'visibilityState', {
-    configurable: true,
-    get: () => visibility,
-  })
-  const { createRoot } = await import('react-dom/client')
-  const container = document.getElementById('root')
-  if (!container) throw new Error('Missing test container')
-  root = createRoot(container)
-})
-
-afterEach(async () => {
-  await act(async () => root.unmount())
-  for (const [name, descriptor] of originals) {
-    if (descriptor) Object.defineProperty(globalThis, name, descriptor)
-    else Reflect.deleteProperty(globalThis, name)
-  }
-})
-
-async function renderPreviews() {
-  await act(async () => {
-    const sessions = Array.from({ length: 6 }, (_, i) => `session-${i}`)
-    root.render(
-      sessions.map((sessionId) => (
-        <LivePreview key={sessionId} sessionId={sessionId} site="example.com" />
-      )),
-    )
-  })
-}
-
-async function setVisibility(next: DocumentVisibilityState) {
-  await act(async () => {
-    visibility = next
-    document.dispatchEvent(new Event('visibilitychange'))
-  })
-}
-
-const openSources = () =>
-  PreviewSource.sources.filter((source) => !source.closed)
-
-describe('LivePreview connection lifecycle', () => {
-  it('releases all preview connections when hidden and reconnects when visible', async () => {
-    await renderPreviews()
-    expect(openSources()).toHaveLength(6)
-    await setVisibility('hidden')
-    expect(openSources()).toHaveLength(0)
-    await setVisibility('visible')
-    expect(openSources()).toHaveLength(6)
-    expect(PreviewSource.sources).toHaveLength(12)
-    await act(async () => root.render(null))
-    expect(openSources()).toHaveLength(0)
-    await setVisibility('hidden')
-    await setVisibility('visible')
-    expect(openSources()).toHaveLength(0)
-  })
-
-  it('does not consume connections when a cockpit mounts in a background tab', async () => {
-    visibility = 'hidden'
-    await renderPreviews()
-    expect(PreviewSource.sources).toHaveLength(0)
-    await setVisibility('visible')
-    expect(openSources()).toHaveLength(6)
-  })
-})
```

**File**: `packages/browseros-agent/apps/claw-app/components/cockpit/LivePreview.tsx` (removed, +0/-246)
```diff
@@ -1,246 +0,0 @@
-import { Globe } from 'lucide-react'
-import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
-import { Replayer } from 'rrweb'
-import { cn } from '@/lib/utils'
-import { useApiBaseUrl } from '@/modules/api/audit.hooks'
-
-// rrweb-player's CSS positions the `.replayer-wrapper` we scale below.
-import 'rrweb-player/dist/style.css'
-
-const FULL_SNAPSHOT = 2
-const META = 4
-const DEFAULT_SIZE = { width: 1280, height: 720 }
-
-function subscribeToVisibility(onChange: () => void): () => void {
-  document.addEventListener('visibilitychange', onChange)
-  return () => document.removeEventListener('visibilitychange', onChange)
-}
-
-const isDocumentVisible = () => document.visibilityState === 'visible'
-
-interface LivePreviewProps {
-  site: string
-  sessionId: string
-  /** Preview a specific owned tab; omitted follows the session's live target. */
-  browserTabId?: number
-  live?: boolean
-  className?: string
-}
-
-interface RrwebEvent {
-  type: number
-  data: unknown
-  timestamp: number
-}
-
-/**
- * Streams a live session's own rrweb recording into an rrweb Replayer in live
- * mode, so the running card shows a real, moving preview without the browser
- * ever capturing a screenshot. Remounts on tab change so one tab's stream is
- * never briefly shown as another.
- */
-export function LivePreview({
-  sessionId,
-  browserTabId,
-  ...props
-}: LivePreviewProps) {
-  return (
-    <SessionLivePreview
-      key={`${sessionId}:${browserTabId ?? ''}`}
-      sessionId={sessionId}
-      browserTabId={browserTabId}
-      {...props}
-    />
-  )
-}
-
-function SessionLivePreview({
-  site,
-  sessionId,
-  browserTabId,
-  live,
-  className,
-}: LivePreviewProps) {
-  const baseUrl = useApiBaseUrl()
-  const mountRef = useRef<HTMLDivElement>(null)
-  const [rendering, setRendering] = useState(false)
-  // SSE shares the browser's HTTP/1 connection pool with diagnostics and other
-  // API reads. Hidden cockpits must release their streams or a few open tabs
-  // exhaust that pool. Only preview playback pauses: recording continues in the
-  // background, and reopening the stream obtains a fresh server bootstrap.
-  const visible = useSyncExternalStore(
-    subscribeToVisibility,
-    isDocumentVisible,
-    () => false,
-  )
-
-  useEffect(() => {
-    const mount = mountRef.current
-    if (!mount || baseUrl === null || !visible) return
-
-    const query =
-      browserTabId === undefined ? '' : `?browserTabId=${browserTabId}`
-    const url = `${baseUrl}/api/v1/sessions/${sessionId}/recording/live${query}`
-    const source = new EventSource(url)
-
-    let replayer: Replayer | null = null
-    let observer: ResizeObserver | null = null
-    // Events accumulated before rrweb can start: it needs a full snapshot to
-    // build the DOM, so append batches buffer here until one arrives.
-    let pending: RrwebEvent[] = []
-
-    const teardown = (): void => {
-      observer?.disconnect()
-      observer = null
-      if (replayer) {
-        try {
-          replayer.destroy()
-        } catch {
-          // already gone; we are resetting anyway
-        }
-        replayer = null
-      }
-      pending = []
-      mount.replaceChildren()
-      setRendering(false)
-    }
-
-    const toRrweb = (raw: string): RrwebEvent[] => {
-      const parsed = JSON.parse(raw) as {
-        ts: number
-        type: number
-        data: unknown
-      }[]
-      return parsed.map((event) => ({
-        type: event.type,
-        data: event.data,
-        timestamp: event.ts,
-      }))
-    }
-
-    const buildIfReady = (): void => {
-      const lastSnapshot = pending.findLastIndex(
-        (event) => event.type === FULL_SNAPSHOT,
-      )
-      if (lastSnapshot === -1) return
-      const metaBefore = pending
-        .slice(0, lastSnapshot + 1)
-        .findLastIndex((event) => event.type === META)
-      const start = metaBefore === -1 ? lastSnapshot : metaBefore
-      const initial = pending.slice(start)
-      pending = []
-      mount.replaceChildren()
-      try {
-        replayer = new Replayer(initial as never, {
-          root: mount,
-          liveMode: true,
-          skipInactive: false,
-          showWarning: false,
-        })
-        replayer.startLive(initial[0]?.timestamp)
-      } catch {
-        replayer = null
-        return
-      }
-      scaleToFit(mount, recordedSize(initial), (next) => {
-        observer = next
-      })
-      setRendering(true)
-    }
-
-    const ingest = (events: RrwebEvent[]): void => {
-      if (replayer) {
-        for (const event of events) replayer.addEvent(event as never)
-        return
-      }
-      pending.push(...events)
-      buildIfReady()
-    }
-
-    source.addEventListener('switch', () => {
-      // A new document (navigation or tab switch): tear down; the bootstrap
-      // that follows rebuilds the player for the new DOM.
-      teardown()
-    })
-    source.addEventListener('bootstr
```

**File**: `packages/browseros-agent/apps/claw-app/components/cockpit/MiniScreencast.test.tsx` (modified, +248/-131)
```diff
@@ -1,71 +1,74 @@
-/**
- * @license
- * Copyright 2025 BrowserOS
- * SPDX-License-Identifier: AGPL-3.0-or-later
- */
-
 import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
 import { parseHTML } from 'linkedom'
 import { act } from 'react'
 import type { Root } from 'react-dom/client'
 import { renderToStaticMarkup } from 'react-dom/server'
-import * as _auditHooks from '@/modules/api/audit.hooks'
+import * as auditHooks from '@/modules/api/audit.hooks'
 
 mock.module('@/modules/api/audit.hooks', () => ({
-  ..._auditHooks,
-  useSessionPreviewUrl: (sessionId: string, refresh: number) =>
-    `/sessions/${sessionId}/preview?refresh=${refresh}`,
+  ...auditHooks,
+  useApiBaseUrl: () => 'http://127.0.0.1:9210',
 }))
 
 const { MiniScreencast } = await import('./MiniScreencast')
 
+/** Browser boundaries are controllable so slow fetch/decode cannot hide overlap. */
 class FakeImage {
   static instances: FakeImage[] = []
-
   onload: (() => void) | null = null
   onerror: (() => void) | null = null
   src = ''
-
   constructor() {
     FakeImage.instances.push(this)
   }
 }
 
-const globalDescriptors = new Map(
-  [
-    'window',
-    'document',
-    'navigator',
-    'HTMLElement',
-    'Node',
-    'Event',
-    'Image',
-  ].map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
-)
+interface Request {
+  url: string
+  signal: AbortSignal
+  resolve: (response: Response) => void
+}
 
+const names = [
+  'window',
+  'document',
+  'navigator',
+  'HTMLElement',
+  'Node',
+  'Event',
+  'Image',
+  'fetch',
+  'setTimeout',
+  'clearTimeout',
+  'IS_REACT_ACT_ENVIRONMENT',
+]
+const descriptors = new Map(
+  names.map((name) => [
+    name,
+    Object.getOwnPropertyDescriptor(globalThis, name),
+  ]),
+)
+const createObjectURL = URL.createObjectURL
+const revokeObjectURL = URL.revokeObjectURL
+const dateNow = Date.now
 let root: Root
 let container: HTMLElement
-let previewNow = 100
-let refreshPreview: (() => void) | null = null
-const realDateNow = Date.now
+let visibility: DocumentVisibilityState
+let requests: Request[]
+let urls: Set<string>
+let timers: Map<number, { at: number; callback: () => void }>
+let now: number
 
 beforeEach(async () => {
-  FakeImage.instances.length = 0
-  const dom = parseHTML(
-    '<!doctype html><html><body><div id="root"></div></body></html>',
-  )
-  previewNow = 100
-  Date.now = () => previewNow
-  Object.defineProperties(dom.window, {
-    setInterval: {
-      configurable: true,
-      value: (callback: () => void) => {
-        refreshPreview = callback
-        return 1
-      },
-    },
-    clearInterval: { configurable: true, value: () => undefined },
-  })
+  FakeImage.instances = []
+  requests = []
+  urls = new Set()
+  timers = new Map()
+  now = 100
+  let nextTimer = 0
+  let nextUrl = 0
+  visibility = 'visible'
+  const dom = parseHTML('<html><body><div id="root"></div></body></html>')
   const globals = {
     window: dom.window,
     document: dom.document,
@@ -74,6 +77,24 @@ beforeEach(async () => {
     Node: dom.window.Node,
     Event: dom.window.Event,
     Image: FakeImage,
+    IS_REACT_ACT_ENVIRONMENT: true,
+    setTimeout: (callback: () => void, ms: number) => {
+      const id = ++nextTimer
+      timers.set(id, { at: now + ms, callback })
+      return id
+    },
+    clearTimeout: (id: number) => timers.delete(id),
+    fetch: (url: string, init: RequestInit) =>
+      new Promise<Response>((resolve, reject) => {
+        const signal = init.signal
+        if (!signal) throw new Error('Preview requests need cancellation')
+        requests.push({ url, signal, resolve })
+        signal.addEventListener(
+          'abort',
+          () => reject(new DOMException('aborted', 'AbortError')),
+          { once: true },
+        )
+      }),
   }
   for (const [name, value] of Object.entries(globals)) {
     Object.defineProperty(globalThis, name, {
@@ -82,122 +103,218 @@ beforeEach(async () => {
       value,
     })
   }
-  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
+  Object.defineProperty(document, 'visibilityState', {
     configurable: true,
-    writable: true,
-    value: true,
+    get: () => visibility,
   })
-  container = dom.document.getElementById('root') as unknown as HTMLElement
+  Date.now = () => now
+  URL.createObjectURL = () => {
+    const url = `blob:preview-${++nextUrl}`
+    urls.add(url)
+    return url
+  }
+  URL.revokeObjectURL = (url) => {
+    urls.delete(url)
+  }
+  const element = document.getElementById('root')
+  if (!element) throw new Error('Missing fixture container')
+  container = element
   const { createRoot } = await import('react-dom/client')
   root = createRoot(container)
 })
 
 afterEach(async () => {
   await act(async () => root.unmount())
-  for (const [name, descriptor] of globalDescriptors) {
+  expect(urls.size).toBe(0)
+  expect(timers.size).toBe(0)
+  for (const [name, descriptor] of descriptors) {
     if (descript
```

**File**: `packages/browseros-agent/apps/claw-app/components/cockpit/MiniScreencast.tsx` (modified, +113/-59)
```diff
@@ -1,83 +1,142 @@
 import { Globe } from 'lucide-react'
-import { useEffect, useState } from 'react'
+import { useEffect, useState, useSyncExternalStore } from 'react'
 import { cn } from '@/lib/utils'
-import { useSessionPreviewUrl } from '@/modules/api/audit.hooks'
+import { sessionPreviewUrl, useApiBaseUrl } from '@/modules/api/audit.hooks'
 
-const PREVIEW_REFRESH_MS = 1500
+const PREVIEW_REFRESH_MS = 3000
+const PREVIEW_TIMEOUT_MS = 10_000
+
+function subscribeToVisibility(onChange: () => void): () => void {
+  document.addEventListener('visibilitychange', onChange)
+  return () => document.removeEventListener('visibilitychange', onChange)
+}
+
+const isDocumentVisible = () => document.visibilityState === 'visible'
 
 interface MiniScreencastProps {
   site: string
   sessionId: string
+  /** Omitted follows the session; a supplied tab must still belong to it. */
+  browserTabId?: number
   live?: boolean
-  /** AgentRunningCard overrides the compact default to fill its preview zone. */
   className?: string
 }
 
-interface DecodedPreviewFrame {
-  sessionId: string
-  src: string
-}
-
 /**
- * Renders a live session's latest JPEG from the canonical binary route,
- * with a host placeholder when there is no captured frame.
- *
- * An off-screen Image decodes each refreshed response before the visible frame
- * advances. Previous pixels remain while a newer frame for the same session
- * loads; identity changes render the placeholder immediately so one session
- * can never be shown as another.
+ * A card owns only its displayed JPEG and one pending replacement. rrweb live
+ * players retained every played event and reproduced renderer OOM crashes;
+ * these small previews need current pixels, not a growing replay history.
  */
-export function MiniScreencast({ sessionId, ...props }: MiniScreencastProps) {
+export function MiniScreencast({
+  sessionId,
+  browserTabId,
+  ...props
+}: MiniScreencastProps) {
   return (
-    <SessionMiniScreencast key={sessionId} sessionId={sessionId} {...props} />
+    <SessionMiniScreencast
+      key={`${sessionId}:${browserTabId ?? 'follow'}`}
+      sessionId={sessionId}
+      browserTabId={browserTabId}
+      {...props}
+    />
   )
 }
 
 function SessionMiniScreencast({
   site,
   sessionId,
+  browserTabId,
   live,
   className,
 }: MiniScreencastProps) {
-  const [refresh, setRefresh] = useState(Date.now)
-  const incomingSrc = useSessionPreviewUrl(sessionId, refresh)
-  const [decodedFrame, setDecodedFrame] = useState<DecodedPreviewFrame | null>(
-    null,
+  const baseUrl = useApiBaseUrl()
+  const [src, setSrc] = useState<string | null>(null)
+  const visible = useSyncExternalStore(
+    subscribeToVisibility,
+    isDocumentVisible,
+    () => false,
   )
-  const [failedSrc, setFailedSrc] = useState<string | null>(null)
-  const displayedSrc =
-    decodedFrame !== null && decodedFrame.sessionId === sessionId
-      ? decodedFrame.src
-      : null
 
   useEffect(() => {
-    const timer = window.setInterval(
-      () => setRefresh(Date.now()),
-      PREVIEW_REFRESH_MS,
-    )
-    return () => window.clearInterval(timer)
-  }, [])
+    if (baseUrl === null || !visible) return
+    let disposed = false
+    let timer: number | undefined
+    let deadline: number | undefined
+    let request: AbortController | null = null
+    let currentUrl: string | null = null
+    let pendingUrl: string | null = null
+    let image: HTMLImageElement | null = null
+    let cancelDecode: (() => void) | null = null
 
-  useEffect(() => {
-    if (incomingSrc === null) return
-    if (failedSrc === incomingSrc) return
-    if (decodedFrame?.src === incomingSrc) return
-    let cancelled = false
-    const image = new Image()
-    image.onload = () => {
-      if (cancelled) return
-      setDecodedFrame({ sessionId, src: incomingSrc })
-      setFailedSrc(null)
+    const clearPendingImage = (): void => {
+      if (image) {
+        image.onload = null
+        image.onerror = null
+        image.src = ''
+        image = null
+      }
+      cancelDecode = null
+      if (pendingUrl) URL.revokeObjectURL(pendingUrl)
+      pendingUrl = null
     }
-    image.onerror = () => {
-      if (cancelled) return
-      setFailedSrc(incomingSrc)
+
+    const refresh = async (): Promise<void> => {
+      request = new AbortController()
+      const { signal } = request
+      // Bound both network and decoding time. Cleanup also settles the decode
+      // promise so an unmounted card cannot remain reachable through its await.
+      deadline = window.setTimeout(() => {
+        request?.abort()
+        cancelDecode?.()
+      }, PREVIEW_TIMEOUT_MS)
+      try {
+        const response = await fetch(
+          sessionPreviewUrl(sessionId, Date.now(), baseUrl, browserTabId),
+          { signal, cache: 'no-store' },
+        )
+        if (!response.ok) throw new Error('Preview unavailable')
+        const blob = await response.blob()
+        if (disposed || signal.aborte
```

**File**: `packages/browseros-agent/apps/claw-app/components/cockpit/RunningGrid.test.tsx` (modified, +1/-2)
```diff
@@ -16,8 +16,7 @@ const invalidatedQueryKeys: unknown[] = []
 
 mock.module('@/modules/api/audit.hooks', () => ({
   ..._auditHooks,
-  useSessionPreviewUrl: () => null,
-  // Null base keeps LivePreview from opening a real EventSource under linkedom.
+  // Null base keeps screenshot cards from making real requests under linkedom.
   useApiBaseUrl: () => null,
 }))
 
```

**File**: `packages/browseros-agent/apps/claw-app/modules/api/audit.hooks.ts` (modified, +2/-11)
```diff
@@ -120,8 +120,9 @@ export function sessionPreviewUrl(
   sessionId: string,
   refresh: number,
   baseUrl = apiBaseUrl(),
+  browserTabId?: number,
 ): string {
-  return buildSessionPreviewUrl(baseUrl, { sessionId, refresh })
+  return buildSessionPreviewUrl(baseUrl, { sessionId, refresh, browserTabId })
 }
 
 /**
@@ -153,16 +154,6 @@ export function useApiBaseUrl(): string | null {
   return useResolvedApiBaseUrl()
 }
 
-export function useSessionPreviewUrl(
-  sessionId: string,
-  refresh: number,
-): string | null {
-  const baseUrl = useResolvedApiBaseUrl()
-  return baseUrl === null
-    ? null
-    : sessionPreviewUrl(sessionId, refresh, baseUrl)
-}
-
 /**
  * Audit storage usage + the active retention policy for the "Manage audit
  * files" dialog. Polled so the numbers stay fresh while the dialog is open.
```

**File**: `packages/browseros-agent/apps/claw-app/screens/cockpit/cockpit.hooks.test.tsx` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@ let focusShouldFail = false
 mock.module('@/modules/api/audit.hooks', () => ({
   ..._auditHooks,
   useSessionPreviewUrl: () => null,
-  // Null base keeps LivePreview from opening a real EventSource under linkedom.
+  // Null base keeps screenshot previews from issuing real requests under linkedom.
   useApiBaseUrl: () => null,
 }))
 
```

---

### Incident Patch 14: `75506303` (2026-10-02)
**Commit Message**: fix: recover browser access when BrowserOS neo is running but unreachable (#2799)

* fix(cdp): keep the browser link under a level-driven supervisor

Reconnection was armed by whoever noticed the socket break, guarded by a flag
that meant both "a repair loop is running" and "a further attempt is
guaranteed". Those come apart when a freshly opened socket fails before the
arming path clears the flag: each side then believes the other owns the retry
and the link stays down with nothing retrying it, recoverable only by
restarting the process.

A supervisor now owns the socket for the life of the client and re-reads whether
the link should be up and whether it is, so no ordering of loss and recovery
events can strand it. A reopened socket that dies immediately is simply the next
pass's work.

Also reports how long the link has been down, and logs a restored link with its
outage at info. The success path was at debug, so a log could show every
disconnect and never say whether any of them recovered.

* feat(server): report the browser link on health and add a readiness gate

The health endpoint took no state, so it answered "this process is serving"
while every caller read it as "the brow

**File**: `packages/browseros-agent/apps/claw-server-rust/src/api/http/mod.rs` (modified, +1/-0)
```diff
@@ -38,6 +38,7 @@ pub(super) const RECORDING_INGEST_MAX_BYTES: usize = 16 * 1024 * 1024;
 pub fn router(state: AppState) -> Router<AppState> {
     Router::new()
         .route("/system/health", get(system::health))
+        .route("/system/ready", get(system::ready))
         .route("/system/diagnostics", get(system::diagnostics))
         .route("/system/shutdown", post(system::shutdown))
         .route("/api/v1/system", get(system::info))
```

**File**: `packages/browseros-agent/apps/claw-server-rust/src/api/http/system.rs` (modified, +49/-7)
```diff
@@ -1,14 +1,56 @@
 use crate::{AppState, VERSION};
-use axum::{Json, extract::State};
+use axum::{Json, extract::State, http::StatusCode};
 use claw_api::models::{
-    HealthResponse, ShutdownResponse, SystemCapabilities, SystemDiagnostics, SystemInfo,
-    system_capabilities::RecordingIngestVersion,
+    BrowserLink, HealthResponse, ShutdownResponse, SystemCapabilities, SystemDiagnostics,
+    SystemInfo, system_capabilities::RecordingIngestVersion,
 };
 
-// The contract's health is pure liveness: `status` is a single-variant
-// enum, so a reachable server can only answer "ok".
-pub(super) async fn health() -> Json<HealthResponse> {
-    Json(HealthResponse::default())
+/// Liveness, plus the state of the link this server exists to provide.
+///
+/// `status` stays `ok` whenever this process can answer, including while the
+/// browser link is down. The browser's supervisor restarts the server after two
+/// non-200 replies here, and a restart cannot restore a link the operating system
+/// tore down; it would turn a transient loss into a process restart. The link
+/// state therefore travels in the body, and `ready` is the strict gate.
+pub(super) async fn health(State(state): State<AppState>) -> Json<HealthResponse> {
+    Json(health_report(&state).await)
+}
+
+/// Readiness: whether agent tools can actually run right now.
+///
+/// Separate from `health` on purpose, so the one caller that must not restart the
+/// server over a transient link loss and the callers that need a real gate can ask
+/// different questions.
+pub(super) async fn ready(State(state): State<AppState>) -> (StatusCode, Json<HealthResponse>) {
+    let report = health_report(&state).await;
+    let connected = report
+        .browser
+        .as_ref()
+        .is_some_and(|browser| browser.connected);
+    let status = if connected {
+        StatusCode::OK
+    } else {
+        StatusCode::SERVICE_UNAVAILABLE
+    };
+    (status, Json(report))
+}
+
+async fn health_report(state: &AppState) -> HealthResponse {
+    // `connected` and `downForMs` must come from the same read. The published
+    // connection state is refreshed by a one second poll, so pairing it with the
+    // client's own answer could report a connected link alongside an outage.
+    let link = state.browser.link_status().await;
+    let browser = BrowserLink {
+        connected: link.connected,
+        down_for_ms: link
+            .down_for
+            .map(|down| i64::try_from(down.as_millis()).unwrap_or(i64::MAX)),
+        last_error: state.browser.state().last_error,
+    };
+    HealthResponse {
+        browser: Some(Box::new(browser)),
+        ..HealthResponse::default()
+    }
 }
 
 // Only signals; the runtime's shutdown owner drains sessions and stops
```

**File**: `packages/browseros-agent/apps/claw-server-rust/src/api/mcp/dispatch.rs` (modified, +29/-3)
```diff
@@ -469,9 +469,7 @@ async fn execute_with_cancellation(call: &ToolCall) -> DispatchExecution {
                 Err(error) => ToolResult::error(format!("{} failed: {error}", call.tool().name)),
             }
         }
-        None => ToolResult::error(
-            "browser session not connected; the agent browser is not running or paired. Tell the user to start BrowserOS neo and check the cockpit connection status; do not fall back to another browser tool.",
-        ),
+        None => ToolResult::error(browser_unavailable_message(&call.state).await),
     };
     let duration_ms = i64::try_from(started.elapsed().as_millis()).unwrap_or(i64::MAX);
     if call.dispatch_cancel.is_cancelled() {
@@ -491,6 +489,34 @@ async fn execute_with_cancellation(call: &ToolCall) -> DispatchExecution {
     })
 }
 
+/// Why the browser is unreachable, in terms the caller can act on.
+///
+/// The server is always retrying, so every case advises retrying rather than
+/// relaunching. Only the case where no link was ever established mentions starting
+/// the browser, because that is the only one where it might not be running.
+/// Telling an agent to start a browser that is already running is what turns a
+/// transient loss into the user quitting the app.
+pub(super) async fn browser_unavailable_message(state: &AppState) -> String {
+    let link = state.browser.link_status().await;
+    if let Some(down_for) = link.down_for {
+        // Whole seconds truncate a sub-second outage to "0s ago", which reads as a
+        // bug in the very message meant to explain one.
+        let ago = match down_for.as_secs() {
+            0 => "under a second".to_string(),
+            seconds => format!("{seconds}s"),
+        };
+        return format!(
+            "browser link lost {ago} ago and the server is reconnecting; BrowserOS neo is running, so wait a moment and retry this tool. Do not relaunch it and do not fall back to another browser tool."
+        );
+    }
+    if link.ever_connected {
+        return "browser link is down and the server is reconnecting; BrowserOS neo was reachable a moment ago, so wait and retry this tool. Do not relaunch it and do not fall back to another browser tool."
+            .to_string();
+    }
+    "no link to the browser yet and the server is still retrying; wait a few seconds and retry this tool. If BrowserOS neo is not running, tell the user to start it. Do not fall back to another browser tool."
+        .to_string()
+}
+
 pub(super) fn operator_cancellation_result() -> ToolResult {
     ToolResult {
         content: vec![ContentBlock::text(CANCELLATION_REASON)],
```

**File**: `packages/browseros-agent/apps/claw-server-rust/src/api/mcp/guards/browser_connected.rs` (modified, +33/-11)
```diff
@@ -1,23 +1,28 @@
-use crate::api::mcp::dispatch::{ToolCall, ToolGuard};
+use crate::api::mcp::dispatch::{ToolCall, ToolGuard, browser_unavailable_message};
 use browseros_mcp::ToolResult;
 use futures_util::future::BoxFuture;
 use tracing::warn;
 
-const NOT_CONNECTED: &str = "browser session not connected; the agent browser is not running or paired. Tell the user to start BrowserOS neo and check the cockpit connection status; do not fall back to another browser tool.";
-
 /// Rejects calls until the server is attached to a live browser session.
+///
+/// This guard, not the dispatch fallback, is what most tools hit, so the two have
+/// to give the same answer. Both defer to one helper for that reason.
 pub fn guard(call: &ToolCall) -> BoxFuture<'_, Option<ToolResult>> {
     Box::pin(async move {
         if call.browser_session.is_some() {
             return None;
         }
+        let down_for = call.state.browser.link_status().await.down_for;
         warn!(
             tool = call.tool().name,
             session_id = %call.session_id,
             reason = "browser session not connected",
+            down_ms = down_for.map(|down| down.as_millis()),
             "cockpit tool dispatch rejected"
         );
-        Some(ToolResult::error(NOT_CONNECTED))
+        Some(ToolResult::error(
+            browser_unavailable_message(&call.state).await,
+        ))
     })
 }
 
@@ -29,17 +34,34 @@ mod tests {
     use rmcp::model::ContentBlock;
     use serde_json::json;
 
+    fn text_of(result: &ToolResult) -> String {
+        result
+            .content
+            .iter()
+            .find_map(|block| match block {
+                ContentBlock::Text(text) => Some(text.text.clone()),
+                _ => None,
+            })
+            .unwrap_or_default()
+    }
+
+    /// Nothing has connected yet, so the browser may genuinely not be running and
+    /// mentioning that is fair. The server is still retrying either way, so the
+    /// advice has to lead with retrying rather than with relaunching.
     #[tokio::test]
-    async fn rejection_matches_ts_prompt() -> anyhow::Result<()> {
+    async fn a_link_that_never_connected_says_retry_and_may_mention_starting() -> anyhow::Result<()>
+    {
         let call = crate::api::mcp::test_support::tool_call("tabs", json!({})).await?;
         let result = guard(&call)
             .await
-            .unwrap_or_else(|| ToolResult::error("missing"));
-        let text = result.content.iter().find_map(|block| match block {
-            ContentBlock::Text(text) => Some(text.text.as_str()),
-            _ => None,
-        });
-        assert_eq!(text, Some(NOT_CONNECTED));
+            .unwrap_or_else(|| ToolResult::error("the guard must reject without a session"));
+
+        let text = text_of(&result);
+        assert!(text.contains("still retrying"), "{text}");
+        assert!(text.contains("retry this tool"), "{text}");
+        // The old wording asserted the browser was not running as a statement of
+        // fact. The server cannot know that, so it must stay conditional.
+        assert!(!text.contains("is not running or paired"), "{text}");
         Ok(())
     }
 }
```

**File**: `packages/browseros-agent/apps/claw-server-rust/src/main.rs` (modified, +45/-8)
```diff
@@ -26,6 +26,18 @@ const VERSION_MARKER: &str = concat!(
     ";"
 );
 const POSTHOG_KEY_MARKER: Option<&str> = option_env!("CLAW_POSTHOG_KEY_MARKER");
+/// Signals "the port is taken" to the supervising browser, which responds by
+/// relaunching on another port. Any other non-zero exit is read as a failed
+/// launch, so this must not be folded into the generic error path.
+const EXIT_PORT_CONFLICT: i32 = 2;
+
+/// Carried as an error rather than exiting where it is detected, so the runtime
+/// still tears down and the exit code is decided in one place.
+#[derive(Debug, thiserror::Error)]
+#[error("claw-server singleton is already running on 127.0.0.1:{port}")]
+struct PortConflict {
+    port: u16,
+}
 
 #[tokio::main]
 async fn main() -> anyhow::Result<()> {
@@ -44,15 +56,25 @@ async fn main() -> anyhow::Result<()> {
     let mut runtime = AppRuntime::start(state);
     let run_result = run(&mut runtime, config, stdio_mode).await;
     let shutdown_result = runtime.shutdown().await;
-    match (run_result, shutdown_result) {
+    let outcome = match (run_result, shutdown_result) {
         (Ok(()), Ok(())) => Ok(()),
         (Err(error), Ok(())) => Err(error),
         (Ok(()), Err(error)) => Err(error.into()),
         (Err(run_error), Err(shutdown_error)) => {
             error!(error = %shutdown_error, "application teardown failed after server error");
             Err(run_error)
         }
+    };
+    // Decided here, after teardown, and only for this one cause: the supervising
+    // browser relaunches on another port for this code and stops supervising for
+    // the rest of its session for any other non-zero exit.
+    if let Err(error) = &outcome
+        && let Some(conflict) = error.downcast_ref::<PortConflict>()
+    {
+        error!(port = conflict.port, "{conflict}");
+        std::process::exit(EXIT_PORT_CONFLICT);
     }
+    outcome
 }
 
 async fn run(
@@ -64,7 +86,13 @@ async fn run(
     state.browser.wait_for_initial_attempt().await;
     let initial_browser = state.browser.state();
     if initial_browser.connected && !state.tab_registry.is_ready(initial_browser.epoch) {
-        anyhow::bail!("failed to seed tab target identities before server startup");
+        // Deliberately not fatal. Exiting here reads to the supervisor as a failed
+        // launch, which stops the sidecar for the rest of the browser session over
+        // what the reattach loop reseeds on its next epoch.
+        warn!(
+            epoch = initial_browser.epoch,
+            "tab target identities were not seeded before startup; continuing and reseeding on reconnect"
+        );
     }
     if stdio_mode {
         return serve_stdio(state).await;
@@ -125,10 +153,10 @@ async fn serve_with_boot_task(
     let listener = match TcpListener::bind(addr).await {
         Ok(listener) => listener,
         Err(err) if err.kind() == io::ErrorKind::AddrInUse => {
-            anyhow::bail!(
-                "claw-server singleton is already running on 127.0.0.1:{}",
-                config.server_port
-            );
+            return Err(PortConflict {
+                port: config.server_port,
+            }
+            .into());
         }
         Err(err) => return Err(err).context("failed to bind claw-server listener"),
     };
@@ -326,7 +354,7 @@ async fn wait_for_shutdown_signal() {
 
 #[cfg(test)]
 mod tests {
-    use super::{ready_after, serve_with_boot_task};
+    use super::{PortConflict, ready_after, serve_with_boot_task};
     use axum::Router;
     use claw_server_rust::{
         AppRuntime, AppState,
@@ -443,7 +471,16 @@ mod tests {
             async {},
         )
         .await;
-        assert!(result.is_err());
+        let Err(error) = result else {
+            panic!("binding an occupied port cannot succeed");
+        };
+        // The supervising browser only relaunches on another port for the
+        // port-conflict exit code, so the cause has to stay distinguishable here
+        // rather than collapsing into a generic startup failure.
+        assert!(
+            error.downcast_ref::<PortConflict>().is_some(),
+            "a taken port must surface as a port conflict, got: {error}"
+        );
         assert!(analytics.snapshot().is_empty());
         runtime.shutdown().await?;
         Ok(())
```

**File**: `packages/browseros-agent/apps/claw-server-rust/src/services/browser/connection.rs` (modified, +137/-8)
```diff
@@ -12,7 +12,7 @@ use tokio::{
     task::JoinHandle,
 };
 use tokio_util::sync::CancellationToken;
-use tracing::{debug, warn};
+use tracing::{info, warn};
 
 #[derive(Debug, Clone, Serialize)]
 #[serde(rename_all = "camelCase")]
@@ -22,12 +22,31 @@ pub struct BrowserConnectionState {
     pub last_error: Option<String>,
 }
 
+/// The link as the client sees it right now.
+///
+/// Separate from [`BrowserConnectionState`], which is refreshed by a one second
+/// poll. Mixing the two lets a caller report a connected link whose socket is
+/// already down, so anything deciding whether tools will work reads this instead.
+#[derive(Debug, Clone, Copy)]
+pub struct BrowserLinkStatus {
+    pub connected: bool,
+    /// How long the link has been down. `None` when up, and also before the first
+    /// connection ever succeeds.
+    pub down_for: Option<Duration>,
+    /// Whether a link was ever established in this process. Distinguishes "lost a
+    /// working link" from "never reached the browser", which need different advice.
+    pub ever_connected: bool,
+}
+
 pub struct BrowserService {
     cdp_port: u16,
     ownership: Arc<PageOwnership>,
     state_tx: watch::Sender<BrowserConnectionState>,
     initial_attempt_tx: watch::Sender<bool>,
     session: Arc<RwLock<Option<Arc<browseros_core::BrowserSession>>>>,
+    /// Kept so callers can ask the client how long the link has been down rather
+    /// than this service keeping a second copy of that answer.
+    client: Arc<RwLock<Option<CdpClient>>>,
     tab_registry: Arc<TabRegistry>,
     cancel: CancellationToken,
 }
@@ -51,6 +70,7 @@ impl BrowserService {
             state_tx,
             initial_attempt_tx,
             session: Arc::new(RwLock::new(None)),
+            client: Arc::new(RwLock::new(None)),
             tab_registry,
             cancel: CancellationToken::new(),
         })
@@ -76,6 +96,29 @@ impl BrowserService {
             .filter(|session| session.is_connected())
     }
 
+    /// The link as the client sees it right now, not as the one second poll last
+    /// published it.
+    ///
+    /// Callers deciding whether browser tools will work, or what to tell an agent
+    /// that cannot run one, need every field to come from the same read.
+    pub async fn link_status(&self) -> BrowserLinkStatus {
+        let epoch = self.state_tx.borrow().epoch;
+        match self.client.read().await.as_ref() {
+            Some(client) => BrowserLinkStatus {
+                connected: client.is_connected(),
+                down_for: client.down_for(),
+                ever_connected: epoch > 0,
+            },
+            // No client at all: either the first connection has not succeeded yet,
+            // or the service was stopped. The reattach loop is still retrying.
+            None => BrowserLinkStatus {
+                connected: false,
+                down_for: None,
+                ever_connected: epoch > 0,
+            },
+        }
+    }
+
     pub async fn wait_for_initial_attempt(&self) {
         let mut receiver = self.initial_attempt_tx.subscribe();
         while !*receiver.borrow() {
@@ -90,6 +133,7 @@ impl BrowserService {
         let opts = self.connect_options();
         let client = CdpClient::connect(opts).await?;
         *self.session.write().await = Some(self.browser_session(client.clone()).await);
+        *self.client.write().await = Some(client.clone());
         self.state_tx.send_replace(BrowserConnectionState {
             connected: true,
             epoch: client.epoch(),
@@ -103,6 +147,13 @@ impl BrowserService {
         *self.session.write().await = Some(session);
     }
 
+    /// Publishes a connection snapshot the way the one second poll does, so the
+    /// gap between the snapshot and the live link can be exercised.
+    #[doc(hidden)]
+    pub fn publish_state_for_testing(&self, state: BrowserConnectionState) {
+        self.state_tx.send_replace(state);
+    }
+
     pub fn stop(&self) {
         self.cancel.cancel();
     }
@@ -159,6 +210,7 @@ impl BrowserService {
                 Ok(client) => {
                     let session = self.browser_session(client.clone()).await;
                     *self.session.write().await = Some(session);
+                    *self.client.write().await = Some(client.clone());
                     let epoch = client.epoch();
                     self.state_tx.send_replace(BrowserConnectionState {
                         connected: true,
@@ -169,9 +221,10 @@ impl BrowserService {
                         self.initial_attempt_tx.send_replace(true);
                         initial_attempt_pending = false;
                     }
-                    debug!(epoch, "connected to BrowserOS CDP");
+                    info!(epoch, "connected to BrowserOS CDP");
                     self.monitor_client(client).await;
                     *self.session.write().await = None;
+                    *self.client.write().await = None;
                     ba
```

**File**: `packages/browseros-agent/apps/claw-server-rust/src/services/browser/tab_registry.rs` (modified, +110/-0)
```diff
@@ -141,6 +141,16 @@ impl TabRegistry {
         seed_result
     }
 
+    /// Seeds the map without subscribing to events.
+    ///
+    /// [`Self::observe_session`] both subscribes and seeds, and its listener lives
+    /// until the epoch changes, so calling it to retry a failed seed on the same
+    /// epoch leaves one listener per attempt subscribed to the same events. A retry
+    /// wants only the seeding half.
+    pub async fn reseed(&self, session: &BrowserSession, epoch: u64) -> anyhow::Result<()> {
+        self.rebuild_from_session(session, epoch, false).await
+    }
+
     #[must_use]
     pub fn is_ready(&self, epoch: u64) -> bool {
         self.ready_epoch.load(Ordering::SeqCst) == epoch
@@ -539,6 +549,77 @@ mod tests {
         assert_eq!(calls.load(Ordering::SeqCst), 1);
     }
 
+    /// Seeding alone cannot adopt a new epoch, which is why the link monitor must
+    /// attach on a transition rather than only retrying the seed.
+    ///
+    /// The rebuild refuses an epoch that differs from the one it holds, so a
+    /// seed-only call after a reconnect is a silent no-op: readiness never arrives,
+    /// the retry spins, and the listener stays bound to the previous epoch. This is
+    /// the half that a seed-only retry path got wrong.
+    #[tokio::test]
+    async fn seeding_alone_cannot_adopt_a_new_epoch() -> anyhow::Result<()> {
+        let connection = TabListConnection::new();
+        let session = BrowserSession::new(connection.clone(), BrowserSessionHooks::default());
+        let map = map_with_releases(Arc::default());
+
+        map.observe_session(session.clone(), 1).await?;
+        assert!(map.is_ready(1));
+
+        // What a reconnect looks like if only the seeding half is called.
+        map.reseed(&session, 2).await?;
+
+        assert!(
+            !map.is_ready(2),
+            "seeding alone must not be mistaken for adopting the new epoch"
+        );
+        // And the attach does adopt it, which is the fix.
+        map.observe_session(session.clone(), 2).await?;
+        assert!(map.is_ready(2));
+        Ok(())
+    }
+
+    /// A socket reconnect inside one client bumps the epoch, and the listener is
+    /// bound to an epoch, so it exits. Something has to subscribe again or tab
+    /// events stop being processed: popups lose opener inheritance and closed tabs
+    /// are never cleaned up. The attach is what subscribes, and it happens per
+    /// client, not per socket, so the link monitor has to call it on every epoch.
+    #[tokio::test]
+    async fn an_epoch_change_gets_a_listener_that_still_processes_events() -> anyhow::Result<()> {
+        let connection = TabListConnection::new();
+        let session = BrowserSession::new(connection.clone(), BrowserSessionHooks::default());
+        let map = map_with_releases(Arc::default());
+
+        map.observe_session(session.clone(), 1).await?;
+        // The reconnect: same client and session, a new epoch.
+        map.observe_session(session.clone(), 2).await?;
+
+        let sent = connection.events.send(CdpEvent {
+            method: "Target.targetInfoChanged".to_string(),
+            params: json!({"targetInfo": {"targetId": "target-after-reconnect", "type": "page", "tabId": 77}}),
+            session_id: None,
+        });
+        assert!(
+            sent.is_ok(),
+            "a listener must be subscribed to receive this"
+        );
+
+        let mut mapped = None;
+        for _ in 0..50 {
+            tokio::time::sleep(std::time::Duration::from_millis(10)).await;
+            mapped = map.target_for_tab_cached(77).await;
+            if mapped.is_some() {
+                break;
+            }
+        }
+
+        assert_eq!(
+            mapped.as_deref(),
+            Some("target-after-reconnect"),
+            "the new epoch must have a listener processing events"
+        );
+        Ok(())
+    }
+
     #[tokio::test]
     async fn target_events_upsert_only_page_targets_with_tab_ids() {
         let map = map_with_releases(Arc::default());
@@ -675,6 +756,35 @@ mod tests {
         assert_eq!(calls.load(Ordering::SeqCst), 1);
     }
 
+    /// The link monitor retries seeding every second while the map is incomplete,
+    /// so the retry has to be free once the map is ready, and must not go through
+    /// `observe_session`: that subscribes an event listener which lives until the
+    /// epoch changes, so one attempt per second would leave one listener per second.
+    #[tokio::test]
+    async fn reseed_repeats_for_free_and_leaves_the_epoch_alone() -> anyhow::Result<()> {
+        let connection = TabListConnection::new();
+        let session = BrowserSession::new(connection.clone(), BrowserSessionHooks::default());
+        let map = map_with_releases(Arc::default());
+
+        // The attach happens once, on the link transition, and owns the listener.
+        map.observe_session(session.clone(), 1).await?;
+        assert!(map.is_ready(1));
+        assert_eq!(co
```

**File**: `packages/browseros-agent/apps/claw-server-rust/tests/canonical_routes.rs` (modified, +7/-1)
```diff
@@ -614,7 +614,13 @@ async fn canonical_control_settings_and_empty_lists() -> anyhow::Result<()> {
     let (status, _, bytes) =
         request(&app.router, "GET", "/system/health", None, Body::empty()).await?;
     assert_eq!(status, StatusCode::OK);
-    assert_eq!(json_body(&bytes)?, json!({ "status": "ok" }));
+    assert_eq!(
+        json_body(&bytes)?,
+        json!({
+            "status": "ok",
+            "browser": { "connected": false, "downForMs": null, "lastError": null }
+        })
+    );
 
     for (path, key) in [
         ("/api/v1/system", "product"),
```

---

### Incident Patch 15: `3738f8b7` (2026-10-01)
**Commit Message**: fix(mcp): let an agent reclaim its tab group after a reconnect (#2795)

* feat(mcp): report the tab group id and treat its unclaimed tabs as the caller's

An agent that reconnects stops using the tab it was working in, reports it as
inaccessible, and opens another tab in another group for the same task. Field
data says this is near total rather than occasional: one client produced 71
distinct agent identities across 74 connections.

Two things cause the visible half of it. A page claim disappears with the
session that made it, so after a reconnect the agent's own tab reads as
unclaimed and lands in the user's bucket, and the instructions correctly tell
an agent to leave tabs that are not its own alone. And the tab group id was
never shown to the agent, so even though a group is a durable browser object
the agent could name, it had no way to learn the name.

An unclaimed page sitting in the group the caller holds is now that caller's
page, and `tabs action="list"` reports the group id beside each of the
caller's own tabs. The id goes in the rendered text, not only the structured
content, because the text is what the model reads.

The reassignment is deliberately narrow. Only an uncl

**File**: `packages/browseros-agent/apps/claw-server-rust/src/api/mcp/effects/page_ownership_notice.rs` (modified, +126/-5)
```diff
@@ -75,11 +75,44 @@ pub fn apply(context: ToolEffectContext<'_>) -> BoxFuture<'_, anyhow::Result<Opt
                         || owner.as_str().to_string(),
                         |session| session.agent().label().to_string(),
                     );
-                format!(
-                    "Note: page {} belongs to another agent ({label}). You are allowed to use it; \
-                     leave it as you found it unless the user asked you to change it.",
-                    page_id.0
-                )
+                // A reconnect gives one client a new conversation, so an agent
+                // reading its own earlier tab lands here with its own name in
+                // `label`. Saying only "another agent" told it to abandon its
+                // own work, so the note names the group to pass back when the
+                // owner is in fact itself.
+                //
+                // A live session answers this exactly. A retired one is gone
+                // from the snapshot while its claims survive until reaping, so
+                // that case falls back to reading the slug off the conversation
+                // id, which is the only attribution left.
+                let same_client = context
+                    .call
+                    .state
+                    .sessions
+                    .snapshot()
+                    .await
+                    .into_iter()
+                    .find(|session| session.convo_id() == &owner)
+                    .map_or_else(
+                        || crate::identity::convo_id_belongs_to_slug(&owner, identity.agent.slug()),
+                        |session| session.agent().slug() == identity.agent.slug(),
+                    );
+                if same_client {
+                    format!(
+                        "Note: page {} was opened by {label} in an earlier session. If that was \
+                         you and you are continuing that work, pass its tab group id as groupId \
+                         on tabs action=\"new\" to take it back; tabs action=\"list\" reports \
+                         the id. Otherwise you are still allowed to use it: leave it as you found \
+                         it unless the user asked you to change it.",
+                        page_id.0
+                    )
+                } else {
+                    format!(
+                        "Note: page {} belongs to another agent ({label}). You are allowed to use it; \
+                         leave it as you found it unless the user asked you to change it.",
+                        page_id.0
+                    )
+                }
             }
             // No claim at all means the user opened it themselves.
             None => format!(
@@ -156,6 +189,94 @@ mod tests {
         .unwrap_or(None)
     }
 
+    /// A reconnect gives one client a new conversation, so an agent reading its
+    /// own earlier tab sees its own name as the owner. Telling it only that the
+    /// page is another agent's made a careful agent abandon its own work, so the
+    /// note has to say it can take it back.
+    #[tokio::test]
+    async fn an_own_earlier_session_is_named_as_reclaimable() -> anyhow::Result<()> {
+        let call = crate::api::mcp::test_support::tool_call(
+            "evaluate",
+            serde_json::json!({ "page": 7, "code": "return 1" }),
+        )
+        .await?;
+        let identity = call.identity.as_ref().unwrap_or_else(|| unreachable!());
+        // Same client, earlier conversation: what a reconnect leaves behind.
+        let earlier = crate::services::sessions::Session::new(
+            crate::ids::SessionId::new("earlier"),
+            identity.agent.clone(),
+            crate::identity::ConversationIdentity::new(identity.agent.slug(), "prior".to_string()),
+            identity.agent_label.clone(),
+            tokio::time::Instant::now(),
+        );
+        call.state
+            .sessions
+            .insert_for_testing(earlier.clone())
+            .await;
+        call.state
+            .sessions
+            .ownership()
+            .claim_page(earlier.convo_id().clone(), PageId(7))
+            .await;
+        let result = ToolResult::text("script returned 1", None);
+        let annotated = apply(ToolEffectContext {
+            call: &call,
+            result: &result,
+            cancelled: false,
+            duration_ms: 1,
+        })
+        .await
+        .unwrap_or_else(|error| panic!("effect failed: {error}"))
+        .unwrap_or_else(|| panic!("expected a notice"));
+        let text = text_of(&annotated);
+        assert!(text.contains("earlier session"), "{text}");
+        assert!(text.contains("groupId"), "names the way back: {text}");
+        assert!(
+            !text.contains("belongs to another agent"),
+            "must not tell an agent its own work is someone else's: {text}"
+        );
+        Ok(())
+    }
+
+    /// The retired case, which is the
```

**File**: `packages/browseros-agent/apps/claw-server-rust/src/api/mcp/effects/tab_groups.rs` (modified, +715/-3)
```diff
@@ -1,7 +1,7 @@
 use crate::{
     api::mcp::{
         dispatch::{ToolCall, ToolEffect, ToolEffectContext, result_page_id},
-        naming::desired_group_title,
+        naming::{client_prefix_from_slug, desired_group_title},
         timeouts::TAB_GROUP_OPERATION,
     },
     ids::ConvoId,
@@ -37,13 +37,116 @@ pub fn apply(context: ToolEffectContext<'_>) -> BoxFuture<'_, anyhow::Result<Opt
         } else {
             None
         };
+        // Computed before the group work is spawned, because that work creates this
+        // session's own group and the listing would then report it as a candidate
+        // the agent should consider reusing.
+        let notice = own_group_candidates_notice(&context).await;
         // Detach browser-group synchronization so cosmetic/durable grouping cannot
         // delay the tool response.
         drop(spawn_tab_group_work(context.call.clone(), page_id));
-        Ok(None)
+        Ok(notice.map(|notice| append_notice(context.result, notice)))
     })
 }
 
+/// Names the open groups already titled for this client, on the one call that is
+/// about to start another one.
+///
+/// The instructions and the tool descriptions both tell an agent to reuse its
+/// group, and a live client skipped them anyway and opened a duplicate for a task
+/// it already had a group for. Those texts are read before the work starts and
+/// ask the agent to carry an id across the interruption that just made it forget;
+/// this arrives in the result of the call that makes the mistake, with the ids in
+/// hand, so recovering needs no memory of the earlier session at all.
+///
+/// Only a note. Nothing is refused and nothing is reassigned: the agent asked for
+/// a new page and gets one, in a new group, exactly as before.
+async fn own_group_candidates_notice(context: &ToolEffectContext<'_>) -> Option<String> {
+    if !context.call.flags.new_page {
+        return None;
+    }
+    // A session that already has a group is mid-task, not reconnecting, and one
+    // that named a group is already doing the thing this note would ask for.
+    if context.call.default_tab_group_id.is_some() {
+        return None;
+    }
+    if context
+        .call
+        .raw_args
+        .get("groupId")
+        .and_then(Value::as_str)
+        .is_some_and(|group| !group.trim().is_empty())
+    {
+        return None;
+    }
+    let identity = context.call.identity.as_ref()?;
+    let browser = context.call.browser_session.as_ref()?;
+    // The title is `{prefix}/{label}`, so the separator terminates the prefix and
+    // this match cannot run into a longer client name the way a bare prefix would.
+    let prefix = format!("{}/", client_prefix_from_slug(identity.agent.slug()));
+    let candidates = open_groups(browser, context.call.output_files.clone())
+        .await?
+        .into_iter()
+        .filter(|(_, title)| title.starts_with(&prefix))
+        .map(|(group_id, title)| format!("{title} (id {group_id})"))
+        .collect::<Vec<_>>();
+    if candidates.is_empty() {
+        return None;
+    }
+    Some(format!(
+        "note: a new tab group is being started for this session. These open groups are already \
+         named for you, so they are tasks of yours from an earlier connection: {}. If you are \
+         continuing one of them, pass its id as groupId on tabs action=\"new\" and your pages go \
+         there instead, with the tabs already in it reading as yours again.",
+        candidates.join("; ")
+    ))
+}
+
+/// Every open group as `(id, title)`, or `None` when the listing cannot be read.
+///
+/// Silent on failure on purpose: a note that names no groups, or invents the
+/// absence of them, is worse than no note.
+async fn open_groups(
+    browser: &Arc<BrowserSession>,
+    output_files: OutputFileAccess,
+) -> Option<Vec<(String, String)>> {
+    let result = dispatch_tab_groups(
+        cached_tab_groups_tool(),
+        browser,
+        CancellationToken::new(),
+        output_files,
+        json!({ "action": "list" }),
+    )
+    .await
+    .ok()?;
+    Some(
+        result
+            .structured_content
+            .as_ref()?
+            .get("groups")?
+            .as_array()?
+            .iter()
+            .filter_map(|group| {
+                Some((
+                    group.get("groupId").and_then(Value::as_str)?.to_string(),
+                    group
+                        .get("title")
+                        .and_then(Value::as_str)
+                        .unwrap_or_default()
+                        .to_string(),
+                ))
+            })
+            .collect(),
+    )
+}
+
+/// Adds the note as an extra text block, leaving the original content untouched so
+/// a caller parsing the first block is unaffected.
+fn append_notice(result: &ToolResult, notice: String) -> ToolResult {
+    let mut annotated = result.clone();
+    annotated.content.push(ContentBlock::text(notice));
+    annotated
+}
+
 fn spawn_
```

**File**: `packages/browseros-agent/apps/claw-server-rust/src/api/mcp/effects/tabs_list_view.rs` (modified, +60/-1)
```diff
@@ -161,7 +161,19 @@ fn format_tab_line(page: &Value) -> Option<String> {
     } else {
         String::new()
     };
-    Some(format!("[{page_id}] {url}{title}{owner}"))
+    // Shown for every tab, not only the caller's own, and in the text rather
+    // than only the structured content because the text is what the model
+    // reads. Restricting it to the caller's own tabs made it unavailable in the
+    // one situation it exists for: after a reconnect the agent's tabs are
+    // listed as another agent's, which is exactly when it needs the id to ask
+    // to rejoin. Withholding it was never a boundary either, since
+    // `tab_groups action="list"` already enumerates every group id.
+    let group = page
+        .get("groupId")
+        .and_then(Value::as_str)
+        .map(|group| format!(" [group {group}]"))
+        .unwrap_or_default();
+    Some(format!("[{page_id}] {url}{title}{owner}{group}"))
 }
 
 const _: ToolEffect = apply;
@@ -171,6 +183,53 @@ mod tests {
     use super::*;
     use serde_json::json;
 
+    /// The group id has to reach the rendered text, because the text is what the
+    /// model reads. Without it an agent cannot name the group it is working in,
+    /// so it cannot ask to rejoin that group after a reconnect. The list result
+    /// carried only page, url and title until this was wired through.
+    #[tokio::test]
+    async fn the_group_id_reaches_the_rendered_text_for_the_callers_own_tabs() -> anyhow::Result<()>
+    {
+        let call =
+            crate::api::mcp::test_support::tool_call("tabs", json!({ "action": "list" })).await?;
+        let identity = call.identity.as_ref().unwrap_or_else(|| unreachable!());
+        call.state
+            .sessions
+            .ownership()
+            .claim_page(identity.ownership_key.clone(), PageId(9))
+            .await;
+        let result = ToolResult::text(
+            "all tabs",
+            Some(json!({
+                "pages": [
+                    { "page": 9, "url": "https://mine.test", "groupId": "G1" },
+                    { "page": 4, "url": "https://user.test", "groupId": "G9" }
+                ]
+            })),
+        );
+        let annotated = apply(ToolEffectContext {
+            call: &call,
+            result: &result,
+            cancelled: false,
+            duration_ms: 1,
+        })
+        .await
+        .unwrap_or_else(|error| panic!("effect failed: {error}"))
+        .unwrap_or(result);
+        let rendered = annotated
+            .content
+            .first()
+            .and_then(|block| block.as_text())
+            .map(|text| text.text.clone())
+            .unwrap_or_default();
+        assert!(rendered.contains("[group G1]"), "{rendered}");
+        // Every section, not only the caller's own tabs. After a reconnect an
+        // agent's tabs read as another agent's, and that is precisely when it
+        // needs the id in order to ask to rejoin the group.
+        assert!(rendered.contains("[group G9]"), "{rendered}");
+        Ok(())
+    }
+
     #[tokio::test]
     async fn annotates_all_tabs_in_three_ownership_buckets_and_prunes_stale_claims()
     -> anyhow::Result<()> {
```

**File**: `packages/browseros-agent/apps/claw-server-rust/src/api/mcp/mod.rs` (modified, +3/-0)
```diff
@@ -21,6 +21,9 @@ use rmcp::transport::streamable_http_server::{
 use std::sync::Arc;
 
 pub use service::ClawMcpService;
+// Re-exported so the route tests assert against the real text instead of keeping a
+// copy of it, which is what let the two drift apart.
+pub use service::SESSION_ARG_DESCRIPTION;
 
 /// Builds the shared MCP service used by both streamable HTTP and stdio.
 #[must_use]
```

**File**: `packages/browseros-agent/apps/claw-server-rust/src/api/mcp/prompt.rs` (modified, +29/-0)
```diff
@@ -21,6 +21,17 @@ Shared with other agents:
   user's, and a result tells you when the page is not yours.
 - A tab that is not yours is still someone's. Leave it as you found it unless the
   user asked you to change it, and prefer your own tab for anything exploratory.
+- Continuing a task after a remade connection: list before you open. Every
+  remade connection starts a new session and loses your tab ownership, so on
+  the FIRST tabs call of a connection, run tabs action="list" before opening
+  anything. It reports the tab group id of every grouped page, in every
+  section, including the tabs that now read as another agent's: after a
+  reconnect, yours are among those. Your own group is titled with your own
+  name, as <yourName>/<task>. Pass its id as groupId on tabs action="new" and
+  your pages keep going to that group while the tabs already in it read as
+  yours again, instead of being left behind while a second group starts. Record
+  the id when you first see it so you can skip the lookup later. Only you know
+  which task you are continuing, so only you can say.
 - Preserve useful pages: leave anything the user may want to inspect open
   instead of closing it when the task ends.
 - Say who you are (e.g. "claude-code", "codex"): send it as the agentName
@@ -105,6 +116,24 @@ mod tests {
         assert!(!BROWSERCLAW_MCP_INSTRUCTIONS.contains("separate window"));
     }
 
+    /// The reclaim flow is the only continuity a client on the transport-session
+    /// path has, and a passive mention of it was not enough: a live client skipped
+    /// it entirely and opened a second group. These lock the three properties that
+    /// made the old wording unusable.
+    #[test]
+    fn prompt_orders_the_reclaim_flow_and_points_it_at_the_right_place() {
+        // Ordered, not just mentioned: the lookup has to happen before the open.
+        assert!(BROWSERCLAW_MCP_INSTRUCTIONS.contains("list before you open"));
+        assert!(BROWSERCLAW_MCP_INSTRUCTIONS.contains("FIRST tabs call of a connection"));
+        // After a reconnect an agent's own tabs read as another agent's, so sending
+        // it to its own section sends it to the one place the id will not be.
+        assert!(BROWSERCLAW_MCP_INSTRUCTIONS.contains("in every\n  section"));
+        assert!(!BROWSERCLAW_MCP_INSTRUCTIONS.contains("next to each of your\n  own tabs"));
+        // The title convention is the only way back for an agent whose own history
+        // of the id is gone.
+        assert!(BROWSERCLAW_MCP_INSTRUCTIONS.contains("<yourName>/<task>"));
+    }
+
     #[test]
     fn prompt_nudges_saving_repeatable_tasks_as_skills() {
         assert!(BROWSERCLAW_MCP_INSTRUCTIONS.contains("save_skill"));
```

**File**: `packages/browseros-agent/apps/claw-server-rust/src/api/mcp/service.rs` (modified, +22/-1)
```diff
@@ -57,7 +57,13 @@ const NAME_SESSION_INPUT_MAX_LEN: usize = 64;
 /// as the `session` argument on subsequent calls.
 const SESSION_META_KEY: &str = "com.browseros.neo/session";
 const AGENT_NAME_ARG: &str = "agentName";
-const SESSION_ARG_DESCRIPTION: &str = "Opaque session handle for this browser session. The server returns it in every tool result's `_meta` under the key `com.browseros.neo/session`; read it from there and pass it back as this `session` argument on every later call to keep the same browser session and its tab ownership. Omit it on your first call, and again if the server tells you this session was stopped or is no longer active; resending a dead handle will not revive it.";
+// Scoped to the path that actually emits it. The handle rides only on connections
+// without a transport session id; the other path withholds it and ignores one that
+// is presented, so promising it to every client pointed those agents at a control
+// they do not have and away from the tab group id, which is the signal that works
+// for them. Naming the alternative here matters because this text is read at the
+// moment an agent is deciding how to keep continuity.
+pub const SESSION_ARG_DESCRIPTION: &str = "Opaque session handle for this browser session. You receive one only if your client connects without its own transport session id: then the server returns it in every tool result's `_meta` under the key `com.browseros.neo/session` and as a line in the result text, and you pass it back as this `session` argument on every later call to stay in the same browser session. If you never see one, this argument does nothing for you, and your continuity across a remade connection is your tab group id instead: read it from tabs action=\"list\" and pass it as groupId on tabs action=\"new\". Omit this argument on your first call, and again if the server tells you this session was stopped or is no longer active; resending a dead handle will not revive it.";
 const AGENT_NAME_ARG_DESCRIPTION: &str = "Your own agent name, e.g. \"claude-code\", \"codex\", \"cursor\". Send it on every call. It names this browser session, titles and colours the tab group your tabs live in, and is how the operator filters your runs in the audit log. 2026-07-28 removed the initialize handshake, so this argument is the only way the server can learn who you are.";
 const SAVE_SKILL_TOOL_NAME: &str = "save_skill";
 const SAVE_SKILL_DESCRIPTION: &str = "When you finish a repeatable browser task the user is likely to run again, save it as a BrowserOS neo skill so it can be re-run by name later; save genuinely repeatable, user-valuable tasks, not one-offs. Give a lowercase-hyphen name, a one-line description, the ordered steps, and any shortcuts learned this run. In the steps, name the exact browser SDK calls you actually used this session (e.g. browser.wait, browser.read, browser.pages.newPage) so a later run reuses them verbatim; never invent, rename, or guess a method that is not in the run tool's SDK (there is no browser.waitFor, for example). The skill is saved and linked into your agents under a neo- prefix (neo-<name>) so it never clobbers your own skills and you can list them all by typing /neo; a name given without the prefix is namespaced automatically. Call again with the same name to update it in place.";
@@ -1336,6 +1342,21 @@ mod tests {
                 .as_array()
                 .is_some_and(|required| required.contains(&json!("session")))
         );
+        // The promise has to stay conditional and has to keep naming the fallback:
+        // an unconditional version of this text is what sent a legacy client after
+        // a handle it never receives.
+        assert!(
+            SESSION_ARG_DESCRIPTION.contains("only if your client connects without"),
+            "the handle must not be promised unconditionally"
+        );
+        assert!(
+            SESSION_ARG_DESCRIPTION.contains("your tab group id instead"),
+            "a client that gets no handle must be told what to use"
+        );
+        assert!(
+            !SESSION_ARG_DESCRIPTION.contains("and its tab ownership"),
+            "tab ownership continuity comes from the group id, not this handle"
+        );
 
         for tool in service.listed_tools(false) {
             let schema = Value::Object(tool.input_schema.as_ref().clone());
```

**File**: `packages/browseros-agent/apps/claw-server-rust/src/identity/conversation.rs` (modified, +46/-1)
```diff
@@ -55,6 +55,23 @@ fn pick<'a>(words: &'a [&str], draw: f64) -> &'a str {
     words.get(index).copied().unwrap_or(words[0])
 }
 
+/// Best-effort check that a conversation id was minted for this client slug.
+///
+/// The id is `{client_slug}-{generated_label}` and both halves may contain
+/// hyphens, so the split is not recoverable in general: a slug that is a
+/// hyphen-prefix of another client's slug matches that client's conversations
+/// too. Reading the slug back off the id is still the only attribution left once
+/// a session has gone from the live snapshot, which is what a reconnect leaves
+/// behind, so callers use it to choose wording that holds either way. Never use
+/// it to decide access.
+#[must_use]
+pub fn convo_id_belongs_to_slug(convo_id: &ConvoId, client_slug: &str) -> bool {
+    convo_id
+        .as_str()
+        .strip_prefix(client_slug)
+        .is_some_and(|rest| rest.starts_with('-'))
+}
+
 /// Per-conversation ownership and naming identity.
 /// The conversation id stays fixed when `rename` changes only the
 /// operator-facing label.
@@ -118,7 +135,9 @@ impl ConversationIdentity {
 
 #[cfg(test)]
 mod tests {
-    use super::{ConversationIdentity, GenerateFunNameError, generate_fun_name};
+    use super::{
+        ConversationIdentity, GenerateFunNameError, convo_id_belongs_to_slug, generate_fun_name,
+    };
     use std::{
         collections::VecDeque,
         sync::{Arc, Mutex},
@@ -204,4 +223,30 @@ mod tests {
         assert_eq!(identity.label().await, "invoice-processing");
         assert_eq!(identity.take_rename_nudge().await, None);
     }
+
+    /// The match has to end on the separator, so a slug that is a plain
+    /// character prefix of another is rejected.
+    #[test]
+    fn a_conversation_id_matches_its_own_slug_on_a_separator() {
+        let mine = ConversationIdentity::new("codex", "agile-alpaca".to_string());
+        assert!(convo_id_belongs_to_slug(mine.convo_id(), "codex"));
+        assert!(!convo_id_belongs_to_slug(mine.convo_id(), "code"));
+        assert!(!convo_id_belongs_to_slug(mine.convo_id(), "claude-code"));
+
+        let hyphenated = ConversationIdentity::new("claude-code", "brave-badger".to_string());
+        assert!(convo_id_belongs_to_slug(
+            hyphenated.convo_id(),
+            "claude-code"
+        ));
+    }
+
+    /// The documented limit, pinned so nobody reads more into the helper than
+    /// it gives. A hyphen-prefix of another client's slug lands on a separator
+    /// too, and the id carries nothing that separates the two, which is why the
+    /// notice wording has to hold whether or not the guess is right.
+    #[test]
+    fn a_hyphen_prefix_of_another_slug_is_indistinguishable() {
+        let other = ConversationIdentity::new("claude-code", "brave-badger".to_string());
+        assert!(convo_id_belongs_to_slug(other.convo_id(), "claude"));
+    }
 }
```

**File**: `packages/browseros-agent/apps/claw-server-rust/src/identity/mod.rs` (modified, +3/-1)
```diff
@@ -2,4 +2,6 @@ mod client;
 mod conversation;
 
 pub use client::{ClientIdentity, ClientInfo, ProfileView, slugify_client_name};
-pub use conversation::{ConversationIdentity, GenerateFunNameError, generate_fun_name};
+pub use conversation::{
+    ConversationIdentity, GenerateFunNameError, convo_id_belongs_to_slug, generate_fun_name,
+};
```

#### Recent Merged Pull Requests:
- **PR #2863** (2026-10-05): fix(browser): resolve actual tab owner after popup navigation (@shadowfax92)
- **PR #2862** (2026-10-05): chore(release): publish BrowserOS 0.51.0 browser feeds (@shadowfax92)
- **PR #2861** (2026-10-05): docs: add Neo Linux downloads to README (@shadowfax92)
- **PR #2860** (2026-10-05): chore(release): publish Neo 0.51.0 browser appcasts (@shadowfax92)
- **PR #2859** (2026-10-05): chore: bump agent extension version to 0.0.161.0 (@github-actions[bot])
- **PR #2858** (2026-10-05): chore(release): update extension alpha feeds to 0.0.161.0 (@github-actions[bot])
- **PR #2857** (2026-10-05): chore: bump server version to 0.0.168 (@github-actions[bot])
- **PR #2856** (2026-10-05): chore(release): snapshot browseros server alpha v0.0.168 (@github-actions[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
