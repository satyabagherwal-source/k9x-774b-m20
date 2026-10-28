> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/hf-convaiinnovations-laya-learnings.md`  
> **Source**: huggingface ([https://huggingface.co/convaiinnovations/laya](https://huggingface.co/convaiinnovations/laya))  
> **Source Version**: `hf-convaiinn`  
> **License**: Open-Source  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-28T02:13:17.082Z  
> **Learning ID**: `learn-huggingface-convaiinnovations-laya`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): convaiinnovations/laya

## 1. Executive Forensic Architecture & System Mechanics

**Technical Problem Solved:**
The repository `convaiinnovations/laya` addresses the critical inefficiency and unreliability of Large Language Models (LLMs) for structured data extraction and decision-making tasks. Standard autoregressive LLMs suffer from:
1.  **Latency:** Sequential token generation is slow (seconds vs. milliseconds).
2.  **Hallucination:** LLMs generate free text that requires fragile parsing (JSON extraction, regex) and can invent facts.
3.  **Calibration:** LLM confidence scores are often poorly calibrated (overconfident).

**Laya** is a **non-autoregressive, multilingual, System 1 decision model**. It operates as a **classifier/scorer** rather than a generator.
*   **Input:** A "state" (text/JSON) and a set of "typed questions" (Choice, Score, Noul/Yes-No).
*   **Output:** Typed answers with **mathematically calibrated probabilities** in a single forward pass (~33ms).
*   **Training:** Reinforcement Learning with Calibrated Decisions (RLCD) against strictly proper scoring rules. This ensures the model is incentivized to report *honest* probabilities, not just correct labels.

**Architectural Boundaries & Subsystems:**
1.  **Inference Engine:** A non-autoregressive transformer variant (likely based on a masked language model or encoder-only architecture) that processes the entire input state and question set simultaneously. No token-by-token generation loop.
2.  **Routing Subsystem:** A `Router` class that dynamically selects the optimal checkpoint (e.g., `english`, `multilingual`) based on input characteristics (language detection, length).
3.  **Calibration Layer:** The output probabilities are not raw logits but calibrated scores derived from the RLCD training objective.
4.  **Integration Layer:** Provides adapters for LangChain, LangGraph, MCP (Model Context Protocol), and ONNX Runtime for edge/GPU deployment.

**Critical Abstraction:**
The core abstraction is the **Typed Question**. Unlike free-form prompts, questions have a strict schema:
*   `choice`: Multi-class classification with criteria.
*   `score`: Ordinal scoring with defined criteria.
*   `noul`: Binary Yes/No with probability output.

This forces the model to operate within a constrained output space, eliminating the need for post-hoc parsing and ensuring type safety.

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Non-Autoregressive Decisioning for Structured Extraction
**RULE**:
When the task is **classification, scoring, or binary decision-making** on a fixed input state, you MUST use a non-autoregressive model (single forward pass) instead of an autoregressive LLM. You MUST NOT use autoregressive generation for tasks where the output is a fixed set of typed values.
**WHY**:
Autoregressive models incur $O(N)$ latency where $N$ is the output length, and they introduce hallucination risk via free-text generation. Non-autoregressive models provide $O(1)$ latency (relative to output length) and eliminate parsing errors by constraining the output space to typed probabilities.
**WHEN TO APPLY**:
Any system requiring low-latency (<100ms) structured extraction, routing, moderation, or scoring from text/JSON inputs.
**VERIFIED IMPLEMENTATION PATTERN**:
```python
# Laya Pattern: Single forward pass for multiple typed questions
from laya import Router

router = Router()
state = "User text..."
questions = {
    "department": {"type": "choice", "criteria": {"billing": "...", "tech": "..."}},
    "urgency": {"type": "score", "criteria": ["low", "high"]},
    "churn": {"type": "noul", "instructions": "Will they cancel?"}
}

# Single forward pass, ~33ms
result = router.predict(state, questions)
# result["answers"]["department"]["choice"] -> "billing"
# result["answers"]["churn"]["noul"] -> 0.92 (calibrated probability)
```
**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Using LLM for classification
llm_response = llm.generate(f"Classify this: {state}. Return JSON: {{'dept': '...'}}")
parsed = json.loads(llm_response) # Fragile, slow, hallucination-prone
```
**VERIFICATION METHOD**:
Assert that the inference time is constant regardless of the number of questions (within a reasonable limit) and that the output is a typed dictionary with probability floats, not a string.

### 2. Calibrated Probability Reporting via Proper Scoring Rules
**RULE**:
When a model outputs probabilities, you MUST train or calibrate it using **strictly proper scoring rules** (e.g., Brier score, Log loss) to ensure that reporting the true probability maximizes reward. You MUST NOT rely on raw softmax outputs without calibration if the downstream system uses these probabilities for risk assessment or routing.
**WHY**:
Raw softmax outputs from LLMs are often overconfident (e.g., 0.99 for a 50/50 guess). Proper scoring rules penalize overconfidence, forcing the model to output honest probabilities. This is critical for systems that use probability thresholds for decision-making.
**WHEN TO APPLY**:
Any system where the probability value itself is a decision variable (e.g., "if churn_risk > 0.8, trigger retention offer").
**VERIFIED IMPLEMENTATION PATTERN**:
```python
# Laya uses RLCD (Reinforcement Learning with Calibrated Decisions)
# The reward function is a strictly proper scoring rule.
# Example: Brier Score = (p - y)^2
# If p=0.9 and y=1, score = 0.01
# If p=0.5 and y=1, score = 0.25
# The model learns to output p close to the true probability.

# In Laya, the output is directly usable:
prob = result["answers"]["churn_risk"]["noul"]
if prob > 0.8:
    trigger_retention()
```
**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Using raw softmax without calibration
logits = model.forward(input)
probs = torch.softmax(logits, dim=-1)
# probs may be 0.99 for a 50/50 case, leading to false positives
```
**VERIFICATION METHOD**:
Perform a calibration test: Plot the predicted probabilities against the actual frequency of positive outcomes. The curve should be close to the diagonal (perfect calibration).

### 3. Dynamic Checkpoint Routing for Multilingual Efficiency
**RULE**:
In multilingual systems, you MUST implement a routing layer that selects the optimal model checkpoint based on input characteristics (language, length). You MUST NOT force a single multilingual model to handle all inputs if specialized monolingual models offer better accuracy or speed.
**WHY**:
Multilingual models often have lower accuracy for specific languages compared to specialized monolingual models. Routing allows you to use the best model for each input, optimizing both accuracy and resource usage.
**WHEN TO APPLY**:
Any system handling inputs in multiple languages where accuracy or latency is critical.
**VERIFIED IMPLEMENTATION PATTERN**:
```python
# Laya Router
router = Router()
# The router automatically detects language and selects the best checkpoint
result = router.predict(state, questions)
print(result["routing"]["model"]) # e.g., "english" or "multilingual"

# For long documents, explicitly specify the model to avoid misrouting
result = router.predict(long_doc, questions, model="multilingual", max_len=8192)
```
**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Using a single model for all languages
model = load_model("multilingual")
# This may be slower or less accurate for English-only inputs
```
**VERIFICATION METHOD**:
Log the routing decision for each request. Monitor the distribution of routed models and ensure that the routing logic correctly identifies the language and length.

## 3. Forensic Real Incidents & Production Patches (Incidents 1 to 5+)

*Note: The provided repository data contains no commit history, bug issues, or code diffs. Therefore, no specific production incidents can be documented. The following section is left empty as per the data governance mandate.*

## 4. Microscopic Code-Level Invariants (Syntax, Infinite Loop, UI/UX & Concurrency Guards)

### 1. Micro-Syntax & Token-Level Precision
*   **Type Coercion in Typed Questions:** The `questions` dictionary must strictly adhere to the schema. For `choice` type, `criteria` must be a dictionary mapping labels to descriptions. For `score` type, `criteria` must be a list of strings. Passing a list to `choice` or a dictionary to `score` will likely cause a runtime error or silent misinterpretation.
*   **Probability Range:** The `noul` output is a float between 0.0 and 1.0. Any downstream logic must handle edge cases where the probability is exactly 0.0 or 1.0, as these may indicate high confidence or model failure.

### 2. Infinite Loop & Recursion Guards
*   **Non-Autoregressive Nature:** Since Laya is non-autoregressive, there is no generation loop. The risk of infinite loops is minimal. However, the routing logic must ensure that it does not enter a loop when detecting language or selecting a checkpoint.
*   **Max Length Handling:** The `max_len` parameter (e.g., 8192) must be respected. If the input exceeds this length, the model should truncate or raise an error, not attempt to process it and potentially hang or crash.

### 3. UI & UX Micro-Mechanics
*   **N/A:** This is a backend inference model. There are no UI/UX concerns.

### 4. Backend Concurrency & Memory Safety
*   **Thread Safety:** The `Router` object must be thread-safe if used in a multi-threaded server. The underlying model inference should be stateless or use thread-local storage to avoid race conditions.
*   **Memory Management:** For long documents (up to 8192 tokens), memory usage can be significant. Ensure that the model releases memory after each inference, especially in a server environment.

### 5. Defect & Error Prevention ("Galti Pakadna")
*   **Null/Undefined Handling:** The `state` input must be a non-empty string. Passing `None` or an empty string should raise a clear error, not a cryptic model failure.
*   **Question Schema Validation:** Validate the `questions` dictionary before passing it to the model. Ensure that all required fields (`type`, `instructions`, `criteria`) are present and correctly typed.

## 5. The 9 Deep Learning Dimensions

1.  **Architecture:** Non-autoregressive transformer. Single forward pass. Decoupled routing layer.
2.  **Core Abstractions:** `Router`, `TypedQuestion` (choice, score, noul), `CalibratedProbability`.
3.  **Error Handling:** Schema validation for questions. Language detection fallback. Max length truncation.
4.  **Testing:** Calibration tests (Brier score). Multilingual accuracy benchmarks. Latency benchmarks.
5.  **Security:** Input sanitization (length limits). No free-text generation, reducing prompt injection risk.
6.  **Performance:** ~33ms latency. ONNX Runtime support for edge/GPU. TileLang GPU fast path.
7.  **Deployment:** `pip install laya`. Optional extras for serve, MCP, LangChain, ONNX.
8.  **Agent Patterns:** Tooling interface for LangChain/LangGraph. MCP server for agent integration.
9.  **Data Flow:** Input state + questions -> Router -> Model -> Calibrated Probabilities -> Typed Answers.

## 6. The 8 Learning Extraction Artifacts

1.  **Pattern:** Non-autoregressive classification with calibrated probabilities.
2.  **Rule:** Use proper scoring rules for probability calibration.
3.  **Architecture Principle:** Separate routing from inference for multilingual efficiency.
4.  **Failure Mode:** Overconfident probabilities leading to false positives in risk assessment.
5.  **Reusable Skill:** Implement a router that selects the best model based on input characteristics.
6.  **Decision:** Choose non-autoregressive over autoregressive for low-latency structured extraction.
7.  **Anti-pattern:** Using LLMs for classification tasks where a classifier would suffice.
8.  **Verification Method:** Calibration plot and latency benchmark.

## 7. Actionable Agent Skill & Implementation Checklist

1.  **Define Typed Questions:** Create a schema for your questions (choice, score, noul).
2.  **Implement Router:** Build a routing layer that selects the best model based on input language and length.
3.  **Calibrate Probabilities:** Ensure your model outputs calibrated probabilities using proper scoring rules.
4.  **Benchmark Latency:** Measure inference time and ensure it meets your latency requirements.
5.  **Test Multilingual Accuracy:** Evaluate your model on multiple languages to ensure consistent performance.
6.  **Integrate with Agents:** Use LangChain or MCP to integrate Laya into your agent workflow.
7.  **Monitor Routing:** Log routing decisions to ensure the router is selecting the correct model.
8.  **Handle Edge Cases:** Implement error handling for empty inputs, invalid schemas, and max length violations.