# Agent Error Prevention & Forensic Debugging Protocol

This skill codifies the rules to prevent AI coding agents from repeating recurring mistakes, making false assumptions, or claiming completion without verification.

---

## 1. Top 5 AI Agent Cognitive Pitfalls (And Their Cures)

| # | Cognitive Pitfall / Mistake | Why Agents Do It | The Invariant Cure |
|---|-----------------------------|------------------|-------------------|
| 1 | **"Key Exists = Feature Done" Fallback Trap** | Agent sees key in dictionary or tests pass key count, assumes translation works. | Check rendered value divergence from default locale. Inspect the built `dist/` HTML. |
| 2 | **Regex Line-Ending Blindness (CRLF on Windows)** | Agent writes `$` or `.` regex expecting POSIX `\n`, silently dropping lines on `\r\n`. | Always normalize with `split(/\r?\n/)` and `.trim()` before matching. |
| 3 | **Client Hydration Clobbering SSR** | Agent writes vanilla JS `el.textContent = '...'` using English template strings. | Pass localized strings via `data-label` / `data-template` attributes in SSR HTML. |
| 4 | **Premature Verification Claims** | Agent writes code and immediately says "It is fixed" without building or crawling. | Always run `npm run build` and inspect `dist/` artifacts before declaring success. |
| 5 | **Collateral Damage on Domain Math / Layout** | When asked to fix SEO/routing, agent rewrites canvas transforms or breaks layout. | Strict Non-Destructive Invariant: Do not touch coordinates, scales, or canvas event listeners during infrastructure fixes. |

---

## 2. The Real Artifact Verification Rule

When a task involves:
- Translations: Inspect `dist/[lang]/index.html` to verify rendered characters.
- SEO / Canonical: Check `<link rel="canonical">` and `<link rel="alternate">` in `dist/`.
- Redirects: Verify `public/_redirects` and test URL paths with trailing slashes.
- Builds: Run the full static production build (`npm run build`). Real build success trumps language server assumptions.

---

## 3. Token-Saving & Efficiency Rules for Agents

1. **Never cat or view entire 3,000-line files**: Use targeted `grep_search` and small slice `view_file` ranges (30-60 lines).
2. **Use Single-Purpose Node.js Audits**: When diagnosing bugs across 50+ files, write a 15-line scratch script to inspect the data, rather than reading files into context.
3. **Avoid Status Polling Loops**: When launching a background command that is expected to finish, stop calling tools and let the reactive messaging system wake you up.

---

## 4. Deep Forensic Learning over Velocity Invariant (The 1-to-10 Days Rule)

**Cardinal Philosophy**: *"Bhale hi 1 din ka kaam 10 din me ho paye, par totally deep learning karni h na ki shallow."* (Depth, empirical rigor, and exhaustive forensic understanding 100% supersede speed, throughput, and superficial volume).

| Metric | ❌ Shallow Harvester Anti-Pattern | ✅ Deep Forensic Learning Standard (Master Brain Standard) |
|---|---|---|
| **Speed vs Depth** | Rushes through 5 repos in 10 minutes | Spends hours/days dissecting 1 repository until 100% extracted |
| **Commit Analysis** | Reads only commit messages | Fetches and analyzes full git patches, file diffs, and AST changes |
| **Defect Forensics** | "Fixed a bug in auth" | Documents exact failure mode, race condition, OOM, commit SHA, and root cause |
| **Code Evidence** | Generic bullet points | Concrete Before/After diff snippets (`- Buggy Code`, `+ Safe Invariant`) |
| **Architectural Scope** | Reads `README.md` and `package.json` | Audits core modules, state machines, concurrency locks, and test harnesses |
| **Rule Substance** | Generic advice ("use try/catch") | Exhaustive universal rules with **RULE**, **WHY**, **WHEN**, **PATTERN**, and **NEGATIVE CONSTRAINT** |

### Mandatory Deep Extraction Checklist:
1. **Minimum 5-10 Forensic Incidents**: Extract real production bug fixes with commit SHAs, line numbers, and root cause autopsies.
2. **Real Code Patches**: Every incident must cite the real code change (`- buggy`, `+ safe`).
3. **Substance Threshold Enforcement**: Rule candidates failing the 200+ character substance requirement or missing concrete negative constraints are strictly rejected.
4. **Subsystem Interaction Models**: Document decoupled boundaries, state lifecycles, and error recovery trees.
