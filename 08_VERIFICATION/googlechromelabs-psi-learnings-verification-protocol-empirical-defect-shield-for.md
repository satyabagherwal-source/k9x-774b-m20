# Verification Protocol: Verification Protocol: Empirical Defect Shield for googlechromelabs-psi-learnings

<!-- PROVENANCE_START
{
  "source_repository": "googlechromelabs-psi-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-13T12:36:20.781Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-REEXTRACT-googlechromelabs-psi-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [googlechromelabs-psi-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-13T12:36:20.781Z`  
> **Learning ID**: `LEARN-REEXTRACT-googlechromelabs-psi-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `googlechromelabs-psi-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Dossier: GoogleChromeLabs/psi

## 1. Metadata & Source Provenance
- **Repository**: [GoogleChromeLabs/psi](https://github.com/GoogleChromeLabs/psi)
- **Commit SHA**: `57a0ea63cb4979e56ccd0cc16f4f4f925edb735a`
- **License**: Apache License 2.0
- **Audit Date**: 2026-10-16
- **Architecture**: Node.js API client and CLI for Google PageSpeed Insights.

## 2. Core Architectural Mechanisms
1. **Lab vs Field Dual Data Extraction**:
   - Queries Google's PSI endpoint to extract:
     - Synthetic Lab Audits (Lighthouse score, diagnostics, render-blocking resources).
     - Real-World Field Experience (CrUX 75th percentile LCP, CLS, INP over 28-day rolling window).
2. **Strategy Differentiation**:
   - Supports explicit `mobile` vs `desktop` testing strategies, matching Google's mobile-first indexing infrastructure.

## 3. Production Failure Modes & Anti-Patterns Defended
- **Failure Mode 1**: Testing desktop only and ignoring mobile Core Web Vitals. PSI forces explicit mobile strategy evaluation.
- **Failure Mode 2**: Relying solely on synthetic lab tests that pass on developer machines but fail on actual low-end mobile devices in the field.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
