# Forensic Learning Record (Deep Inspection): CrossPaste/crosspaste-desktop

> **Canonical Artifact**: `07_PROJECT_LEARNING/crosspaste-crosspaste-desktop-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/CrossPaste/crosspaste-desktop](https://github.com/CrossPaste/crosspaste-desktop))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:46:25.386Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `CrossPaste/crosspaste-desktop`
- **Description**: Cross-device clipboard sync for macOS, Windows & Linux — end-to-end encrypted, LAN-only, no cloud. OCR, CLI and MCP server built in.
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2595 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `glama/mcp_stdio_probe.py`
```
#!/usr/bin/env python3
"""Minimal MCP stdio client: runs a command, sends initialize + tools/list, prints results."""
import json
import subprocess
import sys
import threading
import time

cmd = sys.argv[1:]
p = subprocess.Popen(
    cmd,
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    text=True,
    bufsize=1,
)


def drain_stderr():
    for line in p.stderr:
        sys.stderr.write("[stderr] " + line)


threading.Thread(target=drain_stderr, daemon=True).start()


def send(obj):
    p.stdin.write(json.dumps(obj) + "\n")
    p.stdin.flush()


def recv(expected_id, timeout=120):
    """Return the response whose id matches; notifications and other messages are skipped."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        line = p.stdout.readline()
        if not line:
            if p.poll() is not None:
                raise SystemExit(f"process exited with {p.returncode}")
            time.sleep(0.1)
            continue
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            sys.stderr.write("[stdout-noise] " + line + "\n")
            continue
        if msg.get("id") == expected_id:
            return msg
        sys.stderr.write("[skipped] " + line + "\n")
    raise SystemExit(f"timeout waiting for response id={expected_id}")


send({
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
        "protocolVersion": "2025-06-18",
        "capabilities": {},
        "clientInfo": {"name": "probe", "version": "0"},
    },
})
init = recv(1)
print("initialize ->", json.dumps(init.get("result", init))[:400])
send({"jsonrpc": "2.0", "method": "notifications/initialized"})
send({"jsonrpc": "2.0", "id": 2, "method": "tools/list"})
tools = recv(2)
names = [t["name"] for t in tools.get("result", {}).get("tools", [])]
print("tools/list ->", names)
send({"jsonrpc": "2.0", "id": 3, "method": "resources/list"})
res = recv(3)
print("resources/list ->", [r["name"] for r in res.get("result", {}).get("resources", [])])
p.stdin.close()
try:
    p.wait(timeout=10)
except subprocess.TimeoutExpired:
    p.kill()
sys.exit(0 if names else 1)

```

### Core Architecture Module: `scripts/generate-cli-cell-width-table.py`
```
#!/usr/bin/env python3
"""Regenerates the East Asian Wide interval table used by the CLI's
cell-width estimate (cli/.../commands/EastAsianWideRanges.kt).

Usage:
  curl -sfO https://www.unicode.org/Public/16.0.0/ucd/EastAsianWidth.txt
  python3 scripts/generate-cli-cell-width-table.py EastAsianWidth.txt \
      > cli/src/cliNativeMain/kotlin/com/crosspaste/cli/commands/EastAsianWideRanges.kt

Collects every codepoint with East_Asian_Width W (Wide) or F (Fullwidth),
unions the blocks whose *unassigned* codepoints also default to Wide (per the
file header), and emits merged intervals. Emoji_Presentation characters are a
subset of W/F since Unicode 9 with one exception: regional indicators
(U+1F1E6..U+1F1FF) are Emoji_Presentation but EAW=N, so each counts 1 cell —
a flag pair then totals 1+1=2, matching its rendered width, and needs no
separate handling.
"""

import re
import sys

# Unassigned codepoints in these blocks default to Wide (EastAsianWidth.txt header).
DEFAULT_WIDE = [
    (0x3400, 0x4DBF),
    (0x4E00, 0x9FFF),
    (0xF900, 0xFAFF),
    (0x20000, 0x2FFFD),
    (0x30000, 0x3FFFD),
]

def main(path):
    ranges = list(DEFAULT_WIDE)
    version = "unknown"
    with open(path, encoding="utf-8") as f:
        for line in f:
            if line.startswith("# EastAsianWidth-"):
                version = line.split("-")[1].split(".txt")[0]
            line = line.split("#")[0].strip()
            if not line:
                continue
            m = re.match(r"^([0-9A-F]+)(?:\.\.([0-9A-F]+))?\s*;\s*(\w+)", line)
            if not m:
                continue
            lo, hi, eaw = m.group(1), m.group(2) or m.group(1), m.group(3)
            if eaw in ("W", "F"):
                ranges.append((int(lo, 16), int(hi, 16)))

    ranges.sort()
    merged = []
    for lo, hi in ranges:
        if merged and lo <= merged[-1][1] + 1:
            merged[-1] = (merged[-1][0], max(merged[-1][1], hi))
        else:
            merged.append((lo, hi))

    print("// Generated by scripts/generate-cli-cell-width-table.py from")
    print(f"// EastAsianWidth.txt (Unicode {version}) - do not edit by hand.")
    print("package com.crosspaste.cli.commands")
    print()
    print("/**")
    print(" * Merged codepoint intervals with East_Asian_Width Wide or Fullwidth,")
    print(" * including blocks whose unassigned codepoints default to Wide, as")
    print(" * [start0, end0, start1, end1, ...] pairs sorted ascending.")
    print(" */")
    print("internal val EAST_ASIAN_WIDE_RANGES: IntArray =")
    print("    intArrayOf(")
    for lo, hi in merged:
        print(f"        0x{lo:04X}, 0x{hi:04X},")
    print("    )")

if __name__ == "__main__":
    main(sys.argv[1])

```

### Core Architecture Module: `web/postcss.config.js`
```
export default {
  plugins: {
    "@tailwindcss/postcss": {},
    autoprefixer: {},
  },
};

```

### Core Architecture Module: `web/src/background/native-host.ts`
```
const NATIVE_HOST_NAME = "com.crosspaste.desktop";
const RECONNECT_BASE_MS = 10_000;
const RECONNECT_MAX_MS = 60_000;

type NativeHostCallbacks = {
  onDesktopConnected: () => void;
  onDesktopDisconnected: () => void;
};

let port: chrome.runtime.Port | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let callbacks: NativeHostCallbacks | null = null;
let desktopConnected = false;
let initialResolve: ((connected: boolean) => void) | null = null;
let reconnectDelay = RECONNECT_BASE_MS;

export function isDesktopConnected(): boolean {
  return desktopConnected;
}

export function initNativeHost(cbs: NativeHostCallbacks): Promise<boolean> {
  callbacks = cbs;
  return new Promise((resolve) => {
    initialResolve = resolve;
    attemptConnect();
  });
}

function attemptConnect(): void {
  try {
    port = chrome.runtime.connectNative(NATIVE_HOST_NAME);

    port.onMessage.addListener((_msg: unknown) => {
      if (!desktopConnected) {
        desktopConnected = true;
        reconnectDelay = RECONNECT_BASE_MS;
        if (initialResolve) {
          initialResolve(true);
          initialResolve = null;
        }
        callbacks?.onDesktopConnected();
      }
    });

    port.onDisconnect.addListener(() => {
      // Reading lastError marks it as checked, silencing Chrome's
      // "Unchecked runtime.lastError" console noise on every reconnect.
      const reason =
        chrome.runtime.lastError?.message ?? "host closed the connection";
      console.log(`[NativeMessaging] disconnected: ${reason}`);
      port = null;
      if (initialResolve) {
        initialResolve(false);
        initialResolve = null;
      } else if (desktopConnected) {
        desktopConnected = false;
        callbacks?.onDesktopDisconnected();
      }
      scheduleReconnect();
    });
  } catch (e) {
    console.log("[NativeMessaging] connectNative failed:", e);
    if (initialResolve) {
      initialResolve(false);
      initialResolve = null;
    }
    scheduleReconnect();
  }
}

function scheduleReconnect(): void {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  const delay = reconnectDelay;
  reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_MS);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    attemptConnect();
  }, delay);
}

```

### Core Architecture Module: `web/src/background/service-worker.ts`
```
import { ConnectionStore, type ConnectionConfig } from "@/shared/storage/connection-store";
import { DeviceStore, type StoredDevice } from "@/shared/storage/device-store";
import { PasteStore } from "@/shared/storage/paste-store";
import { BlobStore } from "@/shared/storage/blob-store";
import { SyncApi } from "@/shared/api/sync";
import { PullApi } from "@/shared/api/pull";
import {
  CrossPasteHash,
  CrossPasteJson,
  createPairingV3Initiator,
  type PairingV3Initiator,
} from "@/shared/core";
import { KeyStore, toInt8Array } from "@/shared/storage/key-store";
import type { SyncInfo } from "@/shared/models/sync-info";
import type { PasteData } from "@/shared/models/paste-data";
import { APP_VERSION } from "@/shared/app/version.generated";
import { collectPasteItems } from "@/shared/paste/paste-collector";
import { WsManager } from "@/shared/ws/ws-manager";
import {
  createWsMessageHandler,
  type OversizePasteNotice,
} from "@/shared/ws/ws-message-handler";
import { buildTranslatorFromStorage } from "@/shared/i18n/i18n-core";
import { createWsPayloadDecryptor } from "@/shared/ws/ws-payload-crypto";
import { WsMessageType, simpleEnvelope } from "@/shared/ws/ws-types";
import type { WsEnvelope } from "@/shared/ws/ws-types";
import { ingestPaste } from "@/shared/paste/paste-ingestion";
import { initNativeHost, isDesktopConnected } from "./native-host";
import type { WsConnectionStatus } from "@/shared/ws/ws-types";
import {
  deriveSyncState,
  type DeviceRuntimeFacts,
} from "@/shared/sync/derive-state";
import { SyncState } from "@/shared/sync/sync-state";
import { SyncApiError, StandardErrorCode } from "@/shared/api/sync-error";
import {
  PROTOCOL_VERSION,
  ADVERTISED_PAIRING_VERSION,
  isCompatibleVersion,
  selectPairingMode,
} from "@/shared/sync/protocol-version";
import type { KeyExchangeResponse } from "@/shared/models/key-exchange";
import {
  enqueueOversizeNotice,
  type OversizeNoticeMessage,
} from "@/shared/oversize-notice-queue";

// ─── Per-device runtime facts (source of truth) ───────────────────────
//
// Lives only in the service worker. The UI sees the derived SyncState
// (see getDevicesWithStatus). We broadcast DEVICES_CHANGED only when the
// derived state flips, to avoid spamming on every 60s probe.

interface RuntimeFacts {
  wsState: WsConnectionStatus | null;
  lastHttpSuccessAt: number | null;
  lastErrorCode: number | null;
  versionDrift: boolean;
  connecting: boolean;
}

const deviceRuntime = new Map<string, RuntimeFacts>();

function getOrCreateRuntime(targetId: string): RuntimeFacts {
  let state = deviceRuntime.get(targetId);
  if (!state) {
    state = {
      wsState: null,
      lastHttpSuccessAt: null,
      lastErrorCode: null,
      versionDrift: false,
      connecting: false,
    };
    deviceRuntime.set(targetId, state);
  }
  return state;
}

async function computeState(targetId: string): Promise<SyncState> {
  const runtime = getOrCreateRuntime(targetId);
  const device = await DeviceStore.get(targetId);
  const facts: DeviceRuntimeFacts = {
    ...runtime,
    needsRePair: device?.needsRePair === true,
  };
  return deriveSyncState(facts, Date.now());
}

async function updateRuntime(
  targetId: string,
  mutate: (state: RuntimeFacts) => void,
): Promise<void> {
  const before = await computeState(targetId);
  mutate(getOrCreateRuntime(targetId));
  const after = await computeState(targetId);
  if (before !== after) {
    broadcastToSidePanel({ type: "DEVICES_CHANGED" });
  }
}

// ─── WebSocket manager (initialized in initialize()) ────────────────────

let wsManager: WsManager | null = null;

// ─── Current connection attempt ─────────────────────────────────────────

/**
 * One pairing attempt. `handlePair` snapshots the current attempt and every
 * step (including persistence) operates on that snapshot — a concurrent
 * CONNECT replaces `connectingState`, and the superseded attempt then fails
 * its identity check instead of writing keys under the wrong device.
 */
interface ConnectingAttempt {
  /** Generation id assigned at CONNECT/REPAIR entry; PAIR and CANCEL_CONNECT
   * reference it so they can only act on the attempt they belong to. */
  id: number;
  host: string;
  port: number;
  targetAppInstanceId: string;
  syncInfo: SyncInfo;
  /** Trust handshake selected from the desktop's advertised pairingVersion. */
  pairingMode: 1 | 2 | 3;
  /** Live v3 initiator session (pairingMode 3 only). */
  v3?: PairingV3Initiator;
  /**
   * The warm-up key-exchange response (pairingMode 2 only). Reused at confirm
   * time so each pairing performs exactly ONE exchange — the desktop's token
   * refresh is counted per exchange and released once per confirm.
   * `requestTimestamp` is the generation marker for a targeted cancel.
   */
  v2Exchange?: KeyExchangeResponse & { requestTimestamp: number };
  /**
   * True while the trust round-trip that makes the DESKTOP persist keys is in
   * flight (v1 trust / v2 confirm / v3 commit). Cancelling in this window
   * would leave one-sided trust, so CANCEL_CONNECT refuses it.
   */
  finalizing?: boolean;
  /**
   * A cancel arrived while finalizing. The pairing settles first; a failure
   * path then honours the latch (cleanup, no session restart). A successful
   * completion ignores it — both sides are consistent at that point.
   */
  cancelRequested?: boolean;
}

let connectingState: ConnectingAttempt | null = null;

/** Monotonic generation for CONNECT/REPAIR requests, sampled at entry. */
let connectSeq = 0;

// ─── Clipboard monitoring ───────────────────────────────────────────────

let offscreenReady = false;

const CLIPBOARD_POLL_INTERVAL_MS = 1000; // 1 second
const STORAGE_KEY_LAST_HASH = "clipboard_lastHash";
// After any clipboard write of our own (LOCAL_COPY from the side panel, or a
// remote paste_push written via the offscreen document), Chrome's
// clipboard.write sanitizes text/html and may regenerate text/plain from the
// HTML, so the first post-write poll reads bytes that don't match the original
// paste's hash. Within this window we absorb the re-read hash into lastHash
// once instead of ingesting it.
const STORAGE_KEY_LOCAL_COPY_UNTIL = "clipboard_localCopyUntil";
const LOCAL_COPY_SUPPRESS_MS = 2000;


async function ensureOffscreen(): Promise<void> {
  if (offscreenReady) return;

  const contexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
  });

  if (contexts.length > 0) {
    offscreenReady = true;
    return;
  }

  await chrome.offscreen.createDocument({
    url: "src/offscreen/offscreen.html",
    reasons: [chrome.offscreen.Reason.CLIPBOARD],
    justification: "Read system clipboard for sync",
  });
  offscreenReady = true;
}

async function getLastHash(): Promise<string> {
  const result = await chrome.storage.session.get(STORAGE_KEY_LAST_HASH);
  return (result[STORAGE_KEY_LAST_HASH] as string) ?? "";
}

async function setLastHash(hash: string): Promise<void> {
  await chrome.storage.session.set({ [STORAGE_KEY_LAST_HASH]: hash });
}

async function getLocalCopyUntil(): Promise<number> {
  const result = await chrome.storage.session.get(STORAGE_KEY_LOCAL_COPY_UNTIL);
  return (result[STORAGE_KEY_LOCAL_COPY_UNTIL] as number) ?? 0;
}

async function setLocalCopyUntil(value: number): Promise<void> {
  await chrome.storage.session.set({ [STORAGE_KEY_LOCAL_COPY_UNTIL]: value });
}

/** Convert a data URL to ArrayBuffer */
function dataUrlToArrayBuffer(dataUrl: string): ArrayBuffer {
  const base64 = dataUrl.split(",")[1] ?? "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// MV3 service workers don't expose URL.createObjectURL or the Blob URL scheme,
// so chrome.downloads.download has to be fed a data URL instead.
function arrayBufferToDataUrl(buffer: ArrayBuffer, mime = "application/octet-stream"): string {
  const bytes
```

### Core Architecture Module: `web/src/components/connection/ConnectionSetup.tsx`
```
import { useState } from "react";
import { TokenInput } from "./TokenInput";
import { DeviceInfo } from "./DeviceInfo";
import type { SyncInfo } from "@/shared/models/sync-info";

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "pairing" | "trusted";

interface ConnectionState {
  status: ConnectionStatus;
  error: string | null;
  syncInfo: SyncInfo | null;
}

interface Props {
  state: ConnectionState;
  onConnect: (host: string, port: number) => Promise<{ success: boolean; syncInfo?: SyncInfo }>;
  onPair: (token: number) => Promise<{ success: boolean; error?: string }>;
  onDisconnect: () => void;
}

export function ConnectionSetup({
  state,
  onConnect,
  onPair,
  onDisconnect,
}: Props) {
  const [host, setHost] = useState("");
  const [port, setPort] = useState("13129");

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    await onConnect(host, parseInt(port, 10));
  };

  // Pairing: desktop is showing the token, user enters it here
  if (state.status === "pairing") {
    return (
      <div className="space-y-4">
        {state.syncInfo && <DeviceInfo syncInfo={state.syncInfo} status="pairing" />}

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
            Enter pairing code
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            A 6-digit code is shown on the CrossPaste desktop app.
          </p>
          <TokenInput onComplete={(token) => onPair(token)} />
          {state.error && (
            <p className="mt-2 text-xs text-red-500">{state.error}</p>
          )}
        </div>

        <button
          onClick={onDisconnect}
          className="w-full py-2 text-sm text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
        >
          Cancel
        </button>
      </div>
    );
  }

  // Trusted: show as "My Device"
  if (state.status === "trusted") {
    return (
      <div className="space-y-4">
        <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide px-1">
          My Device
        </h3>
        {state.syncInfo && <DeviceInfo syncInfo={state.syncInfo} status="trusted" />}
        <button
          onClick={onDisconnect}
          className="w-full py-2 text-sm text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  // Connected but not yet trusted: show as "Nearby Device"
  if (state.status === "connected") {
    return (
      <div className="space-y-4">
        <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide px-1">
          Nearby Device
        </h3>
        {state.syncInfo && <DeviceInfo syncInfo={state.syncInfo} status="connected" />}
        {state.error && (
          <p className="text-xs text-red-500 text-center">{state.error}</p>
        )}
        <button
          onClick={onDisconnect}
          className="w-full py-2 text-sm text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  // Disconnected / Connecting: show IP+port form
  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
          Connect to CrossPaste
        </h3>
        <form onSubmit={handleConnect} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              IP Address
            </label>
            <input
              type="text"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="192.168.1.100"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Port
            </label>
            <input
              type="number"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              placeholder="13129"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <button
            type="submit"
            disabled={state.status === "connecting"}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-md transition-colors"
          >
            {state.status === "connecting" ? "Connecting…" : "Connect"}
          </button>
          {state.error && (
            <p className="text-xs text-red-500">{state.error}</p>
          )}
        </form>
      </div>
    </div>
  );
}

```

### Core Architecture Module: `web/src/components/connection/DeviceInfo.tsx`
```
import type { SyncInfo } from "@/shared/models/sync-info";

const PLATFORM_ICONS: Record<string, string> = {
  Windows: "💻",
  Macos: "🖥",
  Linux: "🐧",
  Android: "📱",
  iPhone: "📱",
  iPad: "📱",
  HarmonyOS: "📱",
};

const STATUS_DOT: Record<string, string> = {
  connected: "bg-yellow-400",
  pairing: "bg-yellow-400 animate-pulse",
  trusted: "bg-green-400",
};

interface Props {
  syncInfo: SyncInfo;
  status?: string;
}

export function DeviceInfo({ syncInfo, status = "connected" }: Props) {
  const { endpointInfo, appInfo } = syncInfo;
  const icon = PLATFORM_ICONS[endpointInfo.platform.name] ?? "💻";
  const dotClass = STATUS_DOT[status] ?? "bg-gray-400";

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {endpointInfo.deviceName}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {endpointInfo.platform.name} · {appInfo.userName} · v
            {appInfo.appVersion}
          </p>
        </div>
        <span className={`w-2 h-2 rounded-full shrink-0 ${dotClass}`} />
      </div>
    </div>
  );
}

```

### Core Architecture Module: `web/src/components/connection/TokenInput.tsx`
```
import { useRef, useState } from "react";
import { useI18n } from "@/shared/i18n/use-i18n";

interface Props {
  onComplete: (token: number) => void;
  disabled?: boolean;
}

const DIGIT_COUNT = 6;

export function TokenInput({ onComplete, disabled }: Props) {
  const t = useI18n();
  const [digits, setDigits] = useState<string[]>(Array(DIGIT_COUNT).fill(""));
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newDigits = [...digits];
    newDigits[index] = value.slice(-1);
    setDigits(newDigits);

    // Auto-advance to next input
    if (value && index < DIGIT_COUNT - 1) {
      refs.current[index + 1]?.focus();
    }

    // Check if all digits filled
    if (newDigits.every((d) => d !== "")) {
      const token = parseInt(newDigits.join(""), 10);
      onComplete(token);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "");
    if (pasted.length === DIGIT_COUNT) {
      const newDigits = pasted.split("");
      setDigits(newDigits);
      refs.current[DIGIT_COUNT - 1]?.focus();
      onComplete(parseInt(pasted, 10));
    }
  };

  const reset = () => {
    setDigits(Array(DIGIT_COUNT).fill(""));
    refs.current[0]?.focus();
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-2 justify-center">
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => { refs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            disabled={disabled}
            autoFocus={i === 0}
            className="w-10 h-12 text-center text-lg font-mono rounded-xl border border-m3-outline-variant bg-m3-surface text-m3-on-surface focus:outline-none focus:ring-2 focus:ring-m3-primary focus:border-transparent disabled:opacity-40"
          />
        ))}
      </div>
      {disabled && (
        <button
          onClick={reset}
          className="text-xs text-m3-primary hover:underline"
        >
          {t("re_enter")}
        </button>
      )}
    </div>
  );
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5040** (2026-09-21): **Windows → HarmonyOS 6: image sync briefly shows a loading card, then disappears**
  *Symptoms*: ### How frequently does the bug occur?  Always  ### Description  Image clipboard entries sent from Windows 11 to a HarmonyOS 6 tablet fail to complete synchronization.  Text synchronization works normally. When an image is copied on Windows, the HarmonyOS client briefly displays a loading/placeholder card for less than one second. The card then disappears and the image is not retained in the CrossPaste pasteboard.  Expected behavior: The image should finish downloading and remain available in the HarmonyOS CrossPaste pasteboard.  Actual behavior: The tablet receives the image metadata and starts loading, but the image retrieval appears to fail and the placeholder is removed.  This happens with every tested image, including files of approximately 6.7 KB, 49 KB, 120 KB, and 300 KB, so it is not related to the image-size limit.  Text sync continues to work correctly. The visible behavior is similar to #2446.  ### Stacktrace & log output  ```shell No crash or stacktrace is shown on the HarmonyOS client. ```  ### Can you reproduce the bug?  Always  ### Reproduction Steps  1. Install CrossPaste 2.2.0 on a Windows 11 computer and a HarmonyOS 6 tablet. 2. Connect and pair both devices. 3. Confirm that text clipboard synchronization from Windows to the tablet works. 4. Copy any PNG or JPEG image on Windows. 5. Open or observe the CrossPaste pasteboard on the HarmonyOS tablet. 6. A loading card appears for less than one second and then disappears. 7. The image is not available in the t
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed report. We have identified the cause: a path-handling issue on the HarmonyOS client when receiving images sent from Windows. A fixed HarmonyOS version will be released as soon as possible; no change is needed on the Windows side.
  > CrossPaste 2.2.1 for HarmonyOS has been released. Updating the HarmonyOS client should resolve this issue.  Closing for now — feel free to reopen if the problem persists.

- **Issue #4944** (2026-09-08): **Expired push session cleanup can delete a paste that a concurrent finalize retry already acknowledged**
  *Symptoms*: ## Summary  `PushSessionManager` can delete a paste row that it has already acknowledged as durably received. Sweep cleanup of an expired, chunk-complete session and a concurrent finalize retry (`/complete` or a repeated last chunk) race on the session's terminal state.  ## Details  - `PushSession.finalize` only holds `finalizeLock` around the finalization callback. - `finalizeIfComplete` checks map membership *before* taking that lock, so a request that resolved the session keeps going even if the session is cleaned up while it waits. - `sweepExpired` retries finalization; on failure it calls `discardExpiredSession`, which removes the session from the map and calls `pasteDao.markDeletePasteData` **outside** the lock. `markDeletePasteData` has no state precondition. - `finalizeIfComplete` returns `Complete` even when `sessions.remove` fails.  ## Interleaving  1. A chunk-complete session whose earlier finalization failed expires. 2. Sweep retries finalization, fails again, releases the lock. 3. A concurrent `/complete` retry that already passed the membership check takes the lock and starts finalizing. 4. Sweep removes the session and enters the delete path (suspends on the DB dispatcher). 5. The retry succeeds, commits `LOADED`, and returns `Complete` to the sender. 6. Sweep's delete transaction marks the freshly committed row deleted and schedules content cleanup.  ## Impact  The receiver deletes a paste it has confirmed to the sender, and the sender stops retrying because i

- **Issue #4854** (2026-08-21): **Headless daemon returns an opaque 500 for CLI image previews when OpenGL libraries are missing**
  *Symptoms*: ## Reproduce  On a minimal Linux system without OpenGL userspace libraries (fresh Ubuntu server / container — no `libGL.so.1` / `libEGL.so.1`):  1. Run the daemon (`--headless`), sync an image paste to it. 2. `crosspaste paste <id>` in a sixel-capable terminal, or directly:  ``` GET /cli/paste/{id}/image?maxWidth=400&maxHeight=300 HTTP/1.1 500 Internal Server Error {"message":"Could not initialize class org.jetbrains.skia.Image"} ```  The CLI quietly falls back to printing file paths ("N image(s) not previewed"), and nothing anywhere tells the user what is actually wrong. Root cause is only discoverable by running `ldd` on the skiko native library:  ``` libGL.so.1 => not found libEGL.so.1 => not found ```  ## Root cause  `CliImageTranscoder.transcode` catches `Exception` around `Image.makeFromEncoded`, but a failed skiko native load surfaces as `ExceptionInInitializerError` (and `NoClassDefFoundError` on every subsequent call) — these are `Error`s, so they propagate out of the route handler and become a generic 500 whose message is just the JVM class-init failure text. The failure is also permanent for the daemon's lifetime: after installing the libraries the daemon must be restarted, which the error never hints at.  ## Scope  - The official **deb is fine**: its generated `Depends` already includes `libgl1` and `libegl1 | libegl-mali-xlnx` (verified against the 2.2.0.2502 arm64 deb), so apt installs pull the libraries automatically. - Affected: AppImage / tarball / source run

- **Issue #4853** (2026-08-21): **Gradle configuration fails on linux-arm64 hosts: "Unknown host target: linux aarch64" from cli/build.gradle.kts**
  *Symptoms*: ## Environment  - Host: Ubuntu 26.04 aarch64 (OrbStack VM on Apple Silicon; any linux-arm64 host reproduces — arm64 servers, Docker on Apple Silicon, Raspberry Pi) - JDK 21, Gradle wrapper from the repo  ## Reproduce  On a linux-arm64 host:  ```sh ./gradlew :app:desktopMainClasses ```  Configuration fails before any task runs:  ``` * Where: Build file '.../cli/build.gradle.kts' line: 163  * What went wrong: Unknown host target: linux aarch64 ```  ## Root cause  `cli/build.gradle.kts` evaluates `HostManager.host` in two places during configuration:  1. the `hostTestTaskName` lookup used by the `cliNativeTest` aggregate task 2. the host-target selection that registers the `:cli:run` task  Kotlin/Native has no linux-arm64 host toolchain, and `HostManager.host` throws `TargetSupportException` instead of returning null on unsupported hosts. Because this happens at configuration time it takes down the whole build — including modules that do not involve Kotlin/Native at all. Notably `./gradlew :app:run --args="--headless"` cannot be used to run the headless daemon from source on an arm64 Linux machine, which is otherwise a fully working scenario (verified: with the call sites guarded, the app module builds and the daemon runs fine on Ubuntu arm64).  ## Fix  Guard both call sites so an unsupported K/N host degrades gracefully: the host-only conveniences (`:cli:run`, the host test wired into `cliNativeTest`) are simply not registered, and everything else configures normally. `HostMana

- **Issue #4791** (2026-09-01): **Short-window keep-first dedup for duplicate image records from a single clipboard operation**
  *Symptoms*: ## Background  On Windows, Snipping Tool writes the clipboard twice per capture (30–90 ms apart; see #4737). Each clipboard event is collected independently, producing two identical history records and two identical PNGs. This duplication is **not caused by consumer concurrency** — even fully serialized collection would produce two records — and it persists because image records intentionally bypass the generic same-hash cleanup.  ## Why the existing gate must stay  The `isRefFiles()` gate in `PasteReleaseService.releaseLocalPasteData` was added deliberately by #2693 as a resource-lifecycle guard:  - `PasteItem.clear()` deletes the real backing files for non-ref (`basePath == null`) file/image items; - `markDeleteSameHash` schedules an immediate `DELETE_PASTE_TASK` (no delay); - the task executor runs up to 10 tasks concurrently, so an older record's sync task may still be reading the very file being deleted.  Lifting the gate would reintroduce premature file deletion and sync failures. **Do not lift it.**  ## Scope  This issue is a **fallback**, contingent on #4793: implement only if duplicate records still occur after the Windows event-coalescing pipeline lands and is validated with real capture runs.  ## Design: short-window keep-first dedup  - When a locally collected image paste computes its final hash and a local image record with the same hash already exists within a short window (a few seconds), keep the **first** record and discard the **second**. - Discarding the se
  **Post-Mortem & Fix Analysis**:
  > Implemented in #4798 (keep-first dedup within a bounded time window, reusing the hash already computed during collection) and #4799 (fixes the SQLite pragma issue the added write concurrency surfaced). Verified on a real Windows machine with the 2.2.0 release build: a Snipping Tool capture now produces a single history record. Shipped in v2.2.0.

- **Issue #4551** (2026-06-11): **In-client software update is not available**
  *Symptoms*: ### How frequently does the bug occur?  Always  ### Description  win  第一次点击更新 <img width="578" height="684" alt="Image" src="https://github.com/user-attachments/assets/1398a9f4-aef1-436a-8477-25cc5634456a" />  第二次打开客户端 <img width="576" height="686" alt="Image" src="https://github.com/user-attachments/assets/c4bd5d30-9fe3-4ab2-990d-ecce119a9f85" />  ### Stacktrace & log output  ```shell  ```  ### Can you reproduce the bug?  -- select --  ### Reproduction Steps  _No response_  ### Version  2.1.3（2297）  ### OS  win11 & macos
  **Post-Mortem & Fix Analysis**:
  > macos  <img width="712" height="812" alt="Image" src="https://github.com/user-attachments/assets/5921abd1-3c98-4b20-ad77-ea152eceb1ed" /> 
  > Thanks for the report — we've confirmed this is a real bug. The in-client update is currently broken on both Windows and macOS, and the issue has been present since 2.1.3.  We're already working on an emergency fix (2.1.5) — it's in progress and not ready yet, but we'll get it out as soon as we can. Tracking fix: #4555.  One important note: because the bug affects the updater itself, the in-app update won't be able to pull the fix. Once 2.1.5 is released, you'll need to download and install it manually to recover. We'll update this issue when the build is available.  Sorry for the inconvenience, and thanks for helping us catch it.
  > This is now fixed in **[2.1.5](https://github.com/CrossPaste/crosspaste-desktop/releases/tag/2.1.5.2343)**, released as a hotfix. You can download it directly from the release page:  https://github.com/CrossPaste/crosspaste-desktop/releases/tag/2.1.5.2343  Root cause: when a newer version was available, triggering the update from the menu threw `Cannot call invokeAndWait from the event dispatcher thread`, which broke the update flow on the Windows installer and macOS builds. The trigger now runs correctly on the UI thread (#4554, #4555).  One additional note: the update **metadata is currently hosted on GitHub Releases**. From mainland China, GitHub is often unreachable without a proxy, so the app may fail to discover new versions even after this fix — that is a separate limitation, not this bug. We plan to address it by serving updates through a global CDN, so update checks and downloads work reliably both inside and outside China. Progress will be tracked in a separate issue.  Thanks

- **Issue #4542** (2026-06-10): **:bug: Fix/idea html clipboard mojibake**
  *Symptoms*: 

- **Issue #4500** (2026-06-03): **Macbook M1 Non Stop remote pasting simultaneously**
  *Symptoms*: ### How frequently does the bug occur?  -- select --  ### Description  I copied a text from my another device, pasted it one time, and it pasted it simultaneously.  ### Stacktrace & log output  ```shell  ```  ### Can you reproduce the bug?  -- select --  ### Reproduction Steps  _No response_  ### Version  2.1.3 (2297)  ### OS  Macos Apple silicon
  **Post-Mortem & Fix Analysis**:
  > Hi @aryaaaaa-cell, thanks for reporting this!  To help us narrow down the cause, could you let us know a few things:  1. **Is your other device also an Apple device (Mac/iPhone/iPad)?** If so, do you have Apple's built-in **Handoff / Universal Clipboard** enabled (System Settings → General → AirDrop & Handoff)?     We suspect this might be a feedback loop: when Apple's Universal Clipboard and CrossPaste are both syncing the clipboard at the same time, the same content can keep bouncing between the two systems, which could explain the non-stop / repeated pasting you're seeing. A quick test would be to **temporarily turn off Handoff** on both devices and see if the issue goes away.  2. **When you say "pasted simultaneously", do you mean:**    - the same text was pasted multiple times in a row into one app, or    - CrossPaste kept auto-pasting on its own without you triggering it?  3. **Logs would be very helpful.** On macOS you can find them here:     `~/Library/Application Support/Cross
  > My other device is android, and I don't think that the problem would be in Apple's built-in Handoff. When I say "pasted simultaneously", I mean CrossPaste kept auto-pasting on its own without I triggering it. I copied from my Samsung S21 FE phone, and I just pasted it to my note for initial testing. After that, the application did not stop from pasting and it ruined my MacBook. I had to do force shutdown.  [crosspaste.log](https://github.com/user-attachments/files/28506821/crosspaste.log) 
  > Thanks for the logs — I've located the issue.  It looks like you set a shortcut to **Cmd+V**. Cmd+V is the system paste shortcut, which we use internally to trigger the paste. It shouldn't be assigned to any other action, otherwise it causes the infinite loop you're seeing.  I'll fix this in the next version by disallowing Cmd+V as a shortcut, since it's reserved for system paste. In the meantime, you can change that shortcut to something else to avoid the problem. 

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

### Incident Patch 1: `bde8fe65` (2026-09-29)
**Commit Message**: :bug: fix multi-monitor placement, clipping and focus handling for Linux paste panel menu (#5079)

* :bug: fix multi-monitor placement, clipping and focus handling for Linux paste panel menu

* :bug: keep the Linux paste panel menu open through the focus shuffle and close it on Escape

A focus loss during the grace period was taken as the user clicking
elsewhere, but the focus can bounce while the window comes up, which
would have closed the menu on every open. Ignore losses during the grace
period again and check where the focus ended up once at the end: gone
after it was gained means the user clicked away, never gained means the
compositor refused and the menu stays usable through its items and the
button's toggle.

The Escape handler sat on the column, which never holds the focus, so
the key never reached it. It now sits on the window.

**File**: `app/src/desktopMain/kotlin/com/crosspaste/ui/PastePanelButtonWindow.kt` (modified, +8/-1)
```diff
@@ -115,7 +115,7 @@ fun PastePanelButtonWindow(windowIcon: Painter?) {
                 return
             }
             if (isLinux) {
-                linuxMenuAnchor = Rectangle(window.bounds)
+                linuxMenuAnchor = if (linuxMenuAnchor == null) Rectangle(window.bounds) else null
                 return
             }
             val menu = popupMenu ?: return
@@ -130,6 +130,12 @@ fun PastePanelButtonWindow(windowIcon: Painter?) {
             menu.show(window.contentPane, x, y)
         }
 
+        LaunchedEffect(buttonInfo.show) {
+            if (!buttonInfo.show) {
+                linuxMenuAnchor = null
+            }
+        }
+
         PastePanelWindowContext {
             PastePanelButtonContent(
                 window = window,
@@ -140,6 +146,7 @@ fun PastePanelButtonWindow(windowIcon: Painter?) {
                 },
                 onSecondaryClick = { x, y -> showMenu(x, y) },
                 onMoved = { x, y ->
+                    linuxMenuAnchor = null
                     appWindowManager.movePastePanelButton(WindowPosition(x.dp, y.dp))
                 },
             )
```

**File**: `app/src/desktopMain/kotlin/com/crosspaste/ui/PastePanelMenuWindow.kt` (modified, +126/-35)
```diff
@@ -23,11 +23,11 @@ import androidx.compose.ui.draw.clip
 import androidx.compose.ui.input.key.Key
 import androidx.compose.ui.input.key.KeyEventType
 import androidx.compose.ui.input.key.key
-import androidx.compose.ui.input.key.onPreviewKeyEvent
 import androidx.compose.ui.input.key.type
 import androidx.compose.ui.layout.onSizeChanged
 import androidx.compose.ui.platform.LocalDensity
 import androidx.compose.ui.unit.DpSize
+import androidx.compose.ui.unit.IntSize
 import androidx.compose.ui.unit.dp
 import androidx.compose.ui.window.Window
 import androidx.compose.ui.window.WindowPosition
@@ -47,6 +47,8 @@ import com.sun.jna.NativeLong
 import kotlinx.coroutines.delay
 import kotlinx.coroutines.launch
 import org.koin.compose.koinInject
+import java.awt.GraphicsEnvironment
+import java.awt.Point
 import java.awt.Rectangle
 import java.awt.Toolkit
 import java.awt.event.WindowAdapter
@@ -57,8 +59,44 @@ import kotlin.time.Duration.Companion.milliseconds
 // Gap between the button and the menu beside it.
 private val MENU_GAP = 4.dp
 
-// Stand-in for the menu's width until its content has been measured.
-private val MENU_WIDTH_GUESS = 200.dp
+// Stand-in for the menu's size until its content has been measured.
+private val MENU_WIDTH_GUESS = 180.dp
+private val MENU_HEIGHT_GUESS = 200.dp
+
+/**
+ * Computes where the context menu window goes beside the button at [anchor].
+ *
+ * Places the menu to the right of the button if it fits within [usableScreen],
+ * otherwise to its left. Top edges are aligned with the button, clamped to ensure
+ * the whole menu remains within the vertical bounds of the usable screen area.
+ */
+internal fun pastePanelMenuPositionBeside(
+    anchor: Rectangle,
+    menuWidth: Int,
+    menuHeight: Int,
+    usableScreen: Rectangle,
+    gap: Int,
+): Point {
+    val rightOfButton = anchor.x + anchor.width + gap
+    val leftOfButton = anchor.x - gap - menuWidth
+    val screenRight = usableScreen.x + usableScreen.width
+    val screenBottom = usableScreen.y + usableScreen.height
+
+    val x =
+        if (rightOfButton + menuWidth <= screenRight) {
+            rightOfButton
+        } else if (leftOfButton >= usableScreen.x) {
+            leftOfButton
+        } else {
+            val maxX = maxOf(usableScreen.x, screenRight - menuWidth)
+            rightOfButton.coerceIn(usableScreen.x, maxX)
+        }
+
+    val maxY = maxOf(usableScreen.y, screenBottom - menuHeight)
+    val y = anchor.y.coerceIn(usableScreen.y, maxY)
+
+    return Point(x, y)
+}
 
 /**
  * The floating button's context menu on Linux, drawn in a window of its own.
@@ -78,51 +116,97 @@ fun PastePanelMenuWindow(
     val appWindowManager = koinInject<DesktopAppWindowManager>()
     val title = appWindowManager.pastePanelMenuWindowTitle
 
-    // Beside the button rather than over it: the button is an override-redirect
-    // window the compositor keeps above every managed one, so anything under it
-    // would be covered. Right of the button, top edges aligned, or to its left
-    // when it would run off the screen. The window packs to its content, so the
-    // final placement waits for the content's measured width; until then a
-    // guess keeps the first frame close.
     val gap = MENU_GAP.value.toInt()
-    val screenWidth = remember { Toolkit.getDefaultToolkit().screenSize.width }
     val density = LocalDensity.current
-    var menuWidth by remember { mutableStateOf<Int?>(null) }
 
-    fun leftFor(width: Int): Int {
-        val right = anchor.x + anchor.width + gap
-        return if (right + width > screenWidth) anchor.x - gap - width else right
-    }
+    val center = remember(anchor) { Point(anchor.x + anchor.width / 2, anchor.y + anchor.height / 2) }
+    val usableScreen =
+        remember(center) {
+            val ge = GraphicsEnvironment.getLocalGraphicsEnvironment()
+            val configuration =
+                ge.screenDevices
+                    .map { it.defaultConfiguration }
+           
```

**File**: `app/src/desktopTest/kotlin/com/crosspaste/ui/PastePanelMenuPlacementTest.kt` (added, +123/-0)
```diff
@@ -0,0 +1,123 @@
+package com.crosspaste.ui
+
+import java.awt.Point
+import java.awt.Rectangle
+import kotlin.test.Test
+import kotlin.test.assertEquals
+
+class PastePanelMenuPlacementTest {
+
+    private val screen = Rectangle(0, 25, 1440, 875)
+    private val gap = 4
+    private val menuWidth = 180
+    private val menuHeight = 200
+
+    private fun button(
+        x: Int,
+        y: Int,
+        width: Int = 48,
+        height: Int = 48,
+    ) = Rectangle(x, y, width, height)
+
+    @Test
+    fun `menu opens to the left of the button when right exceeds screen`() {
+        val position =
+            pastePanelMenuPositionBeside(
+                anchor = button(1376, 200),
+                menuWidth = menuWidth,
+                menuHeight = menuHeight,
+                usableScreen = screen,
+                gap = gap,
+            )
+        // 1376 - 4 - 180 = 1192
+        assertEquals(Point(1192, 200), position)
+    }
+
+    @Test
+    fun `menu opens to the right of the button when space permits`() {
+        val position =
+            pastePanelMenuPositionBeside(
+                anchor = button(100, 200),
+                menuWidth = menuWidth,
+                menuHeight = menuHeight,
+                usableScreen = screen,
+                gap = gap,
+            )
+        // 100 + 48 + 4 = 152
+        assertEquals(Point(152, 200), position)
+    }
+
+    @Test
+    fun `menu is pushed up so it stays on screen near the bottom`() {
+        val position =
+            pastePanelMenuPositionBeside(
+                anchor = button(1376, 800),
+                menuWidth = menuWidth,
+                menuHeight = menuHeight,
+                usableScreen = screen,
+                gap = gap,
+            )
+        // screen bottom = 25 + 875 = 900. Max Y = 900 - 200 = 700.
+        assertEquals(700, position.y)
+    }
+
+    @Test
+    fun `menu is pushed down below the top inset near the top`() {
+        val position =
+            pastePanelMenuPositionBeside(
+                anchor = button(1376, 0),
+                menuWidth = menuWidth,
+                menuHeight = menuHeight,
+                usableScreen = screen,
+                gap = gap,
+            )
+        // screen top = 25
+        assertEquals(25, position.y)
+    }
+
+    @Test
+    fun `menu stays on secondary monitor with positive offset`() {
+        val secondaryScreen = Rectangle(1920, 0, 1920, 1080)
+        // Button on right edge of secondary monitor: 1920 + 1920 - 48 - 16 = 3776
+        val position =
+            pastePanelMenuPositionBeside(
+                anchor = button(3776, 300),
+                menuWidth = menuWidth,
+                menuHeight = menuHeight,
+                usableScreen = secondaryScreen,
+                gap = gap,
+            )
+        // 3776 - 4 - 180 = 3592 (stays on secondary screen)
+        assertEquals(Point(3592, 300), position)
+    }
+
+    @Test
+    fun `menu stays on secondary monitor with negative offset`() {
+        val secondaryScreen = Rectangle(-1920, 0, 1920, 1080)
+        // Button on right edge of left secondary monitor: -48 - 16 = -64
+        val position =
+            pastePanelMenuPositionBeside(
+                anchor = button(-64, 300),
+                menuWidth = menuWidth,
+                menuHeight = menuHeight,
+                usableScreen = secondaryScreen,
+                gap = gap,
+            )
+        // -64 - 4 - 180 = -248 (stays on left secondary screen)
+        assertEquals(Point(-248, 300), position)
+    }
+
+    @Test
+    fun `menu is clamped when neither side fits completely`() {
+        val narrowScreen = Rectangle(0, 0, 150, 600)
+        val position =
+            pastePanelMenuPositionBeside(
+                anchor = button(50, 100),
+                menuWidth = menuWidth,
+                menuHeight = menuHeight,
+                usableScreen = narrowScreen,
+                gap = gap,
+            )
+        assertEqual
```

---

### Incident Patch 2: `77f8e430` (2026-09-29)
**Commit Message**: :bug: close the floating button's menu on Linux when the user clicks elsewhere (#5078)

The XAWT popup menu learns about a click elsewhere through an X pointer
grab, which under XWayland never sees a click on a Wayland surface, so the
menu stayed open until an item was chosen.

On Linux the menu is now a focusable window of its own that closes on focus
loss, Escape or choosing an item, opens beside the button instead of under
it, hides the paste panel when it opens and is hidden by a left click on the
button. macOS keeps the native AWT menu and Windows the Win32 one.

Closes #5077

**File**: `app/src/desktopMain/kotlin/com/crosspaste/app/DesktopAppWindowManager.kt` (modified, +3/-0)
```diff
@@ -99,6 +99,7 @@ abstract class DesktopAppWindowManager(
         private const val PASTE_PANEL_WINDOW_TITLE = "CrossPaste Paste Panel"
 
         private const val PASTE_PANEL_BUTTON_WINDOW_TITLE = "CrossPaste Paste Panel Button"
+        private const val PASTE_PANEL_MENU_WINDOW_TITLE = "CrossPaste Paste Panel Menu"
     }
 
     protected val logger: KLogger = KotlinLogging.logger {}
@@ -113,6 +114,8 @@ abstract class DesktopAppWindowManager(
 
     val pastePanelButtonWindowTitle: String = PASTE_PANEL_BUTTON_WINDOW_TITLE
 
+    val pastePanelMenuWindowTitle: String = PASTE_PANEL_MENU_WINDOW_TITLE
+
     protected val ioScope = namedScope(ioDispatcher, "DesktopAppWindowManager")
 
     private val _mainWindowInfo =
```

**File**: `app/src/desktopMain/kotlin/com/crosspaste/ui/PastePanelButtonWindow.kt` (modified, +29/-18)
```diff
@@ -1,15 +1,14 @@
 package com.crosspaste.ui
 
-import androidx.compose.material3.MaterialTheme
 import androidx.compose.runtime.Composable
 import androidx.compose.runtime.DisposableEffect
 import androidx.compose.runtime.LaunchedEffect
 import androidx.compose.runtime.collectAsState
 import androidx.compose.runtime.getValue
+import androidx.compose.runtime.mutableStateOf
 import androidx.compose.runtime.remember
-import androidx.compose.ui.graphics.Color
+import androidx.compose.runtime.setValue
 import androidx.compose.ui.graphics.painter.Painter
-import androidx.compose.ui.graphics.toArgb
 import androidx.compose.ui.unit.dp
 import androidx.compose.ui.window.WindowPosition
 import com.crosspaste.app.DesktopAppWindowManager
@@ -28,6 +27,7 @@ import kotlinx.coroutines.launch
 import org.koin.compose.koinInject
 import java.awt.MenuItem
 import java.awt.PopupMenu
+import java.awt.Rectangle
 
 /**
  * Floating round button that opens and closes [PastePanelWindow]. It is toggled by the
@@ -57,6 +57,7 @@ fun PastePanelButtonWindow(windowIcon: Painter?) {
 
     val isMac = remember { platform.isMacos() }
     val isWindows = remember { platform.isWindows() }
+    val isLinux = remember { platform.isLinux() }
 
     NonActivatingWindow(
         visible = buttonInfo.show,
@@ -72,11 +73,13 @@ fun PastePanelButtonWindow(windowIcon: Painter?) {
 
         val window = this.window
         val popupMenu =
-            if (isWindows) {
-                null
-            } else {
+            if (isMac) {
                 remember(window) { PopupMenu().also { window.add(it) } }
+            } else {
+                null
             }
+        // Linux draws the menu in a window of its own beside the button, see PastePanelMenuWindow
+        var linuxMenuAnchor by remember { mutableStateOf<Rectangle?>(null) }
         DisposableEffect(window) {
             onDispose {
                 popupMenu?.let { window.remove(it) }
@@ -102,14 +105,19 @@ fun PastePanelButtonWindow(windowIcon: Painter?) {
         fun showMenu(
             x: Int,
             y: Int,
-            surface: Color,
         ) {
+            // The menu and the panel never show together
+            appWindowManager.hidePastePanelWindow()
             if (isWindows) {
                 WindowsPopupMenu.show(menuEntries()) { action ->
                     mainCoroutineDispatcher.launch { action() }
                 }
                 return
             }
+            if (isLinux) {
+                linuxMenuAnchor = Rectangle(window.bounds)
+                return
+            }
             val menu = popupMenu ?: return
             menu.removeAll()
             menuEntries().forEach { entry ->
@@ -119,27 +127,30 @@ fun PastePanelButtonWindow(windowIcon: Painter?) {
                     NativeMenuEntry.Separator -> menu.addSeparator()
                 }
             }
-            // XAWT paints the menu in the background colour of the component it is shown
-            // over, and a transparent window's own background is fully transparent, which left the
-            // Linux menu see-through. The content pane never paints inside a transparent
-            // window, so its colour is free to carry the theme surface for the menu; XAWT
-            // derives a readable text colour from it in either theme.
-            val contentPane = window.contentPane
-            contentPane.background = java.awt.Color(surface.toArgb())
-            menu.show(contentPane, x, y)
+            menu.show(window.contentPane, x, y)
         }
 
         PastePanelWindowContext {
-            val menuSurface = MaterialTheme.colorScheme.surface
             PastePanelButtonContent(
                 window = window,
                 panelOpen = panelInfo.show,
-                onClick = { appWindowManager.switchPastePanelWindow(WindowTrigger.SYSTEM) },
-                onSecondaryClick = { x, y -> showMenu(x, y, menuSurface) },
+                onClick = {
+                    linuxMe
```

**File**: `app/src/desktopMain/kotlin/com/crosspaste/ui/PastePanelMenuWindow.kt` (added, +179/-0)
```diff
@@ -0,0 +1,179 @@
+package com.crosspaste.ui
+
+import androidx.compose.foundation.background
+import androidx.compose.foundation.border
+import androidx.compose.foundation.clickable
+import androidx.compose.foundation.layout.Column
+import androidx.compose.foundation.layout.IntrinsicSize
+import androidx.compose.foundation.layout.fillMaxWidth
+import androidx.compose.foundation.layout.padding
+import androidx.compose.foundation.layout.width
+import androidx.compose.material3.HorizontalDivider
+import androidx.compose.material3.MaterialTheme
+import androidx.compose.material3.Text
+import androidx.compose.runtime.Composable
+import androidx.compose.runtime.DisposableEffect
+import androidx.compose.runtime.LaunchedEffect
+import androidx.compose.runtime.getValue
+import androidx.compose.runtime.mutableStateOf
+import androidx.compose.runtime.remember
+import androidx.compose.runtime.setValue
+import androidx.compose.ui.Modifier
+import androidx.compose.ui.draw.clip
+import androidx.compose.ui.input.key.Key
+import androidx.compose.ui.input.key.KeyEventType
+import androidx.compose.ui.input.key.key
+import androidx.compose.ui.input.key.onPreviewKeyEvent
+import androidx.compose.ui.input.key.type
+import androidx.compose.ui.layout.onSizeChanged
+import androidx.compose.ui.platform.LocalDensity
+import androidx.compose.ui.unit.DpSize
+import androidx.compose.ui.unit.dp
+import androidx.compose.ui.window.Window
+import androidx.compose.ui.window.WindowPosition
+import androidx.compose.ui.window.rememberWindowState
+import com.crosspaste.app.DesktopAppWindowManager
+import com.crosspaste.platform.linux.api.X11Api
+import com.crosspaste.ui.DesktopContext.PastePanelWindowContext
+import com.crosspaste.ui.base.NativeMenuEntry
+import com.crosspaste.ui.theme.AppUIColors
+import com.crosspaste.ui.theme.AppUISize.medium
+import com.crosspaste.ui.theme.AppUISize.tiny2X
+import com.crosspaste.ui.theme.AppUISize.tiny3X
+import com.crosspaste.ui.theme.AppUISize.tiny3XRoundedCornerShape
+import com.crosspaste.ui.theme.AppUISize.tiny5X
+import com.crosspaste.utils.GlobalCoroutineScope.mainCoroutineDispatcher
+import com.sun.jna.NativeLong
+import kotlinx.coroutines.delay
+import kotlinx.coroutines.launch
+import org.koin.compose.koinInject
+import java.awt.Rectangle
+import java.awt.Toolkit
+import java.awt.event.WindowAdapter
+import java.awt.event.WindowEvent
+import java.util.concurrent.atomic.AtomicBoolean
+import kotlin.time.Duration.Companion.milliseconds
+
+// Gap between the button and the menu beside it.
+private val MENU_GAP = 4.dp
+
+// Stand-in for the menu's width until its content has been measured.
+private val MENU_WIDTH_GUESS = 200.dp
+
+/**
+ * The floating button's context menu on Linux, drawn in a window of its own.
+ *
+ * The XAWT popup menu finds out about a click elsewhere through an X pointer
+ * grab. Under XWayland a click on a Wayland surface never reaches the X server,
+ * so that menu simply stayed open. This window takes the keyboard focus instead
+ * and closes the moment it loses it, the way the search and bubble windows do,
+ * which works wherever the compositor moves focus — X11 and Wayland alike.
+ */
+@Composable
+fun PastePanelMenuWindow(
+    anchor: Rectangle,
+    entries: List<NativeMenuEntry>,
+    onDismiss: () -> Unit,
+) {
+    val appWindowManager = koinInject<DesktopAppWindowManager>()
+    val title = appWindowManager.pastePanelMenuWindowTitle
+
+    // Beside the button rather than over it: the button is an override-redirect
+    // window the compositor keeps above every managed one, so anything under it
+    // would be covered. Right of the button, top edges aligned, or to its left
+    // when it would run off the screen. The window packs to its content, so the
+    // final placement waits for the content's measured width; until then a
+    // guess keeps the first frame close.
+    val gap = MENU_GAP.value.toInt()
+    val screenWidth = remember { Toolkit.getDefaultToolkit().screenSize.wi
```

---

### Incident Patch 3: `e0e8c2cc` (2026-09-29)
**Commit Message**: :bug: let the floating button fade back on Linux when no pointer exit arrives (#5076)

With an absolute pointing device — VMs, tablets, touchscreens — XWayland
delivers MotionNotify to the button's canvas but never an EnterNotify or
LeaveNotify, so Compose's hoverable switched on with the first move and
never off: the button went opaque on the first hover and stayed that way.

On Linux, count the button as hovered while pointer events keep arriving and
fade it 800 ms after the last one, or at once when an Exit does arrive. The
composable is split into a PointerActivity holder, a gesture Modifier and
the drawing; the gesture reads its callbacks through rememberUpdatedState,
and the transparent corners outside the circle no longer take pointer input.

Closes #5075

**File**: `app/src/desktopMain/kotlin/com/crosspaste/ui/paste/panel/PastePanelButtonContent.kt` (modified, +153/-45)
```diff
@@ -14,7 +14,10 @@ import androidx.compose.foundation.shape.CircleShape
 import androidx.compose.material3.Icon
 import androidx.compose.runtime.Composable
 import androidx.compose.runtime.getValue
+import androidx.compose.runtime.mutableStateOf
 import androidx.compose.runtime.remember
+import androidx.compose.runtime.rememberUpdatedState
+import androidx.compose.runtime.setValue
 import androidx.compose.ui.Alignment
 import androidx.compose.ui.Modifier
 import androidx.compose.ui.awt.ComposeWindow
@@ -24,18 +27,27 @@ import androidx.compose.ui.graphics.Brush
 import androidx.compose.ui.graphics.Color
 import androidx.compose.ui.input.pointer.AwaitPointerEventScope
 import androidx.compose.ui.input.pointer.PointerEvent
+import androidx.compose.ui.input.pointer.PointerEventPass
 import androidx.compose.ui.input.pointer.PointerEventType
+import androidx.compose.ui.input.pointer.PointerInputChange
 import androidx.compose.ui.input.pointer.isSecondaryPressed
 import androidx.compose.ui.input.pointer.pointerInput
 import com.crosspaste.app.generated.resources.Res
 import com.crosspaste.app.generated.resources.crosspaste_svg
 import com.crosspaste.i18n.GlobalCopywriter
+import com.crosspaste.platform.Platform
 import com.crosspaste.ui.LocalDesktopAppSizeValueState
+import kotlinx.coroutines.Job
+import kotlinx.coroutines.coroutineScope
+import kotlinx.coroutines.delay
+import kotlinx.coroutines.launch
 import org.jetbrains.compose.resources.painterResource
 import org.koin.compose.koinInject
 import java.awt.MouseInfo
 import kotlin.math.hypot
 import kotlin.math.roundToInt
+import kotlin.time.Duration
+import kotlin.time.Duration.Companion.milliseconds
 
 // The app icon's blue gradient; the white clipboard glyph is drawn straight onto it.
 private val BUTTON_GRADIENT_TOP = Color(0xFF2F7BFE)
@@ -45,6 +57,9 @@ private const val IDLE_ALPHA = 0.6f
 
 private const val GLYPH_FRACTION = 0.55f
 
+// How long the button stays lit after the last pointer event on Linux.
+private val LINUX_HOVER_HOLD = 800.milliseconds
+
 /**
  * Round, translucent button: the app icon's gradient with its white glyph on top, so
  * the two read as one shape. Opaque while hovered or while the panel it controls is
@@ -60,61 +75,33 @@ fun PastePanelButtonContent(
     onMoved: (x: Int, y: Int) -> Unit,
 ) {
     val copywriter = koinInject<GlobalCopywriter>()
-
+    val platform = koinInject<Platform>()
     val appSizeValue = LocalDesktopAppSizeValueState.current
 
+    val isLinux = remember { platform.isLinux() }
+    val pointerActivity = remember { PointerActivity() }
     val interactionSource = remember { MutableInteractionSource() }
-    val hovered by interactionSource.collectIsHoveredAsState()
+    val hovered =
+        if (isLinux) {
+            pointerActivity.isRecentlyActive
+        } else {
+            interactionSource.collectIsHoveredAsState().value
+        }
     val alpha by animateFloatAsState(if (hovered || panelOpen) 1f else IDLE_ALPHA)
 
     Box(
         modifier =
             Modifier
                 .size(appSizeValue.pastePanelButtonSize)
                 .alpha(alpha)
-                .hoverable(interactionSource)
-                .pointerInput(window) {
-                    awaitEachGesture {
-                        val press = awaitEventOfType(PointerEventType.Press)
-                        val down = press.changes.first()
-                        if (press.buttons.isSecondaryPressed) {
-                            down.consume()
-                            val up = awaitEventOfType(PointerEventType.Release).changes.first()
-                            up.consume()
-                            onSecondaryClick(
-                                up.position.x
-                                    .toDp()
-                                    .value
-                                    .roundToInt(),
-                                up.position.y
-                                    .toDp()
-                                 
```

---

### Incident Patch 4: `358a245e` (2026-09-28)
**Commit Message**: :bug: offer a URL paste item as plain text so non-Java apps can paste it (#5072)

DesktopUrlTypePlugin put nothing but application/x-java-url on the
transferable. That flavor is Java-private: AWT exports it to the native
clipboard as-is, so after choosing a link from the history a browser
address bar or any text field asked to paste found no text and did nothing.
A link copied from a browser survives by accident — its text item is written
alongside — but a paste carrying only a URL item, like the guide's GitHub
link, has nobody else to supply the text.

Add the URL under DataFlavor.stringFlavor as well, without overriding a text
item's text when one is written alongside.

Closes #5071

**File**: `app/src/desktopMain/kotlin/com/crosspaste/paste/plugin/type/DesktopUrlTypePlugin.kt` (modified, +6/-0)
```diff
@@ -10,6 +10,7 @@ import com.crosspaste.paste.item.PasteItem
 import com.crosspaste.paste.item.UrlPasteItem
 import com.crosspaste.paste.toPasteDataFlavor
 import com.crosspaste.platform.Platform
+import java.awt.datatransfer.DataFlavor
 import java.net.MalformedURLException
 import java.net.URL
 
@@ -84,5 +85,10 @@ class DesktopUrlTypePlugin(
         pasteItem as UrlPasteItem
         @Suppress("DEPRECATION")
         map[URL_FLAVOR.toPasteDataFlavor()] = URL(pasteItem.url)
+        // application/x-java-url is a Java-private flavor. On Linux AWT exports it
+        // to the native clipboard as-is, so a browser or editor asked to paste finds
+        // no text and does nothing. Offer the URL as plain text as well; a text item
+        // written alongside (mixed category) carries the better text, so keep that.
+        map.putIfAbsent(DataFlavor.stringFlavor.toPasteDataFlavor(), pasteItem.url)
     }
 }
```

**File**: `app/src/desktopTest/kotlin/com/crosspaste/paste/plugin/type/DesktopUrlTypePluginTest.kt` (added, +47/-0)
```diff
@@ -0,0 +1,47 @@
+package com.crosspaste.paste.plugin.type
+
+import com.crosspaste.paste.PasteDataFlavor
+import com.crosspaste.paste.PasteDataFlavors.URL_FLAVOR
+import com.crosspaste.paste.item.CreatePasteItemHelper.createUrlPasteItem
+import com.crosspaste.paste.toPasteDataFlavor
+import com.crosspaste.platform.Platform
+import com.crosspaste.utils.getJsonUtils
+import kotlinx.coroutines.test.runTest
+import java.awt.datatransfer.DataFlavor
+import java.net.URL
+import kotlin.test.Test
+import kotlin.test.assertEquals
+
+class DesktopUrlTypePluginTest {
+
+    // Guard against PasteItem/JsonUtils circular class initialization
+    private val jsonUtils = getJsonUtils()
+
+    private val plugin = DesktopUrlTypePlugin(Platform(Platform.LINUX, "x86_64", 64, "6"))
+
+    private val stringFlavor = DataFlavor.stringFlavor.toPasteDataFlavor()
+
+    @Test
+    fun `offers the url as plain text next to the java url flavor`() =
+        runTest {
+            val item = createUrlPasteItem(url = "https://example.com/a?b=1")
+            val map = linkedMapOf<PasteDataFlavor, Any>()
+
+            plugin.buildTransferable(item, mixedCategory = false, map)
+
+            @Suppress("DEPRECATION")
+            assertEquals(URL(item.url), map[URL_FLAVOR.toPasteDataFlavor()])
+            assertEquals(item.url, map[stringFlavor])
+        }
+
+    @Test
+    fun `keeps the text a text item already put on the transferable`() =
+        runTest {
+            val item = createUrlPasteItem(url = "https://example.com")
+            val map = linkedMapOf<PasteDataFlavor, Any>(stringFlavor to "shared text")
+
+            plugin.buildTransferable(item, mixedCategory = true, map)
+
+            assertEquals("shared text", map[stringFlavor])
+        }
+}
```

---

### Incident Patch 5: `ad8f46d8` (2026-09-28)
**Commit Message**: :bug: keep GuidePasteDataService.initData from throwing into host startup code (#5070)

initData runs runBlocking over the first-launch guide seed and let any
database failure escape. The mobile hosts call it from Swift and Android
startup code that cannot catch a Kotlin exception, so a failed seed took the
app down instead of costing the user the guide cards. Wrap the seed in
runCatching and log the failure.

Closes #5069

**File**: `app/src/commonMain/kotlin/com/crosspaste/paste/GuidePasteDataService.kt` (modified, +18/-5)
```diff
@@ -9,6 +9,7 @@ import com.crosspaste.paste.item.CreatePasteItemHelper.createUrlPasteItem
 import com.crosspaste.paste.item.PasteItem
 import com.crosspaste.paste.item.PasteItemReader
 import com.crosspaste.utils.getCodecsUtils
+import io.github.oshai.kotlinlogging.KotlinLogging
 import kotlinx.coroutines.runBlocking
 import kotlinx.serialization.json.JsonObject
 import kotlinx.serialization.json.buildJsonObject
@@ -29,6 +30,8 @@ abstract class GuidePasteDataService(
         const val CROSSPASTE_GUIDE = "CrossPaste Guide"
     }
 
+    private val logger = KotlinLogging.logger {}
+
     private val codecsUtils = getCodecsUtils()
 
     abstract val guideKey: String
@@ -129,12 +132,22 @@ abstract class GuidePasteDataService(
             )
         }
 
-    fun initData() =
-        runBlocking {
-            if (isFirstLaunch()) {
-                if (pasteDao.getSize(allOrTagged = true) == 0L) {
-                    saveData()
+    /**
+     * Seeds the guide records on first launch. Never throws: the mobile hosts call this from
+     * Swift/Android startup code that cannot catch a Kotlin exception, and a failed seed only
+     * costs the user the guide cards, not the app.
+     */
+    fun initData() {
+        runCatching {
+            runBlocking {
+                if (isFirstLaunch()) {
+                    if (pasteDao.getSize(allOrTagged = true) == 0L) {
+                        saveData()
+                    }
                 }
             }
+        }.onFailure { e ->
+            logger.error(e) { "Failed to seed guide paste data" }
         }
+    }
 }
```

---

### Incident Patch 6: `234a3b8d` (2026-09-27)
**Commit Message**: :bug: tell the user to paste manually when no X11 window can be targeted (#5066)

Auto-paste on Linux is a synthetic paste shortcut sent through XTest, which
only reaches X11 and XWayland clients. While a native Wayland window is
focused the compositor withdraws the XWayland input focus, yet
_NET_ACTIVE_WINDOW keeps pointing at the X client that held the focus last,
so the paste panel pasted into a window the user was not looking at and the
search window silently did nothing.

In a Wayland session, guard both paste paths on the X11 input focus and,
with no window to target, skip the injection and tell the user to press
Ctrl+V — the content is already on the clipboard. X11 sessions and the
Hyprland/Sway paths are untouched. NotificationHost is also mounted in the
paste panel and the side search window so the hint has a surface, and
in-app toasts now expire in NotificationManager itself so one pushed while
its host is hidden no longer lingers.

Closes #5065

**File**: `app/src/commonMain/kotlin/com/crosspaste/notification/NotificationManager.kt` (modified, +20/-0)
```diff
@@ -5,11 +5,15 @@ import com.crosspaste.utils.GlobalCoroutineScope.ioCoroutineDispatcher
 import com.crosspaste.utils.equalDebounce
 import kotlinx.coroutines.FlowPreview
 import kotlinx.coroutines.channels.Channel
+import kotlinx.coroutines.delay
 import kotlinx.coroutines.flow.MutableStateFlow
 import kotlinx.coroutines.flow.StateFlow
 import kotlinx.coroutines.flow.receiveAsFlow
 import kotlinx.coroutines.flow.update
 import kotlinx.coroutines.launch
+import kotlin.time.Duration
+import kotlin.time.Duration.Companion.milliseconds
+import kotlin.time.Duration.Companion.seconds
 
 @OptIn(FlowPreview::class)
 abstract class NotificationManager(
@@ -21,8 +25,24 @@ abstract class NotificationManager(
 
     val notificationList: StateFlow<List<Message>> = _notificationList
 
+    /**
+     * Slack added on top of a toast's own duration before it is dropped from
+     * [notificationList], so the host UI gets to run its dismiss animation first.
+     * Tests shrink it to keep the fast tier fast.
+     */
+    protected open val expiryGrace: Duration = 1.seconds
+
     fun pushNotification(toast: Message) {
         _notificationList.update { listOf(toast) + it }
+        // A host may be hidden or unmounted while the toast is up, in which case
+        // its own dismiss timer never runs and the toast would linger and resurface
+        // the next time the host shows. Expire it here regardless.
+        toast.duration?.let { duration ->
+            ioCoroutineDispatcher.launch {
+                delay(duration.milliseconds + expiryGrace)
+                removeNotification(toast.messageId)
+            }
+        }
     }
 
     fun removeNotification(messageId: Int) {
```

**File**: `app/src/desktopMain/kotlin/com/crosspaste/DesktopUiModule.kt` (modified, +1/-0)
```diff
@@ -73,6 +73,7 @@ fun desktopUiModule(): Module =
                 lazy { get() },
                 lazy { get() },
                 lazy { get() },
+                lazy { get() },
                 get(),
                 get(),
             )
```

**File**: `app/src/desktopMain/kotlin/com/crosspaste/app/DesktopAppWindowManager.kt` (modified, +3/-0)
```diff
@@ -9,6 +9,7 @@ import com.crosspaste.config.DesktopConfigManager
 import com.crosspaste.listener.ShortcutKeys
 import com.crosspaste.listener.ShortcutKeysAction
 import com.crosspaste.listener.ShortcutKeysListener
+import com.crosspaste.notification.NotificationManager
 import com.crosspaste.path.UserDataPathProvider
 import com.crosspaste.platform.Platform
 import com.crosspaste.utils.GlobalCoroutineScope.mainCoroutineDispatcher
@@ -31,6 +32,7 @@ fun getDesktopAppWindowManager(
     lazyShortcutKeys: Lazy<ShortcutKeys>,
     lazyShortcutKeysAction: Lazy<ShortcutKeysAction>,
     lazyShortcutKeysListener: Lazy<ShortcutKeysListener>,
+    lazyNotificationManager: Lazy<NotificationManager>,
     platform: Platform,
     userDataPathProvider: UserDataPathProvider,
 ): DesktopAppWindowManager =
@@ -58,6 +60,7 @@ fun getDesktopAppWindowManager(
             lazyShortcutKeys,
             lazyShortcutKeysAction,
             lazyShortcutKeysListener,
+            lazyNotificationManager,
             userDataPathProvider,
         )
     } else {
```

**File**: `app/src/desktopMain/kotlin/com/crosspaste/app/LinuxAppWindowManager.kt` (modified, +48/-12)
```diff
@@ -5,6 +5,8 @@ import com.crosspaste.listener.DesktopShortcutKeys.Companion.PASTE
 import com.crosspaste.listener.ShortcutKeys
 import com.crosspaste.listener.ShortcutKeysAction
 import com.crosspaste.listener.ShortcutKeysListener
+import com.crosspaste.notification.MessageType
+import com.crosspaste.notification.NotificationManager
 import com.crosspaste.path.UserDataPathProvider
 import com.crosspaste.platform.linux.LinuxActiveAppResolver
 import com.crosspaste.platform.linux.LinuxDesktopAppIcon
@@ -29,6 +31,7 @@ class LinuxAppWindowManager(
     private val lazyShortcutKeys: Lazy<ShortcutKeys>,
     private val lazyShortcutKeysAction: Lazy<ShortcutKeysAction>,
     private val lazyShortcutKeysListener: Lazy<ShortcutKeysListener>,
+    private val lazyNotificationManager: Lazy<NotificationManager>,
     private val userDataPathProvider: UserDataPathProvider,
 ) : DesktopAppWindowManager(appSize) {
 
@@ -39,6 +42,10 @@ class LinuxAppWindowManager(
     // X11-only either way) keep the _NET_ACTIVE_WINDOW path.
     private val activeAppResolver = LinuxActiveAppResolver.detect()
 
+    // Paste-back targets the X11 focus, so outside an X11 session the answer can
+    // be a stale one. See [notifyManualPasteRequired].
+    private val isWaylandSession = LinuxActiveAppResolver.isWaylandSession()
+
     private val classNameSet: MutableSet<String> = ConcurrentSet()
 
     private var _cachedMainWindow: Window? = null
@@ -160,7 +167,7 @@ class LinuxAppWindowManager(
     }
 
     override fun saveCurrentActiveAppInfo() {
-        prevLinuxAppInfo.value = X11Api.getActiveWindow()
+        prevLinuxAppInfo.value = X11Api.getActiveWindow(requireXInputFocus = isWaylandSession)
     }
 
     override suspend fun focusMainWindow(windowTrigger: WindowTrigger) {
@@ -207,26 +214,55 @@ class LinuxAppWindowManager(
     }
 
     private suspend fun bringToBack(toPaste: Boolean) {
+        val prevAppInfo = prevLinuxAppInfo.value
         if (toPaste) {
-            val keyCodes =
-                lazyShortcutKeys.value.shortcutKeysCore.value.keys[PASTE]?.let {
-                    it.map { key -> key.rawCode }
-                } ?: listOf()
-            bringToBack(prevLinuxAppInfo.value, keyCodes)
+            if (prevAppInfo == null) {
+                if (isWaylandSession) {
+                    notifyManualPasteRequired()
+                }
+                return
+            }
+            bringToBack(prevAppInfo, pasteKeyCodes())
         } else {
-            bringToBack(prevLinuxAppInfo.value)
+            bringToBack(prevAppInfo)
         }
     }
 
     override suspend fun toPaste() {
-        val keyCodes =
-            lazyShortcutKeys.value.shortcutKeysCore.value.keys[PASTE]?.let {
-                it.map { key -> key.rawCode }
-            } ?: listOf()
+        // XTest delivers to whatever holds the X input focus, so an X11 session needs
+        // no target of its own. In a Wayland session that focus is withdrawn while a
+        // native Wayland window is focused, and injecting would hit a stale X window.
+        if (isWaylandSession && X11Api.getActiveWindow(requireXInputFocus = true) == null) {
+            notifyManualPasteRequired()
+            return
+        }
         lazyShortcutKeysListener.value.beginPasteSuppression(
             ShortcutKeysListener.PASTE_INJECTION_SUPPRESS_TIMEOUT,
         )
-        X11Api.toPaste(keyCodes)
+        X11Api.toPaste(pasteKeyCodes())
+    }
+
+    private fun pasteKeyCodes(): List<Int> =
+        lazyShortcutKeys.value.shortcutKeysCore.value.keys[PASTE]
+            ?.map { key -> key.rawCode }
+            ?: listOf()
+
+    /**
+     * Auto-paste is a synthetic paste shortcut sent through XTest, which only ever
+     * reaches X11 and XWayland clients. While a native Wayland window is focused
+     * the X11 input focus is withdrawn, so there is no app we may safely target:
+     * injecting anyway would deliver the keystroke to whichever X client happened
+     * to ho
```

**File**: `app/src/desktopMain/kotlin/com/crosspaste/platform/linux/LinuxActiveAppResolver.kt` (modified, +6/-18)
```diff
@@ -2,9 +2,7 @@ package com.crosspaste.platform.linux
 
 import com.crosspaste.platform.linux.api.WMCtrl
 import com.crosspaste.platform.linux.api.X11Api
-import com.sun.jna.platform.unix.X11
 import com.sun.jna.platform.unix.X11.Window
-import com.sun.jna.ptr.IntByReference
 import io.github.oshai.kotlinlogging.KotlinLogging
 
 /**
@@ -40,11 +38,12 @@ interface LinuxActiveAppResolver {
          * Picks the best resolver for the current session. The [env] parameter
          * exists for tests; production callers use the real environment.
          */
+        fun isWaylandSession(env: (String) -> String? = System::getenv): Boolean =
+            env("XDG_SESSION_TYPE")?.equals("wayland", ignoreCase = true) == true ||
+                env("WAYLAND_DISPLAY") != null
+
         fun detect(env: (String) -> String? = System::getenv): LinuxActiveAppResolver {
-            val isWayland =
-                env("XDG_SESSION_TYPE")?.equals("wayland", ignoreCase = true) == true ||
-                    env("WAYLAND_DISPLAY") != null
-            if (!isWayland) {
+            if (!isWaylandSession(env)) {
                 logger.info { "Active app resolver: X11 (X11 session)" }
                 return X11ActiveAppResolver(guardAgainstStaleFocus = false)
             }
@@ -89,7 +88,7 @@ class X11ActiveAppResolver(
             val x11 = X11Api.INSTANCE
             val display = x11.XOpenDisplay(null) ?: return null
             try {
-                if (guardAgainstStaleFocus && !hasXInputFocus(x11, display)) {
+                if (guardAgainstStaleFocus && !X11Api.hasXInputFocus(display)) {
                     logger.debug { "X input focus withdrawn (Wayland window focused), no source" }
                     null
                 } else {
@@ -106,15 +105,4 @@ class X11ActiveAppResolver(
             logger.warn(e) { "Failed to resolve active app via X11" }
             null
         }
-
-    private fun hasXInputFocus(
-        x11: X11Api,
-        display: X11.Display,
-    ): Boolean {
-        val focusReturn = X11.WindowByReference()
-        val revertToReturn = IntByReference()
-        x11.XGetInputFocus(display, focusReturn, revertToReturn)
-        // None (0) and PointerRoot (1) mean no real X window holds the focus.
-        return (focusReturn.value?.toLong() ?: 0L) > 1L
-    }
 }
```

---

### Incident Patch 7: `327c3009` (2026-09-27)
**Commit Message**: :bug: create the paste panel windows as override-redirect on Linux so a click keeps the target app focused (#5064)

**File**: `app/src/desktopMain/kotlin/com/crosspaste/ui/NonActivatingWindow.kt` (modified, +9/-2)
```diff
@@ -34,8 +34,12 @@ import kotlin.math.roundToInt
  * JBR does not expose that flag (Window.Type.POPUP is an ordinary NSWindow there), but it
  * does allocate an NSPanel for a root pane marked `Window.hidesOnDeactivate`; the flag is
  * then switched on natively once the peer exists, see [MacNonActivatingEffect].
- * Non-focusable state plus WS_EX_NOACTIVATE cover Windows; X11 honours the non-focusable
- * hint on its own.
+ * Non-focusable state plus WS_EX_NOACTIVATE cover Windows. On Linux the window is an
+ * override-redirect X window (that is what XAWT makes of Window.Type.POPUP): the window
+ * manager never sees it, so a click cannot go through its click-to-focus path. A managed
+ * window with only the non-focusable hint still did, and on X11 sessions that pulled
+ * keyboard focus off the app being pasted into, so the injected Ctrl+V landed nowhere.
+ * Compose's own popups and tooltips use the same mechanism.
  */
 @Composable
 fun NonActivatingWindow(
@@ -49,6 +53,7 @@ fun NonActivatingWindow(
     val platform = koinInject<Platform>()
     val isMac = remember { platform.isMacos() }
     val isWindows = remember { platform.isWindows() }
+    val isLinux = remember { platform.isLinux() }
 
     SwingWindow(
         visible = visible,
@@ -58,6 +63,8 @@ fun NonActivatingWindow(
                     // Makes AWT back the window with an NSPanel; the flag itself is
                     // reset in MacNonActivatingEffect.
                     rootPane.putClientProperty("Window.hidesOnDeactivate", true)
+                } else if (isLinux) {
+                    type = java.awt.Window.Type.POPUP
                 }
                 defaultCloseOperation = WindowConstants.DO_NOTHING_ON_CLOSE
                 this.title = title
```

---

### Incident Patch 8: `399a3a70` (2026-09-27)
**Commit Message**: :bug: give the paste panel button menu an opaque theme background on Linux (#5063)

**File**: `app/src/desktopMain/kotlin/com/crosspaste/ui/PastePanelButtonWindow.kt` (modified, +14/-2)
```diff
@@ -1,12 +1,15 @@
 package com.crosspaste.ui
 
+import androidx.compose.material3.MaterialTheme
 import androidx.compose.runtime.Composable
 import androidx.compose.runtime.DisposableEffect
 import androidx.compose.runtime.LaunchedEffect
 import androidx.compose.runtime.collectAsState
 import androidx.compose.runtime.getValue
 import androidx.compose.runtime.remember
+import androidx.compose.ui.graphics.Color
 import androidx.compose.ui.graphics.painter.Painter
+import androidx.compose.ui.graphics.toArgb
 import androidx.compose.ui.unit.dp
 import androidx.compose.ui.window.WindowPosition
 import com.crosspaste.app.DesktopAppWindowManager
@@ -99,6 +102,7 @@ fun PastePanelButtonWindow(windowIcon: Painter?) {
         fun showMenu(
             x: Int,
             y: Int,
+            surface: Color,
         ) {
             if (isWindows) {
                 WindowsPopupMenu.show(menuEntries()) { action ->
@@ -115,15 +119,23 @@ fun PastePanelButtonWindow(windowIcon: Painter?) {
                     NativeMenuEntry.Separator -> menu.addSeparator()
                 }
             }
-            menu.show(window, x, y)
+            // XAWT paints the menu in the background colour of the component it is shown
+            // over, and a transparent window's own background is fully transparent, which left the
+            // Linux menu see-through. The content pane never paints inside a transparent
+            // window, so its colour is free to carry the theme surface for the menu; XAWT
+            // derives a readable text colour from it in either theme.
+            val contentPane = window.contentPane
+            contentPane.background = java.awt.Color(surface.toArgb())
+            menu.show(contentPane, x, y)
         }
 
         PastePanelWindowContext {
+            val menuSurface = MaterialTheme.colorScheme.surface
             PastePanelButtonContent(
                 window = window,
                 panelOpen = panelInfo.show,
                 onClick = { appWindowManager.switchPastePanelWindow(WindowTrigger.SYSTEM) },
-                onSecondaryClick = ::showMenu,
+                onSecondaryClick = { x, y -> showMenu(x, y, menuSurface) },
                 onMoved = { x, y ->
                     appWindowManager.movePastePanelButton(WindowPosition(x.dp, y.dp))
                 },
```

---

### Incident Patch 9: `c3e20971` (2026-09-27)
**Commit Message**: :bug: fix the paste panel corners and button menu glyphs on Windows (#5062)

**File**: `app/src/desktopMain/kotlin/com/crosspaste/platform/windows/WindowsPopupMenu.kt` (added, +167/-0)
```diff
@@ -0,0 +1,167 @@
+package com.crosspaste.platform.windows
+
+import com.crosspaste.platform.windows.api.User32
+import com.crosspaste.ui.base.NativeMenuEntry
+import com.sun.jna.Function
+import com.sun.jna.platform.win32.Kernel32
+import com.sun.jna.platform.win32.WinDef.HWND
+import com.sun.jna.platform.win32.WinDef.LPARAM
+import com.sun.jna.platform.win32.WinDef.POINT
+import com.sun.jna.platform.win32.WinDef.WPARAM
+import com.sun.jna.platform.win32.WinUser
+import io.github.oshai.kotlinlogging.KotlinLogging
+import java.util.concurrent.CompletableFuture
+import java.util.concurrent.atomic.AtomicReference
+
+/**
+ * Win32 context menu drawn by the system, for windows that cannot use AWT's PopupMenu.
+ *
+ * AWT owner-draws its heavyweight menus through the logical-font tables of `fontconfig`,
+ * and since the default encoding became UTF-8 (JDK 18) the Windows tables carry no
+ * Chinese ranges at all: every CJK label renders as boxes, whatever font the menu is
+ * given, because `PlatformFont` maps any physical family back to the logical one. A
+ * plain Win32 menu is rendered by Windows with the system UI font and its font linking,
+ * so every language displays.
+ *
+ * `TrackPopupMenu` runs a modal loop on the calling thread and needs an owner window that
+ * this thread created and that is in the foreground, so the menu has a thread of its own
+ * with a hidden owner and a message loop, like the clipboard listeners.
+ */
+object WindowsPopupMenu {
+
+    private val logger = KotlinLogging.logger {}
+
+    private val user32 = User32.INSTANCE
+    private val getMessageW = Function.getFunction("user32", "GetMessageW", Function.ALT_CONVENTION)
+
+    private const val WM_SHOW_MENU = User32.WM_USER + 1
+
+    private const val TRACK_FLAGS =
+        User32.TPM_LEFTALIGN or
+            User32.TPM_TOPALIGN or
+            User32.TPM_RIGHTBUTTON or
+            User32.TPM_RETURNCMD or
+            User32.TPM_NONOTIFY
+
+    private class Request(
+        val entries: List<NativeMenuEntry>,
+        val dispatch: (() -> Unit) -> Unit,
+    )
+
+    private val pendingRequest = AtomicReference<Request?>()
+
+    @Volatile
+    private var isTracking = false
+
+    // Held in a field so the JNA callback stub outlives the window that uses it
+    private val wndProc =
+        User32.WNDPROC { hWnd, uMsg, wParam, lParam ->
+            handleMessage(hWnd, uMsg, wParam, lParam)
+        }
+
+    private val owner: HWND by lazy { startMenuThread() }
+
+    /**
+     * Opens the menu at the mouse cursor and returns at once. The chosen item's action is
+     * handed to [dispatch] from the menu thread, so the caller picks where it runs.
+     */
+    fun show(
+        entries: List<NativeMenuEntry>,
+        dispatch: (() -> Unit) -> Unit,
+    ) {
+        pendingRequest.set(Request(entries, dispatch))
+        user32.PostMessage(owner, WM_SHOW_MENU, WPARAM(0), LPARAM(0))
+    }
+
+    private fun startMenuThread(): HWND {
+        val created = CompletableFuture<HWND>()
+        Thread({ runMessageLoop(created) }, "WindowsPopupMenu").apply { isDaemon = true }.start()
+        return created.get()
+    }
+
+    private fun runMessageLoop(created: CompletableFuture<HWND>) {
+        val hwnd = user32.CreateWindowEx(0, "STATIC", "CrossPastePopupMenu", 0, 0, 0, 0, 0, null, 0, 0, null)
+        if (hwnd == null) {
+            created.completeExceptionally(
+                IllegalStateException("CreateWindowEx failed: ${Kernel32.INSTANCE.GetLastError()}"),
+            )
+            return
+        }
+        user32.SetWindowLongPtr(hwnd, User32.GWL_WNDPROC, wndProc)
+        created.complete(hwnd)
+
+        val msg = WinUser.MSG()
+        while (getMessageW.invokeInt(arrayOf(msg, null, 0, 0)) > 0) {
+            user32.TranslateMessage(msg)
+            user32.DispatchMessage(msg)
+        }
+    }
+
+    private fun handleMessage(
+        hWnd: HWND?,
+        uMsg: Int,
+        wParam: WPARAM?,
+        lParam: LPARAM?,

```

**File**: `app/src/desktopMain/kotlin/com/crosspaste/platform/windows/api/User32.kt` (modified, +38/-0)
```diff
@@ -2,6 +2,7 @@ package com.crosspaste.platform.windows.api
 
 import com.sun.jna.Native
 import com.sun.jna.Pointer
+import com.sun.jna.platform.win32.WinDef.HMENU
 import com.sun.jna.platform.win32.WinDef.HWND
 import com.sun.jna.platform.win32.WinDef.LPARAM
 import com.sun.jna.platform.win32.WinDef.WPARAM
@@ -108,6 +109,30 @@ interface User32 : com.sun.jna.platform.win32.User32 {
         nMaxCount: Int,
     ): Int
 
+    fun CreatePopupMenu(): HMENU?
+
+    fun EndMenu(): Boolean
+
+    fun AppendMenu(
+        hMenu: HMENU,
+        uFlags: Int,
+        uIDNewItem: Int,
+        lpNewItem: String?,
+    ): Boolean
+
+    /** With [TPM_RETURNCMD] the result is the chosen item id, 0 when the menu was dismissed. */
+    fun TrackPopupMenu(
+        hMenu: HMENU,
+        uFlags: Int,
+        x: Int,
+        y: Int,
+        nReserved: Int,
+        hWnd: HWND,
+        prcRect: Pointer?,
+    ): Int
+
+    fun DestroyMenu(hMenu: HMENU): Boolean
+
     companion object {
         val INSTANCE =
             Native.load(
@@ -116,7 +141,9 @@ interface User32 : com.sun.jna.platform.win32.User32 {
                 DEFAULT_OPTIONS + mapOf("allow-get-last-error" to true),
             ) as User32
         const val GWL_WNDPROC = -4
+        const val WM_NULL = 0x0000
         const val WM_DESTROY = 0x0002
+        const val WM_USER = 0x0400
         const val WM_RENDERFORMAT = 0x0305
         const val WM_RENDERALLFORMATS = 0x0306
         const val WM_CLIPBOARDUPDATE = 0x031D
@@ -128,6 +155,17 @@ interface User32 : com.sun.jna.platform.win32.User32 {
         const val PM_REMOVE = 0x0001
         const val PM_NOYIELD = 0x0002
         const val QS_KEY = 0x0001
+
+        /**
+         * Menu flags
+         */
+        const val MF_STRING = 0x0000
+        const val MF_SEPARATOR = 0x0800
+        const val TPM_LEFTALIGN = 0x0000
+        const val TPM_TOPALIGN = 0x0000
+        const val TPM_RIGHTBUTTON = 0x0002
+        const val TPM_NONOTIFY = 0x0080
+        const val TPM_RETURNCMD = 0x0100
         const val QS_MOUSEMOVE = 0x0002
         const val QS_MOUSEBUTTON = 0x0004
         const val QS_POSTMESSAGE = 0x0008
```

**File**: `app/src/desktopMain/kotlin/com/crosspaste/ui/PastePanelButtonWindow.kt` (modified, +49/-26)
```diff
@@ -15,18 +15,24 @@ import com.crosspaste.app.WindowTrigger
 import com.crosspaste.config.DesktopConfigManager
 import com.crosspaste.i18n.GlobalCopywriter
 import com.crosspaste.platform.Platform
+import com.crosspaste.platform.windows.WindowsPopupMenu
 import com.crosspaste.ui.DesktopContext.PastePanelWindowContext
 import com.crosspaste.ui.base.MenuHelper
+import com.crosspaste.ui.base.NativeMenuEntry
 import com.crosspaste.ui.paste.panel.PastePanelButtonContent
+import com.crosspaste.utils.GlobalCoroutineScope.mainCoroutineDispatcher
+import kotlinx.coroutines.launch
 import org.koin.compose.koinInject
+import java.awt.MenuItem
 import java.awt.PopupMenu
 
 /**
  * Floating round button that opens and closes [PastePanelWindow]. It is toggled by the
  * `show_paste_panel` shortcut, can be dragged anywhere, and like the panel never
  * activates CrossPaste when clicked. A right click opens a native menu: Compose popups
- * would be clipped to this tiny window, while the AWT menu is a system menu that works
- * even though the window never activates.
+ * would be clipped to this tiny window, while a system menu works even though the window
+ * never activates. On Windows that is a Win32 menu, see [WindowsPopupMenu] for why the
+ * AWT one cannot be used there.
  */
 @Composable
 fun PastePanelButtonWindow(windowIcon: Painter?) {
@@ -47,6 +53,7 @@ fun PastePanelButtonWindow(windowIcon: Painter?) {
     val panelInfo by appWindowManager.pastePanelWindowInfo.collectAsState()
 
     val isMac = remember { platform.isMacos() }
+    val isWindows = remember { platform.isWindows() }
 
     NonActivatingWindow(
         visible = buttonInfo.show,
@@ -61,38 +68,54 @@ fun PastePanelButtonWindow(windowIcon: Painter?) {
         }
 
         val window = this.window
-        val popupMenu = remember(window) { PopupMenu().also { window.add(it) } }
+        val popupMenu =
+            if (isWindows) {
+                null
+            } else {
+                remember(window) { PopupMenu().also { window.add(it) } }
+            }
         DisposableEffect(window) {
-            onDispose { window.remove(popupMenu) }
+            onDispose {
+                popupMenu?.let { window.remove(it) }
+            }
         }
 
-        fun menuItem(
-            label: String,
-            action: () -> Unit,
-        ) = java.awt.MenuItem(label).apply { addActionListener { action() } }
-
-        // Rebuilt on every open so the labels follow the current language
-        fun showMenu(
-            x: Int,
-            y: Int,
-        ) {
-            popupMenu.removeAll()
-            popupMenu.add(
-                menuItem(copywriter.getText("show_main")) {
+        // Built on every open so the labels follow the current language
+        fun menuEntries(): List<NativeMenuEntry> =
+            listOf(
+                NativeMenuEntry.Item(copywriter.getText("show_main")) {
                     appWindowManager.showMainWindow(WindowTrigger.MENU)
                 },
-            )
-            popupMenu.add(menuItem(menuHelper.settings.title(copywriter), menuHelper.settings.action))
-            popupMenu.add(menuItem(menuHelper.shortcutKeys.title(copywriter), menuHelper.shortcutKeys.action))
-            popupMenu.addSeparator()
-            popupMenu.add(
-                menuItem(copywriter.getText("hide_paste_panel_button")) {
+                NativeMenuEntry.Item(menuHelper.settings.title(copywriter), menuHelper.settings.action),
+                NativeMenuEntry.Item(menuHelper.shortcutKeys.title(copywriter), menuHelper.shortcutKeys.action),
+                NativeMenuEntry.Separator,
+                NativeMenuEntry.Item(copywriter.getText("hide_paste_panel_button")) {
                     configManager.updateConfig("showPastePanelButton", false)
                 },
+                NativeMenuEntry.Separator,
+                NativeMenuEntry.Item(copywriter.getText("quit")) { applicationExit(ExitMode.EXIT) },
             )
-         
```

**File**: `app/src/desktopMain/kotlin/com/crosspaste/ui/PastePanelWindow.kt` (modified, +14/-12)
```diff
@@ -9,10 +9,10 @@ import androidx.compose.runtime.remember
 import androidx.compose.ui.graphics.painter.Painter
 import com.crosspaste.app.DesktopAppWindowManager
 import com.crosspaste.platform.Platform
-import com.crosspaste.platform.windows.WindowsVersionHelper
 import com.crosspaste.ui.DesktopContext.PastePanelWindowContext
 import com.crosspaste.ui.model.PastePanelViewModel
 import com.crosspaste.ui.paste.panel.PastePanelContent
+import com.crosspaste.ui.paste.panel.PastePanelSurface
 import com.crosspaste.ui.theme.ThemeDetector
 import org.koin.compose.koinInject
 
@@ -35,11 +35,18 @@ fun PastePanelWindow(windowIcon: Painter?) {
     val isDarkTheme = themeConfig.resolveIsDark(isSystemInDarkTheme())
 
     val isMac = remember { platform.isMacos() }
-    val isWindowsAndSupportBlurEffect =
-        remember {
-            platform.isWindows() && WindowsVersionHelper.isWindows11_22H2OrGreater
+    val isWindows = remember { platform.isWindows() }
+
+    // macOS blurs the desktop behind the window itself. Windows gets a per-pixel-alpha
+    // window only so the panel can paint its own rounded card: DWM never rounds a layered
+    // window and its system backdrop would fill the whole rectangle behind the corners,
+    // so neither the corner preference nor the blur effect is usable here.
+    val surface =
+        when {
+            isMac -> PastePanelSurface.ACRYLIC
+            isWindows -> PastePanelSurface.CARD
+            else -> PastePanelSurface.PLAIN
         }
-    val transparent = isMac || isWindowsAndSupportBlurEffect
 
     LaunchedEffect(windowInfo.show) {
         if (windowInfo.show) {
@@ -51,23 +58,18 @@ fun PastePanelWindow(windowIcon: Painter?) {
         visible = windowInfo.show,
         state = windowInfo.state,
         title = appWindowManager.pastePanelWindowTitle,
-        transparent = transparent,
+        transparent = surface != PastePanelSurface.PLAIN,
         onClosing = { appWindowManager.hidePastePanelWindow() },
     ) {
         if (isMac) {
             MacAcrylicEffect(
                 window = this.window,
                 isDark = isDarkTheme,
             )
-        } else if (isWindowsAndSupportBlurEffect) {
-            WindowsBlurEffect(
-                window = this.window,
-                isDark = isDarkTheme,
-            )
         }
 
         PastePanelWindowContext {
-            PastePanelContent(transparent = transparent)
+            PastePanelContent(surface = surface)
         }
     }
 }
```

**File**: `app/src/desktopMain/kotlin/com/crosspaste/ui/base/NativeMenuEntry.kt` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+package com.crosspaste.ui.base
+
+/** One row of a system context menu: a labelled command or a separator line. */
+sealed interface NativeMenuEntry {
+    class Item(
+        val label: String,
+        val action: () -> Unit,
+    ) : NativeMenuEntry
+
+    data object Separator : NativeMenuEntry
+}
```

---

### Incident Patch 10: `f32c19b5` (2026-09-23)
**Commit Message**: :bug: run the ws-session sync handlers on the test dispatcher to fix a CI flake (#5058)

GeneralSyncManagerTest's two ws-session tests build handlers through
GeneralSyncManager.createSyncHandler, which hardcoded
namedScope(ioDispatcher, "GeneralSyncHandler"). The handler and its
SyncPollingManager therefore ran on real Dispatchers.IO threads while the
test drove virtual time.

The verified path — registerSession -> onSessionOpened -> fastReconnect ->
SyncPollingManager.reset() -> forceResolve() -> emitEvent — suspends on
reset()'s stateMutex. The polling loop grabs that same mutex on its first
waitForNextExecution (nextExecutionTime starts at 0), on an IO thread the
test scheduler knows nothing about. When the two collide, advanceUntilIdle()
returns with fastReconnect still parked on the mutex and the verify fails
with "emitEvent was not called". That is what run 35852991873 hit on main;
the same commit had passed on its PR branch minutes earlier.

createSyncHandler now takes its scope from a syncHandlerScopeFactory
constructor parameter, defaulting to the current behaviour. It is a factory
rather than a scope because SyncHandler.cancelScope() must only tear down
its own handler. T

**File**: `app/src/commonMain/kotlin/com/crosspaste/sync/GeneralSyncManager.kt` (modified, +7/-1)
```diff
@@ -47,6 +47,12 @@ class GeneralSyncManager(
     private val syncClientApi: SyncClientApi,
     private val wsSessionManager: WsSessionManager,
     private val pairingCapabilityFlag: PairingCapabilityFlag,
+    // Each handler owns its scope — cancelScope() must only tear down that one
+    // handler — so this is a factory, not a shared scope. Tests substitute the
+    // test dispatcher here to keep the whole handler chain on virtual time.
+    private val syncHandlerScopeFactory: () -> CoroutineScope = {
+        namedScope(ioDispatcher, "GeneralSyncHandler")
+    },
 ) : SyncManager {
 
     private val logger = KotlinLogging.logger {}
@@ -195,7 +201,7 @@ class GeneralSyncManager(
     }
 
     override fun createSyncHandler(syncRuntimeInfo: SyncRuntimeInfo): SyncHandler =
-        GeneralSyncHandler(syncRuntimeInfo, ::emitEvent)
+        GeneralSyncHandler(syncRuntimeInfo, ::emitEvent, syncHandlerScopeFactory())
 
     override fun ignoreVerify(appInstanceId: String) {
         _ignoreVerifySet.update { it + appInstanceId }
```

**File**: `app/src/desktopTest/kotlin/com/crosspaste/sync/GeneralSyncManagerTest.kt` (modified, +25/-3)
```diff
@@ -22,7 +22,9 @@ import io.mockk.runs
 import kotlinx.coroutines.CoroutineScope
 import kotlinx.coroutines.ExperimentalCoroutinesApi
 import kotlinx.coroutines.Job
+import kotlinx.coroutines.cancel
 import kotlinx.coroutines.flow.MutableStateFlow
+import kotlinx.coroutines.job
 import kotlinx.coroutines.test.advanceTimeBy
 import kotlinx.coroutines.test.advanceUntilIdle
 import kotlinx.coroutines.test.runTest
@@ -36,6 +38,14 @@ import kotlin.test.assertTrue
 @OptIn(ExperimentalCoroutinesApi::class)
 class GeneralSyncManagerTest {
 
+    private companion object {
+        // The ws tests put the sync handlers on the test dispatcher, which brings
+        // SyncPollingManager's `while (isActive) { delay(...) }` loop onto virtual
+        // time — advanceUntilIdle() would never return. Advance a bounded amount
+        // instead: enough for the handler chain, short of the polling wall clock.
+        const val SMALL_ADVANCE_MS = 100L
+    }
+
     @Test
     fun pairingCredentialType_requiresBothPeersForV3() {
         assertEquals(PairingCredentialType.V3_PIN, selectPairingCredentialType(3, 3))
@@ -44,6 +54,14 @@ class GeneralSyncManagerTest {
         assertEquals(PairingCredentialType.QR_BEARER_TOKEN, selectPairingCredentialType(3, null))
     }
 
+    /**
+     * A handler scope on the test dispatcher: a child of [this] so the test's
+     * childScope.cancel() stops the polling loops, but with its own Job so
+     * SyncHandler.cancelScope() still only tears down that one handler.
+     */
+    private fun CoroutineScope.handlerScope(): CoroutineScope =
+        CoroutineScope(coroutineContext + Job(coroutineContext.job))
+
     private fun createMocks(): Mocks =
         Mocks(
             deviceScopeFactory = mockk(relaxed = true),
@@ -127,9 +145,10 @@ class GeneralSyncManagerTest {
                     syncClientApi = mocks.syncClientApi,
                     wsSessionManager = wsSessionManager,
                     pairingCapabilityFlag = PairingCapabilityFlag(2),
+                    syncHandlerScopeFactory = { childScope.handlerScope() },
                 )
             syncManager.start()
-            advanceUntilIdle()
+            advanceTimeBy(SMALL_ADVANCE_MS)
 
             val wsSession =
                 WsSession(
@@ -139,7 +158,7 @@ class GeneralSyncManagerTest {
                     syncRuntimeInfo.appInstanceId,
                 )
             wsSessionManager.registerSession(syncRuntimeInfo.appInstanceId, wsSession)
-            advanceUntilIdle()
+            advanceTimeBy(SMALL_ADVANCE_MS)
 
             coVerify(exactly = 1) {
                 mocks.syncResolver.emitEvent(
@@ -149,6 +168,7 @@ class GeneralSyncManagerTest {
                     },
                 )
             }
+            childScope.cancel()
         }
 
     @Test
@@ -185,9 +205,10 @@ class GeneralSyncManagerTest {
                     syncClientApi = mocks.syncClientApi,
                     wsSessionManager = wsSessionManager,
                     pairingCapabilityFlag = PairingCapabilityFlag(2),
+                    syncHandlerScopeFactory = { childScope.handlerScope() },
                 )
             syncManager.start()
-            advanceUntilIdle()
+            advanceTimeBy(SMALL_ADVANCE_MS)
 
             // The post-write isConnected re-check must fire even though the
             // opened callback never saw a handler.
@@ -199,6 +220,7 @@ class GeneralSyncManagerTest {
                     },
                 )
             }
+            childScope.cancel()
         }
 
     private fun createTestSyncRuntimeInfo(
```

#### Recent Merged Pull Requests:
- **PR #5081** (2026-09-30): Show sort direction with arrow icons and state-specific tooltips in the search bar (@guiyanakuang)
- **PR #5079** (2026-09-29): :bug: fix multi-monitor placement, clipping and focus handling for Linux paste panel menu (@guiyanakuang)
- **PR #5078** (2026-09-29): Close the floating button's menu on Linux when the user clicks elsewhere (@guiyanakuang)
- **PR #5076** (2026-09-29): Let the floating button fade back on Linux when no pointer exit arrives (@guiyanakuang)
- **PR #5074** (2026-09-28): Name what a clipboard write includes with PasteWriteScope (@guiyanakuang)
- **PR #5072** (2026-09-28): Offer a URL paste item as plain text so non-Java apps can paste it (@guiyanakuang)
- **PR #5070** (2026-09-28): :bug: keep GuidePasteDataService.initData from throwing into host startup code (@guiyanakuang)
- **PR #5068** (2026-09-29): Paste into native Wayland windows through the RemoteDesktop portal (@guiyanakuang)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
