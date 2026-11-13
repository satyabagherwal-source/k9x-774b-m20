# Knowledge Loss & Routing Failure Root Causes Analysis
**Document ID**: KLR-001  
**Target Repository**: AI-Builder-Brain (`c:\AI-Builder-Brain`)  
**Date**: 2026-11-13T11:45:00.000Z  
**Classification**: ARCHITECTURAL DEFECT ROOT CAUSE ANALYSIS  

---

## 1. Overview of Identified Failure Mechanisms

Our forensic investigation has proved that knowledge loss across the AI-Builder-Brain is not random or due to API timeouts. It is caused by **six specific structural code and architecture defects** in the acquisition, gateway, and routing pipelines.

---

## 2. Root Cause 1: The HIQV Single-Source Gate Blockade (Why Rules Don't Reach `engineering-patterns.md`)

- **File**: `04_WORKFLOWS/factory-engine/harvested-intelligence-quality-validator.mjs`
- **Lines**: 882–886 & 915–924
- **Mechanism**:
  ```javascript
  const isSingleSourceUncorroborated = (
    d2.effective_sources === 0 ||
    (d2.effective_sources === 1 && d1.tier === TRUST_TIERS.TIER_3_COMMUNITY_OPEN)
  );
  if (!d4.is_generic_pattern || d7.is_duplicate || isSingleSourceUncorroborated || d5.status === DIMENSION_STATUS.WARN) {
    decision = VALIDATOR_DECISIONS.CONDITIONAL_PASS;
  }
  ```
- **Consequence**:
  Every single repository harvested by the Cloud Harvester is an open-source GitHub repository (`TIER_3_COMMUNITY_OPEN` with 1 source). Therefore, `isSingleSourceUncorroborated` is ALWAYS `true`.
  This sets `decision = CONDITIONAL_PASS`.
  In `brain-learning-gateway.mjs` (line 640):
  ```javascript
  if (!options.bypassQualityGate && valReport.decision !== VALIDATOR_DECISIONS.PASS) {
    continue; // WITHHELD FROM CANONICAL PROMOTION!
  }
  ```
  Because `CONDITIONAL_PASS !== PASS`, the gateway **silently withholds 100% of candidate rules from being appended to `05_KNOWLEDGE/engineering-patterns.md`**!
  The candidate is diverted to `11_INBOX/candidate-directives/` and logged as `Rule null` in `harvest-verification-matrix.md`.

---

## 3. Root Cause 2: Evolution Bridge Hardcoded to `domain-intelligence/` Only

- **File**: `04_WORKFLOWS/factory-engine/cloud-harvester-evolution-bridge.mjs` & `project-learning-promotion-bridge.mjs`
- **Lines**: `cloud-harvester-evolution-bridge.mjs` lines 317–327, `project-learning-promotion-bridge.mjs` lines 748–755
- **Mechanism**:
  After `multi-agent-fleet.mjs` finishes harvesting, it calls `runHarvesterEvolutionCycle`.
  This function calls `promoteProjectLearningToMasterBrain`.
  `promoteProjectLearningToMasterBrain` creates ONLY `05_KNOWLEDGE/domain-intelligence/DOM-${letter}-${id}.md` and updates `domain-registry.json`!
- **Consequence**:
  The Cloud Harvester only ever produces `DOM-*.md` files in `domain-intelligence/`.
  It NEVER touches `engineering-patterns.md`, `03_SKILLS`, `12_DECISIONS`, or `08_VERIFICATION`.

---

## 4. Root Cause 3: Zero-Clone Harvester Disconnected from Universal Multi-Artifact Distributor

- **File**: `04_WORKFLOWS/factory-engine/zero-clone-harvester.mjs`
- **Lines**: 930–995
- **Mechanism**:
  `zero-clone-harvester.mjs` only generates one single markdown dossier and submits it to `submitToBrainGateway`.
  It does NOT invoke `UniversalMultiArtifactDistributor`.
- **Consequence**:
  The multi-artifact distributor was an offline library tested only in isolated simulation sandboxes. The live Cloud Harvester running on GitHub Actions was never connected to it!

---

## 5. Root Cause 4: Historical Backlog Filter Defect

- **File**: `04_WORKFLOWS/factory-engine/historical-backlog-runner.mjs`
- **Lines**: 163–166
- **Mechanism**:
  ```javascript
  if (art.artifact_type === 'engineering_pattern') {
    continue;
  }
  ```
- **Consequence**:
  When historical backlog redistribution was executed, this filter explicitly skipped all engineering pattern appends, freezing `engineering-patterns.md` at Rule 7273.

---

## 6. Root Cause 5: 50-Character Slug Truncation Collision Defect

- **File**: `04_WORKFLOWS/factory-engine/universal-multi-artifact-distributor.mjs`
- **Lines**: `sanitizeSlug(artifact.title, 50)`
- **Mechanism**:
  Titles starting with `"Verification Protocol: Empirical Defect Shield for "` (51 characters) were truncated at 50 chars, stripping the repository name and producing `verification-protocol-empirical-defect-shield-for-.md` for all 1,245 repositories.
- **Consequence**:
  The first repository wrote the file. All subsequent 1,244 repositories were skipped as duplicate files.

---

## 7. Root Cause 6: BM25 Search Engine Heap Exhaustion on 100,000 Dossier Chunks

- **File**: `04_WORKFLOWS/factory-engine/retrieval-engine.mjs`
- **Lines**: 1662 & 1822
- **Mechanism**:
  `buildSearchIndex()` unconditionally parsed `parseDossierChunks()`, creating over 100,000 sub-chunk objects across 1,829 dossiers in memory, exceeding Node.js 2048 MB heap limit and crashing search with V8 Out-Of-Memory.
- **Consequence**:
  Search was unable to execute against the live corpus without specialized options.

---

## 8. Summary of Required Architectural Solutions

1. **Gateway Promotion Repair**: Allow verified empirical engineering patterns with complete schema (`RULE`, `WHY`, `WHEN TO APPLY`, `VERIFIED IMPLEMENTATION PATTERN`, `NEGATIVE CONSTRAINT`, `VERIFICATION METHOD`) from single open-source repositories to be promoted into `05_KNOWLEDGE/engineering-patterns.md`.
2. **Direct Harvester Distribution Integration**: Integrate `UniversalMultiArtifactDistributor` directly into `zero-clone-harvester.mjs` and `multi-agent-fleet.mjs` so every newly harvested repository automatically generates and persists all applicable secondary artifacts (`03_SKILLS`, `02_AGENT_INTELLIGENCE`, `12_DECISIONS`, `08_VERIFICATION`, and `05_KNOWLEDGE/engineering-patterns.md`).
3. **Automatic Git Auto-Push Inclusion**: Ensure the fleet commit step stages all modified directories (`03_SKILLS`, `02_AGENT_INTELLIGENCE`, `05_KNOWLEDGE`, `08_VERIFICATION`, `12_DECISIONS`).
4. **Lean Canonical Search Indexing**: Pass `skipDossiers` / `noDossiers` option during standard retrieval queries to keep search blazing fast and well within memory boundaries.
5. **Universal Re-Extraction Campaign**: Re-extract and redistribute all historical and newly added repositories using the corrected pipeline.

