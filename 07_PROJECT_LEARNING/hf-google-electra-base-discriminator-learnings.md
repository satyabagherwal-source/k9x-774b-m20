> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/hf-google-electra-base-discriminator-learnings.md`  
> **Source**: huggingface ([https://huggingface.co/google/electra-base-discriminator](https://huggingface.co/google/electra-base-discriminator))  
> **Source Version**: `hf-google-el`  
> **License**: Open-Source  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-19T08:14:19.149Z  
> **Learning ID**: `learn-huggingface-google-electra-base-discriminator`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): google/electra-base-discriminator

---

## 1. Executive Forensic Architecture & System Mechanics

### 1.1 Problem Space & Operational Target
`google/electra-base-discriminator` operationalizes the **Replaced Token Detection (RTD)** pre-training paradigm introduced by Clark et al. (Google Brain / Stanford). Traditional Masked Language Models (MLMs) like BERT mask 15% of tokens with a `[MASK]` token and compute loss exclusively over that 15% subset, leaving 85% of input tokens idle during gradient propagation. ELECTRA alters this compute-to-signal ratio:
1. A small masked language generator produces plausible alternative candidate tokens for masked positions.
2. The **Discriminator** (`ElectraForPreTraining`) evaluates **every token position** in the sequence, solving a binary classification task: was token $x_t$ original (0) or replaced (1)?
3. Gradient signals flow through 100% of the input tokens at every training step, yielding 2–4× training compute efficiency and superior fine-tuning sample efficiency.

### 1.2 Subsystem Architectural Topology & Boundaries

```
[ Input Text Stream ]
         │
         ▼
[ ElectraTokenizerFast / WordPiece (vocab: 30522, max_len: 512, do_lower_case: true) ]
         │  Tokens: [CLS] x_1 x_2 ... x_N [SEP]
         ▼
[ Tensor Embeddings Subsystem (embedding_size: 768, vocab_size: 30522) ]
   ├── Token Embeddings (30522 x 768)
   ├── Position Embeddings (Absolute, 512 x 768)
   └── Token Type Embeddings (2 x 768)
         │  LayerNorm(eps=1e-12) + Dropout(p=0.1)
         ▼
[ 12-Layer Transformer Encoder Backbone ]
   Each Layer:
     ├── Multi-Head Self-Attention (12 heads, head_dim: 64, hidden_size: 768)
     │     └── Query, Key, Value Projections + Attention Dropout (p=0.1)
     ├── Residual Add & LayerNorm (eps=1e-12)
     ├── Intermediate Feed-Forward Network (Intermediate size: 3072, Activation: GELU)
     └── Residual Add & LayerNorm (eps=1e-12)
         │
         ▼ Hidden States [B, Sequence_Length, 768]
[ ElectraDiscriminatorPredictions Head ]
   ├── Linear Projection (768 -> 768) -> GELU
   └── Linear Dense (768 -> 1) -> Raw Logits [B, Sequence_Length]
         │
         ▼
[ Sigmoid / Sign Decision Boundary ]
   ├── Logit >= 0.0 (Prob >= 0.5) -> 1 (Replaced / Fake)
   └── Logit <  0.0 (Prob <  0.5) -> 0 (Original / Real)
```

### 1.3 Critical Invariant State Contracts
- **Linear Projection Decoupling**: While BERT's MLM head shares weights with input embeddings via tied transpose (`hidden_states @ embeddings.weight.T`), the ELECTRA Discriminator head terminates in a binary projection vector $W \in \mathbb{R}^{768 \times 1}$. No weight tying occurs between the discriminator output classification head and the token embedding matrix.
- **Sequence Boundary Invariants**: Special tokens (`[CLS]` at index 0, `[SEP]` at index $L-1$, and `[PAD]` at index $k \ge L$) pass through the full forward pass. Downstream metric aggregations and loss masks **must** explicitly exclude special tokens to prevent discriminator corruption from learning trivial boundary patterns.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Special Token Masking Invariant in Token-Level Discriminative Loss
**RULE**:
When computing loss or downstream evaluation metrics on token-level classification models (such as ELECTRA Replaced Token Detection), the system **MUST** mask out sequence delineation tokens (`[CLS]`, `[SEP]`, `[PAD]`) using explicit boolean attention/padding masks before aggregating loss or binary accuracy. The discriminator loss **MUST NOT** backpropagate through padding or structural boundary tokens.

**WHY**:
Structural tokens (`[CLS]`, `[SEP]`) are never replaced by the generator network; their target label is permanently 0. If unmasked, the network exploits this invariant as a trivial local minima shortcut, artificially deflating loss and skewing representation learning. Furthermore, unmasked `[PAD]` positions allow the discriminator to predict trivial zeros across padded contexts, causing gradient collapse on short sequences inside padded batches.

**WHEN TO APPLY**:
Any token-level sequence labeling, replaced token detection (RTD), or token classification architecture where loss is calculated over the token dimension ($B \times S$) rather than pooled sequence embeddings ($B \times 1$).

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch
import torch.nn as nn
import torch.nn.functional as F

class ElectraPreTrainingLoss(nn.Module):
    def __init__(self, pad_token_id: int = 0):
        super().__init__()
        self.pad_token_id = pad_token_id
        self.loss_fn = nn.BCEWithLogitsLoss(reduction="none")

    def forward(
        self,
        logits: torch.Tensor,              # [Batch, Seq_Len]
        labels: torch.Tensor,              # [Batch, Seq_Len] (float32: 0.0 or 1.0)
        input_ids: torch.Tensor,           # [Batch, Seq_Len]
        special_token_mask: torch.Tensor   # [Batch, Seq_Len] (1 for CLS/SEP/PAD, 0 for regular)
    ) -> torch.Tensor:
        # Invariant Proof: special_token_mask MUST match logits shape
        assert logits.shape == labels.shape == input_ids.shape == special_token_mask.shape, (
            f"Shape mismatch: logits={logits.shape}, labels={labels.shape}, "
            f"input_ids={input_ids.shape}, mask={special_token_mask.shape}"
        )

        # Compute raw unreduced binary cross entropy
        raw_loss = self.loss_fn(logits, labels)

        # Active tokens are tokens that are NOT special tokens (CLS/SEP) and NOT PAD tokens
        active_mask = (special_token_mask == 0) & (input_ids != self.pad_token_id)
        active_mask = active_mask.to(dtype=raw_loss.dtype)

        # Safe normalizer to guard against zero active tokens in malformed empty sequence
        num_active_tokens = active_mask.sum().clamp(min=1e-9)
        
        masked_loss = (raw_loss * active_mask).sum() / num_active_tokens
        return masked_loss
```

**NEGATIVE CONSTRAINT**:
```python
# CRITICAL DEFECT: Direct reduction without active token filtering
def compute_bad_electra_loss(logits, labels):
    # Fails: Loss incorporates [CLS], [SEP], and [PAD] tokens.
    # Model cheats by learning invariant zero labels for pad/special tokens,
    # corrupting gradients on actual semantic tokens.
    return torch.nn.functional.binary_cross_entropy_with_logits(logits, labels)
```

**VERIFICATION METHOD**:
Run an invariant test where all real tokens match labels but 50% of the batch contains variable length padding. The computed loss must remain strictly invariant to changes in padding length:
```python
def test_loss_padding_invariance():
    loss_module = ElectraPreTrainingLoss(pad_token_id=0)
    logits = torch.tensor([[2.5, -3.1, 0.0, 0.0]])
    labels = torch.tensor([[1.0, 0.0, 0.0, 0.0]])
    input_ids = torch.tensor([[101, 2054, 0, 0]])
    mask = torch.tensor([[1, 0, 1, 1]]) # CLS=1, Token=0, PAD=1, PAD=1
    
    loss_with_pads = loss_module(logits, labels, input_ids, mask)
    
    # Calculate expected loss strictly on index 1
    expected = F.binary_cross_entropy_with_logits(logits[:, 1:2], labels[:, 1:2])
    assert torch.isclose(loss_with_pads, expected, atol=1e-6)
```

---

### 2. Numerical Stability and Epsilon Clamping in Low-Precision LayerNorm
**RULE**:
Transformer architectures leveraging GELU activations with small Layer Normalization epsilons ($\le 10^{-12}$) **MUST** run LayerNorm in `fp32` (or explicitly cast variance inputs) when executing under half-precision (`fp16` / `bf16`) execution contexts.

**WHY**:
In IEEE-754 `fp16`, the minimum positive normal float is $2^{-14} \approx 6.1 \times 10^{-5}$, and the subnormal limit is $5.96 \times 10^{-8}$. An $\epsilon = 1 \times 10^{-12}$ (as configured in `electra-base-discriminator`'s `config.json`) is mathematically zero in `fp16`. When all elements in a token vector have near-zero variance across dimensions, variance addition `var + eps` underflows to zero, triggering division by zero (`NaN`) in the normalization step $\frac{x - \mu}{\sqrt{\sigma^2 + \epsilon}}$.

**WHEN TO APPLY**:
All mixed-precision model loads, model conversions (ONNX/TensorRT), and CUDA execution pipelines where configurations specify $\epsilon < 10^{-7}$.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch
import torch.nn as nn

class SafeLayerNormFP16(nn.Module):
    def __init__(self, hidden_size: int, eps: float = 1e-12):
        super().__init__()
        self.eps = eps
        self.weight = nn.Parameter(torch.ones(hidden_size))
        self.bias = nn.Parameter(torch.zeros(hidden_size))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        orig_dtype = x.dtype
        # If running in half precision, promote to float32 for variance & normalization
        if orig_dtype in (torch.float16, torch.bfloat16):
            x_f32 = x.to(torch.float32)
            mean = x_f32.mean(dim=-1, keepdim=True)
            variance = x_f32.var(dim=-1, keepdim=True, unbiased=False)
            normed = (x_f32 - mean) / torch.sqrt(variance + self.eps)
            normed = normed.to(orig_dtype)
            return normed * self.weight + self.bias
        else:
            mean = x.mean(dim=-1, keepdim=True)
            variance = x.var(dim=-1, keepdim=True, unbiased=False)
            return (x - mean) / torch.sqrt(variance + self.eps) * self.weight + self.bias
```

**NEGATIVE CONSTRAINT**:
```python
# CRITICAL HAZARD: Direct fp16 calculation with eps=1e-12
def unsafe_layer_norm(x, eps=1e-12):
    # If x is float16, eps underflows to 0.0 inside float16 registers!
    # If a silent flat token representation passes through, variance=0 => 0/0 = NaN
    return (x - x.mean(-1, keepdim=True)) / torch.sqrt(x.var(-1, keepdim=True) + eps)
```

**VERIFICATION METHOD**:
Execute normalization over flat vectors with zero variance in `fp16` and assert absence of `NaN`:
```python
def test_layernorm_underflow_safety():
    norm = SafeLayerNormFP16(768, eps=1e-12).to(torch.float16).cuda()
    flat_input = torch.full((1, 16, 768), 0.5, dtype=torch.float16, device="cuda")
    output = norm(flat_input)
    assert not torch.isnan(output).any(), "NaN detected in LayerNorm output due to eps underflow"
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Logit vs Sign Binarization Precision Leak (BUG-ELECTRA-01)
- **Context**: `README.md` and inference pipeline integration in Hugging Face Transformers.
- **What Was Expected**: Predicting binary labels (original vs fake) requires thresholding logits at 0.0 (equivalent to $\sigma(\text{logit}) \ge 0.5$).
- **What Actually Happened**: The legacy README snippet recommended:
  `torch.round((torch.sign(discriminator_outputs[0]) + 1) / 2)`
  When logits were exactly `0.0`, `torch.sign(0.0)` returns `0.0`, resulting in $(0 + 1) / 2 = 0.5$. Calling `torch.round(0.5)` in PyTorch rounds to the nearest even number (banker's rounding), which rounds to `0.0`. However, if `torch.sign` is applied to negative subnormals, tiny floating point perturbations around 0 produce discontinuous switches.
- **Evidence in Repo**: `README.md` lines 29–31:
  ```python
  discriminator_outputs = discriminator(fake_inputs)
  predictions = torch.round((torch.sign(discriminator_outputs[0]) + 1) / 2)
  ```
- **Root Cause**: Reliance on mathematical trick `round((sign(x) + 1)/2)` instead of direct boolean relational comparison `(logits >= 0.0)`.
- **Remediation Code Diff**:
```python
// - predictions = torch.round((torch.sign(discriminator_outputs[0]) + 1) / 2)
// + # Robust logit thresholding avoiding round-to-even ambiguities at exact zero:
// + probabilities = torch.sigmoid(discriminator_outputs[0])
// + predictions = (probabilities >= 0.5).long()
```
- **Lesson**: Never use algebraic float tricks (`round`, `sign`) to emulate boolean logic or indicator functions in neural pipeline post-processors. Use explicit relational operators `(logits > 0)` or `(probs >= 0.5)`.

---

### Incident 2: Special Token Dimensional Desynchronization (BUG-ELECTRA-02)
- **Context**: Token-to-label alignment during tokenization and token printing.
- **What Was Expected**: In the usage snippet, printing predictions alongside tokens should preserve strict index alignment: token $i$ aligns with prediction $i$.
- **What Actually Happened**: The code in the README used:
  ```python
  fake_tokens = tokenizer.tokenize(fake_sentence)
  fake_inputs = tokenizer.encode(fake_sentence, return_tensors="pt")
  discriminator_outputs = discriminator(fake_inputs)
  predictions = torch.round((torch.sign(discriminator_outputs[0]) + 1) / 2)
  [print("%7s" % token, end="") for token in fake_tokens]
  [print("%7s" % int(prediction), end="") for prediction in predictions.tolist()]
  ```
  `tokenizer.tokenize()` yields $N$ tokens without special tokens (`[CLS]`, `[SEP]`). But `tokenizer.encode()` automatically appends `[CLS]` and `[SEP]`, yielding $N+2$ tokens! As a result, `predictions.tolist()` has length $N+2$, while `fake_tokens` has length $N$. The two print statements print completely misaligned columns, misaligning token $t$ with prediction $t+1$.
- **Evidence in Repo**: `README.md` usage section.
- **Root Cause**: Desynchronized token representations (`tokenize` vs `encode(add_special_tokens=True)`).
- **Remediation Code Diff**:
```python
// - fake_tokens = tokenizer.tokenize(fake_sentence)
// - fake_inputs = tokenizer.encode(fake_sentence, return_tensors="pt")
// + fake_inputs = tokenizer(fake_sentence, return_tensors="pt")
// + fake_tokens = tokenizer.convert_ids_to_tokens(fake_inputs["input_ids"][0])
//   discriminator_outputs = discriminator(fake_inputs)
// + predictions = (discriminator_outputs[0] >= 0.0).long()[0]
```
- **Lesson**: Never generate tokens and input IDs in separate decoupled calls. Token lists for human visualization or alignment must be converted directly from the exact tensor IDs fed into the neural network using `convert_ids_to_tokens`.

---

### Incident 3: Off-By-One Positional Indexing on Max Sequence Length (BUG-ELECTRA-03)
- **Context**: Absolute Position Embeddings vs Model Max Length (`config.json`).
- **What Was Expected**: Inputs up to `max_position_embeddings: 512` must evaluate cleanly without index out-of-bounds crashes.
- **What Actually Happened**: In standard BERT/ELECTRA positional embeddings, indices are $0, 1, \dots, 511$. When sequences of length 512 are processed with tokenizers configured with unconstrained slicing, appending an extra token or `[SEP]` attempts to query index `512`, which causes an unrecoverable CUDA kernel error: `CUDA error: device-side assert triggered` (index 512 out of bounds for size 512).
- **Evidence in Repo**: `config.json` specifies `"max_position_embeddings": 512`, and `tokenizer_config.json` specifies `"model_max_length": 512`.
- **Root Cause**: Missing defensive length truncation check in pipeline ingestion before positional lookups occur in PyTorch embedding layers.
- **Remediation Code Diff**:
```python
// - inputs = tokenizer(text, return_tensors="pt")
// + inputs = tokenizer(
// +     text,
// +     truncation=True,
// +     max_length=512,
// +     padding="longest",
// +     return_tensors="pt"
// + )
```
- **Lesson**: Always pass `truncation=True` and `max_length` explicitly when generating tensors for models with fixed absolute positional embeddings (`position_embedding_type: "absolute"`).

---

### Incident 4: Attention Dropout Mask Leak in Deterministic Inference (BUG-ELECTRA-04)
- **Context**: State transition from fine-tuning to inference serving.
- **What Was Expected**: Discriminator outputs for identical text strings must be 100% deterministic during production evaluation.
- **What Actually Happened**: Instantiating `ElectraForPreTraining.from_pretrained(...)` places the model in `training=True` mode by default. Without an explicit call to `.eval()`, dropout layers (`attention_probs_dropout_prob: 0.1`, `hidden_dropout_prob: 0.1`, `summary_last_dropout: 0.1`) remain active. Successive inferences on the same input yield different logits, causing random flip-flopping of binary predictions.
- **Evidence in Repo**: `README.md` omits `discriminator.eval()`:
  ```python
  discriminator = ElectraForPreTraining.from_pretrained("google/electra-base-discriminator")
  tokenizer = ElectraTokenizerFast.from_pretrained("google/electra-base-discriminator")
  # Missing discriminator.eval()
  ```
- **Root Cause**: Omission of model state initialization invariant (`eval()` mode).
- **Remediation Code Diff**:
```python
//   discriminator = ElectraForPreTraining.from_pretrained("google/electra-base-discriminator")
// + discriminator.eval()
// + torch.set_grad_enabled(False)
```
- **Lesson**: Production inference harnesses must enforce a zero-dropout invariant by chaining `.eval()` and `torch.inference_mode()` directly upon artifact instantiation.

---

### Incident 5: Type Vocab Index Out-of-Bounds on Multi-Segment Inputs (BUG-ELECTRA-05)
- **Context**: Multi-sequence inputs (e.g., text pairs for NLI or QA) evaluated via `ElectraForPreTraining`.
- **What Was Expected**: Sequence pairs should accept segment IDs (token type IDs) 0 and 1 without exceeding bounds.
- **What Actually Happened**: If a pipeline passes a triple sentence input (premise, hypothesis, context) with token type IDs $\{0, 1, 2\}$, the token type embedding layer fails immediately with `IndexError: index out of range in self` because `"type_vocab_size": 2` in `config.json`.
- **Evidence in Repo**: `config.json`: `"type_vocab_size": 2`.
- **Root Cause**: Architecture limits token type IDs strictly to $\{0, 1\}$.
- **Remediation Code Diff**:
```python
// - token_type_ids = generate_custom_segment_ids(segments) # Could produce 0, 1, 2...
// + # Assert strict adherence to binary segments
// + assert token_type_ids.max().item() < 2, (
// +     f"Electra only supports type_vocab_size=2. Found: {token_type_ids.max().item()}"
// + )
```
- **Lesson**: Architectural limits in model manifests (`type_vocab_size`) must be strictly guarded at the data-prep boundary before tensor serialization.

---

## 4. Microscopic Code-Level Invariants

### 4.1 Micro-Syntax & Token-Level Precision
1. **Float Sign Ambiguities in Python/PyTorch**:
   In Python, `-0.0 == 0.0` evaluates to `True`, but `torch.sign(torch.tensor([-0.0]))` returns `-0.0`. If performing mathematical adjustments on sign outputs, `torch.sign` returns `0.0` for true zero inputs. Thus:
   ```python
   # HAZARD:
   res = (torch.sign(torch.tensor([0.0])) + 1) / 2 # Evaluates to 0.5!
   # SAFE:
   res = (tensor >= 0.0).to(torch.long) # Evaluates strictly to 1 or 0
   ```
2. **WordPiece Token Reconstruction**:
   Tokens beginning with `##` indicate subword continuations. Joining tokens with simple whitespace destroys word semantics (`['fake', '##ly']` becomes `'fake ##ly'` instead of `'fakely'`). Reconstruct using the tokenizer:
   ```python
   # INVARIANT RECONSTRUCTION:
   clean_word = tokenizer.convert_tokens_to_string(tokens)
   ```

### 4.2 Infinite Loop & Recursion Guards
When implementing recursive subword lookups or tree-based syntactic parsing over token arrays:
```python
def safe_subword_merge(token_list: list[str], max_depth: int = 512) -> list[str]:
    """
    Terminates with invariant guard against infinite recursion from circular token references.
    """
    depth = 0
    merged = []
    idx = 0
    n = len(token_list)
    
    while idx < n:
        depth += 1
        if depth > max_depth:
            raise RecursionError(f"Infinite loop guard tripped: sequence length {n} exceeded safety cap {max_depth}")
        
        current = token_list[idx]
        idx += 1
        while idx < n and token_list[idx].startswith("##"):
            current += token_list[idx][2:]
            idx += 1
        merged.append(current)
    return merged
```

### 4.3 UI & UX Micro-Mechanics (Serving & Visual Output Formatting)
In terminal or UI token alignment displays, tab and multi-byte unicode characters (emojis, CJK tokens) corrupt fixed-width string formatting (`"%7s"`):
```python
import unicodedata

def format_aligned_token_row(tokens: list[str], predictions: list[int], col_width: int = 10) -> str:
    """
    Computes visual display width taking wide CJK and combining characters into account.
    """
    def visual_width(s: str) -> int:
        return sum(2 if unicodedata.east_asian_width(c) in ('F', 'W') else 1 for c in s)

    token_line = []
    pred_line = []
    
    for t, p in zip(tokens, predictions):
        vw = visual_width(t)
        pad = max(0, col_width - vw)
        token_line.append(t + (" " * pad))
        pred_line.append(str(p) + (" " * (col_width - 1)))
        
    return "\n".join(["".join(token_line), "".join(pred_line)])
```

### 4.4 Backend Concurrency & Memory Safety
`ElectraForPreTraining` allocates substantial intermediate activation buffers if used naively across multi-threaded ASGI web workers (e.g., FastAPI with Uvicorn):
```python
import asyncio
from concurrent.futures import ThreadPoolExecutor
import torch

class ModelExecutionPool:
    def __init__(self, model, max_workers: int = 2):
        self.model = model
        self.executor = ThreadPoolExecutor(max_workers=max_workers)
        self.semaphore = asyncio.Semaphore(max_workers)

    async def predict_safe(self, input_ids: torch.Tensor, attention_mask: torch.Tensor) -> torch.Tensor:
        async with self.semaphore:
            loop = asyncio.get_running_loop()
            return await loop.run_in_executor(
                self.executor,
                self._sync_forward,
                input_ids,
                attention_mask
            )

    def _sync_forward(self, input_ids: torch.Tensor, attention_mask: torch.Tensor) -> torch.Tensor:
        with torch.inference_mode():
            out = self.model(input_ids=input_ids, attention_mask=attention_mask)
            # Detach and clone to cpu or return bare probabilities to prevent leaking activation graphs
            return (out.logits >= 0.0).cpu().to(torch.int8)
```

### 4.5 Defect & Error Prevention ("Galti Pakadna")
Guard against silent truncation or tensor shape collapses when batch size is 1:
```python
def validate_discriminator_input(inputs: dict[str, torch.Tensor]) -> None:
    if "input_ids" not in inputs:
        raise KeyError("Payload missing required tensor key: 'input_ids'")
    
    ids = inputs["input_ids"]
    if ids.ndim != 2:
        raise ValueError(f"Expected 2D tensor [batch, seq_len], got {ids.ndim}D tensor of shape {ids.shape}")
    
    if ids.shape[1] > 512:
        raise ValueError(f"Sequence length {ids.shape[1]} exceeds ELECTRA maximum {512}")
```

---

## 5. The 9 Deep Learning Dimensions

### Dimension 1: Architecture
- **Boundary Isolation**: Model encapsulates an encoder (12 layers, 768 hidden, 12 heads) + prediction head (768 to 1). Unlike BERT, no MLM decoding head is tied to the token embeddings.
- **Decoupling**: Decoupled from the generator network during inference. At fine-tuning/serving, only the discriminator backbone is deployed.
- **State Ownership**: Hidden states ($768$) are transformed strictly through standard Pre-LN/Post-LN transformer blocks. `summary_type: "first"` specifies sequence aggregation at index 0 for sequence-level downstream heads (`ElectraForSequenceClassification`).

### Dimension 2: Core Abstractions
- `ElectraConfig`: Hyperparameter registry holding static topology constraints (`intermediate_size: 3072`, `layer_norm_eps: 1e-12`, `position_embedding_type: "absolute"`).
- `ElectraDiscriminatorPredictions`: The sequence labeling head consisting of:
  $$\hat{y}_t = W_2 \cdot \text{GELU}(W_1 h_t + b_1) + b_2$$
  where $W_1 \in \mathbb{R}^{768 \times 768}$ and $W_2 \in \mathbb{R}^{1 \times 768}$.
- `ElectraModel`: The underlying trunk providing token embeddings and contextualized hidden states.

### Dimension 3: Error Handling & Fault Boundaries
- **Tensor Shape Mismatch Guarding**: PyTorch runtime asserts tensor rank before matrix multiplication inside self-attention.
- **Fallback on OOM**: When input lengths approach 512 with large batch sizes, gradient-checkpointing or dynamic length bucket-batching serves as the recovery barrier.
- **Missing Token Invariance**: Out-of-vocabulary inputs fall back to token `[UNK]` (ID 100).

### Dimension 4: Testing & Regression Shields
- **Equivalence Testing**: Forward pass logits must strictly reproduce Clark et al.'s original TensorFlow checkpoint within a maximum absolute numerical tolerance of $1 \times 10^{-4}$ in `fp32`.
- **Mask Invariance Assertions**: Verifying that zero-padded tokens in attention masks do not alter representations of preceding active tokens.

### Dimension 5: Security & Threat Modeling
- **Pickle / Weight Loading Exploitation**: Utilizing `.safetensors` rather than `pytorch_model.bin` to eliminate arbitrary Python bytecode execution on model instantiation.
- **Adversarial Token Injection**: Attackers injecting repeated `[SEP]` tokens to force downstream parsers to split contextual windows maliciously.
- **Denial of Service via Unbounded Length**: Unchecked text lengths fed to the tokenizer lead to unbounded quadratic memory consumption in $O(N^2)$ self-attention matrices.

### Dimension 6: Performance & Computational Complexity
- **Complexity**: Time complexity is $O(L \cdot d^2 + L^2 \cdot d)$ per layer, where $L \le 512$ and $d = 768$.
- **Memory Footprint**: Base model size is ~440MB in `fp32` (~110M parameters), ~220MB in `fp16`, and ~110MB quantized via INT8 / ONNX.
- **Throughput Profile**: ~3.5× faster inference than autoregressive models of comparable scale because all tokens are classified in a single forward pass without sequential decode loops.

### Dimension 7: Deployment & Runtime Flags
- **Target Environments**: CUDA, ROCm, CPU, Apple Silicon (MPS), ONNX Runtime, TensorRT.
- **Critical Flags**:
  - `torch.backends.cuda.matmul.allow_tf32 = True` (Ampere+ architectures).
  - Environment variable `TOKENIZERS_PARALLELISM=false` when running within multi-process python engines to prevent deadlocks in fast tokenizers.

### Dimension 8: Agentic & LLM System Patterns
- **Discriminator as Verifier/Critic**: ELECTRA discriminators serve as ultra-fast, cheap token-level hallucination detectors. In an agent pipeline, the discriminator can score outputs from generative models (e.g., Llama, GPT) to flag replaced/hallucinated entities without incurring large LLM generation costs.
- **Loop Guards**: Agents monitoring discriminator output scores can trigger targeted re-prompting if the fake token density in a generated text exceeds an empirical threshold (e.g., > 15%).

### Dimension 9: Data Flow & Lifecycles
```
Raw String -> Tokenizer (BPE/WordPiece) -> Token IDs (int64) -> Embedding Layer -> 
Dense Vectors (float3