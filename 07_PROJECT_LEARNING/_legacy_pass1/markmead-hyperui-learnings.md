> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/markmead-hyperui-learnings.md`  
> **Source**: GitHub ([https://github.com/markmead/hyperui](https://github.com/markmead/hyperui))  
> **Synthesized By**: Google Gemini Server-to-Server Autonomous AI Agent  
> **Timestamp**: 2026-09-29T07:47:11.055Z  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  

---

# Forensic Learning Record: markmead/hyperui

## 1. Executive Forensic Architecture & System Mechanics
HyperUI functions as a **Static-to-Dynamic Component Registry**. It bridges the gap between static HTML/Tailwind source code and interactive browser-based previews. The architecture relies on **Astro Collections** for content management and an **Iframe-based Sandbox** for component rendering. The system's primary technical challenge is the **"Serialization Gap"**: maintaining the integrity of raw HTML strings while they are injected into iframes, manipulated by browser-side scripts (like Cloudflare injection), and eventually extracted back to the user's clipboard.

## 2. Deep Micro-Learnings & Runtime Gotchas
*   **The "Injected Script" Contamination**:
    *   **Pitfall**: Third-party scripts (Cloudflare/Analytics) injected into the `iframe` document are captured during "Copy HTML" operations.
    *   **Root Cause**: Accessing `iframe.contentDocument.body.innerHTML` captures the *live* DOM, including runtime-injected nodes.
    *   **Prevention**: Always source "Copy" content from a static build-time file or a sanitized `data-attribute` payload, never the live `iframe` DOM.
*   **DOM Serialization Loss**:
    *   **Pitfall**: Self-closing tags (e.g., `<input />`) lose their trailing slash when processed via `innerHTML`.
    *   **Root Cause**: Browser DOM parsers normalize HTML; `innerHTML` does not guarantee original source formatting.
    *   **Prevention**: Use a dedicated library like `prettier` or `html-beautify` on the raw string before display, or store the raw source as a separate string property in the collection.
*   **RTL Layout Fragility**:
    *   **Pitfall**: Physical CSS properties (`left`, `right`, `margin-left`) break in RTL contexts.
    *   **Root Cause**: Over-reliance on physical directionality instead of logical properties (`inset-inline`, `margin-inline`).
    *   **Prevention**: Enforce a linting rule (e.g., `tailwindcss-logical`) to forbid physical properties in component templates.
*   **Collection Slug Collisions**:
    *   **Pitfall**: Renaming categories causes build-time failures or broken links.
    *   **Root Cause**: Astro collections rely on file-system paths for routing; renaming files without a redirect/mapping layer breaks existing slugs.
    *   **Prevention**: Decouple the `slug` from the file system path using a frontmatter `slug` field in the collection schema.

## 3. 8-Dimensional Multi-Axis Forensic Analysis
*   **D1: Structural Boundaries**: Uses Astro Collections to isolate component categories, preventing cross-contamination of styles.
*   **D2: Asynchronous State**: The "Copy" functionality is a synchronous operation on an asynchronous DOM state; the failure was attempting to read the state before the iframe had fully stabilized.
*   **D3: Error Boundaries**: The system lacks a robust "Preview Recovery" mechanism, leading to the removal of features (code-view toggle) when the iframe state becomes unstable.
*   **D4: Resource Lifecycle**: The iframe acts as a transient resource; failure to clear it properly leads to memory pressure and script leakage.
*   **D5: Boundary Deserialization**: The "Copy HTML" feature is a classic serialization bug where the *representation* (DOM) is treated as the *source* (HTML string).
*   **D6: Cross-Platform**: RTL bugs highlight the difference between visual layout (LTR) and logical layout (RTL).
*   **D7: Build/CI/CD**: Dependency on `devalue` and `astro` requires strict version pinning to prevent hydration mismatches.
*   **D8: Forensic Patches**: The shift from "Live Iframe Capture" to "Build-time File Sourcing" is the definitive architectural fix for content integrity.

## 4. Net-New Universal Engineering Rules

## 72. The "Source-of-Truth" Serialization Invariant

**RULE**:
Never derive user-facing source code from a live, rendered DOM element. Always derive it from the immutable source string used to populate that DOM.

**WHY**:
Live DOMs are mutated by browser extensions, security injectors (Cloudflare), and framework hydration. Capturing `innerHTML` from a live node is a non-deterministic operation that leaks runtime environment artifacts into the user's clipboard.

**WHEN TO APPLY**:
Any system providing "Copy to Clipboard" for code snippets, templates, or configuration files.

## 5. Actionable Agent Skill & Implementation Checklist
- [ ] **Sanitization Check**: Does the "Copy" function read from a static variable or the live DOM? (Must be static).
- [ ] **Logical CSS Audit**: Scan for `left`, `right`, `margin-left`, `padding-right`. Replace with `inset-inline-start`, `margin-inline-start`.
- [ ] **Iframe Isolation**: Ensure iframes are sandboxed with `sandbox="allow-scripts"` and no access to the parent document's context.
- [ ] **Schema Validation**: Use Zod schemas for Astro collections to enforce mandatory fields (e.g., `dark: boolean`) to prevent rendering gaps.
- [ ] **Build-Time Verification**: Implement a test that compares the "Copy" output against the raw source file to ensure 1:1 parity.