# Candidate Directive: Forensic Learning Record (Deep Inspection): zulip/zulip

- **Directive ID**: `CD-REV-1B0996`
- **Status**: `STAGED_FOR_HUMAN_REVIEW`
- **Target Domain**: Domain A (Human & Need Intelligence)
- **Source Repository**: `zulip-zulip`
- **Source File**: `/home/runner/work/k9x-774b-m20/k9x-774b-m20/07_PROJECT_LEARNING/zulip-zulip-learnings.md`
- **Observed At**: 2026-11-21T15:59:55.380Z

## Governance Notice
> ⚠️ **HIGH-IMPACT DOMAIN GATE**: This candidate belongs to Domain A, which governs fundamental architecture, human needs, or core invariants. In compliance with Rule 28 and Anti-Drift Invariants, an AI model cannot autonomously promote this record. Explicit human approval is required.

## Staged Rule Invariant
```
- **Issue #40704** (2026-11-17): **Update 12.4 to 13.2**
  *Symptoms*: Following an update from 12.4 to 13.2, the following issues have appeared on Windows 7 clients using Firefox 115.26: 1. Status indicators have turned white. 2. The `message_feed_container` header overlaps with the main window.  <img width="1366" height="452" alt="zulip" src="https://github.com/user-attachments/assets/92a03a3e-31aa-4ca9-b3d4-937ff6b6c628" />  I also noticed that there are long-running requests leading up to these events:  <img width="1262" height="335" alt="events_1" src="https://github.com/user-attachments/assets/997b752a-28df-4ba3-a42b-3705af83a81d" /> 
  **Post-Mortem & Fix Analysis**:
  > A couple preliminary things to try on your end while I chat with folks here: - Are your users able to update to a more recent version of Firefox ESR 115? It looks like 115.45 was just released. - Can they try Zulip Desktop https://zulip.com/apps/?
  > Update: the oldest Firefox that we support in Zulip 13 is ESR 126. However, our team is not able to think of any changes between 12 and 13 that would cause the display issues you're seeing. Wondering if there could be something cached on the user's system that’s causing this?  Please feel welcome to come chat about it in the [production help](https://chat.zulip.org/#narrow/channel/31-production-help) channel of the [Zulip Development Community](https://zulip.com/development-community/)! Folks with more helpful context are active there.
```

## Identified Root Cause / Problem
- **Issue #40704** (2026-11-17): **Update 12.4 to 13.2**
  *Symptoms*: Following an update from 12.4 to 13.2, the following issues have appeared on Windows 7 clients using Firefox 115.26: 1. Status indicators have turned white. 2. The `message_feed_container` header overlaps with the main window.  <img width="1366" height="452" alt="zulip" src="https://github.com/user-attachments/assets/92a03a3e-31aa-4ca9-b3d4-937ff6b6c628" />  I also noticed that there are long-running requests leading up to these events:  <img width="1262" height="335" alt="events_1" src="https://github.com/user-attachments/assets/997b752a-28df-4ba3-a42b-3705af83a81d" /> 
  **Post-Mortem & Fix Analysis**:
  > A couple preliminary things to try on your end while I chat with folks here: - Are your users able to update to a more recent version of Firefox ESR 115? It looks like 115.45 was just released. - Can they try Zulip Desktop https://zulip.com/apps/?
  > Update: the oldest Firefox that we support in Zulip 13 is ESR 126. However, our team is not able to think of any changes between 12 and 13 that would cause the display issues you're seeing. Wondering if there could be something cached on the user's system that’s causing this?  Please feel welcome to come chat about it in the [production help](https://chat.zulip.org/#narrow/channel/31-production-help) channel of the [Zulip Development Community](https://zulip.com/development-community/)! Folks with more helpful context are active there.

## Rejection / Staging Rationale
- ℹ️ HIGH_IMPACT_DOMAIN_STAGED: Domain A governs structural architecture or core invariants. Mandatory cryptographic human authorization required; AI self-approval blocked.

## Human Review Checklist
- [ ] Verify mathematical correctness and generalizability across all frameworks.
- [ ] Ensure no secret, proprietary token, or workstation path is embedded.
- [ ] Confirm non-contradiction with existing 01_CORE principles.
- [ ] Sign off with explicit `human_authorized: true` to execute promotion.
