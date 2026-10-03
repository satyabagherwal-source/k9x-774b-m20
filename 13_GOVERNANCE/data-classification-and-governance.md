# Data Classification & Connected Data Governance Policy

> **Canonical Location**: `13_GOVERNANCE/data-classification-and-governance.md`  
> **Status**: MANDATORY & ACTIVELY ENFORCED  
> **Purpose**: Establishes strict data classification tiers, outbound transmission gates, privacy protection standards, and Gmail/connected data handling rules for AI-Builder-Brain.

---

## 1. The 5 Data Classification Tiers

Every piece of data processed, stored, or transmitted by AI-Builder-Brain or its connected agents must be classified into one of the following five tiers:

| Tier | Classification | Definition & Examples | Outbound AI Policy |
|---|---|---|---|
| **Tier 1** | **`PUBLIC`** | Open-source codebases, public GitHub issues, public releases, official web documentation, package manifests. | **Allowed**: May be analyzed by external AI providers (Gemini, Claude, OpenAI, etc.). |
| **Tier 2** | **`PRIVATE`** | User-authored proprietary project code, internal business specifications, unreleased product architectures. | **Conditional**: Allowed only with explicit user authorization or when utilizing a locally hosted model (Ollama). |
| **Tier 3** | **`SENSITIVE`** | Personally Identifiable Information (PII): real user email addresses, phone numbers, personal identities, private correspondence. | **Redacted by Default**: Must be masked/redacted (`[REDACTED_EMAIL]`, etc.) prior to any external AI transmission. |
| **Tier 4** | **`CONFIDENTIAL`** | API keys, secret credentials (`.brain-secrets.json`, `.env`), private RSA/SSH keys, authentication tokens, passwords, financial details. | **STRICTLY PROHIBITED**: Hard-blocked by outbound pre-flight filters. Never sent to any external API under any circumstance. |
| **Tier 5** | **`THIRD-PARTY PERSONAL DATA`** | External developer email addresses, names, or contact data extracted from public Git commit headers (`Signed-off-by:`, `Co-authored-by:`), bug tracker user profiles. | **Sanitized at Ingestion**: Stripped/masked during harvesting before intelligence synthesis or long-term Brain storage. |

---

## 2. Outbound AI Transmission Pre-Flight Protocol

Before any payload is transmitted to an external AI API via `04_WORKFLOWS/factory-engine/ai-provider-pool.mjs`:

```
Outgoing Prompt Payload
           │
           ▼
[1. Confidential Credentials Scan] ─── (Matches Token/Key?) ──► [ABORT: Hard Block & Log]
           │ (Clean)
           ▼
[2. PII / Email Regex Masking] ─────── (Matches Emails/Phones?) ──► [Mask: [REDACTED_EMAIL]]
           │ (Sanitized)
           ▼
[3. Anti-Distillation System Header] ─► [Prepend Non-Distillation Retrieval Header]
           │
           ▼
[4. Dispatch to External AI Endpoint]
```

1. **Confidential Credentials Scan**:
   - The engine scans for known secret patterns (e.g. `AIzaSy...`, `sk-proj-...`, `ghp_...`, `-----BEGIN PRIVATE KEY-----`).
   - If a raw credential is detected in the prompt body, **the transmission is halted immediately** with an error.

2. **Personal Data & Email Scrubbing**:
   - Matches for standard email formats `([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})` are replaced with `[REDACTED_EMAIL]`.
   - Git author attribution lines are sanitized to retain only GitHub usernames or generic roles without personal contact details.

3. **System Governance Header**:
   - Outbound requests append the canonical disclaimer:
     `"This request is conducted exclusively for verified engineering knowledge retrieval under AI-Builder-Brain governance. Model outputs are never used to train, fine-tune, or distill an ML model."`

---

## 3. Gmail & Connected Private Data Governance

When interacting with Gmail, Google Workspace CLI, Google Drive, or any connected mailbox/communication MCP server:

### Principle of Minimum Necessary Data (Least Privilege)
- **Zero Bulk Mailbox Forwarding**: The agent must **NEVER** blindly fetch, dump, or forward an entire mailbox, inbox folder, or unread message queue into an AI prompt context.
- **Specific Query Scoping**: If the user requests an action concerning an email (e.g. "Find the invoice from X"), the query must target only the specific message ID, subject, or sender.
- **Field Minimization**: Extract only the minimum required fields (e.g. timestamp, specific order ID) rather than whole email bodies with full thread history.
- **Pre-Classification**: All connected data is classified as `SENSITIVE` or `CONFIDENTIAL` by default until explicitly tagged otherwise.
- **External Transmission Logging**: Every external transmission containing connected data must be logged in `.project-brain/transmissions.log` recording:
  - Timestamp
  - Destination AI provider
  - Purpose of transmission
  - Sanitization status
- **Zero Assumption of Safety**: Never assume that because an API token technically permits access (e.g., full Gmail read scope), the resulting data is safe to send to a third-party AI provider.
