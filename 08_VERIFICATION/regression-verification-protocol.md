# Zero-Regression Verification Protocol

> Canonical reference: `AI-Builder-Brain/08_VERIFICATION/regression-verification-protocol.md`  
> Purpose: Enforces strict non-destructive verification standards to ensure bug fixes, optimizations, or new features never regress existing working capabilities.

---

## 1. The Non-Destructive Invariant

When tasked with resolving an issue (such as fixing SEO, internationalization, routing, or performance), the agent must adhere to the **Strict Non-Destructive Invariant**:

> **RULE**: Core domain logic, floating-point geometry, canvas transformations, visual layout aesthetics, AdSense viewability containers, and existing test suites MUST NOT be altered as a collateral side-effect of infrastructure changes.

---

## 2. Regression Verification Pipeline

Before marking any task or bug fix complete:

```
[ Pre-Change Baseline ] (Verify existing build & tests pass)
          ↓
[ Surgical In-Place Patch ] (Minimal edits, zero unrelated refactors)
          ↓
[ Layer 1: Build Compilation ] (`npm run build` exits 0)
          ↓
[ Layer 2: Test Suite Execution ] (`npm test` passes 100%)
          ↓
[ Layer 3: Visual & DOM Integrity ] (Inspect compiled `dist/` HTML & CSS)
          ↓
[ Layer 4: Invariant Audit ] (Verify math functions & ad slots untouched)
          ↓
[ Task Completion Sign-off ]
```

---

## 3. High-Risk Areas Requiring Special Invariant Guards

1. **Canvas & Mathematical Transformations**:
   - Never modify coordinate scaling, origin offsets, or event listeners during layout or styling adjustments.
2. **AdSense Slots & Zero-CLS Wrappers**:
   - Never remove explicit aspect ratios or minimum height containers (`min-h-[250px]`).
3. **i18n Dictionaries & Dynamic DOM Hydration**:
   - Ensure localized labels in SSR HTML (`data-label`) are not overwritten with English template literals during client hydration.
4. **Canonical URLs & Trailing Slashes**:
   - Ensure changes do not break trailing slash consistency between `astro.config.mjs`, sitemaps, and canonical link tags.
