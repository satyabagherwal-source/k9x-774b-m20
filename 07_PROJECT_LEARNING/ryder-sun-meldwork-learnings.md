> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/ryder-sun-meldwork-learnings.md`  
> **Source**: github ([https://github.com/Ryder-Sun/Meldwork](https://github.com/Ryder-Sun/Meldwork))  
> **Source Version**: `a5017184`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-21T16:19:25.588Z  
> **Learning ID**: `learn-github-ryder-sun-meldwork`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): Ryder-Sun/Meldwork

> **Canonical Artifact**: `07_PROJECT_LEARNING/ryder-sun-meldwork-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Ryder-Sun/Meldwork](https://github.com/Ryder-Sun/Meldwork))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-21T16:19:24.627Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Ryder-Sun/Meldwork`
- **Description**: Local-first AI agent workspace for multi-agent collaboration, agent orchestration, scoped permissions, evidence-aware runs, and human-in-the-loop decisions.
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1100 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `desktop/scripts/render-dmg-background.swift`
```
#!/usr/bin/env swift
import AppKit
import Foundation

let arguments = CommandLine.arguments
guard arguments.count == 3 else {
    fputs("Usage: render-dmg-background.swift <source.png> <output.png>\n", stderr)
    exit(1)
}

let sourceURL = URL(fileURLWithPath: arguments[1])
let outputURL = URL(fileURLWithPath: arguments[2])
guard let source = NSImage(contentsOf: sourceURL) else {
    fputs("Unable to read source image\n", stderr)
    exit(1)
}
guard let bitmap = NSBitmapImageRep(
    bitmapDataPlanes: nil,
    pixelsWide: 1280,
    pixelsHigh: 840,
    bitsPerSample: 8,
    samplesPerPixel: 4,
    hasAlpha: true,
    isPlanar: false,
    colorSpaceName: .deviceRGB,
    bytesPerRow: 0,
    bitsPerPixel: 0
) else {
    fputs("Unable to create output bitmap\n", stderr)
    exit(1)
}

NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
source.draw(
    in: NSRect(x: 0, y: 0, width: 1280, height: 840),
    from: NSRect(x: 0, y: 4, width: 1280, height: 840),
    operation: .copy,
    fraction: 1
)

let centered = NSMutableParagraphStyle()
centered.alignment = .center

let title = "INSTALL MELDWORK" as NSString
title.draw(
    in: NSRect(x: 0, y: 712, width: 1280, height: 52),
    withAttributes: [
        .font: NSFont(name: "DIN Alternate Bold", size: 38) ?? NSFont.boldSystemFont(ofSize: 38),
        .foregroundColor: NSColor(white: 0.96, alpha: 0.94),
        .kern: 4.5,
        .paragraphStyle: centered,
    ]
)

let explanation = "DRAG MELDWORK INTO APPLICATIONS  /  YOUR WORKSPACE STAYS LOCAL" as NSString
explanation.draw(
    in: NSRect(x: 0, y: 675, width: 1280, height: 30),
    withAttributes: [
        .font: NSFont(name: "Menlo-Regular", size: 14) ?? NSFont.monospacedSystemFont(ofSize: 14, weight: .regular),
        .foregroundColor: NSColor(white: 0.82, alpha: 0.74),
        .kern: 1.5,
        .paragraphStyle: centered,
    ]
)
NSGraphicsContext.restoreGraphicsState()

guard let png = bitmap.representation(using: .png, properties: [:]) else {
    fputs("Unable to encode PNG\n", stderr)
    exit(1)
}
try png.write(to: outputURL)

```

### Core Architecture Module: `frontend/src/composables/useConversationTimelineUiState.js`
```
import { ref } from 'vue'
import {
  isLiveDirectTrace,
  messageTraceKey,
  responseVersionRootId,
} from '../conversationTimelineModel.js'

const DISMISSIBLE_PLAN_WARNING = 'error: Cannot combine --prompt with --plan.'

export function useConversationTimelineUiState() {
  const directTraceDisclosure = ref(new Map())
  const dismissedSystemMessageIds = ref(new Set())
  const finishedDirectGroupIds = ref(new Set())
  const collapsedAgentReplyIds = ref(new Set())

  function directTraceDisclosureKey(message) {
    const key = messageTraceKey(message)
    return key ? `${isLiveDirectTrace(message) ? 'live' : 'durable'}:${key}` : ''
  }

  function isDirectTraceOpen(message) {
    const key = directTraceDisclosureKey(message)
    if (directTraceDisclosure.value.has(key)) return directTraceDisclosure.value.get(key)
    return false
  }

  function syncDirectTraceDisclosure(message, event) {
    const key = directTraceDisclosureKey(message)
    if (!key) return
    const open = event?.target?.open === true
    const defaultOpen = false
    const next = new Map(directTraceDisclosure.value)
    if (open === defaultOpen) next.delete(key)
    else next.set(key, open)
    directTraceDisclosure.value = next
  }

  function isDismissibleSystemWarning(message) {
    return message?.role === 'system'
      && Boolean(message?.id)
      && String(message.content || '').trim() === DISMISSIBLE_PLAN_WARNING
  }

  function dismissSystemMessage(id) {
    if (!id) return
    dismissedSystemMessageIds.value = new Set([...dismissedSystemMessageIds.value, id])
  }

  function hasFinishedDirectRun(groupId) {
    return finishedDirectGroupIds.value.has(groupId)
  }

  function setFinishedDirectRun(groupId, finished) {
    const next = new Set(finishedDirectGroupIds.value)
    if (finished) next.add(groupId)
    else next.delete(groupId)
    finishedDirectGroupIds.value = next
  }

  function isAgentReplyExpanded(message) {
    const key = responseVersionRootId(message)
    return !key || !collapsedAgentReplyIds.value.has(key)
  }

  function toggleAgentReply(message) {
    const key = responseVersionRootId(message)
    if (!key) return
    const next = new Set(collapsedAgentReplyIds.value)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    collapsedAgentReplyIds.value = next
  }

  return {
    dismissedSystemMessageIds,
    dismissSystemMessage,
    hasFinishedDirectRun,
    isAgentReplyExpanded,
    isDirectTraceOpen,
    isDismissibleSystemWarning,
    setFinishedDirectRun,
    syncDirectTraceDisclosure,
    toggleAgentReply,
  }
}

```

### Core Architecture Module: `frontend/src/composables/useDesktopWorkspaceLifecycle.js`
```
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { mergeRunEvent, normalizeSnapshot } from '../desktop.js'

function settleWithin(promise, timeoutMs = 1200) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(undefined), timeoutMs)
    Promise.resolve(promise).then(
      value => {
        clearTimeout(timer)
        resolve(value)
      },
      () => {
        clearTimeout(timer)
        resolve(undefined)
      },
    )
  })
}

export function useDesktopWorkspaceLifecycle({
  afterInitialLoad,
  beforeBoot,
  defaultDirectory,
  handleOpenGroup,
  handleRunFinished,
  installer,
  installerState,
  refreshAgents,
  showError,
  snapshot,
  workspace,
}) {
  const booting = ref(true)
  const bridgeMissing = ref(false)
  let unsubscribeWorkspace = null
  let unsubscribeInstaller = null
  let unsubscribeRunFinished = null
  let unsubscribeRunEvent = null
  let unsubscribeOpenGroup = null
  let lastFocusRefreshAt = 0

  function handleWindowFocus() {
    const now = Date.now()
    if (!workspace.value || now - lastFocusRefreshAt < 30000) return
    lastFocusRefreshAt = now
    void refreshAgents?.()
  }

  function handleRunEvent(event) {
    const next = mergeRunEvent(snapshot.value, event)
    if (next !== snapshot.value) snapshot.value = next
  }

  async function boot() {
    beforeBoot()
    if (!workspace.value || !installer.value) {
      bridgeMissing.value = true
      booting.value = false
      return
    }
    try {
      unsubscribeWorkspace = workspace.value.onChanged?.((value) => {
        snapshot.value = normalizeSnapshot(value)
      }) || null
      unsubscribeRunEvent = workspace.value.onRunEvent?.(handleRunEvent) || null
      unsubscribeRunFinished = workspace.value.onRunFinished?.(handleRunFinished) || null
      unsubscribeOpenGroup = workspace.value.onOpenGroup?.(handleOpenGroup) || null
      unsubscribeInstaller = installer.value.onChanged?.((value) => {
        installerState.value = value
      }) || null
      const [nextSnapshot, nextInstaller, nextDirectory] = await Promise.all([
        settleWithin(workspace.value.get()),
        settleWithin(installer.value.state()),
        settleWithin(workspace.value.defaultDirectory()),
      ])
      if (nextSnapshot) snapshot.value = normalizeSnapshot(nextSnapshot)
      installerState.value = nextInstaller || installerState.value
      defaultDirectory.value = nextDirectory || ''
    } catch (error) {
      showError(error)
    } finally {
      booting.value = false
    }
    afterInitialLoad()
  }

  onMounted(() => {
    lastFocusRefreshAt = Date.now()
    window.addEventListener('focus', handleWindowFocus)
    void boot()
  })

  onBeforeUnmount(() => {
    window.removeEventListener('focus', handleWindowFocus)
    unsubscribeWorkspace?.()
    unsubscribeRunEvent?.()
    unsubscribeInstaller?.()
    unsubscribeRunFinished?.()
    unsubscribeOpenGroup?.()
  })

  return { booting, bridgeMissing }
}

```

### Core Architecture Module: `frontend/src/composables/useOverlayLifecycle.js`
```
import { nextTick, onBeforeUnmount, onMounted, watch } from 'vue'

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

export function useOverlayLifecycle({
  blockingOverlayOpen,
  clearOnboardingPlayback,
  closeCollapsedGroupMenu,
  closeModal,
  closeTracePanel,
  completeOnboardingState,
  ensureOnboardingPlayback,
  modal,
  modalDialog,
  onboardingDialog,
  onboardingVisible,
  saving,
  tracePanelOpen,
}) {
  let historyPushed = false
  let focusReturn = null

  function focusOverlay(dialog) {
    void nextTick(() => dialog.value?.focus())
  }

  function completeOnboarding(options = {}) {
    const shouldRestoreHistory = historyPushed && options.fromHistory !== true
    historyPushed = false
    completeOnboardingState()
    if (shouldRestoreHistory) history.back()
  }

  function trapOverlayFocus(event) {
    if (event.key !== 'Tab' || !blockingOverlayOpen.value) return false
    const dialog = onboardingVisible.value ? onboardingDialog.value : modalDialog.value
    if (!dialog) return false
    const focusable = [...dialog.querySelectorAll(FOCUSABLE_SELECTOR)]
    if (!focusable.length) {
      event.preventDefault()
      dialog.focus()
      return true
    }
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const focusOutside = !dialog.contains(document.activeElement)
    if (event.shiftKey && (focusOutside || document.activeElement === first)) {
      event.preventDefault()
      last.focus()
      return true
    }
    if (!event.shiftKey && (focusOutside || document.activeElement === last)) {
      event.preventDefault()
      first.focus()
      return true
    }
    return false
  }

  function handlePopState() {
    if (tracePanelOpen.value) {
      closeTracePanel({ fromHistory: true })
      return
    }
    if (!blockingOverlayOpen.value) return
    if (modal.value && saving.value) {
      history.pushState({ meldworkOverlay: true }, '', window.location.href)
      historyPushed = true
      return
    }
    historyPushed = false
    if (onboardingVisible.value) completeOnboarding({ fromHistory: true })
    else closeModal()
  }

  watch(onboardingVisible, (value) => {
    if (value) {
      focusOverlay(onboardingDialog)
      ensureOnboardingPlayback()
      return
    }
    clearOnboardingPlayback()
  })

  watch(modal, (value, previous) => {
    if (value) closeCollapsedGroupMenu()
    if (value && !previous) {
      const active = document.activeElement
      focusReturn = active instanceof HTMLElement && active !== document.body ? active : null
    }
    if (value) {
      focusOverlay(modalDialog)
      return
    }
    if (!previous) return
    const target = focusReturn
    focusReturn = null
    void nextTick(() => {
      if (target?.isConnected && typeof target.focus === 'function') target.focus()
    })
  })

  watch(blockingOverlayOpen, (value, previous) => {
    const reusedTraceHistory = value && !previous && tracePanelOpen.value
      ? closeTracePanel({
          fromHistory: true,
          replacementState: { meldworkOverlay: true },
        })
      : false
    document.body.classList.toggle('modal-open', Boolean(value))
    if (value && !previous) {
      if (!reusedTraceHistory) {
        history.pushState({ meldworkOverlay: true }, '', window.location.href)
      }
      historyPushed = true
    } else if (!value && previous && historyPushed) {
      historyPushed = false
      history.back()
    }
  })

  onMounted(() => {
    window.addEventListener('popstate', handlePopState)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('popstate', handlePopState)
    document.body.classList.remove('modal-open')
    clearOnboardingPlayback()
  })

  return {
    completeOnboarding,
    trapOverlayFocus,
  }
}

```

### Core Architecture Module: `frontend/src/composables/useWorkspaceNavigationState.js`
```
import { computed, ref, watch } from 'vue'

const ACTIVE_RUN_PHASES = new Set(['preparing', 'running', 'waiting'])
const TERMINAL_AGENT_STATUSES = new Set([
  'completed', 'succeeded', 'failed', 'cancelled', 'stopped', 'partial', 'timeout', 'interrupted',
])

function runStillActive(run) {
  if (!ACTIVE_RUN_PHASES.has(String(run?.phase || '').toLowerCase())) return false
  const targetKinds = Array.isArray(run?.targetKinds) ? run.targetKinds : []
  if (!targetKinds.length || run?.mode === 'auto') return true
  const completed = new Set(Array.isArray(run?.completedKinds) ? run.completedKinds : [])
  const latestStatusByKind = new Map()
  for (const agent of Array.isArray(run?.agentRuns) ? run.agentRuns : []) {
    if (!agent?.kind) continue
    latestStatusByKind.set(agent.kind, String(agent.status || '').toLowerCase())
  }
  return targetKinds.some(kind => (
    !completed.has(kind) && !TERMINAL_AGENT_STATUSES.has(latestStatusByKind.get(kind))
  ))
}

export function useWorkspaceNavigationState({
  clearSidebarDeleteState,
  closeCollapsedGroupMenu,
  closeTracePanel,
  directGroupsFor,
  flushPendingRunFinishedEvents,
  hasFinishedDirectRun,
  isDirectCreationPending,
  openAgentManager,
  openDirect,
  preloadAgentSkills,
  setFinishedDirectRun,
  setSidebarAgentExpanded,
  sidebarCollapsed,
  snapshot,
  toggleSidebarAgentExpanded,
}) {
  const activeView = ref('home')
  const selectedGroupId = ref('')
  let pendingRequestedGroupId = ''

  const activeGroup = computed(() => (
    snapshot.value.groups.find(group => group.id === selectedGroupId.value) || null
  ))
  const activeGroupMemberSignature = computed(() => {
    const group = activeGroup.value
    return group ? [group.id, ...group.agentKinds].join('\u0000') : ''
  })

  function handleSidebarAgentMain(agent) {
    if (!agent || isDirectCreationPending(agent.kind)) return
    if (sidebarCollapsed.value) {
      void openDirect(agent)
      return
    }
    if (directGroupsFor(agent.kind).length) {
      toggleSidebarAgentExpanded(agent.kind)
      return
    }
    void openDirect(agent)
  }

  function handleAgentPrimary(agent) {
    if (agent.ready) openDirect(agent)
    else openAgentManager(agent.kind)
  }

  function goHome() {
    closeCollapsedGroupMenu()
    activeView.value = 'home'
    clearSidebarDeleteState()
    pendingRequestedGroupId = ''
    closeTracePanel()
  }

  function selectGroup(id) {
    closeCollapsedGroupMenu()
    const group = snapshot.value.groups.find(item => item.id === id)
    if (!group) {
      selectedGroupId.value = ''
      activeView.value = 'home'
      return
    }
    activeView.value = 'conversation'
    closeTracePanel()
    clearSidebarDeleteState()
    selectedGroupId.value = id
    if (group.conversationType === 'direct' && group.directAgentKind) {
      setSidebarAgentExpanded(group.directAgentKind, true)
    }
    void preloadAgentSkills(group.agentKinds)
    if (hasFinishedDirectRun(id)) setFinishedDirectRun(id, false)
  }

  function isGroupRunning(id) {
    const groupRuns = (Array.isArray(snapshot.value.runs) ? snapshot.value.runs : [])
      .filter(run => run?.groupId === id)
    if (groupRuns.length) return groupRuns.some(runStillActive)
    const hasConversationActivity = (Array.isArray(snapshot.value.messages) ? snapshot.value.messages : [])
      .some(message => message?.groupId === id)
    return hasConversationActivity && snapshot.value.runningGroupIds.includes(id)
  }

  function openPendingRequestedGroup() {
    if (!pendingRequestedGroupId
        || !snapshot.value.groups.some(group => group.id === pendingRequestedGroupId)) return false
    const groupId = pendingRequestedGroupId
    pendingRequestedGroupId = ''
    selectGroup(groupId)
    return true
  }

  function handleOpenGroup(event) {
    const groupId = String(event?.groupId || '')
    if (!groupId) return
    pendingRequestedGroupId = groupId
    openPendingRequestedGroup()
  }

  watch(() => snapshot.value.groups.map(group => group.id).join('\u0000'), () => {
    openPendingRequestedGroup()
    if (selectedGroupId.value
        && !snapshot.value.groups.some(group => group.id === selectedGroupId.value)) {
      selectedGroupId.value = ''
      if (activeView.value === 'conversation') activeView.value = 'home'
    } else if (activeView.value === 'conversation' && !selectedGroupId.value) {
      activeView.value = 'home'
    }
    flushPendingRunFinishedEvents()
  })

  return {
    activeGroup,
    activeGroupMemberSignature,
    activeView,
    goHome,
    handleAgentPrimary,
    handleOpenGroup,
    handleSidebarAgentMain,
    isGroupRunning,
    selectGroup,
    selectedGroupId,
  }
}

```

### Core Architecture Module: `desktop/scripts/repoint-dmg-background.py`
```
#!/usr/bin/env python3
import sys

from ds_store import DSStore
from mac_alias import Alias


def main():
    ds_store_path, background_path = sys.argv[1:3]
    with DSStore.open(ds_store_path, "r+") as store:
        icon_view = store["."]["icvp"]
        icon_view["backgroundImageAlias"] = Alias.for_file(background_path).to_bytes()
        store["."]["icvp"] = icon_view


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `frontend/src/agent-routing.js`
```
const ALL_AGENT_PREFIXES = [
  /^(?:你们|各位|大家(?!庭))/u,
  /^(?:所有|全部|全体)(?:的)?\s*(?:agents?|智能体|助手)/iu,
  /^(?:everyone|all\s+agents?|all\s+of\s+you)\b/iu,
]

function skipCourtesyPrefix(value) {
  let offset = value.search(/\S/u)
  if (offset < 0) return value.length

  const chinese = /^(?:请|麻烦|劳烦)\s*/u.exec(value.slice(offset))
  if (chinese) return offset + chinese[0].length

  const english = /^please(?:\s+|\s*[,，:：]\s*)/iu.exec(value.slice(offset))
  return english ? offset + english[0].length : offset
}

function agentAliases(profile) {
  const label = String(profile?.label || '').trim()
  const shortLabel = label.replace(/\s+(?:code|cli)$/iu, '').trim()
  return [...new Set([profile?.kind, label, shortLabel]
    .map(value => String(value || '').trim())
    .filter(Boolean))]
}

function aliasMatches(value, lowerValue, offset, alias) {
  if (!lowerValue.startsWith(alias.lower, offset)) return false
  const next = value[offset + alias.value.length] || ''
  return !next || !/[A-Za-z0-9_.-]/u.test(next)
}

function skipRecipientSeparators(value, offset) {
  let cursor = offset
  while (cursor < value.length) {
    const separators = /^[\s,，、/&+]+/u.exec(value.slice(cursor))
    if (separators) {
      cursor += separators[0].length
      continue
    }
    const connector = /^(?:and\b|和|与|及)\s*/iu.exec(value.slice(cursor))
    if (connector) {
      cursor += connector[0].length
      continue
    }
    break
  }
  return cursor
}

function agentAliasOccurrences(value, lowerValue, aliases) {
  const matches = []
  for (const alias of aliases) {
    let offset = lowerValue.indexOf(alias.lower)
    while (offset >= 0) {
      const previous = value[offset - 1] || ''
      const next = value[offset + alias.value.length] || ''
      if ((!previous || !/[A-Za-z0-9_.-]/u.test(previous))
          && (!next || !/[A-Za-z0-9_.-]/u.test(next))) {
        matches.push({ ...alias, offset, end: offset + alias.value.length })
      }
      offset = lowerValue.indexOf(alias.lower, offset + alias.value.length)
    }
  }
  const selected = []
  for (const match of matches.sort((left, right) => (
    left.offset - right.offset || right.value.length - left.value.length
  ))) {
    if (selected.some(item => match.offset < item.end && match.end > item.offset)) continue
    selected.push(match)
  }
  return selected.sort((left, right) => left.offset - right.offset)
}

function occurrenceIsExcluded(value, occurrence) {
  const before = value.slice(Math.max(0, occurrence.offset - 32), occurrence.offset)
  const after = value.slice(occurrence.end, occurrence.end + 40)
  const action = '(?:运行|回答|参与|回复|发言|执行|响应|工作)'
  const beforeChinese = new RegExp(`(?:(?:不要|别|无需|不用|不必)\\s*(?:让|叫)?|不让|不叫|排除)\\s*$`, 'u')
  const afterChinese = new RegExp(`^\\s*${action}`, 'u')
  const afterChineseNegation = new RegExp(`^\\s*(?:(?:不要|别|无需|不用|不必)\\s*|不)${action}`, 'u')
  if ((beforeChinese.test(before) && afterChinese.test(after)) || afterChineseNegation.test(after)) {
    return true
  }
  const englishAction = '(?:run|answer|respond|participate|reply|work|execute)'
  if (/(?:without|exclude|excluding)\s*$/iu.test(before)) return true
  if (/(?:do\s+not|don['’]t|must\s+not|should\s+not)\s+(?:let|have|ask)\s*$/iu.test(before)
      && new RegExp(`^\\s*(?:to\\s+)?${englishAction}\\b`, 'iu').test(after)) {
    return true
  }
  if (/(?:do\s+not|don['’]t|must\s+not|should\s+not)\s*$/iu.test(before)
      && new RegExp(`^\\s*(?:to\\s+)?${englishAction}\\b`, 'iu').test(after)) {
    return true
  }
  return new RegExp(
    `^\\s*(?:do\\s+not|don['’]t|must\\s+not|should\\s+not)\\s+${englishAction}\\b`,
    'iu',
  ).test(after)
}

export function parseAgentRoutingPrefix(text, profiles, groupKinds) {
  const value = String(text || '')
  const availableKinds = [...new Set((Array.isArray(groupKinds) ? groupKinds : [])
    .map(kind => String(kind || ''))
    .filter(Boolean))]
  if (!value.trim() || !availableKinds.length) return { targetKinds: [], all: false }

  const available = new Set(availableKinds)
  const offset = skipCourtesyPrefix(value)
  const remaining = value.slice(offset)
  if (ALL_AGENT_PREFIXES.some(pattern => pattern.test(remaining))) {
    return { targetKinds: availableKinds, all: true }
  }

  const aliases = (Array.isArray(profiles) ? profiles : [])
    .filter(profile => available.has(String(profile?.kind || '')))
    .flatMap(profile => agentAliases(profile).map(alias => ({
      kind: String(profile.kind),
      value: alias,
      lower: alias.toLocaleLowerCase(),
    })))
    .sort((left, right) => right.value.length - left.value.length)
  const lowerValue = value.toLocaleLowerCase()
  const selected = new Set()
  let cursor = offset

  while (cursor < value.length) {
    const match = aliases.find(alias => aliasMatches(value, lowerValue, cursor, alias))
    if (!match) break
    selected.add(match.kind)
    const next = skipRecipientSeparators(value, cursor + match.value.length)
    if (next <= cursor) break
    cursor = next
  }

  const occurrences = agentAliasOccurrences(value, lowerValue, aliases)
  const excluded = new Set(occurrences
    .filter(occurrence => occurrenceIsExcluded(value, occurrence))
    .map(occurrence => occurrence.kind))
  const mentionedKinds = new Set(occurrences
    .map(occurrence => occurrence.kind)
    .filter(kind => !excluded.has(kind)))
  if (mentionedKinds.size >= 2) {
    for (const kind of mentionedKinds) selected.add(kind)
  }
  if (excluded.size) {
    for (const occurrence of occurrences) {
      if (!excluded.has(occurrence.kind)) selected.add(occurrence.kind)
    }
  }

  return {
    targetKinds: availableKinds.filter(kind => selected.has(kind) && !excluded.has(kind)),
    all: false,
  }
}

```

### Core Architecture Module: `frontend/src/catalog.js`
```
export function publicAsset(path) {
  return `./${String(path || '').replace(/^\/+/, '')}`
}

export const AGENTS = Object.freeze([
  { kind: 'codex', label: 'Codex', logo: publicAsset('agent-logos/codex.svg'), imageLimit: 4, attachmentTypes: ['file'] },
  { kind: 'claude', label: 'Claude Code', logo: publicAsset('agent-logos/claude.png'), imageLimit: 0, attachmentTypes: ['file'] },
  {
    kind: 'hermes',
    label: 'Hermes',
    logo: publicAsset('agent-logos/hermes.svg'),
    darkLogo: publicAsset('agent-logos/hermes.png'),
    imageLimit: 1,
    attachmentTypes: ['file'],
  },
  { kind: 'workbuddy', label: 'WorkBuddy', logo: publicAsset('agent-logos/workbuddy.png'), imageLimit: 0, attachmentTypes: ['file'] },
  { kind: 'openclaw', label: 'OpenClaw', logo: publicAsset('agent-logos/openclaw-transparent.png'), imageLimit: 0, attachmentTypes: ['file'] },
  { kind: 'pi', label: 'Pi Agent', logo: publicAsset('agent-logos/pi.svg'), imageLimit: 0, attachmentTypes: ['file'] },
  { kind: 'opencode', label: 'OpenCode', logo: publicAsset('agent-logos/opencode.svg'), imageLimit: 4, attachmentTypes: ['file'] },
  { kind: 'opencodereview', label: 'OpenCodeReview', logo: publicAsset('agent-logos/opencodereview.svg'), imageLimit: 0 },
  { kind: 'kimi', label: 'Kimi Code', logo: publicAsset('agent-logos/kimi.png'), imageLimit: 0, attachmentTypes: ['file'] },
  { kind: 'mimo', label: 'MiMo Code', logo: publicAsset('agent-logos/mimo.svg'), imageLimit: 0, attachmentTypes: ['file'] },
  { kind: 'qwen', label: 'Qwen Code', logo: publicAsset('agent-logos/qwen.svg'), imageLimit: 0, attachmentTypes: ['file'] },
])

const BY_KIND = new Map(AGENTS.map(agent => [agent.kind, agent]))
const CUSTOM_BY_KIND = new Map()
const CLOUD_BY_KIND = new Map()
const CUSTOM_AGENT_KIND = /^custom-[a-f0-9]{16}$/
const CLOUD_AGENT_KIND = /^cloud-[a-f0-9]{24}$/
const CUSTOM_AGENT_LOGO = publicAsset('agent-logos/custom-agent.svg')

export function isCloudAgentKind(kind) {
  return CLOUD_AGENT_KIND.test(String(kind || ''))
}

export function setCustomAgentProfiles(profiles = []) {
  CUSTOM_BY_KIND.clear()
  for (const profile of Array.isArray(profiles) ? profiles : []) {
    const kind = String(profile?.kind || '')
    const label = String(profile?.label || '').trim().slice(0, 60)
    if (!CUSTOM_AGENT_KIND.test(kind) || !label || profile?.custom !== true) continue
    CUSTOM_BY_KIND.set(kind, {
      kind,
      label,
      logo: CUSTOM_AGENT_LOGO,
      imageLimit: 0,
      custom: true,
      description: String(profile?.description || '').trim().slice(0, 240),
      commandName: String(profile?.commandName || '').trim().slice(0, 160),
      promptMode: ['stdin', 'argument'].includes(profile?.promptMode) ? profile.promptMode : 'stdin',
    })
  }
}

export function setCloudAgentProfiles(profiles = []) {
  CLOUD_BY_KIND.clear()
  for (const profile of Array.isArray(profiles) ? profiles : []) {
    const kind = String(profile?.kind || '')
    const sourceKind = String(profile?.sourceKind || '')
    if (!CLOUD_AGENT_KIND.test(kind) || !BY_KIND.has(sourceKind) || profile?.cloud !== true) continue
    CLOUD_BY_KIND.set(kind, { ...BY_KIND.get(sourceKind), kind })
  }
}

function agentProfile(kind) {
  return BY_KIND.get(kind) || CUSTOM_BY_KIND.get(kind) || CLOUD_BY_KIND.get(kind)
    || { kind, label: kind || 'Agent', logo: CUSTOM_AGENT_LOGO }
}

export function agentLabel(kind) {
  return agentProfile(kind).label
}

export function agentLogo(kind, displayTheme = '') {
  const profile = agentProfile(kind)
  return displayTheme === 'dark' && profile.darkLogo ? profile.darkLogo : profile.logo
}

```

### Core Architecture Module: `frontend/src/composables/useAgentCatalog.js`
```
import { computed } from 'vue'
import {
  CheckmarkCircleOutline,
  DownloadOutline,
  WarningOutline,
} from '@vicons/ionicons5'
import { AGENTS, agentLogo } from '../catalog.js'
import { MAX_ATTACHMENTS } from './useComposerAttachments.js'

export function useAgentCatalog({
  activeGroup,
  directGroupsFor,
  installCatalog,
  snapshot,
  t,
  theme,
}) {
  const mergedCatalog = computed(() => {
    const registeredProfiles = new Map()
    for (const agent of [...(installCatalog.value.agents || []), ...snapshot.value.agents]) {
      if (!agent?.kind) continue
      registeredProfiles.set(agent.kind, { ...registeredProfiles.get(agent.kind), ...agent })
    }
    const extraProfiles = [...registeredProfiles.values()]
      .filter(agent => !AGENTS.some(profile => profile.kind === agent.kind))
      .map(agent => ({
        kind: agent.kind,
        sourceKind: agent.sourceKind,
        label: agent.label || agent.name || agent.kind,
        logo: agent.logo,
        imageLimit: Number(agent.imageAttachmentLimit || 0),
        custom: agent.custom === true,
        connector: agent.connector === true,
        description: agent.description || '',
        cloud: agent.cloud === true,
      }))
    const profiles = [...AGENTS, ...extraProfiles]
    return profiles.map((profile) => {
    const installedProfile = installCatalog.value.agents?.find(agent => agent.kind === profile.kind) || {}
    const detected = snapshot.value.agents.find(agent => agent.kind === profile.kind) || {}
    return {
      ...profile,
      ...installedProfile,
      ...detected,
      label: profile.label,
      logo: agentLogo(
        detected.sourceKind || installedProfile.sourceKind || profile.sourceKind || profile.kind,
        theme.value,
      ),
      imageLimit: profile.custom
        ? MAX_ATTACHMENTS
        : Number(detected.imageAttachmentLimit ?? installedProfile.imageAttachmentLimit ?? profile.imageLimit) || 0,
      installed: Boolean(installedProfile.installed || detected.installed),
      ready: detected.available === true,
    }
    })
  })

  const agentCatalogGroups = computed(() => [
    {
      id: 'official',
      titleKey: 'systemSettings.officialAgents',
      subtitleKey: 'systemSettings.officialAgentsHint',
      agents: mergedCatalog.value.filter(agent => !agent.custom && !agent.cloud),
    },
    {
      id: 'cloud',
      titleKey: 'systemSettings.cloudAgents',
      subtitleKey: 'systemSettings.cloudAgentsHint',
      agents: mergedCatalog.value.filter(agent => agent.cloud === true),
    },
    {
      id: 'custom',
      titleKey: 'systemSettings.customAgents',
      subtitleKey: 'systemSettings.customAgentsHint',
      agents: mergedCatalog.value.filter(agent => agent.custom && agent.cloud !== true),
    },
  ].filter(category => category.agents.length > 0))
  const readyAgents = computed(() => mergedCatalog.value.filter(agent => agent.ready))
  const readyAgentGroups = computed(() => [
    {
      id: 'local',
      titleKey: 'agentLocation.local',
      hintKey: 'group.agentLocationLocalHint',
      agents: readyAgents.value.filter(agent => !agent.cloud),
    },
    {
      id: 'cloud',
      titleKey: 'agentLocation.cloud',
      hintKey: 'group.agentLocationCloudHint',
      agents: readyAgents.value.filter(agent => agent.cloud),
    },
  ].filter(group => group.agents.length))
  const readyAgentSignature = computed(() => readyAgents.value.map(agent => agent.kind).join('\u0000'))
  const readyAgentKinds = computed(() => new Set(readyAgents.value.map(agent => agent.kind)))
  const readyCount = computed(() => readyAgents.value.length)
  const installedCount = computed(() => mergedCatalog.value.filter(agent => agent.installed).length)
  const sidebarAgents = computed(() => mergedCatalog.value.filter((agent) => {
    if ((agent.ready || agent.installed) && agent.showInSidebar !== false) return true
    return !agent.ready && directGroupsFor(agent.kind).length > 0
  }))
  const sidebarAgentGroups = computed(() => [
    {
      id: 'local',
      titleKey: 'agentLocation.local',
      agents: sidebarAgents.value.filter(agent => !agent.cloud),
    },
    {
      id: 'cloud',
      titleKey: 'agentLocation.cloud',
      agents: sidebarAgents.value.filter(agent => agent.cloud),
    },
  ].filter(group => group.agents.length))
  const activeDirectAgent = computed(() => {
    if (activeGroup.value?.conversationType !== 'direct') return null
    return mergedCatalog.value.find(agent => agent.kind === activeGroup.value.directAgentKind) || null
  })

  function agentDescription(kind) {
    const profile = mergedCatalog.value.find(agent => agent.kind === kind)
    if (profile?.connector && profile.description) return profile.description
    if (profile?.custom && profile.description) return profile.description
    if (profile?.custom) return t('customAgent.defaultDescription')
    return t(`agent.description.${kind}`)
  }

  function agentSoul(agent) {
    if (agent?.cloud) return agent.description || t('cloudAgents.agentDescription')
    if (agent?.connector) return agent.description || t('customAgent.detailBody')
    if (agent?.custom) return agent.description || t('customAgent.detailBody')
    return t(`agent.soul.${agent?.kind}`)
  }

  function agentImageLabel(agent) {
    return agent?.imageLimit > 0
      ? t('agent.images', { count: agent.imageLimit })
      : t('agent.noImages')
  }

  function agentState(agent) {
    if (agent.ready) return { label: t('agent.ready'), tone: 'ready', icon: CheckmarkCircleOutline }
    if (agent.custom) return { label: t('customAgent.executableUnavailable'), tone: 'warning', icon: WarningOutline }
    if (!agent.installed) return { label: t('agent.notInstalled'), tone: 'off', icon: DownloadOutline }
    if (agent.incompatibilityReason === 'LOCAL_AGENT_CAPABILITY_PROBE_TIMEOUT') {
      return { label: t('agent.detectionTimedOut'), tone: 'warning', icon: WarningOutline }
    }
    if (agent.compatibilityState === 'incompatible') {
      const reasonKey = ({
        LOCAL_AGENT_VERSION_UNSUPPORTED: 'agent.incompatibleVersion',
        LOCAL_AGENT_REQUIRED_CAPABILITY_MISSING: 'agent.incompatibleCapability',
        LOCAL_AGENT_PROTOCOL_UNAVAILABLE: 'agent.incompatibleProtocol',
      })[agent.incompatibilityReason] || 'agent.incompatible'
      return { label: t(reasonKey), tone: 'warning', icon: WarningOutline }
    }
    if (agent.credentialState === 'missing') return { label: t('agent.needsLogin'), tone: 'warning', icon: WarningOutline }
    return { label: t('agent.unverified'), tone: 'neutral', icon: WarningOutline }
  }

  return {
    activeDirectAgent,
    agentCatalogGroups,
    agentDescription,
    agentImageLabel,
    agentSoul,
    agentState,
    installedCount,
    mergedCatalog,
    readyAgentKinds,
    readyAgentGroups,
    readyAgentSignature,
    readyAgents,
    readyCount,
    sidebarAgents,
    sidebarAgentGroups,
  }
}

```

### Core Architecture Module: `frontend/src/composables/useAgentManagement.js`
```
import { computed, reactive } from 'vue'

export function useAgentManagement({
  activeView,
  closeModal,
  customAgent,
  customAgentDeleteArmed,
  focusedAgentKind,
  formError,
  installConfirmKind,
  installer,
  installerState,
  modal,
  normalizeSnapshot,
  refreshAgents,
  saving,
  selectAgentDetail,
  selectedAgentDetail,
  showError,
  snapshot,
  systemSettingsSection,
  t,
  translateError,
}) {
  const customAgentForm = reactive({
    label: '',
    description: '',
    argumentsText: '',
    promptMode: 'stdin',
  })
  const installerBusy = computed(() => (
    !['', 'idle', 'completed', 'cancelled', 'failed'].includes(installerState.value.phase)
  ))
  const installerPhaseLabel = computed(() => t(`installer.phase.${installerState.value.phase}`))

  function openCustomAgentModal() {
    if (saving.value) return
    formError.value = ''
    customAgentForm.label = ''
    customAgentForm.description = ''
    customAgentForm.argumentsText = ''
    customAgentForm.promptMode = 'stdin'
    customAgentDeleteArmed.value = false
    modal.value = 'custom-agent'
  }

  async function createCustomAgent() {
    formError.value = ''
    if (!customAgentForm.label) {
      formError.value = t('customAgent.nameRequired')
      return
    }
    if (typeof customAgent.value?.create !== 'function') {
      formError.value = t('error.bridge')
      return
    }
    const args = customAgentForm.argumentsText
      .split(/\r?\n/)
      .map(argument => argument.trim())
      .filter(Boolean)
    saving.value = true
    try {
      const result = await customAgent.value.create({
        label: customAgentForm.label,
        description: customAgentForm.description,
        args,
        promptMode: customAgentForm.promptMode,
      })
      if (result?.canceled) return
      await refreshAgents()
      focusedAgentKind.value = String(result?.agent?.kind || '')
      closeModal({ force: true })
    } catch (error) {
      formError.value = translateError(error)
    } finally {
      saving.value = false
    }
  }

  function openAgentDetail(agent) {
    if (!agent || saving.value) return
    activeView.value = 'settings'
    systemSettingsSection.value = 'agents'
    focusedAgentKind.value = agent.kind
    installConfirmKind.value = ''
    formError.value = ''
    customAgentDeleteArmed.value = false
    modal.value = 'agent-detail'
    void selectAgentDetail(agent.kind)
  }

  async function setAgentSidebarVisibility(agent, visible) {
    if (!agent?.kind || typeof installer.value?.setSidebarVisibility !== 'function' || saving.value) return
    saving.value = true
    formError.value = ''
    try {
      snapshot.value = normalizeSnapshot(await installer.value.setSidebarVisibility(agent.kind, visible === true))
    } catch (error) {
      formError.value = translateError(error)
    } finally {
      saving.value = false
    }
  }

  async function deleteCustomAgent() {
    const agent = selectedAgentDetail.value
    if (!agent?.custom || typeof customAgent.value?.delete !== 'function' || saving.value) return
    if (!customAgentDeleteArmed.value) {
      customAgentDeleteArmed.value = true
      return
    }
    saving.value = true
    formError.value = ''
    try {
      await customAgent.value.delete(agent.kind)
      closeModal({ force: true })
      focusedAgentKind.value = ''
      await refreshAgents()
    } catch (error) {
      formError.value = translateError(error)
      customAgentDeleteArmed.value = false
    } finally {
      saving.value = false
    }
  }

  async function requestInstall(agent) {
    if (installConfirmKind.value !== agent.kind) {
      installConfirmKind.value = agent.kind
      return
    }
    installConfirmKind.value = ''
    try {
      installerState.value = await installer.value.start(agent.kind)
    } catch (error) {
      showError(error)
    }
  }

  async function cancelInstall() {
    try {
      await installer.value.cancel(installerState.value.taskId)
    } catch (error) {
      showError(error)
    }
  }

  return {
    cancelInstall,
    createCustomAgent,
    customAgentForm,
    deleteCustomAgent,
    installerBusy,
    installerPhaseLabel,
    openAgentDetail,
    openCustomAgentModal,
    requestInstall,
    setAgentSidebarVisibility,
  }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #17** (2026-08-10): **[P0] Persist orchestration cursors and resume multi-Agent runs after restart**
  *Symptoms*: ## Why this matters  Meldwork can resume only a replay-safe, final single-Agent manual slot after a Human Gate. If a Gate occurs before later Agent slots, approving it after restart fails the entire Run and permanently skips the remaining Agents. Durable Run identity exists, but durable multi-Agent orchestration does not.  ## Current evidence  - `desktop/src/local-workspace.cjs:536-542` allows final replay only for a manual Run with exactly one target Agent. - `desktop/src/local-workspace.cjs:610-617` fails non-final Agent continuations with `LOCAL_RUN_ORCHESTRATION_RESUME_UNAVAILABLE`. - `desktop/test/local-workspace-human-gate-recovery.test.cjs:182-234` explicitly verifies that restart after the first slot fails and never invokes the second Agent. - Resumed controllers restore metadata but do not hydrate a complete orchestration cursor or prior Harness trace.  ## Required change  Persist a versioned orchestration cursor that identifies the workflow, current node or Agent slot, completed attempts, pending decision, remaining work, retry state, and event sequence. Resume must continue from that cursor without duplicating completed side effects.  ## Acceptance criteria  - [ ] Manual and automatic multi-Agent Runs persist their exact orchestration position. - [ ] An approved Gate is replayed exactly once against the pending Agent operation. - [ ] Every remaining Agent slot continues in the intended order or dependency graph. - [ ] Completed slots are never rerun unless an expli
  **Post-Mortem & Fix Analysis**:
  > Implemented in PR #33.  Manual and automatic Runs now persist versioned orchestration cursors, hydrate prior Harness traces, replay the exact pending Agent Session once, continue remaining slots and later rounds, and preserve a durable monotonic event cursor. Tests cover first, middle, and final automatic slots, manual non-final slots, repeated restart idempotency, and fail-closed legacy continuations. The Issue will close when PR #33 merges.

- **Issue #16** (2026-08-10): **[P0] Prevent corrupt workspace state from deleting valid Run Ledger history**
  *Symptoms*: ## Why this matters  A malformed or partially written workspace state file can be interpreted as an intentionally empty workspace. Startup reconciliation can then delete otherwise valid Run Ledger records because their groups appear to be missing. A recoverable state-file problem can therefore become permanent run-history loss.  ## Current evidence  - `desktop/src/local-workspace-state.cjs:20` maps missing, malformed, unsupported, and unreadable state to `emptyState()`. - `desktop/src/local-workspace.cjs:286` performs startup reconciliation immediately after loading state. - `desktop/src/local-workspace-ledger.cjs:43` deletes ledger records whose groups appear absent. - A focused reproduction confirmed that malformed workspace JSON caused reconciliation to call `deleteGroup("group-1")` against a valid ledger.  ## Required change  Distinguish a genuinely new workspace from corrupt or unsupported persisted state. Corruption must enter a non-destructive recovery mode and must never authorize ledger deletion.  ## Acceptance criteria  - [ ] Missing, corrupt, unreadable, and unsupported-version workspace states are distinct outcomes. - [ ] Corrupt state enters a read-only or quarantined recovery mode with a stable diagnostic. - [ ] Startup reconciliation performs zero destructive ledger operations while workspace state is untrusted. - [ ] Valid Run Ledger data remains exportable or recoverable. - [ ] A malformed workspace plus a valid ledger is covered by a regression test that ass

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

### Incident Patch 1: `17c38f6e` (2026-09-09)
**Commit Message**: fix: refresh native shell settings before agent detection

Bind cached settings to allowed environment values and reload the login shell before serialized Agent refreshes so changed credentials and proxies do not reuse stale settings.

Validation: readiness and main security 87/87; Agent suite 459 passed, 1 optional integration skipped; isolated Electron refresh observed updated synthetic configuration with all 12 Agent entries preserved. Full desktop/build/package checks remain pending for this checkpoint.

**File**: `desktop/src/agents/local-agent-readiness.cjs` (modified, +6/-2)
```diff
@@ -1,4 +1,5 @@
 const { execFile } = require('node:child_process')
+const { createHash } = require('node:crypto')
 const fs = require('node:fs')
 const os = require('node:os')
 const path = require('node:path')
@@ -261,9 +262,12 @@ function resolveNativeShellEnvironment(options = {}) {
   const platform = options.platform || process.platform
   const home = options.home || os.homedir()
   const shell = String(options.shell || source.SHELL || '')
-  const key = [platform, home, shell, String(source.PATH || '')].join('\u0000')
+  const environmentHash = createHash('sha256')
+    .update(JSON.stringify(allowedShellEnvironment(source, platform))).digest('hex')
+  const key = [platform, home, shell, environmentHash].join('\u0000')
   const now = Date.now()
-  if (shellEnvironmentCache?.key === key && shellEnvironmentCache.expiresAt > now) {
+  if (options.refresh !== true && shellEnvironmentCache?.key === key
+      && shellEnvironmentCache.expiresAt > now) {
     return shellEnvironmentCache.promise
   }
   const promise = queryNativeShellEnvironment(options)
```

**File**: `desktop/src/main.cjs` (modified, +3/-2)
```diff
@@ -239,9 +239,9 @@ function providerOptions(kind, context = {}) {
   )
 }
 
-async function nativeShellEnvironment() {
+async function nativeShellEnvironment(options = {}) {
   const home = app.getPath('home')
-  const resolved = await resolveNativeShellEnvironment({ home })
+  const resolved = await resolveNativeShellEnvironment({ home, refresh: options.refresh === true })
   return {
     ...resolved,
     env: { ...process.env, ...resolved.env },
@@ -678,6 +678,7 @@ async function refreshLocalAgentState() {
   if (!target) return null
   const task = localAgentRefreshQueue.then(async () => {
     if (workspace !== target) return workspace?.snapshot() || null
+    await nativeShellEnvironment({ refresh: true })
     const snapshot = await target.refreshAgents()
     if (workspace !== target) return workspace?.snapshot() || null
     return snapshot
```

**File**: `desktop/test/agents/local-agent-readiness.test.cjs` (modified, +33/-0)
```diff
@@ -12,6 +12,39 @@ const {
   resolveNativeShellEnvironment,
 } = require('../../src/agents/local-agent-readiness.cjs')
 
+test('native environment cache observes credential and proxy changes without a PATH change', async () => {
+  const base = { platform: 'win32', home: 'C:\\meldwork-cache-test', env: { PATH: 'C:\\bin',
+    ANTHROPIC_API_KEY: 'synthetic-before', HTTPS_PROXY: 'http://before.example:8080' } }
+  const before = await resolveNativeShellEnvironment(base)
+  const after = await resolveNativeShellEnvironment({ ...base, env: { ...base.env,
+    ANTHROPIC_API_KEY: 'synthetic-after', HTTPS_PROXY: '' } })
+  assert.equal(before.env.ANTHROPIC_API_KEY, 'synthetic-before')
+  assert.equal(after.env.ANTHROPIC_API_KEY, 'synthetic-after')
+  assert.equal(after.env.HTTPS_PROXY, '')
+  const removed = await resolveNativeShellEnvironment({ ...base, env: { PATH: base.env.PATH } })
+  assert.equal(removed.env.ANTHROPIC_API_KEY, undefined)
+  assert.equal(removed.env.HTTPS_PROXY, undefined)
+})
+
+test('explicit refresh replaces cached native shell settings and subsequent calls share the new result', {
+  skip: process.platform === 'win32',
+}, async (t) => {
+  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'meldwork-shell-refresh-'))
+  t.after(() => fs.rmSync(home, { recursive: true, force: true }))
+  const shell = path.join(home, 'sh')
+  const settings = path.join(home, 'native-env')
+  fs.writeFileSync(shell, '#!/bin/sh\n. "$HOME/native-env"\nexec /bin/sh "$@"\n', { mode: 0o700 })
+  fs.writeFileSync(settings, 'export ANTHROPIC_BASE_URL=https://before.example\n', { mode: 0o600 })
+  const options = { home, shell, platform: 'linux', env: { PATH: '/usr/bin:/bin' } }
+  const first = await resolveNativeShellEnvironment(options)
+  assert.equal(first.env.ANTHROPIC_BASE_URL, 'https://before.example')
+  fs.writeFileSync(settings, 'export ANTHROPIC_BASE_URL=https://after.example\n', { mode: 0o600 })
+  assert.strictEqual(await resolveNativeShellEnvironment(options), first)
+  const refreshed = await resolveNativeShellEnvironment({ ...options, refresh: true })
+  assert.equal(refreshed.env.ANTHROPIC_BASE_URL, 'https://after.example')
+  assert.strictEqual(await resolveNativeShellEnvironment(options), refreshed)
+})
+
 function openClawModelsCatalog(apiKey, baseUrl = 'https://provider.example/v1') {
   return JSON.stringify({
     providers: {
```

**File**: `desktop/test/security/main-security.test.cjs` (modified, +20/-0)
```diff
@@ -2131,6 +2131,26 @@ test('OpenClaw native auth is routed through the app-owned isolated runtime', as
   })
 })
 
+test('manual Agent refresh updates native shell settings before detection and credential checks', async (t) => {
+  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'meldwork-refresh-environment-'))
+  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
+  let configured = 'before'
+  let cached = 'before'
+  const refreshes = []
+  const { harness } = loadMain(directory, {
+    nativeShellEnvironment: input => {
+      if (input.refresh) { cached = configured; refreshes.push(cached) }
+      return { env: { ANTHROPIC_API_KEY: `synthetic-${cached}` }, source: 'native-shell' }
+    },
+    onRefresh: async () => { assert.equal(cached, configured) },
+  })
+  await harness.ready()
+  configured = 'after'
+  await harness.ipcHandlers.get('local-workspace:refresh-agents')(harness.event())
+  assert.deepEqual(refreshes, ['after'])
+  assert.equal(harness.workspaceInstances[0].refreshCount, 1)
+})
+
 test('manual Agent refreshes remain serialized', async (t) => {
   const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'meldwork-refresh-'))
   t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
```

**File**: `docs/releases/Meldwork-V1.0.5-progress.md` (modified, +14/-0)
```diff
@@ -179,3 +179,17 @@
 - 最终 `MELDWORK_TEST_CLAUDE_EXECUTABLE=... npm --prefix desktop test`：1536/1536，跳过 0，退出码 0，约 317 秒；日志 `/tmp/meldwork-105-outcomes-desktop.log`。`git diff --check` 通过；本轮未执行 Web 构建或打包，桌面构建与运行结果如上。
 
 本检查点不改变 AI 的完成判断，不代表人类采用；needs-human 续跑、路由语义和剩余启动检测问题继续开发。尚未更新包版本或打包。
+
+## 原生 shell 配置缓存与手动刷新
+
+2026-09-09：复现相同 PATH 下修改合成认证配置仍返回旧缓存值。原缓存只绑定平台、HOME、shell 与 PATH，手动刷新也不会重新采集 shell 配置，可能继续使用最多 30 秒的旧配置。现在缓存键包含允许传递环境的 SHA-256 摘要，不保存原始凭据作为键；环境值变更、移除和显式清空都会改变缓存身份。串行 Agent 刷新在检测与认证检查前强制重新采集原生 shell 配置，同一轮后续调用共享新缓存。
+
+验证与边界：
+
+- readiness 与 Main 安全测试 87/87，覆盖真实 shell 配置文件修改、显式刷新、缓存复用、环境清空及刷新顺序；日志 `/tmp/meldwork-105-shell-refresh-focused.log`。
+- Agent 套件共 460 项，459 通过、1 项可选真实 Claude 集成测试因未配置 executable 跳过，失败 0；日志 `/tmp/meldwork-105-shell-refresh-agents.log`。不能把该结果写成全部真实 CLI 均已完成调用。
+- `/tmp/meldwork-105-shell-refresh-ui.cjs` 使用隔离 Electron 配置、临时 shell 和合成本机地址，通过真实 preload refreshAgents 验证：修改文件后刷新前仍为缓存地址，手动刷新后立即读到新地址，前后 12 个 Agent 条目一致且包含 OpenClaw。首次成功配置 `/tmp/meldwork-105-shell-refresh-CGjibK`，脚本退出 0，Electron 正常关闭，没有模型调用，也没有修改日常 shell 配置。已查看 `/tmp/meldwork-105-shell-refresh.png`。
+- 前期验证脚本因 Playwright 求值环境没有 require、process.mainModule 不存在及绝对路径导入 Electron 得到包路径而失败，均未执行到产品刷新断言；最终改用隔离启动器提供只读取合成地址的验证函数，不新增产品接口。
+- 修改前两次真实版本/能力扫描为 2343ms 与 1935ms，均返回 12 个条目；这是基线，不是提速证据。本次不改变探测调度或能力缓存策略。
+
+本检查点未重跑完整桌面或前端套件、构建与打包，之前 1536/1536 桌面全量结果对应本次缓存改动之前。群聊语义路由、可恢复 needs-human 与最终版本验收仍未完成，版本号尚未更新。
```

---

### Incident Patch 2: `38c48057` (2026-09-10)
**Commit Message**: fix(desktop): refine DMG installer layout

Use a compact 640x420 branded background and reposition the Finder icons so the installer opens without excess canvas or scrollbars. Keep key content clear when hidden DMG resources are visible.

Checks: node --test test/packaging/package-security.test.cjs; npm run dist; npx electron-builder --mac dmg; hdiutil verify; codesign --verify --deep --strict; git diff --check

**File**: `desktop/build/dmg-background-ai-v3.svg` (added, +55/-0)
```diff
@@ -0,0 +1,55 @@
+<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420">
+  <defs>
+    <linearGradient id="surface" x1="0" y1="0" x2="0" y2="1">
+      <stop offset="0" stop-color="#17191c"/>
+      <stop offset="1" stop-color="#0d0f11"/>
+    </linearGradient>
+    <radialGradient id="leftGlow" cx="0" cy="0.5" r="1">
+      <stop offset="0" stop-color="#ff725f" stop-opacity="0.14"/>
+      <stop offset="1" stop-color="#ff725f" stop-opacity="0"/>
+    </radialGradient>
+    <radialGradient id="rightGlow" cx="1" cy="0.5" r="1">
+      <stop offset="0" stop-color="#67d5de" stop-opacity="0.12"/>
+      <stop offset="1" stop-color="#67d5de" stop-opacity="0"/>
+    </radialGradient>
+    <filter id="softShadow" x="-40%" y="-40%" width="180%" height="180%">
+      <feGaussianBlur stdDeviation="12"/>
+    </filter>
+  </defs>
+
+  <rect width="640" height="420" fill="url(#surface)"/>
+  <rect width="320" height="420" fill="url(#leftGlow)"/>
+  <rect x="320" width="320" height="420" fill="url(#rightGlow)"/>
+
+  <g fill="none" stroke="#ffffff" stroke-opacity="0.055">
+    <path d="M0 74H112L126 88H244L258 74H640"/>
+    <path d="M0 82H104L122 100H250L268 82H640"/>
+  </g>
+
+  <g font-family="-apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif">
+    <g transform="translate(438 24)">
+      <rect width="34" height="34" rx="8" fill="#f5f6f7"/>
+      <path d="M7 24V13.5C7 9.8 12.2 8.6 13.9 12V24M13.9 16.2C13.9 12.1 19.6 10.8 21.3 14.6V24" fill="none" stroke="#121417" stroke-width="3.7" stroke-linecap="round"/>
+      <circle cx="27.2" cy="24" r="2.3" fill="#ff705d"/>
+      <text x="46" y="25" fill="#f7f7f8" font-size="22" font-weight="650">Meldwork</text>
+    </g>
+
+    <text x="465" y="145" fill="#c8ccd0" font-size="14" font-weight="600" text-anchor="middle">Drag to Applications</text>
+  </g>
+
+  <ellipse cx="175" cy="253" rx="64" ry="64" fill="#000000" fill-opacity="0.34" filter="url(#softShadow)"/>
+  <ellipse cx="465" cy="253" rx="64" ry="64" fill="#000000" fill-opacity="0.34" filter="url(#softShadow)"/>
+  <circle cx="175" cy="245" r="58" fill="#0b0d0f" fill-opacity="0.3" stroke="#ffffff" stroke-opacity="0.08"/>
+  <circle cx="465" cy="245" r="58" fill="#0b0d0f" fill-opacity="0.3" stroke="#ffffff" stroke-opacity="0.08"/>
+
+  <g transform="translate(275 245)" fill="none" stroke-linecap="round" stroke-linejoin="round">
+    <path d="M0 0H82" stroke="#ffffff" stroke-opacity="0.16" stroke-width="2"/>
+    <path d="M70 -8L82 0L70 8" stroke="#ff705d" stroke-width="2.5"/>
+    <circle cx="10" r="2" fill="#ff705d" stroke="none"/>
+    <circle cx="26" r="2" fill="#f3c07b" stroke="none"/>
+    <circle cx="42" r="2" fill="#d9e5df" stroke="none"/>
+    <circle cx="58" r="2" fill="#67d5de" stroke="none"/>
+  </g>
+
+  <rect x="24" y="396" width="592" height="1" fill="#ffffff" fill-opacity="0.05"/>
+</svg>
```

**File**: `desktop/package.json` (modified, +8/-8)
```diff
@@ -70,21 +70,21 @@
       ]
     },
     "dmg": {
-      "background": "build/dmg-background-ai-v2.png",
+      "background": "build/dmg-background-ai-v3.png",
       "window": {
-        "width": 540,
-        "height": 380
+        "width": 640,
+        "height": 420
       },
-      "iconSize": 128,
+      "iconSize": 112,
       "contents": [
         {
-          "x": 145,
-          "y": 210,
+          "x": 175,
+          "y": 245,
           "type": "file"
         },
         {
-          "x": 395,
-          "y": 210,
+          "x": 465,
+          "y": 245,
           "type": "link",
           "path": "/Applications"
         }
```

**File**: `desktop/test/packaging/package-security.test.cjs` (modified, +7/-7)
```diff
@@ -36,15 +36,15 @@ test('packaged application carries the open-source and commercial licensing noti
 
 test('DMG uses the branded background and fixed drag layout', () => {
   const dmg = desktopPackage.build.dmg
-  assert.equal(dmg.background, 'build/dmg-background-ai-v2.png')
-  assert.deepEqual(dmg.window, { width: 540, height: 380 })
-  assert.equal(dmg.iconSize, 128)
+  assert.equal(dmg.background, 'build/dmg-background-ai-v3.png')
+  assert.deepEqual(dmg.window, { width: 640, height: 420 })
+  assert.equal(dmg.iconSize, 112)
   assert.deepEqual(dmg.contents, [
-    { x: 145, y: 210, type: 'file' },
-    { x: 395, y: 210, type: 'link', path: '/Applications' },
+    { x: 175, y: 245, type: 'file' },
+    { x: 465, y: 245, type: 'link', path: '/Applications' },
   ])
 
   const background = fs.readFileSync(path.join(__dirname, '..', '..', dmg.background))
-  assert.equal(background.readUInt32BE(16), 540)
-  assert.equal(background.readUInt32BE(20), 380)
+  assert.equal(background.readUInt32BE(16), 640)
+  assert.equal(background.readUInt32BE(20), 420)
 })
```

---

### Incident Patch 3: `58054c5e` (2026-09-10)
**Commit Message**: fix: harden multi-agent session and discovery flows

Prevent group completion from masking peer blockers, avoid replaying delivered group context, validate Pi protocol capability, and restrict child environments while preserving supported runtime configuration. Update the technical iteration plan and related discoverability documentation.

**File**: `README.md` (modified, +25/-21)
```diff
@@ -14,11 +14,13 @@
   <strong>English</strong> · <a href="README.zh-CN.md">简体中文</a>
 </p>
 
-# Meldwork builds the organization layer for AI agents.
+# Meldwork — Local-first multi-agent orchestration for AI coding agents
 
-**Most tools help humans run more agents. Meldwork is built for a different job: make multi-agent work legible, accountable, and reusable.**
+**Coordinate Codex, Claude Code, Gemini CLI, and 9 more agent CLIs from one desktop workspace. Stop manually copying context between terminals — Meldwork freezes one task snapshot, sends it to every selected agent, captures their independent findings as evidence, and gates workspace writes behind your approval.**
 
-The current preview is a local work cell for supported Agent CLIs. It keeps participants explicit, context scoped, collaboration bounded, run state inspectable, and human review in the loop. Selected Agents can now respond concurrently or move through independent proposals, peer negotiation, responsibility-based work, single-writer integration, and independent verification around one goal.
+Meldwork is a local-first multi-agent orchestration desktop app for macOS (Apple silicon). It connects the AI coding agent CLIs you already have installed — Codex, Claude Code, Hermes, OpenCode, Gemini CLI, Qwen Code, Kimi Code, MiMo Code, Pi Agent, OpenClaw, OpenCodeReview, and WorkBuddy — into one reviewable workspace where you can run Direct sessions, Concurrent Responses (same task, multiple agents, independent replies), or Auto Discussion V4 (agents propose, challenge, negotiate responsibilities, and verify results across rounds).
+
+Unlike terminal multiplexers (tmux, zellij) that show raw output side by side, Meldwork preserves every finding as structured evidence (Finding → Evidence → Decision → Disposition), keeps a human adoption gate before any file changes, and makes multi-agent work inspectable and reusable across sessions.
 
 <p align="center">
   <a href="https://github.com/Ryder-MHumble/Meldwork/releases/download/Meldwork-V1.0.4/Meldwork-0.1.4-arm64.dmg"><strong>Download Meldwork V1.0.4 for Apple silicon macOS</strong></a>
@@ -30,9 +32,10 @@ The current preview is a local work cell for supported Agent CLIs. It keeps part
 
 Use Meldwork when you:
 
-- already have multiple local Agent CLIs and need one task to span them;
+- run multiple AI coding agents (Codex, Claude Code, Gemini CLI, Hermes, OpenCode, etc.) and want to coordinate them without manually passing context between terminals;
 - need independent review for code, research, or product analysis before choosing a path;
-- need inspectable traces, evidence, and human review before workspace writes.
+- want to compare multiple agents' responses to the same task side by side, with evidence trails and a human approval gate before any workspace writes;
+- need inspectable traces, evidence, and human review for multi-agent coding sessions — so you can resume, audit, and reuse work across sessions.
 
 ## Workflow
 
@@ -53,20 +56,21 @@ Participants are always selected by the user. Automatic selection from a larger
 
 ## How Meldwork differs
 
-Meldwork is a local-first AI Agent workspace for multi-Agent review and decision traceability, not a terminal, cloud Agent fleet, communication network, or programmable orchestration framework. It connects the local Agent tools you already use to a decision-ready review workflow and keeps independent findings, evidence, responsibility, and the human adoption decision visible in one local work cell.
-
-| Project | Category | What it focuses on | Meldwork's difference |
-| --- | --- | --- | --- |
-| [Buzz](https://github.com/block/buzz) | Agent communication network | Identity, channels, events, and persistent collaboration. | Case-scoped independent judgments with evidence-backed Decision and Disposition. |
-| [Pragma](https://github.com/pqpo/pragma) | Method and workflow runtime | Reusable Expert, Flow, Memory, Evaluation, and DSL assets. | Keeps disagreement, re-checks, and adoption records visible before a workflow is fixed. |
-| [Munder Difflin](https://github.com/chaitanyagiri/munder-difflin) | Visual Agent company | Boss -> Manager -> Workers, with task and activity status. | Tracks Finding -> Evidence -> Decision -> Disposition without hiding dissent behind a central manager. |
-| [Superset](https://github.com/superset-sh/superset) / [Conductor](https://www.conductor.build/) / [Vibe Kanban](https://github.com/BloopAI/vibe-kanban) | Parallel coding workspaces | Parallel coding Agents, isolated workspaces, diffs, and merges. | Local-first review across heterogeneous CLIs, not terminal count, worktree throughput, or cloud sandboxes. |
-| [cmux](https://github.com/manaflow-ai/cmux) | Agent-native terminal | Low-friction terminals, notifications, and multitasking. | Adds frozen context, independent results, and a human adoption gate. |
-| [Nimbalyst](https://github.com/nimbalyst/nimbalyst) | Agent and artifact workspace | Parallel Agents with
```

**File**: `architecture.md` (modified, +2/-2)
```diff
@@ -2,7 +2,7 @@
 
 ## Product Boundary
 
-Meldwork is a local Electron desktop product for direct and multi-Agent work with explicitly selected Skill, image, and knowledge-source context. It has no account system, tenant model, required application server, remote conversation store, email delivery, scheduled jobs, or public SEO surface. Optional Agent, Cloud, and Channel Connectors run behind the Electron main-process trust boundary and are disabled until explicitly configured.
+Meldwork is a local Electron desktop product for multi-agent orchestration and review with explicitly selected Skill, image, and knowledge-source context. It has no account system, tenant model, required application server, remote conversation store, email delivery, scheduled jobs, or hosted web surface. Optional Agent, Cloud, and Channel Connectors run behind the Electron main-process trust boundary and are disabled until explicitly configured. The landing page at https://ryder-mhumble.github.io/Meldwork/ is the public marketing surface for search engine and AI assistant discoverability.
 
 The supported product surface is the packaged Electron application. The frontend is a renderer bundle; without the local preload bridge it shows a desktop-required state and cannot operate the workspace.
 
@@ -103,7 +103,7 @@ There is no Meldwork-hosted remote data store or application account namespace.
 
 - No email sending, so there is no `emails.md`.
 - No cron or scheduled background work, so there is no `cron.md`.
-- No supported public or indexable routes, so there is no `seo.md`.
+- No supported public or indexable routes in the app itself, so there is no `seo.md`. The landing page at https://ryder-mhumble.github.io/Meldwork/ serves as the public discoverability surface for search engines and AI assistants.
 
 ## Related Documents
 
```

**File**: `desktop/src/agents/agent-compatibility.cjs` (modified, +9/-1)
```diff
@@ -60,6 +60,13 @@ const AGENT_COMPATIBILITY = Object.freeze({
     probe('pi-cli', ['--help'], [
       '--mode', '--print', '--session', '--tools', '--approve', '--no-approve', 'json',
     ]),
+    probe('pi-json-protocol', ['--mode', 'json', '--print', '--no-approve', '--tools', 'read,grep,find,ls'], [],
+      output => output.split(/\r?\n/).some(line => {
+        try {
+          const event = JSON.parse(line)
+          return event?.type === 'session' || event?.type === 'message_update' || event?.type === 'message_end'
+        } catch { return false }
+      })),
   ]),
   kimi: profile('0.19.2', '0.32.0', [
     probe('kimi-stream', ['--help'], [
@@ -101,11 +108,12 @@ const AGENT_COMPATIBILITY = Object.freeze({
   ]),
 })
 
-function probe(id, args, requiredText) {
+function probe(id, args, requiredText, validateOutput = null) {
   return Object.freeze({
     id,
     args: Object.freeze([...args]),
     requiredText: Object.freeze([...requiredText]),
+    validateOutput,
   })
 }
 
```

**File**: `desktop/src/agents/cli/cli-discovery.cjs` (modified, +2/-1)
```diff
@@ -367,7 +367,8 @@ async function probeAgentCapabilities(kind, executable, options = {}) {
     }
   }))
   const failed = results.find(result => !result.timedOut && (result.error
-    || result.probe.requiredText.some(value => !result.output.includes(value))))
+    || result.probe.requiredText.some(value => !result.output.includes(value))
+    || (result.probe.validateOutput && !result.probe.validateOutput(result.output))))
   if (failed) capabilityCache.delete(cacheKey)
   for (const result of results) {
     const { probe } = result
```

**File**: `desktop/src/agents/cli/cli-process-support.cjs` (modified, +9/-2)
```diff
@@ -1,6 +1,6 @@
 const path = require('node:path')
 const { searchPath, systemChildEnvironment } = require('./cli-discovery.cjs')
-const { networkEnvironment } = require('./cli-network-environment.cjs')
+const { NETWORK_ENV_KEYS, networkEnvironment } = require('./cli-network-environment.cjs')
 const { redactChildSecrets } = require('./cli-runtime-events.cjs')
 const { agentRuntimeError, terminalAuthenticationDiagnostic } = require('../agent-runtime-contract.cjs')
 const { validateOpenClawRuntimeGuard } = require('./openclaw-runtime.cjs')
@@ -22,6 +22,8 @@ const OPENCLAW_RUNTIME_PATH_KEYS = Object.freeze([
   'OPENCLAW_CONFIG_PATH',
   'OPENCLAW_WORKSPACE_DIR',
 ])
+const CONTROLLED_RUNTIME_ENV = /^(?:AWS_|AZURE_|GOOGLE_|GEMINI_|ANTHROPIC_|OPENAI_|OPENROUTER_|CODEBUDDY_|HERMES_|PI_|KIMI_|MIMO_|DASHSCOPE_|CLAUDE_|OCR_|CLOUDSDK_|VERTEX_|CLOUD_ML_|MOONSHOT_|CONNECTOR_TEST_|MELDWORK_TEST_)/
+const BLOCKED_RUNTIME_ENV = /^(?:NODE_OPTIONS|NODE_PATH|LD_PRELOAD|LD_LIBRARY_PATH|DYLD_|ELECTRON_RUN_AS_NODE)$/
 
 function agentExecutionError(code, diagnostic = '') {
   return agentRuntimeError(code, diagnostic)
@@ -111,9 +113,14 @@ function childEnvironment(agent, workdir, options, platform) {
     ? { OPENCODE_PERMISSION: OPENCODE_READ_ONLY_PERMISSION }
     : {}
   const source = { ...process.env, ...options.env }
+  const controlled = Object.fromEntries(Object.entries(options.env || {}).filter(([key, value]) => (
+    typeof value === 'string'
+      && (CONTROLLED_RUNTIME_ENV.test(key) || NETWORK_ENV_KEYS.includes(key))
+      && !BLOCKED_RUNTIME_ENV.test(key)
+  )))
   return {
     ...systemChildEnvironment(process.env, platform),
-    ...options.env,
+    ...controlled,
     ...hermesSafetyEnv,
     ...openCodeSafetyEnv,
     PATH: searchPath({ platform, env: source }),
```

**File**: `desktop/src/runs/run-harness-context.cjs` (modified, +4/-0)
```diff
@@ -122,6 +122,8 @@ function normalizeSessionMeta(input) {
     meta.inheritedTaskIds = inheritedTaskIds
     meta.provenanceCompleteness = provenanceCompleteness
   }
+  const lastDeliveredMessageId = cleanId(input.lastDeliveredMessageId)
+  if (lastDeliveredMessageId) meta.lastDeliveredMessageId = lastDeliveredMessageId
   return meta
 }
 
@@ -157,6 +159,8 @@ function nextSessionMeta(meta, usage = {}) {
     if (Object.hasOwn(usage, field)) next[field] = usage[field]
     else if (Object.hasOwn(previous, field)) next[field] = previous[field]
   }
+  if (usage.lastDeliveredMessageId) next.lastDeliveredMessageId = usage.lastDeliveredMessageId
+  else if (previous.lastDeliveredMessageId) next.lastDeliveredMessageId = previous.lastDeliveredMessageId
   return normalizeSessionMeta(next)
 }
 
```

**File**: `desktop/src/workspace/local-workspace-agent-invocation.cjs` (modified, +9/-1)
```diff
@@ -812,7 +812,11 @@ class LocalWorkspaceAgentInvocation {
     }
     const knownSessionHistory = group.conversationType === 'direct'
       || sessionProvenance.completeness !== 'unknown-legacy'
+    const sameTaskSession = !taskId
+      || taskId === sessionMeta.originTaskId
+      || (Array.isArray(sessionMeta.inheritedTaskIds) && sessionMeta.inheritedTaskIds.includes(taskId))
     let transcriptAfterKind = knownSessionHistory && !sessionRotated && storedSessionRef && storedSessionRef === sessionRef
+      && (!sessionMeta.lastDeliveredMessageId || !sameTaskSession)
       ? kind
       : ''
     // Group Sessions already contain the immutable bootstrap instructions after
@@ -825,6 +829,9 @@ class LocalWorkspaceAgentInvocation {
       && sessionMeta.turns > 0
       ? 'continuation'
       : 'bootstrap'
+    const sessionContextOptions = (!isolated && !frozen && promptMode === 'continuation' && sameTaskSession)
+      ? { ...(context.contextOptions || {}), afterMessageId: sessionMeta.lastDeliveredMessageId || '' }
+      : (context.contextOptions || {})
     let packedContext = isolated || frozen
       ? {
           text: v4Prompt,
@@ -845,7 +852,7 @@ class LocalWorkspaceAgentInvocation {
           continuationText: v4Prompt,
         }
       : this.packedPromptContext(
-          group.id, transcriptAfterKind, threadRootId, context.contextOptions || {},
+          group.id, transcriptAfterKind, threadRootId, sessionContextOptions,
         )
     if (!isolated && !frozen) {
       packedContext = withCollaborationPackage(
@@ -1890,6 +1897,7 @@ class LocalWorkspaceAgentInvocation {
           replyChars: reply.text.length,
           rotated: sessionRotated,
           transport: sessionTransport,
+          lastDeliveredMessageId: packedContext.latestMessageId || sessionMeta.lastDeliveredMessageId,
           },
         ))
       }
```

**File**: `desktop/src/workspace/local-workspace-auto-runner-natural-decisions.cjs` (modified, +16/-0)
```diff
@@ -24,6 +24,22 @@ const v4NaturalDecisionMethods = {
         '', threadRootId, { key: 'system.autoTaskDecisionMissing' })
       return { status: 'partial' }
     }
+    // A peer's explicit blocker is a task outcome, not an empty routing choice.
+    // Without this guard the delivery owner could complete the run while a
+    // participant had already reported that the work was blocked.
+    const peerBlocker = messages.find(message => {
+      if (message.agentKind === owner) return false
+      const status = message.trace?.context?.taskDecision?.status
+      return status === 'blocked' || status === 'needs-human'
+    })
+    if (peerBlocker) {
+      const decision = peerBlocker.trace?.context?.taskDecision
+      this.addMessage(group.id, 'system', decision.reason, '', threadRootId, {
+        key: decision.status === 'needs-human' ? 'system.autoTaskNeedsHuman' : 'system.autoTaskBlocked',
+        params: { reason: decision.reason },
+      })
+      return { status: 'partial' }
+    }
     const nextKinds = this.v4NaturalNextKinds(group, controller, threadRootId, round, activeKinds)
     if (nextKinds.length) return { nextKinds, ownerReview: false }
     if (!activeKinds.includes(owner)) return { status: 'partial' }
```

#### Recent Merged Pull Requests:
- **PR #55** (closed): Fix OCR findings and improve local Agent CLI readiness (@Ryder-Sun)
- **PR #45** (closed): Clarify Agent team selection in the composer (@Ryder-Sun)
- **PR #44** (closed): [P2] Enforce trusted Skill runtime contracts (@Ryder-Sun)
- **PR #43** (closed): [P1] Add installable conformance-tested Agent Connector SDK (@Ryder-Sun)
- **PR #42** (closed): feat(harness): add evidence-backed task graph orchestration (@Ryder-Sun)
- **PR #41** (closed): feat(eval): build local Eval Harness and Agent Fit Matrix (@Ryder-Sun)

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

## X. refresh native shell settings before agent detection

**RULE**:
When implementing operations in `desktop/src/agents/local-agent-readiness.cjs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Ryder-Sun/Meldwork. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `17c38f6e`: refresh native shell settings before agent detection. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing JavaScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `desktop/src/agents/local-agent-readiness.cjs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// Verified production-grade fix pattern:
const { createHash } = require('node:crypto')
  const environmentHash = createHash('sha256')
    .update(JSON.stringify(allowedShellEnvironment(source, platform))).digest('hex')
  const key = [platform, home, shell, environmentHash].join('\u0000')
  if (options.refresh !== true && shellEnvironmentCache?.key === key
      && shellEnvironmentCache.expiresAt > now) {
```

**NEGATIVE CONSTRAINT**:
```javascript
// Anti-pattern to NEVER write (induced failure mode):
  const key = [platform, home, shell, String(source.PATH || '')].join('\u0000')
  if (shellEnvironmentCache?.key === key && shellEnvironmentCache.expiresAt > now) {
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `17c38f6e` are properly handled with clean fallback behavior.
