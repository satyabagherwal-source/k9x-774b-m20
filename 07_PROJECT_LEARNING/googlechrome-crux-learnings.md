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
