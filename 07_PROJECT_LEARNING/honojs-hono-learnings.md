# Forensic Learning Record (Deep Inspection): honojs/hono

> **Canonical Artifact**: `07_PROJECT_LEARNING/honojs-hono-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/honojs/hono](https://github.com/honojs/hono))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T19:08:32.368Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `honojs/hono`
- **Description**: Web framework built on Web Standards
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 32415 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `adapters/cloudflare-workers/src/conninfo.ts`
```
import type { GetConnInfo } from 'hono/conninfo'

export const getConnInfo: GetConnInfo = (c) => ({
  remote: {
    address: c.req.header('cf-connecting-ip'),
  },
})

```

### Core Architecture Module: `adapters/cloudflare-workers/src/index.ts`
```
/**
 * @module
 * Cloudflare Workers Adapter for Hono.
 */

export { serveStatic } from './serve-static-module'
export { upgradeWebSocket } from './websocket'
export { getConnInfo } from './conninfo'

```

### Core Architecture Module: `adapters/cloudflare-workers/src/serve-static-module.ts`
```
// For ES module mode
import type { Env, MiddlewareHandler } from 'hono/types'
import type { ServeStaticOptions } from './serve-static'
import { serveStatic } from './serve-static'

const module = <E extends Env = Env>(
  options: Omit<ServeStaticOptions<E>, 'namespace'>
): MiddlewareHandler => {
  return serveStatic<E>(options)
}

export { module as serveStatic }

```

### Core Architecture Module: `adapters/cloudflare-workers/src/serve-static.ts`
```
import { serveStatic as baseServeStatic } from 'hono/serve-static'
import type { ServeStaticOptions as BaseServeStaticOptions } from 'hono/serve-static'
import type { Env, MiddlewareHandler } from 'hono/types'
import { getContentFromKVAsset } from './utils'

export type ServeStaticOptions<E extends Env = Env> = BaseServeStaticOptions<E> & {
  // namespace is KVNamespace
  namespace?: unknown
  manifest?: object | string
}

/**
 * @deprecated
 * `serveStatic` in the Cloudflare Workers adapter is deprecated.
 * You can serve static files directly using Cloudflare Static Assets.
 * @see https://developers.cloudflare.com/workers/static-assets/
 * Cloudflare Static Assets is currently in open beta. If this doesn't work for you,
 * please consider using Cloudflare Pages. You can start to create the Cloudflare Pages
 * application with the `npm create hono@latest` command.
 */
export const serveStatic = <E extends Env = Env>(
  options: ServeStaticOptions<E> = {}
): MiddlewareHandler => {
  return async function serveStatic(c, next) {
    const getContent = async (path: string) => {
      return getContentFromKVAsset(path, {
        manifest: options.manifest,
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        namespace: options.namespace
          ? options.namespace
          : c.env
            ? c.env.__STATIC_CONTENT
            : undefined,
      })
    }
    return baseServeStatic({
      ...options,
      getContent,
    })(c, next)
  }
}

```

### Core Architecture Module: `adapters/cloudflare-workers/src/utils.ts`
```
// __STATIC_CONTENT is KVNamespace
declare const __STATIC_CONTENT: unknown
declare const __STATIC_CONTENT_MANIFEST: string

export type KVAssetOptions = {
  manifest?: object | string
  // namespace is KVNamespace
  namespace?: unknown
}

export const getContentFromKVAsset = async (
  path: string,
  options?: KVAssetOptions
): Promise<ReadableStream | null> => {
  let ASSET_MANIFEST: Record<string, string>

  if (options && options.manifest) {
    if (typeof options.manifest === 'string') {
      ASSET_MANIFEST = JSON.parse(options.manifest)
    } else {
      ASSET_MANIFEST = options.manifest as Record<string, string>
    }
  } else {
    if (typeof __STATIC_CONTENT_MANIFEST === 'string') {
      ASSET_MANIFEST = JSON.parse(__STATIC_CONTENT_MANIFEST)
    } else {
      ASSET_MANIFEST = __STATIC_CONTENT_MANIFEST
    }
  }

  // ASSET_NAMESPACE is KVNamespace
  let ASSET_NAMESPACE: unknown
  if (options && options.namespace) {
    ASSET_NAMESPACE = options.namespace
  } else {
    ASSET_NAMESPACE = __STATIC_CONTENT
  }

  const key = ASSET_MANIFEST[path]
  if (!key) {
    return null
  }

  // @ts-expect-error ASSET_NAMESPACE is not typed
  const content = await ASSET_NAMESPACE.get(key, { type: 'stream' })
  if (!content) {
    return null
  }
  return content as unknown as ReadableStream
}

```

### Core Architecture Module: `adapters/cloudflare-workers/src/websocket.ts`
```
import { WSContext, defineWebSocketHelper } from 'hono/ws'
import type { UpgradeWebSocket, WSEvents, WSReadyState } from 'hono/ws'

// Based on https://github.com/honojs/hono/issues/1153#issuecomment-1767321332
export const upgradeWebSocket: UpgradeWebSocket<
  WebSocket,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  Omit<WSEvents<WebSocket>, 'onOpen'>
> = defineWebSocketHelper(async (c, events) => {
  const upgradeHeader = c.req.header('Upgrade')
  if (upgradeHeader !== 'websocket') {
    return
  }

  // @ts-expect-error WebSocketPair is not typed
  const webSocketPair = new WebSocketPair()
  const client: WebSocket = webSocketPair[0]
  const server: WebSocket = webSocketPair[1]

  const wsContext = new WSContext<WebSocket>({
    close: (code, reason) => server.close(code, reason),
    get protocol() {
      return server.protocol
    },
    raw: server,
    get readyState() {
      return server.readyState as WSReadyState
    },
    url: server.url ? new URL(server.url) : null,
    send: (source) => server.send(source),
  })

  // note: cloudflare workers doesn't support 'open' event

  if (events.onClose) {
    server.addEventListener('close', (evt: CloseEvent) => events.onClose?.(evt, wsContext))
  }
  if (events.onMessage) {
    server.addEventListener('message', (evt: MessageEvent) => events.onMessage?.(evt, wsContext))
  }
  if (events.onError) {
    server.addEventListener('error', (evt: Event) => events.onError?.(evt, wsContext))
  }

  // @ts-expect-error - server.accept is not typed
  server.accept?.()
  return new Response(null, {
    status: 101,
    // @ts-expect-error - webSocket is not typed
    webSocket: client,
  })
})

```

### Core Architecture Module: `adapters/cloudflare-workers/vite.config.ts`
```
import { defineConfig } from 'vite-plus'
import { appendExportEmptyToDts } from '../../build/dts-plugins'

export default defineConfig({
  pack: {
    entry: ['src/**/*.ts', '!src/**/*.test.ts', '!src/**/*.d.ts'],
    tsconfig: 'tsconfig.json',
    unbundle: true,
    format: ['esm'],
    dts: true,
    plugins: [appendExportEmptyToDts],
    outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
  },
  test: {
    globals: true,
  },
})

```

### Core Architecture Module: `adapters/service-worker/src/handler.ts`
```
/**
 * Handler for Service Worker
 * @module
 */

import type { Hono } from 'hono'
import type { Env, Schema } from 'hono/types'
import type { FetchEvent } from './types'

type Handler = (evt: FetchEvent) => void
export type HandleOptions = {
  fetch?: typeof fetch
}

/**
 * Adapter for Service Worker
 */
export const handle = <E extends Env, S extends Schema, BasePath extends string>(
  app: Hono<E, S, BasePath>,
  opts: HandleOptions = {
    // To use `fetch` on a Service Worker correctly, bind it to `globalThis`.
    fetch: globalThis.fetch.bind(globalThis),
  }
): Handler => {
  return (evt) => {
    evt.respondWith(
      (async () => {
        // @ts-expect-error Passing FetchEvent but app.fetch expects ExecutionContext
        const res = await app.fetch(evt.request, {}, evt)
        if (opts.fetch && res.status === 404) {
          return await opts.fetch(evt.request)
        }
        return res
      })()
    )
  }
}

```

### Core Architecture Module: `adapters/service-worker/src/index.ts`
```
/**
 * Service Worker Adapter for Hono.
 * @module
 */
import type { Hono } from 'hono'
import type { Env, Schema } from 'hono/types'
import { handle } from './handler'
import type { HandleOptions } from './handler'

/**
 * Registers a Hono app to handle fetch events in a service worker.
 * This sets up `addEventListener('fetch', handle(app, options))` for the provided app.
 *
 * @param app - The Hono application instance
 * @param options - Options for handling requests (fetch defaults to undefined)
 * @example
 * ```ts
 * import { Hono } from 'hono'
 * import { fire } from './index'
 *
 * const app = new Hono()
 *
 * app.get('/', (c) => c.text('Hi'))
 *
 * fire(app)
 * ```
 */
const fire = <E extends Env, S extends Schema, BasePath extends string>(
  app: Hono<E, S, BasePath>,
  options?: HandleOptions
): void => {
  // @ts-expect-error addEventListener is not typed well in ServiceWorker-like contexts, see: https://github.com/microsoft/TypeScript/issues/14877
  addEventListener('fetch', handle(app, options))
}

export { handle, fire }

```

### Core Architecture Module: `adapters/service-worker/src/types.ts`
```
interface ExtendableEvent extends Event {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  waitUntil(f: Promise<any>): void
}

export interface FetchEvent extends ExtendableEvent {
  readonly clientId: string
  readonly handled: Promise<void>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly preloadResponse: Promise<any>
  readonly request: Request
  readonly resultingClientId: string
  respondWith(r: Response | PromiseLike<Response>): void
}

```

### Core Architecture Module: `adapters/service-worker/vite.config.ts`
```
import { defineConfig } from 'vite-plus'
import { appendExportEmptyToDts } from '../../build/dts-plugins'

export default defineConfig({
  pack: {
    entry: ['src/**/*.ts', '!src/**/*.test.ts', '!src/**/*.d.ts'],
    tsconfig: 'tsconfig.json',
    unbundle: true,
    format: ['esm'],
    dts: true,
    plugins: [appendExportEmptyToDts],
    outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
  },
  test: {
    globals: true,
  },
})

```

### Core Architecture Module: `benchmarks/utils/src/get-path.ts`
```
import { run, group, bench } from 'mitata'

bench('noop', () => {})

const request = new Request('http://localhost/about/me')

group('getPath', () => {
  bench('slice + indexOf : w/o decodeURI', () => {
    const url = request.url
    const queryIndex = url.indexOf('?', 8)
    return url.slice(url.indexOf('/', 8), queryIndex === -1 ? undefined : queryIndex)
  })

  bench('regexp : w/o decodeURI', () => {
    const match = request.url.match(/^https?:\/\/[^/]+(\/[^?]*)/)
    return match ? match[1] : ''
  })

  bench('slice + indexOf', () => {
    const url = request.url
    const queryIndex = url.indexOf('?', 8)
    const path = url.slice(url.indexOf('/', 8), queryIndex === -1 ? undefined : queryIndex)
    return path.includes('%') ? decodeURIComponent(path) : path
  })

  bench('slice + for-loop + flag', () => {
    const url = request.url
    const start = url.indexOf('/', 8)
    let i = start
    let hasPercentEncoding = false
    for (; i < url.length; i++) {
      const charCode = url.charCodeAt(i)
      if (charCode === 37) {
        // '%'
        hasPercentEncoding = true
      } else if (charCode === 63) {
        // '?'
        break
      }
    }
    return hasPercentEncoding ? decodeURIComponent(url.slice(start, i)) : url.slice(start, i)
  })

  bench('slice + for-loop + immediate return', () => {
    const url = request.url
    const start = url.indexOf('/', 8)
    let i = start
    for (; i < url.length; i++) {
      const charCode = url.charCodeAt(i)
      if (charCode === 37) {
        // '%'
        // If the path contains percent encoding, use `indexOf()` to find '?' and return the result immediately.
        // Although this is a performance disadvantage, it is acceptable since we prefer cases that do not include percent encoding.
        const queryIndex = url.indexOf('?', i)
        const path = url.slice(start, queryIndex === -1 ? undefined : queryIndex)
        return decodeURI(path.includes('%25') ? path.replace(/%25/g, '%2525') : path)
      } else if (charCode === 63) {
        // '?'
        break
      }
    }
    return url.slice(start, i)
  })
})

run()

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5129** (2026-07-17): **parseBody() fails with "Failed to parse body as FormData" when formData() was read first (regression in 4.12.28)**
  *Symptoms*: ### What version of Hono are you using?  4.12.30 (regression introduced in 4.12.28; 4.12.27 works)  ### What runtime/platform is your app running on?  Node.js v24.10.0 (reproduced via `app.request()`, so it is runtime-independent)  ### What steps can reproduce the bug?  Call `c.req.formData()` first (e.g. in an auth middleware that hashes the raw body to verify a signature), then call `c.req.parseBody()` in the handler:  ```ts import { Hono } from "hono";  const app = new Hono();  app.post("/upload", async (c) => {   await c.req.formData(); // e.g. middleware verifying a signed body   const body = await c.req.parseBody(); // throws on >= 4.12.28   return c.json({ gotFile: body.file instanceof File }); });  const fd = new FormData(); fd.append("file", new Blob(["hello"], { type: "text/plain" }), "t.txt");  const res = await app.request("/upload", { method: "POST", body: fd }); console.log(res.status, await res.text()); ```  - hono 4.12.27: `200 {"gotFile":true}` - hono 4.12.28 / 4.12.29 / 4.12.30: `500`, with `parseBody()` rejecting with `Failed to parse body as FormData.`  ### What is the expected behavior?  `parseBody()` reuses the cached form data (as it did up to 4.12.27) and returns the parsed body.  ### What do you see instead?  `parseBody()` throws `Failed to parse body as FormData.`, turning the request into a 500.  ### Additional information  I believe the regression comes from #5071 (shipped in 4.12.28). The chain:  1. `c.req.formData()` caches `bodyCache.formData` o
  **Post-Mortem & Fix Analysis**:
  > Two additions after digging further.  **Precedent for this bug class:** #4806 was the mirror image of this report (`parseBody()` first, then `text()`/`json()` breaking through the body cache) and was confirmed as a bug and fixed in #4807. So cross-helper reads through `bodyCache` are intended to work, which supports treating this as a regression rather than unsupported usage.  **Related (but pre-existing, not part of the 4.12.28 regression): `cloneRawRequest` has the same boundary mismatch for multipart.** When the body was already consumed and cached as `formData`, `cloneRawRequest` rebuilds the request as `new Request(url, { body: await req.formData(), headers: req.header() })`. The explicit original `Content-Type` header (old boundary) wins over the one the new FormData serialization would set, so the cloned request's header boundary doesn't match its body bytes:  ```ts import { Hono } from "hono"; import { cloneRawRequest } from "hono/request";  const app = new Hono(); app.post("/x
  > @marcovietovega Thank you for the report! This is a bug. I'll fix it.

- **Issue #4806** (2026-03-21): **parseBody() breaks subsequent text()/json() calls with TypeError**
  *Symptoms*: ### What version of Hono are you using?  4.12.8  ### What runtime/platform is your app running on? (with version if possible)  Node.js v22 (also reproducible on any runtime)  ### What steps can reproduce the bug?  Calling `parseBody()` followed by `text()` or `json()` on the same request throws `TypeError: bodyCache[anyCachedKey].then is not a function`.  This happens when `Content-Type` is **not** `multipart/form-data` or `application/x-www-form-urlencoded` (e.g., `application/json` or no Content-Type header).  **Root cause:** `parseBody()` stores a resolved plain object in `bodyCache.parsedBody` (via `??= await parseBody(...)`). When Content-Type is not a form type, `parseBody()` returns `{}` immediately without going through `formData()`, so `parsedBody` is the only key in `bodyCache`.  `#cachedBody()` then picks it up via `Object.keys(bodyCache)[0]` and calls `.then()` on it, assuming every cache entry is a `Promise`.  When Content-Type **is** a form type, `parseBody()` internally calls `request.formData()` which goes through `#cachedBody('formData')`, caching a `Promise` under `bodyCache.formData` first — so `Object.keys()[0]` is `'formData'` and `.then()` succeeds.  **Reproduction:**  ```typescript import { HonoRequest } from 'hono/request'  const req = new HonoRequest(   new Request('http://localhost', {     method: 'POST',     body: JSON.stringify({ event: 'push' }),     headers: { 'Content-Type': 'application/json' },   }) ) await req.parseBody()  // returns {}, cach
  **Post-Mortem & Fix Analysis**:
  > Hi @karesansui-u   This is a bug. I'll fix it. Thanks you!
  > Thank you for confirming, @yusukebe\! Happy to help — let me know if you'd like me to open a PR for the fix.
  > Already created!  https://github.com/honojs/hono/pull/4807

- **Issue #4769** (2026-03-04): **ERR_INVALID_STATE when canceling during nested Suspense**
  *Symptoms*: ### What version of Hono are you using?  4.12.2  ### What runtime/platform is your app running on? (with version if possible)  Node  ### What steps can reproduce the bug?  I think it's the same error as https://github.com/honojs/node-server/issues/233 but according to Claude, the actual bug is upstream here. Failing test:  ```js   it('should not throw ERR_INVALID_STATE when reader is cancelled during nested Suspense streaming', async () => {     const unhandled: unknown[] = []     const onRejection = (e: unknown) => unhandled.push(e)     process.on('unhandledRejection', onRejection)      try {       const SubContent = () => {         const content = new Promise<HtmlEscapedString>((resolve) =>           setTimeout(() => resolve(<h2>World</h2>), 50)         )         return content       }        const Content = () => {         const content = new Promise<HtmlEscapedString>((resolve) =>           setTimeout(             () =>               resolve(                 <>                   <h1>Hello</h1>                   <Suspense fallback={<p>Loading sub...</p>}>                     <SubContent />                   </Suspense>                 </>               ),             20           )         )         return content       }        const onError = vi.fn()       const stream = renderToReadableStream(         <Suspense fallback={<p>Loading...</p>}>           <Content />         </Suspense>,         onError       )        const reader = stream.getReader()       const firstChunk 

- **Issue #4736** (2026-02-24): **TypeScript: `c.var.jwtPayload` loses type information with custom context and @hono/zod-openapi**
  *Symptoms*: ### What version of Hono are you using?  4.12.0  ### What runtime/platform is your app running on? (with version if possible)  Node.js  ### What steps can reproduce the bug?  When using a custom context type with `JwtVariables<T>` and passing it to a route handler created with @hono/zod-openapi's `createRoute`, the type of `c.var.jwtPayload` is still any instead of the expected type. This happens even when the handler is typed with the custom context.  To Reproduce ```ts import { OpenAPIHono, createRoute, type RouteHandler, z } from "@hono/zod-openapi"; import { jwt, type JwtVariables } from "hono/jwt";  // Simulate a user type type User = {   id: string;   email: string;   isAdmin: boolean; };  // Custom context with JwtVariables interface AppContext {   Variables: JwtVariables<User>; }  const routeDef = createRoute({   method: "get",   path: "/",   responses: {     200: {       content: {         "application/json": {           schema: z.object({ ok: z.boolean() }),         },       },       description: "ok",     },   }, });  const handler: RouteHandler<typeof routeDef, AppContext> = (c) => {   // Type of c.var.jwtPayload is 'any', not 'User'   const user = c.var.jwtPayload;   // Should have type safety here, but does not   return c.json({ ok: true }); };  const app = new OpenAPIHono<AppContext>(); app.use(jwt({ ... })); app.openapi(routeDef, handler); ```   ### What is the expected behavior?  `c.var.jwtPayload` should be strongly typed as User (or the type passed to `JwtV
  **Post-Mortem & Fix Analysis**:
  > This is a bug. I'll fix it.

- **Issue #4600** (2025-12-26): **Middleware response type no longer merged with endpoint response type**
  *Symptoms*: ### What version of Hono are you using?  4.11.2  ### What runtime/platform is your app running on? (with version if possible)  Bun 1.3.4  ### What steps can reproduce the bug?  ```ts import { Hono } from "hono"; import { hc } from "hono/client"; import { createMiddleware } from "hono/factory";  const middleware = createMiddleware(async (c) => {   if (Math.random() > 0.5) {     return;   } else {     return c.json({ cause: "Unauthorized" as const }, 401);   } });  const app = new Hono().get("/", middleware, (c) => {   return c.json({ message: "Hello Hono!" }); });  export default app;  type AppType = typeof app;  const api = hc<AppType>(""); const response = await api.index.$get(); const json = await response.json(); // Should be `{ cause: "Unauthorized" } | { message: "Hello Hono!" }` ```  ### What is the expected behavior?  `json` should be typed as `{ cause: "Unauthorized" } | { message: "Hello Hono!" }`, like in previous versions  ### What do you see instead?  `json` is typed as `{ message: "Hello Hono!" }`  ### Additional information  #4598 seems to be the cause of the issue. It only occurs when the middleware returns a union type
  **Post-Mortem & Fix Analysis**:
  > Hi @colinlienard !  It's a bug. My fault. I'll revert it right now. Thank you.

- **Issue #4584** (2025-12-18): **using `.optional()` on query param schema using zodValidator resolves enums to strings**
  *Symptoms*: ### What version of Hono are you using?  4.11.1  ### What runtime/platform is your app running on? (with version if possible)  Bun  ### What steps can reproduce the bug?  ```typescript const app = new Hono<AppEnv>()  const feedQueryParamsSchema = z.object({   userId: z.string().optional(),   remixId: z.string().optional(),   visibility: z.array(z.enum(['public', 'private', 'draft'])).optional(),   orderBy: z.enum(['published-at', 'updated-at', 'trending']).optional(),   cursor: z.string().optional(),   limit: z.coerce.number().min(1).max(100).optional().default(6), })  const apps = app.get('/feed', zValidator('query', feedQueryParamsSchema), async (c) => {   const { cursor, limit } = c.req.valid('query')      return c.json({     data: [],     nextCursor: 'some-string',   }) })  export { apps }  export type AppsRoute = typeof apps ```  This resolves to   <img width="495" height="282" alt="Image" src="https://github.com/user-attachments/assets/9f79929e-025b-4f99-b416-398aec6c1b77" />   If I remove the `.optional()`, it works well   <img width="559" height="274" alt="Image" src="https://github.com/user-attachments/assets/5f8e24e6-4939-4b61-9c34-1eaaee1f0c10" />  ### What is the expected behavior?  `.optional()` should not affect the type inference  ### What do you see instead?  I'm seeing fields being resolved to string | string [] | undefined, and not their actual type  ### Additional information  _No response_
  **Post-Mortem & Fix Analysis**:
  > @alonzuman   Thank you for the PR. It's a bug of Zod Validator. And it's related to this `hono` package. I'll fix it. 
  > > [@alonzuman](https://github.com/alonzuman) >  > Thank you for the PR. It's a bug of Zod Validator. And it's related to this `hono` package. I'll fix it.  Thank you!
  > Hi @alonzuman   Your problem was fixed in the latest version of Zod Validator @hono/zod-validator@0.7.6. Please try it!

- **Issue #4517** (2025-12-13): **Downstream methods without `path` args break upstream method path typing**
  *Symptoms*: ### What version of Hono are you using?  4.10.5  ### What runtime/platform is your app running on? (with version if possible)  Bun 1.2.13  ### What steps can reproduce the bug?  a typing edge case was [reported on discord](https://discord.com/channels/1011308539819597844/1436389937992958063)   - below i've included an illustrative test case adapted from the existing [Env types and a path type with `app.use(path, handler...)\` - test only types](https://github.com/honojs/hono/blob/971106d132ec8a989be12ec5c8e63cfaf597cd4f/src/types.test.ts#L1905) in `/src/tests.ts`  ### TL;DR  - when a handler or middleware is called with a `path` argument, the `Hono` instance [`this.#path` is updated](https://github.com/honojs/hono/blob/971106d132ec8a989be12ec5c8e63cfaf597cd4f/src/hono-base.ts#L139)   - if the next method in the chain is also called with the `path` argument, there's no issue   - if the next method is called _without_ the `path` argument, then:     - the call defaults the path to the previously-set `this.#path` (expected)     - the schema uses the previously-set path type (expected)     - _any methods called before the middleware are also **typed** using the not-yet-set path (unexpected)_ - i don't totally understand why this happens, but i think has to do with the [type merging](https://github.com/honojs/hono/blob/971106d132ec8a989be12ec5c8e63cfaf597cd4f/src/types.ts#L2139) that `ChangePathOfSchema` does   - in order to resolve downstream schemas, it flattens them to the `Path
  **Post-Mortem & Fix Analysis**:
  > @ambergristle   Thanks. This is a bug.

- **Issue #4471** (2025-10-24): **'Vary' response header is overwritten when using CORS middleware unless provided in request headers**
  *Symptoms*: ### What version of Hono are you using?  4.10.1  ### What runtime/platform is your app running on? (with version if possible)  Cloudflare Workers (locally with `wrangler dev`, 4.43.0)  ### What steps can reproduce the bug?  Hi. I'm using the `hono/cors` middleware and also setting the `Vary` header to `Accept` for responses in my controller. I noticed that the actual server response is `Vary: Origin` instead.  After checking the source code I see that Hono checks the request vary header, and if that is not there, it will overwrite it on the response. Does it make sense that it should check the response vary header instead? New to the whole vary header, so I'm assuming it is not normal practice for a request from the client to include it. Or is there a reason for this, i.e. security?  https://github.com/honojs/hono/blob/4b796cfb0b105418bbf806050e788741f2739125/src/middleware/cors/index.ts#L112  ### Reproduction  I've created a minimal reproduction repository: https://github.com/Juuldamen/hono-vary-cors-issue. See the readme for test commands.  1. Run server that has a CORS middleware and a controller that returns a response with the `Vary` header that has a value different than `Origin`. 2. Send a HTTP request, for minimal repro: `curl -i http://localhost:8787/test`  ### What is the expected behavior?  The `Vary` header value on the HTTP response should include the values as set on the response in the controller. Preferably it should check if the value includes `Origin` and if
  **Post-Mortem & Fix Analysis**:
  > Hi @Juuldamen, thanks for the report. That does seem strange. I'll look into it.
  >  Hi! May I work on this issue?  I've already submitted PR #4479 with a fix that reads the Vary header from response headers instead of request headers. Please review when you have time. Thanks!
  > Hi @Juuldamen @Higangssh   We've fixed it and released a new version, `4.10.3`, including the patch. Since this has a security issue, we were working on fixing this privately, and we created a security advisor https://github.com/honojs/hono/security/advisories/GHSA-q7jf-gf43-6x6p  Thank you!

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

### Incident Patch 1: `f23b146a` (2026-10-01)
**Commit Message**: fix(jsx): allow JSXNode function component results (#5476)

**File**: `src/jsx/base.test.tsx` (modified, +6/-0)
```diff
@@ -37,6 +37,12 @@ describe('cloneElement', () => {
 })
 
 describe('createElement', () => {
+  it('should accept a component that returns a JSXNode', () => {
+    const Partial = ({ name }: { name: string }) => jsx('div', { 'x-partial': name }, name)
+
+    expect((<Partial name='foo' />).toString()).toBe('<div x-partial="foo">foo</div>')
+  })
+
   it('should preserve the SVG element shape', () => {
     const ref = { current: null }
     const element = jsx('svg', { ref }) as unknown as JSXNode
```

**File**: `src/jsx/base.ts` (modified, +2/-1)
```diff
@@ -24,8 +24,9 @@ import {
 export type Props = Record<string, any>
 type FunctionComponentResult =
   | HtmlEscapedString
+  | JSXNode
   | Child[]
-  | Promise<HtmlEscapedString | Child[]>
+  | Promise<HtmlEscapedString | JSXNode | Child[]>
   | null
 export type FC<P = Props> = {
   (props: P): FunctionComponentResult
```

---

### Incident Patch 2: `6d73a74f` (2026-10-01)
**Commit Message**: docs(request): fix jsdoc comments for some getters (#5445)

Remove extra parentheses.

**File**: `src/request.ts` (modified, +4/-4)
```diff
@@ -359,7 +359,7 @@ export class HonoRequest<P extends string = '/', I extends Input['out'] = {}> {
   }
 
   /**
-   * `.url()` can get the request url strings.
+   * `.url` can get the request url strings.
    *
    * @see {@link https://hono.dev/docs/api/request#url}
    *
@@ -376,7 +376,7 @@ export class HonoRequest<P extends string = '/', I extends Input['out'] = {}> {
   }
 
   /**
-   * `.method()` can get the method name of the request.
+   * `.method` can get the method name of the request.
    *
    * @see {@link https://hono.dev/docs/api/request#method}
    *
@@ -396,7 +396,7 @@ export class HonoRequest<P extends string = '/', I extends Input['out'] = {}> {
   }
 
   /**
-   * `.matchedRoutes()` can return a matched route in the handler
+   * `.matchedRoutes` can return a matched route in the handler
    *
    * @deprecated
    *
@@ -427,7 +427,7 @@ export class HonoRequest<P extends string = '/', I extends Input['out'] = {}> {
   }
 
   /**
-   * `routePath()` can retrieve the path registered within the handler
+   * `.routePath` can retrieve the path registered within the handler
    *
    * @deprecated
    *
```

---

### Incident Patch 3: `afb2068c` (2026-09-30)
**Commit Message**: fix(combine): return a Response from a short-circuiting middleware in some() (#5391)

* fix(combine): return a Response from a short-circuiting middleware in some()

A middleware that short-circuits returns a `Response` without calling
`next()`, which does not assign `c.res`. `some()` matched the result
against `true` and `false`, then dropped it, so the context was never
finalized and hono-base threw "Context is not finalized", surfacing as
a 500.

`every()` has handled this since #3441, whose description is the same
report for the sibling: validators and `cors()` on OPTIONS return a
Response rather than calling `next()`. `some()` was not part of that
change.

Keeps the Response and returns it. A `true` that reaches the same branch
because the context is already finalized is excluded, so a Condition is
still never used as a response.

* docs(combine): remove redundant comments

---------

Co-authored-by: Taku Amano <[REDACTED_EMAIL]>

**File**: `src/middleware/combine/index.test.ts` (modified, +17/-0)
```diff
@@ -133,6 +133,23 @@ describe('some', () => {
     expect(middleware2).not.toBeCalled()
     expect(await res.text()).toBe('oops')
   })
+
+  it('Should return a Response from a middleware that short-circuits', async () => {
+    const shortCircuit: MiddlewareHandler = async (c) => c.json({ error: 'bad request' }, 400)
+    const next = vi.fn(async (_c, n) => {
+      await n()
+    })
+
+    const app = new Hono()
+    app.use('/', some(shortCircuit, next))
+    app.get('/', (c) => c.text('handler'))
+
+    const res = await app.request('http://localhost/')
+
+    expect(res.status).toBe(400)
+    expect(await res.json()).toEqual({ error: 'bad request' })
+    expect(next).not.toBeCalled()
+  })
 })
 
 describe('every', () => {
```

**File**: `src/middleware/combine/index.ts` (modified, +4/-0)
```diff
@@ -44,6 +44,7 @@ export const some = (...middleware: (MiddlewareHandler | Condition)[]): Middlewa
     }
 
     let lastError: unknown
+    let response: Response | undefined
     for (const handler of middleware) {
       try {
         const result = await handler(c, wrappedNext)
@@ -52,6 +53,8 @@ export const some = (...middleware: (MiddlewareHandler | Condition)[]): Middlewa
         } else if (result === false) {
           lastError = new Error('No successful middleware found')
           continue
+        } else if (result && result !== true) {
+          response = result
         }
         lastError = undefined
         break
@@ -65,6 +68,7 @@ export const some = (...middleware: (MiddlewareHandler | Condition)[]): Middlewa
     if (lastError) {
       throw lastError
     }
+    return response
   }
 }
 
```

---

### Incident Patch 4: `e5bb2062` (2026-09-30)
**Commit Message**: fix(jsx): add px to numeric gridGap, gridRowGap and gridColumnGap (#5487)

**File**: `src/jsx/utils.test.ts` (modified, +3/-0)
```diff
@@ -205,6 +205,9 @@ describe('styleObjectForEach', () => {
       ${'right'}
       ${'top'}
       ${'width'}
+      ${'gridGap'}
+      ${'gridRowGap'}
+      ${'gridColumnGap'}
     `('$property', ({ property }) => {
       const fn = vi.fn()
       styleObjectForEach({ [property]: 1 }, fn)
```

**File**: `src/jsx/utils.ts` (modified, +1/-1)
```diff
@@ -185,7 +185,7 @@ export const styleObjectForEach = (
     let value: string
     if (typeof v === 'number') {
       value = !key.match(
-        /^(?:a|border-im|column(?:-c|s)|flex(?:$|-[^b])|grid-(?:ar|[^a])|font-w|li|or|sca|st|ta|wido|z)|ty$/
+        /^(?:a|border-im|column(?:-c|s)|flex(?:$|-[^b])|grid-(?!.*gap)(?:ar|[^a])|font-w|li|or|sca|st|ta|wido|z)|ty$/
       )
         ? `${v}px`
         : `${v}`
```

---

### Incident Patch 5: `c3053ccf` (2026-09-30)
**Commit Message**: fix(etag): correctly match mixed-case header name in retainedHeader option (#5475)

* fix(etag): correctly match mixed-case header name in retainedHeader option

* refactor(etag): use Set for retainedHeaders

Co-authored-by: Taku Amano <[REDACTED_EMAIL]>

---------

Co-authored-by: Taku Amano <[REDACTED_EMAIL]>

**File**: `src/middleware/etag/index.test.ts` (modified, +3/-1)
```diff
@@ -402,13 +402,14 @@ describe('Etag Middleware', () => {
     app.use(
       '/etag/*',
       etag({
-        retainedHeaders: ['x-message-retain', ...RETAINED_304_HEADERS],
+        retainedHeaders: ['x-message-retain', 'X-Message-Retain-Upper', ...RETAINED_304_HEADERS],
       })
     )
     app.get('/etag', (c) => {
       return c.text('Hono is hot', 200, {
         'cache-control': cacheControl,
         'x-message-retain': message,
+        'X-Message-Retain-Upper': message,
         'x-message': message,
       })
     })
@@ -422,6 +423,7 @@ describe('Etag Middleware', () => {
     expect(res.headers.get('ETag')).toBe('"d104fafdb380655dab607c9bddc4d4982037afa1"')
     expect(res.headers.get('Cache-Control')).toBe(cacheControl)
     expect(res.headers.get('x-message-retain')).toBe(message)
+    expect(res.headers.get('X-Message-Retain-Upper')).toBe(message)
     expect(res.headers.get('x-message')).toBeFalsy()
   })
 
```

**File**: `src/middleware/etag/index.ts` (modified, +4/-2)
```diff
@@ -78,7 +78,9 @@ function initializeGenerator(
  * ```
  */
 export const etag = (options?: ETagOptions): MiddlewareHandler => {
-  const retainedHeaders = options?.retainedHeaders ?? RETAINED_304_HEADERS
+  const retainedHeaders = new Set(
+    (options?.retainedHeaders ?? RETAINED_304_HEADERS).map((header) => header.toLowerCase())
+  )
   const weak = options?.weak ?? false
   const generator = initializeGenerator(options?.generateDigest)
 
@@ -123,7 +125,7 @@ export const etag = (options?: ETagOptions): MiddlewareHandler => {
         },
       })
       for (const key of Array.from(c.res.headers.keys())) {
-        if (retainedHeaders.indexOf(key.toLowerCase()) === -1) {
+        if (!retainedHeaders.has(key.toLowerCase())) {
           c.res.headers.delete(key)
         }
       }
```

---

### Incident Patch 6: `c437d756` (2026-09-30)
**Commit Message**: test(build): type-check the bundled declarations from a consumer project (#5486)

Run tsc against dist/types the way a consumer does, so regressions in the
bundled declarations are caught in CI: JSX attribute checking for both
runtimes (#5480) and declaration emit for inferred hono types (#5484).

Co-authored-by: Jeremy Banka <[REDACTED_EMAIL]>

**File**: `build/declaration-emit.test.ts` (added, +38/-0)
```diff
@@ -0,0 +1,38 @@
+import { spawnSync } from 'node:child_process'
+import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
+import { createRequire } from 'node:module'
+import { tmpdir } from 'node:os'
+import { join } from 'node:path'
+import { fileURLToPath } from 'node:url'
+import { describe, expect, it } from 'vitest'
+
+const compiler = createRequire(import.meta.url).resolve('typescript/bin/tsc')
+const fixture = fileURLToPath(new URL('./fixtures/declaration-emit', import.meta.url))
+const packageRoot = fileURLToPath(new URL('..', import.meta.url))
+
+describe('published declarations', () => {
+  it('let consumers emit declarations for types inferred from hono', () => {
+    // The fixture must live outside this package: inside it, tsc can always reach
+    // `dist/types/*` with a relative path and never reports TS2883.
+    const project = mkdtempSync(join(tmpdir(), 'hono-declaration-emit-'))
+    try {
+      cpSync(fixture, project, { recursive: true })
+      mkdirSync(join(project, 'node_modules'))
+      symlinkSync(packageRoot, join(project, 'node_modules', 'hono'), 'dir')
+      writeFileSync(join(project, 'package.json'), '{ "type": "module" }\n')
+
+      const result = spawnSync(
+        process.execPath,
+        [compiler, '--project', project, '--outDir', join(project, 'out')],
+        { encoding: 'utf8' }
+      )
+      // Without `export {}` in the bundled `.d.ts`, tsc fails with TS2883 here:
+      // internal aliases such as the return type of `c.json()` look exported from
+      // `hono/dist/types/...`, which is not reachable through the package exports.
+      expect(result.stdout + result.stderr).toBe('')
+      expect(result.status).toBe(0)
+    } finally {
+      rmSync(project, { recursive: true, force: true })
+    }
+  })
+})
```

**File**: `build/fixtures/declaration-emit/index.ts` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+import { Hono } from 'hono'
+import { createFactory } from 'hono/factory'
+
+// Inferred types like these mention internal aliases from hono's declarations
+// (for example the return type of `c.json()`). Consumers that build with
+// `declaration: true` must be able to emit them without naming those aliases.
+export const handlers = createFactory().createHandlers((c) => c.json({ ok: true }))
+
+export const app = new Hono().get('/', (c) => c.json({ ok: true }))
+export type AppType = typeof app
```

**File**: `build/fixtures/declaration-emit/tsconfig.json` (added, +14/-0)
```diff
@@ -0,0 +1,14 @@
+{
+  "compilerOptions": {
+    "target": "ESNext",
+    "module": "NodeNext",
+    "moduleResolution": "NodeNext",
+    "strict": true,
+    "declaration": true,
+    "emitDeclarationOnly": true,
+    "skipLibCheck": false,
+    "preserveSymlinks": true,
+    "types": []
+  },
+  "include": ["index.ts"]
+}
```

**File**: `build/fixtures/jsx-types/index.tsx` (added, +26/-0)
```diff
@@ -0,0 +1,26 @@
+import type { JSX } from 'hono/jsx'
+
+declare module 'hono/jsx' {
+  // eslint-disable-next-line @typescript-eslint/no-namespace
+  namespace JSX {
+    interface IntrinsicElements {
+      'custom-element': JSX.HTMLAttributes
+    }
+  }
+}
+
+export const button = (
+  <button disabled={false} class='button'>
+    Hello
+  </button>
+)
+export const customElement = <custom-element class='custom' />
+
+// @ts-expect-error Native boolean attributes must reject strings.
+export const invalidButton = <button disabled='yes' />
+
+// @ts-expect-error Native class attributes must reject numbers.
+export const invalidClass = <button class={123} />
+
+// @ts-expect-error Augmented custom elements must retain their attribute types.
+export const invalidCustomElement = <custom-element class={123} />
```

**File**: `build/fixtures/jsx-types/tsconfig.json` (added, +14/-0)
```diff
@@ -0,0 +1,14 @@
+{
+  "compilerOptions": {
+    "jsx": "react-jsx",
+    "jsxImportSource": "hono/jsx",
+    "lib": ["DOM", "ES2024"],
+    "module": "NodeNext",
+    "moduleResolution": "NodeNext",
+    "noEmit": true,
+    "skipLibCheck": false,
+    "strict": true,
+    "types": []
+  },
+  "include": ["index.tsx"]
+}
```

**File**: `build/jsx-types.test.ts` (added, +20/-0)
```diff
@@ -0,0 +1,20 @@
+import { spawnSync } from 'node:child_process'
+import { createRequire } from 'node:module'
+import { fileURLToPath } from 'node:url'
+import { describe, expect, it } from 'vitest'
+
+const compiler = createRequire(import.meta.url).resolve('typescript/bin/tsc')
+const project = fileURLToPath(new URL('./fixtures/jsx-types/tsconfig.json', import.meta.url))
+
+describe.each(['hono/jsx', 'hono/jsx/dom'])('published %s declarations', (jsxImportSource) => {
+  it.each(['react-jsx', 'react-jsxdev'])('preserves JSX attribute checking with %s', (jsx) => {
+    // Resolve the package exports to dist/types, as a consumer would after a build.
+    const result = spawnSync(
+      process.execPath,
+      [compiler, '--project', project, '--jsxImportSource', jsxImportSource, '--jsx', jsx],
+      { encoding: 'utf8' }
+    )
+    expect(result.stdout + result.stderr).toBe('')
+    expect(result.status).toBe(0)
+  })
+})
```

---

### Incident Patch 7: `be1f7498` (2026-09-30)
**Commit Message**: fix(build): keep internal types private in bundled d.ts and avoid a self-referencing JSX.IntrinsicElements (#5485)

**File**: `adapters/aws-lambda/vite.config.ts` (modified, +2/-0)
```diff
@@ -1,4 +1,5 @@
 import { defineConfig } from 'vite-plus'
+import { appendExportEmptyToDts } from '../../build/dts-plugins'
 
 export default defineConfig({
   pack: {
@@ -7,6 +8,7 @@ export default defineConfig({
     unbundle: true,
     format: ['esm'],
     dts: true,
+    plugins: [appendExportEmptyToDts],
     outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
   },
   test: {
```

**File**: `adapters/bun/vite.config.ts` (modified, +2/-0)
```diff
@@ -1,4 +1,5 @@
 import { defineConfig } from 'vite-plus'
+import { appendExportEmptyToDts } from '../../build/dts-plugins'
 
 export default defineConfig({
   pack: {
@@ -7,6 +8,7 @@ export default defineConfig({
     unbundle: true,
     format: ['esm'],
     dts: true,
+    plugins: [appendExportEmptyToDts],
     outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
   },
 })
```

**File**: `adapters/cloudflare-workers/vite.config.ts` (modified, +2/-0)
```diff
@@ -1,4 +1,5 @@
 import { defineConfig } from 'vite-plus'
+import { appendExportEmptyToDts } from '../../build/dts-plugins'
 
 export default defineConfig({
   pack: {
@@ -7,6 +8,7 @@ export default defineConfig({
     unbundle: true,
     format: ['esm'],
     dts: true,
+    plugins: [appendExportEmptyToDts],
     outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
   },
   test: {
```

**File**: `adapters/deno/vite.config.ts` (modified, +2/-0)
```diff
@@ -1,4 +1,5 @@
 import { defineConfig } from 'vite-plus'
+import { appendExportEmptyToDts } from '../../build/dts-plugins'
 
 export default defineConfig({
   pack: {
@@ -7,6 +8,7 @@ export default defineConfig({
     unbundle: true,
     format: ['esm'],
     dts: true,
+    plugins: [appendExportEmptyToDts],
     outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
   },
   test: {
```

**File**: `adapters/lambda-edge/vite.config.ts` (modified, +2/-0)
```diff
@@ -1,4 +1,5 @@
 import { defineConfig } from 'vite-plus'
+import { appendExportEmptyToDts } from '../../build/dts-plugins'
 
 export default defineConfig({
   pack: {
@@ -7,6 +8,7 @@ export default defineConfig({
     unbundle: true,
     format: ['esm'],
     dts: true,
+    plugins: [appendExportEmptyToDts],
     outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
   },
   test: {
```

**File**: `adapters/netlify/vite.config.ts` (modified, +2/-0)
```diff
@@ -1,4 +1,5 @@
 import { defineConfig } from 'vite-plus'
+import { appendExportEmptyToDts } from '../../build/dts-plugins'
 
 export default defineConfig({
   pack: {
@@ -7,6 +8,7 @@ export default defineConfig({
     unbundle: true,
     format: ['esm'],
     dts: true,
+    plugins: [appendExportEmptyToDts],
     outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
   },
   test: {
```

**File**: `adapters/service-worker/vite.config.ts` (modified, +2/-0)
```diff
@@ -1,4 +1,5 @@
 import { defineConfig } from 'vite-plus'
+import { appendExportEmptyToDts } from '../../build/dts-plugins'
 
 export default defineConfig({
   pack: {
@@ -7,6 +8,7 @@ export default defineConfig({
     unbundle: true,
     format: ['esm'],
     dts: true,
+    plugins: [appendExportEmptyToDts],
     outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
   },
   test: {
```

**File**: `adapters/vercel/vite.config.ts` (modified, +2/-0)
```diff
@@ -1,4 +1,5 @@
 import { defineConfig } from 'vite-plus'
+import { appendExportEmptyToDts } from '../../build/dts-plugins'
 
 export default defineConfig({
   pack: {
@@ -7,6 +8,7 @@ export default defineConfig({
     unbundle: true,
     format: ['esm'],
     dts: true,
+    plugins: [appendExportEmptyToDts],
     outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
   },
   test: {
```

---

### Incident Patch 8: `1e1207ca` (2026-09-29)
**Commit Message**: test(serve-static): fix the test (#5479)

* test(serve-static): fix the test

* use app.get

**File**: `src/middleware/serve-static/index.test.ts` (modified, +1/-1)
```diff
@@ -107,7 +107,7 @@ describe('Serve Static Middleware', () => {
 
   it('Should not bypass authentication through a second decode', async () => {
     const app = new Hono()
-    app.use('/static/admin/*', (c) => c.text('Unauthorized', 401))
+    app.get('/static/admin/*', (c) => c.text('Unauthorized', 401))
     app.use('/static/*', baseServeStatic({ getContent }))
 
     const protectedRes = await app.request('/static/admin/secret.txt')
```

---

### Incident Patch 9: `ee0622e1` (2026-09-26)
**Commit Message**: chore: convert build scripts into plugins (#5448)

**File**: `build/remove-private-fields.test.ts` (removed, +0/-26)
```diff
@@ -1,26 +0,0 @@
-/// <reference types="vitest/globals" />
-
-import { parseSync } from 'oxc-parser'
-import { removePrivateFieldFromSourceCode } from './remove-private-fields'
-
-describe('removePrivateFields', () => {
-  it('should remove private fields from declarations', () => {
-    const sourceCode = `
-    import type { Result, Router } from '../../router';
-    export declare class PatternRouter<T> implements Router<T> {
-        #private;
-        name: string;
-        add(method: string, path: string, handler: T): void;
-        match(method: string, path: string): Result<T>;
-    }
-    `.trim()
-
-    const ast = parseSync('types.d.ts', sourceCode)
-    const result = removePrivateFieldFromSourceCode(ast, sourceCode)
-    expect(result).toBeDefined()
-
-    // expected code should be same, but the `#private;` is replaced with spaces
-    const expected = sourceCode.replace('#private;', ' '.repeat(9))
-    expect(result).toMatch(expected)
-  })
-})
```

**File**: `build/remove-private-fields.ts` (removed, +0/-57)
```diff
@@ -1,57 +0,0 @@
-import { readFile, writeFile } from 'fs/promises'
-import type { PropertyDefinition, ParseResult } from 'oxc-parser'
-import { parseSync, Visitor } from 'oxc-parser'
-
-export async function removePrivateFields(files: string[]) {
-  const start = performance.now()
-  const parsed = await Promise.all(
-    files.map(async (file) => {
-      const sourceCode = await readFile(file, 'utf-8')
-      const ast = parseSync(file, sourceCode)
-      return { file, sourceCode, ast }
-    })
-  )
-
-  await Promise.all(
-    parsed.map(async ({ file, sourceCode, ast }) => {
-      const sourceCodeWithoutPrivateFields = removePrivateFieldFromSourceCode(ast, sourceCode)
-      if (sourceCodeWithoutPrivateFields) {
-        await writeFile(file, sourceCodeWithoutPrivateFields)
-      }
-    })
-  )
-  const end = performance.now()
-  console.log(`Done removing private fields in ${(end - start).toFixed(2)}ms`)
-}
-
-export function removePrivateFieldFromSourceCode(ast: ParseResult, sourceCode: string) {
-  const removals: PropertyDefinition[] = []
-  new Visitor({
-    ClassDeclaration: (node) => {
-      node.body.body.forEach((elem) => {
-        if (elem.type === 'PropertyDefinition' && elem.key.type === 'PrivateIdentifier') {
-          removals.push(elem)
-        }
-      })
-    },
-  }).visit(ast.program)
-
-  if (removals.length === 0) {
-    return
-  }
-
-  let sourceCodeWithoutPrivateFields = sourceCode
-  for (const elem of removals) {
-    sourceCodeWithoutPrivateFields = removeRange(
-      sourceCodeWithoutPrivateFields,
-      elem.start,
-      elem.end
-    )
-  }
-
-  return sourceCodeWithoutPrivateFields
-}
-
-function removeRange(str: string, start: number, end: number) {
-  return str.slice(0, start) + ' '.repeat(end - start) + str.slice(end)
-}
```

**File**: `build/strip-private-fields.ts` (removed, +0/-8)
```diff
@@ -1,8 +0,0 @@
-import { glob } from 'node:fs/promises'
-import { removePrivateFields } from './remove-private-fields.ts'
-
-const dtsEntries: string[] = []
-for await (const file of glob('dist/types/**/*.d.ts')) {
-  dtsEntries.push(file)
-}
-await removePrivateFields(dtsEntries)
```

**File**: `build/validate-exports.test.ts` (removed, +0/-31)
```diff
@@ -1,31 +0,0 @@
-/// <reference types="vitest/globals" />
-
-import { validateExports } from './validate-exports'
-
-const mockExports1 = {
-  './a': './a.ts',
-  './b': './b.ts',
-  './c/a': './c.ts',
-  './d/*': './d/*.ts',
-}
-
-const mockExports2 = {
-  './a': './a.ts',
-  './b': './b.ts',
-  './c/a': './c.ts',
-  './d/a': './d/a.ts',
-}
-
-const mockExports3 = {
-  './a': './a.ts',
-  './c/a': './c.ts',
-  './d/*': './d/*.ts',
-}
-
-describe('validateExports', () => {
-  it('Works', async () => {
-    expect(() => validateExports(mockExports1, mockExports1, 'package.json')).not.toThrowError()
-    expect(() => validateExports(mockExports1, mockExports2, 'jsr.json')).not.toThrowError()
-    expect(() => validateExports(mockExports1, mockExports3, 'package.json')).toThrowError()
-  })
-})
```

**File**: `build/validate-exports.ts` (removed, +0/-37)
```diff
@@ -1,37 +0,0 @@
-export const validateExports = (
-  source: Record<string, unknown>,
-  target: Record<string, unknown>,
-  fileName: string
-) => {
-  const isEntryInTarget = (entry: string): boolean => {
-    if (entry in target) {
-      return true
-    }
-
-    // e.g., "./utils/*" -> "./utils"
-    const wildcardPrefix = entry.replace(/\/\*$/, '')
-    if (entry.endsWith('/*')) {
-      return Object.keys(target).some(
-        (targetEntry) =>
-          targetEntry.startsWith(wildcardPrefix + '/') && targetEntry !== wildcardPrefix
-      )
-    }
-
-    const separatedEntry = entry.split('/')
-    while (separatedEntry.length > 0) {
-      const pattern = `${separatedEntry.join('/')}/*`
-      if (pattern in target) {
-        return true
-      }
-      separatedEntry.pop()
-    }
-
-    return false
-  }
-
-  Object.keys(source).forEach((sourceEntry) => {
-    if (!isEntryInTarget(sourceEntry)) {
-      throw new Error(`Missing "${sourceEntry}" in '${fileName}'`)
-    }
-  })
-}
```

**File**: `build/validate-package-exports.ts` (removed, +0/-9)
```diff
@@ -1,9 +0,0 @@
-import fs from 'node:fs'
-import { validateExports } from './validate-exports.ts'
-
-const readJsonExports = (path: string) => JSON.parse(fs.readFileSync(path, 'utf-8')).exports
-
-const [packageJsonExports, jsrJsonExports] = ['./package.json', './jsr.json'].map(readJsonExports)
-
-validateExports(packageJsonExports, jsrJsonExports, 'jsr.json')
-validateExports(jsrJsonExports, packageJsonExports, 'package.json')
```

**File**: `package.json` (modified, +2/-2)
```diff
@@ -29,7 +29,7 @@
     "format:fix": "vp fmt \"src/**/*.{js,ts,tsx}\" \"runtime-tests/**/*.{js,ts,tsx}\" \"build/**/*.{js,ts,tsx}\" \"perf-measures/**/*.{js,ts,tsx}\" \"benchmarks/**/*.{js,ts,tsx}\"",
     "editorconfig-checker": "editorconfig-checker",
     "copy:package.cjs.json": "cp ./package.cjs.json ./dist/cjs/package.json && cp ./package.cjs.json ./dist/types/package.json",
-    "build": "pnpm run remove-dist && node ./build/validate-package-exports.ts && vp pack && node ./build/strip-private-fields.ts && pnpm run copy:package.cjs.json && publint",
+    "build": "pnpm run remove-dist && vp pack && pnpm run copy:package.cjs.json && publint",
     "watch": "pnpm run remove-dist && vp pack --watch && pnpm run copy:package.cjs.json",
     "coverage": "vp test --run --coverage",
     "prerelease": "pnpm run test:deno && pnpm run build",
@@ -687,9 +687,9 @@
     "jsdom": "22.1.0",
     "msw": "^2.6.0",
     "np": "11.2.1",
-    "oxc-parser": "^0.96.0",
     "pkg-pr-new": "^0.0.53",
     "publint": "0.3.15",
+    "rolldown": "^1.2.10",
     "typescript": "^6.0.3",
     "vite-plugin-fastly-js-compute": "^0.4.2",
     "vite-plus": "1.0.0-rc.0",
```

**File**: `pnpm-lock.yaml` (modified, +171/-188)
```diff
@@ -202,15 +202,15 @@ importers:
       np:
         specifier: 11.2.1
         version: 11.2.1(@types/node@24.13.6)(typescript@6.0.3)
-      oxc-parser:
-        specifier: ^0.96.0
-        version: 0.96.0(@emnapi/core@1.11.3)(@emnapi/runtime@1.11.3)
       pkg-pr-new:
         specifier: ^0.0.53
         version: 0.0.53
       publint:
         specifier: 0.3.15
         version: 0.3.15
+      rolldown:
+        specifier: ^1.2.10
+        version: 1.2.10
       typescript:
         specifier: ^6.0.3
         version: 6.0.3
@@ -1844,190 +1844,95 @@ packages:
     cpu: [arm64]
     os: [android]
 
-  '@oxc-parser/binding-android-arm64@0.96.0':
-    resolution: {integrity: sha512-CofbPOiW1PG+hi8bgElJPK0ioHfw8nt4Vw9d+Q9JuMhygS6LbQyu1W6tIFZ1OPFofeFRdWus3vD29FBx+tvFOA==}
-    engines: {node: ^20.19.0 || >=22.12.0}
-    cpu: [arm64]
-    os: [android]
-
   '@oxc-parser/binding-darwin-arm64@0.76.0':
     resolution: {integrity: sha512-yoQwSom8xsB+JdGsPUU0xxmxLKiF2kdlrK7I56WtGKZilixuBf/TmOwNYJYLRWkBoW5l2/pDZOhBm2luwmLiLw==}
     engines: {node: '>=20.0.0'}
     cpu: [arm64]
     os: [darwin]
 
-  '@oxc-parser/binding-darwin-arm64@0.96.0':
-    resolution: {integrity: sha512-+HZ2L1a/1BsUXYik8XqQwT2Tl5Z3jRQ/RRQiPV9UsB2skKyd91NLDlQlMpdhjLGs9Qe7Y42unFjRg2iHjIiwnw==}
-    engines: {node: ^20.19.0 || >=22.12.0}
-    cpu: [arm64]
-    os: [darwin]
-
   '@oxc-parser/binding-darwin-x64@0.76.0':
     resolution: {integrity: sha512-uRIopPLvr3pf2Xj7f5LKyCuqzIU6zOS+zEIR8UDYhcgJyZHnvBkfrYnfcztyIcrGdQehrFUi3uplmI09E7RdiQ==}
     engines: {node: '>=20.0.0'}
     cpu: [x64]
     os: [darwin]
 
-  '@oxc-parser/binding-darwin-x64@0.96.0':
-    resolution: {integrity: sha512-GC8wH1W0XaCLyTeGsmyaMdnItiYQkqfTcn9Ygc55AWI+m11lCjQeoKDIsDCm/QwrKLCN07u3WWWsuPs5ubfXpA==}
-    engines: {node: ^20.19.0 || >=22.12.0}
-    cpu: [x64]
-    os: [darwin]
-
   '@oxc-parser/binding-freebsd-x64@0.76.0':
     resolution: {integrity: sha512-a0EOFvnOd2FqmDSvH6uWLROSlU6KV/JDKbsYDA/zRLyKcG6HCsmFnPsp8iV7/xr9WMbNgyJi6R5IMpePQlUq7Q==}
     engines: {node: '>=20.0.0'}
     cpu: [x64]
     os: [freebsd]
 
-  '@oxc-parser/binding-freebsd-x64@0.96.0':
-    resolution: {integrity: sha512-8SeXi2FmlN15uPY5oM03cua5RXBDYmY34Uewongv6RUiAaU/kWxLvzuijpyNC+yQ1r4fC2LbWJhAsKpX5qkA6g==}
-    engines: {node: ^20.19.0 || >=22.12.0}
-    cpu: [x64]
-    os: [freebsd]
-
   '@oxc-parser/binding-linux-arm-gnueabihf@0.76.0':
     resolution: {integrity: sha512-ikRYDHL3fOdZwfJKmcdqjlLgkeNZ3Ez0qM8wAev5zlHZ+lY/Ig7qG5SCqPlvuTu+nNQ6zrFFaKvvt69EBKXU/g==}
     engines: {node: '>=20.0.0'}
     cpu: [arm]
     os: [linux]
 
-  '@oxc-parser/binding-linux-arm-gnueabihf@0.96.0':
-    resolution: {integrity: sha512-UEs+Zf6T2/FwQlLgv7gfZsKmY19sl3hK57r2BQVc2eCmCmF/deeqDcWyFjzkNLgdDDucY60PoNhNGClDm605uQ==}
-    engines: {node: ^20.19.0 || >=22.12.0}
-    cpu: [arm]
-    os: [linux]
-
   '@oxc-parser/binding-linux-arm-musleabihf@0.76.0':
     resolution: {integrity: sha512-dtRv5J5MRCLR7x39K8ufIIW4svIc7gYFUaI0YFXmmeOBhK/K2t/CkguPnDroKtsmXIPHDRtmJ1JJYzNcgJl6Wg==}
     engines: {node: '>=20.0.0'}
     cpu: [arm]
     os: [linux]
 
-  '@oxc-parser/binding-linux-arm-musleabihf@0.96.0':
-    resolution: {integrity: sha512-1kuWvjR2+ORJMoyxt9LSbLcDhXZnL25XOuv9VmH6NmSPvLgewzuubSlm++W03x+U7SzWFilBsdwIHtD/0mjERw==}
-    engines: {node: ^20.19.0 || >=22.12.0}
-    cpu: [arm]
-    os: [linux]
-
   '@oxc-parser/binding-linux-arm64-gnu@0.76.0':
     resolution: {integrity: sha512-IE4iiiggFH2snagQxHrY5bv6dDpRMMat+vdlMN/ibonA65eOmRLp8VLTXnDiNrcla/itJ1L9qGABHNKU+SnE8g==}
     engines: {node: '>=20.0.0'}
     cpu: [arm64]
     os: [linux]
     libc: [glibc]
 
-  '@oxc-parser/binding-linux-arm64-gnu@0.96.0':
-    resolution: {integrity: sha512-PHH4ETR1t0fymxuhpQNj3Z9t/78/zZa2Lj3Z3I0ZOd+/Ex+gtdhGoB5xYyy7lcYGAPMfZ+Gmr+dTCr1GYNZ3BA==}
-    engines: {node: ^20.19.0 || >=22.12.0}
-    cpu: [arm64]
-    os: [linux]
-    libc: [glibc]
-
   '@oxc-parser/binding-linux-arm64-musl@0.76.0':
     resolution: {integrity: sha512-wi9zQPMDHrBuRuT7Iurfidc9qlZh7cKa5vfYzOWNBCaqJdgxmNOFzvYen02wVUxSWGKhpiPHxrPX0jdRyJ8Npg==}
     engines: {node: '>=20.0.0'}
     cpu: [arm64]
     os: [linux]
     libc: [musl]
 
-  '@oxc-parser/binding-linux-arm64-musl@0.96.0':
-    resolution: {integrity: sha512-fjDPbZjkqaDSTBe0FM8nZ9zBw4B/NF/I0gH7CfvNDwIj9smISaNFypYeomkvubORpnbX9ORhvhYwg3TxQ60OGA==}
-    engines: {node: ^20.19.0 || >=22.12.0}
-    cpu: [arm64]
-    os: [linux]
-    libc: [musl]
-
   '@oxc-parser/binding-linux-riscv64-gnu@0.76.0':
     resolution: {integrity: sha512-0tqqu1pqPee2lLGY8vtYlX1L415fFn89e0a3yp4q5N9f03j1rRs0R31qesTm3bt/UK8HYjECZ+56FCVPs2MEMQ==}
     engines: {node: '>=20.0.0'}
     cpu: [riscv64]
     os: [linux]
     libc: [glibc]
 
-  '@oxc-parser/binding-linux-riscv64-gnu@0.96.0':
-    resolution: {integrity: sha512-59KAHd/6/LmjkdSAuJn0piKmwSavMasWNUKuYLX/UnqI5KkGIp14+LBwwaBG6KzOtIq1NrRCnmlL4XSEaNkzTg==}
-    engines: {node: ^20.19.0 || >=22.12.0}
-    cpu: [riscv64]
-    os: [linux]
-    libc: [glibc]
-
   '@oxc-parser/bindin
```

---

### Incident Patch 10: `90d02fb1` (2026-09-25)
**Commit Message**: fix(types): allow returning a Blob as a response body (#5446)

**File**: `src/context.test.ts` (modified, +10/-0)
```diff
@@ -129,6 +129,16 @@ describe('Context', () => {
     })
   })
 
+  it('c.body() - Blob', async () => {
+    const res = c.body(new Blob(['Hi']))
+    expect(await res.text()).toBe('Hi')
+  })
+
+  it('c.body() - File', async () => {
+    const res = c.body(new File(['Hi'], 'greeting.txt'))
+    expect(await res.text()).toBe('Hi')
+  })
+
   it('c.header()', async () => {
     c.header('X-Foo', 'Bar')
     const res = c.body('Hi')
```

**File**: `src/context.ts` (modified, +2/-2)
```diff
@@ -21,9 +21,9 @@ type HeaderRecord =
   | Record<string, string | string[]>
 
 /**
- * Data type can be a string, ArrayBuffer, Uint8Array (buffer), or ReadableStream.
+ * Data type can be a string, ArrayBuffer, Blob, Uint8Array (buffer), or ReadableStream.
  */
-export type Data = string | ArrayBuffer | ReadableStream | Uint8Array<ArrayBuffer>
+export type Data = string | ArrayBuffer | Blob | ReadableStream | Uint8Array<ArrayBuffer>
 
 /**
  * Interface for the execution context in a web worker or similar environment.
```

**File**: `src/middleware/serve-static/index.test.ts` (modified, +15/-0)
```diff
@@ -1,6 +1,21 @@
 import { serveStatic as baseServeStatic } from '.'
 import { Hono } from '../../hono'
 
+describe('Serve Static Middleware with a Blob body', () => {
+  it('Should serve content returned as a Blob', async () => {
+    const app = new Hono()
+    app.use(
+      '/static/*',
+      baseServeStatic({
+        getContent: async (path) => new Blob([`Hello in ${path}`]),
+      })
+    )
+    const res = await app.request('http://localhost/static/hello.txt')
+    expect(res.status).toBe(200)
+    expect(await res.text()).toBe('Hello in static/hello.txt')
+  })
+})
+
 describe('Serve Static Middleware', () => {
   const app = new Hono()
   const getContent = vi.fn(async (path) => {
```

---

### Incident Patch 11: `6cadf753` (2026-09-22)
**Commit Message**: fix(lambda-edge): fail with a descriptive error on a malformed event (#5358)

`createRequest()` and `handle()` dereferenced `event.Records[0].cf.request`
nine times without a guard, so an event that is not a Lambda@Edge event
escaped as `Cannot read properties of undefined (reading '0')`, which names
neither the adapter nor the missing field.

Read the record once through `getCloudFrontRecord()`, which throws a
`TypeError` naming `Records[0].cf.request` when it is absent, and pass it
down to `createRequest()`. Behaviour for well-formed events is unchanged,
and hoisting the repeated property chain into a local also trims the
minified output.

Also harden two crashes of the same class on otherwise valid events:
`Object.entries()` over an absent `request.headers` threw `Cannot convert
undefined or null to object`, and `config.distributionDomainName` was read
without a guard when falling back for the host.

Closes #4417

**File**: `src/adapter/lambda-edge/handler.test.ts` (modified, +70/-0)
```diff
@@ -378,3 +378,73 @@ describe('handle', () => {
     expect(res).not.toHaveProperty('bodyEncoding')
   })
 })
+
+describe('handle with a malformed event', () => {
+  const invalidEventMessage =
+    'Unable to map the CloudFront event to a Request: expected `Records[0].cf.request` in the Lambda@Edge event.'
+
+  it('Should reject with a descriptive error when Records holds no CloudFront record', async () => {
+    const app = new Hono()
+    const handler = handle(app)
+
+    // The payload the AWS Lambda console prefills is an array of dummy ids.
+    const event = { Records: ['foo', 'bar'] } as unknown as CloudFrontEdgeEvent
+
+    await expect(handler(event)).rejects.toThrow(TypeError)
+    await expect(handler(event)).rejects.toThrow(invalidEventMessage)
+  })
+
+  it('Should reject with a descriptive error when Records is empty or absent', async () => {
+    const app = new Hono()
+    const handler = handle(app)
+
+    for (const event of [{ Records: [] }, {}] as unknown as CloudFrontEdgeEvent[]) {
+      await expect(handler(event)).rejects.toThrow(invalidEventMessage)
+    }
+  })
+
+  it('Should reject with a descriptive error when cf carries no request', async () => {
+    const app = new Hono()
+    const handler = handle(app)
+
+    const event = {
+      Records: [{ cf: { config: { distributionDomainName: 'd111111abcdef8.cloudfront.net' } } }],
+    } as unknown as CloudFrontEdgeEvent
+
+    await expect(handler(event)).rejects.toThrow(invalidEventMessage)
+  })
+
+  it('Should fall back to the distribution domain name when the request has no headers', async () => {
+    const app = new Hono()
+    app.get('/test-path', (c) => c.text(c.req.url))
+    const handler = handle(app)
+
+    const event = {
+      Records: [
+        {
+          cf: {
+            config: {
+              distributionDomainName: 'd111111abcdef8.cloudfront.net',
+              distributionId: 'EDFDVBD6EXAMPLE',
+              eventType: 'viewer-request',
+              requestId: '4TyzHTaYWb1GX1qTfsHhEqV6HUDd_BzoBZnwfnvQc_1oF26ClkoUSEQ==',
+            },
+            request: {
+              clientIp: '1.2.3.4',
+              method: 'GET',
+              querystring: '',
+              uri: '/test-path',
+            },
+          },
+        },
+      ],
+    } as unknown as CloudFrontEdgeEvent
+
+    const res = await handler(event)
+
+    expect(res).toMatchObject({
+      status: '200',
+      body: 'https://d111111abcdef8.cloudfront.net/test-path',
+    })
+  })
+})
```

**File**: `src/adapter/lambda-edge/handler.ts` (modified, +31/-13)
```diff
@@ -125,7 +125,8 @@ export const handle = (
     const [context, callback] = args
     let callbackError: Error | null = null
     let callbackResult: CloudFrontResult | CloudFrontRequest | undefined
-    const res = await app.fetch(createRequest(event), {
+    const cf = getCloudFrontRecord(event)
+    const res = await app.fetch(createRequest(cf), {
       event,
       context,
       callback: (err: Error | null, result?: CloudFrontResult | CloudFrontRequest) => {
@@ -135,9 +136,9 @@ export const handle = (
         }
         callback?.(err, result)
       },
-      config: event.Records[0].cf.config,
-      request: event.Records[0].cf.request,
-      response: event.Records[0].cf.response,
+      config: cf.config,
+      request: cf.request,
+      response: cf.response,
     })
     if (callbackError) {
       throw callbackError
@@ -161,21 +162,38 @@ const createResult = async (res: Response): Promise<CloudFrontResult> => {
   }
 }
 
-const createRequest = (event: CloudFrontEdgeEvent): Request => {
-  const queryString = event.Records[0].cf.request.querystring
-  const host =
-    event.Records[0].cf.request.headers?.host?.[0]?.value ||
-    event.Records[0].cf.config.distributionDomainName
-  const urlPath = `https://${host}${event.Records[0].cf.request.uri}`
+/**
+ * Reads the CloudFront record out of a Lambda@Edge event.
+ *
+ * The event is supplied by the runtime, so a malformed one means the function
+ * was invoked with something other than a Lambda@Edge event. Fail with a
+ * message naming the adapter and the missing field, rather than letting an
+ * unattributable property access error escape.
+ */
+const getCloudFrontRecord = (event: CloudFrontEdgeEvent): CloudFrontEvent['cf'] => {
+  const cf = event?.Records?.[0]?.cf
+  if (!cf?.request) {
+    throw new TypeError(
+      'Unable to map the CloudFront event to a Request: expected `Records[0].cf.request` in the Lambda@Edge event.'
+    )
+  }
+  return cf
+}
+
+const createRequest = (cf: CloudFrontEvent['cf']): Request => {
+  const request = cf.request
+  const queryString = request.querystring
+  const host = request.headers?.host?.[0]?.value || cf.config?.distributionDomainName
+  const urlPath = `https://${host}${request.uri}`
   const url = queryString ? `${urlPath}?${queryString}` : urlPath
 
   const headers = new Headers()
-  Object.entries(event.Records[0].cf.request.headers).forEach(([k, v]) => {
+  Object.entries(request.headers ?? {}).forEach(([k, v]) => {
     v.forEach((header) => headers.append(k, header.value))
   })
 
-  const requestBody = event.Records[0].cf.request.body
-  const method = event.Records[0].cf.request.method
+  const requestBody = request.body
+  const method = request.method
   const rawBody = createBody(method, requestBody)
 
   let body: string | Uint8Array<ArrayBuffer> | undefined = rawBody
```

---

### Incident Patch 12: `de310ac0` (2026-09-22)
**Commit Message**: fix(lambda-edge): sync content type detection with aws-lambda (#5426)

**File**: `src/adapter/lambda-edge/handler.test.ts` (modified, +25/-12)
```diff
@@ -7,18 +7,31 @@ import type { Callback, CloudFrontEdgeEvent, CloudFrontRequest } from './handler
 import { createBody, handle, isContentTypeBinary } from './handler'
 
 describe('isContentTypeBinary', () => {
-  it('Should determine whether it is binary', () => {
-    expect(isContentTypeBinary('image/png')).toBe(true)
-    expect(isContentTypeBinary('font/woff2')).toBe(true)
-    expect(isContentTypeBinary('image/svg+xml')).toBe(false)
-    expect(isContentTypeBinary('image/svg+xml; charset=UTF-8')).toBe(false)
-    expect(isContentTypeBinary('text/plain')).toBe(false)
-    expect(isContentTypeBinary('text/plain; charset=UTF-8')).toBe(false)
-    expect(isContentTypeBinary('text/css')).toBe(false)
-    expect(isContentTypeBinary('text/javascript')).toBe(false)
-    expect(isContentTypeBinary('application/json')).toBe(false)
-    expect(isContentTypeBinary('application/ld+json')).toBe(false)
-    expect(isContentTypeBinary('application/json')).toBe(false)
+  it.each([
+    ['image/png', true],
+    ['font/woff2', true],
+    ['image/svg+xml', false],
+    ['image/svg+xml; charset=UTF-8', false],
+    ['text/plain', false],
+    ['text/plain; charset=UTF-8', false],
+    ['text/css', false],
+    ['text/javascript', false],
+    ['application/json', false],
+    ['application/ld+json', false],
+    ['application/json', false],
+    ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', true],
+    ['application/msword', true],
+    ['application/epub+zip', true],
+    ['application/ld+json', false],
+    ['application/vnd.oasis.opendocument.text', true],
+    ['application/vnd.apple.installer+xml', true],
+    ['application/vnd.apple.installer+xml; charset=UTF-8', true],
+    ['application/vnd.mozilla.xul+xml', true],
+    ['APPLICATION/VND.APPLE.INSTALLER+XML', true],
+    ['APPLICATION/JSON', false],
+    ['TEXT/PLAIN', false],
+  ])('Should determine whether %s it is binary', (mimeType: string, expected: boolean) => {
+    expect(isContentTypeBinary(mimeType)).toBe(expected)
   })
 })
 
```

**File**: `src/adapter/lambda-edge/handler.ts` (modified, +5/-1)
```diff
@@ -212,7 +212,11 @@ export const createBody = (
 }
 
 export const isContentTypeBinary = (contentType: string): boolean => {
-  return !/^(text\/(plain|html|css|javascript|csv).*|application\/(.*json|.*xml).*|image\/svg\+xml.*)$/.test(
+  if (/^application\/vnd\.(?:apple\.installer|mozilla\.xul)\+xml\s*(?:;|$)/i.test(contentType)) {
+    return true
+  }
+
+  return !/^text\/(?:plain|html|css|javascript|csv)|(?:\/|\+)(?:json|xml)\s*(?:;|$)/i.test(
     contentType
   )
 }
```

---

### Incident Patch 13: `28e8572c` (2026-09-21)
**Commit Message**: fix(aws-lambda): preserve empty query parameters (#5292)

AWS event maps distinguish an empty string from an absent value. Retain empty values in API Gateway v1 and ALB request URLs so presence checks and validators see the original input.

**File**: `src/adapter/aws-lambda/handler.test.ts` (modified, +39/-0)
```diff
@@ -237,6 +237,45 @@ describe('EventProcessor.createRequest', () => {
     expect(url.searchParams.get('ampersand')).toBe('a&b&c')
   })
 
+  it('Should preserve empty query parameters for version 1.0', () => {
+    const event: LambdaEvent = {
+      ...baseV1Event,
+      queryStringParameters: {
+        empty: '',
+        present: '0',
+        omitted: undefined,
+      },
+    }
+
+    const request = getProcessor(event).createRequest(event)
+
+    expect(request.url).toBe(
+      'https://id.execute-api.us-east-1.amazonaws.com/my/path?empty=&present=0'
+    )
+  })
+
+  it('Should preserve empty query parameters for ALB events', () => {
+    const event: LambdaEvent = {
+      httpMethod: 'GET',
+      path: '/my/path',
+      headers: { host: 'example.test' },
+      body: null,
+      isBase64Encoded: false,
+      queryStringParameters: {
+        empty: '',
+        present: '0',
+        omitted: undefined,
+      },
+      requestContext: {
+        elb: { targetGroupArn: 'arn:aws:elasticloadbalancing:...' },
+      },
+    }
+
+    const request = getProcessor(event).createRequest(event)
+
+    expect(request.url).toBe('https://example.test/my/path?empty=&present=0')
+  })
+
   it('Should return valid Request object from version 1.0 API Gateway event', () => {
     const event: LambdaEvent = {
       ...baseV1Event,
```

**File**: `src/adapter/aws-lambda/handler.ts` (modified, +2/-2)
```diff
@@ -465,7 +465,7 @@ export class EventV1Processor extends EventProcessor<APIGatewayProxyEvent> {
         .join('&')
     } else {
       return Object.entries(event.queryStringParameters || {})
-        .filter(([, value]) => value)
+        .filter(([, value]) => value !== undefined)
         .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value || '')}`)
         .join('&')
     }
@@ -555,7 +555,7 @@ export class ALBProcessor extends EventProcessor<ALBProxyEvent> {
         .join('&')
     } else {
       return Object.entries(event.queryStringParameters || {})
-        .filter(([, value]) => value)
+        .filter(([, value]) => value !== undefined)
         .map(([key, value]) => `${key}=${value}`)
         .join('&')
     }
```

---

### Incident Patch 14: `0d86899d` (2026-09-21)
**Commit Message**: fix(aws-lambda): treat binary +xml archive media types as binary (#5424)

* fix(aws-lambda): treat binary +xml archive media types as binary

* remove the comment

**File**: `src/adapter/aws-lambda/handler.test.ts` (modified, +6/-0)
```diff
@@ -107,6 +107,12 @@ describe('isContentTypeBinary', () => {
     ['application/epub+zip', true],
     ['application/ld+json', false],
     ['application/vnd.oasis.opendocument.text', true],
+    ['application/vnd.apple.installer+xml', true],
+    ['application/vnd.apple.installer+xml; charset=UTF-8', true],
+    ['application/vnd.mozilla.xul+xml', true],
+    ['APPLICATION/VND.APPLE.INSTALLER+XML', true],
+    ['APPLICATION/JSON', false],
+    ['TEXT/PLAIN', false],
   ])('Should determine whether %s it is binary', (mimeType: string, expected: boolean) => {
     expect(defaultIsContentTypeBinary(mimeType)).toBe(expected)
   })
```

**File**: `src/adapter/aws-lambda/handler.ts` (modified, +5/-1)
```diff
@@ -668,7 +668,11 @@ const isLatticeEventV2 = (event: LambdaEvent): event is LatticeProxyEventV2 => {
  * @returns True if the content type is binary, false otherwise.
  */
 export const defaultIsContentTypeBinary = (contentType: string): boolean => {
-  return !/^text\/(?:plain|html|css|javascript|csv)|(?:\/|\+)(?:json|xml)\s*(?:;|$)/.test(
+  if (/^application\/vnd\.(?:apple\.installer|mozilla\.xul)\+xml\s*(?:;|$)/i.test(contentType)) {
+    return true
+  }
+
+  return !/^text\/(?:plain|html|css|javascript|csv)|(?:\/|\+)(?:json|xml)\s*(?:;|$)/i.test(
     contentType
   )
 }
```

---

### Incident Patch 15: `52febbcc` (2026-09-20)
**Commit Message**: fix(jwt): throw JwtTokenInvalid when the signature is not valid base64url (#5379)

* fix(jwt): throw JwtTokenInvalid when the signature is not valid base64url

verify() decoded the signature part with decodeBase64Url outside any
try/catch, so a token whose third part contains characters outside the
base64url alphabet rejected with a raw InvalidCharacterError DOMException
instead of JwtTokenInvalid, unlike the header and payload parts. Wrap the
decode so the typed error is thrown consistently.

* test(jwt): assert the error class for invalid base64url signatures

Replace the uninitialized-variable and @ts-ignore pattern with a
type-safe rejection assertion that checks the JwtTokenInvalid class and
its documented message, so the test also fails if verification resolves
or rejects with the raw decoding error. Add a control asserting an
empty signature still reports JwtTokenSignatureMismatched.

---------

Co-authored-by: ndycode <[REDACTED_EMAIL]>

**File**: `src/utils/jwt/jwt.test.ts` (modified, +14/-0)
```diff
@@ -92,6 +92,20 @@ describe('JWT', () => {
     expect(authorized).toBeUndefined()
   })
 
+  it('JwtTokenInvalid for a signature that is not valid base64url', async () => {
+    const tok = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJtZXNzYWdlIjoiaGVsbG8gd29ybGQifQ.@@@@'
+    const err = await JWT.verify(tok, 'a-secret', AlgorithmTypes.HS256).catch((e: unknown) => e)
+    expect(err).toBeInstanceOf(JwtTokenInvalid)
+    expect(err).toHaveProperty('message', `invalid JWT token: ${tok}`)
+  })
+
+  it('JwtTokenSignatureMismatched for an empty signature', async () => {
+    const tok = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJtZXNzYWdlIjoiaGVsbG8gd29ybGQifQ.'
+    const err = await JWT.verify(tok, 'a-secret', AlgorithmTypes.HS256).catch((e: unknown) => e)
+    expect(err).toBeInstanceOf(JwtTokenSignatureMismatched)
+    expect(err).toHaveProperty('message', `token(${tok}) signature mismatched`)
+  })
+
   it('JwtTokenNotBefore', async () => {
     const tok =
       'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpYXQiOjE2NjQ2MDYzMzQsImV4cCI6MTY2NDYwOTkzNCwibmJmIjoiMzEwNDYwNjI2NCJ9.hpSDT_cfkxeiLWEpWVT8TDxFP3dFi27q1K7CcMcLXHc'
```

**File**: `src/utils/jwt/jwt.ts` (modified, +7/-6)
```diff
@@ -174,12 +174,13 @@ export const verify = async (
   }
 
   const headerPayload = token.substring(0, token.lastIndexOf('.'))
-  const verified = await verifying(
-    publicKey,
-    alg,
-    decodeBase64Url(tokenParts[2]),
-    utf8Encoder.encode(headerPayload)
-  )
+  let signature: Uint8Array<ArrayBuffer>
+  try {
+    signature = decodeBase64Url(tokenParts[2])
+  } catch {
+    throw new JwtTokenInvalid(token)
+  }
+  const verified = await verifying(publicKey, alg, signature, utf8Encoder.encode(headerPayload))
   if (!verified) {
     throw new JwtTokenSignatureMismatched(token)
   }
```

#### Recent Merged Pull Requests:
- **PR #5527** (2026-10-05): docs(readme): sync the contributing list with CONTRIBUTING.md (@yusukebe)
- **PR #5526** (2026-10-05): docs(contributing): ask for issues instead of RPs (@yusukebe)
- **PR #5517** (2026-10-04): docs(migration): add the non-Error throw change for v5 (@yusukebe)
- **PR #5516** (2026-10-04): fix(package.json): use the ESM-only layout for the mount export (@yusukebe)
- **PR #5515** (2026-10-04): docs(migration): add the ESM-only change for v5 (@yusukebe)
- **PR #5513** (2026-10-04): fix(hono): handle non-Error throws with onError (@usualoma)
- **PR #5511** (2026-10-04): chore!: remove deprecated `app.mount()` (@yusukebe)
- **PR #5510** (2026-10-04): fix(router): respect strict trailing-slash routing (@usualoma)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
