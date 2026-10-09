# 11_INBOX — Candidate Learning Staging Ground
### *The Pre-Promotion Verification Buffer of AI-Builder-Brain*

---

## 1. Role in the Daily Harvesting Architecture
`11_INBOX` is the mandatory staging area for all incoming discoveries in every daily harvesting cycle.

> **The Sovereign Rule**:  
> **Never inject raw, unvetted, or duplicate candidate learnings directly into Master Knowledge (`05_KNOWLEDGE`).**  
> All discoveries from GitHub, commit diffs, closed issues, and chat directives must be staged here first until they pass empirical verification in `08_VERIFICATION`.

---

## 2. Directory Structure
```
11_INBOX/
├── README.md                           <- This operating specification
├── CANDIDATE_LEARNING_TEMPLATE.md      <- Standard template for staging new findings
├── candidate-directives/               <- Markdown files for individual candidate learnings
└── candidate-directives-registry.json  <- Machine-readable registry tracking candidate states
```

---

## 3. Candidate Lifecycle
1. **STAGE**: New discoveries written to `candidate-directives/CD-XXX-[slug].md`.
2. **VERIFY**: Empirical tests, commit inspection, or runtime proofs documented in `08_VERIFICATION/harvest-verification-matrix.md`.
3. **DECIDE**:
   - If verified & universal $\to$ Promote to `05_KNOWLEDGE/engineering-patterns.md`, mark status `PROMOTED_CANONICAL_ACTIVE`.
   - If project-specific $\to$ Route to `07_PROJECT_LEARNING/`, mark status `ROUTED_PROJECT_SPECIFIC`.
   - If flawed/disproven $\to$ Move to `08_VERIFICATION` rejected log, mark status `REJECTED`.
   - If unconfirmed $\to$ Keep in `11_INBOX` with status `NEEDS_MORE_EVIDENCE`.

---
*Maintained under Rule 25 (AI-BUILDER-BRAIN Daily Auto-Harvesting Persistence Rule).*
