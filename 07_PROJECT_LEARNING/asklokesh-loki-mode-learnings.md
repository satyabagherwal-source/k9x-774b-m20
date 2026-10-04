# Forensic Learning Record (Deep Inspection): asklokesh/loki-mode

> **Canonical Artifact**: `07_PROJECT_LEARNING/asklokesh-loki-mode-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/asklokesh/loki-mode](https://github.com/asklokesh/loki-mode))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:39:41.362Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `asklokesh/loki-mode`
- **Description**: Autonomous software factory. Give it a GitHub issue, a spec or a one-line task; get back a pull request with a signed receipt anyone can re-check offline. Runs on your machine with your own keys: Claude, Codex, OpenCode.
- **Primary Language / Ecosystem**: Shell
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 1082 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `api/services/state-notifications.ts`
```
/**
 * State Notifications Service (SYN-016)
 *
 * WebSocket-based real-time state change notifications for API clients.
 * Integrates with the centralized state manager and event bus.
 */

import {
  eventBus,
  emitLogEvent,
} from "./event-bus.ts";
import type { EventFilter } from "../types/events.ts";

/**
 * State change notification message
 */
export interface StateNotification {
  type: "state_change";
  id: string;
  timestamp: string;
  filePath: string;
  changeType: "create" | "update" | "delete";
  source: string;
  diff?: {
    added: Record<string, unknown>;
    removed: Record<string, unknown>;
    changed: Record<string, unknown>;
  };
}

/**
 * Subscription request message
 */
export interface SubscriptionRequest {
  type: "subscribe" | "unsubscribe";
  files?: string[];
  changeTypes?: ("create" | "update" | "delete")[];
}

/**
 * WebSocket client connection
 */
interface WebSocketClient {
  id: string;
  socket: WebSocket;
  filter: {
    files: Set<string> | null;
    changeTypes: Set<string> | null;
  };
}

/**
 * State Notifications Manager
 *
 * Handles WebSocket connections for real-time state change notifications.
 */
class StateNotificationsManager {
  private clients: Map<string, WebSocketClient> = new Map();
  private messageCounter = 0;
  private eventSubscriptionId: string | null = null;

  constructor() {
    this.setupEventBusListener();
  }

  /**
   * Set up listener for state events from the event bus
   */
  private setupEventBusListener(): void {
    const filter: EventFilter = {
      types: ["session:started", "session:stopped", "phase:started", "phase:completed"],
    };

    // Also listen to state events specifically - we'll filter by "state:" prefix
    this.eventSubscriptionId = eventBus.subscribe(filter, (event) => {
      // Handle state-related events
      if (event.type.startsWith("session:") || event.type.startsWith("phase:")) {
        this.broadcastToClients({
          type: "state_change",
          id: event.id,
          timestamp: event.timestamp,
          filePath: (event.data as Record<string, unknown>)?.filePath as string || "unknown",
          changeType: "update",
          source: "event-bus",
        });
      }
    });
  }

  /**
   * Generate a unique client ID
   */
  private generateClientId(): string {
    return `ws_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  /**
   * Generate a unique message ID
   */
  private generateMessageId(): string {
    return `msg_${++this.messageCounter}_${Date.now()}`;
  }

  /**
   * Handle new WebSocket connection
   */
  handleConnection(socket: WebSocket): string {
    const clientId = this.generateClientId();

    const client: WebSocketClient = {
      id: clientId,
      socket,
      filter: {
        files: null, // null means all files
        changeTypes: null, // null means all change types
      },
    };

    this.clients.set(clientId, client);

    // Set up message handler
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as SubscriptionRequest;
        this.handleMessage(clientId, message);
      } catch {
        this.sendError(clientId, "Invalid message format");
      }
    };

    // Set up close handler
    socket.onclose = () => {
      this.handleDisconnection(clientId);
    };

    // Set up error handler
    socket.onerror = () => {
      this.handleDisconnection(clientId);
    };

    // Send connection confirmation
    this.sendToClient(clientId, {
      type: "connected",
      clientId,
      timestamp: new Date().toISOString(),
    });

    emitLogEvent("info", "global", `WebSocket client connected: ${clientId}`);

    return clientId;
  }

  /**
   * Handle client message
   */
  private handleMessage(clientId: string, message: SubscriptionRequest): void {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }

    switch (message.type) {
      case "subscribe":
        this.handleSubscribe(client, message);
        break;
      case "unsubscribe":
        this.handleUnsubscribe(client);
        break;
      default:
        this.sendError(clientId, `Unknown message type: ${(message as Record<string, unknown>).type}`);
    }
  }

  /**
   * Handle subscription request
   */
  private handleSubscribe(client: WebSocketClient, request: SubscriptionRequest): void {
    // Update file filter
    if (request.files && request.files.length > 0) {
      client.filter.files = new Set(request.files);
    } else {
      client.filter.files = null;
    }

    // Update change type filter
    if (request.changeTypes && request.changeTypes.length > 0) {
      client.filter.changeTypes = new Set(request.changeTypes);
    } else {
      client.filter.changeTypes = null;
    }

    // Send confirmation
    this.sendToClient(client.id, {
      type: "subscribed",
      files: request.files || "all",
      changeTypes: request.changeTypes || "all",
      timestamp: new Date().toISOString(),
    });

    emitLogEvent("info", "global", `Client ${client.id} subscribed to state changes`);
  }

  /**
   * Handle unsubscribe request
   */
  private handleUnsubscribe(client: WebSocketClient): void {
    // Reset filters
    client.filter.files = null;
    client.filter.changeTypes = null;

    // Send confirmation
    this.sendToClient(client.id, {
      type: "unsubscribed",
      timestamp: new Date().toISOString(),
    });

    emitLogEvent("info", "global", `Client ${client.id} unsubscribed from state changes`);
  }

  /**
   * Handle client disconnection
   */
  private handleDisconnection(clientId: string): void {
    this.clients.delete(clientId);
    emitLogEvent("info", "global", `WebSocket client disconnected: ${clientId}`);
  }

  /**
   * Check if a notification matches a client's filter
   */
  private matchesFilter(client: WebSocketClient, notification: StateNotification): boolean {
    // Check file filter
    if (client.filter.files !== null) {
      if (!client.filter.files.has(notification.filePath)) {
        return false;
      }
    }

    // Check change type filter
    if (client.filter.changeTypes !== null) {
      if (!client.filter.changeTypes.has(notification.changeType)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Send a message to a specific client
   */
  private sendToClient(clientId: string, message: Record<string, unknown>): void {
    const client = this.clients.get(clientId);
    if (!client || client.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      client.socket.send(JSON.stringify(message));
    } catch {
      // Client may have disconnected
      this.handleDisconnection(clientId);
    }
  }

  /**
   * Send an error message to a client
   */
  private sendError(clientId: string, error: string): void {
    this.sendToClient(clientId, {
      type: "error",
      error,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast a state notification to all matching clients
   */
  broadcastStateChange(
    filePath: string,
    changeType: "create" | "update" | "delete",
    source: string,
    diff?: {
      added: Record<string, unknown>;
      removed: Record<string, unknown>;
      changed: Record<string, unknown>;
    }
  ): void {
    const notification: StateNotification = {
      type: "state_change",
      id: this.generateMessageId(),
      timestamp: new Date().toISOString(),
      filePath,
      changeType,
      source,
      diff,
    };

    this.broadcastToClients(notification);
  }

  /**
   * Broadcast a notification to all matching clients
   */
  private broadcastToClients(notification: StateNotification): void {
    for (const client of this.clients.values()) {
      if (this.matchesFilter(client, notification)) {
        try {
          if (client.socket.readyState === WebSocket.OPEN) {
            client.socket.send(JSON.stringify(notification));
          }
        } catch {
          // Client may have disconnected
          this.handleDisconnection(client.id);
        }
      }
    }
  }

  /**
   * Get connected client count
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get all connected client IDs
   */
  getClientIds(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * Disconnect a specific client
   */
  disconnectClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      try {
        client.socket.close();
      } catch {
        // Ignore close errors
      }
      this.clients.delete(clientId);
    }
  }

  /**
   * Disconnect all clients
   */
  disconnectAll(): void {
    for (const client of this.clients.values()) {
      try {
        client.socket.close();
      } catch {
        // Ignore close errors
      }
    }
    this.clients.clear();
  }

  /**
   * Stop the notifications manager
   */
  stop(): void {
    this.disconnectAll();
    if (this.eventSubscriptionId) {
      eventBus.unsubscribe(this.eventSubscriptionId);
      this.eventSubscriptionId = null;
    }
  }
}

// Singleton instance
export const stateNotifications = new StateNotificationsManager();

/**
 * Handle WebSocket upgrade for state notifications
 */
export function handleStateNotificationsWebSocket(req: Request): Response {
  // Check if this is a WebSocket upgrade request
  const upgrade = req.headers.get("upgrade") || "";
  if (upgrade.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket upgrade", { status: 426 });
  }

  // Upgrade the connection
  const { socket, response } = Deno.upgradeWebSocket(req);

  // Handle the new connection
  stateNotifications.handleConnection(socket);

  return response;
}

/**
 * Emit a state change notification to all connected WebSocket clients
 *
 * This is the main function to call from the state manager when state changes.
 */
export function notifyStateChange(
  filePath: string,
  changeType: "create" | "update" | "delete",
```

### Core Architecture Module: `api/services/state-watcher.ts`
```
/**
 * State Watcher Service
 *
 * Watches .loki/ directory for state changes and emits events.
 * Uses StateManager for centralized state access with caching and subscriptions.
 */

import {
  eventBus,
  emitSessionEvent,
  emitPhaseEvent,
  emitTaskEvent,
  emitLogEvent,
  emitHeartbeat,
} from "./event-bus.ts";
import type { Session, Task } from "../types/api.ts";
import { StateManager, ManagedFile, type StateChange } from "../../state/manager.ts";

interface WatchedState {
  sessions: Map<string, Session>;
  tasks: Map<string, Task[]>;
  lastModified: Map<string, number>;
}

class StateWatcher {
  private lokiDir: string;
  private watchDir: string;
  private watcher: Deno.FsWatcher | null = null;
  private state: WatchedState;
  private debounceTimers: Map<string, number> = new Map();
  private debounceDelay = 100; // ms
  private heartbeatInterval: number | null = null;
  private startTime: Date;
  private stateManager: StateManager;

  constructor() {
    this.lokiDir = Deno.env.get("LOKI_DIR") ||
      new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
    this.watchDir = `${this.lokiDir}/.loki`;
    this.state = {
      sessions: new Map(),
      tasks: new Map(),
      lastModified: new Map(),
    };
    this.startTime = new Date();
    // Initialize StateManager with the .loki directory
    this.stateManager = new StateManager({
      lokiDir: this.watchDir,
      enableWatch: true,
      enableEvents: true,
    });
  }

  /**
   * Start watching the .loki directory
   */
  async start(): Promise<void> {
    // Ensure .loki directory exists
    try {
      await Deno.mkdir(this.watchDir, { recursive: true });
    } catch {
      // Directory may already exist
    }

    // Initial state load
    await this.loadInitialState();

    // Start file watcher
    this.watcher = Deno.watchFs(this.watchDir, { recursive: true });

    // Start heartbeat
    this.heartbeatInterval = setInterval(() => {
      this.emitHeartbeat();
    }, 10000); // Every 10 seconds

    // Process watch events
    this.processWatchEvents();

    console.log(`State watcher started, monitoring: ${this.watchDir}`);
  }

  /**
   * Stop watching
   */
  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }

    if (this.heartbeatInterval !== null) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Clear debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    // Stop the state manager
    this.stateManager.stop();

    console.log("State watcher stopped");
  }

  /**
   * Get current state snapshot
   */
  getState(): WatchedState {
    return this.state;
  }

  /**
   * Load initial state from .loki directory
   */
  private async loadInitialState(): Promise<void> {
    // Load sessions
    try {
      const sessionsDir = `${this.watchDir}/sessions`;
      for await (const entry of Deno.readDir(sessionsDir)) {
        if (entry.isDirectory) {
          await this.loadSession(entry.name);
        }
      }
    } catch {
      // Sessions directory may not exist
    }

    // Load current state file using StateManager
    const stateData = this.stateManager.getState("state.json");
    if (stateData && stateData.currentSession) {
      // Emit initial state event
      emitLogEvent(
        "info",
        stateData.currentSession as string,
        `State watcher loaded session: ${stateData.currentSession}`
      );
    }
  }

  /**
   * Load a specific session
   */
  private async loadSession(sessionId: string): Promise<void> {
    try {
      // Use StateManager for session file access
      const sessionData = this.stateManager.getState(`sessions/${sessionId}/session.json`);
      if (sessionData) {
        const session = sessionData as Session;
        this.state.sessions.set(sessionId, session);

        // Load tasks
        await this.loadTasks(sessionId);
      }
    } catch {
      // Session may not have a valid state file
    }
  }

  /**
   * Load tasks for a session
   */
  private async loadTasks(sessionId: string): Promise<void> {
    try {
      // Use StateManager for tasks file access
      const tasksData = this.stateManager.getState(`sessions/${sessionId}/tasks.json`);
      if (tasksData) {
        this.state.tasks.set(sessionId, (tasksData.tasks as Task[]) || []);
      }
    } catch {
      // Tasks file may not exist
    }
  }

  /**
   * Process file system watch events
   */
  private async processWatchEvents(): Promise<void> {
    if (!this.watcher) return;

    for await (const event of this.watcher) {
      for (const path of event.paths) {
        this.handleFileChange(path, event.kind);
      }
    }
  }

  /**
   * Handle a file change with debouncing
   */
  private handleFileChange(
    path: string,
    kind: Deno.FsEvent["kind"]
  ): void {
    // Debounce rapid changes to the same file
    const existingTimer = this.debounceTimers.get(path);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.debounceTimers.delete(path);
      this.processFileChange(path, kind);
    }, this.debounceDelay);

    this.debounceTimers.set(path, timer);
  }

  /**
   * Process a debounced file change
   */
  private async processFileChange(
    path: string,
    kind: Deno.FsEvent["kind"]
  ): Promise<void> {
    const relativePath = path.replace(this.watchDir + "/", "");

    // Skip non-relevant files
    if (!relativePath.endsWith(".json") && !relativePath.endsWith(".log")) {
      return;
    }

    // Parse path to determine what changed
    const parts = relativePath.split("/");

    // Handle session state changes
    if (parts[0] === "sessions" && parts.length >= 3) {
      const sessionId = parts[1];
      const fileName = parts[2];

      switch (fileName) {
        case "session.json":
          await this.handleSessionChange(sessionId, kind);
          break;
        case "tasks.json":
          await this.handleTasksChange(sessionId, kind);
          break;
        case "phase.json":
          await this.handlePhaseChange(sessionId);
          break;
        case "agents.json":
          await this.handleAgentsChange(sessionId);
          break;
      }
    }

    // Handle global state changes
    if (relativePath === "state.json") {
      await this.handleGlobalStateChange();
    }

    // Handle log file changes
    if (relativePath.endsWith(".log")) {
      await this.handleLogChange(path);
    }
  }

  /**
   * Handle session state changes
   */
  private async handleSessionChange(
    sessionId: string,
    kind: Deno.FsEvent["kind"]
  ): Promise<void> {
    if (kind === "remove") {
      const oldSession = this.state.sessions.get(sessionId);
      this.state.sessions.delete(sessionId);

      if (oldSession) {
        emitSessionEvent("session:stopped", sessionId, {
          status: "stopped",
          message: "Session removed",
        });
      }
      return;
    }

    try {
      // Use StateManager to read session file
      const sessionData = this.stateManager.getState(`sessions/${sessionId}/session.json`);
      if (!sessionData) {
        return;
      }
      const newSession = sessionData as Session;
      const oldSession = this.state.sessions.get(sessionId);

      this.state.sessions.set(sessionId, newSession);

      // Detect status changes
      if (!oldSession) {
        emitSessionEvent("session:started", sessionId, {
          status: newSession.status,
          message: "Session created",
        });
      } else if (oldSession.status !== newSession.status) {
        const eventType = this.getSessionEventType(newSession.status);
        emitSessionEvent(eventType, sessionId, {
          status: newSession.status,
          message: `Status changed from ${oldSession.status} to ${newSession.status}`,
        });
      }

      // Detect phase changes
      if (oldSession && oldSession.currentPhase !== newSession.currentPhase) {
        if (newSession.currentPhase) {
          emitPhaseEvent("phase:started", sessionId, {
            phase: newSession.currentPhase,
            previousPhase: oldSession.currentPhase || undefined,
          });
        }
      }
    } catch (err) {
      console.error(`Error loading session ${sessionId}:`, err);
    }
  }

  /**
   * Handle task changes
   */
  private async handleTasksChange(sessionId: string): Promise<void> {
    try {
      // Use StateManager to read tasks file
      const tasksData = this.stateManager.getState(`sessions/${sessionId}/tasks.json`);
      const newTasks = (tasksData?.tasks as Task[]) || [];
      const oldTasks = this.state.tasks.get(sessionId) || [];

      this.state.tasks.set(sessionId, newTasks);

      // Detect new tasks
      const oldTaskIds = new Set(oldTasks.map((t: Task) => t.id));
      for (const task of newTasks) {
        if (!oldTaskIds.has(task.id)) {
          emitTaskEvent("task:created", sessionId, {
            taskId: task.id,
            title: task.title || (task as unknown as { subject?: string }).subject || "Untitled",
            status: task.status || "pending",
          });
        }
      }

      // Detect task status changes
      const oldTaskMap = new Map(oldTasks.map((t: Task) => [t.id, t]));
      for (const task of newTasks) {
        const oldTask = oldTaskMap.get(task.id);
        if (oldTask && oldTask.status !== task.status) {
          const eventType = this.getTaskEventType(task.status);
          emitTaskEvent(eventType, sessionId, {
            taskId: task.id,
            title: task.title || (task as unknown as { subject?: string }).subject || "Untitled",
            status: task.status,
            output: task.output,
            error: task.error,
          });
        }
      }
    } catch (err) {
      console.error(`Error loading tasks for ${sessionId}:`, err);
    }
  }

  /**
   * Handle phase changes
```

### Core Architecture Module: `autonomy/lib/own-render.py`
```
#!/usr/bin/env python3
"""Finish-and-own renderer for Loki Mode (Loop 5, v7.88.0).

A PURE render layer over EXISTING honest data. It reads the artifacts the
runner already wrote (the Evidence Receipt proof.json, completion.json,
USAGE.md, the app-runner state, the assumptions ledger) and restates them in
plain English for a NON-technical founder.

Design rules (LOOP5-FINISH-AND-OWN-PLAN.md):
  - NEVER recompute or fabricate. Every line maps to a real artifact value.
  - The "Is it working?" verdict is taken VERBATIM from honesty.headline.
    Green ("ready") is gated on headline == "VERIFIED" AND tests passed AND
    the build ran. This honesty gate is the core of the lib.
  - Tolerant of missing artifacts: each one absent is marked honestly rather
    than guessed at.
  - No LLM call here (keep it pure / deterministic / testable). The "What you
    have now" paragraph is a deterministic template over the recorded brief +
    diff stat. No invented features.
  - Exit 0 always: this is a report, never a gate.

CLI:
  python3 autonomy/lib/own-render.py [--loki-dir .loki] [--md|--json]
"""

import argparse
import json
import os
import sys


# ---------------------------------------------------------------------------
# tolerant readers
# ---------------------------------------------------------------------------

def _read_json(path, default=None):
    try:
        with open(path, "r") as f:
            return json.load(f)
    except Exception:
        return default


def _read_text(path, default=""):
    try:
        with open(path, "r", errors="replace") as f:
            return f.read()
    except Exception:
        return default


def _latest_proof(loki_dir):
    """Return (run_id, proof_dict) for the most recent proof, or (None, None).

    Proof run dirs are named with a timestamp prefix (YYYYmmddTHHMMSSZ-...),
    so a lexicographic sort puts the newest last. We pick the newest dir that
    actually contains a readable proof.json.
    """
    proofs_dir = os.path.join(loki_dir, "proofs")
    try:
        entries = sorted(os.listdir(proofs_dir))
    except Exception:
        return None, None
    for run_id in reversed(entries):
        proof = _read_json(os.path.join(proofs_dir, run_id, "proof.json"))
        if isinstance(proof, dict):
            return run_id, proof
    return None, None


def _live_url(loki_dir):
    """Return the live app URL only when the app runner reports it running."""
    state = _read_json(os.path.join(loki_dir, "app-runner", "state.json"))
    if isinstance(state, dict) and state.get("status") == "running":
        url = str(state.get("url") or "").strip()
        if url:
            return url
    return ""


def _usage_section(usage_text, header):
    """Pull the body of a '## <header>' section from USAGE.md, verbatim.

    Returns the lines under the matching heading up to the next '## ' heading,
    trimmed of blank edges. Empty string when the section is absent.
    """
    if not usage_text:
        return ""
    lines = usage_text.splitlines()
    out = []
    capturing = False
    want = header.strip().lower()
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("## "):
            if capturing:
                break
            name = stripped[3:].strip().lower()
            # Match on a prefix so "## Verify (it works)" matches "Verify".
            capturing = name == want or name.startswith(want + " ") \
                or name.startswith(want + " (")
            continue
        if capturing:
            out.append(line)
    # Trim leading/trailing blank lines.
    while out and not out[0].strip():
        out.pop(0)
    while out and not out[-1].strip():
        out.pop()
    return "\n".join(out)


def _strip_md_fences(text):
    """Remove markdown code-fence lines (``` or ```lang) from a USAGE.md section
    body. USAGE.md already wraps commands in fenced blocks; own re-wraps each
    section in ONE fence, so leaving the inner fences in produces nested,
    broken-rendering ``` inside ``` for the non-technical reader. We drop the
    fence delimiter lines but keep the content + prose between them verbatim."""
    if not text:
        return ""
    kept = []
    for line in text.splitlines():
        if line.lstrip().startswith("```"):
            continue  # drop the fence delimiter line itself
        kept.append(line)
    # Re-trim blank edges left behind after removing fences.
    while kept and not kept[0].strip():
        kept.pop(0)
    while kept and not kept[-1].strip():
        kept.pop()
    return "\n".join(kept)


# ---------------------------------------------------------------------------
# honesty gate (the core)
# ---------------------------------------------------------------------------

def _is_ready(proof):
    """Deterministic green gate. True ONLY when:
      - honesty.headline == "VERIFIED", AND
      - facts.tests.status in (passed, verified), AND
      - the build actually ran (facts.build.ran true / status not 'not_run'), AND
      - no trust gate was disabled for the run.

    Any one missing -> not ready. This is the line that must never overclaim.

    The disabled-gate condition is the newest and the one this page needs most.
    This renderer exists for a NON-TECHNICAL owner: the reader least equipped to
    notice that code review and security never ran. Every other surface can show
    a caveat beside a green badge and trust the reader to weigh it. Here the
    badge IS the message, so a run with its trust gates switched off must not
    reach green at all.

    Only gates that bear on correctness count. Turning off performance testing
    or competitor research does not make a build unverified, and treating it as
    such would push honest runs to amber and teach owners to ignore the colour.
    """
    if not isinstance(proof, dict):
        return False
    honesty = proof.get("honesty") or {}
    if str(honesty.get("headline") or "").strip().upper() != "VERIFIED":
        return False
    facts = proof.get("facts") or {}
    tests = facts.get("tests") or {}
    if str(tests.get("status") or "").strip().lower() not in ("passed", "verified"):
        return False
    build = facts.get("build") or {}
    build_ran = bool(build.get("ran")) or \
        str(build.get("status") or "").strip().lower() not in ("not_run", "", "none")
    if not build_ran:
        return False

    # A trust gate switched off means the work was not fully checked, whatever
    # the headline says. Recorded by the proof generator since v8.17.0.
    gates = proof.get("quality_gates") or {}
    disabled = gates.get("disabled_phases")
    disabled = disabled if isinstance(disabled, list) else []
    trust_gates = {"code_review", "security", "unit_tests", "e2e_tests"}
    if any(str(name).strip().lower() in trust_gates for name in disabled):
        return False
    return True


# ---------------------------------------------------------------------------
# section builders (markdown). Each returns a list of lines.
# ---------------------------------------------------------------------------

def _section_what_you_have(proof):
    """1. 'What you have now' - product-terms restatement of the brief + diff.

    Deterministic template only: the recorded brief verbatim plus a one-line
    files-changed summary. No invented features, no LLM call.
    """
    lines = ["## What you have now", ""]
    spec = (proof or {}).get("spec") or {}
    brief = str(spec.get("brief") or "").strip()
    if brief:
        # Restate the brief as the description of what was built. Quote it so the
        # reader sees it is their own words, not a Loki claim.
        first = brief.splitlines()[0].strip()
        lines.append("You asked Loki to build this:")
        lines.append("")
        lines.append("> " + first)
    else:
        lines.append("Loki worked directly on an existing codebase here (no written "
                     "spec was recorded for this run).")
    lines.append("")

    facts = (proof or {}).get("facts") or {}
    git = facts.get("git") or {}
    diff = git.get("diff") or (proof or {}).get("files_changed") or {}
    count = diff.get("count") or 0
    ins = diff.get("insertions") or 0
    dele = diff.get("deletions") or 0
    if count:
        lines.append("It changed %d file%s (%d lines added, %d removed)."
                     % (count, "" if count == 1 else "s", ins, dele))
    else:
        lines.append("No file changes were recorded for this run.")
    return lines


def _build_age_note(run_id):
    """An honest 'this verdict describes the build at <when>' line + a pointer to
    re-verify against current code. A non-technical owner must not read an old
    receipt as a statement about code they edited since the build."""
    lines = []
    when = _run_id_when(run_id)
    if when:
        lines.append("This describes the build Loki finished on %s. If you (or a "
                     "developer) changed the code after that, this verdict is about "
                     "the older version, not your current files." % when)
    else:
        lines.append("This describes the last build Loki finished. If the code "
                     "changed since then, this verdict is about the older version.")
    if run_id:
        lines.append("To confirm it still matches your current code, run: "
                     "`loki proof verify %s`" % run_id)
    return lines


def _run_id_when(run_id):
    """Format a human date from a proof run_id (YYYYmmddTHHMMSSZ-...). Returns ''
    if the id is not in that shape (no fabrication -- only restate what is there)."""
    if not run_id:
        return ""
    stamp = str(run_id).split("-", 1)[0]
    # Expect YYYYmmddTHHMMSSZ
    if len(stamp) >= 16 and stamp[8:9] == "T" and stamp[15:16] == "Z":
        y, mo, d = stamp[0:4], stamp[4:6], stamp[6:8]
        hh, mm = stamp[9:11], stamp[11:13]
        if y.isdigit() and mo.isdigit() and d.isdigit():
            return "%s-%s-%s at %s:%s UTC" % (y, 
```

### Core Architecture Module: `benchmarks/bench/mergeability_score.py`
```
#!/usr/bin/env python3
"""benchmarks/bench/mergeability_score.py -- scored mergeability for change-mode.

This EXTENDS the R2 change-mode harness (runner.py + bench_schema.py) with a
SCORED verdict on top of its boolean success. It does not fork the harness: it
reuses runner.prepare_workdir / invoke_adapter / _apply_overlay / _run_cmd and
adds a rubric-weighted score computed ONLY from a held-out grader's per-check
output.

WHY a scored layer at all:
  SWE-bench-style tasks answer "did the one test flip?" -- pass/fail. A code
  reviewer's real question is MERGEABILITY: "would a maintainer merge this?".
  That is not binary. A maintainer BLOCKS on some things (a broken build, a
  missing FAIL_TO_PASS test, a security regression) and DOCKS points on others
  (style, a missing edge case, a weak docstring). This module encodes that:

    score = 0                         if ANY blocker check fails
          = sum(weight of PASSED non-blocker checks) / sum(all non-blocker weights)
                                       otherwise (a value in [0, 1])

CREDIBILITY INVARIANT (the whole reason this file exists):
  The scorer is a PURE function of (rubric definitions, held-out grader results).
  It STRUCTURALLY cannot read the adapter-output, the council verdict, an
  LLM-judge, or any Loki self-report. `score_from_results` refuses a results
  dict that smuggles in a judgment key (mirrors bench_schema.ADAPTER_FORBIDDEN
  _KEYS). That is what makes "Loki NEVER grades itself" true here too: the only
  inputs are the maintainer's rubric (authored offline, held out from the agent,
  folded into task_hash) and the pass/fail a grader script produced by running
  held-out checks OUTSIDE the agent.

The rubric lives in task.json under the `rubric` key (unknown to
validate_task_spec, so it does not break the frozen validator; folded into the
task_hash because compute_task_hash hashes the whole spec dict -> reproducible +
held out from the agent, which only ever sees `prompt`). The held-out grader
(acceptance/rubric.py) runs each check and emits {"checks": {id: bool, ...}} on
stdout. This module runs that grader itself (the runner's grade() sends stdout
to DEVNULL and rmtree's the workdir, so we cannot scavenge it after the fact),
captures its JSON, and scores it.

CI-safe + deterministic: score_from_results is pure stdlib arithmetic over a
fixed dict; two calls on the same input are byte-identical (not "within
tolerance" -- exactly equal). Tolerance only matters when a REAL engine run
introduces stochasticity across trials; the instrument itself has none.
"""

from __future__ import annotations

import json
import os
import shutil
import sys
from typing import Any, Dict, List, Optional

_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)

import runner  # noqa: E402  (reuse prepare_workdir/invoke_adapter/_apply_overlay/_run_cmd)


# ---------------------------------------------------------------------------
# rubric shape (authored by the maintainer, held out from the agent)
# ---------------------------------------------------------------------------
# task.json["rubric"] is a list of check definitions:
#   [{"id": "fail_to_pass", "weight": 0, "blocker": true,
#     "desc": "the reverse-classical FAIL_TO_PASS test passes"},
#    {"id": "handles_empty", "weight": 3, "blocker": false, "desc": "..."},
#    ...]
#
# A blocker's weight is IRRELEVANT to the numeric score (a blocker gates to 0,
# it does not contribute points); by convention we set it to 0 to make that
# explicit. Non-blocker weights are positive and define the weighted sum.

RUBRIC_REQUIRED_KEYS = ("id", "weight", "blocker")

# The scorer is forbidden from consuming any of these -- the same judgment keys
# an adapter may never emit, plus the words a rigged scorer would sneak in. If a
# results dict carries one, score_from_results refuses it: outcome must come from
# the held-out grader's per-CHECK booleans, never a pre-baked verdict.
FORBIDDEN_RESULT_KEYS = frozenset({
    "score", "success", "passed", "verdict", "graded", "won", "winner",
    "council", "rarv", "llm_judge", "self_report", "adapter",
})


class RubricError(ValueError):
    """Raised when a rubric or a results dict is malformed / smuggles judgment."""


def validate_rubric(rubric: Any) -> List[str]:
    """Return a list of problems with a rubric definition. Empty == valid."""
    errs: List[str] = []
    if not isinstance(rubric, list) or not rubric:
        return ["rubric must be a non-empty list of check definitions"]
    seen_ids = set()
    n_nonblocker_weight = 0.0
    for i, chk in enumerate(rubric):
        if not isinstance(chk, dict):
            errs.append("rubric[%d] must be an object" % i)
            continue
        for k in RUBRIC_REQUIRED_KEYS:
            if k not in chk:
                errs.append("rubric[%d] missing required key: %s" % (i, k))
        cid = chk.get("id")
        if not isinstance(cid, str) or not cid.strip():
            errs.append("rubric[%d].id must be a non-empty string" % i)
        elif cid in seen_ids:
            errs.append("rubric[%d].id duplicate: %r" % (i, cid))
        else:
            seen_ids.add(cid)
        if "blocker" in chk and not isinstance(chk["blocker"], bool):
            errs.append("rubric[%d].blocker must be a bool" % i)
        w = chk.get("weight")
        if not isinstance(w, (int, float)) or isinstance(w, bool):
            errs.append("rubric[%d].weight must be a number" % i)
        elif not chk.get("blocker", False):
            if w < 0:
                errs.append("rubric[%d].weight (non-blocker) must be >= 0" % i)
            n_nonblocker_weight += w
    if not errs and n_nonblocker_weight <= 0:
        errs.append("rubric must have at least one non-blocker check with weight > 0")
    return errs


# ---------------------------------------------------------------------------
# the PURE scorer -- the deterministic, CI-safe heart of this module
# ---------------------------------------------------------------------------

def score_from_results(rubric: List[Dict[str, Any]],
                       check_results: Dict[str, Any]) -> Dict[str, Any]:
    """Compute a mergeability score from rubric weights + held-out check results.

    Args:
      rubric:        the maintainer's rubric (list of {id, weight, blocker}).
      check_results: {check_id: bool} produced by the HELD-OUT grader by running
                     each check on the agent's produced repo state. A missing
                     check id is treated as a FAILURE (conservative: an absent
                     signal is never counted as a pass).

    Returns:
      {
        "score": float in [0, 1],       # 0 if any blocker fails
        "blocked": bool,                # true iff >=1 blocker check failed
        "blocker_failures": [id, ...],  # which blockers failed
        "per_check": [{id, blocker, weight, passed, contributed}, ...],
        "nonblocker_weight_total": float,
        "nonblocker_weight_earned": float,
      }

    PURE: no I/O, no adapter, no council. Deterministic -- identical input yields
    a byte-identical dict. This is the structural guarantee that Loki does not
    grade itself: the ONLY inputs are the offline rubric and a grader's booleans.
    """
    rerrs = validate_rubric(rubric)
    if rerrs:
        raise RubricError("invalid rubric: " + "; ".join(rerrs))
    if not isinstance(check_results, dict):
        raise RubricError("check_results must be a dict of {check_id: bool}")
    smuggled = sorted(k for k in check_results.keys() if k in FORBIDDEN_RESULT_KEYS)
    if smuggled:
        raise RubricError(
            "check_results MUST carry only per-check booleans, not a pre-baked "
            "verdict; forbidden keys present: " + ", ".join(smuggled)
        )

    blocker_failures: List[str] = []
    per_check: List[Dict[str, Any]] = []
    weight_total = 0.0
    weight_earned = 0.0

    for chk in rubric:
        cid = chk["id"]
        blocker = bool(chk.get("blocker", False))
        weight = float(chk.get("weight", 0))
        # A missing result is a FAILURE (never silently a pass).
        passed = check_results.get(cid) is True
        contributed = 0.0
        if blocker:
            if not passed:
                blocker_failures.append(cid)
        else:
            weight_total += weight
            if passed:
                weight_earned += weight
                contributed = weight
        per_check.append({
            "id": cid,
            "blocker": blocker,
            "weight": weight,
            "passed": passed,
            "contributed": contributed,
        })

    blocked = len(blocker_failures) > 0
    if blocked:
        score = 0.0
    elif weight_total > 0:
        score = weight_earned / weight_total
    else:
        # validate_rubric guarantees weight_total > 0, so this is unreachable;
        # kept as a defensive, non-crashing fallback.
        score = 0.0

    return {
        "score": round(score, 6),
        "blocked": blocked,
        "blocker_failures": blocker_failures,
        "per_check": per_check,
        "nonblocker_weight_total": round(weight_total, 6),
        "nonblocker_weight_earned": round(weight_earned, 6),
    }


# ---------------------------------------------------------------------------
# held-out grader invocation -- run the rubric.py the agent never saw
# ---------------------------------------------------------------------------

def run_held_out_grader(workdir: str, spec: Dict[str, Any],
                        task_dir: str) -> Dict[str, Any]:
    """Overlay the held-out grader, run it, and return its {check_id: bool} map.

    This mirrors runner.grade's overlay-then-run flow but CAPTURES stdout (the
    per-check JSON), which runner.grade discards. It never sees adapter-output.

    The grader command comes from spec["acceptance"]["grader_cmd"] if present,
    else defaults to running the overlaid `rubric.py` with the
```

### Core Architecture Module: `benchmarks/render-ab-dashboard.py`
```
#!/usr/bin/env python3
"""Render benchmarks/results/ab-history.jsonl into a plain-language HTML dashboard.

Reads the append-only trial history and produces:
  benchmarks/results/ab-dashboard.html

Design constraints that matter more than the styling:

  * Medians, not means. Iteration counts are small integers with occasional
    cap-hits; one run pinned at the cap drags a mean and misleads.
  * The spread is always shown. A median gap smaller than the observed spread
    is NOT a result, and the verdict says so in plain words.
  * A run that produced no metrics file is rendered as a visible MISSING cell,
    never silently dropped -- a lost cell must not read as "did not happen".
  * No claim is made about output QUALITY. The acceptance check here is a
    file-existence assertion; the honest scope is "iterations and time to a
    completing run".

Safe to re-run at any time; it only reads the history file.
"""

import json
import os
import statistics
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
HISTORY = os.path.join(HERE, "results", "ab-history.jsonl")
OUT = os.path.join(HERE, "results", "ab-dashboard.html")


def load():
    rows = []
    if not os.path.exists(HISTORY):
        return rows
    with open(HISTORY) as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError:
                # A partially-written final line (runner killed mid-append)
                # must not blank the whole dashboard.
                continue
    return rows


def num(row, key):
    v = row.get(key)
    return v if isinstance(v, (int, float)) else None


def summarize(rows, arm):
    # An "arm" is a family: the post-fix engine is recorded under several labels
    # (v8-fixed, v8-final) as the fix was tightened. They are the SAME engine
    # generation for comparison purposes, so match on prefix rather than an exact
    # string -- otherwise later trials silently vanish from the verdict.
    def _in(r):
        a = r.get("arm") or ""
        return a == arm or a.startswith(arm + "-")
    got = [r for r in rows if _in(r) and not r.get("missing")]
    missing = len([r for r in rows if _in(r) and r.get("missing")])
    iters = [v for v in (num(r, "act_iterations") for r in got) if v is not None]
    walls = [v for v in (num(r, "wall_clock_min") for r in got) if v is not None]
    if not walls:
        walls = [
            round(v / 60.0, 1)
            for v in (num(r, "wall_clock_s") for r in got)
            if v is not None
        ]
    completed = [bool(r.get("engine_completed")) for r in got]
    accepted = []
    for r in got:
        a = r.get("acceptance")
        accepted.append(bool(a) and all(bool(x) for x in a.values()) if isinstance(a, dict) else False)
    return {
        "arm": arm,
        "n": len(got),
        "missing": missing,
        "iters": iters,
        "walls": walls,
        "med_iters": statistics.median(iters) if iters else None,
        "med_wall": statistics.median(walls) if walls else None,
        "completed": sum(completed),
        "accepted": sum(accepted),
    }


def spread(vals):
    return (max(vals) - min(vals)) if len(vals) >= 2 else 0


def verdict(v8, v7):
    """Plain-language verdict. Refuses to call a gap that the noise can explain."""
    if v8["n"] < 2 or v7["n"] < 2:
        return ("more-data", "Not enough trials yet",
                f"{v8['n']} v8 and {v7['n']} v7 trials so far. At least 3 of each are "
                "needed before any comparison means anything.")
    a, b = v8["med_iters"], v7["med_iters"]
    if a is None or b is None:
        return ("more-data", "No iteration data", "Trials did not record iteration counts.")
    gap = b - a
    noise = max(spread(v8["iters"]), spread(v7["iters"]))
    if abs(gap) <= noise:
        return ("tie", "Too close to call",
                f"v8 typically takes {a:g} rounds, v7 takes {b:g}. That difference "
                f"({abs(gap):g}) is no bigger than the natural run-to-run variation "
                f"({noise:g}), so it is not a real difference. More trials would sharpen this.")
    if gap > 0:
        pct = round(gap / b * 100)
        # Wall clock is a SEPARATE, weaker claim than round count. Model latency
        # dominates a short run and is noisy, so the time ranges can overlap even
        # when the round counts do not. Say so instead of implying both are
        # equally established.
        note = ""
        if v8["walls"] and v7["walls"] and min(v7["walls"]) < max(v8["walls"]):
            note = (f" Time per run is less clear-cut: the slowest new run "
                    f"({max(v8['walls']):g} min) is not faster than the quickest old one "
                    f"({min(v7['walls']):g} min), so treat the time saving as likely "
                    "rather than proven. The round count is the reliable number, and "
                    "it is also what the cost tracks.")
        return ("win", f"v8 finishes in fewer rounds ({pct}% fewer)",
                f"v8 typically needs {a:g} rounds where v7 needs {b:g}. The gap ({gap:g}) "
                f"is larger than the run-to-run variation ({noise:g}), so it looks real. "
                "Fewer rounds means less time and lower cost for the same job." + note)
    pct = round(-gap / b * 100)
    return ("regress", f"v8 takes MORE rounds ({pct}% more)",
            f"v8 typically needs {a:g} rounds where v7 needs {b:g}. This is a regression "
            "and needs investigating before it reaches users.")


def esc(s):
    return (str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


def render(rows):
    v8, v7 = summarize(rows, "v8"), summarize(rows, "v7")
    kind, headline, detail = verdict(v8, v7)
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    def cards():
        out = []
        for s, name in ((v8, "v8.0.0 (new)"), (v7, "v7.129.5 (previous)")):
            mi = f"{s['med_iters']:g}" if s["med_iters"] is not None else "--"
            mw = f"{s['med_wall']:g}" if s["med_wall"] is not None else "--"
            runs = ", ".join(f"{i:g}" for i in s["iters"]) or "none yet"
            out.append(f"""
      <div class="card">
        <h3>{esc(name)}</h3>
        <div class="big">{mi}<span class="unit">rounds</span></div>
        <div class="sub">typical (median) of {s['n']} trial(s)</div>
        <dl>
          <dt>Typical time</dt><dd>{mw} min</dd>
          <dt>Each run took</dt><dd>{esc(runs)} rounds</dd>
          <dt>Finished cleanly</dt><dd>{s['completed']} of {s['n']}</dd>
          <dt>Output check passed</dt><dd>{s['accepted']} of {s['n']}</dd>
          <dt>Lost runs</dt><dd>{s['missing']}</dd>
        </dl>
      </div>""")
        return "".join(out)

    trs = []
    for r in sorted(rows, key=lambda x: x.get("recorded_at", "")):
        if r.get("missing"):
            trs.append(
                f'<tr class="missing"><td>{esc(r.get("recorded_at",""))}</td>'
                f'<td>{esc(r.get("arm",""))}</td><td>{esc(r.get("label",""))}</td>'
                f'<td colspan="4">no result recorded (run did not finish)</td></tr>')
            continue
        acc = r.get("acceptance")
        ok = bool(acc) and all(bool(x) for x in acc.values()) if isinstance(acc, dict) else False
        w = num(r, "wall_clock_min")
        if w is None:
            ws = num(r, "wall_clock_s")
            w = round(ws / 60.0, 1) if ws is not None else None
        trs.append(
            f'<tr><td>{esc(r.get("recorded_at",""))}</td><td>{esc(r.get("arm",""))}</td>'
            f'<td>{esc(r.get("label",""))}</td><td class="n">{esc(r.get("act_iterations","--"))}</td>'
            f'<td class="n">{esc(w if w is not None else "--")}</td>'
            f'<td>{"yes" if r.get("engine_completed") else "no"}</td>'
            f'<td>{"pass" if ok else "fail"}</td></tr>')
    if not trs:
        trs.append('<tr><td colspan="7">No trials recorded yet.</td></tr>')

    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Loki Mode: v8 vs v7 benchmark history</title>
<style>
  :root {{
    --bg:#fbfaf8; --fg:#1a1a19; --muted:#6b6a66; --line:#e2e0da;
    --card:#ffffff; --accent:#1f6f5c; --warn:#8a5a1c; --bad:#8f2f2f;
  }}
  @media (prefers-color-scheme:dark) {{
    :root {{ --bg:#15161a; --fg:#e9e8e4; --muted:#9b9a95; --line:#2c2e34;
             --card:#1c1e23; --accent:#5fbfa3; --warn:#d6a05a; --bad:#e08585; }}
  }}
  :root[data-theme="dark"] {{ --bg:#15161a; --fg:#e9e8e4; --muted:#9b9a95;
    --line:#2c2e34; --card:#1c1e23; --accent:#5fbfa3; --warn:#d6a05a; --bad:#e08585; }}
  :root[data-theme="light"] {{ --bg:#fbfaf8; --fg:#1a1a19; --muted:#6b6a66;
    --line:#e2e0da; --card:#ffffff; --accent:#1f6f5c; --warn:#8a5a1c; --bad:#8f2f2f; }}
  * {{ box-sizing:border-box; }}
  body {{ margin:0; background:var(--bg); color:var(--fg); font:16px/1.6
    ui-sans-serif,system-ui,-apple-system,"Segoe UI",Helvetica,Arial,sans-serif; }}
  .wrap {{ max-width:960px; margin:0 auto; padding:40px 20px 72px; }}
  h1 {{ font-size:28px; margin:0 0 4px; letter-spacing:-.01em; }}
  .stamp {{ color:var(--muted); font-size:14px; margin-bottom:32px; }}
  .verdict {{ border:1px solid var(--line); border-left:4px solid var(--accent);
    background:var(--card); padding:20px 24px; border-radius:10px; margin-bottom:28px; }}
  .verdict.tie {{ border-left-color:var(--warn); }}
  .verdict.more-data {{ border-left-color:var(--muted); }}
  .verdict.regress {{ border-left-color:var(--bad); }}
  .verdict h2 {{ font-size:20px; margin:0 0 8px; }}
  .verdict p {{ margin:0; color:var(--muted); }}
  .cards {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr));
    gap:16px; margin-bottom:32px; }}
  .card {{ background:var(--card); border:1px solid var(--line);
    bor
```

### Core Architecture Module: `dashboard/migration_engine.py`
```
"""
Migration Engine for Loki Mode.

Core backend for the `loki migrate` enterprise code transformation feature.
Implements data models, MigrationPipeline, and phase gates for safe,
incremental codebase migrations with checkpoint/rollback support.
"""

from __future__ import annotations

import contextlib
import dataclasses
import json
import logging
import os
import re
import secrets
import subprocess
import tempfile
import threading
from dataclasses import asdict, dataclass, field, fields
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

try:
    import fcntl  # POSIX only (macOS + Linux). Absent on Windows.
    _HAS_FCNTL = True
except ImportError:  # pragma: no cover - non-POSIX fallback
    fcntl = None  # type: ignore[assignment]
    _HAS_FCNTL = False

logger = logging.getLogger("loki-migration")

LOKI_DATA_DIR = os.environ.get("LOKI_DATA_DIR", os.path.expanduser("~/.loki"))
MIGRATIONS_DIR = os.path.join(LOKI_DATA_DIR, "migrations")

# Phase ordering for gate validation
PHASE_ORDER = ["understand", "guardrail", "migrate", "verify"]


# ---------------------------------------------------------------------------
# Data Models
# ---------------------------------------------------------------------------


@dataclass
class Feature:
    """Individual feature tracked during migration."""

    id: str
    category: str = ""
    description: str = ""
    verification_steps: list[str] = field(default_factory=list)
    passes: bool = False
    characterization_test: str = ""
    risk: str = "low"
    notes: str = ""


@dataclass
class MigrationStep:
    """Single step in a migration plan."""

    id: str
    description: str = ""
    type: str = ""  # e.g. "refactor", "rewrite", "config", "test"
    files: list[str] = field(default_factory=list)
    tests_required: list[str] = field(default_factory=list)
    estimated_tokens: int = 0
    risk: str = "low"
    rollback_point: bool = False
    depends_on: list[str] = field(default_factory=list)
    assigned_agent: str = ""
    status: str = "pending"  # pending | in_progress | completed | failed


@dataclass
class MigrationPlan:
    """Full migration plan with strategy and steps."""

    version: int = 1
    strategy: str = "incremental"
    constraints: list[str] = field(default_factory=list)
    steps: list[MigrationStep] = field(default_factory=list)
    rollback_strategy: str = "checkpoint"
    exit_criteria: dict[str, Any] = field(default_factory=dict)


@dataclass
class SeamInfo:
    """Detected seam (boundary/interface) in the codebase."""

    id: str
    description: str = ""
    type: str = ""  # e.g. "api", "module", "database", "config"
    location: str = ""
    name: str = ""
    priority: str = "medium"
    files: list[str] = field(default_factory=list)
    dependencies: list[str] = field(default_factory=list)
    complexity: str = ""
    confidence: float = 0.0
    suggested_interface: str = ""


@dataclass
class PhaseResult:
    """Result of executing a migration phase."""

    phase: str
    status: str  # pending | in_progress | completed | failed
    artifacts: list[str] = field(default_factory=list)
    started_at: str = ""
    completed_at: str = ""
    error: str = ""


@dataclass
class CostEstimate:
    """Token cost estimation for migration."""

    total_tokens: int = 0
    estimated_cost_usd: float = 0.0
    by_phase: dict[str, int] = field(default_factory=dict)


@dataclass
class MigrationManifest:
    """Tracks overall migration state."""

    id: str = ""
    created_at: str = ""
    source_info: dict[str, Any] = field(default_factory=dict)
    target_info: dict[str, Any] = field(default_factory=dict)
    phases: dict[str, dict[str, Any]] = field(default_factory=dict)
    feature_list_path: str = ""
    migration_plan_path: str = ""
    checkpoints: list[str] = field(default_factory=list)
    status: str = "pending"
    progress_pct: int = 0
    updated_at: str = ""
    source_path: str = ""


# ---------------------------------------------------------------------------
# Atomic file write helper
# ---------------------------------------------------------------------------


def _atomic_write(path: Path, content: str) -> None:
    """Write content to file atomically using temp-file-then-rename.

    Matches the pattern in prompt_optimizer.py for POSIX safety.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = None
    try:
        fd, tmp_path = tempfile.mkstemp(
            dir=str(path.parent), suffix=".tmp"
        )
        try:
            os.write(fd, content.encode("utf-8"))
            os.fsync(fd)
        finally:
            os.close(fd)
        os.replace(tmp_path, str(path))
    except OSError as exc:
        logger.error("Failed to write %s: %s", path, exc)
        # Clean up temp file on failure
        if tmp_path is not None:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
        raise


def _timestamp_iso() -> str:
    """Return current UTC timestamp in ISO format."""
    return datetime.now(timezone.utc).isoformat()


@contextlib.contextmanager
def _manifest_file_lock(migration_dir: Path):
    """Cross-process advisory lock around a migration's manifest read-modify-write.

    Uses an OS file lock (fcntl.flock LOCK_EX) on a dedicated lockfile inside
    the migration directory. A fresh file descriptor is opened on every
    acquisition: flock keys on the open file description, so distinct fds let
    the kernel serialize even threads in the same process (the FastAPI sync
    threadpool deployment) AND separate processes (the server vs. the
    `loki migrate` CLI), which a per-instance threading.Lock cannot do.

    Only the OUTERMOST read-modify-write entry point should take this lock.
    Nesting two flock-wrapped calls in the same thread would self-deadlock
    (two fds, the second LOCK_EX blocks on the first), so locked writers must
    call the _unlocked internals and never re-enter a flock-wrapped method.

    On non-POSIX platforms (no fcntl) this degrades to a no-op: the caller's
    in-process threading.Lock still serializes threads in the same process,
    but cross-process exclusion is NOT available. This is an accepted residual
    on Windows only.
    """
    migration_dir.mkdir(parents=True, exist_ok=True)
    lock_path = migration_dir / "manifest.json.lock"
    if not _HAS_FCNTL:
        # Graceful degrade: no OS lock available. In-process callers still rely
        # on their threading.Lock; cross-process safety is unavailable here.
        yield
        return
    fd = os.open(str(lock_path), os.O_RDWR | os.O_CREAT, 0o644)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(fd, fcntl.LOCK_UN)
    finally:
        os.close(fd)


# ---------------------------------------------------------------------------
# MigrationPipeline
# ---------------------------------------------------------------------------


class MigrationPipeline:
    """Manages the lifecycle of a codebase migration.

    All state is persisted under ~/.loki/migrations/<migration_id>/.

    Concurrency: manifest read-modify-write operations (start_phase,
    advance_phase, save_manifest, update_progress, create_checkpoint) are
    serialized across BOTH threads and processes by an OS file lock
    (see _manifest_file_lock) keyed on the migration directory. This holds
    for the FastAPI sync-endpoint threadpool (each request builds a fresh
    pipeline via load(), so per-instance threading.Lock alone would not
    serialize them) and for the separate `loki migrate` CLI process running
    concurrently with the server. Pure reads use the per-instance lock only.
    On non-POSIX platforms (no fcntl) the file lock degrades to a no-op and
    only in-process serialization remains (see _manifest_file_lock).
    """

    def __init__(
        self,
        codebase_path: str,
        target: str,
        options: Optional[dict[str, Any]] = None,
    ) -> None:
        self.codebase_path = os.path.abspath(codebase_path.rstrip(os.sep))
        basename = os.path.basename(self.codebase_path)
        if not basename:
            raise ValueError(f"Cannot derive project name from codebase path: {codebase_path}")
        self.target = target
        self.options = options or {}
        self.migration_id = self._generate_migration_id()
        self.migration_dir = Path(MIGRATIONS_DIR) / self.migration_id
        self._lock = threading.Lock()
        self._logger = logging.getLogger("loki-migration")

        # Ensure directory structure exists
        self.migration_dir.mkdir(parents=True, exist_ok=True)
        (self.migration_dir / "docs").mkdir(exist_ok=True)
        (self.migration_dir / "checkpoints").mkdir(exist_ok=True)

    def _generate_migration_id(self) -> str:
        """Generate a unique migration ID like mig_20260223_143052_<dirname>-a1b2c3.

        The trailing 6-hex-char random suffix prevents collisions when two
        migrations of the same path-basename start in the same second (the
        date_str/time_str are second-resolution). Without it, the two would
        derive the same id and the second create_manifest would overwrite the
        first (the server rate-limiter throttles same-second server starts, but
        the CLI bypasses it). The suffix is appended WITHIN the trailing name
        segment (hyphen-joined), so the load() validation regex
        ^mig_\\d{8}_\\d{6}_[a-zA-Z0-9_-]+$ still matches without modification
        (its trailing group already permits letters, digits, hyphens).
        """
        dirname = os.path.basename(self.codebase_path)
        # Sanitize dirname to match validation regex
        safe_dirname = re.sub(r'[^a-zA-Z0-9_-]', '_', dirname)
        if not safe_dirname:
            safe_dirname = 'unnamed'
        now = datetime.now(timezone.utc)
        date_str = now.strftime("%Y%m%d")
        time_str
```

### Core Architecture Module: `loki-ts/src/cockpit/render.ts`
```
// Orchestrates state -> SVG -> PNG -> terminal image for `loki cockpit`.
//
// Given a CockpitState and the chosen/detected protocol, produce either the
// terminal inline-image escape sequence, or an honest "fallback" signal telling
// the caller to use the text/browser dashboard. It NEVER claims an image was
// rendered when rasterization or the terminal protocol was unavailable.

import { buildSvg, type CockpitState } from "./svg.ts";
import { rasterize } from "./raster.ts";
import { encodeForProtocol } from "./encode.ts";
import { detectProtocol, type CockpitProtocol, type CapabilityEnv } from "./capability.ts";

export interface RenderOutcome {
  kind: "image" | "fallback";
  protocol: CockpitProtocol;
  data?: string; // terminal escape sequence, present when kind === "image"
  reason?: string; // why we fell back, present when kind === "fallback"
  svg: string; // always produced; useful for debugging / saving
}

export interface RenderOpts {
  protocol?: CockpitProtocol | "auto";
  env?: CapabilityEnv;
  forceText?: boolean; // --no-image
  cols?: number; // terminal width in columns; scales the image to fill the pane
}

export async function render(state: CockpitState, opts: RenderOpts = {}): Promise<RenderOutcome> {
  const svg = buildSvg(state);

  if (opts.forceText) {
    return { kind: "fallback", protocol: "none", reason: "--no-image (text/browser fallback)", svg };
  }

  let protocol: CockpitProtocol;
  if (opts.protocol && opts.protocol !== "auto") {
    protocol = opts.protocol;
  } else {
    protocol = detectProtocol(opts.env);
  }

  if (protocol === "none") {
    return { kind: "fallback", protocol, reason: "no inline-image terminal detected", svg };
  }

  const raster = await rasterize(svg);
  if (!raster.available || !raster.png) {
    return {
      kind: "fallback",
      protocol,
      reason: raster.reason || "rasterization unavailable",
      svg,
    };
  }

  const data = encodeForProtocol(protocol, raster.png, opts.cols);
  return { kind: "image", protocol, data, svg };
}

```

### Core Architecture Module: `loki-ts/src/e10ext/ship_hook.ts`
```
// CP-02: live shipping hook (docs/v10/CONTROL-PLANE.md section 5), started by supervisor.ts unless LOKI_CONTROL=0. Ships when LOKI_CONTROL_URL is set
// or a live local instance is discovered; fire-and-forget (never throws), and `loki control backfill` replays whatever is unshipped at exit.
import { dirname } from "node:path";
import { discoverControlUrl, discoveryRefusal, gitOrigin } from "../../../packages/control-plane/src/shipper/discover.ts";
import { shipEnabled, sourceId, startShipLoop } from "../../../packages/control-plane/src/shipper/ship.ts";
export async function startShip(repoDir: string, eventsPath: string, env: NodeJS.ProcessEnv): Promise<void> {
  let url = shipEnabled(env);
  if (!url) {
    if (discoveryRefusal(repoDir, gitOrigin(repoDir, env), env) !== null) return; // P0: never auto-ship a temp or fixture repo to a live local instance
    url = await discoverControlUrl(env); // C2: a live local instance.json counts; never starts a server
  }
  if (!url) return;
  startShipLoop({ runDir: dirname(eventsPath), url, source: sourceId(repoDir), token: env.LOKI_CONTROL_TOKEN });
}

```

### Core Architecture Module: `loki-ts/src/engine10/already_done.ts`
```
// loki-ts/src/engine10/already_done.ts -- E-66: "already implemented" as a first-class v10 outcome
// (docs/v10/ENGINE.md section 4, Intake). Deterministic evidence search over the repo map, test
// map and CHANGELOG/README, gated by one short cheap-model confirmation that must cite files
// before Intake ever claims already-done. Reuses the LOKI_ALREADY_DONE marker session.ts already
// parses (implement.ts's contract), so there is no new marker to teach the provider.
import { wallModel } from "./sizing.ts";
import type { RepoMap } from "./repomap.ts";
import { buildAlreadyDoneCommentArgv, buildConfirmBrief, citesRealHit, evidenceLines, findEvidence, renderAlreadyDoneComment } from "../util/already_done_evidence.ts";
import type { EvidenceHit } from "../util/already_done_evidence.ts";
import type { RunContext, TestMap } from "./types.ts";
export { buildAlreadyDoneCommentArgv, buildConfirmBrief, evidenceLines, findEvidence, renderAlreadyDoneComment };
export type { EvidenceHit };

export interface AlreadyDoneResult {
  satisfied: true;
  evidence: string[]; // the model's own citation first, then the deterministic hits behind it
  paths: string[]; // the hits' file paths (FC-15: checked against the PR target)
}

/** Runs the deterministic search, then, only on a candidate, one short confirmation session
 *  (fast tier pinned to wallModel(), the same cheap-model pin E-45 uses for Wall). No candidate,
 *  no session call: findEvidence's own gate is what keeps this off the hot path. */
export async function checkAlreadyDone(
  ctx: RunContext,
  signal: AbortSignal,
  task: string,
  repoMap: RepoMap,
  testMap: TestMap,
): Promise<AlreadyDoneResult | null> {
  const hits = findEvidence(task, repoMap, testMap, ctx.repoDir);
  if (hits.length === 0 || signal.aborted) return null;
  const session = await ctx.sessions.run({
    stage: "intake",
    brief: buildConfirmBrief(task, hits),
    tier: "fast",
    model: wallModel(),
    iterationId: `${ctx.runId}-already-done`,
    limitS: 30,
    signal,
    cwd: ctx.repoDir,
  });
  const marker = session.markers.alreadyDone;
  if (!marker) return null;
  // The citation must actually point at one of the search's own hits, not just any file name.
  if (!hits.some((h) => citesRealHit(marker, h, ctx.repoDir))) return null;
  return { satisfied: true, evidence: [marker, ...evidenceLines(hits)], paths: hits.map((h) => h.path) };
}

```

### Core Architecture Module: `loki-ts/src/engine10/cache.ts`
```
// loki-ts/src/engine10/cache.ts -- E-18 per-repo cache (ENGINE.md section 13): repomap/testmap keyed
// by HEAD^{tree}, plus flaky tests and failure signatures for the brief's "top 3 past failures".
// Reads are O(1) and never throw (missing or corrupt = miss); nothing writes as a side effect of a
// read. Callers time writes after the PR. Not yet in RunContext (a later CacheProvider slice).
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { homeLokiDir } from "../util/paths.ts";
import type { RepoMap } from "./repomap.ts";
import type { TestMap } from "./types.ts";
export interface FailureSignature {
  signature: string;
  count: number;
  sample: string;
}
/** sha256 of the pinned origin URL, or of the absolute repo path when there
 *  is no origin (ENGINE.md section 13). */
export function repoKey(originUrl: string | null, repoDir: string): string {
  const basis = originUrl && originUrl.trim() !== "" ? originUrl : resolve(repoDir);
  return createHash("sha256").update(basis).digest("hex");
}
/** ~/.loki/cache/v10 (ENGINE.md section 13). Callers may pass their own root
 *  (tests do, to stay off the real home directory). */
export function defaultCacheRoot(): string {
  return resolve(homeLokiDir(), "cache", "v10");
}
export function repoCacheDir(key: string, cacheRoot: string = defaultCacheRoot()): string {
  return resolve(cacheRoot, key);
}
// Parses fine but is the wrong shape (e.g. `null`, `{}`, a bare number) is
// just as much a corrupt cache entry as unparseable text: both are a miss,
// never a throw. `isValid` lets each caller state its own shape; callers
// that skip it accept anything JSON.parse produces, same as before.
function readJson<T>(path: string, isValid: (v: unknown) => v is T = (_v): _v is T => true): T | null {
  if (!existsSync(path)) return null;
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    return isValid(parsed) ? parsed : null;
  } catch {
    return null; // a corrupt cache entry is a miss, never a crash
  }
}
// ponytail: top-level shape only (array-ness), not per-entry field checks --
// this is what closes the demonstrated crash; a future slice can deep-check
// RepoMap/TestMap entries if a corrupt-but-array-shaped file shows up.
function isRepoMap(v: unknown): v is RepoMap {
  return typeof v === "object" && v !== null && Array.isArray((v as RepoMap).files) && Array.isArray((v as RepoMap).entries);
}
function isTestMap(v: unknown): v is TestMap {
  return typeof v === "object" && v !== null && Array.isArray((v as TestMap).runners) && Array.isArray((v as TestMap).tests);
}
function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}
function isFailureSignature(v: unknown): v is FailureSignature {
  const r = v as Partial<FailureSignature> | null;
  return (
    typeof r === "object" &&
    r !== null &&
    typeof r.signature === "string" &&
    typeof r.count === "number" &&
    Number.isFinite(r.count) &&
    typeof r.sample === "string"
  );
}
function writeJson(path: string, dir: string, data: unknown): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(data));
}
export function readRepoMapCache(dir: string, tree: string): RepoMap | null {
  return readJson<RepoMap>(resolve(dir, `repomap-${tree}.json`), isRepoMap);
}
export function writeRepoMapCache(dir: string, tree: string, map: RepoMap): void {
  writeJson(resolve(dir, `repomap-${tree}.json`), dir, map);
}
export function readTestMapCache(dir: string, tree: string): TestMap | null {
  return readJson<TestMap>(resolve(dir, `testmap-${tree}.json`), isTestMap);
}
export function writeTestMapCache(dir: string, tree: string, map: TestMap): void {
  writeJson(resolve(dir, `testmap-${tree}.json`), dir, map);
}
/** Flaky test paths seen across past runs (deduped, sorted). */
export function readFlaky(dir: string): string[] {
  return readJson<string[]>(resolve(dir, "flaky.json"), isStringArray) ?? [];
}
/** Unions `testPaths` into the existing flaky list and writes it back. */
export function recordFlaky(dir: string, testPaths: readonly string[]): void {
  const merged = new Set([...readFlaky(dir), ...testPaths]);
  writeJson(resolve(dir, "flaky.json"), dir, [...merged].sort());
}
function failuresPath(dir: string): string {
  return resolve(dir, "failures.jsonl");
}
/** Appends one failure-signature record per group, one JSON object per line. */
export function recordFailures(dir: string, groups: readonly FailureSignature[]): void {
  if (groups.length === 0) return;
  mkdirSync(dir, { recursive: true });
  const lines = `${groups.map((g) => JSON.stringify(g)).join("\n")}\n`;
  const existing = existsSync(failuresPath(dir)) ? readFileSync(failuresPath(dir), "utf8") : "";
  writeFileSync(failuresPath(dir), existing + lines);
}
/** The top `n` failure signatures by total count across all recorded runs
 *  (ENGINE.md section 13: "the top 3 past failure signatures go into the
 *  implementer brief"). Missing file or all-corrupt lines yield []; a single
 *  bad line is skipped rather than sinking the whole read -- valid JSON of
 *  the wrong shape (null, a number, a record with no count) is exactly as
 *  corrupt as unparseable text and is skipped the same way. */
export function topFailures(dir: string, n = 3): FailureSignature[] {
  const path = failuresPath(dir);
  if (!existsSync(path)) return [];
  const totals = new Map<string, FailureSignature>();
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (line.trim() === "") continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }
    if (!isFailureSignature(parsed)) continue;
    const rec = parsed;
    const prior = totals.get(rec.signature);
    totals.set(rec.signature, {
      signature: rec.signature,
      count: (prior?.count ?? 0) + rec.count,
      sample: rec.sample, // most recent sample wins
    });
  }
  return [...totals.values()].sort((a, b) => b.count - a.count).slice(0, n);
}

```

### Core Architecture Module: `loki-ts/src/engine10/cli.ts`
```
// Loki 10 engine subcommand router (ENGINE.md section 11, slice E-12).
// Reached only through `loki-ts/src/cli.ts` case "engine10", which bin/loki
// selects. Every target module is loaded lazily, and no
// sibling module (types.ts included) is imported statically, so this file
// works before its siblings exist: a missing module prints
// "engine10: <module> not built yet" and exits 2.
//
// Module contract: each target exports `main(args: string[])` returning an
// exit code (or void for 0); stages/deep.ts exports `deepSupervise` and
// `deepWorker` instead.
export interface Route {
  module: string; // path relative to this directory
  fn: string; // exported function name
  args: string[];
}
const TABLE: Record<string, { module: string; fn: string }> = {
  status: { module: "status.ts", fn: "main" },
  verify: { module: "verify_cmd.ts", fn: "main" },
  keys: { module: "keys_cmd.ts", fn: "main" },
  dashboard: { module: "dashboard/server.ts", fn: "main" },
  modernize: { module: "modernize/cli.ts", fn: "main" },
  // Hidden subcommands spawned by the supervisor.
  worker: { module: "worker.ts", fn: "main" },
  session: { module: "session.ts", fn: "main" },
  "deep-supervise": { module: "stages/deep.ts", fn: "deepSupervise" },
  "deep-worker": { module: "stages/deep.ts", fn: "deepWorker" },
};
const USAGE = `Usage:
  loki "<task>"                   run the engine on a free-text task
  loki <issue-url|owner/repo#N>   run on an issue
  loki status [run-id]            latest run by default
  loki verify [--pubkey <file>] [run-id|receipt.json]  check receipt hashes and signature
  loki keys export                print the receipt-signing public key (JWK + kid)
  loki dashboard                  serve the local dashboard
  loki modernize <repo> --to <target>  convert a codebase (loki modernize --help)
Flags: --deep, --provider <name>, --no-pr, --max-cost <usd> (per-run cap; default $100 with an API key, none on a subscription; or loki.yaml budgets.per_run)
`;
// Returns null for an empty or help invocation.
export function route(args: string[]): Route | null {
  const [first, ...rest] = args;
  if (first === undefined || first === "" || first === "--help" || first === "-h") return null;
  const hit = TABLE[first];
  if (hit) return { ...hit, args: rest };
  // Anything else is a run: a task, an issue ref, or flags plus either.
  return { module: "supervisor.ts", fn: "main", args };
}
export type Loader = (specifier: string) => Promise<Record<string, unknown>>;
// A non-literal specifier keeps `bun build` from trying to bundle modules
// that do not exist yet. Production already switched to literal imports (registry.ts, E-32).
const defaultLoader: Loader = (spec) => import(spec);
function isMissing(err: unknown, spec: string): boolean {
  const e = err as { code?: string; message?: string } | null;
  const msg = String(e?.message ?? "");
  const notFound =
    e?.code === "ERR_MODULE_NOT_FOUND" ||
    e?.code === "MODULE_NOT_FOUND" ||
    /Cannot find module|Module not found/i.test(msg);
  // Only the target itself counts: Bun names the specifier ("./status.ts"),
  // while a missing import inside it names that import plus the importer's
  // absolute path, which never contains "./<module>".
  return notFound && msg.includes(spec);
}
export async function runEngine10(args: string[], load: Loader = defaultLoader): Promise<number> {
  const r = route(args);
  if (!r) {
    const help = args[0] === "--help" || args[0] === "-h";
    (help ? process.stdout : process.stderr).write(USAGE);
    return help ? 0 : 2;
  }
  if (r.module === "supervisor.ts") await (await import("../features/warm_client.ts")).tryWarmSafe(process.cwd());
  const spec = `./${r.module}`;
  let mod: Record<string, unknown>;
  try {
    mod = await load(spec);
  } catch (err) {
    if (!isMissing(err, spec)) throw err;
    process.stderr.write(`engine10: ${r.module} not built yet\n`);
    return 2;
  }
  const fn = mod[r.fn];
  if (typeof fn !== "function") {
    process.stderr.write(`engine10: ${r.module} does not export ${r.fn}\n`);
    return 2;
  }
  const code = await (fn as (a: string[]) => unknown)(r.args);
  return typeof code === "number" ? code : 0;
}

```

### Core Architecture Module: `loki-ts/src/engine10/cost.ts`
```
// loki-ts/src/engine10/cost.ts
//
// E-06: harvest result-cost side files (`<lokiRoot>/metrics/result-cost-<iter>.json`, the exact shape writeResultCost in
// src/runner/sdk_stream_parser.ts writes: {total_cost_usd, input_tokens, output_tokens, cache_read_tokens,
// cache_creation_tokens, model}) into cost-event data. Absent/unreadable/no-total_cost_usd, or a dollar figure with
// all-zero usage (E-69, the EV-8 failure mode), all mean UNKNOWN: usd null, never 0.
//
// E-06b: also writes `<lokiRoot>/metrics/efficiency/iteration-<N>.json`, the shape ENGINE.md section 10 and
// autonomy/lib/cost-summary.py read (not ours to change). Unlike the legacy bash writer (autonomy/run.sh), which
// always writes cost_usd (defaulting to 0 when unknown), this omits cost_usd when there is no dollar figure.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** D48: marker on a result-cost file and the cost event/receipt for a CLI-invoker session (LOKI_E10_INVOKER=cli, e.g. the
 *  stub provider) that has no provider-reported dollars. Recorded as 0, never null, and always disclosed in NOT PROVEN. */
export const UNMETERED = "cli-invoker-unmetered";

export interface CostResult {
  unmetered?: boolean; // some session in this sum carried the UNMETERED marker
  usd: number | null;
  // E-69: dollars actually reported by the measured sessions even when usd above is null (some OTHER
  // session in this call wasn't priced). Lets a caller render "partial: $X for N of M" instead of "not measured".
  partialUsd: number;
  measuredCount: number; // sessions with a provider-sourced dollar figure and real usage (see noUsage below)
  totalCount: number; // iterations.length, so a caller can report "N of M"
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  model: string | null; // E-50: provider-reported model from the result-cost file itself, never a guess
  source: string; // comma-joined result-cost file paths that were read
  missing: string[]; // iterations with no dollar figure: no file, a file with no total_cost_usd, or all-zero usage (see noUsage below)
}

export function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

export function resultCostPath(lokiRoot: string, iteration: string): string {
  return join(lokiRoot, "metrics", `result-cost-${iteration}.json`);
}

// Sum across sessions. Any missing session makes usd null: a partial sum
// would understate the run's cost. Tokens still sum what was measured.
export function sumResultCosts(lokiRoot: string, iterations: string[]): CostResult {
  const out: CostResult = {
    usd: null, partialUsd: 0, measuredCount: 0, totalCount: iterations.length,
    input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_creation_tokens: 0,
    model: null, source: "", missing: [],
  };
  const sources: string[] = [];
  let usd = 0;
  for (const iter of iterations) {
    const path = resultCostPath(lokiRoot, iter);
    let rec: Record<string, unknown>;
    try {
      rec = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
    } catch {
      out.missing.push(iter); // no file at all: neither cost nor tokens are usable
      continue;
    }
    // The file parsed, so its tokens are real even when total_cost_usd is absent (a codex/tokens-only
    // session): capture them regardless of a dollar figure below (dropping them was the E-06 bug).
    const inTok = num(rec["input_tokens"]);
    const outTok = num(rec["output_tokens"]);
    const cacheR = num(rec["cache_read_tokens"]);
    const cacheC = num(rec["cache_creation_tokens"]);
    out.input_tokens += inTok;
    out.output_tokens += outTok;
    out.cache_read_tokens += cacheR;
    out.cache_creation_tokens += cacheC;
    if (typeof rec["model"] === "string" && rec["model"]) out.model = rec["model"];
    sources.push(path);
    const c = rec["total_cost_usd"];
    // E-69 (EV-8 failure mode "Cost: $0.00 (claude, 0 tokens)"): a dollar figure with all-zero usage
    // is a session that never really ran, so it's unmeasured like a missing file, never a real $0.00.
    const unmetered = rec["source"] === UNMETERED; // D48: an explicit marker, so the zero is disclosed, not a fake provider figure
    if (unmetered) out.unmetered = true;
    const noUsage = !unmetered && inTok === 0 && outTok === 0 && cacheR === 0 && cacheC === 0;
    if (typeof c !== "number" || !Number.isFinite(c) || noUsage) {
      out.missing.push(iter); // dollars unknown for this session: the usd sum stays unknown too
      continue;
    }
    usd += c;
    out.partialUsd += c;
    out.measuredCount++;
  }
  out.source = sources.join(",");
  if (iterations.length > 0 && out.missing.length === 0) out.usd = usd;
  return out;
}

export function readResultCost(lokiRoot: string, iteration: string): CostResult {
  return sumResultCosts(lokiRoot, [iteration]);
}

// --- E-06b: .loki/metrics/efficiency/iteration-<N>.json -------------------

export interface EfficiencySessionInfo {
  status: string; // "completed" | "failed" | "killed", matching SessionResult/legacy status_str
  durationMs: number;
  model: string;
}

const ITERATION_FILE_RE = /^iteration-(\d+)\.json$/;

function efficiencyDir(lokiRoot: string): string {
  return join(lokiRoot, "metrics", "efficiency");
}

/** N = next integer after any existing iteration-<N>.json (ENGINE.md section 10). */
export function nextEfficiencyIteration(lokiRoot: string): number {
  let names: string[];
  try {
    names = readdirSync(efficiencyDir(lokiRoot));
  } catch {
    return 1;
  }
  let max = 0;
  for (const name of names) {
    const m = ITERATION_FILE_RE.exec(name);
    if (m?.[1]) max = Math.max(max, parseInt(m[1], 10));
  }
  return max + 1;
}

// Writes one efficiency record for a provider session and returns its N. cost_usd is omitted (never written as 0)
// when the session had no provider-reported dollars -- cost-summary.py then reads it as unmeasured, never as free.
export function writeEfficiencyRecord(lokiRoot: string, info: EfficiencySessionInfo, cost: CostResult, costSource = "provider"): number {
  const dir = efficiencyDir(lokiRoot);
  mkdirSync(dir, { recursive: true });
  const n = nextEfficiencyIteration(lokiRoot);
  const rec: Record<string, unknown> = {
    iteration: n,
    status: info.status,
    duration_ms: info.durationMs,
    model: cost.model ?? info.model, // E-50: provider-reported model wins over the caller's guess
  };
  if (cost.usd !== null) {
    rec.cost_usd = cost.usd;
    rec.cost_source = costSource; // EV-1 gate reads only provider-sourced dollars ("partial-stream": E-98e, priced from streamed usage, never itself provider-reported)
  }
  rec.input_tokens = cost.input_tokens;
  rec.output_tokens = cost.output_tokens;
  rec.cache_read_tokens = cost.cache_read_tokens;
  rec.cache_creation_tokens = cost.cache_creation_tokens;
  writeFileSync(join(dir, `iteration-${n}.json`), JSON.stringify(rec));
  return n;
}

// What a provider session calls once it ends: reads its own result-cost file and writes the derived efficiency record
// in the same step. Returns the CostResult so the caller can also emit the `cost` event (section 5) from the same numbers.
export function recordSessionCost(lokiRoot: string, iterationId: string, info: EfficiencySessionInfo): CostResult {
  const cost = readResultCost(lokiRoot, iterationId);
  writeEfficiencyRecord(lokiRoot, info, cost, cost.unmetered ? UNMETERED : "provider");
  return cost;
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #203** (2026-09-14): **Six live dashboard-ui components call /api/v2 endpoints that do not exist**
  *Symptoms*: Confirmed by independent verification of a fleet audit finding.  Six components exported from `dashboard-ui/index.js:100-105` fetch `/api/v2` paths with **zero** server-side references:  | client path | component | |---|---| | /api/v2/activity | loki-activity-stream.js | | /api/v2/agents/leaderboard | loki-agent-leaderboard.js | | /api/v2/cost/breakdown | loki-cost-waterfall.js | | /api/v2/memory/graph | loki-memory-graph.js | | /api/v2/pipeline/status | loki-pipeline-view.js | | /api/v2/providers/health | loki-provider-health.js |  Control: `/api/v2/runs` has 2 server references and `dashboard/api_v2.py` registers 24 routes, so the six zeros are real absences rather than a broken query.  **Scope, stated precisely:** `dashboard-ui/` is NOT in `package.json` files[] (only `dashboard/*.py`, `dashboard/static/`, `dashboard/requirements.txt` ship). So these are repo-dead, NOT shipped-dead. That is why this is filed rather than hotfixed.  **Why no guard caught it:** `tests/test-verify-client-routes.sh` covers web-app only. It passes 9/9 today (101 client calls vs 106 routes) and reads the real FastAPI route table plus a TypeScript AST. Extending it to `dashboard-ui` + `dashboard/server.py` (202 routes) would close the larger surface. Note the dashboard client is plain JS using template concatenation, so the extractor needs a JS path rather than the TS AST walk, and the matcher must treat concatenation as an interpolated segment.
  **Post-Mortem & Fix Analysis**:
  > REFUTED. Closing: the premise is false. There is no `dashboard-ui/` tree in this repo.  ## Measured  ``` dashboard-ui/src        ABSENT dashboard/frontend/src  ABSENT web-app/src             exists, 140 ts/tsx files                         /api/   refs: 59                         /api/v2 refs: 0 ```  So the "six live dashboard-ui components calling /api/v2" do not exist. The real front-end tree is `web-app/src`, and it makes zero `/api/v2` calls.  The 209 repo-wide `/api/v2` hits are server-side (`dashboard/api_v2.py` defines `APIRouter(prefix="/api/v2")` at `:39`, wired in `dashboard/server.py:68`) plus `autonomy/graphify-out/cache/` AST cache noise. A server route existing with no client calling it is not a broken client.  ## How I produced the false finding  My original search ran against `dashboard-ui/src`, a directory that does not exist. `grep -rn` over a missing path returns nothing and exits non-zero, and I read that silence as "no matches found in a real tree" rather than "the

- **Issue #201** (2026-09-14): **codex provider resolves an empty model for all three tiers**
  *Symptoms*: Confirmed EMPIRICALLY, not just by reading.      load_provider codex  -> PLANNING=[] DEV=[] FAST=[]     load_provider cline  -> PLANNING=[openrouter/deepseek/deepseek-v3.2] (control)  **Cause:** `providers/codex.sh` never sources `providers/models.sh`. It guards with `command -v loki_latest_model` at `:147`, using the catalog only if that function is ALREADY defined. `cline.sh` and `aider.sh` each source `models.sh` (2 references apiece); `codex.sh` has zero. `run.sh` sources `loader.sh` but never `models.sh`.  Not load-order fixable: the sibling helpers source `models.sh` inside a function body, so the definition does not persist for a later provider.  **Scope:** `providers/` IS shipped in files[], so this reaches npm users. The main-loop codex arm hardcodes its invocation without `--model`, so blast radius is the `provider_invoke_argv`/council path and an inert `LOKI_SESSION_MODEL` on codex.  **Why the guard did not catch it:** `tests/test-provider-invocation.sh:343` wedges `LOKI_MODEL_PLANNING` before asserting, so the test passes against the broken resolution.  Not fixed unilaterally: touching provider dispatch warrants a deliberate review.
  **Post-Mortem & Fix Analysis**:
  > Closing: the empty default is DELIBERATE and correct, not a bug. My issue title was wrong.  `CODEX_DEFAULT_MODEL=""` at `providers/codex.sh:107` is intentional, and the rationale is recorded in the file immediately above it (`:96-106`):  - The old pin was written against Codex CLI v0.98 and never re-verified; the installed CLI is 0.144.6. - Valid model names differ per account tier and change with upstream releases, so as the comment puts it, THIS FILE CANNOT KNOW THEM. - Replacing the stale pin with a fresher hardcoded string would repeat the same mistake with a newer string. - Codex already resolves an account-appropriate default, honoring `~/.codex/config.toml`. - Measured and recorded in the same comment: `codex exec "..."` with no `--model` works, 22255 tokens, correct output.  So "resolves an empty model for all three tiers" describes the intended behavior: pass no `--model` and let Codex choose. An operator who wants a specific model sets `LOKI_CODEX_MODEL` or `LOKI_MODEL_*`, wh

- **Issue #140** (2026-03-19): **purple-lab: model tier display uses heuristic not actual RARV mapping**
  *Symptoms*: getModelTier() guesses tier from phase keywords. Actual allocation in run.sh is iteration-based. Display often wrong.\n\nLocation: web-app/src/components/ControlBar.tsx:20-25
  **Post-Mortem & Fix Analysis**:
  > Fixed in v6.37.2.

- **Issue #139** (2026-03-19): **provider: codex env var CODEX_MODEL_REASONING_EFFORT not namespaced**
  *Symptoms*: Provider sets CODEX_MODEL_REASONING_EFFORT without namespacing. Conflicts if another tool uses same variable.\n\nLocation: providers/codex.sh:162
  **Post-Mortem & Fix Analysis**:
  > Fixed in v6.37.1

- **Issue #138** (2026-03-19): **cli: export --json silently fails without jq**
  *Symptoms*: Same pattern as explain --json. No upfront jq check. Error appears after processing.\n\nLocation: autonomy/loki:4582-4853
  **Post-Mortem & Fix Analysis**:
  > Fixed in v6.37.0. See release notes: https://github.com/asklokesh/loki-mode/releases/tag/v6.37.0

- **Issue #137** (2026-03-19): **purple-lab: onboard path check bypassed by macOS /tmp symlink**
  *Symptoms*: Path traversal check uses startswith(str(home)). On macOS /tmp -> /private/tmp, realpath mismatch can bypass the check.\n\nLocation: web-app/server.py:839-854
  **Post-Mortem & Fix Analysis**:
  > Fixed in v6.37.1

- **Issue #136** (2026-03-19): **purple-lab: session detail regex rejects project names with dots**
  *Symptoms*: Session ID regex ^[a-zA-Z0-9_-]+$ rejects directories with dots (e.g., project-1.0). Valid project names become inaccessible.\n\nLocation: web-app/server.py (get_session_detail)
  **Post-Mortem & Fix Analysis**:
  > Fixed in v6.37.0. See release notes: https://github.com/asklokesh/loki-mode/releases/tag/v6.37.0

- **Issue #135** (2026-03-19): **purple-lab: CORS hardcoded to localhost only**
  *Symptoms*: CORS allows only localhost origins. Remote deployments and Docker get silent CORS failures. Should read from env var.\n\nLocation: web-app/server.py:47-52
  **Post-Mortem & Fix Analysis**:
  > Fixed in v6.36.x series. See CHANGELOG.

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

### Incident Patch 1: `f02cd682` (2026-10-04)
**Commit Message**: fix(engine10): a tree-wide keyword is not a relevant test (FC-27)

A short brief that only shares a token with most paths was sized small
and skipped the Wall, because keyword overlap counted that token as
naming a file. The lean path now ignores tokens that hit more than half
the repo map. Plan file hints are unchanged. A distinctive symbol still
keeps the lean path.

**File**: `docs/v10/FAILURE-CLASSES.md` (modified, +7/-0)
```diff
@@ -312,3 +312,10 @@ L0 review rule (ENGINE-LAWS.md L0): a fix that adds an `if` or a regex about the
 - Siblings: every CP entry that spawns `loki` (POST /v1/start, /v1/runs, retry); every summary line that is derived without a verify event; the stale-CP restart (a CP from an old install keeps the old behavior after upgrade).
 - Mechanism: one repoRefusal check in spawn.ts (refuse `/`, HOME and non-git dirs with a human reason) that every spawn path calls; one summaryLine that reads the terminal stop event; free text goes to Ask (read-only) and never to /v1/start.
 - Fixture: packages/control-plane test for repoRefusal (HOME, `/`, non-git, real repo); the A4b summaryLine test ("The run failed before verification ran." for a FAILED run with no verify event); the A3f cleanup test with cc22 and e606 look-alikes.
+
+## FC-27 A short product brief skips the Wall because a tree-wide token looks like a named file
+- User saw: `loki start` with a one-line UI brief on a local repo (run e10-20261004T143536Z-2582) sized the task small, skipped Plan, and skipped the Wall ("small task with a relevant test"). The implementer edited test configuration, broke an existing test, and the run ended FAILED with no PR. Raw Claude Code would have kept planning against the repo instead of treating the brief as a covered one-file fix. The receipt also listed deferred deep checks, "repo not recorded" (no GitHub remote), and "playwright not resolvable"; those are separate output gaps, not this mechanism.
+- Law: L0 (the harness must not decide that an unnamed brief already names its files), L2 (sizing and the Wall are work surfaces: when the signal is not specific, keep the Wall).
+- Siblings: `selectRelevantFiles` (plan hints, decompose, implement brief context) still counts every overlapping token, on purpose. The only caller that turns that list into a skipped Wall is `speedLikelyFiles` via `hasRelevantTests` (plan.ts and wall.ts). `namedFiles` (basename in the task text) is unchanged and still lean-eligible.
+- Mechanism: one selector, `selectSpecificFiles`, drops tokens that occur in more than half the repo-map entries before scoring. `speedLikelyFiles` uses it. A distinctive symbol still selects its file. Plan hints stay on `selectRelevantFiles`.
+- Fixture: loki-ts/tests/engine10/sizing_lean.test.ts, "FC-27: a token on most paths is not a relevant test, so the Wall stays".
```

**File**: `loki-ts/src/engine10/relevant_files.ts` (modified, +23/-12)
```diff
@@ -8,20 +8,31 @@ function keywords(task: string): string[] {
   return Array.from(new Set(words.filter((w) => w.length > 2)));
 }
 
-/** Keyword overlap between task and repo map entry (path plus symbols); zero-score files are dropped, ties keep repo map order. */
-export function selectRelevantFiles(task: string, repoMap: RepoMap, max: number = MAX_RELEVANT_FILES): string[] {
-  const words = keywords(task);
-  if (words.length === 0) return [];
+const haystack = (entry: RepoMap["entries"][number]): string => `${entry.path} ${entry.symbols.join(" ")}`.toLowerCase();
 
+function rank(words: string[], repoMap: RepoMap, max: number): string[] {
+  if (words.length === 0) return [];
   const scored = repoMap.entries.map((entry, idx) => {
-    const haystack = `${entry.path} ${entry.symbols.join(" ")}`.toLowerCase();
-    const score = words.reduce((n, w) => n + (haystack.includes(w) ? 1 : 0), 0);
-    return { path: entry.path, score, idx };
+    const hay = haystack(entry);
+    return { path: entry.path, score: words.reduce((n, w) => n + (hay.includes(w) ? 1 : 0), 0), idx };
   });
+  return scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score || a.idx - b.idx).slice(0, max).map((s) => s.path);
+}
 
-  return scored
-    .filter((s) => s.score > 0)
-    .sort((a, b) => b.score - a.score || a.idx - b.idx)
-    .slice(0, max)
-    .map((s) => s.path);
+/** Keyword overlap between task and repo map entry (path plus symbols); zero-score files are dropped, ties keep repo map order. */
+export function selectRelevantFiles(task: string, repoMap: RepoMap, max: number = MAX_RELEVANT_FILES): string[] {
+  return rank(keywords(task), repoMap, max);
+}
+
+/** Same overlap, minus tokens that occur in more than half the entries. Those name the tree, not a file.
+ *  The lean Wall skip uses this (FC-27). Plan hints stay on selectRelevantFiles. */
+export function selectSpecificFiles(task: string, repoMap: RepoMap, max: number = MAX_RELEVANT_FILES): string[] {
+  const entries = repoMap.entries;
+  if (entries.length === 0) return [];
+  const hays = entries.map(haystack);
+  const specific = keywords(task).filter((w) => {
+    const hits = hays.reduce((n, h) => n + (h.includes(w) ? 1 : 0), 0);
+    return hits > 0 && hits * 2 <= hays.length;
+  });
+  return rank(specific, repoMap, max);
 }
```

**File**: `loki-ts/src/features/speed/lean_select.ts` (modified, +6/-4)
```diff
@@ -1,9 +1,11 @@
-// D61-03: behind LOKI_SPEED=1, a task that names no file may still go lean when plan.ts keyword
-// selection over the repo map finds files. The caller still requires a runner and impacted tests, so no match, no flag, or no map all return [] and the task stays on Wall (fail-safe).
+// D61-03: behind LOKI_SPEED (default on; =0 off), a task that names no file may still go lean when
+// keyword selection finds files. FC-27: a token that hits more than half the entries names the tree,
+// not a file, so it is not a relevant-test signal and the task stays on the Wall (fail-safe).
+// The caller still requires a runner and impacted tests. No match, no flag, or no map all return [].
 import type { RepoMap } from "../../engine10/repomap.ts";
-import { selectRelevantFiles } from "../../engine10/relevant_files.ts";
+import { selectSpecificFiles } from "../../engine10/relevant_files.ts";
 
 export function speedLikelyFiles(task: string, map: RepoMap | null, env: NodeJS.ProcessEnv = process.env): string[] {
   if (env["LOKI_SPEED"] === "0" || !map) return [];
-  try { return selectRelevantFiles(task, map); } catch { return []; }
+  try { return selectSpecificFiles(task, map); } catch { return []; }
 }
```

**File**: `loki-ts/tests/engine10/sizing_lean.test.ts` (modified, +22/-0)
```diff
@@ -1,5 +1,6 @@
 // D61-03: lean eligibility without a named file; fail-safe to Wall.
 import { afterEach, describe, expect, it } from "bun:test";
+import { selectRelevantFiles, selectSpecificFiles } from "../../src/engine10/relevant_files.ts";
 import { hasRelevantTests, smallTaskPath, sizeTask } from "../../src/engine10/sizing.ts";
 import type { RepoMap } from "../../src/engine10/repomap.ts";
 import type { TestMap, TestRef } from "../../src/engine10/types.ts";
@@ -37,4 +38,25 @@ describe("D61-03 lean eligibility without a named file", () => {
     expect(hasRelevantTests("zzz qqq", map, TM, one)).toBe(false);
     expect(hasRelevantTests(task, null, TM, one)).toBe(false);
   });
+
+  it("FC-27: a token on most paths is not a relevant test, so the Wall stays", () => {
+    process.env["LOKI_SPEED"] = "1";
+    const wide: RepoMap = {
+      files: ["acme-web/a.tsx", "acme-web/b.tsx", "acme-web/c.tsx", "acme-web/d.tsx"],
+      entries: [
+        { path: "acme-web/a.tsx", symbols: [] },
+        { path: "acme-web/b.tsx", symbols: [] },
+        { path: "acme-web/c.tsx", symbols: [] },
+        { path: "acme-web/d.tsx", symbols: ["renderInvoice"] },
+      ],
+      truncated: false,
+    };
+    const brief = "upgrade the acme experience";
+    expect(selectRelevantFiles(brief, wide).length).toBe(4); // plan hints may still list the tree
+    expect(selectSpecificFiles(brief, wide)).toEqual([]);
+    expect(hasRelevantTests(brief, wide, TM, one)).toBe(false);
+    expect(smallTaskPath(sizeTask(brief, wide, TM).size, false)).toBe("wall");
+    expect(selectSpecificFiles("fix the rounding in renderInvoice totals for acme", wide)).toEqual(["acme-web/d.tsx"]);
+    expect(hasRelevantTests("fix the rounding in renderInvoice totals for acme", wide, TM, one)).toBe(true);
+  });
 });
```

---

### Incident Patch 2: `559d3e60` (2026-10-04)
**Commit Message**: fix(test): FC-19 deep-limit assertion tolerates 1ms of elapsed budget (run 37173985482)

The first implement session read 1799.999 on CI. Assert 1799 < limit <= 1800; a 480s limit still fails. machine.test.ts 36/0.

Claude-Session: https://claude.ai/code/session_01GFNzL4TEfAXvX1KK5buE9w

**File**: `loki-ts/tests/engine10/machine.test.ts` (modified, +2/-1)
```diff
@@ -276,7 +276,8 @@ describe("engine10 machine", () => {
     ctx.sessions = { run: async (o) => { seen.push(o.limitS); return { exit: 0, markers: { done: true, alreadyDone: null, specConflict: null }, durationS: 0, killed: false }; } };
     const impl: Stage = { name: "implement", targetS: 180, limitS: 480, run: async (c, _s) => { await c.sessions.run({ stage: "implement", brief: "b", tier: "development", iterationId: "i", limitS: 480, signal: new AbortController().signal }); return { status: "completed", data: {} }; } };
     await runMachine(ctx, { load: loaderOf(all({ implement: impl })) });
-    expect(seen[0]).toBe(1800); // run 37171623026: CI saw a second session at 1799.999 (FC-21b A2 budget-left); assert the limit, not the call count or the elapsed ms
+    expect(seen[0]).toBeGreaterThan(1799); // runs 37171623026 and 37173985482: the budget-left limit (FC-21b A2) can read 1799.999 after 1ms elapsed; assert the deep limit, not the elapsed ms
+    expect(seen[0]).toBeLessThanOrEqual(1800);
     expect(seen.every((s) => s > 480 && s <= 1800)).toBe(true);
   });
 
```

---

### Incident Patch 3: `31efd8bd` (2026-10-04)
**Commit Message**: fix(tests): green the 11.0.0 Tests guards (run 37172048345)

CP-04: Dockerfile.control-plane COPYs xreview.ts; control-plane UI tests assert the displayOutcome labels and the no-session dash from f26deef50 (bun 515/0, CP-04 25/0). DEPS: receipt-check action row. S-134: drop shard rows for the removed loki legacy suites. CPE24-L7: allowlist .gitleaksignore fingerprints. DOC-02: allowlist the historical loki legacy mentions in GUIDE, LEGACY-REMOVAL and RELEASE-11.

Claude-Session: https://claude.ai/code/session_01GFNzL4TEfAXvX1KK5buE9w

**File**: `Dockerfile.control-plane` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ COPY loki-ts/src/util/redact.ts /src/loki-ts/src/util/
 # The CP routes (CPE24) widened that closure; tests/test-control-plane.sh lists it (CP-04).
 COPY loki-ts/src/e10ext/assert_delta.ts loki-ts/src/e10ext/commit_filter.ts loki-ts/src/e10ext/discard.ts loki-ts/src/e10ext/preexisting_dirty.ts loki-ts/src/e10ext/scope.ts /src/loki-ts/src/e10ext/
 COPY loki-ts/src/engine10/keys_cmd.ts loki-ts/src/engine10/testmap.ts loki-ts/src/engine10/verify_cmd.ts /src/loki-ts/src/engine10/
-COPY loki-ts/src/engine10/stages/seal.ts /src/loki-ts/src/engine10/stages/
+COPY loki-ts/src/engine10/stages/seal.ts loki-ts/src/engine10/stages/xreview.ts /src/loki-ts/src/engine10/stages/
 COPY loki-ts/src/features/contract.ts loki-ts/src/features/receipt_dsse.ts loki-ts/src/features/visual_evidence.ts /src/loki-ts/src/features/
 COPY loki-ts/src/features/speed/seal_group.ts loki-ts/src/features/speed/unit_mode.ts /src/loki-ts/src/features/speed/
 COPY loki-ts/src/util/check_result.ts loki-ts/src/util/paths.ts loki-ts/src/util/receipt_signer.ts loki-ts/src/util/run_pid.ts loki-ts/src/util/safe_git.ts loki-ts/src/util/shell.ts /src/loki-ts/src/util/
```

**File**: `docs/v10/DEPS.md` (modified, +1/-0)
```diff
@@ -216,6 +216,7 @@ Inventory only. No dependency, lockfile, workflow or image was changed to produc
 | `.github/workflows/tier-a.yml` | `actions/setup-node@v4` | `v4 (resolves to v4.4.0)` | `v7.0.0` | MAJOR | tag-pinned (not SHA-pinned); floating tag v4 resolves to v4.4.0 (commit 49933ea5288c), behind latest release v7.0.0 (commit 820762786026); action.yml declares `using: node20` -- this action IS the deprecated Node 20 runtime |
 | `action.yml` | `actions/setup-node@v4` | `v4 (resolves to v4.4.0)` | `v7.0.0` | MAJOR | tag-pinned (not SHA-pinned); floating tag v4 resolves to v4.4.0 (commit 49933ea5288c), behind latest release v7.0.0 (commit 820762786026); action.yml declares `using: node20` -- this action IS the deprecated Node 20 runtime |
 | `.github/actions/issue-to-pr/action.yml` | `(none found)` | `` | `-` | n/a | no `uses:` step found in this workflow/action file |
+| `.github/actions/receipt-check/action.yml` | `(none found)` | `` | `-` | n/a | no `uses:` step found in this workflow/action file |
 | `.github/actions/review/action.yml` | `(none found)` | `` | `-` | n/a | no `uses:` step found in this workflow/action file |
 
 **Node 20 runtime deprecation:** GitHub's own Node 20 deprecation covers two distinct things and they must not be conflated. First, matrix jobs still targeting `node-version: 20` (files: .github/workflows/test.yml). Second, and separately: an action whose OWN `action.yml` declares `using: node20` IS the deprecated runtime itself, regardless of what version tag or SHA it is pinned to -- pinning to the latest release of such an action does not fix this until that action's maintainers migrate its action.yml to node22 or later. Every `uses:` target in this repo's workflows was checked at its pinned ref via the GitHub Contents API; action.yml itself declares node20 for: actions/cache, actions/checkout, actions/download-artifact, actions/setup-node, actions/setup-python, actions/upload-artifact, azure/setup-helm, contributor-assistant/github-action, docker/build-push-action, docker/login-action, docker/setup-buildx-action, github/codeql-action/analyze, github/codeql-action/init, peter-evans/dockerhub-description.
```

**File**: `packages/control-plane/test/ui/design.test.tsx` (modified, +1/-1)
```diff
@@ -149,7 +149,7 @@ test("Card, KpiTile, Badge, Pill, StatusDot render", () => {
   expect(screen.getByText("card body")).toBeDefined();
   expect(screen.getByText("$1.20").style.fontFamily).toContain("font-mono");
   expect(container.querySelectorAll('[data-cp="sparkline"]').length).toBe(1);
-  expect(container.querySelector('[data-cp="badge"][data-tone="info"]')?.textContent).toBe("SPEC_CONFLICT");
+  expect(container.querySelector('[data-cp="badge"][data-tone="info"]')?.textContent).toBe("Needs your answer");
   expect(container.querySelector('[data-cp="badge"][data-tone="neutral"] .cp-pulse')).not.toBeNull();
   expect(screen.getByLabelText("active").getAttribute("data-state")).toBe("active");
 });
```

**File**: `packages/control-plane/test/ui/live.test.tsx` (modified, +1/-1)
```diff
@@ -52,7 +52,7 @@ test("live run: finished run shows outcome with PR and receipt links", async ()
   }) });
   render(<LiveRun source="s1" run="r1" />);
   const out = await screen.findByTestId("live-outcome");
-  expect(out.textContent).toContain("VERIFIED");
+  expect(out.textContent).toContain("Verified");
   expect(screen.getByTestId("live-pr").getAttribute("href")).toBe("https://github.com/o/r/pull/7");
   expect(screen.getByTestId("live-receipt").textContent).toContain("signed");
   expect(screen.getByTestId("live-cost").textContent).toBe("$0.12");
```

**File**: `packages/control-plane/test/ui/run.test.tsx` (modified, +2/-2)
```diff
@@ -57,8 +57,8 @@ test("fixture run: title header, terminal panel, and every section; missing data
   expect(screen.getByTestId("tl-time").textContent).toBe("10:00:00");
   expect(screen.getByTestId("tl-desc").textContent).toContain("Named the files and tests in scope");
   expect(screen.getByTestId("tl-duration").textContent).toBe("running");
-  expect(screen.getByTestId("tl-model").textContent).toBe("unmeasured");
-  expect(screen.getByTestId("tl-cost").textContent).toBe("unmeasured");
+  expect(screen.getByTestId("tl-model").textContent).toBe("-");
+  expect(screen.getByTestId("tl-cost").textContent).toBe("-");
   // changed files come from the diff
   await waitFor(() => expect(screen.getByTestId("run-diff").textContent).toContain("a.ts"));
   expect(screen.getByTestId("run-diff").textContent).toContain("+1");
```

**File**: `packages/control-plane/test/ui/tampered.test.tsx` (modified, +1/-1)
```diff
@@ -75,7 +75,7 @@ test("overview shows Tampered in latest by issue", () => {
 test("receipts list shows TAMPERED and the rate excludes it", async () => {
   render(<Receipts />);
   await screen.findAllByTestId("verify-btn");
-  expect(screen.getAllByText("TAMPERED").length).toBe(1);
+  expect(screen.getAllByText("Tampered").length).toBe(1);
   expect(screen.getByText("50%")).toBeTruthy();
   expect(verifiedTrend([{ started_at: "2026-10-03T10:00:00Z", verdict: "VERIFIED", tampered: true }])[0]!.rate).toBe(0);
 });
```

**File**: `packages/control-plane/test/ui/timeline.test.ts` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@ test("verified-pr fixture: one line per stage with duration, model, cost and out
   const impl = tl.find((l) => l.label === "implement")!;
   expect(impl).toMatchObject({ outcome: "completed", duration_s: 0.089, model: "claude-sonnet-5", cost_usd: 0 });
   expect(tl.find((l) => l.label === "plan")!.model).toBe("sonnet");
-  expect(tl.find((l) => l.label === "intake")!.cost_usd).toBeNull();
+  expect(tl.find((l) => l.label === "intake")!.cost_usd).toBe("no-session"); // f26deef50: intake ran no model session
   expect(tl.find((l) => l.label === "Run completed")!.outcome).toBe("VERIFIED");
   expect(tl.find((l) => l.label === "Receipt sealed")!.outcome).toBe("signed");
 });
```

**File**: `tests/docs-drift-allowlist.tsv` (modified, +3/-0)
```diff
@@ -42,3 +42,6 @@ docs/certification/certification-exam.md	--new-token	wrong-answer distractor in
 docs/certification/certification-exam.md	--enterprise	wrong-answer distractor in the exam
 docs/certification/certification-exam.md	--max-cost	wrong-answer distractor in the exam
 docs/v10/D63-CARDS.md	loki foo	D63 card C5 routing example of an unknown one-word arg, not a command
+docs/v10/GUIDE.md	loki legacy	states that 11.0.0 removed the command
+docs/v10/LEGACY-REMOVAL.md	loki legacy	the removal plan for the command
+docs/v10/RELEASE-11.md	loki legacy	11.0.0 release record of the removal
```

---

### Incident Patch 4: `6f1e595b` (2026-10-04)
**Commit Message**: fix(release): FC-19 deep-limit test asserts the limit, not elapsed ms (run 37171623026)

Claude-Session: https://claude.ai/code/session_01GFNzL4TEfAXvX1KK5buE9w

**File**: `loki-ts/tests/engine10/machine.test.ts` (modified, +2/-1)
```diff
@@ -276,7 +276,8 @@ describe("engine10 machine", () => {
     ctx.sessions = { run: async (o) => { seen.push(o.limitS); return { exit: 0, markers: { done: true, alreadyDone: null, specConflict: null }, durationS: 0, killed: false }; } };
     const impl: Stage = { name: "implement", targetS: 180, limitS: 480, run: async (c, _s) => { await c.sessions.run({ stage: "implement", brief: "b", tier: "development", iterationId: "i", limitS: 480, signal: new AbortController().signal }); return { status: "completed", data: {} }; } };
     await runMachine(ctx, { load: loaderOf(all({ implement: impl })) });
-    expect(seen).toEqual([1800]);
+    expect(seen[0]).toBe(1800); // run 37171623026: CI saw a second session at 1799.999 (FC-21b A2 budget-left); assert the limit, not the call count or the elapsed ms
+    expect(seen.every((s) => s > 480 && s <= 1800)).toBe(true);
   });
 
   it("FC-19: implement limit comes from the run budget, not a fixed 480s", async () => {
```

---

### Incident Patch 5: `f4d22384` (2026-10-04)
**Commit Message**: fix(release): 11.0.0 gate reds (run 37170767617)

- xreview.ts: the cross-review git diff goes through safeGitArgv/safeGitEnv (raw git spawn guard).
- gather.ts isGitTracked: pass env explicitly (spawn env guard).
- project_model.test.ts: stage only the new package dir; force-adding .loki/project.json now makes it the committed shared model (B5).
- fc25_safe_git LFS test: skipped on GitHub Actions only; red in CI, green in an ubuntu bun container and on macOS. Owed after Oct 7.
Local: loki-ts bun test 3729 pass 0 fail, tsc 0, dist guard 13/0.

Claude-Session: https://claude.ai/code/session_01GFNzL4TEfAXvX1KK5buE9w

**File**: `loki-ts/src/engine10/stages/xreview.ts` (modified, +2/-1)
```diff
@@ -4,6 +4,7 @@
 import { existsSync, readFileSync } from "node:fs";
 import { join } from "node:path";
 import { run } from "../../util/shell.ts";
+import { safeGitArgv, safeGitEnv } from "../../util/safe_git.ts";
 import type { RunContext, Verdict } from "../types.ts";
 
 export type ReviewProvider = "codex" | "claude";
@@ -54,7 +55,7 @@ export function parseReview(p: ReviewProvider, out: string): CrossReview {
 export async function crossReview(ctx: RunContext, verdict: Verdict, head: string): Promise<CrossReview | null> {
   const p = reviewProvider(ctx.repoDir); if (!p) return null;
   if (verdict !== "VERIFIED" && verdict !== "ALREADY_SATISFIED") return null; // nothing a review could downgrade
-  const d = await run(["git", "diff", "--no-ext-diff", "--no-color", ctx.baseSha, head, "--", ".", ":(exclude).loki"], { cwd: ctx.repoDir, timeoutMs: 20000 }).catch(() => null);
+  const d = await run(safeGitArgv(["diff", "--no-ext-diff", "--no-color", ctx.baseSha, head, "--", ".", ":(exclude).loki"], false, ctx.repoDir), { cwd: ctx.repoDir, env: safeGitEnv() as Record<string, string>, timeoutMs: 20000 }).catch(() => null);
   if (!d || d.exitCode !== 0) return { provider: p, level: "not_run", notes: [`cross-review not run: diff unavailable for ${p}`] };
   const prompt = ["You are an independent code reviewer. Review ONLY the diff below for correctness bugs, spec violations and missing tests. Do not modify files.",
     "Reply with a first line exactly `VERDICT: PASS`, `VERDICT: FLAG` (concerns) or `VERDICT: BLOCK` (a reproduced defect), then one `- reason` line per concern.", "", "```diff", d.stdout.slice(0, MAX_DIFF), "```"].join("\n");
```

**File**: `loki-ts/src/project_model/gather.ts` (modified, +1/-1)
```diff
@@ -104,7 +104,7 @@ export function computeKey(repoDir: string, fingerprintFiles: string[], dirs: st
  *  gitignored cache file is never treated as a committed, shared model. */
 export function isGitTracked(repoDir: string, relPath: string): boolean {
   try {
-    const out = execFileSync("git", ["ls-files", "--error-unmatch", "--", relPath], { cwd: repoDir, stdio: ["ignore", "pipe", "ignore"], timeout: 10_000 });
+    const out = execFileSync("git", ["ls-files", "--error-unmatch", "--", relPath], { cwd: repoDir, env: process.env, stdio: ["ignore", "pipe", "ignore"], timeout: 10_000 });
     return out.toString().trim() !== "";
   } catch {
     return false;
```

**File**: `loki-ts/tests/project_model/project_model.test.ts` (modified, +2/-1)
```diff
@@ -156,7 +156,8 @@ describe("discovery", () => {
     const m = mock([RECORDED]);
     await discoverProjectModel(ctxFor(d, m.runner), sig);
     cpSync(join(d, "frontend"), join(d, "admin"), { recursive: true });
-    execFileSync("git", ["add", "-A", "-f"], { cwd: d, stdio: "pipe", env: process.env });
+    // stage only the new package: force-adding .loki/project.json would make it the committed shared model (B5)
+    execFileSync("git", ["add", "-A", "-f", "--", "admin"], { cwd: d, stdio: "pipe", env: process.env });
     expect((await discoverProjectModel(ctxFor(d, m.runner), sig)).cached).toBe(false);
   });
 });
```

**File**: `loki-ts/tests/util/fc25_safe_git.test.ts` (modified, +2/-1)
```diff
@@ -89,7 +89,8 @@ test("FC-25b: a required=true filter is blanked: the command never runs and git
 
 // FC-25b LFS regression: the USER's global lfs-style filter (required=true) and in-tree .gitattributes routing must keep working.
 // Blanking global keys or hiding .gitattributes (GIT_ATTR_SOURCE=empty tree) turned this into ` M big.bin` / "clean filter failed" / raw blobs staged.
-test("FC-25b LFS: a global pointer filter with required=true and in-tree routing still yields clean status and pointer blobs through safeGit", () => {
+// Skipped on GitHub Actions only: red in release run 37170767617 (` M big.bin`) yet green in an ubuntu/bun container and on macOS. Owed after Oct 7 (RELEASE-11.md).
+test.skipIf(!!process.env.GITHUB_ACTIONS)("FC-25b LFS: a global pointer filter with required=true and in-tree routing still yields clean status and pointer blobs through safeGit", () => {
   const d = mkdtempSync(join(root, "lfs-")), r = join(d, "repo"), store = join(d, "store"), gcfg = join(d, "global.cfg");
   mkdirSync(r); mkdirSync(store);
   const clean = join(d, "clean.sh"), smudge = join(d, "smudge.sh");
```

---

### Incident Patch 6: `f880c575` (2026-10-04)
**Commit Message**: fix(security): baseline the gitleaks match on the .gitleaksignore comment line 123 (a file path, not a key)

Claude-Session: https://claude.ai/code/session_01GFNzL4TEfAXvX1KK5buE9w

**File**: `.gitleaksignore` (modified, +2/-0)
```diff
@@ -129,3 +129,5 @@ acb76a1913ee5bb0f725832db3f192ea52a1ddb2:docs/CONFIG-FILE-PLAN.md:generic-api-ke
 # Deleted legacy dashboard-ui maskToken test fixture: sk_live_ followed by the sequential alphabet (16 chars), a synthetic value, never a real Stripe key.
 f1aac14d33fe4bef7622848b24bb721e4800ad1d:dashboard-ui/tests/ui-components.test.js:stripe-access-token:322
 dcca5ebb5ca767b4b1358c66fc7d5d724f82251b:dashboard-ui/tests/ui-components.test.js:stripe-access-token:322
+# .gitleaksignore:123 is the comment above naming a public PEM file path; no key material.
+dd61901dc34ca13c107c7f9800171f6cec2efe45:.gitleaksignore:generic-api-key:123
```

---

### Incident Patch 7: `df4f241a` (2026-10-04)
**Commit Message**: docs(guide): legacy engine switch removed in 11.0.0; docs test detects the single-engine bin/loki (A6b follow-up)

Claude-Session: https://claude.ai/code/session_01GFNzL4TEfAXvX1KK5buE9w

**File**: `docs/v10/GUIDE.md` (modified, +17/-22)
```diff
@@ -1,21 +1,19 @@
 # Loki 10 engine guide
 
-Default: Loki 10 engine for `loki "<task>"`, `loki owner/repo#N` and `loki quick "<task>"`. Set LOKI_ENGINE=legacy or run `loki legacy <args>` for the previous engine. <!-- loki10-default -->
+Default: Loki 10 engine for `loki "<task>"`, `loki owner/repo#N` and `loki quick "<task>"`. `loki legacy` and LOKI_ENGINE were removed in 11.0.0. <!-- loki10-default -->
 
 Loki 10 is the rewritten engine (docs/v10/ENGINE.md). Since the D48 flip it
-is the default for three entry points: `loki "<task>"`, `loki owner/repo#N`
-(issue mode) and `loki quick "<task>"`. Each prints one start line,
-`Loki 10 engine (set LOKI_ENGINE=legacy or run 'loki legacy' for the previous
-engine)`, then the summary below. `loki start <issue ref | issue URL | "multi-word task">` takes the same
-v10 path as `loki <ref>`. Everything else (`loki start ./prd.md`, `loki
-status`, `loki dashboard` and the rest) is unchanged unless you set
-LOKI_ENGINE=v10 explicitly, which also routes status, verify and dashboard
-to the v10 commands. Bare `loki verify` (no LOKI_ENGINE) follows the newest
-run: when the newest entry in .loki/runs/ is a v10 run newer than the newest
-legacy proof it runs the v10 verify, otherwise the legacy verify. If bun is
-missing or LOKI_PROVIDER is unsupported, the default mode falls back to the
-legacy engine and prints one stderr line saying why. The previous engine stays one step away:
-`loki legacy <args>` and LOKI_ENGINE=legacy.
+runs `loki "<task>"`, `loki owner/repo#N` (issue mode) and `loki quick
+"<task>"`, each printing one start line beginning `Loki 10 engine`, then the
+summary below. `loki start <issue ref | issue URL | "multi-word task">` takes
+the same v10 path as `loki <ref>`. `loki keys` and `loki verify --pubkey`
+always run on Loki 10. Bare `loki verify` follows the newest run: when the
+newest entry in .loki/runs/ is a v10 run newer than the newest legacy proof
+it runs the v10 verify, otherwise the legacy verify. If bun is missing or
+LOKI_PROVIDER is unsupported, the default mode falls back to the bash path
+and prints one stderr line saying why. In 11.0.0 (LEGACY-ZERO W1-01) `loki
+legacy` was removed (it exits 2 with a removal message) and LOKI_ENGINE is no
+longer read; any value is ignored.
 
 `loki start owner/repo#N`, `loki start <issue URL>` and `loki start "<multi-word
 task>"` run Loki 10, the same as `loki owner/repo#N` and `loki "<task>"`. A PRD
@@ -238,11 +236,8 @@ provider names (`claude`, `codex`, `cline`, `aider`); it is not supported.
 ## After the flip
 
 D48 made v10 the default for `loki "<task>"`, `loki owner/repo#N` and
-`loki quick "<task>"`. The previous engine stays fully reachable and
-unchanged: `loki legacy <args>` (prints a short deprecation notice to
-stderr, then runs exactly the pre-flip route for `<args>`) and
-`LOKI_ENGINE=legacy` (the same, without the notice, for scripts). Any
-LOKI_ENGINE value other than v10 or unset also keeps the legacy engine.
-Nothing is removed at the flip. The one place that records which state we
-are in is the marked line near the top of this file and of README.md's
-Loki 10 section; it changed in the same commit as the flip.
+`loki quick "<task>"`. 11.0.0 removed the engine switch: `loki legacy` exits
+2 with a removal message and LOKI_ENGINE is ignored. Remaining legacy paths
+(`loki start ./prd.md` and the no-bun fallback) are tracked in
+docs/v10/LEGACY-REMOVAL.md. The marked line near the top of this file and of
+README.md's Loki 10 section records the current state.
```

**File**: `tests/test-engine10-docs.sh` (modified, +1/-1)
```diff
@@ -120,7 +120,7 @@ fi
 
 echo
 echo "T5 -- the opt-in marker line matches bin/loki's current default"
-if grep -q '_loki_engine_default="v10"' "$BIN_LOKI" 2>/dev/null; then
+if grep -q -e '_loki_engine_default="v10"' -e '^case "v10" in' "$BIN_LOKI" 2>/dev/null; then
     flipped=1
 else
     flipped=0
```

---

### Incident Patch 8: `d5bf3fc0` (2026-10-04)
**Commit Message**: fix(action): drop the removed LOKI_ENGINE pin from the root action and its test (A6b follow-up)

Claude-Session: https://claude.ai/code/session_01GFNzL4TEfAXvX1KK5buE9w

**File**: `action.yml` (modified, +0/-3)
```diff
@@ -245,7 +245,6 @@ runs:
         LOKI_PROVIDER: ${{ inputs.provider }}
         LOKI_MAX_ITERATIONS: ${{ inputs.max_iterations }}
         LOKI_DASHBOARD: 'false'
-        LOKI_ENGINE: 'v10'
         LOKI_COMPLEXITY: 'simple'
         LOKI_BUDGET_LIMIT: ${{ inputs.budget || inputs.budget_limit }}
         LOKI_COUNCIL_ENABLED: 'false'
@@ -292,7 +291,6 @@ runs:
         LOKI_PROVIDER: ${{ inputs.provider }}
         LOKI_MAX_ITERATIONS: ${{ inputs.max_iterations }}
         LOKI_DASHBOARD: 'false'
-        LOKI_ENGINE: 'v10'
         LOKI_COMPLEXITY: 'simple'
         LOKI_BUDGET_LIMIT: ${{ inputs.budget || inputs.budget_limit }}
         LOKI_COUNCIL_ENABLED: 'false'
@@ -340,7 +338,6 @@ runs:
         LOKI_PROVIDER: ${{ inputs.provider }}
         LOKI_MAX_ITERATIONS: ${{ inputs.max_iterations }}
         LOKI_DASHBOARD: 'false'
-        LOKI_ENGINE: 'v10'
         LOKI_COMPLEXITY: 'simple'
         LOKI_BUDGET_LIMIT: ${{ inputs.budget || inputs.budget_limit }}
         LOKI_COUNCIL_ENABLED: 'false'
```

**File**: `tests/test-issue-to-pr-action.sh` (modified, +2/-2)
```diff
@@ -113,10 +113,10 @@ fi
 # 9. The published root action must run Loki 10, never the legacy --simple path.
 if ! grep -q -e '--simple' action.yml && ! grep -q -e '--budget' action.yml \
     && [ "$(grep -c 'loki start "[$]TASK"' action.yml)" -eq 3 ] \
-    && [ "$(grep -c "LOKI_ENGINE: 'v10'" action.yml)" -eq 3 ]; then
+    && ! grep -q LOKI_ENGINE action.yml; then
     pass "root action.yml routes all three modes to Loki 10 (no --simple, no --budget)"
 else
-    fail "root action.yml still calls the legacy --simple/--budget path or is not pinned to LOKI_ENGINE v10"
+    fail "root action.yml still calls the legacy --simple/--budget path or still sets the removed LOKI_ENGINE"
 fi
 
 echo "  $PASS passed, $FAIL failed"
```

---

### Incident Patch 9: `f26deef5` (2026-10-04)
**Commit Message**: fix(control-plane): route every verdict label through displayOutcome, dash for no-session stages, require ask-tools-server in prepublishOnly

Claude-Session: https://claude.ai/code/session_01GFNzL4TEfAXvX1KK5buE9w

**File**: `package.json` (modified, +1/-1)
```diff
@@ -125,7 +125,7 @@
   "scripts": {
     "postinstall": "node bin/loki-postinstall.js || exit 0",
     "prepack": "find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null; find . -name '*.pyc' -delete 2>/dev/null; if command -v bun >/dev/null 2>&1; then (cd loki-ts && bun install --production && bun run build) || echo 'WARN: loki-ts build failed, using existing dist if present'; else echo 'WARN: bun not on PATH, skipping loki-ts build (using committed dist if present)'; fi; find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null; find . -name '*.pyc' -delete 2>/dev/null; node tools/normalize-package-permissions.mjs .",
-    "prepublishOnly": "cd web-app && npm ci && npm run build && test -f dist/index.html && grep -q /lab/assets/ dist/index.html && cd ../packages/control-plane && bun install --frozen-lockfile && bun run build:all && test -f ui/dist/index.html && test -f dist/server.js",
+    "prepublishOnly": "cd web-app && npm ci && npm run build && test -f dist/index.html && grep -q /lab/assets/ dist/index.html && cd ../packages/control-plane && bun install --frozen-lockfile && bun run build:all && test -f ui/dist/index.html && test -f dist/server.js && test -f dist/ask-tools-server.js",
     "test": "bash -n autonomy/run.sh && bash -n autonomy/loki && bash -n autonomy/completion-council.sh && bash -n autonomy/app-runner.sh && bash -n autonomy/prd-checklist.sh && bash -n autonomy/playwright-verify.sh && node --test tests/protocols/*.test.js && node --test tests/protocols/a2a/*.test.js && node --test tests/observability/*.test.js && node --test tests/policies/*.test.js && node --test tests/audit/*.test.js && node --test tests/integrations/*.test.js && node --test tests/integrations/jira/*.test.js && node --test tests/integrations/github/*.test.js && node --test tests/integrations/slack/*.test.js && bash tests/managed_memory/test_flag_matrix.sh && bash tests/managed_memory/test_sdk_isolation.sh && bash tests/managed_memory/test_kill_switch.sh && python3 -m unittest tests.managed_memory.test_shadow_write_mock tests.managed_memory.test_retrieve_mock && echo 'All checks passed'",
     "test:integration": "bash tests/integration/run_integration_suite.sh"
   },
```

**File**: `packages/control-plane/ui/src/App.tsx` (modified, +2/-1)
```diff
@@ -7,6 +7,7 @@ import { wirePages } from "./pages/wired";
 import { CommandPalette } from "./palette";
 import { AppShell } from "./shell/AppShell";
 import { EmptyState, SettingsPage } from "./Shell";
+import { displayOutcome } from "./display";
 import { effectiveVerdict, FILTER_OPTIONS, VERDICT, type VerdictSource } from "./design/primitives";
 import { deleteRun, getRun, listRuns, postAnswer, type RunDetailResponse, type RunRow, type TimelineStage } from "./api";
 
@@ -106,7 +107,7 @@ export function RunsList({ onOpen }: { onOpen?: (r: RunRow) => void }) {
         <label className="flex flex-col gap-1">Verdict
           <select aria-label="Verdict" className={inp} value={verdict} onChange={(e) => setVerdict(e.target.value)}>
             <option value="">All</option>
-            {FILTER_OPTIONS.map((v) => <option key={v}>{v}</option>)}
+            {FILTER_OPTIONS.map((v) => <option key={v} value={v}>{displayOutcome(v).label}</option>)}
           </select>
         </label>
         <label className="flex flex-col gap-1">Repo
```

**File**: `packages/control-plane/ui/src/Live.tsx` (modified, +2/-1)
```diff
@@ -1,5 +1,6 @@
 // Live run view and Overview. Everything is derived from the runs API; a value the API does not carry shows "unmeasured".
 import { useEffect, useState, type ReactNode } from "react";
+import { displayOutcome } from "./display";
 import { fmtUsd } from "./format";
 import { effectiveVerdict, VERDICT } from "./design/primitives";
 import { getHealth, getRun, listRuns, type Health, type RunDetailResponse, type RunRow, type TimelineStage } from "./api";
@@ -100,7 +101,7 @@ export function LiveRun({ source, run }: { source: string; run: string }) {
       {!running && (
         <div data-testid="live-outcome" className={card}>
           <h2 className="mb-1 text-sm font-semibold uppercase text-slate-500">Outcome</h2>
-          <p className={`text-lg font-medium${data.tampered ? " text-red-600" : ""}`}>{effectiveVerdict(data) ?? UNMEASURED}</p>
+          <p className={`text-lg font-medium${data.tampered ? " text-red-600" : ""}`}>{displayOutcome(effectiveVerdict(data)).label}</p>
           <p className="mt-1 flex flex-wrap gap-4 text-sm">
             {pr ? <a data-testid="live-pr" href={pr} target="_blank" rel="noreferrer" className="text-sky-600 hover:underline dark:text-sky-400">Pull request</a> : <span data-testid="live-pr" className="text-slate-500">no PR</span>}
             {data.receipt ? <a data-testid="live-receipt" href={`#/runs/${encodeURIComponent(source)}/${encodeURIComponent(run)}`} className="text-sky-600 hover:underline dark:text-sky-400">Receipt{data.receipt.signed ? " (signed)" : " (unsigned)"}</a> : <span data-testid="live-receipt" className="text-slate-500">no receipt</span>}
```

**File**: `packages/control-plane/ui/src/Shell.tsx` (modified, +2/-1)
```diff
@@ -1,5 +1,6 @@
 // App shell pieces: empty-state import, and the Work, Cost and Settings pages.
 import { useEffect, useState } from "react";
+import { displayOutcome } from "./display";
 import { fmtUsd } from "./format";
 import { Button } from "./design/primitives";
 import { toggleTheme, useTheme } from "./shell/theme";
@@ -57,7 +58,7 @@ export function WorkPage() {
         {rows.map((r) => (
           <li key={`${r.source_id}/${r.run_id}`} data-testid="work-row" className="flex flex-wrap items-center gap-3 rounded border border-slate-200 p-3 dark:border-slate-800">
             <span className="font-mono">{r.issue_ref}</span>
-            <span className="text-slate-500">{effectiveVerdict(r) ?? "in progress"}</span>
+            <span className="text-slate-500">{displayOutcome(effectiveVerdict(r)).label}</span>
             {r.pr_url ? <a className="text-sky-600 hover:underline dark:text-sky-400" href={r.pr_url} target="_blank" rel="noreferrer">PR</a> : <span className="text-slate-500">no PR yet</span>}
           </li>
         ))}
```

**File**: `packages/control-plane/ui/src/design/primitives/index.tsx` (modified, +2/-1)
```diff
@@ -1,4 +1,5 @@
 // Control Plane design primitives (CPE-01). Every value is a --cp-* token from ../tokens.css.
+import { displayOutcome } from "../../display";
 import { useEffect, useId, useRef, useState } from "react";
 import { effectiveVerdict as integrityVerdict } from "../../api";
 import type { ButtonHTMLAttributes, CSSProperties, HTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
@@ -107,7 +108,7 @@ export function Badge({ tone = "neutral", pulse, children, ...rest }: HTMLAttrib
 export function VerdictBadge({ verdict, run, style }: { verdict?: string | null; run?: VerdictSource | null; style?: CSSProperties }) {
   const v = run ? effectiveVerdict(run) : verdict ?? null;
   if (!v) return <Badge pulse style={style}>running</Badge>;
-  return <Badge tone={VERDICT_TONE[v] ?? "neutral"} pulse={v === VERDICT.RUNNING} data-verdict={v} title={style ? v : undefined} style={style}>{v}</Badge>;
+  return <Badge tone={VERDICT_TONE[v] ?? "neutral"} pulse={v === VERDICT.RUNNING} data-verdict={v} title={style ? displayOutcome(v).label : undefined} style={style}>{displayOutcome(v).label}</Badge>;
 }
 
 /* Pill */
```

**File**: `packages/control-plane/ui/src/pages/plans/Plans.tsx` (modified, +2/-1)
```diff
@@ -2,6 +2,7 @@
 import { useEffect, useState } from "react";
 import { getRun, listRuns, type RunRow } from "../../api";
 import { Badge, Card, EmptyState, Spinner, Table, Timeline, VerdictBadge, type Tone } from "../../design/primitives";
+import { displayOutcome } from "../../display";
 import { loadPlan, type PlanData } from "./api";
 import type { RowStatus } from "./logic";
 
@@ -58,7 +59,7 @@ function MatrixView({ source, run }: { source: string; run: string }) {
         <div style={{ fontFamily: "var(--cp-font-mono)" }}>{run}</div>
         <div data-testid="plans-summary" style={{ color: "var(--cp-text-2)" }}>
           {matrix.rows.length ? `${proven} of ${matrix.rows.length} criteria proven` : "not measured: no criteria"}
-          {data.verdict ? ` - verdict ${data.verdict}` : have.receipt ? " - verdict unavailable" : " - no receipt"}
+          {data.verdict ? ` - verdict ${displayOutcome(data.verdict).label}` : have.receipt ? " - verdict unavailable" : " - no receipt"}
         </div>
         {missing.length ? <div data-testid="plans-missing" style={{ color: "var(--cp-text-2)" }}>not available: {missing.map((m) => `${m}.json`).join(", ")}</div> : null}
       </Card>
```

**File**: `packages/control-plane/ui/src/pages/run/index.tsx` (modified, +2/-2)
```diff
@@ -108,8 +108,8 @@ function Timeline({ events, awaiting }: { events: RunEvent[]; awaiting: boolean
             {isStage ? (
               <span className="cp-tl-meta">
                 <span data-testid="tl-duration">{typeof l.duration_s === "number" ? elapsedLabel(l.duration_s) : l.outcome === "running" ? "running" : UNMEASURED}</span>
-                <span data-testid="tl-model">{l.model ?? UNMEASURED}</span>
-                <span data-testid="tl-cost">{l.cost_usd === null ? UNMEASURED : fmtUsd(l.cost_usd)}</span>
+                <span data-testid="tl-model">{l.model ?? (l.cost_usd === "no-session" ? "-" : UNMEASURED)}</span>
+                <span data-testid="tl-cost">{l.cost_usd === "no-session" ? "-" : l.cost_usd === null ? UNMEASURED : fmtUsd(l.cost_usd)}</span>
               </span>
             ) : null}
           </li>
```

**File**: `packages/control-plane/ui/src/pages/run/timeline.ts` (modified, +4/-2)
```diff
@@ -9,7 +9,7 @@ export interface TimelineLine {
   label: string;
   duration_s: number | null;
   model: string | null;
-  cost_usd: number | null;
+  cost_usd: number | null | "no-session"; // "no-session": the stage ran no model session (verify, commit, seal)
   outcome: string;
   detail?: string;
 }
@@ -24,9 +24,11 @@ export function buildTimeline(events: RunEvent[]): TimelineLine[] {
   const open = new Map<string, TimelineLine & { startedMs: number | null }>();
   const costs = new Map<string, { usd: number; unmeasured: boolean; seen: boolean }>();
   const models = new Map<string, string>();
+  const sessions = new Set<string>();
   for (const e of events) {
     const d = obj(e.data);
     const st = e.stage ?? "";
+    if (e.type === "session.started" && st) sessions.add(st);
     if (e.type === "session.started" && st && str(d.model)) models.set(st, str(d.model)!);
     if (e.type === "cost" && st) {
       const c = costs.get(st) ?? { usd: 0, unmeasured: false, seen: false };
@@ -37,7 +39,7 @@ export function buildTimeline(events: RunEvent[]): TimelineLine[] {
       if (str(d.model) && !models.has(st)) models.set(st, str(d.model)!);
     }
   }
-  const costOf = (st: string): number | null => { const c = costs.get(st); return c && c.seen && !c.unmeasured ? c.usd : null; };
+  const costOf = (st: string): number | null | "no-session" => { const c = costs.get(st); if (!c && !sessions.has(st) && !models.has(st)) return "no-session"; return c && c.seen && !c.unmeasured ? c.usd : null; };
   for (const e of events) {
     const d = obj(e.data);
     if (e.type === "run.started") {
```

---

### Incident Patch 10: `dd61901d` (2026-10-04)
**Commit Message**: fix(security): baseline 6 reviewed gitleaks false positives from the 10.11.2 full-history scan

Security Audit run 37168919918 on 962efc4b2 reported 6 findings, all reviewed:
integrity.ts:55 default PEM path (3 commits), CONFIG-FILE-PLAN.md:362 config
key prose, and the deleted dashboard-ui maskToken fixture (sk_live_ plus the
sequential alphabet, synthetic). Exact commit-qualified fingerprints only; no
path or rule suppression. Baseline comment updated to 47 commit-qualified.
test-security-audit-config.sh 67/0.

Claude-Session: https://claude.ai/code/session_01GFNzL4TEfAXvX1KK5buE9w

**File**: `.github/workflows/security-audit.yml` (modified, +1/-1)
```diff
@@ -366,7 +366,7 @@ jobs:
 
       - name: gitleaks scan (all reachable history)
         # POSTURE: NEW FINDINGS BLOCK. The reviewed baseline contains 35
-        # current-tree fingerprints and nine commit-qualified historical
+        # current-tree fingerprints and 47 commit-qualified historical
         # fingerprints. There are no blanket path or rule suppressions, so a
         # similar finding in any other commit returns the scanner's default
         # nonzero exit and blocks this workflow and the release gate.
```

**File**: `.gitleaksignore` (modified, +10/-0)
```diff
@@ -119,3 +119,13 @@ c09dfd1eb6f2f2cc1f81b2be0d7ddee717141d66:tests/workspace/80-comment.sh:github-pa
 # CPE-POLISH integrity.ts: generic-api-key matched env["LOKI_RECEIPT_SIGNING_KEY"] / _FILE env-var name lookups (public key derivation); no key material in source.
 449db8f56fce87ef05510b5ae8634ce6438a696d:packages/control-plane/src/server/integrity.ts:generic-api-key:46
 b4775bede0a04a021c89e366500ecae8ce1ae609:packages/control-plane/src/server/integrity.ts:generic-api-key:55
+# 10.11.2 full-history scan (Security Audit run 37168919918), reviewed 2026-10-04:
+# integrity.ts:55 is the default public PEM path join(..., ".loki", "keys", "receipt-ed25519.pem"), a file path, not key material.
+0eea5800ee41e01360207eb12c7fb9b7808eb62b:packages/control-plane/src/server/integrity.ts:generic-api-key:55
+39ea73011a04ddd3178b800198e6f25e90186dc7:packages/control-plane/src/server/integrity.ts:generic-api-key:55
+b5b1c30009d7a19ad37ae2856bacd93179a5f194:packages/control-plane/src/server/integrity.ts:generic-api-key:55
+# CONFIG-FILE-PLAN.md:362 is doc prose naming a config key, not a credential.
+acb76a1913ee5bb0f725832db3f192ea52a1ddb2:docs/CONFIG-FILE-PLAN.md:generic-api-key:362
+# Deleted legacy dashboard-ui maskToken test fixture: sk_live_ followed by the sequential alphabet (16 chars), a synthetic value, never a real Stripe key.
+f1aac14d33fe4bef7622848b24bb721e4800ad1d:dashboard-ui/tests/ui-components.test.js:stripe-access-token:322
+dcca5ebb5ca767b4b1358c66fc7d5d724f82251b:dashboard-ui/tests/ui-components.test.js:stripe-access-token:322
```

---

### Incident Patch 11: `1e99d77f` (2026-10-04)
**Commit Message**: fix(ci): CP-04 Dockerfile COPY for graph/scope/check_result/safe_git and DEP-01 rows for monorepo-fc22 fixtures

test-control-plane.sh 25/0, test-dep-inventory.sh 6/0 (Tests run 37168233419 reds).

Claude-Session: https://claude.ai/code/session_01GFNzL4TEfAXvX1KK5buE9w

**File**: `Dockerfile.control-plane` (modified, +2/-2)
```diff
@@ -21,8 +21,8 @@ COPY loki-ts/src/engine10/keys_cmd.ts loki-ts/src/engine10/testmap.ts loki-ts/sr
 COPY loki-ts/src/engine10/stages/seal.ts /src/loki-ts/src/engine10/stages/
 COPY loki-ts/src/features/contract.ts loki-ts/src/features/receipt_dsse.ts loki-ts/src/features/visual_evidence.ts /src/loki-ts/src/features/
 COPY loki-ts/src/features/speed/seal_group.ts loki-ts/src/features/speed/unit_mode.ts /src/loki-ts/src/features/speed/
-COPY loki-ts/src/util/paths.ts loki-ts/src/util/receipt_signer.ts loki-ts/src/util/run_pid.ts loki-ts/src/util/shell.ts /src/loki-ts/src/util/
-COPY loki-ts/src/project_model/api.ts loki-ts/src/project_model/discover.ts loki-ts/src/project_model/gather.ts loki-ts/src/project_model/resolve.ts loki-ts/src/project_model/schema.ts /src/loki-ts/src/project_model/
+COPY loki-ts/src/util/check_result.ts loki-ts/src/util/paths.ts loki-ts/src/util/receipt_signer.ts loki-ts/src/util/run_pid.ts loki-ts/src/util/safe_git.ts loki-ts/src/util/shell.ts /src/loki-ts/src/util/
+COPY loki-ts/src/project_model/api.ts loki-ts/src/project_model/discover.ts loki-ts/src/project_model/gather.ts loki-ts/src/project_model/graph.ts loki-ts/src/project_model/resolve.ts loki-ts/src/project_model/schema.ts loki-ts/src/project_model/scope.ts /src/loki-ts/src/project_model/
 # routes/config.ts imports schemas/loki-yaml.schema.json (resolves to /src/schemas).
 COPY schemas/ /src/schemas/
 RUN bun run build:all
```

**File**: `docs/v10/DEPS.md` (modified, +3/-0)
```diff
@@ -16,6 +16,7 @@ Inventory only. No dependency, lockfile, workflow or image was changed to produc
 | `loki-ts/tests/engine10/fixtures/testmap/package.json` | `vitest` | `^2.0.0` | `5.0.3` | MAJOR | test fixture, not a real dependency |
 | `loki-ts/tests/fixtures/monorepo-fc01/backend/package.json` | `vitest` | `^1.0.0` | `5.0.3` | MAJOR | test fixture, not a real dependency |
 | `loki-ts/tests/fixtures/project-model/firelater-17/backend/package.json` | `vitest` | `^1.0.0` | `5.0.3` | MAJOR | test fixture, not a real dependency |
+| `loki-ts/tests/fixtures/monorepo-fc22/backend/package.json` | `vitest` | `^1.0.0` | `5.0.3` | MAJOR | test fixture, not a real dependency |
 | `package.json` | `@resvg/resvg-wasm` | `^2.6.2` | `2.6.2` | up-to-date |  |
 | `package.json` | `@types/node` | `^25.2.0` | `26.6.4` | MAJOR |  |
 | `package.json` | `jest` | `^29.7.0` | `30.5.2` | MAJOR |  |
@@ -75,6 +76,8 @@ Inventory only. No dependency, lockfile, workflow or image was changed to produc
 | `web-app/package.json` | `vite` | `^6.2.0` | `8.3.2` | MAJOR |  |
 | `loki-ts/tests/fixtures/monorepo-fc01/frontend/package.json` | `(none found)` | `` | `-` | n/a | test fixture; no dependencies or devDependencies declared |
 | `loki-ts/tests/fixtures/project-model/firelater-17/frontend/package.json` | `(none found)` | `` | `-` | n/a | test fixture; no dependencies or devDependencies declared |
+| `loki-ts/tests/fixtures/monorepo-fc22/package.json` | `(none found)` | `` | `-` | n/a | test fixture; no dependencies or devDependencies declared |
+| `loki-ts/tests/fixtures/monorepo-fc22/frontend/package.json` | `(none found)` | `` | `-` | n/a | test fixture; no dependencies or devDependencies declared |
 
 ## Python (requirements*.txt)
 
```

---

### Incident Patch 12: `87f2d31c` (2026-10-04)
**Commit Message**: feat(cp-ui): A4a information architecture, nav-only sidebar, Overview, grouped Runs, New run picker, Ask Loki

Sidebar is navigation only (Overview, Runs, Pull requests, Repos, Receipts, Settings) plus Ask history. Overview has 4 KPI tiles, a NEEDS YOU inbox and Latest by issue. Runs is a table grouped by issue with expandable attempts and outcome/repo filters. The home composer is removed; New run is a registered-repo then issue picker with an explicit confirm, and free text never starts a run. Ask Loki page streams answers over SSE with follow-ups; an offer button only opens the confirm dialog. Cmd+K opens Ask when enabled.

Claude-Session: https://claude.ai/code/session_01GFNzL4TEfAXvX1KK5buE9w

**File**: `packages/control-plane/test/ui/cards.test.tsx` (removed, +0/-119)
```diff
@@ -1,119 +0,0 @@
-// Session card grid: outcome lines from real fields, NEEDS INPUT with an inline answer, Recent and Groups tabs, search, filter, "unmeasured" for gaps.
-import "./dom";
-import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
-import { readFileSync } from "node:fs";
-import { join } from "node:path";
-
-const realFetch = globalThis.fetch;
-const { cleanup, fireEvent, render, screen, waitFor, within } = await import("@testing-library/react");
-const { CardsView } = await import("../../ui/src/pages/home/Cards");
-const { outcome, timeAgo, matches, groupByRepo } = await import("../../ui/src/pages/home/cardtext");
-
-const base = JSON.parse(readFileSync(join(import.meta.dir, "fixtures/runs.json"), "utf8")).runs[0] as Record<string, unknown>;
-const NOW = Date.now();
-const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();
-const run = (id: string, extra: Record<string, unknown> = {}) =>
-  ({ ...base, run_id: id, title: `title ${id}`, started_at: iso(60_000), last_event_at: iso(60_000), origin_repo: "acme/calc", verdict: "VERIFIED", attested: true, sig_checked: true, tampered: false, pr_url: null, files_touched: ["a.ts", "b.ts"], cost_usd: 0.5, wall_s: 90, ...extra }) as never;
-
-let answers: { url: string; body: unknown }[] = [];
-beforeAll(() => {
-  (globalThis as { LOKI_CONTROL_BASE?: string }).LOKI_CONTROL_BASE = "";
-  globalThis.fetch = (async (url: string, init?: RequestInit) => {
-    const u = String(url);
-    if (init?.method === "POST") { answers.push({ url: u, body: JSON.parse(String(init.body)) }); return new Response(JSON.stringify({ path: "p", resume: "r" })); }
-    if (u.endsWith("/blk")) return new Response(JSON.stringify({ blocked_question: "Which database?" }));
-    return new Response("nope", { status: 404 });
-  }) as unknown as typeof fetch;
-});
-afterEach(() => { cleanup(); answers = []; });
-afterAll(() => { globalThis.fetch = realFetch; });
-
-test("outcome lines are plain English from real fields and read unmeasured for gaps", () => {
-  expect(outcome(run("a"))[0]).toBe("Done: the change was verified.");
-  expect(outcome(run("a"))[1]).toBe("2 files touched, $0.50, 1m 30s");
-  const gap = outcome(run("g", { files_touched: undefined, cost_usd: null, partial_usd: null, wall_s: null }));
-  expect(gap[1]).toBe("files unmeasured, cost unmeasured, unmeasured");
-  expect(outcome(run("e", { files_touched: [] }))[1]).toStartWith("files unmeasured");
-  expect(outcome(run("f", { verdict: "FAILED" }))[0]).toStartWith("Failed:");
-  expect(outcome(run("b"), "Which database?")[0]).toBe("Blocked: needs answer. Which database?");
-  expect(outcome(run("b"), null)[0]).toContain("question unmeasured");
-  expect(outcome(run("r", { verdict: null, current_stage: null, elapsed_s: null }))[0]).toBe("Running: stage unmeasured");
-  expect(timeAgo(null, NOW)).toBe("time unmeasured");
-  expect(timeAgo(iso(3 * 3_600_000), NOW)).toBe("3h ago");
-});
-
-test("card shows title, outcome, verdict, PR and receipt badges, repo and time-ago", () => {
-  render(<CardsView runs={[run("one", { pr_url: "https://github.com/o/r/pull/1", pr_draft: true })]} blocked={[]} now={NOW} />);
-  const c = screen.getByTestId("session-card");
-  expect(within(c).getByTestId("card-title").textContent).toBe("title one");
-  expect(within(c).getByTestId("card-outcome").textContent).toContain("Done: the change was verified.");
-  expect(c.textContent).toContain("VERIFIED");
-  expect(within(c).getByTestId("badge-pr").textContent).toBe("Draft PR");
-  expect(within(c).getByTestId("badge-receipt").textContent).toBe("Receipt signed");
-  expect(c.textContent).toContain("acme/calc");
-  expect(c.textContent).toContain("1m ago");
-  expect(c.getAttribute("href")).toContain("#/runs/");
-});
-
-test("a finished run without attestation data reads receipt unmeasured, no PR badge without a PR", () => {
-  render(<CardsView runs={[run("x", { attested: undefined, origin_repo: null })]} blocked={[]} now={NOW} />);
-  expect(screen.getByTestId("badge-receipt").textContent).toBe("receipt unmeasured");
-  expect(screen.queryByTestId("badge-pr")).toBeNull();
-  expect(screen.getByTestId("session-card").textContent).toContain("repo unmeasured");
-});
-
-test("NEEDS INPUT pins blocked runs and answers inline through the answer route", async () => {
-  const blocked = [{ id: "n", kind: "blocked", ts: "", source_id: base.source_id as string, run_id: "blk", title: "t", link: "" }];
-  render(<CardsView runs={[run("blk", { verdict: "SPEC_CONFLICT" }), run("ok")]} blocked={blocked} now={NOW} />);
-  const section = screen.getByTestId("needs-input");
-  expect(section.textContent).toContain("NEEDS INPUT (1)");
-  await waitFor(() => expect(within(section).getByTestId("card-outcome").textContent).toContain("Which database?"));
-  expect(screen.getAllByTestId("session-card").length).toBe(2); // blocked card is pinned, not repeated in the grid
-  fireEvent.input(within(section).getByTestId("answer-input"), {
```

**File**: `packages/control-plane/test/ui/compose.test.tsx` (removed, +0/-170)
```diff
@@ -1,170 +0,0 @@
-// CPE-08: the new run composer. Request bodies per chip, Cmd+Enter, error wording, and no invented fields.
-import "./dom";
-import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from "bun:test";
-
-const realFetch = globalThis.fetch;
-const { cleanup, fireEvent, render, screen, waitFor } = await import("@testing-library/react");
-const { Composer, buildBody, normalizeTarget, page } = await import("../../ui/src/pages/compose");
-
-type Call = { url: string; method: string; body: Record<string, unknown> | null };
-let calls: Call[] = [];
-let post: () => Promise<Response> = async () => new Response(JSON.stringify({ ok: true, pid: 1, command: "start x" }));
-let repos: string[] = ["alpha", "beta"];
-
-beforeAll(() => { (globalThis as { LOKI_CONTROL_BASE?: string }).LOKI_CONTROL_BASE = ""; });
-beforeEach(() => {
-  calls = []; location.hash = ""; repos = ["alpha", "beta"];
-  post = async () => new Response(JSON.stringify({ ok: true, pid: 1, command: "start x" }));
-  globalThis.fetch = (async (url: string, init?: RequestInit) => {
-    const method = init?.method ?? "GET";
-    if (method === "POST") { calls.push({ url: String(url), method, body: JSON.parse(String(init?.body)) }); return post(); }
-    if (String(url).startsWith("/v1/repos")) return new Response(JSON.stringify({ repos }));
-    return new Response("nope", { status: 404 });
-  }) as unknown as typeof fetch;
-});
-afterEach(cleanup);
-afterAll(() => { globalThis.fetch = realFetch; location.hash = ""; });
-
-const type = (v: string) => fireEvent.input(screen.getByTestId("composer-input"), { target: { value: v } });
-const pick = async (chip: string, label: string) => {
-  fireEvent.click(screen.getByTestId(chip).querySelector("button")!);
-  fireEvent.click(await screen.findByRole("menuitem", { name: label }));
-};
-
-test("page export targets the New run route", () => {
-  expect(page.path).toBe("/new");
-  expect(page.component).toBe(Composer);
-});
-
-test("empty state shows before any input, and the repo chip lists GET /v1/repos", async () => {
-  render(<Composer />);
-  expect(screen.getByText("What should Loki build?")).toBeTruthy();
-  await screen.findByTestId("chip-repo");
-  await waitFor(() => {
-    fireEvent.click(screen.getByTestId("chip-repo").querySelector("button")!);
-    expect(screen.getAllByRole("menuitem").map((m) => m.textContent)).toEqual(["server directory", "alpha", "beta"]);
-  });
-  type("fix the bug");
-  expect(screen.queryByText("What should Loki build?")).toBeNull();
-});
-
-test("no repos discovered reads as such", async () => {
-  repos = [];
-  render(<Composer />);
-  expect(await screen.findByTestId("no-repos")).toBeTruthy();
-});
-
-test("a bare task sends only target", async () => {
-  render(<Composer />);
-  type("add a health endpoint");
-  fireEvent.click(screen.getByTestId("composer-submit"));
-  await waitFor(() => expect(calls.length).toBe(1));
-  expect(calls[0]!.url).toBe("/v1/runs");
-  expect(calls[0]!.body).toEqual({ target: "add a health endpoint" });
-});
-
-test("each chip adds exactly its own field", async () => {
-  const cases: Array<[string, string, Record<string, string>]> = [
-    ["chip-repo", "beta", { repo: "beta" }],
-    ["chip-model", "sonnet", { model: "sonnet" }],
-    ["chip-provider", "codex", { provider: "codex" }],
-    ["chip-budget", "$10", { budget: "10" }],
-  ];
-  for (const [chip, label, extra] of cases) {
-    calls = []; cleanup(); location.hash = "";
-    render(<Composer />);
-    type("o/r#5");
-    if (chip === "chip-repo") await waitFor(() => { fireEvent.click(screen.getByTestId(chip).querySelector("button")!); expect(screen.getAllByRole("menuitem").length).toBe(3); fireEvent.click(screen.getByTestId(chip).querySelector("button")!); });
-    await pick(chip, label);
-    fireEvent.click(screen.getByTestId("composer-submit"));
-    await waitFor(() => expect(calls.length).toBe(1));
-    expect(calls[0]!.body).toEqual({ target: "o/r#5", ...extra });
-  }
-});
-
-test("workspace chip sends workspace and drops provider and budget", async () => {
-  render(<Composer />);
-  type("o/r#5");
-  await pick("chip-provider", "claude");
-  await pick("chip-budget", "$5");
-  fireEvent.click(screen.getByTestId("chip-workspace"));
-  fireEvent.input(await screen.findByTestId("workspace-input"), { target: { value: "platform" } });
-  fireEvent.click(screen.getByTestId("composer-submit"));
-  await waitFor(() => expect(calls.length).toBe(1));
-  expect(calls[0]!.body).toEqual({ target: "o/r#5", workspace: "platform" });
-});
-
-test("a GitHub issue URL is sent as owner/repo#N; a PRD path is sent as typed", () => {
-  expect(normalizeTarget("https://github.com/acme/web/issues/42")).toBe("acme/web#42");
-  expect(normalizeTarget("  docs/prd.md ")).toBe("docs/prd.md");
-  expect(buildBody("docs/prd.md", {})).toEqual({ target: "docs/prd.md" });
-});
-
-test("Cmd+Enter submits, navigates to the run list, and shows an optimistic row meanwhile", a
```

**File**: `packages/control-plane/test/ui/followups.test.tsx` (modified, +0/-21)
```diff
@@ -5,9 +5,7 @@ import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
 const realFetch = globalThis.fetch;
 const { cleanup, fireEvent, render, screen, waitFor } = await import("@testing-library/react");
 const { RunThread } = await import("../../ui/src/pages/run");
-const { Composer } = await import("../../ui/src/pages/compose");
 const { whyLine, receiptFacts, changedFilesFor } = await import("../../ui/src/pages/run/model");
-const { outcome } = await import("../../ui/src/pages/home/cardtext");
 
 const STAT = { base: "b".repeat(40), head: "a".repeat(40), files: [{ path: "src/x.ts", added: 5, removed: 2 }, { path: "logo.png", added: null, removed: null }], added: 5, removed: 2 };
 const detail = (o: Record<string, unknown> = {}) => ({
@@ -56,12 +54,6 @@ test("1: with no patch and no range the section still says unmeasured", async ()
   await waitFor(() => expect(screen.getByTestId("changed-files-unmeasured").textContent).toContain("unmeasured"));
 });
 
-test("1: the home card counts files from diff_stat", () => {
-  const row = { source_id: "s", run_id: "r", verdict: "VERIFIED", attested: true, sig_checked: true, tampered: false, files_touched: [], diff_stat: STAT, cost_usd: 1, wall_s: 5 } as never;
-  expect(outcome(row)[1]).toStartWith("2 files touched, +5 -2");
-  expect(outcome({ ...(row as object), diff_stat: null } as never)[1]).toStartWith("files unmeasured");
-});
-
 test("2: a non-VERIFIED run states why from real events; a VERIFIED run has no Why line", async () => {
   serve(detail());
   render(<RunThread source="s1" run="r1" />);
@@ -123,16 +115,3 @@ test("4: NOT PROVEN and the pull request sit in the right column, above the term
   const panel = screen.getByTestId("run-panel");
   expect(screen.getByTestId("run-summary").compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
 });
-
-test("5: the composer repo chip shows the server directory folder name and keeps the picker", async () => {
-  serve(detail());
-  render(<Composer />);
-  await waitFor(() => expect(screen.getByTestId("chip-repo").textContent).toContain("lokimode-anthropic"));
-  fireEvent.click(screen.getByTestId("chip-repo").querySelector("button")!);
-  expect((await screen.findAllByRole("menuitem")).map((m) => m.textContent)).toEqual(["lokimode-anthropic (server directory)", "alpha"]);
-  cleanup();
-  serve(detail(), [], { repos: [] });
-  render(<Composer />);
-  await waitFor(() => expect(screen.getByTestId("no-repos")).toBeTruthy());
-  expect(screen.getByTestId("chip-repo").textContent).toContain("server directory");
-});
```

**File**: `packages/control-plane/test/ui/hero.test.tsx` (removed, +0/-54)
```diff
@@ -1,54 +0,0 @@
-// Composer-first home: the hero input, pickers wired only to real API options, and the start call.
-import "./dom";
-import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
-
-const realFetch = globalThis.fetch;
-const { cleanup, fireEvent, render, screen, waitFor } = await import("@testing-library/react");
-const { Hero } = await import("../../ui/src/pages/home/Hero");
-
-let posted: { url: string; body: Record<string, unknown> }[] = [];
-beforeAll(() => {
-  (globalThis as { LOKI_CONTROL_BASE?: string }).LOKI_CONTROL_BASE = "";
-  globalThis.fetch = (async (url: string, init?: RequestInit) => {
-    const u = String(url);
-    if (u.startsWith("/v1/repos")) return new Response(JSON.stringify({ repos: ["alpha", "beta"] }));
-    if (init?.method === "POST") { posted.push({ url: u, body: JSON.parse(String(init.body)) }); return new Response(JSON.stringify({ ok: true, pid: 1, command: "loki start" })); }
-    return new Response("nope", { status: 404 });
-  }) as unknown as typeof fetch;
-});
-afterEach(() => { cleanup(); posted = []; });
-afterAll(() => { globalThis.fetch = realFetch; });
-
-test("hero asks What should Loki build and offers no Plan/Build toggle or branch picker", () => {
-  render(<Hero />);
-  expect(screen.getByText("What should Loki build?")).toBeTruthy();
-  expect(screen.queryByText(/^plan$/i)).toBeNull();
-  expect(screen.queryByText(/branch/i)).toBeNull();
-  expect((screen.getByTestId("hero-start") as HTMLButtonElement).disabled).toBe(true);
-});
-
-test("an issue URL is normalized and posted with the picked repo and harness", async () => {
-  render(<Hero />);
-  fireEvent.input(screen.getByTestId("hero-input"), { target: { value: "https://github.com/o/r/issues/7" } });
-  await waitFor(() => expect(screen.getByTestId("pick-repo")).toBeTruthy());
-  fireEvent.click(screen.getByTestId("pick-repo").querySelector("button")!);
-  fireEvent.click(await screen.findByText("beta"));
-  fireEvent.click(screen.getByTestId("pick-provider").querySelector("button")!);
-  fireEvent.click(await screen.findByText("codex"));
-  fireEvent.click(screen.getByTestId("pick-model").querySelector("button")!);
-  fireEvent.click(await screen.findByText("haiku"));
-  fireEvent.click(screen.getByTestId("hero-start"));
-  await waitFor(() => expect(posted.length).toBe(1));
-  expect(posted[0]!.url).toBe("/v1/runs");
-  expect(posted[0]!.body).toEqual({ target: "o/r#7", repo: "beta", provider: "codex", model: "haiku" });
-  expect((await screen.findByTestId("hero-note")).textContent).toContain("o/r#7");
-  expect((screen.getByTestId("hero-input") as HTMLTextAreaElement).value).toBe("");
-});
-
-test("Enter starts a plain task", async () => {
-  render(<Hero />);
-  fireEvent.input(screen.getByTestId("hero-input"), { target: { value: "add a health endpoint" } });
-  fireEvent.keyDown(screen.getByTestId("hero-input"), { key: "Enter" });
-  await waitFor(() => expect(posted.length).toBe(1));
-  expect(posted[0]!.body).toEqual({ target: "add a health endpoint" });
-});
```

**File**: `packages/control-plane/test/ui/home.test.tsx` (removed, +0/-112)
```diff
@@ -1,112 +0,0 @@
-// CPE-12: Home renders the tiles, recent runs and BLOCKED inbox from the stats, runs and notifications APIs; unmeasured values read "not measured".
-import "./dom";
-import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
-
-const realFetch = globalThis.fetch;
-const { cleanup, render, screen } = await import("@testing-library/react");
-const { Home, HomeView, costTile } = await import("../../ui/src/pages/home/Home");
-const { page } = await import("../../ui/src/pages/home/index");
-
-const NOW = Date.parse("2026-10-03T12:00:00Z");
-const stats = (o: Record<string, unknown>) => ({
-  since: null, runs_total: 0, runs_finished: 0, runs_running: 0, by_verdict: {}, blocked_waiting: 0, verified_rate: null,
-  cost: { measured_usd: null, measured_runs: 0, partial_usd: null, partial_runs: 0, label: "not measured" }, receipts: { total: 0, signed: 0 }, ...o,
-});
-const run = (o: Record<string, unknown>) => ({
-  source_id: "s1", run_id: "r1", origin_repo: null, issue_ref: null, model: "sonnet", verdict: null, cost_usd: null, partial_usd: 0, ...o,
-});
-
-function serve(opts: { today: unknown; week: unknown; runs: unknown[]; blocked: unknown[] }) {
-  const urls: string[] = [];
-  globalThis.fetch = (async (url: string) => {
-    urls.push(String(url));
-    const u = new URL(String(url), "http://x");
-    if (u.pathname === "/v1/stats") return new Response(JSON.stringify(Date.parse(u.searchParams.get("since")!) > NOW - 2 * 86_400_000 ? opts.today : opts.week));
-    if (u.pathname === "/v1/runs") return new Response(JSON.stringify({ runs: opts.runs, total: opts.runs.length, next_cursor: null }));
-    if (u.pathname === "/v1/notifications") return new Response(JSON.stringify({ notifications: opts.blocked, total: opts.blocked.length, next_cursor: null }));
-    return new Response("nope", { status: 404 });
-  }) as unknown as typeof fetch;
-  return urls;
-}
-
-beforeAll(() => { (globalThis as { LOKI_CONTROL_BASE?: string }).LOKI_CONTROL_BASE = ""; });
-afterEach(cleanup);
-afterAll(() => { globalThis.fetch = realFetch; });
-
-test("page export carries the registry fields", () => {
-  expect(page.id).toBe("home");
-  expect(typeof page.component).toBe("function");
-});
-
-test("tiles show the stats numbers, blocked inbox and recent runs link to their run", async () => {
-  const urls = serve({
-    today: stats({ runs_total: 3, runs_running: 1 }),
-    week: stats({ runs_total: 8, runs_finished: 8, by_verdict: { VERIFIED: 4 }, verified_rate: 0.5, breakdown: { verified: 4, failed: 4, already_satisfied: 0, other: 0 }, cost: { measured_usd: 1.5, measured_runs: 7, partial_usd: 0.25, partial_runs: 1, label: "partial" } }),
-    runs: [run({ run_id: "a", verdict: "VERIFIED", cost_usd: 0.1234, origin_repo: "o/r" }), run({ run_id: "b", verdict: null }), run({ run_id: "c", verdict: "FAILED", partial_usd: 0.5 })],
-    blocked: [{ id: "blocked:s1:z", kind: "blocked", ts: "t", source_id: "s1", run_id: "z", title: "Blocked, waiting for your answer: o/r", link: "/runs/s1/z" }],
-  });
-  render(<Home now={NOW} />);
-  await screen.findByTestId("home");
-  expect(urls.some((u) => u.startsWith("/v1/notifications?kind=blocked"))).toBe(true);
-  expect(screen.getByTestId("kpi-today").textContent).toContain("3");
-  expect(screen.getByTestId("kpi-today").textContent).toContain("1 running");
-  expect(screen.getByTestId("kpi-verified").textContent).toContain("50%");
-  expect(screen.getByTestId("kpi-verified").textContent).toContain("4 verified, 4 failed, 0 already satisfied, 0 other");
-  expect(screen.getByTestId("kpi-cost").textContent).toContain("$1.75+");
-  expect(screen.getByTestId("kpi-cost").textContent).toContain("partial, 1 run unpriced");
-  expect(screen.getByTestId("kpi-blocked").textContent).toContain("1");
-  expect(screen.getByTestId("blocked-item").getAttribute("href")).toBe("/r/s1/z");
-  const links = screen.getAllByTestId("recent-run");
-  expect(links.map((l) => l.getAttribute("href"))).toEqual(["/r/s1/a", "/r/s1/b", "/r/s1/c"]);
-  const text = screen.getByTestId("recent-runs").textContent!;
-  expect(text).toContain("$0.12");
-  expect(text).toContain("at least $0.50");
-  expect(text).toContain("not measured");
-});
-
-test("nothing measured reads not measured, never a zero", () => {
-  expect(costTile(stats({}).cost as never)).toEqual({ value: "not measured", trend: "no priced runs" });
-  render(<HomeView data={{ today: stats({ runs_total: 1 }) as never, week: stats({ runs_total: 1, runs_running: 1 }) as never, runs: [run({}) as never], blocked: [], blockedTotal: 0 }} />);
-  expect(screen.getByTestId("kpi-verified").textContent).toContain("--");
-  expect(screen.getByTestId("kpi-cost").textContent).toContain("not measured");
-  expect(screen.getByTestId("blocked-empty").textContent).toContain("Nothing is waiting");
-});
-
-test("fully measured cost has no plus sign; an empty store shows the empty state", async () => {
-  expect(costTile({ measured_usd: 2, measured_runs: 
```

**File**: `packages/control-plane/test/ui/ia-newrun-ask.test.tsx` (added, +128/-0)
```diff
@@ -0,0 +1,128 @@
+// A4a: New run picker (registered repos, real issues, explicit confirm) and Ask Loki (stream, follow-ups, offers).
+import "./dom";
+import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from "bun:test";
+
+const realFetch = globalThis.fetch;
+const { cleanup, fireEvent, render, screen, waitFor, within } = await import("@testing-library/react");
+const { NewRunPicker } = await import("../../ui/src/pages/compose");
+const { closeNewRun, getNewRun } = await import("../../ui/src/pages/compose/store");
+const ask = await import("../../ui/src/pages/ask/api");
+const { AskThreadView, Offers } = await import("../../ui/src/pages/ask");
+
+interface Call { url: string; method: string; body: string | null }
+let calls: Call[] = [];
+function serve(routes: Record<string, (init?: RequestInit) => Response>) {
+  calls = [];
+  globalThis.fetch = (async (url: string, init?: RequestInit) => {
+    const u = String(url);
+    calls.push({ url: u, method: init?.method ?? "GET", body: typeof init?.body === "string" ? init.body : null });
+    const key = Object.keys(routes).find((k) => u.split("?")[0] === k);
+    return key ? routes[key]!(init) : new Response(JSON.stringify({ error: "nope" }), { status: 404 });
+  }) as unknown as typeof fetch;
+}
+const json = (b: unknown, status = 200) => () => new Response(JSON.stringify(b), { status });
+const pick = (el: HTMLElement, v: string) => { fireEvent.input(el, { target: { value: v } }); };
+const posts = () => calls.filter((c) => c.method === "POST");
+
+beforeAll(() => { (globalThis as { LOKI_CONTROL_BASE?: string }).LOKI_CONTROL_BASE = ""; });
+beforeEach(() => { location.hash = ""; closeNewRun(); ask.resetAskState(); });
+afterEach(cleanup);
+afterAll(() => { globalThis.fetch = realFetch; location.hash = ""; });
+
+const ISSUES = { issues: [{ number: 7, title: "Crash on save", url: "https://github.com/o/alpha/issues/7" }, { number: 8, title: "Slow list", url: "https://github.com/o/alpha/issues/8" }] };
+
+test("picker: registered repos only, real issues, nothing posts until the explicit confirm", async () => {
+  serve({ "/v1/repos": json({ repos: ["alpha", "beta"] }), "/v1/repos/issues": json(ISSUES), "/v1/runs": json({ ok: true, pid: 1, command: "x" }) });
+  render(<NewRunPicker preset={null} onDone={() => {}} />);
+  const sel = await screen.findByTestId("picker-repo");
+  expect(within(sel).getAllByRole("option").map((o) => o.textContent)).toEqual(["Choose a registered repo", "alpha", "beta"]);
+  pick(sel, "alpha");
+  const opts = await screen.findAllByTestId("issue-option");
+  expect(opts.length).toBe(2);
+  expect(calls.some((c) => c.url.includes("/v1/repos/issues?repo=alpha"))).toBe(true);
+  fireEvent.click(opts[0]!);
+  fireEvent.click(screen.getByTestId("picker-continue"));
+  expect(screen.getByTestId("confirm-text").textContent).toContain("o/alpha#7");
+  expect(posts().length).toBe(0);
+  fireEvent.click(screen.getByTestId("confirm-start"));
+  await waitFor(() => expect(posts().length).toBe(1));
+  expect(JSON.parse(posts()[0]!.body!)).toEqual({ target: "o/alpha#7", repo: "alpha" });
+});
+
+test("picker: free text never starts a run; Review only moves to the confirm step", async () => {
+  serve({ "/v1/repos": json({ repos: ["alpha"] }), "/v1/repos/issues": json({ issues: [] }), "/v1/runs": json({ ok: true, pid: 1, command: "x" }) });
+  render(<NewRunPicker preset={null} onDone={() => {}} />);
+  pick(await screen.findByTestId("picker-repo"), "alpha");
+  expect(await screen.findByTestId("issues-empty")).toBeTruthy();
+  expect((screen.getByTestId("picker-continue") as HTMLButtonElement).disabled).toBe(true);
+  fireEvent.input(screen.getByLabelText("Task"), { target: { value: "tidy the readme" } });
+  fireEvent.click(screen.getByTestId("picker-continue"));
+  expect(screen.getByTestId("confirm-step")).toBeTruthy();
+  expect(posts().length).toBe(0);
+});
+
+test("picker: an issues-route failure is a real error state, not an empty list", async () => {
+  serve({ "/v1/repos": json({ repos: ["alpha"] }), "/v1/repos/issues": json({ error: "gh failed" }, 502) });
+  render(<NewRunPicker preset={null} onDone={() => {}} />);
+  pick(await screen.findByTestId("picker-repo"), "alpha");
+  expect((await screen.findByTestId("issues-error")).textContent).toContain("gh failed");
+  expect(screen.queryByTestId("issues-empty")).toBeNull();
+});
+
+test("picker: an offered ref for a registered repo goes straight to confirm; an unregistered repo is refused", async () => {
+  serve({ "/v1/repos": json({ repos: ["alpha"] }), "/v1/runs": json({ ok: true, pid: 1, command: "x" }) });
+  const { unmount } = render(<NewRunPicker preset="o/alpha#7" onDone={() => {}} />);
+  expect((await screen.findByTestId("confirm-text")).textContent).toContain("o/alpha#7");
+  expect(posts().length).toBe(0);
+  unmount();
+  render(<NewRunPicker preset="o/ghost#7" onDone={() => {}} />);
+  expect((await screen.findByTestId("picker-error")).textContent).toCo
```

**File**: `packages/control-plane/test/ui/ia-runs.test.tsx` (added, +87/-0)
```diff
@@ -0,0 +1,87 @@
+// A4a: issue grouping, KPIs, NEEDS YOU, the grouped Runs table and the Overview.
+import "./dom";
+import { afterEach, expect, test } from "bun:test";
+
+const { cleanup, fireEvent, render, screen, within } = await import("@testing-library/react");
+const { groupByIssue, inboxOf, kpisOf, costOf, durationOf } = await import("../../ui/src/pages/runs/issues");
+const { RunsView } = await import("../../ui/src/pages/runs");
+const { HomeView, kpiTiles } = await import("../../ui/src/pages/home/Home");
+
+const NOW = Date.parse("2026-10-03T12:00:00Z");
+const row = (o: Record<string, unknown>) => ({
+  source_id: "s1", run_id: "r", origin_repo: "o/x", issue_ref: null, title: null, task_source: "issue", provider: "claude", model: "sonnet",
+  started_at: "2026-10-03T10:00:00Z", ended_at: "2026-10-03T10:05:00Z", verdict: "VERIFIED", pr_url: null, pr_draft: null, cost_usd: 1, partial_usd: 0,
+  measured_sessions: 1, total_sessions: 1, input_tokens: null, output_tokens: null, wall_s: 300, last_seq: 3, last_event_at: null,
+  tampered: false, conflict: false, status: "completed", ...o,
+}) as import("../../ui/src/api").RunRow;
+
+const a1 = row({ run_id: "a1", issue_ref: "o/x#1", title: "Fix login", verdict: "FAILED", started_at: "2026-10-02T10:00:00Z", ended_at: "2026-10-02T10:05:00Z" });
+const a2 = row({ run_id: "a2", issue_ref: "o/x#1", title: "Fix login", verdict: "VERIFIED", pr_url: "https://github.com/o/x/pull/5" });
+const part = row({ run_id: "p1", issue_ref: "o/x#2", title: "Add cache", verdict: "PARTIAL" });
+const blocked = row({ run_id: "b1", issue_ref: "o/x#3", title: "Spec clash", verdict: "SPEC_CONFLICT" });
+const free = row({ run_id: "f1", issue_ref: null, title: null, verdict: "VERIFIED", cost_usd: null, measured_sessions: 0 });
+const all = [a1, a2, part, blocked, free];
+
+afterEach(cleanup);
+
+test("grouping: attempts of one issue collapse, the latest attempt decides the state, titles are never run ids", () => {
+  const g = groupByIssue(all);
+  expect(g.length).toBe(4);
+  const one = g.find((x) => x.ref === "o/x#1")!;
+  expect(one.attempts.map((r) => r.run_id)).toEqual(["a2", "a1"]);
+  expect(one.latest.run_id).toBe("a2");
+  expect(g.find((x) => x.latest.run_id === "f1")!.title).toBe("Untitled task");
+  expect(g.some((x) => /^(a1|a2|p1|b1|f1)$/.test(x.title))).toBe(false);
+});
+
+test("NEEDS YOU lists blocked, partial and recent PRs from the latest attempt only", () => {
+  const inbox = inboxOf(groupByIssue(all), NOW);
+  expect(inbox.blocked.map((x) => x.ref)).toEqual(["o/x#3"]);
+  expect(inbox.partial.map((x) => x.ref)).toEqual(["o/x#2"]);
+  expect(inbox.prs.map((x) => x.ref)).toEqual(["o/x#1"]);
+  const stale = inboxOf(groupByIssue([row({ run_id: "old", issue_ref: "o/x#9", pr_url: "https://github.com/o/x/pull/9", started_at: "2026-08-01T10:00:00Z", ended_at: "2026-08-01T10:05:00Z" })]), NOW);
+  expect(stale.prs).toEqual([]);
+});
+
+test("formatters return null when there is no data", () => {
+  expect(costOf(free)).toBeNull();
+  expect(costOf(a2)).not.toBeNull();
+  expect(durationOf(row({ ended_at: null, wall_s: null }))).toBeNull();
+});
+
+test("Overview: exactly 4 KPI tiles, NEEDS YOU inbox, no composer", () => {
+  render(<HomeView runs={all} now={NOW} />);
+  expect(within(screen.getByTestId("kpis")).getAllByTestId(/^kpi-/).length).toBe(4);
+  const needs = screen.getByTestId("needs-you");
+  expect(within(needs).getAllByTestId("inbox-row").length).toBe(3);
+  expect(screen.getByTestId("latest-by-issue")).toBeTruthy();
+  expect(screen.queryByTestId("hero")).toBeNull();
+  expect(screen.queryByRole("textbox")).toBeNull();
+  expect(document.body.textContent ?? "").not.toMatch(/unmeasured/i);
+});
+
+test("Overview with nothing waiting says so, and an empty KPI states why instead of a zero", () => {
+  render(<HomeView runs={[]} now={NOW} />);
+  expect(screen.getByTestId("needs-you-empty")).toBeTruthy();
+  const t = kpiTiles(kpisOf([], [], NOW));
+  expect(t.length).toBe(4);
+  expect(t.find((x) => x.id === "kpi-verified")!.value).toBe("No finished runs");
+  expect(t.find((x) => x.id === "kpi-cost")!.value).toBe("No priced runs");
+});
+
+test("Runs table is grouped by issue, attempts expand, filters narrow, no unmeasured and no raw enums", () => {
+  render(<RunsView runs={all} now={NOW} />);
+  const rows = screen.getAllByTestId("issue-row");
+  expect(rows.length).toBe(4);
+  expect(screen.queryAllByTestId("attempt-row").length).toBe(0);
+  const first = rows.find((r) => r.textContent!.includes("Fix login"))!;
+  expect(first.getAttribute("data-attempts")).toBe("2");
+  fireEvent.click(within(first).getByTestId("expand"));
+  expect(screen.getAllByTestId("attempt-row").length).toBe(2);
+  const text = document.body.textContent ?? "";
+  expect(text).not.toMatch(/unmeasured/i);
+  expect(text).not.toMatch(/SPEC_CONFLICT|NOT_VERIFIED|ALREADY_SATISFIED/);
+  expect(screen.getByTestId("filter-outcome")).toBeTruthy();
+  expect(screen.getByTestId("filter
```

**File**: `packages/control-plane/test/ui/palette.test.tsx` (modified, +13/-13)
```diff
@@ -4,13 +4,14 @@ import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
 
 const realFetch = globalThis.fetch;
 const { act, cleanup, fireEvent, render, screen } = await import("@testing-library/react");
-const { CommandPalette, COMPOSER_SUBMIT_EVENT } = await import("../../ui/src/palette");
-const { openCommandPalette } = await import("../../ui/src/shell/hooks");
+const { CommandPalette } = await import("../../ui/src/palette");
+const { closeNewRun, getNewRun } = await import("../../ui/src/pages/compose/store");
+const { openCommandPalette } =await import("../../ui/src/shell/hooks");
 const { setTheme } = await import("../../ui/src/shell/theme");
 const { registerPage, unregisterPage } = await import("../../ui/src/pages/registry");
 const { search, runItems, pageItems, actionItems } = await import("../../ui/src/palette/items");
 
-const run = (id: string, at: string) => ({ source_id: "s1", run_id: id, origin_repo: "o/r", verdict: "VERIFIED", status: "done", started_at: at, last_event_at: null });
+const run = (id: string, at: string) => ({ source_id: "s1", run_id: id, origin_repo: "o/r", title: id, issue_ref: null, verdict: "VERIFIED", status: "done", started_at: at, last_event_at: null });
 const Page = () => null;
 
 beforeAll(() => {
@@ -65,24 +66,23 @@ test("arrow keys wrap and mark the highlighted option selected", async () => {
   expect(opts[0]!.getAttribute("aria-selected")).toBe("false");
 });
 
-test("Cmd+N opens a new run, Cmd+Shift+D toggles the theme", () => {
+test("Cmd+N opens the New run picker (not a route), Cmd+Shift+D toggles the theme", () => {
   render(<CommandPalette />);
+  closeNewRun();
   key({ key: "n", metaKey: true });
-  expect(location.hash).toBe("#/new");
+  expect(getNewRun().open).toBe(true);
+  expect(getNewRun().preset).toBeNull();
+  expect(location.hash).toBe("");
+  closeNewRun();
   setTheme("dark"); // pin the store so the toggle result does not depend on the system preference
   const before = document.documentElement.getAttribute("data-theme");
   key({ key: "D", metaKey: true, shiftKey: true });
   expect(document.documentElement.getAttribute("data-theme")).not.toBe(before);
 });
 
-test("Cmd+Enter dispatches the documented composer submit event", () => {
-  render(<CommandPalette />);
-  let n = 0;
-  const h = () => { n++; };
-  window.addEventListener(COMPOSER_SUBMIT_EVENT, h);
-  key({ key: "Enter", ctrlKey: true });
-  window.removeEventListener(COMPOSER_SUBMIT_EVENT, h);
-  expect(n).toBe(1);
+test("a run without a title is labelled by its issue ref or Untitled task, never its run id", () => {
+  const items = runItems([{ ...run("hidden-id", "2026-10-03T00:00:00Z"), title: null, issue_ref: "o/r#9" }, { ...run("hidden-2", "2026-10-02T00:00:00Z"), title: null, issue_ref: null }] as never);
+  expect(items.map((i) => i.label)).toEqual(["o/r#9", "Untitled task"]);
 });
 
 test("search: empty query lists all, no match is empty, runs capped", () => {
```

---

### Incident Patch 13: `7e5d3625` (2026-10-04)
**Commit Message**: fix(control-plane): Ask tools server resolves from the dist bundle; refuse opencode (rev-ask2 blockers)

Bundle tools_server.ts to dist/ask-tools-server.js (deps inlined), ship it in package files, resolve it by walking up from import.meta.dir (dist first, src fallback), fail the job clearly if absent. opencode joins cline and aider on the refusal path; codex documented as degraded.

Claude-Session: https://claude.ai/code/session_01GFNzL4TEfAXvX1KK5buE9w

**File**: `package.json` (modified, +1/-0)
```diff
@@ -89,6 +89,7 @@
     "packages/control-plane/drizzle/",
     "packages/control-plane/package.json",
     "packages/control-plane/dist/server.js",
+    "packages/control-plane/dist/ask-tools-server.js",
     "packages/control-plane/ui/dist/",
     "api/",
     "events/",
```

**File**: `packages/control-plane/package.json` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@
     "test": "bun test ./test/",
     "typecheck": "tsc --noEmit -p tsconfig.json",
     "build:ui": "cd ui && bun install --frozen-lockfile && bun run build",
-    "build:server": "bun build src/server/serve.ts --target=bun --outfile dist/server.js",
+    "build:server": "bun build src/server/serve.ts --target=bun --outfile dist/server.js && bun build src/ask/tools_server.ts --target=bun --outfile dist/ask-tools-server.js",
     "build:all": "bun run build:ui && bun run build:server",
     "db:generate": "drizzle-kit generate --dialect sqlite --schema ./src/db/schema.ts --out ./drizzle"
   },
```

**File**: `packages/control-plane/src/ask/invoke.ts` (modified, +4/-7)
```diff
@@ -1,5 +1,5 @@
 // CP-ASK slice 7: provider argv for an Ask job. Pure; no spawn. The prompt travels on stdin so a question can never become an option.
-// claude is the full path. codex and opencode are degraded (version-sensitive MCP flags). cline and aider have no MCP on our path and are refused.
+// claude is the full path. codex is degraded: its read-only sandbox still allows shell reads. opencode, cline and aider have no read-only guard or no MCP and are refused.
 import { ALLOWED_TOOLS, DENIED_TOOLS, MCP_SERVER_NAME } from "./policy.ts";
 
 export interface InvokeOpts {
@@ -16,12 +16,12 @@ export interface InvokeOpts {
 export type Invocation = { ok: true; argv: string[]; promptVia: "stdin" } | { ok: false; error: string };
 
 export const MODEL_RE = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,79}$/;
-export const REFUSED = "Ask needs a provider with MCP; use claude, codex or opencode";
+export const REFUSED = "Ask needs claude or codex for now";
 
 const toml = (v: string): string => JSON.stringify(v);
 
 export function buildInvocation(o: InvokeOpts): Invocation {
-  if (o.provider === "cline" || o.provider === "aider") return { ok: false, error: REFUSED };
+  if (o.provider === "cline" || o.provider === "aider" || o.provider === "opencode") return { ok: false, error: REFUSED };
   if (o.model && !MODEL_RE.test(o.model)) return { ok: false, error: "model must match [A-Za-z0-9][A-Za-z0-9._/-]{0,79}" };
   const model = o.model ? ["--model", o.model] : []; // the default model is omitted so the provider's own default applies
   if (o.provider === "claude") {
@@ -38,8 +38,5 @@ export function buildInvocation(o: InvokeOpts): Invocation {
     const mcp = o.mcpCommand ? ["-c", `mcp_servers.${MCP_SERVER_NAME}.command=${toml(o.mcpCommand.command)}`, "-c", `mcp_servers.${MCP_SERVER_NAME}.args=[${o.mcpCommand.args.map(toml).join(",")}]`] : [];
     return { ok: true, promptVia: "stdin", argv: [o.bin ?? "codex", "exec", "--json", "--sandbox", "read-only", "--skip-git-repo-check", "-C", o.jobDir, ...mcp, ...model, "-"] };
   }
-  if (o.provider === "opencode") {
-    return { ok: true, promptVia: "stdin", argv: [o.bin ?? "opencode", "run", ...model] };
-  }
-  return { ok: false, error: "provider must be one of: claude, codex, opencode" };
+  return { ok: false, error: "provider must be one of: claude, codex" };
 }
```

**File**: `packages/control-plane/src/ask/policy.ts` (modified, +13/-3)
```diff
@@ -2,11 +2,21 @@
 // The provider never gets a shell, a file tool or the web; its only tools are the read-only TS tools server.
 import { chmodSync, existsSync, lstatSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
 import { tmpdir } from "node:os";
-import { dirname, join } from "node:path";
+import { dirname, join, parse } from "node:path";
 
 /** Name of the TS tools server (packages/control-plane/src/ask/tools_server.ts); its tools surface as mcp__<name>__*. */
 export const MCP_SERVER_NAME = "loki-ask";
 export const MCP_SERVER_SCRIPT = "packages/control-plane/src/ask/tools_server.ts";
+export const MCP_SERVER_BUNDLE = "ask-tools-server.js";
+
+/** Find the tools server by walking up from startDir. The dist bundle (deps inlined) wins over the TypeScript source of a dev checkout. */
+export function resolveToolsServer(startDir: string): string | null {
+  const dirs: string[] = [];
+  for (let d = startDir; ; d = dirname(d)) { dirs.push(d); if (d === parse(d).root) break; }
+  const bundles = dirs.flatMap((d) => [join(d, MCP_SERVER_BUNDLE), join(d, "dist", MCP_SERVER_BUNDLE), join(d, "packages/control-plane/dist", MCP_SERVER_BUNDLE)]);
+  const sources = dirs.flatMap((d) => [join(d, "src/ask/tools_server.ts"), join(d, MCP_SERVER_SCRIPT)]);
+  return [...bundles, ...sources].find((f) => existsSync(f)) ?? null;
+}
 
 export const ALLOWED_TOOLS = `mcp__${MCP_SERVER_NAME}__*`;
 
@@ -18,9 +28,9 @@ export const DENIED_TOOLS = [
 ].join(",");
 
 /** The mcp.json for one job. The tools server reads control.db directly (read-only), so no CP URL or token exists anywhere in the job. */
-export function buildMcpConfig(repoRoot: string, dbPath: string): Record<string, unknown> {
+export function buildMcpConfig(serverScript: string, dbPath: string): Record<string, unknown> {
   const env: Record<string, string> = { LOKI_CONTROL_DB: dbPath };
-  return { mcpServers: { [MCP_SERVER_NAME]: { command: "bun", args: [join(repoRoot, MCP_SERVER_SCRIPT)], env } } };
+  return { mcpServers: { [MCP_SERVER_NAME]: { command: "bun", args: [serverScript], env } } };
 }
 
 const PREFIX = "loki-ask.";
```

**File**: `packages/control-plane/src/ask/worker.ts` (modified, +7/-4)
```diff
@@ -8,12 +8,13 @@ import type { Db } from "../db/migrate.ts";
 import { childEnv } from "../server/spawn.ts";
 import { buildInvocation } from "./invoke.ts";
 import { type AskProvider, finish, markComplete, newState, parseLine } from "./parse.ts";
-import { buildMcpConfig, createJobDir, MCP_SERVER_SCRIPT, removeJobDir } from "./policy.ts";
+import { buildMcpConfig, createJobDir, removeJobDir, resolveToolsServer } from "./policy.ts";
 import { buildPrompt } from "./prompt.ts";
 import { type AskStatus, appendEvent, finishMessage, getMessage, getThread, listMessages, setRunning } from "./store.ts";
 
 export interface WorkerOpts {
-  repoRoot: string;
+  /** Tools server script; resolved from the running bundle or checkout when omitted. */
+  toolsServer?: string;
   dbPath: string;
   /** Provider binary override (tests, pinned path). */
   bin?: string;
@@ -58,12 +59,14 @@ export async function runAskJob(db: Db, messageId: string, o: WorkerOpts): Promi
   const maxUsd = o.maxUsd ?? DEFAULT_MAX_USD;
   let jobDir: string | undefined;
   try {
+    const toolsServer = o.toolsServer ?? resolveToolsServer(import.meta.dir);
+    if (!toolsServer) return fail("Ask tools server not found (expected ask-tools-server.js in dist/ or src/ask/tools_server.ts); rebuild with bun run build:server");
     jobDir = createJobDir();
     const mcpConfigPath = join(jobDir, "mcp.json");
-    writeFileSync(mcpConfigPath, JSON.stringify(buildMcpConfig(o.repoRoot, o.dbPath)), { mode: 0o600 });
+    writeFileSync(mcpConfigPath, JSON.stringify(buildMcpConfig(toolsServer, o.dbPath)), { mode: 0o600 });
     const inv = buildInvocation({
       provider: thread.provider, model: thread.model, mcpConfigPath, jobDir, maxUsd, bin: o.bin,
-      mcpCommand: { command: "bun", args: [join(o.repoRoot, MCP_SERVER_SCRIPT)] },
+      mcpCommand: { command: "bun", args: [toolsServer] },
     });
     if (!inv.ok) return fail(inv.error);
     const provider = thread.provider as AskProvider;
```

**File**: `packages/control-plane/src/server/routes/ask.ts` (modified, +4/-6)
```diff
@@ -1,7 +1,7 @@
 // CP-ASK slice 10: Ask Loki HTTP surface, behind LOKI_CP_ASK=1 (flag off: every /v1/ask* route is 404).
 // Free text goes ONLY to the read-only Ask worker; it never reaches the run-start path (this file has no import from the run-start module).
 // Gate: a bearer token (enforced by tokenGuard on /v1/*) or, without one, a loopback peer and Host. POST needs JSON, a same-host Origin and questions up to 4000 chars.
-import { basename, resolve } from "node:path";
+import { basename } from "node:path";
 import type { Context } from "hono";
 import { localRepos } from "../../db/schema.ts";
 import { buildInvocation, MODEL_RE } from "../../ask/invoke.ts";
@@ -13,12 +13,10 @@ import type { RouteCtx } from "./index.ts";
 import { createSse } from "./stream.ts";
 
 export const MAX_QUESTION = 4000;
-const PROVIDERS = new Set(["claude", "codex", "cline", "aider", "opencode"]);
+const PROVIDERS = new Set(["claude", "codex", "cline", "aider", "opencode"]); // opencode and cline and aider are refused by buildInvocation
 const num = (v: string | undefined, d: number) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : d; };
 export const askEnabled = (): boolean => process.env.LOKI_CP_ASK === "1";
 
-// routes/ -> server/ -> src/ -> control-plane/ -> packages/ -> repo root
-const defaultRepoRoot = () => process.env.LOKI_ASK_REPO_ROOT || resolve(import.meta.dir, "../../../../..");
 
 export function mount(ctx: RouteCtx): void {
   const { app, db } = ctx;
@@ -64,7 +62,7 @@ export function mount(ctx: RouteCtx): void {
       threadId = t.id; provider = t.provider; model = t.model; repo = t.repo;
     } else {
       provider = typeof body.provider === "string" && body.provider ? body.provider : process.env.LOKI_ASK_PROVIDER || "claude";
-      if (!PROVIDERS.has(provider)) return c.json({ error: "provider must be one of: claude, codex, opencode" }, 400);
+      if (!PROVIDERS.has(provider)) return c.json({ error: "provider must be one of: claude, codex" }, 400);
       model = typeof body.model === "string" && body.model ? body.model : null;
       if (model !== null && !MODEL_RE.test(model)) return c.json({ error: "model must match [A-Za-z0-9][A-Za-z0-9._/-]{0,79}" }, 400);
       repo = typeof body.repo === "string" && body.repo ? body.repo : null;
@@ -79,7 +77,7 @@ export function mount(ctx: RouteCtx): void {
     const { assistantId } = addTurn(db, threadId, question);
     audit(db, { kind: "ask.start", target: threadId, result: "queued", detail: `provider ${provider}; ${question.length} chars` });
     void runAskJob(db, assistantId, {
-      repoRoot: defaultRepoRoot(), dbPath: dbPath(), bin: process.env.LOKI_ASK_BIN || undefined,
+      toolsServer: process.env.LOKI_ASK_TOOLS_SERVER || undefined, dbPath: dbPath(), bin: process.env.LOKI_ASK_BIN || undefined,
       timeoutMs: num(process.env.LOKI_ASK_TIMEOUT_S, 600) * 1000, maxUsd: num(process.env.LOKI_ASK_MAX_USD, 1),
     }).catch(() => { /* runAskJob records its own failures on the row */ });
     return c.json({ thread_id: threadId, message_id: assistantId }, 202);
```

**File**: `packages/control-plane/test/server/ask_invoke.test.ts` (modified, +2/-2)
```diff
@@ -39,9 +39,9 @@ test("codex runs in a read-only sandbox in the scratch dir", () => {
 });
 
 test("cline and aider are refused with the MCP message; unknown providers too", () => {
-  for (const p of ["cline", "aider"]) {
+  for (const p of ["cline", "aider", "opencode"]) {
     const r = buildInvocation({ ...base, provider: p });
-    expect(r).toEqual({ ok: false, error: "Ask needs a provider with MCP; use claude, codex or opencode" });
+    expect(r).toEqual({ ok: false, error: "Ask needs claude or codex for now" });
   }
   expect(buildInvocation({ ...base, provider: "gemini" }).ok).toBe(false);
 });
```

**File**: `packages/control-plane/test/server/ask_policy.test.ts` (modified, +23/-3)
```diff
@@ -1,8 +1,9 @@
 // CP-ASK slice 6: tool policy, read-only mcp.json and the per-job scratch dir.
 import { expect, test } from "bun:test";
-import { existsSync, readFileSync, statSync } from "node:fs";
+import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
+import { tmpdir } from "node:os";
 import { dirname, join, resolve } from "node:path";
-import { ALLOWED_TOOLS, DENIED_TOOLS, MCP_SERVER_NAME, buildMcpConfig, createJobDir, removeJobDir } from "../../src/ask/policy.ts";
+import { ALLOWED_TOOLS, DENIED_TOOLS, MCP_SERVER_NAME, buildMcpConfig, createJobDir, removeJobDir, resolveToolsServer } from "../../src/ask/policy.ts";
 
 const REPO = resolve(import.meta.dir, "../../../..");
 
@@ -20,7 +21,7 @@ test("the allow list is only the one TypeScript tools server", () => {
 });
 
 test("mcp.json launches only the TS tools server (bun, no python, no server.py) with the db path and no token", () => {
-  const cfg = buildMcpConfig(REPO, "/data/control.db") as { mcpServers: Record<string, { command: string; args: string[]; env?: Record<string, string> }> };
+  const cfg = buildMcpConfig(join(REPO, "packages/control-plane/src/ask/tools_server.ts"), "/data/control.db") as { mcpServers: Record<string, { command: string; args: string[]; env?: Record<string, string> }> };
   expect(Object.keys(cfg.mcpServers)).toEqual([MCP_SERVER_NAME]);
   const s = cfg.mcpServers[MCP_SERVER_NAME]!;
   expect(s.command).toBe("bun");
@@ -44,3 +45,22 @@ test("removeJobDir refuses a path that is not a marked scratch dir", () => {
   expect(() => removeJobDir("/tmp")).toThrow();
   expect(existsSync(join(REPO, "package.json"))).toBe(true);
 });
+
+test("the tools server resolves from a dist-shaped dir, prefers the bundle, falls back to src, and is null when absent", () => {
+  const root = mkdtempSync(join(tmpdir(), "ask-resolve-test-"));
+  try {
+    const dist = join(root, "install/packages/control-plane/dist");
+    mkdirSync(dist, { recursive: true });
+    expect(resolveToolsServer(dist)).toBeNull();
+    const src = join(root, "install/packages/control-plane/src/ask");
+    mkdirSync(src, { recursive: true });
+    writeFileSync(join(src, "tools_server.ts"), "");
+    expect(resolveToolsServer(dist)).toBe(join(src, "tools_server.ts"));
+    writeFileSync(join(dist, "ask-tools-server.js"), "");
+    expect(resolveToolsServer(dist)).toBe(join(dist, "ask-tools-server.js"));
+  } finally { rmSync(root, { recursive: true, force: true }); }
+});
+
+test("from the real source tree the tools server resolves to the checkout's tools_server.ts", () => {
+  expect(resolveToolsServer(join(REPO, "packages/control-plane/src/ask"))).toMatch(/tools_server\.ts$|ask-tools-server\.js$/);
+});
```

---

### Incident Patch 14: `53d7fbf6` (2026-10-04)
**Commit Message**: fix(cp): A3 stale CP restart, fixture ingest refusal and cleanup, start-repo guard, dead-run reconcile, repo issues

- A3a: loki control serve restarts a CP whose recorded version differs (recorded PID only, /health verified); /health reports version and installed_version; UI banner.
- A3b/A3f: ingest refuses test run-id prefixes and temp-dir sources; one-time cleanup v2 removes null-origin test rows, runs started in HOME or a non-repo dir, and FAILED runs with no run dir; guard test for runner hermeticity, root bunfig preloads the hermetic preload.
- A3d: planStart refuses HOME, / and non-repo dirs with a human reason.
- A3e: reconcileDeadRuns marks runs with no live worker PID as STOPPED after a grace period.
- GET /v1/repos/issues via fixed-argv gh for registered repos.

Claude-Session: https://claude.ai/code/session_01GFNzL4TEfAXvX1KK5buE9w

**File**: `bunfig.toml` (modified, +1/-0)
```diff
@@ -11,3 +11,4 @@
 # scripts/local-ci.sh already does `cd loki-ts && bun test`.
 [test]
 root = "loki-ts/tests"
+preload = ["./loki-ts/tests/preload.ts"] # hermetic HOME + LOKI_CONTROL=0 for a root-level bun test too
```

**File**: `loki-ts/src/commands/control.ts` (modified, +30/-1)
```diff
@@ -43,6 +43,34 @@ function serverCmd(): string[] | null {
   return existsSync(src) ? ["bun", "--install=fallback", "run", src] : null;
 }
 
+const pidAlive = (pid: number): boolean => { try { process.kill(pid, 0); return true; } catch { return false; } };
+const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
+const installedVersion = (): string => { try { return readFileSync(join(REPO_ROOT, "VERSION"), "utf8").trim() || "unknown"; } catch { return "unknown"; } };
+
+/** FC-26: a Control Plane left running across an upgrade keeps serving the old code. Reads the PID that CP recorded in instance.json
+ *  (never a name or pattern match), and when its recorded version differs from the installed one and /health still answers as loki-control,
+ *  SIGTERMs that one PID (the serve wrapper, which stops its child) and waits for it to exit. Returns the restarted PID or null. */
+export async function restartStaleControlPlane(env: NodeJS.ProcessEnv, current: string = installedVersion(), opts: { alive?: (pid: number) => boolean; waitMs?: number } = {}): Promise<number | null> {
+  const alive = opts.alive ?? pidAlive;
+  let inst: { pid?: unknown; url?: unknown; version?: unknown };
+  try { inst = JSON.parse(readFileSync(instancePath(env), "utf8")); } catch { return null; }
+  if (!Number.isInteger(inst.pid) || (inst.pid as number) <= 1 || (inst.pid as number) === process.pid || typeof inst.url !== "string") return null;
+  const pid = inst.pid as number;
+  if (!alive(pid)) return null;
+  let running = typeof inst.version === "string" ? inst.version : "unknown";
+  try {
+    const h = (await (await fetch(`${inst.url}/health`, { signal: AbortSignal.timeout(3000) })).json()) as { service?: string; version?: string };
+    if (h.service !== "loki-control") return null; // the recorded pid now belongs to something else
+    if (typeof h.version === "string") running = h.version;
+  } catch { return null; }
+  if (running === current) return null;
+  process.stderr.write(`loki control: Control Plane is out of date (running ${running}, installed ${current}), restarting\n`);
+  try { process.kill(pid, "SIGTERM"); } catch { return null; }
+  const until = Date.now() + (opts.waitMs ?? 8000);
+  while (alive(pid) && Date.now() < until) await sleep(50);
+  return alive(pid) ? null : pid;
+}
+
 async function serve(args: string[], env: NodeJS.ProcessEnv): Promise<number> {
   const explicit = flag(args, "--port") ?? env.LOKI_CONTROL_PORT;
   const port = explicit ?? String(DEFAULT_PORT);
@@ -51,8 +79,9 @@ async function serve(args: string[], env: NodeJS.ProcessEnv): Promise<number> {
   const cmd = serverCmd();
   if (!cmd) { process.stderr.write("loki control: server not found (packages/control-plane is missing from this install)\n"); return 1; }
   mkdirSync(dirname(db), { recursive: true });
+  await restartStaleControlPlane(env);
   // the default port falls back to any free port when taken (the printed URL is the real one); an explicit port never does
-  const child = Bun.spawn(cmd, { env: { ...env, PORT: port, LOKI_CONTROL_DB: db, LOKI_CONTROL_PORT_FALLBACK: explicit === undefined ? "1" : "0" }, stdio: ["inherit", "pipe", "inherit"] });
+  const child = Bun.spawn(cmd, { env: { ...env, PORT: port, LOKI_CONTROL_DB: db, LOKI_CONTROL_VERSION: installedVersion(), LOKI_VERSION_FILE: join(REPO_ROOT, "VERSION"), LOKI_CONTROL_PORT_FALLBACK: explicit === undefined ? "1" : "0" }, stdio: ["inherit", "pipe", "inherit"] });
   // the service must not outlive this CLI: forward stop signals and also kill on any exit path
   for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => child.kill());
   const inst = instancePath(env);
```

**File**: `loki-ts/tests/runner-hermetic.test.ts` (added, +34/-0)
```diff
@@ -0,0 +1,34 @@
+// A3b guard: every test runner sets a hermetic HOME and LOKI_CONTROL=0, so no suite can ship fixture runs into a developer's real control.db
+// (155 fixture runs leaked once: e37-*, e10-sig, e10-sg*). A runner here is a shell entry point or a bunfig.toml that has a [test] section.
+import { expect, test } from "bun:test";
+import { existsSync, readFileSync } from "node:fs";
+import { join } from "node:path";
+import { REPO_ROOT } from "../src/util/paths.ts";
+
+const read = (rel: string): string => readFileSync(join(REPO_ROOT, rel), "utf8");
+
+test("the shell runners export LOKI_CONTROL=0 and enter the hermetic HOME", () => {
+  const all = read("tests/run-all-tests.sh");
+  expect(all).toMatch(/export [^\n]*LOKI_CONTROL=0/);
+  expect(all).toContain("hermetic-home.sh");
+  const ci = read("scripts/local-ci.sh");
+  expect(ci).toMatch(/export LOKI_CONTROL="\$\{LOKI_CONTROL:-0\}"/);
+  expect(ci).toContain("loki_hermetic_home_enter");
+});
+
+test("the shared bun preload defaults LOKI_CONTROL to 0 and makes HOME hermetic", () => {
+  const pre = read("loki-ts/tests/preload.ts");
+  expect(pre).toMatch(/process\.env\["LOKI_CONTROL"\] = "0"/);
+  expect(pre).toContain("LOKI_HERMETIC_HOME");
+  expect(pre).toMatch(/process\.env\["HOME"\] =/);
+});
+
+test("every bunfig.toml with a [test] section preloads the shared hermetic preload", () => {
+  const configs = ["bunfig.toml", "loki-ts/bunfig.toml", "packages/control-plane/bunfig.toml"];
+  for (const rel of configs) {
+    if (!existsSync(join(REPO_ROOT, rel))) continue;
+    const txt = read(rel);
+    if (!/^\[test\]/m.test(txt)) continue;
+    expect({ file: rel, preloadsShared: /preload\s*=\s*\[[^\]]*loki-ts\/tests\/preload\.ts|preload\s*=\s*\[[^\]]*\.\/tests\/preload\.ts/.test(txt) }).toEqual({ file: rel, preloadsShared: true });
+  }
+});
```

**File**: `packages/control-plane/src/db/fixture-cleanup.ts` (modified, +24/-10)
```diff
@@ -1,34 +1,48 @@
 // One-time cleanup of fixture runs that earlier test suites leaked into real control DBs (FC-07b).
 // Runs at CP start. A marker audit row makes it run once per DB; every removal is audited first, in the same transaction.
 import { Database } from "bun:sqlite";
-import { realpathSync } from "node:fs";
-import { tmpdir } from "node:os";
-import { sep } from "node:path";
+import { existsSync, realpathSync } from "node:fs";
+import { homedir, tmpdir } from "node:os";
+import { join, sep } from "node:path";
 import { audit } from "./prune.ts";
 
 export const FIXTURE_REPO = "acme/widget";
-const DONE = "fixture.cleanup.done";
+const DONE = "fixture.cleanup.v2.done"; // v2 (R2, A3b/A3f): also origin_repo-null test rows, runs in HOME or a non-repo dir, and FAILED runs with no run dir
+/** Run ids that only test suites write (e37-cline/codex/aider, e10-sig, e10-sg1/sg2). */
+export const TEST_RUN_ID = /^(e37-|e10-sig|e10-sg)/;
 
-const tempRoots = (): string[] => {
+export const tempRoots = (): string[] => {
   const roots = new Set<string>(["/tmp", "/private/tmp", "/var/tmp", tmpdir()]);
   for (const r of [...roots]) { try { roots.add(realpathSync(r)); } catch { /* absent */ } }
   return [...roots].map((r) => r.replace(/[\\/]+$/, "")).filter((r) => r.length > 1);
 };
 
-const underTemp = (p: string, roots: string[]): boolean => roots.some((r) => p === r || p.startsWith(r + sep) || p.startsWith(r + "/"));
+export const underTemp = (p: string, roots: string[]): boolean => roots.some((r) => p === r || p.startsWith(r + sep) || p.startsWith(r + "/"));
 
 /** Removes leaked fixture runs once per DB. Returns the number of runs removed (0 on every later start). */
-export function cleanupLeakedFixtures(sqlite: Database): number {
+export function cleanupLeakedFixtures(sqlite: Database, rootsOverride?: string[]): number {
   let removed = 0;
   sqlite.transaction(() => {
     if (sqlite.query("select 1 x from audit where action = ?").get(DONE)) return;
-    const roots = tempRoots();
+    const roots = rootsOverride ?? tempRoots();
     const tempSources = new Set(
       (sqlite.query("select source_id, realpath from local_repos").all() as { source_id: string; realpath: string }[])
         .filter((r) => underTemp(r.realpath, roots)).map((r) => r.source_id),
     );
-    const all = sqlite.query("select source_id, run_id, origin_repo from runs").all() as { source_id: string; run_id: string; origin_repo: string | null }[];
-    const doomed = all.filter((r) => r.origin_repo === FIXTURE_REPO || tempSources.has(r.source_id));
+    const repos = new Map((sqlite.query("select source_id, realpath from local_repos").all() as { source_id: string; realpath: string }[]).map((r) => [r.source_id, r.realpath]));
+    const real = (p: string): string => { try { return realpathSync(p); } catch { return p; } };
+    const home = real(process.env.HOME || homedir());
+    const isGit = (p: string): boolean => { for (let d = p; d !== "/" && d !== home && d !== join(d, ".."); d = join(d, "..")) if (existsSync(join(d, ".git"))) return true; return false; };
+    // A3f: a run that started in HOME or a non-repo dir (the composer once started "whats going on so far" in HOME), or FAILED with no run dir on disk.
+    const badRun = (r: { source_id: string; run_id: string; verdict: string | null }): boolean => {
+      const rp = repos.get(r.source_id);
+      if (!rp || !existsSync(rp)) return false;
+      const dir = real(rp);
+      if (dir === home || dir === "/" || !isGit(dir)) return true;
+      return r.verdict === "FAILED" && !existsSync(join(dir, ".loki", "runs", r.run_id));
+    };
+    const all = sqlite.query("select source_id, run_id, origin_repo, verdict from runs").all() as { source_id: string; run_id: string; origin_repo: string | null; verdict: string | null }[];
+    const doomed = all.filter((r) => r.origin_repo === FIXTURE_REPO || tempSources.has(r.source_id) || (r.origin_repo === null && TEST_RUN_ID.test(r.run_id)) || badRun(r));
     const touched = new Set<string>();
     for (const k of doomed) {
       const ev = (sqlite.query("select count(*) n from events where source_id = ? and run_id = ?").get(k.source_id, k.run_id) as { n: number }).n;
```

**File**: `packages/control-plane/src/server/app.ts` (modified, +13/-6)
```diff
@@ -1,4 +1,4 @@
-import { existsSync, statSync } from "node:fs";
+import { existsSync, readFileSync, statSync } from "node:fs";
 import { join, resolve, sep } from "node:path";
 import { Hono, type Context } from "hono";
 import { cleanupLeakedFixtures } from "../db/fixture-cleanup.ts";
@@ -10,7 +10,8 @@ import { hostGuard, isLoopbackHost, peerIsLoopback, tokenGuard } from "./auth.ts
 import { backfill } from "../shipper/backfill.ts";
 import { removeRun } from "../db/prune.ts";
 import type { spawnStart } from "./spawn.ts";
-import { syncLocalRepos } from "./repos.ts";
+import { reconcileDeadRuns } from "./reconcile.ts";
+import { syncLocalRepos, type GhRunner } from "./repos.ts";
 import { registerRoutes } from "./routes/index.ts";
 import { legacyShim } from "./legacy/shim.ts";
 
@@ -20,11 +21,14 @@ const MAX_BODY = 1_000_000;
 const defaultUiDir = () => [join(import.meta.dir, "../../ui/dist"), join(import.meta.dir, "../ui/dist")].find((d) => existsSync(join(d, "index.html")));
 
 /** dbPath ":memory:" for tests. Migrations run here, so /ready is true as soon as this returns. uiDir overrides the built-UI location. */
-export function createApp(opts: { dbPath: string; uiDir?: string; answerDir?: string; token?: string; loopbackOnly?: boolean; repoDir?: string; startBin?: string; spawnImpl?: typeof spawnStart }) {
+export function createApp(opts: { dbPath: string; uiDir?: string; answerDir?: string; token?: string; loopbackOnly?: boolean; repoDir?: string; startBin?: string; spawnImpl?: typeof spawnStart; ghImpl?: GhRunner }) {
   const uiDir = opts.uiDir ?? defaultUiDir();
   const { db, sqlite } = openDb(opts.dbPath);
   cleanupLeakedFixtures(sqlite);
   recomputeLegacy(db);
+  reconcileDeadRuns(db);
+  const reconciler = setInterval(() => { try { reconcileDeadRuns(db); } catch { /* best effort */ } }, 60_000);
+  reconciler.unref();
   let ready = true;
   const answerDir = opts.answerDir ?? defaultAnswerDir();
   const app = new Hono();
@@ -37,7 +41,10 @@ export function createApp(opts: { dbPath: string; uiDir?: string; answerDir?: st
     await next();
   });
 
-  app.get("/health", (c) => c.json({ service: "loki-control", pid: process.pid, install_path: import.meta.dir }));
+  // version = what this process started as; installed_version = what is on disk now. They differ after an upgrade while the CP kept running.
+  const readInstalled = (): string => { for (const f of [process.env.LOKI_VERSION_FILE, join(import.meta.dir, "../../../../VERSION")]) { try { if (f) return readFileSync(f, "utf8").trim() || "unknown"; } catch { /* next */ } } return "unknown"; };
+  const startVersion = process.env.LOKI_CONTROL_VERSION || readInstalled();
+  app.get("/health", (c) => c.json({ service: "loki-control", pid: process.pid, install_path: import.meta.dir, version: startVersion, installed_version: readInstalled() }));
   app.get("/ready", (c) => {
     try { sqlite.query("select 1").get(); } catch { ready = false; }
     return ready ? c.json({ ready: true }) : c.json({ ready: false }, 503);
@@ -108,7 +115,7 @@ export function createApp(opts: { dbPath: string; uiDir?: string; answerDir?: st
   });
   // Local discovery fills local_repos (never /v1/ingest). GET /v1/repos (names only, loopback guard) is mounted by routes/index.ts.
   syncLocalRepos(db, repoDir);
-  registerRoutes({ app, act, db, repoDir, token: opts.token, peerIsLoopback, local, startBin: opts.startBin, spawnImpl: opts.spawnImpl, answerDir });
+  registerRoutes({ app, act, db, repoDir, token: opts.token, peerIsLoopback, local, startBin: opts.startBin, spawnImpl: opts.spawnImpl, ghImpl: opts.ghImpl, answerDir });
   // :id is `source:run` (run ids never contain a colon)
   app.get("/v1/runs/:id", (c) => {
     const id = c.req.param("id");
@@ -131,5 +138,5 @@ export function createApp(opts: { dbPath: string; uiDir?: string; answerDir?: st
     return new Response(Bun.file(join(root, "index.html")));
   });
 
-  return { app, db, close: () => sqlite.close() };
+  return { app, db, close: () => { clearInterval(reconciler); sqlite.close(); } };
 }
```

**File**: `packages/control-plane/src/server/ingest.ts` (modified, +6/-1)
```diff
@@ -4,7 +4,8 @@ import { validateEnvelope } from "../../../../loki-ts/src/engine10/events.ts";
 import type { EventEnvelope } from "../../../../loki-ts/src/engine10/types.ts";
 import { redactSecrets } from "../../../../loki-ts/src/util/redact.ts";
 import type { Db } from "../db/migrate.ts";
-import { events, runs, sources } from "../db/schema.ts";
+import { events, localRepos, runs, sources } from "../db/schema.ts";
+import { TEST_RUN_ID, tempRoots, underTemp } from "../db/fixture-cleanup.ts";
 import { rebuildRun } from "./runs.ts";
 
 export const MAX_EVENTS = 500;
@@ -20,6 +21,10 @@ export function ingest(db: Db, body: unknown): IngestResult {
   const sourceId = b?.source ?? b?.source_id;
   if (typeof sourceId !== "string" || !sourceId || typeof b?.run_id !== "string" || !b.run_id) return { status: 400, body: { error: "source and run_id required" } };
   const runId = b.run_id;
+  // A3b: test suites once leaked fixture runs into a real control.db. A source rooted under a temp dir, or a test run-id prefix, is never real history.
+  if (TEST_RUN_ID.test(runId)) return { status: 400, body: { error: `run_id ${runId} looks like a test fixture (e37-, e10-sig, e10-sg); refusing to ingest it` } };
+  const repoPath = db.select({ p: localRepos.realpath }).from(localRepos).where(eq(localRepos.sourceId, sourceId)).get()?.p;
+  if (repoPath && process.env.LOKI_CONTROL_ALLOW_TEMP_SOURCES !== "1" && underTemp(repoPath, tempRoots())) return { status: 400, body: { error: "source is a repo under a temp directory (a test fixture); refusing to ingest it" } };
   if (!Array.isArray(b.events) || b.events.length > MAX_EVENTS) return { status: 400, body: { error: `events must be an array of at most ${MAX_EVENTS}` } };
 
   const rows: { e: EventEnvelope; json: string; sha: string }[] = [];
```

**File**: `packages/control-plane/src/server/reconcile.ts` (added, +33/-0)
```diff
@@ -0,0 +1,33 @@
+// A3e (L6): a local run with no live worker PID, no terminal event and no new event for a grace period is shown as stopped, not "Running" forever.
+// The worker PID is the one the supervisor recorded in <run dir>/run.pid (verified by start time, never matched by name). A run whose repo is not on
+// this machine cannot be checked and is left alone. The runs row is a projection: a later event for the run rebuilds it, so a revived run recovers.
+import { realpathSync } from "node:fs";
+import { join, resolve, sep } from "node:path";
+import { and, eq, isNull } from "drizzle-orm";
+import { verifyRunPid } from "../../../../loki-ts/src/util/run_pid.ts";
+import type { Db } from "../db/migrate.ts";
+import { localRepos, runs } from "../db/schema.ts";
+
+export const STOPPED_VERDICT = "STOPPED";
+export const STOPPED_REASON = "stopped (no longer running)";
+export const STALE_GRACE_MS = 120_000;
+
+export function reconcileDeadRuns(db: Db, o: { now?: number; graceMs?: number; verify?: typeof verifyRunPid } = {}): number {
+  const now = o.now ?? Date.now(), grace = o.graceMs ?? STALE_GRACE_MS, verify = o.verify ?? verifyRunPid;
+  let n = 0;
+  for (const r of db.select().from(runs).where(isNull(runs.endedAt)).all()) {
+    const last = Date.parse(r.lastEventAt ?? r.startedAt ?? "");
+    if (Number.isNaN(last) || now - last < grace) continue;
+    const repoRow = db.select().from(localRepos).where(eq(localRepos.sourceId, r.sourceId)).get();
+    if (!repoRow) continue;
+    let repo: string;
+    try { repo = realpathSync(repoRow.realpath); } catch { continue; }
+    const root = join(repo, ".loki", "runs"), dir = resolve(root, r.runId);
+    if (!dir.startsWith(root + sep)) continue;
+    if (verify(dir, r.runId).ok) continue;
+    db.update(runs).set({ endedAt: r.lastEventAt ?? new Date(last).toISOString(), verdict: r.verdict ?? STOPPED_VERDICT })
+      .where(and(eq(runs.sourceId, r.sourceId), eq(runs.runId, r.runId), isNull(runs.endedAt))).run();
+    n++;
+  }
+  return n;
+}
```

**File**: `packages/control-plane/src/server/repos.ts` (modified, +37/-3)
```diff
@@ -1,9 +1,11 @@
 // local_repos: the server-side map from source_id to a real repo path. Filled only by local discovery (never by /v1/ingest);
 // the path never leaves the server. The API exposes display names only.
+import { execFile } from "node:child_process";
 import { basename, resolve } from "node:path";
-import type { Hono } from "hono";
+import { eq } from "drizzle-orm";
+import type { Context, Hono } from "hono";
 import type { Db } from "../db/migrate.ts";
-import { localRepos } from "../db/schema.ts";
+import { localRepos, runs } from "../db/schema.ts";
 import { discoverLocalRepos } from "../shipper/discover.ts";
 
 /** Upsert every locally discovered repo. Returns the number of repos known. */
@@ -23,7 +25,39 @@ export function repoNames(db: Db): string[] {
 }
 
 /** GET /v1/repos. `act` is the loopback-only router; `peerIsLoopback` checks the real socket address. */
-export function mountRepos(act: Hono, db: Db, peerIsLoopback: (c: Parameters<Parameters<Hono["get"]>[1]>[0]) => boolean, repoDir?: string): void {
+export type GhRunner = (argv: string[]) => Promise<{ code: number; stdout: string; stderr: string }>;
+const defaultGh: GhRunner = (argv) => new Promise((done) => {
+  execFile("gh", argv, { timeout: 15000, maxBuffer: 2_000_000, shell: false }, (err, stdout, stderr) => {
+    done({ code: err ? (typeof (err as { code?: unknown }).code === "number" ? (err as { code: number }).code : 1) : 0, stdout: String(stdout), stderr: String(stderr || (err?.message ?? "")) });
+  });
+});
+const OWNER_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}\/[A-Za-z0-9._-]{1,100}$/;
+
+/** owner/name of a registered repo (by display name), from the origin_repo its runs recorded. Null when the name is not registered or has no known origin. */
+export function registeredOwnerName(db: Db, name: string): string | null {
+  for (const r of db.select().from(localRepos).where(eq(localRepos.name, name)).all()) {
+    const o = db.select({ o: runs.originRepo }).from(runs).where(eq(runs.sourceId, r.sourceId)).all().map((x) => x.o).find((x): x is string => !!x && OWNER_NAME.test(x));
+    if (o) return o;
+  }
+  return null;
+}
+
+export function mountRepos(act: Hono, db: Db, peerIsLoopback: (c: Context) => boolean, repoDir?: string, gh: GhRunner = defaultGh): void {
+  act.get("/v1/repos/issues", async (c) => {
+    if (!peerIsLoopback(c)) return c.json({ error: "loopback only" }, 403);
+    const repo = c.req.query("repo") ?? "";
+    const ownerName = repo ? registeredOwnerName(db, repo) : null;
+    if (!ownerName) return c.json({ error: "repo is not a registered repo with a known owner/name" }, 400);
+    const r = await gh(["issue", "list", "--repo", ownerName, "--state", "open", "--json", "number,title,url", "--limit", "50"]);
+    if (r.code !== 0) return c.json({ error: `gh issue list failed: ${r.stderr.trim().slice(0, 300) || `exit ${r.code}`}` }, 502);
+    try {
+      const j = JSON.parse(r.stdout) as unknown;
+      if (!Array.isArray(j)) throw new Error("not an array");
+      const issues = j.filter((i): i is { number: number; title: string; url: string } => !!i && Number.isInteger((i as { number?: unknown }).number) && typeof (i as { title?: unknown }).title === "string" && typeof (i as { url?: unknown }).url === "string")
+        .map((i) => ({ number: i.number, title: i.title, url: i.url }));
+      return c.json({ issues });
+    } catch (e) { return c.json({ error: `gh returned unreadable output: ${(e as Error).message}` }, 502); }
+  });
   // default_repo is the folder name of the directory the service was launched from (what a run with no repo chip uses); the path itself is never sent.
   const defaultRepo = repoDir ? basename(resolve(repoDir)) || null : null;
   act.get("/v1/repos", (c) => peerIsLoopback(c) ? c.json({ repos: repoNames(db), default_repo: defaultRepo }) : c.json({ error: "loopback only" }, 403));
```

---

### Incident Patch 15: `4e57b813` (2026-10-04)
**Commit Message**: fix(cp-run): tamper outranks own-rules and reply box; no false unmeasured when no receipt was sealed (A4b)

Claude-Session: https://claude.ai/code/session_01GFNzL4TEfAXvX1KK5buE9w

**File**: `packages/control-plane/test/ui/run-truth.test.tsx` (modified, +14/-3)
```diff
@@ -14,8 +14,9 @@ const fx = (p: string) => readFileSync(join(import.meta.dir, "../fixtures/compat
 const events = (p: string) => fx(p).trim().split("\n").map((l) => JSON.parse(l));
 
 // Real server projection behind the page; receipt.json is served as the artifact file (or 404 when the CP cannot reach it, as for FireLater).
-async function serve(eventsPath: string, receiptPath: string | null, source = "abcdef0123456789") {
-  const evs = events(eventsPath);
+// unsealed drops the seal events: the committed fea1 events carry a redacted signature, so their hash chain cannot verify and the run reads as tampered.
+async function serve(eventsPath: string, receiptPath: string | null, source = "abcdef0123456789", unsealed = false) {
+  const evs = events(eventsPath).filter((e: any) => !unsealed || (e.type !== "log.sealed" && e.type !== "receipt.sealed")).map((e: any, k: number) => (unsealed ? { ...e, seq: k } : e));
   const run = evs[0].run as string;
   const { app } = createApp({ dbPath: ":memory:" });
   await app.request("/v1/ingest", { method: "POST", body: JSON.stringify({ source, run_id: run, events: evs }) });
@@ -56,7 +57,7 @@ for (const v of ["10.6.14", "10.7.1", "10.9.1", "10.10.5"]) {
 }
 
 test("fea1 (FireLater#17, receipt file out of reach): one clean Why, Needs your answer, own-rules Retry, no reply box, no false unmeasured", async () => {
-  const { source, run, posts } = await serve("10.9.1-fea1/events.jsonl", null);
+  const { source, run, posts } = await serve("10.9.1-fea1/events.jsonl", null, "abcdef0123456789", true);
   render(<RunThread source={source} run={run} />);
   await screen.findByTestId("run-thread");
   expect(screen.getByTestId("run-outcome").textContent).toBe("Needs your answer");
@@ -79,6 +80,16 @@ test("fea1 (FireLater#17, receipt file out of reach): one clean Why, Needs your
   expect(screen.getByTestId("run-pr").textContent).toContain("pull/26");
 });
 
+test("a tampered log reads Tampered in the header, never Needs your answer, and offers neither the own-rules Retry banner nor a reply box", async () => {
+  const { source, run } = await serve("10.9.1-fea1/events.jsonl", null);
+  render(<RunThread source={source} run={run} />);
+  await screen.findByTestId("run-thread");
+  expect(screen.getByTestId("run-outcome").textContent).toBe("Tampered");
+  expect(screen.queryByTestId("run-own-rules")).toBeNull();
+  expect(screen.queryByTestId("run-reply-card")).toBeNull();
+  expect(screen.getByTestId("run-why").textContent).toContain("integrity check");
+});
+
 test("a spec conflict that is not an own-rules block keeps the reply box and a clean one-sentence Why behind Show raw", async () => {
   const evs = events("10.9.1-fea1/events.jsonl").filter((e: any) => e.type !== "log.sealed" && e.type !== "receipt.sealed").map((e: any, k: number) => ({ ...e, seq: k }));
   const i = evs.findIndex((e: any) => e.type === "stage.completed" && e.stage === "implement");
```

**File**: `packages/control-plane/ui/src/pages/run/index.tsx` (modified, +6/-5)
```diff
@@ -183,7 +183,7 @@ function Evidence({ d, source, run, receipt, receiptJson, events }: { d: RunDeta
   const base = facts.base ?? (state === "read" ? null : d.diff_stat?.base ?? null), head = facts.head ?? (state === "read" ? null : d.diff_stat?.head ?? null);
   const shown = (v: string | null, n: number): string => (v ? v.slice(0, n) : factText(null, state));
   const rv = facts.verdict ?? d.receipt?.verdict ?? null;
-  const sig = !d.receipt ? UNMEASURED : !d.receipt.signed ? "unsigned" : d.sig_checked ? "signed, signature checked" : "signed, signature not checked";
+  const sig = !d.receipt ? "no receipt sealed in the run's events" : !d.receipt.signed ? "unsigned" : d.sig_checked ? "signed, signature checked" : "signed, signature not checked";
   const ck = facts.checks;
   return (
     <Section title="Evidence and receipt" testid="run-receipt" meta={sha ? `sha256 ${sha.slice(0, 16)}` : "no receipt"}>
@@ -198,7 +198,7 @@ function Evidence({ d, source, run, receipt, receiptJson, events }: { d: RunDeta
       <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
         <Button variant="secondary" size="sm" data-testid="run-verify" disabled={!sha || v.busy} onClick={() => void go()}><ShieldCheck size={13} aria-hidden="true" /> {v.busy ? "Verifying" : "Verify"}</Button>
         <Button variant="ghost" size="sm" data-testid="receipt-raw-toggle" aria-pressed={showRaw} onClick={() => setShowRaw((x) => !x)}>{showRaw ? "Hide raw" : "Show raw"}</Button>
-        {!sha ? <span style={{ color: "var(--cp-text-muted)" }}>No receipt to verify {UNMEASURED}.</span> : null}
+        {!sha ? <span style={{ color: "var(--cp-text-muted)" }}>No receipt to verify.</span> : null}
         {v.res ? <span data-testid="run-verify-result" role="status"><OutcomeBadge verdict={v.res.verdict} /> {stripAnsi(v.res.reasons[0] ?? "")}</span> : null}
         {v.error ? <span role="alert" data-testid="run-verify-error" style={{ color: "var(--cp-error-ink)" }}>{v.error}</span> : null}
       </div>
@@ -285,12 +285,13 @@ export function RunThread({ source, run, slot, renderSlot }: { source: string; r
   if (!d) return <Spinner label="Loading run" />;
 
   const title = d.title ?? d.issue_ref ?? d.origin_repo ?? `Title ${UNMEASURED}`;
-  const blocked = !!d.blocked_question;
+  const tamperedRun = !!d.verdict && runOutcome(d).label === "Tampered";
+  const blocked = !!d.blocked_question && !tamperedRun;
   const running = d.status === "running" || (d.verdict === null && !d.ended_at);
   const prog = stageProgress(d.stages);
   const why = running ? null : whyForRun(d);
   const whyRawText = why ? rawWhy(events) : null;
-  const ownRules = !running && d.own_rules_block === true;
+  const ownRules = !running && !tamperedRun && d.own_rules_block === true;
   const canRetry = !running && !!d.issue_ref;
   const doOwnRetry = async () => {
     setOwnRetry({ busy: true });
@@ -333,7 +334,7 @@ export function RunThread({ source, run, slot, renderSlot }: { source: string; r
         </div>
       ) : null}
 
-      {d.blocked_question && !ownRules ? <ReplyPrompt source={source} run={run} question={stripAnsi(d.blocked_question)} onSent={load} /> : null}
+      {blocked && !ownRules && d.blocked_question ? <ReplyPrompt source={source} run={run} question={stripAnsi(d.blocked_question)} onSent={load} /> : null}
 
       <div data-testid="run-summary" style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 440px), 1fr))", alignItems: "start" }}>
         <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
```

#### Recent Merged Pull Requests:
- **PR #222** (2026-10-02): docs(overview): update for 10.6.7 (@asklokesh)
- **PR #221** (2026-10-02): docs: one v10 overview page replaces docs/walkthrough (@asklokesh)
- **PR #220** (2026-10-02): docs(walkthrough): Loki Mode at a glance (features, architecture, plain words) (@asklokesh)
- **PR #219** (2026-10-01): docs: sweep stale and legacy content to match v10.6.6 (@asklokesh)
- **PR #216** (2026-09-26): v10 M0: moat suite (Linux CI validation) (@asklokesh)
- **PR #196** (closed): fix(plugin): drop the duplicate hooks declaration from the manifest (@robert-clayton)
- **PR #194** (2026-08-16): feat: ship issue-to-PR harness and execution cockpit (@asklokesh)
- **PR #193** (closed): docs: add OrcaRouter as a gateway covering both routes (@Marc-oss-hub)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
