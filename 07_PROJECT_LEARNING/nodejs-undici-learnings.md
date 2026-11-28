> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/nodejs-undici-learnings.md`  
> **Source**: github ([https://github.com/nodejs/undici](https://github.com/nodejs/undici))  
> **Source Version**: `f7a6f8f8`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-28T03:53:59.640Z  
> **Learning ID**: `learn-github-nodejs-undici`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): nodejs/undici

> **Canonical Artifact**: `07_PROJECT_LEARNING/nodejs-undici-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/nodejs/undici](https://github.com/nodejs/undici))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-28T03:53:59.514Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `nodejs/undici`
- **Description**: An HTTP/1.1 client, written from scratch for Node.js
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 7779 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `benchmarks/_util/index.js`
```
'use strict'

const parallelRequests = parseInt(process.env.PARALLEL, 10) || 100

function makeParallelRequests (cb) {
  const promises = new Array(parallelRequests)
  for (let i = 0; i < parallelRequests; ++i) {
    promises[i] = new Promise(cb)
  }
  return Promise.all(promises)
}

function printResults (results) {
  // Sort results by least performant first, then compare relative performances and also printing padding
  let last

  const rows = Object.entries(results)
    // If any failed, put on the top of the list, otherwise order by mean, ascending
    .sort((a, b) => (!a[1].success ? -1 : b[1].mean - a[1].mean))
    .map(([name, result]) => {
      if (!result.success) {
        return {
          Tests: name,
          Samples: result.size,
          Result: 'Errored',
          Tolerance: 'N/A',
          'Difference with Slowest': 'N/A'
        }
      }

      // Calculate throughput and relative performance
      const { size, mean, standardError } = result
      const relative = last !== 0 ? (last / mean - 1) * 100 : 0

      // Save the slowest for relative comparison
      if (typeof last === 'undefined') {
        last = mean
      }

      return {
        Tests: name,
        Samples: size,
        Result: `${((parallelRequests * 1e9) / mean).toFixed(2)} req/sec`,
        Tolerance: `± ${((standardError / mean) * 100).toFixed(2)} %`,
        'Difference with slowest':
          relative > 0 ? `+ ${relative.toFixed(2)} %` : '-'
      }
    })

  return console.table(rows)
}

/**
 * @param {number} num
 * @returns {string}
 */
function formatBytes (num) {
  if (!Number.isFinite(num)) {
    throw new Error('invalid number')
  }

  const prefixes = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB']

  const idx = Math.min(Math.floor(Math.log(num) / Math.log(1024)), prefixes.length - 1)

  return `${(num / Math.pow(1024, idx)).toFixed(2)}${prefixes[idx]}`
}

module.exports = { makeParallelRequests, printResults, formatBytes }

```

### Core Architecture Module: `benchmarks/_util/runner.js`
```
// @ts-check

'use strict'

class Info {
  /** @type {string} */
  #name
  /** @type {bigint} */
  #current
  /** @type {bigint} */
  #finish
  /** @type {(...args: any[]) => any} */
  #callback
  /** @type {boolean} */
  #finalized = false

  /**
   * @param {string} name
   * @param {(...args: any[]) => any} callback
   */
  constructor (name, callback) {
    this.#name = name
    this.#callback = callback
  }

  get name () {
    return this.#name
  }

  start () {
    if (this.#finalized) {
      throw new TypeError('called after finished.')
    }
    this.#current = process.hrtime.bigint()
  }

  end () {
    if (this.#finalized) {
      throw new TypeError('called after finished.')
    }
    this.#finish = process.hrtime.bigint()
    this.#finalized = true
    this.#callback()
  }

  diff () {
    return Number(this.#finish - this.#current)
  }
}

/**
 * @typedef BenchMarkHandler
 * @type {(ev: { name: string; start(): void; end(): void; }) => any}
 */

/**
 * @param {Record<string, BenchMarkHandler>} experiments
 * @param {{ minSamples?: number; maxSamples?: number }} [options]
 * @returns {Promise<{ name: string; average: number; samples: number; fn: BenchMarkHandler; iterationPerSecond: number; min: number; max: number }[]>}
 */
async function bench (experiments, options = {}) {
  const names = Object.keys(experiments)

  /** @type {{ name: string; average: number; samples: number; fn: BenchMarkHandler; iterationPerSecond: number; min: number; max: number }[]} */
  const results = []

  async function waitMaybePromiseLike (p) {
    if (
      (typeof p === 'object' || typeof p === 'function') &&
      p !== null &&
      typeof p.then === 'function'
    ) {
      await p
    }
  }

  for (let i = 0; i < names.length; ++i) {
    const name = names[i]
    const fn = experiments[name]
    const samples = []

    for (let i = 0; i < 8; ++i) {
      // warmup
      await new Promise((resolve, reject) => {
        const info = new Info(name, resolve)

        try {
          const p = fn(info)

          waitMaybePromiseLike(p).catch((err) => reject(err))
        } catch (err) {
          reject(err)
        }
      })
    }

    let timing = 0
    const minSamples = options.minSamples ?? 128

    for (let j = 0; (j < minSamples || timing < 800_000_000) && (typeof options.maxSamples === 'number' ? options.maxSamples > j : true); ++j) {
      let resolve = (value) => {}
      let reject = (reason) => {}
      const promise = new Promise(
        (_resolve, _reject) => { resolve = _resolve; reject = _reject }
      )

      const info = new Info(name, resolve)

      try {
        const p = fn(info)

        await waitMaybePromiseLike(p)
      } catch (err) {
        reject(err)
      }

      await promise

      samples.push({ time: info.diff() })

      timing += info.diff()
    }

    const average =
      samples.map((v) => v.time).reduce((a, b) => a + b, 0) / samples.length

    results.push({
      name: names[i],
      average,
      samples: samples.length,
      fn,
      iterationPerSecond: 1e9 / average,
      min: samples.reduce((a, acc) => Math.min(a, acc.time), samples[0].time),
      max: samples.reduce((a, acc) => Math.max(a, acc.time), samples[0].time)
    })
  }

  return results
}

module.exports = { bench }

```

### Core Architecture Module: `benchmarks/core/body-chunk-byte-length.mjs`
```
import { bench, do_not_optimize as doNotOptimize, group, run } from 'mitata'

const buffer = Buffer.alloc(16 * 1024)
const uint8Array = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
const string = 'a'.repeat(buffer.byteLength)

function previousChunkLength (chunk) {
  return Buffer.byteLength(chunk)
}

function currentChunkLength (chunk) {
  return chunk instanceof Uint8Array ? chunk.byteLength : Buffer.byteLength(chunk)
}

group('body writer chunk length', () => {
  bench('Buffer.byteLength(buffer)', () => {
    doNotOptimize(Buffer.byteLength(buffer))
  })

  bench('buffer.byteLength', () => {
    doNotOptimize(buffer.byteLength)
  })

  bench('Buffer.byteLength(uint8Array)', () => {
    doNotOptimize(Buffer.byteLength(uint8Array))
  })

  bench('uint8Array.byteLength', () => {
    doNotOptimize(uint8Array.byteLength)
  })

  bench('Buffer.byteLength(string)', () => {
    doNotOptimize(Buffer.byteLength(string))
  })
})

group('body writer chunk length helper', () => {
  bench('previousChunkLength(buffer)', () => {
    doNotOptimize(previousChunkLength(buffer))
  })

  bench('currentChunkLength(buffer)', () => {
    doNotOptimize(currentChunkLength(buffer))
  })

  bench('previousChunkLength(uint8Array)', () => {
    doNotOptimize(previousChunkLength(uint8Array))
  })

  bench('currentChunkLength(uint8Array)', () => {
    doNotOptimize(currentChunkLength(uint8Array))
  })

  bench('previousChunkLength(string)', () => {
    doNotOptimize(previousChunkLength(string))
  })

  bench('currentChunkLength(string)', () => {
    doNotOptimize(currentChunkLength(string))
  })
})

await run()

```

### Core Architecture Module: `benchmarks/core/is-blob-like.mjs`
```
import { bench, group, run } from 'mitata'
import { isBlobLike } from '../../lib/core/util.js'

const buffer = Buffer.alloc(1)

const blob = new Blob(['asd'], {
  type: 'application/json'
})

const file = new File(['asd'], 'file.txt', {
  type: 'text/plain'
})

const blobLikeStream = {
  [Symbol.toStringTag]: 'Blob',
  stream: () => {}
}

const fileLikeStream = {
  stream: () => {},
  [Symbol.toStringTag]: 'File'
}

const blobLikeArrayBuffer = {
  [Symbol.toStringTag]: 'Blob',
  arrayBuffer: () => {}
}

const fileLikeArrayBuffer = {
  [Symbol.toStringTag]: 'File',
  arrayBuffer: () => {}
}

group('isBlobLike', () => {
  bench('blob', () => {
    return isBlobLike(blob)
  })
  bench('file', () => {
    return isBlobLike(file)
  })
  bench('blobLikeStream', () => {
    return isBlobLike(blobLikeStream)
  })
  bench('fileLikeStream', () => {
    return isBlobLike(fileLikeStream)
  })
  bench('fileLikeArrayBuffer', () => {
    return isBlobLike(fileLikeArrayBuffer)
  })
  bench('blobLikeArrayBuffer', () => {
    return isBlobLike(blobLikeArrayBuffer)
  })
  bench('buffer', () => {
    return isBlobLike(buffer)
  })
  bench('null', () => {
    return isBlobLike(null)
  })
  bench('string', () => {
    return isBlobLike('invalid')
  })
})

await run()

```

### Core Architecture Module: `benchmarks/core/is-valid-header-char.mjs`
```
import { bench, group, run } from 'mitata'
import { isValidHeaderChar } from '../../lib/core/util.js'

const html = 'text/html'
const json = 'application/json; charset=UTF-8'

const headerCharRegex = /[^\t\x20-\x7e\x80-\xff]/

/**
 * @param {string} characters
 */
function charCodeAtApproach (characters) {
  // Validate if characters is a valid field-vchar.
  //  field-value    = *( field-content / obs-fold )
  //  field-content  = field-vchar [ 1*( SP / HTAB ) field-vchar ]
  //  field-vchar    = VCHAR / obs-text
  for (let i = 0; i < characters.length; ++i) {
    const code = characters.charCodeAt(i)
    // not \x20-\x7e, \t and \x80-\xff
    if ((code < 0x20 && code !== 0x09) || code === 0x7f || code > 0xff) {
      return false
    }
  }
  return true
}

group(`isValidHeaderChar# ${html}`, () => {
  bench('regexp.test', () => {
    return !headerCharRegex.test(html)
  })
  bench('regexp.exec', () => {
    return headerCharRegex.exec(html) === null
  })
  bench('charCodeAt', () => {
    return charCodeAtApproach(html)
  })
  bench('isValidHeaderChar', () => {
    return isValidHeaderChar(html)
  })
})

group(`isValidHeaderChar# ${json}`, () => {
  bench('regexp.test', () => {
    return !headerCharRegex.test(json)
  })
  bench('regexp.exec', () => {
    return headerCharRegex.exec(json) === null
  })
  bench('charCodeAt', () => {
    return charCodeAtApproach(json)
  })
  bench('isValidHeaderChar', () => {
    return isValidHeaderChar(json)
  })
})

await run()

```

### Core Architecture Module: `benchmarks/core/is-valid-port.mjs`
```
import { bench, group, run } from 'mitata'
import { isValidPort } from '../../lib/core/util.js'

const string = '1234'
const number = 1234

group('isValidPort', () => {
  bench('string', () => {
    return isValidPort(string)
  })
  bench('number', () => {
    return isValidPort(number)
  })
})

await run()

```

### Core Architecture Module: `benchmarks/core/parse-content-length.mjs`
```
import { bench, group, run } from 'mitata'

const values = [
  Buffer.from('0'),
  Buffer.from('9'),
  Buffer.from('42'),
  Buffer.from('1234'),
  Buffer.from('65535'),
  Buffer.from('1234567890')
]

function legacyParseContentLength (buf) {
  return parseInt(buf.toString(), 10)
}

function statelessParseContentLength (buf) {
  let contentLength = 0
  for (let i = 0; i < buf.length; i++) {
    contentLength = (contentLength * 10) + (buf[i] - 0x30)
  }
  return contentLength
}

group('parse content-length', () => {
  bench('legacy', () => {
    for (let i = 0; i < values.length; i++) {
      legacyParseContentLength(values[i])
    }
  })

  bench('stateless', () => {
    for (let i = 0; i < values.length; i++) {
      statelessParseContentLength(values[i])
    }
  })
})

await run()

```

### Core Architecture Module: `benchmarks/core/parse-headers.mjs`
```
import { bench, group, run } from 'mitata'
import { parseHeaders } from '../../lib/core/util.js'

const target = [
  {
    'Content-Type': 'application/json',
    Date: 'Wed, 01 Nov 2023 00:00:00 GMT',
    'Powered-By': 'NodeJS',
    'Content-Encoding': 'gzip',
    'Set-Cookie': '__Secure-ID=123; Secure; Domain=example.com',
    'Content-Length': '150',
    Vary: 'Accept-Encoding, Accept, X-Requested-With'
  },
  {
    'Content-Type': 'text/html; charset=UTF-8',
    'Content-Length': '1234',
    Date: 'Wed, 06 Dec 2023 12:47:57 GMT',
    Server: 'Bing'
  },
  {
    'Content-Type': 'image/jpeg',
    'Content-Length': '56789',
    Date: 'Wed, 06 Dec 2023 12:48:12 GMT',
    Server: 'Bing',
    ETag: '"a1b2c3d4e5f6g7h8i9j0"'
  },
  {
    Cookie: 'session_id=1234567890abcdef',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    Host: 'www.bing.com',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br'
  },
  {
    Location: 'https://www.bing.com/search?q=bing',
    Status: '302 Found',
    Date: 'Wed, 06 Dec 2023 12:48:27 GMT',
    Server: 'Bing',
    'Content-Type': 'text/html; charset=UTF-8',
    'Content-Length': '0'
  },
  {
    'Content-Type':
      'multipart/form-data; boundary=----WebKitFormBoundary1234567890',
    'Content-Length': '98765',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    Host: 'www.bing.com',
    Accept: '*/*',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br'
  },
  {
    'Content-Type': 'application/json; charset=UTF-8',
    'Content-Length': '2345',
    Date: 'Wed, 06 Dec 2023 12:48:42 GMT',
    Server: 'Bing',
    Status: '200 OK',
    'Cache-Control': 'no-cache, no-store, must-revalidate'
  },
  {
    Host: 'www.example.com',
    Connection: 'keep-alive',
    Accept: 'text/html, application/xhtml+xml, application/xml;q=0.9,;q=0.8',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
  }
]

const headers = Array.from(target, (x) =>
  Object.entries(x)
    .flat()
    .map((c) => Buffer.from(c))
)

const headersIrregular = Array.from(
  target,
  (x) => Object.entries(x)
    .flat()
    .map((c) => Buffer.from(c.toUpperCase()))
)

// avoid JIT bias
bench('noop', () => {})
bench('noop', () => {})
bench('noop', () => {})
bench('noop', () => {})
bench('noop', () => {})
bench('noop', () => {})

group(() => {
  bench('parseHeaders', () => {
    for (let i = 0; i < headers.length; ++i) {
      parseHeaders(headers[i])
    }
  })
  bench('parseHeaders (irregular)', () => {
    for (let i = 0; i < headersIrregular.length; ++i) {
      parseHeaders(headersIrregular[i])
    }
  })
})

await new Promise((resolve) => setTimeout(resolve, 7000))

await run()

```

### Core Architecture Module: `benchmarks/core/parse-raw-headers.mjs`
```
import { bench, group, run } from 'mitata'
import { parseRawHeaders } from '../../lib/core/util.js'

const rawHeadersMixed = ['key', 'value', Buffer.from('key'), Buffer.from('value')]
const rawHeadersOnlyStrings = ['key', 'value', 'key', 'value']
const rawHeadersOnlyBuffers = [Buffer.from('key'), Buffer.from('value'), Buffer.from('key'), Buffer.from('value')]
const rawHeadersContent = ['content-length', 'value', 'content-disposition', 'form-data; name="fieldName"']

group('parseRawHeaders', () => {
  bench('only strings', () => {
    parseRawHeaders(rawHeadersOnlyStrings)
  })
  bench('only buffers', () => {
    parseRawHeaders(rawHeadersOnlyBuffers)
  })
  bench('mixed', () => {
    parseRawHeaders(rawHeadersMixed)
  })
  bench('content-disposition special case', () => {
    parseRawHeaders(rawHeadersContent)
  })
})

await run()

```

### Core Architecture Module: `benchmarks/core/request-instantiation.mjs`
```
import { bench, run } from 'mitata'

import Request from '../../lib/core/request.js'
import DecoratorHandler from '../../lib/handler/decorator-handler.js'

const handler = new DecoratorHandler({})

bench('new Request()', () => {
  return new Request('https://localhost', { path: '/', method: 'get', body: null }, handler)
})

await run()

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #6231** (2026-11-21): **Aborted `fetch` does not throw `signal.reason`**
  *Symptoms*: ## Bug Description  <!-- A clear and concise description of what the bug is. -->  When `fetch` is aborted by a signal whose reason is falsy value (`false`, `0`, `''`), the thrown exception is signal reason is not the signal reason.  ## Reproduction  <!--  IMPORTANT: Provide a standalone reproduction script.  See the Reproduction guide in CONTRIBUTING.md for detailed instructions: https://github.com/nodejs/undici/blob/main/CONTRIBUTING.md#reproduction  Guidelines: - The script must be self-contained (uses only undici and Node.js built-in modules). - Use createServer from node:http to run a local server inside the script. - Run `node --test test/repro-XXXX.js` locally to confirm the bug is reproducible. - Attach the script inline or as a GitHub Gist link below. -->     **Environment**  Node.js v26.13.1, bundled Undici 8.12.4, Linux x64. Reproduced with Node.js’s built-in `fetch()`.  **Reproduction**  ```js import { once } from 'node:events' import { createServer } from 'node:http'  const server = createServer((_request, response) => {   // Send headers and one chunk, then leave the response open.   response.write('partial body') })  server.listen(0, '127.0.0.1') await once(server, 'listening')  try {   const { port } = server.address()   const controller = new AbortController()   const { signal } = controller   const response = await fetch(`http://127.0.0.1:${port}`, { signal })    const reading = response.text()   controller.abort(false)    const rejection = await reading.then

- **Issue #6202** (2026-11-27): **HTTP/2: requests dispatched together on a new connection are held until the server's SETTINGS frame is read**
  *Symptoms*: Bug Description (facts to put in your words): - On a new HTTP/2 connection, undici sends the first request, then holds the others until it has processed the server's SETTINGS frame. - That frame arrives within about a millisecond. But if the process is busy right then (for example a server rendering a page), the held requests leave only once it's free. - On a connection that's already open, requests dispatched together go out together. - It started in 8.2.0 with PR #5135, the fix for #5134.  Standalone reproduction script:  ``` 'use strict'  const { test } = require('node:test') const assert = require('node:assert') const { once } = require('node:events') const { Worker } = require('node:worker_threads') const diagnosticsChannel = require('node:diagnostics_channel') const { H2CClient } = require('undici')  const SERVER = `   const { parentPort } = require('node:worker_threads')   const { createServer } = require('node:http2')   const server = createServer()   server.on('stream', (stream, headers) => {     parentPort.postMessage({ path: headers[':path'], at: performance.timeOrigin + performance.now() })     stream.respond({ ':status': 200 })     stream.end('ok')   })   server.listen(0, '127.0.0.1', () => parentPort.postMessage({ port: server.address().port })) `  const BUSY_MS = 50  test('a new HTTP/2 connection sends requests dispatched together at once', { timeout: 60000 }, async (t) => {   const worker = new Worker(SERVER, { eval: true })   t.after(() => worker.terminate())

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

### Incident Patch 1: `416f9e32` (2026-11-19)
**Commit Message**: fix(interceptors): enforce cache-after-redirect composition order (#6220)

When `cache()` is composed before `redirect()`, the cache handler is
wrapped above the redirect handler in the handler chain, so it never
observes the redirect history threaded via `context.history`. Every
history-based guard in the cache handler is then silently disabled:

- cross-origin redirect responses are stored under the trusted origin's
  key and replayed to unrelated callers (GHSA-75VM-9G8F-99J4,
  GHSA-MQG3-3V4R-CM32, GHSA-4W7W-5XRC-9H26), and
- credential-bearing same-origin redirects leak one principal's response
  to another (GHSA-7XG3-FPHP-28HG).

The redirect interceptor must be composed before the cache interceptor so
the cache handler runs below the redirect handler and sees the final
response plus the full redirect history.

Interceptors are opaque functions, so `compose()` cannot know which ones
are order-sensitive without metadata. This tags the cache, redirect, and
deduplicate interceptors with `kInterceptorKind` and makes
`Dispatcher.compose()` throw an `InvalidArgumentError` when `cache` is
composed before `redirect`. `deduplicate` participates in the same
redirect-history contract but

**File**: `docs/docs/api/Dispatcher.md` (modified, +20/-0)
```diff
@@ -705,6 +705,26 @@ The order of the interceptors matters: the last interceptor in the chain is the
 first to be called. Forking the chain of interceptors can lead to unexpected
 results.
 
+Because interceptors wrap each other, ordering is the end-user's responsibility.
+Certain built-in interceptors are order-sensitive and will throw an
+`InvalidArgumentError` if composed in an unsafe order. In particular, the
+`cache` interceptor must be composed **after** the `redirect` interceptor. When
+`cache` is composed before `redirect`, the cache handler is wrapped *above* the
+redirect handler, so it never observes the redirect history and its
+cross-origin / credential-bearing redirect guards are silently disabled.
+This allows an attacker-controlled or cross-principal redirect response to be
+stored under the trusted origin's cache key and replayed to unrelated callers
+(see GHSA-75VM-9G8F-99J4, GHSA-MQG3-3V4R-CM32, GHSA-4W7W-5XRC-9H26 and
+GHSA-7XG3-FPHP-28HG).
+
+```js
+// Correct: cache is composed after redirect.
+new Agent().compose(interceptors.redirect({ maxRedirections: 5 }), interceptors.cache({}))
+
+// Throws an InvalidArgumentError: cache composed before redirect.
+new Agent().compose(interceptors.cache({}), interceptors.redirect({ maxRedirections: 5 }))
+```
+
 ```text
 compose([interceptor1, interceptor2, interceptor3])
 
```

**File**: `docs/docs/api/Interceptors.md` (modified, +13/-0)
```diff
@@ -356,12 +356,25 @@ backing store.
 
 **Returns:** {Dispatcher.DispatcherComposeInterceptor}
 
+> **Ordering:** the `cache` interceptor must be composed **after** the
+> `redirect` interceptor. When `cache` is composed before `redirect`, the cache
+> handler is wrapped above the redirect handler, so it never observes the
+> redirect history and its cross-origin / credential-bearing redirect guards are
+> silently disabled, which lets an attacker-controlled or cross-principal
+> redirect response be stored under the trusted origin's cache key and replayed
+> to unrelated callers (GHSA-75VM-9G8F-99J4, GHSA-MQG3-3V4R-CM32,
+> GHSA-4W7W-5XRC-9H26, GHSA-7XG3-FPHP-28HG). `compose()` throws an
+> `InvalidArgumentError` for this unsafe order. The `deduplicate` interceptor
+> participates in the same redirect-history contract and may be placed before or
+> after `redirect`, as long as `cache` follows `redirect`.
+
 **Example**
 
 ```js
 import { Agent, interceptors, cacheStores } from 'undici'
 
 const agent = new Agent().compose(
+  interceptors.redirect({ maxRedirections: 5 }),
   interceptors.cache({ store: new cacheStores.MemoryCacheStore() })
 )
 ```
```

**File**: `lib/core/symbols.js` (modified, +2/-1)
```diff
@@ -78,5 +78,6 @@ module.exports = {
   kNoProxyAgent: Symbol('no proxy agent'),
   kHttpProxyAgent: Symbol('http proxy agent'),
   kHttpsProxyAgent: Symbol('https proxy agent'),
-  kSocks5ProxyAgent: Symbol('socks5 proxy agent')
+  kSocks5ProxyAgent: Symbol('socks5 proxy agent'),
+  kInterceptorKind: Symbol('interceptor kind')
 }
```

**File**: `lib/dispatcher/dispatcher.js` (modified, +22/-1)
```diff
@@ -1,6 +1,7 @@
 'use strict'
 const EventEmitter = require('node:events')
-const { kOriginless, kUrl } = require('../core/symbols')
+const { InvalidArgumentError } = require('../core/errors')
+const { kOriginless, kUrl, kInterceptorKind } = require('../core/symbols')
 
 class Dispatcher extends EventEmitter {
   dispatch () {
@@ -24,6 +25,8 @@ class Dispatcher extends EventEmitter {
       : this[kUrl]?.origin
     let dispatch = this.dispatch.bind(this)
 
+    const orderSensitiveKinds = []
+
     for (const interceptor of interceptors) {
       if (interceptor == null) {
         continue
@@ -33,13 +36,31 @@ class Dispatcher extends EventEmitter {
         throw new TypeError(`invalid interceptor, expected function received ${typeof interceptor}`)
       }
 
+      if (interceptor[kInterceptorKind] != null) {
+        orderSensitiveKinds.push(interceptor[kInterceptorKind])
+      }
+
       dispatch = interceptor(dispatch, interceptorOrigin)
 
       if (dispatch == null || typeof dispatch !== 'function' || dispatch.length !== 2) {
         throw new TypeError('invalid interceptor')
       }
     }
 
+    // Several shipped interceptors are order-sensitive: they cooperate through
+    // the redirect history threaded on the request context, and the cache
+    // handler only receives it when the redirect interceptor is composed before
+    // the cache interceptor. Composing `cache` before `redirect` silently
+    // disables the cache's redirect-origin guards (cross-origin cache
+    // poisoning, credential-bearing redirect replay), so fail fast instead of
+    // storing an attacker-controlled or cross-principal response under a key
+    // the application trusts.
+    const cacheIndex = orderSensitiveKinds.indexOf('cache')
+    const redirectIndex = orderSensitiveKinds.indexOf('redirect')
+    if (cacheIndex !== -1 && redirectIndex !== -1 && cacheIndex < redirectIndex) {
+      throw new InvalidArgumentError('the cache interceptor must be composed after the redirect interceptor; composing the cache before the redirect disables the cache\'s cross-origin and credential redirect guards (GHSA-75VM-9G8F-99J4, GHSA-MQG3-3V4R-CM32, GHSA-4W7W-5XRC-9H26, GHSA-7XG3-FPHP-28HG)')
+    }
+
     const originalDispatch = dispatch
     const self = this
     dispatch = function (opts, handler) {
```

**File**: `lib/interceptor/cache.js` (modified, +4/-1)
```diff
@@ -20,6 +20,7 @@ const {
 const { AbortError } = require('../core/errors.js')
 const { kQueuedAbort } = require('../core/symbols.js')
 const { parseHttpDate } = require('../util/date.js')
+const { kInterceptorKind } = require('../core/symbols.js')
 
 /**
  * @param {(string | RegExp)[] | undefined} origins
@@ -669,7 +670,7 @@ module.exports = (opts = {}) => {
     }
   }
 
-  return (dispatch, interceptorOrigin) => {
+  const interceptor = (dispatch, interceptorOrigin) => {
     return (opts, handler) => {
       const requestOrigin = getInterceptorOrigin(opts, interceptorOrigin)
       if (!requestOrigin || arrayIncludes(safeMethodsToNotCache, opts.method)) {
@@ -772,4 +773,6 @@ module.exports = (opts = {}) => {
       }
     }
   }
+  interceptor[kInterceptorKind] = 'cache'
+  return interceptor
 }
```

**File**: `lib/interceptor/deduplicate.js` (modified, +4/-1)
```diff
@@ -4,6 +4,7 @@ const diagnosticsChannel = require('node:diagnostics_channel')
 const util = require('../core/util')
 const DeduplicationHandler = require('../handler/deduplication-handler')
 const { getInterceptorOrigin, normalizeHeaders, makeCacheKey, makeDeduplicationKey } = require('../util/cache.js')
+const { kInterceptorKind } = require('../core/symbols.js')
 
 const pendingRequestsChannel = diagnosticsChannel.channel('undici:request:pending-requests')
 
@@ -57,7 +58,7 @@ module.exports = (opts = {}) => {
    */
   const pendingRequests = new Map()
 
-  return (dispatch, interceptorOrigin) => {
+  const interceptor = (dispatch, interceptorOrigin) => {
     return (opts, handler) => {
       const requestOrigin = getInterceptorOrigin(opts, interceptorOrigin)
       if (!requestOrigin || opts.upgrade || methods.includes(opts.method) === false) {
@@ -115,4 +116,6 @@ module.exports = (opts = {}) => {
       return dispatch(opts, deduplicationHandler)
     }
   }
+  interceptor[kInterceptorKind] = 'deduplicate'
+  return interceptor
 }
```

**File**: `lib/interceptor/redirect.js` (modified, +4/-1)
```diff
@@ -1,9 +1,10 @@
 'use strict'
 
 const RedirectHandler = require('../handler/redirect-handler')
+const { kInterceptorKind } = require('../core/symbols.js')
 
 function createRedirectInterceptor ({ maxRedirections: defaultMaxRedirections, throwOnMaxRedirect: defaultThrowOnMaxRedirect, stripHeadersOnRedirect: defaultStripHeadersOnRedirect, stripHeadersOnCrossOriginRedirect: defaultStripHeadersOnCrossOriginRedirect } = {}) {
-  return (dispatch) => {
+  const interceptor = (dispatch) => {
     return function Intercept (opts, handler) {
       const { maxRedirections = defaultMaxRedirections, throwOnMaxRedirect = defaultThrowOnMaxRedirect, stripHeadersOnRedirect = defaultStripHeadersOnRedirect, stripHeadersOnCrossOriginRedirect = defaultStripHeadersOnCrossOriginRedirect, ...rest } = opts
 
@@ -16,6 +17,8 @@ function createRedirectInterceptor ({ maxRedirections: defaultMaxRedirections, t
       return dispatch(dispatchOpts, redirectHandler)
     }
   }
+  interceptor[kInterceptorKind] = 'redirect'
+  return interceptor
 }
 
 module.exports = createRedirectInterceptor
```

**File**: `test/interceptors/cache-redirect-origin.js` (modified, +11/-18)
```diff
@@ -154,29 +154,22 @@ test('cache does not store a cross-origin redirect response under the original o
   }
 })
 
-test('reverse interceptor order (cache outside redirect) still works', async () => {
-  await withOrigins(async ({ state, trustedOrigin }) => {
-    const agent = new Agent().compose(
+// Composing the cache interceptor before the redirect interceptor is rejected:
+// the cache handler sits above the redirect handler, so it never receives the
+// redirect history and its cross-origin / credential guards are silently
+// disabled, which allows an attacker-controlled or cross-principal redirect
+// to be stored under the trusted key. See GHSA-75VM-9G8F-99J4.
+test('reverse interceptor order (cache outside redirect) is rejected', () => {
+  assert.throws(
+    () => new Agent().compose(
       interceptors.cache({
         store: new cacheStores.MemoryCacheStore(),
         type: 'shared'
       }),
       interceptors.redirect({ maxRedirections: 2 })
-    )
-
-    const mallory = await requestAgent(agent, trustedOrigin, 'mallory')
-    state.redirectEnabled = false
-    const alice = await requestAgent(agent, trustedOrigin, 'alice')
-
-    try {
-      assert.equal(mallory, 'attacker-controlled-content')
-      assert.equal(alice, 'legitimate-content')
-      assert.equal(state.trustedHits, 2)
-      assert.equal(state.attackerHits, 1)
-    } finally {
-      await agent.close()
-    }
-  })
+    ),
+    /must be composed after the redirect interceptor/
+  )
 })
 
 test('same-origin redirect responses are still cached by the cache interceptor', async () => {
```

---

### Incident Patch 2: `d7cd6f5a` (2026-11-23)
**Commit Message**: build(deps-dev): bump fast-check from 4.10.2 to 4.10.3 (#6252)

Bumps [fast-check](https://github.com/dubzzz/fast-check/tree/HEAD/packages/fast-check) from 4.10.2 to 4.10.3.
- [Release notes](https://github.com/dubzzz/fast-check/releases)
- [Changelog](https://github.com/dubzzz/fast-check/blob/main/packages/fast-check/CHANGELOG.md)
- [Commits](https://github.com/dubzzz/fast-check/commits/v4.10.3/packages/fast-check)

---
updated-dependencies:
- dependency-name: fast-check
  dependency-version: 4.10.3
  dependency-type: direct:development
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `package-lock.json` (modified, +3/-3)
```diff
@@ -5153,9 +5153,9 @@
       }
     },
     "node_modules/fast-check": {
-      "version": "4.10.2",
-      "resolved": "https://registry.npmjs.org/fast-check/-/fast-check-4.10.2.tgz",
-      "integrity": "sha512-iK2f+YrcmoeGqk6fA0ea2bptcu/itMIm4NfEozq6N25+aG6h7s5HZbB/k1aV7b5w5sFLMCbbtRUsTVR+BgC3xw==",
+      "version": "4.10.3",
+      "resolved": "https://registry.npmjs.org/fast-check/-/fast-check-4.10.3.tgz",
+      "integrity": "sha512-SBaU6nhh+sXxb05r2IHAKfxnR/1Pu6MqtHYaewM1BY6V5xzOxOk+4yoWO7WfeeyZG1iArFE6/DO/7iLYMUuOJg==",
       "dev": true,
       "funding": [
         {
```

---

### Incident Patch 3: `3277b3ac` (2026-11-27)
**Commit Message**: fix(h2): preserve request AsyncLocalStorage context for body chunks (#6209)

When several streams multiplex over one shared HTTP/2 session, node fires
a stream's transport 'data' callback from the session's context rather
than the stream's. onResponseData pushed each chunk into the request's
BodyReadable without re-entering that request's AsyncResource, so a body
'data' listener could observe another concurrent request's
AsyncLocalStorage store while still receiving its own response bytes.

Wrap the push in runInAsyncScope, so body chunk consumption runs in the
owning request's context, matching the request callback, which already
preserves it.

Adds an HTTP/2 regression test using a shared Client with concurrent
requests in separate AsyncLocalStorage scopes, plus a per-request Client
control.

**File**: `lib/api/api-request.js` (modified, +1/-1)
```diff
@@ -164,7 +164,7 @@ class RequestHandler extends AsyncResource {
       return
     }
 
-    if (this.res.push(chunk) === false) {
+    if (this.runInAsyncScope(() => this.res.push(chunk)) === false) {
       controller.pause()
     }
   }
```

**File**: `test/http2-body-als.js` (added, +125/-0)
```diff
@@ -0,0 +1,125 @@
+'use strict'
+
+const assert = require('node:assert')
+const { AsyncLocalStorage } = require('node:async_hooks')
+const { once } = require('node:events')
+const { readFileSync } = require('node:fs')
+const { createSecureServer } = require('node:http2')
+const { join } = require('node:path')
+const { test } = require('node:test')
+
+const { Client } = require('..')
+
+const key = readFileSync(join(__dirname, 'fixtures', 'key.pem'))
+const cert = readFileSync(join(__dirname, 'fixtures', 'cert.pem'))
+
+const IDS = [1, 2, 3]
+
+// node http2 fires a stream's transport 'data' callback from the shared
+// session context, not the stream's context, when several streams multiplex
+// over one HTTP/2 session. onResponseData pushes each chunk into the request's
+// BodyReadable without re-entering that request's AsyncResource, so a body
+// 'data' listener can observe another concurrent request's AsyncLocalStorage
+// store. The request callback already preserves context via runInAsyncScope;
+// the body-chunk emission path must do the same.
+// https://github.com/nodejs/undici/security/advisories/GHSA-7847-2mj8-cmxv
+function buildServer () {
+  const burstStreams = new Map()
+
+  const server = createSecureServer({ key, cert })
+
+  server.on('stream', (stream, headers) => {
+    const [, mode, idText] = headers[':path'].split('/')
+    const id = Number(idText)
+    const payload = `remote-body-${id}`
+    stream.respond({ ':status': 200, 'content-length': String(Buffer.byteLength(payload)) })
+
+    if (mode === 'burst') {
+      burstStreams.set(id, { stream, payload })
+      if (burstStreams.size === IDS.length) {
+        setImmediate(() => {
+          for (const requestId of IDS) {
+            const item = burstStreams.get(requestId)
+            item.stream.end(item.payload)
+          }
+        })
+      }
+      return
+    }
+
+    stream.end(payload)
+  })
+
+  return server
+}
+
+function makeClient (origin) {
+  return new Client(origin, {
+    allowH2: true,
+    connect: { rejectUnauthorized: false }
+  })
+}
+
+async function run (t, perRequestClient) {
+  const storage = new AsyncLocalStorage()
+  const events = []
+  const sinks = Object.fromEntries(IDS.map(id => [`tenant-${id}`, []]))
+  const server = buildServer()
+
+  server.listen(0)
+  await once(server, 'listening')
+  t.after(() => server.close())
+
+  const origin = `https://localhost:${server.address().port}`
+  const shared = perRequestClient ? null : makeClient(origin)
+  const clients = new Set(shared ? [shared] : [])
+
+  try {
+    await Promise.all(IDS.map((id) => {
+      const client = shared ?? makeClient(origin)
+      clients.add(client)
+      return new Promise((resolve, reject) => {
+        storage.run(`tenant-${id}`, () => {
+          const mode = perRequestClient ? 'isolated' : 'burst'
+          client.request({ method: 'GET', path: `/${mode}/${id}` }, (err, response) => {
+            if (err) return reject(err)
+            response.body.on('data', chunk => {
+              const store = storage.getStore()
+              const request = `tenant-${id}`
+              const value = chunk.toString()
+              events.push({ request, store: store ?? null, chunk: value })
+              sinks[store]?.push(value)
+            })
+            response.body.on('error', reject)
+            response.body.on('end', resolve)
+          })
+        })
+      })
+    }))
+  } finally {
+    await Promise.all([...clients].map((client) => client.close()))
+  }
+
+  return { events, sinks }
+}
+
+test('shared HTTP/2 Client: body data events observe the owning request store', async (t) => {
+  const { events, sinks } = await run(t, false)
+
+  assert.strictEqual(events.length, IDS.length)
+  for (const id of IDS) {
+    assert.strictEqual(events[id - 1].request, `tenant-${id}`)
+    assert.strictEqual(events[id - 1].store, `tenant-${id}`)
+    assert.strictEqual(events[id - 1].chunk, `remote-body-${id}`)
+    assert.deepStrictEqual(sinks[`tenant-${id}`], [`remote-body-${id}`])
+  }
+})
+
+test('per-request HTTP/2 Client control: body data events observe the owning request store', async (t) => {
+  const { events, sinks } = await run(t, true)
+
+  assert.strictEqual(events.length, IDS.length)
+  for (const id of IDS) {
+    assert.deepStrictEqual(sinks[`tenant-${id}`], [`remote-body-${id}`])
+  }
+})
```

#### Recent Merged Pull Requests:
- **PR #6262** (2026-11-27): [Release] v8.14.0 (@github-actions[bot])
- **PR #6255** (2026-11-25): fix: destroy HTTP/1 sockets on error (@ferhatelmas)
- **PR #6252** (2026-11-23): build(deps-dev): bump fast-check from 4.10.2 to 4.10.3 (@dependabot[bot])
- **PR #6251** (2026-11-23): build(deps-dev): bump borp from 1.0.0 to 1.0.1 (@dependabot[bot])
- **PR #6250** (2026-11-23): build(deps-dev): bump @fastify/busboy from 3.2.5 to 3.2.6 (@dependabot[bot])
- **PR #6245** (2026-11-23): fix(cache): restore backing list in place on failed batch operations (@hoanle0126)

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

## X. interceptors): enforce cache-after-redirect composition order

**RULE**:
When implementing operations in `docs/docs/api/Dispatcher.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in nodejs/undici. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `416f9e32`: interceptors): enforce cache-after-redirect composition order. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing JavaScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/docs/api/Dispatcher.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// Verified production-grade fix pattern:
Because interceptors wrap each other, ordering is the end-user's responsibility.
Certain built-in interceptors are order-sensitive and will throw an
`InvalidArgumentError` if composed in an unsafe order. In particular, the
`cache` interceptor must be composed **after** the `redirect` interceptor. When
`cache` is composed before `redirect`, the cache handler is wrapped *above* the
redirect handler, so it never observes the redirect history and its
cross-origin / credential-bearing redirect guards are silently disabled.
This allows an attacker-controlled or cross-principal redirect response to be
stored under the trusted origin's cache key and replayed to unrelated callers
(see GHSA-75VM-9G8F-99J4, GHSA-MQG3-3V4R-CM32, GHSA-4W7W-5XRC-9H26 and
GHSA-7XG3-FPHP-28HG).

```js
// Correct: cache is composed after redirect.
new Agent().compose(interceptors.redirect({ maxRedirections: 5 }), interceptors.cache({}))

// Throws an InvalidArgumentError: cache composed before redirect.
new Agent().compose(interceptors.cache({}), interceptors.redirect({ maxRedirections: 5 }))
```

```

**NEGATIVE CONSTRAINT**:
```javascript
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `416f9e32` are properly handled with clean fallback behavior.
