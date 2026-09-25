# Dynamic Knowledge & External Source Governance

## 1. Principle of Non-Blind Trust
External documentation, dependencies, framework releases, and best practices evolve continuously. The AI-Builder-Brain and all child systems MUST NEVER blindly trust or silently overwrite internal knowledge based solely on external changes.

All external knowledge updates must undergo:
1. **Source Authentication**: Sourced strictly from verified authoritative repositories, documentation portals, or standards bodies.
2. **Version & Revision Pinning**: Explicitly tagged with version, commit, or publication date.
3. **Impact & Invariant Analysis**: Evaluated for breaking changes against existing project invariants and Master Brain rules.
4. **Empirical Verification**: Validated through actual compiler, build, or runtime execution before canonical adoption.

---

## 2. The Three-Layer Separation of Knowledge

To prevent project-specific quirks from corrupting universal knowledge and to prevent upstream framework changes from destabilizing established projects, knowledge is segregated into three strictly bounded layers:

```
[Layer 1: External Canonical Sources]
 (Official docs: Astro, Tailwind, Vercel, Node, W3C)
                  │
                  ▼ (Controlled Ingestion & Validation)
[Layer 2: AI-Builder-Brain & Project Factory]
 (Central Governance, Architecture Patterns, Automation Adapters)
                  │
                  ▼ (Selective Bridge Binding)
[Layer 3: Individual Project Context & Rules]
 (Local project-specific domain rules, state, and verified incidents)
```

### Invariant Rules Across Layers:
- **Rule 1 (Downstream Isolation)**: A local fix or workaround in Layer 3 must NEVER automatically mutate Layer 2 or Layer 1. It must follow the Evidence-Based Promotion Protocol.
- **Rule 2 (Upstream Gating)**: A version release in Layer 1 must NEVER silently auto-mutate existing Layer 3 projects without passing Layer 2 compatibility verification.
- **Rule 3 (Zero-Copy Core)**: Layer 3 projects access Layer 2 via lightweight bridges (`brain-bridge.json`), preventing repository bloat and knowledge fragmentation.

---

## 3. Freshness & Drift Management

1. **Documentation Drift**: Framework documentation may alter recommended practices (e.g. Tailwind v3 JS config to Tailwind v4 CSS-first `@theme`). The system must detect when existing guidance contradicts official current documentation.
2. **Dependency Knowledge Drift**: APIs become deprecated or modified across minor/major semver changes. Knowledge records must specify exact version applicability (e.g., `Astro >= 5.0.0`, `Tailwind CSS >= 4.0.0`).
3. **Audit Frequency**: External source registries should be checked periodically or during project bootstrap to maintain current awareness without disrupting deterministic builds.
