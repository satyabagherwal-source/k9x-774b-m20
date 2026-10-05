> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/morluto-rea-learnings.md`  
> **Source**: GitHub ([https://github.com/morluto/rea](https://github.com/morluto/rea))  
> **License**: MIT  
> **Synthesized By**: Universal Multi-Provider Autonomous AI Agent  
> **Timestamp**: 2026-10-05T04:10:08.234Z  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Personal emails/PII sanitized at ingestion.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation or use as an AI/ML training dataset is prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): morluto/rea

## 1. Executive Forensic Architecture & System Mechanics
REA (Reverse Engineer Anything) is a specialized, layered ESM TypeScript framework designed to bridge the gap between high-level AI agent reasoning and low-level binary/runtime analysis. It acts as an **orchestration layer** that abstracts heterogeneous analysis providers (Hopper, Ghidra, CDP/V8 Inspector, Managed PE/CLI) into a unified, provider-neutral MCP (Model Context Protocol) server.

**Architectural Boundaries:**
- **Domain Layer**: Pure, side-effect-free logic (e.g., `javascriptApplicationGraph.ts`).
- **Provider Layer**: Engine-specific adapters (e.g., `ReaGhidraBridge.java`, `hopper_bridge.py`) that enforce read-only constraints and digest-based verification.
- **Process Layer**: A robust, provider-neutral process ownership model that manages ephemeral runtime roots, absolute startup deadlines, and cleanup (TERM-to-KILL).
- **Contract Layer**: Zod-validated schemas that define the "shape" of analysis results, ensuring that agents receive consistent data regardless of the underlying engine.

## 2. Forensic Real Incidents & Production Patches
### Incident 1: MCP Startup Timeout (BUG-MCP-441)
- **Context**: `scripts/rea.mjs` (MCP entrypoint)
- **What Was Expected**: MCP server initialization within 30 seconds.
- **What Actually Happened**: Cold-start module resolution and dependency loading exceeded 30s, causing Codex to kill the process.
- **Evidence**: Issue #441, `scripts/rea.mjs` startup diagnostics.
- **Root Cause**: Excessive synchronous module graph resolution on cold start.
- **Remediation**:
```typescript
// - Implicit dependency loading during initialization
// + Deferred loading and explicit startup deadline management in the MCP adapter
```
- **Lesson**: Always measure cold-start latency in the CI pipeline; avoid heavy synchronous imports in the entrypoint.

### Incident 2: Stale Local Dependency Selection (BUG-NPM-439)
- **Context**: `npx` bootstrap logic
- **What Was Expected**: `npx rea-agents` should always pull the latest version.
- **What Actually Happened**: `npx` resolved to a project-local `node_modules` version, bypassing the intended latest release.
- **Evidence**: Issue #439, PR #307.
- **Root Cause**: `npx` behavior prioritizes local `node_modules` over remote registry when a package is present.
- **Remediation**:
```bash
# - npx rea-agents setup
# + npx rea-agents@latest setup
```
- **Lesson**: Never rely on unversioned `npx` for critical infrastructure; always pin to `@latest` or specific versions.

## 3. Microscopic Code-Level Invariants
1. **Micro-Syntax**: Use `BigInt` for all address arithmetic to prevent precision loss in 64-bit address spaces (e.g., `BigInt(address).toString(16)`).
2. **Infinite Loop Guards**: Use `scheduleProcessInterval` with a `maximumTimerDelay` (2,147,483,647ms) to avoid `setTimeout` overflow/immediate execution bugs.
3. **UI/UX**: `TerminalRenderer` uses `Buffer.byteLength` to enforce hard byte-limits on serialized terminal frames, preventing memory exhaustion during high-frequency output.
4. **Concurrency**: Use `AbortSignal` in all `execFile` wrappers to ensure child processes are terminated immediately upon caller cancellation.
5. **Defect Traps**: All external input must be validated via `z.strictObject()` to reject unknown/malicious fields, preventing prototype pollution or configuration injection.

## 4. The 9 Deep Learning Dimensions
- **Architecture**: Strict inward dependency flow (Domain -> Contracts -> Process -> Providers -> Application).
- **Core Abstractions**: `Result<T, E>` pattern for all fallible operations.
- **Error Handling**: Tagged error algebra (e.g., `CapabilityUnavailableError`, `InvalidRequestError`).
- **Testing**: Property-based testing for JSON serialization and boundary conditions.
- **Security**: `PermissionAuthority` enforces path-based access control for all filesystem/process operations.
- **Performance**: Zero-copy where possible; streaming output capture for large binary analysis.
- **Deployment**: `prepare` lifecycle script ensures `dist/` is built before any execution.
- **Agent Patterns**: Tooling interfaces are task-oriented (inspect, search, trace, compare).
- **Data Flow**: Immutable Evidence records with SHA-256 content-addressing.

## 5. The 8 Learning Extraction Artifacts
1. **Pattern**: `DirectAnalysis` pattern (Request -> Authority Check -> Provider Execution -> Result Normalization).
2. **Rule**: All provider-specific logic must be encapsulated in adapters; domain layers must remain engine-agnostic.
3. **Architecture Principle**: "Evidence-First" design—every tool result must return a verifiable Evidence ID.
4. **Failure Mode**: TOCTOU (Time-of-check to time-of-use) in process lifecycle management.
5. **Reusable Skill**: `execFileOutput` wrapper for capturing large process outputs without `maxBuffer` limits.
6. **Decision**: Use `zod` for runtime schema validation to bridge the gap between untyped JSON and domain models.
7. **Anti-pattern**: "Mega-tools" that combine discovery, execution, and mutation.
8. **Verification Method**: `managed-conformance-manifest.json` for verifying provider output consistency.

## 6. Net-New Universal Engineering Rules
## 1. The "Cold-Start Budget" Rule
**RULE**: Every CLI/MCP entrypoint must initialize its dependency graph within 50% of the host's maximum allowed startup timeout.
**WHY**: Prevents "flaky" infrastructure failures caused by cold-start latency.
**WHEN TO APPLY**: Any CLI tool or MCP server intended for production use.
**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Measure startup in CI
const start = performance.now();
await initialize();
if (performance.now() - start > BUDGET) throw new Error("Startup too slow");
```
**NEGATIVE CONSTRAINT**: Do not perform heavy I/O or deep module resolution in the global scope of the entrypoint.

## 7. Actionable Agent Skill & Implementation Checklist
- [ ] **Authority Check**: Does the tool request require filesystem/process access? If so, is it authorized via `PermissionAuthority`?
- [ ] **Boundary Check**: Are input arguments validated with `z.strictObject()`?
- [ ] **Evidence Linkage**: Does the result include a unique Evidence ID?
- [ ] **Timeout Guard**: Is the operation wrapped in a `timeout` or `AbortSignal`?
- [ ] **Normalization**: Is the output normalized to the domain-neutral schema?
- [ ] **Error Handling**: Are provider-specific errors mapped to domain-specific tagged errors?