# Forensic Learning Record (Deep Inspection): 0xJacky/nginx-ui

> **Canonical Artifact**: `07_PROJECT_LEARNING/0xjacky-nginx-ui-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/0xJacky/nginx-ui](https://github.com/0xJacky/nginx-ui))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:20:06.630Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `0xJacky/nginx-ui`
- **Description**: Yet another WebUI for Nginx
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: package.json, go.mod, README.md, Dockerfile
- **Stars / Engagement**: 11569 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `api/upstream/util.go`
```
package upstream

// formatSocketAddress formats a host:port combination into a proper socket address
// For IPv6 addresses, it adds brackets around the host if they're not already present
func formatSocketAddress(host, port string) string {
	// Reuse the logic from service package
	if len(host) > 0 && host[0] != '[' && containsColon(host) {
		return "[" + host + "]:" + port
	}
	return host + ":" + port
}

// containsColon checks if string contains a colon
func containsColon(s string) bool {
	for i := 0; i < len(s); i++ {
		if s[i] == ':' {
			return true
		}
	}
	return false
}

```

### Core Architecture Module: `app/src/components/CodeEditor/completionLifecycle.ts`
```
/**
 * Lifecycle bookkeeping for an editor integration that is set up asynchronously.
 *
 * Code completion only learns whether it is enabled after an HTTP round trip,
 * attaches its editor listeners on a timer, and opens its socket on demand. Any
 * of those steps can finish after the editor was unmounted or re-initialised,
 * so each init() runs in a session: every resource it acquires registers a
 * teardown with that session, and every late step checks that the session is
 * still active before acquiring anything. Disposing the session (cleanUp or the
 * next init) then releases exactly what was acquired, whenever it was acquired.
 */

export interface LifecycleSession {
  /** False once the session was disposed or superseded by a newer one. */
  readonly active: boolean
  /**
   * Registers a teardown. Teardowns run in reverse registration order; one that
   * is registered after the session is gone runs immediately.
   */
  onDispose: (teardown: () => void) => void
  /** Schedules a callback that is cancelled when the session is disposed. */
  setTimeout: (callback: () => void, delayMs: number) => void
}

export interface Lifecycle {
  /** Disposes the current session, if any, and starts a new one. */
  begin: () => LifecycleSession
  /** Disposes the current session. Safe to call repeatedly. */
  dispose: () => void
}

export interface LifecycleOptions {
  /**
   * Receives errors thrown by teardowns. A failing teardown never stops the
   * remaining ones, otherwise one broken editor call would leak the socket.
   */
  onError?: (error: unknown) => void
}

function createSession(onError: (error: unknown) => void) {
  const teardowns: (() => void)[] = []
  let active = true

  function runTeardown(teardown: () => void) {
    try {
      teardown()
    }
    catch (error) {
      onError(error)
    }
  }

  const session: LifecycleSession = {
    get active() {
      return active
    },
    onDispose(teardown) {
      if (!active) {
        runTeardown(teardown)
        return
      }
      teardowns.push(teardown)
    },
    setTimeout(callback, delayMs) {
      if (!active) {
        return
      }

      const timer = setTimeout(() => {
        if (active) {
          callback()
        }
      }, delayMs)
      session.onDispose(() => clearTimeout(timer))
    },
  }

  function dispose() {
    if (!active) {
      return
    }
    active = false

    // Release in reverse order so later resources, which may depend on earlier
    // ones, go first.
    while (teardowns.length > 0) {
      runTeardown(teardowns.pop()!)
    }
  }

  return { session, dispose }
}

export function createLifecycle(options: LifecycleOptions = {}): Lifecycle {
  const { onError = error => console.error(error) } = options
  let current: ReturnType<typeof createSession> | undefined

  function dispose() {
    const previous = current
    current = undefined
    previous?.dispose()
  }

  function begin() {
    dispose()
    current = createSession(onError)
    return current.session
  }

  return { begin, dispose }
}

export interface LazyResourceOptions<T> {
  /** Creates the resource. Only called while the session is active. */
  create: () => T
  /** Whether an existing resource can still be used; a dead one is replaced. */
  isAlive: (resource: T) => boolean
  /** Releases the resource. */
  destroy: (resource: T) => void
}

export interface LazyResource<T> {
  /**
   * Returns a usable resource, creating it on first use or after the previous
   * one died. Returns undefined once the session is gone, so nothing is created
   * for an editor that has already been torn down.
   */
  acquire: () => T | undefined
  /** The resource created so far, without creating one. */
  readonly current: T | undefined
}

/**
 * Binds an on-demand resource to a session: nothing is created until the first
 * acquire(), and whatever was created is destroyed with the session.
 */
export function createLazyResource<T>(session: LifecycleSession, options: LazyResourceOptions<T>): LazyResource<T> {
  const { create, isAlive, destroy } = options
  let resource: T | undefined

  function release() {
    if (resource === undefined) {
      return
    }

    const stale = resource
    resource = undefined
    destroy(stale)
  }

  session.onDispose(release)

  return {
    acquire() {
      if (!session.active) {
        return undefined
      }

      if (resource !== undefined && isAlive(resource)) {
        return resource
      }

      release()
      const created = create()

      // create() tore the session down (e.g. a callback ran cleanUp): the
      // session teardown has already run, so release the new resource here.
      if (!session.active) {
        destroy(created)
        return undefined
      }

      resource = created
      return resource
    },
    get current() {
      return resource
    },
  }
}

```

### Core Architecture Module: `app/src/components/LLM/utils.ts`
```
import type { CodeBlockState } from './types'

/**
 * transformReasonerThink: if <think> appears but is not paired with </think>, it will be automatically supplemented, and the entire text will be converted to a Markdown quote
 */
export function transformReasonerThink(rawText: string): string {
  // 1. Count number of <think> vs </think>
  const openThinkRegex = /<think>/gi
  const closeThinkRegex = /<\/think>/gi

  const openCount = (rawText.match(openThinkRegex) || []).length
  const closeCount = (rawText.match(closeThinkRegex) || []).length

  // 2. If open tags exceed close tags, append missing </think> at the end
  if (openCount > closeCount) {
    const diff = openCount - closeCount
    rawText += '</think>'.repeat(diff)
  }

  // 3. Replace <think>...</think> blocks with Markdown blockquote ("> ...")
  return rawText.replace(/<think>([\s\S]*?)<\/think>/g, (match, p1) => {
    // Split the inner text by line, prefix each with "> "
    const lines = p1.trim().split('\n')
    const blockquoted = lines.map(line => `> ${line}`).join('\n')
    // Return the replaced Markdown quote
    return `\n${blockquoted}\n`
  })
}

/**
 * transformText: transform the text
 */
export function transformText(rawText: string): string {
  return transformReasonerThink(rawText)
}

/**
 * updateCodeBlockState: The number of unnecessary scans is reduced by changing the scanning method of incremental content
 */
export function updateCodeBlockState(chunk: string, codeBlockState: CodeBlockState) {
  // count all ``` in chunk
  // note to distinguish how many "backticks" are not paired

  const regex = /```/g

  while (regex.exec(chunk) !== null) {
    codeBlockState.backtickCount++
    // if backtickCount is even -> closed
    codeBlockState.isInCodeBlock = codeBlockState.backtickCount % 2 !== 0
  }
}

// Global scroll debouncing
let scrollTimeoutId: number | null = null

/**
 * scrollToBottom: Scroll container to bottom with optimized performance
 */
export function scrollToBottom() {
  // Simple debounce to avoid stuttering from over-optimization
  if (scrollTimeoutId) {
    return
  }

  scrollTimeoutId = window.setTimeout(() => {
    const container = document.querySelector('.right-settings .ant-card-body')
    if (container) {
      // Set scrollTop directly to avoid animation stuttering
      container.scrollTop = container.scrollHeight
    }
    scrollTimeoutId = null
  }, 50) // Reduced to 50ms for better responsiveness
}

/**
 * scrollToBottomSmooth: Smooth scroll version for manual interactions
 */
export function scrollToBottomSmooth() {
  const container = document.querySelector('.right-settings .ant-card-body')
  if (container) {
    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth',
    })
  }
}

```

### Core Architecture Module: `app/src/components/NamespaceRender/index.ts`
```
export { default } from './NamespaceRender.vue'

```

### Core Architecture Module: `app/src/components/Notification/detailRender.tsx`
```
import type { CustomRenderArgs } from '@uozi-admin/curd'
import type { PropType } from 'vue'
import type { CosyError } from '@/lib/http/types'
import { defineComponent, ref } from 'vue'
import { NotificationTypeT } from '@/constants'
import { translateError } from '@/lib/http/error'

function parseResponsePayload(response: string | object): string | object {
  if (typeof response !== 'string') {
    return response
  }

  try {
    return JSON.parse(response) as object
  }
  catch {
    return response
  }
}

// Helper function to parse and translate error
async function parseError(response: string): Promise<string | null> {
  try {
    const errorData = JSON.parse(response) as CosyError
    if (errorData.scope && errorData.code) {
      return await translateError(errorData)
    }
  }
  catch {
  }
  return null
}

// Create a component for error details to properly handle async translation
const ErrorDetails = defineComponent({
  props: {
    response: {
      type: [String, Object] as PropType<string | object>,
      required: true,
    },
  },
  setup(props) {
    const translatedError = ref<string>('')
    const isLoading = ref(true)

    const responseString = typeof props.response === 'string'
      ? props.response
      : JSON.stringify(props.response)

    parseError(responseString).then(result => {
      if (result) {
        translatedError.value = result
      }
      isLoading.value = false
    })

    return () => {
      const parsedResponse = parseResponsePayload(props.response)

      return (
        <div class="mt-2">
          {translatedError.value && (
            <div class="text-red-500 font-medium mb-2">
              {translatedError.value}
            </div>
          )}

          {isLoading.value && (
            <div class="text-gray-500 text-sm mb-2">
              {$gettext('Translating error...')}
            </div>
          )}

          <details class="mt-2">
            <summary class="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
              {$gettext('Error details')}
            </summary>
            <pre class="mt-2 p-2 bg-gray-100 rounded text-xs overflow-hidden whitespace-pre-wrap break-words max-w-full">
              {typeof parsedResponse === 'string'
                ? parsedResponse
                : JSON.stringify(parsedResponse, null, 2)}
            </pre>
          </details>
        </div>
      )
    }
  },
})

export function detailRender(args: Pick<CustomRenderArgs, 'record' | 'text'>) {
  try {
    return (
      <div>
        <div>
          {$gettext(args.record.content, args.record.details)}
        </div>
        {args.record.details?.response && args.record.type !== NotificationTypeT.Success && (
          <div>
            <ErrorDetails response={args.record.details.response} />
          </div>
        )}
      </div>
    )
  }
  catch {
    return args.text
  }
}

```

### Core Architecture Module: `app/src/lib/workspace/state.ts`
```
/**
 * Pure state transitions of the workspace: tabs, the two panes, focus, layout
 * and which pane iframes stay alive. Every function returns a new state and
 * never mutates its input, so the store only assigns the result.
 */

export type WorkspaceLayout = 'single' | 'split'
export type PaneIndex = 0 | 1

export interface WorkspaceNode {
  id: number
  name: string
}

export interface WorkspaceTab {
  id: number
  node: WorkspaceNode
  /** Last route the pane reported, as a hash-router full path. */
  route: string
  /** Page title the pane reported for `route`. */
  title: string
}

export interface WorkspaceState {
  tabs: WorkspaceTab[]
  /** Next tab id. Ids are never reused: they name the pane window and its storage. */
  nextId: number
  layout: WorkspaceLayout
  /**
   * Tab shown in the left and in the right pane. In single layout only the
   * left pane is visible; the right one keeps its tab for when split returns.
   * A tab is never in both panes.
   */
  panes: [number | null, number | null]
  focus: PaneIndex
  /** Tab ids, most recently shown first. */
  recent: number[]
}

/** Where a new tab opens. */
export const DEFAULT_TAB_ROUTE = '/dashboard'

/** Background tabs that keep their iframe alive besides the visible ones. */
export const MAX_BACKGROUND_TABS = 4

export function createWorkspaceState(): WorkspaceState {
  return {
    tabs: [],
    nextId: 1,
    layout: 'single',
    panes: [null, null],
    focus: 0,
    recent: [],
  }
}

function otherPane(index: PaneIndex): PaneIndex {
  return index === 0 ? 1 : 0
}

function touch(recent: number[], tabId: number): number[] {
  return [tabId, ...recent.filter(id => id !== tabId)]
}

export function findTab(state: WorkspaceState, tabId: number | null | undefined): WorkspaceTab | undefined {
  if (tabId == null)
    return undefined

  return state.tabs.find(tab => tab.id === tabId)
}

/** Panes the user can see in the current layout. */
export function visiblePaneIndexes(state: WorkspaceState): PaneIndex[] {
  return state.layout === 'split' ? [0, 1] : [0]
}

/** Tabs currently on screen. */
export function visibleTabIds(state: WorkspaceState): number[] {
  return visiblePaneIndexes(state)
    .map(index => state.panes[index])
    .filter((id): id is number => id != null)
}

/** The pane showing a tab, when it is on screen. */
export function paneOfTab(state: WorkspaceState, tabId: number): PaneIndex | null {
  const index = visiblePaneIndexes(state).find(pane => state.panes[pane] === tabId)
  return index ?? null
}

/**
 * Tabs that keep a live iframe: the visible ones plus the most recently used
 * background tabs. The rest are unloaded and rebuilt at their last route.
 */
export function liveTabIds(state: WorkspaceState, maxBackground = MAX_BACKGROUND_TABS): number[] {
  const visible = visibleTabIds(state)
  const known = new Set(state.tabs.map(tab => tab.id))
  const background = [
    ...state.recent,
    // Tabs missing from the MRU list (should not happen) come last.
    ...state.tabs.map(tab => tab.id).filter(id => !state.recent.includes(id)),
  ].filter(id => known.has(id) && !visible.includes(id))

  return [...visible, ...background.slice(0, Math.max(0, maxBackground))]
}

/** The most recently used tab that no pane is showing. */
function nextBackgroundTab(state: WorkspaceState): number | null {
  const shown = new Set(state.panes.filter((id): id is number => id != null))
  return liveTabIds({ ...state, panes: [null, null] }, Number.POSITIVE_INFINITY)
    .find(id => !shown.has(id)) ?? null
}

/**
 * Shows a tab in the focused pane. A tab already shown in the other pane swaps
 * places with the focused pane's tab, so it is never shown twice.
 */
export function showTab(state: WorkspaceState, tabId: number): WorkspaceState {
  if (!findTab(state, tabId))
    return state

  const focus: PaneIndex = state.layout === 'split' ? state.focus : 0
  const other = otherPane(focus)
  const panes: [number | null, number | null] = [...state.panes]

  if (panes[other] === tabId)
    panes[other] = panes[focus]

  panes[focus] = tabId

  return { ...state, panes, focus, recent: touch(state.recent, tabId) }
}

/** Adds a tab for a node and shows it in the focused pane. */
export function openTab(state: WorkspaceState, node: WorkspaceNode, route = DEFAULT_TAB_ROUTE): { state: WorkspaceState, tabId: number } {
  const tabId = state.nextId
  const tab: WorkspaceTab = { id: tabId, node: { id: node.id, name: node.name }, route, title: '' }
  const next = { ...state, tabs: [...state.tabs, tab], nextId: tabId + 1 }

  return { state: showTab(next, tabId), tabId }
}

/** The most recently used tab of a node, skipping `exclude`. */
export function findNodeTab(state: WorkspaceState, nodeId: number, exclude: number[] = []): number | null {
  const ordered = liveTabIds({ ...state, panes: [null, null] }, Number.POSITIVE_INFINITY)
  return ordered.find(id => !exclude.includes(id) && findTab(state, id)?.node.id === nodeId) ?? null
}

/** Brings a node on screen: its most recent tab if it has one, otherwise a new tab. */
export function openNode(state: WorkspaceState, node: WorkspaceNode): { state: WorkspaceState, tabId: number } {
  const focus: PaneIndex = state.layout === 'split' ? state.focus : 0
  const focusedTab = findTab(state, state.panes[focus])
  if (focusedTab?.node.id === node.id)
    return { state: showTab(state, focusedTab.id), tabId: focusedTab.id }

  const existing = findNodeTab(state, node.id)
  if (existing != null)
    return { state: showTab(state, existing), tabId: existing }

  return openTab(state, node)
}

/**
 * Splits the workspace with one node on each side, reusing the nodes' most
 * recent tabs. The same node on both sides gets two tabs. The right pane,
 * the one just asked for, takes focus.
 */
export function openSplit(state: WorkspaceState, left: WorkspaceNode, right: WorkspaceNode): WorkspaceState {
  let next = state

  let leftId = findNodeTab(next, left.id)
  if (leftId == null) {
    const opened = openTab(next, left)
    next = opened.state
    leftId = opened.tabId
  }

  let rightId = findNodeTab(next, right.id, [leftId])
  if (rightId == null) {
    const opened = openTab(next, right)
    next = opened.state
    rightId = opened.tabId
  }

  return {
    ...next,
    layout: 'split',
    panes: [leftId, rightId],
    focus: 1,
    recent: touch(touch(next.recent, leftId), rightId),
  }
}

/** Focuses a pane; in single layout only the left pane exists. */
export function focusPane(state: WorkspaceState, index: PaneIndex): WorkspaceState {
  if (state.layout !== 'split' && index !== 0)
    return state

  const tabId = state.panes[index]
  if (state.focus === index && (tabId == null || state.recent[0] === tabId))
    return state

  return { ...state, focus: index, recent: tabId != null ? touch(state.recent, tabId) : state.recent }
}

/**
 * Switches between single and split layout. Going single keeps the focused
 * tab on screen; going split fills an empty pane with the most recent
 * background tab.
 */
export function setLayout(state: WorkspaceState, layout: WorkspaceLayout): WorkspaceState {
  if (state.layout === layout)
    return state

  if (layout === 'single') {
    const panes: [number | null, number | null] = state.focus === 1
      ? [state.panes[1], state.panes[0]]
      : [...state.panes]

    return { ...state, layout, panes, focus: 0 }
  }

  let next: WorkspaceState = { ...state, layout, panes: [...state.panes] }
  for (const index of [0, 1] as PaneIndex[]) {
    if (next.panes[index] != null)
      continue

    const fill = nextBackgroundTab(next)
    if (fill != null) {
      const panes: [number | null, number | null] = [...next.panes]
      panes[index] = fill
      next = { ...next, panes }
    }
  }

  return next
}

/**
 * Closes a tab. A pane that showed it takes the most recent background tab,
 * or stays empty when there is none.
 */
export function closeTab(state: WorkspaceState, tabId: number): WorkspaceState {
  if (!findTab(state, tabId))
    return state

  let next: WorkspaceState = {
    ...state,
    tabs: state.tabs.filter(tab => tab.id !== tabId),
    recent: state.recent.filter(id => id !== tabId),
    panes: state.panes.map(id => id === tabId ? null : id) as [number | null, number | null],
  }

  for (const index of [0, 1] as PaneIndex[]) {
    if (state.panes[index] !== tabId)
      continue

    const fill = nextBackgroundTab(next)
    const panes: [number | null, number | null] = [...next.panes]
    panes[index] = fill
    next = { ...next, panes }
  }

  // An empty left pane in single layout would hide the remembered right tab.
  if (next.layout === 'single' && next.panes[0] == null && next.panes[1] != null)
    next = { ...next, panes: [next.panes[1], null] }

  return next
}

/** Updates what a pane reported about its tab. */
export function updateTab(state: WorkspaceState, tabId: number, patch: Partial<Omit<WorkspaceTab, 'id'>>): WorkspaceState {
  const tab = findTab(state, tabId)
  if (!tab)
    return state

  const changed = (Object.keys(patch) as (keyof typeof patch)[])
    .some(key => JSON.stringify(tab[key]) !== JSON.stringify(patch[key]))
  if (!changed)
    return state

  return {
    ...state,
    tabs: state.tabs.map(item => item.id === tabId ? { ...item, ...patch } : item),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function toTab(value: unknown): WorkspaceTab | null {
  if (!isRecord(value) || !isRecord(value.node))
    return null

  const id = Number(value.id)
  const nodeId = Number(value.node.id)
  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(nodeId) || nodeId < 0)
    return null

  const route = typeof value.route === 'string' && value.route.startsWith('/') ? value.route : DEFAULT_TAB_ROUTE

  return {
    id,
    node: { id: nodeId, name: typeof value.node.name === 'string' ? value.node.name : '' },
    route,
    title: typeof value.title ==
```

### Core Architecture Module: `app/src/utils/certificate.ts`
```
export function isIPv4Address(value: string): boolean {
  const parts = value.split('.')
  return parts.length === 4 && parts.every(part => {
    if (!/^\d{1,3}$/.test(part))
      return false

    const number = Number(part)
    return number >= 0 && number <= 255
  })
}

export function isIPv6Address(value: string): boolean {
  const candidate = value.startsWith('[') && value.endsWith(']')
    ? value.slice(1, -1)
    : value
  if (!candidate.includes(':'))
    return false

  try {
    const url = new URL(`http://[${candidate}]/`)
    return url.hostname.startsWith('[') && url.hostname.endsWith(']')
  }
  catch {
    return false
  }
}

export function isIPAddress(value: string): boolean {
  const candidate = value.trim()
  return isIPv4Address(candidate) || isIPv6Address(candidate)
}

export function splitCertificateIdentifiers(values: string[]): string[] {
  return [...new Set(values.flatMap(value => value.split(/\s+/))
    .map(value => value.trim())
    .filter(value => value && value !== '_'))]
}

```

### Core Architecture Module: `app/src/utils/changedPaths.ts`
```
type PlainObject = Record<string, unknown>

function isPlainObject(value: unknown): value is PlainObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// Missing, null and empty string all mean "nothing entered" for a text field.
function isBlank(value: unknown) {
  return value === undefined || value === null || value === ''
}

function isEqualLeaf(before: unknown, after: unknown) {
  if (before === after)
    return true
  if (isBlank(before) && isBlank(after))
    return true
  if (Array.isArray(before) || Array.isArray(after))
    return JSON.stringify(before ?? []) === JSON.stringify(after ?? [])
  return false
}

/**
 * Lists the dot paths whose value differs between two settings objects.
 * Objects are walked recursively, arrays are compared as a whole.
 */
export function collectChangedPaths(before: unknown, after: unknown, prefix = ''): string[] {
  if (isPlainObject(before) || isPlainObject(after)) {
    const beforeObject = isPlainObject(before) ? before : {}
    const afterObject = isPlainObject(after) ? after : {}
    const keys = new Set([...Object.keys(beforeObject), ...Object.keys(afterObject)])
    const paths: string[] = []
    for (const key of keys) {
      const path = prefix ? `${prefix}.${key}` : key
      paths.push(...collectChangedPaths(beforeObject[key], afterObject[key], path))
    }
    return paths.sort()
  }

  return isEqualLeaf(before, after) ? [] : [prefix]
}

/**
 * Copies the values at the given dot paths from source into target.
 * Used to mark a subset of settings as saved without touching the rest.
 */
export function copyPaths<T extends object>(target: T, source: T, paths: string[]) {
  for (const path of paths) {
    const segments = path.split('.')
    const key = segments.pop()!
    let targetNode = target as PlainObject
    let sourceNode: PlainObject | undefined = source as PlainObject
    for (const segment of segments) {
      if (!isPlainObject(targetNode[segment]))
        targetNode[segment] = {}
      targetNode = targetNode[segment] as PlainObject
      sourceNode = isPlainObject(sourceNode?.[segment]) ? sourceNode![segment] as PlainObject : undefined
    }
    const value = sourceNode?.[key]
    targetNode[key] = value === undefined ? undefined : JSON.parse(JSON.stringify(value))
  }
}

```

### Core Architecture Module: `app/src/utils/dnsRecordMatching.ts`
```
import type { DNSRecord } from '@/api/dns'

function normalizeDnsName(name: string): string {
  return name.trim().replace(/\.+$/, '').toLowerCase()
}

function getRecordDnsName(recordName: string, domain: string): string {
  const normalizedDomain = normalizeDnsName(domain)
  const normalizedRecord = normalizeDnsName(recordName)

  if (normalizedRecord === '@' || normalizedRecord === normalizedDomain)
    return normalizedDomain

  if (normalizedRecord.endsWith(`.${normalizedDomain}`))
    return normalizedRecord

  return `${normalizedRecord}.${normalizedDomain}`
}

/** Return all record IDs that exactly serve the first configured server name. */
export function findMatchingDNSRecordIds(
  serverName: string,
  domain: string,
  records: DNSRecord[],
): string[] {
  const targetName = normalizeDnsName(serverName.split(/\s+/)[0] ?? '')
  if (!targetName)
    return []

  return records
    .filter(record => getRecordDnsName(record.name, domain) === targetName)
    .map(record => record.id)
}

```

### Core Architecture Module: `app/src/utils/idnDomain.ts`
```
/**
 * Punycode decoding for display purposes.
 *
 * The backend persists internationalized domains in their canonical ASCII form
 * (`xn--fsq.example.com`), which is unambiguous but unreadable for the people who
 * typed `例.example.com`. These helpers decode that form back for display only —
 * every value sent to the API stays exactly as the backend stored it.
 *
 * Implements the decoding half of RFC 3492.
 */

const BASE = 36
const T_MIN = 1
const T_MAX = 26
const SKEW = 38
const DAMP = 700
const INITIAL_BIAS = 72
const INITIAL_N = 128
const DELIMITER = '-'
const ACE_PREFIX = 'xn--'
const MAX_INT = 0x7FFFFFFF

/** Maps a basic code point to its digit value, or -1 when it is not a digit. */
function digitValue(codePoint: number): number {
  if (codePoint >= 0x41 && codePoint <= 0x5A)
    return codePoint - 0x41 // A-Z
  if (codePoint >= 0x61 && codePoint <= 0x7A)
    return codePoint - 0x61 // a-z
  if (codePoint >= 0x30 && codePoint <= 0x39)
    return codePoint - 0x30 + 26 // 0-9
  return -1
}

function adaptBias(delta: number, numPoints: number, firstTime: boolean): number {
  let scaled = firstTime ? Math.floor(delta / DAMP) : delta >> 1
  scaled += Math.floor(scaled / numPoints)

  let k = 0
  while (scaled > ((BASE - T_MIN) * T_MAX) >> 1) {
    scaled = Math.floor(scaled / (BASE - T_MIN))
    k += BASE
  }

  return k + Math.floor(((BASE - T_MIN + 1) * scaled) / (scaled + SKEW))
}

/**
 * Decodes the punycode payload of a single label, returning undefined when the
 * input is not well-formed punycode.
 */
function decodePunycode(input: string): string | undefined {
  const output: number[] = []

  // Basic code points are copied verbatim up to the last delimiter.
  const lastDelimiter = input.lastIndexOf(DELIMITER)
  if (lastDelimiter > 0) {
    for (let index = 0; index < lastDelimiter; index++) {
      const codePoint = input.charCodeAt(index)
      if (codePoint >= 0x80)
        return undefined
      output.push(codePoint)
    }
  }

  let n = INITIAL_N
  let i = 0
  let bias = INITIAL_BIAS

  let index = lastDelimiter > 0 ? lastDelimiter + 1 : 0
  if (index >= input.length)
    return undefined

  while (index < input.length) {
    const oldI = i
    let w = 1

    for (let k = BASE; ; k += BASE) {
      if (index >= input.length)
        return undefined

      const digit = digitValue(input.charCodeAt(index++))
      if (digit < 0)
        return undefined
      if (digit > Math.floor((MAX_INT - i) / w))
        return undefined

      i += digit * w

      const t = k <= bias ? T_MIN : (k >= bias + T_MAX ? T_MAX : k - bias)
      if (digit < t)
        break

      if (w > Math.floor(MAX_INT / (BASE - t)))
        return undefined
      w *= BASE - t
    }

    const outLength = output.length + 1
    bias = adaptBias(i - oldI, outLength, oldI === 0)

    if (Math.floor(i / outLength) > MAX_INT - n)
      return undefined
    n += Math.floor(i / outLength)
    i %= outLength

    // Lone surrogates and out-of-range code points are not displayable text.
    if (n > 0x10FFFF || (n >= 0xD800 && n <= 0xDFFF))
      return undefined

    output.splice(i, 0, n)
    i++
  }

  return String.fromCodePoint(...output)
}

/**
 * Decodes a single DNS label. Labels without the ACE prefix are returned as-is.
 */
export function decodeIdnLabel(label: string): string {
  if (!label.toLowerCase().startsWith(ACE_PREFIX))
    return label

  const decoded = decodePunycode(label.slice(ACE_PREFIX.length))
  // An undecodable label is left alone: a name that merely looks like punycode is
  // still a legitimate DNS label.
  return decoded === undefined || decoded === '' ? label : decoded
}

/**
 * Decodes every punycode label of a domain or record name for display.
 * Returns the input unchanged when it holds no internationalized label, so
 * ASCII names never take a detour.
 */
export function toUnicodeDomain(value: string | undefined | null): string {
  if (!value)
    return ''
  if (!value.toLowerCase().includes(ACE_PREFIX))
    return value

  return value.split('.').map(decodeIdnLabel).join('.')
}

/**
 * True when displaying the domain differs from the stored ASCII form, which is
 * when showing the original alongside it is worth the space.
 */
export function isIdnDomain(value: string | undefined | null): boolean {
  return !!value && toUnicodeDomain(value) !== value
}

```

### Core Architecture Module: `app/src/views/config/configUtils.ts`
```
// List of protected directories that cannot be deleted
const PROTECTED_DIRS = ['sites-enabled', 'sites-available', 'streams-enabled', 'streams-available', 'conf.d']

/**
 * Check if a file/directory name is protected and cannot be deleted
 * @param name - The name of the file or directory
 * @returns true if the item is protected, false otherwise
 */
export function isProtectedPath(name: string): boolean {
  return PROTECTED_DIRS.includes(name)
}

/**
 * Get the list of protected directories
 * @returns Array of protected directory names
 */
export function getProtectedDirs(): string[] {
  return [...PROTECTED_DIRS]
}

```

### Core Architecture Module: `app/src/views/site/site_edit/components/HTTPS/httpsOnboardingState.ts`
```
import type {
  HTTPSDiagnostic,
  HTTPSEvent,
  HTTPSHint,
  HTTPSMessageArgs,
  HTTPSResult,
  HTTPSStep,
  HTTPSStepStatus,
} from '@/api/https'

// Pure state machine for the HTTPS onboarding websocket. It holds no Vue
// reactivity and no translations so it can be unit-tested in isolation;
// the composable and the card translate the English source strings.

export const HTTPS_MAIN_STEPS: readonly HTTPSStep[] = ['plan', 'stage', 'probe', 'issue', 'finalize']

const KNOWN_STEPS = new Set<HTTPSStep>([...HTTPS_MAIN_STEPS, 'rollback'])
const KNOWN_STEP_STATUSES = new Set<HTTPSStepStatus>(['running', 'success', 'warning', 'error', 'skipped'])

export type HTTPSOnboardingPhase = 'idle' | 'running' | 'success' | 'error'

export interface HTTPSStepState {
  status: HTTPSStepStatus
  message?: string
  args?: HTTPSMessageArgs
}

export interface HTTPSLogLine {
  message: string
  args?: HTTPSMessageArgs
}

export interface HTTPSOnboardingError {
  // Set when the socket dropped before `done`; the server sent no message.
  code?: 'connection_closed'
  step?: HTTPSStep
  message: string
  args?: HTTPSMessageArgs
  hint?: HTTPSHint
}

export interface HTTPSOnboardingState {
  phase: HTTPSOnboardingPhase
  steps: Partial<Record<HTTPSStep, HTTPSStepState>>
  // The step that most recently reported `running`.
  currentStep?: HTTPSStep
  logs: HTTPSLogLine[]
  diagnostics: HTTPSDiagnostic[]
  result?: HTTPSResult
  error?: HTTPSOnboardingError
}

// Client-side event emitted when the websocket errors or closes. It is a
// failure only while the run is still waiting for `done`.
export interface HTTPSSocketClosedEvent {
  type: 'socket_closed'
}

export type HTTPSOnboardingEvent = HTTPSEvent | HTTPSSocketClosedEvent

export const CONNECTION_CLOSED_MESSAGE = 'Connection closed before HTTPS setup finished'

export function createHTTPSOnboardingState(phase: HTTPSOnboardingPhase = 'idle'): HTTPSOnboardingState {
  return {
    phase,
    steps: {},
    logs: [],
    diagnostics: [],
  }
}

function isStep(value: unknown): value is HTTPSStep {
  return typeof value === 'string' && KNOWN_STEPS.has(value as HTTPSStep)
}

function withStep(state: HTTPSOnboardingState, step: HTTPSStep, next: HTTPSStepState): HTTPSOnboardingState['steps'] {
  return { ...state.steps, [step]: next }
}

// Marks the step as failed unless the server already reported a terminal status for it.
function failStep(state: HTTPSOnboardingState, step?: HTTPSStep): HTTPSOnboardingState['steps'] {
  if (!step)
    return state.steps

  const current = state.steps[step]
  if (current && current.status !== 'running')
    return state.steps

  return withStep(state, step, { ...current, status: 'error' })
}

export function reduceHTTPSEvent(state: HTTPSOnboardingState, event: HTTPSOnboardingEvent): HTTPSOnboardingState {
  // Only a running flow accepts events; anything after `done` (including the
  // server closing the socket) is ignored.
  if (state.phase !== 'running' || !event || typeof event !== 'object')
    return state

  switch (event.type) {
    case 'step': {
      if (!isStep(event.step) || !KNOWN_STEP_STATUSES.has(event.status))
        return state

      return {
        ...state,
        steps: withStep(state, event.step, {
          status: event.status,
          message: event.message,
          args: event.args,
        }),
        currentStep: event.status === 'running' ? event.step : state.currentStep,
      }
    }

    case 'log':
      if (typeof event.message !== 'string')
        return state

      return {
        ...state,
        logs: [...state.logs, { message: event.message, args: event.args }],
      }

    case 'diagnostic': {
      const { type: _type, ...diagnostic } = event

      return {
        ...state,
        diagnostics: [...state.diagnostics, diagnostic],
      }
    }

    case 'done': {
      if (event.status === 'success') {
        const { type: _type, status: _status, ...result } = event

        return {
          ...state,
          phase: 'success',
          result,
          error: undefined,
        }
      }

      const step = isStep(event.step) ? event.step : state.currentStep

      return {
        ...state,
        phase: 'error',
        steps: failStep(state, step),
        error: {
          step,
          message: event.message ?? '',
          args: event.args,
          hint: event.hint,
        },
      }
    }

    case 'socket_closed':
      return {
        ...state,
        phase: 'error',
        steps: failStep(state, state.currentStep),
        error: {
          code: 'connection_closed',
          step: state.currentStep,
          message: CONNECTION_CLOSED_MESSAGE,
        },
      }

    default:
      return state
  }
}

// Parses a raw websocket frame; returns undefined for anything that is not an event object.
export function parseHTTPSEvent(raw: unknown): HTTPSEvent | undefined {
  if (typeof raw !== 'string')
    return undefined

  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && typeof parsed.type === 'string')
      return parsed as HTTPSEvent
  }
  catch {
    // Ignore malformed frames.
  }

  return undefined
}

const HOSTNAME_LABEL = /^(?!-)[\p{L}\p{N}-]{1,63}(?<!-)$/u

// Validates a certificate identifier: an IPv4/IPv6 literal is checked by the
// caller; this covers hostnames, optionally with a leading `*.` wildcard.
export function isValidHostname(value: string, allowWildcard = false): boolean {
  let host = value.trim().replace(/\.$/, '')
  if (allowWildcard && host.startsWith('*.'))
    host = host.slice(2)

  if (!host || host.length > 253)
    return false

  return host.split('.').every(label => HOSTNAME_LABEL.test(label))
}

/**
 * Drops diagnostics that repeat the failure hint. The backend classifies the
 * failure from the same DNS evidence it reported as a diagnostic, so both
 * would otherwise say the same thing twice.
 */
export function diagnosticsWithoutHint(diagnostics: HTTPSDiagnostic[], hintCode?: string): HTTPSDiagnostic[] {
  if (!hintCode)
    return diagnostics

  return diagnostics.filter(d => d.code !== hintCode)
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2001** (2026-10-05): **Certificate managed by Nginx UI gets overwritten**
  *Symptoms*: **Describe the bug** I wanted to add a second certificate that contains ca. 12 single subdomains via  'Issue Certificate -> Custom Domain Certificate'. They both get the same filename; the last one to be renewed overwrites the existing files. (Path/Filename: '/etc/nginx/fullchain.cer' and '/etc/nginx/private.key')  **To Reproduce** Steps to reproduce the behavior: 1. Register one certificate in the nginx-ui with multiple (long?) subdomains (a.example.com, b.example.com, ...) 2. Register a second certificate in the nginx-ui with multiple (long?) subdomains (a.example.net, b.example.net, ...) 3. If you edit the first certificate, the subdomains a.example.net, b.example.net, ... are shown  **Expected behavior**  I would expect the program to check if another certificate uses the same path/filename and then change it with a appended number / the datetime.   **Info (please complete the following information):**  - Server OS: Debian 13 (VM)  - Nginx UI Version: 2.8.2  **Additional context** Manually changing the filepath in the database fixed the problem for me.

- **Issue #1996** (2026-10-05): **Can't login when changing system preference from HTTPS to HTTP**
  *Symptoms*: **Describe the bug** Unable to login when HTTPS access to UI is disabled.  **To Reproduce** Steps to reproduce the behavior: Login works correctly when accessing the UI on port 9000 with HTTPS enabled. Under Preference > Server > Enable HTTPS > toggle to disable. Save changes and allow the service to restart. At login page (over HTTP) the previous credentials don't work. Two messages appear at the top of the page 1) Login Successful (with green tick) 2) Authorization failed (with red cross)  **Expected behavior** Login should be permitted over HTTP  **Screenshots** If applicable, add screenshots to help explain your problem.  **Info (please complete the following information):**  - Server OS: Ubuntu 24.04  - Server Arch: x64  - Nginx UI Version: 2.8.1  - Your Browser: Edge  **Additional context** Add any other context about the problem here. 
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report. This was caused by the session-binding cookie retaining the `Secure` attribute after switching the UI from HTTPS to HTTP. The HTTP login itself succeeded, but the follow-up short-token request could not read the old Secure cookie, which caused the frontend to log out and show both “Login successful” and “Authorization failed”.  Fixed in commit `881ef81c8151438514dd2e1300e44b53dbbb7f7c` on `dev`:  - HTTPS and HTTP now use separate session-binding cookie names. - The short-token endpoint reads the cookie for the active protocol. - Added backend coverage and a Playwright E2E test for HTTP mode.  The fix will be included in the next release. Closing this issue. 

- **Issue #1970** (2026-09-28): **批量修改站点的命名空间报错了**
  *Symptoms*: <img width="782" height="697" alt="Image" src="https://github.com/user-attachments/assets/c9aee994-63c7-4a6e-8dd7-0e4d7698c3b4" />  v2.7.0版本，chrome浏览器，如上图所示。  开发者模式显示http://Ip:9000/api/sites错误如下： ``` {     "scope": "validate",     "code": 406,     "message": "Requested with wrong parameters",     "errors": {         "body": "empty payload"     } } ```  单独点进站点改命名空间一切正常。

- **Issue #1968** (2026-09-28): **DDNS is updating A+AAAA records even if not selected**
  *Symptoms*: **Describe the bug** I have a domain dns4.domain.com (A + AAAA records) and dns6.domain.com (A + AAAA records). In DDNS I have configured to update IP4 and then IP6. As domains I have selected: - dns4.domain.com (A) - dns6.domain.com (AAAA)  After clicking save then the records to update are: - dns4.domain.com (A) - dns4.domain.com (AAAA) - dns6.domain.com (A) - dns6.domain.com (AAAA)  **To Reproduce** See description  **Expected behavior** Only the selected records are considered for update.  **Screenshots** DDNS record selection: <img width="469" height="97" alt="Image" src="https://github.com/user-attachments/assets/bf4ce0c8-761b-49e9-ac72-ccf7c12cee04" />  DDNS record result: <img width="718" height="92" alt="Image" src="https://github.com/user-attachments/assets/b5eb591a-200d-4ec0-bf4d-06f38a330a49" />  **Info (please complete the following information):**  - Server OS: Server OS: debian 12  - Server Arch: x64  - Nginx UI Version: 2.6.1  - Your Browser: Firefox  **Additional context** N/A 

- **Issue #1954** (2026-09-22): **Fix German localization typos in de_DE.po**
  *Symptoms*: The German translation file contains a few obvious spelling mistakes in the UI strings, which make the German locale look inconsistent and unpolished.  **Affected file:**  app/src/language/de_DE.po Examples:  "Error Logs" is currently translated as:  "Feherlogs" This should be corrected to "Fehlerlogs" or "Fehlerprotokolle" "Not Valid Before: %{date}" is currently translated as:  "Nich gültig vor: %{date}" This should be corrected to "Nicht gültig vor: %{date}" Expected behavior: German UI strings should be grammatically correct and consistent with the rest of the locale file.  **Actual behavior:** Some German texts include visible typos and incorrect wording, which are shown to users in the interface.  **Suggested fix:**  Correct the spelling and wording in app/src/language/de_DE.po Review the surrounding German translations for similar mistakes Verify the strings render correctly in the application after the change This is a localization quality issue rather than a functional bug, but it affects the overall user experience in the German UI.
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report! Fixed in 7cc52451dc.  Besides the two strings you mentioned (`Feherlogs` → `Fehlerprotokolle`, `Nich gültig vor` → `Nicht gültig vor`), I reviewed the rest of `de_DE.po` and corrected 24 more entries:  - Spelling: `Benuztername`, `Scrheibe`, `Feher`, `Nicth`, `FDatei`, `Beffehl`, `Aktiviern`, `CPU -Kerne`, `Benuzte Wiederherstellungscode` - Truncated strings: `Kom` (Comments), `Konf` (Configuration Name), `Er` (Creating client…) - Mistranslations: "Reload" rendered as `Neustart`, `Vergleiche mit Strom`, `Warteverfahren`, `Standorte` for sites, and a few garbled sentences - Grammar and consistency: `Änderungsvorschau`, `Inkrementelles Index-Scanning`, `Zugriffsprotokolle`  The fix will ship in the next release. Further corrections from native speakers are always welcome.

- **Issue #1943** (2026-09-20): **dns01 _acme-challenge records not deleted with deSEC.io**
  *Symptoms*: **Describe the bug** When issuing a certificate with deSEC as DNS provider, the process fails to delete the temporary TXT record  **To Reproduce** Steps to reproduce the behavior: 1. Add deSEC.io as DNS provider 2. Issue/re-issue a certificate using deSEC as DNS provider 3. Wait for the process to execute 4. See error  **Expected behavior** The temporary `_acme-challenge` TXT record should be deleted  **Info (please complete the following information):** Current Version: v2.6.1 (7ed4fc4) OS: linux Arch: amd64 Deployment: Docker Container  **Additional context** ``` time=2026-09-19T17:36:43.013+03:00 level=INFO msg="dns01: waiting for record propagation." domain=sub.example.com  time=2026-09-19T17:37:14.758+03:00 level=INFO msg="The server validated our request." domain=sub.example.com  time=2026-09-19T17:37:14.758+03:00 level=INFO msg="dns01: cleaning DNS-01 challenge." domain=sub.example.com  time=2026-09-19T17:37:14.914+03:00 level=WARN msg="Cleaning up failed." domain=sub.example.com error="desec: failed to update records: domainName=example.com, recordName=_acme-challenge.sub: 400: body: {\"subname\":[\"Can only be written on create.\"]}"  time=2026-09-19T17:37:14.914+03:00 level=INFO msg="Validations succeeded; requesting certificates." domains=sub.example.com  [Nginx UI] Writing certificate to disk ``` 
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed report. This was caused by a regression in `github.com/nrdcg/desec v0.11.2`, which sends the create-only `subname` field in PATCH requests. We have pinned the dependency to `v0.11.1` and explicitly excluded the affected release in d750df2f1d. The fix will be included in v2.6.2.

- **Issue #1940** (2026-09-20): **Namespace upstream sync error**
  *Symptoms*: When first deploying sites with namespace sync, if sites point to upstream that added with same sync (site with upstream section only), sync will error with: my_remote: my_site.local - /api/sites/my_site.local responded with 500: {     "scope": "nginx", "code": 50000, "message": "nginx error: {0}", "params": [         "nginx [emerg] host not found in upstream \"my_upstream\" in /etc/nginx/sites-enabled/my_site.local" ]}  Steps to reproduce the behavior: 1. Create empty namespace. 2. Create 2 sites: one with upstream only, another points to that upstream. 3. Add both sites to namespace and turn on. 4. Assign remote to namespace and sync manually.  It was intended to sync all together at same time, or at right order (also tried to order sites by name them lexicographically before sync)  Info:  - Server OS: docker image from dockerhub  - Server Arch: amd64  - Nginx UI Version: 2.6.0  - Your Browser: Microsoft Edge 130.0  Fixing by just sync once again, but makes me wonder if it can lead to uncontrollable post-sync behavior in manual sync mode.
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed report. This has been fixed in commit 7626fd40d9. Namespace sync now stages all managed site and stream configuration files before applying individual enabled states, so interdependent upstream and site configurations no longer fail based on item order. The fix will be included in v2.6.2.

- **Issue #1939** (2026-09-20): **Namespace sites replacement issue**
  *Symptoms*: When master and remote nodes both have sites with same name, after master sites assigned to namespace with remote node - on remote that sites will be changed, but still will appear as just local sites (not from namespace). And if this sites are only namespace content - on remote that namespace will not be created at all.  Steps to reproduce the behavior: 1. Create different sites with same name on both nodes locally (nodes don't have common namespace). 2. On master node create namespace with remote node. 3. Add site to namespace in site edit tab. 4. Connect to remote - site updated, but namespace not created (no namespace tab in sites list page, and no namespace in namespaces created)  Info:  - Server OS: docker image from dockerhub  - Server Arch: amd64  - Nginx UI Version: 2.6.0  - Your Browser: Microsoft Edge 130.0  Fixing by deleting all affected sites from remote, and sync manually from master.
  **Post-Mortem & Fix Analysis**:
  > Fixed. The single-item site and stream propagation paths now include the namespace name in remote save payloads. Receiving nodes resolve or create that namespace before updating the configuration, so same-named local configurations are reassigned instead of being overwritten without namespace metadata. Regression coverage was added for both paths, and the full race-enabled backend test suite passes.

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

### Incident Patch 1: `d2a2bca7` (2026-10-05)
**Commit Message**: Merge pull request #1993 from 0xJacky/renovate/nginxui-musl-cross-compilers-digest

chore(deps): update nginxui/musl-cross-compilers digest to 57f4de0

**File**: `.github/workflows/build.yml` (modified, +3/-3)
```diff
@@ -244,7 +244,7 @@ jobs:
       # answers 5xx; retry the whole action twice with a growing pause.
       - name: Install musl cross compiler
         if: env.GOOS == 'linux'
-        uses: nginxui/musl-cross-compilers@8f83e180fec1779fd14f7aa9834d83525187a317 # v1
+        uses: nginxui/musl-cross-compilers@57f4de0b40cd0b53b1dc02fb8b317d87f78f3483 # v1
         id: musl
         continue-on-error: true
         with:
@@ -257,7 +257,7 @@ jobs:
 
       - name: Install musl cross compiler (retry 1)
         if: env.GOOS == 'linux' && steps.musl.outcome == 'failure'
-        uses: nginxui/musl-cross-compilers@8f83e180fec1779fd14f7aa9834d83525187a317 # v1
+        uses: nginxui/musl-cross-compilers@57f4de0b40cd0b53b1dc02fb8b317d87f78f3483 # v1
         id: musl_retry1
         continue-on-error: true
         with:
@@ -270,7 +270,7 @@ jobs:
 
       - name: Install musl cross compiler (retry 2)
         if: env.GOOS == 'linux' && steps.musl_retry1.outcome == 'failure'
-        uses: nginxui/musl-cross-compilers@8f83e180fec1779fd14f7aa9834d83525187a317 # v1
+        uses: nginxui/musl-cross-compilers@57f4de0b40cd0b53b1dc02fb8b317d87f78f3483 # v1
         id: musl_retry2
         with:
           target: ${{ env.ARCH_NAME }}-linux-musl${{ env.ABI }}
```

---

### Incident Patch 2: `1504bacf` (2026-10-05)
**Commit Message**: chore(deps): update nginxui/musl-cross-compilers digest to 57f4de0

**File**: `.github/workflows/build.yml` (modified, +3/-3)
```diff
@@ -244,7 +244,7 @@ jobs:
       # answers 5xx; retry the whole action twice with a growing pause.
       - name: Install musl cross compiler
         if: env.GOOS == 'linux'
-        uses: nginxui/musl-cross-compilers@8f83e180fec1779fd14f7aa9834d83525187a317 # v1
+        uses: nginxui/musl-cross-compilers@57f4de0b40cd0b53b1dc02fb8b317d87f78f3483 # v1
         id: musl
         continue-on-error: true
         with:
@@ -257,7 +257,7 @@ jobs:
 
       - name: Install musl cross compiler (retry 1)
         if: env.GOOS == 'linux' && steps.musl.outcome == 'failure'
-        uses: nginxui/musl-cross-compilers@8f83e180fec1779fd14f7aa9834d83525187a317 # v1
+        uses: nginxui/musl-cross-compilers@57f4de0b40cd0b53b1dc02fb8b317d87f78f3483 # v1
         id: musl_retry1
         continue-on-error: true
         with:
@@ -270,7 +270,7 @@ jobs:
 
       - name: Install musl cross compiler (retry 2)
         if: env.GOOS == 'linux' && steps.musl_retry1.outcome == 'failure'
-        uses: nginxui/musl-cross-compilers@8f83e180fec1779fd14f7aa9834d83525187a317 # v1
+        uses: nginxui/musl-cross-compilers@57f4de0b40cd0b53b1dc02fb8b317d87f78f3483 # v1
         id: musl_retry2
         with:
           target: ${{ env.ARCH_NAME }}-linux-musl${{ env.ABI }}
```

---

### Incident Patch 3: `4535e21c` (2026-10-05)
**Commit Message**: Merge pull request #2004 from 0xJacky/claude/fix-cert-dir-name-too-long

fix(cert): keep certificates with long identifier lists in their own directory

**File**: `api/certificate/self_signed.go` (modified, +11/-1)
```diff
@@ -250,6 +250,10 @@ func normalizeStringSlice(in []string) []string {
 }
 
 // selfSignedSlug builds a filesystem-safe directory slug from a name.
+// maxSelfSignedSlugLength leaves room for the "_<id>" suffix within the 255
+// byte file name limit.
+const maxSelfSignedSlugLength = 200
+
 func selfSignedSlug(name string) string {
 	name = strings.TrimSpace(name)
 	if asciiName, err := idna.Lookup.ToASCII(name); err == nil {
@@ -265,7 +269,13 @@ func selfSignedSlug(name string) string {
 			b.WriteRune('_')
 		}
 	}
-	slug := strings.Trim(b.String(), "._-")
+	slug := b.String()
+	// The directory name also carries "_<id>", and a longer name would exceed
+	// the file name limit and send the files to the nginx configuration root.
+	if len(slug) > maxSelfSignedSlugLength {
+		slug = slug[:maxSelfSignedSlugLength]
+	}
+	slug = strings.Trim(slug, "._-")
 	if slug == "" {
 		slug = defaultSelfSignedSlug
 	}
```

**File**: `api/certificate/self_signed_test.go` (modified, +7/-0)
```diff
@@ -199,3 +199,10 @@ func TestGenerateSelfSignedCertRejectsEmptyName(t *testing.T) {
 		t.Fatalf("response body %q did not mention the missing name field", rec.Body.String())
 	}
 }
+
+func TestSelfSignedSlugStaysWithinFileNameLimit(t *testing.T) {
+	got := selfSignedSlug(strings.Repeat("a", 300) + ".example.com")
+	if len(got) != maxSelfSignedSlugLength || strings.Trim(got, "a") != "" {
+		t.Fatalf("selfSignedSlug() = %q (%d bytes), want %d bytes", got, len(got), maxSelfSignedSlugLength)
+	}
+}
```

**File**: `app/src/components/Notification/notifications.ts` (modified, +4/-0)
```diff
@@ -73,6 +73,10 @@ const notifications: Record<string, { title: () => string, content: (args: any)
     title: () => $gettext('Certificate Expiring Soon'),
     content: (args: any) => $gettext('Certificate %{name} will expire in %{days} days', args),
   },
+  'Certificate Relocated': {
+    title: () => $gettext('Certificate Relocated'),
+    content: (args: any) => $gettext('Certificate %{name} is now stored in %{path}, point the sites that load %{previous_path} to it', args),
+  },
   'Sync Certificate Error': {
     title: () => $gettext('Sync Certificate Error'),
     content: (args: any) => $gettext('Sync Certificate %{cert_name} to %{node_name} failed', args),
```

**File**: `internal/cert/auto_cert.go` (modified, +1/-0)
```diff
@@ -120,6 +120,7 @@ func autoCert(certModel *model.Cert) {
 	}
 
 	updateAutoRenewStatus(certModel, now, "")
+	notifyCertificateRelocated(targetName, certModel.SSLCertificatePath, payload.GetCertificatePath())
 	notification.Success("Renew Certificate Success", "Certificate %{name} renewed successfully", map[string]any{
 		"name": targetName,
 	})
```

**File**: `internal/cert/certificate_dir_test.go` (added, +102/-0)
```diff
@@ -0,0 +1,102 @@
+package cert
+
+import (
+	"fmt"
+	"os"
+	"path/filepath"
+	"strings"
+	"testing"
+
+	"github.com/go-acme/lego/v5/certcrypto"
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+)
+
+// longIdentifierList returns count subdomains of domain whose joined directory
+// name is well beyond the file name limit, like the list in issue #2001.
+func longIdentifierList(domain string, count int) []string {
+	identifiers := make([]string, 0, count)
+	for i := range count {
+		identifiers = append(identifiers, fmt.Sprintf("service-%02d-subdomain.%s", i, domain))
+	}
+	return identifiers
+}
+
+func TestCertificateDirNameKeepsShortListsUnchanged(t *testing.T) {
+	got := certificateDirName([]string{"example.com", "www.example.com"}, certcrypto.EC256)
+	assert.Equal(t, "example.com_www.example.com_EC256", got)
+}
+
+func TestCertificateDirNameBoundsLongLists(t *testing.T) {
+	first := longIdentifierList("example.com", 12)
+	second := longIdentifierList("example.net", 12)
+	require.Greater(t, len(strings.Join(first, "_")), maxCertificateDirNameLength,
+		"test premise: the joined list must exceed the file name limit")
+
+	firstName := certificateDirName(first, certcrypto.EC256)
+	secondName := certificateDirName(second, certcrypto.EC256)
+
+	assert.LessOrEqual(t, len(firstName), maxCertificateDirNameLength)
+	assert.True(t, strings.HasPrefix(firstName, first[0]+"_"), firstName)
+	assert.True(t, strings.HasSuffix(firstName, "_EC256"), firstName)
+	assert.Equal(t, firstName, certificateDirName(first, certcrypto.EC256), "the name must be stable")
+	assert.NotEqual(t, firstName, secondName)
+	assert.NotEqual(t, firstName, certificateDirName(first[:11], certcrypto.EC256),
+		"lists sharing the first identifier must not collide")
+}
+
+func TestCertificateDirNameBoundsSingleLongIdentifier(t *testing.T) {
+	label := strings.Repeat("a", 63)
+	identifier := strings.Join([]string{label, label, label, label[:57], "com"}, ".")
+	require.Len(t, identifier, 253, "test premise: the longest valid domain name")
+
+	got := certificateDirName([]string{identifier}, certcrypto.RSA2048)
+	assert.LessOrEqual(t, len(got), maxCertificateDirNameLength)
+	assert.True(t, strings.HasSuffix(got, "_RSA2048"), got)
+}
+
+// TestCertificatePathsOfLongListsStayApart is the regression test for issue
+// #2001: two certificates with long identifier lists both resolved to
+// fullchain.cer and private.key in the nginx configuration directory and
+// overwrote each other.
+func TestCertificatePathsOfLongListsStayApart(t *testing.T) {
+	confDir := useTempNginxConfDir(t)
+	sslDir := filepath.Join(confDir, "ssl")
+
+	first := &ConfigPayload{ServerName: longIdentifierList("example.com", 12), KeyType: certcrypto.EC256}
+	second := &ConfigPayload{ServerName: longIdentifierList("example.net", 12), KeyType: certcrypto.EC256}
+
+	for _, payload := range []*ConfigPayload{first, second} {
+		assert.Equal(t, sslDir, filepath.Dir(payload.getCertificateDirPath()))
+		assert.False(t, IsConfRootCertificatePath(payload.GetCertificatePath()), payload.GetCertificatePath())
+		require.NoError(t, payload.mkCertificateDir())
+	}
+	assert.NotEqual(t, first.GetCertificatePath(), second.GetCertificatePath())
+	assert.NotEqual(t, first.GetCertificateKeyPath(), second.GetCertificateKeyPath())
+}
+
+func TestMkCertificateDirRefusesTheConfigurationDirectory(t *testing.T) {
+	confDir := useTempNginxConfDir(t)
+
+	payload := &ConfigPayload{CertificateDir: confDir}
+	assert.ErrorIs(t, payload.mkCertificateDir(), errCertificateDirIsConfRoot)
+}
+
+// TestUseExistingCertificatePathsIgnoresSharedConfRootFiles covers records
+// written before the fix: they point at the files shared in the configuration
+// directory, and pinning them would keep the certificates overwriting each
+// other, so the renewal moves to the certificate's own directory instead.
+func TestUseExistingCertificatePathsIgnoresSharedConfRootFiles(t *testing.T) {
+	confDir := useTempNginxConfDir(t)
+	certPath := filepath.Join(confDir, "fullchain.cer")
+	keyPath := filepath.Join(confDir, "private.key")
+	require.NoError(t, os.WriteFile(certPath, []byte("shared"), 0o644))
+	require.NoError(t, os.WriteFile(keyPath, []byte("shared"), 0o600))
+
+	payload := &ConfigPayload{ServerName: longIdentifierList("example.com", 12), KeyType: certcrypto.EC256}
+	payload.UseExistingCertificatePaths(certPath, keyPath)
+
+	assert.Empty(t, payload.SSLCertificatePath)
+	assert.Empty(t, payload.SSLCertificateKeyPath)
+	assert.Equal(t, filepath.Join(confDir, "ssl"), filepath.Dir(payload.getCertificateDirPath()))
+}
```

**File**: `internal/cert/issue_record.go` (modified, +1/-0)
```diff
@@ -219,6 +219,7 @@ func IssueWithRecord(name string, payload *ConfigPayload, log *Logger) (*model.C
 	}
 
 	MarkCertSuccess(certModel.ID, payload.GetCertificatePath(), payload.GetCertificateKeyPath(), payload.Resource, payload.Profile)
+	notifyCertificateRelocated(getAutoRenewTargetName(certModel), certModel.SSLCertificatePath, payload.GetCertificatePath())
 	return certModel, nil
 }
 
```

**File**: `internal/cert/payload.go` (modified, +74/-1)
```diff
@@ -1,13 +1,17 @@
 package cert
 
 import (
+	"crypto/sha256"
+	"encoding/hex"
+	"errors"
 	"os"
 	"path/filepath"
 	"strings"
 	"time"
 
 	"github.com/0xJacky/Nginx-UI/internal/helper"
 	"github.com/0xJacky/Nginx-UI/internal/nginx"
+	"github.com/0xJacky/Nginx-UI/internal/notification"
 	"github.com/0xJacky/Nginx-UI/internal/translation"
 	"github.com/0xJacky/Nginx-UI/model"
 	"github.com/0xJacky/Nginx-UI/query"
@@ -16,6 +20,15 @@ import (
 	"github.com/uozi-tech/cosy/logger"
 )
 
+// maxCertificateDirNameLength is the file name limit (NAME_MAX) of common file
+// systems. A derived certificate directory name must stay within it.
+const maxCertificateDirNameLength = 255
+
+// errCertificateDirIsConfRoot refuses to write certificate files straight into
+// the nginx configuration directory. Every certificate would share the same
+// fullchain.cer and private.key there and overwrite each other.
+var errCertificateDirIsConfRoot = errors.New("certificate directory resolves to the nginx configuration directory")
+
 type ConfigPayload struct {
 	ConfigName                        string                     `json:"-"`
 	CertID                            uint64                     `json:"cert_id"`
@@ -62,6 +75,9 @@ func (c *ConfigPayload) GetKeyType() certcrypto.KeyType {
 // filesystem, which is the remote host in host_via_ssh + sftp mode.
 func (c *ConfigPayload) mkCertificateDir() (err error) {
 	dir := c.getCertificateDirPath()
+	if isConfRootCertificateDir(dir) {
+		return errCertificateDirIsConfRoot
+	}
 	exists, err := nginx.Exists(dir)
 	if err != nil {
 		return err
@@ -110,6 +126,12 @@ func (c *ConfigPayload) UseExistingCertificatePaths(certificatePath, certificate
 		!helper.IsUnderDirectory(certificateKeyPath, nginxConfPath) {
 		return
 	}
+	// Files directly in the configuration directory come from a derived name
+	// that exceeded the file name limit, so every such certificate shares
+	// them. Reusing them would keep the certificates overwriting each other.
+	if IsConfRootCertificatePath(certificatePath) || IsConfRootCertificatePath(certificateKeyPath) {
+		return
+	}
 
 	c.SSLCertificatePath = certificatePath
 	c.SSLCertificateKeyPath = certificateKeyPath
@@ -197,10 +219,48 @@ func (c *ConfigPayload) getCertificateDirPath() string {
 		c.CertificateDir = filepath.Dir(c.SSLCertificatePath)
 		return c.CertificateDir
 	}
-	c.CertificateDir = nginx.GetConfPath("ssl", strings.Join(c.ServerName, "_")+"_"+string(c.GetKeyType()))
+	c.CertificateDir = nginx.GetConfPath("ssl", certificateDirName(c.ServerName, c.GetKeyType()))
 	return c.CertificateDir
 }
 
+// certificateDirName derives the directory name of a certificate from its
+// identifiers and key type. A long identifier list would exceed the file name
+// limit, which made the path check fail and the certificate land in the nginx
+// configuration directory, shared with every other such certificate. Such
+// lists keep the first identifier and replace the rest with a digest of the
+// whole list, so the name stays unique and keeps the key type suffix that the
+// legacy path migration relies on.
+func certificateDirName(identifiers []string, keyType certcrypto.KeyType) string {
+	suffix := "_" + string(keyType)
+	joined := strings.Join(identifiers, "_")
+	if len(joined)+len(suffix) <= maxCertificateDirNameLength {
+		return joined + suffix
+	}
+
+	sum := sha256.Sum256([]byte(joined))
+	digest := "_" + hex.EncodeToString(sum[:8])
+	prefix := ""
+	if len(identifiers) > 0 {
+		prefix = identifiers[0]
+	}
+	if limit := maxCertificateDirNameLength - len(digest) - len(suffix); len(prefix) > limit {
+		prefix = strings.ToValidUTF8(prefix[:limit], "")
+	}
+	return prefix + digest + suffix
+}
+
+// isConfRootCertificateDir reports whether dir is the nginx configuration
+// directory itself.
+func isConfRootCertificateDir(dir string) bool {
+	return filepath.Clean(dir) == filepath.Clean(nginx.GetConfPath())
+}
+
+// IsConfRootCertificatePath reports whether a certificate or key file sits
+// directly in the nginx configuration directory.
+func IsConfRootCertificatePath(path string) bool {
+	return path != "" && isConfRootCertificateDir(filepath.Dir(path))
+}
+
 func (c *ConfigPayload) GetCertificatePath() string {
 	if c.SSLCertificatePath != "" {
 		return c.SSLCertificatePath
@@ -216,3 +276,16 @@ func (c *ConfigPayload) GetCertificateKeyPath() string {
 	c.SSLCertificateKeyPath = filepath.Join(c.getCertificateDirPath(), "private.key")
 	return c.SSLCertificateKeyPath
 }
+
+// notifyCertificateRelocated warns when a certificate that used the shared files
+// in the nginx configuration directory was written to its own directory. The
+// sites still load the shared files, which no renewal updates any more, and
+// only the user knows which of them belong to this certificate.
+func notifyCertificateRelocated(name, previousPath, currentPath string) {
+	if !IsConfRootCertificatePath(previousPath) || filepath.Clean(previousPath) == filepath.Clean(currentPath) {
+		
```

---

### Incident Patch 4: `881ef81c` (2026-10-05)
**Commit Message**: fix: isolate session cookies by protocol

**File**: `api/user/short_token.go` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@ import (
 // IssueShortToken creates a short token for WebSocket authentication.
 // Requires a JWT (via AuthRequired) and the browser session cookie.
 func IssueShortToken(c *gin.Context) {
-	sessionCookie, err := c.Cookie(middleware.SecureSessionCookieName)
+	sessionCookie, err := c.Cookie(middleware.SecureSessionCookieNameForRequest(c))
 	if err != nil || sessionCookie == "" {
 		c.JSON(http.StatusForbidden, gin.H{
 			"message": "Session binding cookie required",
```

**File**: `api/user/short_token_security_test.go` (modified, +4/-1)
```diff
@@ -27,7 +27,9 @@ func setupShortTokenSecurityTest(t *testing.T) (*gin.Engine, *gorm.DB, *model.Us
 	cache.InitInMemoryCache()
 
 	previousSecret := cSettings.AppSettings.JwtSecret
+	previousHTTPS := cSettings.ServerSettings.EnableHTTPS
 	cSettings.AppSettings.JwtSecret = "short-token-security-test-secret"
+	cSettings.ServerSettings.EnableHTTPS = false
 	db, err := gorm.Open(sqlite.Open(testdb.DSN(t, "short-token")), &gorm.Config{})
 	require.NoError(t, err)
 	require.NoError(t, db.AutoMigrate(&model.User{}, &model.AuthToken{}, &model.Passkey{}))
@@ -53,6 +55,7 @@ func setupShortTokenSecurityTest(t *testing.T) (*gin.Engine, *gorm.DB, *model.Us
 	t.Cleanup(func() {
 		cache.Shutdown()
 		cSettings.AppSettings.JwtSecret = previousSecret
+		cSettings.ServerSettings.EnableHTTPS = previousHTTPS
 	})
 	return router, db, u, payload.Token
 }
@@ -63,7 +66,7 @@ func shortTokenRequest(router http.Handler, method, path, authorization string,
 		req.Header.Set("Authorization", authorization)
 	}
 	if withCookie {
-		req.AddCookie(&http.Cookie{Name: middleware.SecureSessionCookieName, Value: "forged-nonempty-cookie"})
+		req.AddCookie(&http.Cookie{Name: middleware.SecureSessionCookieName + "_http", Value: "forged-nonempty-cookie"})
 	}
 	response := httptest.NewRecorder()
 	router.ServeHTTP(response, req)
```

**File**: `e2e/tests/auth-cookie-protocol-switch.spec.ts` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+import { expect, test } from '@playwright/test'
+
+test('HTTP login keeps the session-binding cookie usable after HTTPS was disabled', async ({ page }) => {
+  await page.goto('/')
+  const baseURL = new URL(page.url()).origin
+  const cookies = await page.context().cookies(baseURL)
+  const sessionCookie = cookies.find(cookie => cookie.name === '_nginx_ui_secure_session_http')
+
+  expect(sessionCookie, 'HTTP mode must use its protocol-specific session cookie').toBeDefined()
+  expect(sessionCookie?.httpOnly).toBe(true)
+  expect(sessionCookie?.secure).toBe(false)
+
+  const token = await page.evaluate(() => {
+    const raw = localStorage.getItem('user')
+    return raw ? JSON.parse(raw).token as string : ''
+  })
+  const response = await page.request.post('/api/token/short', {
+    headers: { Authorization: token },
+  })
+  expect(response.ok(), await response.text()).toBe(true)
+})
```

**File**: `e2e/tests/auth.setup.ts` (modified, +4/-1)
```diff
@@ -27,7 +27,10 @@ setup('authenticate through the demo login UI', async ({ page }) => {
   })).not.toBe('')
 
   const cookies = await page.context().cookies()
-  expect(cookies.some(cookie => cookie.name === '_nginx_ui_secure_session' && cookie.httpOnly)).toBe(true)
+  const expectedSessionCookie = new URL(page.url()).protocol === 'https:'
+    ? '_nginx_ui_secure_session'
+    : '_nginx_ui_secure_session_http'
+  expect(cookies.some(cookie => cookie.name === expectedSessionCookie && cookie.httpOnly)).toBe(true)
 
   await mkdir(dirname(authState), { recursive: true })
   await page.context().storageState({ path: authState })
```

**File**: `internal/middleware/secure_session.go` (modified, +18/-2)
```diff
@@ -15,9 +15,25 @@ import (
 )
 
 const SecureSessionCookieName = "_nginx_ui_secure_session"
+const insecureSecureSessionCookieName = SecureSessionCookieName + "_http"
+
+// secureSessionCookieName keeps the HTTPS and HTTP session-binding
+// cookies separate. Browsers do not reliably allow an HTTP response to
+// replace a Secure cookie left by a previous HTTPS session.
+func secureSessionCookieName(https bool) string {
+	if https {
+		return SecureSessionCookieName
+	}
+	return insecureSecureSessionCookieName
+}
+
+func SecureSessionCookieNameForRequest(c *gin.Context) string {
+	return secureSessionCookieName(cSettings.ServerSettings.EnableHTTPS)
+}
 
 func ensureSecureSessionCookie(c *gin.Context) {
-	if _, err := c.Cookie(SecureSessionCookieName); err != http.ErrNoCookie {
+	cookieName := SecureSessionCookieNameForRequest(c)
+	if _, err := c.Cookie(cookieName); err != http.ErrNoCookie {
 		return
 	}
 
@@ -28,7 +44,7 @@ func ensureSecureSessionCookie(c *gin.Context) {
 
 	c.SetSameSite(http.SameSiteLaxMode)
 	c.SetCookie(
-		SecureSessionCookieName,
+		cookieName,
 		hex.EncodeToString(b),
 		0,
 		"/",
```

**File**: `internal/middleware/secure_session_test.go` (modified, +32/-0)
```diff
@@ -13,12 +13,16 @@ import (
 	"github.com/gin-gonic/gin"
 	"github.com/stretchr/testify/assert"
 	"github.com/stretchr/testify/require"
+	cSettings "github.com/uozi-tech/cosy/settings"
 	"gorm.io/driver/sqlite"
 	"gorm.io/gorm"
 )
 
 func TestSecureSessionCookie(t *testing.T) {
 	gin.SetMode(gin.TestMode)
+	previousHTTPS := cSettings.ServerSettings.EnableHTTPS
+	cSettings.ServerSettings.EnableHTTPS = true
+	t.Cleanup(func() { cSettings.ServerSettings.EnableHTTPS = previousHTTPS })
 
 	t.Run("sets cookie when not present", func(t *testing.T) {
 		r := gin.New()
@@ -88,6 +92,31 @@ func TestSecureSessionCookie(t *testing.T) {
 	})
 }
 
+func TestSecureSessionCookieUsesSeparateNameOverHTTP(t *testing.T) {
+	gin.SetMode(gin.TestMode)
+	previousHTTPS := cSettings.ServerSettings.EnableHTTPS
+	cSettings.ServerSettings.EnableHTTPS = false
+	t.Cleanup(func() { cSettings.ServerSettings.EnableHTTPS = previousHTTPS })
+
+	r := gin.New()
+	r.Use(SecureSessionCookie())
+	r.GET("/", func(c *gin.Context) { c.Status(http.StatusNoContent) })
+
+	req := httptest.NewRequest(http.MethodGet, "/", nil)
+	w := httptest.NewRecorder()
+	r.ServeHTTP(w, req)
+
+	var found *http.Cookie
+	for _, cookie := range w.Result().Cookies() {
+		if cookie.Name == insecureSecureSessionCookieName {
+			found = cookie
+			break
+		}
+	}
+	require.NotNil(t, found)
+	assert.False(t, found.Secure)
+}
+
 func TestVerifiedNodePrincipalBypassesInternalSecureSessionOnly(t *testing.T) {
 	gin.SetMode(gin.TestMode)
 	principal := &nodeauth.Principal{CredentialID: "credential", AuthMethod: model.NodeAuthMethodPaired}
@@ -119,6 +148,9 @@ func TestVerifiedNodePrincipalBypassesInternalSecureSessionOnly(t *testing.T) {
 
 func TestEnsureSecureSessionCookie(t *testing.T) {
 	gin.SetMode(gin.TestMode)
+	previousHTTPS := cSettings.ServerSettings.EnableHTTPS
+	cSettings.ServerSettings.EnableHTTPS = true
+	t.Cleanup(func() { cSettings.ServerSettings.EnableHTTPS = previousHTTPS })
 
 	r := gin.New()
 	r.POST("/login", func(c *gin.Context) {
```

---

### Incident Patch 5: `035192b8` (2026-10-05)
**Commit Message**: fix(cert): keep certificates with long identifier lists in their own directory

The certificate directory name joins every identifier with the key type.
A dozen subdomains push it past the 255 byte file name limit, the path
check then fails with ENAMETOOLONG, and GetConfPath falls back to the
nginx configuration directory. Every such certificate was written to the
same fullchain.cer and private.key there and overwrote the others.

Names that would exceed the limit now keep the first identifier and
replace the rest with a digest of the whole list, so they stay unique
and keep the key type suffix. Writing certificate files straight into the
configuration directory is refused. Records that already point at the
shared files are no longer pinned to them on renewal; the certificate
moves to its own directory and a notification asks the user to update
the sites that load the shared files. Self-signed directory slugs are
capped for the same reason.

Fixes #2001

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `api/certificate/self_signed.go` (modified, +11/-1)
```diff
@@ -250,6 +250,10 @@ func normalizeStringSlice(in []string) []string {
 }
 
 // selfSignedSlug builds a filesystem-safe directory slug from a name.
+// maxSelfSignedSlugLength leaves room for the "_<id>" suffix within the 255
+// byte file name limit.
+const maxSelfSignedSlugLength = 200
+
 func selfSignedSlug(name string) string {
 	name = strings.TrimSpace(name)
 	if asciiName, err := idna.Lookup.ToASCII(name); err == nil {
@@ -265,7 +269,13 @@ func selfSignedSlug(name string) string {
 			b.WriteRune('_')
 		}
 	}
-	slug := strings.Trim(b.String(), "._-")
+	slug := b.String()
+	// The directory name also carries "_<id>", and a longer name would exceed
+	// the file name limit and send the files to the nginx configuration root.
+	if len(slug) > maxSelfSignedSlugLength {
+		slug = slug[:maxSelfSignedSlugLength]
+	}
+	slug = strings.Trim(slug, "._-")
 	if slug == "" {
 		slug = defaultSelfSignedSlug
 	}
```

**File**: `api/certificate/self_signed_test.go` (modified, +7/-0)
```diff
@@ -199,3 +199,10 @@ func TestGenerateSelfSignedCertRejectsEmptyName(t *testing.T) {
 		t.Fatalf("response body %q did not mention the missing name field", rec.Body.String())
 	}
 }
+
+func TestSelfSignedSlugStaysWithinFileNameLimit(t *testing.T) {
+	got := selfSignedSlug(strings.Repeat("a", 300) + ".example.com")
+	if len(got) != maxSelfSignedSlugLength || strings.Trim(got, "a") != "" {
+		t.Fatalf("selfSignedSlug() = %q (%d bytes), want %d bytes", got, len(got), maxSelfSignedSlugLength)
+	}
+}
```

**File**: `app/src/components/Notification/notifications.ts` (modified, +4/-0)
```diff
@@ -73,6 +73,10 @@ const notifications: Record<string, { title: () => string, content: (args: any)
     title: () => $gettext('Certificate Expiring Soon'),
     content: (args: any) => $gettext('Certificate %{name} will expire in %{days} days', args),
   },
+  'Certificate Relocated': {
+    title: () => $gettext('Certificate Relocated'),
+    content: (args: any) => $gettext('Certificate %{name} is now stored in %{path}, point the sites that load %{previous_path} to it', args),
+  },
   'Sync Certificate Error': {
     title: () => $gettext('Sync Certificate Error'),
     content: (args: any) => $gettext('Sync Certificate %{cert_name} to %{node_name} failed', args),
```

**File**: `internal/cert/auto_cert.go` (modified, +1/-0)
```diff
@@ -120,6 +120,7 @@ func autoCert(certModel *model.Cert) {
 	}
 
 	updateAutoRenewStatus(certModel, now, "")
+	notifyCertificateRelocated(targetName, certModel.SSLCertificatePath, payload.GetCertificatePath())
 	notification.Success("Renew Certificate Success", "Certificate %{name} renewed successfully", map[string]any{
 		"name": targetName,
 	})
```

**File**: `internal/cert/certificate_dir_test.go` (added, +102/-0)
```diff
@@ -0,0 +1,102 @@
+package cert
+
+import (
+	"fmt"
+	"os"
+	"path/filepath"
+	"strings"
+	"testing"
+
+	"github.com/go-acme/lego/v5/certcrypto"
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+)
+
+// longIdentifierList returns count subdomains of domain whose joined directory
+// name is well beyond the file name limit, like the list in issue #2001.
+func longIdentifierList(domain string, count int) []string {
+	identifiers := make([]string, 0, count)
+	for i := range count {
+		identifiers = append(identifiers, fmt.Sprintf("service-%02d-subdomain.%s", i, domain))
+	}
+	return identifiers
+}
+
+func TestCertificateDirNameKeepsShortListsUnchanged(t *testing.T) {
+	got := certificateDirName([]string{"example.com", "www.example.com"}, certcrypto.EC256)
+	assert.Equal(t, "example.com_www.example.com_EC256", got)
+}
+
+func TestCertificateDirNameBoundsLongLists(t *testing.T) {
+	first := longIdentifierList("example.com", 12)
+	second := longIdentifierList("example.net", 12)
+	require.Greater(t, len(strings.Join(first, "_")), maxCertificateDirNameLength,
+		"test premise: the joined list must exceed the file name limit")
+
+	firstName := certificateDirName(first, certcrypto.EC256)
+	secondName := certificateDirName(second, certcrypto.EC256)
+
+	assert.LessOrEqual(t, len(firstName), maxCertificateDirNameLength)
+	assert.True(t, strings.HasPrefix(firstName, first[0]+"_"), firstName)
+	assert.True(t, strings.HasSuffix(firstName, "_EC256"), firstName)
+	assert.Equal(t, firstName, certificateDirName(first, certcrypto.EC256), "the name must be stable")
+	assert.NotEqual(t, firstName, secondName)
+	assert.NotEqual(t, firstName, certificateDirName(first[:11], certcrypto.EC256),
+		"lists sharing the first identifier must not collide")
+}
+
+func TestCertificateDirNameBoundsSingleLongIdentifier(t *testing.T) {
+	label := strings.Repeat("a", 63)
+	identifier := strings.Join([]string{label, label, label, label[:57], "com"}, ".")
+	require.Len(t, identifier, 253, "test premise: the longest valid domain name")
+
+	got := certificateDirName([]string{identifier}, certcrypto.RSA2048)
+	assert.LessOrEqual(t, len(got), maxCertificateDirNameLength)
+	assert.True(t, strings.HasSuffix(got, "_RSA2048"), got)
+}
+
+// TestCertificatePathsOfLongListsStayApart is the regression test for issue
+// #2001: two certificates with long identifier lists both resolved to
+// fullchain.cer and private.key in the nginx configuration directory and
+// overwrote each other.
+func TestCertificatePathsOfLongListsStayApart(t *testing.T) {
+	confDir := useTempNginxConfDir(t)
+	sslDir := filepath.Join(confDir, "ssl")
+
+	first := &ConfigPayload{ServerName: longIdentifierList("example.com", 12), KeyType: certcrypto.EC256}
+	second := &ConfigPayload{ServerName: longIdentifierList("example.net", 12), KeyType: certcrypto.EC256}
+
+	for _, payload := range []*ConfigPayload{first, second} {
+		assert.Equal(t, sslDir, filepath.Dir(payload.getCertificateDirPath()))
+		assert.False(t, IsConfRootCertificatePath(payload.GetCertificatePath()), payload.GetCertificatePath())
+		require.NoError(t, payload.mkCertificateDir())
+	}
+	assert.NotEqual(t, first.GetCertificatePath(), second.GetCertificatePath())
+	assert.NotEqual(t, first.GetCertificateKeyPath(), second.GetCertificateKeyPath())
+}
+
+func TestMkCertificateDirRefusesTheConfigurationDirectory(t *testing.T) {
+	confDir := useTempNginxConfDir(t)
+
+	payload := &ConfigPayload{CertificateDir: confDir}
+	assert.ErrorIs(t, payload.mkCertificateDir(), errCertificateDirIsConfRoot)
+}
+
+// TestUseExistingCertificatePathsIgnoresSharedConfRootFiles covers records
+// written before the fix: they point at the files shared in the configuration
+// directory, and pinning them would keep the certificates overwriting each
+// other, so the renewal moves to the certificate's own directory instead.
+func TestUseExistingCertificatePathsIgnoresSharedConfRootFiles(t *testing.T) {
+	confDir := useTempNginxConfDir(t)
+	certPath := filepath.Join(confDir, "fullchain.cer")
+	keyPath := filepath.Join(confDir, "private.key")
+	require.NoError(t, os.WriteFile(certPath, []byte("shared"), 0o644))
+	require.NoError(t, os.WriteFile(keyPath, []byte("shared"), 0o600))
+
+	payload := &ConfigPayload{ServerName: longIdentifierList("example.com", 12), KeyType: certcrypto.EC256}
+	payload.UseExistingCertificatePaths(certPath, keyPath)
+
+	assert.Empty(t, payload.SSLCertificatePath)
+	assert.Empty(t, payload.SSLCertificateKeyPath)
+	assert.Equal(t, filepath.Join(confDir, "ssl"), filepath.Dir(payload.getCertificateDirPath()))
+}
```

**File**: `internal/cert/issue_record.go` (modified, +1/-0)
```diff
@@ -219,6 +219,7 @@ func IssueWithRecord(name string, payload *ConfigPayload, log *Logger) (*model.C
 	}
 
 	MarkCertSuccess(certModel.ID, payload.GetCertificatePath(), payload.GetCertificateKeyPath(), payload.Resource, payload.Profile)
+	notifyCertificateRelocated(getAutoRenewTargetName(certModel), certModel.SSLCertificatePath, payload.GetCertificatePath())
 	return certModel, nil
 }
 
```

**File**: `internal/cert/payload.go` (modified, +74/-1)
```diff
@@ -1,13 +1,17 @@
 package cert
 
 import (
+	"crypto/sha256"
+	"encoding/hex"
+	"errors"
 	"os"
 	"path/filepath"
 	"strings"
 	"time"
 
 	"github.com/0xJacky/Nginx-UI/internal/helper"
 	"github.com/0xJacky/Nginx-UI/internal/nginx"
+	"github.com/0xJacky/Nginx-UI/internal/notification"
 	"github.com/0xJacky/Nginx-UI/internal/translation"
 	"github.com/0xJacky/Nginx-UI/model"
 	"github.com/0xJacky/Nginx-UI/query"
@@ -16,6 +20,15 @@ import (
 	"github.com/uozi-tech/cosy/logger"
 )
 
+// maxCertificateDirNameLength is the file name limit (NAME_MAX) of common file
+// systems. A derived certificate directory name must stay within it.
+const maxCertificateDirNameLength = 255
+
+// errCertificateDirIsConfRoot refuses to write certificate files straight into
+// the nginx configuration directory. Every certificate would share the same
+// fullchain.cer and private.key there and overwrite each other.
+var errCertificateDirIsConfRoot = errors.New("certificate directory resolves to the nginx configuration directory")
+
 type ConfigPayload struct {
 	ConfigName                        string                     `json:"-"`
 	CertID                            uint64                     `json:"cert_id"`
@@ -62,6 +75,9 @@ func (c *ConfigPayload) GetKeyType() certcrypto.KeyType {
 // filesystem, which is the remote host in host_via_ssh + sftp mode.
 func (c *ConfigPayload) mkCertificateDir() (err error) {
 	dir := c.getCertificateDirPath()
+	if isConfRootCertificateDir(dir) {
+		return errCertificateDirIsConfRoot
+	}
 	exists, err := nginx.Exists(dir)
 	if err != nil {
 		return err
@@ -110,6 +126,12 @@ func (c *ConfigPayload) UseExistingCertificatePaths(certificatePath, certificate
 		!helper.IsUnderDirectory(certificateKeyPath, nginxConfPath) {
 		return
 	}
+	// Files directly in the configuration directory come from a derived name
+	// that exceeded the file name limit, so every such certificate shares
+	// them. Reusing them would keep the certificates overwriting each other.
+	if IsConfRootCertificatePath(certificatePath) || IsConfRootCertificatePath(certificateKeyPath) {
+		return
+	}
 
 	c.SSLCertificatePath = certificatePath
 	c.SSLCertificateKeyPath = certificateKeyPath
@@ -197,10 +219,48 @@ func (c *ConfigPayload) getCertificateDirPath() string {
 		c.CertificateDir = filepath.Dir(c.SSLCertificatePath)
 		return c.CertificateDir
 	}
-	c.CertificateDir = nginx.GetConfPath("ssl", strings.Join(c.ServerName, "_")+"_"+string(c.GetKeyType()))
+	c.CertificateDir = nginx.GetConfPath("ssl", certificateDirName(c.ServerName, c.GetKeyType()))
 	return c.CertificateDir
 }
 
+// certificateDirName derives the directory name of a certificate from its
+// identifiers and key type. A long identifier list would exceed the file name
+// limit, which made the path check fail and the certificate land in the nginx
+// configuration directory, shared with every other such certificate. Such
+// lists keep the first identifier and replace the rest with a digest of the
+// whole list, so the name stays unique and keeps the key type suffix that the
+// legacy path migration relies on.
+func certificateDirName(identifiers []string, keyType certcrypto.KeyType) string {
+	suffix := "_" + string(keyType)
+	joined := strings.Join(identifiers, "_")
+	if len(joined)+len(suffix) <= maxCertificateDirNameLength {
+		return joined + suffix
+	}
+
+	sum := sha256.Sum256([]byte(joined))
+	digest := "_" + hex.EncodeToString(sum[:8])
+	prefix := ""
+	if len(identifiers) > 0 {
+		prefix = identifiers[0]
+	}
+	if limit := maxCertificateDirNameLength - len(digest) - len(suffix); len(prefix) > limit {
+		prefix = strings.ToValidUTF8(prefix[:limit], "")
+	}
+	return prefix + digest + suffix
+}
+
+// isConfRootCertificateDir reports whether dir is the nginx configuration
+// directory itself.
+func isConfRootCertificateDir(dir string) bool {
+	return filepath.Clean(dir) == filepath.Clean(nginx.GetConfPath())
+}
+
+// IsConfRootCertificatePath reports whether a certificate or key file sits
+// directly in the nginx configuration directory.
+func IsConfRootCertificatePath(path string) bool {
+	return path != "" && isConfRootCertificateDir(filepath.Dir(path))
+}
+
 func (c *ConfigPayload) GetCertificatePath() string {
 	if c.SSLCertificatePath != "" {
 		return c.SSLCertificatePath
@@ -216,3 +276,16 @@ func (c *ConfigPayload) GetCertificateKeyPath() string {
 	c.SSLCertificateKeyPath = filepath.Join(c.getCertificateDirPath(), "private.key")
 	return c.SSLCertificateKeyPath
 }
+
+// notifyCertificateRelocated warns when a certificate that used the shared files
+// in the nginx configuration directory was written to its own directory. The
+// sites still load the shared files, which no renewal updates any more, and
+// only the user knows which of them belong to this certificate.
+func notifyCertificateRelocated(name, previousPath, currentPath string) {
+	if !IsConfRootCertificatePath(previousPath) || filepath.Clean(previousPath) == filepath.Clean(currentPath) {
+		
```

---

### Incident Patch 6: `f3a368d2` (2026-10-05)
**Commit Message**: fix(cert): migrate shared certificates and wait for renewal before expiry notices

Sites that load a wildcard certificate issued from the certificate page
kept serving the legacy key type path (for example *_P256) after renewal
had moved the files to the canonical *_EC256 directory. The legacy path
migration only inspected the site named after the certificate record, so
these sites never migrated and expired silently. The migration now also
rewrites every enabled site that references a record's legacy path, as
long as no live record still owns that path and the certificate covers
the site's server names.

Expiry notices for auto-renewed certificates now stay quiet until less
validity is left than the renewal threshold, and are sent right away once
it is, instead of announcing an expiry the renewal job was about to
prevent. Certificates without auto renewal keep the fixed thresholds.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `internal/cert/check_expired.go` (modified, +15/-0)
```diff
@@ -7,6 +7,7 @@ import (
 	"github.com/0xJacky/Nginx-UI/internal/notification"
 	"github.com/0xJacky/Nginx-UI/model"
 	"github.com/0xJacky/Nginx-UI/query"
+	"github.com/0xJacky/Nginx-UI/settings"
 	"github.com/uozi-tech/cosy/logger"
 )
 
@@ -76,6 +77,20 @@ func buildExpiryNotification(certModel *model.Cert, info *Info, now time.Time) *
 		stage = shortLivedExpiryStage(info.NotAfter.Sub(info.NotBefore), remaining)
 	} else {
 		stage = standardExpiryStage(remaining)
+		if certModel.AutoCert == model.AutoCertEnabled {
+			renewAt := certificateRenewalTime(info, settings.CertSettings.GetCertRenewalInterval())
+			if !renewAt.IsZero() {
+				// The fixed thresholds would announce an expiry that the renewal
+				// job is about to prevent. Stay quiet until less validity is left
+				// than the renewal threshold, then report it right away.
+				if !now.After(renewAt) {
+					return nil
+				}
+				if stage == "" {
+					stage = expiryStageNotice
+				}
+			}
+		}
 	}
 	if stage == "" || expiryNotificationAlreadySent(certModel, info.NotAfter, stage) {
 		return nil
```

**File**: `internal/cert/check_expired_test.go` (modified, +61/-0)
```diff
@@ -5,6 +5,7 @@ import (
 	"time"
 
 	"github.com/0xJacky/Nginx-UI/model"
+	"github.com/0xJacky/Nginx-UI/settings"
 )
 
 func TestBuildExpiryNotificationUsesShortLivedThresholds(t *testing.T) {
@@ -134,3 +135,63 @@ func TestBuildExpiryNotificationUsesOrderedStandardThresholds(t *testing.T) {
 		}
 	}
 }
+
+func TestBuildExpiryNotificationWaitsForAutoRenewalThreshold(t *testing.T) {
+	originalInterval := settings.CertSettings.RenewalInterval
+	t.Cleanup(func() { settings.CertSettings.RenewalInterval = originalInterval })
+
+	notBefore := time.Date(2026, time.July, 1, 0, 0, 0, 0, time.UTC)
+	info := &Info{NotBefore: notBefore, NotAfter: notBefore.Add(90 * 24 * time.Hour)}
+	certModel := &model.Cert{Name: "*.example.com", AutoCert: model.AutoCertEnabled}
+
+	tests := []struct {
+		name      string
+		interval  int
+		remaining time.Duration
+		stage     expiryNotificationStage
+	}{
+		{name: "not due under a 7 day threshold", interval: 7, remaining: 14 * 24 * time.Hour},
+		{name: "exactly at the 7 day threshold", interval: 7, remaining: 7 * 24 * time.Hour},
+		{name: "below the 7 day threshold", interval: 7, remaining: 6 * 24 * time.Hour,
+			stage: expiryStageWarning},
+		{name: "not due under a 30 day threshold", interval: 30, remaining: 31 * 24 * time.Hour},
+		{name: "overdue before the fixed thresholds", interval: 30, remaining: 29 * 24 * time.Hour,
+			stage: expiryStageNotice},
+		{name: "overdue keeps escalating", interval: 30, remaining: 3 * 24 * time.Hour,
+			stage: expiryStageUrgent},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			settings.CertSettings.RenewalInterval = tt.interval
+			notice := buildExpiryNotification(certModel, info, info.NotAfter.Add(-tt.remaining))
+			if tt.stage == "" {
+				if notice != nil {
+					t.Fatalf("notice = %+v, want nil", notice)
+				}
+				return
+			}
+			if notice == nil || notice.Stage != tt.stage {
+				t.Fatalf("notice = %+v, want stage %q", notice, tt.stage)
+			}
+		})
+	}
+}
+
+func TestBuildExpiryNotificationKeepsFixedThresholdsWithoutAutoRenewal(t *testing.T) {
+	originalInterval := settings.CertSettings.RenewalInterval
+	t.Cleanup(func() { settings.CertSettings.RenewalInterval = originalInterval })
+	settings.CertSettings.RenewalInterval = 7
+
+	notBefore := time.Date(2026, time.July, 1, 0, 0, 0, 0, time.UTC)
+	info := &Info{NotBefore: notBefore, NotAfter: notBefore.Add(90 * 24 * time.Hour)}
+	now := info.NotAfter.Add(-14 * 24 * time.Hour)
+
+	for _, autoCert := range []int{model.AutoCertDisabled, model.AutoCertSync, model.AutoCertPaused} {
+		certModel := &model.Cert{Name: "imported.example.com", AutoCert: autoCert}
+		notice := buildExpiryNotification(certModel, info, now)
+		if notice == nil || notice.Stage != expiryStageNotice {
+			t.Fatalf("auto_cert %d: notice = %+v, want notice", autoCert, notice)
+		}
+	}
+}
```

**File**: `internal/site/certificate_migration.go` (modified, +144/-11)
```diff
@@ -255,19 +255,12 @@ func MigrateLegacyCertificatePaths() (CertificateMigrationResult, error) {
 
 	targetsByPath := make(map[string]certificateMigrationTarget)
 	legacyCerts := make(map[uint64]*model.Cert)
-	for _, certModel := range certModels {
-		inspection := inspectCertificateDeployment(certModel)
-		switch inspection.status.State {
-		case CertificateDeploymentMismatch:
-			notifyCertificateDeploymentMismatch(certModel, inspection.status)
-		case CertificateDeploymentConsistent, CertificateDeploymentNotApplicable:
-			clearCertificateDeploymentIssue(certModel)
-		}
-		if inspection.status.State != CertificateDeploymentLegacyDrift {
-			continue
+	addTargets := func(certModel *model.Cert, targets []certificateMigrationTarget) {
+		if len(targets) == 0 {
+			return
 		}
 		legacyCerts[certModel.ID] = certModel
-		for _, target := range inspection.targets {
+		for _, target := range targets {
 			existing := targetsByPath[target.path]
 			if existing.path == "" {
 				existing.path = target.path
@@ -278,6 +271,29 @@ func MigrateLegacyCertificatePaths() (CertificateMigrationResult, error) {
 			targetsByPath[target.path] = existing
 		}
 	}
+
+	managedPaths, err := managedCertificatePaths()
+	if err != nil {
+		return result, err
+	}
+	configFiles, err := enabledSiteConfigFiles()
+	if err != nil {
+		logger.Warnf("List enabled sites for certificate path migration: %v", err)
+	}
+
+	for _, certModel := range certModels {
+		inspection := inspectCertificateDeployment(certModel)
+		switch inspection.status.State {
+		case CertificateDeploymentMismatch:
+			notifyCertificateDeploymentMismatch(certModel, inspection.status)
+		case CertificateDeploymentConsistent, CertificateDeploymentNotApplicable:
+			clearCertificateDeploymentIssue(certModel)
+		}
+		if inspection.status.State == CertificateDeploymentLegacyDrift {
+			addTargets(certModel, inspection.targets)
+		}
+		addTargets(certModel, sharedLegacyReferenceTargets(certModel, configFiles, managedPaths))
+	}
 	if len(targetsByPath) == 0 {
 		return result, nil
 	}
@@ -348,6 +364,123 @@ func MigrateLegacyCertificatePaths() (CertificateMigrationResult, error) {
 	return result, nil
 }
 
+// siteConfigFile is a configuration file that a locally enabled site loads.
+type siteConfigFile struct {
+	siteName string
+	path     string
+}
+
+// enabledSiteConfigFiles lists the configuration files of every locally
+// enabled site, including the generated maintenance file of a site in
+// maintenance. Remote deploy sites are left out because their files never
+// reach the local nginx.
+func enabledSiteConfigFiles() ([]siteConfigFile, error) {
+	entries, err := nginx.ReadDir(nginx.GetConfPath("sites-available"))
+	if err != nil {
+		return nil, err
+	}
+
+	files := make([]siteConfigFile, 0, len(entries))
+	for _, entry := range entries {
+		name := entry.Name()
+		if entry.IsDir() || validateSiteName(name) != nil || certificateSiteIsRemoteDeploy(name) {
+			continue
+		}
+		paths, pathErr := certificateDeploymentConfigPaths(name)
+		if pathErr != nil {
+			logger.Warnf("Resolve configuration of site %s: %v", name, pathErr)
+			continue
+		}
+		for _, path := range paths {
+			files = append(files, siteConfigFile{siteName: name, path: path})
+		}
+	}
+	return files, nil
+}
+
+// managedCertificatePaths returns the certificate paths that a live record
+// still owns, whatever its renewal mode.
+func managedCertificatePaths() (map[string]struct{}, error) {
+	c := query.Cert
+	certModels, err := c.Select(c.SSLCertificatePath).Where(c.SSLCertificatePath.Neq("")).Find()
+	if err != nil {
+		return nil, err
+	}
+	paths := make(map[string]struct{}, len(certModels))
+	for _, certModel := range certModels {
+		paths[filepath.Clean(certModel.SSLCertificatePath)] = struct{}{}
+	}
+	return paths, nil
+}
+
+// sharedLegacyReferenceTargets finds the sites that load a certificate through
+// its legacy key type path although the record is named after something else,
+// typically a wildcard certificate issued from the certificate page and shared
+// by several sites. inspectCertificateDeployment only looks at the site named
+// after the record, so these sites kept serving the legacy files after the
+// renewal had moved to the canonical path.
+func sharedLegacyReferenceTargets(certModel *model.Cert, files []siteConfigFile,
+	managedPaths map[string]struct{}) []certificateMigrationTarget {
+	if certModel == nil || certModel.SSLCertificatePath == "" || certModel.SSLCertificateKeyPath == "" {
+		return nil
+	}
+	legacyCertPath, legacyKeyPath, hasLegacyAlias := legacyCertificatePaths(certModel)
+	if !hasLegacyAlias {
+		return nil
+	}
+	// Another record still renews the legacy files, so the sites loading them
+	// are not left behind.
+	if _, managed := managedPaths[filepath.Clean(legacyCertPath)]; managed {
+		return nil
+	}
+	if containsPathOrSameFile([]string{legacyCertPath}, certModel.SSLCertificatePath) &&
+		containsPathOrSameFile([]string{legacyKeyPath}, certModel.SSLCertifica
```

**File**: `internal/site/certificate_migration_test.go` (modified, +162/-0)
```diff
@@ -448,3 +448,165 @@ func TestInspectCertificateDeploymentTreatsSymlinkedManagedFilesAsConsistent(t *
 		t.Fatalf("deployment status = %+v", status)
 	}
 }
+
+func (env certificateMigrationTestEnv) addSharedCertificate(t *testing.T, name string,
+	dnsNames []string) (*model.Cert, string, string) {
+	t.Helper()
+
+	managedDir := filepath.Join(env.confDir, "ssl", name+"_"+string(certcrypto.EC256))
+	if err := os.MkdirAll(managedDir, 0o755); err != nil {
+		t.Fatalf("create managed cert dir: %v", err)
+	}
+	certPEM, keyPEM, err := cert.GenerateSelfSigned(cert.SelfSignedOptions{
+		CommonName: dnsNames[0],
+		DNSNames:   dnsNames,
+		KeyType:    certcrypto.EC256,
+	})
+	if err != nil {
+		t.Fatalf("generate certificate: %v", err)
+	}
+	managedCertPath := filepath.Join(managedDir, "fullchain.cer")
+	managedKeyPath := filepath.Join(managedDir, "private.key")
+	if err = os.WriteFile(managedCertPath, certPEM, 0o644); err != nil {
+		t.Fatalf("write certificate: %v", err)
+	}
+	if err = os.WriteFile(managedKeyPath, keyPEM, 0o600); err != nil {
+		t.Fatalf("write private key: %v", err)
+	}
+
+	certModel := &model.Cert{
+		Name:                  name,
+		Filename:              name,
+		Domains:               dnsNames,
+		AutoCert:              model.AutoCertEnabled,
+		ChallengeMethod:       model.CertChallengeMethodDNS01,
+		KeyType:               certcrypto.EC256,
+		SSLCertificatePath:    managedCertPath,
+		SSLCertificateKeyPath: managedKeyPath,
+		Status:                model.CertStatusSuccess,
+	}
+	if err = env.db.Create(certModel).Error; err != nil {
+		t.Fatalf("create cert model: %v", err)
+	}
+
+	legacyDir := filepath.Join(env.confDir, "ssl", name+"_P256")
+	return certModel, filepath.Join(legacyDir, "fullchain.cer"), filepath.Join(legacyDir, "private.key")
+}
+
+func (env certificateMigrationTestEnv) addSiteUsingCertificate(t *testing.T, siteName, serverName,
+	certPath, keyPath string, enabled bool) string {
+	t.Helper()
+
+	configPath := filepath.Join(env.confDir, "sites-available", siteName)
+	content := fmt.Sprintf(`server {
+    listen 443 ssl;
+    server_name %s;
+    ssl_certificate %s;
+    ssl_certificate_key %s;
+}
+`, serverName, certPath, keyPath)
+	if err := os.WriteFile(configPath, []byte(content), 0o644); err != nil {
+		t.Fatalf("write site config: %v", err)
+	}
+	if enabled {
+		if err := os.Symlink(configPath, filepath.Join(env.confDir, "sites-enabled", siteName)); err != nil {
+			t.Fatalf("enable site: %v", err)
+		}
+	}
+	return configPath
+}
+
+func readSiteConfig(t *testing.T, path string) string {
+	t.Helper()
+	content, err := os.ReadFile(path)
+	if err != nil {
+		t.Fatalf("read site config: %v", err)
+	}
+	return string(content)
+}
+
+func TestMigrateLegacyCertificatePathsRewritesSitesSharingWildcardCertificate(t *testing.T) {
+	env := setupCertificateMigrationTest(t)
+	certModel, legacyCertPath, legacyKeyPath := env.addSharedCertificate(t, "*.example.com",
+		[]string{"*.example.com", "example.com"})
+	apexConfig := env.addSiteUsingCertificate(t, "example.com", "example.com",
+		legacyCertPath, legacyKeyPath, true)
+	appConfig := env.addSiteUsingCertificate(t, "app.example.com", "app.example.com",
+		legacyCertPath, legacyKeyPath, true)
+
+	result, err := MigrateLegacyCertificatePaths()
+	if err != nil {
+		t.Fatalf("MigrateLegacyCertificatePaths() error = %v", err)
+	}
+	if result.MigratedFiles != 2 || result.MigratedSites != 2 || result.SkippedFiles != 0 {
+		t.Fatalf("migration result = %+v", result)
+	}
+	for _, path := range []string{apexConfig, appConfig} {
+		content := readSiteConfig(t, path)
+		if !strings.Contains(content, "ssl_certificate "+certModel.SSLCertificatePath+";") ||
+			!strings.Contains(content, "ssl_certificate_key "+certModel.SSLCertificateKeyPath+";") ||
+			strings.Contains(content, "_P256") {
+			t.Fatalf("migrated config %s =\n%s", path, content)
+		}
+	}
+
+	second, err := MigrateLegacyCertificatePaths()
+	if err != nil {
+		t.Fatalf("second migration error = %v", err)
+	}
+	if second.MigratedFiles != 0 || second.MigratedSites != 0 {
+		t.Fatalf("second migration result = %+v", second)
+	}
+}
+
+func TestMigrateLegacyCertificatePathsKeepsSharedLegacyPathOwnedByAnotherRecord(t *testing.T) {
+	env := setupCertificateMigrationTest(t)
+	_, legacyCertPath, legacyKeyPath := env.addSharedCertificate(t, "*.owned.example.com",
+		[]string{"*.owned.example.com"})
+	configPath := env.addSiteUsingCertificate(t, "app.owned.example.com", "app.owned.example.com",
+		legacyCertPath, legacyKeyPath, true)
+	owner := &model.Cert{
+		Name:                  "legacy owner",
+		AutoCert:              model.AutoCertSync,
+		SSLCertificatePath:    legacyCertPath,
+		SSLCertificateKeyPath: legacyKeyPath,
+	}
+	if err := env.db.Create(owner).Error; err != nil {
+		t.Fatalf("create legacy owner: %v", err)
+	}
+	before := readSiteConfig(t, configPath)
+
+	result, err := MigrateLegacyCertificatePaths()
+	if err != nil {
+		t.Fatalf("MigrateLegacyCertificatePaths() error = %v",
```

---

### Incident Patch 7: `a52a8cf4` (2026-10-05)
**Commit Message**: Merge remote-tracking branch 'origin/dev' into pr-1999-fix

**File**: `app/i18n.json` (modified, +2/-1)
```diff
@@ -12,5 +12,6 @@
   "ar": "عَرَبِيّ",
   "uk_UA": "Uk",
   "ja_JP": "Ja",
-  "pt_PT": "Pt"
+  "pt_PT": "Pt",
+  "it_IT": "It"
 }
```

**File**: `app/src/components/CertInfo/CertInfo.vue` (modified, +12/-34)
```diff
@@ -44,22 +44,17 @@ async function copyToClipboard(text: string, label: string) {
       <slot name="extra" />
     </template>
     <div class="name-with-copy">
-      <div class="name-primary">
-        <p class="mb-0 name-text">
-          {{ $gettext('Name: %{name}', { name: cert.subject_name }) }}
-        </p>
-        <AButton
-          v-if="cert.subject_name"
-          type="text"
-          size="small"
-          @click="copyToClipboard(cert.subject_name, $gettext('Name'))"
-        >
-          <CopyOutlined />
-        </AButton>
-      </div>
-      <div class="name-extra-actions">
-        <slot name="name-extra" />
-      </div>
+      <p class="mb-0">
+        {{ $gettext('Name: %{name}', { name: cert.subject_name }) }}
+      </p>
+      <AButton
+        v-if="cert.subject_name"
+        type="text"
+        size="small"
+        @click="copyToClipboard(cert.subject_name, $gettext('Name'))"
+      >
+        <CopyOutlined />
+      </AButton>
     </div>
     <p>
       {{ $gettext('Status:') }}
@@ -133,26 +128,9 @@ async function copyToClipboard(text: string, label: string) {
 <style scoped lang="less">
 .name-with-copy {
   display: flex;
-  align-items: flex-start;
-  justify-content: space-between;
-  gap: 8px;
-}
-
-.name-text {
-  margin-right: 2px;
-}
-
-.name-primary {
-  display: inline-flex;
-  align-items: center;
-  gap: 6px;
-}
-
-.name-extra-actions {
-  display: inline-flex;
   align-items: center;
   gap: 6px;
-  flex-shrink: 0;
+  margin-bottom: 1em;
 }
 
 .path-with-copy {
```

**File**: `app/src/composables/useGeoTranslation.ts` (modified, +4/-1)
```diff
@@ -4,6 +4,7 @@ import de from 'i18n-iso-countries/langs/de.json'
 import en from 'i18n-iso-countries/langs/en.json'
 import es from 'i18n-iso-countries/langs/es.json'
 import fr from 'i18n-iso-countries/langs/fr.json'
+import it from 'i18n-iso-countries/langs/it.json'
 import ja from 'i18n-iso-countries/langs/ja.json'
 import ko from 'i18n-iso-countries/langs/ko.json'
 import pt from 'i18n-iso-countries/langs/pt.json'
@@ -28,6 +29,7 @@ countries.registerLocale(ar)
 countries.registerLocale(uk)
 countries.registerLocale(ja)
 countries.registerLocale(pt)
+countries.registerLocale(it)
 
 export interface GeoData {
   code: string
@@ -60,6 +62,7 @@ export function useGeoTranslation() {
       uk_UA: 'uk',
       ja_JP: 'ja',
       pt_PT: 'pt',
+      it_IT: 'it',
     }
     return langMap[settingsLang] || 'en'
   }
@@ -81,7 +84,7 @@ export function useGeoTranslation() {
     }
     // Map other browser languages to supported codes
     const browserLangCode = browserLocale.split('-')[0]
-    const supportedLangs = ['fr', 'es', 'de', 'ru', 'vi', 'ko', 'tr', 'ar', 'uk', 'ja', 'pt']
+    const supportedLangs = ['fr', 'es', 'de', 'ru', 'vi', 'ko', 'tr', 'ar', 'uk', 'ja', 'pt', 'it']
     if (supportedLangs.includes(browserLangCode)) {
       return browserLangCode
     }
```

**File**: `app/src/language/LINGUAS` (modified, +1/-1)
```diff
@@ -1 +1 @@
-en zh_CN zh_TW fr_FR es de_DE ru_RU vi_VN ko_KR tr_TR ar uk_UA ja_JP pt_PT
\ No newline at end of file
+en zh_CN zh_TW fr_FR es de_DE ru_RU vi_VN ko_KR tr_TR ar uk_UA ja_JP pt_PT it_IT
\ No newline at end of file
```

**File**: `app/src/language/ar.po` (modified, +6/-0)
```diff
@@ -4656,6 +4656,9 @@ msgstr "تم تنزيل ملفات الشهادة بنجاح"
 msgid "Failed to download certificate files"
 msgstr "فشل تنزيل ملفات الشهادة"
 
+msgid "Download"
+msgstr "تنزيل"
+
 msgid "Download Certificate Files"
 msgstr "تنزيل ملفات الشهادة"
 
@@ -4826,6 +4829,9 @@ msgstr "لتأكيد الإلغاء، يرجى كتابة \"إلغاء\" في ا
 msgid "Renew successfully"
 msgstr "تم التجديد بنجاح"
 
+msgid "Renew"
+msgstr "تجديد"
+
 msgid "Renew Certificate"
 msgstr "تجديد الشهادة"
 
```

**File**: `app/src/language/de_DE.po` (modified, +6/-0)
```diff
@@ -4903,6 +4903,9 @@ msgstr "Zertifikatsdateien erfolgreich heruntergeladen"
 msgid "Failed to download certificate files"
 msgstr "Herunterladen der Zertifikatsdateien fehlgeschlagen"
 
+msgid "Download"
+msgstr "Herunterladen"
+
 msgid "Download Certificate Files"
 msgstr "Zertifikatsdateien herunterladen"
 
@@ -5079,6 +5082,9 @@ msgstr ""
 msgid "Renew successfully"
 msgstr "Erfolgreich erneuert"
 
+msgid "Renew"
+msgstr "Erneuern"
+
 msgid "Renew Certificate"
 msgstr "Zertifikat erneuern"
 
```

**File**: `app/src/language/en.po` (modified, +6/-0)
```diff
@@ -4446,6 +4446,9 @@ msgstr ""
 msgid "Failed to download certificate files"
 msgstr ""
 
+msgid "Download"
+msgstr ""
+
 msgid "Download Certificate Files"
 msgstr ""
 
@@ -4610,6 +4613,9 @@ msgstr ""
 msgid "Renew successfully"
 msgstr ""
 
+msgid "Renew"
+msgstr ""
+
 msgid "Renew Certificate"
 msgstr ""
 
```

**File**: `app/src/language/es.po` (modified, +6/-0)
```diff
@@ -4880,6 +4880,9 @@ msgstr "Archivos de certificado descargados correctamente"
 msgid "Failed to download certificate files"
 msgstr "Error al descargar los archivos del certificado"
 
+msgid "Download"
+msgstr "Descargar"
+
 msgid "Download Certificate Files"
 msgstr "Descargar archivos de certificado"
 
@@ -5053,6 +5056,9 @@ msgstr ""
 msgid "Renew successfully"
 msgstr "Renovado con éxito"
 
+msgid "Renew"
+msgstr "Renovar"
+
 msgid "Renew Certificate"
 msgstr "Renovar Certificado"
 
```

---

### Incident Patch 8: `e95a6e66` (2026-10-05)
**Commit Message**: fix(backup): skip retention cleanup when another task shares the file names

Backup file names come from the sanitized task name, so tasks such as
"web prod" and "web/prod", or a custom directory task "web" and a task named
"custom_dir_web", write backups that the retention policy cannot tell apart.
Pruning one of them in a shared storage path would delete the other task's
backups. The task now skips the cleanup and sends a warning notification
until one of the tasks is renamed or moved.

Also keep deleting the remaining S3 objects when one deletion fails, shorten
the table column title, and document shared names, renamed tasks and
versioned buckets in all three languages.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `app/src/api/backup.ts` (modified, +1/-1)
```diff
@@ -52,7 +52,7 @@ export interface AutoBackup extends ModelBase {
   storage_path: string
   cron_expression: string
   enabled: boolean
-  retention_count?: number
+  retention_count: number
   last_backup_time?: string
   last_backup_status: 'pending' | 'success' | 'failed'
   last_backup_error?: string
```

**File**: `app/src/components/Notification/notifications.ts` (modified, +4/-0)
```diff
@@ -37,6 +37,10 @@ const notifications: Record<string, { title: () => string, content: (args: any)
     title: () => $gettext('Auto Backup Completed'),
     content: (args: any) => $gettext('Backup task %{backup_name} completed successfully, file: %{file_path}', args),
   },
+  'Auto Backup Retention Skipped': {
+    title: () => $gettext('Auto Backup Retention Skipped'),
+    content: (args: any) => $gettext('Old backups of task %{backup_name} were not deleted because task %{conflict_names} writes backups with the same file names to the same storage location. Rename one of the tasks or change its storage path.', args),
+  },
   'Renew Certificate Success': {
     title: () => $gettext('Renew Certificate Success'),
     content: (args: any) => $gettext('Certificate %{name} renewed successfully', args),
```

**File**: `app/src/views/backup/AutoBackup/AutoBackup.vue` (modified, +4/-1)
```diff
@@ -186,7 +186,7 @@ const columns: StdTableColumn[] = [
     pure: true,
   },
   {
-    title: () => $gettext('Backups to Keep (0 keeps all)'),
+    title: () => $gettext('Backups to Keep'),
     dataIndex: 'retention_count',
     customRender: ({ text }: CustomRenderArgs) => {
       return text > 0 ? text : $gettext('All')
@@ -198,6 +198,9 @@ const columns: StdTableColumn[] = [
         precision: 0,
         defaultValue: 0,
       },
+      formItem: {
+        label: () => $gettext('Backups to Keep (0 keeps all)'),
+      },
     },
     pure: true,
   },
```

**File**: `docs/guide/config-backup.md` (modified, +4/-1)
```diff
@@ -110,7 +110,10 @@ By default, every run of an automatic backup task adds a new backup file and old
 - **Default**: `0` keeps all backups
 - **Limit**: A positive number keeps only that many of the newest backups after each successful run and deletes the older ones. A backup that has an encryption key file is deleted together with its `.key` file
 - **Storage**: Works for both local and S3 storage
-- **Scope**: Only files that follow the task's naming scheme (`<name>_<timestamp>.zip`, or `custom_dir_<name>_<timestamp>.zip` for custom directory backups) directly inside the storage path are considered. Other files are left alone, so give each task its own name or storage path
+- **Scope**: Only files that follow the task's naming scheme (`<name>_<timestamp>.zip`, or `custom_dir_<name>_<timestamp>.zip` for custom directory backups) directly inside the storage path are considered. Other files are left alone. Characters that are not allowed in file names are replaced with `_` in `<name>`
+- **Shared names**: If another task writes backups with the same file names to the same storage path (for example `web prod` and `web/prod`, or a custom directory task `web` and a task named `custom_dir_web`), their backups cannot be told apart. The task then skips the cleanup and sends a warning notification until one of the tasks is renamed or moved to its own storage path
+- **Renamed tasks**: Backups written before a task was renamed or moved to another storage path no longer match it and are not deleted. Remove them by hand if they are no longer needed
+- **Versioned S3 buckets**: In a bucket with versioning enabled, deleting an old backup only adds a delete marker, so the storage is freed by the bucket's lifecycle rules rather than by the cleanup
 - **Failures**: If an old backup cannot be deleted, a warning is logged and the backup task itself still succeeds
 
 This configuration enables backup operations while maintaining strict security boundaries, ensuring that backup functionality cannot be misused to access unauthorized system areas.
```

**File**: `docs/zh_CN/guide/config-backup.md` (modified, +13/-0)
```diff
@@ -100,4 +100,17 @@ GrantedAccessPath = /home/user/backups
 - **状态跟踪**：每个备份任务跟踪执行状态（待处理、成功、失败）
 - **错误日志**：失败的备份包含详细的错误消息以便故障排除
 
+### 备份保留
+
+默认情况下，自动备份任务每次运行都会新增一个备份文件，旧文件不会被删除。在任务上设置 **保留备份数** 可以限制该任务保留的备份数量：
+
+- **默认值**：`0` 表示保留全部备份
+- **数量限制**：设置为正数时，每次备份成功后只保留最新的这么多份备份，更早的备份会被删除。带有加密密钥文件的备份会连同其 `.key` 文件一起删除
+- **存储**：本地存储和 S3 存储均适用
+- **范围**：只处理存储路径下直接存放、且符合该任务命名规则（`<name>_<timestamp>.zip`，自定义目录备份为 `custom_dir_<name>_<timestamp>.zip`）的文件，其他文件不会被改动。`<name>` 中不能用于文件名的字符会被替换为 `_`
+- **同名冲突**：如果另一个任务会把同名的备份文件写到同一个存储路径（例如 `web prod` 和 `web/prod`，或者自定义目录任务 `web` 和名为 `custom_dir_web` 的任务），两者的备份无法区分。此时任务会跳过清理并发送警告通知，直到其中一个任务改名或改用单独的存储路径
+- **改名的任务**：任务改名或更换存储路径之前写入的备份不再匹配该任务，不会被删除。如不再需要，请手动清理
+- **启用版本控制的 S3 存储桶**：在启用了版本控制的存储桶中，删除旧备份只会添加删除标记，存储空间由存储桶的生命周期规则释放，而不是由清理操作释放
+- **失败处理**：如果某个旧备份删除失败，会记录一条警告，备份任务本身仍然视为成功
+
 此配置在保持严格安全边界的同时启用备份操作，确保备份功能不会被滥用来访问未授权的系统区域。
\ No newline at end of file
```

**File**: `docs/zh_TW/guide/config-backup.md` (modified, +13/-0)
```diff
@@ -100,4 +100,17 @@ GrantedAccessPath = /home/user/backups
 - **狀態追蹤**：每個備份任務追蹤執行狀態（待處理、成功、失敗）
 - **錯誤日誌**：失敗的備份包含詳細的錯誤訊息以便故障排除
 
+### 備份保留
+
+預設情況下，自動備份任務每次執行都會新增一個備份檔案，舊檔案不會被刪除。在任務上設定 **保留備份數** 可以限制該任務保留的備份數量：
+
+- **預設值**：`0` 表示保留全部備份
+- **數量限制**：設定為正數時，每次備份成功後只保留最新的這麼多份備份，更早的備份會被刪除。帶有加密金鑰檔案的備份會連同其 `.key` 檔案一起刪除
+- **儲存**：本機儲存和 S3 儲存均適用
+- **範圍**：只處理儲存路徑下直接存放、且符合該任務命名規則（`<name>_<timestamp>.zip`，自訂目錄備份為 `custom_dir_<name>_<timestamp>.zip`）的檔案，其他檔案不會被改動。`<name>` 中不能用於檔名的字元會被替換為 `_`
+- **同名衝突**：如果另一個任務會把同名的備份檔案寫到同一個儲存路徑（例如 `web prod` 和 `web/prod`，或者自訂目錄任務 `web` 和名為 `custom_dir_web` 的任務），兩者的備份無法區分。此時任務會跳過清理並傳送警告通知，直到其中一個任務改名或改用單獨的儲存路徑
+- **改名的任務**：任務改名或更換儲存路徑之前寫入的備份不再符合該任務，不會被刪除。如不再需要，請手動清理
+- **啟用版本控制的 S3 儲存貯體**：在啟用了版本控制的儲存貯體中，刪除舊備份只會新增刪除標記，儲存空間由儲存貯體的生命週期規則釋放，而不是由清理操作釋放
+- **失敗處理**：如果某個舊備份刪除失敗，會記錄一條警告，備份任務本身仍然視為成功
+
 此配置在保持嚴格安全邊界的同時啟用備份操作，確保備份功能不會被濫用來存取未授權的系統區域。
\ No newline at end of file
```

**File**: `internal/backup/auto_backup.go` (modified, +1/-1)
```diff
@@ -99,7 +99,7 @@ func ExecuteAutoBackup(autoBackup *model.AutoBackup) error {
 	}
 
 	// Apply the retention policy; deleting old backups never fails the new backup
-	pruneOldBackups(autoBackup, result)
+	applyRetentionPolicy(autoBackup, result)
 
 	logger.Infof("Auto backup task %s completed successfully, file: %s", autoBackup.Name, result.FilePath)
 	if updateErr := updateBackupStatusWithTime(autoBackup.ID, model.BackupStatusSuccess, "", &now); updateErr != nil {
```

**File**: `internal/backup/retention.go` (modified, +99/-3)
```diff
@@ -2,6 +2,7 @@ package backup
 
 import (
 	"context"
+	"errors"
 	"fmt"
 	"os"
 	"path/filepath"
@@ -10,7 +11,9 @@ import (
 	"strconv"
 	"strings"
 
+	"github.com/0xJacky/Nginx-UI/internal/notification"
 	"github.com/0xJacky/Nginx-UI/model"
+	"github.com/0xJacky/Nginx-UI/query"
 	"github.com/minio/minio-go/v7"
 	"github.com/uozi-tech/cosy/logger"
 )
@@ -100,6 +103,96 @@ func deletableBackupFiles(expired []string, result *ExecutionResult) []string {
 	return deletable
 }
 
+// shareBackupFiles reports whether two auto backup tasks write backups with the
+// same file name prefix into the same storage location, so the retention policy
+// of either task would count and delete the other task's backups. Locations are
+// compared loosely (case-insensitive paths, S3 endpoint ignored): a doubtful
+// match only skips pruning, while a missed one deletes another task's backups.
+func shareBackupFiles(a, b *model.AutoBackup) bool {
+	if a.StorageType != b.StorageType || autoBackupFilePrefix(a) != autoBackupFilePrefix(b) {
+		return false
+	}
+
+	switch a.StorageType {
+	case model.StorageTypeLocal:
+		return strings.EqualFold(normalizeLocalStoragePath(a.StoragePath), normalizeLocalStoragePath(b.StoragePath))
+	case model.StorageTypeS3:
+		return strings.EqualFold(a.S3Bucket, b.S3Bucket) &&
+			strings.Trim(a.StoragePath, "/") == strings.Trim(b.StoragePath, "/")
+	default:
+		return false
+	}
+}
+
+func normalizeLocalStoragePath(path string) string {
+	if absPath, err := filepath.Abs(path); err == nil {
+		return absPath
+	}
+
+	return filepath.Clean(path)
+}
+
+// autoBackupsSharingFiles returns the other auto backup tasks whose backups the
+// retention policy of autoBackup cannot tell apart from its own.
+func autoBackupsSharingFiles(autoBackup *model.AutoBackup) ([]*model.AutoBackup, error) {
+	q := query.AutoBackup
+	others, err := q.Where(q.ID.Neq(autoBackup.ID), q.StorageType.Eq(string(autoBackup.StorageType))).Find()
+	if err != nil {
+		return nil, err
+	}
+
+	var sharing []*model.AutoBackup
+	for _, other := range others {
+		if shareBackupFiles(autoBackup, other) {
+			sharing = append(sharing, other)
+		}
+	}
+
+	return sharing, nil
+}
+
+// applyRetentionPolicy prunes old backups of a task after a successful run. It
+// skips pruning, and warns, when another task writes backups with the same file
+// names to the same storage location, because their backups cannot be told
+// apart and pruning would delete the other task's backups.
+//
+// Parameters:
+//   - autoBackup: The auto backup configuration
+//   - result: The backup execution result containing the file paths just written
+func applyRetentionPolicy(autoBackup *model.AutoBackup, result *ExecutionResult) {
+	if autoBackup.RetentionCount <= 0 {
+		return
+	}
+
+	sharing, err := autoBackupsSharingFiles(autoBackup)
+	if err != nil {
+		logger.Warnf("Skipped pruning old backups of task %s: failed to check other backup tasks: %v", autoBackup.Name, err)
+		return
+	}
+
+	if len(sharing) > 0 {
+		names := make([]string, 0, len(sharing))
+		for _, other := range sharing {
+			names = append(names, other.Name)
+		}
+		conflictNames := strings.Join(names, ", ")
+
+		logger.Warnf("Skipped pruning old backups of task %s: task(s) %s write backups with the same file names to the same storage location",
+			autoBackup.Name, conflictNames)
+		notification.Warning("Auto Backup Retention Skipped",
+			"Old backups of task %{backup_name} were not deleted because task %{conflict_names} writes backups with the same file names to the same storage location. Rename one of the tasks or change its storage path.",
+			map[string]interface{}{
+				"backup_id":      autoBackup.ID,
+				"backup_name":    autoBackup.Name,
+				"conflict_names": conflictNames,
+			},
+		)
+		return
+	}
+
+	pruneOldBackups(autoBackup, result)
+}
+
 // pruneOldBackups applies the retention policy of an auto backup task after a
 // successful backup. It does nothing unless the task keeps a limited number of
 // backups. Failing to delete old backups is logged and does not fail the task,
@@ -165,7 +258,8 @@ func pruneLocalBackups(autoBackup *model.AutoBackup, result *ExecutionResult) {
 //   - result: The backup execution result containing the file paths just written
 //
 // Returns:
-//   - error: Standard error if listing or deleting objects fails
+//   - error: Standard error if listing fails, or joined errors of the objects that
+//     could not be deleted; a failed deletion does not stop the others
 func (s3c *S3Client) PruneBackups(ctx context.Context, autoBackup *model.AutoBackup, result *ExecutionResult) error {
 	keyPrefix := constructS3Key(autoBackup.StoragePath, "")
 
@@ -178,13 +272,15 @@ func (s3c *S3Client) PruneBackups(ctx context.Context, autoBackup *model.AutoBac
 	}
 
 	expired := expiredBackupFiles(names, autoBackupFilePattern(autoBackup), autoBackup.RetentionCount)
+	var deleteErrs []error
 	for _, name := range deletableBackupFiles(expired, result) {
 		key := keyPrefix + n
```

---

### Incident Patch 9: `440aff04` (2026-10-04)
**Commit Message**: Merge pull request #2000 from BluLupo/fix/italian_translate

feat(i18n): add Italian (it_IT) translation

**File**: `app/i18n.json` (modified, +2/-1)
```diff
@@ -12,5 +12,6 @@
   "ar": "عَرَبِيّ",
   "uk_UA": "Uk",
   "ja_JP": "Ja",
-  "pt_PT": "Pt"
+  "pt_PT": "Pt",
+  "it_IT": "It"
 }
```

**File**: `app/src/composables/useGeoTranslation.ts` (modified, +4/-1)
```diff
@@ -4,6 +4,7 @@ import de from 'i18n-iso-countries/langs/de.json'
 import en from 'i18n-iso-countries/langs/en.json'
 import es from 'i18n-iso-countries/langs/es.json'
 import fr from 'i18n-iso-countries/langs/fr.json'
+import it from 'i18n-iso-countries/langs/it.json'
 import ja from 'i18n-iso-countries/langs/ja.json'
 import ko from 'i18n-iso-countries/langs/ko.json'
 import pt from 'i18n-iso-countries/langs/pt.json'
@@ -28,6 +29,7 @@ countries.registerLocale(ar)
 countries.registerLocale(uk)
 countries.registerLocale(ja)
 countries.registerLocale(pt)
+countries.registerLocale(it)
 
 export interface GeoData {
   code: string
@@ -60,6 +62,7 @@ export function useGeoTranslation() {
       uk_UA: 'uk',
       ja_JP: 'ja',
       pt_PT: 'pt',
+      it_IT: 'it',
     }
     return langMap[settingsLang] || 'en'
   }
@@ -81,7 +84,7 @@ export function useGeoTranslation() {
     }
     // Map other browser languages to supported codes
     const browserLangCode = browserLocale.split('-')[0]
-    const supportedLangs = ['fr', 'es', 'de', 'ru', 'vi', 'ko', 'tr', 'ar', 'uk', 'ja', 'pt']
+    const supportedLangs = ['fr', 'es', 'de', 'ru', 'vi', 'ko', 'tr', 'ar', 'uk', 'ja', 'pt', 'it']
     if (supportedLangs.includes(browserLangCode)) {
       return browserLangCode
     }
```

**File**: `app/src/language/LINGUAS` (modified, +1/-1)
```diff
@@ -1 +1 @@
-en zh_CN zh_TW fr_FR es de_DE ru_RU vi_VN ko_KR tr_TR ar uk_UA ja_JP pt_PT
\ No newline at end of file
+en zh_CN zh_TW fr_FR es de_DE ru_RU vi_VN ko_KR tr_TR ar uk_UA ja_JP pt_PT it_IT
\ No newline at end of file
```

**File**: `app/src/lib/helper/dayjsLocale.ts` (modified, +1/-0)
```diff
@@ -11,6 +11,7 @@ const localeMap: Record<string, string> = {
   pt: 'pt',
   es: 'es',
   it: 'it',
+  it_IT: 'it',
   ar: 'ar',
   ru: 'ru',
   tr: 'tr',
```

**File**: `app/src/lib/helper/i18n.ts` (modified, +1/-0)
```diff
@@ -18,6 +18,7 @@ const LOCALE_MAP: Record<string, string> = {
   'en': 'en',
   'es': 'es',
   'fr': 'fr_FR',
+  'it': 'it_IT',
   'ja': 'ja_JP',
   'ko': 'ko_KR',
   'pt': 'pt_PT',
```

---

### Incident Patch 10: `4e95c83b` (2026-10-02)
**Commit Message**: fix: 限制添加站点配置模板高度并支持内部滚动

**File**: `app/src/views/site/site_add/SiteAdd.vue` (modified, +9/-2)
```diff
@@ -491,7 +491,10 @@ function onDNSRecordCleared() {
             <ACard
               class="advanced-config-template"
               :title="$gettext('Config Template')"
-              :styles="{ body: { padding: '16px' } }"
+              :styles="{
+                header: { flexShrink: 0 },
+                body: { padding: '16px', flex: 1, minHeight: 0, overflowY: 'auto' },
+              }"
             >
               <ConfigTemplate />
             </ACard>
@@ -643,7 +646,10 @@ function onDNSRecordCleared() {
 
 .advanced-config-template {
   position: sticky;
-  top: 16px;
+  top: 80px;
+  display: flex;
+  flex-direction: column;
+  height: calc(100dvh - 320px);
   min-width: 0;
 }
 
@@ -661,6 +667,7 @@ function onDNSRecordCleared() {
 
   .advanced-config-template {
     position: static;
+    height: calc(100dvh - 128px);
   }
 }
 </style>
```

---

### Incident Patch 11: `e4557fe1` (2026-10-02)
**Commit Message**: test: give each in-memory test database its own name

**File**: `api/access_list/control_test.go` (modified, +2/-2)
```diff
@@ -3,11 +3,11 @@ package access_list
 import (
 	"bytes"
 	"encoding/json"
-	"fmt"
 	"net/http"
 	"net/http/httptest"
 	"testing"
 
+	"github.com/0xJacky/Nginx-UI/internal/testdb"
 	"github.com/0xJacky/Nginx-UI/model"
 	"github.com/0xJacky/Nginx-UI/query"
 	"github.com/gin-gonic/gin"
@@ -21,7 +21,7 @@ func newControlRouter(t *testing.T) *gin.Engine {
 	t.Helper()
 	gin.SetMode(gin.TestMode)
 
-	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:%s?mode=memory&cache=shared", t.Name())), &gorm.Config{})
+	db, err := gorm.Open(sqlite.Open(testdb.DSN(t)), &gorm.Config{})
 	require.NoError(t, err)
 	require.NoError(t, db.AutoMigrate(&model.AccessList{}))
 	model.Use(db)
```

**File**: `api/backup/auto_backup_test.go` (modified, +2/-1)
```diff
@@ -8,6 +8,7 @@ import (
 	"strconv"
 	"testing"
 
+	"github.com/0xJacky/Nginx-UI/internal/testdb"
 	"github.com/0xJacky/Nginx-UI/model"
 	"github.com/0xJacky/Nginx-UI/query"
 	"github.com/0xJacky/Nginx-UI/settings"
@@ -20,7 +21,7 @@ import (
 func TestRunAutoBackupExecutesDisabledConfiguration(t *testing.T) {
 	gin.SetMode(gin.TestMode)
 
-	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
+	db, err := gorm.Open(sqlite.Open(testdb.DSN(t)), &gorm.Config{})
 	require.NoError(t, err)
 	require.NoError(t, db.AutoMigrate(&model.AutoBackup{}, &model.Notification{}, &model.ExternalNotify{}))
 
```

**File**: `api/backup/security_test.go` (modified, +3/-3)
```diff
@@ -3,13 +3,13 @@ package backup
 import (
 	"bytes"
 	"encoding/json"
-	"fmt"
 	"net/http"
 	"net/http/httptest"
 	"testing"
 
 	"github.com/0xJacky/Nginx-UI/internal/cache"
 	"github.com/0xJacky/Nginx-UI/internal/middleware"
+	"github.com/0xJacky/Nginx-UI/internal/testdb"
 	internaluser "github.com/0xJacky/Nginx-UI/internal/user"
 	"github.com/0xJacky/Nginx-UI/model"
 	"github.com/0xJacky/Nginx-UI/query"
@@ -29,7 +29,7 @@ func setupAutoBackupSecurityRouter(t *testing.T) (*gin.Engine, string) {
 	originalJWTSecret := cSettings.AppSettings.JwtSecret
 	cSettings.AppSettings.JwtSecret = "test-secret"
 
-	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:%s?mode=memory&cache=shared", t.Name())), &gorm.Config{})
+	db, err := gorm.Open(sqlite.Open(testdb.DSN(t)), &gorm.Config{})
 	require.NoError(t, err)
 	require.NoError(t, db.AutoMigrate(&model.User{}, &model.AuthToken{}, &model.Passkey{}))
 
@@ -99,7 +99,7 @@ func setupBackupSecurityRouter(t *testing.T) (*gin.Engine, string, uint64) {
 	originalJWTSecret := cSettings.AppSettings.JwtSecret
 	cSettings.AppSettings.JwtSecret = "test-secret"
 
-	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:%s-backup?mode=memory&cache=shared", t.Name())), &gorm.Config{})
+	db, err := gorm.Open(sqlite.Open(testdb.DSN(t, "backup")), &gorm.Config{})
 	require.NoError(t, err)
 	require.NoError(t, db.AutoMigrate(&model.User{}, &model.AuthToken{}, &model.Passkey{}))
 
```

**File**: `api/certificate/self_signed_test.go` (modified, +2/-1)
```diff
@@ -13,6 +13,7 @@ import (
 	"testing"
 
 	"github.com/0xJacky/Nginx-UI/internal/cert"
+	"github.com/0xJacky/Nginx-UI/internal/testdb"
 	"github.com/0xJacky/Nginx-UI/internal/validation"
 	"github.com/0xJacky/Nginx-UI/model"
 	"github.com/0xJacky/Nginx-UI/query"
@@ -31,7 +32,7 @@ func setupSelfSignedAPITest(t *testing.T) *gorm.DB {
 	gin.SetMode(gin.TestMode)
 	selfSignedValidationOnce.Do(validation.Init)
 
-	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
+	db, err := gorm.Open(sqlite.Open(testdb.DSN(t)), &gorm.Config{})
 	if err != nil {
 		t.Fatalf("open test db: %v", err)
 	}
```

**File**: `api/cluster/node_auth_test.go` (modified, +3/-2)
```diff
@@ -11,6 +11,7 @@ import (
 	"testing"
 
 	"github.com/0xJacky/Nginx-UI/internal/nodeauth"
+	"github.com/0xJacky/Nginx-UI/internal/testdb"
 	"github.com/0xJacky/Nginx-UI/model"
 	"github.com/0xJacky/Nginx-UI/settings"
 	"github.com/gin-gonic/gin"
@@ -27,7 +28,7 @@ const (
 
 func TestLegacyAuthenticatedRelationshipUpgradeReplacesExistingControllerCredential(t *testing.T) {
 	gin.SetMode(gin.TestMode)
-	database, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
+	database, err := gorm.Open(sqlite.Open(testdb.DSN(t)), &gorm.Config{})
 	require.NoError(t, err)
 	require.NoError(t, database.AutoMigrate(&model.NodeControllerCredential{}))
 	model.Use(database)
@@ -80,7 +81,7 @@ func TestLegacyAuthenticatedRelationshipUpgradeReplacesExistingControllerCredent
 
 func TestLegacyUpgradeRequiresSharedSecretAuthentication(t *testing.T) {
 	gin.SetMode(gin.TestMode)
-	database, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
+	database, err := gorm.Open(sqlite.Open(testdb.DSN(t)), &gorm.Config{})
 	require.NoError(t, err)
 	require.NoError(t, database.AutoMigrate(&model.NodeControllerCredential{}))
 	model.Use(database)
```

**File**: `api/config/security_test.go` (modified, +2/-2)
```diff
@@ -4,7 +4,6 @@ import (
 	"bytes"
 	"encoding/json"
 	"errors"
-	"fmt"
 	"net/http"
 	"net/http/httptest"
 	"os"
@@ -16,6 +15,7 @@ import (
 	internalconfig "github.com/0xJacky/Nginx-UI/internal/config"
 	"github.com/0xJacky/Nginx-UI/internal/middleware"
 	"github.com/0xJacky/Nginx-UI/internal/nodeauth"
+	"github.com/0xJacky/Nginx-UI/internal/testdb"
 	internaluser "github.com/0xJacky/Nginx-UI/internal/user"
 	"github.com/0xJacky/Nginx-UI/model"
 	"github.com/0xJacky/Nginx-UI/query"
@@ -104,7 +104,7 @@ func setupConfigSecurityTest(t *testing.T) (string, configAuthFixture) {
 	appsettings.NodeSettings.Secret = "node-secret"
 	settings.AppSettings.JwtSecret = "test-secret"
 
-	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:%s?mode=memory&cache=shared", t.Name())), &gorm.Config{})
+	db, err := gorm.Open(sqlite.Open(testdb.DSN(t)), &gorm.Config{})
 	if err != nil {
 		t.Fatalf("failed to open test db: %v", err)
 	}
```

**File**: `api/dns/search_test.go` (modified, +2/-1)
```diff
@@ -11,6 +11,7 @@ import (
 	"gorm.io/driver/sqlite"
 	"gorm.io/gorm"
 
+	"github.com/0xJacky/Nginx-UI/internal/testdb"
 	"github.com/0xJacky/Nginx-UI/model"
 )
 
@@ -77,7 +78,7 @@ func TestExpandDomainSearchTerms(t *testing.T) {
 func newSearchTestDB(t *testing.T) *gorm.DB {
 	t.Helper()
 
-	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
+	db, err := gorm.Open(sqlite.Open(testdb.DSN(t)), &gorm.Config{})
 	require.NoError(t, err)
 	require.NoError(t, db.AutoMigrate(&model.DnsDomain{}))
 
```

**File**: `api/host/setup_test.go` (modified, +2/-1)
```diff
@@ -16,6 +16,7 @@ import (
 	"github.com/0xJacky/Nginx-UI/internal/host/setup"
 	"github.com/0xJacky/Nginx-UI/internal/middleware"
 	"github.com/0xJacky/Nginx-UI/internal/nodeauth"
+	"github.com/0xJacky/Nginx-UI/internal/testdb"
 	"github.com/0xJacky/Nginx-UI/model"
 	"github.com/0xJacky/Nginx-UI/settings"
 	"github.com/gin-gonic/gin"
@@ -456,7 +457,7 @@ func setDemoMode(t *testing.T, enabled bool) {
 func newInteractiveUserRouter(t *testing.T) *gin.Engine {
 	t.Helper()
 
-	database, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
+	database, err := gorm.Open(sqlite.Open(testdb.DSN(t)), &gorm.Config{})
 	if err != nil {
 		t.Fatal(err)
 	}
```

---

### Incident Patch 12: `b2cb7530` (2026-10-02)
**Commit Message**: fix(access-list): keep the database write lock out of nginx test and reload

Save wrote the row first and then ran nginx -t and the reload inside the same
database transaction, so the SQLite write lock was held for as long as nginx
took. When that exceeded the busy timeout (slow nginx, remote target, reload
falling back to restart), every other writer failed with "database is locked".

Write, test and load the files first and store the row afterwards. A failed
database write restores the files and reloads nginx again when it had already
loaded them. Delete now removes the file before the row and puts it back when
the row cannot be deleted.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `internal/access_list/service.go` (modified, +44/-25)
```diff
@@ -10,7 +10,6 @@ import (
 	"github.com/0xJacky/Nginx-UI/model"
 	"github.com/0xJacky/Nginx-UI/query"
 	"github.com/uozi-tech/cosy"
-	"gorm.io/gorm"
 )
 
 // testAndReload validates and loads the configuration after the rendered files
@@ -19,6 +18,12 @@ var testAndReload = func(tx *config.FileTransaction) error {
 	return tx.TestAndReload()
 }
 
+// rollbackAndReload restores the files and reloads Nginx after the database
+// rejected a change Nginx already loaded. Tests replace it as well.
+var rollbackAndReload = func(tx *config.FileTransaction) error {
+	return tx.RollbackAndReload()
+}
+
 // SaveResult reports what a save touched.
 type SaveResult struct {
 	List *model.AccessList `json:"list"`
@@ -67,8 +72,11 @@ func Preview(list *model.AccessList) (content string, warnings []Warning, err er
 
 // Save creates or updates a list, renders its file and the files of every
 // list that references it, and reloads Nginx when a site or stream uses one of
-// them. The database change and the files are rolled back together when the
-// Nginx test fails.
+// them. The database is written only after Nginx accepted the files, so its
+// write lock is never held across `nginx -t` and the reload: on SQLite every
+// other writer would fail with "database is locked" once those outlast the
+// busy timeout. A rejected test leaves the database untouched, and a failed
+// database write restores the files and the running configuration.
 func Save(list *model.AccessList) (*SaveResult, error) {
 	lists, err := All()
 	if err != nil {
@@ -121,40 +129,45 @@ func Save(list *model.AccessList) (*SaveResult, error) {
 
 	refs := FilterReferences(ScanReferences(), slugs...)
 
-	err = model.UseDB().Transaction(func(db *gorm.DB) error {
-		if err := db.Save(list).Error; err != nil {
-			return err
-		}
-		return writeFiles(rendered, len(refs) > 0)
-	})
+	inUse := len(refs) > 0
+	files, err := writeFiles(rendered, inUse)
 	if err != nil {
 		return nil, err
 	}
 
+	if err = model.UseDB().Save(list).Error; err != nil {
+		rollback := files.Rollback
+		if inUse {
+			rollback = func() error { return rollbackAndReload(files) }
+		}
+		return nil, config.RollbackError(err, rollback)
+	}
+
 	return &SaveResult{List: list, Slugs: slugs, References: refs}, nil
 }
 
 // writeFiles renders the files and, when anything includes them, tests and
 // reloads Nginx. A file nothing includes is never loaded, so testing it would
-// only let an unrelated broken site block the save.
-func writeFiles(rendered map[string]string, inUse bool) error {
+// only let an unrelated broken site block the save. On success it returns the
+// transaction so the caller can still undo the files.
+func writeFiles(rendered map[string]string, inUse bool) (*config.FileTransaction, error) {
 	if err := nginx.MkdirAll(Dir(), 0o755); err != nil {
-		return cosy.WrapErrorWithParams(ErrWriteAccessListFile, err.Error())
+		return nil, cosy.WrapErrorWithParams(ErrWriteAccessListFile, err.Error())
 	}
 
 	tx := &config.FileTransaction{}
 	for slug, content := range rendered {
 		if err := tx.Write(FilePath(slug), []byte(content), 0o644); err != nil {
-			return config.RollbackError(cosy.WrapErrorWithParams(ErrWriteAccessListFile, err.Error()), tx.Rollback)
+			return nil, config.RollbackError(cosy.WrapErrorWithParams(ErrWriteAccessListFile, err.Error()), tx.Rollback)
 		}
 	}
 	if !inUse {
-		return nil
+		return tx, nil
 	}
 	if err := testAndReload(tx); err != nil {
-		return cosy.WrapErrorWithParams(ErrNginxTestFailed, err.Error())
+		return nil, cosy.WrapErrorWithParams(ErrNginxTestFailed, err.Error())
 	}
-	return nil
+	return tx, nil
 }
 
 // Delete removes a list and its file. A list that another list, a site or a
@@ -182,15 +195,21 @@ func Delete(id uint64) error {
 		return cosy.WrapErrorWithParams(ErrAccessListInUse, describeReferences(refs, names))
 	}
 
-	return model.UseDB().Transaction(func(db *gorm.DB) error {
-		if err := db.Unscoped().Delete(&model.AccessList{}, id).Error; err != nil {
-			return err
-		}
-		if err := nginx.Remove(FilePath(list.Slug)); err != nil && !os.IsNotExist(err) {
-			return err
-		}
-		return nil
-	})
+	// Nothing includes the file, so removing it needs no reload. It goes
+	// first and comes back when the row cannot be deleted, which keeps the
+	// database write out of the file operation.
+	path := FilePath(list.Slug)
+	snapshot, err := config.CaptureFile(path)
+	if err != nil {
+		return err
+	}
+	if err = nginx.Remove(path); err != nil && !os.IsNotExist(err) {
+		return err
+	}
+	if err = model.UseDB().Unscoped().Delete(&model.AccessList{}, id).Error; err != nil {
+		return config.RollbackError(err, func() error { return snapshot.Restore(path) })
+	}
+	return nil
 }
 
 // Usage describes who uses a list.
```

**File**: `internal/access_list/service_test.go` (modified, +97/-3)
```diff
@@ -17,9 +17,12 @@ import (
 )
 
 type serviceEnv struct {
-	dir   string
-	tests int
-	fail  bool
+	dir     string
+	tests   int
+	reloads int
+	fail    bool
+	// onTest runs while Nginx would be testing and reloading the files.
+	onTest func()
 }
 
 func setupService(t *testing.T) *serviceEnv {
@@ -33,17 +36,26 @@ func setupService(t *testing.T) *serviceEnv {
 	query.SetDefault(db)
 
 	previous := testAndReload
+	previousRollback := rollbackAndReload
 	testAndReload = func(tx *config.FileTransaction) error {
 		env.tests++
+		if env.onTest != nil {
+			env.onTest()
+		}
 		if env.fail {
 			// Mirror FileTransaction.TestAndReload, which restores the files
 			// before it reports a rejected configuration.
 			return config.RollbackError(errors.New("emerg: unexpected"), tx.Rollback)
 		}
 		return nil
 	}
+	rollbackAndReload = func(tx *config.FileTransaction) error {
+		env.reloads++
+		return tx.Rollback()
+	}
 	t.Cleanup(func() {
 		testAndReload = previous
+		rollbackAndReload = previousRollback
 		model.Use(nil)
 	})
 	return env
@@ -189,3 +201,85 @@ func TestSlugsExist(t *testing.T) {
 	require.NoError(t, SlugsExist([]string{"lan"}))
 	assertErrCode(t, SlugsExist([]string{"lan", "nope"}), ErrUnknownList)
 }
+
+func TestSaveDoesNotHoldDatabaseLockDuringReload(t *testing.T) {
+	env := setupService(t)
+	require.NoError(t, model.UseDB().Exec("CREATE TABLE probe (id INTEGER)").Error)
+
+	lan, err := Save(newList("LAN", "lan", allow("192.168.1.0/24")))
+	require.NoError(t, err)
+	env.writeSite(t, "nas", "server {\n    include nginx-ui/access/lan.conf;\n}\n")
+
+	// Another writer must get through while Nginx tests and reloads, which
+	// only works when Save holds no open write transaction at that point.
+	var probeErr error
+	env.onTest = func() {
+		probeErr = model.UseDB().Exec("INSERT INTO probe (id) VALUES (1)").Error
+	}
+	changed := newList("LAN", "lan", allow("10.0.0.0/8"))
+	changed.ID = lan.List.ID
+	_, err = Save(changed)
+	require.NoError(t, err)
+	assert.Equal(t, 1, env.tests)
+	assert.NoError(t, probeErr)
+}
+
+func TestSaveRestoresLoadedFilesWhenDatabaseWriteFails(t *testing.T) {
+	env := setupService(t)
+
+	lan, err := Save(newList("LAN", "lan", allow("192.168.1.0/24")))
+	require.NoError(t, err)
+	before := env.read(t, "lan")
+	env.writeSite(t, "nas", "server {\n    include nginx-ui/access/lan.conf;\n}\n")
+
+	failure := errors.New("disk I/O error")
+	require.NoError(t, model.UseDB().Callback().Update().Before("gorm:update").
+		Register("test:fail_update", func(db *gorm.DB) { db.AddError(failure) }))
+
+	changed := newList("LAN", "lan", allow("10.0.0.0/8"))
+	changed.ID = lan.List.ID
+	_, err = Save(changed)
+	require.ErrorIs(t, err, failure)
+
+	assert.Equal(t, 1, env.tests)
+	assert.Equal(t, 1, env.reloads, "Nginx already loaded the new file, so it is reloaded again")
+	assert.Equal(t, before, env.read(t, "lan"), "the file is restored")
+	stored, err := Get(lan.List.ID)
+	require.NoError(t, err)
+	assert.Equal(t, "192.168.1.0/24", stored.Rules[0].Value)
+}
+
+func TestSaveRemovesNewFileWhenDatabaseWriteFails(t *testing.T) {
+	env := setupService(t)
+
+	failure := errors.New("disk I/O error")
+	require.NoError(t, model.UseDB().Callback().Create().Before("gorm:create").
+		Register("test:fail_create", func(db *gorm.DB) { db.AddError(failure) }))
+
+	_, err := Save(newList("LAN", "lan", allow("192.168.1.0/24")))
+	require.ErrorIs(t, err, failure)
+
+	assert.Zero(t, env.tests)
+	assert.Zero(t, env.reloads, "a file nothing includes was never loaded")
+	_, err = os.Stat(filepath.Join(env.dir, "nginx-ui", "access", "lan.conf"))
+	assert.True(t, os.IsNotExist(err), "the new file is removed again")
+}
+
+func TestDeleteRestoresFileWhenDatabaseDeleteFails(t *testing.T) {
+	env := setupService(t)
+
+	lan, err := Save(newList("LAN", "lan", allow("192.168.1.0/24")))
+	require.NoError(t, err)
+	before := env.read(t, "lan")
+
+	failure := errors.New("disk I/O error")
+	require.NoError(t, model.UseDB().Callback().Delete().Before("gorm:delete").
+		Register("test:fail_delete", func(db *gorm.DB) { db.AddError(failure) }))
+
+	err = Delete(lan.List.ID)
+	require.ErrorIs(t, err, failure)
+
+	assert.Equal(t, before, env.read(t, "lan"), "the file is put back")
+	_, err = Get(lan.List.ID)
+	require.NoError(t, err, "the row is kept")
+}
```

---

### Incident Patch 13: `f7ab4d9a` (2026-10-02)
**Commit Message**: fix(sitecheck): resolve site index inside upgrade transaction

The site config auto-upgrade opened a transaction and, inside it, created
missing sites rows through the global query.Site handle. On SQLite that insert
ran on another pooled connection and waited on the transaction's own write lock
until busy_timeout, so it failed with "database is locked", left the record
unresolved, and stalled every other database user while it waited. The same
records stayed unresolved, so the stall repeated on every start.

Resolve and create the sites row on the upgrade transaction instead.

Fixes #1994

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `internal/sitecheck/checker.go` (modified, +14/-1)
```diff
@@ -304,6 +304,16 @@ func canonicalSiteKey(siteName, rawURL string) string {
 }
 
 func resolveSiteIndexByName(siteName string) uint64 {
+	return resolveSiteIndexByNameInTx(nil, siteName)
+}
+
+// resolveSiteIndexByNameInTx resolves (and creates when missing) the sites row
+// for siteName. When tx is non-nil the lookup and the insert run on that
+// transaction. Callers holding an open SQLite transaction must pass it: an
+// insert through another pooled connection would wait on the transaction's own
+// write lock until busy_timeout, failing with "database is locked" and stalling
+// every other database user in the meantime.
+func resolveSiteIndexByNameInTx(tx *gorm.DB, siteName string) uint64 {
 	siteName = strings.TrimSpace(siteName)
 	if siteName == "" {
 		return 0
@@ -315,6 +325,9 @@ func resolveSiteIndexByName(siteName string) uint64 {
 	}
 
 	s := query.Site
+	if tx != nil {
+		s = &query.Use(tx).Site
+	}
 	siteModel, err := s.Where(s.Path.Eq(path)).FirstOrCreate()
 	if err != nil {
 		logger.Warnf("Failed to resolve site index for %s: %v", siteName, err)
@@ -601,7 +614,7 @@ func upgradeSiteConfigAssociations() (updated int, deduplicated int, unresolved
 
 		targetIndex := cfg.SiteIndex
 		if siteName != "" {
-			if resolved := resolveSiteIndexByName(siteName); resolved > 0 {
+			if resolved := resolveSiteIndexByNameInTx(tx, siteName); resolved > 0 {
 				targetIndex = resolved
 			}
 		}
```

**File**: `internal/sitecheck/checker_upgrade_test.go` (added, +86/-0)
```diff
@@ -0,0 +1,86 @@
+package sitecheck
+
+import (
+	"os"
+	"path/filepath"
+	"testing"
+
+	"github.com/0xJacky/Nginx-UI/model"
+	"github.com/0xJacky/Nginx-UI/query"
+	"github.com/0xJacky/Nginx-UI/settings"
+	"gorm.io/driver/sqlite"
+	"gorm.io/gorm"
+	"gorm.io/gorm/logger"
+)
+
+// TestUpgradeSiteConfigAssociationsCreatesMissingSitesInTx covers sites that
+// exist in sites-available but have no sites row yet. The upgrade must create
+// that row inside its own transaction; an insert through another pooled
+// connection self-deadlocks on SQLite until busy_timeout and leaves the record
+// unresolved on every start.
+func TestUpgradeSiteConfigAssociationsCreatesMissingSitesInTx(t *testing.T) {
+	confDir := t.TempDir()
+	if err := os.MkdirAll(filepath.Join(confDir, "sites-available"), 0o755); err != nil {
+		t.Fatalf("failed to create sites-available: %v", err)
+	}
+
+	originalConfigDir := settings.NginxSettings.ConfigDir
+	originalDB := model.UseDB()
+	originalSite := query.Site
+	t.Cleanup(func() {
+		settings.NginxSettings.ConfigDir = originalConfigDir
+		model.Use(originalDB)
+		query.Site = originalSite
+	})
+	settings.NginxSettings.ConfigDir = confDir
+
+	// A file-backed database is required: only separate connections to a real
+	// file reproduce the lock contention. The short busy timeout keeps a
+	// regression from stalling the test for the 5s driver default.
+	dsn := "file:" + filepath.Join(t.TempDir(), "upgrade.db") + "?_busy_timeout=200"
+	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{Logger: logger.Discard})
+	if err != nil {
+		t.Fatalf("failed to open test database: %v", err)
+	}
+	sqlDB, err := db.DB()
+	if err != nil {
+		t.Fatalf("failed to get sql.DB: %v", err)
+	}
+	t.Cleanup(func() { _ = sqlDB.Close() })
+
+	if err := db.AutoMigrate(&model.Site{}, &model.SiteConfig{}); err != nil {
+		t.Fatalf("failed to migrate test database: %v", err)
+	}
+	model.Use(db)
+	query.Site = &query.Use(db).Site
+
+	legacy := &model.SiteConfig{SiteName: "example.conf", Host: "example.com:80", Port: 80, Scheme: "http"}
+	if err := db.Create(legacy).Error; err != nil {
+		t.Fatalf("failed to seed site config: %v", err)
+	}
+
+	updated, _, unresolved, err := upgradeSiteConfigAssociations()
+	if err != nil {
+		t.Fatalf("upgradeSiteConfigAssociations returned error: %v", err)
+	}
+	if unresolved != 0 {
+		t.Fatalf("unresolved = %d, want 0", unresolved)
+	}
+	if updated != 1 {
+		t.Fatalf("updated = %d, want 1", updated)
+	}
+
+	var created model.Site
+	wantPath := filepath.Join(confDir, "sites-available", "example.conf")
+	if err := db.Where("path = ?", wantPath).First(&created).Error; err != nil {
+		t.Fatalf("sites row for %s was not created: %v", wantPath, err)
+	}
+
+	var got model.SiteConfig
+	if err := db.First(&got, legacy.ID).Error; err != nil {
+		t.Fatalf("failed to reload site config: %v", err)
+	}
+	if got.SiteIndex != created.ID || got.SiteID != created.ID {
+		t.Fatalf("site config index = %d/%d, want %d", got.SiteIndex, got.SiteID, created.ID)
+	}
+}
```

---

### Incident Patch 14: `2a9fb2cd` (2026-10-01)
**Commit Message**: fix(template): keep a space after trim markers on bare action lines

**File**: `internal/template/template.go` (modified, +5/-3)
```diff
@@ -158,12 +158,14 @@ func TrimActionLines(content string) string {
 		}
 		if i == 0 {
 			// Nothing comes before the first line, so the break after it goes.
-			if trimmed := strings.TrimRight(line, " \t"); !strings.HasSuffix(trimmed, "-}}") {
-				lines[i] = strings.TrimSuffix(trimmed, "}}") + "-}}"
+			// A trim marker needs a space next to it, so "{{end}}" becomes
+			// "{{end -}}".
+			if trimmed := strings.TrimRight(line, " \t"); !strings.HasSuffix(trimmed, " -}}") {
+				lines[i] = strings.TrimSuffix(trimmed, "}}") + " -}}"
 			}
 			continue
 		}
-		lines[i] = actionOpener.ReplaceAllString(line, "$1{{-")
+		lines[i] = actionOpener.ReplaceAllString(line, "$1{{- ")
 	}
 	return strings.Join(lines, "\n")
 }
```

**File**: `internal/template/template_test.go` (modified, +13/-0)
```diff
@@ -64,6 +64,19 @@ func TestTrimActionLines(t *testing.T) {
 	require.NoError(t, err)
 	require.Equal(t, "keep;\nlast;\n", rendered)
 
+	// Actions written without spaces inside the braces are trimmed as well.
+	rendered, err = RenderText("t", "{{if .keep}}\nkeep;\n{{else}}\ndrop;\n{{end}}\n{{/* done */}}\nlast;\n", map[string]Variable{"keep": {Value: true}})
+	require.NoError(t, err)
+	require.Equal(t, "keep;\nlast;\n", rendered)
+
+	rendered, err = RenderText("t", "{{range $i := 2}}deny all;\n{{end}}\n", nil)
+	require.NoError(t, err)
+	require.Equal(t, "deny all;deny all;\n", rendered)
+
+	rendered, err = RenderText("t", "{{- if .keep -}}\nkeep;\n{{- end }}\n", map[string]Variable{"keep": {Value: true}})
+	require.NoError(t, err)
+	require.Equal(t, "keep;\n", rendered)
+
 	// An action inside a line, or one that prints a value, keeps the line.
 	require.Equal(t, "gzip {{ if .g }}on{{ else }}off{{ end }};", TrimActionLines("gzip {{ if .g }}on{{ else }}off{{ end }};"))
 	require.Equal(t, "server {\n    {{ .extra }}\n}", TrimActionLines("server {\n    {{ .extra }}\n}"))
```

---

### Incident Patch 15: `88ef6881` (2026-10-01)
**Commit Message**: docs(snippet): keep template braces out of Vue interpolation

**File**: `docs/guide/snippets.md` (modified, +5/-5)
```diff
@@ -69,7 +69,7 @@ without a translation see the English text.
 
 A variable makes a value differ from site to site, such as a target address
 or a status code. It has a key, a label, a type (text, switch or select) and
-a default value, and the content refers to it as `{{ .key }}`.
+a default value, and the content refers to it as <code v-pre>{{ .key }}</code>.
 
 The quickest way to add one is to write the configuration with a real value
 first, select the value and click **Make Variable**, or press <kbd>⌘E</kbd>
@@ -79,13 +79,13 @@ refers to the variable. Selecting `on` or `off` makes a switch.
 
 In the content, every variable has its own color, the same as in the list of
 variables, and pointing at one shows its type and default value. Typing
-`{{ .` lists the variables to complete, and **New Variable…** at the end of
+<code v-pre>{{ .</code> lists the variables to complete, and **New Variable…** at the end of
 the list declares one where the cursor is. **Insert Variable** adds one at
 the cursor. A variable the content uses without declaring it is marked, with
 a button to declare it.
 
 A snippet with variables is filled in by the config template panel and can
-only be inserted. Nginx cannot include it, because the `{{ }}` placeholders
+only be inserted. Nginx cannot include it, because the <code v-pre>{{ }}</code> placeholders
 are not Nginx configuration.
 
 ### Preview
@@ -97,8 +97,8 @@ and the preview tells whether the result is valid Nginx configuration, before
 the snippet is saved. For a snippet without variables, the same place shows
 the directive that includes it.
 
-A line that holds only actions such as `{{ if .keepPath }}`, `{{ else }}` or
-`{{ end }}` leaves no blank line in the result, so blocks can be written on
+A line that holds only actions such as <code v-pre>{{ if .keepPath }}</code>, <code v-pre>{{ else }}</code> or
+<code v-pre>{{ end }}</code> leaves no blank line in the result, so blocks can be written on
 lines of their own.
 
 ## Built-in Templates
```

**File**: `docs/zh_CN/guide/snippets.md` (modified, +4/-4)
```diff
@@ -43,19 +43,19 @@ outline: [2, 3]
 
 ### 变量 {#variables}
 
-变量让某个值因网站而异，例如目标地址或状态码。每个变量有键名、显示名称、类型（文本、开关或选择）和默认值，内容中以 `{{ .键名 }}` 引用。
+变量让某个值因网站而异，例如目标地址或状态码。每个变量有键名、显示名称、类型（文本、开关或选择）和默认值，内容中以 <code v-pre>{{ .键名 }}</code> 引用。
 
 最快的方式是先用真实的值写好配置，然后选中这个值，点击 **设为变量**，或按 <kbd>⌘E</kbd>（Windows 和 Linux 上为 <kbd>Ctrl+E</kbd>）。键名和类型会根据所在行推测，选中的值成为默认值，内容随即改为引用该变量。选中 `on` 或 `off` 会创建开关。
 
-在内容中，每个变量都有自己的颜色，与变量列表中的颜色一致，将指针移到变量上会显示它的类型和默认值。输入 `{{ .` 会列出可补全的变量，列表末尾的 **新建变量…** 会在光标处声明一个新变量；**插入变量** 会在光标处插入已有变量。内容中使用但未声明的变量会被标出，并提供声明按钮。
+在内容中，每个变量都有自己的颜色，与变量列表中的颜色一致，将指针移到变量上会显示它的类型和默认值。输入 <code v-pre>{{ .</code> 会列出可补全的变量，列表末尾的 **新建变量…** 会在光标处声明一个新变量；**插入变量** 会在光标处插入已有变量。内容中使用但未声明的变量会被标出，并提供声明按钮。
 
-带变量的片段由配置模板面板填写变量，只能插入使用。Nginx 无法直接引用它，因为 `{{ }}` 占位符不是 Nginx 配置。
+带变量的片段由配置模板面板填写变量，只能插入使用。Nginx 无法直接引用它，因为 <code v-pre>{{ }}</code> 占位符不是 Nginx 配置。
 
 ### 预览 {#preview}
 
 内容下方的 **预览** 左侧是配置模板面板要求使用者填写的表单，右侧是填写后得到的配置。预览随每次修改实时更新：修改任一值，结果随之更新并标出变化的行；预览还会说明结果是否为有效的 Nginx 配置，无需先保存片段。不含变量的片段在同一位置显示引用它的指令。
 
-只包含 `{{ if .keepPath }}`、`{{ else }}` 或 `{{ end }}` 等动作的行不会在结果中留下空行，因此可以把这些动作单独写成一行。
+只包含 <code v-pre>{{ if .keepPath }}</code>、<code v-pre>{{ else }}</code> 或 <code v-pre>{{ end }}</code> 等动作的行不会在结果中留下空行，因此可以把这些动作单独写成一行。
 
 ## 内置模板 {#built-in-templates}
 
```

**File**: `docs/zh_TW/guide/snippets.md` (modified, +4/-4)
```diff
@@ -43,19 +43,19 @@ outline: [2, 3]
 
 ### 變數 {#variables}
 
-變數讓某個值因網站而異，例如目標位址或狀態碼。每個變數有鍵名、顯示名稱、類型（文字、開關或選擇）和預設值，內容中以 `{{ .鍵名 }}` 引用。
+變數讓某個值因網站而異，例如目標位址或狀態碼。每個變數有鍵名、顯示名稱、類型（文字、開關或選擇）和預設值，內容中以 <code v-pre>{{ .鍵名 }}</code> 引用。
 
 最快的方式是先用真實的值寫好設定，然後選取這個值，點擊 **設為變數**，或按 <kbd>⌘E</kbd>（Windows 和 Linux 上為 <kbd>Ctrl+E</kbd>）。鍵名和類型會根據所在行推測，選取的值成為預設值，內容隨即改為引用該變數。選取 `on` 或 `off` 會建立開關。
 
-在內容中，每個變數都有自己的顏色，與變數清單中的顏色一致，將指標移到變數上會顯示它的類型和預設值。輸入 `{{ .` 會列出可補全的變數，清單末尾的 **新增變數…** 會在游標處宣告一個新變數；**插入變數** 會在游標處插入已有變數。內容中使用但未宣告的變數會被標出，並提供宣告按鈕。
+在內容中，每個變數都有自己的顏色，與變數清單中的顏色一致，將指標移到變數上會顯示它的類型和預設值。輸入 <code v-pre>{{ .</code> 會列出可補全的變數，清單末尾的 **新增變數…** 會在游標處宣告一個新變數；**插入變數** 會在游標處插入已有變數。內容中使用但未宣告的變數會被標出，並提供宣告按鈕。
 
-帶變數的片段由配置模板面板填寫變數，只能插入使用。Nginx 無法直接引用它，因為 `{{ }}` 預留位置不是 Nginx 設定。
+帶變數的片段由配置模板面板填寫變數，只能插入使用。Nginx 無法直接引用它，因為 <code v-pre>{{ }}</code> 預留位置不是 Nginx 設定。
 
 ### 預覽 {#preview}
 
 內容下方的 **預覽** 左側是配置模板面板要求使用者填寫的表單，右側是填寫後得到的設定。預覽隨每次修改即時更新：修改任一值，結果隨之更新並標出變化的行；預覽還會說明結果是否為有效的 Nginx 設定，無需先儲存片段。不含變數的片段在同一位置顯示引用它的指令。
 
-只包含 `{{ if .keepPath }}`、`{{ else }}` 或 `{{ end }}` 等動作的行不會在結果中留下空行，因此可以把這些動作單獨寫成一行。
+只包含 <code v-pre>{{ if .keepPath }}</code>、<code v-pre>{{ else }}</code> 或 <code v-pre>{{ end }}</code> 等動作的行不會在結果中留下空行，因此可以把這些動作單獨寫成一行。
 
 ## 內建範本 {#built-in-templates}
 
```

#### Recent Merged Pull Requests:
- **PR #2005** (2026-10-05): feat(cert): show which sites and streams use each certificate (@0xJacky)
- **PR #2004** (2026-10-05): fix(cert): keep certificates with long identifier lists in their own directory (@0xJacky)
- **PR #2003** (2026-10-05): fix(cert): migrate shared certificates and wait for renewal before expiry notices (@0xJacky)
- **PR #2002** (2026-10-05): style(cert): tidy the certificate editor header and actions (@0xJacky)
- **PR #2000** (2026-10-04): feat(i18n): add Italian (it_IT) translation (@BluLupo)
- **PR #1999** (2026-10-05): feat(backup): add a retention count to auto backup tasks (@SulimanAbdulrazzaq)
- **PR #1993** (2026-10-05): chore(deps): update nginxui/musl-cross-compilers digest to 57f4de0 (@renovate[bot])
- **PR #1992** (2026-10-05): chore(deps): update msys2/setup-msys2 digest to ec48f7c (@renovate[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
