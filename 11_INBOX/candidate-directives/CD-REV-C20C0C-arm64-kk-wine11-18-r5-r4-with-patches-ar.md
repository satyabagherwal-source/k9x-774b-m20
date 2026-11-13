# Candidate Directive: arm64-kk-wine11.18-r5: r4 with patches-arm64 0056 and 0057, the spatial audio pa

- **Directive ID**: `CD-REV-C20C0C`
- **Status**: `STAGED_FOR_HUMAN_REVIEW`
- **Target Domain**: Domain G (Architecture Intelligence)
- **Source Repository**: `gauthierpiarrette-highball`
- **Source File**: `/home/runner/work/k9x-774b-m20/k9x-774b-m20/07_PROJECT_LEARNING/gauthierpiarrette-highball-learnings.md`
- **Observed At**: 2026-11-13T16:25:47.724Z

## Governance Notice
> ⚠️ **HIGH-IMPACT DOMAIN GATE**: This candidate belongs to Domain G, which governs fundamental architecture, human needs, or core invariants. In compliance with Rule 28 and Anti-Drift Invariants, an AI model cannot autonomously promote this record. Explicit human approval is required.

## Staged Rule Invariant
```
When implementing operations in `spike/engines/arm64-kk-wine11.18-r5.json`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in gauthierpiarrette/highball. All inputs crossing module boundaries must be explicitly verified before state persistence.
```

## Identified Root Cause / Problem
Prevents defects observed in production commit `0c3a6a16`: arm64-kk-wine11.18-r5: r4 with patches-arm64 0056 and 0057, the spatial audio pair Tx wrote for the Wine 11 line (highball#313), from the release engine-arm64-wine-11.18-20261108T132317Z-spatial-0056-0057 (build-arm64 run 42480524132, branch arm64-spatial-audio at 1dc6db7). A surround bed on a Mac's two-channel output lost everything but front left and right, so Forza Horizon 6 dropped the sounds behind the camera on headphones (highball#672); it now goes through AUSpatialMixer. Installed from that archive (sha256 6721b1f4, the same bytes as the public release) into a throwaway home on an M1 Pro with macOS 27.0: a test program's 7.1 and 7.1.4 float streams open, run their clock for 1.5 s and log 'rendered by AUSpatialMixer for built-in speakers on a 2-channel device', stereo keeps the old path. Every other file is r4's. Forza Horizon 6 was not run on r5, its route stays on r3. 93 manifest and engine tests pass.. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

## Rejection / Staging Rationale
- ℹ️ HIGH_IMPACT_DOMAIN_STAGED: Domain G governs structural architecture or core invariants. Mandatory cryptographic human authorization required; AI self-approval blocked.

## Human Review Checklist
- [ ] Verify mathematical correctness and generalizability across all frameworks.
- [ ] Ensure no secret, proprietary token, or workstation path is embedded.
- [ ] Confirm non-contradiction with existing 01_CORE principles.
- [ ] Sign off with explicit `human_authorized: true` to execute promotion.
