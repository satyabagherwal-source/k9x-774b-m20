# Candidate Directive: Wine 11 engines r34 and r35 for Diablo II: Resurrected: r32 and r33 with one reb

- **Directive ID**: `CD-REV-DF1EE9`
- **Status**: `STAGED_FOR_HUMAN_REVIEW`
- **Target Domain**: Domain G (Architecture Intelligence)
- **Source Repository**: `gauthierpiarrette-highball`
- **Source File**: `/home/runner/work/k9x-774b-m20/k9x-774b-m20/07_PROJECT_LEARNING/gauthierpiarrette-highball-learnings.md`
- **Observed At**: 2026-11-21T03:28:40.600Z

## Governance Notice
> ⚠️ **HIGH-IMPACT DOMAIN GATE**: This candidate belongs to Domain G, which governs fundamental architecture, human needs, or core invariants. In compliance with Rule 28 and Anti-Drift Invariants, an AI model cannot autonomously promote this record. Explicit human approval is required.

## Staged Rule Invariant
```
When implementing operations in `Sources/HighballKit/Bottle.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in gauthierpiarrette/highball. All inputs crossing module boundaries must be explicitly verified before state persistence.
```

## Identified Root Cause / Problem
Prevents defects observed in production commit `39e06d01`: Wine 11 engines r34 and r35 for Diablo II: Resurrected: r32 and r33 with one rebuilt Wine, highball-engine release engine-wine-11.0-20261114T185735Z-fiber-mirror-switch (run 43624249972,, sha256 ee1609f0, public download checked). Its patch 0031 lets a game's recipe turn the fiber mirror off with HB_FIBER_MIRROR=0: D3DMetal calls macOS code straight from the game's fiber threads, and D2R exited with SIGILL before any window while the mirror put a fiber pointer in the QoS slot. Without the variable nothing changes, so Guardians of the Galaxy and Metaphor keep it. A recipe's variable can now name a file of the environment's engine with ${frameworks} and ${renderers}, as a manifest's baseEnv does, since D2R also needs CX_APPLEGPTK_LIBD3DSHARED_PATH set to its engine's libd3dshared.dylib (AlexPako played 35 minutes with both, sync off and MSync, M5 Pro, macOS 27.2.1). Every other archive is the base's, so only the Wine downloads. 875 tests pass.. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

## Rejection / Staging Rationale
- ℹ️ HIGH_IMPACT_DOMAIN_STAGED: Domain G governs structural architecture or core invariants. Mandatory cryptographic human authorization required; AI self-approval blocked.

## Human Review Checklist
- [ ] Verify mathematical correctness and generalizability across all frameworks.
- [ ] Ensure no secret, proprietary token, or workstation path is embedded.
- [ ] Confirm non-contradiction with existing 01_CORE principles.
- [ ] Sign off with explicit `human_authorized: true` to execute promotion.
