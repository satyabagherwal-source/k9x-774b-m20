# Source Evidence Dossier: SYNTH-E3-020-CD-V1HX
- **Title**: MLA KV Cache Dimension Invariant
- **Repository**: deepseek-ai/DeepSeek-R1
- **Source Commit**: hf-deepseek-
- **Parent Dossier**: 07_PROJECT_LEARNING/hf-deepseek-ai-deepseek-r1-learnings.md
- **Primary Domain**: M (Feedback & Evolution Intelligence)
- **Mechanism**: Multi-Head Latent Attention (MLA) KV Cache Compression Ratio

---

## Forensic Source Excerpt

```
Multi-Head Latent Attention (MLA) Engine**:
   - Compresses the standard Key-Value (KV) cache into a low-dimensional latent space via down-projection rank $d_c = 512$ (`kv_lora_rank`), resolving the memory bandwidth bottleneck during long-context autoregressive generation.
   - Decouples positional representations: Queries and Keys are split into non-positional components (`qk_nope_head_dim: 128`) and rotary positional components (`qk_rope_head_dim: 64`). Only non-positional keys are absorbed into the compressed KV cache matrix, leaving the RoPE key decoupled and computed dynamically.

2. **Fine-Grained Mixture-of-Experts (DeepSeekMoE)**:
   - 256 total routed experts with 1 dedicated shared expert (`n_shared_experts: 1`). For every token, 8 routed experts are activated (`num_experts_per_tok: 8`).
   - Group-Limited Routing: 256 experts are partitioned into $M = 8$ groups (`n_group: 8`). Routing selects the top $m = 4$ groups (`topk_group: 4`), and then the top-2 experts per group, enforcing locality and minimizing cross-node all-to-all communication overhead in distributed inference topologies.
   - Auxiliary-Loss-Free Load Balancing (`topk_method: "noaux_tc"`): Traditional MoE aux-losses degrade modeling capability by penalizing expert specialization. DeepSeek-R1 maintains load balancing entirely via dynamically adjusted bias additions to expert routing affinities without altering the gradient backpropagation landscape.

3. **Inference Context & Tokenizer Subsystem**:
   - Context window extension to 163,840 tokens via YaRN (Yet another RoPE extensioN) with dynamic attention scaling factor $S = 40$, $\beta_{fast} = 32$, $\beta_{slow} = 1$.
   - Distinct boundary preservation through Byte-Pair Encoding (`vocab_size: 129280`), enforcing strict delimiter encapsulation for thought traces (`<think>` ... `</think>`) and specialized operational tokens.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Group-Constrained MoE Dispatch Invariant
**RULE**:
When implementing high-expert-count sparse Mixture-of-Experts (MoE where $N_{routed} \ge 64$), the routing dispatch kernel **MUST** partition experts into distinct 
```
