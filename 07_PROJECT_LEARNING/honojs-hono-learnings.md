# Forensic Learning Record (Deep Inspection): honojs/hono

> **Canonical Artifact**: `07_PROJECT_LEARNING/honojs-hono-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/honojs/hono](https://github.com/honojs/hono))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:17:00.836Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `honojs/hono`
- **Description**: Web framework built on Web Standards
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 32390 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `adapters/aws-lambda/src/conninfo.ts`
```
import type { Context } from 'hono'
import type { GetConnInfo } from 'hono/conninfo'
import type {
  ApiGatewayRequestContext,
  ApiGatewayRequestContextV2,
  ALBRequestContext,
} from './types'

type LambdaRequestContext =
  | ApiGatewayRequestContext
  | ApiGatewayRequestContextV2
  | ALBRequestContext

type Env = {
  Bindings: {
    requestContext: LambdaRequestContext
  }
}

/**
 * Get connection information from AWS Lambda
 *
 * Extracts client IP from various Lambda event sources:
 * - API Gateway v1 (REST API): requestContext.identity.sourceIp
 * - API Gateway v2 (HTTP API/Function URLs): requestContext.http.sourceIp
 * - ALB: Falls back to x-forwarded-for header
 *
 * @param c - Context
 * @returns Connection information including remote address
 * @example
 * ```ts
 * import { Hono } from 'hono'
 * import { handle, getConnInfo } from './index'
 *
 * const app = new Hono()
 *
 * app.get('/', (c) => {
 *   const info = getConnInfo(c)
 *   return c.text(`Your IP: ${info.remote.address}`)
 * })
 *
 * export const handler = handle(app)
 * ```
 */
export const getConnInfo: GetConnInfo = (c: Context<Env>) => {
  const requestContext = c.env.requestContext

  let address: string | undefined

  // API Gateway v1 - has identity object
  if ('identity' in requestContext && requestContext.identity?.sourceIp) {
    address = requestContext.identity.sourceIp
  }
  // API Gateway v2 - has http object
  else if ('http' in requestContext && requestContext.http?.sourceIp) {
    address = requestContext.http.sourceIp
  }
  // ALB - use X-Forwarded-For header
  else {
    const xff = c.req.header('x-forwarded-for')
    if (xff) {
      const ips = xff.split(',')
      // ALB appends the real client IP to the end of the header
      address = ips[ips.length - 1].trim()
    }
  }

  return {
    remote: {
      address,
    },
  }
}

```

### Core Architecture Module: `adapters/aws-lambda/src/handler.ts`
```
import { pipeline } from 'node:stream/promises'
import type { Hono } from 'hono'
import type { Env, Schema } from 'hono/types'
import { decodeBase64, encodeBase64 } from 'hono/utils/encode'
import type {
  ALBRequestContext,
  ApiGatewayRequestContext,
  ApiGatewayRequestContextV2,
  Handler,
  LambdaContext,
  LatticeRequestContextV2,
} from './types'

function sanitizeHeaderValue(value: string): string {
  // Check if the value contains non-ASCII characters (char codes > 127)
  // eslint-disable-next-line no-control-regex
  const hasNonAscii = /[^\x00-\x7F]/.test(value)
  if (!hasNonAscii) {
    return value
  }
  return encodeURIComponent(value)
}

export type LambdaEvent =
  | APIGatewayProxyEvent
  | APIGatewayProxyEventV2
  | ALBProxyEvent
  | LatticeProxyEventV2

export interface LatticeProxyEventV2 {
  version: string
  path: string
  method: string
  headers: Record<string, string[] | undefined>
  queryStringParameters: Record<string, string[] | undefined>
  body: string | null
  isBase64Encoded: boolean
  requestContext: LatticeRequestContextV2
}

// When calling HTTP API or Lambda directly through function urls
export interface APIGatewayProxyEventV2 {
  version: string
  routeKey: string
  headers: Record<string, string | undefined>
  multiValueHeaders?: undefined
  cookies?: string[]
  rawPath: string
  rawQueryString: string
  body: string | null
  isBase64Encoded: boolean
  requestContext: ApiGatewayRequestContextV2
  queryStringParameters?: {
    [name: string]: string | undefined
  }
  pathParameters?: {
    [name: string]: string | undefined
  }
  stageVariables?: {
    [name: string]: string | undefined
  }
}

// When calling Lambda through an API Gateway
export interface APIGatewayProxyEvent {
  version: string
  httpMethod: string
  headers: Record<string, string | undefined>
  multiValueHeaders?: {
    [headerKey: string]: string[]
  }
  path: string
  body: string | null
  isBase64Encoded: boolean
  queryStringParameters?: Record<string, string | undefined>
  requestContext: ApiGatewayRequestContext
  resource: string
  multiValueQueryStringParameters?: {
    [parameterKey: string]: string[]
  }
  pathParameters?: Record<string, string>
  stageVariables?: Record<string, string>
}

// When calling Lambda through an Application Load Balancer
export interface ALBProxyEvent {
  httpMethod: string
  headers?: Record<string, string | undefined>
  multiValueHeaders?: Record<string, string[] | undefined>
  path: string
  body: string | null
  isBase64Encoded: boolean
  queryStringParameters?: Record<string, string | undefined>
  multiValueQueryStringParameters?: {
    [parameterKey: string]: string[]
  }
  requestContext: ALBRequestContext
}

type WithHeaders = {
  headers: Record<string, string | string[]>
  multiValueHeaders?: undefined
}
type WithMultiValueHeaders = {
  headers?: undefined
  multiValueHeaders: Record<string, string[]>
}

export type APIGatewayProxyResult = {
  statusCode: number
  statusDescription?: string
  body: string
  cookies?: string[]
  isBase64Encoded: boolean
} & (WithHeaders | WithMultiValueHeaders)

const getRequestContext = (
  event: LambdaEvent
):
  | ApiGatewayRequestContext
  | ApiGatewayRequestContextV2
  | ALBRequestContext
  | LatticeRequestContextV2 => {
  return event.requestContext
}

async function* readWebStream(
  reader: ReadableStreamDefaultReader<Uint8Array>
): AsyncGenerator<Uint8Array> {
  let readResult = await reader.read()
  while (!readResult.done) {
    yield readResult.value
    readResult = await reader.read()
  }
}

const streamToNodeStream = (
  reader: ReadableStreamDefaultReader<Uint8Array>,
  writer: NodeJS.WritableStream
): Promise<void> => pipeline(readWebStream(reader), writer)

export const streamHandle = <
  E extends Env = Env,
  S extends Schema = {},
  BasePath extends string = '/',
>(
  app: Hono<E, S, BasePath>
): Handler => {
  // @ts-expect-error awslambda is not a standard API
  return awslambda.streamifyResponse(
    async (event: LambdaEvent, responseStream: NodeJS.WritableStream, context: LambdaContext) => {
      const processor = getProcessor(event)
      try {
        const req = processor.createRequest(event)
        const requestContext = getRequestContext(event)

        const res = await app.fetch(req, {
          event,
          requestContext,
          context,
        })

        const headers: Record<string, string> = {}
        const cookies: string[] = []
        res.headers.forEach((value, name) => {
          if (name === 'set-cookie') {
            cookies.push(value)
          } else {
            headers[name] = value
          }
        })

        // Check content type
        const httpResponseMetadata = {
          statusCode: res.status,
          headers,
          cookies,
        }

        // Update response stream
        // @ts-expect-error awslambda is not a standard API
        responseStream = awslambda.HttpResponseStream.from(responseStream, httpResponseMetadata)

        if (res.body) {
          await streamToNodeStream(res.body.getReader(), responseStream)
        } else {
          responseStream.write('')
        }
      } catch (error) {
        console.error('Error processing request:', error)
        responseStream.write('Internal Server Error')
      } finally {
        responseStream.end()
      }
    }
  )
}

type HandleOptions = {
  isContentTypeBinary: ((contentType: string) => boolean) | undefined
}

/**
 * Converts a Hono application to an AWS Lambda handler.
 *
 * Accepts events from API Gateway (v1 and v2), Application Load Balancer (ALB),
 * and Lambda Function URLs.
 *
 * @param app - The Hono application instance
 * @param options - Optional configuration
 * @param options.isContentTypeBinary - A function to determine if the content type is binary.
 *                                      If not provided, the default function will be used.
 * @returns Lambda handler function
 *
 * @example
 * ```js
 * import { Hono } from 'hono'
 * import { handle } from './index'
 *
 * const app = new Hono()
 *
 * app.get('/', (c) => c.text('Hello from Lambda'))
 * app.get('/json', (c) => c.json({ message: 'Hello JSON' }))
 *
 * export const handler = handle(app)
 * ```
 *
 * @example
 * ```js
 * // With custom binary content type detection
 * import { handle, defaultIsContentTypeBinary } from './index'
 * export const handler = handle(app, {
 *   isContentTypeBinary: (contentType) => {
 *     if (defaultIsContentTypeBinary(contentType)) {
 *       // default logic same as prior to v4.8.4
 *       return true
 *     }
 *     return contentType.startsWith('image/') || contentType === 'application/pdf'
 *   }
 * })
 * ```
 */
export const handle = <E extends Env = Env, S extends Schema = {}, BasePath extends string = '/'>(
  app: Hono<E, S, BasePath>,
  { isContentTypeBinary }: HandleOptions = { isContentTypeBinary: undefined }
): (<L extends LambdaEvent>(
  event: L,
  lambdaContext?: LambdaContext
) => Promise<
  APIGatewayProxyResult &
    (L extends { multiValueHeaders: Record<string, string[]> }
      ? WithMultiValueHeaders
      : WithHeaders)
>) => {
  // @ts-expect-error conditional return type is not inferable
  return async (event, lambdaContext?) => {
    const processor = getProcessor(event)

    let req, requestContext
    try {
      req = processor.createRequest(event)
      requestContext = getRequestContext(event)
    } catch (error) {
      console.error('Error processing request:', error)
      const errorResponse =
        error instanceof TypeError
          ? new Response('Invalid request', { status: 400 })
          : new Response('Internal Server Error', { status: 500 })
      return processor.createResult(event, errorResponse, { isContentTypeBinary })
    }

    const res = await app.fetch(req, {
      event,
      requestContext,
      lambdaContext,
    })

    return processor.createResult(event, res, { isContentTypeBinary })
  }
}

export abstract class EventProcessor<E extends LambdaEvent> 
```

### Core Architecture Module: `adapters/aws-lambda/src/index.ts`
```
/**
 * @module
 * AWS Lambda Adapter for Hono.
 */

export { handle, streamHandle, defaultIsContentTypeBinary } from './handler'
export { getConnInfo } from './conninfo'
export type { APIGatewayProxyResult, LambdaEvent } from './handler'
export type {
  ApiGatewayRequestContext,
  ApiGatewayRequestContextV2,
  ALBRequestContext,
  LambdaContext,
} from './types'

```

### Core Architecture Module: `adapters/aws-lambda/src/types.ts`
```
/* eslint-disable @typescript-eslint/no-explicit-any */

export interface CognitoIdentity {
  cognitoIdentityId: string
  cognitoIdentityPoolId: string
}

export interface ClientContext {
  client: ClientContextClient

  Custom?: any
  env: ClientContextEnv
}

export interface ClientContextClient {
  installationId: string
  appTitle: string
  appVersionName: string
  appVersionCode: string
  appPackageName: string
}

export interface ClientContextEnv {
  platformVersion: string
  platform: string
  make: string
  model: string
  locale: string
}

/**
 * {@link Handler} context parameter.
 * See {@link https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-context.html AWS documentation}.
 */
export interface LambdaContext {
  callbackWaitsForEmptyEventLoop: boolean
  functionName: string
  functionVersion: string
  invokedFunctionArn: string
  memoryLimitInMB: string
  awsRequestId: string
  logGroupName: string
  logStreamName: string
  identity?: CognitoIdentity | undefined
  clientContext?: ClientContext | undefined

  getRemainingTimeInMillis(): number
}

type Callback<TResult = any> = (error?: Error | string | null, result?: TResult) => void

export type Handler<TEvent = any, TResult = any> = (
  event: TEvent,
  context: LambdaContext,
  callback: Callback<TResult>
) => void | Promise<TResult>

interface ClientCert {
  clientCertPem: string
  subjectDN: string
  issuerDN: string
  serialNumber: string
  validity: {
    notBefore: string
    notAfter: string
  }
}

interface Identity {
  accessKey?: string
  accountId?: string
  caller?: string
  cognitoAuthenticationProvider?: string
  cognitoAuthenticationType?: string
  cognitoIdentityId?: string
  cognitoIdentityPoolId?: string
  principalOrgId?: string
  sourceIp: string
  user?: string
  userAgent: string
  userArn?: string
  clientCert?: ClientCert
}

export interface ApiGatewayRequestContext {
  accountId: string
  apiId: string
  authorizer: {
    claims?: unknown
    scopes?: unknown
  }
  domainName: string
  domainPrefix: string
  extendedRequestId: string
  httpMethod: string
  identity: Identity
  path: string
  protocol: string
  requestId: string
  requestTime: string
  requestTimeEpoch: number
  resourceId?: string
  resourcePath: string
  stage: string
}

interface Authorizer {
  iam?: {
    accessKey: string
    accountId: string
    callerId: string
    cognitoIdentity: null
    principalOrgId: null
    userArn: string
    userId: string
  }
  jwt?: {
    claims: Record<string, string | number | boolean | string[]>
    scopes: string[] | null
  }
  /**
   * The `context` object returned by a Lambda (REQUEST) authorizer.
   * It is `null` when the authorizer returns no context.
   */
  lambda?: Record<string, unknown> | null
}

export interface ApiGatewayRequestContextV2 {
  accountId: string
  apiId: string
  authentication: null
  authorizer: Authorizer
  domainName: string
  domainPrefix: string
  http: {
    method: string
    path: string
    protocol: string
    sourceIp: string
    userAgent: string
  }
  requestId: string
  routeKey: string
  stage: string
  time: string
  timeEpoch: number
}

export interface ALBRequestContext {
  elb: {
    targetGroupArn: string
  }
}

export interface LatticeRequestContextV2 {
  serviceNetworkArn: string
  serviceArn: string
  targetGroupArn: string
  region: string
  timeEpoch: string
  identity: {
    sourceVpcArn?: string
    type?: string
    principal?: string
    principalOrgID?: string
    sessionName?: string
    x509IssuerOu?: string
    x509SanDns?: string
    x509SanNameCn?: string
    x509SanUri?: string
    x509SubjectCn?: string
  }
}

```

### Core Architecture Module: `adapters/aws-lambda/vite.config.ts`
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

### Core Architecture Module: `adapters/bun/src/conninfo.ts`
```
import type { Context } from 'hono'
import type { GetConnInfo } from 'hono/conninfo'
import { getBunServer } from './server'

/**
 * Get ConnInfo with Bun
 * @param c Context
 * @returns ConnInfo
 */
export const getConnInfo: GetConnInfo = (c: Context) => {
  const server = getBunServer<{
    requestIP?: (req: Request) => {
      address: string
      family: string
      port: number
    } | null
  }>(c)

  if (!server) {
    throw new TypeError('env has to include the 2nd argument of fetch.')
  }
  if (typeof server.requestIP !== 'function') {
    throw new TypeError('server.requestIP is not a function.')
  }

  // https://bun.sh/docs/runtime/http/server#server-requestip-request
  // Returns null for closed requests or Unix domain sockets.
  const info = server.requestIP(c.req.raw)

  if (!info) {
    return {
      remote: {},
    }
  }

  return {
    remote: {
      address: info.address,
      addressType: info.family === 'IPv6' || info.family === 'IPv4' ? info.family : undefined,
      port: info.port,
    },
  }
}

```

### Core Architecture Module: `adapters/bun/src/index.ts`
```
/**
 * @module
 * Bun Adapter for Hono.
 */

export { serveStatic } from './serve-static'
export { bunFileSystemModule, toSSG } from './ssg'
export { createBunWebSocket, upgradeWebSocket, websocket } from './websocket'
export type { BunWebSocketData, BunWebSocketHandler } from './websocket'
export { getConnInfo } from './conninfo'
export { getBunServer } from './server'

```

### Core Architecture Module: `adapters/bun/src/serve-static.ts`
```
/* eslint-disable @typescript-eslint/ban-ts-comment */
import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { serveStatic as baseServeStatic } from 'hono/serve-static'
import type { ServeStaticOptions } from 'hono/serve-static'
import type { Env, MiddlewareHandler } from 'hono/types'

export const serveStatic = <E extends Env = Env>(
  options: ServeStaticOptions<E> = {}
): MiddlewareHandler => {
  return async function serveStatic(c, next) {
    const getContent = async (path: string) => {
      // @ts-ignore
      const file = Bun.file(path)
      return (await file.exists()) ? file : null
    }
    const isDir = async (path: string) => {
      let isDir
      try {
        const stats = await stat(path)
        isDir = stats.isDirectory()
      } catch {}
      return isDir
    }
    return baseServeStatic({
      ...options,
      getContent,
      join,
      isDir,
    })(c, next)
  }
}

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

### Incident Patch 1: `afb2068c` (2026-09-30)
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

Co-authored-by: Taku Amano <taku@taaas.jp>

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

### Incident Patch 2: `e5bb2062` (2026-09-30)
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

### Incident Patch 3: `c3053ccf` (2026-09-30)
**Commit Message**: fix(etag): correctly match mixed-case header name in retainedHeader option (#5475)

* fix(etag): correctly match mixed-case header name in retainedHeader option

* refactor(etag): use Set for retainedHeaders

Co-authored-by: Taku Amano <taku@taaas.jp>

---------

Co-authored-by: Taku Amano <taku@taaas.jp>

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

### Incident Patch 4: `be1f7498` (2026-09-30)
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

---

### Incident Patch 5: `1e1207ca` (2026-09-29)
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

### Incident Patch 6: `90d02fb1` (2026-09-25)
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

### Incident Patch 7: `6cadf753` (2026-09-22)
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

### Incident Patch 8: `de310ac0` (2026-09-22)
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

### Incident Patch 9: `28e8572c` (2026-09-21)
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

### Incident Patch 10: `0d86899d` (2026-09-21)
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

#### Recent Merged Pull Requests:
- **PR #5489** (closed): fix(reg-exp-router): match literal `@` and `#` followed by digits in dynamic paths (@RubenPari)
- **PR #5487** (2026-09-30): fix(jsx): add px to numeric gridGap, gridRowGap and gridColumnGap (@sarmah-rup)
- **PR #5486** (2026-09-30): test(build): type-check the bundled declarations from a consumer project (@yusukebe)
- **PR #5485** (2026-09-30): fix(build): keep internal types private in bundled d.ts and avoid a self-referencing JSX.IntrinsicElements (@yusukebe)
- **PR #5482** (closed): fix(jsx): preserve intrinsic element types in bundled declarations (@jeremybanka)
- **PR #5481** (closed): fix(jsx): prevent recursive IntrinsicElements reference in bundled declarations (@agustin18)
- **PR #5479** (2026-09-29): test(serve-static): fix the test (@yusukebe)
- **PR #5477** (closed): fix(bearer-auth): escape double quotes in WWW-Authenticate realm parameter (@MustafaKemal0146)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
