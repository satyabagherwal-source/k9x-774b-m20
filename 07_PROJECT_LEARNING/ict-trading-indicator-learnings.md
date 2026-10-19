# ICT Trading Indicator — Forensic Project Learning Dossier

**Repository / Project**: `local/ICT trading indicator` (Path: `c:\ICT trading indicator`)  
**Harvest Date**: 2026-10-19  
**Classification**: `FINANCIAL_ALGORITHMIC_INDICATOR_SYSTEM`  
**Runtime**: TradingView Pine Script Version 6 (`//@version=6`)  
**Target Platforms**: TradingView (Desktop/Web/Mobile), GoCharting, Indian/Global Brokers (Zerodha, Dhan, Fyers)  
**Verification Suite**: Validated against TradingView Pine Editor v6 syntax, mathematical risk-reward logic, and on-chart HUD rendering  

---

## 1. Architectural Profile & Project Scope

The `ICT trading indicator` project is a high-accuracy, chart-native institutional trading indicator suite implementing Inner Circle Trader (ICT) Smart Money Concepts:
1. **Market Structure Engine**: Swing Highs/Lows, Break of Structure (BOS), and Market Structure Shift (MSS / CHoCH).
2. **Imbalance & Institutional Footprint**: Fair Value Gaps (FVG) with 50% Consequent Encroachment (CE) and auto-mitigation tracking.
3. **Institutional Order Blocks (OB)**: High-volume rejection blocks with automated mitigation detection.
4. **Liquidity Sweeps (BSL/SSL)**: Real-time Turtle Soup / Stop-hunt detection above Buy-side and below Sell-side liquidity pools.
5. **Time & Price Theory (Killzones)**: London Open, New York AM, New York PM session tracking.
6. **Actionable Confluence Signals**: BUY and SELL signal markers plotted directly on price bars with dynamic Stop Loss (SL) and Multi-Target Take Profit (TP1 1:1.5, TP2 1:2.0, TP3 1:3.0) projections.
7. **On-Chart HUD Dashboard**: Real-time table displaying Market Bias, Active Session, Tracked FVGs/OBs, and ATR Volatility.

---

## 2. Forensic Post-Mortem: Incident Autopsies & Bug Remediation

### Incident 1: INC-001 — Domain Misalignment (Web Blueprint vs Chart-Native Indicator)
- **Defect**: Generic Project Factory bootstrap engine initialized a web application blueprint (`fullstack-ai-saas` with React, Vite, Express, and `index.html`) inside `c:\ICT trading indicator`.
- **Root Cause**: The Factory Engine's default profiles were web-oriented. Trading indicators operate in a completely different domain: they run natively inside financial charting engines (TradingView Pine Script) rather than in a web browser or Node server.
- **Remediation**: Re-aligned architecture to native Pine Script v6 (`indicators/ICT_Pro_Suite_Indicator.pine`).
- **Promoted Rule**: Rule 2658.

### Incident 2: INC-002 — Pine Script Indentation-Scope Multi-Line Continuation Syntax Error
- **Defect**: TradingView Pine Editor threw:
  `Syntax error at input 'end of line without line continuation'` at lines 351 and 374.
- **Root Cause**: Breaking expressions across lines using `+` where continuation lines were indented by 32 spaces (a multiple of 4). In Pine Script, multiples of 4 are reserved for new block scopes.
- **Remediation**: Replaced multi-line broken expressions with sequential standalone variable assignments (`var := var + ...`).
- **Promoted Rule**: Rule 2659.

### Incident 3: INC-003 — TradingView Compiler Metadata Limit (`SHORT_TITLE_TOO_LONG`) & Pine v6 Upgrade
- **Defect**: TradingView displayed warnings `PINE_VERSION_OUTDATED` and `SHORT_TITLE_TOO_LONG`.
- **Root Cause**: TradingView defaults to v6, and `shorttitle` in `indicator()` cannot exceed 10 characters.
- **Remediation**: Upgraded header to `//@version=6` and shortened `shorttitle` to `"ICT Pro"` (7 chars).
- **Promoted Rule**: Rule 2660.

---

## 3. Reusable Universal Rules Codified

1. **Rule 2658 (Financial Trading Indicator Runtime Isolation & Chart-Native Delivery)**: Never confuse financial charting scripts with web applications. Deliver native Pine Script v6 indicators that compile cleanly inside broker/charting engines.
2. **Rule 2659 (Pine Script Multi-Line Continuation & 4-Space Scope Isolation)**: Avoid line-wrapping expressions inside local blocks where continuation indentation coincides with multiples of 4 spaces; use sequential assignment (`var := var + ...`).
3. **Rule 2660 (TradingView Indicator Metadata Constraints & shorttitle Limits)**: Enforce `shorttitle.length <= 10` and use `//@version=6` for zero-warning TradingView compilation.
