# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: nodejs-undici-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "nodejs-undici-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-16T22:34:20.378Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-nodejs-undici-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [nodejs-undici-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-16T22:34:20.378Z`  
> **Learning ID**: `LEARN-EVO-nodejs-undici-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: G (Architecture Intelligence), K (Quality & Verification Intelligence), M (Feedback & Evolution Intelligence), D (Research & Knowledge Intelligence), I (Content & Information Intelligence), J (Search & Distribution Intelligence), B (Product Intelligence)
- **Confidence Rating**: 78%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from nodejs-undici-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/nodejs-undici-learnings.md`  
> **Source**: github ([https://github.com/nodejs/undici](https://github.com/nodejs/undici))  
> **Source Version**: `02c4f8c6`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-16T22:34:12.919Z  
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
> **Harvest Timestamp**: 2026-11-16T22:34:12.640Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `nodejs/undici`
- **Description**: An HTTP/1.1 client, written from scratch for Node.js
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 7740 stars

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

### Incident Patch 1: `02c4f8c6` (2026-11-13)
**Commit Message**: fix(h1): do not reuse idle sockets whose keep-alive timeout expired (#6171)

The keep-alive timer of an idle socket cannot fire while the event loop
is blocked. When the next request is dispatched from the poll phase (an
I/O callback, a server request handler, or a continuation after awaiting
I/O), the idle socket validation added for GHSA-35p6-xmwp-9g52 completes
in the check phase of the same loop iteration, before that timer fires
and before a FIN received during the block is read. The request is then
written to a socket that the server may already have closed, and fails
with ECONNRESET.

Record when the keep-alive timer is armed, and destroy the socket with
an InformationalError instead of reusing it once its keep-alive timeout
has passed. Nothing is running on the socket, so the pending requests
are sent on a new connection.

The check does not depend on kSocketUsed, so it also covers the
experimental Milo parser, which never sets that symbol.

Refs: https://github.com/nodejs/node/pull/67292


Claude-Session: https://claude.ai/code/session_01Sfj4nEWQ4ovycNDjbvXcRs

Signed-off-by: Matteo Collina <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `lib/dispatcher/client-h1.js` (modified, +24/-0)
```diff
@@ -67,6 +67,7 @@ const removeAllListeners = util.removeAllListeners
 const kIdleSocketValidation = Symbol('kIdleSocketValidation')
 const kIdleSocketValidationTimeout = Symbol('kIdleSocketValidationTimeout')
 const kSocketUsed = Symbol('kSocketUsed')
+const kIdleSince = Symbol('kIdleSince')
 const kTypeOfService = Symbol('kTypeOfService')
 
 let extractBody
@@ -1107,6 +1108,19 @@ function scheduleIdleSocketValidation (client, socket) {
   })
 }
 
+/**
+ * kIdleSince is recorded when the keep-alive timer is armed, so this never
+ * expires a socket before that timer is due.
+ * @param {import('net').Socket} socket
+ * @returns {boolean}
+ */
+function isIdleSocketExpired (socket) {
+  const parser = socket[kParser]
+  return parser.timeoutType === TIMEOUT_KEEP_ALIVE &&
+    parser.timeoutValue > 0 &&
+    performance.now() - socket[kIdleSince] >= parser.timeoutValue
+}
+
 /**
  * @param {import('./client.js')} client
  */
@@ -1124,6 +1138,15 @@ function resumeH1 (client) {
       socket[kNoRef] = false
     }
 
+    // The keep-alive timer cannot fire while the event loop is blocked, and a
+    // request dispatched from the poll phase passes the idle socket validation
+    // below before that timer or a FIN received during the block is processed.
+    // Check the clock so that an expired socket is not reused.
+    if (client[kRunning] === 0 && client[kPending] > 0 && isIdleSocketExpired(socket)) {
+      util.destroy(socket, new InformationalError('socket idle timeout'))
+      return
+    }
+
     if (client[kRunning] === 0 && client[kPending] > 0 && socket[kSocketUsed]) {
       if (socket[kIdleSocketValidation] === 0) {
         scheduleIdleSocketValidation(client, socket)
@@ -1152,6 +1175,7 @@ function resumeH1 (client) {
 
     if (client[kSize] === 0) {
       if (socket[kParser].timeoutType !== TIMEOUT_KEEP_ALIVE) {
+        socket[kIdleSince] = performance.now()
         socket[kParser].setTimeout(client[kKeepAliveTimeoutValue], TIMEOUT_KEEP_ALIVE)
       }
     } else if (client[kRunning] > 0 && socket[kParser].statusCode < 200) {
```

**File**: `test/client-keep-alive-blocked-loop.js` (added, +90/-0)
```diff
@@ -0,0 +1,90 @@
+'use strict'
+
+const { test } = require('node:test')
+const assert = require('node:assert')
+const { once } = require('node:events')
+const { stat } = require('node:fs')
+const { createServer } = require('node:http')
+const { setImmediate: waitImmediate } = require('node:timers/promises')
+const { Client } = require('..')
+
+// The keep-alive timer cannot fire while the event loop is blocked. When the
+// next request is dispatched from the poll phase, the idle socket validation
+// completes in the check phase of the same iteration, before that timer or a
+// FIN that arrived during the block is processed. The client must check the
+// clock instead, or it reuses a socket that the server may already have
+// closed (ECONNRESET).
+
+function sleepSync (ms) {
+  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
+}
+
+async function setup (t, keepAliveTimeout) {
+  const state = { connections: 0, disconnects: [] }
+
+  const server = createServer((req, res) => {
+    res.end('ok')
+  })
+  // No Keep-Alive hint from the server, so the client's keepAliveTimeout
+  // alone sets the idle timeout. The server never closes the connection
+  // itself, so the test only passes if the client opens a new one.
+  server.keepAliveTimeout = 0
+  server.on('connection', () => {
+    state.connections++
+  })
+  server.listen(0)
+  await once(server, 'listening')
+
+  const client = new Client(`http://localhost:${server.address().port}`, {
+    keepAliveTimeout
+  })
+  client.on('disconnect', (origin, targets, err) => {
+    state.disconnects.push(err)
+  })
+
+  t.after(async () => {
+    await client.close()
+    server.close()
+  })
+
+  const res = await client.request({ path: '/', method: 'GET' })
+  assert.strictEqual(await res.body.text(), 'ok')
+  // Let the socket settle into the idle state.
+  await waitImmediate()
+  assert.strictEqual(state.connections, 1)
+
+  return { client, state }
+}
+
+// Blocks for `blockMs`, then dispatches a request, from an fs callback, i.e.
+// from the poll phase.
+function requestAfterBlockInPollPhase (client, blockMs) {
+  return new Promise((resolve, reject) => {
+    stat(__filename, () => {
+      sleepSync(blockMs)
+      client.request({ path: '/', method: 'GET' }).then(resolve, reject)
+    })
+  })
+}
+
+test('does not reuse an idle socket whose keep-alive timeout passed while the event loop was blocked', async (t) => {
+  const { client, state } = await setup(t, 200)
+
+  const res = await requestAfterBlockInPollPhase(client, 600)
+  assert.strictEqual(await res.body.text(), 'ok')
+
+  assert.strictEqual(state.connections, 2)
+  assert.strictEqual(state.disconnects.length, 1)
+  assert.strictEqual(state.disconnects[0].code, 'UND_ERR_INFO')
+  assert.strictEqual(state.disconnects[0].message, 'socket idle timeout')
+})
+
+test('reuses an idle socket whose keep-alive timeout did not pass while the event loop was blocked', async (t) => {
+  const { client, state } = await setup(t, 60e3)
+
+  const res = await requestAfterBlockInPollPhase(client, 600)
+  assert.strictEqual(await res.body.text(), 'ok')
+
+  assert.strictEqual(state.connections, 1)
+  assert.strictEqual(state.disconnects.length, 0)
+})
```

---

### Incident Patch 2: `2ded4054` (2026-11-12)
**Commit Message**: test: avoid setTimeout in broken gzip body regression test (#6002)

The regression test for #5999 used a wall-clock setTimeout to make the
invalid gzip body arrive in a later packet than the response headers.
Wall-clock timers are flaky and add a fixed delay to every run.

Instead, defer the body to a later event-loop tick with setImmediate.
This deterministically splits the headers and body into separate packets
without any wall-clock dependency, and the test still hangs on the
pre-fix code while rejecting fast on the current one.

Refs: https://github.com/nodejs/undici/issues/5999

**File**: `test/fetch/encoding.js` (modified, +33/-0)
```diff
@@ -249,3 +249,36 @@ describe('default accept-encoding request header', () => {
     await response.arrayBuffer()
   })
 })
+
+// https://github.com/nodejs/undici/issues/5999
+test('invalid compressed body received after the headers rejects instead of hanging', async (t) => {
+  const server = createServer((req, res) => {
+    res.writeHead(200, {
+      'Content-Encoding': 'gzip',
+      'Content-Length': '16'
+    })
+    res.flushHeaders()
+
+    // The body must arrive in a later packet than the headers for the
+    // regression to manifest. Defer it to a later tick rather than using
+    // a wall-clock setTimeout, which is flaky and adds a fixed delay.
+    setImmediate(() => setImmediate(() => {
+      res.end(Buffer.alloc(16))
+    }))
+  }).listen(0, '127.0.0.1')
+
+  t.after(() => {
+    server.closeAllConnections()
+    server.close()
+  })
+
+  await once(server, 'listening')
+
+  const response = await fetch(`http://127.0.0.1:${server.address().port}`, { keepalive: false })
+
+  await t.assert.rejects(response.text(), (err) => {
+    t.assert.strictEqual(err.name, 'TypeError')
+    t.assert.strictEqual(err.cause?.code, 'Z_DATA_ERROR')
+    return true
+  })
+})
```

---

### Incident Patch 3: `af829065` (2026-11-12)
**Commit Message**: docs: align security policy with Node.js (#5987)

**File**: `SECURITY.md` (modified, +76/-32)
```diff
@@ -36,6 +36,29 @@ issue.
 
 Undici is an HTTP client library for Node.js. Its threat model is derived from
 and aligned with the [Node.js threat model](https://github.com/nodejs/node/blob/HEAD/SECURITY.md#the-nodejs-threat-model).
+The Node.js policy is authoritative for the copy of undici bundled with
+Node.js. This section applies the same boundaries to the standalone undici
+package.
+
+### Security triage dispositions
+
+Security reports are classified using the same dispositions as Node.js:
+
+* **Vulnerability**: An undici defect that is exploitable across an
+  undici-owned security boundary and meets the criteria under
+  [What constitutes a vulnerability](#what-constitutes-a-vulnerability),
+  including any applicable DoS criteria.
+* **Security-interest bug**: A real undici defect, or an API behavior likely to
+  cause security bugs in applications, that is not itself a vulnerability
+  under this threat model. These are fixed as regular bugs and do not
+  automatically receive a CVE, but should still be reported privately first
+  when they affect a common security control such as protocol interpretation,
+  certificate validation, or TLS decisions.
+* **Common bug**: A correctness, robustness, or crash issue without an
+  undici-owned security boundary or a realistic cross-boundary attacker
+  benefit.
+* **Invalid / out of scope**: A report that cannot be reproduced, is not an
+  undici defect, or concerns behavior excluded by this policy.
 
 ### What constitutes a vulnerability
 
@@ -53,35 +76,49 @@ For a behavior to be considered a DoS vulnerability, the proof of concept must
 meet the following criteria:
 
 * The API is being correctly used.
-* The API is public and documented.
-* The behavior is significant enough to cause a denial of service quickly
-  or in a context not controlled by the application developer (for example,
-  HTTP parsing).
+* The API does not have a warning against its use in production.
+* The API is public and documented. For standards-based APIs, the behavior
+  must be well-defined by the applicable specification.
+* The API is stable. For APIs bundled in Node.js, it must have stable (2.0)
+  status.
+* The behavior is significant enough to cause a denial of service quickly or
+  in a context not controlled by the application developer, such as protocol
+  parsing.
 * The behavior is directly exploitable by an untrusted source without requiring
   application mistakes.
 * The behavior cannot be reasonably mitigated through standard operational
-  practices (like process recycling).
+  practices, such as process recycling.
+* The behavior occurs deterministically under normal usage patterns rather than
+  only in edge cases.
+* The behavior occurs at a rate that would cause practical resource exhaustion
+  within a practical timeframe under typical workloads.
 * The attack demonstrates
   [asymmetric resource consumption](https://cwe.mitre.org/data/definitions/405.html),
-  where the attacker expends significantly fewer resources than what is required
-  by the client to process the attack.
+  where the attacker expends significantly fewer resources than the client
+  must expend to process the attack. Attacks requiring comparable resources on
+  the attacker's side, which can be mitigated through practices such as rate
+  limiting, may not qualify.
 
 **Undici does NOT trust**:
 
-* Data received from the remote end of HTTP connections (both inbound responses
-  and server-sent data) that is parsed or transformed by undici before being
-  passed to the application. This includes:
+* Data received from the remote end of outbound network connections created
+  through undici APIs and transformed or validated by undici before being
+  passed to the application, **except with respect to payload length**. Undici
+  trusts applications to make connections and requests that avoid payload
+  sizes that would result in a denial of service. Subject to that exception,
+  untrusted data includes:
   * HTTP response headers and status lines.
-  * HTTP response bodies when processed by undici (e.g., chunked transfer
-    decoding, content-encoding).
+  * HTTP response bodies processed by undici, such as chunked transfer decoding
+    and content-encoding.
   * WebSocket frames received from a server.
   * Server-Sent Events (EventSource) data received from a server.
 * TLS certificate validation performed by undici on behalf of the application.
 
 **Undici trusts**:
 
 * The application code that uses its APIs, including all configuration,
-  options, callbacks, and decisions about which body-consuming APIs to call.
+  options, callbacks, connection and request decisions, and decisions about
+  which body-consuming APIs to call.
 * The operating system and its network stack.
 * The Node.js runtime undici is running on.
 * Dependencies installed by the application.
@@ -99,19 +136,19 @@ meet the following criteria:
   bypass organizational, regulatory, or legal controls. Untrusted
```

#### Recent Merged Pull Requests:
- **PR #6199** (2026-11-12): docs: note that SqliteCacheStore stores data unencrypted (@bardrop)
- **PR #6198** (closed): fix: settle fetch() promise when mainFetch throws internally (@mcollina)
- **PR #6190** (2026-11-10): build(deps-dev): bump node-forge from 1.4.2 to 1.4.3 (@dependabot[bot])
- **PR #6189** (2026-11-10): build(deps-dev): bump ws from 8.22.0 to 8.22.1 (@dependabot[bot])
- **PR #6188** (2026-11-09): build(deps-dev): bump @fastify/busboy from 3.2.4 to 3.2.5 (@dependabot[bot])
- **PR #6176** (2026-11-07): fix(h2): preserve transport errors and mismatch causes (@styfle)

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

## X. h1): do not reuse idle sockets whose keep-alive timeout expired

**RULE**:
When implementing operations in `lib/dispatcher/client-h1.js`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in nodejs/undici. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `02c4f8c6`: h1): do not reuse idle sockets whose keep-alive timeout expired. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing JavaScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `lib/dispatcher/client-h1.js`.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// Verified production-grade fix pattern:
const kIdleSince = Symbol('kIdleSince')
/**
 * kIdleSince is recorded when the keep-alive timer is armed, so this never
 * expires a socket before that timer is due.
 * @param {import('net').Socket} socket
 * @returns {boolean}
 */
function isIdleSocketExpired (socket) {
  const parser = socket[kParser]
  return parser.timeoutType === TIMEOUT_KEEP_ALIVE &&
    parser.timeoutValue > 0 &&
    performance.now() - socket[kIdleSince] >= parser.timeoutValue
}

    // The keep-alive timer cannot fire while the event loop is blocked, and a
    // request dispatched from the poll phase passes the idle socket validation
    // below before that timer or a FIN received during the block is processed.
    // Check the clock so that an expired socket is not reused.
    if (client[kRunning] === 0 && client[kPending] > 0 && isIdleSocketExpired(socket)) {
      util.destroy(socket, new InformationalError('socket idle timeout'))
      return
    }

        socket[kIdleSince] = performance.now()
```

**NEGATIVE CONSTRAINT**:
```javascript
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `02c4f8c6` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
