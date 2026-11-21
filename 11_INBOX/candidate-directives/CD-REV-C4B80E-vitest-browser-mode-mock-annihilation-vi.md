# Candidate Directive: Vitest Browser Mode Mock Annihilation via Service Worker Caching (BUG-BROWSER-02)

- **Directive ID**: `CD-REV-C4B80E`
- **Status**: `STAGED_FOR_HUMAN_REVIEW`
- **Target Domain**: Domain G (Architecture Intelligence)
- **Source Repository**: `mswjs-msw`
- **Source File**: `/home/runner/work/k9x-774b-m20/k9x-774b-m20/07_PROJECT_LEARNING/mswjs-msw-learnings.md`
- **Observed At**: 2026-11-21T01:34:58.961Z

## Governance Notice
> ⚠️ **HIGH-IMPACT DOMAIN GATE**: This candidate belongs to Domain G, which governs fundamental architecture, human needs, or core invariants. In compliance with Rule 28 and Anti-Drift Invariants, an AI model cannot autonomously promote this record. Explicit human approval is required.

## Staged Rule Invariant
```
Service Workers acting as mocking proxies must maintain explicit bypass boundaries for the dev environment’s HMR and test runner orchestration channels.
```

## Identified Root Cause / Problem
The worker script's `fetch` event listener intercepted requests indiscriminately, including module requests originating from the Vitest browser test runner. Because Firefox and WebKit enforce stricter Service Worker scope boundary caching than Chromium, module chunks were captured by the Service Worker lifecycle.

## Rejection / Staging Rationale
- ℹ️ HIGH_IMPACT_DOMAIN_STAGED: Domain G governs structural architecture or core invariants. Mandatory cryptographic human authorization required; AI self-approval blocked.

## Human Review Checklist
- [ ] Verify mathematical correctness and generalizability across all frameworks.
- [ ] Ensure no secret, proprietary token, or workstation path is embedded.
- [ ] Confirm non-contradiction with existing 01_CORE principles.
- [ ] Sign off with explicit `human_authorized: true` to execute promotion.
