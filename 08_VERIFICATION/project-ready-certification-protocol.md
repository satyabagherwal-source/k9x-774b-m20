# Universal Environment & Product Ready Multi-Pillar Certification Protocol

> **Canonical reference**: `AI-Builder-Brain/08_VERIFICATION/project-ready-certification-protocol.md`  
> **Purpose**: Mandatory verification gatekeeper that evaluates child projects across dynamic live pillars. Enforces strict boundary between Phase A (Environment Ready) and Phase B (Product Ready).

---

## 🔒 Two-Phase Certification Separation

1. **PHASE A: ENVIRONMENT READY : CERTIFIED** (`ENVIRONMENT_READY_CERTIFICATE.md`)
   - Issued by **Project Factory** upon initial bootstrap.
   - Certifies that runtime, frameworks, styling, Brain OS, testing infrastructure, and Git are fully verified.
   - **MANDATORY INVARIANT**: Zero product components, zero user-facing pages, zero business logic.
   - Verified via **Pillar 10: Product Generation Boundary**.

2. **PHASE B: PRODUCT READY : CERTIFIED** (`PRODUCT_READY_CERTIFICATE.md`)
   - Issued only after user explicitly requests feature/product development.
   - Certifies that requirements, components, business logic, UX, and domain features pass all functional tests and regression gates.

---

## 1. Dynamic Pillars Audit Table (Phase A — Environment)

| Pillar | Verification Gate | Pass Criteria |
|---|---|---|
| **1. Brain Bridge** | `.project-brain/brain-bridge.json` | Master Brain reachable, read-only enforced, selective indexing |
| **2. System Environment** | Node.js, npm, Git, tools | Required tools present, zero fatal missing dependencies |
| **3. Project Governance** | All 11 Project Brain OS files | All 11 files present and non-empty, plus `.project-brain` subdirs |
| **4. Architecture & Config** | Framework config + CSS-first styling | Valid config file (Astro/Vite) and Tailwind v4 @theme tokens |
| **5. Build Integrity** | Static production bundle | `npm run build` exits 0, `dist/index.html` generated |
| **6. Runtime Probe** | Dev / API server on isolated port | HTTP 200 OK within 15 seconds, clean shutdown |
| **7. Environment Quality** | Baseline environment contract | Web: Clean HTML5 shell & CSS; AI: Health API endpoint |
| **8. Git Repository** | Local repository & initial commit | Repo initialized, clean tree, initial commit created |
| **9. MCP Health** | Configured MCP servers | Verified connection or safe offline fallback active |
| **10. Product Boundary** | ZERO product components / pages | 0 files in components (except .gitkeep), 0 extra pages, 0 business logic |

---

## 2. Certification Status Levels

- **ENVIRONMENT STATUS: ENVIRONMENT READY : CERTIFIED**  
  All critical gates pass cleanly, including 0 product code. Development environment is ready for Phase B product development.
- **ENVIRONMENT STATUS: PARTIAL**  
  Core build and runtime succeed; non-blocking auxiliary items (e.g. GitHub auth or offline Master Brain fallback) noted.
- **ENVIRONMENT STATUS: BLOCKED**  
  Fatal blocker detected:
  - Toolchain missing or failed build / runtime server crash.
  - **FACTORY BOUNDARY VIOLATION**: Product code or business logic detected during environment bootstrap.

---

## 3. Dynamic Pillars Audit Table (Phase B — Product Ready)

| Pillar | Verification Gate | Pass Criteria |
|---|---|---|
| **11. Feature & Domain Logic** | Functional component & tool test suite | All interactive tools, transformations, and user workflows execute with zero errors |
| **12. Dual-Theme & Viewports** | Mobile (320px) + Desktop (1280px+) | Dark & Light modes maintain $\ge 7:1$ contrast; zero horizontal scroll or badge clipping |
| **13. Language Completeness Gate** | `verify-language-completeness` assertion | **MANDATORY**: Expected languages $N \equiv$ Generated languages $M$. Zero missing language variants. Translation, SEO, URL, Hreflang, Sitemap, UI, and Error completeness all pass 100%. If $M < N$, `PRODUCT READY = FAIL` |
| **14. Multilingual SEO Quadrant** | Zero-Contradiction Graph audit | $\text{Canonical} \equiv \text{Sitemap} \equiv \text{Hreflang} \equiv \text{Internal Links}$. 100% self-canonicals, full reciprocal hreflang + x-default. Zero 451 redirects, zero 404s, zero 254 thin content |
| **15. A11y & Structured Data** | WCAG AA/AAA + Schema validator | Valid JSON-LD Schema per locale; semantic HTML; localized aria-labels and alt text |
| **16. Production Build & Probe** | Static production bundle & HTTP probe | `npm run build` exits 0 with zero runtime exceptions; all localized routes return HTTP 200 OK |

