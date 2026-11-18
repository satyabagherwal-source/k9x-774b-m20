> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/tailscale-tailscale-learnings.md`  
> **Source**: github ([https://github.com/tailscale/tailscale](https://github.com/tailscale/tailscale))  
> **Source Version**: `6a92f86a`  
> **License**: BSD-3-Clause  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-18T17:51:17.888Z  
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
> **Harvest Timestamp**: 2026-11-18T17:51:17.882Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tailscale/tailscale`
- **Description**: The easiest, most secure way to use WireGuard and 2FA.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 39294 stars

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
- **Issue #22450** (2026-11-17): **wireguard-go: wakes up once a second when idle**
  *Symptoms*: I noticed when working on a new version of natlab that runs the Linux kernel within Go synctest tests that an idle Tailscale wakes up once a second interacting the Linux kernel.  Turns out that it's the hack for checking for network namespace moves (moving the tun device), which Tailscale doesn't even use, and which is also seemingly broken in modern kernels. (I didn't bisect whenever it last worked)  Tracking bug to fix that and stop its once/second wake-ups.  /cc @raggi 
  **Post-Mortem & Fix Analysis**:
  > Hahahah, asking Claude to look at the Linux git repo to figure if/when this code ever worked, starting by trying to find whether it worked when it was first written, and then bisecting...  ``` ● The hack only ever worked on Linux 4.5 through 5.0, and the 2019   stable backports broke it on the older series too. It was written in   November 2017, against roughly 4.14, where it did work.    When it worked:   - v4.5: commit 1bd4978a88ac ("tun: honor IFF_UP in tun_get_user()")     added if (!(tun->dev->flags & IFF_UP)) return -EIO; as the first     statement in tun_get_user. A zero-length write on a down interface     therefore got EIO. On an up interface it fell through to the     packet-info length check and got EINVAL.   - Before v4.5 there was no IFF_UP check in the write path, so a     zero-length write always got EINVAL, meaning "up".   - Evidence it was designed around this: in wireguard-go, the hack     was added 2017-11-29 (471f7ff, "Added cross namespace TUN status     detection"

- **Issue #22379** (2026-11-16): **magicsock: peer home DERP stays stale after a delta: updateNodes fast path skips a full netmap that equals the unpatched peersByID snapshot**
  *Symptoms*: ### What is the issue?  A peer's home DERP region can go stale in magicsock and stay stale until an unrelated netmap change, while the control plane and the client's own netmap hold the correct value. Packets for that peer are then sent to a DERP region the peer has left. If the two nodes have no other path (no direct UDP in either direction until a CallMeMaybe gets through), the peer is unreachable.  **Mechanism (v1.104.5, also present at v1.102.5 and on `main` at 59064619a):**  1. `Conn.UpdateNetmapDelta` applies `NodeMutationDERPHome` by calling `ep.setDERPHome` only. It does not update `c.peersByID`. The field comment says so: "per-field NodeMutation patches received in UpdateNetmapDelta are never applied to these snapshots" (`wgengine/magicsock/magicsock.go`, `peersByID`). 2. `Conn.updateNodes` has a fast path that returns early when every peer in the incoming full netmap `Equal`s its `peersByID` snapshot. 3. So: a full netmap (or upsert) records home = A in both the endpoint and the snapshot. A delta moves the endpoint to B; the snapshot still says A. The peer moves back to A, and that change reaches magicsock inside a full netmap rather than as a delta. The node equals the stale snapshot, the fast path skips it, and `ep.derpAddr` stays on B.  The change back to A arrives inside a full netmap whenever the `MapResponse` carrying the `DERPRegion` patch also carries any field in `mapResponseContainsNonPatchFields` (`Node`, `DERPMap`, `DNSConfig`, `Health`, `DisplayMessages

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

### Incident Patch 1: `1f36d5a8` (2026-11-18)
**Commit Message**: feature/linuxdnsfight, go.mod: replace gonotify with direct inotify calls

The resolv.conf watcher needs one watch on one directory and a
blocking read. gonotify v3.0.2 has a bug where it loops forever
without advancing when a record's name length runs past the end of a
read. It also never closes its fd on cancel and allocates 32 KB per
Read. Use x/sys/unix directly, return an error on a malformed record,
and stop when the kernel removes the watch.

Fixes #16576

Signed-off-by: Brad Fitzpatrick <[REDACTED_EMAIL]>
Change-Id: If2bc5e94f8aab2922ee9e07b3c2b75a76f4f9236

**File**: `cmd/tailscaled/depaware.txt` (modified, +0/-2)
```diff
@@ -146,8 +146,6 @@ tailscale.com/cmd/tailscaled dependencies: (generated by github.com/tailscale/de
         github.com/huin/goupnp/scpd                                  from github.com/huin/goupnp
         github.com/huin/goupnp/soap                                  from github.com/huin/goupnp+
         github.com/huin/goupnp/ssdp                                  from github.com/huin/goupnp
-   L 💣 github.com/illarion/gonotify/v3                              from tailscale.com/feature/linuxdnsfight
-   L    github.com/illarion/gonotify/v3/syscallf                     from github.com/illarion/gonotify/v3
    L    github.com/insomniacslk/dhcp/dhcpv4                          from tailscale.com/feature/tap
    L    github.com/insomniacslk/dhcp/iana                            from github.com/insomniacslk/dhcp/dhcpv4
    L    github.com/insomniacslk/dhcp/interfaces                      from github.com/insomniacslk/dhcp/dhcpv4
```

**File**: `feature/linuxdnsfight/linuxdnsfight.go` (modified, +88/-28)
```diff
@@ -8,10 +8,15 @@
 package linuxdnsfight
 
 import (
+	"bytes"
 	"context"
+	"encoding/binary"
+	"errors"
 	"fmt"
+	"os"
+	"path/filepath"
 
-	"github.com/illarion/gonotify/v3"
+	"golang.org/x/sys/unix"
 	"tailscale.com/feature"
 	"tailscale.com/net/dns"
 )
@@ -23,49 +28,104 @@ func init() {
 	dns.HookWatchFile.Set(watchFile)
 }
 
+// watchEvents are the inotify events that indicate a file in the watched
+// directory may have changed.
+const watchEvents = unix.IN_ATTRIB |
+	unix.IN_CLOSE_WRITE |
+	unix.IN_CREATE |
+	unix.IN_DELETE |
+	unix.IN_MODIFY |
+	unix.IN_MOVE
+
 // watchFile sets up an inotify watch for a given directory and
 // calls the callback function every time a particular file is changed.
 // The filename should be located in the provided directory.
+//
+// It calls cb once after the watch is in place, so changes made before
+// watchFile was called are not missed.
 func watchFile(ctx context.Context, dir, filename string, cb func()) error {
-	ctx, cancel := context.WithCancel(ctx)
-	defer cancel()
-
-	const events = gonotify.IN_ATTRIB |
-		gonotify.IN_CLOSE_WRITE |
-		gonotify.IN_CREATE |
-		gonotify.IN_DELETE |
-		gonotify.IN_MODIFY |
-		gonotify.IN_MOVE
-
-	// Watch only dir itself (not recursively) and only for the events
-	// above. gonotify.NewDirWatcher registers IN_ALL_EVENTS on every
-	// subdirectory and filters afterwards, so every open or read under
-	// /etc (including /etc/ld.so.cache on each exec) woke this goroutine.
-	in, err := gonotify.NewInotify(ctx)
+	fd, err := unix.InotifyInit1(unix.IN_CLOEXEC | unix.IN_NONBLOCK)
 	if err != nil {
-		return fmt.Errorf("NewInotify: %w", err)
+		return fmt.Errorf("inotify_init1: %w", err)
 	}
-	if _, err := in.AddWatch(dir, events|gonotify.IN_ONLYDIR); err != nil {
-		return fmt.Errorf("AddWatch: %w", err)
+	// The fd is non-blocking, so os.NewFile registers it with the runtime
+	// poller. Reads then block without a thread, and Close from another
+	// goroutine unblocks them.
+	f := os.NewFile(uintptr(fd), "inotify")
+	defer f.Close()
+
+	// Watch only dir itself (not recursively) and only for watchEvents, so
+	// the kernel drops opens and reads of other files in dir.
+	if _, err := unix.InotifyAddWatch(fd, dir, watchEvents|unix.IN_ONLYDIR); err != nil {
+		return fmt.Errorf("inotify_add_watch %q: %w", dir, err)
 	}
 
-	// NewDirWatcher used to emit a synthetic event for existing files,
-	// which ran cb once at startup. Keep that behavior.
+	stop := context.AfterFunc(ctx, func() { f.Close() })
+	defer stop()
+
 	cb()
 
+	base := filepath.Base(filename)
+	// The kernel only returns whole records and fails the read with EINVAL
+	// if the next one doesn't fit, so size buf for one record with the
+	// longest possible name. Events are rare, so reading one or a few per
+	// read is fine.
+	var buf [unix.SizeofInotifyEvent + unix.NAME_MAX + 1]byte
 	for {
-		evs, err := in.Read()
+		n, err := f.Read(buf[:])
 		if err != nil {
 			if ctx.Err() != nil {
 				return ctx.Err()
 			}
-			return fmt.Errorf("Read: %w", err)
+			return fmt.Errorf("inotify read: %w", err)
 		}
-		for _, ev := range evs {
-			if ev.Name == filename {
-				cb()
-				break
-			}
+		changed, err := parseEvents(buf[:n], base)
+		if err != nil {
+			return err
+		}
+		if changed {
+			cb()
+		}
+	}
+}
+
+// errWatchRemoved is returned by [parseEvents] when the kernel removed the
+// watch, such as when the watched directory was deleted or unmounted.
+var errWatchRemoved = errors.New("inotify watch removed")
+
+// parseEvents parses the inotify_event records in buf, as returned by one
+// read of an inotify fd. It reports whether any of them may indicate a
+// change to the file named base, or that events were lost.
+//
+// It returns an error if buf is malformed. The kernel only returns whole
+// records, so a malformed buf means something other than the kernel's
+// inotify code produced it.
+func parseEvents(buf []byte, base string) (changed bool, err error) {
+	for len(buf) > 0 {
+		if len(buf) < unix.SizeofInotifyEvent {
+			return false, fmt.Errorf("malformed inotify read: %d trailing bytes", len(buf))
+		}
+		mask := binary.NativeEndian.Uint32(buf[4:])
+		nameLen := binary.NativeEndian.Uint32(buf[12:])
+		if uint64(nameLen) > uint64(len(buf)-unix.SizeofInotifyEvent) {
+			return false, fmt.Errorf("malformed inotify read: name length %d exceeds remaining %d bytes", nameLen, len(buf)-unix.SizeofInotifyEvent)
+		}
+		name := buf[unix.SizeofInotifyEvent:][:nameLen]
+		buf = buf[unix.SizeofInotifyEvent+int(nameLen):]
+
+		if mask&unix.IN_IGNORED != 0 {
+			return false, errWatchRemoved
+		}
+		if mask&unix.IN_Q_OVERFLOW != 0 {
+			changed = true
+			continue
+		}
+		if i := bytes.IndexByte(name, 0); i >= 0 {
+			name = name[:i]
+		}
+		if string(name) == base {
+			changed = true
 		}
 	}
+	return changed, nil
 }
```

**File**: `feature/linuxdnsfight/linuxdnsfight_test.go` (modified, +209/-0)
```diff
@@ -6,14 +6,19 @@
 package linuxdnsfight
 
 import (
+	"bytes"
 	"context"
+	"encoding/binary"
 	"errors"
 	"os"
 	"path/filepath"
+	"strconv"
+	"strings"
 	"testing"
 	"time"
 
 	"golang.org/x/sync/errgroup"
+	"golang.org/x/sys/unix"
 )
 
 // startWatch runs watchFile on dir/filename and returns a channel that
@@ -78,3 +83,207 @@ func TestWatchFileIgnoresReadsAndOtherFiles(t *testing.T) {
 	case <-time.After(200 * time.Millisecond):
 	}
 }
+
+// TestWatchFileLongName checks that the read buffer holds an event for a
+// file with the longest name Linux allows, and that watching continues.
+func TestWatchFileLongName(t *testing.T) {
+	dir := t.TempDir()
+	path := filepath.Join(dir, "resolv.conf")
+	calls := startWatch(t, dir, path)
+
+	long := filepath.Join(dir, strings.Repeat("x", unix.NAME_MAX))
+	for range 3 {
+		if err := os.WriteFile(long, nil, 0644); err != nil {
+			t.Fatal(err)
+		}
+		if err := os.Remove(long); err != nil {
+			t.Fatal(err)
+		}
+	}
+	if err := os.WriteFile(path, []byte("x"), 0644); err != nil {
+		t.Fatal(err)
+	}
+	select {
+	case <-calls:
+	case <-time.After(5 * time.Second):
+		t.Fatal("callback was not called after long-name events and a write")
+	}
+}
+
+// inotifyWatches returns the number of inotify fds held by this process
+// and the masks of their watches, read from /proc/self/fdinfo.
+func inotifyWatches(t *testing.T) (fds int, masks []uint64) {
+	t.Helper()
+	ents, err := os.ReadDir("/proc/self/fd")
+	if err != nil {
+		t.Fatal(err)
+	}
+	for _, e := range ents {
+		target, err := os.Readlink("/proc/self/fd/" + e.Name())
+		if err != nil || target != "anon_inode:inotify" {
+			continue
+		}
+		fds++
+		info, err := os.ReadFile("/proc/self/fdinfo/" + e.Name())
+		if err != nil {
+			t.Fatal(err)
+		}
+		for line := range strings.Lines(string(info)) {
+			if !strings.HasPrefix(line, "inotify ") {
+				continue
+			}
+			for f := range strings.FieldsSeq(line) {
+				if hex, ok := strings.CutPrefix(f, "mask:"); ok {
+					m, err := strconv.ParseUint(hex, 16, 32)
+					if err != nil {
+						t.Fatalf("bad fdinfo line %q: %v", line, err)
+					}
+					masks = append(masks, m)
+				}
+			}
+		}
+	}
+	return fds, masks
+}
+
+func TestWatchFileKernelMask(t *testing.T) {
+	dir := t.TempDir()
+	if err := os.Mkdir(filepath.Join(dir, "sub"), 0755); err != nil {
+		t.Fatal(err)
+	}
+	ctx, cancel := context.WithCancel(context.Background())
+	started := make(chan struct{}, 1)
+	errc := make(chan error, 1)
+	go func() {
+		errc <- watchFile(ctx, dir, filepath.Join(dir, "resolv.conf"), func() {
+			select {
+			case started <- struct{}{}:
+			default:
+			}
+		})
+	}()
+	<-started
+
+	fds, masks := inotifyWatches(t)
+	if fds != 1 || len(masks) != 1 {
+		t.Fatalf("got %d inotify fds with %d watches; want 1 fd with 1 watch", fds, len(masks))
+	}
+	const readEvents = unix.IN_OPEN | unix.IN_ACCESS | unix.IN_CLOSE_NOWRITE
+	if masks[0]&readEvents != 0 {
+		t.Errorf("watch mask %#x includes read events", masks[0])
+	}
+
+	cancel()
+	if err := <-errc; !errors.Is(err, context.Canceled) {
+		t.Errorf("watchFile = %v; want context.Canceled", err)
+	}
+	if fds, _ := inotifyWatches(t); fds != 0 {
+		t.Errorf("%d inotify fds still open after watchFile returned", fds)
+	}
+}
+
+func TestWatchFileDirRemoved(t *testing.T) {
+	dir := filepath.Join(t.TempDir(), "etc")
+	if err := os.Mkdir(dir, 0755); err != nil {
+		t.Fatal(err)
+	}
+	started := make(chan struct{})
+	errc := make(chan error, 1)
+	go func() {
+		errc <- watchFile(t.Context(), dir, filepath.Join(dir, "resolv.conf"), func() {
+			close(started)
+		})
+	}()
+	<-started
+	if err := os.Remove(dir); err != nil {
+		t.Fatal(err)
+	}
+	select {
+	case err := <-errc:
+		if !errors.Is(err, errWatchRemoved) {
+			t.Errorf("watchFile = %v; want errWatchRemoved", err)
+		}
+	case <-time.After(5 * time.Second):
+		t.Fatal("watchFile did not return after its directory was removed")
+	}
+}
+
+// event encodes one inotify_event record, padding the name the way the
+// kernel does.
+func event(wd int32, mask uint32, name string) []byte {
+	nameLen := 0
+	if name != "" {
+		nameLen = (len(name) + unix.SizeofInotifyEvent) &^ (unix.SizeofInotifyEvent - 1)
+	}
+	b := make([]byte, unix.SizeofInotifyEvent+nameLen)
+	binary.NativeEndian.PutUint32(b[0:], uint32(wd))
+	binary.NativeEndian.PutUint32(b[4:], mask)
+	binary.NativeEndian.PutUint32(b[12:], uint32(nameLen))
+	copy(b[unix.SizeofInotifyEvent:], name)
+	return b
+}
+
+// badLen returns an inotify_event header whose name length is nameLen,
+// with no name bytes after it.
+func badLen(nameLen uint32) []byte {
+	return binary.NativeEndian.AppendUint32(make([]byte, 12), nameLen)
+}
+
+func TestParseEvents(t *testing.T) {
+	cat := func(bs ...[]byte) []byte { return bytes.Join(bs, nil) }
+	tests := []struct {
+		name        string
+		buf         []byte
+		wantChanged bool
+		wantErr     string // substring; empty means no error
+	}{
+		{name: "empty"},
+		{name: "match", buf: event(1, unix.IN_CLOSE_WRITE, "resolv.
```

**File**: `flake.nix` (modified, +1/-1)
```diff
@@ -172,4 +172,4 @@
     });
   };
 }
-# nix-direnv cache busting line: sha256-2FUoQbRKmhAbpWH356v/TpgjT9KrcZekMO5E1HbLtMA=
+# nix-direnv cache busting line: sha256-ZcegeCjeDDLaX7adwdoxndOjukb4H+JNKHx0xGCWXiQ=
```

**File**: `flakehashes.json` (modified, +2/-2)
```diff
@@ -4,7 +4,7 @@
     "sri": "sha256-Up4oMG6TVLQkV9inAYF3uYbxu+bMHeU7q9BLcXIllow="
   },
   "vendor": {
-    "goModSum": "sha256-uGmj1yPXUtncPrsDPi9pVW4y+ZJuWPCUWXpgIiGJfIo=",
-    "sri": "sha256-2FUoQbRKmhAbpWH356v/TpgjT9KrcZekMO5E1HbLtMA="
+    "goModSum": "sha256-tp8fiukPKErrTuxmaT8TqSiJqSR6BjntVSnWnBWW7RQ=",
+    "sri": "sha256-ZcegeCjeDDLaX7adwdoxndOjukb4H+JNKHx0xGCWXiQ="
   }
 }
```

**File**: `go.mod` (modified, +0/-1)
```diff
@@ -79,7 +79,6 @@ require (
 	github.com/hashicorp/raft-boltdb/v2 v2.3.1
 	github.com/hdevalence/ed25519consensus v0.2.0
 	github.com/huin/goupnp v1.3.0
-	github.com/illarion/gonotify/v3 v3.0.2
 	github.com/inetaf/tcpproxy v0.0.0-20260515195445-c159a6051109
 	github.com/insomniacslk/dhcp v0.0.0-20260901064844-234b97448fae
 	github.com/jellydator/ttlcache/v3 v3.4.1
```

**File**: `go.sum` (modified, +0/-2)
```diff
@@ -710,8 +710,6 @@ github.com/hugelgupf/vmtest v0.0.0-20240307030256-5d9f3d34a58d h1:nP8SfQJqruIVSW
 github.com/hugelgupf/vmtest v0.0.0-20240307030256-5d9f3d34a58d/go.mod h1:B63hDJMhTupLWCHwopAyEo7wRFowx9kOc8m8j1sfOqE=
 github.com/huin/goupnp v1.3.0 h1:UvLUlWDNpoUdYzb2TCn+MuTWtcjXKSza2n6CBdQ0xXc=
 github.com/huin/goupnp v1.3.0/go.mod h1:gnGPsThkYa7bFi/KWmEysQRf48l2dvR5bxr2OFckNX8=
-github.com/illarion/gonotify/v3 v3.0.2 h1:O7S6vcopHexutmpObkeWsnzMJt/r1hONIEogeVNmJMk=
-github.com/illarion/gonotify/v3 v3.0.2/go.mod h1:HWGPdPe817GfvY3w7cx6zkbzNZfi3QjcBm/wgVvEL1U=
 github.com/inconshreveable/mousetrap v1.1.0 h1:wN+x4NVGpMsO7ErUn/mUI3vEoE6Jt13X2s0bqwp9tc8=
 github.com/inconshreveable/mousetrap v1.1.0/go.mod h1:vpF70FUmC8bwa3OWnCshd2FqLfsEA9PFc4w1p2J65bw=
 github.com/inetaf/tcpproxy v0.0.0-20260515195445-c159a6051109 h1:H3ztMPCBcyG60Ks0plTncU3Vs6jIrxhn3nEThpMEpo4=
```

**File**: `net/dns/direct_linux_test.go` (modified, +2/-2)
```diff
@@ -76,8 +76,8 @@ search ts.net ts-dns.test
 }
 
 // watchFile is a test implementation of the file watcher that uses a timer
-// instead of inotify. Real inotify (gonotify.NewDirWatcher) creates goroutines
-// that block on real syscalls, which don't work inside synctest's fake-time
+// instead of inotify. The real watcher blocks reading an inotify fd, which
+// doesn't work inside synctest's fake-time
 // bubble. Instead, we use a one-shot timer that synctest.Wait() will advance,
 // triggering a callback to check for file trampling.
 func watchFile(ctx context.Context, dir, filename string, cb func()) error {
```

---

### Incident Patch 2: `31854730` (2026-11-17)
**Commit Message**: build(deps): bump minimatch from 3.1.2 to 3.1.5 in /client/web

Bumps [minimatch](https://github.com/isaacs/minimatch) from 3.1.2 to 3.1.5.
- [Release notes](https://github.com/isaacs/minimatch/releases)
- [Changelog](https://github.com/isaacs/minimatch/blob/main/changelog.md)
- [Commits](https://github.com/isaacs/minimatch/compare/v3.1.2...v3.1.5)

---
updated-dependencies:
- dependency-name: minimatch
  dependency-version: 3.1.5
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `client/web/pnpm-lock.yaml` (modified, +11/-11)
```diff
@@ -2902,8 +2902,8 @@ packages:
     resolution: {integrity: sha512-vqiC06CuhBTUdZH+RYl8sFrL096vA45Ok5ISO6sE/Mr1jRbGH4Csnhi8f3wKVl7x8mO4Au7Ir9D3Oyv1VYMFJw==}
     engines: {node: '>=12'}
 
-  minimatch@3.1.2:
-    resolution: {integrity: sha512-J7p63hRiAjw1NDEww1W7i37+ByIrOWO5XQQAzZ3VOcL0PNybwpfmV/N05zFAzwQ9USyEcX6t3UO+K5aqBQOIHw==}
+  minimatch@3.1.5:
+    resolution: {integrity: sha512-VgjWUsnnT6n+NUk6eZq77zeFdpW2LWDzP6zFGrCbHXiYNul5Dzqk2HHQ5uFH2DNW5Xbp8+jVzaeNt94ssEEl4w==}
 
   minimatch@9.0.3:
     resolution: {integrity: sha512-RHiac9mvaRw0x3AYRgDC1CxAP7HTcNrrECeA8YYJeWnpo+2Q5CegtZjaotWTWxDG3UeGA1coE05iH1mPjT/2mg==}
@@ -4820,7 +4820,7 @@ snapshots:
       ignore: 5.3.1
       import-fresh: 3.3.0
       js-yaml: 4.3.2
-      minimatch: 3.1.2
+      minimatch: 3.1.5
       strip-json-comments: 3.1.1
     transitivePeerDependencies:
       - supports-color
@@ -4848,7 +4848,7 @@ snapshots:
     dependencies:
       '@humanwhocodes/object-schema': 2.0.1
       debug: 4.4.3(supports-color@7.2.0)
-      minimatch: 3.1.2
+      minimatch: 3.1.5
     transitivePeerDependencies:
       - supports-color
 
@@ -6163,7 +6163,7 @@ snapshots:
       hasown: 2.0.4
       is-core-module: 2.13.1
       is-glob: 4.0.3
-      minimatch: 3.1.2
+      minimatch: 3.1.5
       object.fromentries: 2.0.7
       object.groupby: 1.0.1
       object.values: 1.1.7
@@ -6202,7 +6202,7 @@ snapshots:
       hasown: 2.0.4
       jsx-ast-utils: 3.3.5
       language-tags: 1.0.9
-      minimatch: 3.1.2
+      minimatch: 3.1.5
       object.entries: 1.1.7
       object.fromentries: 2.0.7
 
@@ -6220,7 +6220,7 @@ snapshots:
       eslint: 8.54.0(supports-color@7.2.0)
       estraverse: 5.3.0
       jsx-ast-utils: 3.3.5
-      minimatch: 3.1.2
+      minimatch: 3.1.5
       object.entries: 1.1.7
       object.fromentries: 2.0.7
       object.hasown: 1.1.3
@@ -6287,7 +6287,7 @@ snapshots:
       json-stable-stringify-without-jsonify: 1.0.1
       levn: 0.4.1
       lodash.merge: 4.6.2
-      minimatch: 3.1.2
+      minimatch: 3.1.5
       natural-compare: 1.4.0
       optionator: 0.9.3
       strip-ansi: 6.0.1
@@ -6452,7 +6452,7 @@ snapshots:
       fs.realpath: 1.0.0
       inflight: 1.0.6
       inherits: 2.0.4
-      minimatch: 3.1.2
+      minimatch: 3.1.5
       once: 1.4.0
       path-is-absolute: 1.0.1
 
@@ -6461,7 +6461,7 @@ snapshots:
       fs.realpath: 1.0.0
       inflight: 1.0.6
       inherits: 2.0.4
-      minimatch: 3.1.2
+      minimatch: 3.1.5
       once: 1.4.0
       path-is-absolute: 1.0.1
 
@@ -6813,7 +6813,7 @@ snapshots:
 
   mimic-fn@4.0.0: {}
 
-  minimatch@3.1.2:
+  minimatch@3.1.5:
     dependencies:
       brace-expansion: 1.1.11
 
```

---

### Incident Patch 3: `f1b5e513` (2026-11-18)
**Commit Message**: tstest/natlab/vmtest: make ssh tests run across Linux test matrix (#22491)

Updates #21817

Signed-off-by: Claus Lensbøl <[REDACTED_EMAIL]>

**File**: `tstest/natlab/vmtest/matrix_generated_test.go` (modified, +3/-0)
```diff
@@ -17,6 +17,9 @@ var testMatrix = []struct {
 	{name: "testPeerAPINotReachableFromLAN_Ubuntu2404", fn: func(t *testing.T) { testPeerAPINotReachableFromLAN(t, vmtest.Ubuntu2404) }},
 	{name: "testPeerAPINotReachableFromLAN_Fedora43", fn: func(t *testing.T) { testPeerAPINotReachableFromLAN(t, vmtest.Fedora43) }},
 	{name: "testPeerAPINotReachableFromLAN_Debian13", fn: func(t *testing.T) { testPeerAPINotReachableFromLAN(t, vmtest.Debian13) }},
+	{name: "testTailscaleSSHForOS_Ubuntu2404", fn: func(t *testing.T) { testTailscaleSSHForOS(t, vmtest.Ubuntu2404) }},
+	{name: "testTailscaleSSHForOS_Fedora43", fn: func(t *testing.T) { testTailscaleSSHForOS(t, vmtest.Fedora43) }},
+	{name: "testTailscaleSSHForOS_Debian13", fn: func(t *testing.T) { testTailscaleSSHForOS(t, vmtest.Debian13) }},
 	{name: "testSubnetRouterForOS_Ubuntu2404", fn: func(t *testing.T) { testSubnetRouterForOS(t, vmtest.Ubuntu2404) }},
 	{name: "testSubnetRouterForOS_Fedora43", fn: func(t *testing.T) { testSubnetRouterForOS(t, vmtest.Fedora43) }},
 	{name: "testSubnetRouterForOS_Debian13", fn: func(t *testing.T) { testSubnetRouterForOS(t, vmtest.Debian13) }},
```

**File**: `tstest/natlab/vmtest/ssh_test.go` (modified, +17/-12)
```diff
@@ -18,29 +18,34 @@ import (
 	"tailscale.com/tstest/natlab/vnet"
 )
 
-// TestTailscaleSSH_Ubuntu exercises the Tailscale SSH server ("tailscale up
-// --ssh", not a system sshd) on an Ubuntu node, with an Ubuntu node as the SSH
-// client. It tests logging in as both root and a non-root user, which
-// exercises the incubator's su-based login path.
+// TestTailscaleSSH_Ubuntu exercises the Tailscale SSH server on Ubuntu.
+// See testTailscaleSSHForOS for what is verified.
 func TestTailscaleSSH_Ubuntu(t *testing.T) {
-	testSuite := newTestSuite(t, "ubuntu", vmtest.Ubuntu2404)
+	testTailscaleSSHForOS(t, vmtest.Ubuntu2404)
+}
 
-	ubuntu := testSuite.server
+// testTailscaleSSHForOS exercises the Tailscale SSH server ("tailscale up
+// --ssh", not a system sshd) on a Linux node of the given distribution, with
+// an Ubuntu node as the SSH client. It tests logging in as both root and a
+// non-root user, which exercises the incubator's su-based login path.
+func testTailscaleSSHForOS(t *testing.T, serverOS vmtest.OSImageLinux) {
+	testSuite := newTestSuite(t, serverOS.Name, serverOS)
+	server := testSuite.server
 
-	if out, err := testSuite.env.SSHExec(ubuntu, "useradd -m -s /bin/bash tsuser"); err != nil {
+	if out, err := testSuite.env.SSHExec(server, "useradd -m -s /bin/bash tsuser"); err != nil {
 		t.Fatalf("useradd: %v\n%s", err, out)
 	}
 
-	testSuite.waitSSH(t, "ubuntu", "root")
+	testSuite.waitSSH(t, serverOS.Name, "root")
 
-	testSuite.check(t, "ubuntu root login", "root", "id -un && pwd", "root\n/root")
-	testSuite.check(t, "ubuntu non-root login", "tsuser", "id -un && pwd", "tsuser\n/home/tsuser")
+	testSuite.check(t, serverOS.Name+" root login", "root", "id -un && pwd", "root\n/root")
+	testSuite.check(t, serverOS.Name+" non-root login", "tsuser", "id -un && pwd", "tsuser\n/home/tsuser")
 
 	if out, code := testSuite.ssh(t, "nosuchuser", "true"); code == 0 {
-		t.Errorf("ubuntu nonexistent user: ssh succeeded, want failure:\n%s", out)
+		t.Errorf("%s nonexistent user: ssh succeeded, want failure:\n%s", serverOS.Name, out)
 	}
 
-	testSuite.checkAutogroupNonroot(t, "ubuntu")
+	testSuite.checkAutogroupNonroot(t, serverOS.Name)
 }
 
 // TestTailscaleSSH_FreeBSD exercises the Tailscale SSH server ("tailscale up
```

#### Recent Merged Pull Requests:
- **PR #22491** (2026-11-18): tstest/natlab/vmtest: make ssh tests run across Linux test matrix (@cmol)
- **PR #22489** (2026-11-18): feature/linuxdnsfight, go.mod: replace gonotify with direct inotify calls (@bradfitz)
- **PR #22485** (2026-11-18): cmd/k8s-operator/e2e: tidy e2e test logging (@BeckyPauley)
- **PR #22484** (2026-11-18): ipn: log PostureChecking in Prefs.Pretty (@alexwlchan)
- **PR #22481** (closed): net/tstun: reclaim orphaned TUN interfaces without recreating them (@raggi)
- **PR #22476** (2026-11-17): go.mod: bump github.com/tailscale/wireguard-go (@tailscale-code-updater[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
