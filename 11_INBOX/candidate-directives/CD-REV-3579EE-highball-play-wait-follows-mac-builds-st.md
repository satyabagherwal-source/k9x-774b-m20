# Candidate Directive: highball play --wait follows Mac builds, Steam for Mac's included, and the libra

- **Directive ID**: `CD-REV-3579EE`
- **Status**: `STAGED_FOR_HUMAN_REVIEW`
- **Target Domain**: Domain G (Architecture Intelligence)
- **Source Repository**: `gauthierpiarrette-highball`
- **Source File**: `/home/runner/work/k9x-774b-m20/k9x-774b-m20/07_PROJECT_LEARNING/gauthierpiarrette-highball-learnings.md`
- **Observed At**: 2026-11-24T01:56:00.485Z

## Governance Notice
> ⚠️ **HIGH-IMPACT DOMAIN GATE**: This candidate belongs to Domain G, which governs fundamental architecture, human needs, or core invariants. In compliance with Rule 28 and Anti-Drift Invariants, an AI model cannot autonomously promote this record. Explicit human approval is required.

## Staged Rule Invariant
```
When implementing operations in `Sources/HighballApp/AppState.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in gauthierpiarrette/highball. All inputs crossing module boundaries must be explicitly verified before state persistence.
```

## Identified Root Cause / Problem
Prevents defects observed in production commit `7d471e91`: highball play --wait follows Mac builds, Steam for Mac's included, and the library JSON says installedOnWindows and hidden (highball#432). RunningGames, which --wait reads, held only the sessions in environments, so a wait on a game Steam for Mac started ran to --start-timeout and gave up while the game played (Terraforming Mars, udance4ever timed 49 s). It now also holds the Epic and GOG Mac builds Highball started and the Steam for Mac games Play opened, followed by their process under steamapps/common for up to ten minutes to appear and then until they quit. The JSON's installed is now installedOnWindows, beside installedOnMac, since the command hasn't shipped yet, and hidden says what the player hid from the library. play's id help names the form. New test in PlayFromCommandLineTests, 16 tests pass, and highball library --json lists the real library with both fields. The Steam for Mac wait is not tried live yet.. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

## Rejection / Staging Rationale
- ℹ️ HIGH_IMPACT_DOMAIN_STAGED: Domain G governs structural architecture or core invariants. Mandatory cryptographic human authorization required; AI self-approval blocked.

## Human Review Checklist
- [ ] Verify mathematical correctness and generalizability across all frameworks.
- [ ] Ensure no secret, proprietary token, or workstation path is embedded.
- [ ] Confirm non-contradiction with existing 01_CORE principles.
- [ ] Sign off with explicit `human_authorized: true` to execute promotion.
