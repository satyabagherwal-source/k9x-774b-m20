# Source Evidence Dossier: SYNTH-E3-096-CD-DVLL
- **Title**: Permutation-Invariant Multi-Choice Logit Aggregation
- **Repository**: Phocinae/Phocinae-Largha-150M-v1
- **Source Commit**: hf-phocinae-
- **Parent Dossier**: 07_PROJECT_LEARNING/hf-phocinae-phocinae-largha-150m-v1-learnings.md
- **Primary Domain**: M (Feedback & Evolution Intelligence)
- **Mechanism**: Permutation-Invariant Multi-Choice Logit Aggregation

---

## Forensic Source Excerpt

```
LM-based system performing gating, routing, scoring, or multiple-choice selection.
**VERIFIED IMPLEMENTATION PATTERN**:
```python
# Instead of:
# outputs = model.generate(input_ids, max_new_tokens=10)
# answer = outputs[0].decode() # Risky, variable length

# Use:
outputs = model(input_ids, attention_mask=attention_mask)
logits = outputs.logits[:, -1, :] # Or pooled output
# Map specific token IDs to classes
class_ids = [tokenizer.encode("yes")[0], tokenizer.encode("no")[0]]
class_logits = logits[:, class_ids]
probabilities = torch.softmax(class_logits, dim=-1)
# Deterministic, fast, bounded output
```
**NEGATIVE CONSTRAINT**:
```python
# NEVER do this for bounded decisions:
prompt = "Answer with only 'yes' or 'no': "
output = model.generate(prompt_ids, max_new_tokens=1)
# Risk: Model might output "Yes", "YES", "yes.", or "I think yes"
# Requires fragile post-processing regex
```
**VERIFICATION METHOD**:
Assert that the inference function returns a fixed-size tensor of probabilities, not a string. Measure latency: classification head MUST be < 50ms on GPU for < 512 tokens, whereas generation MUST be > 100ms.

### 2. Hybrid Attention Layer Scheduling for Cost-Efficiency
**RULE**:
In transformer models with > 10 layers, the system MUST alternate between global (full) attention and local (sliding window) attention in a periodic pattern (e.g., 1 full : 2 sliding) to reduce computational complexity from O(N^2) to O(N * W + N * L), where W is window size and L is number of full layers.
**WHY**:
Full attention is computationally expensive for long contexts. Sliding window attention limits the recept
```
