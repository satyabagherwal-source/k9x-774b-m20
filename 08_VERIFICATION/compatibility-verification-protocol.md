# Ecosystem Compatibility Verification Protocol

## 1. Purpose
Define the mandatory verification gate before any external technology update (Astro, Tailwind CSS, Vercel, Node.js, TypeScript) is adopted into the Project Factory golden template or promoted into Master Brain knowledge.

---

## 2. Compatibility Test Matrix

| Layer | Test Item | Verification Tool / Command | Pass Criteria |
|---|---|---|---|
| **L1: Syntax & Config** | Config schema compatibility | Module import & AST parse test | Valid configuration, zero deprecation warnings |
| **L2: Static Build** | Production bundle compilation | `npx astro build` / `npm run build` | Exit code 0, complete `dist/` bundle |
| **L3: Server Runtime** | Local dev server startup & HTTP response | Automated socket HTTP probe on isolated port | HTTP 200 OK within 15 seconds |
| **L4: Design & Style** | CSS token compilation & utilities | Inspect compiled CSS in `dist/_astro/*.css` | All `@theme` tokens present, zero uncompiled raw directives |
| **L5: SEO & HTML5** | Meta tags, canonical URLs, viewport | DOM regex inspection on `dist/index.html` | Title, description, canonical link intact |
| **L6: Bundle Budget** | Output payload size | File size check on JS/CSS assets | No unexpected bundle ballooning (>100KB on Zero-JS pages) |

---

## 3. Compatibility Outcomes

- **PASS_FULL**: All 6 layers pass cleanly. Safe for automatic adoption.
- **PASS_WITH_WARNING**: Builds succeed, but minor non-breaking deprecations detected. Adapter update recommended.
- **FAIL_BLOCKING**: Build failure, runtime crash, broken CSS tokens, or missing HTML output. External version is marked `INCOMPATIBLE` in Source Registry until an adapter is developed and verified.
