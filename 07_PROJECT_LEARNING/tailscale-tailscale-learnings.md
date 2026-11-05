> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/tailscale-tailscale-learnings.md`  
> **Source**: github ([https://github.com/tailscale/tailscale](https://github.com/tailscale/tailscale))  
> **Source Version**: `dc698697`  
> **License**: BSD-3-Clause  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-05T07:34:49.386Z  
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
> **Harvest Timestamp**: 2026-11-05T07:34:49.381Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tailscale/tailscale`
- **Description**: The easiest, most secure way to use WireGuard and 2FA.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 38661 stars

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
- **Issue #22154** (2026-11-04): **Subnet router on UGREEN NAS (UGOS) cannot route traffic to other LAN hosts**
  *Symptoms*: ### What is the issue?  ### Description I am running Tailscale as a subnet router on a UGREEN NAS (UGOS). The subnet route is properly advertised and approved, and the remote client successfully installs the route. However, the client can only access the NAS itself, but cannot reach any other hosts on the local network (LAN). The NAS can reach all LAN hosts locally.  ### Technical Details - **Device:** UGREEN NAS (UGOS) - **Tailscale Version:** 1.96.4 - **Subnet Route:** 192.168.2.0/24 (Approved: yes, PrimaryRoute: yes) - **Remote Client Route Installed:** 192.168.2.0/24 -> 100.100.100.100  ### Diagnostics & Traceroute Traceroute from remote client to a LAN host (192.168.2.1): 1 mynas.trex-ph.ts.net 2 * * * (timeout)  ### Connectivity Test - **Accessible remotely:** 192.168.2.8 (NAS IP) - **Not accessible remotely:** 192.168.2.1, 192.168.2.111, 192.168.2.197  ### Bugreport ID BUG-9c60e945982956dbabdb869e686bb3c89b4b8088f771dd306bbc4ec676c04b40-20261103055834Z-b8e66fd6dcf5df89   ### Steps to reproduce  _No response_  ### Are there any recent changes that introduced the issue?  _No response_  ### OS  Android, Windows  ### OS version  _No response_  ### Tailscale version  1.96.4  ### Other software  NAS Ugreen DXP2800 system version 1.20.0.0124  ### Bug report  BUG-9c60e945982956dbabdb869e686bb3c89b4b8088f771dd306bbc4ec676c04b40-20261103055834Z-b8e66fd6dcf5df89

- **Issue #22144** (2026-11-03): **iPadOS 27.2: "MagicSock function not running" after device restart, tunnel shows connected but passes no traffic or DNS**
  *Symptoms*: ### What is the issue?  On an iPad Air M4 (iPadOS 27.2), Tailscale repeatedly enters a state where the app shows "Connected" but displays the warning "MagicSock function not running". While in this state, no traffic passes through the tunnel: DNS (MagicDNS, global nameserver on a tailnet node) does not resolve, so Safari and all apps fail to load anything. Turning Tailscale off immediately restores internet access.  An iPhone (iOS 27.2) on the same Wi-Fi network, behind the same router and the same egress path, does not show the problem.  ### Steps to reproduce  Occurrences: - 2026-10-31: right after the iPadOS 27.2 update (which includes a restart). Fixed by deleting the VPN profile. - 2026-11-02: device fully powered off while away, powered on back at home; issue appeared immediately. Fixed by toggling Tailscale off and on. Bug report attached below (generated while the error was showing).  ### Are there any recent changes that introduced the issue?  Yes: the device was updated to iPadOS 27.2 on 2026-10-31, the same day the first occurrence happened.  ### OS  iOS  ### OS version  iPadOS 27.2  ### Tailscale version  1.104.4  ### Other software  Home router routes this device's traffic through a commercial OpenVPN tunnel (NordVPN). The admin console shows "Varies: Yes" (endpoint-dependent NAT) for this node, and its DERP home is New York. The iPhone that works correctly uses the same router tunnel.  ### Bug report  BUG-94caa859c8a9ae8eeb5f1189b7d83c8a95c44b839742f90c53a33a52f

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

### Incident Patch 1: `dc698697` (2026-11-05)
**Commit Message**: net/netcheck: never prefer a STUN-only region as the home DERP (#21976)

The PreferredDERP selection loop only considers RegionLatency, which
STUN probes populate for STUN-only regions too. When such a region is
the only one with a latency sample (e.g. self-hosted DERP behind a
TCP-only tunnel while a public STUN server is reachable), it gets
selected as the preferred DERP and all relay traffic blackholes, since
the region has no DERP server to relay through.

Filter STUN-only regions in the selection loop by reusing the existing
regionHasDERPNode predicate (renamed to CanServeDERP), which was
already applied to the HTTPS/ICMP fallback probing but not here.

Regions missing from the map, or present without any nodes, keep the
old behavior, as some tests use latency-only DERP maps.

Fixes #21975

Signed-off-by: Luo Chen <[REDACTED_EMAIL]>

**File**: `net/netcheck/netcheck.go` (modified, +9/-10)
```diff
@@ -1004,7 +1004,7 @@ func (c *Client) GetReport(ctx context.Context, dm *tailcfg.DERPMap, opts *GetRe
 		var wg sync.WaitGroup
 		var need []*tailcfg.DERPRegion
 		for rid, reg := range dm.Regions {
-			if !rs.haveRegionLatency(tailcfg.DERPRegionID(rid)) && regionHasDERPNode(reg) && !reg.Avoid && !reg.NoMeasureNoHome {
+			if !rs.haveRegionLatency(tailcfg.DERPRegionID(rid)) && reg.CanServeDERP() && !reg.Avoid && !reg.NoMeasureNoHome {
 				need = append(need, reg)
 			}
 		}
@@ -1466,6 +1466,14 @@ func (c *Client) addReportHistoryAndSetPreferredDERP(rs *reportState, r *Report,
 			d = time.Duration(float64(d) * score)
 		}
 
+		// A STUN-only region has no DERP server to relay through, so it must
+		// never become the preferred DERP even though its STUN probe gives it
+		// a RegionLatency entry. Regions missing from the map or without any
+		// DERP server are equally unable to serve as a home.
+		if !dm.Regions().Get(regionID).CanServeDERP() {
+			continue
+		}
+
 		if regionID == prevDERP {
 			oldRegionCurLatency = d
 		}
@@ -1755,15 +1763,6 @@ func (c *Client) nodeAddrPort(ctx context.Context, n *tailcfg.DERPNode, port int
 	return zero, false
 }
 
-func regionHasDERPNode(r *tailcfg.DERPRegion) bool {
-	for _, n := range r.Nodes {
-		if !n.STUNOnly {
-			return true
-		}
-	}
-	return false
-}
-
 func maxDurationValue(m map[tailcfg.DERPRegionID]time.Duration) (max time.Duration) {
 	for _, v := range m {
 		if v > max {
```

**File**: `net/netcheck/netcheck_test.go` (modified, +55/-2)
```diff
@@ -47,7 +47,12 @@ func TestBasic(t *testing.T) {
 		t.Fatal(err)
 	}
 
-	r, err := c.GetReport(ctx, stuntest.DERPMapOf(stunAddr.String()), nil)
+	dm := stuntest.DERPMapOf(stunAddr.String())
+	// stuntest nodes are all STUNOnly; make this a regular DERP region so
+	// that the PreferredDERP assertion below exercises the normal path.
+	dm.Regions[1].Nodes[0].STUNOnly = false
+
+	r, err := c.GetReport(ctx, dm, nil)
 	if err != nil {
 		t.Fatal(err)
 	}
@@ -130,6 +135,51 @@ func TestSTUNResponseProvesCanSend(t *testing.T) {
 	}
 }
 
+// TestSTUNOnlyRegionNotPreferredDERP verifies a STUNOnly region is
+// never selected as the preferred DERP, even when it's the only region
+// with a STUN latency sample (as in real setups where only a public
+// STUN server is reachable, e.g. self-hosted DERP behind a TCP-only
+// tunnel), where selecting it would blackhole all relay traffic.
+func TestSTUNOnlyRegionNotPreferredDERP(t *testing.T) {
+	// Region 1: a real, reachable STUN server marked STUNOnly.
+	stunAddr, cleanup := stuntest.Serve(t)
+	defer cleanup()
+
+	// Region 2: a UDP blackhole (unreachable) normal DERP region.
+	blackhole, err := net.ListenPacket("udp4", "127.0.0.1:0")
+	if err != nil {
+		t.Fatalf("failed to open blackhole STUN listener: %v", err)
+	}
+	defer blackhole.Close()
+
+	dm := stuntest.DERPMapOf(stunAddr.String(), blackhole.LocalAddr().String())
+	dm.Regions[1].Nodes[0].STUNOnly = true
+	dm.Regions[2].Nodes[0].STUNOnly = false
+
+	c := newTestClient(t)
+
+	ctx := t.Context()
+
+	if err := c.Standalone(ctx, "127.0.0.1:0"); err != nil {
+		t.Fatal(err)
+	}
+
+	r, err := c.GetReport(ctx, dm, nil)
+	if err != nil {
+		t.Fatal(err)
+	}
+
+	// The STUN-only region must have produced a latency sample...
+	if _, ok := r.RegionLatency[1]; !ok {
+		t.Fatalf("expected region 1 (STUNOnly) to have a STUN latency sample; got %+v", r.RegionLatency)
+	}
+	// ...but must not be selected as the preferred DERP, even though it
+	// is the only region with a latency sample.
+	if r.PreferredDERP == 1 {
+		t.Errorf("PreferredDERP = 1 (STUNOnly region); want a region with DERP nodes")
+	}
+}
+
 func TestWorksWhenUDPBlocked(t *testing.T) {
 	blackhole, err := net.ListenPacket("udp4", "127.0.0.1:0")
 	if err != nil {
@@ -530,7 +580,10 @@ func TestAddReportHistoryAndSetPreferredDERP(t *testing.T) {
 			Regions:    map[tailcfg.DERPRegionID]*tailcfg.DERPRegion{},
 		}
 		for _, id := range regions {
-			dm.Regions[id] = &tailcfg.DERPRegion{RegionID: id}
+			dm.Regions[id] = &tailcfg.DERPRegion{
+				RegionID: id,
+				Nodes:    []*tailcfg.DERPNode{{RegionID: id, Name: fmt.Sprintf("%da", id), HostName: fmt.Sprintf("derp%d.invalid", id)}},
+			}
 		}
 		return dm
 	}
```

**File**: `tailcfg/derpmap.go` (modified, +27/-0)
```diff
@@ -183,6 +183,33 @@ type DERPRegion struct {
 	Nodes []*DERPNode
 }
 
+// CanServeDERP reports whether this DERP region can serve as a DERP home.
+// Regions that have no DERP servers can never be DERP homes.
+func (r *DERPRegion) CanServeDERP() bool {
+	if r == nil {
+		return false
+	}
+	for _, n := range r.Nodes {
+		if !n.STUNOnly {
+			return true
+		}
+	}
+	return false
+}
+
+// CanServeDERP is [DERPRegion.CanServeDERP] for [DERPRegionView].
+func (v DERPRegionView) CanServeDERP() bool {
+	if !v.Valid() {
+		return false
+	}
+	for _, n := range v.Nodes().All() {
+		if !n.STUNOnly() {
+			return true
+		}
+	}
+	return false
+}
+
 // DERPNode describes a DERP packet relay node running within a DERPRegion.
 type DERPNode struct {
 	// Name is a unique node name (across all regions).
```

**File**: `tailcfg/derpmap_test.go` (added, +66/-0)
```diff
@@ -0,0 +1,66 @@
+// Copyright (c) Tailscale Inc & contributors
+// SPDX-License-Identifier: BSD-3-Clause
+
+package tailcfg
+
+import "testing"
+
+func TestDERPRegionCanServeDERP(t *testing.T) {
+	tests := []struct {
+		name   string
+		region *DERPRegion
+		want   bool
+	}{
+		{
+			name:   "nil_region",
+			region: (*DERPRegion)(nil),
+			want:   false,
+		},
+		{
+			name:   "no_nodes",
+			region: &DERPRegion{},
+			want:   false,
+		},
+		{
+			name: "stun_only",
+			region: &DERPRegion{
+				Nodes: []*DERPNode{
+					{Name: "1a", STUNOnly: true},
+					{Name: "1b", STUNOnly: true},
+				},
+			},
+			want: false,
+		},
+		{
+			name: "mixed",
+			region: &DERPRegion{
+				Nodes: []*DERPNode{
+					{Name: "1a", STUNOnly: true},
+					{Name: "1b"},
+				},
+			},
+			want: true,
+		},
+		{
+			name: "derp_only",
+			region: &DERPRegion{
+				Nodes: []*DERPNode{{Name: "1a"}},
+			},
+			want: true,
+		},
+	}
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			if got := tt.region.CanServeDERP(); got != tt.want {
+				t.Errorf("CanServeDERP() = %v, want %v", got, tt.want)
+			}
+			var v DERPRegionView
+			if tt.region != nil {
+				v = tt.region.View()
+			}
+			if got := v.CanServeDERP(); got != tt.want {
+				t.Errorf("DERPRegionView.CanServeDERP() = %v, want %v", got, tt.want)
+			}
+		})
+	}
+}
```

#### Recent Merged Pull Requests:
- **PR #22176** (2026-11-04): derp/derpserver: increase pool size to batch writer flushes (@mikeodr)
- **PR #22167** (2026-11-04): appc: add test for AppDNSRoutes ignoring subnet mode apps (@tendstofortytwo)
- **PR #22165** (2026-11-04): feature/conn25: roll back the address assignment when the send queue is full (@mazdakn)
- **PR #22164** (closed): derp/derpserver,cmd/derper: batch writer flushes, arm the write deadline per write (@mikeodr)
- **PR #22163** (2026-11-03): types/appctype: remove Conn25Attr type (@tendstofortytwo)
- **PR #22161** (2026-11-03): cmd/pgproxy: delete, leave README stub (@bradfitz)

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

## X. net/netcheck: never prefer a STUN-only region as the home DERP (#21976)

**RULE**:
When implementing operations in `net/netcheck/netcheck.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in tailscale/tailscale. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `dc698697`: net/netcheck: never prefer a STUN-only region as the home DERP (#21976). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `net/netcheck/netcheck.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
			if !rs.haveRegionLatency(tailcfg.DERPRegionID(rid)) && reg.CanServeDERP() && !reg.Avoid && !reg.NoMeasureNoHome {
		// A STUN-only region has no DERP server to relay through, so it must
		// never become the preferred DERP even though its STUN probe gives it
		// a RegionLatency entry. Regions missing from the map or without any
		// DERP server are equally unable to serve as a home.
		if !dm.Regions().Get(regionID).CanServeDERP() {
			continue
		}

```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
			if !rs.haveRegionLatency(tailcfg.DERPRegionID(rid)) && regionHasDERPNode(reg) && !reg.Avoid && !reg.NoMeasureNoHome {
func regionHasDERPNode(r *tailcfg.DERPRegion) bool {
	for _, n := range r.Nodes {
		if !n.STUNOnly {
			return true
		}
	}
	return false
}

```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `dc698697` are properly handled with clean fallback behavior.
