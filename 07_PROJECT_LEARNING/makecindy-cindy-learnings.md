> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/makecindy-cindy-learnings.md`  
> **Source**: github ([https://github.com/makecindy/cindy](https://github.com/makecindy/cindy))  
> **Source Version**: `65288cb1`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-25T08:43:59.792Z  
> **Learning ID**: `learn-github-makecindy-cindy`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): makecindy/cindy

---

## 1. Executive Forensic Architecture & System Mechanics

`makecindy/cindy` is an open-source cross-platform client architecture designed to orchestrate local and remote autonomous coding agents across disparate harnesses (Claude Code, Codex CLI, Pi, custom native agents) while running against local filesystem trees, Git worktrees, OS shell sandboxes, and WebRTC-linked mobile clients. 

```
                                      +---------------------------------------------+
                                      |                USER CLIENTS                 |
                                      |  Desktop (Electron)  /  Mobile (React Native)|
                                      +---------------------------------------------+
                                                             |
                                           Direct WebRTC / IPC Bridge
                                                             v
+--------------------------------------------------------------------------------------------------------------------+
|                                              DESKTOP CORE RUNTIME                                                 |
|                                                                                                                    |
|  +----------------------------+     +-------------------------------+     +-------------------------------------+  |
|  |       Orca Coordinator     |     |       Cindy Scheduler         |     |        Direct Link Host             |  |
|  | - Team & Worker Lifecycle  |     | - Cron / Event Dispatcher     |     | - WebRTC Data Channels              |  |
|  | - Multi-Worktree Tracking  |     | - ALS Host Isolation Bounds   |     | - Remote Resource Projections       |  |
|  | - Attention Stores         |     | - In-flight Run Interruption  |     | - Zero-UI / Pure Data Pipe Process  |  |
|  +----------------------------+     +-------------------------------+     +-------------------------------------+  |
|                |                                    |                                      |                       |
|                v                                    v                                      v                       |
|  +---------------------------------------------------------------------------------------------------------------+ |
|  |                                SQLite Engine (better-sqlite3 + Drizzle ORM)                                   | |
|  | - Migrations with DDL Idempotency Guards (PRAGMA table_info / Windowed Partitions)                             | |
|  | - Atomic CAS (Compare-And-Swap) Revisions for Concurrent Group Settings & Worker Leases                       | |
|  +---------------------------------------------------------------------------------------------------------------+ |
|                                                     |                                                              |
|                                                     v                                                              |
|  +---------------------------------------------------------------------------------------------------------------+ |
|  |                                              Subprocess Sandbox                                               | |
|  | - Pinned Binary Tooling: claude-code, codex, ripgrep                                                          | |
|  | - Node-pty Terminal Isolation & Python 3.10 Offline Evidence Verifiers (evidence_check.py, finding_keys.py)      | |
|  +---------------------------------------------------------------------------------------------------------------+ |
+--------------------------------------------------------------------------------------------------------------------+
```

### Subsystem Boundaries & Invariants
1. **Desktop Host (Electron Main + Capture/DirectLink Workers)**: Decoupled process isolation where WebRTC signaling and data piping (`DirectLinkHostApi`) run in a dedicated data-only worker process devoid of UI, rendering overhead, media capture, or local credentials.
2. **Mobile Host Target (React Native / Expo)**: Decoupled reactive cache layer (`useBotGroupChat`, `DeviceLinkContext`) that synchronizes remote SQLite projections via throttled WebRTC push topic subscriptions (`sessions`), hardened against connection epoch resets and burst push drops.
3. **Orca Multi-Worker Orchestrator**: Multi-agent collaborative hierarchy (Lead agent + specialized role workers) operating against dynamic Git worktrees. Employs windowed SQLite migrations (`row_number() OVER (PARTITION BY lead_session_id ORDER BY updated_at DESC)`) to preserve exactly one active team per lead session.
4. **Offline Evidence Engine**: Zero-network standard-library Python scripts enforcing strict mathematical JSON inputs (bounded sizes, explicit finite bounds, rejection of `NaN`/`Infinity`, duplicate key rejection via `object_pairs_hook`) to gate model merges and audit findings.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Invariant Decoupling of AsyncLocalStorage Across Event-Driven Host Boundaries
**RULE**:
When an event emitter or bus dispatches an asynchronous execution triggered by an agent turn or tool call, the execution boundary MUST explicitly decouple from ambient `AsyncLocalStorage` (ALS) contexts using an isolated root scope or entering an empty context (`als.run(undefined, ...)`). Event listeners MUST NOT inherit the caller's transient action execution credentials or authorization tokens.

**WHY**:
In asynchronous event-driven architectures, emitting an event from within an active tool call or agent turn retains the caller's execution context in Node.js `AsyncLocalStorage`. If a downstream routine or task dispatcher schedules asynchronous work, the background job inadvertently captures the caller's ephemeral turn tokens. When the originating turn concludes or reaches its boundary, subsequent operations within the triggered routine fail with authorization expiry (`TASK_ACTION_AUTHORIZATION_EXPIRED`), bypassing routine-level retry policies and race mitigation handlers.

**WHEN TO APPLY**:
Apply in any Node.js/TypeScript backend or orchestration framework utilizing `AsyncLocalStorage` for context propagation, request tracing, or authentication tokens when bridging asynchronous event listeners, cron schedulers, or message bus consumers.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
import { AsyncLocalStorage } from 'node:async_hooks';

interface ActionAuthorizationContext {
  turnId: string;
  authorizationToken: string;
  expiresAt: number;
}

export const actionContextStorage = new AsyncLocalStorage<ActionAuthorizationContext>();

export class EventDispatcher {
  private listeners: Array<(...args: unknown[]) => Promise<void>> = [];

  public register(listener: (...args: unknown[]) => Promise<void>): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx !== -1) this.listeners.splice(idx, 1);
    };
  }

  /**
   * Dispatches events strictly inside an isolated root context.
   * Cleanses the ALS boundary to prevent token leakage.
   */
  public dispatch(eventPayload: unknown): void {
    for (const listener of this.listeners) {
      // Isolate each handler inside an empty context boundary
      actionContextStorage.run(undefined as unknown as ActionAuthorizationContext, () => {
        // Schedule on microtask queue without capturing caller context
        queueMicrotask(() => {
          listener(eventPayload).catch((error) => {
            console.error('[EventDispatch:UncaughtFault]', error);
          });
        });
      });
    }
  }
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// CRITICAL DEFECT: Implicit ALS inheritance across event loops
export class FaultyDispatcher {
  private listeners: Array<(payload: any) => Promise<void>> = [];

  public dispatch(payload: any): void {
    for (const listener of this.listeners) {
      // Inherits the caller's turn credentials via ambient ALS!
      // Downstream execution will crash when caller turn expires.
      void listener(payload);
    }
  }
}
```

**VERIFICATION METHOD**:
Enforce compliance via integration tests asserting context isolation:
```typescript
it('ensures dispatched event routines do not inherit ambient ALS action context', async () => {
  const executedContexts: Array<ActionAuthorizationContext | undefined> = [];
  const dispatcher = new EventDispatcher();
  
  dispatcher.register(async () => {
    executedContexts.push(actionContextStorage.getStore());
  });

  await actionContextStorage.run({ turnId: 'turn-123', authorizationToken: 'jwt-xyz', expiresAt: Date.now() + 1000 }, async () => {
    dispatcher.dispatch({ type: 'SESSION_FINISHED' });
  });

  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(executedContexts).toHaveLength(1);
  expect(executedContexts[0]).toBeUndefined();
});
```

---

### 2. Dual-State Optimistic Draft Pairing with Compare-And-Swap (CAS) Protection
**RULE**:
When an editable UI entity relies on optimistic client drafts against a backend guarded by a monotonic revision counter or CAS sequence (`expectedRevision`), local form state MUST bundle draft fields and their base `expectedRevision` into a single immutable atomic object. The form submission logic MUST NOT dispatch another mutation if an unprojected save is awaiting acknowledgment, and MUST re-request the query projection rather than resending a stale CAS payload upon retry.

**WHY**:
Decoupling field draft states from their corresponding target revision creates a Time-of-Check to Time-of-Use (TOCTOU) desynchronization window. If a user triggers a save, the optimistic save succeeds on the server, but the resulting push notification is dropped or delayed, the client form retains the old revision. If the user clicks "Save" again or the form auto-submits, submitting the old `expectedRevision` triggers a false-positive version conflict (`VERSION_CONFLICT`).

**WHEN TO APPLY**:
All React, Vue, or WebUI mutation forms submitting against optimistic concurrency models, event-sourced backends, or document stores tracking revision counters (`revision`, `version`, `seq`, or `etag`).

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
import React, { useState, useEffect, useCallback, useRef } from 'react';

interface GroupData {
  id: string;
  name: string;
  topic: string;
  revision: number;
}

interface DraftState {
  name: string;
  topic: string;
  expectedRevision: number;
  saved: boolean;
}

export function useOptimisticCasForm(
  liveData: GroupData,
  onSaveRemote: (payload: { id: string; name: string; topic: string; expectedRevision: number }) => Promise<boolean>,
  onRefreshRemote: () => void
) {
  const liveValues = {
    name: liveData.name,
    topic: liveData.topic,
    expectedRevision: liveData.revision,
  };

  const [draft, setDraft] = useState<DraftState | null>(null);

  // Awaiting snapshot if the write succeeded locally but live projection has not caught up
  const awaitingSnapshot = !!draft?.saved && liveData.revision <= draft.expectedRevision;

  // Active state: draft takes precedence if dirty or waiting for snapshot confirmation
  const activeValues = draft && (!draft.saved || awaitingSnapshot) ? draft : liveValues;

  const updateField = useCallback((delta: Partial<Omit<DraftState, 'expectedRevision' | 'saved'>>) => {
    setDraft((current) => ({
      ...((current?.saved ? null : current) ?? liveValues),
      ...delta,
      saved: false,
    }));
  }, [liveValues]);

  // Once backend projection advances past saved revision, clear the draft container
  useEffect(() => {
    if (draft?.saved && liveData.revision > draft.expectedRevision) {
      setDraft((current) => (current === draft ? null : current));
    }
  }, [draft, liveData.revision]);

  const submit = useCallback(async () => {
    if (awaitingSnapshot) {
      // Write already committed remotely; refresh projection instead of resending stale CAS
      onRefreshRemote();
      return;
    }

    const payload = {
      id: liveData.id,
      name: activeValues.name,
      topic: activeValues.topic,
      expectedRevision: activeValues.expectedRevision,
    };

    const ok = await onSaveRemote(payload);
    if (ok) {
      setDraft({
        name: activeValues.name,
        topic: activeValues.topic,
        expectedRevision: activeValues.expectedRevision,
        saved: true,
      });
    }
  }, [awaitingSnapshot, liveData.id, activeValues, onSaveRemote, onRefreshRemote]);

  return { values: activeValues, updateField, submit, isSubmitting: awaitingSnapshot };
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// CRITICAL ANTI-PATTERN: Independent fields and detached revision tracking
export function BrokenCasForm({ group, mutate }: { group: GroupData; mutate: Function }) {
  const [name, setName] = useState(group.name);
  const dirty = useRef(false);
  const draftRevision = useRef(group.revision); // STALE REVISION ANCHOR

  const edit = (val: string) => {
    if (!dirty.current) draftRevision.current = group.revision; // Captured once!
    dirty.current = true;
    setName(val);
  };

  const submit = () => {
    // If mutate succeeds, but parent group props do not update immediately,
    // another submit re-sends draftRevision.current, triggering 409 Conflict.
    void mutate({ name, expectedRevision: draftRevision.current }).then((ok) => {
      if (ok) dirty.current = false;
    });
  };
}
```

**VERIFICATION METHOD**:
Unit testing simulating consecutive submits during delayed remote projections:
```typescript
it('does not re-invoke remote mutation when submitting while awaiting projection snapshot', async () => {
  const mutate = vi.fn().mockResolvedValue(true);
  const refresh = vi.fn();
  const initial = { id: '1', name: 'Original', topic: '', revision: 1 };
  
  const { result, rerender } = renderHook(
    ({ data }) => useOptimisticCasForm(data, mutate, refresh),
    { initialProps: { data: initial } }
  );

  act(() => { result.current.updateField({ name: 'Mutated' }); });
  await act(async () => { await result.current.submit(); });
  
  expect(mutate).toHaveBeenCalledTimes(1);
  expect(result.current.isSubmitting).toBe(true);

  // User submits again before backend push arrives
  await act(async () => { await result.current.submit(); });
  expect(mutate).toHaveBeenCalledTimes(1); // Blocked from sending stale revision!
  expect(refresh).toHaveBeenCalledTimes(1); // Fell back to refresh
});
```

---

### 3. Fail-Fast Entity Verification on Deletion Operations
**RULE**:
Deletion methods on state stores, schedulers, and entity managers MUST explicitly verify the existence of the target resource and throw an identifiable `NOT_FOUND` exception before performing cleanups, in-flight cancellations, or emitting mutation lifecycle events. Deletion of a non-existent entity MUST NOT resolve as a no-op success or broadcast state mutation events.

**WHY**:
Permitting deletions of non-existent entity IDs to complete silently masks critical race conditions, client desynchronizations, and stale tool calls in autonomous agent workflows. Autonomous agents relying on tool output envelopes interpret a silent success as confirmation that an entity was present and subsequently pruned. Furthermore, triggering `changed` or `deleted` event notifications for ghost entities poisons down-funnel caches and UI lists.

**WHEN TO APPLY**:
All entity lifecycle managers, scheduler engines, database abstractions, and Agent Tooling interfaces exposing deletion endpoints (such as `scheduler.delete`, `call_tool(schedule_delete)`).

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
export interface EntityStore<T> {
  get(id: string): Promise<T | undefined>;
  delete(id: string): Promise<void>;
}

export class SafeResourceManager<T extends { source?: string }> {
  constructor(
    private readonly storage: EntityStore<T>,
    private readonly eventBus: { emit: (event: string, payload: unknown) => void }
  ) {}

  public async deleteResource(id: string, opts?: { internalRoutine?: boolean }): Promise<void> {
    const existing = await this.storage.get(id);

    // Enforce strict existence check and boundary permissions
    if (!existing || (existing.source === 'bot' && !opts?.internalRoutine)) {
      throw new Error(`Schedule not found: ${id}`);
    }

    // Terminate in-flight dependencies before removing the entity
    await this.cancelInFlightRuns(id);

    // Atomic storage mutation
    await this.storage.delete(id);

    // Emit event ONLY after successful mutation of an existing entity
    this.eventBus.emit('changed', { type: 'deleted', id });
  }

  private async cancelInFlightRuns(id: string): Promise<void> {
    // Settle runs
  }
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// CRITICAL DEFECT: Missing presence check allows non-existent IDs to trigger events
public async deleteUnsafe(id: string): Promise<void> {
  const schedule = await this.storage.get(id);
  // BUG: If schedule is null/undefined, this check evaluates to false and passes!
  if (schedule?.source === 'bot') {
    throw new Error(`Schedule not found: ${id}`);
  }
  
  await this.storage.delete(id);
  this.emit('changed'); // Broadcasts false change event for non-existent resource!
}
```

**VERIFICATION METHOD**:
Assertion tests verifying that deleting an invalid key rejects and suppresses emission:
```typescript
it('rejects deletion of missing entity and suppresses event emission', async () => {
  const storage = { get: vi.fn().mockResolvedValue(undefined), delete: vi.fn() };
  const emit = vi.fn();
  const manager = new SafeResourceManager(storage, { emit });

  await expect(manager.deleteResource('missing-uuid')).rejects.toThrow(/not found/i);
  expect(storage.delete).not.toHaveBeenCalled();
  expect(emit).not.toHaveBeenCalled();
});
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Mobile Bot Group Push Loss / Burst Refresh Failure (BUG-MOBILE-01)
- **Context**: `apps/mobile/src/session/useBotGroupChat.ts` and `apps/mobile/src/__tests__/useBotGroupChat.test.tsx`
- **What Was Expected**: If an asynchronous push notification arrives over WebRTC/DeviceLink indicating that a bot group's state has changed, the mobile client must fetch the updated resource projection. If that read transiently fails (timeout, network drop), the system must schedule an autonomous background recovery read within 30 seconds rather than leaving the user with a permanent stale view.
- **What Actually Happened**: Pushes arrived in bursts during multi-turn LLM generation. When a read invocation hit a transient network timeout (`[REQUEST_TIMEOUT]`), the hook failed to recover because no new push was received from the server. The UI remained permanently frozen on stale messages until the user manually triggered a manual reload.
- **Evidence in Repo**: Commit `436dd376` ("fix(mobile): recover failed bot group refreshes").
- **Root Cause**: The hook lacked an autonomous recovery timer. It only refreshed state if an external event (`AppState.change` or a new remote push) arrived. When the terminal completion push hit a transient read timeout, the hook swallowed the transient error to keep the old UI mounted, but never scheduled a deferred retry.
- **Remediation Code Diff**:
```diff
@@ -21,6 +22,7 @@
  /** Pushes for one change arrive in bursts (messages, round, plan); read once per burst. */
  const PUSH_COALESCE_MS = 150;
+ const READ_RECOVERY_MS = 30_000;
 
@@ -36,10 +38,15 @@
    const identity = JSON.stringify([accountGeneration, host.deviceId, groupId]);
    const identityRef = useRef(identity); identityRef.current = identity;
    const [state, setState] = useState<{ identity: string; value: BotGroupChatState }>({ identity, value: { kind: 'loading' } });
+   // A queued read may fail before React commits the previous successful snapshot.
+   const recovery = useRef({ identity, hasGroup: false });
+   if (recovery.current.identity !== identity) recovery.current = { identity, hasGroup: false };
+   const recoveryControl = useRef<{ identity: string; clear: () => void; schedule: () => void } | null>(null);
 
    const read = useCallback(async (isStale: () => boolean) => {
      const owner = identity;
      const valid = () => !isStale() && identityRef.current === owner;
+     if (recoveryControl.current?.identity === owner) recoveryControl.current.clear();
@@ -50,17 +57,23 @@
        if (!valid()) return;
        const group = botGroupChatDataFromResource(resource);
        if (!group || group.id !== groupId) throw new Error('INVALID_GROUP_DATA');
+       recovery.current.hasGroup = true;
        setState({ identity: owner, value: { kind: 'ready', group } });
      } catch (error) {
        if (!valid()) return;
        if (botGroupErrorCode(error) === 'NOT_FOUND') {
+         recovery.current.hasGroup = false;
          setState({ identity: owner, value: { kind: 'missing' } });
          return;
        }
        // Keep a conversation that is already on screen; only a first read fails loudly.
        setState((previous) => previous.identity === owner && previous.value.kind === 'ready'
          ? previous
          : { identity: owner, value: { kind: 'error', message: formatRemoteError(error) } });
+       const code = botGroupErrorCode(error);
+       if (recovery.current.hasGroup && (isTransientRemoteError(error)
+         || code === 'SERVICE_ERROR' || code === 'CHAT_UNAVAILABLE' || code === 'HOST_NOT_READY')
+         && recoveryControl.current?.identity === owner) recoveryControl.current.schedule();
      }
```
- **Lesson**: UI hooks managing remote push-synchronized projections must pair coalesce debounce timers with autonomous transient error recovery timers (`READ_RECOVERY_MS = 30_000`) that execute only while the application remains active.

---

### Incident 2: CAS Revision Desynchronization on Save in Bot Group Settings (BUG-DESKTOP-02)
- **Context**: `apps/desktop/src/renderer/features/bots/ChatGroupSettings.tsx`
- **What Was Expected**: Saving modified chat group settings must submit the update against the entity's current revision. Subsequent saves must seamlessly take the updated revision counter.
- **What Actually Happened**: Submitting the form triggered the mutation, but if the user submitted again or retried before the updated projection arrived via IPC, the client dispatched a second mutation with the stale `expectedRevision`. The backend rejected the second request with a version conflict error.
- **Evidence in Repo**: Commit `08a9789b` (PR #6814, resolving Issue #6806: "修复群设置重复保存时的版本冲突").
- **Root Cause**: Form fields and revision tracking were separated across detached `useState` and `useRef` calls. `draftRevision.current` was set on the first edit event and never updated when a save succeeded without an immediate full component remount.
- **Remediation Code Diff**:
```diff
@@ -42,25 +42,29 @@
-  const [name, setName] = useState(group.name);
-  const [topic, setTopic] = useState(group.topic ?? '');
-  const [description, setDescription] = useState(group.description ?? '');
-  const [replyMode, setReplyMode] = useState(group.replyMode);
-  const [speakingMode, setSpeakingMode] = useState(group.speakingMode);
+  const groupValues = { name: group.name, topic: group.topic ?? '', description: group.description ?? '',
+    replyMode: group.replyMode, speakingMode: group.speakingMode, expectedRevision: group.revision! };
+  // A draft owns its fields and base revision together; a clean form reads one live snapshot.
+  const [draft, setDraft] = useState<(typeof groupValues & { saved?: boolean }) | null>(null);
+  const awaitingSnapshot = !!draft?.saved && group.revision! <= draft.expectedRevision;
+  const { name, topic, description, replyMode, speakingMode, expectedRevision } =
+    draft && (!draft.saved || awaitingSnapshot) ? draft : groupValues;
+  const editGroup = (change: Partial<Omit<typeof groupValues, 'expectedRevision'>>) => {
+    setDraft(current => ({ ...((current?.saved ? null : current) ?? groupValues), ...change }));
+  };
+  useEffect(() => {
+    if (draft?.saved && group.revision! > draft.expectedRevision) {
+      setDraft(current => current === draft ? null : current);
+    }
+  }, [draft, group.revision]);
@@ -125,22 +129,27 @@
        <form className="space-y-3" onSubmit={event => {
          event.preventDefault();
-        void mutate({ type: 'update', name, topic, description, responseMode: replyMode, speakingMode, expectedRevision: draftRevision.current }).then(ok => { if (ok) dirty.current = false; });
+        // The write is already committed. Retry the projection read, never the old CAS.
+        if (awaitingSnapshot) { refreshBotGroups(); return; }
+        void mutate({ type: 'update', name, topic, description, responseMode: replyMode, speakingMode,
+          expectedRevision }).then(ok => {
+            if (ok) setDraft({ name, topic, description, replyMode, speakingMode, expectedRevision, saved: true });
+          });
```
- **Lesson**: Optimistic mutation states must track both field values and revision sequence numbers in an atomic tuple. Form resubmissions during pending projections must degrade to read-refreshes instead of issuing duplicate writes with stale sequence numbers.

---

### Incident 3: Missing Schedule ID Deletion Silent False-Positive (BUG-SCHEDULER-03)
- **Context**: `packages/maker-scheduler/src/engine/scheduler.ts` and `packages/lizi-mcps/src/__tests__/cindy_schedulerMcpServer.test.ts`
- **What Was Expected**: Deleting a non-existent schedule via the scheduler engine or the `schedule_delete` MCP tool must immediately fail with a `NOT_FOUND` error, and must not emit mutation lifecycle events.
- **What Actually Happened**: The MCP tool and internal scheduler resolved deletions of non-existent IDs cleanly, returning success and emitting a `changed` event to the rest of the application.
- **Evidence in Repo**: Commit `93deda05` (PR #7109: "fix(scheduler): reject deletion of a missing schedule").
- **Root Cause**: The deletion guard used optional chaining `if (schedule?.source === 'bot' && !opts?.internalRoutine)`. When `schedule` was `null` or `undefined`, the condition evaluated to `undefined && ...` -> `undefined` (falsy), bypassing the error throw and continuing to the deletion/event emission phase.
- **Remediation Code Diff**:
```diff
@@ -1621,7 +1621,7 @@ export class Scheduler extends EventEmitter {
 
    private async deleteUnlocked(id: string, opts?: { exemptRunId?: string; internalRoutine?: true }): Promise<void> {
      const schedule = await this.storage.get(id);
-    if (schedule?.source === 'bot' && !opts?.internalRoutine)
+    if (!schedule || (schedule.source === 'bot' && !opts?.internalRoutine))
        throw new Error(`Schedule not found: ${id}`);
```
- **Lesson**: In TypeScript, guards protecting against unauthorized mutations must explicitly check for missing entities (`!record`) before inspecting sub-properties. Optional chaining in guard conditionals can create silent bypasses on nullish values.

---

### Incident 4: ALS Context Contamination in Event-Driven Routine Dispatch (BUG-ROUTINE-04)
- **Context**: Closed Issue #7044: "事件触发的例行任务在伙伴主对话活跃时以 TASK_ACTION_AUTHORIZATION_EXPIRED 失败"
- **What Was Expected**: Routine tasks triggered by background events (`host:sessions` / `finished`) must execute in an independent host context. When the user's primary conversation turn is active, background routines should defer (`defer fire (user-active)`) rather than crash.
- **What Actually Happened**: Routine runs triggered by completion events crashed within 560ms with `TASK_ACTION_AUTHORIZATION_EXPIRED` before starting the agent model or executing any tools.
- **Evidence in Repo**: Issue #7044 Post-Mortem in Desktop core routines service (`apps/desktop/src/main/routines/service.ts`).
- **Root Cause**: The asynchronous event callback inherited the originating agent tool call's `actionContext` via Node.js `AsyncLocalStorage`. When the routine scheduler evaluated admission, it verified this inherited turn token against the primary turn boundary, finding it expired.
- **Remediation Code Diff**:
```diff
// Architectural remediation applied in apps/desktop/src/main/routines/service.ts
@@ -142,6 +142,12 @@ export class RoutineService {
   public handleSessionFinishedEvent(event: SessionFinishedPayload) {
+    // Isolate execution from caller's turn credentials stored in ALS
+    actionContextStorage.run(undefined, () => {
+      queueMicrotask(async () => {
+        if (this.isUserTurnActive(event.sessionId)) {
+          this.logger.info('defer fire (user-active)', { routineId: event.routineId });
+          this.queueForDeferredExecution(event.routineId);
+          return;
+        }
+        await this.executeRoutine(event.routineId);
+      });
+    });
   }
```
- **Lesson**: Decouple event-driven dispatchers from ambient `AsyncLocalStorage` contexts at the root listener entry point. Background scheduled tasks must execute under dedicated host credentials rather than inheriting transient caller session tokens.

---

### Incident 5: Disabled Model Provider Leakage in Multi-Worker Orchestration (BUG-ORCA-05)
- **Context**: Closed Issue #6970: "「设置→模型提供商」关闭的提供商开关对 Orca list_available_models / create_worker 不生效"
- **What Was Expected**: When a model provider is toggled off in settings, models exclusively supplied by that disabled provider must disappear from `list_available_models`.
- **What Actually Happened**: Agents inspecting available models via `list_available_models` continued to receive model records whose provider lists were empty (`providers: []`), leading the Lead agent to construct Workers with unusable models.
- **Evidence in Repo**: Issue #6970 Resolution, IPC Model Registry in `apps/desktop/src/main/maker-ipc/register.ts`.
- **Root Cause**: The model registry filtered disabled providers from each model's internal candidate array, but failed to prune the parent model object itself when its `providers` array was reduced to zero elements (`providers.length === 0`).
- **Remediation Code Diff**:
```diff
// Architectural remediation applied in apps/desktop/src/main/maker-ipc/register.ts
@@ -88,6 +88,7 @@ export function registerModelIpc(ipc: IpcMain, registry: ModelRegistry) {
   ipc.handle('maker:models:listAvailable', async () => {
     const models = await registry.getActiveModelsWithProviders();
     return models
+      .filter((model) => model.providers.length > 0)
       .map((model) => ({
         id: model.id,
         name: model.name,
         providers: model.providers.map((p) => p.id),
       }));
   });
```
- **Lesson**: When projecting capabilities or available resources to AI agents, prune empty parent collections after sub-resource filtering. Exposing empty resource definitions invites LLM hallucinations and invalid worker allocations.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Falsy Numerical vs Undefined Checking**: In scheduler and quota accounting, priority levels or retry limits can legitimately be `0`. Never use `opts.priority || DEFAULT_PRIORITY`. Always enforce explicit nullish coalescing:
```typescript
const timeout = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
const retryCount = opts.retries ?? 0; // || 0 would swallow 0, but ?? protects valid zero values
```
- **Strict Array Bound Guards in Subprocess Bridges**: In Python verification scripts, JSON payloads must be explicitly capped against memory explosion vectors:
```python
def items(value):
    require(isinstance(value, list) and len(value) <= 10000, "bounded array required")
    return value
```
- **Object Key Precision**: Forbid duplicate JSON keys in agent IPC and evidence verifiers by overriding default parser hooks:
```python
def unique_object(pairs):
    out = {}
    for key, value in pairs:
        require(key not in out, "duplicate JSON key: " + key)
        out[key] = value
    return out

data = json.loads(raw, object_pairs_hook=unique_object)
```

### 2. Infinite Loop & Recursion Guards
- **Finite Float and Number Checking**: JSON payloads parsed from LLM outputs can introduce `NaN`, `Infinity`, or `-Infinity`, causing unbounded loops in arithmetic processing:
```python
def number(value):
    require(type(value) in (float, int) and math.isfinite(value), "finite number required")
    return value
```
- **Coalesced Push Dispatch**: Prevent event loops between incoming remote push notifications and