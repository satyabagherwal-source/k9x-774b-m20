# Candidate Directive: KNN 5 on a FLAT FLOAT32 COSINE index of 100,000 1536-d HASH documents (numpy seed 1020) with #1020's TAG filter, `(@user_id:{user\-<u>: __shared__ about 10090 matching documents big a second TAG field match

- **Directive ID**: `CD-REV-00EEE7`
- **Status**: `STAGED_FOR_HUMAN_REVIEW`
- **Target Domain**: Domain A (Human & Need Intelligence)
- **Source Repository**: `kividbio-kividb`
- **Source File**: `/home/runner/work/k9x-774b-m20/k9x-774b-m20/07_PROJECT_LEARNING/kividbio-kividb-learnings.md`
- **Observed At**: `51-filtered-flat-knn`

## Governance Notice
> ⚠️ **HIGH-IMPACT DOMAIN GATE**: This candidate belongs to Domain A, which governs fundamental architecture, human needs, or core invariants. In compliance with Rule 28 and Anti-Drift Invariants, an AI model cannot autonomously promote this record. Explicit human approval is required.

## Staged Rule Invariant
```
__shared__})`, about 10,090 matching documents (`big`), a second TAG field matching 100 (`small`) and no filter (`none`), one random user of 1,000 and query of 256 each time, `RETURN 1 vector_distance`: lookups a second and p99 from a closed loop of 8 and 64 connections (threads of 4 client processes on the client's CPUs), median of 3 rounds of 10 s; `--threads 4` (Redis `--io-threads 4 --search-workers 4`) on the first half of the CPUs; the exact top 5 of 10 queries of each layout checked against numpy (`wrong_top5`, exactly 0); `used_memory` a document and the load rate. Gates: `big` at 8 and 64 connections at least 1.25x v1.2.2's and 1.15x Redis's in the same session and within 10 % of recorded; `used_memory` a document 5 %; `small` (the Python client is the limit there), `none`, p99s and the load shown. Needs `REGRESS_REDISEARCH_SO` for Redis (as `28`); `min_cpus=8`, recorded on a `Standard_D8s_v5` (see [the run](#recorded-run-suite-51))
```

## Identified Root Cause / Problem
__shared__})`, about 10,090 matching documents (`big`), a second TAG field matching 100 (`small`) and no filter (`none`), one random user of 1,000 and query of 256 each time, `RETURN 1 vector_distance`: lookups a second and p99 from a closed loop of 8 and 64 connections (threads of 4 client processes on the client's CPUs), median of 3 rounds of 10 s; `--threads 4` (Redis `--io-threads 4 --search-workers 4`) on the first half of the CPUs; the exact top 5 of 10 queries of each layout checked against numpy (`wrong_top5`, exactly 0); `used_memory` a document and the load rate. Gates: `big` at 8 and 64 connections at least 1.25x v1.2.2's and 1.15x Redis's in the same session and within 10 % of recorded; `used_memory` a document 5 %; `small` (the Python client is the limit there), `none`, p99s and the load shown. Needs `REGRESS_REDISEARCH_SO` for Redis (as `28`); `min_cpus=8`, recorded on a `Standard_D8s_v5` (see [the run](#recorded-run-suite-51))

## Rejection / Staging Rationale
- ℹ️ HIGH_IMPACT_DOMAIN_STAGED: Domain A governs structural architecture or core invariants. Mandatory cryptographic human authorization required; AI self-approval blocked.

## Human Review Checklist
- [ ] Verify mathematical correctness and generalizability across all frameworks.
- [ ] Ensure no secret, proprietary token, or workstation path is embedded.
- [ ] Confirm non-contradiction with existing 01_CORE principles.
- [ ] Sign off with explicit `human_authorized: true` to execute promotion.
