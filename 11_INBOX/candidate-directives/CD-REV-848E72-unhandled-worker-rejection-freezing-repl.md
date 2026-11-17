# Candidate Directive: Unhandled Worker Rejection Freezing REPL Bundling (BUG-REPL-02)

- **Directive ID**: `CD-REV-848E72`
- **Status**: `STAGED_FOR_HUMAN_REVIEW`
- **Target Domain**: Domain G (Architecture Intelligence)
- **Source Repository**: `qwikdev-qwik`
- **Source File**: `/home/runner/work/k9x-774b-m20/k9x-774b-m20/07_PROJECT_LEARNING/qwikdev-qwik-learnings.md`
- **Observed At**: 2026-11-17T06:11:02.061Z

## Governance Notice
> ⚠️ **HIGH-IMPACT DOMAIN GATE**: This candidate belongs to Domain G, which governs fundamental architecture, human needs, or core invariants. In compliance with Rule 28 and Anti-Drift Invariants, an AI model cannot autonomously promote this record. Explicit human approval is required.

## Staged Rule Invariant
```
Lazy initialization hooks must handle errors by clearing the cached promise in a rejection handler. Swallowing errors during eager initialization must be paired with deferred, recoverable error reporting during consumption.
```

## Identified Root Cause / Problem
`loaded = loadOptimizer(e.data.rustOptimizer)` was assigned eagerly on `init`. If `loadOptimizer` threw (e.g., failed to fetch the `.wasm` file or remote CDN deps), `loaded` remained a rejected promise. When the user triggered a `bundle` action, `await loaded;` failed repeatedly.

## Rejection / Staging Rationale
- ℹ️ HIGH_IMPACT_DOMAIN_STAGED: Domain G governs structural architecture or core invariants. Mandatory cryptographic human authorization required; AI self-approval blocked.

## Human Review Checklist
- [ ] Verify mathematical correctness and generalizability across all frameworks.
- [ ] Ensure no secret, proprietary token, or workstation path is embedded.
- [ ] Confirm non-contradiction with existing 01_CORE principles.
- [ ] Sign off with explicit `human_authorized: true` to execute promotion.
