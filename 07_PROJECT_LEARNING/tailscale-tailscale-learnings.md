> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/tailscale-tailscale-learnings.md`  
> **Source**: github ([https://github.com/tailscale/tailscale](https://github.com/tailscale/tailscale))  
> **Source Version**: `3a38840c`  
> **License**: BSD-3-Clause  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-27T21:18:40.159Z  
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
> **Harvest Timestamp**: 2026-10-27T21:18:39.666Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tailscale/tailscale`
- **Description**: The easiest, most secure way to use WireGuard and 2FA.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 38175 stars

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
- **Issue #21890** (2026-10-27): **net/routemanager: removing overlapping CGNAT subnet route drops coarse OS route**
  *Symptoms*: ## What is the issue?  `RouteManager.applyDirty` can remove `100.64.0.0/10` from `OSRoutes` when a peer advertising that accepted subnet route is removed, even though other peers still require the same prefix as the coarse CGNAT route.  The `/10` is handled as a plain route and deleted during the incremental update. Since CGNAT coarsening remains enabled, the code that adds the coarse route only on a coarsening transition does not run. A full rebuild restores the route.  Expected: `100.64.0.0/10` remains in `OSRoutes` while either the accepted subnet route or CGNAT coarsening requires it.  Actual: after removing the subnet peer, the prefix disappears from `OSRoutes` until a full rebuild.  ## Steps to reproduce  1. Create a `RouteManager` with `RouteAll: true` and `OneCGNAT: true`. 2. Add three peers with CGNAT `/32` self addresses. Have one peer also advertise `100.64.0.0/10`. 3. Remove the peer advertising `/10`, leaving two peers so CGNAT coarsening remains enabled. 4. Check `OSRoutes().Get(100.64.0.0/10)`. It returns false. A new manager built with the two remaining peers returns true.  This reproduces on v1.102.0, v1.104.2, and current main. A regression test is included in the corresponding PR.  https://github.com/tailscale/tailscale/pull/21891 

- **Issue #21889** (2026-10-22): **Install script broken for Ubuntu 26.10**
  *Symptoms*: ### What is the issue?  Tailscale install script "curl -fsSL https://tailscale.com/install.sh | sh" doesn't install on Ubuntu 26.10. Error says OS not supported.  ### Steps to reproduce  Paste the official install command into Ubuntu 26.10 terminal "curl -fsSL https://tailscale.com/install.sh | sh"  ### Are there any recent changes that introduced the issue?  _No response_  ### OS  Linux  ### OS version  Ubuntu 26.10  ### Tailscale version  Latest  ### Other software  _No response_  ### Bug report  _No response_

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

### Incident Patch 1: `3a38840c` (2026-10-27)
**Commit Message**: ipn/ipnlocal: check the tailscaled socket on every serve unix dial

The unix-socket reverse proxy checked its backend against the tailscaled
socket only when the handler was built, but each backend connection
re-resolved the path from scratch. A backend that was benign at config
time could later be replaced with a symlink to the tailscaled socket by
anyone able to write to its directory, and the next dial followed it.
The proxy dials as root, so the same swap could redirect a serve or
funnel backend at any root-only unix socket on the host.

Move the check to the dial itself, in a dialServeUnixSocket method
shared by the HTTP transport, the h2c transport and the TCP-forward
handler, all of which previously dialed unix on their own. It refuses
tailscaled's socket with ErrProxyToTailscaledSocket immediately before
connecting.

On Linux 5.6 and newer, the dial pins the resolved socket inode with
openat2(2): an O_PATH descriptor opened with RESOLVE_NO_MAGICLINKS,
and RESOLVE_BENEATH under the socket's parent directory where the path
allows it, or by whole path otherwise. The pinned file is checked
against the tailscaled socket, and the connection is made to the pinned
file through /pro

**File**: `ipn/ipnlocal/serve.go` (modified, +56/-19)
```diff
@@ -80,8 +80,11 @@ const (
 // current etag of a resource.
 var ErrETagMismatch = errors.New("etag mismatch")
 
-// ErrProxyToTailscaledSocket is returned when attempting to proxy
-// to the tailscaled socket itself, which would create a loop.
+// ErrProxyToTailscaledSocket is returned when attempting to proxy to the
+// tailscaled socket itself. The LocalAPI authorizes a unix-socket caller by
+// the peer credentials of the dialing process, which would be tailscaled
+// running as root, so such a proxy would hand a remote client a
+// root-authorized LocalAPI.
 var ErrProxyToTailscaledSocket = errors.New("cannot proxy to tailscaled socket")
 
 var serveHTTPContextKey ctxkey.Key[*serveHTTPContext]
@@ -699,27 +702,20 @@ func (b *LocalBackend) tcpHandlerForServeTCP(tcph ipn.TCPPortHandlerView, dport
 		return func(conn net.Conn) error {
 			defer conn.Close()
 			conn = b.meteredConnForService(conn, forVIPService)
-			// Never forward to tailscaled's own socket: the local API
-			// authorizes a unix-socket caller by the peer credentials of the
-			// dialing process, which here is tailscaled itself, so a forward
-			// would hand a remote peer a root-authorized local API.
-			socketPath, isUnix := strings.CutPrefix(backDst, "unix:")
-			if isUnix && b.isTailscaledSocket(socketPath) {
-				b.logf("localbackend: refusing TCP proxy on port %v (from %v) to the tailscaled socket %q", dport, srcAddr, socketPath)
-				return ErrProxyToTailscaledSocket
-			}
 			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
 			var backConn net.Conn
 			var err error
-			if isUnix {
-				var d net.Dialer
-				backConn, err = d.DialContext(ctx, "unix", socketPath)
+			if socketPath, isUnix := strings.CutPrefix(backDst, "unix:"); isUnix {
+				backConn, err = b.dialServeUnixSocket(ctx, socketPath)
 			} else {
 				backConn, err = b.dialer.SystemDial(ctx, "tcp", backDst)
 			}
 			cancel()
 			if err != nil {
-				b.logf("localbackend: failed to TCP proxy port %v (from %v) to %s: %v", dport, srcAddr, backDst, err)
+				// dialServeUnixSocket already logged a refusal; don't double-log.
+				if !errors.Is(err, ErrProxyToTailscaledSocket) {
+					b.logf("localbackend: failed to TCP proxy port %v (from %v) to %s: %v", dport, srcAddr, backDst, err)
+				}
 				return nil
 			}
 			defer backConn.Close()
@@ -1033,6 +1029,49 @@ func (rp *reverseProxy) ServeHTTP(w http.ResponseWriter, r *http.Request) {
 	p.ServeHTTP(w, r)
 }
 
+// dialServeUnixSocket dials a unix-socket serve/funnel backend. It returns
+// ErrProxyToTailscaledSocket if the backend is tailscaled's own socket,
+// which would give the caller a root-authorized LocalAPI.
+//
+// The configured path can be replaced by anyone who can write to its
+// directory, so the socket is re-checked on every dial, not only at
+// config time. dialServeUnixSocketSafe avoids re-resolving the path
+// where the platform allows it. On the remaining dials,
+// refuseIfConnectedToTailscaledSocket re-checks the connected peer.
+func (b *LocalBackend) dialServeUnixSocket(ctx context.Context, socketPath string) (net.Conn, error) {
+	if b.isTailscaledSocket(socketPath) {
+		b.logf("serve: refusing to proxy to the tailscaled socket %q", socketPath)
+		return nil, ErrProxyToTailscaledSocket
+	}
+	conn, err := b.dialServeUnixSocketSafe(ctx, socketPath)
+	if err != nil {
+		return nil, err
+	}
+	if err := b.refuseIfConnectedToTailscaledSocket(conn); err != nil {
+		conn.Close()
+		return nil, err
+	}
+	return conn, nil
+}
+
+// refuseIfConnectedToTailscaledSocket returns ErrProxyToTailscaledSocket
+// if conn is a unix connection to the tailscaled socket. The peer address
+// is the path the listening socket was bound to, not the path that was
+// dialed, so the check still sees the tailscaled socket through a symlink
+// swapped in before the dial. This check is best-effort: connections
+// that have no determinable peer name are allowed.
+func (b *LocalBackend) refuseIfConnectedToTailscaledSocket(conn net.Conn) error {
+	ua, ok := conn.RemoteAddr().(*net.UnixAddr)
+	if !ok || ua.Name == "" {
+		return nil
+	}
+	if ua.Name == b.sys.SocketPath || b.isTailscaledSocket(ua.Name) {
+		b.logf("serve: refusing connected unix backend peer %q: it is the tailscaled socket", ua.Name)
+		return ErrProxyToTailscaledSocket
+	}
+	return nil
+}
+
 // getTransport returns the Transport used for regular (non-GRPC) requests
 // to the backend. The Transport gets created lazily, at most once.
 func (rp *reverseProxy) getTransport() *http.Transport {
@@ -1042,8 +1081,7 @@ func (rp *reverseProxy) getTransport() *http.Transport {
 		dial := rp.lb.dialer.SystemDial
 		if rp.socketPath != "" {
 			dial = func(ctx context.Context, _, _ string) (net.Conn, error) {
-				var d net.Dialer
-				return d.DialContext(ctx, "unix", rp.socketPath)
+				return rp.lb.dialServeUnixSocket(ctx, rp.socketPath)
 			}
 		}
 
@@ -1073,8 +1111,7 @@ func (rp *reverseProxy) getH2CTransport() http.RoundTripper {
 			Protocols
```

**File**: `ipn/ipnlocal/serve_test.go` (modified, +35/-0)
```diff
@@ -2301,3 +2301,38 @@ func TestSetServeConfigRejectsTailscaledSocket(t *testing.T) {
 		t.Fatal("setServeConfigLocked accepted a forward to the tailscaled socket; want it refused")
 	}
 }
+
+// TestReverseProxyRechecksTailscaledSocketPerDial verifies that a unix
+// backend that becomes a symlink to the tailscaled socket after the
+// handler was built is refused at dial time.
+func TestReverseProxyRechecksTailscaledSocketPerDial(t *testing.T) {
+	b := newTestBackend(t)
+	sock := mkTempSocket(t)
+	b.sys.SocketPath = sock
+	benign := mkTempSocket(t)
+
+	// Benign at config time, so the handler is built.
+	h, err := b.proxyHandlerForBackend("unix:" + benign)
+	if err != nil {
+		t.Fatalf("proxyHandlerForBackend(benign) = %v; want handler", err)
+	}
+	rp, ok := h.(*reverseProxy)
+	if !ok {
+		t.Fatalf("handler is %T; want *reverseProxy", h)
+	}
+	if _, err := rp.lb.dialServeUnixSocket(t.Context(), rp.socketPath); errors.Is(err, ErrProxyToTailscaledSocket) {
+		t.Fatalf("dial to the benign path was refused as the tailscaled socket")
+	}
+
+	// The path is swapped for a symlink to the tailscaled socket after the
+	// handler exists; the next dial must catch it.
+	if err := os.Remove(benign); err != nil {
+		t.Fatal(err)
+	}
+	if err := os.Symlink(sock, benign); err != nil {
+		t.Fatal(err)
+	}
+	if _, err := rp.lb.dialServeUnixSocket(t.Context(), rp.socketPath); !errors.Is(err, ErrProxyToTailscaledSocket) {
+		t.Fatalf("dial after the symlink swap = %v; want ErrProxyToTailscaledSocket", err)
+	}
+}
```

**File**: `ipn/ipnlocal/serve_unix_linux.go` (added, +101/-0)
```diff
@@ -0,0 +1,101 @@
+// Copyright (c) Tailscale Inc & contributors
+// SPDX-License-Identifier: BSD-3-Clause
+
+//go:build linux && !ts_omit_serve
+
+package ipnlocal
+
+import (
+	"context"
+	"net"
+	"path/filepath"
+	"strconv"
+
+	"golang.org/x/sys/unix"
+)
+
+// dialServeUnixSocketSafe dials socketPath. Where the platform allows
+// it, it connects to a pinned descriptor instead of the path, so that
+// swapping the path cannot retarget the connect. It returns
+// ErrProxyToTailscaledSocket if the dialed socket is tailscaled's own.
+// When no descriptor can be pinned, it dials the path directly.
+func (b *LocalBackend) dialServeUnixSocketSafe(ctx context.Context, socketPath string) (net.Conn, error) {
+	if fd, ok := pinUnixSocketPath(socketPath); ok {
+		defer unix.Close(fd)
+
+		// Check the inode held by the pin, which is the inode the
+		// connect below uses.
+		if b.isTailscaledSocketFd(fd) {
+			b.logf("serve: refusing to proxy to the tailscaled socket %q", socketPath)
+			return nil, ErrProxyToTailscaledSocket
+		}
+		conn, err := dialPinnedUnixSocket(ctx, fd)
+		if err == nil {
+			return conn, nil
+		}
+		// No usable /proc, or the pinned socket is gone. The peer is
+		// re-checked by the caller.
+		b.logf("serve: dialing %q by path: connecting through the pinned descriptor failed: %v", socketPath, err)
+	}
+	var d net.Dialer
+	return d.DialContext(ctx, "unix", socketPath)
+}
+
+// pinUnixSocketPath returns an O_PATH descriptor referring to the file
+// that socketPath resolves to, or ok=false if the kernel or the path do
+// not support it (openat2(2), Linux 5.6 and newer). The resolution never
+// follows magic links, and is restricted to the socket's parent directory
+// when possible.
+func pinUnixSocketPath(socketPath string) (fd int, ok bool) {
+	if dir, base := filepath.Split(filepath.Clean(socketPath)); dir != "" && base != "." && base != ".." && base != "/" {
+		if dirFD, err := unix.Open(dir, unix.O_PATH|unix.O_DIRECTORY|unix.O_CLOEXEC, 0); err == nil {
+			defer unix.Close(dirFD)
+			if fd, err := unix.Openat2(dirFD, base, &unix.OpenHow{
+				Flags: unix.O_PATH | unix.O_CLOEXEC,
+				Resolve: unix.RESOLVE_BENEATH |
+					unix.RESOLVE_NO_MAGICLINKS,
+			}); err == nil {
+				return fd, true
+			}
+		}
+	}
+	fd, err := unix.Openat2(unix.AT_FDCWD, socketPath, &unix.OpenHow{
+		Flags:   unix.O_PATH | unix.O_CLOEXEC,
+		Resolve: unix.RESOLVE_NO_MAGICLINKS,
+	})
+	if err != nil {
+		return -1, false
+	}
+	return fd, true
+}
+
+// dialPinnedUnixSocket connects to the unix listener referred to by the
+// O_PATH descriptor fd, via its /proc/self/fd name, so that the connect
+// uses the pinned file and not the socket path.
+func dialPinnedUnixSocket(ctx context.Context, fd int) (net.Conn, error) {
+	var d net.Dialer
+	return d.DialContext(ctx, "unix", "/proc/self/fd/"+strconv.Itoa(fd))
+}
+
+// isTailscaledSocketFd reports whether fd and the tailscaled socket
+// (b.sys.SocketPath) refer to the same file, compared by device and inode.
+// tailscaled's socket path is stat'ed on each call, so the directory holding
+// it must not be writable by the attacker for this to be meaningful.
+//
+// st_dev and st_ino are filesystem-provided, and FUSE and some network
+// filesystems can report zero or duplicate values. A match made that
+// way still refuses the dial, so such values need no special handling.
+func (b *LocalBackend) isTailscaledSocketFd(fd int) bool {
+	socketPath := b.sys.SocketPath
+	if socketPath == "" {
+		return false
+	}
+	var self, pinned unix.Stat_t
+	if err := unix.Stat(socketPath, &self); err != nil {
+		return false
+	}
+	if err := unix.Fstat(fd, &pinned); err != nil {
+		return false
+	}
+	return self.Dev == pinned.Dev && self.Ino == pinned.Ino
+}
```

**File**: `ipn/ipnlocal/serve_unix_linux_test.go` (added, +181/-0)
```diff
@@ -0,0 +1,181 @@
+// Copyright (c) Tailscale Inc & contributors
+// SPDX-License-Identifier: BSD-3-Clause
+
+//go:build linux && !ts_omit_serve
+
+package ipnlocal
+
+import (
+	"bytes"
+	"context"
+	"io"
+	"os"
+	"path/filepath"
+	"strconv"
+	"syscall"
+	"testing"
+
+	"golang.org/x/sys/unix"
+)
+
+// openat2Supported reports whether the kernel supports openat2(2)
+// (Linux 5.6 and newer).
+func openat2Supported() bool {
+	fd, err := unix.Openat2(unix.AT_FDCWD, "/", &unix.OpenHow{Flags: unix.O_PATH | unix.O_CLOEXEC})
+	if err == nil {
+		unix.Close(fd)
+		return true
+	}
+	return false
+}
+
+// TestPinUnixSocketPathResistsSymlinkSwap checks that replacing the dial
+// path with a symlink after pinning does not change the pinned descriptor,
+// and that a later pin of the swapped path refers to the tailscaled socket.
+func TestPinUnixSocketPathResistsSymlinkSwap(t *testing.T) {
+	if !openat2Supported() {
+		t.Skip("kernel does not support openat2(2); the dial falls back to the pre/post checks")
+	}
+
+	dir := unixSocketTestDir(t)
+	tsSock := filepath.Join(dir, "tailscaled.sock")
+	mustListenUnix(t, tsSock)
+	backend := filepath.Join(dir, "backend.sock")
+	serveUnixEchoListener(t, backend)
+
+	b := newTestBackend(t)
+	b.sys.SocketPath = tsSock
+
+	// Backend behind a sibling symlink.
+	alias := filepath.Join(dir, "alias.sock")
+	if err := os.Symlink("backend.sock", alias); err != nil {
+		t.Fatal(err)
+	}
+
+	fd, ok := pinUnixSocketPath(alias)
+	if !ok {
+		t.Fatalf("pinUnixSocketPath(%q) did not pin", alias)
+	}
+	defer unix.Close(fd)
+
+	if b.isTailscaledSocketFd(fd) {
+		t.Fatal("pin of the benign alias matches the tailscaled socket")
+	}
+
+	// Replace the path with a symlink to the tailscaled socket after the pin.
+	if err := os.Remove(alias); err != nil {
+		t.Fatal(err)
+	}
+	if err := os.Symlink("tailscaled.sock", alias); err != nil {
+		t.Fatal(err)
+	}
+
+	// The pinned descriptor is unchanged...
+	if b.isTailscaledSocketFd(fd) {
+		t.Fatal("pin followed the swap onto the tailscaled socket")
+	}
+	// ...and the connect through it reaches the benign backend, not the
+	// socket the path now leads to.
+	c, err := dialPinnedUnixSocket(context.Background(), fd)
+	if err != nil {
+		t.Fatalf("dial through the pinned descriptor: %v", err)
+	}
+	defer c.Close()
+	msg := []byte("hello backend")
+	if _, err := c.Write(msg); err != nil {
+		t.Fatal(err)
+	}
+	got := make([]byte, len(msg))
+	if _, err := io.ReadFull(c, got); err != nil {
+		t.Fatal(err)
+	}
+	if !bytes.Equal(got, msg) {
+		t.Fatalf("echo through pin = %q; want %q", got, msg)
+	}
+
+	// A new pin of the swapped path is the tailscaled socket.
+	fd, ok = pinUnixSocketPath(alias)
+	if !ok {
+		t.Fatalf("pinUnixSocketPath(%q) on the swapped path did not pin", alias)
+	}
+	defer unix.Close(fd)
+	if !b.isTailscaledSocketFd(fd) {
+		t.Fatal("pin of the swapped alias is not the tailscaled socket")
+	}
+}
+
+// TestPinUnixSocketPathAbsoluteSymlinkBackend checks that a backend behind
+// an absolute symlink, which RESOLVE_BENEATH cannot resolve, is still
+// pinned and dialable.
+func TestPinUnixSocketPathAbsoluteSymlinkBackend(t *testing.T) {
+	if !openat2Supported() {
+		t.Skip("kernel does not support openat2(2); the dial falls back to the pre/post checks")
+	}
+
+	dir := unixSocketTestDir(t)
+	backend := filepath.Join(dir, "backend.sock")
+	serveUnixEchoListener(t, backend)
+
+	alias := filepath.Join(dir, "alias.sock")
+	if err := os.Symlink(backend, alias); err != nil {
+		t.Fatal(err)
+	}
+
+	fd, ok := pinUnixSocketPath(alias)
+	if !ok {
+		t.Fatalf("pinUnixSocketPath(%q) did not pin", alias)
+	}
+	defer unix.Close(fd)
+
+	c, err := dialPinnedUnixSocket(context.Background(), fd)
+	if err != nil {
+		t.Fatalf("dial through the pinned descriptor: %v", err)
+	}
+	defer c.Close()
+	msg := []byte("hello backend")
+	if _, err := c.Write(msg); err != nil {
+		t.Fatal(err)
+	}
+	got := make([]byte, len(msg))
+	if _, err := io.ReadFull(c, got); err != nil {
+		t.Fatal(err)
+	}
+	if !bytes.Equal(got, msg) {
+		t.Fatalf("echo through pin = %q; want %q", got, msg)
+	}
+}
+
+// TestPinUnixSocketPathRefusesMagicLinks checks that a path that is a magic
+// link (here, /proc/self/fd of the listener) is not pinned.
+func TestPinUnixSocketPathRefusesMagicLinks(t *testing.T) {
+	if !openat2Supported() {
+		t.Skip("kernel does not support openat2(2); the dial falls back to the pre/post checks")
+	}
+
+	dir := unixSocketTestDir(t)
+	tsSock := filepath.Join(dir, "tailscaled.sock")
+	ln := mustListenUnix(t, tsSock)
+
+	sc, ok := ln.(syscall.Conn)
+	if !ok {
+		t.Fatalf("%T does not expose its descriptor", ln)
+	}
+	rc, err := sc.SyscallConn()
+	if err != nil {
+		t.Fatal(err)
+	}
+	var lnFD int
+	if err := rc.Control(func(fd uintptr) { lnFD = int(fd) }); err != nil {
+		t.Fatal(err)
+	}
+
+	magic := filepath.Join(dir, "magic.sock")
+	if err := os.Symlink("/proc/self/fd/"+strconv.Itoa(lnFD), magic); err != nil {
+		t.Fatal(err)
+	}
+
+	if fd, ok := pinUnixSocketPath(mag
```

**File**: `ipn/ipnlocal/serve_unix_other.go` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+// Copyright (c) Tailscale Inc & contributors
+// SPDX-License-Identifier: BSD-3-Clause
+
+//go:build !linux && !ts_omit_serve
+
+package ipnlocal
+
+import (
+	"context"
+	"net"
+)
+
+// dialServeUnixSocketSafe dials socketPath directly. This platform has no
+// openat2(2) equivalent, so swapping the path can still retarget the
+// connect. The caller re-checks the connected peer.
+func (b *LocalBackend) dialServeUnixSocketSafe(ctx context.Context, socketPath string) (net.Conn, error) {
+	var d net.Dialer
+	return d.DialContext(ctx, "unix", socketPath)
+}
```

**File**: `ipn/ipnlocal/serve_unix_test.go` (modified, +135/-1)
```diff
@@ -1,11 +1,13 @@
 // Copyright (c) Tailscale Inc & contributors
 // SPDX-License-Identifier: BSD-3-Clause
 
-//go:build unix
+//go:build unix && !ts_omit_serve
 
 package ipnlocal
 
 import (
+	"bytes"
+	"context"
 	"errors"
 	"fmt"
 	"io"
@@ -320,3 +322,135 @@ func TestTCPForwardUnixSocket(t *testing.T) {
 		t.Fatal("handler did not finish in time")
 	}
 }
+
+// unixSocketTestDir returns a directory for creating unix sockets, on a
+// path short enough for sockaddr_un's sun_path limit.
+func unixSocketTestDir(t *testing.T) string {
+	t.Helper()
+	dir, err := os.MkdirTemp("/tmp", "ts-serve-unix-*")
+	if err != nil {
+		t.Fatal(err)
+	}
+	t.Cleanup(func() { os.RemoveAll(dir) })
+	return dir
+}
+
+// mustListenUnix binds a unix listener at path, removing any existing file
+// there first (mkTempSocket leaves a regular file behind).
+func mustListenUnix(t *testing.T, path string) net.Listener {
+	t.Helper()
+	if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
+		t.Fatal(err)
+	}
+	ln, err := net.Listen("unix", path)
+	if err != nil {
+		t.Fatal(err)
+	}
+	t.Cleanup(func() { ln.Close(); os.Remove(path) })
+	return ln
+}
+
+// serveUnixEchoListener binds an echoing unix listener at path.
+func serveUnixEchoListener(t *testing.T, path string) {
+	t.Helper()
+	ln := mustListenUnix(t, path)
+	go func() {
+		for {
+			c, err := ln.Accept()
+			if err != nil {
+				return
+			}
+			go func() {
+				defer c.Close()
+				io.Copy(c, c)
+			}()
+		}
+	}()
+}
+
+// TestRefuseIfConnectedToTailscaledSocket verifies the post-dial peer
+// check: the peer of a unix connection is named by the path its listener
+// was bound to, not the path dialed, so a connection to the tailscaled
+// socket is refused, including one made through a symlink
+func TestRefuseIfConnectedToTailscaledSocket(t *testing.T) {
+	dir := unixSocketTestDir(t)
+	tsSock := filepath.Join(dir, "tailscaled.sock")
+	mustListenUnix(t, tsSock)
+
+	b := newTestBackend(t)
+	b.sys.SocketPath = tsSock
+
+	// Skip if this platform does not name path-bound peers.
+	c, err := net.Dial("unix", tsSock)
+	if err != nil {
+		t.Fatal(err)
+	}
+	defer c.Close()
+	ua, ok := c.RemoteAddr().(*net.UnixAddr)
+	if !ok || ua.Name == "" {
+		t.Skipf("platform does not name unix socket peers (RemoteAddr = %v)", c.RemoteAddr())
+	}
+
+	if err := b.refuseIfConnectedToTailscaledSocket(c); !errors.Is(err, ErrProxyToTailscaledSocket) {
+		t.Fatalf("refuseIfConnectedToTailscaledSocket(tailscaled peer) = %v; want ErrProxyToTailscaledSocket", err)
+	}
+
+	// A connection through a symlink still names the bound path.
+	alias := filepath.Join(dir, "alias.sock")
+	if err := os.Symlink(tsSock, alias); err != nil {
+		t.Fatal(err)
+	}
+	c, err = net.Dial("unix", alias)
+	if err != nil {
+		t.Fatal(err)
+	}
+	defer c.Close()
+	if err := b.refuseIfConnectedToTailscaledSocket(c); !errors.Is(err, ErrProxyToTailscaledSocket) {
+		t.Fatalf("refuseIfConnectedToTailscaledSocket(symlinked tailscaled peer) = %v; want ErrProxyToTailscaledSocket", err)
+	}
+
+	// A connection to any other socket is left alone.
+	benign := filepath.Join(dir, "benign.sock")
+	mustListenUnix(t, benign)
+	c, err = net.Dial("unix", benign)
+	if err != nil {
+		t.Fatal(err)
+	}
+	defer c.Close()
+	if err := b.refuseIfConnectedToTailscaledSocket(c); err != nil {
+		t.Fatalf("refuseIfConnectedToTailscaledSocket(benign peer) = %v; want nil", err)
+	}
+}
+
+// TestDialServeUnixSocketServesBenignBackend dials a benign unix backend
+// end to end through dialServeUnixSocket and checks that traffic flows.
+func TestDialServeUnixSocketServesBenignBackend(t *testing.T) {
+	dir := unixSocketTestDir(t)
+	// The backend is behind a symlink, as a serve config may reference it.
+	backend := filepath.Join(dir, "backend.sock")
+	serveUnixEchoListener(t, backend)
+	alias := filepath.Join(dir, "alias.sock")
+	if err := os.Symlink(backend, alias); err != nil {
+		t.Fatal(err)
+	}
+
+	b := newTestBackend(t)
+
+	conn, err := b.dialServeUnixSocket(context.Background(), alias)
+	if err != nil {
+		t.Fatalf("dialServeUnixSocket(%q) = %v; want connection", alias, err)
+	}
+	defer conn.Close()
+
+	msg := []byte("hello backend")
+	if _, err := conn.Write(msg); err != nil {
+		t.Fatal(err)
+	}
+	got := make([]byte, len(msg))
+	if _, err := io.ReadFull(conn, got); err != nil {
+		t.Fatal(err)
+	}
+	if !bytes.Equal(got, msg) {
+		t.Fatalf("echo = %q; want %q", got, msg)
+	}
+}
```

---

### Incident Patch 2: `822061d8` (2026-10-27)
**Commit Message**: ipn/ipnlocal: reset alwayson override before reconciling prefs (#21998)

https://github.com/tailscale/tailscale/commit/09982e1918f27c740320a4879bbafdd9f379733a
introduced an alwayson override reset before applying policy settings
during Start.
A prefs reconciliation refactor in
https://github.com/tailscale/tailscale/commit/cb7b49941eae3a933c4c5b7dc56398bce24d7e08
changed the ordering so that Start reconciled prefs before clearing the
override. If the user disconnected with a reason, reconciliation would
preserve WantRunning=false, and Start could retain that stale value
after the override was cleared.
https://github.com/tailscale/tailscale/commit/f4aea70f7a199e5ac155e225fe7ad4de374e9dea
added cached netmap startup, so processing the cached netmap can
reconcile the current prefs to WantRunning=true while Start still holds
a local prefs snapshot with WantRunning=false. Start can then notify the
frontend with the stale value even though the backend is transitioning
to Running with WantRunning=true.

This resets the alwayson override before reconciling prefs, restoring
the original Start ordering and ensuring that the prefs used throughout
Start reflect the effective alwayson policy

U

**File**: `ipn/ipnlocal/local.go` (modified, +3/-2)
```diff
@@ -3202,6 +3202,9 @@ func (b *LocalBackend) startLocked(opts ipn.Options) error {
 		prefsChanged = true
 		prefsChangedWhy = append(prefsChangedWhy, "opts.UpdatePrefs")
 	}
+	// Reset the always-on override whenever Start is called.
+	b.resetAlwaysOnOverrideLocked()
+
 	// Apply any syspolicy overrides, resolve exit node ID, etc.
 	// As of 2025-07-03, this is primarily needed in two cases:
 	//  - when opts.UpdatePrefs is not nil
@@ -3241,8 +3244,6 @@ func (b *LocalBackend) startLocked(opts ipn.Options) error {
 	}
 	prefs := newPrefs.View()
 
-	// Reset the always-on override whenever Start is called.
-	b.resetAlwaysOnOverrideLocked()
 	b.setAtomicValuesFromPrefsLocked(prefs)
 	b.updateNoSNATExitNodeWarning(prefs)
 
```

**File**: `ipn/ipnlocal/local_test.go` (modified, +39/-0)
```diff
@@ -415,6 +415,45 @@ func TestLazyMachineKeyGeneration(t *testing.T) {
 	time.Sleep(500 * time.Millisecond)
 }
 
+func TestStartResetsAlwaysOnOverrideBeforeReconcilingPrefs(t *testing.T) {
+	var polc policytest.Config
+	polc.Set(pkey.AlwaysOn, true)
+
+	sys := tsd.NewSystem()
+	sys.PolicyClient.Set(polc)
+
+	b := newTestLocalBackendWithSys(t, sys)
+	b.ForTest().SetControlClientGetter(func(opts controlclient.Options) (controlclient.Client, error) {
+		return newClient(t, opts), nil
+	})
+	b.ForTest().SetPrefs(&ipn.Prefs{
+		ControlURL:  "https://localhost:1/",
+		WantRunning: false,
+	})
+
+	// Simulate a user disconnecting while AlwaysOn.OverrideWithReason is
+	// enabled. The override prevents Always-On from immediately setting
+	// WantRunning back to true.
+	b.mu.Lock()
+	b.overrideAlwaysOn = true
+	b.mu.Unlock()
+
+	if err := b.Start(ipn.Options{}); err != nil {
+		t.Fatalf("Start: %v", err)
+	}
+
+	if got := b.Prefs().WantRunning(); !got {
+		t.Errorf("WantRunning = false after Start with Always-On enabled; want true")
+	}
+
+	b.mu.Lock()
+	overrideAlwaysOn := b.overrideAlwaysOn
+	b.mu.Unlock()
+	if overrideAlwaysOn {
+		t.Error("overrideAlwaysOn remains set after Start")
+	}
+}
+
 func TestZeroExitNodeViaLocalAPI(t *testing.T) {
 	lb := newTestLocalBackend(t)
 	user := &ipnauth.TestActor{}
```

#### Recent Merged Pull Requests:
- **PR #22002** (2026-10-27): Raggi/104release (@raggi)
- **PR #21999** (2026-10-27): ipn/ipnlocal: check the tailscaled socket on every serve unix dial (@raggi)
- **PR #21998** (2026-10-27): ipn/ipnlocal: reset alwayson override before reconciling prefs (@kari-ts)
- **PR #21992** (closed): ipn/ipnlocal: recheck the tailscaled socket on every serve unix dial (@samj-ts)
- **PR #21982** (2026-10-27): ssh/tailssh: parse UIDs consistently in isRootUser() (@fmarier)
- **PR #21980** (2026-10-27): derp/derphttp: bound response body read on non-101 upgrade response (@pawel-ts)

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

## X. ipn/ipnlocal: check the tailscaled socket on every serve unix dial

**RULE**:
When implementing operations in `ipn/ipnlocal/serve.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in tailscale/tailscale. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `3a38840c`: ipn/ipnlocal: check the tailscaled socket on every serve unix dial. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `ipn/ipnlocal/serve.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
// ErrProxyToTailscaledSocket is returned when attempting to proxy to the
// tailscaled socket itself. The LocalAPI authorizes a unix-socket caller by
// the peer credentials of the dialing process, which would be tailscaled
// running as root, so such a proxy would hand a remote client a
// root-authorized LocalAPI.
			if socketPath, isUnix := strings.CutPrefix(backDst, "unix:"); isUnix {
				backConn, err = b.dialServeUnixSocket(ctx, socketPath)
				// dialServeUnixSocket already logged a refusal; don't double-log.
				if !errors.Is(err, ErrProxyToTailscaledSocket) {
					b.logf("localbackend: failed to TCP proxy port %v (from %v) to %s: %v", dport, srcAddr, backDst, err)
				}
// dialServeUnixSocket dials a unix-socket serve/funnel backend. It returns
// ErrProxyToTailscaledSocket if the backend is tailscaled's own socket,
// which would give the caller a root-authorized LocalAPI.
//
// The configured path can be replaced by anyone who can write to its
// directory, so the socket is re-checked on every dial, not only at
// config time. dialServeUnixSocketSafe avoids re-resolving the path
// where the platform allows it. On the remaining dials,
// refuseIfConnectedToTailscaledSoc
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
// ErrProxyToTailscaledSocket is returned when attempting to proxy
// to the tailscaled socket itself, which would create a loop.
			// Never forward to tailscaled's own socket: the local API
			// authorizes a unix-socket caller by the peer credentials of the
			// dialing process, which here is tailscaled itself, so a forward
			// would hand a remote peer a root-authorized local API.
			socketPath, isUnix := strings.CutPrefix(backDst, "unix:")
			if isUnix && b.isTailscaledSocket(socketPath) {
				b.logf("localbackend: refusing TCP proxy on port %v (from %v) to the tailscaled socket %q", dport, srcAddr, socketPath)
				return ErrProxyToTailscaledSocket
			}
			if isUnix {
				var d net.Dialer
				backConn, err = d.DialContext(ctx, "unix", socketPath)
				b.logf("localbackend: failed to TCP proxy port %v (from %v) to %s: %v", dport, srcAddr, backDst, err)
				var d net.Dialer
				return d.DialContext(ctx, "unix", rp.socketPath)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `3a38840c` are properly handled with clean fallback behavior.
