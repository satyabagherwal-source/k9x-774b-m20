# Candidate Directive: Worker Thread Rejection of Node.js Host Exec Arguments (BUG-AVA-01)

- **Directive ID**: `CD-REV-14689C`
- **Status**: `STAGED_FOR_HUMAN_REVIEW`
- **Target Domain**: Domain G (Architecture Intelligence)
- **Source Repository**: `avajs-ava`
- **Source File**: `/home/runner/work/k9x-774b-m20/k9x-774b-m20/07_PROJECT_LEARNING/avajs-ava-learnings.md`
- **Observed At**: 2026-11-17T08:19:33.855Z

## Governance Notice
> ⚠️ **HIGH-IMPACT DOMAIN GATE**: This candidate belongs to Domain G, which governs fundamental architecture, human needs, or core invariants. In compliance with Rule 28 and Anti-Drift Invariants, an AI model cannot autonomously promote this record. Explicit human approval is required.

## Staged Rule Invariant
```
Subprocesses and worker threads do not share the same capability profile for command-line arguments. Process-level flags must not be implicitly forwarded to worker threads without a configuration bypass, and initialization-level argument failures must trip an immediate scheduler circuit breaker.
```

## Identified Root Cause / Problem
Host-level arguments from `process.execArgv` were merged indiscriminately into thread-level `execArgv` in `normalizeNodeArguments()`. Furthermore, `pMap` lacked an error circuit breaker for worker initialization errors, causing the scheduler to attempt launching all files even after the argument payload was proven fatally invalid.

## Rejection / Staging Rationale
- ℹ️ HIGH_IMPACT_DOMAIN_STAGED: Domain G governs structural architecture or core invariants. Mandatory cryptographic human authorization required; AI self-approval blocked.

## Human Review Checklist
- [ ] Verify mathematical correctness and generalizability across all frameworks.
- [ ] Ensure no secret, proprietary token, or workstation path is embedded.
- [ ] Confirm non-contradiction with existing 01_CORE principles.
- [ ] Sign off with explicit `human_authorized: true` to execute promotion.
