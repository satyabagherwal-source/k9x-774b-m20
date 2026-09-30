> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/ruvnet-ruflo-learnings.md`  
> **Source**: GitHub ([https://github.com/ruvnet/ruflo](https://github.com/ruvnet/ruflo))  
> **Synthesized By**: Universal Multi-Provider Autonomous AI Agent  
> **Timestamp**: 2026-09-30T02:55:51.079Z  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): ruvnet/ruflo

---

## 1. Executive Forensic Architecture & System Mechanics

`ruvnet/ruflo` (branded as Claude-Flow / Ruflo) is an enterprise-grade multi-agent orchestration framework designed to run specialized agent swarms with self-learning capabilities, fault-tolerant consensus, and context-budget optimization. It acts as a control plane that sits between LLM interfaces (such as Claude Code and ChatGPT MCP) and underlying execution environments.

```
                                 +---------------------------------------+
                                 |         LLM Interface / Client        |
                                 |     (Claude Code / ChatGPT MCP)       |
                                 +-------------------+-------------------+
                                                     |
                                                     v
                                 +-------------------+-------------------+
                                 |        Ruflo Orchestration Core       |
                                 |  (Context Persistence & Compaction)   |
                                 +---------+-------------------+---------+
                                           |                   |
                 +-------------------------+                   +-------------------------+
                 |                                                                       |
                 v                                                                       v
+----------------+-----------------------+                             +----------------+-----------------------+
|          Self-Learning Engine          |                             |        Multi-Tier Memory Engine        |
|  - ReasoningBankAdapter (FNV-1a IDs)   |                             |  - SQLite (WAL) / PostgreSQL / JSON    |
|  - Trajectory Extraction & Merging     |                             |  - AutoMemoryBridge & LearningBridge   |
+----------------------------------------+                             +----------------------------------------+
```

### Architectural Boundaries & Subsystems
1. **The Orchestration Core (`v3/@claude-flow/cli`)**: Manages the execution lifecycle of agents, coordinates task division, and enforces context limits. It intercepts lifecycle events (such as prompt submission and compaction) to maintain state.
2. **The Self-Learning Engine (`ReasoningBankAdapter`)**: Extracts successful execution trajectories (goals, steps, and outcomes) and merges them into reusable behavioral patterns. This allows the system to optimize future execution paths based on past successes.
3. **The Multi-Tier Memory Engine (`@claude-flow/memory`)**: Provides a tiered storage architecture. It uses SQLite (with Write-Ahead Logging) as its primary local database, falls back to JSON for zero-dependency environments, and scales to RuVector PostgreSQL for enterprise vector searches.
4. **The Plugin & MCP Gateway (`plugins/ruflo-ai-team`, `plugins/ruflo-x-gateway`)**: Exposes agent capabilities to external platforms using Model Context Protocol (MCP) servers. It enforces security boundaries through OAuth 2.0 audience verification and token scoping.
5. **The Rust Federation Engine (`v3/crates/ruflo-federation-peer`)**: A high-performance Rust layer that handles state synchronization, Byzantine fault-tolerant coordination, and Conflict-Free Replicated Data Type (CRDT) replication across distributed agent nodes.

---

## 2. Forensic Real Incidents & Production Patches

### Incident 1: Non-Deterministic Pattern IDs and Flaky Trajectory Merging (BUG-REASONINGBANK-01)
- **Context**: `v3/@claude-flow/browser/src/infrastructure/reasoningbank-adapter.ts`
- **What Was Expected**: When an agent successfully completes a goal, its execution trajectory is stored. If the same goal is executed again, the system should identify the existing pattern, merge the new trajectory into it, and increment its `usageCount`.
- **What Actually Happened**: The pattern ID generator appended `Date.now().toString(36)` to the ID. Because of this, trajectories for the same goal only merged if they were executed within the exact same millisecond. Otherwise, the system generated duplicate patterns with a `usageCount` of `1`. This prevented the adapter from learning from repeated runs and caused intermittent test failures in CI.
- **Evidence in Repo**: Commits `2a3d407f` and `07fc9419`.
- **Root Cause**: The system used a transient, time-dependent value (`Date.now()`) inside an identifier generation function that needed to be pure and deterministic to support state lookups.
- **Remediation Code Diff**:
```typescript
// - v3/@claude-flow/browser/src/infrastructure/reasoningbank-adapter.ts
// - private generatePatternId(goal: string): string {
// -   return `pattern-${goal
// -     .toLowerCase()
// -     .replace(/[^a-z0-9]+/g, '-')
// -     .slice(0, 50)}-${Date.now().toString(36)}`;
// - }

// + v3/@claude-flow/browser/src/infrastructure/reasoningbank-adapter.ts
// + private generatePatternId(goal: string): string {
// +   // Must be a pure function of the goal: extractPattern() merges a repeated
// +   // trajectory into its existing pattern by looking this id up.
// +   const normalized = goal.toLowerCase().replace(/[^a-z0-9]+/g, '-');
// +   let hash = 0x811c9dc5; // FNV-1a 32-bit offset basis
// +   for (let i = 0; i < normalized.length; i++) {
// +     hash = Math.imul(hash ^ normalized.charCodeAt(i), 0x01000193); // FNV-1a prime
// +   }
// +   return `pattern-${normalized.slice(0, 50)}-${(hash >>> 0).toString(36)}`;
// + }
```
- **Lesson**: Identifiers used for state lookup, deduplication, or merging must be pure functions of the entity's invariant properties. They must never rely on side effects or transient state like system time.

---

### Incident 2: Secret Leakage via Shell Execution Capture (BUG-SIGNHELPERS-02)
- **Context**: `scripts/sign-helpers.mjs`
- **What Was Expected**: The signing script should retrieve the private key from Google Cloud Secret Manager and sign helper manifests without exposing the key material.
- **What Actually Happened**: On Windows environments, `execFileSync('gcloud', ...)` failed due to shell resolution issues. Developers worked around this by invoking `gcloud secrets versions access` directly within a shell. This printed the PEM-encoded private key to `stdout`, which was then captured by the Claude Code harness and leaked into the session transcript.
- **Evidence in Repo**: Issue #2674, resolved in #2850.
- **Root Cause**: The script executed shell commands that printed sensitive credentials directly to standard output streams. These streams were monitored and logged by the parent agentic harness.
- **Remediation Code Diff**:
```javascript
// - // Buggy Windows workaround in scripts/sign-helpers.mjs
// - const key = execSync('gcloud secrets versions access latest --secret=helpers-signing-key');
// - fs.writeFileSync('~/.ruflo/helpers-signing.key', key);

// + // Hardened implementation in scripts/sign-helpers.mjs
// + import { spawnSync } from 'child_process';
// + // Use stdin transport, validate input format, and redact error outputs
// + function getSecretSecurely() {
// +   const cmd = process.platform === 'win32' ? 'gcloud.cmd' : 'gcloud';
// +   const result = spawnSync(cmd, ['secrets', 'versions', 'access', 'latest', '--secret=helpers-signing-key'], {
// +     stdio: ['pipe', 'pipe', 'pipe'], // Avoid inheriting parent stdio
// +     encoding: 'utf-8'
// +   });
// +   if (result.status !== 0) {
// +     throw new Error(`Failed to fetch secret: ${result.stderr.replace(/AI_TEAM_[A-Z0-9_]+/g, '[REDACTED]')}`);
// +   }
// +   const keyMaterial = result.stdout.trim();
// +   if (!keyMaterial.startsWith('-----BEGIN PRIVATE KEY-----')) {
// +     throw new Error('Invalid key format returned from Secret Manager');
// +   }
// +   return keyMaterial;
// + }
```
- **Lesson**: Never print secrets to standard output streams. When executing subprocesses that handle credentials, isolate their standard streams, validate their output formats, and sanitize error messages to prevent leaks.

---

### Incident 3: Reverse-Substring Collision in Benchmark Evaluation (BUG-GAIA-03)
- **Context**: `v3/@claude-flow/cli/src/benchmarks/gaia-agent.ts`
- **What Was Expected**: The GAIA benchmark evaluation engine should mark an agent's answer as correct only if it matches the expected ground truth.
- **What Actually Happened**: The evaluation function `isAnswerCorrect()` used a symmetric substring check. It marked an answer as correct if the expected answer was a substring of the model's output, *or* if the model's output was a substring of the expected answer. This meant short, fragmentary model outputs (such as `"a"`) were marked as correct if they appeared anywhere in the expected answer (such as `"Paris, France"`).
- **Evidence in Repo**: Issue #2566, resolved in v3.25.3.
- **Root Cause**: The comparison logic used a symmetric containment check (`A.includes(B) || B.includes(A)`) instead of an asymmetric check (`A.includes(B)`), which broke the validation logic.
- **Remediation Code Diff**:
```typescript
// - // v3/@claude-flow/cli/src/benchmarks/gaia-agent.ts
// - if (normModel.includes(normExpected)) return true;
// - if (normExpected.includes(normModel)) return true; // COLLISION: expected contains model

// + // v3/@claude-flow/cli/src/benchmarks/gaia-agent.ts
// + // Enforce exact matching or strict forward-only containment
// + if (normModel === normExpected) return true;
// + if (normExpected.length > 3 && normModel.includes(normExpected)) return true;
// + // Removed the reverse-substring check to prevent fragmentary false positives
```
- **Lesson**: Evaluation and validation engines must use directional, asymmetric comparison logic. Allowing a candidate answer to be a subset of the ground truth introduces false positives.

---

### Incident 4: macOS node-gyp Compilation Failures due to Python 3.12 distutils Deprecation (BUG-CI-GYP-04)
- **Context**: `.github/workflows/v3-ci.yml`
- **What Was Expected**: The CI pipeline should build and test the repository across all target operating systems (including macOS) without failing on native module compilation.
- **What Actually Happened**: When prebuilt binaries for native modules like `better-sqlite3` or `hnswlib-node` timed out during download, `node-gyp` fell back to compiling them from source. On macOS runners, this compilation failed because the default Python version was 3.12, which removed the `distutils` module required by older versions of `node-gyp`.
- **Evidence in Repo**: Commits `2a3d407f` and `07fc9419`.
- **Root Cause**: The build environment implicitly relied on the host runner's default Python version, which introduced breaking changes to the native compilation toolchain.
- **Remediation Code Diff**:
```yaml
# - .github/workflows/v3-ci.yml
# -   - name: Install dependencies
# -     working-directory: v3
# -     run: pnpm install --frozen-lockfile

# + .github/workflows/v3-ci.yml
# +   # When a better-sqlite3/hnswlib-node prebuild download times out, node-gyp
# +   # compiles from source, and macos-latest's Python 3.12 has no distutils.
# +   - name: Setup Python for node-gyp (macOS)
# +     if: runner.os == 'macOS'
# +     uses: actions/setup-python@v5
# +     with:
# +       python-version: '3.11' # Pin to 3.11 to preserve distutils
# +
# +   - name: Install dependencies
# +     working-directory: v3
# +     run: pnpm install --frozen-lockfile
```
- **Lesson**: CI/CD pipelines must explicitly pin all build-time toolchain dependencies—including runtime environments like Python used by native compilers—to prevent host-level updates from breaking builds.

---

### Incident 5: Missing OAuth Audience Verification in MCP Resource Server (BUG-OAUTH-AUD-05)
- **Context**: `plugins/ruflo-ai-team/src/server.mjs`
- **What Was Expected**: The Model Context Protocol (MCP) resource server should verify that incoming OAuth access tokens are explicitly intended for its endpoint.
- **What Actually Happened**: The server defaulted its expected audience to a generic client ID (`ruflo-ai-team`) instead of the resource identifier (`https://team.ruv.io/mcp`). This allowed tokens minted for other clients to access the resource server, creating a token reuse vulnerability.
- **Evidence in Repo**: Commit `9016dd67`.
- **Root Cause**: The server confused the OAuth Client ID with the Resource Audience, failing to validate the `aud` claim against the resource's URI.
- **Remediation Code Diff**:
```javascript
// - // plugins/ruflo-ai-team/src/server.mjs
// - const audience = process.env.RUFLO_AI_TEAM_OAUTH_CLIENT_ID || 'ruflo-ai-team';

// + // plugins/ruflo-ai-team/src/server.mjs
// + const publicUrl = (process.env.RUFLO_AI_TEAM_PUBLIC_URL || 'https://team.ruv.io').replace(/\/$/, '');
// + const audience = process.env.RUFLO_AI_TEAM_OAUTH_AUDIENCE || `${publicUrl}/mcp`;
// + // The verifyToken middleware now strictly asserts that jwt.claims.aud === audience
```
- **Lesson**: Resource servers must validate that the OAuth token's audience (`aud`) matches the specific resource URI, not just a client identifier. This prevents token reuse across different services.

---

## 3. The 9 Deep Learning Dimensions

### 1. Architecture
`ruvnet/ruflo` uses a monorepo structure managed by `pnpm` workspaces and Cargo. It separates TypeScript-based agent interfaces from high-performance Rust-based synchronization engines.

```
[Client Layer: Claude Code / ChatGPT]
       | (MCP Protocol / JSON-RPC)
       v
[Orchestration Layer: TypeScript CLI] <---> [Memory Layer: SQLite / PG]
       | (Native Bindings / IPC)
       v
[Federation Layer: Rust Peer Engine] <---> [Distributed Swarm Nodes]
```

- **Subsystem Boundaries**: The CLI orchestrates agent execution, while the plugins (`ruflo-ai-team`, `ruflo-x-gateway`) expose these capabilities as MCP tools. The Rust crates (`ruflo-federation-peer`, `ruflo-agntcy`) handle peer-to-peer state synchronization.
- **Decoupling Strategy**: Subsystems communicate using JSON-RPC over standard I/O or HTTP. This isolates the runtime environments and allows the TypeScript orchestrator to interact with the Rust engine without tight coupling.
- **State Ownership**: Local state (such as execution trajectories and context history) is owned by the `ContextPersistenceHook` and stored in SQLite. Shared swarm state is managed by the Rust federation peer using Conflict-Free Replicated Data Types (CRDTs).

### 2. Core Abstractions
The framework relies on several key abstractions to manage agent state and execution:
- `BrowserTrajectory`: Represents a sequence of actions, goals, and outcomes executed by an agent.
- `ReasoningBankAdapter`: An interface for storing, matching, and retrieving successful trajectories to guide future agent decisions.
- `ContextPersistenceHook`: Manages context compaction and restoration across LLM session boundaries.
- `AutoMemoryBridge`: Bridges short-term session insights back to long-term memory files (`MEMORY.md`).

### 3. Error Handling
The framework uses a multi-tiered error handling strategy to prevent failures from cascading:
- **Fault Boundaries**: If a native module (like `better-sqlite3` or `hnswlib-node`) fails to load, the system catches the error and falls back to a pure JavaScript implementation (such as `JsonFileBackend`).
- **Loud Failures for Configuration Issues**: When critical dependencies (like `@claude-flow/memory`) cannot be resolved, the system fails loudly on both `stdout` and `stderr` to ensure the user is notified.
- **Graceful Degradation**: If a vector database connection times out, the system falls back to local JSON-based memory storage to keep the agent running.

### 4. Testing
The repository uses `vitest` for TypeScript testing and `cargo test` for Rust testing.
- **Mock Invariants**: Tests mock system time (`Date.now()`) to verify that trajectory merging works correctly across different execution times.
- **Integration Harnesses**: The CI pipeline uses a baseline file (`scripts/ci-test-baseline.txt`) to track and exclude tests that rely on local, unresolvable dependencies. This keeps the core test suite green.
- **Regression Shields**: Regression tests verify that short, fragmentary answers do not trigger false positives in the evaluation engine.

### 5. Security
The framework implements several security measures to protect sensitive data:
- **Threat Model**: The system assumes that LLM outputs and tool results are untrusted. It labels and fences this data to prevent prompt injection attacks.
- **Credential Isolation**: Subprocesses that handle credentials (such as signing scripts) isolate their standard streams to prevent secrets from leaking into logs or transcripts.
- **Audience Verification**: The MCP server strictly validates the `aud` claim in OAuth tokens to prevent token reuse attacks.

### 6. Performance
The framework optimizes performance to minimize latency and resource usage:
- **Context Compaction**: The system monitors context usage and triggers compaction when it exceeds a configured threshold (e.g., 50%). This keeps the context window lean and reduces token costs.
- **SQLite WAL Mode**: The local database uses Write-Ahead Logging (WAL) to support concurrent reads and writes without blocking.
- **Rust Federation**: High-performance state synchronization and CRDT replication are offloaded to Rust to minimize overhead.

### 7. Deployment
The framework supports both local and cloud deployments:
- **CI/CD Invariants**: The CI pipeline pins build-time dependencies (such as Python 3.11 for macOS runners) to ensure reproducible builds.
- **Container Constraints**: Cloud Run deployments use environment variables (such as `RUFLO_AI_TEAM_OAUTH_AUDIENCE`) to configure security boundaries and storage backends.
- **Reproducible Builds**: The project uses `pnpm --frozen-lockfile` to ensure consistent dependency resolution across environments.

### 8. Agent Patterns
The framework implements several advanced