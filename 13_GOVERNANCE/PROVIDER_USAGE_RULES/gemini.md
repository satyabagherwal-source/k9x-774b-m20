# Google Gemini AI Provider Usage & Governance Policy

> **Canonical Location**: `13_GOVERNANCE/PROVIDER_USAGE_RULES/gemini.md`  
> **Provider**: Google LLC (Google AI Studio & Google Cloud Vertex AI)  
> **Policy Check Date**: 2026-10-04  
> **Status**: MANDATORY & ACTIVELY ENFORCED  
> **Applies To**: All workflows, scripts, and agents interacting with Gemini models (`gemini-2.0-flash`, `gemini-1.5-flash`, `gemini-3.x`, etc.)

---

## 1. Official Terms & Policies Reference

All interactions with Google Gemini within the AI-Builder-Brain architecture are governed by the following authoritative policies:

1. **Google Terms of Service**:  
   👉 [https://policies.google.com/terms](https://policies.google.com/terms)
2. **Google Generative AI Additional Terms of Service**:  
   👉 [https://policies.google.com/terms/service-terms/generative-ai](https://policies.google.com/terms/service-terms/generative-ai)
3. **Google Generative AI Prohibited Use Policy**:  
   👉 [https://policies.google.com/terms/service-terms/generative-ai/use-policy](https://policies.google.com/terms/service-terms/generative-ai/use-policy)
4. **Google Cloud / AI Studio API Terms**:  
   👉 [https://ai.google.dev/gemini-api/terms](https://ai.google.dev/gemini-api/terms)

---

## 2. Core Architectural Invariants

### Invariant 1: Absolute Prohibition of ML Model Training & Distillation
Per Section 2 of the Google Generative AI Additional Terms of Service:
> *"You may not use the Services to develop machine learning models or related technology that compete with Google, or to train, fine-tune, or distill an artificial intelligence model."*

**Architectural Consequence for AI-Builder-Brain**:
- The Master Brain is strictly an **engineering intelligence, natural language documentation, and software design pattern retrieval system**.
- Gemini outputs must **NEVER** be collected, compiled, formatted, or stored as a dataset for training, fine-tuning, distilling, or validating any machine learning, deep learning, or foundation model.
- Brain learning consists of human-readable Markdown engineering rules, verified architecture patterns, failure mode autopsies, and diagnostic checklists.
- No automated pipeline within AI-Builder-Brain may output JSONL/HuggingFace datasets composed of Gemini responses for the purpose of model development.

### Invariant 2: Prohibition of Reverse Engineering & Model Imitation
Per Google Terms:
> *"You may not reverse engineer, decompile, or attempt to extract the source code, model weights, or underlying architectures of the Services."*

**Architectural Consequence for AI-Builder-Brain**:
- The Brain must not attempt to reconstruct model weights, logit distributions, or hidden representations.
- The Brain must not systematically prompt Gemini to recreate or imitate proprietary model behaviors.

### Invariant 3: Respect for Provider Safety Mechanisms
Per Google Prohibited Use Policy:
- The Brain must not attempt jailbreaks, prompt injections, safety filter bypasses, or obfuscation techniques.
- Content flagged or blocked by Gemini safety filters must be logged as a safety halt rather than routed through adversarial rephrasing.

### Invariant 4: Verified Knowledge over Synthetic Hallucination
- AI-generated text is **NEVER** accepted as automatic truth.
- Every claim, pattern, or rule formulated by Gemini must be traced back to empirical source code diffs, closed bug issues, or authoritative documentation before it can be promoted to `05_KNOWLEDGE/engineering-patterns.md`.
- Unverified inferences must remain in project learning or be marked as experimental hypotheses.

---

## 3. Data Governance & Outbound Transmission Boundaries

Before sending any prompt payload to the Google Gemini API:

1. **Classification Tier Check**:
   - **`PUBLIC`**: Permitted. Public open-source repository diffs, closed issue discussions, and official documentation may be sent to Gemini for forensic analysis.
   - **`PRIVATE`**: Prohibited without explicit, documented user authorization.
   - **`SENSITIVE`**: Developer emails, personal names, and communication threads must be **redacted** prior to API submission.
   - **`CONFIDENTIAL`**: Passwords, API tokens, private keys, and commercial trade secrets are **STRICTLY BLOCKED** from being sent to Gemini.
   - **`THIRD-PARTY PERSONAL DATA`**: Personal developer emails found in public Git commit headers (`Signed-off-by:`, `Co-authored-by:`) must be sanitized using regex pattern masking (`[REDACTED_EMAIL]`) prior to external transmission.

2. **Connected Data & Gmail Governance**:
   - If Google Workspace CLI, Gmail MCP, or private mailbox tools are connected:
     - The agent must **NEVER** forward entire mailboxes or unfiltered email streams to Gemini.
     - Only specifically requested, sanitized, non-confidential message bodies or metadata may be processed.
     - Every external transmission must be logged in `.project-brain/transmissions.log`.

---

## 4. Affected Brain Workflows & Components

| Component / File | Role | Architectural Safeguard Enforced |
|---|---|---|
| [`04_WORKFLOWS/gemini-cloud-server-to-server.md`](file:///c:/AI-Builder-Brain/04_WORKFLOWS/gemini-cloud-server-to-server.md) | Cloud Workflow Spec | Mandates compliance with this policy; explicitly prohibits model distillation. |
| [`04_WORKFLOWS/factory-engine/gemini-brain-agent.mjs`](file:///c:/AI-Builder-Brain/04_WORKFLOWS/factory-engine/gemini-brain-agent.mjs) | Analysis Engine | Injects non-distillation system header, validates empirical evidence citations, attaches provenance metadata. |
| [`04_WORKFLOWS/factory-engine/ai-provider-pool.mjs`](file:///c:/AI-Builder-Brain/04_WORKFLOWS/factory-engine/ai-provider-pool.mjs) | Network Dispatcher | Executes pre-flight outbound data classification, blocks confidential credentials, redacts personal emails. |
| [`.github/workflows/24-7-cloud-harvester.yml`](file:///c:/AI-Builder-Brain/.github/workflows/24-7-cloud-harvester.yml) | 24×7 Cloud Runner | Operates in free-tier compliance; passes only public repository code and diffs. |

---

## 5. Review & Audit Schedule

This policy must be reviewed:
- Quarterly against Google's published policy updates.
- Immediately whenever a new Gemini model generation (e.g. Gemini 3.x / 4.x) is adopted.
- Whenever new external data connectors (e.g. Gmail, Google Drive, Jira) are registered in `mcp-registry.json`.
