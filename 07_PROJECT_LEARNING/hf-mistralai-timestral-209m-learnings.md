> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/hf-mistralai-timestral-209m-learnings.md`  
> **Source**: huggingface ([https://huggingface.co/mistralai/Timestral-209M](https://huggingface.co/mistralai/Timestral-209M))  
> **Source Version**: `hf-mistralai`  
> **License**: Open-Source  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-31T00:34:25.477Z  
> **Learning ID**: `learn-huggingface-mistralai-timestral-209m`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): mistralai/Timestral-209M

## 1. Executive Forensic Architecture & System Mechanics

**Technical Problem:**
The repository addresses the challenge of **zero-shot probabilistic time-series forecasting** across diverse domains without task-specific fine-tuning. It solves the "cold start" problem in time-series analysis by leveraging a foundation model architecture that generalizes across univariate and multivariate series, handling missing data (NaNs), categorical covariates, and long-context dependencies (up to 32,768 steps).

**Architectural Boundaries:**
The system is a **Patch-Based Transformer** specifically adapted for temporal data. Unlike standard LLMs which process tokens, Timestral processes **patches** of time steps.
*   **Input Boundary:** Raw time series are segmented into fixed-size patches (size 32). Each patch is embedded using its values and missing-value indicators.
*   **Attention Boundary:** The architecture employs a dual-attention mechanism:
    1.  **Time Attention:** Attends across patches within the same variate (temporal dependency).
    2.  **Variate Attention:** Attends across different variates at the same time step (cross-sectional dependency).
*   **Output Boundary:** The model outputs 21 quantiles (0.01 to 0.99) rather than point estimates, enabling probabilistic forecasting and risk assessment (CRPS metric).

**Critical Subsystem Abstractions:**
1.  **Patch Embedding Layer:** Converts raw time steps into vector representations, incorporating missingness flags.
2.  **Block Schedule Controller:** A 24-layer stack where layers alternate between `time` and `time_variate` attention blocks. This specific scheduling (`time, time, time, time_variate, ...`) is a core architectural invariant.
3.  **Quantile Head:** A specialized output layer that maps the final hidden states to 21 distinct quantile predictions.
4.  **Covariate Encoder:** Handles both numeric and categorical covariates. Categoricals are target-encoded, bridging the gap between discrete features and continuous transformer inputs.
5.  **RoPE (Rotary Position Embedding) with Partial Factor:** Uses `rope_theta=10000.0` and `rope_partial_factor=0.5` to encode positional information, crucial for maintaining temporal order in long contexts.

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Dual-Attention Block Scheduling for Multivariate Time Series
**RULE**:
In transformer architectures for multivariate time series, you MUST alternate between temporal attention (across time steps) and variate attention (across features) in a structured block schedule. You MUST NOT use a single homogeneous attention mechanism for both dimensions.
**WHY**:
Temporal dependencies (autocorrelation) and cross-sectional dependencies (correlation between features) operate on different scales and require distinct attention patterns. A homogeneous attention mechanism fails to capture the hierarchical nature of time-series data, leading to poor generalization in zero-shot scenarios. The specific schedule `[time, time, time, time_variate, ...]` ensures that temporal context is established before cross-variate interactions are modeled.
**WHEN TO APPLY**:
Any transformer-based model designed for multivariate time-series forecasting, especially when handling long contexts and mixed covariates.
**VERIFIED IMPLEMENTATION PATTERN**:
```python
# Pseudo-code for Block Schedule
block_schedule = ["time", "time", "time", "time_variate"] * 6 # 24 layers total

for i, block_type in enumerate(block_schedule):
    if block_type == "time":
        # Attention across time dimension (patches) for each variate
        x = temporal_attention(x, mask=temporal_mask)
    elif block_type == "time_variate":
        # Attention across variate dimension for each time step
        x = variate_attention(x, mask=variate_mask)
    x = mlp_block(x)
```
**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Single homogeneous attention
for i in range(24):
    # This fails to distinguish between temporal and cross-sectional dependencies
    x = standard_attention(x, mask=combined_mask)
```
**VERIFICATION METHOD**:
Unit test that verifies the `block_schedule` configuration matches the expected pattern. Integration test that compares model performance on a synthetic multivariate dataset with strong cross-variate correlations; the dual-attention model must outperform the homogeneous model.

### 2. Probabilistic Output via Quantile Regression
**RULE**:
For time-series forecasting models intended for production risk assessment, you MUST output multiple quantiles (e.g., 21 quantiles from 0.01 to 0.99) rather than a single point estimate. You MUST NOT rely solely on mean or median predictions for uncertainty quantification.
**WHY**:
Point estimates provide no information about prediction uncertainty, which is critical for decision-making in domains like finance, energy, and supply chain. Quantile regression allows for the calculation of metrics like CRPS (Continuous Ranked Probability Score) and enables the construction of prediction intervals. The `quantile_knots` configuration defines the specific quantiles to be predicted.
**WHEN TO APPLY**:
Any forecasting model where uncertainty quantification is required, especially in zero-shot or few-shot scenarios where distributional assumptions are unknown.
**VERIFIED IMPLEMENTATION PATTERN**:
```python
# Output layer for 21 quantiles
quantile_knots = [0.01, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 0.99]
output_dim = len(quantile_knots) * num_variates

# Loss function: Pinball Loss (Quantile Loss)
def pinball_loss(y_true, y_pred, quantiles):
    errors = y_true - y_pred
    losses = torch.where(errors > 0, quantiles * errors, (quantiles - 1) * errors)
    return losses.mean()
```
**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Single point estimate
output_dim = num_variates
# Loss: MSE
loss = F.mse_loss(y_true, y_pred)
```
**VERIFICATION METHOD**:
Test that the model output shape matches `(batch_size, horizon, num_variates, 21)`. Verify that the predicted quantiles are monotonically non-decreasing (i.e., Q(0.1) <= Q(0.5) <= Q(0.9)) for each time step and variate.

### 3. Patch-Based Context Management for Long Time Series
**RULE**:
When processing time series with context lengths exceeding 10,000 steps, you MUST segment the input into fixed-size patches (e.g., 32 steps per patch) and process them as tokens. You MUST NOT feed raw time steps directly into the transformer if the context length is large.
**WHY**:
Transformers have quadratic complexity with respect to sequence length. Processing 32,768 raw steps directly would result in $O(32768^2)$ attention operations, which is computationally infeasible. By patching into 1,024 tokens (32768/32), the complexity reduces to $O(1024^2)$, making long-context forecasting feasible. Each patch is embedded with its values and missing-value indicators, preserving local structure while reducing global sequence length.
**WHEN TO APPLY**:
Any transformer-based model handling time series with context lengths > 1,000 steps.
**VERIFIED IMPLEMENTATION PATTERN**:
```python
patch_size = 32
context_length = 32768
num_patches = context_length // patch_size # 1024

# Input shape: (batch_size, context_length, num_variates)
# Reshape to: (batch_size, num_patches, patch_size, num_variates)
x_patched = x.view(batch_size, num_patches, patch_size, num_variates)

# Embed each patch
x_embedded = patch_embedding(x_patched) # Shape: (batch_size, num_patches, d_model)
```
**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Raw step processing
# x_embedded = step_embedding(x) # Shape: (batch_size, 32768, d_model)
# This leads to O(N^2) complexity and memory explosion
```
**VERIFICATION METHOD**:
Benchmark inference time and memory usage for context lengths of 1,000, 10,000, and 32,768 steps. Verify that memory usage scales linearly with the number of patches, not quadratically with the number of steps.

## 3. Forensic Real Incidents & Production Patches (Incidents 1 to 5+)

*Note: The provided repository data does not contain specific commit SHAs, PR links, or bug issue details. Therefore, no specific production incidents can be documented from the given evidence. The following section is omitted as per the instruction to only document incidents discovered from commits, patches, and issues.*

## 4. Microscopic Code-Level Invariants (Syntax, Infinite Loop, UI/UX & Concurrency Guards)

1.  **Micro-Syntax & Token-Level Precision**:
    *   **NaN Handling**: Missing values are marked as `NaN`. In PyTorch, `NaN` values propagate through operations. The model must explicitly handle `NaN` in the embedding layer by using missing-value indicators. **Invariant**: Never allow `NaN` to propagate into attention scores without masking. Use `torch.isnan()` to create masks.
    *   **Quantile Monotonicity**: The output quantiles must be monotonically non-decreasing. **Invariant**: After the output layer, apply a sorting or monotonicity constraint if the model is not trained with a strict monotonicity loss.

2.  **Infinite Loop & Recursion Guards**:
    *   **Block-by-Block Forecasting**: For horizons longer than 1,024 steps, the model forecasts block by block. **Invariant**: The loop must terminate after the required number of blocks. Ensure that the context is updated with the median forecast of the previous block to avoid infinite recursion or context drift.

3.  **UI & UX Micro-Mechanics**:
    *   *Not applicable* (Backend model).

4.  **Backend Concurrency & Memory Safety**:
    *   **Memory Leaks in Long Contexts**: Processing 32,768 steps requires careful memory management. **Invariant**: Use gradient checkpointing or mixed precision (FP16/BF16) to reduce memory footprint. Ensure that intermediate tensors are freed after use.
    *   **Covariate Encoding**: Categorical covariates are target-encoded. **Invariant**: Ensure that the target encoding is computed on the training set and applied to the test set to avoid data leakage.

5.  **Defect & Error Prevention ("Galti Pakadna")**:
    *   **Off-by-One in Patching**: When reshaping input into patches, ensure that the context length is divisible by the patch size. **Invariant**: If the context length is not divisible, pad the input with zeros or NaNs to the nearest multiple of the patch size.
    *   **RoPE Partial Factor**: The `rope_partial_factor` is 0.5. **Invariant**: Ensure that the rotary embeddings are applied only to the first half of the embedding dimension, as specified.

## 5. The 9 Deep Learning Dimensions

1.  **Architecture**: Patch-based transformer with dual attention (time and variate). 24 layers, 768 embedding dimension. Block schedule alternates between time and variate attention.
2.  **Core Abstractions**: Patch embedding, temporal attention, variate attention, quantile head, covariate encoder.
3.  **Error Handling**: Missing values handled via NaN masking and missing-value indicators. Probabilistic outputs allow for uncertainty quantification.
4.  **Testing**: Benchmarks on GIFT-Eval, TIME, and fev-bench. Metrics: MASE, CRPS, Skill Score.
5.  **Security**: No specific security features mentioned. Standard PyTorch security practices apply.
6.  **Performance**: Patching reduces complexity from $O(N^2)$ to $O((N/P)^2)$. RoPE with partial factor improves long-context performance.
7.  **Deployment**: PyTorch on CPU or GPU. No specific CI/CD invariants mentioned.
8.  **Agent Patterns**: No specific agent patterns mentioned.
9.  **Data Flow**: Input -> Patching -> Embedding -> Dual Attention Blocks -> Quantile Head -> Output. Covariates are encoded and concatenated with target variates.

## 6. The 8 Learning Extraction Artifacts

1.  **Pattern**: Dual-attention block scheduling for multivariate time series.
2.  **Rule**: MUST alternate between temporal and variate attention in a structured block schedule.
3.  **Architecture Principle**: Hierarchical modeling of temporal and cross-sectional dependencies.
4.  **Failure Mode**: Homogeneous attention fails to capture distinct temporal and cross-sectional dependencies, leading to poor generalization.
5.  **Reusable Skill**: Implementing a block schedule controller that alternates between different attention types.
6.  **Decision**: Chose dual-attention over homogeneous attention to better capture the structure of multivariate time series.
7.  **Anti-pattern**: Using a single homogeneous attention mechanism for both temporal and cross-sectional dependencies.
8.  **Verification Method**: Unit test for block schedule configuration. Integration test comparing performance on synthetic multivariate data.

## 7. Actionable Agent Skill & Implementation Checklist

1.  **Define Patch Size**: Choose a patch size (e.g., 32) that balances local structure preservation and computational efficiency.
2.  **Implement Patch Embedding**: Create an embedding layer that converts patches into vector representations, incorporating missing-value indicators.
3.  **Design Block Schedule**: Define a block schedule that alternates between temporal and variate attention.
4.  **Implement Dual Attention**: Create separate attention modules for temporal and variate dimensions.
5.  **Add Quantile Head**: Implement an output layer that predicts multiple quantiles.
6.  **Handle Covariates**: Implement a covariate encoder that handles both numeric and categorical features.
7.  **Apply RoPE**: Use rotary position embeddings with a partial factor to encode positional information.
8.  **Train with Pinball Loss**: Use a quantile loss function to train the model.
9.  **Evaluate with CRPS**: Use the Continuous Ranked Probability Score to evaluate probabilistic predictions.
10. **Benchmark on Standard Datasets**: Evaluate the model on GIFT-Eval, TIME, and fev-bench to ensure competitive performance.