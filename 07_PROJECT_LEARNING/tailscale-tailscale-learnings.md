# Forensic Learning Record (Deep Inspection): tailscale/tailscale

> **Canonical Artifact**: `07_PROJECT_LEARNING/tailscale-tailscale-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/tailscale/tailscale](https://github.com/tailscale/tailscale))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-07T21:19:51.143Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tailscale/tailscale`
- **Description**: The easiest, most secure way to use WireGuard and 2FA.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 37243 stars

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

### Core Architecture Module: `drive/driveimpl/shared/pathutil.go`
```
// Copyright (c) Tailscale Inc & contributors
// SPDX-License-Identifier: BSD-3-Clause

package shared

import (
	"net/url"
	"path"
	"strings"
)

// This file provides utility functions for working with URL paths. These are
// similar to functions in package path in the standard library, but differ in
// ways that are documented on the relevant functions.

const (
	sepString       = "/"
	sepStringAndDot = "/."
	sep             = '/'
)

// CleanAndSplit cleans the provided path p and splits it into its constituent
// parts. This is different from path.Split which just splits a path into prefix
// and suffix.
//
// If p is empty or contains only path separators, CleanAndSplit returns a slice
// of length 1 whose only element is "".
func CleanAndSplit(p string) []string {
	return strings.Split(strings.Trim(path.Clean(p), sepStringAndDot), sepString)
}

// Normalize normalizes the given path (e.g. dropping trailing slashes).
func Normalize(p string) string {
	return Join(CleanAndSplit(p)...)
}

// Parent extracts the parent of the given path.
func Parent(p string) string {
	parts := CleanAndSplit(p)
	return Join(parts[:len(parts)-1]...)
}

// Join behaves like path.Join() but also includes a leading slash.
//
// When parts are missing, the result is "/".
func Join(parts ...string) string {
	fullParts := make([]string, 0, len(parts))
	fullParts = append(fullParts, sepString)
	for _, part := range parts {
		fullParts = append(fullParts, part)
	}
	return path.Join(fullParts...)
}

// JoinEscaped is like Join but path escapes each part.
func JoinEscaped(parts ...string) string {
	fullParts := make([]string, 0, len(parts))
	fullParts = append(fullParts, sepString)
	for _, part := range parts {
		fullParts = append(fullParts, url.PathEscape(part))
	}
	return path.Join(fullParts...)
}

// IsRoot determines whether a given path p is the root path, defined as either
// empty or "/".
func IsRoot(p string) bool {
	return p == "" || p == sepString
}

// Base is like path.Base except that it returns "" for the root folder
func Base(p string) string {
	if IsRoot(p) {
		return ""
	}
	return path.Base(p)
}

```

### Core Architecture Module: `feature/captiveportal/netcheckhook/netcheckhook.go`
```
// Copyright (c) Tailscale Inc & contributors
// SPDX-License-Identifier: BSD-3-Clause

// Package netcheckhook makes netcheck probe for captive portals during
// full reports. It does so as a side effect of being imported, by
// installing a netcheck hook from init.
package netcheckhook

import (
	"context"
	"log"
	"time"

	"tailscale.com/net/captivedetection"
	"tailscale.com/net/netcheck"
	"tailscale.com/tailcfg"
)

func init() {
	netcheck.HookStartCaptivePortalDetection.Set(startCaptivePortalDetection)
}

// captivePortalDelay is the duration to wait after starting a netcheck before
// also probing for a captive portal, to let UDP STUN finish first and avoid
// the probe if it's unnecessary. Chosen semi-arbitrarily.
const captivePortalDelay = 200 * time.Millisecond

func startCaptivePortalDetection(ctx context.Context, c *netcheck.Client, dm *tailcfg.DERPMap, preferredDERP tailcfg.DERPRegionID, setCaptivePortal func(bool)) (done <-chan struct{}, stop func()) {
	logf := c.Logf
	if logf == nil {
		logf = log.Printf
	}

	// This goroutine can't be tracked by the wait group that
	// netcheck.GetReport uses for its probes, since GetReport doesn't
	// wait for that group to finish before returning and we'd get a
	// data race. Instead, completion is signaled by closing ch, which
	// GetReport receives as the done channel.
	ch := make(chan struct{})

	tmr := time.AfterFunc(captivePortalDelay, func() {
		defer close(ch)
		d := captivedetection.NewDetector(logf)
		found := d.Detect(ctx, c.NetMon, dm, preferredDERP)
		setCaptivePortal(found)
	})

	if c.Verbose {
		// Don't cancel our captive portal check if we're
		// explicitly doing a verbose netcheck.
		return ch, func() {}
	}

	stop = func() {
		if tmr.Stop() {
			// Stopped successfully; need to close the
			// signal channel ourselves.
			close(ch)
			return
		}

		// Did not stop; do nothing and it'll finish by itself
		// and close the signal channel.
	}

	return ch, stop
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #21593** (2026-10-04): **Android (dual SIM + Wi-Fi): enabling "Use Tailscale DNS" immediately breaks all DNS (100.100.100.100 stops answering, even for MagicDNS names) — still happens on 1.103.x after #850/#857**
  *Symptoms*: ### What is the issue?  > **Disclosure:** This report was drafted with the help of an AI assistant (Claude). The investigation itself is real: all measurements come from my own phone. I ran the diagnostics (Termux scripts that record DNS/network state automatically when the failure happens), reproduced the issue myself, and generated the bug report ID while it was broken. I've reviewed the report and I'm happy to run any additional tests you suggest.  On my Android phone, turning on **Use Tailscale DNS** makes system DNS fail instantly and completely. Every app loses connectivity. The tunnel itself stays healthy. The failure is deterministic: it happens right at the moment I enable the setting, without any network change.  **The phone has two active SIMs, and I suspect that matters.** At the time of the failure, the phone had several non-VPN networks at once: - Wi-Fi (`wlan0`): the default network, with working internet. - SIM1: a Japanese SoftBank SIM roaming in Taiwan, on LTE. - SIM2: Chunghwa Telecom (Taiwan), on LTE, with working internet (`rmnet_data4`). - An extra cellular interface with no internet reachability (`rmnet_data1`). I can't tell from userspace without root which SIM it belongs to, or whether it's the IMS/VoLTE network.  So Tailscale has several candidate "underlying networks" to choose from, and at least one of them may look usable but isn't. All failures I've seen happened with both SIMs active. In the ones where I recorded the network state, Wi-Fi was the
  **Post-Mortem & Fix Analysis**:
  > Update and closing note.  I'm fairly sure this is a duplicate of #21155, fixed by #21332. My report was on 1.103.201, which was built before that fix.  What I saw on 2026-10-01, still on 1.103.201: - With "Use Tailscale DNS" **off**, `dig @100.100.100.100 <machine>.<tailnet>.ts.net` still timed out over both UDP and TCP, while `ping 100.100.100.100` answered. So netstack itself was not sending replies. That matches #21155. The ping works only because the ICMP reply for quad-100 is generated in `net/tstun`, outside netstack. - After a **force-stop** of the app (toggling the setting or the VPN had not helped), quad-100 answered again and DNS worked with the setting on.  Then I installed **1.103.309** from the unstable track. It includes #21332. I have kept "Use Tailscale DNS" on since 2026-10-01, about 3 days so far, including going in and out between home Wi-Fi and cellular. It has not happened again.  So I'm closing this as a duplicate of #21155. If it comes back on 1.103.309 or later,

- **Issue #21578** (2026-09-29): **tsnet/natlab/vmtest: TestDirectConnectionWithCachedNetmapOnOneNode/ping_from_offline failure**
  *Symptoms*: ### What is the issue?  This assert failed when doing a full test run on my laptop (KVM-enabled): https://github.com/tailscale/tailscale/blob/5758b2aa572fbe389c3b8074fb6cb4027357e10e/tstest/natlab/vmtest/vmtest_test.go#L1284-L1289  ``` === RUN   TestDirectConnectionWithCachedNetmapOnOneNode/ping_from_offline ...     vmtest_test.go:1262: Saw ping type "derp" 2026/09/22 15:40:54 takeAgentConn: still waiting for agent conn for 52:cc:cc:cc:cc:01 after 6m20s (0 idle conns for other nodes) 2026/09/22 15:40:54 [net-52:ee:ee:ee:ee:01] TODO: handle PCP packet 02 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 ff ff c0 a8 01 65     vmtest_test.go:1262: Saw ping type "direct"     vmtest_test.go:1266: Saw ping type "direct"     vmtest_test.go:1273: Node A: metric "magicsock_cached_peer_contact_direct": got 2, want 1 ...     vmtest.go:368: [b] [2026-09-22T22:40:53.484Z] magicsock: updated disco key for peer [jWSYH] to d:d6f629ffb7910762     vmtest.go:368: [b] [2026-09-22T22:40:53.485Z] Accept: ICMPv4{100.64.0.1:0 > 100.64.0.2:0} 59 icmp response ok     vmtest.go:368: [b] [2026-09-22T22:40:53.668Z] magicsock: new contact: peer=[jWSYH] usec=1681984 cached=false via=derp     vmtest.go:368: [b] [2026-09-22T22:40:53.669Z] magicsock: disco: node [jWSYH] d:d6f629ffb7910762 now using 1.0.0.1:37579 mtu=1360 tx=ff19578031b1     vmtest.go:368: [b] [2026-09-22T22:40:53.669Z] magicsock: new contact: peer=[jWSYH] usec=1683339 cached=false via=direct === RUN   TestDirectConnectionWithCachedNetmapOnOn

- **Issue #21564** (2026-10-04): **net/dns/resolver: exit node PTR handling rejects uppercase names and accepts non-hex nibbles**
  *Symptoms*: ## What is the issue?  `unARPA` converts a reverse-lookup name to an IP address string when an exit node or app connector resolves a PTR query with the net package. It has two defects:  1. The `.in-addr.arpa.` and `.ip6.arpa.` suffixes are matched case-sensitively.    DNS names are case-insensitive and some resolvers randomize the case of the    query name, so `4.4.8.8.IN-ADDR.ARPA.` fails with `bogus PTR name`. 2. The error from `hex.Decode` is ignored for IPv6 names. A name with a    non-hex nibble, such as `z.0.0.2.0.0.0.0.0.0.0.0.0.0.0.0.b.0.8.0.a.0.0.4.0.b.8.f.7.0.6.2.ip6.arpa.`,    returns the partly decoded address `2607:f8b0:400a:80b::2000`, and the exit    node looks up an unrelated IP.  ## Steps to reproduce  ```go unARPA("4.4.8.8.IN-ADDR.ARPA.") // "", false; want "8.8.4.4", true unARPA("z.0.0.2.0.0.0.0.0.0.0.0.0.0.0.0.b.0.8.0.a.0.0.4.0.b.8.f.7.0.6.2.ip6.arpa.") // "2607:f8b0:400a:80b::2000", true; want "", false ```  ## Expected behavior  Suffix matching ignores case, and a name with a non-hex nibble is rejected.  ## Version  Current main.

- **Issue #21562** (2026-10-04): **net/portmapper: UPnP mapping fails with "unexpected host" when the Location URL has no port**
  *Symptoms*: ## What is the issue?  `getUPnPRootDevice` parses the host of the discovery response's `Location` header with `netip.ParseAddrPort`. That call fails if the URL leaves out the port, which is legal for the default HTTP port. A router that answers SSDP discovery with `Location: http://192.168.1.1/rootDesc.xml` is rejected with:  ``` unexpected host "192.168.1.1" in "http://192.168.1.1/rootDesc.xml" ```  and no UPnP port mapping is created for that gateway.  The same code path repoints a `Location` that names a different address at the gateway. That step calls `net.JoinHostPort(gw.String(), u.Port())`, which would produce `192.168.1.1:` for a URL without a port.  ## Steps to reproduce  Call `getUPnPRootDevice` with `meta.Location` set to `http://192.168.1.1/rootDesc.xml` and `gw` set to `192.168.1.1`. The call returns the error above before any request is made.  ## Expected behavior  The port is optional. The root description is fetched from the gateway, on the given port if there is one and on the scheme's default port otherwise.  ## Version  Current main.

- **Issue #21558** (2026-10-04): **cmd/tailscale/cli: "tailscale set --advertise-routes" never warns when IP forwarding is disabled**
  *Symptoms*: ### What is the issue?  `tailscale up --advertise-routes=...` prints a warning when IP forwarding is disabled on the machine. `tailscale set --advertise-routes=...` does not.  In `cmd/tailscale/cli/set.go`, `runSet` calls `warnOnAdvertiseRoutes(ctx, &maskedPrefs.Prefs)` before the advertise flags are applied. `Prefs.AdvertiseRoutes` is filled in later by `calcAdvertiseRoutesForSet`, so the `len(prefs.AdvertiseRoutes) > 0` check never passes and `check-ip-forwarding` is never called. The same applies to `--advertise-exit-node`.  ### Steps to reproduce  1. On Linux with `net.ipv4.ip_forward=0`, run `tailscale set --advertise-routes=10.0.0.0/24`.  ### Actual behavior  No warning.  ### Expected behavior  The same "IP forwarding is disabled" warning that `tailscale up` prints.  ### OS  Linux.

- **Issue #21554** (2026-10-04): **net/dns/resolver: WriteDNSResolver never prints bootstrap IPs**
  *Symptoms*: ### What is the issue?  `WriteDNSResolver` formats a resolver for the DNS manager debug logs. For a resolver with `BootstrapResolution` set, it prints empty parentheses, for example `https://dns.example.com/dns-query()`, and the bootstrap addresses are missing. The loop calls `ip.AppendTo(b[:0])` and discards the result, so `b` stays nil.  This affects log output only, not DNS behavior.  ### Steps to reproduce  Call `WriteDNSResolver` with `&dnstype.Resolver{Addr: "https://dns.example.com/dns-query", BootstrapResolution: []netip.Addr{netip.MustParseAddr("192.0.2.1")}}`.  ### Expected behavior  `https://dns.example.com/dns-query(192.0.2.1)`, with multiple addresses separated by a space.  ### OS  Any.

- **Issue #21540** (2026-10-04): **cmd/tailscale/cli: serve port-too-high error names the wrong flag**
  *Symptoms*: ### What is the issue?  When a port number passed to a serve flag is above 65535, `tailscale serve` and `tailscale funnel` report the error with the wrong flag name, or with an internal value.  `srvTypeAndPortFromFlags` builds the message from the named result `srvType`, which is not assigned until after the range check. The message shows whatever value that variable holds at that point.  ### Steps to reproduce  ``` tailscale serve --tcp=65536 --bg 3000 tailscale serve --http=65536 --bg 3000 tailscale serve --tls-terminated-tcp=65536 --bg 3000 ```  ### Actual behavior  ``` port number 65536 is too high for https flag ```  The message names `https` for every flag above, and no `--https` flag was passed.  ### Expected behavior  The message names the flag that was passed, for example `port number 65536 is too high for tcp flag`.  ### Are there any recent changes that introduced the issue?  No.  ### OS  Any.

- **Issue #21534** (2026-10-05): **ipn/conffile: tailscale serve set-config panics on a null service or endpoint**
  *Symptoms*: ### What is the issue?  `tailscale serve set-config` panics with a nil pointer dereference when a Services config file has a JSON `null` in place of a service definition or an endpoint target. The file should be rejected with an error.  ### Steps to reproduce  Use any of these files with `tailscale serve set-config`:  ```json {"version":"0.0.1","services":{"svc:a":null}} {"version":"0.0.1","services":{"svc:a":{"endpoints":{"tcp:443":null}}}} ```  ### Actual behavior  ``` panic: runtime error: invalid memory address or nil pointer dereference tailscale.com/ipn/conffile.loadConfigV0 ```  ### Expected behavior  An error that names the service or endpoint.  ### OS  Any.

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

### Incident Patch 1: `2a61a720` (2026-10-05)
**Commit Message**: ipn/ipnlocal: drop the appc import from ts_omit_appconnectors builds

LocalBackend named appc.AppConnector in its appConnector field, in the
field's constructor call, and in the AppConnector accessor, so even
builds with ts_omit_appconnectors linked the appc package and its
dependencies. The buildfeatures.HasAppConnectors checks let the linker
drop the code but could not remove the import.

Add a build-tag-gated type for the field: appcAppConnector is an alias
for appc.AppConnector by default, and in ts_omit_appconnectors builds it
is an empty struct with no-op versions of the methods local.go calls, so
the shared code still type checks. The constructor call moves behind a
newAppConnector helper in the same gated file, and the AppConnector
accessor keeps its *appc.AppConnector signature there, with a nil-
returning version in the omitted build.

This takes tailscale.com/appc out of depaware-min.txt and
depaware-minbox.txt. Add a DepChecker test to keep it out; it also sets
ts_omit_conn25, since conn25 uses appc as well.

Updates #12614

Signed-off-by: Brad Fitzpatrick <[REDACTED_EMAIL]>
Change-Id: Ia7e2d9c4f1b8e6a3d5c0f2b7e9a1c4d6f8b0e2a5

**File**: `cmd/tailscaled/depaware-min.txt` (modified, +6/-7)
```diff
@@ -39,7 +39,6 @@ tailscale.com/cmd/tailscaled dependencies: (generated by github.com/tailscale/de
      💣 go4.org/mem                                                  from tailscale.com/control/controlbase+
         go4.org/netipx                                               from tailscale.com/ipn/ipnlocal+
         tailscale.com                                                from tailscale.com/version
-        tailscale.com/appc                                           from tailscale.com/ipn/ipnlocal
         tailscale.com/atomicfile                                     from tailscale.com/ipn+
         tailscale.com/client/tailscale/apitype                       from tailscale.com/ipn/ipnauth+
         tailscale.com/cmd/tailscaled/childproc                       from tailscale.com/cmd/tailscaled
@@ -142,7 +141,7 @@ tailscale.com/cmd/tailscaled dependencies: (generated by github.com/tailscale/de
         tailscale.com/types/ipproto                                  from tailscale.com/ipn+
         tailscale.com/types/key                                      from tailscale.com/control/controlbase+
         tailscale.com/types/lazy                                     from tailscale.com/hostinfo+
-        tailscale.com/types/logger                                   from tailscale.com/appc+
+        tailscale.com/types/logger                                   from tailscale.com/cmd/tailscaled+
         tailscale.com/types/logid                                    from tailscale.com/cmd/tailscaled+
         tailscale.com/types/mapx                                     from tailscale.com/ipn/ipnext+
         tailscale.com/types/netlogfunc                               from tailscale.com/net/tstun+
@@ -154,19 +153,19 @@ tailscale.com/cmd/tailscaled dependencies: (generated by github.com/tailscale/de
         tailscale.com/types/result                                   from tailscale.com/util/lineiter
         tailscale.com/types/structs                                  from tailscale.com/control/controlclient+
         tailscale.com/types/tkatype                                  from tailscale.com/control/controlclient+
-        tailscale.com/types/views                                    from tailscale.com/appc+
+        tailscale.com/types/views                                    from tailscale.com/control/controlclient+
         tailscale.com/util/backoff                                   from tailscale.com/control/controlclient+
         tailscale.com/util/bufiox                                    from tailscale.com/types/key
         tailscale.com/util/checkchange                               from tailscale.com/ipn/ipnlocal+
         tailscale.com/util/cibuild                                   from tailscale.com/health+
-        tailscale.com/util/clientmetric                              from tailscale.com/appc+
+        tailscale.com/util/clientmetric                              from tailscale.com/control/controlclient+
         tailscale.com/util/cloudenv                                  from tailscale.com/hostinfo+
         tailscale.com/util/cloudinfo                                 from tailscale.com/wgengine/magicsock
         tailscale.com/util/ctxkey                                    from tailscale.com/client/tailscale/apitype+
         tailscale.com/util/def                                       from tailscale.com/ipn/localapi
-        tailscale.com/util/dnsname                                   from tailscale.com/appc+
+        tailscale.com/util/dnsname                                   from tailscale.com/hostinfo+
         tailscale.com/util/eventbus                                  from tailscale.com/control/controlclient+
-        tailscale.com/util/execqueue                                 from tailscale.com/appc+
+        tailscale.com/util/execqueue                                 from tailscale.com/control/controlclient+
         tailscale.com/util/goroutines                                from tailscale.com/ipn/ipnlocal
         tailscale.com/util/groupmember                               from tailscale.com/ipn/ipnauth
         tailscale.com/util/httpbody                                  from tailscale.com/control/controlclient+
@@ -184,7 +183,7 @@ tailscale.com/cmd/tailscaled dependencies: (generated by github.com/tailscale/de
         tailscale.com/util/ringlog                                   from tailscale.com/wgengine/magicsock
         tailscale.com/util/set                                       from tailscale.com/control/controlclient+
         tailscale.com/util/singleflight                              from tailscale.com/control/controlclient+
-        tailscale.com/util/slicesx                                   from tailscale.com/appc+
+        tailscale.com/util/slicesx                                   from tailscale.com/control/controlclient+
         tailscale.com/util/syspolicy/pkey                            from tailscale.com/cmd/tailscaled+
         tailscale.com/util
```

**File**: `cmd/tailscaled/depaware-minbox.txt` (modified, +6/-7)
```diff
@@ -44,7 +44,6 @@ tailscale.com/cmd/tailscaled dependencies: (generated by github.com/tailscale/de
      💣 go4.org/mem                                                  from tailscale.com/control/controlbase+
         go4.org/netipx                                               from tailscale.com/ipn/ipnlocal+
         tailscale.com                                                from tailscale.com/version
-        tailscale.com/appc                                           from tailscale.com/ipn/ipnlocal
         tailscale.com/atomicfile                                     from tailscale.com/ipn+
         tailscale.com/client/local                                   from tailscale.com/client/tailscale+
         tailscale.com/client/tailscale                               from tailscale.com/internal/client/tailscale
@@ -161,7 +160,7 @@ tailscale.com/cmd/tailscaled dependencies: (generated by github.com/tailscale/de
         tailscale.com/types/ipproto                                  from tailscale.com/ipn+
         tailscale.com/types/key                                      from tailscale.com/client/local+
         tailscale.com/types/lazy                                     from tailscale.com/hostinfo+
-        tailscale.com/types/logger                                   from tailscale.com/appc+
+        tailscale.com/types/logger                                   from tailscale.com/cmd/tailscale/cli+
         tailscale.com/types/logid                                    from tailscale.com/cmd/tailscaled+
         tailscale.com/types/mapx                                     from tailscale.com/ipn/ipnext+
         tailscale.com/types/netlogfunc                               from tailscale.com/net/tstun+
@@ -173,19 +172,19 @@ tailscale.com/cmd/tailscaled dependencies: (generated by github.com/tailscale/de
         tailscale.com/types/result                                   from tailscale.com/util/lineiter
         tailscale.com/types/structs                                  from tailscale.com/control/controlclient+
         tailscale.com/types/tkatype                                  from tailscale.com/control/controlclient+
-        tailscale.com/types/views                                    from tailscale.com/appc+
+        tailscale.com/types/views                                    from tailscale.com/cmd/tailscale/cli+
         tailscale.com/util/backoff                                   from tailscale.com/control/controlclient+
         tailscale.com/util/bufiox                                    from tailscale.com/types/key
         tailscale.com/util/checkchange                               from tailscale.com/ipn/ipnlocal+
         tailscale.com/util/cibuild                                   from tailscale.com/health+
-        tailscale.com/util/clientmetric                              from tailscale.com/appc+
+        tailscale.com/util/clientmetric                              from tailscale.com/client/local+
         tailscale.com/util/cloudenv                                  from tailscale.com/hostinfo+
         tailscale.com/util/cloudinfo                                 from tailscale.com/wgengine/magicsock
         tailscale.com/util/ctxkey                                    from tailscale.com/client/tailscale/apitype+
         tailscale.com/util/def                                       from tailscale.com/ipn/localapi
-        tailscale.com/util/dnsname                                   from tailscale.com/appc+
+        tailscale.com/util/dnsname                                   from tailscale.com/cmd/tailscale/cli+
         tailscale.com/util/eventbus                                  from tailscale.com/client/local+
-        tailscale.com/util/execqueue                                 from tailscale.com/appc+
+        tailscale.com/util/execqueue                                 from tailscale.com/control/controlclient+
         tailscale.com/util/goroutines                                from tailscale.com/ipn/ipnlocal
         tailscale.com/util/groupmember                               from tailscale.com/ipn/ipnauth
         tailscale.com/util/httpbody                                  from tailscale.com/control/controlclient+
@@ -205,7 +204,7 @@ tailscale.com/cmd/tailscaled dependencies: (generated by github.com/tailscale/de
         tailscale.com/util/ringlog                                   from tailscale.com/wgengine/magicsock
         tailscale.com/util/set                                       from tailscale.com/control/controlclient+
         tailscale.com/util/singleflight                              from tailscale.com/control/controlclient+
-        tailscale.com/util/slicesx                                   from tailscale.com/appc+
+        tailscale.com/util/slicesx                                   from tailscale.com/cmd/tailscale/cli+
         tailscale.com/util/syspolicy/pkey                            from tailscale.com/cmd/tailscaled+
         tailscale.com/util/sysp
```

**File**: `cmd/tailscaled/deps_test.go` (modified, +15/-0)
```diff
@@ -81,6 +81,21 @@ func TestOmitDNSResolveCache(t *testing.T) {
 	}.Check(t)
 }
 
+func TestOmitAppConnectors(t *testing.T) {
+	const msg = "unexpected app connector usage with ts_omit_appconnectors"
+	deptest.DepChecker{
+		GOOS:   "linux",
+		GOARCH: "amd64",
+		// conn25 also uses appc, so omit it too to check that nothing
+		// else pulls appc in.
+		Tags: "ts_omit_appconnectors,ts_omit_conn25,ts_include_cli",
+		BadDeps: map[string]string{
+			"tailscale.com/appc":                  msg,
+			"tailscale.com/feature/appconnectors": msg,
+		},
+	}.Check(t)
+}
+
 func TestOmitSyspolicy(t *testing.T) {
 	const msg = "unexpected syspolicy usage with ts_omit_syspolicy"
 	deptest.DepChecker{
```

**File**: `ipn/ipnlocal/appconnector.go` (added, +39/-0)
```diff
@@ -0,0 +1,39 @@
+// Copyright (c) Tailscale Inc & contributors
+// SPDX-License-Identifier: BSD-3-Clause
+
+//go:build !ts_omit_appconnectors
+
+package ipnlocal
+
+import (
+	"tailscale.com/appc"
+	"tailscale.com/types/appctype"
+	"tailscale.com/types/logger"
+	"tailscale.com/util/eventbus"
+)
+
+// appcAppConnector is [appc.AppConnector] in builds that include app
+// connectors. Builds with ts_omit_appconnectors substitute a stub type
+// (see appconnector_omit.go) so that this package does not import appc
+// at all, which keeps appc and its dependencies out of those binaries.
+type appcAppConnector = appc.AppConnector
+
+// newAppConnector returns a new [appc.AppConnector] publishing to bus,
+// seeded with the previously stored routes in ri (which may be nil).
+func newAppConnector(logf logger.Logf, bus *eventbus.Bus, ri *appctype.RouteInfo, storeRoutes bool) *appcAppConnector {
+	return appc.NewAppConnector(appc.Config{
+		Logf:            logf,
+		EventBus:        bus,
+		RouteInfo:       ri,
+		HasStoredRoutes: storeRoutes,
+	})
+}
+
+// AppConnector returns the current AppConnector, or nil if not configured.
+//
+// TODO(nickkhyl): move app connectors to [nodeBackend], or perhaps a feature package?
+func (b *LocalBackend) AppConnector() *appc.AppConnector {
+	b.mu.Lock()
+	defer b.mu.Unlock()
+	return b.appConnector
+}
```

**File**: `ipn/ipnlocal/appconnector_omit.go` (added, +35/-0)
```diff
@@ -0,0 +1,35 @@
+// Copyright (c) Tailscale Inc & contributors
+// SPDX-License-Identifier: BSD-3-Clause
+
+//go:build ts_omit_appconnectors
+
+package ipnlocal
+
+import (
+	"net/netip"
+
+	"tailscale.com/types/appctype"
+	"tailscale.com/types/logger"
+	"tailscale.com/util/eventbus"
+)
+
+// appcAppConnector stands in for [tailscale.com/appc.AppConnector] in
+// builds without app connectors, so that this package does not import
+// appc. Its methods exist only so that the shared code in local.go type
+// checks; they are never reached, because every caller first checks
+// [buildfeatures.HasAppConnectors] and b.appConnector is always nil.
+type appcAppConnector struct{}
+
+func newAppConnector(logf logger.Logf, bus *eventbus.Bus, ri *appctype.RouteInfo, storeRoutes bool) *appcAppConnector {
+	panic("unreachable with ts_omit_appconnectors")
+}
+
+func (*appcAppConnector) Close()                                                         {}
+func (*appcAppConnector) ShouldStoreRoutes() bool                                        { return false }
+func (*appcAppConnector) UpdateDomainsAndRoutes(domains []string, routes []netip.Prefix) {}
+func (*appcAppConnector) DomainRoutes() map[string][]netip.Addr                          { return nil }
+func (*appcAppConnector) ObserveDNSResponse(res []byte) error                            { return nil }
+func (*appcAppConnector) ClearRoutes() error                                             { return nil }
+
+// AppConnector returns nil; app connectors are omitted from this build.
+func (b *LocalBackend) AppConnector() *appcAppConnector { return nil }
```

**File**: `ipn/ipnlocal/local.go` (modified, +6/-24)
```diff
@@ -35,7 +35,6 @@ import (
 	"go4.org/mem"
 	"go4.org/netipx"
 	"golang.org/x/net/dns/dnsmessage"
-	"tailscale.com/appc"
 	"tailscale.com/client/tailscale/apitype"
 	"tailscale.com/control/controlclient"
 	"tailscale.com/control/controlknobs"
@@ -325,10 +324,10 @@ type LocalBackend struct {
 	conf             *conffile.Config // latest parsed config, or nil if not in declarative mode
 	pm               *profileManager  // mu guards access
 	lastFilterInputs *filterInputs
-	httpTestClient   *http.Client       // for controlclient. nil by default, used by tests.
-	ccGen            clientGen          // function for producing controlclient; lazily populated
-	sshServer        SSHServer          // or nil, initialized lazily.
-	appConnector     *appc.AppConnector // or nil, initialized when configured.
+	httpTestClient   *http.Client      // for controlclient. nil by default, used by tests.
+	ccGen            clientGen         // function for producing controlclient; lazily populated
+	sshServer        SSHServer         // or nil, initialized lazily.
+	appConnector     *appcAppConnector // or nil, initialized when configured.
 	// notifyCancel cancels notifications to the current SetNotifyCallback.
 	notifyCancel context.CancelFunc
 	cc           controlclient.Client // TODO(nickkhyl): move to nodeBackend
@@ -6012,12 +6011,7 @@ func (b *LocalBackend) reconfigAppConnectorLocked(selfNode tailcfg.NodeView, pre
 			b.logf("Unsuccessful Read RouteInfo: %v", err)
 		}
 		b.appConnector.Close() // clean up a previous connector (safe on nil)
-		b.appConnector = appc.NewAppConnector(appc.Config{
-			Logf:            b.logf,
-			EventBus:        b.sys.Bus.Get(),
-			RouteInfo:       ri,
-			HasStoredRoutes: shouldStoreRoutes,
-		})
+		b.appConnector = newAppConnector(b.logf, b.sys.Bus.Get(), ri, shouldStoreRoutes)
 	}
 	if !selfNode.Valid() {
 		return
@@ -7910,18 +7904,6 @@ func (b *LocalBackend) OfferingAppConnector() bool {
 	return b.appConnector != nil
 }
 
-// AppConnector returns the current AppConnector, or nil if not configured.
-//
-// TODO(nickkhyl): move app connectors to [nodeBackend], or perhaps a feature package?
-func (b *LocalBackend) AppConnector() *appc.AppConnector {
-	if !buildfeatures.HasAppConnectors {
-		return nil
-	}
-	b.mu.Lock()
-	defer b.mu.Unlock()
-	return b.appConnector
-}
-
 // allowExitNodeDNSProxyToServeName reports whether the Exit Node DNS
 // proxy is allowed to serve responses for the provided DNS name.
 func (b *LocalBackend) allowExitNodeDNSProxyToServeName(name string) bool {
@@ -8604,7 +8586,7 @@ func (b *LocalBackend) ObserveDNSResponse(res []byte) error {
 	if !buildfeatures.HasAppConnectors {
 		return nil
 	}
-	var appConnector *appc.AppConnector
+	var appConnector *appcAppConnector
 	b.mu.Lock()
 	if b.appConnector == nil {
 		b.mu.Unlock()
```

---

### Incident Patch 2: `edf8abd6` (2026-10-05)
**Commit Message**: ipn/conffile: reject null services and endpoints in Services config files (#21647)

A JSON null for a service or for an endpoint target unmarshals as a nil
pointer, and loadConfigV0 dereferenced it without a check. This made
"tailscale serve set-config" panic. Return an error that names the
service or endpoint instead.

Fixes #21534

Signed-off-by: Brendan Creane <[REDACTED_EMAIL]>

**File**: `ipn/conffile/serveconf.go` (modified, +6/-0)
```diff
@@ -261,6 +261,9 @@ func loadConfigV0(json []byte, forService string) (*ServicesConfigFile, error) {
 		}
 	}
 	for svcName, svc := range scf.Services {
+		if svc == nil {
+			return nil, fmt.Errorf("service %q: must not be null", svcName)
+		}
 		if forService == "" && svc.Version != "" {
 			return nil, errors.New("services cannot be versioned separately from config file")
 		}
@@ -274,6 +277,9 @@ func loadConfigV0(json []byte, forService string) (*ServicesConfigFile, error) {
 		foundTUN := false
 		foundNonTUN := false
 		for ppr, target := range svc.Endpoints {
+			if target == nil {
+				return nil, fmt.Errorf("service %q: endpoint %q: must not be null", svcName, ppr.String())
+			}
 			if target.Protocol == "TUN" {
 				if ppr.Proto != 0 || ppr.Ports != tailcfg.PortRangeAny {
 					return nil, fmt.Errorf("service %q: destination \"TUN\" can only be used with source \"*\"", svcName)
```

**File**: `ipn/conffile/serveconf_test.go` (modified, +43/-0)
```diff
@@ -6,6 +6,8 @@
 package conffile
 
 import (
+	"os"
+	"path/filepath"
 	"testing"
 
 	"tailscale.com/tailcfg"
@@ -106,3 +108,44 @@ func TestTargetUnixSocketRoundtrip(t *testing.T) {
 		})
 	}
 }
+
+func TestLoadServicesConfigNull(t *testing.T) {
+	tests := []struct {
+		name       string
+		forService string
+		config     string
+		wantErr    string
+	}{
+		{
+			name:    "null_service",
+			config:  `{"version":"0.0.1","services":{"svc:a":null}}`,
+			wantErr: `service "svc:a": must not be null`,
+		},
+		{
+			name:    "null_endpoint",
+			config:  `{"version":"0.0.1","services":{"svc:a":{"endpoints":{"tcp:443":null}}}}`,
+			wantErr: `service "svc:a": endpoint "tcp:443": must not be null`,
+		},
+		{
+			name:       "null_endpoint_for_service",
+			forService: "svc:a",
+			config:     `{"version":"0.0.1","endpoints":{"tcp:443":null}}`,
+			wantErr:    `service "svc:a": endpoint "tcp:443": must not be null`,
+		},
+	}
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			path := filepath.Join(t.TempDir(), "config.json")
+			if err := os.WriteFile(path, []byte(tt.config), 0o600); err != nil {
+				t.Fatal(err)
+			}
+			_, err := LoadServicesConfig(path, tt.forService)
+			if err == nil {
+				t.Fatalf("LoadServicesConfig succeeded; want error %q", tt.wantErr)
+			}
+			if err.Error() != tt.wantErr {
+				t.Errorf("LoadServicesConfig error = %q; want %q", err, tt.wantErr)
+			}
+		})
+	}
+}
```

---

### Incident Patch 3: `741b13b5` (2026-10-01)
**Commit Message**: appc: fix issue removing overlapping routes

Continue to iterate through all of the addrs for a domain to find
candidates for removal.

Fixes #20956

Signed-off-by: Fran Bull <[REDACTED_EMAIL]>

**File**: `appc/appconnector.go` (modified, +6/-4)
```diff
@@ -365,18 +365,20 @@ func (e *AppConnector) updateRoutes(routes []netip.Prefix) {
 		toRemove = routesWithout(e.controlRoutes, routes)
 	}
 
-nextRoute:
+	obsoleted := set.Set[netip.Addr]{}
 	for _, r := range routes {
 		for _, addr := range e.domains {
 			for _, a := range addr {
 				if r.Contains(a) && netip.PrefixFrom(a, a.BitLen()) != r {
-					pfx := netip.PrefixFrom(a, a.BitLen())
-					toRemove = append(toRemove, pfx)
-					continue nextRoute
+					obsoleted.Add(a)
 				}
 			}
 		}
 	}
+	for a := range obsoleted.All() {
+		pfx := netip.PrefixFrom(a, a.BitLen())
+		toRemove = append(toRemove, pfx)
+	}
 
 	if e.routeAdvertiser != nil {
 		e.queue.Add(func() {
```

**File**: `appc/appconnector_test.go` (modified, +3/-3)
```diff
@@ -142,8 +142,8 @@ func TestUpdateRoutesUnadvertisesContainedRoutes(t *testing.T) {
 		})
 		t.Cleanup(a.Close)
 
-		mak.Set(&a.domains, "example.com", []netip.Addr{netip.MustParseAddr("192.0.2.1")})
-		rc.SetRoutes([]netip.Prefix{netip.MustParsePrefix("192.0.2.1/32")})
+		mak.Set(&a.domains, "example.com", []netip.Addr{netip.MustParseAddr("192.0.2.1"), netip.MustParseAddr("192.0.2.2")})
+		rc.SetRoutes([]netip.Prefix{netip.MustParsePrefix("192.0.2.1/32"), netip.MustParsePrefix("192.0.2.2/32")})
 		routes := []netip.Prefix{netip.MustParsePrefix("192.0.2.0/24")}
 		a.updateRoutes(routes)
 		a.Wait(ctx)
@@ -155,7 +155,7 @@ func TestUpdateRoutesUnadvertisesContainedRoutes(t *testing.T) {
 		if err := eventbustest.ExpectExactly(w,
 			eqUpdate(appctype.RouteUpdate{
 				Advertise:   prefixes("192.0.2.0/24"),
-				Unadvertise: prefixes("192.0.2.1/32"),
+				Unadvertise: prefixes("192.0.2.1/32", "192.0.2.2/32"),
 			}),
 			eventbustest.Type[appctype.RouteInfo](),
 		); err != nil {
```

---

### Incident Patch 4: `d33279d7` (2026-10-01)
**Commit Message**: tstest/natlab/vmtest: wait for tailscaled to break race with tta (#21472)

The agent and tailscaled are started concurrently by gokrazy and
tta can win that race, in which case it answers 502 Bad Gateway
because tailscaled.sock does not exist yet.

This is most likely to be seen on slower machines using TCG.

Updates #cleanup

Change-Id: I4012bd189adfb2565470c814204fcf18545f1017
Signed-off-by: Francois Marier <[REDACTED_EMAIL]>

**File**: `tstest/natlab/vmtest/vmtest.go` (modified, +11/-4)
```diff
@@ -750,8 +750,14 @@ func (e *Env) Start() {
 			aStep.Begin()
 			t.Logf("[%s] waiting for agent...", n.name)
 			if n.joinTailnet {
-				st, err := n.agent.Status(ctx)
-				if err != nil {
+				// gokrazy starts tta and tailscaled concurrently. If tta wins,
+				// it answers 502 until tailscaled.sock exists.
+				var st *ipnstate.Status
+				if err := tstest.WaitFor(tailscaleUpTimeout, func() error {
+					var statusErr error
+					st, statusErr = n.agent.Status(ctx)
+					return statusErr
+				}); err != nil {
 					return fmt.Errorf("[%s] agent status: %w", n.name, err)
 				}
 				t.Logf("[%s] agent connected, backend state: %s", n.name, st.BackendState)
@@ -839,8 +845,9 @@ func (e *Env) Start() {
 	}
 }
 
-// tailscaleUpTimeout bounds one node's "tailscale up" in [Env.Start]. It
-// is far above the roughly one second the command takes against the
+// tailscaleUpTimeout bounds one node's "tailscale up" in [Env.Start]
+// and the initial agent.Status.
+// It is far above the roughly one second the command takes against the
 // in-process control server, and far below the test's overall context.
 const tailscaleUpTimeout = 90 * time.Second
 
```

---

### Incident Patch 5: `b0e35bf5` (2026-09-29)
**Commit Message**: util/cmpver: don't panic on numbers that overflow a uint64

Compare parsed each numeric field with strconv.ParseUint and panicked
if that failed, so a version with a field of 20 or more digits, such as
a long build stamp, crashed the caller.

Compare digit runs by length after trimming leading zeros, then
lexically. This gives the same results as before for numbers that fit
in a uint64 and works for numbers of any length.

Fixes #21532

Signed-off-by: Raphael Fakhri <[REDACTED_EMAIL]>

**File**: `util/cmpver/version.go` (modified, +22/-37)
```diff
@@ -18,11 +18,7 @@
 // version numbers don't need it.
 package cmpver
 
-import (
-	"fmt"
-	"strconv"
-	"strings"
-)
+import "strings"
 
 // Less reports whether v1 is less than v2.
 //
@@ -53,11 +49,7 @@ func notnum(r rune) bool {
 //	                == 0  if v1 == v2
 //	                 > 0  if v1  > v2
 func Compare(v1, v2 string) int {
-	var (
-		f1, f2 string
-		n1, n2 uint64
-		err    error
-	)
+	var f1, f2 string
 	for v1 != "" || v2 != "" {
 		// Compare the non-numeric character run lexicographically.
 		f1, v1 = splitPrefixFunc(v1, notnum)
@@ -71,33 +63,11 @@ func Compare(v1, v2 string) int {
 		f1, v1 = splitPrefixFunc(v1, isnum)
 		f2, v2 = splitPrefixFunc(v2, isnum)
 
-		// ParseUint refuses to parse empty strings, which would only
-		// happen if we reached end-of-string. We follow the Debian
-		// convention that empty strings mean zero, because
-		// empirically that produces reasonable-feeling comparison
-		// behavior.
-		n1 = 0
-		if f1 != "" {
-			n1, err = strconv.ParseUint(f1, 10, 64)
-			if err != nil {
-				panic(fmt.Sprintf("all-number string %q didn't parse as string: %s", f1, err))
-			}
-		}
-
-		n2 = 0
-		if f2 != "" {
-			n2, err = strconv.ParseUint(f2, 10, 64)
-			if err != nil {
-				panic(fmt.Sprintf("all-number string %q didn't parse as string: %s", f2, err))
-			}
-		}
-
-		switch {
-		case n1 == n2:
-		case n1 < n2:
-			return -1
-		case n1 > n2:
-			return 1
+		// Compare the digit runs numerically. Empty strings mean zero,
+		// which follows the Debian convention because empirically that
+		// produces reasonable-feeling comparison behavior.
+		if res := compareDigits(f1, f2); res != 0 {
+			return res
 		}
 	}
 
@@ -106,6 +76,21 @@ func Compare(v1, v2 string) int {
 	return 0
 }
 
+// compareDigits compares two strings of ASCII digits by numeric value and
+// returns -1, 0 or 1. Unlike parsing the strings as integers, it has no
+// limit on the length of the numbers. An empty string is treated as zero.
+func compareDigits(a, b string) int {
+	a = strings.TrimLeft(a, "0")
+	b = strings.TrimLeft(b, "0")
+	if len(a) != len(b) {
+		if len(a) < len(b) {
+			return -1
+		}
+		return 1
+	}
+	return strings.Compare(a, b)
+}
+
 // splitPrefixFunc splits s at the first rune where f(rune) is false.
 func splitPrefixFunc(s string, f func(rune) bool) (string, string) {
 	for i, r := range s {
```

**File**: `util/cmpver/version_test.go` (modified, +21/-0)
```diff
@@ -108,6 +108,27 @@ func TestCompare(t *testing.T) {
 			want: -1,
 		},
 
+		{
+			// Numbers too large for a uint64 must compare by value
+			// instead of panicking.
+			name: "number-exceeds-uint64",
+			v1:   "1.18446744073709551616",
+			v2:   "1.18446744073709551615",
+			want: 1,
+		},
+		{
+			name: "very-long-numbers",
+			v1:   "99999999999999999999999999999999",
+			v2:   "100000000000000000000000000000000",
+			want: -1,
+		},
+		{
+			name: "leading-zeros",
+			v1:   "1.0007.00",
+			v2:   "1.7.0",
+			want: 0,
+		},
+
 		// A few specific OS version tests below.
 		{
 			name: "windows-version",
```

---

### Incident Patch 6: `5d5607fe` (2026-09-30)
**Commit Message**: ipn/ipnlocal: use more buildfeatures consts so the linker drops dead code

Several features with ts_omit build tags were still linked into
minimal builds because LocalBackend called into them unconditionally,
so the linker couldn't prove them unreachable. Guard those call sites
with their buildfeatures constants:

  * app connectors: only subscribe to route update and store events
    when app connectors are included; appc is their only publisher.
    This also drops AdvertiseRoute and UnadvertiseRoute.
  * client update: only subscribe to the tailnet default auto-update
    event when auto-updates are supported, as that's all it affects.
  * syspolicy: only register the policy change watch when system
    policy support is included.
  * advertise routes and exit nodes: only validate AdvertiseRoutes
    when one of the two features is included.
  * netstack: only netstack consults the intercepted TCP ports, so
    don't build the port matching func without it.
  * ssh: don't check SSH prefs, report the "SSH on but unusable"
    health message, or intercept port 22 without SSH support. The
    RunSSH pref is still accepted without effect, as before; port 22
    was previously interc

**File**: `ipn/ipnlocal/local.go` (modified, +47/-17)
```diff
@@ -643,14 +643,18 @@ func NewLocalBackend(logf logger.Logf, logID logid.PublicID, sys *tsd.System, lo
 	}
 	b.pm.SetExtensionHost(b.extHost)
 
-	if b.unregisterSysPolicyWatch, err = b.registerSysPolicyWatch(); err != nil {
-		return nil, err
-	}
-	defer func() {
-		if err != nil {
-			b.unregisterSysPolicyWatch()
+	if buildfeatures.HasSystemPolicy {
+		if b.unregisterSysPolicyWatch, err = b.registerSysPolicyWatch(); err != nil {
+			return nil, err
 		}
-	}()
+		defer func() {
+			if err != nil {
+				b.unregisterSysPolicyWatch()
+			}
+		}()
+	} else {
+		b.unregisterSysPolicyWatch = func() {}
+	}
 
 	netMon := sys.NetMon.Get()
 	b.sockstatLogger, err = sockstatlog.NewLogger(logpolicy.LogsDir(logf), logf, logID, netMon, sys.HealthTracker.Get(), sys.Bus.Get())
@@ -707,9 +711,11 @@ func NewLocalBackend(logf logger.Logf, logID logid.PublicID, sys *tsd.System, lo
 	ec := b.Sys().Bus.Get().Client("ipnlocal.LocalBackend")
 	b.eventClient = ec
 	eventbus.SubscribeFunc(ec, b.onClientVersion)
-	eventbus.SubscribeFunc(ec, func(au controlclient.AutoUpdate) {
-		b.onTailnetDefaultAutoUpdate(au.Value)
-	})
+	if buildfeatures.HasClientUpdate {
+		eventbus.SubscribeFunc(ec, func(au controlclient.AutoUpdate) {
+			b.onTailnetDefaultAutoUpdate(au.Value)
+		})
+	}
 	eventbus.SubscribeFunc(ec, func(cd netmon.ChangeDelta) { b.linkChange(&cd) })
 	b.refreshInterfaceState(netMon)
 	if buildfeatures.HasHealth {
@@ -718,8 +724,10 @@ func NewLocalBackend(logf logger.Logf, logID logid.PublicID, sys *tsd.System, lo
 	if buildfeatures.HasPortList {
 		eventbus.SubscribeFunc(ec, b.setPortlistServices)
 	}
-	eventbus.SubscribeFunc(ec, b.onAppConnectorRouteUpdate)
-	eventbus.SubscribeFunc(ec, b.onAppConnectorStoreRoutes)
+	if buildfeatures.HasAppConnectors {
+		eventbus.SubscribeFunc(ec, b.onAppConnectorRouteUpdate)
+		eventbus.SubscribeFunc(ec, b.onAppConnectorStoreRoutes)
+	}
 	eventbus.SubscribeFunc(ec, b.onHomeDERPUpdate)
 	mConn.SetNetInfoCallback(b.setNetInfo) // TODO(tailscale/tailscale#17887): move to eventbus
 
@@ -3434,7 +3442,12 @@ func (b *LocalBackend) updateFilterLocked(prefs ipn.PrefsView) {
 		}
 		packetFilter = cn.PacketFilter()
 
-		if cn.unlockedNodesPermitted(packetFilter) {
+		// Peers marked UnsignedPeerAPIOnly are exempt from tailnet
+		// lock's signature checks, so make sure control didn't also
+		// grant them network access. Without tailnet lock support,
+		// all peers from control are trusted and there's nothing to
+		// check.
+		if buildfeatures.HasTailnetLock && cn.unlockedNodesPermitted(packetFilter) {
 			b.health.SetUnhealthy(invalidPacketFilterWarnable, nil)
 			packetFilter = nil
 		} else {
@@ -4576,6 +4589,10 @@ func generateInterceptTCPPortFunc(ports []uint16) func(uint16) bool {
 // efficient func for ShouldInterceptTCPPort to use, which is called on every
 // incoming packet.
 func (b *LocalBackend) setTCPPortsIntercepted(ports []uint16) {
+	if !buildfeatures.HasNetstack {
+		// Only netstack intercepts ports; see ShouldInterceptTCPPort.
+		return
+	}
 	b.shouldInterceptTCPPortAtomic.Store(generateInterceptTCPPortFunc(ports))
 }
 
@@ -5017,14 +5034,18 @@ func (b *LocalBackend) checkPrefsLocked(p *ipn.Prefs) error {
 	if err := b.checkAutoUpdatePrefsLocked(p); err != nil {
 		errs = append(errs, err)
 	}
-	if err := checkAdvertiseRoutes(p); err != nil {
-		errs = append(errs, err)
+	if buildfeatures.HasAdvertiseRoutes || buildfeatures.HasAdvertiseExitNode {
+		if err := checkAdvertiseRoutes(p); err != nil {
+			errs = append(errs, err)
+		}
 	}
 	return errors.Join(errs...)
 }
 
 func (b *LocalBackend) checkSSHPrefsLocked(p *ipn.Prefs) error {
-	if !p.RunSSH {
+	if !buildfeatures.HasSSH || !p.RunSSH {
+		// Without SSH support, the RunSSH pref is accepted but has
+		// no effect, as it never did.
 		return nil
 	}
 	if err := featureknob.CanRunTailscaleSSH(); err != nil {
@@ -5047,6 +5068,9 @@ func (b *LocalBackend) checkSSHPrefsLocked(p *ipn.Prefs) error {
 }
 
 func (b *LocalBackend) sshOnButUnusableHealthCheckMessageLocked() (healthMessage string) {
+	if !buildfeatures.HasSSH {
+		return ""
+	}
 	if p := b.pm.CurrentPrefs(); !p.Valid() || !p.RunSSH() {
 		return ""
 	}
@@ -7084,6 +7108,9 @@ func (b *LocalBackend) ShouldExposeRemoteWebClient() bool {
 // b.mu must be held.
 func (b *LocalBackend) setWebClientAtomicBoolLocked(caps set.Set[nodecap.Cap]) {
 	syncs.RequiresMutex(&b.mu)
+	if !buildfeatures.HasWebClient {
+		return
+	}
 
 	shouldRun := !caps.Contains(nodecap.DisableWebClient)
 	wasRunning := b.webClientAtomicBool.Swap(shouldRun)
@@ -7581,7 +7608,7 @@ func (b *LocalBackend) setDebugLogsByCapabilityLocked(caps set.Set[nodecap.Cap])
 func (b *LocalBackend) setTCPPortsInterceptedFromNetmapAndPrefsLocked(prefs ipn.PrefsView) {
 	handlePorts := make([]uint16, 0, 4)
 
-	if prefs.Valid() && prefs.RunSSH() && envknob.CanSSHD() {
+	if buildfeatures.HasSSH && prefs.Valid() && prefs.RunSSH() && envknob.CanSSHD() {
 		handlePorts = append(handlePorts, 22)
 	}
 	if b.ShouldExposeRemoteWebClient(
```

---

### Incident Patch 7: `654c105f` (2026-09-30)
**Commit Message**: tstest/natlab/vmtest, gokrazy, cmd/tailscale/cli: add minimal-build vmtests

Add vmtests that boot pairs of gokrazy VMs whose tailscale and tailscaled
are minimal builds and check that IP traffic flows between them over
WireGuard, so we notice if a minimal build stops doing its one job:
build_dist.sh --extra-small (direct path through NATs), that minus NAT
traversal (DERP across NATs, direct on a shared LAN), and DERP-only.

They found that "tailscale up" built with ts_omit_ipnbus returned before
calling Start or EditPrefs, making it a no-op. Fix that, and have it wait
for the Running state by polling tailscaled's status instead of watching
the IPN bus, so scripts can rely on it as with normal builds.

The extra-small feature list moves to featuretags.ExtraSmall so
build_dist.sh (via a new "featuretags --extra-small") and vmtest share
it. The gokrazy builder gains --output and --go-build-tags flags to build
the variant images, and natlabprep --gokrazy prebuilds them all for CI.

Updates #13038
Updates #12614

Signed-off-by: Brad Fitzpatrick <[REDACTED_EMAIL]>
Change-Id: I0caa2c7b3adf2399da09b6d07a942f1dc34e8486

**File**: `.github/workflows/natlab-test.yml` (modified, +4/-2)
```diff
@@ -110,10 +110,12 @@ jobs:
         run: |
           ./tool/go run ./tstest/natlab/vmtest/cmd/natlabprep
 
-      - name: Build gokrazy VM image
+      # This also builds the minimal-feature gokrazy variants, which warms
+      # the Go build cache for their tagged tailscale and tailscaled.
+      - name: Build gokrazy VM images
         if: steps.gokrazy-cache.outputs.cache-hit != 'true'
         run: |
-          make -C gokrazy natlab
+          ./tool/go run ./tstest/natlab/vmtest/cmd/natlabprep --gokrazy
 
       # No Go source imports this module, so nothing above fetches it. Pulling
       # it here puts it in the module cache the matrix jobs restore.
```

**File**: `build_dist.sh` (modified, +1/-1)
```diff
@@ -41,7 +41,7 @@ while [ "$#" -gt 1 ]; do
 		fi
 		shift
 		ldflags="$ldflags -w -s"
-		tags="${tags:+$tags,},$(GOOS= GOARCH= $go run ./cmd/featuretags --min --add=osrouter,nattraversal)"
+		tags="${tags:+$tags,},$(GOOS= GOARCH= $go run ./cmd/featuretags --extra-small)"
 		;;
 	--min)
 	    # --min is like --extra-small but even smaller, removing all features,
```

**File**: `cmd/featuretags/featuretags.go` (modified, +18/-0)
```diff
@@ -22,11 +22,29 @@ var (
 	remove = flag.String("remove", "", "a comma-separated list of features to remove from the build. (without the 'ts_omit_' prefix)")
 	add    = flag.String("add", "", "a comma-separated list of features or tags to add, if --min is used.")
 	list   = flag.Bool("list", false, "if true, list all known features and what they do")
+
+	extraSmall = flag.Bool("extra-small", false, "shorthand for build_dist.sh --extra-small's tags: --min --add="+joinFeatures(featuretags.ExtraSmall))
 )
 
+func joinFeatures(fts []featuretags.FeatureTag) string {
+	var ss []string
+	for _, ft := range fts {
+		ss = append(ss, string(ft))
+	}
+	return strings.Join(ss, ",")
+}
+
 func main() {
 	flag.Parse()
 
+	if *extraSmall {
+		if *min || *add != "" {
+			log.Fatalf("--extra-small can't be combined with --min or --add")
+		}
+		*min = true
+		*add = joinFeatures(featuretags.ExtraSmall)
+	}
+
 	features := featuretags.Features
 
 	if *list {
```

**File**: `cmd/tailscale/cli/up.go` (modified, +47/-10)
```diff
@@ -608,21 +608,36 @@ func runUp(ctx context.Context, cmd string, args []string, upArgs upArgsT) (retE
 		}
 	}()
 
-	if !buildfeatures.HasIPNBus {
-		fmt.Fprintln(Stderr, "binary built with ts_omit_ipnbus; not waiting for completion")
-		return nil
-	}
-
 	// Start watching the IPN bus before we call Start() or StartLoginInteractive(),
 	// or we could miss IPN notifications.
 	//
 	// In particular, if we're doing a force-reauth, we could miss the
 	// notification with the auth URL we should print for the user.
-	watcher, err := localClient.WatchIPNBus(watchCtx, 0)
-	if err != nil {
-		return err
+	//
+	// Binaries built without the IPN bus instead poll tailscaled's status
+	// once the loop below starts reading.
+	var nextNotify func() (ipn.Notify, error)
+	if buildfeatures.HasIPNBus {
+		watcher, err := localClient.WatchIPNBus(watchCtx, 0)
+		if err != nil {
+			return err
+		}
+		defer watcher.Close()
+		nextNotify = watcher.Next
+	} else {
+		var polled bool
+		nextNotify = func() (ipn.Notify, error) {
+			if polled {
+				select {
+				case <-watchCtx.Done():
+					return ipn.Notify{}, watchCtx.Err()
+				case <-time.After(250 * time.Millisecond):
+				}
+			}
+			polled = true
+			return statusNotify(watchCtx)
+		}
 	}
-	defer watcher.Close()
 
 	// Special case: bare "tailscale up" means to just start
 	// running, if there's ever been a login.
@@ -728,7 +743,7 @@ func runUp(ctx context.Context, cmd string, args []string, upArgs upArgsT) (retE
 		}
 
 		for {
-			n, err := watcher.Next()
+			n, err := nextNotify()
 			if err != nil {
 				watchErr <- err
 				return
@@ -833,6 +848,28 @@ func runUp(ctx context.Context, cmd string, args []string, upArgs upArgsT) (retE
 	}
 }
 
+// statusNotify returns an IPN notification synthesized from tailscaled's
+// current status, with the fields that runUp's wait loop reads: the
+// backend state, the auth URL, and the node key. It's how "tailscale up"
+// waits in binaries built without the IPN bus.
+func statusNotify(ctx context.Context) (ipn.Notify, error) {
+	st, err := localClient.StatusWithoutPeers(ctx)
+	if err != nil {
+		return ipn.Notify{}, err
+	}
+	var n ipn.Notify
+	if state, ok := ipn.StateFromString(st.BackendState); ok {
+		n.State = &state
+	}
+	if st.AuthURL != "" {
+		n.BrowseToURL = &st.AuthURL
+	}
+	if st.Self != nil {
+		n.SelfChange = &tailcfg.Node{Key: st.Self.PublicKey}
+	}
+	return n, nil
+}
+
 func printDeviceApprovalInfo(printJson bool, prefs *ipn.Prefs, lastURLPrinted *string) {
 	if printJson {
 		printUpDoneJSON(ipn.NeedsMachineAuth, "")
```

**File**: `feature/featuretags/featuretags.go` (modified, +5/-0)
```diff
@@ -66,6 +66,11 @@ func RequiredBy(ft FeatureTag) set.Set[FeatureTag] {
 	return s
 }
 
+// ExtraSmall is the set of features kept by build_dist.sh --extra-small
+// (via cmd/featuretags --extra-small), the smallest build that's still a
+// useful tailscaled. Pass it to [MinTags] to get its build tags.
+var ExtraSmall = []FeatureTag{"osrouter", "nattraversal"}
+
 // MinTags returns the sorted Go build tags for a minimal build that
 // includes only the features in keep and the features they require.
 // Every other omittable feature in [Features] gets its ts_omit_ tag, and
```

**File**: `gokrazy/Makefile` (modified, +9/-0)
```diff
@@ -24,6 +24,15 @@ natlab:
 	../tool/go run build.go --build --app=natlabapp
 	qemu-img convert -O qcow2 natlabapp.img natlabapp.qcow2
 
+# Like natlab, but with tailscale and tailscaled built with the Go build
+# tags in $(TAGS), writing natlabapp-$(NAME).qcow2. tstest/natlab/vmtest
+# uses this for its minimal-feature gokrazy images (e.g. GokrazyExtraSmall).
+natlab-tagged:
+	../tool/go run build.go --build --app=natlabapp --output=natlabapp-$(NAME) \
+		--go-build-tags=tailscale.com/cmd/tailscale=$(TAGS) \
+		--go-build-tags=tailscale.com/cmd/tailscaled=$(TAGS)
+	qemu-img convert -O qcow2 natlabapp-$(NAME).img natlabapp-$(NAME).qcow2
+
 # For natlab integration tests on macOS arm64:
 natlab-arm64:
 	../tool/go run build.go --build --app=natlabapp.arm64
```

**File**: `gokrazy/build.go` (modified, +19/-0)
```diff
@@ -15,9 +15,11 @@ package main
 import (
 	"context"
 	"encoding/json"
+	"errors"
 	"flag"
 	"log"
 	"os"
+	"strings"
 
 	"tailscale.com/gokrazy/build"
 )
@@ -29,8 +31,22 @@ var (
 	gaf        = flag.Bool("gaf", false, "if true, build a gokrazy archive format file instead of a full disk image")
 	jsonOut    = flag.Bool("json", false, "emit one machine-readable JSON result line to stdout")
 	region     = flag.String("region", "", "AWS region for import+register; default us-east-1 (honors $AWS_REGION)")
+	output     = flag.String("output", "", "base name of the .img or .gaf file to write; default is --app")
+
+	goBuildTags = map[string][]string{}
 )
 
+func init() {
+	flag.Func("go-build-tags", "PKG=TAG1,TAG2 to build Go package PKG with the given build tags, overriding config.json; may be repeated", func(v string) error {
+		pkg, tags, ok := strings.Cut(v, "=")
+		if !ok || pkg == "" {
+			return errors.New("want PKG=TAG1,TAG2")
+		}
+		goBuildTags[pkg] = strings.Split(tags, ",")
+		return nil
+	})
+}
+
 func main() {
 	flag.Parse()
 
@@ -57,6 +73,9 @@ func run(ctx context.Context) (build.Result, error) {
 		App:    *app,
 		Bucket: *bucket,
 		Region: build.ResolveRegion(*region, os.Getenv("AWS_REGION")),
+
+		Output:      *output,
+		GoBuildTags: goBuildTags,
 	})
 	if err != nil {
 		return build.Result{App: *app, Error: err.Error()}, err
```

**File**: `gokrazy/build/build.go` (modified, +77/-5)
```diff
@@ -17,6 +17,7 @@
 package build
 
 import (
+	"cmp"
 	"context"
 	"encoding/json"
 	"fmt"
@@ -80,6 +81,15 @@ type Config struct {
 	// in. Empty means ResolveRegion("", $AWS_REGION).
 	Region string
 
+	// Output is the base name (without extension) of the .img or .gaf
+	// file written into Dir. Empty means App.
+	Output string
+
+	// GoBuildTags, if non-empty, maps Go package import paths to the Go
+	// build tags to build them with, replacing any GoBuildTags that the
+	// app's config.json sets for those packages.
+	GoBuildTags map[string][]string
+
 	// Logf receives human-readable progress. If nil, log.Printf is used.
 	Logf logger.Logf
 	// Stderr receives the output of subprocesses (monogok). If nil,
@@ -306,15 +316,23 @@ func (b *Builder) buildImage(ctx context.Context, gaf bool) error {
 	}
 
 	args := []string{"run", "github.com/bradfitz/monogok/cmd/monogok"}
+	if len(b.GoBuildTags) > 0 {
+		confPath, err := b.writeTaggedConfig(appDir)
+		if err != nil {
+			return err
+		}
+		defer os.Remove(confPath)
+		args = append(args, "--config", confPath)
+	}
 	if gaf {
 		args = append(args,
 			"overwrite",
-			"--gaf", filepath.Join(b.Dir, b.App+".gaf"),
+			"--gaf", b.outPath(".gaf"),
 		)
 	} else {
 		args = append(args,
 			"overwrite",
-			"--full", filepath.Join(b.Dir, b.App+".img"),
+			"--full", b.outPath(".img"),
 			fmt.Sprintf("--target_storage_bytes=%d", imageSizeBytesFor(b.App)),
 		)
 	}
@@ -327,11 +345,11 @@ func (b *Builder) buildImage(ctx context.Context, gaf bool) error {
 		return err
 	}
 	if gaf {
-		b.res.GAF = filepath.Join(b.Dir, b.App+".gaf")
+		b.res.GAF = b.outPath(".gaf")
 		return nil
 	}
 
-	imgPath := filepath.Join(b.Dir, b.App+".img")
+	imgPath := b.outPath(".img")
 	f, err := os.OpenFile(imgPath, os.O_RDWR, 0)
 	if err != nil {
 		return fmt.Errorf("open %s: %w", imgPath, err)
@@ -345,6 +363,60 @@ func (b *Builder) buildImage(ctx context.Context, gaf bool) error {
 	return nil
 }
 
+// outPath returns the path in Dir of the build output with the given
+// extension (".img" or ".gaf").
+func (b *Builder) outPath(ext string) string {
+	return filepath.Join(b.Dir, cmp.Or(b.Output, b.App)+ext)
+}
+
+// writeTaggedConfig writes a copy of appDir's config.json with b.GoBuildTags
+// applied and returns its path, which the caller must remove. The copy is
+// written into appDir because monogok finds the module root by walking up
+// from the config file's directory.
+func (b *Builder) writeTaggedConfig(appDir string) (string, error) {
+	confJSON, err := os.ReadFile(filepath.Join(appDir, "config.json"))
+	if err != nil {
+		return "", err
+	}
+	// Decode into generic maps so fields this package doesn't know about
+	// are preserved.
+	var conf map[string]any
+	if err := json.Unmarshal(confJSON, &conf); err != nil {
+		return "", fmt.Errorf("unmarshaling config.json: %w", err)
+	}
+	pkgConfs, _ := conf["PackageConfig"].(map[string]any)
+	if pkgConfs == nil {
+		pkgConfs = map[string]any{}
+		conf["PackageConfig"] = pkgConfs
+	}
+	for pkg, tags := range b.GoBuildTags {
+		pc, _ := pkgConfs[pkg].(map[string]any)
+		if pc == nil {
+			pc = map[string]any{}
+			pkgConfs[pkg] = pc
+		}
+		pc["GoBuildTags"] = tags
+	}
+	out, err := json.MarshalIndent(conf, "", "    ")
+	if err != nil {
+		return "", err
+	}
+	f, err := os.CreateTemp(appDir, ".config-*.json")
+	if err != nil {
+		return "", err
+	}
+	if _, err := f.Write(out); err != nil {
+		f.Close()
+		os.Remove(f.Name())
+		return "", err
+	}
+	if err := f.Close(); err != nil {
+		os.Remove(f.Name())
+		return "", err
+	}
+	return f.Name(), nil
+}
+
 // UploadToS3 uploads the built image to s3://<Bucket>/<App>.img (a
 // concurrent multipart upload, progress on b.Stderr) and returns the URI
 // (also in Result.S3). Requires BuildImage first.
@@ -356,7 +428,7 @@ func (b *Builder) UploadToS3(ctx context.Context) (s3URI string, err error) {
 	if err != nil {
 		return "", err
 	}
-	imgPath := filepath.Join(b.Dir, b.App+".img")
+	imgPath := b.res.Image
 	f, err := os.Open(imgPath)
 	if err != nil {
 		return "", fmt.Errorf("open %s: %w", imgPath, err)
```

---

### Incident Patch 8: `5e21c7cc` (2026-09-29)
**Commit Message**: logtail: remove LowMemory mode

LowMemory shrank the pending ring buffer, upload batch size, and text
truncation limit for iOS, back when network extensions were limited to
15 MB. All supported iOS versions now allow 50 MB, so the savings are
negligible and the extra code paths are not worth maintaining.

Fixes #13685

Change-Id: Ic0c26f899ce00f105399c7b1e687e2b92194687e
Co-authored-by: Brad Fitzpatrick <[REDACTED_EMAIL]>
Signed-off-by: Andrea Gottardo <[REDACTED_EMAIL]>

**File**: `logtail/config.go` (modified, +0/-1)
```diff
@@ -32,7 +32,6 @@ type Config struct {
 	BaseURL        string          // if empty defaults to "https://log.tailscale.com"
 	HTTPC          *http.Client    // if empty defaults to http.DefaultClient
 	SkipClientTime bool            // if true, client_time is not written to logs
-	LowMemory      bool            // if true, logtail minimizes memory use
 	Clock          tstime.Clock    // if set, Clock.Now substitutes uses of time.Now
 	Stderr         io.Writer       // if set, logs are sent here instead of os.Stderr
 	Bus            *eventbus.Bus   // if set, uses the eventbus for awaitInternetUp instead of callback
```

**File**: `logtail/logtail.go` (modified, +2/-25)
```diff
@@ -51,9 +51,6 @@ const maxSize = 256 << 10
 // Note that JSON log messages can be as large as maxSize.
 const maxTextSize = 16 << 10
 
-// lowMemRatio reduces maxSize and maxTextSize by this ratio in lowMem mode.
-const lowMemRatio = 4
-
 // bufferSize is the typical buffer size to retain.
 // It is large enough to handle most log messages,
 // but not too large to be a notable waste of memory if retained forever.
@@ -76,11 +73,7 @@ func newLogger(cfg Config) *Logger {
 		cfg.Stderr = os.Stderr
 	}
 	if cfg.Buffer == nil {
-		pendingSize := 256
-		if cfg.LowMemory {
-			pendingSize = 64
-		}
-		cfg.Buffer = NewMemoryBuffer(pendingSize)
+		cfg.Buffer = NewMemoryBuffer(256)
 	}
 	var procID uint32
 	if cfg.IncludeProcID {
@@ -113,7 +106,6 @@ func newLogger(cfg Config) *Logger {
 		stderrLevel:    int64(cfg.StderrLevel),
 		httpc:          cfg.HTTPC,
 		url:            cfg.BaseURL + "/c/" + cfg.Collection + "/" + cfg.PrivateID.String() + urlSuffix,
-		lowMem:         cfg.LowMemory,
 		buffer:         cfg.Buffer,
 		maxUploadSize:  cfg.MaxUploadSize,
 		skipClientTime: cfg.SkipClientTime,
@@ -217,9 +209,6 @@ func UploadLogs[T any](ctx context.Context, conf Config, entries iter.Seq[LogEnt
 	lg := newLogger(conf)
 
 	maxLen := cmp.Or(lg.maxUploadSize, maxSize)
-	if lg.lowMem {
-		maxLen /= lowMemRatio
-	}
 
 	// body accumulates a JSON array of encoded entries: "[e1,e2,...]".
 	// The framing mirrors Logger.drainPending.
@@ -302,7 +291,6 @@ type Logger struct {
 	stderrLevel    int64 // accessed atomically
 	httpc          *http.Client
 	url            string
-	lowMem         bool
 	skipClientTime bool
 	netMonitor     *netmon.Monitor
 	buffer         Buffer
@@ -457,13 +445,6 @@ func (lg *Logger) drainPending() (b []byte) {
 	}()
 
 	maxLen := cmp.Or(lg.maxUploadSize, maxSize)
-	if lg.lowMem {
-		// When operating in a low memory environment, it is better to upload
-		// in multiple operations than it is to allocate a large body and OOM.
-		// Even if maxLen is less than maxSize, we can still upload an entry
-		// that is up to maxSize if we happen to encounter one.
-		maxLen /= lowMemRatio
-	}
 	for len(b) < maxLen {
 		line, err := lg.buffer.TryReadLine()
 		switch {
@@ -882,12 +863,8 @@ func (lg *Logger) appendText(dst, src []byte, skipClientTime bool, procID uint32
 
 	// Append the text string, which may be truncated.
 	// Invalid UTF-8 will be mangled with the Unicode replacement character.
-	max := maxTextSize
-	if lg.lowMem {
-		max /= lowMemRatio
-	}
 	dst = append(dst, `"text":`...)
-	dst = appendTruncatedString(dst, src, max)
+	dst = appendTruncatedString(dst, src, maxTextSize)
 	return append(dst, "}\n"...)
 }
 
```

**File**: `logtail/logtail_test.go` (modified, +1/-3)
```diff
@@ -759,7 +759,6 @@ func TestAppendText(t *testing.T) {
 	var lg Logger
 	lg.clock = tstest.NewClock(tstest.ClockOpts{Start: time.Date(2000, 01, 01, 0, 0, 0, 0, time.UTC)})
 	lg.metricsDelta = func() string { return "metrics" }
-	lg.lowMem = true
 
 	for _, tt := range []struct {
 		text           string
@@ -774,7 +773,7 @@ func TestAppendText(t *testing.T) {
 		{skipClientTime: true, procID: 1, procSeq: 2, want: `{"logtail":{"proc_id":1,"proc_seq":2},"metrics":"metrics"}`},
 		{text: "fizz buzz", want: `{"logtail":{"client_time":"2000-01-01T00:00:00Z"},"metrics":"metrics","text":"fizz buzz"}`},
 		{text: "\b\f\n\r\t\"\\", want: `{"logtail":{"client_time":"2000-01-01T00:00:00Z"},"metrics":"metrics","text":"\b\f\n\r\t\"\\"}`},
-		{text: "x" + strings.Repeat("😐", maxSize), want: `{"logtail":{"client_time":"2000-01-01T00:00:00Z"},"metrics":"metrics","text":"x` + strings.Repeat("😐", 1023) + `…+1044484"}`},
+		{text: "x" + strings.Repeat("😐", maxSize), want: `{"logtail":{"client_time":"2000-01-01T00:00:00Z"},"metrics":"metrics","text":"x` + strings.Repeat("😐", 4095) + `…+1032196"}`},
 	} {
 		got := string(lg.appendText(nil, []byte(tt.text), tt.skipClientTime, tt.procID, tt.procSeq, tt.level))
 		if !strings.HasSuffix(got, "\n") {
@@ -794,7 +793,6 @@ func TestAppendTextOrJSON(t *testing.T) {
 	var lg Logger
 	lg.clock = tstest.NewClock(tstest.ClockOpts{Start: time.Date(2000, 01, 01, 0, 0, 0, 0, time.UTC)})
 	lg.metricsDelta = func() string { return "metrics" }
-	lg.lowMem = true
 
 	for _, tt := range []struct {
 		in    string
```

---

### Incident Patch 9: `7649cf95` (2026-09-29)
**Commit Message**: version/mkversion: fix commit date lookup in the tailscale.com checkout path

infoFromDir passed --format=%%ct to git log, which git renders as the
literal string "%ct", so VersionInfo.GitDate was never a timestamp for
builds made directly from a tailscale.com checkout. The corp path in
infoFromCache already used the correct %ct.

Updates tailscale/corp#44945

Change-Id: I28d193019a8dd3d2bdd165da5e4584df1964afd6
Signed-off-by: Brad Fitzpatrick <[REDACTED_EMAIL]>

**File**: `version/mkversion/mkversion.go` (modified, +1/-1)
```diff
@@ -419,7 +419,7 @@ func infoFromDir(dir string) (verInfo, error) {
 	if err != nil {
 		return verInfo{}, err
 	}
-	date, err := r.output("git", "log", "-n1", "--format=%%ct", "HEAD")
+	date, err := r.output("git", "log", "-n1", "--format=%ct", "HEAD")
 	if err != nil {
 		return verInfo{}, err
 	}
```

---

### Incident Patch 10: `eb79f3e3` (2026-09-29)
**Commit Message**: tstest/natlab/vmtest: fix test flake

It's possible for multiple direct connections to be counted and
these tests are successful as long as it's more than one.

Fixes #21578

Change-Id: I979efc92a43f78d0e51d602d96e61828e6fabdff
Signed-off-by: Francois Marier <[REDACTED_EMAIL]>

**File**: `tstest/natlab/vmtest/vmtest_test.go` (modified, +17/-3)
```diff
@@ -1117,6 +1117,20 @@ func checkClientMetrics(t *testing.T, label string, metrics vmtest.ClientMetrics
 	}
 }
 
+// checkClientMetricsAtLeast verifies that each entry in want exists and has at
+// least the given value in metrics.
+func checkClientMetricsAtLeast(t *testing.T, label string, metrics vmtest.ClientMetrics, want map[string]int64) {
+	t.Helper()
+	for name, minValue := range want {
+		got, ok := metrics[name]
+		if !ok {
+			t.Errorf("%s: required metric %q not found", label, name)
+		} else if got.Value < minValue {
+			t.Errorf("%s: metric %q: %v < %v", label, name, got.Value, minValue)
+		}
+	}
+}
+
 // TestCachedNetmapAfterRestart verifies that two nodes with netmap
 // caching enabled (NodeAttrCacheNetworkMaps) can re-establish a direct
 // WireGuard tunnel after both are restarted while the control server is
@@ -1283,7 +1297,7 @@ func TestDirectConnectionWithCachedNetmapOnOneNode(t *testing.T) {
 
 			// After: Verify that we recorded a direct contact on the disconnected node.
 			checkFinalMetrics.Begin()
-			checkClientMetrics(t, "Node A", env.ClientMetrics(a), map[string]int64{
+			checkClientMetricsAtLeast(t, "Node A", env.ClientMetrics(a), map[string]int64{
 				"magicsock_cached_peer_contact_direct": 1,
 			})
 			checkFinalMetrics.End(nil)
@@ -1362,8 +1376,8 @@ func TestDirectConnectionWithCachedNetmapOnTwoNodes(t *testing.T) {
 
 	// After: Verify that we recorded a direct contact on the disconnected node.
 	checkFinalMetrics.Begin()
-	checkClientMetrics(t, "Node A", env.ClientMetrics(a), map[string]int64{
-		"magicsock_cached_peer_contact_direct": 1,
+	checkClientMetricsAtLeast(t, "Node A", env.ClientMetrics(a), map[string]int64{
+		"magicsock_cached_peer_contact_direct":        1,
 		"magicsock_tsmp_disco_key_advertisement_sent": 1,
 	})
 	checkFinalMetrics.End(nil)
```

---

### Incident Patch 11: `5758b2aa` (2026-09-28)
**Commit Message**: derp/derpserver: add app filter, connected-time sort, and JSON output to /debug/clients/

Add three things to the connected clients debug page:

app=NAME narrows any of the existing filters to connections that
advertised that app name, and may be repeated to match any of several
(app=tailcat-server&app=tailcat-client). On its own it applies to all
connections. An empty app= matches connections that sent no app name.
App names in the table link to their filter, and the next-page and
sort links carry the app filter along.

sort=connected walks by connection time, ascending being longest
connected first, with -connected for newest first. The next-page
links use the connection time in Unix nanoseconds as the cursor; by
hand, after= also accepts a duration such as 30m, meaning connections
that have been up that long, which is the natural way to ask for
"everything older than half an hour".

format=json returns the page as a JSON object with the filter
description, the matching connection and key counts, how many
connections remain after the page, the next page's relative URL, and
the client rows, so the page can be walked from curl or a script the
same way a browser follows the next lin

**File**: `derp/derpserver/debugclients.go` (modified, +206/-97)
```diff
@@ -6,6 +6,7 @@ package derpserver
 import (
 	"cmp"
 	"container/heap"
+	"encoding/json"
 	"fmt"
 	"html/template"
 	"net/http"
@@ -25,26 +26,27 @@ const (
 )
 
 // debugClient is a snapshot of one connected client, rendered by
-// [Server.ServeDebugClients].
+// [Server.ServeDebugClients] as an HTML row or a JSON object.
 type debugClient struct {
-	ConnNum   int64
-	Key       key.NodePublic
-	Remote    netip.AddrPort
-	Connected time.Duration // how long the connection has been up
-	Active    bool          // the connection currently receiving packets for Key
-	Dup       bool          // Key has more than one connection
-	Disabled  bool          // sends to this connection are disabled due to dups
-	Home      bool          // client reported this as its preferred (home) DERP
-	MeshPeer  bool
-	NotIdeal  bool
-	Prober    bool
-	Version   int
-	AppName   string
-	RxPkts    uint64 // data packets received from the client
-	RxBytes   uint64
-	TxPkts    uint64 // data packets sent to the client
-	TxBytes   uint64
-	Senders   uint64 // estimated number of unique peers that have sent to it
+	ConnNum     int64          `json:"connNum"`
+	Key         key.NodePublic `json:"key"`
+	Remote      netip.AddrPort `json:"remote"`
+	ConnectedAt time.Time      `json:"connectedAt"`
+	Connected   time.Duration  `json:"connected"` // how long the connection has been up, in nanoseconds in JSON
+	Active      bool           `json:"active"`    // the connection currently receiving packets for Key
+	Dup         bool           `json:"dup"`       // Key has more than one connection
+	Disabled    bool           `json:"disabled"`  // sends to this connection are disabled due to dups
+	Home        bool           `json:"home"`      // client reported this as its preferred (home) DERP
+	MeshPeer    bool           `json:"meshPeer"`
+	NotIdeal    bool           `json:"notIdeal"`
+	Prober      bool           `json:"prober"`
+	Version     int            `json:"version"`
+	AppName     string         `json:"appName"`
+	RxPkts      uint64         `json:"rxPkts"` // data packets received from the client
+	RxBytes     uint64         `json:"rxBytes"`
+	TxPkts      uint64         `json:"txPkts"` // data packets sent to the client
+	TxBytes     uint64         `json:"txBytes"`
+	Senders     uint64         `json:"senders"` // estimated number of unique peers that have sent to it
 }
 
 // debugClientsSort is the order in which [Server.ServeDebugClients]
@@ -54,9 +56,10 @@ type debugClient struct {
 type debugClientsSort int
 
 const (
-	sortClientsByKey  debugClientsSort = iota // node key
-	sortClientsByIP                           // remote address and port
-	sortClientsByConn                         // connection number (accept order)
+	sortClientsByKey       debugClientsSort = iota // node key
+	sortClientsByIP                                // remote address and port
+	sortClientsByConn                              // connection number (accept order)
+	sortClientsByConnected                         // connection time; ascending is longest connected first
 
 	// The traffic counter sorts. They must stay after the sorts
 	// above; see [debugClientsSort.isCounter].
@@ -69,13 +72,14 @@ const (
 // debugClientsSortNames maps each sort to its name in the sort URL
 // parameter.
 var debugClientsSortNames = map[debugClientsSort]string{
-	sortClientsByKey:     "key",
-	sortClientsByIP:      "ip",
-	sortClientsByConn:    "conn",
-	sortClientsByRxBytes: "rx",
-	sortClientsByTxBytes: "tx",
-	sortClientsByRxPkts:  "rxpkts",
-	sortClientsByTxPkts:  "txpkts",
+	sortClientsByKey:       "key",
+	sortClientsByIP:        "ip",
+	sortClientsByConn:      "conn",
+	sortClientsByConnected: "connected",
+	sortClientsByRxBytes:   "rx",
+	sortClientsByTxBytes:   "tx",
+	sortClientsByRxPkts:    "rxpkts",
+	sortClientsByTxPkts:    "txpkts",
 }
 
 func (s debugClientsSort) String() string {
@@ -92,18 +96,25 @@ func (s debugClientsSort) String() string {
 func (s debugClientsSort) isCounter() bool { return s >= sortClientsByRxBytes }
 
 // debugClientsQuery is a parsed /debug/clients/ request: a filter,
-// a walk order, a page size, and optionally a cursor after which the
-// page starts.
+// a walk order, a page size, an output format, and optionally a
+// cursor after which the page starts.
 type debugClientsQuery struct {
-	// Filter. Exactly one of the fields is set.
+	// Primary filter. Exactly one of the fields is set.
 	all  bool
 	ip   netip.Addr
 	cidr netip.Prefix
 	key  key.NodePublic
 
+	// hasApps is whether app name filters were given, in which case a
+	// connection must also have one of the apps names (an empty
+	// string matches connections that sent no app name).
+	hasApps bool
+	apps    []string
+
 	sort  debugClientsSort
 	desc  bool // walk in descending order
 	limit int  // maximum connections per page
+	json  bool // respond with JSON rather than HTML
 
 	// hasAfter is whether a cursor was given. The page then starts
 	// strictly after the cursor 
```

**File**: `derp/derpserver/debugclients_test.go` (modified, +143/-5)
```diff
@@ -4,6 +4,7 @@
 package derpserver
 
 import (
+	"encoding/json"
 	"fmt"
 	"net/http"
 	"net/http/httptest"
@@ -12,6 +13,7 @@ import (
 	"slices"
 	"strings"
 	"testing"
+	"time"
 
 	"tailscale.com/derp"
 	"tailscale.com/types/key"
@@ -54,7 +56,7 @@ func TestServeDebugClients(t *testing.T) {
 	addDebugTestClient(s, k1, "10.1.2.3:1111", derp.ClientInfo{Version: 2, AppName: "one"})
 	addDebugTestClient(s, k2, "10.1.9.9:2222", derp.ClientInfo{IsProber: true})
 	c2b := addDebugTestClient(s, k2, "192.0.2.5:3333", derp.ClientInfo{})
-	addDebugTestClient(s, k3, "[2001:db8::1]:4444", derp.ClientInfo{})
+	addDebugTestClient(s, k3, "[2001:db8::1]:4444", derp.ClientInfo{AppName: "tailcat-server"})
 	c2b.setPreferred(true)
 	c2b.packetsRecv.Store(12)
 	c2b.bytesRecv.Store(3456)
@@ -116,6 +118,46 @@ func TestServeDebugClients(t *testing.T) {
 			want:    []string{"Showing 2 of 2 matching connections (1 node keys)", "10.1.9.9:2222", "192.0.2.5:3333", "dup-active", "home", `<td class="n">12</td>`, `<td class="n">3456</td>`, `<td class="n">78</td>`, `<td class="n">90123</td>`},
 			wantNot: []string{k1.String(), k3.String()},
 		},
+		{
+			name:    "app",
+			query:   "?app=one",
+			code:    200,
+			want:    []string{"all clients with app one", "Showing 1 of 1 matching connections (1 node keys)", k1.String()},
+			wantNot: []string{k2.String(), k3.String()},
+		},
+		{
+			name:    "app-either",
+			query:   "?app=one&app=tailcat-server&app=nonesuch",
+			code:    200,
+			want:    []string{"with app one or tailcat-server or nonesuch", "Showing 2 of 2 matching connections (2 node keys)", k1.String(), k3.String(), `href="?app=tailcat-server"`},
+			wantNot: []string{k2.String()},
+		},
+		{
+			name:    "app-empty-matches-no-app-name",
+			query:   "?app=",
+			code:    200,
+			want:    []string{"Showing 2 of 2 matching connections (1 node keys)", k2.String()},
+			wantNot: []string{k1.String(), k3.String()},
+		},
+		{
+			name:    "app-narrows-cidr",
+			query:   "?cidr=10.0.0.0/8&app=one",
+			code:    200,
+			want:    []string{"clients from 10.0.0.0/8 with app one", "Showing 1 of 1 matching connections (1 node keys)", k1.String()},
+			wantNot: []string{k2.String()},
+		},
+		{
+			name:  "app-preserved-in-links",
+			query: "?all&app=one&app=tailcat-server&limit=1&sort=conn",
+			code:  200,
+			want:  []string{"Showing 1 of 2 matching", `href="?after=1&amp;all=1&amp;app=one&amp;app=tailcat-server&amp;limit=1&amp;sort=conn"`},
+		},
+		{
+			name:  "bad-format",
+			query: "?all&format=xml",
+			code:  400,
+			want:  []string{"bad format"},
+		},
 		{
 			name:  "sort-by-tx-desc-next-cursor",
 			query: "?all&sort=-tx&limit=1",
@@ -213,6 +255,42 @@ func TestServeDebugClients(t *testing.T) {
 	if rec.Code != http.StatusOK {
 		t.Errorf("bare ?all status = %d", rec.Code)
 	}
+
+	t.Run("json", func(t *testing.T) {
+		rec := httptest.NewRecorder()
+		s.ServeDebugClients(rec, httptest.NewRequest("GET", "/debug/clients/?key="+k2.String()+"&format=json", nil))
+		if rec.Code != 200 || rec.Header().Get("Content-Type") != "application/json" {
+			t.Fatalf("status %d, Content-Type %q:\n%s", rec.Code, rec.Header().Get("Content-Type"), rec.Body.String())
+		}
+		var got debugClientsJSON
+		if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
+			t.Fatalf("decoding JSON: %v:\n%s", err, rec.Body.String())
+		}
+		if got.Conns != 2 || got.Keys != 1 || got.Remaining != 0 || got.Next != "" || len(got.Clients) != 2 {
+			t.Errorf("summary = %+v", got)
+		}
+		if got.Query != "connections for "+k2.String() {
+			t.Errorf("query = %q", got.Query)
+		}
+		// Rows sort by key then conn#, so c2b (conn 3) is second.
+		c := got.Clients[1]
+		if c.ConnNum != 3 || c.Key != k2 || c.Remote != netip.MustParseAddrPort("192.0.2.5:3333") || !c.Home || !c.Dup || !c.Active || c.RxPkts != 12 || c.TxBytes != 90123 || c.ConnectedAt.IsZero() {
+			t.Errorf("client = %+v", c)
+		}
+		// Node keys and addresses must round-trip as their text forms.
+		if !strings.Contains(rec.Body.String(), `"key": "`+k2.String()+`"`) || !strings.Contains(rec.Body.String(), `"remote": "192.0.2.5:3333"`) {
+			t.Errorf("unexpected encoding:\n%s", rec.Body.String())
+		}
+	})
+
+	t.Run("json-index", func(t *testing.T) {
+		rec := httptest.NewRecorder()
+		s.ServeDebugClients(rec, httptest.NewRequest("GET", "/debug/clients/?format=json", nil))
+		var got map[string]int
+		if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil || got["conns"] != 4 || got["keys"] != 3 {
+			t.Errorf("index JSON = %v (err %v):\n%s", got, err, rec.Body.String())
+		}
+	})
 }
 
 var (
@@ -247,6 +325,31 @@ func walkDebugClients(t *testing.T, s *Server, query string) (conns []int64, pag
 	return conns, pages
 }
 
+// walkDebugClientsJSON is like walkDebugClients but follows the JSON
+// form's next links.
+func walkDebugClientsJSON(t *testing.T, s *Server, query string) (conns []int64, pages int) {
+	t.Helper()
+	for query != "" {
+		pages++
+		if pages > 100 {
+			t.Fatal("too m
```

---

### Incident Patch 12: `7bb87d36` (2026-09-25)
**Commit Message**: derp/derpserver, cmd/derper: add /debug/clients/ page listing connected clients

The derper debug pages had no way to see which clients were connected.
The expvar gauges only give counts, /debug/check only says whether the
counts agree, and /debug/traffic only reports connections that moved
bytes since its last tick, and only if ss is installed.

Add /debug/clients/, which by default serves an index page with a form
to pick one of four filters: ?all lists every connection, ?ip=1.2.3.4
and ?cidr=1.2.0.0/16 list connections from an address or prefix, and
?key=nodekey:... lists the connection(s) for one node key. Each row
shows the connection number, key, remote address, connection age,
flags (home, mesh, prober, notideal, dup/active/disabled), protocol
version, app name, per-connection rx/tx packet and byte counts, and
the estimated unique sender count.

Big derpers have far too many connections for one page, so results
are paginated with keyset cursors rather than page numbers: sort=key,
ip, conn, rx, tx, rxpkts, or txpkts (with a leading - for descending)
picks the walk order, limit=N the page size, and after=X resumes after
that value of the sort field. The next-page links add aft

**File**: `cmd/derper/depaware.txt` (modified, +1/-0)
```diff
@@ -232,6 +232,7 @@ tailscale.com/cmd/derper dependencies: (generated by github.com/tailscale/depawa
         cmp                                                          from slices+
         compress/flate                                               from compress/gzip+
         compress/gzip                                                from google.golang.org/protobuf/internal/impl+
+        container/heap                                               from tailscale.com/derp/derpserver
         container/list                                               from crypto/tls+
         context                                                      from crypto/tls+
         crypto                                                       from crypto/ecdh+
```

**File**: `cmd/derper/derper.go` (modified, +1/-0)
```diff
@@ -304,6 +304,7 @@ func main() {
 		}
 	}))
 	debug.Handle("traffic", "Traffic check", http.HandlerFunc(s.ServeDebugTraffic))
+	debug.Handle("clients/", "Connected clients", http.HandlerFunc(s.ServeDebugClients))
 	debug.Handle("set-mutex-profile-fraction", "SetMutexProfileFraction", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
 		s := r.FormValue("rate")
 		if s == "" || r.Header.Get("Sec-Debug") != "derp" {
```

**File**: `derp/derp_test.go` (modified, +15/-0)
```diff
@@ -13,6 +13,7 @@ import (
 	"fmt"
 	"io"
 	"net"
+	"net/http/httptest"
 	"strings"
 	"sync"
 	"testing"
@@ -410,6 +411,20 @@ func TestSendRecv(t *testing.T) {
 	recvNothing(0)
 	recvNothing(1)
 
+	// Client 1 has now received one 11-byte packet and sent one,
+	// which the debug clients page should show in its per-connection
+	// counters. The server bumps them before the packet reaches the
+	// client, so they're settled by the time recv returns.
+	{
+		rec := httptest.NewRecorder()
+		s.ServeDebugClients(rec, httptest.NewRequest("GET", "/debug/clients/?key="+clientKeys[1].String(), nil))
+		body := rec.Body.String()
+		const wantCounters = "<td class=\"n\">1</td>\n<td class=\"n\">11</td>\n<td class=\"n\">1</td>\n<td class=\"n\">11</td>"
+		if rec.Code != 200 || !strings.Contains(body, wantCounters) {
+			t.Errorf("debug clients page for client 1: status %d, missing rx/tx counters %q:\n%s", rec.Code, wantCounters, body)
+		}
+	}
+
 	// Send messages to a non-existent node
 	neKey := key.NewNode().Public()
 	msg4 := []byte("not a CallMeMaybe->unknown destination\n")
```

**File**: `derp/derpserver/debugclients.go` (added, +674/-0)
```diff
@@ -0,0 +1,674 @@
+// Copyright (c) Tailscale Inc & contributors
+// SPDX-License-Identifier: BSD-3-Clause
+
+package derpserver
+
+import (
+	"cmp"
+	"container/heap"
+	"fmt"
+	"html/template"
+	"net/http"
+	"net/netip"
+	"net/url"
+	"slices"
+	"strconv"
+	"strings"
+	"time"
+
+	"tailscale.com/types/key"
+)
+
+const (
+	debugClientsDefaultLimit = 100
+	debugClientsMaxLimit     = 1000
+)
+
+// debugClient is a snapshot of one connected client, rendered by
+// [Server.ServeDebugClients].
+type debugClient struct {
+	ConnNum   int64
+	Key       key.NodePublic
+	Remote    netip.AddrPort
+	Connected time.Duration // how long the connection has been up
+	Active    bool          // the connection currently receiving packets for Key
+	Dup       bool          // Key has more than one connection
+	Disabled  bool          // sends to this connection are disabled due to dups
+	Home      bool          // client reported this as its preferred (home) DERP
+	MeshPeer  bool
+	NotIdeal  bool
+	Prober    bool
+	Version   int
+	AppName   string
+	RxPkts    uint64 // data packets received from the client
+	RxBytes   uint64
+	TxPkts    uint64 // data packets sent to the client
+	TxBytes   uint64
+	Senders   uint64 // estimated number of unique peers that have sent to it
+}
+
+// debugClientsSort is the order in which [Server.ServeDebugClients]
+// walks the connections. Ties are broken by connection number so
+// the order is total and a cursor can resume exactly where the
+// previous page stopped.
+type debugClientsSort int
+
+const (
+	sortClientsByKey  debugClientsSort = iota // node key
+	sortClientsByIP                           // remote address and port
+	sortClientsByConn                         // connection number (accept order)
+
+	// The traffic counter sorts. They must stay after the sorts
+	// above; see [debugClientsSort.isCounter].
+	sortClientsByRxBytes
+	sortClientsByTxBytes
+	sortClientsByRxPkts
+	sortClientsByTxPkts
+)
+
+// debugClientsSortNames maps each sort to its name in the sort URL
+// parameter.
+var debugClientsSortNames = map[debugClientsSort]string{
+	sortClientsByKey:     "key",
+	sortClientsByIP:      "ip",
+	sortClientsByConn:    "conn",
+	sortClientsByRxBytes: "rx",
+	sortClientsByTxBytes: "tx",
+	sortClientsByRxPkts:  "rxpkts",
+	sortClientsByTxPkts:  "txpkts",
+}
+
+func (s debugClientsSort) String() string {
+	if name, ok := debugClientsSortNames[s]; ok {
+		return name
+	}
+	return "unknown"
+}
+
+// isCounter reports whether s sorts by a traffic counter. Counters
+// change while the walk runs, so their value is loaded once per
+// connection as it's considered and that value is used for both the
+// cursor test and the heap order.
+func (s debugClientsSort) isCounter() bool { return s >= sortClientsByRxBytes }
+
+// debugClientsQuery is a parsed /debug/clients/ request: a filter,
+// a walk order, a page size, and optionally a cursor after which the
+// page starts.
+type debugClientsQuery struct {
+	// Filter. Exactly one of the fields is set.
+	all  bool
+	ip   netip.Addr
+	cidr netip.Prefix
+	key  key.NodePublic
+
+	sort  debugClientsSort
+	desc  bool // walk in descending order
+	limit int  // maximum connections per page
+
+	// hasAfter is whether a cursor was given. The page then starts
+	// strictly after the cursor in the walk order. Which of the
+	// after fields is meaningful depends on sort. For all but the
+	// conn sort, afterConn is the connection number tiebreak and is
+	// only set if hasAfterConn; a cursor without it, as a person
+	// might type by hand, excludes every connection at that value.
+	hasAfter     bool
+	afterKey     key.NodePublic
+	afterAddr    netip.AddrPort
+	afterN       uint64 // for the counter sorts
+	afterConn    int64
+	hasAfterConn bool
+}
+
+// parseDebugClientsQuery parses r's query parameters.
+// It returns ok=false with no error when r has no filter parameters
+// at all, in which case the caller should serve the index page.
+func parseDebugClientsQuery(r *http.Request) (q *debugClientsQuery, ok bool, err error) {
+	v := r.URL.Query()
+	q = &debugClientsQuery{limit: debugClientsDefaultLimit}
+	n := 0
+	if v.Has("all") {
+		n++
+		q.all = true
+	}
+	if s := v.Get("ip"); s != "" {
+		n++
+		q.ip, err = netip.ParseAddr(s)
+		if err != nil {
+			return nil, false, fmt.Errorf("bad ip %q: %w", s, err)
+		}
+		q.ip = q.ip.Unmap()
+	}
+	if s := v.Get("cidr"); s != "" {
+		n++
+		q.cidr, err = netip.ParsePrefix(s)
+		if err != nil {
+			return nil, false, fmt.Errorf("bad cidr %q: %w", s, err)
+		}
+		q.cidr = q.cidr.Masked()
+	}
+	if s := v.Get("key"); s != "" {
+		n++
+		if err := q.key.UnmarshalText([]byte(s)); err != nil {
+			return nil, false, fmt.Errorf("bad key %q: %w", s, err)
+		}
+	}
+	switch n {
+	case 0:
+		return nil, false, nil
+	case 1:
+	default:
+		return nil, false, fmt.Errorf("only one of all, ip, cidr, or key may be given")
+	}
+
+	if s := v.Get("sort"); s != "" {
+		name, desc := strings.CutPrefix(s, "-")
+		q.desc = desc
+		found
```

**File**: `derp/derpserver/debugclients_test.go` (added, +397/-0)
```diff
@@ -0,0 +1,397 @@
+// Copyright (c) Tailscale Inc & contributors
+// SPDX-License-Identifier: BSD-3-Clause
+
+package derpserver
+
+import (
+	"fmt"
+	"net/http"
+	"net/http/httptest"
+	"net/netip"
+	"regexp"
+	"slices"
+	"strings"
+	"testing"
+
+	"tailscale.com/derp"
+	"tailscale.com/types/key"
+	"tailscale.com/types/logger"
+)
+
+// addDebugTestClient registers a fake connected client with s.
+func addDebugTestClient(s *Server, k key.NodePublic, remote string, info derp.ClientInfo) *sclient {
+	c := &sclient{
+		s:            s,
+		key:          k,
+		logf:         logger.Discard,
+		remoteIPPort: netip.MustParseAddrPort(remote),
+		connectedAt:  s.clock.Now(),
+		info:         info,
+	}
+	s.accepts.Add(1)
+	c.connNum = s.accepts.Value()
+	s.registerClient(c)
+	return c
+}
+
+func getDebugClients(t *testing.T, s *Server, query string) (code int, body string) {
+	t.Helper()
+	req := httptest.NewRequest("GET", "/debug/clients/"+query, nil)
+	rec := httptest.NewRecorder()
+	s.ServeDebugClients(rec, req)
+	return rec.Code, rec.Body.String()
+}
+
+func TestServeDebugClients(t *testing.T) {
+	s := New(key.NewNode(), t.Logf)
+	defer s.Close()
+
+	// Register three keys: one single connection, one duplicated
+	// across two IPs, and one on IPv6.
+	k1 := key.NewNode().Public()
+	k2 := key.NewNode().Public()
+	k3 := key.NewNode().Public()
+	addDebugTestClient(s, k1, "10.1.2.3:1111", derp.ClientInfo{Version: 2, AppName: "one"})
+	addDebugTestClient(s, k2, "10.1.9.9:2222", derp.ClientInfo{IsProber: true})
+	c2b := addDebugTestClient(s, k2, "192.0.2.5:3333", derp.ClientInfo{})
+	addDebugTestClient(s, k3, "[2001:db8::1]:4444", derp.ClientInfo{})
+	c2b.setPreferred(true)
+	c2b.packetsRecv.Store(12)
+	c2b.bytesRecv.Store(3456)
+	c2b.packetsSent.Store(78)
+	c2b.bytesSent.Store(90123)
+
+	tests := []struct {
+		name    string
+		query   string
+		code    int
+		want    []string // substrings the body must contain
+		wantNot []string // substrings the body must not contain
+	}{
+		{
+			name:  "index",
+			query: "",
+			code:  200,
+			want:  []string{`<form`, `name="ip"`, `name="cidr"`, `name="key"`, `name="all"`, "4 connections for 3 node keys"},
+		},
+		{
+			name:    "all",
+			query:   "?all=1",
+			code:    200,
+			want:    []string{"Showing 4 of 4 matching connections (3 node keys)", k1.String(), k2.String(), k3.String(), "10.1.2.3:1111", "192.0.2.5:3333", "[2001:db8::1]:4444", "one", "prober", "dup-active", "home"},
+			wantNot: []string{"Next page"},
+		},
+		{
+			name:    "ip",
+			query:   "?ip=10.1.9.9",
+			code:    200,
+			want:    []string{"Showing 1 of 1 matching connections (1 node keys)", k2.String(), "10.1.9.9:2222", "prober", "dup"},
+			wantNot: []string{k1.String(), k3.String(), "192.0.2.5", "dup-active"},
+		},
+		{
+			name:    "ip-v6",
+			query:   "?ip=2001:db8::1",
+			code:    200,
+			want:    []string{"Showing 1 of 1 matching connections (1 node keys)", k3.String()},
+			wantNot: []string{k1.String(), k2.String()},
+		},
+		{
+			name:    "cidr",
+			query:   "?cidr=10.1.0.0/16",
+			code:    200,
+			want:    []string{"Showing 2 of 2 matching connections (2 node keys)", k1.String(), k2.String(), "10.1.2.3:1111", "10.1.9.9:2222"},
+			wantNot: []string{k3.String(), "192.0.2.5"},
+		},
+		{
+			name:    "cidr-no-match",
+			query:   "?cidr=172.16.0.0/12",
+			code:    200,
+			want:    []string{"Showing 0 of 0 matching connections (0 node keys)"},
+			wantNot: []string{k1.String(), k2.String(), k3.String()},
+		},
+		{
+			name:    "key",
+			query:   "?key=" + k2.String(),
+			code:    200,
+			want:    []string{"Showing 2 of 2 matching connections (1 node keys)", "10.1.9.9:2222", "192.0.2.5:3333", "dup-active", "home", `<td class="n">12</td>`, `<td class="n">3456</td>`, `<td class="n">78</td>`, `<td class="n">90123</td>`},
+			wantNot: []string{k1.String(), k3.String()},
+		},
+		{
+			name:  "sort-by-tx-desc-next-cursor",
+			query: "?all&sort=-tx&limit=1",
+			code:  200,
+			want:  []string{"192.0.2.5:3333", `href="?after=90123&amp;afterconn=3&amp;all=1&amp;limit=1&amp;sort=-tx"`},
+		},
+		{
+			name:    "key-not-connected",
+			query:   "?key=" + key.NewNode().Public().String(),
+			code:    200,
+			want:    []string{"Showing 0 of 0 matching connections (0 node keys)"},
+			wantNot: []string{k1.String()},
+		},
+		{
+			name:  "limit-shows-next-page",
+			query: "?all&limit=1&sort=conn",
+			code:  200,
+			want:  []string{"Showing 1 of 4 matching connections (3 node keys)", "Next page", "(3 more)", "10.1.2.3:1111", `href="?after=1&amp;all=1&amp;limit=1&amp;sort=conn"`},
+		},
+		{
+			name:  "bad-ip",
+			query: "?ip=bogus",
+			code:  400,
+			want:  []string{"bad ip"},
+		},
+		{
+			name:  "bad-cidr",
+			query: "?cidr=10.0.0.0",
+			code:  400,
+			want:  []string{"bad cidr"},
+		},
+		{
+			name:  "bad-key",
+			query: "?key=8cde7aa8",
+			code:  400,
+			want:  []string{"bad key"},
+		},
+		{
+			name:  "bad-sort",
+			query: "?all&sort=age",
+			code:  400,
+			want:  []stri
```

**File**: `derp/derpserver/derpserver.go` (modified, +20/-4)
```diff
@@ -1021,7 +1021,7 @@ func (s *Server) unregisterClient(c *sclient) {
 	delete(s.keyOfAddr, c.remoteIPPort)
 
 	s.curClients.Add(-1)
-	if c.preferred {
+	if c.preferred.Load() {
 		s.curHomeClients.Add(-1)
 	}
 	if c.isNotIdealConn {
@@ -1400,6 +1400,8 @@ func (c *sclient) handleFrameForwardPacket(_ derp.FrameType, fl uint32) error {
 	}
 	contents := *buf
 	s.packetsForwardedIn.Add(1)
+	c.packetsRecv.Add(1)
+	c.bytesRecv.Add(uint64(len(contents)))
 
 	// Use the same lock-free fast path as the local send path. The mesh
 	// forwarder return is intentionally discarded: we never re-forward an
@@ -1473,6 +1475,8 @@ func (c *sclient) handleFrameSendPacket(_ derp.FrameType, fl uint32) error {
 		return fmt.Errorf("client %v: recvPacket: %v", c.key, err)
 	}
 	contents := *buf
+	c.packetsRecv.Add(1)
+	c.bytesRecv.Add(uint64(len(contents)))
 
 	dst, fwd, dstLen := c.lookupDest(dstKey)
 
@@ -2073,7 +2077,17 @@ type sclient struct {
 	// Owned by run, not thread-safe.
 	br          *bufio.Reader
 	connectedAt time.Time
-	preferred   bool
+
+	// preferred is whether the client reported this server as its
+	// preferred (home) DERP. It's written by run and read by
+	// [Server.ServeDebugClients].
+	preferred atomic.Bool
+
+	// Per-connection traffic counters for [Server.ServeDebugClients].
+	// Like the server-wide counters, they count data packets only,
+	// not frame overhead or other frame types.
+	packetsRecv, bytesRecv atomic.Uint64 // packets this client sent us to deliver or forward
+	packetsSent, bytesSent atomic.Uint64 // packets we wrote to this client
 
 	// Owned by the writer goroutine, not thread-safe. Only one writer
 	// runs at a time, and [sclient.stopWriter] touches these only after
@@ -2260,10 +2274,10 @@ type peerGoneMsg struct {
 }
 
 func (c *sclient) setPreferred(v bool) {
-	if c.preferred == v {
+	if c.preferred.Load() == v {
 		return
 	}
-	c.preferred = v
+	c.preferred.Store(v)
 	var homeMove *expvar.Int
 	if v {
 		c.s.curHomeClients.Add(1)
@@ -2847,6 +2861,8 @@ func (c *sclient) sendPacket(srcKey key.NodePublic, contents []byte) (err error)
 		} else {
 			c.s.packetsSent.Add(1)
 			c.s.bytesSent.Add(int64(len(contents)))
+			c.packetsSent.Add(1)
+			c.bytesSent.Add(uint64(len(contents)))
 		}
 		if c.debug {
 			c.debugLogf("sendPacket from %s: %v", srcKey.ShortString(), err)
```

---

### Incident Patch 13: `94ea82ab` (2026-09-25)
**Commit Message**: ipn/localapi: restrict debug-log access to PermitWrite (#21447)

The debug-log endpoint was gated on PermitRead, which any local user connecting to the world-writable tailscaled socket passes. Although forged log entries are always possible, we should limit the ability for local users to influence that flow with respects to a given node.

This change requires PermitWrite for debug-log, matching the trust level of every other mutating debug endpoint. Also add a buildfeatures.HasDebug guard to debug-dial-types for parity with serveDebug.

Fixes tailscale/corp#48143

Change-Id: I0c0044b6b44fe7cbfb6734ac18bca3dc36eaffbf

Signed-off-by: Mike Jensen <[REDACTED_EMAIL]>

**File**: `ipn/localapi/debug.go` (modified, +1/-1)
```diff
@@ -522,7 +522,7 @@ func (h *Handler) serveDebugLog(w http.ResponseWriter, r *http.Request) {
 		http.Error(w, feature.ErrUnavailable.Error(), http.StatusNotImplemented)
 		return
 	}
-	if !h.PermitRead {
+	if !h.PermitWrite {
 		http.Error(w, "debug-log access denied", http.StatusForbidden)
 		return
 	}
```

**File**: `ipn/localapi/debug_test.go` (modified, +42/-0)
```diff
@@ -9,6 +9,7 @@ import (
 	"net/http"
 	"net/http/httptest"
 	"net/url"
+	"strings"
 	"testing"
 
 	"tailscale.com/ipn"
@@ -73,3 +74,44 @@ func TestServeDevSetStateStore(t *testing.T) {
 		})
 	}
 }
+
+func TestServeDebugLogGate(t *testing.T) {
+	t.Parallel()
+
+	tests := []struct {
+		desc        string
+		permitRead  bool
+		permitWrite bool
+		wantStatus  int
+	}{
+		{
+			desc:       "read-only-denied",
+			permitRead: true,
+			wantStatus: http.StatusForbidden,
+		},
+		{
+			desc:        "write-allowed",
+			permitRead:  true,
+			permitWrite: true,
+			wantStatus:  http.StatusNoContent,
+		},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.desc, func(t *testing.T) {
+			h := handlerForTest(t, &Handler{
+				PermitRead:  tt.permitRead,
+				PermitWrite: tt.permitWrite,
+				b:           newTestLocalBackend(t),
+			})
+			req := httptest.NewRequest("POST", "http://local-tailscaled.sock/localapi/v0/debug-log",
+				strings.NewReader(`{"prefix":"test","lines":["line"]}`))
+			resp := httptest.NewRecorder()
+			h.serveDebugLog(resp, req)
+
+			if resp.Code != tt.wantStatus {
+				t.Errorf("resp.Code = %d, want %d; body: %s", resp.Code, tt.wantStatus, resp.Body.String())
+			}
+		})
+	}
+}
```

**File**: `ipn/localapi/localapi_test.go` (modified, +4/-0)
```diff
@@ -35,6 +35,7 @@ import (
 	"tailscale.com/tailcfg/peercap"
 	"tailscale.com/tsd"
 	"tailscale.com/tstest"
+	"tailscale.com/tstime"
 	"tailscale.com/types/key"
 	"tailscale.com/types/logger"
 	"tailscale.com/types/logid"
@@ -53,6 +54,9 @@ func handlerForTest(t testing.TB, h *Handler) *Handler {
 	if h.logf == nil {
 		h.logf = logger.TestLogger(t)
 	}
+	if h.clock == nil {
+		h.clock = tstime.StdClock{}
+	}
 	return h
 }
 
```

---

### Incident Patch 14: `19855780` (2026-09-25)
**Commit Message**: derp/derpserver: don't hold s.mu while writing debug traffic to the network

ServeDebugTraffic held s.mu while JSON-encoding each record straight
to the ResponseWriter, so a debug client on a slow connection could
block the network write with the server mutex held and stall the
whole DERP server.

Encode into a private bytes.Buffer instead and, once it passes a
threshold size, release s.mu, write the buffer to the network, and
re-take the lock before continuing. That keeps the lock off the
network path without toggling it around every record.

Fixes tailscale/corp#48890

Signed-off-by: Brad Fitzpatrick <[REDACTED_EMAIL]>
Change-Id: I7c3e91a4d2f58b06e1a9c4f7d3b28e5a61f09c4d

**File**: `derp/derpserver/derpserver.go` (modified, +25/-2)
```diff
@@ -3196,9 +3196,21 @@ func parseSSOutput(raw string) map[netip.AddrPort]BytesSentRecv {
 	return newState
 }
 
+// debugTrafficFlushSize is the buffered JSON size at which
+// [Server.ServeDebugTraffic] releases the server mutex and writes
+// what it has so far to the network.
+const debugTrafficFlushSize = 32 << 10
+
 func (s *Server) ServeDebugTraffic(w http.ResponseWriter, r *http.Request) {
 	prevState := map[netip.AddrPort]BytesSentRecv{}
-	enc := json.NewEncoder(w)
+
+	// Records are JSON-encoded into buf while holding s.mu, but
+	// are only written to the network with s.mu released, so a
+	// slow client can't stall the server. Rather than toggling
+	// the lock around every record, we let buf grow to
+	// debugTrafficFlushSize before flushing.
+	var buf bytes.Buffer
+	enc := json.NewEncoder(&buf)
 	for r.Context().Err() == nil {
 		output, err := exec.Command("ss", "-i", "-H", "-t").Output()
 		if err != nil {
@@ -3221,14 +3233,25 @@ func (s *Server) ServeDebugTraffic(w http.ResponseWriter, r *http.Request) {
 						s.mu.Unlock()
 						return
 					}
+					if buf.Len() >= debugTrafficFlushSize {
+						s.mu.Unlock()
+						_, err := w.Write(buf.Bytes())
+						buf.Reset()
+						if err != nil {
+							return
+						}
+						s.mu.Lock()
+					}
 				}
 			}
 		}
 		s.mu.Unlock()
 		prevState = newState
-		if _, err := fmt.Fprintln(w); err != nil {
+		buf.WriteByte('\n')
+		if _, err := w.Write(buf.Bytes()); err != nil {
 			return
 		}
+		buf.Reset()
 		if f, ok := w.(http.Flusher); ok {
 			f.Flush()
 		}
```

---

### Incident Patch 15: `8d43ba67` (2026-09-22)
**Commit Message**: tstest/natlab/vmtest: close unused pipe read FD to avoid leak

There are two copies of the read file descriptor (parent & child).
Since the parent copy is unused, we can close it after fork.

Updates #cleanup

Change-Id: Id789e0a04970c9fb8eaeed1f299aa25f29fcf48c
Signed-off-by: Francois Marier <[REDACTED_EMAIL]>

**File**: `tstest/natlab/vmtest/qemu.go` (modified, +7/-1)
```diff
@@ -343,7 +343,13 @@ func (e *Env) startQEMUOnce(name, logPath string, args []string) (*qemuRun, erro
 		qemuLog.Close()
 		return nil, fmt.Errorf("killWithParent: %w", err)
 	}
-	if err := cmd.Start(); err != nil {
+	err = cmd.Start()
+	// Child now has a copy of the pipe's read end. Parent can close its own.
+	// These were populated by killWithParent prior to Start.
+	for _, f := range cmd.ExtraFiles {
+		f.Close()
+	}
+	if err != nil {
 		parentPipe.Close()
 		devNull.Close()
 		qemuLog.Close()
```

#### Recent Merged Pull Requests:
- **PR #21691** (closed): appc: add opt-in retention for DNS-discovered routes (@MalteHB)
- **PR #21675** (2026-10-06): net/netcheck: don't keep a home DERP region that was removed from the map (@bradfitz)
- **PR #21672** (2026-10-07): tstest/natlab/vmtest: add a dhcpcd DHCP client option for Ubuntu guests (@bcreane)
- **PR #21665** (2026-10-07): net/tstun: implement tun.MultiQueueDevice (@illotum)
- **PR #21664** (2026-10-06): tstest/natlab: upload tailscaled logs from cloud-image guests (@bcreane)
- **PR #21661** (2026-10-06): types/logid: optimize Compare (@dsnet)
- **PR #21658** (2026-10-06): tstest/natlab/vnet: stop agent dials from outliving their Server (@fmarier)
- **PR #21655** (2026-10-06): ipn/ipnlocal: drop the appc import from ts_omit_appconnectors builds (@bradfitz)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
