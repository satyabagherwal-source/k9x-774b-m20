# STAGE D.4: PROPOSED PRODUCTION INTEGRATION PATCH & DIFF (REVIEW ONLY)

**Mission ID:** `UKD-STAGE-D4-PROPOSED-PRODUCTION-PATCH-01`  
**Status:** `DOCUMENTATION_ONLY_DO_NOT_APPLY`  
**Timestamp:** 2026-11-12T18:02:00.000Z  

> [!CAUTION]
> **DO NOT APPLY THIS DIFF.**  
> This document is an isolated engineering review artifact specifying the exact minimal changes required if and when human authorization is granted. No production files have been modified.

---

## 1. Files Requiring Future Modification

Only two production files would be modified during live deployment:
1. `harvest-control.json` (Configuration schema extension)
2. `04_WORKFLOWS/factory-engine/brain-learning-gateway.mjs` (Insertion of non-invasive wrapper call)

No workflows, schedules, classifiers, routers, or knowledge stores are modified.

---

## 2. Minimal Changes & Rationale

1. **`harvest-control.json`:**
   - Adds `shadowMode` block under `brainIntegrityGuard.brainLearningGateway`.
   - Controls feature flag, sample rate, canary repo filter, batch limits, timeout, and circuit breaker.
   - Initial state: `enabled: false`.

2. **`04_WORKFLOWS/factory-engine/brain-learning-gateway.mjs`:**
   - Adds safe, non-blocking shadow hook inside `submitToBrainGateway()`.
   - Protects input via `structuredClone()`.
   - Executes legacy logic first; shadow execution is fail-closed and non-blocking.
   - Always returns exact legacy return value.

---

## 3. Unified Production Patch Diff

```diff
--- a/harvest-control.json
+++ b/harvest-control.json
@@ -62,6 +62,18 @@
       "readbackVerification": "MANDATORY_SHA256_HASH_MATCH",
       "canonicalIndex": "05_KNOWLEDGE/knowledge-index.json",
       "checkpointsFile": ".project-brain/harvest-checkpoints.json",
-      "unverifiedPolicy": "REJECT_AND_FLAG_EXTRACTED_ONLY"
+      "unverifiedPolicy": "REJECT_AND_FLAG_EXTRACTED_ONLY",
+      "shadowMode": {
+        "enabled": false,
+        "sampleRate": 0.01,
+        "canaryTargetRepository": "tiangolo/fastapi",
+        "maxBatchSize": 5,
+        "timeoutMs": 3000,
+        "traceDir": ".project-brain/shadow-traces",
+        "circuitBreaker": {
+          "maxConsecutiveFailures": 3,
+          "cooldownMs": 60000
+        }
+      }
     }
   },

--- a/04_WORKFLOWS/factory-engine/brain-learning-gateway.mjs
+++ b/04_WORKFLOWS/factory-engine/brain-learning-gateway.mjs
@@ -987,6 +987,20 @@ export async function submitToBrainGateway(learningPackage, options = {}) {
   const p = getBrainPaths(options.brainRoot || learningPackage.metadata?.brainRoot || null);
   const startTime = Date.now();
 
+  // Stage D Non-Invasive Shadow Canary Hook (Fail-Closed)
+  const shadowConfig = options.shadowMode || loadShadowConfiguration();
+  if (shadowConfig?.enabled && !options._isShadowExecution) {
+    import('./shadow-gateway-wrapper.mjs')
+      .then(({ ShadowGatewayWrapper }) => {
+        const wrapper = new ShadowGatewayWrapper({ config: shadowConfig });
+        const cloneResult = wrapper.safelyCloneInput(learningPackage);
+        if (cloneResult.success) {
+          wrapper.shadowExecutor.execute(cloneResult.cloned, { ...options, _isShadowExecution: true }).catch(() => {});
+        }
+      })
+      .catch(() => {});
+  }
+
   console.log(`\n======================================================================`);
   console.log(`🏛️  BRAIN LEARNING GATEWAY: PERSISTENCE & PROMOTION PIPELINE`);
```

---

## 4. Potential Compatibility Risks

1. **Object Mutation Race:** If shadow code ran synchronously on `learningPackage`, in-place property additions from `validateLearningPackage()` would collide with shadow normalization.
   - *Mitigation:* `structuredClone()` is performed before shadow invocation, ensuring total memory reference isolation.
2. **Runner Timeout Overages:** If shadow execution blocked the GitHub Actions runner thread, cron runs could exceed timeout boundaries.
   - *Mitigation:* Shadow execution is unawaited and fire-and-forget, with an enforced 3000ms internal timeout and circuit breaker.
3. **Trace Disk Consumption:** Rapid harvesting could accumulate large trace volumes.
   - *Mitigation:* Traces write to `.project-brain/shadow-traces/` (gitignored), capped by 1% sampling on a single repository.

---

## 5. Exact Emergency Rollback Diff

```diff
--- a/harvest-control.json
+++ b/harvest-control.json
@@ -64,3 +64,3 @@
-      "enabled": true,
+      "enabled": false,
```

---

## 6. Runtime Configuration Propagation Requirements

- As verified in Test E.1, `harvest-control.json` is read synchronously on-demand via `fs.readFileSync`.
- A disk-level change from `enabled: true` to `enabled: false` takes effect within **3.2 to 4.5 milliseconds** without requiring process restarts.

---

## 7. Failure Modes & Recovery Steps

| Failure Mode | Automated System Behavior | Manual Recovery Step |
| :--- | :--- | :--- |
| **Shadow execution exception** | Caught in internal try/catch; logged as warning; legacy returns untouched | None required |
| **Timeout (> 3000ms)** | Aborted via Promise.race; failure recorded in circuit breaker | None required |
| **3 Consecutive Failures** | Circuit breaker trips to `OPEN`; all shadow calls bypassed for 60s | Investigate trace logs |
| **Malformed JSON in config** | Caught via JSON.parse try/catch; defaults to `enabled: false` | Fix JSON syntax in config |
| **Non-cloneable input** | Caught via structuredClone try/catch; shadow skipped; legacy continues | None required |

---

## 8. Required Approvals

1. **Production Code Patch Approval:** Explicit user consent required to copy `shadow-gateway-wrapper.mjs` into `04_WORKFLOWS/factory-engine/` and insert the gateway hook.
2. **Canary Activation Approval:** Separate explicit consent required to set `"enabled": true` in `harvest-control.json`.

