> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/bitterbot-ai-bitterbot-desktop-learnings.md`  
> **Source**: github ([https://github.com/Bitterbot-AI/bitterbot-desktop](https://github.com/Bitterbot-AI/bitterbot-desktop))  
> **Source Version**: `733b7419`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-23T05:41:36.427Z  
> **Learning ID**: `learn-github-bitterbot-ai-bitterbot-desktop`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): Bitterbot-AI/bitterbot-desktop

---

## 1. Executive Forensic Architecture & System Mechanics

```
                              ┌──────────────────────────────────────────────┐
                              │           Tauri / Web Control UI             │
                              │   (React 19, Zustand, Sonner, Tailwind CSS)  │
                              └──────────────────────┬───────────────────────┘
                                                     │ JSON-RPC / WebSocket
                                                     ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ BITTERBOT GATEWAY DAEMON (Node.js / TypeScript ESM)                                                │
│                                                                                                    │
│  ┌────────────────────────┐  ┌────────────────────────┐  ┌──────────────────────────────────────┐  │
│  │     Channel Router     │  │  Memory Search Manager │  │        Compute Awareness Layer       │  │
│  │  (Discord, Slack, Tg,  │  │ (FTS5 + SQLite-Vector) │  │  (Worker Provenance & Egress Filter) │  │
│  │   WhatsApp, Signal)    │  │                        │  │                                      │  │
│  └───────────┬────────────┘  └───────────┬────────────┘  └──────────────────┬───────────────────┘  │
│              │                           │                                  │                      │
│              ▼                           ▼                                  ▼                      │
│  ┌────────────────────────┐  ┌────────────────────────┐  ┌──────────────────────────────────────┐  │
│  │ Multi-Agent Workspace  │  │  Dream / Consolidation │  │     Soapbox P2P / Coordinator IPC    │  │
│  │  (Genome, Protocols,   │  │   (Working Memory Sync │  │   (Local GPU Operator, Private/      │  │
│  │    Working Memory)     │  │    & Episode Sinks)    │  │    Collective Worker Topologies)     │  │
│  └────────────────────────┘  └────────────────────────┘  └──────────────────────────────────────┘  │
└──────────────────────────────────────────┬─────────────────────────────────────────────────────────┘
                                           │ stdio / IPC (Sandboxed Worker)
                                           ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ISOLATED SUBPROCESS WORKER (Node.js isolated environment)                                          │
│  - Virtualized `Date` (Deterministic wall-clock, real perf_hooks)                                   │
│  - Sandboxed `fetch` (Broker routing via stdio; zero API credentials in worker memory)              │
│  - SQLite Transaction Engine (Atomic write-sync & backfill progress validation)                    │
└────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

Bitterbot-Desktop provides a sovereign, local-first personal AI operating system featuring persistent cognitive memory, dreaming (asynchronous offline memory consolidation), multi-channel chat routing, and a cryptographically settled peer-to-peer compute/agent economy.

### Core Subsystems and Architecture Boundaries

1. **Gateway Daemon & Process Boundary**: The host runs a long-lived Node.js daemon (ESM) acting as the local coordinator. The user interface connects over authenticated WebSockets or same-origin HTTP handoffs. Subprocess isolation guarantees that un-sandboxed agent code cannot access system credentials directly.
2. **Cognitive Memory Subsystem (`src/memory/`)**: Built atop SQLite using full-text search (FTS5) and vector extensions. It manages chunked message ingestion, session transcripts, hierarchical memory distillation (`GENOME.md` -> `PROTOCOLS.md` -> `MEMORY.md`), and episodic compute feedback loops.
3. **Compute Awareness & Egress Governance (`src/compute/awareness/`)**: Enforces strict data-loss prevention (DLP). Every piece of contextual data is stamped with a governance class (`personal`, `confidential`, `normal`). Data can only be routed to compute nodes whose trust rank satisfies the class ceiling.
4. **Economic & Settlement Boundary (`x402`, Base Layer 2, Stripe Onramp)**: Implements agent wallet balances, HTTP 402 Payment Required negotiations with automatic USDC micropayment settlement on Base, and offloaded credential validation.
5. **Secure Isolated Worker Boundary (`benchmarks/longmemeval-v2/worker.ts`)**: Completely strips runtime environment variables (`OPENAI_API_KEY`, etc.), denies arbitrary network access, overrides `fetch` to proxy through a secure host broker via standard input/output (stdio) IPC, and virtualizes the `Date` object to prevent temporal leakage during evaluation traces.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Provenance-Based Trust Derivation Rule

**RULE**:
Security boundaries, egress policies, and trust levels MUST NOT be inferred from user-controlled, mutable string identifiers (such as names, tags, or IDs). Trust MUST be dynamically evaluated at runtime from immutable cryptographic identity, execution topology, or verifiable worker ownership.

**WHY**:
Relying on nominal conventions (e.g., matching a pool name against `"local"`) creates severe vulnerability and fragility. If an administrative pool is named `"private"` or a remote, untrusted peer connects to a pool renamed `"local"`, governance mechanisms either leak confidential inputs off-premises or unnecessarily demote local resources.

**WHEN TO APPLY**:
Apply to any distributed compute, microservice broker, RPC dispatcher, or multi-tenant system where data classification levels dictate hardware placement or payload egress.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
/**
 * Evaluates whether a compute pool is truly local.
 * Requires:
 * 1. Active members exist.
 * 2. Every single member ID is strictly contained in the set of machine-owned workers.
 */
export interface ComputeWorkerReference {
  readonly id: string;
}

export function isPoolPhysicallyLocal(
  members: readonly ComputeWorkerReference[],
  localWorkerIds: ReadonlySet<string> | null,
): boolean {
  if (!localWorkerIds || members.length === 0) {
    return false;
  }
  return members.every((worker) => localWorkerIds.has(worker.id));
}

export function resolveEffectivePoolTrust(
  poolId: string,
  members: readonly ComputeWorkerReference[],
  localWorkerIds: ReadonlySet<string> | null,
  configuredTrustResolver: (id: string) => "trusted" | "untrusted",
): "local" | "trusted" | "untrusted" {
  if (isPoolPhysicallyLocal(members, localWorkerIds)) {
    return "local";
  }
  // Fall back to explicit administrative configuration; never allow config to assert "local".
  return configuredTrustResolver(poolId);
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Inferring hardware boundaries and security clearance from pool identifiers
export function resolvePoolTrustInsecure(poolName: string): "local" | "untrusted" {
  // CRITICAL HAZARD: A foreign worker joining a pool called "local" 
  // will receive confidential payloads!
  if (poolName.toLowerCase() === "local") {
    return "local";
  }
  return "untrusted";
}
```

**VERIFICATION METHOD**:
Enforce through unit test assertions proving:
1. An empty node list evaluates to `"untrusted"`.
2. A pool named `"local"` with an unknown member evaluates to `"untrusted"`.
3. A pool named `"private"` whose members all exist in `localWorkerIds` evaluates to `"local"`.

---

### 2. Multi-Purpose Singleton Re-Attachment Rule

**RULE**:
When an object instance is shared or cached across different consumers and call contexts, dynamic subscriptions, event sinks, and hooks MUST NOT be registered only within the initial constructor or creation branch. Shared cached instances MUST re-verify and re-attach all requisite hooks on EVERY access or retrieval.

**WHY**:
If the initial factory call initializes the instance for an auxiliary or restricted context (e.g., a lightweight status check, health check, or diagnostic probe), guarded initialization blocks will be bypassed. Subsequent requests requiring fully wired subsystems hit the uninitialized cache entry, silently dropping events, metrics, or memory updates for the rest of the application lifecycle.

**WHEN TO APPLY**:
Apply to all caching mechanisms (memoized singletons, connection managers, service registries) that expose reactive sinks, event listeners, or hooks tied to global lifecycle states.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
export class ManagedServiceRegistry<TContext, TConfig> {
  private static instanceCache = new Map<string, ManagedServiceRegistry<any, any>>();
  private activeSink: ((event: unknown) => Promise<void>) | null = null;
  private isClosed = false;

  public static getOrCreate(key: string, config: TConfig, purpose?: string): ManagedServiceRegistry<any, any> {
    let instance = this.instanceCache.get(key);
    if (!instance) {
      instance = new ManagedServiceRegistry(config);
      this.instanceCache.set(key, instance);
    }
    // INVARIANT: Re-verify subscriptions on both fresh instantiations AND cache hits
    instance.ensureActiveSubscriptions(config);
    return instance;
  }

  private constructor(private readonly config: TConfig) {}

  public ensureActiveSubscriptions(config: TConfig): void {
    if (this.isClosed) return;

    if (!GlobalEventHub.hasRegisteredSink()) {
      this.activeSink = async (event: unknown) => {
        await this.handleEvent(event);
      };
      GlobalEventHub.registerSink(this.activeSink);
    }
  }

  public async close(): Promise<void> {
    this.isClosed = true;
    if (this.activeSink) {
      GlobalEventHub.unregisterSink(this.activeSink);
      this.activeSink = null;
    }
  }

  private async handleEvent(event: unknown): Promise<void> {
    // Process event payload...
  }
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Gating event sink registration behind the first caller's invocation purpose
export function getService(config: Config, purpose?: string): Service {
  let instance = CACHE.get(config.id);
  if (!instance) {
    instance = new Service(config);
    // SILENT DEFECT: If initial caller has purpose: "probe", 
    // the event sink is NEVER wired for subsequent callers!
    if (purpose === undefined) {
      registerGlobalSink(instance.sink);
    }
    CACHE.set(config.id, instance);
  }
  return instance;
}
```

**VERIFICATION METHOD**:
Implement a sequence integration test:
1. Initialize the service with `{ purpose: "probe" }`. Verify the global sink is attached.
2. Manually clear global sinks (simulating mid-run teardown or missed setup).
3. Call the getter again with default arguments `{ purpose: undefined }`.
4. Assert that the returned instance has restored the global sink registration.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Nominal vs Provenance Trust Defect in Compute Pools (BUG-COMPUTE-TRUST-01)
- **Context**: `src/compute/awareness/backend.ts` and `src/compute/awareness/egress.ts`
- **What Was Expected**: The owner’s local GPU worker (assigned to pool `"private"`) should be marked with `"local"` trust, permitting local embedding calculation for all governance classes (`personal`, `confidential`, `normal`).
- **What Actually Happened**: The compute awareness engine checked for string identity (`poolId === "local"`). The local GPU operator default pool was named `"private"`. As a result, the owner's own hardware was marked `"untrusted"`, dropping personal and confidential embeddings and blocking local execution.
- **Evidence in Repo**: Commit `733b7419`, PR #308, `src/compute/awareness/backend.test.ts`.
- **Root Cause**: Trust levels were tightly coupled to pool naming strings instead of evaluating physical worker node containment against the host's actual worker IDs (`localWorkerIds`).
- **Remediation Code Diff**:
```typescript
// src/compute/awareness/backend.ts
-const LOCAL_POOL_IDS = new Set(["local"]);
-export function defaultPoolTrust(poolId: string): ComputePool["trust"] {
-  return LOCAL_POOL_IDS.has(poolId) ? "local" : "untrusted";
-}
+export function defaultPoolTrust(_poolId: string): ComputePool["trust"] {
+  return "untrusted";
+}
+export function poolServedLocally(
+  members: readonly Pick<ComputeWorker, "id">[],
+  localWorkerIds: ReadonlySet<string> | null,
+): boolean {
+  return (
+    localWorkerIds !== null && members.length > 0 && members.every((w) => localWorkerIds.has(w.id))
+  );
+}
```
- **Lesson**: Hardware trust must be derived from verified physical execution topology. Security boundaries must never rely on identifiers or configuration keys that can be renamed.

---

### Incident 2: SemVer Pre-Release Tag Stripping Update Lock (BUG-CLI-SEMVER-02)
- **Context**: `src/cli/update-cli/tarball.ts` and `src/cli/update-cli/tarball.test.ts`
- **What Was Expected**: When running `bitterbot update` on the stable release channel from a pre-release build (e.g., `1.10.1-beta.2`), the CLI updater should recognize stable `1.10.1` as newer and upgrade the binary.
- **What Actually Happened**: The update engine relied on `compareSemverStrings()`, which stripped pre-release labels before comparing. `1.10.1-beta.2` compared equal to `1.10.1`, causing the updater to skip the upgrade with `status: "skipped", reason: "up-to-date"`, leaving users stuck on pre-release builds.
- **Evidence in Repo**: Commit `733b7419`, lines 309–335 of `tarball.ts`.
- **Root Cause**: Semver comparison logic stripped suffixes instead of prioritizing release versions over pre-release versions with identical major/minor/patch triples.
- **Remediation Code Diff**:
```typescript
// src/cli/update-cli/tarball.ts
+const PRERELEASE_RE = /^v?\d+\.\d+\.\d+-/;
+
+export function releaseOrder(from: string, target: string): number | null {
+  const cmp = compareSemverStrings(from, target);
+  if (cmp !== 0) {
+    return cmp;
+  }
+  const fromPre = PRERELEASE_RE.test(from);
+  const targetPre = PRERELEASE_RE.test(target);
+  if (fromPre !== targetPre) {
+    return fromPre ? -1 : 1; // Pre-release is older than stable of the same triple
+  }
+  if (!fromPre) {
+    return 0;
+  }
+  const a = from.replace(/^v/, "");
+  const b = target.replace(/^v/, "");
+  return a === b ? 0 : a.localeCompare(b, "en", { numeric: true }) < 0 ? -1 : 1;
+}
...
-  const cmp = compareSemverStrings(ctx.fromVersion, target);
+  const cmp = releaseOrder(ctx.fromVersion, target);
```
- **Lesson**: Never strip pre-release metadata during upgrade evaluations. Explicitly define ordering rules: a stable version is strictly newer than any pre-release version of that same numeric version.

---

### Incident 3: Gateway Purpose-Gated Cache Miss on Compute Sinks (BUG-MEM-SINKS-03)
- **Context**: `src/memory/manager.ts` and `src/memory/manager.compute-episodes.test.ts`
- **What Was Expected**: Completed background compute jobs must be captured by memory episode sinks and recorded in SQLite as searchable memory chunks.
- **What Actually Happened**: Two jobs completed, but zero memory chunks were written. The memory manager was created early during daemon startup by a health-check/hormonal status probe (`purpose: "status"`). Sinks were only registered when `params.purpose === undefined`. The instance was cached in `INDEX_CACHE`, so all subsequent requests reused the cached manager, leaving sinks unregistered for the lifetime of the process.
- **Evidence in Repo**: Commit `3e824c99`, PR #292.
- **Root Cause**: Conditional initialization anti-pattern. Event registration was tied to caller parameters during initial instantiation instead of verifying registration invariants on every cache hit.
- **Remediation Code Diff**:
```typescript
// src/memory/manager.ts
     const existing = INDEX_CACHE.get(key);
     if (existing) {
+      existing.ensureComputeSinks(cfg);
       return existing;
     }
...
-      if (
-        params.purpose === undefined &&
-        cfg.compute?.enabled !== false &&
-        !getComputeEpisodeSink()
-      ) {
-        manager.episodeSink = (episode) => manager.writeComputeEpisodeChunk(episode);
-        registerComputeEpisodeSink(manager.episodeSink);
-      }
+      manager.ensureComputeSinks(cfg);
...
+  ensureComputeSinks(cfg: Pick<BitterbotConfig, "compute">): void {
+    if (this.closed || cfg.compute?.enabled === false) {
+      return;
+    }
+    if (!getComputeEpisodeSink()) {
+      this.episodeSink = (episode) => this.writeComputeEpisodeChunk(episode);
+      registerComputeEpisodeSink(this.episodeSink);
+    }
+    if (cfg.compute?.awareness?.nudges !== false && !getComputeNudgeSink()) {
+      this.nudgeSink = (nudge) =>
+        this.hormonalManager?.stimulate(
+          nudge.kind === "success" ? "compute_success" : "compute_setback",
+        );
+      registerComputeNudgeSink(this.nudgeSink);
+    }
+  }
```
- **Lesson**: Do not couple shared instance setup to the first caller's access parameters. Ensure shared cached instances re-check subscription wiring on every retrieval.

---

### Incident 4: Inbound vs Outbound Smart Wallet Network Disparity on Base (BUG-WALLET-X402-04)
- **Context**: Coinbase CDP Smart Wallet integration, Issue #54 (`pay_for_resource` & `send_usdc`).
- **What Was Expected**: An agent wallet configured on Base should parse HTTP 402 responses, sign EIP-712/USDC permit headers, and execute outbound transfers via `send_usdc`.
- **What Actually Happened**: The wallet received USDC transfers on Base successfully, but calling `send_usdc` failed immediately with: `Failed to send USDC: Unsupported network for smart wallets: base`. Furthermore, HTTP 402 flows returned raw response bodies without signing.
- **Evidence in Repo**: Issue #54, closed 2026-06-07.
- **Root Cause**: Asymmetry between account address compatibility and CDP SDK contract deployment bindings. The receiving address was standard EVM-compatible, but the smart wallet bundler/paymaster abstraction within the SDK lacked active address configurations for Base mainnet smart contracts.
- **Remediation Pattern**:
```typescript
// Enforce network-to-wallet validation before accepting funding or dispatching payments
export function validateSmartWalletNetworkSupport(network: string, isSmartWallet: boolean): void {
  const SMART_WALLET_SUPPORTED_NETWORKS = new Set(["base", "base-sepolia", "ethereum"]);
  if (isSmartWallet && !SMART_WALLET_SUPPORTED_NETWORKS.has(network.toLowerCase())) {
    throw new Error(`Unsupported network for smart wallets: ${network}. Switch to standard EOA or Base.`);
  }
}
```
- **Lesson**: Validate upstream SDK capabilities across all lifecycle operations (creation, deposit, payment signing, and outbound gas-sponsored dispatch). Never assume outbound support matches inbound address compatibility.

---

### Incident 5: Container Volume Shadowing of P2P Orchestrator Binary (BUG-DOCKER-ORCH-05)
- **Context**: `Dockerfile` lines 38–54 (`orchestrator/Cargo.toml` & `BITTERBOT_ORCHESTRATOR_INSTALL_DIR`).
- **What Was Expected**: Docker containers built and published to registries should run the Rust P2P orchestrator binary out of the box.
- **What Actually Happened**: Docker images v1.0.0 through v1.4.0 crashed on boot with: `could not read orchestrator version: ENOENT`.
- **Evidence in Repo**: `Dockerfile` comments and history: `"postinstall reads the orchestrator version from this manifest. Copying it only with COPY . . (after install) is why images v1.0.0-v1.4.0 shipped without the P2P binary"`.
- **Root Cause**: Two-phase failure: (1) `orchestrator/Cargo.toml` was excluded from early `COPY` layers, causing the post-install script to fail to detect the orchestrator version. (2) The binary was installed into `~/.bitterbot/bin`, but the runtime mounted a host volume over `/home/node/.bitterbot`, shadowing the installed binary.
- **Remediation Code Diff**:
```dockerfile
# Dockerfile
 COPY extensions/x/package.json ./extensions/x/
 COPY scripts ./scripts
+# postinstall reads the orchestrator version from this manifest. Copying it
+# only with `COPY . .` (after install) is why images v1.0.0-v1.4.0 shipped
+# without the P2P binary (`could not read orchestrator version: ENOENT`).
+COPY orchestrator/Cargo.toml ./orchestrator/
+
+# postinstall fetches the orchestrator binary. Point it INSIDE the image at the
+# repo-relative path the resolver probes, not the default ~/.bitterbot/bin:
+# HOME is /root during build but the runtime user is `node`, and compose mounts
+# the host config dir over /home/node/.bitterbot, which would shadow anything
+# placed there.
+ENV BITTERBOT_ORCHESTRATOR_INSTALL_DIR=/app/orchestrator/target/release
 RUN pnpm install --frozen-lockfile
```
- **Lesson**: Never place pre-compiled application binaries inside paths intended for host volume mounts. Explicitly isolate installation binaries into static container directories (`/app/...`).

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
* **Deterministic Locale-Insensitive SemVer Matching**: In `src/cli/update-cli/tarball.ts`, `a.localeCompare(b, "en", { numeric: true })` ensures string comparison operates identically regardless of host system locale settings (e.g., Turkish 'i' sorting issues).
* **Deterministic Seeded Pseudorandom Generation**: In `benchmarks/longmemeval-v2/worker.ts`, `Math.random` is overridden using 32-bit bitwise unsigned integer arithmetic:
  ```typescript
  let seed = (Number(config.seed) ^ Math.floor(now / 1000)) >>> 0;
  Math.random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  ```
  `>>> 0` forces evaluation to an unsigned 32-bit integer, and `Math.imul` prevents floating-point precision loss across different V8 versions.
* **Strict Temporal Virtualization**: Wall-clock evaluation leakages are blocked by wrapping native `Date` in an ES Proxy that virtualizes `construct`, `apply`, and property access (`Date.now()`), while leaving low-level timers (`performance.now()`) untouched to allow accurate profiler operation:
  ```typescript
  globalThis.Date = new Proxy(NativeDate, {
    construct(target, args) {
      return Reflect.construct(target, args.length ? args : [now]);
    },
    apply() {
      return new NativeDate(now).toString();
    },
    get(target, key) {
      return key === "now" ? () => now : Reflect.get(target, key);
    },
  });
  ```

### 2. Infinite Loop & Recursion Guards
* **Progress-Asserted Infinite Draining Loops**: In `worker.ts`, embedding backfill processing uses an infinite drain loop protected by an explicit progress assertion:
  ```typescript
  async function drainEmbeddings() {
    for (;;) {
      const result = await backfill.backfillPendingEmbeddings({ limit: 200 });
      if (result.remaining === 0) return;
      // TERMINATION INVARIANT: Zero progress with remaining work indicates a stuck embedding engine
      if (result.embedded === 0) throw new Error("Embedding backfill made no progress");
    }
  }
  ```
* **Non-Blocking Lock Acquisition with Exponential Sleep**: In `benchmarks/longmemeval-v2/diagnostics/score_pilot.py`, cross-process locking uses `fcntl.flock` with `LOCK_NB`. It catches `BlockingIOError` and yields via sleep rather than spinning synchronously and saturating the CPU:
  ```python
  with (ROOT/"budget.lock").open("a") as guard:
      while True:
          try:
              fcntl.flock(guard, fcntl.LOCK_EX | fcntl.LOCK_NB)
              break
          except BlockingIOError:
              time.sleep(30)
      fcntl.flock(guard, fcntl.LOCK_UN)
  ```

### 3. UI & UX Micro-Mechanics
* **Tri-State Booting Guards Against Flash-of-Unauthenticated-Content (FOUC)**: In `desktop/renderer/src/App.tsx`, authentication state uses `boolean | undefined`:
  ```typescript
  const [hasCredentials, setHasCredentials] = useState<boolean | undefined>(() =>
    readStoredGatewayToken() !== null ? true : undefined,
  );
  if (hasCredentials === undefined) return null; // Avoids rendering disconnected/login states prematurely
  ```
* **Immediate In-Memory Credential Scrubbing**: In `desktop/renderer/src/components/channels/ChannelSetupDrawer.tsx`, credentials and secrets are scrubbed from component memory the instant the modal closes:
  ```typescript
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setValues({}); // Drops plaintext tokens immediately
      setProbe(null);
      setValidating(false);
      setSaving(false);
    }
    onOpenChange(next);
  };
  ```

### 4. Backend Concurrency & Memory Safety
* **Atomic POSIX File Write-and-Rename Invariant**: In `benchmarks/longmemeval-v2/core.py`, file writes use a `.tmp` suffix followed by `f.flush()`, `os.fsync()`, and `tmp.replace(path)`:
  ```python
  def atomic(path, value):
      path = Path(path)
      path.parent.mkdir(parents=True, exist_ok=True)
      tmp = path.with_suffix(path.suffix + ".tmp")
      with tmp.open("w") as f:
          json.dump(value, f, indent=2)
          f.flush()
          os.fsync(f.fileno())
      tmp.replace(path)
  ```
  This prevents reader processes from observing half-written JSON data if a process crashes mid-write.
* **Process-Isolated Broker Accounting**: API balance management uses file locking (`fcntl.flock(..., LOCK_EX |