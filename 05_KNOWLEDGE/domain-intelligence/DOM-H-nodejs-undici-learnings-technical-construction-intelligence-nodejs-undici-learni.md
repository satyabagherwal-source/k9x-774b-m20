# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: nodejs-undici-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "nodejs-undici-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-20T19:44:49.300Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-nodejs-undici-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [nodejs-undici-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-20T19:44:49.300Z`  
> **Learning ID**: `LEARN-EVO-nodejs-undici-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: K (Quality & Verification Intelligence), G (Architecture Intelligence), M (Feedback & Evolution Intelligence), D (Research & Knowledge Intelligence), I (Content & Information Intelligence), J (Search & Distribution Intelligence)
- **Confidence Rating**: 77%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from nodejs-undici-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/nodejs-undici-learnings.md`  
> **Source**: github ([https://github.com/nodejs/undici](https://github.com/nodejs/undici))  
> **Source Version**: `322a7eed`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-20T19:44:34.209Z  
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
> **Harvest Timestamp**: 2026-11-20T19:44:34.032Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `nodejs/undici`
- **Description**: An HTTP/1.1 client, written from scratch for Node.js
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 7741 stars

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
- **Issue #6054** (2026-11-17): **Pool permanently stalls after synchronous request validation errors**
  *Symptoms*: ## Bug Description  A synchronous request validation failure can leave a free `Client` permanently marked as needing drain inside a `Pool`. Subsequent valid requests stay queued even though no request is running.  With `connections: 1`, one rejected header value is enough to reproduce this. With a larger finite limit, repeated validation failures can exhaust the available client slots. This reproduces with the stock `Pool` and `request()` APIs; no custom dispatcher, interceptors, or diagnostics subscribers are involved.  ## Reproduction  Install `undici@7.30.1`, save the following as `repro.cjs`, and run:  ```sh npm install --save-exact undici@7.30.1 node --test repro.cjs ```  The test asserts the expected behavior and currently fails.  ```javascript 'use strict'  const { test } = require('node:test') const assert = require('node:assert/strict') const { createServer } = require('node:http') const { once } = require('node:events') const { setImmediate: nextTurn } = require('node:timers/promises') const { Pool } = require('undici')  test('Pool remains usable after a request validation error', { timeout: 5000 }, async (t) => {   let received = 0   const server = createServer((req, res) => {     received++     res.end('ok')   })   server.listen(0, '127.0.0.1')   await once(server, 'listening')    const pool = new Pool(`http://127.0.0.1:${server.address().port}`, { connections: 1 })   t.after(async () => {     await pool.destroy()     server.closeAllConnections()     await new Pro

- **Issue #6048** (2026-10-17): **ConnectTimeoutError: Connect Timeout Error (attempted address: discord.com:443, timeout: 10000ms**
  *Symptoms*: ## Bug Description   ## Reproduction  <!--  IMPORTANT: Provide a standalone reproduction script.  See the Reproduction guide in CONTRIBUTING.md for detailed instructions: https://github.com/nodejs/undici/blob/main/CONTRIBUTING.md#reproduction  Guidelines: - The script must be self-contained (uses only undici and Node.js built-in modules). - Use createServer from node:http to run a local server inside the script. - Run `node --test test/repro-XXXX.js` locally to confirm the bug is reproducible. - Attach the script inline or as a GitHub Gist link below. -->  **Standalone reproduction script:**  ```javascript 'use strict' import { REST } from "@discordjs/rest"; import { ActivityType, Routes } from "discord.js";    const rest = new REST({ version: "10" }).setToken(token);   console.log(`\n\n \t[LDA SYNC] Reloading slash commands /       Recarregando comandos de barra /\n\n`);   await rest.put(Routes.applicationCommands(applicationId), {     body: commands,   });   console.log(`\n\n\t [LDA SYNC] Slash commands reloaded successfully! /       Comandos de barra recarregados com sucesso! \n\n`); ```  **Steps to reproduce (if not using the script above):**  <!-- A step by step list on how the bug can be reproduced for examination. -->  ## Expected Behavior  <!-- A clear and concise description of what you expected to happen. -->  ## Actual Behavior  <!-- What actually happens instead. Include any error messages. -->  ## Logs & Screenshots   [Monitor] Erro ao atualizar o painel: Connect

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

### Incident Patch 2: `ffd0bec6` (2026-11-19)
**Commit Message**: fix: destroy a connection attempt that no request waits for (#6221)

When every request waiting on a connecting Client was aborted, the
connection attempt kept going. It held the Client, and with it a Pool
connection slot, until it connected or hit connectTimeout, and forever
with connectTimeout: 0. Since the aborted requests leave the Client
queue, the next request could also be handed to that Client and fail
with the timeout of an attempt it did not start.

The Client now keeps the socket the connector returns while it
connects. Once the last waiting request is aborted, and a Pool had the
chance to hand the Client the requests it queued, the Client destroys
that socket. The next request opens a new connection.

- An attempt that a request still waits for is kept, including a
  request queued in the Pool or dispatched right after the abort.
- The cancellation is published on undici:client:connectError, but does
  not emit 'connectionError': a Pool would retire the client.
- An attempt started through the internal kConnect is never cancelled.
- Custom connectors have to return the socket for their attempts to be
  cancelled. The docs examples now return it.

Refs: #386


Claude-Ses

**File**: `docs/docs/api/Client.md` (modified, +1/-1)
```diff
@@ -217,7 +217,7 @@ import { Client, buildConnector } from 'undici'
 const connector = buildConnector({ rejectUnauthorized: false })
 const client = new Client('https://localhost:3000', {
   connect (opts, cb) {
-    connector(opts, (err, socket) => {
+    return connector(opts, (err, socket) => {
       if (err) {
         cb(err)
       } else {
```

**File**: `docs/docs/api/Connector.md` (modified, +9/-2)
```diff
@@ -78,7 +78,7 @@ const connector = buildConnector({ rejectUnauthorized: false })
 
 const client = new Client('https://localhost:3000', {
   connect (opts, cb) {
-    connector(opts, (err, socket) => {
+    return connector(opts, (err, socket) => {
       if (err) {
         cb(err)
       } else if (/* assertion */ false) {
@@ -124,6 +124,13 @@ targets or a [`tls.TLSSocket`][] for `https:` targets, applies TCP keep-alive an
 the connect timeout, and invokes `callback` once the socket connects or errors.
 The socket is also returned synchronously.
 
+undici uses the returned socket to cancel a connection attempt that no request
+needs any more: once every request waiting for it is aborted, the socket is
+destroyed and the next request opens a new connection instead of waiting for
+it. A connector that wraps another one should return the socket it gets back,
+as the examples on this page do. If it returns nothing, the attempt runs until
+it connects or fails.
+
 When connecting over TLS, established sessions are cached (subject to
 `maxCachedSessions`) and reused for subsequent connections to the same
 `servername` or `hostname`.
@@ -141,7 +148,7 @@ const connector = buildConnector({ rejectUnauthorized: false })
 
 const client = new Client('https://localhost:3000', {
   connect (opts, cb) {
-    connector(opts, (err, socket) => {
+    return connector(opts, (err, socket) => {
       if (err) {
         cb(err)
       } else if (getIssuerCertificate(socket).fingerprint256 !== caFingerprint) {
```

**File**: `lib/dispatcher/client.js` (modified, +64/-1)
```diff
@@ -62,6 +62,7 @@ const connectH1 = require('./client-h1.js')
 const connectH2 = require('./client-h2.js')
 
 const kClosedResolve = Symbol('kClosedResolve')
+const kCancelConnect = Symbol('kCancelConnect')
 
 const getDefaultNodeMaxHeaderSize = http &&
   http.maxHeaderSize &&
@@ -323,6 +324,7 @@ class Client extends DispatcherBase {
     this[kClosedResolve] = null
     this[kMaxResponseSize] = maxResponseSize > -1 ? maxResponseSize : -1
     this[kHTTPContext] = null
+    this[kCancelConnect] = null
     // h2
     this[kHTTP2Options] = {
       pingInterval: h2Options?.pingInterval ?? pingInterval ?? 60e3,
@@ -403,6 +405,8 @@ class Client extends DispatcherBase {
 
   [kConnect] (cb) {
     connect(this)
+    // Asked for explicitly: keep it even if no request waits for it.
+    this[kCancelConnect] = null
     this.once('connect', cb)
   }
 
@@ -511,6 +515,22 @@ function abortPendingRequest (client, request, reason) {
 
   // The client may no longer be busy: emit 'drain' so a Pool can use it again.
   client[kResume](true)
+
+  if (client[kCancelConnect] !== null && client[kSize] === 0) {
+    // The drain is emitted in a microtask: check once a Pool had the chance to
+    // hand this client the requests it queued.
+    queueMicrotask(() => cancelUnusedConnect(client))
+  }
+}
+
+// A connection attempt that no request waits for only holds a connection slot,
+// until it connects or times out. Destroy it, so the next request starts a new
+// one instead of waiting for it.
+function cancelUnusedConnect (client) {
+  const cancel = client[kCancelConnect]
+  if (cancel !== null && client[kSize] === 0) {
+    cancel(new InformationalError('no request waits for this connection'))
+  }
 }
 
 function onError (client, err) {
@@ -559,6 +579,9 @@ function connect (client) {
 
   client[kConnecting] = true
 
+  let calledBack = false
+  let cancelled = false
+
   if (channels.beforeConnect.hasSubscribers) {
     channels.beforeConnect.publish({
       connectParams: {
@@ -575,14 +598,25 @@ function connect (client) {
   }
 
   try {
-    client[kConnector]({
+    const connecting = client[kConnector]({
       host,
       hostname,
       protocol,
       port,
       servername: client[kServerName],
       localAddress: client[kLocalAddress]
     }, (err, socket) => {
+      calledBack = true
+
+      if (cancelled) {
+        if (socket) {
+          util.destroy(socket.on('error', noop))
+        }
+        return
+      }
+
+      client[kCancelConnect] = null
+
       if (err) {
         handleConnectError(client, err, { host, hostname, protocol, port })
         client[kResume]()
@@ -634,6 +668,35 @@ function connect (client) {
       client.emit('connect', client[kUrl], [client])
       client[kResume]()
     })
+
+    // The attempt can only be cancelled through the socket the connector
+    // returns. The built-in connector returns it; custom connectors may not.
+    if (!calledBack && util.isStream(connecting)) {
+      client[kCancelConnect] = (err) => {
+        cancelled = true
+        client[kCancelConnect] = null
+        client[kConnecting] = false
+
+        // Not a 'connectionError': that would make a Pool retire this client.
+        if (channels.connectError.hasSubscribers) {
+          channels.connectError.publish({
+            connectParams: {
+              host,
+              hostname,
+              protocol,
+              port,
+              version: client[kHTTPContext]?.version,
+              servername: client[kServerName],
+              localAddress: client[kLocalAddress]
+            },
+            connector: client[kConnector],
+            error: err
+          })
+        }
+
+        util.destroy(connecting.on('error', noop), err)
+      }
+    }
   } catch (err) {
     handleConnectError(client, err, { host, hostname, protocol, port })
     client[kResume]()
```

**File**: `test/cancel-unused-connect.js` (added, +247/-0)
```diff
@@ -0,0 +1,247 @@
+'use strict'
+
+// A connection attempt whose requests were all aborted must not keep its
+// connection slot until it connects or times out: the Client destroys it, and
+// the next request opens a new connection. An attempt that a request still
+// waits for is kept.
+
+const { test } = require('node:test')
+const assert = require('node:assert')
+const { once } = require('node:events')
+const net = require('node:net')
+const https = require('node:https')
+const http2 = require('node:http2')
+const diagnosticsChannel = require('node:diagnostics_channel')
+const pem = require('@metcoder95/https-pem')
+const { Client, Pool, buildConnector } = require('..')
+
+// Fails the test instead of hanging it when the promise does not settle.
+function settlesWithin (promise, ms = 2000) {
+  let timer
+  return Promise.race([
+    promise,
+    new Promise((resolve, reject) => {
+      timer = setTimeout(() => reject(new Error(`still pending after ${ms}ms`)), ms)
+    })
+  ]).finally(() => clearTimeout(timer))
+}
+
+// A TLS server behind a TCP front. The front holds the first connection: it
+// never forwards it, so its TLS handshake hangs, or forwards it after
+// `delayFirst` ms. Later connections are forwarded at once.
+async function startServer (t, { h2 = false, delayFirst = null } = {}) {
+  const handler = (req, res) => res.end('ok')
+  const server = h2
+    ? http2.createSecureServer({ ...pem, allowHTTP1: true }, handler)
+    : https.createServer(pem, handler)
+  server.listen(0)
+  await once(server, 'listening')
+
+  const sockets = []
+  let accepted = 0
+  let first = null
+  let onFirst
+  const firstAccepted = new Promise(resolve => { onFirst = resolve })
+  const front = net.createServer((socket) => {
+    accepted++
+    sockets.push(socket)
+    const forward = () => {
+      const upstream = net.connect(server.address().port)
+      sockets.push(upstream)
+      socket.pipe(upstream).pipe(socket)
+      socket.on('error', () => upstream.destroy())
+      upstream.on('error', () => socket.destroy())
+    }
+
+    if (first !== null) {
+      forward()
+      return
+    }
+
+    first = socket
+    onFirst(socket)
+    if (delayFirst !== null) {
+      setTimeout(forward, delayFirst)
+    } else {
+      // Read and drop the handshake, so the client closing it is seen.
+      socket.resume()
+    }
+  })
+  front.listen(0)
+  await once(front, 'listening')
+
+  t.after(() => {
+    for (const socket of sockets) socket.destroy()
+    front.close()
+    server.close()
+  })
+
+  return {
+    origin: `https://localhost:${front.address().port}`,
+    accepted: () => accepted,
+    // Resolves once the client closed the first connection.
+    firstClosed: async () => {
+      const socket = await firstAccepted
+      if (!socket.destroyed) {
+        await once(socket, 'close')
+      }
+    }
+  }
+}
+
+for (const h2 of [false, true]) {
+  for (const connectTimeout of [undefined, 0]) {
+    test(`${h2 ? 'h2' : 'h1'}, connectTimeout ${connectTimeout}: a connection attempt whose only request was aborted is destroyed`, async (t) => {
+      const server = await startServer(t, { h2 })
+      const pool = new Pool(server.origin, {
+        connections: 1,
+        connectTimeout,
+        allowH2: h2,
+        connect: { rejectUnauthorized: false }
+      })
+      t.after(() => pool.destroy())
+
+      const connectionErrors = []
+      pool.on('connectionError', (origin, targets, err) => connectionErrors.push(err))
+
+      const ac = new AbortController()
+      const first = pool.request({ path: '/', method: 'GET', signal: ac.signal })
+      await new Promise(resolve => setTimeout(resolve, 50))
+      ac.abort()
+      await assert.rejects(settlesWithin(first), { name: 'AbortError' })
+
+      // The hanging handshake is closed instead of holding the only slot.
+      await settlesWithin(server.firstClosed())
+
+      const { statusCode, body } = await settlesWithin(pool.request({ path: '/', method: 'GET' }))
+      assert.strictEqual(statusCode, 200)
+      assert.strictEqual(await body.text(), 'ok')
+      assert.strictEqual(server.accepted(), 2)
+
+      // Cancelling is not a connection error: the Pool keeps its client.
+      assert.deepStrictEqual(connectionErrors, [])
+    })
+  }
+}
+
+test('a cancelled connection attempt is published as a connect error', async (t) => {
+  const server = await startServer(t)
+  const client = new Client(server.origin, { connect: { rejectUnauthorized: false } })
+  t.after(() => client.destroy())
+
+  const errors = []
+  const onConnectError = ({ error }) => errors.push(error)
+  diagnosticsChannel.subscribe('undici:client:connectError', onConnectError)
+  t.after(() => diagnosticsChannel.unsubscribe('undici:client:connectError', onConnectError))
+
+  const ac = new AbortController()
+  const request = client.request({ path: '/', method: 'GET', signal: ac.signal })
+  await new Promise(resolve => setTimeout(resolve, 50))
+  ac.abort()
+  awa
```

---

### Incident Patch 3: `6b22aba1` (2026-11-20)
**Commit Message**: fix: do not send a request on a connection verified for another servername (#6233)

Since #6219, a request aborted while it waits for a connection leaves the
queue. When a Client serves several TLS server names and the aborted
request was the last one for the name it was connecting for, _resume()
switched client[kServerName] to the next queued request's name while the
connection was pending. Once connected, that connection, whose certificate
was verified for the previous name, was used for the next request.

A connection attempt now records the servername it verifies. If the
Client switched to another name by the time it connects, the socket is
destroyed and a new connection is opened for the current name. When
_resume() switches the name, it also cancels the pending attempt, so the
request does not wait for a connection it cannot use. A certificate name
error now only fails the requests for the name it was raised for.

Refs: #6219

Signed-off-by: Matteo Collina <[REDACTED_EMAIL]>

**File**: `lib/dispatcher/client.js` (modified, +51/-29)
```diff
@@ -579,9 +579,38 @@ function connect (client) {
 
   client[kConnecting] = true
 
+  // The name this attempt verifies the server's certificate for. While it
+  // connects, its requests can be aborted and _resume() can switch
+  // client[kServerName] to the name of the next queued request.
+  const servername = client[kServerName]
+
   let calledBack = false
   let cancelled = false
 
+  // Ends this attempt without a 'connectionError': no request failed, and a
+  // Pool would retire this client.
+  const abandon = (socket, err) => {
+    client[kConnecting] = false
+
+    if (channels.connectError.hasSubscribers) {
+      channels.connectError.publish({
+        connectParams: {
+          host,
+          hostname,
+          protocol,
+          port,
+          version: client[kHTTPContext]?.version,
+          servername,
+          localAddress: client[kLocalAddress]
+        },
+        connector: client[kConnector],
+        error: err
+      })
+    }
+
+    util.destroy(socket.on('error', noop), err)
+  }
+
   if (channels.beforeConnect.hasSubscribers) {
     channels.beforeConnect.publish({
       connectParams: {
@@ -590,7 +619,7 @@ function connect (client) {
         protocol,
         port,
         version: client[kHTTPContext]?.version,
-        servername: client[kServerName],
+        servername,
         localAddress: client[kLocalAddress]
       },
       connector: client[kConnector]
@@ -603,7 +632,7 @@ function connect (client) {
       hostname,
       protocol,
       port,
-      servername: client[kServerName],
+      servername,
       localAddress: client[kLocalAddress]
     }, (err, socket) => {
       calledBack = true
@@ -618,7 +647,7 @@ function connect (client) {
       client[kCancelConnect] = null
 
       if (err) {
-        handleConnectError(client, err, { host, hostname, protocol, port })
+        handleConnectError(client, err, { host, hostname, protocol, port, servername })
         client[kResume]()
         return
       }
@@ -631,13 +660,21 @@ function connect (client) {
 
       assert(socket)
 
+      if (client[kServerName] !== servername) {
+        // The server proved its identity for another name than the one the
+        // queued requests are for: never send them on this connection.
+        abandon(socket, new InformationalError('servername changed'))
+        client[kResume]()
+        return
+      }
+
       try {
         client[kHTTPContext] = socket.alpnProtocol === 'h2'
           ? connectH2(client, socket)
           : connectH1(client, socket)
       } catch (err) {
         socket.destroy().on('error', noop)
-        handleConnectError(client, err, { host, hostname, protocol, port })
+        handleConnectError(client, err, { host, hostname, protocol, port, servername })
         client[kResume]()
         return
       }
@@ -657,7 +694,7 @@ function connect (client) {
             protocol,
             port,
             version: client[kHTTPContext]?.version,
-            servername: client[kServerName],
+            servername,
             localAddress: client[kLocalAddress]
           },
           connector: client[kConnector],
@@ -675,35 +712,16 @@ function connect (client) {
       client[kCancelConnect] = (err) => {
         cancelled = true
         client[kCancelConnect] = null
-        client[kConnecting] = false
-
-        // Not a 'connectionError': that would make a Pool retire this client.
-        if (channels.connectError.hasSubscribers) {
-          channels.connectError.publish({
-            connectParams: {
-              host,
-              hostname,
-              protocol,
-              port,
-              version: client[kHTTPContext]?.version,
-              servername: client[kServerName],
-              localAddress: client[kLocalAddress]
-            },
-            connector: client[kConnector],
-            error: err
-          })
-        }
-
-        util.destroy(connecting.on('error', noop), err)
+        abandon(connecting, err)
       }
     }
   } catch (err) {
-    handleConnectError(client, err, { host, hostname, protocol, port })
+    handleConnectError(client, err, { host, hostname, protocol, port, servername })
     client[kResume]()
   }
 }
 
-function handleConnectError (client, err, { host, hostname, protocol, port }) {
+function handleConnectError (client, err, { host, hostname, protocol, port, servername }) {
   if (client.destroyed) {
     return
   }
@@ -718,7 +736,7 @@ function handleConnectError (client, err, { host, hostname, protocol, port }) {
         protocol,
         port,
         version: client[kHTTPContext]?.version,
-        servername: client[kServerName],
+        servername,
         localAddress: client[kLocalAddress]
       },
       connector: client[kConnector],
@@ -734,7 +752,8 @@ function handleConnectError (client, err, { host, hostname, protocol, port }) {
       util.errorRequest(client, running[i], err)
     }
 
-    while (client[kPending] > 0 && client[kQu
```

**File**: `test/servername-switch-while-connecting.js` (added, +195/-0)
```diff
@@ -0,0 +1,195 @@
+'use strict'
+
+// A Client serves requests for several TLS server names, one at a time. A
+// connection attempt verifies the server for one name. If its requests are
+// aborted while it connects and the next queued request is for another name,
+// that request must not be sent on this connection: the server never proved
+// its identity for that name.
+
+const { test } = require('node:test')
+const assert = require('node:assert')
+const { once } = require('node:events')
+const net = require('node:net')
+const https = require('node:https')
+const http2 = require('node:http2')
+const pem = require('@metcoder95/https-pem')
+const { Client, Agent, interceptors, buildConnector } = require('..')
+
+// Fails the test instead of hanging it when the promise does not settle.
+function settlesWithin (promise, ms = 2000) {
+  let timer
+  return Promise.race([
+    promise,
+    new Promise((resolve, reject) => {
+      timer = setTimeout(() => reject(new Error(`still pending after ${ms}ms`)), ms)
+    })
+  ]).finally(() => clearTimeout(timer))
+}
+
+// The certificate is trusted, but valid only for a.test.
+function onlyATest (host) {
+  if (host !== 'a.test') {
+    return Object.assign(new Error(`Hostname/IP does not match certificate's altnames: Host: ${host}`), {
+      code: 'ERR_TLS_CERT_ALTNAME_INVALID'
+    })
+  }
+}
+
+// The certificate is trusted for any name.
+function anyName () {}
+
+// A TLS server behind a TCP front. The front holds the first connection, so
+// its TLS handshake is pending when the request is aborted: it never forwards
+// it, or forwards it after `delayFirst` ms. Later connections are forwarded at
+// once. The server records the Host and the TLS server name of each request.
+async function startServer (t, { h2 = false, delayFirst = null } = {}) {
+  const served = []
+  const handler = (req, res) => {
+    const host = (req.headers[':authority'] ?? req.headers.host).split(':')[0]
+    served.push({ host, servername: req.socket.servername })
+    res.end(host)
+  }
+  const server = h2
+    ? http2.createSecureServer({ ...pem, allowHTTP1: true }, handler)
+    : https.createServer(pem, handler)
+  server.listen(0, '127.0.0.1')
+  await once(server, 'listening')
+
+  const sockets = []
+  let first = null
+  let timer = null
+  const front = net.createServer((socket) => {
+    sockets.push(socket)
+    const forward = () => {
+      if (socket.destroyed) {
+        return
+      }
+      const upstream = net.connect(server.address().port, '127.0.0.1')
+      sockets.push(upstream)
+      socket.pipe(upstream).pipe(socket)
+      socket.on('error', () => upstream.destroy())
+      upstream.on('error', () => socket.destroy())
+    }
+
+    if (first !== null) {
+      forward()
+      return
+    }
+
+    first = socket
+    if (delayFirst !== null) {
+      timer = setTimeout(forward, delayFirst)
+    } else {
+      socket.resume()
+    }
+  })
+  front.listen(0, '127.0.0.1')
+  await once(front, 'listening')
+
+  t.after(() => {
+    clearTimeout(timer)
+    for (const socket of sockets) socket.destroy()
+    front.close()
+    server.close()
+  })
+
+  return { port: front.address().port, served }
+}
+
+// Starts a request for a.test, queues one for b.test, then aborts the first
+// while its connection attempt is pending.
+async function abortFirstWhileConnecting (dispatch) {
+  const ac = new AbortController()
+  const a = dispatch('a.test', ac.signal)
+  const b = dispatch('b.test')
+  await new Promise(resolve => setTimeout(resolve, 50))
+  ac.abort()
+  await assert.rejects(a, { name: 'AbortError' })
+  return b
+}
+
+function clientDispatch (client) {
+  return (host, signal) => client.request({
+    path: '/',
+    method: 'GET',
+    servername: host,
+    headers: { host },
+    signal
+  })
+}
+
+for (const h2 of [false, true]) {
+  const name = h2 ? 'h2' : 'h1'
+
+  test(`${name}: a request is not sent on a connection verified for another servername`, async (t) => {
+    const { port, served } = await startServer(t, { h2, delayFirst: 200 })
+    const client = new Client(`https://127.0.0.1:${port}`, {
+      allowH2: h2,
+      connect: { ca: pem.cert, checkServerIdentity: onlyATest }
+    })
+    t.after(() => client.destroy())
+
+    const b = abortFirstWhileConnecting(clientDispatch(client))
+
+    await assert.rejects(settlesWithin(b), { code: 'ERR_TLS_CERT_ALTNAME_INVALID' })
+    assert.deepStrictEqual(served, [])
+  })
+
+  test(`${name}: the next request connects with its own servername without waiting for the abandoned attempt`, async (t) => {
+    // The first connection never completes its handshake.
+    const { port, served } = await startServer(t, { h2 })
+    const client = new Client(`https://127.0.0.1:${port}`, {
+      allowH2: h2,
+      connect: { ca: pem.cert, checkServerIdentity: anyName }
+    })
+    t.after(() => client.destroy())
+
+    const b = abortFirstWhileConnecting(clientDispatch(client))
+
+    const res = await set
```

#### Recent Merged Pull Requests:
- **PR #6233** (2026-11-20): fix: do not send a request on a connection verified for another servername (@mcollina)
- **PR #6228** (2026-11-20): [Release] v8.13.0 (@github-actions[bot])
- **PR #6225** (2026-11-20): fix(pipeline): abort request when response body is dropped early (@ferhatelmas)
- **PR #6221** (2026-11-19): fix: destroy a connection attempt that no request waits for (@mcollina)
- **PR #6220** (2026-11-19): interceptors: enforce cache-after-redirect composition order (@mcollina)
- **PR #6219** (2026-11-19): fix: reject requests aborted while waiting for a connection (@mcollina)

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


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
