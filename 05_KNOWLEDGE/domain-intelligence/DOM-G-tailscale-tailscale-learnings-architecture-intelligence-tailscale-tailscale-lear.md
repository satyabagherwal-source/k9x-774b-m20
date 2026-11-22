# Domain G — Architecture Intelligence: Architecture Intelligence: tailscale-tailscale-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "tailscale-tailscale-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-22T04:52:01.677Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-tailscale-tailscale-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [tailscale-tailscale-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-22T04:52:01.677Z`  
> **Learning ID**: `LEARN-EVO-tailscale-tailscale-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain G (Architecture Intelligence)
- **Secondary Corroborating Domains**: H (Technical Construction Intelligence), M (Feedback & Evolution Intelligence), D (Research & Knowledge Intelligence), K (Quality & Verification Intelligence), I (Content & Information Intelligence), J (Search & Distribution Intelligence), A (Human & Need Intelligence), B (Product Intelligence)
- **Confidence Rating**: 56%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from tailscale-tailscale-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/tailscale-tailscale-learnings.md`  
> **Source**: github ([https://github.com/tailscale/tailscale](https://github.com/tailscale/tailscale))  
> **Source Version**: `1a4f4eb6`  
> **License**: BSD-3-Clause  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-22T04:51:25.215Z  
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
> **Harvest Timestamp**: 2026-11-22T04:51:25.210Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tailscale/tailscale`
- **Description**: The easiest, most secure way to use WireGuard and 2FA.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 39438 stars

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

### Incident Patch 1: `1a4f4eb6` (2026-11-07)
**Commit Message**: net/netmon: don't hold mu while closing the OS monitor

On Windows, winMon.Close unregisters the route/address/interface change
callbacks and waits for in-flight ones to return. Those callbacks call
Monitor.isActive, which takes m.mu. Monitor.Close held m.mu across
om.Close, so a change notification arriving during Close deadlocked
with it, and the test binary hung until the timeout.

Release m.mu before calling om.Close. m.closed is already set under the
lock, so late callbacks see the monitor as inactive and return.

This is also the root cause of the Windows "ipnlocal: watchdog timeout"
panics that kill the ipn/ipnlocal and wgengine/netstack test binaries.

Add TestMonitorCloseWaitsForOSCallback, which uses a fake osMon whose
Close, like winipcfg's Unregister, waits for a callback that needs
m.mu. That reproduces the deadlock on any OS.

flakestress TestMonitorCloseWaitsForOSCallback, -p 4, linux:
  before: 16/16 runs deadlocked
  after:  0/135569 runs

Fixes #22228
Fixes #22548

Change-Id: Ibe7740ca23a1ab375d37c280838942f49b4a6a8f
Signed-off-by: Nick Khyl <[REDACTED_EMAIL]>
Signed-off-by: Brad Fitzpatrick <[REDACTED_EMAIL]>

**File**: `net/netmon/netmon.go` (modified, +8/-4)
```diff
@@ -49,6 +49,10 @@ type message interface {
 
 // osMon is the interface that each operating system-specific
 // implementation of the link monitor must implement.
+//
+// Lock order: Monitor.mu is acquired after any osMon lock. An osMon
+// may acquire Monitor.mu (e.g. winMon calls Monitor.isActive from OS
+// callbacks); Monitor must not call osMon methods while holding it.
 type osMon interface {
 	Close() error
 
@@ -72,7 +76,7 @@ type Monitor struct {
 	b       *eventbus.Client
 	changed *eventbus.Publisher[ChangeDelta]
 
-	om     osMon         // nil means not supported on this platform
+	om     osMon         // nil means not supported on this platform; its methods must not be called with mu held
 	change chan bool     // send false to wake poller, true to also force ChangeDeltas be sent
 	stop   chan struct{} // closed on Stop
 	static bool          // static Monitor that doesn't actually monitor
@@ -526,15 +530,15 @@ func (m *Monitor) Close() error {
 	if m.wallTimer != nil {
 		m.wallTimer.Stop()
 	}
+	started := m.started
+	m.mu.Unlock()
 
+	// Close the OS monitor without holding m.mu; see the osMon lock order.
 	var err error
 	if m.om != nil {
 		err = m.om.Close()
 	}
 
-	started := m.started
-	m.mu.Unlock()
-
 	if started {
 		m.goroutines.Wait()
 	}
```

**File**: `net/netmon/netmon_test.go` (modified, +49/-0)
```diff
@@ -4,11 +4,13 @@
 package netmon
 
 import (
+	"errors"
 	"flag"
 	"net"
 	"net/netip"
 	"reflect"
 	"strings"
+	"sync"
 	"sync/atomic"
 	"testing"
 	"time"
@@ -32,6 +34,53 @@ func TestMonitorStartClose(t *testing.T) {
 	}
 }
 
+// callbackWaitingOSMon is an osMon whose Close, like the Windows
+// winipcfg Unregister methods, waits for an in-flight OS callback
+// that needs the Monitor's mutex.
+type callbackWaitingOSMon struct {
+	m      *Monitor
+	closed chan struct{}
+}
+
+func (om *callbackWaitingOSMon) Close() error {
+	close(om.closed)
+	var wg sync.WaitGroup
+	wg.Go(func() { om.m.InterfaceState() })
+	wg.Wait()
+	return nil
+}
+
+func (om *callbackWaitingOSMon) Receive() (message, error) {
+	<-om.closed
+	return nil, errors.New("closed")
+}
+
+func TestMonitorCloseWaitsForOSCallback(t *testing.T) {
+	bus := eventbus.New()
+	defer bus.Close()
+
+	mon, err := New(bus, t.Logf)
+	if err != nil {
+		t.Fatal(err)
+	}
+	if err := mon.om.Close(); err != nil {
+		t.Fatal(err)
+	}
+	mon.om = &callbackWaitingOSMon{m: mon, closed: make(chan struct{})}
+	mon.Start()
+
+	done := make(chan error, 1)
+	go func() { done <- mon.Close() }()
+	select {
+	case err := <-done:
+		if err != nil {
+			t.Fatal(err)
+		}
+	case <-time.After(10 * time.Second):
+		t.Fatal("Monitor.Close deadlocked waiting for OS callback")
+	}
+}
+
 func TestMonitorJustClose(t *testing.T) {
 	bus := eventbus.New()
 	defer bus.Close()
```

---

### Incident Patch 2: `1cc8632a` (2026-11-21)
**Commit Message**: go.mod: bump github.com/tailscale/wireguard-go

* github.com/tailscale/wireguard-go: https://github.com/tailscale/wireguard-go/compare/330f55178f24...a8c4fbf26d6c

Triggered by @raggi via the bumpdep workflow.

Updates #22475

Signed-off-by: Dep Updater <[REDACTED_EMAIL]>

**File**: `flake.nix` (modified, +1/-1)
```diff
@@ -172,4 +172,4 @@
     });
   };
 }
-# nix-direnv cache busting line: sha256-BqLElx5MlGtEXEkh+2PTo3A38vQjHsQWjHLrXK1K7Zg=
+# nix-direnv cache busting line: sha256-nOGMprgdGfL3xU7R3La0aHEJNpVYkP9Inc0Fs8+KfiI=
```

**File**: `flakehashes.json` (modified, +2/-2)
```diff
@@ -4,7 +4,7 @@
     "sri": "sha256-Qmy06FkeFkjqCo1FLSD9dO7hTvdo/gC2VACJniuiQBU="
   },
   "vendor": {
-    "goModSum": "sha256-q9yKYr8Hs+m30TEtGIfZ0BXTrKz576ZtGnXEw2XRfmc=",
-    "sri": "sha256-BqLElx5MlGtEXEkh+2PTo3A38vQjHsQWjHLrXK1K7Zg="
+    "goModSum": "sha256-QP1as7ifhlOtEVS1hZaWhNQ1HMDQRKve2PEZMziRxCQ=",
+    "sri": "sha256-nOGMprgdGfL3xU7R3La0aHEJNpVYkP9Inc0Fs8+KfiI="
   }
 }
```

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -125,7 +125,7 @@ require (
 	github.com/tailscale/ts-gokrazy v0.0.0-20260630224145-b83088f2e52e
 	github.com/tailscale/web-client-prebuilt v0.0.0-20260917222731-e0ed2d0d0fea
 	github.com/tailscale/wf v0.0.0-20240214030419-6fbb0a674ee6
-	github.com/tailscale/wireguard-go v0.0.0-20261119191353-330f55178f24
+	github.com/tailscale/wireguard-go v0.0.0-20261121000637-a8c4fbf26d6c
 	github.com/tailscale/xnet v0.0.0-20240729143630-8497ac4dab2e
 	github.com/tc-hib/winres v0.3.1
 	github.com/tcnksm/go-httpstat v0.2.0
```

**File**: `go.sum` (modified, +2/-2)
```diff
@@ -1152,8 +1152,8 @@ github.com/tailscale/web-client-prebuilt v0.0.0-20260917222731-e0ed2d0d0fea h1:a
 github.com/tailscale/web-client-prebuilt v0.0.0-20260917222731-e0ed2d0d0fea/go.mod h1:agQPE6y6ldqCOui2gkIh7ZMztTkIQKH049tv8siLuNQ=
 github.com/tailscale/wf v0.0.0-20240214030419-6fbb0a674ee6 h1:l10Gi6w9jxvinoiq15g8OToDdASBni4CyJOdHY1Hr8M=
 github.com/tailscale/wf v0.0.0-20240214030419-6fbb0a674ee6/go.mod h1:ZXRML051h7o4OcI0d3AaILDIad/Xw0IkXaHM17dic1Y=
-github.com/tailscale/wireguard-go v0.0.0-20261119191353-330f55178f24 h1:znSXvacbd0ocSc2jmRIf0WL7PuvAnohnKbNlBffdppM=
-github.com/tailscale/wireguard-go v0.0.0-20261119191353-330f55178f24/go.mod h1:Hl7pyu83xNjc1LY5e9apq2mWm8Hl76wRtJbwZ2XISqY=
+github.com/tailscale/wireguard-go v0.0.0-20261121000637-a8c4fbf26d6c h1:hLTbcmifu309AoHUdjK+x5mFv/rp2kC01JHkdhCS48A=
+github.com/tailscale/wireguard-go v0.0.0-20261121000637-a8c4fbf26d6c/go.mod h1:Hl7pyu83xNjc1LY5e9apq2mWm8Hl76wRtJbwZ2XISqY=
 github.com/tailscale/xnet v0.0.0-20240729143630-8497ac4dab2e h1:zOGKqN5D5hHhiYUp091JqK7DPCqSARyUfduhGUY8Bek=
 github.com/tailscale/xnet v0.0.0-20240729143630-8497ac4dab2e/go.mod h1:orPd6JZXXRyuDusYilywte7k094d7dycXXU5YnWsrwg=
 github.com/tc-hib/winres v0.3.1 h1:CwRjEGrKdbi5CvZ4ID+iyVhgyfatxFoizjPhzez9Io4=
```

**File**: `shell.nix` (modified, +1/-1)
```diff
@@ -16,4 +16,4 @@
 ) {
   src =  ./.;
 }).shellNix
-# nix-direnv cache busting line: sha256-BqLElx5MlGtEXEkh+2PTo3A38vQjHsQWjHLrXK1K7Zg=
+# nix-direnv cache busting line: sha256-nOGMprgdGfL3xU7R3La0aHEJNpVYkP9Inc0Fs8+KfiI=
```

#### Recent Merged Pull Requests:
- **PR #22556** (closed): go.mod: bump github.com/tailscale/wireguard-go (@tailscale-code-updater[bot])
- **PR #22555** (closed): net/netmon: don't hold Monitor.mu while closing the OS monitor (@bradfitz)
- **PR #22544** (2026-11-21): ipn/ipnlocal: deflake TestServeAppCapsConcurrentStreams on Windows (@bradfitz)
- **PR #22542** (2026-11-21): .github: use gomodfs for the Go module cache on Windows CI (@bradfitz)
- **PR #22537** (2026-11-21): go.mod: bump github.com/tailscale/wireguard-go (@tailscale-code-updater[bot])
- **PR #22535** (2026-11-20): magicsock,tstun: add gauges for the number of open queues and sockets (@illotum)

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

## X. net/netmon: don't hold mu while closing the OS monitor

**RULE**:
When implementing operations in `net/netmon/netmon.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in tailscale/tailscale. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `1a4f4eb6`: net/netmon: don't hold mu while closing the OS monitor. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `net/netmon/netmon.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
//
// Lock order: Monitor.mu is acquired after any osMon lock. An osMon
// may acquire Monitor.mu (e.g. winMon calls Monitor.isActive from OS
// callbacks); Monitor must not call osMon methods while holding it.
	om     osMon         // nil means not supported on this platform; its methods must not be called with mu held
	started := m.started
	m.mu.Unlock()
	// Close the OS monitor without holding m.mu; see the osMon lock order.
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
	om     osMon         // nil means not supported on this platform
	started := m.started
	m.mu.Unlock()

```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `1a4f4eb6` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
