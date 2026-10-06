# Forensic Learning Record (Deep Inspection): aipoch/open-science

> **Canonical Artifact**: `07_PROJECT_LEARNING/aipoch-open-science-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/aipoch/open-science](https://github.com/aipoch/open-science))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:46:33.928Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `aipoch/open-science`
- **Description**: The open-source AI research workbench for scientific research and agent workflows. Local-first, model-agnostic desktop app with extensible skills, MCP tools and connectors, Python/R execution and traceable artifacts for reproducible research on macOS, Windows and Linux.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 5422 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `e2e/fixtures/renderer-failure-gate.ts`
```
import type { ConsoleMessage, Page } from 'playwright'

type ObservablePage = Pick<Page, 'consoleMessages' | 'on' | 'pageErrors'>

class RendererFailureGate {
  private readonly failures = new Map<string, Error>()
  private readonly allowedConsoleErrors = new Set<string>()

  allowConsoleError(text: string): void {
    this.allowedConsoleErrors.add(text)
    this.failures.delete(`console:${text}`)
  }

  async observe(page: ObservablePage): Promise<void> {
    const recordConsole = (message: ConsoleMessage): void => {
      if (message.type() !== 'error') return
      const text = message.text()
      if (this.allowedConsoleErrors.has(text)) return
      const { url, lineNumber, columnNumber } = message.location()
      const location = url ? ` (${url}:${lineNumber + 1}:${columnNumber + 1})` : ''
      this.failures.set(`console:${text}`, new Error(`[renderer console] ${text}${location}`))
    }
    const recordPageError = (error: Error): void => {
      this.failures.set(
        `pageerror:${error.message}`,
        new Error(`[renderer pageerror] ${error.message}`, { cause: error })
      )
    }

    // Attach live listeners first, then backfill Playwright's bounded history so errors emitted while
    // the initial Electron window was navigating cannot escape the gate.
    page.on('console', recordConsole)
    page.on('pageerror', recordPageError)
    const [consoleMessages, pageErrors] = await Promise.all([
      page.consoleMessages(),
      page.pageErrors()
    ])
    consoleMessages.forEach(recordConsole)
    pageErrors.forEach(recordPageError)
  }

  assertNoFailures(): void {
    if (this.failures.size === 0) return
    throw new AggregateError(this.failures.values(), 'Renderer emitted errors during Electron E2E.')
  }
}

export { RendererFailureGate }

```

### Core Architecture Module: `resources/notebook/file_evidence_worker.js`
```
'use strict'

const { createHash, randomUUID } = require('node:crypto')
const {
  closeSync,
  constants,
  existsSync,
  fstatSync,
  fsyncSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readSync,
  renameSync,
  rmdirSync,
  rmSync,
  statSync,
  statfsSync,
  writeSync
} = require('node:fs')
const { join } = require('node:path')

const MAX_REQUEST_BYTES = 64 * 1024 * 1024
const MAX_INTERNAL_JSON_BYTES = 64 * 1024 * 1024
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u
const ACTIVITY_KINDS = new Set(['notebook-run', 'compute-job'])
const REGISTERED_INPUT_SOURCE_KINDS = new Set(['upload-version', 'artifact-version'])
const RECEIPT_NAME = /^receipt-[A-Za-z0-9][A-Za-z0-9._-]*\.json$/u
const CAPTURE_FILE = 'capture.json'
const ACTIVITY_BLOBS_DIRECTORY = 'blobs'
const ownershipFile = (token) => `.ownership-${assertSafeName(token)}`
const projectOwnershipReceipt = (projectName) =>
  `.project-ownership-${assertSafeName(projectName)}.json`
const projectDeletionTombstone = (ownershipToken) => `deleting-${assertSafeName(ownershipToken)}`
const runDeletionTombstonePrefix = (ownershipToken, kind, legacyNotebook = false) =>
  `${legacyNotebook ? 'deleting-run' : 'deleting-activity'}-${assertSafeName(ownershipToken)}-${kind}`
const UUID_NAME = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u
const BLOB_NAME = /^sha256-[a-f0-9]{64}$/u
const BLOB_DELETION_TOMBSTONE_NAME =
  /^deleting-(sha256-[a-f0-9]{64})-([a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})$/u
const BASELINE_REASONS = [
  'file-reads-not-observed',
  'external-paths-not-observed',
  'remote-outputs-not-observed',
  'transient-files-not-captured',
  'delayed-writes-not-observed',
  'writer-not-isolated'
]

const fail = (message) => {
  process.stdout.write(`${JSON.stringify({ ok: false, error: message })}\n`)
  process.exitCode = 1
}

const identity = (value) => ({ dev: Number(value.dev), ino: Number(value.ino) })
const validIdentity = (value) => value && Number.isFinite(value.dev) && Number.isFinite(value.ino)
const sameIdentity = (left, right) =>
  validIdentity(left) && validIdentity(right) && left.dev === right.dev && left.ino === right.ino
const fingerprint = (value) =>
  [value.dev, value.ino, value.size, value.mtimeMs, value.ctimeMs].join(':')
const quarantineFingerprint = (value) => [value.dev, value.ino, value.size, value.mtimeMs].join(':')
const evidenceReasons = (request, values) => {
  const baseline = BASELINE_REASONS.filter((reason) => {
    if (reason === 'file-reads-not-observed') return request.fileReads !== 'complete'
    if (reason === 'external-paths-not-observed') return request.externalPaths !== 'complete'
    return request.writerAttribution !== 'complete'
  })
  return [...new Set([...baseline, ...values])].sort()
}
const assertSafeName = (value) => {
  if (!SAFE_NAME.test(value)) throw new Error(`Unsafe file-evidence name: ${value}`)
  return value
}
const assertActivityKind = (value) => {
  if (!ACTIVITY_KINDS.has(value)) throw new Error(`Unsafe file-evidence activity kind: ${value}`)
  return value
}
const assertRegisteredInput = (value) => {
  if (
    !value ||
    typeof value !== 'object' ||
    Object.keys(value).length !== 3 ||
    Object.keys(value).some(
      (field) => !['sourceKind', 'inputFileVersionId', 'checksum'].includes(field)
    ) ||
    !REGISTERED_INPUT_SOURCE_KINDS.has(value.sourceKind) ||
    typeof value.inputFileVersionId !== 'string' ||
    value.inputFileVersionId.length === 0 ||
    value.inputFileVersionId.length > 512 ||
    typeof value.checksum !== 'string' ||
    !/^[a-f0-9]{64}$/u.test(value.checksum)
  ) {
    throw new Error('Invalid registered input identity in file evidence.')
  }
  return value
}
const assertReceiptName = (value) => {
  if (!RECEIPT_NAME.test(value)) throw new Error(`Unsafe file-evidence receipt name: ${value}`)
  return value
}
const assertStorageKeyPrefix = (value) => {
  if (
    typeof value !== 'string' ||
    value.includes('\\') ||
    value.startsWith('/') ||
    value
      .split('/')
      .some((segment) => !SAFE_NAME.test(segment) || segment === '.' || segment === '..')
  ) {
    throw new Error('Unsafe file-evidence storage-key prefix.')
  }
  return value
}
const syncDirectoryPath = (path) => {
  try {
    const descriptor = openSync(path, constants.O_RDONLY)
    try {
      fsyncSync(descriptor)
    } finally {
      closeSync(descriptor)
    }
  } catch (error) {
    if (process.platform !== 'win32') throw error
  }
}
const syncDirectory = () => syncDirectoryPath('.')
const assertBoundRoot = (expected) => {
  const current = statSync('.')
  if (!current.isDirectory() || !sameIdentity(identity(current), expected)) {
    throw new Error('File-evidence worker is not bound to the expected directory.')
  }
}
const readRegularFile = (name, maxBytes) => {
  const descriptor = openSync(
    name,
    constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW
  )
  try {
    const metadata = fstatSync(descriptor)
    if (!metadata.isFile() || metadata.size > maxBytes) {
      throw new Error(`Invalid file-evidence file: ${name}`)
    }
    const result = Buffer.alloc(metadata.size)
    let position = 0
    while (position < result.length) {
      const bytesRead = readSync(descriptor, result, position, result.length - position, position)
      if (bytesRead === 0) break
      position += bytesRead
    }
    if (position !== result.length) throw new Error(`Truncated file-evidence file: ${name}`)
    return result
  } finally {
    closeSync(descriptor)
  }
}
const readJson = (name, maxBytes = MAX_INTERNAL_JSON_BYTES) =>
  JSON.parse(readRegularFile(name, maxBytes).toString('utf8'))
const writeExclusiveFile = (name, contents) => {
  // Windows FlushFileBuffers requires a writable handle. Reopening the exclusive file with
  // O_RDONLY makes fsync fail with EPERM even when the file itself is writable — the same
  // contract as src/main/storage/file-durability.ts.
  const descriptor = openSync(
    name,
    constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW,
    0o600
  )
  try {
    const bytes = Buffer.from(contents, 'utf8')
    let offset = 0
    while (offset < bytes.length) {
      const written = writeSync(descriptor, bytes, offset, bytes.length - offset)
      if (written <= 0) throw new Error('Exclusive file-evidence write made no progress.')
      offset += written
    }
    fsyncSync(descriptor)
  } finally {
    closeSync(descriptor)
  }
}
const publishExclusiveFile = (name, contents) => {
  const temporaryName = `.publish-${randomUUID()}.tmp`
  try {
    writeExclusiveFile(temporaryName, contents)
    linkSync(temporaryName, name)
    rmSync(temporaryName, { force: true })
    syncDirectory()
  } finally {
    rmSync(temporaryName, { force: true })
  }
}
const replaceJson = (name, value) => {
  const temporaryName = `.receipt-${randomUUID()}.tmp`
  writeExclusiveFile(temporaryName, `${JSON.stringify(value, null, 2)}\n`)
  replaceReceipt(temporaryName, name)
  syncDirectory()
}
// A Windows reader without FILE_SHARE_DELETE can transiently deny replacement even after
// our own handles have closed. Keep the old receipt visible until the same durable temporary
// file can be renamed atomically. Waiting is confined to this disposable worker process.
const RECEIPT_REPLACEMENT_DELAYS_MS = [25, 50, 100, 200, 400, 800]
const replacementSnapshot = (name) => {
  try {
    const metadata = lstatSync(name)
    // Identity alone misses in-place writes while a reader blocks the rename.
    return metadata.isFile() ? fingerprint(metadata) : 'unsafe'
  } catch (error) {
    if (error.code === 'ENOENT') return 'absent'
    throw error
  }
}
const replaceReceipt = (temporaryName, name) => {
  if (process.platform !== 'win32') {
    renameSync(temporaryName, name)
    return
  }
  const source = replacementSnapshot(temporaryName)
  const destination = replacementSnapshot(name)
  for (let attempt = 0; ; attempt += 1) {
    try {
      renameSync(temporaryName, name)
      return
    } catch (error) {
      const delay = RECEIPT_REPLACEMENT_DELAYS_MS[attempt]
      if (
        delay === undefined ||
        !['EPERM', 'EACCES', 'EBUSY'].includes(error.code) ||
        source === 'absent' ||
        source === 'unsafe' ||
        destination === 'unsafe'
      ) {
        // Preserve both the previous receipt and the durable unpublished temporary file on
        // failure, as before. Never delete the destination or weaken its permissions.
        throw error
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delay)
      if (
        replacementSnapshot(temporaryName) !== source ||
        replacementSnapshot(name) !== destination
      ) {
        throw new Error('File-evidence receipt changed during atomic replacement.')
      }
    }
  }
}
const RECEIPT_REQUIRED_FIELDS = [
  'schemaVersion',
  'phase',
  'receiptName',
  'stagingName',
  'finalName',
  'activityId',
  'activityKind',
  'evidenceId',
  'storageKeyPrefix',
  'ownershipToken'
]
const receiptFields = (...phaseFields) =>
  new Set([...RECEIPT_REQUIRED_FIELDS, 'parentActivityId', ...phaseFields])
const RECEIPT_FIELDS_BY_PHASE = new Map([
  ['prepared', receiptFields()],
  ['allocated', receiptFields('stagingIdentity')],
  ['capturing', receiptFields('stagingIdentity', 'captureChecksum')],
  ['published', receiptFields('stagingIdentity', 'captureChecksum', 'finalIdentity')]
])
const receiptShape = (value) => {
  const expectedFields =
    value && typeof value === 'object' ? RECEIPT_FIELDS_BY_PHASE.get(value.phase) : undefined
  if (
    !expectedFields ||
    value.schemaVersion !== 1 ||
    RECEIPT_REQUIRED_FIELDS.some((field) => !Object.hasOwn(value, field)) ||
    Object.keys(value).some((field) => !expectedFields.has(field))
  ) {
    return false
  }
  if (
    typeof value.activityId !== 'string' ||
    !ACTIVITY_KINDS.has(value.activityKind) ||
    (value.parentActivityId 
```

### Core Architecture Module: `resources/notebook/python_loop.py`
```
# Persistent Python exec-loop kernel: one process per environment, reads one JSON request per line,
# runs it against a persistent namespace, and returns one JSON response per line. Not Jupyter.
# Node -> loop:  { "req_id", "code" }
# loop -> Node:  { "req_id", "stdout", "stderr", "error", "result", "cwd", "figures":[{"mime","path"}] }
import ast
import hashlib
import io
import json
import os
import reprlib
import sys
import traceback
import types
import math
import random as _stdlib_random

# Bind native RNG APIs before user code. NumPy is optional; initializing its
# global RNG once at kernel startup also captures unseeded first-cell draws.
# No user objects, Generator instances or data files are traversed.
_standard_getstate = _stdlib_random.getstate
_standard_setstate = _stdlib_random.setstate
_finite_number = math.isfinite
_standard_rng_api = dict(vars(_stdlib_random))
try:
    import numpy as _numpy
    import numpy.random as _numpy_random
    _numpy_getstate = _numpy_random.get_state
    _numpy_setstate = _numpy_random.set_state
    _numpy_asarray = _numpy.asarray
    _numpy_array_type = _numpy.ndarray
    _numpy_rng_api = dict(vars(_numpy_random))
except Exception:
    _numpy = _numpy_random = None
    _numpy_rng_api = {}


def _rng_api_unchanged():
    for name, module, baseline in (("random", _stdlib_random, _standard_rng_api),
                                   ("numpy.random", _numpy_random, _numpy_rng_api)):
        if module is None:
            if name in sys.modules:
                return False
            continue
        if sys.modules.get(name) is not module:
            return False
        current = vars(module)
        if any(current.get(key) is not value for key, value in baseline.items()
               if not key.startswith("__")):
            return False
    return True


def _validate_python_random_state(value):
    def gaussian(x, nullable=False):
        return (nullable and x is None) or (type(x) in (int, float) and _finite_number(x))

    def words(x, count):
        return type(x) is list and len(x) == count and all(
            type(word) is int and 0 <= word <= 4294967295 for word in x)

    if type(value) is not dict or value.get("state") != "available" or set(value) - {"state", "standard", "numpy"}:
        raise ValueError("Captured Python random state is unavailable or invalid")
    standard = value.get("standard")
    if (type(standard) is not dict or set(standard) != {"words", "gaussian"}
            or not words(standard["words"], 625) or standard["words"][-1] > 624
            or not gaussian(standard["gaussian"], True)):
        raise ValueError("Invalid standard-library random state")
    numpy_state = value.get("numpy")
    if "numpy" in value and (
            type(numpy_state) is not dict or set(numpy_state) != {"words", "position", "hasGaussian", "gaussian"}
            or not words(numpy_state["words"], 624)
            or type(numpy_state["position"]) is not int or not 0 <= numpy_state["position"] <= 624
            or type(numpy_state["hasGaussian"]) is not int or numpy_state["hasGaussian"] not in (0, 1)
            or not gaussian(numpy_state["gaussian"])):
        raise ValueError("Invalid NumPy random state")
    return standard, numpy_state


def _capture_python_random_state():
    try:
        if not _rng_api_unchanged():
            return {"state": "unavailable", "reason": "modified-rng"}
        version, words, gaussian = _standard_getstate()
        if version != 3:
            return {"state": "unavailable", "reason": "invalid-state"}
        value = {"state": "available", "standard": {"words": list(words), "gaussian": gaussian}}
        if _numpy_random is not None:
            name, words, position, has_gaussian, gaussian = _numpy_getstate()
            if name != "MT19937" or type(words) is not _numpy_array_type or words.shape != (624,):
                return {"state": "unavailable", "reason": "invalid-state"}
            value["numpy"] = {"words": words.tolist(), "position": position,
                              "hasGaussian": has_gaussian, "gaussian": gaussian}
        _validate_python_random_state(value)
        return value
    except Exception:
        return {"state": "unavailable", "reason": "capture-failed"}


def _restore_python_random_state(value):
    standard, numpy_state = _validate_python_random_state(value)
    if not _rng_api_unchanged():
        raise ValueError("Cannot restore modified Python RNG APIs")
    if numpy_state is not None and _numpy_random is None:
        raise ValueError("Captured random state requires NumPy")
    # Validate both snapshots before changing either RNG. No pickle or object deserialization.
    numpy_words = _numpy_asarray(numpy_state["words"], dtype="uint32") if numpy_state is not None else None
    _standard_setstate((3, tuple(standard["words"]), standard["gaussian"]))
    if numpy_state is not None:
        _numpy_setstate(("MT19937", numpy_words,
                         numpy_state["position"], numpy_state["hasGaussian"], numpy_state["gaussian"]))

# Protocol output must survive user code that reassigns fd 1; keep a private handle to the real stdout.
_protocol_out = os.fdopen(os.dup(1), "w", buffering=1)
_figures_dir = os.environ.get("OPEN_SCIENCE_KERNEL_FIGURES_DIR", "")
_text_limit = int(os.environ.get("OPEN_SCIENCE_NOTEBOOK_TEXT_LIMIT_BYTES", 2 * 1024 * 1024))
_diagnostic_limit = min(16 * 1024, max(0, _text_limit))
_figure_limit = int(os.environ.get("OPEN_SCIENCE_NOTEBOOK_FIGURE_LIMIT_BYTES", int(3.5 * 1024 * 1024)))
_figure_count_limit = int(os.environ.get("OPEN_SCIENCE_NOTEBOOK_FIGURE_COUNT_LIMIT", 12))
_figure_total_limit = int(os.environ.get("OPEN_SCIENCE_NOTEBOOK_FIGURE_TOTAL_LIMIT_BYTES", 8 * 1024 * 1024))
_namespace_variable_limit = int(os.environ.get("OPEN_SCIENCE_NOTEBOOK_NAMESPACE_VARIABLE_LIMIT", 500))
_namespace_preview_limit = int(os.environ.get("OPEN_SCIENCE_NOTEBOOK_NAMESPACE_PREVIEW_LIMIT_BYTES", 512))
_namespace_response_limit = int(os.environ.get("OPEN_SCIENCE_NOTEBOOK_NAMESPACE_RESPONSE_LIMIT_BYTES", 256 * 1024))


class _OutputBudget:
    def __init__(self, limit=_text_limit):
        self.remaining = max(0, limit)
        self.truncated = False

    def take(self, value):
        value = str(value)
        if self.remaining <= 0:
            self.truncated = self.truncated or bool(value)
            return ""
        # Every Python character needs at least one UTF-8 byte. Slice by the remaining byte count
        # before encoding so a single enormous print cannot allocate an equally enormous byte copy.
        candidate = value[:self.remaining] if len(value) > self.remaining else value
        data = candidate.encode("utf-8", errors="replace")
        if len(data) <= self.remaining:
            self.remaining -= len(data)
            if len(candidate) < len(value):
                self.truncated = True
            return data.decode("utf-8")
        prefix = data[:max(0, self.remaining)].decode("utf-8", errors="ignore")
        self.remaining -= len(prefix.encode("utf-8"))
        self.truncated = True
        return prefix

    def take_tail(self, value):
        value = str(value)
        if self.remaining <= 0:
            self.truncated = self.truncated or bool(value)
            return ""
        # Traceback exception names/messages live at the end. Bound the temporary encoding by first
        # taking at most `remaining` characters, then keep a valid UTF-8 suffix within the byte cap.
        candidate = value[-self.remaining:] if len(value) > self.remaining else value
        data = candidate.encode("utf-8", errors="replace")
        if len(data) <= self.remaining:
            self.remaining -= len(data)
            if len(candidate) < len(value):
                self.truncated = True
            return data.decode("utf-8")
        suffix = data[-self.remaining:].decode("utf-8", errors="ignore")
        self.remaining -= len(suffix.encode("utf-8"))
        self.truncated = True
        return suffix


def _safe_format_exception():
    """Diagnostics must not terminate the protocol, even for unusual exception frames/objects."""
    _, error, tb = sys.exc_info()
    try:
        return traceback.format_exc()
    except BaseException:
        # Python's rich traceback formatter may execute exception __str__, inspect frame locals
        # for NameError suggestions, or itself be modified by a library. This fallback uses only
        # interpreter-owned traceback fields and exact string arguments, never user formatting.
        try:
            chain = []
            seen = set()
            while error is not None and id(error) not in seen and len(chain) < 8:
                seen.add(id(error))
                frames = []
                while tb is not None:
                    code = tb.tb_frame.f_code
                    frames.append('  File "%s", line %s, in %s\n' %
                                  (code.co_filename, tb.tb_lineno, code.co_name))
                    tb = tb.tb_next
                name = type.__getattribute__(type(error), "__name__")
                args = BaseException.__getattribute__(error, "args")
                message = args[0] if args and type(args[0]) is str else "<message unavailable>"
                chain.append("".join(frames) + name + ": " + message + "\n")
                cause = BaseException.__getattribute__(error, "__cause__")
                if cause is None and not BaseException.__getattribute__(error, "__suppress_context__"):
                    cause = BaseException.__getattribute__(error, "__context__")
                error = cause
                tb = BaseException.__getattribute__(error, "__traceback__") if error is not None else None
            return ("Traceback (fallback; rich formatting failed):\n" +
                    "\nChained exception:\n".join(reversed(chain)))
        except BaseException:
            return "Python execution failed; exception diagnostics are unavailable.\n"


def _fallback_response(req_id)
```

### Core Architecture Module: `resources/notebook/repl_loop.js`
```
// Persistent REPL control-plane kernel: one persistent Node process. Reads one JSON request per line,
// runs it in a persistent vm context (with an injected async host.mcp connector bridge), and returns
// one JSON response per line. This is the ONLY kernel with outbound connector access; the python/r
// data kernels have none. Not Jupyter, not a data-analysis kernel.
//
// Node -> loop:  { "req_id", "code" }
// loop -> Node:  { "req_id", "stdout", "stderr", "error", "result", "cwd", "figures":[] }
//
// REPL output convention: a trailing bare expression is echoed like a REPL — its value becomes
// `result` (best-effort; see wrapForRun). Explicit `return <expr>` or `console.log(...)` also work.
const vm = require('node:vm')
const readline = require('node:readline')
const fs = require('node:fs')
const path = require('node:path')
const { randomUUID } = require('node:crypto')
const { fileURLToPath } = require('node:url')

// Protocol output line. console is captured into strings during a run (see run()), so writing the
// JSON here via process.stdout.write cannot be corrupted by user console output.
const emit = (obj) => process.stdout.write(JSON.stringify(obj) + '\n')
const OUTPUT_LIMIT_BYTES =
  Number(process.env.OPEN_SCIENCE_NOTEBOOK_TEXT_LIMIT_BYTES) || 2 * 1024 * 1024
const DIAGNOSTIC_LIMIT_BYTES = Math.min(16 * 1024, Math.max(0, OUTPUT_LIMIT_BYTES))

const takeOutput = (budget, value) => {
  value = String(value)
  if (budget.remaining <= 0) {
    if (value) budget.truncated = true
    return ''
  }
  const candidate = value.length > budget.remaining ? value.slice(0, budget.remaining) : value
  const encoded = Buffer.from(candidate, 'utf8')
  if (encoded.byteLength <= budget.remaining) {
    budget.remaining -= encoded.byteLength
    if (candidate.length < value.length) budget.truncated = true
    return encoded.toString('utf8')
  }
  let end = Math.min(budget.remaining, encoded.byteLength)
  while (end > 0 && end < encoded.byteLength && (encoded[end] & 0xc0) === 0x80) end -= 1
  const prefix = encoded.subarray(0, end).toString('utf8')
  budget.remaining -= Buffer.byteLength(prefix, 'utf8')
  budget.truncated = true
  return prefix
}

const takeOutputTail = (budget, value) => {
  value = String(value)
  if (budget.remaining <= 0) {
    if (value) budget.truncated = true
    return ''
  }
  const candidate =
    value.length > budget.remaining ? value.slice(value.length - budget.remaining) : value
  const encoded = Buffer.from(candidate, 'utf8')
  if (encoded.byteLength <= budget.remaining) {
    budget.remaining -= encoded.byteLength
    if (candidate.length < value.length) budget.truncated = true
    return encoded.toString('utf8')
  }
  let start = encoded.byteLength - budget.remaining
  while (start < encoded.byteLength && (encoded[start] & 0xc0) === 0x80) start += 1
  const suffix = encoded.subarray(start).toString('utf8')
  budget.remaining -= Buffer.byteLength(suffix, 'utf8')
  budget.truncated = true
  return suffix
}

// Capture the connector RPC credentials privately, then delete them from process.env BEFORE the
// sandbox is built. The sandbox exposes `process` (for cwd() etc.), so leaving the token in
// process.env would let REPL user code read the connector Bearer token or POST to the RPC endpoint
// directly — bypassing the connector approval/policy gate that host.mcp routes through. host.mcp uses
// the captured values instead. (Broader filesystem/network egress isolation is a tracked follow-up.)
const RPC_ENDPOINT = process.env.OPEN_SCIENCE_MCP_RPC_ENDPOINT
const RPC_SOCKET_PATH = process.env.OPEN_SCIENCE_MCP_RPC_SOCKET_PATH
const RPC_TOKEN_FD = Number(process.env.OPEN_SCIENCE_MCP_RPC_TOKEN_FD)
const RPC_TOKEN =
  Number.isInteger(RPC_TOKEN_FD) && RPC_TOKEN_FD >= 3
    ? (() => {
        try {
          return fs.readFileSync(RPC_TOKEN_FD, 'utf8')
        } finally {
          fs.closeSync(RPC_TOKEN_FD)
        }
      })()
    : process.env.OPEN_SCIENCE_MCP_RPC_TOKEN
const RPC_PROXY_URL =
  !RPC_SOCKET_PATH &&
  RPC_ENDPOINT &&
  new URL(RPC_ENDPOINT).hostname === 'open-science-notebook-rpc.invalid'
    ? process.env.HTTP_PROXY
    : undefined
delete process.env.OPEN_SCIENCE_MCP_RPC_ENDPOINT
delete process.env.OPEN_SCIENCE_MCP_RPC_SOCKET_PATH
delete process.env.OPEN_SCIENCE_MCP_RPC_TOKEN
delete process.env.OPEN_SCIENCE_MCP_RPC_TOKEN_FD

// Notebook session/project identity and the Agent Session workspace for host.compute. They are not
// secret, but are captured and removed alongside the RPC creds so sandbox user code cannot replace
// the workspace used for relative input resolution. Absent identity -> host.compute approval falls
// back to 'once'-only semantics; absent workspace -> keep the legacy process.cwd() behavior.
const COMPUTE_SESSION_ID = process.env.OPEN_SCIENCE_NOTEBOOK_SESSION_ID
const COMPUTE_PROJECT_ID =
  process.env.OPEN_SCIENCE_NOTEBOOK_PROJECT_ID || process.env.OPEN_SCIENCE_NOTEBOOK_PROJECT_NAME
const COMPUTE_WORKSPACE_CWD = process.env.OPEN_SCIENCE_NOTEBOOK_WORKSPACE_CWD || process.cwd()
delete process.env.OPEN_SCIENCE_NOTEBOOK_SESSION_ID
delete process.env.OPEN_SCIENCE_NOTEBOOK_PROJECT_ID
delete process.env.OPEN_SCIENCE_NOTEBOOK_PROJECT_NAME
delete process.env.OPEN_SCIENCE_NOTEBOOK_WORKSPACE_CWD

// Updated only by the trusted kernel request frame while one serialized control invocation is
// running. It is never exposed to sandbox code; host.agents forwards it as server context so an
// approved switch can capture only this invocation's outer completion.
let ACTIVE_CONTROL_INVOCATION_ID
let DELEGATE_CALL_SEQUENCE = 0

// Private references to the RPC clients, captured before user code runs. host.mcp MUST use these, not
// the global `fetch`: a vm sandbox is not a security boundary, so sandbox code can reach the outer
// realm via `host.mcp.constructor('return globalThis')()` and reassign the outer fetch to a hook that
// would otherwise capture the connector Bearer token on the next host.mcp call. Module-scoped consts
// are not on globalThis and cannot be reassigned from that escape. (Sandbox code still has direct
// fetch/require/process — full FS + network-egress isolation is the tracked follow-up.)
const capturedFetch = fetch
const capturedHttpRequest = require('node:http').request
const capturedRpcFetch = (input, init = {}) => {
  if (!RPC_SOCKET_PATH && !RPC_PROXY_URL) return capturedFetch(input, init)

  const url = new URL(input)
  const proxy = RPC_PROXY_URL && new URL(RPC_PROXY_URL)
  const headers = Object.fromEntries(new Headers(init.headers).entries())
  if (proxy) {
    const supplied = `${decodeURIComponent(proxy.username)}:${decodeURIComponent(proxy.password)}`
    headers['proxy-authorization'] = `Basic ${Buffer.from(supplied).toString('base64')}`
  }
  return new Promise((resolve, reject) => {
    const request = capturedHttpRequest(
      {
        ...(RPC_SOCKET_PATH
          ? { socketPath: RPC_SOCKET_PATH }
          : { hostname: proxy.hostname, port: proxy.port || 80 }),
        path: proxy ? url.href : url.pathname + url.search,
        method: init.method || 'GET',
        headers
      },
      (response) => {
        let body = ''
        response.setEncoding('utf8')
        response.on('data', (chunk) => (body += chunk))
        response.once('aborted', () => reject(new Error('RPC response was interrupted')))
        response.once('error', reject)
        response.once('end', () => {
          const status = response.statusCode || 500
          resolve({
            ok: status >= 200 && status < 300,
            status,
            json: async () => JSON.parse(body)
          })
        })
      }
    )
    request.once('error', reject)
    if (init.body !== undefined) request.write(init.body)
    request.end()
  })
}

// The control REPL must not become a second package-manager entry point. Patch the shared built-in
// child_process exports before user code is evaluated, so computed property access such as
// `cp['ex' + 'ec'](...)` is checked against the resolved command at call time. The main process source
// policy rejects obvious calls earlier; this runtime layer covers dynamically assembled argv.
const packageMutationCommand =
  /(?:\b(?:micromamba|mamba|conda|pip|pip3|pipx|uv|poetry)(?:\.exe)?\b.{0,160}\b(?:install|uninstall|update|upgrade|remove|create|sync|add|venv)\b|\b(?:python|python3|py)(?:\.\d+)?(?:\.exe)?\b.{0,80}\s-m\s+(?:(?:venv|virtualenv|ensurepip)\b|pip\b.{0,100}\b(?:install|uninstall|wheel)\b)|\bR(?:script)?(?:\.exe)?\b.{0,120}(?:\bCMD\s+INSTALL\b|(?:install|remove|update)\.packages\b))/isu

const commandText = (command, args = []) =>
  [command, ...(Array.isArray(args) ? args : [])]
    .filter((part) => part !== undefined && part !== null)
    .map((part) => String(part))
    .join(' ')

const powerShellEncodedSource = (words, commandIndex = 0) => {
  const encodedFlag = words.findIndex((word, index) => {
    if (index <= commandIndex || !String(word).startsWith('-')) return false
    const flag = String(word).slice(1).toLowerCase()
    return flag === 'e' || flag === 'ec' || (flag.length >= 2 && 'encodedcommand'.startsWith(flag))
  })
  return encodedFlag >= 0
    ? Buffer.from(
        String(words[encodedFlag + 1] ?? '').replace(/^['"]|['"]$/gu, ''),
        'base64'
      ).toString('utf16le')
    : undefined
}

const packageInstallerExecutables = new Set([
  'micromamba',
  'mamba',
  'conda',
  'pip',
  'pip3',
  'pipx',
  'uv',
  'poetry',
  'python',
  'python3',
  'py',
  'r',
  'rscript'
])

const packageWordsMutate = (rawWords) => {
  const words = rawWords
    .filter((word) => word !== undefined && word !== null)
    .map((word) => String(word))
  let commandIndex = 0
  while (commandIndex < words.length) {
    const executable = commandName(words[commandIndex]).replace(/\.exe$/u, '')
    if (executable === 'sudo') {
      commandIndex += 1
      while (commandIndex < words.length && words[commandIndex].startsWith('-')) commandIndex += 1
      continue
    }
    if (executable === 'env') {
      com
```

### Core Architecture Module: `resources/pdf-structure/literature-pdf-render-bounds.mjs`
```
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import assert from 'node:assert/strict'
import { version } from 'pdfjs-dist/legacy/build/pdf.mjs'

// The extractor reads painted-operation boxes, not debugger dependency boxes.
// PDF.js propagates each box to every preceding transform, which is quadratic
// for long native vector streams. Keep its original bbox/clip/save machinery;
// omit only dependencies used to rerender a subset of operations in a debugger.
// This is an instance-local adapter to the same pinned private render API used
// by collectGraphicsBounds. Regular PDF rendering is unaffected.
export function recordPaintedOperationBounds(renderTask) {
  assert.equal(version, '5.4.624', 'Review the PDF render bounds adapter after upgrading PDF.js.')
  const tracker = renderTask?._internalRenderTask?._dependencyTracker
  assert(
    typeof tracker?.recordDependencies === 'function',
    'PDF render bounds tracker is unavailable.'
  )
  tracker.recordDependencies = function () {
    return this
  }
}

```

### Core Architecture Module: `resources/skills/skill-creator/scripts/run-loop.js`
```
'use strict'
/* eslint-disable @typescript-eslint/explicit-function-return-type */

const splitEvalSet = (queries, trainRatio = 0.6) => {
  if (!Array.isArray(queries) || queries.length < 2) {
    throw new Error('splitEvalSet requires at least two trigger cases.')
  }
  const trainSize = Math.max(
    1,
    Math.min(queries.length - 1, Math.round(queries.length * trainRatio))
  )
  return { train: queries.slice(0, trainSize), test: queries.slice(trainSize) }
}

const runLoop = async ({ hostSkills, evalId }) => {
  if (typeof hostSkills?.evals?.run !== 'function') {
    throw new Error('host.skills.evals.run is unavailable in this runtime.')
  }
  if (!evalId) throw new Error('evalId is required.')
  return hostSkills.evals.run(evalId)
}

module.exports = { runLoop, splitEvalSet }

```

### Core Architecture Module: `resources/skills/skill-creator/scripts/utils.js`
```
'use strict'
/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/explicit-function-return-type */

const { readFile, writeFile } = require('node:fs/promises')

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'))
const writeJson = async (path, value) =>
  writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')

const mean = (values) =>
  values.length === 0 ? 0 : values.reduce((total, value) => total + value, 0) / values.length

const summarize = (values) => {
  if (values.length === 0) return { mean: 0, stddev: 0, min: 0, max: 0 }
  const average = mean(values)
  return {
    mean: average,
    stddev: Math.sqrt(mean(values.map((value) => (value - average) ** 2))),
    min: Math.min(...values),
    max: Math.max(...values)
  }
}

const escapeHtml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

module.exports = { escapeHtml, mean, readJson, summarize, writeJson }

```

### Core Architecture Module: `scripts/ci/cancel-stale-queue-runs.mjs`
```
/* eslint-disable @typescript-eslint/explicit-function-return-type */

export const QUEUE_WORKFLOW_IDS = ['pr-gate.yml', 'ci-integrity.yml']

// Only GitHub's deleted/replaced queue refs establish that a run is obsolete.
export async function cancelStaleQueueRuns({
  github,
  repo,
  log = console.log,
  workflowIds = QUEUE_WORKFLOW_IDS
}) {
  const cancelled = []
  for (const workflowId of workflowIds) {
    for (const status of ['queued', 'in_progress', 'waiting', 'pending', 'requested']) {
      const runs = await github.paginate(github.rest.actions.listWorkflowRuns, {
        ...repo,
        workflow_id: workflowId,
        event: 'merge_group',
        status,
        per_page: 100
      })
      for (const run of runs) {
        if (
          run.event !== 'merge_group' ||
          run.status === 'completed' ||
          !/^gh-readonly-queue\/main\/pr-\d+-[0-9a-f]{40}$/.test(run.head_branch ?? '')
        )
          continue
        let currentSha
        try {
          const { data } = await github.rest.git.getRef({
            ...repo,
            ref: `heads/${run.head_branch}`
          })
          currentSha = data.object.sha
        } catch (error) {
          if (error.status !== 404) throw error
        }
        if (currentSha === run.head_sha) continue
        try {
          await github.rest.actions.cancelWorkflowRun({ ...repo, run_id: run.id })
          cancelled.push(run.id)
          log(`Requested cancellation of obsolete merge-group run ${run.id} (${workflowId})`)
        } catch (error) {
          // A run can finish between enumeration and cancellation.
          if (error.status !== 409) throw error
          log(`Run ${run.id} is no longer cancellable`)
        }
      }
    }
  }
  return cancelled
}

```

### Core Architecture Module: `scripts/deb-package-lifecycle-smoke.mjs`
```
/* eslint-disable @typescript-eslint/explicit-function-return-type */

// Run on a disposable Linux certification runner before installing the real application.
// Use the built package's actual FPM control scripts, not merely the source templates.
import { execFileSync } from 'node:child_process'
import { chmod, mkdir, mkdtemp, lstat, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const run = (command, args) =>
  execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
const command = '/usr/bin/open-science'
const appRoot = '/opt/Open-Science'
const legacyTarget = `${appRoot}/open-science`
const cliTarget = `${appRoot}/resources/open-science-cli`

const main = async (deb) => {
  if (process.platform !== 'linux' || process.getuid() !== 0) {
    throw new Error('Debian lifecycle certification requires root on a disposable Linux runner.')
  }
  // Never use this harness to replace an already installed application or user command.
  const status = (() => {
    try {
      return run('dpkg-query', ['-W', '-f=${db:Status-Status}', 'open-science']).trim()
    } catch {
      return 'not-installed'
    }
  })()
  if (status === 'installed') {
    throw new Error('Run Debian lifecycle certification before installing Open-Science.')
  }
  for (const path of [command, appRoot]) {
    if (
      await lstat(path).then(
        () => true,
        () => false
      )
    ) {
      throw new Error(`Refusing to replace an existing certification target: ${path}`)
    }
  }
  const root = await mkdtemp(join(tmpdir(), 'deb-lifecycle-'))
  try {
    const control = join(root, 'actual-control')
    run('dpkg-deb', ['--control', deb, control])
    const generated = {}
    for (const name of ['postinst', 'postrm'])
      generated[name] = await readFile(join(control, name), 'utf8')
    if (!generated.postinst.includes(cliTarget) || !generated.postrm.includes(cliTarget)) {
      throw new Error('The built Debian control scripts did not include the CLI lifecycle hooks.')
    }
    const fixture = async (version, legacy) => {
      const tree = join(root, version)
      await mkdir(join(tree, 'DEBIAN'), { recursive: true })
      await mkdir(join(tree, 'opt/Open-Science/resources'), { recursive: true })
      await writeFile(
        join(tree, 'DEBIAN/control'),
        `Package: open-science\nVersion: ${version}\nArchitecture: all\nMaintainer: AIPOCH\nDescription: Debian CLI lifecycle certification fixture\n`
      )
      for (const name of ['postinst', 'postrm']) {
        const text = legacy
          ? (
              await readFile(
                resolve(
                  `node_modules/app-builder-lib/templates/linux/${name === 'postinst' ? 'after-install' : 'after-remove'}.tpl`
                ),
                'utf8'
              )
            )
              .replaceAll('${executable}', 'open-science')
              .replaceAll('${sanitizedProductName}', 'Open-Science')
          : generated[name]
        const path = join(tree, 'DEBIAN', name)
        await writeFile(path, text)
        await chmod(path, 0o755)
      }
      for (const file of ['open-science', 'resources/open-science-cli', 'chrome-sandbox']) {
        await writeFile(join(tree, 'opt/Open-Science', file), '#!/bin/sh\nexit 0\n', {
          mode: 0o755
        })
      }
      const output = join(root, `${version}.deb`)
      run('dpkg-deb', ['--build', '--root-owner-group', tree, output])
      return output
    }
    const oldPackage = await fixture('0.0.1', true)
    const newPackage = await fixture('0.0.2', false)
    for (const mode of ['auto', 'manual']) {
      run('dpkg', ['--install', oldPackage])
      if ((await realpath(command)) !== legacyTarget)
        throw new Error('Legacy fixture did not expose Electron.')
      if (mode === 'manual') run('update-alternatives', ['--set', 'open-science', legacyTarget])
      run('dpkg', ['--install', newPackage])
      if ((await realpath(command)) !== cliTarget)
        throw new Error(`Debian ${mode} upgrade did not expose the CLI.`)
      run('dpkg', ['--install', newPackage])
      if ((await realpath(command)) !== cliTarget) throw new Error('Debian reinstall lost the CLI.')
      run('dpkg', ['--remove', 'open-science'])
      if (
        await realpath(command).then(
          () => true,
          () => false
        )
      )
        throw new Error('Debian removal left a live command.')
      run('dpkg', ['--purge', 'open-science'])
      console.log(
        `Debian generated hooks: ${mode} legacy upgrade, reinstall, remove and purge passed.`
      )
    }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv[2]).catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}

```

### Core Architecture Module: `src/main/acp/connection-lifecycle-workflow.ts`
```
import * as acp from '@agentclientprotocol/sdk'
import type { ClientConnection, SetProviderRequest } from '@agentclientprotocol/sdk'
import { resolve } from 'node:path'

import type { AcpConnectRequest, AcpRuntimeEventInput, AcpStateSnapshot } from '../../shared/acp'
import type { AgentFramework, AgentProviderConfiguration } from '../agent-framework'
import { createLogger, diagnosticErrorFields } from '../logger'
import type { AcpAgentConnectionCandidate } from './agent-connection-adapter'
import type {
  AcpConnectionResourceAttempt,
  AcpConnectionResourceOwner,
  AcpConnectionResourceReadyHandle
} from './connection-resource-owner'
import { retainInitializeCapabilities } from './native-follow-up'

type LifecycleEvent = AcpRuntimeEventInput
type TransferredConnection = ReturnType<AcpAgentConnectionCandidate['transferTo']>

const resolveFallbackProviderConfiguration = async (
  connection: TransferredConnection,
  requested: AgentProviderConfiguration
): Promise<SetProviderRequest | undefined> => {
  const { providers } = await connection.listProviders()
  const exact = providers.find(
    (provider) =>
      provider.providerId === requested.providerId && provider.supported.includes(requested.apiType)
  )
  if (exact) return undefined

  const compatible = providers.filter((provider) => provider.supported.includes(requested.apiType))
  return compatible.length === 1
    ? { ...requested, providerId: compatible[0].providerId }
    : undefined
}

type AcpConnectionLifecycleWorkflowOptions = Readonly<{
  appVersion: string
  defaultCwd: string
  currentConnection: () => ClientConnection | undefined
  currentStatus: () => AcpStateSnapshot['status']
  currentGeneration: () => number
  currentFramework: () => AgentFramework['id']
  reconnectBarrier: () => Promise<void> | undefined
  connect?: (request: AcpConnectRequest) => Promise<AcpStateSnapshot>
  getSnapshot: () => AcpStateSnapshot
  connectResources: Pick<AcpConnectionResourceOwner, 'connect'>
  invalidatePendingSessionStartups: () => void
  disconnectCurrent: (
    emitClosedStatus: boolean,
    teardownGeneration: number
  ) => Promise<AcpStateSnapshot>
  updateCwd: (cwd: string) => void
  updateError: (error: string | undefined) => void
  setStatus: (status: AcpStateSnapshot['status']) => void
  pushEvent: (event: LifecycleEvent) => void
  transitionStatus: (status: AcpStateSnapshot['status']) => void
  emitState: () => void
  diagnosticContext: (
    framework?: AgentFramework['id'],
    generation?: number
  ) => { framework: AgentFramework['id']; generation: number; status: AcpStateSnapshot['status'] }
  openCandidate: (
    attempt: AcpConnectionResourceAttempt,
    onFrameworkResolved: (framework: AgentFramework['id']) => void
  ) => Promise<AcpAgentConnectionCandidate>
}>

const log = createLogger('acp')

const safeLogError = (message: string, error: unknown): void => {
  try {
    log.error(message, error)
  } catch {
    return
  }
}

const safeLogWarning = (message: string, data: unknown): void => {
  try {
    log.warn(message, data)
  } catch {
    return
  }
}

const errorMessage = (error: unknown): string => {
  try {
    const message = error instanceof Error ? (error as { message?: unknown }).message : error
    return typeof message === 'string' ? message : String(message)
  } catch {
    return 'unknown error'
  }
}

class AcpConnectionLifecycleWorkflow {
  constructor(private readonly options: AcpConnectionLifecycleWorkflowOptions) {}

  async connect(request: AcpConnectRequest = {}): Promise<AcpStateSnapshot> {
    await this.options.connectResources.connect((attempt) => this.connectFresh(request, attempt))
    return this.options.getSnapshot()
  }

  async ensureConnected(cwd: string): Promise<ClientConnection> {
    const barrier = this.options.reconnectBarrier()
    if (barrier) await barrier

    const connection = this.options.currentConnection()
    if (connection && this.options.currentStatus() === 'connected') return connection

    log.info('ensureConnected: attempting connection', this.options.diagnosticContext())
    try {
      await (this.options.connect?.({ cwd }) ?? this.connect({ cwd }))
    } catch (error) {
      safeLogError('ensureConnected: connect failed', {
        ...diagnosticErrorFields(error),
        ...this.options.diagnosticContext()
      })
      throw error
    }

    const connected = this.options.currentConnection()
    if (!connected) {
      const error = new Error('ACP connection failed')
      safeLogError('ensureConnected: connection is null after connect', {
        ...this.options.diagnosticContext(),
        errorCategory: 'connection-unavailable'
      })
      throw error
    }
    log.info('ensureConnected: connection established', this.options.diagnosticContext())
    return connected
  }

  private async connectFresh(
    request: AcpConnectRequest,
    attempt: AcpConnectionResourceAttempt
  ): Promise<AcpConnectionResourceReadyHandle> {
    const generation = attempt.epoch
    attempt.assertCurrent()
    const cwd = resolve(request.cwd || this.options.defaultCwd)
    let candidate: AcpAgentConnectionCandidate | undefined
    let transferred: TransferredConnection | undefined
    let spawnedFramework = this.options.currentFramework()

    try {
      this.options.invalidatePendingSessionStartups()
      await this.options.disconnectCurrent(false, generation)
      attempt.assertCurrent()

      this.options.updateCwd(cwd)
      this.options.updateError(undefined)
      this.options.setStatus('connecting')
      log.info('connecting agent', this.options.diagnosticContext(spawnedFramework, generation))

      candidate = await this.options.openCandidate(attempt, (framework) => {
        spawnedFramework = framework
      })
      transferred = candidate.transferTo(attempt)
      candidate = undefined

      const initResult = await transferred.initialize({
        protocolVersion: acp.PROTOCOL_VERSION,
        clientInfo: {
          name: 'open-science',
          version: this.options.appVersion
        },
        clientCapabilities: {
          fs: { readTextFile: true, writeTextFile: true },
          session: { configOptions: { boolean: {} } },
          plan: {},
          elicitation: { form: {} }
        }
      })
      attempt.assertCurrent()

      const initializeMaterial = transferred.backendAttempt.consumeInitializeMaterial()
      if (initializeMaterial?.authentication) {
        await transferred.authenticate(initializeMaterial.authentication)
        attempt.assertCurrent()
      }
      if (initializeMaterial?.providerConfiguration) {
        try {
          await transferred.setProvider(initializeMaterial.providerConfiguration)
          attempt.assertCurrent()
        } catch (cause) {
          if (!(cause instanceof acp.RequestError) || cause.code !== -32602) throw cause
          attempt.assertCurrent()
          // Codex ACP 1.1.4 advertises `custom-gateway`; 1.6.2 advertises `openai`.
          // Retry only when the adapter itself exposes one unambiguous compatible slot.
          const fallback = await resolveFallbackProviderConfiguration(
            transferred,
            initializeMaterial.providerConfiguration
          )
          if (!fallback) throw cause
          attempt.assertCurrent()
          await transferred.setProvider(fallback)
          attempt.assertCurrent()
        }
      }

      const handle = attempt.publish(retainInitializeCapabilities(initResult, spawnedFramework))
      log.info('agent initialized', {
        protocolVersion: initResult.protocolVersion,
        supportsSessionClose: handle.capabilities.close,
        supportsSessionDelete: handle.capabilities.delete,
        supportsSessionResume: handle.capabilities.resume,
        supportsSteering: handle.capabilities.steering
      })
      this.options.pushEvent({
        kind: 'system',
        level: 'info',
        title: 'Agent initialized',
        text: `ACP protocol ${initResult.protocolVersion}`
      })
      handle.assertCurrent()
      this.options.setStatus('connected')
      return handle
    } catch (cause) {
      try {
        transferred?.backendAttempt.fail()
      } catch (error) {
        safeLogError('ACP backend attempt cleanup failed', diagnosticErrorFields(error))
      }
      try {
        await candidate?.dispose()
      } catch (error) {
        safeLogError('ACP connection candidate cleanup failed', diagnosticErrorFields(error))
      }

      const current = generation === this.options.currentGeneration()
      try {
        if (current) {
          this.options.updateError(errorMessage(cause))
          safeLogError('agent connection failed', {
            ...diagnosticErrorFields(cause),
            ...this.options.diagnosticContext(spawnedFramework, generation)
          })
          try {
            this.options.pushEvent({
              kind: 'error',
              level: 'error',
              title: 'Connection failed',
              text: errorMessage(cause)
            })
          } catch (error) {
            safeLogError('agent connection failure notification failed', {
              ...diagnosticErrorFields(error),
              ...this.options.diagnosticContext(spawnedFramework, generation)
            })
          }
          try {
            await this.options.disconnectCurrent(false, generation)
          } catch (error) {
            safeLogError('agent connection cleanup failed', {
              ...diagnosticErrorFields(error),
              ...this.options.diagnosticContext(spawnedFramework, generation)
            })
          }
          if (generation === this.options.currentGeneration()) {
            this.options.transitionStatus('error')
            try {
              this.options.emitState()
            } catch (error) {
              safeLogError('agent connection emitState failed', error)
            }
          }
        } else {
          safeLogWarning('agent connection abandoned (superseded or shutting down)', {
  
```

### Core Architecture Module: `src/main/acp/runtime-lifecycle-composition.ts`
```
import type { ClientConnection } from '@agentclientprotocol/sdk'

import {
  ACP_PROMPT_FAILED_EVENT_TITLE,
  type AcpConnectRequest,
  type AcpRuntimeEvent
} from '../../shared/acp'
import type { AgentFramework } from '../agent-framework'
import { createLogger, errorLogFields } from '../logger'
import type { AcpAgentConnectionCandidate } from './agent-connection-adapter'
import { AcpConnectionCloseWorkflow, type CloseState } from './connection-close-workflow'
import { AcpConnectionLifecycleWorkflow } from './connection-lifecycle-workflow'
import type { AcpConnectionResourceAttempt } from './connection-resource-owner'
import { AcpModelChangeWorkflow } from './model-change-workflow'
import type { AcpRuntimeOptions } from './runtime'
import type { AcpRuntimeBaseOwners } from './runtime-base-composition'
import type { AcpRuntimeSessionOwners } from './runtime-session-composition'
import type { AcpSessionInteractionOwner } from './session-interaction-owner'

const log = createLogger('acp')

const safeLogError = (message: string, error: unknown): void => {
  try {
    log.error(message, error)
  } catch {
    // Lifecycle recovery and the original failure take precedence over diagnostic sinks.
  }
}

type AcpRuntimeLifecycleHost = Readonly<{
  connect: (request: AcpConnectRequest) => ReturnType<AcpConnectionLifecycleWorkflow['connect']>
  disconnect: (emitClosedStatus?: boolean) => ReturnType<AcpConnectionCloseWorkflow['disconnect']>
  openAgentConnection: (
    attempt: AcpConnectionResourceAttempt,
    onFrameworkResolved: (framework: AgentFramework['id']) => void
  ) => Promise<AcpAgentConnectionCandidate>
  clearPromptResources?: () => void
  onPromptEnded?: (sessionId: string, turnToken: string) => void
}>

// Composes the model/connection lifecycle cycle around authoritative base and Session owners.
// Host callbacks retain only structural facade operations and are never invoked during construction.
/* eslint-disable @typescript-eslint/explicit-function-return-type */
const composeAcpRuntimeLifecycleOwners = (
  options: Pick<
    AcpRuntimeOptions,
    'appVersion' | 'defaultCwd' | 'hasReplayableImageHistory' | 'runtimeSessions' | 'callbacks'
  >,
  base: AcpRuntimeBaseOwners,
  session: AcpRuntimeSessionOwners,
  host: AcpRuntimeLifecycleHost
) => {
  const currentConnection = (): ClientConnection | undefined => base.connectionResources.connection
  const currentFramework = (): AgentFramework => base.backendGeneration.current.framework
  const diagnosticContext = (
    framework: AgentFramework['id'] = currentFramework().id,
    generation = base.connectionResources.epoch
  ) => ({ framework, generation, status: base.snapshotOwner.status })
  const setStatus = (status: Parameters<typeof base.snapshotOwner.transitionStatus>[0]): void => {
    base.snapshotOwner.transitionStatus(status)
    session.publication.emitState()
  }
  const invalidatePendingSessionStartups = (): void => {
    base.generationActivity.invalidateStartups()
    session.sessionRegistry.invalidatePending()
    session.reviewerSessions.invalidatePending()
  }
  const activeSessionIds = (): string[] =>
    session.sessionRegistry.entries(true).map(({ appSessionId }) => appSessionId)
  const closeState: CloseState = {
    invalidatePendingSessionStartups,
    disposePermissionContext: () => session.permissionContext.dispose(),
    disposeElicitationOwner: () => session.elicitationOwner.dispose(),
    clearPendingAppContinuations: () => session.appContinuations.clear(),
    clearReviewerState: () => session.reviewerSessions.clear(),
    clearPlanInteractions: () =>
      base.planInteractions.clearAll('The Session Plan interaction was disconnected.'),
    settleActivePrompts: () => base.sessionInteractions.settleActivePrompts(),
    supersedeInteractions: () => base.sessionInteractions.supersedeAll(),
    clearContextUsage: () => base.contextUsageTracker.clear(),
    clearAppliedSessionModels: () => session.sessionRegistry.clearAppliedModels(),
    activeSessionIds,
    disposeSessionCapabilities: (sessionIds) => base.sessionCapabilities.dispose(sessionIds),
    disposeActiveSessions: (recordFailure) => {
      for (const { attachment } of session.sessionRegistry.entries(true)) {
        if (!attachment) continue
        try {
          attachment.session.dispose()
        } catch (error) {
          recordFailure('primary-session', error)
        }
      }
    },
    detachSessionConnections: (clearPermissionProfile) => {
      for (const entry of session.sessionRegistry.entries()) {
        if (entry.attachment) session.sessionRegistry.detach(entry.attachment, 'connection')
        else entry.aggregate.detachConnection()
        if (clearPermissionProfile) entry.aggregate.setPermissionProfile(undefined)
      }
    },
    clearPromptContent: (connectionGeneration) => {
      host.clearPromptResources?.()
      if (connectionGeneration === undefined) base.promptContentOwner.clear()
      else base.promptContentOwner.clearGeneration(connectionGeneration)
    },
    clearHandoffContinuity: () => base.handoffContinuity.clearGeneration(),
    clearSessionProjection: () => session.sessionUpdateProjector.clearGeneration(),
    disposeSessionProjection: () => session.sessionUpdateProjector.dispose(),
    clearHttpRoutes: () => base.sessionCapabilities.clearHttpRoutes(),
    selectSession: () => session.sessionRegistry.select(undefined),
    publishInterruptedPromptFailures: (prompts) => {
      for (const { scope, terminal } of prompts as ReturnType<
        AcpSessionInteractionOwner['settleActivePrompts']
      >) {
        try {
          // Close has synchronously superseded these exact interactions. Their finalizers no
          // longer own prompt-end notification, so release admission before detached retries.
          // Keep this synchronous: awaiting the commit first could release a newer turn's lease.
          try {
            session.sessionUpdateProjector.clearAssistantOutput(scope.sessionId)
            host.onPromptEnded?.(scope.sessionId, scope.turnToken)
            options.callbacks?.onPromptEnded?.(scope.sessionId, scope.turnToken)
          } catch (error) {
            safeLogError('connection-close prompt-end callback failed', error)
          }
          const event: AcpRuntimeEvent = {
            id: session.publication.nextEventId(),
            kind: 'error',
            level: 'error',
            providerError: false,
            interruptionCause: 'connection-lost',
            errorReportable: false,
            sessionId: scope.sessionId,
            promptExecutionId: scope.turnToken,
            ...(scope.promptMessageId ? { promptMessageId: scope.promptMessageId } : {}),
            timestamp: terminal.timestamp,
            title: ACP_PROMPT_FAILED_EVENT_TITLE,
            text: 'ACP connection closed'
          }
          if (options.runtimeSessions) {
            void options.runtimeSessions
              .commitTerminal(event, (published) => session.publication.pushEvent(published))
              .then(() => options.runtimeSessions!.retryTerminalCommits(scope.sessionId))
              .catch((error) => safeLogError('connection-close terminal commit failed', error))
          } else session.publication.pushEvent(event)
        } catch (error) {
          safeLogError('connection-close prompt event failed', errorLogFields(error))
        }
      }
    },
    cancelPendingStatePublication: () => session.publication.cancelPendingStatePublication(),
    setStatus,
    transitionStatus: (status) => base.snapshotOwner.transitionStatus(status),
    emitState: () => session.publication.emitState(),
    hasContextUsage: () => base.contextUsageTracker.hasUsage()
  }

  const modelChanges = new AcpModelChangeWorkflow({
    backendGeneration: base.backendGeneration,
    connectionResources: base.connectionResources,
    registry: session.sessionRegistry,
    configurator: base.sessionConfigurator,
    contextUsage: base.contextUsageTracker,
    currentStatus: () => base.snapshotOwner.status,
    providerReconnectPending: () => base.connectionTransitions.providerReconnectPending,
    isGenerationBusy: () => base.generationActivity.blockers().retirement,
    contextEstimateInput: (sessionId) =>
      session.contextUsagePolicy.resolve(sessionId).estimateInput,
    hasReplayableImageHistory: options.hasReplayableImageHistory,
    emitState: () => session.publication.emitState(),
    requestReconnect: () => base.connectionTransitions.requestProviderReconnect(),
    recoverFailedReconnect: (disconnectedGeneration) =>
      connectionClose.recoverFailedDeferredDisconnect(disconnectedGeneration),
    reportReconnectFailure: (error) =>
      safeLogError('model-change reconnect failed', errorLogFields(error)),
    diagnosticContext
  })
  const connectionClose: AcpConnectionCloseWorkflow = new AcpConnectionCloseWorkflow({
    currentGeneration: () => base.connectionResources.epoch,
    currentStatus: () => base.snapshotOwner.status,
    getSnapshot: () => session.publication.getSnapshot(),
    transitions: base.connectionTransitions,
    resources: base.connectionResources,
    backendGeneration: base.backendGeneration,
    modelChanges,
    state: closeState,
    reportFailure: (message, error) => safeLogError(message, errorLogFields(error))
  })

  base.bindGenerationConnectionEffects({
    reviewerSessions: session.reviewerSessions,
    modelChanges,
    connectionClose: {
      disconnect: (emitClosedStatus) => host.disconnect(emitClosedStatus),
      recoverFailedDeferredDisconnect: (disconnectedGeneration) =>
        connectionClose.recoverFailedDeferredDisconnect(disconnectedGeneration)
    },
    publishIdle: () => setStatus('idle')
  })

  const connectionLifecycle = new AcpConnectionLifecycleWorkflow({
    appVersion: options.appVersion,
    defaultCwd: options.defaultCwd,
    currentConnection,
    currentStatus: () => base.snapshotOwner.status,
    currentGeneration: () => base.connectionResources.epoch,
    curre
```

### Core Architecture Module: `src/main/agents/completion-handoff-lifecycle.ts`
```
// Durable, application-owned lifecycle for a completion captured after an approved specialist
// switch. The lifecycle intentionally has no renderer dependency: only its repository state and
// provider-facing runtime requests decide whether an old prompt can resume.

import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { deserialize, serialize } from 'node:v8'

import type {
  CompletionDisposition,
  CompletionGateRuntime,
  ToolCompletionEnvelope,
  TrustedToolCompletionContext
} from './completion-gate'
import { completionHandoffKey } from './completion-gate'
import type { ApprovedSwitchReadback } from '../../shared/agents-contract'
import type {
  CompletionHandoffLifecycleEvent,
  CompletionHandoffPhase,
  CompletionHandoffRetryFrom
} from '../../shared/specialist'
import type { HandoffApprovalContext } from '../../shared/handoff-lifecycle'

export type CompletionHandoffStage = CompletionHandoffPhase
export type CompletionHandoffRetryStage = CompletionHandoffRetryFrom

export type CompletionHandoffProvenance = {
  originatingTurnId: string
  originatingUserMessageId?: string
  attachmentIds: string[]
  artifactIds: string[]
}

export type CompletionHandoffContinuation = {
  outcome: string
  switchReadback?: ApprovedSwitchReadback
}

export type DurableCompletionHandoff = {
  id: string
  context: TrustedToolCompletionContext
  targetName: string | null
  approvedSpecialistId?: string
  approvedSpecialistRevision?: number
  generation: number
  sequence: number
  commitOrder?: number
  observedAt: number
  provenance: CompletionHandoffProvenance
  stage: CompletionHandoffStage
  envelope?: ToolCompletionEnvelope
  retryFrom?: CompletionHandoffRetryStage
  cancelled: boolean
  failureMessage?: string
  continuation?: CompletionHandoffContinuation
}

// Renderer adapters consume this projection as read-only data. The lifecycle owns the durable
// authority; this shape merely prevents every adapter from inventing a subtly different mapping.
export const toCompletionHandoffLifecycleEvent = (
  handoff: DurableCompletionHandoff
): CompletionHandoffLifecycleEvent => ({
  id: handoff.id,
  sessionId: handoff.context.sessionId,
  sequence: handoff.sequence,
  ...(handoff.commitOrder !== undefined ? { commitOrder: handoff.commitOrder } : {}),
  observedAt: handoff.observedAt,
  phase: handoff.stage,
  target: handoff.targetName,
  provenance: handoff.provenance,
  ...(handoff.continuation
    ? { continuation: toRendererSafeContinuation(handoff.continuation) }
    : {}),
  ...(handoff.stage === 'failed' && handoff.retryFrom && handoff.failureMessage
    ? { failure: { retryFrom: handoff.retryFrom, message: handoff.failureMessage } }
    : {})
})

const toRendererSafeContinuation = (
  continuation: CompletionHandoffContinuation
): CompletionHandoffLifecycleEvent['continuation'] => {
  if (!continuation.switchReadback) return { outcome: continuation.outcome }
  const binding = continuation.switchReadback.binding
  const safeBinding = {
    sessionId: binding.sessionId,
    targetName: binding.targetName,
    ...(binding.revision !== undefined ? { revision: binding.revision } : {})
  }
  return {
    outcome: continuation.outcome,
    switchReadback: {
      ...continuation.switchReadback,
      binding: safeBinding
    }
  }
}

export type CompletionHandoffRepository = {
  get(context: TrustedToolCompletionContext): Promise<DurableCompletionHandoff | undefined>
  save(handoff: DurableCompletionHandoff): Promise<void>
  update(
    context: TrustedToolCompletionContext,
    updater: (current: DurableCompletionHandoff | undefined) => DurableCompletionHandoff | undefined
  ): Promise<DurableCompletionHandoff | undefined>
  remove(context: TrustedToolCompletionContext): Promise<void>
  list(): Promise<DurableCompletionHandoff[]>
}

// This test/adapter-friendly repository defines the lifecycle's storage boundary. Production wiring
// supplies durable session-backed storage; keeping it separate makes restart recovery testable
// without a renderer, timer, or provider acknowledgement shortcut.
export class InMemoryCompletionHandoffRepository implements CompletionHandoffRepository {
  private readonly handoffs = new Map<string, DurableCompletionHandoff>()
  private commitSequence = 0

  async get(context: TrustedToolCompletionContext): Promise<DurableCompletionHandoff | undefined> {
    const handoff = this.handoffs.get(completionHandoffKey(context))
    return handoff ? clone(handoff) : undefined
  }

  async save(handoff: DurableCompletionHandoff): Promise<void> {
    const committed = this.assignCommitOrder(handoff)
    this.handoffs.set(completionHandoffKey(handoff.context), clone(committed))
  }

  async update(
    context: TrustedToolCompletionContext,
    updater: (current: DurableCompletionHandoff | undefined) => DurableCompletionHandoff | undefined
  ): Promise<DurableCompletionHandoff | undefined> {
    const key = completionHandoffKey(context)
    const current = this.handoffs.has(key) ? clone(this.handoffs.get(key)!) : undefined
    const next = updater(current)
    if (!next || next === current) return next ? clone(next) : undefined
    const committed = this.assignCommitOrder(next)
    this.handoffs.set(key, clone(committed))
    return clone(committed)
  }

  async remove(context: TrustedToolCompletionContext): Promise<void> {
    this.handoffs.delete(completionHandoffKey(context))
  }

  async list(): Promise<DurableCompletionHandoff[]> {
    return [...this.handoffs.values()].map(clone)
  }

  private assignCommitOrder(handoff: DurableCompletionHandoff): DurableCompletionHandoff {
    this.commitSequence = Math.max(this.commitSequence, handoff.commitOrder ?? 0) + 1
    return { ...handoff, commitOrder: this.commitSequence }
  }
}

// Binary V8 records retain the captured envelope's runtime values (including Errors and bigint),
// unlike JSON's lossy representation. Each replacement is atomic, so a process interruption leaves
// either the old valid lifecycle record or the new valid lifecycle record -- never a partial handoff
// that could be interpreted as permission to revive the old prompt.
export class FileCompletionHandoffRepository implements CompletionHandoffRepository {
  private writeQueue: Promise<void> = Promise.resolve()
  private writeSequence = 0
  private commitSequence: number | undefined

  constructor(private readonly storageDir: string) {}

  async get(context: TrustedToolCompletionContext): Promise<DurableCompletionHandoff | undefined> {
    await this.writeQueue
    return this.read(context)
  }

  private async read(
    context: TrustedToolCompletionContext
  ): Promise<DurableCompletionHandoff | undefined> {
    try {
      return parseHandoff(await readFile(this.filePath(context)))
    } catch (error) {
      if (isNotFound(error)) return undefined
      throw error
    }
  }

  async save(handoff: DurableCompletionHandoff): Promise<void> {
    const record = clone(handoff)
    const write = this.writeQueue.then(() => this.write(record)).then(() => undefined)
    this.writeQueue = write.catch(() => undefined)
    return write
  }

  async update(
    context: TrustedToolCompletionContext,
    updater: (current: DurableCompletionHandoff | undefined) => DurableCompletionHandoff | undefined
  ): Promise<DurableCompletionHandoff | undefined> {
    let result: DurableCompletionHandoff | undefined
    const operation = this.writeQueue.then(async () => {
      const current = await this.read(context)
      const editable = current ? clone(current) : undefined
      const next = updater(editable)
      if (next) {
        if (next === editable) {
          result = clone(next)
        } else {
          result = clone(await this.write(next))
        }
      }
    })
    this.writeQueue = operation.catch(() => undefined)
    await operation
    return result
  }

  async remove(context: TrustedToolCompletionContext): Promise<void> {
    const operation = this.writeQueue.then(() => rm(this.filePath(context), { force: true }))
    this.writeQueue = operation.catch(() => undefined)
    await operation
  }

  private async write(handoff: DurableCompletionHandoff): Promise<DurableCompletionHandoff> {
    await mkdir(this.handoffsDir, { recursive: true })
    const committed = { ...handoff, commitOrder: await this.nextCommitOrder() }
    const destination = this.filePath(committed.context)
    const temporary = `${destination}.${this.writeSequence++}.tmp`
    await writeFile(temporary, serialize(committed))
    await rename(temporary, destination)
    return committed
  }

  private async nextCommitOrder(): Promise<number> {
    if (this.commitSequence === undefined) {
      let names: string[] = []
      try {
        names = await readdir(this.handoffsDir)
      } catch (error) {
        if (!isNotFound(error)) throw error
      }
      const records = await Promise.all(
        names
          .filter((name) => name.endsWith('.bin'))
          .map(async (name) => parseHandoff(await readFile(join(this.handoffsDir, name))))
      )
      this.commitSequence = records.reduce(
        (maximum, record) => Math.max(maximum, record.commitOrder ?? 0),
        0
      )
    }
    this.commitSequence += 1
    return this.commitSequence
  }

  async list(): Promise<DurableCompletionHandoff[]> {
    await this.writeQueue
    let names: string[]
    try {
      names = await readdir(this.handoffsDir)
    } catch (error) {
      if (isNotFound(error)) return []
      throw error
    }
    return Promise.all(
      names
        .filter((name) => name.endsWith('.bin'))
        .map(async (name) => parseHandoff(await readFile(join(this.handoffsDir, name))))
    )
  }

  private get handoffsDir(): string {
    return join(this.storageDir, 'completion-handoffs')
  }

  private filePath(context: TrustedToolCompletionContext): string {
    return join(
      this.handoffsDir,
      `${Buffer.from(completionHandoffKey(context)).toString('b
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3312** (2026-10-06): **fix(ci-regression): stabilize nightly and Windows test checks**
  *Symptoms*: ## Problem  Refs #3308 and #3311.  Nightly compares the redesigned empty conversation from #3297 against an older screenshot. Windows Full Test also fails on Playwright JSON paths using forward slashes, a one-second polling budget around real fixture startup I/O, and two PDF-note round trips exceeding their 60-second test budget.  ## Proposed change  - Refresh only `workspace-empty-darwin.png` from the reviewed canonical macOS CI capture. Retain screenshot thresholds and every other baseline. - Normalize reported collection/artifact paths with Node's `resolve` before comparison. - Give the mocked Windows process query a bounded ten-second startup wait. Retain survivor detection, the simulated ten-second process-exit deadline, and all taskkill-success/failure cases. - Use the existing 120-second Windows budget for the PDF opt-in/forward/fork/receipt journey; retain 60 seconds on other platforms.  ## Scope and non-goals  Only three existing test files and one screenshot baseline change. No application logic, dependency, workflow, module ownership, consumer relationship, historical-data compatibility, state/enum value, or persisted-format changes.  ## Acceptance criteria and validation  All listed checks run after the last material edit. Local verification uses focused checks; complete portable verification is delegated to PR CI as requested.  | Behavior | Project-owned check | Result | | --- | --- | --- | | Desktop baseline matches current application | `npm run build:e2e`, the
  **Post-Mortem & Fix Analysis**:
  > <!-- ai-review:codex --> <!-- ai-review-meta head=96f85c2f3e9846e065b3c197985e7a8194f42a50 run=37394646112 --> ## Codex Review  **Verdict: mergeable**  **No actionable findings.**  **Summary:** Static inspection found no concrete merge-blocking defects in the pull request changes.

- **Issue #3307** (2026-10-05): **fix(window-layout): exclude titlebar from portaled surfaces**
  *Symptoms*: ## Problem  The Windows application menu is a fixed 36px titlebar above the renderer content. Portaled surfaces were still positioned against the full browser viewport, so the maximized Settings surface was hidden under the titlebar and centered dialogs were shifted upward.  ## Proposed change  - Add titlebar-aware viewport CSS variables with a zero-height fallback on non-Windows surfaces. - Position shared portaled dialog panels against the content viewport center and available height. - Exclude the titlebar from Settings normal/maximized geometry and the Settings/Workspace mobile navigation drawers. - Keep scrims full-window so modal coverage remains unchanged. - Update Settings layout regression assertions.  ## Scope and non-goals  This is a renderer layout correction only. It does not change persisted data, historical compatibility, enums, IPC contracts, or application state. Non-Windows geometry retains the previous viewport behavior through the zero-height fallback.  ## Acceptance criteria and validation  - Maximized Settings starts below the Windows titlebar and retains the desktop inset. - Standard portaled dialogs use the content viewport center and max height. - Mobile Settings and Workspace navigation drawers stop below the titlebar. - Focused renderer tests: 5 files, 346 tests passed. - WindowsTitleBar contract tests: 14 passed. - renderer_assets module: 8 tests passed. - Web typecheck, ESLint, ownership guards (44 tests), and diff checks passed. - `test:affected:
  **Post-Mortem & Fix Analysis**:
  > <!-- ai-review:codex --> <!-- ai-review-meta head=47e4b05cd26a3d0f8b0a4a4c7e1fc5163707ff9f run=37384471028 --> ## Codex Review  **Verdict: mergeable**  **No actionable findings.**  **Summary:** No concrete merge-blocking defects found in the reviewed changes.

- **Issue #3306** (2026-10-05): **fix(composer): preserve context across session binding**
  *Symptoms*: ## Problem  Discussion and Reading used different composer headers. Sending from a new conversation temporarily removed these headers when the pending Session was replaced by its durable ID, before runtime context reached the renderer. Automatic Reading showed only a count and continued saying “will be linked when sent” after submission.  ## Proposed change  Retain a renderer-only projection of the submitted context, associate it with the actual prompt message, and replace it when runtime context arrives. Keep the projection scoped to that prompt and project so navigation cannot show it in unrelated Sessions. Capture the projection only for accepted first sends; failed sends restore their own draft.  Use the no-session fallback only before the projection is bound to its prompt, so a fresh New Conversation cannot inherit it. Once the matching Session is bound, an absent/empty immutable prompt PDF snapshot resolves Reading for candidates such as single-page PDFs that deliberately remain attachments. Nonempty prompt PDF snapshots retain the transition display while runtime bindings arrive. Discussion settles independently.  Place Discussion and Reading in one header outside scrolling annotation cards. Automatic Reading uses PDF filename chips, “Link on send” before submission, and a spinner with “Linking PDFs…” while admission is pending. Translate the new status text in all eight locales.  ## Acceptance criteria and validation  Presentation checks before the admission review fi
  **Post-Mortem & Fix Analysis**:
  > <!-- ai-review:codex --> <!-- ai-review-meta head=435ff92171cf2fdb0eb6a93052a878e2be5afb7f run=37325939217 --> ## Codex Review  **Verdict: needs changes**  ### [P2] Replay annotations lose Side chat transfer controls  **src/renderer/src/pages/workspace/ConversationPanel.tsx:2154**  **Impact:** The new header renders replay annotations outside AnnotationTransferSource, so their drag handlers and “Move to Side chat” context-menu actions have no transfer context and no longer work.  **Recommendation:** Place the header and ordinary annotation cards under one AnnotationTransferSource provider, or otherwise provide the transfer context to the header cards.  ### [P2] Admission projection leaks into a fresh New Conversation  **src/renderer/src/pages/workspace/workspace-composer-controller.ts:1598**  **Impact:** After a new-conversation send is admitted, selecting New Conversation leaves activeSession undefined while retaining the stable new:<project> draft key. The fallback therefore displays
  > Addressed the context-isolation finding: the no-session projection fallback now applies only before the submitted prompt has a message ID. Opening a fresh New Conversation after admission no longer inherits the previous Discussion or Reading state.  The independent worktree review also identified a successful-send edge case for single-page PDFs, which the existing runtime intentionally leaves as attachments. The composer now treats a bound prompt's absent/empty PDF snapshot as a completed Reading result. Nonempty prompt snapshots continue preserving Reading until runtime bindings arrive, while Discussion settles independently. This uses existing session/message fields; it adds no state, persistence, or protocol changes.  I did not adopt the Side chat transfer suggestion. At the PR base (`0020e2766`), replay Discussion already rendered `SessionDiscussionBar` directly without `DraggableAnnotationCard`, `AnnotationMoveTarget`, or `useAnnotationDrag`. Only ordinary annotation cards had tho
  > <!-- ai-review:codex --> <!-- ai-review-meta head=e9ba13e6e50a6b5912f32a1ce4a4d340e2c199c8 run=37331376444 --> ## Codex Review  **Verdict: mergeable**  **No actionable findings.**  **Summary:** Static inspection found no concrete merge-blocking defects introduced by this pull request.

- **Issue #3305** (2026-10-05): **fix(ci-regression): stabilize native navigation and preview checks**
  *Symptoms*: ## Problem  Refs #3298 and #3299. Scheduled regression runs fail on a zoomed HTTPS preview menu, Windows narrow-screen project switching, and a second Session's response during package export.  ## Proposed change  - Place the mobile Workspace navigation below the existing Windows titlebar height; the zero-height fullscreen value and non-Windows fallback continue to work. - Measure preview menu placement against the actual DOM context-menu click rather than guest bounds captured before resize/zoom settles. Keep the 5px precision assertion, real right-click, nested-frame and passthrough coverage. - Use the existing 60s Session-preparation budget for package journeys and check the real Cancel run control for completion. - Include all three journeys in PR mainline coverage and update the discovery guard counts; check narrow navigation at 100% and 125% zoom. - Retry removal of the owned Windows observer fixture with built-in `fs.rm` options (5 retries, 200ms linear backoff), matching existing smoke-test cleanup. The first PR run exposed `EBUSY` after both observed processes exited. [Node 24 documents the supported retry behavior](https://nodejs.org/docs/latest-v24.x/api/fs.html#fspromisesrmpath-options).  ## Acceptance criteria and validation  The checks below ran after the last material edit to their covered implementation; the CI guard/cleanup checks ran after the final follow-up edit:  | Behavior | Project-owned check | Result | | --- | --- | --- | | Package export with a concu
  **Post-Mortem & Fix Analysis**:
  > <!-- ai-review:codex --> <!-- ai-review-meta head=718dbf58141b835b07d2fa17d1408ca1725a26e3 run=37320266510 --> ## Codex Review  **Verdict: mergeable**  **No actionable findings.**  **Summary:** No concrete merge-blocking defects found in the pull request changes.
  > <!-- ai-review:codex --> <!-- ai-review-meta head=757153fba05f2af932cec8ca2938dd5c99169955 run=37323724005 --> ## Codex Review  **Verdict: mergeable**  **No actionable findings.**  **Summary:** No concrete merge-blocking defects found in the requested changes after static inspection of the diff, callers, tests, configuration, and title-bar/sidebar integration.

- **Issue #3301** (2026-10-05): **fix(workspace): align side chat composer and reading icons**
  *Symptoms*: ## Problem  Side chat uses a flush footer and inherits the shared textarea's focus ring, unlike the main composer. Reading PDF chips lack a file icon, and the main-session navigation button looks like another chat action.  ## Proposed change  - Match the main composer's rounded neutral shell, inset spacing, text sizing and caret-only editor focus, including keyboard focus and preview-tab switches. Preserve focus indicators on buttons. - Add the existing PDF file-type icon before each Reading filename, retaining extension-preserving truncation and separate open/remove controls. - Use `LocateFixed` for the Side chat header's View main session action.  No new dependencies, user-visible strings, state/enums, persisted data or historical compatibility changes. Session navigation, draft ownership, sending and annotation behavior are unchanged.  ## Acceptance criteria and validation  Final product edits are covered by the following checks; final focused tests, browser tests, lint and web typecheck were rerun after the last test edit:  | Behavior | Command | Result | | --- | --- | --- | | Reading icons/open/remove; main-session navigation and draft preservation; translation guards | `npx vitest run src/renderer/src/pages/workspace/ConversationPanel.interaction.test.tsx src/renderer/src/pages/workspace/PreviewPanel.test.tsx src/renderer/src/i18n/resources.test.ts` | 1,098 passed | | Light/dark focus, Tab traversal, tab switches, full screen, narrow layouts and close protection | `npm 
  **Post-Mortem & Fix Analysis**:
  > <!-- ai-review:codex --> <!-- ai-review-meta head=f697616ad8486e9d6b1fac9b7c59296504b31547 run=37254149636 --> ## Codex Review  **Verdict: mergeable**  **No actionable findings.**  **Summary:** Static inspection found no concrete merge-blocking defect introduced by this pull request. No project tooling was run.

- **Issue #3296** (2026-10-05): **fix(notebook): project cross-language file lineage**
  *Symptoms*: ## Problem The notebook analyzer already tracked Python/R name dependencies, but it discarded the static file reads and writes produced while analyzing each run. A cross-language consumer could therefore read a file generated by another kernel without any dependency edge in the projection, and an Agent-authored lineage manifest could not be checked against observed workspace generations.  ## What changed - Persist optional `fileAccess` evidence in the dependency-analysis sidecar, including complete/partial/unavailable states, normalized reads/writes, reason codes, write scopes, and the existing extraction context needed for future analysis. - Derive `fileDependenciesByRunId` from complete source-file analysis plus observed `workingFiles`. Edges carry producer run, path, generation, checksum, and `verified`/`advisory` confidence; Agent-emitted semantic IDs are not trusted as lineage. - Resolve relative source paths against the run's captured cwd and session `data/` namespace. Reuse the existing directory/shapefile/GeoTIFF/timestamped-log scope matcher for companion generations. - Withhold a path after an observed created/modified generation from a partial write analysis, removing stale producer mappings until a complete generation is available. - Thread file dependencies into artifact provenance as advisory `depends-on` edges, keeping replay conservative when runtime read evidence is incomplete. - Include file evidence and observed generation identity in incremental projection
  **Post-Mortem & Fix Analysis**:
  > <!-- ai-review:codex --> <!-- ai-review-meta head=e31e0a308fec88c5054312aa2d79043dc88aa548 run=37209322087 --> ## Codex Review  **Verdict: needs changes**  ### [P1] Lineage fixture is never run through the lineage pipeline  **src/main/notebook/dependency-analysis.science-lineage.test.ts:51**  **Impact:** Cross-cell lineage, edge identity, and withholding regressions can pass because only independent per-cell analysis is exercised; lineage assertions merely verify fixture literals.  **Recommendation:** Build run records and invoke the notebook analyzer/projection, then assert generated dependencies and lineage outcomes.  ### [P2] File-access assertions allow incorrect extra results  **src/main/notebook/dependency-analysis.science-lineage.test.ts:58**  **Impact:** Unexpected reads/writes or partial analysis states can introduce false dependencies without failing this test.  **Recommendation:** Compare normalized complete read/write arrays exactly and assert the expected analysis states. 
  > <!-- ai-review:codex --> <!-- ai-review-meta head=346c8fb92a71413efab537e71638bef64f8f0283 run=37213469246 --> ## Codex Review  **Verdict: needs changes**  ### [P1] Persist normalized file-access analysis instead of raw extraction  **src/main/notebook/dependency-analysis.ts:2156**  **Impact:** `fileAccess` is returned by `analyzePythonFileAccesses`/`analyzeRFileAccesses` as an extraction without `readState`, `writeState`, `externalState`, or `reasonCodes`, but the sidecar field requires `NotebookSourceFileAccessAnalysis`. This causes a typecheck failure; if bypassed, lineage projection never sees `readState === 'complete'`.  **Recommendation:** Convert the extraction to the normalized analysis shape before persisting, or call the shared source-file-access analysis wrapper.  ### [P1] Normalize analysis paths to the session-root namespace  **src/main/notebook/dependency-projection.ts:1948**  **Impact:** Analyzer paths are relative to the execution working directory (for example `outputs/
  > Addressed both review points:  - The fixture test now builds four completed `NotebookRunRecord`s with observed `workingFiles`, invokes `NotebookDependencyAnalyzer.project`, and asserts the generated cross-language file dependencies, producer identity, and verified confidence. This exercises the projection path rather than only validating fixture literals. - Source-file assertions now require complete read/write states and exact normalized read/write arrays. The Iris producer's self-read is recorded explicitly; the projection still suppresses same-run self edges and only emits cross-run dependencies. 

- **Issue #3295** (2026-10-04): **fix(artifact-finalization): retry expired Prisma transactions**
  *Symptoms*: ## Problem Artifact durable finalization can fail with Prisma `P2028` when an interactive transaction is expired or refers to a closed transaction. The failure occurs while reading finalized artifact versions, so compatibility publication and the artifact emit follow-up also fail.  ## Proposed change Wrap the existing durable finalization and activation transactions in a bounded one-time retry for `P2028`, using the existing repository precedent and a `10s` transaction admission budget. The retried callback contains only fenced database work; external file publication remains after the transaction succeeds.  ## Scope and non-goals - No database, schema, enum, data-model, or renderer interaction changes. - No new persistence fields or historical migration. - Non-`P2028` errors continue to fail unchanged. - This does not change artifact provenance ownership or validation rules.  ## Acceptance criteria and validation - Regression test fails on the pre-fix code with the injected `P2028` and passes after the fix. - `npx vitest run src/main/artifacts/provenance-lifecycle-contract.test.ts` — 14/14 passed. - `npx vitest run src/main/artifacts/provenance-write-contract.test.ts` — 25/25 passed. - `npx vitest run src/main/artifacts/ipc.test.ts` — 50/50 passed. - `npm run typecheck:node` — passed. - `node scripts/ci/audit-module-ownership.mjs` — passed.  All checks ran after the last material edit. No full `npm run test` was run; module-focused checks were used as requested.  ## Review f
  **Post-Mortem & Fix Analysis**:
  > <!-- ai-review:codex --> <!-- ai-review-meta head=49c21184a3ef161c4ace62591fc4cc2f824b4d20 run=37208814633 --> ## Codex Review  **Verdict: mergeable**  **No actionable findings.**  **Summary:** Static inspection found no concrete merge-blocking defects. Branch and pull request title checks are valid.

- **Issue #3294** (2026-10-04): **fix(notebook-recovery): isolate corrupt run documents**
  *Symptoms*: ## Problem A corrupt Notebook `run.json` causes startup recovery to reject the entire recovery pass. The settings runtime check then reports `Notebook document is corrupt`, and unrelated usable Notebook runs are blocked behind the damaged document.  ## Proposed change Isolate `CorruptNotebookDocumentError` while recovering each Notebook lane. Log the document as corrupt and continue recovering other lanes. Preserve the corrupt document for manual recovery; unsupported document versions still fail closed.  ## Scope and non-goals - No database, schema, enum, data-model, or renderer interaction changes. - No automatic deletion, rewrite, or migration of historical corrupt files. - The affected corrupt run remains unavailable until repaired separately.  ## Acceptance criteria and validation - Regression test fails on the pre-fix code with `Notebook document is corrupt` and passes after the fix. - `npx vitest run src/main/notebook/repository.test.ts` — 42/42 passed. - `npx vitest run src/main/notebook/network-sandbox-owner.test.ts` — 113/113 passed. - `npm run typecheck:node` — passed. - `node scripts/ci/audit-module-ownership.mjs` — passed. - Module impact checks — 44/44 passed.  All checks ran after the last material edit. No full `npm run test` was run; module-focused checks were used as requested.  ## Review focus Verify that only corrupt documents are isolated, that other recovery errors still propagate, and that the original corrupt file is retained unchanged.  ## Verificatio
  **Post-Mortem & Fix Analysis**:
  > <!-- ai-review:codex --> <!-- ai-review-meta head=f596e71c78a5895946e454b288766c6df84828a7 run=37208738751 --> ## Codex Review  **Verdict: mergeable**  **No actionable findings.**  **Summary:** No concrete merge-blocking defects found in the reviewed changes. Branch and pull request title validation both passed.

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

### Incident Patch 1: `7ce58c5c` (2026-10-06)
**Commit Message**: fix(ci-regression): stabilize nightly and Windows test checks (#3312)

**File**: `scripts/electron-fixture-teardown.test.ts` (modified, +6/-2)
```diff
@@ -327,7 +327,9 @@ it.each(
     const assertion = succeeds
       ? expect(operation).resolves.toBeUndefined()
       : expect(operation).rejects.toThrow('crash simulation did not reap')
-    await vi.waitFor(() => expect(boundary.processTable).toHaveBeenCalled())
+    // Startup creates real files before the mocked process query; allow hosted Windows I/O
+    // to finish while keeping the simulated process-exit deadline at ten seconds.
+    await vi.waitFor(() => expect(boundary.processTable).toHaveBeenCalled(), { timeout: 10_000 })
     await vi.advanceTimersByTimeAsync(10_000)
     await assertion
     expect(boundary.launch).toHaveBeenCalledTimes(succeeds ? 2 : 1)
@@ -358,7 +360,9 @@ it.each([true, false])(
       },
       { status: 'passed', expectedStatus: 'passed', attach }
     )
-    await vi.waitFor(() => expect(boundary.processTable).toHaveBeenCalled())
+    // Startup creates real files before the mocked process query; allow hosted Windows I/O
+    // to finish while keeping the simulated process-exit deadline at ten seconds.
+    await vi.waitFor(() => expect(boundary.processTable).toHaveBeenCalled(), { timeout: 10_000 })
     expect(boundary.launch).toHaveBeenCalledOnce()
     await vi.advanceTimersByTimeAsync(500)
     expect(boundary.launch).toHaveBeenCalledOnce()
```

**File**: `src/main/session-package/service.test.ts` (modified, +3/-1)
```diff
@@ -4660,5 +4660,7 @@ it.each(['upload', 'artifact'] as const)(
       await Promise.all([exporter.close(), importer.close()])
     }
   },
-  60_000
+  // This opt-in/forward/fork/receipt journey performs several real validation-database imports.
+  // Match the other multi-import tests' hosted Windows I/O budget without relaxing other tests.
+  process.platform === 'win32' ? 120_000 : 60_000
 )
```

**File**: `test/config/playwright.config.test.ts` (modified, +2/-2)
```diff
@@ -183,8 +183,8 @@ it.each([
     expect(report.errors).toEqual([])
     expect(report.suites.length).toBeGreaterThan(0)
     for (const project of report.config.projects) {
-      expect(project.testDir).toBe(resolve(testDir))
-      expect(project.outputDir).toBe(resolve(outputDir))
+      expect(resolve(project.testDir)).toBe(resolve(testDir))
+      expect(resolve(project.outputDir)).toBe(resolve(outputDir))
     }
     if (config.includes('browser')) {
       expect(report.config.webServer).toMatchObject({ cwd: process.cwd() })
```

---

### Incident Patch 2: `65ae3f6c` (2026-10-05)
**Commit Message**: fix(window-layout): exclude titlebar from portaled surfaces (#3307)

**File**: `src/renderer/src/assets/main.css` (modified, +9/-0)
```diff
@@ -13,6 +13,10 @@
    variables reserve the actual system caption controls, including DPI and interface zoom. */
 html[data-windows-titlebar] {
   --windows-titlebar-height: 36px;
+  --windows-content-center-y: calc(
+    var(--windows-titlebar-height) + (100vh - var(--windows-titlebar-height)) / 2
+  );
+  --windows-content-max-height: calc(100svh - var(--windows-titlebar-height) - 2rem);
 }
 
 html[data-windows-titlebar='fullscreen'] {
@@ -362,6 +366,11 @@ html[data-windows-titlebar] .windows-app-content :is(.min-h-svh, .min-h-screen)
 :root {
   color-scheme: light;
   --radius: 0.5rem;
+  /* Portaled surfaces are positioned against the browser viewport rather than the content
+     wrapper. Keep a zero-height default so the same geometry works on non-Windows surfaces. */
+  --windows-titlebar-height: 0px;
+  --windows-content-center-y: 50vh;
+  --windows-content-max-height: calc(100svh - 2rem);
   /* Light-theme elevation (referenced by the shadow-* utilities via @theme inline). */
   --shadow-card-value: 0 0 0 1px rgb(10 10 10 / 0.06), 0 4px 24px rgb(10 10 10 / 0.04);
   --shadow-card-opaque-value: 0 0 0 1px rgb(10 10 10 / 0.08), 0 8px 28px rgb(10 10 10 / 0.1);
```

**File**: `src/renderer/src/components/ui/dialog-chrome.ts` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@ const dialogOverlayClassName =
 
 const dialogPanelClassName = (...className: Array<string | false | null | undefined>): string =>
   cn(
-    'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 max-h-[calc(100svh-2rem)] overflow-y-auto rounded-xl border border-border bg-card p-5 text-foreground shadow-dialog outline-none data-[state=closed]:pointer-events-none data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:fill-mode-forwards motion-reduce:data-[state=closed]:animate-none motion-reduce:data-[state=open]:animate-none',
+    'fixed left-1/2 top-[var(--windows-content-center-y)] z-50 -translate-x-1/2 -translate-y-1/2 max-h-[var(--windows-content-max-height)] overflow-y-auto rounded-xl border border-border bg-card p-5 text-foreground shadow-dialog outline-none data-[state=closed]:pointer-events-none data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:fill-mode-forwards motion-reduce:data-[state=closed]:animate-none motion-reduce:data-[state=open]:animate-none',
     ...className
   )
 
```

**File**: `src/renderer/src/pages/settings/SettingsPage.render.test.tsx` (modified, +3/-2)
```diff
@@ -1835,7 +1835,7 @@ describe('SettingsPage layout', () => {
     const nav = document.body.querySelector<HTMLElement>('nav[aria-label="Settings"]')
     expect(nav?.getAttribute('aria-hidden')).toBe('true')
     expect(document.body.querySelector('[data-slot="settings-surface"]')?.className).toContain(
-      'h-[100dvh]'
+      'h-[calc(100dvh-var(--windows-titlebar-height))]'
     )
 
     await act(async () => {
@@ -5179,7 +5179,8 @@ describe('SettingsPage layout', () => {
     expect(document.body.querySelector('[aria-label="Restore"]')).not.toBeNull()
     expect(document.body.querySelector('[aria-label="Maximize"]')).toBeNull()
     const dialog = document.body.querySelector<HTMLElement>('[data-slot="settings-surface"]')
-    expect(dialog?.className).toContain('inset-4')
+    expect(dialog?.className).toContain('md:top-[calc(var(--windows-titlebar-height)+1rem)]')
+    expect(dialog?.className).toContain('md:bottom-4')
     expect(dialog?.className).not.toContain('h-[80vh]')
     expect(dialog?.className).not.toContain('w-[80vw]')
   })
```

**File**: `src/renderer/src/pages/settings/SettingsPage.tsx` (modified, +3/-3)
```diff
@@ -1438,8 +1438,8 @@ const SettingsPage = forwardRef<SettingsPageHandle, SettingsPageProps>(function
             className={cn(
               'pointer-events-auto fixed z-50 flex overflow-hidden overscroll-contain rounded-xl border border-border bg-card text-foreground shadow-dialog outline-none data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:fill-mode-forwards motion-reduce:data-[state=closed]:animate-none motion-reduce:data-[state=open]:animate-none',
               isExpanded
-                ? 'inset-0 rounded-none md:inset-4 md:rounded-xl'
-                : 'inset-0 h-[100dvh] w-screen rounded-none md:bottom-auto md:left-1/2 md:right-auto md:top-1/2 md:h-[min(688px,calc(100vh-2rem))] md:w-[min(960px,calc(100vw-2rem))] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl'
+                ? 'inset-x-0 bottom-0 top-[var(--windows-titlebar-height)] rounded-none md:bottom-4 md:left-4 md:right-4 md:top-[calc(var(--windows-titlebar-height)+1rem)] md:rounded-xl'
+                : 'inset-x-0 bottom-0 top-[var(--windows-titlebar-height)] h-[calc(100dvh-var(--windows-titlebar-height))] w-screen rounded-none md:bottom-auto md:left-1/2 md:right-auto md:top-[var(--windows-content-center-y)] md:h-[min(688px,var(--windows-content-max-height))] md:w-[min(960px,calc(100vw-2rem))] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl'
             )}
           >
             {/* Radix requires a Title/Description for a11y; the visible panel title lives in the header. */}
@@ -1483,7 +1483,7 @@ const SettingsPage = forwardRef<SettingsPageHandle, SettingsPageProps>(function
                   aria-hidden={isMobile && !isMobileNavOpen ? true : undefined}
                   inert={isMobile && !isMobileNavOpen ? true : undefined}
                   className={cn(
-                    'fixed inset-y-0 left-0 z-[70] flex min-h-0 w-[min(86vw,320px)] shrink-0 flex-col overflow-hidden border-r border-border bg-background transition-transform duration-200 ease-out md:static md:z-auto md:w-48 md:translate-x-0',
+                    'fixed bottom-0 left-0 top-[var(--windows-titlebar-height)] z-[70] flex min-h-0 w-[min(86vw,320px)] shrink-0 flex-col overflow-hidden border-r border-border bg-background transition-transform duration-200 ease-out md:static md:z-auto md:w-48 md:translate-x-0',
                     isMobileNavOpen ? 'translate-x-0' : '-translate-x-full'
                   )}
                 >
```

---

### Incident Patch 3: `14649521` (2026-10-05)
**Commit Message**: fix(composer): preserve context across session binding (#3306)

* fix(composer): preserve context during session admission

* fix(composer): retain context through session binding

Track first-send context by the submitted prompt rather than the temporary Session ID. Preserve automatic PDF names until runtime context arrives, and keep Discussion and Reading in one composer header.

* fix(composer): settle excluded reading context after binding

**File**: `e2e/workspace-files.spec.ts` (modified, +3/-3)
```diff
@@ -241,9 +241,9 @@ test('links a multi-page PDF upload as Reading context in a new project @pr-main
     mimeType: 'application/pdf',
     buffer: createTwoPagePdf()
   })
-  await expect(page.getByTestId('automatic-reading-suggestion')).toContainText(
-    '1 PDF will be linked when sent'
-  )
+  const readingSuggestion = page.getByTestId('automatic-reading-suggestion')
+  await expect(readingSuggestion).toContainText('paper.pdf')
+  await expect(readingSuggestion.getByRole('status')).toHaveText('Link on send')
 
   await expect(page.getByTestId('new-conversation-start')).toBeVisible()
   await captureChinese('pdf-staged-new-conversation.png')
```

**File**: `src/renderer/src/pages/workspace/ConversationPanel.interaction.test.tsx` (modified, +75/-2)
```diff
@@ -17,6 +17,7 @@ vi.mock('@/lib/session-fork', () => ({
 }))
 
 import { ConversationPanel } from './ConversationPanel'
+import { createSessionDiscussionAnnotation } from './session-discussion-annotation'
 import { SessionPromptPreparationOwner } from '../../../../main/session-persistence/prompt-preparation-owner'
 import { recordRestartTurnOutcome } from '../../../../main/session-persistence/turn-outcome-authority'
 import {
@@ -669,6 +670,7 @@ const createPanelDefaults = (): PanelProps => ({
         bindings: [],
         pendingBindingId: undefined,
         isPending: false,
+        automaticAttachments: [],
         automaticAttachmentCount: 0
       }
     },
@@ -1672,7 +1674,10 @@ describe('ConversationPanel composer intake', () => {
               size: 42
             }
           ],
-          readingContext: { automaticAttachmentCount: 1 }
+          readingContext: {
+            automaticAttachmentCount: 1,
+            automaticAttachments: [{ id: 'upload-1', name: 'paper.pdf' }]
+          }
         },
         actions: { dismissAutomaticReading }
       }
@@ -1682,6 +1687,8 @@ describe('ConversationPanel composer intake', () => {
     expect(suggestion?.textContent).toContain('Reading')
     expect(suggestion?.querySelector('svg.lucide-book-open[aria-hidden="true"]')).not.toBeNull()
     expect(suggestion?.textContent).toContain('1 PDF will be linked when sent')
+    expect(suggestion?.textContent).toContain('paper.pdf')
+    expect(suggestion?.querySelector('[role="status"]')?.textContent).toBe('Link on send')
     expect(container.textContent).toContain('paper.pdf')
 
     act(() =>
@@ -1691,6 +1698,29 @@ describe('ConversationPanel composer intake', () => {
     expect(container.textContent).toContain('paper.pdf')
   })
 
+  it('keeps the automatic PDF name and a linking status after submitted attachments leave the draft', () => {
+    renderPanel({
+      composer: {
+        view: {
+          attachments: [],
+          readingContext: {
+            automaticAttachmentCount: 1,
+            automaticAttachments: [{ id: 'upload', name: 'paper.pdf' }],
+            isPending: true
+          }
+        }
+      }
+    })
+    const suggestion = container.querySelector('[data-testid="automatic-reading-suggestion"]')!
+    expect(suggestion.textContent).toContain('paper.pdf')
+    expect(suggestion.querySelector('[role="status"]')?.textContent).toBe('Linking PDFs…')
+    expect(suggestion.querySelector('[role="status"] .lucide-loader-circle')).not.toBeNull()
+    expect(
+      suggestion.querySelector<HTMLButtonElement>('[aria-label="Keep as attachments"]')?.disabled
+    ).toBe(true)
+    expect(suggestion.textContent).not.toContain('will be linked when sent')
+  })
+
   it('shows automatic Reading follow-ups alongside linked PDF context', () => {
     const dismissAutomaticReading = vi.fn()
     renderPanel({
@@ -1724,6 +1754,7 @@ describe('ConversationPanel composer intake', () => {
                 linkedAt: 1
               }
             ],
+            automaticAttachments: [{ id: 'upload-2', name: 'second.pdf' }],
             automaticAttachmentCount: 1
           }
         },
@@ -1740,6 +1771,46 @@ describe('ConversationPanel composer intake', () => {
     expect(dismissAutomaticReading).toHaveBeenCalledOnce()
   })
 
+  it('places Discussion and Reading in one header outside the scrolling annotation list', () => {
+    const discussion = createSessionDiscussionAnnotation({
+      projectId: 'project',
+      sourceSessionId: 'source',
+      sourceTitle: 'Study',
+      fingerprint: 'fp',
+      branchId: 'main',
+      stepId: 'step',
+      stepOffsetMs: 0,
+      excerpt: '',
+      evidence: [{ kind: 'message', id: 'step', projectId: 'project', sessionId: 'source' }]
+    })!
+    renderPanel({
+      composer: {
+        view: {
+          annotations: [
+            discussion,
+            {
+              id: 'ordinary',
+              kind: 'text',
+              target: 'agent',
+              quote: 'An ordinary annotation',
+              source: { kind: 'agent-message', sessionId: 'source', messageId: 'step' }
+            }
+          ],
+          readingContext: {
+            bindings: [{ bindingId: 'paper', name: 'paper.pdf', draftSelection: true }]
+          }
+        }
+      }
+    })
+    const header = container.querySelector('[data-testid="composer-context-header"]')!
+    expect(header.querySelector('[data-testid="session-discussion-draft"]')).not.toBeNull()
+    expect(header.querySelector('[data-testid="pdf-context-bar"]')).not.toBeNull()
+    const list = container.querySelector('[data-testid="annotation-draft-list"]')!
+    expect(list.textContent).toContain('An ordinary annotation')
+    expect(header.contains(list)).toBe(false)
+    expect(header.textContent).not.toContain('An ordinary annotation')
+  })
+
   it('shows linked PDF context as a single-line chip that opens its preview', () => {
     const open = vi.fn()
     const unlink = vi
```

**File**: `src/renderer/src/pages/workspace/ConversationPanel.tsx` (modified, +241/-164)
```diff
@@ -1,5 +1,6 @@
 import { replayAnnotationTarget } from '../../../../shared/replay-reference'
 import { SessionDiscussionSource } from './SessionDiscussionSource'
+import { composerContextRowClassName } from './SessionDiscussionBar'
 import { SessionDiscussionButton } from './SessionDiscussionButton'
 import { createSessionReplayItem } from './workspace-session-actions'
 import { forkSession, sessionForkAvailable } from '@/lib/session-fork'
@@ -2142,192 +2143,266 @@ const ConversationPanel = ({
                             aria-hidden="true"
                           />
                         ) : null}
-                        {activeSession &&
-                        !annotations.some((annotation) => replayAnnotationTarget(annotation)) ? (
-                          <SessionDiscussionSource
-                            key={activeSession.id}
-                            projectId={activeSession.projectId}
-                            sessionId={activeSession.id}
-                            context={activeSession.runtimeContext}
-                          />
-                        ) : null}
-                        {pdfContext.bindings.length > 0 ? (
+                        {annotations.some((annotation) => replayAnnotationTarget(annotation)) ||
+                        activeSession?.runtimeContext?.sessionContext?.bindings.length ||
+                        pdfContext.bindings.length > 0 ||
+                        pdfContext.automaticAttachmentCount > 0 ? (
                           <div
-                            data-testid="pdf-context-bar"
-                            className="-mx-3 -mt-2 flex min-h-9 items-center gap-1 rounded-t-2xl border-b border-border-200 bg-bg-10 px-2 py-1"
+                            className="-mx-3 -mt-2 overflow-hidden rounded-t-2xl"
+                            data-testid="composer-context-header"
                           >
-                            {activeSession ? (
-                              <ReadingContextPicker
+                            <AnnotationDraftCards
+                              annotations={annotations.filter((annotation) =>
+                                replayAnnotationTarget(annotation)
+                              )}
+                              disabled={!canEditDraft || pdfContext.isPending}
+                              onReveal={requestAnnotationReveal}
+                              onUpdateNote={onUpdateAnnotationNote}
+                              onRemove={onRemoveAnnotation}
+                            />
+                            {activeSession &&
+                            !annotations.some((annotation) =>
+                              replayAnnotationTarget(annotation)
+                            ) ? (
+                              <SessionDiscussionSource
+                                key={activeSession.id}
                                 projectId={activeSession.projectId}
-                                linkedSources={pdfContext.bindings.flatMap((binding) =>
-                                  'sourceKind' in binding
-                                    ? [
-                                        {
-                                          sourceKind: binding.sourceKind,
-                                          sourceFileId: binding.sourceFileId,
-                                          sourceVersionId: binding.sourceVersionId
-                                        }
-                                      ]
-                                    : []
+                                sessionId={activeSession.id}
+                                context={activeSession.runtimeContext}
+                              />
+                            ) : null}
+                            {pdfContext.bindings.length > 0 ? (
+                              <div
+                                data-testid="pdf-context-bar"
+                                className={composerContextRowClassName}
+                              >
+                                {activeSession ? (
+                                  <ReadingContextPicker
+                                    projectId={activeSession.projectId}
+                                    linkedSources={pdfContext.bindings.flatMap((binding) =>
+                                      'sourceKind' in binding
+                                        ? [
+                                            {
+                                              sourceKind: binding.sourceKind,
+                                              sourceFileId: binding.sourceFileId,
+                                              sourceVersionId: binding.sourceVersionId
+                                            }
+                                          ]
+                                        : []
+                                    )}
+                                    atLimit={pdfContext.bindings.length >= MAX_SESSION_PDF_CONTEXTS}
+                         
```

**File**: `src/renderer/src/pages/workspace/SessionDiscussionBar.tsx` (modified, +7/-4)
```diff
@@ -11,6 +11,9 @@ export type DiscussionStep = {
   stepNumber?: number
 }
 
+export const composerContextRowClassName =
+  'flex min-h-9 items-center gap-1 border-b border-border-200 bg-bg-10 px-2'
+
 // The action and its selected Session stay separate, in both drafts and ongoing conversations.
 export const SessionDiscussionBar = ({
   title,
@@ -62,7 +65,7 @@ export const SessionDiscussionBar = ({
               <Button
                 variant="ghost"
                 size="sm"
-                className="h-7 shrink-0 gap-1 px-1.5 text-xs font-medium"
+                className="h-7 shrink-0 gap-1 px-1.5 text-xs font-medium disabled:opacity-100"
                 disabled={disabled}
               >
                 <MessageSquare className="size-4 text-primary" aria-hidden="true" />
@@ -106,15 +109,15 @@ export const SessionDiscussionBar = ({
         </PopoverContent>
       </Popover>
       <span
-        className="inline-flex min-w-0 max-w-72 items-center rounded-md border border-border-200 bg-bg-10"
+        className="inline-flex min-w-0 max-w-56 items-center rounded-lg bg-bg-200"
         data-session-discussion-source="true"
       >
         <Tooltip>
           <TooltipTrigger asChild>
             <Button
               variant="ghost"
               size="sm"
-              className="h-7 min-w-0 shrink gap-1.5 px-2 text-xs"
+              className="h-6 min-w-0 shrink gap-1.5 px-2 text-xs font-medium text-text-300 disabled:opacity-100"
               disabled={disabled}
               onClick={() => onReveal(latest.id)}
             >
@@ -144,7 +147,7 @@ export const SessionDiscussionBar = ({
             <Button
               variant="ghost"
               size="icon-xs"
-              className="shrink-0"
+              className="shrink-0 disabled:opacity-100"
               disabled={disabled}
               aria-label={removeLabel}
               onClick={onRemove}
```

**File**: `src/renderer/src/pages/workspace/SessionDiscussionSource.tsx` (modified, +36/-36)
```diff
@@ -3,7 +3,7 @@ import { useSessionStore } from '@/stores/session-store'
 import { useState } from 'react'
 import { useTranslation } from 'react-i18next'
 import { ErrorNotice } from '@/components/error-notice'
-import { SessionDiscussionBar } from './SessionDiscussionBar'
+import { composerContextRowClassName, SessionDiscussionBar } from './SessionDiscussionBar'
 import { usePreviewWorkbenchStore } from '@/stores/preview-workbench-store'
 import { createSessionReplayItem } from './workspace-session-actions'
 import { requestReplaySeek } from './replay/replay-context'
@@ -65,47 +65,47 @@ export const SessionDiscussionSource = ({
     }
   }
   return (
-    <div
-      data-testid="session-discussion-source"
-      className="mb-2 min-w-0 space-y-2 border-b border-border-200 pb-2"
-      aria-busy={Boolean(pending)}
-    >
-      <SessionDiscussionBar
-        scope={binding.scope}
-        title={binding.title}
-        steps={sessionReadingPositions(binding).map((position) => ({
-          id: position.contextId,
-          title: position.stepTitle ?? binding.title,
-          branchIndex: position.branchIndex,
-          stepNumber: position.stepNumber
-        }))}
-        disabled={Boolean(pending)}
-        pending={Boolean(pending)}
-        onReveal={(contextId) => void act({ sourceSessionId: binding.sessionId, contextId })}
-        onRemove={() => void act({ sourceSessionId: binding.sessionId })}
-        removeLabel={t('Unlink Session')}
-        removeHint={t('Stop future reading. Sent messages are kept.')}
-      />
+    <div data-testid="session-discussion-source" className="min-w-0" aria-busy={Boolean(pending)}>
+      <div className={composerContextRowClassName}>
+        <SessionDiscussionBar
+          scope={binding.scope}
+          title={binding.title}
+          steps={sessionReadingPositions(binding).map((position) => ({
+            id: position.contextId,
+            title: position.stepTitle ?? binding.title,
+            branchIndex: position.branchIndex,
+            stepNumber: position.stepNumber
+          }))}
+          disabled={Boolean(pending)}
+          pending={Boolean(pending)}
+          onReveal={(contextId) => void act({ sourceSessionId: binding.sessionId, contextId })}
+          onRemove={() => void act({ sourceSessionId: binding.sessionId })}
+          removeLabel={t('Unlink Session')}
+          removeHint={t('Stop future reading. Sent messages are kept.')}
+        />
+      </div>
       {pending ? (
         <span role="status" className="sr-only">
           {t('Loading…')}
         </span>
       ) : null}
       {error ? (
-        <ErrorNotice
-          inline
-          tone="amber"
-          description={
-            error.contextId
-              ? t('Could not open this source. Retry or unlink the Session.')
-              : t('Could not unlink the Session. Please retry.')
-          }
-          primaryButton={{
-            label: t('Retry'),
-            disabled: Boolean(pending),
-            onClick: () => void act(error)
-          }}
-        />
+        <div className="mt-2 border-b border-border-200 pb-2">
+          <ErrorNotice
+            inline
+            tone="amber"
+            description={
+              error.contextId
+                ? t('Could not open this source. Retry or unlink the Session.')
+                : t('Could not unlink the Session. Please retry.')
+            }
+            primaryButton={{
+              label: t('Retry'),
+              disabled: Boolean(pending),
+              onClick: () => void act(error)
+            }}
+          />
+        </div>
       ) : null}
     </div>
   )
```

**File**: `src/renderer/src/pages/workspace/WorkspacePage.draft-preservation.test.tsx` (modified, +180/-0)
```diff
@@ -33,6 +33,7 @@ import type {
   PersistedChatSession
 } from '../../../../shared/session-persistence'
 import { emptyDoc, type ComposerDoc } from './composer/composer-doc'
+import { createSessionDiscussionAnnotation } from './session-discussion-annotation'
 import {
   markWorkspaceReviewHistoryLoaded,
   setDefaultWorkspaceAgentSettings
@@ -700,6 +701,185 @@ describe('WorkspacePage draft preservation', () => {
     expect(container.querySelector('[data-testid="conversation"]')).not.toBe(panel)
   })
 
+  it.each([
+    ['selected', true],
+    ['automatic', true],
+    ['selected', false],
+    ['automatic', false],
+    ['filtered', true],
+    ['filtered', false],
+    ['none', true]
+  ] as const)(
+    'keeps first-send context (%s Reading, Discussion: %s) across real pending-to-durable identities before a response',
+    async (reading, includeDiscussion) => {
+      await renderPage()
+      await act(async () => sidebarProps.onNewConversation())
+      const projectId = useNavigationStore.getState().activeProjectId!
+      const discussion = createSessionDiscussionAnnotation(
+        {
+          projectId,
+          sourceSessionId: 'source',
+          sourceTitle: 'Study',
+          fingerprint: 'fp',
+          branchId: 'main',
+          stepId: 'step',
+          stepOffsetMs: 0,
+          excerpt: '',
+          evidence: [{ kind: 'message', id: 'step', projectId, sessionId: 'source' }]
+        },
+        'selection'
+      )!
+      await act(async () => {
+        if (includeDiscussion) conversationProps.composer.actions.addAnnotation(discussion)
+        conversationProps.composer.actions.changeDoc(textDoc('Research this'))
+      })
+      if (reading === 'selected') {
+        await act(async () => {
+          const preview = usePreviewWorkbenchStore.getState()
+          preview.upsertItem({
+            id: 'literature:version',
+            projectId,
+            sessionId: 'literature-library',
+            type: 'file',
+            source: 'literature',
+            title: 'paper.pdf',
+            name: 'paper.pdf',
+            format: 'pdf',
+            path: 'literature-attachment-version:version',
+            mimeType: 'application/pdf',
+            size: 100
+          })
+          preview.setPendingPdfContext(projectId, {
+            kind: 'version',
+            sourceKind: 'literature-attachment-version',
+            sourceVersionId: 'version',
+            previewItemId: 'literature:version'
+          })
+        })
+      } else if (reading === 'automatic' || reading === 'filtered') {
+        await stageAttachment({
+          id: 'pdf-upload',
+          sessionId: '.pending',
+          name: 'paper.pdf',
+          originalName: 'paper.pdf',
+          path: '/uploads/paper.pdf',
+          mimeType: 'application/pdf',
+          size: 100
+        })
+      }
+      const pending: ChatSession = {
+        ...createSession('pending-new', projectId),
+        isPending: true,
+        status: 'running',
+        messages: [
+          {
+            id: 'first-prompt',
+            role: 'user',
+            content: 'Research this',
+            status: 'complete',
+            annotations: includeDiscussion ? [discussion] : [],
+            eventIds: [],
+            createdAt: 1,
+            updatedAt: 1
+          }
+        ]
+      }
+      let finish!: (value: { sessionId: string; messageId: string }) => void
+      runtime.sendMessage.mockImplementationOnce((input) => {
+        useSessionStore.setState((state) => ({
+          sessions: [...state.sessions, pending],
+          selectedSessionId: pending.id
+        }))
+        input.onMessageAppended?.({ sessionId: pending.id, messageId: 'first-prompt' })
+        return new Promise((resolve) => {
+          finish = resolve
+        })
+      })
+      const assertContext = (prepared = false): void => {
+        expect(conversationProps.composer.view.annotations).toEqual(
+          includeDiscussion ? [discussion] : []
+        )
+        if (reading === 'selected')
+          expect(conversationProps.composer.view.readingContext.bindings).toMatchObject([
+            { name: 'paper.pdf' }
+          ])
+        else {
+          expect(conversationProps.composer.view.readingContext.automaticAttachmentCount).toBe(
+            reading === 'automatic' || (reading === 'filtered' && !prepared) ? 1 : 0
+          )
+          expect(conversationProps.composer.view.readingContext.automaticAttachments).toEqual(
+            reading === 'automatic' || (reading === 'filtered' && !prepared)
+              ? [{ id: 'pdf-upload', name: 'paper.pdf' }]
+              : []
+          )
+        }
+        expect(conversationProps.composer.view.readingContext.isPending).toBe(
+          includeDiscussion || reading === 'selected' || reading === 'automatic' || !prepared
+        )
+      }
+      await act(async () =>
+        conversationProps.conversation.actions.submit.draft({ forcedSkillIds: [] })

```

**File**: `src/renderer/src/pages/workspace/annotations/AnnotationCards.test.tsx` (modified, +2/-2)
```diff
@@ -450,7 +450,7 @@ describe('AnnotationCards image projection', () => {
       )
     )
 
-    const section = container.querySelector('section')
+    const section = container.querySelector('[data-testid="annotation-draft-list"]')
     expect(section?.className).toContain('flex-wrap')
     const chips = container.querySelectorAll('[data-annotation-draft-chip]')
     expect(chips).toHaveLength(2)
@@ -473,7 +473,7 @@ describe('AnnotationCards image projection', () => {
       )
     )
 
-    const section = container.querySelector('section')
+    const section = container.querySelector('[data-testid="annotation-draft-list"]')
     const chip = container.querySelector<HTMLElement>('[data-annotation-draft-chip]')
     const edit = container.querySelector<HTMLButtonElement>('[aria-label="Edit annotation note"]')
     await act(async () => edit?.click())
```

**File**: `src/renderer/src/pages/workspace/annotations/AnnotationCards.tsx` (modified, +182/-177)
```diff
@@ -19,7 +19,7 @@ import { prepareImagePointAnnotations } from './image-annotation-payload'
 import { annotationValidationMessage } from './annotation-validation-message'
 import { SentAnnotationCards, type SentAnnotationCardView } from './SentAnnotationCards'
 import { replayAnnotationTarget } from '../session-discussion-annotation'
-import { SessionDiscussionBar } from '../SessionDiscussionBar'
+import { composerContextRowClassName, SessionDiscussionBar } from '../SessionDiscussionBar'
 
 // Keep the source shortcut compact while the quote carries the selected content.
 // Accept the old Research header on previously saved annotations.
@@ -201,16 +201,16 @@ const AnnotationDraftCards = ({
       source?.projectId === target?.projectId && source?.sourceSessionId === target?.sourceSessionId
     )
   })
+  const ordinaryAnnotations = annotations.filter(
+    (annotation) => !replayAnnotationTarget(annotation)
+  )
   if (annotations.length === 0) return null
 
   return (
     <TooltipProvider>
-      <section
-        className="flex max-h-[132px] flex-wrap gap-1.5 overflow-y-auto border-b border-border-200 pb-2"
-        aria-label={t('Annotations for Agent')}
-      >
+      <section className="min-w-0 space-y-2" aria-label={t('Annotations for Agent')}>
         {latest ? (
-          <div className="w-full min-w-0" data-testid="session-discussion-draft">
+          <div className={composerContextRowClassName} data-testid="session-discussion-draft">
             <SessionDiscussionBar
               scope={target?.scope}
               title={replaySourceTitle(latest, t) ?? ''}
@@ -236,191 +236,196 @@ const AnnotationDraftCards = ({
             />
           </div>
         ) : null}
-        {annotations
-          .filter((annotation) => !replayAnnotationTarget(annotation))
-          .map((annotation) => {
-            const imagePoint = imagePoints.get(annotation.id)
-            const hoverSourceLabel =
-              annotation.kind === 'text' && annotation.source.kind === 'agent-message'
-                ? t('Agent Message')
-                : annotationSourceLabel(annotation, t)
-            const hoverLabel = `${annotationChipLabel(annotation, t)} - ${hoverSourceLabel}`
-            const editing = editingId === annotation.id
-            return (
-              <Popover
-                key={annotation.id}
-                open={editing}
-                onOpenChange={(open) => {
-                  if (open) {
-                    setHoveredId(undefined)
-                    setEditTooltipId(undefined)
-                    openEditor(annotation)
-                  } else {
-                    closeEditor(annotation.id)
-                  }
-                }}
-              >
-                <Tooltip
-                  open={!editing && hoveredId === annotation.id}
-                  onOpenChange={(open) => setHoveredId(open ? annotation.id : undefined)}
+        {ordinaryAnnotations.length > 0 ? (
+          <div
+            data-testid="annotation-draft-list"
+            className="flex max-h-[132px] flex-wrap gap-1.5 overflow-y-auto border-b border-border-200 pb-2"
+          >
+            {ordinaryAnnotations.map((annotation) => {
+              const imagePoint = imagePoints.get(annotation.id)
+              const hoverSourceLabel =
+                annotation.kind === 'text' && annotation.source.kind === 'agent-message'
+                  ? t('Agent Message')
+                  : annotationSourceLabel(annotation, t)
+              const hoverLabel = `${annotationChipLabel(annotation, t)} - ${hoverSourceLabel}`
+              const editing = editingId === annotation.id
+              return (
+                <Popover
+                  key={annotation.id}
+                  open={editing}
+                  onOpenChange={(open) => {
+                    if (open) {
+                      setHoveredId(undefined)
+                      setEditTooltipId(undefined)
+                      openEditor(annotation)
+                    } else {
+                      closeEditor(annotation.id)
+                    }
+                  }}
                 >
-                  <TooltipTrigger asChild>
-                    <DraggableAnnotationCard
-                      annotation={annotation}
-                      data-annotation-draft-chip="true"
-                      data-annotation-hover-label={hoverLabel}
-                      className="group relative inline-flex h-7 min-w-0 max-w-[13rem] items-center rounded-md border border-border bg-background text-xs hover:bg-muted focus-within:bg-muted"
-                    >
-                      <button
-                        type="button"
-                        data-annotation-quote="true"
-                        className="flex min-w-0 flex-1 items-center gap-1.5 self-stretch rounded-l-md px-2 text-left focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
-                        aria-label={t('Show annotation s
```

---

### Incident Patch 4: `bd9a61a8` (2026-10-05)
**Commit Message**: fix(ci-regression): stabilize native navigation and preview checks (#3305)

* fix(ci-regression): stabilize native navigation and preview checks

* test(ci-regression): include failing journeys in PR coverage

* test(ci-regression): update coverage counts and retry fixture cleanup

**File**: `e2e/session-package.spec.ts` (modified, +10/-5)
```diff
@@ -285,7 +285,7 @@ test('shows a recoverable disk-capacity error before copying an import', async (
   await operation.getByRole('button', { name: 'Close', exact: true }).click()
 })
 
-test('exports a Session package and opens the imported Session with replay', async ({
+test('exports a Session package and opens the imported Session with replay @pr-mainline-projects', async ({
   app
 }, testInfo) => {
   // This journey validates the archive several times and performs two persistence restarts.
@@ -318,8 +318,11 @@ test('exports a Session package and opens the imported Session with replay', asy
   const prompt = 'Summarize the deterministic fixture.'
   await page.getByRole('textbox', { name: 'Ask anything' }).fill(prompt)
   await page.getByRole('button', { name: 'Send message' }).click()
-  await expect(page.getByText(`Deterministic reply: ${prompt}`, { exact: true })).toBeVisible()
-  await expect(page.getByRole('button', { name: 'Stop generating' })).toHaveCount(0)
+  // Session preparation on Windows is not a response-latency benchmark.
+  await expect(page.getByText(`Deterministic reply: ${prompt}`, { exact: true })).toBeVisible({
+    timeout: 60_000
+  })
+  await expect(page.getByRole('button', { name: 'Cancel run', exact: true })).toHaveCount(0)
   await page.getByRole('button', { name: `Open actions for ${prompt}` }).click()
   await page.getByRole('menuitem', { name: 'Export', exact: true }).hover()
   const exportPackage = page.getByRole('menuitem', { name: 'Export Session package', exact: true })
@@ -401,8 +404,10 @@ test('exports a Session package and opens the imported Session with replay', asy
     .fill('Continue another Session during export.')
   await page.getByRole('button', { name: 'Send message' }).click()
   // The installed fake Agent returns its configured fixed response for every Session.
-  await expect(page.getByText(`Deterministic reply: ${prompt}`, { exact: true })).toBeVisible()
-  await expect(page.getByRole('button', { name: 'Stop generating' })).toHaveCount(0)
+  await expect(page.getByText(`Deterministic reply: ${prompt}`, { exact: true })).toBeVisible({
+    timeout: 60_000
+  })
+  await expect(page.getByRole('button', { name: 'Cancel run', exact: true })).toHaveCount(0)
   await page
     .getByRole('navigation', { name: 'Sessions' })
     .getByRole('button', { name: new RegExp(`Session status:.*${prompt}`) })
```

**File**: `e2e/workspace-conversation.spec.ts` (modified, +29/-6)
```diff
@@ -516,7 +516,7 @@ test('shows context compaction loading and completion inside the Session transcr
   }
 })
 
-test('previews and opens an Agent HTTPS source link in the isolated preview tab', async ({
+test('previews and opens an Agent HTTPS source link in the isolated preview tab @pr-mainline-files', async ({
   app
 }, testInfo) => {
   await app.completeOnboarding()
@@ -853,14 +853,37 @@ test('previews and opens an Agent HTTPS source link in the isolated preview tab'
   await app.setMainWindowZoomFactor(1.25)
   await expect(sourceFrame).toBeVisible()
   const rightClickTarget = nativePage.getByRole('heading', { name: 'Fixture source' })
-  const sourceBounds = (await sourceFrame.boundingBox())!
-  const headingBounds = (await rightClickTarget.boundingBox())!
+  // Capture the real guest click: resize/zoom can invalidate bounds read before input dispatch.
+  await rightClickTarget.evaluate((element) => {
+    element.addEventListener(
+      'contextmenu',
+      (event) => {
+        const pointer = event as MouseEvent
+        element.setAttribute(
+          'data-e2e-context-pointer',
+          JSON.stringify({ x: pointer.clientX, y: pointer.clientY })
+        )
+      },
+      { once: true }
+    )
+  })
   await rightClickTarget.click({ button: 'right', position: { x: 8, y: 10 } })
   const sourceMenu = page.getByRole('menu')
   await expect(sourceMenu.getByText('Copy link', { exact: true })).toBeVisible()
-  const menuBounds = (await sourceMenu.boundingBox())!
-  expect(Math.abs(menuBounds.x - (sourceBounds.x + headingBounds.x + 8))).toBeLessThan(5)
-  expect(Math.abs(menuBounds.y - (sourceBounds.y + headingBounds.y + 10))).toBeLessThan(5)
+  const sourceBounds = (await sourceFrame.boundingBox())!
+  const clickPointer = JSON.parse(
+    (await rightClickTarget.getAttribute('data-e2e-context-pointer'))!
+  )
+  await expect
+    .poll(async () => {
+      const sourceBounds = (await sourceFrame.boundingBox())!
+      const menuBounds = (await sourceMenu.boundingBox())!
+      return Math.max(
+        Math.abs(menuBounds.x - (sourceBounds.x + clickPointer.x)),
+        Math.abs(menuBounds.y - (sourceBounds.y + clickPointer.y))
+      )
+    })
+    .toBeLessThan(5)
   await page.screenshot({ path: testInfo.outputPath('source-context-menu-zoom.png') })
   await page.keyboard.press('Escape')
   await expect(sourceMenu).toHaveCount(0)
```

**File**: `e2e/workspace-project-switcher.spec.ts` (modified, +28/-14)
```diff
@@ -259,7 +259,7 @@ test('switches projects from the Workspace project menu and expands remaining pr
   await expect(menu.locator('[data-project-id]')).toHaveCount(5)
 })
 
-test('closes mobile navigation when switching projects', async ({ app }) => {
+test('closes mobile navigation when switching projects @pr-mainline-projects', async ({ app }) => {
   await app.completeOnboarding()
   let page = await app.configureFakeAgent()
 
@@ -270,20 +270,34 @@ test('closes mobile navigation when switching projects', async ({ app }) => {
   await reloadAndOpenProject(page, 'Project 2')
 
   await page.setViewportSize({ width: 700, height: 700 })
-  await page.getByRole('button', { name: 'Open navigation' }).click()
-
   const navigation = page.locator('aside[aria-label="Workspace navigation"]')
-  await expect(navigation).toHaveAttribute('data-mobile-open', 'true')
-  await navigation.locator('button[title="Project 2"]').click()
-  await page
-    .locator('[aria-label="Project actions"]')
-    .locator('[data-project-id]')
-    .filter({ hasText: /^Project 1Description 1$/ })
-    .click()
-
-  await expect(navigation).toHaveAttribute('data-mobile-open', 'false')
-  await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible()
+  for (const [zoom, currentProject, nextProject] of [
+    [1, 2, 1],
+    [1.25, 1, 2]
+  ] as const) {
+    await app.setMainWindowZoomFactor(zoom)
+    await page.getByRole('button', { name: 'Open navigation' }).click()
+    await expect(navigation).toHaveAttribute('data-mobile-open', 'true')
+    if (process.platform === 'win32') {
+      const titlebar = page.getByTestId('windows-titlebar')
+      await expect
+        .poll(async () => {
+          const titlebarBounds = (await titlebar.boundingBox())!
+          const navigationBounds = (await navigation.boundingBox())!
+          return navigationBounds.y - (titlebarBounds.y + titlebarBounds.height)
+        })
+        .toBeGreaterThanOrEqual(0)
+    }
+    await navigation.locator(`button[title="Project ${currentProject}"]`).click()
+    await page
+      .locator('[aria-label="Project actions"]')
+      .locator('[data-project-id]')
+      .filter({ hasText: new RegExp(`^Project ${nextProject}Description ${nextProject}$`) })
+      .click()
 
+    await expect(navigation).toHaveAttribute('data-mobile-open', 'false')
+    await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible()
+  }
   await page.getByRole('button', { name: 'Open navigation' }).click()
-  await expect(navigation.locator('button[title="Project 1"]')).toBeVisible()
+  await expect(navigation.locator('button[title="Project 2"]')).toBeVisible()
 })
```

**File**: `scripts/ci/windows-e2e-regression.test.ts` (modified, +4/-4)
```diff
@@ -37,8 +37,8 @@ const step = (job: Job, name: string): Step =>
   job.steps.find((candidate) => candidate.name === name)!
 const suites = [
   ['renderer_layout', 'test:e2e:browser', 0],
-  ['e2e_functional_windows', 'test:e2e:journey', 9],
-  ['e2e_workspace_windows', 'test:e2e:workspace', 4]
+  ['e2e_functional_windows', 'test:e2e:journey', 10],
+  ['e2e_workspace_windows', 'test:e2e:workspace', 6]
 ] as const
 
 it('schedules independent complete Windows E2E and keeps the manual full entry point', () => {
@@ -240,9 +240,9 @@ it('discovers the reviewed mainline subset and retains every other case in the f
     return visit((JSON.parse(result.stdout) as JSONReport).suites).sort()
   }
   for (const [group, count] of Object.entries({
-    projects: 1,
+    projects: 3,
     conversation: 2,
-    files: 4,
+    files: 5,
     notebook: 1,
     windows: 5
   })) {
```

**File**: `scripts/windows-updater-certification.test.ts` (modified, +1/-1)
```diff
@@ -191,7 +191,7 @@ describe('Windows updater certification', () => {
       } finally {
         controller.abort()
         await Promise.allSettled([observer.exit, processExit])
-        await rm(root, { recursive: true, force: true })
+        await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
       }
     },
     60_000
```

**File**: `src/renderer/src/pages/workspace/WorkspaceSidebar.tsx` (modified, +1/-1)
```diff
@@ -775,7 +775,7 @@ const WorkspaceSidebarView = (props: WorkspaceSidebarViewProps): React.JSX.Eleme
       data-mobile-open={isMobileOpen ? 'true' : 'false'}
       className={cn(
         mobileMode
-          ? 'fixed inset-y-0 left-0 z-[70] flex h-[100dvh] w-[min(86vw,320px)] min-w-0 shrink-0 flex-col bg-bg-10 transition-transform duration-200 ease-out'
+          ? 'fixed bottom-0 left-0 top-[var(--windows-titlebar-height,0px)] z-[70] flex w-[min(86vw,320px)] min-w-0 shrink-0 flex-col bg-bg-10 transition-transform duration-200 ease-out'
           : 'z-10 flex h-full w-full min-w-0 flex-col overflow-hidden',
         mobileMode && (isMobileOpen ? 'translate-x-0' : '-translate-x-full')
       )}
```

---

### Incident Patch 5: `6dff51b2` (2026-10-05)
**Commit Message**: fix(bookmarks): log creation failure stages (#3273)

* fix(workspace): explain unverifiable preview file versions instead of failing silently

* ci(module-impact): register preview source status files

* test(stores): keep the session renderer impact snapshot in sync

* fix(workspace): remove incorrect cross-session preview restrictions

Preserve source identity for cross-session bookmarks and Agent annotations.
Keep bookmark creation stage diagnostics and drop unverified renderer
version states, unreachable messages, and their supporting registrations.

Both component regressions fail on the previous PR head and pass after
restoring the existing preview behavior.

* test(bookmarks): cover creation diagnostics and source validation

Reproduce the CI branch-coverage failure and cover managed source identity
checks through BookmarkService.create. Verify every diagnostic stage and
preserve the original rejection even when the logger throws.

Service branch coverage increases from 47.27% to 61.81% against the existing
57% changed-source gate, without changing production logic or thresholds.

---------

Co-authored-by: Ewen <[REDACTED_EMAIL]>

**File**: `src/main/bookmarks/service.test.ts` (modified, +158/-1)
```diff
@@ -2,7 +2,13 @@ import { describe, expect, it, vi } from 'vitest'
 
 import type { CreateBookmarkRequest } from '../../shared/bookmarks'
 import type { PersistedChatSession } from '../../shared/session-persistence'
-import { BookmarkService } from './service'
+import { BookmarkService, type PdfVersionAuthority } from './service'
+
+const { warn } = vi.hoisted(() => ({ warn: vi.fn() }))
+vi.mock('../logger', async (importOriginal) => ({
+  ...(await importOriginal<typeof import('../logger')>()),
+  createLogger: () => ({ warn })
+}))
 
 const request = (): CreateBookmarkRequest => ({
   id: 'bookmark-1',
@@ -102,6 +108,157 @@ describe('BookmarkService', () => {
     expect(runWithSessionAuthority).toHaveBeenCalledOnce()
   })
 
+  it.each(['session-recovery', 'session-load', 'source-validation', 'persist'])(
+    'records %s failures without leaking source details or replacing the error',
+    async (stage) => {
+      warn.mockReset()
+      const secret = Object.assign(new Error('SECRET /private/path'), { code: 'EACCES' })
+      const repository = {
+        recoverCreate: vi.fn(async () => {
+          if (stage === 'session-recovery') throw secret
+          return undefined
+        }),
+        create: vi.fn(async () => {
+          throw secret
+        }),
+        list: vi.fn(),
+        updateNote: vi.fn(),
+        delete: vi.fn(),
+        deleteSession: vi.fn(),
+        deleteProject: vi.fn()
+      }
+      const service = new BookmarkService({
+        repository,
+        sessions: {
+          loadSessionWithDiagnostics: vi.fn(async () => {
+            if (stage === 'session-load') throw secret
+            return {
+              status: 'found' as const,
+              session: session()
+            }
+          })
+        },
+        validateProjectFile: vi.fn(async () => {
+          if (stage === 'source-validation') throw secret
+          return true
+        }),
+        runWithSessionAuthority: (_projectId, _sessionId, operation) => operation()
+      })
+
+      const input: CreateBookmarkRequest = {
+        ...request(),
+        target: {
+          kind: 'text',
+          quote: 'Saved quote',
+          source: {
+            kind: 'project-file',
+            projectId: 'project-1',
+            path: '/private/path',
+            name: 'SECRET'
+          }
+        }
+      }
+      await expect(service.create(input)).rejects.toBe(secret)
+      expect(warn).toHaveBeenCalledExactlyOnceWith('Bookmark creation failed', {
+        stage,
+        errorCategory: 'permission'
+      })
+      expect(JSON.stringify(warn.mock.calls)).not.toMatch(/SECRET|private|project|sessionId/u)
+      warn.mockImplementationOnce(() => {
+        throw new Error('Logger unavailable')
+      })
+      await expect(service.create(input)).rejects.toBe(secret)
+    }
+  )
+
+  it.each([
+    'valid',
+    'missing',
+    'file-mismatch',
+    'version-mismatch',
+    'session-mismatch',
+    'no-authority',
+    'wrong-project'
+  ])(
+    'checks managed file authority before persisting a cross-session bookmark: %s',
+    async (scenario) => {
+      warn.mockReset()
+      const input: CreateBookmarkRequest = {
+        ...request(),
+        target: {
+          kind: 'text',
+          quote: 'Saved quote',
+          source: {
+            kind: 'project-file',
+            projectId: scenario === 'wrong-project' ? 'other-project' : 'project-1',
+            path: '/managed/report.md',
+            name: 'report.md',
+            fileSource: 'artifact',
+            sourceFileId: 'file-1',
+            versionId: 'version-1',
+            sessionId: 'source-session'
+          }
+        }
+      }
+      const saved = {
+        ...input,
+        version: 1 as const,
+        createdAt: '2026-10-05T00:00:00.000Z',
+        updatedAt: '2026-10-05T00:00:00.000Z'
+      }
+      const repository = {
+        recoverCreate: vi.fn(async () => undefined),
+        create: vi.fn(async () => saved),
+        list: vi.fn(),
+        updateNote: vi.fn(),
+        delete: vi.fn()
+      }
+      const resolveVersion = vi.fn<PdfVersionAuthority['resolveVersion']>(async () =>
+        scenario === 'missing'
+          ? undefined
+          : {
+              sourceKind: 'artifact-version',
+              sourceFileId: scenario === 'file-mismatch' ? 'other-file' : 'file-1',
+              sourceVersionId: scenario === 'version-mismatch' ? 'other-version' : 'version-1',
+              sourceSessionId: scenario === 'session-mismatch' ? 'other-session' : 'source-session',
+              filename: 'report.md',
+              sizeBytes: 42,
+              checksum: 'a'.repeat(64),
+              path: '/managed/report.md'
+            }
+      )
+      const service = new BookmarkService({
+        repository,
+        sessions: {
+          loadSessionWithDiagnostics: vi.fn(async () => ({
+            status: 'found' as const,
+            session: session()
+          }))
+        },
+        pdfVers
```

**File**: `src/main/bookmarks/service.ts` (modified, +19/-5)
```diff
@@ -268,11 +268,25 @@ class BookmarkService {
 
   create(request: CreateBookmarkRequest): Promise<Bookmark> {
     return this.enqueue(request.projectId, request.sessionId, async () => {
-      const recovered = await this.options.repository.recoverCreate(request)
-      if (recovered) return recovered
-      const session = await this.loadWritableSession(request.projectId, request.sessionId)
-      await this.validateNewSource(request, session)
-      return this.options.repository.create(request)
+      let stage = 'session-recovery'
+      try {
+        const recovered = await this.options.repository.recoverCreate(request)
+        if (recovered) return recovered
+        stage = 'session-load'
+        const session = await this.loadWritableSession(request.projectId, request.sessionId)
+        stage = 'source-validation'
+        await this.validateNewSource(request, session)
+        stage = 'persist'
+        return await this.options.repository.create(request)
+      } catch (error) {
+        try {
+          // Fixed diagnostic stages only: never retain source IDs, paths, messages, or stacks.
+          log.warn('Bookmark creation failed', { stage, ...diagnosticErrorFields(error) })
+        } catch {
+          // Diagnostics cannot replace the authoritative rejection.
+        }
+        throw error
+      }
     })
   }
 
```

**File**: `src/renderer/src/pages/workspace/previews/PreviewTextAnnotationSurface.test.tsx` (modified, +61/-1)
```diff
@@ -13,7 +13,7 @@ import type {
 } from '../../../../../shared/annotations'
 import { createArtifactVersionLocator } from '../../../../../shared/artifact-provenance'
 import type { PreviewFileItem } from '@/stores/preview-workbench-store'
-import type { Bookmark } from '../../../../../shared/bookmarks'
+import type { Bookmark, CreateBookmarkRequest } from '../../../../../shared/bookmarks'
 
 import {
   requestAnnotationReveal,
@@ -617,6 +617,66 @@ describe('PreviewTextAnnotationSurface', () => {
     expect(ranges()).toHaveLength(0)
   })
 
+  it('saves a managed file bookmark from another session without changing its source', async () => {
+    const create = vi.fn(async (request: CreateBookmarkRequest): Promise<Bookmark> => ({
+      ...request,
+      version: 1,
+      createdAt: '2026-10-05T00:00:00.000Z',
+      updatedAt: '2026-10-05T00:00:00.000Z'
+    }))
+    const previewItem = item({ managedFileId: 'artifact-1', sessionId: 'other-session' })
+    await renderSurface({
+      bookmarkApi: {
+        list: vi.fn().mockResolvedValue({ items: [], total: 0 }),
+        create
+      } as unknown as Window['api']['bookmarks'],
+      previewItem
+    })
+    await selectQuote()
+    fireEvent.click(screen.getByRole('button', { name: 'Annotate' }))
+    fireEvent.click(screen.getByRole('tab', { name: 'For me' }))
+    const button = screen.getByRole('button', { name: 'Bookmark' }) as HTMLButtonElement
+    expect(button.disabled).toBe(false)
+    await act(async () => fireEvent.click(button))
+    expect(create).toHaveBeenCalledExactlyOnceWith(
+      expect.objectContaining({
+        sessionId: 'session-1',
+        target: expect.objectContaining({
+          source: expect.objectContaining({
+            sessionId: 'other-session',
+            sourceFileId: 'artifact-1',
+            versionId: 'version-7'
+          })
+        })
+      })
+    )
+  })
+
+  it('adds an agent annotation from another session without changing its source', async () => {
+    const onAddAnnotation = vi.fn(() => undefined)
+    const onAnnotationError = vi.fn()
+    await renderSurface({
+      onAddAnnotation,
+      onAnnotationError,
+      bookmarkApi: {
+        list: vi.fn().mockResolvedValue({ items: [], total: 0 })
+      } as unknown as Window['api']['bookmarks'],
+      previewItem: item({ managedFileId: 'artifact-1', sessionId: 'other-session' })
+    })
+    await selectQuote()
+    await confirmAnnotation()
+    expect(onAnnotationError).not.toHaveBeenCalled()
+    expect(onAddAnnotation).toHaveBeenCalledExactlyOnceWith(
+      expect.objectContaining({
+        source: expect.objectContaining({
+          sessionId: 'other-session',
+          sourceFileId: 'artifact-1',
+          versionId: 'version-7'
+        })
+      })
+    )
+  })
+
   it('reveals an exact project-file bookmark and reports a missing quote', async () => {
     await renderSurface({
       bookmarkApi: {
```

---

### Incident Patch 6: `b9c92ba5` (2026-10-05)
**Commit Message**: fix(replay): preserve follow scrolling and recorded file questions (#3292)

* fix(replay): preserve transcript follow during playback

* fix(replay): allow questions at the start of recorded file steps

* test(replay): align gallery checks with immediate file visibility

---------

Co-authored-by: JS <[REDACTED_EMAIL]>
Co-authored-by: Ewen <[REDACTED_EMAIL]>

**File**: `e2e/replay-stage.spec.ts` (modified, +137/-3)
```diff
@@ -1399,7 +1399,141 @@ test('interactive history reaches the first message and preserves conversation a
   await expect.poll(async () => (await runAnchor.boundingBox())!.y).toBeCloseTo(runTop, 0)
 })
 
-test('keeps one generated gallery through reveal phases and delayed thumbnails without horizontal overflow', async ({
+test('conversation follows uninterrupted replay and resumes after manual reading, play and seek', async ({
+  page
+}) => {
+  await page.goto(`${url}?panel=1&history=1`)
+  const panel = page.getByTestId('replay-panel')
+  const conversation = panel.getByRole('region', { name: 'Historical conversation' })
+  const progress = panel.getByRole('slider', { name: 'Replay progress' })
+  const returnToCurrent = conversation.getByRole('button', { name: 'Return to current step' })
+  const bottomGap = (): Promise<number> =>
+    conversation.evaluate((node) => node.scrollHeight - node.clientHeight - node.scrollTop)
+  const expectFollowing = async (): Promise<void> => {
+    await expect(returnToCurrent).toHaveCount(0)
+    await expect.poll(bottomGap).toBeLessThanOrEqual(8)
+  }
+  const readEarlier = async (): Promise<void> => {
+    await conversation.hover()
+    await page.mouse.wheel(0, -240)
+    await expect(returnToCurrent).toBeVisible()
+    await expect.poll(bottomGap).toBeGreaterThan(100)
+    await expect(panel.getByRole('button', { name: 'Play replay', exact: true })).toBeVisible()
+  }
+
+  await panel.getByRole('button', { name: 'Enter full screen', exact: true }).click()
+  await panel.getByRole('button', { name: 'Play replay', exact: true }).click()
+  // Native scroll and ResizeObserver callbacks can straddle growing text commits. Sample
+  // every painted frame, including eviction of older rows after the twelve-step window fills.
+  const playback = await conversation.evaluate(async (node) => {
+    const started = performance.now()
+    let samples = 0
+    let maximumRows = 0
+    let falseReturn:
+      | {
+          position: number
+          top: number
+          gap: number
+          step: string | undefined
+          preceding: unknown[]
+        }
+      | undefined
+    const preceding: unknown[] = []
+    const record = (event: string): void => {
+      preceding.push({
+        event,
+        position: document
+          .querySelector('[data-testid="replay-stage"]')
+          ?.getAttribute('data-replay-position'),
+        top: node.scrollTop,
+        height: node.scrollHeight,
+        viewport: node.clientHeight,
+        first: node.querySelector<HTMLElement>('[data-replay-step]')?.dataset.replayStep,
+        rows: node.querySelectorAll('[data-replay-step]').length
+      })
+      if (preceding.length > 4) preceding.shift()
+    }
+    const onScroll = (): void => record('scroll')
+    node.addEventListener('scroll', onScroll, { passive: true })
+    while (performance.now() - started < 20000) {
+      await new Promise(requestAnimationFrame)
+      samples++
+      maximumRows = Math.max(maximumRows, node.querySelectorAll('[data-replay-step]').length)
+      const position = Number(
+        document.querySelector('[data-testid="replay-stage"]')?.getAttribute('data-replay-position')
+      )
+      if (
+        !falseReturn &&
+        Array.from(node.querySelectorAll('button')).some(
+          (button) => button.textContent?.trim() === 'Return to current step'
+        )
+      ) {
+        falseReturn = {
+          position,
+          top: node.scrollTop,
+          gap: node.scrollHeight - node.clientHeight - node.scrollTop,
+          step: node.querySelector<HTMLElement>('[data-replay-active]')?.dataset.replayStep,
+          preceding: [...preceding]
+        }
+      }
+      record('frame')
+      if (position >= 16000) {
+        node.removeEventListener('scroll', onScroll)
+        return { samples, maximumRows, falseReturn, position }
+      }
+    }
+    throw new Error('Replay did not advance past the bounded conversation history window')
+  })
+  await panel.getByRole('button', { name: 'Pause replay', exact: true }).click()
+  expect(playback.samples).toBeGreaterThan(20)
+  expect(playback.maximumRows).toBe(12)
+  expect(playback.falseReturn).toBeUndefined()
+  await expectFollowing()
+
+  await readEarlier()
+  const pausedTime = await progress.getAttribute('aria-valuenow')
+  const readingTop = await conversation.evaluate((node) => node.scrollTop)
+  const originalHeight = (await conversation.boundingBox())!.height
+  // A native viewport resize while reading must not pull the reader back to the latest text.
+  await panel.evaluate((node) => {
+    const container = node.closest('[data-replay-container]') as HTMLElement
+    container.style.bottom = '10vh'
+  })
+  await expect
+    .poll(async () => (await conversation.boundingBox())!.height)
+    .toBeLessThan(originalHeight)
+  await expect.poll(() => conversation.evaluate((node) => node.scrollTop)).toBe(readingTop)
+  await expect(progress).toHaveAttribute('aria-valuenow', pa
```

**File**: `e2e/session-replay-navigation.spec.ts` (modified, +164/-0)
```diff
@@ -1,6 +1,7 @@
 import { expect } from '@playwright/test'
 import type { Locator, Page } from 'playwright'
 import type { PersistedChatSession } from '../src/shared/session-persistence'
+import type { SessionDiscussionSnapshot } from '../src/shared/session-replay'
 import { createProject } from './certification/helpers'
 import { test } from './fixtures/electron-app'
 
@@ -52,6 +53,169 @@ const sessionRow = (page: Page, title: string): Locator =>
 const replayTab = (page: Page, sourceId: string): Locator =>
   page.locator(`[id="preview-tab-${encodeURIComponent(`tool:${sourceId}:replay`)}"]`)
 
+test('asks immediately after seeking recorded artifact and upload steps without sending or replacing the draft', async ({
+  app
+}) => {
+  test.setTimeout(180_000)
+  await app.completeOnboarding()
+  let page = await app.configureFakeAgent()
+  const projectName = 'Recorded file step questions'
+  const projectId = await createProject(page, projectName)
+  const uploadName = 'recorded-observations.csv'
+  await page.locator('input[type="file"][multiple]').setInputFiles({
+    name: uploadName,
+    mimeType: 'text/csv',
+    buffer: Buffer.from('sample,value\nA,42\n')
+  })
+  await expect(
+    page.getByRole('button', { name: `Remove attachment ${uploadName}`, exact: true })
+  ).toBeVisible()
+  await page
+    .getByRole('textbox', { name: 'Ask anything', exact: true })
+    .fill('Create preview context menu artifacts.')
+  await page.getByRole('button', { name: 'Send message', exact: true }).click()
+  await expect(
+    page.getByText('Preview context menu artifacts created.', { exact: true })
+  ).toBeVisible({ timeout: 90_000 })
+  await expect(page.getByRole('button', { name: 'Stop generating' })).toHaveCount(0)
+  const recorded = await page.evaluate(async (projectId) => {
+    const session = (await window.api.sessions.loadAll()).sessions.find(
+      (session) => session.projectId === projectId
+    )!
+    return (await window.api.sessions.loadOne({ projectId, sessionId: session.id }))!
+  }, projectId)
+  const artifact = recorded.artifacts!.find((item) => item.name === 'context-menu.html')!
+  const upload = recorded.messages.flatMap((message) => message.uploads ?? [])[0]
+  expect(artifact.versionId).toBeTruthy()
+  expect(upload.versionId).toBeTruthy()
+  // Retain the native file/Version storage while restoring an imported, read-only source.
+  // A separate writable conversation receives its snapshots through the existing chooser.
+  const source: PersistedChatSession = {
+    ...recorded,
+    title: 'Imported recorded file evidence',
+    packageOrigin: sourceFixture(projectId, 'a').packageOrigin
+  }
+  const target: PersistedChatSession = {
+    ...sourceFixture(projectId, 'b'),
+    id: 'recorded-file-question-target',
+    title: 'File question discussion',
+    packageOrigin: undefined,
+    messages: []
+  }
+  await app.restartWithSessionFixture(target)
+  page = await app.restartWithSessionFixture(source)
+  await page
+    .getByRole('region', { name: 'Projects', exact: true })
+    .getByRole('button', { name: projectName, exact: true })
+    .click()
+  await sessionRow(page, source.title).click()
+  await page
+    .getByRole('region', { name: 'Imported research history', exact: true })
+    .getByRole('button', { name: 'View replay', exact: true })
+    .click()
+  await sessionRow(page, target.title).click()
+  const replay = page.getByTestId('replay-panel')
+  const editor = page.getByRole('textbox', { name: 'Ask anything', exact: true })
+  const draft = 'Which recorded file supports this conclusion?'
+  await expect(replay).toBeVisible()
+  await editor.fill(draft)
+  const prompts = await app.readFakeAgentPrompts()
+  const before = await page.evaluate((request) => window.api.sessions.loadOne(request), {
+    projectId,
+    sessionId: source.id
+  })
+  const snapshots = (): Promise<SessionDiscussionSnapshot[]> =>
+    page.evaluate((request) => window.api.sessionReplay.listSelectionSnapshots(request), {
+      projectId,
+      sourceSessionId: source.id
+    })
+  const captured: SessionDiscussionSnapshot[] = []
+
+  for (const file of [
+    { name: artifact.name!, kind: 'artifact-version', versionId: artifact.versionId! },
+    { name: uploadName, kind: 'upload-version', versionId: upload.versionId! }
+  ]) {
+    const previousIds = (await snapshots()).map((snapshot) => snapshot.id)
+    await replay.getByRole('button', { name: 'Browse steps', exact: true }).click()
+    const directory = page.getByRole('dialog', { name: 'Browse steps', exact: true })
+    await directory
+      .getByRole('button', { name: /^Go to step \d+:/ })
+      .filter({ hasText: file.name })
+      .click()
+    // Seek lands at offset zero and pauses. Asking immediately must use the recorded Version,
+    // without playing through a fabricated input/activity phase to make that evidence available.
+    await replay.getByRole('button', { name: 'Ask about this step', exact: true }).click()
+ 
```

**File**: `src/renderer/src/lib/replay/replay.test.ts` (modified, +6/-6)
```diff
@@ -587,10 +587,10 @@ describe('Replay deterministic time projection', () => {
     expect(result.showResults).toBe(true)
     expect(result.visibleEvidence.every((ref) => ref.part === 'record')).toBe(true)
     const file = branch.steps.find((step) => step.kind === 'artifact')!
-    expect(projectReplayScene(doc, branch.id, file.startMs).visibleResourceIds).toEqual([])
-    expect(
-      projectReplayScene(doc, branch.id, file.startMs + file.durationMs * 0.6).visibleResourceIds
-    ).toEqual(['artifact-version:v1'])
+    expect(projectReplayScene(doc, branch.id, file.startMs - 1).visibleResourceIds).toEqual([])
+    expect(projectReplayScene(doc, branch.id, file.startMs).visibleResourceIds).toEqual([
+      'artifact-version:v1'
+    ])
     expect(projectReplayScene(doc, branch.id, execution.startMs).visibleResourceIds).toEqual([])
   })
 
@@ -691,12 +691,12 @@ describe('historical reviews in replay', () => {
       branch.steps.findIndex((step) => step.message?.id === 'a')
     )
     expect(
-      projectReplayScene(doc, branch.id, step.startMs).visibleEvidence.some(
+      projectReplayScene(doc, branch.id, step.startMs - 1).visibleEvidence.some(
         (ref) => ref.kind === 'review'
       )
     ).toBe(false)
     expect(
-      projectReplayScene(doc, branch.id, step.endMs).visibleEvidence.some(
+      projectReplayScene(doc, branch.id, step.startMs).visibleEvidence.some(
         (ref) => ref.kind === 'review'
       )
     ).toBe(true)
```

**File**: `src/renderer/src/lib/replay/scene.ts` (modified, +3/-1)
```diff
@@ -37,8 +37,10 @@ export const projectReplayScene = (
   const step = branch.steps[stepIndex]
   const visibleSteps = branch.steps.slice(0, stepIndex + 1)
   const stepProgress = step ? clamp(position - step.startMs, step.durationMs) / step.durationMs : 0
+  // Standalone files and reviews are recorded outcomes, with no input or execution to animate.
+  // Expose their references immediately so seeking to a step also makes it discussable.
   const phase: ReplayPhase =
-    step?.kind === 'message'
+    step?.kind === 'message' || step?.kind === 'artifact' || step?.kind === 'review'
       ? 'result'
       : stepProgress < 0.2
         ? 'input'
```

**File**: `src/renderer/src/pages/workspace/annotations/annotation-reveal.test.ts` (modified, +85/-0)
```diff
@@ -21,6 +21,7 @@ import { validateAnnotations, type PdfAnnotation } from '../../../../../shared/a
 import { createLiteratureAttachmentVersionReference } from '../../../../../shared/literature'
 import type { Annotation } from '../../../../../shared/annotations'
 import { createUploadVersionReference } from '../../../../../shared/uploads'
+import { replayAnnotationId } from '../../../../../shared/replay-reference'
 import { createManagedPreviewRequest } from '../previews/preview-file-reader'
 import type { Bookmark } from '../../../../../shared/bookmarks'
 import type { PdfAnnotation as SavedPdfAnnotation } from '../../../../../shared/pdf-annotations'
@@ -66,6 +67,90 @@ describe('annotation reveal', () => {
     source: { kind: 'agent-message', sessionId: 'session-1', messageId: 'message-1' }
   })
 
+  it.each(['artifact', 'upload'] as const)(
+    'routes a saved %s replay reference to snapshot navigation without opening a file tab',
+    (fileSource) => {
+      const annotation: Annotation = {
+        id: replayAnnotationId(
+          {
+            projectId: 'project-1',
+            sourceSessionId: 'archive-session',
+            branchId: 'recorded-branch',
+            stepId: 'recorded-file-step',
+            stepOffsetMs: 0
+          },
+          'saved-selection'
+        ),
+        kind: 'text',
+        target: 'agent',
+        quote: 'Session: Archived study\n[3] observations.csv',
+        source: {
+          kind: 'project-file',
+          projectId: 'project-1',
+          sessionId: 'archive-session',
+          fileSource,
+          sourceFileId: 'file-1',
+          versionId: 'version-1',
+          path:
+            fileSource === 'artifact'
+              ? 'artifact-version:project-1/archive-session/file-1/version-1'
+              : createUploadVersionReference('version-1')
+        }
+      }
+      subscribeAnnotationReveal(() => true)()
+      const order: string[] = []
+      const prepare = vi.fn()
+      const offPrepare = subscribeAnnotationRevealPreparation((prepared) => {
+        prepare(prepared, usePreviewWorkbenchStore.getState().items)
+        order.push('prepare')
+      })
+      const reveal = vi.fn()
+      const offReveal = subscribeAnnotationReveal((id) => {
+        reveal(id)
+        order.push('reveal')
+        return true
+      })
+      try {
+        requestAnnotationReveal(annotation)
+        expect(order).toEqual(['prepare', 'reveal'])
+        expect(prepare).toHaveBeenCalledExactlyOnceWith(annotation, [])
+        expect(reveal).toHaveBeenCalledExactlyOnceWith(annotation.id)
+        expect(usePreviewWorkbenchStore.getState().items).toEqual([])
+      } finally {
+        offPrepare()
+        offReveal()
+      }
+    }
+  )
+
+  it('keeps native file navigation when the replay locator does not match the annotation source', () => {
+    requestAnnotationReveal({
+      id: replayAnnotationId({
+        projectId: 'project-1',
+        sourceSessionId: 'another-session',
+        branchId: 'branch',
+        stepId: 'step'
+      }),
+      kind: 'text',
+      target: 'agent',
+      quote: 'File content',
+      source: {
+        kind: 'project-file',
+        projectId: 'project-1',
+        sessionId: 'session-1',
+        path: 'artifact-version:project-1/session-1/file-1/version-1',
+        fileSource: 'artifact',
+        sourceFileId: 'file-1',
+        versionId: 'version-1'
+      }
+    })
+    expect(usePreviewWorkbenchStore.getState()).toMatchObject({
+      activeItemId: 'file-1',
+      items: [expect.objectContaining({ type: 'file', sessionId: 'session-1' })]
+    })
+    subscribeAnnotationReveal(() => true)()
+  })
+
   it('reveals inside a modal without opening workspace tabs and cancels delivery when closed', async () => {
     const annotation: SavedPdfAnnotation = {
       id: 'saved-note',
```

**File**: `src/renderer/src/pages/workspace/annotations/annotation-reveal.ts` (modified, +4/-1)
```diff
@@ -6,6 +6,7 @@ import {
 import { parseArtifactVersionLocator } from '../../../../../shared/artifact-provenance'
 import { parseLiteratureAttachmentVersionReference } from '../../../../../shared/literature'
 import { parseUploadVersionReference } from '../../../../../shared/uploads'
+import { replayAnnotationTarget } from '../../../../../shared/replay-reference'
 import type { PreviewFileItem } from '@/stores/preview-workbench-store'
 import { usePreviewWorkbenchStore } from '@/stores/preview-workbench-store'
 import type { PdfAnnotation as SavedPdfAnnotation } from '../../../../../shared/pdf-annotations'
@@ -232,7 +233,9 @@ const createAnnotationPreviewItem = (annotation: Annotation): PreviewFileItem |
 }
 
 const requestAnnotationReveal = (annotation: Annotation): void => {
-  if (!fileAnnotationSource(annotation)) {
+  // Replay references navigate through their captured position, including file-only steps.
+  // Their archive Session is not necessarily the uploaded file's native owner.
+  if (replayAnnotationTarget(annotation) || !fileAnnotationSource(annotation)) {
     publishAnnotationReveal(annotation)
     return
   }
```

**File**: `src/renderer/src/pages/workspace/replay/ReplayPanel.test.tsx` (modified, +68/-4)
```diff
@@ -537,12 +537,11 @@ describe('research replay interaction', () => {
       content: `Recorded ${resource.versionId}`
     }))
     render(<ReplayPanel document={document} {...props} readResource={readResource} />)
-    seekProgress(1100)
+    seekProgress(1000)
     expect(
       (screen.getByRole('button', { name: 'Preview generated file v1.txt' }) as HTMLButtonElement)
         .disabled
-    ).toBe(true)
-    seekProgress(3000)
+    ).toBe(false)
     const original = screen.getByRole('button', { name: 'Preview generated file v1.txt' })
     original.focus()
     fireEvent.click(original)
@@ -1394,14 +1393,17 @@ it('groups adjacent generated files in one gallery without changing timeline ste
   expect(cards).toHaveLength(2)
   expect(cards[0].parentElement).toBe(cards[1].parentElement)
   expect(source.branches[0].steps).toHaveLength(3)
+  seekProgress(1000)
+  expect(screen.getByRole('button', { name: 'Preview generated file v1.txt' })).toBeTruthy()
+  expect(screen.queryByRole('button', { name: 'Preview generated file v2.txt' })).toBeNull()
   seekProgress(2000)
   expect(screen.getAllByText('GENERATED · 2')).toHaveLength(1)
   expect(
     screen.getByRole('button', { name: 'Preview generated file v1.txt' }).hasAttribute('disabled')
   ).toBe(false)
   expect(
     screen.getByRole('button', { name: 'Preview generated file v2.txt' }).hasAttribute('disabled')
-  ).toBe(true)
+  ).toBe(false)
   seekProgress(0)
   expect(screen.queryByRole('button', { name: /Preview generated file/ })).toBeNull()
   await act(async () => {})
@@ -1553,3 +1555,65 @@ it('keeps standalone capture bounded when the interactive history is expanded',
   expect(container.querySelectorAll('[data-replay-step]')).toHaveLength(12)
   expect(screen.queryByRole('button', { name: 'Load earlier messages' })).toBeNull()
 })
+
+it('keeps replay following delayed automatic scroll and resumes after manual browsing', () => {
+  const resizeCallbacks: ResizeObserverCallback[] = []
+  vi.stubGlobal(
+    'ResizeObserver',
+    class {
+      constructor(callback: ResizeObserverCallback) {
+        resizeCallbacks.push(callback)
+      }
+      observe = vi.fn()
+      disconnect = vi.fn()
+    }
+  )
+  const resize = (): void => {
+    act(() => resizeCallbacks.forEach((callback) => callback([], {} as ResizeObserver)))
+  }
+  const source = makeDocument()
+  const scene = projectReplayScene(source, 'main', 1500)
+  const mounted = render(<ReplayStage fitContainer document={source} scene={scene} />)
+  const conversation = screen.getByRole('region', { name: 'Historical conversation' })
+  const returnButton = (): HTMLElement | null =>
+    within(conversation).queryByRole('button', { name: 'Return to current step' })
+  Object.defineProperties(conversation, {
+    clientHeight: { configurable: true, value: 400 },
+    scrollHeight: { configurable: true, writable: true, value: 1000 },
+    scrollTop: { configurable: true, writable: true, value: 0 }
+  })
+  resize()
+  expect(conversation.scrollTop).toBe(600)
+  // The prior automatic scroll event arrives after the next text chunk grew the transcript.
+  Object.defineProperty(conversation, 'scrollHeight', { value: 1400 })
+  fireEvent.scroll(conversation)
+  expect(returnButton()).toBeNull()
+  resize()
+  expect(conversation.scrollTop).toBe(1000)
+
+  conversation.scrollTop = 200
+  fireEvent.scroll(conversation)
+  expect(returnButton()).toBeTruthy()
+  Object.defineProperty(conversation, 'scrollHeight', { value: 1800 })
+  resize()
+  expect(conversation.scrollTop).toBe(200)
+  conversation.scrollTop = 1400
+  fireEvent.scroll(conversation)
+  expect(returnButton()).toBeNull()
+  Object.defineProperty(conversation, 'scrollHeight', { value: 2200 })
+  resize()
+  expect(conversation.scrollTop).toBe(1800)
+
+  conversation.scrollTop = 200
+  fireEvent.scroll(conversation)
+  fireEvent.click(returnButton()!)
+  expect(returnButton()).toBeNull()
+  expect(conversation.scrollTop).toBe(1800)
+  conversation.scrollTop = 200
+  fireEvent.scroll(conversation)
+  mounted.rerender(
+    <ReplayStage fitContainer document={source} scene={scene} conversationFocusRequest={1} />
+  )
+  expect(returnButton()).toBeNull()
+  expect(conversation.scrollTop).toBe(1800)
+})
```

**File**: `src/renderer/src/pages/workspace/replay/ReplayStage.tsx` (modified, +11/-15)
```diff
@@ -630,7 +630,11 @@ const ReplayStageContent = ({
     setBrowsingConversation(false)
   }
   const followingTranscript = useFollowScrollBottom(
-    fitContainer && (wide || !materialsOpen) && !browsingConversation
+    fitContainer && (wide || !materialsOpen) && historyStart === undefined,
+    {
+      onFollowingChange: (following) => setBrowsingConversation(!following),
+      resetKey: `${focusKey}:${returnRequest}`
+    }
   )
   const transcript = fitContainer ? followingTranscript : captureTranscript
   const [rememberConversationAnchor, releaseConversationAnchor] = usePrependAnchor(
@@ -646,10 +650,6 @@ const ReplayStageContent = ({
   const transcriptStart = fitContainer
     ? (historyStart ?? Math.max(0, scene.visibleSteps.length - REPLAY_TRANSCRIPT_STEP_LIMIT))
     : Math.max(0, scene.visibleSteps.length - REPLAY_TRANSCRIPT_STEP_LIMIT)
-  useLayoutEffect(() => {
-    if (!fitContainer || !transcript.current) return
-    transcript.current.scrollTop = transcript.current.scrollHeight
-  }, [fitContainer, transcript, focusKey, returnRequest])
   const notebookIndices = useMemo(() => {
     const indices = new Map<string, number>()
     for (const branch of replayDocument.branches)
@@ -1022,16 +1022,12 @@ const ReplayStageContent = ({
               ? `relative min-h-0 min-w-0 overflow-auto border-border-200 bg-bg-000 px-4 py-3 ${(showMaterialPane && !wide) || inspecting ? 'hidden' : 'block'}`
               : 'relative space-y-3 overflow-auto border-r border-border-200 bg-bg-10 p-5'
           }
-          style={{ scrollbarWidth: fitContainer ? undefined : 'none' }}
-          onScroll={
-            fitContainer
-              ? (event) => {
-                  const viewport = event.currentTarget
-                  if (viewport.scrollTop + viewport.clientHeight < viewport.scrollHeight - 4)
-                    setBrowsingConversation(true)
-                }
-              : undefined
-          }
+          // Interactive history has its own follow and prepend anchors. Native anchoring can
+          // pull the viewport upward when older rows leave the bounded playback window.
+          style={{
+            scrollbarWidth: fitContainer ? undefined : 'none',
+            overflowAnchor: fitContainer ? 'none' : undefined
+          }}
         >
           <div className={fitContainer ? 'space-y-1' : 'space-y-3'}>
             {fitContainer && transcriptStart > 0 ? (
```

---

### Incident Patch 7: `21d01e55` (2026-10-05)
**Commit Message**: fix(notebook): project cross-language file lineage (#3296)

* fix(notebook): harden cross-language file lineage

* fix(notebook): guard ambiguous read-write lineage

* fix(notebook): invalidate stale scoped producers

* fix(notebook): quarantine incomplete file writes

* fix(provenance): preserve missing file dependencies

* fix(provenance): retain unresolved file reads

* fix(notebook): quarantine partial scoped writes

* fix(provenance): reject post-cell cwd lineage

* fix(provenance): normalize scoped lineage paths

* fix(notebook): restore file context semantics

* fix(notebook): satisfy static lint checks

* fix(notebook): preserve REPL file context

* fix(notebook): preserve evidence-backed relative lineage

Use complete runtime file evidence as a compatibility anchor for historical runs that lack cwd metadata while retaining strict barriers for ambiguous writes. Register the dependency projection in Windows CI coverage and record all statically reachable notebook consumers.

* fix(notebook): preserve live lineage context

* fix(provenance): match cwd-less scoped generations

* fix(provenance): invalidate companion aliases on overwrite

**File**: `scripts/ci/change-impact.json` (modified, +1/-0)
```diff
@@ -187,6 +187,7 @@
         "src/main/local-rpc-transport.ts",
         "src/main/notebook/dependency-analysis-python.ts",
         "src/main/notebook/dependency-analysis-repl.ts",
+        "src/main/notebook/dependency-projection.ts",
         "src/main/notebook/conditional-restore-script.ts",
         "src/main/notebook/environment-discovery.ts",
         "src/main/notebook/environment-lock.ts",
```

**File**: `scripts/ci/module-impact/desktop_composition.json` (modified, +5/-1)
```diff
@@ -1198,7 +1198,11 @@
       "src/main/acp/approved-handoff-outcome.test.ts",
       "src/main/pdf-annotations/sharing.integration.test.ts",
       "src/main/database/pdf-annotations-migration.test.ts",
-      "src/main/agent-framework/claude-shared-settings.integration.test.ts"
+      "src/main/agent-framework/claude-shared-settings.integration.test.ts",
+      "src/main/notebook/dependency-analysis.anndata.test.ts",
+      "src/main/notebook/dependency-analysis.heatmap.test.ts",
+      "src/main/notebook/dependency-analysis.pycirclize.test.ts",
+      "src/main/notebook/dependency-analysis.set-intersections.test.ts"
     ]
   },
   "capabilityOverlays": ["e2e_regressions", "e2e_delegation", "windows_sensitive"],
```

**File**: `scripts/ci/module-impact/main_storage.json` (modified, +5/-1)
```diff
@@ -741,7 +741,11 @@
       "src/renderer/src/lib/compute/useJobAnalysisEffect.render.test.tsx",
       "src/main/acp/approved-handoff-outcome.integration.test.ts",
       "src/main/acp/approved-handoff-outcome.test.ts",
-      "src/main/pdf-annotations/sharing.integration.test.ts"
+      "src/main/pdf-annotations/sharing.integration.test.ts",
+      "src/main/notebook/dependency-analysis.anndata.test.ts",
+      "src/main/notebook/dependency-analysis.heatmap.test.ts",
+      "src/main/notebook/dependency-analysis.pycirclize.test.ts",
+      "src/main/notebook/dependency-analysis.set-intersections.test.ts"
     ]
   },
   "capabilityOverlays": ["e2e_regressions", "e2e_delegation", "windows_sensitive"],
```

**File**: `scripts/ci/module-impact/notebook_application.json` (modified, +1/-0)
```diff
@@ -290,6 +290,7 @@
     "src/main/notebook/fixtures/lineage/native-array-report-handoff.json",
     "src/main/notebook/fixtures/lineage/native-model-missing-global.json",
     "src/main/notebook/fixtures/lineage/native-callback-helper-promises.json",
+    "src/main/notebook/fixtures/science/cross-language-lineage.fixture.jsonl",
     "src/main/notebook/dependency-analysis.lineage-regressions.test.ts",
     "src/main/notebook/host-session-reading.ts"
   ],
```

**File**: `scripts/ci/module-impact/upload_repository.json` (modified, +57/-1)
```diff
@@ -494,7 +494,63 @@
       "src/main/session-persistence/terminal-commit-scheduler.test.ts",
       "src/main/session-persistence/attention-projection.test.ts",
       "src/main/acp/approved-handoff-outcome.integration.test.ts",
-      "src/main/acp/approved-handoff-outcome.test.ts"
+      "src/main/acp/approved-handoff-outcome.test.ts",
+      "src/main/notebook/dependency-analysis.anndata.test.ts",
+      "src/main/notebook/dependency-analysis.bioinformatics.test.ts",
+      "src/main/notebook/dependency-analysis.heatmap.test.ts",
+      "src/main/notebook/dependency-analysis.pycirclize.test.ts",
+      "src/main/notebook/dependency-analysis.python-state.test.ts",
+      "src/main/notebook/dependency-analysis.repl.test.ts",
+      "src/main/notebook/dependency-analysis.set-intersections.test.ts",
+      "src/main/notebook/dependency-analysis.test.ts",
+      "src/main/notebook/dependency-analysis.venn-counter.test.ts",
+      "src/main/notebook/dependency-projection.r-packages.test.ts",
+      "src/main/notebook/dependency-analysis.aggregate-volcano.test.ts",
+      "src/main/notebook/dependency-analysis.callbacks.test.ts",
+      "src/main/notebook/dependency-analysis.common-workflows.test.ts",
+      "src/main/notebook/dependency-analysis.contrasts-volcano.test.ts",
+      "src/main/notebook/dependency-analysis.cross-language-volcano.test.ts",
+      "src/main/notebook/dependency-analysis.cwd-lineage.test.ts",
+      "src/main/notebook/dependency-analysis.dev-web.test.ts",
+      "src/main/notebook/dependency-analysis.file-context.test.ts",
+      "src/main/notebook/dependency-analysis.finite-volcano.test.ts",
+      "src/main/notebook/dependency-analysis.font-fallback-volcano.test.ts",
+      "src/main/notebook/dependency-analysis.intermediate-files.test.ts",
+      "src/main/notebook/dependency-analysis.joined-volcano.test.ts",
+      "src/main/notebook/dependency-analysis.layered-volcano.test.ts",
+      "src/main/notebook/dependency-analysis.marginal-volcano.test.ts",
+      "src/main/notebook/dependency-analysis.mixed-venn.test.ts",
+      "src/main/notebook/dependency-analysis.notebook-repro.test.ts",
+      "src/main/notebook/dependency-analysis.numeric-updates.test.ts",
+      "src/main/notebook/dependency-analysis.omics-workflows.test.ts",
+      "src/main/notebook/dependency-analysis.path-plot.test.ts",
+      "src/main/notebook/dependency-analysis.pipe-equivalence.test.ts",
+      "src/main/notebook/dependency-analysis.piped-volcano.test.ts",
+      "src/main/notebook/dependency-analysis.python-data-science.test.ts",
+      "src/main/notebook/dependency-analysis.r-callbacks.test.ts",
+      "src/main/notebook/dependency-analysis.r-paths.test.ts",
+      "src/main/notebook/dependency-analysis.r-table-workflows.test.ts",
+      "src/main/notebook/dependency-analysis.rds-chord.test.ts",
+      "src/main/notebook/dependency-analysis.rds-clean-volcano.test.ts",
+      "src/main/notebook/dependency-analysis.rds-envelope.test.ts",
+      "src/main/notebook/dependency-analysis.recovery.test.ts",
+      "src/main/notebook/dependency-analysis.repel-volcano.test.ts",
+      "src/main/notebook/dependency-analysis.retry-volcano.test.ts",
+      "src/main/notebook/dependency-analysis.scientific.test.ts",
+      "src/main/notebook/dependency-analysis.stdlib-replay.test.ts",
+      "src/main/notebook/dependency-analysis.subplots.test.ts",
+      "src/main/notebook/dependency-analysis.venn-export-failure.test.ts",
+      "src/main/notebook/dependency-analysis.venn-font-recovery.test.ts",
+      "src/main/notebook/dependency-analysis.venn-layers.test.ts",
+      "src/main/notebook/dependency-analysis.venn-partitions.test.ts",
+      "src/main/notebook/dependency-analysis.venn-region-chain.test.ts",
+      "src/main/notebook/dependency-analysis.venn-regions.test.ts",
+      "src/main/notebook/dependency-analysis.venn.test.ts",
+      "src/main/notebook/dependency-analysis.volcano.test.ts",
+      "src/main/notebook/dependency-analysis.welch-volcano.test.ts",
+      "src/main/notebook/dependency-analysis.with-volcano.test.ts",
+      "src/main/notebook/dependency-analysis.xml.test.ts",
+      "src/main/notebook/source-file-access-analysis.deferred-tasks.test.ts"
     ]
   },
   "capabilityOverlays": ["windows_sensitive", "e2e_regressions", "e2e_delegation"],
```

**File**: `src/main/artifacts/artifact-provenance-graph.test.ts` (modified, +184/-0)
```diff
@@ -186,6 +186,190 @@ const recipeRun = (
 })
 
 describe('artifact provenance graph', () => {
+  it('retains advisory cross-language file dependencies from notebook projection', () => {
+    const graph = sealArtifactProvenanceGraph({
+      target: target(),
+      notebookActivities: [
+        notebookActivity('run-1', 1, []),
+        notebookActivity('run-2', 2, [
+          {
+            relation: 'created',
+            relativePath: 'result.csv',
+            pathPortability: 'relative',
+            authority: 'advisory',
+            generation: generation('g-target', 'result.csv', checksum('b'))
+          }
+        ])
+      ],
+      computeActivities: [],
+      notebookDependencies: {
+        stalenessByRunId: {
+          'run-1': { state: 'clear' },
+          'run-2': { state: 'clear' }
+        },
+        invalidatedByRunId: {},
+        dependenciesByRunId: { 'run-1': [], 'run-2': [] },
+        fileDependenciesByRunId: {
+          'run-2': [
+            {
+              producerRunId: 'run-1',
+              path: 'outputs/intermediate.csv',
+              checksum: checksum('a'),
+              confidence: 'verified'
+            }
+          ]
+        }
+      }
+    })
+    expect(graph.edges).toContainEqual({
+      kind: 'depends-on',
+      activityId: 'run-2',
+      dependencyActivityId: 'run-1',
+      authority: 'advisory',
+      evidenceSource: 'dependency-analysis'
+    })
+  })
+
+  it('marks a missing file producer as truncated provenance history', () => {
+    const graph = sealArtifactProvenanceGraph({
+      target: target(),
+      notebookActivities: [
+        notebookActivity('run-2', 2, [
+          {
+            relation: 'created',
+            relativePath: 'result.csv',
+            pathPortability: 'relative',
+            authority: 'advisory',
+            generation: generation('g-target', 'result.csv', checksum('b'))
+          }
+        ])
+      ],
+      computeActivities: [],
+      notebookDependencies: {
+        stalenessByRunId: { 'run-2': { state: 'clear' } },
+        invalidatedByRunId: {},
+        dependenciesByRunId: { 'run-2': [] },
+        fileDependenciesByRunId: {
+          'run-2': [
+            {
+              producerRunId: 'run-missing',
+              path: 'outputs/intermediate.csv',
+              checksum: checksum('a'),
+              confidence: 'verified'
+            }
+          ]
+        }
+      }
+    })
+    expect(graph.completeness).toBe('incomplete')
+    expect(graph.reasonCodes).toContain('history-truncated')
+    expect(graph.edges).not.toContainEqual(
+      expect.objectContaining({
+        kind: 'depends-on',
+        activityId: 'run-2',
+        dependencyActivityId: 'run-missing'
+      })
+    )
+  })
+
+  it('preserves unresolved file reads through analysis restart and target closure', async () => {
+    const root = await mkdtemp(join(tmpdir(), 'unresolved-file-lineage-'))
+    const scripts = [
+      'from pathlib import Path\nPath("intermediate.csv").write_text("old")',
+      'from pathlib import Path\nPath("intermediate.csv").write_text("new")',
+      'from pathlib import Path\nvalue = Path("intermediate.csv").read_text()\nPath("result.csv").write_text(value)'
+    ]
+    const activities = scripts.map((script, index) =>
+      notebookActivity(
+        `run-${index}`,
+        index,
+        index === 2
+          ? [
+              {
+                relation: 'created',
+                relativePath: 'result.csv',
+                pathPortability: 'relative',
+                authority: 'advisory',
+                generation: generation('g-target', 'result.csv', checksum('b'))
+              }
+            ]
+          : [],
+        {
+          script,
+          cwdBefore: root,
+          cwdAfter: root,
+          kernelEpochId: `epoch-${index}`,
+          workingFiles:
+            index === 0
+              ? [
+                  {
+                    path: join(root, 'intermediate.csv'),
+                    relativePath: 'intermediate.csv',
+                    kind: 'other',
+                    createdByRunId: 'run-0',
+                    change: 'created',
+                    checksum: checksum('a')
+                  }
+                ]
+              : []
+        }
+      )
+    )
+    try {
+      const options = {
+        storageRoot: root,
+        repository: { readSessionRuns: async () => activities.map(({ run }) => run) }
+      }
+      const request = { projectId: 'p', sessionId: 's', throughRunId: 'run-2' }
+      const projection = await new NotebookDependencyAnalyzer(options).project(request)
+      expect(projection.stalenessByRunId['run-2']).toEqual({ state: 'clear' })
+      expect(projection.unresolvedFileReadRunIds).toEqual(['run-2'])
+      expect(projection.fileDependenciesByRunId?.['run-2']).toBeUndefined()
+      const reloaded = await new NotebookDependencyAnalyzer(options).project(request)
+      expect(reloaded.unresolvedFileReadRunIds
```

**File**: `src/main/artifacts/artifact-provenance-graph.ts` (modified, +37/-6)
```diff
@@ -788,7 +788,9 @@ const sealArtifactProvenanceGraph = (
     )
   )
   const completeKernelDependencyActivityIds = new Set<string>()
-  const missingKernelDependencyActivityIds = new Set<string>()
+  const missingDependencyActivityIds = new Set(
+    input.notebookDependencies?.unresolvedFileReadRunIds ?? []
+  )
   if (input.notebookDependencies) {
     for (const [activityId, candidate] of notebookCandidateById) {
       const dependencies = input.notebookDependencies.dependenciesByRunId?.[activityId]
@@ -807,7 +809,7 @@ const sealArtifactProvenanceGraph = (
           candidate.notebookRun.kernelEpochId !== dependency.notebookRun?.kernelEpochId ||
           dependency.activity.sequence >= candidate.activity.sequence
         ) {
-          missingKernelDependencyActivityIds.add(activityId)
+          missingDependencyActivityIds.add(activityId)
           completeKernelDependencyActivityIds.delete(activityId)
           continue
         }
@@ -820,6 +822,32 @@ const sealArtifactProvenanceGraph = (
         })
       }
     }
+    for (const [activityId, dependencies] of Object.entries(
+      input.notebookDependencies.fileDependenciesByRunId ?? {}
+    )) {
+      const candidate = notebookCandidateById.get(activityId)
+      if (!candidate) continue
+      for (const dependency of dependencies) {
+        const dependencyCandidate = notebookCandidateById.get(dependency.producerRunId)
+        if (
+          !dependencyCandidate ||
+          dependencyCandidate.activity.sequence >= candidate.activity.sequence
+        ) {
+          missingDependencyActivityIds.add(activityId)
+          continue
+        }
+        // Static source analysis plus an observed generation identifies the producer, but does
+        // not prove that the runtime opened this exact path. Keep the edge advisory so replay
+        // barriers remain conservative when runtime file evidence is incomplete.
+        mergeEdge(edges, {
+          kind: 'depends-on',
+          activityId,
+          dependencyActivityId: dependency.producerRunId,
+          authority: 'advisory',
+          evidenceSource: 'dependency-analysis'
+        })
+      }
+    }
   }
   const priorOutputByPath = new Map<
     string,
@@ -1108,11 +1136,14 @@ const sealArtifactProvenanceGraph = (
     const kernelDependenciesComplete = input.notebookDependencies
       ? completeKernelDependencyActivityIds.has(activityId)
       : fileReadsComplete
-    if (kernelDependenciesComplete) continue
-    if (missingKernelDependencyActivityIds.has(activityId)) reasons.add('history-truncated')
+    const missingDependency = missingDependencyActivityIds.has(activityId)
+    if (missingDependency) reasons.add('history-truncated')
+    if (kernelDependenciesComplete && !missingDependency) continue
     if (!fileReadsComplete) reasons.add('file-reads-unavailable')
-    if (!candidate.notebookRun.kernelEpochId) reasons.add('kernel-epoch-unknown')
-    reasons.add('kernel-dependencies-unavailable')
+    if (!kernelDependenciesComplete) {
+      if (!candidate.notebookRun.kernelEpochId) reasons.add('kernel-epoch-unknown')
+      reasons.add('kernel-dependencies-unavailable')
+    }
   }
 
   for (const activityId of selectedActivityIds) {
```

**File**: `src/main/notebook/analysis-version.ts` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
 // Bump the revision whenever dependency or source-file analysis semantics change.
 // The format version is independent: rule additions do not require a data migration.
 export const NOTEBOOK_ANALYZER_VERSION = 1 as const
-export const NOTEBOOK_ANALYZER_REVISION = 'tree-sitter-in-process-127'
+export const NOTEBOOK_ANALYZER_REVISION = 'tree-sitter-in-process-129-unresolved-file-lineage'
```

---

### Incident Patch 8: `0020e276` (2026-10-05)
**Commit Message**: fix(pdf-structure): harden external literature layout extraction (#3286)

* fix(pdf-structure): recover external layout evidence

* test(pdf-structure): add anonymous layout regressions

* fix(pdf-structure): constrain vector heatmap ownership

* fix(pdf-structure): satisfy review and static checks

* fix(pdf-structure): require duplicate table evidence

* fix(pdf-structure): preserve expanded crop geometry

* fix(pdf-structure): tighten table ownership recovery

* fix(pdf-structure): guard header row recovery

* fix(pdf-structure): preserve fragmented caption identity

* fix(pdf-structure): require table crop ownership

* fix(pdf-structure): preserve split token provenance

* fix(pdf-structure): tighten table recovery proofs

* test(pdf-structure): cover two-line prose crop guard

* fix(pdf-structure): preserve table ownership evidence

* fix(pdf-structure): serialize recovered figure captions

* fix(pdf-structure): narrow crop ownership reconciliation

* fix(pdf-structure): preserve interior table rows

* fix(pdf-structure): scope caption and header recovery evidence

* fix(pdf-structure): split dense rows and preserve table boundaries

* fix(pdf-structure): close external layout

**File**: `resources/pdf-structure/literature-pdf-association.mjs` (modified, +445/-26)
```diff
@@ -29,7 +29,19 @@ import { nativeConnectedKeyedLegend } from './literature-pdf-figure-connected-ke
 import { nativeAttachedPlotLabels } from './literature-pdf-figure-native-plot-labels.mjs'
 import {
   nativeCaptionedTextIllustration,
-  nativeLetteredRasterArray
+  nativeCaptionedVectorDiagram,
+  nativeCaptionedVectorGrid,
+  nativeCaptionedVectorHeatmap,
+  nativeCaptionedWorkflowPanel,
+  nativeCaptionedRaster,
+  nativeCaptionedFramedRaster,
+  nativeCaptionedFramedRasterTextPanel,
+  nativeCaptionedRasterArrayFragment,
+  nativeLetteredRasterArray,
+  nativeCaptionedRasterQuad,
+  nativeCaptionedRasterDualPanelGrid,
+  nativeCaptionedRasterModerateGap,
+  nativeRasterGrid
 } from './literature-pdf-figure-native-captioned-illustration.mjs'
 import {
   nativeCaptionedPlotBand,
@@ -594,29 +606,310 @@ export function associateFigures(
   closedFrames = [],
   nativeTokens = []
 ) {
-  return associateFigureFaces(page, candidates, tableRects, rules, closedFrames, nativeTokens).map(
-    (figure) => {
-      const attached = nativeAttachedPlotLabels(
+  const associated = associateFigureFaces(
+    page,
+    candidates,
+    tableRects,
+    rules,
+    closedFrames,
+    nativeTokens
+  )
+  return associated.map((figure) => {
+    // Letter-range captions (for example ``Figure 1A-B``) can own a vertically
+    // stacked raster pair even when the ordinary adjacency pass assigns only
+    // the panel nearest the caption.  The pair proof is deliberately narrow:
+    // two same-width images, one column, no competing caption or table.
+    const letteredPair = recoverLetteredRasterPair(page, figure, candidates, tableRects)
+    if (letteredPair) figure = { ...figure, ...letteredPair }
+    // A detached label immediately above a raster is figure content unless a
+    // matching distant running header proves it is page furniture.  Keep that
+    // label when the independent header witness is absent.
+    const topLabel = recoverUnmatchedTopFigureLabel(page, figure)
+    if (topLabel) figure = { ...figure, rect: topLabel }
+    // Include a closing rule that is painted immediately below a raster frame;
+    // the rule is part of the complete source extent, not article furniture.
+    const inkExpanded = expandAdjacentFigureInk(page, figure)
+    if (inkExpanded) figure = { ...figure, rect: inkExpanded }
+    // A vector plot can be mistaken for a graphical table before figure
+    // association runs. When that table shadow covers the complete plot, the
+    // ordinary table barrier hides every useful path and leaves the caption
+    // unresolved. Retry only with a narrowly proved plot-like shadow; this
+    // keeps text-only/vector illustrations on the existing no-crop contract.
+    if (!figure.rect) {
+      const adjacent = recoverIsolatedAdjacentFigure(
         page,
         figure,
         candidates,
         tableRects,
         rules,
+        closedFrames,
         nativeTokens
       )
-      // A long listing can contain hundreds of stroked glyphs. It looks like a
-      // large connected drawing to the geometry pass, but it is not a figure
-      // and must not be published as one. Require a substantial image/path
-      // plate before accepting a text-dominant result.
-      if (attached.rect && isTextDominantFigure(page, attached, candidates))
-        return { ...attached, rect: undefined, issue: 'text-dominant-graphics' }
-      if (!attached.rect && isTextDominantPage(page, candidates))
-        return { ...attached, issue: 'text-dominant-graphics' }
-      if (attached.rect) return attached
-      const recovered = recoverConservativeFigureRect(page, attached, tableRects, candidates)
-      return recovered ? { ...attached, rect: recovered, issue: undefined } : attached
+      if (adjacent?.rect) figure = adjacent
     }
+    if (!figure.rect) {
+      const recovered = recoverGraphicalTableShadowFigure(
+        page,
+        figure,
+        candidates,
+        tableRects,
+        rules,
+        closedFrames,
+        nativeTokens
+      )
+      if (recovered?.rect) figure = recovered
+    }
+    const attached = nativeAttachedPlotLabels(
+      page,
+      figure,
+      candidates,
+      tableRects,
+      rules,
+      nativeTokens
+    )
+    // A long listing can contain hundreds of stroked glyphs. It looks like a
+    // large connected drawing to the geometry pass, but it is not a figure
+    // and must not be published as one. Require a substantial image/path
+    // plate before accepting a text-dominant result.
+    if (attached.rect && isTextDominantFigure(page, attached, candidates))
+      return { ...attached, rect: undefined, issue: 'text-dominant-graphics' }
+    if (!attached.rect && isTextDominantPage(page, candidates))
+      return { ...attached, issue: 'text-dominant-graphics' }
+    if (attached.rect) return attached
+    const recovered = recoverConservativeFigureRect(page, attached, tableRects, candidates)
+    return recovered ? { ...attach
```

**File**: `resources/pdf-structure/literature-pdf-extract.mjs` (modified, +41/-6)
```diff
@@ -46,7 +46,10 @@ import {
   splitCaptionedTableRegions,
   recoverCaptionedRuledTables
 } from './literature-pdf-table-refine.mjs'
-import { deduplicateTableRegions } from './literature-pdf-table-regions.mjs'
+import {
+  deduplicateTableRegions,
+  narrativeDuplicateTableIndices
+} from './literature-pdf-table-regions.mjs'
 import {
   splitRuledComparisonSections,
   groupRuledComparisonSections
@@ -1009,8 +1012,31 @@ try {
           nativeFigureTokens
         )
       ].filter((f) => f.rect)
+      const captionedTableIndices = new Set(
+        associations.flatMap((association, index) => (association.caption ? [index] : []))
+      )
+      for (const [index, table] of refined.entries()) {
+        const crop = table?.cropRect
+        if (!crop) continue
+        const hasNearbyCaption = pageCaptions.some((caption) => {
+          if (captionKind(caption.lines?.[0]) !== 'table' || !caption.rect) return false
+          const overlap = Math.min(caption.rect[2], crop[2]) - Math.max(caption.rect[0], crop[0])
+          const width = Math.min(caption.rect[2] - caption.rect[0], crop[2] - crop[0])
+          if (overlap / Math.max(1, width) < 0.5) return false
+          const aboveGap = crop[1] - caption.rect[3]
+          return (
+            (aboveGap >= -2 && aboveGap <= 36) ||
+            (caption.rect[1] >= crop[1] && caption.rect[3] <= crop[3])
+          )
+        })
+        if (hasNearbyCaption) captionedTableIndices.add(index)
+      }
+      const narrativeDuplicates = narrativeDuplicateTableIndices(refined, {
+        captionedIndices: captionedTableIndices
+      })
       const acceptedTables = refined.map(
         (table, index) =>
+          !narrativeDuplicates.has(index) &&
           !isExternalAttachmentTableRegion(table, tokens, rules, associations[index].caption) &&
           !isNativeAuthorAffiliationRegion(
             table,
@@ -1339,6 +1365,15 @@ try {
       }
       for (const [index, candidate] of pageFigures.entries()) {
         const id = `p${pageNumber}-figure-${index + 1}`
+        const resolvedCaption = resolveFigureCaption(candidate.caption, captions, geometry.pages)
+        const serializedCaption = candidate.captionLines
+          ? {
+              ...(resolvedCaption ?? candidate.caption),
+              lines: candidate.captionLines,
+              rect: candidate.captionRect ?? candidate.caption?.rect
+            }
+          : resolvedCaption
+        const captionRect = serializedCaption?.rect ?? candidate.caption?.rect
         // Advance boxes can miss glyph ink at an edge. Match the earlier diagnostic's 2px guard,
         // bounded by the page and the caption; publish the same expanded region used by the crop.
         const rect = candidate.rect && [
@@ -1347,23 +1382,23 @@ try {
             0,
             candidate.rect[1] - 2 / scale,
             nativeProseInkTopLimit(candidate, nativeFigureTokens),
-            candidate.caption?.page === pageNumber && candidate.caption.rect[3] <= candidate.rect[1]
-              ? candidate.caption.rect[3] + 0.5
+            serializedCaption?.page === pageNumber && captionRect?.[3] <= candidate.rect[1]
+              ? captionRect[3] + 0.5
               : 0
           ),
           Math.min(pageGeometry.width, candidate.rect[2] + 2 / scale),
           Math.min(
             pageGeometry.height,
-            candidate.caption?.page === pageNumber && candidate.caption.rect[1] >= candidate.rect[3]
-              ? candidate.caption.rect[1] - 0.5
+            serializedCaption?.page === pageNumber && captionRect?.[1] >= candidate.rect[3]
+              ? captionRect[1] - 0.5
               : pageGeometry.height,
             candidate.rect[3] + 2 / scale
           )
         ]
         figures.push({
           id,
           page: pageNumber,
-          caption: captionValue(resolveFigureCaption(candidate.caption, captions, geometry.pages)),
+          caption: captionValue(serializedCaption),
           region: rect ? normalize(rect, pageGeometry.width, pageGeometry.height) : undefined,
           thumbnail: rect ? await crop(rect, id) : undefined,
           issue: candidate.issue ?? candidate.reason,
```

**File**: `resources/pdf-structure/literature-pdf-figure-native-captioned-illustration.mjs` (modified, +1060/-10)
```diff
@@ -1,7 +1,11 @@
 /* eslint-disable @typescript-eslint/explicit-function-return-type */
 import { area, intersection, union, lineRect } from './literature-pdf-page-geometry.mjs'
 
-const contains = (a, b) => b[0] >= a[0] && b[1] >= a[1] && b[2] <= a[2] && b[3] <= a[3]
+const contains = (a, b, tolerance = 0) =>
+  b[0] >= a[0] - tolerance &&
+  b[1] >= a[1] - tolerance &&
+  b[2] <= a[2] + tolerance &&
+  b[3] <= a[3] + tolerance
 const graphics = (page, kind) =>
   page.graphicsBounds
     .filter((g) => g.kind === kind)
@@ -18,14 +22,65 @@ const blocked = (rect, caption, captions, tables) =>
   tables.some((r) => intersection(r, rect) > 0) ||
   captions.some((c) => c !== caption && c.page === caption.page && intersection(c.rect, rect) > 0)
 
+// Some native text figures draw their frame as four independent rules rather
+// than one closed path. Join only aligned horizontal/vertical segments that
+// form a closed rectangle; the text proof below still has to establish that
+// the rectangle is an illustration rather than a table or paragraph.
+const segmentedFrameRects = (paths, font) => {
+  const tolerance = Math.max(2, font * 1.5)
+  const thin = Math.max(2, font * 1.15)
+  const horizontal = paths.filter(
+    (r) => r[2] - r[0] >= font * 20 && r[3] - r[1] <= thin && r[3] - r[1] > 0
+  )
+  const vertical = paths.filter(
+    (r) => r[3] - r[1] >= font * 5 && r[2] - r[0] <= thin && r[2] - r[0] > 0
+  )
+  const close = (a, b) => Math.abs(a - b) <= tolerance
+  const frames = []
+  for (const top of horizontal) {
+    for (const bottom of horizontal) {
+      if (bottom[1] - top[3] < font * 5) continue
+      if (!close(top[0], bottom[0]) || !close(top[2], bottom[2])) continue
+      const left = vertical.find(
+        (r) =>
+          close(r[0], top[0]) &&
+          close(r[2], top[0]) &&
+          r[1] <= top[1] + tolerance &&
+          r[3] >= bottom[3] - tolerance
+      )
+      const right = vertical.find(
+        (r) =>
+          close(r[0], top[2]) &&
+          close(r[2], top[2]) &&
+          r[1] <= top[1] + tolerance &&
+          r[3] >= bottom[3] - tolerance
+      )
+      if (!left || !right) continue
+      const rect = [
+        Math.min(top[0], bottom[0], left[0], right[0]),
+        Math.min(top[1], bottom[1], left[1], right[1]),
+        Math.max(top[2], bottom[2], left[2], right[2]),
+        Math.max(top[3], bottom[3], left[3], right[3])
+      ]
+      if (!frames.some((r) => r.every((v, i) => Math.abs(v - rect[i]) <= tolerance)))
+        frames.push(rect)
+    }
+  }
+  return frames
+}
+
 // A native outer drawing and distinctly smaller typeset contents prove the
 // illustrated text face independently of paragraph-length exclusion heuristics.
 export function nativeCaptionedTextIllustration(page, caption, captions, tables) {
   const font = captionFont(page, caption)
   if (!(font > 0) || !Number.isFinite(font)) return
   const paths = graphics(page, 'path')
-  const proofs = paths
-    .filter((r) => {
+  const candidateRects = [
+    ...paths.map((rect) => ({ rect, segmented: false })),
+    ...segmentedFrameRects(paths, font).map((rect) => ({ rect, segmented: true }))
+  ]
+  const proofs = candidateRects
+    .filter(({ rect: r, segmented }) => {
       if (
         !r.every(Number.isFinite) ||
         r[2] - r[0] < font * 20 ||
@@ -37,27 +92,672 @@ export function nativeCaptionedTextIllustration(page, caption, captions, tables)
       )
         return false
       const contents = page.lines.filter((l) => contains(r, lineRect(l)) && l.text.trim())
+      // Some publishers draw a framed prompt card with an inset border and
+      // keep its body at the regular text size, just above the caption size.
+      // The inset border is a strict ownership witness; without it retain
+      // the older, smaller-body threshold so ordinary prose stays deferred.
+      const nestedFrame = paths.some((other) => {
+        if (other === r || area(other) <= area(r) * 0.35) return false
+        const ratio = area(other) / area(r)
+        const tolerance = Math.max(2, font * 1.5)
+        const duplicate =
+          ratio >= 0.98 &&
+          ratio <= 1.02 &&
+          other.every((value, index) => Math.abs(value - r[index]) <= tolerance)
+        return (ratio < 0.98 || duplicate) && contains(r, other, tolerance)
+      })
+      // Prompt-style text panels often keep their title at the caption size
+      // while setting the body one point smaller.  Ignore that title line,
+      // but require enough smaller body text to prove this is an illustration
+      // rather than an ordinary paragraph.
+      const body = (segmented ? contents.slice(1) : contents).filter(
+        (l) => l.fontSize > 0 && l.fontSize <= font * (segmented ? 1.05 : nestedFrame ? 1.2 : 0.95)
+      )
+      const title = segmented
+        ? contents.slice(0, 1)
+        : nestedFrame
+          ? []
+          : contents.filter((l) => l.fontSize > font * 0.95)
       return (
-        content
```

**File**: `resources/pdf-structure/literature-pdf-front-matter.mjs` (modified, +74/-1)
```diff
@@ -17,6 +17,29 @@ const numeric = /^[-+−]?\d+(?:[.,]\d+)?(?:%|[a-z])?$/i
 const affiliation =
   /\b(?:University|Universit[ée]?|College|School|Department|Division|Institute|Laboratory|Lab|Hospital|Center|Centre|Clinic|Faculty)\b/i
 const authorLike = /^(?:\d+(?:st|nd|rd|th)?\s+)?[A-Z][\p{L}'’.-]+(?:\s+[A-Z][\p{L}'’.-]+){1,5}$/u
+const institutionLike =
+  /\b(?:University|Universit[ée]?|College|School|Department|Division|Institute|Laboratory|Lab|Hospital|Center|Centre|Clinic|Faculty|Google(?:\s+(?:Brain|Research))?|Meta(?:\s+AI)?|OpenAI|Microsoft(?:\s+Research)?|DeepMind)\b/iu
+
+const stripAuthorMarkers = (value) =>
+  textOf({ text: value })
+    .replace(/[\d,*†‡§¹²³⁴⁵⁶⁷⁸⁹⁰]+$/gu, ' ')
+    .replace(/\s+/gu, ' ')
+    .trim()
+
+// PDF text extraction commonly keeps affiliation markers (numeric or symbol
+// superscripts) attached to the final surname. Strip only those trailing
+// markers before applying the conservative name shape above.
+const isAuthorName = (value) => {
+  const normalized = stripAuthorMarkers(value)
+  return authorLike.test(normalized)
+}
+
+const authorAffiliationCellLike = (value) => {
+  const text = textOf({ text: value })
+  const match = text.match(institutionLike)
+  if (!match || match.index == null) return false
+  return isAuthorName(text.slice(0, match.index))
+}
 
 const authorListLike = (value) => {
   const text = textOf({ text: value })
@@ -26,6 +49,21 @@ const authorListLike = (value) => {
   return names.length >= 2
 }
 
+const compactAuthorAffiliationLike = (value) => {
+  const text = textOf({ text: value })
+  if (!text || text.split(/\s+/u).length < 3 || text.split(/\s+/u).length > 8) return false
+  const marker =
+    /\b(?:University|Universit[ée]?|College|Institute|U[A-Z][A-Za-z]+|UC|Google(?:\s+(?:Brain|Research))?|Meta(?:\s+AI)?|OpenAI|Microsoft(?:\s+Research)?|DeepMind)\b/u
+  const match = text.match(marker)
+  if (!match) return false
+  const name = text
+    .slice(0, match.index)
+    .trim()
+    .replace(/[\d,*†‡§]+$/u, '')
+    .trim()
+  return isAuthorName(name)
+}
+
 const hasAuthorListGrid = (table) => {
   const rows = Array.isArray(table?.grid) ? table.grid : []
   const values = rows
@@ -37,6 +75,29 @@ const hasAuthorListGrid = (table) => {
   return values.filter(authorListLike).length >= Math.max(4, Math.ceil(values.length * 0.6))
 }
 
+const hasAuthorRosterGrid = (table, source, hasAbstractHeading) => {
+  const rows = Array.isArray(table?.grid) ? table.grid : []
+  const values = rows
+    .flat()
+    .map((value) => textOf({ text: value }))
+    .filter(Boolean)
+  if (rows.length < 2 || rows.length > 12 || values.length < 4 || values.length > 72) return false
+  if (rows.some((row) => !Array.isArray(row) || row.length < 2 || row.length > 6)) return false
+  const mergedRosterCells = values.filter(authorAffiliationCellLike).length
+  const standaloneAuthors = values.filter((value) => isAuthorName(value)).length
+  const institutions = values.filter((value) => institutionLike.test(value)).length
+  const sourceInstitutions = (Array.isArray(source) ? source : []).filter((item) =>
+    institutionLike.test(textOf(item))
+  ).length
+  return (
+    mergedRosterCells >= 4 ||
+    (standaloneAuthors >= 4 && Math.max(institutions, sourceInstitutions) >= 2) ||
+    (standaloneAuthors >= 8 &&
+      Math.max(institutions, sourceInstitutions) >= 1 &&
+      hasAbstractHeading)
+  )
+}
+
 const hasNumericRecord = (table, source) => {
   const rows = Array.isArray(table?.grid) ? table.grid : []
   if (
@@ -104,7 +165,7 @@ export function isNativeFrontMatterRegion(table, items, pageNumber, caption, rul
   if (source.length < 4) return false
   const emails = source.filter((item) => email.test(textOf(item)))
   const institutions = source.filter((item) => affiliation.test(textOf(item)))
-  const authors = source.filter((item) => authorLike.test(textOf(item)))
+  const authors = source.filter((item) => isAuthorName(item.text))
   const abstract = source.some((item) => /^abstract\s*:?\s*$/i.test(textOf(item)))
   const prose = source.filter((item) => textOf(item).split(/\s+/).length >= 12)
   if (hasNumericRecord(table, source)) return false
@@ -120,6 +181,18 @@ export function isNativeFrontMatterRegion(table, items, pageNumber, caption, rul
   // Require a small grid whose cells independently look like author lists; this
   // keeps ordinary borderless comparison tables eligible.
   if (hasAuthorListGrid(table)) return true
+  // Some first pages arrange authors in a compact multi-row grid. PDF text
+  // extraction may merge each author with the institution or emit the
+  // institution on the following line, with Unicode contribution markers
+  // (∗/†/‡) as separate tokens. Require a strong roster shape before rejecting
+  // the candidate so numeric and closed-frame tables remain eligible.
+  if (hasAuthorRosterGrid(table, source, abstract)) return true
+  const compactInstitutions = source.filter((item) =>
+    /\b(?:University|Universit[ée
```

**File**: `resources/pdf-structure/literature-pdf-native-final-cell-bounds.mjs` (modified, +49/-1)
```diff
@@ -14,6 +14,49 @@ const intersection = (a, b) =>
 const horizontal = (rule) => Math.abs(rule[3] - rule[1]) < 0.2
 const sameEndpoints = (a, b) => Math.abs(a[0] - b[0]) < 0.5 && Math.abs(a[2] - b[2]) < 0.5
 
+// A complete native table can sit beside ordinary body prose.  The detector
+// crop then clips the prose at the table edge even though none of its glyphs
+// belongs to a cell.  Suppress that diagnostic only when source ownership is
+// complete, every clipped glyph is separated from the source bounds by a
+// readable gutter, and the clipped run is clearly prose.  Short labels and
+// single values remain diagnostics because they may be table evidence.
+function isAdjacentProseClipping(clipped, source, cropRect) {
+  // A single trailing line may be a table note or footnote. Require a
+  // multi-line run before classifying it as neighboring body prose.
+  if (!source || clipped.length < 2) return false
+  const [left, top, right, bottom] = source.rects.reduce(
+    (bounds, rect) => [
+      Math.min(bounds[0], rect[0]),
+      Math.min(bounds[1], rect[1]),
+      Math.max(bounds[2], rect[2]),
+      Math.max(bounds[3], rect[3])
+    ],
+    [Infinity, Infinity, -Infinity, -Infinity]
+  )
+  const em = source.em
+  if (![left, top, right, bottom, em].every(Number.isFinite) || em <= 0) return false
+  const words = clipped
+    .map((item) => item.text.trim())
+    .join(' ')
+    .split(/\s+/u)
+    .filter(Boolean)
+  if (words.length < 3 || !words.some((word) => /\p{L}{2,}/u.test(word))) return false
+  if (clipped.some((item) => intersection(item.rect, [left, top, right, bottom]) > 0)) return false
+  const leftMargin = clipped.every(
+    (item) => item.rect[2] <= left - em * 0.25 && item.rect[2] > cropRect[0]
+  )
+  const bottomMargin = clipped.every(
+    (item) =>
+      item.rect[1] >= bottom + em * 0.5 &&
+      item.rect[1] < cropRect[3] &&
+      (item.rect[2] <= left - em * 0.25 || item.rect[0] >= right + em * 0.25)
+  )
+  const rightMargin = clipped.every(
+    (item) => item.rect[0] >= right + em * 0.25 && item.rect[0] < cropRect[2]
+  )
+  return leftMargin || bottomMargin || rightMargin
+}
+
 function sourceEvidence(table, tokens) {
   const rects = table.cells.flatMap((cell) => cell.sourceRects ?? [])
   if (!rects.length || table.unassigned.length || new Set(rects.map(String)).size !== rects.length)
@@ -434,5 +477,10 @@ export function reconcileNativeFinalCellBounds({
       return false
     return true
   })
-  return { cropRect: view.cropRect, clipped: finalClipped }
+  const adjacentProse = isAdjacentProseClipping(finalClipped, source, view.cropRect)
+  if (adjacentProse) repairs.push('adjacent-prose-boundary-suppressed')
+  return {
+    cropRect: view.cropRect,
+    clipped: adjacentProse ? [] : finalClipped
+  }
 }
```

**File**: `resources/pdf-structure/literature-pdf-native-header-grid.mjs` (modified, +69/-0)
```diff
@@ -4034,6 +4034,75 @@ export function recoverClippedHeading({
 // missing row, including untitled resource-table continuations.
 export function recoverClippedColumnHeader(table, items, rules, captions = []) {
   const crop = table.cropRect
+  const leadingColumns = table.structure.objects
+    .filter((o) => o.label === 'table column')
+    .map((o) => [
+      o.rect[0] + crop[0],
+      o.rect[1] + crop[1],
+      o.rect[2] + crop[0],
+      o.rect[3] + crop[1]
+    ])
+    .sort((a, b) => a[0] - b[0])
+
+  // Borderless two-column tables can lose a complete text header when the
+  // detector starts at the first body row. Require one aligned source label
+  // per model lane and a native separator before extending the crop; this
+  // keeps nearby prose from becoming a synthetic header.
+  if (leadingColumns.length >= 2 && leadingColumns.length <= 4) {
+    const heights = items
+      .map((item) => item.height)
+      .filter((value) => Number.isFinite(value) && value > 0)
+      .sort((a, b) => a - b)
+    const height = heights[Math.floor(heights.length / 2)] ?? 0
+    const modelRows = table.structure.objects.filter((o) => o.label === 'table row')
+    const firstRowTop = Math.min(...modelRows.map((o) => o.rect[1] + crop[1]))
+    const leading = items.filter(
+      (item) =>
+        item.horizontal &&
+        item.rect[1] < crop[1] &&
+        // The detector crop often clips the lower half of a header glyph, so
+        // allow the source line to extend a little into the first body band.
+        // Lane ownership and the native separator below remain the proof that
+        // this is a header rather than nearby prose.
+        item.rect[3] <= crop[1] + height * 1.2 &&
+        item.rect[3] > crop[1] - height * 2.5 &&
+        item.rect[0] >= leadingColumns[0][0] - 2 &&
+        item.rect[2] <= leadingColumns.at(-1)[2] + 2 &&
+        /\p{L}/u.test(item.text.trim())
+    )
+    const groups = leadingColumns.map((column) =>
+      leading.filter((item) => item.rect[0] >= column[0] - 2 && item.rect[2] <= column[2] + 2)
+    )
+    const baseline = leading.length ? Math.max(...leading.map((item) => item.baseline)) : 0
+    const separator = rules.find(
+      (rule) =>
+        rule[1] === rule[3] &&
+        rule[1] >= Math.max(...leading.map((item) => item.rect[3]), crop[1]) &&
+        rule[1] <= firstRowTop &&
+        rule[0] <= leadingColumns[0][0] + 2 &&
+        rule[2] >= leadingColumns.at(-1)[2] - 2
+    )
+    if (
+      height > 0 &&
+      modelRows.length > 0 &&
+      leading.length === leadingColumns.length &&
+      groups.every((group) => group.length === 1) &&
+      Math.max(...leading.map((item) => item.baseline)) -
+        Math.min(...leading.map((item) => item.baseline)) <=
+        height * 0.25 &&
+      baseline < firstRowTop - height * 0.5 &&
+      separator
+    ) {
+      const top = Math.min(...leading.map((item) => item.rect[1])) - 1
+      const bottom = separator[1]
+      return {
+        cropRect: [crop[0], top, crop[2], crop[3]],
+        rect: [leadingColumns[0][0], top, leadingColumns.at(-1)[2], bottom],
+        spans: []
+      }
+    }
+  }
+
   // An open-top header still has native vertical faces. Two sample headings
   // and a test column identify the header; common endpoints bound it without
   // inventing a horizontal stroke or extending through adjacent prose.
```

**File**: `resources/pdf-structure/literature-pdf-table-cell-merges.mjs` (modified, +21/-0)
```diff
@@ -625,6 +625,23 @@ export function resolveTableCellMerges({
     )
   }
   const numericRows = rows.flatMap((_, r) => (numericRecord(r) ? [r] : []))
+  const wideNumericBodyRecord = (slots) => {
+    if (!slots.length || new Set(slots.map((slot) => slot.row)).size !== 1) return false
+    const row = slots[0].row
+    if (headerRows.includes(row) || slots.length < 8) return false
+    const source = items
+      .filter((item) => item.horizontal && inside(union(slots), item))
+      .sort((a, b) => a.rect[0] - b.rect[0])
+    const words = source.flatMap((item) => item.text.trim().split(/\s+/u))
+    const numeric = (value) => /^[<>≤≥−+-]?\d+(?:[.,]\d+)?%?$/.test(value)
+    const first = words.findIndex((value) => numeric(value))
+    return (
+      first > 0 &&
+      words.length - first === slots.length - 1 &&
+      words.slice(0, first).some((value) => /\p{L}/u.test(value)) &&
+      words.slice(first).every(numeric)
+    )
+  }
   // A numeric category is not a section heading when every native field is
   // complete and at least three independent labelled peers prove the same lanes.
   // Keep incomplete categories on the ordinary diagnostic path.
@@ -747,6 +764,10 @@ export function resolveTableCellMerges({
       column = Math.min(...cs),
       rowSpan = Math.max(...rs) - row + 1,
       colSpan = Math.max(...cs) - column + 1
+    if (p.origin === 'model-span' && rowSpan === 1 && wideNumericBodyRecord(p.slots)) {
+      repairs.push('wide-numeric-row-span-discarded')
+      return false
+    }
     if (
       p.origin === 'model-span' &&
       p.sectionHeader &&
```

**File**: `resources/pdf-structure/literature-pdf-table-cell-text.mjs` (modified, +1549/-1)
```diff
@@ -9,6 +9,775 @@ import { orderNativeDualScriptLanes } from './literature-pdf-native-dual-script-
 
 const BACKSPACE = String.fromCharCode(8)
 
+// Parallel benchmark rows are sometimes emitted as one wide source run, while
+// the detector merges one of the rows into a single spanning cell. Rebuild only
+// when several body rows prove the same numeric lane count and every candidate
+// has one label followed by a complete numeric tail. The source runs are split
+// into synthetic cell-sized tokens so the normal ownership and serialization
+// path remains unchanged.
+export function recoverWideNumericRows({ items, cells, rows, columnRects, headerRows, repairs }) {
+  if (columnRects.length < 8) return 0
+  const numeric = (value) => /^[<>≤≥−+-]?\d+(?:[.,]\d+)?%?$/.test(value)
+  const expected = columnRects.length - 1
+  const bodyRows = () =>
+    rows
+      .map((row, rowIndex) => ({ row, rowIndex }))
+      .filter(({ rowIndex }) => !headerRows.includes(rowIndex))
+  const sourceGroups = []
+  for (const item of items
+    .filter((candidate) => candidate.horizontal)
+    .sort((a, b) => a.rect[1] - b.rect[1])) {
+    const group = sourceGroups.find(
+      (candidate) =>
+        Math.abs(candidate.baseline - item.baseline) <=
+        Math.max(candidate.height, item.height) * 0.55
+    )
+    if (group) {
+      group.items.push(item)
+      group.baseline = (group.baseline + item.baseline) / 2
+      group.height = Math.max(group.height, item.height)
+    } else sourceGroups.push({ items: [item], baseline: item.baseline, height: item.height })
+  }
+  const candidates = sourceGroups
+    .map((group) => {
+      const ordered = group.items.slice().sort((a, b) => a.rect[0] - b.rect[0])
+      const words = ordered.flatMap((item) => item.text.trim().split(/\s+/u))
+      const first = words.findIndex(
+        (word, index) => numeric(word) && words.slice(index).every(numeric)
+      )
+      if (first < 0 || words.length - first !== expected) return undefined
+      const labels = words.slice(0, first)
+      if (!labels.some((word) => /\p{L}/u.test(word))) return undefined
+      return { group, ordered, labels, values: words.slice(first), y: group.baseline }
+    })
+    .filter(Boolean)
+    .sort((a, b) => a.y - b.y)
+  if (candidates.length < 3) return 0
+  let recovered = 0
+  const claimedRows = new Set()
+  const splitClaimedRow = (target, candidate) => {
+    const { row, rowIndex } = target
+    const center = (row.rect[1] + row.rect[3]) / 2
+    const split = Math.max(row.rect[1] + 1, Math.min(row.rect[3] - 1, (center + candidate.y) / 2))
+    const before = candidate.y < center
+    const insertIndex = before ? rowIndex : rowIndex + 1
+    const newRow = {
+      rect: before
+        ? [row.rect[0], row.rect[1], row.rect[2], split]
+        : [row.rect[0], split, row.rect[2], row.rect[3]],
+      origin: 'source-wide-numeric-row'
+    }
+    if (before) row.rect[1] = split
+    else row.rect[3] = split
+    for (const cell of cells) if (cell.row >= insertIndex) cell.row += 1
+    const targetIndex = before ? rowIndex + 1 : rowIndex
+    for (const cell of cells.filter((cell) => cell.row === targetIndex)) {
+      cell.rect[1] = row.rect[1]
+      cell.rect[3] = row.rect[3]
+    }
+    rows.splice(insertIndex, 0, newRow)
+    repairs.push('wide-numeric-row-split')
+    return { row: newRow, rowIndex: insertIndex }
+  }
+  for (const candidate of candidates) {
+    let data = bodyRows()
+    let target = data
+      .map((entry) => ({
+        ...entry,
+        distance: Math.abs((entry.row.rect[1] + entry.row.rect[3]) / 2 - candidate.y)
+      }))
+      .sort((a, b) => a.distance - b.distance)[0]
+    const last = data.at(-1)
+    if (
+      !target ||
+      (last && candidate.group.items.some((item) => item.rect[3] > last.row.rect[3] + 0.5))
+    ) {
+      if (!last) continue
+      const top = Math.max(
+        last.row.rect[3],
+        Math.min(...candidate.group.items.map((item) => item.rect[1])) - 1
+      )
+      const bottom = Math.max(
+        top + 1,
+        Math.max(...candidate.group.items.map((item) => item.rect[3])) + 1
+      )
+      const row = {
+        rect: [last.row.rect[0], top, last.row.rect[2], bottom],
+        origin: 'source-wide-numeric-row'
+      }
+      rows.push(row)
+      target = { row, rowIndex: rows.length - 1 }
+      repairs.push('wide-numeric-trailing-row-recovered')
+    }
+    if (claimedRows.has(target.row)) target = splitClaimedRow(target, candidate)
+    claimedRows.add(target.row)
+    const { rowIndex, row } = target
+    const existing = cells.filter((cell) => cell.row === rowIndex)
+    const needsCells =
+      existing.length !== columnRects.length || existing.some((cell) => cell.colSpan !== 1)
+    if (needsCells) {
+      const replacement = columnRects.map((rect, column) => ({
+        row: rowIndex,
+        column,
+        rowSpan: 1,
+        colSpan: 1,
+        rect: [rect[0], row.rect[1], rect[2], row.rect[3]],
+  
```

---

### Incident Patch 9: `796cdcff` (2026-10-05)
**Commit Message**: fix(workspace): align side chat composer and reading icons (#3301)

**File**: `e2e/browser/side-chat-toolbar.spec.ts` (modified, +15/-0)
```diff
@@ -13,6 +13,21 @@ for (const dark of [false, true]) {
     await expect(panel).toBeVisible()
     await expect(tab.locator('svg')).toHaveAttribute('aria-hidden', 'true')
     await draft.fill('Keep this unfinished question')
+    await expect(draft).toHaveCSS('outline-style', 'none')
+    await expect(draft).not.toHaveCSS('box-shadow', /[1-9][\d.]*px/)
+    // Keyboard focus and returning from another preview tab must not restore the inner ring.
+    await page.keyboard.press('Tab')
+    await page.keyboard.press('Shift+Tab')
+    await expect(draft).toBeFocused()
+    await expect(draft).toHaveCSS('outline-style', 'none')
+    await expect(draft).not.toHaveCSS('box-shadow', /[1-9][\d.]*px/)
+    await page.getByRole('tab').nth(7).click()
+    await tab.click()
+    await draft.focus()
+    await expect(draft).toHaveValue('Keep this unfinished question')
+    await expect(draft).toHaveCSS('outline-style', 'none')
+    await expect(draft).not.toHaveCSS('box-shadow', /[1-9][\d.]*px/)
+    await expect(panel.getByTestId('side-chat-composer')).toHaveCSS('border-radius', '16px')
     await draft.evaluate((node) => node.setAttribute('data-mount-marker', 'original'))
     const info = page.getByRole('button', { name: 'Session information: Side chat' })
     await info.click()
```

**File**: `src/renderer/src/pages/workspace/ConversationPanel.interaction.test.tsx` (modified, +3/-0)
```diff
@@ -1817,6 +1817,9 @@ describe('ConversationPanel composer intake', () => {
     expect(bar?.textContent).toContain('third.pdf')
     expect(bar?.querySelector('[aria-label="Choose PDFs for Reading"]')).not.toBeNull()
     expect(bar?.querySelectorAll('[aria-label^="Open PDF context "]')).toHaveLength(3)
+    expect(
+      bar?.querySelectorAll('[aria-label^="Open PDF context "] [aria-hidden="true"] svg')
+    ).toHaveLength(3)
     // The page-position line is gone: the disclosure moved to the chip's tooltip.
     expect(bar?.textContent).not.toContain('Page')
     expect(bar?.textContent).not.toContain('Open the PDF')
```

**File**: `src/renderer/src/pages/workspace/ConversationPanel.tsx` (modified, +6/-1)
```diff
@@ -2221,14 +2221,19 @@ const ConversationPanel = ({
                                           <button
                                             type="button"
                                             className={cn(
-                                              'min-w-0 flex-1 rounded-l-lg px-2 py-1 text-left hover:bg-bg-300 hover:text-text-000 active:translate-y-px focus-visible:keyboard-focus focus-visible:-outline-offset-2 motion-reduce:active:translate-y-0',
+                                              'flex min-w-0 flex-1 items-center gap-1.5 rounded-l-lg px-2 py-1 text-left hover:bg-bg-300 hover:text-text-000 active:translate-y-px focus-visible:keyboard-focus focus-visible:-outline-offset-2 motion-reduce:active:translate-y-0',
                                               composerInteractiveTransitionClassName
                                             )}
                                             aria-label={t('Open PDF context {{name}}', {
                                               name: binding.name
                                             })}
                                             onClick={() => openReadingContext(binding.bindingId)}
                                           >
+                                            <FileTypeIcon
+                                              name={binding.name}
+                                              mimeType="application/pdf"
+                                              className="size-4 rounded-none border-0 bg-transparent p-0"
+                                            />
                                             <ExtensionPreservingFileName
                                               name={binding.name}
                                               className="min-w-0 text-[12px] font-medium leading-4"
```

**File**: `src/renderer/src/pages/workspace/PreviewPanel.test.tsx` (modified, +1/-0)
```diff
@@ -1758,6 +1758,7 @@ describe('PreviewPanel', () => {
     expect(panel!.querySelector('textarea')).toBe(textarea)
     await act(async () => enterFullScreen())
     const viewMain = panel!.querySelector<HTMLButtonElement>('[aria-label="View main session"]')!
+    expect(viewMain.querySelector('svg.lucide-locate-fixed[aria-hidden="true"]')).not.toBeNull()
     await act(async () => viewMain.click())
     expect(openSession).toHaveBeenCalledWith('default', 'right-parent', 'user')
     expect(usePreviewWorkbenchStore.getState().expandedToolItemId).toBeNull()
```

**File**: `src/renderer/src/pages/workspace/SideChatPanel.tsx` (modified, +2/-2)
```diff
@@ -404,7 +404,7 @@ const SideChatPanel = ({
         </div>
         <div
           data-testid="side-chat-composer"
-          className="relative z-20 flex shrink-0 flex-col gap-2 border-t border-border-200 bg-bg-000 px-4 py-3"
+          className="relative z-20 mx-4 mb-2 flex shrink-0 flex-col gap-2 rounded-2xl border border-border-200 bg-bg-000 px-3 py-2"
         >
           <SideChatAnnotationDrop
             chatId={view.id ?? view.sideSessionId ?? ''}
@@ -450,7 +450,7 @@ const SideChatPanel = ({
               value={view.draft}
               placeholder={t('Follow up…')}
               aria-label={t('Side chat follow up')}
-              className="max-h-28 min-h-8 flex-1 resize-none rounded-none border-0 bg-transparent px-0 py-1 text-[15px] leading-6 text-text-000 shadow-none placeholder:text-text-300 focus-visible:border-transparent"
+              className="max-h-[200px] min-h-[36px] flex-1 resize-none rounded-none border-0 bg-transparent px-0 py-1.5 text-[15px] leading-relaxed text-text-000 shadow-none outline-none placeholder:text-text-300 focus-visible:border-transparent focus-visible:outline-none focus-visible:ring-0 md:text-[15px] dark:bg-transparent"
               onChange={(event) => onDraftChange(event.target.value)}
               onKeyDown={handleKeyDown}
             />
```

**File**: `src/renderer/src/pages/workspace/SideChatWorkbench.tsx` (modified, +2/-2)
```diff
@@ -1,4 +1,4 @@
-import { ChevronDown, Maximize2, MessageSquare, Minimize2 } from 'lucide-react'
+import { ChevronDown, Maximize2, LocateFixed, Minimize2 } from 'lucide-react'
 import { useId } from 'react'
 import { Button } from '@/components/ui/button'
 import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
@@ -81,7 +81,7 @@ export function SideChatWorkbenchContent({
                   }
                 }}
               >
-                <MessageSquare className="size-4" aria-hidden="true" />
+                <LocateFixed className="size-4" aria-hidden="true" />
               </Button>
             </TooltipTrigger>
             <TooltipContent side="bottom" align="end">
```

---

### Incident Patch 10: `e4ba390f` (2026-10-04)
**Commit Message**: fix(claude): isolate shared-login settings by default (#3289)

* fix(claude): isolate shared-login settings by default

Keep shared authentication and native transcripts while excluding personal instructions, MCP tools and permission rules. Honor configured sources and initial permissions in the pinned ACP adapter, including settings reloads.

Reproduce the original behavior through the real resolver, ACP and native CLI with synthetic local services; cover approval bypass, new/resumed sessions and watcher lifecycle.

* test(skills): align isolation consumer registration snapshot

Include the shared Claude isolation regression in the exact user-skills consumer inventory. Preserve all existing entries and strict equality after reproducing the Ubuntu shard failure locally.

* test(architecture): align remaining isolation consumer snapshots

Include the shared Claude regression in the provenance, compute and persistence inventories without weakening their strict assertions. Reproduce all three CI failures locally and verify every affected source architecture snapshot plus registration guards.

* test(claude): narrow isolation regression dependencies

Keep shared-provider policy asserti

**File**: `patches/@agentclientprotocol+claude-agent-acp+0.70.0.patch` (modified, +80/-3)
```diff
@@ -161,15 +161,32 @@ diff --git a/node_modules/@agentclientprotocol/claude-agent-acp/dist/acp-agent.j
                  };
              }
          };
-@@ -4995,6 +5071,7 @@
+@@ -4715,6 +4791,7 @@
+         const input = new Pushable();
+         const settingsManager = new SettingsManager(params.cwd, {
+             logger: this.logger,
++            settingSources: params._meta?.claudeCode?.options?.settingSources,
+         });
+         await settingsManager.initialize();
+         const mcpServers = {};
+@@ -4761,7 +4838,7 @@
+                 };
+             }
+         }
+-        const permissionMode = resolvePermissionMode(settingsManager.getSettings().permissions?.defaultMode, this.logger);
++        const permissionMode = resolvePermissionMode(params._meta?.claudeCode?.options?.permissionMode ?? settingsManager.getSettings().permissions?.defaultMode, this.logger);
+         // Extract options from _meta if provided
+         const sessionMeta = params._meta;
+         const userProvidedOptions = sessionMeta?.claudeCode?.options;
+@@ -4995,6 +5072,7 @@
          let initializationResult;
          try {
              initializationResult = await q.initializationResult();
 +            await waitForMcpServers(q, Object.keys(mcpServers), undefined, this.logger);
          }
          catch (error) {
              if (creationOpts.resume &&
-@@ -5259,15 +5336,10 @@
+@@ -5259,15 +5337,10 @@
              session.accumulatedUsage.cachedWriteTokens,
      };
  }
@@ -189,7 +206,7 @@ diff --git a/node_modules/@agentclientprotocol/claude-agent-acp/dist/acp-agent.j
  }
  /**
   * Build the `data` payload attached to a `RequestError.internalError` when we
-@@ -5284,7 +5356,7 @@
+@@ -5284,7 +5357,7 @@
  }
  /** Project a nullable API usage object into our non-null snapshot shape.
   *  Both SDK message_start and assistant message `usage` have `number | null`
@@ -198,3 +215,63 @@ diff --git a/node_modules/@agentclientprotocol/claude-agent-acp/dist/acp-agent.j
   *  NaN. `input_tokens`/`output_tokens` are typed `number` by the SDK but
   *  synthetic or third-party-backend stream events have been observed emitting
   *  them as null/undefined — coerce those too so a malformed upstream event
+diff --git a/node_modules/@agentclientprotocol/claude-agent-acp/dist/settings.d.ts b/node_modules/@agentclientprotocol/claude-agent-acp/dist/settings.d.ts
+--- a/node_modules/@agentclientprotocol/claude-agent-acp/dist/settings.d.ts
++++ b/node_modules/@agentclientprotocol/claude-agent-acp/dist/settings.d.ts
+@@ -1,5 +1,6 @@
+-import { type Settings } from "@anthropic-ai/claude-agent-sdk";
++import { type Settings, type SettingSource } from "@anthropic-ai/claude-agent-sdk";
+ export interface SettingsManagerOptions {
++    settingSources?: SettingSource[];
+     onChange?: () => void;
+     logger?: {
+         log: (...args: any[]) => void;
+@@ -20,6 +21,7 @@
+     private effective;
+     private watchers;
+     private onChange?;
++    private settingSources;
+     private logger;
+     private initialized;
+     private disposed;
+diff --git a/node_modules/@agentclientprotocol/claude-agent-acp/dist/settings.js b/node_modules/@agentclientprotocol/claude-agent-acp/dist/settings.js
+--- a/node_modules/@agentclientprotocol/claude-agent-acp/dist/settings.js
++++ b/node_modules/@agentclientprotocol/claude-agent-acp/dist/settings.js
+@@ -39,6 +39,7 @@
+     effective = {};
+     watchers = [];
+     onChange;
++    settingSources;
+     logger;
+     initialized = false;
+     disposed = false;
+@@ -47,6 +48,7 @@
+     constructor(cwd, options) {
+         this.cwd = cwd;
+         this.onChange = options?.onChange;
++        this.settingSources = [...(options?.settingSources ?? ["user", "project", "local"])];
+         this.logger = options?.logger ?? console;
+     }
+     /**
+@@ -75,9 +77,9 @@
+      */
+     getWatchedPaths() {
+         return [
+-            path.join(CLAUDE_CONFIG_DIR, "settings.json"),
+-            path.join(this.cwd, ".claude", "settings.json"),
+-            path.join(this.cwd, ".claude", "settings.local.json"),
++            ...(this.settingSources.includes("user") ? [path.join(CLAUDE_CONFIG_DIR, "settings.json")] : []),
++            ...(this.settingSources.includes("project") ? [path.join(this.cwd, ".claude", "settings.json")] : []),
++            ...(this.settingSources.includes("local") ? [path.join(this.cwd, ".claude", "settings.local.json")] : []),
+             getManagedSettingsPath(),
+         ];
+     }
+@@ -87,7 +89,7 @@
+      */
+     async loadAllSettings() {
+         try {
+-            const resolved = await resolveSettings({ cwd: this.cwd });
++            const resolved = await resolveSettings({ cwd: this.cwd, settingSources: this.settingSources });
+             this.effective = filterEscalatingDefaultMode(resolved);
+         }
+         catch (error) {
```

**File**: `scripts/ci/module-impact/acp_runtime.json` (modified, +2/-1)
```diff
@@ -799,7 +799,8 @@
       "src/main/session-persistence/terminal-commit-scheduler.test.ts",
       "src/main/session-persistence/reconciliation-renderer-parity.test.ts",
       "src/main/session-persistence/turn-outcome-reconciliation.test.ts",
-      "src/main/session-persistence/attention-projection.test.ts"
+      "src/main/session-persistence/attention-projection.test.ts",
+      "src/main/agent-framework/claude-shared-settings.integration.test.ts"
     ]
   },
   "capabilityOverlays": ["windows_sensitive", "e2e_regressions", "e2e_delegation"],
```

**File**: `scripts/ci/module-impact/desktop_composition.json` (modified, +2/-1)
```diff
@@ -1197,7 +1197,8 @@
       "src/main/acp/approved-handoff-outcome.integration.test.ts",
       "src/main/acp/approved-handoff-outcome.test.ts",
       "src/main/pdf-annotations/sharing.integration.test.ts",
-      "src/main/database/pdf-annotations-migration.test.ts"
+      "src/main/database/pdf-annotations-migration.test.ts",
+      "src/main/agent-framework/claude-shared-settings.integration.test.ts"
     ]
   },
   "capabilityOverlays": ["e2e_regressions", "e2e_delegation", "windows_sensitive"],
```

**File**: `scripts/ci/module-impact/main_agent_framework.json` (modified, +2/-0)
```diff
@@ -5,6 +5,7 @@
     "src/main/agent-framework/claude-code-memory.integration.test.ts",
     "src/main/agent-framework/claude-code.test.ts",
     "src/main/agent-framework/claude-code.ts",
+    "src/main/agent-framework/claude-shared-settings.integration.test.ts",
     "src/main/agent-framework/codebuddy.test.ts",
     "src/main/agent-framework/codebuddy.ts",
     "src/main/agent-framework/codex-native-model-instructions.md",
@@ -39,6 +40,7 @@
       "src/main/agent-framework/app-mcp-names.test.ts",
       "src/main/agent-framework/claude-code-memory.integration.test.ts",
       "src/main/agent-framework/claude-code.test.ts",
+      "src/main/agent-framework/claude-shared-settings.integration.test.ts",
       "src/main/agent-framework/codebuddy.test.ts",
       "src/main/agent-framework/codex.test.ts",
       "src/main/agent-framework/native-shell-policy.test.ts",
```

**File**: `scripts/ci/module-impact/main_delegation.json` (modified, +2/-1)
```diff
@@ -558,7 +558,8 @@
       "src/main/session-persistence/turn-outcome-reconciliation.test.ts",
       "src/main/session-persistence/attention-projection.test.ts",
       "src/main/acp/approved-handoff-outcome.integration.test.ts",
-      "src/main/acp/approved-handoff-outcome.test.ts"
+      "src/main/acp/approved-handoff-outcome.test.ts",
+      "src/main/agent-framework/claude-shared-settings.integration.test.ts"
     ]
   },
   "capabilityOverlays": ["e2e_regressions", "e2e_delegation", "windows_sensitive"],
```

**File**: `scripts/ci/module-impact/native_process_tree.json` (modified, +2/-1)
```diff
@@ -569,7 +569,8 @@
       "src/main/session-persistence/terminal-commit-scheduler.test.ts",
       "src/main/session-persistence/attention-projection.test.ts",
       "src/main/acp/approved-handoff-outcome.integration.test.ts",
-      "src/main/acp/approved-handoff-outcome.test.ts"
+      "src/main/acp/approved-handoff-outcome.test.ts",
+      "src/main/agent-framework/claude-shared-settings.integration.test.ts"
     ]
   },
   "capabilityOverlays": ["notebook_network_sandbox", "windows_sensitive"],
```

**File**: `scripts/ci/module-impact/settings_backend_resolution.json` (modified, +2/-1)
```diff
@@ -559,7 +559,8 @@
       "src/main/session-persistence/turn-outcome-reconciliation.test.ts",
       "src/main/session-persistence/attention-projection.test.ts",
       "src/main/acp/approved-handoff-outcome.integration.test.ts",
-      "src/main/acp/approved-handoff-outcome.test.ts"
+      "src/main/acp/approved-handoff-outcome.test.ts",
+      "src/main/agent-framework/claude-shared-settings.integration.test.ts"
     ]
   },
   "capabilityOverlays": ["windows_sensitive", "e2e_regressions", "e2e_delegation"],
```

**File**: `scripts/ci/module-impact/settings_operations.json` (modified, +2/-1)
```diff
@@ -733,7 +733,8 @@
       "src/main/session-persistence/turn-outcome-reconciliation.test.ts",
       "src/main/session-persistence/attention-projection.test.ts",
       "src/main/acp/approved-handoff-outcome.integration.test.ts",
-      "src/main/acp/approved-handoff-outcome.test.ts"
+      "src/main/acp/approved-handoff-outcome.test.ts",
+      "src/main/agent-framework/claude-shared-settings.integration.test.ts"
     ]
   },
   "capabilityOverlays": ["e2e_regressions", "e2e_delegation", "windows_sensitive"],
```

---

### Incident Patch 11: `4e9e14d5` (2026-10-04)
**Commit Message**: fix(artifact-finalization): retry expired Prisma transactions (#3295)

**File**: `src/main/artifacts/provenance-lifecycle-contract.test.ts` (modified, +19/-0)
```diff
@@ -286,6 +286,25 @@ describe('artifact provenance durable lifecycle contract', () => {
     ).rejects.toMatchObject({ name: 'ArtifactFinalizationProofError' })
   })
 
+  it('retries finalization when Prisma reports an expired interactive transaction', async () => {
+    const value = await fixture()
+    const session = durableSession(value.storageRoot)
+    const repository = new ArtifactProvenanceRepository({
+      ...value.repositoryOptions,
+      loadSession: async () => session
+    })
+    await value.stagePng('expired transaction bytes')
+    const version = await repository.createVersion(versionRequest(session))
+    const request = finalizationRequest(version.versionId, session)
+    const transaction = vi.spyOn(value.client, '$transaction')
+    transaction.mockImplementationOnce(async () => {
+      throw { code: 'P2028' }
+    })
+
+    await expect(repository.finalizeRun(request)).resolves.toHaveLength(1)
+    expect(transaction).toHaveBeenCalledTimes(2)
+  })
+
   it.each([
     ['staging-files', false],
     ['renamed-files', false],
```

**File**: `src/main/artifacts/provenance-message-finalization.ts` (modified, +20/-2)
```diff
@@ -66,6 +66,24 @@ type ArtifactProvenanceMessageFinalizerOptions = {
   ) => Promise<ArtifactVersionFile>
 }
 
+const isExpiredTransactionError = (error: unknown): boolean =>
+  typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2028'
+
+const runFinalizationTransaction = async <Result>(
+  client: Pick<PrismaClient, '$transaction'>,
+  operation: (transaction: Prisma.TransactionClient) => Promise<Result>
+): Promise<Result> => {
+  try {
+    return await client.$transaction(operation, { maxWait: 10_000 })
+  } catch (error) {
+    // An interactive transaction can outlive the process suspension that started it. Prisma then
+    // reports P2028 when the client resumes; replaying this fenced database operation once starts
+    // from a fresh transaction without repeating the external file publication.
+    if (!isExpiredTransactionError(error)) throw error
+    return client.$transaction(operation, { maxWait: 10_000 })
+  }
+}
+
 export type ArtifactFinalizationProofReason =
   | 'claim-context-missing'
   | 'claim-version-ids-missing'
@@ -435,7 +453,7 @@ export class ArtifactProvenanceMessageFinalizer {
     const ancestry = validateDurableMessageOwnership(durableSession, request)
     const normalizedRequest = normalizeArtifactFinalizationProofRequest({ ...request, ...ancestry })
     const client = await this.options.getClient()
-    const versions = await client.$transaction(async (transaction) => {
+    const versions = await runFinalizationTransaction(client, async (transaction) => {
       const matching = await loadArtifactFinalizationProofVersions(transaction, normalizedRequest)
       validateArtifactFinalizationProof(matching, normalizedRequest)
       if (matching.some((version) => version.state !== 'finalized')) {
@@ -471,7 +489,7 @@ export class ArtifactProvenanceMessageFinalizer {
   ): Promise<ArtifactVersionFile[]> {
     const normalizedRequest = normalizeArtifactFinalizationProofRequest(request)
     const client = await this.options.getClient()
-    const versions = await client.$transaction(async (transaction) => {
+    const versions = await runFinalizationTransaction(client, async (transaction) => {
       const matching = await loadArtifactFinalizationProofVersions(transaction, normalizedRequest)
       // Validate the complete proof from the same transaction that commits message ownership. Recovery
       // does not touch compatibility storage until this transaction succeeds.
```

---

### Incident Patch 12: `104b8778` (2026-10-04)
**Commit Message**: fix(notebook-recovery): isolate corrupt run documents (#3294)

**File**: `src/main/notebook/repository.test.ts` (modified, +50/-0)
```diff
@@ -358,6 +358,56 @@ describe('notebook run repository', () => {
     ])
   })
 
+  it('does not block startup recovery when an unrelated Notebook document is corrupt', async () => {
+    const root = await createStorageRoot()
+    const repository = new NotebookRunRepository(root)
+    const validProjectId = 'default-project'
+    const validSessionId = 'valid-session'
+    const validLane = createRootNotebookLane(
+      validProjectId,
+      validSessionId,
+      'root-frame-valid-session'
+    )
+    await repository.loadOrCreate({
+      projectId: validProjectId,
+      sessionId: validSessionId,
+      workspaceCwd: '/workspace',
+      lane: validLane
+    })
+    const validRun = admittedRun({
+      runId: 'background-run',
+      executionMode: 'background',
+      status: 'completed',
+      endedAt: 2
+    })
+    await repository.appendRun({
+      projectId: validProjectId,
+      sessionId: validSessionId,
+      lane: validLane,
+      run: validRun
+    })
+
+    const corruptProjectId = 'corrupt-project'
+    const corruptSessionId = 'corrupt-session'
+    const corruptDocument = await repository.loadOrCreate({
+      projectId: corruptProjectId,
+      sessionId: corruptSessionId,
+      workspaceCwd: '/workspace',
+      lane: createRootNotebookLane(corruptProjectId, corruptSessionId, 'root-frame-corrupt')
+    })
+    const corruptPath = join(corruptDocument.notebookSessionRoot, 'run.json')
+    await writeFile(corruptPath, '{ not-json', 'utf8')
+
+    await expect(repository.recoverAllRunLifecycles()).resolves.toEqual([
+      {
+        projectId: validProjectId,
+        sessionId: validSessionId,
+        run: expect.objectContaining({ runId: validRun.runId, status: 'completed' })
+      }
+    ])
+    await expect(readFile(corruptPath, 'utf8')).resolves.toBe('{ not-json')
+  })
+
   it('replays every durable terminal background Run even after its terminal fact is gone', async () => {
     const root = await createStorageRoot()
     const repository = new NotebookRunRepository(root)
```

**File**: `src/main/notebook/repository.ts` (modified, +23/-2)
```diff
@@ -988,7 +988,7 @@ class NotebookRunRepository {
         const sessionRoot = join(projectRoot, session.name)
         if (await this.pathExists(join(sessionRoot, NOTEBOOK_RUN_FILE))) {
           recovered.push(
-            ...(await this.recoverLane(
+            ...(await this.recoverLaneIfReadable(
               project.name,
               session.name,
               createRootNotebookLane(project.name, session.name, `root-frame-${session.name}`)
@@ -1007,7 +1007,7 @@ class NotebookRunRepository {
           if (!frame.isDirectory() || !SAFE_SEGMENT_PATTERN.test(frame.name)) continue
           if (!(await this.pathExists(join(framesRoot, frame.name, NOTEBOOK_RUN_FILE)))) continue
           recovered.push(
-            ...(await this.recoverLane(
+            ...(await this.recoverLaneIfReadable(
               project.name,
               session.name,
               createFrameNotebookLane(project.name, session.name, frame.name)
@@ -1491,6 +1491,27 @@ class NotebookRunRepository {
     return [...recovered.values()].map((run) => ({ projectId, sessionId, run }))
   }
 
+  private async recoverLaneIfReadable(
+    projectId: string,
+    sessionId: string,
+    lane: NotebookLaneIdentity
+  ): Promise<RecoveredBackgroundRun[]> {
+    try {
+      return await this.recoverLane(projectId, sessionId, lane)
+    } catch (error) {
+      if (!(error instanceof CorruptNotebookDocumentError)) throw error
+
+      log.warn('skipping unreadable Notebook document', {
+        projectId,
+        sessionId,
+        lane: notebookLaneScope(lane).kind,
+        status: 'corrupt',
+        phase: 'startup-recovery'
+      })
+      return []
+    }
+  }
+
   private async pathExists(path: string): Promise<boolean> {
     try {
       await stat(path)
```

---

### Incident Patch 13: `3a37c339` (2026-10-04)
**Commit Message**: fix(notebook): preserve R environments in spaced data roots (#3290)

* fix(notebook): preserve R environments in spaced data roots

Reject unsupported managed R provisioning before destructive preparation and keep historical data roots accessible. Explain the existing relocation option in Storage settings while allowing cancellation without changing the current location.

* fix(notebook): restore mixed Python environments in spaced roots

Keep Python-first relocation behavior when an environment also contains r-base. Reuse existing interpreters and explicit locks instead of adding persisted language metadata.

* fix(notebook): restore Python from mixed default R environments

Apply Python-first restoration to default-r as well as named environments. Do not certify the unsupported R launcher when only Python restoration has been verified.

* fix(storage): carry pending runtime locks across data moves

Include unconsumed reconstruction locks in the existing atomic export bundle and inventory receipt. Retain their complete recipes over partial prefixes and fail closed when the merged bundle cannot preserve every environment.

**File**: `src/main/notebook/provisioner.test.ts` (modified, +198/-0)
```diff
@@ -121,6 +121,204 @@ const makeDeps = (root: string, overrides: Partial<ProvisionerDeps> = {}): Provi
   }
 }
 
+describe('historical R prefixes containing spaces', () => {
+  it.each(['darwin', 'linux'] as const)(
+    'rejects R provisioning before fetching packages on %s',
+    async (platform) => {
+      const root = join(makeRoot(), 'Application Support', 'runtime')
+      const fetchBundle = vi.fn(makeDeps(root).fetchBundle)
+      const provisioner = new DefaultRuntimeProvisioner(makeDeps(root, { platform, fetchBundle }))
+      await expect(provisioner.provisionR(() => {})).rejects.toThrow(/spaces.*Settings.*Storage/)
+      expect(fetchBundle).not.toHaveBeenCalled()
+      expect(readRReadyMarker(root)).toBeUndefined()
+    }
+  )
+
+  it.each(['provision', 'repair'] as const)(
+    'preserves the old R environment and bindings before %s',
+    async (operation) => {
+      const root = join(makeRoot(), 'Application Support', 'runtime')
+      const prefix = envPrefix(root, DEFAULT_R_ENV, 'darwin')
+      mkdirSync(join(prefix, 'bin'), { recursive: true })
+      writeFileSync(rBin(prefix, 'darwin'), 'old R launcher')
+      writeFileSync(join(prefix, 'user-package'), 'keep this package')
+      const onStarting = vi.fn(async () => {})
+      const clearPrefixBlock = vi.fn()
+      const fetchBundle = vi.fn(makeDeps(root).fetchBundle)
+      const provisioner = new DefaultRuntimeProvisioner(
+        makeDeps(root, {
+          platform: 'darwin',
+          fetchBundle,
+          clearPrefixBlock,
+          verify: async () => {
+            throw new Error('/etc/ldpaths: No such file or directory')
+          }
+        })
+      )
+      const result =
+        operation === 'repair'
+          ? provisioner.repair('r', () => {}, { force: true, onStarting })
+          : provisioner.provisionR(() => {})
+      await expect(result).rejects.toThrow(/spaces.*Settings.*Storage/)
+      expect(readFileSync(join(prefix, 'user-package'), 'utf8')).toBe('keep this package')
+      expect(onStarting).not.toHaveBeenCalled()
+      expect(clearPrefixBlock).not.toHaveBeenCalled()
+      expect(fetchBundle).not.toHaveBeenCalled()
+    }
+  )
+
+  it('rejects named R creation before resolving a channel or running an installer', async () => {
+    const root = join(makeRoot(), 'Application Support', 'runtime')
+    const channel = vi.fn(async () => 'conda-forge')
+    const runArgv = vi.fn(makeDeps(root).runArgv)
+    const provisioner = new DefaultRuntimeProvisioner(
+      makeDeps(root, { platform: 'darwin', channel, runArgv })
+    )
+    await expect(provisioner.createNamedEnvironment('analysis', 'r')).rejects.toThrow(/spaces/)
+    expect(channel).not.toHaveBeenCalled()
+    expect(runArgv).not.toHaveBeenCalled()
+  })
+
+  it('keeps Python provisioning available at a historical spaced root', async () => {
+    const root = join(makeRoot(), 'Application Support', 'runtime')
+    const provisioner = new DefaultRuntimeProvisioner(makeDeps(root, { platform: 'darwin' }))
+    await expect(provisioner.provisionPython(() => {})).resolves.toBeUndefined()
+  })
+
+  it('continues to provision R in spaced Windows roots', async () => {
+    const root = join(makeRoot(), 'Test User', 'runtime')
+    const provisioner = new DefaultRuntimeProvisioner(makeDeps(root, { platform: 'win32' }))
+    await expect(provisioner.provisionR(() => {})).resolves.toBeUndefined()
+    expect(readRReadyMarker(root)).toBeDefined()
+  })
+
+  it('rejects imported R environments before writing their restore files', async () => {
+    const root = join(makeRoot(), 'Application Support', 'runtime')
+    const runArgv = vi.fn()
+    const lock: NotebookEnvironmentLock = {
+      schemaVersion: 1,
+      format: 'environment-lock-bundle',
+      kernelKind: 'r',
+      environmentName: 'analysis',
+      components: [
+        {
+          ecosystem: 'conda',
+          format: 'conda-explicit-md5',
+          resolution: 'locked',
+          explicitLock: `@EXPLICIT\nhttps://repo.example.test/r-base-4.4.conda#${'0'.repeat(32)}\n`,
+          packages: ['r-base']
+        }
+      ],
+      untrackedPackages: []
+    }
+    const provisioner = new DefaultRuntimeProvisioner(
+      makeDeps(root, { platform: 'darwin', runArgv })
+    )
+    await expect(
+      provisioner.createNamedEnvironmentFromLock('analysis', 'r', lock, 'b'.repeat(64))
+    ).rejects.toThrow(/spaces/)
+    expect(existsSync(join(root, 'imported-locks'))).toBe(false)
+    expect(runArgv).not.toHaveBeenCalled()
+  })
+
+  it('keeps a named R relocation lock even when its interpreter has not been materialized', async () => {
+    const root = join(makeRoot(), 'Application Support', 'runtime')
+    mkdirSync(envsLockDir(root), { recursive: true })
+    const lockPath = join(envsLockDir(root), 'analysis.lock')
+    const contents = `@EXPLICIT\nhttps://conda.anaconda.org/conda-forge/osx-arm64/r-base-4.4.conda#${'0'.repeat(32)}\n`
+    writeFileSync(lockPath, contents)
+  
```

**File**: `src/main/notebook/provisioner.ts` (modified, +43/-1)
```diff
@@ -942,6 +942,20 @@ export class DefaultRuntimeProvisioner implements RuntimeProvisioner {
     return platform === 'win32' ? basename(envPrefix(this.deps.root, name, platform)) : undefined
   }
 
+  private hasUnsupportedRPath(): boolean {
+    return this.platform !== 'win32' && /\s/u.test(this.deps.root)
+  }
+
+  private assertLanguagePath(language: NotebookLanguage): void {
+    if (language === 'r' && this.hasUnsupportedRPath()) {
+      throw new Error(
+        'The data location contains spaces. Managed R environments cannot run reliably here. ' +
+          'Use Settings > Storage > Change location to move data to a path without spaces. ' +
+          'You can cancel and keep the current location; the existing environment is unchanged.'
+      )
+    }
+  }
+
   // Wraps a language run so a QUEUED cancel is consumed (beginLanguageRun throws) BEFORE the run does
   // any work, and the provisioning flag + abort controller cover the whole run. repair uses this too, so
   // a cancel that arrived while the Reset was queued aborts BEFORE the destructive rm — never leaving a
@@ -950,6 +964,8 @@ export class DefaultRuntimeProvisioner implements RuntimeProvisioner {
     this.beginLanguageRun(language)
     this.provisioning = true
     try {
+      // Reject before repair preparation can invalidate bindings, stop kernels or delete a prefix.
+      this.assertLanguagePath(language)
       await run()
     } finally {
       this.provisioning = false
@@ -1036,6 +1052,7 @@ export class DefaultRuntimeProvisioner implements RuntimeProvisioner {
       // R is upgraded additively only if already materialized (lazy; spec §6.5) AND not recovery-blocked
       // — a blocked R prefix skips its upgrade rather than failing the (already-applied) python upgrade.
       if (
+        !this.hasUnsupportedRPath() &&
         rMaterialized(this.deps.root, this.platform) &&
         !this.deps.isPrefixBlocked?.(envPrefix(this.deps.root, DEFAULT_R_ENV, this.platform))
       ) {
@@ -1175,7 +1192,8 @@ export class DefaultRuntimeProvisioner implements RuntimeProvisioner {
             now,
             this.markerPrefixDirectory(DEFAULT_PY_ENV)
           )
-        else if (envName === DEFAULT_R_ENV)
+        // A mixed default-r can be restored for Python without certifying its unsupported R launcher.
+        else if (envName === DEFAULT_R_ENV && !this.hasUnsupportedRPath())
           writeRReadyMarker(
             this.deps.root,
             DEFAULT_ENV_VERSION,
@@ -1194,6 +1212,28 @@ export class DefaultRuntimeProvisioner implements RuntimeProvisioner {
           // restore path rm -rf's a broken partial and recreates, which must not race an orphan writer.
           // Other envs still restore; a later restart re-checks the pid and unblocks.
           if (this.deps.isPrefixBlocked?.(prefix)) return
+          // Historical spaced roots remain readable. Keep their R prefix and reconstruction lock
+          // until the user chooses a supported location, without blocking Python restoration.
+          if (this.hasUnsupportedRPath()) {
+            try {
+              const lock = readFileSync(join(dir, file), 'utf8')
+              // Mixed environments remain useful for Python. Match the Python-first verification
+              // below, including prefixes whose interpreters have not yet been reconstructed.
+              const hasPython =
+                existsSync(pythonBin(prefix, this.platform)) ||
+                /^https?:\/\/[^\r\n]+\/python-/mu.test(lock)
+              if (
+                !hasPython &&
+                (name === DEFAULT_R_ENV ||
+                  existsSync(rBin(prefix, this.platform)) ||
+                  /^https?:\/\/[^\r\n]+\/r-base-/mu.test(lock))
+              )
+                return
+            } catch {
+              // Keep an unreadable lock and its prefix; another environment can still restore.
+              return
+            }
+          }
           // A prior restore may have materialized the interpreter before being interrupted. Verify it
           // before consuming the lock; a broken partial prefix is removed and rebuilt below.
           const existingBin = existsSync(pythonBin(prefix, this.platform))
@@ -1311,6 +1351,7 @@ export class DefaultRuntimeProvisioner implements RuntimeProvisioner {
     signal?: AbortSignal
   ): Promise<EnvironmentInfo> {
     signal?.throwIfAborted()
+    this.assertLanguagePath(language)
     const flagLike = packages.find((pkg) => pkg.trim().startsWith('-'))
     if (flagLike) {
       throw new Error(
@@ -1420,6 +1461,7 @@ export class DefaultRuntimeProvisioner implements RuntimeProvisioner {
     if (!/^[a-f0-9]{64}$/u.test(lockChecksum)) {
       throw new Error('Imported Environment lock checksum is invalid.')
     }
+    this.assertLanguagePath(language)
     const prefix = envPrefix(this.deps.root, name, this.platform)
     if (
       this.platform === 'win32' &&
```

**File**: `src/main/notebook/provisioner.upgrade.test.ts` (modified, +28/-0)
```diff
@@ -51,6 +51,34 @@ const baseDeps = (root: string, over: Partial<ProvisionerDeps> = {}): Provisione
 })
 
 describe('upgradeIfNeeded', () => {
+  it('upgrades Python without modifying an old R environment at a spaced root', async () => {
+    const root = join(makeRoot(), 'Application Support', 'runtime')
+    const r = rBin(envPrefix(root, DEFAULT_R_ENV, 'darwin'), 'darwin')
+    touchBin(pythonBin(envPrefix(root, DEFAULT_PY_ENV, 'darwin'), 'darwin'))
+    touchBin(r)
+    writeReadyMarker(root, DEFAULT_ENV_VERSION - 1, 't1')
+    const languages: string[] = []
+    const verified: string[] = []
+    const original = baseDeps(root)
+    await new DefaultRuntimeProvisioner(
+      baseDeps(root, {
+        platform: 'darwin',
+        fetchBundle: async (...args) => {
+          languages.push(args[0].language)
+          return original.fetchBundle(...args)
+        },
+        verify: async (bin) => {
+          verified.push(bin)
+        }
+      })
+    ).upgradeIfNeeded(() => {})
+    expect(languages).toEqual(['python'])
+    expect(verified).not.toContain(r)
+    expect(existsSync(r)).toBe(true)
+    expect(readRReadyMarker(root)).toBeUndefined()
+    expect(readReadyMarker(root)?.defaultEnvVersion).toBe(DEFAULT_ENV_VERSION)
+  })
+
   it('maintains the package cache under the upgrade journal after fetching the offline bundle', async () => {
     const root = makeRoot()
     const cachePath = join(root, 'pkgs')
```

**File**: `src/main/notebook/runtime-relocation.test.ts` (modified, +73/-0)
```diff
@@ -35,6 +35,79 @@ const LOCK_STDOUT = [
 ].join('\n')
 
 describe('exportRuntimeLocks', () => {
+  it.each(['/mm', undefined])(
+    'carries pending R locks without materialized prefixes (mm: %s)',
+    async (mm) => {
+      const from = join(await makeRoot(), 'Application Support')
+      const to = await makeRoot()
+      const locks = envsLockDir(runtimeRoot(from))
+      await mkdir(locks, { recursive: true })
+      const pending =
+        '@EXPLICIT\nhttps://conda.anaconda.org/conda-forge/noarch/r-base-4.4.conda#abc\n'
+      await writeFile(join(locks, 'default-r.lock'), pending)
+      const capture = vi.fn()
+
+      expect(await exportRuntimeLocks(from, to, { mm, capture })).toEqual(['default-r'])
+      expect(await readFile(join(envsLockDir(runtimeRoot(to)), 'default-r.lock'), 'utf8')).toBe(
+        pending
+      )
+      expect(await readFile(join(locks, 'default-r.lock'), 'utf8')).toBe(pending)
+      expect(capture).not.toHaveBeenCalled()
+    }
+  )
+
+  it('merges pending locks with fresh exports without replacing them from a partial prefix', async () => {
+    const from = await makeRoot()
+    const to = await makeRoot()
+    const locks = envsLockDir(runtimeRoot(from))
+    await mkdir(locks, { recursive: true })
+    const pending =
+      '@EXPLICIT\nhttps://conda.anaconda.org/conda-forge/noarch/r-base-4.4.conda#abc\n'
+    await writeFile(join(locks, 'default-r.lock'), pending)
+    await seedEnv(from, 'default-r', 'r')
+    await seedEnv(from, DEFAULT_PY_ENV, 'python')
+    const capture = vi.fn().mockResolvedValue(LOCK_STDOUT)
+
+    expect((await exportRuntimeLocks(from, to, { mm: '/mm', capture })).sort()).toEqual([
+      DEFAULT_PY_ENV,
+      'default-r'
+    ])
+    expect(capture).toHaveBeenCalledOnce()
+    expect(capture.mock.calls[0][0]).toContain(envPrefix(runtimeRoot(from), DEFAULT_PY_ENV))
+    expect(await readFile(join(envsLockDir(runtimeRoot(to)), 'default-r.lock'), 'utf8')).toBe(
+      pending
+    )
+  })
+
+  it('publishes no partial receipt when pending locks coexist with an unexportable environment', async () => {
+    const from = await makeRoot()
+    const to = await makeRoot()
+    const locks = envsLockDir(runtimeRoot(from))
+    await mkdir(locks, { recursive: true })
+    await writeFile(
+      join(locks, 'default-r.lock'),
+      '@EXPLICIT\nhttps://example.test/r-base-4.4.conda#abc\n'
+    )
+    await seedEnv(from, DEFAULT_PY_ENV, 'python')
+    await expect(exportRuntimeLocks(from, to, { mm: undefined, capture: vi.fn() })).rejects.toThrow(
+      'micromamba'
+    )
+    await expect(readdir(envsLockDir(runtimeRoot(to)))).rejects.toThrow()
+  })
+
+  it('rejects an invalid pending lock before publishing any fresh exports', async () => {
+    const from = await makeRoot()
+    const to = await makeRoot()
+    const locks = envsLockDir(runtimeRoot(from))
+    await mkdir(locks, { recursive: true })
+    await writeFile(join(locks, 'default-r.lock'), '@EXPLICIT\n')
+    await seedEnv(from, DEFAULT_PY_ENV, 'python')
+    await expect(
+      exportRuntimeLocks(from, to, { mm: '/mm', capture: vi.fn().mockResolvedValue(LOCK_STDOUT) })
+    ).rejects.toThrow('no package URLs')
+    await expect(readdir(envsLockDir(runtimeRoot(to)))).rejects.toThrow()
+  })
+
   it('exports a normalized @EXPLICIT lock per materialized env into the new root', async () => {
     const from = await makeRoot()
     const to = await makeRoot()
```

**File**: `src/main/notebook/runtime-relocation.ts` (modified, +51/-17)
```diff
@@ -1,5 +1,14 @@
 import { randomUUID } from 'node:crypto'
-import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
+import {
+  existsSync,
+  mkdirSync,
+  readdirSync,
+  readFileSync,
+  renameSync,
+  rmSync,
+  writeFileSync,
+  type Dirent
+} from 'node:fs'
 import { join } from 'node:path'
 
 import { normalizeExplicitLock } from './micromamba'
@@ -8,6 +17,7 @@ import {
   logicalEnvNameFromDirectory,
   pythonBin,
   rBin,
+  resolveEnvName,
   runtimeRoot
 } from './runtime-paths'
 
@@ -16,7 +26,7 @@ import {
 export const envsLockDir = (root: string): string => join(root, 'envs.lock')
 
 export type ExportRuntimeLocksDeps = {
-  // Resolved micromamba binary, or undefined to skip (nothing to preserve without it).
+  // Resolved micromamba binary. Pending locks can be carried forward without it.
   mm: string | undefined
   // Runs a micromamba argv and returns stdout (for `list --explicit --md5`).
   capture: (argv: string[]) => Promise<string>
@@ -29,20 +39,43 @@ export type ExportRuntimeLocksDeps = {
 // <toDataRoot>/runtime/envs.lock/<name>.lock, so the runtime can be rebuilt OFFLINE at the new root
 // from the (separately-copied) pkgs cache instead of copying the non-relocatable env prefixes. This
 // preserves conda-installed content exactly; pip/CRAN-only extras aren't conda-tracked and are not
-// captured here. The bundle is all-or-nothing for materialized environments: every lock is captured
+// captured here. Unconsumed locks remain authoritative over partially reconstructed prefixes.
+// The bundle is all-or-nothing for pending and materialized environments: every lock is captured
 // and validated before a private staging directory is published, so a failed capture or write can
 // never leave a partial envs.lock directory that migration could mistake for complete. Returns the
-// names actually exported; empty when micromamba is absent or no env has an interpreter yet.
+// names preserved; empty when nothing can be exported and there are no pending locks.
 export const exportRuntimeLocks = async (
   fromDataRoot: string,
   toDataRoot: string,
   deps: ExportRuntimeLocksDeps
 ): Promise<string[]> => {
-  if (!deps.mm) return []
-
   const fromRuntime = runtimeRoot(fromDataRoot)
+  const locks: Array<{ name: string; contents: string }> = []
+  const addLock = (name: string, raw: string): void => {
+    const contents = normalizeExplicitLock(raw)
+    if (!/^https?:\/\//m.test(contents)) {
+      throw new Error(`Could not preserve ${name}: the environment lock contains no package URLs.`)
+    }
+    locks.push({ name, contents })
+  }
+  const pendingDir = envsLockDir(fromRuntime)
+  let pending: Dirent[] = []
+  try {
+    pending = readdirSync(pendingDir, { withFileTypes: true })
+  } catch (error) {
+    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
+  }
+  for (const entry of pending) {
+    if (!entry.name.endsWith('.lock')) continue
+    const name = entry.name.slice(0, -'.lock'.length)
+    if (!entry.isFile() || resolveEnvName('python', name) !== name) {
+      throw new Error(`Could not preserve pending environment lock: ${entry.name}`)
+    }
+    addLock(name, readFileSync(join(pendingDir, entry.name), 'utf8'))
+  }
+
   const envsDir = join(fromRuntime, 'envs')
-  let entries: Array<{ name: string; prefix: string; canonical: boolean }>
+  let entries: Array<{ name: string; prefix: string; canonical: boolean }> = []
   try {
     entries = readdirSync(envsDir, { withFileTypes: true })
       .filter((entry) => entry.isDirectory())
@@ -54,24 +87,29 @@ export const exportRuntimeLocks = async (
           canonical: join(envsDir, entry.name) === envPrefix(fromRuntime, name, deps.platform)
         }
       })
-  } catch {
-    return []
+  } catch (error) {
+    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
   }
-  if (entries.length === 0) return []
 
   // If a short Windows default and its legacy directory both exist, export only the active short
   // prefix. A legacy-only install is still exported so the new layout can rebuild it without losing
   // user-added conda packages.
   entries.sort((a, b) => Number(b.canonical) - Number(a.canonical))
-  const seen = new Set<string>()
+  const seen = new Set(locks.map(({ name }) => name))
 
-  const locks: Array<{ name: string; contents: string }> = []
   for (const { name, prefix } of entries) {
     if (seen.has(name)) continue
     seen.add(name)
     // Skip mid-creation leftovers with no interpreter — nothing to reconstruct.
     if (!existsSync(pythonBin(prefix, deps.platform)) && !existsSync(rBin(prefix, deps.platform)))
       continue
+    if (!deps.mm) {
+      // A partial receipt would allow migration to delete the old runtime after preserving only
+      // pending locks. Keep the existing no-export behavior, or reject an incomplete merged bundle.
+      if (locks.length > 0)
+        throw new Error(`Could not preserve ${name}: mi
```

**File**: `src/main/storage/migration-service.test.ts` (modified, +35/-0)
```diff
@@ -48,6 +48,7 @@ import {
 } from './migration-marker'
 import { withDataRootWrite } from './migration-state'
 import { operationJournalPath, RuntimeOperationJournal } from '../notebook/operation-journal'
+import { exportRuntimeLocks as exportRuntimeLockBundle } from '../notebook/runtime-relocation'
 import type { Logger } from '../logger'
 import { DataRootCleanupJournal } from './data-root-cleanup'
 
@@ -2497,6 +2498,40 @@ describe('discardStagedCopy', () => {
 })
 
 describe('runtime preservation + old-runtime cleanup', () => {
+  it('carries an unconsumed R lock into the verified inventory on another migration', async () => {
+    const deps = fakeDeps()
+    const pendingDir = join(currentDataRoot, 'runtime', 'envs.lock')
+    await mkdir(pendingDir, { recursive: true })
+    const pending = '@EXPLICIT\nhttps://example.test/r-base-4.4.conda#abc\n'
+    await writeFile(join(pendingDir, 'default-r.lock'), pending)
+    await mkdir(join(currentDataRoot, 'runtime', 'pkgs'), { recursive: true })
+    await writeFile(join(currentDataRoot, 'runtime', 'pkgs', 'r-base-4.4.conda'), 'archive')
+    const capture = vi.fn()
+    const result = await runDataRootMigration(
+      {
+        currentDataRoot,
+        runtime: deps.runtime,
+        notebook: deps.notebook,
+        exportRuntimeLocks: (from, to) => exportRuntimeLockBundle(from, to, { mm: '/mm', capture })
+      },
+      emptyParent,
+      runOpts()
+    )
+    expect(result.ok).toBe(true)
+    const target = dataRootFor(emptyParent)
+    expect(await readFile(join(target, 'runtime', 'envs.lock', 'default-r.lock'), 'utf8')).toBe(
+      pending
+    )
+    expect(await readFile(join(target, 'runtime', 'pkgs', 'r-base-4.4.conda'), 'utf8')).toBe(
+      'archive'
+    )
+    expect((await readMigrationMarker(target))?.runtimeLockInventory).toEqual(
+      await scanInventory(target, [join('runtime', 'envs.lock')])
+    )
+    expect(await readFile(join(pendingDir, 'default-r.lock'), 'utf8')).toBe(pending)
+    expect(capture).not.toHaveBeenCalled()
+  })
+
   it('exports env locks and copies the pkgs cache when envs are preserved', async () => {
     const deps = fakeDeps()
     const exportRuntimeLocks = vi.fn(async (_source: string, target: string) => {
```

**File**: `src/renderer/src/pages/settings/StoragePanel.render.test.tsx` (modified, +32/-0)
```diff
@@ -152,6 +152,38 @@ afterEach(() => {
 })
 
 describe('StoragePanel', () => {
+  it('warns about a historical spaced root and lets the user cancel without changing it', async () => {
+    const dataRoot = '/Users/test/Library/Application Support/OpenScience'
+    vi.mocked(window.api.storage.getInfo).mockResolvedValue({ ...richInfo, dataRoot })
+    vi.mocked(window.api.storage.getStatus).mockResolvedValue({ ...richInfo, dataRoot })
+    await act(async () => root.render(<StoragePanel />))
+    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
+      'The current data location contains spaces'
+    )
+    expect(container.textContent).toContain('keep the current location')
+    await act(async () => clickButton((button) => button.textContent === 'Change location'))
+    const dialog = document.body.querySelector('[role="alertdialog"]')!
+    await act(async () => {
+      Array.from(dialog.querySelectorAll<HTMLButtonElement>('button'))
+        .find((button) => button.textContent === 'Cancel')!
+        .click()
+    })
+    expect(document.body.querySelector('[role="alertdialog"]')).toBeNull()
+    expect(container.querySelector('[aria-label="Data root path"]')?.textContent).toBe(dataRoot)
+    expect(window.api.storage.migrate).not.toHaveBeenCalled()
+    expect(window.api.storage.setDataRootAndRelaunch).not.toHaveBeenCalled()
+    expect(window.api.storage.commitAndRelaunch).not.toHaveBeenCalled()
+  })
+
+  it('does not warn about spaced Windows data roots', async () => {
+    Object.assign(window.api, { platform: 'win32' })
+    const dataRoot = 'C:\\Users\\Test User\\Open-Science'
+    vi.mocked(window.api.storage.getInfo).mockResolvedValue({ ...richInfo, dataRoot })
+    vi.mocked(window.api.storage.getStatus).mockResolvedValue({ ...richInfo, dataRoot })
+    await act(async () => root.render(<StoragePanel />))
+    expect(container.textContent).not.toContain('The current data location contains spaces')
+  })
+
   const renderEditor = async (): Promise<void> => {
     vi.mocked(window.api.storage.getInfo).mockResolvedValue({ ...richInfo, isDefault: false })
     await act(async () => root.render(<StoragePanel />))
```

**File**: `src/renderer/src/pages/settings/StoragePanel.tsx` (modified, +7/-0)
```diff
@@ -495,6 +495,13 @@ const StoragePanel = ({ onContinueToAgent }: StoragePanelProps): React.JSX.Eleme
             <pre className={cn('mt-1', PATH_PILL)} aria-label={t('Data root path')}>
               {storageStatus.dataRoot}
             </pre>
+            {window.api.platform !== 'win32' && /\s/u.test(storageStatus.dataRoot) ? (
+              <InlineNotice className="mt-2" role="alert">
+                {t(
+                  'The current data location contains spaces. R environments cannot run reliably here. Use Change location to move your data to a path without spaces. You can cancel and keep the current location; your existing data will remain available.'
+                )}
+              </InlineNotice>
+            ) : null}
             <p className="mt-1.5 text-xs text-muted-foreground">
               {info
                 ? info.isDefault
```

---

### Incident Patch 14: `c6f9c2c8` (2026-10-04)
**Commit Message**: fix(acp): explain unattended Claude permission denials (#3287)

**File**: `patches/@agentclientprotocol+claude-agent-acp+0.70.0.patch` (modified, +39/-13)
```diff
@@ -12,11 +12,10 @@ diff --git a/node_modules/@agentclientprotocol/claude-agent-acp/dist/acp-agent.d
 diff --git a/node_modules/@agentclientprotocol/claude-agent-acp/dist/acp-agent.js b/node_modules/@agentclientprotocol/claude-agent-acp/dist/acp-agent.js
 --- a/node_modules/@agentclientprotocol/claude-agent-acp/dist/acp-agent.js
 +++ b/node_modules/@agentclientprotocol/claude-agent-acp/dist/acp-agent.js
-@@ -568,6 +568,62 @@
-     }
+@@ -569,6 +569,70 @@
      extNotification(method, params) {
          return this.ctx.notify(method, params);
-+    }
+     }
 +}
 +// Claude snapshots the available tool set when a model request starts. Wait for every MCP server
 +// supplied by the ACP client before returning session/new so the first prompt cannot race startup.
@@ -72,34 +71,43 @@ diff --git a/node_modules/@agentclientprotocol/claude-agent-acp/dist/acp-agent.j
 +        if (pending.size > 0) {
 +            await delay(Math.min(MCP_STATUS_POLL_INTERVAL_MS, Math.max(0, deadline - Date.now())));
 +        }
-     }
++    }
++}
++// Optional Open-Science host denial feedback; unsupported or absent metadata retains ACP defaults.
++function permissionDenialMessage(response, fallback) {
++    const denial = response._meta?.["open-science/permission-denial"];
++    if (denial?.version === 1 && typeof denial.reason === "string" && denial.reason.trim()) {
++        return denial.reason.trim().slice(0, 2048);
++    }
++    return fallback;
  }
  export class ClaudeAcpAgent {
-@@ -1972,6 +2028,7 @@
+     sessions;
+@@ -1972,6 +2036,7 @@
                                          update: {
                                              sessionUpdate: "agent_message_chunk",
                                              content: { type: "text", text: "Compacting..." },
 +                                            _meta: { claudeCode: { isContextCompaction: true } },
                                          },
                                      });
                                  }
-@@ -1985,6 +2042,7 @@
+@@ -1985,6 +2050,7 @@
                                          update: {
                                              sessionUpdate: "agent_message_chunk",
                                              content: { type: "text", text: "\n\nCompacting completed." },
 +                                            _meta: { claudeCode: { isContextCompaction: true } },
                                          },
                                      });
                                  }
-@@ -1996,6 +2054,7 @@
+@@ -1996,6 +2062,7 @@
                                          update: {
                                              sessionUpdate: "agent_message_chunk",
                                              content: { type: "text", text: `\n\nCompacting failed${reason}` },
 +                                            _meta: { claudeCode: { isContextCompaction: true } },
                                          },
                                      });
                                  }
-@@ -2972,7 +3031,7 @@
+@@ -2972,7 +3039,7 @@
                                      cache_creation_input_tokens: usage.cache_creation_input_tokens ?? prev.cache_creation_input_tokens,
                                  };
                              }
@@ -108,7 +116,7 @@ diff --git a/node_modules/@agentclientprotocol/claude-agent-acp/dist/acp-agent.j
                              if (nextUsage !== lastAssistantTotalUsage) {
                                  lastAssistantTotalUsage = nextUsage;
                                  await sendUpdate({
-@@ -3110,7 +3169,7 @@
+@@ -3110,7 +3177,7 @@
                          // aligned with what the user's current selection is producing.
                          if (message.type === "assistant" && message.parent_tool_use_id === null) {
                              lastAssistantUsage = snapshotFromUsage(message.message.usage);
@@ -117,7 +125,7 @@ diff --git a/node_modules/@agentclientprotocol/claude-agent-acp/dist/acp-agent.j
                              lastAssistantWasUsageLimit = isSyntheticUsageLimitMessage(message.message);
                              if (message.error || lastAssistantWasUsageLimit) {
                                  lastAssistantFailureTitle = assistantMessageText(message.message);
-@@ -3718,7 +3777,16 @@
+@@ -3718,7 +3785,16 @@
          if (this.sessions[params.sessionId]) {
              await this.teardownSession(params.sessionId);
          }
@@ -135,15 +143,33 @@ diff --git a/node_modules/@agentclientprotocol/claude-agent-acp/dist/acp-agent.j
          return {};
      }
      async setSessionMode(params) {
-@@ -4995,6 +5063,7 @@
+@@ -4190,7 +4266,7 @@
+                 else {
+                     return {
+                         behavior: "deny",
+-                        message: "User rejected request to exit plan mode.",
++                        message: permissionDenialMessage(response, "User rejected request to exit plan mode."),
+             
```

**File**: `src/main/acp/permission-broker.test.ts` (modified, +253/-5)
```diff
@@ -2,7 +2,8 @@ import { mkdtemp, readFile, rm } from 'node:fs/promises'
 import { tmpdir } from 'node:os'
 import { join } from 'node:path'
 
-import type { RequestPermissionRequest } from '@agentclientprotocol/sdk'
+import type { RequestPermissionRequest, RequestPermissionResponse } from '@agentclientprotocol/sdk'
+import { ClaudeAcpAgent } from '@agentclientprotocol/claude-agent-acp/dist/acp-agent.js'
 import { describe, expect, it, vi } from 'vitest'
 
 import {
@@ -64,6 +65,58 @@ const createPermissionRequest = (sessionId = 'session-1'): RequestPermissionRequ
   ]
 })
 
+describe('issue #3284 shared permission boundary', () => {
+  it.each(permissionRoutes)(
+    'keeps rejection observable but authorizes the next request independently on $modelRoute',
+    async (route) => {
+      const emit = vi.fn()
+      const settled = vi.fn()
+      const broker = new AcpPermissionBroker(emit, undefined, undefined, settled)
+      const context = {
+        ...route,
+        mcpServerNames: ['open-science-notebook'],
+        promptMessageId: 'same-prompt',
+        interactionSequence: 1
+      }
+      const shellRequest = createPermissionRequest()
+      shellRequest.toolCall = {
+        toolCallId: 'denied-shell',
+        title: 'printf permission-probe',
+        kind: 'execute',
+        rawInput: { command: 'printf permission-probe' }
+      }
+      const shell = broker.requestPermission(shellRequest, context)
+      const first = broker.getPendingRequests()[0]
+      await broker.respond({ requestId: first.requestId, optionId: 'reject-once' })
+      expect(await shell).toEqual({ outcome: { outcome: 'selected', optionId: 'reject-once' } })
+      expect(settled).toHaveBeenCalledWith(first.requestId, 'rejected', first)
+
+      const notebookRequest = withTrustedMcpToolIdentity(
+        {
+          ...createPermissionRequest(),
+          toolCall: {
+            toolCallId: 'following-notebook',
+            title: 'Notebook execution',
+            kind: 'execute',
+            rawInput: { language: 'python', code: 'print("permission-probe", end="")' }
+          }
+        },
+        'open-science-notebook/notebook_execute'
+      )
+      const notebook = broker.requestPermission(notebookRequest, context)
+      expect(emit).toHaveBeenCalledTimes(2)
+      const second = broker.getPendingRequests()[0]
+      expect(second.sessionId).toBe(first.sessionId)
+      expect(second.toolCallId).toBe('following-notebook')
+      expect(JSON.stringify(second)).not.toContain('denied-shell')
+      await broker.respond({ requestId: second.requestId, optionId: 'allow-once' })
+      expect(await notebook).toEqual({ outcome: { outcome: 'selected', optionId: 'allow-once' } })
+      expect(settled).toHaveBeenLastCalledWith(second.requestId, 'resolved', second)
+      expect(broker.getPendingRequests()).toEqual([])
+    }
+  )
+})
+
 // Builds a notebook tool permission request that also offers an "always allow" option.
 const createNotebookPermissionRequest = (
   sessionId = 'session-1',
@@ -225,10 +278,191 @@ const restoredContinuationFixture = async (): Promise<{
   return { permission, continuation, policy, providerRequest }
 }
 
+// Public SDK callback, with only the upstream in-memory Session fixture seeded. No model,
+// external process, tool execution, or production test seam is needed for these permission checks.
+const permissionAgent = (
+  requestPermission: (request: RequestPermissionRequest) => Promise<RequestPermissionResponse>
+): ReturnType<ClaudeAcpAgent['canUseTool']> => {
+  const agent = new ClaudeAcpAgent({
+    requestPermission,
+    sessionUpdate: vi.fn().mockResolvedValue(undefined)
+  } as unknown as ConstructorParameters<typeof ClaudeAcpAgent>[0])
+  agent.sessions['issue-3284'] = {
+    cwd: process.cwd(),
+    modes: {
+      currentModeId: 'default',
+      availableModes: [{ id: 'default' }, { id: 'plan' }]
+    },
+    emittedToolCalls: new Set<string>(),
+    liveBackgroundTasks: new Map()
+  } as unknown as ClaudeAcpAgent['sessions'][string]
+  return agent.canUseTool('issue-3284')
+}
+
+describe('issue #3284 permission rejection', () => {
+  it.each(['Bash', 'ExitPlanMode'])(
+    'explains host-disabled permission prompts in the model-visible %s denial',
+    async (toolName) => {
+      const emit = vi.fn()
+      const broker = new AcpPermissionBroker(emit)
+      const canUseTool = permissionAgent((request) =>
+        broker.requestPermission(request, {
+          profile: 'ask',
+          frameworkId: 'claude-code',
+          permissionPrompts: 'none'
+        })
+      )
+
+      const result = await canUseTool(
+        toolName,
+        { command: 'printf permission-probe' },
+        {
+          signal: new AbortController().signal,
+          requestId: 'host-denied-request',
+          toolUseID: 'host-denied-shell'
+        }
+      )
+
+      expect(emit).not.toHaveBeenCalled()
+      expect(result?.behavior).toBe('deny')
+      // The host knows why it 
```

**File**: `src/main/acp/permission-broker.ts` (modified, +13/-0)
```diff
@@ -1465,6 +1465,19 @@ class AcpPermissionBroker {
         // Notification projection failures must never change the permission decision.
       }
       return Promise.resolve({
+        // Only the patched Claude adapter consumes this extension. Keep cancellation, app-owned
+        // approvals and unsupported adapters on their existing wire contract.
+        ...(reject && !pending.appOwned && pending.policyContext.frameworkId === 'claude-code'
+          ? {
+              _meta: {
+                'open-science/permission-denial': {
+                  version: 1,
+                  reason:
+                    'Permission prompts are disabled for this execution, so the host cannot request the approval required to run this tool.'
+                }
+              }
+            }
+          : {}),
         outcome: reject
           ? { outcome: 'selected', optionId: reject.optionId }
           : { outcome: 'cancelled' }
```

**File**: `src/main/acp/runtime.test.ts` (modified, +16/-1)
```diff
@@ -1988,7 +1988,22 @@ describe('unattended permission prompt ownership', () => {
         text: 'Run command',
         permissionPrompts: 'none'
       })
-      expect(responses).toEqual([{ outcome: { outcome: 'selected', optionId: 'reject-once' } }])
+      expect(responses).toEqual([
+        {
+          outcome: { outcome: 'selected', optionId: 'reject-once' },
+          ...(framework.id === 'claude-code'
+            ? {
+                _meta: {
+                  'open-science/permission-denial': {
+                    version: 1,
+                    reason:
+                      'Permission prompts are disabled for this execution, so the host cannot request the approval required to run this tool.'
+                  }
+                }
+              }
+            : {})
+        }
+      ])
       expect(permissionSeen).not.toHaveBeenCalled()
       expect(runtime.getState().pendingPermissions).toEqual([])
       expect(runtime.getPermissionPrompts(session.sessionId)).toBeUndefined()
```

---

### Incident Patch 15: `04e44edd` (2026-10-04)
**Commit Message**: fix(window-menu): keep titlebar above renderer overlays (#3285)

* fix(window-menu): keep titlebar above renderer overlays

* style(window-menu): format design token table

**File**: `docs/design.md` (modified, +6/-5)
```diff
@@ -285,11 +285,12 @@ colors communicate a successful or failed probe/migration result.
 
 ### Named Layer Tokens
 
-| Token                     | Tailwind class    | Value | Usage                                                                |
-| ------------------------- | ----------------- | ----- | -------------------------------------------------------------------- |
-| `--z-index-modal`         | `z-modal`         | `50`  | Standard portaled modal layer (e.g. the notification center popover) |
-| `--z-index-toast`         | `z-toast`         | `40`  | Background notices and undo snackbars below modal backdrops          |
-| `--z-index-markdown-menu` | `z-markdown-menu` | `200` | Streamdown Mermaid and table format menus above fullscreen content   |
+| Token                     | Tailwind class    | Value  | Usage                                                                |
+| ------------------------- | ----------------- | ------ | -------------------------------------------------------------------- |
+| `--z-index-modal`         | `z-modal`         | `50`   | Standard portaled modal layer (e.g. the notification center popover) |
+| `--z-index-toast`         | `z-toast`         | `40`   | Background notices and undo snackbars below modal backdrops          |
+| `--z-index-markdown-menu` | `z-markdown-menu` | `200`  | Streamdown Mermaid and table format menus above fullscreen content   |
+| `--z-index-titlebar`      | —                 | `1000` | Windows application menu row above renderer overlays                 |
 
 Shared `Dialog` and `AlertDialog` own modal stacking through `overlay-layer.ts`.
 Their root advances the inherited layer by 20 (the first modal is 60); Select,
```

**File**: `src/renderer/src/assets/main.css` (modified, +3/-1)
```diff
@@ -23,7 +23,8 @@ html[data-windows-titlebar='fullscreen'] {
   position: fixed;
   inset: 0 0 auto;
   height: var(--windows-titlebar-height);
-  z-index: 40;
+  /* Keep the Windows application menu legible when a renderer overlay covers the app content. */
+  z-index: var(--z-index-titlebar);
   -webkit-app-region: drag;
 }
 
@@ -351,6 +352,7 @@ html[data-windows-titlebar] .windows-app-content :is(.min-h-svh, .min-h-screen)
   --z-index-modal: 50;
   --z-index-toast: 40;
   --z-index-markdown-menu: 200;
+  --z-index-titlebar: 1000;
   --radius-sm: calc(var(--radius) - 4px);
   --radius-md: calc(var(--radius) - 2px);
   --radius-lg: var(--radius);
```

**File**: `src/renderer/src/components/WindowsTitleBar.test.tsx` (modified, +14/-0)
```diff
@@ -1,4 +1,6 @@
 // @vitest-environment jsdom
+import { readFileSync } from 'node:fs'
+import { resolve } from 'node:path'
 import { useState } from 'react'
 import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
 import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
@@ -88,6 +90,18 @@ describe('Windows title bar', () => {
     })
     expect(screen.getByRole('textbox')).toBeTruthy()
   })
+  it('keeps the title bar above modal and markdown overlays', () => {
+    const css = readFileSync(resolve(__dirname, '../assets/main.css'), 'utf8')
+    const titlebarZIndex = css.match(/--z-index-titlebar:\s*(\d+)/)?.[1]
+    const modalZIndex = css.match(/--z-index-modal:\s*(\d+)/)?.[1]
+    const markdownMenuZIndex = css.match(/--z-index-markdown-menu:\s*(\d+)/)?.[1]
+
+    expect(titlebarZIndex).toBeDefined()
+    expect(modalZIndex).toBeDefined()
+    expect(markdownMenuZIndex).toBeDefined()
+    expect(Number(titlebarZIndex)).toBeGreaterThan(Number(modalZIndex))
+    expect(Number(titlebarZIndex)).toBeGreaterThan(Number(markdownMenuZIndex))
+  })
   it('starts with application commands disabled before the presentation owner mounts', async () => {
     render(
       <WindowsTitleBar>
```

#### Recent Merged Pull Requests:
- **PR #3312** (2026-10-06): fix(ci-regression): stabilize nightly and Windows test checks (@ewen-poch)
- **PR #3310** (2026-10-06): chore(release): bump to v0.35.1 (@ewen-poch)
- **PR #3307** (2026-10-05): fix(window-layout): exclude titlebar from portaled surfaces (@ewen-poch)
- **PR #3306** (2026-10-05): fix(composer): preserve context across session binding (@ewen-poch)
- **PR #3305** (2026-10-05): fix(ci-regression): stabilize native navigation and preview checks (@ewen-poch)
- **PR #3304** (2026-10-05): feat(iedb): add TCR and BCR receptor evidence searches (@nasus2002)
- **PR #3301** (2026-10-05): fix(workspace): align side chat composer and reading icons (@ewen-poch)
- **PR #3300** (2026-10-05): chore(repo): reduce root directory clutter (@ewen-poch)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
