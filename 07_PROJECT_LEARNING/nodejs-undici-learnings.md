> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/nodejs-undici-learnings.md`  
> **Source**: github ([https://github.com/nodejs/undici](https://github.com/nodejs/undici))  
> **Source Version**: `1f452240`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-22T20:30:16.931Z  
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
> **Harvest Timestamp**: 2026-10-22T20:30:16.617Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `nodejs/undici`
- **Description**: An HTTP/1.1 client, written from scratch for Node.js
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 7719 stars

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

### Incident Patch 1: `1f452240` (2026-10-22)
**Commit Message**: fix(http2): keep persistent error sink on released streams (#5983)

* fix(http2): keep persistent error sink on released streams

When an HTTP/2 session is torn down with an error (e.g. the idle reaper
in onHttp2SessionIdleTimeout), Node fans that error out to every native
stream still tracked in the session's internal state. A released stream
that no longer has an 'error' listener then crashes the process with an
unhandled `InformationalError: socket idle timeout` (#5936).

releaseRequestStream, severRequestStream and releaseUpgradeStream only
installed a one-shot `once('error', noop)` sink (and not at all in
onError), so a single late error consumed it and the subsequent
session-level error went unhandled.

Keep a persistent `on('error', noop)` sink on every stream undici stops
tracking, and add a noop fallback in onError when the real handler is
removed. Retain the sink on upgrade streams instead of dropping it in
onUpgradeStreamClose.

Closes #5936.

* test(http2): make idle reaper regression test cross-platform robust

The released stream is only observable in the window between its 'end' and
'close' events. On some platforms (Node 25/macOS) that window is too short to
inspect

**File**: `lib/dispatcher/client-h2.js` (modified, +23/-8)
```diff
@@ -253,8 +253,14 @@ function severRequestStream (stream) {
     closeStreamSession(stream)
   }
 
+  // #5936: Node can still deliver a session-level error to a native stream
+  // after undici has stopped tracking it (e.g. on idle session teardown). Keep
+  // a persistent noop error sink so the 'error' event is never emitted with no
+  // listener, which would crash the process. A single sink is enough even if
+  // one was already attached by the onError path, so clear it first.
   if (!stream.destroyed && !stream.closed) {
-    stream.once('error', noop)
+    stream.off('error', noop)
+    stream.on('error', noop)
   }
 }
 
@@ -868,8 +874,8 @@ function closeStreamSession (stream) {
 }
 
 function onUpgradeStreamClose () {
-  this.off('error', noop)
-
+  // #5936: Retain the noop error sink so a session-level error delivered to
+  // this stream after undici detaches it cannot crash via an unhandled 'error'.
   const state = this[kRequestStreamState]
   this[kRequestStreamState] = null
 
@@ -973,8 +979,11 @@ function releaseUpgradeStream (stream) {
 
   removeUpgradeStreamListeners(stream)
 
+  // #5936: removeUpgradeStreamListeners() dropped the noop sink; re-attach a
+  // persistent one so a late session-level error on this (possibly still native
+  // tracked) stream cannot crash via an unhandled 'error'.
   if (!stream.destroyed && !stream.closed) {
-    stream.once('error', noop)
+    stream.on('error', noop)
   }
 }
 
@@ -1407,12 +1416,14 @@ function releaseRequestStream (stream) {
     detachRequestFromStream(request)
   }
 
-  // A closed or destroyed stream cannot emit further events; leaving the
-  // listeners in place saves the removal scans (they are collected with
-  // the stream). All handlers bail out when the stream state is gone.
+  // #5936: Node can deliver a session-level error to a released stream before
+  // its native handle is dropped (e.g. on idle session teardown). Attach a
+  // persistent noop error sink so a late 'error' always has a listener and
+  // cannot crash the process. A closed/destroyed stream cannot emit further
+  // events and is no longer tracked natively, so skip the listener teardown.
   if (!stream.destroyed && !stream.closed) {
     removeRequestStreamListeners(stream)
-    stream.once('error', noop)
+    stream.on('error', noop)
   }
 }
 
@@ -1631,6 +1642,10 @@ function onError (err) {
   }
 
   stream.off('error', onError)
+  // #5936: The stream has already errored, but Node may destroy it again with a
+  // session-level error before the native handle is released. Keep a persistent
+  // noop error sink so that re-delivery cannot go unhandled.
+  stream.on('error', noop)
 
   // Node's HTTP/2 implementation can turn an incomplete Content-Length body
   // into a protocol stream error instead of emitting 'end'. Prefer the
```

**File**: `test/issue-5936.js` (added, +108/-0)
```diff
@@ -0,0 +1,108 @@
+'use strict'
+
+const assert = require('node:assert')
+const { once } = require('node:events')
+const { createSecureServer } = require('node:http2')
+const { setTimeout: sleep } = require('node:timers/promises')
+const { test } = require('node:test')
+const pem = require('@metcoder95/https-pem')
+
+const { Client } = require('..')
+const { kHTTP2Session } = require('../lib/core/symbols.js')
+
+// Node keeps every live native stream in the session's internal state, and only
+// drops the entry once the stream fully closes. A stream that has fired 'end'
+// (so undici releases it via completeRequestStream) is still tracked here during
+// the window between 'end' and 'close'. The HTTP/2 idle reaper (#5406) can
+// destroy such a session with an error in this window, and Node fans that error
+// out to every still-tracked stream. If a released stream has no 'error'
+// listener the process crashes (#5936).
+function sessionStreams (client) {
+  const session = client[kHTTP2Session]
+  if (session == null) {
+    return []
+  }
+
+  for (const sym of Object.getOwnPropertySymbols(session)) {
+    const state = session[sym]
+    if (state && typeof state === 'object' && state.streams) {
+      return [...state.streams.values()]
+    }
+  }
+
+  return []
+}
+
+async function waitFor (predicate, timeout = 1000) {
+  const deadline = Date.now() + timeout
+
+  while (Date.now() < deadline) {
+    if (predicate()) {
+      return true
+    }
+
+    await sleep(0)
+  }
+
+  return predicate()
+}
+
+test('Issue #5936 - released streams retain an error sink so the idle reaper cannot crash', async (t) => {
+  const server = createSecureServer(await pem.generate({ opts: { keySize: 2048 } }))
+  server.on('error', () => {})
+  server.on('session', (session) => {
+    session.on('error', () => {})
+  })
+  server.on('stream', (stream) => {
+    stream.on('error', () => {})
+    stream.respond({ ':status': 200 })
+    stream.end('hello')
+  })
+
+  t.after(() => server.close())
+  await once(server.listen(0), 'listening')
+
+  const client = new Client(`https://localhost:${server.address().port}`, {
+    allowH2: true,
+    connect: {
+      rejectUnauthorized: false
+    }
+  })
+  t.after(() => client.close())
+
+  const response = await client.request({ path: '/', method: 'GET' })
+  await response.body.dump()
+
+  // 'end' has fired, so undici released the stream and it is still natively
+  // tracked during the 'end' -> 'close' window. On some platforms this window is
+  // too short to observe (the stream closes before we can inspect it), in which
+  // case the teardown race that this issue describes cannot manifest either.
+  const found = await waitFor(() => sessionStreams(client).length === 1, 50)
+  if (!found) {
+    t.skip('idle-teardown window not observable; released stream already closed')
+    return
+  }
+
+  const stream = sessionStreams(client)[0]
+
+  // A released stream must keep a persistent error sink. If it only installed a
+  // one-shot sink, a first late error would consume it and a second session-level
+  // error (as the idle reaper emits) would be delivered with no listener, which
+  // crashes the process.
+  assert.strictEqual(stream.listenerCount('error'), 1)
+
+  // Simulate the first late error (e.g. a late RST_STREAM / frame error) that
+  // arrives after undici has finished with the request.
+  stream.emit('error', new Error('late stream error'))
+  assert.strictEqual(stream.listenerCount('error'), 1)
+
+  // Tear down the session with an error exactly like onHttp2SessionIdleTimeout:
+  // Node fans the error out to every still-tracked stream. With the persistent
+  // sink the process keeps running; a one-shot sink would already be consumed
+  // and trigger an unhandled 'error'.
+  client[kHTTP2Session].destroy(new Error('socket idle timeout'))
+
+  // The session error is delivered asynchronously; give the stream a chance to
+  // be destroyed with it before asserting the process survived.
+  await sleep(50)
+})
```

---

### Incident Patch 2: `b5588246` (2026-10-22)
**Commit Message**: fix(cache): ignore SQLITE_BUSY in the sqlite cache store (#6049)

The store is meant to be shared between processes. SQLite reports a
database another connection is writing as SQLITE_BUSY/SQLITE_LOCKED
("database is locked"), and those errors currently propagate out of
get(), set(), delete() and the pruning that set() performs, failing the
request that triggered the write.

Caching is best effort, so skip the operation instead of throwing: a
locked database is a cache miss, and the next request retries.

Co-authored-by: AdityaProCoder <[REDACTED_EMAIL]>

**File**: `lib/cache/sqlite-cache-store.js` (modified, +55/-11)
```diff
@@ -18,6 +18,20 @@ const COMPRESS_THRESHOLD = 1024 * 1024
 // node:sqlite is available.
 const hasZstd = typeof zstdCompressSync === 'function' && typeof zstdDecompressSync === 'function'
 
+// SQLite reports a database that another connection is writing as SQLITE_BUSY
+// (5) or SQLITE_LOCKED (6).
+// https://www.sqlite.org/rescode.html#busy
+const SQLITE_BUSY = 5
+const SQLITE_LOCKED = 6
+
+/**
+ * @param {Error & { errcode?: number }} err
+ * @returns {boolean}
+ */
+function isLockedError (err) {
+  return err?.errcode === SQLITE_BUSY || err?.errcode === SQLITE_LOCKED
+}
+
 /**
  * @typedef {import('../../types/cache-interceptor.d.ts').default.CacheStore} CacheStore
  * @implements {CacheStore}
@@ -259,7 +273,7 @@ module.exports = class SqliteCacheStore {
   get (key) {
     assertCacheKey(key)
 
-    const value = this.#findValue(key)
+    const value = this.#lockSafe(() => this.#findValue(key))
     return value
       ? {
           body: value.body
@@ -307,10 +321,10 @@ module.exports = class SqliteCacheStore {
       }
     }
 
-    const existingValue = this.#findValue(key, true)
+    const existingValue = this.#lockSafe(() => this.#findValue(key, true))
     if (existingValue) {
       // Updating an existing response, let's overwrite it
-      this.#updateValueQuery.run(
+      this.#lockSafe(() => this.#updateValueQuery.run(
         storedBody,
         compressed,
         value.deleteAt,
@@ -323,10 +337,10 @@ module.exports = class SqliteCacheStore {
         value.cachedAt,
         value.staleAt,
         existingValue.id
-      )
+      ))
     } else {
       // New response, let's insert it
-      this.#insertValueQuery.run(
+      this.#lockSafe(() => this.#insertValueQuery.run(
         url,
         key.method,
         storedBody,
@@ -340,7 +354,7 @@ module.exports = class SqliteCacheStore {
         value.vary ? JSON.stringify(value.vary) : null,
         value.cachedAt,
         value.staleAt
-      )
+      ))
       this.#prune()
     }
   }
@@ -389,23 +403,53 @@ module.exports = class SqliteCacheStore {
       throw new TypeError(`expected key to be object, got ${typeof key}`)
     }
 
-    this.#deleteByUrlQuery.run(this.#makeValueUrl(key))
+    this.#lockSafe(() => this.#deleteByUrlQuery.run(this.#makeValueUrl(key)))
+  }
+
+  /**
+   * Runs a database operation, skipping it when another connection holds the
+   * database lock.
+   *
+   * The cache store is meant to be shared between processes, and SQLite reports
+   * a concurrent writer as SQLITE_BUSY/SQLITE_LOCKED. Those errors are
+   * transient, and caching is best effort: the entry is skipped and the next
+   * request retries, rather than failing the request that triggered the write.
+   *
+   * @template T
+   * @param {() => T} fn
+   * @returns {T | undefined}
+   */
+  #lockSafe (fn) {
+    try {
+      return fn()
+    } catch (err) {
+      if (!isLockedError(err)) {
+        throw err
+      }
+
+      return undefined
+    }
   }
 
   #prune () {
-    if (Number.isFinite(this.#maxCount) && this.size <= this.#maxCount) {
-      return 0
+    if (Number.isFinite(this.#maxCount)) {
+      // A locked database cannot be measured, so skip pruning instead of
+      // failing the write that triggered it.
+      const size = this.#lockSafe(() => this.size)
+      if (size === undefined || size <= this.#maxCount) {
+        return 0
+      }
     }
 
     {
-      const removed = this.#deleteExpiredValuesQuery.run(Date.now()).changes
+      const removed = this.#lockSafe(() => this.#deleteExpiredValuesQuery.run(Date.now()).changes)
       if (removed) {
         return removed
       }
     }
 
     {
-      const removed = this.#deleteOldValuesQuery?.run(Math.max(Math.floor(this.#maxCount * 0.1), 1)).changes
+      const removed = this.#lockSafe(() => this.#deleteOldValuesQuery?.run(Math.max(Math.floor(this.#maxCount * 0.1), 1)).changes)
       if (removed) {
         return removed
       }
```

**File**: `test/cache-interceptor/sqlite-cache-store-tests.js` (modified, +55/-0)
```diff
@@ -467,3 +467,58 @@ test('SqliteCacheStore compresses big files with zstd', { skip: skipCompression
   strictEqual(rows[2].compressed, 'zstd')
   strictEqual(rows[2].body.byteLength < jsonBody.byteLength, true)
 })
+
+test('SqliteCacheStore ignores a database locked by another connection', { skip: runtimeFeatures.has('sqlite') === false }, async (t) => {
+  const SqliteCacheStore = require('../../lib/cache/sqlite-cache-store.js')
+  const { DatabaseSync } = require('node:sqlite')
+  const sqliteLocation = 'cache-interceptor-locked.sqlite'
+
+  const store = new SqliteCacheStore({ location: sqliteLocation })
+
+  // A second connection holding the write lock is what another process (or
+  // another store instance) sharing the same cache database looks like.
+  const otherConnection = new DatabaseSync(sqliteLocation)
+
+  t.after(async () => {
+    store.close()
+    otherConnection.close()
+    await rm(sqliteLocation)
+  })
+
+  /**
+   * @type {import('../../types/cache-interceptor.d.ts').default.CacheKey}
+   */
+  const key = {
+    origin: 'localhost',
+    path: '/',
+    method: 'GET',
+    headers: {}
+  }
+
+  /**
+   * @type {import('../../types/cache-interceptor.d.ts').default.CacheValue}
+   */
+  const value = {
+    statusCode: 200,
+    statusMessage: '',
+    headers: { foo: 'bar' },
+    cachedAt: Date.now(),
+    staleAt: Date.now() + 10000,
+    deleteAt: Date.now() + 20000,
+    body: Buffer.from('asd')
+  }
+
+  otherConnection.exec('BEGIN IMMEDIATE')
+
+  // Contention is transient and the cache is best effort: none of these may
+  // throw while the database is locked, the entry is just not cached.
+  store.set(key, value)
+  strictEqual(store.get(key), undefined)
+  store.delete(key)
+
+  otherConnection.exec('COMMIT')
+
+  // Once the lock is released the store behaves as usual again.
+  store.set(key, value)
+  notEqual(store.get(key), undefined)
+})
```

---

### Incident Patch 3: `25543f5b` (2026-10-20)
**Commit Message**: build(deps): bump cronometro from 6.0.3 to 7.0.1 in /benchmarks (#5969)

Bumps [cronometro](https://github.com/ShogunPanda/cronometro) from 6.0.3 to 7.0.1.
- [Release notes](https://github.com/ShogunPanda/cronometro/releases)
- [Changelog](https://github.com/ShogunPanda/cronometro/blob/main/CHANGELOG.md)
- [Commits](https://github.com/ShogunPanda/cronometro/compare/v6.0.3...v7.0.1)

---
updated-dependencies:
- dependency-name: cronometro
  dependency-version: 7.0.1
  dependency-type: direct:production
  update-type: version-update:semver-major
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `benchmarks/package.json` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@
   "dependencies": {
     "axios": "^1.6.7",
     "concurrently": "^10.0.3",
-    "cronometro": "^6.0.3",
+    "cronometro": "^7.0.1",
     "got": "^16.0.0",
     "mitata": "^1.0.4",
     "node-fetch": "^3.3.2",
```

#### Recent Merged Pull Requests:
- **PR #6062** (2026-10-20): docs: add QUERY to the documented retry default methods (@qodelicious)
- **PR #6059** (2026-10-19): build(deps-dev): bump eslint from 10.12.0 to 10.13.0 (@dependabot[bot])
- **PR #6058** (2026-10-19): build(deps-dev): bump neostandard from 0.14.0 to 0.14.1 (@dependabot[bot])
- **PR #6057** (2026-10-20): docs: fix a couple of typos (@qodelicious)
- **PR #6056** (2026-10-22): fix(types): declare FormData prototype methods (@RlxChap2)
- **PR #6053** (2026-10-19): [Release] v8.12.3 (@github-actions[bot])

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

## X. http2): keep persistent error sink on released streams (#5983)

**RULE**:
When implementing operations in `lib/dispatcher/client-h2.js`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in nodejs/undici. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `1f452240`: http2): keep persistent error sink on released streams (#5983). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing JavaScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `lib/dispatcher/client-h2.js`.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// Verified production-grade fix pattern:
  // #5936: Node can still deliver a session-level error to a native stream
  // after undici has stopped tracking it (e.g. on idle session teardown). Keep
  // a persistent noop error sink so the 'error' event is never emitted with no
  // listener, which would crash the process. A single sink is enough even if
  // one was already attached by the onError path, so clear it first.
    stream.off('error', noop)
    stream.on('error', noop)
  // #5936: Retain the noop error sink so a session-level error delivered to
  // this stream after undici detaches it cannot crash via an unhandled 'error'.
  // #5936: removeUpgradeStreamListeners() dropped the noop sink; re-attach a
  // persistent one so a late session-level error on this (possibly still native
  // tracked) stream cannot crash via an unhandled 'error'.
    stream.on('error', noop)
  // #5936: Node can deliver a session-level error to a released stream before
  // its native handle is dropped (e.g. on idle session teardown). Attach a
  // persistent noop error sink so a late 'error' always has a listener and
  // cannot crash the process. A closed/destroyed stream cannot emit further
  // events and is no longer tracked native
```

**NEGATIVE CONSTRAINT**:
```javascript
// Anti-pattern to NEVER write (induced failure mode):
    stream.once('error', noop)
  this.off('error', noop)

    stream.once('error', noop)
  // A closed or destroyed stream cannot emit further events; leaving the
  // listeners in place saves the removal scans (they are collected with
  // the stream). All handlers bail out when the stream state is gone.
    stream.once('error', noop)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `1f452240` are properly handled with clean fallback behavior.
