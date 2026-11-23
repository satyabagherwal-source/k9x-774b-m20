# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: tailscale/tailscale Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "tailscale/tailscale",
  "source_url": "https://github.com/tailscale/tailscale",
  "source_version": "da6276d7",
  "license": "BSD-3-Clause",
  "timestamp": "2026-11-23T23:39:57.055Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-tailscale-tailscale",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [tailscale/tailscale](https://github.com/tailscale/tailscale) (Revision: `da6276d7`).  
> **License**: BSD-3-Clause | **Timestamp**: `2026-11-23T23:39:57.055Z`  
> **Learning ID**: `learn-github-tailscale-tailscale`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: G (Architecture Intelligence), B (Product Intelligence), K (Quality & Verification Intelligence), D (Research & Knowledge Intelligence), I (Content & Information Intelligence), M (Feedback & Evolution Intelligence), J (Search & Distribution Intelligence), A (Human & Need Intelligence)
- **Confidence Rating**: 55%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from tailscale/tailscale:

# Forensic Learning Record (Deep Inspection): tailscale/tailscale

> **Canonical Artifact**: `07_PROJECT_LEARNING/tailscale-tailscale-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/tailscale/tailscale](https://github.com/tailscale/tailscale))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-23T23:39:56.354Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tailscale/tailscale`
- **Description**: The easiest, most secure way to use WireGuard and 2FA.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 39534 stars

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
- **Issue #22582** (2026-11-23): **client/systray: SIGINT and SIGTERM exit with status 1 during normal shutdown**
  *Symptoms*: ### What is the issue?  On upstream main eaf3fc8daf90fb18714e21df38258db2ae33184a, stopping the Linux tray with SIGINT or SIGTERM cancels its IPN bus watch. watchIPNBus then treats context.Canceled as fatal and terminates the process with status 1.  The signal handler calls onExit directly, which cleans up handlers but does not stop the native tray loop. The fatal watcher currently terminates the process instead. Removing the fatal alone would leave that loop running.  ### Steps to reproduce  I reproduced this using the actual Menu.Run and tray library in subprocesses, with a private D-Bus session, a fake StatusNotifierWatcher, and a fake tailscaled LocalAPI streaming watch endpoint. No live tailnet or desktop session is needed.  Apply the attached clean-shutdown-tests.patch to this exact upstream commit and run:      ./tool/go test -race ./client/systray -run '^TestShutdownSignals$' -count=1 -v  Both signal cases exit with status 1 and log:      exiting     ipnbus error: context canceled     watchIPNBus: ipnbus error: context canceled  The test also reproduced status 1 for the D-Bus Quit action. That path may be scheduling-dependent because Run can return before the watcher reaches log.Fatal.  ### Are there any recent changes that introduced the issue?  _No response_  ### OS  Linux  ### OS version  Debian GNU/Linux 13; Linux 6.12.111+deb13-amd64  ### Tailscale version  1.104.7  ### Other software  _No response_  ### Bug report  _No response_

- **Issue #22574** (2026-11-23): **Funnel: 2 of 3 edges slow (~5 s TLS) or failing since 2026-11-22 05:31 UTC, ingress via DERP fra**
  *Symptoms*: ### What is the issue?  Since 2026-11-22 05:31 UTC, Funnel requests to one of my nodes intermittently fail. Callers get "Bad Gateway" or time out after about 5 s. Nothing changed on my side. The node's log had zero TLS handshake errors for the 46 hours before (back to 2026-11-20 07:32 UTC); since then about 35-40 per hour.  Testing each Funnel edge separately (public DNS, `curl --resolve NAME:443:EDGE`, 20 requests each, 2026-11-22 07:37-07:44 UTC; the app answers 403 to "/" by design, so any HTTP code means TLS completed):  | Edge | Result | Time until TLS done | |---|---|---| | 185.40.234.172 | 20/20 ok | 0.16-0.41 s | | 185.40.234.37 | 19/20 ok, 1 failed | 3.7-13.7 s, mostly ~5.4 s | | 185.40.234.210 | 16/20 ok, 4 failed | ~5.4 s, some 10.8-13.8 s |  So one edge is healthy and two are consistently slow or failing, which explains why it looks intermittent: it depends on which edge the caller hits. A warm test (2 requests 10 s apart to 185.40.234.37) was still slow: 3.2 s, then 2.3 s.  On the node: - `peerapi_ingress` went from 138 to 211 during the test, so connections reach the node; the delay is in the relay-to-node leg. - All `funnel-ingress-node` peers have empty `CurAddr` (no direct path); the three active ones have `Relay: fra`. Node metrics: ~1,986 packets received via DERP vs 49 direct. - `tailscale netcheck` on the node: UDP yes, IPv4 yes, MappingVariesByDestIP false, nearest DERP Frankfurt 29.7 ms. - Each failure logs the same pattern (addresses redacted):  ``` 07

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

### Incident Patch 1: `7caf9edb` (2026-11-23)
**Commit Message**: appc,feature/conn25: build split DNS routes from the parsed config

On every self node change, conn25 parsed the app connector capability
twice: once in configFromNodeView, and again in appc.AppDNSRoutes to
build the split DNS routes. Build the routes from the config we already
have instead, and move DNSAddrScheme into feature/conn25 along with it.

With appc/conn25.go gone, conn25 no longer depends on appc, so
TestOmitAppConnectors no longer needs to omit conn25 too.

Fixes tailscale/corp#51400
Fixes tailscale/corp#51402

Signed-off-by: Michael Ben-Ami <[REDACTED_EMAIL]>

**File**: `appc/conn25.go` (removed, +0/-57)
```diff
@@ -1,57 +0,0 @@
-// Copyright (c) Tailscale Inc & contributors
-// SPDX-License-Identifier: BSD-3-Clause
-
-package appc
-
-import (
-	"fmt"
-	"strings"
-
-	"tailscale.com/tailcfg"
-	"tailscale.com/tailcfg/nodecap"
-	"tailscale.com/types/appctype"
-	"tailscale.com/types/dnstype"
-)
-
-const AppConnectorAttrName = "tailscale.com/app-connectors"
-
-// DNSAddrScheme is the custom URI scheme used for conn25-managed split DNS
-// entries to determine the destination at query time rather than configuration
-// time.
-const DNSAddrScheme = "tailscale-app"
-
-// AppDNSRoutes returns split DNS routes, keyed by domain suffix, for the app
-// domains configured in self's capability map. Each route resolves via the
-// [DNSAddrScheme] scheme naming the app, so the connector that serves it is
-// chosen at query time. It returns nil if the node lacks Connectors 2025 apps.
-func AppDNSRoutes(hasCap func(c nodecap.Cap) bool, self tailcfg.NodeView) map[string][]*dnstype.Resolver {
-	if !hasCap(AppConnectorAttrName) {
-		return nil
-	}
-
-	apps, err := tailcfg.UnmarshalNodeCapViewJSON[appctype.AppConnectorAttr](self.CapMap(), AppConnectorAttrName)
-	if err != nil {
-		return nil
-	}
-
-	appNamesByDomain := map[string]string{}
-	for _, app := range apps {
-		// conn25 apps are provided under [AppConnectorAttrName] with the Mode
-		// field set to [appctype.AppConnectorModeMagicIP].
-		if app.Mode != appctype.MagicIP {
-			continue
-		}
-		for _, domain := range app.Domains {
-			domain, _ = strings.CutPrefix(domain, "*.")
-			domain = strings.ToLower(domain)
-			// in the case of multiple apps specifying the same domain (which is misconfiguration
-			// that should be validated at point of input) last write wins.
-			appNamesByDomain[domain] = app.Name
-		}
-	}
-	m := make(map[string][]*dnstype.Resolver, len(appNamesByDomain))
-	for domain, appName := range appNamesByDomain {
-		m[domain] = []*dnstype.Resolver{{Addr: fmt.Sprintf("%s:%s", DNSAddrScheme, appName), UseWithExitNode: true}}
-	}
-	return m
-}
```

**File**: `appc/conn25_test.go` (removed, +0/-203)
```diff
@@ -1,203 +0,0 @@
-// Copyright (c) Tailscale Inc & contributors
-// SPDX-License-Identifier: BSD-3-Clause
-
-package appc
-
-import (
-	"encoding/json"
-	"fmt"
-	"testing"
-
-	"github.com/google/go-cmp/cmp"
-	"tailscale.com/tailcfg"
-	"tailscale.com/tailcfg/nodecap"
-	"tailscale.com/types/appctype"
-	"tailscale.com/types/dnstype"
-)
-
-func TestAppDNSRoutes(t *testing.T) {
-	getBytesForAttr := func(name string, domains []string, tags []string, mode appctype.Mode) []byte {
-		attr := appctype.AppConnectorAttr{
-			Name:       name,
-			Domains:    domains,
-			Connectors: tags,
-			Mode:       mode,
-		}
-		bs, err := json.Marshal(attr)
-		if err != nil {
-			t.Fatalf("test setup: %v", err)
-		}
-		return bs
-	}
-	appOneBytes := getBytesForAttr(
-		"app1",
-		[]string{"example.com"},
-		[]string{"tag:one"},
-		appctype.MagicIP,
-	)
-	appTwoBytes := getBytesForAttr(
-		"app2",
-		[]string{"a.example.com"},
-		[]string{"tag:two"},
-		appctype.MagicIP,
-	)
-	appThreeBytes := getBytesForAttr(
-		"app3",
-		[]string{"woo.b.example.com", "hoo.b.example.com"},
-		[]string{"tag:three1", "tag:three2"},
-		appctype.MagicIP,
-	)
-	appFourBytes := getBytesForAttr(
-		"app4",
-		[]string{"woo.b.example.com", "c.example.com"},
-		[]string{"tag:four1", "tag:four2"},
-		appctype.MagicIP,
-	)
-	appFiveBytes := getBytesForAttr(
-		"app5",
-		[]string{"*.example.com", "example.com"},
-		[]string{"tag:one"},
-		appctype.MagicIP,
-	)
-	appSixBytes := getBytesForAttr(
-		"app6",
-		[]string{"*.Example.com", "EXAMPLE.com", "EXAMPLE.COM"},
-		[]string{"tag:one"},
-		appctype.MagicIP,
-	)
-	subnetAppBytes := getBytesForAttr(
-		"subnet-app",
-		[]string{"subnet.example.com"},
-		[]string{"tag:one"},
-		appctype.Subnet,
-	)
-
-	resolver := func(appName string) []*dnstype.Resolver {
-		return []*dnstype.Resolver{{Addr: fmt.Sprintf("%s:%s", DNSAddrScheme, appName), UseWithExitNode: true}}
-	}
-
-	for _, tt := range []struct {
-		name   string
-		hasCap bool
-		config []tailcfg.RawMessage
-		want   map[string][]*dnstype.Resolver
-	}{
-		{
-			name:   "no-capability", // hasCap false should return nil regardless of config.
-			hasCap: false,
-		},
-		{
-			name:   "no-apps", // hasCap true but no configured apps returns an empty map.
-			hasCap: true,
-			want:   map[string][]*dnstype.Resolver{},
-		},
-		{
-			name:   "bad-config", // bad config should return nil rather than error.
-			hasCap: true,
-			config: []tailcfg.RawMessage{tailcfg.RawMessage(`hey`)},
-		},
-		{
-			name:   "single-app",
-			hasCap: true,
-			config: []tailcfg.RawMessage{tailcfg.RawMessage(appOneBytes)},
-			want: map[string][]*dnstype.Resolver{
-				"example.com": resolver("app1"),
-			},
-		},
-		{
-			name:   "single-app-multi-domain",
-			hasCap: true,
-			config: []tailcfg.RawMessage{tailcfg.RawMessage(appThreeBytes)},
-			want: map[string][]*dnstype.Resolver{
-				"woo.b.example.com": resolver("app3"),
-				"hoo.b.example.com": resolver("app3"),
-			},
-		},
-		{
-			name:   "multi-app-no-overlap",
-			hasCap: true,
-			config: []tailcfg.RawMessage{
-				tailcfg.RawMessage(appOneBytes),
-				tailcfg.RawMessage(appTwoBytes),
-			},
-			want: map[string][]*dnstype.Resolver{
-				"example.com":   resolver("app1"),
-				"a.example.com": resolver("app2"),
-			},
-		},
-		{
-			name:   "domain-collision-last-write-wins",
-			hasCap: true,
-			config: []tailcfg.RawMessage{
-				tailcfg.RawMessage(appThreeBytes), // app3: woo.b.example.com, hoo.b.example.com
-				tailcfg.RawMessage(appFourBytes),  // app4: woo.b.example.com, c.example.com
-			},
-			want: map[string][]*dnstype.Resolver{
-				// app4 overwrites app3 for the shared domain
-				"woo.b.example.com": resolver("app4"),
-				"hoo.b.example.com": resolver("app3"),
-				"c.example.com":     resolver("app4"),
-			},
-		},
-		{
-			name:   "wildcards-are-stripped-and-deduped",
-			hasCap: true,
-			config: []tailcfg.RawMessage{tailcfg.RawMessage(appFiveBytes)},
-			want: map[string][]*dnstype.Resolver{
-				// *.example.com and example.com should both normalize to example.com.
-				"example.com": resolver("app5"),
-			},
-		},
-		{
-			name:   "domains-are-normalized-and-deduped",
-			hasCap: true,
-			config: []tailcfg.RawMessage{tailcfg.RawMessage(appSixBytes)},
-			want: map[string][]*dnstype.Resolver{
-				// *.Example.com, EXAMPLE.com, EXAMPLE.COM should all normalize to example.com.
-				"example.com": resolver("app6"),
-			},
-		},
-		{
-			name:   "sub-domains-and-top-domains-do-not-collide",
-			hasCap: true,
-			config: []tailcfg.RawMessage{
-				tailcfg.RawMessage(appTwoBytes),
-				tailcfg.RawMessage(appFiveBytes),
-			},
-			want: map[string][]*dnstype.Resolver{
-				// *.example.com normalizes to example.com; a.example.com remains distinct.
-				"a.example.com": resolver("app2"),
-				"example.com":   resolver("app5"),
-			},
-		},
-		{
-			name:   "only-conn25-processed",
-			hasCap: true,
-			config: []tailcfg.RawMessage{
-				tailcfg.RawMessage(appOneBytes),
-				tailcfg.RawMessage(subnetAp
```

**File**: `cmd/tailscaled/depaware.txt` (modified, +1/-1)
```diff
@@ -257,7 +257,7 @@ tailscale.com/cmd/tailscaled dependencies: (generated by github.com/tailscale/de
         gvisor.dev/gvisor/pkg/tcpip/transport/udp                    from gvisor.dev/gvisor/pkg/tcpip/adapters/gonet+
         gvisor.dev/gvisor/pkg/waiter                                 from gvisor.dev/gvisor/pkg/context+
         tailscale.com                                                from tailscale.com/version
-        tailscale.com/appc                                           from tailscale.com/ipn/ipnlocal+
+        tailscale.com/appc                                           from tailscale.com/ipn/ipnlocal
      💣 tailscale.com/atomicfile                                     from tailscale.com/ipn+
   LD    tailscale.com/chirp                                          from tailscale.com/feature/bird
         tailscale.com/client/local                                   from tailscale.com/client/web+
```

**File**: `cmd/tailscaled/deps_test.go` (modified, +1/-3)
```diff
@@ -86,9 +86,7 @@ func TestOmitAppConnectors(t *testing.T) {
 	deptest.DepChecker{
 		GOOS:   "linux",
 		GOARCH: "amd64",
-		// conn25 also uses appc, so omit it too to check that nothing
-		// else pulls appc in.
-		Tags: "ts_omit_appconnectors,ts_omit_conn25,ts_include_cli",
+		Tags:   "ts_omit_appconnectors,ts_include_cli",
 		BadDeps: map[string]string{
 			"tailscale.com/appc":                  msg,
 			"tailscale.com/feature/appconnectors": msg,
```

**File**: `feature/conn25/conn25.go` (modified, +37/-6)
```diff
@@ -26,7 +26,6 @@ import (
 
 	"go4.org/netipx"
 	"golang.org/x/net/dns/dnsmessage"
-	"tailscale.com/appc"
 	"tailscale.com/feature"
 	"tailscale.com/ipn"
 	"tailscale.com/ipn/ipnext"
@@ -169,9 +168,9 @@ func (e *extension) installHooks(dph *datapathHandler) error {
 		return errors.New("dns manager resolver not ready")
 	}
 
-	if err := r.RegisterCustomScheme(appc.DNSAddrScheme, func(addr string) (string, error) {
+	if err := r.RegisterCustomScheme(DNSAddrScheme, func(addr string) (string, error) {
 		scheme, appName, ok := strings.Cut(addr, ":")
-		if !ok || scheme != appc.DNSAddrScheme {
+		if !ok || scheme != DNSAddrScheme {
 			return "", fmt.Errorf("unexpected conn25 scheme %q", scheme)
 		}
 
@@ -266,7 +265,7 @@ func (e *extension) installHooks(dph *datapathHandler) error {
 	})
 
 	// Route DNS queries for app domains to the connector that serves
-	// them, chosen at query time via the [appc.DNSAddrScheme] scheme.
+	// them, chosen at query time via the [DNSAddrScheme] scheme.
 	e.host.Hooks().ExtraDNSRoutes.Set(func() map[string][]*dnstype.Resolver {
 		if !e.conn25.isConfigured() {
 			return nil
@@ -468,7 +467,7 @@ func (e *extension) onSelfChange(selfNode tailcfg.NodeView) {
 	}
 	// Store the routes only once the config parsed, so a bad self node
 	// leaves the previous routes and config in place together.
-	e.conn25.appDNSRoutes.Store(appc.AppDNSRoutes(selfNode.HasCap, selfNode))
+	e.conn25.appDNSRoutes.Store(cfg.appDNSRoutes())
 	e.conn25.reconfig(cfg)
 }
 
@@ -508,7 +507,7 @@ type Conn25 struct {
 	prefsAdvertiseConnector atomic.Bool
 
 	// appDNSRoutes holds the split DNS routes for the app domains in the
-	// self node's capabilities, as returned by [appc.AppDNSRoutes]. It is
+	// self node's capabilities, as returned by [config.appDNSRoutes]. It is
 	// recomputed on each self node change and served to
 	// [ipnext.Hooks.ExtraDNSRoutes]. The map must not be mutated once stored.
 	appDNSRoutes syncs.AtomicValue[map[string][]*dnstype.Resolver]
@@ -748,6 +747,11 @@ type ConnectorTransitIPResponse struct {
 const (
 	AppConnectorAttrName                     = "tailscale.com/app-connectors"
 	AppConnectorsExperimentalIPPoolsAttrName = "tailscale.com/app-connectors-experimental-ippools"
+
+	// DNSAddrScheme is the custom URI scheme used for conn25-managed split DNS
+	// entries to determine the destination at query time rather than configuration
+	// time.
+	DNSAddrScheme = "tailscale-app"
 )
 
 // ipSets wraps all the IPSets the config needs.
@@ -893,6 +897,33 @@ func (cfg *config) getAppsForConnectorDomain(domain dnsname.FQDN, prefsAdvertise
 	return appNames
 }
 
+// appDNSRoutes returns split DNS routes, keyed by domain suffix, for the app
+// domains in cfg. Each route resolves via the [DNSAddrScheme] scheme naming
+// the app, so the connector that serves it is chosen at query time. It
+// returns nil if cfg is not configured.
+func (cfg *config) appDNSRoutes() map[string][]*dnstype.Resolver {
+	if !cfg.isConfigured {
+		return nil
+	}
+	m := make(map[string][]*dnstype.Resolver, len(cfg.appNamesByDomain)+len(cfg.appNamesByWCDomain))
+	add := func(byDomain map[dnsname.FQDN][]string) {
+		for domain, appNames := range byDomain {
+			if len(appNames) == 0 {
+				continue
+			}
+			// In the case of multiple apps specifying the same domain (which is misconfiguration
+			// that should be validated at point of input), the last one in the config list wins.
+			appName := appNames[len(appNames)-1]
+			m[domain.WithoutTrailingDot()] = []*dnstype.Resolver{{Addr: fmt.Sprintf("%s:%s", DNSAddrScheme, appName), UseWithExitNode: true}}
+		}
+	}
+	// If an exact and a wildcard domain coincide, the exact domain's app
+	// takes the route, so add it last.
+	add(cfg.appNamesByWCDomain)
+	add(cfg.appNamesByDomain)
+	return m
+}
+
 func (e *extension) sendLoop(ctx context.Context) {
 	for {
 		select {
```

**File**: `feature/conn25/conn25_test.go` (modified, +136/-0)
```diff
@@ -4138,6 +4138,142 @@ func TestHandleHookReplyToDNSQueries(t *testing.T) {
 // for the app domains in the self node's capabilities, and supplies none
 // before the self node is known, when this node is itself a connector, or
 // after a switch to a different node.
+func TestAppDNSRoutes(t *testing.T) {
+	app := func(name string, mode appctype.Mode, domains ...string) appctype.AppConnectorAttr {
+		return appctype.AppConnectorAttr{
+			Name:       name,
+			Domains:    domains,
+			Connectors: []string{"tag:" + name},
+			Mode:       mode,
+		}
+	}
+	resolver := func(appName string) []*dnstype.Resolver {
+		return []*dnstype.Resolver{{Addr: fmt.Sprintf("%s:%s", DNSAddrScheme, appName), UseWithExitNode: true}}
+	}
+
+	for _, tt := range []struct {
+		name string
+		apps []appctype.AppConnectorAttr
+		want map[string][]*dnstype.Resolver
+	}{
+		{
+			name: "no-apps", // an unconfigured config has no routes.
+		},
+		{
+			name: "only-subnet-apps", // no conn25 apps means unconfigured.
+			apps: []appctype.AppConnectorAttr{app("subnet-app", appctype.Subnet, "subnet.example.com")},
+		},
+		{
+			name: "single-app",
+			apps: []appctype.AppConnectorAttr{app("app1", appctype.MagicIP, "example.com")},
+			want: map[string][]*dnstype.Resolver{
+				"example.com": resolver("app1"),
+			},
+		},
+		{
+			name: "single-app-multi-domain",
+			apps: []appctype.AppConnectorAttr{app("app3", appctype.MagicIP, "woo.b.example.com", "hoo.b.example.com")},
+			want: map[string][]*dnstype.Resolver{
+				"woo.b.example.com": resolver("app3"),
+				"hoo.b.example.com": resolver("app3"),
+			},
+		},
+		{
+			name: "multi-app-no-overlap",
+			apps: []appctype.AppConnectorAttr{
+				app("app1", appctype.MagicIP, "example.com"),
+				app("app2", appctype.MagicIP, "a.example.com"),
+			},
+			want: map[string][]*dnstype.Resolver{
+				"example.com":   resolver("app1"),
+				"a.example.com": resolver("app2"),
+			},
+		},
+		{
+			name: "domain-collision-last-wins",
+			apps: []appctype.AppConnectorAttr{
+				app("app3", appctype.MagicIP, "woo.b.example.com", "hoo.b.example.com"),
+				app("app4", appctype.MagicIP, "woo.b.example.com", "c.example.com"),
+			},
+			want: map[string][]*dnstype.Resolver{
+				// app4 is listed last, so takes the shared domain.
+				"woo.b.example.com": resolver("app4"),
+				"hoo.b.example.com": resolver("app3"),
+				"c.example.com":     resolver("app4"),
+			},
+		},
+		{
+			name: "wildcard-collision-last-wins",
+			apps: []appctype.AppConnectorAttr{
+				app("app1", appctype.MagicIP, "*.example.com"),
+				app("app2", appctype.MagicIP, "*.example.com"),
+			},
+			want: map[string][]*dnstype.Resolver{
+				"example.com": resolver("app2"),
+			},
+		},
+		{
+			name: "exact-beats-wildcard",
+			apps: []appctype.AppConnectorAttr{
+				app("app1", appctype.MagicIP, "example.com"),
+				app("app2", appctype.MagicIP, "*.example.com"),
+			},
+			want: map[string][]*dnstype.Resolver{
+				// The exact app wins even though the wildcard app is listed last.
+				"example.com": resolver("app1"),
+			},
+		},
+		{
+			name: "wildcards-are-stripped-and-deduped",
+			apps: []appctype.AppConnectorAttr{app("app5", appctype.MagicIP, "*.example.com", "example.com")},
+			want: map[string][]*dnstype.Resolver{
+				// *.example.com and example.com should both normalize to example.com.
+				"example.com": resolver("app5"),
+			},
+		},
+		{
+			name: "domains-are-normalized-and-deduped",
+			apps: []appctype.AppConnectorAttr{app("app6", appctype.MagicIP, "*.Example.com", "EXAMPLE.com", "EXAMPLE.COM", "example.com.")},
+			want: map[string][]*dnstype.Resolver{
+				// All variants should normalize to example.com.
+				"example.com": resolver("app6"),
+			},
+		},
+		{
+			name: "sub-domains-and-top-domains-do-not-collide",
+			apps: []appctype.AppConnectorAttr{
+				app("app2", appctype.MagicIP, "a.example.com"),
+				app("app5", appctype.MagicIP, "*.example.com", "example.com"),
+			},
+			want: map[string][]*dnstype.Resolver{
+				// *.example.com normalizes to example.com; a.example.com remains distinct.
+				"a.example.com": resolver("app2"),
+				"example.com":   resolver("app5"),
+			},
+		},
+		{
+			name: "only-conn25-processed",
+			apps: []appctype.AppConnectorAttr{
+				app("app1", appctype.MagicIP, "example.com"),
+				app("subnet-app", appctype.Subnet, "subnet.example.com"),
+			},
+			want: map[string][]*dnstype.Resolver{
+				// The app that's a subnet router should not show up here,
+				// since we only deal with conn25 apps.
+				"example.com": resolver("app1"),
+			},
+		},
+	} {
+		t.Run(tt.name, func(t *testing.T) {
+			cfg := mustConfig(t, makeSelfNode(t, tt.apps, appctype.Conn25PoolsAttr{}, nil))
+			got := cfg.appDNSRoutes()
+			if diff := cmp.Diff(tt.want, got); diff != "" {
+				t.Fatalf("appDNSRoutes (-want, +got):\n%s", diff)
+			}
+		})
+	}
+}
+
 func TestExtraDNSRoutesHook(t *testing.T) {
 	ext := &extension{
 		conn25:  newConn25(logger.Discard),
```

#### Recent Merged Pull Requests:
- **PR #22612** (2026-11-23): VERSION.txt: this is v1.107.0 (@nickoneill)
- **PR #22611** (2026-11-23): net/dns: retry failed hosts file updates in the background on Windows (@nickkhyl)
- **PR #22610** (2026-11-23): derp/derpserver: add rate limiting exemption by IP (@mikeodr)
- **PR #22607** (2026-11-23): feature/conn25: enforce token verification (@franbull)
- **PR #22604** (2026-11-23): appc,feature/conn25: build split DNS routes from the parsed config (@mzbenami)
- **PR #22594** (closed): mikeodr/rpf 7 natlab tests (@mikeodr)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
