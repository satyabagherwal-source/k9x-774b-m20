# Forensic Learning Record (Deep Inspection): pascalorg/editor

> **Canonical Artifact**: `07_PROJECT_LEARNING/pascalorg-editor-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/pascalorg/editor](https://github.com/pascalorg/editor))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:38:22.924Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `pascalorg/editor`
- **Description**: Open-source 3D architectural editor with a local CLI, MCP tools, and practical workflows for humans and AI agents.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 24380 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/editor/app/api/health/route.ts`
```
export function GET() {
  return Response.json({
    status: 'ok',
    app: 'editor',
    version: process.env.PASCAL_RUNTIME_VERSION ?? null,
    instanceId: process.env.PASCAL_INSTANCE_ID ?? null,
    timestamp: new Date().toISOString(),
  })
}

```

### Core Architecture Module: `apps/editor/app/api/plugins/mint/[...path]/route.ts`
```
import { handleMintPascalRequest } from '@mint/pascal-plugin/server'
import { BASE_URL } from '@/lib/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const route = (request: Request) =>
  handleMintPascalRequest(request, {
    origin: process.env.MINT_PASCAL_HOST_ORIGIN ?? BASE_URL,
  })

export { route as GET, route as POST }

```

### Core Architecture Module: `apps/editor/app/api/scenes/[id]/events/route.ts`
```
import {
  guardSceneApiRequest,
  sceneApiJson,
  sceneApiPreflight,
  withSceneApiHeaders,
} from '@/lib/scene-api-security'
import { getSceneOperations } from '@/lib/scene-store-server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type RouteParams = { params: Promise<{ id: string }> }

const POLL_MS = 250
const HEARTBEAT_MS = 15_000
const MAX_EVENTS_PER_POLL = 50

export function OPTIONS(request: Request) {
  return sceneApiPreflight(request)
}

export async function GET(request: Request, { params }: RouteParams) {
  const guard = guardSceneApiRequest(request)
  if (guard) return guard

  const { id } = await params
  const operations = await getSceneOperations()

  if (!operations.canListSceneEvents) {
    return sceneApiJson(request, { error: 'scene_events_unavailable' }, { status: 501 })
  }

  const scene = await operations.loadStoredScene(id)
  if (!scene) {
    return sceneApiJson(request, { error: 'not_found' }, { status: 404 })
  }

  const url = new URL(request.url)
  const afterFromQuery = Number.parseInt(url.searchParams.get('after') ?? '0', 10)
  const afterFromHeader = Number.parseInt(request.headers.get('Last-Event-ID') ?? '0', 10)
  let cursor = Math.max(
    0,
    Number.isFinite(afterFromQuery) ? afterFromQuery : 0,
    Number.isFinite(afterFromHeader) ? afterFromHeader : 0,
  )

  const encoder = new TextEncoder()
  let closed = false
  let pollTimer: ReturnType<typeof setTimeout> | undefined
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const enqueue = (chunk: string) => {
        if (!closed) controller.enqueue(encoder.encode(chunk))
      }

      const close = () => {
        if (closed) return
        closed = true
        if (pollTimer) clearTimeout(pollTimer)
        if (heartbeatTimer) clearInterval(heartbeatTimer)
        try {
          controller.close()
        } catch {
          // The client may have already closed the stream.
        }
      }

      request.signal.addEventListener('abort', close, { once: true })
      enqueue('retry: 1000\n\n')

      const poll = async () => {
        if (closed) return
        try {
          const events = await operations.listSceneEvents(id, {
            afterEventId: cursor,
            limit: MAX_EVENTS_PER_POLL,
          })
          for (const event of events) {
            cursor = event.eventId
            enqueue(`id: ${event.eventId}\n`)
            enqueue('event: scene\n')
            enqueue(`data: ${JSON.stringify(event)}\n\n`)
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          enqueue('event: error\n')
          enqueue(`data: ${JSON.stringify({ message })}\n\n`)
        } finally {
          if (!closed) pollTimer = setTimeout(poll, POLL_MS)
        }
      }

      heartbeatTimer = setInterval(() => enqueue(': keepalive\n\n'), HEARTBEAT_MS)
      void poll()
    },
    cancel() {
      closed = true
      if (pollTimer) clearTimeout(pollTimer)
      if (heartbeatTimer) clearInterval(heartbeatTimer)
    },
  })

  return withSceneApiHeaders(
    request,
    new Response(stream, {
      headers: {
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'Content-Type': 'text/event-stream; charset=utf-8',
        'X-Accel-Buffering': 'no',
      },
    }),
  )
}

```

### Core Architecture Module: `apps/editor/app/api/scenes/[id]/route.ts`
```
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { countGraphNodes, isEmptyGraphOverwrite } from '@/lib/empty-graph-guard'
import { apiGraphSchema } from '@/lib/graph-schema'
import {
  guardSceneApiRequest,
  sceneApiJson,
  sceneApiPreflight,
  withSceneApiHeaders,
} from '@/lib/scene-api-security'
import { getSceneOperations } from '@/lib/scene-store-server'

export const dynamic = 'force-dynamic'

type RouteParams = { params: Promise<{ id: string }> }

const putSceneSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  graph: apiGraphSchema,
  thumbnailUrl: z.string().url().nullable().optional(),
  expectedVersion: z.number().int().nonnegative().optional(),
  /**
   * Overwriting a populated scene with a 0-node graph is rejected (409
   * `empty_graph_rejected`) unless this is set: an empty PUT is a hydration
   * race or a bug far more often than an intentional full deletion, and the
   * wipe is silent while the deletion is recoverable from scene_revisions.
   */
  force: z.boolean().optional(),
})

const patchSceneSchema = z.object({
  name: z.string().min(1).max(200),
  expectedVersion: z.number().int().nonnegative().optional(),
})

export function OPTIONS(request: NextRequest) {
  return sceneApiPreflight(request)
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const guard = guardSceneApiRequest(request)
  if (guard) return guard

  const { id } = await params
  const operations = await getSceneOperations()
  try {
    const scene = await operations.loadStoredScene(id)
    if (!scene) {
      return sceneApiJson(request, { error: 'not_found' }, { status: 404 })
    }
    return sceneApiJson(request, scene, {
      headers: { ETag: `"${scene.version}"` },
    })
  } catch (error) {
    return handleStoreError(request, error)
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const guard = guardSceneApiRequest(request)
  if (guard) return guard

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return sceneApiJson(
      request,
      { error: 'invalid_request', details: 'body must be valid JSON' },
      { status: 400 },
    )
  }

  const parsed = putSceneSchema.safeParse(body)
  if (!parsed.success) {
    return sceneApiJson(
      request,
      { error: 'invalid_request', details: parsed.error.issues },
      { status: 400 },
    )
  }

  const ifMatch = parseIfMatch(request.headers.get('If-Match'))
  const expectedVersion = ifMatch ?? parsed.data.expectedVersion

  const operations = await getSceneOperations()
  try {
    const existing = await operations.loadStoredScene(id)
    if (!existing) {
      return sceneApiJson(request, { error: 'not_found' }, { status: 404 })
    }
    if (
      !parsed.data.force &&
      isEmptyGraphOverwrite(countGraphNodes(parsed.data.graph), existing.nodeCount)
    ) {
      return sceneApiJson(
        request,
        {
          error: 'empty_graph_rejected',
          details: `Refusing to overwrite ${existing.nodeCount} nodes with an empty graph. Pass "force": true to overwrite intentionally.`,
          currentVersion: existing.version,
          currentNodeCount: existing.nodeCount,
        },
        { status: 409 },
      )
    }
    const meta = await operations.saveScene({
      id,
      name: parsed.data.name ?? existing.name,
      projectId: existing.projectId,
      ownerId: existing.ownerId,
      graph: parsed.data.graph as never,
      thumbnailUrl:
        parsed.data.thumbnailUrl === undefined ? existing.thumbnailUrl : parsed.data.thumbnailUrl,
      expectedVersion: expectedVersion ?? existing.version,
    })
    return sceneApiJson(request, meta, {
      headers: { ETag: `"${meta.version}"` },
    })
  } catch (error) {
    return handleStoreError(request, error, { includeCurrentVersionFor: id })
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const guard = guardSceneApiRequest(request)
  if (guard) return guard

  const { id } = await params
  const ifMatch = parseIfMatch(request.headers.get('If-Match'))

  const operations = await getSceneOperations()
  try {
    const removed = await operations.deleteStoredScene(id, { expectedVersion: ifMatch })
    if (!removed) {
      return sceneApiJson(request, { error: 'not_found' }, { status: 404 })
    }
    return withSceneApiHeaders(request, new NextResponse(null, { status: 204 }))
  } catch (error) {
    return handleStoreError(request, error, { includeCurrentVersionFor: id })
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const guard = guardSceneApiRequest(request)
  if (guard) return guard

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return sceneApiJson(
      request,
      { error: 'invalid_request', details: 'body must be valid JSON' },
      { status: 400 },
    )
  }

  const parsed = patchSceneSchema.safeParse(body)
  if (!parsed.success) {
    return sceneApiJson(
      request,
      { error: 'invalid_request', details: parsed.error.issues },
      { status: 400 },
    )
  }

  const ifMatch = parseIfMatch(request.headers.get('If-Match'))
  const expectedVersion = ifMatch ?? parsed.data.expectedVersion

  const operations = await getSceneOperations()
  try {
    const meta = await operations.renameStoredScene(id, parsed.data.name, { expectedVersion })
    return sceneApiJson(request, meta, {
      headers: { ETag: `"${meta.version}"` },
    })
  } catch (error) {
    return handleStoreError(request, error, { includeCurrentVersionFor: id })
  }
}

/**
 * Parses an `If-Match` header value per RFC 7232. Accepts `"<version>"` or
 * weak `W/"<version>"` forms. Returns `undefined` when the header is absent,
 * the wildcard `*`, or unparseable as a non-negative integer.
 */
function parseIfMatch(raw: string | null): number | undefined {
  if (!raw) return undefined
  const trimmed = raw.trim()
  if (trimmed === '*') return undefined
  const match = trimmed.match(/^(?:W\/)?"([^"]+)"$/)
  const inner = match ? match[1] : trimmed
  if (!inner) return undefined
  const n = Number(inner)
  if (!(Number.isFinite(n) && Number.isInteger(n)) || n < 0) return undefined
  return n
}

async function handleStoreError(
  request: NextRequest,
  error: unknown,
  opts: { includeCurrentVersionFor?: string } = {},
): Promise<NextResponse> {
  const code = (error as { code?: string })?.code
  if (code === 'version_conflict') {
    let currentVersion: number | undefined
    if (opts.includeCurrentVersionFor) {
      try {
        const operations = await getSceneOperations()
        const current = await operations.loadStoredScene(opts.includeCurrentVersionFor)
        currentVersion = current?.version
      } catch {
        // Best-effort; skip reporting currentVersion on secondary failure.
      }
    }
    return sceneApiJson(
      request,
      currentVersion === undefined
        ? { error: 'version_conflict' }
        : { error: 'version_conflict', currentVersion },
      { status: 409 },
    )
  }
  if (code === 'not_found') {
    return sceneApiJson(request, { error: 'not_found' }, { status: 404 })
  }
  if (code === 'too_large') {
    return sceneApiJson(request, { error: 'too_large' }, { status: 413 })
  }
  if (code === 'invalid') {
    return sceneApiJson(request, { error: 'invalid' }, { status: 400 })
  }
  const message = error instanceof Error ? error.message : 'unexpected_error'
  return sceneApiJson(request, { error: 'internal_error', message }, { status: 500 })
}

```

### Core Architecture Module: `apps/editor/app/api/scenes/route.ts`
```
import type { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiGraphSchema } from '@/lib/graph-schema'
import { guardSceneApiRequest, sceneApiJson, sceneApiPreflight } from '@/lib/scene-api-security'
import { getSceneOperations } from '@/lib/scene-store-server'

export const dynamic = 'force-dynamic'

const createSceneSchema = z.object({
  id: z.string().min(1).max(64).optional(),
  name: z.string().min(1).max(200),
  projectId: z.string().min(1).max(200).nullable().optional(),
  graph: apiGraphSchema,
  thumbnailUrl: z.string().url().nullable().optional(),
})

const listQuerySchema = z.object({
  projectId: z.string().min(1).max(200).optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
})

export function OPTIONS(request: NextRequest) {
  return sceneApiPreflight(request)
}

export async function GET(request: NextRequest) {
  const guard = guardSceneApiRequest(request)
  if (guard) return guard

  const url = new URL(request.url)
  const parsed = listQuerySchema.safeParse({
    projectId: url.searchParams.get('projectId') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
  })
  if (!parsed.success) {
    return sceneApiJson(
      request,
      { error: 'invalid_request', details: parsed.error.issues },
      { status: 400 },
    )
  }

  const operations = await getSceneOperations()
  const scenes = await operations.listScenes({
    projectId: parsed.data.projectId,
    limit: parsed.data.limit,
  })
  return sceneApiJson(request, { scenes })
}

export async function POST(request: NextRequest) {
  const guard = guardSceneApiRequest(request)
  if (guard) return guard

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return sceneApiJson(
      request,
      { error: 'invalid_request', details: 'body must be valid JSON' },
      { status: 400 },
    )
  }

  const parsed = createSceneSchema.safeParse(body)
  if (!parsed.success) {
    return sceneApiJson(
      request,
      { error: 'invalid_request', details: parsed.error.issues },
      { status: 400 },
    )
  }

  const operations = await getSceneOperations()
  try {
    const meta = await operations.saveScene({
      id: parsed.data.id,
      name: parsed.data.name,
      projectId: parsed.data.projectId ?? null,
      graph: parsed.data.graph as never,
      thumbnailUrl: parsed.data.thumbnailUrl ?? null,
    })
    return sceneApiJson(request, meta, {
      status: 201,
      headers: { Location: `/scene/${meta.id}` },
    })
  } catch (error) {
    return handleStoreError(request, error)
  }
}

function handleStoreError(request: NextRequest, error: unknown): NextResponse {
  const code = (error as { code?: string })?.code
  if (code === 'version_conflict') {
    return sceneApiJson(request, { error: 'version_conflict' }, { status: 409 })
  }
  if (code === 'not_found') {
    return sceneApiJson(request, { error: 'not_found' }, { status: 404 })
  }
  if (code === 'too_large') {
    return sceneApiJson(request, { error: 'too_large' }, { status: 413 })
  }
  if (code === 'invalid') {
    return sceneApiJson(request, { error: 'invalid' }, { status: 400 })
  }
  const message = error instanceof Error ? error.message : 'unexpected_error'
  return sceneApiJson(request, { error: 'internal_error', message }, { status: 500 })
}

```

### Core Architecture Module: `apps/editor/app/client-bootstrap.tsx`
```
'use client'

// Loads `@pascal-app/nodes`' built-in plugin into the node registry on the
// client. Mounted from `layout.tsx` so every page in the standalone
// editor gets the registry populated before its first `<Viewer>` /
// `<Editor>` mounts — without this the registry is empty on the client
// (the server registers in its own module instance, which is unreachable
// from hydrated pages) and every `NodeRenderer` resolves to `null`. The
// `loaded` guard inside `../lib/bootstrap` keeps the side effect
// idempotent under HMR.
import '../lib/bootstrap'
import { type ReactNode, useEffect } from 'react'

export function ClientBootstrap({
  children,
  enableDevDiagnostics,
}: {
  children: ReactNode
  enableDevDiagnostics: boolean
}) {
  useEffect(() => {
    if (!enableDevDiagnostics) return
    import('react-scan').then(({ scan }) => scan({ enabled: true }))
  }, [enableDevDiagnostics])
  return children
}

```

### Core Architecture Module: `apps/editor/app/import/import-client.tsx`
```
'use client'

import { type ValidateBuildJsonResult, validateBuildJson } from '@pascal-app/core'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { MAX_IMPORT_BYTES, parseImportSrc } from '@/lib/import-src'

type Phase =
  | { kind: 'fetching' }
  // createError keeps the review alive after a failed create: the
  // validated graph stays on screen and Import can simply be retried —
  // a refresh would re-fetch `src`, and a short-lived scan URL may
  // already be gone (review feedback).
  | { kind: 'review'; result: ValidateBuildJsonResult; createError?: string }
  | { kind: 'creating'; result: ValidateBuildJsonResult }
  | { kind: 'error'; message: string }

/**
 * Client half of `/import?src=<url>`: fetches the build JSON in the
 * visitor's browser (same trust model as dropping a file on Load Build —
 * the target must allow CORS), runs the same `validateBuildJson`
 * pre-flight as Load Build, shows what would be imported, and only on an
 * explicit click creates the scene through the regular `POST /api/scenes`
 * route — so auth, origin checks and graph validation all apply
 * unchanged.
 */
export function ImportClient({ src, name }: { src: string | null; name: string | null }) {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>({ kind: 'fetching' })
  const [sceneName, setSceneName] = useState(name ?? 'Imported scene')
  // Synchronous re-entry guard: a second tap can fire before React
  // re-renders into 'creating', and two scenes would be created (review
  // feedback — especially likely on the mobile hand-off).
  const creating = useRef(false)

  useEffect(() => {
    // A new src remounts the component (the page keys it by src), so
    // state can never leak between files. Within one mount, ignore
    // every state update from a superseded run — an abort must not
    // surface as an error either.
    const parsedSrc = parseImportSrc(src)
    if (!parsedSrc.ok) {
      setPhase({ kind: 'error', message: parsedSrc.reason })
      return
    }
    let cancelled = false
    const controller = new AbortController()
    const update = (next: Phase) => {
      if (!cancelled) setPhase(next)
    }
    ;(async () => {
      let response: Response
      try {
        response = await fetch(parsedSrc.url, { signal: controller.signal })
      } catch {
        update({
          kind: 'error',
          message:
            'The file could not be fetched. The server hosting it must allow cross-origin requests (CORS).',
        })
        return
      }
      if (!response.ok) {
        update({ kind: 'error', message: `The file could not be fetched (${response.status}).` })
        return
      }
      const declared = Number(response.headers.get('content-length') ?? 0)
      if (declared > MAX_IMPORT_BYTES) {
        update({ kind: 'error', message: 'The file is too large to import.' })
        return
      }
      let text: string
      try {
        text = await response.text()
      } catch {
        update({ kind: 'error', message: 'The file could not be read.' })
        return
      }
      // Blob measures BYTES — text.length counts UTF-16 code units, and
      // a graph full of non-ASCII names could pass here yet still 413
      // at the store (review feedback).
      if (new Blob([text]).size > MAX_IMPORT_BYTES) {
        update({ kind: 'error', message: 'The file is too large to import.' })
        return
      }
      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        update({ kind: 'error', message: 'The file could not be parsed as JSON.' })
        return
      }
      update({ kind: 'review', result: validateBuildJson(parsed) })
    })()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [src])

  const handleImport = useCallback(async () => {
    if (phase.kind !== 'review' || !phase.result.parsed) return
    if (creating.current) return
    creating.current = true
    const review = phase.result
    setPhase({ kind: 'creating', result: review })
    try {
      const response = await fetch('/api/scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: sceneName || 'Imported scene',
          graph: phase.result.parsed,
        }),
      })
      if (!response.ok) {
        setPhase({
          kind: 'review',
          result: review,
          createError:
            response.status === 401 || response.status === 403
              ? 'You need to be signed in to import a scene.'
              : response.status === 413
                ? 'The scene is too large for the scene store.'
                : `Creating the scene failed (${response.status}).`,
        })
        return
      }
      const meta = (await response.json()) as { id: string }
      router.push(`/scene/${meta.id}`)
    } catch (error) {
      setPhase({
        kind: 'review',
        result: review,
        createError: error instanceof Error ? error.message : 'Creating the scene failed.',
      })
    } finally {
      // Released in every path: after an error the user may retry.
      creating.current = false
    }
  }, [phase, router, sceneName])

  if (phase.kind === 'fetching') {
    return <p className="text-muted-foreground text-sm">Fetching the scene…</p>
  }
  if (phase.kind === 'creating') {
    return <p className="text-muted-foreground text-sm">Creating the scene…</p>
  }
  if (phase.kind === 'error') {
    return (
      <div className="rounded-xl border border-border/60 bg-background p-6">
        <p className="text-destructive text-sm">{phase.message}</p>
      </div>
    )
  }

  const { result } = phase
  const typeEntries = Object.entries(result.stats.byType).sort((a, b) => b[1] - a[1])

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border/60 bg-background p-6">
        <label className="mb-1 block font-medium text-muted-foreground text-xs uppercase">
          Scene name
        </label>
        <input
          className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          onChange={(event) => setSceneName(event.target.value)}
          value={sceneName}
        />

        <p className="mt-4 mb-1 font-medium text-muted-foreground text-xs uppercase">Contents</p>
        <p className="text-sm">
          {result.stats.total} node{result.stats.total === 1 ? '' : 's'}
          {result.stats.floorAreaM2 > 0
            ? ` · ${Math.round(result.stats.floorAreaM2)} m² of floor`
            : ''}
        </p>
        {typeEntries.length > 0 && (
          <p className="mt-1 text-muted-foreground text-xs">
            {typeEntries.map(([type, count]) => `${count} ${type}`).join(' · ')}
          </p>
        )}

        {result.errors.length > 0 && (
          <ul className="mt-4 space-y-1">
            {result.errors.map((issue) => (
              <li className="text-destructive text-xs" key={`${issue.code}:${issue.message}`}>
                {issue.message}
              </li>
            ))}
          </ul>
        )}
        {result.warnings.length > 0 && (
          <ul className="mt-2 space-y-1">
            {result.warnings.map((issue) => (
              <li className="text-muted-foreground text-xs" key={`${issue.code}:${issue.message}`}>
                {issue.message}
              </li>
            ))}
          </ul>
        )}
        {/* The schema error above says "see details below" — these are the
            details: per-node path and message, same data Load Build shows. */}
        {result.schemaIssues.length > 0 && (
          <ul className="mt-2 space-y-1">
            {result.schemaIssues.map((issue) => (
              <li
                className="text-destructive text-xs"
                key={`${issue.nodeId}:${issue.path}:${issue.message}`}
              >
                {issue.nodeId} ({issue.nodeType}) · {issue
```

### Core Architecture Module: `apps/editor/app/import/page.tsx`
```
import Link from 'next/link'
import { ImportClient } from './import-client'

export const dynamic = 'force-dynamic'

/**
 * `/import?src=<https-url>[&name=<scene name>]` — the hand-off point for
 * scanning apps and other external tools: they host a build JSON at a
 * URL (CORS-enabled) and open this page; the visitor reviews what the
 * file contains and imports it as a new scene of their own.
 */
export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ src?: string; name?: string }>
}) {
  const params = await searchParams

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-border border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex items-center justify-between gap-4 px-6 py-4">
          <nav className="flex items-center gap-4 text-sm">
            <Link
              className="text-muted-foreground transition-colors hover:text-foreground"
              href="/"
            >
              Home
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="font-medium text-foreground">Import</span>
          </nav>
        </div>
      </header>

      <main className="container mx-auto max-w-2xl px-6 py-12">
        <h1 className="mb-2 font-bold text-3xl">Import a scene</h1>
        <p className="mb-8 text-muted-foreground text-sm">
          Review the file before it becomes a scene. Nothing is created until you confirm.
        </p>
        {/* Keyed by src: a new file is a new flow — state (scene name,
            phase) must never leak from the previous one. */}
        <ImportClient key={params.src} name={params.name ?? null} src={params.src ?? null} />
      </main>
    </div>
  )
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #826** (2026-09-12): **[CRITICAL]: SECURITY.md asks for Private Vulnerability Reporting, but there is no "Report a vulnerability" button**
  *Symptoms*: ### What happened?  ### Bug Description  SECURITY.md tells researchers not to file public GitHub issues and to use GitHub Private Vulnerability Reporting:  > Go to the Security tab of the repository, click on "Advisories", and select "Report a vulnerability".  That button is not available to me as an external reporter.  On the Security Overview page, all three features show as Enabled:  - Security policy • Enabled - Security advisories • Enabled - Private vulnerability reporting • Enabled  Enabled in Overview is not the same as a working intake path. I can open the policy and the advisories list, but I never get a "Report a vulnerability" action. The Advisories page is empty ("There aren't any published security advisories") with no report CTA.  I have verified security findings that I am withholding from this public issue on purpose, per your own policy. I cannot send them until a private report button (or another private inbox) actually works for non-maintainers.  Please expose "Report a vulnerability" for logged-in outside contributors, or reply here with a private intake (security email or a handle I can contact). Do not ask me to paste the findings on this thread.  ### Steps to reproduce  1. Open https://github.com/pascalorg/editor (logged in to GitHub, not a maintainer). 2. Click the Security tab. 3. Open Security Overview and confirm all three rows are Enabled:    - Security policy • Enabled → "View security policy"    - Security advisories • Enabled → "View security a
  **Post-Mortem & Fix Analysis**:
  > Thank you for reporting this publicly without disclosing the findings. You were right: the repository setting was disabled even though the security policy pointed to it. Private vulnerability reporting is now enabled. Please use the new “Report a vulnerability” action under Security → Advisories; if GitHub still does not show it for your account, security@pascal.app remains available. I’m closing this public intake issue now so the actual findings can move to the private channel.

- **Issue #734** (2026-09-12): **Save Build / Load Build round-trip drops collections**
  *Symptoms*: Split out of #729 (review note). Materials had the same gap on the import side; #729 fixes materials — collections have it on **both** sides:  - `handleSaveBuild` (`packages/editor/src/components/ui/sidebar/panels/settings-panel/index.tsx`) exports `{ nodes, rootNodeIds, installedPlugins }` — no `collections`. - `validateBuildJson` (`packages/core/src/validation/validate-build-json.ts`) has no `collections` pass, so even a hand-added table is silently dropped. - `handleConfirmImport` doesn't pass collections to `setScene` — although `setScene` already accepts `extra.collections`, and the hosted loader round-trips them.  Repro: create a collection, Save Build, Load Build the same file → collection gone.  Fix shape mirrors #729: include `collections` in the saved `sceneData`, add a validated pass in `validateBuildJson` (per-entry skip + warning naming the skipped ids), pass through to `setScene`.

- **Issue #725** (2026-08-31): **MCP live-sync silently drops mutations when no active scene is bound**
  *Symptoms*: Found by @Srujanreddy1234 while investigating chat/prompt persistence (#561) — the PR went stale but the underlying observation is correct and still unfixed on main.  `packages/mcp/src/operations/live-sync.ts:33`:  ```ts if (!(active && operations.canAppendSceneEvents)) return ```  When a store is attached but no scene is bound, `publishLiveSceneSnapshot` returns silently: mutations vanish with no error, no log, and no signal to the caller. The failure mode sends people hunting in the wrong layer (chat, prompts, transport) when the real cause is an unbound scene.  **Design decision needed before fixing** (the question #561 never resolved): throw a typed `no_active_scene` error, or lazily bind a draft scene so the mutation lands somewhere recoverable. Constraints:  - `src/bin/pascal-mcp.ts` attaches a store unconditionally and never calls `setActiveScene` in the plain `--stdio` flow, so a bare throw would break the README quick start on the first `create_wall`. - Main already has the narrower `canAppendSceneEvents` gate (`scene-operations.ts:103`), which is the seam a correct fix should build on. - Whatever the choice, it needs a test — which also means teaching `InMemorySceneStore` (`tools/scene-lifecycle/test-utils.ts`) `appendSceneEvent`/`listSceneEvents`, which it currently lacks.  Related: #706 fixed the `this`-binding bug on the same `appendSceneEvent` path (shipped in `263b4ab6`, #489).
  **Post-Mortem & Fix Analysis**:
  > Design decision, and a candidate: #736.  Between the two options #561 debated, neither survives the constraints in this issue. A typed `no_active_scene` throw breaks the `--stdio` quick start on the first `create_wall` (the store is attached, no scene is ever bound). Lazy draft binding silently creates persistent scenes the user never asked for, and not every store can create one without project context.  What #736 does instead: kills the *silence* rather than the skip. `publishLiveSceneSnapshot` returns `'published' | 'unbound' | 'events_unsupported'` (split on the existing `canAppendSceneEvents` seam), and all 17 mutating tool sites surface a `persistence: { status, warning }` field in their result when the change stayed in-memory — declared in each tool's output schema so structured-content validation keeps it. An AI caller reads the warning and binds a scene with `save_scene`/`load_scene`; a human reading the transcript sees exactly why nothing persisted, in the layer where they we

- **Issue #715** (2026-09-12): **@pascal-app/editor beta.5 pulls node:module into external browser builds through Manifold print export**
  *Symptoms*: ### What happened?  Hi Pascal team,  we are integrating @pascal-app/editor into an external Next.js application and found a browser packaging issue in beta.5.  The public @pascal-app/editor root pulls the Manifold print-export path into the browser dependency graph even when print export is not used.  As a result, an optimized Next/Webpack build fails when it reaches `node:module` through `manifold-3d`.  The relevant import chain is:  node:module → manifold-3d → print-shell-compiler-manifold-core → print-shell-compiler-manifold.worker → print-shell-compiler-manifold-worker → export-manager.tsx → @pascal-app/editor root → external Next.js application  The build error is:  Module build failed: UnhandledSchemeError: Reading from "node:module" is not handled by plugins.  The editor APIs and runtime functionality we use otherwise work correctly. The failure is specifically at the optimized browser production-build boundary.  ### Steps to reproduce  1. Consume the public `@pascal-app/editor` root from an external Next.js application. 2. Use the current beta.5 source. 3. Import the editor through its public package entrypoint. 4. Run an optimized Next/Webpack production build. 5. The browser bundle traverses the print-export dependency path and eventually reaches `node:module` through `manifold-3d`. 6. The build fails with `UnhandledSchemeError`.  We most recently rechecked exact upstream source SHA:  cfe13068fe9e4ef97c1b94ce24f5a40b44d5fe07  The issue is still present there.  ### E
  **Post-Mortem & Fix Analysis**:
  > Thanks — this is real, and the chain you traced is accurate. Two clarifications, then where I land.  First, the version: published `@pascal-app/editor@1.0.0-beta.5` went out on 2026-08-18, and the print export landed on 2026-08-21 in #701. So the npm beta.5 tarball has no manifold in it at all — what you're hitting is `main` (your `cfe13068` re-test is after both #701 and #703). Worth knowing so you don't chase the wrong artifact.  Second, #703 doesn't help you. It only collapsed the print-export UI into a single button; the import chain is unchanged. `export-manager.tsx` still statically imports the manifold worker module, and `ExportManager` renders unconditionally from the editor root, so it's in every consumer's graph.  Confirmed at `main`: `manifold-3d@3.5.1` has no `browser` field and its `.` entry is the emscripten `manifold.js` that reads `node:module`. Webpack statically parses the `new Worker(new URL(...))` call and builds that chunk, which is where it dies. Our own builds do
  > Thanks - sounds good.  Please ping me when you have a candidate and I’ll validate it against our external Next/Webpack integration.  We’ll stay pinned for now rather than add the `resolve.fallback` workaround, since the current integration is stable and I’d prefer to verify the proper browser-safe boundary once it’s available.  And thanks again for looking into this. 
  > @smokie40 Candidate is up: #735.  The shape, so you can judge it before spending time: the worker chunk is still built by your bundler, but it no longer contains any traceable `manifold-3d` specifier. The core module keeps only a type import; the emscripten factory loads at runtime through an `import()` webpack can't follow — bare specifier first, then a version-pinned jsDelivr copy of `manifold.js` (the wasm self-resolves relative to the glue's URL). So your build stops seeing `node:module` entirely, and print export in a bundled browser app runs off the CDN copy unless you point `configureManifoldRuntime({ moduleUrl, wasmUrl })` at self-hosted assets — that's the new export on the package entry, worth wiring if your deployment is CSP-strict or offline.  If you can validate the branch against your external Next/webpack integration, that's the last piece I can't reproduce exactly on my side: `github:pascalorg/editor#fix/manifold-out-of-bundler-graph`, or wait for the merge and test `ma

- **Issue #706** (2026-08-28): **[Bug] save_failed: this.withWriteTransaction undefined — appendSceneEvent loses `this` binding in SceneOperationsFacade**
  *Symptoms*: ### What happened?  Calling `create_from_template` with `save: true` throws:  ``` save_failed: undefined is not an object (evaluating 'this.withWriteTransaction') ```  **Root cause:** In `SceneOperationsFacade.appendSceneEvent()` (dist/operations/scene-operations.js), the store method is destructured from its object and then called as a plain function — losing the `this` binding:  ```js // BUGGY (before fix) async appendSceneEvent(options) {     const append = this.requireStore().appendSceneEvent; // method extracted     if (!append) return null;     return append(options); // called without this → this.withWriteTransaction is undefined } ```  When `append(options)` is called without a receiver, `this` inside `SqliteSceneStore.appendSceneEvent` is `undefined` (strict mode), and the first line `return this.withWriteTransaction(...)` throws.  The same pattern in `listSceneEvents` has the identical bug (store method destructured and called without binding).  **Call chain:** `create-from-template.js:126` → `appendLiveSceneEvent(bridge, ...)` → `live-sync.js:61` `operations.appendSceneEvent({...})` → `scene-operations.js:169` `const append = this.requireStore().appendSceneEvent` ← loses `this` → `scene-operations.js:172` `append(options)` → `sqlite-scene-store.js:385` `this.withWriteTransaction(...)` ← `this` is `undefined` → crash  ### Steps to reproduce  1. Install `@pascal-app/mcp` v0.3.2 globally: `bun install -g @pascal-app/mcp` 2. Set `PASCAL_DATA_DIR` to a writable director
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed report — the lost  binding is clear. I'll put up a fix.
  > Great report — the diagnosis is exactly right, and the patch you wrote is character-for-character the one already on `main`: `263b4ab6` (#489), merged 2026-07-19. Both `appendSceneEvent` and `listSceneEvents` take the receiver properly now.  The reason you hit it is on me, though. The npm `latest` tag still points at `0.3.2` from 2026-07-17 — two days before that fix — so `bun install -g @pascal-app/mcp` hands you the stale build. I verified it by unpacking both tarballs: 0.3.2 has the unbound call, `1.0.0-beta.6` has the fix.  `bun install -g @pascal-app/mcp@beta` will get you a working `create_from_template --save` today. I'm sorting out the dist-tags so an unpinned install stops handing out a July build — the same stale resolve is behind two other reports. Closing this as fixed, but thank you: the dist-tag problem is the more valuable find and I wouldn't have gone looking without these reports landing together.  @aryansk — appreciate the offer, but no PR needed here; it's already fi

- **Issue #704** (2026-09-28): **No documented way to bridge a Pascal Capture (cloud) scan into the local MCP server; local MCP also fails to start under Cowork/Code with "Connection closed"**
  *Symptoms*: ### What happened?  Two related problems with the local MCP server (@pascal-app/mcp) and cloud/local project sync:  1. Cloud-to-local bridge: We're building a pipeline where a room is scanned via Pascal Capture (iPad LiDAR) into a cloud project (editor.pascal.app/editor/<project_id>), and we want to operate on that project via the local MCP server (get_walls, export_json, etc.) instead of manually re-measuring. Testing shows the cloud web editor and the local MCP server are two entirely separate data stores: calling get_project_status against a real cloud project id from the local MCP server returns project_not_found.  2. Separate connection failure: in Claude's Cowork/Code environment, the Local MCP servers panel shows the pascal server status as "failed", with the error: "Couldn't start this server for Cowork and Code sessions (they run their own copy of it), so they can't use its tools: Connection closed" This is a different symptom from the draft-07 outputSchema error reported separately — this one is the server process itself failing to start when a second/independent copy is spawned for these session types.  ### Steps to reproduce  For (1): 1. Scan a room with Pascal Capture on iPad, creating a cloud project at editor.pascal.app/editor/<project_id> 2. Run the local MCP server (bunx @pascal-app/mcp) and call get_project_status with that same project id 3. Observe project_not_found  For (2): 1. Open Claude's Cowork/Code environment with @pascal-app/mcp configured as a loc
  **Post-Mortem & Fix Analysis**:
  > Splitting these, because (2) turned out to be a straightforward bug on my side and (1) is a real gap.  **(2) "Connection closed" — reproduced, root cause found.** The published package can't run under Node at all. Its dist has 189 extensionless relative import specifiers and zero with `.js`, so Node's ESM resolver fails on the very first import:  ``` Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../dist/bridge/node-shims' ```  Bun tolerates extensionless specifiers, which is why `bunx @pascal-app/mcp` works standalone and Claude Desktop is fine. Anything that spawns its own copy under Node dies before the transport connects, and the client reports that as "Connection closed." Worse, `0.3.2`'s shebang is `#!/usr/bin/env bun` but `1.0.0-beta.6`'s is `#!/usr/bin/env node` — so the newer package advertises a Node entrypoint it can't execute. That's mine to fix and it's the priority here.  While I'm in there: `createSceneStore()` currently runs before the transport connects, so a sandb
  > Status update from a fresh September 12 check: the runtime half is still reproducible in the published `@pascal-app/mcp@1.0.0`. Its Node entrypoint exits on the first extensionless ESM import with `ERR_MODULE_NOT_FOUND`. #861 now fixes emitted imports in both MCP and its core peer and adds real Node CLI/subpath smoke gates; I verified packed tarballs in an isolated Node 26 consumer. I’ll keep this issue open until that fix is merged and released. The separate Capture cloud→local handoff remains tracked by #737.
  > #861 merged on September 12, 2026 (`5275f3e`). The source tree now emits Node-resolvable JavaScript and declaration imports, and CI covers the Node CLI entrypoint.  I’m keeping this issue open because the package currently published on npm is still `@pascal-app/mcp@1.0.0`, which predates the fix. The runtime half is resolved in source but will only be resolved for users after the next coordinated `@pascal-app/core` + `@pascal-app/mcp` release. The separate Capture cloud→local handoff remains tracked by #737. 

- **Issue #696** (2026-09-12): **MCP tool output schemas declare `draft-07` dialect — rejected by clients enforcing JSON Schema 2020-12**
  *Symptoms*: ### What happened?  Every tool call against the local @pascal-app/mcp server fails immediately with a schema validation error, even though the server process itself starts and runs fine:  Error: Tool '<tool_name>' has an invalid outputSchema: JSON Schema declares an unsupported dialect ("$schema": "http://json-schema.org/draft-07/schema#"). The default validator supports JSON Schema 2020-12 only; pass a pre-configured Ajv instance to AjvJs  Confirmed to affect every tool tried, including: list_levels, get_walls, export_json, create_project, list_scenes.  Environment: - Package: @pascal-app/mcp (installed via `bunx @pascal-app/mcp`, unpinned/latest tag as of 2026-08-20) - Client: Claude Desktop (macOS), via its MCP connector config - The server itself starts fine standalone (`bunx @pascal-app/mcp` prints "[pascal-mcp] stdio server running" and hangs waiting for a client) — so this is specifically about how tool output schemas are declared, not a startup/connectivity issue. - Refreshing the client's tool list and fully restarting the MCP connection does not change the error.  ### Steps to reproduce  1. Configure @pascal-app/mcp as an MCP server in Claude Desktop (bunx @pascal-app/mcp) 2. Call any tool, e.g. list_levels, get_walls, or export_json 3. See the outputSchema validation error above instead of a result  ### Expected behavior  **The tool call should succeed and return the requested data. The outputSchema fields should use the JSON Schema 2020-12 dialect (or omit/correct
  **Post-Mortem & Fix Analysis**:
  > Confirmed, and thanks for the precise error text — it pointed straight at the cause.  This is an upstream default we're inheriting. The MCP SDK's `McpServer` converts tool schemas via `toJsonSchemaCompat` without passing a `target`, and the compat layer's fallback is `draft-7`. I reproduced it against our installed SDK and zod 4.4.3:  ``` {"$schema":"http://json-schema.org/draft-07/schema#","type":"object",...} ```  I checked whether upgrading fixes it — it doesn't. SDK 1.30.0 has the same default and the same call sites with no `target`, and we're already on zod v4, so there's no version bump that gets us out of this. `registerTool` also has no JSON-Schema passthrough, so we can't hand it a pre-built 2020-12 schema.  The fix is on us anyway and it's small: re-register the `tools/list` handler after tool registration and normalize `$schema` on the way out. The SDK exposes `removeRequestHandler`, so that's about a dozen lines. Doing that rather than waiting on upstream, since your clien

- **Issue #647** (2026-09-12): **AI agent has no repsonse and always preparing**
  *Symptoms*: ### What happened?  <img width="324" height="180" alt="Image" src="https://github.com/user-attachments/assets/e437581d-6664-4c74-9da1-70e3a0ae52ec" />   I would like to get refund if it didnt work.  ### Steps to reproduce  Using ai agent to create objects  ### Expected behavior  fixed  ### Browser & OS  _No response_  ### Screenshots or screen recordings  _No response_  ### Additional context  _No response_
  **Post-Mortem & Fix Analysis**:
  > Sorry you hit this — a run that starts and never finishes is genuinely frustrating, and "Preparing the next step…" sticking around means the request began but never came back.  To actually find the cause I need something traceable, because at least three different failures look identical from the outside (credits exhausted, a stalled connection, or a provider error we're swallowing instead of showing you). Could you add:  - the project URL (`editor.pascal.app/editor/<id>`) - roughly when it happened, with your timezone - browser and OS - what you typed, and whether the credit counter moved  With the project id and a rough timestamp I can pull the actual run from our logs and tell you which of the three it was. If it turns out credits were taken for a run that never delivered, those go back regardless of what the root cause is — the account support channel can sort that without waiting on this bug.
  > I’m closing this individual report because the trace details requested on August 28 were never supplied, so there is no run we can diagnose or credit event we can reconcile. The underlying product defect—failed streams can leave the UI spinning without a useful error—remains open in #594. If this happens again, please open a fresh report with the project URL, approximate timestamp and timezone, browser/OS, prompt, and whether the credit counter moved.

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

### Incident Patch 1: `ba382303` (2026-09-30)
**Commit Message**: fix(editor): type the selected building id

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VMczFMfWJtZDbBdTARy88m

**File**: `packages/editor/src/components/ui/panels/multi-selection-panel.tsx` (modified, +8/-3)
```diff
@@ -1,6 +1,11 @@
 'use client'
 
-import { type AnyNodeId, resolveBuildingForLevel, useScene } from '@pascal-app/core'
+import {
+  type AnyNodeId,
+  type BuildingNode,
+  resolveBuildingForLevel,
+  useScene,
+} from '@pascal-app/core'
 import { useViewer } from '@pascal-app/viewer'
 import { Building2, Copy, Group, Trash2, Ungroup } from 'lucide-react'
 import { useMemo } from 'react'
@@ -34,8 +39,8 @@ function useWholeLevelBuildingId(selectedIds: readonly string[]) {
 }
 
 /** The building's own selection (no level): its floating pill offers the whole-building Move. */
-function selectBuilding(buildingId: string) {
-  useViewer.getState().setSelection({ buildingId })
+function selectBuilding(buildingId: AnyNodeId) {
+  useViewer.getState().setSelection({ buildingId: buildingId as BuildingNode['id'] })
 }
 
 export function MultiSelectionActions() {
```

---

### Incident Patch 2: `ec0dcea4` (2026-09-30)
**Commit Message**: Merge pull request #978 from pascalorg/fix/offset-door-hit-target

fix(viewer): keep offset door hit targets reachable from both sides

**File**: `packages/viewer/src/systems/door/door-cutout-proxy.test.ts` (added, +357/-0)
```diff
@@ -0,0 +1,357 @@
+// @ts-expect-error — bun:test is provided by the Bun runtime.
+import { describe, expect, test } from 'bun:test'
+import {
+  calculateLevelMiters,
+  DoorNode,
+  getWallBodyCenterOffset,
+  getWallCurveFrameAt,
+  getWallCurveLength,
+  sceneRegistry,
+  useScene,
+  WallNode,
+} from '@pascal-app/core'
+import { act, create } from '@react-three/test-renderer'
+import { createElement } from 'react'
+import * as THREE from 'three'
+import { generateExtrudedWall } from '../wall/wall-system'
+import { buildDoorPreviewMesh, DoorSystem } from './door-system'
+
+const WALL_THICKNESS = 0.24
+
+function fixture(patch: Partial<DoorNode> = {}, wallYaw = 0) {
+  const wall = WallNode.parse({
+    id: 'wall_proxy_test',
+    start: [0, 0],
+    end: [5, 0],
+    height: 3.5,
+    thickness: WALL_THICKNESS,
+  })
+  const node = DoorNode.parse({
+    id: 'door_proxy_test',
+    parentId: wall.id,
+    wallId: wall.id,
+    position: [2.5, 1.4, 0],
+    width: 1.8,
+    height: 2.8,
+    frameDepth: 0.16,
+    ...patch,
+  })
+  const previousNodes = useScene.getState().nodes
+  useScene.setState({ nodes: { ...previousNodes, [wall.id]: wall } })
+  const door = buildDoorPreviewMesh(node)
+  useScene.setState({ nodes: previousNodes })
+  const host = new THREE.Group()
+  host.position.set(4, 2, -3)
+  host.rotation.y = wallYaw
+  const collision = new THREE.Mesh(new THREE.BoxGeometry(5, 3.5, WALL_THICKNESS))
+  collision.name = 'wall-collision'
+  collision.position.set(2.5, 1.75, 0)
+  collision.visible = false
+  host.add(collision, door)
+  host.updateMatrixWorld(true)
+  const proxy = door.getObjectByName('cutout') as THREE.Mesh
+  return {
+    node,
+    wall,
+    door,
+    host,
+    proxy,
+    collision,
+    hits(side: number, x = node.position[0]) {
+      const origin = host.localToWorld(new THREE.Vector3(x, node.position[1], side * 3))
+      const direction = new THREE.Vector3(0, 0, -side).transformDirection(host.matrixWorld)
+      return new THREE.Raycaster(origin, direction).intersectObjects([collision, door], true)
+    },
+    dispose() {
+      host.traverse((object) => {
+        if (object instanceof THREE.Mesh) object.geometry.dispose()
+      })
+      ;(collision.material as THREE.Material).dispose()
+    },
+  }
+}
+
+function ownsDoorHit(object: THREE.Object3D, door: THREE.Object3D): boolean {
+  for (let current: THREE.Object3D | null = object; current; current = current.parent) {
+    if (current === door) return true
+  }
+  return false
+}
+
+function visibleBounds(door: THREE.Mesh) {
+  const bounds = new THREE.Box3()
+  for (const child of door.children) {
+    if (child.name !== 'cutout') bounds.expandByObject(child, true)
+  }
+  return bounds
+}
+
+describe('offset door opening hit proxy', () => {
+  for (const openingShape of ['rectangle', 'arch', 'rounded'] as const) {
+    for (const offset of [-0.36, 0.31]) {
+      for (const flipped of [false, true]) {
+        for (const wallYaw of [0, Math.PI / 3]) {
+          test(`${openingShape}, offset ${offset}, flipped ${flipped}, wall yaw ${wallYaw}`, () => {
+            const f = fixture(
+              {
+                openingShape,
+                openingRadiusMode: 'individual',
+                openingTopRadii: [0.35, 0.12],
+                position: [2.5, 1.4, offset],
+                rotation: [0, flipped ? Math.PI : 0, 0],
+                side: flipped ? 'back' : 'front',
+              },
+              wallYaw,
+            )
+            try {
+              for (const side of [-1, 1]) {
+                const hits = f.hits(side)
+                expect(hits.some((hit) => hit.object === f.collision)).toBe(true)
+                expect(ownsDoorHit(hits[0]!.object, f.door)).toBe(true)
+                const edgeHits = f.hits(side, 3.35)
+                expect(ownsDoorHit(edgeHits[0]!.object, f.door)).toBe(true)
+              }
+              const center = f.host.worldToLocal(f.proxy.getWorldPosition(new THREE.Vecto
```

**File**: `packages/viewer/src/systems/door/door-system.tsx` (modified, +28/-6)
```diff
@@ -2713,7 +2713,15 @@ function syncDoorCutout(node: DoorNode, mesh: THREE.Mesh) {
     mesh.add(cutout)
   }
   cutout.geometry.dispose()
-  const depth = resolveOpeningCutoutProxyDepth(node)
+  const { depth, center } = resolveOpeningCutoutProxy(node)
+  cutout.position.set(0, 0, 0)
+  if (center) {
+    // Curved and justified walls place openings off the reference line. Remove
+    // only the visual plane offset, preserving the frame's resolved floor datum.
+    cutout.position
+      .set(center[0] - mesh.position.x, 0, center[2] - mesh.position.z)
+      .applyQuaternion(mesh.quaternion.clone().invert())
+  }
   const openingShape = getEffectiveOpeningShape(node)
   if (openingShape === 'arch') {
     cutout.geometry = new THREE.ExtrudeGeometry(
@@ -2757,12 +2765,26 @@ function syncDoorCutout(node: DoorNode, mesh: THREE.Mesh) {
 // the proxy stays proud of both wall faces (front/back selection) without the
 // old 1m depth that blanketed the floor. Falls back to the default thickness
 // when the parent wall isn't a resolvable wall node.
-function resolveOpeningCutoutProxyDepth(node: DoorNode): number {
+function resolveOpeningCutoutProxy(node: DoorNode): {
+  depth: number
+  center: [number, number, number] | undefined
+} {
   const parentId = node.parentId
-  const parent = parentId ? useScene.getState().nodes[parentId as AnyNodeId] : undefined
-  const wallThickness =
-    parent?.type === 'wall' ? getWallThickness(parent as WallNode) : DEFAULT_WALL_THICKNESS
-  return getOpeningCutoutProxyDepth(wallThickness)
+  const nodes = useScene.getState().nodes
+  const parent = parentId ? nodes[parentId as AnyNodeId] : undefined
+  const wall = parent?.type === 'wall' ? getEffectiveNode(parent as WallNode) : undefined
+  const wallThickness = wall ? getWallThickness(wall) : DEFAULT_WALL_THICKNESS
+  return {
+    depth: getOpeningCutoutProxyDepth(wallThickness),
+    center:
+      wall && !node.roofSegmentId && node.position[2] !== 0
+        ? getOpeningWallPlacement(
+            wall,
+            { ...node, position: [node.position[0], node.position[1], 0] },
+            nodes,
+          ).position
+        : undefined,
+  }
 }
 
 /**
```

---

### Incident Patch 3: `53c6f2e4` (2026-09-30)
**Commit Message**: Merge current main into door hit-target fix

**File**: `packages/core/src/commands/structure/delete-zone.test.ts` (modified, +47/-0)
```diff
@@ -1,6 +1,7 @@
 import { describe, expect, test } from 'bun:test'
 import { reconcileLevelStructure } from '../../lib/structure-kernel'
 import { ItemNode, SeparatorNode, WallNode, type ZoneNode } from '../../schema'
+import { getWallCurveFrameAt, getWallCurveLength } from '../../systems/wall/wall-curve'
 import { SHARED_WALLS_DELETE_MESSAGE } from './delete-zone'
 import { deleteZone, divideZone, setZoneIntent } from './index'
 import { applyToScratch, type StructureNodes, structureChangeBatch } from './shared'
@@ -240,3 +241,49 @@ describe('deleting a room', () => {
     expect(plan.payload.wallIds.sort()).toEqual(['wall_m0', 'wall_m1', 'wall_m2'])
   })
 })
+
+test('an item kept from a curved wall faces along the curve where it hung', () => {
+  const nodes: Record<string, any> = fixture()
+  const corners: [number, number][] = [
+    [0, 0],
+    [4, 0],
+    [4, 4],
+    [0, 4],
+  ]
+  for (let i = 0; i < 4; i++)
+    nodes[`wall_c${i}`] = WallNode.parse({
+      id: `wall_c${i}`,
+      parentId: 'level_test',
+      start: corners[i],
+      end: corners[(i + 1) % 4],
+      ...(i === 0 ? { curveOffset: -1 } : {}),
+    })
+  const curved = nodes.wall_c0
+  const along = getWallCurveLength(curved) * 0.2
+  nodes.item_shelf = ItemNode.parse({
+    ...chair('item_shelf', 0, 0),
+    parentId: curved.id,
+    position: [along, 1, 0.1],
+    rotation: [0, 0.3, 0],
+  })
+  curved.children = ['item_shelf']
+  let n = 0
+  const graph = applyToScratch(
+    nodes,
+    structureChangeBatch(
+      reconcileLevelStructure({
+        levelId: 'level_test',
+        nodes,
+        mintId: (kind) => `${kind}_c${++n}`,
+      }).patches,
+    ),
+  )
+  const [zone] = zones(graph)
+  const plan = deleteZone(graph, { zoneId: zone!.id, contents: 'keep' })
+  const kept = applyToScratch(graph, structureChangeBatch(plan.changes)).item_shelf as ItemNode
+  const frame = getWallCurveFrameAt(curved, 0.2)
+  expect(kept.parentId).toBe('level_test')
+  expect(kept.rotation[1]).toBeCloseTo(0.3 - Math.atan2(frame.tangent.y, frame.tangent.x), 6)
+  expect(kept.position[0]).toBeCloseTo(frame.point.x + frame.normal.x * 0.1, 6)
+  expect(kept.position[2]).toBeCloseTo(frame.point.y + frame.normal.y * 0.1, 6)
+})
```

**File**: `packages/core/src/commands/structure/delete-zone.ts` (modified, +1/-1)
```diff
@@ -59,7 +59,7 @@ function levelPose(nodes: StructureNodes, item: PositionedIntent, levelId: strin
         position[1],
         frame.point.y + frame.normal.y * position[2],
       ]
-      yaw -= Math.atan2(parent.end[1] - parent.start[1], parent.end[0] - parent.start[0])
+      yaw -= Math.atan2(frame.tangent.y, frame.tangent.x)
     } else if (parent.type === 'ceiling') position[1] += parent.height ?? 2.7
     else if ('position' in parent && Array.isArray(parent.position)) {
       const rotation =
```

**File**: `packages/core/src/utils/ensure-scene-openings.ts` (modified, +8/-1)
```diff
@@ -1,7 +1,8 @@
 import type { AnyNode, AnyNodeId } from '../schema'
 import { syncStairRises } from '../systems/stair/stair-rise-query'
+import { loadMigration } from './load-migration'
 
-export function ensureSceneOpenings(sourceNodes: Record<string, unknown>) {
+function ensureSceneOpeningsOnView(sourceNodes: Record<string, unknown>) {
   let nodes = sourceNodes as Record<string, AnyNode>
   const patches = new Map<AnyNodeId, Partial<AnyNode>>()
   const kinds = new Set(Object.values(nodes).map((node) => node.type))
@@ -27,3 +28,9 @@ export function ensureSceneOpenings(sourceNodes: Record<string, unknown>) {
     updates: [...patches].map(([id, data]) => ({ id, data })),
   }
 }
+
+export const ensureSceneOpenings = loadMigration(
+  'stair and elevator openings',
+  ensureSceneOpeningsOnView,
+  (nodes) => ({ nodes: nodes as Record<string, AnyNode>, changed: false, updates: [] }),
+)
```

**File**: `packages/core/src/utils/floor-opening-migration.ts` (modified, +15/-1)
```diff
@@ -2,6 +2,7 @@ import { adjacentLevelId } from '../lib/floor-opening-intent'
 import { area, intersection, type Ring, union } from '../lib/polygon-boolean'
 import type { AnyNode, CeilingNode, SlabNode } from '../schema'
 import { FloorOpeningNode } from '../schema/nodes/floor-opening'
+import { loadMigration } from './load-migration'
 
 function polygonKey(polygon: Ring) {
   return polygon.map(([x, z]) => [Math.round(x * 10_000), Math.round(z * 10_000)])
@@ -35,7 +36,7 @@ function matchingCeilingHole(nodes: Record<string, unknown>, levelId: string, po
   })
 }
 
-export function migrateFloorOpeningNodes(sourceNodes: Record<string, unknown>) {
+function migrateFloorOpeningNodesOnView(sourceNodes: Record<string, unknown>) {
   let nodes: Record<string, unknown> = sourceNodes
   const groups = new Map<
     string,
@@ -157,3 +158,16 @@ export function migrateFloorOpeningNodes(sourceNodes: Record<string, unknown>) {
   }
   return { nodes, changed: nodes !== sourceNodes, adoptedHoles, created, dedupes, unions }
 }
+
+export const migrateFloorOpeningNodes = loadMigration(
+  'floor openings',
+  migrateFloorOpeningNodesOnView,
+  (nodes) => ({
+    nodes,
+    changed: false,
+    adoptedHoles: 0,
+    created: 0,
+    dedupes: 0,
+    unions: 0,
+  }),
+)
```

**File**: `packages/core/src/utils/floor-plate-migration.ts` (modified, +14/-2)
```diff
@@ -41,6 +41,7 @@ import {
   planFloorPieceAdoption,
 } from './floor-piece-adoption'
 import { legacyWallElevations } from './legacy-wall-datums'
+import { loadMigration } from './load-migration'
 import { omitUndefined } from './omit-undefined'
 
 export type FloorPlateMigrationReport = {
@@ -465,7 +466,7 @@ function clearDanglingFloorSources(nodes: Record<string, AnyNode>) {
 /** A level whose hand-drawn floor pieces cannot be adopted exactly: migrate it without them. */
 class AdoptionRejected extends Error {}
 
-export function migrateFloorPlates(sourceNodes: Record<string, unknown>) {
+function migrateFloorPlatesOnView(sourceNodes: Record<string, unknown>) {
   // Adoption is all-or-nothing per level: a level whose pieces are not all
   // consumed migrates exactly as it would without adoption.
   const skip = new Set<string>()
@@ -1609,7 +1610,7 @@ function runFloorPlateMigration(
   return { nodes: changed ? nodes : sourceNodes, plateIds, reports }
 }
 
-export function migrateSlabSlots(sourceNodes: Record<string, unknown>) {
+function migrateSlabSlotsOnView(sourceNodes: Record<string, unknown>) {
   const nodes = { ...sourceNodes } as Record<string, AnyNode>
   let changed = false
   for (const node of Object.values(nodes)) {
@@ -1623,3 +1624,14 @@ export function migrateSlabSlots(sourceNodes: Record<string, unknown>) {
   }
   return { nodes: changed ? nodes : sourceNodes, changed }
 }
+
+export const migrateFloorPlates = loadMigration(
+  'floor plates',
+  migrateFloorPlatesOnView,
+  (nodes) => ({ nodes, plateIds: [], reports: [] }),
+)
+
+export const migrateSlabSlots = loadMigration('slab slots', migrateSlabSlotsOnView, (nodes) => ({
+  nodes,
+  changed: false,
+}))
```

---

### Incident Patch 4: `56660909` (2026-09-30)
**Commit Message**: fix(core): legacy scenes with raw nodes load without crashing (#979)

The load migrations added by #976 read stored nodes as if schema-parsed.
The oldest stored scenes omit container fields the schema defaults (walls
without `children`, openings placed by a legacy `offset` with no
`position`), so `plateLevelContext` and `isFloorAnchoredOpening` threw and
both the hosted authority and `setScene` failed to open the project.

Every exported load migration now runs through `loadMigration`: it reads a
view of the stored nodes with container defaults (arrays and empty objects)
filled, never scalars whose absence migrations read, and strips the fills it
carried through untouched so no stored node is rewritten by them. A
migration that still throws is reported and skipped, so the scene loads as
main loaded it instead of failing.

Also: deleting a room re-poses items kept from a curved wall with the curve
tangent at the item, not the wall chord (Bugbot on #976).


Claude-Session: https://claude.ai/code/session_013LKpG6PpZe6Jb4dBBAKtBG

Co-authored-by: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

**File**: `packages/core/src/commands/structure/delete-zone.test.ts` (modified, +47/-0)
```diff
@@ -1,6 +1,7 @@
 import { describe, expect, test } from 'bun:test'
 import { reconcileLevelStructure } from '../../lib/structure-kernel'
 import { ItemNode, SeparatorNode, WallNode, type ZoneNode } from '../../schema'
+import { getWallCurveFrameAt, getWallCurveLength } from '../../systems/wall/wall-curve'
 import { SHARED_WALLS_DELETE_MESSAGE } from './delete-zone'
 import { deleteZone, divideZone, setZoneIntent } from './index'
 import { applyToScratch, type StructureNodes, structureChangeBatch } from './shared'
@@ -240,3 +241,49 @@ describe('deleting a room', () => {
     expect(plan.payload.wallIds.sort()).toEqual(['wall_m0', 'wall_m1', 'wall_m2'])
   })
 })
+
+test('an item kept from a curved wall faces along the curve where it hung', () => {
+  const nodes: Record<string, any> = fixture()
+  const corners: [number, number][] = [
+    [0, 0],
+    [4, 0],
+    [4, 4],
+    [0, 4],
+  ]
+  for (let i = 0; i < 4; i++)
+    nodes[`wall_c${i}`] = WallNode.parse({
+      id: `wall_c${i}`,
+      parentId: 'level_test',
+      start: corners[i],
+      end: corners[(i + 1) % 4],
+      ...(i === 0 ? { curveOffset: -1 } : {}),
+    })
+  const curved = nodes.wall_c0
+  const along = getWallCurveLength(curved) * 0.2
+  nodes.item_shelf = ItemNode.parse({
+    ...chair('item_shelf', 0, 0),
+    parentId: curved.id,
+    position: [along, 1, 0.1],
+    rotation: [0, 0.3, 0],
+  })
+  curved.children = ['item_shelf']
+  let n = 0
+  const graph = applyToScratch(
+    nodes,
+    structureChangeBatch(
+      reconcileLevelStructure({
+        levelId: 'level_test',
+        nodes,
+        mintId: (kind) => `${kind}_c${++n}`,
+      }).patches,
+    ),
+  )
+  const [zone] = zones(graph)
+  const plan = deleteZone(graph, { zoneId: zone!.id, contents: 'keep' })
+  const kept = applyToScratch(graph, structureChangeBatch(plan.changes)).item_shelf as ItemNode
+  const frame = getWallCurveFrameAt(curved, 0.2)
+  expect(kept.parentId).toBe('level_test')
+  expect(kept.rotation[1]).toBeCloseTo(0.3 - Math.atan2(frame.tangent.y, frame.tangent.x), 6)
+  expect(kept.position[0]).toBeCloseTo(frame.point.x + frame.normal.x * 0.1, 6)
+  expect(kept.position[2]).toBeCloseTo(frame.point.y + frame.normal.y * 0.1, 6)
+})
```

**File**: `packages/core/src/commands/structure/delete-zone.ts` (modified, +1/-1)
```diff
@@ -59,7 +59,7 @@ function levelPose(nodes: StructureNodes, item: PositionedIntent, levelId: strin
         position[1],
         frame.point.y + frame.normal.y * position[2],
       ]
-      yaw -= Math.atan2(parent.end[1] - parent.start[1], parent.end[0] - parent.start[0])
+      yaw -= Math.atan2(frame.tangent.y, frame.tangent.x)
     } else if (parent.type === 'ceiling') position[1] += parent.height ?? 2.7
     else if ('position' in parent && Array.isArray(parent.position)) {
       const rotation =
```

**File**: `packages/core/src/utils/ensure-scene-openings.ts` (modified, +8/-1)
```diff
@@ -1,7 +1,8 @@
 import type { AnyNode, AnyNodeId } from '../schema'
 import { syncStairRises } from '../systems/stair/stair-rise-query'
+import { loadMigration } from './load-migration'
 
-export function ensureSceneOpenings(sourceNodes: Record<string, unknown>) {
+function ensureSceneOpeningsOnView(sourceNodes: Record<string, unknown>) {
   let nodes = sourceNodes as Record<string, AnyNode>
   const patches = new Map<AnyNodeId, Partial<AnyNode>>()
   const kinds = new Set(Object.values(nodes).map((node) => node.type))
@@ -27,3 +28,9 @@ export function ensureSceneOpenings(sourceNodes: Record<string, unknown>) {
     updates: [...patches].map(([id, data]) => ({ id, data })),
   }
 }
+
+export const ensureSceneOpenings = loadMigration(
+  'stair and elevator openings',
+  ensureSceneOpeningsOnView,
+  (nodes) => ({ nodes: nodes as Record<string, AnyNode>, changed: false, updates: [] }),
+)
```

**File**: `packages/core/src/utils/floor-opening-migration.ts` (modified, +15/-1)
```diff
@@ -2,6 +2,7 @@ import { adjacentLevelId } from '../lib/floor-opening-intent'
 import { area, intersection, type Ring, union } from '../lib/polygon-boolean'
 import type { AnyNode, CeilingNode, SlabNode } from '../schema'
 import { FloorOpeningNode } from '../schema/nodes/floor-opening'
+import { loadMigration } from './load-migration'
 
 function polygonKey(polygon: Ring) {
   return polygon.map(([x, z]) => [Math.round(x * 10_000), Math.round(z * 10_000)])
@@ -35,7 +36,7 @@ function matchingCeilingHole(nodes: Record<string, unknown>, levelId: string, po
   })
 }
 
-export function migrateFloorOpeningNodes(sourceNodes: Record<string, unknown>) {
+function migrateFloorOpeningNodesOnView(sourceNodes: Record<string, unknown>) {
   let nodes: Record<string, unknown> = sourceNodes
   const groups = new Map<
     string,
@@ -157,3 +158,16 @@ export function migrateFloorOpeningNodes(sourceNodes: Record<string, unknown>) {
   }
   return { nodes, changed: nodes !== sourceNodes, adoptedHoles, created, dedupes, unions }
 }
+
+export const migrateFloorOpeningNodes = loadMigration(
+  'floor openings',
+  migrateFloorOpeningNodesOnView,
+  (nodes) => ({
+    nodes,
+    changed: false,
+    adoptedHoles: 0,
+    created: 0,
+    dedupes: 0,
+    unions: 0,
+  }),
+)
```

**File**: `packages/core/src/utils/floor-plate-migration.ts` (modified, +14/-2)
```diff
@@ -41,6 +41,7 @@ import {
   planFloorPieceAdoption,
 } from './floor-piece-adoption'
 import { legacyWallElevations } from './legacy-wall-datums'
+import { loadMigration } from './load-migration'
 import { omitUndefined } from './omit-undefined'
 
 export type FloorPlateMigrationReport = {
@@ -465,7 +466,7 @@ function clearDanglingFloorSources(nodes: Record<string, AnyNode>) {
 /** A level whose hand-drawn floor pieces cannot be adopted exactly: migrate it without them. */
 class AdoptionRejected extends Error {}
 
-export function migrateFloorPlates(sourceNodes: Record<string, unknown>) {
+function migrateFloorPlatesOnView(sourceNodes: Record<string, unknown>) {
   // Adoption is all-or-nothing per level: a level whose pieces are not all
   // consumed migrates exactly as it would without adoption.
   const skip = new Set<string>()
@@ -1609,7 +1610,7 @@ function runFloorPlateMigration(
   return { nodes: changed ? nodes : sourceNodes, plateIds, reports }
 }
 
-export function migrateSlabSlots(sourceNodes: Record<string, unknown>) {
+function migrateSlabSlotsOnView(sourceNodes: Record<string, unknown>) {
   const nodes = { ...sourceNodes } as Record<string, AnyNode>
   let changed = false
   for (const node of Object.values(nodes)) {
@@ -1623,3 +1624,14 @@ export function migrateSlabSlots(sourceNodes: Record<string, unknown>) {
   }
   return { nodes: changed ? nodes : sourceNodes, changed }
 }
+
+export const migrateFloorPlates = loadMigration(
+  'floor plates',
+  migrateFloorPlatesOnView,
+  (nodes) => ({ nodes, plateIds: [], reports: [] }),
+)
+
+export const migrateSlabSlots = loadMigration('slab slots', migrateSlabSlotsOnView, (nodes) => ({
+  nodes,
+  changed: false,
+}))
```

---

### Incident Patch 5: `d2750dd8` (2026-09-29)
**Commit Message**: test: use self-contained synthetic regression fixtures

**File**: `CHANGELOG.md` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@
 
 ### Breaking
 
-- **`wall.assembly` is now F2 assembly layers** (owner-accepted exception to the additive plugin v1 contract; the WS5 shape shipped days earlier in #937). Walls store `{ layers: [{ id, role, thickness, core?, material?, … }], face?, presetId?, cavityInsulation? }` instead of `{ exterior, sheathing, framing, interior, preset }`. Scenes saved with the old shape are converted on load and at the scene API boundary, so `thickness` and every drawing stay the same. Plugins that read `wall.assembly.exterior` / `.framing` / `.preset` directly should read `wallAssemblyToLegacy(wall.assembly)` (the old shape, or `null` for a stack it cannot express), `wallAssemblyFraming(wall)` or `wallAssemblyExteriorFinish(wall)`; `WALL_ASSEMBLY_PRESETS[i].assembly` is F2 too.
+- **`wall.assembly` is now F2 assembly layers** (breaking change to the additive plugin v1 contract; the WS5 shape shipped days earlier in #937). Walls store `{ layers: [{ id, role, thickness, core?, material?, … }], face?, presetId?, cavityInsulation? }` instead of `{ exterior, sheathing, framing, interior, preset }`. Scenes saved with the old shape are converted on load and at the scene API boundary, so `thickness` and every drawing stay the same. Plugins that read `wall.assembly.exterior` / `.framing` / `.preset` directly should read `wallAssemblyToLegacy(wall.assembly)` (the old shape, or `null` for a stack it cannot express), `wallAssemblyFraming(wall)` or `wallAssemblyExteriorFinish(wall)`; `WALL_ASSEMBLY_PRESETS[i].assembly` is F2 too.
 
 ## 1.0.0 (2026-09-12)
 
```

**File**: `packages/core/src/contracts/assembly.test.ts` (modified, +35/-39)
```diff
@@ -1,12 +1,10 @@
 /**
- * F2 assembly layers, executable examples (plan item WL-01,
- * `editor-fidelity-foundations.md` §2.3).
+ * F2 assembly layers, executable examples.
  *
  * The contract: the schema, the host declarations and the band math. The
  * stack sets the body: a wall's `thickness` is the sum of its layers (WS5's
- * rule, owner ruling 2026-09-27). WL-02 (wall compile) and RL-01 (roof layers)
- * must reproduce these numbers; the benchmark-house fixtures pin the stacking
- * datum against measured source build-ups.
+ * rule). Wall and roof rendering must reproduce these numbers; the fixtures
+ * pin the stacking datum against explicit layer boundaries.
  */
 import { describe, expect, test } from 'bun:test'
 import { z } from 'zod'
@@ -113,7 +111,7 @@ describe('a stucco exterior wall (2×6 frame)', () => {
 })
 
 describe('a shingle roof (covering, underlay, sheathing)', () => {
-  // Thicknesses of the benchmark house source: 9 mm shingles, 1 mm underlay, 5/8 in decking.
+  // The covering, underlay and decking form one contiguous stack.
   const roof = RoofNode.parse({
     id: 'roof_shingle',
     assembly: {
@@ -138,7 +136,7 @@ describe('a shingle roof (covering, underlay, sheathing)', () => {
   })
 
   test('measured along the facet normal: a 40° facet cuts each layer 1/cos(40°) tall', () => {
-    // RL-01 splits the direct path's vertical prism: a layer t thick along the
+    // The direct path splits the vertical prism: a layer t thick along the
     // normal spans t / cos(pitch) of the vertical.
     const stack = resolveAssemblyStack(roof.assembly!, { body: null })
     const vertical = (t: number) => t / Math.cos((40 * Math.PI) / 180)
@@ -297,12 +295,10 @@ describe('layer provenance is content (R3, R9)', () => {
 })
 
 /**
- * Build-ups measured on two exterior walls of the benchmark house source
- * (material assemblies and structural study), as faces in metres from the
- * exterior face. Wall ids and absolute coordinates are withheld (owner decision
- * D5); in both walls the interior side is the Pascal front (+n) face.
+ * Synthetic wall build-ups expressed as layer boundaries in metres from the
+ * exterior face. In both walls the interior side is the Pascal front (+n) face.
  */
-describe('benchmark-house fixtures', () => {
+describe('wall layer boundary fixtures', () => {
   type Measured = { id: string; role: AssemblyLayer['role']; from: number; to: number }
   const fromMeasured = (measured: Measured[], core: string): Assembly => ({
     layers: [...measured].reverse().map(({ id, role, from, to }) => ({
@@ -314,62 +310,62 @@ describe('benchmark-house fixtures', () => {
     })),
   })
 
-  test('timber weather wall: stucco, membrane, sheathing, studs, lining (203.2 mm)', () => {
+  test('timber weather wall: stucco, membrane, sheathing, studs, lining (200 mm)', () => {
     const measured: Measured[] = [
-      { id: 'outside-finish', role: 'finish', from: 0, to: 0.0127 },
-      { id: 'finish-gap', role: 'air', from: 0.0127, to: 0.04345 },
-      { id: 'weather-barrier', role: 'membrane', from: 0.04345, to: 0.04445 },
-      { id: 'sheathing', role: 'sheathing', from: 0.04445, to: 0.05715 },
-      { id: 'studs', role: 'structure', from: 0.05715, to: 0.14605 },
-      { id: 'cavity', role: 'air', from: 0.14605, to: 0.1905 },
-      { id: 'lining', role: 'lining', from: 0.1905, to: 0.2032 },
+      { id: 'outside-finish', role: 'finish', from: 0, to: 0.01 },
+      { id: 'finish-gap', role: 'air', from: 0.01, to: 0.039 },
+      { id: 'weather-barrier', role: 'membrane', from: 0.039, to: 0.04 },
+      { id: 'sheathing', role: 'sheathing', from: 0.04, to: 0.05 },
+      { id: 'studs', role: 'structure', from: 0.05, to: 0.15 },
+      { id: 'cavity', role: 'air', from: 0.15, to: 0.19 },
+      { id: 'lining', role: 'lining', from: 0.19, to: 0.2 },
     ]
     const wall = WallNode.parse({
       id: 'wall_timber',
       start: [0, 0],
-      end: [4.4704, 0],
-      thickness: 0.2032,
+     
```

**File**: `packages/core/src/schema/assembly.ts` (modified, +11/-13)
```diff
@@ -2,22 +2,20 @@ import { z } from 'zod'
 import { SourceRefString } from './source-ref'
 
 /**
- * Assembly layers (F2, `editor-fidelity-foundations.md` §2.3), frozen by plan
- * item WL-01. A host kind that declares `capabilities.assembly` stores one
- * optional `assembly` field. Roofs take it here; walls move onto it from the
- * WS5 `WallAssembly` in the follow-up migration. Nothing renders it yet, and a
- * node without it keeps today's geometry byte for byte.
+ * Assembly layers (F2). Wall and roof kinds that declare `capabilities.assembly`
+ * store one optional `assembly` field. Saved WS5 wall assemblies migrate to this
+ * shape, and wall readers and renderers consume it. Nodes without an assembly
+ * keep their existing geometry.
  *
- * The stack sets the body (owner ruling 2026-09-27, WS5's rule): a host's
- * thickness is the sum of its body layers, and a writer that edits the layers
- * writes that sum to the host's thickness field in the same patch. Body
- * layers run from the host's reference face inward (walls: the front face, +n,
- * or the exterior face with `face: 'exterior'`; roofs: the covering-top
- * plane). Thickness is measured along the host's `measure` axis. The
- * generators of §2.4 (F3) join this object when F3 lands.
+ * The stack sets the body (the WS5 rule): a host's thickness is the sum of its
+ * body layers, and a writer that edits the layers writes that sum to the host's
+ * thickness field in the same patch. Body layers run from the host's reference
+ * face inward (walls: the front face, +n, or the exterior face with
+ * `face: 'exterior'`; roofs: the covering-top plane). Thickness is measured
+ * along the host's `measure` axis.
  *
  * Thickness, preset ids and cavity notes keep WS5's unbounded valid values
- * so migration never rejects or truncates a saved wall (owner ruling 2026-09-29).
+ * so migration never rejects or truncates a saved wall.
  */
 
 export const LayerRole = z.enum([
```

**File**: `packages/core/src/systems/wall/wall-assembly.ts` (modified, +1/-1)
```diff
@@ -174,7 +174,7 @@ export function isLegacyWallAssembly(value: unknown): value is WallAssembly {
 }
 
 /**
- * A WS5 `WallAssembly` as F2 layers (owner ruling 2026-09-27): exterior →
+ * A WS5 `WallAssembly` as F2 layers: exterior →
  * `finish`, sheathing → `sheathing`, framing → the `core` structure layer,
  * interior → `lining`, listed from the exterior face (`face: 'exterior'`) so the
  * stack keeps following the outside when rooms are re-detected. A brick
```

**File**: `packages/core/src/utils/__fixtures__/ws5-architect-walls.json` (removed, +0/-1590)
```diff
@@ -1,1590 +0,0 @@
-{
- "source": "Architect plugin-generate buildHouse(POPPY) and its cmu wall system, plus WS5 inspector writes (brick custom, partition, CMU furred), all produced by editor b53a907b7 (#937)",
- "nodes": {
-  "level_ground": {
-   "object": "node",
-   "id": "level_ground",
-   "type": "level",
-   "parentId": null,
-   "visible": true,
-   "metadata": {},
-   "level": 0,
-   "children": [
-    "wall_ppm4imc2bjedqtux",
-    "wall_3xv3hyxg95ltskqp",
-    "wall_s4841w5qerwa56ld",
-    "wall_2eoxuz6bf9c7ycgk",
-    "wall_9kjd474uctb73k53",
-    "wall_8oek696jtqeofwat",
-    "wall_krqppvgieyttgxsv",
-    "wall_muf1hmgrqtqtqt4n",
-    "wall_ky88k7buxt07vktc",
-    "wall_92ur46ldm6yjsjmk",
-    "wall_t1zatbouicg1g94t",
-    "wall_fjk67tw30rqyumpf",
-    "wall_ykrpgvdk26bl16y1",
-    "wall_x53ke6u8l4mmuxug_cmu",
-    "wall_fwntw72bmkctvghn_cmu",
-    "wall_4dt4b9o4f2hsp6cf_cmu",
-    "wall_7ic0eil9273fk87u_cmu",
-    "wall_v9n9c2hwvkiq34i4_cmu",
-    "wall_52kzscr7wn9n417f_cmu",
-    "wall_mxchrqtirzj7912d_cmu",
-    "wall_dl6tehrz0epx9y9u_cmu",
-    "wall_c4pmkhxbaqd3ahgo_cmu",
-    "wall_kgjg0752h9m0r0md_cmu",
-    "wall_5c0i43n9og73goyf_cmu",
-    "wall_e39nvj4nat5rcfw1_cmu",
-    "wall_odes3s61q6mw0qzz_cmu",
-    "wall_north",
-    "wall_east",
-    "wall_south",
-    "wall_west",
-    "wall_partition",
-    "wall_cmu",
-    "wall_plain"
-   ]
-  },
-  "wall_ppm4imc2bjedqtux": {
-   "id": "wall_ppm4imc2bjedqtux",
-   "type": "wall",
-   "name": "Exterior wall",
-   "parentId": "level_ground",
-   "start": [
-    -3.6576,
-    -5.0292
-   ],
-   "end": [
-    3.6576,
-    -5.0292
-   ],
-   "thickness": 0.182562,
-   "assembly": {
-    "preset": "exterior-2x6-siding",
-    "exterior": {
-     "finish": "siding",
-     "thickness": 0.019049999999999997
-    },
-    "sheathing": {
-     "material": "osb",
-     "thickness": 0.011112499999999999
-    },
-    "framing": {
-     "kind": "wood",
-     "depth": 0.1397
-    },
-    "interior": {
-     "finish": "drywall",
-     "thickness": 0.0127
-    },
-    "cavityInsulation": "batt, R per climate zone (IRC N1102.1.3)"
-   },
-   "frontSide": "interior",
-   "backSide": "exterior",
-   "metadata": {
-    "generatedBy": "pascal:generate",
-    "wallType": "ext2x6",
-    "role": "exterior",
-    "rooms": [
-     "LIVING"
-    ],
-    "roof": {
-     "role": "gable-end"
-    }
-   },
-   "fillToTerrain": true,
-   "underpinning": {
-    "rim": 0,
-    "stem": 0.3556
-   },
-   "slots": {
-    "exterior": "library:siding-lap-nearblack",
-    "interior": "library:preset-lightgrey"
-   },
-   "object": "node",
-   "visible": true,
-   "children": []
-  },
-  "wall_3xv3hyxg95ltskqp": {
-   "id": "wall_3xv3hyxg95ltskqp",
-   "type": "wall",
-   "name": "LIVING + BATH",
-   "parentId": "level_ground",
-   "start": [
-    -3.6576,
-    -0.762
-   ],
-   "end": [
-    -1.524,
-    -0.762
-   ],
-   "thickness": 0.1143,
-   "assembly": {
-    "preset": "interior-2x4-drywall",
-    "framing": {
-     "kind": "wood",
-     "depth": 0.08889999999999999
-    },
-    "interior": {
-     "finish": "drywall",
-     "thickness": 0.0127
-    }
-   },
-   "frontSide": "unknown",
-   "backSide": "unknown",
-   "metadata": {
-    "generatedBy": "pascal:generate",
-    "wallType": "int2x4",
-    "role": "partition",
-    "rooms": [
-     "LIVING",
-     "BATH"
-    ]
-   },
-   "slots": {
-    "interior": "library:preset-lightgrey",
-    "exterior": "library:preset-lightgrey"
-   },
-   "object": "node",
-   "visible": true,
-   "children": []
-  },
-  "wall_s4841w5qerwa56ld": {
-   "id": "wall_s4841w5qerwa56ld",
-   "type": "wall",
-   "name": "BATH + BEDROOM 1",
-   "parentId": "level_ground",
-   "start": [
-    -3.6576,
-    1.6764
-   ],
-   "end": [
-    -1.524,
-    1.6764
-   ],
-   "thickness": 0.1143,
-   "assembly": {
-    "preset": "interior-2x4-drywall",
-    "framing": {
-     "kind": "wood",
-     "depth": 0.08889999999999999
-    },
-    "interior": {
-     "finish": "drywall"
```

---

### Incident Patch 6: `15bcb5c7` (2026-09-29)
**Commit Message**: fix(editor): retain adopted drafts through rejected commits

**File**: `packages/core/src/index.ts` (modified, +1/-0)
```diff
@@ -351,6 +351,7 @@ export {
   type SceneSnapshot,
   subscribeSceneCommits,
 } from './store/history-control'
+export { withSceneHistoryDraftSuspended } from './store/history-drafts'
 export { getHistoryDirtyNodeIds } from './store/history-invalidation'
 export {
   type ControlValue,
```

**File**: `packages/editor/src/components/tools/item/use-draft-node.test.tsx` (modified, +108/-0)
```diff
@@ -4,6 +4,7 @@ import {
   applySceneSnapshot,
   BlockNode,
   BuildingNode,
+  beginSceneHistoryPauseSession,
   getBlockFaceFrame,
   getSceneHistoryPauseDepth,
   ItemNode,
@@ -81,6 +82,113 @@ beforeEach(() => {
 })
 
 describe('useDraftNode block face commit', () => {
+  test.each(
+    (['parse', 'write'] as const).flatMap((failure) =>
+      (['retry', 'cancel', 'foreign move then cancel'] as const).map((finish) => ({
+        failure,
+        finish,
+      })),
+    ),
+  )('an adopted $failure rejection retains owned history through $finish', ({
+    failure,
+    finish,
+  }) => {
+    const item = ItemNode.parse({
+      parentId: LEVEL_ID,
+      position: [1, 0, 1],
+      asset: { id: 'box', name: 'Box', category: 'decor', thumbnail: '', src: '/box.glb' },
+    })
+    useScene.getState().createNode(item, LEVEL_ID as AnyNodeId)
+    useScene.temporal.getState().clear()
+    const originalNodes = structuredClone(useScene.getState().nodes)
+    const draft = draftNode!
+    draft.adopt(item)
+    draft.updateSurface({ position: [2, 0, 2] }, null)
+    const commit = (position: ItemNode['position']) => {
+      const drop = beginSceneHistoryPauseSession(useScene, { gesture: item.id })
+      try {
+        return drop.commitStep(() => draft.commit({ parentId: LEVEL_ID, position }))
+      } finally {
+        drop.end()
+      }
+    }
+    const updateNodes = useScene.getState().updateNodes
+    try {
+      if (failure === 'write') {
+        useScene.setState({
+          updateNodes: (updates) => {
+            if (
+              useScene.temporal.getState().isTracking &&
+              updates.some(
+                (update) =>
+                  update.id === item.id &&
+                  'position' in update.data &&
+                  update.data.position?.[0] === 3,
+              )
+            ) {
+              throw new Error('Rejected tracked write before publication')
+            }
+            return updateNodes(updates)
+          },
+        })
+      }
+      expect(() => commit(failure === 'parse' ? [Number.NaN, 0, 3] : [3, 0, 3])).toThrow()
+      useScene.setState({ updateNodes })
+      expect(draft.current?.id).toBe(item.id)
+      expect(useScene.getState().nodes).toEqual(originalNodes)
+      expect(useScene.temporal.getState().pastStates).toHaveLength(0)
+      expect(useScene.temporal.getState().isTracking).toBe(true)
+      expect(getSceneHistoryPauseDepth()).toBe(0)
+
+      draft.updateSurface({ position: [4, 0, 4] }, null)
+      useScene.getState().updateNode(item.id, { name: 'Foreign rename' })
+      expect(useScene.temporal.getState().pastStates).toHaveLength(1)
+      expect(useScene.temporal.getState().pastStates[0]?.nodes).toEqual(originalNodes)
+      const renamedNodes = {
+        ...originalNodes,
+        [item.id]: { ...originalNodes[item.id]!, name: 'Foreign rename' },
+      }
+
+      if (finish === 'retry') {
+        expect(commit([5, 0, 5])).toBe(item.id)
+        expect(draft.current).toBeNull()
+        const committedNodes = structuredClone(useScene.getState().nodes)
+        expect(committedNodes[item.id]).toMatchObject({
+          name: 'Foreign rename',
+          position: [5, 0, 5],
+        })
+        expect(useScene.temporal.getState().pastStates).toHaveLength(2)
+        useScene.temporal.getState().undo()
+        expect(useScene.getState().nodes).toEqual(renamedNodes)
+        useScene.temporal.getState().redo()
+        expect(useScene.getState().nodes).toEqual(committedNodes)
+      } else if (finish === 'cancel') {
+        draft.destroy()
+        expect(useScene.getState().nodes).toEqual(renamedNodes)
+        expect(useScene.temporal.getState().pastStates).toHaveLength(1)
+        useScene.temporal.getState().undo()
+        expect(useScene.getState().nodes).toEqual(originalNodes)
+        useScene.temporal.getState().redo()
+        expect(useScene.getState().nodes).toEqual(renamedNodes)
+      } else {
+        useScene.getState().updateN
```

**File**: `packages/editor/src/components/tools/item/use-draft-node.ts` (modified, +37/-31)
```diff
@@ -9,6 +9,7 @@ import {
   sceneHistoryDraftRevertUpdates,
   sceneRegistry,
   useScene,
+  withSceneHistoryDraftSuspended,
 } from '@pascal-app/core'
 import { beginPerfAction, commitPerfAction, useViewer } from '@pascal-app/viewer'
 import { useCallback, useMemo, useRef } from 'react'
@@ -127,8 +128,8 @@ export interface DraftNodeHandle {
  * The draft is registered with core's history drafts from create/adopt until
  * commit/destroy, so history records it as absent (created) or as it was
  * (adopted) and no draft write becomes an undo step; the draft's own writes
- * also run under a short balanced pause. `commit` ends the registration right
- * before its one tracked write.
+ * also run under a short balanced pause. An adopted `commit` suspends the registration for
+ * its tracked write and ends it only after success, so a rejected drop can still be retried.
  *
  * Supports two modes:
  * - Create mode (via `create()`): draft is a new transient node. Commit = delete+recreate (undo removes node).
@@ -300,41 +301,42 @@ export function useDraftNode(): DraftNodeHandle {
 
         // The original is restored above (a carry write), so the one tracked write below has
         // the true baseline as its undo state.
-        releaseHistoryDraft(endHistoryDraftRef)
-
         const effectiveNode = ItemNode.parse({
           ...draft,
           ...updateProps,
           parentId,
           metadata: updateProps.metadata ?? stripTransient(draft.metadata),
         })
 
-        updateSurfaceNode(
-          draft.id,
-          {
-            position: updateProps.position ?? draft.position,
-            rotation: updateProps.rotation ?? draft.rotation,
-            side: updateProps.side ?? draft.side,
-            metadata: updateProps.metadata ?? stripTransient(draft.metadata),
-            parentId: parentId as string,
-            // Forward the roof host explicitly: strategies set it on every
-            // commit (segment id on a roof face, undefined elsewhere), and
-            // dropping it here strands the item in the roof frame without
-            // the segment transform.
-            roofSegmentId: updateProps.roofSegmentId,
-            roofFace: updateProps.roofFace,
-            blockFaceId: updateProps.blockFaceId,
-            // Only when the strategy decided about wallId (roof commits clear
-            // it) — floor/ceiling commits never managed the field.
-            ...('wallId' in updateProps ? { wallId: updateProps.wallId } : {}),
-            ...resolveSupportSlabPatch(effectiveNode, useScene.getState().nodes, {
-              maxElevation: options?.supportElevationCap,
-              preferredSlabId: options?.preferredSupportSlabId,
-              pinSupport: options?.pinSupport,
-            }),
-          },
-          surfaceId,
-        )
+        withSceneHistoryDraftSuspended(draft.id, () => {
+          updateSurfaceNode(
+            draft.id,
+            {
+              position: updateProps.position ?? draft.position,
+              rotation: updateProps.rotation ?? draft.rotation,
+              side: updateProps.side ?? draft.side,
+              metadata: updateProps.metadata ?? stripTransient(draft.metadata),
+              parentId: parentId as string,
+              // Forward the roof host explicitly: strategies set it on every
+              // commit (segment id on a roof face, undefined elsewhere), and
+              // dropping it here strands the item in the roof frame without
+              // the segment transform.
+              roofSegmentId: updateProps.roofSegmentId,
+              roofFace: updateProps.roofFace,
+              blockFaceId: updateProps.blockFaceId,
+              // Only when the strategy decided about wallId (roof commits clear
+              // it) — floor/ceiling commits never managed the field.
+              ...('wallId' in updateProps ? { wallId: updateProps.wallId } : {}),
+              ...resolveSupportSlabPatch(effectiveNode, useScene.g
```

---

### Incident Patch 7: `d4a2730e` (2026-09-29)
**Commit Message**: Merge pull request #969 from pascalorg/fix/story-shell-wall-sides-20260920

fix(mcp): create_story_shell picks the wall exterior side from the footprint winding

**File**: `packages/mcp/src/tools/construction-tools.test.ts` (modified, +95/-1)
```diff
@@ -2,11 +2,50 @@ import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
 import { Client } from '@modelcontextprotocol/sdk/client/index.js'
 import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
 import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
-import { LevelNode } from '@pascal-app/core/schema'
+import { type AnyNodeId, LevelNode } from '@pascal-app/core/schema'
 import { SceneBridge } from '../bridge/scene-bridge'
 import { registerConstructionTools } from './construction-tools'
+import { pointInPolygon, type Vec2 } from './geometry'
 import { registerSceneQueryTools } from './scene-query'
 
+const concaveFootprint: Vec2[] = [
+  [0, 0],
+  [6, 0],
+  [6, 2],
+  [2, 2],
+  [2, 6],
+  [0, 6],
+]
+
+const shellFootprints: Array<{ name: string; points: Vec2[] }> = [
+  {
+    name: 'rectangular',
+    points: [
+      [-4, -3],
+      [4, -3],
+      [4, 3],
+      [-4, 3],
+    ],
+  },
+  { name: 'concave', points: concaveFootprint },
+  {
+    name: 'narrow',
+    points: [
+      [0, 0],
+      [6, 0],
+      [6, 0.1],
+      [0, 0.1],
+    ],
+  },
+  {
+    name: 'rotated concave with shifted start and large coordinates',
+    points: [...concaveFootprint.slice(3), ...concaveFootprint.slice(0, 3)].map(([x, z]) => [
+      1e9 + x * Math.cos(Math.PI / 7) - z * Math.sin(Math.PI / 7),
+      -1e9 + x * Math.sin(Math.PI / 7) + z * Math.cos(Math.PI / 7),
+    ]),
+  },
+]
+
 describe('construction tools', () => {
   let client: Client
   let server: McpServer
@@ -29,6 +68,61 @@ describe('construction tools', () => {
     await server.close()
   })
 
+  for (const { name, points } of shellFootprints) {
+    for (const winding of ['counterclockwise', 'clockwise'] as const) {
+      test(`create_story_shell classifies ${winding} ${name} walls without reordering edges`, async () => {
+        const level = Object.values(bridge.getNodes()).find((node) => node.type === 'level')!
+        const footprint = winding === 'counterclockwise' ? points : [...points].reverse()
+        const result = await client.callTool({
+          name: 'create_story_shell',
+          arguments: { levelId: level.id, footprint, namePrefix: 'Perimeter', wallThickness: 0.02 },
+        })
+        expect(result.isError).toBeFalsy()
+        const parsed = JSON.parse(
+          (result.content as Array<{ type: string; text: string }>)[0]!.text,
+        )
+        expect(parsed.wallIds).toHaveLength(footprint.length)
+
+        for (const [index, wallId] of (parsed.wallIds as AnyNodeId[]).entries()) {
+          const wall = bridge.getNode(wallId)
+          expect(wall?.type).toBe('wall')
+          if (wall?.type !== 'wall') throw new Error('Expected perimeter wall')
+          expect(wall.parentId).toBe(level.id)
+          expect(wall.name).toBe(`Perimeter Wall ${index + 1}`)
+          expect(wall.start).toEqual(footprint[index]!)
+          expect(wall.end).toEqual(footprint[(index + 1) % footprint.length]!)
+          expect(wall.frontSide).toBe(winding === 'counterclockwise' ? 'interior' : 'exterior')
+          expect(wall.backSide).toBe(winding === 'counterclockwise' ? 'exterior' : 'interior')
+
+          const dx = wall.end[0] - wall.start[0]
+          const dz = wall.end[1] - wall.start[1]
+          const length = Math.hypot(dx, dz)
+          const midpoint: Vec2 = [
+            (wall.start[0] + wall.end[0]) / 2,
+            (wall.start[1] + wall.end[1]) / 2,
+          ]
+          const frontPoint: Vec2 = [
+            midpoint[0] - (dz / length) * 0.01,
+            midpoint[1] + (dx / length) * 0.01,
+          ]
+          const backPoint: Vec2 = [
+            midpoint[0] + (dz / length) * 0.01,
+            midpoint[1] - (dx / length) * 0.01,
+          ]
+          expect(pointInPolygon(frontPoint, footprint, false)).toBe(wall.frontSide === 'interior')
+          expect(pointInPolygon(backPoint, footprint, false)).toBe(wall.backSide === 'interior')
+        }
+
+        c
```

**File**: `packages/mcp/src/tools/construction-tools.ts` (modified, +14/-2)
```diff
@@ -283,6 +283,18 @@ export function registerConstructionTools(server: McpServer, bridge: SceneOperat
         )
       }
       const points = footprint as [number, number][]
+      // Wall-local +Z faces left, so a counterclockwise ring has its interior at the front.
+      // Anchor the area calculation to keep the classification stable far from the origin.
+      const [originX, originZ] = points[0]!
+      let signedDoubleArea = 0
+      for (let i = 1; i < points.length - 1; i++) {
+        const current = points[i]!
+        const next = points[i + 1]!
+        signedDoubleArea +=
+          (current[0] - originX) * (next[1] - originZ) -
+          (next[0] - originX) * (current[1] - originZ)
+      }
+      const frontIsInterior = signedDoubleArea > 0
       const wallIds: string[] = []
       const patches: Array<{ op: 'create'; node: AnyNode; parentId: AnyNodeId }> = []
 
@@ -293,8 +305,8 @@ export function registerConstructionTools(server: McpServer, bridge: SceneOperat
           end: points[(i + 1) % points.length],
           thickness: wallThickness,
           ...(wallHeight !== undefined ? { height: wallHeight } : {}),
-          frontSide: 'exterior',
-          backSide: 'interior',
+          frontSide: frontIsInterior ? 'interior' : 'exterior',
+          backSide: frontIsInterior ? 'exterior' : 'interior',
           ...(wallMaterialPreset ? { materialPreset: wallMaterialPreset } : {}),
           metadata: { role: 'exterior', storyShell: true },
         })
```

---

### Incident Patch 8: `70b7540b` (2026-09-29)
**Commit Message**: fix(core): clear lost face bindings during draft history fallback

**File**: `packages/core/src/store/history-drafts.ts` (modified, +10/-2)
```diff
@@ -48,6 +48,8 @@ const sceneHistoryDrafts = new Map<AnyNodeId, SceneHistoryDraft>()
 
 type NodeMap = Record<AnyNodeId, AnyNode>
 
+const faceHostFields = ['roofSegmentId', 'roofFace', 'blockFaceId']
+
 const childIdsOf = (node: AnyNode | undefined): AnyNodeId[] =>
   node && 'children' in node && Array.isArray(node.children) ? (node.children as AnyNodeId[]) : []
 const attachmentsOf = (node: AnyNode | undefined): Record<string, unknown> | undefined =>
@@ -394,8 +396,10 @@ export function withDraftsRestored(before: NodeMap, after: NodeMap): NodeMap | n
       if (held.length === 0) continue
       result ??= { ...after }
       const restored = { ...jumped } as Record<string, unknown>
+      const lostParent = live.parentId && !result[live.parentId as AnyNodeId]
       for (const key of held) {
-        if (key === 'parentId' && values[key] && !result[values[key] as AnyNodeId]) continue
+        // A missing host's binding must not replace the jumped-to parent's valid binding.
+        if (lostParent && (key === 'parentId' || faceHostFields.includes(key))) continue
         const heldKeys = heldEntries.get(key)?.heldKeys
         if (heldKeys) {
           const metadata = { ...(restored[key] as Record<string, unknown>) }
@@ -438,7 +442,11 @@ export function withDraftsRestored(before: NodeMap, after: NodeMap): NodeMap | n
       visited.add(parentId)
       parentId = before[parentId]?.parentId as AnyNodeId | undefined
     }
-    if (parentId !== live.parentId) result[id] = { ...live, parentId: parentId ?? null }
+    if (parentId !== live.parentId) {
+      const restored = { ...live, parentId: parentId ?? null } as Record<string, unknown>
+      for (const key of faceHostFields) delete restored[key]
+      result[id] = restored as AnyNode
+    }
     const previousParentId = after[id]?.parentId as AnyNodeId | undefined
     const beforeParent = parentId ? before[parentId] : undefined
     placeChild(
```

**File**: `packages/nodes/src/item/floorplan-move-history.test.tsx` (modified, +138/-0)
```diff
@@ -3,6 +3,7 @@ import {
   type AnyNode,
   type AnyNodeId,
   applySceneSnapshot,
+  BlockNode,
   CeilingNode,
   clearSceneHistory,
   emitter,
@@ -14,6 +15,8 @@ import {
   nodeRegistry,
   nodeType,
   objectId,
+  RoofNode,
+  RoofSegmentNode,
   registerNode,
   type SceneCommit,
   ShelfNode,
@@ -188,6 +191,141 @@ async function mountStagedMove(
   return node.id
 }
 
+describe('carried face-host history fallback', () => {
+  const fields = (host: BlockNode | RoofSegmentNode, alternate = false): Partial<ItemNode> =>
+    host.type === 'roof-segment'
+      ? { roofSegmentId: host.id, roofFace: alternate ? 'back' : 'front' }
+      : { blockFaceId: alternate ? 'f-top' : 'f-front' }
+  const makeHost = (kind: 'roof' | 'block', parentId: AnyNodeId) =>
+    kind === 'roof' ? RoofSegmentNode.parse({ parentId }) : BlockNode.parse({ parentId })
+  const makeParent = (kind: 'roof' | 'block'): AnyNodeId => {
+    if (kind === 'block') return LEVEL_ID
+    const roof = RoofNode.parse({ parentId: LEVEL_ID })
+    useScene.getState().createNode(roof, LEVEL_ID)
+    return roof.id
+  }
+  const adopt = (node: ItemNode) => {
+    let draft!: DraftNodeHandle
+    function Harness() {
+      draft = useDraftNode()
+      return null
+    }
+    renderToString(<Harness />)
+    draft.adopt(node)
+    return draft
+  }
+
+  for (const kind of ['roof', 'block'] as const) {
+    for (const fresh of [false, true]) {
+      test(`undoing a ${kind} host clears its carried binding before cancellation (fresh=${fresh})`, () => {
+        const parentId = makeParent(kind)
+        clearSceneHistory()
+        const host = makeHost(kind, parentId)
+        const carried = fresh
+          ? ItemNode.parse({
+              parentId: host.id,
+              asset: item.asset,
+              metadata: { isNew: true },
+              ...fields(host),
+            })
+          : (useScene.getState().nodes[ITEM_ID] as ItemNode)
+        let draft = fresh ? null : adopt(carried)
+        useScene.getState().createNode(host, parentId)
+        if (fresh) {
+          useScene.getState().createNode(carried, host.id)
+          draft = adopt(carried)
+        } else {
+          draft!.updateSurface({ parentId: host.id, position: [0.5, 0, 0], ...fields(host) }, null)
+        }
+        expect(useScene.temporal.getState().pastStates).toHaveLength(1)
+        useScene.temporal.getState().undo()
+        const fallback = fresh ? parentId : LEVEL_ID
+        const assertFallback = () => {
+          const restored = useScene.getState().nodes[carried.id] as ItemNode
+          expect(restored.parentId).toBe(fallback)
+          expect(useScene.getState().nodes[fallback]!.children).toContain(carried.id)
+          expect(restored.roofSegmentId).toBeUndefined()
+          expect(restored.roofFace).toBeUndefined()
+          expect(restored.blockFaceId).toBeUndefined()
+        }
+        expect(useScene.getState().nodes[host.id]).toBeUndefined()
+        assertFallback()
+        expect(useScene.temporal.getState().pastStates).toHaveLength(0)
+        expect(useScene.temporal.getState().futureStates).toHaveLength(1)
+        useScene.temporal.getState().redo()
+        expect(useScene.getState().nodes[host.id]).toBeDefined()
+        assertFallback()
+        useScene.temporal.getState().undo()
+        draft!.destroy()
+        assertFallback()
+        expect(useScene.temporal.getState().pastStates).toHaveLength(0)
+        expect(getSceneHistoryPauseDepth()).toBe(0)
+      })
+    }
+
+    test(`undoing a new ${kind} host preserves the adopted item's surviving host binding`, () => {
+      const parentId = makeParent(kind)
+      const original = makeHost(kind, parentId)
+      const target = makeHost(kind, parentId)
+      useScene.getState().createNode(original, parentId)
+      useScene.getState().updateNode(ITEM_ID, { parentId: original.id, ...fields(original) })
+      clearSceneHistory()
+      const draft = adopt(useScene.getState().nodes[ITEM_ID] as
```

---

### Incident Patch 9: `cd363b4c` (2026-09-29)
**Commit Message**: fix(editor): retain move ownership after a rejected drop

**File**: `packages/editor/src/components/editor-2d/floorplan-registry-move-overlay.tsx` (modified, +3/-3)
```diff
@@ -188,13 +188,13 @@ export function FloorplanRegistryMoveOverlay() {
           if (updates.length > 0) useScene.getState().updateNodes(updates)
         })
       const recordDrop = (write: () => void) => {
-        // The drop decides committed-ness: a co-holder's cleanup must not revert it.
-        settleSceneHistoryDrafts(session.affectedIds)
-        endDrafts()
         const drop = beginSceneHistoryPauseSession(useScene, { gesture: movingNode.id })
         try {
           // The move's write and its transient cleanup are one undo entry and one commit.
           drop.commitStep(() => runAsSingleSceneHistoryStep(useScene, write))
+          // Only a successful drop ends ownership; a rejected write can still be retried.
+          settleSceneHistoryDrafts(session.affectedIds)
+          endDrafts()
         } finally {
           drop.end()
         }
```

**File**: `packages/nodes/src/item/floorplan-move-history.test.tsx` (modified, +87/-1)
```diff
@@ -1,4 +1,4 @@
-import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
+import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
 import {
   type AnyNode,
   type AnyNodeId,
@@ -353,6 +353,92 @@ describe('2D item move history', () => {
     expect(useEditor.getState().movingNodeOrigin).toBe('2d')
   })
 
+  test.each([
+    [SlabNode, slabDefinition],
+    [CeilingNode, ceilingDefinition],
+    [ZoneNode, zoneDefinition],
+  ] as const)('a rejected polygon drop retains ownership for an undoable retry (%s)', async (schema, definition) => {
+    if (!nodeRegistry.get(definition.type)) registerNode(definition)
+    const polygon = [
+      [6, 6],
+      [8, 6],
+      [8, 8],
+      [6, 8],
+    ]
+    const node = schema.parse({
+      name: 'Moved polygon',
+      parentId: LEVEL_ID,
+      polygon,
+      autoFromWalls: false,
+    })
+    useScene.getState().createNode(node, LEVEL_ID)
+    clearSceneHistory()
+    const before = useScene.getState().nodes
+    const listeners = spyOn(window, 'addEventListener')
+    useEditor.getState().setMovingNode(node)
+    await act(async () => {
+      renderer = await create(<FloorplanRegistryMoveOverlay />)
+    })
+    const release = listeners.mock.calls.filter(([type]) => type === 'pointerup').at(-1)![1] as (
+      event: PointerEvent,
+    ) => void
+    listeners.mockRestore()
+    await pointer('pointermove', 7, 7)
+    await pointer('pointermove', 9, 9)
+
+    const updateNodes = useScene.getState().updateNodes
+    const fault = new Error('Commit write rejected before publication')
+    const writes = spyOn(useScene.getState(), 'updateNodes').mockImplementation((updates) => {
+      if (useScene.temporal.getState().isTracking && updates.some(({ id }) => id === node.id)) {
+        throw fault
+      }
+      return updateNodes(updates)
+    })
+    let caught: unknown
+    try {
+      await act(async () => {
+        try {
+          // Invoke the actual mounted handler so EventTarget cannot defer the exception.
+          release({ button: 0, clientX: 9, clientY: 9 } as PointerEvent)
+        } catch (error) {
+          caught = error
+        }
+      })
+    } finally {
+      writes.mockRestore()
+      useScene.setState({ updateNodes })
+    }
+    expect(caught).toBe(fault)
+    expect(useScene.getState().nodes).toEqual(before)
+    expect(useScene.temporal.getState().pastStates).toHaveLength(0)
+    expect(getSceneHistoryPauseDepth()).toBe(0)
+    expect(useScene.temporal.getState().isTracking).toBe(true)
+
+    useScene.getState().updateNode(node.id, { name: 'Renamed while retrying' })
+    expect(useScene.temporal.getState().pastStates).toHaveLength(1)
+    await pointer('pointermove', 10, 10)
+    await pointer('pointerup', 10, 10)
+    await new Promise((resolve) => setTimeout(resolve, 0))
+    expect(useScene.getState().nodes[node.id]).toMatchObject({
+      name: 'Renamed while retrying',
+      polygon: [
+        [9, 9],
+        [11, 9],
+        [11, 11],
+        [9, 11],
+      ],
+    })
+    expect(useScene.temporal.getState().pastStates).toHaveLength(2)
+    const committed = useScene.getState().nodes
+    useScene.temporal.getState().undo()
+    expect(useScene.getState().nodes).toEqual({
+      ...before,
+      [node.id]: { ...before[node.id], name: 'Renamed while retrying' },
+    })
+    useScene.temporal.getState().redo()
+    expect(useScene.getState().nodes).toEqual(committed)
+  })
+
   test.each([
     [SlabNode, slabDefinition],
     [CeilingNode, ceilingDefinition],
```

---

### Incident Patch 10: `78d2b0af` (2026-09-29)
**Commit Message**: fix(editor): release duplicate creation pause before mover handoff

**File**: `packages/editor/src/components/editor/floating-action-menu.tsx` (modified, +149/-151)
```diff
@@ -25,6 +25,7 @@ import {
   nodeRegistry,
   RoofSegmentNode,
   runAsSingleSceneHistoryStep,
+  runSceneHistoryDraftWrite,
   type SlabNode,
   SpawnNode,
   StairSegmentNode,
@@ -521,169 +522,166 @@ export function FloatingActionMenu() {
         return
       }
 
-      useScene.temporal.getState().pause()
+      runSceneHistoryDraftWrite(() => {
+        if (duplicatesAsFreshSubtree(node as AnyNode)) {
+          let draftId: AnyNodeId | null = null
+          try {
+            draftId = createFreshPlacementSubtree(node.id as AnyNodeId)
+            const draft = draftId ? useScene.getState().nodes[draftId] : null
+            if (draft) {
+              setMovingNode(draft as any)
+              setSelection({ selectedIds: [] })
+              return
+            }
+          } catch (error) {
+            if (draftId && useScene.getState().nodes[draftId]) {
+              useScene.getState().deleteNode(draftId)
+            }
+            console.error('Failed to duplicate node subtree', error)
+          }
+          return
+        }
+
+        const duplicateInfo = prepareFreshPlacementRootDuplicate(node as AnyNode) as any
 
-      if (duplicatesAsFreshSubtree(node as AnyNode)) {
-        let draftId: AnyNodeId | null = null
+        let duplicate: AnyNode | null = null
         try {
-          draftId = createFreshPlacementSubtree(node.id as AnyNodeId)
-          const draft = draftId ? useScene.getState().nodes[draftId] : null
-          if (draft) {
-            setMovingNode(draft as any)
-            setSelection({ selectedIds: [] })
-            return
-          }
-        } catch (error) {
-          if (draftId && useScene.getState().nodes[draftId]) {
-            useScene.getState().deleteNode(draftId)
+          if (node.type === 'door') {
+            duplicate = DoorNode.parse(duplicateInfo)
+          } else if (node.type === 'window') {
+            duplicate = WindowNode.parse(duplicateInfo)
+          } else if (node.type === 'item') {
+            duplicate = ItemNode.parse(duplicateInfo)
+          } else if (node.type === 'elevator') {
+            duplicate = ElevatorNode.parse(duplicateInfo)
+          } else if (node.type === 'column') {
+            duplicate = ColumnNode.parse(duplicateInfo)
+          } else if (node.type === 'wall') {
+            duplicate = WallNode.parse(duplicateInfo)
+          } else if (node.type === 'fence') {
+            duplicate = FenceNode.parse(duplicateInfo)
+            duplicate.start = [duplicate.start[0] + 1, duplicate.start[1] + 1]
+            duplicate.end = [duplicate.end[0] + 1, duplicate.end[1] + 1]
+          } else if (node.type === 'roof-segment') {
+            duplicateInfo.id = generateId('rseg')
+            duplicate = RoofSegmentNode.parse(duplicateInfo)
+          } else if (node.type === 'stair-segment') {
+            duplicate = StairSegmentNode.parse(duplicateInfo)
+          } else if (node.type === 'spawn') {
+            duplicate = SpawnNode.parse(duplicateInfo)
           }
-          console.error('Failed to duplicate node subtree', error)
-        }
-        useScene.temporal.getState().resume()
-        return
-      }
 
-      const duplicateInfo = prepareFreshPlacementRootDuplicate(node as AnyNode) as any
-
-      let duplicate: AnyNode | null = null
-      try {
-        if (node.type === 'door') {
-          duplicate = DoorNode.parse(duplicateInfo)
-        } else if (node.type === 'window') {
-          duplicate = WindowNode.parse(duplicateInfo)
-        } else if (node.type === 'item') {
-          duplicate = ItemNode.parse(duplicateInfo)
-        } else if (node.type === 'elevator') {
-          duplicate = ElevatorNode.parse(duplicateInfo)
-        } else if (node.type === 'column') {
-          duplicate = ColumnNode.parse(duplicateInfo)
-        } else if (node.type === 'wall') {
-          duplicate = WallNode.parse(duplicateInfo)
-        } else if (node.type === 'fence') {
-          duplicate = FenceNode.par
```

**File**: `packages/nodes/src/__tests__/duplicate-hosted-mounted.test.tsx` (modified, +15/-4)
```diff
@@ -87,6 +87,7 @@ import { builtinPlugin } from '../index'
 import { ItemGLTFLoader } from '../item/model-loader'
 import { MoveItemTool } from '../item/move-tool'
 import ItemTool from '../item/tool'
+import MoveProceduralItem from '../procedural-item/move-tool'
 import { getDefaultPanelMaterial } from '../solar-panel/geometry'
 
 // Other node tests install process-global renderer mocks; this audit must observe production modules.
@@ -2525,6 +2526,13 @@ if (process.env.PASCAL_DUPLICATE_AUDIT_ISOLATED !== '1') {
           kind === 'procedural-generic' ? 'procedural-item' : kind,
           false,
         )
+        const usesRawMover = kind !== 'item'
+        if (usesRawMover) {
+          expect(root.type).toBe('procedural-item')
+          const procedural = root as ProceduralItemNode
+          expect(procedural.recipe.mounting).toBeUndefined()
+          expect(MoveProceduralItem({ node: procedural }).type).toBe(MoveRegistryNodeTool)
+        }
         if (kind === 'procedural-generic') {
           genericPlanDOM()
           const definition = nodeRegistry.get('procedural-item')!
@@ -2535,8 +2543,11 @@ if (process.env.PASCAL_DUPLICATE_AUDIT_ISOLATED !== '1') {
         const renderer = await create(<Scene menu panes={{ plan: true, spatial: true }} />)
         try {
           const copy = await duplicate(renderer)
+          expect(useScene.temporal.getState().isTracking).toBe(!usesRawMover)
+          expect(Core.getSceneHistoryPauseDepth()).toBe(0)
           const origin = useEditor.getState().movingNodeOrigin
           await planPointer(1, 0)
+          expect(useScene.temporal.getState().isTracking).toBe(!usesRawMover)
           const obstacle = ItemNode.parse({ parentId: host.id, asset, position: [1, 0, 0] })
           useScene.getState().applyNodeChanges({
             create: [{ node: obstacle }],
@@ -2558,6 +2569,7 @@ if (process.env.PASCAL_DUPLICATE_AUDIT_ISOLATED !== '1') {
           expect(getMovingNode()?.id).toBe(copy.id)
           expect(snapshot()).toBe(atRelease)
           expect(useEditor.getState().movingNodeOrigin).toBe(origin)
+          expect(useScene.temporal.getState().isTracking).toBe(!usesRawMover)
           const attachments = {
             ...(useScene.getState().nodes[host.id] as ProceduralItemNode).attachments,
           }
@@ -2574,10 +2586,9 @@ if (process.env.PASCAL_DUPLICATE_AUDIT_ISOLATED !== '1') {
           else await pointer.send(new Vector3(1, 2, 0), 'grid first', true)
           await settle(renderer)
           expect(getMovingNode()).toBeNull()
-          // The obstacle's create and delete are someone else's writes: with the 2D overlay and
-          // the placement coordinator pausing only their own writes, each records its own step.
-          // The generic 3D mover still pauses the whole gesture (raw), so there they stay unrecorded.
-          const foreignSteps = kind === 'procedural-generic' ? 0 : 2
+          // Items pause only their own writes. These unmounted recipes delegate to the generic
+          // 3D mover, whose raw lifetime pause applies with either 2D overlay path.
+          const foreignSteps = usesRawMover ? 0 : 2
           if (outcome === 'Escape') {
             expect(snapshot()).toBe(before)
             expect(useScene.temporal.getState().pastStates).toHaveLength(foreignSteps)
```

#### Recent Merged Pull Requests:
- **PR #982** (2026-09-30): Door/window/light action-menu buttons with E hint, slab lift on Preview remount, Select building (@wass08)
- **PR #979** (2026-09-30): fix(core): legacy scenes with raw nodes load without crashing (@wass08)
- **PR #978** (2026-09-30): fix(viewer): keep offset door hit targets reachable from both sides (@Aymericr)
- **PR #977** (2026-09-29): Expose pending item model loads by loading manager (@Aymericr)
- **PR #976** (2026-09-29): Room-first structure foundations (@wass08)
- **PR #974** (2026-09-28): feat(viewer,editor): studio hero look for worker thumbnails (@wass08)
- **PR #973** (2026-09-28): fix(core): validate-build-json warns when an opening leaves its wall (@Aymericr)
- **PR #971** (2026-09-28): feat(procedural-items): design v2 and agent design tools (AK track) (@Aymericr)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
