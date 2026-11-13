> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/agentes-chat-agentes-chat-learnings.md`  
> **Source**: github ([https://github.com/agentes-chat/agentes-chat](https://github.com/agentes-chat/agentes-chat))  
> **Source Version**: `2556f336`  
> **License**: AGPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-13T03:18:36.596Z  
> **Learning ID**: `learn-github-agentes-chat-agentes-chat`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): agentes-chat/agentes-chat

> **Canonical Artifact**: `07_PROJECT_LEARNING/agentes-chat-agentes-chat-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/agentes-chat/agentes-chat](https://github.com/agentes-chat/agentes-chat))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-13T03:18:36.411Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `agentes-chat/agentes-chat`
- **Description**: Open-source, self-hosted Slack alternative where your team and AI agents work together in channels and DMs. Agents run on Claude, ChatGPT/Codex, Gemini or Grok, with MCP tools, their own computer and browser, routines, memory and approvals. Web, desktop and phone apps. Docker Compose + Postgres. AGPL-3.0.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 1216 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/desktop/src-tauri/src/window_state.rs`
```
//! The main window as the person left it: size, place, maximized and zoom, kept between launches in
//! `window.json` (the app's config folder). Saved as it moves and resizes (at most every half second), when it
//! is closed and when the app quits.

use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

#[derive(Debug, Default, Clone, Serialize, Deserialize, PartialEq)]
pub struct Saved {
    /// Logical points of the window's frame.
    pub x: Option<f64>,
    pub y: Option<f64>,
    pub width: Option<f64>,
    pub height: Option<f64>,
    #[serde(default)]
    pub maximized: bool,
    /// Index into the zoom steps (menus.rs).
    pub zoom: Option<usize>,
}

/// When the frame was last written: moving the window sends many events.
#[derive(Default)]
pub struct LastSaved(Mutex<Option<Instant>>);

const EVERY: Duration = Duration::from_millis(500);

fn file(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_config_dir().ok().map(|dir| dir.join("window.json"))
}

pub fn load(app: &AppHandle) -> Saved {
    file(app)
        .and_then(|path| std::fs::read(path).ok())
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
        .unwrap_or_default()
}

fn write(app: &AppHandle, saved: &Saved) {
    let Some(path) = file(app) else { return };
    if let Some(dir) = path.parent() {
        let _ = std::fs::create_dir_all(dir);
    }
    if let Ok(bytes) = serde_json::to_vec(saved) {
        let _ = std::fs::write(path, bytes);
    }
}

/// Changes what is saved (read, change, write).
pub fn update(app: &AppHandle, change: impl FnOnce(&mut Saved)) {
    let mut saved = load(app);
    let before = saved.clone();
    change(&mut saved);
    if saved != before {
        write(app, &saved);
    }
}

/// The frame as it is now. Full screen or minimized frames aren't kept (the window comes back as it was
/// before); a maximized one keeps its last normal frame. `throttle`: at most every half second.
pub fn remember(window: &tauri::Window, throttle: bool) {
    let app = window.app_handle();
    if throttle {
        let last = app.state::<LastSaved>();
        let mut at = last.0.lock().unwrap_or_else(|e| e.into_inner());
        if at.is_some_and(|t| t.elapsed() < EVERY) {
            return;
        }
        *at = Some(Instant::now());
    }
    if crate::main_window::in_full_screen(window) || window.is_minimized().unwrap_or(false) {
        return;
    }
    let maximized = window.is_maximized().unwrap_or(false);
    let scale = window.scale_factor().unwrap_or(1.0);
    let (Ok(position), Ok(size)) = (window.outer_position(), window.inner_size()) else { return };
    update(app, |saved| {
        saved.maximized = maximized;
        if !maximized {
            saved.x = Some(f64::from(position.x) / scale);
            saved.y = Some(f64::from(position.y) / scale);
            saved.width = Some(f64::from(size.width) / scale);
            saved.height = Some(f64::from(size.height) / scale);
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn saved_reads_back_and_tolerates_missing_fields() {
        let saved = Saved { x: Some(10.0), y: Some(20.0), width: Some(1200.0), height: Some(780.0), maximized: true, zoom: Some(4) };
        let json = serde_json::to_vec(&saved).unwrap();
        assert_eq!(serde_json::from_slice::<Saved>(&json).unwrap(), saved);
        assert_eq!(serde_json::from_slice::<Saved>(b"{}").unwrap(), Saved::default());
    }
}

```

### Core Architecture Module: `apps/desktop/src/hooks.ts`
```
import type { ControlAgent } from "@agenteschat/adapters/runner-control";
import type { WifiIphone } from "@agenteschat/client";
import { WIFI_IPHONES_POLL_MS } from "@agenteschat/client/lib/devices";
import { useCallback, useEffect, useRef, useState } from "react";
import { useHost } from "./app";
import { siteApi } from "./control/devices";
import { type LocalServerStatus, NO_SERVER, type Tailnet } from "./control/local-server";
import type { ServerWorkspaces } from "./control/server";
import type { Home } from "./control/store";
import {
  CHECK_EVERY_MS,
  type LatestRelease,
  latestUrl,
  parseLatest,
  type UpdateState,
  updateStateOf,
} from "./control/version";
import type { AppInfo, WindowName } from "./host/types";

/**
 * The iPhones on this Mac's Wi-Fi that trust it, from its server (`GET …/wifi-iphones`, for who may manage the Mac),
 * asked every `WIFI_IPHONES_POLL_MS` while `on`. `pick` picks one (and throws what the server said); `using` is the one
 * being picked.
 */
export function useWifiIphones(
  at: { server: string | null; orgId: string | null; machineId: string | null },
  on: boolean,
) {
  const host = useHost();
  const { server, orgId, machineId } = at;
  const [available, setAvailable] = useState<WifiIphone[]>([]);
  const [using, setUsing] = useState<string | null>(null);
  useEffect(() => {
    if (!on || !server || !orgId || !machineId) {
      setAvailable([]);
      return;
    }
    let live = true;
    const ask = () =>
      siteApi(host, server)
        .devices.wifiIphones(orgId, machineId)
        .then((r) => live && setAvailable(r.available))
        .catch(() => live && setAvailable([]));
    void ask();
    const timer = setInterval(() => void ask(), WIFI_IPHONES_POLL_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [host, server, orgId, machineId, on]);
  const pick = async (serial: string) => {
    if (!server || !orgId || !machineId) return;
    setUsing(serial);
    try {
      setAvailable((await siteApi(host, server).devices.pickIphoneOverWifi(orgId, machineId, serial)).available);
    } finally {
      setUsing(null);
    }
  };
  return { available, pick, using };
}

/** The app's version and the Mac's arch (from the shell). */
export function useAppInfo(): AppInfo | null {
  const host = useHost();
  const [info, setInfo] = useState<AppInfo | null>(null);
  useEffect(() => {
    let live = true;
    host
      .appInfo()
      .then((i) => live && setInfo(i))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [host]);
  return info;
}

export interface UpdateCheck {
  state: UpdateState;
  checkedAt: number | null;
  checking: boolean;
  failed: boolean;
  check: () => Promise<UpdateState | null>;
  version: string | null;
}

/**
 * The "Versão nova" check against our server (ADR 0036 §9). `auto`: at start and every 6 hours
 * (the popover window, which owns the tray icon); otherwise only when asked (Preferences).
 */
export function useUpdateCheck(auto: boolean): UpdateCheck {
  const info = useAppInfo();
  const [latest, setLatest] = useState<LatestRelease | null>(null);
  const [checkedAt, setCheckedAt] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const [failed, setFailed] = useState(false);
  const version = info?.version ?? null;
  const arch = info?.arch ?? null;
  const os = info?.os ?? null;

  const check = useCallback(async (): Promise<UpdateState | null> => {
    if (!version || !arch || !os) return null;
    setChecking(true);
    setFailed(false);
    // A check that hasn't answered in 15 s failed. A timer, not `AbortSignal.timeout`, which macOS 11's WebKit lacks.
    const quit = new AbortController();
    const timer = setTimeout(() => quit.abort(), 15_000);
    try {
      const res = await fetch(latestUrl(os, arch), { headers: { accept: "application/json" }, signal: quit.signal });
      // 404: no release published yet (or the server can't read them): nothing to offer.
      const found = res.ok ? parseLatest(await res.json()) : null;
      if (!res.ok && res.status !== 404) throw new Error(String(res.status));
      setLatest(found);
      setCheckedAt(Date.now());
      return updateStateOf(version, found);
    } catch {
      setFailed(true);
      return null;
    } finally {
      clearTimeout(timer);
      setChecking(false);
    }
  }, [version, arch, os]);

  useEffect(() => {
    if (!auto || !version) return;
    void check();
    const timer = setInterval(() => void check(), CHECK_EVERY_MS);
    return () => clearInterval(timer);
  }, [auto, version, check]);

  return { state: updateStateOf(version ?? "0.0.0", latest), checkedAt, checking, failed, check, version };
}

/** The server here (`local_server.rs`), kept current. */
export function useLocalServer(): LocalServerStatus {
  const host = useHost();
  const [local, setLocal] = useState<LocalServerStatus>(NO_SERVER);
  useEffect(() => {
    let live = true;
    host
      .localServer()
      .then((s) => live && setLocal(s))
      .catch(() => {});
    const off = host.onLocalServer(setLocal);
    return () => {
      live = false;
      off();
    };
  }, [host]);
  return local;
}

/** Every server's workspaces as the app last read them, again whenever they change. */
export function useWorkspaces(): ServerWorkspaces[] {
  const host = useHost();
  const [list, setList] = useState<ServerWorkspaces[]>([]);
  useEffect(() => {
    let live = true;
    const read = () =>
      void host
        .workspaces()
        .then((l) => live && setList(l))
        .catch(() => {});
    read();
    const off = host.onWorkspaces(read);
    return () => {
      live = false;
      off();
    };
  }, [host]);
  return list;
}

/**
 * What Tailscale is doing on this computer, read again each time the window comes to the front (the person may
 * have just connected it). Null until the first read answers, which can take a couple of seconds: guessing a state
 * before that would show its line, then take it back.
 */
export function useTailnet(): Tailnet | null {
  const host = useHost();
  const [tailnet, setTailnet] = useState<Tailnet | null>(null);
  useEffect(() => {
    const read = () =>
      void host
        .tailscale()
        .then(setTailnet)
        .catch(() => setTailnet({ state: "missing" }));
    read();
    window.addEventListener("focus", read);
    return () => window.removeEventListener("focus", read);
  }, [host]);
  return tailnet;
}

/** Runs `fn` whenever the shell brings this window up. */
export function useOnShown(name: WindowName, fn: () => void) {
  const host = useHost();
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(
    () =>
      host.onShown((shown) => {
        if (shown === name) ref.current();
      }),
    [host, name],
  );
}

/** The agent's look from its organization's agents list (jobs and requests carry only id and name). */
export function agentOf(home: Home | undefined, agent: { id: string; name: string }): ControlAgent {
  const known = home?.status?.agents.find((a) => a.id === agent.id);
  return known ?? { id: agent.id, handle: agent.name.toLowerCase(), name: agent.name };
}

/** A small per-viewer preference kept in the web view's storage (survives restarts). */
export function usePref<T>(key: string, fallback: T): [T, (value: T) => void] {
  const read = (): T => {
    try {
      const raw = localStorage.getItem(`agentes.desktop.${key}`);
      return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  };
  const [value, setValue] = useState<T>(read);
  const set = useCallback(
    (v: T) => {
      setValue(v);
      try {
        localStorage.setItem(`agentes.desktop.${key}`, JSON.stringify(v));
      } catch {
        // Not kept; still applies now.
      }
    },
    [key],
  );
  return [value, set];
}

export function readPref<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`agentes.desktop.${key}`);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writePref<T>(key: string, value: T) {
  try {
    localStorage.setItem(`agentes.desktop.${key}`, JSON.stringify(value));
  } catch {
    // ignore
  }
}

/**
 * The action running now, by name: its button shows `loading` and no other starts until it ends, so a second press
 * never sends it twice. Each action says its own errors.
 */
export function usePending<K extends string>() {
  const [pending, setPending] = useState<K | null>(null);
  const running = useRef(false);
  const run = useCallback(async (key: K, action: () => Promise<unknown>) => {
    if (running.current) return;
    running.current = true;
    setPending(key);
    try {
      await action();
    } finally {
      running.current = false;
      setPending(null);
    }
  }, []);
  return [pending, run] as const;
}

```

### Core Architecture Module: `apps/mobile/src/features/dashboards/hooks.ts`
```
import {
  type Dashboard,
  frozenBoard,
  useDashboard,
  useHomeDashboard,
  useRoles,
  type Widget,
  widgetFailureText,
  widgetWaiting,
  widgetWaitText,
} from "@agenteschat/client";
import { relativeTime } from "@agenteschat/client/lib/format";
import { maySetAgentAi, noAiLockedLine, planKeyIntent } from "@agenteschat/client/lib/no-ai";
import { isEveryone, sortRoles } from "@agenteschat/client/lib/roles";
import type { AgentColorName } from "@agenteschat/ui/agent/engine";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useOrg } from "@/providers/org";
import { openConnectAi } from "../ai/NoAiCard";
import { usePlanHold } from "../ai/parts";
import { useDirectory, useMeId, useNow, useOrgId } from "../shared/hooks";
import { agentLook } from "../shared/logic";
import { HOME } from "./logic";

/** An agent's name and color by id (one that left the team keeps its look on what it made). */
export function useAgentLook(agentId: string | null | undefined): { name: string; color: AgentColorName } {
  const dir = useDirectory();
  const agent = agentId ? dir.anyAgent(agentId) : undefined;
  return { name: agent?.name ?? "", color: agentLook(agent).color };
}

/**
 * A board by id, or My Home (`home`): made the first time it is opened. In a workspace being deleted it offers no
 * change (`frozenBoard`), as on the web.
 */
export function useBoard(id: string): {
  board: Dashboard | undefined;
  loading: boolean;
  failed: boolean;
  refetch: () => Promise<unknown>;
} {
  const { orgId, org } = useOrg();
  const home = useHomeDashboard(orgId, id === HOME);
  const one = useDashboard(orgId, id === HOME ? null : id);
  const q = id === HOME ? home : one;
  return {
    board: q.data && frozenBoard(q.data, org),
    loading: q.isLoading,
    failed: q.isError && !q.data,
    refetch: q.refetch,
  };
}

/** The workspace's own roles (not "everyone"), top first: Share's chips and a board's line. */
export function useCustomRoles() {
  const roles = useRoles(useOrgId());
  return useMemo(() => sortRoles((roles.data?.roles ?? []).filter((r) => !isEveryone(r))), [roles.data]);
}

/**
 * What a widget says about itself: why it didn't update, what its refresh waits for ("Waiting for Theo's plan to reset
 * at 13:00", "" when nothing does), and when it last updated ("12 min ago"). `now` moves on every minute, so a wait
 * reads as over once its reset passes, and room on the computer is said once it waited long enough.
 */
export function useWidgetWords() {
  const { t, i18n } = useTranslation();
  const dir = useDirectory();
  const now = useNow(60_000);
  const failure = useCallback(
    (w: Pick<Widget, "failure" | "agentId">) => {
      if (!w.failure) return "";
      const name = dir.anyAgent(w.agentId)?.name ?? "";
      return widgetFailureText(t, w.failure, name);
    },
    [t, dir],
  );
  const wait = useCallback(
    (w: Pick<Widget, "status" | "agentId"> & { wait?: Widget["wait"] }) => {
      const waiting = widgetWaiting({ status: w.status, wait: w.wait ?? null }, now);
      const name = dir.anyAgent(w.agentId)?.name ?? "";
      return waiting ? widgetWaitText(t, i18n.language, waiting, name, new Date(now)) : "";
    },
    [t, i18n.language, dir, now],
  );
  const ago = useCallback((iso: string) => relativeTime(t, i18n.language, iso, new Date(now)), [t, i18n.language, now]);
  return { failure, wait, ago, now, locale: i18n.language };
}

/**
 * What a widget waiting for an AI offers this person (its screen, its card's footer, New widget's test), as the web's:
 * Connect to whoever may set its agent's AI (for the right hand the workspace's, which a build falls back to when the
 * AI of whoever made the widget can't think; on a plan that can't take it, `reason` a plan line, a key:
 * `planKeyIntent`), else who can. Nothing on a billing hold: an AI comes after the plan.
 */
export function useWidgetAiWay(
  agentId: string | null | undefined,
  reason?: string | null,
): { connect: () => void } | { locked: string } | null {
  const { t } = useTranslation();
  const { orgId, org } = useOrg();
  const dir = useDirectory();
  const meId = useMeId();
  const hold = usePlanHold(orgId, org);
  const agent = agentId ? dir.agentById.get(agentId) : undefined;
  if (!agent || hold) return null;
  if (maySetAgentAi(agent, meId, org))
    return { connect: () => openConnectAi({ agentId: agent.id, ...planKeyIntent(agent, reason) }) };
  const owner = agent.ownerUserId ? dir.memberById.get(agent.ownerUserId)?.name : null;
  return { locked: noAiLockedLine(t, agent.name, owner) };
}

```

### Core Architecture Module: `apps/mobile/src/features/queue/QueueSheet.tsx`
```
import {
  type ComputerQueue,
  type QueueWaiting,
  type QueueWorking,
  useChannels,
  useDms,
  useMachineQueue,
  useMachines,
} from "@agenteschat/client";
import {
  durationText,
  nthText,
  type QueueNames,
  type QueueRow,
  queueAllStartedText,
  queueButtonText,
  queueFillText,
  queueLeftText,
  queuePurposeText,
  queueStartText,
  queueStatusText,
  queueView,
  queueWhereText,
} from "@agenteschat/client/lib/computer-queue";
import { type ReactNode, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeOut, LayoutAnimationConfig, LinearTransition } from "react-native-reanimated";
import { Button, CHROME_MAX_SCALE, Chip, Count, Icon, type IconName, PressScale, Text, useReducedMotion } from "@/ui";
import { router } from "@/ui/navigation";
import { useComputerSays, useWatchableComputer } from "../chat/DmComputerButton";
import { openComputer } from "../computer/AgentComputerRow";
import { AgentFace, OpensAgent } from "../shared/Face";
import { useColors, useDirectory, useMeId, useNow, useOrgId } from "../shared/hooks";
import { SheetTitle } from "../shared/PromptForm";
import { useSheet } from "../shared/SheetHost";
import { useStopper } from "../task-manager/hooks";
import { StopButton } from "../task-manager/parts";
import { machineOfAgents, queuePlace } from "./logic";

/** The line of the computer these agents share (the first one's), live; nothing while none has a computer. */
export function useAgentsQueue(agentIds: readonly string[]) {
  const orgId = useOrgId();
  const machines = useMachines(orgId);
  const machineId = machineOfAgents(machines.data, agentIds);
  const queue = useMachineQueue(orgId, machineId);
  return { machineId, queue: queue.data ?? null };
}

/** Opens a computer's line in the screen's sheet, over the conversation; `computer` adds the way on to it. */
export function useOpenQueue() {
  const sheet = useSheet();
  return useCallback(
    (machineId: string, computer?: OpenComputerProps) =>
      sheet.open(<QueueSheet machineId={machineId} computer={computer} />),
    [sheet],
  );
}

/**
 * The conversation bar's way into the line while turns wait for the computer: the waiting icon with how many wait.
 * The bar sits outside the screen's sheet host, so the screen opens the sheet (`onPress`).
 */
export function QueueButton({
  queue,
  onPress,
  icon = "wait",
  says = "",
}: {
  queue: ComputerQueue;
  onPress: () => void;
  icon?: IconName;
  /** The agent's computer state a screen reader hears too (`useComputerSays`). */
  says?: string;
}) {
  const { t } = useTranslation();
  const c = useColors();
  return (
    <PressScale
      to={0.9}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={says ? `${queueButtonText(t, queue)}, ${says}` : queueButtonText(t, queue)}
      hitSlop={4}
      style={styles.button}
    >
      {/* The count beside the icon, as the tasks' button beside it: a badge on a 20 pt icon covered it. */}
      <View style={styles.counted}>
        <Icon name={icon} size={18} color={c.ink2} />
        <Count value={queue.waiting.length} size={15} color={c.ink2} max={99} />
      </View>
    </PressScale>
  );
}

/** An agent's DM header while turns wait: the laptop with the count, saying what its computer says. */
export function DmQueueButton({ agentId, ...props }: { agentId: string; queue: ComputerQueue; onPress: () => void }) {
  return <QueueButton {...props} icon="laptop" says={useComputerSays(agentId)} />;
}

/**
 * A computer's line, as on the web's dialog: how full it is and when the next starts, "Working now" (every turn
 * running: what for, where, for how long, the time left) and "In line" (the order, who asked, the estimated start;
 * my own request marked "You go first"), and the rule that keeps it. What a turn is for, never its content; a row
 * opens its task and stops it for who may.
 */
export function QueueSheet({ machineId, computer }: { machineId: string; computer?: OpenComputerProps }) {
  const { t } = useTranslation();
  const c = useColors();
  const orgId = useOrgId();
  const meId = useMeId();
  const q = useMachineQueue(orgId, machineId);
  const now = useNow(30_000);
  const words = useQueueWords();
  const { stopping, stop } = useStopper();
  const sheet = useSheet();
  const act: RowActions = {
    stopping,
    stop: (runId) => stop([runId], undefined, true),
    open: (runId) => {
      sheet.close();
      router.push(`/task-manager/${runId}` as const);
    },
  };
  const reduced = useReducedMotion();
  if (!q.data) {
    return q.isError ? (
      <Text tone="muted">{t("mobile.app.failed")}</Text>
    ) : (
      <ActivityIndicator color={c.muted} style={styles.loading} />
    );
  }
  const view = queueView(q.data, meId ?? "");
  const allStarted = queueAllStartedText(t, view, now);
  const fill = queueFillText(t, view.working);
  // A turn that starts or ends while the sheet shows fades and the line closes up; the first look just shows.
  const motion = reduced ? {} : { entering: ROW_IN, exiting: ROW_OUT, layout: LinearTransition };
  return (
    <>
      <View accessible accessibilityRole="header" accessibilityLabel={t("queue.label", { name: q.data.name })}>
        <SheetTitle title={q.data.name} subtitle={queueStatusText(t, view, now)} />
      </View>
      <View style={styles.group}>
        <GroupHead title={t("queue.workingNow", { n: view.working.length })} />
        {fill ? (
          <Text variant="small" tone="ink2">
            {fill}
          </Text>
        ) : null}
        {view.working.length === 0 ? (
          <Text variant="small" tone="muted">
            {t("queue.nothingWorking")}
          </Text>
        ) : (
          <LayoutAnimationConfig skipEntering skipExiting>
            <View style={styles.rows}>
              {view.working.map((w) => (
                <Animated.View key={w.runId} {...motion}>
                  <WorkingRow row={w} words={words} now={now} act={act} />
                </Animated.View>
              ))}
            </View>
          </LayoutAnimationConfig>
        )}
      </View>
      {view.waiting.length > 0 ? (
        <View style={[styles.group, styles.nextGroup, { borderTopColor: c.line }]}>
          <GroupHead title={t("queue.inLine", { n: view.waiting.length })} aside={allStarted} />
          <LayoutAnimationConfig skipEntering skipExiting>
            <View style={styles.rows}>
              {view.waiting.map((w) => (
                <Animated.View key={w.runId} {...motion}>
                  <WaitingRow row={w} words={words} now={now} act={act} />
                </Animated.View>
              ))}
            </View>
          </LayoutAnimationConfig>
        </View>
      ) : null}
      <Text variant="caption" tone="faint" style={styles.rule}>
        {t("queue.rule")}
      </Text>
      {computer ? <OpenComputer {...computer} /> : null}
    </>
  );
}

interface OpenComputerProps {
  agentId: string;
  /** The conversation keeps its place before the computer covers it. */
  onOpen?: () => void;
}

/** "Open the computer", for whoever may watch the agent's computer (as the DM header's own button). */
function OpenComputer({ agentId, onOpen }: OpenComputerProps) {
  const { t } = useTranslation();
  const sheet = useSheet();
  if (!useWatchableComputer(agentId)) return null;
  return (
    <Button
      variant="secondary"
      size="sm"
      icon="laptop"
      label={t("queue.openComputer")}
      onPress={() => {
        sheet.close();
        onOpen?.();
        openComputer(agentId);
      }}
    />
  );
}

/** Names and places as this person knows them: agents and people by name, conversations they can see. */
function useQueueWords() {
  const { t } = useTranslation();
  const orgId = useOrgId();
  const meId = useMeId();
  const dir = useDirectory();
  const channels = useChannels(orgId);
  const dms = useDms(orgId);
  return useMemo(() => {
    const names: QueueNames = {
      viewerId: meId ?? "",
      agent: (id) => dir.anyAgent(id)?.name,
      person: (id) => dir.memberById.get(id)?.name,
    };
    return {
      names,
      agentName: (id: string) => names.agent(id) ?? t("channel.unknownAgent"),
      line: (r: QueueWorking | QueueWaiting) =>
        [queuePurposeText(t, r.purpose, names), queueWhereText(t, queuePlace(r.where, channels.data, dms.data))].join(
          " · ",
        ),
    };
  }, [t, meId, dir, channels.data, dms.data]);
}

type Words = ReturnType<typeof useQueueWords>;

/** What a row does for who may: opens its task, stops it. */
interface RowActions {
  stopping: ReadonlySet<string>;
  stop: (runId: string) => void;
  open: (runId: string) => void;
}

function GroupHead({ title, aside }: { title: string; aside?: string | null }) {
  return (
    <View style={styles.head}>
      <Text variant="small" tone="ink" accessibilityRole="header" style={styles.headTitle}>
        {title}
      </Text>
      {aside ? (
        <Text variant="caption" tone="faint" numberOfLines={1} maxFontSizeMultiplier={CHROME_MAX_SCALE}>
          {aside}
        </Text>
      ) : null}
    </View>
  );
}

/** A line of the sheet with its stop beside it. */
function ActiveLine({
  row,
  act,
  children,
}: {
  row: { runId: string; canStop?: boolean };
  act: RowActions;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.active}>
      <View style={styles.grow}>{children}</View>
      {row.canStop ? (
        <StopButton
          label={t("taskManager.actions.stop")}
          stopping={act.stopping.has(row.runId)}
          onPress={() => act.stop(row.runId)}
        />
      ) : null}
    </View>
  );
}

function WorkingRow({
  row: w,
  words,
  now,
  act,
}: {
  row: QueueRow<QueueWorking>;
  words: Words;
  now: number;
  act: RowActions;
}) {
  const { t } = useTranslation();
  const elapsed = duratio
```

### Core Architecture Module: `apps/mobile/src/features/queue/UsageQueueSheet.tsx`
```
import { type UsageQueueClosedRow, type UsageQueueRow, useCancelUsageQueue, useUsageQueue } from "@agenteschat/client";
import { relativeTime } from "@agenteschat/client/lib/format";
import { agentGrammar } from "@agenteschat/client/lib/grammar";
import {
  usageQueueResuming,
  usageQueueShared,
  usageQueueSkippedWhere,
  usageQueueSkipReason,
  usageQueueStoppable,
  usageQueueTitle,
  usageQueueWhere,
  usageQueueWho,
} from "@agenteschat/client/lib/usage-queue";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Button, EmptyState, PixelOrbit, Segmented, Text } from "@/ui";
import { router } from "@/ui/navigation";
import { openAgentAi } from "../ai/AgentAiScreen";
import { AnswerAnywayButton, DontRunButton } from "../ai/UsagePauseCard";
import { chatHref } from "../links/logic";
import { useFailed } from "../routines/hooks";
import { AgentFace, OpensAgent } from "../shared/Face";
import { useColors, useDirectory, useMeId, useNow, useOrgId } from "../shared/hooks";
import { agentLook } from "../shared/logic";
import { SheetTitle } from "../shared/PromptForm";
import { useSheetIfAny } from "../shared/SheetHost";

/** The sheet's two lists: what it picks up when the limit is back, and what it skipped as already handled. */
export type UsageQueueTab = "queued" | "skipped";

/**
 * An agent's line of work waiting on its plan or budget (ADR 0118), the web's dialog as a sheet: its face asleep and
 * when it is back as the title, one short row per conversation in the order it picks them up ("Não rodar" where the
 * viewer may use it, "Não rodar nenhuma" and "Change its AI" for its owner and admins) and, behind a switch, what it
 * skipped as already handled (ADR 0136). Opened from its profile's out-of-office line and its waiting note; `tab`
 * "skipped" from a skip.
 */
export function UsageQueueSheet({ agentId, tab: initialTab = "queued" }: { agentId: string; tab?: UsageQueueTab }) {
  const { t, i18n } = useTranslation();
  const orgId = useOrgId();
  const dir = useDirectory();
  const c = useColors();
  const now = useNow(60_000);
  const q = useUsageQueue(orgId, agentId);
  const [chosen, setChosen] = useState<UsageQueueTab>(initialTab);
  const agent = dir.anyAgent(agentId)?.name ?? t("channel.unknownAgent");
  if (!q.data)
    return q.isError ? (
      <View style={styles.failed}>
        <Text variant="small" tone="muted">
          {t("mobile.app.failed")}
        </Text>
        <Button variant="secondary" size="sm" label={t("common.retry")} onPress={() => void q.refetch()} />
      </View>
    ) : (
      <ActivityIndicator color={c.muted} style={styles.loading} />
    );
  const queue = q.data;
  const waiting = queue.rows.length + queue.hidden;
  const skipped = queue.closed.length;
  // The switch only when both lists have something: otherwise the one that does.
  const tab: UsageQueueTab = waiting === 0 ? "skipped" : skipped === 0 ? "queued" : chosen;
  const shared = usageQueueShared(
    t,
    queue.plan,
    queue.sharedWith.flatMap((id) => dir.anyAgent(id)?.name ?? []),
  );
  const resuming = usageQueueResuming(queue);
  const queuedList = (
    <>
      <View>
        {queue.rows.map((row, i) => (
          <WaitingRow key={row.runId} n={i + 1} row={row} agentId={agentId} now={now} />
        ))}
        {queue.hidden > 0 ? (
          <Text variant="footnote" tone="faint" style={styles.hidden}>
            {t("usageQueue.hidden", { count: queue.hidden })}
          </Text>
        ) : null}
      </View>
      {queue.mayStopAll ? (
        <View style={styles.owner}>
          {usageQueueStoppable(queue) > 0 ? <StopAll agentId={agentId} count={usageQueueStoppable(queue)} /> : null}
          <View style={styles.ghostActs}>
            <Button
              variant="ghost"
              size="sm"
              label={t("usageQueue.switchAi", agentGrammar(agent))}
              onPress={() => openAgentAi(agentId)}
            />
          </View>
        </View>
      ) : null}
    </>
  );
  const skippedList = (
    <View>
      {queue.closed.map((row) => (
        <SkippedRow key={row.runId} row={row} agentId={agentId} now={now} />
      ))}
    </View>
  );
  return (
    <>
      <SheetTitle
        // Asleep while it waits on the limit, at work once it picks up.
        leading={
          <OpensAgent agentId={agentId}>
            <AgentFace agentId={agentId} size={32} mode={resuming ? "run" : queue.reason ? "sleep" : "idle"} />
          </OpensAgent>
        }
        title={usageQueueTitle(t, i18n.language, agent, queue, new Date(now))}
        hint={shared || undefined}
      />
      {waiting > 0 && skipped > 0 ? (
        <Segmented
          wide
          value={tab}
          onChange={(key) => setChosen(key as UsageQueueTab)}
          items={[
            { key: "queued", label: t("usageQueue.queuedTab"), count: waiting },
            { key: "skipped", label: t("usageQueue.skippedTab"), count: skipped },
          ]}
        />
      ) : null}
      {waiting === 0 && skipped === 0 ? (
        <EmptyState size="inline" title={t("usageQueue.empty")} />
      ) : waiting > 0 && skipped > 0 ? (
        <SameHeight
          shown={tab === "queued" ? queuedList : skippedList}
          other={tab === "queued" ? skippedList : queuedList}
        />
      ) : tab === "queued" ? (
        queuedList
      ) : (
        skippedList
      )}
    </>
  );
}

/**
 * The list shown, with the other laid out unseen under it: the sheet keeps the taller one's height, so its top stays
 * put between the two lists.
 */
function SameHeight({ shown, other }: { shown: ReactNode; other: ReactNode }) {
  const [minHeight, setMinHeight] = useState(0);
  return (
    <View style={[styles.lists, { minHeight }]}>
      {shown}
      <View
        style={[styles.lists, styles.unseen]}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        onLayout={(e) => setMinHeight(e.nativeEvent.layout.height)}
      >
        {other}
      </View>
    </View>
  );
}

/** The conversation at the message, with the sheet closed. */
function useOpenConversation() {
  const sheet = useSheetIfAny();
  return (row: { channelId: string; threadId: string | null; messageId: string }) => {
    sheet?.close();
    router.push(chatHref(row.channelId, row.threadId, row.messageId));
  };
}

/** "1 #suporte · Ana e Bruno · há 40 min", then "Não rodar" where the viewer may, or "Respondendo". */
function WaitingRow({ n, row, agentId, now }: { n: number; row: UsageQueueRow; agentId: string; now: number }) {
  const { t, i18n } = useTranslation();
  const meId = useMeId() ?? "";
  const dir = useDirectory();
  const open = useOpenConversation();
  const person = (id: string) =>
    id === meId ? t("common.you") : (dir.memberById.get(id)?.name ?? t("channel.unknownPerson"));
  const where = usageQueueWhere(t, row, meId, person);
  const who = usageQueueWho(t, i18n.language, row, person, new Date(now));
  return (
    <View style={styles.row}>
      <Pressable
        style={({ pressed }) => [styles.open, pressed && styles.pressed]}
        onPress={() => open(row)}
        accessibilityRole="link"
        accessibilityLabel={`${n}. ${where}, ${who}`}
      >
        <Text variant="small" tone="faint" style={styles.n}>
          {n}
        </Text>
        <Text variant="small" tone="muted" style={styles.what}>
          <Text variant="small" tone="ink" style={styles.name}>
            {where}
          </Text>
          {` · ${who}`}
        </Text>
      </Pressable>
      {row.state === "answering" ? (
        <View style={styles.now}>
          <PixelOrbit color={agentLook(dir.anyAgent(agentId)).color} size={12} />
          <Text variant="footnote" tone="ink2" style={styles.name}>
            {t("usageQueue.answering")}
          </Text>
        </View>
      ) : row.mayStop ? (
        <View style={styles.act}>
          <DontRunButton runId={row.runId} may />
        </View>
      ) : null}
    </View>
  );
}

/** "#financeiro · há 4 min" over "Nina já cuidou disso", then "Responder mesmo assim" for who may. */
function SkippedRow({ row, agentId, now }: { row: UsageQueueClosedRow; agentId: string; now: number }) {
  const { t, i18n } = useTranslation();
  const open = useOpenConversation();
  const where = usageQueueSkippedWhere(t, row);
  const ago = relativeTime(t, i18n.language, row.closed.at, new Date(now));
  const why = usageQueueSkipReason(t, row.closed);
  return (
    <View style={styles.skipped}>
      <Pressable
        style={({ pressed }) => [styles.skippedOpen, pressed && styles.pressed]}
        onPress={() => open(row)}
        accessibilityRole="link"
        accessibilityLabel={`${where}, ${ago}, ${why}`}
      >
        <Text variant="small" tone="muted">
          <Text variant="small" tone="ink" style={styles.name}>
            {where}
          </Text>
          {` · ${ago}`}
        </Text>
        <Text variant="footnote" tone="muted">
          {why}
        </Text>
      </Pressable>
      {row.continuedRunId ? (
        <Text variant="footnote" tone="muted">
          {t("usageQueue.answeredAnyway")}
        </Text>
      ) : row.mayAnswer ? (
        <View style={styles.ghostActs}>
          <AnswerAnywayButton runId={row.runId} agentId={agentId} closed={row.closed} />
        </View>
      ) : null}
    </View>
  );
}

/** "Don't run any", asked once in place. */
function StopAll({ agentId, count }: { agentId: string; count: number }) {
  const { t } = useTranslation();
  const orgId = useOrgId();
  const failed = useFailed();
  const stop = useCancelUsageQueue(orgId, agentId);
  const [asking, setAsking] = useState(false);
  if (!asking)
    return <Button variant="secondary" size="sm" label={t("usageQueue.dontRunAll")} onPress={() => setAsking(true)} />;
  return (
    <View style={styles.con
```

### Core Architecture Module: `apps/mobile/src/features/queue/logic.ts`
```
import type { Channel, DirectMessage, Machine, QueueWhere } from "@agenteschat/client";
import type { QueuePlace } from "@agenteschat/client/lib/computer-queue";

/**
 * A shared computer's line on the phone (ADR 0032, "Calm waits"): which computer a conversation's agents share and
 * where a turn answers as this person knows the conversation. The rest comes from the shared `computer-queue` lib,
 * as on the web.
 */

/** The computer the first of these agents thinks on: a Cloud workspace has one, shared by all of them. */
export function machineOfAgents(
  machines: readonly Pick<Machine, "id" | "agents">[] | undefined,
  agentIds: readonly string[],
): string | null {
  for (const id of agentIds) {
    const m = machines?.find((x) => x.agents.some((a) => a.id === id));
    if (m) return m.id;
  }
  return null;
}

/**
 * Where a turn answers: agents' private conversation for who may see that work, one of my DMs, a channel I can see
 * (or a thread in it), else a private conversation.
 */
export function queuePlace(
  where: QueueWhere,
  channels: readonly Pick<Channel, "id" | "name" | "visibility" | "isMember">[] | undefined,
  dms: readonly Pick<DirectMessage, "channelId">[] | undefined,
): QueuePlace {
  if (where.agents) return { kind: "agents" };
  if (dms?.some((d) => d.channelId === where.channelId)) return { kind: "dm", mine: true };
  const ch = channels?.find((c) => c.id === where.channelId);
  if (!ch || (ch.visibility === "private" && !ch.isMember)) return { kind: "hidden" };
  return { kind: "channel", name: ch.name, thread: where.threadId !== null };
}

```

### Core Architecture Module: `apps/mobile/src/features/queue/parts.tsx`
```
import type { Message, MessageReceipt } from "@agenteschat/client";
import {
  type ConversationWait,
  fanChipText,
  fanOutOf,
  fanOutText,
  fanShows,
  queueLiveText,
  waitingFor,
} from "@agenteschat/client/lib/computer-queue";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Button, Chip, LineIcon, Text } from "@/ui";
import { MSG_AVATAR, MSG_GAP, MSG_INSET, rowFrame } from "../chat/logic";
import { useQuietInset, useRhythm, useRowLook } from "../chat/look";
import { AgentFace } from "../shared/Face";
import { useColors, useDirectory, useMeId, useNow } from "../shared/hooks";
import { useAgentsQueue, useOpenQueue } from "./QueueSheet";

/**
 * Where "thinking" shows, at the end of the conversation, for a run that waits in line for its computer
 * (`conversationWaits`: one per run): its face and name, "Waiting for the computer. Next up, in about 1 min" or "In
 * line, 4th. After Ada, Kai and Ravi", "You go first" on my own request, and "See queue". It lives as long as the
 * receipts say the run waits: its computer's line only adds to it ("Waiting for the computer" until it knows the turn).
 */
export function QueueWaitRow({ channelId, wait: { agentId, runId } }: { channelId: string; wait: ConversationWait }) {
  const rhythm = useRhythm();
  const { faces } = useRowLook();
  const { t, i18n } = useTranslation();
  const dir = useDirectory();
  const meId = useMeId();
  const now = useNow(30_000);
  const openQueue = useOpenQueue();
  const { machineId, queue } = useAgentsQueue([agentId]);
  const name = (id: string) => dir.anyAgent(id)?.name;
  const w = waitingFor(queue, runId ? { runOf: { [agentId]: runId } } : undefined, agentId, channelId);
  const text = (w && queueLiveText(t, i18n.language, queue, w.runId, name, now)) ?? t("queue.live.waiting");
  const first = w?.people && w.purpose.kind === "person" && w.purpose.userId === meId;
  const c = useColors();
  return (
    <View style={[styles.turn, rowFrame(rhythm.block, rhythm.turn)]} accessibilityLiveRegion="polite">
      {faces ? (
        <View style={styles.avslot}>
          <AgentFace agentId={agentId} size={MSG_AVATAR} mode="rest" />
        </View>
      ) : null}
      <View style={styles.body}>
        <Text variant="footnote" tone="ink2" style={styles.name} numberOfLines={1}>
          {name(agentId) ?? t("channel.unknownAgent")}
        </Text>
        <View style={styles.say}>
          <LineIcon name="wait" size={13} color={c.muted} variant="footnote" />
          <Text variant="footnote" tone="muted" style={styles.grow}>
            {text}
          </Text>
        </View>
        <View style={styles.acts}>
          {first ? <Chip icon="person" label={t("queue.youFirst")} /> : null}
          {machineId ? (
            <Button variant="ghost" size="sm" label={t("queue.see")} onPress={() => openQueue(machineId)} />
          ) : null}
        </View>
      </View>
    </View>
  );
}

/**
 * Under an agent's message that called several agents: one strip instead of a "busy" line each. "12 agents called ·
 * 2 answered · 2 working · 8 in line", a chip per agent (answered, working, its place in line), live, and "See
 * queue". It goes once none works or waits: each reply is its own message.
 */
export function FanStrip({ message: m, receipt }: { message: Message; receipt: MessageReceipt | undefined }) {
  const rhythm = useRhythm();
  const inset = useQuietInset();
  const { t, i18n } = useTranslation();
  const dir = useDirectory();
  const c = useColors();
  const openQueue = useOpenQueue();
  const { machineId, queue } = useAgentsQueue(m.mentionedAgentIds);
  const fan = fanOutOf(receipt, queue);
  if (!fanShows(m, fan, receipt)) return null;
  const summary = fanOutText(t, fan);
  return (
    <View
      style={[styles.fan, { borderColor: c.line2, marginLeft: inset, marginTop: rhythm.part }]}
      accessibilityLiveRegion="polite"
    >
      <View style={styles.fanHead}>
        <Text variant="footnote" tone="ink2" style={[styles.grow, styles.name]}>
          {summary}
        </Text>
        {machineId ? (
          <Button variant="ghost" size="sm" label={t("queue.see")} onPress={() => openQueue(machineId)} />
        ) : null}
      </View>
      <View style={styles.chips}>
        {fan.agents.map((a) => (
          <Chip
            key={a.agentId}
            leading={<AgentFace agentId={a.agentId} size={14} live={false} framed={false} />}
            label={dir.anyAgent(a.agentId)?.name ?? t("channel.unknownAgent")}
            trailing={`· ${fanChipText(t, i18n.language, a)}`}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // The turn a live row takes (MessageRow, LiveRows): its reply takes the same place.
  turn: {
    flexDirection: "row",
    gap: MSG_GAP,
    paddingLeft: MSG_INSET,
    paddingRight: 16,
  },
  avslot: { width: MSG_AVATAR, alignItems: "center", paddingTop: 2 },
  body: { flex: 1, minWidth: 0, gap: 4 },
  name: { fontWeight: "600" },
  say: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  grow: { flex: 1, minWidth: 0 },
  acts: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 2 },
  // Under the message's text, in its column.
  fan: {
    marginRight: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
  },
  fanHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
});

```

### Core Architecture Module: `apps/mobile/src/features/routines/EventWebhookSetup.tsx`
```
import {
  useCatalog,
  useGitHubRepos,
  useWebhookSetup,
  useWebhookSetupAction,
  type WebhookProvider,
  type WebhookSetup,
} from "@agenteschat/client";
import { errorText } from "@agenteschat/client/lib/errors";
import { githubHookLink, SENTRY_NEW_INTEGRATION, webhookTestState } from "@agenteschat/client/lib/routine-webhooks";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, StyleSheet, TextInput, View } from "react-native";
import { fieldText, GroupedField, GroupedFooter, GroupedHeader, GroupedList, GroupedRow, Text, useToast } from "@/ui";
import { openPage } from "../ai/parts";
import { ConnectorIcon } from "../connectors/ConnectorIcon";
import { CommandBlock } from "../settings/parts";
import { useColors, useOrgId } from "../shared/hooks";

/** Repositories offered to pick before typing one: the ones pushed to last. */
const QUICK_REPOS = 5;

/**
 * The web's webhook setup of a GitHub or Sentry event routine, for the phone: whether the service already sends its
 * events, and for who sets webhooks up, the webhook made on the spot, what to paste where, GitHub's in one tap when
 * the workspace's GitHub may add it, and Testar, which waits for the first call.
 */
export function EventWebhookSetup({ provider }: { provider: WebhookProvider }) {
  const { t } = useTranslation();
  const c = useColors();
  const orgId = useOrgId();
  const [since, setSince] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [polling, setPolling] = useState(false);
  const query = useWebhookSetup(orgId, provider, polling);
  const action = useWebhookSetupAction(orgId, provider);
  const setup = query.data;
  const name = provider === "github" ? "GitHub" : "Sentry";
  const def = useCatalog().data?.connectors.find((d) => d.id === provider) ?? null;
  const make = setup?.canManage && setup.id === null && !action.isPending && !action.isError;
  // biome-ignore lint/correctness/useExhaustiveDependencies: once per provider without a webhook
  useEffect(() => {
    if (make) action.mutate({ type: "ensure" });
  }, [make, provider]);
  const state = webhookTestState(setup, since, now);
  const testing = since !== null && (state === "waiting" || state === "refused");
  useEffect(() => {
    setPolling(testing);
    if (!testing) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [testing]);
  const [more, setMore] = useState(false);
  const test = () => {
    setNow(Date.now());
    setSince(Date.now());
  };
  const status =
    state === "working"
      ? t("routines.setup.working", { provider: name })
      : state === "waiting"
        ? t(`routines.setup.waiting.${provider}`)
        : state === "refused"
          ? t(`routines.setup.refused.${provider}`)
          : state === "timeout"
            ? t("routines.setup.timeout")
            : setup && !setup.canManage
              ? t("routines.setup.adminOnly", { provider: name })
              : null;
  const steps = setup?.canManage && (state !== "working" || more);
  return (
    <>
      <GroupedHeader>{t("routines.setup.title", { provider: name })}</GroupedHeader>
      <GroupedList>
        <View style={styles.status}>
          <ConnectorIcon def={def} label={name} size={28} />
          <View style={styles.statusText}>
            {!setup ? (
              <ActivityIndicator color={c.muted} />
            ) : (
              <Text
                variant="footnote"
                tone={state === "working" ? "ok" : state === "refused" || state === "timeout" ? "danger" : "muted"}
                accessibilityLiveRegion="polite"
              >
                {status ?? t("routines.setup.title", { provider: name })}
              </Text>
            )}
          </View>
          {state === "waiting" ? <ActivityIndicator color={c.muted} /> : null}
        </View>
      </GroupedList>
      {action.isError ? <GroupedFooter>{errorText(t, action.error)}</GroupedFooter> : null}
      {setup && steps ? (
        provider === "github" ? (
          <GitHubSteps setup={setup} onAdded={test} />
        ) : (
          <SentrySteps setup={setup} />
        )
      ) : null}
      {setup?.canManage ? (
        <>
          <View style={styles.gap} />
          <GroupedList>
            {state === "working" && provider === "github" && !more ? (
              <GroupedRow icon="plus" label={t("routines.setup.github.another")} onPress={() => setMore(true)} />
            ) : (
              <GroupedRow
                icon="send"
                label={t(state === "timeout" || state === "refused" ? "routines.setup.retest" : "routines.setup.test")}
                disabled={!setup.url || state === "waiting"}
                onPress={test}
              />
            )}
          </GroupedList>
        </>
      ) : null}
    </>
  );
}

function GitHubSteps({ setup, onAdded }: { setup: WebhookSetup; onAdded: () => void }) {
  const { t } = useTranslation();
  const c = useColors();
  const orgId = useOrgId();
  const toast = useToast();
  const repos = useGitHubRepos(orgId);
  const action = useWebhookSetupAction(orgId, "github");
  const [repo, setRepo] = useState("");
  const link = githubHookLink(repo);
  const quick = (repos.data?.accounts ?? [])
    .flatMap((a) => a.repositories)
    .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))
    .slice(0, QUICK_REPOS);
  const add = () =>
    action.mutate(
      { type: "repo", repo },
      {
        onSuccess: () => {
          toast({ title: t("routines.setup.github.added", { repo }), icon: "check" });
          onAdded();
        },
      },
    );
  return (
    <>
      <GroupedHeader>{t("routines.setup.github.repo")}</GroupedHeader>
      <GroupedList>
        <GroupedField label={t("routines.setup.github.repo")}>
          <TextInput
            value={repo}
            onChangeText={(v) => setRepo(v.trim())}
            editable={!action.isPending}
            placeholder={t("routines.setup.github.repoPlaceholder")}
            placeholderTextColor={c.faint}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel={t("routines.setup.github.repo")}
            style={[fieldText("callout"), { color: c.ink }]}
          />
        </GroupedField>
        {quick.map((r) => (
          <GroupedRow
            key={r.fullName}
            label={r.fullName}
            checked={repo === r.fullName}
            disabled={action.isPending}
            onPress={() => setRepo(r.fullName)}
          />
        ))}
      </GroupedList>
      <View style={styles.gap} />
      <GroupedList>
        {setup.oneClick ? (
          <GroupedRow
            icon="bolt"
            label={t("routines.setup.github.oneClick")}
            disabled={!link || action.isPending}
            onPress={add}
          />
        ) : null}
        <GroupedRow
          icon="link"
          label={t("routines.setup.github.openLink")}
          disabled={!link}
          onPress={() => link && openPage(link)}
        />
      </GroupedList>
      <GroupedFooter>
        {action.isError
          ? errorText(t, action.error)
          : setup.oneClick
            ? t("routines.setup.github.byHand")
            : t("routines.setup.github.open")}
      </GroupedFooter>
      <GroupedHeader>{t("routines.setup.github.url")}</GroupedHeader>
      {setup.url ? <CommandBlock command={setup.url} copiedTitle={t("routines.setup.copied")} /> : null}
      <GroupedFooter>{t("routines.setup.github.type")}</GroupedFooter>
      <GroupedHeader>{t("routines.setup.github.secret")}</GroupedHeader>
      {setup.secret ? <CommandBlock command={setup.secret} copiedTitle={t("routines.setup.copied")} /> : null}
      <GroupedFooter>{t("routines.setup.github.events")}</GroupedFooter>
    </>
  );
}

function SentrySteps({ setup }: { setup: WebhookSetup }) {
  const { t } = useTranslation();
  const c = useColors();
  const orgId = useOrgId();
  const toast = useToast();
  const action = useWebhookSetupAction(orgId, "sentry");
  const [secret, setSecret] = useState("");
  const save = () =>
    action.mutate(
      { type: "secret", secret },
      {
        onSuccess: () => {
          setSecret("");
          toast({ title: t("routines.setup.sentry.saved"), icon: "check" });
        },
      },
    );
  return (
    <>
      <View style={styles.gap} />
      <GroupedList>
        <GroupedRow
          icon="link"
          label={t("routines.setup.sentry.openLink")}
          onPress={() => openPage(SENTRY_NEW_INTEGRATION)}
        />
      </GroupedList>
      <GroupedFooter>{t("routines.setup.sentry.open")}</GroupedFooter>
      <GroupedHeader>{t("routines.setup.sentry.url")}</GroupedHeader>
      {setup.url ? <CommandBlock command={setup.url} copiedTitle={t("routines.setup.copied")} /> : null}
      <GroupedFooter>{t("routines.setup.sentry.events")}</GroupedFooter>
      <GroupedHeader>{t("routines.setup.sentry.secret")}</GroupedHeader>
      <GroupedList>
        <View style={styles.input}>
          <TextInput
            value={secret}
            onChangeText={setSecret}
            editable={!action.isPending}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={t(
              setup.secretSet ? "routines.setup.sentry.secretSaved" : "routines.setup.sentry.secretPlaceholder",
            )}
            placeholderTextColor={c.faint}
            accessibilityLabel={t("routines.setup.sentry.secret")}
            style={[fieldText("callout"), { color: c.ink }]}
          />
        </View>
        <GroupedRow
          icon="check"
          label={t("routines.setup.sentry.save")}
          disabled={!secret.trim() || action.isPending}
          onPress={save}
        />
      </GroupedList>
      {action.isError ? <GroupedFooter>{errorText(t, action.error)}</GroupedFooter> : null}
```

### Core Architecture Module: `apps/mobile/src/features/routines/WebhookCard.tsx`
```
import {
  ROUTINE_HOOK_METHODS,
  type Routine,
  type RoutineHookCall,
  type RoutineRun,
  useRoutineAction,
  useRoutineHook,
  useRoutineHookAction,
} from "@agenteschat/client";
import { formatBytes } from "@agenteschat/client/lib/files";
import { whenAt } from "@agenteschat/client/lib/format";
import { runMessageLink } from "@agenteschat/client/lib/routine-view";
import { hookCurl, isRefusedHookCall } from "@agenteschat/client/lib/routines";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { GroupedFooter, GroupedHeader, GroupedList, GroupedRow, Text, useToast } from "@/ui";
import { router } from "@/ui/navigation";
import { chatHref } from "../links/logic";
import { CommandBlock, confirmAction } from "../settings/parts";
import { useColors, useOrgId } from "../shared/hooks";
import { useFailed } from "./hooks";

/** The changes that break the services calling the address, each asked first: what stops working. */
const QUESTIONS = {
  address: {
    title: "routines.webhook.replaceTitle",
    text: "routines.webhook.replaceBody",
    action: "routines.webhook.replace",
  },
  secret: {
    title: "routines.webhook.newSecretTitle",
    text: "routines.webhook.newSecretBody",
    action: "routines.webhook.newSecret",
  },
  unsign: {
    title: "routines.webhook.removeSecretTitle",
    text: "routines.webhook.removeSecretBody",
    action: "routines.webhook.removeSecret",
  },
} as const;

/**
 * A webhook routine's address (ADR 0106), the web's panel for the phone, for who manages it: the address to copy and
 * a new one (the old stops at once), the signing secret (shown once, replaced or turned off), an example call,
 * Testar, and the latest calls, each opening the agent's message of the run it went into.
 */
export function WebhookCard({ routine: r, runs }: { routine: Routine; runs: RoutineRun[] }) {
  const { t, i18n } = useTranslation();
  const c = useColors();
  const orgId = useOrgId();
  const toast = useToast();
  const failed = useFailed();
  const hook = useRoutineHook(orgId, r.id);
  const action = useRoutineHookAction(orgId, r.id);
  const save = useRoutineAction(orgId);
  const [secret, setSecret] = useState<string | null>(null);
  const data = hook.data;
  if (!data) {
    return (
      <GroupedList>
        <View style={styles.block}>
          {hook.isError ? (
            <Text variant="footnote" tone="muted">
              {t("mobile.app.failed")}
            </Text>
          ) : (
            <ActivityIndicator color={c.muted} />
          )}
        </View>
      </GroupedList>
    );
  }
  const run = (what: "address" | "secret" | "unsign" | "test") =>
    action.mutate(what, {
      onSuccess: (done) => {
        if (what === "test") toast({ title: t("routines.webhook.tested"), icon: "send" });
        else if (what === "address") toast({ title: t("routines.webhook.replaced"), icon: "check" });
        else setSecret(done.secret ?? null);
      },
      onError: failed,
    });
  // The methods the address answers: at least one stays on.
  const toggleMethod = (m: (typeof ROUTINE_HOOK_METHODS)[number]) => {
    const on = !data.methods.includes(m);
    const next = ROUTINE_HOOK_METHODS.filter((x) => (x === m ? on : data.methods.includes(x)));
    if (next.length === 0) return;
    save.mutate(
      { type: "update", id: r.id, patch: { trigger: { type: "webhook", methods: next } } },
      { onError: failed },
    );
  };
  const ask = (what: keyof typeof QUESTIONS) =>
    confirmAction({
      title: t(QUESTIONS[what].title),
      text: t(QUESTIONS[what].text),
      action: t(QUESTIONS[what].action),
      cancel: t("mobile.common.cancel"),
      onConfirm: () => run(what),
    });
  return (
    <>
      <GroupedHeader>{t("routines.webhook.address")}</GroupedHeader>
      <CommandBlock command={data.url} copiedTitle={t("routines.webhook.copied")} />
      <GroupedFooter>{t("routines.webhook.addressHelp")}</GroupedFooter>
      <View style={styles.gap} />
      <GroupedList>
        <GroupedRow
          icon="undo"
          label={t("routines.webhook.replace")}
          disabled={action.isPending}
          onPress={() => ask("address")}
        />
      </GroupedList>

      <GroupedHeader
        hint={{
          name: t("common.about", { label: t("routines.webhook.signature") }),
          text: t("routines.webhook.signedHelp"),
        }}
      >
        {t("routines.webhook.signature")}
      </GroupedHeader>
      <GroupedList>
        <GroupedRow
          icon="lock"
          label={t(data.signed ? "routines.webhook.newSecret" : "routines.webhook.addSecret")}
          disabled={action.isPending}
          onPress={() => (data.signed ? ask("secret") : run("secret"))}
        />
        {data.signed ? (
          <GroupedRow
            icon="x"
            label={t("routines.webhook.removeSecret")}
            disabled={action.isPending}
            onPress={() => ask("unsign")}
          />
        ) : null}
      </GroupedList>
      <GroupedFooter>{t(data.signed ? "routines.webhook.signedOn" : "routines.webhook.signedOff")}</GroupedFooter>
      {secret && data.signed ? (
        <>
          <GroupedFooter>{t("routines.webhook.secretOnce")}</GroupedFooter>
          <CommandBlock command={secret} copiedTitle={t("routines.webhook.secretCopied")} />
        </>
      ) : null}

      <GroupedHeader
        hint={{
          name: t("common.about", { label: t("routines.webhook.methods") }),
          text: t("routines.webhook.methodsHelp"),
        }}
      >
        {t("routines.webhook.methods")}
      </GroupedHeader>
      <GroupedList>
        {ROUTINE_HOOK_METHODS.map((m) => (
          <GroupedRow
            key={m}
            label={m}
            checked={data.methods.includes(m)}
            disabled={save.isPending || (data.methods.length === 1 && data.methods.includes(m))}
            onPress={() => toggleMethod(m)}
          />
        ))}
      </GroupedList>

      <GroupedHeader>{t("routines.webhook.example")}</GroupedHeader>
      <CommandBlock
        command={hookCurl(
          data.url,
          data.signed ? (secret ?? t("routines.webhook.secretPlaceholder")) : null,
          data.methods,
        )}
        copiedTitle={t("routines.webhook.exampleCopied")}
      />
      <View style={styles.gap} />
      <GroupedList>
        <GroupedRow
          icon="send"
          label={t("routines.webhook.test")}
          disabled={action.isPending}
          onPress={() => run("test")}
        />
      </GroupedList>

      <GroupedHeader>{t("routines.webhook.calls")}</GroupedHeader>
      <GroupedList>
        {data.calls.length === 0 ? (
          <View style={styles.block}>
            <Text variant="footnote" tone="muted">
              {t("routines.webhook.noCalls")}
            </Text>
          </View>
        ) : (
          data.calls.map((call) => (
            <CallRow key={call.id} call={call} run={runs.find((x) => x.id === call.runId)} locale={i18n.language} />
          ))
        )}
      </GroupedList>
    </>
  );
}

/** One call: how it ended, its size, Teste, when; it opens the agent's message of its run when there is one. */
function CallRow({ call, run, locale }: { call: RoutineHookCall; run: RoutineRun | undefined; locale: string }) {
  const { t } = useTranslation();
  const link = run ? runMessageLink(run) : null;
  const href = link ? chatHref(link.channelId, link.threadId) : null;
  const sub = [
    ...(call.bytes > 0 ? [formatBytes(locale, call.bytes)] : []),
    ...(call.test ? [t("routines.webhook.callTest")] : []),
    ...(href ? [t("routines.openInChat")] : []),
  ].join(" · ");
  return (
    <GroupedRow
      icon={isRefusedHookCall(call.outcome) ? "x" : "check"}
      label={t(`routines.webhook.outcome.${call.outcome}`)}
      {...(sub ? { sub } : {})}
      value={whenAt(t, locale, call.at)}
      chevron={Boolean(href)}
      {...(href ? { onPress: () => router.push(href) } : {})}
    />
  );
}

const styles = StyleSheet.create({
  block: { paddingHorizontal: 14, paddingVertical: 12 },
  gap: { height: 10 },
});

```

### Core Architecture Module: `apps/mobile/src/features/routines/hooks.tsx`
```
import {
  type Routine,
  type RoutineTarget,
  useChannels,
  useDms,
  useMailAccounts,
  useRoutineAction,
} from "@agenteschat/client";
import { knownErrorText } from "@agenteschat/client/lib/errors";
import { relativeTime, toYmd, whenAt } from "@agenteschat/client/lib/format";
import { agentGrammar } from "@agenteschat/client/lib/grammar";
import { type RoutineFix, routineChannelOf, runPixels, type Words } from "@agenteschat/client/lib/routine-view";
import { browserTimezone, onceParts, routineHookUrl, timezoneName } from "@agenteschat/client/lib/routines";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ActionSheetIOS, Alert, Platform } from "react-native";
import { type IconName, useToast } from "@/ui";
import { router } from "@/ui/navigation";
import { routineHref, widgetHref } from "../links/logic";
import { useDirectory, useMeId, useOrgId } from "../shared/hooks";
import { type ActionItem, ActionList, copyText, errorHaptic, successHaptic } from "../shared/parts";
import { useSheet } from "../shared/SheetHost";
import { everyMinutes, isInbox, isRunning, nextLine, RUN_SLOTS, routineTitle, runCaption, toastParts } from "./logic";
import { fromApiRule, nextLabel, ruleSentence } from "./rule";

/** Rotinas' words and actions, shared by the list, a routine's screen and the form. */

/** A routine's form to edit it ("Nova rotina"'s screen, with the routine). */
export const editRoutineHref = (id: string) => `/routines/new?edit=${id}`;

/** Says the routine's words (`lib/routine-view`): its key and values, else its fallback key. */
export function useSay() {
  const { t } = useTranslation();
  return useCallback(
    (w: Words) => {
      const tt = t as unknown as (key: string, options?: Record<string, unknown>) => string;
      return tt(w.key, { ...w.values, ...(w.fallback ? { defaultValue: tt(w.fallback) } : {}) });
    },
    [t],
  );
}

/** My time zone: my profile's in this workspace, else the phone's. */
export function useMyZone(fallback = "UTC"): string {
  const dir = useDirectory();
  const meId = useMeId();
  return (meId ? dir.memberById.get(meId)?.timezone : null) || browserTimezone() || fallback;
}

/** "Quando" in words, in the routine's zone (the zone shows only when it isn't mine). */
export function useWhenText() {
  const { t, i18n } = useTranslation();
  const orgId = useOrgId();
  const mailboxes = useMailAccounts(orgId);
  const myZone = useMyZone();
  return useCallback(
    (r: Routine) => {
      if (r.trigger.type === "email") {
        const { accountId, folder } = r.trigger;
        const address = mailboxes.data?.find((a) => a.id === accountId)?.address ?? t("mail.routine.unknownMailbox");
        return folder && !isInbox(folder)
          ? t("mail.routine.whenFolder", { address, folder })
          : t("mail.routine.when", { address });
      }
      if (r.trigger.type === "event") return t(`routines.event.${r.trigger.event}`);
      if (r.trigger.type === "webhook") return t("routines.webhook.when");
      if (r.trigger.type === "connector") {
        const to = r.trigger.filter.to;
        return to ? t("mail.routine.when", { address: to }) : t("mail.routine.whenMillionSend");
      }
      const zone = r.trigger.timezone || "UTC";
      const zoneNote = zone !== myZone ? ` (${timezoneName(zone, i18n.language)})` : "";
      if (r.trigger.type === "once")
        return t("routines.once", { ...onceParts(i18n.language, r.trigger.at, zone), zone: zoneNote });
      const every = everyMinutes(r.trigger.cron);
      const sentence = r.trigger.rule
        ? ruleSentence(t, i18n.language, fromApiRule(r.trigger.rule, toYmd(new Date())), new Date(), false)
        : every
          ? t("recurrence.s.minutely", { count: every })
          : r.trigger.description;
      return `${sentence}${zoneNote}`;
    },
    [t, i18n.language, mailboxes.data, myZone],
  );
}

/** "Próxima em 10 min" (within a day), else "Próxima: sex 16 out, 10:00"; a one-off, an event, a pause. */
export function useNextText() {
  const { t, i18n } = useTranslation();
  return useCallback(
    (r: Routine, now: Date): string => {
      const n = nextLine(r, now);
      switch (n.kind) {
        case "running":
          return t("routines.runningNow");
        case "fired":
          return t("routines.firedAt", { when: whenAt(t, i18n.language, n.at, now) });
        case "canceled":
          return t("routines.canceled");
        case "paused":
          return t("routines.paused");
        case "email":
          return n.week > 0 ? t("mail.routine.thisWeek", { count: n.week }) : t("mail.routine.waiting");
        case "event":
          return n.week > 0 ? t("routines.eventThisWeek", { count: n.week }) : t("routines.waitingEvent");
        case "webhook":
          return n.week > 0 ? t("routines.eventThisWeek", { count: n.week }) : t("routines.webhook.waiting");
        case "none":
          return "";
        case "soon":
          return t("routines.nextSoon");
        case "minutes":
          return t("routines.nextIn", { when: t("format.inMinutes", { count: n.minutes }) });
        case "hours":
          return t("routines.nextIn", {
            when: n.m ? t("routines.hoursMinutes", { h: n.h, m: n.m }) : t("format.inHours", { count: n.h }),
          });
        case "at":
          return t("routines.next", { when: nextLabel(i18n.language, n.iso) });
      }
    },
    [t, i18n.language],
  );
}

/** The runs as words: the strip's caption ("Respondeu há 2 h") and what a screen reader hears for it. */
export function useRunWords() {
  const { t, i18n } = useTranslation();
  return useMemo(
    () => ({
      caption: (r: Routine, now: Date) => {
        const c = runCaption(r);
        switch (c.kind) {
          case "running":
            return t("routines.runningNow");
          case "never":
            return t("routines.neverRan");
          case "silentOf":
            return t("routines.silentOf", { count: c.count, total: c.total });
          case "stopped":
            return t("routines.lastRun.stopped", { when: relativeTime(t, i18n.language, c.at, now) });
          case "last":
            return t(`routines.lastRun.${c.status}`, { when: relativeTime(t, i18n.language, c.at, now) });
        }
      },
      label: (r: Routine) => {
        const runs = runPixels(r.recentRuns).slice(0, RUN_SLOTS);
        if (runs.length === 0) return t("routines.stripNone");
        return t("routines.stripLabel", {
          list: runs
            .map((x) => `${whenAt(t, i18n.language, x.at)}: ${t(`routines.statusWord.${x.status}`)}`)
            .join("; "),
        });
      },
    }),
    [t, i18n.language],
  );
}

/** Where it delivers, short: "#produto", "na DM com a Infra", "no #produto (thread)", "Drive". */
export function useTargetLabel() {
  const { t } = useTranslation();
  const orgId = useOrgId();
  const channels = useChannels(orgId);
  const dms = useDms(orgId);
  return useCallback(
    (target: RoutineTarget) => {
      if (target.type === "channel") {
        const c = channels.data?.find((x) => x.id === target.channelId);
        return c ? `#${c.name}` : "#";
      }
      // From the chat: "na DM com o Dev", "no #produto (thread)".
      if (target.type === "conversation") {
        const dm = dms.data?.find((d) => d.channelId === target.channelId);
        if (dm) return t("routines.inDm", agentGrammar(dm.with.name));
        const c = channels.data?.find((x) => x.id === target.channelId);
        if (!c) return t("routines.inConversation");
        return target.threadId
          ? t("routines.inThread", { channel: c.name })
          : t("routines.inChannel", { channel: c.name });
      }
      // A widget's own routine (ADR 0135): it redoes its widget, with no message.
      if (target.type === "widget") return t("mobile.dashboards.routineTarget");
      return target.type === "dm" ? t("routines.target.dmShort") : t("routines.target.artifactShort");
    },
    [t, channels.data, dms.data],
  );
}

/**
 * A failed write: "Não deu certo", with the server's reason in the person's words when it is a known one, and the
 * error haptic, so a write that didn't take is felt as well as read.
 */
export function useFailed() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  return useCallback(
    (error: unknown) => {
      errorHaptic();
      const known = knownErrorText(t, error, i18n.language);
      toast({ title: t("mobile.app.failed"), ...(known ? { subtitle: known } : {}), icon: "x" });
    },
    [t, i18n.language, toast],
  );
}

/** Pause, resume, run, stop and the one-tap fixes: one place for the toasts they say (as the web's). */
export function useRoutineControls(r: Routine) {
  const { t } = useTranslation();
  const orgId = useOrgId();
  const dir = useDirectory();
  const toast = useToast();
  const failed = useFailed();
  const action = useRoutineAction(orgId);
  const running = isRunning(r);
  const say = (text: string) => toast({ ...toastParts(text), agentId: r.agentId });
  return {
    action,
    /** `onError`: the switch goes back to what it showed. */
    setActive: (active: boolean, onError?: () => void) =>
      action.mutate(
        { type: "active", id: r.id, active },
        {
          onSuccess: () =>
            say(t(active ? "routines.resumedToast" : running ? "routines.pausedRunningToast" : "routines.pausedToast")),
          onError: (error) => {
            onError?.();
            failed(error);
          },
        },
      ),
    run: () => action.mutate({ type: "run", id: r.id }, { onSuccess: successHaptic, onError: failed }),
    stop: () =>
      action.mutate(
        { type: "stop", id: r.id },
        {
          onSuccess: () =>
            say(t(r.state === "usage_paused" ? "routines.usagePause.canceledToast" : "routines.stoppedToast")),
          onError: failed,
        },
      ),
    continueUsage: () =>
      action.mutate(
        { type: "contin
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #152** (2026-11-12): **Windows: Claude Code fails with "Invalid setting source: --tools"**
  *Symptoms*: ### What happened?  Desktop app 0.7.1, "Run agentes.chat on this PC", Windows 11, Claude Code native install, Claude Pro login.  Every turn fails with:   Error processing --setting-sources: Invalid setting source: --tools. Valid options are: user, project, local  Cause: apps/server/runner/brain.ts spawns the CLI with `shell: process.platform === "win32"`. With shell: true, Node joins argv into one command line without quoting, so the empty argument in `--setting-sources ""` (and `--tools ""` on chat turns) is dropped, and `--tools` is read as the setting source. plan-usage.ts passes `--setting-sources ""` too.   ### Deployment  Self-hosted  ### Version  0.7.1  ### Relevant logs or output  ```shell Error processing --setting-sources: Invalid setting source: --tools. Valid options are: user, project, local ```

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

### Incident Patch 1: `97be2f08` (2026-11-12)
**Commit Message**: fix(engine,db): a server's destructive hint suggests approval, our own words lock

A tool a server only warns about starts at approval and an admin may change it. The lock stays for names
holding one of the sensitive verbs. Stored tools locked by the hint alone are unlocked, their level kept.

Co-Authored-By: Claude Fable 5.2 <[REDACTED_EMAIL]>

**File**: `docs/adr/0016-connectors.md` (modified, +4/-0)
```diff
@@ -66,3 +66,7 @@ GitHub's remote MCP server renamed its tools (`issue_read`, `issue_write`, `pull
 - **What a sign-in lacks.** `connector_connections.oauth_scopes` keeps what a catalog sign-in granted (the token's `scope`, else what we asked for; sign-ins from before were backfilled with the catalog's scopes of that time). A connection whose sign-in lacks some of what the catalog asks for now shows a line saying what Reconectar adds ("Reconecte o GitHub para os agentes também poderem usar o GitHub Projects"), on the web and the phone, and keeps working as it is until then.
 - **Agents are told** (`GITHUB_GUIDANCE`, with GitHub only): the connector and git through our proxy, read-only gh runs without asking where gh is already signed in, never sign the person in to gh nor ask for a GitHub token, and when the connector lacks something say what and that an admin can reconnect.
 - Reconectar moves the connection's "Aprovar sempre" rules to the new connection with the agents' grants, so asking everyone to reconnect for Projects never makes them approve again.
+
+## Addendum (2026-11-12): a server's `destructiveHint` suggests, our verbs lock
+
+A server marks a harmless tool (moving a task) `destructiveHint` as easily as a dangerous one, and a locked tool asked on every call for good. The annotation now only suggests: the tool starts at `approval` with reason `destructive_hint` and `sensitive = false`, so an admin can give it any level, and "Aprovar sempre" and the agent's approvals level apply as for any tool that asks. The lock comes only from our own rules: a sensitive verb in the name (`verb_sensitive`; with the hint, one of those words in any position of the name), Composio's meta tools, and a Composio toolkit's actions, whose hint is our rule for them (ADR 0107 §5) and is enforced on every call. A hint that arrives after an admin chose `read` or `write` moves the tool back to `approval` once, still unlocked. The `destructive_hint_suggests` migration unlocks the rows stored for the hint alone and keeps their level, by the same word rule as the classifier.
```

**File**: `packages/db/migrations/0255_destructive_hint_suggests.sql` (added, +16/-0)
```diff
@@ -0,0 +1,16 @@
+-- A server's destructiveHint only suggests asking: tools locked for that hint alone can have their level changed.
+-- Their level stays as it is. Still locked, as the classifier locks them: a name with one of its sensitive verbs in
+-- any position, Composio's meta tools, and the actions of a Composio toolkit, whose hint is the classifier's own rule.
+UPDATE "custom_tools" AS t
+SET "sensitive" = false
+WHERE t."sensitive"
+  AND t."suggestion_reason" = 'destructive_hint'
+  AND NOT (
+    regexp_split_to_array(lower(regexp_replace(t."name", '([a-z0-9])([A-Z])', '\1_\2', 'g')), '[^a-z0-9]+')
+    && ARRAY['delete', 'remove', 'send', 'pay', 'publish', 'transfer', 'refund', 'unbind', 'share', 'merge', 'deploy', 'rollback', 'destroy', 'drop', 'purge']
+  )
+  AND t."name" NOT IN ('COMPOSIO_MULTI_EXECUTE_TOOL', 'COMPOSIO_REMOTE_WORKBENCH', 'COMPOSIO_REMOTE_BASH_TOOL', 'COMPOSIO_PROXY_EXECUTE')
+  AND NOT EXISTS (
+    SELECT 1 FROM "connector_connections" AS c
+    WHERE c."id" = t."connection_id" AND c."server_url" ~* '^https://backend\.composio\.dev/api/v3\.1/toolkits/'
+  );
```

**File**: `packages/db/migrations/meta/_journal.json` (modified, +7/-0)
```diff
@@ -1772,6 +1772,13 @@
       "when": 1794675300000,
       "tag": "0254_agent_approvals_level",
       "breakpoints": true
+    },
+    {
+      "idx": 255,
+      "version": "7",
+      "when": 1794685300000,
+      "tag": "0255_destructive_hint_suggests",
+      "breakpoints": true
     }
   ]
 }
\ No newline at end of file
```

**File**: `packages/engine/src/connectors/classify.ts` (modified, +12/-6)
```diff
@@ -8,7 +8,8 @@ import { ALWAYS_SENSITIVE } from "../tools/gateway";
  * suggestion must be right on its own:
  *
  * 1. The server's annotations: `readOnlyHint` → read; `destructiveHint` →
- *    approval (and sensitive).
+ *    approval, as a suggestion an admin may change (a server's word alone
+ *    never locks a tool: only our own verbs below do).
  * 2. The verb in the tool's name: get/list/search… → read;
  *    create/update/add… → write; delete/remove/send/pay… → approval (and
  *    sensitive: such a tool may only ask for approval or be off).
@@ -177,17 +178,22 @@ export function classifyByRules(
 ): ToolClass | null {
   if (tool.readOnlyHint === true)
     return { level: "read", source: "annotation", reason: "read_only_hint", sensitive: false };
+  const words = nameWords(tool.name);
+  const verb = words[verbIndex(words, ruleVerb)];
+  const locked: ToolClass = { level: "approval", source: "verb", reason: "verb_sensitive", sensitive: true };
+  const byVerb = verb && SENSITIVE_VERBS.has(verb) ? locked : null;
+  // The server's warning only suggests asking: the lock comes from our own words. With the warning, one of them
+  // anywhere in the name locks (`create_and_send_invoice`), not only in the verb's place.
   if (tool.destructiveHint === true)
-    return { level: "approval", source: "annotation", reason: "destructive_hint", sensitive: true };
+    return words.some((w) => SENSITIVE_VERBS.has(w))
+      ? locked
+      : { level: "approval", source: "annotation", reason: "destructive_hint", sensitive: false };
   if (readTools.includes(tool.name))
     return { level: "read", source: "preset", reason: "preset_read", sensitive: false };
   if (writeTools.includes(tool.name))
     return { level: "write", source: "preset", reason: "verb_write", sensitive: false };
-  const words = nameWords(tool.name);
-  const verb = words[verbIndex(words, ruleVerb)];
   if (!verb) return null;
-  if (SENSITIVE_VERBS.has(verb))
-    return { level: "approval", source: "verb", reason: "verb_sensitive", sensitive: true };
+  if (byVerb) return byVerb;
   if (WRITE_VERBS.has(verb)) return { level: "write", source: "verb", reason: "verb_write", sensitive: false };
   return { level: "read", source: "verb", reason: "verb_read", sensitive: false };
 }
```

**File**: `packages/engine/src/connectors/custom.ts` (modified, +13/-2)
```diff
@@ -97,6 +97,8 @@ export const COMPOSIO_ANY_ACTION: ReadonlySet<string> = new Set([
   "COMPOSIO_PROXY_EXECUTE",
 ]);
 
+const COMPOSIO_META: ReadonlySet<string> = new Set([COMPOSIO_EXECUTOR, ...COMPOSIO_ANY_ACTION]);
+
 const COMPOSIO_SLUG = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$/;
 const isPlainObject = (v: unknown): v is Record<string, unknown> =>
   typeof v === "object" && v !== null && !Array.isArray(v);
@@ -681,19 +683,28 @@ export async function syncCustomTools(deps: CustomDeps, c: ConnectorConnection)
       suggestedAccess: cls.level,
       suggestionSource: cls.source,
       suggestionReason: cls.reason,
-      sensitive: cls.sensitive,
+      // A Composio action's hint is our own rule for it (its words, its entry's `ask`), which the tool source
+      // enforces on every call, and Composio's meta tools run any action their input names: both stay locked.
+      sensitive:
+        cls.sensitive || (tool.destructiveHint === true && (composio !== null || COMPOSIO_META.has(tool.name))),
     };
     if (old) {
       const free = old.access === "read" || old.access === "write" ? old.access : null;
       const stricter = free && old.confirmedAt === null && ACCESS.indexOf(cls.level) > ACCESS.indexOf(free);
+      // A warning the server did not send when the level was chosen asks again, unlocked: the admin may set it back.
+      const warnedNow = tool.destructiveHint === true && old.destructiveHint !== true;
       await deps.db
         .update(customTools)
         .set({
           description,
           readOnlyHint: tool.readOnlyHint ?? null,
           destructiveHint: tool.destructiveHint ?? null,
           ...suggestion,
-          ...(free && cls.sensitive ? { access: "approval" } : stricter ? { access: cls.level } : {}),
+          ...(free && (suggestion.sensitive || warnedNow)
+            ? { access: "approval" }
+            : stricter
+              ? { access: cls.level }
+              : {}),
           removedAt: null,
         })
         .where(eq(customTools.id, old.id));
```

**File**: `packages/engine/test/approve-always.test.ts` (modified, +22/-0)
```diff
@@ -26,6 +26,7 @@ import {
   type McpConnect,
   mcpSessionOver,
   type RoutineBrief,
+  refreshCustomServer,
   removeApprovalRule,
   revokeConnection,
   saveCustomTools,
@@ -545,6 +546,27 @@ describe("Aprovar sempre", () => {
     expect(mcp.calls).toEqual([]);
   });
 
+  test("the executor a plain server only warns about stays locked: it can never be set to run unasked", async () => {
+    f = await setup();
+    const { deps, serverId } = await connectServer(f, composioMcp(), "Tools", "https://tools.example.com/mcp");
+    const executor = async () => {
+      const [row] = await f.db
+        .select()
+        .from(schema.customTools)
+        .where(and(eq(schema.customTools.connectionId, serverId), eq(schema.customTools.name, COMPOSIO_EXECUTOR)));
+      return [row?.access, row?.sensitive];
+    };
+    expect(await executor()).toEqual(["approval", true]);
+    await refreshCustomServer(deps, f.owner.id, f.org.id, serverId);
+    expect(await executor()).toEqual(["approval", true]);
+    await expect(
+      saveCustomTools(deps, f.owner.id, f.org.id, serverId, {
+        label: "Tools",
+        tools: [{ name: COMPOSIO_EXECUTOR, access: "write", label: "Executor" }],
+      }),
+    ).rejects.toThrow("can only ask for approval or be off");
+  });
+
   test("a plain tool of the server is one action: approved for good, that agent runs it with any values", async () => {
     f = await setup();
     const { mcp, gateway, serverId } = await world(f);
```

**File**: `packages/engine/test/connector-tool-review.test.ts` (modified, +85/-5)
```diff
@@ -34,7 +34,7 @@ afterEach(async () => {
 });
 
 describe("classification by the rules", () => {
-  test("annotations first: readOnlyHint → read, destructiveHint → approval (sensitive)", () => {
+  test("annotations first: readOnlyHint → read, destructiveHint → approval as a suggestion", () => {
     expect(classifyByRules({ name: "delete_preview", readOnlyHint: true })).toEqual({
       level: "read",
       source: "annotation",
@@ -45,8 +45,23 @@ describe("classification by the rules", () => {
       level: "approval",
       source: "annotation",
       reason: "destructive_hint",
+      sensitive: false,
+    });
+    // The hint alone never locks, whatever the name's other verb; a verb of ours does, hint or not.
+    expect(classifyByRules({ name: "move_task", destructiveHint: true })?.sensitive).toBe(false);
+    expect(classifyByRules({ name: "task_delete" })?.sensitive).toBe(true);
+    expect(classifyByRules({ name: "task_delete", destructiveHint: true })).toEqual({
+      level: "approval",
+      source: "verb",
+      reason: "verb_sensitive",
       sensitive: true,
     });
+    // With the hint, one of our words anywhere in the name locks; without it, only the name's verb decides.
+    expect(classifyByRules({ name: "create_and_send_invoice", destructiveHint: true })?.sensitive).toBe(true);
+    expect(classifyByRules({ name: "update_share_settings", destructiveHint: true })?.sensitive).toBe(true);
+    expect(classifyByRules({ name: "update_share_settings" })?.sensitive).toBe(false);
+    // A hinted tool with a sensitive verb stays locked even on a preset's read-only list.
+    expect(classifyByRules({ name: "task_delete", destructiveHint: true }, ["task_delete"])?.sensitive).toBe(true);
     // A preset's read-only tools.
     expect(classifyByRules({ name: "execute_sql" }, ["execute_sql"])?.level).toBe("read");
   });
@@ -112,7 +127,7 @@ describe("classification by the rules", () => {
 
 /** An ads server: read, write and sensitive verbs, two annotations and two names the verb can't decide. */
 function adsMcp() {
-  const state = { calls: [] as string[], extra: false };
+  const state = { calls: [] as string[], extra: false, warnLate: false };
   const tool = (server: McpServer, name: string, annotations: Record<string, boolean> = {}) =>
     server.registerTool(
       name,
@@ -125,7 +140,7 @@ function adsMcp() {
   const connect: McpConnect = async () => {
     const server = new McpServer({ name: "ads", version: "1" });
     tool(server, "campaign_list");
-    tool(server, "campaign_budget_update");
+    tool(server, "campaign_budget_update", state.warnLate ? { destructiveHint: true } : {});
     tool(server, "campaign_delete");
     tool(server, "report_export", { readOnlyHint: true });
     tool(server, "campaign_status_toggle", { destructiveHint: true });
@@ -217,7 +232,7 @@ describe("listing a connection's tools", () => {
     expect(row("campaign_budget_update")).toEqual(["write", "verb", "verb_write", false, false]);
     expect(row("campaign_delete")).toEqual(["approval", "verb", "verb_sensitive", true, false]);
     expect(row("report_export")).toEqual(["read", "annotation", "read_only_hint", false, false]);
-    expect(row("campaign_status_toggle")).toEqual(["approval", "annotation", "destructive_hint", true, false]);
+    expect(row("campaign_status_toggle")).toEqual(["approval", "annotation", "destructive_hint", false, false]);
     expect(row("pixel_track")).toEqual(["write", "judge", "changes_undoable", false, true]);
     expect(row("report_task_run")).toEqual(["read", "judge", "reads_only", false, true]);
     // Subjects and readable parts come from the name; nothing is decided yet.
@@ -309,7 +324,7 @@ describe("the person's choices", () => {
     await expect(
       saveCustomTools(deps, fx.owner.id, fx.org.id, server.id, {
         label: "Ads",
-        tools: [{ name: "campaign_status_toggle", access: "write", label: "x" }],
+        tools: [{ name: "campaign_delete", access: "write", label: "x" }],
       }),
     ).rejects.toThrow("can only ask for approval or be off");
 
@@ -397,4 +412,69 @@ describe("the person's choices", () => {
     const again = await refreshCustomServer(deps, fx.owner.id, fx.org.id, server.id);
     expect(again.tools.find((t) => t.name === "campaign_delete")?.access).toBe("approval");
   });
+
+  test("a tool the server only warns about starts at approval and obeys the level an admin gives it", async () => {
+    f = await setup();
+    const fx = f;
+    const mcp = adsMcp();
+    const deps = depsOf(fx, { connect: mcp.connect });
+    const server = await connectAds(fx, deps);
+    const accepted = await acceptCustomSuggestion(deps, fx.owner.id, fx.org.id, server.id);
+    expect(accepted.server.tools.find((t) => t.name === "campaign_status_toggle")).toMatchObject({
+      access: "approval",
+      sensitive: false,
+    });
+    await setAgentScopes(
+      fx.db,
+      fx.owner.id,
+      fx.org.id,
+      fx.agent.id,
+      [{
```

**File**: `packages/engine/test/destructive-hint-migration.test.ts` (added, +48/-0)
```diff
@@ -0,0 +1,48 @@
+import { afterEach, expect, test } from "bun:test";
+import { schema } from "@agenteschat/db";
+import { runMigration } from "@agenteschat/db/testing";
+import { COMPOSIO_EXECUTOR, composioToolkitUrl } from "../src";
+import { type Fixture, setup } from "./fixtures";
+
+let f: Fixture;
+afterEach(async () => {
+  await f?.close();
+});
+
+test("tools locked only by a server's warning are unlocked at the level they had; our verbs and Composio stay locked", async () => {
+  f = await setup();
+  const orgId = f.org.id;
+  const connection = async (toolPrefix: string, serverUrl: string) => {
+    const [c] = await f.db
+      .insert(schema.connectorConnections)
+      .values({ orgId, connector: `custom:${toolPrefix}`, label: toolPrefix, serverUrl, authType: "none", toolPrefix })
+      .returning();
+    if (!c) throw new Error("no connection");
+    return c.id;
+  };
+  const tasks = await connection("tasks", "https://tasks.example.com/mcp");
+  const drive = await connection("google_drive", composioToolkitUrl("googledrive"));
+  const hinted = { suggestionReason: "destructive_hint", sensitive: true, access: "approval" };
+  await f.db.insert(schema.customTools).values([
+    { orgId, connectionId: tasks, name: "move_task", ...hinted },
+    { orgId, connectionId: tasks, name: "task_archive", ...hinted, access: "off" },
+    { orgId, connectionId: tasks, name: "task_delete", ...hinted },
+    { orgId, connectionId: tasks, name: "bulkSendReminders", ...hinted },
+    { orgId, connectionId: tasks, name: COMPOSIO_EXECUTOR, ...hinted },
+    { orgId, connectionId: tasks, name: "remove_member", suggestionReason: "verb_sensitive", sensitive: true },
+    { orgId, connectionId: drive, name: "create_permission", ...hinted },
+  ]);
+
+  await runMigration(f.db, "destructive_hint_suggests");
+
+  const rows = await f.db.select().from(schema.customTools);
+  expect(Object.fromEntries(rows.map((t) => [t.name, [t.sensitive, t.access]]))).toEqual({
+    move_task: [false, "approval"],
+    task_archive: [false, "off"],
+    task_delete: [true, "approval"],
+    bulkSendReminders: [true, "approval"],
+    [COMPOSIO_EXECUTOR]: [true, "approval"],
+    remove_member: [true, null],
+    create_permission: [true, "approval"],
+  });
+});
```

---

### Incident Patch 2: `ef424c57` (2026-11-13)
**Commit Message**: fix(mobile): Android build without photo reads nor a media-playback foreground service (#1)

Google Play's review blocks on two declarations the build brought by default: expo-media-library's
READ_MEDIA_IMAGES (granularPermissions ["photo"]) asks a justification that the photo picker isn't enough, and
expo-audio's background playback (on by default) adds FOREGROUND_SERVICE_MEDIA_PLAYBACK and its service, which
asks a video. The app needs neither: pictures come from the system photo picker (expo-image-picker), Salvar em
Fotos asks write-only (no permission from Android 13 on) and voice messages don't play in the background.

expo-audio gets enableBackgroundPlayback: false, expo-media-library no granular reads, and android.blockedPermissions
keeps the media reads and the media-playback service type out even if a library's manifest brings them.

Co-authored-by: agentes-chat-connector[bot] <353894247+agentes-chat-connector[bot]@users.noreply.github.com>
Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `apps/mobile/app.config.ts` (modified, +19/-3)
```diff
@@ -126,6 +126,16 @@ export default ({ config }: ConfigContext): ExpoConfig => ({
       backgroundColor: "#02060f",
     },
     predictiveBackGestureEnabled: false,
+    // Never read the phone's photos or play in the background: the image picker is Android's photo picker, Salvar em
+    // Fotos only adds (MediaStore needs no permission for it) and voice messages stop when the app leaves. Google
+    // Play asks a justification for the media reads and a video for a media-playback foreground service, so keep
+    // them out even if a library's manifest brings them.
+    blockedPermissions: [
+      "android.permission.READ_MEDIA_IMAGES",
+      "android.permission.READ_MEDIA_VIDEO",
+      "android.permission.READ_MEDIA_VISUAL_USER_SELECTED",
+      "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
+    ],
     intentFilters: [
       {
         action: "VIEW",
@@ -206,7 +216,12 @@ export default ({ config }: ConfigContext): ExpoConfig => ({
     [
       // Mensagens de voz (ADR 0100): the app records only while the person holds or locks the button.
       "expo-audio",
-      { microphonePermission: "To record voice messages in your conversations.", recordAudioAndroid: true },
+      // No background playback (the plugin's default is on): it would add a media-playback foreground service.
+      {
+        microphonePermission: "To record voice messages in your conversations.",
+        recordAudioAndroid: true,
+        enableBackgroundPlayback: false,
+      },
     ],
     [
       // "Compartilhar com…": the app in the system's share sheet (an iOS share extension and Android's send intents),
@@ -228,12 +243,13 @@ export default ({ config }: ConfigContext): ExpoConfig => ({
       },
     ],
     [
-      // Salvar em Fotos: add-only access (the read text matches expo-image-picker's).
+      // Salvar em Fotos: add-only access (the read text matches expo-image-picker's). No granular reads on Android:
+      // saveToPhotos asks write-only, which needs none from Android 13 on.
       "expo-media-library",
       {
         photosPermission: "To send pictures in your conversations.",
         savePhotosPermission: "To save pictures from your conversations to Photos.",
-        granularPermissions: ["photo"],
+        granularPermissions: [],
       },
     ],
   ],
```

---

### Incident Patch 3: `9017e5db` (2026-11-13)
**Commit Message**: Merge pull request #305 from agentes-chat/fix/destructive-hint-suggestion

fix(engine,db): a server's destructive hint suggests approval, our own words lock

**File**: `docs/adr/0016-connectors.md` (modified, +4/-0)
```diff
@@ -66,3 +66,7 @@ GitHub's remote MCP server renamed its tools (`issue_read`, `issue_write`, `pull
 - **What a sign-in lacks.** `connector_connections.oauth_scopes` keeps what a catalog sign-in granted (the token's `scope`, else what we asked for; sign-ins from before were backfilled with the catalog's scopes of that time). A connection whose sign-in lacks some of what the catalog asks for now shows a line saying what Reconectar adds ("Reconecte o GitHub para os agentes também poderem usar o GitHub Projects"), on the web and the phone, and keeps working as it is until then.
 - **Agents are told** (`GITHUB_GUIDANCE`, with GitHub only): the connector and git through our proxy, read-only gh runs without asking where gh is already signed in, never sign the person in to gh nor ask for a GitHub token, and when the connector lacks something say what and that an admin can reconnect.
 - Reconectar moves the connection's "Aprovar sempre" rules to the new connection with the agents' grants, so asking everyone to reconnect for Projects never makes them approve again.
+
+## Addendum (2026-11-12): a server's `destructiveHint` suggests, our verbs lock
+
+A server marks a harmless tool (moving a task) `destructiveHint` as easily as a dangerous one, and a locked tool asked on every call for good. The annotation now only suggests: the tool starts at `approval` with reason `destructive_hint` and `sensitive = false`, so an admin can give it any level, and "Aprovar sempre" and the agent's approvals level apply as for any tool that asks. The lock comes only from our own rules: a sensitive verb in the name (`verb_sensitive`; with the hint, one of those words in any position of the name), Composio's meta tools, and a Composio toolkit's actions, whose hint is our rule for them (ADR 0107 §5) and is enforced on every call. A hint that arrives after an admin chose `read` or `write` moves the tool back to `approval` once, still unlocked. The `destructive_hint_suggests` migration unlocks the rows stored for the hint alone and keeps their level, by the same word rule as the classifier.
```

**File**: `packages/db/migrations/0255_destructive_hint_suggests.sql` (added, +16/-0)
```diff
@@ -0,0 +1,16 @@
+-- A server's destructiveHint only suggests asking: tools locked for that hint alone can have their level changed.
+-- Their level stays as it is. Still locked, as the classifier locks them: a name with one of its sensitive verbs in
+-- any position, Composio's meta tools, and the actions of a Composio toolkit, whose hint is the classifier's own rule.
+UPDATE "custom_tools" AS t
+SET "sensitive" = false
+WHERE t."sensitive"
+  AND t."suggestion_reason" = 'destructive_hint'
+  AND NOT (
+    regexp_split_to_array(lower(regexp_replace(t."name", '([a-z0-9])([A-Z])', '\1_\2', 'g')), '[^a-z0-9]+')
+    && ARRAY['delete', 'remove', 'send', 'pay', 'publish', 'transfer', 'refund', 'unbind', 'share', 'merge', 'deploy', 'rollback', 'destroy', 'drop', 'purge']
+  )
+  AND t."name" NOT IN ('COMPOSIO_MULTI_EXECUTE_TOOL', 'COMPOSIO_REMOTE_WORKBENCH', 'COMPOSIO_REMOTE_BASH_TOOL', 'COMPOSIO_PROXY_EXECUTE')
+  AND NOT EXISTS (
+    SELECT 1 FROM "connector_connections" AS c
+    WHERE c."id" = t."connection_id" AND c."server_url" ~* '^https://backend\.composio\.dev/api/v3\.1/toolkits/'
+  );
```

**File**: `packages/db/migrations/meta/_journal.json` (modified, +7/-0)
```diff
@@ -1772,6 +1772,13 @@
       "when": 1794675300000,
       "tag": "0254_agent_approvals_level",
       "breakpoints": true
+    },
+    {
+      "idx": 255,
+      "version": "7",
+      "when": 1794685300000,
+      "tag": "0255_destructive_hint_suggests",
+      "breakpoints": true
     }
   ]
 }
\ No newline at end of file
```

**File**: `packages/engine/src/connectors/classify.ts` (modified, +12/-6)
```diff
@@ -8,7 +8,8 @@ import { ALWAYS_SENSITIVE } from "../tools/gateway";
  * suggestion must be right on its own:
  *
  * 1. The server's annotations: `readOnlyHint` → read; `destructiveHint` →
- *    approval (and sensitive).
+ *    approval, as a suggestion an admin may change (a server's word alone
+ *    never locks a tool: only our own verbs below do).
  * 2. The verb in the tool's name: get/list/search… → read;
  *    create/update/add… → write; delete/remove/send/pay… → approval (and
  *    sensitive: such a tool may only ask for approval or be off).
@@ -177,17 +178,22 @@ export function classifyByRules(
 ): ToolClass | null {
   if (tool.readOnlyHint === true)
     return { level: "read", source: "annotation", reason: "read_only_hint", sensitive: false };
+  const words = nameWords(tool.name);
+  const verb = words[verbIndex(words, ruleVerb)];
+  const locked: ToolClass = { level: "approval", source: "verb", reason: "verb_sensitive", sensitive: true };
+  const byVerb = verb && SENSITIVE_VERBS.has(verb) ? locked : null;
+  // The server's warning only suggests asking: the lock comes from our own words. With the warning, one of them
+  // anywhere in the name locks (`create_and_send_invoice`), not only in the verb's place.
   if (tool.destructiveHint === true)
-    return { level: "approval", source: "annotation", reason: "destructive_hint", sensitive: true };
+    return words.some((w) => SENSITIVE_VERBS.has(w))
+      ? locked
+      : { level: "approval", source: "annotation", reason: "destructive_hint", sensitive: false };
   if (readTools.includes(tool.name))
     return { level: "read", source: "preset", reason: "preset_read", sensitive: false };
   if (writeTools.includes(tool.name))
     return { level: "write", source: "preset", reason: "verb_write", sensitive: false };
-  const words = nameWords(tool.name);
-  const verb = words[verbIndex(words, ruleVerb)];
   if (!verb) return null;
-  if (SENSITIVE_VERBS.has(verb))
-    return { level: "approval", source: "verb", reason: "verb_sensitive", sensitive: true };
+  if (byVerb) return byVerb;
   if (WRITE_VERBS.has(verb)) return { level: "write", source: "verb", reason: "verb_write", sensitive: false };
   return { level: "read", source: "verb", reason: "verb_read", sensitive: false };
 }
```

**File**: `packages/engine/src/connectors/custom.ts` (modified, +13/-2)
```diff
@@ -97,6 +97,8 @@ export const COMPOSIO_ANY_ACTION: ReadonlySet<string> = new Set([
   "COMPOSIO_PROXY_EXECUTE",
 ]);
 
+const COMPOSIO_META: ReadonlySet<string> = new Set([COMPOSIO_EXECUTOR, ...COMPOSIO_ANY_ACTION]);
+
 const COMPOSIO_SLUG = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$/;
 const isPlainObject = (v: unknown): v is Record<string, unknown> =>
   typeof v === "object" && v !== null && !Array.isArray(v);
@@ -681,19 +683,28 @@ export async function syncCustomTools(deps: CustomDeps, c: ConnectorConnection)
       suggestedAccess: cls.level,
       suggestionSource: cls.source,
       suggestionReason: cls.reason,
-      sensitive: cls.sensitive,
+      // A Composio action's hint is our own rule for it (its words, its entry's `ask`), which the tool source
+      // enforces on every call, and Composio's meta tools run any action their input names: both stay locked.
+      sensitive:
+        cls.sensitive || (tool.destructiveHint === true && (composio !== null || COMPOSIO_META.has(tool.name))),
     };
     if (old) {
       const free = old.access === "read" || old.access === "write" ? old.access : null;
       const stricter = free && old.confirmedAt === null && ACCESS.indexOf(cls.level) > ACCESS.indexOf(free);
+      // A warning the server did not send when the level was chosen asks again, unlocked: the admin may set it back.
+      const warnedNow = tool.destructiveHint === true && old.destructiveHint !== true;
       await deps.db
         .update(customTools)
         .set({
           description,
           readOnlyHint: tool.readOnlyHint ?? null,
           destructiveHint: tool.destructiveHint ?? null,
           ...suggestion,
-          ...(free && cls.sensitive ? { access: "approval" } : stricter ? { access: cls.level } : {}),
+          ...(free && (suggestion.sensitive || warnedNow)
+            ? { access: "approval" }
+            : stricter
+              ? { access: cls.level }
+              : {}),
           removedAt: null,
         })
         .where(eq(customTools.id, old.id));
```

**File**: `packages/engine/test/approve-always.test.ts` (modified, +22/-0)
```diff
@@ -26,6 +26,7 @@ import {
   type McpConnect,
   mcpSessionOver,
   type RoutineBrief,
+  refreshCustomServer,
   removeApprovalRule,
   revokeConnection,
   saveCustomTools,
@@ -545,6 +546,27 @@ describe("Aprovar sempre", () => {
     expect(mcp.calls).toEqual([]);
   });
 
+  test("the executor a plain server only warns about stays locked: it can never be set to run unasked", async () => {
+    f = await setup();
+    const { deps, serverId } = await connectServer(f, composioMcp(), "Tools", "https://tools.example.com/mcp");
+    const executor = async () => {
+      const [row] = await f.db
+        .select()
+        .from(schema.customTools)
+        .where(and(eq(schema.customTools.connectionId, serverId), eq(schema.customTools.name, COMPOSIO_EXECUTOR)));
+      return [row?.access, row?.sensitive];
+    };
+    expect(await executor()).toEqual(["approval", true]);
+    await refreshCustomServer(deps, f.owner.id, f.org.id, serverId);
+    expect(await executor()).toEqual(["approval", true]);
+    await expect(
+      saveCustomTools(deps, f.owner.id, f.org.id, serverId, {
+        label: "Tools",
+        tools: [{ name: COMPOSIO_EXECUTOR, access: "write", label: "Executor" }],
+      }),
+    ).rejects.toThrow("can only ask for approval or be off");
+  });
+
   test("a plain tool of the server is one action: approved for good, that agent runs it with any values", async () => {
     f = await setup();
     const { mcp, gateway, serverId } = await world(f);
```

**File**: `packages/engine/test/connector-tool-review.test.ts` (modified, +85/-5)
```diff
@@ -34,7 +34,7 @@ afterEach(async () => {
 });
 
 describe("classification by the rules", () => {
-  test("annotations first: readOnlyHint → read, destructiveHint → approval (sensitive)", () => {
+  test("annotations first: readOnlyHint → read, destructiveHint → approval as a suggestion", () => {
     expect(classifyByRules({ name: "delete_preview", readOnlyHint: true })).toEqual({
       level: "read",
       source: "annotation",
@@ -45,8 +45,23 @@ describe("classification by the rules", () => {
       level: "approval",
       source: "annotation",
       reason: "destructive_hint",
+      sensitive: false,
+    });
+    // The hint alone never locks, whatever the name's other verb; a verb of ours does, hint or not.
+    expect(classifyByRules({ name: "move_task", destructiveHint: true })?.sensitive).toBe(false);
+    expect(classifyByRules({ name: "task_delete" })?.sensitive).toBe(true);
+    expect(classifyByRules({ name: "task_delete", destructiveHint: true })).toEqual({
+      level: "approval",
+      source: "verb",
+      reason: "verb_sensitive",
       sensitive: true,
     });
+    // With the hint, one of our words anywhere in the name locks; without it, only the name's verb decides.
+    expect(classifyByRules({ name: "create_and_send_invoice", destructiveHint: true })?.sensitive).toBe(true);
+    expect(classifyByRules({ name: "update_share_settings", destructiveHint: true })?.sensitive).toBe(true);
+    expect(classifyByRules({ name: "update_share_settings" })?.sensitive).toBe(false);
+    // A hinted tool with a sensitive verb stays locked even on a preset's read-only list.
+    expect(classifyByRules({ name: "task_delete", destructiveHint: true }, ["task_delete"])?.sensitive).toBe(true);
     // A preset's read-only tools.
     expect(classifyByRules({ name: "execute_sql" }, ["execute_sql"])?.level).toBe("read");
   });
@@ -112,7 +127,7 @@ describe("classification by the rules", () => {
 
 /** An ads server: read, write and sensitive verbs, two annotations and two names the verb can't decide. */
 function adsMcp() {
-  const state = { calls: [] as string[], extra: false };
+  const state = { calls: [] as string[], extra: false, warnLate: false };
   const tool = (server: McpServer, name: string, annotations: Record<string, boolean> = {}) =>
     server.registerTool(
       name,
@@ -125,7 +140,7 @@ function adsMcp() {
   const connect: McpConnect = async () => {
     const server = new McpServer({ name: "ads", version: "1" });
     tool(server, "campaign_list");
-    tool(server, "campaign_budget_update");
+    tool(server, "campaign_budget_update", state.warnLate ? { destructiveHint: true } : {});
     tool(server, "campaign_delete");
     tool(server, "report_export", { readOnlyHint: true });
     tool(server, "campaign_status_toggle", { destructiveHint: true });
@@ -217,7 +232,7 @@ describe("listing a connection's tools", () => {
     expect(row("campaign_budget_update")).toEqual(["write", "verb", "verb_write", false, false]);
     expect(row("campaign_delete")).toEqual(["approval", "verb", "verb_sensitive", true, false]);
     expect(row("report_export")).toEqual(["read", "annotation", "read_only_hint", false, false]);
-    expect(row("campaign_status_toggle")).toEqual(["approval", "annotation", "destructive_hint", true, false]);
+    expect(row("campaign_status_toggle")).toEqual(["approval", "annotation", "destructive_hint", false, false]);
     expect(row("pixel_track")).toEqual(["write", "judge", "changes_undoable", false, true]);
     expect(row("report_task_run")).toEqual(["read", "judge", "reads_only", false, true]);
     // Subjects and readable parts come from the name; nothing is decided yet.
@@ -309,7 +324,7 @@ describe("the person's choices", () => {
     await expect(
       saveCustomTools(deps, fx.owner.id, fx.org.id, server.id, {
         label: "Ads",
-        tools: [{ name: "campaign_status_toggle", access: "write", label: "x" }],
+        tools: [{ name: "campaign_delete", access: "write", label: "x" }],
       }),
     ).rejects.toThrow("can only ask for approval or be off");
 
@@ -397,4 +412,69 @@ describe("the person's choices", () => {
     const again = await refreshCustomServer(deps, fx.owner.id, fx.org.id, server.id);
     expect(again.tools.find((t) => t.name === "campaign_delete")?.access).toBe("approval");
   });
+
+  test("a tool the server only warns about starts at approval and obeys the level an admin gives it", async () => {
+    f = await setup();
+    const fx = f;
+    const mcp = adsMcp();
+    const deps = depsOf(fx, { connect: mcp.connect });
+    const server = await connectAds(fx, deps);
+    const accepted = await acceptCustomSuggestion(deps, fx.owner.id, fx.org.id, server.id);
+    expect(accepted.server.tools.find((t) => t.name === "campaign_status_toggle")).toMatchObject({
+      access: "approval",
+      sensitive: false,
+    });
+    await setAgentScopes(
+      fx.db,
+      fx.owner.id,
+      fx.org.id,
+      fx.agent.id,
+      [{
```

**File**: `packages/engine/test/destructive-hint-migration.test.ts` (added, +48/-0)
```diff
@@ -0,0 +1,48 @@
+import { afterEach, expect, test } from "bun:test";
+import { schema } from "@agenteschat/db";
+import { runMigration } from "@agenteschat/db/testing";
+import { COMPOSIO_EXECUTOR, composioToolkitUrl } from "../src";
+import { type Fixture, setup } from "./fixtures";
+
+let f: Fixture;
+afterEach(async () => {
+  await f?.close();
+});
+
+test("tools locked only by a server's warning are unlocked at the level they had; our verbs and Composio stay locked", async () => {
+  f = await setup();
+  const orgId = f.org.id;
+  const connection = async (toolPrefix: string, serverUrl: string) => {
+    const [c] = await f.db
+      .insert(schema.connectorConnections)
+      .values({ orgId, connector: `custom:${toolPrefix}`, label: toolPrefix, serverUrl, authType: "none", toolPrefix })
+      .returning();
+    if (!c) throw new Error("no connection");
+    return c.id;
+  };
+  const tasks = await connection("tasks", "https://tasks.example.com/mcp");
+  const drive = await connection("google_drive", composioToolkitUrl("googledrive"));
+  const hinted = { suggestionReason: "destructive_hint", sensitive: true, access: "approval" };
+  await f.db.insert(schema.customTools).values([
+    { orgId, connectionId: tasks, name: "move_task", ...hinted },
+    { orgId, connectionId: tasks, name: "task_archive", ...hinted, access: "off" },
+    { orgId, connectionId: tasks, name: "task_delete", ...hinted },
+    { orgId, connectionId: tasks, name: "bulkSendReminders", ...hinted },
+    { orgId, connectionId: tasks, name: COMPOSIO_EXECUTOR, ...hinted },
+    { orgId, connectionId: tasks, name: "remove_member", suggestionReason: "verb_sensitive", sensitive: true },
+    { orgId, connectionId: drive, name: "create_permission", ...hinted },
+  ]);
+
+  await runMigration(f.db, "destructive_hint_suggests");
+
+  const rows = await f.db.select().from(schema.customTools);
+  expect(Object.fromEntries(rows.map((t) => [t.name, [t.sensitive, t.access]]))).toEqual({
+    move_task: [false, "approval"],
+    task_archive: [false, "off"],
+    task_delete: [true, "approval"],
+    bulkSendReminders: [true, "approval"],
+    [COMPOSIO_EXECUTOR]: [true, "approval"],
+    remove_member: [true, null],
+    create_permission: [true, "approval"],
+  });
+});
```

#### Recent Merged Pull Requests:
- **PR #330** (2026-11-13): ci(android): a production build stops at once without ANDROID_VERSION_CODE_BASE (@agentes-chat-connector[bot])
- **PR #327** (2026-11-13): ci(android): the production build fits GitHub's standard runner (@agentes-chat-connector[bot])
- **PR #321** (2026-11-13): fix(runner,engine): an image Codex makes is shown with the reply (@wescld)
- **PR #316** (closed): Onboarding: "Sobre você", the person's own step (photo, name, area) (@wescld)
- **PR #315** (2026-11-13): UI batch: the onboarding's "about you" step, the mode switch's dialog, the right hand's AI dialogs in every agent's pattern (@wescld)
- **PR #312** (2026-11-13): fix(engine,web,mobile): sending a message to an agent at work never reads as a stop (@heliocosta-dev)

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

## X. engine,db): a server's destructive hint suggests approval, our own words lock

**RULE**:
When implementing operations in `docs/adr/0016-connectors.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in agentes-chat/agentes-chat. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `97be2f08`: engine,db): a server's destructive hint suggests approval, our own words lock. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/adr/0016-connectors.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:

## Addendum (2026-11-12): a server's `destructiveHint` suggests, our verbs lock

A server marks a harmless tool (moving a task) `destructiveHint` as easily as a dangerous one, and a locked tool asked on every call for good. The annotation now only suggests: the tool starts at `approval` with reason `destructive_hint` and `sensitive = false`, so an admin can give it any level, and "Aprovar sempre" and the agent's approvals level apply as for any tool that asks. The lock comes only from our own rules: a sensitive verb in the name (`verb_sensitive`; with the hint, one of those words in any position of the name), Composio's meta tools, and a Composio toolkit's actions, whose hint is our rule for them (ADR 0107 §5) and is enforced on every call. A hint that arrives after an admin chose `read` or `write` moves the tool back to `approval` once, still unlocked. The `destructive_hint_suggests` migration unlocks the rows stored for the hint alone and keeps their level, by the same word rule as the classifier.
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `97be2f08` are properly handled with clean fallback behavior.
