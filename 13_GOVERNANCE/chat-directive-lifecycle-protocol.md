# Chat-Directive Learning Lifecycle Protocol: Staging, Cross-Project Trigger, and Canonical Promotion

> **Authority**: AI-Builder-Brain Governance (`13_GOVERNANCE/chat-directive-lifecycle-protocol.md`)  
> **Status**: Mandatory Canonical Invariant  
> **Purpose**: Solves the fundamental tension between Tier-1 Human Directives given in chat and the Master Brain Invariant: *"Verify before promotion / Do not treat unverified statements as canonical truth"*.

---

## 1. The Core Governance Dilemma

1. **Tier-1 Human Directives**:
   - The user provides high-level architectural mandates, failure autopsies, and strategic rules directly in chat prompts.
   - These represent sovereign human intent and expert system requirements.
2. **The Verification Invariant (Rule 6 & Brain Evolution Protocol)**:
   - The Master Brain must NEVER blindly dump unverified claims directly into permanent core law without empirical proof (compiler exits, live runtime HTTP probes, search engine contract validations).
3. **The Risk of Lost Intelligence & Repetitive AI Cycles**:
   - If chat directives are only discussed in conversation, they vanish upon context reset.
   - The AI repeatedly audits, changes code arbitrarily ("baar baar bigadta h sudarta h"), re-extracts the same lessons, and wastes critical time.

---

## 2. The 4-Stage Chat-Directive Lifecycle

To ensure complete harmony between human directives and empirical truth, all chat-provided learnings must traverse this deterministic lifecycle:

```
                  [USER CHAT DIRECTIVE / MASTER PROMPT]
                                    │
                                    ▼
       ┌─────────────────────────────────────────────────────────┐
       │ STAGE 1: INGESTION & CANDIDATE REGISTRATION             │
       │ Store in 11_INBOX/candidate-directives/                 │
       │ Catalog in 11_INBOX/candidate-directives-registry.json  │
       │ Status: PROPOSED_CANDIDATE_DIRECTIVE                    │
       └────────────────────────────┬────────────────────────────┘
                                    │
                                    ▼ (Triggered by tags, error codes, domain)
       ┌─────────────────────────────────────────────────────────┐
       │ STAGE 2: CROSS-PROJECT TRIGGER & BRIDGE BINDING         │
       │ When any project bootstrap, SEO audit, or bugfix starts │
       │ Brain Bridge loads active candidate directives          │
       │ Injects as active test constraint in project workspace  │
       └────────────────────────────┬────────────────────────────┘
                                    │
                                    ▼ (Compiler passes, runtime probes, HTTP 200)
       ┌─────────────────────────────────────────────────────────┐
       │ STAGE 3: EMPIRICAL VERIFICATION & PROOF                 │
       │ Project executes build, tests edge cases, verifies gate │
       │ Generates empirical evidence (logs, diffs, test passes) │
       │ Status: EMPIRICALLY_VERIFIED                            │
       └────────────────────────────┬────────────────────────────┘
                                    │
                                    ▼ (Controlled Promotion Protocol)
       ┌─────────────────────────────────────────────────────────┐
       │ STAGE 4: PERMANENT CANONICAL INJECTION & CLEANUP        │
       │ Codify in 01_CORE/, 05_KNOWLEDGE/, 03_SKILLS/, 08_VERIF │
       │ Retire staging draft (mark PROMOTED_CANONICAL_ACTIVE)   │
       │ Single Source of Truth maintained; zero redundant waste │
       └─────────────────────────────────────────────────────────┘
```

---

## 3. Stage Specifications

### Stage 1: Ingestion & Candidate Staging (`11_INBOX/candidate-directives/`)
- When the user directs learning insertion via chat prompt:
  - Generate an authoritative candidate file: `11_INBOX/candidate-directives/CD-[ID]-[slug].md`.
  - Register entry in `11_INBOX/candidate-directives-registry.json` with:
    - `id`: Unique directive identifier (`CD-001`, etc.).
    - `directive_title`: Human-readable summary.
    - `trigger_tags`: Keywords, domains, and failure signatures (e.g. `["multilingual", "seo", "gsc_451", "gsc_254"]`).
    - `status`: `PROPOSED_CANDIDATE` | `ACTIVE_TESTING` | `PROMOTED_CANONICAL_ACTIVE`.
    - `verification_criteria`: Concrete falsification tests.

### Stage 2: Cross-Project Trigger & Bridge Binding
- Whenever any child project is bootstrapped or an agent encounters related issues in an active workspace:
  - The agent queries `candidate-directives-registry.json`.
  - If project scope or error logs match any `trigger_tags` (e.g., GSC 451/254/48 errors, multi-language expansion), the candidate directive is **automatically bound** as an active requirement.

### Stage 3: Empirical Verification & Invariant Proof
- The project implements the architecture dictated by the directive.
- Real compiler, build system, link checker, and headless runtime execute:
  - Static bundle build (`npm run build`) exits 0.
  - Zero canonical-sitemap contradictions.
  - Reciprocal alternate links fully verified.
  - Verification gates pass cleanly.

### Stage 4: Permanent Canonical Injection & De-Duplication Cleanup
- Once verified on real project artifacts:
  - The directive is promoted into:
    1. **Core Law**: `01_CORE/operating-rules.md`
    2. **Reusable Engineering Pattern**: `05_KNOWLEDGE/engineering-patterns.md`
    3. **Cross-Cutting Skill**: `03_SKILLS/`
    4. **Mandatory Certification Gate**: `08_VERIFICATION/project-ready-certification-protocol.md`
  - **De-Duplication & Anti-Waste Cleanup**:
    - The staging record in `11_INBOX/candidate-directives-registry.json` is marked `PROMOTED_CANONICAL_ACTIVE` with links to canonical files.
    - AI agents will never treat promoted directives as unlearned or re-extract duplicate patterns from scratch.
    - Eliminates redundant multi-turn questioning and protects developer velocity.

---

## 4. Invariant Rules of this Protocol

1. **Zero Blind Promotion**: A raw chat prompt is never directly stamped as an empirically verified rule without attaching a verification model or candidate lifecycle.
2. **Zero Lost Directives**: A user directive in chat must never be discarded as ephemeral; it is immediately registered in `11_INBOX/candidate-directives/`.
3. **Immediate Auto-Activation**: When a project exhibits the problem described in a candidate directive, the AI MUST pull and apply the candidate solution rather than improvising ungrounded trial-and-error fixes.
4. **Single Source of Truth**: Once promoted to Master Brain canon, the core files serve as the permanent reference. Staging records remain strictly as historical provenance pointers.
