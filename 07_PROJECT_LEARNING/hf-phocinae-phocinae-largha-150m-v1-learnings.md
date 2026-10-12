> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/hf-phocinae-phocinae-largha-150m-v1-learnings.md`  
> **Source**: huggingface ([https://huggingface.co/Phocinae/Phocinae-Largha-150M-v1](https://huggingface.co/Phocinae/Phocinae-Largha-150M-v1))  
> **Source Version**: `hf-phocinae-`  
> **License**: Open-Source  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-12T07:51:21.541Z  
> **Learning ID**: `learn-huggingface-hf-phocinae-phocinae-largha-150m-v1-mv4ydvid`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): Phocinae/Phocinae-Largha-150M-v1

---

## 1. Executive Forensic Architecture & System Mechanics

### 1.1 Technical Problem Formulation
Contemporary autonomous agent loops frequently deploy large autoregressive models (7B–70B+ parameters) to perform atomic control-flow routing, boolean permission verification (`allow`/`deny`), categorical decision gating, and linear score attribution. This paradigm incurs:
1. **Inference Latency Bloat**: Autoregressive decode loops require multi-token iterative generation ($O(N)$ forward passes per token), resulting in hundreds of milliseconds to seconds of latency for a deterministic single-choice outcome.
2. **Non-Calibrated Output Uncertainty**: Standard autoregressive greedy sampling over structured JSON masks true token-level probability distributions, introducing hallucinations and order-dependent position bias (e.g., preference for option 'A').
3. **Severe Resource Inefficiency**: Consuming 16GB–80GB of VRAM to execute categorical policy decisions starves operational clusters and creates unnecessary concurrency bottlenecks.

`Phocinae/Phocinae-Largha-150M-v1` resolves this by framing structured decision-making as a non-autoregressive, masked-encoder-based sequence classification system. Operating at 144.3M parameters over a specialized `ModernBertForMaskedLM` backbone, the system executes arbitrary typed decisions in a **single forward pass** ($\Delta t \approx 21.0\text{ ms}$ on FP16 modern hardware) with zero generated output tokens.

```
                              AGENT CONTEXT STREAM
                                        │
           ┌────────────────────────────┴───────────────────────────┐
           ▼                                                        ▼
┌──────────────────────┐                                 ┌──────────────────────┐
│  State Representation │                                 │ Typed Question Block │
│  (System Context)    │                                 │ (noul | choice |     │
│                      │                                 │  score)              │
└──────────┬───────────┘                                 └──────────┬───────────┘
           │                                                        │
           └────────────────────────────┬───────────────────────────┘
                                        ▼
                   ┌─────────────────────────────────────────┐
                   │  Tokenization & Formatted Prompt Inject │
                   │  - Context Window: 8192 tokens          │
                   │  - Vocab Size: 256,000 (Bilingual Multilingual) │
                   └────────────────────┬────────────────────┘
                                        ▼
             ┌─────────────────────────────────────────────────────┐
             │ ModernBert Backbone (22 Layers, hidden_size=384)    │
             │ - Global Attn Every 3 Layers (Full Attention)       │
             │ - Local Sliding Attention (Window=128)              │
             │ - RoPE Theta: 160,000 (sans_pos absolute embedding) │
             │ - GeLU activations, unpadded Flash Attention        │
             └──────────────────────────┬──────────────────────────┘
                                        ▼
             ┌─────────────────────────────────────────────────────┐
             │ Mean-Pooled Hidden States & Classification Head     │
             │ (Softmax Probability Distribution / Calibrated Logits)│
             └──────────────────────────┬──────────────────────────┘
                                        │
              ┌─────────────────────────┼─────────────────────────┐
              ▼                         ▼                         ▼
   ┌─────────────────────┐   ┌─────────────────────┐   ┌─────────────────────┐
   │ Gate: `noul`        │   │ Choice: `choice`    │   │ Metric: `score`     │
   │ (Binary Allow/Deny) │   │ (Pick 1-of-N,       │   │ (Calibrated 2..10)  │
   │ Calibrated Sigmoid  │   │  Permutation-Inv.)  │   │ Expected Value /    │
   │                     │   │ Calibrated Softmax  │   │ Categorical Logits  │
   └─────────────────────┘   └─────────────────────┘   └─────────────────────┘
```

### 1.2 Core Subsystem Boundaries & Structural Invariants
1. **The Encoder Substrate (`ModernBert` Architecture)**:
   - Configured with `hidden_size: 384`, `intermediate_size: 1152`, `num_hidden_layers: 22`, and `num_attention_heads: 6`. Head dimension is exactly $d_k = 384 / 6 = 64$.
   - **Hybrid Alternating Attention Mechanics**: A 22-layer interleaving structure where every 3rd layer is a global `full_attention` block (`global_attn_every_n_layers: 3`), while the remaining $2/3$ layers operate under a localized `sliding_attention` context window of 128 tokens (`local_attention: 128`).
   - **Decoupled Positional Geometry**: Utilizes Rotary Position Embeddings (`rope_parameters` with $\theta = 160{,}000$) applied to query/key projections across both global and sliding layers, entirely abandoning absolute learned position vectors (`position_embedding_type: "sans_pos"`).
   - **Massive Vocabulary Substrate**: Employs a 256,000-token multilingual vocabulary matrix tied across input and output representations (`tie_word_embeddings: true`).

2. **Decision Gating Subsystems (Type-Constrained Inference)**:
   - **`noul` Protocol (Binary Gate)**: Evaluates high-risk invariant transitions (e.g., tool execution admission, SQL execution allowance) mapping to canonical binary logits (`yes` vs. `no`).
   - **`choice` Protocol (Categorical Selection)**: Evaluates multi-candidate action spaces ($K$-way classification) with invariance to prompt-level option permutation.
   - **`score` Protocol (Calibrated Bounded Regression/Classification)**: Projects numerical evaluations (e.g., resume matching, heuristic fitness) onto a discrete, calibrated spectrum ($2 \dots 10$).

---

## 2. Net-New Universal Engineering Rules

### 1. Permutation-Invariant Multi-Choice Logit Aggregation
**RULE**:
When utilizing encoder or masked-language models for categorical decision-making over an arbitrary option list $\{O_1, O_2, \dots, O_K\}$, the inference engine MUST evaluate all cyclic permutations of option sequences or normalize label-conditional token representations across symmetric passes before emitting a routing decision. Under strict single-pass constraints, the model prompt MUST serialize candidate options as structurally independent delimiters with label-neutral keys, and query