# Forensic Learning Record (Deep Inspection): lucasastorian/llmwiki

> **Canonical Artifact**: `07_PROJECT_LEARNING/lucasastorian-llmwiki-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/lucasastorian/llmwiki](https://github.com/lucasastorian/llmwiki))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:24:08.583Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `lucasastorian/llmwiki`
- **Description**: Open Source Implementation of Karpathy's LLM Wiki. Upload documents, connect your Claude account via MCP, and have it write your wiki ! 
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1662 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `web/src/components/pwa/ServiceWorkerRegistration.tsx`
```
"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) {
      return;
    }

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch((error) => {
        console.error("Service worker registration failed:", error);
      });
  }, []);

  return null;
}

```

### Core Architecture Module: `web/src/hooks/useCourseProgress.ts`
```
'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'
import { useUserStore } from '@/stores'
import type { DocumentListItem } from '@/lib/types'

type LessonStatus = 'complete' | 'not_started'

// Persists per-lesson completion in the doc's metadata.course (reuses the existing
// PATCH /v1/documents/{id} merge — no course-specific backend). Optimistic; a refetch reconciles.
export function useCourseProgress(
  setDocuments: React.Dispatch<React.SetStateAction<DocumentListItem[]>>,
) {
  const token = useUserStore((s) => s.accessToken)

  const setStatus = React.useCallback(
    async (docId: string, status: LessonStatus) => {
      const completed_at = status === 'complete' ? new Date().toISOString() : null
      setDocuments((prev) =>
        prev.map((d) => {
          if (d.id !== docId) return d
          const meta = (d.metadata ?? {}) as Record<string, unknown>
          return { ...d, metadata: { ...meta, course: { status, completed_at } } }
        }),
      )
      if (!token) return
      try {
        await apiFetch(`/v1/documents/${docId}`, token, {
          method: 'PATCH',
          body: JSON.stringify({ metadata: { course: { status, completed_at } } }),
        })
      } catch {
        // The next documents refetch reverts the optimistic state — say so.
        toast.error("Progress didn't save — check your connection and try again")
      }
    },
    [token, setDocuments],
  )

  const markComplete = React.useCallback((docId: string) => setStatus(docId, 'complete'), [setStatus])
  const markIncomplete = React.useCallback((docId: string) => setStatus(docId, 'not_started'), [setStatus])

  return { markComplete, markIncomplete }
}

```

### Core Architecture Module: `web/src/hooks/useKBDocuments.ts`
```
'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { apiFetch, getDocumentsWsUrl } from '@/lib/api'
import { refreshAccessToken } from '@/lib/auth-token'
import { useUserStore } from '@/stores'
import type { DocumentListItem } from '@/lib/types'

const isLocal = process.env.NEXT_PUBLIC_MODE === 'local'
const POLL_INTERVAL = 2000
const WS_RECONNECT_BASE = 1000
const WS_RECONNECT_MAX = 30000
const WS_CLOSE_AUTH = 4001
const WS_CLOSE_FORBIDDEN = 4003
const DEBOUNCE_MS = 300

// Fields whose change we want to *force* a re-render through identity churn.
// `updated_at` is intentionally excluded — it bumps on every UPDATE (incl.
// highlight-only writes) and would otherwise unmount the active viewer.
const IDENTITY_FIELDS: ReadonlyArray<keyof DocumentListItem> = [
  'id', 'filename', 'title', 'path', 'file_type', 'status', 'archived',
  'tags', 'date', 'metadata', 'version', 'document_number', 'error_message',
]

function shallowEqualForIdentity(a: DocumentListItem, b: DocumentListItem): boolean {
  for (const k of IDENTITY_FIELDS) {
    const av = a[k]
    const bv = b[k]
    if (av === bv) continue
    // Arrays and dicts: fall back to JSON compare. Cheap for our row sizes
    // and avoids pulling in a deep-equal dependency.
    if (typeof av === 'object' || typeof bv === 'object') {
      if (JSON.stringify(av) !== JSON.stringify(bv)) return false
      continue
    }
    return false
  }
  return true
}

function mergePreservingIdentity(
  prev: DocumentListItem[],
  next: DocumentListItem[],
): DocumentListItem[] {
  if (prev.length === 0) return next
  const prevById = new Map(prev.map((d) => [d.id, d]))
  let allSame = prev.length === next.length
  const merged = next.map((nextDoc, i) => {
    const prevDoc = prevById.get(nextDoc.id)
    const result = prevDoc && shallowEqualForIdentity(prevDoc, nextDoc) ? prevDoc : nextDoc
    if (result !== prev[i]) allSame = false
    return result
  })
  return allSame ? prev : merged
}

export function useKBDocuments(knowledgeBaseId: string) {
  const [documents, setDocuments] = React.useState<DocumentListItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const accessToken = useUserStore((s) => s.accessToken)
  const wsRef = React.useRef<WebSocket | null>(null)
  const reconnectTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectDelay = React.useRef(WS_RECONNECT_BASE)
  const debounceTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchDocs = React.useCallback(async () => {
    if (!knowledgeBaseId || !accessToken) return
    try {
      const data = await apiFetch<DocumentListItem[]>(
        `/v1/knowledge-bases/${knowledgeBaseId}/documents`,
        accessToken,
      )
      // Preserve object identity for rows whose user-visible content hasn't
      // actually changed. Highlight saves bump `updated_at` (via the row's
      // UPDATE trigger) without changing any field we render in this list,
      // so without this merge the WS-triggered refetch would churn references
      // downstream and cause the active doc viewer to remount.
      setDocuments((prev) => mergePreservingIdentity(prev, data))
    } catch (err) {
      console.error('Failed to load documents:', err)
    }
  }, [knowledgeBaseId, accessToken])

  // Initial load — always use the API
  React.useEffect(() => {
    if (!knowledgeBaseId) {
      setDocuments([])
      setLoading(false)
      return
    }
    setLoading(true)
    fetchDocs().finally(() => setLoading(false))
  }, [knowledgeBaseId, fetchDocs])

  // Real-time updates: WebSocket (hosted) or polling (local)
  React.useEffect(() => {
    if (!knowledgeBaseId || !accessToken) return

    if (isLocal) {
      const interval = setInterval(fetchDocs, POLL_INTERVAL)
      return () => clearInterval(interval)
    }

    // Hosted mode — connect to API WebSocket
    let cancelled = false

    function connect() {
      if (cancelled) return

      const url = getDocumentsWsUrl(knowledgeBaseId)
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        // Send token as first message — keeps JWT out of URLs and logs
        ws.send(accessToken!)
        reconnectDelay.current = WS_RECONNECT_BASE
      }

      ws.onmessage = () => {
        if (process.env.NODE_ENV === 'development') {
          console.count(`documents ws message:${knowledgeBaseId}`)
        }
        // Debounce refetches — OCR updates can fire many events in quick succession
        if (debounceTimer.current) clearTimeout(debounceTimer.current)
        debounceTimer.current = setTimeout(fetchDocs, DEBOUNCE_MS)
      }

      ws.onclose = (e) => {
        wsRef.current = null
        if (cancelled) return
        // 4001 = auth failure. The common cause is a tab reconnecting with a
        // token that expired while the page was open; ask Supabase to refresh
        // and let the accessToken dependency recreate the socket.
        if (e.code === WS_CLOSE_AUTH) {
          console.warn('WebSocket auth failed; refreshing token:', e.reason)
          refreshAccessToken(accessToken!).catch((err) => {
            console.error('Token refresh after WebSocket auth failure failed:', err)
          })
          return
        }
        if (e.code === WS_CLOSE_FORBIDDEN) {
          console.warn('WebSocket subscription forbidden; stopping reconnect:', e.reason)
          return
        }
        // Reconnect with exponential backoff
        const delay = reconnectDelay.current
        reconnectDelay.current = Math.min(delay * 2, WS_RECONNECT_MAX)
        reconnectTimer.current = setTimeout(connect, delay)
      }

      ws.onerror = () => {
        // onclose will fire after this, which handles reconnection
      }
    }

    connect()

    return () => {
      cancelled = true
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      if (wsRef.current) {
        wsRef.current.onclose = null
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [knowledgeBaseId, accessToken, fetchDocs])

  const refetchDocuments = React.useCallback(() => {
    fetchDocs()
  }, [fetchDocs])

  return { documents, setDocuments, loading, refetchDocuments }
}

```

### Core Architecture Module: `web/src/hooks/useKBEvents.ts`
```
'use client'

import * as React from 'react'
import { apiFetch } from '@/lib/api'
import { useUserStore } from '@/stores'
import type { KnowledgeBaseEvent, KnowledgeBaseEventsPage } from '@/lib/types'

const PAGE_SIZE = 50

function mergeUnique(
  newest: KnowledgeBaseEvent[],
  existing: KnowledgeBaseEvent[],
): KnowledgeBaseEvent[] {
  const seen = new Set<string>()
  const merged: KnowledgeBaseEvent[] = []
  for (const event of [...newest, ...existing]) {
    if (seen.has(event.id)) continue
    seen.add(event.id)
    merged.push(event)
  }
  return merged
}

export function useKBEvents(
  knowledgeBaseId: string,
  enabled: boolean,
  refreshKey: string,
) {
  const accessToken = useUserStore((state) => state.accessToken)
  const [events, setEvents] = React.useState<KnowledgeBaseEvent[]>([])
  const [nextCursor, setNextCursor] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(enabled)
  const [loadingMore, setLoadingMore] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const initializedRef = React.useRef(false)
  const loadedMoreRef = React.useRef(false)
  const refreshKeyRef = React.useRef(refreshKey)

  const endpoint = React.useCallback((before?: string) => {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE) })
    if (before) params.set('before', before)
    return `/v1/knowledge-bases/${knowledgeBaseId}/events?${params.toString()}`
  }, [knowledgeBaseId])

  const fetchInitial = React.useCallback(async (signal?: AbortSignal) => {
    if (!enabled || !knowledgeBaseId || !accessToken) return
    setError(null)
    try {
      const page = await apiFetch<KnowledgeBaseEventsPage>(endpoint(), accessToken, { signal })
      setEvents(page.items)
      setNextCursor(page.next_cursor)
      initializedRef.current = true
      loadedMoreRef.current = false
    } catch (err) {
      if (signal?.aborted) return
      setError(err instanceof Error ? err.message : 'Failed to load recent changes')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [accessToken, enabled, endpoint, knowledgeBaseId])

  React.useEffect(() => {
    refreshKeyRef.current = refreshKey
    initializedRef.current = false
    loadedMoreRef.current = false
    if (!enabled || !knowledgeBaseId || !accessToken) {
      setEvents([])
      setNextCursor(null)
      setLoading(false)
      setError(null)
      return
    }

    const controller = new AbortController()
    setEvents([])
    setNextCursor(null)
    setLoading(true)
    fetchInitial(controller.signal)
    return () => controller.abort()
  }, [accessToken, enabled, fetchInitial, knowledgeBaseId])

  const refreshNewest = React.useCallback(async () => {
    if (!enabled || !knowledgeBaseId || !accessToken || !initializedRef.current) return
    try {
      const page = await apiFetch<KnowledgeBaseEventsPage>(endpoint(), accessToken)
      setEvents((current) => mergeUnique(page.items, current))
      if (!loadedMoreRef.current) setNextCursor(page.next_cursor)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh recent changes')
    }
  }, [accessToken, enabled, endpoint, knowledgeBaseId])

  React.useEffect(() => {
    if (refreshKeyRef.current === refreshKey) return
    refreshKeyRef.current = refreshKey
    refreshNewest()
  }, [refreshKey, refreshNewest])

  const loadMore = React.useCallback(async () => {
    if (!nextCursor || loadingMore || !accessToken) return
    setLoadingMore(true)
    setError(null)
    try {
      const page = await apiFetch<KnowledgeBaseEventsPage>(endpoint(nextCursor), accessToken)
      setEvents((current) => mergeUnique(current, page.items))
      setNextCursor(page.next_cursor)
      loadedMoreRef.current = true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load older changes')
    } finally {
      setLoadingMore(false)
    }
  }, [accessToken, endpoint, loadingMore, nextCursor])

  return {
    events,
    loading,
    loadingMore,
    error,
    hasMore: nextCursor !== null,
    loadMore,
    retry: () => fetchInitial(),
  }
}

```

### Core Architecture Module: `web/src/hooks/useWikiHighlights.ts`
```
'use client'

import * as React from 'react'
import { apiFetch } from '@/lib/api'
import { useUserStore } from '@/stores'
import { createHighlightId } from '@/lib/highlights/ids'
import { isOwnWrite, markOwnWrite } from '@/lib/highlights/ownWrites'
import type { Highlight, HighlightsResponse, TextAnchor } from '@/lib/highlights/types'

const isLocal = process.env.NEXT_PUBLIC_MODE === 'local'

export interface WikiHighlightsApi {
  highlights: Highlight[]
  saveHighlight: (textAnchor: TextAnchor, comment: string | null, id?: string) => Promise<void>
  updateComment: (id: string, comment: string | null) => Promise<void>
  removeHighlight: (id: string) => Promise<void>
}

export interface DocumentHighlightsApi {
  highlights: Highlight[]
  saveHighlight: (highlight: Highlight) => Promise<void>
  updateComment: (id: string, comment: string | null) => Promise<void>
  removeHighlight: (id: string) => Promise<void>
}

/** Canonical highlight sidecar client shared by text and PDF viewers. */
export function useDocumentHighlights(
  documentId: string | null,
  remoteVersion: number | null = null,
): DocumentHighlightsApi {
  const token = useUserStore((s) => s.accessToken)
  const [highlights, setHighlights] = React.useState<Highlight[]>([])
  const lastAppliedVersionRef = React.useRef(-1)
  const fetchedDocRef = React.useRef<string | null>(null)

  // Responses from concurrent in-flight requests can arrive out of order;
  // the doc version is monotonic, so older snapshots are dropped.
  const applyServerState = React.useCallback((res: HighlightsResponse) => {
    if (!Array.isArray(res.highlights)) return
    if (res.version <= lastAppliedVersionRef.current) return
    lastAppliedVersionRef.current = res.version
    setHighlights(res.highlights)
  }, [])

  // The local backend signals the per-doc highlight cap with a 200 + no
  // highlights array; treat it as a failure instead of wiping state.
  const applyResponse = React.useCallback((res: HighlightsResponse) => {
    if (!Array.isArray(res.highlights)) throw new Error('Highlight limit reached for this page')
    markOwnWrite(res.id, res.version)
    applyServerState(res)
  }, [applyServerState])

  React.useEffect(() => {
    setHighlights([])
    lastAppliedVersionRef.current = -1
    fetchedDocRef.current = null
  }, [documentId])

  // One fetch path for both the initial load and external version bumps (the
  // agent replying via MCP), so responses can't race each other past the
  // version guard. Own writes are already applied from their POST responses.
  React.useEffect(() => {
    if (!documentId || (!isLocal && !token)) return
    const isInitialLoad = fetchedDocRef.current !== documentId
    if (!isInitialLoad) {
      if (remoteVersion == null || remoteVersion <= lastAppliedVersionRef.current) return
      if (isOwnWrite(documentId, remoteVersion)) return
    }
    fetchedDocRef.current = documentId
    let cancelled = false
    apiFetch<HighlightsResponse>(`/v1/documents/${documentId}/highlights`, token ?? '')
      .then((res) => {
        if (!cancelled) applyServerState(res)
      })
      .catch(() => {
        // Page renders fine without highlights; the next version bump retries.
      })
    return () => {
      cancelled = true
    }
  }, [applyServerState, documentId, remoteVersion, token])

  // All mutations apply optimistically and roll back on failure, so the UI
  // never waits on the network round-trip.
  const saveHighlight = React.useCallback(
    async (highlight: Highlight): Promise<void> => {
      if (!documentId) return
      setHighlights((prev) => [...prev, highlight])
      try {
        const res = await apiFetch<HighlightsResponse>(
          `/v1/documents/${documentId}/highlights`,
          token ?? '',
          { method: 'POST', body: JSON.stringify({ highlight }) },
        )
        applyResponse(res)
      } catch (err) {
        setHighlights((prev) => prev.filter((h) => h.id !== highlight.id))
        throw err
      }
    },
    [applyResponse, documentId, token],
  )

  const updateComment = React.useCallback(
    async (id: string, comment: string | null): Promise<void> => {
      if (!documentId) return
      const existing = highlights.find((h) => h.id === id)
      if (!existing) return
      const highlight: Highlight = { ...existing, comment: comment?.trim() || null }
      setHighlights((prev) => prev.map((h) => (h.id === id ? highlight : h)))
      try {
        const res = await apiFetch<HighlightsResponse>(
          `/v1/documents/${documentId}/highlights`,
          token ?? '',
          { method: 'POST', body: JSON.stringify({ highlight }) },
        )
        applyResponse(res)
      } catch (err) {
        // Restore only if the entry is still our optimistic object — a newer
        // edit may have replaced it while this request was in flight.
        setHighlights((prev) => prev.map((h) => (h === highlight ? existing : h)))
        throw err
      }
    },
    [applyResponse, documentId, highlights, token],
  )

  const removeHighlight = React.useCallback(
    async (id: string): Promise<void> => {
      if (!documentId) return
      const existing = highlights.find((h) => h.id === id)
      if (!existing) return
      setHighlights((prev) => prev.filter((h) => h.id !== id))
      try {
        const res = await apiFetch<HighlightsResponse>(
          `/v1/documents/${documentId}/highlights/${encodeURIComponent(id)}`,
          token ?? '',
          { method: 'DELETE' },
        )
        applyResponse(res)
      } catch (err) {
        setHighlights((prev) => (prev.some((h) => h.id === id) ? prev : [...prev, existing]))
        throw err
      }
    },
    [applyResponse, documentId, highlights, token],
  )

  return { highlights, saveHighlight, updateComment, removeHighlight }
}

export function useWikiHighlights(documentId: string | null, remoteVersion: number | null = null): WikiHighlightsApi {
  const api = useDocumentHighlights(documentId, remoteVersion)

  const saveHighlight = React.useCallback(
    (textAnchor: TextAnchor, comment: string | null, id?: string): Promise<void> => api.saveHighlight({
      id: id ?? createHighlightId(),
      type: 'text',
      anchor: null,
      textAnchor,
      pdfAnchor: null,
      comment: comment?.trim() || null,
      color: 'yellow',
      createdAt: new Date().toISOString(),
    }),
    [api.saveHighlight],
  )

  return {
    highlights: api.highlights,
    saveHighlight,
    updateComment: api.updateComment,
    removeHighlight: api.removeHighlight,
  }
}

```

### Core Architecture Module: `web/src/lib/utils.ts`
```
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const FILENAME_BAD_CHARS = /[/\\:*?"<>|]/g

/** Strip characters that are invalid in filenames */
export function sanitizeTitle(title: string): string {
  return title.replace(FILENAME_BAD_CHARS, '')
}

/** Convert a note title to a safe filename */
export function toNoteFilename(title: string): string {
  const clean = sanitizeTitle(title)
  const base = clean || 'Untitled'
  return base.endsWith('.md') ? base : base + '.md'
}

```

### Core Architecture Module: `web/src/lib/utils/folders.ts`
```
/**
 * Get the immediate child folder names at a given path.
 *
 * Given folders = ["/", "/Reports/", "/Reports/2024/", "/Invoices/"]
 * and currentPath = "/", returns ["Reports", "Invoices"]
 *
 * Given currentPath = "/Reports/", returns ["2024"]
 */
export function getChildFolderNames(folders: string[], currentPath: string): string[] {
  const names = new Set<string>()
  const prefix = currentPath.endsWith('/') ? currentPath : currentPath + '/'

  for (const folder of folders) {
    if (folder === prefix || !folder.startsWith(prefix)) continue
    const rest = folder.slice(prefix.length)
    const slashIdx = rest.indexOf('/')
    const name = slashIdx === -1 ? rest : rest.slice(0, slashIdx)
    if (name) names.add(name)
  }

  return Array.from(names).sort((a, b) => a.localeCompare(b))
}

/**
 * Build an absolute folder path from a parent path and folder name.
 * joinPath("/", "Reports") => "/Reports/"
 * joinPath("/Reports/", "2024") => "/Reports/2024/"
 */
export function joinPath(parentPath: string, folderName: string): string {
  const base = parentPath.endsWith('/') ? parentPath : parentPath + '/'
  return base + folderName + '/'
}

/**
 * Parse a path into breadcrumb segments.
 * "/" => [{ label: "Root", path: "/" }]
 * "/Reports/2024/" => [
 *   { label: "Root", path: "/" },
 *   { label: "Reports", path: "/Reports/" },
 *   { label: "2024", path: "/Reports/2024/" },
 * ]
 */
export function parseBreadcrumbs(currentPath: string): { label: string; path: string }[] {
  const segments: { label: string; path: string }[] = [{ label: 'Root', path: '/' }]
  if (currentPath === '/') return segments

  const parts = currentPath.split('/').filter(Boolean)
  let accumulated = '/'
  for (const part of parts) {
    accumulated += part + '/'
    segments.push({ label: part, path: accumulated })
  }

  return segments
}

/**
 * Get parent path.
 * "/Reports/2024/" => "/Reports/"
 * "/Reports/" => "/"
 * "/" => "/"
 */
export function getParentPath(path: string): string {
  if (path === '/') return '/'
  // Remove trailing slash, find last slash, keep everything up to and including it
  const trimmed = path.endsWith('/') ? path.slice(0, -1) : path
  const lastSlash = trimmed.lastIndexOf('/')
  return lastSlash <= 0 ? '/' : trimmed.slice(0, lastSlash + 1)
}

/**
 * Check if childPath is a descendant of parentPath.
 * isDescendant("/Reports/2024/", "/Reports/") => true
 * isDescendant("/Reports/", "/Reports/") => false (same path is not a descendant)
 * isDescendant("/Other/", "/Reports/") => false
 */
export function isDescendant(childPath: string, parentPath: string): boolean {
  return childPath !== parentPath && childPath.startsWith(parentPath)
}

/**
 * When renaming/moving a folder, compute the new path for descendants.
 * rebasePath("/Reports/2024/Q1/", "/Reports/", "/Archive/Reports/")
 * => "/Archive/Reports/2024/Q1/"
 */
export function rebasePath(path: string, oldPrefix: string, newPrefix: string): string {
  if (!path.startsWith(oldPrefix)) return path
  return newPrefix + path.slice(oldPrefix.length)
}

/**
 * Filter documents to those at exactly `currentPath` (not nested deeper).
 */
export function filterDocumentsAtPath<T extends { path?: string | null }>(documents: T[], currentPath: string): T[] {
  return documents.filter((doc) => (doc.path ?? '/') === currentPath)
}

```

### Core Architecture Module: `api/auth.py`
```
import asyncio
import logging
import time
from collections import OrderedDict

import httpx
import jwt
from config import settings
from fastapi import HTTPException, Request
from jwt import PyJWK

logger = logging.getLogger(__name__)

# Bounded TTL ensures we periodically pick up Supabase key rotations.
_jwks_cache: dict[str, PyJWK] = {}
_jwks_last_fetch: float = 0
_jwks_last_refresh_attempt: float = 0
_JWKS_TTL_SECONDS = 15 * 60
_JWKS_MIN_REFRESH_SECONDS = 10
_jwks_lock = asyncio.Lock()

# Unknown key IDs are attacker-controlled because the JWT header is parsed
# before signature verification. Keep a small negative cache so repeated misses
# fail locally, and bound it so random kids cannot grow process memory forever.
_UNKNOWN_KID_TTL_SECONDS = 30
_UNKNOWN_KID_CACHE_MAX = 256
_unknown_kids: OrderedDict[str, float] = OrderedDict()

_MAX_TOKEN_LENGTH = 16 * 1024
_MAX_KID_LENGTH = 256


def _jwks_is_stale() -> bool:
    return time.monotonic() - _jwks_last_fetch >= _JWKS_TTL_SECONDS


async def _fetch_jwks() -> None:
    global _jwks_last_fetch
    url = f"{settings.SUPABASE_URL}/auth/v1/.well-known/jwks.json"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, timeout=10)
        resp.raise_for_status()
    data = resp.json()
    new_cache: dict[str, PyJWK] = {}
    for key_data in data.get("keys", []):
        kid = key_data.get("kid")
        if kid:
            new_cache[kid] = PyJWK(key_data)
    _jwks_cache.clear()
    _jwks_cache.update(new_cache)
    for kid in new_cache:
        _unknown_kids.pop(kid, None)
    _jwks_last_fetch = time.monotonic()
    logger.info("Fetched %d JWKS keys from Supabase", len(_jwks_cache))


async def _refresh_jwks_if_needed(force: bool = False, kid: str | None = None) -> None:
    """Refresh JWKS at most once per cooldown, including unknown-kid misses.

    ``kid`` lets a waiter re-check whether another request already fetched the
    key after acquiring the single-flight lock.
    """
    global _jwks_last_refresh_attempt
    async with _jwks_lock:
        if kid and kid in _jwks_cache:
            return

        now = time.monotonic()
        if now - _jwks_last_refresh_attempt < _JWKS_MIN_REFRESH_SECONDS:
            return
        if not force and not _jwks_is_stale():
            return

        # Record attempts, not only successful fetches. Otherwise a JWKS outage
        # turns every authentication request into another outbound HTTP call.
        _jwks_last_refresh_attempt = now
        try:
            await _fetch_jwks()
        except Exception:
            logger.exception("JWKS refresh failed; keeping previous cache")


async def prefetch_jwks() -> None:
    """Eager fetch at app startup so the first request doesn't pay cold-cache cost."""
    global _jwks_last_refresh_attempt
    _jwks_last_refresh_attempt = time.monotonic()
    try:
        await _fetch_jwks()
    except Exception:
        logger.exception("Initial JWKS fetch failed; will retry on first auth")


_EXPECTED_ISSUER = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1"


async def verify_token(token: str) -> str:
    """Verify a Supabase JWT and return the user_id (sub claim). Raises ValueError on failure."""
    if not token or len(token) > _MAX_TOKEN_LENGTH:
        raise ValueError("Invalid token")

    try:
        header = jwt.get_unverified_header(token)
    except jwt.InvalidTokenError:
        raise ValueError("Invalid token")

    kid = header.get("kid")
    if not isinstance(kid, str) or not kid or len(kid) > _MAX_KID_LENGTH:
        raise ValueError("Token missing kid header")

    if _jwks_is_stale():
        await _refresh_jwks_if_needed()

    if kid not in _jwks_cache:
        now = time.monotonic()
        negative_until = _unknown_kids.get(kid)
        if negative_until is not None:
            if negative_until > now:
                raise ValueError("Unknown signing key")
            _unknown_kids.pop(kid, None)

        await _refresh_jwks_if_needed(force=True, kid=kid)
        if kid not in _jwks_cache:
            _unknown_kids[kid] = time.monotonic() + _UNKNOWN_KID_TTL_SECONDS
            _unknown_kids.move_to_end(kid)
            while len(_unknown_kids) > _UNKNOWN_KID_CACHE_MAX:
                _unknown_kids.popitem(last=False)
            raise ValueError("Unknown signing key")

    jwk = _jwks_cache[kid]
    try:
        payload = jwt.decode(
            token,
            jwk.key,
            algorithms=["ES256"],
            audience="authenticated",
            issuer=_EXPECTED_ISSUER,
            leeway=30,
            options={
                "require": ["exp", "iat", "sub", "aud", "iss"],
                "verify_exp": True,
                "verify_iat": True,
                "verify_nbf": True,
            },
        )
    except jwt.InvalidTokenError as e:
        logger.debug("JWT verification failed: %s", e)
        raise ValueError("Invalid token")

    user_id = payload.get("sub")
    if not user_id:
        raise ValueError("Token missing sub claim")

    return user_id


async def get_current_user(request: Request) -> str:
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization header")

    token = auth_header.removeprefix("Bearer ").strip()
    try:
        return await verify_token(token)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid token")

```

### Core Architecture Module: `api/config.py`
```
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file="../.env", extra="ignore")

    MODE: Literal["local", "hosted"] = "local"
    WORKSPACE_PATH: str = "."

    DATABASE_URL: str = ""
    # Direct (non-pooler) connection used only for the long-lived LISTEN/NOTIFY
    # socket. Supavisor recycles pooled sessions, which silently kills LISTEN;
    # a direct connection sidesteps that. Falls back to DATABASE_URL when unset.
    DIRECT_DATABASE_URL: str = ""
    SUPABASE_URL: str = ""
    SUPABASE_JWT_SECRET: str = ""
    VOYAGE_API_KEY: str = ""
    TURBOPUFFER_API_KEY: str = ""
    EMBEDDING_MODEL: str = "voyage-4-lite"
    EMBEDDING_DIM: int = 512
    LOGFIRE_TOKEN: str = ""
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "us-east-1"
    S3_BUCKET: str = "supavault-documents"
    MISTRAL_API_KEY: str = ""
    CLOUDFLARE_ACCOUNT_ID: str = ""
    CLOUDFLARE_AUTH_TOKEN: str = ""
    CLOUDFLARE_AI_GATEWAY_ID: str = ""
    QUIZ_GRADE_DAILY_LIMIT: int = Field(default=100, ge=1, le=10_000)
    PDF_BACKEND: str = "opendataloader"  # "opendataloader" or "mistral"
    STAGE: str = "dev"
    APP_URL: str = "http://localhost:3000"
    API_URL: str = "http://localhost:8000"
    # Comma-separated serialized origins. Override this with the ID shown by
    # chrome://extensions when using an unpacked development build.
    LOCAL_EXTENSION_ORIGINS: str = (
        "chrome-extension://dibilaenlekndomfbampadehjeahemha"
    )

    QUOTA_MAX_PAGES_PER_DOC: int = 300  # max pages per single document
    QUOTA_MAX_STORAGE_BYTES: int = 1_073_741_824  # 1 GB per user

    CONVERTER_URL: str = ""
    CONVERTER_SECRET: str = ""

    GLOBAL_OCR_ENABLED: bool = True
    GLOBAL_MAX_PAGES: int = 1_000_000
    GLOBAL_MAX_USERS: int = 10_000

    SENTRY_DSN: str = ""

    @model_validator(mode="after")
    def require_isolated_parser_for_hosted_uploads(self) -> "Settings":
        """Never let the hosted upload service fall back to local parsing.

        ``main.lifespan`` constructs S3 and OCR services when the access key
        and bucket are configured. Validate the matching condition while
        settings are loaded, before startup can initialize JWKS, Postgres, or
        any other network client.
        """
        hosted_uploads_enabled = bool(self.AWS_ACCESS_KEY_ID and self.S3_BUCKET)
        if (
            self.MODE == "hosted"
            and hosted_uploads_enabled
            and not self.CONVERTER_URL.strip()
        ):
            raise ValueError(
                "CONVERTER_URL is required when hosted uploads are enabled; "
                "the hosted API must not parse uploaded PDF or Office files in-process"
            )
        if (
            self.MODE == "hosted"
            and hosted_uploads_enabled
            and not self.CONVERTER_SECRET.strip()
        ):
            raise ValueError(
                "CONVERTER_SECRET is required when hosted uploads are enabled"
            )
        return self

    @property
    def listen_database_url(self) -> str:
        """Connection for the LISTEN loop — direct if configured, else the pooler."""
        return self.DIRECT_DATABASE_URL or self.DATABASE_URL

    @property
    def local_extension_origins(self) -> tuple[str, ...]:
        return tuple(
            origin.strip()
            for origin in self.LOCAL_EXTENSION_ORIGINS.split(",")
            if origin.strip()
        )


settings = Settings()

```

### Core Architecture Module: `api/deps.py`
```
import asyncio
import inspect
import json
from typing import Annotated, AsyncGenerator

from fastapi import Depends, Request
from scoped_db import ScopedDB

DB_ACQUIRE_TIMEOUT_SECONDS = 10.0


async def _acquire_connection(pool):
    """Acquire without allowing a saturated pool to hang a request forever."""
    try:
        parameters = inspect.signature(pool.acquire).parameters.values()
        supports_timeout = any(
            parameter.name == "timeout"
            or parameter.kind is inspect.Parameter.VAR_KEYWORD
            for parameter in parameters
        )
    except (TypeError, ValueError):
        supports_timeout = False

    if supports_timeout:
        return await pool.acquire(timeout=DB_ACQUIRE_TIMEOUT_SECONDS)
    return await asyncio.wait_for(
        pool.acquire(),
        timeout=DB_ACQUIRE_TIMEOUT_SECONDS,
    )


async def get_pool(request: Request):
    return request.app.state.pool


async def get_user_id(request: Request) -> str:
    """Authenticate and return user_id.

    In local mode, auth_provider is a LocalAuthProvider (always returns the fixed user).
    In hosted mode, auth_provider is None and we fall through to Supabase JWKS.
    The auth path is determined at startup, not here.
    """
    auth_provider = request.app.state.auth_provider
    if auth_provider:
        return await auth_provider.get_current_user(request)
    from auth import get_current_user
    return await get_current_user(request)


async def get_user_service(request: Request):
    user_id = await get_user_id(request)
    return request.app.state.factory.user_service(user_id)


async def get_kb_service(request: Request):
    user_id = await get_user_id(request)
    return request.app.state.factory.kb_service(user_id)


async def get_document_service(request: Request):
    user_id = await get_user_id(request)
    return request.app.state.factory.document_service(user_id)


async def get_scoped_db(
    request: Request,
    pool: Annotated = Depends(get_pool),
) -> AsyncGenerator[ScopedDB, None]:
    """Scoped DB connection.

    In local mode (pool is None, sqlite_db is set), returns a thin wrapper
    around SQLite — no RLS, no transaction management.
    In hosted mode, returns a proper RLS-enforced Postgres connection.

    The branching is on app.state.pool being None, which is set once at startup.
    """
    if pool is None:
        db = request.app.state.sqlite_db
        user_id = await get_user_id(request)
        yield ScopedDB(None, db, user_id)
        return

    from auth import get_current_user
    user_id = await get_current_user(request)
    conn = await _acquire_connection(pool)
    try:
        # The transaction context covers startup too. If BEGIN, RLS setup,
        # request handling, or cancellation fails, it rolls back before the
        # connection is returned to the pool.
        async with conn.transaction():
            claims = json.dumps({"sub": user_id})
            await conn.execute("SET LOCAL ROLE authenticated")
            await conn.execute("SELECT set_config('request.jwt.claims', $1, true)", claims)
            yield ScopedDB(pool, conn, user_id)
    finally:
        await asyncio.shield(pool.release(conn))

```

### Core Architecture Module: `api/domain/file_types.py`
```
"""Shared file-type classification for local mode (watcher, processor, upload)."""

PDF_TYPES = frozenset({"pdf"})
OFFICE_TYPES = frozenset({"pptx", "ppt", "docx", "doc"})
SPREADSHEET_TYPES = frozenset({"xlsx", "xls"})
IMAGE_TYPES = frozenset({"png", "jpg", "jpeg", "webp", "gif"})
HTML_TYPES = frozenset({"html", "htm"})

# Read inline and chunked as plain text — no extraction backend needed.
SIMPLE_TEXT_TYPES = frozenset({
    "md", "txt", "csv", "svg", "json", "xml",
    "yaml", "yml", "toml", "ini", "cfg", "rst", "tex", "latex",
})

# Need an extraction/processing backend before they're searchable. HTML is here
# (not in SIMPLE_TEXT_TYPES) because it goes through the webmd parser.
EXTRACTION_TYPES = PDF_TYPES | OFFICE_TYPES | SPREADSHEET_TYPES | HTML_TYPES

# Files routed through the local background processor. Images do not need text
# extraction, but the processor still finalizes their metadata/status, so they
# must participate in upload dispatch and interrupted-work reconciliation.
PROCESSING_TYPES = EXTRACTION_TYPES | IMAGE_TYPES

```

### Core Architecture Module: `api/domain/local_processor.py`
```
"""Local document processor — runs extraction without S3 or Postgres.

Processes files directly from the workspace filesystem and updates SQLite.
Respects PDF_BACKEND config and optional Mistral/LibreOffice backends.
"""

import asyncio
import contextvars
import functools
import json
import logging
import os
import shutil
import signal
import subprocess
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path

import aiosqlite
from config import settings
from domain.file_types import (
    HTML_TYPES,
    IMAGE_TYPES,
    OFFICE_TYPES,
    PDF_TYPES,
    PROCESSING_TYPES,
    SIMPLE_TEXT_TYPES,
    SPREADSHEET_TYPES,
)
from domain.watcher import mark_written
from infra.db.sqlite import SQLiteDocumentRepository, create_pool
from services.extracted_assets import build_pdf_image_assets

logger = logging.getLogger(__name__)

# Cap concurrent fire-and-forget extractions so a burst of dropped files can't
# spawn one LibreOffice/OCR job (and connection) per file at once.
PROCESS_CONCURRENCY = 4
_process_semaphore = asyncio.Semaphore(PROCESS_CONCURRENCY)


async def _to_thread_joined(func, /, *args, **kwargs):
    """Run blocking work in a thread and join it before propagating cancellation.

    `asyncio.to_thread()` cancels only its asyncio waiter, not the underlying
    thread. This helper keeps the executor future alive under cancellation and
    waits for the real worker to finish before cleanup/status transitions run.
    """
    loop = asyncio.get_running_loop()
    context = contextvars.copy_context()
    call = functools.partial(context.run, func, *args, **kwargs)
    worker = loop.run_in_executor(None, call)

    try:
        return await asyncio.shield(worker)
    except asyncio.CancelledError:
        # A shutdown may send more than one cancellation. Keep shielding until
        # the executor future is actually done; it is a Future rather than an
        # asyncio Task, so loop-wide task cancellation cannot cancel it behind
        # our back while its thread continues running.
        while not worker.done():
            try:
                await asyncio.shield(worker)
            except asyncio.CancelledError:
                continue
            except BaseException:
                break

        # Retrieve a post-cancellation worker exception so it is not reported
        # as unobserved. The request/task cancellation remains authoritative.
        if worker.done():
            try:
                worker.result()
            except BaseException:
                pass
        raise


def _write_bytes_file(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)


def _copy_file(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)


def _find_libreoffice() -> str | None:
    return shutil.which("libreoffice") or shutil.which("soffice")


def _run_process_group(command: list[str], timeout: int) -> subprocess.CompletedProcess:
    """Run a conversion in a process group so timeout cannot orphan children."""
    popen_options: dict = {
        "stdout": subprocess.PIPE,
        "stderr": subprocess.PIPE,
    }
    if os.name == "posix":
        popen_options["start_new_session"] = True
    elif hasattr(subprocess, "CREATE_NEW_PROCESS_GROUP"):  # pragma: no cover - Windows
        popen_options["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP

    proc = subprocess.Popen(command, **popen_options)
    try:
        stdout, stderr = proc.communicate(timeout=timeout)
    except subprocess.TimeoutExpired as error:
        if proc.poll() is None:
            if os.name == "posix":
                try:
                    os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
                except ProcessLookupError:
                    pass
            else:  # pragma: no cover - Windows
                subprocess.run(
                    ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    check=False,
                )
                if proc.poll() is None:
                    proc.kill()
        proc.wait()
        raise TimeoutError(f"Conversion timed out after {timeout} seconds") from error

    return subprocess.CompletedProcess(command, proc.returncode, stdout, stderr)


def _list_pdf_files(directory: Path) -> list[Path]:
    return list(directory.glob("*.pdf"))


def _encode_file_base64(path: Path) -> str:
    import base64

    return base64.b64encode(path.read_bytes()).decode()


def _extract_spreadsheet_content(file_path: Path) -> list[tuple[str, str]]:
    from openpyxl import load_workbook

    workbook = load_workbook(str(file_path), read_only=True, data_only=True)
    try:
        sheets: list[tuple[str, str]] = []
        for sheet_name in workbook.sheetnames:
            worksheet = workbook[sheet_name]
            rows = [
                " | ".join(str(cell) if cell is not None else "" for cell in row)
                for row in worksheet.iter_rows(values_only=True)
            ]
            sheets.append((sheet_name, "\n".join(rows)))
        return sheets
    finally:
        workbook.close()


def _extract_html_content(file_path: Path) -> str:
    raw_html = file_path.read_text(encoding="utf-8", errors="replace")

    try:
        from html_parser import Parser

        parser = Parser(raw_html, content_only=True)
        return parser.parse().content
    except Exception:
        return raw_html


async def process_document(db: aiosqlite.Connection, doc_id: str, workspace: Path) -> None:
    """Atomically claim a pending document, then extract text, chunk, update index."""
    claim = await db.execute(
        "UPDATE documents SET status = 'processing', error_message = NULL, "
        "updated_at = datetime('now') WHERE id = ? AND status = 'pending'",
        (doc_id,),
    )
    try:
        await db.commit()
    except asyncio.CancelledError:
        if claim.rowcount != 0:
            try:
                await _restore_cancelled_claim(db, doc_id)
            except Exception:
                logger.exception("Failed to restore cancelled document %s", doc_id[:8])
        raise
    if claim.rowcount == 0:
        return

    filename = doc_id[:8]
    try:
        cursor = await db.execute(
            "SELECT filename, file_type, relative_path FROM documents WHERE id = ?",
            (doc_id,),
        )
        row = await cursor.fetchone()
        if not row:
            logger.warning("Document %s not found", doc_id[:8])
            return

        cols = [d[0] for d in cursor.description]
        doc = dict(zip(cols, row))
        filename = doc["filename"]

        file_type = doc["file_type"] or ""
        file_path = workspace / doc["relative_path"]

        if not await _to_thread_joined(file_path.is_file):
            await db.execute(
                "UPDATE documents SET status = 'failed', error_message = 'File not found', "
                "updated_at = datetime('now') WHERE id = ?",
                (doc_id,),
            )
            await db.commit()
            return

        if file_type in PDF_TYPES:
            await _process_pdf(db, doc_id, file_path, workspace)
        elif file_type in OFFICE_TYPES:
            await _process_office(db, doc_id, file_path, workspace)
        elif file_type in SPREADSHEET_TYPES:
            await _process_spreadsheet(db, doc_id, file_path)
        elif file_type in IMAGE_TYPES:
            await _process_image(db, doc_id)
        elif file_type in HTML_TYPES:
            await _process_html(db, doc_id, file_path)
        else:
            await db.execute(
                "UPDATE documents SET status = 'ready', updated_at = datetime('now') WHERE id = ?",
                (doc_id,),
            )
            await db.commit()

        logger.info("Processed %s: %s", filename, file_type)

    except asyncio.CancelledError:
        # A shutdown can cancel extraction after the pending -> processing
        # claim. Make the document retryable before propagating cancellation.
        try:
            await _restore_cancelled_claim(db, doc_id)
        except Exception:
            logger.exception("Failed to restore cancelled document %s", doc_id[:8])
        raise
    except Exception as e:
        error_msg = str(e)[:500]
        try:
            await db.execute(
                "UPDATE documents SET status = 'failed', error_message = ?, "
                "updated_at = datetime('now') WHERE id = ?",
                (error_msg, doc_id),
            )
            await db.commit()
        except Exception:
            logger.exception("Failed to persist extraction failure for %s", doc_id[:8])
        logger.error("Failed to process %s: %s", filename, e)


async def _reset_processing_to_pending(db: aiosqlite.Connection, doc_id: str) -> None:
    await db.execute(
        "UPDATE documents SET status = 'pending', error_message = NULL, "
        "updated_at = datetime('now') WHERE id = ? AND status = 'processing'",
        (doc_id,),
    )
    await db.commit()


async def _restore_cancelled_claim(db: aiosqlite.Connection, doc_id: str) -> None:
    """Finish status cleanup even if shutdown sends a second cancellation."""
    cleanup = asyncio.create_task(_reset_processing_to_pending(db, doc_id))
    try:
        await asyncio.shield(cleanup)
    except asyncio.CancelledError:
        await cleanup


async def process_document_isolated(workspace: Path, doc_id: str) -> None:
    """Process a document on its own connection so fire-and-forget tasks can't
    flush another writer's open transaction on a shared connection."""
    try:
        async with _process_semaphore:
            db = await create_pool(str(workspace / ".llmwiki" / "index.db"), init_schema=False)
            try:
                await process_document(db, doc_id, workspace)
            f
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #91** (2026-10-02): **Bump next from 16.2.12 to 16.3.4 in /web**
  *Symptoms*: Bumps [next](https://github.com/vercel/next.js) from 16.2.12 to 16.3.4. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/vercel/next.js/releases">next's releases</a>.</em></p> <blockquote> <h2>v16.3.4</h2> <p>Follow-up release to <a href="https://github.com/vercel/next.js/releases/tag/v16.3.3">v16.3.3</a> re-enabling AVIF Image Optimization (<a href="https://redirect.github.com/vercel/next.js/pull/97949">#97949</a>).</p> <p>The following bug fixes have been backported. It does <strong>not</strong> include all pending features/changes on canary.</p> <ul> <li>testmode: Fix infinite recursion in testmode passthrough fetch (<a href="https://redirect.github.com/vercel/next.js/issues/97691">#97691</a>)</li> <li>Fix build error when aliasing typescript to <code>@​typescript/typescript6</code> (<a href="https://redirect.github.com/vercel/next.js/issues/97997">#97997</a>)</li> <li>Fix unset crossOrigin in Turbopack manifests (<a href="https://redirect.github.com/vercel/next.js/issues/97930">#97930</a>)</li> </ul> <h3>Credits</h3> <p>Huge thanks to <a href="https://github.com/eps1lon"><code>@​eps1lon</code></a>, <a href="https://github.com/mischnic"><code>@​mischnic</code></a>, and <a href="https://github.com/timneutkens"><code>@​timneutkens</code></a> for helping!</p> <h2>v16.3.3</h2> <p>This release contains security fixes for the following advisories:</p> <p>Critical:</p> <ul> <li><a href="https://github.com/vercel/next.js/security/advisorie
  **Post-Mortem & Fix Analysis**:
  > <h1>Dependency Review</h1> ✅ No vulnerabilities or license issues or OpenSSF Scorecard issues found.<h2>OpenSSF Scorecard</h2> <details><summary>Scorecard details</summary> <table><tr><th>Package</th><th>Version</th><th>Score</th><th>Details</th></tr> <tr><td><a href="https://github.com/vercel/next.js"> npm/@next/env </a></td><td>16.3.4</td>       <td>:green_circle: 6.1</td><td><details><summary>Details</summary><table><tr><th>Check</th><th>Score</th><th>Reason</th></tr><tr><td>Maintained</td><td>:green_circle: 10</td><td>30 commit(s) and 1 issue activity found in the last 90 days -- score normalized to 10</td></tr><tr><td>Code-Review</td><td>:green_circle: 8</td><td>Found 25/30 approved changesets -- score normalized to 8</td></tr><tr><td>Dangerous-Workflow</td><td>:green_circle: 10</td><td>no dangerous workflow patterns detected</td></tr><tr><td>License</td><td>:green_circle: 10</td><td>license file detected</td></tr><tr><td>Token-Permissions</td><td>:warning: 0</td><td>detected GitH
  > Superseded by #97.

- **Issue #80** (2026-08-09): **Pathces**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > <h1>Dependency Review</h1> ✅ No vulnerabilities or license issues or OpenSSF Scorecard issues found.<h2>OpenSSF Scorecard</h2> <details><summary>Scorecard details</summary> <table><tr><th>Package</th><th>Version</th><th>Score</th><th>Details</th></tr> <tr><td> pip/aiohttp </td><td>3.14.3</td>       <td> Unknown</td><td>Unknown</td></tr> <tr><td> pip/cryptography </td><td>50.0.0</td>       <td> Unknown</td><td>Unknown</td></tr> <tr><td><a href="https://github.com/juliangruber/brace-expansion"> npm/brace-expansion </a></td><td>5.0.9</td>       <td>:green_circle: 7.2</td><td><details><summary>Details</summary><table><tr><th>Check</th><th>Score</th><th>Reason</th></tr><tr><td>Token-Permissions</td><td>:green_circle: 10</td><td>GitHub workflow tokens follow principle of least privilege</td></tr><tr><td>Dangerous-Workflow</td><td>:green_circle: 10</td><td>no dangerous workflow patterns detected</td></tr><tr><td>Pinned-Dependencies</td><td>:green_circle: 10</td><td>all dependencies are pinned

- **Issue #79** (2026-09-03): **Bump postcss from 8.5.18 to 8.5.23 in /extension**
  *Symptoms*: Bumps [postcss](https://github.com/postcss/postcss) from 8.5.18 to 8.5.23. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/postcss/postcss/releases">postcss's releases</a>.</em></p> <blockquote> <h2>8.5.23</h2> <ul> <li>Do not load source map without <code>opts.from</code> for security reasons.</li> </ul> <h2>8.5.22</h2> <ul> <li>Fixed custom property losing semicolon before a comment (by <a href="https://github.com/sarathfrancis90"><code>@​sarathfrancis90</code></a>).</li> </ul> <h2>8.5.21</h2> <ul> <li>Fixed childless at-rule losing semicolon before comment (by <a href="https://github.com/sarathfrancis90"><code>@​sarathfrancis90</code></a>).</li> <li>Fixed docs (by <a href="https://github.com/isker"><code>@​isker</code></a>).</li> </ul> <h2>8.5.20</h2> <ul> <li>Fixed missing space if <code>AtRule#params</code> is set after (by <a href="https://github.com/sarathfrancis90"><code>@​sarathfrancis90</code></a>).</li> <li>Fixed mixing AST error on warnings (by <a href="https://github.com/MahinAnowar"><code>@​MahinAnowar</code></a>).</li> </ul> <h2>8.5.19</h2> <ul> <li>Fixed cleaning <code>before</code> for new nodes inserted to <code>Root</code> (by <a href="https://github.com/MahinAnowar"><code>@​MahinAnowar</code></a>).</li> </ul> </blockquote> </details> <details> <summary>Changelog</summary> <p><em>Sourced from <a href="https://github.com/postcss/postcss/blob/main/CHANGELOG.md">postcss's changelog</a>.</em></p> <blockquote> <h2>8.5.2
  **Post-Mortem & Fix Analysis**:
  > <h1>Dependency Review</h1> ✅ No vulnerabilities or license issues or OpenSSF Scorecard issues found.<h2>OpenSSF Scorecard</h2> <table><tr><th>Package</th><th>Version</th><th>Score</th><th>Details</th></tr> <tr><td><a href="https://github.com/ai/nanoid"> npm/nanoid </a></td><td>3.3.17</td>       <td>:green_circle: 6.5</td><td><details><summary>Details</summary><table><tr><th>Check</th><th>Score</th><th>Reason</th></tr><tr><td>Code-Review</td><td>:warning: 0</td><td>Found 1/30 approved changesets -- score normalized to 0</td></tr><tr><td>Packaging</td><td>:warning: -1</td><td>packaging workflow not detected</td></tr><tr><td>Security-Policy</td><td>:green_circle: 10</td><td>security policy file detected</td></tr><tr><td>Binary-Artifacts</td><td>:green_circle: 10</td><td>no binaries found in the repo</td></tr><tr><td>Maintained</td><td>:green_circle: 10</td><td>30 commit(s) and 7 issue activity found in the last 90 days -- score normalized to 10</td></tr><tr><td>Dangerous-Workflow</td><td>
  > Superseded: extension/package-lock.json is on postcss 8.5.23 (8.5.26 on dev).
  > OK, I won't notify you again about this release, but will get in touch when a new version is available. If you'd rather skip all updates until the next major or minor version, let me know by commenting `@dependabot ignore this major version` or `@dependabot ignore this minor version`.  If you change your mind, just re-open this PR and I'll resolve any conflicts on it.

- **Issue #78** (2026-09-03): **Bump cryptography from 48.0.1 to 50.0.0 in /api**
  *Symptoms*: Bumps [cryptography](https://github.com/pyca/cryptography) from 48.0.1 to 50.0.0. <details> <summary>Changelog</summary> <p><em>Sourced from <a href="https://github.com/pyca/cryptography/blob/main/CHANGELOG.rst">cryptography's changelog</a>.</em></p> <blockquote> <p>50.0.0 - 2026-07-31</p> <pre><code> * **SECURITY ISSUE**:   :func:`~cryptography.hazmat.primitives.serialization.pkcs7.pkcs7_decrypt_der`   and its PEM and S/MIME variants no longer expose distinguishable errors or   timing when unwrapping a ``RecipientInfo``'s ``encryptedKey``, which could   act as a Bleichenbacher oracle for callers that decrypt untrusted messages.   A random key is now substituted on failure, as described in :rfc:`3218`.   Credit to **@X1AOxiang** for reporting the issue. **CVE-2026-69247** * Deprecated Diffie-Hellman key exchange over finite fields (FFDH).   Everything FFDH is deprecated, including the types in   ``cryptography.hazmat.primitives.asymmetric.dh`` and loading FFDH keys or   parameters with the key loading APIs. Users should migrate to a more   modern key exchange algorithm. * Added ``xof()`` class methods to   :class:`~cryptography.hazmat.primitives.hashes.SHAKE128` and   :class:`~cryptography.hazmat.primitives.hashes.SHAKE256` for constructing   algorithm instances configured for use with   :class:`~cryptography.hazmat.primitives.hashes.XOFHash`. * The :mod:`X.509 verification &lt;cryptography.x509.verification&gt;` APIs are now   considered stable and are subject to our API sta
  **Post-Mortem & Fix Analysis**:
  > <h1>Dependency Review</h1> ✅ No vulnerabilities or license issues or OpenSSF Scorecard issues found.<h2>OpenSSF Scorecard</h2> <table><tr><th>Package</th><th>Version</th><th>Score</th><th>Details</th></tr> <tr><td> pip/cryptography </td><td>50.0.0</td>       <td> Unknown</td><td>Unknown</td></tr> </table><h2>Scanned Files</h2> <ul><li>api/requirements.txt</li></ul>   <!-- dependency-review-pr-comment-marker -->
  > Already on master: api/requirements.txt has cryptography==50.0.0.
  > OK, I won't notify you again about this release, but will get in touch when a new version is available. If you'd rather skip all updates until the next major or minor version, let me know by commenting `@dependabot ignore this major version` or `@dependabot ignore this minor version`.  If you change your mind, just re-open this PR and I'll resolve any conflicts on it.

- **Issue #77** (2026-09-03): **Bump aiohttp from 3.14.1 to 3.14.3 in /api**
  *Symptoms*: Bumps [aiohttp](https://github.com/aio-libs/aiohttp) from 3.14.1 to 3.14.3. <details> <summary>Changelog</summary> <p><em>Sourced from <a href="https://github.com/aio-libs/aiohttp/blob/master/CHANGES.rst">aiohttp's changelog</a>.</em></p> <blockquote> <h1>3.14.3 (2026-07-22)</h1> <h2>Bug fixes</h2> <ul> <li> <p>Fixed the client dropping only the first <code>Authorization</code>, <code>Cookie</code> and <code>Proxy-Authorization</code> header when a redirect crossed an origin -- by :user:<code>arshsmith1</code>.</p> <p><em>Related issues and pull requests on GitHub:</em> :issue:<code>13180</code>.</p> </li> <li> <p>Fixed error message construction in the C HTTP parser -- by :user:<code>bdraco</code>.</p> <p><em>Related issues and pull requests on GitHub:</em> :issue:<code>13222</code>.</p> </li> </ul> <hr /> <h1>3.14.2 (2026-07-20)</h1> <h2>Bug fixes</h2> <ul> <li> <p>Fixed :py:attr:<code>~aiohttp.web.StreamResponse.last_modified</code> rounding a :class:<code>datetime.datetime</code> with a fractional second down.</p> <p><em>Related issues and pull requests on GitHub:</em> :issue:<code>5303</code>.</p> </li> <li> <p>Fixed resolving <code>localhost</code> on Windows to fall back without <code>AI_ADDRCONFIG</code> when the first lookup fails, so <code>localhost</code> still works without an active network.</p> <p><em>Related issues and pull requests on GitHub:</em> :issue:<code>5357</code>.</p> </li> </ul> <!-- raw HTML omitted --> </blockquote> <p>... (truncated)</p> </details
  **Post-Mortem & Fix Analysis**:
  > <h1>Dependency Review</h1> The following issues were found:<ul><li>✅ 0 vulnerable package(s)</li><li>✅ 0 package(s) with incompatible licenses</li><li>✅ 0 package(s) with invalid SPDX license definitions</li><li>⚠️ 1 package(s) with unknown licenses.</li></ul> See the Details below.<h2>License Issues</h2> <h4><em>api/requirements.txt</em></h4> <table><tr><td>Package</td><td>Version</td><td>License</td><td>Issue Type</td></tr><tr><td>aiohttp</td><td>3.14.3</td><td>Null</td><td>Unknown License</td></tr></table> <h2>OpenSSF Scorecard</h2> <table><tr><th>Package</th><th>Version</th><th>Score</th><th>Details</th></tr> <tr><td> pip/aiohttp </td><td>3.14.3</td>       <td> Unknown</td><td>Unknown</td></tr> </table><h2>Scanned Files</h2> <ul><li>api/requirements.txt</li></ul>   <!-- dependency-review-pr-comment-marker -->
  > Already on master: api/requirements.txt has aiohttp==3.14.3.
  > OK, I won't notify you again about this release, but will get in touch when a new version is available. If you'd rather skip all updates until the next major or minor version, let me know by commenting `@dependabot ignore this major version` or `@dependabot ignore this minor version`.  If you change your mind, just re-open this PR and I'll resolve any conflicts on it.

- **Issue #76** (2026-07-28): **Bump tar and wxt in /extension**
  *Symptoms*: Removes [tar](https://github.com/isaacs/node-tar). It's no longer used after updating ancestor dependency [wxt](https://github.com/wxt-dev/wxt). These dependencies need to be updated together.  Removes `tar`  Updates `wxt` from 0.19.29 to 0.20.27 <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/wxt-dev/wxt/releases">wxt's releases</a>.</em></p> <blockquote> <h2>wxt v0.20.27</h2> <p><a href="https://github.com/wxt-dev/wxt/compare/wxt-v0.20.26...wxt-v0.20.27">compare changes</a></p> <h3>🚀 Enhancements</h3> <ul> <li>Add warning for missing Firefox extension ID in manifest (<a href="https://redirect.github.com/wxt-dev/wxt/pull/2293">#2293</a>)</li> </ul> <h3>🩹 Fixes</h3> <ul> <li>Correct broken link at react router in createhashrouter (<a href="https://redirect.github.com/wxt-dev/wxt/pull/2411">#2411</a>)</li> <li>Rename <code>ManifestPermissions</code> to <code>ManifestPermission</code> of types.ts in <code>wxt</code> package (<a href="https://redirect.github.com/wxt-dev/wxt/pull/2430">#2430</a>)</li> </ul> <h3>📖 Documentation</h3> <ul> <li>Add Telsia extension to Showcase (<a href="https://redirect.github.com/wxt-dev/wxt/pull/2368">#2368</a>)</li> <li>Add warning about rem unit inheritance in Shadow Root UI (<a href="https://redirect.github.com/wxt-dev/wxt/pull/2330">#2330</a>)</li> <li>Added &quot;Sound Booster &amp; Equalizer&quot; to showcase (<a href="https://redirect.github.com/wxt-dev/wxt/pull/2381">#2381</a>)</li> <li>Clarify 
  **Post-Mortem & Fix Analysis**:
  > <h1>Dependency Review</h1> ✅ No vulnerabilities or license issues or OpenSSF Scorecard issues found.<h2>OpenSSF Scorecard</h2> <details><summary>Scorecard details</summary> <table><tr><th>Package</th><th>Version</th><th>Score</th><th>Details</th></tr> <tr><td><a href="https://github.com/wxt-dev/wxt"> npm/@wxt-dev/browser </a></td><td>0.2.2</td>       <td> Unknown</td><td>Unknown</td></tr> <tr><td><a href="https://github.com/unjs/citty"> npm/citty </a></td><td>0.2.2</td>       <td> Unknown</td><td>Unknown</td></tr> <tr><td><a href="https://github.com/avoidwork/filesize.js"> npm/filesize </a></td><td>11.0.22</td>       <td>:green_circle: 4.7</td><td><details><summary>Details</summary><table><tr><th>Check</th><th>Score</th><th>Reason</th></tr><tr><td>Dangerous-Workflow</td><td>:green_circle: 10</td><td>no dangerous workflow patterns detected</td></tr><tr><td>Security-Policy</td><td>:green_circle: 4</td><td>security policy file detected</td></tr><tr><td>Maintained</td><td>:green_circle: 10
  > Looks like these dependencies are up-to-date now, so this is no longer needed.

- **Issue #75** (2026-09-03): **Bump linkify-it from 5.0.1 to 5.0.2 in /web**
  *Symptoms*: Bumps [linkify-it](https://github.com/markdown-it/linkify-it) from 5.0.1 to 5.0.2. <details> <summary>Changelog</summary> <p><em>Sourced from <a href="https://github.com/markdown-it/linkify-it/blob/master/CHANGELOG.md">linkify-it's changelog</a>.</em></p> <blockquote> <h2>5.0.2 / 2026-07-02</h2> <ul> <li>Fixed DoS in <code>mailto:</code> links (restrict user name to 64 chars).</li> <li>Restricted user/pass part length in links.</li> </ul> </blockquote> </details> <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/markdown-it/linkify-it/commit/50a0c914f834b201cab25ff4faefd1f832b37332"><code>50a0c91</code></a> 5.0.2 released</li> <li><a href="https://github.com/markdown-it/linkify-it/commit/de3b88554b5e465d5fa19914e2a1801ebb3069ef"><code>de3b885</code></a> Update package hooks</li> <li><a href="https://github.com/markdown-it/linkify-it/commit/13effaaa4600d1fcff9f63c38fecdd601bfd83e7"><code>13effaa</code></a> Add package lock</li> <li><a href="https://github.com/markdown-it/linkify-it/commit/39d748dbfc77534e9be04d87cd9f57a13b9b4216"><code>39d748d</code></a> Bump c8</li> <li><a href="https://github.com/markdown-it/linkify-it/commit/00ce8771ac0c3e6784dcacaa1625ca0fc1b62a12"><code>00ce877</code></a> Drop tlds deps</li> <li><a href="https://github.com/markdown-it/linkify-it/commit/ecde82341a1b2e349b03eb01f3e1d2cc105bcd7f"><code>ecde823</code></a> Update benchmark to mitata</li> <li><a href="https://github.com/markdown-it/linkify-it/commit/23c62cdd14ef36e89c175
  **Post-Mortem & Fix Analysis**:
  > <h1>Dependency Review</h1> ✅ No vulnerabilities or license issues or OpenSSF Scorecard issues found.<h2>OpenSSF Scorecard</h2> <table><tr><th>Package</th><th>Version</th><th>Score</th><th>Details</th></tr> <tr><td><a href="https://github.com/toyobayashi/emnapi"> npm/@emnapi/core </a></td><td>1.8.1</td>       <td>:green_circle: 3.6</td><td><details><summary>Details</summary><table><tr><th>Check</th><th>Score</th><th>Reason</th></tr><tr><td>Maintained</td><td>:green_circle: 10</td><td>18 commit(s) and 1 issue activity found in the last 90 days -- score normalized to 10</td></tr><tr><td>Dangerous-Workflow</td><td>:green_circle: 10</td><td>no dangerous workflow patterns detected</td></tr><tr><td>Packaging</td><td>:warning: -1</td><td>packaging workflow not detected</td></tr><tr><td>Code-Review</td><td>:warning: 2</td><td>Found 6/30 approved changesets -- score normalized to 2</td></tr><tr><td>CII-Best-Practices</td><td>:warning: 0</td><td>no effort to earn an OpenSSF best practices badge d
  > Already on master: linkify-it is pinned to 5.0.2 via the web `overrides` block.
  > OK, I won't notify you again about this release, but will get in touch when a new version is available. If you'd rather skip all updates until the next major or minor version, let me know by commenting `@dependabot ignore this major version` or `@dependabot ignore this minor version`.  If you change your mind, just re-open this PR and I'll resolve any conflicts on it.

- **Issue #73** (2026-07-28): **Bump mcp from 1.27.0 to 1.28.1 in /mcp**
  *Symptoms*: Bumps [mcp](https://github.com/modelcontextprotocol/python-sdk) from 1.27.0 to 1.28.1. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/modelcontextprotocol/python-sdk/releases">mcp's releases</a>.</em></p> <blockquote> <h2>v1.28.0</h2> <h2>Deprecations</h2> <p>Two API surfaces now emit <code>DeprecationWarning</code> ahead of their removal in v2. Nothing is removed in 1.x, and the warnings fire only when the deprecated API is <em>called</em> - importing the modules stays silent.</p> <ul> <li><strong>WebSocket transport</strong> - <code>mcp.client.websocket.websocket_client</code> and <code>mcp.server.websocket.websocket_server</code><code>modelcontextprotocol/typescript-sdk#1783</code></li> <li><strong>Experimental tasks API</strong> - <code>ClientSession.experimental</code>, <code>Server.experimental</code>, <code>ServerSession.experimental</code>, and the <code>experimental_task_handlers=</code> kwarg on <code>ClientSession</code>. Tasks (SEP-1686) were removed from the MCP specification and are expected to return as a separate MCP extension.</li> </ul> <p>If your test suite runs with <code>filterwarnings = [&quot;error&quot;]</code> and exercises these paths, add a scoped ignore such as <code>ignore:The experimental tasks API is deprecated:DeprecationWarning</code> or <code>ignore:The WebSocket .* transport is deprecated:DeprecationWarning</code>.</p> <p>See <a href="https://redirect.github.com/modelcontextprotocol/python-sdk/issu
  **Post-Mortem & Fix Analysis**:
  > <h1>Dependency Review</h1> The following issues were found:<ul><li>✅ 0 vulnerable package(s)</li><li>✅ 0 package(s) with incompatible licenses</li><li>✅ 0 package(s) with invalid SPDX license definitions</li><li>⚠️ 1 package(s) with unknown licenses.</li></ul> See the Details below.<h2>License Issues</h2> <h4><em>mcp/requirements.txt</em></h4> <table><tr><td>Package</td><td>Version</td><td>License</td><td>Issue Type</td></tr><tr><td>mcp</td><td>1.28.1</td><td>Null</td><td>Unknown License</td></tr></table> <h2>OpenSSF Scorecard</h2> <table><tr><th>Package</th><th>Version</th><th>Score</th><th>Details</th></tr> <tr><td> pip/mcp </td><td>1.28.1</td>       <td> Unknown</td><td>Unknown</td></tr> </table><h2>Scanned Files</h2> <ul><li>mcp/requirements.txt</li></ul>   <!-- dependency-review-pr-comment-marker -->
  > Looks like mcp is up-to-date now, so this is no longer needed.

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

### Incident Patch 1: `3aee3b34` (2026-07-27)
**Commit Message**: UX updates

**File**: `web/src/components/connections/McpConnectionDock.tsx` (modified, +15/-6)
```diff
@@ -2,7 +2,11 @@
 
 import * as React from 'react'
 import { PlugZap } from 'lucide-react'
-import { McpConnectionSetup } from '@/components/connections/McpConnectionSetup'
+import {
+  getMcpClientDefinition,
+  McpConnectionSetup,
+  type McpClient,
+} from '@/components/connections/McpConnectionSetup'
 import {
   Sheet,
   SheetContent,
@@ -21,6 +25,9 @@ export function openMcpConnectionDock() {
 
 export function McpConnectionDock({ wikiName }: { wikiName?: string }) {
   const [open, setOpen] = React.useState(false)
+  const [activeClient, setActiveClient] = React.useState<McpClient>('claude')
+  const client = getMcpClientDefinition(activeClient)
+  const sheetTitle = activeClient === 'other' ? 'Connect another client' : `Connect ${client.name}`
 
   React.useEffect(() => {
     const handleOpen = () => setOpen(true)
@@ -52,13 +59,15 @@ export function McpConnectionDock({ wikiName }: { wikiName?: string }) {
       </SheetTrigger>
       <SheetContent className="w-[calc(100%-1rem)] max-w-[30rem] gap-0 overflow-y-auto data-[state=closed]:duration-150 data-[state=open]:duration-200 sm:max-w-[30rem]">
         <SheetHeader className="border-b border-border px-5 py-4 pr-12">
-          <SheetTitle>Connect AI</SheetTitle>
-          <SheetDescription>
-            Link an AI client to read and write this wiki.
-          </SheetDescription>
+          <SheetTitle>{sheetTitle}</SheetTitle>
+          <SheetDescription>{client.shortDescription}</SheetDescription>
         </SheetHeader>
         <div className="px-5 py-4">
-          <McpConnectionSetup wikiName={wikiName} />
+          <McpConnectionSetup
+            wikiName={wikiName}
+            showClientHeading={false}
+            onClientChange={setActiveClient}
+          />
         </div>
       </SheetContent>
     </Sheet>
```

**File**: `web/src/components/connections/McpConnectionSetup.tsx` (modified, +9/-0)
```diff
@@ -96,6 +96,10 @@ const CLIENTS: ClientDefinition[] = [
   },
 ]
 
+export function getMcpClientDefinition(id: McpClient): ClientDefinition {
+  return CLIENTS.find((item) => item.id === id) ?? CLIENTS[0]
+}
+
 async function writeClipboard(value: string): Promise<void> {
   if (navigator.clipboard?.writeText) {
     try {
@@ -238,6 +242,11 @@ export function McpConnectionSetup({
         )}
 
         <div className="space-y-5">
+          {!showClientHeading && client.note && (
+            <p className="text-xs leading-relaxed text-muted-foreground/70">
+              {client.note}
+            </p>
+          )}
           <CopyBlock
             label={client.configLabel}
             value={client.configValue}
```

**File**: `web/src/components/kb/RecentChanges.tsx` (modified, +12/-10)
```diff
@@ -55,7 +55,7 @@ function TimelineSkeleton() {
     <div className="mt-12" aria-label="Loading recent changes">
       <div className="mb-3 h-3 w-14 rounded bg-muted/60" />
       {[0, 1, 2, 3].map((index) => (
-        <div key={index} className="flex items-center gap-4 border-b border-border/70 py-3.5">
+        <div key={index} className="flex items-center gap-4 py-1">
           <div className="h-3 w-11 rounded bg-muted/50" />
           <div className="size-7 rounded-full bg-muted/50" />
           <div className="h-3 rounded bg-muted/50" style={{ width: `${42 + index * 7}%` }} />
@@ -126,27 +126,29 @@ function TimelineRow(props: {
   const standalone = event.subject_kind === 'wiki'
 
   return (
-    <div className="grid grid-cols-[3.25rem_1.75rem_minmax(0,1fr)] items-start gap-3 border-b border-border/70 py-3.5 last:border-b-0 sm:grid-cols-[3.75rem_1.75rem_minmax(0,1fr)]">
+    <div className="grid grid-cols-[3.25rem_1.25rem_minmax(0,1fr)] items-baseline gap-2.5 py-1 sm:grid-cols-[3.75rem_1.25rem_minmax(0,1fr)]">
       <time
         dateTime={event.occurred_at}
-        className="pt-1 text-[11px] tabular-nums text-muted-foreground/55"
+        className="text-[11px] tabular-nums text-muted-foreground/55"
       >
         {formatActivityTime(event.occurred_at)}
       </time>
-      <span className="grid size-7 place-items-center rounded-full bg-muted/55 text-muted-foreground">
+      <span className="flex items-center self-center text-muted-foreground/60">
         <EventGlyph event={event} />
       </span>
-      <div className="min-w-0 pt-0.5 text-[13px] leading-6">
+      <div className="flex min-w-0 items-baseline gap-1.5 text-[13px] leading-6">
         {standalone ? (
           <span className="text-foreground/80">{verb}</span>
         ) : (
           <>
-            <span className="mr-1.5 text-muted-foreground">{verb}</span>
-            <SubjectLink {...props} />
+            <span className="shrink-0 text-muted-foreground">{verb}</span>
+            <span className="min-w-0 truncate">
+              <SubjectLink {...props} />
+            </span>
           </>
         )}
         {countLabel && (
-          <span className="ml-2 whitespace-nowrap text-[11px] text-muted-foreground/45">
+          <span className="shrink-0 whitespace-nowrap text-[11px] text-muted-foreground/45">
             {countLabel}
           </span>
         )}
@@ -204,12 +206,12 @@ export function RecentChanges({
             </p>
           </div>
         ) : (
-          <div className="mt-12 space-y-10">
+          <div className="mt-8 space-y-5">
             {groups.map((group) => (
               <section key={group.key} aria-labelledby={`activity-${group.key}`}>
                 <h2
                   id={`activity-${group.key}`}
-                  className="mb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/55"
+                  className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/55"
                 >
                   {group.label}
                 </h2>
```

---

### Incident Patch 2: `d98829c0` (2026-07-27)
**Commit Message**: Added timeline with events log; improved local ingestion; extension bug fixes; improved quiz linting

**File**: `.env.example` (modified, +4/-2)
```diff
@@ -1,10 +1,12 @@
 # === API (.env in api/) ===
 DATABASE_URL=postgresql://postgres.YOUR_REF:PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres
 SUPABASE_URL=https://YOUR_REF.supabase.co
-SUPABASE_JWT_SECRET=             # optional — only needed for legacy HS256 projects
 STAGE=dev
 APP_URL=http://localhost:3000
 MCP_URL=http://localhost:8080/mcp
+# Published extension origin. For an unpacked build, replace/add the ID shown
+# by chrome://extensions (comma-separate multiple trusted origins).
+LOCAL_EXTENSION_ORIGINS=chrome-extension://dibilaenlekndomfbampadehjeahemha
 
 # Voyage AI (embeddings) — optional for v1
 VOYAGE_API_KEY=
@@ -13,7 +15,7 @@ TURBOPUFFER_API_KEY=
 # Hosted free-form quiz grading. Set CLOUDFLARE_AI_GATEWAY_ID to route
 # requests through AI Gateway for account-level spend and rate limits.
 CLOUDFLARE_ACCOUNT_ID=
-CLOUDFLARE_AI_TOKEN=
+CLOUDFLARE_AUTH_TOKEN=
 CLOUDFLARE_AI_GATEWAY_ID=
 QUIZ_GRADE_DAILY_LIMIT=100
 
```

**File**: `.github/workflows/test.yml` (modified, +30/-1)
```diff
@@ -30,6 +30,7 @@ jobs:
       - name: Run API unit tests
         run: >-
           PYTHONPATH=api pytest
+          tests/unit/test_api_quiz_validation.py
           tests/unit/test_chunker.py
           tests/unit/test_helpers.py
           tests/unit/test_pdf_extract.py
@@ -39,12 +40,20 @@ jobs:
           tests/unit/test_preserve_replies.py
           tests/unit/test_auth_refresh_limits.py
           tests/unit/test_auth_provider_invariant.py
+          tests/unit/test_deps_lifecycle.py
           tests/unit/test_hosted_parser_isolation.py
           tests/unit/test_local_http_boundary.py
+          tests/unit/test_local_events.py
+          tests/unit/test_local_processor_extraction.py
+          tests/unit/test_local_reconcile.py
+          tests/unit/test_local_upload_streaming.py
           tests/unit/test_text_content_limits.py
           tests/unit/test_upload_hardening.py
+          tests/unit/test_url_ingest.py
+          tests/unit/test_watcher_paths.py
           tests/unit/test_quiz_grader.py
           tests/integration/test_converter_isolation.py
+          tests/integration/test_converter_service.py
           -v
 
       - name: Run MCP unit tests
@@ -98,8 +107,15 @@ jobs:
         run: npm test
 
   extension:
-    name: Extension tests (tsc + vitest)
+    name: Extension tests and package validation
     runs-on: ubuntu-latest
+    env:
+      # CI validates packaging with intentionally non-production public config;
+      # it does not publish this archive. Release verification rejects these.
+      PACKAGE_VALIDATION_MODE: test
+      VITE_API_BASE_URL: https://api.llmwiki.app
+      VITE_SUPABASE_URL: https://ci-placeholder.supabase.co
+      VITE_SUPABASE_ANON_KEY: ci-placeholder-anon-key
 
     steps:
       - uses: actions/checkout@v4
@@ -127,6 +143,18 @@ jobs:
         working-directory: extension
         run: npm test
 
+      - name: Build extension
+        working-directory: extension
+        run: npm run build
+
+      - name: Create test package
+        working-directory: extension
+        run: npm run zip
+
+      - name: Validate release package
+        working-directory: extension
+        run: npm run verify:package
+
   postgres-integration:
     name: Integration tests (Postgres)
     runs-on: ubuntu-latest
@@ -166,6 +194,7 @@ jobs:
         run: >-
           PYTHONPATH=api MODE=hosted pytest
           tests/integration/isolation/
+          tests/integration/test_events.py
           tests/integration/test_kb_lifecycle.py
           tests/integration/test_note_lifecycle.py
           tests/integration/test_text_quota_accounting.py
```

**File**: `README.md` (modified, +3/-4)
```diff
@@ -94,7 +94,7 @@ Paste the printed JSON into `claude_desktop_config.json` (Claude Desktop) or `.c
 
 A routine prompt that works well:
 
-> *Read the guide. Find everything added to the workspace since your last run — new sources, clips, and highlights. For each one, read it and update the wiki: write new pages where they're warranted, fold new material into existing pages, and fix any cross-references or citations it affects. Append a short note to `wiki/log.md` summarizing what changed.*
+> *Read the guide. Find everything added to the workspace since your last run — new sources, clips, and highlights. For each one, read it and update the wiki: write new pages where they're warranted, fold new material into existing pages, and fix any cross-references or citations it affects.*
 
 Then schedule that prompt to run nightly. [Claude Code Routines](https://code.claude.com/docs/en/routines) run it on Anthropic's cloud on a fixed cadence even when your laptop is closed — create one at [claude.ai/code/routines](https://claude.ai/code/routines), with `/schedule` in the CLI, or from Claude Cowork — while a [Desktop scheduled task](https://code.claude.com/docs/en/desktop-scheduled-tasks) runs the same prompt on your own machine. Either way the wiki compounds: a year from now you can open it and read back the ideas you were working through a year ago.
 
@@ -132,7 +132,6 @@ LLM Wiki adds exactly two things to the folder you point it at. Your source file
   data.xlsx
   wiki/                      # generated pages — created by LLM Wiki
     overview.md
-    log.md
     concepts/
       attention.md
   .llmwiki/                  # index + cache — hidden, rebuildable
@@ -152,14 +151,14 @@ Once connected over MCP, Claude works the wiki through a small, deliberate set o
 | Tool | What it does |
 |------|--------------|
 | `guide` | Orients Claude — how the vault works and which knowledge bases exist. It calls this first. |
-| `create_knowledge_base` | Creates a knowledge base and starter wiki pages (`overview.md`, `log.md`); local mode returns the existing singleton workspace. |
+| `create_knowledge_base` | Creates a knowledge base and starter `overview.md`; local mode returns the existing singleton workspace. |
 | `list_knowledge_bases` | Lists your knowledge bases and their slugs (every other tool takes one). |
 | `search` | Browse files, full-text search across content, or query the citation graph — what cites what, plus stale or uncited pages. |
 | `read` | Read documents — a single file or a glob batch, PDF/office page ranges, optionally with embedded images. |
 | `create` | Create a wiki page, note, or asset (SVG diagram, CSV) with footnote citations back to sources. |
 | `edit` | Find-and-replace exact text in an existing page. |
 | `append` | Add content to the end of a page. |
-| `delete` | Remove pages or sources by path or glob (`overview.md` and `log.md` are protected). |
+| `delete` | Remove pages or sources by path or glob (`overview.md` and any legacy `log.md` are protected). |
 | `lint` | Deterministic hygiene checks — citation resolution, dangling links, orphan and stale pages, frontmatter consistency. |
 
 Writes go to the source of truth first — a file on disk in local mode, Postgres in hosted mode — then the search index updates. So when Claude creates `/wiki/concepts/attention.md`, it's a real file (or row) immediately, not a pending change.
```

**File**: `api/config.py` (modified, +13/-0)
```diff
@@ -35,6 +35,11 @@ class Settings(BaseSettings):
     STAGE: str = "dev"
     APP_URL: str = "http://localhost:3000"
     API_URL: str = "http://localhost:8000"
+    # Comma-separated serialized origins. Override this with the ID shown by
+    # chrome://extensions when using an unpacked development build.
+    LOCAL_EXTENSION_ORIGINS: str = (
+        "chrome-extension://dibilaenlekndomfbampadehjeahemha"
+    )
 
     QUOTA_MAX_PAGES_PER_DOC: int = 300  # max pages per single document
     QUOTA_MAX_STORAGE_BYTES: int = 1_073_741_824  # 1 GB per user
@@ -82,5 +87,13 @@ def listen_database_url(self) -> str:
         """Connection for the LISTEN loop — direct if configured, else the pooler."""
         return self.DIRECT_DATABASE_URL or self.DATABASE_URL
 
+    @property
+    def local_extension_origins(self) -> tuple[str, ...]:
+        return tuple(
+            origin.strip()
+            for origin in self.LOCAL_EXTENSION_ORIGINS.split(",")
+            if origin.strip()
+        )
+
 
 settings = Settings()
```

**File**: `api/deps.py` (modified, +34/-13)
```diff
@@ -1,10 +1,33 @@
+import asyncio
+import inspect
 import json
 from typing import Annotated, AsyncGenerator
 
 from fastapi import Depends, Request
-
 from scoped_db import ScopedDB
 
+DB_ACQUIRE_TIMEOUT_SECONDS = 10.0
+
+
+async def _acquire_connection(pool):
+    """Acquire without allowing a saturated pool to hang a request forever."""
+    try:
+        parameters = inspect.signature(pool.acquire).parameters.values()
+        supports_timeout = any(
+            parameter.name == "timeout"
+            or parameter.kind is inspect.Parameter.VAR_KEYWORD
+            for parameter in parameters
+        )
+    except (TypeError, ValueError):
+        supports_timeout = False
+
+    if supports_timeout:
+        return await pool.acquire(timeout=DB_ACQUIRE_TIMEOUT_SECONDS)
+    return await asyncio.wait_for(
+        pool.acquire(),
+        timeout=DB_ACQUIRE_TIMEOUT_SECONDS,
+    )
+
 
 async def get_pool(request: Request):
     return request.app.state.pool
@@ -59,17 +82,15 @@ async def get_scoped_db(
 
     from auth import get_current_user
     user_id = await get_current_user(request)
-    conn = await pool.acquire()
-    tr = conn.transaction()
-    await tr.start()
+    conn = await _acquire_connection(pool)
     try:
-        claims = json.dumps({"sub": user_id})
-        await conn.execute("SET LOCAL ROLE authenticated")
-        await conn.execute("SELECT set_config('request.jwt.claims', $1, true)", claims)
-        yield ScopedDB(pool, conn, user_id)
-        await tr.commit()
-    except Exception:
-        await tr.rollback()
-        raise
+        # The transaction context covers startup too. If BEGIN, RLS setup,
+        # request handling, or cancellation fails, it rolls back before the
+        # connection is returned to the pool.
+        async with conn.transaction():
+            claims = json.dumps({"sub": user_id})
+            await conn.execute("SET LOCAL ROLE authenticated")
+            await conn.execute("SELECT set_config('request.jwt.claims', $1, true)", claims)
+            yield ScopedDB(pool, conn, user_id)
     finally:
-        await pool.release(conn)
+        await asyncio.shield(pool.release(conn))
```

**File**: `api/domain/file_types.py` (modified, +5/-0)
```diff
@@ -15,3 +15,8 @@
 # Need an extraction/processing backend before they're searchable. HTML is here
 # (not in SIMPLE_TEXT_TYPES) because it goes through the webmd parser.
 EXTRACTION_TYPES = PDF_TYPES | OFFICE_TYPES | SPREADSHEET_TYPES | HTML_TYPES
+
+# Files routed through the local background processor. Images do not need text
+# extraction, but the processor still finalizes their metadata/status, so they
+# must participate in upload dispatch and interrupted-work reconciliation.
+PROCESSING_TYPES = EXTRACTION_TYPES | IMAGE_TYPES
```

**File**: `api/domain/local_processor.py` (modified, +314/-85)
```diff
@@ -5,20 +5,29 @@
 """
 
 import asyncio
+import contextvars
+import functools
 import json
 import logging
+import os
 import shutil
+import signal
 import subprocess
 import tempfile
 import uuid
+from datetime import datetime, timezone
 from pathlib import Path
 
 import aiosqlite
-
 from config import settings
 from domain.file_types import (
-    EXTRACTION_TYPES, HTML_TYPES, IMAGE_TYPES, OFFICE_TYPES,
-    PDF_TYPES, SIMPLE_TEXT_TYPES, SPREADSHEET_TYPES,
+    HTML_TYPES,
+    IMAGE_TYPES,
+    OFFICE_TYPES,
+    PDF_TYPES,
+    PROCESSING_TYPES,
+    SIMPLE_TEXT_TYPES,
+    SPREADSHEET_TYPES,
 )
 from domain.watcher import mark_written
 from infra.db.sqlite import SQLiteDocumentRepository, create_pool
@@ -32,42 +41,179 @@
 _process_semaphore = asyncio.Semaphore(PROCESS_CONCURRENCY)
 
 
+async def _to_thread_joined(func, /, *args, **kwargs):
+    """Run blocking work in a thread and join it before propagating cancellation.
+
+    `asyncio.to_thread()` cancels only its asyncio waiter, not the underlying
+    thread. This helper keeps the executor future alive under cancellation and
+    waits for the real worker to finish before cleanup/status transitions run.
+    """
+    loop = asyncio.get_running_loop()
+    context = contextvars.copy_context()
+    call = functools.partial(context.run, func, *args, **kwargs)
+    worker = loop.run_in_executor(None, call)
+
+    try:
+        return await asyncio.shield(worker)
+    except asyncio.CancelledError:
+        # A shutdown may send more than one cancellation. Keep shielding until
+        # the executor future is actually done; it is a Future rather than an
+        # asyncio Task, so loop-wide task cancellation cannot cancel it behind
+        # our back while its thread continues running.
+        while not worker.done():
+            try:
+                await asyncio.shield(worker)
+            except asyncio.CancelledError:
+                continue
+            except BaseException:
+                break
+
+        # Retrieve a post-cancellation worker exception so it is not reported
+        # as unobserved. The request/task cancellation remains authoritative.
+        if worker.done():
+            try:
+                worker.result()
+            except BaseException:
+                pass
+        raise
+
+
+def _write_bytes_file(path: Path, content: bytes) -> None:
+    path.parent.mkdir(parents=True, exist_ok=True)
+    path.write_bytes(content)
+
+
+def _copy_file(source: Path, destination: Path) -> None:
+    destination.parent.mkdir(parents=True, exist_ok=True)
+    shutil.copy2(source, destination)
+
+
+def _find_libreoffice() -> str | None:
+    return shutil.which("libreoffice") or shutil.which("soffice")
+
+
+def _run_process_group(command: list[str], timeout: int) -> subprocess.CompletedProcess:
+    """Run a conversion in a process group so timeout cannot orphan children."""
+    popen_options: dict = {
+        "stdout": subprocess.PIPE,
+        "stderr": subprocess.PIPE,
+    }
+    if os.name == "posix":
+        popen_options["start_new_session"] = True
+    elif hasattr(subprocess, "CREATE_NEW_PROCESS_GROUP"):  # pragma: no cover - Windows
+        popen_options["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
+
+    proc = subprocess.Popen(command, **popen_options)
+    try:
+        stdout, stderr = proc.communicate(timeout=timeout)
+    except subprocess.TimeoutExpired as error:
+        if proc.poll() is None:
+            if os.name == "posix":
+                try:
+                    os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
+                except ProcessLookupError:
+                    pass
+            else:  # pragma: no cover - Windows
+                subprocess.run(
+                    ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
+                    stdout=subprocess.DEVNULL,
+                    stderr=subprocess.DEVNULL,
+                    check=False,
+                )
+                if proc.poll() is None:
+                    proc.kill()
+        proc.wait()
+        raise TimeoutError(f"Conversion timed out after {timeout} seconds") from error
+
+    return subprocess.CompletedProcess(command, proc.returncode, stdout, stderr)
+
+
+def _list_pdf_files(directory: Path) -> list[Path]:
+    return list(directory.glob("*.pdf"))
+
+
+def _encode_file_base64(path: Path) -> str:
+    import base64
+
+    return base64.b64encode(path.read_bytes()).decode()
+
+
+def _extract_spreadsheet_content(file_path: Path) -> list[tuple[str, str]]:
+    from openpyxl import load_workbook
+
+    workbook = load_workbook(str(file_path), read_only=True, data_only=True)
+    try:
+        sheets: list[tuple[str, str]] = []
+        for sheet_name in workbook.sheetnames:
+            worksheet = workbook[sheet_name]
+            rows = [
+                " | ".join(str(cell) if cell is not None else "" for cell in row)
+                for row in worksheet.iter_rows(values_only=True)
+            ]
+       
```

**File**: `api/domain/quiz_lint.py` (added, +192/-0)
```diff
@@ -0,0 +1,192 @@
+"""Validate structured quiz blocks embedded in authored Markdown."""
+
+from collections.abc import Iterator
+
+import yaml
+
+# API and MCP ship from isolated Docker contexts, so this mirrors mcp/tools/quiz_lint.py.
+
+MAX_QUESTIONS = 20
+MIN_OPTIONS = 2
+MAX_OPTIONS = 6
+MAX_HINTS = 5
+
+QUIZ_SCHEMA_HINT = (
+    "Schema: optional `title`, required `questions:`. Multiple-choice question (default): "
+    "`prompt`, `options` (2-6 strings), `answer` (0-based index of the correct option). "
+    "Free-form question: `type: text`, `prompt`, `rubric` (grading criteria for the AI grader). "
+    "Every question may add `hints` (list) and `explanation`."
+)
+
+_BLOCK_KEYS = {"title", "questions"}
+_QUESTION_TYPES = ("choice", "text")
+_COMMON_KEYS = {"type", "prompt", "hints", "explanation"}
+_CHOICE_KEYS = _COMMON_KEYS | {"options", "answer"}
+_TEXT_KEYS = _COMMON_KEYS | {"rubric"}
+
+
+def validate_quiz_content(content: str) -> str:
+    """Return content unchanged or raise ValueError for an invalid quiz block."""
+    errors = lint_quiz_blocks(content)
+    if not errors:
+        return content
+    details = "; ".join(errors)
+    raise ValueError(f"invalid ```quiz block(s): {details}. {QUIZ_SCHEMA_HINT}")
+
+
+def lint_quiz_blocks(content: str) -> list[str]:
+    """Return one error message per problem across all quiz fenced blocks."""
+    errors: list[str] = []
+    for index, source in enumerate(_quiz_sources(content), start=1):
+        errors.extend(_lint_block(index, source))
+    return errors
+
+
+def _opening_fence(line: str) -> tuple[str, int, str] | None:
+    stripped = line.rstrip("\r\n")
+    indent = len(stripped) - len(stripped.lstrip(" "))
+    if indent > 3:
+        return None
+    candidate = stripped[indent:]
+    if not candidate or candidate[0] not in "`~":
+        return None
+    marker = candidate[0]
+    length = len(candidate) - len(candidate.lstrip(marker))
+    if length < 3:
+        return None
+    info = candidate[length:].strip()
+    if marker == "`" and "`" in info:
+        return None
+    return marker, length, info
+
+
+def _is_closing_fence(line: str, marker: str, opening_length: int) -> bool:
+    stripped = line.rstrip("\r\n")
+    indent = len(stripped) - len(stripped.lstrip(" "))
+    if indent > 3:
+        return False
+    candidate = stripped[indent:]
+    length = len(candidate) - len(candidate.lstrip(marker))
+    return length >= opening_length and not candidate[length:].strip()
+
+
+def _quiz_sources(content: str) -> Iterator[str]:
+    lines = content.splitlines(keepends=True)
+    index = 0
+    while index < len(lines):
+        opening = _opening_fence(lines[index])
+        if opening is None:
+            index += 1
+            continue
+
+        marker, opening_length, info = opening
+        body_start = index + 1
+        index = body_start
+        while index < len(lines) and not _is_closing_fence(lines[index], marker, opening_length):
+            index += 1
+
+        body = "".join(lines[body_start:index])
+        language = info.split(None, 1)[0] if info else ""
+        if language == "quiz":
+            yield body
+        if index < len(lines):
+            index += 1
+
+
+def _lint_block(index: int, source: str) -> list[str]:
+    label = f"quiz block {index}"
+    try:
+        data = yaml.safe_load(source)
+    except yaml.YAMLError as error:
+        return [f"{label}: invalid YAML — {error}"]
+    if not isinstance(data, dict):
+        return [f"{label}: body must be a YAML mapping with a `questions` list"]
+
+    errors: list[str] = []
+    unknown = set(data) - _BLOCK_KEYS
+    if unknown:
+        errors.append(f"{label}: unknown key(s) {sorted(unknown)} — allowed: title, questions")
+    title = data.get("title")
+    if title is not None and not isinstance(title, str):
+        errors.append(f"{label}: `title` must be a string")
+
+    questions = data.get("questions")
+    if not isinstance(questions, list) or not questions:
+        errors.append(f"{label}: `questions` must be a non-empty list")
+        return errors
+    if len(questions) > MAX_QUESTIONS:
+        errors.append(f"{label}: at most {MAX_QUESTIONS} questions per block")
+    for question_index, question in enumerate(questions, start=1):
+        errors.extend(_lint_question(f"{label}, question {question_index}", question))
+    return errors
+
+
+def _lint_question(label: str, question: object) -> list[str]:
+    if not isinstance(question, dict):
+        return [f"{label}: must be a mapping with a `prompt`"]
+
+    question_type = question.get("type", "choice")
+    if question_type not in _QUESTION_TYPES:
+        return [f'{label}: `type` must be "choice" or "text"']
+
+    errors = _lint_shared_fields(label, question, question_type)
+    if question_type == "text":
+        errors.extend(_lint_text_fields(label, question))
+    else:
+        errors.extend(_lint_choice_fields(label, question))
+    return errors
+
+
+def _lint
```

---

### Incident Patch 3: `14342b70` (2026-07-16)
**Commit Message**: Quiz implementation updates; token refresh bug fix

**File**: `web/DESIGN.md` (modified, +4/-4)
```diff
@@ -64,12 +64,12 @@ Flat. Structure comes from the two neutral layers (`panel` vs `bg`) and hairline
 - **Course header** — overall progress ring + title; clickable, routes to Overview.
 - **Reading column** — breadcrumb + read-time + status row, title, subtitle, body, right-rail (`On this page` ToC with accent current-item, then `Your notes`).
 - **Completion zone** — a single quiet region under a divider: primary "Mark complete", "Up next" target, `n / total`. Not a heavy card; arms on scroll-to-end.
-- **Quiz card** — numbered, question, answer textarea, "Reveal answer key" gated until typed, answered counter + progress bar, and an MCP grade-handoff strip (neutral border, accent icon only).
+- **Quiz widget** — a compact inline surface labeled "Quiz" that mounts one active question at a time, with quiet position and completion progress plus a stable footer. Choice questions use 2–6 answer buttons; free-form questions use a textarea with Gemma 4 grading or a local self-check fallback. The footer's primary action reads "Check answer" before grading. After any verdict, it changes to "Next question" (or "Finish quiz" on the last item), so feedback never traps the learner in a forced retry. Editing the answer remains the optional retry path, and feedback stays visible until the learner advances.
 - **Module list (Overview)** — a divided list with inline progress bars, never an identical card grid.
-- **Sidebar timeline** — a single rail connects the units of a Part. Each unit is a node (completed/in-progress/locked glyph); the current unit expands to its sub-steps (Lesson, Checkpoint). Part labels are faint uppercase dividers on the rail.
+- **Sidebar timeline** — a single rail connects the units of a Part. Each unit is a node (completed/in-progress/locked glyph); the current unit expands to its sub-steps (Lesson, Quiz). Part labels are faint uppercase dividers on the rail.
 - **Reading progress** — one quiet `ink`-low-opacity hairline fixed at the very top of the content area, driven by scroll position. No label, no section count.
-- **Checkpoint** — rendered inline from an embedded ` ```checkpoint ` fenced block (same mechanism as ` ```mermaid `), one question at a time, with answer textarea, gated "Reveal key", and an MCP grade-handoff line. The block is the definition; answers and scores live in frontmatter/index, never in the block.
-- **Gating** — locks are *soft*: a locked unit is dimmed with a lock icon and a "pass the checkpoint to unlock" hint, but remains clickable. Guidance, not a cage.
+- **Quiz block** — rendered inline from an embedded ` ```quiz ` YAML fence (the same mechanism as ` ```mermaid `). A block contains a non-empty `questions` list of up to 20 choice questions (`prompt`, 2–6 `options`, zero-based `answer`) and/or free-form questions (`type: text`, `prompt`, hidden `rubric`). Optional `hints` and `explanation` fields render Markdown and KaTeX. The app stores completed-question progress; authors never write progress into the block.
+- **Gating** — locks are *soft*: a locked unit is dimmed with a lock icon and a "pass the quiz to unlock" hint, but remains clickable. Guidance, not a cage.
 
 ## Bans (in addition to the shared absolute bans)
 
```

**File**: `web/PRODUCT.md` (modified, +5/-5)
```diff
@@ -7,7 +7,7 @@ register: product
 A local-first knowledge environment where Claude (over MCP) generates and maintains long-form content the user reads, annotates, and progresses through. Two content modes share one engine:
 
 - **Wiki** — a reference graph compiled from the user's own sources. You dip in and out.
-- **Course** — an ordered journey with checkpoints and progress. You work through it.
+- **Course** — an ordered journey with quizzes and progress. You work through it.
 
 Same renderer, same sidebar, same files on disk. "Course" is a *mode*, not a separate app or a forked UI.
 
@@ -17,7 +17,7 @@ Technical, self-directed builders and learners (the primary user builds AI appli
 
 ## Tone
 
-Calm, precise, scholarly. The interface earns trust by disappearing into the task. A quiet study, not a gamified app. Progress is *felt* (rings fill, checkpoints clear) but never *celebrated* (no confetti, XP, mascots, streaks-as-pressure).
+Calm, precise, scholarly. The interface earns trust by disappearing into the task. A quiet study, not a gamified app. Progress is *felt* (rings fill, quizzes clear) but never *celebrated* (no confetti, XP, mascots, streaks-as-pressure).
 
 ## Anti-references
 
@@ -35,13 +35,13 @@ V0 does exactly one thing: **render a course as markdown and make progress legib
 The single most important payoff (the thing chat cannot do): **come back the next day, see what you've read, and resume.** Progress is persisted to lesson frontmatter (`status`) on disk, so it survives across days/sessions/machines — not browser state. That cross-session resume is the core value; everything else serves it.
 
 - In: folder-driven Part/Lesson hierarchy, the rail-as-progress-meter, the reading tracker that checks off sections on scroll, lesson completion, overall + per-Part counts, soft locks, the markdown overview with a resume action, and **code blocks with syntax highlighting** (it's just markdown — for reading PyTorch).
-- Out (phase 2, deliberately deferred): **checkpoints/quizzes**, **highlights/notes**, **executable/graded coding exercises**, and **video embeds**. All valuable; none needed to prove the core. Do not build them in V0.
+- Out (phase 2, deliberately deferred): **quizzes**, **highlights/notes**, **executable/graded coding exercises**, and **video embeds**. All valuable; none needed to prove the core. Do not build them in V0.
 
 ## Strategic principles
 
 1. **Content is the hero; chrome recedes.** The lesson is the loudest thing on screen. Everything else is quiet.
-2. **One engine, two modes.** Wiki and course differ in affordances (progress, checkpoints, completion), not in their visual language. Switching a KB's type must not feel like switching apps.
-3. **Progress is felt, not gamified.** A filling ring and a cleared checkpoint, not points and prizes.
+2. **One engine, two modes.** Wiki and course differ in affordances (progress, quizzes, completion), not in their visual language. Switching a KB's type must not feel like switching apps.
+3. **Progress is felt, not gamified.** A filling ring and a completed quiz, not points and prizes.
 4. **Annotation is first-class.** Highlighting and noting what you read is core, not a bolt-on. It stays subtle: it marks the text, it does not decorate it.
 5. **Claude drives, the UI renders.** State lives in files (frontmatter, `.quiz`, KB metadata); Claude mutates it over MCP; the UI reflects it. The user starting a turn is the trigger; there is no reverse-trigger magic.
 6. **Familiar patterns are features.** Sidebar nav, breadcrumbs, a reading column with a right-rail ToC. Do not invent a second navigation axis (no top tabs over a sidebar) for flavor.
```

**File**: `web/course-mode-spec.md` (modified, +2/-2)
```diff
@@ -4,7 +4,7 @@ A course is a **mode of the existing wiki engine**, not a new app. Same renderer
 
 ## V0 job
 
-Render a course as markdown and **make progress legible.** That is the whole of V0. Checkpoints/quizzes and highlights/notes are specified but deliberately deferred (see Scope in PRODUCT.md).
+Render a course as markdown and **make progress legible.** That is the whole of V0. Quizzes and highlights/notes are specified but deliberately deferred (see Scope in PRODUCT.md).
 
 ## Structure on disk = course structure
 
@@ -61,4 +61,4 @@ Near-monochrome zinc. The **only color is the green completion check**; primary
 2. **Recursive `buildTreeFromDocs`** in `web/src/components/kb/KBDetail.tsx` — folders → Part/Lesson, rail + status glyphs from frontmatter, soft locks. Highest payoff, most unknowns; derisk first.
 3. **Reading tracker + completion** in `WikiContent` — section checkmarks on scroll, Mark-complete writes frontmatter, sidebar/overall progress derive from it.
 
-"Update the formatting" mostly means *use the existing `WikiContent` renderer* and tune prose styles, not rebuild markup. Out of scope for V0: checkpoint block renderer, notes/highlights, grading loop.
+"Update the formatting" mostly means *use the existing `WikiContent` renderer* and tune prose styles, not rebuild markup. Out of scope for V0: quiz block renderer, notes/highlights, grading loop.
```

**File**: `web/next-env.d.ts` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 /// <reference types="next" />
 /// <reference types="next/image-types/global" />
-import "./.next/dev/types/routes.d.ts";
+import "./.next/types/routes.d.ts";
 
 // NOTE: This file should not be edited
 // see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
```

**File**: `web/src/app/(dashboard)/wikis/page.tsx` (modified, +65/-8)
```diff
@@ -286,9 +286,17 @@ function WikiCard({
   const [renameName, setRenameName] = React.useState(kb.name)
   const [busy, setBusy] = React.useState(false)
 
+  const lessonCount = kb.lesson_count ?? 0
+  const lessonsCompleted = kb.lessons_completed ?? 0
+  const isCourseWithLessons = kb.kind === 'course' && lessonCount > 0
+
   const stats: string[] = []
   if (kb.source_count > 0) stats.push(`${kb.source_count} source${kb.source_count !== 1 ? 's' : ''}`)
-  if (kb.wiki_page_count > 0) stats.push(`${kb.wiki_page_count} page${kb.wiki_page_count !== 1 ? 's' : ''}`)
+  if (isCourseWithLessons) {
+    stats.push(`${lessonsCompleted}/${lessonCount} lessons`)
+  } else if (kb.wiki_page_count > 0) {
+    stats.push(`${kb.wiki_page_count} page${kb.wiki_page_count !== 1 ? 's' : ''}`)
+  }
 
   const handleRename = async () => {
     const next = renameName.trim()
@@ -335,13 +343,20 @@ function WikiCard({
         className="flex flex-col items-start gap-3 p-5 rounded-xl border border-border bg-card hover:bg-accent/50 transition-colors cursor-pointer text-left group overflow-hidden"
       >
         <div className="flex items-center gap-3 min-w-0 w-full">
-          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-muted group-hover:bg-accent transition-colors flex-shrink-0">
-            {isOpening ? (
-              <Loader2 size={16} className="animate-spin text-muted-foreground" />
-            ) : (
-              <BookOpen size={16} className="text-muted-foreground group-hover:text-foreground transition-colors" />
-            )}
-          </div>
+          {isCourseWithLessons && !isOpening ? (
+            <ProgressDonut
+              percent={(lessonsCompleted / lessonCount) * 100}
+              label={`${lessonsCompleted} of ${lessonCount} lessons complete`}
+            />
+          ) : (
+            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-muted group-hover:bg-accent transition-colors flex-shrink-0">
+              {isOpening ? (
+                <Loader2 size={16} className="animate-spin text-muted-foreground" />
+              ) : (
+                <BookOpen size={16} className="text-muted-foreground group-hover:text-foreground transition-colors" />
+              )}
+            </div>
+          )}
           <div className="min-w-0 flex-1">
             <h2 className="text-sm font-medium text-foreground truncate">{kb.name}</h2>
             {kb.description && (
@@ -434,6 +449,48 @@ function WikiCard({
   )
 }
 
+const DONUT_SIZE = 36
+const DONUT_STROKE = 3.5
+
+function ProgressDonut({ percent, label }: { percent: number; label: string }) {
+  const clamped = Math.min(100, Math.max(0, percent))
+  const radius = (DONUT_SIZE - DONUT_STROKE) / 2
+  const circumference = 2 * Math.PI * radius
+  const complete = clamped >= 100
+  return (
+    <div
+      title={label}
+      className="relative flex items-center justify-center flex-shrink-0"
+      style={{ width: DONUT_SIZE, height: DONUT_SIZE }}
+    >
+      <svg width={DONUT_SIZE} height={DONUT_SIZE} className="-rotate-90">
+        <circle
+          cx={DONUT_SIZE / 2}
+          cy={DONUT_SIZE / 2}
+          r={radius}
+          fill="none"
+          strokeWidth={DONUT_STROKE}
+          className="stroke-border"
+        />
+        <circle
+          cx={DONUT_SIZE / 2}
+          cy={DONUT_SIZE / 2}
+          r={radius}
+          fill="none"
+          strokeWidth={DONUT_STROKE}
+          strokeLinecap="round"
+          strokeDasharray={circumference}
+          strokeDashoffset={circumference * (1 - clamped / 100)}
+          className={`transition-[stroke-dashoffset] duration-500 ${complete ? 'stroke-emerald-500' : 'stroke-foreground'}`}
+        />
+      </svg>
+      <span className={`absolute text-[8px] font-semibold tabular-nums ${complete ? 'text-emerald-600 dark:text-emerald-500' : 'text-foreground'}`}>
+        {Math.round(clamped)}%
+      </span>
+    </div>
+  )
+}
+
 function PageHeader({ onNew }: { onNew?: () => void }) {
   return (
     <div className="shrink-0 flex items-center justify-between px-6 h-12 border-b border-border">
```

**File**: `web/src/components/kb/KBDetail.tsx` (modified, +9/-1)
```diff
@@ -8,6 +8,7 @@ import { Upload as UploadIcon, BookOpen, ArrowUpRight, Loader2, PlugZap } from '
 import { useUserStore, useUploadStore } from '@/stores'
 import { useKBDocuments } from '@/hooks/useKBDocuments'
 import { apiFetch } from '@/lib/api'
+import { refreshAccessToken } from '@/lib/auth-token'
 import { toast } from 'sonner'
 import { KBSidenav } from '@/components/kb/KBSidenav'
 import { openMcpConnectionDock } from '@/components/connections/McpConnectionDock'
@@ -618,6 +619,7 @@ export function KBDetail({ kbId, kbSlug, kbName, viewMode, routeFilesPath }: Pro
   const tusUploadFile = React.useCallback(async (file: File, targetPath: string = '/'): Promise<void> => {
     const t = getToken()
     if (!t) return Promise.reject(new Error('Not authenticated'))
+    const uploadToken = await refreshAccessToken(t).catch(() => null) ?? t
     const uploadId = crypto.randomUUID()
     addUpload({ id: uploadId, filename: file.name, kbId, kbSlug, path: targetPath })
     const { Upload } = await import('tus-js-client')
@@ -626,7 +628,13 @@ export function KBDetail({ kbId, kbSlug, kbName, viewMode, routeFilesPath }: Pro
         endpoint: `${API_URL}/v1/uploads`,
         retryDelays: [0, 1000, 3000, 5000],
         metadata: { filename: file.name, knowledge_base_id: kbId, path: targetPath },
-        headers: { Authorization: `Bearer ${t}` },
+        headers: { Authorization: `Bearer ${uploadToken}` },
+        onBeforeRequest: (request) => {
+          // Long-running uploads span multiple TUS requests. Supabase can
+          // rotate the access token between chunks, so read it at send time.
+          const latestToken = useUserStore.getState().accessToken ?? uploadToken
+          request.setHeader('Authorization', `Bearer ${latestToken}`)
+        },
         onProgress: (sent, total) => setUploadProgress(uploadId, total > 0 ? sent / total : 0),
         onError: (error) => { markUploadFailed(uploadId); reject(error) },
         onSuccess: () => { markUploadProcessing(uploadId); resolve() },
```

**File**: `web/src/components/viewer/MarkdownClipViewer.tsx` (modified, +1/-1)
```diff
@@ -229,7 +229,7 @@ export default function MarkdownClipViewer({ documentId, className }: Props) {
 
     ws.onclose = (event) => {
       if (cancelled || event.code !== 4001) return
-      refreshAccessToken().catch(() => {})
+      refreshAccessToken(wsToken).catch(() => {})
     }
 
     return () => {
```

**File**: `web/src/components/wiki/DiagramViewer.test.tsx` (added, +49/-0)
```diff
@@ -0,0 +1,49 @@
+import { cleanup, render, screen } from '@testing-library/react'
+import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
+import { DiagramViewer } from './DiagramViewer'
+
+let resolvedTheme: 'light' | 'dark' = 'light'
+
+vi.mock('next-themes', () => ({
+  useTheme: () => ({ resolvedTheme }),
+}))
+
+function iframeSrcdoc(): string {
+  return screen.getByTitle('Diagram').getAttribute('srcdoc') ?? ''
+}
+
+beforeEach(() => {
+  resolvedTheme = 'light'
+})
+
+afterEach(cleanup)
+
+describe('DiagramViewer', () => {
+  it('uses the app dark canvas inside the isolated iframe', () => {
+    resolvedTheme = 'dark'
+    render(
+      <DiagramViewer
+        content="<svg viewBox='0 0 10 10'></svg>"
+        type="svg"
+        onClose={vi.fn()}
+      />,
+    )
+
+    expect(iframeSrcdoc()).toContain('color-scheme: dark')
+    expect(iframeSrcdoc()).toContain('background: hsl(20 14% 4%)')
+    expect(iframeSrcdoc()).not.toContain('background: transparent')
+  })
+
+  it('keeps the warm paper canvas in light mode', () => {
+    render(
+      <DiagramViewer
+        content="<svg viewBox='0 0 10 10'></svg>"
+        type="svg"
+        onClose={vi.fn()}
+      />,
+    )
+
+    expect(iframeSrcdoc()).toContain('color-scheme: light')
+    expect(iframeSrcdoc()).toContain('background: hsl(30 3% 96%)')
+  })
+})
```

---

### Incident Patch 4: `fc7007b4` (2026-07-15)
**Commit Message**: Bug fix

**File**: `api/requirements.lock` (modified, +3/-3)
```diff
@@ -1553,9 +1553,9 @@ slowapi==0.1.9 \
     --hash=sha256:639192d0f1ca01b1c6d95bf6c71d794c3a9ee189855337b4821f7f457dddad77 \
     --hash=sha256:cfad116cfb84ad9d763ee155c1e5c5cbf00b0d47399a769b227865f5df576e36
     # via -r requirements.txt
-soupsieve==2.8.3 \
-    --hash=sha256:3267f1eeea4251fb42728b6dfb746edc9acaffc4a45b27e19450b676586e8349 \
-    --hash=sha256:ed64f2ba4eebeab06cc4962affce381647455978ffc1e36bb79a545b91f45a95
+soupsieve==2.8.4 \
+    --hash=sha256:e121fd02e975c695e4e9e8774a5ee35d74714b59307868dcc5319ad2d9e3328e \
+    --hash=sha256:e7e6b0769c8f51ed59acab6e994b00621096cfb1c640a7509295987388fbaf65
     # via beautifulsoup4
 starlette==1.3.1 \
     --hash=sha256:05d0213193f2fbaae60e2ecb593b4add4262ad4e46536b54abe36f11a71724e0 \
```

**File**: `api/services/quiz_grader.py` (modified, +5/-1)
```diff
@@ -147,7 +147,11 @@ async def _run_model(self, payload: dict, *, user_id: str | None) -> object:
             if not body.get("success"):
                 logger.warning("Workers AI grading call unsuccessful: %s", body.get("errors"))
                 raise HTTPException(status_code=502, detail="Grading service unavailable")
-            return body.get("result", {}).get("response")
+            body = body.get("result", {})
+        # Models on the legacy runtime answer {"response": ...}; vLLM-served
+        # models (Gemma 4 included) answer in OpenAI chat.completion shape.
+        if isinstance(body, dict) and "response" in body:
+            return body["response"]
         try:
             return body["choices"][0]["message"]["content"]
         except (KeyError, IndexError, TypeError) as e:
```

**File**: `tests/unit/test_quiz_grader.py` (modified, +18/-0)
```diff
@@ -74,6 +74,24 @@ def handler(request: httpx.Request) -> httpx.Response:
         assert exc.value.status_code == 429
         assert exc.value.headers == {"Retry-After": "17"}
 
+    async def test_parses_vllm_choices_inside_success_envelope(self):
+        # Real /ai/run shape for @cf/google/gemma-4-*: success envelope whose
+        # result is an OpenAI chat.completion, not {"response": ...}.
+        body = {
+            "success": True,
+            "errors": [],
+            "messages": [],
+            "result": {
+                "object": "chat.completion",
+                "choices": [
+                    {"message": {"role": "assistant", "content": '{"verdict": "correct", "feedback": "Good."}'}}
+                ],
+            },
+        }
+        result = await _grade(body)
+        assert result.verdict == "correct"
+        assert result.feedback == "Good."
+
     async def test_unsuccessful_cf_envelope_is_502(self):
         with pytest.raises(HTTPException) as exc:
             await _grade({"success": False, "errors": [{"message": "model overloaded"}]})
```

---

### Incident Patch 5: `0ae58cee` (2026-07-15)
**Commit Message**: Expanded support for quizzes in courses

**File**: `.env.example` (modified, +18/-0)
```diff
@@ -10,8 +10,26 @@ MCP_URL=http://localhost:8080/mcp
 VOYAGE_API_KEY=
 TURBOPUFFER_API_KEY=
 
+# Hosted free-form quiz grading. Set CLOUDFLARE_AI_GATEWAY_ID to route
+# requests through AI Gateway for account-level spend and rate limits.
+CLOUDFLARE_ACCOUNT_ID=
+CLOUDFLARE_AI_TOKEN=
+CLOUDFLARE_AI_GATEWAY_ID=
+QUIZ_GRADE_DAILY_LIMIT=100
+
+# Hosted uploads. When AWS_ACCESS_KEY_ID and S3_BUCKET are set, the API
+# requires CONVERTER_URL and CONVERTER_SECRET so PDF/Office parsing stays in
+# the authenticated converter service.
+AWS_ACCESS_KEY_ID=
+AWS_SECRET_ACCESS_KEY=
+S3_BUCKET=
+CONVERTER_URL=
+CONVERTER_SECRET=
+
 # === Web (.env.local in web/) ===
 # NEXT_PUBLIC_SUPABASE_URL=https://YOUR_REF.supabase.co
 # NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
 # NEXT_PUBLIC_API_URL=http://localhost:8000
 # NEXT_PUBLIC_MCP_URL=http://localhost:8080/mcp
+# Development only: preview both onboarding steps without auth or API writes.
+# NEXT_PUBLIC_ONBOARDING_PREVIEW=true
```

**File**: `.github/workflows/test.yml` (modified, +82/-4)
```diff
@@ -28,11 +28,28 @@ jobs:
           pip install -r tests/requirements.txt cryptography
 
       - name: Run API unit tests
-        run: PYTHONPATH=api pytest tests/unit/test_chunker.py tests/unit/test_helpers.py tests/unit/test_pdf_extract.py tests/unit/test_highlight_granular.py tests/unit/test_html_parser_highlights.py -v
+        run: >-
+          PYTHONPATH=api pytest
+          tests/unit/test_chunker.py
+          tests/unit/test_helpers.py
+          tests/unit/test_pdf_extract.py
+          tests/unit/test_highlight_granular.py
+          tests/unit/test_html_parser_highlights.py
+          tests/unit/test_html_embed_images_ssrf.py
+          tests/unit/test_preserve_replies.py
+          tests/unit/test_auth_refresh_limits.py
+          tests/unit/test_auth_provider_invariant.py
+          tests/unit/test_hosted_parser_isolation.py
+          tests/unit/test_local_http_boundary.py
+          tests/unit/test_text_content_limits.py
+          tests/unit/test_upload_hardening.py
+          tests/unit/test_quiz_grader.py
+          tests/integration/test_converter_isolation.py
+          -v
 
       - name: Run MCP unit tests
         working-directory: mcp
-        run: pytest ../tests/unit/mcp/ -v
+        run: pytest ../tests/unit/mcp/ ../tests/unit/test_mcp_delete_approval.py -v
 
   mcp-integration:
     name: MCP integration tests (SQLite)
@@ -53,7 +70,62 @@ jobs:
 
       - name: Run MCP VaultFS + tool handler tests
         working-directory: mcp
-        run: pytest ../tests/integration/mcp/test_vaultfs_contract.py ../tests/integration/mcp/test_tool_handlers.py -v
+        run: pytest ../tests/integration/mcp/test_vaultfs_contract.py ../tests/integration/mcp/test_tool_handlers.py ../tests/integration/mcp/test_reply_tool.py ../tests/integration/mcp/test_comments_tool.py ../tests/integration/mcp/test_quiz_lint.py -v
+
+  web:
+    name: Web tests (tsc + vitest)
+    runs-on: ubuntu-latest
+
+    steps:
+      - uses: actions/checkout@v4
+
+      - uses: actions/setup-node@v4
+        with:
+          node-version: 22
+          cache: npm
+          cache-dependency-path: web/package-lock.json
+
+      - name: Install dependencies
+        working-directory: web
+        run: npm ci
+
+      - name: Typecheck
+        working-directory: web
+        run: npm run check
+
+      - name: Run vitest
+        working-directory: web
+        run: npm test
+
+  extension:
+    name: Extension tests (tsc + vitest)
+    runs-on: ubuntu-latest
+
+    steps:
+      - uses: actions/checkout@v4
+
+      - uses: actions/setup-node@v4
+        with:
+          node-version: 22
+          cache: npm
+          cache-dependency-path: extension/package-lock.json
+
+      - name: Install dependencies
+        working-directory: extension
+        run: npm ci
+
+      # tsconfig extends ./.wxt/tsconfig.json, which only exists after prepare
+      - name: Generate WXT types
+        working-directory: extension
+        run: npx wxt prepare
+
+      - name: Typecheck
+        working-directory: extension
+        run: npm run check
+
+      - name: Run vitest
+        working-directory: extension
+        run: npm test
 
   postgres-integration:
     name: Integration tests (Postgres)
@@ -91,7 +163,13 @@ jobs:
         run: pip install -r tests/requirements.txt cryptography
 
       - name: Run API isolation + lifecycle tests
-        run: PYTHONPATH=api MODE=hosted pytest tests/integration/isolation/ tests/integration/test_kb_lifecycle.py tests/integration/test_note_lifecycle.py -v
+        run: >-
+          PYTHONPATH=api MODE=hosted pytest
+          tests/integration/isolation/
+          tests/integration/test_kb_lifecycle.py
+          tests/integration/test_note_lifecycle.py
+          tests/integration/test_text_quota_accounting.py
+          -v
 
       - name: Run MCP Postgres isolation tests
         working-directory: mcp
```

**File**: `README.md` (modified, +10/-0)
```diff
@@ -70,6 +70,16 @@ python llmwiki open C:\Users\you\research     # Windows
 ```
 
 This initializes the workspace, indexes the folder, starts the API and web app, and opens [localhost:3000](http://localhost:3000).
+Local mode is intentionally loopback-only: the API listens on `127.0.0.1` and does not support LAN or remote binding.
+
+To preview the hosted onboarding UX locally without authentication or API writes, start the web app with the development-only preview flag and open [localhost:3000/onboarding](http://localhost:3000/onboarding):
+
+```bash
+cd web
+NEXT_PUBLIC_ONBOARDING_PREVIEW=true npm run dev
+```
+
+Restart the development server after changing this flag. The preview simulates creation and completion in memory; it does not create a wiki or change onboarding state.
 
 **3. Connect Claude over MCP.** MCP enables Claude to read, write, and search your wiki.
 
```

**File**: `api/Dockerfile` (modified, +4/-0)
```diff
@@ -13,6 +13,10 @@ RUN pip-audit -r requirements.lock --strict --desc
 # ---------------------------------------------------------------------------
 FROM base AS runtime
 
+# The API image is hosted-only. Local installs keep the in-process parser, but
+# production PDF/Office parsing belongs exclusively to the converter image.
+RUN pip uninstall --yes opendataloader-pdf
+
 COPY . .
 
 ENV MODE=hosted
```

**File**: `api/auth.py` (modified, +50/-11)
```diff
@@ -1,23 +1,34 @@
 import asyncio
 import logging
 import time
+from collections import OrderedDict
 
 import httpx
 import jwt
-from jwt import PyJWK
-from fastapi import HTTPException, Request
-
 from config import settings
+from fastapi import HTTPException, Request
+from jwt import PyJWK
 
 logger = logging.getLogger(__name__)
 
 # Bounded TTL ensures we periodically pick up Supabase key rotations.
 _jwks_cache: dict[str, PyJWK] = {}
 _jwks_last_fetch: float = 0
+_jwks_last_refresh_attempt: float = 0
 _JWKS_TTL_SECONDS = 15 * 60
 _JWKS_MIN_REFRESH_SECONDS = 10
 _jwks_lock = asyncio.Lock()
 
+# Unknown key IDs are attacker-controlled because the JWT header is parsed
+# before signature verification. Keep a small negative cache so repeated misses
+# fail locally, and bound it so random kids cannot grow process memory forever.
+_UNKNOWN_KID_TTL_SECONDS = 30
+_UNKNOWN_KID_CACHE_MAX = 256
+_unknown_kids: OrderedDict[str, float] = OrderedDict()
+
+_MAX_TOKEN_LENGTH = 16 * 1024
+_MAX_KID_LENGTH = 256
+
 
 def _jwks_is_stale() -> bool:
     return time.monotonic() - _jwks_last_fetch >= _JWKS_TTL_SECONDS
@@ -37,20 +48,32 @@ async def _fetch_jwks() -> None:
             new_cache[kid] = PyJWK(key_data)
     _jwks_cache.clear()
     _jwks_cache.update(new_cache)
+    for kid in new_cache:
+        _unknown_kids.pop(kid, None)
     _jwks_last_fetch = time.monotonic()
     logger.info("Fetched %d JWKS keys from Supabase", len(_jwks_cache))
 
 
-async def _refresh_jwks_if_needed(force: bool = False) -> None:
-    """Serialize concurrent refreshes; force=True bypasses staleness check (used when kid is unknown)."""
+async def _refresh_jwks_if_needed(force: bool = False, kid: str | None = None) -> None:
+    """Refresh JWKS at most once per cooldown, including unknown-kid misses.
+
+    ``kid`` lets a waiter re-check whether another request already fetched the
+    key after acquiring the single-flight lock.
+    """
+    global _jwks_last_refresh_attempt
     async with _jwks_lock:
-        elapsed = time.monotonic() - _jwks_last_fetch
-        # MIN_REFRESH only gates non-forced calls; an unknown kid (force=True)
-        # bypasses it so a freshly rotated key resolves immediately.
-        if not force and elapsed < _JWKS_MIN_REFRESH_SECONDS:
+        if kid and kid in _jwks_cache:
+            return
+
+        now = time.monotonic()
+        if now - _jwks_last_refresh_attempt < _JWKS_MIN_REFRESH_SECONDS:
             return
         if not force and not _jwks_is_stale():
             return
+
+        # Record attempts, not only successful fetches. Otherwise a JWKS outage
+        # turns every authentication request into another outbound HTTP call.
+        _jwks_last_refresh_attempt = now
         try:
             await _fetch_jwks()
         except Exception:
@@ -59,6 +82,8 @@ async def _refresh_jwks_if_needed(force: bool = False) -> None:
 
 async def prefetch_jwks() -> None:
     """Eager fetch at app startup so the first request doesn't pay cold-cache cost."""
+    global _jwks_last_refresh_attempt
+    _jwks_last_refresh_attempt = time.monotonic()
     try:
         await _fetch_jwks()
     except Exception:
@@ -70,21 +95,35 @@ async def prefetch_jwks() -> None:
 
 async def verify_token(token: str) -> str:
     """Verify a Supabase JWT and return the user_id (sub claim). Raises ValueError on failure."""
+    if not token or len(token) > _MAX_TOKEN_LENGTH:
+        raise ValueError("Invalid token")
+
     try:
         header = jwt.get_unverified_header(token)
     except jwt.InvalidTokenError:
         raise ValueError("Invalid token")
 
     kid = header.get("kid")
-    if not kid:
+    if not isinstance(kid, str) or not kid or len(kid) > _MAX_KID_LENGTH:
         raise ValueError("Token missing kid header")
 
     if _jwks_is_stale():
         await _refresh_jwks_if_needed()
 
     if kid not in _jwks_cache:
-        await _refresh_jwks_if_needed(force=True)
+        now = time.monotonic()
+        negative_until = _unknown_kids.get(kid)
+        if negative_until is not None:
+            if negative_until > now:
+                raise ValueError("Unknown signing key")
+            _unknown_kids.pop(kid, None)
+
+        await _refresh_jwks_if_needed(force=True, kid=kid)
         if kid not in _jwks_cache:
+            _unknown_kids[kid] = time.monotonic() + _UNKNOWN_KID_TTL_SECONDS
+            _unknown_kids.move_to_end(kid)
+            while len(_unknown_kids) > _UNKNOWN_KID_CACHE_MAX:
+                _unknown_kids.popitem(last=False)
             raise ValueError("Unknown signing key")
 
     jwk = _jwks_cache[kid]
```

**File**: `api/config.py` (modified, +34/-0)
```diff
@@ -1,5 +1,6 @@
 from typing import Literal
 
+from pydantic import Field, model_validator
 from pydantic_settings import BaseSettings, SettingsConfigDict
 
 
@@ -26,6 +27,10 @@ class Settings(BaseSettings):
     AWS_REGION: str = "us-east-1"
     S3_BUCKET: str = "supavault-documents"
     MISTRAL_API_KEY: str = ""
+    CLOUDFLARE_ACCOUNT_ID: str = ""
+    CLOUDFLARE_AI_TOKEN: str = ""
+    CLOUDFLARE_AI_GATEWAY_ID: str = ""
+    QUIZ_GRADE_DAILY_LIMIT: int = Field(default=100, ge=1, le=10_000)
     PDF_BACKEND: str = "opendataloader"  # "opendataloader" or "mistral"
     STAGE: str = "dev"
     APP_URL: str = "http://localhost:3000"
@@ -43,6 +48,35 @@ class Settings(BaseSettings):
 
     SENTRY_DSN: str = ""
 
+    @model_validator(mode="after")
+    def require_isolated_parser_for_hosted_uploads(self) -> "Settings":
+        """Never let the hosted upload service fall back to local parsing.
+
+        ``main.lifespan`` constructs S3 and OCR services when the access key
+        and bucket are configured. Validate the matching condition while
+        settings are loaded, before startup can initialize JWKS, Postgres, or
+        any other network client.
+        """
+        hosted_uploads_enabled = bool(self.AWS_ACCESS_KEY_ID and self.S3_BUCKET)
+        if (
+            self.MODE == "hosted"
+            and hosted_uploads_enabled
+            and not self.CONVERTER_URL.strip()
+        ):
+            raise ValueError(
+                "CONVERTER_URL is required when hosted uploads are enabled; "
+                "the hosted API must not parse uploaded PDF or Office files in-process"
+            )
+        if (
+            self.MODE == "hosted"
+            and hosted_uploads_enabled
+            and not self.CONVERTER_SECRET.strip()
+        ):
+            raise ValueError(
+                "CONVERTER_SECRET is required when hosted uploads are enabled"
+            )
+        return self
+
     @property
     def listen_database_url(self) -> str:
         """Connection for the LISTEN loop — direct if configured, else the pooler."""
```

**File**: `api/html_parser/parser.py` (modified, +14/-74)
```diff
@@ -8,12 +8,12 @@
 from typing import Dict, List, Optional, Tuple
 from urllib.parse import urljoin
 
-import httpx
 from bs4 import BeautifulSoup, Comment
 from bs4.element import NavigableString, Tag
+from infra import safe_fetch
 
+from .forms import FormExtractor
 from .models import Element, Image, MappedHighlight, ParseResult, TextAnchor
-from .forms import FormExtractor, FormElement
 
 logger = logging.getLogger(__name__)
 
@@ -688,56 +688,13 @@ def _resolve_srcset(self, srcset: str) -> str:
     _MAX_TOTAL_BYTES = 20 * 1024 * 1024  # 20 MB total
     _EMBED_TIMEOUT = 10                   # seconds per image
     _EMBED_CONCURRENCY = 8
-
-    _ALLOWED_SCHEMES = {"http", "https"}
-
-    @staticmethod
-    def _is_dangerous_ip(addr: str) -> bool:
-        import ipaddress
-        try:
-            ip = ipaddress.ip_address(addr)
-            return ip.is_private or ip.is_loopback or ip.is_reserved or ip.is_link_local
-        except ValueError:
-            return True
-
-    @staticmethod
-    def _resolve_safe(url: str) -> tuple[str, str, int, str, str] | None:
-        """Resolve URL, validate all IPs are public.
-        Returns (safe_ip, host, port, scheme, path_with_query) or None.
-        """
-        from urllib.parse import urlparse
-        import socket
-        try:
-            parsed = urlparse(url)
-            if parsed.scheme not in Parser._ALLOWED_SCHEMES:
-                return None
-            host = parsed.hostname or ""
-            if not host:
-                return None
-            port = parsed.port or (443 if parsed.scheme == "https" else 80)
-            if host in ("localhost", "localhost.localdomain") or host.endswith(".local"):
-                return None
-            if Parser._is_dangerous_ip(host):
-                return None
-            addrs = socket.getaddrinfo(host, port, proto=socket.IPPROTO_TCP)
-            if not addrs:
-                return None
-            for _fam, _type, _proto, _canon, sockaddr in addrs:
-                if Parser._is_dangerous_ip(sockaddr[0]):
-                    return None
-            safe_ip = addrs[0][4][0]
-            path = parsed.path or "/"
-            if parsed.query:
-                path += "?" + parsed.query
-            return safe_ip, host, port, parsed.scheme, path
-        except Exception:
-            return None
+    _MAX_EMBED_IMAGES = 32
 
     async def embed_images(self) -> None:
         imgs = [
             img for img in self.soup.find_all("img")
             if img.get("src") and not img["src"].startswith("data:")
-        ]
+        ][:self._MAX_EMBED_IMAGES]
         if not imgs:
             return
 
@@ -748,40 +705,23 @@ async def _download(img_tag: Tag) -> None:
             nonlocal total_bytes
             src = img_tag["src"]
 
-            resolved = await asyncio.to_thread(Parser._resolve_safe, src)
-            if not resolved:
-                return
-            safe_ip, host, port, scheme, path = resolved
-
-            ip_str = f"[{safe_ip}]" if ":" in safe_ip else safe_ip
-            default_port = 443 if scheme == "https" else 80
-            port_suffix = f":{port}" if port != default_port else ""
-            pinned_url = f"{scheme}://{ip_str}{port_suffix}{path}"
-
             async with sem:
+                if total_bytes >= self._MAX_TOTAL_BYTES:
+                    return
                 try:
-                    async with httpx.AsyncClient(
-                        follow_redirects=False, verify=False,
-                    ) as client:
-                        resp = await client.get(
-                            pinned_url,
-                            headers={"Host": host, "User-Agent": "Mozilla/5.0"},
-                            timeout=self._EMBED_TIMEOUT,
-                        )
-                        resp.raise_for_status()
-
-                    data = resp.content
-                    if len(data) > self._MAX_IMG_BYTES:
+                    fetched = await safe_fetch.fetch_public_image(
+                        src,
+                        max_bytes=self._MAX_IMG_BYTES,
+                        timeout=self._EMBED_TIMEOUT,
+                        headers={"User-Agent": "Mozilla/5.0"},
+                    )
+                    if not fetched:
                         return
+                    data, mime = fetched
                     if total_bytes + len(data) > self._MAX_TOTAL_BYTES:
                         return
                     total_bytes += len(data)
 
-                    ct = resp.headers.get("content-type", "image/png")
-                    mime = ct.split(";")[0].strip()
-                    if not mime.startswith("image/"):
-                        return
-
                     b64 = base64.b64encode(data).decode("ascii")
                     img_tag["src"] = f"data:{mime};base64,{b64}"
 
```

**File**: `api/infra/db/sqlite.py` (modified, +9/-5)
```diff
@@ -14,6 +14,8 @@
 
 import aiosqlite
 
+from services.highlight_merge import preserve_replies
+
 logger = logging.getLogger(__name__)
 
 _SCHEMA_PATH = Path(__file__).parent.parent.parent.parent / "shared" / "sqlite_schema.sql"
@@ -173,21 +175,21 @@ async def create_note(
 
         await self._db.execute(
             "INSERT INTO documents (id, user_id, filename, title, path, relative_path, source_kind, "
-            "file_type, status, content, tags, version, document_number) "
-            "VALUES (?, ?, ?, ?, ?, ?, ?, 'md', 'ready', ?, ?, 0, ?)",
+            "file_type, file_size, status, content, tags, version, document_number) "
+            "VALUES (?, ?, ?, ?, ?, ?, ?, 'md', ?, 'ready', ?, ?, 0, ?)",
             (doc_id, user_id, filename, title, path, relative_path, source_kind,
-             content, json.dumps(tags), doc_number),
+             len(content.encode("utf-8")), content, json.dumps(tags), doc_number),
         )
         await self._db.commit()
         return await self.get(doc_id)
 
     @_serialized
     async def update_content(self, doc_id: str, user_id: str, content: str) -> dict | None:
         cursor = await self._db.execute(
-            "UPDATE documents SET content = ?, version = version + 1, "
+            "UPDATE documents SET content = ?, file_size = ?, version = version + 1, "
             "updated_at = datetime('now') WHERE id = ? "
             "RETURNING id, content, version",
-            (content, doc_id),
+            (content, len(content.encode("utf-8")), doc_id),
         )
         row = await cursor.fetchone()
         await self._db.commit()
@@ -296,6 +298,7 @@ async def replace_highlights(
                 await self._db.rollback()
                 return {"conflict": True}
             old_highlights = self._parse_highlights(existing[1])
+            preserve_replies(highlights, old_highlights)
 
             payload = json.dumps(highlights)
             cursor = await self._db.execute(
@@ -347,6 +350,7 @@ async def upsert_highlight(
                 return {"conflict": True}
 
             current = self._parse_highlights(highlights_raw)
+            preserve_replies([highlight], current)
             replaced = False
             next_list: list[dict] = []
             for h in current:
```

---

### Incident Patch 6: `1bd64eb2` (2026-07-08)
**Commit Message**: Simplified extension; UI bug fix

**File**: `api/infra/safe_fetch.py` (modified, +39/-1)
```diff
@@ -2,10 +2,25 @@
 
 import ipaddress
 import socket
-from urllib.parse import ParseResult, urljoin
+from urllib.parse import ParseResult, urljoin, urlparse
 
 import httpx
 
+DEFAULT_PORTS = {"http": 80, "https": 443}
+BLOCKED_HOSTNAMES = {
+    "internal",
+    "local",
+    "localhost",
+    "localdomain",
+    "metadata.amazonaws.com",
+}
+BLOCKED_HOSTNAME_SUFFIXES = (
+    ".internal",
+    ".local",
+    ".localhost",
+    ".localdomain",
+)
+
 
 def is_blocked_address(addr: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
     # not is_global also catches shared address space (100.64.0.0/10, CGNAT) —
@@ -40,6 +55,29 @@ def resolve_public_ip(host: str) -> str | None:
     return addresses[0] if addresses else None
 
 
+def is_blocked_hostname(host: str) -> bool:
+    normalized = host.rstrip(".").lower()
+    return normalized in BLOCKED_HOSTNAMES or normalized.endswith(BLOCKED_HOSTNAME_SUFFIXES)
+
+
+def parse_public_fetch_url(url: str) -> ParseResult | None:
+    """Parse a URL that server-side fetchers are allowed to request."""
+    try:
+        parsed = urlparse(url)
+        port = parsed.port
+    except ValueError:
+        return None
+    if parsed.scheme not in DEFAULT_PORTS or not parsed.hostname:
+        return None
+    if is_blocked_hostname(parsed.hostname):
+        return None
+    if parsed.username is not None or parsed.password is not None:
+        return None
+    if port is not None and port != DEFAULT_PORTS[parsed.scheme]:
+        return None
+    return parsed
+
+
 def build_pinned_request(
     client: httpx.AsyncClient,
     parsed: ParseResult,
```

**File**: `api/services/url_ingest.py` (modified, +4/-4)
```diff
@@ -14,7 +14,7 @@
 from fastapi import HTTPException
 
 from config import settings
-from infra.safe_fetch import build_pinned_request, redirect_location, resolve_public_ip
+from infra.safe_fetch import build_pinned_request, parse_public_fetch_url, redirect_location, resolve_public_ip
 from services.types import DownloadedPdf
 
 if TYPE_CHECKING:
@@ -51,10 +51,10 @@ async def ingest_pdf(self, user_id: str, kb_id: str, url: str, path: str) -> dic
 
     async def _download(self, url: str) -> DownloadedPdf:
         current = url
-        async with httpx.AsyncClient(timeout=DOWNLOAD_TIMEOUT, follow_redirects=False) as client:
+        async with httpx.AsyncClient(timeout=DOWNLOAD_TIMEOUT, follow_redirects=False, trust_env=False) as client:
             for _ in range(MAX_REDIRECTS + 1):
-                parsed = urlparse(current)
-                if parsed.scheme not in ("http", "https") or not parsed.hostname:
+                parsed = parse_public_fetch_url(current)
+                if not parsed:
                     raise HTTPException(status_code=400, detail="URL must be a public http(s) address")
                 ip = resolve_public_ip(parsed.hostname)
                 if not ip:
```

**File**: `api/services/webclip_assets.py` (modified, +4/-4)
```diff
@@ -10,7 +10,7 @@
 
 import httpx
 from html_parser import Image
-from infra.safe_fetch import build_pinned_request, redirect_location, resolve_public_ip
+from infra.safe_fetch import build_pinned_request, parse_public_fetch_url, redirect_location, resolve_public_ip
 
 MAX_IMAGE_BYTES = 10 * 1024 * 1024
 IMAGE_TIMEOUT = 5
@@ -154,10 +154,10 @@ async def _fetch_image(url: str) -> tuple[bytes, str] | None:
 async def _fetch_remote_image(url: str) -> tuple[bytes, str] | None:
     """Fetch an external image with SSRF guards and size/type validation, or None."""
     current = url
-    async with httpx.AsyncClient(timeout=IMAGE_TIMEOUT, follow_redirects=False) as client:
+    async with httpx.AsyncClient(timeout=IMAGE_TIMEOUT, follow_redirects=False, trust_env=False) as client:
         for _ in range(MAX_IMAGE_REDIRECTS + 1):
-            parsed = urlparse(current)
-            if parsed.scheme not in ("http", "https") or not parsed.hostname:
+            parsed = parse_public_fetch_url(current)
+            if not parsed:
                 return None
             ip = resolve_public_ip(parsed.hostname)
             if not ip:
```

**File**: `extension/src/entrypoints/background/index.ts` (modified, +1/-50)
```diff
@@ -1,6 +1,6 @@
 import { getSupabase } from "@/lib/supabase";
 import { getApiUrl, clearAccountSelections } from "@/lib/settings";
-import { isAllowedApiFetchUrl, isSupportedRemoteResourceUrl } from "@/lib/security";
+import { isAllowedApiFetchUrl } from "@/lib/security";
 import type { AuthChangeEvent, Session } from "@supabase/auth-js";
 
 type Message =
@@ -9,7 +9,6 @@ type Message =
   | { type: "SIGN_OUT" }
   | { type: "GET_SESSION" }
   | { type: "DOWNLOAD_PDF"; url: string }
-  | { type: "FETCH_IMAGE_DATA_URL"; url: string; maxBytes?: number }
   | {
       type: "API_FETCH";
       url: string;
@@ -57,8 +56,6 @@ export default defineBackground(() => {
         return getSession();
       case "DOWNLOAD_PDF":
         return downloadPdf(msg.url);
-      case "FETCH_IMAGE_DATA_URL":
-        return fetchImageDataUrl(msg.url, msg.maxBytes);
       case "API_FETCH":
         return apiFetchProxy(msg);
       default:
@@ -267,50 +264,4 @@ export default defineBackground(() => {
     }
   }
 
-  async function fetchImageDataUrl(
-    url: string,
-    maxBytes = 2_500_000,
-  ): Promise<{ dataUrl: string; size: number; mimeType: string } | { error: string }> {
-    try {
-      if (!isSupportedRemoteResourceUrl(url)) {
-        return { error: "Unsupported image URL" };
-      }
-      // No credentials: capture the public bytes of cross-origin images, never
-      // the viewer's authenticated version (which would archive private images
-      // into the wiki). The API falls back to its own credential-less fetch.
-      const response = await fetch(url, {
-        credentials: "omit",
-        cache: "force-cache",
-      });
-      if (!response.ok) {
-        return { error: `Image fetch failed: ${response.status}` };
-      }
-
-      const mimeType = (response.headers.get("content-type") || "").split(";", 1)[0].toLowerCase();
-      if (!["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif"].includes(mimeType)) {
-        return { error: `Unsupported image type: ${mimeType || "unknown"}` };
-      }
-
-      const buffer = await response.arrayBuffer();
-      if (buffer.byteLength > maxBytes) {
-        return { error: `Image too large: ${buffer.byteLength}` };
-      }
-
-      const bytes = new Uint8Array(buffer);
-      let binary = "";
-      const chunkSize = 0x8000;
-      for (let i = 0; i < bytes.length; i += chunkSize) {
-        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
-      }
-
-      return {
-        dataUrl: `data:${mimeType};base64,${btoa(binary)}`,
-        size: buffer.byteLength,
-        mimeType,
-      };
-    } catch (err: unknown) {
-      const message = err instanceof Error ? err.message : "Image fetch failed";
-      return { error: message };
-    }
-  }
 });
```

**File**: `extension/src/entrypoints/content/index.ts` (modified, +15/-30)
```diff
@@ -55,9 +55,7 @@ function isLlmWikiAppPage(): boolean {
 }
 
 const STYLE_ID = "llmwiki-highlight-style";
-const MAX_INLINE_IMAGES = 24;
-const MAX_INLINE_IMAGE_BYTES = 2_500_000;
-const MAX_INLINE_TOTAL_BYTES = 6_000_000;
+const MAX_CAPTURED_IMAGES = 24;
 const PENDING_PAGE_PREFIX = "llmwiki_pending_page:";
 const LAZY_IMAGE_SRC_ATTRIBUTES = [
   "data-src",
@@ -845,7 +843,7 @@ class HighlightController {
     }, 1800);
   }
 
-  private async captureCleanHtml(): Promise<string> {
+  private captureCleanHtml(): string {
     const clone = document.documentElement.cloneNode(true) as HTMLElement;
     clone.querySelectorAll(
       ".llmwiki-pill, .llmwiki-popover, .llmwiki-toast, #llmwiki-highlight-style",
@@ -857,11 +855,13 @@ class HighlightController {
       parent.removeChild(mark);
     });
 
-    await this.inlineLoadedImages(clone);
+    this.normalizeImageUrls(clone);
     return clone.outerHTML;
   }
 
-  private async inlineLoadedImages(clone: HTMLElement): Promise<void> {
+  // No client-side image fetching: resolve each image to its best absolute
+  // URL and let the API's server-side fetcher rehost it.
+  private normalizeImageUrls(clone: HTMLElement): void {
     const liveImages = Array.from(document.images);
     const cloneImages = Array.from(clone.querySelectorAll("img"));
     const candidates = liveImages
@@ -888,31 +888,16 @@ class HighlightController {
         return item.inArticle && !item.hasKnownSize;
       })
       .sort((a, b) => b.score - a.score)
-      .slice(0, MAX_INLINE_IMAGES);
+      .slice(0, MAX_CAPTURED_IMAGES);
 
-    let totalBytes = 0;
     for (const item of candidates) {
-      if (totalBytes >= MAX_INLINE_TOTAL_BYTES) break;
-      const maxBytes = Math.min(MAX_INLINE_IMAGE_BYTES, MAX_INLINE_TOTAL_BYTES - totalBytes);
-      try {
-        const response = await chrome.runtime.sendMessage({
-          type: "FETCH_IMAGE_DATA_URL",
-          url: item.src,
-          maxBytes,
-        });
-        if (!response?.dataUrl || response?.error) continue;
-        totalBytes += response.size ?? 0;
-        const cloneImg = cloneImages[item.index];
-        if (!cloneImg) continue;
-        cloneImg.setAttribute("src", response.dataUrl);
-        cloneImg.removeAttribute("srcset");
-        cloneImg.removeAttribute("sizes");
-        if (item.width) cloneImg.setAttribute("width", String(item.width));
-        if (item.height) cloneImg.setAttribute("height", String(item.height));
-        cloneImg.setAttribute("data-llmwiki-inlined-image", "true");
-      } catch {
-        // Leave the original URL in place so the API can still try server-side.
-      }
+      const cloneImg = cloneImages[item.index];
+      if (!cloneImg) continue;
+      cloneImg.setAttribute("src", item.src);
+      cloneImg.removeAttribute("srcset");
+      cloneImg.removeAttribute("sizes");
+      if (item.width) cloneImg.setAttribute("width", String(item.width));
+      if (item.height) cloneImg.setAttribute("height", String(item.height));
     }
   }
 
@@ -968,7 +953,7 @@ class HighlightController {
         url: canonicalizeUrl(location.href),
         title: document.title || location.href,
         path: this.folderPath,
-        html: await this.captureCleanHtml(),
+        html: this.captureCleanHtml(),
         highlights: highlightsToSave.length ? highlightsToSave : undefined,
       });
       this.knowledgeBaseId = knowledgeBaseId;
```

**File**: `extension/src/entrypoints/popup/components/SaveForm.tsx` (modified, +8/-45)
```diff
@@ -157,10 +157,8 @@ export default function SaveForm({ apiUrl, accessToken }: Props) {
       // floating in the saved HTML.
       const [{ result }] = await chrome.scripting.executeScript({
         target: { tabId: tab.tabId },
-        func: async () => {
+        func: () => {
           const MAX_IMAGES = 24;
-          const MAX_IMAGE_BYTES = 2_500_000;
-          const MAX_TOTAL_BYTES = 6_000_000;
           const LAZY_IMAGE_SRC_ATTRIBUTES = [
             "data-src",
             "data-original",
@@ -214,51 +212,16 @@ export default function SaveForm({ apiUrl, accessToken }: Props) {
             .sort((a, b) => b.score - a.score)
             .slice(0, MAX_IMAGES);
 
-          const pageOrigin = location.origin;
-          const isSameOrigin = (src: string): boolean => {
-            try {
-              return new URL(src).origin === pageOrigin;
-            } catch {
-              return false;
-            }
-          };
-
-          let totalBytes = 0;
+          // No client-side image fetching: resolve each image to its best
+          // absolute URL and let the API's server-side fetcher rehost it.
           for (const item of candidates) {
             const cloneImg = cloneImages[item.index];
             if (!cloneImg) continue;
-
-            // Under activeTab we can only read same-origin resources; cross-origin
-            // images keep their absolute URL for the server-side fetch.
-            if (!isSameOrigin(item.src)) {
-              cloneImg.setAttribute("src", item.src);
-              cloneImg.removeAttribute("srcset");
-              cloneImg.removeAttribute("sizes");
-              if (item.width) cloneImg.setAttribute("width", String(item.width));
-              if (item.height) cloneImg.setAttribute("height", String(item.height));
-              continue;
-            }
-
-            if (totalBytes >= MAX_TOTAL_BYTES) continue;
-            const remaining = MAX_TOTAL_BYTES - totalBytes;
-            const maxBytes = Math.min(MAX_IMAGE_BYTES, remaining);
-            try {
-              const response = await chrome.runtime.sendMessage({
-                type: "FETCH_IMAGE_DATA_URL",
-                url: item.src,
-                maxBytes,
-              });
-              if (!response?.dataUrl || response?.error) continue;
-              totalBytes += response.size ?? 0;
-              cloneImg.setAttribute("src", response.dataUrl);
-              cloneImg.removeAttribute("srcset");
-              cloneImg.removeAttribute("sizes");
-              if (item.width) cloneImg.setAttribute("width", String(item.width));
-              if (item.height) cloneImg.setAttribute("height", String(item.height));
-              cloneImg.setAttribute("data-llmwiki-inlined-image", "true");
-            } catch {
-              // Leave the original URL in place so the API can still try server-side.
-            }
+            cloneImg.setAttribute("src", item.src);
+            cloneImg.removeAttribute("srcset");
+            cloneImg.removeAttribute("sizes");
+            if (item.width) cloneImg.setAttribute("width", String(item.width));
+            if (item.height) cloneImg.setAttribute("height", String(item.height));
           }
 
           return clone.outerHTML;
```

**File**: `extension/src/lib/security.test.ts` (modified, +1/-11)
```diff
@@ -1,6 +1,6 @@
 import { describe, expect, it } from "vitest";
 
-import { isAllowedApiFetchUrl, isSupportedRemoteResourceUrl } from "./security";
+import { isAllowedApiFetchUrl } from "./security";
 
 describe("extension security helpers", () => {
   describe("isAllowedApiFetchUrl", () => {
@@ -28,14 +28,4 @@ describe("extension security helpers", () => {
       expect(isAllowedApiFetchUrl("not a url", apiUrl)).toBe(false);
     });
   });
-
-  describe("isSupportedRemoteResourceUrl", () => {
-    it("allows only http and https image/resource URLs", () => {
-      expect(isSupportedRemoteResourceUrl("https://assets.example/image.webp")).toBe(true);
-      expect(isSupportedRemoteResourceUrl("http://localhost:8000/image.png")).toBe(true);
-      expect(isSupportedRemoteResourceUrl("data:image/png;base64,abc")).toBe(false);
-      expect(isSupportedRemoteResourceUrl("blob:https://example.com/id")).toBe(false);
-      expect(isSupportedRemoteResourceUrl("file:///tmp/image.png")).toBe(false);
-    });
-  });
 });
```

**File**: `extension/src/lib/security.ts` (modified, +0/-9)
```diff
@@ -8,12 +8,3 @@ export function isAllowedApiFetchUrl(targetUrl: string, configuredApiUrl: string
     return false;
   }
 }
-
-export function isSupportedRemoteResourceUrl(url: string): boolean {
-  try {
-    const parsed = new URL(url);
-    return parsed.protocol === "http:" || parsed.protocol === "https:";
-  } catch {
-    return false;
-  }
-}
```

---

### Incident Patch 7: `823b4952` (2026-07-05)
**Commit Message**: Extension bug fix; added new tool to download PDFs directly via MCP

**File**: `api/infra/safe_fetch.py` (added, +63/-0)
```diff
@@ -0,0 +1,63 @@
+"""SSRF-guarded outbound HTTP primitives shared by server-side URL fetchers."""
+
+import ipaddress
+import socket
+from urllib.parse import ParseResult, urljoin
+
+import httpx
+
+
+def is_blocked_address(addr: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
+    # not is_global also catches shared address space (100.64.0.0/10, CGNAT) —
+    # which is what Railway's internal network uses.
+    return (
+        addr.is_private
+        or addr.is_loopback
+        or addr.is_link_local
+        or addr.is_reserved
+        or addr.is_multicast
+        or addr.is_unspecified
+        or not addr.is_global
+    )
+
+
+def resolve_public_ip(host: str) -> str | None:
+    """Resolve a host, returning its first address only if every resolved address is publicly routable."""
+    try:
+        infos = socket.getaddrinfo(host, None)
+    except socket.gaierror:
+        return None
+    addresses: list[str] = []
+    for info in infos:
+        ip = info[4][0]
+        try:
+            addr = ipaddress.ip_address(ip)
+        except ValueError:
+            return None
+        if is_blocked_address(addr):
+            return None
+        addresses.append(ip)
+    return addresses[0] if addresses else None
+
+
+def build_pinned_request(
+    client: httpx.AsyncClient,
+    parsed: ParseResult,
+    ip: str,
+    headers: dict[str, str],
+) -> httpx.Request:
+    """Build a request whose connection targets the validated IP while keeping the original Host and SNI."""
+    host_header = parsed.hostname if parsed.port is None else f"{parsed.hostname}:{parsed.port}"
+    literal = f"[{ip}]" if ":" in ip else ip
+    netloc = literal if parsed.port is None else f"{literal}:{parsed.port}"
+    pinned_url = parsed._replace(netloc=netloc).geturl()
+    request_headers = {**headers, "Host": host_header}
+    extensions = {"sni_hostname": parsed.hostname} if parsed.scheme == "https" else {}
+    return client.build_request("GET", pinned_url, headers=request_headers, extensions=extensions)
+
+
+def redirect_location(resp: httpx.Response, base_url: str) -> str | None:
+    if not resp.is_redirect:
+        return None
+    location = resp.headers.get("location")
+    return urljoin(base_url, location) if location else None
```

**File**: `api/routes/documents.py` (modified, +14/-1)
```diff
@@ -3,13 +3,15 @@
 
 from fastapi import APIRouter, Depends, HTTPException, Query, Request
 
+from auth import get_current_user
 from deps import get_document_service
 from infra.rate_limit import limiter
 from services.base import DocumentService
 from services.types import (
-    BulkDelete, CreateNote, CreateWebClip,
+    BulkDelete, CreateFromUrl, CreateNote, CreateWebClip,
     ReplaceHighlights, UpdateContent, UpdateMetadata, UpsertHighlight,
 )
+from services.url_ingest import UrlIngestService
 
 router = APIRouter(tags=["documents"])
 
@@ -81,6 +83,17 @@ async def create_web_clip(
     )
 
 
+@router.post("/v1/documents/from-url", status_code=201)
+@limiter.limit("10/minute")
+async def create_document_from_url(request: Request, body: CreateFromUrl):
+    user_id = await get_current_user(request)
+    state = request.app.state
+    if not state.s3_service or not state.ocr_service:
+        raise HTTPException(status_code=501, detail="URL ingestion is only available in hosted mode")
+    service = UrlIngestService(state.pool, state.s3_service, state.ocr_service)
+    return await service.ingest_pdf(user_id, str(body.knowledge_base_id), body.url, body.path)
+
+
 @router.get("/v1/documents/{doc_id}/highlights")
 async def get_document_highlights(
     doc_id: UUID,
```

**File**: `api/services/types.py` (modified, +14/-0)
```diff
@@ -1,11 +1,19 @@
 """Request/response models for the API surface."""
 
 import re
+from dataclasses import dataclass
 from typing import Literal
+from uuid import UUID
 
 from pydantic import BaseModel, Field
 
 
+@dataclass
+class DownloadedPdf:
+    data: bytes
+    filename: str
+
+
 class CreateKB(BaseModel):
     name: str
     description: str | None = None
@@ -116,6 +124,12 @@ class DeleteHighlight(BaseModel):
     expectedVersion: int | None = None
 
 
+class CreateFromUrl(BaseModel):
+    knowledge_base_id: UUID
+    url: str = Field(max_length=2048)
+    path: str = Field(default="/", max_length=256)
+
+
 class CreateWebClip(BaseModel):
     # 10 MB is generous for HTML; a typical blog article is <100 KB.
     # Bounds the BeautifulSoup parsing surface to keep one upload from
```

**File**: `api/services/url_ingest.py` (added, +213/-0)
```diff
@@ -0,0 +1,213 @@
+"""Download a public PDF by URL and feed it into the standard ingest pipeline."""
+
+from __future__ import annotations
+
+import asyncio
+import json
+import re
+from typing import TYPE_CHECKING
+from urllib.parse import unquote, urlparse
+from uuid import uuid4
+
+import asyncpg
+import httpx
+from fastapi import HTTPException
+
+from config import settings
+from infra.safe_fetch import build_pinned_request, redirect_location, resolve_public_ip
+from services.types import DownloadedPdf
+
+if TYPE_CHECKING:
+    from services.ocr import OCRService
+    from services.s3 import S3Service
+
+MAX_PDF_BYTES = 50 * 1024 * 1024
+DOWNLOAD_TIMEOUT = 30
+MAX_REDIRECTS = 5
+USER_AGENT = "LLMWiki/1.0 (+https://llmwiki.app)"
+
+_ARXIV_ABS_RE = re.compile(r"^(https?://(?:www\.)?arxiv\.org)/abs/(.+)$")
+_DISPOSITION_FILENAME_RE = re.compile(r'filename\*?=(?:"([^"]+)"|([^;\s]+))', re.IGNORECASE)
+
+
+class UrlIngestService:
+
+    def __init__(self, pool: asyncpg.Pool, s3_service: S3Service, ocr_service: OCRService):
+        self.pool = pool
+        self.s3 = s3_service
+        self.ocr = ocr_service
+
+    async def ingest_pdf(self, user_id: str, kb_id: str, url: str, path: str) -> dict:
+        url = _normalize_pdf_url(url)
+        path = _sanitize_path(path)
+        await self._require_kb_owned(user_id, kb_id)
+
+        existing = await self._find_by_source_url(user_id, kb_id, url)
+        if existing:
+            return {**existing, "already_exists": True}
+
+        pdf = await self._download(url)
+        return await self._create_pending_document(user_id, kb_id, url, path, pdf)
+
+    async def _download(self, url: str) -> DownloadedPdf:
+        current = url
+        async with httpx.AsyncClient(timeout=DOWNLOAD_TIMEOUT, follow_redirects=False) as client:
+            for _ in range(MAX_REDIRECTS + 1):
+                parsed = urlparse(current)
+                if parsed.scheme not in ("http", "https") or not parsed.hostname:
+                    raise HTTPException(status_code=400, detail="URL must be a public http(s) address")
+                ip = resolve_public_ip(parsed.hostname)
+                if not ip:
+                    raise HTTPException(status_code=400, detail="URL host is not publicly reachable")
+                request = build_pinned_request(
+                    client, parsed, ip,
+                    {"Accept": "application/pdf,*/*", "User-Agent": USER_AGENT},
+                )
+                try:
+                    resp = await client.send(request, stream=True)
+                except httpx.HTTPError as e:
+                    raise HTTPException(status_code=400, detail=f"Could not fetch URL: {e}")
+                try:
+                    redirect = redirect_location(resp, current)
+                    if redirect:
+                        current = redirect
+                        continue
+                    return self._validate_pdf_response(resp, await self._read_capped(resp), current)
+                finally:
+                    await resp.aclose()
+        raise HTTPException(status_code=400, detail="Too many redirects")
+
+    async def _read_capped(self, resp: httpx.Response) -> bytes:
+        if resp.status_code != 200:
+            raise HTTPException(status_code=400, detail=f"URL returned HTTP {resp.status_code}")
+        chunks = bytearray()
+        async for chunk in resp.aiter_bytes(chunk_size=65536):
+            if len(chunks) + len(chunk) > MAX_PDF_BYTES:
+                raise HTTPException(
+                    status_code=413,
+                    detail=f"PDF exceeds the {MAX_PDF_BYTES // (1024 * 1024)} MB download limit",
+                )
+            chunks.extend(chunk)
+        return bytes(chunks)
+
+    def _validate_pdf_response(self, resp: httpx.Response, data: bytes, final_url: str) -> DownloadedPdf:
+        if not data.startswith(b"%PDF-"):
+            raise HTTPException(
+                status_code=400,
+                detail="URL did not return a PDF. For web pages, use the browser extension instead.",
+            )
+        return DownloadedPdf(data=data, filename=_derive_filename(resp, final_url))
+
+    async def _create_pending_document(
+        self, user_id: str, kb_id: str, url: str, path: str, pdf: DownloadedPdf,
+    ) -> dict:
+        document_id = str(uuid4())
+        await self._insert_within_quota(document_id, kb_id, user_id, pdf, path, url)
+
+        s3_key = f"{user_id}/{document_id}/source.pdf"
+        try:
+            await self.s3.upload_bytes(s3_key, pdf.data, "application/pdf")
+        except Exception:
+            await self._delete_document_row(document_id)
+            raise HTTPException(status_code=502, detail="Could not store the downloaded PDF — try again")
+
+        asyncio.create_task(self.ocr.process_document(document_id, user_id))
+        return {
+            "id": document_id,
+            "filename": pdf.filename,
+            "status": "pending",
+            "alr
```

**File**: `api/services/webclip_assets.py` (modified, +5/-54)
```diff
@@ -3,15 +3,14 @@
 import asyncio
 import base64
 import hashlib
-import ipaddress
 import mimetypes
 import re
-import socket
 from dataclasses import dataclass
-from urllib.parse import ParseResult, urljoin, urlparse
+from urllib.parse import urlparse
 
 import httpx
 from html_parser import Image
+from infra.safe_fetch import build_pinned_request, redirect_location, resolve_public_ip
 
 MAX_IMAGE_BYTES = 10 * 1024 * 1024
 IMAGE_TIMEOUT = 5
@@ -152,36 +151,6 @@ async def _fetch_image(url: str) -> tuple[bytes, str] | None:
     return None
 
 
-def _is_blocked_address(addr: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
-    return (
-        addr.is_private
-        or addr.is_loopback
-        or addr.is_link_local
-        or addr.is_reserved
-        or addr.is_multicast
-        or addr.is_unspecified
-    )
-
-
-def _resolve_public_ip(host: str) -> str | None:
-    """Resolve a host, returning its first address only if every resolved address is publicly routable."""
-    try:
-        infos = socket.getaddrinfo(host, None)
-    except socket.gaierror:
-        return None
-    addresses: list[str] = []
-    for info in infos:
-        ip = info[4][0]
-        try:
-            addr = ipaddress.ip_address(ip)
-        except ValueError:
-            return None
-        if _is_blocked_address(addr):
-            return None
-        addresses.append(ip)
-    return addresses[0] if addresses else None
-
-
 async def _fetch_remote_image(url: str) -> tuple[bytes, str] | None:
     """Fetch an external image with SSRF guards and size/type validation, or None."""
     current = url
@@ -190,16 +159,16 @@ async def _fetch_remote_image(url: str) -> tuple[bytes, str] | None:
             parsed = urlparse(current)
             if parsed.scheme not in ("http", "https") or not parsed.hostname:
                 return None
-            ip = _resolve_public_ip(parsed.hostname)
+            ip = resolve_public_ip(parsed.hostname)
             if not ip:
                 return None
-            request = _build_pinned_request(client, parsed, ip)
+            request = build_pinned_request(client, parsed, ip, {"Accept": "image/*"})
             try:
                 resp = await client.send(request, stream=True)
             except (httpx.HTTPError, ValueError):
                 return None
             try:
-                redirect = _redirect_location(resp, current)
+                redirect = redirect_location(resp, current)
                 if redirect:
                     current = redirect
                     continue
@@ -209,24 +178,6 @@ async def _fetch_remote_image(url: str) -> tuple[bytes, str] | None:
     return None
 
 
-def _build_pinned_request(client: httpx.AsyncClient, parsed: ParseResult, ip: str) -> httpx.Request:
-    """Build a request whose connection targets the validated IP while keeping the original Host and SNI."""
-    host_header = parsed.hostname if parsed.port is None else f"{parsed.hostname}:{parsed.port}"
-    literal = f"[{ip}]" if ":" in ip else ip
-    netloc = literal if parsed.port is None else f"{literal}:{parsed.port}"
-    pinned_url = parsed._replace(netloc=netloc).geturl()
-    headers = {"Accept": "image/*", "Host": host_header}
-    extensions = {"sni_hostname": parsed.hostname} if parsed.scheme == "https" else {}
-    return client.build_request("GET", pinned_url, headers=headers, extensions=extensions)
-
-
-def _redirect_location(resp: httpx.Response, base_url: str) -> str | None:
-    if not resp.is_redirect:
-        return None
-    location = resp.headers.get("location")
-    return urljoin(base_url, location) if location else None
-
-
 async def _read_image_response(resp: httpx.Response) -> tuple[bytes, str] | None:
     if resp.status_code != 200:
         return None
```

**File**: `extension/src/entrypoints/background/index.ts` (modified, +2/-2)
```diff
@@ -254,8 +254,8 @@ export default defineBackground(() => {
         }
       } else {
         const lastSegment = new URL(url).pathname.split("/").pop();
-        if (lastSegment?.endsWith(".pdf")) {
-          filename = lastSegment;
+        if (lastSegment) {
+          filename = lastSegment.endsWith(".pdf") ? lastSegment : `${lastSegment}.pdf`;
         }
       }
 
```

**File**: `extension/src/entrypoints/popup/App.tsx` (modified, +0/-5)
```diff
@@ -29,7 +29,6 @@ export default function App() {
   const [apiUrl, setApiUrl] = useState("");
   const [mode, setModeState] = useState<Mode>("cloud");
   const [currentHost, setCurrentHost] = useState<string | null>(null);
-  const [isPdf, setIsPdf] = useState(false);
   const [hostDisabled, setHostDisabled] = useState(false);
   const [showReloadHint, setShowReloadHint] = useState(false);
   const authNoticeTimer = useRef<number | null>(null);
@@ -45,11 +44,7 @@ export default function App() {
       if (!tab?.url) return;
       const host = new URL(tab.url).hostname.replace(/^www\./, "");
       if (!host) return;
-      const looksLikePdf =
-        tab.url.toLowerCase().endsWith(".pdf") ||
-        (tab.title?.toLowerCase().endsWith(".pdf") ?? false);
       setCurrentHost(host);
-      setIsPdf(looksLikePdf);
       setHostDisabled(await isDomainDisabled(host));
     } catch {
       // Restricted page or no permissions; the toggle button stays hidden.
```

**File**: `extension/src/entrypoints/popup/components/SaveForm.tsx` (modified, +2/-3)
```diff
@@ -14,6 +14,7 @@ import {
   setSelectedFolderPath,
   setSelectedKnowledgeBaseId,
 } from "@/lib/settings";
+import { isPdfTab } from "@/lib/pdf";
 import KBPicker from "./KBPicker";
 import StatusFeedback, { type Status } from "./StatusFeedback";
 import { canonicalize } from "@/lib/url";
@@ -116,9 +117,7 @@ export default function SaveForm({ apiUrl, accessToken }: Props) {
     if (!activeTab?.url || !activeTab.id) return;
 
     const url = activeTab.url;
-    const isPdf =
-      url.toLowerCase().endsWith(".pdf") ||
-      (activeTab.title?.toLowerCase().endsWith(".pdf") ?? false);
+    const isPdf = await isPdfTab(activeTab.id, url, activeTab.title);
 
     setTab({ url, title: activeTab.title ?? "", isPdf, tabId: activeTab.id });
     setTitle(activeTab.title ?? "");
```

---

### Incident Patch 8: `3f670dc6` (2026-07-02)
**Commit Message**: Fix set_course_mode: knowledge_bases has no RLS write policy, use service role like other KB writes

Co-Authored-By: Claude Opus 4.8 <[REDACTED_EMAIL]>

**File**: `mcp/vaultfs/postgres.py` (modified, +3/-2)
```diff
@@ -88,8 +88,9 @@ async def create_knowledge_base(self, name: str, description: str | None = None,
         return row
 
     async def set_knowledge_base_kind(self, kb_id: str, kind: str) -> dict | None:
-        return await scoped_queryrow(
-            self.user_id,
+        # knowledge_bases has no RLS write policy; writes go through the
+        # service role with the explicit user_id filter, like every other KB write.
+        return await service_queryrow(
             "UPDATE knowledge_bases SET kind = $1, updated_at = now() "
             "WHERE id = $2::uuid AND user_id = $3 "
             "RETURNING id, name, slug, kind",
```

---

### Incident Patch 9: `d3a4f364` (2026-07-02)
**Commit Message**: Reorganized sidenav; added minimize; connection fix on MCP server; added highlighting and annotation capabilities to wiki

**File**: `mcp/hosted.py` (modified, +3/-0)
```diff
@@ -80,6 +80,9 @@ def _build_allowed_hosts(mcp_url: str) -> list[str]:
         enable_dns_rebinding_protection=True,
         allowed_hosts=_build_allowed_hosts(settings.MCP_URL),
     ),
+    # Stateless: in-memory sessions die on every Railway restart/redeploy, and the
+    # idle SSE stream has no keepalive so the edge proxy cuts it — both drop clients.
+    stateless_http=True,
 )
 
 def _get_user_id(ctx):
```

**File**: `mcp/tools/guide.py` (modified, +8/-1)
```diff
@@ -140,6 +140,10 @@
 - Create: `create(path="/wiki/", title="diagram.svg", content="<svg>...</svg>", tags=["diagram"])`
 - Embed in wiki pages: `![Description](diagram.svg)`
 
+**Math** — LaTeX renders via KaTeX, dollar delimiters ONLY:
+- Inline: `$h_t^{(\ell)}$` — Display: `$$L = -\log p(y)$$`
+- Never use `\( \)` or `\[ \]` — markdown eats the backslashes and the formula renders as plain text
+
 ### Citations — REQUIRED
 
 Every factual claim MUST cite its source via markdown footnotes:
@@ -213,7 +217,7 @@
 
 A **course** is a knowledge base with `kind="course"`. Same engine, same tools, same page format as a wiki — the only difference is how the app renders it: the sidebar shows a lesson rail with per-lesson progress (complete / current / locked), and each lesson gets a **Mark complete** action. Progress persists, so the user can leave and resume later. That cross-session resume is the whole point.
 
-Create one with `create_knowledge_base(name="...", kind="course")`.
+Create one with `create_knowledge_base(name="...", kind="course")`, or convert an existing wiki with `set_course_mode(knowledge_base="...", kind="course")` (reversible — pass `kind="wiki"` to convert back).
 
 ### Structure — group lessons into modules (do this by default)
 A course is authored like a wiki under `/wiki/`, but **organize the lessons into modules — do not dump a flat list of lessons at the root.** A module is a folder; a lesson is a markdown file inside it. The sidebar renders each module as a collapsible group with its lessons beneath; a flat pile reads poorly and is almost never what you want.
@@ -241,6 +245,9 @@
 ### Do NOT author progress
 Never write completion state into a page. The app owns progress (the user clicks **Mark complete**); it is derived per-lesson and stored by the app, not by you. Your job is to author the lessons; the app tracks the journey through them.
 
+### Highlights are confusion signals
+Users can highlight passages on any wiki page and attach a note. These surface in the `## Highlights & Annotations` appendix when you `read` the page. On a lesson, treat them as points of confusion: rework the highlighted passage — a clearer explanation, an example, a diagram — rather than just acknowledging the note. Highlights anchor to the exact text, so rewriting a passage clears its marker in the app; an annotation quoting text that no longer exists in the page has already been addressed — don't rework it again.
+
 ## Available Knowledge Bases
 
 """
```

**File**: `mcp/tools/list.py` (modified, +26/-0)
```diff
@@ -54,6 +54,32 @@ async def create_knowledge_base(
             f"Use `knowledge_base=\"{kb['slug']}\"` with the other tools."
         )
 
+    @mcp.tool(
+        name="set_course_mode",
+        description=(
+            "Convert an existing knowledge base into a course (kind='course') or back "
+            "into a plain wiki (kind='wiki'). A course renders its pages as ordered "
+            "lessons with progress tracking; a wiki is free-form. Reversible — this only "
+            "changes how the app renders the knowledge base, never its content."
+        ),
+    )
+    async def set_course_mode(ctx: Context, knowledge_base: str, kind: str) -> str:
+        if kind not in ("wiki", "course"):
+            return "Error: kind must be 'wiki' or 'course'."
+
+        user_id = get_user_id(ctx)
+        fs = fs_factory(user_id)
+        kb = await fs.resolve_kb(knowledge_base)
+        if not kb:
+            return f"Error: knowledge base '{knowledge_base}' not found."
+
+        updated = await fs.set_knowledge_base_kind(kb["id"], kind)
+        if not updated:
+            return f"Error: could not update '{knowledge_base}'."
+
+        label = "course" if kind == "course" else "wiki"
+        return f"**{updated['name']}** (`{updated['slug']}`) is now a {label}."
+
     @mcp.tool(
         name="list_knowledge_bases",
         description=(
```

**File**: `mcp/vaultfs/base.py` (modified, +3/-0)
```diff
@@ -24,6 +24,9 @@ async def list_knowledge_bases(self) -> list[dict]: ...
     @abstractmethod
     async def create_knowledge_base(self, name: str, description: str | None = None, kind: str = "wiki") -> dict: ...
 
+    @abstractmethod
+    async def set_knowledge_base_kind(self, kb_id: str, kind: str) -> dict | None: ...
+
     @abstractmethod
     async def get_document(self, kb_id: str, filename: str, dir_path: str) -> dict | None: ...
 
```

**File**: `mcp/vaultfs/postgres.py` (modified, +9/-0)
```diff
@@ -87,6 +87,15 @@ async def create_knowledge_base(self, name: str, description: str | None = None,
         await self._scaffold_wiki(str(row["id"]), row["name"])
         return row
 
+    async def set_knowledge_base_kind(self, kb_id: str, kind: str) -> dict | None:
+        return await scoped_queryrow(
+            self.user_id,
+            "UPDATE knowledge_bases SET kind = $1, updated_at = now() "
+            "WHERE id = $2::uuid AND user_id = $3 "
+            "RETURNING id, name, slug, kind",
+            kind, kb_id, self.user_id,
+        )
+
 
     async def get_document(self, kb_id: str, filename: str, dir_path: str) -> dict | None:
         return await scoped_queryrow(
```

**File**: `mcp/vaultfs/sqlite.py` (modified, +10/-0)
```diff
@@ -164,6 +164,16 @@ async def create_knowledge_base(self, name: str, description: str | None = None,
             "local_singleton": True,
         }
 
+    async def set_knowledge_base_kind(self, kb_id: str, kind: str) -> dict | None:
+        db = self._db_or_raise()
+        await db.execute("UPDATE workspace SET kind = ? WHERE id = ?", (kind, kb_id))
+        await db.commit()
+        cursor = await db.execute("SELECT id, name, name as slug, kind FROM workspace WHERE id = ?", (kb_id,))
+        row = await cursor.fetchone()
+        if not row:
+            return None
+        return _rows_to_dicts(cursor, [row])[0]
+
 
     async def get_document(self, kb_id: str, filename: str, dir_path: str) -> dict | None:
         db = self._db_or_raise()
```

**File**: `tests/integration/isolation/test_api_isolation.py` (modified, +10/-0)
```diff
@@ -224,6 +224,16 @@ async def test_update_kb_cross_tenant_returns_404(self, client):
         )
         assert resp.status_code == 404
 
+    async def test_convert_kb_kind_cross_tenant_does_not_modify(self, client, pool):
+        resp = await client.patch(
+            f"/v1/knowledge-bases/{KB_B_ID}",
+            headers=auth_headers(USER_A_ID),
+            json={"kind": "course"},
+        )
+        assert resp.status_code == 404
+        row = await pool.fetchrow("SELECT kind FROM knowledge_bases WHERE id = $1", KB_B_ID)
+        assert row["kind"] == "wiki"
+
     async def test_delete_kb_cross_tenant_returns_404(self, client):
         resp = await client.delete(
             f"/v1/knowledge-bases/{KB_B_ID}",
```

**File**: `tests/integration/mcp/test_mcp_isolation.py` (modified, +6/-0)
```diff
@@ -266,6 +266,12 @@ async def test_update_document_other_tenant_does_not_modify(self, fs_alice, pg_p
         row = await pg_pool.fetchrow("SELECT content FROM documents WHERE id = $1", DOC_B_ID)
         assert row["content"] == "Bob secret"
 
+    async def test_set_knowledge_base_kind_other_tenant_does_not_modify(self, fs_alice, pg_pool):
+        result = await fs_alice.set_knowledge_base_kind(str(KB_B_ID), "course")
+        assert result is None
+        row = await pg_pool.fetchrow("SELECT kind FROM knowledge_bases WHERE id = $1", KB_B_ID)
+        assert row["kind"] == "wiki"
+
     async def test_create_document_into_other_tenant_kb_rejected(self, fs_alice, pg_pool):
         """create_document writes into the caller's own KB but refuses a foreign one."""
         own = await fs_alice.create_document(
```

---

### Incident Patch 10: `64ea5cd7` (2026-06-29)
**Commit Message**: Add course mode: kind flag + lesson progress UI

Knowledge bases gain a `kind` column ('wiki' | 'course'). A course reuses
the wiki engine with a progress skin: sequential lesson locking, a clean
prev/next pager that completes the current lesson on advance, and
cross-session resume. Per-lesson completion persists in
documents.metadata.course via the existing PATCH /v1/documents endpoint —
no course-specific backend.

- Backend: kind threaded through hosted (Postgres) + local (SQLite) KB
  services, CreateKB/UpdateKB, the route, and migration 008. Local
  create upgrades the singleton to a course on demand.
- Frontend: course tree helpers (overview/log are structural, not
  lessons), progress sidebar glyphs + hard locks, lesson footer arrows,
  and a progressive course opt-in in the create dialog.
- MCP: create_knowledge_base gains a kind param; guide documents courses
  (modules via folders, clean lesson titles).

Co-Authored-By: Claude Opus 4.8 <[REDACTED_EMAIL]>

**File**: `api/infra/db/sqlite.py` (modified, +4/-0)
```diff
@@ -95,6 +95,10 @@ async def create_pool(db_path: str, init_schema: bool = True) -> aiosqlite.Conne
     if init_schema:
         schema = _SCHEMA_PATH.read_text(encoding='utf-8')
         await db.executescript(schema)
+        # No migration runner: add workspace.kind to pre-existing DBs.
+        cur = await db.execute("PRAGMA table_info(workspace)")
+        if "kind" not in {row[1] for row in await cur.fetchall()}:
+            await db.execute("ALTER TABLE workspace ADD COLUMN kind TEXT NOT NULL DEFAULT 'wiki'")
         await db.commit()
     return db
 
```

**File**: `api/routes/knowledge_bases.py` (modified, +3/-3)
```diff
@@ -25,14 +25,14 @@ async def get_knowledge_base(kb_id: UUID, service: Annotated[KBService, Depends(
 
 @router.post("", status_code=201)
 async def create_knowledge_base(body: CreateKB, service: Annotated[KBService, Depends(get_kb_service)]):
-    return await service.create(body.name, body.description)
+    return await service.create(body.name, body.description, body.kind)
 
 
 @router.patch("/{kb_id}")
 async def update_knowledge_base(kb_id: UUID, body: UpdateKB, service: Annotated[KBService, Depends(get_kb_service)]):
-    if not body.name and not body.description:
+    if not body.name and not body.description and not body.kind:
         raise HTTPException(status_code=400, detail="No fields to update")
-    row = await service.update(str(kb_id), body.name, body.description)
+    row = await service.update(str(kb_id), body.name, body.description, body.kind)
     if not row:
         raise HTTPException(status_code=404, detail="Knowledge base not found")
     return row
```

**File**: `api/services/base.py` (modified, +2/-2)
```diff
@@ -26,10 +26,10 @@ async def list(self) -> list[dict]: ...
     async def get(self, kb_id: str) -> dict | None: ...
 
     @abstractmethod
-    async def create(self, name: str, description: str | None) -> dict: ...
+    async def create(self, name: str, description: str | None, kind: str | None = None) -> dict: ...
 
     @abstractmethod
-    async def update(self, kb_id: str, name: str | None, description: str | None) -> dict | None: ...
+    async def update(self, kb_id: str, name: str | None, description: str | None, kind: str | None = None) -> dict | None: ...
 
     @abstractmethod
     async def update_sharing(
```

**File**: `api/services/hosted.py` (modified, +19/-17)
```diff
@@ -67,7 +67,7 @@ async def get_usage(self) -> dict:
 
 
 _KB_LIST_QUERY = (
-    "SELECT kb.id, kb.user_id, kb.name, kb.slug, kb.description, "
+    "SELECT kb.id, kb.user_id, kb.name, kb.slug, kb.description, kb.kind, "
     "kb.created_at, kb.updated_at, "
     "(SELECT COUNT(*) FROM documents d WHERE d.knowledge_base_id = kb.id AND d.path NOT LIKE '/wiki/%' AND NOT d.archived AND COALESCE((d.metadata->>'hidden')::boolean, false) = false) AS source_count, "
     "(SELECT COUNT(*) FROM documents d WHERE d.knowledge_base_id = kb.id AND d.path LIKE '/wiki/%' AND NOT d.archived) AS wiki_page_count "
@@ -129,28 +129,30 @@ async def get(self, kb_id: str) -> dict | None:
         )
         return dict(row) if row else None
 
-    async def create(self, name: str, description: str | None) -> dict:
+    async def create(self, name: str, description: str | None, kind: str | None = None) -> dict:
         await self._check_capacity()
         slug = await self._unique_slug(name)
-        row = await self._insert_kb(name, slug, description)
+        row = await self._insert_kb(name, slug, description, kind or "wiki")
         await self._scaffold_wiki(row["id"], name)
         return dict(row)
 
-    async def update(self, kb_id: str, name: str | None, description: str | None) -> dict | None:
+    async def update(self, kb_id: str, name: str | None, description: str | None, kind: str | None = None) -> dict | None:
         if name is not None:
             slug = await self._unique_slug(name)
             row = await self.pool.fetchrow(
-                "UPDATE knowledge_bases SET name = $1, slug = $2, description = COALESCE($3, description), updated_at = now() "
-                "WHERE id = $4 AND user_id = $5 "
-                "RETURNING id, user_id, name, slug, description, created_at, updated_at",
-                name, slug, description, kb_id, self.user_id,
+                "UPDATE knowledge_bases SET name = $1, slug = $2, description = COALESCE($3, description), "
+                "kind = COALESCE($4, kind), updated_at = now() "
+                "WHERE id = $5 AND user_id = $6 "
+                "RETURNING id, user_id, name, slug, description, kind, created_at, updated_at",
+                name, slug, description, kind, kb_id, self.user_id,
             )
         else:
             row = await self.pool.fetchrow(
-                "UPDATE knowledge_bases SET description = $1, updated_at = now() "
-                "WHERE id = $2 AND user_id = $3 "
-                "RETURNING id, user_id, name, slug, description, created_at, updated_at",
-                description, kb_id, self.user_id,
+                "UPDATE knowledge_bases SET description = COALESCE($1, description), "
+                "kind = COALESCE($2, kind), updated_at = now() "
+                "WHERE id = $3 AND user_id = $4 "
+                "RETURNING id, user_id, name, slug, description, kind, created_at, updated_at",
+                description, kind, kb_id, self.user_id,
             )
         return dict(row) if row else None
 
@@ -159,18 +161,18 @@ async def _check_capacity(self) -> None:
         if user_count and user_count >= settings.GLOBAL_MAX_USERS:
             raise HTTPException(status_code=503, detail="We've reached our user capacity for now. Please try again later.")
 
-    async def _insert_kb(self, name: str, slug: str, description: str | None) -> dict:
+    async def _insert_kb(self, name: str, slug: str, description: str | None, kind: str = "wiki") -> dict:
         conn = await self.pool.acquire()
         try:
             async with conn.transaction():
                 current_name = name
                 for attempt in range(10):
                     try:
                         row = await conn.fetchrow(
-                            "INSERT INTO knowledge_bases (user_id, name, slug, description) "
-                            "VALUES ($1, $2, $3, $4) "
-                            "RETURNING id, user_id, name, slug, description, created_at, updated_at",
-                            self.user_id, current_name, slug, description,
+                            "INSERT INTO knowledge_bases (user_id, name, slug, description, kind) "
+                            "VALUES ($1, $2, $3, $4, $5) "
+                            "RETURNING id, user_id, name, slug, description, kind, created_at, updated_at",
+                            self.user_id, current_name, slug, description, kind,
                         )
                         return dict(row)
                     except asyncpg.UniqueViolationError:
```

**File**: `api/services/local.py` (modified, +10/-4)
```diff
@@ -59,7 +59,7 @@ def __init__(self, db, user_id: str):
 
     async def list(self) -> list[dict]:
         cursor = await self.db.execute(
-            "SELECT w.id, w.user_id, w.name, w.name as slug, w.description, "
+            "SELECT w.id, w.user_id, w.name, w.name as slug, w.description, w.kind, "
             "w.created_at, w.created_at as updated_at, "
             "(SELECT count(*) FROM documents WHERE source_kind = 'source' AND status != 'failed') as source_count, "
             "(SELECT count(*) FROM documents WHERE source_kind = 'wiki' AND status != 'failed') as wiki_page_count "
@@ -73,13 +73,16 @@ async def get(self, kb_id: str) -> dict | None:
         kbs = await self.list()
         return kbs[0] if kbs else None
 
-    async def create(self, name: str, description: str | None) -> dict:
+    async def create(self, name: str, description: str | None, kind: str | None = None) -> dict:
         kbs = await self.list()
         if kbs:
-            return kbs[0]
+            existing = kbs[0]
+            if kind == "course" and existing["kind"] != "course":
+                return await self.update(existing["id"], None, None, "course")
+            return existing
         raise HTTPException(status_code=400, detail="No workspace initialized")
 
-    async def update(self, kb_id: str, name: str | None, description: str | None) -> dict | None:
+    async def update(self, kb_id: str, name: str | None, description: str | None, kind: str | None = None) -> dict | None:
         sets = []
         params = []
         if name is not None:
@@ -88,6 +91,9 @@ async def update(self, kb_id: str, name: str | None, description: str | None) ->
         if description is not None:
             sets.append("description = ?")
             params.append(description)
+        if kind is not None:
+            sets.append("kind = ?")
+            params.append(kind)
         if not sets:
             return None
         params.append(kb_id)
```

**File**: `api/services/types.py` (modified, +2/-0)
```diff
@@ -9,11 +9,13 @@
 class CreateKB(BaseModel):
     name: str
     description: str | None = None
+    kind: Literal["wiki", "course"] | None = None
 
 
 class UpdateKB(BaseModel):
     name: str | None = None
     description: str | None = None
+    kind: Literal["wiki", "course"] | None = None
 
 
 # Mirrors the DB CHECK constraint on knowledge_bases.public_slug.
```

**File**: `mcp/tools/guide.py` (modified, +32/-0)
```diff
@@ -209,6 +209,38 @@
 
 Use the reference graph to maintain consistency. After editing a page, check the impact surface in the response and update affected pages.
 
+## Courses
+
+A **course** is a knowledge base with `kind="course"`. Same engine, same tools, same page format as a wiki — the only difference is how the app renders it: the sidebar shows a lesson rail with per-lesson progress (complete / current / locked), and each lesson gets a **Mark complete** action. Progress persists, so the user can leave and resume later. That cross-session resume is the whole point.
+
+Create one with `create_knowledge_base(name="...", kind="course")`.
+
+### Structure — group lessons into modules (do this by default)
+A course is authored like a wiki under `/wiki/`, but **organize the lessons into modules — do not dump a flat list of lessons at the root.** A module is a folder; a lesson is a markdown file inside it. The sidebar renders each module as a collapsible group with its lessons beneath; a flat pile reads poorly and is almost never what you want.
+
+```
+/wiki/overview.md                            <- course home (hub), not a lesson
+/wiki/01-foundations/01-why-rl.md            <- Module 1, Lesson 1
+/wiki/01-foundations/02-reward-models.md     <- Module 1, Lesson 2
+/wiki/02-algorithms/01-ppo.md                <- Module 2, Lesson 1
+/wiki/02-algorithms/02-grpo.md               <- Module 2, Lesson 2
+/wiki/03-failure-modes/01-reward-hacking.md  <- Module 3, Lesson 1
+```
+
+- **One level of folders only.** Module → Lesson. Don't nest modules inside modules.
+- Aim for 2–5 modules of 2–6 lessons each. Skip modules only for a genuinely tiny course (≤3 lessons).
+- `overview.md` is the course home — write it as a real landing page (what the course covers, who it's for, the module list). It is never marked complete and isn't counted as a lesson.
+
+### Ordering and titles
+- **Order** comes from zero-padded numeric prefixes on every folder and file (`01-`, `02-`, …) — and from creating them in sequence. Prefix everything; modules sort by their folder prefix, lessons by their file prefix.
+- **Display name** comes from each page's frontmatter `title`. Give every lesson a clean title (`title: Why RL After Pretraining`) so the rail shows that, not the raw filename. Without a title the sidebar falls back to the de-hyphenated filename (`01-why-rl.md` → "01 Why Rl"), which looks unfinished.
+
+### Each lesson is a full wiki page
+Lessons follow every wiki writing standard: required frontmatter (with a clean `title`), an opening summary (no H1 in the body — the title is rendered from frontmatter), `##` sections, at least one visual element, and citations when a lesson draws on sources. A lesson should teach, not just outline.
+
+### Do NOT author progress
+Never write completion state into a page. The app owns progress (the user clicks **Mark complete**); it is derived per-lesson and stored by the app, not by you. Your job is to author the lessons; the app tracks the journey through them.
+
 ## Available Knowledge Bases
 
 """
```

**File**: `mcp/tools/list.py` (modified, +11/-4)
```diff
@@ -10,7 +10,9 @@ def register(mcp: FastMCP, get_user_id, fs_factory) -> None:
     @mcp.tool(
         name="create_knowledge_base",
         description=(
-            "Create a new knowledge base/wiki and scaffold starter overview/log pages.\n\n"
+            "Create a new knowledge base and scaffold starter overview/log pages.\n\n"
+            "Set kind='course' to create a course instead of a wiki — same structure, but the "
+            "app renders lesson progress (mark-complete, current/locked lessons). Default 'wiki'.\n\n"
             "In hosted mode this creates a separate knowledge base with a unique slug. "
             "In local MCP mode there is one workspace per server, so this returns the "
             "existing workspace if it has already been initialized."
@@ -20,29 +22,34 @@ async def create_knowledge_base(
         ctx: Context,
         name: str,
         description: str = "",
+        kind: str = "wiki",
     ) -> str:
         name = name.strip()
         description = description.strip()
         if not name:
             return "Error: name is required when creating a knowledge base."
         if len(name) > 120:
             return "Error: knowledge base name must be 120 characters or fewer."
+        if kind not in ("wiki", "course"):
+            return "Error: kind must be 'wiki' or 'course'."
 
         user_id = get_user_id(ctx)
         fs = fs_factory(user_id)
-        kb = await fs.create_knowledge_base(name, description or None)
+        kb = await fs.create_knowledge_base(name, description or None, kind)
 
         if kb.get("already_exists"):
             if kb.get("local_singleton"):
+                label = "course" if kb.get("kind") == "course" else "knowledge base"
                 return (
                     "Local MCP mode uses one workspace per server. "
-                    f"Existing knowledge base: **{kb['name']}** (`{kb['slug']}`). "
+                    f"Existing {label}: **{kb['name']}** (`{kb['slug']}`). "
                     "Use that slug with the other tools."
                 )
             return f"Knowledge base already exists: **{kb['name']}** (`{kb['slug']}`)."
 
+        label = "course" if kind == "course" else "knowledge base"
         return (
-            f"Created knowledge base **{kb['name']}** (`{kb['slug']}`). "
+            f"Created {label} **{kb['name']}** (`{kb['slug']}`). "
             "Starter pages were added at `/wiki/overview.md` and `/wiki/log.md`. "
             f"Use `knowledge_base=\"{kb['slug']}\"` with the other tools."
         )
```

---

### Incident Patch 11: `67cf65c9` (2026-06-27)
**Commit Message**: Bug fix in local mode

**File**: `mcp/vaultfs/sqlite.py` (modified, +17/-16)
```diff
@@ -414,6 +414,10 @@ def _resolve_path(self, relative_path: str) -> Path | None:
             return None
         return resolved
 
+    def _disk_file_exists(self, dir_path: str, filename: str) -> bool:
+        path = self._resolve_path(dir_path.lstrip("/") + filename)
+        return path is not None and path.exists()
+
 
     async def delete_references(self, source_doc_id: str) -> None:
         db = self._db_or_raise()
@@ -514,19 +518,16 @@ async def _scaffold_wiki(self, kb_id: str, name: str) -> None:
         today = date.today().isoformat()
         overview = _OVERVIEW_TEMPLATE.format(name=name, date=today)
         log = _LOG_TEMPLATE.format(name=name, date=today)
-        await self.create_document(
-            kb_id,
-            "overview.md",
-            "Overview",
-            "/wiki/",
-            "md",
-            overview,
-            ["overview", "wiki"],
-            date=today,
-            metadata={"description": f"Research hub for {name}."},
-        )
-        await self.create_document(
-            kb_id, "log.md", "Log", "/wiki/", "md", log, ["log"],
-        )
-        self.write_to_disk("/wiki/", "overview.md", overview)
-        self.write_to_disk("/wiki/", "log.md", log)
+        # Never overwrite existing local content — a rebuilt index could scaffold over real files.
+        if not self._disk_file_exists("/wiki/", "overview.md"):
+            await self.create_document(
+                kb_id, "overview.md", "Overview", "/wiki/", "md", overview,
+                ["overview", "wiki"], date=today,
+                metadata={"description": f"Research hub for {name}."},
+            )
+            self.write_to_disk("/wiki/", "overview.md", overview)
+        if not self._disk_file_exists("/wiki/", "log.md"):
+            await self.create_document(
+                kb_id, "log.md", "Log", "/wiki/", "md", log, ["log"],
+            )
+            self.write_to_disk("/wiki/", "log.md", log)
```

**File**: `tests/integration/mcp/test_vaultfs_contract.py` (modified, +17/-0)
```diff
@@ -48,6 +48,23 @@ async def test_create_knowledge_base_returns_existing_local_workspace(self, fs):
         assert kb["already_exists"] is True
         assert kb["local_singleton"] is True
 
+    async def test_scaffold_does_not_overwrite_existing_local_files(self, workspace):
+        """A rebuilt index (no workspace row) must not clobber real local files."""
+        from vaultfs.sqlite import SqliteVaultFS
+
+        await SqliteVaultFS.close()
+        await SqliteVaultFS.init(str(workspace))
+        try:
+            (workspace / "wiki" / "overview.md").write_text("MY REAL NOTES", encoding="utf-8")
+            instance = SqliteVaultFS(TEST_USER_ID)
+            await instance.create_knowledge_base("Rebuilt", None)
+
+            # The existing overview is preserved; the missing log is still scaffolded.
+            assert (workspace / "wiki" / "overview.md").read_text(encoding="utf-8") == "MY REAL NOTES"
+            assert (workspace / "wiki" / "log.md").exists()
+        finally:
+            await SqliteVaultFS.close()
+
     async def test_resolve_kb_returns_workspace(self, fs):
         instance, kb_id = fs
         kb = await instance.resolve_kb("test-workspace")
```

**File**: `web/src/components/wiki/WikiContent.tsx` (modified, +10/-1)
```diff
@@ -1,6 +1,7 @@
 'use client'
 
 import * as React from 'react'
+import dynamic from 'next/dynamic'
 import ReactMarkdown from 'react-markdown'
 import remarkGfm from 'remark-gfm'
 import remarkMath from 'remark-math'
@@ -12,10 +13,18 @@ import { FileText, Copy, Check, Network } from 'lucide-react'
 import { cn } from '@/lib/utils'
 import { apiFetch } from '@/lib/api'
 import { useUserStore } from '@/stores'
-import { MermaidBlock } from './MermaidBlock'
 import { ExpandableMedia } from './DiagramViewer'
 import type { DocumentListItem } from '@/lib/types'
 
+const MermaidBlock = dynamic(() => import('./MermaidBlock').then((mod) => mod.MermaidBlock), {
+  ssr: false,
+  loading: () => (
+    <pre className="my-3 overflow-x-auto rounded-lg border border-border bg-muted/60 p-4 text-[13px] leading-relaxed">
+      Rendering diagram...
+    </pre>
+  ),
+})
+
 export interface TocItem {
   id: string
   text: string
```

**File**: `web/src/hooks/useKBDocuments.ts` (modified, +3/-0)
```diff
@@ -117,6 +117,9 @@ export function useKBDocuments(knowledgeBaseId: string) {
       }
 
       ws.onmessage = () => {
+        if (process.env.NODE_ENV === 'development') {
+          console.count(`documents ws message:${knowledgeBaseId}`)
+        }
         // Debounce refetches — OCR updates can fire many events in quick succession
         if (debounceTimer.current) clearTimeout(debounceTimer.current)
         debounceTimer.current = setTimeout(fetchDocs, DEBOUNCE_MS)
```

---

### Incident Patch 12: `b678e0df` (2026-06-27)
**Commit Message**: Tweaked UI and fixed local serving bug

**File**: `web/instrumentation.ts` (modified, +4/-0)
```diff
@@ -1,4 +1,6 @@
 export async function register() {
+  if (process.env.NODE_ENV === "development") return;
+
   if (process.env.NEXT_RUNTIME === "nodejs") {
     await import("./sentry.server.config");
   }
@@ -9,6 +11,8 @@ export async function register() {
 }
 
 export const onRequestError = async (...args: unknown[]) => {
+  if (process.env.NODE_ENV === "development") return;
+
   const Sentry = await import("@sentry/nextjs");
   return (Sentry.captureRequestError as Function)(...args);
 };
```

**File**: `web/next-env.d.ts` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 /// <reference types="next" />
 /// <reference types="next/image-types/global" />
-import "./.next/types/routes.d.ts";
+import "./.next/dev/types/routes.d.ts";
 
 // NOTE: This file should not be edited
 // see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
```

**File**: `web/next.config.ts` (modified, +6/-2)
```diff
@@ -7,7 +7,11 @@ const nextConfig: NextConfig = {
   outputFileTracingRoot: path.join(__dirname),
 };
 
-export default withSentryConfig(nextConfig, {
+const sentryOptions = {
   silent: true,
   disableLogger: true,
-});
+};
+
+export default process.env.NODE_ENV === "development"
+  ? nextConfig
+  : withSentryConfig(nextConfig, sentryOptions);
```

**File**: `web/package.json` (modified, +2/-1)
```diff
@@ -2,7 +2,8 @@
   "name": "llmwiki-web",
   "private": true,
   "scripts": {
-    "dev": "next dev --turbopack --port 3000",
+    "dev": "next dev --webpack --port 3000",
+    "dev:turbo": "next dev --turbopack --port 3000",
     "build": "next build",
     "start": "next start"
   },
```

**File**: `web/src/app/(dashboard)/wikis/[slug]/[[...path]]/loading.tsx` (added, +37/-0)
```diff
@@ -0,0 +1,37 @@
+function SkeletonLine({ className = '' }: { className?: string }) {
+  return <div className={`rounded-md bg-muted/50 animate-pulse ${className}`} />
+}
+
+export default function Loading() {
+  return (
+    <div className="flex h-full overflow-hidden bg-background">
+      <aside className="w-[272px] shrink-0 border-r border-border">
+        <div className="px-2 pt-2 pb-1">
+          <SkeletonLine className="h-9 w-full" />
+        </div>
+        <div className="px-2 pb-1 flex items-center gap-1.5">
+          <SkeletonLine className="h-8 flex-1" />
+          <SkeletonLine className="size-8 shrink-0" />
+          <SkeletonLine className="size-8 shrink-0" />
+        </div>
+        <div className="px-4 pt-3 space-y-2">
+          <SkeletonLine className="h-4 w-24" />
+          <SkeletonLine className="h-5 w-44" />
+          <SkeletonLine className="h-5 w-36" />
+          <SkeletonLine className="h-5 w-48" />
+        </div>
+      </aside>
+      <main className="min-w-0 flex-1">
+        <div className="mx-auto max-w-3xl px-8 py-10">
+          <SkeletonLine className="h-4 w-32" />
+          <SkeletonLine className="mt-4 h-8 w-2/3" />
+          <div className="mt-8 space-y-3">
+            <SkeletonLine className="h-4 w-full" />
+            <SkeletonLine className="h-4 w-11/12" />
+            <SkeletonLine className="h-4 w-10/12" />
+          </div>
+        </div>
+      </main>
+    </div>
+  )
+}
```

**File**: `web/src/app/(dashboard)/wikis/[slug]/[[...path]]/page.tsx` (modified, +2/-32)
```diff
@@ -4,35 +4,9 @@ import * as React from 'react'
 import { useParams, useSearchParams, useRouter } from 'next/navigation'
 import { useKBStore, useUserStore } from '@/stores'
 import { useKBDocuments } from '@/hooks/useKBDocuments'
-import { KBDetail } from '@/components/kb/KBDetail'
+import { WikiOnlyDetail } from '@/components/kb/WikiOnlyDetail'
 import { Loader2 } from 'lucide-react'
 
-export type ViewMode = 'wiki' | 'files' | 'graph'
-
-interface ParsedRoute {
-  view: ViewMode
-  filesPath: string
-}
-
-function parseRoute(pathSegments?: string[]): ParsedRoute {
-  if (!pathSegments || pathSegments.length === 0) {
-    return { view: 'wiki', filesPath: '/' }
-  }
-  switch (pathSegments[0]) {
-    case 'files': {
-      const rest = pathSegments.slice(1)
-      const filesPath = rest.length > 0
-        ? '/' + rest.map(decodeURIComponent).join('/') + '/'
-        : '/'
-      return { view: 'files', filesPath }
-    }
-    case 'graph':
-      return { view: 'graph', filesPath: '/' }
-    default:
-      return { view: 'wiki', filesPath: '/' }
-  }
-}
-
 export default function KBPage() {
   const router = useRouter()
   const params = useParams<{ slug: string; path?: string[] }>()
@@ -87,16 +61,12 @@ export default function KBPage() {
     )
   }
 
-  const route = parseRoute(params.path)
-
   return (
-    <KBDetail
+    <WikiOnlyDetail
       key={kb.id}
       kbId={kb.id}
       kbSlug={kb.slug}
       kbName={kb.name}
-      viewMode={route.view}
-      routeFilesPath={route.filesPath}
     />
   )
 }
```

**File**: `web/src/app/(dashboard)/wikis/[slug]/files/[[...path]]/page.tsx` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+'use client'
+
+import { useParams } from 'next/navigation'
+import { KBDetailRoutePage } from '@/components/kb/KBDetailRoutePage'
+
+function parseFilesPath(pathSegments?: string[]): string {
+  if (!pathSegments || pathSegments.length === 0) return '/'
+  return '/' + pathSegments.map(decodeURIComponent).join('/') + '/'
+}
+
+export default function FilesPage() {
+  const params = useParams<{ path?: string[] }>()
+  return (
+    <KBDetailRoutePage
+      viewMode="files"
+      routeFilesPath={parseFilesPath(params.path)}
+    />
+  )
+}
```

**File**: `web/src/app/(dashboard)/wikis/[slug]/graph/page.tsx` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+'use client'
+
+import { KBDetailRoutePage } from '@/components/kb/KBDetailRoutePage'
+
+export default function GraphPage() {
+  return <KBDetailRoutePage viewMode="graph" />
+}
```

---

### Incident Patch 13: `a66fef5e` (2026-06-27)
**Commit Message**: UI changes; added create kb tool; specced out stylistic overhaul + support for kb courses

**File**: `README.md` (modified, +2/-1)
```diff
@@ -125,6 +125,7 @@ Once connected over MCP, Claude works the wiki through a small, deliberate set o
 | Tool | What it does |
 |------|--------------|
 | `guide` | Orients Claude — how the vault works and which knowledge bases exist. It calls this first. |
+| `create_knowledge_base` | Creates a knowledge base and starter wiki pages (`overview.md`, `log.md`); local mode returns the existing singleton workspace. |
 | `list_knowledge_bases` | Lists your knowledge bases and their slugs (every other tool takes one). |
 | `search` | Browse files, full-text search across content, or query the citation graph — what cites what, plus stale or uncited pages. |
 | `read` | Read documents — a single file or a glob batch, PDF/office page ranges, optionally with embedded images. |
@@ -164,4 +165,4 @@ The throughline: capture should meet you wherever you already read and think, an
 
 # License
 
-Apache 2.0 — see [LICENSE](LICENSE).
\ No newline at end of file
+Apache 2.0 — see [LICENSE](LICENSE).
```

**File**: `api/services/hosted.py` (modified, +15/-3)
```diff
@@ -75,6 +75,13 @@ async def get_usage(self) -> dict:
 )
 
 _OVERVIEW_TEMPLATE = """\
+---
+title: Overview
+description: Research hub for {name}.
+date: {date}
+tags: [overview, wiki]
+---
+
 This wiki tracks research on {name}. No sources have been ingested yet.
 
 ## Key Findings
@@ -177,9 +184,14 @@ async def _scaffold_wiki(self, kb_id, name: str) -> None:
         today = datetime.now().strftime("%Y-%m-%d")
         await self.pool.execute(
             "INSERT INTO documents (knowledge_base_id, user_id, filename, title, path, "
-            "file_type, status, content, tags, version, sort_order) "
-            "VALUES ($1, $2, 'overview.md', 'Overview', '/wiki/', 'md', 'ready', $3, $4, 0, -100)",
-            kb_id, self.user_id, _OVERVIEW_TEMPLATE.format(name=name), ["overview"],
+            "file_type, status, content, tags, date, metadata, version, sort_order) "
+            "VALUES ($1, $2, 'overview.md', 'Overview', '/wiki/', 'md', 'ready', $3, $4, $5, $6::jsonb, 0, -100)",
+            kb_id,
+            self.user_id,
+            _OVERVIEW_TEMPLATE.format(name=name, date=today),
+            ["overview", "wiki"],
+            today,
+            json.dumps({"description": f"Research hub for {name}."}),
         )
         await self.pool.execute(
             "INSERT INTO documents (knowledge_base_id, user_id, filename, title, path, "
```

**File**: `mcp/local_server.py` (modified, +23/-12)
```diff
@@ -13,6 +13,7 @@
 import os
 import sys
 import uuid
+from datetime import date
 from pathlib import Path
 
 logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
@@ -45,31 +46,41 @@ async def _init_workspace(workspace_path: str) -> None:
     if not existing:
         ws_name = ws.name
         ws_id = await fs.ensure_workspace(ws_name)
+        today = date.today().isoformat()
+        overview_content = (
+            "---\n"
+            "title: Overview\n"
+            f"description: Research hub for {ws_name}.\n"
+            f"date: {today}\n"
+            "tags: [overview, wiki]\n"
+            "---\n\n"
+            f"This wiki tracks research on {ws_name}.\n\n"
+            "## Key Findings\n\n"
+            "No sources ingested yet.\n\n"
+            "## Recent Updates\n\n"
+            "No activity yet."
+        )
+        log_content = "Chronological record of ingests, queries, and maintenance passes."
 
         await fs.create_document(
             ws_id, "overview.md", "Overview", "/wiki/", "md",
-            f"This wiki tracks research on {ws_name}.\n\n## Key Findings\n\nNo sources ingested yet.\n\n## Recent Updates\n\nNo activity yet.",
-            ["overview"],
+            overview_content,
+            ["overview", "wiki"],
+            date=today,
+            metadata={"description": f"Research hub for {ws_name}."},
         )
         await fs.create_document(
             ws_id, "log.md", "Log", "/wiki/", "md",
-            "Chronological record of ingests, queries, and maintenance passes.",
+            log_content,
             ["log"],
         )
 
         overview_path = ws / "wiki" / "overview.md"
         if not overview_path.exists():
-            overview_path.write_text(
-                f"This wiki tracks research on {ws_name}.\n\n## Key Findings\n\n"
-                "No sources ingested yet.\n\n## Recent Updates\n\nNo activity yet.\n",
-                encoding="utf-8",
-            )
+            overview_path.write_text(overview_content + "\n", encoding="utf-8")
         log_path = ws / "wiki" / "log.md"
         if not log_path.exists():
-            log_path.write_text(
-                "Chronological record of ingests, queries, and maintenance passes.\n",
-                encoding="utf-8",
-            )
+            log_path.write_text(log_content + "\n", encoding="utf-8")
 
         logger.info("Initialized workspace: %s", ws)
     else:
```

**File**: `mcp/tools/guide.py` (modified, +2/-2)
```diff
@@ -10,7 +10,7 @@
 
 1. **Raw Sources** (path: `/`) — uploaded documents (PDFs, notes, images, spreadsheets). Source of truth. Read-only.
 2. **Compiled Wiki** (path: `/wiki/`) — markdown pages YOU create and maintain. You own this layer.
-3. **Tools** — `search`, `read`, `create`, `edit`, `append`, `delete` — your interface to both layers.
+3. **Tools** — `create_knowledge_base`, `list_knowledge_bases`, `search`, `read`, `create`, `edit`, `append`, `delete` — your interface to both layers.
 
 ## Reading Images
 
@@ -225,7 +225,7 @@ async def guide(ctx: Context) -> str:
         fs = fs_factory(user_id)
         kbs = await fs.list_knowledge_bases()
         if not kbs:
-            return GUIDE_TEXT + "No knowledge bases yet. Create one at " + settings.APP_URL + "/wikis"
+            return GUIDE_TEXT + "No knowledge bases yet. Use `create_knowledge_base`, or create one at " + settings.APP_URL + "/wikis"
 
         lines = []
         for kb in kbs:
```

**File**: `mcp/tools/list.py` (modified, +45/-2)
```diff
@@ -1,4 +1,4 @@
-"""List tool — enumerate the user's knowledge bases."""
+"""Knowledge base tools — create and enumerate knowledge bases."""
 
 from mcp.server.fastmcp import FastMCP, Context
 
@@ -7,6 +7,46 @@
 
 def register(mcp: FastMCP, get_user_id, fs_factory) -> None:
 
+    @mcp.tool(
+        name="create_knowledge_base",
+        description=(
+            "Create a new knowledge base/wiki and scaffold starter overview/log pages.\n\n"
+            "In hosted mode this creates a separate knowledge base with a unique slug. "
+            "In local MCP mode there is one workspace per server, so this returns the "
+            "existing workspace if it has already been initialized."
+        ),
+    )
+    async def create_knowledge_base(
+        ctx: Context,
+        name: str,
+        description: str = "",
+    ) -> str:
+        name = name.strip()
+        description = description.strip()
+        if not name:
+            return "Error: name is required when creating a knowledge base."
+        if len(name) > 120:
+            return "Error: knowledge base name must be 120 characters or fewer."
+
+        user_id = get_user_id(ctx)
+        fs = fs_factory(user_id)
+        kb = await fs.create_knowledge_base(name, description or None)
+
+        if kb.get("already_exists"):
+            if kb.get("local_singleton"):
+                return (
+                    "Local MCP mode uses one workspace per server. "
+                    f"Existing knowledge base: **{kb['name']}** (`{kb['slug']}`). "
+                    "Use that slug with the other tools."
+                )
+            return f"Knowledge base already exists: **{kb['name']}** (`{kb['slug']}`)."
+
+        return (
+            f"Created knowledge base **{kb['name']}** (`{kb['slug']}`). "
+            "Starter pages were added at `/wiki/overview.md` and `/wiki/log.md`. "
+            f"Use `knowledge_base=\"{kb['slug']}\"` with the other tools."
+        )
+
     @mcp.tool(
         name="list_knowledge_bases",
         description=(
@@ -21,7 +61,10 @@ async def list_knowledge_bases(ctx: Context) -> str:
         fs = fs_factory(user_id)
         kbs = await fs.list_knowledge_bases()
         if not kbs:
-            return f"No knowledge bases yet. Create one at {settings.APP_URL}/wikis"
+            return (
+                "No knowledge bases yet. Use `create_knowledge_base`, "
+                f"or create one at {settings.APP_URL}/wikis."
+            )
 
         lines = [f"- **{kb['name']}** (`{kb['slug']}`)" for kb in kbs]
         return "\n".join(lines)
```

**File**: `mcp/tools/write.py` (modified, +51/-5)
```diff
@@ -74,6 +74,50 @@ def _effective_date(content: str, provided: str | None = None) -> str | None:
     return fm_date or provided or None
 
 
+def _ensure_wiki_frontmatter(
+    content: str,
+    title: str,
+    tags: list[str],
+    date_str: str,
+    dir_path: str,
+    filename: str,
+    file_type: str,
+) -> str:
+    """Add required wiki frontmatter when the caller supplied metadata as args."""
+    if file_type != "md" or not dir_path.startswith("/wiki/"):
+        return content
+    if dir_path == "/wiki/" and filename == "log.md":
+        return content
+    if _FRONTMATTER_RE.match(content):
+        return content
+
+    metadata = {
+        "title": title,
+        "description": _default_description(content, title),
+        "date": date_str.strip() or date.today().isoformat(),
+        "tags": [str(tag).strip() for tag in tags if str(tag).strip()],
+    }
+    frontmatter = yaml.safe_dump(
+        metadata,
+        sort_keys=False,
+        allow_unicode=False,
+        default_flow_style=False,
+    ).strip()
+    body = content.lstrip("\n")
+    return f"---\n{frontmatter}\n---\n\n{body}"
+
+
+def _default_description(content: str, title: str) -> str:
+    for raw_line in content.splitlines():
+        line = raw_line.strip()
+        if not line or line.startswith("[^"):
+            continue
+        line = re.sub(r"^#+\s*", "", line).strip()
+        if line:
+            return line[:180]
+    return f"Notes about {title}."
+
+
 def _is_footnote_suffix_line(line: str) -> bool:
     return line.strip() == "" or line.startswith((" ", "\t")) or bool(_FOOTNOTE_DEF_RE.match(line))
 
@@ -156,13 +200,14 @@ async def create(self, path: str, title: str, content: str, tags: list[str], dat
         if not title:
             return "Error: title is required when creating a note."
 
-        effective_tags = _effective_tags(content, tags) or []
-        if not effective_tags:
-            return "Error: at least one tag is required when creating a note."
-
         dir_path = self._to_dir_path(path)
         filename, file_type = self._title_to_filename(title)
         title = self._humanize_title(title)
+        content = _ensure_wiki_frontmatter(content, title, tags, date_str, dir_path, filename, file_type)
+
+        effective_tags = _effective_tags(content, tags) or []
+        if not effective_tags:
+            return "Error: at least one tag is required when creating a note."
 
         existing = await self.fs.get_document(self.kb_id, filename, dir_path)
 
@@ -413,7 +458,8 @@ async def _resolve(ctx: Context, knowledge_base: str):
         description=(
             "Create a new wiki page, note, or asset in the knowledge vault.\n\n"
             "Wiki pages should be created under `/wiki/` and should cite their sources using "
-            "markdown footnotes (e.g. `[^1]: paper.pdf, p.3`).\n\n"
+            "markdown footnotes (e.g. `[^1]: paper.pdf, p.3`). If markdown wiki content "
+            "does not include YAML frontmatter, this tool adds it from `title`, `tags`, and `date_str`.\n\n"
             "You can also create SVG diagrams and CSV data files as wiki assets:\n"
             "- `create(path=\"/wiki/\", title=\"architecture-diagram.svg\", content=\"<svg>...</svg>\", tags=[\"diagram\"])`\n"
             "- `create(path=\"/wiki/\", title=\"data-table.csv\", content=\"col1,col2\\nval1,val2\", tags=[\"data\"])`\n"
```

**File**: `mcp/vaultfs/base.py` (modified, +3/-0)
```diff
@@ -21,6 +21,9 @@ async def resolve_kb(self, slug: str) -> dict | None: ...
     @abstractmethod
     async def list_knowledge_bases(self) -> list[dict]: ...
 
+    @abstractmethod
+    async def create_knowledge_base(self, name: str, description: str | None = None) -> dict: ...
+
     @abstractmethod
     async def get_document(self, kb_id: str, filename: str, dir_path: str) -> dict | None: ...
 
```

**File**: `mcp/vaultfs/postgres.py` (modified, +99/-0)
```diff
@@ -1,6 +1,8 @@
 """Postgres + S3 implementation of VaultFS."""
 
 import logging
+import re
+from datetime import date
 
 import aioboto3
 import asyncpg
@@ -14,6 +16,32 @@
 
 _s3_session = None
 
+_OVERVIEW_TEMPLATE = """\
+---
+title: Overview
+description: Research hub for {name}.
+date: {date}
+tags: [overview, wiki]
+---
+
+This wiki tracks research on {name}. No sources have been ingested yet.
+
+## Key Findings
+
+No sources ingested yet - add your first source to get started.
+
+## Recent Updates
+
+No activity yet.\
+"""
+
+_LOG_TEMPLATE = """\
+Chronological record of ingests, queries, and maintenance passes.
+
+## [{date}] created | Wiki Created
+- Initialized wiki: {name}\
+"""
+
 
 def _get_s3_session():
     global _s3_session
@@ -26,6 +54,13 @@ def _get_s3_session():
     return _s3_session
 
 
+def _slugify(name: str) -> str:
+    slug = name.lower().strip()
+    slug = re.sub(r"[^a-z0-9\s-]", "", slug)
+    slug = re.sub(r"[\s-]+", "-", slug).strip("-")
+    return slug or "kb"
+
+
 class PostgresVaultFS(VaultFS):
     """Postgres + S3 vault."""
 
@@ -47,6 +82,11 @@ async def list_knowledge_bases(self) -> list[dict]:
             self.user_id,
         )
 
+    async def create_knowledge_base(self, name: str, description: str | None = None) -> dict:
+        row = await self._insert_knowledge_base(name, description)
+        await self._scaffold_wiki(str(row["id"]), row["name"])
+        return row
+
 
     async def get_document(self, kb_id: str, filename: str, dir_path: str) -> dict | None:
         return await scoped_queryrow(
@@ -352,3 +392,62 @@ async def find_stale_pages(self, kb_id: str) -> list[dict]:
             "ORDER BY d.stale_since DESC",
             kb_id, self.user_id,
         )
+
+    async def _insert_knowledge_base(self, name: str, description: str | None) -> dict:
+        pool = await get_pool()
+        async with pool.acquire() as conn:
+            current_name = name
+            for attempt in range(10):
+                slug = await self._unique_slug(current_name, conn)
+                try:
+                    row = await conn.fetchrow(
+                        "INSERT INTO knowledge_bases (user_id, name, slug, description) "
+                        "VALUES ($1, $2, $3, $4) "
+                        "RETURNING id, user_id, name, slug, description, created_at, updated_at",
+                        self.user_id, current_name, slug, description,
+                    )
+                    return dict(row)
+                except asyncpg.UniqueViolationError:
+                    current_name = f"{name} ({attempt + 2})"
+        raise RuntimeError("Could not create knowledge base after too many duplicate names")
+
+    async def _unique_slug(self, name: str, conn=None) -> str:
+        base = _slugify(name)
+        slug = base
+        counter = 2
+
+        if conn is not None:
+            while await conn.fetchval(
+                "SELECT 1 FROM knowledge_bases WHERE slug = $1 AND user_id = $2",
+                slug, self.user_id,
+            ):
+                slug = f"{base}-{counter}"
+                counter += 1
+            return slug
+
+        pool = await get_pool()
+        async with pool.acquire() as acquired:
+            return await self._unique_slug(name, acquired)
+
+    async def _scaffold_wiki(self, kb_id: str, name: str) -> None:
+        today = date.today().isoformat()
+        await self.create_document(
+            kb_id,
+            "overview.md",
+            "Overview",
+            "/wiki/",
+            "md",
+            _OVERVIEW_TEMPLATE.format(name=name, date=today),
+            ["overview", "wiki"],
+            date=today,
+            metadata={"description": f"Research hub for {name}."},
+        )
+        await self.create_document(
+            kb_id,
+            "log.md",
+            "Log",
+            "/wiki/",
+            "md",
+            _LOG_TEMPLATE.format(name=name, date=today),
+            ["log"],
+        )
```

---

### Incident Patch 14: `669ddd6f` (2026-06-26)
**Commit Message**: Minor bug fixes

**File**: `web/package.json` (modified, +3/-1)
```diff
@@ -60,7 +60,9 @@
     "ws": "8.21.0",
     "dompurify": "3.4.9",
     "markdown-it": "14.2.0",
-    "@babel/core": "7.29.7"
+    "@babel/core": "7.29.7",
+    "@tiptap/core": "3.22.2",
+    "@tiptap/pm": "3.22.2"
   },
   "optionalDependencies": {
     "lightningcss-linux-x64-gnu": "1.32.0",
```

**File**: `web/pnpm-workspace.yaml` (modified, +7/-0)
```diff
@@ -1,3 +1,10 @@
+onlyBuiltDependencies:
+  - '@sentry/cli'
+  - sharp
+verifyDepsBeforeRun: false
+overrides:
+  '@tiptap/core': 3.22.2
+  '@tiptap/pm': 3.22.2
 allowBuilds:
   '@sentry/cli': set this to true or false
   sharp: set this to true or false
```

**File**: `web/src/components/kb/KBSidenav.tsx` (modified, +5/-1)
```diff
@@ -339,6 +339,10 @@ function WikiTreeNode({
   const hasActiveChild = hasChildren && node.children!.some((c) => c.path === activePath)
   const [expanded, setExpanded] = React.useState(true)
 
+  React.useEffect(() => {
+    if (hasActiveChild) setExpanded(true)
+  }, [hasActiveChild])
+
   return (
     <div>
       <div
@@ -377,7 +381,7 @@ function WikiTreeNode({
         <span className="truncate flex-1 min-w-0">{node.title}</span>
       </div>
       <AnimatePresence initial={false}>
-        {hasChildren && (expanded || hasActiveChild) && (
+        {hasChildren && expanded && (
           <motion.div
             initial={{ height: 0, opacity: 0 }}
             animate={{ height: 'auto', opacity: 1 }}
```

---

### Incident Patch 15: `caa0c54a` (2026-06-15)
**Commit Message**: Bug fixes & rewrote the ReadMe

**File**: `README.md` (modified, +97/-182)
```diff
@@ -1,252 +1,167 @@
 # LLM Wiki
 
+**An autonomous, self-maintaining personal Wikipedia built and maintained by AI.**
+
 [![License](https://img.shields.io/badge/license-Apache%202.0-green)](https://opensource.org/licenses/Apache-2.0)
 
-Open-source implementation of [Karpathy's LLM Wiki](https://x.com/karpathy/status/2039805659525644595) ([spec](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)).
+</div>
+
+LLM Wiki transforms your scattered reading and research into a persistent, AI-maintained second brain. Capture documents, notes, and web clippings as you work, and deploy a nightly Claude Routine to autonomously synthesize those sources into a permanent knowledge base. Because the clipper captures your highlights and margin notes alongside the source, the wiki becomes a record of not just what you read but what you *thought* about it — one that compounds over months and years, long after the original context would have faded. This architecture is heavily inspired by [Andrej Karpathy's LLM Wiki concept](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f), with an increased emphasis on autonomous maintenance.
+
+<p align="center">
+  <img src="wiki-page.png" alt="LLM Wiki — a compiled wiki page with citations and table of contents" width="820" />
+</p>
+
+
+LLM Wiki is designed to work at three distinct scales:
+
+- **For you** — a personal Wikipedia of what you've read that you don't have to remember to update.
+- **For your AI** — a context layer for LLMs to apply your own mental models when working with you.
+- **For your organization** — most organizations have poor institutional memory, because know-how generally lives in people's heads. We hope companies will consider adopting this model to build a self-maintaining institutional knowledge layer.
 
-I built this because research folders accumulate useful material faster than I can keep summaries, links, and citations current by hand. LLM Wiki offloads that editing work to Claude so I can focus on source selection and analysis instead.
+# Features
 
-Point it at a folder, start the local app, and connect Claude over MCP. From there, Claude reads your sources, writes wiki pages, and keeps links and citations in sync.
+- **Connect via MCP** Connect Claude.ai, Claude Cowork, Claude Code, or Codex (or any other MCP-compatible app)
+- **A Chrome extension** Clip webpages and PDFs as you read, highlight key sections, and leave comments that Claude can see over MCP.
+- **Uploads** Markdown, PowerPoint, PDFs, Word documents, and more.
+- **A clean Next.js web app** to navigate your own wikipedia — and view the underlying sources.
+- **Native cross-linking** between wiki pages, and back to the sources they came from.
+- **A graph viewer** to see how your concepts and entities relate.
+- **Visualizations** — Charts and other visualizations, including SVGs and Mermaid diagrams.
 
-![LLM Wiki — a compiled wiki page with citations and table of contents](wiki-page.png)
+# Getting started
 
-## What actually happens
+LLM Wiki supports two modes: remote & local. You can self-host the remote app, or try it out for free at llmwiki.app. Or you can git clone the repository, and use the CLI to get started.
 
-1. **You have a folder** — PDFs, notes, articles, spreadsheets. Your existing research.
-2. **LLM Wiki indexes it** — extracts text, chunks for search, builds a local SQLite index. Source files stay where they are.
-3. **Claude connects via MCP** — reads sources, writes wiki pages under `wiki/`, maintains cross-references and footnote citations.
-4. **The wiki improves** as Claude reads more of the workspace and writes more pages. Summaries, entity pages, and cross-references accumulate instead of being re-derived from scratch each conversation.
+Here's how to get started locally.
 
-## Quick Start
+**Requirements:** Python 3.11+, Node.js 20+. Optional: [LibreOffice](https://www.libreoffice.org/) to extract Word/PowerPoint files, and a `MISTRAL_API_KEY` for higher-quality PDF OCR.
 
-**Requirements:** Python 3.11+, Node.js 20+
+**1. Install.** Clone the repo and install the Python and web dependencies.
 
 ```bash
 git clone https://github.com/lucasastorian/llmwiki.git
 cd llmwiki
-
-# Install Python deps
-cd api && python -m venv .venv && source .venv/bin/activate
-pip install -r requirements.txt
-cd ..
-
-# Install web deps
+python -m venv .venv && source .venv/bin/activate
+pip install -r api/requirements.txt -r mcp/requirements.txt
 cd web && npm install && cd ..
+```
 
-# Initialize a workspace (point at any folder with your files)
-./llmwiki init ~/research
+**2. Point it at a folder of your files** — PDFs, Word documents, PowerPoints, Markdown, notes. LLM Wiki indexes them into a local search index so they show up in the app and Claude can read them. Your files stay where they are; nothing is moved or uploaded.
 
-# Start API + web UI
-./llmwiki serve ~/research
+```bash
+./llmwiki open ~/research
 ```
 
-Open [localhost:3000](ht
```

**File**: `api/domain/file_types.py` (added, +17/-0)
```diff
@@ -0,0 +1,17 @@
+"""Shared file-type classification for local mode (watcher, processor, upload)."""
+
+PDF_TYPES = frozenset({"pdf"})
+OFFICE_TYPES = frozenset({"pptx", "ppt", "docx", "doc"})
+SPREADSHEET_TYPES = frozenset({"xlsx", "xls"})
+IMAGE_TYPES = frozenset({"png", "jpg", "jpeg", "webp", "gif"})
+HTML_TYPES = frozenset({"html", "htm"})
+
+# Read inline and chunked as plain text — no extraction backend needed.
+SIMPLE_TEXT_TYPES = frozenset({
+    "md", "txt", "csv", "svg", "json", "xml",
+    "yaml", "yml", "toml", "ini", "cfg", "rst", "tex", "latex",
+})
+
+# Need an extraction/processing backend before they're searchable. HTML is here
+# (not in SIMPLE_TEXT_TYPES) because it goes through the webmd parser.
+EXTRACTION_TYPES = PDF_TYPES | OFFICE_TYPES | SPREADSHEET_TYPES | HTML_TYPES
```

**File**: `api/domain/local_processor.py` (modified, +113/-19)
```diff
@@ -16,24 +16,35 @@
 import aiosqlite
 
 from config import settings
+from domain.file_types import (
+    EXTRACTION_TYPES, HTML_TYPES, IMAGE_TYPES, OFFICE_TYPES,
+    PDF_TYPES, SIMPLE_TEXT_TYPES, SPREADSHEET_TYPES,
+)
 from domain.watcher import mark_written
-from infra.db.sqlite import SQLiteDocumentRepository
+from infra.db.sqlite import SQLiteDocumentRepository, create_pool
 from services.extracted_assets import build_pdf_image_assets
 
 logger = logging.getLogger(__name__)
 
-PDF_TYPES = frozenset({"pdf"})
-SPREADSHEET_TYPES = frozenset({"xlsx", "xls"})
-IMAGE_TYPES = frozenset({"png", "jpg", "jpeg", "webp", "gif"})
-OFFICE_TYPES = frozenset({"pptx", "ppt", "docx", "doc"})
-
-from services.pdf_extract import extract_pdf
+# Cap concurrent fire-and-forget extractions so a burst of dropped files can't
+# spawn one LibreOffice/OCR job (and connection) per file at once.
+PROCESS_CONCURRENCY = 4
+_process_semaphore = asyncio.Semaphore(PROCESS_CONCURRENCY)
 
 
 async def process_document(db: aiosqlite.Connection, doc_id: str, workspace: Path) -> None:
-    """Process a pending document: extract text, chunk, update index."""
+    """Atomically claim a pending document, then extract text, chunk, update index."""
+    claim = await db.execute(
+        "UPDATE documents SET status = 'processing', error_message = NULL, "
+        "updated_at = datetime('now') WHERE id = ? AND status = 'pending'",
+        (doc_id,),
+    )
+    await db.commit()
+    if claim.rowcount == 0:
+        return
+
     cursor = await db.execute(
-        "SELECT id, filename, file_type, relative_path, status FROM documents WHERE id = ?",
+        "SELECT filename, file_type, relative_path FROM documents WHERE id = ?",
         (doc_id,),
     )
     row = await cursor.fetchone()
@@ -44,9 +55,6 @@ async def process_document(db: aiosqlite.Connection, doc_id: str, workspace: Pat
     cols = [d[0] for d in cursor.description]
     doc = dict(zip(cols, row))
 
-    if doc["status"] not in ("pending", "processing"):
-        return
-
     file_type = doc["file_type"] or ""
     file_path = workspace / doc["relative_path"]
 
@@ -59,12 +67,6 @@ async def process_document(db: aiosqlite.Connection, doc_id: str, workspace: Pat
         await db.commit()
         return
 
-    await db.execute(
-        "UPDATE documents SET status = 'processing', updated_at = datetime('now') WHERE id = ?",
-        (doc_id,),
-    )
-    await db.commit()
-
     try:
         if file_type in PDF_TYPES:
             await _process_pdf(db, doc_id, file_path, workspace)
@@ -74,7 +76,7 @@ async def process_document(db: aiosqlite.Connection, doc_id: str, workspace: Pat
             await _process_spreadsheet(db, doc_id, file_path)
         elif file_type in IMAGE_TYPES:
             await _process_image(db, doc_id)
-        elif file_type in ("html", "htm"):
+        elif file_type in HTML_TYPES:
             await _process_html(db, doc_id, file_path)
         else:
             await db.execute(
@@ -96,6 +98,64 @@ async def process_document(db: aiosqlite.Connection, doc_id: str, workspace: Pat
         logger.error("Failed to process %s: %s", doc["filename"], e)
 
 
+async def process_document_isolated(workspace: Path, doc_id: str) -> None:
+    """Process a document on its own connection so fire-and-forget tasks can't
+    flush another writer's open transaction on a shared connection."""
+    async with _process_semaphore:
+        db = await create_pool(str(workspace / ".llmwiki" / "index.db"), init_schema=False)
+        try:
+            await process_document(db, doc_id, workspace)
+        finally:
+            await db.close()
+
+
+async def chunk_text_document(db: aiosqlite.Connection, doc_id: str, content: str | None) -> None:
+    """Chunk an already-extracted text document so it becomes full-text searchable."""
+    from services.chunker import chunk_text
+
+    await _store_chunks(db, doc_id, chunk_text(content or ""))
+    # `parser` doubles as the chunked-marker so reconcile skips docs that
+    # legitimately produce zero chunks (empty/short) instead of retrying them.
+    await db.execute(
+        "UPDATE documents SET parser = 'text', updated_at = datetime('now') WHERE id = ?",
+        (doc_id,),
+    )
+    await db.commit()
+
+
+async def reconcile_workspace(db: aiosqlite.Connection, workspace: Path) -> None:
+    """Process documents that were indexed but never extracted or chunked.
+
+    `llmwiki init` lists existing files into the index without extracting PDFs
+    or building search chunks; this backfills both so a folder pointed at on
+    first run is actually readable and searchable.
+    """
+    extract_ids = await _unchunked_extractable_ids(db)
+    for doc_id in extract_ids:
+        try:
+            await db.execute(
+                "UPDATE documents SET status = 'pending', updated_at = datetime('now') WHERE id = ?",
+                (doc_id,),
+            )
+            await db.commit()
+            await process_document(db,
```

**File**: `api/domain/watcher.py` (modified, +21/-15)
```diff
@@ -20,18 +20,15 @@
 
 import aiosqlite
 
+from domain.file_types import SIMPLE_TEXT_TYPES
+
 logger = logging.getLogger(__name__)
 
 IGNORE_DIRS = frozenset({
     ".llmwiki", ".git", "node_modules", "__pycache__", ".venv", "venv",
     ".idea", ".vscode", ".DS_Store",
 })
 
-TEXT_EXTENSIONS = frozenset({
-    "md", "txt", "csv", "html", "svg", "json", "xml", "yaml", "yml",
-    "toml", "ini", "cfg", "rst", "tex", "latex",
-})
-
 COOLDOWN_SECONDS = 2.0
 
 _ignore_patterns: list[str] | None = None
@@ -139,7 +136,7 @@ async def _index_file(db: aiosqlite.Connection, workspace: Path, file_path: Path
 
     # Read content for text files
     content = None
-    if ext in TEXT_EXTENSIONS:
+    if ext in SIMPLE_TEXT_TYPES:
         try:
             content = file_path.read_text(encoding="utf-8", errors="replace")
         except Exception:
@@ -173,11 +170,18 @@ async def _index_file(db: aiosqlite.Connection, workspace: Path, file_path: Path
         )
         await db.commit()
         logger.info("Re-indexed (modified): %s", relative)
-        # Re-process non-text files
-        if ext not in TEXT_EXTENSIONS and ext:
-            from domain.local_processor import process_document as _process
-            import asyncio
-            asyncio.create_task(_process(db, doc_id, workspace))
+        if ext not in SIMPLE_TEXT_TYPES and ext:
+            await db.execute(
+                "UPDATE documents SET status = 'pending', parser = NULL, error_message = NULL, "
+                "updated_at = datetime('now') WHERE id = ?",
+                (doc_id,),
+            )
+            await db.commit()
+            from domain.local_processor import process_document_isolated
+            asyncio.create_task(process_document_isolated(workspace, doc_id))
+        elif content is not None:
+            from domain.local_processor import chunk_text_document
+            await chunk_text_document(db, doc_id, content)
         return
     else:
         # Create new
@@ -200,14 +204,16 @@ async def _index_file(db: aiosqlite.Connection, workspace: Path, file_path: Path
              int(stat.st_mtime_ns), doc_number),
         )
         logger.info("Indexed (new): %s", relative)
-        # Process non-text files (PDFs, spreadsheets, images, HTML)
         if status == "pending":
-            from domain.local_processor import process_document as _process
-            import asyncio
-            asyncio.create_task(_process(db, doc_id, workspace))
+            from domain.local_processor import process_document_isolated
+            asyncio.create_task(process_document_isolated(workspace, doc_id))
 
     await db.commit()
 
+    if status == "ready" and content is not None:
+        from domain.local_processor import chunk_text_document
+        await chunk_text_document(db, doc_id, content)
+
 
 async def _remove_file(db: aiosqlite.Connection, workspace: Path, file_path: Path) -> None:
     """Remove a file from the index."""
```

**File**: `api/infra/db/sqlite.py` (modified, +64/-4)
```diff
@@ -4,9 +4,12 @@
 All queries use native SQLite syntax — no translation layer.
 """
 
+import asyncio
+import functools
 import json
 import logging
 import uuid
+from contextlib import asynccontextmanager
 from pathlib import Path
 
 import aiosqlite
@@ -45,14 +48,54 @@ def _row_to_dict(cursor: aiosqlite.Cursor, row: tuple) -> dict:
     return d
 
 
-async def create_pool(db_path: str) -> aiosqlite.Connection:
+def rows_to_dicts(cursor: aiosqlite.Cursor, rows: list[tuple]) -> list[dict]:
+    """Map a fetched result set to dicts, decoding JSON columns like _row_to_dict."""
+    return [_row_to_dict(cursor, r) for r in rows]
+
+
+# Local-mode requests share one aiosqlite connection, so a committing write
+# in one request could otherwise flush another's open transaction. This lock
+# serializes write spans; reads don't take it.
+_write_lock = asyncio.Lock()
+
+
+def _serialized(method):
+    """Hold the write lock for the full span of a committing repo method.
+
+    Rolls back on failure so a crashed write never leaves an open transaction
+    for the next writer to commit.
+    """
+    @functools.wraps(method)
+    async def wrapper(self, *args, **kwargs):
+        async with _write_lock:
+            try:
+                return await method(self, *args, **kwargs)
+            except Exception:
+                try:
+                    await self._db.rollback()
+                except Exception:
+                    pass
+                raise
+    return wrapper
+
+
+@asynccontextmanager
+async def serialized_write():
+    """Hold the local write lock around a multi-statement write outside the repos."""
+    async with _write_lock:
+        yield
+
+
+async def create_pool(db_path: str, init_schema: bool = True) -> aiosqlite.Connection:
     db = await aiosqlite.connect(db_path)
     db.row_factory = None
     await db.execute("PRAGMA journal_mode=WAL")
     await db.execute("PRAGMA foreign_keys=ON")
-    schema = _SCHEMA_PATH.read_text(encoding='utf-8')
-    await db.executescript(schema)
-    await db.commit()
+    await db.execute("PRAGMA busy_timeout=5000")
+    if init_schema:
+        schema = _SCHEMA_PATH.read_text(encoding='utf-8')
+        await db.executescript(schema)
+        await db.commit()
     return db
 
 
@@ -109,6 +152,7 @@ async def find_by_path(
         row = await cursor.fetchone()
         return _row_to_dict(cursor, row) if row else None
 
+    @_serialized
     async def create_note(
         self, kb_id: str, user_id: str, filename: str, path: str,
         title: str, content: str, tags: list[str],
@@ -133,6 +177,7 @@ async def create_note(
         await self._db.commit()
         return await self.get(doc_id)
 
+    @_serialized
     async def update_content(self, doc_id: str, user_id: str, content: str) -> dict | None:
         cursor = await self._db.execute(
             "UPDATE documents SET content = ?, version = version + 1, "
@@ -144,6 +189,7 @@ async def update_content(self, doc_id: str, user_id: str, content: str) -> dict
         await self._db.commit()
         return _row_to_dict(cursor, row) if row else None
 
+    @_serialized
     async def update_metadata(self, doc_id: str, user_id: str, **fields) -> dict | None:
         updates = []
         params = []
@@ -169,6 +215,7 @@ async def update_metadata(self, doc_id: str, user_id: str, **fields) -> dict | N
         await self._db.commit()
         return await self.get(doc_id)
 
+    @_serialized
     async def archive(self, doc_id: str, user_id: str) -> bool:
         await self._db.execute("DELETE FROM document_pages WHERE document_id = ?", (doc_id,))
         await self._db.execute("DELETE FROM document_chunks WHERE document_id = ?", (doc_id,))
@@ -178,6 +225,7 @@ async def archive(self, doc_id: str, user_id: str) -> bool:
         await self._db.commit()
         return cursor.rowcount > 0
 
+    @_serialized
     async def bulk_archive(self, doc_ids: list[str], user_id: str) -> None:
         if not doc_ids:
             return
@@ -223,6 +271,7 @@ async def get_highlights(self, doc_id: str) -> dict | None:
         result["highlights"] = self._parse_highlights(result.get("highlights"))
         return result
 
+    @_serialized
     async def replace_highlights(
         self, doc_id: str, user_id: str, highlights: list[dict],
         expected_version: int | None = None,
@@ -269,6 +318,7 @@ async def replace_highlights(
                 pass
             raise
 
+    @_serialized
     async def upsert_highlight(
         self, doc_id: str, user_id: str, highlight: dict,
         expected_version: int | None = None,
@@ -332,6 +382,7 @@ async def upsert_highlight(
                 pass
             raise
 
+    @_serialized
     async def delete_highlight(
         self, doc_id: str, user_id: str, highlight_id: str,
         expected_version: int | None = None,
@@ -431,6 +482,7 @@ async def _recompute_chunks_for_doc(
                 (anno_text, 1 if has_hl else 0, new_content, chunk.id),
             
```

**File**: `api/main.py` (modified, +20/-6)
```diff
@@ -154,27 +154,43 @@ async def _local_lifespan_inner(app: FastAPI):
 @asynccontextmanager
 async def _local_lifespan(app: FastAPI):
     db = await _local_lifespan_inner(app)
+    from pathlib import Path
+    from infra.db.sqlite import create_pool as create_sqlite_pool
+    workspace = Path(app.state.workspace_path)
+    db_path = str(workspace / ".llmwiki" / "index.db")
+
+    # Each background writer gets its own connection so a commit can't flush
+    # another writer's (or a request handler's) open transaction.
+    reconcile_db = await create_sqlite_pool(db_path, init_schema=False)
+    watcher_db = await create_sqlite_pool(db_path, init_schema=False)
+
+    from domain.local_processor import reconcile_workspace
+    reconcile_task = asyncio.create_task(reconcile_workspace(reconcile_db, workspace))
 
-    # Start file watcher
     watcher_task = None
     try:
         from domain.watcher import watch_workspace
-        from pathlib import Path
-        workspace = Path(app.state.workspace_path)
-        watcher_task = asyncio.create_task(watch_workspace(db, workspace))
+        watcher_task = asyncio.create_task(watch_workspace(watcher_db, workspace))
         logger.info("File watcher started")
     except ImportError:
         logger.warning("watchfiles not installed — file watcher disabled")
 
     try:
         yield
     finally:
+        reconcile_task.cancel()
+        try:
+            await reconcile_task
+        except asyncio.CancelledError:
+            pass
         if watcher_task:
             watcher_task.cancel()
             try:
                 await watcher_task
             except asyncio.CancelledError:
                 pass
+        await reconcile_db.close()
+        await watcher_db.close()
         await db.close()
 
 
@@ -227,13 +243,11 @@ async def _local_lifespan(app: FastAPI):
     set_workspace_root(settings.WORKSPACE_PATH)
 else:
     from routes.api_keys import router as api_keys_router
-    from routes.admin import router as admin_router
     from routes.graph import router as graph_router
     from routes.ws import router as ws_router
     from routes.public import router as public_router
     from infra.tus import router as tus_router
     app.include_router(api_keys_router)
-    app.include_router(admin_router)
     app.include_router(tus_router)
     app.include_router(graph_router)
     app.include_router(ws_router)
```

**File**: `api/routes/admin.py` (removed, +0/-42)
```diff
@@ -1,42 +0,0 @@
-from typing import Annotated
-
-from fastapi import APIRouter, Depends
-from pydantic import BaseModel
-
-from deps import get_scoped_db
-from config import settings
-from scoped_db import ScopedDB
-
-router = APIRouter(prefix="/v1/admin", tags=["admin"])
-
-
-class GlobalStatsResponse(BaseModel):
-    total_users: int
-    total_documents: int
-    total_pages: int
-    total_storage_bytes: int
-    global_max_users: int
-    global_max_pages: int
-    global_ocr_enabled: bool
-    quota_max_storage_per_user: int
-
-
-@router.get("/stats", response_model=GlobalStatsResponse)
-async def global_stats(db: Annotated[ScopedDB, Depends(get_scoped_db)]):
-    row = await db.fetchrow(
-        "SELECT "
-        "  (SELECT COUNT(DISTINCT id) FROM users) AS total_users, "
-        "  (SELECT COUNT(*) FROM documents WHERE NOT archived) AS total_documents, "
-        "  (SELECT COALESCE(SUM(page_count), 0) FROM documents WHERE NOT archived) AS total_pages, "
-        "  (SELECT COALESCE(SUM(file_size), 0) FROM documents WHERE NOT archived) AS total_storage_bytes"
-    )
-    return GlobalStatsResponse(
-        total_users=row["total_users"],
-        total_documents=row["total_documents"],
-        total_pages=row["total_pages"],
-        total_storage_bytes=row["total_storage_bytes"],
-        global_max_users=settings.GLOBAL_MAX_USERS,
-        global_max_pages=settings.GLOBAL_MAX_PAGES,
-        global_ocr_enabled=settings.GLOBAL_OCR_ENABLED,
-        quota_max_storage_per_user=settings.QUOTA_MAX_STORAGE_BYTES,
-    )
```

**File**: `api/routes/documents.py` (modified, +0/-5)
```diff
@@ -131,11 +131,6 @@ async def upsert_document_highlight(
             status_code=409,
             detail="Version mismatch — refetch and retry",
         )
-    if row.get("limit_exceeded"):
-        raise HTTPException(
-            status_code=413,
-            detail="Highlight limit reached (500 per document)",
-        )
     return row
 
 
```

#### Recent Merged Pull Requests:
- **PR #91** (closed): Bump next from 16.2.12 to 16.3.4 in /web (@dependabot[bot])
- **PR #80** (2026-08-09): Pathces (@lucasastorian)
- **PR #79** (closed): Bump postcss from 8.5.18 to 8.5.23 in /extension (@dependabot[bot])
- **PR #78** (closed): Bump cryptography from 48.0.1 to 50.0.0 in /api (@dependabot[bot])
- **PR #77** (closed): Bump aiohttp from 3.14.1 to 3.14.3 in /api (@dependabot[bot])
- **PR #76** (closed): Bump tar and wxt in /extension (@dependabot[bot])
- **PR #75** (closed): Bump linkify-it from 5.0.1 to 5.0.2 in /web (@dependabot[bot])
- **PR #73** (closed): Bump mcp from 1.27.0 to 1.28.1 in /mcp (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
