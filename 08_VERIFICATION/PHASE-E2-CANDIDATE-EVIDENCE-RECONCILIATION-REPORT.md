# PHASE E.2: CANDIDATE EVIDENCE RECONCILIATION & DUPLICATE ANALYSIS REPORT

**Mission ID:** `UKD-PHASE-E2-CANDIDATE-RECONCILIATION-01`  
**Repository:** `C:\AI-Builder-Brain`  
**Execution Mode:** Pure Sandbox Simulation (Zero Production Mutation)  
**Overall Verdict:** `VERIFIED`  
**Timestamp:** 2026-11-12T18:45:00.000Z  

> [!IMPORTANT]
> **PRESERVE-FIRST NON-DESTRUCTIVE RECONCILIATION ENFORCED.**  
> This phase performed a rigorous, evidence-backed audit across all 697 candidate directives in `11_INBOX/candidate-directives-registry.json`.  
> - **Zero Deletions:** All 697 candidate directives are 100% preserved.  
> - **Zero Automatic Merges:** All proposed consolidations are documented solely as review artifacts.  
> - **Zero Canonical Promotions:** No unverified candidate was promoted to production stores.  
> - **KHU-005 Preservation:** All 5 pending Zod duplicate records in `domain-registry.json` remain 100% intact.  
> - **Verdict: `VERIFIED`** (7/7 independent verification tests passed; bitwise production purity confirmed).

---

## 1. Fresh Baseline & Dataset Demographics

Prior to reconciliation, an automated census was extracted from `11_INBOX/candidate-directives-registry.json` and cross-referenced with `05_KNOWLEDGE/domain-intelligence/domain-registry.json`:

| Baseline Metric | Measured Value | Architectural Context & Interpretation |
| :--- | :-: | :--- |
| **Total Candidate Directives** | **697** | Complete raw inbox pre-promotion staging buffer. |
| **Unique Directive Titles** | **572** | Unique semantic headings across the inbox. |
| **Duplicate Excess Instances** | **125** | Total redundant items across title collision groups (`697 - 572 = 125`). |
| **Duplicate Title Groups** | **33** | Distinct title groups with 2 or more candidate instances (encompassing 158 total items). |
| **Unique Directive IDs** | **626** | **Critical Discovery:** 42 legacy ID collision clusters exist in the registry (71 duplicate IDs). |
| **Active Canonical Promoted** | 3 (0.4%) | Staged candidates already linked to canonical rules (e.g. `CD-001`). |
| **Staged for Verification** | 398 (57.1%) | Candidates awaiting automated verification protocols. |
| **Staged for Human Review** | 296 (42.5%) | Candidates awaiting governance approval (e.g. repeated harvester batches). |
| **Rejected Candidates (with Reason)** | **394 (56.5%)** | Raw items rejected by the gateway validation gate during automated harvesting. |
| **Dossier Backing Rate** | **392 / 394 (99.5%)** | 99.5% of rejected candidates trace directly to forensic dossiers in `07_PROJECT_LEARNING/`. |
| **Production Domain Registry** | 74 records | Unchanged canonical store. |
| **Pending KHU-005 Records** | 5 records | Verified 100% intact (`DOM-H-94C4B932`, `2007DF83`, `7D0B9F17`, `C2A738D4`, `1B2AC6F8`). |

---

## 2. Duplicate Group Analysis (33 Groups)

All 33 duplicate groups (158 total items) were evaluated across content equality, semantic similarity, source provenance, implementation targets, and evidence completeness.

### 2.1 Category Distribution Across Duplicate Items
```
EXACT_DUPLICATE        :   6 items ( 3.8%)  [Identical content & provenance modulo ID]
SEMANTIC_DUPLICATE     :  93 items (58.9%)  [Identical repo & logic, minor timestamp/loop staging]
INSUFFICIENT_EVIDENCE  :  59 items (37.3%)  [Rejected terse boilerplate across disparate repos]
PARTIAL_OVERLAP        :   0 items ( 0.0%)
COMPLEMENTARY          :   0 items ( 0.0%)
CONFLICTED             :   0 items ( 0.0%)
```

### 2.2 Census of Top Duplicate Groups
The following table documents the primary duplicate groups, their classification rationale, and non-destructive merge recommendations:

| Group ID | Normalized Title | Count | Category | Repositories | Rationale & Evidence | Proposed Review Recommendation |
| :-: | :--- | :-: | :-: | :--- | :--- | :--- |
| **DUP-GRP-23** | `models): add download user-agent and ipv4 fallback (#370)` | 32 | `SEMANTIC_DUPLICATE` | `zvec-ai-zvec-grep` | Repeated harvester loop generated 32 identical staged files with unique IDs (`CD-REV-E91DAF`, `8EAC7D`...). | Consolidate review into canonical representative `CD-REV-E91DAF`; preserve provenance links. |
| **DUP-GRP-22** | `export: fix consent of former subscribers covering private channels.` | 16 | `SEMANTIC_DUPLICATE` | `telegramdesktop/tdesktop` | Harvester loop re-staged identical commit autopsy 16 times with randomized candidate IDs. | Consolidate review into canonical representative `CD-REV-7479A7`. |
| **DUP-GRP-01** | `the 8 learning extraction artifacts` | 14 | `INSUFFICIENT_EVIDENCE` | 14 distinct repos (`moonshotai`, `qwen`, `apple`, `compvis`...) | Extracted identical README section title from 14 different repos. All failed substance/why checks; zero body. | **DO NOT MERGE.** Keep separate; quarantine in inbox as insufficient evidence. |
| **DUP-GRP-26** | `editor): add scoped ios account deletion` | 14 | `SEMANTIC_DUPLICATE` | `wordpress-mobile/WordPress-iOS` | 14 identical loop re-stagings from a single iOS account deletion commit. | Consolidate review into canonical representative `CD-REV-8E0D9F`. |
| **DUP-GRP-04** | `stream & asynciterable collection bound limitation` | 6 | `EXACT_DUPLICATE` | `canonical_task_execution` | Line-for-line identical engineering gap feedback (`CD-090` through `CD-095`). | Consolidate review into canonical representative `CD-090`. |
| **DUP-GRP-27** | `splash screen staying visible after warm start on android 12+` | 6 | `SEMANTIC_DUPLICATE` | `element-hq/element-android` | 6 loop re-stagings from the same Android warm-start splash screen defect autopsy. | Consolidate review into canonical representative `CD-REV-5AF5AE`. |
| **DUP-GRP-28** | `android): skip explicit kotlin plugin when agp registers kotlin` | 6 | `SEMANTIC_DUPLICATE` | `facebook/react-native` | 6 identical loop re-stagings from React Native Android gradle build patch. | Consolidate review into canonical representative `CD-REV-32633D`. |
| **DUP-GRP-02** | `backend concurrency & memory safety` | 5 | `SEMANTIC_DUPLICATE` | 3 distinct repos (`orcarouter`, `CompVis`...) | Multi-repo extraction of concurrency guidelines; differing underlying model buffer targets. | Retain separate multi-repo records; merge only domain cross-references. |
| **DUP-GRP-29** | `forensic learning record (deep inspection): zleap-ai/sag` | 5 | `SEMANTIC_DUPLICATE` | `zleap-ai/sag` | 5 identical dossier extractions staged with distinct revision hashes. | Consolidate review into canonical representative `CD-REV-3A2D9B`. |
| **DUP-GRP-03** | `rule` (Generic Title) | 3 | `INSUFFICIENT_EVIDENCE` | 3 distinct repos | Generic boilerplate title rejected by validator; lacks substantive engineering principle. | Permanently mark malformed; do not promote. |

> [!NOTE]
> **False-Positive Prevention Rule Enforced:** Items sharing identical titles across disparate repositories (e.g. Group 1 with 14 distinct AI repos) were **strictly rejected from being classified as EXACT_DUPLICATE**. They represent independent extractions with zero code overlap.

---

## 3. Rejected Candidate Classification (394 Records)

During automated harvesting, `validateRuleCandidate()` rejected 394 candidate directives. These were staged into `11_INBOX/candidate-directives-registry.json` to prevent silent data loss.

### 3.1 Census of Gateway Rejection Reasons
```
MISSING_NEGATIVE_CONSTRAINT     : 208 records (52.8%)  [Captured positive rule, omitted anti-pattern]
GENERIC_HEADER_TITLE            :  59 records (15.0%)  [Extracted section title instead of principle]
SUBSTANCE_THRESHOLD_FAILED      :  54 records (13.7%)  [Extracted rule body < 200 characters]
MISSING_WHY_RATIONALE           :  42 records (10.7%)  [Stated what to do, omitted failure justification]
MISSING_WHEN_TO_APPLY           :   9 records ( 2.3%)  [Lacked environmental boundary conditions]
MISSING_VERIFICATION_METHOD     :   9 records ( 2.3%)  [Lacked automated test assertion contract]
MISSING_IMPLEMENTATION_PATTERN  :   7 records ( 1.8%)  [Lacked code implementation pattern]
INVALID_OR_MISSING_TITLE        :   3 records ( 0.8%)  [Malformed title string]
LOCAL_PR_OR_ISSUE_TITLE         :   3 records ( 0.8%)  [Title tied to local repo issue, not universal]
Total Rejected Candidates       : 394 records (100.0%)
```

---

## 4. Evidence Recovery Results & Dispositions

### 4.1 Provenance Tracing to Forensic Dossiers
- **392 of 394 (99.5%)** rejected candidates trace directly to parent forensic learning dossiers in `07_PROJECT_LEARNING/`.
- The parent dossiers contain the complete commit metadata, file diffs, and forensic incident autopsies that the automated regex extractor failed to compress into the rule candidate object.

### 4.2 Recommended Recovery Dispositions
Each of the 394 rejected candidates was categorized into an evidence-backed disposition:

| Recommended Disposition | Count | % of Rejected | Definition & Next Action |
| :--- | :-: | :-: | :--- |
| **`RECOVERABLE_WITH_SYNTHESIS`** | **249** | **63.2%** | **High Recovery Value:** Parent dossier contains verified code diffs and root-cause analysis. Missing negative constraints (208) or why rationales (41) can be synthetically backfilled from the dossier without new upstream extraction. |
| **`SUPERSEDED_BY_DOSSIER`** | **54** | **13.7%** | Candidate rule body was under 200 characters, but the parent dossier in `07_PROJECT_LEARNING/` already persists the complete learning. Candidate directive can be retired as redundant. |
| **`REJECT_PERMANENTLY_MALFORMED`** | **62** | **15.7%** | Titles consist of generic headers ("Rule", "The 8 Learning Extraction Artifacts") or repository issue tags. Unsuitable for canonical promotion; should remain permanently in inbox. |
| **`UNVERIFIED_QUARANTINED`** | **29** | **7.4%** | Lacks parent dossier or sufficient empirical evidence. Must remain strictly quarantined in `11_INBOX`. |
| **Total** | **394** | **100.0%** | **Clear, actionable recovery roadmap established.** |

---

## 5. Sandbox Reconciliation Dataset Architecture

The complete reconciliation dataset was generated in pure sandbox:
- **File Path:** `.project-brain/simulation-sandbox/phase-e2-reconciliation/data/reconciliation-dataset-697.json`
- **File Size:** 1,090,777 bytes (1.09 MB)
- **Record Count:** Exactly 697 records (1-to-1 parity with production inbox).

### 5.1 Dataset Schema & Annotation
Each record in the dataset is enriched with:
```json
{
  "reconciliationIndex": 1,
  "directiveId": "CD-001",
  "title": "Every Website = Language-Aware by Design...",
  "status": "PROMOTED_CANONICAL_ACTIVE",
  "provenance": {
    "sourceRepo": "internal://chat_master_prompt",
    "sourceCommit": null,
    "author": "User (Tier-1 Human Directive)",
    "stagedFile": "11_INBOX/candidate-directives/CD-001-multilingual-first-architecture.md",
    "parentDossier": null
  },
  "duplicateAnalysis": {
    "isDuplicateInstance": false,
    "groupId": null,
    "duplicateCategory": "UNIQUE_RECORD",
    "recommendation": "STANDALONE_RECORD"
  },
  "evidenceRecovery": {
    "gatewayRejectionReason": null,
    "rejectionCategory": "NOT_REJECTED_CLEAN_CANDIDATE",
    "missingEvidence": null,
    "recoveryConfidence": 1.0,
    "recommendedDisposition": "ACTIVE_CANDIDATE_DIRECTIVE"
  },
  "proposedTaxonomy": {
    "primaryDomain": "J",
    "primaryDomainName": "Search & Distribution Intelligence",
    "secondaryDomains": ["A", "D", "K"],
    "targetCanonicalFolder": "01_CORE",
    "requiresHumanApproval": true
  }
}
```

---

## 6. Unresolved Records & Integrity Edge Cases

1. **Legacy ID Collisions (42 Groups, 71 Redundant Records):**  
   *Discovery:* The legacy candidate registry contains 42 duplicate ID instances (e.g. `CD-YP7G` appears 4 times, `CD-YSCG` appears 5 times, `CD-DY0S` appears 4 times) because harvest workers generated identical short IDs across runs.  
   *Resolution:* Preserved all 697 records with original IDs while assigning a unique `reconciliationIndex` (1..697) to eliminate index ambiguity.
2. **Missing Local Files (CD-093):**  
   *Discovery:* Directive `CD-093` is registered in JSON, but its corresponding on-disk file was missing.  
   *Resolution:* Retained record in reconciliation dataset; flagged `hasStagedFile: false` and classified as `EXACT_DUPLICATE` of `CD-090`.
3. **2 Unmatched Rejected Candidates:**  
   *Discovery:* 2 rejected candidates lacked a matching dossier in `07_PROJECT_LEARNING/`.  
   *Resolution:* Categorized strictly as `UNVERIFIED_QUARANTINED`.

---

## 7. Independent Verification Results (7/7 Passed)

The independent verification suite (`test-independent-e2-verification.mjs`) was executed:

| Test ID | Verification Pillar | Target Invariant | Result | Evidence Output |
| :-: | :--- | :--- | :-: | :--- |
| **E2-TEST-01** | **Duplicate False-Positive Detection** | Multi-repo groups must NOT be marked `EXACT_DUPLICATE`. | ✅ PASS | Group 1 (14 repos) classified as `INSUFFICIENT_EVIDENCE`. |
| **E2-TEST-02** | **Conflicting Records Preservation** | All 697 records preserved with unique ordinal keys. | ✅ PASS | 697 records preserved (626 legacy unique IDs + 71 collisions preserved). |
| **E2-TEST-03** | **Provenance Integrity** | 1-to-1 provenance parity across all candidates. | ✅ PASS | Verified 1-to-1 match across IDs, repos, and commits. |
| **E2-TEST-04** | **Missing Evidence Handling** | Un-sourced claims strictly quarantined. | ✅ PASS | Quarantined 29 unverified and flagged 62 malformed candidates. |
| **E2-TEST-05** | **Reproducibility** | Repeated execution yields bitwise identical output. | ✅ PASS | Bitwise hash match across independent runs (`542568ea46a94cb2...`). |
| **E2-TEST-06** | **KHU-005 Preservation** | All 5 pending Zod duplicate records intact in production. | ✅ PASS | Verified 100% intact in `domain-registry.json`. |
| **E2-TEST-07** | **Read-Back Integrity** | Persisted dataset matches pre-write SHA-256 hash. | ✅ PASS | Read back 1,090,777 bytes with matching SHA-256 (`84c682701f558a5c...`). |

**Verification Score: 7 / 7 Tests Passed (100.0%).**

---

## 8. Production Isolation Proof

| Production File | Pre-Execution SHA-256 | Post-Execution SHA-256 | Bitwise Parity Match |
| :--- | :--- | :--- | :---: |
| `05_KNOWLEDGE/domain-intelligence/domain-registry.json` | `7a5075ac6e049e27...` | `7a5075ac6e049e27...` | ✅ MATCH |
| `11_INBOX/candidate-directives-registry.json` | `c7322ed633cc0b74...` | `c7322ed633cc0b74...` | ✅ MATCH |
| `.project-brain/knowledge-graph/relationship-graph.json` | `488e8ccd4fee03ac...` | `488e8ccd4fee03ac...` | ✅ MATCH |
| `05_KNOWLEDGE/knowledge-index.json` | `7e49f275a9a71cb2...` | `7e49f275a9a71cb2...` | ✅ MATCH |
| `05_KNOWLEDGE/engineering-patterns.md` | `6ea819849e8b3ef7...` | `6ea819849e8b3ef7...` | ✅ MATCH |
| `harvest-control.json` | `79b321c884ca80c6...` | `79b321c884ca80c6...` | ✅ MATCH |

**Proof:** Pre- and post-execution hashes are bitwise identical. Zero production files were modified, committed, or deleted.

---

## 9. Next Construction Step (Phase E.3)

1. **Phase E.3 — Synthetic Enrichment & Dossier Extraction:**
   - Execute the evidence recovery pass for the **249 recoverable candidates**, synthetically extracting missing negative constraints and why rationales directly from their parent dossiers in `07_PROJECT_LEARNING/`.
2. **Consolidation Diff Preparation:**
   - Prepare a review diff for consolidating the 93 `SEMANTIC_DUPLICATE` items (such as the 32 repeated `zvec-ai-zvec-grep` entries) into single canonical inbox records.
3. **Gateway Invariant Update:**
   - Add a pre-staging deduplication barrier in `submitToBrainGateway()` to prevent future harvester runs from generating duplicate IDs or repeated directive titles.

---

**Report Authored By:** Antigravity Autonomous Knowledge Architecture Engine  
**Verification Path:** `08_VERIFICATION/PHASE-E2-CANDIDATE-EVIDENCE-RECONCILIATION-REPORT.md`  
**Execution State:** Complete. Stopped cleanly awaiting human direction.

