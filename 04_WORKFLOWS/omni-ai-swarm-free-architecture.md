# Omni-AI Swarm & Free Multi-Provider Architecture (AI-Builder-Brain)

This architecture unleashes an autonomous **Multi-AI Swarm** combining **5 Google Gemini Subscriptions** alongside 100% free external AI providers (Groq, Hugging Face, GitHub Models) to scour the entire internet 24/7 without spending a single rupee or dollar ($0.00 Cost Guarantee).

---

## 1. High-Level Swarm Topology

```
+---------------------------------------------------------------------------------------------------+
|                     OMNI-AI SWARM & INTERNET WIDE-SPECTRUM SCOUT ENGINE                           |
|                            (Strict Zero-Cost Guarantee: $0.00)                                    |
+---------------------------------------------------------------------------------------------------+
                                                  |
     +-------------------+--------------------+---+--------------------+--------------------+
     |                   |                    |                        |                    |
     v                   v                    v                        v                    v
[Agent Alpha]       [Agent Beta]         [Agent Gamma]            [Agent Delta]        [Agent Epsilon..]
 Domain: AI-Agents   Domain: Fullstack    Domain: High-Perf        Domain: HF-Models    Domain: Mobile & Cloud
     |                   |                    |                        |                    |
     +-------------------+--------------------+---+--------------------+--------------------+
                                                  |
                                                  v
                   +--------------------------------------------------------------+
                   |           AUTONOMOUS MULTI-KEY LOAD BALANCER & POOL          |
                   |               (04_WORKFLOWS/factory-engine/...)              |
                   +--------------------------------------------------------------+
                                                  |
              +-----------------------------------+-----------------------------------+
              |                                                                       |
              v                                                                       v
+-------------------------------+                                       +-------------------------------+
|      GOOGLE GEMINI POOL       |                                       |     FREE SECONDARY POOL       |
|    (5 Subscription Accounts)  |                                       |       (100% Free Tiers)       |
+-------------------------------+                                       +-------------------------------+
| • Gemini Key 1 (Primary)      |                                       | • Groq (Llama 3.3 70B Free)   |
| • Gemini Key 2 (Auto-Failover)|                                       | • GitHub Models (Free Token)  |
| • Gemini Key 3 (Load-Balanced)|                                       | • Hugging Face Inference API  |
| • Gemini Key 4 (High-Through) |                                       | • Strict $0.00 Enforcement    |
| • Gemini Key 5 (Continuous)   |                                       |                               |
+-------------------------------+                                       +-------------------------------+
              |                                                                       |
              +-----------------------------------+-----------------------------------+
                                                  |
                                                  v
                               +-------------------------------------+
                               | Deep Forensic Synthesis (D1 - D8)   |
                               | (Micro-Bugs + Macro-Architecture)   |
                               +-------------------------------------+
                                                  |
                                                  v
                               +-------------------------------------+
                               | Atomic Rebase-Retry Push Barrier    |
                               | (Master Brain: 0 Git Conflicts)     |
                               +-------------------------------------+
```

---

## 2. The 8 Internet Technology Frontiers

The Swarm scours the whole internet across 8 distinct technology horizons:

1. **`ai-agents`**: Autonomous agent frameworks, tool-use engines, memory abstractions, MCP servers.
2. **`fullstack-ui`**: Next-gen design systems, React 19, Next.js, Astro, Tailwind CSS, accessible components.
3. **`high-perf-systems`**: Compilers, memory virtualizers, async runtimes, CLI proxies in Rust/Zig/Go.
4. **`huggingface-ai-models`**: Top trending open-weight models, reasoning architectures, tokenizers.
5. **`mobile-cross-platform`**: Flutter, React Native, Swift, Kotlin native architectures.
6. **`devops-cloud-infrastructure`**: Kubernetes controllers, Docker engines, edge workers, Terraform patterns.
7. **`cybersecurity-defenses`**: Zero-trust networking, cryptography, token auth guards, sanitization.
8. **`database-storage-engines`**: High-throughput storage, vector databases, cache cluster eviction.

---

## 3. How to Configure Your 5 Gemini Keys + Free Providers

You can configure all 5 keys locally in `.brain-secrets.json` and in GitHub Repository Secrets.

### Step 1: Local Configuration (.brain-secrets.json)
Edit [.brain-secrets.json](file:///c:/AI-Builder-Brain/.brain-secrets.json) (this file is gitignored and 100% private):

```json
{
  "GEMINI_KEYS": [
    "AIzaSy...Your_Gemini_Key_1",
    "AIzaSy...Your_Gemini_Key_2",
    "AIzaSy...Your_Gemini_Key_3",
    "AIzaSy...Your_Gemini_Key_4",
    "AIzaSy...Your_Gemini_Key_5"
  ],
  "GROQ_KEYS": [
    "gsk_...Your_Free_Groq_Key_Optional"
  ],
  "HF_TOKEN": "hf_...Your_Free_HF_Token_Optional"
}
```

### Step 2: GitHub Repository Secrets Configuration (For 24/7 Cloud Swarm)
In GitHub Repository Secrets ([Settings > Secrets](https://github.com/satyabagherwal-source/AI-Builder-Brain/settings/secrets/actions)):
- Add `GEMINI_KEY_1`, `GEMINI_KEY_2`, `GEMINI_KEY_3`, `GEMINI_KEY_4`, `GEMINI_KEY_5`
- Or simply put them comma-separated in `GEMINI_API_KEY`.

---

## 4. Zero-Cost Protection Policy ($0.00 Invariant)

1. **Hardcoded Free Tier Guard**: The dispatcher strictly restricts outgoing calls to:
   - Google AI Studio Free Tiers (15 RPM / 1M TPM / 1500 RPD per key $\times 5 = 7,500$ free requests/day!).
   - Groq Free Tier (Llama 3.3 70B).
   - GitHub Models with standard `GITHUB_TOKEN`.
2. **Key Rotation over Paid Upgrades**: When Key 1 reaches its rate-limit or temporary spike, it immediately and seamlessly shifts to Key 2, Key 3, Key 4, or Key 5 rather than ever incurring billing.
3. **No Credit Card Requirement**: Operates with $0.00 financial liability.

---

## 5. Control & Diagnostic Commands

```powershell
# Diagnostic test of the entire AI pool
node 04_WORKFLOWS/factory-engine/test-ai-pool.mjs

# Launch the 8-Agent Swarm locally on your machine
node 04_WORKFLOWS/factory-engine/harvester-control.mjs fleet

# Trigger the 24/7 Cloud Swarm on GitHub
gh workflow run 24-7-cloud-harvester.yml
```
