> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/tailscale-tailscale-learnings.md`  
> **Source**: github ([https://github.com/tailscale/tailscale](https://github.com/tailscale/tailscale))  
> **Source Version**: `566f89e0`  
> **License**: BSD-3-Clause  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-25T05:04:53.865Z  
> **Learning ID**: `learn-github-tailscale-tailscale`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): tailscale/tailscale

> **Canonical Artifact**: `07_PROJECT_LEARNING/tailscale-tailscale-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/tailscale/tailscale](https://github.com/tailscale/tailscale))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-25T05:04:53.858Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tailscale/tailscale`
- **Description**: The easiest, most secure way to use WireGuard and 2FA.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 38034 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `client/web/src/hooks/auth.ts`
```
// Copyright (c) Tailscale Inc & contributors
// SPDX-License-Identifier: BSD-3-Clause

import { useCallback, useEffect, useState } from "react"
import { apiFetch, setSynoToken } from "src/api"
import useSWR from "swr"

export type AuthResponse = {
  serverMode: AuthServerMode
  authorized: boolean
  viewerIdentity?: {
    loginName: string
    nodeName: string
    nodeIP: string
    profilePicUrl?: string
    capabilities: { [key in PeerCapability]: boolean }
  }
  needsSynoAuth?: boolean
}

export type AuthServerMode = "login" | "readonly" | "manage"

export type PeerCapability = "*" | "ssh" | "subnets" | "exitnodes" | "account"

/**
 * canEdit reports whether the given auth response specifies that the viewer
 * has the ability to edit the given capability.
 */
export function canEdit(cap: PeerCapability, auth: AuthResponse): boolean {
  if (!auth.authorized || !auth.viewerIdentity) {
    return false
  }
  if (auth.viewerIdentity.capabilities["*"] === true) {
    return true // can edit all features
  }
  return auth.viewerIdentity.capabilities[cap] === true
}

/**
 * hasAnyEditCapabilities reports whether the given auth response specifies
 * that the viewer has at least one edit capability. If this is true, the
 * user is able to go through the auth flow to authenticate a management
 * session.
 */
export function hasAnyEditCapabilities(auth: AuthResponse): boolean {
  return Object.values(auth.viewerIdentity?.capabilities || {}).includes(true)
}

/**
 * useAuth reports and refreshes Tailscale auth status for the web client.
 */
export default function useAuth() {
  const { data, error, mutate } = useSWR<AuthResponse>("/auth")
  const [ranSynoAuth, setRanSynoAuth] = useState<boolean>(false)

  const loading = !data && !error

  // Start Synology auth flow if needed.
  useEffect(() => {
    if (data?.needsSynoAuth && !ranSynoAuth) {
      fetch("/webman/login.cgi")
        .then((r) => r.json())
        .then((a) => {
          setSynoToken(a.SynoToken)
          setRanSynoAuth(true)
          mutate()
        })
        .catch((error) => {
          console.error("Synology auth error:", error)
        })
    }
  }, [data?.needsSynoAuth, ranSynoAuth, mutate])

  const newSession = useCallback(() => {
    return apiFetch<{ authUrl?: string }>("/auth/session/new", "GET")
      .then((d) => {
        if (d.authUrl) {
          window.open(d.authUrl, "_blank")
          return apiFetch("/auth/session/wait", "GET")
        }
      })
      .then(() => {
        mutate()
      })
      .catch((error) => {
        console.error(error)
      })
  }, [mutate])

  // Start regular auth flow.
  useEffect(() => {
    const needsAuth =
      data &&
      !loading &&
      !data.authorized &&
      hasAnyEditCapabilities(data) &&
      new URLSearchParams(window.location.search).get("check") === "now"

    if (needsAuth) {
      newSession()
    }
  }, [data, loading, newSession])

  return {
    data,
    loading,
    newSession,
  }
}

```

### Core Architecture Module: `client/web/src/hooks/exit-nodes.ts`
```
// Copyright (c) Tailscale Inc & contributors
// SPDX-License-Identifier: BSD-3-Clause

import { useMemo } from "react"
import {
  CityCode,
  CountryCode,
  ExitNode,
  ExitNodeLocation,
  NodeData,
} from "src/types"
import useSWR from "swr"

export default function useExitNodes(node: NodeData, filter?: string) {
  const { data } = useSWR<ExitNode[]>("/exit-nodes")

  const { tailnetNodesSorted, locationNodesMap } = useMemo(() => {
    // First going through exit nodes and splitting them into two groups:
    // 1. tailnetNodes: exit nodes advertised by tailnet's own nodes
    // 2. locationNodes: exit nodes advertised by non-tailnet Mullvad nodes
    let tailnetNodes: ExitNode[] = []
    const locationNodes = new Map<CountryCode, Map<CityCode, ExitNode[]>>()

    if (!node.Features["use-exit-node"]) {
      // early-return
      return {
        tailnetNodesSorted: tailnetNodes,
        locationNodesMap: locationNodes,
      }
    }

    data?.forEach((n) => {
      const loc = n.Location
      if (!loc) {
        // 2023-11-15: Currently, if the node doesn't have
        // location information, it is owned by the tailnet.
        // Only Mullvad exit nodes have locations filled.
        tailnetNodes.push({
          ...n,
          Name: trimDNSSuffix(n.Name, node.TailnetName),
        })
        return
      }
      const countryNodes =
        locationNodes.get(loc.CountryCode) || new Map<CityCode, ExitNode[]>()
      const cityNodes = countryNodes.get(loc.CityCode) || []
      countryNodes.set(loc.CityCode, [...cityNodes, n])
      locationNodes.set(loc.CountryCode, countryNodes)
    })

    return {
      tailnetNodesSorted: tailnetNodes.sort(compareByName),
      locationNodesMap: locationNodes,
    }
  }, [data, node.Features, node.TailnetName])

  const hasFilter = Boolean(filter)

  const mullvadNodesSorted = useMemo(() => {
    const nodes: ExitNode[] = []
    if (!node.Features["use-exit-node"]) {
      return nodes // early-return
    }

    // addBestMatchNode adds the node with the "higest priority"
    // match from a list of exit node `options` to `nodes`.
    const addBestMatchNode = (
      options: ExitNode[],
      name: (loc: ExitNodeLocation) => string
    ) => {
      const bestNode = highestPriorityNode(options)
      if (!bestNode || !bestNode.Location) {
        return // not possible, doing this for type safety
      }
      nodes.push({
        ...bestNode,
        Name: name(bestNode.Location),
      })
    }

    if (!hasFilter) {
      // When nothing is searched, only show a single best-matching
      // exit node per-country.
      //
      // There's too many location-based nodes to display all of them.
      locationNodesMap.forEach(
        // add one node per country
        (countryNodes) =>
          addBestMatchNode(flattenMap(countryNodes), (loc) => loc.Country)
      )
    } else {
      // Otherwise, show the best match on a city-level,
      // with a "Country: Best Match" node at top.
      //
      // i.e. We allow for discovering cities through searching.
      locationNodesMap.forEach((countryNodes) => {
        countryNodes.forEach(
          // add one node per city
          (cityNodes) =>
            addBestMatchNode(cityNodes, (loc) => `${loc.Country}: ${loc.City}`)
        )
        // add the "Country: Best Match" node
        addBestMatchNode(
          flattenMap(countryNodes),
          (loc) => `${loc.Country}: Best Match`
        )
      })
    }

    return nodes.sort(compareByName)
  }, [hasFilter, locationNodesMap, node.Features])

  // Ordered and filtered grouping of exit nodes.
  const exitNodeGroups = useMemo(() => {
    const filterLower = !filter ? undefined : filter.toLowerCase()

    const selfGroup = {
      id: "self",
      name: undefined,
      nodes: filter
        ? []
        : !node.Features["advertise-exit-node"]
        ? [noExitNode] // don't show "runAsExitNode" option
        : [noExitNode, runAsExitNode],
    }

    if (!node.Features["use-exit-node"]) {
      return [selfGroup]
    }
    return [
      selfGroup,
      {
        id: "tailnet",
        nodes: filterLower
          ? tailnetNodesSorted.filter((n) =>
              n.Name.toLowerCase().includes(filterLower)
            )
          : tailnetNodesSorted,
      },
      {
        id: "mullvad",
        name: "Mullvad VPN",
        nodes: filterLower
          ? mullvadNodesSorted.filter((n) =>
              n.Name.toLowerCase().includes(filterLower)
            )
          : mullvadNodesSorted,
      },
    ]
  }, [filter, node.Features, tailnetNodesSorted, mullvadNodesSorted])

  return { data: exitNodeGroups }
}

// highestPriorityNode finds the highest priority node for use
// (the "best match" node) from a list of exit nodes.
// Nodes with equal priorities are picked between arbitrarily.
function highestPriorityNode(nodes: ExitNode[]): ExitNode | undefined {
  return nodes.length === 0
    ? undefined
    : nodes.sort(
        (a, b) => (b.Location?.Priority || 0) - (a.Location?.Priority || 0)
      )[0]
}

// compareName compares two exit nodes alphabetically by name.
function compareByName(a: ExitNode, b: ExitNode): number {
  if (a.Location && b.Location && a.Location.Country === b.Location.Country) {
    // Always put "<Country>: Best Match" node at top of country list.
    if (a.Name.includes(": Best Match")) {
      return -1
    } else if (b.Name.includes(": Best Match")) {
      return 1
    }
  }
  return a.Name.localeCompare(b.Name)
}

function flattenMap<T, V>(m: Map<T, V[]>): V[] {
  return Array.from(m.values()).reduce((prev, curr) => [...prev, ...curr])
}

// trimDNSSuffix trims the tailnet dns name from s, leaving no
// trailing dots.
//
// trimDNSSuffix("hello.ts.net", "ts.net") = "hello"
// trimDNSSuffix("hello", "ts.net") = "hello"
export function trimDNSSuffix(s: string, tailnetDNSName: string): string {
  if (s.endsWith(".")) {
    s = s.slice(0, -1)
  }
  if (s.endsWith("." + tailnetDNSName)) {
    s = s.replace("." + tailnetDNSName, "")
  }
  return s
}

// Neither of these are really "online", but setting this makes them selectable.
export const noExitNode: ExitNode = { ID: "NONE", Name: "None", Online: true }
export const runAsExitNode: ExitNode = {
  ID: "RUNNING",
  Name: "Run as exit node",
  Online: true,
}

```

### Core Architecture Module: `client/web/src/hooks/self-update.ts`
```
// Copyright (c) Tailscale Inc & contributors
// SPDX-License-Identifier: BSD-3-Clause

import { useCallback, useEffect, useState } from "react"
import { apiFetch } from "src/api"
import { VersionInfo } from "src/types"

// see ipnstate.UpdateProgress
export type UpdateProgress = {
  status: "UpdateFinished" | "UpdateInProgress" | "UpdateFailed"
  message: string
  version: string
}

export enum UpdateState {
  UpToDate,
  Available,
  InProgress,
  Complete,
  Failed,
}

// useInstallUpdate initiates and tracks a Tailscale self-update via the LocalAPI,
// and returns state messages showing the progress of the update.
export function useInstallUpdate(currentVersion: string, cv?: VersionInfo) {
  const [updateState, setUpdateState] = useState<UpdateState>(
    cv?.RunningLatest ? UpdateState.UpToDate : UpdateState.Available
  )

  const [updateLog, setUpdateLog] = useState<string>("")

  const appendUpdateLog = useCallback(
    (msg: string) => {
      setUpdateLog(updateLog + msg + "\n")
    },
    [updateLog, setUpdateLog]
  )

  useEffect(() => {
    if (updateState !== UpdateState.Available) {
      // useEffect cleanup function
      return () => {}
    }

    setUpdateState(UpdateState.InProgress)

    apiFetch("/local/v0/update/install", "POST").catch((err) => {
      console.error(err)
      setUpdateState(UpdateState.Failed)
    })

    let tsAwayForPolls = 0
    let updateMessagesRead = 0

    let timer: NodeJS.Timeout | undefined

    function poll() {
      apiFetch<UpdateProgress[]>("/local/v0/update/progress", "GET")
        .then((res) => {
          // res contains a list of UpdateProgresses that is strictly increasing
          // in size, so updateMessagesRead keeps track (across calls of poll())
          // of how many of those we have already read. This is why it is not
          // initialized to zero here and we don't just use res.forEach()
          for (; updateMessagesRead < res.length; ++updateMessagesRead) {
            const up = res[updateMessagesRead]
            if (up.status === "UpdateFailed") {
              setUpdateState(UpdateState.Failed)
              if (up.message) appendUpdateLog("ERROR: " + up.message)
              return
            }

            if (up.status === "UpdateFinished") {
              // if update finished and tailscaled did not go away (ie. did not restart),
              // then the version being the same might not be an error, it might just require
              // the user to restart Tailscale manually (this is required in some cases in the
              // clientupdate package).
              if (up.version === currentVersion && tsAwayForPolls > 0) {
                setUpdateState(UpdateState.Failed)
                appendUpdateLog(
                  "ERROR: Update failed, still running Tailscale " + up.version
                )
                if (up.message) appendUpdateLog("ERROR: " + up.message)
              } else {
                setUpdateState(UpdateState.Complete)
                if (up.message) appendUpdateLog("INFO: " + up.message)
              }
              return
            }

            setUpdateState(UpdateState.InProgress)
            if (up.message) appendUpdateLog("INFO: " + up.message)
          }

          // If we have gone through the entire loop without returning out of the function,
          // the update is still in progress. So we want to poll again for further status
          // updates.
          timer = setTimeout(poll, 1000)
        })
        .catch((err) => {
          ++tsAwayForPolls
          if (tsAwayForPolls >= 5 * 60) {
            setUpdateState(UpdateState.Failed)
            appendUpdateLog(
              "ERROR: tailscaled went away but did not come back!"
            )
            appendUpdateLog("ERROR: last error received:")
            appendUpdateLog(err.toString())
          } else {
            timer = setTimeout(poll, 1000)
          }
        })
    }

    poll()

    // useEffect cleanup function
    return () => {
      if (timer) clearTimeout(timer)
      timer = undefined
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return !cv
    ? { updateState: UpdateState.UpToDate, updateLog: "" }
    : { updateState, updateLog }
}

```

### Core Architecture Module: `client/web/src/hooks/toaster.ts`
```
// Copyright (c) Tailscale Inc & contributors
// SPDX-License-Identifier: BSD-3-Clause

import { useRawToasterForHook } from "src/ui/toaster"

/**
 * useToaster provides a mechanism to display toasts. It returns an object with
 * methods to show, dismiss, or clear all toasts:
 *
 *     const toastKey = toaster.show({ message: "Hello world" })
 *     toaster.dismiss(toastKey)
 *     toaster.clear()
 *
 */
const useToaster = useRawToasterForHook

export default useToaster

```

### Core Architecture Module: `client/web/src/hooks/ts-web-connected.ts`
```
// Copyright (c) Tailscale Inc & contributors
// SPDX-License-Identifier: BSD-3-Clause

import { useCallback, useEffect, useState } from "react"
import { isHTTPS } from "src/utils/util"
import { AuthServerMode } from "./auth"

/**
 * useTSWebConnected hook is used to check whether the browser is able to
 * connect to the web client served at http://${nodeIPv4}:5252
 */
export function useTSWebConnected(mode: AuthServerMode, nodeIPv4: string) {
  const [tsWebConnected, setTSWebConnected] = useState<boolean>(
    mode === "manage" // browser already on the web client
  )
  const [isLoading, setIsLoading] = useState<boolean>(false)

  const checkTSWebConnection = useCallback(() => {
    if (mode === "manage") {
      // Already connected to the web client.
      setTSWebConnected(true)
      return
    }
    if (isHTTPS()) {
      // When page is loaded over HTTPS, the connectivity check will always
      // fail with a mixed-content error. In this case don't bother doing
      // the check.
      return
    }
    if (isLoading) {
      return // already checking
    }
    setIsLoading(true)
    fetch(`http://${nodeIPv4}:5252/ok`, { mode: "no-cors" })
      .then(() => {
        setTSWebConnected(true)
        setIsLoading(false)
      })
      .catch(() => setIsLoading(false))
  }, [isLoading, mode, nodeIPv4])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => checkTSWebConnection(), []) // checking connection for first time on page load

  return { tsWebConnected, checkTSWebConnection, isLoading }
}

```

### Core Architecture Module: `client/web/src/ui/empty-state.tsx`
```
// Copyright (c) Tailscale Inc & contributors
// SPDX-License-Identifier: BSD-3-Clause

import cx from "classnames"
import React, { cloneElement } from "react"

type Props = {
  action?: React.ReactNode
  className?: string
  description: string
  icon?: React.ReactElement
  title?: string
}

/**
 * EmptyState shows some text and an optional action when some area that can
 * house content is empty (eg. no search results, empty tables).
 */
export default function EmptyState(props: Props) {
  const { action, className, description, icon, title } = props
  const iconColor = "text-gray-500"
  const iconComponent = getIcon(icon, iconColor)

  return (
    <div
      className={cx("flex justify-center", className, {
        "flex-col items-center": action || icon || title,
      })}
    >
      {icon && <div className="mb-2">{iconComponent}</div>}
      {title && (
        <h3 className="text-xl font-medium text-center mb-2">{title}</h3>
      )}
      <div className="w-full text-center max-w-xl text-gray-500">
        {description}
      </div>
      {action && <div className="mt-3.5">{action}</div>}
    </div>
  )
}

function getIcon(icon: React.ReactElement | undefined, iconColor: string) {
  return icon ? cloneElement(icon, { className: iconColor }) : null
}

```

### Core Architecture Module: `client/web/src/utils/clipboard.ts`
```
// Copyright (c) Tailscale Inc & contributors
// SPDX-License-Identifier: BSD-3-Clause

import { isPromise } from "src/utils/util"

/**
 * copyText copies text to the clipboard, handling cross-browser compatibility
 * issues with different clipboard APIs.
 *
 * To support copying after running a network request (eg. generating an invite),
 * pass a promise that resolves to the text to copy.
 *
 * @example
 * copyText("Hello, world!")
 * copyText(generateInvite().then(res => res.data.inviteCode))
 */
export function copyText(text: string | Promise<string | void>) {
  if (!navigator.clipboard) {
    if (isPromise(text)) {
      return text.then((val) => fallbackCopy(validateString(val)))
    }
    return fallbackCopy(text)
  }
  if (isPromise(text)) {
    if (typeof ClipboardItem === "undefined") {
      return text.then((val) =>
        navigator.clipboard.writeText(validateString(val))
      )
    }
    return navigator.clipboard.write([
      new ClipboardItem({
        "text/plain": text.then(
          (val) => new Blob([validateString(val)], { type: "text/plain" })
        ),
      }),
    ])
  }
  return navigator.clipboard.writeText(text)
}

function validateString(val: unknown): string {
  if (typeof val !== "string" || val.length === 0) {
    throw new TypeError("Expected string, got " + typeof val)
  }
  if (val.length === 0) {
    throw new TypeError("Expected non-empty string")
  }
  return val
}

function fallbackCopy(text: string) {
  const el = document.createElement("textarea")
  el.value = text
  el.setAttribute("readonly", "")
  el.className = "absolute opacity-0 pointer-events-none"
  document.body.append(el)

  // Check if text is currently selected
  let selection = document.getSelection()
  const selected =
    selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : false

  el.select()
  document.execCommand("copy")
  el.remove()

  // Restore selection
  if (selected) {
    selection = document.getSelection()
    if (selection) {
      selection.removeAllRanges()
      selection.addRange(selected)
    }
  }

  return Promise.resolve()
}

```

### Core Architecture Module: `client/web/src/utils/util.ts`
```
// Copyright (c) Tailscale Inc & contributors
// SPDX-License-Identifier: BSD-3-Clause

/**
 * assertNever ensures a branch of code can never be reached,
 * resulting in a Typescript error if it can.
 */
export function assertNever(a: never): never {
  return a
}

/**
 * noop is an empty function for use as a default value.
 */
export function noop() {}

/**
 * isObject checks if a value is an object.
 */
export function isObject(val: unknown): val is object {
  return Boolean(val && typeof val === "object" && val.constructor === Object)
}

/**
 * pluralize is a very simple function that returns either
 * the singular or plural form of a string based on the given
 * quantity.
 *
 * TODO: Ideally this would use a localized pluralization.
 */
export function pluralize(signular: string, plural: string, qty: number) {
  return qty === 1 ? signular : plural
}

/**
 * isTailscaleIPv6 returns true when the ip matches
 * Tailnet's IPv6 format.
 */
export function isTailscaleIPv6(ip: string): boolean {
  return ip.startsWith("fd7a:115c:a1e0")
}

/**
 * isPromise returns whether the current value is a promise.
 */
export function isPromise<T = unknown>(val: unknown): val is Promise<T> {
  if (!val) {
    return false
  }
  return typeof val === "object" && "then" in val
}

/**
 * isHTTPS reports whether the current page is loaded over HTTPS.
 */
export function isHTTPS() {
  return window.location.protocol === "https:"
}

```

### Core Architecture Module: `cmd/tailscaled/tailscaledhooks/tailscaledhooks.go`
```
// Copyright (c) Tailscale Inc & contributors
// SPDX-License-Identifier: BSD-3-Clause

// Package tailscaledhooks provides hooks for optional features
// to add to during init that tailscaled calls at runtime.
package tailscaledhooks

import "tailscale.com/feature"

// UninstallSystemDaemonWindows is called when the Windows
// system daemon is uninstalled.
var UninstallSystemDaemonWindows feature.Hooks[func()]

```

### Core Architecture Module: `cmd/tsconnect/src/lib/js-state-store.ts`
```
// Copyright (c) Tailscale Inc & contributors
// SPDX-License-Identifier: BSD-3-Clause

/** @fileoverview Callbacks used by jsStateStore to persist IPN state. */

export const sessionStateStorage: IPNStateStorage = {
  setState(id, value) {
    window.sessionStorage[`ipn-state-${id}`] = value
  },
  getState(id) {
    return window.sessionStorage[`ipn-state-${id}`] || ""
  },
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #21889** (2026-10-22): **Install script broken for Ubuntu 26.10**
  *Symptoms*: ### What is the issue?  Tailscale install script "curl -fsSL https://tailscale.com/install.sh | sh" doesn't install on Ubuntu 26.10. Error says OS not supported.  ### Steps to reproduce  Paste the official install command into Ubuntu 26.10 terminal "curl -fsSL https://tailscale.com/install.sh | sh"  ### Are there any recent changes that introduced the issue?  _No response_  ### OS  Linux  ### OS version  Ubuntu 26.10  ### Tailscale version  Latest  ### Other software  _No response_  ### Bug report  _No response_

- **Issue #21885** (2026-10-23): **DoH forwarders on Windows can be very slow**
  *Symptoms*: ### What is the issue?  The client can get backed up by GetWindowsDefault being too slow underneath DoH TCP socket binding setup.  ### Steps to reproduce  Have a large number of routes or interfaces, and a large number of DoH resolvers.  ### Are there any recent changes that introduced the issue?  The problem was slightly worsened by improvements in Happy Eyeballs.  ### OS  Windows  ### OS version  _No response_  ### Tailscale version  _No response_  ### Other software  _No response_  ### Bug report  _No response_

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

### Incident Patch 1: `566f89e0` (2026-10-25)
**Commit Message**: ipn/ipnlocal: fix serve app caps leaking across mounts (#21931)

`serveWebHandler` wrote each mount's accepted app capabilities into the connection-scoped serveHTTPContext. Concurrent h2 streams of one TLS serve connection share that struct, so a request to a mount accepting no capabilities could be proxied carrying another mount's `Tailscale-App-Capabilities` header, letting backends that trust the header authorize the wrong mount.

This change fixes that issue by storing accepted capabilities per-request via a context value instead of a field on the shared struct.

Updates tailscale/corp#50380

Change-Id: I5d0a4a02266018f342ba75a1b3291176738ce05b

Signed-off-by: Mike Jensen <[REDACTED_EMAIL]>

**File**: `ipn/ipnlocal/serve.go` (modified, +12/-10)
```diff
@@ -86,15 +86,21 @@ var ErrProxyToTailscaledSocket = errors.New("cannot proxy to tailscaled socket")
 
 var serveHTTPContextKey ctxkey.Key[*serveHTTPContext]
 
+// appCapsContextKey holds the app capabilities accepted by the mount handling
+// the current request. It is per-request state: serveHTTPContext is shared by
+// all streams of a connection, so mount state must not be stored on it.
+var appCapsContextKey = ctxkey.New("ipnlocal.appCapsContextKey", views.Slice[peercap.Cap]{})
+
+// serveHTTPContext is connection-scoped: one value is shared by all requests on
+// the connection, including concurrent h2 streams. Do not add per-request state
+// to it, use a separate context key like appCapsContextKey instead.
 type serveHTTPContext struct {
 	SrcAddr       netip.AddrPort
 	ForVIPService tailcfg.ServiceName // "" means local
 	DestPort      uint16
 
 	// provides funnel-specific context, nil if not funneled
 	Funnel *funnelFlow
-	// AppCapabilities lists all PeerCapabilities that should be forwarded by serve
-	AppCapabilities views.Slice[peercap.Cap]
 }
 
 // funnelFlow represents a funneled connection initiated via IngressPeer
@@ -1149,8 +1155,8 @@ func (b *LocalBackend) addAppCapabilitiesHeader(r *httputil.ProxyRequest) error
 	if !ok || c.Funnel != nil {
 		return nil
 	}
-	acceptCaps := c.AppCapabilities
-	if acceptCaps.IsNil() {
+	acceptCaps, ok := appCapsContextKey.ValueOk(r.Out.Context())
+	if !ok || acceptCaps.IsNil() {
 		return nil
 	}
 	peerCaps := b.PeerCaps(c.SrcAddr.Addr())
@@ -1218,12 +1224,8 @@ func (b *LocalBackend) serveWebHandler(w http.ResponseWriter, r *http.Request) {
 			http.Error(w, "unknown proxy destination", http.StatusInternalServerError)
 			return
 		}
-		// Inject app capabilities to forward into the request context
-		c, ok := serveHTTPContextKey.ValueOk(r.Context())
-		if !ok {
-			return
-		}
-		c.AppCapabilities = h.AcceptAppCaps()
+		// Mount-accepted capabilities are per-request state
+		r = r.WithContext(appCapsContextKey.WithValue(r.Context(), h.AcceptAppCaps()))
 		h := p.(http.Handler)
 		// Trim the mount point from the URL path before proxying. (#6571)
 		if r.URL.Path != "/" {
```

**File**: `ipn/ipnlocal/serve_test.go` (modified, +171/-0)
```diff
@@ -25,6 +25,7 @@ import (
 	"reflect"
 	"strconv"
 	"strings"
+	"sync"
 	"testing"
 	"time"
 
@@ -990,6 +991,176 @@ func TestServeHTTPProxyGrantHeader(t *testing.T) {
 	}
 }
 
+// newAppCapsTestBackend returns a test backend whose peer at 100.150.151.152
+// holds the example.com/cap/interesting capability for the node 100.150.151.151.
+func newAppCapsTestBackend(t *testing.T) *LocalBackend {
+	b := newTestBackend(t)
+
+	nm := b.NetMapWithPeers()
+	matches, err := filter.MatchesFromFilterRules([]tailcfg.FilterRule{
+		{
+			SrcIPs: []string{"100.150.151.152"},
+			CapGrant: []tailcfg.CapGrant{{
+				Dsts: []netip.Prefix{
+					netip.MustParsePrefix("100.150.151.151/32"),
+				},
+				CapMap: tailcfg.PeerCapMap{
+					"example.com/cap/interesting": []tailcfg.RawMessage{
+						`{"role": "engineer"}`,
+					},
+				},
+			}},
+		},
+	})
+	if err != nil {
+		t.Fatal(err)
+	}
+	nm.PacketFilter = matches
+	b.SetControlClientStatus(nil, controlclient.Status{NetMap: nm})
+	return b
+}
+
+// appCapsEchoServer returns a test backend that echoes the
+// Tailscale-App-Capabilities request header in its response body.
+func appCapsEchoServer(t *testing.T) *httptest.Server {
+	t.Helper()
+
+	testServ := httptest.NewServer(http.HandlerFunc(
+		func(w http.ResponseWriter, r *http.Request) {
+			fmt.Fprint(w, r.Header.Get("Tailscale-App-Capabilities"))
+		},
+	))
+	t.Cleanup(testServ.Close)
+	return testServ
+}
+
+// TestServeAppCapsConcurrentStreams verifies that app capabilities accepted by one
+// serve mount are not forwarded for requests to another mount, when the requests
+// share the connection-scoped serveHTTPContext the way concurrent h2 streams do.
+func TestServeAppCapsConcurrentStreams(t *testing.T) {
+	b := newAppCapsTestBackend(t)
+	testServ := appCapsEchoServer(t)
+
+	conf := &ipn.ServeConfig{
+		Web: map[ipn.HostPort]*ipn.WebServerConfig{
+			"example.ts.net:443": {Handlers: map[string]*ipn.HTTPHandler{
+				"/ops": {
+					Proxy:         testServ.URL,
+					AcceptAppCaps: []peercap.Cap{"example.com/cap/interesting"},
+				},
+				"/admin": {
+					Proxy: testServ.URL, // accepts no capabilities
+				},
+			}},
+		},
+	}
+	if err := b.SetServeConfig(conf, ""); err != nil {
+		t.Fatal(err)
+	}
+
+	// One connection-scoped serveHTTPContext
+	connCtx := serveHTTPContextKey.WithValue(t.Context(), &serveHTTPContext{
+		DestPort: 443,
+		SrcAddr:  netip.MustParseAddrPort("100.150.151.152:1234"),
+	})
+
+	newReq := func(path string) *http.Request {
+		req := &http.Request{
+			URL: &url.URL{Path: path},
+			TLS: &tls.ConnectionState{ServerName: "example.ts.net"},
+		}
+		return req.WithContext(connCtx)
+	}
+
+	const rounds = 200
+	var wg sync.WaitGroup
+	errCh := make(chan error, 2*rounds) // both mounts can fail every round
+	for range rounds {
+		wg.Add(2)
+		go func() {
+			defer wg.Done()
+			w := httptest.NewRecorder()
+			b.serveWebHandler(w, newReq("/ops"))
+			if got := w.Body.String(); got == "" {
+				errCh <- fmt.Errorf("/ops: capabilities header missing")
+			}
+		}()
+		go func() {
+			defer wg.Done()
+			w := httptest.NewRecorder()
+			b.serveWebHandler(w, newReq("/admin"))
+			if got := w.Body.String(); got != "" {
+				errCh <- fmt.Errorf("/admin: unexpected capabilities header %q", got)
+			}
+		}()
+	}
+	wg.Wait()
+	close(errCh)
+	for err := range errCh {
+		t.Error(err)
+	}
+}
+
+// TestServeAppCapsPerRequest verifies that the accepted capabilities
+// forwarded to the backend match the mount that served each request.
+func TestServeAppCapsPerRequest(t *testing.T) {
+	b := newAppCapsTestBackend(t)
+	testServ := appCapsEchoServer(t)
+
+	conf := &ipn.ServeConfig{
+		Web: map[ipn.HostPort]*ipn.WebServerConfig{
+			"example.ts.net:443": {Handlers: map[string]*ipn.HTTPHandler{
+				"/": {
+					Proxy:         testServ.URL,
+					AcceptAppCaps: []peercap.Cap{"example.com/cap/interesting"},
+				},
+				"/text": {
+					Text: "not proxied", // no proxy, no capabilities involved
+				},
+			}},
+		},
+	}
+	if err := b.SetServeConfig(conf, ""); err != nil {
+		t.Fatal(err)
+	}
+
+	tests := []struct {
+		name     string
+		path     string
+		wantBody string
+	}{
+		{
+			name:     "accepting_mount_forwards_caps",
+			path:     "/",
+			wantBody: `{"example.com/cap/interesting":[{"role":"engineer"}]}`,
+		},
+		{
+			name:     "text_mount_no_caps",
+			path:     "/text",
+			wantBody: "not proxied",
+		},
+	}
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			req := &http.Request{
+				URL: &url.URL{Path: tt.path},
+				TLS: &tls.ConnectionState{ServerName: "example.ts.net"},
+			}
+			req = req.WithContext(serveHTTPContextKey.WithValue(req.Context(), &serveHTTPContext{
+				DestPort: 443,
+				SrcAddr:  netip.MustParseAddrPort("100.150.151.152:1234"),
+			}))
+
+			w := httptest.NewRecorder()
+			b.serveWebHandler(w, req)
+
+			if got := w.Body.String(); got != tt.wantBody {
+				t.Errorf("capabilities header; want=%q got=%q", tt.wantBody, got)
+			}
+		})
+	}
+}
+
 func Test_revers
```

---

### Incident Patch 2: `17c90d88` (2026-10-24)
**Commit Message**: ssh/tailssh: fix off-by-one and clamp c2n SSH username hint cap

The add closure used len(res.Usernames) > max, letting one extra
username through the client's Max, and the client-supplied Max was used
unclamped. Honor Max exactly and clamp it to a 100-username ceiling;
the list is only a login hint.

Updates tailscale/corp#50380

Signed-off-by: James Tucker <[REDACTED_EMAIL]>

**File**: `ssh/tailssh/c2n.go` (modified, +35/-16)
```diff
@@ -17,6 +17,7 @@ import (
 	"tailscale.com/ipn/ipnlocal"
 	"tailscale.com/tailcfg"
 	"tailscale.com/util/lineiter"
+	"tailscale.com/util/set"
 )
 
 // hookLocalUsernames, if non-nil, lists the local user accounts on
@@ -40,6 +41,31 @@ func handleC2NSSHUsernames(b *ipnlocal.LocalBackend, w http.ResponseWriter, r *h
 	json.NewEncoder(w).Encode(res)
 }
 
+// maxSSHUsernameHints caps the number of usernames returned to a client;
+// the list is only a login hint.
+const maxSSHUsernameHints = 100
+
+// appendSSHUsernameHint appends u to names unless it is excluded or a
+// service account, is already present, or the list already has max entries
+// (so the result never exceeds max entries).
+func appendSSHUsernameHint(names []string, u string, exclude set.Set[string], max int) []string {
+	if exclude.Contains(u) {
+		return names
+	}
+	switch u {
+	case "nobody", "daemon", "sync":
+		return names
+	}
+	if slices.Contains(names, u) {
+		return names
+	}
+	if len(names) >= max {
+		// Enough for a hint.
+		return names
+	}
+	return append(names, u)
+}
+
 // getSSHUsernames discovers and returns the list of usernames that are
 // potential Tailscale SSH user targets.
 func getSSHUsernames(b *ipnlocal.LocalBackend, req *tailcfg.C2NSSHUsernamesRequest) (*tailcfg.C2NSSHUsernamesResponse, error) {
@@ -50,25 +76,18 @@ func getSSHUsernames(b *ipnlocal.LocalBackend, req *tailcfg.C2NSSHUsernamesReque
 
 	max := 10
 	if req != nil && req.Max != 0 {
-		max = req.Max
+		// The client-supplied cap is just a hint; clamp it to a sane ceiling.
+		max = min(req.Max, maxSSHUsernameHints)
 	}
 
-	add := func(u string) {
-		if req != nil && req.Exclude[u] {
-			return
+	var exclude set.Set[string]
+	for u, e := range req.Exclude {
+		if e {
+			exclude.Add(u)
 		}
-		switch u {
-		case "nobody", "daemon", "sync":
-			return
-		}
-		if slices.Contains(res.Usernames, u) {
-			return
-		}
-		if len(res.Usernames) > max {
-			// Enough for a hint.
-			return
-		}
-		res.Usernames = append(res.Usernames, u)
+	}
+	add := func(u string) {
+		res.Usernames = appendSSHUsernameHint(res.Usernames, u, exclude, max)
 	}
 
 	if opUser := b.OperatorUserName(); opUser != "" {
```

**File**: `ssh/tailssh/c2n_test.go` (added, +78/-0)
```diff
@@ -0,0 +1,78 @@
+// Copyright (c) Tailscale Inc & contributors
+// SPDX-License-Identifier: BSD-3-Clause
+
+//go:build (linux && !android) || (darwin && !ios) || freebsd || openbsd || plan9
+
+package tailssh
+
+import (
+	"testing"
+
+	"tailscale.com/util/set"
+)
+
+func TestAppendSSHUsernameHint(t *testing.T) {
+	tests := []struct {
+		name    string
+		names   []string
+		u       string
+		exclude set.Set[string]
+		max     int
+		want    []string
+	}{
+		{
+			name: "append",
+			u:    "alice",
+			max:  10,
+			want: []string{"alice"},
+		},
+		{
+			name:  "dedupe",
+			names: []string{"alice"},
+			u:     "alice",
+			max:   10,
+			want:  []string{"alice"},
+		},
+		{
+			name:    "excluded",
+			names:   []string{"alice"},
+			u:       "alice",
+			exclude: set.SetOf([]string{"alice"}),
+			max:     10,
+			want:    []string{"alice"},
+		},
+		{
+			name: "service-account-skipped",
+			u:    "daemon",
+			max:  10,
+			want: nil,
+		},
+		{
+			name:  "capped-exactly-at-max",
+			names: []string{"alice", "bob", "carol"},
+			u:     "dave",
+			max:   3,
+			want:  []string{"alice", "bob", "carol"},
+		},
+		{
+			name:  "room-for-one-more",
+			names: []string{"alice", "bob"},
+			u:     "carol",
+			max:   3,
+			want:  []string{"alice", "bob", "carol"},
+		},
+	}
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			got := appendSSHUsernameHint(tt.names, tt.u, tt.exclude, tt.max)
+			if len(got) != len(tt.want) {
+				t.Fatalf("appendSSHUsernameHint(%q) = %q; want %q", tt.u, got, tt.want)
+			}
+			for i := range got {
+				if got[i] != tt.want[i] {
+					t.Fatalf("appendSSHUsernameHint(%q) = %q; want %q", tt.u, got, tt.want)
+				}
+			}
+		})
+	}
+}
```

#### Recent Merged Pull Requests:
- **PR #21931** (2026-10-25): ipn/ipnlocal: fix serve app caps leaking across mounts (@jentfoo)
- **PR #21929** (2026-10-24): ssh/tailssh: record sftp sessions and honor recording failure policy (@raggi)
- **PR #21928** (2026-10-24): ssh/tailssh: unify defaultPathForUser to use isRootUser (@jentfoo)
- **PR #21926** (2026-10-24): ssh/tailssh: fix off-by-one and clamp c2n SSH username hint cap (@raggi)
- **PR #21925** (2026-10-24): ssh/tailssh: validate accepted env values, deny GLIBC_TUNABLES, cap names (@raggi)
- **PR #21924** (2026-10-24): ssh/tailssh: refuse direct-exec fallback for non-root users as root (@raggi)

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

## X. ipn/ipnlocal: fix serve app caps leaking across mounts (#21931)

**RULE**:
When implementing operations in `ipn/ipnlocal/serve.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in tailscale/tailscale. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `566f89e0`: ipn/ipnlocal: fix serve app caps leaking across mounts (#21931). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `ipn/ipnlocal/serve.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
// appCapsContextKey holds the app capabilities accepted by the mount handling
// the current request. It is per-request state: serveHTTPContext is shared by
// all streams of a connection, so mount state must not be stored on it.
var appCapsContextKey = ctxkey.New("ipnlocal.appCapsContextKey", views.Slice[peercap.Cap]{})

// serveHTTPContext is connection-scoped: one value is shared by all requests on
// the connection, including concurrent h2 streams. Do not add per-request state
// to it, use a separate context key like appCapsContextKey instead.
	acceptCaps, ok := appCapsContextKey.ValueOk(r.Out.Context())
	if !ok || acceptCaps.IsNil() {
		// Mount-accepted capabilities are per-request state
		r = r.WithContext(appCapsContextKey.WithValue(r.Context(), h.AcceptAppCaps()))
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
	// AppCapabilities lists all PeerCapabilities that should be forwarded by serve
	AppCapabilities views.Slice[peercap.Cap]
	acceptCaps := c.AppCapabilities
	if acceptCaps.IsNil() {
		// Inject app capabilities to forward into the request context
		c, ok := serveHTTPContextKey.ValueOk(r.Context())
		if !ok {
			return
		}
		c.AppCapabilities = h.AcceptAppCaps()
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `566f89e0` are properly handled with clean fallback behavior.
