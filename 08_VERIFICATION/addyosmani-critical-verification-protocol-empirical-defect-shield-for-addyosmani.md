# Verification Protocol: Verification Protocol: Empirical Defect Shield for addyosmani/critical

<!-- PROVENANCE_START
{
  "source_repository": "addyosmani/critical",
  "source_url": "https://github.com/addyosmani/critical",
  "source_version": "historical-head",
  "license": "OPEN_HARVEST",
  "timestamp": "2026-11-13T00:00:00.000Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "unknown",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [addyosmani/critical](https://github.com/addyosmani/critical) (Revision: `historical`).  
> **License**: OPEN_HARVEST | **Timestamp**: `2026-11-13T00:00:00.000Z`  
> **Learning ID**: `unknown`


## 1. Scope & Verification Target
- **Target Repository**: `addyosmani/critical` (Commit: `historical`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Dossier: addyosmani/critical

## 1. Metadata & Source Provenance
- **Repository**: [addyosmani/critical](https://github.com/addyosmani/critical)
- **Commit SHA**: `83f5a54db5e6b12f689f2a009c95ebfaebc03e8a`
- **License**: Apache License 2.0
- **Audit Date**: 2026-10-16
- **Architecture**: Automated utility by Addy Osmani extracting and inlining above-the-fold critical CSS.

## 2. Core Architectural Mechanisms
1. **Above-the-Fold Style Extraction**:
   - Evaluates the DOM at standard mobile and desktop viewports (e.g. 1300x900 and 375x667).
   - Extracts only the CSS rules matching elements visible in the initial viewport.
2. **HTML Stream Inlining & Deferment**:
   - Inlines the extracted critical CSS into an early `<style>` block in the HTML `<head>`.
   - Modifies external stylesheets to load asynchronously via `<link rel="preload" as="style" onload="this.rel='stylesheet'">`.

## 3. Production Failure Modes & Anti-Patterns Defended
- **Failure Mode 1**: Large external stylesheets (e.g. 300KB) blocking initial render, degrading First Contentful Paint (FCP) and LCP.
- **Failure Mode 2**: Flash of Unstyled Content (FOUC) caused by naive async stylesheet loading.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
