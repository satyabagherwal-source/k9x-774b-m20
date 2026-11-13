# Verification Protocol: Verification Protocol: Empirical Defect Shield for googlechrome/crux

<!-- PROVENANCE_START
{
  "source_repository": "googlechrome/crux",
  "source_url": "https://github.com/googlechrome/crux",
  "source_version": "historical-head",
  "license": "OPEN_HARVEST",
  "timestamp": "2026-11-13T00:00:00.000Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "unknown",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [googlechrome/crux](https://github.com/googlechrome/crux) (Revision: `historical`).  
> **License**: OPEN_HARVEST | **Timestamp**: `2026-11-13T00:00:00.000Z`  
> **Learning ID**: `unknown`


## 1. Scope & Verification Target
- **Target Repository**: `googlechrome/crux` (Commit: `historical`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Dossier: GoogleChrome/CrUX

## 1. Metadata & Source Provenance
- **Repository**: [GoogleChrome/CrUX](https://github.com/GoogleChrome/CrUX) (canonical CrUX repository)
- **Commit SHA**: `b62877a01a528181fe3bc38d17d5aba84e48b52e`
- **License**: Apache License 2.0
- **Audit Date**: 2026-10-16
- **Architecture**: The official BigQuery and API automation repository for the Chrome User Experience Report (CrUX).

## 2. Core Architectural Mechanisms
1. **Real-User Field Telemetry**:
   - Aggregates user metrics from millions of opt-in Chrome users globally.
   - Evaluates performance under real network conditions (3G, 4G, 5G, congested Wi-Fi) and varied hardware capabilities.
2. **75th Percentile Evaluation Invariant**:
   - Google Search ranking signals evaluate the 75th percentile of all visits over a 28-day window.
   - A single fast developer test does NOT impact search rankings; only field distribution passes count.
3. **Origin vs URL Level Granularity**:
   - Queries can target specific URLs (if sufficient traffic exists) or fall back to domain origin level.

## 3. Production Failure Modes & Anti-Patterns Defended
- **Failure Mode 1**: Optimizing only for synthetic lab audits while real users on mobile devices experience poor INP and high CLS.
- **Failure Mode 2**: Misinterpreting field data anomalies caused by seasonal traffic changes. Solved by 28-day rolling window analysis.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
