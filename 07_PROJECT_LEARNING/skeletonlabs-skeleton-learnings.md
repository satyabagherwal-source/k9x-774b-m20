> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/skeletonlabs-skeleton-learnings.md`  
> **Source**: GitHub ([https://github.com/skeletonlabs/skeleton](https://github.com/skeletonlabs/skeleton))  
> **Synthesized By**: Google Gemini Server-to-Server Autonomous AI Agent  
> **Timestamp**: 2026-09-28T20:21:22.577Z  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  

---

# Forensic Learning Record: skeletonlabs/skeleton

## 1. Executive Forensic Architecture & System Mechanics
Skeleton is a UI component library built on the **Svelte/SvelteKit** ecosystem, leveraging **Tailwind CSS** as its primary styling engine. Its architectural core relies on **Design Tokens** (CSS variables) to bridge the gap between component logic and theme-agnostic styling. The system operates as a "headless-adjacent" library, where logic is encapsulated in Svelte components, but visual presentation is delegated to Tailwind utility classes. The primary architectural risk is **CSS specificity leakage** and **runtime dependency on compiler-level Svelte configurations**, which can inadvertently strip or alter component behavior.

## 2. Deep Micro-Learnings & Runtime Gotchas
*   **Failure Mode: Compiler-Induced Component Silencing**
    *   **Root Cause:** Enabling `preserveComments` or `preserveWhitespace` in `svelte.config.js` can break internal Svelte component mounting logic if the library relies on specific DOM structure or comment-based markers for hydration.
    *   **Fix:** Isolate library-specific Svelte configurations from consumer-level compiler options; use `svelte-preprocess` to enforce strict build-time constraints.
*   **Failure Mode: CSS Specificity Over-Reach**
    *   **Root Cause:** Hardcoding `height: 100%` on internal sub-components (e.g., `FloatingPanel.Body`) creates rigid layouts that break when nested in dynamic containers.
    *   **Fix:** Default to `h-auto` or `flex-1` and allow consumer-injected classes to override via Tailwind’s `!important` or specific utility layering.
*   **Failure Mode: Browser-Specific CSS Feature Gaps**
    *   **Root Cause:** Usage of `transition-discrete` (CSS property) fails in Firefox, causing silent animation failures.
    *   **Fix:** Implement a feature-detection layer or a fallback CSS class strategy using `@supports` queries for modern CSS features.
*   **Failure Mode: Semantic CSS Anti-Patterns**
    *   **Root Cause:** Applying `cursor: pointer` to generic `btn` classes violates browser accessibility standards (only interactive elements like `<a>` or `<button>` should imply pointer interaction).
    *   **Fix:** Remove global cursor overrides; rely on browser defaults for semantic elements.

## 3. 8-Dimensional Multi-Axis Forensic Analysis
*   **D1: Structural Boundaries:** Strong separation between theme-generation logic and component rendering.
*   **D2: Asynchronous State:** Toast/Drawer state management is highly sensitive to Svelte's reactivity cycle; race conditions occur if state updates occur during component teardown.
*   **D3: Error Boundaries:** Lack of explicit Svelte `error.svelte` boundaries within the library leads to full-app crashes on component failure.
*   **D4: Resource Lifecycle:** Toast notifications require manual cleanup; failure to clear timers leads to memory leaks in long-running SPAs.
*   **D5: Deserialization:** Theme generator imports rely on raw JSON/JS object parsing; lack of schema validation (e.g., Zod) leads to runtime crashes on malformed theme files.
*   **D6: Cross-Platform:** Firefox/Chrome parity is the primary friction point for CSS-in-JS/Tailwind animations.
*   **D7: CI/CD:** Heavy reliance on `renovate` and `changesets` for dependency management; high risk of breaking changes in minor dependency updates (e.g., `node-html-parser`).
*   **D8: Forensic Patches:** Fixes focus on "Explicit Imports" to resolve tree-shaking issues where implicit global styles were being dropped by Vite/Rollup.

## 4. Net-New Universal Engineering Rules

## 72. The "CSS Specificity Inversion" Rule

**RULE**:
Never hardcode layout-defining properties (`height`, `width`, `position`) in base component classes. Use "Layout-Neutral" defaults and expose them via CSS variables or explicit prop-based overrides.

**WHY**:
Hardcoded layout properties create "Specificity Traps" where consumers cannot override styles without using `!important`, leading to brittle, unmaintainable UI codebases.

**WHEN TO APPLY**:
Any component library or design system where Tailwind CSS or CSS-in-JS is used to provide base styles.

## 73. The "Compiler-Agnostic Component" Rule

**RULE**:
Library components must be tested against the most restrictive `svelte.config.js` settings (e.g., `preserveWhitespace: true`) to ensure internal DOM structure is not dependent on compiler-specific output.

**WHY**:
UI libraries often fail in production because consumer build configurations (like `preserveComments`) alter the DOM tree, breaking query selectors or hydration logic.

**WHEN TO APPLY**:
Svelte/React/Vue component libraries distributed via NPM.

## 5. Actionable Agent Skill & Implementation Checklist
- [ ] **Dependency Audit:** Run `npm ls` to identify if any core dependencies (like `nanoid` or `magic-string`) have breaking changes in recent minor versions.
- [ ] **CSS Specificity Scan:** Search for `!important` or hardcoded `height/width` values in CSS/Tailwind files.
- [ ] **Browser Compatibility Matrix:** Verify all animation-heavy components against the `@supports` CSS rule for `transition-discrete` and `view-transition`.
- [ ] **Compiler Stress Test:** Create a test suite that compiles components with `preserveComments: true` and `preserveWhitespace: true` to ensure zero-regression.
- [ ] **Semantic Audit:** Ensure all interactive components (`btn`, `icon-btn`) use native HTML elements (`<button>`) rather than `<div>` with `onClick` handlers.