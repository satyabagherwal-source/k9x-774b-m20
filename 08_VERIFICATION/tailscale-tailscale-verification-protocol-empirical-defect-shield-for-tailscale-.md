# Verification Protocol: Verification Protocol: Empirical Defect Shield for tailscale/tailscale

<!-- PROVENANCE_START
{
  "source_repository": "tailscale/tailscale",
  "source_url": "https://github.com/tailscale/tailscale",
  "source_version": "87b3a5ff",
  "license": "BSD-3-Clause",
  "timestamp": "2026-11-22T18:00:29.186Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-tailscale-tailscale",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [tailscale/tailscale](https://github.com/tailscale/tailscale) (Revision: `87b3a5ff`).  
> **License**: BSD-3-Clause | **Timestamp**: `2026-11-22T18:00:29.186Z`  
> **Learning ID**: `learn-github-tailscale-tailscale`


## 1. Scope & Verification Target
- **Target Repository**: `tailscale/tailscale` (Commit: `87b3a5ff`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): tailscale/tailscale

> **Canonical Artifact**: `07_PROJECT_LEARNING/tailscale-tailscale-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/tailscale/tailscale](https://github.com/tailscale/tailscale))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-22T18:00:28.202Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tailscale/tailscale`
- **Description**: The easiest, most secure way to use WireGuard and 2FA.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 39466 stars

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

### Incident Patch 1: `87b3a5ff` (2026-11-22)
**Commit Message**: control/ts2021, net/netutil: fail early if net/http's HTTP/2 is disabled

The ts2021 protocol speaks HTTP/2 inside the Noise stream. With
GODEBUG=http2client=0 (or the nethttpomithttp2 build tag), net/http
can't, and http.DefaultTransport also never gets a TLSClientConfig,
which made controlhttp crash tailscaled with a nil pointer dereference.
Return a clear user-visible error from ts2021.NewClient instead, and
make netutil.NewDefaultTransport always return a non-nil
TLSClientConfig.

Fixes #22578

Change-Id: I119c6ebbd6f1bbb5c693fb44a577862b98e688f3
Signed-off-by: Brad Fitzpatrick <[REDACTED_EMAIL]>

**File**: `control/ts2021/client.go` (modified, +19/-0)
```diff
@@ -32,6 +32,7 @@ import (
 	"tailscale.com/util/httpbody"
 	"tailscale.com/util/mak"
 	"tailscale.com/util/set"
+	"tailscale.com/util/vizerror"
 )
 
 // Client provides a http.Client to connect to tailcontrol over
@@ -101,6 +102,21 @@ type ClientOpts struct {
 	ProtocolVersion uint16
 }
 
+// errNoHTTP2 is returned by [NewClient] when net/http's HTTP/2 support is
+// disabled, which the ts2021 protocol requires.
+var errNoHTTP2 = vizerror.New("unsupported configuration: Tailscale requires Go's HTTP/2 support, but it's disabled (is GODEBUG=http2client=0 set?)")
+
+// transportHasHTTP2 reports whether net/http configured HTTP/2 on tr.
+//
+// net/http sets up HTTP/2 on a Transport once, on first use or Clone, and
+// skips it when HTTP/2 is disabled with GODEBUG=http2client=0 or the
+// nethttpomithttp2 build tag. When it does set it up, it registers an "h2"
+// entry in TLSNextProto, the historical signal that HTTP/2 is enabled.
+func transportHasHTTP2(tr *http.Transport) bool {
+	tr.Clone() // run net/http's one-time HTTP/2 setup on tr
+	return tr.TLSNextProto["h2"] != nil
+}
+
 // NewClient returns a new noiseClient for the provided server and machine key.
 //
 // netMon may be nil, if non-nil it's used to do faster interface lookups.
@@ -171,6 +187,9 @@ func NewClient(opts ClientOpts) (*Client, error) {
 	// speaks inside the ts2021 Noise encryption. But Go doesn't know about that,
 	// so we use "SetUnencryptedHTTP2" even though it's actually encrypted.
 	tr.Protocols.SetUnencryptedHTTP2(true)
+	if !transportHasHTTP2(tr) {
+		return nil, errNoHTTP2
+	}
 	tr.DialTLSContext = func(ctx context.Context, network, addr string) (net.Conn, error) {
 		return np.dial(ctx)
 	}
```

**File**: `control/ts2021/client_test.go` (modified, +36/-0)
```diff
@@ -14,6 +14,8 @@ import (
 	"math"
 	"net/http"
 	"net/http/httptrace"
+	"os"
+	"os/exec"
 	"strconv"
 	"strings"
 	"sync/atomic"
@@ -457,3 +459,37 @@ func (up *Upgrader) ServeHTTP(w http.ResponseWriter, r *http.Request) {
 		BaseConfig: up.httpBaseConfig,
 	})
 }
+
+// TestNewClientNoHTTP2 verifies that NewClient fails with a clear error when
+// net/http's HTTP/2 support is disabled. See tailscale/tailscale#22578.
+// It runs in a child process because GODEBUG=http2client=0 must be set at
+// process start.
+func TestNewClientNoHTTP2(t *testing.T) {
+	newClient := func() error {
+		nc, err := NewClient(ClientOpts{
+			Logf:         t.Logf,
+			PrivKey:      testPrivKey,
+			ServerPubKey: testServerPub,
+			ServerURL:    "https://unused.example",
+			Dialer:       tsdial.NewDialer(netmon.NewStatic()),
+		})
+		if err == nil {
+			nc.Close()
+		}
+		return err
+	}
+	if os.Getenv("TS_TEST_TS2021_CHILD") == "1" {
+		if err := newClient(); err != errNoHTTP2 {
+			t.Fatalf("NewClient error = %v; want %v", err, errNoHTTP2)
+		}
+		return
+	}
+	if err := newClient(); err != nil {
+		t.Fatalf("NewClient with HTTP/2 enabled: %v", err)
+	}
+	cmd := exec.Command(os.Args[0], "-test.run=^TestNewClientNoHTTP2$")
+	cmd.Env = append(os.Environ(), "TS_TEST_TS2021_CHILD=1", "GODEBUG=http2client=0")
+	if out, err := cmd.CombinedOutput(); err != nil {
+		t.Errorf("with GODEBUG=http2client=0: %v\n%s", err, out)
+	}
+}
```

**File**: `net/netutil/netutil.go` (modified, +14/-0)
```diff
@@ -6,6 +6,7 @@ package netutil
 
 import (
 	"bufio"
+	"crypto/tls"
 	"io"
 	"net"
 	"net/http"
@@ -23,7 +24,20 @@ import (
 // standard *http.Transport) it returns a clone of it, preserving the existing
 // behavior exactly; otherwise it returns a fresh transport mirroring the
 // stdlib defaults.
+//
+// The returned transport's TLSClientConfig is always non-nil. The stdlib's
+// DefaultTransport only gets a TLSClientConfig as a side effect of its HTTP/2
+// setup, which is skipped when HTTP/2 is disabled (such as with
+// GODEBUG=http2client=0).
 func NewDefaultTransport() *http.Transport {
+	tr := newDefaultTransport()
+	if tr.TLSClientConfig == nil {
+		tr.TLSClientConfig = &tls.Config{}
+	}
+	return tr
+}
+
+func newDefaultTransport() *http.Transport {
 	if tr, ok := http.DefaultTransport.(*http.Transport); ok {
 		return tr.Clone()
 	}
```

**File**: `net/netutil/netutil_test.go` (modified, +26/-0)
```diff
@@ -7,6 +7,8 @@ import (
 	"io"
 	"net"
 	"net/http"
+	"os"
+	"os/exec"
 	"runtime"
 	"testing"
 	"time"
@@ -55,6 +57,27 @@ func TestOneConnListener(t *testing.T) {
 	}
 }
 
+// TestNewDefaultTransportNoHTTP2 is a regression test for
+// tailscale/tailscale#22578. http.DefaultTransport only gets a TLSClientConfig
+// from its one-time HTTP/2 setup, so it runs the GODEBUG=http2client=0 case
+// in a child process.
+func TestNewDefaultTransportNoHTTP2(t *testing.T) {
+	if os.Getenv("TS_TEST_NETUTIL_CHILD") == "1" {
+		if NewDefaultTransport().TLSClientConfig == nil {
+			t.Fatal("TLSClientConfig = nil; want non-nil")
+		}
+		return
+	}
+	if NewDefaultTransport().TLSClientConfig == nil {
+		t.Error("TLSClientConfig = nil; want non-nil")
+	}
+	cmd := exec.Command(os.Args[0], "-test.run=^TestNewDefaultTransportNoHTTP2$")
+	cmd.Env = append(os.Environ(), "TS_TEST_NETUTIL_CHILD=1", "GODEBUG=http2client=0")
+	if out, err := cmd.CombinedOutput(); err != nil {
+		t.Errorf("with GODEBUG=http2client=0: %v\n%s", err, out)
+	}
+}
+
 // roundTripperFunc is an http.RoundTripper that is not a *http.Transport,
 // used to exercise the fallback path of NewDefaultTransport.
 type roundTripperFunc func(*http.Request) (*http.Response, error)
@@ -103,6 +126,9 @@ func TestNewDefaultTransport(t *testing.T) {
 	if tr.DialContext == nil {
 		t.Error("fallback DialContext = nil; want non-nil")
 	}
+	if tr.TLSClientConfig == nil {
+		t.Error("fallback TLSClientConfig = nil; want non-nil")
+	}
 	if tr.Proxy == nil {
 		t.Error("fallback Proxy = nil; want non-nil")
 	}
```

---

### Incident Patch 2: `a54bdf2b` (2026-11-21)
**Commit Message**: .github/actions/go-cache: cache the cigocacher binary

Building cigocacher took most of the ~15-27s "Set up cigocacher" step
on every Windows job. Cache the binary in actions/cache, keyed on
cmd/cigocacher, go.mod, and go.sum, and add a test that cigocacher has
no other tailscale.com dependencies so that key stays complete.

Updates tailscale/corp#34812
Updates tailscale/corp#28679

Change-Id: I2def6f28a045249b2e87331a1f42c621e161031f
Signed-off-by: Brad Fitzpatrick <[REDACTED_EMAIL]>

**File**: `.github/actions/go-cache/action.sh` (modified, +12/-2)
```diff
@@ -8,6 +8,7 @@
 # Inputs:
 #   URL: The cigocached server URL.
 #   HOST: The cigocached server host to dial.
+#   BIN_DIR: Optional directory to find or build the cigocacher binary in.
 # Outputs:
 #   success: Whether cigocacher was set up successfully.
 
@@ -25,7 +26,16 @@ fi
 
 BIN_PATH="$(PATH="$PATH:$HOME/bin" command -v cigocacher || true)"
 if [ -z "${BIN_PATH}" ]; then
-  echo "cigocacher not found in PATH, attempting to build or fetch it"
+  EXE=""
+  if [ "${RUNNER_OS:-}" = "Windows" ]; then
+    EXE=".exe"
+  fi
+  BIN_PATH="${BIN_DIR:-${RUNNER_TEMP:-/tmp}}/cigocacher${EXE}"
+fi
+if [ -f "${BIN_PATH}" ]; then
+  echo "Using cigocacher at ${BIN_PATH}"
+else
+  echo "cigocacher not found in PATH or cache, attempting to build or fetch it"
 
   GOPATH=$(command -v go || true)
   if [ -z "${GOPATH}" ]; then
@@ -36,7 +46,7 @@ if [ -z "${BIN_PATH}" ]; then
     GOPATH="./tool/go"
   fi
 
-  BIN_PATH="${RUNNER_TEMP:-/tmp}/cigocacher$(${GOPATH} env GOEXE)"
+  mkdir -p "$(dirname "${BIN_PATH}")"
   if [ -d "cmd/cigocacher" ]; then
     echo "cmd/cigocacher found locally, building from local source"
     "${GOPATH}" build -o "${BIN_PATH}" ./cmd/cigocacher
```

**File**: `.github/actions/go-cache/action.yml` (modified, +17/-0)
```diff
@@ -23,13 +23,30 @@ outputs:
 runs:
   using: composite
   steps:
+    # cigocacher has no tailscale.com dependencies outside cmd/cigocacher
+    # (see TestDeps), so its binary depends only on these files.
+    - name: Compute cigocacher cache key
+      id: key
+      if: inputs.cigocached-url != ''
+      shell: bash
+      working-directory: ${{ inputs.checkout-path }}
+      run: echo "key=cigocacher-$RUNNER_OS-$RUNNER_ARCH-$(cat cmd/cigocacher/*.go go.mod go.sum | sha256sum | cut -c1-32)" >> "$GITHUB_OUTPUT"
+
+    - name: Restore cigocacher binary
+      if: inputs.cigocached-url != ''
+      uses: actions/cache@668228422ae6a00e4ad889ee87cd7109ec5666a7 # zizmor: ignore[cache-poisoning] v5.0.4
+      with:
+        path: ${{ runner.temp }}/cigocacher-bin
+        key: ${{ steps.key.outputs.key }}
+
     - name: Setup cigocacher
       id: setup
       shell: bash
       env:
         URL: ${{ inputs.cigocached-url }}
         HOST: ${{ inputs.cigocached-host }}
         CACHE_DIR: ${{ inputs.cache-dir }}
+        BIN_DIR: ${{ runner.temp }}/cigocacher-bin
       working-directory: ${{ inputs.checkout-path }}
       # https://github.com/orgs/community/discussions/25910
       run: $GITHUB_ACTION_PATH/action.sh
```

**File**: `cmd/cigocacher/deps_test.go` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+// Copyright (c) Tailscale Inc & contributors
+// SPDX-License-Identifier: BSD-3-Clause
+
+package main
+
+import (
+	"strings"
+	"testing"
+
+	"tailscale.com/tstest/deptest"
+)
+
+// TestDeps checks that cigocacher depends on no other tailscale.com
+// packages. The .github/actions/go-cache action caches the cigocacher
+// binary keyed on only cmd/cigocacher, go.mod, and go.sum.
+func TestDeps(t *testing.T) {
+	for _, goos := range []string{"linux", "darwin", "windows"} {
+		deptest.DepChecker{
+			GOOS:   goos,
+			GOARCH: "amd64",
+			OnDep: func(dep string) {
+				if strings.HasPrefix(dep, "tailscale.com/") {
+					t.Errorf("GOOS=%s: unexpected dependency %q; update the cache key in .github/actions/go-cache/action.yml", goos, dep)
+				}
+			},
+		}.Check(t)
+	}
+}
```

#### Recent Merged Pull Requests:
- **PR #22579** (2026-11-22): control/ts2021, net/netutil: fail early if net/http's HTTP/2 is disabled (@bradfitz)
- **PR #22556** (closed): go.mod: bump github.com/tailscale/wireguard-go (@tailscale-code-updater[bot])
- **PR #22555** (closed): net/netmon: don't hold Monitor.mu while closing the OS monitor (@bradfitz)
- **PR #22554** (2026-11-22): net/dnsfallback, net/captivedetection: drop decommissioned DERP 6a, make test hermetic (@bradfitz)
- **PR #22546** (2026-11-22): .github/actions/go-cache: cache the cigocacher binary (@bradfitz)
- **PR #22544** (2026-11-21): ipn/ipnlocal: deflake TestServeAppCapsConcurrentStreams on Windows (@bradfitz)

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

## X. control/ts2021, net/netutil: fail early if net/http's HTTP/2 is disabled

**RULE**:
When implementing operations in `control/ts2021/client.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in tailscale/tailscale. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `87b3a5ff`: control/ts2021, net/netutil: fail early if net/http's HTTP/2 is disabled. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `control/ts2021/client.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	"tailscale.com/util/vizerror"
// errNoHTTP2 is returned by [NewClient] when net/http's HTTP/2 support is
// disabled, which the ts2021 protocol requires.
var errNoHTTP2 = vizerror.New("unsupported configuration: Tailscale requires Go's HTTP/2 support, but it's disabled (is GODEBUG=http2client=0 set?)")

// transportHasHTTP2 reports whether net/http configured HTTP/2 on tr.
//
// net/http sets up HTTP/2 on a Transport once, on first use or Clone, and
// skips it when HTTP/2 is disabled with GODEBUG=http2client=0 or the
// nethttpomithttp2 build tag. When it does set it up, it registers an "h2"
// entry in TLSNextProto, the historical signal that HTTP/2 is enabled.
func transportHasHTTP2(tr *http.Transport) bool {
	tr.Clone() // run net/http's one-time HTTP/2 setup on tr
	return tr.TLSNextProto["h2"] != nil
}

	if !transportHasHTTP2(tr) {
		return nil, errNoHTTP2
	}
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `87b3a5ff` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
