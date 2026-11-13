# AI-BUILDER-BRAIN — PRODUCTION ROLLBACK PLAN
## Instant Abort, Safe Restoration & Non-Destructive Fallback Procedures

> **Mission**: Universal Knowledge Distribution & Persistence (Master Execution)  
> **Target Scenario**: Rapid Reversion to Single-Sink Baseline or Restoring Pre-Migration State  
> **Backup Baseline**: `.project-brain/backups/pre-universal-distribution/` (Manifest Verified)  
> **Target Rollback RTO (Recovery Time Objective)**: < 30 Seconds  
> **Date**: 2026-11-13  

---

## 1. Executive Summary

In mission-critical autonomous environments, any new capability must be equipped with an **instantaneous, non-destructive emergency abort and rollback mechanism**. If live multi-destination writes cause unintended registry locks, filesystem errors, or downstream AI agent confusion, the system can be restored to its pre-distribution baseline within seconds without taking down the 24/7 Cloud Harvester.

Three rollback tiers are established:
1. **Tier 1 — Instant Feature-Flag Kill-Switch (Zero Downtime, < 5 seconds)**
2. **Tier 2 — Selective Orphan Cleanup & Registry Rollback (< 2 minutes)**
3. **Tier 3 — Full Pre-Migration File Restoration (< 5 minutes)**

---

## 2. Tier 1: Instant Feature-Flag Kill-Switch (< 5 Seconds)

If any anomaly occurs in live production writes:
- **Action**: Disable the universal distribution feature flag in `universal-distribution-gateway-adapter.mjs` or via environment variable.
- **PowerShell Command**:
  ```powershell
  $env:ENABLE_UNIVERSAL_DISTRIBUTION_PRODUCTION_WRITES = "false"
  ```
  Or edit line 23 of `04_WORKFLOWS/factory-engine/universal-distribution-gateway-adapter.mjs`:
  ```javascript
  const DEFAULT_DISTRIBUTION_MODE = DISTRIBUTION_MODES.SHADOW_OBSERVATION;
  ```
- **Immediate Outcome**:
  - All subsequent submissions from Cloud Harvester or project agents revert strictly to shadow observation.
  - Primary persistence (`07_PROJECT_LEARNING/` raw dossiers and `05_KNOWLEDGE/engineering-patterns.md`) continues uninterrupted.
  - Zero downtime, zero restarts required.

---

## 3. Tier 2: Selective Orphan Cleanup & Registry Rollback (< 2 Minutes)

If a partial failure or bad batch generated erroneous artifacts in secondary destinations:
1. **Audit Dangling Pointers**:
   Run the Registry Synchronizer to identify orphan entries or unverified files:
   ```powershell
   node 04_WORKFLOWS/factory-engine/knowledge-registry-synchronizer.mjs --audit
   ```
2. **Quarantine Erroneous Artifacts**:
   Rather than permanently deleting files, move questionable artifacts to `.project-brain/simulation-sandbox/quarantine/`:
   ```powershell
   # Move specific batch files by session timestamp
   Move-Item -Path "05_KNOWLEDGE/domain-intelligence/domain-c-enterprise/DI-BATCH-ERR-*.md" -Destination ".project-brain/simulation-sandbox/quarantine/"
   ```
3. **Re-synchronize Registries**:
   Run the repair procedure to reconcile registries with remaining valid canonical files:
   ```powershell
   node 04_WORKFLOWS/factory-engine/knowledge-registry-synchronizer.mjs --repair
   ```

---

## 4. Tier 3: Full Restoration from Pre-Migration Backup (< 5 Minutes)

Before any Universal Distribution modifications were made, an immutable SHA-256 verified backup was created in `.project-brain/backups/pre-universal-distribution/`.

### 4.1 Backup Manifest Verification
The backup directory contains:
- `brain-learning-gateway.mjs` (66,667 bytes, SHA-256: `23f3b02b723fc7fc9d338f90264fc92bf170889fb3509930fcaaa756e0771803`)
- `destination-router.mjs` (13,305 bytes, SHA-256: `f2d3347e8f651d8aa492ab2b144bc3efbbf1fc9a7d3bf630c6c214ea6c28f64e`)
- `domain-registry.json` (151,561 bytes, SHA-256: `7a5075ac6e049e273010b991da40b2f5b66d48b1fc5cbe5b1418be177d130545`)
- `candidate-directives-registry.json` (312,232 bytes, SHA-256: `c7322ed633cc0b74ce15e21544a048a97b2d56a2f4da066b72a6bca348e3cfbb`)
- `backup-manifest.json`

### 4.2 Restoration Script Procedure
To restore the pre-universal baseline:
```powershell
# Restore backed-up files to production locations
Copy-Item -Path ".project-brain/backups/pre-universal-distribution/brain-learning-gateway.mjs" -Destination "04_WORKFLOWS/factory-engine/brain-learning-gateway.mjs" -Force
Copy-Item -Path ".project-brain/backups/pre-universal-distribution/destination-router.mjs" -Destination "04_WORKFLOWS/factory-engine/destination-router.mjs" -Force
Copy-Item -Path ".project-brain/backups/pre-universal-distribution/domain-registry.json" -Destination "05_KNOWLEDGE/domain-intelligence/domain-registry.json" -Force
Copy-Item -Path ".project-brain/backups/pre-universal-distribution/candidate-directives-registry.json" -Destination "11_INBOX/candidate-directives-registry.json" -Force
```

### 4.3 Post-Rollback Validation
1. Verify SHA-256 hashes match original pre-migration values.
2. Execute existing regression suite:
   ```powershell
   node 04_WORKFLOWS/factory-engine/test-brain-learning-gateway.mjs
   ```
3. Confirm 41/41 tests pass.

---

## 5. Rollback Decision Matrix

| Anomaly Observed | Recommended Action | Expected Resolution Time |
|---|---|---|
| Latency spike > 500 ms in Cloud Harvester | Activate Tier 1 Kill-Switch | < 5 seconds |
| Registry JSON parse error | Run Tier 2 Synchronizer Repair | < 1 minute |
| File clobbering or incorrect path write | Move files to sandbox quarantine, run Tier 2 | < 2 minutes |
| Unforeseen gateway crash loop | Execute Tier 3 Full File Restoration | < 5 minutes |

---

## 6. Safety Guarantee

Because the Universal Distribution system was constructed with an additive, non-invasive adapter pattern, rollback does not require Git rebases, force-pushes, or data deletion. All historical learning remains preserved under all circumstances.

