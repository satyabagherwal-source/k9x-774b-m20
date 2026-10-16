# Forensic Learning Dossier: dequelabs/axe-core

## 1. Metadata & Source Provenance
- **Repository**: [dequelabs/axe-core](https://github.com/dequelabs/axe-core)
- **Commit SHA**: `16d6ef7d31fe18d04f141bf194160408d6d6e257`
- **License**: Mozilla Public License 2.0
- **Audit Date**: 2026-10-16
- **Architecture**: The canonical accessibility testing engine powering Google Lighthouse, Microsoft Accessibility Insights, and Chrome DevTools.

## 2. Core Architectural Mechanisms
1. **Zero-False-Positive Auditing Rules**:
   - Every rule is validated to eliminate false positives, ensuring that failures represent genuine compliance and UX defects.
2. **Document Structure & Language Validation**:
   - `html-has-lang`: verifies `<html lang="...">` is present.
   - `html-lang-valid`: checks BCP 47 language code validity, essential for international search indexing.
   - `document-title`: validates that the page possesses a non-empty `<title>`.
3. **Color Contrast Calculation**:
   - Evaluates perceived luminance contrast ratios (`>= 4.5:1` for normal text), ensuring mobile readability.

## 3. Production Failure Modes & Anti-Patterns Defended
- **Failure Mode 1**: Invalid BCP 47 language tags preventing search engines from geotargeting international audiences.
- **Failure Mode 2**: Missing document titles and landmark elements degrading search snippet quality.
