# Candidate Directive: Wine 10 engines r30 (default) and r31 (D3DMetal 4 line): r28 and r29 with the au

- **Directive ID**: `CD-REV-1D7BB4`
- **Status**: `STAGED_FOR_HUMAN_REVIEW`
- **Target Domain**: Domain G (Architecture Intelligence)
- **Source Repository**: `gauthierpiarrette-highball`
- **Source File**: `/home/runner/work/k9x-774b-m20/k9x-774b-m20/07_PROJECT_LEARNING/gauthierpiarrette-highball-learnings.md`
- **Observed At**: 2026-11-17T05:37:12.551Z

## Governance Notice
> ⚠️ **HIGH-IMPACT DOMAIN GATE**: This candidate belongs to Domain G, which governs fundamental architecture, human needs, or core invariants. In compliance with Rule 28 and Anti-Drift Invariants, an AI model cannot autonomously promote this record. Explicit human approval is required.

## Staged Rule Invariant
```
When implementing operations in `Tests/HighballKitTests/BundledEngineTests.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in gauthierpiarrette/highball. All inputs crossing module boundaries must be explicitly verified before state persistence.
```

## Identified Root Cause / Problem
Prevents defects observed in production commit `ac350e46`: Wine 10 engines r30 (default) and r31 (D3DMetal 4 line): r28 and r29 with the audio library the Wine 11 engines carry since r30 (audiobuf-20261103, sha256 617b8feb, 8 KB, the same archive). The default engine still had the October library, so on it a microphone lost 32 frames nearly every 10 ms period (highball#350, #601), Wine's audio clock slept at normal priority on a busy Mac, and games kept the output they started with (#460, nikiomori's change). Every other archive is r28's or r29's, so environments move without the Windows setup and download 8 KB; r28 moves to spike/engines for rollback. Installed r30 from its manifest with the CLI in a throwaway home on an M1 Pro, macOS 27.0: every file is r28's except libhbaudiobuf.dylib, byte-identical to Wine 11 r31's. A WASAPI capture with hbtap's sample time ramp in place of the microphone's data, 6 s at 48 kHz: 520 and 501 breaks on r28, 0 on r30, under 10 busy loops 510 against 0; the library logs the capture buffer capped at 240 frames and audio_client_timer made real time (status 0). r31 was not installed on its own, BundledEngineTests checks it is r29 plus that archive. 872 tests pass.. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

## Rejection / Staging Rationale
- ℹ️ HIGH_IMPACT_DOMAIN_STAGED: Domain G governs structural architecture or core invariants. Mandatory cryptographic human authorization required; AI self-approval blocked.

## Human Review Checklist
- [ ] Verify mathematical correctness and generalizability across all frameworks.
- [ ] Ensure no secret, proprietary token, or workstation path is embedded.
- [ ] Confirm non-contradiction with existing 01_CORE principles.
- [ ] Sign off with explicit `human_authorized: true` to execute promotion.
