> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/nodejs-undici-learnings.md`  
> **Source**: github ([https://github.com/nodejs/undici](https://github.com/nodejs/undici))  
> **Source Version**: `55bf2946`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-07T05:37:01.190Z  
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
> **Harvest Timestamp**: 2026-11-07T05:36:59.750Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `nodejs/undici`
- **Description**: An HTTP/1.1 client, written from scratch for Node.js
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 7728 stars

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
- **Issue #6048** (2026-10-17): **ConnectTimeoutError: Connect Timeout Error (attempted address: discord.com:443, timeout: 10000ms**
  *Symptoms*: ## Bug Description   ## Reproduction  <!--  IMPORTANT: Provide a standalone reproduction script.  See the Reproduction guide in CONTRIBUTING.md for detailed instructions: https://github.com/nodejs/undici/blob/main/CONTRIBUTING.md#reproduction  Guidelines: - The script must be self-contained (uses only undici and Node.js built-in modules). - Use createServer from node:http to run a local server inside the script. - Run `node --test test/repro-XXXX.js` locally to confirm the bug is reproducible. - Attach the script inline or as a GitHub Gist link below. -->  **Standalone reproduction script:**  ```javascript 'use strict' import { REST } from "@discordjs/rest"; import { ActivityType, Routes } from "discord.js";    const rest = new REST({ version: "10" }).setToken(token);   console.log(`\n\n \t[LDA SYNC] Reloading slash commands /       Recarregando comandos de barra /\n\n`);   await rest.put(Routes.applicationCommands(applicationId), {     body: commands,   });   console.log(`\n\n\t [LDA SYNC] Slash commands reloaded successfully! /       Comandos de barra recarregados com sucesso! \n\n`); ```  **Steps to reproduce (if not using the script above):**  <!-- A step by step list on how the bug can be reproduced for examination. -->  ## Expected Behavior  <!-- A clear and concise description of what you expected to happen. -->  ## Actual Behavior  <!-- What actually happens instead. Include any error messages. -->  ## Logs & Screenshots   [Monitor] Erro ao atualizar o painel: Connect

- **Issue #5995** (2026-10-10): **see the cause **
  *Symptoms*: ## Bug Description  <!-- A clear and concise description of what the bug is. -->  ## Reproduction  <!--  IMPORTANT: Provide a standalone reproduction script.  See the Reproduction guide in CONTRIBUTING.md for detailed instructions: https://github.com/nodejs/undici/blob/main/CONTRIBUTING.md#reproduction  Guidelines: - The script must be self-contained (uses only undici and Node.js built-in modules). - Use createServer from node:http to run a local server inside the script. - Run `node --test test/repro-XXXX.js` locally to confirm the bug is reproducible. - Attach the script inline or as a GitHub Gist link below. -->  **Standalone reproduction script:**  ```javascript 'use strict'  // Paste your standalone reproduction script here. // Example structure: // // const { test } = require('node:test') // const { createServer } = require('node:http') // const { once } = require('node:events') // const { Client } = require('undici') // // test('bug reproduction', { timeout: 60000 }, async (t) => { //   t.plan(1) // //   const server = createServer(...) //   t.after(() => server.close()) //   ... // }) ```  **Steps to reproduce (if not using the script above):**  <!-- A step by step list on how the bug can be reproduced for examination. -->  ## Expected Behavior  <!-- A clear and concise description of what you expected to happen. -->  ## Actual Behavior  <!-- What actually happens instead. Include any error messages. -->  ## Logs & Screenshots  <!-- If applicable, add screenshots to h

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

### Incident Patch 1: `10fa8227` (2026-11-05)
**Commit Message**: docs: remove security release notes

Signed-off-by: Matteo Collina <[REDACTED_EMAIL]>

**File**: `changelogs/v7.30.2.md` (removed, +0/-27)
```diff
@@ -1,27 +0,0 @@
-# undici 7.30.2 security fixes
-
-This release fixes six vulnerabilities.
-
-## CVE-2026-116592 / GHSA-mqg3-3v4r-cm32 (high)
-
-Undici 7.30.1 could cache the final response from a redirect chain under the original request key without applying the origin, cache policy, freshness, or `Vary` requirements of every intermediate hop. This could poison a cache or expose one user's response to another user. The fix validates every redirect hop, combines their `Vary` fields, limits freshness and stale serving to the most restrictive hop, and invalidates persistent SQLite entries written by vulnerable releases.
-
-## CVE-2026-120474 / GHSA-7xg3-fphp-28hg (medium)
-
-In Undici 7.x, a shared cache used with `compose(redirect(), cache())` could store a credential-dependent response from a same-origin redirect under the original URL. A later authenticated or unauthenticated request could then receive another user's response. Redirected requests carrying `Authorization`, `Cookie`, or `Proxy-Authorization` are no longer stored under the original alias key.
-
-## CVE-2026-116630 / GHSA-5rm8-gv32-r954 (medium)
-
-In Undici 7.x, a cross-origin redirect during cache revalidation could let a `304 Not Modified` response from the redirect target validate a cached response from the original origin. Undici now checks that the revalidation target matches the cached URL and that any returned validator matches the stored representation before replaying the cached body.
-
-## CVE-2026-120415 / GHSA-9v6h-8rgp-m69f (medium)
-
-In Undici 7.x, the redirect interceptor did not strip credentials correctly when request headers were supplied as an array of `[name, value]` pairs. With a header-normalizing interceptor outside `redirect()`, credentials could be sent to a cross-origin redirect target. Undici now handles both tuple arrays and flat header arrays when removing sensitive headers.
-
-## CVE-2026-120222 / GHSA-3g9m-rv3r-w5w2 (medium)
-
-In Undici 7.x, a downstream handler exception during cache replay could escape as an uncaught exception or unhandled promise rejection and terminate the process. This included `dump` size-limit failures, excessive `Content-Encoding` values in `decompress`, asynchronous cache-store failures, and cached-body replay after a `304`. These failures are now reported as request errors.
-
-## CVE-2026-120423 / GHSA-r4pc-4jcp-7pqc (medium)
-
-Undici 7.15.0 through 7.30.1 could skip Subresource Integrity verification when valid integrity metadata was separated or surrounded by ASCII whitespace other than a space, including a horizontal tab. Integrity metadata is now split on all ASCII whitespace before SHA-256, SHA-384, or SHA-512 verification.
```

**File**: `changelogs/v8.12.4.md` (removed, +0/-27)
```diff
@@ -1,27 +0,0 @@
-# undici 8.12.4 security fixes
-
-This release fixes six vulnerabilities.
-
-## CVE-2026-116592 / GHSA-mqg3-3v4r-cm32 (high)
-
-Undici 8.12.2 and 8.12.3 could cache the final response from a redirect chain under the original request key without applying the origin, cache policy, freshness, or `Vary` requirements of every intermediate hop. This could poison a cache or expose one user's response to another user. The fix validates every redirect hop, combines their `Vary` fields, limits freshness and stale serving to the most restrictive hop, and invalidates persistent SQLite entries written by vulnerable releases.
-
-## CVE-2026-120474 / GHSA-7xg3-fphp-28hg (medium)
-
-A shared cache used with `compose(redirect(), cache())` could store a credential-dependent response from a same-origin redirect under the original URL. A later authenticated or unauthenticated request could then receive another user's response. Redirected requests carrying `Authorization`, `Cookie`, or `Proxy-Authorization` are no longer stored under the original alias key.
-
-## CVE-2026-116630 / GHSA-5rm8-gv32-r954 (medium)
-
-A cross-origin redirect during cache revalidation could let a `304 Not Modified` response from the redirect target validate a cached response from the original origin. Undici now checks that the revalidation target matches the cached URL and that any returned validator matches the stored representation before replaying the cached body.
-
-## CVE-2026-120415 / GHSA-9v6h-8rgp-m69f (medium)
-
-The redirect interceptor did not strip credentials correctly when request headers were supplied as an array of `[name, value]` pairs. With a header-normalizing interceptor outside `redirect()`, credentials could be sent to a cross-origin redirect target. Undici now handles both tuple arrays and flat header arrays when removing sensitive headers.
-
-## CVE-2026-120222 / GHSA-3g9m-rv3r-w5w2 (medium)
-
-A downstream handler exception during cache replay could escape as an uncaught exception or unhandled promise rejection and terminate the process. This included `dump` size-limit failures, excessive `Content-Encoding` values in `decompress`, asynchronous cache-store failures, and cached-body replay after a `304`. These failures are now reported as request errors.
-
-## CVE-2026-120423 / GHSA-r4pc-4jcp-7pqc (medium)
-
-`fetch()` could skip Subresource Integrity verification when valid integrity metadata was separated or surrounded by ASCII whitespace other than a space, including a horizontal tab. Integrity metadata is now split on all ASCII whitespace before SHA-256, SHA-384, or SHA-512 verification.
```

---

### Incident Patch 2: `6228fc59` (2026-11-04)
**Commit Message**: docs: add security release notes

Signed-off-by: Matteo Collina <[REDACTED_EMAIL]>

**File**: `changelogs/v7.30.2.md` (added, +27/-0)
```diff
@@ -0,0 +1,27 @@
+# undici 7.30.2 security fixes
+
+This release fixes six vulnerabilities.
+
+## CVE-2026-116592 / GHSA-mqg3-3v4r-cm32 (high)
+
+Undici 7.30.1 could cache the final response from a redirect chain under the original request key without applying the origin, cache policy, freshness, or `Vary` requirements of every intermediate hop. This could poison a cache or expose one user's response to another user. The fix validates every redirect hop, combines their `Vary` fields, limits freshness and stale serving to the most restrictive hop, and invalidates persistent SQLite entries written by vulnerable releases.
+
+## CVE-2026-120474 / GHSA-7xg3-fphp-28hg (medium)
+
+In Undici 7.x, a shared cache used with `compose(redirect(), cache())` could store a credential-dependent response from a same-origin redirect under the original URL. A later authenticated or unauthenticated request could then receive another user's response. Redirected requests carrying `Authorization`, `Cookie`, or `Proxy-Authorization` are no longer stored under the original alias key.
+
+## CVE-2026-116630 / GHSA-5rm8-gv32-r954 (medium)
+
+In Undici 7.x, a cross-origin redirect during cache revalidation could let a `304 Not Modified` response from the redirect target validate a cached response from the original origin. Undici now checks that the revalidation target matches the cached URL and that any returned validator matches the stored representation before replaying the cached body.
+
+## CVE-2026-120415 / GHSA-9v6h-8rgp-m69f (medium)
+
+In Undici 7.x, the redirect interceptor did not strip credentials correctly when request headers were supplied as an array of `[name, value]` pairs. With a header-normalizing interceptor outside `redirect()`, credentials could be sent to a cross-origin redirect target. Undici now handles both tuple arrays and flat header arrays when removing sensitive headers.
+
+## CVE-2026-120222 / GHSA-3g9m-rv3r-w5w2 (medium)
+
+In Undici 7.x, a downstream handler exception during cache replay could escape as an uncaught exception or unhandled promise rejection and terminate the process. This included `dump` size-limit failures, excessive `Content-Encoding` values in `decompress`, asynchronous cache-store failures, and cached-body replay after a `304`. These failures are now reported as request errors.
+
+## CVE-2026-120423 / GHSA-r4pc-4jcp-7pqc (medium)
+
+Undici 7.15.0 through 7.30.1 could skip Subresource Integrity verification when valid integrity metadata was separated or surrounded by ASCII whitespace other than a space, including a horizontal tab. Integrity metadata is now split on all ASCII whitespace before SHA-256, SHA-384, or SHA-512 verification.
```

**File**: `changelogs/v8.12.4.md` (added, +27/-0)
```diff
@@ -0,0 +1,27 @@
+# undici 8.12.4 security fixes
+
+This release fixes six vulnerabilities.
+
+## CVE-2026-116592 / GHSA-mqg3-3v4r-cm32 (high)
+
+Undici 8.12.2 and 8.12.3 could cache the final response from a redirect chain under the original request key without applying the origin, cache policy, freshness, or `Vary` requirements of every intermediate hop. This could poison a cache or expose one user's response to another user. The fix validates every redirect hop, combines their `Vary` fields, limits freshness and stale serving to the most restrictive hop, and invalidates persistent SQLite entries written by vulnerable releases.
+
+## CVE-2026-120474 / GHSA-7xg3-fphp-28hg (medium)
+
+A shared cache used with `compose(redirect(), cache())` could store a credential-dependent response from a same-origin redirect under the original URL. A later authenticated or unauthenticated request could then receive another user's response. Redirected requests carrying `Authorization`, `Cookie`, or `Proxy-Authorization` are no longer stored under the original alias key.
+
+## CVE-2026-116630 / GHSA-5rm8-gv32-r954 (medium)
+
+A cross-origin redirect during cache revalidation could let a `304 Not Modified` response from the redirect target validate a cached response from the original origin. Undici now checks that the revalidation target matches the cached URL and that any returned validator matches the stored representation before replaying the cached body.
+
+## CVE-2026-120415 / GHSA-9v6h-8rgp-m69f (medium)
+
+The redirect interceptor did not strip credentials correctly when request headers were supplied as an array of `[name, value]` pairs. With a header-normalizing interceptor outside `redirect()`, credentials could be sent to a cross-origin redirect target. Undici now handles both tuple arrays and flat header arrays when removing sensitive headers.
+
+## CVE-2026-120222 / GHSA-3g9m-rv3r-w5w2 (medium)
+
+A downstream handler exception during cache replay could escape as an uncaught exception or unhandled promise rejection and terminate the process. This included `dump` size-limit failures, excessive `Content-Encoding` values in `decompress`, asynchronous cache-store failures, and cached-body replay after a `304`. These failures are now reported as request errors.
+
+## CVE-2026-120423 / GHSA-r4pc-4jcp-7pqc (medium)
+
+`fetch()` could skip Subresource Integrity verification when valid integrity metadata was separated or surrounded by ASCII whitespace other than a space, including a horizontal tab. Integrity metadata is now split on all ASCII whitespace before SHA-256, SHA-384, or SHA-512 verification.
```

---

### Incident Patch 3: `03feee27` (2026-10-24)
**Commit Message**: fix(cache): prevent cross-origin redirect cache bypass

A redirect that bounces through an untrusted intermediate origin and
lands back on the trusted origin was cached under the original key
because the origin guard only checked the final URL. Redirect hops also
carried storage policies that were dropped (no-cache, must-revalidate,
zero freshness, Vary: *, Vary: Authorization), letting a private or
authenticated final response be served to unrelated callers.

- Require every hop in the redirect chain to stay on the cache key origin.
- Refuse to fold a final response under the original key when any hop is
  not storable (no-store, private for shared caches, no-cache,
  must-revalidate, zero freshness, Vary: *, or an uncacheable 3xx).
- Union Vary across all hops and the final response.
- Bound the stored freshness by the shortest hop freshness.

Refs: GHSA-MQG3-3V4R-CM32
Signed-off-by: Matteo Collina <[REDACTED_EMAIL]>

**File**: `lib/handler/cache-handler.js` (modified, +163/-24)
```diff
@@ -10,6 +10,16 @@ const {
   isInvalidOrWildcardVaryHeader,
   isEtagUsable
 } = require('../util/cache')
+
+/**
+ * A suppressed redirect hop recorded by the redirect handler. Carried on
+ * {@link kRedirectCacheControl} and inspected by the cache handler before the
+ * final response is stored under the original request key.
+ *
+ * @typedef {object} RedirectHop
+ * @property {number} statusCode The hop's response status code (e.g. 302).
+ * @property {import('../../types/header.d.ts').IncomingHttpHeaders} headers The hop's response headers.
+ */
 const { parseHttpDate } = require('../util/date.js')
 
 function noop () {}
@@ -105,6 +115,16 @@ function arrayIncludes (array, value) {
   return false
 }
 
+function appendVaryValues (target, varyValue) {
+  if (Array.isArray(varyValue)) {
+    for (let i = 0; i < varyValue.length; i++) {
+      target.push(varyValue[i])
+    }
+  } else if (varyValue != null) {
+    target.push(varyValue)
+  }
+}
+
 function appendConnectionHeaderTokens (headersToRemove, connectionHeader) {
   const values = Array.isArray(connectionHeader) ? connectionHeader : [connectionHeader]
 
@@ -220,7 +240,7 @@ class CacheHandler {
   /**
    * The URLs visited while following redirects, shared by reference from the
    * redirect handler through the request context. Carries the suppressed hops'
-   * cache-control under {@link kRedirectCacheControl}.
+   * status/headers under {@link kRedirectCacheControl}.
    * @type {URL[] | undefined}
    */
   #history
@@ -299,27 +319,29 @@ class CacheHandler {
     // A cross-origin redirect can change the origin that actually produced the
     // final response. Keying that response on the original (trusted) origin
     // would let a redirect target control an entry for a URL the application
-    // trusts. The final request is the last URL in the redirect history; only
-    // cache when its origin still matches the cache key origin.
+    // trusts. Every hop in the redirect chain must stay on the cache key's
+    // origin. An intermediate cross-origin hop can bounce back to the trusted
+    // origin (or to any cacheable asset there) even when the final response
+    // comes from the trusted origin, so checking only the final URL is not
+    // enough.
     if (this.#history && this.#history.length > 0) {
-      const finalUrl = this.#history[this.#history.length - 1]
-      if (!sameOrigin(finalUrl.origin, this.#cacheKey.origin)) {
-        return downstreamOnHeaders()
+      for (const hopUrl of this.#history) {
+        if (!sameOrigin(hopUrl.origin, this.#cacheKey.origin)) {
+          return downstreamOnHeaders()
+        }
       }
     }
 
-    // A redirect hop that is not forwarded can still carry a restrictive
-    // storage policy (for example `no-store`, or `private` for a shared cache).
-    // Honor it, otherwise a redirect that must not be stored could be laundered
-    // into a cacheable final response under the original key.
-    const redirectCacheControl = this.#history?.[kRedirectCacheControl]
-    if (redirectCacheControl) {
-      for (const hopCacheControl of redirectCacheControl) {
-        const hopDirectives = hopCacheControl ? parseCacheControlHeader(hopCacheControl) : {}
-        if (
-          hopDirectives['no-store'] === true ||
-          (this.#cacheType === 'shared' && hopDirectives.private === true)
-        ) {
+    // A redirect hop that is not forwarded can still carry a storage policy
+    // (for example `no-store`, `private` for a shared cache, `no-cache`,
+    // `must-revalidate`, zero freshness, or `Vary: *`) that the final response
+    // body does not inherit. Honor it, otherwise a redirect that must not be
+    // stored (or that selects a private/authenticated target) could be
+    // laundered into a cacheable final response under the original key.
+    const redirectHopInfo = this.#history?.[kRedirectCacheControl]
+    if (redirectHopInfo) {
+      for (const hop of redirectHopInfo) {
+        if (!isHopStorable(this.#cacheType, this.#cacheKey.method, hop, this.#cacheKey.headers)) {
           return downstreamOnHeaders()
         }
       }
@@ -378,9 +400,17 @@ class CacheHandler {
       (typeof resHeaders.etag === 'string' && isEtagUsable(resHeaders.etag)) ||
       typeof resHeaders['last-modified'] === 'string'
 
-    const staleAt =
+    let staleAt =
       determineStaleAt(this.#cacheType, now, resAge, resHeaders, resDate, cacheControlDirectives, hasValidator) ??
       this.#cacheByDefault
+    // Never let a redirect hop with a shorter explicit freshness lifetime
+    // outlive the final response's freshness. Otherwise a dynamic redirect
+    // (e.g. `max-age=60`) that points at a long-lived static asset would freeze
+    // the original URL for the asset's lifetime.
+    const hopStaleBound = getHopStaleBound(this.#cacheType, redirectHopInfo)
+    if (hopStaleBound !== undefined && staleAt !== undefined) {
+      staleAt = Math.min(staleAt, hopStaleBound)
+    }
     // Zer
```

**File**: `lib/handler/redirect-handler.js` (modified, +9/-8)
```diff
@@ -38,11 +38,12 @@ class RedirectHandler {
     this.maxRedirections = maxRedirections
     this.handler = handler
     this.history = []
-    // `cache-control` of each intermediate (suppressed) redirect hop. An outer
-    // cache uses it to preserve a hop's storage policy (e.g. `no-store`) that
-    // would otherwise be lost because the hop's response is not forwarded. It
-    // travels as a non-enumerable property of the history array so it reaches
-    // the cache without becoming part of the public request/response context.
+    // Per-hop metadata for each intermediate (suppressed) redirect hop: the
+    // hop's status code and response headers. An outer cache uses it to honor a
+    // hop's storage policy (e.g. `no-store`, `no-cache`, `Vary: *`) that would
+    // otherwise be lost because the hop's response is not forwarded. It travels
+    // as a non-enumerable property of the history array so it reaches the cache
+    // without becoming part of the public request/response context.
     Object.defineProperty(this.history, kRedirectCacheControl, {
       value: [],
       enumerable: false
@@ -124,9 +125,9 @@ class RedirectHandler {
     }
 
     // This hop's response is suppressed (only its Location is used). Record its
-    // cache-control so an outer cache can honor a restrictive policy that would
-    // otherwise be lost when the final response is stored.
-    this.history[kRedirectCacheControl].push(headers['cache-control'])
+    // status and headers so an outer cache can honor a restrictive policy that
+    // would otherwise be lost when the final response is stored.
+    this.history[kRedirectCacheControl].push({ statusCode, headers })
 
     const baseUrl = requestOrigin
       ? new URL(this.opts.path, requestOrigin)
```

**File**: `test/interceptors/cache-redirect-origin.js` (modified, +278/-1)
```diff
@@ -182,7 +182,9 @@ test('same-origin redirect responses are still cached by the cache interceptor',
   const state = { redirectEnabled: true, targetHits: 0 }
   const server = createServer((req, res) => {
     if (state.redirectEnabled && req.url === '/resource') {
-      res.writeHead(302, { location: '/target' })
+      // 301 is cacheable by default (RFC 9111 §3): a same-origin permanent
+      // redirect can be folded into a cached entry under the original key.
+      res.writeHead(301, { location: '/target' })
       res.end()
       return
     }
@@ -430,3 +432,278 @@ test('cache does not store a cross-origin redirect response for a deduplicated c
     await Promise.all([closeServer(trusted), closeServer(attacker)])
   }
 })
+
+// GHSA-MQG3-3V4R-CM32, primitive 1: a redirect that bounces through an
+// untrusted intermediate origin and lands back on the trusted origin must not
+// be cached under the trusted origin's key. The final response origin matches
+// the original key, but an intermediate hop crossed the trust boundary, so the
+// attacker-controlled intermediate can bounce to any cacheable asset on the
+// trusted origin and poison the original URL.
+test('cache does not store a cross-origin bounce redirect under the original origin key', async () => {
+  const state = {
+    redirectEnabled: true,
+    trustedHits: 0,
+    attackerHits: 0
+  }
+
+  const attacker = createServer((_req, res) => {
+    state.attackerHits++
+    res.writeHead(302, {
+      location: `http://127.0.0.1:${trusted.address().port}/uploads/mallory-controlled.json`
+    })
+    res.end()
+  })
+
+  const trusted = createServer((req, res) => {
+    state.trustedHits++
+    if (state.redirectEnabled && req.url === '/resource') {
+      res.writeHead(302, {
+        location: `http://127.0.0.1:${attacker.address().port}/bounce`
+      })
+      res.end()
+      return
+    }
+    if (req.url === '/uploads/mallory-controlled.json') {
+      res.writeHead(200, {
+        'cache-control': 'public, max-age=86400',
+        'content-type': 'text/plain'
+      })
+      res.end('poisoned-attacker-bytes')
+      return
+    }
+    res.writeHead(200, {
+      'cache-control': 'no-store',
+      'content-type': 'text/plain'
+    })
+    res.end('legitimate-content')
+  })
+
+  await Promise.all([listen(trusted), listen(attacker)])
+  const trustedOrigin = `http://127.0.0.1:${trusted.address().port}`
+
+  const agent = new Agent().compose(
+    interceptors.redirect({ maxRedirections: 3 }),
+    interceptors.cache({
+      store: new cacheStores.MemoryCacheStore(),
+      type: 'shared'
+    })
+  )
+
+  try {
+    const mallory = await agent.request({ origin: trustedOrigin, path: '/resource', method: 'GET' })
+      .then(response => response.body.text())
+    assert.equal(mallory, 'poisoned-attacker-bytes')
+
+    state.redirectEnabled = false
+    const hitsBefore = [state.trustedHits, state.attackerHits]
+    const victim = await agent.request({ origin: trustedOrigin, path: '/resource', method: 'GET' })
+      .then(response => response.body.text())
+
+    // The bounced, attacker-influenced response must not have been stored under
+    // the trusted key, so the later request reaches the trusted origin again.
+    assert.equal(victim, 'legitimate-content')
+    assert.notDeepEqual([state.trustedHits, state.attackerHits], hitsBefore)
+  } finally {
+    await agent.close()
+    await Promise.all([closeServer(trusted), closeServer(attacker)])
+  }
+})
+
+// GHSA-MQG3-3V4R-CM32, primitive 2 & 3: a same-origin hop that carries `Vary: *`
+// (RFC 9111 §4.1) or that must be revalidated before use (`no-cache`/`must-revalidate`)
+// must not be folded into a cacheable final response under the original key. Here an
+// authenticated `/account` redirects to a credential-less public blob and would
+// otherwise leak Alice's response to anonymous callers.
+for (const hopHeaders of [
+  { vary: '*', 'cache-control': 'no-cache, max-age=0, s-maxage=0, must-revalidate' },
+  { vary: '*', 'cache-control': 'public, max-age=3600' },
+  { 'cache-control': 'no-cache, max-age=0, s-maxage=0, must-revalidate' },
+  { 'cache-control': 'private, no-store' }
+]) {
+  test(`cache does not store a redirect response whose hop has restrictive directives (${JSON.stringify(hopHeaders)})`, async () => {
+    const state = { authEnabled: true, objectHits: 0 }
+    const server = createServer((req, res) => {
+      if (req.url === '/account') {
+        if (state.authEnabled && req.headers.authorization === 'Bearer alice') {
+          res.writeHead(302, {
+            ...hopHeaders,
+            location: '/signed-object?token=alice'
+          })
+          res.end()
+          return
+        }
+        res.writeHead(403, { 'cache-control': 'no-store' })
+        res.end('denied')
+        return
+      }
+      if (req.url.startsWith('/signed-object')) {
+        state.objectHits++
+        res.writeHead(200, {
+          'cache-control': 'public, max-age=
```

#### Recent Merged Pull Requests:
- **PR #6170** (2026-11-06): fix(pool): release saturated h2 protocol probes after SETTINGS (@EpicHigh)
- **PR #6166** (2026-11-05): [Release] v7.30.3 (@github-actions[bot])
- **PR #6163** (2026-11-05): [Release] v7.30.2 (@github-actions[bot])
- **PR #6162** (2026-11-05): [Release] v8.12.4 (@github-actions[bot])
- **PR #6157** (2026-11-05): docs: fix typos (@tsctx)
- **PR #6146** (closed): fix(fetch): honor user-provided Sec-Fetch-Mode (fixes #1305) (@61465)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
