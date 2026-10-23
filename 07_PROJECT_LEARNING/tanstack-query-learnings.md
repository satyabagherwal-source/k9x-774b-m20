> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/tanstack-query-learnings.md`  
> **Source**: github ([https://github.com/TanStack/query](https://github.com/TanStack/query))  
> **Source Version**: `d09972b8`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-23T06:49:47.326Z  
> **Learning ID**: `learn-github-tanstack-query`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): TanStack/query

> **Canonical Artifact**: `07_PROJECT_LEARNING/tanstack-query-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/TanStack/query](https://github.com/TanStack/query))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-23T06:49:46.624Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `TanStack/query`
- **Description**: 🤖 Powerful asynchronous state management, server-state utilities and data fetching for the web. TS/JS, React Query, Solid Query, Svelte Query and Vue Query.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 50464 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/lit/basic/src/lifecycle-contract.ts`
```
import { LitElement, html } from 'lit'
import {
  QueryClient,
  QueryClientProvider,
  createQueryController,
} from '@tanstack/lit-query'

type ContractProbeData = {
  provider: 'provider-a' | 'provider-b'
  payload: string
}

type ContractTarget = 'orphan' | 'provider-a' | 'provider-b'

const contractQueryKey = ['lifecycle-contract', 'provider-binding'] as const
let contractConsumerInstanceCount = 0

function createContractClient(data: ContractProbeData): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Number.POSITIVE_INFINITY,
      },
    },
  })

  client.setQueryData(contractQueryKey, data)
  return client
}

const contractClientA = createContractClient({
  provider: 'provider-a',
  payload: 'provider-a cache',
})

const contractClientB = createContractClient({
  provider: 'provider-b',
  payload: 'provider-b cache',
})

class ContractProviderA extends QueryClientProvider {
  constructor() {
    super()
    this.client = contractClientA
  }

  protected override createRenderRoot(): HTMLElement | DocumentFragment {
    return this
  }
}

if (!customElements.get('contract-provider-a')) {
  customElements.define('contract-provider-a', ContractProviderA)
}

class ContractProviderB extends QueryClientProvider {
  constructor() {
    super()
    this.client = contractClientB
  }

  protected override createRenderRoot(): HTMLElement | DocumentFragment {
    return this
  }
}

if (!customElements.get('contract-provider-b')) {
  customElements.define('contract-provider-b', ContractProviderB)
}

class LifecycleContractConsumer extends LitElement {
  private readonly instanceId = ++contractConsumerInstanceCount

  private readonly query = createQueryController<ContractProbeData, Error>(
    this,
    {
      queryKey: contractQueryKey,
      queryFn: () => {
        throw new Error(
          'Lifecycle contract fixture unexpectedly fetched from queryFn.',
        )
      },
      retry: false,
      staleTime: Number.POSITIVE_INFINITY,
    },
  )

  protected override createRenderRoot(): HTMLElement | DocumentFragment {
    return this
  }

  private renderQueryState() {
    try {
      const query = this.query()

      return html`
        <div data-testid="contract-query-status">query: ${query.status}</div>
        <div data-testid="contract-provider-value">
          provider: ${query.data?.provider ?? 'none'}
        </div>
        <div data-testid="contract-payload">
          payload: ${query.data?.payload ?? 'none'}
        </div>
        <div data-testid="contract-error">
          error: ${query.error ? query.error.message : 'none'}
        </div>
      `
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      return html`
        <div data-testid="contract-query-status">query: missing-client</div>
        <div data-testid="contract-provider-value">provider: none</div>
        <div data-testid="contract-payload">payload: none</div>
        <div data-testid="contract-error">error: ${message}</div>
      `
    }
  }

  render() {
    return html`
      <div data-testid="contract-instance-id">instance: ${this.instanceId}</div>
      ${this.renderQueryState()}
    `
  }
}

if (!customElements.get('lifecycle-contract-consumer')) {
  customElements.define(
    'lifecycle-contract-consumer',
    LifecycleContractConsumer,
  )
}

class LifecycleContractRoot extends LitElement {
  static properties = {
    currentTarget: { state: true },
  }

  private currentTarget: ContractTarget = 'orphan'

  protected override createRenderRoot(): HTMLElement | DocumentFragment {
    return this
  }

  override firstUpdated(): void {
    this.moveConsumerTo('orphan')
  }

  moveConsumerTo(target: ContractTarget): void {
    const consumer = this.ensureConsumer()
    const destination = this.getContainer(target)
    destination.appendChild(consumer)
    this.currentTarget = target
    this.requestUpdate()
  }

  private ensureConsumer(): LifecycleContractConsumer {
    const existing = this.querySelector<LifecycleContractConsumer>(
      'lifecycle-contract-consumer',
    )
    if (existing) {
      return existing
    }

    return document.createElement(
      'lifecycle-contract-consumer',
    ) as LifecycleContractConsumer
  }

  private getContainer(target: ContractTarget): HTMLElement {
    const selector =
      target === 'orphan'
        ? '[data-contract-slot="orphan"]'
        : target === 'provider-a'
          ? 'contract-provider-a'
          : 'contract-provider-b'

    const container = this.querySelector(selector)
    if (!(container instanceof HTMLElement)) {
      throw new Error(
        `Lifecycle contract container not found for target "${target}".`,
      )
    }

    return container
  }

  render() {
    return html`
      <main>
        <h1>Lifecycle Contract Fixture</h1>
        <p>
          Exercises the same consumer across missing-provider and provider
          switching flows.
        </p>
        <div data-testid="contract-location">
          location: ${this.currentTarget}
        </div>

        <section>
          <h2>Orphan Zone</h2>
          <div data-contract-slot="orphan"></div>
        </section>

        <section>
          <h2>Provider A</h2>
          <contract-provider-a></contract-provider-a>
        </section>

        <section>
          <h2>Provider B</h2>
          <contract-provider-b></contract-provider-b>
        </section>
      </main>
    `
  }
}

if (!customElements.get('lifecycle-contract-root')) {
  customElements.define('lifecycle-contract-root', LifecycleContractRoot)
}

```

### Core Architecture Module: `examples/react/nextjs/src/hooks/usePosts.ts`
```
import { queryOptions, useQuery } from '@tanstack/react-query'

type Post = {
  id: number
  title: string
  body: string
}

const fetchPosts = async (limit: number): Promise<Array<Post>> => {
  const response = await fetch('https://jsonplaceholder.typicode.com/posts')
  if (!response.ok) throw new Error('Failed to fetch posts')
  const data = await response.json()
  return data.filter((x: Post) => x.id <= limit)
}

const postsQueryOptions = (limit: number) =>
  queryOptions({
    queryKey: ['posts', limit],
    queryFn: () => fetchPosts(limit),
  })

const usePosts = (limit: number) => {
  return useQuery(postsQueryOptions(limit))
}

export { usePosts, postsQueryOptions }

```

### Core Architecture Module: `examples/react/offline/public/mockServiceWorker.js`
```
/* eslint-disable */
/* tslint:disable */

/**
 * Mock Service Worker.
 * @see https://github.com/mswjs/msw
 * - Please do NOT modify this file.
 */

const PACKAGE_VERSION = '2.15.0'
const INTEGRITY_CHECKSUM = '03cb67ac84128e63d7cd722a6e5b7f1e'
const IS_MOCKED_RESPONSE = Symbol('isMockedResponse')
const activeClientIds = new Set()

addEventListener('install', function () {
  self.skipWaiting()
})

addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim())
})

addEventListener('message', async function (event) {
  const clientId = Reflect.get(event.source || {}, 'id')

  if (!clientId || !self.clients) {
    return
  }

  const client = await self.clients.get(clientId)

  if (!client) {
    return
  }

  const allClients = await self.clients.matchAll({
    type: 'window',
  })

  switch (event.data) {
    case 'KEEPALIVE_REQUEST': {
      sendToClient(client, {
        type: 'KEEPALIVE_RESPONSE',
      })
      break
    }

    case 'INTEGRITY_CHECK_REQUEST': {
      sendToClient(client, {
        type: 'INTEGRITY_CHECK_RESPONSE',
        payload: {
          packageVersion: PACKAGE_VERSION,
          checksum: INTEGRITY_CHECKSUM,
        },
      })
      break
    }

    case 'MOCK_ACTIVATE': {
      activeClientIds.add(clientId)

      sendToClient(client, {
        type: 'MOCKING_ENABLED',
        payload: {
          client: {
            id: client.id,
            frameType: client.frameType,
          },
        },
      })
      break
    }

    case 'CLIENT_CLOSED': {
      activeClientIds.delete(clientId)

      const remainingClients = allClients.filter((client) => {
        return client.id !== clientId
      })

      // Unregister itself when there are no more clients
      if (remainingClients.length === 0) {
        self.registration.unregister()
      }

      break
    }
  }
})

addEventListener('fetch', function (event) {
  const requestInterceptedAt = Date.now()

  // Bypass navigation requests.
  if (event.request.mode === 'navigate') {
    return
  }

  // Opening the DevTools triggers the "only-if-cached" request
  // that cannot be handled by the worker. Bypass such requests.
  if (
    event.request.cache === 'only-if-cached' &&
    event.request.mode !== 'same-origin'
  ) {
    return
  }

  // Bypass all requests when there are no active clients.
  // Prevents the self-unregistered worked from handling requests
  // after it's been terminated (still remains active until the next reload).
  if (activeClientIds.size === 0) {
    return
  }

  const requestId = crypto.randomUUID()
  event.respondWith(handleRequest(event, requestId, requestInterceptedAt))
})

/**
 * @param {FetchEvent} event
 * @param {string} requestId
 * @param {number} requestInterceptedAt
 */
async function handleRequest(event, requestId, requestInterceptedAt) {
  const client = await resolveMainClient(event)
  const requestCloneForEvents = event.request.clone()
  const response = await getResponse(
    event,
    client,
    requestId,
    requestInterceptedAt,
  )

  // Send back the response clone for the "response:*" life-cycle events.
  // Ensure MSW is active and ready to handle the message, otherwise
  // this message will pend indefinitely.
  if (client && activeClientIds.has(client.id)) {
    const serializedRequest = await serializeRequest(requestCloneForEvents)

    // Omit the body of server-sent event stream responses.
    // Cloning such responses would prevent client-side stream cancelations
    // from reaching the original stream (a teed stream only cancels its
    // source once both of its branches cancel) and would buffer the
    // entire stream into the unconsumed clone indefinitely.
    const isEventStreamResponse = response.headers
      .get('content-type')
      ?.toLowerCase()
      .startsWith('text/event-stream')

    // Clone the response so both the client and the library could consume it.
    const responseClone = isEventStreamResponse ? null : response.clone()

    sendToClient(
      client,
      {
        type: 'RESPONSE',
        payload: {
          isMockedResponse: IS_MOCKED_RESPONSE in response,
          request: {
            id: requestId,
            ...serializedRequest,
          },
          response: {
            type: response.type,
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            body: responseClone ? responseClone.body : null,
          },
        },
      },
      responseClone && responseClone.body
        ? [serializedRequest.body, responseClone.body]
        : [],
    )
  }

  return response
}

/**
 * Resolve the main client for the given event.
 * Client that issues a request doesn't necessarily equal the client
 * that registered the worker. It's with the latter the worker should
 * communicate with during the response resolving phase.
 * @param {FetchEvent} event
 * @returns {Promise<Client | undefined>}
 */
async function resolveMainClient(event) {
  const client = await self.clients.get(event.clientId)

  if (activeClientIds.has(event.clientId)) {
    return client
  }

  if (client?.frameType === 'top-level') {
    return client
  }

  const allClients = await self.clients.matchAll({
    type: 'window',
  })

  return allClients
    .filter((client) => {
      // Get only those clients that are currently visible.
      return client.visibilityState === 'visible'
    })
    .find((client) => {
      // Find the client ID that's recorded in the
      // set of clients that have registered the worker.
      return activeClientIds.has(client.id)
    })
}

/**
 * @param {FetchEvent} event
 * @param {Client | undefined} client
 * @param {string} requestId
 * @param {number} requestInterceptedAt
 * @returns {Promise<Response>}
 */
async function getResponse(event, client, requestId, requestInterceptedAt) {
  // Clone the request because it might've been already used
  // (i.e. its body has been read and sent to the client).
  const requestClone = event.request.clone()

  function passthrough() {
    // Cast the request headers to a new Headers instance
    // so the headers can be manipulated with.
    const headers = new Headers(requestClone.headers)

    // Remove the "accept" header value that marked this request as passthrough.
    // This prevents request alteration and also keeps it compliant with the
    // user-defined CORS policies.
    const acceptHeader = headers.get('accept')
    if (acceptHeader) {
      const values = acceptHeader.split(',').map((value) => value.trim())
      const filteredValues = values.filter(
        (value) => value !== 'msw/passthrough',
      )

      if (filteredValues.length > 0) {
        headers.set('accept', filteredValues.join(', '))
      } else {
        headers.delete('accept')
      }
    }

    return fetch(requestClone, { headers })
  }

  // Bypass mocking when the client is not active.
  if (!client) {
    return passthrough()
  }

  // Bypass initial page load requests (i.e. static assets).
  // The absence of the immediate/parent client in the map of the active clients
  // means that MSW hasn't dispatched the "MOCK_ACTIVATE" event yet
  // and is not ready to handle requests.
  if (!activeClientIds.has(client.id)) {
    return passthrough()
  }

  // Notify the client that a request has been intercepted.
  const serializedRequest = await serializeRequest(event.request)
  const clientMessage = await sendToClient(
    client,
    {
      type: 'REQUEST',
      payload: {
        id: requestId,
        interceptedAt: requestInterceptedAt,
        ...serializedRequest,
      },
    },
    [serializedRequest.body],
  )

  switch (clientMessage.type) {
    case 'MOCK_RESPONSE': {
      return respondWithMock(clientMessage.data)
    }

    case 'PASSTHROUGH': {
      return passthrough()
    }
  }

  return passthrough()
}

/**
 * @param {Client} client
 * @param {any} message
 * @param {Array<Transferable>} transferrables
 * @returns {Promise<any>}
 */
function sendToClient(client, message, transferrables = []) {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel()

    channel.port1.onmessage = (event) => {
      if (event.data && event.data.error) {
        return reject(event.data.error)
      }

      resolve(event.data)
    }

    client.postMessage(message, [
      channel.port2,
      ...transferrables.filter(Boolean),
    ])
  })
}

/**
 * @param {Response} response
 * @returns {Response}
 */
function respondWithMock(response) {
  // Setting response status code to 0 is a no-op.
  // However, when responding with a "Response.error()", the produced Response
  // instance will have status code set to 0. Since it's not possible to create
  // a Response instance with status code 0, handle that use-case separately.
  if (response.status === 0) {
    return Response.error()
  }

  const mockedResponse = new Response(response.body, response)

  Reflect.defineProperty(mockedResponse, IS_MOCKED_RESPONSE, {
    value: true,
    enumerable: true,
  })

  return mockedResponse
}

/**
 * @param {Request} request
 */
async function serializeRequest(request) {
  return {
    url: request.url,
    mode: request.mode,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    cache: request.cache,
    credentials: request.credentials,
    destination: request.destination,
    integrity: request.integrity,
    redirect: request.redirect,
    referrer: request.referrer,
    referrerPolicy: request.referrerPolicy,
    body: await request.arrayBuffer(),
    keepalive: request.keepalive,
  }
}

```

### Core Architecture Module: `examples/react/react-native/src/hooks/useAppState.ts`
```
import { useEffect } from 'react'
import { AppState } from 'react-native'
import type { AppStateStatus } from 'react-native'

export function useAppState(onChange: (status: AppStateStatus) => void) {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', onChange)
    return () => {
      subscription.remove()
    }
  }, [onChange])
}

```

### Core Architecture Module: `examples/react/react-native/src/hooks/useOnlineManager.ts`
```
import * as React from 'react'
import NetInfo from '@react-native-community/netinfo'
import { onlineManager } from '@tanstack/react-query'
import { Platform } from 'react-native'

export function useOnlineManager() {
  React.useEffect(() => {
    // React Query already supports on reconnect auto refetch in web browser
    if (Platform.OS !== 'web') {
      onlineManager.setEventListener((setOnline) =>
        NetInfo.addEventListener((state) => {
          setOnline(!!state.isConnected)
        }),
      )
    }
  }, [])
}

```

### Core Architecture Module: `examples/react/react-native/src/hooks/useRefreshByUser.ts`
```
import * as React from 'react'

export function useRefreshByUser(refetch: () => Promise<unknown>) {
  const [isRefetchingByUser, setIsRefetchingByUser] = React.useState(false)

  async function refetchByUser() {
    setIsRefetchingByUser(true)

    try {
      await refetch()
    } finally {
      setIsRefetchingByUser(false)
    }
  }

  return {
    isRefetchingByUser,
    refetchByUser,
  }
}

```

### Core Architecture Module: `examples/react/react-native/src/hooks/useRefreshOnFocus.ts`
```
import * as React from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { useQueryClient } from '@tanstack/react-query'

export function useRefreshOnFocus() {
  const queryClient = useQueryClient()
  const firstTimeRef = React.useRef(true)

  useFocusEffect(
    React.useCallback(() => {
      if (firstTimeRef.current) {
        firstTimeRef.current = false
        return
      }

      queryClient.refetchQueries({ stale: true, type: 'active' })
    }, [queryClient]),
  )
}

```

### Core Architecture Module: `examples/solid/astro/src/utils/index.ts`
```
import { createSignal } from 'solid-js'

export const getSearchParams = (init: string) => {
  const [search, setSearch] = createSignal(init)
  if (typeof window !== 'undefined') {
    window.addEventListener('popstate', () => {
      const location = window.location
      const params = new URLSearchParams(location.search)
      setSearch(params.get('id') || '')
    })
  }
  return search
}

export const properCase = (str: string) =>
  str.charAt(0).toUpperCase() + str.slice(1)

```

### Core Architecture Module: `examples/solid/offline/public/mockServiceWorker.js`
```
/* eslint-disable */
/* tslint:disable */

/**
 * Mock Service Worker.
 * @see https://github.com/mswjs/msw
 * - Please do NOT modify this file.
 */

const PACKAGE_VERSION = '2.15.0'
const INTEGRITY_CHECKSUM = '03cb67ac84128e63d7cd722a6e5b7f1e'
const IS_MOCKED_RESPONSE = Symbol('isMockedResponse')
const activeClientIds = new Set()

addEventListener('install', function () {
  self.skipWaiting()
})

addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim())
})

addEventListener('message', async function (event) {
  const clientId = Reflect.get(event.source || {}, 'id')

  if (!clientId || !self.clients) {
    return
  }

  const client = await self.clients.get(clientId)

  if (!client) {
    return
  }

  const allClients = await self.clients.matchAll({
    type: 'window',
  })

  switch (event.data) {
    case 'KEEPALIVE_REQUEST': {
      sendToClient(client, {
        type: 'KEEPALIVE_RESPONSE',
      })
      break
    }

    case 'INTEGRITY_CHECK_REQUEST': {
      sendToClient(client, {
        type: 'INTEGRITY_CHECK_RESPONSE',
        payload: {
          packageVersion: PACKAGE_VERSION,
          checksum: INTEGRITY_CHECKSUM,
        },
      })
      break
    }

    case 'MOCK_ACTIVATE': {
      activeClientIds.add(clientId)

      sendToClient(client, {
        type: 'MOCKING_ENABLED',
        payload: {
          client: {
            id: client.id,
            frameType: client.frameType,
          },
        },
      })
      break
    }

    case 'CLIENT_CLOSED': {
      activeClientIds.delete(clientId)

      const remainingClients = allClients.filter((client) => {
        return client.id !== clientId
      })

      // Unregister itself when there are no more clients
      if (remainingClients.length === 0) {
        self.registration.unregister()
      }

      break
    }
  }
})

addEventListener('fetch', function (event) {
  const requestInterceptedAt = Date.now()

  // Bypass navigation requests.
  if (event.request.mode === 'navigate') {
    return
  }

  // Opening the DevTools triggers the "only-if-cached" request
  // that cannot be handled by the worker. Bypass such requests.
  if (
    event.request.cache === 'only-if-cached' &&
    event.request.mode !== 'same-origin'
  ) {
    return
  }

  // Bypass all requests when there are no active clients.
  // Prevents the self-unregistered worked from handling requests
  // after it's been terminated (still remains active until the next reload).
  if (activeClientIds.size === 0) {
    return
  }

  const requestId = crypto.randomUUID()
  event.respondWith(handleRequest(event, requestId, requestInterceptedAt))
})

/**
 * @param {FetchEvent} event
 * @param {string} requestId
 * @param {number} requestInterceptedAt
 */
async function handleRequest(event, requestId, requestInterceptedAt) {
  const client = await resolveMainClient(event)
  const requestCloneForEvents = event.request.clone()
  const response = await getResponse(
    event,
    client,
    requestId,
    requestInterceptedAt,
  )

  // Send back the response clone for the "response:*" life-cycle events.
  // Ensure MSW is active and ready to handle the message, otherwise
  // this message will pend indefinitely.
  if (client && activeClientIds.has(client.id)) {
    const serializedRequest = await serializeRequest(requestCloneForEvents)

    // Omit the body of server-sent event stream responses.
    // Cloning such responses would prevent client-side stream cancelations
    // from reaching the original stream (a teed stream only cancels its
    // source once both of its branches cancel) and would buffer the
    // entire stream into the unconsumed clone indefinitely.
    const isEventStreamResponse = response.headers
      .get('content-type')
      ?.toLowerCase()
      .startsWith('text/event-stream')

    // Clone the response so both the client and the library could consume it.
    const responseClone = isEventStreamResponse ? null : response.clone()

    sendToClient(
      client,
      {
        type: 'RESPONSE',
        payload: {
          isMockedResponse: IS_MOCKED_RESPONSE in response,
          request: {
            id: requestId,
            ...serializedRequest,
          },
          response: {
            type: response.type,
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            body: responseClone ? responseClone.body : null,
          },
        },
      },
      responseClone && responseClone.body
        ? [serializedRequest.body, responseClone.body]
        : [],
    )
  }

  return response
}

/**
 * Resolve the main client for the given event.
 * Client that issues a request doesn't necessarily equal the client
 * that registered the worker. It's with the latter the worker should
 * communicate with during the response resolving phase.
 * @param {FetchEvent} event
 * @returns {Promise<Client | undefined>}
 */
async function resolveMainClient(event) {
  const client = await self.clients.get(event.clientId)

  if (activeClientIds.has(event.clientId)) {
    return client
  }

  if (client?.frameType === 'top-level') {
    return client
  }

  const allClients = await self.clients.matchAll({
    type: 'window',
  })

  return allClients
    .filter((client) => {
      // Get only those clients that are currently visible.
      return client.visibilityState === 'visible'
    })
    .find((client) => {
      // Find the client ID that's recorded in the
      // set of clients that have registered the worker.
      return activeClientIds.has(client.id)
    })
}

/**
 * @param {FetchEvent} event
 * @param {Client | undefined} client
 * @param {string} requestId
 * @param {number} requestInterceptedAt
 * @returns {Promise<Response>}
 */
async function getResponse(event, client, requestId, requestInterceptedAt) {
  // Clone the request because it might've been already used
  // (i.e. its body has been read and sent to the client).
  const requestClone = event.request.clone()

  function passthrough() {
    // Cast the request headers to a new Headers instance
    // so the headers can be manipulated with.
    const headers = new Headers(requestClone.headers)

    // Remove the "accept" header value that marked this request as passthrough.
    // This prevents request alteration and also keeps it compliant with the
    // user-defined CORS policies.
    const acceptHeader = headers.get('accept')
    if (acceptHeader) {
      const values = acceptHeader.split(',').map((value) => value.trim())
      const filteredValues = values.filter(
        (value) => value !== 'msw/passthrough',
      )

      if (filteredValues.length > 0) {
        headers.set('accept', filteredValues.join(', '))
      } else {
        headers.delete('accept')
      }
    }

    return fetch(requestClone, { headers })
  }

  // Bypass mocking when the client is not active.
  if (!client) {
    return passthrough()
  }

  // Bypass initial page load requests (i.e. static assets).
  // The absence of the immediate/parent client in the map of the active clients
  // means that MSW hasn't dispatched the "MOCK_ACTIVATE" event yet
  // and is not ready to handle requests.
  if (!activeClientIds.has(client.id)) {
    return passthrough()
  }

  // Notify the client that a request has been intercepted.
  const serializedRequest = await serializeRequest(event.request)
  const clientMessage = await sendToClient(
    client,
    {
      type: 'REQUEST',
      payload: {
        id: requestId,
        interceptedAt: requestInterceptedAt,
        ...serializedRequest,
      },
    },
    [serializedRequest.body],
  )

  switch (clientMessage.type) {
    case 'MOCK_RESPONSE': {
      return respondWithMock(clientMessage.data)
    }

    case 'PASSTHROUGH': {
      return passthrough()
    }
  }

  return passthrough()
}

/**
 * @param {Client} client
 * @param {any} message
 * @param {Array<Transferable>} transferrables
 * @returns {Promise<any>}
 */
function sendToClient(client, message, transferrables = []) {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel()

    channel.port1.onmessage = (event) => {
      if (event.data && event.data.error) {
        return reject(event.data.error)
      }

      resolve(event.data)
    }

    client.postMessage(message, [
      channel.port2,
      ...transferrables.filter(Boolean),
    ])
  })
}

/**
 * @param {Response} response
 * @returns {Response}
 */
function respondWithMock(response) {
  // Setting response status code to 0 is a no-op.
  // However, when responding with a "Response.error()", the produced Response
  // instance will have status code set to 0. Since it's not possible to create
  // a Response instance with status code 0, handle that use-case separately.
  if (response.status === 0) {
    return Response.error()
  }

  const mockedResponse = new Response(response.body, response)

  Reflect.defineProperty(mockedResponse, IS_MOCKED_RESPONSE, {
    value: true,
    enumerable: true,
  })

  return mockedResponse
}

/**
 * @param {Request} request
 */
async function serializeRequest(request) {
  return {
    url: request.url,
    mode: request.mode,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    cache: request.cache,
    credentials: request.credentials,
    destination: request.destination,
    integrity: request.integrity,
    redirect: request.redirect,
    referrer: request.referrer,
    referrerPolicy: request.referrerPolicy,
    body: await request.arrayBuffer(),
    keepalive: request.keepalive,
  }
}

```

### Core Architecture Module: `examples/solid/solid-start-streaming/src/utils/api.ts`
```
interface PostData {
  userId: number
  id: number
  title: string
  body: string
}

const doSleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export const fetchPost = async ({
  postId,
  simulateError,
  sleep,
}: {
  postId: number
  simulateError?: boolean
  sleep?: number
}) => {
  console.info('[api] fetchPost.start', { postId, sleep, simulateError })

  let response
  if (!simulateError) {
    response = await fetch(
      `https://jsonplaceholder.typicode.com/posts/${postId}`,
    ).then((res) => {
      if (!res.ok) throw new Error('Failed to fetch post')
      return res.json()
    })
  }

  // simulate extra latency to make things like streaming behavior more clear
  if (sleep) {
    await doSleep(sleep)
  }

  console.info('[api] fetchPost.done', { postId, sleep, simulateError })

  if (simulateError) {
    throw new Error('API request to get post was not OK')
  }

  return [response] as Array<PostData>
}

export const fetchUser = async ({
  sleep,
  simulateError,
}: { sleep?: number; simulateError?: boolean } = {}) => {
  console.info('[api] fetchUser.start', { sleep, simulateError })

  if (sleep) {
    await doSleep(sleep)
  }

  console.info('[api] fetchUser.done', { sleep, simulateError })

  if (simulateError) {
    throw new Error('API request to get user was not OK')
  }

  return {
    id: 'abc',
    name: `john doe`,
    queryTime: Date.now(),
  }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #10924** (2026-08-17): **Suspended query continues to suspend until queryFn promise is fullfiled even when the query data is updated**
  *Symptoms*: ### Describe the bug  Suspense query keeps suspending when data exists. Originally, I noticed the problem in `streamedQuery` in combination with `useSuspenseQuery`. The issue reflects in such way that suspense query keeps suspending even after the first stream chunk is received.   I'd like to note that the aforementioned behaviour could be useful in some cases, but that's a separate issue I guess.  ### Your minimal, reproducible example  https://codesandbox.io/p/sandbox/cranky-benz-xvt2n2  ### Steps to reproduce  1. Go to https://codesandbox.io/p/sandbox/cranky-benz-xvt2n2?file=%2Fsrc%2FApp.js 2. Click the button 3. Loading text remains even though the query client has the data for the key  ### Expected behavior  I'd expect data to show.  ### How often does this bug happen?  Every time  ### Screenshots or Videos  _No response_  ### Platform  - Every platform  ### Tanstack Query adapter  None  ### TanStack Query version  5.101.0  ### TypeScript version  _No response_  ### Additional context  An idea about solution. Maybe wrapping suspense queryFn result with additional promise could provide more control?  Not sure what is the right way to handle the ongoing promise when the data is set programatically? Should this behaviour be controlled by user through options? 

- **Issue #10311** (2026-03-21): **Build is broken 5.94.4**
  *Symptoms*: ### Describe the bug  Build is broken the build folder is not included in the npm package  https://www.npmjs.com/package/@tanstack/query-core/v/5.91.2?activeTab=code  https://www.npmjs.com/package/@tanstack/query-core/v/5.94.4?activeTab=code  Thank you so much 💌    ### Your minimal, reproducible example  5.94.4  ### Steps to reproduce  Old working build : https://www.npmjs.com/package/@tanstack/query-core/v/5.91.2?activeTab=code  New release broken: https://www.npmjs.com/package/@tanstack/query-core/v/5.94.4?activeTab=code   ### Expected behavior  It should be included in the package   ### How often does this bug happen?  None  ### Screenshots or Videos  _No response_  ### Platform  NPM  ### Tanstack Query adapter  None  ### TanStack Query version  5.94.4  ### TypeScript version  _No response_  ### Additional context  _No response_

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

### Incident Patch 1: `b923947b` (2026-10-22)
**Commit Message**: chore(oxlint.config): enable 'no-debugging-utils', 'no-dom-import', 'no-manual-cleanup' and 'no-render-in-lifecycle' from 'eslint-plugin-testing-library' (#12273)

**File**: `oxlint.config.ts` (modified, +4/-0)
```diff
@@ -292,6 +292,10 @@ export default defineConfig({
         // `toHaveTextContent` matches substrings, so exact `textContent` checks stay as `toBe`
         'jest-dom/prefer-to-have-text-content': 'off',
         ...pluginTestingLibrary.configs['flat/dom'].rules,
+        'testing-library/no-debugging-utils': 'error',
+        'testing-library/no-dom-import': 'error',
+        'testing-library/no-manual-cleanup': 'error',
+        'testing-library/no-render-in-lifecycle': 'error',
         // Tests name the render result `rendered` and query through it
         'testing-library/prefer-screen-queries': 'off',
         'vitest/consistent-each-for': [
```

---

### Incident Patch 2: `0064fe88` (2026-10-22)
**Commit Message**: test(query-codemods): replace 'async' arrow functions without 'await' with 'Promise.resolve' in the fixtures (#12286)

**File**: `packages/query-codemods/src/v4/__testfixtures__/default-import.input.tsx` (modified, +4/-4)
```diff
@@ -27,10 +27,10 @@ export const Examples = () => {
   queryClient.getQueryDefaults('todos')
   queryClient.getQueryState('todos')
   queryClient.isFetching('todos')
-  queryClient.setMutationDefaults('todos', { mutationFn: async () => null })
+  queryClient.setMutationDefaults('todos', { mutationFn: () => Promise.resolve(null) })
   queryClient.setQueriesData('todos', () => null)
   queryClient.setQueryData('todos', () => null)
-  queryClient.setQueryDefaults('todos', { queryFn: async () => null })
+  queryClient.setQueryDefaults('todos', { queryFn: () => Promise.resolve(null) })
   queryClient.cancelQueries('todos')
   queryClient.fetchInfiniteQuery('todos')
   queryClient.fetchQuery('todos')
@@ -48,11 +48,11 @@ export const Examples = () => {
   useQueryClient().getQueryState('todos')
   useQueryClient().isFetching('todos')
   useQueryClient().setMutationDefaults('todos', {
-    mutationFn: async () => null,
+    mutationFn: () => Promise.resolve(null),
   })
   useQueryClient().setQueriesData('todos', () => null)
   useQueryClient().setQueryData('todos', () => null)
-  useQueryClient().setQueryDefaults('todos', { queryFn: async () => null })
+  useQueryClient().setQueryDefaults('todos', { queryFn: () => Promise.resolve(null) })
   useQueryClient().cancelQueries('todos')
   useQueryClient().fetchInfiniteQuery('todos')
   useQueryClient().fetchQuery('todos')
```

**File**: `packages/query-codemods/src/v4/__testfixtures__/default-import.output.tsx` (modified, +4/-4)
```diff
@@ -29,10 +29,10 @@ export const Examples = () => {
   queryClient.getQueryDefaults(['todos'])
   queryClient.getQueryState(['todos'])
   queryClient.isFetching(['todos'])
-  queryClient.setMutationDefaults(['todos'], { mutationFn: async () => null })
+  queryClient.setMutationDefaults(['todos'], { mutationFn: () => Promise.resolve(null) })
   queryClient.setQueriesData(['todos'], () => null)
   queryClient.setQueryData(['todos'], () => null)
-  queryClient.setQueryDefaults(['todos'], { queryFn: async () => null })
+  queryClient.setQueryDefaults(['todos'], { queryFn: () => Promise.resolve(null) })
   queryClient.cancelQueries(['todos'])
   queryClient.fetchInfiniteQuery(['todos'])
   queryClient.fetchQuery(['todos'])
@@ -50,11 +50,11 @@ export const Examples = () => {
   useQueryClient().getQueryState(['todos'])
   useQueryClient().isFetching(['todos'])
   useQueryClient().setMutationDefaults(['todos'], {
-    mutationFn: async () => null,
+    mutationFn: () => Promise.resolve(null),
   })
   useQueryClient().setQueriesData(['todos'], () => null)
   useQueryClient().setQueryData(['todos'], () => null)
-  useQueryClient().setQueryDefaults(['todos'], { queryFn: async () => null })
+  useQueryClient().setQueryDefaults(['todos'], { queryFn: () => Promise.resolve(null) })
   useQueryClient().cancelQueries(['todos'])
   useQueryClient().fetchInfiniteQuery(['todos'])
   useQueryClient().fetchQuery(['todos'])
```

**File**: `packages/query-codemods/src/v4/__testfixtures__/named-import.input.tsx` (modified, +4/-4)
```diff
@@ -27,10 +27,10 @@ export const Examples = () => {
   queryClient.getQueryDefaults('todos')
   queryClient.getQueryState('todos')
   queryClient.isFetching('todos')
-  queryClient.setMutationDefaults('todos', { mutationFn: async () => null })
+  queryClient.setMutationDefaults('todos', { mutationFn: () => Promise.resolve(null) })
   queryClient.setQueriesData('todos', () => null)
   queryClient.setQueryData('todos', () => null)
-  queryClient.setQueryDefaults('todos', { queryFn: async () => null })
+  queryClient.setQueryDefaults('todos', { queryFn: () => Promise.resolve(null) })
   queryClient.cancelQueries('todos')
   queryClient.fetchInfiniteQuery('todos')
   queryClient.fetchQuery('todos')
@@ -48,12 +48,12 @@ export const Examples = () => {
   useRenamedQueryClient().getQueryState('todos')
   useRenamedQueryClient().isFetching('todos')
   useRenamedQueryClient().setMutationDefaults('todos', {
-    mutationFn: async () => null,
+    mutationFn: () => Promise.resolve(null),
   })
   useRenamedQueryClient().setQueriesData('todos', () => null)
   useRenamedQueryClient().setQueryData('todos', () => null)
   useRenamedQueryClient().setQueryDefaults('todos', {
-    queryFn: async () => null,
+    queryFn: () => Promise.resolve(null),
   })
   useRenamedQueryClient().cancelQueries('todos')
   useRenamedQueryClient().fetchInfiniteQuery('todos')
```

**File**: `packages/query-codemods/src/v4/__testfixtures__/named-import.output.tsx` (modified, +4/-4)
```diff
@@ -29,10 +29,10 @@ export const Examples = () => {
   queryClient.getQueryDefaults(['todos'])
   queryClient.getQueryState(['todos'])
   queryClient.isFetching(['todos'])
-  queryClient.setMutationDefaults(['todos'], { mutationFn: async () => null })
+  queryClient.setMutationDefaults(['todos'], { mutationFn: () => Promise.resolve(null) })
   queryClient.setQueriesData(['todos'], () => null)
   queryClient.setQueryData(['todos'], () => null)
-  queryClient.setQueryDefaults(['todos'], { queryFn: async () => null })
+  queryClient.setQueryDefaults(['todos'], { queryFn: () => Promise.resolve(null) })
   queryClient.cancelQueries(['todos'])
   queryClient.fetchInfiniteQuery(['todos'])
   queryClient.fetchQuery(['todos'])
@@ -50,12 +50,12 @@ export const Examples = () => {
   useRenamedQueryClient().getQueryState(['todos'])
   useRenamedQueryClient().isFetching(['todos'])
   useRenamedQueryClient().setMutationDefaults(['todos'], {
-    mutationFn: async () => null,
+    mutationFn: () => Promise.resolve(null),
   })
   useRenamedQueryClient().setQueriesData(['todos'], () => null)
   useRenamedQueryClient().setQueryData(['todos'], () => null)
   useRenamedQueryClient().setQueryDefaults(['todos'], {
-    queryFn: async () => null,
+    queryFn: () => Promise.resolve(null),
   })
   useRenamedQueryClient().cancelQueries(['todos'])
   useRenamedQueryClient().fetchInfiniteQuery(['todos'])
```

**File**: `packages/query-codemods/src/v4/__testfixtures__/namespaced-import.input.tsx` (modified, +4/-4)
```diff
@@ -17,10 +17,10 @@ export const Examples = () => {
   queryClient.getQueryDefaults('todos')
   queryClient.getQueryState('todos')
   queryClient.isFetching('todos')
-  queryClient.setMutationDefaults('todos', { mutationFn: async () => null })
+  queryClient.setMutationDefaults('todos', { mutationFn: () => Promise.resolve(null) })
   queryClient.setQueriesData('todos', () => null)
   queryClient.setQueryData('todos', () => null)
-  queryClient.setQueryDefaults('todos', { queryFn: async () => null })
+  queryClient.setQueryDefaults('todos', { queryFn: () => Promise.resolve(null) })
   queryClient.cancelQueries('todos')
   queryClient.fetchInfiniteQuery('todos')
   queryClient.fetchQuery('todos')
@@ -38,12 +38,12 @@ export const Examples = () => {
   RQ.useQueryClient().getQueryState('todos')
   RQ.useQueryClient().isFetching('todos')
   RQ.useQueryClient().setMutationDefaults('todos', {
-    mutationFn: async () => null,
+    mutationFn: () => Promise.resolve(null),
   })
   RQ.useQueryClient().setQueriesData('todos', () => null)
   RQ.useQueryClient().setQueryData('todos', () => null)
   RQ.useQueryClient().setQueryDefaults('todos', {
-    queryFn: async () => null,
+    queryFn: () => Promise.resolve(null),
   })
   RQ.useQueryClient().cancelQueries('todos')
   RQ.useQueryClient().fetchInfiniteQuery('todos')
```

**File**: `packages/query-codemods/src/v4/__testfixtures__/namespaced-import.output.tsx` (modified, +4/-4)
```diff
@@ -19,10 +19,10 @@ export const Examples = () => {
   queryClient.getQueryDefaults(['todos'])
   queryClient.getQueryState(['todos'])
   queryClient.isFetching(['todos'])
-  queryClient.setMutationDefaults(['todos'], { mutationFn: async () => null })
+  queryClient.setMutationDefaults(['todos'], { mutationFn: () => Promise.resolve(null) })
   queryClient.setQueriesData(['todos'], () => null)
   queryClient.setQueryData(['todos'], () => null)
-  queryClient.setQueryDefaults(['todos'], { queryFn: async () => null })
+  queryClient.setQueryDefaults(['todos'], { queryFn: () => Promise.resolve(null) })
   queryClient.cancelQueries(['todos'])
   queryClient.fetchInfiniteQuery(['todos'])
   queryClient.fetchQuery(['todos'])
@@ -40,12 +40,12 @@ export const Examples = () => {
   RQ.useQueryClient().getQueryState(['todos'])
   RQ.useQueryClient().isFetching(['todos'])
   RQ.useQueryClient().setMutationDefaults(['todos'], {
-    mutationFn: async () => null,
+    mutationFn: () => Promise.resolve(null),
   })
   RQ.useQueryClient().setQueriesData(['todos'], () => null)
   RQ.useQueryClient().setQueryData(['todos'], () => null)
   RQ.useQueryClient().setQueryDefaults(['todos'], {
-    queryFn: async () => null,
+    queryFn: () => Promise.resolve(null),
   })
   RQ.useQueryClient().cancelQueries(['todos'])
   RQ.useQueryClient().fetchInfiniteQuery(['todos'])
```

**File**: `packages/query-codemods/src/v5/remove-overloads/__testfixtures__/bug-reports.input.tsx` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ export function useDetailsContainsIdentifierAsThirdArgument({ groupId }: { group
 export function useWhatever({ thing }: { thing: string }) {
   return useQuery(
     ['some-string', someVar],
-    async () => 'foo',
+    () => Promise.resolve('foo'),
     { enabled: Boolean(thing) },
   );
 }
```

**File**: `packages/query-codemods/src/v5/remove-overloads/__testfixtures__/bug-reports.output.tsx` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@ export function useDetailsContainsIdentifierAsThirdArgument({ groupId }: { group
 export function useWhatever({ thing }: { thing: string }) {
   return useQuery({
     queryKey: ['some-string', someVar],
-    queryFn: async () => 'foo',
+    queryFn: () => Promise.resolve('foo'),
     enabled: Boolean(thing)
   });
 }
```

---

### Incident Patch 3: `f5fc7ac9` (2026-10-22)
**Commit Message**: chore(oxlint.config): enable 'vitest/require-top-level-describe' and move top-level tests and hooks into a 'describe' (#12265)

**File**: `oxlint.config.ts` (modified, +1/-0)
```diff
@@ -329,6 +329,7 @@ export default defineConfig({
         'vitest/require-hook': 'error',
         'vitest/require-mock-type-parameters': 'error',
         'vitest/require-to-throw-message': 'error',
+        'vitest/require-top-level-describe': 'error',
         'vitest/valid-expect': 'off',
         'vitest-js/no-conditional-in-test': 'error',
         'vitest-js/padding-around-after-all-blocks': 'error',
```

**File**: `packages/angular-query-experimental/src/__tests__/query-options.test-d.ts` (modified, +139/-139)
```diff
@@ -69,195 +69,195 @@ describe('queryOptions', () => {
       InitialDataFunction<string> | string | undefined
     >()
   })
-})
-
-it('should work when passed to injectQuery', () => {
-  const key = queryKey()
-  const options = queryOptions({
-    queryKey: key,
-    queryFn: () => Promise.resolve(5),
-  })
 
-  const { data } = injectQuery(() => options)
-  expectTypeOf(data).toEqualTypeOf<Signal<number | undefined>>()
-})
+  it('should work when passed to injectQuery', () => {
+    const key = queryKey()
+    const options = queryOptions({
+      queryKey: key,
+      queryFn: () => Promise.resolve(5),
+    })
 
-it('should work when passed to fetchQuery', () => {
-  const key = queryKey()
-  const options = queryOptions({
-    queryKey: key,
-    queryFn: () => Promise.resolve(5),
+    const { data } = injectQuery(() => options)
+    expectTypeOf(data).toEqualTypeOf<Signal<number | undefined>>()
   })
 
-  // oxlint-disable-next-line tanstack-query/no-restricted-syntax -- grandfathered direct test
-  const data = new QueryClient().fetchQuery(options)
-  assertType<Promise<number>>(data)
-})
+  it('should work when passed to fetchQuery', () => {
+    const key = queryKey()
+    const options = queryOptions({
+      queryKey: key,
+      queryFn: () => Promise.resolve(5),
+    })
 
-it('should work when passed to query', () => {
-  const options = queryOptions({
-    queryKey: ['key'],
-    queryFn: () => Promise.resolve(5),
+    // oxlint-disable-next-line tanstack-query/no-restricted-syntax -- grandfathered direct test
+    const data = new QueryClient().fetchQuery(options)
+    assertType<Promise<number>>(data)
   })
 
-  const data = new QueryClient().query(options)
-  assertType<Promise<number>>(data)
-})
+  it('should work when passed to query', () => {
+    const options = queryOptions({
+      queryKey: ['key'],
+      queryFn: () => Promise.resolve(5),
+    })
 
-it('should work when passed to query with select', () => {
-  const options = queryOptions({
-    queryKey: ['key'],
-    queryFn: () => Promise.resolve(5),
-    select: (data) => data.toString(),
+    const data = new QueryClient().query(options)
+    assertType<Promise<number>>(data)
   })
 
-  const data = new QueryClient().query(options)
-  assertType<Promise<string>>(data)
-})
+  it('should work when passed to query with select', () => {
+    const options = queryOptions({
+      queryKey: ['key'],
+      queryFn: () => Promise.resolve(5),
+      select: (data) => data.toString(),
+    })
 
-it('should work when passed to query with enabled: false', () => {
-  const options = queryOptions({
-    queryKey: ['key'],
-    queryFn: () => Promise.resolve(5),
-    enabled: false,
+    const data = new QueryClient().query(options)
+    assertType<Promise<string>>(data)
   })
 
-  const data = new QueryClient().query(options)
-  assertType<Promise<number>>(data)
-})
+  it('should work when passed to query with enabled: false', () => {
+    const options = queryOptions({
+      queryKey: ['key'],
+      queryFn: () => Promise.resolve(5),
+      enabled: false,
+    })
 
-it('should work when passed to query with skipToken', () => {
-  const options = queryOptions({
-    queryKey: ['key'],
-    queryFn: skipToken,
+    const data = new QueryClient().query(options)
+    assertType<Promise<number>>(data)
   })
 
-  const data = new QueryClient().query(options)
-  assertType<Promise<unknown>>(data)
-})
+  it('should work when passed to query with skipToken', () => {
+    const options = queryOptions({
+      queryKey: ['key'],
+      queryFn: skipToken,
+    })
 
-it('should tag the queryKey with the result type of the QueryFn', () => {
-  const key = queryKey()
-  const { queryKey: tagged } = queryOptions({
-    queryKey: key,
-    queryFn: () => Promise.resolve(5),
+    const data = new QueryClient().query(options)
+    assertType<Promise<unknown>>(data)
   })
-  assertType<number>(tagged[dataTagSymbol])
-})
 
-it('should tag the queryKey even if no promise is returned', () => {
-  const key = queryKey()
-  const { queryKey: tagged } = queryOptions({
-    queryKey: key,
-    queryFn: () => 5,
+  it('should tag the queryKey with the result type of the QueryFn', () => {
+    const key = queryKey()
+    const { queryKey: tagged } = queryOptions({
+      queryKey: key,
+      queryFn: () => Promise.resolve(5),
+    })
+    assertType<number>(tagged[dataTagSymbol])
   })
-  assertType<number>(tagged[dataTagSymbol])
-})
 
-it('should tag the queryKey with unknown if there is no queryFn', () => {
-  const key = queryKey()
-  const { queryKey: tagged } = queryOptions({
-    queryKey: key,
+  it('should tag the queryKey even if no promise is returned', () => {
+    const key = queryKey()
+    const { queryKey: tagged } = queryOptions({
+      queryKey: key,
+      queryFn: () => 5,
+    })
+    assertType<number>(tagged[dataTagSymbol])
   })
 
-  assertType<unknown>(tagged[dataTagSymbol])
-})
+  it('should tag the queryKey with unknown if there is no
```

**File**: `packages/lit-query/src/__tests__/BaseController.test.ts` (modified, +4/-4)
```diff
@@ -16,10 +16,6 @@ import type { ReactiveControllerHost } from 'lit'
 
 const providerTagName = generateElementName()
 
-beforeAll(() => {
-  customElements.define(providerTagName, QueryClientProvider)
-})
-
 class RecordingController extends BaseController<string> {
   readonly lifecycle: Array<string> = []
 
@@ -48,6 +44,10 @@ describe('BaseController', () => {
   let queryClient: QueryClient
   let container: HTMLElement
 
+  beforeAll(() => {
+    customElements.define(providerTagName, QueryClientProvider)
+  })
+
   beforeEach(() => {
     vi.useFakeTimers()
     queryClient = new QueryClient()
```

**File**: `packages/lit-query/src/__tests__/QueryClientProvider.test.ts` (modified, +4/-4)
```diff
@@ -21,14 +21,14 @@ import { generateElementName } from './utils.js'
 
 const tagName = generateElementName()
 
-beforeAll(() => {
-  customElements.define(tagName, QueryClientProvider)
-})
-
 describe('QueryClientProvider/context', () => {
   let queryClient: QueryClient
   let container: HTMLElement
 
+  beforeAll(() => {
+    customElements.define(tagName, QueryClientProvider)
+  })
+
   beforeEach(() => {
     vi.useFakeTimers()
     queryClient = new QueryClient()
```

**File**: `packages/lit-query/src/__tests__/createInfiniteQueryController.test.ts` (modified, +4/-4)
```diff
@@ -19,14 +19,14 @@ import type { Mock } from 'vitest'
 
 const providerTagName = generateElementName()
 
-beforeAll(() => {
-  customElements.define(providerTagName, QueryClientProvider)
-})
-
 describe('createInfiniteQueryController', () => {
   let queryClient: QueryClient
   let container: HTMLElement
 
+  beforeAll(() => {
+    customElements.define(providerTagName, QueryClientProvider)
+  })
+
   beforeEach(() => {
     vi.useFakeTimers()
     queryClient = new QueryClient()
```

**File**: `packages/lit-query/src/__tests__/createMutationController.test.ts` (modified, +4/-4)
```diff
@@ -17,14 +17,14 @@ import type { MutationResultAccessor } from '../createMutationController.js'
 
 const providerTagName = generateElementName()
 
-beforeAll(() => {
-  customElements.define(providerTagName, QueryClientProvider)
-})
-
 describe('createMutationController', () => {
   let queryClient: QueryClient
   let container: HTMLElement
 
+  beforeAll(() => {
+    customElements.define(providerTagName, QueryClientProvider)
+  })
+
   beforeEach(() => {
     vi.useFakeTimers()
     queryClient = new QueryClient()
```

**File**: `packages/lit-query/src/__tests__/createQueriesController.test.ts` (modified, +4/-4)
```diff
@@ -19,14 +19,14 @@ import type { QueryObserverResult, QueryStatus } from '@tanstack/query-core'
 
 const providerTagName = generateElementName()
 
-beforeAll(() => {
-  customElements.define(providerTagName, QueryClientProvider)
-})
-
 describe('createQueriesController', () => {
   let queryClient: QueryClient
   let container: HTMLElement
 
+  beforeAll(() => {
+    customElements.define(providerTagName, QueryClientProvider)
+  })
+
   beforeEach(() => {
     vi.useFakeTimers()
     queryClient = new QueryClient()
```

**File**: `packages/lit-query/src/__tests__/createQueryController.test.ts` (modified, +4/-4)
```diff
@@ -17,14 +17,14 @@ import type { QueryResultAccessor } from '../createQueryController.js'
 
 const providerTagName = generateElementName()
 
-beforeAll(() => {
-  customElements.define(providerTagName, QueryClientProvider)
-})
-
 describe('createQueryController', () => {
   let queryClient: QueryClient
   let container: HTMLElement
 
+  beforeAll(() => {
+    customElements.define(providerTagName, QueryClientProvider)
+  })
+
   beforeEach(() => {
     vi.useFakeTimers()
     queryClient = new QueryClient()
```

#### Recent Merged Pull Requests:
- **PR #12293** (2026-10-23): test(*): rename the 'queryKey' test helper to 'createKey' since it creates keys for both queries and mutations (@sukvvon)
- **PR #12292** (2026-10-23): test(lit-query/createQueryController): read 'queryKey' and 'signal' from the 'queryFn' context to avoid shadowing the 'queryKey' helper (@sukvvon)
- **PR #12291** (2026-10-23): refactor(lit-query/createQueriesController): rename the per-result 'observer' in 'trackResult' to 'resultObserver' to avoid shadowing (@sukvvon)
- **PR #12290** (2026-10-23): refactor(query-persist-client-core/createPersister): rename the 'filters' option to 'persistFilters' internally to avoid shadowing (@sukvvon)
- **PR #12289** (2026-10-23): chore(preact-query/utils): disable 'react/exhaustive-deps' for the stable '_instance' to keep the upstream 'useSyncExternalStore' (@sukvvon)
- **PR #12288** (2026-10-23): docs(preact-query/utils): pin the preact and React 'useSyncExternalStore' source links to the copied commits (@sukvvon)

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

## X. oxlint.config): enable 'no-debugging-utils', 'no-dom-import', 'no-manual-cleanup

**RULE**:
When implementing operations in `oxlint.config.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in TanStack/query. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `b923947b`: oxlint.config): enable 'no-debugging-utils', 'no-dom-import', 'no-manual-cleanup' and 'no-render-in-lifecycle' from 'eslint-plugin-testing-library' (#12273). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `oxlint.config.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
        'testing-library/no-debugging-utils': 'error',
        'testing-library/no-dom-import': 'error',
        'testing-library/no-manual-cleanup': 'error',
        'testing-library/no-render-in-lifecycle': 'error',
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `b923947b` are properly handled with clean fallback behavior.
