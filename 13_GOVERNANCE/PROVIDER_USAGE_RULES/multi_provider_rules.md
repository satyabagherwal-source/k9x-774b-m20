# Multi-Provider AI Usage & Governance Policy

> **Canonical Location**: `13_GOVERNANCE/PROVIDER_USAGE_RULES/multi_provider_rules.md`  
> **Status**: MANDATORY & ACTIVELY ENFORCED  
> **Applies To**: All AI providers configured in `04_WORKFLOWS/factory-engine/ai-provider-pool.mjs` (Anthropic Claude, OpenAI, xAI Grok, MiniMax, Groq Free Tier, Hugging Face, and Local Ollama).

---

## 1. Universal AI Governance Invariant

Across all AI providers utilized by AI-Builder-Brain:

1. **No Competing Model Training or Distillation**:
   Outputs from Anthropic, OpenAI, xAI, MiniMax, Groq, or Google must **NEVER** be used to train, fine-tune, or distill an artificial intelligence model. The Brain is an engineering intelligence and natural language knowledge system, not an automated model distillation pipeline.
2. **No Cross-Provider Model Distillation**:
   Output from one provider (e.g. Anthropic Claude) must not be fed into another provider (e.g. Local Ollama) to fine-tune weights or create imitation models.
3. **No Safety Bypass**:
   System prompts must never include adversarial bypasses, automated jailbreaks, or attempts to circumvent provider content moderation filters.

---

## 2. Provider-Specific Policies & Architectural Boundaries

### 1. Anthropic (Claude 3.5 Sonnet / Claude 3.5 Haiku)
- **Policy Reference**: [Anthropic Commercial Terms of Service](https://www.anthropic.com/legal/commercial-terms) & [Usage Policy](https://www.anthropic.com/legal/aup).
- **Key Requirement**: Customer may not use outputs to build products that compete with Anthropic, or to train models without express authorization.
- **Architectural Usage**: Deep architectural refactoring analysis, type safety proofs, and complex concurrency invariants.

### 2. OpenAI (GPT-4o, GPT-4o-mini, o3-mini, Codex)
- **Policy Reference**: [OpenAI Business Terms](https://openai.com/policies/business-terms/) & [Usage Policies](https://openai.com/policies/usage-policies/).
- **Key Requirement**: Section 2(c)(iii): "You may not use output from the Services to develop models that compete with OpenAI."
- **Architectural Usage**: Fast schema extraction, code diff verification, and polyglot translation.

### 3. xAI (Grok-2)
- **Policy Reference**: [xAI Terms of Service](https://x.ai/terms).
- **Key Requirement**: Prohibition against unauthorized data mining and synthetic model distillation.
- **Architectural Usage**: Systems-level architectural cross-examination.

### 4. MiniMax AI (MiniMax-Text-01)
- **Policy Reference**: MiniMax API Platform Terms of Use.
- **Key Requirement**: Compliant commercial software engineering analysis.
- **Architectural Usage**: High-throughput document and codebase summarization.

### 5. Groq Free Tier (Llama 3.3 70B, Mixtral)
- **Policy Reference**: [Groq Terms of Service](https://groq.com/terms-of-use/).
- **Key Requirement**: Adherence to rate limits (free tier fair use) and Meta Llama 3 Community License conditions.
- **Architectural Usage**: Ultra-fast low-latency code pattern extraction.

### 6. Local Ollama (Local Self-Hosted Foundation Models)
- **Architecture**: 100% offline, local machine execution (`http://localhost:11434`).
- **Privacy Boundary**: Zero network packets leave the machine. Zero external API quotas burned.
- **Usage**: Unlimited local verification, private codebase analysis, and fallback when all cloud providers are resting on rate limits.

---

## 3. Data Protection & Transmission Controls

All provider calls passing through `ai-provider-pool.mjs` must enforce:
1. `CONFIDENTIAL` secrets blocking (API keys, private certificates, JWTs).
2. `SENSITIVE` personal data redaction (email addresses, phone numbers).
3. Attribution of the provider in the generated knowledge provenance record.
