# Harvest Incident Record: https://github.com/NucleoidAI/Nucleoid
- **Incident ID**: INC-HARVEST-002
- **Timestamp**: 2026-11-20T13:40:23.964Z
- **Target**: https://github.com/NucleoidAI/Nucleoid (github)
- **Status**: FAILED_REMEDIATED

---

## 1. Context & Expected Behavior
Expected successful forensic extraction of code diffs, closed bug issues, and manifests under 24/7 continuous harvesting loop.

## 2. Actual Error & Observed Failure
```
Error: ENOENT: no such file or directory, stat '/home/runner/work/k9x-774b-m20/k9x-774b-m20/05_KNOWLEDGE/knowledge-index.json.tmp.2500.1795182023893'
    at Object.statSync (node:fs:1746:25)
    at walkSubdir (file:///home/runner/work/k9x-774b-m20/k9x-774b-m20/04_WORKFLOWS/factory-engine/universal-destination-discovery.mjs:252:30)
    at discoverCanonicalDestinations (file:///home/runner/work/k9x-774b-m20/k9x-774b-m20/04_WORKFLOWS/factory-engine/universal-destination-discovery.mjs:335:22)
    at new UniversalMultiArtifactDistributor (file:///home/runner/work/k9x-774b-m20/k9x-774b-m20/04_WORKFLOWS/factory-engine/universal-multi-artifact-distributor.mjs:331:32)
    at submitWithUniversalDistribution (file:///home/runner/work/k9x-774b-m20/k9x-774b-m20/04_WORKFLOWS/factory-engine/universal-distribution-gateway-adapter.mjs:65:23)
    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    at async runZeroCloneHarvester (file:///home/runner/work/k9x-774b-m20/k9x-774b-m20/04_WORKFLOWS/factory-engine/zero-clone-harvester.mjs:975:31)
```

## 3. Root Cause Analysis
Extraction failure: upstream response error, network timeout, or schema mismatch.

## 4. Remediation Action
Target marked as failed in run log; target lock released; advance to next target without halting the fleet.

## 5. Engineering Lesson
External 24/7 harvest pipelines must be resilient to intermittent upstream outages, maintaining circuit breakers and fallback laborers so that learning never stops entirely.
