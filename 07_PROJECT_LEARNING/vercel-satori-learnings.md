# Forensic Learning Dossier: vercel/satori

## 1. Metadata & Source Provenance
- **Repository**: [vercel/satori](https://github.com/vercel/satori)
- **Commit SHA**: `0b2e88a3857e4adcfd5f99ee3c44fc7ae9ad76ea`
- **License**: Apache License 2.0
- **Audit Date**: 2026-10-16
- **Architecture**: Vercel's lightweight engine converting HTML/JSX to SVG using the Yoga flexbox layout engine.

## 2. Core Architectural Mechanisms
1. **Serverless & Edge Native Execution**:
   - Zero headless browser dependency. Runs in lightweight V8 edge runtimes (Cloudflare Workers, Vercel Edge).
   - Generates pixel-perfect SVG layouts in <20ms using web standards (Flexbox, CSS subset).
2. **Font Glyph Subsetting & Embedding**:
   - Embeds font glyphs as SVG paths, ensuring social media preview cards look identical across all platforms without requiring client-side font downloads.

## 3. Production Failure Modes & Anti-Patterns Defended
- **Failure Mode 1**: Cold start delays and high memory footprints of Puppeteer for dynamic social cards.
- **Failure Mode 2**: Missing fonts on external social platforms causing text layout clipping.
