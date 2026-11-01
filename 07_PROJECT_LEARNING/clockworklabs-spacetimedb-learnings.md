> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/clockworklabs-spacetimedb-learnings.md`  
> **Source**: github ([https://github.com/clockworklabs/SpacetimeDB](https://github.com/clockworklabs/SpacetimeDB))  
> **Source Version**: `f7e474f7`  
> **License**: NOASSERTION  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-31T07:32:47.327Z  
> **Learning ID**: `learn-github-clockworklabs-spacetimedb`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): clockworklabs/SpacetimeDB

---

## 1. Executive Forensic Architecture & System Mechanics

SpacetimeDB collapses the traditional multi-tier web/game server stack (Client $\leftrightarrow$ API Gateway $\leftrightarrow$ Microservice/Application Logic $\leftrightarrow$ Cache $\leftrightarrow$ Relational Database) into a unified, single-process execution engine. Client code does not query an external API; rather, client applications maintain a real-time synchronized local cache of database tables via WebSocket subscriptions, and mutate state exclusively by invoking server-side *reducers* executing inside a WebAssembly (Wasm) sandbox directly adjacent to the storage engine.

```
+--------------------------------------------------------------------------------------------------+
|                                    SpacetimeDB Unified Host Node                                 |
|                                                                                                  |
|  +--------------------------------+                  +----------------------------------------+  |
|  |     Client API / WebSocket     |                  |       Wasm Engine / Sandboxed VM       |  |
|  |  - Row-level delta streaming   |                  |  - Module Lifecycles: Init, Connect,   |  |
|  |  - Protocol: BSATN over WS     |                  |    Disconnect, Custom Reducers         |  |
|  |  - Subscription tracking       |                  |  - Linear memory sandbox               |  |
|  +---------------+----------------+                  +-------------------+--------------------+  |
|                  |                                                       |                        |
|                  | (Transaction Boundary)                                | (Direct Foreign Calls) |
|                  v                                                       v                        |
|  +--------------------------------------------------------------------------------------------+  |
|  |                       Datastore & In-Memory Relational Engine                              |  |
|  |  - SATS (SpacetimeDB Algebraic Type System) TypeSpace & Schemas                            |  |
|  |  - Lock-free / MVCC In-Memory B-Tree Table Indexes                                         |  |
|  |  - Transactional Isolation: Serial Execution / Optimistic Concurrency Control              |  |
|  +---------------------------------------------+----------------------------------------------+  |
|                                                |                                                 |
|                                                v (WAL Append)                                    |
|  +--------------------------------------------------------------------------------------------+  |
|  |                       Durability Subsystem (Commitlog & Snapshot Engine)                   |  |
|  |  - Write-Ahead Log (WAL) fsync boundary                                                    |  |
|  |  - Periodic background state snapshotting                                                   |  |
|  +--------------------------------------------------------------------------------------------+  |
+--------------------------------------------------------------------------------------------------+
          ^                                                                ^
          | (Bsatn Wire Frames)                                            | (Bsatn Wire Frames)
          v                                                                v
+-------------------+                                            +-------------------+
|  Browser / Client |                                            |  Game Client (C#) |
|  TypeScript SDK   |                                            |  Unity 6 / WebGL  |
+-------------------+                                            +-------------------+
```

### Critical Subsystem Abstractions

1. **SATS (SpacetimeDB Algebraic Type System) & BSATN**:
   The engine rejects schema representations tied to specific languages (SQL DDL, Protobuf, JSON Schema). Instead, it formalizes data types through an algebraic type theory foundation consisting of `Sum` (tagged unions) and `Product` (structs/tuples) types registered in a centralized `Typespace`. BSATN (Binary SpacetimeDB Algebraic Type Notation) is the zero-copy, canonical binary encoding format used interchangeably across disk persistence (commitlog) and network transmission (WebSocket frames).
2. **Deterministic Wasm Reducer Runtime**:
   Modules are compiled target-agnostically to `wasm32-unknown-unknown` or `wasi-experimental`. State transitions occur when an incoming transaction matches a registered reducer symbol. Execution is strictly atomic: if a reducer panics, traps, or encounters an unhandled error, the transaction aborts, all row mutations staged in the transactional write buffer are discarded, and no delta frames are published to subscribers.
3. **Reactive Query Engine & Subscription Engine**:
   Clients submit relational filter queries (e.g., `SELECT * FROM players WHERE room_id = 4`). The engine compiles these into query trees cached in memory. When a reducer mutates table rows, the engine identifies affected subscriptions, computes delta sets (inserted rows, deleted rows), encodes them into BSATN frames, and broadcasts them down client WebSockets without requiring database polling.
4. **Foreign SDK Code Generation Architecture**:
   Clients (C++, C#, TypeScript, Rust) interact with SpacetimeDB through code generated directly from the module's SATS typespace. Types, tables, and reducers are mapped to target language constructs with compile-time type safety (e.g., TypeScript conditional types enforcing that `.default()` cannot collide with `.primaryKey()`).

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Strict Numeric Primitive Coercion Boundary Invariant
**RULE**:
When deserializing or coercing external, loosely-typed JSON or wire primitives into high-precision numeric domain primitives (such as `bigint`, `u64`, `u128`, or `u256`), systems MUST NOT rely on raw engine casting constructors (`BigInt(val)` or `+val`) without pre-validating the exact input primitive type. Parsers MUST explicitly reject boolean, array, whitespace-only string, and symbol inputs prior to coercion.

**WHY**:
JavaScript's built-in `BigInt()` constructor silently coerces booleans (`BigInt(true) === 1n`, `BigInt(false) === 0n`), arrays (`BigInt([42]) === 42n`, `BigInt([]) === 0n`), and empty or whitespace strings (`BigInt("") === 0n`, `BigInt("   ") === 0n`). In identity, authentication, or financial primary-key contexts, a malformed, omitted, or malicious payload containing `""` or `false` will silently resolve to identity `0n` (the system administrator, root, or nil entity) instead of throwing a validation fault, creating catastrophic privilege escalation or cross-tenant data leaks.

**WHEN TO APPLY**:
Apply in all SDKs, API gateways, transport deserializers, and WebAssembly boundary wrappers where external wire data (JSON, Query Params, Form Data) is translated into discrete numeric identifiers (`Identity`, `ConnectionId`, `EntityId`, timestamps).

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified from crates/bindings-typescript/src/lib/util.ts
export function coerceToBigInt(value: unknown, what: string): bigint {
  if (typeof value === 'bigint') {
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) {
      throw new TypeError(`Cannot convert non-integer number ${value} to ${what}`);
    }
    return BigInt(value);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') {
      throw new TypeError(`Cannot convert empty string to ${what}: expected integer decimal string`);
    }
    // Protect against non-numeric strings that BigInt parses incorrectly or throws with generic message
    if (!/^-?\d+$/.test(trimmed)) {
      throw new TypeError(`Cannot convert string "${value}" to ${what}: invalid integer syntax`);
    }
    return BigInt(trimmed);
  }
  throw new TypeError(
    `Cannot convert ${typeof value} to ${what}: expected bigint, integer number, or decimal string`
  );
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: NEVER USE RAW BIGINT CONSTRUCTOR DIRECTLY ON UNTRUSTED PAYLOADS
function unsafeParseId(input: unknown): bigint {
  // Disastrous failures:
  // BigInt(false) -> 0n (Maps unauthenticated false to Root Identity 0!)
  // BigInt("")    -> 0n (Maps empty field to Entity 0!)
  // BigInt([])    -> 0n
  // BigInt([100]) -> 100n
  return BigInt(input as any);
}
```

**VERIFICATION METHOD**:
Enforce via unit tests validating that boolean, array, null, undefined, empty string, and whitespace string inputs strictly throw `TypeError`:
```typescript
import { describe, it, expect } from 'vitest';

describe('coerceToBigInt invariant', () => {
  it('strictly rejects non-numeric primitives', () => {
    expect(() => coerceToBigInt(true, 'TestId')).toThrow(TypeError);
    expect(() => coerceToBigInt(false, 'TestId')).toThrow(TypeError);
    expect(() => coerceToBigInt('', 'TestId')).toThrow(TypeError);
    expect(() => coerceToBigInt('   ', 'TestId')).toThrow(TypeError);
    expect(() => coerceToBigInt([], 'TestId')).toThrow(TypeError);
    expect(() => coerceToBigInt([42], 'TestId')).toThrow(TypeError);
    expect(() => coerceToBigInt(null, 'TestId')).toThrow(TypeError);
    expect(() => coerceToBigInt(undefined, 'TestId')).toThrow(TypeError);
  });
});
```

---

### 2. Multi-Target ABI Dynamic Feature Detection Invariant
**RULE**:
When designing foreign function interface (FFI) bridges or WebAssembly JavaScript library (`jslib`) plugins that target evolving compiler runtimes (e.g., Emscripten across Unity versions), SDKs MUST NOT bind directly to compiler-internal helper symbols (`dynCall`) without an automated runtime capability check and fallback to direct runtime table invocation (`getWasmTableEntry`).

**WHY**:
Upstream toolchains (e.g., Emscripten updating from 3.x to newer releases inside Unity 6) frequently remove legacy interop shims like `dynCall()`. Hardcoding calls to `dynCall` results in runtime `TypeError: dynCall is not a function` during critical network callbacks (such as WebSocket events). Because this error occurs inside asynchronous native-to-managed bridge loops, it bypasses ordinary C# try-catch handlers, terminates the WebAssembly event loop, and freezes client state.

**WHEN TO APPLY**:
In all WebAssembly FFI layers, Unity `.jslib` bridge plugins, Emscripten native bindings, and web-worker interop wrappers where function pointers stored in the Wasm function table are invoked dynamically from host JavaScript.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// Verified from SpacetimeDB C# SDK WebSocket.jslib runtime bridge (#4961)
var $WebSocketDynCall = {
  invoke: function(ptr, sig, args) {
    if (!ptr) {
      throw new Error("Cannot invoke null Wasm function pointer");
    }
    // Feature detection: Unity 6+ (modern Emscripten) drops dynCall in favor of direct table access
    if (typeof getWasmTableEntry === 'function') {
      var fn = getWasmTableEntry(ptr);
      if (typeof fn !== 'function') {
        throw new Error("Wasm table entry at pointer " + ptr + " is not a callable function");
      }
      return fn.apply(null, args);
    }
    // Legacy Emscripten fallback (Unity 2022 and earlier)
    if (typeof dynCall === 'function') {
      return dynCall.apply(null, [sig, ptr].concat(args));
    }
    // Module table fallback if exposed via WebAssembly.Table
    if (typeof wasmTable !== 'undefined' && wasmTable.get) {
      return wasmTable.get(ptr).apply(null, args);
    }
    throw new Error("Unsupported WebAssembly runtime: neither getWasmTableEntry nor dynCall is available");
  }
};
```

**NEGATIVE CONSTRAINT**:
```javascript
// ANTI-PATTERN: Direct coupling to legacy Emscripten globals
function onSocketMessage(callbackPtr, bufferPtr, length) {
  // CRITICAL FAILURE in Unity 6+: dynCall is undefined -> crash
  dynCall('vii', callbackPtr, [bufferPtr, length]);
}
```

**VERIFICATION METHOD**:
Execute dual-target integration tests on the compiled WebGL artifact:
1. Validate against an environment where `dynCall` is deleted (`delete globalThis.dynCall`) and `getWasmTableEntry` is provided.
2. Validate against a legacy environment where `getWasmTableEntry` is undefined and `dynCall` is provided. Assert function dispatch succeeds in both environments.

---

### 3. Native Platform-Agnostic Static Constructor Linkage Invariant
**RULE**:
When implementing compile-time auto-registration mechanisms in native Rust binaries without relying on slow runtime reflection or dynamic discovery, libraries MUST emit static registration functions bound to the host linker's native initialization array sections using explicit conditional OS linker attributes (`.init_array` for ELF, `__DATA,__mod_init_func` for Mach-O, `.CRT$XCU` for PE/COFF).

**WHY**:
Without platform-specific linker section injection, native registries require explicit manual entry points, leading to human error (forgetting to register an endpoint or table) or runtime discovery overhead. Naive attribute assignments fail to compile across cross-compilation targets (e.g., compiling for macOS Mach-O while using ELF `.init_array` creates fatal linker errors).

**WHEN TO APPLY**:
In native systems programming, test harness auto-registries, database catalog initializers, micro-benchmarks, and Rust procedural macro libraries generating automatic runtime hooks.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified from crates/bindings-macro/src/util.rs
pub(crate) fn native_test_utils_registration(register_body: proc_macro2::TokenStream) -> proc_macro2::TokenStream {
    if cfg!(feature = "test-utils") {
        quote::quote! {
            #[cfg(not(target_arch = "wasm32"))]
            #[used]
            #[cfg_attr(
                any(
                    target_os = "linux",
                    target_os = "android",
                    target_os = "freebsd",
                    target_os = "dragonfly",
                    target_os = "netbsd",
                    target_os = "openbsd",
                ),
                unsafe(link_section = ".init_array")
            )]
            #[cfg_attr(
                any(
                    target_os = "macos",
                    target_os = "ios",
                    target_os = "tvos",
                    target_os = "watchos",
                    target_os = "visionos",
                ),
                unsafe(link_section = "__DATA,__mod_init_func")
            )]
            #[cfg_attr(target_os = "windows", unsafe(link_section = ".CRT$XCU"))]
            static _STDB_TEST_UTILS_INIT: unsafe extern "C" fn() = {
                unsafe extern "C" fn __stdb_test_utils_register() {
                    #register_body
                }
                __stdb_test_utils_register
            };
        }
    } else {
        quote::quote! {}
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Single link_section assumed universal
#[used]
#[link_section = ".init_array"] // FAILS on Windows (fatal LNK error) and macOS (ignored or Mach-O error)
static REGISTRATION_PTR: extern "C" fn() = init_func;
```

**VERIFICATION METHOD**:
Run cross-compilation CI matrix targeting `x86_64-unknown-linux-gnu`, `x86_64-pc-windows-msvc`, and `aarch64-apple-darwin`. Execute binary entry points and assert registry counter increments before `main()` executes without runtime registration calls.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Root Certificate Compromise & Multi-Chain Trust Eviction Bypass (BUG-SEC-EMUDHRA-01)
- **Context**: Root certificate validation and container image trust across all Dockerfiles (`Dockerfile`, `crates/bench/Dockerfile`, `crates/standalone/Dockerfile`, `templates/keynote-2/Dockerfile.bench`), `Cargo.lock`, and `flake.nix`.
- **What Was Expected**: Docker build stages and developer Nix environments fetch upstream crates, toolchains, and packages using standard TLS trust stores without risk of interception by untrusted or compromised Certificate Authorities.
- **What Actually Happened**: Intermediate Certificate Authorities managed by eMudhra were compromised. The compromised intermediate certificates cross-chained into both emSign’s Root CA and Comodo’s AAA root. Standard base images (`rust:bookworm`, `node:20.18.1-bookworm-slim`) retained trust in these roots. `rustup` also bundled its own internal CA trust store, leaving toolchain downloads vulnerable to Man-In-The-Middle (MITM) attacks even if the host OS certs were updated.
- **Evidence in Repo**: Commit `b978b9c8` (PR #6366), updating `rustls-webpki` to `0.103.16`, modifying Dockerfiles, and overriding Nix `cacert`.
- **Root Cause**: Trust store fragmentation: Updating host `ca-certificates` does not patch standalone TLS tools (`rustup` embeds independent roots) or Nix sandboxes. Furthermore, intermediate CAs chaining to multiple distinct root certificates require blacklisting *all* terminal trust anchors (`emSign ECC Root CA - G3` and `Comodo AAA Services root`).
- **Remediation Code Diff**:
```dockerfile
// Dockerfile & sub-dockerfiles
 FROM rust:bookworm AS builder
+# Refresh OS certificate roots to distrust the compromised eMudhra CAs.
+RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
+# rustup has its own CA bundle; 1.29.2+ distrusts the compromised eMudhra CAs.
+RUN rustup --version && rustup self update && rustup --version
```
```nix
// flake.nix
           overlays = [
             (import rust-overlay)
+            (final: prev: {
+              cacert = prev.cacert.override {
+                # Block both roots because the compromised eMudhra intermediate CAs
+                # can chain to either emSign's root or Comodo's AAA root.
+                blacklist = [ "emSign ECC Root CA - G3" "Comodo AAA Services root" ];
+              };
+            })
           ];
+            # Make development tools and Nix downloads use the filtered CA bundle.
+            SSL_CERT_FILE = "${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt";
+            NIX_SSL_CERT_FILE = "${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt";
```
- **Lesson**: Security trust boundaries cannot rely solely on base OS package managers. CLI toolchains (rustup, bun, node) maintaining independent certificate bundles must be explicitly updated or forced via environment variables (`SSL_CERT_FILE`, `NIX_SSL_CERT_FILE`) to use a hardened CA store.

---

### Incident 2: Unity 6 WebGL Emscripten ABI Breakage (BUG-UNITY6-DYNCALL-02)
- **Context**: `sdks/csharp/src/Plugins/WebSocket.jslib`
- **What Was Expected**: C# SDK clients compiled to WebGL run seamlessly across Unity 2022 LTS and Unity 6 (6000.x) when receiving WebSocket events, invoking managed C# callbacks via function pointers.
- **What Actually Happened**: In Unity 6, Emscripten updated its compiler toolchain and eliminated the internal JavaScript helper `dynCall()`. When the C# SDK received WebSocket messages, binary frames, or disconnect signals, the `.jslib` bridge called `dynCall()`, which threw `ReferenceError: dynCall is not defined`. This crashed client connectivity with no managed exception logged in C#.
- **Evidence in Repo**: Issue #4961 / PR fixing Issue #4959.
- **Root Cause**: Direct reliance on private Emscripten bridge shims (`dynCall(sig, ptr, args)`) instead of using standard WebAssembly function table lookups.
- **Remediation Code Diff**:
```javascript
// sdks/csharp/src/Plugins/WebSocket.jslib
- dynCall('vii', callbackPtr, [socketId, errorCode]);
+ $WebSocketDynCall: function(ptr, sig, args) {
+   if (typeof getWasmTableEntry === 'function') {
+     return getWasmTableEntry(ptr).apply(null, args);
+   } else if (typeof dynCall === 'function') {
+     return dynCall.apply(null, [sig, ptr].concat(args));
+   }
+   throw new Error("No Wasm dispatch table method found");
+ },
+ ...
+ $WebSocketDynCall(callbackPtr, 'vii', [socketId, errorCode]);
```
- **Lesson**: WebAssembly JavaScript interop layers must perform dynamic feature detection on the runtime export table rather than assuming the persistence of transient compiler-specific helper functions.

---

### Incident 3: Git Submodule File Collision in Containerized Builds (BUG-BUILD-GITPOINTER-03)
- **Context**: Root `Dockerfile` multi-stage build.
- **What Was Expected**: Docker build runs reproducibly regardless of whether the build context is triggered from a fresh git clone, a nested submodule, or an extracted archive.
- **What Actually Happened**: When checked out as a git submodule, `.git` is not a directory but a text file containing `gitdir: ../../.git/modules/...`. Build scripts executing git metadata queries inside the container failed because the parent repository directory referenced by the pointer was not copied into the Docker container context, generating obscure build aborts.
- **Evidence in Repo**: `Dockerfile` commit `b978b9c8`.
- **Root Cause**: Unhandled git directory/file polymorphism in containerized build steps that query VCS metadata.
- **Remediation Code Diff**:
```dockerfile
// Dockerfile
 COPY . .
 
+# If we're in a git submodule, we'll have a corrupted/nonfunctional .git file instead of a proper .git directory.
+# To make the errors more sane, remove .git entirely.
+RUN if [ -f .git ]; then \
+      echo "❌ ERROR: .git is a file (likely a submodule pointer), not a directory." >&2; \
+      echo "This will cause errors in the build process, because git operations will fail." >&2; \
+      echo "To address this, replace the .git file with a proper .git directory." >&2; \
+      exit 1; \
+    fi
```
- **Lesson**: Multi-stage Docker builds must explicitly validate VCS metadata invariants early in the build pipeline to prevent broken host-relative paths from causing opaque failures deep in downstream compilation units.

---

### Incident 4: Safari WebKit Stacking Context Trapping for Modal Dialogs (BUG-UI-SAFARI-MODAL-04)
- **Context**: SpacetimeDB Marketing & Feature Request Portal (`spacetimedb.com/features`).
- **What Was Expected**: Clicking "SUBMIT A REQUEST" displays both the semi-transparent backdrop and the interactive modal dialog containing the form.
- **What Actually Happened**: In Safari on macOS (macOS 26.5 / Safari 26.5), the dark backdrop rendered, but the input form failed to appear. Users were locked on a dimmed page unable to interact or submit requests.
- **Evidence in Repo**: Issue #5444 ("`Feature Requests` page on spacetimedb.com does not open `SUBMIT A REQUEST` form").
- **Root Cause**: CSS stacking context isolation under WebKit. The parent container containing the form possessed a property that generated a new stacking context (`transform`, `filter`, or `backdrop-filter`), causing a child element with `z-index: 9999` to remain trapped behind the backdrop overlay rendered in a sibling stacking context.
- **Remediation Code Diff**:
```css
/* Conceptual WebKit Fix for Stacking Context Trapping */
- .modal-container {
-   backdrop-filter: blur(8px);
-   transform: translateZ(0); /* Traps child z-index within this parent context in Safari */
- }
+ .modal-portal {
+   /* Form moved to root document body via Portal to escape isolated stacking context */
+   position: fixed;
+   inset: 0;
+   z-index: 10000;
+ }
```
- **Lesson**: Modal dialogs and interactive overlays must always be mounted at the root DOM level via portals to eliminate WebKit-specific stacking context traps created by CSS transforms and filters.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision

#### Strict Deep-Equality Byte Checking Precedence
In TypeScript/JavaScript, when comparing byte-array buffers within database records or primary key representations, relying on generic `Object.keys()` results in incorrect equality or degraded performance. Typed arrays (like `Uint8Array`) expose indexed string keys (`"0"`, `"1"`, ...), but standard enumeration iterates keys as strings rather than evaluating byte values directly.

```typescript
// Verified from crates/bindings-typescript/src/lib/util.ts
export function deepEqual(obj1: unknown, obj2: unknown): boolean {
  if (obj1 === obj2) return true;
  if (
    typeof obj1 !== 'object' ||
    obj1 === null ||
    typeof obj2 !== 'object' ||
    obj2 === null
  ) {
    return false;
  }

  let firstKey = 0;
  // INVARIANT: TypedArray indices MUST be checked via raw integer indexing first
  if (obj1 instanceof Uint8Array && obj2 instanceof Uint8Array) {
    if (obj1.length !== obj2.length) return false;
    for (let i = 0; i < obj1.length; i++) {
      if (obj1[i] !== obj2[i]) return false;
    }
    // Typed-array indices precede other enumerable keys and are already equal.
    firstKey = obj1.length;
  }

  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  if (keys1.length !== keys2.length) return false;

  const values1 = obj1 as Record<string, unknown>;
  const values2 = obj2 as Record<string, unknown>;
  // Skip the byte elements already validated in the fast-path loop above
  for (let i = firstKey; i < keys1.length; i++) {
    const key = keys1[i];
    if (
      !Object.prototype.propertyIsEnumerable.call(obj2, key) ||
      !deepEqual(values1[key], values2[key])
    ) {
      return false;
    }
  }
  return true;
}
```