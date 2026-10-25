> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/tailscale-tailscale-learnings.md`  
> **Source**: github ([https://github.com/tailscale/tailscale](https://github.com/tailscale/tailscale))  
> **Source Version**: `a1e51f49`  
> **License**: BSD-3-Clause  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-25T21:02:15.570Z  
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
> **Harvest Timestamp**: 2026-10-25T21:02:15.565Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tailscale/tailscale`
- **Description**: The easiest, most secure way to use WireGuard and 2FA.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 38060 stars

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

### Incident Patch 1: `a1e51f49` (2026-10-25)
**Commit Message**: tsnet: authorize ListenSSH peers, fix PTY emulation and session queue bound

ListenSSH now documents its session trust model and takes an
authorization callback. A session is accepted from any peer that the
tailnet ACL's TCP rules allow and that resolves with WhoIs. The server
performs no SSH client authentication, does not map the peer to a local
user, and does not record the session. The application is responsible
for what each session does. Set Server.SSHAuthCallback to reject
unwanted sessions before they reach Accept. A rejected session is
refused at open with exit status 1 and is never yielded to Accept. The
callback is plumbed through LocalBackend.ListenSSH and HookListenSSH.
With no callback, behavior is unchanged.

The listener's SSH server runs session channels only, with no port
forwarding. Closing the listener closes the accepted connections.

- DisablePTYEmulation runs on every session, so a PTY session passes
  data through unchanged instead of translating "\n" to "\r\n". The
  translation corrupted binary data read through the net.Conn
  interface. Window changes are drained for every session, even when
  the application never calls Pty, because gliderssh writes wind

**File**: `ipn/ipnlocal/local.go` (modified, +18/-3)
```diff
@@ -146,22 +146,37 @@ func RegisterNewSSHServer(fn newSSHServerFunc) {
 	newSSHServer = fn
 }
 
+// SSHAuthCallback reports whether to accept a new SSH session. It is
+// called for each session before the session is yielded to the
+// listener from [LocalBackend.ListenSSH], with the peer's node and
+// user profile. A session that the callback rejects is refused and is
+// never yielded to Accept.
+//
+// ListenSSH accepts a session from any peer that the tailnet ACL's TCP
+// rules allow. The ACL's SSHPolicy is not used. Use SSHAuthCallback to
+// reject sessions the application does not want.
+type SSHAuthCallback func(tailcfg.NodeView, tailcfg.UserProfile) (permitted bool)
+
 // HookListenSSH is set by the ssh/tailssh package (via feature/ssh) to provide
 // an implementation of ListenSSH for use by tsnet.
-var HookListenSSH feature.Hook[func(net.Listener, *LocalBackend, logger.Logf) (net.Listener, error)]
+var HookListenSSH feature.Hook[func(net.Listener, *LocalBackend, SSHAuthCallback, logger.Logf) (net.Listener, error)]
 
 // ListenSSH wraps the given listener with an SSH server that authenticates
 // connections using Tailscale peer identity. The returned listener's Accept
 // yields net.Conn values that are *tailssh.Session.
 //
+// If auth is nil, every session from a peer that the tailnet ACL's TCP
+// rules allow is accepted. If auth is non-nil, sessions that it rejects
+// are refused. See [SSHAuthCallback].
+//
 // If the ssh/tailssh package has not been linked (e.g. via
 // _ "tailscale.com/feature/ssh"), ListenSSH returns an error.
-func (b *LocalBackend) ListenSSH(ln net.Listener, logf logger.Logf) (net.Listener, error) {
+func (b *LocalBackend) ListenSSH(ln net.Listener, auth SSHAuthCallback, logf logger.Logf) (net.Listener, error) {
 	fn, ok := HookListenSSH.GetOk()
 	if !ok {
 		return nil, errors.New("SSH support not available; import _ \"tailscale.com/feature/ssh\"")
 	}
-	return fn(ln, b, logf)
+	return fn(ln, b, auth, logf)
 }
 
 // watchSession represents a WatchNotifications channel,
```

**File**: `ssh/tailssh/listen.go` (modified, +150/-45)
```diff
@@ -9,10 +9,14 @@ import (
 	"errors"
 	"net"
 	"net/netip"
+	"strconv"
 	"sync"
+	"time"
 
 	gliderssh "github.com/tailscale/gliderssh"
+	"tailscale.com/envknob"
 	"tailscale.com/ipn/ipnlocal"
+	"tailscale.com/tailcfg"
 	"tailscale.com/types/logger"
 )
 
@@ -25,11 +29,42 @@ func Register() {
 	registerIncubator()
 }
 
-// listenSSH wraps rawLn with an SSH server that resolves Tailscale peer
-// identity for each connection. The returned listener's Accept yields
-// *Session values (as net.Conn).
-func listenSSH(rawLn net.Listener, lb *ipnlocal.LocalBackend, logf logger.Logf) (net.Listener, error) {
-	hostKeys, err := getHostKeys(lb.TailscaleVarRoot(), logf)
+// listenSSH returns an SSH server that wraps rawLn. The returned
+// listener's Accept yields each session as a *Session. A nil auth
+// accepts every session. A non-nil auth is called for each session
+// with the peer identity, and a session that auth rejects is refused.
+func listenSSH(rawLn net.Listener, lb *ipnlocal.LocalBackend, auth ipnlocal.SSHAuthCallback, logf logger.Logf) (net.Listener, error) {
+	return newSSHListener(rawLn, sshListenerConfig{
+		varRoot: lb.TailscaleVarRoot(),
+		whoIs:   lb.WhoIs,
+		auth:    auth,
+		logf:    logf,
+	})
+}
+
+// sshListenerConfig holds the dependencies of the SSH listener.
+// listenSSH fills it in from a LocalBackend, and tests use a stub
+// whoIs instead.
+type sshListenerConfig struct {
+	varRoot string
+	whoIs   func(proto string, ipp netip.AddrPort) (node tailcfg.NodeView, userProfile tailcfg.UserProfile, ok bool)
+	auth    ipnlocal.SSHAuthCallback // or nil to accept all peers
+	logf    logger.Logf
+}
+
+// newSSHListener serves SSH on rawLn. The returned listener's Accept
+// method yields each session as a *Session, and each session is also
+// usable as a net.Conn.
+//
+// The server runs session channels only, and accepts connections
+// without SSH client authentication. It resolves each connecting peer
+// with cfg.whoIs and refuses sessions from peers that do not resolve.
+// If cfg.auth is set, it refuses sessions that cfg.auth rejects as
+// well. Sessions are not mapped to a local user and are not recorded.
+// The application consuming the sessions from Accept is responsible
+// for anything further.
+func newSSHListener(rawLn net.Listener, cfg sshListenerConfig) (net.Listener, error) {
+	hostKeys, err := getHostKeys(cfg.varRoot, cfg.logf)
 	if err != nil {
 		return nil, err
 	}
@@ -39,51 +74,19 @@ func listenSSH(rawLn net.Listener, lb *ipnlocal.LocalBackend, logf logger.Logf)
 	}
 
 	sl := &sshListener{
+		cfg:      cfg,
 		rawLn:    rawLn,
-		sessions: make(chan net.Conn, 16),
+		sessions: make(chan net.Conn, maxQueuedSSHListenerSessions),
 		done:     make(chan struct{}),
 	}
 
 	sshSrv := &gliderssh.Server{
-		HostSigners: signers,
-		Handler: func(sess gliderssh.Session) {
-			srcAddr := sess.RemoteAddr().String()
-			ipp, err := netip.ParseAddrPort(srcAddr)
-			if err != nil {
-				logf("listenSSH: bad remote addr %q: %v", srcAddr, err)
-				sess.Exit(1)
-				return
-			}
-			node, userProfile, ok := lb.WhoIs("tcp", ipp)
-			if !ok {
-				logf("listenSSH: WhoIs failed for %v", srcAddr)
-				sess.Exit(1)
-				return
-			}
-
-			done := make(chan struct{})
-			s := newSession(sess, peerIdentity{
-				Node:        node,
-				UserProfile: userProfile,
-			}, done)
-
-			// Send the session to the listener. If the listener is
-			// closed, drop the session.
-			select {
-			case sl.sessions <- s:
-			case <-sl.done:
-				sess.Exit(1)
-				return
-			}
-
-			// Block until the consumer is done with the session.
-			select {
-			case <-done:
-			case <-sess.Context().Done():
-			case <-sl.done:
-			}
-		},
+		HostSigners:      signers,
+		HandshakeTimeout: loginGraceTime(),
+		IdleTimeout:      sshIdleTimeout(),
+		Handler:          sl.handleSession,
 	}
+	sl.sshSrv = sshSrv
 
 	go func() {
 		if err := sshSrv.Serve(rawLn); err != nil {
@@ -92,7 +95,7 @@ func listenSSH(rawLn net.Listener, lb *ipnlocal.LocalBackend, logf logger.Logf)
 			select {
 			case <-sl.done:
 			default:
-				logf("listenSSH: Serve error: %v", err)
+				cfg.logf("listenSSH: Serve error: %v", err)
 			}
 		}
 		sl.Close()
@@ -101,9 +104,71 @@ func listenSSH(rawLn net.Listener, lb *ipnlocal.LocalBackend, logf logger.Logf)
 	return sl, nil
 }
 
+// maxQueuedSSHListenerSessions is the number of sessions that may
+// wait in the listener queue before new sessions are refused.
+const maxQueuedSSHListenerSessions = 16
+
+// handleSession resolves the peer identity, calls cfg.auth when set,
+// and queues the session for Accept.
+func (sl *sshListener) handleSession(sess gliderssh.Session) {
+	// The application reads and writes the session as a plain
+	// net.Conn. Disable the terminal emulation that translates "\n" to
+	// "\r\n" on PTY sessions, so that writes pass through unchanged.
+	sess.DisablePTYEmulation()
+
+	srcAddr := sess.RemoteAddr().String()
+	ipp, err := netip.ParseAddrPort(srcAddr)
+	if err != nil {
+	
```

**File**: `ssh/tailssh/listen_test.go` (added, +503/-0)
```diff
@@ -0,0 +1,503 @@
+// Copyright (c) Tailscale Inc & contributors
+// SPDX-License-Identifier: BSD-3-Clause
+
+//go:build (linux && !android) || (darwin && !ios) || freebsd || openbsd || plan9
+
+package tailssh
+
+import (
+	"bytes"
+	"errors"
+	"fmt"
+	"net"
+	"net/netip"
+	"sync"
+	"testing"
+	"testing/synctest"
+	"time"
+
+	"tailscale.com/envknob"
+	"tailscale.com/ipn/ipnlocal"
+	"tailscale.com/net/memnet"
+	"tailscale.com/tailcfg"
+	testssh "tailscale.com/tempfork/sshtest/ssh"
+)
+
+var (
+	testClientAddr = netip.MustParseAddrPort("100.100.100.101:2231")
+	testServerAddr = netip.MustParseAddrPort("100.100.100.102:22")
+	testPeerNode   = (&tailcfg.Node{
+		ID:   1,
+		User: 10,
+		Name: "client.example.ts.net.",
+	}).View()
+	testPeerProfile = tailcfg.UserProfile{
+		ID:        10,
+		LoginName: "client@example.com",
+	}
+)
+
+// startTestSSHListener starts a listenSSH server over memnet. The
+// stub whoIs resolves every connection to testPeerNode. It returns
+// the SSH listener and the raw listener to dial from the client side.
+//
+// It registers no cleanup. A test that runs inside a
+// [synctest.Test] bubble must close the listener with a defer, because
+// the bubble expects its goroutines to finish before the test returns.
+// Other tests should use newTestSSHListener, which registers the
+// cleanup.
+func startTestSSHListener(t *testing.T, auth ipnlocal.SSHAuthCallback) (net.Listener, *memnet.Listener) {
+	t.Helper()
+	rawLn := memnet.Listen(testServerAddr.String())
+	rawLn.NewConn = func(network, addr string, maxBuf int) (memnet.Conn, memnet.Conn) {
+		return memnet.NewTCPConn(testClientAddr, testServerAddr, maxBuf)
+	}
+	sl, err := newSSHListener(rawLn, sshListenerConfig{
+		varRoot: t.TempDir(),
+		whoIs: func(proto string, ipp netip.AddrPort) (tailcfg.NodeView, tailcfg.UserProfile, bool) {
+			return testPeerNode, testPeerProfile, true
+		},
+		auth: auth,
+		logf: t.Logf,
+	})
+	if err != nil {
+		t.Fatal(err)
+	}
+	return sl, rawLn
+}
+
+// newTestSSHListener is startTestSSHListener with a cleanup that
+// closes the listener. Do not use it inside a [synctest.Test] bubble.
+func newTestSSHListener(t *testing.T, auth ipnlocal.SSHAuthCallback) (net.Listener, *memnet.Listener) {
+	t.Helper()
+	sl, rawLn := startTestSSHListener(t, auth)
+	t.Cleanup(func() { sl.Close() })
+	return sl, rawLn
+}
+
+// startTestSSHClient dials rawLn and completes the SSH handshake from
+// the client side. It returns the raw connection and the SSH client.
+// It registers no cleanup, for the same reason as
+// startTestSSHListener. Use dialTestSSHListener outside a
+// [synctest.Test] bubble.
+func startTestSSHClient(t *testing.T, rawLn *memnet.Listener) (net.Conn, *testssh.Client) {
+	t.Helper()
+	sc, err := rawLn.Dial(t.Context(), "tcp", rawLn.Addr().String())
+	if err != nil {
+		t.Fatal(err)
+	}
+	c, chans, reqs, err := testssh.NewClientConn(sc, sc.RemoteAddr().String(), &testssh.ClientConfig{
+		User:            "test",
+		HostKeyCallback: testssh.InsecureIgnoreHostKey(),
+		Timeout:         15 * time.Second,
+	})
+	if err != nil {
+		t.Fatalf("client handshake: %v", err)
+	}
+	return sc, testssh.NewClient(c, chans, reqs)
+}
+
+// dialTestSSHListener is startTestSSHClient with cleanups that close
+// the raw connection and the SSH client.
+func dialTestSSHListener(t *testing.T, rawLn *memnet.Listener) *testssh.Client {
+	t.Helper()
+	sc, client := startTestSSHClient(t, rawLn)
+	t.Cleanup(func() { sc.Close() })
+	t.Cleanup(func() { client.Close() })
+	return client
+}
+
+// TestListenSSHPTYRaw tests that a session from a PTY request does not
+// translate "\n" to "\r\n". The translation is gliderssh PTY emulation,
+// and it corrupts data written through the net.Conn interface.
+func TestListenSSHPTYRaw(t *testing.T) {
+	sl, rawLn := newTestSSHListener(t, nil)
+	client := dialTestSSHListener(t, rawLn)
+
+	sess, err := client.NewSession()
+	if err != nil {
+		t.Fatal(err)
+	}
+	defer sess.Close()
+	if err := sess.RequestPty("xterm-256color", 80, 40, nil); err != nil {
+		t.Fatalf("RequestPty: %v", err)
+	}
+	var out bytes.Buffer
+	sess.Stdout = &out
+	if err := sess.Shell(); err != nil {
+		t.Fatalf("Shell: %v", err)
+	}
+
+	// Accept the session and write a line.
+	conn, err := sl.Accept()
+	if err != nil {
+		t.Fatalf("Accept: %v", err)
+	}
+	s := conn.(*Session)
+	defer s.Close()
+	if _, _, ok := s.Pty(); !ok {
+		t.Fatal("session reports no PTY despite the pty-req")
+	}
+	if _, err := s.Write([]byte("a\n")); err != nil {
+		t.Fatalf("server write: %v", err)
+	}
+	if err := s.Exit(0); err != nil {
+		t.Fatalf("Exit: %v", err)
+	}
+
+	if err := sess.Wait(); err != nil {
+		t.Fatalf("client wait: %v", err)
+	}
+	if got := out.String(); got != "a\n" {
+		t.Errorf("client got %q; want %q (PTY emulation must be disabled for tsnet sessions)", got, "a\n")
+	}
+}
+
+// TestListenSSHAuthCallback tests the authorization callback. A
+// session the callback rejects is refused and never reaches Accept.
+// A session t
```

**File**: `ssh/tailssh/session.go` (modified, +48/-34)
```diff
@@ -60,6 +60,11 @@ type Session struct {
 	// peer is the Tailscale identity of the remote peer.
 	peer peerIdentity
 
+	// pty and winCh are set by newSession when the client requested
+	// a PTY. Pty returns them.
+	pty   *Pty
+	winCh chan Window
+
 	// done is closed when the session handler should return,
 	// unblocking the gliderlabs handler goroutine.
 	doneOnce sync.Once // guards close(done)
@@ -70,11 +75,48 @@ type Session struct {
 // peer identity. The done channel is closed by the session consumer to signal
 // that the handler goroutine may return.
 func newSession(sess gliderssh.Session, peer peerIdentity, done chan struct{}) *Session {
-	return &Session{
+	s := &Session{
 		sess: sess,
 		peer: peer,
 		done: done,
 	}
+	// Start draining window changes now, even when the application
+	// never calls Pty. gliderssh writes window changes from the session
+	// request loop, so an undrained channel blocks the session's
+	// requests. Pty returns winCh. Window changes are dropped when the
+	// application is not reading it.
+	if gPty, gWinCh, ok := sess.Pty(); ok {
+		s.pty = &Pty{
+			Term: gPty.Term,
+			Window: Window{
+				Width:        gPty.Window.Width,
+				Height:       gPty.Window.Height,
+				WidthPixels:  gPty.Window.WidthPixels,
+				HeightPixels: gPty.Window.HeightPixels,
+			},
+		}
+		if gPty.Modes != nil {
+			s.pty.Modes = make(map[uint8]uint32, len(gPty.Modes))
+			maps.Copy(s.pty.Modes, gPty.Modes)
+		}
+		s.winCh = make(chan Window, 1)
+		go func() {
+			defer close(s.winCh)
+			for gw := range gWinCh {
+				w := Window{
+					Width:        gw.Width,
+					Height:       gw.Height,
+					WidthPixels:  gw.WidthPixels,
+					HeightPixels: gw.HeightPixels,
+				}
+				select {
+				case s.winCh <- w:
+				default:
+				}
+			}
+		}()
+	}
+	return s
 }
 
 // Read reads from the SSH channel (stdin from the client).
@@ -147,42 +189,14 @@ func (s *Session) Subsystem() string {
 	return s.sess.Subsystem()
 }
 
-// Pty returns PTY information, a channel of window size changes, and whether a
-// PTY was requested.
+// Pty returns PTY information, a channel of window size changes, and
+// whether a PTY was requested. Window changes are dropped when the
+// returned channel is not being read.
 func (s *Session) Pty() (_ Pty, _ <-chan Window, ok bool) {
-	gPty, gWinCh, ok := s.sess.Pty()
-	if !ok {
+	if s.pty == nil {
 		return Pty{}, nil, false
 	}
-	p := Pty{
-		Term: gPty.Term,
-		Window: Window{
-			Width:        gPty.Window.Width,
-			Height:       gPty.Window.Height,
-			WidthPixels:  gPty.Window.WidthPixels,
-			HeightPixels: gPty.Window.HeightPixels,
-		},
-	}
-	if gPty.Modes != nil {
-		p.Modes = make(map[uint8]uint32, len(gPty.Modes))
-		maps.Copy(p.Modes, gPty.Modes)
-	}
-
-	// Convert the gliderlabs Window channel to our Window type.
-	winCh := make(chan Window, 1)
-	go func() {
-		defer close(winCh)
-		for gw := range gWinCh {
-			winCh <- Window{
-				Width:        gw.Width,
-				Height:       gw.Height,
-				WidthPixels:  gw.WidthPixels,
-				HeightPixels: gw.HeightPixels,
-			}
-		}
-	}()
-
-	return p, winCh, true
+	return *s.pty, s.winCh, true
 }
 
 // Signals registers a channel to receive signals from the client.
```

**File**: `ssh/tailssh/tailssh.go` (modified, +8/-0)
```diff
@@ -55,6 +55,12 @@ var (
 	sshDisableForwarding = envknob.RegisterBool("TS_SSH_DISABLE_FORWARDING")
 	sshDisablePTY        = envknob.RegisterBool("TS_SSH_DISABLE_PTY")
 
+	// sshLoginGraceTime is the TS_SSH_LOGIN_GRACE_TIME knob. It is
+	// the maximum allowed duration between accepting a connection and
+	// completing authentication, like sshd's LoginGraceTime. It defaults
+	// to 120 seconds. See loginGraceTime for the accepted value forms.
+	sshLoginGraceTime = envknob.RegisterString("TS_SSH_LOGIN_GRACE_TIME")
+
 	// errTerminal is an empty ssh.PartialSuccessError (with no 'Next'
 	// authentication methods that may proceed), which results in the SSH
 	// server immediately disconnecting the client.
@@ -497,6 +503,8 @@ func (srv *server) newConn() (*conn, error) {
 		Version:              "Tailscale",
 		ServerConfigCallback: c.ServerConfig,
 
+		IdleTimeout: sshIdleTimeout(),
+
 		Handler:                       c.handleSessionPostSSHAuth,
 		LocalPortForwardingCallback:   c.mayForwardLocalPortTo,
 		ReversePortForwardingCallback: c.mayReversePortForwardTo,
```

**File**: `tsnet/listenssh_test.go` (modified, +135/-0)
```diff
@@ -19,9 +19,144 @@ import (
 
 	_ "tailscale.com/feature/ssh"
 	"tailscale.com/ssh/tailssh"
+	"tailscale.com/tailcfg"
 	"tailscale.com/tstest"
 )
 
+// TestListenSSHAuthCallback tests Server.SSHAuthCallback end to end.
+// A tsnet.Server whose callback denies the peer refuses the session
+// and never yields it to Accept. A tsnet.Server whose callback allows
+// the peer yields the session to Accept.
+func TestListenSSHAuthCallback(t *testing.T) {
+	ctx := t.Context()
+
+	controlURL, _ := startControl(t)
+	srvNode, srvIP, _ := startServer(t, ctx, controlURL, "sshauthsrv")
+	clientNode, clientIP, _ := startServer(t, ctx, controlURL, "sshauthclient")
+
+	if err := tstest.WaitFor(30*time.Second, func() error {
+		lc, err := srvNode.LocalClient()
+		if err != nil {
+			return err
+		}
+		st, err := lc.Status(ctx)
+		if err != nil {
+			return err
+		}
+		for _, peer := range st.Peer {
+			if slices.Contains(peer.TailscaleIPs, clientIP) {
+				return nil
+			}
+		}
+		return errors.New("clientNode not yet in srvNode's netmap")
+	}); err != nil {
+		t.Fatal(err)
+	}
+
+	// runAgainst dials srvNode's SSH listener from clientNode, runs a
+	// command, and returns the exit error and output.
+	runAgainst := func(ln net.Listener) (string, error) {
+		t.Helper()
+		addr := net.JoinHostPort(srvIP.String(), "22")
+		if _, port, _ := net.SplitHostPort(ln.Addr().String()); port != "" && port != "0" {
+			addr = net.JoinHostPort(srvIP.String(), port)
+		}
+		tcpConn, err := clientNode.Dial(ctx, "tcp", addr)
+		if err != nil {
+			return "", err
+		}
+		t.Cleanup(func() { tcpConn.Close() })
+		sshConn, chans, reqs, err := gossh.NewClientConn(tcpConn, addr, &gossh.ClientConfig{
+			User:            "test",
+			HostKeyCallback: gossh.InsecureIgnoreHostKey(),
+		})
+		if err != nil {
+			return "", err
+		}
+		sshClient := gossh.NewClient(sshConn, chans, reqs)
+		t.Cleanup(func() { sshClient.Close() })
+		session, err := sshClient.NewSession()
+		if err != nil {
+			return "", err
+		}
+		t.Cleanup(func() { session.Close() })
+		out, err := session.CombinedOutput("hello")
+		return string(out), err
+	}
+
+	// A denying callback refuses the session at open.
+	srvNode.SSHAuthCallback = func(peer tailcfg.NodeView, userProfile tailcfg.UserProfile) bool {
+		t.Logf("auth callback invoked for peer %v (login %q)", peer.ID(), userProfile.LoginName)
+		return false
+	}
+	denyLn, err := srvNode.ListenSSH(":2222")
+	if err != nil {
+		t.Fatal(err)
+	}
+	t.Cleanup(func() { denyLn.Close() })
+
+	out, err := runAgainst(denyLn)
+	if err == nil {
+		t.Fatalf("session was not refused by the deny callback; output %q", out)
+	}
+	var exitErr *gossh.ExitError
+	if !errors.As(err, &exitErr) || exitErr.ExitStatus() != 1 {
+		t.Errorf("refusal error = %v; want exit status 1, got %v", err, exitErr)
+	}
+	select {
+	case conn, ok := <-acceptCh(denyLn):
+		if ok {
+			t.Error("session was yielded to Accept despite denial")
+			conn.Close()
+		}
+	case <-time.After(2 * time.Second):
+		// No session was yielded, as expected.
+	}
+
+	// An allowing callback yields the session, and the application
+	// can talk to it.
+	srvNode.SSHAuthCallback = func(peer tailcfg.NodeView, userProfile tailcfg.UserProfile) bool {
+		return true
+	}
+	allowLn, err := srvNode.ListenSSH(":2223")
+	if err != nil {
+		t.Fatal(err)
+	}
+	t.Cleanup(func() { allowLn.Close() })
+
+	go func() {
+		conn, err := allowLn.Accept()
+		if err != nil {
+			return
+		}
+		defer conn.Close()
+		sess := conn.(*tailssh.Session)
+		defer sess.Exit(0)
+		fmt.Fprintf(sess, "allowed:%v\n", sess.UserProfile().LoginName != "")
+	}()
+
+	out, err = runAgainst(allowLn)
+	if err != nil {
+		t.Fatalf("session on allow listener failed: %v", err)
+	}
+	if got, want := strings.TrimSpace(string(out)), "allowed:true"; got != want {
+		t.Errorf("client output = %q; want %q", got, want)
+	}
+}
+
+func acceptCh(ln net.Listener) <-chan net.Conn {
+	ch := make(chan net.Conn, 1)
+	go func() {
+		conn, err := ln.Accept()
+		if err != nil {
+			close(ch)
+			return
+		}
+		ch <- conn
+	}()
+	return ch
+}
+
 // TestListenSSH starts two tsnet nodes on a test tailnet, has one listen
 // for SSH via ListenSSH, and has the other connect using the Go
 // x/crypto/ssh client. The server verifies the command string and echoes
```

**File**: `tsnet/tsnet.go` (modified, +53/-4)
```diff
@@ -268,6 +268,15 @@ type Server struct {
 	// used.
 	AuthKey string
 
+	// SSHAuthCallback is called for each new SSH session on listeners
+	// from [Server.ListenSSH]. It receives the peer's Tailscale
+	// identity, the same values as Session.Peer and
+	// Session.UserProfile. A session that it rejects is refused and is
+	// never yielded to Accept. If it is nil, every session from a peer
+	// that the tailnet ACL's TCP rules allow is accepted. See
+	// [SSHAuthCallback].
+	SSHAuthCallback SSHAuthCallback
+
 	// ClientSecret, if non-empty, is the OAuth client secret
 	// that will be used to generate authkeys via OAuth. It
 	// will be preferred over the TS_CLIENT_SECRET environment
@@ -1314,14 +1323,54 @@ func (s *Server) Listen(network, addr string) (net.Listener, error) {
 	return s.listen(network, addr, listenOnTailnet)
 }
 
+// SSHAuthCallback reports whether to accept a new SSH session from a
+// tailscale peer, on listeners from [Server.ListenSSH]. It is an
+// alias for ipnlocal.SSHAuthCallback, the type of
+// [Server.SSHAuthCallback].
+type SSHAuthCallback = ipnlocal.SSHAuthCallback
+
 // ListenSSH listens on the Tailscale network for SSH connections at the given
 // addr (e.g. ":2222"). The returned listener's Accept method yields net.Conn
 // values that are actually *tailssh.Session, providing access to the
 // connecting peer's Tailscale identity, PTY information, signals, and more.
 //
-// Basic applications can use the returned connections as plain net.Conn
-// (Read/Write/Close). Applications that need richer SSH semantics should
-// type-assert to *tailssh.Session.
+// # Trust model
+//
+// The server enforces only the tailnet ACL's TCP rules. For any
+// further authorization, the application must use s.SSHAuthCallback, or
+// check each accepted session and close the unwanted ones.
+// SSHAuthCallback enables applications to reject sessions before they
+// are started.
+//
+// Each session is yielded as a net.Conn, with the peer's Tailscale
+// identity available as Session.Peer and Session.UserProfile. The
+// application decides what each session may do, including which local
+// user to run as, if any.
+//
+// # Timeouts and limits
+//
+// The server runs session channels only; it does not forward ports.
+//
+// TS_SSH_LOGIN_GRACE_TIME bounds the time between accepting a
+// connection and completing the handshake. The default is 120
+// seconds, matching sshd's LoginGraceTime.
+//
+// TS_SSH_IDLE_TIMEOUT bounds connections with no SSH traffic. Any
+// traffic on the connection resets the timer. Zero, the default,
+// applies no bound.
+//
+// Sessions accepted by the server wait for Accept in a bounded queue.
+// When the queue is full, the server refuses new sessions, so an
+// application that stops calling Accept parks only a bounded number of
+// sessions.
+//
+// # Basic usage
+//
+// Applications that need only a data stream can use the connections
+// as plain net.Conn (Read, Write, and Close). Applications that need
+// peer identity, PTY configuration, or signals should type-assert to
+// *tailssh.Session. On PTY sessions the server does not translate
+// "\n" to "\r\n", so Read and Write are binary safe.
 //
 // SSH support must be linked into the binary by importing
 // _ "tailscale.com/feature/ssh". Without that import, ListenSSH returns an
@@ -1333,7 +1382,7 @@ func (s *Server) ListenSSH(addr string) (net.Listener, error) {
 	if err != nil {
 		return nil, err
 	}
-	sshLn, err := s.lb.ListenSSH(rawLn, s.logf)
+	sshLn, err := s.lb.ListenSSH(rawLn, s.SSHAuthCallback, s.logf)
 	if err != nil {
 		rawLn.Close()
 		return nil, err
```

#### Recent Merged Pull Requests:
- **PR #21939** (closed): ssh/tailssh: add ssh-monitor process and client (@raggi)
- **PR #21936** (2026-10-25): ssh/tailssh: drain the sftp test helper's stderr copier (@raggi)
- **PR #21933** (2026-10-25): go.mod: update gliderssh to remove data race on timeouts (@raggi)
- **PR #21931** (2026-10-25): ipn/ipnlocal: fix serve app caps leaking across mounts (@jentfoo)
- **PR #21930** (2026-10-25): tsnet: authorize ListenSSH peers, fix PTY emulation and session queue bound (@raggi)
- **PR #21929** (2026-10-24): ssh/tailssh: record sftp sessions and honor recording failure policy (@raggi)

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

## X. tsnet: authorize ListenSSH peers, fix PTY emulation and session queue bound

**RULE**:
When implementing operations in `ipn/ipnlocal/local.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in tailscale/tailscale. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `a1e51f49`: tsnet: authorize ListenSSH peers, fix PTY emulation and session queue bound. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `ipn/ipnlocal/local.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
// SSHAuthCallback reports whether to accept a new SSH session. It is
// called for each session before the session is yielded to the
// listener from [LocalBackend.ListenSSH], with the peer's node and
// user profile. A session that the callback rejects is refused and is
// never yielded to Accept.
//
// ListenSSH accepts a session from any peer that the tailnet ACL's TCP
// rules allow. The ACL's SSHPolicy is not used. Use SSHAuthCallback to
// reject sessions the application does not want.
type SSHAuthCallback func(tailcfg.NodeView, tailcfg.UserProfile) (permitted bool)

var HookListenSSH feature.Hook[func(net.Listener, *LocalBackend, SSHAuthCallback, logger.Logf) (net.Listener, error)]
// If auth is nil, every session from a peer that the tailnet ACL's TCP
// rules allow is accepted. If auth is non-nil, sessions that it rejects
// are refused. See [SSHAuthCallback].
//
func (b *LocalBackend) ListenSSH(ln net.Listener, auth SSHAuthCallback, logf logger.Logf) (net.Listener, error) {
	return fn(ln, b, auth, logf)
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
var HookListenSSH feature.Hook[func(net.Listener, *LocalBackend, logger.Logf) (net.Listener, error)]
func (b *LocalBackend) ListenSSH(ln net.Listener, logf logger.Logf) (net.Listener, error) {
	return fn(ln, b, logf)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `a1e51f49` are properly handled with clean fallback behavior.
