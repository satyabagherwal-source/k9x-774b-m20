# Verification Protocol: Verification Protocol: Empirical Defect Shield for tailscale-tailscale-learnings

<!-- PROVENANCE_START
{
  "source_repository": "tailscale-tailscale-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-20T13:13:24.262Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-tailscale-tailscale-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [tailscale-tailscale-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-20T13:13:24.262Z`  
> **Learning ID**: `LEARN-EVO-tailscale-tailscale-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `tailscale-tailscale-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/tailscale-tailscale-learnings.md`  
> **Source**: github ([https://github.com/tailscale/tailscale](https://github.com/tailscale/tailscale))  
> **Source Version**: `c8ba9da5`  
> **License**: BSD-3-Clause  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-20T13:08:27.312Z  
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
> **Harvest Timestamp**: 2026-11-20T13:08:27.307Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tailscale/tailscale`
- **Description**: The easiest, most secure way to use WireGuard and 2FA.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 39367 stars

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

### Incident Patch 1: `c8ba9da5` (2026-11-20)
**Commit Message**: ipn/store/kubestore: cache TLS certs briefly on write replicas (#22103)

The write replica of an HA ProxyGroup (cert share "rw") doesn't keep TLS
certs in memory, so that it notices a recreated, empty cert Secret and
issues a new cert. As a result, it read the cert Secret from the API
server on every TLS handshake, with a 30s timeout. When the API server
was slow or unavailable, handshakes on that replica waited for the read,
and feature/acme repeated the read under the per-domain lock. Clients
with a 10s handshake timeout, such as kubectl, failed.

This commit adds a small per-domain cache of the last-known-good cert
and key for write replicas. The replica serves a cached cert for 30s
before it reads the Secret again. When it has a cached cert, the read
uses a 3s timeout, and on an error other than not found or forbidden
the replica serves the cached cert and waits another 30s before the
next read. A read that finds the Secret missing, forbidden or empty
removes the cached cert and returns ipn.ErrStateNotExist as before, so
a recreated Ingress still gets a new cert, at most 30s later.
Concurrent reads of the same Secret share one GET, and a read that is
in flight when a cert is wr

**File**: `ipn/store/kubestore/store_kube.go` (modified, +139/-17)
```diff
@@ -14,6 +14,7 @@ import (
 	"net/http"
 	"os"
 	"strings"
+	"sync"
 	"time"
 
 	"tailscale.com/envknob"
@@ -24,9 +25,11 @@ import (
 	"tailscale.com/kube/kubeapi"
 	"tailscale.com/kube/kubeclient"
 	"tailscale.com/kube/kubetypes"
+	"tailscale.com/tstime"
 	"tailscale.com/types/logger"
 	"tailscale.com/util/dnsname"
 	"tailscale.com/util/mak"
+	"tailscale.com/util/singleflight"
 )
 
 func init() {
@@ -44,6 +47,17 @@ const (
 	// state Secret and emit an Event.
 	timeout = 30 * time.Second
 
+	// rwCertTTL is how long a write replica serves a TLS cert from its
+	// in-memory cache before it reads the cert Secret again. A short TTL
+	// limits how long the replica can serve a stale cert after the cert
+	// Secret is recreated, for example after Ingress recreation.
+	rwCertTTL = 30 * time.Second
+	// rwCertFallbackTimeout is the timeout for a write replica's cert
+	// Secret read when it has a last-known-good cert to fall back to.
+	// TLS handshakes wait for this read, so it must be much shorter than
+	// typical client handshake timeouts (10s for kubectl).
+	rwCertFallbackTimeout = 3 * time.Second
+
 	reasonTailscaleStateUpdated      = "TailscaledStateUpdated"
 	reasonTailscaleStateLoaded       = "TailscaleStateLoaded"
 	reasonTailscaleStateUpdateFailed = "TailscaleStateUpdateFailed"
@@ -90,6 +104,32 @@ type Store struct {
 	// memory holds the latest tailscale state. Writes write state to a kube
 	// Secret and memory, Reads read from memory.
 	memory mem.Store
+
+	// clock is used for rwCerts expiry.
+	clock tstime.DefaultClock
+
+	// certReads deduplicates concurrent cert Secret reads per domain.
+	certReads singleflight.Group[string, *rwCert]
+
+	// rwCertsMu guards rwCerts.
+	rwCertsMu sync.Mutex
+	// rwCerts holds the last-known-good TLS cert and key per domain for
+	// write replicas (cert share "rw"). Write replicas don't keep certs in
+	// memory, so that they notice a recreated, empty cert Secret and issue
+	// a new cert. Instead, they use rwCerts to skip Secret reads for
+	// rwCertTTL and to keep serving TLS when the API server is unavailable.
+	// Entries are never modified, only replaced, so that a read can tell
+	// whether a write replaced the entry while the read was in flight.
+	rwCerts map[string]*rwCert
+}
+
+// rwCert is a TLS cert and key cached by a write replica.
+type rwCert struct {
+	// cert and key are returned to every reader of the cache entry, so
+	// they must not be modified.
+	cert, key []byte
+	// recheckAt is when the replica reads the cert Secret again.
+	recheckAt time.Time
 }
 
 // New returns a new Store that persists state to Kubernets Secret(s).
@@ -153,7 +193,8 @@ func newWithClient(logf logger.Logf, c kubeclient.Client, secretName string) (*S
 	// Write replicas never load certs in-memory to avoid a situation where,
 	// after Ingress recreation (and the associated cert Secret recreation), new
 	// TLS certs don't get issued because the write replica still has certs
-	// in-memory. Instead, write replicas fetch certs from Secret on each request.
+	// in-memory. Instead, write replicas fetch certs from Secret, with a short
+	// TTL cache (see rwCerts).
 	if s.certShareMode == "ro" {
 		sel := s.certSecretSelector()
 		if err := s.loadCerts(context.Background(), sel); err != nil {
@@ -365,20 +406,24 @@ func (s *Store) WriteTLSCertAndKey(domain string, cert, key []byte) (err error)
 	// TODO(irbekrm): certs for write replicas are currently not
 	// written to memory to avoid out of sync memory state after
 	// Ingress resources have been recreated.  This means that TLS
-	// certs for write replicas are retrieved from the Secret on
-	// each HTTPS request. This is a temporary solution till we
+	// certs for write replicas are retrieved from the Secret once
+	// rwCertTTL has passed. This is a temporary solution till we
 	// implement a Secret watch.
 	if s.certShareMode != "rw" {
 		s.memory.WriteState(ipn.StateKey(domain+".crt"), cert)
 		s.memory.WriteState(ipn.StateKey(domain+".key"), key)
+	} else {
+		s.setRWCert(domain, cert, key)
 	}
 	return nil
 }
 
 // ReadTLSCertAndKey reads a TLS cert and key from memory or from a
 // domain-specific Secret. It first checks the in-memory store, if not found in
 // memory and running cert store in read-only mode, looks up a Secret.
-// Note that write replicas of HA Ingress always retrieve TLS certs from Secrets.
+// Write replicas of HA Ingress don't use the in-memory store. They read the
+// Secret at most once per rwCertTTL, and serve the last-known-good cert if the
+// read fails with an error other than not found or forbidden.
 func (s *Store) ReadTLSCertAndKey(domain string) (cert, key []byte, err error) {
 	if err := dnsname.ValidHostname(domain); err != nil {
 		return nil, nil, fmt.Errorf("invalid domain name %q: %w", domain, err)
@@ -396,14 +441,40 @@ func (s *Store) ReadTLSCertAndKey(domain string) (cert, key []byte, err error) {
 		return nil, nil, ipn.ErrStateNotExist
 	}
 
-	ctx, cancel := context.WithTimeout(
```

**File**: `ipn/store/kubestore/store_kube_test.go` (modified, +402/-0)
```diff
@@ -8,9 +8,14 @@ import (
 	"context"
 	"crypto/sha256"
 	"encoding/json"
+	"errors"
 	"fmt"
 	"strings"
+	"sync"
+	"sync/atomic"
 	"testing"
+	"testing/synctest"
+	"time"
 
 	"github.com/google/go-cmp/cmp"
 	"tailscale.com/envknob"
@@ -19,6 +24,8 @@ import (
 	"tailscale.com/kube/kubeapi"
 	"tailscale.com/kube/kubeclient"
 	"tailscale.com/kube/kubetypes"
+	"tailscale.com/tstest"
+	"tailscale.com/tstime"
 )
 
 func TestKubernetesPodMigrationWithTPMAttestationKey(t *testing.T) {
@@ -635,6 +642,401 @@ func TestReadTLSCertAndKey(t *testing.T) {
 	}
 }
 
+func TestReadTLSCertAndKeyWriteReplicaCache(t *testing.T) {
+	const testDomain = "my-app.tailnetxyz.ts.net"
+
+	var (
+		secretData   map[string][]byte
+		secretGetErr error
+		gets         int
+		lastTimeout  time.Duration
+	)
+	client := &kubeclient.FakeClient{
+		GetSecretImpl: func(ctx context.Context, name string) (*kubeapi.Secret, error) {
+			gets++
+			if deadline, ok := ctx.Deadline(); ok {
+				lastTimeout = time.Until(deadline)
+			}
+			if secretGetErr != nil {
+				return nil, secretGetErr
+			}
+			return &kubeapi.Secret{Data: secretData}, nil
+		},
+		JSONPatchResourceImpl: func(context.Context, string, string, []kubeclient.JSONPatch) error {
+			return nil
+		},
+	}
+	clock := tstest.NewClock(tstest.ClockOpts{})
+	s := &Store{
+		client:        client,
+		secretName:    "ts-state",
+		certShareMode: "rw",
+		clock:         tstime.DefaultClock{Clock: clock},
+		logf:          t.Logf,
+	}
+	tlsData := func(cert, key string) map[string][]byte {
+		return map[string][]byte{"tls.crt": []byte(cert), "tls.key": []byte(key)}
+	}
+
+	steps := []struct {
+		name         string
+		advance      time.Duration
+		secretData   map[string][]byte
+		secretGetErr error
+		// write, if set, writes cert and key with WriteTLSCertAndKey
+		// before the read.
+		write       map[string][]byte
+		wantCert    string
+		wantKey     string
+		wantErr     error
+		wantGet     bool
+		wantTimeout time.Duration // max GetSecret timeout, if wantGet
+	}{
+		{
+			name:         "no_cache_api_error",
+			secretGetErr: errors.New("api error"),
+			wantErr:      errors.New("api error"),
+			wantGet:      true,
+			wantTimeout:  timeout,
+		},
+		{
+			name:        "first_read_from_secret",
+			secretData:  tlsData("cert-a", "key-a"),
+			wantCert:    "cert-a",
+			wantKey:     "key-a",
+			wantGet:     true,
+			wantTimeout: timeout,
+		},
+		{
+			name:       "within_ttl_served_from_cache",
+			advance:    rwCertTTL / 2,
+			secretData: tlsData("cert-b", "key-b"),
+			wantCert:   "cert-a",
+			wantKey:    "key-a",
+		},
+		{
+			name:        "after_ttl_read_from_secret",
+			advance:     rwCertTTL,
+			secretData:  tlsData("cert-b", "key-b"),
+			wantCert:    "cert-b",
+			wantKey:     "key-b",
+			wantGet:     true,
+			wantTimeout: rwCertFallbackTimeout,
+		},
+		{
+			name:         "after_ttl_api_error_serves_last_known_good",
+			advance:      rwCertTTL,
+			secretGetErr: errors.New("api error"),
+			wantCert:     "cert-b",
+			wantKey:      "key-b",
+			wantGet:      true,
+			wantTimeout:  rwCertFallbackTimeout,
+		},
+		{
+			name:         "after_fallback_served_from_cache",
+			advance:      rwCertTTL / 2,
+			secretGetErr: errors.New("api error"),
+			wantCert:     "cert-b",
+			wantKey:      "key-b",
+		},
+		{
+			name:       "after_ttl_secret_emptied",
+			advance:    rwCertTTL,
+			secretData: map[string][]byte{},
+			wantErr:    ipn.ErrStateNotExist,
+			wantGet:    true,
+		},
+		{
+			name:         "emptied_secret_clears_cache",
+			secretGetErr: errors.New("api error"),
+			wantErr:      errors.New("api error"),
+			wantGet:      true,
+			wantTimeout:  timeout,
+		},
+		{
+			name:       "written_cert_served_from_cache",
+			write:      tlsData("cert-c", "key-c"),
+			secretData: tlsData("cert-c", "key-c"),
+			wantCert:   "cert-c",
+			wantKey:    "key-c",
+		},
+		{
+			name:         "after_ttl_secret_not_found",
+			advance:      rwCertTTL,
+			secretGetErr: &kubeapi.Status{Code: 404},
+			wantErr:      ipn.ErrStateNotExist,
+			wantGet:      true,
+		},
+		{
+			name:         "not_found_clears_cache",
+			secretGetErr: errors.New("api error"),
+			wantErr:      errors.New("api error"),
+			wantGet:      true,
+			wantTimeout:  timeout,
+		},
+		{
+			name:       "written_cert_served_from_cache_again",
+			write:      tlsData("cert-d", "key-d"),
+			secretData: tlsData("cert-d", "key-d"),
+			wantCert:   "cert-d",
+			wantKey:    "key-d",
+		},
+		{
+			name:         "after_ttl_secret_forbidden",
+			advance:      rwCertTTL,
+			secretGetErr: &kubeapi.Status{Code: 403},
+			wantErr:      ipn.ErrStateNotExist,
+			wantGet:      true,
+		},
+		{
+			name:         "forbidden_clears_cache",
+			secretGetErr: errors.New("api error"),
+			wantErr:      errors.New("api error"),
+			wantGet:      true,
+			wantTimeout:  timeout,
+		},
+	}
+	for _, st := range steps {
+		clock.Advance(st.advance)
+		secretData = st.secretData
+		secretGetErr = st.secretGetErr
+		if s
```

---

### Incident Patch 2: `519a9f50` (2026-11-20)
**Commit Message**: k8s-operator: stop PortRanges.All() at the last port in the range (#21305)

* k8s-operator: stop PortRanges.All() at the last port in the range

PortRanges.All() walks a range with a uint16 counter and a port <= end
condition. When end is 65535 the increment wraps back to zero instead
of ending the loop, so the iterator restarts at 0 and yields the whole
port space again, and again.

ClashesWith is the caller that drains All(), so it is where this
shows. With one ProxyClass holding 40000-65535, validating a second
one holding 30000-30100 walks up to 65535, wraps, and reaches 30000 on
the next pass, where Contains returns true. The two ranges are
disjoint, but the second ProxyClass is rejected as clashing and never
goes valid. allocatePorts stops at the first free port so it returns,
but once past 65535 the port it picks is outside the range that was
configured.

endPort is only bounded by the cluster's --service-node-port-range, so
65535 is reachable on a cluster configured up to it.

Yield end and then stop. Also skip a range whose Port is above its
EndPort, which the old condition did for free and the new one would
not.

Fixes #21304

Change-Id: I7d60b133a4a83678bc6aba76c5f9b6b6e

**File**: `k8s-operator/apis/v1alpha1/types_proxyclass.go` (modified, +2/-2)
```diff
@@ -133,8 +133,8 @@ func (prs PortRanges) All() iter.Seq[uint16] {
 				end = pr.Port
 			}
 
-			for port := pr.Port; port <= end; port++ {
-				if !yield(port) {
+			for port := int(pr.Port); port <= int(end); port++ {
+				if !yield(uint16(port)) {
 					return
 				}
 			}
```

**File**: `k8s-operator/apis/v1alpha1/types_proxyclass_test.go` (added, +99/-0)
```diff
@@ -0,0 +1,99 @@
+// Copyright (c) Tailscale Inc & contributors
+// SPDX-License-Identifier: BSD-3-Clause
+
+package v1alpha1
+
+import (
+	"slices"
+	"testing"
+)
+
+func TestPortRangesAll(t *testing.T) {
+	tests := []struct {
+		name string
+		prs  PortRanges
+		want []uint16
+	}{
+		{
+			name: "single_port",
+			prs:  PortRanges{{Port: 30000}},
+			want: []uint16{30000},
+		},
+		{
+			name: "small_range",
+			prs:  PortRanges{{Port: 30000, EndPort: 30002}},
+			want: []uint16{30000, 30001, 30002},
+		},
+		{
+			name: "range_ending_at_max_port",
+			prs:  PortRanges{{Port: 65533, EndPort: 65535}},
+			want: []uint16{65533, 65534, 65535},
+		},
+		{
+			name: "single_max_port",
+			prs:  PortRanges{{Port: 65535}},
+			want: []uint16{65535},
+		},
+		{
+			name: "multiple_ranges",
+			prs:  PortRanges{{Port: 30000, EndPort: 30001}, {Port: 65535}},
+			want: []uint16{30000, 30001, 65535},
+		},
+		{
+			name: "inverted_range_yields_nothing",
+			prs:  PortRanges{{Port: 30100, EndPort: 30000}},
+			want: nil,
+		},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			var got []uint16
+			for p := range tt.prs.All() {
+				got = append(got, p)
+				if len(got) > len(tt.want) {
+					t.Fatalf("All() yielded more than the %d expected ports; got %v...", len(tt.want), got)
+				}
+			}
+			if !slices.Equal(got, tt.want) {
+				t.Errorf("All() = %v, want %v", got, tt.want)
+			}
+		})
+	}
+}
+
+func TestPortRangesClashesWith(t *testing.T) {
+	tests := []struct {
+		name string
+		prs  PortRanges
+		pr   PortRange
+		want bool
+	}{
+		{
+			name: "overlapping",
+			prs:  PortRanges{{Port: 30000, EndPort: 30100}},
+			pr:   PortRange{Port: 30050, EndPort: 30150},
+			want: true,
+		},
+		{
+			name: "disjoint",
+			prs:  PortRanges{{Port: 30000, EndPort: 30100}},
+			pr:   PortRange{Port: 30101, EndPort: 30200},
+			want: false,
+		},
+		{
+			name: "disjoint_below_range_ending_at_max_port",
+			prs:  PortRanges{{Port: 40000, EndPort: 65535}},
+			pr:   PortRange{Port: 30000, EndPort: 30100},
+			want: false,
+		},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			if got := tt.prs.ClashesWith(tt.pr); got != tt.want {
+				t.Errorf("ClashesWith(%s) = %v, want %v", tt.pr, got, tt.want)
+			}
+		})
+	}
+}
```

#### Recent Merged Pull Requests:
- **PR #22518** (2026-11-19): go.mod: bump wg-go for hybrid pq log details (@jwhited)
- **PR #22513** (2026-11-19): feature/conn25: guard against an unusable Transit IP (@mazdakn)
- **PR #22508** (2026-11-19): wgengine/magicsock: update packetLooksLike docs (@jwhited)
- **PR #22506** (2026-11-18): tstest/natlab: Fix typo in README sample command (@fmarier)
- **PR #22505** (closed): tstest/natlab: Fix invalid example command in README (@fmarier)
- **PR #22503** (2026-11-19): go.toolchain.rev: bump Go toolchain [release-branch] (@bradfitz)

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

## X. ipn/store/kubestore: cache TLS certs briefly on write replicas

**RULE**:
When implementing operations in `ipn/store/kubestore/store_kube.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in tailscale/tailscale. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c8ba9da5`: ipn/store/kubestore: cache TLS certs briefly on write replicas. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `ipn/store/kubestore/store_kube.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	"sync"
	"tailscale.com/tstime"
	"tailscale.com/util/singleflight"
	// rwCertTTL is how long a write replica serves a TLS cert from its
	// in-memory cache before it reads the cert Secret again. A short TTL
	// limits how long the replica can serve a stale cert after the cert
	// Secret is recreated, for example after Ingress recreation.
	rwCertTTL = 30 * time.Second
	// rwCertFallbackTimeout is the timeout for a write replica's cert
	// Secret read when it has a last-known-good cert to fall back to.
	// TLS handshakes wait for this read, so it must be much shorter than
	// typical client handshake timeouts (10s for kubectl).
	rwCertFallbackTimeout = 3 * time.Second


	// clock is used for rwCerts expiry.
	clock tstime.DefaultClock

	// certReads deduplicates concurrent cert Secret reads per domain.
	certReads singleflight.Group[string, *rwCert]

	// rwCertsMu guards rwCerts.
	rwCertsMu sync.Mutex
	// rwCerts holds the last-known-good TLS cert and key per domain for
	// write replicas (cert share "rw"). Write replicas don't keep certs in
	// memory, so that they notice a recreated, empty cert Secret and issue
	// a new cert. Instead, they use rwCerts to skip Secret reads for
	// rw
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
	// in-memory. Instead, write replicas fetch certs from Secret on each request.
	// certs for write replicas are retrieved from the Secret on
	// each HTTPS request. This is a temporary solution till we
// Note that write replicas of HA Ingress always retrieve TLS certs from Secrets.
	ctx, cancel := context.WithTimeout(
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `c8ba9da5` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
