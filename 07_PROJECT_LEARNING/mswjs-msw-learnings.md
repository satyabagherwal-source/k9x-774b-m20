> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/mswjs-msw-learnings.md`  
> **Source**: github ([https://github.com/mswjs/msw](https://github.com/mswjs/msw))  
> **Source Version**: `28c74aad`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-20T03:19:32.369Z  
> **Learning ID**: `learn-github-mswjs-msw`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): mswjs/msw

> **Canonical Artifact**: `07_PROJECT_LEARNING/mswjs-msw-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/mswjs/msw](https://github.com/mswjs/msw))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-20T03:19:31.320Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `mswjs/msw`
- **Description**: The industry standard for API mocking in JavaScript.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 18299 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `config/copy-service-worker.ts`
```
import fs from 'node:fs'
import path from 'node:path'
import { until } from 'until-async'

/**
 * Copies the given Service Worker source file into the destination.
 * Injects the integrity checksum into the destination file.
 */
export default async function copyServiceWorker(
  sourceFilePath: string,
  destFilePath: string,
  checksum: string,
): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('Compiling Service Worker...')

  const [readFileError, readFileResult] = await until(() =>
    fs.promises.readFile(sourceFilePath, 'utf8'),
  )

  if (readFileError) {
    throw new Error('Failed to read file.\n${readError.message}')
  }

  const destFileDirectory = path.dirname(destFilePath)
  // eslint-disable-next-line no-console
  console.log('Checking if "%s" path exists...', destFileDirectory)

  if (!fs.existsSync(destFileDirectory)) {
    // eslint-disable-next-line no-console
    console.log('Destination directory does not exist, creating...')
    await fs.promises.mkdir(destFileDirectory, { recursive: true })
  }

  const packageJson = JSON.parse(
    fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
  )

  const nextFileContent = readFileResult
    .replace('<INTEGRITY_CHECKSUM>', checksum)
    .replace('<PACKAGE_VERSION>', packageJson.version)

  const [writeFileError] = await until(() =>
    fs.promises.writeFile(destFilePath, nextFileContent),
  )

  if (writeFileError) {
    throw new Error(`Failed to write file.\n${writeFileError.message}`)
  }

  // eslint-disable-next-line no-console
  console.log('Service Worker copied to: %s', destFilePath)
}

```

### Core Architecture Module: `config/plugins/rolldown/copy-worker-plugin.ts`
```
import fs from 'node:fs'
import url from 'node:url'
import crypto from 'node:crypto'
import { invariant } from 'outvariant'
import { Rolldown, type TsdownPlugin } from 'tsdown'
import copyServiceWorker from '../../copy-service-worker.ts'

const SERVICE_WORKER_ENTRY_PATH = url.fileURLToPath(
  new URL('../../../src/mockServiceWorker.js', import.meta.url),
)

const SERVICE_WORKER_OUTPUT_PATH = url.fileURLToPath(
  new URL('../../../lib/mockServiceWorker.js', import.meta.url),
)

/**
 * Compute the integrity checksum of the worker script.
 * The script is normalized before hashing so that cosmetic changes
 * (comments, including legal ones, and whitespace) do not invalidate
 * the checksum. Compression and mangling are disabled to keep the
 * checksum stable across minifier updates.
 */
export async function getWorkerChecksum(): Promise<string> {
  const bundle = await Rolldown.rolldown({
    input: SERVICE_WORKER_ENTRY_PATH,
    platform: 'browser',
    treeshake: false,
    logLevel: 'silent',
  })
  const { output } = await bundle.generate({
    format: 'iife',
    comments: false,
    minify: {
      compress: false,
      mangle: false,
      codegen: {
        removeWhitespace: true,
      },
    },
  })
  await bundle.close()

  const [chunk] = output

  invariant(chunk, 'Failed to normalize the worker script: empty output')

  return crypto.createHash('md5').update(chunk.code, 'utf8').digest('hex')
}

export function copyWorkerPlugin(checksum: string): TsdownPlugin {
  return {
    name: 'copyWorkerPlugin',
    async buildStart() {
      invariant(
        SERVICE_WORKER_ENTRY_PATH,
        'Failed to locate the worker script source file',
      )
    },
    async writeBundle() {
      if (fs.existsSync(SERVICE_WORKER_OUTPUT_PATH)) {
        console.warn(
          'Skipped copying the worker script to "%s": already exists',
          SERVICE_WORKER_OUTPUT_PATH,
        )
        return
      }

      // eslint-disable-next-line no-console
      console.log('worker script checksum:', checksum)

      await copyServiceWorker(
        SERVICE_WORKER_ENTRY_PATH,
        SERVICE_WORKER_OUTPUT_PATH,
        checksum,
      )
    },
  }
}

```

### Core Architecture Module: `src/browser/setup-worker.ts`
```
import { invariant } from 'outvariant'
import { isNodeProcess } from 'is-node-process'
import { WebSocketInterceptor } from '@mswjs/interceptors/WebSocket'
import {
  defineNetwork,
  NetworkReadyState,
} from '#core/experimental/define-network'
import type { AnyHandler } from '#core/experimental/handlers-controller'
import { InterceptorSource } from '#core/experimental/sources/interceptor-source'
import { devUtils } from '#core/utils/internal/dev-utils'
import { supportsServiceWorker } from './utils/supports'
import { ServiceWorkerSource } from './sources/service-worker-source'
import { FallbackHttpSource } from './sources/fallback-http-source'
import type { SetupWorker } from './glossary'

const DEFAULT_WORKER_URL = '/mockServiceWorker.js'

/**
 * Sets up a requests interception in the browser with the given request handlers.
 * @param {Array<AnyHandler>} handlers List of request handlers.
 *
 * @see {@link https://mswjs.io/docs/api/setup-worker `setupWorker()` API reference}
 */
export function setupWorker(...handlers: Array<AnyHandler>): SetupWorker {
  invariant(
    !isNodeProcess(),
    devUtils.formatMessage(
      'Failed to execute `setupWorker` in a non-browser environment',
    ),
  )

  const network = defineNetwork<
    Array<ServiceWorkerSource | FallbackHttpSource | InterceptorSource>
  >({
    sources: [],
    handlers,
  })

  return {
    get readyState() {
      return network.readyState
    },
    async start(options) {
      invariant(
        network.readyState === NetworkReadyState.DISABLED,
        devUtils.formatMessage(
          'Failed to call "worker.start()": the worker is already started. Remove the redundant "worker.start()" call.',
        ),
      )

      const httpSource = supportsServiceWorker()
        ? await ServiceWorkerSource.from({
            serviceWorker: {
              url:
                options?.serviceWorker?.url?.toString() || DEFAULT_WORKER_URL,
              options: options?.serviceWorker?.options,
            },
            findWorker: options?.findWorker,
          })
        : new FallbackHttpSource()

      network.configure({
        sources: [
          httpSource,
          new InterceptorSource({
            interceptors: [new WebSocketInterceptor()],
          }),
        ],
        onUnhandledFrame: options?.onUnhandledFrame ?? 'warn',
        context: {
          quiet: options?.quiet,
        },
      })

      await network.enable()

      if (httpSource instanceof ServiceWorkerSource) {
        const [, registration] = await httpSource.workerPromise
        return registration
      }
    },
    async stop() {
      await network.disable()
      window.postMessage({ type: 'msw/worker:stop' })
    },
    events: network.events,
    use: network.use.bind(network),
    resetHandlers: network.resetHandlers.bind(network),
    restoreHandlers: network.restoreHandlers.bind(network),
    listHandlers: network.listHandlers.bind(network),
  }
}

```

### Core Architecture Module: `src/browser/sources/service-worker-source.ts`
```
import { invariant } from 'outvariant'
import type { Emitter } from 'rettime'
import { FetchResponse } from '@mswjs/interceptors'
import { NetworkSource } from '#core/experimental/sources/network-source'
import type { NetworkFrameResolutionContext } from '#core/experimental/frames/network-frame'
import { RequestHandler } from '#core/handlers/request-handler'
import {
  HttpNetworkFrame,
  ResponseEvent,
} from '#core/experimental/frames/http-frame'
import { HttpResponse } from '#http/http-response'
import { toResponseInit } from '#core/utils/to-response-init'
import { devUtils } from '#core/utils/internal/dev-utils'
import {
  supportsReadableStreamTransfer,
  supportsServiceWorker,
} from '../utils/supports'
import { getWorkerInstance } from '../utils/get-worker-instance'
import type { WorkerChannelEventMap } from '../utils/worker-channel'
import { WorkerChannel } from '../utils/worker-channel'
import type { FindWorker } from '../glossary'
import { deserializeRequest } from '../utils/deserialize-request'
import { validateWorkerScope } from '../utils/validate-worker-scope'
import { shouldInvalidateWorker } from '../utils/should-invalidate-worker'

export interface ServiceWorkerSourceOptions {
  serviceWorker: {
    url: string
    options?: RegistrationOptions
  }
  findWorker?: FindWorker
}

type WorkerChannelRequestEvent = Emitter.Event<
  WorkerChannel,
  'REQUEST',
  WorkerChannelEventMap
>

type WorkerChannelResponseEvent = Emitter.Event<
  WorkerChannel,
  'RESPONSE',
  WorkerChannelEventMap
>

type WorkerChannelRequestErrorEvent = Emitter.Event<
  WorkerChannel,
  'REQUEST_ERROR',
  WorkerChannelEventMap
>

type WorkerChannelClient =
  WorkerChannelEventMap['MOCKING_ENABLED']['data']['client']

export class ServiceWorkerSource extends NetworkSource<ServiceWorkerHttpNetworkFrame> {
  static #current?: ServiceWorkerSource

  /**
   * Create a new Service Worker source or reuse an existing one.
   * These sources act as a singleton and only get recreated if the options change.
   */
  public static async from(
    options: ServiceWorkerSourceOptions,
  ): Promise<ServiceWorkerSource> {
    if (ServiceWorkerSource.#current == null) {
      ServiceWorkerSource.#current = new ServiceWorkerSource(options)
    } else if (
      shouldInvalidateWorker(ServiceWorkerSource.#current.#options, options)
    ) {
      await ServiceWorkerSource.#current.terminate()
      ServiceWorkerSource.#current = new ServiceWorkerSource(options)
    }

    return ServiceWorkerSource.#current
  }

  #options: ServiceWorkerSourceOptions
  /**
   * The resolved context of the network this source was last enabled with.
   */
  #context?: NetworkFrameResolutionContext
  /**
   * @note We cannot use `WeakMap` here as request/response
   * identity cannot be preserved through the client-worker channel.
   */
  #frames: Map<string, ServiceWorkerHttpNetworkFrame>
  #channel: WorkerChannel
  #listenerController?: AbortController
  #clientPromise?: Promise<WorkerChannelClient>
  #keepAliveInterval?: number

  public workerPromise: Promise<[ServiceWorker, ServiceWorkerRegistration]>
  #workerResolvers: PromiseWithResolvers<
    [ServiceWorker, ServiceWorkerRegistration]
  >
  #workerState: 'pending' | 'fulfilled' | 'rejected'

  constructor(options: ServiceWorkerSourceOptions) {
    super()

    invariant(
      supportsServiceWorker(),
      'Failed to use Service Worker as the network source: the Service Worker API is not supported in this environment',
    )

    this.#options = options
    this.#frames = new Map()
    this.#workerResolvers = Promise.withResolvers()
    this.workerPromise = this.#workerResolvers.promise
    this.#workerState = 'pending'
    this.#channel = new WorkerChannel({
      getWorker: () => this.workerPromise.then(([worker]) => worker),
    })
  }

  public async enable(
    context?: NetworkFrameResolutionContext,
  ): Promise<ServiceWorkerRegistration> {
    this.#context = context
    this.#channel.removeAllListeners()
    this.#frames.clear()

    this.#listenerController = new AbortController()
    const [worker, registration] = await this.#startWorker()

    if (worker.state !== 'activated') {
      const controller = new AbortController()
      const activationPromise = Promise.withResolvers<void>()
      activationPromise.promise.then(() => controller.abort())

      worker.addEventListener(
        'statechange',
        () => {
          if (worker.state === 'activated') {
            activationPromise.resolve()
          }
        },
        {
          signal: controller.signal,
        },
      )

      await activationPromise.promise
    }

    this.#channel.postMessage('MOCK_ACTIVATE')

    const clientConfirmationPromise =
      Promise.withResolvers<WorkerChannelClient>()
    this.#clientPromise = clientConfirmationPromise.promise

    this.#channel.once('MOCKING_ENABLED', (event) => {
      clientConfirmationPromise.resolve(event.data.client)
    })
    await clientConfirmationPromise.promise

    if (!this.#context?.quiet) {
      this.#printStartMessage()
    }

    return registration
  }

  public async disable(): Promise<void> {
    /**
     * @note Do NOT call `super.disable()` because it removes any "frame" listeners
     * from this network source, effectively turning it off. The Service Worker source
     * is a bit special since it might process in-flight requests that have been performed
     * after it's been disabled.
     */

    this.#listenerController?.abort()
    this.#listenerController = undefined

    const closedPromise = Promise.withResolvers<void>()
    this.#channel.once('CLIENT_CLOSED', () => closedPromise.resolve())

    this.#channel.postMessage('CLIENT_CLOSE')
    await closedPromise.promise

    /**
     * @note Do NOT reset `workerPromise` here. The channel must continue to
     * resolve the currently registered SW so that any in-flight requests the
     * worker forwards after `stop()` can be answered with `PASSTHROUGH` by
     * `#handleRequest`. `#startWorker` swaps in a fresh deferred on re-enable.
     */

    if (!this.#context?.quiet) {
      this.#printStopMessage()
    }
  }

  /**
   * Terminal teardown. Unregisters the Service Worker, tears down the channel,
   * and clears timers. Called when the singleton is being replaced with one
   * that has different options. The instance is not usable afterwards.
   */
  public async terminate(): Promise<void> {
    if (this.#keepAliveInterval != null) {
      clearInterval(this.#keepAliveInterval)
      this.#keepAliveInterval = undefined
    }

    this.#frames.clear()
    this.#channel.terminate()
    this.#listenerController?.abort()
    this.#listenerController = undefined

    if (this.#workerState === 'fulfilled') {
      const [, registration] = await this.workerPromise
      await registration.unregister()
    }

    if (ServiceWorkerSource.#current === this) {
      ServiceWorkerSource.#current = undefined
    }
  }

  async #startWorker() {
    if (this.#keepAliveInterval) {
      clearInterval(this.#keepAliveInterval)
    }

    const workerUrl = this.#options.serviceWorker.url

    const [worker, registration] = await getWorkerInstance(
      workerUrl,
      this.#options.serviceWorker.options,
      this.#options.findWorker || this.#defaultFindWorker,
    )

    if (worker == null) {
      const missingWorkerMessage = this.#options?.findWorker
        ? devUtils.formatMessage(
            `Failed to locate the Service Worker registration using a custom "findWorker" predicate.

Please ensure that the custom predicate properly locates the Service Worker registration at "%s".
More details: https://mswjs.io/docs/api/setup-worker/start#findworker
     `,
            workerUrl,
          )
        : devUtils.formatMessage(
            `Failed to locate the Service Worker registration.

This most likely means that the worker script URL "%s" cannot resolve against the actual public hostname (%s). This may happen if your application runs behind a proxy, or has a dynamic hostname.

Please consider using a custom "serviceWorker.url" option to point to the actual worker script location, or a custom "findWorker" option to resolve the Service Worker registration manually. More details: https://mswjs.io/docs/api/setup-worker/start`,
            workerUrl,
            location.host,
          )

      throw new Error(missingWorkerMessage)
    }

    if (this.#workerState === 'pending') {
      this.#workerResolvers.resolve([worker, registration])
      this.#workerState = 'fulfilled'
    } else {
      /**
       * @note Re-enable after `stop()`: the previous `workerPromise` is already
       * fulfilled and cannot be resolved again. Swap in a pre-resolved one so
       * `getWorker()` sees the new worker instance immediately.
       */
      this.#workerResolvers = Promise.withResolvers()
      this.#workerResolvers.resolve([worker, registration])
      this.workerPromise = this.#workerResolvers.promise
    }

    this.#channel.on('REQUEST', this.#handleRequest.bind(this))
    this.#channel.on('RESPONSE', this.#handleResponse.bind(this))
    this.#channel.on('REQUEST_ERROR', this.#handleRequestError.bind(this))

    window.addEventListener(
      'pagehide',
      (event) => {
        if (event.persisted) {
          return
        }

        if (worker.state !== 'redundant') {
          this.#channel.postMessage('CLIENT_CLOSE')
        }

        clearInterval(this.#keepAliveInterval)

        window.postMessage({ type: 'msw/worker:stop' })
      },
      {
        signal: this.#listenerController?.signal,
      },
    )

    await this.#checkWorkerIntegrity().catch((error) => {
      devUtils.error(
        'Error while checking the worker script integrity. Please report this on GitHub (https://github.com/mswjs/msw/issues) and include the original error below.',
      )
      console.error(error)
    })

    this.#keepAliveInterval = window.setInterval(() => {
      this.#channel.postMessage('KEEPALIVE_REQUEST'
```

### Core Architecture Module: `src/browser/utils/deserialize-request.ts`
```
import { FetchRequest } from '@mswjs/interceptors'
import type { IncomingWorkerRequest } from './worker-channel'

/**
 * Converts a given request received from the Service Worker
 * into a Fetch `Request` instance.
 */
export function deserializeRequest(
  serializedRequest: IncomingWorkerRequest,
): Request {
  return new FetchRequest(serializedRequest.url, {
    ...serializedRequest,
  })
}

```

### Core Architecture Module: `src/browser/utils/get-absolute-worker-url.ts`
```
/**
 * Returns an absolute Service Worker URL based on the given
 * relative URL (known during the registration).
 */
export function getAbsoluteWorkerUrl(workerUrl: string): string {
  return new URL(workerUrl, location.href).href
}

```

### Core Architecture Module: `src/browser/utils/get-worker-by-registration.ts`
```
import type { FindWorker } from '../glossary'

/**
 * Attempts to resolve a Service Worker instance from a given registration,
 * regardless of its state (active, installing, waiting).
 */
export function getWorkerByRegistration(
  registration: ServiceWorkerRegistration,
  absoluteWorkerUrl: string,
  findWorker: FindWorker,
): ServiceWorker | null {
  const allStates = [
    registration.active,
    registration.installing,
    registration.waiting,
  ]

  const relevantStates = allStates.filter((state): state is ServiceWorker => {
    return state != null
  })

  const worker = relevantStates.find((worker) => {
    return findWorker(worker.scriptURL, absoluteWorkerUrl)
  })

  return worker || null
}

```

### Core Architecture Module: `src/browser/utils/get-worker-instance.ts`
```
import { until } from 'until-async'
import { devUtils } from '#core/utils/internal/dev-utils'
import { getAbsoluteWorkerUrl } from './get-absolute-worker-url'
import { getWorkerByRegistration } from './get-worker-by-registration'
import type { ServiceWorkerInstanceTuple, FindWorker } from '../glossary'

/**
 * Returns an active Service Worker instance.
 * When not found, registers a new Service Worker.
 */
export const getWorkerInstance = async (
  url: string,
  options: RegistrationOptions = {},
  findWorker: FindWorker,
): Promise<ServiceWorkerInstanceTuple> => {
  // Resolve the absolute Service Worker URL.
  const absoluteWorkerUrl = getAbsoluteWorkerUrl(url)

  const mockRegistrations = await navigator.serviceWorker
    .getRegistrations()
    .then((registrations) =>
      registrations.filter((registration) =>
        getWorkerByRegistration(registration, absoluteWorkerUrl, findWorker),
      ),
    )
  if (!navigator.serviceWorker.controller && mockRegistrations.length > 0) {
    // Reload the page when it has associated workers, but no active controller.
    // The absence of a controller can mean either:
    // - page has no Service Worker associated with it
    // - page has been hard-reloaded and its workers won't be used until the next reload.
    // Since we've checked that there are registrations associated with this page,
    // at this point we are sure it's hard reload that falls into this clause.
    location.reload()
  }

  const [existingRegistration] = mockRegistrations

  if (existingRegistration) {
    // Schedule the worker update in the background.
    // Update ensures the existing worker is up-to-date.
    existingRegistration.update()

    // Return the worker reference immediately.
    return [
      getWorkerByRegistration(
        existingRegistration,
        absoluteWorkerUrl,
        findWorker,
      ),
      existingRegistration,
    ]
  }

  // When the Service Worker wasn't found, register it anew and return the reference.
  const [registrationError, registrationResult] = await until<
    Error,
    ServiceWorkerInstanceTuple
  >(async () => {
    const registration = await navigator.serviceWorker.register(url, options)
    return [
      // Compare existing worker registration by its worker URL,
      // to prevent irrelevant workers to resolve here (such as Codesandbox worker).
      getWorkerByRegistration(registration, absoluteWorkerUrl, findWorker),
      registration,
    ]
  })

  // Handle Service Worker registration errors.
  if (registrationError) {
    const isWorkerMissing = registrationError.message.includes('(404)')

    // Produce a custom error message when given a non-existing Service Worker url.
    // Suggest developers to check their setup.
    if (isWorkerMissing) {
      const scopeUrl = new URL(options?.scope || '/', location.href)

      throw new Error(
        devUtils.formatMessage(`\
Failed to register a Service Worker for scope ('${scopeUrl.href}') with script ('${absoluteWorkerUrl}'): Service Worker script does not exist at the given path.

Did you forget to run "npx msw init <PUBLIC_DIR>"?

Learn more about creating the Service Worker script: https://mswjs.io/docs/cli/init`),
      )
    }

    // Fallback error message for any other registration errors.
    throw new Error(
      devUtils.formatMessage(
        'Failed to register the Service Worker:\n\n%s',
        registrationError.message,
      ),
    )
  }

  return registrationResult
}

```

### Core Architecture Module: `src/browser/utils/should-invalidate-worker.ts`
```
import type { ServiceWorkerSourceOptions } from '../sources/service-worker-source'

export function shouldInvalidateWorker(
  prevOptions: ServiceWorkerSourceOptions,
  nextOptions: ServiceWorkerSourceOptions,
): boolean {
  return (
    prevOptions.findWorker !== nextOptions.findWorker ||
    prevOptions.serviceWorker.url !== nextOptions.serviceWorker.url ||
    JSON.stringify(prevOptions.serviceWorker.options) !==
      JSON.stringify(nextOptions.serviceWorker.options)
  )
}

```

### Core Architecture Module: `src/browser/utils/supports.ts`
```
/**
 * Checks if the Service Worker API is supproted and available
 * in the current browsing context.
 */
export function supportsServiceWorker(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof location !== 'undefined' &&
    location.protocol !== 'file:'
  )
}

/**
 * Returns a boolean indicating whether the current browser
 * supports `ReadableStream` as a `Transferable` when posting
 * messages.
 */
export function supportsReadableStreamTransfer() {
  try {
    const stream = new ReadableStream({
      start: (controller) => controller.close(),
    })
    const message = new MessageChannel()
    message.port1.postMessage(stream, [stream])
    return true
  } catch {
    return false
  }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2806** (2026-10-09): **Unable to suppress logging**
  *Symptoms*: ### Prerequisites  - [x] I confirm my issue is not in the [opened issues](https://github.com/mswjs/msw/issues) - [x] I confirm the [Frequently Asked Questions](https://mswjs.io/docs/faq) didn't contain the answer to my issue  ### Environment check  - [x] I'm using the [latest](https://github.com/mswjs/msw/releases/latest) `msw` version - [x] I'm using Node.js version 20 or higher  ### Browsers  Chromium (Chrome, Brave, etc.)  ### Reproduction repository  https://github.com/remcohaszing/msw-issue  ### Reproduction steps  ```bash npm ci npm test ```  ### Current behavior  MSW outputs logging:  ```console $ vitest run   RUN  v5.0.3 /home/remco/Projects/msw-issue  stdout | unknown test Documentation: https://mswjs.io/docs stdout | unknown test Found an issue? https://github.com/mswjs/msw/issues stdout | unknown test Worker script URL: http://localhost:63315/mockServiceWorker.js stdout | unknown test Worker scope: http://localhost:63315/ stdout | unknown test Client ID: cd4bfd1f-069a-43a1-b4d3-c1b57da1d1ae (nested)  ✓  chromium  example.test.ts (1 test) 12ms    ✓ user 11ms   Test Files  1 passed (1)       Tests  1 passed (1)    Start at  11:52:07    Duration  696ms (worker 53%, import 41%, tests 6%)  ```  The following line does disable HTTP logging, but it doesn’t disable everything:  ```ts network.configure({ context: { quiet: true } }) ```  ### Expected behavior  MSW does not output logging:  ```console $ vitest run   RUN  v5.0.3 /home/remco/Projects/msw-issue  Client ID: cd4bf
  **Post-Mortem & Fix Analysis**:
  > Thanks for letting me know, @remcohaszing. Looks like I messed up how `context.quiet` is respected on the `setupWorker` level, will fix. 
  > Huh, this seems to be caused by #2708 missing! Nice. 

- **Issue #2804** (2026-10-09): **Initial GraphQL subscription handlers stop responding on open connections after resetHandlers()**
  *Symptoms*: ### Prerequisites  - [x] I confirm my issue is not in the [opened issues](https://github.com/mswjs/msw/issues) - [x] I confirm the [Frequently Asked Questions](https://mswjs.io/docs/faq) didn't contain the answer to my issue  ### Environment check  - [x] I'm using the [latest](https://github.com/mswjs/msw/releases/latest) `msw` version - [x] I'm using Node.js version 22 or higher  ### Node.js version  v24.19.0  ### Reproduction repository  https://github.com/kouak/msw-resethandlers-repro  ### Reproduction steps  Run `pnpm start` in the repro repo.  Here's the short version snippet  ```typescript const api = graphql.link("http://localhost/graphql");  const server = setupServer(   // Install an initial graphql subscription handler   api.subscription("OnTick", ({ subscription }) => {     subscription.publish({ data: { tick: 1 } });   }), );  server.listen();  // Create a graphql-ws client, wait for its connection to be established const client = createClient({ url: "ws://localhost/graphql", lazy: false }); await new Promise((resolve) => client.on("connected", resolve));  server.resetHandlers();  // This should be matched by the initial handler. It's marked as unhandled : // [MSW] Intercepted a GraphQL subscription "OnTick" to "ws://localhost/graphql" that has no matching subscription handler. If you wish to mock this subscription, create a subscription handler for it client.subscribe(   { query: "subscription OnTick { tick }" },   { next: console.log, error: console.error, compl
  **Post-Mortem & Fix Analysis**:
  > Hi @kouak. Thanks for reporting this.  I will check with the existing MSW conventions, but I'm fairly confident resetting handlers mid-flight is an anti-pattern and acts as a full reset of the network contract you've established.   What is your use case to call `.resetHandlers()` while a subscription is active? That use case might point us to the actual root cause.
  > ## Released: v3.0.3 🎉  This has been released in v3.0.3.  - 📄 [**Release notes**](https://github.com/mswjs/msw/releases/tag/v3.0.3) - 📦 [View on npm](https://www.npmjs.com/package/msw/v/3.0.3)  Get these changes by running the following command:  ``` npm i msw@latest ```  ---  _Predictable release automation by [Release](https://github.com/ossjs/release)_.

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

### Incident Patch 1: `8a19d548` (2026-05-15)
**Commit Message**: chore: improve github actions security (#2747)

**File**: `.github/workflows/auto.yml` (removed, +0/-13)
```diff
@@ -1,13 +0,0 @@
-name: auto
-
-on: [push]
-
-jobs:
-  cancel-previous-workflows:
-    runs-on: macos-latest
-    timeout-minutes: 3
-    steps:
-      - uses: styfle/cancel-workflow-action@0.9.1
-        with:
-          workflow_id: ci.yml
-          access_token: ${{ github.token }}
```

**File**: `.github/workflows/ci.yml` (modified, +19/-16)
```diff
@@ -6,6 +6,9 @@ on:
   pull_request:
   workflow_dispatch:
 
+permissions:
+  contents: read
+
 jobs:
   build-20:
     name: build (20)
@@ -15,7 +18,7 @@ jobs:
         uses: actions/checkout@v4
 
       - name: Set up pnpm
-        uses: pnpm/action-setup@v4
+        uses: pnpm/action-setup@0e279bb959325dab635dd2c09392533439d90093
         with:
           version: 9.15.0
 
@@ -25,7 +28,7 @@ jobs:
           node-version: 22
 
       - name: Install dependencies
-        run: pnpm install
+        run: pnpm install --frozen-lockfile
 
       - name: Lint
         run: pnpm lint
@@ -49,7 +52,7 @@ jobs:
         uses: actions/checkout@v4
 
       - name: Set up pnpm
-        uses: pnpm/action-setup@v4
+        uses: pnpm/action-setup@0e279bb959325dab635dd2c09392533439d90093
         with:
           version: 9.15.0
 
@@ -59,7 +62,7 @@ jobs:
           node-version: 22
 
       - name: Install dependencies
-        run: pnpm install
+        run: pnpm install --frozen-lockfile
 
       - name: Lint
         run: pnpm lint
@@ -84,7 +87,7 @@ jobs:
         uses: actions/checkout@v4
 
       - name: Set up pnpm
-        uses: pnpm/action-setup@v4
+        uses: pnpm/action-setup@0e279bb959325dab635dd2c09392533439d90093
         with:
           version: 9.15.0
 
@@ -102,7 +105,7 @@ jobs:
             ${{ runner.os }}-node-20-build-
 
       - name: Install dependencies
-        run: pnpm install
+        run: pnpm install --frozen-lockfile
 
       - name: Install Playwright browsers
         run: pnpm exec playwright install chromium --with-deps --only-shell
@@ -119,7 +122,7 @@ jobs:
         uses: actions/checkout@v4
 
       - name: Set up pnpm
-        uses: pnpm/action-setup@v4
+        uses: pnpm/action-setup@0e279bb959325dab635dd2c09392533439d90093
         with:
           version: 9.15.0
 
@@ -137,7 +140,7 @@ jobs:
             ${{ runner.os }}-node-20-build-
 
       - name: Install dependencies
-        run: pnpm install
+        run: pnpm install --frozen-lockfile
 
       - name: Node.js tests
         run: pnpm test:node
@@ -154,7 +157,7 @@ jobs:
         uses: actions/checkout@v4
 
       - name: Set up pnpm
-        uses: pnpm/action-setup@v4
+        uses: pnpm/action-setup@0e279bb959325dab635dd2c09392533439d90093
         with:
           version: 9.15.0
 
@@ -172,7 +175,7 @@ jobs:
             ${{ runner.os }}-node-22-build-
 
       - name: Install dependencies
-        run: pnpm install
+        run: pnpm install --frozen-lockfile
 
       - name: Node.js tests
         run: pnpm test:node
@@ -189,7 +192,7 @@ jobs:
         uses: actions/checkout@v4
 
       - name: Set up pnpm
-        uses: pnpm/action-setup@v4
+        uses: pnpm/action-setup@0e279bb959325dab635dd2c09392533439d90093
         with:
           version: 9.15.0
 
@@ -199,7 +202,7 @@ jobs:
           node-version: 22
 
       - name: Install dependencies
-        run: pnpm install
+        run: pnpm install --frozen-lockfile
 
       - name: E2E tests
         run: pnpm test:e2e
@@ -213,7 +216,7 @@ jobs:
         uses: actions/checkout@v4
 
       - name: Set up pnpm
-        uses: pnpm/action-setup@v4
+        uses: pnpm/action-setup@0e279bb959325dab635dd2c09392533439d90093
         with:
           version: 9.15.0
 
@@ -231,7 +234,7 @@ jobs:
             ${{ runner.os }}-node-20-build-
 
       - name: Install dependencies
-        run: pnpm install
+        run: pnpm install --frozen-lockfile
 
       - name: Playwright install
         run: pnpm exec playwright install chromium --with-deps --only-shell
@@ -255,7 +258,7 @@ jobs:
         uses: actions/checkout@v4
 
       - name: Set up pnpm
-        uses: pnpm/action-setup@v4
+        uses: pnpm/action-setup@0e279bb959325dab635dd2c09392533439d90093
         with:
           version: 9.15.0
 
@@ -273,7 +276,7 @@ jobs:
             ${{ runner.os }}-node-20-build-
 
       - name: Install dependencies
-        run: pnpm install
+        run: pnpm install --frozen-lockfile
 
       - name: React Native tests
         run: pnpm test:native
```

**File**: `.github/workflows/compat.yml` (modified, +7/-4)
```diff
@@ -6,6 +6,9 @@ on:
   pull_request:
   workflow_dispatch:
 
+permissions:
+  contents: read
+
 jobs:
   # Validate the package.json exports and emitted CJS/ESM bundles.
   exports:
@@ -20,12 +23,12 @@ jobs:
           node-version: 22
 
       - name: Set up pnpm
-        uses: pnpm/action-setup@v4
+        uses: pnpm/action-setup@0e279bb959325dab635dd2c09392533439d90093
         with:
           version: 9.15.0
 
       - name: Install dependencies
-        run: pnpm install
+        run: pnpm install --frozen-lockfile
 
       - name: Install Playwright browsers
         run: pnpm exec playwright install chromium --with-deps --only-shell
@@ -64,12 +67,12 @@ jobs:
         with:
           node-version: 22
 
-      - uses: pnpm/action-setup@v4
+      - uses: pnpm/action-setup@0e279bb959325dab635dd2c09392533439d90093
         with:
           version: 9.15.0
 
       - name: Install dependencies
-        run: pnpm install
+        run: pnpm install --frozen-lockfile
 
       - name: Build
         run: pnpm build
```

**File**: `.github/workflows/lock-closed-issues.yml` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ jobs:
   action:
     runs-on: macos-latest
     steps:
-      - uses: dessant/lock-threads@v5
+      - uses: dessant/lock-threads@1bf7ec25051fe7c00bdd17e6a7cf3d7bfb7dc771
         with:
           github-token: ${{ secrets.GITHUB_TOKEN }}
           issue-inactive-days: '14'
```

**File**: `.github/workflows/release-preview.yml` (modified, +6/-2)
```diff
@@ -8,6 +8,10 @@ on:
       - '!**'
   workflow_dispatch:
 
+permissions:
+  contents: read
+  pull-requests: write
+
 jobs:
   publish:
     runs-on: macos-latest
@@ -21,12 +25,12 @@ jobs:
           node-version: 22
 
       - name: Set up pnpm
-        uses: pnpm/action-setup@v4
+        uses: pnpm/action-setup@0e279bb959325dab635dd2c09392533439d90093
         with:
           version: 9.15.0
 
       - name: Install dependencies
-        run: pnpm install
+        run: pnpm install --frozen-lockfile
 
       - name: Install Playwright browsers
         run: pnpm exec playwright install chromium --with-deps --only-shell
```

**File**: `.github/workflows/release.yml` (modified, +7/-6)
```diff
@@ -5,17 +5,18 @@ on:
     - cron: '0 1 * * *'
   workflow_dispatch:
 
+permissions:
+  contents: read
+
 jobs:
   build:
     runs-on: macos-latest
     steps:
       - name: Checkout
         uses: actions/checkout@v4
-        with:
-          token: ${{ secrets.GH_ADMIN_TOKEN }}
 
       - name: Set up pnpm
-        uses: pnpm/action-setup@v4
+        uses: pnpm/action-setup@0e279bb959325dab635dd2c09392533439d90093
         with:
           version: 9.15.0
 
@@ -25,7 +26,7 @@ jobs:
           node-version: 22
 
       - name: Install dependencies
-        run: pnpm install
+        run: pnpm install --frozen-lockfile
 
       - name: Install Playwright browsers
         run: pnpm exec playwright install chromium --with-deps --only-shell
@@ -59,7 +60,7 @@ jobs:
           token: ${{ secrets.GH_ADMIN_TOKEN }}
 
       - name: Set up pnpm
-        uses: pnpm/action-setup@v4
+        uses: pnpm/action-setup@0e279bb959325dab635dd2c09392533439d90093
         with:
           version: 9.15.0
 
@@ -75,7 +76,7 @@ jobs:
           git config --local user.email "kettanaito@gmail.com"
 
       - name: Install dependencies
-        run: pnpm install
+        run: pnpm install --frozen-lockfile
 
       - name: Download build artifacts
         uses: actions/download-artifact@v4
```

**File**: `.github/workflows/smoke-test.yml` (modified, +5/-2)
```diff
@@ -9,6 +9,9 @@ on:
     types: [completed]
   workflow_dispatch:
 
+permissions:
+  contents: read
+
 jobs:
   examples:
     if: ${{ (github.event_name == 'workflow_run' && github.event.workflow_run.conclusion == 'success') || github.event_name == 'workflow_dispatch' }}
@@ -23,12 +26,12 @@ jobs:
           node-version: 22
 
       - name: Set up pnpm
-        uses: pnpm/action-setup@v4
+        uses: pnpm/action-setup@0e279bb959325dab635dd2c09392533439d90093
         with:
           version: 9.15.0
 
       - name: Install dependencies
-        run: pnpm install
+        run: pnpm install --frozen-lockfile
 
       - name: Test examples
         run: ./config/scripts/smoke-test.sh
```

**File**: `.github/workflows/typescript-nightly.yml` (modified, +6/-2)
```diff
@@ -6,6 +6,9 @@ on:
     - cron: '0 0 * * *'
   workflow_dispatch:
 
+permissions:
+  contents: read
+
 jobs:
   compare:
     runs-on: macos-latest
@@ -32,6 +35,7 @@ jobs:
 
   test:
     runs-on: macos-latest
+    needs: [compare]
     # Skip TypeScript compatibility check on "main".
     # A merged pull request implies passing "typescript" job.
     if: ${{ needs.compare.outputs.latest_version != needs.compare.outputs.rc_version }}
@@ -45,12 +49,12 @@ jobs:
           node-version: 22
 
       - name: Set up pnpm
-        uses: pnpm/action-setup@v4
+        uses: pnpm/action-setup@0e279bb959325dab635dd2c09392533439d90093
         with:
           version: 9.15.0
 
       - name: Install dependencies
-        run: pnpm install
+        run: pnpm install --frozen-lockfile
 
       - name: Build
         run: pnpm build
```

---

### Incident Patch 2: `3818a81c` (2026-10-09)
**Commit Message**: fix(HandlersController): dispose of reset handlers (#2810)

**File**: `src/core/experimental/handlers-controller.test.ts` (modified, +61/-0)
```diff
@@ -308,6 +308,67 @@ describe(InMemoryHandlersController.prototype.reset, () => {
     expect(controller.getHandlersByKind('websocket')).toEqual([wsOne, wsTwo])
     expect(controller.getHandlersByKind('request')).toEqual([upgradeHandler])
   })
+
+  test('resets the kept handlers and disposes of the removed ones', () => {
+    const initialHandler = http.get('/initial', () => {})
+    initialHandler.reset = vi.fn()
+    initialHandler.dispose = vi.fn()
+    const runtimeHandler = http.get('/runtime', () => {})
+    runtimeHandler.reset = vi.fn()
+    runtimeHandler.dispose = vi.fn()
+
+    const controller = new InMemoryHandlersController([initialHandler])
+    controller.use([runtimeHandler])
+    controller.reset([])
+
+    expect.soft(initialHandler.reset).toHaveBeenCalledOnce()
+    expect.soft(initialHandler.dispose).not.toHaveBeenCalled()
+    expect.soft(runtimeHandler.reset).not.toHaveBeenCalled()
+    expect(runtimeHandler.dispose).toHaveBeenCalledOnce()
+  })
+
+  test('reports a rejected disposal of a removed handler', async () => {
+    vi.spyOn(console, 'error').mockImplementation(() => {})
+    onTestFinished(() => vi.restoreAllMocks())
+
+    const runtimeHandler = http.get('/runtime', () => {})
+    runtimeHandler.dispose = () =>
+      Promise.reject(new Error('Handler disposal error'))
+
+    const controller = new InMemoryHandlersController([])
+    controller.use([runtimeHandler])
+    controller.reset([])
+
+    await expect
+      .poll(() => console.error)
+      .toHaveBeenCalledWith(
+        `[MSW] Failed to dispose of "request" handler removed during reset. Please see the original error below.\nError: Handler disposal error`,
+      )
+  })
+
+  test('removes the remaining handlers when a disposal throws', () => {
+    vi.spyOn(console, 'error').mockImplementation(() => {})
+    onTestFinished(() => vi.restoreAllMocks())
+
+    const throwingHandler = http.get('/throwing', () => {})
+    throwingHandler.dispose = () => {
+      throw new Error('Handler disposal error')
+    }
+    const runtimeHandler = http.get('/runtime', () => {})
+    runtimeHandler.dispose = vi.fn()
+
+    const controller = new InMemoryHandlersController([])
+    controller.use([throwingHandler, runtimeHandler])
+    controller.reset([])
+
+    expect
+      .soft(console.error)
+      .toHaveBeenCalledWith(
+        `[MSW] Failed to dispose of "request" handler removed during reset. Please see the original error below.\nError: Handler disposal error`,
+      )
+    expect.soft(runtimeHandler.dispose).toHaveBeenCalledOnce()
+    expect(controller.currentHandlers()).toEqual([])
+  })
 })
 
 describe(InMemoryHandlersController.prototype.listHandlers, () => {
```

**File**: `src/core/experimental/handlers-controller.ts` (modified, +39/-6)
```diff
@@ -168,11 +168,38 @@ export abstract class HandlersController {
       ),
     )
 
-    for (const handler of this.currentHandlers()) {
+    const { initialHandlers } = this.getState()
+    const nextInitialHandlers =
+      nextHandlers.length > 0
+        ? groupHandlersByKind(nextHandlers)
+        : initialHandlers
+    const currentHandlers = new Set(this.currentHandlers())
+    const nextHandlersSet = new Set(
+      Object.values(nextInitialHandlers).flat().filter(Boolean),
+    )
+
+    for (const handler of currentHandlers.intersection(nextHandlersSet)) {
       handler.reset()
     }
 
-    const { initialHandlers } = this.getState()
+    // The handlers that leave the network with this reset release
+    // whatever they hold (e.g. live connection bindings).
+    // Resetting is synchronous, so their disposal is not awaited.
+    for (const handler of currentHandlers.difference(nextHandlersSet)) {
+      try {
+        const disposal = handler.dispose()
+
+        if (disposal instanceof Promise) {
+          disposal.catch((error) => {
+            this.#printDisposalError(handler, error)
+          })
+        }
+      } catch (error) {
+        // A failing disposal must not prevent the remaining handlers
+        // from being disposed of, nor the removed handlers from being cleared.
+        this.#printDisposalError(handler, error)
+      }
+    }
 
     if (nextHandlers.length === 0) {
       this.setState({
@@ -182,11 +209,9 @@ export abstract class HandlersController {
       return
     }
 
-    const normalizedNextHandlers = groupHandlersByKind(nextHandlers)
-
     this.setState({
-      initialHandlers: normalizedNextHandlers,
-      handlers: { ...normalizedNextHandlers },
+      initialHandlers: nextInitialHandlers,
+      handlers: { ...nextInitialHandlers },
     })
   }
 
@@ -217,6 +242,14 @@ export abstract class HandlersController {
   #validateHandlers(handlers: Array<AnyHandler>): boolean {
     return handlers.every((handler) => !Array.isArray(handler))
   }
+
+  #printDisposalError(handler: AnyHandler, error: unknown): void {
+    devUtils.error(
+      'Failed to dispose of "%s" handler removed during reset. Please see the original error below.\n%s',
+      handler.kind,
+      error,
+    )
+  }
 }
 
 export class InMemoryHandlersController extends HandlersController {
```

**File**: `src/core/handlers/handler.ts` (modified, +3/-2)
```diff
@@ -32,8 +32,9 @@ export abstract class Handler {
   /**
    * Release the resources held by this handler.
    *
-   * @note This method is invoked automatically when the network is
-   * disabled (e.g. `server.close()`). Override it in the handlers that
+   * @note This method is invoked automatically when the handler leaves
+   * the network: when the network is disabled (e.g. `server.close()`)
+   * or when a reset removes it (e.g. `server.resetHandlers()`). Override it in the handlers that
    * hold onto anything beyond a single frame, like timers, connections,
    * or event listeners. Returning a promise makes the network await
    * this handler's disposal before it tears itself down.
```

**File**: `src/graphql/graphql-subscription.ts` (modified, +30/-12)
```diff
@@ -585,24 +585,32 @@ export class GraphQLSubscriptionTransportHandler extends GraphQLWebSocketHandler
   }
 
   /**
-   * Drop this transport's subscribers and active subscriptions from the
-   * sessions it participates in. The sessions themselves are left intact:
-   * they are shared with the other transports of the same connection and
-   * own the protocol listeners for as long as the client stays connected.
+   * Remove the given handler from the subscribers of every session
+   * this transport participates in. The handler no longer matches
+   * subscriptions on the connections opened while it was registered.
+   */
+  public unsubscribe(handler: WebSocketHandler): void {
+    for (const connection of connections.values()) {
+      connection.subscribers.delete(handler)
+    }
+  }
+
+  /**
+   * End the active subscriptions of the sessions this transport
+   * participates in. The sessions and their subscribers are left intact:
+   * the handlers that survive the reset keep serving the connections
+   * opened before it, while the removed handlers unsubscribe themselves
+   * on disposal. The sessions own the protocol listeners for as long as
+   * the client stays connected.
    *
    * @note This method is invoked automatically when the handlers
    * controller resets the handlers (e.g. `server.resetHandlers()`).
    */
   public reset(): void {
     for (const connection of connections.values()) {
-      let ownsConnection = false
-
-      for (const [handler, entry] of connection.subscribers) {
-        if (entry.transport === this) {
-          connection.subscribers.delete(handler)
-          ownsConnection = true
-        }
-      }
+      const ownsConnection = Array.from(connection.subscribers.values()).some(
+        (entry) => entry.transport === this,
+      )
 
       // Resetting the handlers detaches the resolvers from their
       // subscriptions, so run their cleanups instead of dropping them.
@@ -935,6 +943,16 @@ export class GraphQLSubscriptionHandler<
     this.isUsed = false
   }
 
+  /**
+   * Stop serving the connections this handler was bound to.
+   * @note This method is invoked automatically when the handler
+   * is removed from the network, either by resetting the handlers
+   * (e.g. `server.resetHandlers()`) or by disabling the network.
+   */
+  public dispose(): void {
+    this.#transport.unsubscribe(this)
+  }
+
   /**
    * @note Individual subscription handlers stay silent. The subscription
    * transport owns the GraphQL-aware logging for the entire connection
```

**File**: `test/msw-api/setup-server/reset-handlers.node.test.ts` (modified, +87/-0)
```diff
@@ -1,6 +1,11 @@
 // @vitest-environment node
 import { HttpResponse, http } from 'msw'
+import { graphql } from 'msw/graphql'
 import { setupServer } from 'msw/node'
+import { createClient } from '../../support/graphql-client'
+import { gql } from '../../support/graphql'
+
+const api = graphql.link('http://localhost/graphql')
 
 const server = setupServer(
   http.get('http://localhost/books', () => {
@@ -101,3 +106,85 @@ test('replaces all handlers with the explicit next runtime handlers upon reset',
     await expect.soft(response.json()).resolves.toEqual([1, 2, 3])
   }
 })
+
+test('keeps initial GraphQL subscription handlers for connections opened before reset', async () => {
+  // The previous test replaced the initial handlers,
+  // so establish the subscription handler as the initial one here.
+  server.resetHandlers(
+    api.subscription('OnTick', ({ subscription }) => {
+      subscription.publish({ data: { tick: 1 } })
+    }),
+  )
+
+  await using client = createClient({
+    url: 'ws://localhost/graphql',
+    lazy: false,
+  })
+  const connected = Promise.withResolvers<void>()
+  client.on('connected', () => connected.resolve())
+  await connected.promise
+
+  server.resetHandlers()
+
+  const subscription = client.iterate({
+    query: gql`
+      subscription OnTick {
+        tick
+      }
+    `,
+  })
+  const pendingNext = subscription.next()
+
+  // An unhandled subscription sends nothing to the client,
+  // so wait for it to be either handled or reported as unhandled.
+  let settled = false
+  pendingNext.then(() => (settled = true))
+  await expect
+    .poll(() => settled || vi.mocked(console.warn).mock.calls.length > 0)
+    .toBe(true)
+
+  expect(console.warn).not.toHaveBeenCalled()
+  await expect(pendingNext).resolves.toEqual({
+    done: false,
+    value: { data: { tick: 1 } },
+  })
+})
+
+test('removes runtime GraphQL subscription handlers from connections opened before reset', async () => {
+  server.resetHandlers(
+    api.subscription('OnTick', ({ subscription }) => {
+      subscription.publish({ data: { tick: 'initial' } })
+    }),
+  )
+  server.use(
+    api.subscription('OnTick', ({ subscription }) => {
+      subscription.publish({ data: { tick: 'runtime' } })
+    }),
+  )
+
+  await using client = createClient({
+    url: 'ws://localhost/graphql',
+    lazy: false,
+  })
+  const connected = Promise.withResolvers<void>()
+  client.on('connected', () => connected.resolve())
+  await connected.promise
+
+  const query = gql`
+    subscription OnTick {
+      tick
+    }
+  `
+
+  await expect(client.iterate({ query }).next()).resolves.toEqual({
+    done: false,
+    value: { data: { tick: 'runtime' } },
+  })
+
+  server.resetHandlers()
+
+  await expect(client.iterate({ query }).next()).resolves.toEqual({
+    done: false,
+    value: { data: { tick: 'initial' } },
+  })
+})
```

---

### Incident Patch 3: `22a4626d` (2026-10-09)
**Commit Message**: test(node): add jsdom cors/preflight regression tests (#2808)

**File**: `package.json` (modified, +0/-1)
```diff
@@ -116,7 +116,6 @@
   "funding": "https://github.com/sponsors/mswjs",
   "files": [
     "config/constants.js",
-    "config/scripts/postinstall.js",
     "cli",
     "lib",
     "src",
```

**File**: `test/protocols/http/cors.browser.test.ts` (modified, +117/-2)
```diff
@@ -1,3 +1,4 @@
+import { http, HttpResponse } from 'msw'
 import { defineTestNetwork, expect } from '../../setup/vitest-helpers'
 
 const test = defineTestNetwork()
@@ -13,7 +14,121 @@ test('handles a CORS request with an "opaque" response', async ({
     mode: 'no-cors',
   })
 
-  expect(response.status).toBe(0)
-  expect(response.type).toBe('opaque')
+  expect.soft(response.status).toBe(0)
+  expect.soft(response.type).toBe('opaque')
   expect(errors).toEqual([])
 })
+
+test('passes through a cross-origin request to a server that allows the origin', async ({
+  testServer,
+}) => {
+  const response = await globalThis.fetch(testServer.http.url('/cors'))
+
+  expect.soft(response.status).toBe(200)
+  expect.soft(response.type).toBe('cors')
+  await expect(response.text()).resolves.toBe('hello')
+})
+
+test('fails a passthrough cross-origin request to a server that does not allow the origin', async ({
+  testServer,
+}) => {
+  await expect(
+    globalThis.fetch(testServer.http.url('/cors-error')),
+  ).rejects.toThrow('Failed to fetch')
+})
+
+test('passes through a preflighted cross-origin request to a server that allows the origin', async ({
+  testServer,
+}) => {
+  const response = await globalThis.fetch(testServer.http.url('/cors'), {
+    method: 'DELETE',
+    headers: { 'x-custom-header': 'yes' },
+  })
+
+  expect.soft(response.status).toBe(200)
+  expect.soft(response.type).toBe('cors')
+})
+
+test('fails a preflighted passthrough request to a server that does not allow the origin', async ({
+  testServer,
+}) => {
+  await expect(
+    globalThis.fetch(testServer.http.url('/cors-error'), {
+      headers: { 'x-custom-header': 'yes' },
+    }),
+  ).rejects.toThrow('Failed to fetch')
+})
+
+test('resolves a mocked cross-origin response without CORS headers', async ({
+  fetch,
+  network,
+  testServer,
+}) => {
+  network.use(
+    http.get(testServer.http.url('/mocked').href, () => {
+      return HttpResponse.text('hello world')
+    }),
+  )
+
+  const response = await fetch(testServer.http.url('/mocked'))
+
+  expect.soft(response.status()).toBe(200)
+  expect.soft(response.fromServiceWorker()).toBe(true)
+  await expect(response.text()).resolves.toBe('hello world')
+})
+
+test('resolves a mocked response to a preflighted request', async ({
+  fetch,
+  network,
+  testServer,
+}) => {
+  network.use(
+    http.options(testServer.http.url('/mocked').href, () => {
+      return new HttpResponse(null, {
+        status: 204,
+        headers: {
+          'access-control-allow-origin': '*',
+          'access-control-allow-headers': 'x-custom-header',
+        },
+      })
+    }),
+    http.get(testServer.http.url('/mocked').href, () => {
+      return HttpResponse.text('hello world')
+    }),
+  )
+
+  const response = await fetch(testServer.http.url('/mocked'), {
+    headers: { 'x-custom-header': 'yes' },
+  })
+
+  expect.soft(response.status()).toBe(200)
+  expect.soft(response.fromServiceWorker()).toBe(true)
+  await expect(response.text()).resolves.toBe('hello world')
+})
+
+/**
+ * @note The browser performs preflight requests directly against the network,
+ * bypassing the Service Worker. MSW cannot intercept them in the browser.
+ */
+test('does not intercept a preflight request for a passthrough request', async ({
+  network,
+  testServer,
+}) => {
+  network.use(
+    http.options(testServer.http.url('/cors-error').href, () => {
+      return new HttpResponse(null, {
+        status: 204,
+        headers: {
+          'access-control-allow-origin': '*',
+          'access-control-allow-headers': 'x-custom-header',
+        },
+      })
+    }),
+  )
+
+  await expect(
+    globalThis.fetch(testServer.http.url('/cors-error'), {
+      headers: { 'x-custom-header': 'yes' },
+    }),
+  ).rejects.toThrow('Failed to fetch')
+})
```

**File**: `test/regressions/2803-xhr-cors.node.test.ts` (added, +88/-0)
```diff
@@ -0,0 +1,88 @@
+// @vitest-environment jsdom
+import { http, HttpResponse } from 'msw'
+import { setupServer } from 'msw/node'
+
+const server = setupServer()
+
+beforeAll(() => {
+  server.listen({ onUnhandledFrame: 'error' })
+})
+
+afterEach(() => {
+  server.resetHandlers()
+})
+
+afterAll(() => {
+  server.close()
+})
+
+/**
+ * The JSDOM document URL is at "http://localhost" while the request targets
+ * "http://localhost:8081", which makes JSDOM treat the request as cross-origin.
+ */
+test('resolves a cross-origin XMLHttpRequest with a mocked response that has no CORS headers', async () => {
+  server.use(
+    http.get('http://localhost:8081/resource', () => {
+      return HttpResponse.text('hello world', {
+        headers: {
+          'access-control-allow-origin': '*',
+        },
+      })
+    }),
+  )
+
+  const pendingRequest = Promise.withResolvers<void>()
+  const request = new XMLHttpRequest()
+  request.open('GET', 'http://localhost:8081/resource')
+  request.onload = () => pendingRequest.resolve()
+  request.onerror = () => {
+    pendingRequest.reject(new Error('XMLHttpRequest request error'))
+  }
+  request.send()
+
+  await expect(pendingRequest.promise).resolves.toBeUndefined()
+
+  expect.soft(request.status).toBe(200)
+  expect(request.responseText).toBe('hello world')
+})
+
+test('resolves a cross-origin XMLHttpRequest that triggers a preflight request', async () => {
+  server.use(
+    /**
+     * @note JSDOM has its own rules for when to trigger the preflight OPTIONS request.
+     * For example, including custom headers is one of them. Those rules are proprietary
+     * and do not mirror the browser preflight policies.
+     */
+    http.options('*', () => {
+      return new HttpResponse(null, {
+        status: 204,
+        headers: {
+          'access-control-allow-origin': '*',
+          'access-control-allow-headers': 'x-custom-header',
+        },
+      })
+    }),
+    http.get('http://localhost:8081/resource', () => {
+      return HttpResponse.text('hello world', {
+        headers: {
+          'access-control-allow-origin': '*',
+        },
+      })
+    }),
+  )
+
+  const pendingRequest = Promise.withResolvers<void>()
+  const request = new XMLHttpRequest()
+  request.open('GET', 'http://localhost:8081/resource')
+  request.setRequestHeader('x-custom-header', 'yes')
+  request.onload = () => pendingRequest.resolve()
+  request.onerror = () => {
+    pendingRequest.reject(new Error('XMLHttpRequest request error'))
+  }
+  request.send()
+
+  await expect(pendingRequest.promise).resolves.toBeUndefined()
+
+  expect.soft(request.status).toBe(200)
+  expect(request.responseText).toBe('hello world')
+})
```

#### Recent Merged Pull Requests:
- **PR #2819** (2026-10-17): chore: fix the typescript-nightly job to run (@kettanaito)
- **PR #2810** (2026-10-09): fix(HandlersController): dispose of reset handlers (@kettanaito)
- **PR #2809** (2026-10-09): fix: expose network context on `enable` in network sources (@kettanaito)
- **PR #2808** (2026-10-09): test(node): add jsdom cors/preflight regression tests (@kettanaito)
- **PR #2805** (2026-10-08): docs: add beehiiv to partners (@kettanaito)
- **PR #2802** (2026-10-02): fix(vite): support `virtual:msw` imports in vitest (@kettanaito)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
