# Project Learning Record — Website Change Monitor

This document records the empirical project learnings, audit provenance, and pattern extraction evidence derived from the Website Change Monitor project.

---

## 1. Executive Summary & Final Coverage

* **Project**: Website Change Monitor
* **Total Confirmed REAL INCIDENTS Analyzed**: 18
* **Promoted Reusable Engineering Patterns**: 8 Rules
* **Total Real Incidents Covered**: 18 / 18 (100%)
* **Excluded Project-Specific Incidents**: 1 (`BUG-P10.1-03` — simple UI filter predicate)
* **DEFF Catalog Audit**: 14 items (`DEFF-001` through `DEFF-014`) evaluated and classified as `ARCHITECTURAL LIMITATION / DEFERRED FEATURE — NOT A REAL INCIDENT`.

---

## 2. Promoted Learning Set Mapping

### Pattern 1: Async In-Flight Fresh-State + Targeted Field Scoping
* **Source Incident**: `BUG-QA3-02` (In-Flight Concurrency Edit Overwrite)
* **Source Location**: `frontend/src/services/backgroundMonitoringPipeline.js`
* **Evidence**: QA Sprint 3 Audit Report (`QA_SPRINT3_REPORT.md#L48-L65`) & Remediation Log (`QA_SPRINT3_REMEDIATION_REPORT.md#L19-L41`).
* **Promotion Decision**: Promoted as **Rule 1** in `05_KNOWLEDGE/engineering-patterns.md`.
* **Confidence**: 100% (High Confidence).

### Pattern 2: Event-Driven Cascade Resource Cleanup
* **Source Incidents**:
  * `BUG-QA2-02` (Orphan Scheduler Tasks & Timers on Delete)
  * `BUG-QA2-03` (Orphan Notification Records on Delete)
  * `BUG-P10.1-05` (Workspace Deletion Leaves Orphaned Child Entities)
* **Source Location**: `schedulerEngine.js`, `notificationService.ts`, `workspaceService.js`.
* **Evidence**: QA Sprint 2 Audit Report (`QA_SPRINT2_REPORT.md#L44-L72`) & Remediation Log (`QA_SPRINT2_REMEDIATION_REPORT.md#L17-L38`).
* **Promotion Decision**: Promoted as **Rule 2** in `05_KNOWLEDGE/engineering-patterns.md`.
* **Confidence**: 100% (High Confidence).

### Pattern 3: Idempotent Schedule Registration + Active Countdown Preservation
* **Source Incident**: `BUG-QA3-03` (Countdown Reset on Re-Registration)
* **Source Location**: `frontend/src/services/scheduler/schedulerEngine.js`
* **Evidence**: QA Sprint 3 Audit Report (`QA_SPRINT3_REPORT.md#L68-L81`) & Remediation Log (`QA_SPRINT3_REMEDIATION_REPORT.md#L42-L47`).
* **Promotion Decision**: Promoted as **Rule 3** in `05_KNOWLEDGE/engineering-patterns.md`.
* **Confidence**: 100% (High Confidence).

### Pattern 4: Reactive Mutation Subscriptions for Derived View State
* **Source Incidents**:
  * `BUG-P10.1-01` (Competitors Page UI Stale State on CRUD)
  * `BUG-P10.1-02` (Websites Page UI Stale State on CRUD)
  * `BUG-P10.1-04` (Active Workspace Context Stuck on Archived Workspace)
* **Source Location**: `Competitors.jsx`, `Websites.jsx`, `WorkspaceContext.jsx`.
* **Evidence**: P10.1 Investigation Report (`P10_1_BUG_INVESTIGATION_REPORT.md#L114-L168`) & Remediation Log (`P10_1B_REMEDIATION_REPORT.md#L20-L45`).
* **Promotion Decision**: Promoted as **Rule 4** in `05_KNOWLEDGE/engineering-patterns.md`.
* **Confidence**: 100% (High Confidence).

### Pattern 5: Defensive Boundary Deserialization + Exception Isolation
* **Source Incidents**:
  * `BUG-QA1-01` (Corrupted Session JSON App Boot Crash)
  * `BUG-P10.1-06` (Unchecked URL Hostname Constructor Crash)
* **Source Location**: `sessionService.js`, `websiteModel.js`.
* **Evidence**: QA Sprint 1 Audit Report (`QA_SPRINT1_REPORT.md#L26-L36`) & P10.1 Report (`P10_1_BUG_INVESTIGATION_REPORT.md#L198-L200`).
* **Promotion Decision**: Promoted as **Rule 5** in `05_KNOWLEDGE/engineering-patterns.md`.
* **Confidence**: 100% (High Confidence).

### Pattern 6: Interface & Build Contract Consistency
* **Source Incidents**:
  * `BUG-P10.2A-01` (`getMonitorsByWebsiteId` Missing Method Crash)
  * `BUG-P10.1C-01` (Select Component Interface Mismatch)
  * `BUG-P18.2R-01` (V2 Application Shell Import Resolution Failure)
* **Source Location**: `monitorMockService.js`, `Input.jsx`, `vite.config.js`.
* **Evidence**: `P10_2A_RUNTIME_FIX_REPORT.md`, `P10_1C_RUNTIME_FIX_REPORT.md`, `docs/18_CURRENT_STATE.md`.
* **Promotion Decision**: Promoted as **Rule 6** in `05_KNOWLEDGE/engineering-patterns.md`.
* **Confidence**: 100% (High Confidence).

### Pattern 7: Service-Level Input Preconditions + Domain Constraint Guards
* **Source Incidents**:
  * `BUG-QA1-02` (Whitespace Registration Input Validation)
  * `BUG-QA1-03` (Duplicate Email Collision on Profile Update)
  * `BUG-QA2-05` (Service Layer `saveMonitor()` Input Validation)
* **Source Location**: `authService.js`, `monitorMockService.js`.
* **Evidence**: QA Sprint 1 Report (`QA_SPRINT1_REPORT.md#L40-L70`) & QA Sprint 2 Report (`QA_SPRINT2_REPORT.md#L91-L103`).
* **Promotion Decision**: Promoted as **Rule 7** in `05_KNOWLEDGE/engineering-patterns.md`.
* **Confidence**: 100% (High Confidence).

### Pattern 8: Collision-Resistant Entity Identity Generation
* **Source Incident**: `BUG-QA2-01` (Rapid Monitor Creation ID Collision)
* **Source Location**: `frontend/src/services/monitorMockService.js`
* **Evidence**: QA Sprint 2 Audit Report (`QA_SPRINT2_REPORT.md#L28-L39`) & Remediation Log (`QA_SPRINT2_REMEDIATION_REPORT.md#L13-L15`).
* **Promotion Decision**: Promoted as **Rule 8** in `05_KNOWLEDGE/engineering-patterns.md`.
* **Confidence**: 100% (High Confidence).

---

## 3. Excluded Project-Specific Incidents

* **`BUG-P10.1-03`** (Header Dropdown Displays Archived Workspaces):
  * *Reason for Exclusion*: This item represented a simple missing `.filter(ws => ws.status !== 'archived')` check in `Header.jsx`. It was classified as a project-specific UI component presentation filter and excluded from promotion to avoid diluting core Master Brain rules with basic template logic.

---

## 4. DEFF Catalog Audit Summary

All 14 entries in `DEFERRED_FEATURES.md` (`DEFF-001` through `DEFF-014`) were audited and classified as:
`ARCHITECTURAL LIMITATION / DEFERRED FEATURE — NOT A REAL INCIDENT`

No evidence of runtime failure, data corruption, or execution exceptions was found for any DEFF entry.
