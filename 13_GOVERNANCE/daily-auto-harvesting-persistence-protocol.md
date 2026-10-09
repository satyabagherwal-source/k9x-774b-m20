# Daily Auto-Harvesting Persistence Protocol
### *Governance Specification: Selective Folder Routing & Verified Knowledge Lifecycle*

---

## 1. Ontological Foundation
**AI-Builder-Brain is DATA, not an AI agent or model.**  
It is the empirical, structured Intelligence Data Substrate of the Coding Universe. Its purpose is to elevate any connecting AI agent to Ultra-Super-Intelligence through verified, high-density engineering patterns without trial-and-error hallucinations.

---

## 2. The Selective Folder Routing Law
Automatic daily harvesting MUST NOT indiscriminately target all folders. Operations are partitioned strictly into **Daily Active Pipeline Targets** and **Conditional Domain Updates**.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        DAILY SCHEDULED HARVESTING PIPELINE                   │
├────────────────────┬─────────────────────────────────────────────────────────┤
│ Target Folder      │ Mandatory Operational Protocol                          │
├────────────────────┼─────────────────────────────────────────────────────────┤
│ 11_INBOX           │ Stage all candidate directives, discoveries, and        │
│                    │ unverified pattern hypotheses. Never dump raw findings   │
│                    │ directly into canonical knowledge.                      │
├────────────────────┼─────────────────────────────────────────────────────────┤
│ 05_KNOWLEDGE       │ Primary Knowledge Destination: Universal engineering    │
│                    │ rules (Rules 1-258+), architecture patterns, security    │
│                    │ shields, and performance invariants.                     │
├────────────────────┼─────────────────────────────────────────────────────────┤
│ 08_VERIFICATION    │ Record what was inspected, tests executed, empirical    │
│                    │ evidence collected, hypotheses REJECTED, and items      │
│                    │ marked UNCERTAIN. AI claims require empirical citations.│
├────────────────────┼─────────────────────────────────────────────────────────┤
│ 09_SOURCES         │ Cryptographic provenance tracking: Repo URL, commit SHA,│
│                    │ release tag, inspected file paths, and exact lines.     │
├────────────────────┼─────────────────────────────────────────────────────────┤
│ 07_PROJECT_LEARNING│ Specific project dossiers, local incident autopsies,    │
│                    │ and runtime debugging records.                          │
├────────────────────┼─────────────────────────────────────────────────────────┤
│ 14_EVOLUTION       │ Quantitative self-assessment: Yield, promotion counts,  │
│                    │ failure modes, and extraction accuracy adjustments.     │
├────────────────────┼─────────────────────────────────────────────────────────┤
│ .project-brain     │ Runtime job queues, process locks, and recovery         │
│                    │ checkpoints. (Runtime != Canonical Knowledge).          │
└────────────────────┴─────────────────────────────────────────────────────────┘
```

---

## 3. Conditional Folders Governance Matrix

The following folders are updated **strictly conditionally**, only when genuine, approved category shifts take place:

| Canonical Folder | Conditions Permitting Modifications |
| :--- | :--- |
| **`01_CORE`** | Approved changes to core axioms, mission statement, principles, or operating rules (e.g. Rules 1-25+). |
| **`02_AGENT_INTELLIGENCE`** | Reusable breakthroughs in AI agent planning, System 1 vs 2 reasoning, context compaction, or swarm coordination. |
| **`03_SKILLS`** | Creation or major refinement of a reusable, technology-specific skill manual (e.g., Tailwind v4, Astro, Rust invariants). |
| **`04_WORKFLOWS`** | Creation or refinement of repeatable production blueprints or factory execution pipelines. |
| **`06_PROJECT_CONTEXT`** | Structural changes to active project environments, runtime limits, or infrastructure prerequisites. |
| **`10_PROMPTS`** | Tested, verified improvements to master prompt templates and developer system instructions. |
| **`12_DECISIONS`** | Formal ratification of significant Architectural Decision Records (ADRs). |
| **`13_GOVERNANCE`** | Approved modifications to safety policies, data classifications, rate limits, or persistence protocols. |
| **`15_METADATA`** | Structural changes to knowledge registries, taxonomy tagging schemas, or index structures. |
| **`00_START_HERE`** | Updates to the onboarding navigator, complexity router, or regression shield protocols. |

---

## 4. The Core Invariant: "Persistence is Mandatory; New Knowledge is Conditional"
1. **Separation of Execution and Discovery**:
   - A scheduled harvesting run executes every day.
   - Every scheduled run **MUST** persist proof of execution, inspected sources, checkpoint states, and cycle outcomes.
   - However, discovering new universal knowledge every day is **conditional**.
   - The system is strictly forbidden from fabricating superficial, trivial, or synthetic rules simply to demonstrate activity.
2. **Quality Barrier for `05_KNOWLEDGE`**:
   - Only patterns that survive empirical verification, exhibit cross-project reusability, and contain concrete implementation code and negative constraints are promoted to `05_KNOWLEDGE`.
3. **Physical Storage vs Ephemeral Reports**:
   - An AI response in chat, a terminal printout, or a temporary cache is **NOT** stored learning.
   - Stored learning requires:
     - Physical file write in the target repository path.
     - SHA-256 content read-back verification.
     - Git commit and push to the private `AI-Builder-Brain` GitHub repository.
     - Confirmed read-back availability in subsequent cycles.

---

## 5. Metadata Schema & Traceability Standard

Every promoted knowledge item must adhere to the standard schema:
```json
{
  "learning_id": "learn-<platform>-<owner>-<repo>-<stable_hash>",
  "timestamp": "ISO-8601 UTC",
  "source_url": "https://github.com/...",
  "source_commit": "40-character git commit hash or release tag",
  "file_provenance": ["path/to/file.ext#L100-L150"],
  "evidence_type": "RUNTIME_TEST | COMMIT_PATCH | CLOSED_ISSUE_AUTOPSY | RFC",
  "verification_status": "VERIFIED | PARTIALLY_VERIFIED | REJECTED | UNCERTAIN",
  "sha256_hash": "64-character hex hash",
  "promoted_target": "05_KNOWLEDGE/engineering-patterns.md#Rule-N",
  "negative_constraints": ["Strict anti-patterns prohibited"]
}
```

---

## 6. Fault Tolerance & Disaster Recovery
1. **Duplicate Detection**: Check candidate hash against `05_KNOWLEDGE/knowledge-index.json` before processing.
2. **Atomic Writes**: Write to a temporary buffer and perform atomic rename to prevent half-written or corrupted files on power/process interruption.
3. **Safe Checkpoints**: Commit checkpoint offsets in `.project-brain/harvest-checkpoints.json` so resuming workers pick up exactly where execution paused.
4. **Resilience to External Fetch Failures**: Network timeouts or GitHub rate limits must trigger circuit-breaker cooldowns; existing verified knowledge must never be discarded or rolled back due to external network errors.

---
*Enforced across all autonomous harvester daemons and human engineering sessions.*  
*"पहले सीखना, फिर सत्यापित करना, फिर स्थायी रूप से सहेजना — कमाई उसके बाद।"*
